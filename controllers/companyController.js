const pool = require('../config/db');
const { logHistory } = require('../utils/history');

const get = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM company_settings LIMIT 1');
    res.json({ success: true, data: result.rows[0] || null });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const upsert = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { 
      company_name, address, city, state, pincode, phone, email, gst_number, website, logo_url,
      bank_name, account_no, ifsc_code, owner_name, owner_phone, owner_email,
      business_type, established_year, tax_reg_type
    } = req.body;
    
    // Check if exists
    const existing = await client.query('SELECT id FROM company_settings LIMIT 1');
    let result;
    let action = 'CREATE';
    
    if (existing.rows.length > 0) {
      action = 'UPDATE';
      result = await client.query(
        `UPDATE company_settings SET 
          company_name=$1, address=$2, city=$3, state=$4, pincode=$5, 
          phone=$6, email=$7, gst_number=$8, website=$9, logo_url=$10,
          bank_name=$11, account_no=$12, ifsc_code=$13, owner_name=$14, owner_phone=$15, owner_email=$16,
          business_type=$17, established_year=$18, tax_reg_type=$19, updated_at=NOW()
         WHERE id=$20 RETURNING *`,
        [
          company_name, address, city, state, pincode, phone, email, gst_number, website, logo_url,
          bank_name, account_no, ifsc_code, owner_name, owner_phone, owner_email,
          business_type, established_year, tax_reg_type,
          existing.rows[0].id
        ]
      );
    } else {
      result = await client.query(
        `INSERT INTO company_settings (
          company_name, address, city, state, pincode, phone, email, gst_number, website, logo_url,
          bank_name, account_no, ifsc_code, owner_name, owner_phone, owner_email,
          business_type, established_year, tax_reg_type
        )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
        [
          company_name, address, city, state, pincode, phone, email, gst_number, website, logo_url,
          bank_name, account_no, ifsc_code, owner_name, owner_phone, owner_email,
          business_type, established_year, tax_reg_type
        ]
      );
    }

    const record = result.rows[0];

    await logHistory({
      client,
      module_name: 'Settings',
      action_type: action,
      record_id: record.id,
      title: `${action === 'UPDATE' ? 'Updated' : 'Created'} Company Profile`,
      description: `Company settings for ${company_name} were ${action === 'UPDATE' ? 'modified' : 'added'}.`,
      user_name: 'admin'
    });

    await client.query('COMMIT');
    res.json({ success: true, data: record });
  } catch (err) { 
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: err.message }); 
  } finally {
    client.release();
  }
};

module.exports = { get, upsert };
