import { getModuleLabel } from "@/utils/moduleLabels";

// Pure, dependency-free builder for branded POS receipts.
// Returns a complete HTML document string so it can be rendered in an iframe,
// printed via a new window, or captured to PDF — all from the same source.
import { getS3Url } from "@/utils/generic";

const escapeHtml = (value) => {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

// Resolve any relative logo path (e.g. "/uploads/logo.png") to an absolute URL
// so it renders correctly inside a sandboxed iframe that has no base URL.
const resolveAssetUrl = (value) => {
  if (!value || typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  // Already absolute (http/https), data URI, or blob — keep as-is.
  if (/^(https?:|data:|blob:)/i.test(trimmed)) return trimmed;

  try {
    const apiBase =
      (typeof import.meta !== "undefined" &&
        import.meta.env &&
        import.meta.env.VITE_APP_API_BASE_URL) ||
      "";
    if (apiBase) {
      const origin = apiBase.replace(/\/api\/?$/i, "").replace(/\/$/, "");
      if (trimmed.startsWith("/")) return `${origin}${trimmed}`;
      // Most tenant logos are stored as S3 keys (not app-relative paths).
      // Prefer AWS S3 URL format for non-slash keys to match other modules.
      if (!trimmed.includes(" ")) return getS3Url(trimmed);
      return `${origin}/${trimmed}`;
    }
  } catch (_) {
    // ignore
  }
  // Fall back to same-origin absolute path
  if (trimmed.startsWith("/")) {
    return `${window.location.origin}${trimmed}`;
  }
  return trimmed;
};

// Route image fetch through backend proxy when possible to avoid CORS/auth issues
// in iframe/print contexts. Falls back to original URL.
const toProxyImageUrl = (value) => {
  const resolved = resolveAssetUrl(value);
  if (!resolved) return "";
  try {
    const apiBaseRaw =
      (typeof import.meta !== "undefined" &&
        import.meta.env &&
        import.meta.env.VITE_APP_API_BASE_URL) ||
      "";
    const apiBase =
      apiBaseRaw ||
      (typeof window !== "undefined" ? `${window.location.origin}/api` : "");
    if (!apiBase) return resolved;
    return `${apiBase.replace(/\/$/, "")}/proxy-image?url=${encodeURIComponent(
      resolved.replace(/&amp;/g, "&"),
    )}`;
  } catch (_) {
    return resolved;
  }
};

const money = (value, currency = "RM") => {
  const n = Number(value || 0);
  return `${currency} ${n.toFixed(2)}`;
};

const formatDateTime = (value) => {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString([], {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (_) {
    return String(value);
  }
};

const normalizeAddress = (business) => {
  if (!business) return "";
  if (typeof business.address === "string" && business.address.trim()) {
    return business.address.trim();
  }
  const primary = Array.isArray(business.addresses)
    ? business.addresses[0]
    : null;
  if (!primary) return "";
  const parts = [
    primary.addressLine1,
    primary.addressLine2,
    [primary.city, primary.state].filter(Boolean).join(", "),
    primary.zipCode,
    primary.country,
  ]
    .map((p) => (p || "").trim())
    .filter(Boolean);
  return parts.join(", ");
};

const buildItemRow = (item, currency) => {
  const name = escapeHtml(item?.name || "Item");
  const qty = Number(item?.quantity || 0);
  const rate = Number(item?.rate || 0);
  const amount = Number(item?.amount || 0);
  const discount = Number(item?.discount || 0);
  const note = item?.note ? escapeHtml(item.note) : "";

  return `
    <tr class="r-item">
      <td class="r-item-name">
        <div class="r-item-title">${name}</div>
        ${
          discount > 0
            ? `<div class="r-item-sub">-${discount}% line discount</div>`
            : ""
        }
        ${note ? `<div class="r-item-note">Note: ${note}</div>` : ""}
      </td>
      <td class="r-item-qty">${qty}</td>
      <td class="r-item-rate">${rate.toFixed(2)}</td>
      <td class="r-item-amt">${amount.toFixed(2)}</td>
    </tr>
  `;
};

export function buildReceiptHtml({
  order,
  business = {},
  logo = "",
  showLogo = true,
  currency = "RM",
  footerMessage = "Thank you for your visit!",
} = {}) {
  if (!order) return "<html><body></body></html>";

  const items = Array.isArray(order.items) ? order.items : [];
  const payments = Array.isArray(order.payments) ? order.payments : [];

  const customerName =
    order.customer?.basicInformation?.customerDisplayName ||
    order.customer?.basicInformation?.primaryContact?.firstName ||
    "";

  const tableLabel = order.table?.tableNumber
    ? `Table ${order.table.label || order.table.tableNumber}`
    : "Walk-in";

  const businessName = escapeHtml(
    business?.name || order.businessName || "Your Business",
  );
  const businessEmail = escapeHtml(business?.email || "");
  const businessTel = escapeHtml(business?.tel || business?.phone || "");
  const businessAddress = escapeHtml(normalizeAddress(business));
  // Business-specific logo ONLY. Use shared resolver to keep behavior consistent
  // with POS header/business selector and handle mixed storage formats robustly.
  const pickBusinessImage = (biz = {}) => {
    const candidates = [
      biz?.image,
      biz?.imageUrl,
      biz?.businessLogo,
      biz?.companyLogo,
      biz?.image?.url,
      biz?.logo?.url,
      biz?.logoUrl,
    ];
    return candidates.find((v) => typeof v === "string" && v.trim()) || "";
  };

  const rawLogo = showLogo
    ? ((typeof logo === "string" && logo.trim().startsWith("data:")
        ? logo.trim()
        : "") ||
      pickBusinessImage(business) ||
      pickBusinessImage(order?.business || {}) ||
      "")
    : "";
  const resolvedLogo = resolveAssetUrl(rawLogo);
  const proxiedLogo = toProxyImageUrl(rawLogo);

  const itemsHtml = items.map((i) => buildItemRow(i, currency)).join("");

  const hasDiscount = Number(order.discountAmount || 0) > 0;
  const hasServiceCharge = Number(order.serviceChargeAmount || 0) > 0;
  const hasTax = Number(order.taxAmount || 0) > 0;
  const cashTendered = Number(order.cashTendered || 0);
  const totalValue = Number(order.total || 0);
  const hasChange = cashTendered > totalValue;

  // Per-rate tax breakdown — prefer order.taxBreakdown (enterprise mode),
  // fall back to single-line for legacy orders.
  const taxBreakdownLines = Array.isArray(order.taxBreakdown) && order.taxBreakdown.length > 0
    ? order.taxBreakdown
    : (hasTax ? [{ taxRate: order.taxRate ?? 0, taxName: order.taxName || "", taxableAmount: Number(order.taxableAmount || 0), taxAmount: Number(order.taxAmount || 0) }] : []);

  const taxableSales = Number(order.taxableAmount || 0);
  const nonTaxableSales = Number(order.nonTaxableAmount || 0);
  const showTaxSplit = hasTax && (taxableSales > 0 || nonTaxableSales > 0);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Receipt ${escapeHtml(order.orderNumber || "")}</title>
<style>
  :root {
    --accent: #0f172a;
    --accent-soft: #1f2937;
    --muted: #64748b;
    --line: #e5e7eb;
    --line-strong: #cbd5e1;
    --brand: #f59e0b;
  }

  * { box-sizing: border-box; }

  html, body {
    margin: 0;
    padding: 0;
    background: #ffffff;
    color: var(--accent);
    font-family: "Helvetica Neue", "Segoe UI", Arial, sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .r-wrap {
    width: min(302px, 100%);         /* 80mm thermal width */
    max-width: 100%;
    margin: 0 auto;
    padding: 8px 10px 10px;
    background: #ffffff;
  }

  .r-brand {
    text-align: center;
    padding-bottom: 6px;
    border-bottom: 1px dashed var(--line);
  }
  .r-logo {
    max-height: 36px;
    max-width: 120px;
    object-fit: contain;
    display: inline-block;
    margin-bottom: 3px;
  }
  .r-biz-name {
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.5px;
    margin: 2px 0 2px;
    text-transform: uppercase;
    color: var(--accent);
  }
  .r-brand-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin: 4px 0 6px;
    padding: 5px 12px 4px;
    border-radius: 999px;
    background: #0f172a;
    color: #fff;
    font-size: 9px;
    letter-spacing: 1.4px;
    font-weight: 800;
    text-transform: uppercase;
    line-height: 1;
  }
  .r-biz-meta {
    font-size: 10px;
    color: var(--muted);
    line-height: 1.4;
    margin: 1px 0;
  }

  .r-hero {
    margin: 5px 0 5px;
    padding: 6px 10px;
    border-radius: 6px;
    background: linear-gradient(135deg, #0f172a 0%, #1f2937 100%);
    color: #ffffff;
    text-align: center;
  }
  .r-hero .r-hero-title {
    font-size: 10px;
    letter-spacing: 3px;
    font-weight: 800;
    text-transform: uppercase;
    opacity: 0.85;
  }
  .r-hero .r-hero-ordno {
    font-size: clamp(14px, 4.8vw, 15px);
    font-weight: 800;
    margin-top: 2px;
    letter-spacing: 0.2px;
    line-height: 1.15;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  .r-hero .r-hero-meta {
    font-size: 9.5px;
    margin-top: 4px;
    display: flex;
    justify-content: center;
    gap: 4px;
    flex-wrap: wrap;
  }
  .r-hero .r-hero-meta .r-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 4px 8px 3px;
    background: rgba(255, 255, 255, 0.18);
    border-radius: 999px;
    font-size: 9px;
    line-height: 1;
    font-weight: 700;
    letter-spacing: 0.35px;
    text-transform: uppercase;
    max-width: 100%;
    text-align: center;
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  .r-meta {
    font-size: 10px;
    color: var(--accent-soft);
    margin: 3px 0;
    line-height: 1.4;
  }
  .r-meta-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    padding: 1px 0;
  }
  .r-meta-k {
    color: var(--muted);
    font-size: 10px;
    line-height: 1.4;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    font-weight: 600;
    flex-shrink: 0;
  }
  .r-meta-v {
    font-size: 10px;
    line-height: 1.4;
    font-weight: 700;
    color: var(--accent);
    text-align: right;
    overflow-wrap: anywhere;
    word-break: break-word;
    min-width: 0;
  }

  .r-divider {
    border-top: 1px dashed var(--line-strong);
    margin: 5px 0;
  }

  table.r-items {
    width: 100%;
    border-collapse: collapse;
    font-size: 10.5px;
    table-layout: fixed;
  }
  /* colgroup widths take priority; these back them up */
  table.r-items th:nth-child(1), table.r-items td:nth-child(1) { width: 50%; }
  table.r-items th:nth-child(2), table.r-items td:nth-child(2) { width: 12%; }
  table.r-items th:nth-child(3), table.r-items td:nth-child(3) { width: 16%; }
  table.r-items th:nth-child(4), table.r-items td:nth-child(4) { width: 22%; }

  table.r-items thead th {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: var(--muted);
    padding: 6px 0 8px;
    border-bottom: 1.5px solid var(--line-strong);
    text-align: left;
    font-weight: 800;
    vertical-align: bottom;
  }
  table.r-items thead th:not(:first-child) { padding-left: 4px; }
  table.r-items thead th.c { text-align: center; }
  table.r-items thead th.r { text-align: right; }

  /* Every cell uses the SAME line-height and vertical-align so single-line
     rows sit perfectly on the same baseline, and multi-line notes just flow
     under the title on the left cell. */
  .r-item td {
    padding: 3px 0;
    vertical-align: top;
    border-bottom: 1px dotted var(--line);
    line-height: 1.25;
  }
  .r-item td:not(:first-child) { padding-left: 4px; }
  .r-item-name { overflow-wrap: anywhere; word-break: break-word; }
  .r-item-qty { text-align: center; font-weight: 700; color: var(--accent); }
  .r-item-rate { text-align: right; color: var(--muted); }
  .r-item-amt { text-align: right; font-weight: 800; color: var(--accent); }
  .r-item-title { font-weight: 600; line-height: inherit; margin: 0; word-break: break-word; overflow-wrap: anywhere; color: var(--accent); }
  .r-item-sub { font-size: 9px; color: #dc2626; margin-top: 2px; font-weight: 600; }
  .r-item-note {
    font-size: 9.5px;
    color: var(--accent-soft);
    margin-top: 3px;
    padding: 3px 6px;
    background: #f9fafb;
    border-left: 2.5px solid #94a3b8;
    border-radius: 0 2px 2px 0;
    font-style: italic;
    word-break: break-word;
    overflow-wrap: anywhere;
  }

  .r-totals {
    margin-top: 5px;
    font-size: 10px;
    padding: 4px 8px;
    background: #f8fafc;
    border-radius: 4px;
    border: 1px solid var(--line);
  }
  .r-totals .r-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding: 1.5px 0;
    line-height: 1.3;
  }
  .r-totals .r-row > span {
    line-height: 1.4;
    font-size: 10.5px;
  }
  .r-totals .r-row > span:first-child {
    color: var(--muted);
    font-weight: 600;
    flex-shrink: 0;
  }
  .r-totals .r-row > span:last-child {
    font-weight: 700;
    color: var(--accent);
    text-align: right;
    overflow-wrap: anywhere;
    word-break: break-word;
    min-width: 0;
  }
  .r-totals .r-row.discount > span:last-child { color: #dc2626; }

  .r-grand {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
    padding: 6px 10px;
    background: linear-gradient(135deg, #0f172a 0%, #1f2937 100%);
    color: #ffffff;
    border-radius: 8px;
    font-weight: 800;
    font-size: 14px;
    line-height: 1.2;
    letter-spacing: 0.5px;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.1);
    overflow: hidden;
  }
  .r-grand > span { line-height: 1.2; font-size: 14px; }
  .r-grand > span:first-child { flex-shrink: 0; }
  .r-grand > span:last-child {
    text-align: right;
    overflow-wrap: anywhere;
    word-break: break-word;
    min-width: 0;
  }

  .r-payments { font-size: 10.5px; margin-top: 10px; }
  .r-payments .r-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding: 3px 0;
    line-height: 1.4;
  }
  .r-payments .r-row > span {
    line-height: 1.4;
    font-size: 10.5px;
  }
  .r-payments .r-row > span:first-child {
    color: var(--muted);
    font-weight: 600;
    flex-shrink: 0;
  }
  .r-payments .r-row > span:last-child {
    font-weight: 700;
    color: var(--accent);
    text-align: right;
    overflow-wrap: anywhere;
    word-break: break-word;
    min-width: 0;
  }
  .r-payments .r-row.change {
    background: #ecfdf5;
    padding: 5px 8px;
    border-radius: 4px;
    margin-top: 4px;
  }
  .r-payments .r-row.change > span {
    color: #047857 !important;
    font-weight: 800 !important;
  }

  .r-footer {
    margin-top: 6px;
    text-align: center;
    font-size: 9.5px;
    color: var(--muted);
    line-height: 1.4;
  }
  .r-footer .r-thanks {
    font-size: 12px;
    font-weight: 800;
    color: var(--accent);
    margin-bottom: 3px;
    letter-spacing: 0.5px;
  }
  .r-footer .r-ordno {
    margin-top: 8px;
    padding: 4px 8px 3px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: #f1f5f9;
    border-radius: 3px;
    letter-spacing: 1.5px;
    font-family: "Courier New", monospace;
    font-size: 9.5px;
    line-height: 1;
    font-weight: 700;
    color: var(--accent-soft);
  }
  .r-footer .r-powered {
    margin-top: 4px;
    font-size: 9px;
    opacity: 0.7;
  }

  @media print {
    @page { margin: 0; size: 80mm auto; }
    html, body { background: #ffffff; }
    .r-wrap { padding: 6px 8px 10px; }
  }
</style>
</head>
<body>
  <div class="r-wrap" id="pos-receipt-root">
    <div class="r-brand">
      ${
        resolvedLogo
          ? `<img src="${escapeHtml(proxiedLogo || resolvedLogo)}" alt="logo" class="r-logo" onerror="this.onerror=null;if(this.dataset.fallbackTried==='1'){this.style.display='none';return;}this.dataset.fallbackTried='1';this.src='${escapeHtml(
              resolvedLogo,
            )}';" />`
          : ""
      }
      <div class="r-biz-name">${businessName}</div>
      <div class="r-brand-pill">Sales Receipt</div>
      ${businessAddress ? `<div class="r-biz-meta">${businessAddress}</div>` : ""}
      ${
        businessTel || businessEmail
          ? `<div class="r-biz-meta">${[businessTel, businessEmail]
              .filter(Boolean)
              .join(" • ")}</div>`
          : ""
      }
    </div>

    <div class="r-hero">
      <div class="r-hero-title">Order</div>
      <div class="r-hero-ordno">${escapeHtml(order.orderNumber || "-")}</div>
      <div class="r-hero-meta">
        <span class="r-pill">${escapeHtml(tableLabel)}</span>
        <span class="r-pill">${escapeHtml(
          formatDateTime(order.completedAt || order.createdAt),
        )}</span>
      </div>
    </div>

    <div class="r-meta">
      ${
        customerName
          ? `<div class="r-meta-row">
               <span class="r-meta-k">Customer</span>
               <span class="r-meta-v">${escapeHtml(customerName)}</span>
             </div>`
          : ""
      }
      ${
        order.cashierName
          ? `<div class="r-meta-row">
               <span class="r-meta-k">Cashier</span>
               <span class="r-meta-v">${escapeHtml(order.cashierName)}</span>
             </div>`
          : ""
      }
      ${
        order.salesChannelName || order.salesChannel?.name
          ? `<div class="r-meta-row">
               <span class="r-meta-k">Sales Channel</span>
               <span class="r-meta-v">${escapeHtml(order.salesChannelName || order.salesChannel?.name || "")}</span>
             </div>`
          : ""
      }
      ${
        order.salesOrderNumber
          ? `<div class="r-meta-row">
               <span class="r-meta-k">${escapeHtml(
                 getModuleLabel("saleOrder", "Sale Order")
               )}</span>
               <span class="r-meta-v">${escapeHtml(order.salesOrderNumber)}</span>
             </div>`
          : ""
      }
    </div>

    <div class="r-divider"></div>

    <table class="r-items">
      <colgroup>
        <col style="width:50%" />
        <col style="width:12%" />
        <col style="width:16%" />
        <col style="width:22%" />
      </colgroup>
      <thead>
        <tr>
          <th>Item</th>
          <th class="c">Qty</th>
          <th class="r">Rate</th>
          <th class="r">Total</th>
        </tr>
      </thead>
      <tbody>
        ${
          itemsHtml ||
          `<tr><td colspan="4" style="text-align:center;color:#9ca3af;padding:10px 0;">No items</td></tr>`
        }
      </tbody>
    </table>

    <div class="r-totals">
      <div class="r-row">
        <span>Subtotal</span>
        <span>${money(order.subtotal, currency)}</span>
      </div>
      ${
        hasDiscount
          ? `<div class="r-row discount">
               <span>Discount${
                 order.discountType === "percentage"
                   ? ` (${order.discountValue}%)`
                   : ""
               }</span>
               <span>- ${money(order.discountAmount, currency)}</span>
             </div>`
          : ""
      }
      ${
        hasServiceCharge
          ? `<div class="r-row">
               <span>Service Charge ${
                 order.serviceChargeType === "fixed"
                   ? `(RM ${Number(
                       order.serviceChargeValue ?? order.serviceChargeRate ?? 0,
                     ).toFixed(2)})`
                   : `(${order.serviceChargeValue ?? order.serviceChargeRate ?? 0}%)`
               }</span>
               <span>${money(order.serviceChargeAmount, currency)}</span>
             </div>`
          : ""
      }
      ${
        nonTaxableSales > 0 && hasTax
          ? `<div class="r-row" style="font-size:9.5px;color:#9ca3af;">
               <span>Non-Taxable Sales</span>
               <span>${money(nonTaxableSales, currency)}</span>
             </div>`
          : ""
      }
      ${
        taxBreakdownLines.map((bd) => `
          <div class="r-row" style="font-size:9.5px;color:#9ca3af;">
            <span>Taxable (${escapeHtml(bd.taxName || `${bd.taxRate}%`)})</span>
            <span>${money(bd.taxableAmount, currency)}</span>
          </div>
          <div class="r-row">
            <span>${escapeHtml(bd.taxName || `Tax ${bd.taxRate}%`)}</span>
            <span>${money(bd.taxAmount, currency)}</span>
          </div>`).join("")
      }
    </div>

    <div class="r-grand">
      <span>TOTAL</span>
      <span>${money(order.total, currency)}</span>
    </div>

    ${
      payments.length || hasChange
        ? `<div class="r-divider"></div>
           <div class="r-payments">
             ${payments
               .map(
                 (p) => `
                 <div class="r-row">
                   <span>${escapeHtml(p.paymentMethodName || p.method || "Payment")}${
                     p.reference
                       ? ` <span style="color:#9ca3af;">(${escapeHtml(p.reference)})</span>`
                       : ""
                   }</span>
                   <span>${money(p.amount, currency)}</span>
                 </div>`,
               )
               .join("")}
             ${
               hasChange
                 ? `<div class="r-row">
                      <span>Cash Tendered</span>
                      <span>${money(cashTendered, currency)}</span>
                    </div>
                    <div class="r-row change">
                      <span>Change</span>
                      <span>${money(order.changeGiven, currency)}</span>
                    </div>`
                 : ""
             }
           </div>`
        : ""
    }

    <div class="r-divider"></div>

    <div class="r-footer">
      <div class="r-thanks">${escapeHtml(footerMessage)}</div>
      <div>${businessName}</div>
    </div>
  </div>
</body>
</html>`;
}

export default buildReceiptHtml;
