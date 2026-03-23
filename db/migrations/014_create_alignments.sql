CREATE TABLE IF NOT EXISTS alignment_entries (
  id SERIAL PRIMARY KEY,
  entry_no VARCHAR(50) UNIQUE NOT NULL,
  entry_date DATE NOT NULL,
  vehicle_no VARCHAR(30) NOT NULL,
  vehicle_make VARCHAR(120),
  customer_name VARCHAR(150),
  alignment_type VARCHAR(50),
  technician VARCHAR(150),
  amount NUMERIC(14,2) DEFAULT 0,
  notes TEXT,
  status VARCHAR(30) DEFAULT 'Pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
