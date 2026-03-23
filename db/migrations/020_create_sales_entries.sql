-- 020_create_sales_entries.sql
-- Ensure robust sales transaction management

CREATE TABLE IF NOT EXISTS sales (
  id SERIAL PRIMARY KEY,
  sale_no VARCHAR(50) UNIQUE NOT NULL,
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  customer_name VARCHAR(150),
  customer_phone VARCHAR(30),
  items_json JSONB DEFAULT '[]'::jsonb, -- Legacy support
  subtotal NUMERIC(14,2) DEFAULT 0,
  total_gst NUMERIC(14,2) DEFAULT 0,
  discount NUMERIC(14,2) DEFAULT 0,
  grand_total NUMERIC(14,2) DEFAULT 0,
  payment_mode VARCHAR(50) DEFAULT 'Cash',
  status VARCHAR(30) DEFAULT 'Completed', -- 'Pending', 'Completed', 'Cancelled'
  vehicle_no VARCHAR(30),
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sales_sale_no ON sales(sale_no);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_sale_date ON sales(sale_date);
