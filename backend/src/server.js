/**
 * JourneyPulse — Express Server Entry Point
 *
 * AI-powered connected campaign journey simulator.
 * Loads environment config, mounts API routes, and starts the HTTP server.
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';

// Route imports
import simulateRouter from './routes/simulate.js';
import variantsRouter from './routes/variants.js';
import journeyRouter from './routes/journey.js';
import calibrateRouter from './routes/calibrate.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/** Enable CORS for frontend running on a different port */
app.use(cors());

/** Parse incoming JSON request bodies */
app.use(express.json({ limit: '2mb' }));

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/** Health-check endpoint — useful for uptime monitors & load-balancers */
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'journey-pulse',
    timestamp: new Date().toISOString(),
  });
});

/** Campaign simulation — run personas through a campaign message */
app.use('/api/simulate', simulateRouter);

/** Variant generation — create A/B/C message variants via LLM */
app.use('/api/variants', variantsRouter);

/** Journey replay — retrieve & inspect multi-step journey history */
app.use('/api/journey', journeyRouter);

/** Calibration — tune persona parameters & validate realism */
app.use('/api/calibrate', calibrateRouter);

// ---------------------------------------------------------------------------
// Global Error Handler
// ---------------------------------------------------------------------------

/**
 * Catch-all error handling middleware.
 * Logs the error stack and returns a structured JSON response.
 */
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('❌ Unhandled error:', err.stack || err.message);

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: {
      message: err.message || 'Internal server error',
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    },
  });
});

// ---------------------------------------------------------------------------
// Start Server
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`\n🚀 JourneyPulse server running on http://localhost:${PORT}`);
  console.log(`   Health check → http://localhost:${PORT}/api/health\n`);
});

export default app;
