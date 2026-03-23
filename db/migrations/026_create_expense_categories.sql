-- 026_create_expense_categories.sql
-- Master table for classifying expenses

CREATE TABLE IF NOT EXISTS expense_categories (
  id SERIAL PRIMARY KEY,
  category_name VARCHAR(150) UNIQUE NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'Active', -- 'Active', 'Inactive'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed defaults
INSERT INTO expense_categories (category_name, description) VALUES 
('Rent', 'Building Rent'),
('Electricity Bill', 'Monthly Utility'),
('Staff Salary', 'Salary to employees'),
('Office Supplies', 'Stationary and consumables'),
('Misc Fees', 'Other office related expenses')
ON CONFLICT (category_name) DO NOTHING;
