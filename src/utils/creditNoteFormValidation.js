/**
 * Shared validation for Create + Update Credit Note (keep in sync).
 */
import { formatAmount } from "@/components/formatAmount";
import {
  getLineSubtotal,
  getLineTaxAmount,
  getItemTotal,
  roundMoney,
} from "@/utils/itemDiscountUtils";

export const CREDIT_NOTE_REASON_OPTIONS = [
  { value: "01_return_of_goods", label: "Return of goods" },
  { value: "02_discount_allowance", label: "Discount / Allowance" },
  { value: "03_invoice_correction", label: "Correction of invoice" },
  { value: "04_other", label: "Other" },
];

export function getCreditNoteReasonOptions(t) {
  return CREDIT_NOTE_REASON_OPTIONS.map((o) => ({
    value: o.value,
    label: t
      ? t(`accounts.creditNotes.reasons.${o.value}`, { defaultValue: o.label })
      : o.label,
  }));
}

function msg(t, key, defaultValue, options = {}) {
  if (t) {
    return t(`accounts.creditNotes.validation.${key}`, {
      defaultValue,
      ...options,
    });
  }
  return defaultValue.replace(/\{\{(\w+)\}\}/g, (_, name) =>
    options[name] != null ? String(options[name]) : `{{${name}}}`,
  );
}

