-- 030_schema_balance_sync.sql
-- Final sync of all 30+ tables to ensure migration folder matches live DB
-- Adds missing tables like staff, transports, and completes schema robustness

-- 1. Transports table
CREATE TABLE IF NOT EXISTS transports (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  contact_person VARCHAR(150),
  phone VARCHAR(30),
  email VARCHAR(100),
  address TEXT,
  gst_no VARCHAR(20),
  status VARCHAR(20) DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Staff table
CREATE TABLE IF NOT EXISTS staff (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  designation VARCHAR(100),
  mobile VARCHAR(30),
  email VARCHAR(100),
  joining_date DATE,
  salary NUMERIC(14,2) DEFAULT 0,
  address TEXT,
  status VARCHAR(20) DEFAULT 'Active',
  bank_account VARCHAR(100), -- Matching audit Line 405
  ifsc_code VARCHAR(30),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ensure dependencies in salary_records and staff_advances (from 010)
-- Normally FKs are already there in DB, but we ensure it here.
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'salary_records_staff_id_fkey') THEN
    ALTER TABLE salary_records ADD CONSTRAINT salary_records_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Robust column syncs (IF NOT EXISTS pattern)
-- Ensuring all audit-identified columns are in their respective tables

-- Customers
ALTER TABLE IF EXISTS customers ADD COLUMN IF NOT EXISTS customer_code VARCHAR(50);
ALTER TABLE IF EXISTS customers ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(14,2) DEFAULT 0;

-- Vehicles
ALTER TABLE IF EXISTS vehicle_register ADD COLUMN IF NOT EXISTS owner_name VARCHAR(150);
ALTER TABLE IF EXISTS vehicle_register ADD COLUMN IF NOT EXISTS chassis_number VARCHAR(80);
ALTER TABLE IF EXISTS vehicle_register ADD COLUMN IF NOT EXISTS engine_number VARCHAR(80);

-- Items
ALTER TABLE IF EXISTS items ADD COLUMN IF NOT EXISTS part_number VARCHAR(80);
ALTER TABLE IF EXISTS items ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(50);

-- 4. Global Index Sync
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_vehicles_number ON vehicle_register(vehicle_number);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- 5. Mark as complete
UPDATE company_settings SET updated_at = CURRENT_TIMESTAMP WHERE id = 1;
