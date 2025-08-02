FROM flink:1.17.2

# Set environment variables
ENV KAFKA_VERSION=3.1.0
ENV SCALA_VERSION=2.12
ENV KAFKA_PYTHON=2.0.2
ENV CONFLUENT_KAFKA_VERSION=2.3.0
ENV PYFLINK_VERSION=1.17.2
ENV FLINK_VERSION=1.17.2

# Preserve the existing Python path and add your custom job path
# IMPORTANT CHANGE HERE:
ENV PYTHONPATH=/opt/flink/opt/python:/opt/flink/processor
ENV PYTHON=/usr/bin/python3
ENV PATH="/usr/bin:${PATH}"

# Install Python, pip, and dependencies
RUN apt-get update && \
    apt-get install -y \
        python3 \
        python3-pip \
        python3-dev \
        build-essential \
        && \
    ln -sf /usr/bin/python3 /usr/bin/python && \
    ln -sf /usr/bin/pip3 /usr/bin/pip && \
    pip install --no-cache-dir \
        apache-flink==${PYFLINK_VERSION} \
        confluent-kafka==${CONFLUENT_KAFKA_VERSION} \
        kafka-python==${KAFKA_PYTHON} \
        pygeohash==3.1.3 && \
    apt-get remove -y python3-dev build-essential && \
    apt-get autoremove -y && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create directories
RUN mkdir -p /opt/flink/processor /opt/flink/lib

# Download Kafka and Flink connectors
RUN curl -L -o /opt/flink/lib/flink-connector-kafka-${FLINK_VERSION}.jar \
        https://repo1.maven.org/maven2/org/apache/flink/flink-connector-kafka/${FLINK_VERSION}/flink-connector-kafka-${FLINK_VERSION}.jar && \
    curl -L -o /opt/flink/lib/kafka-clients-${KAFKA_VERSION}.jar \
        https://repo1.maven.org/maven2/org/apache/kafka/kafka-clients/${KAFKA_VERSION}/kafka-clients-${KAFKA_VERSION}.jar && \
    curl -L -o /opt/flink/lib/flink-sql-connector-kafka-${FLINK_VERSION}.jar \
        https://repo1.maven.org/maven2/org/apache/flink/flink-sql-connector-kafka/${FLINK_VERSION}/flink-sql-connector-kafka-${FLINK_VERSION}.jar



# Copy your PyFlink job
COPY average_cpm_job.py /opt/flink/processor/average_cpm_job.py
COPY alert_job.py /opt/flink/processor/alert_job.py
COPY JobEnrichValidate.py /opt/flink/processor/JobEnrichValidate.py

# Verify Python installation and PyFlink
RUN python --version && \
    pip --version && \
    python -c "from pyflink.datastream import StreamExecutionEnvironment; print('PyFlink imported successfully')"

# Default command (optional)
# ENTRYPOINT ["python", "/opt/flink/processor/average_cpm_job.py"]
