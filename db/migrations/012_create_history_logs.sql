CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  table_name VARCHAR(100) NOT NULL,
  record_id VARCHAR(100),
  action VARCHAR(20) NOT NULL,
  changed_data JSONB DEFAULT '{}'::jsonb,
  performed_by VARCHAR(100) DEFAULT 'system',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS history (
  id SERIAL PRIMARY KEY,
  module_name VARCHAR(100) NOT NULL,
  action_type VARCHAR(20) NOT NULL,
  record_id VARCHAR(100),
  title VARCHAR(255),
  description TEXT,
  changed_data JSONB DEFAULT '{}'::jsonb,
  user_name VARCHAR(100) DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
