// src/services/EInvoiceServices.js
//
// Client for the PCI MyInvois (LHDN) e-invoice API.
// Pairs with `PCI-BE/Invoices/EInvoiceRoutes.js`.
import axios from "axios";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const EInvoiceServices = {
  /** Validate & build the LHDN payload preview (does NOT submit). */
  generate: async (invoiceId) =>
    axios.post(`${Base_URL}/e-invoice/generate/${invoiceId}`),

  /** Submit the invoice to LHDN. */
  submit: async (invoiceId) =>
    axios.post(`${Base_URL}/e-invoice/submit/${invoiceId}`),

  /** Force-refresh status from LHDN using the stored UUID. */
  getStatus: async (invoiceId) =>
    axios.get(`${Base_URL}/e-invoice/status/${invoiceId}`),

  /**
   * Full-page e-invoice payload (InvoisPls-shaped). `code` is invoice_number or Mongo id.
   */
  getDetails: async (code) =>
    axios.get(
      `${Base_URL}/e-invoice/details/${encodeURIComponent(String(code ?? ""))}`,
    ),

  /** Reset a rejected/invalid invoice and resubmit. */
  retry: async (invoiceId) =>
    axios.post(`${Base_URL}/e-invoice/retry/${invoiceId}`),

  submitCreditNote: async (creditNoteId) =>
    axios.post(`${Base_URL}/e-invoice/credit-note/submit/${creditNoteId}`),

  getCreditNoteStatus: async (creditNoteId) =>
    axios.get(`${Base_URL}/e-invoice/credit-note/status/${creditNoteId}`),

  retryCreditNote: async (creditNoteId) =>
    axios.post(`${Base_URL}/e-invoice/credit-note/retry/${creditNoteId}`),

  submitDebitNote: async (debitNoteId) =>
    axios.post(`${Base_URL}/e-invoice/debit-note/submit/${debitNoteId}`),

  getDebitNoteStatus: async (debitNoteId) =>
    axios.get(`${Base_URL}/e-invoice/debit-note/status/${debitNoteId}`),

  retryDebitNote: async (debitNoteId) =>
    axios.post(`${Base_URL}/e-invoice/debit-note/retry/${debitNoteId}`),

  /**
   * Look up a TIN on MyInvois from the Business Details screen.
   * Matches PCI-BE: POST /api/BusinessDetails/search-tin
   * (InvoisPls uses POST /api/Business/search-tin; same body.)
   *   payload: { idType, idValue, businessId }
   */
  searchTinForBusiness: async (payload) =>
    axios.post(`${Base_URL}/BusinessDetails/search-tin`, payload),

  /**
   * TIN lookup from the customer e-invoice block (same body as business).
   * PCI-BE: POST /api/customers/search-tin (NCustomerRoute on app.use("/api", …)).
   * The old path /New_Customers/customers/... was wrong and returned 404.
   */
  searchTinForCustomer: async (payload) =>
    axios.post(`${Base_URL}/customers/search-tin`, payload),

  /**
   * Merge multiple proforma (customer) invoices into one B2C consolidated
   * e-invoice (LHDN), same flow as InvoisPls consolidated-from-invoices.
   */
  createConsolidatedFromInvoices: async (body) =>
    axios.post(
      `${Base_URL}/e-invoice/consolidated-from-invoices`,
      body,
    ),
};

export default EInvoiceServices;
