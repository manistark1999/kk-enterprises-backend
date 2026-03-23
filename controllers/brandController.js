const pool = require('../config/db');
const { logHistory } = require('../utils/history');

/**
 * Get all brands
 */
const getAllBrands = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM public.brands WHERE is_deleted = false ORDER BY id DESC');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[Brand] getAll error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Create a new brand
 */
const createBrand = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { name, manufacturer, category, country, description, status } = req.body;
    
    if (!name) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Brand name is required' });
    }
    
    // Duplicate check
    const dupBrand = await client.query('SELECT id FROM brands WHERE LOWER(name) = LOWER($1)', [name]);
    if (dupBrand.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: 'Brand with this name already exists' });
    }

    const result = await client.query(
      `INSERT INTO brands (name, manufacturer, category, country, description, status) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, manufacturer || null, category || null, country || null, description || null, status || 'Active']
    );
    
    const record = result.rows[0];
    
    await logHistory({
      client,
      module_name: 'Brand',
      action_type: 'CREATE',
      record_id: record.id,
      title: `Created Brand: ${record.name}`,
      description: `New brand ${record.name} added to master.`,
      changed_data: record,
      user_name: 'admin'
    });

    await client.query('COMMIT');
    res.status(201).json({ success: true, message: 'Brand created successfully', data: record });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Brand] create error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};

/**
 * Update a brand
 */
const updateBrand = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const { name, manufacturer, category, country, description, status } = req.body;
    
    if (name) {
      const dupB = await client.query('SELECT id FROM brands WHERE LOWER(name) = LOWER($1) AND id != $2', [name, id]);
      if (dupB.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ success: false, message: 'Another brand already has this name' });
      }
    }

    const result = await client.query(
      `UPDATE brands SET name=$1, manufacturer=$2, category=$3, country=$4, description=$5, status=$6, updated_at=CURRENT_TIMESTAMP 
       WHERE id=$7 RETURNING *`,
      [name, manufacturer || null, category || null, country || null, description || null, status || 'Active', id]
    );

    if (!result.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Brand not found' });
    }

    const record = result.rows[0];

    await logHistory({
      client,
      module_name: 'Brand',
      action_type: 'UPDATE',
      record_id: record.id,
      title: `Updated Brand: ${record.name}`,
      description: `Brand details for ${record.name} were modified.`,
      changed_data: record,
      user_name: 'admin'
    });

    await client.query('COMMIT');
    res.json({ success: true, message: 'Brand updated successfully', data: record });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Brand] update error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};

/**
 * Delete a brand
 */
const removeBrand = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    
    const check = await client.query('SELECT name FROM brands WHERE id=$1', [id]);
    if (!check.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Brand not found' });
    }
    
    const brandName = check.rows[0].name;

    await client.query('UPDATE public.brands SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);

    await logHistory({
      client,
      module_name: 'Brand',
      action_type: 'DELETE',
      record_id: id,
      title: `Deleted Brand: ${brandName}`,
      description: `Brand ${brandName} was removed from the system.`,
      changed_data: check.rows[0],
      user_name: 'admin'
    });

    await client.query('COMMIT');
    res.json({ success: true, message: 'Brand deleted successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Brand] delete error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};

module.exports = { getAllBrands, createBrand, updateBrand, removeBrand };
