import signal, asyncio, logging, os, time
from confluent_kafka.admin import AdminClient, NewTopic
from confluent_kafka import SerializingProducer
from confluent_kafka.serialization import StringSerializer
from confluent_kafka.schema_registry import SchemaRegistryClient
from confluent_kafka.schema_registry.avro import AvroSerializer
import yfinance as yf
from websockets.exceptions import ConnectionClosedError

yf.set_tz_cache_location("/home/obito/.cache/py-yfinance")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

schema_registry_conf = {'url': os.getenv('SCHEMA_REGISTRY_URL')}
schema_registry_client = SchemaRegistryClient(schema_registry_conf)
user_schema_str = """
{
  "namespace": "finance.avro",
  "type": "record",
  "name": "stock",
  "fields": [
    {"name": "symbol", "type": "string"},
    {"name": "price", "type": "float"},
    {"name": "timestamp", "type": "string"},
    {"name": "exchange", "type": "string"},
    {"name": "quote_type", "type": "int"},
    {"name": "market_hours", "type": "int"},
    {"name": "change_percent", "type": "float"},
    {"name": "day_volume", "type": "int"},
    {"name": "change", "type": "float"},
    {"name": "last_size", "type": "int"},
    {"name": "price_hint", "type": "string"},
    {"name": "producer_timestamp", "type": "long"}
  ]
}
"""

class StockDataProducer:
    def __init__(self, bootstrap=None, topic='yfinance', symbols=None, partitions=16, replication=5):
        self.topic = topic
        self.symbols = symbols or []
        self.shutdown_event = asyncio.Event()
        self.ws = None
        
        bootstrap = bootstrap or os.getenv('KAFKA_BOOTSTRAP_SERVERS')
        self.admin = AdminClient({'bootstrap.servers': bootstrap})
        if topic not in self.admin.list_topics(timeout=5).topics:
            self.admin.create_topics([NewTopic(topic, num_partitions=partitions, replication_factor=replication)])
        
        self.avro_serializer = AvroSerializer(
            schema_registry_client=schema_registry_client,
            schema_str=user_schema_str,
            to_dict=lambda obj, ctx: obj
        )
        self.producer = SerializingProducer({
            'bootstrap.servers': bootstrap, 
            'acks': 'all', 
            'retries': 3,
            'key.serializer': StringSerializer('utf_8'),
            'value.serializer': self.avro_serializer
        })
        
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
    
    def _signal_handler(self, signum, frame):
        logger.info(f"Nhận signal {signum}, đang shutdown...")
        self.shutdown_event.set()

    def _send(self, msg: dict):
        mapped_data = {
            "symbol": msg.get("id", ""),
            "price": float(msg.get("price", 0.0)),
            "timestamp": str(msg.get("time", "")),
            "exchange": msg.get("exchange", ""),
            "quote_type": int(msg.get("quote_type", 0)),
            "market_hours": int(msg.get("market_hours", 0)),
            "change_percent": float(msg.get("change_percent", 0.0)),
            "day_volume": int(msg.get("day_volume", 0)),
            "change": float(msg.get("change", 0.0)),
            "last_size": int(msg.get("last_size", 0)),
            "price_hint": str(msg.get("price_hint", "")),
            "producer_timestamp": int(time.time() * 1000)
        }
        self.producer.produce(topic=self.topic, value=mapped_data)
        self.producer.poll(0)

    async def run(self):
        try:
            logger.info(f"Đang kết nối WebSocket cho {len(self.symbols)} symbols...")
            self.ws = yf.AsyncWebSocket()
            await self.ws.subscribe(self.symbols)
            logger.info("Subscribe thành công")
            
            async def message_handler(msg):
                self._send(msg)
            
            await self.ws.listen(message_handler)
        except Exception as e:
            logger.error(f"Lỗi trong quá trình chạy: {e}")
            os.kill(os.getpid(), signal.SIGTERM)

        
