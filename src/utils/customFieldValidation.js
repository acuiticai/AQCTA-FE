const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const URL_RE = /^https?:\/\/.+/i;

export function validateCustomFieldValues(definitions, values) {
  for (const def of definitions || []) {
    const key = def.field_key;
    const v = values?.[key];
    const t = def.data_type;

    const empty =
      v === null ||
      v === undefined ||
      (typeof v === "string" && !String(v).trim()) ||
      (Array.isArray(v) && v.length === 0);

    if (def.is_required && t === "checkbox" && !v) {
      return `${def.label} is required`;
    }
    if (def.is_required && empty && t !== "checkbox" && t !== "auto_number") {
      return `${def.label} is required`;
    }
    if (empty && t !== "checkbox") continue;

    if (t === "email" && !EMAIL_RE.test(String(v))) {
      return `${def.label}: invalid email`;
    }
    if (t === "url" && !URL_RE.test(String(v))) {
      return `${def.label}: invalid URL`;
    }
    if (
      (t === "number" ||
        t === "decimal" ||
        t === "currency" ||
        t === "percentage") &&
      !Number.isFinite(Number(v))
    ) {
      return `${def.label}: must be a number`;
    }
    if ((t === "date" || t === "datetime") && Number.isNaN(Date.parse(String(v)))) {
      return `${def.label}: invalid date`;
    }
    if (t === "dropdown" && def.options?.length && !def.options.includes(String(v))) {
      return `${def.label}: invalid option`;
    }
    if (t === "multi_select" && def.options?.length) {
      const bad = (v || []).filter((x) => !def.options.includes(String(x)));
      if (bad.length) return `${def.label}: invalid option`;
    }
  }
  return null;
}
