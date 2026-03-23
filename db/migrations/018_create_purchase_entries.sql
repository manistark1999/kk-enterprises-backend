-- 018_create_purchase_entries.sql
-- Ensure robust purchase transaction management (IF NOT EXISTS for existing 'purchases' table)

-- This ensures consistency between 'purchases' or 'purchase_entries' naming.
-- Project normally uses 'purchases' table as per 009.
-- We will follow that or create it if missing in backend logic.

CREATE TABLE IF NOT EXISTS purchases (
  id SERIAL PRIMARY KEY,
  purchase_no VARCHAR(50) UNIQUE NOT NULL,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  supplier_name VARCHAR(150),
  items_json JSONB DEFAULT '[]'::jsonb, -- Legacy support
  subtotal NUMERIC(14,2) DEFAULT 0,
  total_gst NUMERIC(14,2) DEFAULT 0,
  discount NUMERIC(14,2) DEFAULT 0,
  grand_total NUMERIC(14,2) DEFAULT 0,
  payment_mode VARCHAR(50) DEFAULT 'Cash',
  status VARCHAR(30) DEFAULT 'Received', -- 'Pending', 'Received', 'Cancelled'
  notes TEXT,
  invoice_no VARCHAR(80),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_purchases_purchase_no ON purchases(purchase_no);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier_id ON purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchases_purchase_date ON purchases(purchase_date);
