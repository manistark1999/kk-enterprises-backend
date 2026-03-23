const pool = require("../config/db");
const { logHistory } = require("../utils/history");
const { getNextDocumentNumber } = require("../utils/documentNumbers");
const { resolveCustomer, resolveSupplier, toInteger } = require("../utils/entityResolvers");
const {
  applyInventoryMovement,
  recordStockMovement,
  resolveCatalogItem,
  resolveStockRow,
  saveStockRow,
  syncItemStock,
  toNumber,
} = require("../utils/stockSync");

const normalizeJsonItems = (items) => {
  if (Array.isArray(items)) return items;
  if (!items) return [];
  if (typeof items === "string") {
    try {
      return JSON.parse(items);
    } catch (error) {
      return [];
    }
  }
  return [];
};

const mapStockRow = (row) => ({
  ...row,
  current_stock: Number(row.current_stock || 0),
  min_stock: Number(row.min_stock || 0),
  max_stock: Number(row.max_stock || 0),
  reorder_level: Number(row.reorder_level || 0),
  purchase_price: Number(row.purchase_price || 0),
  selling_price: Number(row.selling_price || 0),
});

const buildStockPayload = (payload) => ({
  itemName: payload.itemName || payload.item_name,
  itemCode: payload.itemCode || payload.item_code || payload.part_number,
  category: payload.category || null,
  brand: payload.brand || null,
  unit: payload.unit || "Nos",
  currentStock: payload.currentStock ?? payload.current_stock,
  minStock: payload.minStock ?? payload.min_stock ?? 0,
  maxStock: payload.maxStock ?? payload.max_stock ?? payload.reorderLevel ?? payload.reorder_level ?? 0,
  reorderLevel: payload.reorderLevel ?? payload.reorder_level ?? payload.minStock ?? payload.min_stock ?? 0,
  sellingPrice: payload.unitPrice ?? payload.selling_price ?? payload.sellingPrice ?? 0,
  purchasePrice: payload.purchasePrice ?? payload.purchase_price ?? payload.unitPrice ?? payload.selling_price ?? 0,
  supplierName: payload.supplier || payload.supplierName || payload.supplier_name || null,
  supplierId: payload.supplierId || payload.supplier_id || null,
  location: payload.location || null,
  description: payload.description || null,
  status: payload.status || "Active",
  item_id: payload.item_id || payload.itemId || null,
  stock_item_id: payload.stock_item_id || payload.stockItemId || null,
});

const reverseInventoryMovement = async (client, items, direction, transactionDate) =>
  applyInventoryMovement(client, normalizeJsonItems(items), {
    direction,
    transactionDate,
    createMissingItems: false,
  });

