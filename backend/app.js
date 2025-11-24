// backend/app.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import inventoryRoutes from './routes/inventory.js';
import aiLogsRoutes from './routes/ai-logs.js';
import aiRoutes from './routes/ai.js';
import repairOrderRoutes from './routes/repair-orders.js';

dotenv.config();

const app = express();
// Note: We REMOVED "const PORT = ..." because Netlify decides the port now.

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  optionsSuccessStatus: 200
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Routes
// IMPORTANT: Keep these exactly as they are. 
// Netlify will pass the full URL (e.g., /api/inventory) to this router.
app.use('/api/inventory', inventoryRoutes.default || inventoryRoutes);
app.use('/api/ai-logs', aiLogsRoutes.default || aiLogsRoutes);
app.use('/api/ai', aiRoutes.default || aiRoutes);
app.use('/api/ros', repairOrderRoutes.default || repairOrderRoutes);

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

// --- CHANGE IS HERE ---
// OLD: app.listen(...)  <-- DELETED
// NEW: Export the app so Netlify can load it
export default app;