FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt ./
COPY producer.py ./
RUN pip install --no-cache-dir -r requirements.txt
RUN apt-get update && apt-get install -y netcat-openbsd

# Use ENTRYPOINT with CMD combination for flexibility
ENTRYPOINT ["python", "producer.py"]
# Set default arguments that can be overridden
CMD ["--input-file", "/app/testing/sample_measurements.csv", "--chunk-size", "1000", "--interval", "1.0"]