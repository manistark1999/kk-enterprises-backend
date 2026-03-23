CREATE TABLE IF NOT EXISTS estimations (
  id SERIAL PRIMARY KEY,
  bill_no VARCHAR(50),
  estimation_number VARCHAR(50) UNIQUE,
  estimation_date DATE NOT NULL,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  customer_name VARCHAR(150) NOT NULL,
  customer_phone VARCHAR(30),
  vehicle_id INTEGER REFERENCES vehicle_register(id) ON DELETE SET NULL,
  vehicle_number VARCHAR(30),
  vehicle_make VARCHAR(120),
  vehicle_model VARCHAR(120),
  total_amount NUMERIC(14,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'Pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS estimation_items (
  id SERIAL PRIMARY KEY,
  estimation_id INTEGER REFERENCES estimations(id) ON DELETE CASCADE,
  item_name VARCHAR(150) NOT NULL,
  description TEXT,
  quantity NUMERIC(14,2) DEFAULT 1,
  rate NUMERIC(14,2) DEFAULT 0,
  gst NUMERIC(6,2) DEFAULT 0,
  amount NUMERIC(14,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS labour_bills (
  id SERIAL PRIMARY KEY,
  bill_no VARCHAR(50) UNIQUE NOT NULL,
  bill_number VARCHAR(50),
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  customer_name VARCHAR(150),
  customer_phone VARCHAR(30),
  customer_address TEXT,
  vehicle_number VARCHAR(30),
  vehicle_make_id INTEGER,
  vehicle_make VARCHAR(120),
  vehicle_model VARCHAR(120),
  km_reading VARCHAR(50),
  fuel_level VARCHAR(50),
  bill_date DATE NOT NULL,
  bill_time VARCHAR(20),
  items JSONB DEFAULT '[]'::jsonb,
  subtotal NUMERIC(14,2) DEFAULT 0,
  total_gst NUMERIC(14,2) DEFAULT 0,
  discount NUMERIC(14,2) DEFAULT 0,
  grand_total NUMERIC(14,2) DEFAULT 0,
  total_amount NUMERIC(14,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'Completed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sales (
  id SERIAL PRIMARY KEY,
  sale_no VARCHAR(50) UNIQUE NOT NULL,
  sale_date DATE NOT NULL,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  customer_name VARCHAR(150),
  customer_phone VARCHAR(30),
  items JSONB DEFAULT '[]'::jsonb,
  subtotal NUMERIC(14,2) DEFAULT 0,
  total_gst NUMERIC(14,2) DEFAULT 0,
  discount NUMERIC(14,2) DEFAULT 0,
  grand_total NUMERIC(14,2) DEFAULT 0,
  payment_mode VARCHAR(50),
  status VARCHAR(30) DEFAULT 'Completed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchases (
  id SERIAL PRIMARY KEY,
  purchase_no VARCHAR(50) UNIQUE NOT NULL,
  purchase_date DATE NOT NULL,
  supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  supplier_name VARCHAR(150),
  items JSONB DEFAULT '[]'::jsonb,
  subtotal NUMERIC(14,2) DEFAULT 0,
  total_gst NUMERIC(14,2) DEFAULT 0,
  discount NUMERIC(14,2) DEFAULT 0,
  grand_total NUMERIC(14,2) DEFAULT 0,
  payment_mode VARCHAR(50),
  status VARCHAR(30) DEFAULT 'Received',
  notes TEXT,
  invoice_no VARCHAR(80),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
