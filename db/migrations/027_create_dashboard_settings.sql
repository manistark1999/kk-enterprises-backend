-- 027_create_dashboard_settings.sql
-- Store company profile and dashboard layout preferences

CREATE TABLE IF NOT EXISTS company_settings (
  id SERIAL PRIMARY KEY,
  company_name VARCHAR(150) NOT NULL,
  address TEXT,
  city VARCHAR(50),
  state VARCHAR(50),
  pincode VARCHAR(10),
  phone VARCHAR(20),
  email VARCHAR(100),
  gst_number VARCHAR(20),
  website VARCHAR(100),
  logo_url TEXT,
  dashboard_layout JSONB DEFAULT '{}'::jsonb, -- Store widget order/toggle
  currency_symbol VARCHAR(10) DEFAULT '₹',
  financial_year_id INTEGER, -- Optional override
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed defaults IF empty
INSERT INTO company_settings (company_name, email, city) 
SELECT 'KK Enterprises', 'info@kkenterprises.com', 'Chennai'
WHERE NOT EXISTS (SELECT 1 FROM company_settings LIMIT 1);
