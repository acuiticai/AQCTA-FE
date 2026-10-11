/**
 * Default customer-invoice email HTML (matches SalesOrderEmailPreview layout).
 * Placeholder {{VIEW_INVOICE_URL}} is replaced with a signed URL before send.
 */
import { formatDate } from "@/components/formatAmount";

function formatDisplayDate(dateVal) {
  if (!dateVal) return "";
  return formatDate(dateVal) || "";
}

export function buildCustomerInvoiceDefaultEmailHtml(payload) {
  const custName = String(payload.customer_name || "Customer");
  const firstName = custName.split(" ")[0] || "Customer";
  const invNo = String(payload.invoice_number || "INV-000021");
  const invType = String(payload.invoiceType || "Commercial");
  const currency = String(payload.currency || "USD");
  const grandTotal = Number(payload.grandTotal);
  const gt =
    Number.isFinite(grandTotal) ? grandTotal : Number(payload.grandTotal) || 0;
  const adv = Number(payload.advanceDepositAmount) || 0;
  const depAmt = Number(payload.depositAmount) || 0;
  const isProformaDeposit =
    invType === "Proforma" && (adv > 0 || depAmt > 0);
  const amountLabel = isProformaDeposit
    ? "Advance Deposit Amount"
    : "Invoice Amount";
  const amountValue = isProformaDeposit ? adv || depAmt : gt;
  const formattedAmount = Number(amountValue).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const depPct =
    Number(payload.depositPercentage ?? payload.deposit ?? 0) || 0;
  const depositNote =
    isProformaDeposit && depPct > 0
      ? `<p style="color: #666; font-size: 14px; margin-bottom: 16px;">
                 (Advance deposit: ${depPct}% of total contract)
               </p>`
      : "";

  const invDateStr = formatDisplayDate(payload.invoice_date);
  const dueDateStr = formatDisplayDate(payload.due_date);

  const metaRow = (label, value) => `
          <div style="display: flex; flex-wrap: wrap; align-items: flex-start; padding: 6px 0; gap: 4px 16px;">
            <span style="color: #666; min-width: 120px; white-space: nowrap;">${label}</span>
            <span style="flex: 1; min-width: 0;">${value || "—"}</span>
          </div>`;

  return `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <div style="text-align: center; background-color: #e8f5f1; padding: 16px; margin-bottom: 16px;">
        <h2 style="font-weight: 500; margin: 0;">Invoice #${invNo}</h2>
      </div>

      <p style="margin-bottom: 16px;">Dear ${firstName},</p>

      <p style="margin-bottom: 24px;">
        Thank you for your business. Your invoice can be viewed, printed and downloaded as PDF from the link below.
      </p>

      <div style="background-color: #fffef0; padding: 24px; margin-bottom: 24px; text-align: center;">
        <h3 style="color: #666; margin-bottom: 8px; font-weight: normal;">
          ${amountLabel}
        </h3>
        <p style="color: #ff5a5a; font-size: 24px; font-weight: bold; margin-bottom: 16px;">
          ${currency}${formattedAmount}
        </p>
        ${depositNote}

        <div class="invoice-email-meta" style="margin: 0 auto 16px auto; width: 100%; max-width: 420px; text-align: left;">
          ${metaRow("Invoice No:", invNo)}
          ${metaRow("Invoice Date:", invDateStr)}
          ${metaRow("Due Date:", dueDateStr)}
        </div>
<a
  href="{{VIEW_INVOICE_URL}}"
  target="_blank"
  style="background-color:#bcd351;color:white;padding:8px 24px;border-radius:4px;text-decoration:none;display:inline-block;">
  View Invoice
</a>


   </div>

      <div style="margin-bottom: 24px;">
        <p style="margin-bottom: 4px;">Regard</p>
        <p style="margin-bottom: 4px;">Finance Department</p>
        <p style="margin-bottom: 0;">AQCTA</p>
      </div>
    </div>
  `;
}
