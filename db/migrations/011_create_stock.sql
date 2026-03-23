CREATE TABLE IF NOT EXISTS stock_items (
  id SERIAL PRIMARY KEY,
  item_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
  item_code VARCHAR(80),
  item_name VARCHAR(150) NOT NULL,
  category VARCHAR(100),
  brand VARCHAR(120),
  brand_id INTEGER,
  supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  supplier_name VARCHAR(150),
  location VARCHAR(100),
  current_stock NUMERIC(14,2) DEFAULT 0,
  min_stock NUMERIC(14,2) DEFAULT 0,
  max_stock NUMERIC(14,2) DEFAULT 0,
  reorder_level NUMERIC(14,2) DEFAULT 0,
  unit VARCHAR(50) DEFAULT 'Nos',
  purchase_price NUMERIC(14,2) DEFAULT 0,
  selling_price NUMERIC(14,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'Active',
  last_purchase_date DATE,
  last_sale_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stock_adjustments (
  id SERIAL PRIMARY KEY,
  adjustment_no VARCHAR(50),
  adjustment_date DATE NOT NULL,
  stock_item_id INTEGER REFERENCES stock_items(id) ON DELETE SET NULL,
  item_id INTEGER,
  item_code VARCHAR(80),
  item_name VARCHAR(150) NOT NULL,
  adjustment_type VARCHAR(20) NOT NULL,
  quantity NUMERIC(14,2) DEFAULT 0,
  previous_stock NUMERIC(14,2) DEFAULT 0,
  new_stock NUMERIC(14,2) DEFAULT 0,
  reason TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE VIEW stock AS
SELECT
  id, item_id, item_code, item_name, category, brand, supplier_id,
  supplier_name, location, current_stock, min_stock, max_stock, reorder_level,
  unit, purchase_price, selling_price, status, last_purchase_date, last_sale_date,
  created_at, updated_at
FROM stock_items;
