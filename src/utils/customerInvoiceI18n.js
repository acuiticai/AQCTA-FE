import i18n from "@/i18n";

const toVisibleKey = (text) => {
  const value = String(text).trim();
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return `${slug}_${(hash >>> 0).toString(36)}`;
};

/**
 * Translates static Customer Invoice UI copy from helpers and module-level
 * render functions where React hooks cannot be used.
 */
export const customerInvoiceText = (text, options = {}) =>
  i18n.t(
    `accounts.customerInvoices.visible.${toVisibleKey(text)}`,
    {
      defaultValue: text,
      ...options,
    },
  );

export default customerInvoiceText;
