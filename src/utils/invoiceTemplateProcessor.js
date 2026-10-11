/**
 * Shared invoice template processing for both DocumentGenerator (PDF) and InvoiceRenderer (preview).
 * Ensures Commercial Invoice and unified invoice templates render consistently across screens.
 */
import { formatDate } from "@/components/formatAmount";

/**
 * Format invoice/PDF dates as YYYY-MM-DD. Handles Date objects and parseable strings so values
 * never stringify via Date#toString() (e.g. "Fri Mar 27 2026 GMT+0500...") in EJS or HTML.
 */
export function formatInvoiceDateYMD(value) {
  if (value === undefined || value === null || value === "") return "";
  if (value instanceof Date && !isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof value === "string") {
    const t = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  }
  const parsed = new Date(value);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return "";
}

export function numberToWords(num, currency = "USD") {
  if (num === undefined || num === null || isNaN(num))
    return `ZERO ${currency} ONLY`;
  num = parseFloat(num);
  if (num === 0) return `ZERO ${currency} ONLY`;

  const ones = [
    "", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE",
    "TEN", "ELEVEN", "TWELVE", "THIRTEEN", "FOURTEEN", "FIFTEEN", "SIXTEEN",
    "SEVENTEEN", "EIGHTEEN", "NINETEEN",
  ];
  const tens = [
    "", "", "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY", "SEVENTY", "EIGHTY", "NINETY",
  ];
  const scales = ["", "THOUSAND", "MILLION", "BILLION"];

  function chunkToWords(n) {
    let str = "";
    if (n >= 100) {
      str += ones[Math.floor(n / 100)] + " HUNDRED ";
      n = n % 100;
    }
    if (n >= 20) {
      str += tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
    } else if (n > 0) {
      str += ones[n];
    }
    return str.trim();
  }

  const [dollars, cents] = num.toFixed(2).split(".");
  let dollarNum = parseInt(dollars, 10);
  let words = [];
  let scale = 0;
  while (dollarNum > 0) {
    const chunk = dollarNum % 1000;
    if (chunk) {
      words.unshift(chunkToWords(chunk) + (scales[scale] ? " " + scales[scale] : ""));
    }
    dollarNum = Math.floor(dollarNum / 1000);
    scale++;
  }
  let result = words.join(" ").replace(/  +/g, " ").trim();
  if (!result) result = "ZERO";
  result += ` ${currency}`;
  if (cents && parseInt(cents, 10) > 0) {
    const centNum = parseInt(cents, 10);
    let centWords = centNum < 20 ? ones[centNum] : tens[Math.floor(centNum / 10)] + (centNum % 10 ? " " + ones[centNum % 10] : "");
    result += ` AND ${centWords} CENTS`;
  }
  result += " ONLY";
  return result;
}

/**
 * Process Commercial Invoice template (type: "Commercial Invoice").
 * Expects contract with: items, totalValue, totalInWords, currency, termsAndConditions,
 * buyerName, date, dueDate, ref, contract_no, payment, poNumber, etc.
 */
