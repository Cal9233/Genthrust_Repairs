import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// REMOVED: fs, path, and url imports because we don't read files anymore
// REMOVED: __filename and __dirname definitions (This fixes the crash!)

dotenv.config();

// Determine which database to use based on NODE_ENV
const isProduction = process.env.NODE_ENV === 'production';
const dbName = isProduction
  ? process.env.DB_NAME_PROD
  : process.env.DB_NAME_DEV;

console.log(`[Database] Environment: ${process.env.NODE_ENV}`);
console.log(`[Database] Using database: ${dbName}`);

// --- SSL CONFIGURATION (The Netlify Way) ---
// Instead of reading a file, we read the text variable we set in Netlify
let sslConfig = undefined;
let caContent = process.env.DB_SSL_CA_CONTENT;

if (caContent) {
  try {
    // Clean up the certificate string (remove spaces/newlines that getting copy-pasted often breaks)
    const cleanBase64 = caContent.replace(/\s/g, '').replace(/\\n/g, '');
    
    // Re-add the proper headers if they got messed up
    if (!cleanBase64.includes('BEGINCERTIFICATE')) {
        caContent = `-----BEGIN CERTIFICATE-----\n${cleanBase64}\n-----END CERTIFICATE-----`;
    }

    sslConfig = {
        ca: caContent,
        rejectUnauthorized: true
    };
    console.log(`[Database] SSL certificate loaded from Environment Variable`);
  } catch (error) {
    console.error(`[Database] Warning: Failed to process SSL variable:`, error.message);
  }
}
// -------------------------------------------

// Create a connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: dbName,
  ssl: sslConfig, // <--- Use our new config
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// Create separate pool for legacy inventory database
export const inventoryPool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME_INVENTORY || 'genthrust_inventory',
  ssl: sslConfig, // <--- Use our new config
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// Test the main connection
// Note: We don't block the export, just log the result
pool.getConnection()
  .then(connection => {
    console.log(`[Database] MySQL connection pool established successfully to ${dbName}`);
    connection.release();
  })
  .catch(err => {
    // Don't crash the app here, just log error. 
    // Netlify functions might start "cold" so immediate connection isn't always guaranteed.
    console.error('[Database] Error connecting to MySQL:', err.message);
  });

export default pool;