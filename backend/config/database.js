import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Determine which database to use based on NODE_ENV
const isProduction = process.env.NODE_ENV === 'production';
const dbName = isProduction
  ? process.env.DB_NAME_PROD
  : process.env.DB_NAME_DEV;

console.log(`[Database] Environment: ${process.env.NODE_ENV}`);
console.log(`[Database] Using database: ${dbName}`);

// Create a connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: dbName,
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
