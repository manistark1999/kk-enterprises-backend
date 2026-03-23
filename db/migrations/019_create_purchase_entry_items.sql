-- 019_create_purchase_entry_items.sql
-- Normalized items for every purchase transaction

CREATE TABLE IF NOT EXISTS purchase_items (
  id SERIAL PRIMARY KEY,
  purchase_id INTEGER REFERENCES purchases(id) ON DELETE CASCADE,
  item_id INTEGER, -- Reference to item in items catalog
  item_name VARCHAR(150),
  quantity NUMERIC(14,2) DEFAULT 1,
  rate NUMERIC(14,2) DEFAULT 0,
  gst_percent NUMERIC(6,2) DEFAULT 0,
  gst_amount NUMERIC(14,2) DEFAULT 0,
  amount NUMERIC(14,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_item_id ON purchase_items(item_id);
