import { fetchPdfPayload } from "@/services/customFieldServices";

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatCustomFieldPdfValue(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) {
    return v.map((item) => formatCustomFieldPdfValue(item)).filter(Boolean).join(", ");
  }
  if (typeof v === "object") {
    const preferred =
      v.label ??
      v.name ??
      v.title ??
      v.value ??
      v.displayName ??
      v.text ??
      "";
    if (preferred !== "") return String(preferred);
    return JSON.stringify(v);
  }
  return String(v);
}

function hasMeaningfulCustomFieldPdfValue(v) {
  const formatted = formatCustomFieldPdfValue(v);
  return String(formatted).trim() !== "";
}

export function buildCustomFieldsPdfTableHtml(rows) {
  if (!rows?.length) return "";
  const body = rows
    .map(
      (r) =>
        `<tr><td style="padding:6px 10px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb;">${escapeHtml(r.label)}</td><td style="padding:6px 10px;border:1px solid #e5e7eb;">${escapeHtml(formatCustomFieldPdfValue(r.value))}</td></tr>`,
    )
    .join("");
  return `<div class="custom-fields-pdf" data-flexa-cf-doc="1" style="margin-top:20px;page-break-inside:avoid;"><div style="font-weight:700;margin-bottom:8px;font-size:13px;">Custom fields</div><table style="width:100%;border-collapse:collapse;font-size:12px;">${body}</table></div>`;
}

function serializeDocLikeInput(doc, originalHtml) {
  if (!doc) return originalHtml;
  const source = String(originalHtml || "");
  const hadFullDocument =
    /<\s*html[\s>]/i.test(source) ||
    /<\s*head[\s>]/i.test(source) ||
    /<\s*body[\s>]/i.test(source) ||
    /<!doctype/i.test(source);
  if (!hadFullDocument) {
    return doc.body ? doc.body.innerHTML : doc.documentElement.outerHTML;
  }
  const serialized = doc.documentElement.outerHTML;
  return /<!doctype/i.test(source) ? `<!DOCTYPE html>${serialized}` : serialized;
}

/**
 * Removes PCI-injected PDF custom field blocks/columns so HTML can be re-enriched
 * (e.g. preview already applied + download enriches again — avoids duplicates).
 */
export function stripPdfCustomFieldInjectionsFromHtml(html) {
  if (!html || typeof html !== "string") return html;
  let doc;
  try {
    doc = new DOMParser().parseFromString(html, "text/html");
  } catch {
    return html;
  }
  doc.querySelectorAll(".custom-fields-pdf, [data-flexa-cf-doc]").forEach((el) =>
    el.remove(),
  );
  doc.querySelectorAll("[data-flexa-cf-line]").forEach((el) => el.remove());
  doc.querySelectorAll("[data-flexa-cf-header]").forEach((el) => el.remove());
  return serializeDocLikeInput(doc, html);
}

export function injectCustomFieldsIntoHtml(html, fragment) {
  if (!fragment) return html;
  if (typeof html !== "string") return html;
  if (html.includes("</body>")) {
    return html.replace("</body>", `${fragment}</body>`);
  }
  return `${html}${fragment}`;
}

function headerCellText(th) {
  return (th.textContent || "").replace(/\s+/g, " ").trim();
}

/**
 * Index of the "Description" column so custom fields sit after it (before Qty / Price / …).
 */
function findDescriptionInsertIndex(ths) {
  if (!ths?.length) return 2;
  let idx = ths.findIndex((th) => /description/i.test(headerCellText(th)));
  if (idx >= 0) return idx;
  idx = ths.findIndex((th) =>
    /item\s*[&/|]\s*description/i.test(headerCellText(th)),
  );
  if (idx >= 0) return idx;
  if (ths.length >= 4) return 2;
  return Math.min(2, ths.length - 1);
}

/** Direct table cells on a row (ignores nested tables). */
function directTableCells(tr) {
  if (!tr?.children?.length) return [];
  return Array.from(tr.children).filter((n) => {
    const t = n.tagName;
    return t === "TD" || t === "TH";
  });
}

function isDataBodyRow(tr) {
  return directTableCells(tr).some((c) => c.tagName === "TD");
}

/**
 * Pick the tbody that actually holds invoice line rows. Multiple tbodies can
 * share the same row count (layout wrappers); prefer .items-table and rich rows.
 */
