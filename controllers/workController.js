const pool = require('../config/db');
const { logHistory } = require('../utils/history');

// WORK GROUPS
const getWorkGroups = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM work_groups ORDER BY created_at DESC');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[WorkGroup] getAll error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

const createWorkGroup = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { name, description, category, work_types, status } = req.body;
    if (!name) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Group name is required' });
    }
    const result = await client.query(
      `INSERT INTO work_groups (group_name, name, description, category, work_types, status) VALUES ($1,$1,$2,$3,$4,$5) RETURNING *`,
      [name, description || null, category || 'General', JSON.stringify(work_types || []), status || 'Active']
    );
    const record = result.rows[0];
    
    await logHistory({
      client,
      module_name: 'Masters',
      action_type: 'CREATE',
      record_id: record.id,
      title: `Created Work Group: ${name}`,
      description: `New work group ${name} added with ${work_types?.length || 0} work types.`,
      changed_data: record,
      user_name: 'admin'
    });

    await client.query('COMMIT');
    res.status(201).json({ success: true, message: 'Work group created successfully', data: record });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[WorkGroup] create error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};

const updateWorkGroup = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { name, description, category, work_types, status } = req.body;
    const result = await client.query(
      `UPDATE work_groups SET group_name=$1, name=$1, description=$2, category=$3, work_types=$4, status=$5, updated_at=CURRENT_TIMESTAMP WHERE id=$6 RETURNING *`,
      [name, description || null, category || 'General', JSON.stringify(work_types || []), status || 'Active', req.params.id]
    );
    if (!result.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Work group not found' });
    }
    const record = result.rows[0];
    
    await logHistory({
      client,
      module_name: 'Masters',
      action_type: 'UPDATE',
      record_id: record.id,
      title: `Updated Work Group: ${name}`,
      description: `Work group ${name} details were modified.`,
      changed_data: record,
      user_name: 'admin'
    });

    await client.query('COMMIT');
    res.json({ success: true, message: 'Work group updated successfully', data: record });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[WorkGroup] update error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};

const deleteWorkGroup = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    
    const check = await client.query('SELECT name FROM work_groups WHERE id=$1', [id]);
    if (!check.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Work group not found' });
    }
    const groupName = check.rows[0].name;

    await client.query('DELETE FROM work_groups WHERE id=$1', [id]);

    await logHistory({
      client,
      module_name: 'Masters',
      action_type: 'DELETE',
      record_id: id,
      title: `Deleted Work Group: ${groupName}`,
      description: `Work group ${groupName} was removed.`,
      changed_data: check.rows[0],
      user_name: 'admin'
    });

    await client.query('COMMIT');
    res.json({ success: true, message: 'Work group deleted successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[WorkGroup] delete error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};

// WORK TYPES
const getWorkTypes = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM work_types ORDER BY created_at DESC');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[WorkType] getAll error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

const createWorkType = async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, description, category, status, duration, avg_price } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, message: 'Work type name is required' });
    }

    await client.query('BEGIN');
    
    const result = await client.query(
      `INSERT INTO work_types (work_type_name, name, description, category, status, avg_duration, avg_price) 
       VALUES ($1, $1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, description || '', category || 'General', status || 'Active', duration || '', avg_price || 0]
    );
    const record = result.rows[0];

    await logHistory({
      client,
      module_name: 'Masters',
      action_type: 'CREATE',
      record_id: record.id,
      title: `Created Work Type: ${name}`,
      description: `New work type ${name} added with price ${avg_price}.`,
      changed_data: record,
      user_name: 'admin'
    });

    await client.query('COMMIT');
    res.status(201).json({ success: true, message: 'Work type created successfully', data: record });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[WorkType] create error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};

const updateWorkType = async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, description, category, status, duration, avg_price } = req.body;
    const { id } = req.params;

    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE work_types SET work_type_name=$1, name=$1, description=$2, category=$3, status=$4, avg_duration=$5, avg_price=$6, updated_at=CURRENT_TIMESTAMP 
       WHERE id=$7 RETURNING *`,
      [name, description || '', category || 'General', status || 'Active', duration || '', avg_price || 0, id]
    );

    if (!result.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Work type not found' });
    }
    const record = result.rows[0];

    await logHistory({
      client,
      module_name: 'Masters',
      action_type: 'UPDATE',
      record_id: id,
      title: `Updated Work Type: ${name}`,
      description: `Work type ${name} details were modified.`,
      changed_data: record,
      user_name: 'admin'
    });

    await client.query('COMMIT');
    res.json({ success: true, message: 'Work type updated successfully', data: record });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[WorkType] update error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};

const deleteWorkType = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    
    const check = await client.query('SELECT name FROM work_types WHERE id=$1', [id]);
    if (!check.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Work type not found' });
    }
    const typeName = check.rows[0].name;

    await client.query('DELETE FROM work_types WHERE id=$1', [id]);

    await logHistory({
      client,
      module_name: 'Masters',
      action_type: 'DELETE',
      record_id: id,
      title: `Deleted Work Type: ${typeName}`,
      description: `Work type ${typeName} was removed.`,
      changed_data: check.rows[0],
      user_name: 'admin'
    });

    await client.query('COMMIT');
    res.json({ success: true, message: 'Work type deleted successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[WorkType] delete error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};

module.exports = { getWorkGroups, createWorkGroup, updateWorkGroup, deleteWorkGroup, getWorkTypes, createWorkType, updateWorkType, deleteWorkType };
