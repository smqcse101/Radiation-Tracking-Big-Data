from pyflink.datastream import StreamExecutionEnvironment
from pyflink.datastream.connectors import FlinkKafkaConsumer, FlinkKafkaProducer
from pyflink.common.serialization import SimpleStringSchema
from pyflink.common.typeinfo import Types
from pyflink.datastream import MapFunction
import pygeohash as pgh 
import json

class GeohashEnrichment(MapFunction):
    def map(self, value):
        try:
            record = json.loads(value)
            lat = float(record['Latitude'])
            lon = float(record['Longitude'])
            
            # Add geohashes at different precision levels
            record['geohash_7'] = pgh.encode(lat, lon, precision=7)  # ~153m accuracy
            record['geohash_5'] = pgh.encode(lat, lon, precision=5)  # ~4.9km accuracy
            record['geohash_3'] = pgh.encode(lat, lon, precision=3)  # ~78km accuracy
            
            return json.dumps(record)
        except Exception as e:
            print(f"Error enriching record: {e}")
            return value  # Return original if enrichment fails

def main():
    env = StreamExecutionEnvironment.get_execution_environment()
    env.set_parallelism(1)

    kafka_props = {
        'bootstrap.servers': 'kafka:9092',
        'group.id': 'flink-enrich-validate-group',
        'auto.offset.reset': 'latest'
    }

    consumer = FlinkKafkaConsumer(
        topics='radiation',
        deserialization_schema=SimpleStringSchema(),
        properties=kafka_props
    )

    producer = FlinkKafkaProducer(
        topic='safecast.cleaned.enriched',
        serialization_schema=SimpleStringSchema(),
        producer_config={
            'bootstrap.servers': 'kafka:9092',
            'acks': 'all',
            'enable.idempotence': 'true'
        }
    )

    stream = env.add_source(consumer)
    
    # Add geohash enrichment
    enriched_stream = stream.map(
        GeohashEnrichment(),
        output_type=Types.STRING()
    )
    
    enriched_stream.add_sink(producer)
    env.execute("GeohashEnrichmentJob")

if __name__ == "__main__":
    main()