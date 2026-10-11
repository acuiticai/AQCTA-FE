import React, { useState, useEffect, useCallback, useContext } from "react";
import { useHistory } from "react-router-dom";
import axios from "axios";
import {
  X,
  Upload,
  AlertTriangle,
  CheckCircle,
  FileText,
  CreditCard,
  Loader,
  DollarSign,
  Calendar,
  Clock,
  User,
  Building,
  Mail,
  Phone,
  MapPin,
  Globe,
  ChevronRight,
  ChevronLeft,
  Plus,
  Minus,
  Trash2,
  Eye,
  Download,
  Send,
  Users,
  Check,
  AlertCircle,
  Info,
  ArrowRight,
  Building2,
  ArrowRightLeft,
  Calculator,
  Banknote,
  Receipt,
  Wallet,
} from "lucide-react";
import { AdminContext } from "@/context/AdminContext";
import { notifyError, notifySuccess } from "@/utils/toast";
import BankManagementServices from "@/services/BankManagementServices";
import CustomerPaymentHistoryServices from "@/services/CustomerPaymentHistoryServices";
import FinancialService from "@/services/financialService";
import useAsync from "@/hooks/useAsync";
import SearchableDropdown from "@/components/SearchableDropdown";

// Professional UI Components
const Card = ({ children, className = "", hover = false }) => (
  <div
    className={`bg-white rounded-xl shadow-sm border border-gray-200 ${
      hover ? "hover:shadow-md transition-all duration-300" : ""
    } ${className}`}
  >
    {children}
  </div>
);

const CardBody = ({ children, className = "" }) => (
  <div className={`p-6 ${className}`}>{children}</div>
);

const Button = ({
  variant = "primary",
  size = "md",
  onClick,
  disabled,
  children,
  className = "",
  type = "button",
}) => {
  const baseClasses =
    "inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    primary:
      "bg-[var(--p-blue)] hover:bg-[#9CBA33] text-white focus:ring-[var(--p-blue)] shadow-md hover:shadow-lg",
    secondary:
      "bg-gray-200 hover:bg-gray-300 text-gray-700 focus:ring-gray-500",
    success: "bg-green-600 hover:bg-green-700 text-white focus:ring-green-500",
    warning:
      "bg-yellow-600 hover:bg-yellow-700 text-white focus:ring-yellow-500",
    danger: "bg-red-600 hover:bg-red-700 text-white focus:ring-red-500",
    light: "bg-gray-100 hover:bg-gray-200 text-gray-600 focus:ring-gray-400",
    outline:
      "border border-gray-300 hover:border-gray-400 text-gray-700 focus:ring-gray-500",
  };

  const sizes = {
    sm: "px-3 py-2 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
};

const Input = React.memo(
  ({
    type = "text",
    value,
    onChange,
    placeholder,
    className = "",
    disabled = false,
    min,
    max,
    step,
    ...props
  }) => (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      min={min}
      max={max}
      step={step}
      className={`block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-[var(--p-blue)] focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] disabled:bg-gray-100 disabled:cursor-not-allowed ${className}`}
      {...props}
    />
  )
);

const Select = React.memo(
  ({
    value,
    onChange,
    children,
    className = "",
    disabled = false,
    ...props
  }) => (
    <select
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={`block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--p-blue)] focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] disabled:bg-gray-100 disabled:cursor-not-allowed ${className}`}
      {...props}
    >
      {children}
    </select>
  )
);

const Alert = ({ variant = "info", children, className = "" }) => {
  const variants = {
    success: "bg-green-50 border-green-200 text-green-800",
    danger: "bg-red-50 border-red-200 text-red-800",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
    info: "bg-blue-50 border-blue-200 text-blue-800",
  };

  return (
    <div className={`rounded-lg border p-4 ${variants[variant]} ${className}`}>
      {children}
    </div>
  );
};

const Badge = ({ variant = "primary", children, className = "" }) => {
  const variants = {
    primary: "bg-blue-100 text-blue-800",
    success: "bg-green-100 text-green-800",
    warning: "bg-yellow-100 text-yellow-800",
    danger: "bg-red-100 text-red-800",
    secondary: "bg-gray-100 text-gray-800",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
};

// Utility functions
const formatCurrency = (amount, currency = "USD") => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
};

const calculateRemainingAmount = (invoice) => {
  // Use the backend-calculated remaining amount if available
  // This ensures currency conversions are handled correctly
  if (invoice.remaining !== undefined && invoice.remaining !== null) {
    return Math.max(0, invoice.remaining);
  }

  // Fallback calculation if remaining is not available
  const total = invoice.grandTotal || 0;
  const paid =
    invoice.payments?.reduce(
      (sum, payment) => sum + (payment.allocatedAmount || payment.amount || 0),
      0
    ) || 0;
  return Math.max(0, total - paid);
};

