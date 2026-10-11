import axios from "axios";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

export async function fetchDefinitions(
  { businessId, module, screen, includeInactive = false },
  headers,
) {
  const res = await axios.get(`${Base_URL}/custom-fields/definitions`, {
    headers,
    params: {
      business_id: businessId,
      module,
      screen,
      ...(includeInactive ? { include_inactive: "true" } : {}),
    },
  });
  return res.data?.data || [];
}

/**
 * Items › Items defs to show as line columns for a transaction screen context.
 * @param {string} transactionContext e.g. `sales:invoice`, `sales:recurring_invoice`, `purchase:vendor_invoice`
 */
function lineItemDefinitionMatchesContext(def, transactionContext) {
  if (
    !def?.show_in_transactions ||
    !Array.isArray(def.transaction_targets) ||
    !transactionContext
  ) {
    return false;
  }
  const t = def.transaction_targets;
  if (t.includes(transactionContext)) return true;
  /* Legacy: recurring loads defs that only listed customer invoice. */
  if (
    transactionContext === "sales:recurring_invoice" &&
    t.includes("sales:invoice")
  ) {
    return true;
  }
  return false;
}

export async function fetchLineItemCustomFieldDefinitions(
  { businessId, transactionContext },
  headers,
) {
  if (!businessId || !transactionContext) return [];
  const all = await fetchDefinitions(
    { businessId, module: "inventory", screen: "item" },
    headers,
  );
  return (all || []).filter((d) =>
    lineItemDefinitionMatchesContext(d, transactionContext),
  );
}

export async function createDefinition(body, headers) {
  const res = await axios.post(`${Base_URL}/custom-fields/definitions`, body, {
    headers,
  });
  return res.data;
}

export async function updateDefinition(id, body, headers) {
  const res = await axios.patch(
    `${Base_URL}/custom-fields/definitions/${id}`,
    body,
    { headers },
  );
  return res.data;
}

export async function deleteDefinition(id, businessId, headers) {
  const res = await axios.delete(
    `${Base_URL}/custom-fields/definitions/${id}`,
    { headers, params: { business_id: businessId } },
  );
  return res.data;
}

export async function reorderDefinitions(body, headers) {
  const res = await axios.post(
    `${Base_URL}/custom-fields/definitions/reorder`,
    body,
    { headers },
  );
  return res.data;
}

export async function fetchValues(
  { businessId, module, screen, recordId },
  headers,
) {
  const res = await axios.get(`${Base_URL}/custom-fields/values`, {
    headers,
    params: {
      business_id: businessId,
      module,
      screen,
      record_id: recordId,
    },
  });
  return res.data?.data?.values || {};
}

export async function upsertValues(body, headers) {
  const res = await axios.post(`${Base_URL}/custom-fields/values`, body, {
    headers,
  });
  return res.data;
}

export async function fetchPdfPayload(
  { businessId, module, screen, recordId },
  headers,
) {
  const res = await axios.get(`${Base_URL}/custom-fields/pdf-payload`, {
    headers,
    params: {
      business_id:
        businessId != null ? String(businessId).trim() : "",
      module,
      screen,
      record_id: recordId != null ? String(recordId).trim() : "",
    },
  });
  const data = res.data?.data || {};
  return {
    rows: data.rows || [],
    line_items: data.line_items || null,
  };
}
