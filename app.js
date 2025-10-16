// Enable Datadog tracing
require('dd-trace').init();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const client = require('prom-client'); // 📊 Prometheus client

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --------------------
// ✅ Prometheus Metrics
// --------------------
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ register: client.register });

// Custom counter metric (example: API requests)
const httpRequestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
});

// Middleware to count requests
app.use((req, res, next) => {
  res.on('finish', () => {
    httpRequestCounter.inc({
      method: req.method,
      route: req.path,
      status: res.statusCode,
    });
  });
  next();
});

// Expose /metrics for Prometheus
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

// --------------------
// ✅ MongoDB Connection
// --------------------
const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017/grievance-portal';
mongoose.connect(mongoUrl, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.error('❌ DB error:', err));

// --------------------
// ✅ API Routes
// --------------------
app.use('/api/auth', require('./routes/auth'));
app.use('/api/complaints', require('./routes/complaints'));

// Home route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// --------------------
// ✅ Healthcheck for K8s
// --------------------
app.get('/health', (req, res) => {
  res.json({ status: 'UP' });
});

// --------------------
// ✅ Start Server
// --------------------
const PORT = process.env.PORT || 3001; // match docker-compose
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  console.log(`📊 Metrics available at http://localhost:${PORT}/metrics`);
});
