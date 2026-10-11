import axios from "axios";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const DEFAULT_CONFIG = {
  billingLabel: "Billing",
  shippingLabel: "Shipping",
  billingNames: ["Billing"],
  shippingNames: ["Shipping"],
  addressTypes: [],
  hasConfiguredTypes: false,
};

export async function fetchAddressTypeConfig(businessId, headers = {}) {
  if (!businessId) return DEFAULT_CONFIG;
  try {
    const response = await axios.post(
      `${Base_URL}/items/Address Types/get_all`,
      {
        business_id: businessId,
        FilterStatus: "active",
        FilterName: "",
      },
      { headers }
    );
    const rows = response?.data?.data || [];
    if (!rows.length) return DEFAULT_CONFIG;

    const billingRows = rows.filter((r) => r.systemType === "BILLING");
    const shippingRows = rows.filter((r) => r.systemType === "SHIPPING");

    return {
      billingLabel: billingRows[0]?.name || DEFAULT_CONFIG.billingLabel,
      shippingLabel: shippingRows[0]?.name || DEFAULT_CONFIG.shippingLabel,
      billingNames: [
        ...new Set([DEFAULT_CONFIG.billingLabel, ...billingRows.map((r) => r.name)]),
      ],
      shippingNames: [
        ...new Set([DEFAULT_CONFIG.shippingLabel, ...shippingRows.map((r) => r.name)]),
      ],
      addressTypes: rows.map((r) => ({
        name: r.name,
        systemType: r.systemType || "OTHER",
      })),
      hasConfiguredTypes: rows.length > 0,
    };
  } catch (_) {
    return DEFAULT_CONFIG;
  }
}

export function findAddressBySystemType(addresses = [], config, systemType) {
  const list = Array.isArray(addresses) ? addresses : [];
  const names =
    systemType === "BILLING" ? config?.billingNames || [] : config?.shippingNames || [];
  return (
    list.find((addr) => names.includes(addr?.addressType)) ||
    list.find((addr) => !addr?.addressType || addr?.addressType === "")
  );
}

/** True if settings include at least one active row for this system type (e.g. BILLING, SHIPPING). */
export function hasConfiguredAddressSystemType(config, systemType) {
  const want = String(systemType || "").toUpperCase();
  return (config?.addressTypes || []).some(
    (t) => String(t.systemType || "OTHER").toUpperCase() === want
  );
}

/** Both billing and shipping system types exist — show "Same as {billing}" and paired behaviour. */
export function hasConfiguredBillingAndShippingPair(config) {
  return (
    hasConfiguredAddressSystemType(config, "BILLING") &&
    hasConfiguredAddressSystemType(config, "SHIPPING")
  );
}

/** Active BILLING / SHIPPING rows from business address-type settings */
export function getConfiguredBillShipTypes(config) {
  return (config?.addressTypes || []).filter(
    (t) => t.systemType === "BILLING" || t.systemType === "SHIPPING"
  );
}

/**
 * Configured bill/ship types this customer does not yet have
 * (no saved address whose addressType matches the type name).
 */
export function getMissingBillShipTypesForCustomer(customerAddresses = [], config) {
  const types = getConfiguredBillShipTypes(config);
  const addrs = Array.isArray(customerAddresses) ? customerAddresses : [];
  return types.filter(
    (typeObj) => !addrs.some((addr) => addr?.addressType === typeObj.name)
  );
}

/** Single-line address for form inputs and comparisons */
export function normalizeAddressOneLine(address) {
  return String(address || "").replace(/\n/g, ", ").trim();
}

/** Format a customer address subdocument (addressLine1, city, …) as multi-line text */
export function formatCustomerAddressObject(addressObj) {
  if (!addressObj) return "";
  const parts = [];
  if (addressObj.addressLine1) parts.push(addressObj.addressLine1);
  if (addressObj.addressLine2) parts.push(addressObj.addressLine2);
  if (addressObj.city) parts.push(addressObj.city);
  if (addressObj.state) parts.push(addressObj.state);
  if (addressObj.zipCode) parts.push(addressObj.zipCode);
  if (addressObj.country) parts.push(addressObj.country);
  return parts.join("\n");
}

/**
 * Normalize stored template/API address (string, PCI address object, or Zoho-style object).
 */
export function stringifyAddressForForm(addr) {
  if (!addr) return "";
  if (typeof addr === "string") return addr;
  if (typeof addr !== "object") return String(addr);
  if (addr.addressLine1 || addr.addressLine2 || addr.zipCode) {
    return formatCustomerAddressObject(addr);
  }
  return [
    addr.attention,
    addr.address,
    addr.street2,
    [addr.city, addr.state, addr.zip].filter(Boolean).join(", "),
    addr.country,
  ]
    .filter(Boolean)
    .map((p) => String(p).trim())
    .filter(Boolean)
    .join("\n");
}

/** Billing/shipping one-line strings from a customer record + address-type config */
export function resolveCustomerBillShipAddresses(customerData, config) {
  const addresses = customerData?.addresses || [];
  const billingAddressObj = findAddressBySystemType(addresses, config, "BILLING");
  const shippingAddressObj = findAddressBySystemType(addresses, config, "SHIPPING");
  const billingRaw = billingAddressObj
    ? formatCustomerAddressObject(billingAddressObj)
    : customerData?.companyInfo?.billingAddress || "";
  const shippingRaw = shippingAddressObj
    ? formatCustomerAddressObject(shippingAddressObj)
    : customerData?.companyInfo?.shippingAddress || "";
  return {
    billing: normalizeAddressOneLine(billingRaw),
    shipping: normalizeAddressOneLine(shippingRaw),
  };
}

/** Resolve same-as-billing from stored flag or matching addresses (edit/load). */
export function resolveSameAsBillingFlag(storedFlag, billingAddress, shippingAddress) {
  if (typeof storedFlag === "boolean") return storedFlag;
  const bill = normalizeAddressOneLine(billingAddress);
  const ship = normalizeAddressOneLine(shippingAddress);
  return !!bill && bill === ship;
}

/**
 * Missing bill/ship prompts for the customer — hides shipping "Add address"
 * when same-as-billing is checked (shipping uses billing).
 */
export function getMissingBillShipTypesForCustomerDisplay(
  customerAddresses = [],
  config,
  sameAsBilling = false
) {
  const missing = getMissingBillShipTypesForCustomer(customerAddresses, config);
  if (!sameAsBilling) return missing;
  return missing.filter((t) => t.systemType !== "SHIPPING");
}

/** Section heading when prompting to add missing types only */
export function missingBillShipSectionTitle(missingTypeObjects) {
  if (!missingTypeObjects?.length) return "";
  const names = missingTypeObjects.map((t) => t.name).filter(Boolean);
  if (!names.length) return "";
  if (names.length === 1) return `${names[0]} address`;
  return `${names.join(" & ")} address`;
}

/** One line explaining which configured types are still missing on the customer */
export function buildMissingCustomerAddressMessage(missingTypeObjects) {
  if (!missingTypeObjects?.length) return "";
  const names = missingTypeObjects.map((t) => (t.name || "").trim()).filter(Boolean);
  if (!names.length) return "";
  const lower = names.map((n) => n.toLowerCase());
  if (lower.length === 1) return `No ${lower[0]} address for this customer.`;
  if (lower.length === 2) return `No ${lower[0]} or ${lower[1]} address for this customer.`;
  const last = lower[lower.length - 1];
  const rest = lower.slice(0, -1).join(", ");
  return `No ${rest}, or ${last} address for this customer.`;
}

