// backend/server.js
import app from './app.js'; // Import the logic we just separated
import dotenv from 'dotenv';

dotenv.config();
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`[Local Server] Running on port ${PORT}`);
  console.log(`[Local Server] http://localhost:${PORT}/health`);
});