const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT || 5432),
});

async function reinitDb() {
  console.log('[DB] Dropping current public schema...');
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await pool.query('GRANT ALL ON SCHEMA public TO postgres; GRANT ALL ON SCHEMA public TO public;');

  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).sort();

  for (const file of files) {
    if (file.endsWith('.sql')) {
      console.log(`[Migration] Running ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      try {
        await pool.query(sql);
        console.log(`[Migration] ${file} success.`);
      } catch (err) {
        console.error(`[Migration] ${file} error:`, err.message);
      }
    }
  }
}

reinitDb().then(() => {
  console.log('[DB] Re-initialization finished.');
  process.exit(0);
}).catch(err => {
  console.error('[DB] Re-initialization failed:', err);
  process.exit(1);
});
