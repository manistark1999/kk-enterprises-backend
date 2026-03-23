-- 025_create_expenses.sql
-- Ensure expenses table is properly defined

CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  expense_no VARCHAR(50) UNIQUE,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category VARCHAR(100), -- Reference to expense_categories
  description TEXT,
  amount NUMERIC(15, 2) DEFAULT 0,
  payment_mode VARCHAR(50) DEFAULT 'Cash',
  reference_no VARCHAR(100),
  status VARCHAR(20) DEFAULT 'Paid', -- 'Paid', 'Pending', 'Cancelled'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_expenses_expense_no ON expenses(expense_no);
CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
