const mysql = require('mysql2');

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'chat_app',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Get promise-based pool
const promisePool = pool.promise();

// Test database connection
async function testConnection() {
  try {
    const connection = await promisePool.getConnection();
    console.log('✓ Database connected successfully');
    connection.release();
    return true;
  } catch (error) {
    console.error('✗ Database connection failed:', error.message);
    return false;
  }
}

module.exports = {
  pool: promisePool,
  testConnection
};
