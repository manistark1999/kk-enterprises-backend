const pool = require('../db');
const { logHistory } = require('../utils/history');
const { getNextDocumentNumber } = require('../utils/documentNumbers');

const getNextNumber = async (req, res) => {
  try {
    const { date } = req.query;
    const prefix = require('../utils/documentNumbers').getDocumentPrefix('jobcard', date || new Date());
    
    // Count active records for this prefix to maintain continuous sequence
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM public.jobcards 
       WHERE jobcard_no LIKE $1 AND is_deleted = false`,
      [`${prefix}%`]
    );
    
    const nextSeq = parseInt(result.rows[0].count) + 1;
    const padSequence = (val) => String(val).padStart(3, "0");
    const nextNo = `${prefix}${padSequence(nextSeq)}`;

    res.json({ success: true, data: nextNo });
  } catch (error) {
    console.error('[JobCard] getNextNo error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getJobcards = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM public.jobcards WHERE is_deleted = false ORDER BY id DESC'
    );

    res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get jobcards error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch jobcards',
      error: error.message,
    });
  }
};

const createJobcard = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const {
      jobcard_no,
      customer_id,
      customer_name,
      phone,
      address,
      vehicle_id,
      vehicle_no,
      vehicle_type,
      brand,
      model,
      transport_name,
      km_reading,
      service_type,
      work_type,
      technician_id,
      technician,
      before_front_camber,
      before_front_caster,
      before_front_toe,
      before_rear_camber,
      before_rear_toe,
      after_front_camber,
      after_front_caster,
      after_front_toe,
      after_rear_camber,
      after_rear_toe,
      service_items,
      complaint,
      work_done,
      remarks,
      status,
      estimated_amount,
      labour_charge,
      parts_charge,
      date
    } = req.body;

    console.log('[JobCardBackend] Incoming request body:', req.body);

    if (!jobcard_no || !customer_name || !vehicle_no) {
       await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'jobcard_no, customer_name and vehicle_no are required',
      });
    }

    const query = `
      INSERT INTO public.jobcards (
        jobcard_no, customer_id, customer_name, phone, address, 
        vehicle_id, vehicle_no, vehicle_type, brand, model, 
        vehicle_make, vehicle_model,
        transport_name, km_reading, service_type, work_type, 
        technician_id, technician_name, 
        before_front_camber, before_front_caster, before_front_toe, 
        before_rear_camber, before_rear_toe, 
        after_front_camber, after_front_caster, after_front_toe, 
        after_rear_camber, after_rear_toe, 
        service_items, complaint, work_done, remarks, 
        status, estimated_amount, labour_charge, parts_charge, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, 
        $6, $7, $8, $9, $10, 
        $11, $12, $13, $14, $15, $16,
        $17, $18, 
        $19, $20, $21, 
        $22, $23, 
        $24, $25, $26, 
        $27, $28, 
        $29, $30, $31, $32, 
        $33, $34, $35, $36, $37
      ) RETURNING *`;

    const values = [
      jobcard_no, customer_id || null, customer_name, phone || null, address || null,
      vehicle_id || null, vehicle_no, vehicle_type || 'Car', brand || null, model || null,
      brand || null, model || null, // Fill vehicle_make and vehicle_model with same values
      transport_name || null, km_reading || null, service_type || null, work_type || null,
      technician_id || null, technician || null,
      before_front_camber || null, before_front_caster || null, before_front_toe || null,
      before_rear_camber || null, before_rear_toe || null,
      after_front_camber || null, after_front_caster || null, after_front_toe || null,
      after_rear_camber || null, after_rear_toe || null,
      JSON.stringify(service_items || []), complaint || null, work_done || null, remarks || null,
      status || 'pending', estimated_amount || 0, labour_charge || 0, parts_charge || 0,
      date || new Date()
    ];

    const result = await client.query(query, values);
    const newJobcard = result.rows[0];

    // Log to History
    await logHistory({
      client,
      module_name: 'Job Card',
      action_type: 'CREATE',
      record_id: newJobcard.id,
      title: `Created Job Card: ${newJobcard.jobcard_no}`,
      description: `Job card for ${newJobcard.vehicle_no} (${newJobcard.customer_name})`,
      changed_data: newJobcard
    });

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Job card saved successfully',
      data: newJobcard,
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('Create jobcard error:', error);
    require('fs').appendFileSync('jobcard_error.log', `[${new Date().toISOString()}] ${error.message}\n${error.stack}\n`);
    res.status(500).json({
      success: false,
      message: 'Failed to save jobcard',
      error: error.message,
    });
  } finally {
    client.release();
  }
};

const updateJobcard = async (req, res) => {
  const client = await pool.connect();
  const { id } = req.params;
  
  if (!id || id === 'undefined' || isNaN(parseInt(id))) {
     client.release();
     return res.status(400).json({ success: false, message: 'Valid Job Card ID is required' });
  }

  try {
    await client.query('BEGIN');
    const {
      jobcard_no,
      customer_id,
      customer_name,
      phone,
      address,
      vehicle_id,
      vehicle_no,
      vehicle_type,
      brand,
      model,
      transport_name,
      km_reading,
      service_type,
      work_type,
      technician_id,
      technician,
      before_front_camber,
      before_front_caster,
      before_front_toe,
      before_rear_camber,
      before_rear_toe,
      after_front_camber,
      after_front_caster,
      after_front_toe,
      after_rear_camber,
      after_rear_toe,
      service_items,
      complaint,
      work_done,
      remarks,
      status,
      estimated_amount,
      labour_charge,
      parts_charge,
      date
    } = req.body;

    const query = `
      UPDATE public.jobcards SET
        jobcard_no=$1, customer_id=$2, customer_name=$3, phone=$4, address=$5,
        vehicle_id=$6, vehicle_no=$7, vehicle_type=$8, brand=$9, model=$10,
        vehicle_make=$11, vehicle_model=$12,
        transport_name=$13, km_reading=$14, service_type=$15, work_type=$16,
        technician_id=$17, technician_name=$18,
        before_front_camber=$19, before_front_caster=$20, before_front_toe=$21,
        before_rear_camber=$22, before_rear_toe=$23,
        after_front_camber=$24, after_front_caster=$25, after_front_toe=$26,
        after_rear_camber=$27, after_rear_toe=$28,
        service_items=$29, complaint=$30, work_done=$31, remarks=$32,
        status=$33, estimated_amount=$34, labour_charge=$35, parts_charge=$36, 
        created_at=$37,
        updated_at=CURRENT_TIMESTAMP
      WHERE id=$38 RETURNING *`;

    const values = [
      jobcard_no || null, 
      (customer_id && !isNaN(parseInt(customer_id))) ? parseInt(customer_id) : null,
      customer_name || null, 
      phone || null, 
      address || null,
      (vehicle_id && !isNaN(parseInt(vehicle_id))) ? parseInt(vehicle_id) : null,
      vehicle_no || null, 
      vehicle_type || 'Car', 
      brand || null, 
      model || null,
      brand || null, 
      model || null,
      transport_name || null, 
      km_reading || null, 
      service_type || null, 
      work_type || null,
      (technician_id && !isNaN(parseInt(technician_id))) ? parseInt(technician_id) : null,
      technician || null,
      before_front_camber || null, before_front_caster || null, before_front_toe || null,
      before_rear_camber || null, before_rear_toe || null,
      after_front_camber || null, after_front_caster || null, after_front_toe || null,
      after_rear_camber || null, after_rear_toe || null,
      JSON.stringify(service_items || []), complaint || null, work_done || null, remarks || null,
      status || 'pending', 
      parseFloat(estimated_amount) || 0, 
      parseFloat(labour_charge) || 0, 
      parseFloat(parts_charge) || 0,
      date || null,
      parseInt(id)
    ];

    if (!jobcard_no || !customer_name || !vehicle_no) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'jobcard_no, customer_name and vehicle_no are required for update',
      });
    }

    const result = await client.query(query, values);
    
    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Job card not found - rowCount is 0' });
    }

    const updatedJobcard = result.rows[0];

    // Log to History
    await logHistory({
      client,
      module_name: 'Job Card',
      action_type: 'UPDATE',
      record_id: id,
      title: `Updated Job Card: ${updatedJobcard.jobcard_no}`,
      description: `Updated details for ${updatedJobcard.vehicle_no}`,
      changed_data: updatedJobcard
    });

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Job card updated successfully',
      data: updatedJobcard,
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('Update jobcard error:', error);
    // Return detailed error only in development, but here we need it for debugging
    res.status(500).json({
      success: false,
      message: error.message.includes('unique constraint') 
        ? 'A job card with this number already exists' 
        : `Database Error: ${error.message}`,
      error: error.message,
      stack: error.stack
    });
  } finally {
    client.release();
  }
};

const deleteJobcard = async (req, res) => {
  const client = await pool.connect();
  const { id } = req.params;
  try {
    await client.query('BEGIN');
    
    // Fetch info about the job card being deleted
    const checkResult = await client.query(
      'SELECT jobcard_no, created_at FROM public.jobcards WHERE id = $1', 
      [id]
    );
    
    if (checkResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Job card not found' });
    }
    
    const { jobcard_no } = checkResult.rows[0];

    // Mark as deleted and suffix the number to allow re-use of original sequence
    const deletedNo = `${jobcard_no}-DEL-${Date.now()}`;
    await client.query(
      'UPDATE public.jobcards SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP, jobcard_no = $1 WHERE id = $2', 
      [deletedNo, id]
    );

    // RENUMBERING LOGIC: Adjust numbers for remaining records in same month/year
    const prefix = jobcard_no.substring(0, jobcard_no.lastIndexOf('-') + 1);
    
    // Fetch remaining active job cards for the same month/year, ordered by ID or created_at
    const remainingResult = await client.query(
      `SELECT id, jobcard_no FROM public.jobcards 
       WHERE jobcard_no LIKE $1 AND is_deleted = false 
       ORDER BY created_at ASC, id ASC`,
      [`${prefix}%`]
    );

    const padSequence = (val) => String(val).padStart(3, "0");

    // Re-assign numbers one by one
    for (let i = 0; i < remainingResult.rows.length; i++) {
      const record = remainingResult.rows[i];
      const newNo = `${prefix}${padSequence(i + 1)}`;
      
      if (record.jobcard_no !== newNo) {
        // Update Job Card number
        await client.query(
          'UPDATE public.jobcards SET jobcard_no = $1 WHERE id = $2',
          [newNo, record.id]
        );
        
        // Update linked Labour Bills
        await client.query(
          'UPDATE public.labour_bills SET jobcard_no = $1 WHERE jobcard_id = $2',
          [newNo, record.id]
        );
        
        // Update linked Alignments (if any)
        await client.query(
          'UPDATE public.alignments SET job_card_no = $1 WHERE job_card_id = $2',
          [newNo, record.id]
        );
      }
    }

    // Log the delete action to History
    await logHistory({
      client,
      module_name: 'Job Card',
      action_type: 'DELETE',
      record_id: id,
      title: `Deleted Job Card: ${jobcard_no}`,
      description: `Job card ${jobcard_no} was soft-deleted and subsequent records were renumbered.`,
      changed_data: checkResult.rows[0]
    });

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Job card deleted and sequence adjusted successfully',
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('Delete jobcard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete jobcard',
      error: error.message,
    });
  } finally {
    client.release();
  }
};

const getJobcardById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM public.jobcards WHERE id = $1 AND is_deleted = false',
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Job card not found' });
    }

    res.status(200).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Get jobcard by id error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch job card details',
      error: error.message,
    });
  }
};

module.exports = {
  getJobcards,
  getJobcardById,
  createJobcard,
  updateJobcard,
  deleteJobcard,
  getNextNumber,
};
