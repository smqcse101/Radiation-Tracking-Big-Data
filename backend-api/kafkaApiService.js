const express = require('express');
const cors = require('cors');
const { Kafka } = require('kafkajs');
const app = express();
const PORT = 3001;

app.use(cors());

// Kafka setup
const kafka = new Kafka({
  clientId: 'node-stream-client',
  brokers: ['kafka:9092'] // Update if your broker address differs
});

// Consumers for each topic
const averageConsumer = kafka.consumer({ groupId: 'node-sse-average' });
const radiationConsumer = kafka.consumer({ groupId: 'node-sse-radiation' });
const alertConsumer = kafka.consumer({ groupId: 'node-sse-alerts' });
const safecastConsumerEnriched = kafka.consumer({ groupId: 'node-sse-safecast' }); // New consumer for safecast

// Store latest data
let latestAverage = null;
let latestRadiationData = null;
let latestAlert = null;
let latestSafecastDataEnriched = null; // Stores the most recent safecast record

// Connect to 'radiation-averaged' topic
async function startAverageConsumer() {
  try {
    await averageConsumer.connect();
    await averageConsumer.subscribe({ topic: 'radiation-averaged', fromBeginning: false });
    await averageConsumer.run({
      eachMessage: async ({ message }) => {
        latestAverage = message.value.toString();
        console.log(`📊 Average CPM updated: ${latestAverage}`);
      },
    });
  } catch (err) {
    console.error('❌ Average consumer failed:', err);
  }
}

// Connect to 'radiation' topic (raw device data)
async function startRadiationConsumer() {
  try {
    await radiationConsumer.connect();
    await radiationConsumer.subscribe({ topic: 'radiation', fromBeginning: false });
    await radiationConsumer.run({
      eachMessage: async ({ message }) => {
        latestRadiationData = JSON.parse(message.value.toString());
      },
    });
  } catch (err) {
    console.error('❌ Radiation consumer failed:', err);
  }
}

// Connect to 'radiation-alerts' topic
async function startAlertConsumer() {
  try {
    await alertConsumer.connect();
    await alertConsumer.subscribe({ topic: 'radiation-alerts', fromBeginning: false });
    await alertConsumer.run({
      eachMessage: async ({ message }) => {
        latestAlert = JSON.parse(message.value.toString());
        console.log(`🚨 New radiation alert: ${latestAlert.message}`);
      },
    });
  } catch (err) {
    console.error('❌ Alert consumer failed:', err);
  }
}

// NEW: Connect to 'safecast.cleaned.enriched' topic
async function startsafecastConsumerEnriched() {
  try {
    await safecastConsumerEnriched.connect();
    await safecastConsumerEnriched.subscribe({ topic: 'safecast.cleaned.enriched', fromBeginning: false });
    await safecastConsumerEnriched.run({
      eachMessage: async ({ message }) => {
        latestSafecastDataEnriched = JSON.parse(message.value.toString());
        console.log(`🌍 New Safecast data received`);
      },
    });
  } catch (err) {
    console.error('❌ Safecast consumer failed:', err);
  }
}

// Initialize all consumers
async function startKafkaConsumers() {
  await Promise.all([
    startAverageConsumer(), 
    startRadiationConsumer(),
    startAlertConsumer(),
    startsafecastConsumerEnriched() // Start the new safecast consumer
  ]);
  console.log('✅ All Kafka consumers running');
}

startKafkaConsumers().catch(console.error);

// SSE endpoint for average CPM (real-time)
app.get('/api/realtime/average', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const intervalId = setInterval(() => {
    if (latestAverage) {
      res.write(`data: ${latestAverage}\n\n`);
    }
  }, 100);

  req.on('close', () => clearInterval(intervalId));
});

// SSE endpoint for radiation markers (real-time)
app.get('/api/realtime/radiation', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const intervalId = setInterval(() => {
    if (latestRadiationData) {
      res.write(`data: ${JSON.stringify(latestRadiationData)}\n\n`);
    }
  }, 100);

  req.on('close', () => clearInterval(intervalId));
});

// SSE endpoint for radiation alerts (real-time)
app.get('/api/realtime/alerts', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const intervalId = setInterval(() => {
    if (latestAlert) {
      res.write(`data: ${JSON.stringify(latestAlert)}\n\n`);
    }
  }, 100);

  req.on('close', () => clearInterval(intervalId));
});

// NEW: SSE endpoint for safecast data (real-time)
app.get('/api/realtime/safecastEnriched', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const intervalId = setInterval(() => {
    if (latestSafecastDataEnriched) {
      res.write(`data: ${JSON.stringify(latestSafecastDataEnriched)}\n\n`);
    }
  }, 100);

  req.on('close', () => clearInterval(intervalId));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});