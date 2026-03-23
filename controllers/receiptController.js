const pool = require("../config/db");
const { logHistory } = require('../utils/history');
const { getNextDocumentNumber } = require("../utils/documentNumbers");
const {
  adjustBankBalance,
  resolveBankAccount,
  resolveCustomer,
  resolveJobcard,
  resolveLabourBill,
  toInteger,
} = require("../utils/entityResolvers");

const getNextReceiptNo = async (req, res) => {
  try {
    const nextNumber = await getNextDocumentNumber({
      db: pool,
      tableName: "receipts",
      columnName: "receipt_no",
      type: "receipt",
      dateValue: req.query.date || new Date(),
    });

    res.json({ success: true, data: nextNumber });
  } catch (error) {
    console.error("[Receipt] getNextNo error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

const createReceipt = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const {
      receipt_no_generated,
      receipt_date,
      customer_id,
      customer_name,
      customer_phone,
      labour_bill_id,
      labour_bill_no,
      jobcard_id,
      jobcard_no,
      description,
      amount,
      payment_mode,
      bank_id,
      bank_account_id,
      bank_name,
      reference_no,
      status,
    } = req.body;

    let receipt_no = req.body.receipt_no || receipt_no_generated;
    if (!receipt_no) {
      receipt_no = await getNextDocumentNumber({
        db: client,
        tableName: "receipts",
        columnName: "receipt_no",
        type: "receipt",
        dateValue: receipt_date,
      });
    }

    if (!receipt_date || !amount || Number(amount) <= 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "receipt_date and amount are required",
      });
    }

    const duplicate = await client.query(
      "SELECT id FROM receipts WHERE receipt_no = $1 LIMIT 1",
      [receipt_no]
    );
    if (duplicate.rows.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: `Receipt ${receipt_no} already exists`,
      });
    }

    const resolvedCustomer = await resolveCustomer(client, {
      customerId: customer_id,
      customerName: customer_name,
      customerPhone: customer_phone,
    });
    const resolvedJobcard = await resolveJobcard(client, { jobcardId: jobcard_id, jobcardNo: jobcard_no });
    const resolvedBill = await resolveLabourBill(client, {
      labourBillId: labour_bill_id,
      labourBillNo: labour_bill_no,
    });
    const resolvedBankAccount = await resolveBankAccount(client, {
      bankId: bank_id || bank_account_id,
      bankName: bank_name,
    });

    const result = await client.query(
      `INSERT INTO receipts (
        receipt_no, receipt_date, customer_id, customer_name, customer_phone,
        labour_bill_id, labour_bill_no, jobcard_id, jobcard_no, description,
        amount, payment_mode, bank_id, bank_name, reference_no, status
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING *`,
      [
        receipt_no,
        receipt_date,
        resolvedCustomer?.id || toInteger(customer_id),
        resolvedCustomer?.customer_name || customer_name || null,
        resolvedCustomer?.phone || customer_phone || null,
        resolvedBill?.id || toInteger(labour_bill_id),
        resolvedBill?.bill_no || labour_bill_no || null,
        resolvedJobcard?.id || toInteger(jobcard_id),
        resolvedJobcard?.jobcard_no || jobcard_no || null,
        description || null,
        amount,
        payment_mode || "Cash",
        resolvedBankAccount?.id || toInteger(bank_id || bank_account_id),
        resolvedBankAccount?.bank_name || resolvedBankAccount?.account_name || bank_name || null,
        reference_no || null,
        status || "Received",
      ]
    );

    const record = result.rows[0];
    if (record.bank_id) {
      await adjustBankBalance(client, record.bank_id, Number(record.amount || 0));
    }

    await logHistory({
      client,
      module_name: 'Accounts',
      action_type: 'CREATE',
      record_id: record.id,
      title: `Created Receipt: ${record.receipt_no}`,
      description: `Receipt of ${record.amount} received from ${record.customer_name}.`,
      user_name: 'admin'
    });
    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      message: "Receipt created successfully",
      data: record,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[Receipt] create error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
};

