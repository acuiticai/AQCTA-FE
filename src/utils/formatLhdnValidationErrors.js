/**
 * MyInvois / LHDN validation errors from PCI-BE use `{ field, message }`
 * (sometimes `error`). For toasts, keep copy short — SweetAlert chokes on
 * multi-line bullets. Strip `foo.bar:` when it leaks into `message`.
 * Map bare "Validation Error" / known codes into plain-language copy.
 */

const LHDN_CODE_FRIENDLY = {
  CF321:
    "This invoice can't be submitted because its issue date is too old.",
  CF334:
    "Business TIN does not match your MyInvois account. Check e-invoice settings.",
  CF404:
    "Customer ID type or number is invalid. Check the customer’s e-invoice details.",
  CF405: "Postal code must be at most 5 digits (e.g. 51200).",
  CF408: "Phone number is too short. Check business or customer phone.",
  CF419:
    "Customer TIN is invalid. Check the customer’s TIN in e-invoice details.",
  ERR236: "Item classification is wrong for a consolidated e-invoice.",
  CV317: "State code is wrong for a consolidated e-invoice.",
};

function isGenericLhdnValidationLabel(msg) {
  return /^validation\s*errors?$/i.test(String(msg || "").trim());
}

function toFriendlyLhdnUserMessage(code, message) {
  const c = String(code || "")
    .trim()
    .toUpperCase();
  if (LHDN_CODE_FRIENDLY[c]) return LHDN_CODE_FRIENDLY[c];

  const m = String(message || "").trim();
  if (!m || isGenericLhdnValidationLabel(m)) {
    return "MyInvois rejected this document. Check e-invoice details and try again.";
  }
  if (/issuance date time|too old that cannot be submitted/i.test(m)) {
    return LHDN_CODE_FRIENDLY.CF321;
  }
  if (/authenticated TIN|documents TIN|not matching/i.test(m)) {
    return LHDN_CODE_FRIENDLY.CF334;
  }
  if (/postal\s*zone|postal\s*code/i.test(m) && /5|length|digit/i.test(m)) {
    return LHDN_CODE_FRIENDLY.CF405;
  }
  if (/contact|phone|telephone/i.test(m) && /length|digit|short|minimum/i.test(m)) {
    return LHDN_CODE_FRIENDLY.CF408;
  }
  return m.length > 160 ? `${m.slice(0, 159)}…` : m;
}

/** `sourceInvoice.lhdn_status:` / `Business.companyName:` etc. (needs at least two segments). */
function stripTechnicalFieldPrefix(text) {
  const s = String(text).trim();
  if (!s) return s;
  return s.replace(/^[\w]+(?:\.[\w]+)+\s*:\s*/i, "").trim();
}

export function getLhdnValidationUserMessage(e) {
  if (e == null) {
    return "Something went wrong. Please try again.";
  }
  if (typeof e === "string") {
    const stripped = stripTechnicalFieldPrefix(e);
    return toFriendlyLhdnUserMessage(null, stripped || e);
  }
  if (typeof e !== "object") {
    return "Something went wrong. Please try again.";
  }
  const raw = String(e.message ?? e.error ?? "").trim();
  const stripped = stripTechnicalFieldPrefix(raw) || raw;
  const code = e.code != null ? String(e.code) : null;
  if (stripped || code) {
    return toFriendlyLhdnUserMessage(code, stripped);
  }
  const f = String(e.field ?? "").trim();
  return f || "Please check the form and try again.";
}

function dedupePreserveOrder(strings) {
  const seen = new Set();
  return strings.filter((t) => {
    if (!t || seen.has(t)) return false;
    seen.add(t);
    return true;
  });
}

/**
 * Compact one-line summary for error toasts (default).
 */
function buildCompactLhdnValidationToast(validationErrors, intro) {
  const list = Array.isArray(validationErrors) ? validationErrors : [];
  if (!list.length) {
    return `${intro}. Please try again.`;
  }

  const normalized = list.map((e) => ({
    field: typeof e === "object" && e != null ? String(e.field ?? "") : "",
    text: getLhdnValidationUserMessage(e),
  }));

  const fieldBlob = normalized.map((x) => x.field).join(" ");
  const textBlob = normalized.map((x) => x.text).join(" ");

  const linked =
    /sourceInvoice|customerInvoice/i.test(fieldBlob) ||
    /\blinked (customer )?invoice\b/i.test(textBlob);

  if (linked) {
    const needsValid =
      /lhdn_status|\bPending\b|\bInvalid\b|\bRejected\b|\bSubmitted\b|\bValid\b|\bnot accepted\b|must be Valid|shows Valid/i.test(
        `${fieldBlob} ${textBlob}`,
      );
    const needsUuid = /\.uuid\b|document ID|document id|\buuid\b/i.test(
      `${fieldBlob} ${textBlob}`,
    );

    if (needsValid && needsUuid) {
      return `${intro}. Open the linked invoice, submit or refresh until it's Valid, then try again.`;
    }
    if (needsUuid) {
      return `${intro}. Refresh or resubmit the linked invoice on MyInvois first.`;
    }
    if (needsValid) {
      return `${intro}. The linked invoice must be Valid on MyInvois before you can submit this note.`;
    }
    return `${intro}. Fix the linked customer invoice on MyInvois, then try again.`;
  }

  const first = normalized[0].text;
  // Self-contained messages — show alone (no long "Couldn't submit…" prefix).
  if (
    /issue date is too old|CF321/i.test(first) ||
    list.some(
      (e) =>
        typeof e === "object" &&
        e != null &&
        String(e.code || "").toUpperCase() === "CF321",
    )
  ) {
    return LHDN_CODE_FRIENDLY.CF321;
  }

  const maxTail = 140;
  const tail =
    first.length > maxTail ? `${first.slice(0, maxTail - 1)}…` : first;
  return `${intro}. ${tail}`;
}

/**
 * Multi-line bullet list (optional; debugging or detailed UI).
 */
function formatLhdnValidationErrorsVerbose(validationErrors, intro, opts) {
  const maxLines = opts.maxLines ?? 8;
  const list = Array.isArray(validationErrors) ? validationErrors : [];
  const msgs = list
    .slice(0, maxLines)
    .map(getLhdnValidationUserMessage)
    .filter(Boolean);
  const unique = dedupePreserveOrder(msgs);
  if (!unique.length) {
    return `${intro}. Please try again, or contact support if this keeps happening.`;
  }
  const suffix = list.length > maxLines ? "\n…" : "";
  return `${intro}:\n${unique.map((t) => `• ${t}`).join("\n")}${suffix}`;
}

/**
 * @param {unknown[]} validationErrors
 * @param {string} [intro]
 * @param {{ maxLines?: number, verbose?: boolean }} [opts]
 * - Default: short single-message toast (recommended for SweetAlert).
 * - `verbose: true`: prior multi-line bullet behaviour.
 */
export function formatLhdnValidationErrorsNotifyBody(
  validationErrors,
  intro = "Couldn't submit to MyInvois (LHDN)",
  opts = {},
) {
  if (opts.verbose === true) {
    return formatLhdnValidationErrorsVerbose(validationErrors, intro, opts);
  }
  return buildCompactLhdnValidationToast(validationErrors, intro);
}
