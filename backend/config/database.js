import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

// Get __dirname equivalent in ES6 modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine which database to use based on NODE_ENV
const isProduction = process.env.NODE_ENV === 'production';
const dbName = isProduction
  ? process.env.DB_NAME_PROD
  : process.env.DB_NAME_DEV;

console.log(`[Database] Environment: ${process.env.NODE_ENV}`);
console.log(`[Database] Using database: ${dbName}`);

// Read SSL certificate if specified (required for Aiven Cloud)
let sslConfig = undefined;
if (process.env.DB_SSL_CA) {
  try {
    const certPath = path.join(__dirname, '..', process.env.DB_SSL_CA);
    const caCert = fs.readFileSync(certPath);
    sslConfig = { ca: caCert };
    console.log(`[Database] SSL certificate loaded from: ${process.env.DB_SSL_CA}`);
  } catch (error) {
    console.error(`[Database] Warning: Failed to load SSL certificate from ${process.env.DB_SSL_CA}:`, error.message);
  }
}

// Create a connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: dbName,
  ssl: sslConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// Create separate pool for legacy inventory database (for backward compatibility)
export const inventoryPool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME_INVENTORY || 'genthrust_inventory',
  ssl: sslConfig,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// Test the main connection
pool.getConnection()
  .then(connection => {
    console.log(`[Database] MySQL connection pool established successfully to ${dbName}`);
    connection.release();
  })
  .catch(err => {
    console.error('[Database] Error connecting to MySQL:', err.message);
  });

// Test the inventory connection
inventoryPool.getConnection()
  .then(connection => {
    console.log(`[Database] Legacy inventory connection established successfully`);
    connection.release();
  })
  .catch(err => {
    console.warn('[Database] Warning: Legacy inventory connection failed:', err.message);
  });

export default pool;
