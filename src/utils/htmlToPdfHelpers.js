import axios from "axios";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL || "";

/**
 * Build absolute URL for PDF assets (relative API paths need the API origin for Puppeteer).
 * Same rules as SalesOrderEmailPreview / invoice PDF flow.
 */
export function normalizeAssetUrlForPdf(url) {
  if (url == null) return "";
  const t = String(url).trim();
  if (!t) return "";
  if (t.startsWith("data:")) return t;
  if (t.startsWith("//")) return `https:${t}`;
  if (/^https?:\/\//i.test(t)) return t;
  if (t.startsWith("/")) {
    const base = (Base_URL || "").replace(/\/$/, "");
    return base ? `${base}${t}` : t;
  }
  return t;
}

/**
 * Fetch image as data URI for POST /html-to-pdf (server cannot use the browser session for hot links).
 * Mirrors SalesOrderEmailPreview: same-origin axios + Bearer, then CORS fetch fallback.
 *
 * @param {string} imageUrl
 * @param {{ token?: string } | null} adminInfo
 */
export async function fetchImageAsDataUriForPdf(imageUrl, adminInfo) {
  const normalizedUrl = normalizeAssetUrlForPdf(imageUrl);
  if (!normalizedUrl) return null;
  if (normalizedUrl.startsWith("data:")) return normalizedUrl;
  if (!/^https?:\/\//i.test(normalizedUrl)) return null;
  try {
    let imageBase64 = null;
    const baseUrlClean = (Base_URL || "").replace(/\/$/, "");
    const isSameOrigin = baseUrlClean && normalizedUrl.startsWith(baseUrlClean);
    if (isSameOrigin && adminInfo?.token) {
      const imgRes = await axios.get(normalizedUrl, {
        responseType: "arraybuffer",
        headers: { authorization: `Bearer ${adminInfo.token}` },
      });
      const bytes = new Uint8Array(imgRes.data);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++)
        binary += String.fromCharCode(bytes[i]);
      const b64 = typeof btoa !== "undefined" ? btoa(binary) : "";
      const contentType = imgRes.headers?.["content-type"] || "image/png";
      imageBase64 = b64 ? `data:${contentType};base64,${b64}` : null;
    }
    if (!imageBase64) {
      const imageResponse = await fetch(normalizedUrl, {
        mode: "cors",
        credentials: "omit",
      });
      if (!imageResponse.ok) return null;
      const imageBlob = await imageResponse.blob();
      imageBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(imageBlob);
      });
    }
    return imageBase64 || null;
  } catch (err) {
    console.warn("fetchImageAsDataUriForPdf:", err);
    return null;
  }
}

/** Table/layout safety for Chromium PDF — same injection as sale order / invoice emails. */
export function injectInvoicePdfSafetyStyles(html) {
  if (!html || typeof html !== "string") return html;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    if (doc.body) {
      doc.body.classList.add("invoice-pdf");
    }
    const style = doc.createElement("style");
    style.setAttribute("data-flexa-invoice-pdf-safety", "1");
    style.textContent = `
      body.invoice-pdf {
        overflow: visible !important;
        height: auto !important;
        max-height: none !important;
        box-sizing: border-box;
      }
      body.invoice-pdf table {
        width: 100% !important;
        max-width: 100% !important;
        border-collapse: collapse;
        margin: 0 !important;
        box-sizing: border-box;
        table-layout: auto;
      }
      body.invoice-pdf .items-table,
      body.invoice-pdf table.items-table {
        width: 100% !important;
        max-width: 100% !important;
        margin-left: 0 !important;
        margin-right: 0 !important;
      }
      /* Sale order / quotation summary: do not stretch totals to full page width */
      body.invoice-pdf .totals-wrap {
        display: flex !important;
        justify-content: flex-end !important;
        width: 100% !important;
        box-sizing: border-box;
      }
      body.invoice-pdf table.totals-table,
      body.invoice-pdf .totals-table {
        width: 320px !important;
        max-width: 100% !important;
        margin-left: auto !important;
        margin-right: 0 !important;
      }
      body.invoice-pdf thead { display: table-header-group; }
      body.invoice-pdf tbody { display: table-row-group; }
      body.invoice-pdf tr { display: table-row; }
      body.invoice-pdf th, body.invoice-pdf td {
        display: table-cell;
        box-sizing: border-box;
      }
      body.invoice-pdf .items-table thead tr {
        border-bottom: 2px solid #777 !important;
      }
      body.invoice-pdf .items-table tbody tr {
        border-bottom: 1px solid #e5e5e5 !important;
      }
    `;
    doc.head?.appendChild(style);
    const out = doc.documentElement.outerHTML;
    return /<!doctype/i.test(html) ? `<!DOCTYPE html>${out}` : out;
  } catch {
    return html;
  }
}

export function downloadPdfBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "document.pdf";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
