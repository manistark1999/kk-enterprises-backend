-- 016_create_invoice_items.sql
-- Normalized tables for billing and job card items

CREATE TABLE IF NOT EXISTS labour_bill_items (
  id SERIAL PRIMARY KEY,
  bill_id INTEGER REFERENCES labour_bills(id) ON DELETE CASCADE,
  service_name VARCHAR(255) NOT NULL,
  description TEXT,
  quantity NUMERIC(14,2) DEFAULT 1,
  rate NUMERIC(14,2) DEFAULT 0,
  gst_percent NUMERIC(6,2) DEFAULT 0,
  gst_amount NUMERIC(14,2) DEFAULT 0,
  amount NUMERIC(14,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS job_card_items (
  id SERIAL PRIMARY KEY,
  job_card_id INTEGER REFERENCES jobcards(id) ON DELETE CASCADE,
  item_type VARCHAR(50) DEFAULT 'Service', -- 'Service' or 'Part'
  item_id INTEGER, -- Reference to items or service_items table
  description TEXT NOT NULL,
  quantity NUMERIC(14,2) DEFAULT 1,
  rate NUMERIC(14,2) DEFAULT 0,
  amount NUMERIC(14,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'Pending', -- 'Pending', 'In Progress', 'Done'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_labour_bill_items_bill_id ON labour_bill_items(bill_id);
CREATE INDEX IF NOT EXISTS idx_job_card_items_job_card_id ON job_card_items(job_card_id);
