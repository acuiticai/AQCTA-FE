/**
 * Group entities that appear in multiple businesses into single rows with comma-separated businesses.
 * Used for Vendors, Customers, and Stock Groups when viewing "All" or multiple businesses.
 */

function getBusinessName(entity, businesses = []) {
  const b = entity.business;
  if (b?.name) return b.name;
  if (typeof b === "string") {
    const found = businesses.find((x) => (x._id || x.id)?.toString() === b);
    return found?.name || b;
  }
  if (b?._id) {
    const found = businesses.find((x) => (x._id || x.id)?.toString() === (b._id || b).toString());
    return found?.name || b._id;
  }
  return "";
}

// Resolve a single business reference (ObjectId string or populated object) to a display name
function resolveBusinessName(b, businesses = []) {
  if (!b) return "";
  if (b?.name) return b.name;
  const id = (b?._id || b)?.toString();
  if (!id) return "";
  const found = businesses.find((x) => (x._id || x.id)?.toString() === id);
  return found?.name || "";
}

// Collect ALL business names for an entity from both the primary `business` field
// and the `businesses` array (new multi-business model).
function collectAllBusinessNames(entity, businesses = []) {
  const names = new Set();
  const primary = getBusinessName(entity, businesses);
  if (primary) names.add(primary);
  if (Array.isArray(entity.businesses)) {
    for (const b of entity.businesses) {
      const name = resolveBusinessName(b, businesses);
      if (name) names.add(name);
    }
  }
  return names;
}

/**
 * Group vendors by email (fallback: vendorCode). Merge businesses into comma-separated string.
 * @param {Array} vendors - Raw vendor list (may have duplicates per business)
 * @param {Array} businesses - Optional list to resolve business ID to name
 * @returns {Array} - Consolidated vendors with businessesDisplay
 */
export function groupVendorsByEmail(vendors, businesses = []) {
  if (!Array.isArray(vendors) || vendors.length === 0) return [];

  const map = new Map();
  for (const v of vendors) {
    const key = (v.basicInformation?.vendorEmail || v.basicInformation?.vendorCode || v._id)?.toString().toLowerCase().trim() || v._id;
    const allNames = collectAllBusinessNames(v, businesses);
    if (!map.has(key)) {
      map.set(key, { ...v, _groupKey: key, _businesses: allNames });
    } else {
      const existing = map.get(key);
      allNames.forEach((name) => existing._businesses.add(name));
    }
  }
  return Array.from(map.values()).map(({ _businesses, _groupKey, ...rest }) => ({
    ...rest,
    businessesDisplay: Array.from(_businesses).filter(Boolean).join(", ") || "-",
  }));
}

/**
 * Group customers by email (fallback: customerCode). Merge businesses into comma-separated string.
 * @param {Array} customers - Raw customer list (may have duplicates per business)
 * @param {Array} businesses - Optional list to resolve business ID to name
 * @returns {Array} - Consolidated customers with businessesDisplay
 */
export function groupCustomersByEmail(customers, businesses = []) {
  if (!Array.isArray(customers) || customers.length === 0) return [];

  const map = new Map();
  for (const c of customers) {
    const key = (c.basicInformation?.customerEmail || c.basicInformation?.customerCode || c._id)?.toString().toLowerCase().trim() || c._id;
    const allNames = collectAllBusinessNames(c, businesses);
    if (!map.has(key)) {
      map.set(key, { ...c, _groupKey: key, _businesses: allNames });
    } else {
      const existing = map.get(key);
      allNames.forEach((name) => existing._businesses.add(name));
    }
  }
  return Array.from(map.values()).map(({ _businesses, _groupKey, ...rest }) => ({
    ...rest,
    businessesDisplay: Array.from(_businesses).filter(Boolean).join(", ") || "-",
  }));
}

/**
 * Group stock groups by stockCode. Merge businesses into comma-separated string.
 * @param {Array} stockGroups - Raw stock group list (may have duplicates per business)
 * @param {Array} businesses - Optional list to resolve business ID to name
 * @returns {Array} - Consolidated stock groups with businessesDisplay
 */
export function groupStockGroupsByCode(stockGroups, businesses = []) {
  if (!Array.isArray(stockGroups) || stockGroups.length === 0) return [];

  const map = new Map();
  for (const s of stockGroups) {
    const key = (s.stockCode || s._id)?.toString().toLowerCase().trim() || s._id;
    const businessName = getBusinessName(s, businesses);
    const incomingTs = new Date(s.updatedAt || s.createdAt || 0).getTime();
    if (!map.has(key)) {
      map.set(key, {
        ...s,
        _groupKey: key,
        _businesses: new Set(businessName ? [businessName] : []),
        _updatedAt: incomingTs,
      });
    } else {
      const existing = map.get(key);
      if (businessName) existing._businesses.add(businessName);
      if (incomingTs >= (existing._updatedAt || 0)) {
        const businessesSet = existing._businesses;
        Object.assign(existing, s);
        existing._groupKey = key;
        existing._businesses = businessesSet;
        existing._updatedAt = incomingTs;
      }
    }
  }
  return Array.from(map.values()).map(({ _businesses, _groupKey, _updatedAt, ...rest }) => ({
    ...rest,
    businessesDisplay: Array.from(_businesses).filter(Boolean).join(", ") || "-",
  }));
}
