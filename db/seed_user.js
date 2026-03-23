const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT || 5432),
});

async function seedUser() {
  const users = [
    { username: 'admin', name: 'Admin', email: 'admin@kk.com', password: 'password123', role: 'admin' },
  ];

  for (const user of users) {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    console.log(`[Seed] Creating user: ${user.email}...`);
    try {
      await pool.query(
        'INSERT INTO users (username, name, email, password, role) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (email) DO NOTHING',
        [user.username, user.name, user.email, hashedPassword, user.role]
      );
    } catch (err) {
      console.error(`[Seed] Error creating ${user.email}:`, err.message);
    }
  }
}

seedUser().then(() => {
  console.log('[Seed] Finished.');
  process.exit(0);
}).catch(err => {
  console.error('[Seed] Failed:', err);
  process.exit(1);
});
