const pool = require('../config/db');

const getDateCondition = (period, from, to, dateColumn = 'created_at') => {
  if (from && to) {
    return ` AND DATE(${dateColumn}) BETWEEN '${from}' AND '${to}'`;
  }
  switch (period) {
    case 'today':
      return ` AND DATE(${dateColumn}) = CURRENT_DATE`;
    case 'weekly':
      return ` AND ${dateColumn} >= date_trunc('week', CURRENT_DATE)`;
    case 'monthly':
      return ` AND ${dateColumn} >= date_trunc('month', CURRENT_DATE)`;
    case 'yearly':
      return ` AND ${dateColumn} >= date_trunc('year', CURRENT_DATE)`;
    default:
      return '';
  }
};

const getRevenueQuery = (period, from, to) => {
  if (from && to) {
    return `
      SELECT 
        to_char(bill_date, 'Mon DD') as label,
        SUM(grand_total) as value
      FROM labour_bills
      WHERE is_deleted = false AND DATE(bill_date) BETWEEN '${from}' AND '${to}'
      GROUP BY DATE(bill_date), to_char(bill_date, 'Mon DD')
      ORDER BY DATE(bill_date) ASC
    `;
  }
  
  switch (period) {
    case 'today':
      return `
        SELECT 
          to_char(created_at, 'HH24:00') as label,
          SUM(grand_total) as value
        FROM labour_bills
        WHERE is_deleted = false AND DATE(created_at) = CURRENT_DATE
        GROUP BY to_char(created_at, 'HH24:00')
        ORDER BY to_char(created_at, 'HH24:00') ASC
      `;
    case 'weekly':
      return `
        SELECT 
          to_char(bill_date, 'Dy') as label,
          SUM(grand_total) as value
        FROM labour_bills
        WHERE is_deleted = false AND bill_date >= date_trunc('week', CURRENT_DATE)
        GROUP BY DATE(bill_date), to_char(bill_date, 'Dy')
        ORDER BY DATE(bill_date) ASC
      `;
    case 'monthly':
      return `
        SELECT 
          to_char(DATE_TRUNC('week', bill_date), 'Mon DD') as label,
          SUM(grand_total) as value
        FROM labour_bills
        WHERE is_deleted = false AND bill_date >= date_trunc('month', CURRENT_DATE)
        GROUP BY DATE_TRUNC('week', bill_date)
        ORDER BY DATE_TRUNC('week', bill_date) ASC
      `;
    case 'yearly':
      return `
        SELECT 
          to_char(bill_date, 'Mon yyyy') as label,
          SUM(grand_total) as value
        FROM labour_bills
        WHERE is_deleted = false AND bill_date >= date_trunc('year', CURRENT_DATE)
        GROUP BY DATE_TRUNC('month', bill_date), to_char(bill_date, 'Mon yyyy')
        ORDER BY DATE_TRUNC('month', bill_date) ASC
      `;
    default:
      // Default to weekly if unspecified
      return `
        SELECT 
          to_char(bill_date, 'Dy') as label,
          SUM(grand_total) as value
        FROM labour_bills
        WHERE is_deleted = false AND bill_date >= date_trunc('week', CURRENT_DATE)
        GROUP BY DATE(bill_date), to_char(bill_date, 'Dy')
        ORDER BY DATE(bill_date) ASC
      `;
  }
};

// Dashboard overview stats from all tables
const getStats = async (req, res) => {
  const { period, from, to } = req.query;

  try {
    const jobcardsQuery = `SELECT COUNT(*) as count FROM jobcards WHERE is_deleted = false ${getDateCondition(period, from, to, 'created_at')}`;
    const labourBillsQuery = `SELECT COUNT(*) as count, COALESCE(SUM(grand_total), 0) as total FROM labour_bills WHERE is_deleted = false ${getDateCondition(period, from, to, 'bill_date')}`;
    const estimationsQuery = `SELECT COUNT(*) as count FROM estimations WHERE is_deleted = false ${getDateCondition(period, from, to, 'created_at')}`;
    const receiptsQuery = `SELECT COALESCE(SUM(amount), 0) as total FROM receipts WHERE is_deleted = false ${getDateCondition(period, from, to, 'receipt_date')}`;
    const staffQuery = "SELECT COUNT(*) as count FROM staff WHERE (status = 'Active' OR status IS NULL) AND is_deleted = false";
    const vehiclesQuery = `SELECT COUNT(*) as count FROM vehicle_register WHERE is_deleted = false ${getDateCondition(period, from, to, 'created_at')}`;
    const expensesQuery = `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE is_deleted = false ${getDateCondition(period, from, to, 'expense_date')}`;
    const salesQuery = `SELECT COUNT(*) as count, COALESCE(SUM(grand_total), 0) as total FROM sales WHERE is_deleted = false ${getDateCondition(period, from, to, 'sale_date')}`;
    const revenueChartQuery = getRevenueQuery(period, from, to);
    
    const [
      jobcards,
      labourBills,
      estimations,
      receipts,
      staff,
      vehicles,
      expenses,
      revenueChart,
      sales,
    ] = await Promise.all([
      pool.query(jobcardsQuery),
      pool.query(labourBillsQuery),
      pool.query(estimationsQuery),
      pool.query(receiptsQuery),
      pool.query(staffQuery),
      pool.query(vehiclesQuery),
      pool.query(expensesQuery),
      pool.query(revenueChartQuery),
      pool.query(salesQuery),
    ]);
    
    const chartData = (revenueChart.rows || []).map(row => ({
      label: row.label,
      value: parseFloat(row.value)
    }));

    res.json({
      success: true,
      data: {
        activeJobCards: parseInt(jobcards.rows[0].count),
        totalLabourBills: parseInt(labourBills.rows[0].count),
        totalLabourRevenue: parseFloat(labourBills.rows[0].total),
        totalSalesRevenue: parseFloat(sales.rows[0].total),
        totalSalesCount: parseInt(sales.rows[0].count),
        totalEstimations: parseInt(estimations.rows[0].count),
        totalReceipts: parseFloat(receipts.rows[0].total),
        totalExpenses: parseFloat(expenses.rows[0].total),
        activeStaff: parseInt(staff.rows[0].count),
        totalVehicles: parseInt(vehicles.rows[0].count),
        chartData: chartData,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getRecentActivity = async (req, res) => {
  try {
    const query = `
      SELECT id, module_name, action_type, record_id, title, description, user_name, created_at
      FROM history
      ORDER BY created_at DESC
      LIMIT 10
    `;
    const result = await pool.query(query);
    res.json({
      success: true,
      data: result.rows
    });
  } catch (err) {
    console.error('[Dashboard] getRecentActivity error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

const getStockAlerts = async (req, res) => {
  try {
    const query = `
      SELECT item_name as name, current_stock as current, min_stock as minimum,
             CASE 
                WHEN (current_stock <= (min_stock / 2)) OR current_stock <= 0 THEN 'Critical' 
                ELSE 'Warning' 
             END as status
      FROM stock_items
      WHERE current_stock <= min_stock AND status = 'Active'
      ORDER BY current_stock ASC
      LIMIT 5
    `;
    const result = await pool.query(query);
    res.json({
      success: true,
      data: result.rows.map(row => ({
        ...row,
        current: parseFloat(row.current || 0),
        minimum: parseFloat(row.minimum || 0)
      }))
    });
  } catch (err) {
    console.error('[Dashboard] getStockAlerts error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getStats, getRecentActivity, getStockAlerts };
