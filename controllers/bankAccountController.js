const pool = require('../config/db');
const { logHistory } = require('../utils/history');

const getAll = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM bank_accounts WHERE is_deleted = false ORDER BY created_at DESC');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[BankAccount] getAll error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

const create = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { 
      account_name, bank_name, account_number, account_holder_name, 
      ifsc_code, branch_name, account_type, opening_balance, current_balance, status 
    } = req.body;
    
    if (!account_number || !bank_name) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Bank name and account number are required' });
    }

    const holderName = account_holder_name || account_name;
    const accName = account_name || bank_name;

    const result = await client.query(
      `INSERT INTO bank_accounts (
        account_name, bank_name, account_number, account_holder_name, 
        ifsc_code, branch_name, account_type, opening_balance, current_balance, status
      )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        accName, bank_name, account_number, holderName, ifsc_code, branch_name, 
        account_type || 'Current', opening_balance || 0, current_balance || opening_balance || 0, status || 'Active'
      ]
    );

    const record = result.rows[0];
    
    await logHistory({
      client,
      module_name: 'Masters',
      action_type: 'CREATE',
      record_id: record.id,
      title: `Added Bank Account: ${record.bank_name}`,
      description: `New account ${record.account_number} at ${record.bank_name} added.`,
      changed_data: record,
      user_name: 'admin'
    });

    await client.query('COMMIT');
    res.status(201).json({ success: true, message: 'Bank account added successfully', data: record });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[BankAccount] create error:', err.message);
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
      account_name, bank_name, account_number, account_holder_name, 
      ifsc_code, branch_name, account_type, opening_balance, current_balance, status 
    } = req.body;
    
    const result = await client.query(
      `UPDATE bank_accounts SET 
        account_name=$1, bank_name=$2, account_number=$3, account_holder_name=$4, 
        ifsc_code=$5, branch_name=$6, account_type=$7, opening_balance=$8, 
        current_balance=$9, status=$10, updated_at=CURRENT_TIMESTAMP
       WHERE id=$11 RETURNING *`,
      [
        account_name, bank_name, account_number, account_holder_name, 
        ifsc_code, branch_name, account_type, opening_balance || 0, 
        current_balance || 0, status || 'Active', id
      ]
    );

    if (!result.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Bank account not found' });
    }

    const record = result.rows[0];

    await logHistory({
      client,
      module_name: 'Masters',
      action_type: 'UPDATE',
      record_id: record.id,
      title: `Updated Bank Account: ${record.bank_name}`,
      description: `Bank account details for ${record.account_number} were modified.`,
      changed_data: record,
      user_name: 'admin'
    });

    await client.query('COMMIT');
    res.json({ success: true, message: 'Bank account updated successfully', data: record });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[BankAccount] update error:', err.message);
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
    
    const check = await client.query('SELECT bank_name, account_number FROM bank_accounts WHERE id = $1', [id]);
    if (!check.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Bank account not found' });
    }
    const { bank_name, account_number } = check.rows[0];

    await client.query('UPDATE bank_accounts SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP WHERE id=$1', [id]);
    
    await logHistory({
      client,
      module_name: 'Masters',
      action_type: 'DELETE',
      record_id: id,
      title: `Deleted Bank Account: ${bank_name}`,
      description: `Account ${account_number} at ${bank_name} was soft-deleted.`,
      changed_data: check.rows[0],
      user_name: 'admin'
    });

    await client.query('COMMIT');
    res.json({ success: true, message: 'Bank account deleted successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[BankAccount] remove error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};

module.exports = { getAll, create, update, remove };