const getAll = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM cash_entries WHERE is_deleted = false ORDER BY entry_date DESC, created_at DESC"
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("[CashEntry] getAll error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

const create = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const {
      entry_no, entry_date, entry_time, transaction_type, reference_no,
      description, amount, payment_type, notes, handled_by
    } = req.body;

    if (!entry_date) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Entry date is required" });
    }

    const result = await client.query(
      `INSERT INTO cash_entries (
        entry_no, entry_date, entry_time, transaction_type, reference_no,
        description, amount, payment_type, notes, handled_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        entry_no, entry_date, entry_time || null, transaction_type || null, reference_no || null,
        description || null, amount || 0, payment_type || null, notes || null, handled_by || null
      ]
    );

    const record = result.rows[0];
    await logHistory({
      client,
      module_name: 'Inventory',
      action_type: 'CREATE',
      record_id: record.id,
      title: `Created Cash Entry: ${record.entry_no}`,
      description: `${record.transaction_type} of ${record.amount} added to cash registry.`,
      changed_data: record,
      user_name: 'admin'
    });

    await client.query("COMMIT");
    res.status(201).json({ success: true, message: "Cash entry created successfully", data: record });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[CashEntry] create error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};

const remove = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const check = await client.query("SELECT entry_no FROM cash_entries WHERE id = $1", [req.params.id]);
    if (!check.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Cash entry not found" });
    }
    const entryNo = check.rows[0].entry_no;

    await client.query("UPDATE cash_entries SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP WHERE id = $1", [req.params.id]);

    await logHistory({
      client,
      module_name: 'Inventory',
      action_type: 'DELETE',
      record_id: req.params.id,
      title: `Deleted Cash Entry: ${entryNo}`,
      description: `Cash entry ${entryNo} was soft-deleted.`,
      changed_data: check.rows[0],
      user_name: 'admin'
    });

    await client.query("COMMIT");
    res.json({ success: true, message: "Cash entry deleted successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[CashEntry] remove error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};

const updateCash = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { id } = req.params;
    const {
      entry_no, entry_date, entry_time, transaction_type, reference_no,
      description, amount, payment_type, notes, handled_by
    } = req.body;

    const result = await client.query(
      `UPDATE cash_entries SET 
        entry_no=$1, entry_date=$2, entry_time=$3, transaction_type=$4, reference_no=$5,
        description=$6, amount=$7, payment_type=$8, notes=$9, handled_by=$10, updated_at=NOW()
      WHERE id=$11 RETURNING *`,
      [
        entry_no, entry_date, entry_time || null, transaction_type || null, reference_no || null,
        description || null, amount || 0, payment_type || null, notes || null, handled_by || null, 
        id
      ]
    );

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Cash entry not found" });
    }

    const record = result.rows[0];
    await logHistory({
      client,
      module_name: 'Inventory',
      action_type: 'UPDATE',
      record_id: record.id,
      title: `Updated Cash Entry: ${record.entry_no}`,
      description: `Cash entry ${record.entry_no} details were modified.`,
      changed_data: record,
      user_name: 'admin'
    });

    await client.query("COMMIT");
    res.json({ success: true, message: "Cash entry updated successfully", data: record });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[CashEntry] update error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};

const getAllAdjustments = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM stock_adjustments WHERE is_deleted = false ORDER BY adjustment_date DESC, created_at DESC"
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("[StockAdjustment] getAll error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

const createAdjustment = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const {
      adjustment_no, adjustment_date, item_id, stock_item_id, item_name,
      item_code, adjustment_type, quantity, reason, notes, remarks
    } = req.body;

    if (!adjustment_date || !(item_id || stock_item_id || item_name)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Date and item selection are required" });
    }

    const itemPayload = { item_id, stock_item_id, itemName: item_name, itemCode: item_code };
    const itemRow = await resolveCatalogItem(client, itemPayload, { createIfMissing: false });
    const stockRow = await resolveStockRow(client, itemPayload, itemRow);
    
    if (!stockRow) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Stock item not found" });
    }

    const previousStock = toNumber(stockRow.current_stock, 0);
    const movement = adjustment_type === "Add" ? 1 : -1;
    const nextStock = previousStock + movement * toNumber(quantity, 0);

    if (nextStock < 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: `Insufficient stock for ${stockRow.item_name}` });
    }

    const savedStockRow = await saveStockRow({
      client,
      item: {
        ...itemPayload, itemName: stockRow.item_name, itemCode: item_code || stockRow.item_code,
        category: stockRow.category, brand: stockRow.brand, unit: stockRow.unit,
        purchasePrice: stockRow.purchase_price, sellingPrice: stockRow.selling_price,
        minStock: stockRow.min_stock, maxStock: stockRow.max_stock, reorderLevel: stockRow.reorder_level,
        supplierId: stockRow.supplier_id, supplierName: stockRow.supplier_name, location: stockRow.location
      },
      itemRow, existingStockRow: stockRow, nextStock, transactionDate: {},
      supplierId: stockRow.supplier_id, supplierName: stockRow.supplier_name
    });

    if (itemRow) {
      await syncItemStock(client, itemRow, nextStock, { ...itemPayload, minStock: stockRow.min_stock }, savedStockRow);
    }

    const result = await client.query(
      `INSERT INTO stock_adjustments (
        adjustment_no, adjustment_date, stock_item_id, item_id, item_code, item_name,
        adjustment_type, quantity, previous_stock, new_stock, reason, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [
        adjustment_no || null, adjustment_date, savedStockRow.id, itemRow?.id || toInteger(item_id),
        item_code || savedStockRow.item_code || null, savedStockRow.item_name,
        adjustment_type || "Add", quantity || 0, previousStock, nextStock, reason || null, notes || remarks || null
      ]
    );

    const record = result.rows[0];

    await recordStockMovement({
      client,
      stock_item_id: savedStockRow.id,
      item_id: itemRow?.id || toInteger(item_id),
      item_name: savedStockRow.item_name,
      quantity: toNumber(quantity, 0),
      direction: adjustment_type === "Add" ? 1 : -1,
      movement_type: 'ADJUSTMENT',
      reference_no: record.adjustment_no,
      reference_id: record.id
    });

    await logHistory({
      client,
      module_name: 'Inventory',
      action_type: 'CREATE',
      record_id: record.id,
      title: `Stock Adjustment: ${record.item_name}`,
      description: `${record.adjustment_type}ed ${record.quantity} units. Final stock: ${record.new_stock}`,
      changed_data: record,
      user_name: 'admin'
    });

    await client.query("COMMIT");
    res.status(201).json({ success: true, message: "Stock adjustment created successfully", data: record });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[StockAdjustment] create error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};

