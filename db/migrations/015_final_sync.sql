-- Final database sync for all modules
-- Ensures all tables have consistent primary keys and timestamps

-- Users table robustness
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS role VARCHAR(30) DEFAULT 'admin';
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Active';
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Cash Entries table (missing from previous turn?)
CREATE TABLE IF NOT EXISTS cash_entries (
  id SERIAL PRIMARY KEY,
  entry_no VARCHAR(50) UNIQUE,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  entry_time TIME,
  transaction_type VARCHAR(20) DEFAULT 'Cash In', -- 'Cash In' or 'Cash Out'
  reference_no VARCHAR(100),
  description TEXT,
  amount DECIMAL(15, 2) DEFAULT 0,
  payment_type VARCHAR(50) DEFAULT 'Cash',
  notes TEXT,
  handled_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Expenses table
CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  expense_no VARCHAR(50) UNIQUE,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category VARCHAR(100),
  description TEXT,
  amount DECIMAL(15, 2) DEFAULT 0,
  payment_mode VARCHAR(50) DEFAULT 'Cash',
  reference_no VARCHAR(100),
  status VARCHAR(20) DEFAULT 'Paid',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ensure all tables have updated_at trigger functionality (if desired, or just manually in controllers)
-- We will follow the manual controller update pattern used in the project for simplicity.

-- Ensure history table is robust
ALTER TABLE IF EXISTS history ALTER COLUMN changed_data SET DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS history ADD COLUMN IF NOT EXISTS performed_by VARCHAR(100);

-- Table structure summary for Audit
-- 1. users
-- 2. customers
-- 3. suppliers
-- 4. vehicle_makes
-- 5. vehicle_models
-- 6. vehicle_register
-- 7. work_groups
-- 8. work_types
-- 9. service_items
-- 10. items
-- 11. job_cards
-- 12. estimation_bills
-- 13. labour_bills
-- 14. payments
-- 15. receipts
-- 16. purchase_orders
-- 17. sales_bills
-- 18. stock_items
-- 19. stock_adjustments
-- 20. cash_entries
-- 21. expenses
-- 22. history
