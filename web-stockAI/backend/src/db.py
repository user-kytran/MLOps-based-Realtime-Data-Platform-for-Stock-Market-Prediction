from cassandra.cluster import Cluster
from confluent_kafka.schema_registry import SchemaRegistryClient
from confluent_kafka.schema_registry.avro import AvroDeserializer
from aiokafka import AIOKafkaConsumer
import os
import json

class Connect_db:
    def __init__(self):
        self.cluster = None
        self.session = None

    def connect(self):
        if not self.cluster:
            cassandra_host = os.getenv('CASSANDRA_HOST', 'localhost')
            if cassandra_host.startswith('['):
                cassandra_hosts = json.loads(cassandra_host)
            else:
                cassandra_hosts = [cassandra_host]
            
            cassandra_port = int(os.getenv('CASSANDRA_PORT', '9042'))
            cassandra_keyspace = os.getenv('CASSANDRA_KEYSPACE', 'stock_data')
            self.cluster = Cluster(cassandra_hosts, port=cassandra_port)
            self.session = self.cluster.connect(cassandra_keyspace)

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