const getAllReceipts = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM receipts WHERE is_deleted = false ORDER BY id DESC");
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error("[Receipt] getAll error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateReceipt = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existingResult = await client.query(
      "SELECT * FROM receipts WHERE id = $1 LIMIT 1",
      [req.params.id]
    );
    if (!existingResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Receipt not found" });
    }

    const existingRecord = existingResult.rows[0];
    const {
      receipt_no,
      receipt_date,
      customer_id,
      customer_name,
      customer_phone,
      labour_bill_id,
      labour_bill_no,
      jobcard_id,
      jobcard_no,
      description,
      amount,
      payment_mode,
      bank_id,
      bank_account_id,
      bank_name,
      reference_no,
      status,
    } = req.body;

    const resolvedCustomer = await resolveCustomer(client, {
      customerId: customer_id,
      customerName: customer_name,
      customerPhone: customer_phone,
    });
    const resolvedJobcard = await resolveJobcard(client, { jobcardId: jobcard_id, jobcardNo: jobcard_no });
    const resolvedBill = await resolveLabourBill(client, {
      labourBillId: labour_bill_id,
      labourBillNo: labour_bill_no,
    });
    const resolvedBankAccount = await resolveBankAccount(client, {
      bankId: bank_id || bank_account_id,
      bankName: bank_name,
    });

    if (existingRecord.bank_id) {
      await adjustBankBalance(client, existingRecord.bank_id, -Number(existingRecord.amount || 0));
    }

    const result = await client.query(
      `UPDATE receipts SET
         receipt_no=$1,
         receipt_date=$2,
         customer_id=$3,
         customer_name=$4,
         customer_phone=$5,
         labour_bill_id=$6,
         labour_bill_no=$7,
         jobcard_id=$8,
         jobcard_no=$9,
         description=$10,
         amount=$11,
         payment_mode=$12,
         bank_id=$13,
         bank_name=$14,
         reference_no=$15,
         status=$16,
         updated_at=CURRENT_TIMESTAMP
       WHERE id=$17
       RETURNING *`,
      [
        receipt_no || existingRecord.receipt_no,
        receipt_date || existingRecord.receipt_date,
        resolvedCustomer?.id || toInteger(customer_id) || existingRecord.customer_id,
        resolvedCustomer?.customer_name || customer_name || existingRecord.customer_name,
        resolvedCustomer?.phone || customer_phone || existingRecord.customer_phone,
        resolvedBill?.id || toInteger(labour_bill_id) || existingRecord.labour_bill_id,
        resolvedBill?.bill_no || labour_bill_no || existingRecord.labour_bill_no,
        resolvedJobcard?.id || toInteger(jobcard_id) || existingRecord.jobcard_id,
        resolvedJobcard?.jobcard_no || jobcard_no || existingRecord.jobcard_no,
        description ?? existingRecord.description,
        amount ?? existingRecord.amount,
        payment_mode || existingRecord.payment_mode,
        resolvedBankAccount?.id || toInteger(bank_id || bank_account_id) || existingRecord.bank_id,
        resolvedBankAccount?.bank_name || resolvedBankAccount?.account_name || bank_name || existingRecord.bank_name,
        reference_no ?? existingRecord.reference_no,
        status || existingRecord.status,
        req.params.id,
      ]
    );

    const record = result.rows[0];
    if (record.bank_id) {
      await adjustBankBalance(client, record.bank_id, Number(record.amount || 0));
    }

    await logHistory({
      client,
      module_name: 'Accounts',
      action_type: 'UPDATE',
      record_id: record.id,
      title: `Updated Receipt: ${record.receipt_no}`,
      description: `Receipt details for ${record.receipt_no} were updated.`,
      user_name: 'admin'
    });
    await client.query("COMMIT");

    res.json({ success: true, message: "Receipt updated successfully", data: record });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[Receipt] update error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
};

const deleteReceipt = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      "UPDATE receipts SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *",
      [req.params.id]
    );
    if (!result.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Receipt not found" });
    }

    const deletedRecord = result.rows[0];
    if (deletedRecord.bank_id) {
      await adjustBankBalance(client, deletedRecord.bank_id, -Number(deletedRecord.amount || 0));
    }

    await logHistory({
      client,
      module_name: 'Accounts',
      action_type: 'DELETE',
      record_id: req.params.id,
      title: `Deleted Receipt: ${deletedRecord.receipt_no}`,
      description: `Receipt ${deletedRecord.receipt_no} was soft-deleted.`,
      changed_data: deletedRecord,
      user_name: 'admin'
    });
    await client.query("COMMIT");

    res.json({ success: true, message: "Receipt deleted successfully" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[Receipt] delete error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
};

module.exports = {
  createReceipt,
  getAllReceipts,
  updateReceipt,
  deleteReceipt,
  getNextReceiptNo,
};