async def main():
    # all_symbols = ["AAA.VN","AAM.VN","ABS.VN","ABT.VN","ACB.VN","ACC.VN","ACL.VN","ADG.VN","ADP.VN","ADS.VN","AGG.VN","AGR.VN","ANV.VN","APG.VN","APH.VN","ASM.VN","ASP.VN","AST.VN","BAF.VN","BCE.VN","BCM.VN","BFC.VN","BIC.VN","BID.VN","BKG.VN","BMC.VN","BMI.VN","BMP.VN","BRC.VN","BSI.VN","BTP.VN","BVH.VN","BWE.VN","C32.VN","CCL.VN","CDC.VN","CII.VN","CLC.VN","CLL.VN","CMG.VN","CMX.VN","CNG.VN","CRC.VN","CRE.VN","CSM.VN","CSV.VN","CTD.VN","CTF.VN","CTG.VN","CTI.VN","CTR.VN","CTS.VN","D2D.VN","DAH.VN","DBC.VN","DBD.VN","DBT.VN","DC4.VN","DCL.VN","DCM.VN","DGC.VN","DGW.VN","DHA.VN","DHC.VN","DHM.VN","DIG.VN","DMC.VN","DPG.VN","DPM.VN","DPR.VN","DRC.VN","DRL.VN","DSC.VN","DSE.VN","DSN.VN","DTA.VN","DVP.VN","DXG.VN","DXS.VN","EIB.VN","ELC.VN","EVE.VN","EVF.VN","FCM.VN","FCN.VN","FIR.VN","FIT.VN","FMC.VN","FPT.VN","FRT.VN","FTS.VN","GAS.VN","GDT.VN","GEE.VN","GEX.VN","GIL.VN","GMD.VN","GSP.VN","GVR.VN","HAG.VN","HAH.VN","HAP.VN","HAR.VN","HAX.VN","HCD.VN","HCM.VN","HDB.VN","HDC.VN","HDG.VN","HHP.VN","HHS.VN","HHV.VN","HID.VN","HII.VN","HMC.VN","HPG.VN","HPX.VN","HQC.VN","HSG.VN","HSL.VN","HT1.VN","HTG.VN","HTI.VN","HTN.VN","HUB.VN","HVH.VN","ICT.VN","IDI.VN","IJC.VN","ILB.VN","IMP.VN","ITC.VN","ITD.VN","JVC.VN","KBC.VN","KDC.VN","KDH.VN","KHG.VN","KHP.VN","KMR.VN","KOS.VN","KSB.VN","LAF.VN","LBM.VN","LCG.VN","LHG.VN","LIX.VN","LPB.VN","LSS.VN","MBB.VN","MCM.VN","MCP.VN","MHC.VN","MIG.VN","MSB.VN","MSH.VN","MSN.VN","MWG.VN","NAB.VN","NAF.VN","NBB.VN","NCT.VN","NHA.VN","NHH.VN","NKG.VN","NLG.VN","NNC.VN","NO1.VN","NSC.VN","NT2.VN","NTL.VN","OCB.VN","OGC.VN","ORS.VN","PAC.VN","PAN.VN","PC1.VN","PDR.VN","PET.VN","PGC.VN","PHC.VN","PHR.VN","PIT.VN","PLP.VN","PLX.VN","PNJ.VN","POW.VN","PPC.VN","PTB.VN","PTC.VN","PTL.VN","PVD.VN","PVP.VN","PVT.VN","QCG.VN","RAL.VN","REE.VN","RYG.VN","SAB.VN","SAM.VN","SAV.VN","SBG.VN","SBT.VN","SCR.VN","SCS.VN","SFC.VN","SFG.VN","SGN.VN","SGR.VN","SGT.VN","SHB.VN","SHI.VN","SIP.VN","SJD.VN","SJS.VN","SKG.VN","SMB.VN","SSB.VN","SSI.VN","ST8.VN","STB.VN","STK.VN","SVT.VN","SZC.VN","SZL.VN","TCB.VN","TCH.VN","TCI.VN","TCL.VN","TCM.VN","TCO.VN","TCT.VN","TDC.VN","TDG.VN","TDP.VN","TEG.VN","THG.VN","TIP.VN","TLD.VN","TLG.VN","TLH.VN","TMT.VN","TNH.VN","TNI.VN","TNT.VN","TPB.VN","TRC.VN","TSC.VN","TTA.VN","TTF.VN","TV2.VN","TVS.VN","TYA.VN","UIC.VN","VCA.VN","VCB.VN","VCG.VN","VCI.VN","VDS.VN","VFG.VN","VGC.VN","VHC.VN","VHM.VN","VIB.VN","VIC.VN","VIP.VN","VIX.VN","VJC.VN","VMD.VN","VND.VN","VNL.VN","VNM.VN","VNS.VN","VOS.VN","VPB.VN","VPG.VN","VPH.VN","VPI.VN","VRC.VN","VRE.VN","VSC.VN","VTO.VN","VTP.VN","YBM.VN","YEG.VN"]
    
    # Lấy symbols từ environment variable hoặc sử dụng toàn bộ danh sách
    symbols_env = os.getenv('SYMBOLS', '')
    if symbols_env:
        symbols = symbols_env.split(',')
    # else:
    #     symbols = all_symbols
    
    logger.info(f"Khởi động Stock WebSocket Producer với {len(symbols)} symbols...")
    streamer = StockDataProducer(symbols=symbols, partitions=12, replication=3)
    await streamer.run()

if __name__ == "__main__":
    asyncio.run(main())
