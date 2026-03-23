const pool = require('../config/db');
const { logHistory } = require('../utils/history');

// SALARY RECORDS
const getAllSalaries = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM salary_records ORDER BY created_at DESC');
    res.json({ success: true, data: result.rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const createSalary = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { salary_no, staff_id, staff_name, month, year, basic_salary, allowances, deductions, net_salary, payment_mode, payment_date, status } = req.body;
    const result = await client.query(
      `INSERT INTO salary_records (salary_no, staff_id, staff_name, month, year, basic_salary, allowances, deductions, net_salary, payment_mode, payment_date, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [salary_no, staff_id, staff_name, month, year, basic_salary || 0, allowances || 0, deductions || 0, net_salary || 0, payment_mode, payment_date, status || 'Paid']
    );
    const record = result.rows[0];
    await logHistory({
      client,
      module_name: 'HR',
      action_type: 'CREATE',
      record_id: record.id,
      title: `Created Salary Record: ${record.salary_no}`,
      description: `Salary for ${record.staff_name} for ${record.month}/${record.year} recorded.`,
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

const updateSalary = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { salary_no, staff_id, staff_name, month, year, basic_salary, allowances, deductions, net_salary, payment_mode, payment_date, status } = req.body;
    const result = await client.query(
      `UPDATE salary_records SET salary_no=$1, staff_id=$2, staff_name=$3, month=$4, year=$5, basic_salary=$6, allowances=$7, deductions=$8, net_salary=$9, payment_mode=$10, payment_date=$11, status=$12, updated_at=NOW()
       WHERE id=$13 RETURNING *`,
      [salary_no, staff_id, staff_name, month, year, basic_salary || 0, allowances || 0, deductions || 0, net_salary || 0, payment_mode, payment_date, status || 'Paid', req.params.id]
    );
    if (!result.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: "Record not found" });
    }
    const record = result.rows[0];
    await logHistory({
      client,
      module_name: 'HR',
      action_type: 'UPDATE',
      record_id: record.id,
      title: `Updated Salary: ${record.salary_no}`,
      description: `Salary record for ${record.staff_name} (${record.month}/${record.year}) updated.`,
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

const deleteSalary = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query('DELETE FROM salary_records WHERE id=$1 RETURNING *', [req.params.id]);
    if (!result.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: "Record not found" });
    }
    const record = result.rows[0];
    await logHistory({
      client,
      module_name: 'HR',
      action_type: 'DELETE',
      record_id: req.params.id,
      title: `Deleted Salary Record: ${record.salary_no}`,
      description: `Salary record for ${record.staff_name} removed.`,
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

// STAFF ADVANCES
const getAllAdvances = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM staff_advances ORDER BY created_at DESC');
    res.json({ success: true, data: result.rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const createAdvance = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { advance_no, staff_id, staff_name, advance_date, amount, reason, repayment_type, repayment_amount, status } = req.body;
    const result = await client.query(
      `INSERT INTO staff_advances (advance_no, staff_id, staff_name, advance_date, amount, reason, repayment_type, repayment_amount, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [advance_no, staff_id, staff_name, advance_date, amount || 0, reason, repayment_type, repayment_amount || 0, status || 'Active']
    );
    const record = result.rows[0];
    await logHistory({
      client,
      module_name: 'HR',
      action_type: 'CREATE',
      record_id: record.id,
      title: `Created Advance: ${record.advance_no}`,
      description: `Advance of ${record.amount} for ${record.staff_name} recorded.`,
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

const deleteAdvance = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query('DELETE FROM staff_advances WHERE id=$1 RETURNING *', [req.params.id]);
    if (!result.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: "Record not found" });
    }
    const record = result.rows[0];
    await logHistory({
      client,
      module_name: 'HR',
      action_type: 'DELETE',
      record_id: req.params.id,
      title: `Deleted Advance: ${record.advance_no}`,
      description: `Advance for ${record.staff_name} removed.`,
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

module.exports = { getAllSalaries, createSalary, updateSalary, deleteSalary, getAllAdvances, createAdvance, deleteAdvance };
