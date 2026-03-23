const pool = require("../config/db");
const { logHistory } = require("../utils/history");
const { getNextDocumentNumber } = require("../utils/documentNumbers");
const {
  adjustBankBalance,
  resolveBankAccount,
  resolveCustomer,
  resolveJobcard,
  resolveLabourBill,
  toInteger,
} = require("../utils/entityResolvers");

const getNextPaymentNo = async (req, res) => {
  try {
    const nextNumber = await getNextDocumentNumber({
      db: pool,
      tableName: "payments",
      columnName: "payment_no",
      type: "payment",
      dateValue: req.query.date || new Date(),
    });

    res.json({ success: true, data: nextNumber });
  } catch (error) {
    console.error("[Payment] getNextNo error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

const createPayment = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const {
      payment_date,
      customer_id,
      customer_name,
      jobcard_id,
      jobcard_no,
      bill_id,
      bill_no,
      payment_type,
      payment_mode,
      bank_account_id,
      bank_account_name,
      reference_no,
      amount,
      remarks,
      status,
      created_by,
    } = req.body;

    let payment_no = req.body.payment_no;
    if (!payment_no) {
      payment_no = await getNextDocumentNumber({
        db: client,
        tableName: "payments",
        columnName: "payment_no",
        type: "payment",
        dateValue: payment_date,
      });
    }

    if (!amount || Number(amount) <= 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "amount is required" });
    }

    const existing = await client.query(
      "SELECT id FROM payments WHERE payment_no = $1 LIMIT 1",
      [payment_no]
    );
    if (existing.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: `Payment ${payment_no} already exists`,
      });
    }

    const resolvedCustomer = await resolveCustomer(client, {
      customerId: customer_id,
      customerName: customer_name,
    });
    const resolvedJobcard = await resolveJobcard(client, { jobcardId: jobcard_id, jobcardNo: jobcard_no });
    const resolvedBill = await resolveLabourBill(client, { billId: bill_id, billNo: bill_no });
    const resolvedBankAccount = await resolveBankAccount(client, {
      bankAccountId: bank_account_id,
      bankAccountName: bank_account_name,
    });

    const result = await client.query(
      `INSERT INTO payments (
        payment_no, payment_date, customer_id, customer_name, jobcard_id, jobcard_no,
        bill_id, bill_no, payment_type, payment_mode, bank_account_id, bank_account_name,
        reference_no, amount, remarks, status, created_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      RETURNING *`,
      [
        payment_no,
        payment_date || new Date(),
        resolvedCustomer?.id || toInteger(customer_id),
        resolvedCustomer?.customer_name || customer_name || null,
        resolvedJobcard?.id || toInteger(jobcard_id),
        resolvedJobcard?.jobcard_no || jobcard_no || null,
        resolvedBill?.id || toInteger(bill_id),
        resolvedBill?.bill_no || bill_no || null,
        payment_type || null,
        payment_mode || "Cash",
        resolvedBankAccount?.id || toInteger(bank_account_id),
        resolvedBankAccount?.account_name || resolvedBankAccount?.bank_name || bank_account_name || null,
        reference_no || null,
        amount || 0,
        remarks || null,
        status || "Completed",
        created_by || "Admin",
      ]
    );

    const record = result.rows[0];
    if (record.bank_account_id) {
      await adjustBankBalance(client, record.bank_account_id, -Number(record.amount || 0));
    }

    await logHistory({
      client,
      module_name: 'Accounts',
      action_type: 'CREATE',
      record_id: record.id,
      title: `Created Payment: ${record.payment_no}`,
      description: `Payment of ${record.amount} for ${record.customer_name}.`,
      user_name: 'admin'
    });
    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      message: "Payment created successfully",
      data: record,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[Payment] create error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
};

