import { useTranslation } from "react-i18next";
import { customerInvoiceText as ciText } from "@/utils/customerInvoiceI18n";
import React, { useState, useEffect, useCallback, useContext } from "react";
import { formatCurrencyAmount } from "@/components/formatAmount";
import DropdownBasic from "@/components/DropdownBasic";
import CustomDatePicker from "@/components/CustomDatePicker";
import InputField from "../reusablecomponents/InputField";
import SearchableDropdown from "@/components/SearchableDropdown";
import axios from "axios";
import BankManagementServices from "@/services/BankManagementServices";
import CustomerPaymentHistoryServices from "@/services/CustomerPaymentHistoryServices";
import useAsync from "@/hooks/useAsync";
import FinancialService from "@/services/financialService";
import { AdminContext } from "@/context/AdminContext";
import {
  CheckCircle,
  AlertTriangle,
  Info,
  DollarSign,
  ArrowRightLeft,
  X,
  CreditCard,
  Building,
  Calendar,
  FileText,
  Wallet,
  Plus,
  Minus,
  ArrowRight,
  Receipt,
} from "lucide-react";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

// Professional UI Components matching CreateVendorInvoice style
const Card = ({ children, className = "", hover = false }) => (
  <div
    className={`bg-white rounded-lg border border-gray-200 shadow-sm ${
      hover ? "hover:shadow-md transition-all duration-300" : ""
    } ${className}`}
  >
    {children}
  </div>
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
    danger: "bg-red-600 hover:bg-red-700 text-white focus:ring-red-500",
    outline:
      "border border-gray-300 hover:border-gray-400 text-gray-700 focus:ring-gray-500 bg-white hover:bg-gray-50",
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
      className={`block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm placeholder-gray-400 focus:border-[var(--p-blue)] focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] disabled:bg-gray-100 disabled:cursor-not-allowed ${className}`}
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
      className={`block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-[var(--p-blue)] focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] disabled:bg-gray-100 disabled:cursor-not-allowed ${className}`}
      {...props}
    >
      {children}
    </select>
  )
);

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
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
};

