CREATE TABLE IF NOT EXISTS work_groups (
  id SERIAL PRIMARY KEY,
  group_name VARCHAR(150),
  name VARCHAR(150),
  description TEXT,
  category VARCHAR(100) DEFAULT 'General',
  work_types JSONB DEFAULT '[]'::jsonb,
  work_types_arr JSONB DEFAULT '[]'::jsonb,
  status VARCHAR(20) DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS work_types (
  id SERIAL PRIMARY KEY,
  work_type_name VARCHAR(150),
  name VARCHAR(150),
  group_id INTEGER REFERENCES work_groups(id) ON DELETE CASCADE,
  description TEXT,
  category VARCHAR(100) DEFAULT 'General',
  status VARCHAR(20) DEFAULT 'Active',
  avg_duration VARCHAR(50),
  avg_price NUMERIC(14,2) DEFAULT 0,
  rate NUMERIC(14,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
