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

const isProduction = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT;

let poolConfig = {};

if (process.env.DATABASE_URL) {
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
  };
  
  // Railway internal connections don't use SSL
  // ONLY enable SSL if we are NOT using the internal Railway hostname
  if (isProduction && !process.env.DATABASE_URL.includes('railway.internal')) {
    poolConfig.ssl = { rejectUnauthorized: false };
  }
} else {
  poolConfig = {
    host: process.env.PGHOST || process.env.DB_HOST,
    port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
    database: process.env.PGDATABASE || process.env.DB_NAME,
    user: process.env.PGUSER || process.env.DB_USER,
    password: String(process.env.PGPASSWORD || process.env.DB_PASSWORD || ''),
  };
  
  // Disable SSL if connecting via internal network on Railway
  if (isProduction && process.env.PGHOST && !process.env.PGHOST.includes('railway.internal')) {
    poolConfig.ssl = { rejectUnauthorized: false };
  }
}

const pool = new Pool(poolConfig);

pool.on('connect', () => {
  console.log('PostgreSQL connected successfully');
});

pool.on('error', (err) => {
  console.error('[PG-POOL-ERROR] Unexpected error on inactive client', err);
});

module.exports = pool;
