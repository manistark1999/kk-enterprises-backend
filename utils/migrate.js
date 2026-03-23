const fs = require('fs');
const path = require('path');
const pool = require('../config/db');
const bcrypt = require('bcryptjs');

const runMigrations = async () => {
  try {
    // 1. Create migrations tracking table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        file_name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Map existing previously-migrated DB structurally mapping existing environments gracefully if present
    const { rows } = await pool.query('SELECT file_name FROM schema_migrations');
    const executedMigrations = rows.map(row => row.file_name);

    // 3. Read all files in new db/migrations repository
    const migrationsDir = path.join(__dirname, '../db/migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.warn('[DB] Migrations logic bypassed missing migrations root!');
      return;
    }
    
    // Sort array sequentially tracking exact iteration mappings
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

    // 4. Run new unapplied migrations
    for (const file of files) {
      if (!executedMigrations.includes(file)) {
        console.log(`[DB] Running migration: ${file}`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        
        await pool.query('BEGIN');
        try {
          await pool.query(sql);
          await pool.query('INSERT INTO schema_migrations (file_name) VALUES ($1)', [file]);
          await pool.query('COMMIT');
          console.log(`[DB] Successfully applied ${file}`);
        } catch (err) {
          await pool.query('ROLLBACK');
          console.error(`[DB] Error in migration ${file}:`, err.message);
          throw err;
        }
      }
    }

    // 5. Seed Default Security Administrator
    const adminEmail = 'admin@kkenterprises.com';
    const adminUsername = 'admin';
    const checkAdmin = await pool.query("SELECT * FROM users WHERE email = $1 OR username = $2", [adminEmail, adminUsername]);
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    if (checkAdmin.rows.length === 0) {
      await pool.query(
        "INSERT INTO users (username, name, email, password, role) VALUES ($1, $2, $3, $4, $5)",
        [adminUsername, 'Administrator', adminEmail, hashedPassword, 'admin']
      );
      console.log("[DB] Default admin user securely injected successfully");
    } else {
      // Refresh local dev token hashes seamlessly resolving broken credential bugs
      const user = checkAdmin.rows[0];
      await pool.query(
        "UPDATE users SET email = $1, username = $2, password = $3, role = 'admin', name = $4 WHERE id = $5",
        [adminEmail, adminUsername, hashedPassword, 'Administrator', user.id]
      );
      console.log("[DB] Local Administrator sync refreshed seamlessly");
    }

    console.log("[DB] All migrations applied securely connected full End-to-End Environment Schema successfully!");

  } catch (error) {
    console.error('[DB] Master Migration Flow structurally failed:', error);
  }
};

module.exports = runMigrations;
