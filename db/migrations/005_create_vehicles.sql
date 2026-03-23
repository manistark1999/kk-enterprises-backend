CREATE TABLE IF NOT EXISTS vehicle_makes (
  id SERIAL PRIMARY KEY,
  make_name VARCHAR(120) NOT NULL,
  name VARCHAR(120),
  models JSONB DEFAULT '[]'::jsonb,
  vehicle_type VARCHAR(80),
  country VARCHAR(80),
  status VARCHAR(20) DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vehicle_models (
  id SERIAL PRIMARY KEY,
  make_id INTEGER REFERENCES vehicle_makes(id) ON DELETE CASCADE,
  model_name VARCHAR(120) NOT NULL,
  status VARCHAR(20) DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vehicle_register (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  vehicle_number VARCHAR(30) NOT NULL,
  owner_name VARCHAR(150),
  mobile VARCHAR(30),
  vehicle_make VARCHAR(120),
  model VARCHAR(120),
  fuel_type VARCHAR(50),
  chassis_number VARCHAR(80),
  engine_number VARCHAR(80),
  color VARCHAR(50),
  year INTEGER,
  status VARCHAR(20) DEFAULT 'Active',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
