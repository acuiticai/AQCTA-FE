/**
 * Shared validation for Create + Update Debit Note (keep in sync).
 */
export const DEBIT_NOTE_REASON_OPTIONS = [
  { value: "01_undercharged_invoice", label: "Undercharged Invoice" },
  { value: "02_additional_charges", label: "Additional Charges" },
  { value: "03_correction", label: "Correction" },
  { value: "04_other", label: "Other" },
];

const LEGACY_DEBIT_NOTE_REASON_MAP = {
  "01_additional_billing": "01_undercharged_invoice",
  "02_price_or_quantity_adjustment": "02_additional_charges",
  "03_invoice_correction": "03_correction",
  other: "04_other",
};

export const normalizeDebitNoteReason = (reason) =>
  LEGACY_DEBIT_NOTE_REASON_MAP[reason] || reason || "";

export function getDebitNoteReasonOptions(t) {
  return DEBIT_NOTE_REASON_OPTIONS.map((o) => ({
    value: o.value,
    label: t
      ? t(`accounts.debitNotes.reasons.${o.value}`, { defaultValue: o.label })
      : o.label,
  }));
}

const msg = (t, key, defaultValue, options = {}) =>
  t
    ? t(`accounts.debitNotes.validation.${key}`, { defaultValue, ...options })
    : defaultValue;

