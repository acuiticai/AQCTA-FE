/**
 * Per-scheme application workflow stage sets for AQCTA.
 *
 * DB application.type stays `certification`. Filtering uses application.service
 * / formData.scheme (the 4 MDA CAB scheme labels).
 *
 * Stage keys must match WORKFLOW_STAGES / BE stageConfig stageKey values.
 */

import {
  AQCTA_SCHEME_OPTIONS,
  DEFAULT_SCHEME,
} from "@/config/aqctaServices";

/** Shared commercial front for every AQCTA scheme. */
const COMMERCIAL = [
  "contract_review",
  "costing",
  "quotation",
  "project",
];

/**
 * ISO 13485 / GDPMD — on-site QMS / distribution assessment path.
 * Omits Type-5 product samples / lab / evaluation plan / report-changes gate.
 */
const ONSITE_ASSESSMENT = [
  ...COMMERCIAL,
  "assignment",
  "doc_audit",
  "acceptance",
  "audit_notice",
  "audit_checklist",
  "audit_notes",
  "non_conformance",
  "audit_report",
  "certification_report",
  "certification_recommendation",
  "certificate_approval_letter",
  "certification_deliberation",
  "official_certificate",
];

/**
 * CoAWOV / Technical Documentation — verification & docs path (no factory visit).
 */
const VERIFICATION_DOCS = [
  ...COMMERCIAL,
  "assignment",
  "doc_audit",
  "acceptance",
  "certification_report",
  "certification_recommendation",
  "certificate_approval_letter",
  "certification_deliberation",
  "official_certificate",
];

/** Ordered stage keys per scheme label. */
export const SCHEME_STAGE_KEYS = {
  "ISO 13485 / MDQMS": ONSITE_ASSESSMENT,
  GDPMD: ONSITE_ASSESSMENT,
  CoAWOV: VERIFICATION_DOCS,
  "Technical Documentation CA": VERIFICATION_DOCS,
};

/** UI title overrides (keys unchanged). */
export const SCHEME_STAGE_TITLES = {
  "ISO 13485 / MDQMS": {
    audit_notice: "On-site Audit Notice",
    certification_report: "Assessment Report",
    certification_recommendation: "Assessment Recommendation",
    certificate_approval_letter: "Certificate / Decision Letter",
    certification_deliberation: "Issue for Assessment Deliberation",
    official_certificate: "Certificate of Registration (ISO 13485)",
  },
  GDPMD: {
    audit_notice: "On-site Audit Notice",
    certification_report: "Assessment Report",
    certification_recommendation: "Assessment Recommendation",
    certificate_approval_letter: "Certificate / Decision Letter",
    certification_deliberation: "Issue for Assessment Deliberation",
    official_certificate: "Certificate of Registration (GDPMD)",
  },
  CoAWOV: {
    doc_audit: "Evidence / Documentation Review",
    acceptance: "Acceptance of Documents",
    certification_report: "Verification Assessment Report",
    certification_recommendation: "Verification Recommendation",
    certificate_approval_letter: "Verification Decision Letter",
    certification_deliberation: "Issue for Verification Deliberation",
    official_certificate: "Certificate of Conformity",
  },
  "Technical Documentation CA": {
    doc_audit: "Technical Documentation Review",
    acceptance: "Acceptance of Documents",
    certification_report: "Technical Documentation Assessment Report",
    certification_recommendation: "Technical Documentation Recommendation",
    certificate_approval_letter: "Technical Documentation Decision Letter",
    certification_deliberation: "Issue for Technical Documentation Deliberation",
    official_certificate: "Certificate of Conformity",
  },
};

/**
 * Official AQCTA-FOR-01-* form for each certification workflow stage.
 * Do not invent new form numbers — only map stages to the controlled pack.
 */
