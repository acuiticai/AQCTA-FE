/**
 * Field specs for every declarative wizard step, keyed by
 * `<applicationType>.<stepKey>`.
 *
 * Select fields use `optionsKey` — values are loaded from Global Settings
 * (Application Field Options) rather than hard-coded here.
 *
 * `readOnly: true` marks a system-generated value (e.g. application reference)
 * that should not be edited in the wizard.
 *
 * Address fields use Google Places. GPS is captured via `gpsField` but never
 * shown in the form — Continue requires a Google pick (GPS present).
 */

import { AQCTA_SCHEME_OPTIONS } from "@/config/aqctaServices";

/* Certification ------------------------------------------------------------ */

export const certificationFields = {
  details: {
    heading: {
      title: "Application Details",
      subtitle:
        "Select the AQCTA scheme, purpose, and assessment type for this application.",
    },
    fields: [
      {
        name: "scheme",
        label: "AQCTA Scheme *",
        type: "select",
        options: [...AQCTA_SCHEME_OPTIONS],
        placeholder: "Select scheme (ISO 13485, GDPMD, CoAWOV, Tech Docs)",
      },
      {
        name: "purpose",
        label: "Application Purpose *",
        type: "select",
        optionsKey: "application_purpose",
        placeholder: "Select application purpose",
      },
      {
        name: "certificationType",
        label: "Assessment Type *",
        type: "select",
        optionsKey: "certification_type",
        placeholder: "Select assessment type",
      },
      {
        name: "applicationReference",
        label: "Application Reference",
        readOnly: true,
        placeholder: "Generated on submission",
      },
    ],
    note: {
      body: "Customer and company information will be pre-filled from your verified AQCTA profile and the originating enquiry.",
    },
  },

  applicant: {
    heading: {
      title: "Applicant Company",
      subtitle: "Verified customer information is pre-filled — review and edit as needed.",
    },
    fields: [
      { name: "companyName", label: "Company Name *" },
      { name: "registrationNumber", label: "Business Registration No. *" },
      { name: "companyEmail", label: "Company Email *", type: "email" },
      { name: "website", label: "Website" },
    ],
  },

  manufacturer: {
    heading: {
      title: "Manufacturer / Factory",
      subtitle: "Enter the manufacturing site responsible for the product.",
    },
    fields: [
      { name: "manufacturerName", label: "Manufacturer Name *" },
      { name: "manufacturerRegNo", label: "Business Registration No." },
      {
        name: "factoryAddress",
        label: "Factory Address *",
        type: "address",
        full: true,
        gpsField: "factoryGpsCoordinates",
        streetField: "factoryStreet",
        blockField: "factoryBlock",
        cityStateField: "factoryCityState",
        placeholder: "Start typing and select from Google",
      },
      { name: "factoryStreet", label: "Street *" },
      { name: "factoryBlock", label: "Block / Unit" },
      { name: "factoryCityState", label: "City / State *" },
      { name: "factoryContact", label: "Contact Person *" },
      { name: "factoryPosition", label: "Position" },
      { name: "factoryPhone", label: "Phone / Mobile *", type: "tel" },
      { name: "factoryEmail", label: "Email *", type: "email" },
    ],
  },

  product: {
    heading: {
      title: "Product Details",
      subtitle: "Provide the core product identification and certification standard.",
    },
    // Rendered by ProductDetailsStep (category from admin + dynamic fields).
    fields: [],
    note: {
      title: "Standard reference",
      body: "Enter the standard number and title for this product. These drive the required technical documents, tests and certification checks shown in the next steps.",
    },
  },
};

/* Inspection --------------------------------------------------------------- */

