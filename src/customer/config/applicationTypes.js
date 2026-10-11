/**
 * Application services and the step sequence each one opens.
 *
 * Demo: only certification (AQCTA medical CAB schemes) is offered in pickers.
 * Inspection type remains defined for legacy rows / emergency admin use.
 */

import {
  APPLICATION_SCHEME_PICKER_OPTIONS,
  DEFAULT_SCHEME,
  typeFromEnquiringFor as mapEnquiringForToType,
} from "@/config/aqctaServices";

export const APPLICATION_TYPES = {
  certification: {
    id: "certification",
    label: "Certification",
    title: "Conformity Assessment Application",
    listLabel: "Conformity Assessment",
    referencePrefix: "APP-CERT",
    steps: [
      { key: "details", title: "Application", caption: "Details" },
      { key: "applicant", title: "Applicant", caption: "Information" },
      { key: "manufacturer", title: "Manufacturer", caption: "Factory" },
      { key: "product", title: "Product", caption: "Details" },
      { key: "technical", title: "Technical", caption: "Quality" },
      { key: "documents", title: "Documents", caption: "Files" },
      { key: "review", title: "Review", caption: "Submit" },
    ],
    stepCopy: {
      details: {
        title: "Conformity Assessment Application",
        subtitle:
          "Start with the application purpose and AQCTA scheme (ISO 13485, GDPMD, CoAWOV, or Technical Documentation).",
      },
      applicant: {
        title: "Applicant Information",
        subtitle:
          "Confirm the establishment (Manufacturer, AR, Importer, or Distributor) and authorised contacts.",
      },
      manufacturer: {
        title: "Manufacturer & Site",
        subtitle: "Provide manufacturer and manufacturing / distribution site details.",
      },
      product: {
        title: "Device / Scope Information",
        subtitle:
          "Describe the medical device or assessment scope and applicable requirements.",
      },
      technical: {
        title: "Technical & Quality Information",
        subtitle:
          "Capture quality system, technical documentation, and supporting controls.",
      },
      documents: {
        title: "Documents & Authorisations",
        subtitle: "Upload assessment evidence and required authorisations.",
      },
      review: {
        title: "Review & Submit",
        subtitle:
          "Review the conformity assessment application before submission.",
      },
    },
  },

  inspection: {
    id: "inspection",
    label: "Inspection",
    title: "Application for Engineering Inspection",
    listLabel: "Engineering Inspection",
    referencePrefix: "APP-INS",
    documentCode: "",
    steps: [
      { key: "applicant", title: "Applicant", caption: "A1" },
      { key: "site", title: "Site", caption: "A2" },
      { key: "project", title: "Project", caption: "B" },
      { key: "technical", title: "Documents", caption: "Refs" },
      { key: "review", title: "Declaration", caption: "C" },
    ],
    stepCopy: {
      applicant: {
        title: "Application for Engineering Inspection",
        subtitle: "Confirm applicant company and contact details.",
      },
      site: {
        title: "Inspection Site",
        subtitle:
          "Provide the site where the engineering inspection will take place (if different from A1).",
      },
      project: {
        title: "B. Project Information",
        subtitle: "Describe the project and the requested inspection service.",
      },
      technical: {
        title: "Supporting Documents & Commercial References",
        subtitle:
          "Download Form = pre-filled application data; Upload = signed/completed files for each document type.",
      },
      review: {
        title: "C. Declaration and Undertaking",
        subtitle:
          "Review the Engineering Inspection application before submission.",
      },
    },
  },
};

/**
 * Create Application picker — same 4 AQCTA schemes as Enquiring For.
 * Each option's value is the scheme label; wizard route is always certification.
 */
export const APPLICATION_TYPE_OPTIONS = [...APPLICATION_SCHEME_PICKER_OPTIONS];

export const getApplicationType = (id) => APPLICATION_TYPES[id] || null;

/** Maps an enquiry's "Enquiring For" onto the application type it becomes. */
export const typeFromEnquiringFor = (enquiringFor) =>
  mapEnquiringForToType(enquiringFor);

/** Scheme label from enquiry (or empty). */
export const schemeFromEnquiringFor = (enquiringFor) => {
  const v = String(enquiringFor || "").trim();
  if (!v || v === "Inspection" || v === "Certification") return DEFAULT_SCHEME;
  return v;
};

export { DEFAULT_SCHEME };
