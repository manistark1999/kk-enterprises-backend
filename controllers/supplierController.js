const pool = require('../config/db');
const { logHistory } = require('../utils/history');

const getAll = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM suppliers WHERE is_deleted = false ORDER BY created_at DESC');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[Supplier] getAll error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

const getById = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM suppliers WHERE id = $1 AND is_deleted = false', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Supplier not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const create = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { name, contact_person, category, company, mobile, email, gst_number, address, city, state, pincode, credit_limit, credit_days, bank_account, ifsc_code, status } = req.body;

    if (!name) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Supplier name is required' });
    }

    const result = await client.query(
      `INSERT INTO suppliers (name, contact_person, category, company, mobile, email, gst_number, address, city, state, pincode, credit_limit, credit_days, bank_account, ifsc_code, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [name, contact_person, category, company, mobile, email, gst_number, address, city, state, pincode, credit_limit || 0, credit_days || 0, bank_account, ifsc_code, status || 'Active']
    );

    const record = result.rows[0];
    
    await logHistory({
      client,
      module_name: 'Masters',
      action_type: 'CREATE',
      record_id: record.id,
      title: `Created Supplier: ${record.name}`,
      description: `New supplier ${record.name} added to master.`,
      changed_data: record,
      user_name: 'admin'
    });

    await client.query('COMMIT');
    res.status(201).json({ success: true, message: 'Supplier created successfully', data: record });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Supplier] create error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};

const update = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { name, contact_person, category, company, mobile, email, gst_number, address, city, state, pincode, credit_limit, credit_days, bank_account, ifsc_code, status } = req.body;

    const result = await client.query(
      `UPDATE suppliers SET name=$1, contact_person=$2, category=$3, company=$4, mobile=$5, email=$6,
       gst_number=$7, address=$8, city=$9, state=$10, pincode=$11, credit_limit=$12, credit_days=$13,
       bank_account=$14, ifsc_code=$15, status=$16, updated_at=CURRENT_TIMESTAMP
       WHERE id=$17 RETURNING *`,
      [name, contact_person, category, company, mobile, email, gst_number, address, city, state, pincode, credit_limit || 0, credit_days || 0, bank_account, ifsc_code, status || 'Active', req.params.id]
    );

    if (!result.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    const record = result.rows[0];
    
    await logHistory({
      client,
      module_name: 'Masters',
      action_type: 'UPDATE',
      record_id: record.id,
      title: `Updated Supplier: ${record.name}`,
      description: `Supplier details for ${record.name} were modified.`,
      changed_data: record,
      user_name: 'admin'
    });

    await client.query('COMMIT');
    res.json({ success: true, message: 'Supplier updated successfully', data: record });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Supplier] update error:', err.message);
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
    
    const check = await client.query('SELECT name FROM suppliers WHERE id = $1', [id]);
    if (!check.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }
    
    const supplierName = check.rows[0].name;

    await client.query('UPDATE suppliers SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);

    await logHistory({
      client,
      module_name: 'Masters',
      action_type: 'DELETE',
      record_id: id,
      title: `Deleted Supplier: ${supplierName}`,
      description: `Supplier ${supplierName} was soft-deleted.`,
      changed_data: check.rows[0],
      user_name: 'admin'
    });

    await client.query('COMMIT');
    res.json({ success: true, message: 'Supplier deleted successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Supplier] delete error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};

module.exports = { getAll, getById, create, update, remove };
