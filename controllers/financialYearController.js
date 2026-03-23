const pool = require('../config/db');
const { logHistory } = require('../utils/history');

const getAll = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM financial_years ORDER BY created_at DESC');
    res.json({ success: true, data: result.rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const create = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { name, start_date, end_date, is_active, status } = req.body;
    
    if (is_active) {
      await client.query('UPDATE financial_years SET is_active = false');
    }

    const result = await client.query(
      `INSERT INTO financial_years (name, start_date, end_date, is_active, status) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [name, start_date, end_date, is_active || false, status || 'Active']
    );

    const record = result.rows[0];

    await logHistory({
      client,
      module_name: 'Settings',
      action_type: 'CREATE',
      record_id: record.id,
      title: `Created Financial Year: ${name}`,
      description: `New financial year ${name} added (Active: ${is_active}).`,
      changed_data: record,
      user_name: 'admin'
    });

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: record });
  } catch (err) { 
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: err.message }); 
  } finally {
    client.release();
  }
};

const setActive = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE financial_years SET is_active = false');
    const result = await client.query(
      'UPDATE financial_years SET is_active = true WHERE id = $1 RETURNING *',
      [req.params.id]
    );

    if (!result.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Financial year not found' });
    }

    const record = result.rows[0];

    await logHistory({
      client,
      module_name: 'Settings',
      action_type: 'UPDATE',
      record_id: record.id,
      title: `Activated Financial Year: ${record.name}`,
      description: `Financial year ${record.name} set as active year.`,
      changed_data: record,
      user_name: 'admin'
    });

    await client.query('COMMIT');
    res.json({ success: true, data: record });
  } catch (err) { 
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: err.message }); 
  } finally {
    client.release();
  }
};

const remove = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    
    const check = await client.query('SELECT name FROM financial_years WHERE id = $1', [id]);
    if (!check.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Financial year not found' });
    }
    const fyName = check.rows[0].name;

    await client.query('DELETE FROM financial_years WHERE id=$1', [id]);

    await logHistory({
      client,
      module_name: 'Settings',
      action_type: 'DELETE',
      record_id: id,
      title: `Deleted Financial Year: ${fyName}`,
      description: `Financial year ${fyName} was removed.`,
      changed_data: check.rows[0],
      user_name: 'admin'
    });

    await client.query('COMMIT');
    res.json({ success: true, message: 'Deleted' });
  } catch (err) { 
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: err.message }); 
  } finally {
    client.release();
  }
};

module.exports = { getAll, create, setActive, remove };
