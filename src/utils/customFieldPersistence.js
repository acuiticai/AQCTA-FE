import { fetchDefinitions, upsertValues } from "@/services/customFieldServices";

/**
 * Upsert custom field values for the same logical record across multiple businesses
 * (separate CustomFieldValue docs per business_id).
 */
export async function persistCustomFieldValuesByBusiness({
  headers,
  recordId,
  businessIds,
  valuesByBusiness,
  module,
  screen,
}) {
  if (!recordId || !businessIds?.length || !module || !screen) return;
  const rid = String(recordId);
  for (const bid of businessIds) {
    const defs = await fetchDefinitions(
      { businessId: bid, module, screen },
      headers,
    );
    if (!defs.length) continue;
    await upsertValues(
      {
        business_id: bid,
        module,
        screen,
        record_id: rid,
        values: valuesByBusiness[bid] || {},
      },
      headers,
    );
  }
}
