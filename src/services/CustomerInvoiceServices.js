// src/services/CustomerInvoiceServices.js
import axios from "axios";
import { formatCurrencyAmount } from "@/components/formatAmount";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const requests = {
  get: (url, config = {}) => axios.get(`${Base_URL}${url}`, config),
  post: (url, data, config = {}) =>
    axios.post(`${Base_URL}${url}`, data, config),
  put: (url, data, config = {}) => axios.put(`${Base_URL}${url}`, data, config),
  delete: (url, config = {}) => axios.delete(`${Base_URL}${url}`, config),
  patch: (url, data, config = {}) =>
    axios.patch(`${Base_URL}${url}`, data, config),
};

const CustomerInvoiceServices = {
  // Get all customer invoices with filters
  getAllInvoices: async (params = {}) => {
    return requests.get("/proforma-invoice", { params });
  },

  getInvoicesByContract: async (contractId) => {
    return requests.get(`/proforma-invoice/get_by_contract/${contractId}`);
  },

  // Get single invoice by ID
  getInvoiceById: async (id) => {
    return requests.get(`/proforma-invoice/${id}`);
  },

  // Create new invoice
  createInvoice: async (invoiceData) => {
    return requests.post("/proforma-invoice", invoiceData);
  },

  // Update invoice
  updateInvoice: async (id, invoiceData) => {
    return requests.put(`/proforma-invoice/${id}`, invoiceData);
  },

  // Delete invoice
  deleteInvoice: async (id) => {
    return requests.delete(`/proforma-invoice/${id}`);
  },

  // Payment related services
  addPaymentToInvoice: async (invoiceId, paymentData) => {
    return requests.post(
      `/proforma-invoice/${invoiceId}/payments`,
      paymentData
    );
  },

  getInvoicePayments: async (invoiceId) => {
    return requests.get(`/proforma-invoice/${invoiceId}/payments`);
  },

  deleteInvoicePayment: async (invoiceId, paymentId) => {
    return requests.delete(
      `/proforma-invoice/${invoiceId}/payments/${paymentId}`
    );
  },

  // Bulk payment operations
  bulkRecordPayment: async (paymentData) => {
    return requests.post("/proforma-invoice/bulk/record-payment", paymentData);
  },

  getBulkPaymentInvoices: async (invoiceIds) => {
    return requests.post("/proforma-invoice/bulk/get-payment-invoices", {
      invoiceIds,
    });
  },

  // Update invoice status
  updateInvoiceStatus: async (id, status) => {
    return requests.patch(`/proforma-invoice/update-status/${id}`, { status });
  },

  // Bulk status update
  bulkUpdateStatus: async (invoiceIds, status) => {
    return requests.put("/proforma-invoice/bulk/status", {
      invoiceIds,
      status,
    });
  },

  // Helper functions
  formatCurrency: (amount, currency = "USD") => {
    return formatCurrencyAmount(currency, amount ?? 0);
  },

  // Get selectable invoices for bulk operations
  getSelectableInvoices: (invoices) => {
    if (!Array.isArray(invoices)) return [];

    return invoices.filter((invoice) => {
      return (
        invoice &&
        invoice._id &&
        CustomerInvoiceServices.canInvoiceBeSelected(invoice)
      );
    });
  },

  /**
   * MyInvois: credit/debit notes should only link to customer invoices that are
   * already Valid on LHDN (and still meet normal “selectable” business rules).
   */
  isLhdnStatusValid: (invoice) => {
    const s = invoice?.lhdn_status;
    if (s == null || String(s).trim() === "") return false;
    return String(s).trim().toLowerCase() === "valid";
  },

  getSelectableInvoicesForEInvoiceLink: (invoices) => {
    const base = CustomerInvoiceServices.getSelectableInvoices(invoices);
    return base.filter((inv) =>
      CustomerInvoiceServices.isLhdnStatusValid(inv),
    );
  },

  // Check if invoice can be selected for bulk operations
  canInvoiceBeSelected: (invoice) => {
    const selectableStatuses = [
      "draft", // Draft invoices can receive payments
      "generated", // Generated invoices can receive payments
      "Generated", // Generated invoices can receive payments
      "Request Sent", // Sent invoices can receive payments
      "Sent", // Sent invoices can receive payments (alternative status)
      "Pending", // Pending invoices can receive payments
      "pending", // Pending invoices (lowercase variant)
      "Collection Scheduled", // Scheduled invoices can receive payments
      "Partially Paid", // Partially paid invoices can receive additional payments
      "Paid", // Paid invoices might need additional payments (partial payments)
    ];

    if (
      !invoice ||
      !invoice._id ||
      !invoice.grandTotal ||
      invoice.grandTotal <= 0
    ) {
      return false;
    }

    // Calculate remaining amount on the fly if not provided
    const remaining = CustomerInvoiceServices.calculateRemainingAmount(invoice);

    // Case-insensitive status check
    const invoiceStatus = invoice.status ? invoice.status.trim() : "";
    const normalizedStatuses = selectableStatuses.map(s => s.toLowerCase());
    const isSelectableStatus = normalizedStatuses.includes(invoiceStatus.toLowerCase());

    return (
      isSelectableStatus &&
      (remaining > 0 || invoiceStatus.toLowerCase() !== "paid") // Allow selection if there's remaining amount or status is not paid
    );
  },

  // Calculate bulk payment summary
  calculateBulkPaymentSummary: (invoices) => {
    if (!Array.isArray(invoices) || invoices.length === 0) {
      return {
        totalInvoices: 0,
        totalAmount: 0,
        totalRemaining: 0,
        currencies: [],
        customers: [],
      };
    }

    const currencies = [
      ...new Set(invoices.map((inv) => inv.currency).filter(Boolean)),
    ];
    const customerIds = [
      ...new Set(invoices.map((inv) => inv.customer_id?._id).filter(Boolean)),
    ];
    const customerNames = [
      ...new Set(invoices.map((inv) => inv.customer_name).filter(Boolean)),
    ];

    // Calculate total remaining amount (this will be converted to bank currency in the modal)
    const totalRemaining = invoices.reduce(
      (sum, inv) => sum + CustomerInvoiceServices.calculateRemainingAmount(inv),
      0
    );

    // For display purposes, if all invoices are in the same currency, show the total
    // Otherwise, show "Multiple currencies" and let the modal handle conversion
    const totalAmount =
      currencies.length === 1
        ? invoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0)
        : 0;

    return {
      totalInvoices: invoices.length,
      totalAmount,
      totalRemaining,
      currencies,
      customers: customerIds,
    };
  },

  // Calculate remaining amount for an invoice (using allocated amounts)
  calculateRemainingAmount: (invoice) => {
    const total = invoice.grandTotal || 0;
    const paid = (invoice.payments || []).reduce((sum, payment) => {
      // Priority order for payment amount:
      // 1. allocatedAmount (amount applied to invoice in invoice currency)
      // 2. conversionDetails.convertedAmount (stored conversion details)
      // 3. amountInInvoiceCurrency (fallback)
      // 4. amount (payment amount in payment currency - last resort)
      let paymentAmount = 0;

      if (payment.allocatedAmount !== undefined) {
        paymentAmount = payment.allocatedAmount;
      } else if (
        payment.conversionDetails &&
        payment.conversionDetails.convertedAmount
      ) {
        paymentAmount = payment.conversionDetails.convertedAmount;
      } else if (payment.amountInInvoiceCurrency) {
        paymentAmount = payment.amountInInvoiceCurrency;
      } else {
        paymentAmount = payment.amount || 0;
      }

      return sum + paymentAmount;
    }, 0);
    if (
      invoice.amountDueChain != null &&
      !Number.isNaN(Number(invoice.amountDueChain))
    ) {
      return Math.max(0, Number(invoice.amountDueChain));
    }
    const creditAdj =
      invoice.chainCreditNotesTotal != null
        ? Number(invoice.chainCreditNotesTotal) || 0
        : 0;
    const debitAdj =
      invoice.chainDebitNotesTotal != null
        ? Number(invoice.chainDebitNotesTotal) || 0
        : 0;
    return Math.max(0, total - paid - creditAdj + debitAdj);
  },

  // Validate payment allocation
  validatePaymentAllocation: (invoices, paymentAllocations) => {
    const errors = [];

    invoices.forEach((invoice) => {
      const allocation = paymentAllocations[invoice._id];
      if (!allocation) return;

      const remaining =
        CustomerInvoiceServices.calculateRemainingAmount(invoice);

      if (allocation.amount < 0) {
        errors.push(`Invalid amount for invoice ${invoice.invoice_number}`);
      }

      if (allocation.amount > remaining) {
        errors.push(
          `Amount exceeds remaining balance for invoice ${invoice.invoice_number}`
        );
      }
    });

    return errors;
  },

  // Validate single customer constraint
  validateSingleCustomer: (invoices) => {
    if (!invoices || invoices.length === 0) return true;
    const customerIds = [
      ...new Set(invoices.map((inv) => inv.customer_id?._id).filter(Boolean)),
    ];
    return customerIds.length <= 1;
  },

  // Get selected customer info
  getSelectedCustomerInfo: (invoices) => {
    if (!invoices || invoices.length === 0) return null;
    const customerIds = [
      ...new Set(invoices.map((inv) => inv.customer_id?._id).filter(Boolean)),
    ];
    if (customerIds.length === 0) return null;
    const firstInvoice = invoices.find(
      (inv) => inv.customer_id?._id === customerIds[0]
    );
    return firstInvoice?.customer_id || null;
  },

  // Get signed URL for invoice document (with timeout to avoid hanging on connection reset)
  getSignedInvoiceUrl: async (key, config = {}) => {
    const timeout = config.timeout ?? 20000; // 20 seconds default
    return requests.get("/proforma-invoice/signed-url", {
      params: { key },
      timeout,
      ...config,
    });
  },

  // Get PDF as blob via backend proxy (avoids CORS / "Failed to fetch" when loading from S3)
  getInvoiceDocumentPdfBlob: async (key, config = {}) => {
    const timeout = config.timeout ?? 30000;
    const response = await axios.get(`${Base_URL}/proforma-invoice/document-pdf`, {
      params: { key },
      timeout,
      responseType: "blob",
      withCredentials: true,
      ...config,
    });
    return response.data;
  },
};

export default CustomerInvoiceServices;
