const toNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const normalizeItemName = (item) =>
  (item?.itemName || item?.item_name || item?.name || "").trim();

const deriveStockStatus = (currentStock, minStock = 0, maxStock = 0) => {
  if (currentStock <= 0) return "Out of Stock";
  if (currentStock < minStock) return "Low Stock";
  if (maxStock > 0 && currentStock > maxStock) return "Overstocked";
  return "In Stock";
};

const resolveCatalogItem = async (client, item, { createIfMissing = false } = {}) => {
  const explicitItemId =
    item?.item_id || item?.itemId || item?.catalog_item_id || item?.catalogItemId || null;
  const itemName = normalizeItemName(item);

  if (explicitItemId) {
    const byId = await client.query("SELECT * FROM items WHERE id = $1 LIMIT 1", [
      explicitItemId,
    ]);
    if (byId.rows.length) {
      return byId.rows[0];
    }
  }

  if (itemName) {
    const byName = await client.query(
      "SELECT * FROM items WHERE LOWER(name) = LOWER($1) LIMIT 1",
      [itemName]
    );
    if (byName.rows.length) {
      return byName.rows[0];
    }
  }

  if (!createIfMissing || !itemName) {
    return null;
  }

  const created = await client.query(
    `INSERT INTO items (
      name, type, category, brand, part_number, unit, description,
      purchase_price, selling_price, gst_rate, stock, min_stock, status
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
    RETURNING *`,
    [
      itemName,
      item?.type || "Item",
      item?.category || null,
      item?.brand || null,
      item?.itemCode || item?.item_code || item?.part_number || null,
      item?.unit || "Nos",
      item?.description || null,
      toNumber(item?.purchase_price ?? item?.purchasePrice ?? item?.rate, 0),
      toNumber(item?.selling_price ?? item?.sellingPrice ?? item?.rate, 0),
      toNumber(item?.gst ?? item?.gst_rate ?? item?.gstRate, 0),
      0,
      toNumber(item?.min_stock ?? item?.minStock ?? item?.reorderLevel, 0),
      item?.status || "Active",
    ]
  );

  return created.rows[0];
};

const resolveStockRow = async (client, item, itemRow) => {
  const explicitStockItemId = item?.stock_item_id || item?.stockItemId || null;
  const itemName = normalizeItemName(item);

  if (explicitStockItemId) {
    const byId = await client.query(
      "SELECT * FROM stock_items WHERE id = $1 LIMIT 1",
      [explicitStockItemId]
    );
    if (byId.rows.length) {
      return byId.rows[0];
    }
  }

  if (itemRow?.id) {
    const byItemId = await client.query(
      "SELECT * FROM stock_items WHERE item_id = $1 LIMIT 1",
      [itemRow.id]
    );
    if (byItemId.rows.length) {
      return byItemId.rows[0];
    }
  }

  if (itemName) {
    const byName = await client.query(
      "SELECT * FROM stock_items WHERE LOWER(item_name) = LOWER($1) LIMIT 1",
      [itemName]
    );
    if (byName.rows.length) {
      return byName.rows[0];
    }
  }

  return null;
};

