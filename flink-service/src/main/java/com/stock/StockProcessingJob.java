package com.stock;

import com.datastax.driver.core.*;
import com.datastax.driver.core.policies.DCAwareRoundRobinPolicy;
import org.apache.flink.api.common.functions.RichMapFunction;
import org.apache.flink.api.common.state.ValueState;
import org.apache.flink.api.common.state.ValueStateDescriptor;
import org.apache.flink.api.common.time.Time;
import org.apache.flink.api.common.typeinfo.TypeHint;
import org.apache.flink.api.common.typeinfo.TypeInformation;
import org.apache.flink.api.common.typeinfo.Types;
import org.apache.flink.api.java.tuple.*;
import org.apache.flink.api.java.typeutils.TypeExtractor;
import org.apache.flink.configuration.Configuration;
import org.apache.flink.streaming.api.datastream.DataStream;
import org.apache.flink.streaming.api.datastream.SingleOutputStreamOperator;
import org.apache.flink.streaming.api.environment.StreamExecutionEnvironment;
import org.apache.flink.streaming.api.functions.KeyedProcessFunction;
import org.apache.flink.table.api.EnvironmentSettings;
import org.apache.flink.table.api.Table;
import org.apache.flink.table.api.bridge.java.StreamTableEnvironment;
import org.apache.flink.types.Row;
import org.apache.flink.util.Collector;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.Serializable;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;

public class StockProcessingJob {
    private static final Logger LOG = LoggerFactory.getLogger(StockProcessingJob.class);

    static class RowToTupleMapper extends RichMapFunction<Row, Tuple12<String, Float, String, String, Integer, Integer, Float, Long, Float, Long, String, Long>> {
        @Override
        public Tuple12<String, Float, String, String, Integer, Integer, Float, Long, Float, Long, String, Long> map(Row row) {
            return Tuple12.of(
                row.getFieldAs(0),
                row.getFieldAs(1),
                row.getFieldAs(2),
                row.getFieldAs(3),
                row.getFieldAs(4),
                row.getFieldAs(5),
                row.getFieldAs(6),
                row.getFieldAs(7),
                row.getFieldAs(8),
                row.getFieldAs(9),
                row.getFieldAs(10),
                row.getFieldAs(11)
            );
        }
    }

    public static void main(String[] args) throws Exception {
        StreamExecutionEnvironment env = StreamExecutionEnvironment.getExecutionEnvironment();
        env.setParallelism(12);
        
        StreamTableEnvironment tableEnv = StreamTableEnvironment.create(
            env,
            EnvironmentSettings.newInstance().inStreamingMode().build()
        );

        String ddl = "CREATE TABLE yfinance_source (" +
            "symbol STRING," +
            "price FLOAT," +
            "`timestamp` STRING," +
            "exchange STRING," +
            "quote_type INT," +
            "market_hours INT," +
            "change_percent FLOAT," +
            "day_volume BIGINT," +
            "change FLOAT," +
            "last_size BIGINT," +
            "price_hint STRING," +
            "producer_timestamp BIGINT," +
            "event_time AS TO_TIMESTAMP(`timestamp`)," +
            "proc_time AS PROCTIME()" +
            ") WITH (" +
            "'connector' = 'kafka'," +
            "'topic' = 'yfinance'," +
            "'properties.bootstrap.servers' = 'broker-1:19092,broker-2:19092,broker-3:19092'," +
            "'properties.group.id' = 'flink-java-reader'," +
            "'scan.startup.mode' = 'latest-offset'," +
            "'format' = 'avro-confluent'," +
            "'avro-confluent.url' = 'http://schema-registry:8081'" +
            ")";
        
        tableEnv.executeSql(ddl);
        
        Table rawTable = tableEnv.sqlQuery(
            "SELECT symbol, price, `timestamp`, exchange, quote_type, market_hours, " +
            "change_percent, day_volume, change, last_size, price_hint, producer_timestamp " +
            "FROM yfinance_source " +
            "WHERE price > 0 AND day_volume > 0 AND price < 1000000 AND ABS(change_percent) < 50"
        );

        DataStream<Tuple12<String, Float, String, String, Integer, Integer, Float, Long, Float, Long, String, Long>> rawStream =
            tableEnv.toDataStream(rawTable, Row.class)
                .map(new RowToTupleMapper());

        DataStream<Tuple9<String, String, Integer, Float, Float, Float, Float, Long, Float>> dailyStream = 
            rawStream.keyBy(t -> t.f0)
                .process(new StatefulDailyAggregator());

        DataStream<Tuple10<String, String, String, Timestamp, Float, Float, Float, Float, Long, Float>> minuteStream =
            rawStream.keyBy(t -> t.f0)
                .process(new StatefulMinuteAggregator());

        rawStream.map(new StockPricesSink());
        rawStream.keyBy(t -> t.f0)
            .reduce((a, b) -> b)
            .map(new StockLatestSink());
        dailyStream.map(new StockDailySink());
        minuteStream.map(new StockAggSink());

        env.execute("Stock Processing Pipeline - Java");
    }

