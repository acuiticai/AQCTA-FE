/** MIME types and extensions allowed for application supporting documents. */
const ACCEPTED_EXTENSIONS = new Set([
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "zip",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
]);

const ACCEPTED_MIME_PREFIXES = ["image/"];

const ACCEPTED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
  "application/x-zip-compressed",
  "application/x-zip",
  "application/octet-stream",
]);

/**
 * Value for <input type="file" accept="…">.
 * Include MIME types (not only extensions) so macOS does not grey out valid PDFs.
 */
export const APPLICATION_DOCUMENT_ACCEPT =
  "image/*," +
  "application/pdf," +
  "application/msword," +
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document," +
  "application/vnd.ms-excel," +
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet," +
  "application/zip," +
  "application/x-zip-compressed," +
  ".pdf,.doc,.docx,.xls,.xlsx,.zip";

/** Human-readable list for validation error messages. */
export const APPLICATION_DOCUMENT_ACCEPT_LABEL =
  "PDF, Word, Excel, ZIP, or image files";

function getNormalizedExtension(fileName = "") {
  const trimmed = String(fileName).trim();
  const lastDot = trimmed.lastIndexOf(".");
  if (lastDot < 1) return "";
  return trimmed.slice(lastDot + 1).trim().toLowerCase();
}

/** True when the selected file is an allowed application document type. */
export function isAcceptedApplicationDocument(file) {
  if (!file) return false;

  const extension = getNormalizedExtension(file.name);
  if (extension && ACCEPTED_EXTENSIONS.has(extension)) {
    return true;
  }

  const mime = String(file.type || "").trim().toLowerCase();
  if (!mime) {
    return false;
  }

  if (mime === "application/octet-stream") {
    return Boolean(extension && ACCEPTED_EXTENSIONS.has(extension));
  }

  if (ACCEPTED_MIME_TYPES.has(mime)) {
    return true;
  }

  return ACCEPTED_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix));
}

export function getApplicationDocumentValidationError(file) {
  if (!file) return "No file selected.";
  if (isAcceptedApplicationDocument(file)) return "";
  return `“${file.name}” is not a supported file type. Please upload ${APPLICATION_DOCUMENT_ACCEPT_LABEL}.`;
}
