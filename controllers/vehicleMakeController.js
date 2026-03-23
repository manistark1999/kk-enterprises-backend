const pool = require('../config/db');
const { logHistory } = require('../utils/history');

const getAll = async (req, res) => {
  try {
    const query = `
      SELECT vm.*, 
             COALESCE(JSON_AGG(mo.model_name) FILTER (WHERE mo.model_name IS NOT NULL), '[]') as models
      FROM vehicle_makes vm
      LEFT JOIN vehicle_models mo ON vm.id = mo.make_id
      GROUP BY vm.id
      ORDER BY vm.created_at DESC
    `;
    const result = await pool.query(query);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[VehicleMake] getAll error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

const create = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { name, models, country, status } = req.body;

    if (!name || name.trim() === '') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Make name is required' });
    }

    // 1. Insert Make
    const makeResult = await client.query(
      `INSERT INTO vehicle_makes (name, make_name, country, status)
       VALUES ($1, $1, $2, $3) RETURNING *`,
      [name.trim(), country || null, status || 'Active']
    );

    const makeRecord = makeResult.rows[0];

    // 2. Insert Models
    if (models && Array.isArray(models) && models.length > 0) {
      for (const modelName of models) {
        if (modelName.trim()) {
          await client.query(
            'INSERT INTO vehicle_models (make_id, model_name) VALUES ($1, $2)',
            [makeRecord.id, modelName.trim()]
          );
        }
      }
    }

    // 3. History
    await logHistory({
      client,
      module_name: 'Masters',
      action_type: 'CREATE',
      record_id: makeRecord.id,
      title: `Created Vehicle Make: ${name}`,
      description: `Added vehicle make ${name} with ${models?.length || 0} models.`,
      changed_data: makeRecord,
      user_name: 'admin'
    });

    await client.query('COMMIT');
    res.status(201).json({ success: true, message: 'Vehicle make created successfully', data: makeRecord });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[VehicleMake] create error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};

const update = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { name, models, country, status } = req.body;

    if (!name || name.trim() === '') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Make name is required' });
    }

    // 1. Update Make
    const result = await client.query(
      `UPDATE vehicle_makes SET name=$1, make_name=$1, country=$2, status=$3, updated_at=CURRENT_TIMESTAMP
       WHERE id=$4 RETURNING *`,
      [name.trim(), country || null, status || 'Active', req.params.id]
    );

    if (!result.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Vehicle make not found' });
    }

    const record = result.rows[0];

    // 2. Sync Models
    await client.query('DELETE FROM vehicle_models WHERE make_id = $1', [req.params.id]);
    if (models && Array.isArray(models) && models.length > 0) {
      for (const modelName of models) {
        if (modelName.trim()) {
          await client.query(
            'INSERT INTO vehicle_models (make_id, model_name) VALUES ($1, $2)',
            [record.id, modelName.trim()]
          );
        }
      }
    }
    
    // 3. History
    await logHistory({
      client,
      module_name: 'Masters',
      action_type: 'UPDATE',
      record_id: record.id,
      title: `Updated Vehicle Make: ${name}`,
      description: `Vehicle make ${name} and its models were updated.`,
      changed_data: record,
      user_name: 'admin'
    });

    await client.query('COMMIT');
    res.json({ success: true, message: 'Vehicle make updated successfully', data: record });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[VehicleMake] update error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};

const remove = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const check = await client.query('SELECT name FROM vehicle_makes WHERE id = $1', [req.params.id]);
    if (!check.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Vehicle make not found' });
    }
    const makeName = check.rows[0].name;

    await client.query('DELETE FROM vehicle_models WHERE make_id = $1', [req.params.id]);
    await client.query('DELETE FROM vehicle_makes WHERE id = $1', [req.params.id]);

    await logHistory({
      client,
      module_name: 'Masters',
      action_type: 'DELETE',
      record_id: req.params.id,
      title: `Deleted Vehicle Make: ${makeName}`,
      description: `Vehicle make ${makeName} and associated models removed.`,
      changed_data: check.rows[0],
      user_name: 'admin'
    });

    await client.query('COMMIT');
    res.json({ success: true, message: 'Vehicle make deleted successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[VehicleMake] delete error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};

module.exports = { getAll, create, update, remove };
