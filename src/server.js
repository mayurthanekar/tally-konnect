// src/server.js
// Tally Konnect Backend - Main Express Application
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const path = require('path');

const config = require('./config');
const logger = require('./utils/logger');
const routes = require('./routes');
const { errorHandler, generalLimiter } = require('./middleware');
const { testConnection: testDb } = require('./db');
const SchedulerService = require('./services/scheduler.service');

const app = express();

// Trust proxy for Render.com (behind load balancer)
app.set('trust proxy', 1);

// ===========================================
// MIDDLEWARE
// ===========================================
app.use(helmet({
  contentSecurityPolicy: false,  // Disable CSP to allow inline styles in React
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({
  origin: config.security.corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('short', {
    stream: { write: (msg) => logger.info(msg.trim()) },
  }));
}

// Rate limiting
app.use('/api', generalLimiter);

// ===========================================
// API ROUTES
// ===========================================
app.use('/api', routes);

// ===========================================
// SERVE REACT FRONTEND (production)
// ===========================================
const frontendBuildPath = path.join(__dirname, '..', 'frontend', 'build');
app.use(express.static(frontendBuildPath));

// All non-API routes serve the React app (SPA routing)
app.get('*', (req, res, next) => {
  // Skip if it's an API route
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(frontendBuildPath, 'index.html'), (err) => {
    if (err) {
      // If frontend build doesn't exist, show a helpful message
      res.status(200).send(`
        <html>
          <head><title>Tally Konnect</title></head>
          <body style="font-family: sans-serif; padding: 40px; text-align: center;">
            <h1>Tally Konnect API</h1>
            <p>Backend is running. Frontend build not found.</p>
            <p>Run <code>npm run build:frontend</code> to build the React UI.</p>
            <p><a href="/api/health">API Health Check</a></p>
          </body>
        </html>
      `);
    }
  });
});

// Error handler (must be last)
app.use(errorHandler);

// ===========================================
// START SERVER
// ===========================================
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

async function start() {
  // Test database connection
  const dbOk = await testDb();
  if (!dbOk) {
    logger.error('Database connection failed — check DATABASE_URL');
    // Don't exit — Render health checks will catch this
  }

  app.listen(PORT, HOST, () => {
    logger.info({ port: PORT, host: HOST, env: process.env.NODE_ENV }, 'Tally Konnect server started');
  });

  // Initialize scheduler after DB is ready
  if (dbOk) {
    try {
      await SchedulerService.init();
    } catch (err) {
      logger.error({ err }, 'Scheduler init failed');
    }
  }
}

// Graceful shutdown
function shutdown(signal) {
  logger.info({ signal }, 'Shutdown signal received');
  SchedulerService.shutdown();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();
