import { formatMultiValue, normalizeProductFormValues } from "@/customer/utils/productMultiFields";

const pickStandardFromValues = (values = {}) => {
  const standardNumber = String(values.standardNumber || "").trim();
  const standardTitle = String(values.standardTitle || "").trim();
  if (standardNumber && standardTitle) {
    return `${standardNumber} — ${standardTitle}`;
  }
  if (standardNumber) return standardNumber;
  if (standardTitle) return standardTitle;

  if (String(values.standard || "").trim()) {
    return String(values.standard).trim();
  }

  const categoryFieldValues = values.categoryFieldValues || {};
  const categoryProductFields = values.categoryProductFields || [];

  for (const def of categoryProductFields) {
    const label = String(def?.label || def?.key || "").toLowerCase();
    if (label.includes("standard")) {
      const value = formatMultiValue(categoryFieldValues[def.key]) || String(categoryFieldValues[def.key] || "").trim();
      if (value) return value;
    }
  }

  for (const [key, raw] of Object.entries(categoryFieldValues)) {
    if (String(key).toLowerCase().includes("standard")) {
      const value = formatMultiValue(raw) || String(raw || "").trim();
      if (value) return value;
    }
  }

  return "";
};

/** Build application field payload used to pre-fill certification PDF forms. */
export function buildCertificationFormData(values = {}) {
  const form = normalizeProductFormValues(values);
  const types = formatMultiValue(form.types);
  const models = formatMultiValue(form.models);
  const ratings = formatMultiValue(form.ratings);
  const sizes = formatMultiValue(form.sizes);
  const brands = formatMultiValue(form.brands) || form.brand || "";
  const typeModelParts = [types, models].filter(Boolean).join(" / ");
  const typeWithModel = [form.certificationType, typeModelParts || form.model]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" / ");

  return {
    companyName: form.companyName || "",
    productName: form.productName || "",
    model: models || form.model || "",
    brand: brands,
    types,
    models,
    ratings,
    sizes,
    typeModelRatingSize: [types, models, ratings, sizes]
      .filter(Boolean)
      .join(" · "),
    standardNumber: form.standardNumber || "",
    standardTitle: form.standardTitle || "",
    standard: pickStandardFromValues(form),
    companyAddress: form.companyAddress || "",
    registrationNumber: form.registrationNumber || "",
    manufacturerName: form.manufacturerName || "",
    manufacturerRegNo: form.manufacturerRegNo || "",
    factoryAddress: form.factoryAddress || "",
    certificationType: form.certificationType || "",
    contactEmail: form.contactEmail || form.companyEmail || "",
    contactPerson: form.contactPerson || form.contactPerson1 || "",
    contactPhone: form.contactPhone || form.telephone || "",
    telephone: form.contactPhone || form.telephone || "",
    factoryPhone: form.factoryPhone || "",
    factoryContact: form.factoryContact || "",

    // FOR-01-5 — Applicant (left column)
    applicantCompanyName: form.companyName || "",
    applicantAddress: form.companyAddress || "",
    applicantBrand: brands,
    applicantTypeWithModel: typeWithModel,
    applicantTelephone: form.contactPhone || form.telephone || "",
    applicantContactPerson: form.contactPerson || form.contactPerson1 || "",

    // FOR-01-5 — Licensee (right column)
    licenseeCompanyName: form.manufacturerName || "",
    licenseeLicenceNo: form.manufacturerRegNo || "",
    licenseeAddress: form.factoryAddress || "",
    licenseeBrand: brands,
    licenseeTypeWithModel: typeWithModel,
    licenseeTelephone: form.factoryPhone || "",
    licenseeContactPerson: form.factoryContact || "",
  };
}

/**
 * AQCTA-FOR-06-04 — Application for Engineering Inspection.
 * Prefills the master PDF from wizard / DB values.
 */
