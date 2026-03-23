-- 024_create_activity_logs.sql
-- Table to store high-level user activity and system events

CREATE TABLE IF NOT EXISTS activity_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER, -- Reference to users if applicable
  user_name VARCHAR(150),
  module_name VARCHAR(100), -- 'DASHBOARD', 'BILLING', 'MASTERS'
  action_type VARCHAR(100), -- 'LOGOUT', 'LOGIN_FAILED', 'EXPORT_PDF'
  description TEXT,
  severity VARCHAR(20) DEFAULT 'INFO', -- 'INFO', 'WARN', 'ERROR', 'CRITICAL'
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_name ON activity_logs(user_name);
CREATE INDEX IF NOT EXISTS idx_activity_logs_module_name ON activity_logs(module_name);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
