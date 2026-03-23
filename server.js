const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const pool = require('./db');
const path = require('path');

dotenv.config({ path: './.env' });

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Body logging middleware - logs all incoming request bodies
app.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    console.log(`[BODY] ${req.method} ${req.url}:`, JSON.stringify(req.body, null, 2));
  }
  next();
});

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[API] ${req.method} ${req.url} ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Import Routes
const customerRoutes = require('./routes/customerRoutes');
const jobcardRoutes = require('./routes/jobcardRoutes');
const alignmentRoutes = require('./routes/alignmentRoutes');
const auditRoutes = require('./routes/auditRoutes');
const authRoutes = require('./routes/authRoutes');
const bankAccountRoutes = require('./routes/bankAccountRoutes');
const brandRoutes = require('./routes/brandRoutes');
const companyRoutes = require('./routes/companyRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const estimationRoutes = require('./routes/estimationRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const financialYearRoutes = require('./routes/financialYearRoutes');
const hrRoutes = require('./routes/hrRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const itemRoutes = require('./routes/itemRoutes');
const labourBillRoutes = require('./routes/labourBillRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const receiptRoutes = require('./routes/receiptRoutes');
const staffRoutes = require('./routes/staffRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const transportRoutes = require('./routes/transportRoutes');
const vehicleMakeRoutes = require('./routes/vehicleMakeRoutes');
const vehicleRegistryRoutes = require('./routes/vehicleRegistryRoutes');
const workRoutes = require('./routes/workRoutes');
const bankTransactionRoutes = require('./routes/bankTransactionRoutes');

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'ok', timestamp: new Date() });
});

// Basic endpoint
app.get('/', (req, res) => {
  res.json({ success: true, message: 'Backend running successfully' });
});

// Database test endpoint
app.get('/api/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({
      success: true,
      message: 'Database connected successfully',
      time: result.rows[0],
    });
  } catch (error) {
    console.error('DB test error:', error);
    res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: error.message,
    });
  }
});

// Mount Routes
app.use('/api/customers', customerRoutes);
app.use('/api/jobcards', jobcardRoutes);
app.use('/api/alignments', alignmentRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/bank-accounts', bankAccountRoutes);
app.use('/api/brands', brandRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/estimations', estimationRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/financial-years', financialYearRoutes);
app.use('/api/hr', hrRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/labour-bills', labourBillRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/receipts', receiptRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/transports', transportRoutes);
app.use('/api/vehicle-makes', vehicleMakeRoutes);
app.use('/api/vehicle-registry', vehicleRegistryRoutes);
app.use('/api/work', workRoutes);
app.use('/api/bank-transactions', bankTransactionRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.url}`,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global server error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: err.message,
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
