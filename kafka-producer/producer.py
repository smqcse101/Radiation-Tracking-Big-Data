# producer.py
from confluent_kafka import Producer
import pandas as pd
import json
import time
import logging
import argparse
import sys
import math
from typing import Optional

# Keep your existing logging configuration
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
class ChunkingCSVReader:
    def __init__(self, file_path: str, chunk_size: int = 1000):
        self.file_path = file_path
        self.chunk_size = chunk_size
        self.current_position = 0
        self._check_file()
    
    def _check_file(self):
        """Validate file exists and has required columns"""
        try:
            # Read just the header
            df = pd.read_csv(self.file_path, nrows=0)
            required_cols = {
                'Captured Time', 'Latitude', 'Longitude', 'Value', 'Unit',
                'Location Name', 'Device ID', 'MD5Sum', 'Height', 'Surface',
                'Radiation', 'Uploaded Time', 'Loader ID'
            }
            if not required_cols.issubset(df.columns):
                missing = required_cols - set(df.columns)
                raise ValueError(f"Missing columns: {missing}")
        except Exception as e:
            logger.error(f"File validation failed: {str(e)}")
            raise

    def read_chunk(self) -> Optional[pd.DataFrame]:
        """Read the next chunk of data from CSV file"""
        try:
            chunk = pd.read_csv(
                self.file_path,
                skiprows=range(1, self.current_position + 1) if self.current_position > 0 else None,
                nrows=self.chunk_size
            )
            
            if chunk.empty:
                return None
                
            self.current_position += len(chunk)
            logger.info(f"Read chunk of {len(chunk)} rows. Total rows processed: {self.current_position}")
            return chunk
            
        except Exception as e:
            logger.error(f"Error reading chunk: {str(e)}")
            return None

def filter_and_transform_chunk(chunk: pd.DataFrame) -> pd.DataFrame:
    """Filter valid records from a chunk"""
    return chunk[
        (chunk['Unit'].notna()) &
        (chunk['Latitude'].notna()) &
        (chunk['Longitude'].notna()) &
        (chunk['Value'].notna())
    ]
# Safety check added to handle null values
def safe_float(val):
    """Converts val to float if possible, else returns None"""
    try:
        if val in [None, '', 'NaN'] or (isinstance(val, float) and math.isnan(val)):
            return None
        return float(val)
    except (ValueError, TypeError):
        return None

def safe_str(val):
    """Converts val to string if possible,else returns empty string '' """
    if val is None or (isinstance(val, float) and math.isnan(val)):
        return ''
    return str(val)

def produce_messages(chunk: pd.DataFrame, producer: Producer, topic: str):
    """Send filtered chunk data to Kafka"""
    try:
        valid_data = filter_and_transform_chunk(chunk)
        
        if valid_data.empty:
            logger.warning("No valid records found in chunk after filtering!")
            return
            
        for _, row in valid_data.iterrows():
            #Added cols with safety check
            message = {
                    'Captured Time': safe_str(row.get('Captured Time')),
                    'Value': safe_float(row.get('Value')),
                    'Unit': safe_str(row.get('Unit')),
                    'Latitude': safe_float(row.get('Latitude')),
                    'Longitude': safe_float(row.get('Longitude')),
                    'Location Name': safe_str(row.get('Location Name')),
                    'Device ID': safe_str(row.get('Device ID')),
                    'Height': safe_float(row.get('Height')),
                    'Uploaded Time': safe_str(row.get('Uploaded Time')),
                    'Loader ID': safe_str(row.get('Loader ID')),
                    }
            
            producer.produce(
                topic,
                value=json.dumps(message),
                callback=lambda err, msg: (
                    logger.error(f"Delivery failed: {err}") if err 
                    else logger.debug(f"Sent to {msg.topic()}")
                )
            )
            
            # Throttle if needed
            time.sleep(0.01)
            
        producer.poll(0)  # Trigger delivery reports
        
    except Exception as e:
        logger.error(f"Message production failed: {str(e)}")
        raise

def main():
    parser = argparse.ArgumentParser(description='Chunked CSV to Kafka producer')
    parser.add_argument('--input-file', type=str, required=True, help='Path to input CSV file')
    parser.add_argument('--chunk-size', type=int, default=1000, help='Number of rows to read per chunk')
    parser.add_argument('--interval', type=float, default=1.0, help='Interval between chunks in seconds')
    args = parser.parse_args()

    try:
        # Initialize producer
        producer = Producer({'bootstrap.servers': 'kafka:9092'})
        
        # Initialize reader
        reader = ChunkingCSVReader(args.input_file, args.chunk_size)
        logger.info(f"Starting to read from {args.input_file} with chunk size {args.chunk_size}")
        
        while True:
            chunk = reader.read_chunk()
            
            if chunk is None:
                logger.info("No new data available, waiting...")
                time.sleep(args.interval)
                continue
                
            produce_messages(chunk, producer, 'radiation')
            producer.flush()  # Ensure all messages are sent
            
            logger.info(f"Processed chunk of {len(chunk)} rows")
            time.sleep(args.interval)
            
    except KeyboardInterrupt:
        logger.info("Shutting down gracefully...")
    except Exception as e:
        logger.critical(f"Fatal error: {str(e)}")
    finally:
        producer.flush()

if __name__ == "__main__":
    main()