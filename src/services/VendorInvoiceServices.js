import requests from "./httpService";
import { formatCurrencyAmount } from "@/components/formatAmount";

const VendorInvoiceServices = {
  // Standard CRUD operations
  getAllVendorInvoices: async (params = {}) => {
    return requests.get("/vendor-invoices", { params });
  },

  getVendorInvoiceById: async (id) => {
    return requests.get(`/vendor-invoices/${id}`);
  },

  createVendorInvoice: async (body) => {
    return requests.post("/vendor-invoices", body);
  },

  updateVendorInvoice: async (id, body) => {
    return requests.put(`/vendor-invoices/${id}`, body);
  },

  deleteVendorInvoice: async (id) => {
    return requests.delete(`/vendor-invoices/${id}`);
  },

  getSignedTemplateUrl: async (key) => {
    return requests.get("/vendor-invoices/template/signed-url", {
      params: { key },
    });
  },

  cancelPendingPayment: async (id, paymentId) => {
    return requests.patch(`/vendor-invoices/${id}/cancel-pending-payment`, {
      paymentId,
    });
  },

  // Bulk payment operations
  getBulkPaymentInvoices: async (invoiceIds) => {
    return requests.post("/vendor-invoices/bulk/get-payment-invoices", {
      invoiceIds,
    });
  },

  bulkMakeTransaction: async (payload) => {
    return requests.post("/vendor-invoices/bulk/make-transaction", payload);
  },

  bulkApproveTransaction: async (invoiceIds) => {
    return requests.post("/vendor-invoices/bulk/approve-transaction", {
      invoiceIds,
    });
  },

  bulkApprove: async (invoiceIds, status) => {
    return requests.put("/vendor-invoices/bulk/approve", {
      invoiceIds,
      status,
    });
  },

  // Helper functions for bulk operations
  validateBulkPaymentData: (invoices, paymentBankAccount, payments) => {
    const errors = [];

    if (!invoices || invoices.length === 0) {
      errors.push("No invoices selected for payment");
    }

    if (!payments || payments.length === 0) {
      errors.push("Payment amounts are required");
    }

    // Validate each payment
    payments.forEach((payment, index) => {
      if (!payment.amount || payment.amount <= 0) {
        errors.push(`Invalid payment amount for invoice ${index + 1}`);
      }

      const invoice = invoices.find((inv) => inv._id === payment.invoiceId);
      if (invoice && payment.amount > invoice.remainingAmount) {
        errors.push(
          `Payment amount for invoice ${invoice.invoiceNumber} exceeds remaining amount`
        );
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
    };
  },

  prepareBulkPaymentData: (
    selectedInvoices,
    paymentBankAccount,
    paymentAmounts
  ) => {
    const invoiceIds = selectedInvoices.map((inv) => inv._id);
    const payments = selectedInvoices.map((invoice) => ({
      invoiceId: invoice._id,
      amount: paymentAmounts[invoice._id] || invoice.remainingAmount,
      currency: invoice.currency,
    }));

    return {
      invoiceIds,
      paymentBankAccount,
      payments,
    };
  },

  calculateBulkPaymentSummary: (selectedInvoices, paymentAmounts) => {
    const totalInvoices = selectedInvoices.length;
    const totalAmount = selectedInvoices.reduce((sum, invoice) => {
      const paymentAmount =
        paymentAmounts[invoice._id] || invoice.remainingAmount;
      return sum + parseFloat(paymentAmount);
    }, 0);

    const vendors = [...new Set(selectedInvoices.map((inv) => inv.vendor._id))];
    const currencies = [
      ...new Set(selectedInvoices.map((inv) => inv.currency)),
    ];
    const businesses = [
      ...new Set(selectedInvoices.map((inv) => inv.business._id)),
    ];

    return {
      totalInvoices,
      totalAmount,
      uniqueVendors: vendors.length,
      uniqueCurrencies: currencies.length,
      uniqueBusinesses: businesses.length,
      currencies: [...new Set(selectedInvoices.map((inv) => inv.currency))],
      hasMultipleVendors: vendors.length > 1,
      hasMultipleCurrencies: currencies.length > 1,
      hasMultipleBusinesses: businesses.length > 1,
    };
  },

  // Status check helpers for bulk operations
  canInvoiceBeSelected: (invoice) => {
    const selectableStatuses = [
      "Created", // Can be bulk approved
      "Approved by Management", // Can make payment intents
      "Make Transaction", // Can be approved by checker
    ];

    return (
      selectableStatuses.includes(invoice.status) &&
      (invoice.remainingAmount > 0 || invoice.status === "Created")
    );
  },

  // Validate that all invoices belong to the same vendor
  validateSingleVendor: (invoices) => {
    if (!invoices || invoices.length === 0) return true;

    const vendorIds = [
      ...new Set(invoices.map((inv) => inv.vendor?._id).filter(Boolean)),
    ];
    return vendorIds.length <= 1;
  },

  // Get vendor information for selected invoices
  getSelectedVendorInfo: (invoices) => {
    if (!invoices || invoices.length === 0) return null;

    const vendorIds = [
      ...new Set(invoices.map((inv) => inv.vendor?._id).filter(Boolean)),
    ];
    if (vendorIds.length === 0) return null;

    const firstInvoice = invoices.find(
      (inv) => inv.vendor?._id === vendorIds[0]
    );
    return firstInvoice?.vendor || null;
  },

  /** Matches list/table display: company name or vendor display name from basicInformation */
  getVendorDisplayName: (invoice, fallback = "Unknown Vendor") => {
    const bi = invoice?.vendor?.basicInformation;
    const name = bi?.companyName || bi?.vendorDisplayName;
    if (typeof name === "string" && name.trim()) return name.trim();
    return fallback;
  },

  getSelectableInvoices: (invoices) => {
    return invoices.filter((invoice) =>
      VendorInvoiceServices.canInvoiceBeSelected(invoice)
    );
  },

  // Format helpers
  formatCurrency: (amount, currency = "USD") => {
    return formatCurrencyAmount(currency, amount ?? 0);
  },

  formatInvoiceForDisplay: (invoice) => {
    return {
      ...invoice,
      formattedTotal: VendorInvoiceServices.formatCurrency(
        invoice.total,
        invoice.currency
      ),
      formattedRemainingAmount: VendorInvoiceServices.formatCurrency(
        invoice.remainingAmount,
        invoice.currency
      ),
      vendorName: VendorInvoiceServices.getVendorDisplayName(invoice),
      businessName: invoice.business?.name || "Unknown Business",
    };
  },
};

export default VendorInvoiceServices;
