-- 017_create_stock_movements.sql
-- Ledger to track all inventory IN/OUT actions

CREATE TABLE IF NOT EXISTS stock_movements (
  id SERIAL PRIMARY KEY,
  stock_item_id INTEGER REFERENCES stock_items(id) ON DELETE CASCADE,
  item_id INTEGER, -- Reference to items catalog
  item_name VARCHAR(150),
  movement_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  movement_type VARCHAR(50) NOT NULL, -- 'PURCHASE', 'SALE', 'ADJUSTMENT', 'REVERSAL'
  direction INTEGER NOT NULL, -- 1 for IN, -1 for OUT
  quantity NUMERIC(14,2) NOT NULL DEFAULT 0,
  previous_stock NUMERIC(14,2) DEFAULT 0,
  new_stock NUMERIC(14,2) DEFAULT 0,
  reference_no VARCHAR(100), -- Invoice No, Sale No, Adjustment No
  reference_id INTEGER, -- ID of the transaction record
  user_name VARCHAR(100) DEFAULT 'admin',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_stock_item_id ON stock_movements(stock_item_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_movement_type ON stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference_no ON stock_movements(reference_no);
CREATE INDEX IF NOT EXISTS idx_stock_movements_movement_date ON stock_movements(movement_date);
