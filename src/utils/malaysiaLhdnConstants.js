/**
 * Shared Malaysian LHDN / MyInvois (UBL) reference data for customer & business
 * e-invoice forms. Single source of truth to avoid duplicating state lists.
 */

export const MY_STATE_CODES = [
  { code: "01", name: "Johor" },
  { code: "02", name: "Kedah" },
  { code: "03", name: "Kelantan" },
  { code: "04", name: "Melaka" },
  { code: "05", name: "Negeri Sembilan" },
  { code: "06", name: "Pahang" },
  { code: "07", name: "Pulau Pinang" },
  { code: "08", name: "Perak" },
  { code: "09", name: "Perlis" },
  { code: "10", name: "Selangor" },
  { code: "11", name: "Terengganu" },
  { code: "12", name: "Sabah" },
  { code: "13", name: "Sarawak" },
  { code: "14", name: "Kuala Lumpur" },
  { code: "15", name: "Labuan" },
  { code: "16", name: "Putrajaya" },
  { code: "17", name: "Not Applicable" },
];

/**
 * Map a saved address "state" field (name, 2-digit code, or common text) to LHDN
 * `countrySubentityCode`. Returns null if no match.
 */
export function findLhdnCountrySubentityCode(stateInput) {
  if (stateInput == null || String(stateInput).trim() === "") return null;
  const s = String(stateInput).trim();
  if (/^\d{1,2}$/.test(s)) {
    const padded = s.length === 1 ? `0${s}` : s;
    if (MY_STATE_CODES.some((x) => x.code === padded)) return padded;
  }
  const lower = s.toLowerCase();
  const byName = MY_STATE_CODES.find((x) => x.name.toLowerCase() === lower);
  if (byName) return byName.code;
  const aliases = {
    kl: "14",
    "k.l": "14",
    "wp kl": "14",
    "wp kuala lumpur": "14",
    "pulau pinang": "07",
    penang: "07",
  };
  return aliases[lower] || null;
}

/**
 * Address country → ISO 3166-1 alpha-3 for LHDN (buyer / supplier).
 */
export function normalizeCountryForLhdn(country) {
  if (!country || typeof country !== "string") return "MYS";
  const t = country.trim();
  if (t.length === 3 && /^[A-Za-z]{3}$/.test(t)) return t.toUpperCase();
  const map = {
    malaysia: "MYS",
    my: "MYS",
  };
  return map[t.toLowerCase()] || "MYS";
}
