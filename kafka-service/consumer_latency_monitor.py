#!/usr/bin/env python3
import json
import time
import logging
import sys
from collections import defaultdict
from datetime import datetime
from confluent_kafka import Consumer, KafkaException, KafkaError
from confluent_kafka.schema_registry import SchemaRegistryClient
from confluent_kafka.schema_registry.avro import AvroDeserializer
from statistics import mean, median

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class LatencyMonitor:
    def __init__(self, topics, bootstrap_servers='localhost:29092,localhost:39092,localhost:49092', 
                 schema_registry_url='http://localhost:8081'):
        self.topics = topics
        self.latencies = defaultdict(list)
        self.symbol_latencies = defaultdict(list)
        self.message_count = defaultdict(int)
        self.null_ts_count = defaultdict(int)
        self.decode_errors = defaultdict(int)
        self.start_time = time.time()
        self.last_report_time = time.time()
        
        try:
            schema_client = SchemaRegistryClient({'url': schema_registry_url})
            self.avro_deserializer = AvroDeserializer(schema_client, return_record_name=False)
            logger.info(f"Schema Registry: {schema_registry_url}")
        except Exception as e:
            logger.warning(f"Schema Registry failed: {e}")
            self.avro_deserializer = None
        
        self.consumer = Consumer({
            'bootstrap.servers': bootstrap_servers,
            'group.id': 'latency-monitor-group',
            'auto.offset.reset': 'latest',
            'enable.auto.commit': True,
            'session.timeout.ms': 30000,
        })
        logger.info(f"Topics: {topics}")
    
    def calculate_latency(self, message):
        try:
            data = None
            if self.avro_deserializer and isinstance(message.value(), bytes):
                try:
                    class Ctx:
                        def __init__(self, topic):
                            self.topic = topic
                    data = self.avro_deserializer(message.value(), Ctx(message.topic()))
                except:
                    pass
            
            if data is None and isinstance(message.value(), bytes):
                try:
                    data = json.loads(message.value().decode('utf-8'))
                except:
                    self.decode_errors[message.topic()] += 1
                    return None
            elif data is None:
                data = message.value()
            
            if not isinstance(data, dict):
                return None
            
            after = data.get('after', {})
            producer_ts_field = after.get('producer_timestamp')
            producer_ts = producer_ts_field.get('value') if isinstance(producer_ts_field, dict) else producer_ts_field or data.get('producer_timestamp')
            
            symbol_field = after.get('symbol')
            symbol = symbol_field.get('value') if isinstance(symbol_field, dict) else symbol_field or after.get('symbol') or data.get('symbol') or 'UNKNOWN'
            
            if producer_ts is None:
                return None
            
            producer_ts = int(producer_ts) if isinstance(producer_ts, (str, float)) else producer_ts
            consumer_ts = int(time.time() * 1000)
            latency_ms = consumer_ts - producer_ts
            
            if latency_ms < 0 or latency_ms > 3600000:
                return None
            
            return {
                'symbol': symbol,
                'latency_ms': latency_ms,
                'producer_ts': producer_ts
            }
        except:
            return None
    
    def log_stats(self, batch_latencies):
        if not batch_latencies:
            return
        
        current_time = time.time()
        time_elapsed = current_time - self.last_report_time
        self.last_report_time = current_time
        
        all_latencies = []
        total_msgs = sum(len(v) for v in batch_latencies.values())
        throughput = total_msgs / time_elapsed if time_elapsed > 0 else 0
        
        logger.info("=" * 80)
        logger.info(f"STATS | {total_msgs} msgs | {throughput:.1f} msgs/s | {time_elapsed:.1f}s")
        logger.info("=" * 80)
        
        for topic, latencies in batch_latencies.items():
            if latencies:
                all_latencies.extend(latencies)
                sorted_lat = sorted(latencies)
                p50 = sorted_lat[len(sorted_lat) // 2]
                p95 = sorted_lat[int(len(sorted_lat) * 0.95)] if len(sorted_lat) > 20 else sorted_lat[-1]
                p99 = sorted_lat[int(len(sorted_lat) * 0.99)] if len(sorted_lat) > 100 else sorted_lat[-1]
                
                logger.info(f"Topic: {topic.split('.')[-1]}")
                logger.info(f"  Count: {len(latencies)} | Avg: {mean(latencies):.1f}ms | P50: {p50:.1f}ms | P95: {p95:.1f}ms | P99: {p99:.1f}ms")
        
        if all_latencies:
            sorted_all = sorted(all_latencies)
            p50 = sorted_all[len(sorted_all) // 2]
            p95 = sorted_all[int(len(sorted_all) * 0.95)] if len(sorted_all) > 20 else sorted_all[-1]
            p99 = sorted_all[int(len(sorted_all) * 0.99)] if len(sorted_all) > 100 else sorted_all[-1]
            
            logger.info("OVERALL:")
            logger.info(f"  Avg: {mean(all_latencies):.1f}ms | P50: {p50:.1f}ms | P95: {p95:.1f}ms | P99: {p99:.1f}ms | Min: {min(all_latencies):.0f}ms | Max: {max(all_latencies):.0f}ms")
        
        logger.info("=" * 80)
    
    def log_symbol_stats(self, top_n=5):
        if not self.symbol_latencies:
            return
        
        sorted_symbols = sorted(self.symbol_latencies.items(), key=lambda x: len(x[1]), reverse=True)[:top_n]
        
        logger.info(f"TOP {top_n} SYMBOLS:")
        for symbol, latencies in sorted_symbols:
            if latencies:
                logger.info(f"  {symbol}: {len(latencies)} msgs | Avg: {mean(latencies):.1f}ms | Min/Max: {min(latencies):.0f}/{max(latencies):.0f}ms")
    
    def run(self, report_interval=100, max_messages=None):
        self.consumer.subscribe(self.topics)
        logger.info(f"Started | Topics: {self.topics} | Report every: {report_interval} msgs")
        
        total_messages = 0
        batch_latencies = defaultdict(list)
        
        try:
            while True:
                msg = self.consumer.poll(timeout=1.0)
                if msg is None:
                    continue
                if msg.error():
                    if msg.error().code() != KafkaError._PARTITION_EOF:
                        raise KafkaException(msg.error())
                    continue
                
                total_messages += 1
                topic = msg.topic()
                self.message_count[topic] += 1
                
                latency_info = self.calculate_latency(msg)
                if latency_info:
                    latency_ms = latency_info['latency_ms']
                    symbol = latency_info['symbol']
                    self.latencies[topic].append(latency_ms)
                    batch_latencies[topic].append(latency_ms)
                    self.symbol_latencies[symbol].append(latency_ms)
                else:
                    self.null_ts_count[topic] += 1
                
                if total_messages % report_interval == 0:
                    self.log_stats(batch_latencies)
                    self.log_symbol_stats()
                    batch_latencies.clear()
                
                if max_messages and total_messages >= max_messages:
                    break
                    
        except KeyboardInterrupt:
            logger.info("Interrupted")
        finally:
            total_time = time.time() - self.start_time
            overall_throughput = total_messages / total_time if total_time > 0 else 0
            
            logger.info("=" * 80)
            logger.info("FINAL STATS")
            logger.info("=" * 80)
            logger.info(f"Total: {total_messages} msgs | {overall_throughput:.1f} msgs/s | {total_time:.1f}s")
            
            if self.latencies:
                self.log_stats(self.latencies)
                self.log_symbol_stats(top_n=10)
            
            for topic in self.topics:
                msgs = self.message_count[topic]
                null_ts = self.null_ts_count[topic]
                decode_err = self.decode_errors[topic]
                logger.info(f"{topic.split('.')[-1]}: {msgs} msgs | Null TS: {null_ts} | Decode errors: {decode_err}")
            
            self.consumer.close()
            logger.info("Closed")


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--topics', nargs='+', default=['cdc_stock_prices.stock_data.stock_prices', 'cdc_stock_latest_prices.stock_data.stock_latest_prices'])
    parser.add_argument('--bootstrap-servers', default='localhost:29092,localhost:39092,localhost:49092')
    parser.add_argument('--schema-registry', default='http://localhost:8081')
    parser.add_argument('--report-interval', type=int, default=10)
    parser.add_argument('--max-messages', type=int, default=None)
    parser.add_argument('--debug', action='store_true')
    args = parser.parse_args()
    
    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)
    
    monitor = LatencyMonitor(args.topics, args.bootstrap_servers, args.schema_registry)
    try:
        monitor.run(args.report_interval, args.max_messages)
    except Exception as e:
        logger.error(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
