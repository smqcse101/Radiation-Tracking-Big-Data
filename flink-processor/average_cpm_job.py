from pyflink.datastream import StreamExecutionEnvironment
from pyflink.datastream.connectors import FlinkKafkaConsumer, FlinkKafkaProducer
from pyflink.common.serialization import SimpleStringSchema
from pyflink.common.typeinfo import Types
from pyflink.datastream.functions import KeyedProcessFunction, RuntimeContext
from pyflink.datastream.state import ValueStateDescriptor

import json

class GlobalRunningAverage(KeyedProcessFunction):
    def open(self, runtime_context: RuntimeContext):
        """Initialize state for maintaining running sum and count."""
        descriptor = ValueStateDescriptor(
            "global_sum_count",
            Types.TUPLE([Types.FLOAT(), Types.INT()])
        )
        self.state = runtime_context.get_state(descriptor)

    def process_element(self, value, ctx):
        """Update running total and calculate global real-time average."""
        radiation = value  # Direct radiation value now

        current = self.state.value()
        if current is None:
            current = (0.0, 0)

        new_sum = current[0] + radiation
        new_count = current[1] + 1
        self.state.update((new_sum, new_count))

        avg = new_sum / new_count

        result = json.dumps({
            "count": new_count,
            "real_time_avg_cpm": avg
        })

        print(f"Computed Global Avg: {result}")
        yield result

def parse_value(line):
    """Extract 'Value' from JSON line."""
    try:
        data = json.loads(line)
        return float(data.get("Value", 0.0))
    except Exception as e:
        print(f"JSON Parsing Error: {e}")
        return 0.0

def main():
    env = StreamExecutionEnvironment.get_execution_environment()
    env.set_parallelism(1)

    kafka_props = {
        'bootstrap.servers': 'kafka:9092',
        'group.id': 'flink-global-avg-group',
        'auto.offset.reset': 'latest'
    }

    consumer = FlinkKafkaConsumer(
        topics='radiation',
        deserialization_schema=SimpleStringSchema(),
        properties=kafka_props
    )

    producer = FlinkKafkaProducer(
        topic='radiation-averaged',
        serialization_schema=SimpleStringSchema(),
        producer_config={
            'bootstrap.servers': 'kafka:9092',
            'linger.ms': '100',
            'acks': 'all',
            'enable.idempotence': 'true'
        }
    )

    stream = env.add_source(consumer)

    parsed = stream \
        .map(parse_value, output_type=Types.FLOAT()) \
        .key_by(lambda _: "global") \
        .process(GlobalRunningAverage(), output_type=Types.STRING())

    parsed.add_sink(producer)

    env.execute("Global Real-Time Radiation Averaging")

if __name__ == "__main__":
    main()