    static abstract class BaseScyllaSink<T> extends RichMapFunction<T, T> {
        protected transient Cluster cluster;
        protected transient Session session;
        
        @Override
        public void open(Configuration parameters) {
            cluster = Cluster.builder()
                .addContactPoints("scylla-node1", "scylla-node2", "scylla-node3")
                .withPort(9042)
                .withLoadBalancingPolicy(DCAwareRoundRobinPolicy.builder().build())
                .withProtocolVersion(ProtocolVersion.V4)
                .withCompression(ProtocolOptions.Compression.LZ4)
                .build();
            session = cluster.connect("stock_data");
            session.getCluster().getConfiguration().getSocketOptions().setReadTimeoutMillis(10000);
            prepareStatements();
        }

        protected abstract void prepareStatements();
        
        @Override
        public void close() {
            if (session != null && !session.isClosed()) {
                session.close();
            }
            if (cluster != null && !cluster.isClosed()) {
                cluster.close();
            }
        }
    }

    static class StockPricesSink extends BaseScyllaSink<Tuple12<String, Float, String, String, Integer, Integer, Float, Long, Float, Long, String, Long>> {
        private transient PreparedStatement stmt;

        @Override
        protected void prepareStatements() {
            stmt = session.prepare(
                "INSERT INTO stock_prices (symbol, timestamp, change, change_percent, day_volume, " +
                "exchange, last_size, market_hours, price, price_hint, quote_type, producer_timestamp) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            );
        }

        @Override
        public Tuple12<String, Float, String, String, Integer, Integer, Float, Long, Float, Long, String, Long> map(
            Tuple12<String, Float, String, String, Integer, Integer, Float, Long, Float, Long, String, Long> value) {
            try {
                session.executeAsync(stmt.bind(
                    value.f0, value.f2, Math.round(value.f8 * 100.0) / 100.0, 
                    Math.round(value.f6 * 100.0) / 100.0, value.f7,
                    value.f3, value.f9, value.f5, Math.round(value.f1 * 100.0) / 100.0,
                    value.f10, value.f4, value.f11
                ));
            } catch (Exception e) {
                LOG.error("StockPricesSink error", e);
            }
            return value;
        }
    }

    static class StockLatestSink extends BaseScyllaSink<Tuple12<String, Float, String, String, Integer, Integer, Float, Long, Float, Long, String, Long>> {
        private transient PreparedStatement stmt;

        @Override
        protected void prepareStatements() {
            stmt = session.prepare(
                "INSERT INTO stock_latest_prices (symbol, change, change_percent, day_volume, exchange, " +
                "last_size, market_hours, price, price_hint, quote_type, timestamp, producer_timestamp) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            );
        }

        @Override
        public Tuple12<String, Float, String, String, Integer, Integer, Float, Long, Float, Long, String, Long> map(
            Tuple12<String, Float, String, String, Integer, Integer, Float, Long, Float, Long, String, Long> value) {
            try {
                LocalDateTime dt = parseTimestamp(value.f2);
                session.executeAsync(stmt.bind(
                    value.f0, Math.round(value.f8 * 100.0) / 100.0, 
                    Math.round(value.f6 * 100.0) / 100.0, value.f7,
                    value.f3, value.f9, value.f5, Math.round(value.f1 * 100.0) / 100.0,
                    value.f10, value.f4, Timestamp.valueOf(dt), value.f11
                ));
            } catch (Exception e) {
                LOG.error("StockLatestSink error", e);
            }
            return value;
        }
    }

    static class StockAggSink extends BaseScyllaSink<Tuple10<String, String, String, Timestamp, Float, Float, Float, Float, Long, Float>> {
        private transient PreparedStatement stmt;

