from cassandra.cluster import Cluster
from cassandra.cluster import NoHostAvailable
from confluent_kafka.schema_registry import SchemaRegistryClient
from confluent_kafka.schema_registry.avro import AvroDeserializer
from aiokafka import AIOKafkaConsumer
import os
import json
import time

class Connect_db:
    def __init__(self):
        self.cluster = None
        self.session = None

    def connect(self):
        if not self.cluster:
            cassandra_host = os.getenv('CASSANDRA_HOST', 'localhost')
            if cassandra_host.startswith('['):
                try:
                    cassandra_hosts = json.loads(cassandra_host)
                except json.JSONDecodeError:
                    cassandra_hosts = ['localhost']
            else:
                cassandra_hosts = [h.strip() for h in cassandra_host.split(',') if h.strip()]
                if not cassandra_hosts:
                    cassandra_hosts = ['localhost']
            
            cassandra_port = int(os.getenv('CASSANDRA_PORT', '9042'))
            cassandra_keyspace = os.getenv('CASSANDRA_KEYSPACE', 'stock_data')
            retry_attempts = int(os.getenv('CASSANDRA_RETRY_ATTEMPTS', '30'))
            retry_delay_seconds = float(os.getenv('CASSANDRA_RETRY_DELAY_SECONDS', '2'))

            self.cluster = Cluster(cassandra_hosts, port=cassandra_port)

            for attempt in range(1, retry_attempts + 1):
                try:
                    self.session = self.cluster.connect(cassandra_keyspace)
                    break
                except NoHostAvailable:
                    if attempt == retry_attempts:
                        self.cluster.shutdown()
                        self.cluster = None
                        raise
                    time.sleep(retry_delay_seconds)

    def get_session(self):
        return self.session

    def close(self):
        if self.session:
            self.session.shutdown()
        if self.cluster:
            self.cluster.shutdown()

db_instance = Connect_db()

def get_db():
    return db_instance.get_session()
    
# DummyContext cho AvroDeserializer
class DummyContext:
    def __init__(self, topic):
        self.topic = topic
        self.headers = {}
        self.field = ""
        
schema_registry_url = os.getenv('SCHEMA_REGISTRY_URL', 'http://localhost:8082')
_schema_registry_client = SchemaRegistryClient({'url': schema_registry_url})
_avro_deserializer = AvroDeserializer(schema_registry_client=_schema_registry_client)

def get_avro_deserializer():
    return _avro_deserializer