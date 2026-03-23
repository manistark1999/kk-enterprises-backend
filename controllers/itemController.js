const pool = require('../config/db');
const { logHistory } = require('../utils/history');

// ─── ITEMS / SERVICES ────────────────────────────────────────────────────────

const getAll = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM items ORDER BY created_at DESC');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[Item] getAll error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

const create = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { 
      name, type, category, brand, part_number, unit, hsn_code, 
      purchase_price, selling_price, gst_rate, stock, min_stock, status, description
    } = req.body;

    if (!name) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Item name is required' });
    }

    // Duplicate check for part_number
    if (part_number) {
        const dupPart = await client.query('SELECT id FROM items WHERE part_number = $1', [part_number]);
        if (dupPart.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ success: false, message: 'Item with this part number already exists' });
        }
    }

    const result = await client.query(
      `INSERT INTO items (
        name, type, category, brand, part_number, unit, hsn_code, 
        purchase_price, selling_price, gst_rate, stock, min_stock, status, description
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [
        name, type || 'Item', category || null, brand || null, part_number || null, unit || 'Piece', hsn_code || null, 
        purchase_price || 0, selling_price || 0, gst_rate || 18, stock || 0, min_stock || 0, status || 'Active', description || null
      ]
    );

    const record = result.rows[0];
    
    await logHistory({
      client,
      module_name: 'Inventory',
      action_type: 'CREATE',
      record_id: record.id,
      title: `Created Item: ${record.name}`,
      description: `${record.type} ${record.name} added to inventory.`,
      changed_data: record,
      user_name: 'admin'
    });

    await client.query('COMMIT');
    res.status(201).json({ success: true, message: 'Item created successfully', data: record });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Item] create error:', err.message);
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
      name, type, category, brand, part_number, unit, hsn_code, 
      purchase_price, selling_price, gst_rate, stock, min_stock, status, description
    } = req.body;

    if (part_number) {
        const dupPart = await client.query('SELECT id FROM items WHERE part_number = $1 AND id != $2', [part_number, id]);
        if (dupPart.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ success: false, message: 'Another item already has this part number' });
        }
    }

    const result = await client.query(
      `UPDATE items SET 
        name=$1, type=$2, category=$3, brand=$4, part_number=$5, unit=$6, hsn_code=$7, 
        purchase_price=$8, selling_price=$9, gst_rate=$10, stock=$11, min_stock=$12, 
        status=$13, description=$14, updated_at=CURRENT_TIMESTAMP
       WHERE id=$15 RETURNING *`,
      [
        name, type || 'Item', category || null, brand || null, part_number || null, unit || 'Piece', hsn_code || null, 
        purchase_price || 0, selling_price || 0, gst_rate || 18, stock || 0, min_stock || 0, status || 'Active', description || null, id
      ]
    );

    if (!result.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    const record = result.rows[0];
    
    await logHistory({
      client,
      module_name: 'Inventory',
      action_type: 'UPDATE',
      record_id: record.id,
      title: `Updated Item: ${record.name}`,
      description: `Inventory details for ${record.name} were modified.`,
      changed_data: record,
      user_name: 'admin'
    });

    await client.query('COMMIT');
    res.json({ success: true, message: 'Item updated successfully', data: record });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Item] update error:', err.message);
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
    
    const check = await client.query('SELECT name FROM items WHERE id=$1', [id]);
    if (!check.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Item not found' });
    }
    
    const itemName = check.rows[0].name;

    await client.query('DELETE FROM items WHERE id=$1', [id]);

    await logHistory({
      client,
      module_name: 'Inventory',
      action_type: 'DELETE',
      record_id: id,
      title: `Deleted Item: ${itemName}`,
      description: `Item ${itemName} was removed from inventory.`,
      changed_data: check.rows[0],
      user_name: 'admin'
    });

    await client.query('COMMIT');
    res.json({ success: true, message: 'Item deleted successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Item] delete error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};

module.exports = { getAll, create, update, remove };
