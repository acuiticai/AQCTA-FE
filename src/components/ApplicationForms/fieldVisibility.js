/**
 * Client-side twin of the server's `isFieldVisible` in
 * AQCTA-BE/ApplicationForms/valueResolver.js.
 *
 * Both sides must agree: this decides what renders, the server decides what is
 * required and what is saved. Keep the two in step — a divergence shows up as a
 * field the user cannot see but cannot submit past.
 */
export const isFieldVisible = (field, values = {}) => {
  const rule = field?.visibleWhen;
  if (!rule || !rule.field) return true;

  const actual = String(values?.[rule.field] ?? "")
    .trim()
    .toLowerCase();
  if (!actual) return false;

  if (rule.equals !== undefined && rule.equals !== null && rule.equals !== "") {
    return actual === String(rule.equals).trim().toLowerCase();
  }
  if (rule.startsWith) {
    return actual.startsWith(String(rule.startsWith).trim().toLowerCase());
  }
  if (Array.isArray(rule.in) && rule.in.length) {
    return rule.in.some((v) => String(v).trim().toLowerCase() === actual);
  }
  return true;
};

export default isFieldVisible;
