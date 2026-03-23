-- 022_create_vehicle_service_history.sql
-- Tracking summarized service history for quick lookup per vehicle

CREATE TABLE IF NOT EXISTS vehicle_service_history (
  id SERIAL PRIMARY KEY,
  vehicle_id INTEGER REFERENCES vehicle_register(id) ON DELETE CASCADE,
  vehicle_number VARCHAR(30) NOT NULL,
  service_date DATE NOT NULL,
  refer_type VARCHAR(50), -- 'JOBCARD', 'LABOUR_BILL', 'ALIGNMENT'
  refer_no VARCHAR(100), -- Bill No, JobCard No, Entry No
  description TEXT,
  total_amount NUMERIC(14,2) DEFAULT 0,
  technician_name VARCHAR(150),
  km_reading VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vsh_vehicle_id ON vehicle_service_history(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vsh_vehicle_number ON vehicle_service_history(vehicle_number);
CREATE INDEX IF NOT EXISTS idx_vsh_service_date ON vehicle_service_history(service_date);
