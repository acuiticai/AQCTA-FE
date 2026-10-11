const fs = require("fs");
const files = [
  "src/pages/Accounts/CustomerInvoice/components/InvoiceRenderer.jsx",
  "src/pages/Accounts/CustomerInvoice/DocumentGenerator.jsx",
  "src/pages/Accounts/CustomerInvoice/document-viewer.jsx",
  "src/pages/Accounts/CustomerInvoice/useCreditDebitNoteLhdnActions.jsx",
  "src/pages/Accounts/CustomerInvoice/CustomerInvoice.jsx",
];
const toKey = (text) => {
  const value = text.trim();
  const slug = value
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
const references = new Set();
for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  for (const pattern of [
    /ciText\(\s*"((?:\\.|[^"\\])*)"/g,
    /ciText\(\s*'((?:\\.|[^'\\])*)'/g,
  ]) {
    let match;
    while ((match = pattern.exec(source))) {
      references.add(
        pattern.source.includes('"')
          ? JSON.parse(`"${match[1]}"`)
          : match[1],
      );
    }
  }
}
for (const locale of ["en", "id", "ar"]) {
  const visible = JSON.parse(
    fs.readFileSync(`src/utils/translation/${locale}.json`, "utf8"),
  ).accounts.customerInvoices.visible;
  const missing = [...references].filter(
    (text) => !Object.prototype.hasOwnProperty.call(visible, toKey(text)),
  );
  console.log(locale, "references", references.size, "missing", missing.length);
  if (locale === "en" && missing.length) console.log(JSON.stringify(missing, null, 2));
  if (missing.length) process.exitCode = 1;
}