const saveStockRow = async ({
  client,
  item,
  itemRow,
  existingStockRow,
  nextStock,
  transactionDate,
  supplierId,
  supplierName,
}) => {
  const itemName = normalizeItemName(item) || itemRow?.name;
  const minStock = toNumber(
    item?.min_stock ??
      item?.minStock ??
      existingStockRow?.min_stock ??
      itemRow?.min_stock,
    0
  );
  const maxStock = toNumber(
    item?.max_stock ??
      item?.maxStock ??
      existingStockRow?.max_stock ??
      Math.max(minStock, nextStock),
    Math.max(minStock, nextStock)
  );
  const reorderLevel = toNumber(
    item?.reorder_level ??
      item?.reorderLevel ??
      existingStockRow?.reorder_level ??
      itemRow?.min_stock ??
      minStock,
    minStock
  );
  const purchasePrice = toNumber(
    item?.purchase_price ??
      item?.purchasePrice ??
      item?.unit_cost ??
      existingStockRow?.purchase_price ??
      itemRow?.purchase_price ??
      item?.rate,
    0
  );
  const sellingPrice = toNumber(
    item?.selling_price ??
      item?.sellingPrice ??
      existingStockRow?.selling_price ??
      itemRow?.selling_price ??
      item?.rate,
    purchasePrice
  );
  const status = deriveStockStatus(nextStock, minStock, maxStock);

  if (existingStockRow?.id) {
    const updated = await client.query(
      `UPDATE stock_items
       SET item_id = COALESCE($1, item_id),
           item_code = COALESCE($2, item_code),
           item_name = COALESCE($3, item_name),
           category = COALESCE($4, category),
           brand = COALESCE($5, brand),
           supplier_id = COALESCE($6, supplier_id),
           supplier_name = COALESCE($7, supplier_name),
           location = COALESCE($8, location),
           current_stock = $9,
           min_stock = $10,
           max_stock = $11,
           reorder_level = $12,
           unit = COALESCE($13, unit),
           purchase_price = $14,
           selling_price = $15,
           status = $16,
           last_purchase_date = COALESCE($17, last_purchase_date),
           last_sale_date = COALESCE($18, last_sale_date),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $19
       RETURNING *`,
      [
        itemRow?.id || null,
        item?.itemCode || item?.item_code || itemRow?.part_number || null,
        itemName,
        item?.category || itemRow?.category || null,
        item?.brand || itemRow?.brand || null,
        supplierId || null,
        supplierName || null,
        item?.location || existingStockRow.location || null,
        nextStock,
        minStock,
        maxStock,
        reorderLevel,
        item?.unit || itemRow?.unit || existingStockRow.unit || "Nos",
        purchasePrice,
        sellingPrice,
        status,
        transactionDate?.lastPurchaseDate || null,
        transactionDate?.lastSaleDate || null,
        existingStockRow.id,
      ]
    );

    return updated.rows[0];
  }

  const inserted = await client.query(
    `INSERT INTO stock_items (
      item_id, item_code, item_name, category, brand, supplier_id, supplier_name,
      location, current_stock, min_stock, max_stock, reorder_level, unit,
      purchase_price, selling_price, status, last_purchase_date, last_sale_date
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
    RETURNING *`,
    [
      itemRow?.id || null,
      item?.itemCode || item?.item_code || itemRow?.part_number || null,
      itemName,
      item?.category || itemRow?.category || null,
      item?.brand || itemRow?.brand || null,
      supplierId || null,
      supplierName || null,
      item?.location || null,
      nextStock,
      minStock,
      maxStock,
      reorderLevel,
      item?.unit || itemRow?.unit || "Nos",
      purchasePrice,
      sellingPrice,
      status,
      transactionDate?.lastPurchaseDate || null,
      transactionDate?.lastSaleDate || null,
    ]
  );

  return inserted.rows[0];
};

const syncItemStock = async (client, itemRow, nextStock, item, stockRow) => {
  if (!itemRow?.id) return null;

  const updated = await client.query(
    `UPDATE items
     SET category = COALESCE($1, category),
         brand = COALESCE($2, brand),
         part_number = COALESCE($3, part_number),
         unit = COALESCE($4, unit),
         description = COALESCE($5, description),
         purchase_price = $6,
         selling_price = $7,
         gst_rate = $8,
         stock = $9,
         min_stock = $10,
         status = COALESCE($11, status),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $12
     RETURNING *`,
    [
      item?.category || itemRow.category || stockRow?.category || null,
      item?.brand || itemRow.brand || stockRow?.brand || null,
      item?.itemCode || item?.item_code || itemRow.part_number || null,
      item?.unit || itemRow.unit || stockRow?.unit || "Nos",
      item?.description || itemRow.description || null,
      toNumber(
        item?.purchase_price ?? item?.purchasePrice ?? stockRow?.purchase_price ?? itemRow.purchase_price,
        0
      ),
      toNumber(
        item?.selling_price ?? item?.sellingPrice ?? stockRow?.selling_price ?? itemRow.selling_price,
        0
      ),
      toNumber(item?.gst ?? item?.gst_rate ?? item?.gstRate ?? itemRow.gst_rate, 0),
      nextStock,
      toNumber(item?.min_stock ?? item?.minStock ?? stockRow?.min_stock ?? itemRow.min_stock, 0),
      item?.status || itemRow.status || "Active",
      itemRow.id,
    ]
  );

  return updated.rows[0];
};

