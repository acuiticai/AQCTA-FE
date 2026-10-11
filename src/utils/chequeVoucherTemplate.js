import { formatDate, formatAmount } from "@/components/formatAmount";
import { numberToWords } from "@/utils/invoiceTemplateProcessor";

/** PCI brand — navy + red/yellow accents from the hibiscus logo */
const BRAND = {
  navy: "#0c2e5a",
  navyDark: "#081f3d",
  navyDeep: "#05152a",
  slate: "#334155",
  orange: "#c8102e",
  orangeLight: "#e23a4e",
  orangeDark: "#9a0c23",
  paper: "#ffffff",
  paperTint: "#f8fafc",
  warm: "#fff8e6",
};

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseBankLabel(label) {
  const parts = String(label || "")
    .split("·")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= 1) {
    return { accountName: parts[0] || "", accountNumber: "", bankName: "" };
  }
  if (parts.length === 2) {
    return { accountName: parts[0], accountNumber: parts[1], bankName: "" };
  }
  return {
    accountName: parts[0],
    accountNumber: parts[1],
    bankName: parts.slice(2).join(" · "),
  };
}

function parseAmount(cheque) {
  const raw = cheque?.amount;
  if (raw == null || raw === "") return null;
  const n =
    typeof raw === "number" ? raw : parseFloat(String(raw).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function normalizeStatus(status) {
  return status === "Pending" ? "Draft" : status || "";
}

function bankInitials(name) {
  const words = String(name || "BK")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "BK";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function currencyLabel(currency) {
  const map = {
    MYR: "Ringgit Malaysia",
    USD: "US Dollars",
    SGD: "Singapore Dollars",
    EUR: "Euros",
    GBP: "Pounds Sterling",
  };
  return map[String(currency || "").toUpperCase()] || String(currency || "Currency");
}

const STATUS_WM = {
  Cleared: "rgba(16, 185, 129, 0.12)",
  Bounced: "rgba(239, 68, 68, 0.12)",
  Cancelled: "rgba(100, 116, 139, 0.12)",
  Replaced: "rgba(124, 58, 237, 0.12)",
  Draft: "rgba(16, 70, 141, 0.08)",
  Issued: "rgba(242, 144, 16, 0.1)",
  "Due Soon": "rgba(242, 144, 16, 0.14)",
};

function buildStyles() {
  return `
  .cv-root {
    width: 700px;
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    color: ${BRAND.slate};
    -webkit-font-smoothing: antialiased;
  }
  .cv-root * { box-sizing: border-box; }

  .cv-flexa-bar {
    background: linear-gradient(180deg, #ffffff 0%, ${BRAND.warm} 100%);
    border: 1px solid #e2e8f0;
    border-bottom: 3px solid ${BRAND.orange};
    border-radius: 10px 10px 0 0;
    padding: 16px 24px 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }
  .cv-flexa-bar img {
    height: 42px;
    width: auto;
    max-width: 240px;
    object-fit: contain;
  }
  .cv-flexa-fallback {
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: ${BRAND.navy};
    line-height: 1;
  }
  .cv-flexa-fallback span {
    color: ${BRAND.orange};
    font-weight: 800;
    letter-spacing: 0.04em;
  }
  .cv-flexa-tagline {
    text-align: right;
    color: ${BRAND.slate};
    font-size: 9px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    line-height: 1.45;
  }
  .cv-flexa-tagline strong {
    display: block;
    font-size: 11px;
    color: ${BRAND.navy};
    letter-spacing: 0.14em;
    margin-bottom: 3px;
  }

  .cv-cheque {
    position: relative;
    background: ${BRAND.paper};
    border: 1px solid #e2e8f0;
    border-top: 3px solid ${BRAND.orange};
    border-radius: 0 0 10px 10px;
    box-shadow: 0 8px 32px rgba(16, 70, 141, 0.1), 0 2px 8px rgba(15, 23, 42, 0.06);
    overflow: hidden;
  }
  .cv-cheque::after {
    content: "";
    position: absolute;
    inset: 10px;
    border: 1px solid rgba(16, 70, 141, 0.12);
    border-radius: 6px;
    pointer-events: none;
  }
  .cv-bg-lines {
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
      -55deg,
      transparent,
      transparent 11px,
      rgba(16, 70, 141, 0.02) 11px,
      rgba(16, 70, 141, 0.02) 12px
    );
    pointer-events: none;
  }
  .cv-wm {
    position: absolute;
    left: 50%;
    top: 58%;
    transform: translate(-50%, -50%) rotate(-20deg);
    font-size: 80px;
    font-weight: 900;
    letter-spacing: 0.14em;
    white-space: nowrap;
    pointer-events: none;
    z-index: 0;
  }
  .cv-body {
    position: relative;
    z-index: 1;
    padding: 22px 28px 20px;
  }

  .cv-accent-line {
    height: 3px;
    margin: 0 0 18px;
    border-radius: 2px;
    background: linear-gradient(90deg, ${BRAND.navy}, ${BRAND.orange} 45%, ${BRAND.orangeLight});
  }
  .cv-bank-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid #e2e8f0;
    margin-bottom: 4px;
  }
  .cv-bank-left {
    display: flex;
    align-items: center;
    gap: 14px;
    min-width: 0;
    flex: 1;
  }
  .cv-bank-mark {
    width: 56px;
    height: 56px;
    border-radius: 12px;
    background: ${BRAND.paperTint};
    border: 2px solid ${BRAND.navy};
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(16, 70, 141, 0.12);
  }
  .cv-bank-mark img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .cv-bank-mark span {
    font-size: 17px;
    font-weight: 800;
    color: ${BRAND.navy};
  }
  .cv-bank-name {
    margin: 0;
    font-size: 19px;
    font-weight: 700;
    color: ${BRAND.navy};
    line-height: 1.2;
  }
  .cv-bank-sub {
    margin: 4px 0 0;
    font-size: 11px;
    color: #64748b;
    line-height: 1.4;
  }
  .cv-dates {
    display: flex;
    gap: 20px;
    flex-shrink: 0;
  }
  .cv-date-cell label {
    display: block;
    font-size: 8px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: ${BRAND.orangeDark};
    margin-bottom: 3px;
  }
  .cv-date-cell strong {
    display: block;
    font-size: 12px;
    font-weight: 700;
    color: ${BRAND.navy};
    white-space: nowrap;
  }

  .cv-payee-block {
    margin-top: 20px;
  }
  .cv-payee-block label {
    font-size: 8px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: #94a3b8;
  }
  .cv-payee-rule {
    margin-top: 8px;
    border-bottom: 2px solid ${BRAND.navy};
    padding-bottom: 6px;
  }
  .cv-payee-name {
    font-family: "Georgia", "Times New Roman", serif;
    font-size: 24px;
    font-weight: 700;
    color: ${BRAND.navyDeep};
    line-height: 1.15;
  }

  .cv-mid {
    display: flex;
    gap: 18px;
    margin-top: 18px;
    align-items: stretch;
  }
  .cv-words-col {
    flex: 1;
    min-width: 0;
  }
  .cv-words-col label {
    font-size: 8px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #94a3b8;
  }
  .cv-words-box {
    margin-top: 8px;
    padding: 12px 14px;
    background: linear-gradient(180deg, #f8fafc 0%, #fff 100%);
    border: 1px solid #e2e8f0;
    border-left: 4px solid ${BRAND.orange};
    border-radius: 0 6px 6px 0;
    font-family: Georgia, serif;
    font-size: 11.5px;
    font-style: italic;
    line-height: 1.5;
    color: ${BRAND.slate};
    min-height: 48px;
  }

  .cv-amt {
    width: 156px;
    flex-shrink: 0;
    border-radius: 8px;
    overflow: hidden;
    border: 2px solid ${BRAND.navy};
    box-shadow: 0 4px 14px rgba(16, 70, 141, 0.15);
  }
  .cv-amt-top {
    background: linear-gradient(135deg, ${BRAND.navyDeep}, ${BRAND.navy});
    color: #fff;
    text-align: center;
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.22em;
    padding: 7px 6px;
  }
  .cv-amt-body {
    background: #fff;
    padding: 10px 12px 12px;
    text-align: right;
  }
  .cv-amt-cur {
    font-size: 10px;
    font-weight: 600;
    color: #94a3b8;
  }
  .cv-amt-val {
    font-size: 24px;
    font-weight: 800;
    color: ${BRAND.orangeDark};
    line-height: 1;
    margin-top: 4px;
  }
  .cv-amt-note {
    font-size: 7px;
    color: #94a3b8;
    text-align: center;
    padding: 6px 4px 8px;
    letter-spacing: 0.1em;
    border-top: 1px solid #f1f5f9;
  }

  .cv-foot {
    display: flex;
    gap: 24px;
    margin-top: 20px;
    align-items: flex-end;
  }
  .cv-memo-col { flex: 1; min-width: 0; }
  .cv-memo-col label,
  .cv-sig-col label {
    font-size: 8px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #94a3b8;
  }
  .cv-memo-line {
    margin-top: 6px;
    border-bottom: 1px solid #cbd5e1;
    padding-bottom: 3px;
    font-size: 11px;
    color: ${BRAND.slate};
    min-height: 20px;
  }
  .cv-sig-col { width: 220px; flex-shrink: 0; }
  .cv-sig-line {
    margin-top: 6px;
    border-bottom: 2px solid ${BRAND.navy};
    min-height: 26px;
  }
  .cv-sig-hint {
    margin-top: 5px;
    font-size: 8px;
    color: #94a3b8;
    text-align: center;
    letter-spacing: 0.08em;
  }

  .cv-micr {
    margin: 18px -28px -20px;
    padding: 10px 20px;
    background: ${BRAND.navyDeep};
    font-family: "Courier New", monospace;
    font-size: 11px;
    font-weight: 700;
    color: #e2e8f0;
    letter-spacing: 0.1em;
  }
  `;
}

/**
 * Build off-screen DOM for html2canvas capture.
 */
export function buildChequeVoucherElement(cheque, { flexaLogoDataUrl, bankLogoDataUrl } = {}) {
  const { accountName, accountNumber, bankName } = parseBankLabel(
    cheque.bankAccountLabel,
  );
  const currency = cheque.currency || "MYR";
  const amount = parseAmount(cheque);
  const status = normalizeStatus(cheque.status);
  const wmColor = STATUS_WM[status] || STATUS_WM.Draft;

  const issueDateStr = cheque.issueDate ? formatDate(cheque.issueDate) : "—";
  const dueDateStr = cheque.dueDate ? formatDate(cheque.dueDate) : "—";
  const chequeNumber = cheque.chequeNumber || "—";
  const payee = cheque.vendorDisplay || "—";
  const memo = cheque.paymentPurpose?.trim() || "—";

  const amountWords =
    amount != null
      ? numberToWords(amount, currency)
      : `${currency} ZERO ONLY`;

  const amountDisplay = amount != null ? formatAmount(amount) : "—";

  const bankLogoHtml = bankLogoDataUrl
    ? `<img src="${bankLogoDataUrl}" alt="" crossorigin="anonymous" />`
    : `<span>${esc(bankInitials(bankName))}</span>`;

  const flexaLogoBlock = flexaLogoDataUrl
    ? `<img src="${flexaLogoDataUrl}" alt="AQCTA" crossorigin="anonymous" />`
    : `<div class="cv-flexa-fallback">AQCTA</div>`;

  const accountSub = [accountName, accountNumber ? `A/C ${accountNumber}` : ""]
    .filter(Boolean)
    .join(" · ");

  const micr = [
    `⑆${String(chequeNumber).replace(/\s/g, "")}⑆`,
    accountNumber ? `⑈${String(accountNumber).replace(/\s/g, "")}⑈` : "",
    bankName ? `⑇${String(bankName).toUpperCase().slice(0, 28)}⑇` : "",
  ]
    .filter(Boolean)
    .join("   ");

  const wrap = document.createElement("div");
  wrap.className = "cv-root";
  wrap.innerHTML = `
    <style>${buildStyles()}</style>
    <header class="cv-flexa-bar">
      ${flexaLogoBlock}
      <div class="cv-flexa-tagline">
        <strong>Payment voucher</strong>
        Powered by Syslab
      </div>
    </header>
    <article class="cv-cheque">
      <div class="cv-bg-lines"></div>
      <div class="cv-wm" style="color:${wmColor};">${esc(status.toUpperCase())}</div>
      <div class="cv-body">
        <div class="cv-accent-line"></div>
        <div class="cv-bank-row">
          <div class="cv-bank-left">
            <div class="cv-bank-mark">${bankLogoHtml}</div>
            <div>
              <h1 class="cv-bank-name">${esc(bankName || "Bank")}</h1>
              <p class="cv-bank-sub">${esc(accountSub)}</p>
            </div>
          </div>
          <div class="cv-dates">
            <div class="cv-date-cell">
              <label>Date</label>
              <strong>${esc(issueDateStr)}</strong>
            </div>
            <div class="cv-date-cell">
              <label>Cheque no.</label>
              <strong>${esc(chequeNumber)}</strong>
            </div>
            <div class="cv-date-cell">
              <label>Due date</label>
              <strong>${esc(dueDateStr)}</strong>
            </div>
          </div>
        </div>

        <div class="cv-payee-block">
          <label>Pay to the order of</label>
          <div class="cv-payee-rule">
            <div class="cv-payee-name">${esc(payee)}</div>
          </div>
        </div>

        <div class="cv-mid">
          <div class="cv-words-col">
            <label>${esc(currencyLabel(currency))}</label>
            <div class="cv-words-box">${esc(amountWords)}</div>
          </div>
          <div class="cv-amt">
            <div class="cv-amt-top">AMOUNT</div>
            <div class="cv-amt-body">
              <div class="cv-amt-cur">${esc(currency)}</div>
              <div class="cv-amt-val">${esc(amountDisplay)}</div>
            </div>
            <div class="cv-amt-note">NOT NEGOTIABLE</div>
          </div>
        </div>

        <div class="cv-foot">
          <div class="cv-memo-col">
            <label>Memo</label>
            <div class="cv-memo-line">${esc(memo)}</div>
          </div>
          <div class="cv-sig-col">
            <div class="cv-sig-line"></div>
            <div class="cv-sig-hint">Authorised signature</div>
          </div>
        </div>

        <div class="cv-micr">${esc(micr)}</div>
      </div>
    </article>
  `;

  return wrap;
}
