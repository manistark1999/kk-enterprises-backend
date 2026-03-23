const pool = require('../config/db');
const { logHistory } = require('../utils/history');

const getAll = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM staff WHERE is_deleted = false ORDER BY created_at DESC');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[Staff] getAll error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

const getById = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM staff WHERE id = $1 AND is_deleted = false', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Staff not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const create = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { name, designation, mobile, email, salary, joining_date, address, bank_account, ifsc_code, status } = req.body;

    if (!name || !mobile) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Name and mobile are required' });
    }

    const result = await client.query(
      `INSERT INTO staff (name, designation, mobile, email, salary, joining_date, address, bank_account, ifsc_code, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [name, designation, mobile, email, salary || 0, joining_date || null, address, bank_account, ifsc_code, status || 'Active']
    );

    const record = result.rows[0];
    
    await logHistory({
      client,
      module_name: 'HR',
      action_type: 'CREATE',
      record_id: record.id,
      title: `Created Staff: ${record.name}`,
      description: `New staff member ${record.name} added to ${record.designation}.`,
      changed_data: record,
      user_name: 'admin'
    });

    await client.query('COMMIT');
    res.status(201).json({ success: true, message: 'Staff created successfully', data: record });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Staff] create error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};

const update = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const { name, designation, mobile, email, salary, joining_date, address, bank_account, ifsc_code, status } = req.body;

    const result = await client.query(
      `UPDATE staff SET name=$1, designation=$2, mobile=$3, email=$4, salary=$5, joining_date=$6,
       address=$7, bank_account=$8, ifsc_code=$9, status=$10, updated_at=CURRENT_TIMESTAMP
       WHERE id=$11 RETURNING *`,
      [name, designation, mobile, email, salary || 0, joining_date || null, address, bank_account, ifsc_code, status || 'Active', id]
    );

    if (!result.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Staff not found' });
    }

    const record = result.rows[0];
    
    await logHistory({
      client,
      module_name: 'HR',
      action_type: 'UPDATE',
      record_id: record.id,
      title: `Updated Staff: ${record.name}`,
      description: `Staff record for ${record.name} was updated.`,
      changed_data: record,
      user_name: 'admin'
    });

    await client.query('COMMIT');
    res.json({ success: true, message: 'Staff updated successfully', data: record });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Staff] update error:', err.message);
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
    
    const check = await client.query('SELECT name FROM staff WHERE id = $1', [id]);
    if (!check.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Staff not found' });
    }
    
    const staffName = check.rows[0].name;

    await client.query('UPDATE staff SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);

    await logHistory({
      client,
      module_name: 'HR',
      action_type: 'DELETE',
      record_id: id,
      title: `Deleted Staff: ${staffName}`,
      description: `Staff member ${staffName} was soft-deleted.`,
      changed_data: check.rows[0],
      user_name: 'admin'
    });

    await client.query('COMMIT');
    res.json({ success: true, message: 'Staff deleted successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Staff] delete error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};

module.exports = { getAll, getById, create, update, remove };