const updateAdjustment = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existingResult = await client.query(
      "SELECT * FROM stock_adjustments WHERE id = $1 LIMIT 1",
      [req.params.id]
    );
    if (!existingResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Adjustment not found" });
    }

    const existingRecord = existingResult.rows[0];
    await reverseInventoryMovement(
      client,
      [
        {
          stock_item_id: existingRecord.stock_item_id,
          item_id: existingRecord.item_id,
          item_name: existingRecord.item_name,
          quantity: existingRecord.quantity,
        },
      ],
      existingRecord.adjustment_type === "Add" ? -1 : 1,
      {}
    );

    const {
      adjustment_no, adjustment_date, item_id, stock_item_id, item_name,
      item_code, adjustment_type, quantity, reason, notes, remarks
    } = req.body;

    const itemPayload = {
      item_id: item_id || existingRecord.item_id,
      stock_item_id: stock_item_id || existingRecord.stock_item_id,
      itemName: item_name || existingRecord.item_name,
      itemCode: item_code || existingRecord.item_code,
    };
    const itemRow = await resolveCatalogItem(client, itemPayload, { createIfMissing: false });
    const stockRow = await resolveStockRow(client, itemPayload, itemRow);
    if (!stockRow) throw new Error("Stock item not found");

    const previousStock = toNumber(stockRow.current_stock, 0);
    const movement = (adjustment_type || existingRecord.adjustment_type) === "Add" ? 1 : -1;
    const nextStock = previousStock + movement * toNumber(quantity ?? existingRecord.quantity, 0);
    if (nextStock < 0) throw new Error(`Insufficient stock for ${stockRow.item_name}`);

    const savedStockRow = await saveStockRow({
      client,
      item: {
        ...itemPayload, itemName: stockRow.item_name, itemCode: item_code || stockRow.item_code,
        category: stockRow.category, brand: stockRow.brand, unit: stockRow.unit,
        purchasePrice: stockRow.purchase_price, sellingPrice: stockRow.selling_price,
        minStock: stockRow.min_stock, maxStock: stockRow.max_stock, reorderLevel: stockRow.reorder_level,
        supplierId: stockRow.supplier_id, supplierName: stockRow.supplier_name, location: stockRow.location
      },
      itemRow, existingStockRow: stockRow, nextStock, transactionDate: {},
      supplierId: stockRow.supplier_id, supplierName: stockRow.supplier_name
    });

    if (itemRow) {
      await syncItemStock(client, itemRow, nextStock, { ...itemPayload, minStock: stockRow.min_stock }, savedStockRow);
    }

    const result = await client.query(
      `UPDATE stock_adjustments SET
         adjustment_no=$1, adjustment_date=$2, stock_item_id=$3, item_id=$4, item_code=$5, item_name=$6,
         adjustment_type=$7, quantity=$8, previous_stock=$9, new_stock=$10, reason=$11, notes=$12, updated_at=NOW()
       WHERE id=$13 RETURNING *`,
      [
        adjustment_no || existingRecord.adjustment_no,
        adjustment_date || existingRecord.adjustment_date,
        savedStockRow.id, itemRow?.id || itemPayload.item_id || null,
        item_code || savedStockRow.item_code || existingRecord.item_code,
        savedStockRow.item_name, adjustment_type || existingRecord.adjustment_type,
        quantity ?? existingRecord.quantity, previousStock, nextStock,
        reason ?? existingRecord.reason, notes || remarks || existingRecord.notes, req.params.id
      ]
    );

    const record = result.rows[0];

    await recordStockMovement({
      client,
      stock_item_id: savedStockRow.id,
      item_id: itemRow?.id || itemPayload.item_id || null,
      item_name: savedStockRow.item_name,
      quantity: toNumber(quantity ?? existingRecord.quantity, 0),
      direction: (adjustment_type || existingRecord.adjustment_type) === "Add" ? 1 : -1,
      movement_type: 'ADJUSTMENT',
      reference_no: record.adjustment_no,
      reference_id: record.id
    });

    await logHistory({
      client,
      module_name: 'Inventory',
      action_type: 'UPDATE',
      record_id: record.id,
      title: `Updated Stock Adjustment: ${record.item_name}`,
      description: `Adjustment for ${record.item_name} modified. New stock: ${record.new_stock}`,
      changed_data: record,
      user_name: 'admin'
    });

    await client.query("COMMIT");
    res.json({ success: true, message: "Stock adjustment updated successfully", data: record });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[StockAdjustment] update error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};