        @Override
        protected void prepareStatements() {
            stmt = session.prepare(
                "INSERT INTO stock_prices_agg (symbol, bucket_date, interval, ts, close, high, low, open, volume, vwap) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            );
        }

        @Override
        public Tuple10<String, String, String, Timestamp, Float, Float, Float, Float, Long, Float> map(
            Tuple10<String, String, String, Timestamp, Float, Float, Float, Float, Long, Float> value) {
            try {
                String[] dateParts = value.f1.split("-");
                com.datastax.driver.core.LocalDate date = com.datastax.driver.core.LocalDate.fromYearMonthDay(
                    Integer.parseInt(dateParts[0]),
                    Integer.parseInt(dateParts[1]),
                    Integer.parseInt(dateParts[2])
                );
                
                session.executeAsync(stmt.bind(
                    value.f0, date, value.f2, value.f3,
                    Math.round(value.f5 * 100.0) / 100.0, Math.round(value.f6 * 100.0) / 100.0,
                    Math.round(value.f7 * 100.0) / 100.0, Math.round(value.f4 * 100.0) / 100.0,
                    value.f8, Math.round(value.f9 * 100.0) / 100.0
                ));
            } catch (Exception e) {
                LOG.error("StockAggSink error", e);
            }
            return value;
        }
    }

    static class StockDailySink extends BaseScyllaSink<Tuple9<String, String, Integer, Float, Float, Float, Float, Long, Float>> {
        private transient PreparedStatement stmt;

        @Override
        protected void prepareStatements() {
            stmt = session.prepare(
                "INSERT INTO stock_daily_summary (symbol, trade_date, change, change_percent, close, exchange, " +
                "high, low, market_hours, open, quote_type, volume, vwap) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            );
        }

        @Override
        public Tuple9<String, String, Integer, Float, Float, Float, Float, Long, Float> map(
            Tuple9<String, String, Integer, Float, Float, Float, Float, Long, Float> value) {
            try {
                float open = Math.max(0.0f, value.f3);
                float close = Math.max(0.0f, value.f4);
                float high = Math.max(value.f5, Math.max(open, close));
                float low = value.f6 > 0 ? Math.min(value.f6, Math.min(open, close)) : Math.min(open, close);
                
                float change = open > 0 ? close - open : 0;
                float changePct = open > 0 ? (change / open * 100) : 0;
                
                String tradeDate = value.f1.split(" ")[0];
                String[] dateParts = tradeDate.split("-");
                com.datastax.driver.core.LocalDate date = com.datastax.driver.core.LocalDate.fromYearMonthDay(
                    Integer.parseInt(dateParts[0]),
                    Integer.parseInt(dateParts[1]),
                    Integer.parseInt(dateParts[2])
                );
                
                session.executeAsync(stmt.bind(
                    value.f0, date, Math.round(change * 100.0) / 100.0,
                    Math.round(changePct * 100.0) / 100.0, Math.round(close * 100.0) / 100.0, "NASDAQ",
                    Math.round(high * 100.0) / 100.0, Math.round(low * 100.0) / 100.0, 1,
                    Math.round(open * 100.0) / 100.0, 1, value.f7, Math.round(value.f8 * 100.0) / 100.0
                ));
            } catch (Exception e) {
                LOG.error("StockDailySink error", e);
            }
            return value;
        }
    }

    static class DailyState implements Serializable {
        String tradeDate;
        float open, high, low, close;
        long volume;
        double weightedSum, vwap;
        int tickCount;

        DailyState(String date, float price, long vol, long size) {
            this.tradeDate = date;
            this.open = this.high = this.low = this.close = price;
            this.volume = vol;
            this.weightedSum = price * size;
            this.vwap = price;
            this.tickCount = 1;
        }
    }

    static class MinuteState implements Serializable {
        String bucket;
        float open, high, low, close;
        long volume;
        double weightedSum, vwap;

        MinuteState(String bucket, float price, long size) {
            this.bucket = bucket;
            this.open = this.high = this.low = this.close = price;
            this.volume = size;
            this.weightedSum = price * size;
            this.vwap = price;
        }
    }