/** @returns {Record<string, string>} field -> message */
export function validateDebitNoteForm(debitNoteData, sourceInvoiceRules, t) {
  const errors = {};

  if (!debitNoteData.business)
    errors.business = msg(t, "businessRequired", "Business is required");

  if (debitNoteData.entityType === "vendor" && !debitNoteData.vendor) {
    errors.vendor = msg(t, "vendorRequired", "Vendor is required");
  }
  if (debitNoteData.entityType === "customer" && !debitNoteData.customer) {
    errors.customer = msg(t, "customerRequired", "Customer is required");
  }

  if (!debitNoteData.expenseAccount)
    errors.expenseAccount = msg(
      t,
      "expenseAccountRequired",
      "Expense account is required",
    );

  if (
    !debitNoteData.reference ||
    debitNoteData.reference.trim() === ""
  )
    errors.reference = msg(
      t,
      "referenceRequired",
      "Reference number is required",
    );

  if (!debitNoteData.items || debitNoteData.items.length === 0) {
    errors.items = msg(
      t,
      "itemsRequired",
      "At least one debit note item is required",
    );
  }

  if ((parseFloat(debitNoteData.total) || 0) <= 0) {
    errors.total = msg(
      t,
      "totalMustBePositive",
      "Debit note total must be greater than zero",
    );
  }

  const zohoLike = (debitNoteData.items || []).some(
    (row) => row.sourceInvoiceLineIndex != null,
  );

  if (zohoLike) {
    const invalidAmount = (debitNoteData.items || []).some(
      (row) => !row.total || row.total <= 0,
    );
    if (invalidAmount) {
      errors.items = msg(
        t,
        "lineAmountMustBePositive",
        "Each line must have an amount greater than zero",
      );
    }
  }

  const customerDebitLinkedInvoice =
    debitNoteData.entityType === "customer" &&
    Boolean(debitNoteData.customerInvoice);

  const lhdnEInvoiceDebitStrict =
    customerDebitLinkedInvoice &&
    sourceInvoiceRules &&
    sourceInvoiceRules.isLhdnLinkedCustomerInvoice === true;

  if (
    debitNoteData.entityType === "customer" &&
    debitNoteData.customerInvoice &&
    sourceInvoiceRules
  ) {
    if (lhdnEInvoiceDebitStrict) {
      if (!debitNoteData.reason) {
        errors.reason = msg(
          t,
          "reasonRequiredLhdn",
          "Reason is required when linked to an LHDN e‑Invoice.",
        );
      }
      if (
        !DEBIT_NOTE_REASON_OPTIONS.some(
          (option) =>
            option.value === normalizeDebitNoteReason(debitNoteData.reason),
        )
      ) {
        errors.reason = msg(
          t,
          "reasonInvalid",
          "Reason must be 01 Undercharged Invoice, 02 Additional Charges, 03 Correction, or 04 Other.",
        );
      }
    }
    if (
      lhdnEInvoiceDebitStrict &&
      normalizeDebitNoteReason(debitNoteData.reason) === "04_other" &&
      !String(debitNoteData.notes || "").trim()
    ) {
      errors.notes = msg(
        t,
        "notesRequiredForOther",
        "Clear remarks are required when reason is 04 Other.",
      );
    }
    if (sourceInvoiceRules?.invoiceDate) {
      const invoiceDate = new Date(sourceInvoiceRules.invoiceDate);
      const debitDate = new Date(debitNoteData.debitNoteDate);
      if (
        !Number.isNaN(invoiceDate.getTime()) &&
        !Number.isNaN(debitDate.getTime()) &&
        debitDate < invoiceDate
      ) {
        errors.debitNoteDate = msg(
          t,
          "dateAfterInvoice",
          "Debit note date must be the same as or later than the linked invoice date.",
        );
      }
    }

    if (lhdnEInvoiceDebitStrict) {
      const invItems = debitNoteData.items || [];
      const allowsAdditionalLines = [
        "02_additional_charges",
        "04_other",
      ].includes(normalizeDebitNoteReason(debitNoteData.reason));
      for (let i = 0; i < invItems.length; i++) {
        const row = invItems[i];
        if (row.sourceInvoiceLineIndex == null) {
          if (!allowsAdditionalLines) {
            errors.items = msg(
              t,
              "extraLinesOnlyAdditionalOrOther",
              "When an LHDN e‑Invoice is selected, extra lines are only allowed for Additional Charges or Other.",
            );
            break;
          }
          continue;
        }
        const origId = String(row._cnAllowedTaxId || "");
        const origRate = parseFloat(row._cnAllowedTaxRate) || 0;
        const hadNoTax = !origId && origRate === 0;
        const dnTaxId = String(row.taxId || "");
        const dnRate = parseFloat(row.taxRate) || 0;
        if (!hadNoTax) {
          if (origId && dnTaxId !== origId) {
            errors.items = msg(
              t,
              "lineTaxTypeMustMatch",
              "Line {{n}}: tax type must match the invoice.",
              { n: i + 1 },
            );
            break;
          }
          if (!origId && Math.abs(dnRate - origRate) > 0.02) {
            errors.items = msg(
              t,
              "lineTaxRateMustMatch",
              "Line {{n}}: tax rate must match the invoice ({{rate}}%).",
              { n: i + 1, rate: origRate },
            );
            break;
          }
        }
      }
    }
  }

  if (
    debitNoteData.entityType === "vendor" &&
    debitNoteData.vendorInvoice &&
    sourceInvoiceRules?.isVendorSource
  ) {
    if (sourceInvoiceRules?.invoiceDate) {
      const invoiceDate = new Date(sourceInvoiceRules.invoiceDate);
      const debitDate = new Date(debitNoteData.debitNoteDate);
      if (
        !Number.isNaN(invoiceDate.getTime()) &&
        !Number.isNaN(debitDate.getTime()) &&
        debitDate < invoiceDate
      ) {
        errors.debitNoteDate = msg(
          t,
          "dateAfterVendorBill",
          "Debit note date must be the same as or later than the linked vendor bill date.",
        );
      }
    }
    const vItems = debitNoteData.items || [];
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
      const origId = String(row._cnAllowedTaxId || "");
      const origRate = parseFloat(row._cnAllowedTaxRate) || 0;
      const hadNoTax = !origId && origRate === 0;
      const dnTaxId = String(row.taxId || "");
      const dnRate = parseFloat(row.taxRate) || 0;
      if (!hadNoTax) {
        if (origId && dnTaxId !== origId) {
          errors.items = msg(
            t,
            "lineTaxTypeMustMatchVendor",
            "Line {{n}}: tax type must match the vendor bill line.",
            { n: i + 1 },
          );
          break;
        }
        if (!origId && Math.abs(dnRate - origRate) > 0.02) {
          errors.items = msg(
            t,
            "lineTaxRateMustMatchVendor",
            "Line {{n}}: tax rate must match the vendor bill ({{rate}}%).",
            { n: i + 1, rate: origRate },
          );
          break;
        }
      }
    }
  }

  return errors;
}
