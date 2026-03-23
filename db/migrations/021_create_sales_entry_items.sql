-- 021_create_sales_entry_items.sql
-- Normalized items for every sales transaction (Spare Parts, Accessories, etc.)

CREATE TABLE IF NOT EXISTS sale_items (
  id SERIAL PRIMARY KEY,
  sale_id INTEGER REFERENCES sales(id) ON DELETE CASCADE,
  item_id INTEGER, -- Reference to items catalog
  item_name VARCHAR(150),
  quantity NUMERIC(14,2) DEFAULT 1,
  rate NUMERIC(14,2) DEFAULT 0,
  gst_percent NUMERIC(6,2) DEFAULT 0,
  gst_amount NUMERIC(14,2) DEFAULT 0,
  amount NUMERIC(14,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_item_id ON sale_items(item_id);
