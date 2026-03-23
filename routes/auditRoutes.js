const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// GET /api/audit-logs - get audit trail from the consolidated 'history' table
router.get('/', async (req, res) => {
  try {
    const { module_name, action_type, limit = 100 } = req.query;
    let query = 'SELECT * FROM history';
    const conditions = [];
    const values = [];

    if (module_name) {
      conditions.push(`module_name = $${values.length + 1}`);
      values.push(module_name);
    }
    if (action_type) {
      conditions.push(`action_type = $${values.length + 1}`);
      values.push(action_type.toUpperCase());
    }
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ` ORDER BY created_at DESC LIMIT $${values.length + 1}`;
    values.push(parseInt(limit));

    const result = await pool.query(query, values);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[AuditLog Route] fetch error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/audit-logs - create audit trail record in 'history' table
router.post('/', async (req, res) => {
  try {
    const { table_name, record_id, action, changed_data, performed_by, title, description } = req.body;
    if (!table_name || !action) {
      return res.status(400).json({ success: false, message: 'module_name(table_name) and action_type(action) are required' });
    }
    const result = await pool.query(
      `INSERT INTO history (module_name, action_type, record_id, title, description, changed_data, user_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        table_name, 
        action.toUpperCase(), 
        record_id ? String(record_id) : null,
        title || `${action} on ${table_name}`,
        description || `Visual/Action log for ${table_name}`,
        changed_data || {}, 
        performed_by || 'system'
      ]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('[AuditLog Route] create error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
