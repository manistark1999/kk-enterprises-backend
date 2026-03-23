const pool = require('../config/db');
const { logHistory } = require('../utils/history');
const { getNextDocumentNumber } = require('../utils/documentNumbers');
const { toNumber } = require('../utils/entityResolvers');

const getAll = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM alignment_entries WHERE is_deleted = false ORDER BY created_at DESC');
    console.log(`[Alignment] Fetched ${result.rows.length} entries`);
    return res.status(200).json({ 
      success: true, 
      count: result.rows.length,
      data: result.rows 
    });
  } catch (err) {
    console.error('[Alignment] getAll error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

const create = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { date, vehicleNo, vehicleMake, customerName, alignmentType, technician, amount, notes, status } = req.body;

    const entry_no = await getNextDocumentNumber({
      db: pool,
      tableName: 'alignment_entries',
      columnName: 'entry_no',
      type: 'alignment',
      dateValue: date || new Date(),
    });

    const result = await client.query(
      `INSERT INTO alignment_entries (
        entry_no, entry_date, vehicle_no, vehicle_make, customer_name,
        alignment_type, technician, amount, notes, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        entry_no, date || new Date(), vehicleNo || 'UNKNOWN',
        vehicleMake || null, customerName || 'Walk-in', alignmentType || 'Front',
        technician || null, toNumber(amount, 0), notes || null, status || 'Completed'
      ]
    );

    const record = result.rows[0];
    await logHistory({
      client,
      module_name: 'Work',
      action_type: 'CREATE',
      record_id: record.id,
      title: `Added Alignment: ${record.entry_no}`,
      description: `New alignment for ${record.vehicle_no}.`,
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

const update = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const { date, vehicleNo, vehicleMake, customerName, alignmentType, technician, amount, notes, status } = req.body;

    const result = await client.query(
      `UPDATE alignment_entries SET 
        entry_date=$1, vehicle_no=$2, vehicle_make=$3, customer_name=$4, 
        alignment_type=$5, technician=$6, amount=$7, notes=$8, status=$9, updated_at=CURRENT_TIMESTAMP
       WHERE id=$10 RETURNING *`,
      [
        date, vehicleNo, vehicleMake || null, customerName || 'Walk-in',
        alignmentType || 'Front', technician || null, toNumber(amount, 0), notes || null, status || 'Completed', id
      ]
    );

    if (!result.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Not found' });
    }

    const record = result.rows[0];
    await logHistory({
      client,
      module_name: 'Work',
      action_type: 'UPDATE',
      record_id: record.id,
      title: `Updated Alignment: ${record.entry_no}`,
      description: `Alignment for ${record.vehicle_no} updated.`,
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

    const existing = await client.query('SELECT * FROM alignment_entries WHERE id=$1', [id]);
    if (!existing.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Not found' });
    }
    const record = existing.rows[0];

    await client.query('UPDATE alignment_entries SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
    
    await logHistory({
      client,
      module_name: 'Work',
      action_type: 'DELETE',
      record_id: id,
      title: `Deleted Alignment: ${record.entry_no}`,
      description: `Alignment for ${record.vehicle_no} was soft-deleted.`,
      changed_data: record,
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

const saveHistory = async (req, res) => {
  try {
    const { historyData } = req.body;
    
    await logHistory({
      module_name: 'AlignmentReport',
      action_type: 'SAVE',
      title: `Saved alignment register report - ${new Date().toLocaleDateString()}`,
      description: `User saved a snapshot of the alignment register containing ${historyData?.records?.length || 0} records.`,
      changed_data: historyData,
      user_name: 'admin'
    });

    res.status(200).json({ success: true, message: 'History saved to database' });
  } catch (err) {
    console.error('[Alignment] saveHistory error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getAll, create, update, remove, saveHistory };
