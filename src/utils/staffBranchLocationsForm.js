/**
 * Normalize staff.branchLocations from API (single ref, populated doc, or array) to string ids for multiselect state.
 */
export function branchIdsFromStaffRef(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((b) =>
        b && typeof b === "object" && b._id != null ? String(b._id) : String(b)
      )
      .filter(Boolean);
  }
  if (typeof raw === "object" && raw._id != null) return [String(raw._id)];
  if (typeof raw === "string" && raw.trim()) return [raw.trim()];
  return [];
}

export function branchMultiSelectValue(ids, branchesList) {
  const list = Array.isArray(ids) ? ids : [];
  return list.map((id) => ({
    value: id,
    label:
      branchesList?.find((b) => String(b._id) === String(id))?.name ||
      String(id),
  }));
}

/** Join branch names for table display (handles populated array or single doc). */
export function formatStaffBranchLocationsCell(record) {
  const raw = record?.branchLocations;
  if (!raw) return "-";
  if (Array.isArray(raw)) {
    const names = raw
      .map((b) =>
        b && typeof b === "object" && b.name != null ? b.name : null
      )
      .filter(Boolean);
    return names.length ? names.join(", ") : "-";
  }
  if (typeof raw === "object" && raw.name) return raw.name;
  return "-";
}