export function processCommercialInvoiceTemplate(templateContent, contract) {
  let processedTemplate = templateContent;
  const currency = contract.currency || "USD";

  const computeLineTotal = (item) => {
    const quantity = parseFloat(item.quantity || 0);
    const unitPrice = parseFloat(item.unitPrice || item.rate || item.price || 0);
    const discountPercent = parseFloat(item.discount ?? item.discountPercent ?? 0);
    const taxRate = parseFloat(item.taxRate ?? item.taxPercent ?? 0);
    const taxAmountFromApi = parseFloat(
      item.taxAmount ?? item.tax_amount ?? item.tax ?? 0
    );

    const lineSubtotal = Math.max(
      0,
      quantity *
        unitPrice *
        (1 - (isNaN(discountPercent) ? 0 : discountPercent) / 100)
    );
    const taxAmount =
      taxAmountFromApi > 0
        ? taxAmountFromApi
        : taxRate
          ? (lineSubtotal * taxRate) / 100
          : 0;

    return Math.max(0, lineSubtotal + taxAmount);
  };

  // 1. Process items table
  const tbodyRegex = /<tbody>([\s\S]*?)<\/tbody>/;
  const tbodyMatch = processedTemplate.match(tbodyRegex);

  if (tbodyMatch && contract.items && contract.items.length > 0) {
    const itemRows = contract.items
      .map((item, idx) => {
        const itemName = item.item || item.name || item.title || item.itemName || "";
        const itemDescription = item.description || item.goods_description || "";
        const displayName = (itemName || itemDescription || "Item Name").trim();
        const descToShow = itemDescription && String(itemDescription).trim() !== String(itemName || "").trim() ? itemDescription : "";
        const itemDescCell = descToShow
          ? `<div class="item-desc-main">${displayName}</div><div class="item-desc-sub" style="font-size: 0.9em; color: #666; margin-top: 2px;">${itemDescription}</div>`
          : `<div class="item-desc-main">${displayName}</div>`;
        const quantity = parseFloat(item.quantity || 0);
        const unitPrice = parseFloat(item.unitPrice || item.rate || item.price || 0);
        const discountPercent = parseFloat(item.discount ?? item.discountPercent ?? 0);
        const taxRate = parseFloat(item.taxRate ?? item.taxPercent ?? 0);
        const taxAmountFromApi = parseFloat(
          item.taxAmount ?? item.tax_amount ?? item.tax ?? 0
        );

        // Always compute line subtotal (after discount) + tax for accurate "Total".
        const lineSubtotal = Math.max(
          0,
          quantity * unitPrice * (1 - (isNaN(discountPercent) ? 0 : discountPercent) / 100)
        );
        const taxAmount =
          taxAmountFromApi > 0
            ? taxAmountFromApi
            : taxRate
              ? (lineSubtotal * taxRate) / 100
              : 0;
        const computedTotal = Math.max(0, lineSubtotal + taxAmount);

        // Prefer backend total if it's already correct, otherwise use computed total.
        const providedTotal = parseFloat(
          item.total ?? item.totalValue ?? item.amount ?? 0
        );
        const tolerance = 0.01;
        const total =
          providedTotal > 0 && Math.abs(providedTotal - computedTotal) < tolerance
            ? providedTotal
            : computedTotal;

        return `
        <tr>
          <td>${idx + 1}</td>
          <td>${itemDescCell}</td>
          <td>${quantity}</td>
          <td>${taxAmount.toFixed(2)}</td>
          <td>${discountPercent.toFixed(2)}%</td>
          <td>${unitPrice.toFixed(2)}</td>
          <td>${total.toFixed(2)}</td>
        </tr>
      `;
      })
      .join("");

    processedTemplate = processedTemplate.replace(tbodyRegex, `<tbody>${itemRows}</tbody>`);
  } else if (tbodyMatch) {
    processedTemplate = processedTemplate.replace(
      tbodyRegex,
      `<tbody><tr><td colspan="7" style="text-align: center; padding: 20px;">No items</td></tr></tbody>`
    );
  }

  const termsContent = (contract.termsAndConditions || "").replace(/\$/g, "$$$$");
  processedTemplate = processedTemplate.replace(
    /<div class="payment-info">\s*<div>1\. Method Of Payment[\s\S]*?21400015058\s*<\/div>\s*<\/div>\s*<div class="financial-summary">/g,
    `<div class="payment-info">${termsContent}</div>\n      <div class="financial-summary">`
  );
  processedTemplate = processedTemplate.replace(
    /<div class="payment-info">\s*(?:<div>[\s\S]*?<\/div>\s*){3}\s*<\/div>\s*<div class="financial-summary">/g,
    `<div class="payment-info">${termsContent}</div>\n      <div class="financial-summary">`
  );
  processedTemplate = processedTemplate.replace(
    /<div class="payment-info">[\s\S]*?ABDUL HAMEED[\s\S]*?21400015058[\s\S]*?<\/div>\s*<div class="financial-summary">/gi,
    `<div class="payment-info">${termsContent}</div>\n      <div class="financial-summary">`
  );

  const totalAmount =
    contract.totalValue !== undefined
      ? contract.totalValue
      : (contract.items || []).reduce((sum, item) => {
          const computed = computeLineTotal(item);
          return item.isAdvancePayment ? sum - computed : sum + computed;
        }, 0);
  processedTemplate = processedTemplate.replace(
    /<div>USD\s*<%= contract\.items\.reduce\([\s\S]*?\)\.toFixed\(2\) %><\/div>/,
    `<div>${currency} ${totalAmount.toFixed(2)}</div>`
  );
  processedTemplate = processedTemplate.replace(
    /<%= contract\.items\.reduce\([\s\S]*?\)\.toFixed\(2\) %>/g,
    totalAmount.toFixed(2)
  );

  processedTemplate = processedTemplate.replace(/UNIT PRICE \(USD\/MT\)/g, `UNIT PRICE (${currency}/MT)`);
  processedTemplate = processedTemplate.replace(/TOTAL AMOUNT \(USD\)/g, `TOTAL AMOUNT (${currency})`);
  processedTemplate = processedTemplate.replace(/CURRENCY CODE, AMOUNT/g, `Total (${currency})`);
  processedTemplate = processedTemplate.replace(/US DOLLAR\s*:/g, `${currency} :`);
  processedTemplate = processedTemplate.replace(/US\s+DOLLAR\s*:/g, `${currency} :`);
  processedTemplate = processedTemplate.replace(/US\s*DOLLAR\s*:/g, `${currency} :`);

  processedTemplate = processedTemplate.replace(
    /<%= contract\.totalInWords %>/g,
    contract.totalInWords || ""
  );

  const invoiceNumber = contract.ref || contract.contract_no || contract.invoiceNumber || contract.invoice_number || "INV-000001";
  processedTemplate = processedTemplate.replace(
    /<div class="invoice-number">#\s*<%= contract\.ref[^%]*%><\/div>/g,
    `<div class="invoice-number"># ${invoiceNumber}</div>`
  );
  processedTemplate = processedTemplate.replace(
    /<div class="invoice-number">#\s*<%= contract\.ref \|\| contract\.contract_no \|\| 'INV-000001' %><\/div>/g,
    `<div class="invoice-number"># ${invoiceNumber}</div>`
  );
  processedTemplate = processedTemplate.replace(/<%= contract\.ref %>/g, invoiceNumber);
  processedTemplate = processedTemplate.replace(/<%= contract\.contract_no %>/g, contract.contract_no || invoiceNumber || "");

  const invoiceDateRaw =
    contract.date ||
    contract.invoice_date ||
    contract.invoiceDate ||
    new Date();
  const invoiceDate =
    formatDate(invoiceDateRaw) || formatDate(new Date());
  const terms = contract.payment || contract.terms || "Due on Receipt";
  const dueDateRaw =
    contract.dueDate ||
    contract.due_date ||
    contract.date ||
    new Date();
  const dueDate = formatDate(dueDateRaw) || formatDate(new Date());
  const poNumber = contract.poNumber || contract.po_no || "";
  const balanceDue = parseFloat(contract.total || contract.totalValue || contract.total_amount_due || 0);
  const customerName = contract.buyerName || "Customer Name";

  processedTemplate = processedTemplate.replace(/Invoice Date:\s*<%= contract\.date[^%]*%>/g, `Invoice Date: ${invoiceDate}`);
  processedTemplate = processedTemplate.replace(/Invoice Date:\s*<%= contract\.date \|\| new Date\(\)\.toLocaleDateString\(\) %>/g, `Invoice Date: ${invoiceDate}`);
  processedTemplate = processedTemplate.replace(/Terms:\s*<%= contract\.payment[^%]*%>/g, `Terms: ${terms}`);
  processedTemplate = processedTemplate.replace(/Terms:\s*<%= contract\.payment \|\| contract\.terms \|\| 'Due on Receipt' %>/g, `Terms: ${terms}`);
  processedTemplate = processedTemplate.replace(/Due Date:\s*<%= contract\.date[^%]*%>/g, `Due Date: ${dueDate}`);
  processedTemplate = processedTemplate.replace(/Due Date:\s*<%= contract\.date \|\| new Date\(\)\.toLocaleDateString\(\) %>/g, `Due Date: ${dueDate}`);
  processedTemplate = processedTemplate.replace(/Due Date:\s*<%= contract\.dueDate[^%]*%>/g, `Due Date: ${dueDate}`);

  if (poNumber) {
    processedTemplate = processedTemplate.replace(/P\.O\.#:\s*<%= contract\.poNumber[^%]*%>/g, `P.O.#: ${poNumber}`);
    processedTemplate = processedTemplate.replace(/P\.O\.#:\s*<%= contract\.po_no[^%]*%>/g, `P.O.#: ${poNumber}`);
    processedTemplate = processedTemplate.replace(
      /<% if \(contract\.poNumber \|\| contract\.po_no\) \{ %>\s*<div class="detail-row">P\.O\.#:\s*<%= contract\.poNumber \|\| contract\.po_no %><\/div>\s*<% \} %>/g,
      `<div class="detail-row">P.O.#: ${poNumber}</div>`
    );
  } else {
    processedTemplate = processedTemplate.replace(
      /<% if \(contract\.poNumber \|\| contract\.po_no\) \{ %>\s*<div class="detail-row">P\.O\.#:\s*<%= contract\.poNumber \|\| contract\.po_no %><\/div>\s*<% \} %>/g,
      ""
    );
  }

  processedTemplate = processedTemplate.replace(
    /<div class="balance-due-amount"><%= contract\.currency \|\| 'USD' %><%= \(contract\.total \|\| contract\.totalValue \|\| contract\.total_amount_due \|\| 0\)\.toFixed\(2\) %><\/div>/g,
    `<div class="balance-due-amount">${currency}${balanceDue.toFixed(2)}</div>`
  );
  processedTemplate = processedTemplate.replace(
    /<div class="balance-due-amount">[\s\S]*?contract\.currency[\s\S]*?contract\.total[\s\S]*?<\/div>/g,
    `<div class="balance-due-amount">${currency}${balanceDue.toFixed(2)}</div>`
  );

  processedTemplate = processedTemplate.replace(
    /<div class="bill-to-name"><%= contract\.buyerName[^%]*%><\/div>/g,
    `<div class="bill-to-name">${customerName}</div>`
  );
  processedTemplate = processedTemplate.replace(
    /<div class="bill-to-name"><%= contract\.buyerName \|\| 'Customer Name' %><\/div>/g,
    `<div class="bill-to-name">${customerName}</div>`
  );

  processedTemplate = processedTemplate.replace(/<% if \(contract\.ref\) \{ %>\s*<div>Subject:\s*<%= contract\.ref %><\/div>\s*<% \} %>/g, "");
  processedTemplate = processedTemplate.replace(/<div>Subject:\s*<%= contract\.ref[^%]*%><\/div>/g, "");

  const subtotal = parseFloat(contract.subtotal || contract.subTotal || 0);
  const discountAmount = parseFloat(contract.discountAmount || contract.discount || 0);
  const summaryDiscountPct = parseFloat(
    contract.discountPercentage || contract.summaryDiscountPercentage || 0,
  );
  const discountSummaryDisplay =
    contract.summaryDiscountDisplay ||
    (summaryDiscountPct > 0 ? `${summaryDiscountPct.toFixed(2)}%` : "") ||
    (discountAmount > 0 ? `${currency}${discountAmount.toFixed(2)}` : "");
  const shippingCharges = parseFloat(contract.shippingCharges || contract.freight_charges || 0);
  const adjustment = parseFloat(contract.adjustment || contract.other_expenditures || 0);
  const total = parseFloat(contract.total || contract.totalValue || contract.total_amount_due || subtotal);

  const summarySectionRegex = /<div class="summary-section">([\s\S]*?)<\/div>\s*<\/div>/;
  const summaryMatch = processedTemplate.match(summarySectionRegex);

  if (summaryMatch) {
    let summaryHTML = `
    <div class="summary-section">
      <div class="summary-table">
        <div class="summary-row">
          <span class="summary-label">Sub Total</span>
          <span class="summary-value">${currency}${subtotal.toFixed(2)}</span>
        </div>`;
    if (discountAmount > 0) {
      summaryHTML += `
        <div class="summary-row">
          <span class="summary-label">Discount</span>
          <span class="summary-value">${discountSummaryDisplay}</span>
        </div>`;
    }
    if (shippingCharges > 0) {
      summaryHTML += `
        <div class="summary-row">
          <span class="summary-label">Shipping Charges</span>
          <span class="summary-value">${currency}${shippingCharges.toFixed(2)}</span>
        </div>`;
    }
    if (adjustment !== 0) {
      summaryHTML += `
        <div class="summary-row">
          <span class="summary-label">Adjustment</span>
          <span class="summary-value">${currency}${adjustment.toFixed(2)}</span>
        </div>`;
    }
    summaryHTML += `
        <div class="summary-row total-row">
          <span class="summary-label">Total</span>
          <span class="summary-value">${currency}${total.toFixed(2)}</span>
        </div>
        <div class="balance-due-box">
          <div class="balance-due-box-label">Balance Due</div>
          <div class="balance-due-box-amount">${currency}${total.toFixed(2)}</div>
        </div>
      </div>
    </div>`;
    processedTemplate = processedTemplate.replace(summarySectionRegex, summaryHTML);
  }

  const notes = contract.notes || contract.customerNotes || contract.FooterText || "";
  if (notes) {
    processedTemplate = processedTemplate.replace(
      /<% if \(contract\.notes \|\| contract\.FooterText\) \{ %>\s*<div class="notes-section">\s*<div class="notes-label">Notes<\/div>\s*<div class="notes-content"><%= contract\.notes \|\| contract\.FooterText \|\| '' %><\/div>\s*<\/div>\s*<% \} %>/g,
      `<div class="notes-section">
      <div class="notes-label">NOTE</div>
      <div class="notes-content">${notes}</div>
    </div>`
    );
    processedTemplate = processedTemplate.replace(/<div class="notes-label">Notes<\/div>/g, `<div class="notes-label">NOTE</div>`);
  }

  const generatedDate = formatDate(new Date());
  if (!processedTemplate.includes('class="footer"')) {
    processedTemplate = processedTemplate.replace(
      /<\/body>/,
      `<div class="footer" style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666;">
      <p>Generated on: ${generatedDate}</p>
    </div>
</body>`
    );
  } else {
    processedTemplate = processedTemplate.replace(
      /<div class="footer"[^>]*>[\s\S]*?<\/div>/g,
      `<div class="footer" style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666;">
      <p>Generated on: ${generatedDate}</p>
    </div>`
    );
  }

  processedTemplate = processedTemplate.replace(
    /<%[-=] ?contract\.([\w.]+) ?%>/g,
    (match, variable) => {
      const props = variable.split(".");
      let value = contract;
      for (const prop of props) {
        value = value?.[prop];
        if (value === undefined) return "";
      }
      if (typeof value === "number") return value.toFixed(2);
      return value;
    }
  );

  processedTemplate = processedTemplate.replace(/<%[\s\S]*?%>/g, "");

  return processedTemplate;
}
