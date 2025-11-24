import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import inventoryRoutes from './routes/inventory.js';
import aiLogsRoutes from './routes/ai-logs.js';
import aiRoutes from './routes/ai.js';
import repairOrderRoutes from './routes/repair-orders.js';

dotenv.config();

const app = express();

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  optionsSuccessStatus: 200
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

// Request logging (Helpful for debugging 404s)
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ----------------------------------------------------------------------
// ROUTING CONFIGURATION (Fix for Netlify 404s)
// ----------------------------------------------------------------------

// 1. Create a Router to hold all API logic
const apiRouter = express.Router();

// 2. Mount your routes to this router (Note: We removed '/api' from here)
apiRouter.use('/inventory', inventoryRoutes.default || inventoryRoutes);
apiRouter.use('/ai-logs', aiLogsRoutes.default || aiLogsRoutes);
apiRouter.use('/ai', aiRoutes.default || aiRoutes);
apiRouter.use('/ros', repairOrderRoutes.default || repairOrderRoutes);

// 3. Mount the Router to the App at MULTIPLE paths
// This ensures it works whether Netlify sends the full path or the rewrite
app.use(['/api', '/.netlify/functions/api'], apiRouter);

// ----------------------------------------------------------------------

// Health check endpoint (Available at /health and /api/health)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Genthrust Repairs API is running' });
});
// Also add it to the router so /api/health works
apiRouter.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Genthrust Repairs API is running (via Router)' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Server Error]:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

export default app;