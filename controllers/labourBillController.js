const pool = require('../config/db');
const { logHistory } = require('../utils/history');
const { getNextDocumentNumber } = require("../utils/documentNumbers");
const { resolveCustomer, toInteger, toNumber } = require("../utils/entityResolvers");
const { applyInventoryMovement } = require("../utils/stockSync");

const getNextNumber = async (req, res) => {
  try {
    const billNo = await getNextDocumentNumber({
      db: pool,
      tableName: "labour_bills",
      columnName: "bill_no",
      type: "bill",
      dateValue: req.query.date || new Date(),
    });

    res.json({ success: true, data: billNo });
  } catch (error) {
    console.error('[LabourBill] getNextNo error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};
const getAll = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM labour_bills WHERE is_deleted = false ORDER BY created_at DESC');
    res.json({ success: true, data: result.rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const create = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const {
      bill_no_generated,
      bill_date,
      bill_time,
      customer_id,
      customer_name,
      customer_phone,
      customer_address,
      vehicle_number,
      vehicle_make,
      vehicle_model,
      km_reading,
      fuel_level,
      items,
      subtotal,
      total_gst,
      discount,
      grand_total,
      status,
      jobcard_id,
      jobcard_no,
    } = req.body;
    let bill_no = req.body.bill_no || bill_no_generated;

    if (!bill_no) {
      bill_no = await getNextDocumentNumber({
        db: client,
        tableName: "labour_bills",
        columnName: "bill_no",
        type: "bill",
        dateValue: bill_date,
      });
    }

    if (!bill_date || !customer_name) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "bill_date and customer_name are required",
      });
    }

    const existing = await client.query(
      "SELECT id FROM labour_bills WHERE bill_no = $1 LIMIT 1",
      [bill_no]
    );
    if (existing.rows.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: `Bill ${bill_no} already exists`,
      });
    }

    const resolvedCustomer = await resolveCustomer(client, {
      customerId: customer_id,
      customerName: customer_name,
      customerPhone: customer_phone,
    });

    const safeGrandTotal = grand_total ?? subtotal ?? 0;
    const result = await client.query(
      `INSERT INTO labour_bills (
        bill_no, bill_number, bill_date, bill_time, customer_id, customer_name, customer_phone,
        customer_address, vehicle_number, vehicle_make, vehicle_model, km_reading,
        fuel_level, items, subtotal, total_gst, discount, grand_total, total_amount, status,
        jobcard_id, jobcard_no
      )
       VALUES ($1,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$17,$18,$19,$20)
       RETURNING *`,
      [
        bill_no,
        bill_date,
        bill_time || null,
        resolvedCustomer?.id || toInteger(customer_id),
        resolvedCustomer?.customer_name || customer_name,
        resolvedCustomer?.phone || customer_phone || null,
        customer_address || resolvedCustomer?.address || null,
        vehicle_number || null,
        vehicle_make || null,
        vehicle_model || null,
        km_reading || null,
        fuel_level || null,
        JSON.stringify(items || []),
        subtotal || 0,
        total_gst || 0,
        discount || 0,
        safeGrandTotal || 0,
        status || 'Completed',
        jobcard_id || null,
        jobcard_no || null,
      ]
    );
    
    const record = result.rows[0];

    // Normalized Items Insertion
    if (items && Array.isArray(items)) {
      for (const item of items) {
        await client.query(
          `INSERT INTO labour_bill_items (labour_bill_id, item_name, quantity, rate, gst_percent, gst_amount, amount, is_labour)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            record.id,
            item.serviceName || item.itemName || item.item_name || item.name || "Item",
            toNumber(item.quantity || item.qty, 1),
            toNumber(item.rate, 0),
            toNumber(item.gst, 0),
            (toNumber(item.amount, 0) * (toNumber(item.gst, 0) / 100)),
            toNumber(item.amount, 0),
            item.isLabour || false
          ]
        );
      }
    }

    // STOCK SYNC: Deduct parts from stock for standalone bills
    if (!jobcard_id && !jobcard_no) {
      if (items && Array.isArray(items) && items.length > 0) {
        await applyInventoryMovement(client, items, {
          direction: -1, // DEDUCT
          transactionDate: { lastSaleDate: record.bill_date },
          createMissingItems: false,
          movementType: 'LABOUR_BILL',
          referenceNo: record.bill_no,
          referenceId: record.id
        });
      }
    }

    await logHistory({
      client,
      module_name: 'Billing',
      action_type: 'CREATE',
      record_id: record.id,
      title: `Created Labour Bill: ${record.bill_no}`,
      description: `New labour bill of ${record.grand_total} created for ${record.customer_name}.`,
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
    const {
      bill_no,
      bill_date,
      bill_time,
      customer_id,
      customer_name,
      customer_phone,
      customer_address,
      vehicle_number,
      vehicle_make,
      vehicle_model,
      km_reading,
      fuel_level,
      items,
      subtotal,
      total_gst,
      discount,
      grand_total,
      status,
      jobcard_id,
      jobcard_no,
    } = req.body;

    const existingBill = await client.query('SELECT items, jobcard_id, jobcard_no FROM labour_bills WHERE id = $1', [req.params.id]);
    if (!existingBill.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Bill not found" });
    }
    const oldItems = existingBill.rows[0].items ? JSON.parse(existingBill.rows[0].items) : [];
    const oldJobcardId = existingBill.rows[0].jobcard_id;
    const oldJobcardNo = existingBill.rows[0].jobcard_no;

    const resolvedCustomer = await resolveCustomer(client, {
      customerId: customer_id,
      customerName: customer_name,
      customerPhone: customer_phone,
    });
    const safeGrandTotal = grand_total ?? subtotal ?? 0;
    
    const result = await client.query(
      `UPDATE labour_bills SET
         bill_no=$1,
         bill_number=$1,
         bill_date=$2,
         bill_time=$3,
         customer_id=$4,
         customer_name=$5,
         customer_phone=$6,
         customer_address=$7,
         vehicle_number=$8,
         vehicle_make=$9,
         vehicle_model=$10,
         km_reading=$11,
         fuel_level=$12,
         items=$13,
         subtotal=$14,
         total_gst=$15,
         discount=$16,
         grand_total=$17,
         total_amount=$17,
         status=$18,
         jobcard_id=$19,
         jobcard_no=$20,
         updated_at=CURRENT_TIMESTAMP
       WHERE id=$21
       RETURNING *`,
      [
        bill_no,
        bill_date,
        bill_time || null,
        resolvedCustomer?.id || toInteger(customer_id),
        resolvedCustomer?.customer_name || customer_name,
        resolvedCustomer?.phone || customer_phone || null,
        customer_address || resolvedCustomer?.address || null,
        vehicle_number || null,
        vehicle_make || null,
        vehicle_model || null,
        km_reading || null,
        fuel_level || null,
        JSON.stringify(items || []),
        subtotal || 0,
        total_gst || 0,
        discount || 0,
        safeGrandTotal || 0,
        status || 'Completed',
        jobcard_id || null,
        jobcard_no || null,
        req.params.id,
      ]
    );

    if (!result.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Bill not found" });
    }

    const record = result.rows[0];

    // Normalized Items Sync
    await client.query("DELETE FROM labour_bill_items WHERE labour_bill_id = $1", [record.id]);
    if (items && Array.isArray(items)) {
      for (const item of items) {
        await client.query(
          `INSERT INTO labour_bill_items (labour_bill_id, item_name, quantity, rate, gst_percent, gst_amount, amount, is_labour)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            record.id,
            item.serviceName || item.itemName || item.item_name || item.name || "Item",
            toNumber(item.quantity || item.qty, 1),
            toNumber(item.rate, 0),
            toNumber(item.gst, 0),
            (toNumber(item.amount, 0) * (toNumber(item.gst, 0) / 100)),
            toNumber(item.amount, 0),
            item.isLabour || false
          ]
        );
      }
    }

    // STOCK SYNC: Update stock for standalone bills
    if (!oldJobcardId && !oldJobcardNo) { // Only apply if it was a standalone bill previously
      // Restock old items
      if (oldItems && oldItems.length > 0) {
        await applyInventoryMovement(client, oldItems, {
          direction: 1, // RESTOCK
          transactionDate: { lastSaleDate: record.bill_date },
          createMissingItems: false,
          movementType: 'LABOUR_BILL_UPDATE_RESTOCK',
          referenceNo: record.bill_no,
          referenceId: record.id
        });
      }
      // Deduct new items if still standalone
      if (!jobcard_id && !jobcard_no && items && items.length > 0) {
        await applyInventoryMovement(client, items, {
          direction: -1, // DEDUCT
          transactionDate: { lastSaleDate: record.bill_date },
          createMissingItems: false,
          movementType: 'LABOUR_BILL_UPDATE_DEDUCT',
          referenceNo: record.bill_no,
          referenceId: record.id
        });
      }
    } else if (!jobcard_id && !jobcard_no) { // If it was linked to jobcard, but now standalone
      if (items && items.length > 0) {
        await applyInventoryMovement(client, items, {
          direction: -1, // DEDUCT
          transactionDate: { lastSaleDate: record.bill_date },
          createMissingItems: false,
          movementType: 'LABOUR_BILL_UPDATE_DEDUCT',
          referenceNo: record.bill_no,
          referenceId: record.id
        });
      }
    }


    await logHistory({
      client,
      module_name: 'Billing',
      action_type: 'UPDATE',
      record_id: record.id,
      title: `Updated Labour Bill: ${record.bill_no}`,
      description: `Labour bill for ${record.customer_name} was modified.`,
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
    const result = await client.query('UPDATE labour_bills SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP WHERE id=$1 RETURNING *', [req.params.id]);

    if (!result.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Bill not found" });
    }

    await logHistory({
      client,
      module_name: 'Accounts',
      action_type: 'DELETE',
      record_id: req.params.id,
      title: `Deleted Labour Bill: ${result.rows[0].bill_no}`,
      description: `Labour bill ${result.rows[0].bill_no} was soft-deleted.`,
      user_name: 'admin',
      changed_data: result.rows[0]
    });
    await client.query('COMMIT');
    res.json({ success: true, message: 'Bill deleted successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};

const deleteLabourBill = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const result = await client.query(
      "UPDATE labour_bills SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *",
      [req.params.id]
    );

    if (!result.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Bill not found" });
    }

    const deletedRecord = result.rows[0];

    // STOCK SYNC: Restore parts stock for standalone bills
    if (!deletedRecord.jobcard_id && !deletedRecord.jobcard_no) {
      const items = deletedRecord.items ? (typeof deletedRecord.items === 'string' ? JSON.parse(deletedRecord.items) : deletedRecord.items) : [];
      if (items && items.length > 0) {
        await applyInventoryMovement(client, items, {
          direction: 1, // RESTORE
          movementType: 'LABOUR_BILL_DELETE',
          referenceNo: deletedRecord.bill_no,
          referenceId: deletedRecord.id
        });
      }
    }

    await logHistory({
      client,
      module_name: 'Billing',
      action_type: 'DELETE',
      record_id: req.params.id,
      title: `Deleted Labour Bill: ${deletedRecord.bill_no}`,
      description: `Labour bill ${deletedRecord.bill_no} was soft-deleted.`,
      changed_data: deletedRecord,
      user_name: 'admin'
    });

    await client.query("COMMIT");
    res.json({ success: true, message: "Bill deleted successfully" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[LabourBill] delete error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
};

module.exports = { getAll, create, update, remove: deleteLabourBill, getNextNumber };