const recordStockMovement = async ({
  client,
  stock_item_id,
  item_id,
  item_name,
  movement_date,
  movement_type,
  direction,
  quantity,
  previous_stock,
  new_stock,
  reference_no,
  reference_id,
  user_name = "admin",
  notes = "",
}) => {
  return client.query(
    `INSERT INTO stock_movements (
      stock_item_id, item_id, item_name, movement_date, movement_type,
      direction, quantity, previous_stock, new_stock, reference_no,
      reference_id, user_name, notes
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [
      stock_item_id,
      item_id,
      item_name,
      movement_date || new Date(),
      movement_type,
      direction,
      quantity,
      previous_stock,
      new_stock,
      reference_no,
      reference_id,
      user_name,
      notes,
    ]
  );
};

const applyInventoryMovement = async (
  client,
  items,
  {
    direction,
    transactionDate,
    supplierId = null,
    supplierName = null,
    createMissingItems = false,
    movementType = "OTHER",
    referenceNo = null,
    referenceId = null,
  }
) => {
  const results = [];

  for (const item of items || []) {
    const itemName = normalizeItemName(item);
    const quantity = toNumber(item?.quantity ?? item?.qty, 0);

    if (!itemName || quantity <= 0) {
      continue;
    }

    const itemRow = await resolveCatalogItem(client, item, {
      createIfMissing: createMissingItems && direction > 0,
    });

    if (!itemRow) {
      continue; // Skip if item doesn't exist and we aren't creating it
    }

    // CRITICAL: Only 'Item' type should affect inventory. 'Service' type represents labor/etc.
    if (itemRow.type !== 'Item') {
      continue;
    }

    const stockRow = await resolveStockRow(client, item, itemRow);
    const previousStock = toNumber(stockRow?.current_stock ?? itemRow.stock, 0);
    const nextStock = previousStock + direction * quantity;

    // Validation removed as per user request to allow negative stock

    const savedStockRow = await saveStockRow({
      client,
      item,
      itemRow,
      existingStockRow: stockRow,
      nextStock,
      transactionDate,
      supplierId,
      supplierName,
    });

    const savedItemRow = await syncItemStock(
      client,
      itemRow,
      nextStock,
      item,
      savedStockRow
    );

    // Record Central Ledger Movement
    await recordStockMovement({
      client,
      stock_item_id: savedStockRow.id,
      item_id: savedItemRow.id,
      item_name: itemName,
      movement_date:
        transactionDate?.lastPurchaseDate ||
        transactionDate?.lastSaleDate ||
        new Date(),
      movement_type: movementType,
      direction,
      quantity,
      previous_stock: previousStock,
      new_stock: nextStock,
      reference_no: referenceNo,
      reference_id: referenceId,
    });

    results.push({
      itemName,
      previousStock,
      nextStock,
      stockRow: savedStockRow,
      itemRow: savedItemRow,
    });
  }

  return results;
};

module.exports = {
  applyInventoryMovement,
  recordStockMovement,
  deriveStockStatus,
  normalizeItemName,
  resolveCatalogItem,
  resolveStockRow,
  saveStockRow,
  syncItemStock,
  toNumber,
};