    static class StatefulDailyAggregator extends KeyedProcessFunction<String, 
        Tuple12<String, Float, String, String, Integer, Integer, Float, Long, Float, Long, String, Long>,
        Tuple9<String, String, Integer, Float, Float, Float, Float, Long, Float>> {
        
        private transient ValueState<DailyState> state;

        @Override
        public void open(Configuration parameters) {
            ValueStateDescriptor<DailyState> descriptor = new ValueStateDescriptor<>("daily-state", DailyState.class);
            state = getRuntimeContext().getState(descriptor);
        }

        @Override
        public void processElement(
            Tuple12<String, Float, String, String, Integer, Integer, Float, Long, Float, Long, String, Long> value,
            Context ctx, Collector<Tuple9<String, String, Integer, Float, Float, Float, Float, Long, Float>> out) throws Exception {
            
            if (value.f5 != 1) return;

            String tradeDate = getTradeDate(value.f2);
            DailyState s = state.value();

            if (s == null || !s.tradeDate.equals(tradeDate)) {
                s = new DailyState(tradeDate, value.f1, value.f7, value.f9);
            } else {
                s.high = Math.max(s.high, value.f1);
                s.low = Math.min(s.low, value.f1);
                s.close = value.f1;
                s.volume = value.f7;
                s.weightedSum += value.f1 * value.f9;
                s.vwap = s.volume > 0 ? s.weightedSum / s.volume : value.f1;
                s.tickCount++;
            }

            state.update(s);
            out.collect(Tuple9.of(
                value.f0, s.tradeDate, s.tickCount,
                (float) Math.round(s.open * 100.0) / 100.0f,
                (float) Math.round(s.close * 100.0) / 100.0f,
                (float) Math.round(s.high * 100.0) / 100.0f,
                (float) Math.round(s.low * 100.0) / 100.0f,
                s.volume,
                (float) Math.round(s.vwap * 100.0) / 100.0f
            ));
        }
    }

    static class StatefulMinuteAggregator extends KeyedProcessFunction<String,
        Tuple12<String, Float, String, String, Integer, Integer, Float, Long, Float, Long, String, Long>,
        Tuple10<String, String, String, Timestamp, Float, Float, Float, Float, Long, Float>> {
        
        private transient ValueState<MinuteState> state;

        @Override
        public void open(Configuration parameters) {
            ValueStateDescriptor<MinuteState> descriptor = new ValueStateDescriptor<>("minute-state", MinuteState.class);
            state = getRuntimeContext().getState(descriptor);
        }

        @Override
        public void processElement(
            Tuple12<String, Float, String, String, Integer, Integer, Float, Long, Float, Long, String, Long> value,
            Context ctx, Collector<Tuple10<String, String, String, Timestamp, Float, Float, Float, Float, Long, Float>> out) throws Exception {
            
            if (value.f5 != 1) return;

            String bucket = getMinuteBucket(value.f2);
            MinuteState s = state.value();

            if (s == null || !s.bucket.equals(bucket)) {
                s = new MinuteState(bucket, value.f1, value.f9);
            } else {
                s.high = Math.max(s.high, value.f1);
                s.low = Math.min(s.low, value.f1);
                s.close = value.f1;
                s.volume += value.f9;
                s.weightedSum += value.f1 * value.f9;
                s.vwap = s.volume > 0 ? s.weightedSum / s.volume : value.f1;
            }

            state.update(s);
            
            LocalDateTime dt = LocalDateTime.parse(bucket, DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"));
            out.collect(Tuple10.of(
                value.f0, bucket.split(" ")[0], "1m", Timestamp.valueOf(dt),
                (float) Math.round(s.open * 100.0) / 100.0f,
                (float) Math.round(s.close * 100.0) / 100.0f,
                (float) Math.round(s.high * 100.0) / 100.0f,
                (float) Math.round(s.low * 100.0) / 100.0f,
                s.volume,
                (float) Math.round(s.vwap * 100.0) / 100.0f
            ));
        }
    }

    static LocalDateTime parseTimestamp(String ts) {
        try {
            if (ts.matches("\\d+")) {
                long epoch = Long.parseLong(ts);
                if (epoch > 1e10) epoch /= 1000;
                return LocalDateTime.ofInstant(Instant.ofEpochSecond(epoch), ZoneOffset.UTC);
            }
            return LocalDateTime.parse(ts.replace("Z", ""));
        } catch (Exception e) {
            return LocalDateTime.now(ZoneOffset.UTC);
        }
    }

    static String getTradeDate(String ts) {
        return parseTimestamp(ts).format(DateTimeFormatter.ofPattern("yyyy-MM-dd"));
    }

    static String getMinuteBucket(String ts) {
        return parseTimestamp(ts).format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"));
    }
}

