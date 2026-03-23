const DOCUMENT_PREFIXES = {
  jobcard: "JC",
  purchase: "PUR",
  bill: "BILL",
  receipt: "RCPT",
  payment: "PAY",
  estimation: "EST",
  sale: "SAL",
  alignment: "ALN",
};

const padMonth = (value) => String(value).padStart(2, "0");
const padSequence = (value) => String(value).padStart(3, "0");

const toDateObject = (value) => {
  if (!value) return new Date();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const getDocumentPrefix = (type, dateValue) => {
  const basePrefix = DOCUMENT_PREFIXES[type];
  if (!basePrefix) {
    throw new Error(`Unknown document prefix type: ${type}`);
  }

  const date = toDateObject(dateValue);
  const year = date.getFullYear();
  const month = padMonth(date.getMonth() + 1);

  return `${basePrefix}-${year}-${month}-`;
};

const getNextDocumentNumber = async ({
  db,
  tableName,
  columnName,
  type,
  dateValue,
}) => {
  const prefix = getDocumentPrefix(type, dateValue);
  const query = `
    SELECT COALESCE(MAX(CAST(RIGHT(${columnName}, 3) AS INTEGER)), 0) + 1 AS next_number
    FROM ${tableName}
    WHERE ${columnName} LIKE $1
    AND is_deleted = false
  `;

  const result = await db.query(query, [`${prefix}%`]);
  const nextNumber = result.rows[0]?.next_number || 1;

  return `${prefix}${padSequence(nextNumber)}`;
};

module.exports = {
  DOCUMENT_PREFIXES,
  getDocumentPrefix,
  getNextDocumentNumber,
};