export function buildInspectionFormData(values = {}, documents = []) {
  const docLines = (names = []) =>
    (Array.isArray(documents) ? documents : [])
      .filter((row) => {
        const type = String(row.typeName || row.name || "").toLowerCase();
        return names.some((n) => type.includes(n));
      })
      .map((row) => String(row.documentName || row.fileName || "").trim())
      .filter(Boolean)
      .join("; ");

  const referenceDrawings =
    String(values.referenceDrawings || "").trim() ||
    [docLines(["drawing"]), docLines(["specification"])]
      .filter(Boolean)
      .join("; ");

  const applicableStandards =
    [
      [String(values.standardNumber || "").trim(), String(values.standardTitle || "").trim()]
        .filter(Boolean)
        .join(" — "),
      String(values.applicableStandards || "").trim(),
      docLines(["standard"]),
    ]
      .filter(Boolean)
      .join("; ") || "";

  return {
    companyName: values.companyName || "",
    companyAddress: values.companyAddress || "",
    registrationNumber: values.registrationNumber || "",
    contactPerson: values.contactPerson || "",
    email: values.email || values.contactEmail || values.companyEmail || "",
    telephone: values.telephone || values.contactPhone || "",
    fax: values.fax || "",
    siteName: values.siteName || "",
    siteAddress: values.siteAddress || "",
    siteRegNo: values.siteRegNo || "",
    siteTelephone: values.siteTelephone || "",
    siteFax: values.siteFax || "",
    projectName: values.projectName || "",
    projectDescription: values.projectDescription || "",
    referenceDrawings,
    standardNumber: values.standardNumber || "",
    standardTitle: values.standardTitle || "",
    applicableStandards,
    paymentAmount: values.paymentAmount || "",
    quotationReference: values.quotationReference || "",
    purchaseOrder: values.purchaseOrder || "",
    signatoryName: values.signatoryName || values.contactPerson || "",
    signatoryDesignation:
      values.signatoryDesignation || values.contactPosition || "",
    declarationDate: new Date().toLocaleDateString("en-GB"),
  };
}

/** Payload for downloadForm — picks certification vs inspection by type. */
export function buildApplicationFormData(
  type,
  values = {},
  documents = [],
) {
  if (String(type) === "inspection") {
    return buildInspectionFormData(values, documents);
  }
  return buildCertificationFormData(values);
}

/** True when the document type is AQCTA-FOR-06-04 application form. */
export function isInspectionApplicationForm(doc = {}) {
  const key = String(doc.templateKey || "").trim().toUpperCase();
  if (key === "FOR-06-04") return true;
  const name = String(doc.typeName || doc.name || "").toLowerCase();
  return name.includes("application for engineering inspection");
}

/**
 * Resolve templateKey for downloadForm — always prefer FOR-06-04 for the
 * Engineering Inspection application so the PDF is generated with data fill.
 */
export function resolveDocumentDownloadTemplateKey(doc = {}) {
  const key = String(doc.templateKey || "").trim();
  if (key) return key;
  if (isInspectionApplicationForm(doc)) return "FOR-06-04";
  return "";
}

export function filenameFromContentDisposition(header, fallback = "document") {
  const value = String(header || "");
  const utfMatch = value.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1].replace(/["']/g, "").trim()) || fallback;
    } catch {
      /* ignore */
    }
  }
  const asciiMatch = value.match(/filename="?([^";]+)"?/i);
  return asciiMatch?.[1]?.trim() || fallback;
}

/** Trigger a file download from a blob (PDF or admin-uploaded template). */
export function triggerBlobDownload(
  blob,
  filename = "document",
  mimeType = ""
) {
  const type =
    mimeType ||
    (blob && blob.type) ||
    "application/octet-stream";
  const url = URL.createObjectURL(new Blob([blob], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Trigger a PDF download from an axios blob response. */
export function triggerPdfDownload(blob, filename = "certification-form.pdf") {
  triggerBlobDownload(blob, filename, "application/pdf");
}

/** Download an axios blob response, using Content-Disposition when present. */
export function downloadAxiosBlob(response, fallbackName = "document") {
  const header =
    response?.headers?.["content-disposition"] ||
    response?.headers?.["Content-Disposition"] ||
    "";
  const type =
    response?.headers?.["content-type"] ||
    response?.data?.type ||
    "";
  const name = filenameFromContentDisposition(header, fallbackName);
  triggerBlobDownload(response.data, name, type);
}