function pickBestLineItemsTbody(doc, nData) {
  let bestTb = null;
  let bestScore = -1;
  doc.querySelectorAll("tbody").forEach((tb) => {
    const allBodyTrs = Array.from(tb.querySelectorAll(":scope > tr"));
    const dataRows = allBodyTrs.filter(isDataBodyRow);
    if (!dataRows.length) return;
    const c = dataRows.length;
    const table = tb.closest("table");
    if (!table) return;
    const rowMatch = c === nData;
    let score = 0;
    if (rowMatch) score += 1000;
    else if (nData > 0 && c >= nData) score += 200 - Math.min(c - nData, 50);
    const cls = (table.getAttribute("class") || "").toLowerCase();
    if (cls.includes("items-table") || cls.includes("items_table")) score += 600;
    const id = (table.getAttribute("id") || "").toLowerCase();
    if (id.includes("item") || id.includes("line")) score += 120;
    const sample = (table.outerHTML || "").slice(0, 14000).toLowerCase();
    if (
      (sample.includes("quantity") || sample.includes("qty")) &&
      (sample.includes("item") || sample.includes("description"))
    )
      score += 180;
    const firstRowCells = directTableCells(dataRows[0]);
    const ncol = firstRowCells.length;
    score += Math.min(ncol, 24) * 8;
    if (ncol > 0 && ncol < 4) score -= 120;
    if (c === 1 && nData === 1 && ncol < 4) score -= 200;
    if (score > bestScore) {
      bestScore = score;
      bestTb = tb;
    }
  });
  return bestTb;
}

/**
 * Replaces data rows in the same tbody used for PDF line-item custom fields,
 * preserving header-only rows inside that tbody (e.g. duplicated column titles).
 * @param {string} html
 * @param {number} rowCount expected number of line rows (must match rowsHtml)
 * @param {string} rowsHtml concatenated <tr>...</tr> HTML
 * @returns {string}
 */
export function replaceLineItemsTbodyRowsHtml(html, rowCount, rowsHtml) {
  if (!html || typeof html !== "string" || !rowsHtml || rowCount < 1) return html;
  let doc;
  try {
    doc = new DOMParser().parseFromString(html, "text/html");
  } catch {
    return html;
  }
  const tb = pickBestLineItemsTbody(doc, rowCount);
  if (!tb) return html;

  let newRows;
  try {
    const wrap = new DOMParser().parseFromString(
      `<body><table><tbody>${rowsHtml}</tbody></table></body>`,
      "text/html",
    );
    newRows = wrap.querySelectorAll("tbody > tr");
    if (!newRows.length) return html;
  } catch {
    return html;
  }

  Array.from(tb.querySelectorAll(":scope > tr"))
    .filter(isDataBodyRow)
    .forEach((tr) => tr.remove());

  newRows.forEach((tr) => {
    tb.appendChild(doc.importNode(tr, true));
  });

  return serializeDocLikeInput(doc, html);
}

function copyLineItemCellSurface(source, target) {
  if (!source || !target) return;
  const cls = source.className;
  if (cls) target.className = cls;
  const st = source.getAttribute("style");
  if (st) target.setAttribute("style", st);
}

function pickBestInvoiceMetaContainer(doc) {
  const candidates = [
    ...doc.querySelectorAll(".invoice-details, .invoice-meta, .document-meta"),
  ];
  let best = null;
  let bestScore = -1;
  candidates.forEach((el) => {
    const text = (el.textContent || "").replace(/\s+/g, " ").toUpperCase();
    let score = 0;
    if (text.includes("DATE")) score += 40;
    if (text.includes("DUE DATE")) score += 40;
    if (text.includes("INVOICE NO")) score += 40;
    if (text.includes("SALES TYPE")) score += 25;
    if (text.includes("SALES PERSON")) score += 25;
    score += el.querySelectorAll(":scope > .detail-row").length * 10;
    if (score > bestScore) {
      best = el;
      bestScore = score;
    }
  });
  return bestScore >= 40 ? best : null;
}

function buildInjectedMetaRow(doc, templateRow, label, value) {
  const row = templateRow.cloneNode(true);
  row.setAttribute("data-flexa-cf-header", "1");

  const labelEl =
    row.querySelector(".detail-label") ||
    row.children?.[0] ||
    row.firstElementChild;
  const valueEl =
    row.querySelector(".detail-value") ||
    row.children?.[1] ||
    row.lastElementChild;

  if (!labelEl || !valueEl) return null;

  labelEl.textContent = `${label}:`;
  valueEl.textContent = formatCustomFieldPdfValue(value);
  return row;
}