const deleteAdjustment = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { id } = req.params;
    const existingResult = await client.query(
      "SELECT * FROM stock_adjustments WHERE id = $1 LIMIT 1",
      [id]
    );
    if (!existingResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Adjustment not found" });
    }

    const existingRecord = existingResult.rows[0];
    await reverseInventoryMovement(
      client,
      [
        {
          stock_item_id: existingRecord.stock_item_id,
          item_id: existingRecord.item_id,
          item_name: existingRecord.item_name,
          quantity: existingRecord.quantity,
        },
      ],
      existingRecord.adjustment_type === "Add" ? -1 : 1,
      {}
    );

    await client.query("UPDATE stock_adjustments SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP WHERE id = $1", [id]);
    
    await logHistory({
      client,
      module_name: 'Inventory',
      action_type: 'DELETE',
      record_id: id,
      title: `Deleted Stock Adjustment: ${existingRecord.item_name}`,
      description: `Adjustment for ${existingRecord.item_name} was removed.`,
      changed_data: existingRecord,
      user_name: 'admin'
    });

    await client.query("COMMIT");
    res.json({ success: true, message: "Stock adjustment deleted successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[StockAdjustment] delete error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};

const getNextSaleNo = async (req, res) => {
  try {
    const nextNumber = await getNextDocumentNumber({
      db: pool,
      tableName: "sales",
      columnName: "sale_no",
      type: "sale",
      dateValue: req.query.date || new Date(),
    });
    res.json({ success: true, data: nextNumber });
  } catch (error) {
    console.error("[Sale] getNextNo error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getAllSales = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM sales WHERE is_deleted = false ORDER BY created_at DESC");
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("[Sale] getAll error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

const createSale = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const {
      sale_no_generated, sale_date, customer_id, customer_name, customer_phone,
      items, subtotal, total_gst, discount, grand_total, payment_mode, status
    } = req.body;

    let sale_no = req.body.sale_no || sale_no_generated;
    if (!sale_no) {
      sale_no = await getNextDocumentNumber({
        db: client, tableName: "sales", columnName: "sale_no", type: "sale", dateValue: sale_date
      });
    }

    if (!sale_date) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Date is required" });
    }

    const resolvedCustomer = await resolveCustomer(client, {
      customerId: customer_id, customerName: customer_name, customerPhone: customer_phone
    });
    const normalizedItems = normalizeJsonItems(items);

    const result = await client.query(
      `INSERT INTO sales (
        sale_no, sale_date, customer_id, customer_name, customer_phone, items,
        subtotal, total_gst, discount, grand_total, payment_mode, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [
        sale_no, sale_date, resolvedCustomer?.id || toInteger(customer_id),
        resolvedCustomer?.customer_name || customer_name || null,
        resolvedCustomer?.phone || customer_phone || null, JSON.stringify(normalizedItems),
        subtotal || 0, total_gst || 0, discount || 0, grand_total || 0,
        payment_mode || "Cash", status || "Completed"
      ]
    );

    const record = result.rows[0];

    // Normalized Items Insertion
    for (const item of normalizedItems) {
      const itemRecord = await resolveCatalogItem(client, item);
      await client.query(
        `INSERT INTO sale_items (sale_id, item_id, item_name, quantity, rate, gst_percent, gst_amount, amount)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          record.id, itemRecord?.id || null, item.itemName || item.item_name,
          toNumber(item.quantity || item.qty, 0), toNumber(item.rate, 0),
          toNumber(item.gst, 0), (toNumber(item.amount, 0) * toNumber(item.gst, 0)) / 100,
          toNumber(item.amount, 0)
        ]
      );
    }

    await applyInventoryMovement(client, normalizedItems, {
      direction: -1,
      transactionDate: { lastSaleDate: sale_date },
      createMissingItems: false,
      movementType: 'SALE',
      referenceNo: record.sale_no,
      referenceId: record.id
    });
    await logHistory({
      client,
      module_name: 'Inventory',
      action_type: 'CREATE',
      record_id: record.id,
      title: `Created Sale: ${record.sale_no}`,
      description: `Sale of ${record.grand_total} to ${record.customer_name}.`,
      changed_data: record,
      user_name: 'admin'
    });

    await client.query("COMMIT");
    res.status(201).json({ success: true, message: "Sale created successfully", data: record });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[Sale] create error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};

const updateSale = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { id } = req.params;
    const existingResult = await client.query("SELECT * FROM sales WHERE id = $1 LIMIT 1", [id]);
    if (!existingResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Sale not found" });
    }

    const existingRecord = existingResult.rows[0];
    await reverseInventoryMovement(client, existingRecord.items, 1, {});

    const {
      sale_no, sale_date, customer_id, customer_name, customer_phone,
      items, subtotal, total_gst, discount, grand_total, payment_mode, status
    } = req.body;

    const resolvedCustomer = await resolveCustomer(client, {
      customerId: customer_id, customerName: customer_name, customerPhone: customer_phone
    });
    const normalizedItems = normalizeJsonItems(items);

    // Re-verify existing record items if needed, but reverseInventoryMovement already did it.

    const result = await client.query(
      `UPDATE sales SET
         sale_no=$1, sale_date=$2, customer_id=$3, customer_name=$4, customer_phone=$5, items=$6,
         subtotal=$7, total_gst=$8, discount=$9, grand_total=$10, payment_mode=$11, status=$12, updated_at=NOW()
       WHERE id=$13 RETURNING *`,
      [
        sale_no || existingRecord.sale_no, sale_date || existingRecord.sale_date,
        resolvedCustomer?.id || toInteger(customer_id) || existingRecord.customer_id,
        resolvedCustomer?.customer_name || customer_name || existingRecord.customer_name,
        resolvedCustomer?.phone || customer_phone || existingRecord.customer_phone,
        JSON.stringify(normalizedItems), subtotal ?? existingRecord.subtotal,
        total_gst ?? existingRecord.total_gst, discount ?? existingRecord.discount,
        grand_total ?? existingRecord.grand_total, payment_mode || existingRecord.payment_mode,
        status || existingRecord.status, id
      ]
    );

    const record = result.rows[0];

    // Refresh Normalized Items
    await client.query("DELETE FROM sale_items WHERE sale_id = $1", [id]);
    for (const item of normalizedItems) {
      const itemRecord = await resolveCatalogItem(client, item);
      await client.query(
        `INSERT INTO sale_items (sale_id, item_id, item_name, quantity, rate, gst_percent, gst_amount, amount)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          record.id, itemRecord?.id || null, item.itemName || item.item_name,
          toNumber(item.quantity || item.qty, 0), toNumber(item.rate, 0),
          toNumber(item.gst, 0), (toNumber(item.amount, 0) * toNumber(item.gst, 0)) / 100,
          toNumber(item.amount, 0)
        ]
      );
    }

    await logHistory({
      client,
      module_name: 'Inventory',
      action_type: 'UPDATE',
      record_id: record.id,
      title: `Updated Sale: ${record.sale_no}`,
      description: `Sale details for ${record.sale_no} modified.`,
      changed_data: record,
      user_name: 'admin'
    });

    await client.query("COMMIT");
    res.json({ success: true, message: "Sale updated successfully", data: record });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[Sale] update error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};

const deleteSale = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { id } = req.params;
    const result = await client.query("UPDATE sales SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *", [id]);
    if (!result.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Sale not found" });
    }

    const deletedRecord = result.rows[0];
    await reverseInventoryMovement(client, deletedRecord.items, 1, {});
    
    await logHistory({
      client,
      module_name: 'Inventory',
      action_type: 'DELETE',
      record_id: id,
      title: `Deleted Sale: ${deletedRecord.sale_no}`,
      description: `Sale ${deletedRecord.sale_no} was removed. Inventory restored.`,
      changed_data: deletedRecord,
      user_name: 'admin'
    });

    await client.query("COMMIT");
    res.json({ success: true, message: "Sale deleted successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[Sale] delete error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};

const getNextPurchaseNo = async (req, res) => {
  try {
    const nextNumber = await getNextDocumentNumber({
      db: pool,
      tableName: "purchases",
      columnName: "purchase_no",
      type: "purchase",
      dateValue: req.query.date || new Date(),
    });
    res.json({ success: true, data: nextNumber });
  } catch (error) {
    console.error("[Purchase] getNextNo error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getAllPurchases = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM purchases WHERE is_deleted = false ORDER BY created_at DESC");
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("[Purchase] getAll error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

const createPurchase = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const {
      purchase_no_generated, purchase_date, supplier_id, supplier_name, items,
      subtotal, total_gst, discount, grand_total, payment_mode, status, notes, invoice_no
    } = req.body;
    console.log("PAYLOAD IN CREATE PURCHASE:", JSON.stringify(req.body));

    let purchase_no = req.body.purchase_no || purchase_no_generated;
    if (!purchase_no) {
      purchase_no = await getNextDocumentNumber({
        db: client, tableName: "purchases", columnName: "purchase_no", type: "purchase", dateValue: purchase_date
      });
    }

    if (!purchase_date || (!supplier_id && !supplier_name)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Date and supplier are required. Payload was: " + JSON.stringify(req.body) });
    }

    const supplier = await resolveSupplier(client, {
      supplierId: supplier_id,
      supplierName: supplier_name
    });

    if (!supplier) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Supplier not found and could not be mapped" });
    }
    const normalizedItems = normalizeJsonItems(items);

    const result = await client.query(
      `INSERT INTO purchases (
        purchase_no, purchase_date, supplier_id, supplier_name, items,
        subtotal, total_gst, discount, grand_total, payment_mode, status, notes, invoice_no
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [
        purchase_no, purchase_date, supplier.id, supplier.name, JSON.stringify(normalizedItems),
        subtotal || 0, total_gst || 0, discount || 0, grand_total || 0,
        payment_mode || "Cash", status || "Received", notes || null, invoice_no || null
      ]
    );

    const record = result.rows[0];

    // Normalized Items Insertion
    for (const item of normalizedItems) {
      const itemRecord = await resolveCatalogItem(client, item);
      await client.query(
        `INSERT INTO purchase_items (purchase_id, item_id, item_name, quantity, rate, gst_percent, gst_amount, amount)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          record.id, itemRecord?.id || null, item.itemName || item.item_name,
          toNumber(item.quantity || item.qty, 0), toNumber(item.rate, 0),
          toNumber(item.gst, 0), (toNumber(item.amount, 0) * toNumber(item.gst, 0)) / 100,
          toNumber(item.amount, 0)
        ]
      );
    }

    await applyInventoryMovement(client, normalizedItems, {
      direction: 1,
      transactionDate: { lastPurchaseDate: purchase_date },
      supplierId: supplier.id,
      supplierName: supplier.name,
      createMissingItems: true,
      movementType: 'PURCHASE',
      referenceNo: record.purchase_no,
      referenceId: record.id
    });

    await logHistory({
      client,
      module_name: 'Inventory',
      action_type: 'CREATE',
      record_id: record.id,
      title: `Created Purchase: ${record.purchase_no}`,
      description: `Purchase of ${record.grand_total} from ${record.supplier_name}.`,
      changed_data: record,
      user_name: 'admin'
    });

    await client.query("COMMIT");
    res.status(201).json({ success: true, message: "Purchase created successfully", data: record });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[Purchase] create error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};

const updatePurchase = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { id } = req.params;
    const existingResult = await client.query("SELECT * FROM purchases WHERE id = $1 LIMIT 1", [id]);
    if (!existingResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Purchase not found" });
    }

    const existingRecord = existingResult.rows[0];
    await reverseInventoryMovement(client, existingRecord.items, -1, {});

    const {
      purchase_no, purchase_date, supplier_id, items, subtotal, total_gst,
      discount, grand_total, payment_mode, status, notes, invoice_no
    } = req.body;

    const supplier = await resolveSupplier(client, {
      supplierId: supplier_id || existingRecord.supplier_id,
      supplierName: req.body.supplier_name || existingRecord.supplier_name
    });

    if (!supplier) throw new Error("Supplier mapping completely failed during update operations");
    const normalizedItems = normalizeJsonItems(items);

    const result = await client.query(
      `UPDATE purchases SET
         purchase_no=$1, purchase_date=$2, supplier_id=$3, supplier_name=$4, items=$5,
         subtotal=$6, total_gst=$7, discount=$8, grand_total=$9, payment_mode=$10,
         status=$11, notes=$12, invoice_no=$13, updated_at=NOW()
       WHERE id=$14 RETURNING *`,
      [
        purchase_no || existingRecord.purchase_no, purchase_date || existingRecord.purchase_date,
        supplier.id, supplier.name, JSON.stringify(normalizedItems),
        subtotal ?? existingRecord.subtotal, total_gst ?? existingRecord.total_gst,
        discount ?? existingRecord.discount, grand_total ?? existingRecord.grand_total,
        payment_mode || existingRecord.payment_mode, status || existingRecord.status,
        notes ?? existingRecord.notes, invoice_no ?? existingRecord.invoice_no, id
      ]
    );

    const record = result.rows[0];

    // Refresh Normalized Items
    await client.query("DELETE FROM purchase_items WHERE purchase_id = $1", [id]);
    for (const item of normalizedItems) {
      const itemRecord = await resolveCatalogItem(client, item);
      await client.query(
        `INSERT INTO purchase_items (purchase_id, item_id, item_name, quantity, rate, gst_percent, gst_amount, amount)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          record.id, itemRecord?.id || null, item.itemName || item.item_name,
          toNumber(item.quantity || item.qty, 0), toNumber(item.rate, 0),
          toNumber(item.gst, 0), (toNumber(item.amount, 0) * toNumber(item.gst, 0)) / 100,
          toNumber(item.amount, 0)
        ]
      );
    }

    await applyInventoryMovement(client, normalizedItems, {
      direction: 1,
      transactionDate: { lastPurchaseDate: purchase_date || existingRecord.purchase_date },
      supplierId: supplier.id,
      supplierName: supplier.name,
      createMissingItems: true,
      movementType: 'PURCHASE',
      referenceNo: record.purchase_no,
      referenceId: record.id
    });

    await logHistory({
      client,
      module_name: 'Inventory',
      action_type: 'UPDATE',
      record_id: record.id,
      title: `Updated Purchase: ${record.purchase_no}`,
      description: `Purchase details for ${record.purchase_no} modified.`,
      changed_data: record,
      user_name: 'admin'
    });

    await client.query("COMMIT");
    res.json({ success: true, message: "Purchase updated successfully", data: record });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[Purchase] update error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};

const deletePurchase = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { id } = req.params;
    const result = await client.query("UPDATE purchases SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *", [id]);
    if (!result.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Purchase not found" });
    }

    const deletedRecord = result.rows[0];
    await reverseInventoryMovement(client, deletedRecord.items, -1, {});
    
    await logHistory({
      client,
      module_name: 'Inventory',
      action_type: 'DELETE',
      record_id: id,
      title: `Deleted Purchase: ${deletedRecord.purchase_no}`,
      description: `Purchase ${deletedRecord.purchase_no} removed. Inventory restored.`,
      changed_data: deletedRecord,
      user_name: 'admin'
    });

    await client.query("COMMIT");
    res.json({ success: true, message: "Purchase deleted successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[Purchase] delete error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};

const getStockList = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM stock_items
       ORDER BY item_name ASC, id ASC`
    );
    res.json({ success: true, data: result.rows.map(mapStockRow) });
  } catch (err) {
    console.error("[Stock] getAll error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

const createStockItem = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const payload = buildStockPayload(req.body);
    if (!payload.itemName) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Item name is required" });
    }

    const itemRow = await resolveCatalogItem(client, payload, { createIfMissing: true });
    const existingStockRow = await resolveStockRow(client, payload, itemRow);
    const nextStock = toNumber(payload.currentStock, existingStockRow?.current_stock || 0);
    const savedStockRow = await saveStockRow({
      client,
      item: payload,
      itemRow,
      existingStockRow,
      nextStock,
      transactionDate: { lastPurchaseDate: req.body.lastPurchaseDate || new Date() },
      supplierId: payload.supplierId,
      supplierName: payload.supplierName,
    });

    await syncItemStock(client, itemRow, nextStock, payload, savedStockRow);

    await logHistory({
      client,
      module_name: 'Inventory',
      action_type: existingStockRow ? 'UPDATE' : 'CREATE',
      record_id: savedStockRow.id,
      title: `${existingStockRow ? 'Updated' : 'Created'} Stock Item: ${savedStockRow.item_name}`,
      description: `Stock level for ${savedStockRow.item_name} is now ${nextStock}.`,
      changed_data: savedStockRow,
      user_name: 'admin'
    });

    await client.query("COMMIT");
    res.status(existingStockRow ? 200 : 201).json({
      success: true,
      message: existingStockRow ? "Stock item updated successfully" : "Stock item created successfully",
      data: mapStockRow(savedStockRow),
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[Stock] create error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};

const updateStockItem = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { id } = req.params;
    const existingResult = await client.query("SELECT * FROM stock_items WHERE id = $1 LIMIT 1", [id]);
    if (!existingResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Stock item not found" });
    }

    const existingStockRow = existingResult.rows[0];
    const payload = {
      ...buildStockPayload(req.body), stock_item_id: existingStockRow.id,
      item_id: existingStockRow.item_id,
      itemName: buildStockPayload(req.body).itemName || existingStockRow.item_name,
      itemCode: buildStockPayload(req.body).itemCode || existingStockRow.item_code,
    };
    const itemRow = await resolveCatalogItem(client, payload, { createIfMissing: true });
    const nextStock = payload.currentStock !== undefined && payload.currentStock !== null
        ? toNumber(payload.currentStock, existingStockRow.current_stock)
        : toNumber(existingStockRow.current_stock, 0);

    const savedStockRow = await saveStockRow({
      client, item: payload, itemRow, existingStockRow, nextStock,
      transactionDate: {
        lastPurchaseDate: req.body.lastPurchaseDate || existingStockRow.last_purchase_date,
        lastSaleDate: req.body.lastSaleDate || existingStockRow.last_sale_date,
      },
      supplierId: payload.supplierId || existingStockRow.supplier_id,
      supplierName: payload.supplierName || existingStockRow.supplier_name,
    });

    if (itemRow) {
      await syncItemStock(client, itemRow, nextStock, payload, savedStockRow);
    }

    await logHistory({
      client,
      module_name: 'Inventory',
      action_type: 'UPDATE',
      record_id: savedStockRow.id,
      title: `Updated Stock Item: ${savedStockRow.item_name}`,
      description: `Item details for ${savedStockRow.item_name} modified. Stock: ${nextStock}`,
      changed_data: savedStockRow,
      user_name: 'admin'
    });

    await client.query("COMMIT");
    res.json({ success: true, message: "Stock item updated successfully", data: mapStockRow(savedStockRow) });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[Stock] update error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};

const deleteStockItem = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { id } = req.params;
    const result = await client.query("DELETE FROM stock_items WHERE id = $1 RETURNING *", [id]);
    if (!result.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Stock item not found" });
    }

    const deletedRecord = result.rows[0];
    if (deletedRecord.item_id) {
      await client.query(
        "UPDATE items SET stock = 0, status = COALESCE(status, 'Active'), updated_at = NOW() WHERE id = $1",
        [deletedRecord.item_id]
      );
    }

    await logHistory({
      client,
      module_name: 'Inventory',
      action_type: 'DELETE',
      record_id: id,
      title: `Deleted Stock Item: ${deletedRecord.item_name}`,
      description: `Stock record for ${deletedRecord.item_name} removed. Catalog item reset.`,
      changed_data: deletedRecord,
      user_name: 'admin'
    });

    await client.query("COMMIT");
    res.json({ success: true, message: "Stock item deleted successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[Stock] delete error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};

module.exports = {
  getAll,
  create,
  remove,
  updateCash,
  getAllAdjustments,
  createAdjustment,
  updateAdjustment,
  deleteAdjustment,
  getAllSales,
  createSale,
  updateSale,
  deleteSale,
  getNextSaleNo,
  getAllPurchases,
  createPurchase,
  updatePurchase,
  deletePurchase,
  getNextPurchaseNo,
  getStockList,
  createStockItem,
  updateStockItem,
  deleteStockItem,
};