/** @returns {Record<string, string>} field -> message */
export function validateCreditNoteForm(creditNoteData, sourceInvoiceRules, t) {
  const errors = {};
  const isRefundToClient =
    creditNoteData.creditNoteType === "refund_to_client";
  const creditReason = creditNoteData.reason;
  const isReturnReason = creditReason === "01_return_of_goods";
  const isDiscountReason = creditReason === "02_discount_allowance";
  const isOtherReason = creditReason === "04_other";

  const validationSchema = {
    refundRequiredFields: isRefundToClient
      ? ["paidFromBankAccount", "refundDate", "paymentMethod"]
      : [],
  };

  if (!creditNoteData.business)
    errors.business = msg(t, "businessRequired", "Business is required");

  if (
    creditNoteData.entityType === "customer" &&
    !creditNoteData.customer
  ) {
    errors.customer = msg(t, "customerRequired", "Customer is required");
  }
  if (
    creditNoteData.entityType === "vendor" &&
    !creditNoteData.vendor
  ) {
    errors.vendor = msg(t, "vendorRequired", "Vendor is required");
  }

  if (!creditNoteData.expenseAccount)
    errors.expenseAccount = msg(
      t,
      "expenseAccountRequired",
      "Expense account is required",
    );

  if (
    validationSchema.refundRequiredFields.includes("paidFromBankAccount") &&
    !creditNoteData.paidFromBankAccount
  ) {
    errors.paidFromBankAccount = msg(
      t,
      "bankAccountRequiredForRefund",
      "Bank account is required for refund to client",
    );
  }
  if (
    validationSchema.refundRequiredFields.includes("refundDate") &&
    !creditNoteData.refundDate
  ) {
    errors.refundDate = msg(
      t,
      "refundDateRequiredForRefund",
      "Refund date is required for refund to client",
    );
  }
  if (
    validationSchema.refundRequiredFields.includes("paymentMethod") &&
    !creditNoteData.paymentMethod
  ) {
    errors.paymentMethod = msg(
      t,
      "paymentMethodRequiredForRefund",
      "Payment method is required for refund to client",
    );
  }

  if (
    !creditNoteData.reference ||
    creditNoteData.reference.trim() === ""
  )
    errors.reference = msg(
      t,
      "referenceRequired",
      "Reference number is required",
    );

  if (
    !creditNoteData.items ||
    creditNoteData.items.length === 0
  ) {
    errors.items = msg(
      t,
      "itemsRequired",
      "At least one credit note item is required",
    );
  }

  const invalidAmount = (creditNoteData.items || []).some(
    (row) => row.total == null || row.total < 0,
  );
  if (invalidAmount && creditNoteData.items?.length > 0) {
    errors.items = msg(
      t,
      "lineTotalsNegative",
      "Line totals cannot be negative",
    );
  }

  const customerInvoiceLinked =
    creditNoteData.entityType === "customer" &&
    Boolean(creditNoteData.sourceInvoice);

  /** MyInvois / LHDN line + reason rules only when an e‑Invoice‑valid source is linked */
  const lhdnEInvoiceStrict =
    customerInvoiceLinked &&
    sourceInvoiceRules &&
    sourceInvoiceRules.isLhdnLinkedCustomerInvoice === true;

  if (customerInvoiceLinked && sourceInvoiceRules) {
    if (lhdnEInvoiceStrict) {
      if (!creditNoteData.reason) {
        errors.reason = msg(t, "reasonRequired", "Please select reason.");
      }
      if (
        creditNoteData.reason &&
        !CREDIT_NOTE_REASON_OPTIONS.some(
          (option) => option.value === creditNoteData.reason,
        )
      ) {
        errors.reason = msg(
          t,
          "reasonInvalid",
          "Reason must be 01 Return of goods, 02 Discount/Allowance, 03 Correction of invoice, or 04 Other.",
        );
      }
      if (!String(creditNoteData.notes || "").trim()) {
        errors.notes = msg(
          t,
          "notesRequired",
          "Remarks or description are required.",
        );
      }
    }
    if (sourceInvoiceRules?.invoiceDate) {
      const invoiceDate = new Date(sourceInvoiceRules.invoiceDate);
      const creditDate = new Date(creditNoteData.creditNoteDate);
      if (
        !Number.isNaN(invoiceDate.getTime()) &&
        !Number.isNaN(creditDate.getTime()) &&
        creditDate < invoiceDate
      ) {
        errors.creditNoteDate = msg(
          t,
          "dateAfterInvoice",
          "Credit note date must be the same as or later than the linked invoice date.",
        );
      }
    }
    if (
      !isRefundToClient &&
      sourceInvoiceRules?.invoiceTotal != null &&
      (parseFloat(creditNoteData.total) || 0) >
        sourceInvoiceRules.invoiceTotal + 0.01
    ) {
      errors.total = msg(
        t,
        "totalExceedsInvoice",
        "Credit note total cannot exceed the linked invoice amount.",
      );
    }
    if (
      isRefundToClient &&
      sourceInvoiceRules?.invoicePaymentStatus &&
      !["paid", "partial", "partially paid"].includes(
        sourceInvoiceRules.invoicePaymentStatus,
      )
    ) {
      errors.sourceInvoice = msg(
        t,
        "refundOnlyPaidPartial",
        "Refund to Client is only allowed for invoices with payment status Paid/Partial.",
      );
    }
    if (
      isRefundToClient &&
      sourceInvoiceRules?.invoicePaidAmount != null &&
      (parseFloat(creditNoteData.total) || 0) >
        sourceInvoiceRules.invoicePaidAmount + 0.01
    ) {
      errors.total = msg(
        t,
        "refundExceedsPaid",
        "Total Refund Amount cannot exceed the Total Amount Paid on the original invoice.",
      );
    }
    if (
      sourceInvoiceRules &&
      !sourceInvoiceRules.shippingWasOnInvoice &&
      (parseFloat(creditNoteData.shippingCharges) || 0) > 0
    ) {
      errors.shippingCharges = msg(
        t,
        "shippingOnlyIfOnInvoice",
        "Shipping is only allowed when the original invoice included shipping.",
      );
    }
    if (
      sourceInvoiceRules &&
      sourceInvoiceRules.shippingWasOnInvoice &&
      (parseFloat(creditNoteData.shippingCharges) || 0) > 1e-9 &&
      !creditNoteData.allowRefundShipping
    ) {
      errors.shippingCharges = msg(
        t,
        "enableShippingOrZero",
        "Enable “Include shipping on this credit note” or set shipping to zero.",
      );
    }
    if (
      sourceInvoiceRules?.invoiceShipping != null &&
      (parseFloat(creditNoteData.shippingCharges) || 0) >
        sourceInvoiceRules.invoiceShipping + 0.01
    ) {
      errors.shippingCharges = msg(
        t,
        "shippingExceedsInvoice",
        "Shipping cannot exceed the linked invoice shipping amount.",
      );
    }

    if (lhdnEInvoiceStrict) {
      const invItems = creditNoteData.items || [];
      for (let i = 0; i < invItems.length; i++) {
        const row = invItems[i];
        if (row.sourceInvoiceLineIndex == null) {
          errors.items = msg(
            t,
            "lhdnLinesFromInvoiceOnly",
            "When an LHDN e‑Invoice is selected, every line must come from that invoice (remove extra rows or clear the invoice).",
          );
          break;
        }
        const maxQ = row._cnMaxQty;
        if (
          maxQ != null &&
          (parseFloat(row.quantity) || 0) > maxQ + 1e-9
        ) {
          errors.items = msg(
            t,
            "lineQtyExceedsInvoice",
            "Line {{n}}: quantity cannot exceed the invoice ({{max}}).",
            { n: i + 1, max: maxQ },
          );
          break;
        }
        if (
          isReturnReason &&
          maxQ != null &&
          Math.abs((parseFloat(row.quantity) || 0) - maxQ) > 1e-9
        ) {
          errors.items = msg(
            t,
            "lineQtyMustMatchReturn",
            "Line {{n}}: for reason 01 - Return of goods, quantity must match the invoice quantity ({{max}}).",
            { n: i + 1, max: maxQ },
          );
          break;
        }
        if (row._cnMaxAmount != null) {
          const lineComputed = roundMoney(
            getItemTotal(
              row.quantity,
              row.unitPrice,
              row.discount,
              row.taxRate,
            ),
          );
          const maxLine = roundMoney(parseFloat(row._cnMaxAmount));
          if (lineComputed > maxLine) {
            errors.items = msg(
              t,
              "lineAmountExceedsOriginal",
              "Line {{n}}: refunded amount cannot exceed the original line amount ({{amount}}).",
              { n: i + 1, amount: formatAmount(row._cnMaxAmount) },
            );
            break;
          }
        }
        if (creditNoteData.reason === "02_discount_allowance") {
          if (Math.abs((parseFloat(row.quantity) || 0) - 1) > 1e-9) {
            errors.items = msg(
              t,
              "lineQtyMustBeOneDiscount",
              "Line {{n}}: for reason 02 - Discount, quantity must be 1.",
              { n: i + 1 },
            );
            break;
          }
        }
        if (
          (isReturnReason || isOtherReason) &&
          row._cnOriginalRate != null
        ) {
          const origRate = parseFloat(row._cnOriginalRate) || 0;
          const cnRate = parseFloat(row.unitPrice) || 0;
          if (Math.abs(cnRate - origRate) > 0.01) {
            errors.items = msg(
              t,
              "lineRateCannotChange",
              "Line {{n}}: rate cannot be changed for this reason.",
              { n: i + 1 },
            );
            break;
          }
        }
        if (
          (isReturnReason || isOtherReason) &&
          row._cnOriginalDiscount != null
        ) {
          const origDiscount = parseFloat(row._cnOriginalDiscount) || 0;
          const cnDiscount = parseFloat(row.discount) || 0;
          if (Math.abs(cnDiscount - origDiscount) > 0.01) {
            errors.items = msg(
              t,
              "lineDiscountCannotChange",
              "Line {{n}}: discount cannot be changed for this reason.",
              { n: i + 1 },
            );
            break;
          }
        }
        const origId = String(row._cnAllowedTaxId || "");
        const origRateTax = parseFloat(row._cnAllowedTaxRate) || 0;
        const hadNoTax = !origId && origRateTax === 0;
        const cnTaxId = String(row.taxId || "");
        const cnRate = parseFloat(row.taxRate) || 0;
        const lineSub = getLineSubtotal(
          row.quantity,
          row.unitPrice,
          row.discount,
        );
        const cnTaxAmt = getLineTaxAmount(lineSub, cnRate);
        if (hadNoTax) {
          if (cnRate > 1e-6 || cnTaxId || cnTaxAmt > 1e-6) {
            errors.items = msg(
              t,
              "lineNoTaxOnInvoice",
              "Line {{n}}: this invoice line had no tax; remove tax from the credit note line.",
              { n: i + 1 },
            );
            break;
          }
        } else if (origId && cnTaxId !== origId) {
          errors.items = msg(
            t,
            "lineTaxTypeMustMatch",
            "Line {{n}}: tax type must match the invoice.",
            { n: i + 1 },
          );
          break;
        } else if (!origId && Math.abs(cnRate - origRateTax) > 0.02) {
          errors.items = msg(
            t,
            "lineTaxRateMustMatch",
            "Line {{n}}: tax rate must match the invoice ({{rate}}%).",
            { n: i + 1, rate: origRateTax },
          );
          break;
        }
      }
    }
  }

  if (
    creditNoteData.entityType === "vendor" &&
    creditNoteData.vendorInvoice &&
    sourceInvoiceRules?.isVendorSource
  ) {
    if (sourceInvoiceRules?.invoiceDate) {
      const invoiceDate = new Date(sourceInvoiceRules.invoiceDate);
      const creditDate = new Date(creditNoteData.creditNoteDate);
      if (
        !Number.isNaN(invoiceDate.getTime()) &&
        !Number.isNaN(creditDate.getTime()) &&
        creditDate < invoiceDate
      ) {
        errors.creditNoteDate = msg(
          t,
          "dateAfterVendorBill",
          "Credit note date must be the same as or later than the linked vendor bill date.",
        );
      }
    }
    if (
      sourceInvoiceRules?.invoiceTotal != null &&
      (parseFloat(creditNoteData.total) || 0) >
        sourceInvoiceRules.invoiceTotal + 0.01
    ) {
      errors.total = msg(
        t,
        "totalExceedsVendorBill",
        "Credit note total cannot exceed the linked vendor bill amount.",
      );
    }
    if (
      isRefundToClient &&
      sourceInvoiceRules?.invoicePaidAmount != null &&
      (parseFloat(creditNoteData.total) || 0) >
        sourceInvoiceRules.invoicePaidAmount + 0.01
    ) {
      errors.total = msg(
        t,
        "refundExceedsVendorPaid",
        "Refund total cannot exceed the paid amount on the vendor bill.",
      );
    }
    if (
      sourceInvoiceRules &&
      !sourceInvoiceRules.shippingWasOnInvoice &&
      (parseFloat(creditNoteData.shippingCharges) || 0) > 0
    ) {
      errors.shippingCharges = msg(
        t,
        "shippingOnlyIfOnVendorBill",
        "Shipping is only allowed when the vendor bill included shipping.",
      );
    }
    if (
      sourceInvoiceRules &&
      sourceInvoiceRules.shippingWasOnInvoice &&
      (parseFloat(creditNoteData.shippingCharges) || 0) > 1e-9 &&
      !creditNoteData.allowRefundShipping
    ) {
      errors.shippingCharges = msg(
        t,
        "enableShippingOrZero",
        "Enable “Include shipping on this credit note” or set shipping to zero.",
      );
    }
    if (
      sourceInvoiceRules?.invoiceShipping != null &&
      (parseFloat(creditNoteData.shippingCharges) || 0) >
        sourceInvoiceRules.invoiceShipping + 0.01
    ) {
      errors.shippingCharges = msg(
        t,
        "shippingExceedsVendorBill",
        "Shipping cannot exceed the amount on the vendor bill.",
      );
    }
    const vItems = creditNoteData.items || [];
    for (let i = 0; i < vItems.length; i++) {
      const row = vItems[i];
      if (row.sourceInvoiceLineIndex == null) continue;
      const maxQ = row._cnMaxQty;
      if (
        maxQ != null &&
        (parseFloat(row.quantity) || 0) > maxQ + 1e-9
      ) {
        errors.items = msg(
          t,
          "lineQtyExceedsVendorBill",
          "Line {{n}}: quantity cannot exceed the vendor bill line ({{max}}).",
          { n: i + 1, max: maxQ },
        );
        break;
      }
      if (row._cnMaxAmount != null) {
        const lineComputed = roundMoney(
          getItemTotal(
            row.quantity,
            row.unitPrice,
            row.discount,
            row.taxRate,
          ),
        );
        const maxLine = roundMoney(parseFloat(row._cnMaxAmount));
        if (lineComputed > maxLine) {
          errors.items = msg(
            t,
            "lineAmountExceedsVendorLine",
            "Line {{n}}: amount cannot exceed the original line ({{amount}}).",
            { n: i + 1, amount: formatAmount(row._cnMaxAmount) },
          );
          break;
        }
      }
      const origId = String(row._cnAllowedTaxId || "");
      const origRateTax = parseFloat(row._cnAllowedTaxRate) || 0;
      const hadNoTax = !origId && origRateTax === 0;
      const cnTaxId = String(row.taxId || "");
      const cnRate = parseFloat(row.taxRate) || 0;
      const lineSub = getLineSubtotal(
        row.quantity,
        row.unitPrice,
        row.discount,
      );
      const cnTaxAmt = getLineTaxAmount(lineSub, cnRate);
      if (hadNoTax) {
        if (cnRate > 1e-6 || cnTaxId || cnTaxAmt > 1e-6) {
          errors.items = msg(
            t,
            "lineNoTaxOnBill",
            "Line {{n}}: this bill line had no tax; remove tax or use a new line.",
            { n: i + 1 },
          );
          break;
        }
      } else if (origId && cnTaxId !== origId) {
        errors.items = msg(
          t,
          "lineTaxTypeMustMatchVendor",
          "Line {{n}}: tax type must match the vendor bill line.",
          { n: i + 1 },
        );
        break;
      } else if (!origId && Math.abs(cnRate - origRateTax) > 0.02) {
        errors.items = msg(
          t,
          "lineTaxRateMustMatchVendor",
          "Line {{n}}: tax rate must match the vendor bill ({{rate}}%).",
          { n: i + 1, rate: origRateTax },
        );
        break;
      }
    }
  }

  return errors;
}
