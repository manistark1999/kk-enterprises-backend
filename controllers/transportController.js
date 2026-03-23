const pool = require('../config/db');
const { logHistory } = require('../utils/history');

const getAll = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM transports ORDER BY created_at DESC');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[Transport] getAll error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

const getById = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM transports WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Transport not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const create = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { name, contact_person, phone, email, address, gst_no, status } = req.body;

    if (!name) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Transport name is required' });
    }

    const result = await client.query(
      `INSERT INTO transports (name, contact_person, phone, email, address, gst_no, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [name, contact_person || null, phone || null, email || null, address || null, gst_no || null, status || 'Active']
    );

    const record = result.rows[0];
    
    await logHistory({
      client,
      module_name: 'Masters',
      action_type: 'CREATE',
      record_id: record.id,
      title: `Added Transport: ${name}`,
      description: `New transport ${name} added.`,
      changed_data: record,
      user_name: 'admin'
    });
    
    await client.query('COMMIT');
    res.status(201).json({ success: true, message: 'Transport created successfully', data: record });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Transport] create error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};

const update = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { name, contact_person, phone, email, address, gst_no, status } = req.body;

    const result = await client.query(
      `UPDATE transports SET name=$1, contact_person=$2, phone=$3, email=$4, address=$5, gst_no=$6, status=$7, updated_at=CURRENT_TIMESTAMP
       WHERE id=$8 RETURNING *`,
      [name, contact_person || null, phone || null, email || null, address || null, gst_no || null, status || 'Active', req.params.id]
    );

    if (!result.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Transport not found' });
    }

    const record = result.rows[0];
    
    await logHistory({
      client,
      module_name: 'Masters',
      action_type: 'UPDATE',
      record_id: record.id,
      title: `Updated Transport: ${name}`,
      description: `Transport details for ${name} were modified.`,
      changed_data: record,
      user_name: 'admin'
    });

    await client.query('COMMIT');
    res.json({ success: true, message: 'Transport updated successfully', data: record });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Transport] update error:', err.message);
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
    
    const check = await client.query('SELECT name FROM transports WHERE id = $1', [id]);
    if (!check.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Transport not found' });
    }
    const transportName = check.rows[0].name;

    await client.query('DELETE FROM transports WHERE id = $1', [id]);

    await logHistory({
      client,
      module_name: 'Masters',
      action_type: 'DELETE',
      record_id: id,
      title: `Deleted Transport: ${transportName}`,
      description: `Transport ${transportName} was removed.`,
      changed_data: check.rows[0],
      user_name: 'admin'
    });

    await client.query('COMMIT');
    res.json({ success: true, message: 'Transport deleted successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Transport] delete error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};

module.exports = { getAll, getById, create, update, remove };