export const inspectionFields = {
  applicant: {
    heading: {
      title: "A. Applicant Information",
      subtitle:
        "AQCTA-FOR-06-04 — customer details are pre-filled from AQCTA; edit any missing or incorrect values.",
    },
    fields: [
      {
        name: "companyName",
        label: "Name and address of applicant — Company *",
      },
      {
        name: "registrationNumber",
        label: "Company / Business Reg. No. *",
      },
      {
        name: "companyAddress",
        label: "Address *",
        type: "address",
        full: true,
        gpsField: "companyGpsCoordinates",
        streetField: "companyStreet",
        blockField: "companyBlock",
        placeholder: "Start typing and select from Google",
      },
      { name: "companyStreet", label: "Street *" },
      { name: "companyBlock", label: "Block / Unit" },
    ],
  },

  site: {
    heading: {
      title: "A2. Inspection Site",
      subtitle:
        "Name and address of inspection site (if different from applicant).",
    },
    fields: [
      { name: "siteName", label: "Site / Company Name *" },
      { name: "siteRegNo", label: "Company / Business Reg. No." },
      {
        name: "siteAddress",
        label: "Inspection Site Address *",
        type: "address",
        full: true,
        gpsField: "siteGpsCoordinates",
        streetField: "siteStreet",
        blockField: "siteBlock",
        placeholder: "Start typing and select from Google",
      },
      { name: "siteStreet", label: "Street *" },
      { name: "siteBlock", label: "Block / Unit" },
      { name: "siteTelephone", label: "Tel. *", type: "tel" },
    ],
  },

  project: {
    heading: {
      title: "B. Project Information",
      subtitle: "Define the engineering inspection scope for this application.",
    },
    fields: [
      { name: "projectName", label: "1. Project Name *" },
      {
        name: "requestedService",
        label: "Requested Inspection Service *",
        type: "select",
        optionsKey: "inspection_service",
        placeholder: "Select inspection service",
      },
      {
        name: "inspectionCategory",
        label: "Inspection Category *",
        type: "select",
        optionsKey: "inspection_category",
        placeholder: "Select inspection category",
      },
      {
        name: "projectDescription",
        label: "2. Project Description",
        type: "textarea",
        rows: 4,
        full: true,
      },
      {
        name: "referenceDrawings",
        label:
          "3. Applicable reference drawings and technical specifications",
        type: "textarea",
        rows: 3,
        full: true,
      },
      {
        name: "standardNumber",
        label: "4. Standard Number",
        placeholder: "e.g. MS 123:2020",
      },
      {
        name: "standardTitle",
        label: "5. Standard Title",
        placeholder: "e.g. Specification for…",
      },
      {
        name: "applicableStandards",
        label: "6. Additional standard(s) / notes (optional)",
        type: "textarea",
        rows: 2,
        full: true,
      },
    ],
  },
};

/**
 * Address fields that must be chosen from Google Places.
 * GPS is stored (hidden) and used to prove a suggestion was selected.
 */
export const addressGpsByStep = {
  certification: {
    manufacturer: [
      { address: "factoryAddress", gps: "factoryGpsCoordinates" },
    ],
  },
  inspection: {
    applicant: [
      { address: "companyAddress", gps: "companyGpsCoordinates" },
    ],
    site: [{ address: "siteAddress", gps: "siteGpsCoordinates" }],
  },
};

/** Required field names per step, so the wizard can gate Continue. */
export const requiredByStep = {
  certification: {
    details: ["scheme", "purpose", "certificationType"],
    applicant: [
      "companyName",
      "registrationNumber",
      "companyEmail",
      "contactPerson",
      "contactPosition",
      "contactPhone",
      "contactEmail",
    ],
    manufacturer: [
      "manufacturerName",
      "factoryAddress",
      "factoryStreet",
      "factoryCityState",
      "factoryContact",
      "factoryPhone",
      "factoryEmail",
    ],
    product: [
      "productName",
      "brands",
      "categoryId",
    ],
    technical: [],
    documents: [],
    review: [],
  },
  inspection: {
    applicant: [
      "companyName",
      "companyAddress",
      "companyStreet",
      "contactPerson",
      "email",
      "telephone",
    ],
    site: ["siteName", "siteAddress", "siteStreet", "siteTelephone"],
    project: ["projectName", "requestedService", "inspectionCategory"],
    technical: [],
    review: [],
  },
};
