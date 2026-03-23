CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  role_name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  permissions JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO roles (role_name, description, permissions) 
VALUES ('admin', 'System Administrator', '["all"]')
ON CONFLICT (role_name) DO NOTHING;

INSERT INTO roles (role_name, description, permissions) 
VALUES ('manager', 'Workshop Manager', '["view_dashboard", "manage_jobs"]')
ON CONFLICT (role_name) DO NOTHING;

INSERT INTO roles (role_name, description, permissions) 
VALUES ('mechanic', 'Service Mechanic', '["view_jobs", "update_status"]')
ON CONFLICT (role_name) DO NOTHING;
