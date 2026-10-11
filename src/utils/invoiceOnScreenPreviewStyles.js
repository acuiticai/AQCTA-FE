/**
 * On-screen invoice template preview styles — shared by view-customer-invoice
 * (InvoiceRenderer) and recurring next-invoice preview. Keeps table borders/layout
 * when embedding template HTML inside the app shell (Tailwind resets, etc.).
 */

export const INVOICE_PREVIEW_PAGE_STYLES = `
.tpl-doc-page-wrap {
  display: flex;
  justify-content: center;
  background: #f3f4f6;
  padding: 24px 12px;
  width: 100%;
}
.tpl-doc-page {
  width: 794px;
  max-width: 100%;
  min-height: 1123px;
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.06);
  border: 1px solid #e5e7eb;
  overflow: visible;
  position: relative;
  box-sizing: border-box;
}
/* Template body padding (body → .tpl-doc-body); safety CSS must not zero this out */
.tpl-doc-page .tpl-doc-body {
  padding: 36px 48px;
  box-sizing: border-box;
  width: 100%;
  min-height: 100%;
  background: #fff;
  color: #000;
}
@media print {
  .tpl-doc-page-wrap { background: #fff; padding: 0; }
  .tpl-doc-page { box-shadow: none; border: 0; width: 100%; }
}
`;

/** Mirrors InvoiceRenderer UnifiedInvoice safetyStyles (.invoice-container). */
export const INVOICE_PREVIEW_SAFETY_STYLES = `
  .invoice-container { overflow: visible !important; height: auto !important; max-height: none !important; box-sizing: border-box; }
  .invoice-container > div:not(.tpl-doc-body) { margin: 0; padding: 0; max-width: 100%; box-sizing: border-box; }
  .invoice-container,
  .invoice-container * {
    font-size: inherit;
  }
  .invoice-container {
    font-size: 13px !important;
    line-height: 1.45 !important;
  }
  .invoice-container table { width: 100% !important; max-width: 100% !important; border-collapse: collapse; margin: 0 !important; box-sizing: border-box; table-layout: auto; }
  .invoice-container .items-table,
  .invoice-container table.items-table { width: 100% !important; max-width: 100% !important; margin-left: 0 !important; margin-right: 0 !important; }
  .invoice-container .company-name { font-size: 16px !important; }
  .invoice-container .company-address,
  .invoice-container .company-contact,
  .invoice-container .invoice-details,
  .invoice-container .invoice-meta,
  .invoice-container .document-meta,
  .invoice-container .billing-shipping,
  .invoice-container .financial-summary,
  .invoice-container .summary-box,
  .invoice-container .payment-info {
    font-size: 11.5px !important;
  }
  .invoice-container .invoice-title { font-size: 19px !important; }
  .invoice-container .items-table,
  .invoice-container table.items-table {
    font-size: 12px !important;
  }
  .invoice-container .invoice-details,
  .invoice-container .invoice-meta,
  .invoice-container .document-meta {
    display: flex !important;
    flex-wrap: wrap !important;
    justify-content: space-between !important;
    align-items: flex-start !important;
    gap: 10px 14px !important;
    margin-bottom: 18px !important;
  }
  .invoice-container .detail-row {
    display: inline-flex !important;
    align-items: baseline !important;
    gap: 6px !important;
    margin: 0 !important;
    flex: 0 1 auto;
    min-width: max-content;
    max-width: 100%;
  }
  .invoice-container .detail-label {
    white-space: nowrap !important;
    flex: 0 0 auto;
  }
  .invoice-container .detail-value {
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  .invoice-container .invoice-details > [data-flexa-cf-header="1"],
  .invoice-container .invoice-meta > [data-flexa-cf-header="1"],
  .invoice-container .document-meta > [data-flexa-cf-header="1"] {
    flex: 1 1 240px !important;
    width: auto !important;
    max-width: 340px !important;
    margin-top: 0 !important;
  }
  .invoice-container .header-separator {
    margin: 14px 0 12px !important;
  }
  .invoice-container .invoice-title {
    margin: 12px 0 18px !important;
  }
  .invoice-container .billing-shipping {
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
    gap: 32px !important;
    align-items: start !important;
    margin-bottom: 22px !important;
  }
  .invoice-container .address-grid {
    column-gap: 8px !important;
  }
  .invoice-container .items-table,
  .invoice-container table.items-table {
    margin-top: 20px !important;
  }
  .invoice-container .items-table th,
  .invoice-container .items-table td,
  .invoice-container table.items-table th,
  .invoice-container table.items-table td {
    vertical-align: top !important;
    padding-left: 10px !important;
    padding-right: 10px !important;
  }
  .invoice-container .items-table thead th,
  .invoice-container table.items-table thead th {
    white-space: nowrap !important;
    font-weight: 700 !important;
    padding-top: 8px !important;
    padding-bottom: 8px !important;
  }
  .invoice-container .items-table tbody td,
  .invoice-container table.items-table tbody td {
    padding-top: 10px !important;
    padding-bottom: 10px !important;
  }
  .invoice-container .items-table th:first-child,
  .invoice-container .items-table td:first-child,
  .invoice-container table.items-table th:first-child,
  .invoice-container table.items-table td:first-child {
    width: 36px !important;
    text-align: left !important;
    padding-left: 8px !important;
  }
  .invoice-container .items-table th:last-child,
  .invoice-container .items-table td:last-child,
  .invoice-container table.items-table th:last-child,
  .invoice-container table.items-table td:last-child {
    padding-right: 10px !important;
  }
  .invoice-container .items-table th:nth-child(2),
  .invoice-container .items-table td:nth-child(2),
  .invoice-container .items-table th:nth-child(3),
  .invoice-container .items-table td:nth-child(3),
  .invoice-container table.items-table th:nth-child(2),
  .invoice-container table.items-table td:nth-child(2),
  .invoice-container table.items-table th:nth-child(3),
  .invoice-container table.items-table td:nth-child(3) {
    text-align: left !important;
  }
  .invoice-container .items-table th:nth-last-child(-n+5),
  .invoice-container .items-table td:nth-last-child(-n+5),
  .invoice-container table.items-table th:nth-last-child(-n+5),
  .invoice-container table.items-table td:nth-last-child(-n+5) {
    text-align: right !important;
  }
  .invoice-container .summary-section,
  .invoice-container .financial-summary,
  .invoice-container .summary-box {
    margin-top: 16px !important;
  }
  .invoice-container thead { display: table-header-group; }
  .invoice-container tbody { display: table-row-group; }
  .invoice-container tr { display: table-row; }
  .invoice-container th, .invoice-container td { display: table-cell; box-sizing: border-box; }
  .invoice-container th,
  .invoice-container td {
    padding-left: 8px !important;
    padding-right: 8px !important;
  }
  .invoice-container .items-table thead tr { border-bottom: 2px solid #777 !important; }
  .invoice-container .items-table tbody tr { border-bottom: 1px solid #e5e5e5 !important; }
`;
