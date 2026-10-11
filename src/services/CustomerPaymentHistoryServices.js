import axios from "axios";
import FinancialService from "./financialService";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

// Get auth token from localStorage
const getAuthToken = () => {
  return localStorage.getItem("token") || localStorage.getItem("adminToken");
};

// Create axios instance with auth headers
const createAuthAxios = () => {
  const token = getAuthToken();
  return axios.create({
    baseURL: Base_URL,
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
      "Content-Type": "application/json",
    },
  });
};

class CustomerPaymentHistoryServices {
  // Get customer payment history
  static async getCustomerPaymentHistory(customerId, businessId) {
    try {
      console.log("getCustomerPaymentHistory", customerId, businessId);
      const authAxios = createAuthAxios();
      console.log("authAxios getCustomerPaymentHistory", authAxios);
      console.log(
        `route is: ${Base_URL}/customer-payment-history/customer/${customerId}/business/${businessId}/history`
      );
      const response = await authAxios.get(
        `/customer-payment-history/customer/${customerId}/business/${businessId}/history`
      );
      console.log("response getCustomerPaymentHistory", response);
      return response.data;
    } catch (error) {
      console.error("Error fetching customer payment history:", error);
      throw error;
    }
  }

  // Get customer balance summary
  static async getCustomerBalanceSummary(customerId, businessId) {
    try {
      const authAxios = createAuthAxios();
      const response = await authAxios.get(
        `/customer-payment-history/customer/${customerId}/business/${businessId}/balance`
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching customer balance summary:", error);
      throw error;
    }
  }

  // Get customer credit balance
  static async getCustomerCreditBalance(
    customerId,
    businessId,
    currency = null
  ) {
    try {
      const authAxios = createAuthAxios();
      const params = new URLSearchParams({
        customerId,
        businessId,
      });

      if (currency) {
        params.append("currency", currency);
      }

      const response = await authAxios.get(
        `/customer-payment-history/customer/credit-balance?${params}`
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching customer credit balance:", error);
      throw error;
    }
  }

  // Get available credits for a customer
  static async getAvailableCredits(customerId, businessId, currency = null) {
    try {
      const authAxios = createAuthAxios();
      const params = new URLSearchParams({
        customerId,
        businessId,
      });

      if (currency) {
        params.append("currency", currency);
      }

      const response = await authAxios.get(
        `/customer-payment-history/customer/available-credits?${params}`
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching available credits:", error);
      throw error;
    }
  }

  // Create payment history record
  static async createPaymentHistory(paymentData) {
    try {
      const authAxios = createAuthAxios();
      const response = await authAxios.post(
        `/customer-payment-history/payment-history`,
        paymentData
      );
      return response.data;
    } catch (error) {
      console.error("Error creating payment history:", error);
      throw error;
    }
  }

  // Apply customer credit to invoices
  static async applyCustomerCredit(creditData) {
    try {
      const authAxios = createAuthAxios();
      const response = await authAxios.post(
        `/customer-payment-history/apply-credit`,
        creditData
      );
      return response.data;
    } catch (error) {
      console.error("Error applying customer credit:", error);
      throw error;
    }
  }

  // Apply credits to multiple invoices
  static async applyCreditsToInvoices(
    customerId,
    businessId,
    creditApplications
  ) {
    try {
      const creditData = {
        customerId,
        businessId,
        invoiceIds: creditApplications.map((app) => app.invoiceId),
        amounts: creditApplications.map((app) => app.amount),
        currencies: creditApplications.map((app) => app.currency),
        paymentDate: new Date(),
        reference: "Customer Credit Applied",
        notes: "Applied from customer overpayment credits",
      };

      const authAxios = createAuthAxios();
      const response = await authAxios.post(
        `/customer-payment-history/apply-credit`,
        creditData
      );
      return response.data;
    } catch (error) {
      console.error("Error applying credits to invoices:", error);
      throw error;
    }
  }

  // Calculate available credit in specific currency
  static async calculateAvailableCreditInCurrency(
    customerId,
    businessId,
    targetCurrency
  ) {
    try {
      const availableCreditsResponse = await this.getAvailableCredits(
        customerId,
        businessId
      );

      if (!availableCreditsResponse.success) {
        return 0;
      }

      const creditsByCurrency = availableCreditsResponse.data.creditsByCurrency;
      let totalAvailable = 0;

      // Convert all credits to target currency
      for (const [currency, creditData] of Object.entries(creditsByCurrency)) {
        if (currency === targetCurrency) {
          totalAvailable += creditData.total;
        } else {
          // Convert to target currency using FinancialService
          try {
            const conversionResult = await FinancialService.convertCurrency(
              currency,
              targetCurrency,
              creditData.total
            );
            if (conversionResult.success) {
              totalAvailable += conversionResult.convertedAmount;
            }
          } catch (conversionError) {
            console.warn(
              `Failed to convert ${currency} to ${targetCurrency}:`,
              conversionError
            );
          }
        }
      }

      return totalAvailable;
    } catch (error) {
      console.error("Error calculating available credit in currency:", error);
      return 0;
    }
  }

  // Calculate payment allocation with customer history
  static calculatePaymentAllocationWithHistory(
    paymentAmount,
    selectedInvoices,
    customerHistory,
    paymentCurrency
  ) {
    const allocation = {
      invoices: {},
      totalAllocated: 0,
      remainingPayment: paymentAmount,
      customerCredit: 0,
      overpayment: 0,
      underpayment: 0,
    };

    // Sort invoices by due date (oldest first)
    const sortedInvoices = [...selectedInvoices].sort(
      (a, b) => new Date(a.due_date) - new Date(b.due_date)
    );

    // First, apply any existing customer credit
    if (customerHistory && customerHistory.creditBalance > 0) {
      const creditToApply = Math.min(
        customerHistory.creditBalance,
        paymentAmount
      );
      allocation.customerCredit = creditToApply;
      allocation.remainingPayment -= creditToApply;
    }

    // Allocate remaining payment to invoices
    sortedInvoices.forEach((invoice) => {
      const remainingAmount = this.calculateRemainingAmount(invoice);

      if (remainingAmount > 0 && allocation.remainingPayment > 0) {
        const amountToAllocate = Math.min(
          remainingAmount,
          allocation.remainingPayment
        );

        allocation.invoices[invoice._id] = {
          invoiceNumber: invoice.invoice_number,
          originalRemaining: remainingAmount,
          allocatedAmount: amountToAllocate,
          remainingAfterPayment: remainingAmount - amountToAllocate,
          currency: invoice.currency,
          isFullyPaid: amountToAllocate >= remainingAmount,
          isPartiallyPaid:
            amountToAllocate > 0 && amountToAllocate < remainingAmount,
        };

        allocation.totalAllocated += amountToAllocate;
        allocation.remainingPayment -= amountToAllocate;
      } else {
        allocation.invoices[invoice._id] = {
          invoiceNumber: invoice.invoice_number,
          originalRemaining: remainingAmount,
          allocatedAmount: 0,
          remainingAfterPayment: remainingAmount,
          currency: invoice.currency,
          isFullyPaid: false,
          isPartiallyPaid: false,
        };
      }
    });

    // Calculate overpayment/underpayment
    if (allocation.remainingPayment > 0) {
      allocation.overpayment = allocation.remainingPayment;
    } else if (allocation.remainingPayment < 0) {
      allocation.underpayment = Math.abs(allocation.remainingPayment);
    }

    return allocation;
  }

  // Calculate remaining amount for an invoice
  static calculateRemainingAmount(invoice) {
    if (!invoice) return 0;

    // If invoice has remaining_amount field, use it
    if (invoice.remaining_amount !== undefined) {
      return parseFloat(invoice.remaining_amount) || 0;
    }

    // Otherwise calculate from total_amount and payments
    const totalAmount = parseFloat(invoice.total_amount) || 0;
    const payments = invoice.payments || [];
    const totalPaid = payments.reduce(
      (sum, payment) => sum + (parseFloat(payment.amount) || 0),
      0
    );

    return Math.max(0, totalAmount - totalPaid);
  }

  // Format currency for display
  static formatCurrency(amount, currency) {
    if (!amount || !currency) return "0.00";

    const formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    return formatter.format(amount);
  }

  // Get payment type based on amounts
  static getPaymentType(paymentAmount, totalDue) {
    const difference = Math.abs(paymentAmount - totalDue);

    // Use tolerance for exact payment detection to handle rounding differences
    if (difference < 0.01) {
      return "exact_payment";
    } else if (paymentAmount > totalDue) {
      return "overpayment";
    } else {
      return "underpayment";
    }
  }

  // Check if customer has available credits
  static hasAvailableCredits(customerBalanceSummary) {
    if (!customerBalanceSummary || !customerBalanceSummary.data) {
      return false;
    }

    const { availableCredits, overpayments } = customerBalanceSummary.data;

    // Check available credits array
    if (availableCredits && availableCredits.length > 0) {
      return availableCredits.some((credit) => credit.amount > 0);
    }

    // Check overpayments array (fallback)
    if (overpayments && overpayments.length > 0) {
      return overpayments.some((overpayment) => overpayment.amount > 0);
    }

    return false;
  }

  // Get total available credit amount
  static getTotalAvailableCredit(
    customerBalanceSummary,
    targetCurrency = null
  ) {
    if (!customerBalanceSummary || !customerBalanceSummary.data) {
      return 0;
    }

    const { availableCredits, overpayments } = customerBalanceSummary.data;
    let total = 0;

    // Use available credits if available
    if (availableCredits && availableCredits.length > 0) {
      availableCredits.forEach((credit) => {
        if (!targetCurrency || credit.currency === targetCurrency) {
          total += credit.amount || 0;
        }
      });
    } else if (overpayments && overpayments.length > 0) {
      // Fallback to overpayments
      overpayments.forEach((overpayment) => {
        if (!targetCurrency || overpayment.currency === targetCurrency) {
          total += overpayment.amount || 0;
        }
      });
    }

    return total;
  }
}

export default CustomerPaymentHistoryServices;