export const CERTIFICATION_STAGE_FORMS = {
  contract_review: {
    formKey: "FOR-01-23",
    documentCode: "AQCTA-FOR-01-23",
    defaultTitle: "Contract Review Checklist",
    defaultHeading: "CONTRACT REVIEW CHECKLIST",
  },
  costing: {
    formKey: "FOR-01-06",
    documentCode: "AQCTA-FOR-01-06",
    defaultTitle: "Costing Sheet",
    defaultHeading: "COSTING SHEET",
  },
  quotation: {
    formKey: "FOR-01-07",
    documentCode: "AQCTA-FOR-01-07",
    defaultTitle: "Quotation",
    defaultHeading: "QUOTATION",
  },
  assignment: {
    formKey: "FOR-01-10",
    documentCode: "AQCTA-FOR-01-10",
    defaultTitle: "Assignment Letter",
    defaultHeading: "LETTER OF ASSIGNMENT / REASSIGNMENT TO AUDITOR",
  },
  doc_audit: {
    formKey: "FOR-01-08",
    documentCode: "AQCTA-FOR-01-08",
    defaultTitle: "Documentation Audit Checklist",
    defaultHeading: "DOCUMENTATION AUDIT CHECKLIST",
  },
  acceptance: {
    formKey: "FOR-01-09",
    documentCode: "AQCTA-FOR-01-09",
    defaultTitle: "Acceptance Letter",
    defaultHeading:
      "ACKNOWLEDGEMENT OF RECEIPT OF DOCUMENTS FOR THE CONFORMITY ASSESSMENT SCHEME",
  },
  audit_notice: {
    formKey: "FOR-01-11",
    documentCode: "AQCTA-FOR-01-11",
    defaultTitle: "Factory Audit Notice",
    defaultHeading: "CONFORMITY ASSESSMENT SCHEME (FACTORY AUDIT NOTICE)",
  },
  audit_checklist: {
    formKey: "FOR-01-12",
    documentCode: "AQCTA-FOR-01-12",
    defaultTitle: "Audit Checklist and Attendance List",
    defaultHeading: "AUDIT CHECKLIST AND ATTENDANCE LIST",
  },
  audit_notes: {
    formKey: "FOR-01-13",
    documentCode: "AQCTA-FOR-01-13",
    defaultTitle: "Audit Notes",
    defaultHeading: "AUDIT NOTES",
  },
  non_conformance: {
    formKey: "FOR-01-14",
    documentCode: "AQCTA-FOR-01-14",
    defaultTitle: "Non-Conformance Report",
    defaultHeading: "NON-CONFORMANCE REPORT",
  },
  audit_report: {
    formKey: "FOR-01-16",
    documentCode: "AQCTA-FOR-01-16",
    defaultTitle: "Audit Report",
    defaultHeading: "AUDIT REPORT",
  },
  certification_report: {
    formKey: "FOR-01-19",
    documentCode: "AQCTA-FOR-01-19",
    defaultTitle: "Certification Report",
    defaultHeading: "CONFORMITY ASSESSMENT\nCERTIFICATION REPORT",
  },
  certification_recommendation: {
    formKey: "FOR-01-19.2",
    documentCode: "AQCTA-FOR-01-19-02",
    defaultTitle: "Certification Recommendation",
    defaultHeading: "RECOMMENDATION FOR CERTIFICATION",
  },
  certificate_approval_letter: {
    formKey: "FOR-01-19.3",
    documentCode: "AQCTA-FOR-01-19-03",
    defaultTitle: "Certificate Approval Letter",
    defaultHeading: "APPROVAL OF THE AQCTA CONFORMITY ASSESSMENT LICENCE",
  },
  certification_deliberation: {
    formKey: "FOR-01-20",
    documentCode: "AQCTA-FOR-01-20",
    defaultTitle: "Issue for Certification Deliberation",
    defaultHeading: "ISSUE FOR CERTIFICATION PANEL DELIBERATION",
  },
  official_certificate: {
    formKey: "FOR-01-21",
    documentCode: "AQCTA-FOR-01-21",
    defaultTitle: "Official Certificate",
    defaultHeading: "OFFICIAL CERTIFICATE",
  },
};

/** formKey → stage key (certification pack). */
export const FORM_KEY_TO_STAGE = Object.fromEntries(
  Object.entries(CERTIFICATION_STAGE_FORMS).map(([stageKey, meta]) => [
    meta.formKey,
    stageKey,
  ]),
);

/** Schemes that use the on-site audit path (vs verification/docs). */
export const ONSITE_SCHEMES = new Set(["ISO 13485 / MDQMS", "GDPMD"]);

export const isOnsiteScheme = (scheme) =>
  ONSITE_SCHEMES.has(String(scheme || "").trim());

/**
 * Normalise stored service / scheme strings to a known AQCTA scheme label.
 */
export const resolveScheme = (application = {}) => {
  const formData =
    application.formData && typeof application.formData === "object"
      ? application.formData
      : {};
  const raw = String(
    application.service ||
      formData.scheme ||
      formData.serviceScheme ||
      formData.enquiringFor ||
      "",
  ).trim();

  if (AQCTA_SCHEME_OPTIONS.includes(raw)) return raw;
  if (raw === "Certification" || !raw) return DEFAULT_SCHEME;
  /* Unknown labels (legacy Product Certification, etc.) → default QMS path */
  if (raw === "Inspection" || raw === "Engineering Inspection") {
    return DEFAULT_SCHEME;
  }
  return DEFAULT_SCHEME;
};

export const stageKeysForScheme = (scheme) => {
  const resolved = AQCTA_SCHEME_OPTIONS.includes(String(scheme || "").trim())
    ? String(scheme).trim()
    : DEFAULT_SCHEME;
  return SCHEME_STAGE_KEYS[resolved] || SCHEME_STAGE_KEYS[DEFAULT_SCHEME];
};

export const titleForSchemeStage = (scheme, stageKey, fallbackTitle) => {
  const resolved = resolveScheme({ service: scheme });
  const map = SCHEME_STAGE_TITLES[resolved] || {};
  return map[stageKey] || fallbackTitle;
};

const toFormHeading = (title) =>
  String(title || "")
    .trim()
    .toUpperCase();

/**
 * Official AQCTA form + scheme-aware display title/heading for a stage.
 * Titles adapt per scheme; formKey / documentCode stay on the controlled pack.
 */
export const formMetaForSchemeStage = (scheme, stageKey) => {
  const base = CERTIFICATION_STAGE_FORMS[stageKey];
  if (!base) return null;
  const title = titleForSchemeStage(scheme, stageKey, base.defaultTitle);
  const headingOverride = SCHEME_STAGE_TITLES[resolveScheme({ service: scheme })]?.[
    stageKey
  ];
  return {
    ...base,
    stageKey,
    title,
    formHeading: headingOverride
      ? toFormHeading(headingOverride)
      : base.defaultHeading,
  };
};

/** Resolve presentation for a loaded form against an application. */
export const formPresentationForApplication = (application, formKey) => {
  const stageKey = FORM_KEY_TO_STAGE[String(formKey || "").trim()];
  if (!stageKey) return null;
  return formMetaForSchemeStage(resolveScheme(application), stageKey);
};

export default {
  SCHEME_STAGE_KEYS,
  SCHEME_STAGE_TITLES,
  CERTIFICATION_STAGE_FORMS,
  FORM_KEY_TO_STAGE,
  resolveScheme,
  stageKeysForScheme,
  titleForSchemeStage,
  formMetaForSchemeStage,
  formPresentationForApplication,
  isOnsiteScheme,
};