const getAllPayments = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM payments WHERE is_deleted = false ORDER BY id DESC");
    console.log(`[Payment] Fetching all payments. Found: ${result.rows.length}`);
    return res.status(200).json({ 
      success: true, 
      count: result.rows.length,
      data: result.rows 
    });
  } catch (error) {
    console.error("[Payment] getAll error:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const updatePayment = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existingResult = await client.query(
      "SELECT * FROM payments WHERE id = $1 LIMIT 1",
      [req.params.id]
    );
    if (!existingResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Payment not found" });
    }

    const existingRecord = existingResult.rows[0];
    const {
      payment_no,
      payment_date,
      customer_id,
      customer_name,
      jobcard_id,
      jobcard_no,
      bill_id,
      bill_no,
      payment_type,
      payment_mode,
      bank_account_id,
      bank_account_name,
      reference_no,
      amount,
      remarks,
      status,
    } = req.body;

    const resolvedCustomer = await resolveCustomer(client, {
      customerId: customer_id,
      customerName: customer_name,
    });
    const resolvedJobcard = await resolveJobcard(client, { jobcardId: jobcard_id, jobcardNo: jobcard_no });
    const resolvedBill = await resolveLabourBill(client, { billId: bill_id, billNo: bill_no });
    const resolvedBankAccount = await resolveBankAccount(client, {
      bankAccountId: bank_account_id,
      bankAccountName: bank_account_name,
    });

    if (existingRecord.bank_account_id) {
      await adjustBankBalance(
        client,
        existingRecord.bank_account_id,
        Number(existingRecord.amount || 0)
      );
    }

    const result = await client.query(
      `UPDATE payments SET
         payment_no=$1,
         payment_date=$2,
         customer_id=$3,
         customer_name=$4,
         jobcard_id=$5,
         jobcard_no=$6,
         bill_id=$7,
         bill_no=$8,
         payment_type=$9,
         payment_mode=$10,
         bank_account_id=$11,
         bank_account_name=$12,
         reference_no=$13,
         amount=$14,
         remarks=$15,
         status=$16,
         updated_at=CURRENT_TIMESTAMP
       WHERE id=$17
       RETURNING *`,
      [
        payment_no || existingRecord.payment_no,
        payment_date || existingRecord.payment_date,
        resolvedCustomer?.id || toInteger(customer_id) || existingRecord.customer_id,
        resolvedCustomer?.customer_name || customer_name || existingRecord.customer_name,
        resolvedJobcard?.id || toInteger(jobcard_id) || existingRecord.jobcard_id,
        resolvedJobcard?.jobcard_no || jobcard_no || existingRecord.jobcard_no,
        resolvedBill?.id || toInteger(bill_id) || existingRecord.bill_id,
        resolvedBill?.bill_no || bill_no || existingRecord.bill_no,
        payment_type || existingRecord.payment_type,
        payment_mode || existingRecord.payment_mode,
        resolvedBankAccount?.id || toInteger(bank_account_id) || existingRecord.bank_account_id,
        resolvedBankAccount?.account_name || resolvedBankAccount?.bank_name || bank_account_name || existingRecord.bank_account_name,
        reference_no || existingRecord.reference_no,
        amount ?? existingRecord.amount,
        remarks ?? existingRecord.remarks,
        status || existingRecord.status,
        req.params.id,
      ]
    );

    const record = result.rows[0];
    if (record.bank_account_id) {
      await adjustBankBalance(client, record.bank_account_id, -Number(record.amount || 0));
    }

    await logHistory({
      client,
      module_name: 'Accounts',
      action_type: 'UPDATE',
      record_id: record.id,
      title: `Updated Payment: ${record.payment_no}`,
      description: `Payment details for ${record.payment_no} modified.`,
      user_name: 'admin'
    });
    await client.query("COMMIT");

    res.json({ success: true, message: "Payment updated successfully", data: record });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[Payment] update error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
};

const deletePayment = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      "UPDATE payments SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *",
      [req.params.id]
    );
    if (!result.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Payment not found" });
    }

    const deletedRecord = result.rows[0];
    if (deletedRecord.bank_account_id) {
      await adjustBankBalance(
        client,
        deletedRecord.bank_account_id,
        Number(deletedRecord.amount || 0)
      );
    }

    await logHistory({
      client,
      module_name: 'Accounts',
      action_type: 'DELETE',
      record_id: req.params.id,
      title: `Deleted Payment: ${deletedRecord.payment_no}`,
      description: `Payment ${deletedRecord.payment_no} soft-deleted. Bank balance restored.`,
      changed_data: deletedRecord,
      user_name: 'admin'
    });
    await client.query("COMMIT");

    res.json({ success: true, message: "Payment deleted successfully" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[Payment] delete error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
};

module.exports = {
  createPayment,
  getAllPayments,
  updatePayment,
  deletePayment,
  getNextPaymentNo,
};
