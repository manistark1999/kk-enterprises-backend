const pool = require('../config/db');

/**
 * Log an action to the history table
 * @param {Object} params
 * @param {Object} [params.client] - Optional DB client for transactions
 * @param {string} params.module_name - e.g., 'Brand', 'Staff', 'Job Card'
 * @param {string} params.action_type - e.g., 'CREATE', 'UPDATE', 'DELETE'
 * @param {string|number} params.record_id - ID of the affected record
 * @param {string} params.title - Short summary of the action
 * @param {string} params.description - Detailed description
 * @param {string} [params.user_name='admin'] - Who performed the action
 */
async function logHistory({ client, module_name, action_type, record_id, title, description, changed_data = {}, user_name = 'admin' }) {
  const db = client || pool;
  try {
    const query = `
      INSERT INTO history (module_name, action_type, record_id, title, description, changed_data, user_name)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;
    const values = [module_name, action_type, String(record_id), title, description, JSON.stringify(changed_data), user_name];
    await db.query(query, values);
  } catch (err) {
    console.error('[History Log Error]', err.message);
  }
}

module.exports = { logHistory };
