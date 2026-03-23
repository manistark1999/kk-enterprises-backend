const pool = require('../db');
const { logHistory } = require('../utils/history');

const getCustomers = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM public.customers WHERE is_deleted = false ORDER BY id DESC'
    );

    res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch customers',
      error: error.message,
    });
  }
};

const createCustomer = async (req, res) => {
  try {
    const {
      customer_name,
      phone,
      email,
      contact_person,
      alternate_phone,
      customer_code,
      address,
      city,
      state,
      pincode,
      gst_no,
      is_active
    } = req.body;

    if (!customer_name || !phone) {
      return res.status(400).json({
        success: false,
        message: 'customer_name and phone are required',
      });
    }

    const result = await pool.query(
      `INSERT INTO public.customers
      (customer_code, customer_name, contact_person, phone, alternate_phone, email, address, city, state, pincode, gst_no, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        customer_code || null,
        customer_name,
        contact_person || null,
        phone,
        alternate_phone || null,
        email || null,
        address || null,
        city || null,
        state || null,
        pincode || null,
        gst_no || null,
        is_active ? 'active' : 'inactive'
      ]
    );

    const newCustomer = result.rows[0];

    // Log to History
    await logHistory({
      module_name: 'Customer',
      action_type: 'CREATE',
      record_id: newCustomer.id,
      title: `Saved Customer: ${newCustomer.customer_name}`,
      description: `Phone: ${newCustomer.phone}`,
      changed_data: newCustomer
    });

    res.status(201).json({
      success: true,
      message: 'Customer saved successfully',
      data: newCustomer,
    });
  } catch (error) {
    console.error('Create customer error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save customer',
      error: error.message,
    });
  }
};

const updateCustomer = async (req, res) => {
  const { id } = req.params;
  try {
    const {
      customer_name,
      phone,
      email,
      contact_person,
      alternate_phone,
      customer_code,
      address,
      city,
      state,
      pincode,
      gst_no,
      is_active
    } = req.body;

    const result = await pool.query(
      `UPDATE public.customers
       SET customer_code = $1, customer_name = $2, contact_person = $3, phone = $4, alternate_phone = $5, 
           email = $6, address = $7, city = $8, state = $9, pincode = $10, gst_no = $11, status = $12, updated_at = CURRENT_TIMESTAMP
       WHERE id = $13
       RETURNING *`,
      [
        customer_code || null,
        customer_name,
        contact_person || null,
        phone,
        alternate_phone || null,
        email || null,
        address || null,
        city || null,
        state || null,
        pincode || null,
        gst_no || null,
        is_active ? 'active' : 'inactive',
        id
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const updatedCustomer = result.rows[0];

    // Log to History
    await logHistory({
      module_name: 'Customer',
      action_type: 'UPDATE',
      record_id: id,
      title: `Updated Customer: ${updatedCustomer.customer_name}`,
      description: `Changed details for customer ID ${id}`,
      changed_data: updatedCustomer
    });

    res.json({
      success: true,
      message: 'Customer updated successfully',
      data: updatedCustomer,
    });
  } catch (error) {
    console.error('Update customer error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update customer',
      error: error.message,
    });
  }
};

const deleteCustomer = async (req, res) => {
  const { id } = req.params;
  try {
    const checkResult = await pool.query('SELECT customer_name FROM public.customers WHERE id = $1', [id]);
    if (checkResult.rowCount === 0) {
       return res.status(404).json({ success: false, message: 'Customer not found' });
    }
    const customerName = checkResult.rows[0].customer_name;

    await pool.query('UPDATE public.customers SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);

    // Log to History
    await logHistory({
      module_name: 'Customer',
      action_type: 'DELETE',
      record_id: id,
      title: `Deleted Customer: ${customerName}`,
      description: `Customer ${customerName} was soft-deleted.`,
      changed_data: checkResult.rows[0]
    });

    res.json({
      success: true,
      message: 'Customer deleted successfully',
    });
  } catch (error) {
    console.error('Delete customer error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete customer',
      error: error.message,
    });
  }
};

const getSummary = async (req, res) => {
  try {
    const totalResult = await pool.query('SELECT COUNT(*) AS count FROM public.customers WHERE is_deleted = false');
    const activeResult = await pool.query(
      "SELECT COUNT(*) AS count FROM public.customers WHERE LOWER(status) = 'active' AND is_deleted = false"
    );
    const inactiveResult = await pool.query(
      "SELECT COUNT(*) AS count FROM public.customers WHERE LOWER(status) = 'inactive' AND is_deleted = false"
    );

    res.status(200).json({
      success: true,
      data: {
        total: parseInt(totalResult.rows[0].count),
        active: parseInt(activeResult.rows[0].count),
        inactive: parseInt(inactiveResult.rows[0].count),
        totalVehicles: 0,
      },
    });
  } catch (error) {
    console.error('Get summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch summary',
      error: error.message,
    });
  }
};

module.exports = {
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getSummary,
};
