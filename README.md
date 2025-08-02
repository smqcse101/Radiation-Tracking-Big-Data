# BD25_Project_M7_C
# Big Data Lab - Radiation Tracking Project

## 👥 Team Members

| Name                        | Matriculation Number | User Name |Email                        | Role                     |
|-----------------------------|----------------------|-----------|------------------|--------------------------|
| **Mahboob Abrar Ali Syed**   | 637453               | cdw0910         |[mahboob.syed@tuhh.de](mailto:mahboob.syed@tuhh.de) | Team Coordinator         |
| **Syed Mustafa Quadri**      | 638012               | cot7047            |[syed.quadri@tuhh.de](mailto:syed.quadri@tuhh.de)       |                          |



## Final Project Live Version
https://github.com/user-attachments/assets/e25d2b61-37f1-4e82-a08c-c1a12119975d






## System Architechture
<img width="1311" height="619" alt="image" src="https://github.com/user-attachments/assets/aa370fd2-f98c-41f5-a91f-843fb3875324" />



## Institute for Data Engineering
**Module**: Big Data Lab Exercises  
**Project Topic**: C - Radiation Tracking

### Overview

The advent of the Internet of Things (IoT) has significantly increased the volume and velocity of data. IoT-enabled sensor networks continuously generate data streams, which require real-time processing to avoid outdated information. This project focuses on processing and analyzing sensor data from the **Safecast Radiation Measurements** dataset, which contains millions of radiation readings across various global locations.


We will be working mostly on understanding the technology of Kafka architecture along with the real time streaming of our downloaded data from Safecast.
The goal of this project is to set up a stream processing framework to handle large-scale sensor data, specifically for radiation measurements. We will utilize **Apache Kafka** for data ingestion and **Apache Flink** for stream processing. 

### Project Objective

The project will:
1. Set up and configure Apache Kafka to stream radiation measurement data locally and then deploy on cloud
2. Implement a data provider to feed the data into Kafka.
3. Use Apache Flink to process,transform, clean and analyze the data 
4. Develop a web-based graphical user interface (GUI) i.e a map to display radiation data.
5. Provide real-time alerts based on configurable thresholds.

As the project setup grows, steps to build and run the project given at INSTRUCTIONS.md in the root directory.
Please note that the Safecast dataset needs to be downloaded, decompresed and added to data/testing for the streaming part to start working.

### Technologies Used

- **Python**: Basic EDA of the Dataset.
- **Apache Kafka**: Distributed event streaming platform for real-time data pipelines.
- **Apache Flink**: Stream processing framework for real-time data processing.
- **Docker**: Containerization platform for deploying the application.
- **Frontend**: Web-based user interface for visualizing radiation data. [leaflet.js]

### Project Structure

```plaintext
.
├── README.md                  # Project documentation
├── src/                        # Source code for Kafka producer, Flink operators, and data processing
├── docker/                     # Dockerfiles for setting up Kafka and Flink containers all yaml files goes here
├── config/                     # Configuration files for system setup mostly not needed 
├── data/                       # Raw and processed radiation data. Here we can add our measurement.csv
├── frontend/                   # Web-based GUI for visualizing data including

└── .gitignore                  # Files and directories to ignore in Git :) All cloud sshs and env variables will live here.




