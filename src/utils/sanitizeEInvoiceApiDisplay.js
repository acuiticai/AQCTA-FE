/**
 * Deep-clone and replace string `password` fields for safe on-screen / copy JSON.
 */
export function redactPasswordsForDisplay(value) {
  if (value == null) return value;
  if (Array.isArray(value)) {
    return value.map((item) => redactPasswordsForDisplay(item));
  }
  if (typeof value === "object") {
    const out = {};
    for (const k of Object.keys(value)) {
      if (k === "password" && typeof value[k] === "string") {
        out[k] = "[redacted]";
      } else {
        out[k] = redactPasswordsForDisplay(value[k]);
      }
    }
    return out;
  }
  return value;
}
