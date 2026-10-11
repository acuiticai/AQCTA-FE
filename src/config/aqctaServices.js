/**
 * AQCTA medical CAB schemes (display layer).
 *
 * Source: https://aqcta.com/ — MDA CAB MDA/CAB-022 services:
 *   1. ISO 13485:2016 / MDQMS
 *   2. GDPMD
 *   3. Conformity Assessment by Way of Verification (CoAWOV)
 *   4. Conformity Assessment of Technical Documentation
 * (Online training exists on the site but is not an assessment application.)
 *
 * Internal DB application.type stays `certification` | `inspection`.
 * All AQCTA schemes map to typeKey "certification".
 */

/** Values stored on enquiry.enquiringFor / application.service and shown in UI. */
export const AQCTA_SCHEME_OPTIONS = [
  "ISO 13485 / MDQMS",
  "GDPMD",
  "CoAWOV",
  "Technical Documentation CA",
];

/**
 * Combobox options for Create Application / Enquiring For.
 * value = scheme label (stored); all open the certification wizard.
 */
export const APPLICATION_SCHEME_PICKER_OPTIONS = AQCTA_SCHEME_OPTIONS.map(
  (label) => ({
    value: label,
    label,
  }),
);

/** Legacy enquiry values still accepted by API / old rows. */
export const LEGACY_ENQUIRING_FOR = ["Certification", "Inspection"];

/** Full enum the backend must accept. */
export const ENQUIRING_FOR_ALL = [
  ...AQCTA_SCHEME_OPTIONS,
  ...LEGACY_ENQUIRING_FOR,
];

/**
 * Demo-facing "Enquiring For" picker — AQCTA schemes only.
 * Engineering Inspection is hidden for the first demo.
 */
export const ENQUIRING_FOR_OPTIONS = [...AQCTA_SCHEME_OPTIONS];

/** Application / filter service labels (certification track). */
export const APPLICATION_SERVICE_OPTIONS = [...AQCTA_SCHEME_OPTIONS];

export const DEFAULT_SCHEME = AQCTA_SCHEME_OPTIONS[0];

export const AQCTA_SCHEMES = {
  iso13485: {
    id: "iso13485",
    serviceLabel: "ISO 13485 / MDQMS",
    typeKey: "certification",
    shortLabel: "ISO 13485",
    websiteName: "Medical Device Quality Management system (MDQMS) ISO 13485:2016",
  },
  gdpmd: {
    id: "gdpmd",
    serviceLabel: "GDPMD",
    typeKey: "certification",
    shortLabel: "GDPMD",
    websiteName: "Good Distribution Practice for Medical Devices (GDPMD)",
  },
  coawov: {
    id: "coawov",
    serviceLabel: "CoAWOV",
    typeKey: "certification",
    shortLabel: "CoAWOV",
    websiteName: "Conformity Assessment by Way of Verification (CoAWOV)",
  },
  techDocs: {
    id: "techDocs",
    serviceLabel: "Technical Documentation CA",
    typeKey: "certification",
    shortLabel: "Tech Docs CA",
    websiteName: "Conformity Assessment of Technical Documentation",
  },
};

export const isAqctaScheme = (value) =>
  AQCTA_SCHEME_OPTIONS.includes(String(value || "").trim());

export const isLegacyInspection = (value) =>
  String(value || "").trim() === "Inspection";

/**
 * Map enquiry.enquiringFor → application.type.
 * Only legacy "Inspection" stays on the inspection track.
 */
export const typeFromEnquiringFor = (enquiringFor) =>
  isLegacyInspection(enquiringFor) ? "inspection" : "certification";

/**
 * Resolve display service label for an application.
 */
export const resolveServiceLabel = (type, formData = {}, enquiringFor = "") => {
  if (type === "inspection") {
    return (
      String(formData.requestedService || "").trim() || "Engineering Inspection"
    );
  }
  const fromForm = String(
    formData.scheme || formData.serviceScheme || formData.enquiringFor || "",
  ).trim();
  if (fromForm && fromForm !== "Certification" && fromForm !== "Inspection") {
    return fromForm;
  }
  const fromEnquiry = String(enquiringFor || "").trim();
  if (
    fromEnquiry &&
    fromEnquiry !== "Certification" &&
    fromEnquiry !== "Inspection"
  ) {
    return fromEnquiry;
  }
  if (fromForm === "Certification" || fromEnquiry === "Certification") {
    return DEFAULT_SCHEME;
  }
  return DEFAULT_SCHEME;
};

export default {
  AQCTA_SCHEME_OPTIONS,
  APPLICATION_SCHEME_PICKER_OPTIONS,
  ENQUIRING_FOR_OPTIONS,
  ENQUIRING_FOR_ALL,
  APPLICATION_SERVICE_OPTIONS,
  DEFAULT_SCHEME,
  AQCTA_SCHEMES,
  typeFromEnquiringFor,
  resolveServiceLabel,
};
