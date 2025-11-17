import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import inventoryRoutes from './routes/inventory.js';
import aiLogsRoutes from './routes/ai-logs.js';
import aiRoutes from './routes/ai.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  optionsSuccessStatus: 200
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' })); // Increased limit for AI requests

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/inventory', inventoryRoutes);
app.use('/api/ai-logs', aiLogsRoutes);
app.use('/api/ai', aiRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Genthrust Repairs API is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Server Error]:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`[Server] Genthrust Repairs API running on port ${PORT}`);
  console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[Server] CORS enabled for: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
  console.log(`[Server] Health check: http://localhost:${PORT}/health`);
  console.log(`[Server] Inventory API: http://localhost:${PORT}/api/inventory`);
  console.log(`[Server] AI Logs API: http://localhost:${PORT}/api/ai-logs`);
  console.log(`[Server] AI Proxy API: http://localhost:${PORT}/api/ai`);

  // Validate critical environment variables
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('[Server] WARNING: ANTHROPIC_API_KEY not set - AI features will not work');
  }
});
