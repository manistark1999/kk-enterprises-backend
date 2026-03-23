const pool = require("../config/db");
const { logHistory } = require("../utils/history");
const { getNextDocumentNumber } = require("../utils/documentNumbers");
const { resolveCustomer, resolveVehicle, toInteger } = require("../utils/entityResolvers");

const replaceEstimationItems = async (client, estimationId, items = []) => {
  await client.query("DELETE FROM estimation_items WHERE estimation_id = $1", [estimationId]);

  const savedItems = [];
  for (const item of items) {
    const itemName = item.itemName || item.item_name || item.name;
    if (!itemName) continue;

    const itemResult = await client.query(
      `INSERT INTO estimation_items (estimation_id, item_name, description, quantity, rate, gst, amount)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [estimationId, itemName, item.description || null, item.quantity || 1, item.rate || 0, item.gst || 0, item.amount || 0]
    );
    savedItems.push(itemResult.rows[0]);
  }
  return savedItems;
};

const getNextEstimationNo = async (req, res) => {
  try {
    const nextNo = await getNextDocumentNumber({
      db: pool,
      tableName: "estimations",
      columnName: "bill_no",
      type: "estimation",
      dateValue: req.query.date || new Date(),
    });
    res.json({ success: true, data: nextNo });
  } catch (error) {
    console.error("[Estimation] getNextNo error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

const createEstimation = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const {
      bill_no_generated, estimation_date, customer_id, customer_name, customer_phone,
      vehicle_id, vehicle_number, vehicle_make, vehicle_model, total_amount, status, items
    } = req.body;

    let bill_no = req.body.bill_no || bill_no_generated;
    if (!bill_no) {
      bill_no = await getNextDocumentNumber({
        db: client,
        tableName: "estimations",
        columnName: "bill_no",
        type: "estimation",
        dateValue: estimation_date,
      });
    }

    if (!estimation_date || !customer_name) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Date and customer name are required" });
    }

    const resolvedCustomer = await resolveCustomer(client, {
      customerId: customer_id,
      customerName: customer_name,
      customerPhone: customer_phone,
    });
    const resolvedVehicle = await resolveVehicle(client, {
      vehicleId: vehicle_id,
      vehicleNumber: vehicle_number,
    });

    const result = await client.query(
      `INSERT INTO estimations (
        bill_no, estimation_number, estimation_date, customer_id, customer_name,
        customer_phone, vehicle_id, vehicle_number, vehicle_make, vehicle_model,
        total_amount, status
      ) VALUES ($1,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [
        bill_no, estimation_date,
        resolvedCustomer?.id || toInteger(customer_id),
        resolvedCustomer?.customer_name || customer_name,
        resolvedCustomer?.phone || customer_phone || null,
        resolvedVehicle?.id || toInteger(vehicle_id),
        resolvedVehicle?.vehicle_number || vehicle_number || null,
        vehicle_make || resolvedVehicle?.vehicle_make || null,
        vehicle_model || resolvedVehicle?.model || null,
        total_amount || 0, status || "Pending"
      ]
    );

    const record = result.rows[0];
    await replaceEstimationItems(client, record.id, items || []);

    await logHistory({
      client,
      module_name: 'Estimation',
      action_type: 'CREATE',
      record_id: record.id,
      title: `Created Estimation: ${bill_no}`,
      description: `New estimation ${bill_no} created for vehicle ${record.vehicle_number}.`,
      user_name: 'admin'
    });

    await client.query("COMMIT");
    res.status(201).json({ success: true, message: "Estimation saved successfully", data: record });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[Estimation] create error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
};

const getAllEstimations = async (req, res) => {
  try {
    const query = `
      SELECT e.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', ei.id, 'itemName', ei.item_name, 'description', ei.description,
              'quantity', ei.quantity, 'rate', ei.rate, 'gst', ei.gst, 'amount', ei.amount
            )
          ) FILTER (WHERE ei.id IS NOT NULL), '[]'
        ) AS items
      FROM estimations e
      LEFT JOIN estimation_items ei ON e.id = ei.estimation_id
      GROUP BY e.id
      ORDER BY e.created_at DESC
    `;
    const result = await pool.query(query);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateEstimation = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const {
      bill_no, estimation_date, customer_id, customer_name, customer_phone,
      vehicle_id, vehicle_number, vehicle_make, vehicle_model, total_amount, status, items
    } = req.body;

    const resolvedCustomer = await resolveCustomer(client, {
      customerId: customer_id,
      customerName: customer_name,
      customerPhone: customer_phone,
    });
    const resolvedVehicle = await resolveVehicle(client, {
      vehicleId: vehicle_id,
      vehicleNumber: vehicle_number,
    });

    const result = await client.query(
      `UPDATE estimations SET
         bill_no = COALESCE($1, bill_no),
         estimation_number = COALESCE($1, estimation_number),
         estimation_date = COALESCE($2, estimation_date),
         customer_id = COALESCE($3, customer_id),
         customer_name = COALESCE($4, customer_name),
         customer_phone = COALESCE($5, customer_phone),
         vehicle_id = COALESCE($6, vehicle_id),
         vehicle_number = COALESCE($7, vehicle_number),
         vehicle_make = COALESCE($8, vehicle_make),
         vehicle_model = COALESCE($9, vehicle_model),
         total_amount = COALESCE($10, total_amount),
         status = COALESCE($11, status),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $12 RETURNING *`,
      [
        bill_no || null, estimation_date || null,
        resolvedCustomer?.id || toInteger(customer_id),
        resolvedCustomer?.customer_name || customer_name || null,
        resolvedCustomer?.phone || customer_phone || null,
        resolvedVehicle?.id || toInteger(vehicle_id),
        resolvedVehicle?.vehicle_number || vehicle_number || null,
        vehicle_make || resolvedVehicle?.vehicle_make || null,
        vehicle_model || resolvedVehicle?.model || null,
        total_amount ?? null, status || null, req.params.id
      ]
    );

    if (!result.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Estimation not found" });
    }

    const record = result.rows[0];
    await replaceEstimationItems(client, record.id, items || []);

    await logHistory({
      client,
      module_name: 'Estimation',
      action_type: 'UPDATE',
      record_id: record.id,
      title: `Updated Estimation: ${record.bill_no}`,
      description: `Estimation details for ${record.bill_no} were modified.`,
      user_name: 'admin'
    });

    await client.query("COMMIT");
    res.json({ success: true, message: "Estimation updated successfully", data: record });
  } catch (error) {
    await client.query("ROLLBACK");
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
};

const deleteEstimation = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { id } = req.params;
    
    const check = await client.query('SELECT bill_no FROM estimations WHERE id = $1', [id]);
    if (!check.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: "Estimation not found" });
    }
    const billNo = check.rows[0].bill_no;

    await client.query("DELETE FROM estimations WHERE id = $1", [id]);

    await logHistory({
      client,
      module_name: 'Estimation',
      action_type: 'DELETE',
      record_id: id,
      title: `Deleted Estimation: ${billNo}`,
      description: `Estimation ${billNo} was removed.`,
      user_name: 'admin'
    });

    await client.query("COMMIT");
    res.json({ success: true, message: "Estimation deleted successfully" });
  } catch (error) {
    await client.query("ROLLBACK");
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
};

module.exports = { createEstimation, getAllEstimations, getNextEstimationNo, updateEstimation, deleteEstimation };
