/**
 * AQCTA — single source of truth for company identity (demo + product).
 * Import this instead of hard-coding PC&I / company strings.
 */

export const AQCTA_IDENTITY = {
  shortName: "AQCTA",
  productName: "AQCTA",
  portalName: "AQCTA Customer Portal",
  companyName: "AQC TECHNICAL ASSESSORS (M) SDN. BHD.",
  /** Shorter legal form used in sentences */
  companyNameShort: "AQC Technical Assessors (M) Sdn. Bhd.",
  companyTagline:
    "Assessed, Verified For Acceptance, Trust, Credibility, Quality",
  cabReg: "MDA/CAB-022",
  cabValidity: "17/06/2024 – 16/06/2027",
  authority: "Medical Device Authority – Ministry of Health Malaysia",
  departmentName: "Conformity Assessment Department",
  /** Default payee on letters / invoices */
  accountHolder: "AQC TECHNICAL ASSESSORS (M) SDN. BHD.",
  payeeLine:
    "All payments shall be made payable to AQC TECHNICAL ASSESSORS (M) SDN. BHD.",
  emailFallback: "AQC TECHNICAL ASSESSORS (M) SDN. BHD.",
  addressLine:
    "No.26-02, Jalan Dataran Kulai 3, Taman Dataran Kulai, 81000 Kulai, Johor, Malaysia",
  phone: "+60 12-745 9731",
  email: "aqctechnicalassessors@gmail.com",
  website: "https://aqcta.com/",
  logoPublicPath: "/aqcta-logo.png",
  logoLightPath: "/aqcta-logo-light.png",
  logoDarkPath: "/aqcta-logo-dark.png",
  markPath: "/aqcta-mark.png",
};

/**
 * True when Business still carries PCI demo leftovers (name/address).
 * Used so Quotation / Invoice letterheads show AQCTA instead.
 */
export function isLegacyPciDocumentBranding(business = {}) {
  const name = String(business?.name || business?.businessName || "")
    .trim()
    .toLowerCase();
  const addr = String(
    business?.address || business?.businessAddress || "",
  ).toLowerCase();
  if (!name) return true;
  if (
    name === "pci" ||
    name === "pci group" ||
    name.startsWith("pci ") ||
    name.includes("pc&i") ||
    name === "pc & i" ||
    name.startsWith("pc&i")
  ) {
    return true;
  }
  if (addr.includes("glomac cyberjaya") || addr.includes("jalan gc 3")) {
    return true;
  }
  return false;
}

/**
 * Company letterhead for Flexa Quotation / Invoice document templates.
 * Replaces PCI leftovers with AQCTA identity; otherwise keeps Business fields.
 */
export function resolveDocumentCompanyBranding(business = {}) {
  if (!isLegacyPciDocumentBranding(business)) {
    const logo =
      business?.image ||
      business?.logo ||
      business?.companyLogo ||
      business?.businessLogo ||
      "";
    const name = business?.name || business?.businessName || "";
    const address = business?.address || business?.businessAddress || "";
    const phone =
      business?.tel || business?.phone || business?.businessPhone || "";
    const email = business?.email || business?.businessEmail || "";
    return {
      companyLogo: logo,
      companyName: name,
      companyAddress: address,
      companyPhone: phone,
      companyEmail: email,
      businessLogo: logo,
      businessName: name,
      businessAddress: address,
      businessPhone: phone,
      businessEmail: email,
    };
  }

  const logoPath = AQCTA_IDENTITY.logoPublicPath;
  const logo =
    typeof window !== "undefined" && window.location?.origin
      ? `${window.location.origin}${logoPath}`
      : logoPath;
  const name = AQCTA_IDENTITY.shortName;
  const address = AQCTA_IDENTITY.addressLine;
  const phone = AQCTA_IDENTITY.phone;
  const email = AQCTA_IDENTITY.email;

  return {
    companyLogo: logo,
    companyName: name,
    companyAddress: address,
    companyPhone: phone,
    companyEmail: email,
    businessLogo: logo,
    businessName: name,
    businessAddress: address,
    businessPhone: phone,
    businessEmail: email,
  };
}

export default AQCTA_IDENTITY;
