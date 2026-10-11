/**
 * Shared business document template helpers (quotations, invoices, sale orders, emails).
 */
import axios from "axios";
import { STANDARD_EMAIL_TEMPLATE_NAME } from "@/utils/standardEmailTemplate";
import { getDefaultEmailTemplateDoc } from "@/utils/defaultEmailTemplateShell";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const emailTemplateCache = new Map();
const emailTemplateInflight = new Map();

function cacheKeyForBusiness(businessId) {
  return businessId ? String(businessId) : "__global__";
}

export function getCachedEmailTemplateForBusiness(businessId) {
  return (
    emailTemplateCache.get(cacheKeyForBusiness(businessId)) ||
    getDefaultEmailTemplateDoc()
  );
}

export function primeEmailTemplateCache(businessId, templateDoc) {
  if (!templateDoc?.htmlContent) return;
  emailTemplateCache.set(cacheKeyForBusiness(businessId), templateDoc);
}

/**
 * @param {Array<{ isActive?: boolean, type?: string, templateId?: object }>} assignments
 * @param {(assignmentType: string, templateType: string) => boolean} typeMatcher
 */
export function filterActiveAssignmentsByType(assignments, typeMatcher) {
  return (assignments || []).filter((a) => {
    if (!a || a.isActive !== true) return false;
    return typeMatcher(a.type, a.templateId?.type);
  });
}

/**
 * Dedupe full template objects from assignment rows.
 */
export function uniqueTemplateObjectsFromAssignments(assignments, typeMatcher) {
  const rows = filterActiveAssignmentsByType(assignments, typeMatcher);
  const objs = rows.map((a) => a.templateId).filter(Boolean);
  const seen = new Set();
  const out = [];
  for (const t of objs) {
    const id = String(t._id || t.id || "");
    if (!id || id === "undefined" || seen.has(id)) continue;
    seen.add(id);
    out.push(t);
  }
  return out;
}

/**
 * Prefer isDefault active assignment, else first active match.
 */
export function pickDefaultTemplateFromAssignments(assignments, typeMatcher) {
  const rows = filterActiveAssignmentsByType(assignments, typeMatcher);
  const def = rows.find((a) => a.isDefault);
  if (def?.templateId) return def.templateId;
  return rows[0]?.templateId || null;
}

export async function fetchBusinessTemplateAssignments(businessId, headers = {}) {
  const res = await axios.get(`${Base_URL}/business-templates/${businessId}`, {
    headers,
  });
  return res?.data?.data || [];
}

export async function fetchDocumentTemplateById(templateId, headers = {}) {
  if (!templateId) return null;
  const res = await axios.get(`${Base_URL}/document-templates/${templateId}`, {
    headers,
  });
  return res?.data?.data || res?.data || null;
}

export function isEmailDocumentTemplateType(assignmentType, templateType) {
  const assignment = String(assignmentType || "").toLowerCase();
  const template = String(templateType || "").toLowerCase();
  return assignment === "email" || template === "email";
}

export async function fetchDocumentTemplateByName(name, headers = {}) {
  if (!name) return null;
  const encoded = encodeURIComponent(name);
  try {
    const res = await axios.get(
      `${Base_URL}/document-templates/name/${encoded}`,
      { headers },
    );
    if (res.data?.success && res.data?.data) return res.data.data;
  } catch (_) {
    // fall through
  }
  return null;
}

/**
 * Prefer the business default active email assignment, else global Standard Email Template.
 */
export async function resolveEmailTemplateForBusiness(businessId, headers = {}) {
  const cacheKey = cacheKeyForBusiness(businessId);
  if (emailTemplateCache.has(cacheKey)) {
    return emailTemplateCache.get(cacheKey);
  }

  if (emailTemplateInflight.has(cacheKey)) {
    return emailTemplateInflight.get(cacheKey);
  }

  const fetchPromise = (async () => {
    try {
      if (businessId) {
        const assignments = await fetchBusinessTemplateAssignments(businessId, headers);
        const assigned = pickDefaultTemplateFromAssignments(
          assignments,
          isEmailDocumentTemplateType,
        );
        if (assigned?.htmlContent) {
          emailTemplateCache.set(cacheKey, assigned);
          return assigned;
        }
        if (assigned?._id) {
          const full = await fetchDocumentTemplateById(assigned._id, headers);
          if (full?.htmlContent) {
            emailTemplateCache.set(cacheKey, full);
            return full;
          }
        }
      }

      const global = await fetchDocumentTemplateByName(
        STANDARD_EMAIL_TEMPLATE_NAME,
        headers,
      );
      if (global?.htmlContent) {
        emailTemplateCache.set(cacheKey, global);
        return global;
      }

      const fallback = getDefaultEmailTemplateDoc();
      emailTemplateCache.set(cacheKey, fallback);
      return fallback;
    } finally {
      emailTemplateInflight.delete(cacheKey);
    }
  })();

  emailTemplateInflight.set(cacheKey, fetchPromise);
  return fetchPromise;
}

export function sanitizeTemplateHtmlForIframe(htmlContent, profileSignature = "") {
  const html = String(htmlContent || "");
  return html
    .replace(/<%= ?contract\.businessLogo ?%>/g, "/api/placeholder/200/100")
    .replace(
      /<%= ?contract\.(signature|authorizedSignature|approver_signature) ?%>/g,
      profileSignature || "",
    )
    .replace(/<%= ?[^%]+ ?%>/g, "");
}
