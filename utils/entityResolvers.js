const toInteger = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number.parseInt(value, 10);
  return Number.isNaN(numeric) ? null : numeric;
};

const toNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const resolveCustomer = async (client, { customerId, customerName, customerPhone }) => {
  const normalizedId = toInteger(customerId);

  if (normalizedId) {
    const result = await client.query("SELECT * FROM customers WHERE id = $1::integer LIMIT 1", [
      normalizedId,
    ]);
    if (result.rows.length) {
      return result.rows[0];
    }
  }

  if (customerName) {
    const result = await client.query(
      `SELECT *
       FROM customers
       WHERE LOWER(customer_name) = LOWER($1::text)
          OR ($2::text IS NOT NULL AND phone = $2::text)
       ORDER BY id DESC
       LIMIT 1`,
      [customerName.trim(), customerPhone || null]
    );
    if (result.rows.length) {
      return result.rows[0];
    }
  }

  return null;
};

const resolveVehicle = async (client, { vehicleId, vehicleNumber }) => {
  const normalizedId = toInteger(vehicleId);

  if (normalizedId) {
    const result = await client.query(
      "SELECT * FROM vehicle_register WHERE id = $1::integer LIMIT 1",
      [normalizedId]
    );
    if (result.rows.length) {
      return result.rows[0];
    }
  }

  if (vehicleNumber) {
    const result = await client.query(
      "SELECT * FROM vehicle_register WHERE UPPER(vehicle_number) = UPPER($1::text) LIMIT 1",
      [vehicleNumber.trim()]
    );
    if (result.rows.length) {
      return result.rows[0];
    }
  }

  return null;
};

const resolveSupplier = async (client, { supplierId, supplierName }) => {
  const normalizedId = toInteger(supplierId);

  if (normalizedId) {
    const result = await client.query("SELECT * FROM suppliers WHERE id = $1::integer LIMIT 1", [
      normalizedId,
    ]);
    if (result.rows.length) {
      return result.rows[0];
    }
  }

  if (supplierName && supplierName.trim() !== "NaN" && supplierName.trim() !== "") {
    let result = await client.query(
      `SELECT * FROM suppliers WHERE LOWER(name) = LOWER($1::text) ORDER BY id DESC LIMIT 1`,
      [supplierName.trim()]
    );
    if (result.rows.length) {
      return result.rows[0];
    }
    
    // Auto-create dynamically added supplier to ensure relationship consistency
    try {
      result = await client.query(
        `INSERT INTO suppliers (name, status) VALUES ($1, 'Active') RETURNING *`,
        [supplierName.trim()]
      );
      return result.rows[0];
    } catch (err) {
      console.warn('Silent supplier creation failed:', err.message);
    }
  }

  return null;
};

const resolveBankAccount = async (client, { bankAccountId, bankId, bankAccountName, bankName }) => {
  const normalizedId = toInteger(bankAccountId || bankId);

  if (normalizedId) {
    const byId = await client.query(
      "SELECT * FROM bank_accounts WHERE id = $1::integer LIMIT 1",
      [normalizedId]
    );
    if (byId.rows.length) {
      return byId.rows[0];
    }
  }

  const accountLabel = (bankAccountName || bankName || "").trim();
  if (accountLabel) {
    const byName = await client.query(
      `SELECT *
       FROM bank_accounts
       WHERE LOWER(account_name) = LOWER($1::text)
          OR LOWER(bank_name) = LOWER($1::text)
       ORDER BY id DESC
       LIMIT 1`,
      [accountLabel]
    );
    if (byName.rows.length) {
      return byName.rows[0];
    }
  }

  return null;
};

const resolveJobcard = async (client, { jobcardId, jobcardNo }) => {
  const normalizedId = toInteger(jobcardId);

  if (normalizedId) {
    const byId = await client.query("SELECT * FROM jobcards WHERE id = $1::integer LIMIT 1", [
      normalizedId,
    ]);
    if (byId.rows.length) {
      return byId.rows[0];
    }
  }

  if (jobcardNo) {
    const byNo = await client.query(
      "SELECT * FROM jobcards WHERE jobcard_no = $1::text LIMIT 1",
      [jobcardNo]
    );
    if (byNo.rows.length) {
      return byNo.rows[0];
    }
  }

  return null;
};

const resolveLabourBill = async (client, { billId, labourBillId, billNo, labourBillNo }) => {
  const normalizedId = toInteger(billId || labourBillId);

  if (normalizedId) {
    const byId = await client.query(
      "SELECT * FROM labour_bills WHERE id = $1::integer LIMIT 1",
      [normalizedId]
    );
    if (byId.rows.length) {
      return byId.rows[0];
    }
  }

  const documentNo = billNo || labourBillNo;
  if (documentNo) {
    const byNo = await client.query(
      "SELECT * FROM labour_bills WHERE bill_no = $1::text LIMIT 1",
      [documentNo]
    );
    if (byNo.rows.length) {
      return byNo.rows[0];
    }
  }

  return null;
};

const adjustBankBalance = async (client, bankAccountId, amountDelta) => {
  const normalizedId = toInteger(bankAccountId);
  if (!normalizedId || !amountDelta) {
    return null;
  }

  const result = await client.query(
    `UPDATE bank_accounts
     SET current_balance = COALESCE(current_balance, 0) + $1,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2
     RETURNING *`,
    [amountDelta, normalizedId]
  );

  return result.rows[0] || null;
};

module.exports = {
  adjustBankBalance,
  resolveBankAccount,
  resolveCustomer,
  resolveSupplier,
  resolveJobcard,
  resolveLabourBill,
  resolveVehicle,
  toInteger,
  toNumber,
};
