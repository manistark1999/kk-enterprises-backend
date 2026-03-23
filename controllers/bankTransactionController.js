const pool = require('../config/db');
const { logHistory } = require('../utils/history');
const { toNumber } = require('../utils/entityResolvers');

const getAll = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM bank_transactions WHERE is_deleted = false ORDER BY transaction_date DESC, created_at DESC');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[BankTransaction] getAll error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

const create = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { 
      date, time, bank_account_id, bank_name, account_no, type, category, 
      description, amount, transaction_mode, reference_no, cheque_no, 
      received_from, paid_to 
    } = req.body;

    const result = await client.query(
      `INSERT INTO bank_transactions (
        transaction_date, transaction_time, bank_account_id, bank_name, account_no, 
        type, category, description, amount, transaction_mode, reference_no, 
        cheque_no, received_from, paid_to
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [
        date, time, bank_account_id || null, bank_name, account_no, 
        type, category, description, toNumber(amount, 0), transaction_mode, 
        reference_no, cheque_no, received_from, paid_to
      ]
    );

    const record = result.rows[0];
    
    await logHistory({
      client,
      module_name: 'Accounts',
      action_type: 'CREATE',
      record_id: record.id,
      title: `${type} Transaction: ${bank_name}`,
      description: `${type} of ${amount} in ${bank_name} (${account_no}).`,
      changed_data: record,
      user_name: 'admin'
    });

    await client.query('COMMIT');
    res.status(201).json({ success: true, message: 'Transaction saved', data: record });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[BankTransaction] create error:', err.message);
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
    
    const check = await client.query('SELECT bank_name, account_no, type, amount FROM bank_transactions WHERE id = $1', [id]);
    if (!check.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }
    const { bank_name, account_no, type, amount } = check.rows[0];

    await client.query('UPDATE bank_transactions SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP WHERE id=$1', [id]);
    
    await logHistory({
      client,
      module_name: 'Accounts',
      action_type: 'DELETE',
      record_id: id,
      title: `Deleted Transaction: ${bank_name}`,
      description: `${type} of ${amount} in ${bank_name} (${account_no}) was soft-deleted.`,
      changed_data: check.rows[0],
      user_name: 'admin'
    });

    await client.query('COMMIT');
    res.json({ success: true, message: 'Transaction deleted' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};

const getSummary = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        SUM(CASE WHEN type='Credit' THEN amount ELSE 0 END) as total_credit,
        SUM(CASE WHEN type='Debit' THEN amount ELSE 0 END) as total_debit
      FROM bank_transactions 
      WHERE is_deleted = false
    `);
    const { total_credit, total_debit } = result.rows[0];
    res.json({ 
      success: true, 
      data: {
        totalCredit: Number(total_credit || 0),
        totalDebit: Number(total_debit || 0),
        balance: Number((total_credit || 0) - (total_debit || 0))
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getAll, create, remove, getSummary };