const PaymentModal = ({ isOpen, onClose, onSubmit, invoice, businessId }) => {
  useTranslation();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  console.log("businessId", businessId);

  // Bank accounts and currencies (fetched based on business)
  const [bankAccounts, setBankAccounts] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [loadingBankData, setLoadingBankData] = useState(false);

  const [form, setForm] = useState({
    paymentDate: new Date().toISOString().split("T")[0],
    paymentMode: "Bank Transfer",
    depositTo: "",
    amount: "",
    currency: "",
    reference: "",
    bankCharges: "",
    taxDeducted: false,
    tdsType: "",
    notes: "",
    attachment: null,
    emailThankYou: true,
    email: invoice?.customer_id?.basicInformation?.customerEmail || "",
  });
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState({});
  const [successMsg, setSuccessMsg] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Customer payment history state
  const [customerBalanceSummary, setCustomerBalanceSummary] = useState(null);
  const [customerPaymentHistory, setCustomerPaymentHistory] = useState(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [paymentType, setPaymentType] = useState("exact"); // exact, overpayment, underpayment
  const [paymentSummary, setPaymentSummary] = useState(null);
  const [applyOverpayment, setApplyOverpayment] = useState(false);
  const [overpaymentAmount, setOverpaymentAmount] = useState(0);

  // Available credits management (similar to bulk payment modal)
  const [availableCredits, setAvailableCredits] = useState({});
  const [appliedCredit, setAppliedCredit] = useState({
    amount: 0,
    currency: null,
    originalAmount: 0,
  });

  // Fetch bank accounts and currencies for the business
  useEffect(() => {
    const fetchBankData = async () => {
      if (!isOpen || !businessId?._id) return;

      setLoadingBankData(true);
      try {
        const businessIdValue = businessId._id || businessId;

        console.log("Fetching bank data for business:", businessIdValue);

        const [bankAccountsRes, currencyResponse] = await Promise.all([
          axios.get(`${Base_URL}/bank-management/accounts`, {
            params: { business: businessIdValue },
            headers: {
              authorization: `Bearer ${adminInfo?.token}`,
            },
          }),
          axios.get(
            `${Base_URL}/finance/currencies?business_id=${businessIdValue}`,
            {
              headers: {
                authorization: `Bearer ${adminInfo?.token}`,
              },
            }
          ),
        ]);

        setBankAccounts(bankAccountsRes.data.accounts || []);
        setCurrencies(currencyResponse.data.data || []);

        console.log(
          "Bank accounts fetched:",
          bankAccountsRes.data.accounts || []
        );
        console.log("Currencies fetched:", currencyResponse.data.data || []);
      } catch (error) {
        console.error("Error fetching bank data:", error);
        setBankAccounts([]);
        setCurrencies([]);
      } finally {
        setLoadingBankData(false);
      }
    };

    fetchBankData();
  }, [isOpen, businessId, adminInfo?.token]);

  // Fetch customer payment history when invoice changes
  const fetchCustomerHistory = async () => {
    if (invoice?.customer_id?._id && businessId?._id) {
      setIsLoadingHistory(true);
      try {
        const [balanceResponse, historyResponse] = await Promise.all([
          CustomerPaymentHistoryServices.getCustomerBalanceSummary(
            invoice.customer_id._id,
            businessId._id
          ),
          CustomerPaymentHistoryServices.getCustomerPaymentHistory(
            invoice.customer_id._id,
            businessId._id
          ),
        ]);

        console.log("Customer balance summary response:", balanceResponse);
        console.log("Customer balance summary data:", balanceResponse.data);
        console.log(
          "Available credits:",
          balanceResponse.data?.availableCredits
        );
        console.log("Overpayments:", balanceResponse.data?.overpayments);
        // The backend returns { success: true, data: { overpayments: [], underpayments: [], ... } }
        setCustomerBalanceSummary(balanceResponse.data);
        setCustomerPaymentHistory(historyResponse.data);
      } catch (error) {
        console.error("Error fetching customer payment history:", error);
        setCustomerBalanceSummary(null);
        setCustomerPaymentHistory(null);
      } finally {
        setIsLoadingHistory(false);
      }
    }
  };

  useEffect(() => {
    fetchCustomerHistory();
  }, [invoice?.customer_id?._id, businessId?._id]);

  // Handle bank selection and set currency
  const handleBankSelection = (bankId) => {
    const selectedBank = bankAccounts.find((bank) => bank._id === bankId);
    setForm((prev) => ({
      ...prev,
      depositTo: bankId,
      currency: selectedBank?.currencyType || prev.currency,
    }));

    // Reset applied credits when currency changes
    if (selectedBank?.currencyType !== form.currency) {
      setAppliedCredit({
        amount: 0,
        currency: null,
        originalAmount: 0,
      });
    }
  };

  const currencyOptions = currencies.map((currency) => ({
    value: currency.symbol,
    label: `${currency.symbol} (${currency.prefix})`,
    conversionRate: currency.conversion_rate_to_base,
  }));

  // Calculate remaining amount for display (simplified)
  const calculateRemainingAmount = () => {
    // Note: This shows remaining from invoice.remaining field
    // The backend will handle accurate currency conversion validation
    return invoice?.remaining || 0;
  };

  // Fetch and process available credits (similar to bulk payment modal)
  const fetchAvailableCredits = useCallback(async () => {
    if (!invoice?.customer_id?._id || !businessId?._id) return;

    try {
      const customerId = invoice.customer_id._id;
      const businessIdValue = businessId._id || businessId;

      const balanceResponse =
        await CustomerPaymentHistoryServices.getCustomerBalanceSummary(
          customerId,
          businessIdValue
        );

      console.log("Customer balance summary response:", balanceResponse);
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

      console.log("Setting available credits:", creditsByCurrency);
      setAvailableCredits(creditsByCurrency);
    } catch (error) {
      console.error("Error fetching customer credits:", error);
    }
  }, [invoice?.customer_id?._id, businessId]);

  // Reset all modal state to initial values
  const resetModalState = useCallback(() => {
    setForm({
      paymentDate: new Date().toISOString().split("T")[0],
      paymentMode: "Bank Transfer",
      depositTo: "",
      amount: "",
      currency: "",
      reference: "",
      bankCharges: "",
      taxDeducted: false,
      tdsType: "",
      notes: "",
      attachment: null,
      emailThankYou: true,
      email: invoice?.customer_id?.basicInformation?.customerEmail || "",
    });
    setErrors({});
    setSuccessMsg("");
    setUploadSuccess(false);
    setPaymentType("exact");
    setPaymentSummary(null);
    setApplyOverpayment(false);
    setOverpaymentAmount(0);
    setAppliedCredit({
      amount: 0,
      currency: null,
      originalAmount: 0,
    });
    // Note: availableCredits will be refreshed when modal reopens
  }, [invoice?.customer_id?.basicInformation?.customerEmail]);

  // Function to immediately update available credits after application
  const updateAvailableCreditsAfterApplication = useCallback(
    (appliedCreditAmount, creditCurrency) => {
      if (!appliedCreditAmount || !creditCurrency) return;

      setAvailableCredits((prev) => {
        const updated = { ...prev };
        if (updated[creditCurrency]) {
          // Reduce the total available amount by the applied amount
          const newTotal = Math.max(
            0,
            updated[creditCurrency].total - appliedCreditAmount
          );
          updated[creditCurrency] = {
            ...updated[creditCurrency],
            total: newTotal,
          };

          // If total becomes 0, remove the currency entry
          if (newTotal <= 0) {
            delete updated[creditCurrency];
          }
        }
        return updated;
      });

      console.log(
        `Updated available credits: reduced ${appliedCreditAmount} ${creditCurrency}`
      );
    },
    []
  );

  useEffect(() => {
    if (isOpen) {
      fetchAvailableCredits();
    } else {
      // Reset state when modal is closed to ensure clean state for next opening
      resetModalState();
    }
  }, [isOpen, fetchAvailableCredits, resetModalState]);

  // Enhanced calculate available overpayment with better currency handling
  const calculateAvailableOverpayment = async () => {
    console.log("Calculating available overpayment:", {
      customerBalanceSummary,
      overpayments: customerBalanceSummary?.overpayments,
      availableCredits: customerBalanceSummary?.availableCredits,
      currency: form.currency,
    });

    console.log("Full customerBalanceSummary object:", customerBalanceSummary);

    // Use available credits if available, otherwise fall back to overpayments
    const credits =
      customerBalanceSummary?.availableCredits ||
      customerBalanceSummary?.overpayments ||
      [];
    if (!credits.length || !form.currency) return 0;

    let totalAvailable = 0;

    for (const credit of credits) {
      const creditAmount = credit.remainingBalance || credit.amount || 0;
      if (creditAmount <= 0) continue;

      if (credit.currency === form.currency) {
        // Same currency, add directly
        totalAvailable += creditAmount;
      } else {
        // Different currency, try to convert
        try {
          // Extract businessId from multiple sources (similar to ProfessionalBulkPaymentModal)
          const businessIdValue =
            businessId?._id ||
            businessId ||
            invoice?.business_id?._id ||
            invoice?.business_id ||
            invoice?.business;

          const conversionResult = await FinancialService.convertCurrency(
            credit.currency,
            form.currency,
            creditAmount,
            businessIdValue
          );
          if (conversionResult.success) {
            totalAvailable += conversionResult.convertedAmount;
          }
        } catch (error) {
          console.warn(
            `Failed to convert ${credit.currency} to ${form.currency}:`,
            error
          );
        }
      }
    }

    console.log("Total available credit:", totalAvailable);
    return totalAvailable;
  };

  // Apply credit to the invoice - RECREATED FROM SCRATCH
  const applyCreditToInvoice = useCallback(
    async (creditAmount, creditCurrency = null) => {
      console.log("🚀 APPLY CREDIT FUNCTION CALLED:", {
        creditAmount,
        creditCurrency,
        invoiceId: invoice?._id,
        currentForm: form,
      });

      if (!invoice) {
        console.log("❌ No invoice found");
        return;
      }

      if (!creditAmount || creditAmount <= 0) {
        console.log("❌ Invalid credit amount:", creditAmount);
        return;
      }

      // Step 1: Determine target currency
      const targetCurrency =
        form.currency || creditCurrency || invoice.currency;
      console.log("🎯 Target currency determined:", targetCurrency);

      // Step 2: Calculate amount to populate in form
      let amountToPopulate = creditAmount;

      // If credit currency is different from target currency, convert it
      if (creditCurrency && creditCurrency !== targetCurrency) {
        try {
          // Extract businessId from multiple sources (similar to ProfessionalBulkPaymentModal)
          const businessIdValue =
            businessId?._id ||
            businessId ||
            invoice?.business_id?._id ||
            invoice?.business_id ||
            invoice?.business;

          console.log("🔍 Raw businessId prop:", businessId);
          console.log("🔍 Raw invoice.business_id:", invoice?.business_id);

          console.log("🔍 Business ID extraction for currency conversion:", {
            businessIdProp: businessId,
            businessIdPropType: typeof businessId,
            invoiceBusinessId: invoice?.business_id,
            invoiceBusinessIdType: typeof invoice?.business_id,
            invoiceBusiness: invoice?.business,
            invoiceBusinessType: typeof invoice?.business,
            extractedBusinessId: businessIdValue,
            extractedBusinessIdType: typeof businessIdValue,
          });

          const conversionResult = await FinancialService.convertCurrency(
            creditCurrency,
            targetCurrency,
            creditAmount,
            businessIdValue
          );

          amountToPopulate = conversionResult.convertedAmount;

          console.log("💱 Currency conversion:", {
            from: creditCurrency,
            to: targetCurrency,
            rate: conversionResult.rate,
            originalAmount: creditAmount,
            convertedAmount: amountToPopulate,
            isCustomRate: conversionResult.isCustomRate,
          });
        } catch (error) {
          console.error("❌ Currency conversion failed:", error);
          // Fallback to original amount if conversion fails
          amountToPopulate = creditAmount;
        }
      }

      // Step 3: Update form with credit amount
      console.log("📝 Updating form with:", {
        amount: amountToPopulate.toFixed(2),
        currency: targetCurrency,
      });

      setForm((prevForm) => {
        const newForm = {
          ...prevForm,
          amount: amountToPopulate.toFixed(2),
          currency: targetCurrency,
        };
        console.log("✅ Form updated:", newForm);
        return newForm;
      });

      // Step 4: Update applied credit state
      const newAppliedCredit = {
        amount: creditAmount, // Store original credit amount
        originalAmount: creditAmount,
        currency: creditCurrency,
        conversionRate:
          creditCurrency !== targetCurrency
            ? amountToPopulate / creditAmount
            : 1,
        appliedAt: new Date().toISOString(),
      };

      console.log("💳 Setting applied credit:", newAppliedCredit);
      setAppliedCredit(newAppliedCredit);

      // Step 5: Update available credits (reduce by applied amount)
      if (creditCurrency && availableCredits[creditCurrency]) {
        setAvailableCredits((prev) => {
          const updated = { ...prev };
          if (updated[creditCurrency]) {
            updated[creditCurrency] = {
              ...updated[creditCurrency],
              total: Math.max(0, updated[creditCurrency].total - creditAmount),
            };

            // Remove currency entry if total becomes 0
            if (updated[creditCurrency].total <= 0) {
              delete updated[creditCurrency];
            }
          }
          console.log("🔄 Available credits updated:", updated);
          return updated;
        });
      }

      console.log("🎉 Credit application completed successfully!");
    },
    [invoice, form, availableCredits]
  );

  // Remove applied credit
  const removeCreditFromInvoice = useCallback(() => {
    if (!appliedCredit || appliedCredit.amount <= 0) return;

    console.log("🔄 Removing applied credit:", appliedCredit);

    // Reset the payment amount to 0 when removing credits
    setForm((prev) => ({
      ...prev,
      amount: "0.00",
    }));

    // Restore available credits - handle both existing and deleted currency entries
    if (appliedCredit.currency) {
      const originalAmount =
        appliedCredit.originalAmount || appliedCredit.amount;

      setAvailableCredits((prev) => {
        const updated = { ...prev };

        if (updated[appliedCredit.currency]) {
          // Currency entry exists, add back the amount
          updated[appliedCredit.currency] = {
            ...updated[appliedCredit.currency],
            total: updated[appliedCredit.currency].total + originalAmount,
          };
        } else {
          // Currency entry was deleted, recreate it
          updated[appliedCredit.currency] = {
            total: originalAmount,
            credits: [], // We don't have the original credit objects, but total is what matters
          };
        }

        console.log("✅ Available credits restored:", updated);
        return updated;
      });
    }

    // Reset applied credit
    setAppliedCredit({
      amount: 0,
      currency: null,
      originalAmount: 0,
    });

    console.log("🎉 Credit removal completed successfully!");
  }, [appliedCredit]);

  // Handle overpayment application (legacy function for backward compatibility)
  const handleApplyOverpayment = async () => {
    console.log("Applying customer credit...");
    const available = await calculateAvailableOverpayment();
    const remaining = calculateRemainingAmount();
    const paymentAmount = parseFloat(form.amount) || 0;

    console.log("Credit application details:", {
      available,
      remaining,
      paymentAmount,
      amountToApply: Math.min(available, remaining),
    });

    if (available > 0 && remaining > 0) {
      const amountToApply = Math.min(available, remaining);
      const newPaymentAmount = Math.max(0, paymentAmount - amountToApply);

      setForm((prev) => ({ ...prev, amount: newPaymentAmount.toString() }));
      setOverpaymentAmount(amountToApply);
      setApplyOverpayment(true);
    }
  };

  // Handle manual credit application
  const handleManualCreditApplication = async () => {
    try {
      const customerId = invoice?.customer_id?._id || invoice?.customer_id;
      const businessId = invoice?.business_id?._id || invoice?.business_id;

      if (!customerId || !businessId) {
        console.error("Missing customer or business ID");
        return;
      }

      const remaining = calculateRemainingAmount();
      const available = await calculateAvailableOverpayment();
      const amountToApply = Math.min(available, remaining);

      if (amountToApply <= 0) {
        console.log("No credit to apply");
        return;
      }

      // Apply credit using the new API
      const creditApplications = [
        {
          invoiceId: invoice._id,
          amount: amountToApply,
          currency: form.currency || invoice.currency,
        },
      ];

      const response =
        await CustomerPaymentHistoryServices.applyCreditsToInvoices(
          customerId,
          businessId,
          creditApplications
        );

      if (response.success) {
        console.log("Credit applied successfully:", response.data);
        // Refresh customer balance summary
        await fetchCustomerHistory();
        // Update form to reflect the applied credit
        const newPaymentAmount = Math.max(
          0,
          parseFloat(form.amount) - amountToApply
        );
        setForm((prev) => ({ ...prev, amount: newPaymentAmount.toString() }));
        setOverpaymentAmount(amountToApply);
        setApplyOverpayment(true);
      }
    } catch (error) {
      console.error("Error applying credit:", error);
    }
  };

  // Calculate payment summary when amount changes
  useEffect(() => {
    const calculatePaymentSummary = async () => {
      if (form.amount && form.currency && invoice) {
        const paymentAmount = parseFloat(form.amount);
        const baseRemainingAmount = calculateRemainingAmount();

        // Since credits are now populated in the payment amount field,
        // we don't need to add them separately in the calculation
        const remainingAmount = baseRemainingAmount;

        if (form.currency !== invoice.currency) {
          // Use currency conversion service for accurate rates
          try {
            // Extract businessId from multiple sources (similar to ProfessionalBulkPaymentModal)
            const businessIdValue =
              businessId?._id ||
              businessId ||
              invoice?.business_id?._id ||
              invoice?.business_id ||
              invoice?.business;

            const conversionResult = await FinancialService.convertCurrency(
              invoice.currency,
              form.currency,
              remainingAmount,
              businessIdValue
            );

            console.log("🔍 Payment Summary Currency Conversion:", {
              from: invoice.currency,
              to: form.currency,
              amount: remainingAmount,
              businessId: businessIdValue,
              conversionResult: conversionResult,
            });

            if (conversionResult.success) {
              const remainingInPaymentCurrency =
                conversionResult.convertedAmount;

              // Since credits are now populated in the payment amount,
              // payment amount already includes any applied credits
              const differenceInPaymentCurrency =
                paymentAmount - remainingInPaymentCurrency;

              if (Math.abs(differenceInPaymentCurrency) < 0.01) {
                setPaymentType("exact");
                setPaymentSummary({
                  type: "exact",
                  message: "Payment covers the exact remaining amount",
                  remainingAfterPayment: 0,
                  overpaymentAmount: 0,
                });
              } else if (differenceInPaymentCurrency > 0.01) {
                setPaymentType("overpayment");
                const overpaymentMessage =
                  appliedCredit.amount > 0
                    ? `Applied credit amount exceeds remaining amount by ${
                        form.currency
                      } ${differenceInPaymentCurrency.toFixed(2)}`
                    : `Payment exceeds remaining amount by ${
                        form.currency
                      } ${differenceInPaymentCurrency.toFixed(2)}`;

                setPaymentSummary({
                  type: "overpayment",
                  message: overpaymentMessage,
                  remainingAfterPayment: 0,
                  overpaymentAmount: differenceInPaymentCurrency,
                  isFromAppliedCredit: appliedCredit.amount > 0,
                });
              } else {
                // Calculate actual remaining amount in invoice currency after payment
                // Extract businessId from multiple sources (similar to ProfessionalBulkPaymentModal)
                const businessIdValue =
                  businessId?._id ||
                  businessId ||
                  invoice?.business_id?._id ||
                  invoice?.business_id ||
                  invoice?.business;

                const paymentInInvoiceCurrency =
                  await FinancialService.convertCurrency(
                    form.currency,
                    invoice.currency,
                    paymentAmount,
                    businessIdValue
                  );

                console.log("🔍 Payment Amount Currency Conversion:", {
                  from: form.currency,
                  to: invoice.currency,
                  amount: paymentAmount,
                  businessId: businessIdValue,
                  conversionResult: paymentInInvoiceCurrency,
                });

                let remainingAfterPaymentInInvoiceCurrency = remainingAmount;
                if (paymentInInvoiceCurrency.success) {
                  remainingAfterPaymentInInvoiceCurrency = Math.max(
                    0,
                    remainingAmount - paymentInInvoiceCurrency.convertedAmount
                  );
                } else {
                  remainingAfterPaymentInInvoiceCurrency = Math.max(
                    0,
                    remainingAmount - paymentAmount
                  );
                }

                const underpaymentMessage =
                  appliedCredit.amount > 0
                    ? `Applied credit amount is ${formatCurrencyAmount(
                        form.currency,
                        Math.abs(differenceInPaymentCurrency),
                      )} short of remaining amount`
                    : `Payment is ${formatCurrencyAmount(
                        form.currency,
                        Math.abs(differenceInPaymentCurrency),
                      )} short of remaining amount`;

                setPaymentType("underpayment");
                setPaymentSummary({
                  type: "underpayment",
                  message: underpaymentMessage,
                  remainingAfterPayment: remainingAfterPaymentInInvoiceCurrency,
                  overpaymentAmount: 0,
                  isFromAppliedCredit: appliedCredit.amount > 0,
                });
              }
            } else {
              // Fallback to direct comparison if conversion fails
              console.warn(
                "Currency conversion failed, using direct comparison"
              );
              const difference = paymentAmount - remainingAmount;
              if (Math.abs(difference) < 0.01) {
                setPaymentType("exact");
                setPaymentSummary({
                  type: "exact",
                  message: "Payment covers the exact remaining amount",
                  remainingAfterPayment: 0,
                  overpaymentAmount: 0,
                });
              } else if (difference > 0.01) {
                setPaymentType("overpayment");
                setPaymentSummary({
                  type: "overpayment",
                  message: `Payment exceeds remaining amount by ${formatCurrencyAmount(
                    form.currency,
                    difference,
                  )}`,
                  remainingAfterPayment: 0,
                  overpaymentAmount: difference,
                });
              } else {
                setPaymentType("underpayment");
                setPaymentSummary({
                  type: "underpayment",
                  message: `Payment is ${formatCurrencyAmount(
                    form.currency,
                    Math.abs(difference),
                  )} short of remaining amount`,
                  remainingAfterPayment: Math.max(
                    0,
                    remainingAmount - paymentAmount
                  ), // Actual remaining after payment in invoice currency
                  overpaymentAmount: 0,
                });
              }
            }
          } catch (error) {
            console.error("Error converting currency:", error);
            // Fallback to direct comparison
            const difference = paymentAmount - remainingAmount;
            if (Math.abs(difference) < 0.01) {
              setPaymentType("exact");
              setPaymentSummary({
                type: "exact",
                message: "Payment covers the exact remaining amount",
                remainingAfterPayment: 0,
                overpaymentAmount: 0,
              });
            } else if (difference > 0.01) {
              setPaymentType("overpayment");
              setPaymentSummary({
                type: "overpayment",
                message: `Payment exceeds remaining amount by ${
                  form.currency
                } ${difference.toFixed(2)}`,
                remainingAfterPayment: 0,
                overpaymentAmount: difference,
              });
            } else {
              setPaymentType("underpayment");
              setPaymentSummary({
                type: "underpayment",
                message: `Payment is ${formatCurrencyAmount(
                  form.currency,
                  Math.abs(difference),
                )} short of remaining amount`,
                remainingAfterPayment: Math.abs(difference),
                overpaymentAmount: 0,
              });
            }
          }
        } else {
          // Same currency, direct comparison
          const difference = paymentAmount - remainingAmount;

          if (Math.abs(difference) < 0.01) {
            setPaymentType("exact");
            setPaymentSummary({
              type: "exact",
              message: "Payment covers the exact remaining amount",
              remainingAfterPayment: 0,
              overpaymentAmount: 0,
            });
          } else if (difference > 0.01) {
            setPaymentType("overpayment");
            setPaymentSummary({
              type: "overpayment",
              message: `Payment exceeds remaining amount by ${formatCurrencyAmount(
                form.currency,
                difference,
              )}`,
              remainingAfterPayment: 0,
              overpaymentAmount: difference,
            });
          } else {
            setPaymentType("underpayment");
            setPaymentSummary({
              type: "underpayment",
              message: `Payment is ${formatCurrencyAmount(
                form.currency,
                Math.abs(difference),
              )} short of remaining amount`,
              remainingAfterPayment: Math.max(
                0,
                remainingAmount - paymentAmount
              ), // Actual remaining after payment
              overpaymentAmount: 0,
            });
          }
        }
      } else {
        setPaymentSummary(null);
      }
    };

    calculatePaymentSummary();
  }, [form.amount, form.currency, invoice, appliedCredit]);

  const validate = () => {
    const errs = {};
    if (!form.paymentDate) errs.paymentDate = "Required";
    if (!form.paymentMode) errs.paymentMode = "Required";
    if (!form.depositTo) errs.depositTo = "Required";
    if (!form.amount || isNaN(form.amount) || Number(form.amount) <= 0)
      errs.amount = "Enter valid amount";

    // Allow both underpayments and overpayments
    // Underpayments: partial payment towards invoice (remaining amount will be tracked)
    // Overpayments: excess payment that will be added to customer credits for future invoices
    // The backend will handle proper tracking and currency conversion for both scenarios

    if (!form.currency) errs.currency = "Required";

    // Allow overpayments as they will be available as credits for future invoices
    // Only validate for extremely unreasonable amounts (safety check)
    const paymentAmount = parseFloat(form.amount) || 0;
    const remainingAmount = calculateRemainingAmount();

    // Set a reasonable upper limit for overpayments - 100x the remaining amount or minimum $10,000
    const reasonableLimit = Math.max(remainingAmount * 100, 10000);

    // if (paymentAmount > reasonableLimit) {
    //   errs.amount = `Payment amount seems unusually high. Maximum recommended: ${
    //     form.currency
    //   } ${reasonableLimit.toFixed(2)}`;
    // }

    return errs;
  };

  const handleChange = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleFileChange = async (e) => {
    console.log("file", e.target.files[0]);
    console.log("invoice?._id", invoice?._id);
    console.log("businessId", businessId._id);
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setUploadSuccess(false);
    const formData = new FormData();
    formData.append("file_path", `Payments/${invoice?._id}`);
    formData.append("business_id", businessId._id);
    formData.append("file_type", file.type);
    formData.append("file_size", file.size);
    formData.append("file", file);
    try {
      const res = await axios.post(
        `${Base_URL}/documents/uploadDocument`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      if (res.data.file) {
        setForm((prev) => ({
          ...prev,
          attachment: {
            fileId: res.data.file._id,
            name: res.data.file.name,
            url: res.data.file.url || "#",
            downloadUrl: res.data.file.downloadUrl || "#",
            uploadedAt: new Date().toISOString(),
            size: file.size,
            type: file.type,
          },
        }));
        setSuccessMsg("File uploaded successfully");
        setUploadSuccess(true);
        setTimeout(() => {
          setSuccessMsg("");
          setUploadSuccess(false);
        }, 3000);
      }
    } catch (err) {
      setErrors((prev) => ({ ...prev, attachment: "Upload failed" }));
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) return;

    // Add payment type and summary to the form data
    const submitData = {
      ...form,
      paymentType: paymentType,
      paymentSummary: paymentSummary,
      applyOverpayment: applyOverpayment || appliedCredit.amount > 0, // Include new credit system
      overpaymentAmount: overpaymentAmount || appliedCredit.amount || 0, // Use applied credit amount if available
      appliedCreditDetails:
        appliedCredit.amount > 0
          ? {
              amount: appliedCredit.amount,
              originalAmount: appliedCredit.originalAmount,
              currency: appliedCredit.currency,
              conversionRate: appliedCredit.conversionRate,
              appliedAt: appliedCredit.appliedAt,
            }
          : null,
    };

    try {
      // Update available credits immediately if credits were applied
      const effectiveCreditAmount =
        appliedCredit.amount > 0
          ? appliedCredit.originalAmount || appliedCredit.amount
          : overpaymentAmount;
      const effectiveCreditCurrency =
        appliedCredit.amount > 0 ? appliedCredit.currency : form.currency;

      if (
        (applyOverpayment || appliedCredit.amount > 0) &&
        effectiveCreditAmount > 0
      ) {
        updateAvailableCreditsAfterApplication(
          effectiveCreditAmount,
          effectiveCreditCurrency
        );
      }

      // Call the parent's onSubmit function
      await onSubmit(submitData);

      // Reset modal state after successful payment
      resetModalState();

      // Refresh customer balance summary and available credits
      await fetchCustomerHistory();
      await fetchAvailableCredits();

      // Show success message
      setSuccessMsg("Payment recorded successfully!");

      // Close modal after a brief delay to show success message
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error("Payment submission error:", error);
      // Error handling - don't reset state if payment failed
      // If payment failed and we updated credits, we should refresh to get accurate state
      if (
        (applyOverpayment || appliedCredit.amount > 0) &&
        effectiveCreditAmount > 0
      ) {
        await fetchAvailableCredits();
      }
    }
  };

  const HandleOpenFile = async (documentId) => {
    console.log("document_id", documentId);
    try {
      let Response = await axios.get(
        `${Base_URL}/documents/getFileWithAllData/${documentId}`
      );
      console.log("document_id Response", Response);
      window.open(Response.data.data.url, "_blank");
    } catch (error) {
      notifyError(ciText("Error getting file"));
      console.log("Error : ", error);
    }
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-fade-in">
        <div className="p-6 pb-4 border-b border-gray-200 relative">
          <button
            className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-2xl focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
            onClick={onClose}
            aria-label={ciText("Close")}
          >
            &times;
          </button>
          <h2 className="text-xl md:text-2xl font-bold text-gray-800 pr-8">
            {ciText("Record Payment")}
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-6 pt-4">
          <div className="mb-4 p-3 md:p-4 bg-blue-50 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600">
                {ciText("Invoice Total:")}
              </span>
              <span className="font-semibold text-gray-800">
                {invoice?.currency || "USD"}{" "}
                {invoice?.grandTotal?.toFixed(2) || "0.00"}
              </span>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-sm font-medium text-gray-600">
                {ciText("Remaining Balance:")}
              </span>
              <span className="font-semibold text-orange-600">
                {invoice?.currency || "USD"}{" "}
                {calculateRemainingAmount().toFixed(2)}
              </span>
            </div>
          </div>

          {/* Customer Payment History Section */}
          {/* {customerBalanceSummary && (
            <div className="mb-4 p-3 md:p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Info size={16} className="text-blue-600" />
                <span className="text-sm font-medium text-gray-700">
                  {ciText("Customer Payment History")}
                </span>
              </div>
              {isLoadingHistory ? (
                <div className="text-sm text-gray-500">
                  {ciText("Loading payment history...")}
                </div>
              ) : (
                <div className="space-y-2">
                  {customerBalanceSummary.overpayments?.length > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">
                        {ciText("Available Credits:")}
                      </span>
                      <span className="text-sm font-semibold text-green-600">
                        {customerBalanceSummary.overpayments.map(
                          (overpayment, index) => (
                            <span key={index}>
                              {formatCurrencyAmount(
                                overpayment.currency,
                                overpayment.amount || 0,
                              )}
                              {index <
                              customerBalanceSummary.overpayments.length - 1
                                ? ", "
                                : ""}
                            </span>
                          )
                        )}
                      </span>
                    </div>
                  )}
                  {customerBalanceSummary.underpayments?.length > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">
                        {ciText("Outstanding Balances:")}
                      </span>
                      <span className="text-sm font-semibold text-red-600">
                        {customerBalanceSummary.underpayments.map(
                          (underpayment, index) => (
                            <span key={index}>
                              {formatCurrencyAmount(
                                underpayment.currency,
                                underpayment.amount || 0,
                              )}
                              {index <
                              customerBalanceSummary.underpayments.length - 1
                                ? ", "
                                : ""}
                            </span>
                          )
                        )}
                      </span>
                    </div>
                  )}
                  {customerBalanceSummary.netPosition !== 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">
                        {ciText("Net Position:")}
                      </span>
                      <span
                        className={`text-sm font-semibold ${
                          customerBalanceSummary.netPosition > 0
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {customerBalanceSummary.netPositionCurrency || "USD"}{" "}
                        {(customerBalanceSummary.netPosition || 0).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )} */}

          {/* Available Credits Summary - Always Visible */}
          {Object.keys(availableCredits).length > 0 && (
            <div className="mb-4 p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                  <Wallet size={16} className="text-green-600 mr-2" />
                  <span className="text-sm font-medium text-green-700">
                    {ciText("Available Customer Credits")}
                  </span>
                </div>
              </div>

              {/* Available Credits by Currency */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(availableCredits).map(
                  ([currency, creditInfo]) => {
                    if (!creditInfo?.total || creditInfo.total <= 0)
                      return null;

                    return (
                      <div
                        key={currency}
                        className="bg-white p-3 rounded border border-green-200"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium text-green-700">
                              {formatCurrencyAmount(currency, creditInfo.total)}
                            </div>
                            <div className="text-xs text-green-600">
                              {ciText("Available")}
                            </div>
                            {currency !== invoice?.currency && (
                              <div className="text-xs text-blue-600 flex items-center mt-1">
                                <ArrowRightLeft size={10} className="mr-1" />
                                Will convert to {invoice?.currency}
                              </div>
                            )}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              console.log("🔘 BUTTON CLICKED:", {
                                creditInfoTotal: creditInfo.total,
                                currency: currency,
                                isDisabled: creditInfo.total <= 0,
                              });
                              await applyCreditToInvoice(
                                creditInfo.total,
                                currency
                              );
                            }}
                            className="text-xs text-green-600 hover:text-green-700"
                            disabled={creditInfo.total <= 0}
                          >
                            <Plus size={12} />
                            {ciText("Apply")}
                          </Button>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>

              {/* Apply All Available Credits Button */}
              {Object.keys(availableCredits).length > 0 && (
                <div className="mt-3">
                  <Button
                    variant="success"
                    size="sm"
                    onClick={async () => {
                      for (const [currency, creditInfo] of Object.entries(
                        availableCredits
                      )) {
                        if (creditInfo?.total && creditInfo.total > 0) {
                          await applyCreditToInvoice(
                            creditInfo.total,
                            currency
                          );
                        }
                      }
                    }}
                    className="w-full text-sm"
                  >
                    {ciText("Apply All Available Credits")}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Payment Summary Section */}
          {paymentSummary && (
            <div
              className={`mb-4 p-3 md:p-4 rounded-lg ${
                paymentSummary.type === "exact"
                  ? "bg-green-50 border border-green-200"
                  : paymentSummary.type === "overpayment"
                  ? "bg-blue-50 border border-blue-200"
                  : "bg-yellow-50 border border-yellow-200"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                {paymentSummary.type === "exact" ? (
                  <CheckCircle size={16} className="text-green-600" />
                ) : paymentSummary.type === "overpayment" ? (
                  <ArrowRightLeft size={16} className="text-blue-600" />
                ) : (
                  <AlertTriangle size={16} className="text-yellow-600" />
                )}
                <span
                  className={`text-sm font-medium ${
                    paymentSummary.type === "exact"
                      ? "text-green-700"
                      : paymentSummary.type === "overpayment"
                      ? "text-blue-700"
                      : "text-yellow-700"
                  }`}
                >
                  {ciText("Payment Summary")}
                </span>
              </div>
              <div className="text-sm text-gray-700 mb-2">
                {paymentSummary.message}
              </div>
              {paymentSummary.type === "overpayment" &&
                paymentSummary.overpaymentAmount > 0 && (
                  <div className="text-sm text-blue-600">
                    <DollarSign size={14} className="inline mr-1" />
                    {paymentSummary.isFromAppliedCredit ? (
                      <div>
                        <div className="font-semibold">
                          Excess credit amount:{" "}
                          {formatCurrencyAmount(
                            form.currency,
                            paymentSummary.overpaymentAmount,
                          )}{" "}
                          will be
                          available for future invoices
                        </div>
                      </div>
                    ) : (
                      <div>
                        Overpayment of{" "}
                        {formatCurrencyAmount(
                          form.currency,
                          paymentSummary.overpaymentAmount || 0,
                        )}{" "}
                        will be added to customer credits
                      </div>
                    )}
                  </div>
                )}
              {paymentSummary.type === "underpayment" &&
                paymentSummary.remainingAfterPayment > 0 && (
                  <div className="text-sm text-yellow-600">
                    <AlertTriangle size={14} className="inline mr-1" />
                    Invoice will remain partially paid with{" "}
                    {invoice?.currency || "USD"}{" "}
                    {(paymentSummary.remainingAfterPayment || 0).toFixed(2)}{" "}
                    outstanding
                  </div>
                )}

              {/* Overpayment Adjustment Section */}
              {/* Credits moved to always visible section above */}

              {/* Legacy Customer Credits Section (for backward compatibility) */}
              {Object.keys(availableCredits).length === 0 &&
                (customerBalanceSummary?.availableCredits?.length > 0 ||
                  customerBalanceSummary?.overpayments?.length > 0) && (
                  <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-green-700">
                        {ciText("Available Customer Credits")}
                      </span>
                    </div>

                    {/* Show available credits first */}
                    {customerBalanceSummary?.availableCredits?.length > 0 && (
                      <div className="mb-2">
                        <div className="text-xs font-medium text-green-700 mb-1">
                          {ciText("Available Credits:")}
                        </div>
                        <div className="space-y-1">
                          {customerBalanceSummary.availableCredits.map(
                            (credit, index) => (
                              <div
                                key={`credit-${index}`}
                                className="text-xs text-green-600"
                              >
                                {formatCurrencyAmount(
                                  credit.currency,
                                  credit.amount || 0,
                                )}
                                {credit.currency !== form.currency && (
                                  <span className="text-gray-500 ml-1">
                                    (will be converted to {form.currency})
                                  </span>
                                )}
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}

                    {/* Show overpayments as fallback */}
                    {!customerBalanceSummary?.availableCredits?.length &&
                      customerBalanceSummary?.overpayments?.length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-green-700 mb-1">
                            {ciText("Overpayments Available:")}
                          </div>
                          <div className="space-y-1">
                            {customerBalanceSummary.overpayments.map(
                              (overpayment, index) => (
                                <div
                                  key={`overpayment-${index}`}
                                  className="text-xs text-green-600"
                                >
                                  {formatCurrencyAmount(
                                    overpayment.currency,
                                    overpayment.amount || 0,
                                  )}
                                  {overpayment.currency !== form.currency && (
                                    <span className="text-gray-500 ml-1">
                                      (will be converted to {form.currency})
                                    </span>
                                  )}
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}

                    {applyOverpayment && (
                      <div className="mt-2 text-xs text-green-700">
                        <strong>{ciText("Applied:")}</strong>{" "}
                        {formatCurrencyAmount(
                          form.currency,
                          overpaymentAmount,
                        )}{" "}
                        from customer credits
                      </div>
                    )}
                  </div>
                )}
            </div>
          )}
          <form
            id="payment-form"
            onSubmit={handleSubmit}
            className="space-y-4 md:space-y-6"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
              <div>
                <label className="block text-sm font-medium">
                  {ciText("Payment Date *")}
                </label>
                <CustomDatePicker
                  value={form.paymentDate}
                  onChange={(val) => handleChange("paymentDate", val)}
                />
                {errors.paymentDate && (
                  <p className="text-red-500 text-xs">{errors.paymentDate}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium">
                  {ciText("Payment Mode *")}
                </label>
                <SearchableDropdown
                  value={form.paymentMode}
                  onChange={(e) => handleChange("paymentMode", e.target.value)}
                  placeholder={ciText("Select Mode")}
                  searchPlaceholder="Search payment modes..."
                  options={[
                    { value: "Bank Transfer", label: ciText("Bank Transfer") },
                    { value: "Cash", label: ciText("Cash") },
                    { value: "Cheque", label: ciText("Cheque") },
                  ]}
                  searchKeys={["label"]}
                  renderOption={(option) => (
                    <div>
                      <div className="font-medium">{option.label}</div>
                    </div>
                  )}
                />
                {errors.paymentMode && (
                  <p className="text-red-500 text-xs">{errors.paymentMode}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {ciText("Bank Account *")}
                </label>
                <SearchableDropdown
                  value={form.depositTo}
                  onChange={(e) => handleBankSelection(e.target.value)}
                  placeholder={
                    loadingBankData
                      ? "Loading bank accounts..."
                      : ciText("Select Bank Account")
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
                {form.depositTo && form.currency && (
                  <div className="mt-1 text-xs text-green-600">
                    Payment currency: {form.currency}
                  </div>
                )}
                {errors.depositTo && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.depositTo}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Amount ({form.currency || ciText("Select Bank")}) *
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    value={form.amount}
                    onChange={(e) => handleChange("amount", e.target.value)}
                    placeholder={`0.00 ${form.currency || ""}`}
                    min="0"
                    step="0.01"
                  />
                  {/* Remove Credit Option */}
                  {appliedCredit.amount > 0 && (
                    <div className="mt-2 p-2 bg-green-50 rounded border border-green-200">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-green-700">
                          <span className="font-medium">{ciText("Applied Credit:")}</span>{" "}
                          {formatCurrencyAmount(
                            appliedCredit.currency,
                            appliedCredit.amount,
                          )}
                          {appliedCredit.conversionRate &&
                            appliedCredit.conversionRate !== 1 && (
                              <span className="text-xs text-blue-600 ml-1">
                                (from{" "}
                                {formatCurrencyAmount(
                                  appliedCredit.currency,
                                  appliedCredit.originalAmount,
                                )}
                                )
                              </span>
                            )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={removeCreditFromInvoice}
                          className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Minus size={12} />
                          {ciText("Remove Credit")}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                {form.currency &&
                  form.currency !== invoice?.currency &&
                  form.amount > 0 && (
                    <div className="mt-1 p-2 bg-blue-50 rounded text-xs">
                      <div className="flex items-center gap-1 text-blue-700">
                        <ArrowRightLeft size={12} />
                        <span className="font-medium">
                          {ciText("Currency Conversion:")}
                        </span>
                      </div>
                      <div className="text-blue-600">
                        {formatCurrencyAmount(form.currency, form.amount)} →{" "}
                        {invoice?.currency}
                        (estimated)
                      </div>
                      <div className="text-xs text-blue-500 mt-1">
                        {ciText("Exact rate applied during processing")}
                      </div>
                    </div>
                  )}
                {errors.amount && (
                  <p className="text-red-500 text-xs mt-1">{errors.amount}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium">{ciText("Reference#")}</label>
                <InputField
                  value={form.reference}
                  onChange={(e) => handleChange("reference", e.target.value)}
                  placeholder={ciText("Reference")}
                />
              </div>
              <div>
                <label className="block text-sm font-medium">
                  {ciText("Bank Charges")}
                </label>
                <InputField
                  type="number"
                  value={form.bankCharges}
                  onChange={(e) => handleChange("bankCharges", e.target.value)}
                  placeholder={ciText("Bank Charges")}
                />
              </div>
              <div>
                <label className="block text-sm font-medium">
                  {ciText("Tax Deducted?")}
                </label>
                <div className="flex items-center space-x-4 mt-1">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={!form.taxDeducted}
                      onChange={() => handleChange("taxDeducted", false)}
                    />
                    <span className="ml-1">{ciText("No Tax deducted")}</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={form.taxDeducted}
                      onChange={() => handleChange("taxDeducted", true)}
                    />
                    <span className="ml-1">{ciText("Yes, TDS")}</span>
                  </label>
                </div>
              </div>
              {form.taxDeducted && (
                <div>
                  <label className="block text-sm font-medium">{ciText("TDS Type")}</label>
                  <InputField
                    value={form.tdsType}
                    onChange={(e) => handleChange("tdsType", e.target.value)}
                    placeholder={ciText("TDS Type")}
                  />
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium">{ciText("Notes")}</label>
              <InputField
                value={form.notes}
                onChange={(e) => handleChange("notes", e.target.value)}
                placeholder={ciText("Notes")}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                {ciText("Attachment")}
              </label>
              <div
                className={`border-2 rounded-xl p-4 md:p-6 flex flex-col items-center justify-center transition-all duration-200 ${
                  errors.attachment
                    ? "border-red-400 bg-red-50"
                    : uploadSuccess
                    ? "border-green-400 bg-green-50"
                    : "border-dashed border-[var(--p-blue)] bg-gray-50 hover:bg-gray-100"
                }`}
              >
                <input
                  type="file"
                  id="payment-attachment-upload"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={uploading}
                />
                <label
                  htmlFor="payment-attachment-upload"
                  className="cursor-pointer flex items-center gap-2 text-[var(--p-blue)] hover:text-[#7fa02a] font-medium"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="mr-2"
                  >
                    <path
                      d="M10.0003 13.3333V1.66666M10.0003 1.66666L5.83366 5.83332M10.0003 1.66666L14.167 5.83332"
                      stroke="var(--p-blue)"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M1.66699 14.1667L2.22533 16.3583C2.27627 16.5793 2.38868 16.7841 2.55118 16.9485C2.71368 17.1129 2.91952 17.2308 3.14199 17.2883C3.54199 17.4 4.25033 17.5 5.00033 17.5H15.0003C15.7503 17.5 16.4587 17.4 16.8587 17.2883C17.0811 17.2308 17.287 17.1129 17.4495 16.9485C17.612 16.7841 17.7244 16.5793 17.7753 16.3583L18.3337 14.1667"
                      stroke="var(--p-blue)"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {uploading ? ciText("Uploading...") : ciText("Upload Payment Attachment")}
                </label>
                {form.attachment && (
                  <div className="mt-3 p-3 bg-white rounded-md w-full flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      {form.attachment.name}
                    </span>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => HandleOpenFile(form.attachment.fileId)}
                        className="text-xs text-[var(--p-blue)] hover:underline"
                      >
                        {ciText("View")}
                      </button>
                    </div>
                    {uploadSuccess && (
                      <CheckCircle className="text-green-500 ml-2" size={18} />
                    )}
                  </div>
                )}
                {errors.attachment && (
                  <p className="text-red-500 text-xs mt-2">
                    {errors.attachment}
                  </p>
                )}
                {successMsg && (
                  <p className="text-green-500 text-xs mt-2">{successMsg}</p>
                )}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-2">
              <input
                type="checkbox"
                checked={form.emailThankYou}
                onChange={() =>
                  handleChange("emailThankYou", !form.emailThankYou)
                }
              />
              <span className="ml-2">
                {ciText("Email a \"Thank you\" note for this payment")}
              </span>
              {form.emailThankYou && (
                <div className="w-full sm:ml-4">
                  <InputField
                    value={form.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    placeholder={ciText("Email address")}
                  />
                </div>
              )}
            </div>
          </form>
        </div>

        {/* Footer with buttons - fixed at bottom */}
        <div className="p-6 pt-4 border-t border-gray-200 bg-white">
          <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3">
            <button
              type="button"
              className="w-full sm:w-auto px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
              onClick={onClose}
            >
              {ciText("Cancel")}
            </button>
            <button
              type="submit"
              form="payment-form"
              className="w-full sm:w-auto px-6 py-2 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[#9aba33] font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
              disabled={uploading}
            >
              {ciText("Save Payment")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
