const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
const envPath = path.resolve(__dirname, '../.env');
console.log('[DB] envPath:', envPath);
console.log('[DB] envExists:', fs.existsSync(envPath));

require('dotenv').config({ path: envPath });

console.log('[DB] Environment Check:', {
  DB_HOST: process.env.DB_HOST,
  DB_PASSWORD: process.env.DB_PASSWORD ? 'SET' : 'NOT SET',
  DB_USER: process.env.DB_USER
});

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: String(process.env.DB_PASSWORD || ''), // Coerce to string
});

pool.on('connect', () => {
  console.log('PostgreSQL connected successfully');
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL error:', err.message);
});

module.exports = pool;
