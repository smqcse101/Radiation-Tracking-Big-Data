from pyflink.datastream import StreamExecutionEnvironment
from pyflink.datastream.connectors import FlinkKafkaConsumer, FlinkKafkaProducer
from pyflink.common.serialization import SimpleStringSchema
from pyflink.common.typeinfo import Types
from pyflink.datastream.functions import KeyedProcessFunction, RuntimeContext
from pyflink.datastream.state import ValueStateDescriptor

import json
from datetime import datetime
import argparse

# -------- Thresholds per unit -------- #
'''
Since the Unit Has to be parsed and not known in advance, the thresholds are defined here.
Considering for Unit = cpm and usv 
and ignoring the other units [celcius,status,211]

For now we are passing the thresholds as command line arguments in the compose file.
Later we Need to find a workaround for FE->BE->Flink->BE->FE
'''
DEFAULT_THRESHOLDS  = {
    "cpm": 70.0,
    "usv": 0.2  
}

# ------------ Parse args for now -----------
# ------------ Need to find a workaround for FE->BE->Flink->BE->FE ----------
def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--cpm-threshold", type=float, default=None,
                   help="Alert threshold for CPM values")
    p.add_argument("--usv-threshold", type=float, default=None,
                   help="Alert threshold for µSv/h values")
    return p.parse_args()
# -------------------------------------

def parse_and_filter_valid_units(line):
    """Parse input JSON and keep only radiation data with known unit."""
    try:
        data = json.loads(line)
        unit = data.get("Unit", "").lower()

        if unit not in DEFAULT_THRESHOLDS:
            return None  # Ignore units like status/celsius/etc.
        
        return {
            "value": float(data.get("Value", 0.0)),
            "unit": unit,
            "latitude": data.get("Latitude"),
            "longitude": data.get("Longitude"),
            "location_name": data.get("Location Name", ""),
            "device_id": str(data.get("Device ID", "unknown")),
            "captured_time": data.get("Captured Time", ""),
            "height": data.get("Height", ""),
            "uploaded_time": data.get("Uploaded Time", ""),
            "loader_ID": data.get("Loader ID", ""),
        }

    except Exception as e:
        print(f"[Parse Error] {e}")
        return None


'''
Generate an alert if the value exceeds threshold for the unit.
For now its just 1 alert per unit ,later we can classify alerts based on severity.
'''
def generate_alert(record):
    """Generate an alert if the value exceeds threshold for the unit."""
    if record is None:
        return None

    thr = DEFAULT_THRESHOLDS.get(record["unit"], float("inf"))
    
    if record["value"] > thr:
        try:
            dt = datetime.strptime(record["captured_time"], "%Y-%m-%d %H:%M:%S")
            captured_iso = dt.isoformat()
        except Exception:
            captured_iso = record["captured_time"]

        alert = {
            "type": "radiation_alert",
            "message": f"High radiation ({record['value']} {record['unit']}) detected!",
            "risk_level": "high",
            "captured_time": captured_iso,
            "value": record["value"],
            "unit": record["unit"],
            "threshold": thr,
            "coordinates": {
                "lat": record["latitude"],
                "lon": record["longitude"]
            },
            "height": record["height"],
            "location_name": record["location_name"],
            "device_id": record["device_id"],
            "loader_ID": record["loader_ID"],
            "uploaded_time": record["uploaded_time"]
        }

        print(f"[ALERT] {alert}")
        return json.dumps(alert)

    return None


def main():
    # ---- read args & build THRESHOLDS ---
    args = parse_args()
    thresholds = DEFAULT_THRESHOLDS.copy()
    if args.cpm_threshold is not None:
        thresholds["cpm"] = args.cpm_threshold
    if args.usv_threshold is not None:
        thresholds["usv"] = args.usv_threshold
    # ------------------------------------
    
    env = StreamExecutionEnvironment.get_execution_environment()
    env.set_parallelism(1)

    kafka_props = {
        'bootstrap.servers': 'kafka:9092',
        'group.id': 'flink-alert-group',
        'auto.offset.reset': 'latest'
    }

    consumer = FlinkKafkaConsumer(
        topics='radiation',
        deserialization_schema=SimpleStringSchema(),
        properties=kafka_props
    )

    producer = FlinkKafkaProducer(
        topic='radiation-alerts',
        serialization_schema=SimpleStringSchema(),
        producer_config={
            'bootstrap.servers': 'kafka:9092',
            'acks': 'all',
            'enable.idempotence': 'true'
        }
    )

    stream = env.add_source(consumer)

    alerts = stream \
        .map(parse_and_filter_valid_units, output_type=Types.MAP(Types.STRING(), Types.STRING())) \
        .map(generate_alert, output_type=Types.STRING()) \
        .filter(lambda x: x is not None)

    alerts.add_sink(producer)

    env.execute("Unit-Aware Radiation Alert Generator")


if __name__ == "__main__":
    main()