function appendHeaderCustomFieldsToInvoiceMetaHtml(html, headerRows) {
  if (!html || typeof html !== "string") return html;
  const filteredRows = Array.isArray(headerRows)
    ? headerRows.filter((row) => hasMeaningfulCustomFieldPdfValue(row?.value))
    : [];
  if (!filteredRows.length) return html;

  let doc;
  try {
    doc = new DOMParser().parseFromString(html, "text/html");
  } catch {
    return html;
  }

  const metaContainer = pickBestInvoiceMetaContainer(doc);
  if (!metaContainer) return html;

  const detailRows = Array.from(metaContainer.querySelectorAll(":scope > .detail-row"));
  const templateRow = detailRows[detailRows.length - 1] || detailRows[0];
  if (!templateRow) return html;

  const fragment = doc.createDocumentFragment();
  filteredRows.forEach((row) => {
    const injected = buildInjectedMetaRow(
      doc,
      templateRow,
      row?.label || row?.field_key || "Custom Field",
      row?.value,
    );
    if (injected) fragment.appendChild(injected);
  });

  if (!fragment.childNodes.length) return html;
  metaContainer.appendChild(fragment);
  return serializeDocLikeInput(doc, html);
}

/**
 * Inserts line-level custom field columns after the Description column in the primary items table.
 * Cell styling is copied from the template (same look as other line columns; no extra bordered box).
 */
export function appendLineItemCustomFieldsToItemsTableHtml(html, lineItems) {
  if (!html || typeof html !== "string") return html;
  if (!lineItems?.columns?.length || !lineItems?.rows?.length) return html;

  const columns = lineItems.columns;
  const rowMatrix = lineItems.rows;
  const nData = Math.min(rowMatrix.length, 500);

  let doc;
  try {
    doc = new DOMParser().parseFromString(html, "text/html");
  } catch {
    return html;
  }
  const best = pickBestLineItemsTbody(doc, nData);
  if (!best) return html;

  const table = best.closest("table");
  if (!table) return html;

  const thead = table.querySelector("thead");
  const allBodyTrs = Array.from(best.querySelectorAll(":scope > tr"));
  const dataRows = allBodyTrs.filter(isDataBodyRow);

  let headerRow = thead ? thead.querySelector(":scope > tr") : null;
  if (!headerRow && allBodyTrs.length && directTableCells(allBodyTrs[0]).some((c) => c.tagName === "TH")) {
    headerRow = allBodyTrs[0];
  }

  const headerCells = headerRow ? directTableCells(headerRow) : [];

  let insertAfterIndex = 2;
  if (headerCells.length) {
    insertAfterIndex = findDescriptionInsertIndex(headerCells);
    insertAfterIndex = Math.min(insertAfterIndex, headerCells.length - 1);
    insertAfterIndex = Math.max(0, insertAfterIndex);
  } else if (dataRows[0]) {
    const nCols = directTableCells(dataRows[0]).filter((c) => c.tagName === "TD").length;
    insertAfterIndex = Math.min(2, Math.max(0, nCols - 1));
  }

  const rowCount = Math.min(nData, dataRows.length, rowMatrix.length);
  if (rowCount < 1) return html;

  const refHeaderCell =
    headerRow && headerCells.length
      ? headerCells[insertAfterIndex] || headerCells[0]
      : null;
  const newHeaderTag = refHeaderCell?.tagName === "TD" ? "td" : "th";

  const newThs = columns.map((col) => {
    const th = doc.createElement(newHeaderTag);
    th.setAttribute("data-flexa-cf-line", "1");
    if (col.field_key) th.setAttribute("data-flexa-cf-key", String(col.field_key));
    th.textContent = col.label || col.field_key || "";
    if (refHeaderCell) copyLineItemCellSurface(refHeaderCell, th);
    return th;
  });

  if (headerRow && headerCells.length) {
    const head = headerCells.slice(0, insertAfterIndex + 1);
    const tail = headerCells.slice(insertAfterIndex + 1);
    const frag = doc.createDocumentFragment();
    head.forEach((el) => frag.appendChild(el));
    newThs.forEach((el) => frag.appendChild(el));
    tail.forEach((el) => frag.appendChild(el));
    headerRow.appendChild(frag);
  }

  for (let i = 0; i < rowCount; i++) {
    const tr = dataRows[i];
    const tds = directTableCells(tr).filter((c) => c.tagName === "TD");
    if (tds.length <= insertAfterIndex) continue;

    const cells = rowMatrix[i] || [];
    const refTd = tds[insertAfterIndex] || tds[0];
    const newTds = columns.map((_, j) => {
      const td = doc.createElement("td");
      td.setAttribute("data-flexa-cf-line", "1");
      const fk = columns[j]?.field_key;
      if (fk) td.setAttribute("data-flexa-cf-key", String(fk));
      td.textContent = formatCustomFieldPdfValue(cells[j]);
      copyLineItemCellSurface(refTd, td);
      return td;
    });

    const head = tds.slice(0, insertAfterIndex + 1);
    const tail = tds.slice(insertAfterIndex + 1);
    const frag = doc.createDocumentFragment();
    head.forEach((el) => frag.appendChild(el));
    newTds.forEach((el) => frag.appendChild(el));
    tail.forEach((el) => frag.appendChild(el));
    tr.appendChild(frag);
  }

  return serializeDocLikeInput(doc, html);
}

