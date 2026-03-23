const pool = require('../config/db');
const { logHistory } = require('../utils/history');

const getAll = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM expenses WHERE is_deleted = false ORDER BY created_at DESC');
    res.json({ success: true, data: result.rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const create = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { expense_no, expense_date, category, description, amount, payment_mode, reference_no, status } = req.body;
    
    const result = await client.query(
      `INSERT INTO expenses (expense_no, expense_date, category, description, amount, payment_mode, reference_no, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [expense_no, expense_date, category, description, amount || 0, payment_mode, reference_no, status || 'Paid']
    );
    const record = result.rows[0];

    await logHistory({
      client,
      module_name: 'Accounts',
      action_type: 'CREATE',
      record_id: record.id,
      title: `Added Expense: ${record.expense_no}`,
      description: `New expense of ${record.amount} for ${record.category} added.`,
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
    const { expense_no, expense_date, category, description, amount, payment_mode, reference_no, status } = req.body;
    
    const result = await client.query(
      `UPDATE expenses SET expense_no=$1, expense_date=$2, category=$3, description=$4, amount=$5, payment_mode=$6, reference_no=$7, status=$8, updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [expense_no, expense_date, category, description, amount || 0, payment_mode, reference_no, status || 'Paid', req.params.id]
    );

    if (!result.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }

    const record = result.rows[0];

    await logHistory({
      client,
      module_name: 'Accounts',
      action_type: 'UPDATE',
      record_id: record.id,
      title: `Updated Expense: ${record.expense_no}`,
      description: `Expense details for ${record.expense_no} were modified.`,
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

    const check = await client.query('SELECT expense_no FROM expenses WHERE id = $1', [id]);
    if (!check.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }
    const expNo = check.rows[0].expense_no;

    await client.query('UPDATE expenses SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP WHERE id=$1', [id]);

    await logHistory({
      client,
      module_name: 'Accounts',
      action_type: 'DELETE',
      record_id: id,
      title: `Deleted Expense: ${expNo}`,
      description: `Expense ${expNo} was soft-deleted.`,
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

module.exports = { getAll, create, update, remove };
