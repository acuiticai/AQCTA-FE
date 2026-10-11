import {
  formatWhatsappDisplay,
  getRecipientPhoneRegion,
  inferPhoneRegionFromValue,
  parseNationalDigits,
} from "@/utils/whatsappPhoneFormat";

import axios from "axios";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

export function getCustomerDisplayName(customer) {
  const bi = customer?.basicInformation || {};
  const fromContact = [bi.primaryContact?.firstName, bi.primaryContact?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  return (
    bi.customerDisplayName?.trim() ||
    bi.companyName?.trim() ||
    fromContact ||
    "Customer"
  );
}

function pickFirstNonEmptyString(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

/** Customer Email — basic info, legacy fields, or first key contact. */
export function getCustomerEmail(customer) {
  const bi = customer?.basicInformation || {};
  const keyContact = (customer?.keyContacts || []).find(
    (kc) => pickFirstNonEmptyString(kc?.email),
  );
  return pickFirstNonEmptyString(
    bi.customerEmail,
    bi.email,
    customer?.customerEmail,
    customer?.email,
    keyContact?.email,
  );
}

/** Customer Phone — mobile, work, string field, key contact, or address phone. */
export function getCustomerPhone(customer) {
  const bi = customer?.basicInformation || {};
  const cp = bi.customerPhone;
  if (typeof cp === "string") {
    return pickFirstNonEmptyString(cp);
  }
  const fromPhoneObject = pickFirstNonEmptyString(cp?.mobile, cp?.workPhone);
  if (fromPhoneObject) return fromPhoneObject;

  const keyContact = (customer?.keyContacts || []).find(
    (kc) => pickFirstNonEmptyString(kc?.contactNumber),
  );
  const addressWithPhone = (customer?.addresses || []).find((addr) =>
    pickFirstNonEmptyString(addr?.phone),
  );

  return pickFirstNonEmptyString(
    bi.phone,
    bi.mobile,
    bi.workPhone,
    keyContact?.contactNumber,
    addressWithPhone?.phone,
  );
}

/** Whether customer has email only, phone only, or both. */
export function getCustomerContactKinds(customer) {
  const hasEmail = Boolean(getCustomerEmail(customer));
  const hasPhone = Boolean(getCustomerPhone(customer));
  return { hasEmail, hasPhone, hasBoth: hasEmail && hasPhone };
}

export function isContactableCustomer(customer) {
  return Boolean(getCustomerEmail(customer) || getCustomerPhone(customer));
}

export function customerToRecipient(customer, phoneRegion) {
  const name = getCustomerDisplayName(customer);
  const email = getCustomerEmail(customer);
  const rawPhone = getCustomerPhone(customer);
  const region =
    phoneRegion || inferPhoneRegionFromValue(rawPhone) || getRecipientPhoneRegion({});
  const whatsappNumber = rawPhone
    ? formatWhatsappDisplay(rawPhone, region)
    : "";
  return {
    customerId: customer?._id,
    name,
    email,
    whatsappNumber,
    phoneRegion: region,
  };
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizePhone(value, region) {
  return parseNationalDigits(value, region);
}

export function isDuplicateRecipient(list, candidate) {
  const email = normalizeEmail(candidate.email);
  const candidateRegion = getRecipientPhoneRegion(candidate);
  const phone = normalizePhone(candidate.whatsappNumber, candidateRegion);
  const customerId = candidate.customerId
    ? String(candidate.customerId)
    : "";

  return (list || []).some((row) => {
    if (customerId && row.customerId && String(row.customerId) === customerId) {
      return true;
    }
    if (email && normalizeEmail(row.email) === email) return true;
    const rowRegion = getRecipientPhoneRegion(row);
    if (phone && normalizePhone(row.whatsappNumber, rowRegion) === phone) {
      return true;
    }
    return false;
  });
}

/**
 * Merge customer rows into manual recipients (dedupe by customer id, email, or phone).
 */
export function mergeCustomerRecipients(existingRecipients, customers) {
  const base = (existingRecipients || []).filter(
    (r) => r.name?.trim() || r.email?.trim() || r.whatsappNumber?.trim(),
  );
  const merged = [...base];
  let added = 0;
  let skippedDuplicate = 0;
  let skippedNoContact = 0;

  for (const customer of customers || []) {
    if (!isContactableCustomer(customer)) {
      skippedNoContact += 1;
      continue;
    }
    const row = customerToRecipient(customer);
    if (!row.email && !row.whatsappNumber) {
      skippedNoContact += 1;
      continue;
    }
    if (isDuplicateRecipient(merged, row)) {
      skippedDuplicate += 1;
      continue;
    }
    merged.push(row);
    added += 1;
  }

  return { recipients: merged, added, skippedDuplicate, skippedNoContact };
}

export function mergeImportedRecipients(existingRecipients, importedRows) {
  const base = (existingRecipients || []).filter(
    (r) => r.name?.trim() || r.email?.trim() || r.whatsappNumber?.trim(),
  );
  const merged = [...base];
  let added = 0;
  let skippedDuplicate = 0;

  for (const row of importedRows || []) {
    if (!row?.name?.trim() && !row?.email?.trim() && !row?.whatsappNumber?.trim()) {
      continue;
    }
    if (isDuplicateRecipient(merged, row)) {
      skippedDuplicate += 1;
      continue;
    }
    merged.push(row);
    added += 1;
  }

  return { recipients: merged, added, skippedDuplicate };
}

export function downloadRecipientsCsv(recipients, filename = "recipients.csv") {
  const rows = (recipients || []).filter(
    (r) => r.name?.trim() || r.email?.trim() || r.whatsappNumber?.trim(),
  );
  const escape = (v) => {
    const s = String(v ?? "");
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const header = "Name,WhatsApp Number,Email\n";
  const body = rows
    .map((r) =>
      [escape(r.name), escape(r.whatsappNumber), escape(r.email)].join(","),
    )
    .join("\n");
  const blob = new Blob([header + body], { type: "text/csv;charset=utf-8" });
  const urlObj = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = urlObj;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(urlObj);
}

export function safeCampaignExportFilename(title) {
  return String(title || "campaign")
    .trim()
    .replace(/[^a-z0-9_-]+/gi, "_")
    .slice(0, 60);
}

export async function exportCampaignRecipientsFromApi({
  campaignId,
  campaignTitle,
  authHeaders,
  checkTokenExpired,
  recipientCount,
}) {
  if (!campaignId) {
    throw new Error("Campaign id is required");
  }
  if ((recipientCount ?? 0) <= 0) {
    throw new Error("No recipients to export");
  }

  const response = await axios.get(
    `${Base_URL}/broadcasts/${campaignId}/recipients/export`,
    {
      responseType: "blob",
      headers: authHeaders,
    },
  );
  if (checkTokenExpired?.(response)) {
    return { cancelled: true };
  }

  const safeTitle = safeCampaignExportFilename(campaignTitle);
  const blob = new Blob([response.data], {
    type:
      response.headers["content-type"] ||
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const urlObj = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = urlObj;
  a.download = `${safeTitle || "recipients"}_recipients.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(urlObj);
  return { count: recipientCount };
}

export function getCustomerSelectLabel(customer) {
  const name = getCustomerDisplayName(customer);
  const email = getCustomerEmail(customer);
  const phone = getCustomerPhone(customer);
  const contactParts = [];
  if (email) contactParts.push(email);
  if (phone) contactParts.push(phone);
  const { hasEmail, hasPhone, hasBoth } = getCustomerContactKinds(customer);
  const kindTag = hasBoth
    ? "email + phone"
    : hasEmail
      ? "email only"
      : hasPhone
        ? "phone only"
        : "";
  const detail = contactParts.length ? contactParts.join(" · ") : "";
  if (detail && kindTag) return `${name} — ${detail} (${kindTag})`;
  if (detail) return `${name} — ${detail}`;
  return name;
}
