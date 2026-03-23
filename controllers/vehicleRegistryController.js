const pool = require('../config/db');
const { logHistory } = require('../utils/history');
const { resolveCustomer, toInteger } = require('../utils/entityResolvers');

const getAll = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM vehicle_register ORDER BY created_at DESC');
    res.json({ success: true, data: result.rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const create = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { 
      customer_id, vehicle_number, owner_name, mobile, vehicle_make, model, 
      fuel_type, chassis_number, engine_number, color, year, 
      status, notes 
    } = req.body;

    if (!vehicle_number) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Vehicle number is required' });
    }

    const resolvedCustomer = await resolveCustomer(client, {
      customerId: customer_id,
      customerName: owner_name,
      customerPhone: mobile
    });

    const result = await client.query(
      `INSERT INTO vehicle_register (
        customer_id, vehicle_number, owner_name, mobile, vehicle_make, model, 
        fuel_type, chassis_number, engine_number, color, year, 
        status, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [
        resolvedCustomer?.id || toInteger(customer_id), vehicle_number, resolvedCustomer?.customer_name || owner_name, resolvedCustomer?.phone || mobile, vehicle_make, model, 
        fuel_type, chassis_number, engine_number, color, year, 
        status || 'Active', notes
      ]
    );
    
    const record = result.rows[0];
    
    await logHistory({
      client,
      module_name: 'Vehicle Registry',
      action_type: 'CREATE',
      record_id: record.id,
      title: `Registered Vehicle: ${vehicle_number}`,
      description: `New vehicle ${vehicle_number} registered for ${record.owner_name}.`,
      changed_data: record,
      user_name: 'admin'
    });

    await client.query('COMMIT');
    res.status(201).json({ success: true, message: 'Vehicle registered successfully', data: record });
  } catch (err) { 
    await client.query('ROLLBACK');
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
    const { 
      customer_id, vehicle_number, owner_name, mobile, vehicle_make, model, 
      fuel_type, chassis_number, engine_number, color, year, 
      status, notes 
    } = req.body;

    const resolvedCustomer = await resolveCustomer(client, {
      customerId: customer_id,
      customerName: owner_name,
      customerPhone: mobile
    });

    const result = await client.query(
      `UPDATE vehicle_register SET 
        customer_id=$1, vehicle_number=$2, owner_name=$3, mobile=$4, vehicle_make=$5, model=$6, 
        fuel_type=$7, chassis_number=$8, engine_number=$9, color=$10, year=$11, 
        status=$12, notes=$13, updated_at=CURRENT_TIMESTAMP
       WHERE id=$14 RETURNING *`,
      [
        resolvedCustomer?.id || toInteger(customer_id), vehicle_number, resolvedCustomer?.customer_name || owner_name, resolvedCustomer?.phone || mobile, vehicle_make, model, 
        fuel_type, chassis_number, engine_number, color, year, 
        status || 'Active', notes, id
      ]
    );

    if (!result.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Vehicle not found' });
    }

    const record = result.rows[0];
    
    await logHistory({
      client,
      module_name: 'Vehicle Registry',
      action_type: 'UPDATE',
      record_id: record.id,
      title: `Updated Vehicle: ${vehicle_number}`,
      description: `Registration details for ${vehicle_number} were modified.`,
      changed_data: record,
      user_name: 'admin'
    });

    await client.query('COMMIT');
    res.json({ success: true, message: 'Vehicle updated successfully', data: record });
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
    
    const check = await client.query('SELECT vehicle_number FROM vehicle_register WHERE id = $1', [id]);
    if (!check.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Vehicle not found' });
    }
    const vehicleNumber = check.rows[0].vehicle_number;

    await client.query('DELETE FROM vehicle_register WHERE id=$1', [id]);
    
    await logHistory({
      client,
      module_name: 'Vehicle Registry',
      action_type: 'DELETE',
      record_id: id,
      title: `Deleted Vehicle: ${vehicleNumber}`,
      description: `Vehicle registration ${vehicleNumber} was removed.`,
      changed_data: check.rows[0],
      user_name: 'admin'
    });

    await client.query('COMMIT');
    res.json({ success: true, message: 'Vehicle deleted successfully' });
  } catch (err) { 
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: err.message }); 
  } finally {
    client.release();
  }
};

module.exports = { getAll, create, update, remove };