/**
 * @param {object} opts
 * @param {{ label: string, value?: unknown }[]} [opts.headerRows] label/value pairs (document-level custom fields)
 * @param {{ columns: { label: string, field_key?: string }[], rows: unknown[][] } | null} [opts.line_items] line-item columns + per-line values
 */
export function applyFullPdfCustomFieldsToHtml(html, opts) {
  if (!html || typeof html !== "string") return html;
  let out = stripPdfCustomFieldInjectionsFromHtml(html);
  const headerRows = Array.isArray(opts?.headerRows)
    ? opts.headerRows.filter((row) => hasMeaningfulCustomFieldPdfValue(row?.value))
    : [];
  if (Array.isArray(headerRows) && headerRows.length) {
    const afterMeta = appendHeaderCustomFieldsToInvoiceMetaHtml(out, headerRows);
    if (afterMeta !== out) {
      out = afterMeta;
    } else {
      const frag = buildCustomFieldsPdfTableHtml(headerRows);
      out = injectCustomFieldsIntoHtml(out, frag);
    }
  }
  if (opts?.line_items?.columns?.length && opts?.line_items?.rows?.length) {
    out = appendLineItemCustomFieldsToItemsTableHtml(out, opts.line_items);
  }
  return out;
}

/**
 * Fetches server PDF rows/header + line matrix and applies them to rendered HTML (saved documents).
 */
export async function enrichSavedRecordHtmlWithCustomFields(innerHtml, {
  businessId,
  module,
  screen,
  recordId,
  headers,
}) {
  if (!innerHtml || !businessId || !recordId) return innerHtml;
  const tokenFromStorage =
    typeof localStorage !== "undefined"
      ? localStorage.getItem("token")
      : null;
  const mergedHeaders = {
    "Content-Type": "application/json",
    ...(headers && typeof headers === "object" ? headers : {}),
  };
  if (!mergedHeaders.authorization && tokenFromStorage) {
    mergedHeaders.authorization = `Bearer ${tokenFromStorage}`;
  }
  try {
    const payload = await fetchPdfPayload(
      {
        businessId,
        module,
        screen,
        recordId: String(recordId),
      },
      mergedHeaders,
    );
    return applyFullPdfCustomFieldsToHtml(innerHtml, {
      headerRows: payload.rows,
      line_items: payload.line_items,
    });
  } catch (e) {
    console.warn("enrichSavedRecordHtmlWithCustomFields:", e);
    return innerHtml;
  }
}

export function buildInlinePdfCustomFieldsPayload({
  documentFieldDefinitions = [],
  documentFieldValues = {},
  lineItemDefinitions = [],
  items = [],
}) {
  const headerRows = documentFieldDefinitions
    .filter((d) => d?.show_in_pdf)
    .map((d) => ({
      label: d.label,
      value: documentFieldValues[d.field_key],
    }))
    .filter((row) => hasMeaningfulCustomFieldPdfValue(row.value));
  const lineDefs = lineItemDefinitions.filter((d) => d?.show_in_pdf);
  const line_items =
    lineDefs.length && Array.isArray(items) && items.length
      ? {
          columns: lineDefs.map((d) => ({
            label: d.label,
            field_key: d.field_key,
          })),
          rows: items.map((it) => {
            const bag =
              it?.lineItemCustomFields && typeof it.lineItemCustomFields === "object"
                ? it.lineItemCustomFields
                : {};
            return lineDefs.map((d) => bag[d.field_key]);
          }),
        }
      : null;
  if (!headerRows.length && !line_items?.rows?.length) return null;
  return { headerRows, line_items };
}
