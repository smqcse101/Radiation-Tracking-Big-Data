# Project Setup Instructions

## 1. Initial Setup and Build
```bash
# Build and start all services (Kafka, Producer, Zookeeper, Postgres)
docker-compose up --build

# To shut down all containers when needed
docker-compose down
```

## 2. Kafka Setup Verification
```bash
# Access Kafka container
docker exec -it bd25_project_m7_c-kafka-1 bash

# Create radiation topic (this is now automated via topics-setup service)
kafka-topics --create \
    --bootstrap-server localhost:9092 \
    --replication-factor 1 \
    --partitions 1 \
    --topic radiation

# Verify topic creation
kafka-topics --list --bootstrap-server localhost:9092

# Monitor messages in the topic (optional, for debugging) - radiation
kafka-console-consumer \
    --bootstrap-server localhost:9092 \
    --topic radiation-processed \
    --from-beginning

# Monitor messages in the topic (optional, for debugging) - radiation-processed
kafka-console-consumer \
    --bootstrap-server localhost:9092 \
    --topic safecast.aggregated.grid \
    --from-beginning
```

## 3. Submitting a Flink Job

In this version of project, Auto submission of processor & Alert job is supported and working.

```bash

# To Submit the Job Manually
docker-compose exec jobmanager flink run -py /opt/flink/processor/average_cpm_job.py

# TO Submit the Alert Job Manually
docker-compose exec jobmanager flink run -py /opt/flink/processor/alert_job.py

#Verify Job Submission
docker-compose exec jobmanager flink list
```

## 4. Running the front end Visualization
A simple visualization of how the data might look like once it is processed from flink and moved to the backend.
```bash 
# Just run
docker-compose up --build
# Navigate to the following local host to see the Map
http://localhost:3000/
```
The idea was to simulate a flink setup stream data inflow. Here i have take sample.json file as our input to the backend mock-api-server.js. Here this api justs waits for 1 second then processes to the next json. Like that it takes all 300 json points one by one and then delivers it to the map acording to the radiation value.
Next steps should be to actually read from Flynk Stream.




## Common Issues & Troubleshooting
1. If services don't start properly, try:
   - `docker-compose down` to stop all containers
   - `docker-compose up --build` to rebuild and start fresh

2. If Kafka topic already exists:
   - Skip the topic creation step
   - Or delete existing topic:
     ```bash
     kafka-topics --delete --bootstrap-server localhost:9092 --topic radiation
     ```

3. To clear all data and start fresh:
   ```bash
   docker-compose down -v    # Removes all volumes
   docker-compose up --build # Rebuilds from scratch
   ```

   docker exec -it jobmanager /bin/bash -c "cd /opt/flink/bin && ./flink run -py /opt/flink/processor/average_cpm_job.py"