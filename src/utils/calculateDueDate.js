/**
 * Calculates the due date from invoice/order date and payment term.
 * Prefers numberOfDays when provided (from System Settings Payment Term); otherwise parses term name.
 * @param {string|{ name: string, numberOfDays?: number }} paymentTermOrName - Term name string or term object with name and optional numberOfDays
 * @param {string|Date} invoiceDate - The invoice or order date (YYYY-MM-DD or Date)
 * @param {number} [numberOfDays] - Optional explicit number of days (overrides term object/name when provided)
 * @returns {string|null} - Calculated due date in YYYY-MM-DD format
 */
export function calculateDueDate(paymentTermOrName, invoiceDate, numberOfDays) {
  if (!invoiceDate) return null;

  const baseDate = invoiceDate instanceof Date
    ? new Date(invoiceDate)
    : new Date(invoiceDate);
  if (isNaN(baseDate.getTime())) return null;

  // Explicit numberOfDays (e.g. from selected term object) takes precedence
  const daysFromParam = typeof numberOfDays === "number" && !isNaN(numberOfDays) && numberOfDays >= 0
    ? numberOfDays
    : null;

  const termName = typeof paymentTermOrName === "object" && paymentTermOrName?.name
    ? String(paymentTermOrName.name).trim()
    : (paymentTermOrName ? String(paymentTermOrName).trim() : "");

  const daysFromTerm = typeof paymentTermOrName === "object" && paymentTermOrName?.numberOfDays != null
    ? parseInt(paymentTermOrName.numberOfDays, 10)
    : null;

  const days = daysFromParam ?? daysFromTerm;

  // Use explicit days (including 0) when provided from settings or term object
  if (typeof days === "number" && !isNaN(days)) {
    const dueDate = new Date(baseDate);
    dueDate.setDate(dueDate.getDate() + days);
    return formatDateForInput(dueDate);
  }

  // Fallback: parse from term name when no numberOfDays available or numberOfDays is 0
  if (!termName) return formatDateForInput(baseDate);

  // Match "Net 15", "Net15", "NET 15", etc. (optional space between Net and number)
  const netMatch = termName.match(/^Net\s*(\d+)$/i) || termName.match(/Net\s*(\d+)/i);
  if (netMatch) {
    const d = parseInt(netMatch[1], 10);
    if (!isNaN(d) && d >= 0) {
      const dueDate = new Date(baseDate);
      dueDate.setDate(dueDate.getDate() + d);
      return formatDateForInput(dueDate);
    }
  }

  if (termName.match(/^Due\s+End\s+of\s+Month$/i)) {
    const dueDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
    return formatDateForInput(dueDate);
  }
  if (termName.match(/^Due\s+End\s+of\s+Next\s+Month$/i)) {
    const dueDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + 2, 0);
    return formatDateForInput(dueDate);
  }
  if (termName.match(/^Immediate$/i) || termName.match(/^Due\s+on\s+Receipt$/i)) {
    return formatDateForInput(baseDate);
  }

  return formatDateForInput(baseDate);
}

/**
 * Given a manually selected due date and invoice date, finds a payment term that
 * produces that exact due date, or returns "Custom" if no match.
 * Used when the user changes Due Date first (Case B): auto-select term or "Custom".
 * @param {string|Date} invoiceDate - Invoice date (YYYY-MM-DD or Date)
 * @param {string|Date} dueDate - User-selected due date (YYYY-MM-DD or Date)
 * @param {Array<{ name: string, numberOfDays?: number }>} paymentTerms - Available payment terms
 * @returns {string} - Matching term name or "Custom"
 */
export function getPaymentTermFromDueDate(invoiceDate, dueDate, paymentTerms) {
  if (!invoiceDate || !dueDate || !Array.isArray(paymentTerms) || paymentTerms.length === 0) {
    return "Custom";
  }
  const dueStr = toYYYYMMDD(dueDate);
  if (!dueStr) return "Custom";
  for (const term of paymentTerms) {
    const calculated = calculateDueDate(term, invoiceDate);
    if (calculated === dueStr) return term.name;
  }
  return "Custom";
}

/**
 * Normalizes a date value to YYYY-MM-DD string (local date).
 * @param {string|Date} val - Date string or Date
 * @returns {string} - YYYY-MM-DD or ""
 */
function toYYYYMMDD(val) {
  if (val == null) return "";
  const d = val instanceof Date ? val : new Date(val);
  if (isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Formats a Date object to YYYY-MM-DD string format
 * @param {Date} date - The date to format
 * @returns {string} - Formatted date string
 */
function formatDateForInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
