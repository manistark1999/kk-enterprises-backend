CREATE TABLE IF NOT EXISTS bank_accounts (
  id SERIAL PRIMARY KEY,
  account_name VARCHAR(150),
  bank_name VARCHAR(150) NOT NULL,
  account_number VARCHAR(60),
  account_holder_name VARCHAR(150),
  ifsc_code VARCHAR(30),
  branch_name VARCHAR(150),
  account_type VARCHAR(40) DEFAULT 'Current',
  opening_balance NUMERIC(14,2) DEFAULT 0,
  current_balance NUMERIC(14,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  payment_no VARCHAR(50) UNIQUE NOT NULL,
  payment_date DATE NOT NULL,
  customer_id INTEGER,
  customer_name VARCHAR(150),
  jobcard_id INTEGER,
  jobcard_no VARCHAR(50),
  bill_id INTEGER,
  bill_no VARCHAR(50),
  payment_type VARCHAR(80),
  payment_mode VARCHAR(50),
  bank_account_id INTEGER REFERENCES bank_accounts(id) ON DELETE SET NULL,
  bank_account_name VARCHAR(150),
  reference_no VARCHAR(100),
  amount NUMERIC(14,2) DEFAULT 0,
  remarks TEXT,
  status VARCHAR(30) DEFAULT 'Completed',
  created_by VARCHAR(120) DEFAULT 'system',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS receipts (
  id SERIAL PRIMARY KEY,
  receipt_no VARCHAR(50) UNIQUE NOT NULL,
  receipt_date DATE NOT NULL,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  customer_name VARCHAR(150),
  customer_phone VARCHAR(30),
  labour_bill_id INTEGER,
  labour_bill_no VARCHAR(50),
  jobcard_id INTEGER,
  jobcard_no VARCHAR(50),
  description TEXT,
  amount NUMERIC(14,2) DEFAULT 0,
  payment_mode VARCHAR(50),
  bank_id INTEGER REFERENCES bank_accounts(id) ON DELETE SET NULL,
  bank_name VARCHAR(150),
  reference_no VARCHAR(100),
  status VARCHAR(30) DEFAULT 'Received',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  expense_no VARCHAR(50) UNIQUE NOT NULL,
  expense_date DATE NOT NULL,
  category VARCHAR(100),
  description TEXT,
  amount NUMERIC(14,2) DEFAULT 0,
  payment_mode VARCHAR(50),
  reference_no VARCHAR(100),
  status VARCHAR(30) DEFAULT 'Paid',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cash_entries (
  id SERIAL PRIMARY KEY,
  entry_no VARCHAR(50) UNIQUE,
  entry_date DATE NOT NULL,
  entry_time VARCHAR(20),
  transaction_type VARCHAR(30),
  reference_no VARCHAR(100),
  description TEXT,
  amount NUMERIC(14,2) DEFAULT 0,
  payment_type VARCHAR(50),
  notes TEXT,
  handled_by VARCHAR(120),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS financial_years (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT false,
  status VARCHAR(20) DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS salary_records (
  id SERIAL PRIMARY KEY,
  salary_no VARCHAR(50) UNIQUE NOT NULL,
  staff_id INTEGER REFERENCES staff(id) ON DELETE SET NULL,
  staff_name VARCHAR(150),
  month VARCHAR(20),
  year INTEGER,
  basic_salary NUMERIC(14,2) DEFAULT 0,
  allowances NUMERIC(14,2) DEFAULT 0,
  deductions NUMERIC(14,2) DEFAULT 0,
  net_salary NUMERIC(14,2) DEFAULT 0,
  payment_mode VARCHAR(50),
  payment_date DATE,
  status VARCHAR(30) DEFAULT 'Paid',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff_advances (
  id SERIAL PRIMARY KEY,
  advance_no VARCHAR(50) UNIQUE NOT NULL,
  staff_id INTEGER REFERENCES staff(id) ON DELETE CASCADE,
  staff_name VARCHAR(150),
  advance_date DATE,
  amount NUMERIC(14,2) DEFAULT 0,
  reason TEXT,
  repayment_type VARCHAR(50),
  repayment_amount NUMERIC(14,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