const ProfessionalBulkPaymentModal = ({
  isOpen,
  onClose,
  selectedInvoices = [],
  onPaymentComplete,
}) => {
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

  // Bank accounts and currencies
  const [bankAccounts, setBankAccounts] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [loadingBankData, setLoadingBankData] = useState(false);

  // State management
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // ENHANCED: Payment type management (matching single payment modal)
  const [paymentType, setPaymentType] = useState("cash_only"); // cash_only, credit_only, mixed

  const [paymentForm, setPaymentForm] = useState({
    paymentDate: new Date().toISOString().split("T")[0],
    paymentMode: "Bank Transfer",
    depositTo: "",
    currency: "",
    reference: "",
    notes: "",
    emailThankYou: false,
    customerEmail: "",
    attachment: null,
    // ENHANCED: Cash payment fields for mixed/cash payments
    cashAmount: "0",
    cashCurrency: "",
  });

  // Individual invoice payments
  const [invoicePayments, setInvoicePayments] = useState({});

  // Customer credit management
  const [availableCredits, setAvailableCredits] = useState([]);
  const [appliedCredits, setAppliedCredits] = useState({});
  const [customerBalanceSummary, setCustomerBalanceSummary] = useState(null);

  // Processing results
  const [processingResults, setProcessingResults] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);

  // Currency symbols mapping for display
  const getCurrencySymbol = (currencyCode) => {
    const symbols = {
      USD: "$",
      EUR: "€",
      GBP: "£",
      JPY: "¥",
      CNY: "¥",
      INR: "₹",
      AUD: "A$",
      CAD: "C$",
      CHF: "Fr",
      SEK: "kr",
      NOK: "kr",
      DKK: "kr",
      RUB: "₽",
      BRL: "R$",
      ZAR: "R",
      KRW: "₩",
      SGD: "S$",
      AED: "د.إ",
      SAR: "ر.س",
      QAR: "ق.ر",
      KWD: "د.ك",
      BHD: "ب.د",
      OMR: "ر.ع",
      EGP: "ج.م",
      PKR: "₨",
      BDT: "৳",
      LKR: "Rs",
      NPR: "Rs",
      AFN: "؋",
      DEFAULT: "",
    };
    return symbols[currencyCode] || symbols.DEFAULT;
  };

  // Format currency with symbol; never append "undefined" when code is missing
  const formatCurrency = (amount, currencyCode) => {
    const explicit =
      currencyCode != null && String(currencyCode).trim() !== ""
        ? String(currencyCode).trim()
        : null;
    const code =
      explicit ||
      (paymentForm.currency && String(paymentForm.currency).trim()) ||
      (paymentForm.cashCurrency && String(paymentForm.cashCurrency).trim()) ||
      selectedInvoices[0]?.currency ||
      "USD";
    const symbol = getCurrencySymbol(code);
    return `${symbol}${Number(amount ?? 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${code}`;
  };

  // Currency conversion will be handled by the backend using existing API

  // Fetch bank accounts and currencies
  useEffect(() => {
    const fetchBankData = async () => {
      if (!isOpen || !selectedInvoices.length) return;

      setLoadingBankData(true);
      try {
        // Get business ID from first invoice
        const businessId =
          selectedInvoices[0]?.business_id?._id ||
          selectedInvoices[0]?.business_id ||
          selectedInvoices[0]?.business;

        console.log("Fetching bank data for business:", businessId);

        if (businessId) {
          // Fetch bank accounts for this business (using the same approach as CreateVendorInvoice)
          const bankAccountsRes = await axios.get(
            `${Base_URL}/bank-management/accounts`,
            {
              params: { business: businessId },
              headers: {
                authorization: `Bearer ${adminInfo.token}`,
              },
            }
          );
          setBankAccounts(bankAccountsRes.data.accounts || []);

          // Fetch currencies for the business
          const currencyResponse = await axios.get(
            `${Base_URL}/finance/currencies?business_id=${businessId}`,
            {
              headers: {
                authorization: `Bearer ${adminInfo.token}`,
              },
            }
          );
          setCurrencies(currencyResponse.data.data || []);

          console.log(
            "Bank accounts fetched:",
            bankAccountsRes.data.accounts || []
          );
          console.log("Currencies fetched:", currencyResponse.data.data || []);
        } else {
          console.warn("No business ID found in selected invoices");
          setBankAccounts([]);
          setCurrencies([]);
        }
      } catch (error) {
        console.error("Error fetching bank data:", error);
        notifyError("Failed to fetch bank accounts and currencies");
        setBankAccounts([]);
        setCurrencies([]);
      } finally {
        setLoadingBankData(false);
      }
    };

    fetchBankData();
  }, [isOpen, selectedInvoices, adminInfo.token, Base_URL]);

  // ENHANCED: Handle bank selection and set currency (matching single payment modal)
  const handleBankSelection = (bankId) => {
    setValidationErrors([]); // Clear validation errors when user selects a bank
    if (!bankId) {
      const fallbackCurrency = selectedInvoices[0]?.currency || "";
      setPaymentForm((prev) => ({
        ...prev,
        depositTo: "",
        currency: fallbackCurrency || prev.currency,
        cashCurrency: fallbackCurrency || prev.cashCurrency,
      }));
      return;
    }
    const selectedBank = bankAccounts.find((bank) => bank._id === bankId);
    setPaymentForm((prev) => ({
      ...prev,
      depositTo: bankId,
      currency: selectedBank?.currencyType || prev.currency,
      cashCurrency: selectedBank?.currencyType || prev.cashCurrency,
    }));

    // Reset invoice payments when currency changes, but preserve original amounts
    if (
      selectedBank?.currencyType &&
      selectedBank.currencyType !== paymentForm.currency
    ) {
      // Reinitialize payments with original amounts preserved
      const updatedPayments = {};
      selectedInvoices.forEach((invoice) => {
        const remaining = calculateRemainingAmount(invoice);
        updatedPayments[invoice._id] = {
          amount: 0,
          currency: invoice.currency,
          remaining: remaining,
          originalAmount: remaining, // Preserve original amount
          appliedCredits: 0,
          finalAmount: remaining,
        };
      });
      console.log("Bank selection - reinitializing payments:", updatedPayments);
      setInvoicePayments(updatedPayments);
      setAppliedCredits({});
    }
  };

  // ENHANCED: Payment type change handler (matching single payment modal)
  const handlePaymentTypeChange = (newType) => {
    console.log("💰 Payment type changed:", { from: paymentType, to: newType });

    setValidationErrors([]); // Clear validation errors when user switches payment type
    setPaymentType(newType);

    // Reset form based on payment type
    if (newType === "credit_only") {
      setPaymentForm((prev) => ({
        ...prev,
        cashAmount: "0",
        depositTo: "", // Reset bank selection for credit-only
        currency: "", // Will be set based on applied credits
      }));
    } else if (newType === "cash_only") {
      // Clear all applied credits
      setAppliedCredits({});
      // Reset invoice payments to remove credit applications
      const updatedPayments = {};
      selectedInvoices.forEach((invoice) => {
        const remaining = calculateRemainingAmount(invoice);
        updatedPayments[invoice._id] = {
          amount: 0,
          currency: invoice.currency,
          remaining: remaining,
          originalAmount: remaining,
          appliedCredits: 0,
          finalAmount: remaining,
        };
      });
      setInvoicePayments(updatedPayments);
    }
    // For mixed type, keep existing state but allow both cash and credits
  };

  // Check for multiple customers
  const hasMultipleCustomers = () => {
    const customerIds = [
      ...new Set(
        selectedInvoices.map((inv) => inv.customer_id?._id).filter(Boolean)
      ),
    ];
    return customerIds.length > 1;
  };

  // Initialize invoice payments
  useEffect(() => {
    if (selectedInvoices.length > 0) {
      const initialPayments = {};
      selectedInvoices.forEach((invoice) => {
        const remaining = calculateRemainingAmount(invoice);
        initialPayments[invoice._id] = {
          amount: 0, // Start with 0, let user enter amounts
          currency: invoice.currency,
          remaining: remaining,
          originalAmount: remaining,
          appliedCredits: 0,
          finalAmount: remaining,
        };
      });
      console.log("Initializing invoice payments:", initialPayments);
      setInvoicePayments(initialPayments);
      setPaymentForm((prev) => ({
        ...prev,
        currency: prev.currency || selectedInvoices[0]?.currency || "",
        cashCurrency: prev.cashCurrency || selectedInvoices[0]?.currency || "",
      }));
    }
  }, [selectedInvoices]);

  // Ensure payments have required properties when bank selection changes
  useEffect(() => {
    if (paymentForm.depositTo && Object.keys(invoicePayments).length > 0) {
      const updatedPayments = {};
      let needsUpdate = false;

      Object.entries(invoicePayments).forEach(([invoiceId, payment]) => {
        if (!payment.originalAmount || !payment.remaining) {
          const invoice = selectedInvoices.find((inv) => inv._id === invoiceId);
          if (invoice) {
            const remaining = calculateRemainingAmount(invoice);
            updatedPayments[invoiceId] = {
              ...payment,
              remaining: remaining,
              originalAmount: remaining,
              finalAmount:
                remaining -
                (payment.amount || 0) -
                (payment.appliedCredits || 0),
            };
            needsUpdate = true;
          }
        } else {
          updatedPayments[invoiceId] = payment;
        }
      });

      if (needsUpdate) {
        console.log(
          "Updating payments with missing properties:",
          updatedPayments
        );
        setInvoicePayments(updatedPayments);
      }
    }
  }, [paymentForm.depositTo, invoicePayments, selectedInvoices]);

  // Currency conversion function
  const convertCurrency = async (fromCurrency, toCurrency, amount) => {
    if (fromCurrency === toCurrency) {
      return {
        success: true,
        convertedAmount: amount,
        rate: 1,
        originalAmount: amount,
        originalCurrency: fromCurrency,
        targetCurrency: toCurrency,
      };
    }

    try {
      // Get businessId from selected invoices
      const businessId =
        selectedInvoices[0]?.business_id?._id ||
        selectedInvoices[0]?.business_id ||
        selectedInvoices[0]?.business;

      const response = await FinancialService.convertCurrency(
        fromCurrency,
        toCurrency,
        amount,
        businessId
      );
      if (response.success) {
        return {
          success: true,
          convertedAmount: response.convertedAmount,
          rate: response.rate,
          originalAmount: amount,
          originalCurrency: fromCurrency,
          targetCurrency: toCurrency,
        };
      }
    } catch (error) {
      console.warn(`Currency conversion failed: ${error.message}`);
    }

    // Fallback to 1:1 rate if conversion fails
    return {
      success: false,
      convertedAmount: amount,
      rate: 1,
      originalAmount: amount,
      originalCurrency: fromCurrency,
      targetCurrency: toCurrency,
    };
  };

  // Real-time currency conversion state
  const [conversionRates, setConversionRates] = useState({});
  const [conversionSummary, setConversionSummary] = useState({});

  // Calculate comprehensive payment summary
  const calculatePaymentSummary = useCallback(async () => {
    if (!paymentForm.currency || Object.keys(invoicePayments).length === 0) {
      setConversionSummary({});
      return;
    }

    const summary = {
      paymentCurrency: paymentForm.currency,
      totalPaymentAmount: 0,
      invoiceBreakdown: [],
      creditsApplied: 0,
      exchangeRateInfo: [],
    };

    for (const [invoiceId, payment] of Object.entries(invoicePayments)) {
      const invoice = selectedInvoices.find((inv) => inv._id === invoiceId);
      if (!invoice || !payment.amount) continue;

      const invoiceCurrency = invoice.currency;
      const paymentAmount = payment.amount;

      if (invoiceCurrency === paymentForm.currency) {
        // Same currency - no conversion needed
        summary.totalPaymentAmount += paymentAmount;
        summary.invoiceBreakdown.push({
          invoiceId,
          invoiceNumber: invoice.invoiceNumber,
          paymentAmount,
          currency: paymentForm.currency,
          conversionRate: 1,
          originalCurrency: invoiceCurrency,
          isConverted: false,
        });
      } else {
        // Different currency - need conversion
        try {
          const conversion = await convertCurrency(
            paymentForm.currency,
            invoiceCurrency,
            paymentAmount
          );
          if (conversion.success) {
            summary.totalPaymentAmount += paymentAmount;
            summary.invoiceBreakdown.push({
              invoiceId,
              invoiceNumber: invoice.invoiceNumber,
              paymentAmount,
              convertedAmount: conversion.convertedAmount,
              currency: paymentForm.currency,
              conversionRate: conversion.rate,
              originalCurrency: invoiceCurrency,
              isConverted: true,
            });

            // Track unique exchange rates
            const rateInfo = summary.exchangeRateInfo.find(
              (r) => r.from === paymentForm.currency && r.to === invoiceCurrency
            );
            if (!rateInfo) {
              summary.exchangeRateInfo.push({
                from: paymentForm.currency,
                to: invoiceCurrency,
                rate: conversion.rate,
                timestamp: new Date().toISOString(),
              });
            }
          }
        } catch (error) {
          console.error("Conversion failed for invoice", invoiceId, error);
        }
      }
    }

    // Calculate applied credits
    Object.values(appliedCredits).forEach((credit) => {
      if (credit && credit.amount) {
        summary.creditsApplied += credit.amount;
      }
    });

    setConversionSummary(summary);
  }, [
    paymentForm.currency,
    invoicePayments,
    appliedCredits,
    selectedInvoices,
    convertCurrency,
  ]);

  // Update conversion summary when relevant data changes
  useEffect(() => {
    calculatePaymentSummary();
  }, [paymentForm.currency, invoicePayments, appliedCredits, selectedInvoices]);

  // Fetch customer credit information
  const fetchCustomerCredits = useCallback(async () => {
    if (selectedInvoices.length === 0) return;

    const customerId = selectedInvoices[0]?.customer_id?._id;
    const businessId =
      selectedInvoices[0]?.business_id?._id || selectedInvoices[0]?.business;

    if (!customerId || !businessId) return;

    try {
      // Use the service functions for consistency
      const [balanceResponse] = await Promise.all([
        CustomerPaymentHistoryServices.getCustomerBalanceSummary(
          customerId,
          businessId
        ),
      ]);

      console.log("Customer balance summary response:", balanceResponse);
      console.log("Available credits:", balanceResponse.data?.availableCredits);
      console.log("Overpayments:", balanceResponse.data?.overpayments);
      setCustomerBalanceSummary(balanceResponse.data);

      // Get available credits from the balance summary
      const credits =
        balanceResponse.data?.availableCredits ||
        balanceResponse.data?.overpayments ||
        [];

      // Group credits by currency and calculate totals
      const creditsByCurrency = {};
      credits.forEach((credit) => {
        const currency = credit.currency || "USD";
        if (!creditsByCurrency[currency]) {
          creditsByCurrency[currency] = {
            total: 0,
            credits: [],
          };
        }
        const amount = credit.remainingBalance || credit.amount || 0;
        creditsByCurrency[currency].total += amount;
        creditsByCurrency[currency].credits.push(credit);
      });

      // Convert credits to payment currency if needed
      if (paymentForm.currency && Object.keys(creditsByCurrency).length > 0) {
        const convertedCredits = {};

        for (const [currency, creditInfo] of Object.entries(
          creditsByCurrency
        )) {
          if (currency === paymentForm.currency) {
            // Same currency, use as is
            convertedCredits[currency] = {
              total: creditInfo.total,
              credits: creditInfo.credits,
            };
          } else {
            // Different currency, convert total
            try {
              const conversion = await convertCurrency(
                currency,
                paymentForm.currency,
                creditInfo.total
              );
              convertedCredits[currency] = {
                total: creditInfo.total, // Keep original total
                convertedTotal: conversion.convertedAmount,
                conversionRate: conversion.rate,
                credits: creditInfo.credits,
              };
            } catch (error) {
              // Keep original if conversion fails
              convertedCredits[currency] = {
                total: creditInfo.total,
                credits: creditInfo.credits,
              };
            }
          }
        }
        console.log("Setting converted credits:", convertedCredits);
        setAvailableCredits(convertedCredits);
      } else {
        // No currency selected or no credits, just use grouped credits
        console.log("Setting grouped credits:", creditsByCurrency);
        setAvailableCredits(creditsByCurrency);
      }
    } catch (error) {
      console.error("Error fetching customer credits:", error);
    }
  }, [selectedInvoices, adminInfo?.token, paymentForm.currency]);

  useEffect(() => {
    if (isOpen) {
      fetchCustomerCredits();
    }
  }, [isOpen, fetchCustomerCredits]);

  // Handle payment amount change for individual invoices
  const handlePaymentAmountChange = async (invoiceId, amount) => {
    setValidationErrors([]); // Clear validation errors when user enters/changes amount
    const numAmount = parseFloat(amount) || 0;

    setInvoicePayments((prev) => {
      const existingPayment = prev[invoiceId] || {};
      const invoice = selectedInvoices.find((inv) => inv._id === invoiceId);

      // Use originalAmount if it exists, otherwise use the invoice's current remaining amount
      const originalRemaining =
        existingPayment.originalAmount ||
        invoice?.remaining ||
        invoice?.finalAmount ||
        0;

      // Calculate final amount considering currency conversion
      let effectivePaymentAmount = numAmount;

      // If payment currency is different from invoice currency,
      // we need to estimate the converted amount for display using real conversion
      if (
        paymentForm.currency &&
        paymentForm.currency !== invoice?.currency &&
        numAmount > 0
      ) {
        // Use the same conversion service that the backend uses
        convertCurrency(paymentForm.currency, invoice.currency, numAmount)
          .then((conversion) => {
            if (conversion.success) {
              // Update the payment with the actual converted amount
              setInvoicePayments((current) => ({
                ...current,
                [invoiceId]: {
                  ...current[invoiceId],
                  estimatedConvertedAmount: conversion.convertedAmount,
                  conversionRate: conversion.rate,
                  finalAmount:
                    originalRemaining -
                    conversion.convertedAmount -
                    (existingPayment.appliedCredits || 0),
                },
              }));
            }
          })
          .catch((error) => {
            console.warn(
              "Real-time conversion failed, using fallback rate:",
              error
            );
          });

        // For immediate display, use the backend conversion service approach
        effectivePaymentAmount = numAmount; // Keep original for immediate display
      }

      // Calculate final amount based on original remaining amount minus effective payment minus applied credits
      const finalAmount =
        originalRemaining -
        effectivePaymentAmount -
        (existingPayment.appliedCredits || 0);

      return {
        ...prev,
        [invoiceId]: {
          ...existingPayment,
          amount: numAmount,
          originalAmount: originalRemaining, // Preserve the original remaining amount
          remaining: originalRemaining, // Keep this for reference
          finalAmount: finalAmount, // Allow negative values to show overpayment
          estimatedConvertedAmount: effectivePaymentAmount, // Store estimated amount for display
          conversionRate:
            paymentForm.currency === invoice?.currency
              ? 1
              : existingPayment.conversionRate || 1,
        },
      };
    });
  };

  // Apply credits to specific invoice
  const applyCreditToInvoice = (
    invoiceId,
    creditAmount,
    creditCurrency = null
  ) => {
    setValidationErrors([]); // Clear validation errors when user applies credits
    const invoice = selectedInvoices.find((inv) => inv._id === invoiceId);
    if (!invoice) return;

    const currentPayment = invoicePayments[invoiceId];
    if (!currentPayment) return;

    // Always use original amounts for credit calculation to ensure consistency
    const originalRemaining =
      currentPayment.originalAmount || currentPayment.remaining || 0;
    const effectivePaymentAmount = currentPayment.amount || 0;
    const currentAppliedCredits = currentPayment.appliedCredits || 0;

    console.log("applyCreditToInvoice debug:", {
      invoiceId,
      creditAmount,
      creditCurrency,
      originalRemaining,
      effectivePaymentAmount,
      currentAppliedCredits,
      availableForCredits:
        originalRemaining - effectivePaymentAmount - currentAppliedCredits,
    });

    // ENHANCED: Apply credit amount intelligently based on payment type
    // For bulk payments, apply the amount that's available for this invoice

    // First convert credit amount to invoice currency
    let creditAmountInInvoiceCurrency = creditAmount;
    let conversionRate = 1;

    if (creditCurrency && creditCurrency !== invoice.currency) {
      // Use rough rates for client-side estimation
      const roughRates = {
        USD_MYR: 4.7,
        USD_EUR: 0.85,
        EUR_USD: 1.18,
        EUR_MYR: 5.5,
        MYR_USD: 0.21,
        MYR_EUR: 0.18,
        PKR_USD: 0.0035,
        USD_PKR: 283.58,
        EUR_PKR: 310.5,
        PKR_EUR: 0.0032,
      };

      const rateKey = `${creditCurrency}_${invoice.currency}`;
      conversionRate = roughRates[rateKey] || 1;
      creditAmountInInvoiceCurrency = creditAmount * conversionRate;
    }

    // Calculate available amount for credits on this invoice
    const availableForCredits = Math.max(
      0,
      originalRemaining - effectivePaymentAmount - currentAppliedCredits
    );

    // For bulk payments, limit to available amount for this specific invoice
    // This prevents overapplication when multiple invoices are being processed
    const maxCreditInInvoiceCurrency = Math.min(
      creditAmountInInvoiceCurrency,
      availableForCredits
    );
    const maxCreditInOriginalCurrency =
      maxCreditInInvoiceCurrency / conversionRate;

    console.log("Bulk payment credit calculation debug:", {
      creditAmount,
      creditCurrency,
      invoiceCurrency: invoice.currency,
      conversionRate,
      creditAmountInInvoiceCurrency,
      availableForCredits,
      maxCreditInInvoiceCurrency,
      maxCreditInOriginalCurrency,
    });

    // Check if we have any credit to apply
    if (maxCreditInInvoiceCurrency <= 0) {
      console.log("No credit available to apply:", {
        requestedCredit: creditAmount,
        convertedCredit: creditAmountInInvoiceCurrency,
        availableForCredits: availableForCredits,
        maxCreditInInvoiceCurrency: maxCreditInInvoiceCurrency,
      });
      // Show user feedback
      alert(
        `Cannot apply credit: Invoice has no remaining balance for credits (Available: ${availableForCredits.toFixed(
          2
        )} ${invoice.currency})`
      );
      return;
    }

    if (maxCreditInInvoiceCurrency > 0) {
      // Convert credit amount to invoice currency if different
      let convertedCreditAmount = maxCreditInInvoiceCurrency;

      if (creditCurrency && creditCurrency !== invoice.currency) {
        // Use real-time conversion for credit application
        try {
          convertCurrency(
            creditCurrency,
            invoice.currency,
            maxCreditInOriginalCurrency
          )
            .then((conversion) => {
              if (conversion.success) {
                // Update the credit application with real-time rates
                console.log(
                  "Real-time credit conversion successful:",
                  conversion
                );
              }
            })
            .catch((error) => {
              console.warn("Real-time credit conversion failed:", error);
            });

          // For immediate calculation, use fallback rates
          const roughRates = {
            USD_MYR: 4.7,
            USD_EUR: 0.85,
            USD_PKR: 283.58, // Added PKR conversion rates
            EUR_USD: 1.18,
            EUR_MYR: 5.5,
            EUR_PKR: 335.0, // Added PKR conversion rates
            MYR_USD: 0.21,
            MYR_EUR: 0.18,
            MYR_PKR: 60.0, // Added PKR conversion rates
            PKR_USD: 0.0035, // Added reverse PKR rates
            PKR_EUR: 0.003,
            PKR_MYR: 0.017,
          };
          const rateKey = `${creditCurrency}_${invoice.currency}`;
          conversionRate = roughRates[rateKey] || 1;
          convertedCreditAmount = maxCreditInOriginalCurrency * conversionRate;
        } catch (error) {
          console.warn("Credit currency conversion failed:", error);
          // Use fallback rate
          conversionRate = 1;
          convertedCreditAmount = maxCreditInOriginalCurrency;
        }
      }

      console.log("Credit conversion:", {
        originalCredit: maxCreditInOriginalCurrency,
        convertedCredit: convertedCreditAmount,
        conversionRate,
        creditCurrency,
        invoiceCurrency: invoice.currency,
      });

      // Update applied credits with currency information and conversion details
      const newAppliedCredit = {
        ...appliedCredits[invoiceId],
        amount:
          (appliedCredits[invoiceId]?.amount || 0) + convertedCreditAmount,
        originalAmount:
          (appliedCredits[invoiceId]?.originalAmount || 0) +
          maxCreditInOriginalCurrency,
        currency: creditCurrency || invoice.currency,
        invoiceCurrency: invoice.currency,
        conversionRate: conversionRate,
        appliedAt: new Date().toISOString(),
      };

      console.log("Setting new applied credit:", newAppliedCredit);

      // Batch all state updates together using React 18's automatic batching
      const updatedAppliedCreditsAmount =
        currentAppliedCredits + convertedCreditAmount;

      // Populate the payment amount field with the FULL credit amount
      // Convert credit amount to the expected payment currency (usually the bank currency)
      let creditAmountInPaymentCurrency = maxCreditInOriginalCurrency;

      // If there's a selected bank account, convert to its currency
      if (
        paymentForm.depositTo &&
        paymentForm.currency &&
        creditCurrency !== paymentForm.currency
      ) {
        // Use rough conversion rates for immediate display
        const roughRates = {
          USD_MYR: 4.7,
          USD_EUR: 0.85,
          USD_PKR: 283.58, // Added PKR conversion rates
          EUR_USD: 1.18,
          EUR_MYR: 5.5,
          EUR_PKR: 335.0, // Added PKR conversion rates
          MYR_USD: 0.21,
          MYR_EUR: 0.18,
          MYR_PKR: 60.0, // Added PKR conversion rates
          PKR_USD: 0.0035, // Added reverse PKR rates
          PKR_EUR: 0.003,
          PKR_MYR: 0.017,
        };

        const rateKey = `${creditCurrency}_${paymentForm.currency}`;
        const paymentConversionRate = roughRates[rateKey] || 1;
        creditAmountInPaymentCurrency =
          maxCreditInOriginalCurrency * paymentConversionRate;
      }

      const newInvoicePayment = {
        ...currentPayment,
        amount: creditAmountInPaymentCurrency, // Set payment amount in the form's expected currency
        appliedCredits: convertedCreditAmount, // Track applied credits in invoice currency
        finalAmount: originalRemaining - convertedCreditAmount, // Calculate remaining after credit application
        isFromCredit: true, // Flag to indicate this is from credit application
      };

      // Update all states in sequence to ensure proper rendering
      setAppliedCredits((prev) => {
        const updated = {
          ...prev,
          [invoiceId]: newAppliedCredit,
        };
        console.log("Updated appliedCredits state:", updated);
        return updated;
      });

      setInvoicePayments((prev) => {
        const updated = {
          ...prev,
          [invoiceId]: newInvoicePayment,
        };
        console.log("Updated invoicePayments state:", updated);
        return updated;
      });

      // Update available credits (reduce the applied amount)
      if (creditCurrency && availableCredits[creditCurrency]) {
        setAvailableCredits((prev) => {
          const updated = {
            ...prev,
            [creditCurrency]: {
              ...prev[creditCurrency],
              total: Math.max(
                0,
                prev[creditCurrency].total - maxCreditInOriginalCurrency
              ),
              credits: prev[creditCurrency].credits,
            },
          };
          console.log("Updated availableCredits state:", updated);
          return updated;
        });
      }

      console.log("Credit applied successfully:", {
        invoiceId,
        appliedAmount: convertedCreditAmount,
        finalAmount:
          originalRemaining -
          effectivePaymentAmount -
          (currentAppliedCredits + convertedCreditAmount),
      });

      // Force a re-render by updating the state
      console.log("Updated appliedCredits state:", {
        [invoiceId]: {
          amount:
            (appliedCredits[invoiceId]?.amount || 0) + convertedCreditAmount,
          originalAmount:
            (appliedCredits[invoiceId]?.originalAmount || 0) +
            maxCreditInOriginalCurrency,
          currency: creditCurrency || invoice.currency,
          invoiceCurrency: invoice.currency,
          conversionRate: conversionRate,
          appliedAt: new Date().toISOString(),
        },
      });
    } else {
      console.log(
        "Credit not applied - maxCreditInInvoiceCurrency is 0 or negative"
      );
    }
  };

  // Remove credits from specific invoice
  const removeCreditFromInvoice = (invoiceId) => {
    setValidationErrors([]); // Clear validation errors when user removes credits
    const currentCredit = appliedCredits[invoiceId];
    if (!currentCredit || currentCredit.amount <= 0) return;

    console.log("Removing credit from invoice:", {
      invoiceId,
      currentCredit,
      availableCredits: JSON.stringify(availableCredits),
    });

    // ENHANCED: Handle multi-currency credit removal correctly
    // Restore available credits to original currency (not converted amount)
    if (currentCredit.currency) {
      const originalAmount =
        currentCredit.originalAmount || currentCredit.amount;

      console.log("Restoring credit amount:", {
        currency: currentCredit.currency,
        originalAmount,
        currentTotal: availableCredits[currentCredit.currency]?.total || 0,
      });

      // Ensure we're restoring to the correct currency bucket without mixing currencies
      setAvailableCredits((prev) => {
        const newAvailableCredits = { ...prev };

        // FIXED: Create currency entry if it doesn't exist (for removed currencies)
        if (!newAvailableCredits[currentCredit.currency]) {
          newAvailableCredits[currentCredit.currency] = {
            total: 0,
            credits: [],
          };
        }

        // Restore only to the original currency
        newAvailableCredits[currentCredit.currency] = {
          ...newAvailableCredits[currentCredit.currency],
          total:
            newAvailableCredits[currentCredit.currency].total + originalAmount,
          credits: newAvailableCredits[currentCredit.currency].credits, // Preserve credits array
        };

        console.log(
          "Updated available credits after restoration:",
          newAvailableCredits
        );
        return newAvailableCredits;
      });
    }

    // Remove applied credits completely
    setAppliedCredits((prev) => {
      const newAppliedCredits = { ...prev };
      delete newAppliedCredits[invoiceId]; // Completely remove instead of setting to empty object
      console.log("Updated applied credits after removal:", newAppliedCredits);
      return newAppliedCredits;
    });

    // Recalculate final amount without applied credits
    setInvoicePayments((prev) => ({
      ...prev,
      [invoiceId]: {
        ...prev[invoiceId],
        appliedCredits: 0,
        finalAmount:
          (prev[invoiceId].originalAmount || prev[invoiceId].remaining || 0) -
          (prev[invoiceId].amount || 0),
      },
    }));

    console.log("Credit removal completed successfully");
  };

  // Calculate totals (all in payment currency)
  const calculateTotals = () => {
    // Calculate total payment amount in payment currency
    const totalPayment = Object.values(invoicePayments).reduce(
      (sum, payment) => sum + (payment.amount || 0),
      0
    );

    // Calculate total credits applied (convert to payment currency if needed)
    const totalCredits = Object.values(appliedCredits).reduce((sum, credit) => {
      if (!credit || !(credit.originalAmount || credit.amount)) return sum;

      // FIXED: Use originalAmount (credit in its original currency) not amount (converted amount)
      let creditAmount = credit.originalAmount || credit.amount;

      // If credit currency is different from payment currency, convert
      if (
        credit.currency &&
        paymentForm.currency &&
        credit.currency !== paymentForm.currency
      ) {
        // Try to use real-time conversion for totals calculation
        if (conversionRates[`${credit.currency}_${paymentForm.currency}`]) {
          creditAmount =
            credit.amount *
            conversionRates[`${credit.currency}_${paymentForm.currency}`];
        } else {
          // Fallback to rough rates
          const roughRates = {
            MYR_USD: 0.21,
            MYR_EUR: 0.18,
            MYR_PKR: 60.0, // Added PKR conversion rates
            EUR_USD: 1.18,
            EUR_MYR: 5.5,
            EUR_PKR: 335.0, // Added PKR conversion rates
            USD_MYR: 4.7,
            USD_EUR: 0.85,
            USD_PKR: 283.58, // Added PKR conversion rates
            PKR_USD: 0.0035, // Added reverse PKR rates
            PKR_EUR: 0.003,
            PKR_MYR: 0.017,
          };

          const rateKey = `${credit.currency}_${paymentForm.currency}`;
          const estimatedRate = roughRates[rateKey] || 1;
          creditAmount = credit.amount * estimatedRate;
        }
      }

      return sum + creditAmount;
    }, 0);

    // Calculate total remaining in payment currency (using estimated conversions)
    const totalRemaining = Object.entries(invoicePayments).reduce(
      (sum, [invoiceId, payment]) => {
        const invoice = selectedInvoices.find((inv) => inv._id === invoiceId);
        if (!invoice) return sum;

        let remainingInPaymentCurrency = payment.finalAmount || 0;

        // If currencies are different, convert remaining to payment currency
        if (paymentForm.currency && paymentForm.currency !== invoice.currency) {
          // Try to use stored conversion rate first
          const rateKey = `${invoice.currency}_${paymentForm.currency}`;
          if (conversionRates[rateKey]) {
            remainingInPaymentCurrency =
              (payment.finalAmount || 0) * conversionRates[rateKey];
          } else {
            // Fallback to rough rates
            const roughRates = {
              MYR_USD: 0.21,
              MYR_EUR: 0.18,
              MYR_PKR: 60.0, // Added PKR conversion rates
              EUR_USD: 1.18,
              EUR_MYR: 5.5,
              EUR_PKR: 335.0, // Added PKR conversion rates
              USD_MYR: 4.7,
              USD_EUR: 0.85,
              USD_PKR: 283.58, // Added PKR conversion rates
              PKR_USD: 0.0035, // Added reverse PKR rates
              PKR_EUR: 0.003,
              PKR_MYR: 0.017,
            };
            const estimatedRate = roughRates[rateKey] || 1;
            remainingInPaymentCurrency =
              (payment.finalAmount || 0) * estimatedRate;
          }
        }

        return sum + remainingInPaymentCurrency;
      },
      0
    );

    return {
      totalPayment,
      totalCredits,
      totalRemaining: Math.max(0, totalRemaining), // Don't show negative totals
      grandTotal: totalPayment + totalCredits,
    };
  };

  // ENHANCED: Validation with payment type support (matching single payment modal)
  const validatePayments = () => {
    const errors = [];
    const warnings = [];

    // Basic form validation
    if (!paymentForm.paymentMode) {
      errors.push("Please select a payment mode");
    }

    if (!paymentForm.paymentDate) {
      errors.push("Please select a payment date");
    } else {
      const paymentDate = new Date(paymentForm.paymentDate);
      const today = new Date();
      const futureLimit = new Date();
      futureLimit.setDate(today.getDate() + 30);

      if (paymentDate > futureLimit) {
        warnings.push("Payment date is more than 30 days in the future");
      }

      const pastLimit = new Date();
      pastLimit.setFullYear(today.getFullYear() - 1);

      if (paymentDate < pastLimit) {
        errors.push("Payment date cannot be more than 1 year in the past");
      }
    }

    // ENHANCED: Payment type specific validation
    if (paymentType === "cash_only") {
      const totalPayment = Object.values(invoicePayments).reduce(
        (sum, payment) => sum + (payment.amount || 0),
        0
      );

      if (totalPayment <= 0) {
        errors.push(
          "At least one invoice must have a payment amount greater than 0"
        );
      }
    } else if (paymentType === "credit_only") {
      const totalCreditsApplied = Object.values(appliedCredits).reduce(
        (sum, credit) => sum + (credit.amount || 0),
        0
      );

      if (totalCreditsApplied <= 0) {
        errors.push("At least one invoice must have credits applied");
      }
    } else if (paymentType === "mixed") {
      const totalPayment = Object.values(invoicePayments).reduce(
        (sum, payment) => sum + (payment.amount || 0),
        0
      );
      const totalCreditsApplied = Object.values(appliedCredits).reduce(
        (sum, credit) => sum + (credit.amount || 0),
        0
      );

      if (totalPayment <= 0 && totalCreditsApplied <= 0) {
        errors.push(
          "Mixed payment requires either cash payment or credits (or both)"
        );
      }
    }

    // Individual invoice validation
    let hasFullyPaidInvoice = false;
    let hasPartialPayment = false;
    let totalCreditsUsed = 0;

    Object.entries(invoicePayments).forEach(([invoiceId, payment]) => {
      const invoice = selectedInvoices.find((inv) => inv._id === invoiceId);
      const appliedCredit = appliedCredits[invoiceId] || {
        amount: 0,
        currency: null,
      };
      const totalApplied = payment.amount + (appliedCredit.amount || 0);

      if (payment.amount < 0) {
        errors.push(
          `Payment amount for ${invoice?.invoice_number} cannot be negative`
        );
      }

      // Track payment patterns for warnings
      if (payment.finalAmount <= 0.01) {
        hasFullyPaidInvoice = true;
      } else if (payment.amount > 0) {
        hasPartialPayment = true;
      }

      totalCreditsUsed += appliedCredit;
    });

    // Cross-validation checks
    if (hasPartialPayment && !hasFullyPaidInvoice) {
      warnings.push(
        "All invoices have partial payments. Consider fully paying at least one invoice."
      );
    }

    // Currency validation - backend will handle conversion automatically
    const currencies = [
      ...new Set(selectedInvoices.map((inv) => inv.currency)),
    ];
    if (currencies.length > 1) {
      warnings.push(
        `Multiple currencies detected (${currencies.join(
          ", "
        )}). Exchange rates will be applied automatically by the system.`
      );
    }

    // Reference validation
    if (paymentForm.reference && paymentForm.reference.length > 100) {
      errors.push("Payment reference cannot exceed 100 characters");
    }

    // Notes validation
    if (paymentForm.notes && paymentForm.notes.length > 500) {
      errors.push("Payment notes cannot exceed 500 characters");
    }

    // Bank account validation
    if (paymentForm.depositTo && bankAccounts.length > 0) {
      const selectedAccount = bankAccounts.find(
        (acc) => acc._id === paymentForm.depositTo
      );
      if (!selectedAccount) {
        errors.push("Selected bank account is not valid");
      } else if (selectedAccount.status === "inactive") {
        errors.push("Selected bank account is inactive");
      }
    }

    setValidationErrors([...errors, ...warnings.map((w) => `⚠️ ${w}`)]);
    return errors.length === 0;
  };

  // ENHANCED: Process payments with payment type support (matching single payment modal)
  const processPayments = async () => {
    if (!validatePayments()) return;

    setLoading(true);
    setCurrentStep(3);

    try {
      const paymentData = {
        // ENHANCED: Include payment type in the data
        paymentType: paymentType,
        invoices: selectedInvoices.map((invoice) => {
          const payment = invoicePayments[invoice._id];
          const appliedCredit = appliedCredits[invoice._id] || {
            amount: 0,
            currency: null,
          };

          return {
            invoiceId: invoice._id,
            invoiceNumber: invoice.invoice_number,
            currency: invoice.currency, // Invoice currency
            totalAmount: invoice.grandTotal,
            remainingAmount: payment.remaining,
            paymentAmount: payment.amount, // Payment amount in payment currency
            paymentCurrency:
              paymentForm.currency ||
              paymentForm.cashCurrency ||
              invoice.currency,
            originalPaymentAmount: payment.amount, // Explicit: amount entered by user in payment currency
            convertedPaymentAmount:
              payment.estimatedConvertedAmount || payment.amount, // Estimated converted amount to invoice currency
            appliedCreditAmount: appliedCredit.amount || 0,
            appliedCreditCurrency: appliedCredit.currency || invoice.currency,
            finalRemainingAmount: payment.finalAmount,
            // ENHANCED: Include applied credits array for backend processing
            appliedCredits: (() => {
              console.log(
                `DEBUG - Applied credits for invoice ${invoice._id}:`,
                appliedCredit
              );
              if (
                appliedCredit &&
                (appliedCredit.originalAmount > 0 || appliedCredit.amount > 0)
              ) {
                const creditsArray = [
                  {
                    creditId: `bulk_credit_${invoice._id}_${Date.now()}`,
                    originalAmount:
                      appliedCredit.originalAmount || appliedCredit.amount,
                    originalCurrency:
                      appliedCredit.currency || invoice.currency,
                    convertedAmount:
                      appliedCredit.amount || appliedCredit.originalAmount,
                    targetCurrency: invoice.currency,
                    conversionDetails:
                      appliedCredit.conversionRate &&
                      appliedCredit.conversionRate !== 1
                        ? {
                            originalAmount:
                              appliedCredit.originalAmount ||
                              appliedCredit.amount,
                            originalCurrency:
                              appliedCredit.currency || invoice.currency,
                            convertedAmount:
                              appliedCredit.amount ||
                              appliedCredit.originalAmount,
                            targetCurrency: invoice.currency,
                            conversionRate: appliedCredit.conversionRate,
                            conversionDate: new Date().toISOString(),
                          }
                        : null,
                    appliedAt:
                      appliedCredit.appliedAt || new Date().toISOString(),
                    applicationOrder: 1,
                  },
                ];
                console.log(
                  `DEBUG - Sending appliedCredits array:`,
                  creditsArray
                );
                return creditsArray;
              }
              console.log(
                `DEBUG - No applied credits for invoice ${invoice._id}`
              );
              return [];
            })(),
          };
        }),
        paymentDetails: {
          ...paymentForm,
          depositTo: paymentForm.depositTo || null,
          // ENHANCED: Payment type specific fields
          paymentType: paymentType,
          cashAmount: paymentForm.cashAmount || "0",
          totalPaymentAmount: calculateTotals().totalPayment,
          totalCreditsApplied: calculateTotals().totalCredits,
          // Enhanced tracking information for production consistency
          sessionId: `bulk_${paymentType}_${Date.now()}_${Math.random()
            .toString(36)
            .substr(2, 9)}`,
          currencyConversionSnapshot: conversionSummary,
          exchangeRateInfo: conversionSummary.exchangeRateInfo || [],
          processingTimestamp: new Date().toISOString(),
          paymentCurrency:
            paymentForm.currency ||
            paymentForm.cashCurrency ||
            selectedInvoices[0]?.currency,
          isMultiCurrencyPayment: selectedInvoices.some(
            (inv) =>
              inv.currency !==
              (paymentForm.currency || paymentForm.cashCurrency)
          ),
        },
        customerInfo: {
          customerId: selectedInvoices[0]?.customer_id?._id,
          businessId:
            selectedInvoices[0]?.business_id?._id ||
            selectedInvoices[0]?.business,
        },
      };

      const response = await axios.post(
        `${Base_URL}/proforma-invoice/professional-bulk-payment`,
        paymentData,
        { headers: { authorization: `Bearer ${adminInfo?.token}` } }
      );

      if (response.data.success) {
        setProcessingResults(response.data.data);
        setCurrentStep(4);
        notifySuccess("Bulk payment processed successfully!");

        // CRITICAL: Refresh available credits after successful payment
        // This ensures consumed credits are removed from the available credits display
        try {
          await fetchCustomerCredits();
          console.log("Available credits refreshed after payment completion");
        } catch (refreshError) {
          console.warn(
            "Failed to refresh credits after payment:",
            refreshError
          );
        }

        if (onPaymentComplete) {
          onPaymentComplete();
        }
      } else {
        throw new Error(response.data.message || "Payment processing failed");
      }
    } catch (error) {
      console.error("Payment processing error:", error);
      notifyError(
        error.response?.data?.message || "Failed to process payments"
      );
      setCurrentStep(2);
    } finally {
      setLoading(false);
    }
  };

  // ENHANCED: Reset form with payment type support
  const resetForm = () => {
    setCurrentStep(1);
    setPaymentType("cash_only"); // Reset to default payment type
    setInvoicePayments({});
    setAppliedCredits({});
    setPaymentForm({
      paymentDate: new Date().toISOString().split("T")[0],
      paymentMode: "Bank Transfer",
      depositTo: "",
      currency: "",
      reference: "",
      notes: "",
      emailThankYou: false,
      customerEmail: "",
      attachment: null,
      cashAmount: "0",
      cashCurrency: "",
    });
    setProcessingResults(null);
    setValidationErrors([]);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Step indicator
  const steps = [
    { step: 1, title: "Review Invoices", icon: FileText },
    { step: 2, title: "Payment Details", icon: CreditCard },
    { step: 3, title: "Processing", icon: Loader },
    { step: 4, title: "Results", icon: CheckCircle },
  ];

  const renderStepIndicator = () => (
    <div className="mb-8">
      <div className="flex justify-between items-center relative">
        <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-200 z-10" />
        <div
          className="absolute top-4 left-4 h-0.5 bg-[var(--p-blue)] z-20 transition-all duration-300"
          style={{
            width: `${((currentStep - 1) / (steps.length - 1)) * 100}%`,
          }}
        />

        {steps.map(({ step, title, icon: Icon }) => (
          <div key={step} className="text-center relative z-30">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 shadow-sm border-2 transition-all duration-300 ${
                currentStep >= step
                  ? "bg-[var(--p-blue)] text-white border-[var(--p-blue)]"
                  : "bg-white text-gray-400 border-gray-200"
              }`}
            >
              {currentStep > step ? (
                <Check size={18} />
              ) : currentStep === step && step === 3 ? (
                <Icon size={18} className="animate-spin" />
              ) : (
                <Icon size={18} />
              )}
            </div>
            <div
              className={`text-xs font-medium ${
                currentStep >= step ? "text-[var(--p-blue)]" : "text-gray-500"
              }`}
            >
              {title}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Render review step
  const renderReviewStep = () => (
    <div>
      <div className="flex items-center mb-6">
        <FileText className="text-[var(--p-blue)] mr-3" size={24} />
        <h4 className="text-xl font-semibold text-[var(--p-blue)] mb-0">
          Review Selected Invoices
        </h4>
      </div>

      {hasMultipleCustomers() && (
        <Alert variant="danger" className="mb-6">
          <div className="flex items-center">
            <AlertTriangle className="mr-3" size={20} />
            <div>
              <strong>Multiple Customers Detected:</strong>
              <br />
              <span className="text-sm">
                Bulk payment operations can only be performed on invoices from
                the same customer.
              </span>
            </div>
          </div>
        </Alert>
      )}

      {/* Customer Information */}
      {selectedInvoices.length > 0 && (
        <Card className="mb-6">
          <CardBody>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg mr-3">
                  <Users className="text-blue-600" size={20} />
                </div>
                <div>
                  <h6 className="font-semibold text-blue-900">
                    Customer Information
                  </h6>
                  <p className="text-sm text-blue-700">
                    {selectedInvoices[0]?.customer_id?.basicInformation
                      ?.companyName ||
                      selectedInvoices[0]?.customer_name ||
                      "Unknown Customer"}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-blue-900">
                  Total Invoices
                </div>
                <div className="text-lg font-bold text-blue-800">
                  {selectedInvoices.length}
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Invoice List */}
      <div className="space-y-4">
        {selectedInvoices.map((invoice) => {
          const remaining = calculateRemainingAmount(invoice);
          return (
            <Card
              key={invoice._id}
              className="border-l-4 border-l-[var(--p-blue)]"
            >
              <CardBody>
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                  <div>
                    <h6 className="font-bold text-gray-900">
                      {invoice.invoice_number}
                    </h6>
                    <p className="text-sm text-gray-600">
                      {invoice.customer_name}
                    </p>
                    <Badge variant="secondary">{invoice.status}</Badge>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Amount</p>
                    <p className="font-semibold">
                      {formatCurrency(invoice.grandTotal, invoice.currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Remaining</p>
                    <p className="font-semibold text-yellow-600">
                      {formatCurrency(remaining, invoice.currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Due Date</p>
                    <p className="text-sm">
                      {new Date(invoice.due_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );

  // Render payment details step
  const renderPaymentDetailsStep = () => (
    <div>
      <div className="flex items-center mb-6">
        <CreditCard className="text-[var(--p-blue)] mr-3" size={24} />
        <h4 className="text-xl font-semibold text-[var(--p-blue)] mb-0">
          Enter Payment Details
        </h4>
      </div>

      {/* ENHANCED: Payment Type Selection (matching single payment modal) */}
      <Card className="mb-6">
        <CardBody>
          <h6 className="text-lg font-semibold text-gray-900 mb-4">
            Payment Type Selection
          </h6>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Cash Only Payment */}
            <div
              onClick={() => handlePaymentTypeChange("cash_only")}
              className={`cursor-pointer p-4 rounded-lg border-2 transition-all duration-200 ${
                paymentType === "cash_only"
                  ? "border-[var(--p-blue)] bg-[var(--p-blue)]/10"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center space-x-3">
                <div
                  className={`p-2 rounded-lg ${
                    paymentType === "cash_only"
                      ? "bg-[var(--p-blue)]"
                      : "bg-gray-100"
                  }`}
                >
                  <CreditCard
                    size={20}
                    className={
                      paymentType === "cash_only"
                        ? "text-white"
                        : "text-gray-600"
                    }
                  />
                </div>
                <div>
                  <h6 className="font-semibold text-gray-900">Cash Payment</h6>
                  <p className="text-sm text-gray-600">Bank transfer or cash</p>
                </div>
              </div>
            </div>

            {/* Credit Only Payment */}
            <div
              onClick={() => handlePaymentTypeChange("credit_only")}
              className={`cursor-pointer p-4 rounded-lg border-2 transition-all duration-200 ${
                paymentType === "credit_only"
                  ? "border-green-500 bg-green-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center space-x-3">
                <div
                  className={`p-2 rounded-lg ${
                    paymentType === "credit_only"
                      ? "bg-green-500"
                      : "bg-gray-100"
                  }`}
                >
                  <Wallet
                    size={20}
                    className={
                      paymentType === "credit_only"
                        ? "text-white"
                        : "text-gray-600"
                    }
                  />
                </div>
                <div>
                  <h6 className="font-semibold text-gray-900">
                    Apply Credits Only
                  </h6>
                  <p className="text-sm text-gray-600">Use existing credits</p>
                </div>
              </div>
            </div>

            {/* Mixed Payment */}
            <div
              onClick={() => handlePaymentTypeChange("mixed")}
              className={`cursor-pointer p-4 rounded-lg border-2 transition-all duration-200 ${
                paymentType === "mixed"
                  ? "border-purple-500 bg-purple-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center space-x-3">
                <div
                  className={`p-2 rounded-lg ${
                    paymentType === "mixed" ? "bg-purple-500" : "bg-gray-100"
                  }`}
                >
                  <ArrowRightLeft
                    size={20}
                    className={
                      paymentType === "mixed" ? "text-white" : "text-gray-600"
                    }
                  />
                </div>
                <div>
                  <h6 className="font-semibold text-gray-900">Mixed Payment</h6>
                  <p className="text-sm text-gray-600">Credits + cash</p>
                </div>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Payment Form */}
      <Card className="mb-6">
        <CardBody>
          <h6 className="text-lg font-semibold text-gray-900 mb-4">
            Payment Information
          </h6>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Date *
              </label>
              <Input
                type="date"
                value={paymentForm.paymentDate}
                onChange={(e) => {
                  setValidationErrors([]);
                  setPaymentForm((prev) => ({
                    ...prev,
                    paymentDate: e.target.value,
                  }));
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Mode *
              </label>
              <Select
                value={paymentForm.paymentMode}
                onChange={(e) => {
                  setValidationErrors([]);
                  setPaymentForm((prev) => ({
                    ...prev,
                    paymentMode: e.target.value,
                  }));
                }}
              >
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cash">Cash</option>
                <option value="Check">Check</option>
                <option value="Online">Online Payment</option>
                <option value="Wire Transfer">Wire Transfer</option>
                <option value="Credit Card">Credit Card</option>
              </Select>
            </div>

            {/* ENHANCED: Conditional bank account selection based on payment type */}
            {(paymentType === "cash_only" || paymentType === "mixed") && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Deposit To Bank Account (Optional)
                </label>
                <SearchableDropdown
                  value={paymentForm.depositTo}
                  onChange={(e) => handleBankSelection(e.target.value)}
                  placeholder={
                    loadingBankData
                      ? "Loading bank accounts..."
                      : "Select Bank Account"
                  }
                  searchPlaceholder="Search bank accounts..."
                  disabled={loadingBankData}
                  loading={loadingBankData}
                  loadingText="Loading bank accounts..."
                  options={
                    bankAccounts.map((account) => ({
                      value: account._id,
                      label: `${account.accountName} (${account.bankName}) - ${account.currencyType}`,
                      accountName: account.accountName,
                      bankName: account.bankName,
                      currencyType: account.currencyType,
                      accountNumber: account.accountNumber,
                    })) || []
                  }
                  searchKeys={["accountName", "bankName", "accountNumber"]}
                  renderOption={(option) => (
                    <div>
                      <div className="font-medium">{option.accountName}</div>
                      <div className="text-xs text-gray-500">
                        {option.bankName} - {option.currencyType}
                      </div>
                      {option.accountNumber && (
                        <div className="text-xs text-gray-400">
                          {option.accountNumber}
                        </div>
                      )}
                    </div>
                  )}
                />
                {paymentForm.depositTo && paymentForm.currency && (
                  <div className="mt-1 text-xs text-green-600">
                    Payment currency: {paymentForm.currency}
                  </div>
                )}
              </div>
            )}

            {/* Show currency info for credit-only payments */}
            {paymentType === "credit_only" &&
              Object.keys(availableCredits).length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Currency
                  </label>
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-700">
                      Will be determined by applied credits currencies
                    </p>
                    <div className="text-xs text-green-600 mt-1">
                      Available: {Object.keys(availableCredits).join(", ")}
                    </div>
                  </div>
                </div>
              )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reference Number
              </label>
              <Input
                value={paymentForm.reference}
                onChange={(e) =>
                  setPaymentForm((prev) => ({
                    ...prev,
                    reference: e.target.value,
                  }))
                }
                placeholder="Payment reference or transaction ID"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <textarea
                value={paymentForm.notes}
                onChange={(e) =>
                  setPaymentForm((prev) => ({ ...prev, notes: e.target.value }))
                }
                placeholder="Additional notes about this payment..."
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-[var(--p-blue)] focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)]"
                rows={3}
              />
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Available Credits Summary */}
      {Object.keys(availableCredits).length > 0 && (
        <Card className="mb-6 bg-green-50 border-green-200">
          <CardBody>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg mr-3">
                  <Wallet className="text-green-600" size={20} />
                </div>
                <div>
                  <h6 className="font-semibold text-green-900">
                    Available Credits Summary
                  </h6>
                  <p className="text-sm text-green-700">
                    Total credits available for application
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {Object.entries(availableCredits).map(
                ([currency, creditInfo]) => {
                  if (!creditInfo?.total || creditInfo.total <= 0) return null;

                  // Convert to payment currency for display
                  let convertedAmount = creditInfo.total;
                  let conversionInfo = null;

                  if (
                    paymentForm.currency &&
                    paymentForm.currency !== currency
                  ) {
                    const roughRates = {
                      MYR_USD: 0.21,
                      MYR_EUR: 0.18,
                      MYR_PKR: 60.0, // Added PKR conversion rates
                      EUR_USD: 1.18,
                      EUR_MYR: 5.5,
                      EUR_PKR: 335.0, // Added PKR conversion rates
                      USD_MYR: 4.7,
                      USD_EUR: 0.85,
                      USD_PKR: 283.58, // Added PKR conversion rates
                      PKR_USD: 0.0035, // Added reverse PKR rates
                      PKR_EUR: 0.003,
                      PKR_MYR: 0.017,
                    };

                    const rateKey = `${currency}_${paymentForm.currency}`;
                    const estimatedRate = roughRates[rateKey] || 1;
                    convertedAmount = creditInfo.total * estimatedRate;
                    conversionInfo = {
                      original: creditInfo.total,
                      originalCurrency: currency,
                      converted: convertedAmount,
                      convertedCurrency: paymentForm.currency,
                      rate: estimatedRate,
                    };
                  }

                  return (
                    <div
                      key={currency}
                      className="bg-white p-3 rounded-lg border border-green-200"
                    >
                      <div className="text-lg font-bold text-green-800">
                        {formatCurrency(creditInfo.total, currency)}
                      </div>
                      <div className="text-sm text-green-600 mb-2">
                        {currency}
                      </div>
                      {conversionInfo && (
                        <div className="text-xs text-blue-600 border-t pt-2">
                          <div>
                            ≈{" "}
                            {formatCurrency(
                              conversionInfo.converted,
                              paymentForm.currency
                            )}
                          </div>
                          <div className="text-gray-500">
                            Rate: {conversionInfo.rate}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }
              )}
            </div>

            {/* Total in Payment Currency */}
            {paymentForm.currency && (
              <div className="bg-white p-3 rounded-lg border border-green-300">
                <div className="text-center">
                  <div className="text-sm text-green-700 mb-1">
                    Total Available Credits
                  </div>
                  <div className="text-xl font-bold text-green-800">
                    {(() => {
                      let totalInPaymentCurrency = 0;
                      Object.entries(availableCredits).forEach(
                        ([currency, creditInfo]) => {
                          if (creditInfo?.total && creditInfo.total > 0) {
                            if (currency === paymentForm.currency) {
                              totalInPaymentCurrency += creditInfo.total;
                            } else {
                              const roughRates = {
                                MYR_USD: 0.21,
                                MYR_EUR: 0.18,
                                MYR_PKR: 60.0, // Added PKR conversion rates
                                EUR_USD: 1.18,
                                EUR_MYR: 5.5,
                                EUR_PKR: 335.0, // Added PKR conversion rates
                                USD_MYR: 4.7,
                                USD_EUR: 0.85,
                                USD_PKR: 283.58, // Added PKR conversion rates
                                PKR_USD: 0.0035, // Added reverse PKR rates
                                PKR_EUR: 0.003,
                                PKR_MYR: 0.017,
                              };
                              const rateKey = `${currency}_${paymentForm.currency}`;
                              const estimatedRate = roughRates[rateKey] || 1;
                              totalInPaymentCurrency +=
                                creditInfo.total * estimatedRate;
                            }
                          }
                        }
                      );
                      return formatCurrency(
                        totalInPaymentCurrency,
                        paymentForm.currency
                      );
                    })()}
                  </div>
                  <div className="text-xs text-green-600">
                    in {paymentForm.currency}
                  </div>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Individual Invoice Payments */}
      <Card className="mb-6">
        <CardBody>
          <h6 className="text-lg font-semibold text-gray-900 mb-4">
            Individual Invoice Payments
          </h6>

          <div className="space-y-4">
            {selectedInvoices.map((invoice) => {
              const payment = invoicePayments[invoice._id] || {};
              const appliedCredit = appliedCredits[invoice._id] || {
                amount: 0,
                currency: null,
              };
              const availableCreditForCurrency =
                availableCredits[invoice.currency]?.total || 0;

              return (
                <div
                  key={invoice._id}
                  className="p-4 border border-gray-200 rounded-lg bg-gray-50"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-6 gap-4 items-center">
                    <div className="lg:col-span-2">
                      <h6 className="font-semibold text-gray-900">
                        {invoice.invoice_number}
                      </h6>
                      <p className="text-sm text-gray-600">
                        {invoice.customer_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        Total:{" "}
                        {formatCurrency(invoice.grandTotal, invoice.currency)}
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Remaining
                      </label>
                      <p className="text-sm font-semibold text-yellow-600">
                        {formatCurrency(
                          payment.remaining || 0,
                          invoice.currency
                        )}
                      </p>
                    </div>

                    {/* ENHANCED: Conditional payment amount input based on payment type */}
                    {(paymentType === "cash_only" ||
                      paymentType === "mixed") && (
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Cash Payment Amount (
                          {paymentForm.currency ||
                            invoice.currency ||
                            "USD"}
                          ){" "}
                          {paymentType === "mixed" ? "(Optional)" : "*"}
                        </label>
                        <Input
                          type="number"
                          value={payment.amount || ""}
                          onChange={(e) =>
                            handlePaymentAmountChange(
                              invoice._id,
                              e.target.value
                            )
                          }
                          placeholder={`0.00 ${paymentForm.currency || ""}`}
                          min="0"
                          step="0.01"
                          className="text-sm"
                        />
                        {paymentForm.currency &&
                          paymentForm.currency !== invoice.currency &&
                          payment.amount > 0 && (
                            <div className="mt-1 p-2 bg-blue-50 rounded text-xs">
                              <div className="flex items-center gap-1 text-blue-700">
                                <ArrowRightLeft size={12} />
                                <span className="font-medium">
                                  Currency Conversion:
                                </span>
                              </div>
                              <div className="text-blue-600">
                                {formatCurrency(
                                  payment.amount,
                                  paymentForm.currency
                                )}{" "}
                                →{" "}
                                {formatCurrency(
                                  payment.estimatedConvertedAmount ||
                                    payment.amount,
                                  invoice.currency
                                )}
                                {payment.conversionRate &&
                                  payment.conversionRate !== 1 && (
                                    <span className="ml-2 text-gray-500">
                                      @ {payment.conversionRate.toFixed(4)}
                                    </span>
                                  )}
                              </div>
                              <div className="text-xs text-blue-500 mt-1">
                                {payment.conversionRate &&
                                payment.conversionRate !== 1
                                  ? ""
                                  : "Estimated conversion (exact rate during processing)"}
                              </div>
                            </div>
                          )}
                      </div>
                    )}

                    {/* ENHANCED: Conditional credit application based on payment type */}
                    {(paymentType === "credit_only" ||
                      paymentType === "mixed") && (
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Credit Application
                        </label>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-green-600">
                              Applied:{" "}
                              {appliedCredit?.amount > 0 ? (
                                <>
                                  {/* ENHANCED: Show original credit currency (like single payment modal) */}
                                  {formatCurrency(
                                    appliedCredit.originalAmount ||
                                      appliedCredit.amount,
                                    appliedCredit.currency || invoice.currency
                                  )}
                                  {appliedCredit.conversionRate &&
                                    appliedCredit.conversionRate !== 1 && (
                                      <span className="text-xs text-blue-600 ml-1">
                                        {" "}
                                        (converted to{" "}
                                        {formatCurrency(
                                          appliedCredit.amount,
                                          appliedCredit.invoiceCurrency ||
                                            invoice.currency
                                        )}
                                        )
                                      </span>
                                    )}
                                </>
                              ) : (
                                "No credits applied"
                              )}
                            </p>
                            {appliedCredit?.amount > 0 && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  removeCreditFromInvoice(invoice._id)
                                }
                                className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                                title="Remove applied credit"
                              >
                                <Minus size={12} />
                                Remove
                              </Button>
                            )}
                          </div>

                          {/* Available Credits by Currency */}
                          {Object.entries(availableCredits).map(
                            ([currency, creditInfo]) => {
                              if (!creditInfo?.total || creditInfo.total <= 0)
                                return null;

                              return (
                                <div
                                  key={currency}
                                  className="bg-green-50 p-2 rounded text-xs"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-green-700 font-medium">
                                      Available:{" "}
                                      {formatCurrency(
                                        creditInfo.total,
                                        currency
                                      )}
                                    </span>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        console.log(
                                          "🔘 Apply Credit Button Clicked:",
                                          {
                                            invoiceId: invoice._id,
                                            currency: currency,
                                            creditAmount: creditInfo.total,
                                            paymentType: paymentType,
                                          }
                                        );

                                        // Always use the original invoice remaining amount for credit calculation
                                        // This ensures credits work regardless of bank selection
                                        const originalRemaining =
                                          payment.originalAmount ||
                                          payment.remaining ||
                                          0;
                                        const currentAppliedCredits =
                                          payment.appliedCredits || 0;
                                        const availableForCredits = Math.max(
                                          0,
                                          originalRemaining -
                                            (payment.amount || 0) -
                                            currentAppliedCredits
                                        );

                                        console.log(
                                          "Credit application debug:",
                                          {
                                            originalRemaining,
                                            paymentAmount: payment.amount || 0,
                                            currentAppliedCredits,
                                            availableForCredits,
                                            creditTotal: creditInfo.total,
                                          }
                                        );

                                        const maxApplicable = Math.min(
                                          creditInfo.total,
                                          availableForCredits
                                        );
                                        if (maxApplicable > 0) {
                                          applyCreditToInvoice(
                                            invoice._id,
                                            maxApplicable,
                                            currency
                                          );
                                        } else {
                                          console.log(
                                            "Credit not applicable:",
                                            {
                                              maxApplicable,
                                              availableForCredits,
                                            }
                                          );
                                        }
                                      }}
                                      className="text-xs text-green-600 hover:text-green-700"
                                      disabled={
                                        creditInfo.total <= 0 ||
                                        (!payment.originalAmount &&
                                          !payment.remaining)
                                      }
                                    >
                                      <Plus size={12} />
                                      Apply
                                    </Button>
                                  </div>
                                  {currency !== invoice.currency && (
                                    <div className="text-green-600 text-xs mt-1">
                                      <ArrowRightLeft
                                        size={10}
                                        className="inline mr-1"
                                      />
                                      Will convert to {invoice.currency}
                                    </div>
                                  )}
                                </div>
                              );
                            }
                          )}

                          {Object.keys(availableCredits).length === 0 && (
                            <p className="text-xs text-gray-500 italic">
                              No available credits
                            </p>
                          )}

                          {/* Quick Apply All Credits Button */}
                          {Object.keys(availableCredits).length > 0 && (
                            <div className="mt-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  console.log(
                                    "🎯 Apply All Credits Button Clicked:",
                                    {
                                      invoiceId: invoice._id,
                                      paymentType: paymentType,
                                      availableCredits:
                                        Object.keys(availableCredits),
                                    }
                                  );

                                  // Apply all available credits up to the remaining amount
                                  // Always use original amounts to ensure consistency regardless of bank selection
                                  let totalApplicable = 0;
                                  let creditsToApply = [];

                                  const originalRemaining =
                                    payment.originalAmount ||
                                    payment.remaining ||
                                    0;
                                  const currentAppliedCredits =
                                    payment.appliedCredits || 0;
                                  const availableForCredits = Math.max(
                                    0,
                                    originalRemaining -
                                      (payment.amount || 0) -
                                      currentAppliedCredits
                                  );

                                  console.log("Apply all credits debug:", {
                                    originalRemaining,
                                    paymentAmount: payment.amount || 0,
                                    currentAppliedCredits,
                                    availableForCredits,
                                  });

                                  // Calculate total applicable credits and prepare application data
                                  Object.entries(availableCredits).forEach(
                                    ([currency, creditInfo]) => {
                                      if (
                                        creditInfo?.total &&
                                        creditInfo.total > 0
                                      ) {
                                        const maxForThisCurrency = Math.min(
                                          creditInfo.total,
                                          availableForCredits
                                        );
                                        if (maxForThisCurrency > 0) {
                                          totalApplicable += maxForThisCurrency;
                                          creditsToApply.push({
                                            currency,
                                            amount: maxForThisCurrency,
                                            originalTotal: creditInfo.total,
                                          });
                                        }
                                      }
                                    }
                                  );

                                  console.log(
                                    "Credits to apply:",
                                    creditsToApply
                                  );

                                  // Apply credits for each currency
                                  creditsToApply.forEach((creditData) => {
                                    applyCreditToInvoice(
                                      invoice._id,
                                      creditData.amount,
                                      creditData.currency
                                    );
                                  });
                                }}
                                className="text-xs w-full bg-green-600 text-white hover:bg-green-700"
                                disabled={
                                  !payment.originalAmount && !payment.remaining
                                }
                              >
                                Apply All Available Credits
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Final Remaining
                      </label>
                      <p
                        className={`text-sm font-semibold ${
                          (payment.finalAmount || 0) === 0
                            ? "text-green-600"
                            : (payment.finalAmount || 0) < 0
                            ? "text-blue-600"
                            : "text-yellow-600"
                        }`}
                      >
                        {formatCurrency(
                          Math.abs(payment.finalAmount || 0),
                          invoice.currency
                        )}
                      </p>
                      {(payment.finalAmount || 0) === 0 && (
                        <Badge variant="success" className="text-xs">
                          Fully Paid
                        </Badge>
                      )}
                      {(payment.finalAmount || 0) < 0 && (
                        <Badge variant="info" className="text-xs">
                          Overpaid
                        </Badge>
                      )}
                      {(payment.finalAmount || 0) > 0 && (
                        <Badge variant="warning" className="text-xs">
                          Remaining
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>

      {/* Payment Summary */}
      <Card className="mb-6">
        <CardBody>
          <h6 className="text-lg font-semibold text-gray-900 mb-4">
            Payment Summary
          </h6>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {/* ENHANCED: Conditional total payment display based on payment type */}
            {(paymentType === "cash_only" || paymentType === "mixed") && (
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Banknote size={16} className="text-blue-600" />
                  <span className="text-sm font-medium text-blue-700">
                    {paymentType === "mixed" ? "Cash Payment" : "Total Payment"}
                  </span>
                </div>
                <p className="text-xl font-bold text-blue-900">
                  {formatCurrency(
                    calculateTotals().totalPayment,
                    paymentForm.currency || paymentForm.cashCurrency
                  )}
                </p>
                {paymentForm.currency && (
                  <p className="text-xs text-blue-600 mt-1">
                    in {paymentForm.currency}
                  </p>
                )}
              </div>
            )}

            {/* ENHANCED: Conditional credits display based on payment type */}
            {(paymentType === "credit_only" || paymentType === "mixed") && (
              <div className="p-4 bg-green-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Wallet size={16} className="text-green-600" />
                  <span className="text-sm font-medium text-green-700">
                    Credits Applied
                  </span>
                </div>
                <p className="text-xl font-bold text-green-900">
                  {formatCurrency(
                    calculateTotals().totalCredits,
                    paymentForm.currency || paymentForm.cashCurrency
                  )}
                </p>
              </div>
            )}

            <div className="p-4 bg-yellow-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Clock size={16} className="text-yellow-600" />
                <span className="text-sm font-medium text-yellow-700">
                  Remaining
                </span>
              </div>
              <p className="text-xl font-bold text-yellow-900">
                {formatCurrency(
                  calculateTotals().totalRemaining,
                  paymentForm.currency || paymentForm.cashCurrency
                )}
              </p>
            </div>
          </div>

          {/* Currency Conversion Details */}
          {paymentForm.currency &&
            conversionSummary.exchangeRateInfo?.length > 0 && (
              <div className="mb-6">
                <h6 className="text-md font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <ArrowRightLeft size={16} className="text-orange-600" />
                  Currency Conversion Details
                </h6>
                <div className="space-y-3">
                  {conversionSummary.exchangeRateInfo.map((rateInfo, index) => (
                    <div
                      key={index}
                      className="p-3 bg-orange-50 rounded-lg border border-orange-200"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-orange-700">
                            {rateInfo.from} → {rateInfo.to}
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            Rate: {rateInfo.rate}
                          </Badge>
                        </div>
                        <div className="text-xs text-orange-600">Live Rate</div>
                      </div>
                      <div className="text-xs text-orange-600 mt-2">
                        Exchange rates will be locked in during payment
                        processing
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Invoice Breakdown by Currency */}
          {paymentForm.currency &&
            conversionSummary.invoiceBreakdown?.length > 0 && (
              <div>
                <h6 className="text-md font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Receipt size={16} className="text-indigo-600" />
                  Payment Breakdown by Invoice
                </h6>
                <div className="space-y-2">
                  {conversionSummary.invoiceBreakdown.map((breakdown) => (
                    <div
                      key={breakdown.invoiceId}
                      className="p-3 bg-indigo-50 rounded-lg border border-indigo-200"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-indigo-700">
                            {breakdown.invoiceNumber}
                          </span>
                          <span className="text-sm text-indigo-600 ml-2">
                            (
                            {formatCurrency(
                              breakdown.paymentAmount,
                              breakdown.currency
                            )}
                            )
                          </span>
                        </div>
                        <div className="text-right">
                          {breakdown.isConverted ? (
                            <div>
                              <div className="text-sm text-indigo-700 font-medium">
                                {formatCurrency(
                                  breakdown.convertedAmount,
                                  breakdown.originalCurrency
                                )}
                              </div>
                              <div className="text-xs text-indigo-500">
                                @ rate {breakdown.conversionRate}
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm text-indigo-700 font-medium">
                              Same Currency
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
        </CardBody>
      </Card>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <Alert variant="danger" className="mb-6">
          <div className="flex items-start">
            <AlertTriangle size={20} className="mr-3 mt-0.5" />
            <div>
              <strong>Please fix the following issues:</strong>
              <ul className="mt-2 space-y-1">
                {validationErrors.map((error, index) => (
                  <li key={index} className="text-sm">
                    {error}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Alert>
      )}
    </div>
  );

  // Render processing step
  const renderProcessingStep = () => (
    <div className="text-center py-12">
      <div className="mb-6">
        <Loader
          className="animate-spin text-[var(--p-blue)] mx-auto"
          size={48}
        />
      </div>
      <h4 className="text-xl font-semibold text-[var(--p-blue)] mb-4">
        Processing Payments
      </h4>
      <p className="text-gray-600 mb-8">
        Please wait while we process the payments for selected invoices...
      </p>
    </div>
  );

  // Render results step
  const renderResultsStep = () => (
    <div>
      <div className="flex items-center mb-6">
        <CheckCircle className="text-[var(--p-blue)] mr-3" size={24} />
        <h4 className="text-xl font-semibold text-[var(--p-blue)] mb-0">
          Payment Processing Complete
        </h4>
      </div>

      {processingResults && (
        <Alert variant="success" className="mb-6">
          <div className="flex items-center">
            <CheckCircle size={24} className="mr-4" />
            <div>
              <h5 className="text-lg font-semibold mb-2">
                Payments Processed Successfully!
              </h5>
              <p>
                Total amount processed:{" "}
                {formatCurrency(processingResults.totalProcessed)}
              </p>
              <p>
                {processingResults.successfulInvoices} of{" "}
                {selectedInvoices.length} invoices updated.
              </p>
            </div>
          </div>
        </Alert>
      )}
    </div>
  );

  // Render current step
  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return renderReviewStep();
      case 2:
        return renderPaymentDetailsStep();
      case 3:
        return renderProcessingStep();
      case 4:
        return renderResultsStep();
      default:
        return renderReviewStep();
    }
  };

  // Render footer buttons
  const renderFooterButtons = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="flex justify-between w-full">
            <Button variant="light" onClick={handleClose}>
              <X size={16} className="mr-2" />
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => setCurrentStep(2)}
              disabled={hasMultipleCustomers()}
            >
              Continue to Payment Details
              <ArrowRight size={16} className="ml-2" />
            </Button>
          </div>
        );
      case 2:
        return (
          <div className="flex justify-between w-full">
            <Button variant="light" onClick={() => setCurrentStep(1)}>
              <ArrowRight size={16} className="mr-2 rotate-180" />
              Back
            </Button>
            <Button
              variant="success"
              onClick={processPayments}
              disabled={loading || validationErrors.length > 0}
            >
              <Receipt size={16} className="mr-2" />
              Process Payments
            </Button>
          </div>
        );
      case 3:
        return null;
      case 4:
        return (
          <div className="w-full text-center">
            <Button variant="primary" size="lg" onClick={handleClose}>
              <CheckCircle size={16} className="mr-2" />
              Close
            </Button>
          </div>
        );
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleClose}
      />

      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-6xl bg-white rounded-2xl shadow-2xl">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-2 bg-[var(--p-blue)]/10 rounded-lg mr-3">
                  <Receipt size={20} className="text-[var(--p-blue)]" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Professional Bulk Payment
                  </h2>
                  <p className="text-sm text-gray-600">
                    Process payments for {selectedInvoices.length} selected
                    invoices
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="px-3 py-1 bg-[var(--p-blue)]/10 text-[var(--p-blue)] rounded-full text-sm font-medium">
                  {selectedInvoices.length} Invoices
                </div>
                <button
                  onClick={handleClose}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-6 bg-gray-50/50 min-h-96 max-h-[80vh] overflow-y-auto">
            {renderStepIndicator()}
            {renderCurrentStep()}
          </div>

          {/* Footer */}
          {currentStep !== 3 && (
            <div className="px-6 py-4 bg-white rounded-b-2xl border-t border-gray-200">
              {renderFooterButtons()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfessionalBulkPaymentModal;
