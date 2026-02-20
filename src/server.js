// src/server.js
// Tally Konnect Backend - Main Express Application
require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const path = require('path');
const fs = require('fs');

// WebSocket relay — must be imported BEFORE server starts
const wsRelay = require('./services/ws-relay.service');

const config = require('./config');
const logger = require('./utils/logger');
const routes = require('./routes');

console.log('[Startup] JWT Secret length:', config.security.jwtSecret ? config.security.jwtSecret.length : 0);
const { errorHandler, generalLimiter } = require('./middleware');
const { testConnection: testDb } = require('./db');
const SchedulerService = require('./services/scheduler.service');

// Import DB operations
const migration = require('./db/migrations/001_initial_schema');
const migration002 = require('./db/migrations/002_users');
const migration003 = require('./db/migrations/003_auth_upgrade');
const { seed } = require('./db/seeds/run');

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
  allowedHeaders: ['Content-Type', 'Authorization', 'x-bridge-key'],
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
// DESKTOP BRIDGE DOWNLOAD
// ===========================================
const publicPath = path.join(__dirname, '..', 'public');
app.use('/downloads', express.static(path.join(publicPath, 'downloads')));

app.get('/api/download/bridge', (req, res) => {
  const zipPath = path.join(publicPath, 'downloads', 'TallyKonnectBridge.zip');
  if (fs.existsSync(zipPath)) {
    res.download(zipPath, 'TallyKonnectBridge.zip');
  } else {
    res.status(404).json({ success: false, error: { message: 'Bridge package not available. Please contact admin.' } });
  }
});

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
  } else {
    // Run migrations and seeds on startup
    try {
      logger.info('Checking database schema...');
      await migration.up();
      logger.info('Migration 001 done');
    } catch (err) {
      logger.error({ err }, 'Migration 001 failed');
    }

    try {
      await migration002.up();
      logger.info('Migration 002 (users) done');
    } catch (err) {
      logger.error({ err }, 'Migration 002 failed');
    }

    try {
      await migration003.up();
      logger.info('Migration 003 (auth upgrade) done');
    } catch (err) {
      logger.error({ err }, 'Migration 003 failed');
    }

    try {
      await seed();
      logger.info('Database seeded');
    } catch (err) {
      logger.error({ err }, 'Seed failed');
    }
  }

  // ── Start HTTP + WebSocket server ──────────────────────────────────────────
  const { WebSocketServer } = require('ws');
  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  // Attach relay to the WS server
  wsRelay.attach(wss);

  // Upgrade HTTP → WS only for /ws/bridge
  server.on('upgrade', (req, socket, head) => {
    if (req.url === '/ws/bridge') {
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
    } else {
      socket.destroy();
    }
  });

  server.listen(PORT, HOST, () => {
    logger.info({ port: PORT, host: HOST, env: process.env.NODE_ENV }, 'Tally Konnect server started');
  });

  // Initialize scheduler after DB is ready (even if partial failure, try to run)
  if (dbOk) {
    try {
      // Small delay to ensure tables exist if async creation lag (though await should handle it)
      setTimeout(async () => {
        await SchedulerService.init();
      }, 2000);
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
