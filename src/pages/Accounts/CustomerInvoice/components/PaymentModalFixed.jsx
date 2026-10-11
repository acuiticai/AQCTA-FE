import { useTranslation } from "react-i18next";
import { customerInvoiceText as ciText } from "@/utils/customerInvoiceI18n";
import React, { useState, useEffect, useCallback, useContext } from "react";
import { formatCurrencyAmount } from "@/components/formatAmount";
import DropdownBasic from "@/components/DropdownBasic";
import CustomDatePicker from "@/components/CustomDatePicker";
import InputField from "../reusablecomponents/InputField";
import axios from "axios";
import BankManagementServices from "@/services/BankManagementServices";
import useAsync from "@/hooks/useAsync";
import FinancialService from "@/services/financialService";
import { AdminContext } from "@/context/AdminContext";
import {
  getNextDocumentNumber,
  generateDocumentNumber as claimDocumentNumber,
} from "@/services/documentSequenceServices";
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
  AlertCircle,
  Loader,
  Eye,
} from "lucide-react";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

/** Deep-clone credit pool objects ({ [currency]: { total, credits } }) */
const cloneCreditsPool = (pool) => {
  try {
    return JSON.parse(JSON.stringify(pool && typeof pool === "object" ? pool : {}));
  } catch {
    return {};
  }
};

/**
 * COMPREHENSIVE PAYMENT MODAL WITH FULL CREDIT MANAGEMENT
 *
 * This modal handles:
 * 1. Cash-only payments
 * 2. Credit-only payments (applying existing customer credits)
 * 3. Mixed payments (combination of credits + cash)
 * 4. Multi-currency support with real-time conversion
 * 5. Overpayment tracking (creates new credits)
 * 6. Underpayment tracking
 * 7. Comprehensive validation and error handling
 */

const PaymentModal = ({ isOpen, onClose, onSubmit, invoice, businessId }) => {
  useTranslation();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;

  // === CORE FORM STATE ===
  const [form, setForm] = useState({
    paymentDate: new Date().toISOString().split("T")[0],
    paymentMode: "Bank Transfer",
    depositTo: "",
    amount: "0",
    currency: invoice?.currency || "",
    reference: "",
    bankCharges: "0",
    taxDeducted: false,
    tdsType: "",
    notes: "",
    attachment: null,
    emailThankYou: true,
    email: invoice?.customer_id?.basicInformation?.customerEmail || "",
  });

  // === UI STATE ===
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // === BANK & CURRENCY DATA ===
  const [bankAccounts, setBankAccounts] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [loadingBankData, setLoadingBankData] = useState(false);

  // === PAYMENT RECEIPT NUMBER PREVIEW (PR-XXXXXX) ===
  const [paymentNumberPreview, setPaymentNumberPreview] = useState("");

  // === CREDIT MANAGEMENT STATE ===
  const [availableCredits, setAvailableCredits] = useState({});
  /** Unchanged snapshot from last balance fetch — used for tab enablement and resetting when switching to cash-only */
  const [creditPoolBaseline, setCreditPoolBaseline] = useState({});
  const [appliedCredits, setAppliedCredits] = useState([]);
  const [loadingCredits, setLoadingCredits] = useState(false);

  // === PAYMENT CALCULATION STATE ===
  const [paymentType, setPaymentType] = useState("cash_only"); // cash_only, credit_only, mixed
  const [paymentSummary, setPaymentSummary] = useState(null);
  const [conversionRates, setConversionRates] = useState({});

  // === RESET FUNCTION ===
  const resetModalState = useCallback(() => {
    setForm({
      paymentDate: new Date().toISOString().split("T")[0],
      paymentMode: "Bank Transfer",
      depositTo: "",
      amount: "0",
      currency: invoice?.currency || "",
      reference: "",
      bankCharges: "0",
      taxDeducted: false,
      tdsType: "",
      notes: "",
      attachment: null,
      emailThankYou: true,
      email: invoice?.customer_id?.basicInformation?.customerEmail || "",
    });
    setAppliedCredits([]);
    setPaymentType("cash_only");
    setPaymentSummary(null);
    setErrors({});
    setSuccessMsg("");
    setUploadSuccess(false);
    setConversionRates({});
    setAvailableCredits({});
    setCreditPoolBaseline({});
  }, [invoice?.currency, invoice?.customer_id?.basicInformation?.customerEmail]);

  // === FETCH BANK ACCOUNTS & CURRENCIES ===
  useEffect(() => {
    const fetchBankData = async () => {
      const businessIdValue = businessId?._id || businessId;
      if (!isOpen || !businessIdValue) return;

      setLoadingBankData(true);
      try {

        const [bankAccountsRes, currencyResponse] = await Promise.all([
          axios.get(`${Base_URL}/bank-management/accounts`, {
            params: { business: businessIdValue },
            headers: { authorization: `Bearer ${adminInfo?.token}` },
          }),
          axios.get(
            `${Base_URL}/finance/currencies?business_id=${businessIdValue}`,
            {
              headers: { authorization: `Bearer ${adminInfo?.token}` },
            }
          ),
        ]);

        setBankAccounts(bankAccountsRes.data.accounts || []);
        setCurrencies(currencyResponse.data.data || []);

        console.log("✅ Bank data loaded:", {
          accounts: bankAccountsRes.data.accounts?.length || 0,
          currencies: currencyResponse.data.data?.length || 0,
        });
      } catch (error) {
        console.error("❌ Error fetching bank data:", error);
        setBankAccounts([]);
        setCurrencies([]);
      } finally {
        setLoadingBankData(false);
      }
    };

    fetchBankData();
  }, [isOpen, businessId, adminInfo?.token]);

  // === FETCH PAYMENT RECEIPT NUMBER PREVIEW (PR-XXXXXX) ===
  useEffect(() => {
    if (!isOpen) return;
    const bizId = businessId?._id || businessId;
    if (!bizId) return;
    // businessId prop may be a full business object or just an ID
    // getNextDocumentNumber resolves businessGroupId from businessId on the BE
    getNextDocumentNumber("payment_received", bizId, null)
      .then((res) => setPaymentNumberPreview(res.data?.nextNumber || ""))
      .catch(() => setPaymentNumberPreview("")); // Not configured — hide preview
  }, [isOpen, businessId]);

  // === FETCH AVAILABLE CREDITS ===
  // Same Bearer auth as other modal requests; supports business/customer id as object or string.
  const fetchAvailableCredits = useCallback(async () => {
    const rawCustomer = invoice?.customer_id;
    const customerId =
      (typeof rawCustomer === "object" && rawCustomer
        ? rawCustomer._id || rawCustomer.id
        : null) ||
      (typeof rawCustomer === "string" ? rawCustomer : null);

    const rawBiz = businessId ?? invoice?.business_id ?? invoice?.business;
    const businessIdValue =
      (typeof rawBiz === "object" && rawBiz
        ? rawBiz._id || rawBiz.id
        : null) || (typeof rawBiz === "string" ? rawBiz : null);

    if (!customerId || !businessIdValue || !adminInfo?.token) return;

    setLoadingCredits(true);
    try {
      console.log("🔍 Fetching credits for:", { customerId, businessIdValue });

      const { data: response } = await axios.get(
        `${Base_URL}/customer-payment-history/customer/${customerId}/business/${businessIdValue}/balance`,
        {
          headers: { authorization: `Bearer ${adminInfo.token}` },
        }
      );

      if (response.success && response.data) {
        const creditsData = {};

        if (
          response.data.availableCredits &&
          Array.isArray(response.data.availableCredits)
        ) {
          response.data.availableCredits.forEach((credit) => {
            if (credit.amount > 0) {
              creditsData[credit.currency] = {
                total: credit.amount,
                credits: credit.credits || [],
              };
            }
          });
        }

        const snapshot = cloneCreditsPool(creditsData);
        setCreditPoolBaseline(snapshot);
        setAvailableCredits(cloneCreditsPool(creditsData));

        console.log("✅ Available credits loaded:", {
          currencyCount: Object.keys(creditsData).length,
          totalByCurrency: Object.entries(creditsData).map(([curr, data]) => ({
            currency: curr,
            total: data.total,
            creditCount: data.credits.length,
          })),
        });
      } else {
        console.log("ℹ️ No credits found for customer");
        setCreditPoolBaseline({});
        setAvailableCredits({});
      }
    } catch (error) {
      console.error("❌ Error fetching credits:", error);
      setCreditPoolBaseline({});
      setAvailableCredits({});
    } finally {
      setLoadingCredits(false);
    }
  }, [
    invoice?.customer_id,
    invoice?.business_id,
    invoice?.business,
    businessId,
    adminInfo?.token,
  ]);

  // === MODAL LIFECYCLE ===
  useEffect(() => {
    if (isOpen) {
      fetchAvailableCredits();
    } else {
      resetModalState();
    }
  }, [isOpen, fetchAvailableCredits, resetModalState]);

  // === BANK SELECTION HANDLER ===
  const handleBankSelection = (bankId) => {
    if (!bankId) {
      setForm((prev) => ({
        ...prev,
        depositTo: "",
        currency: invoice?.currency || prev.currency,
      }));
      return;
    }

    const selectedBank = bankAccounts.find((bank) => bank._id === bankId);
    if (selectedBank) {
      setForm((prev) => ({
        ...prev,
        depositTo: bankId,
        currency: selectedBank.currencyType,
      }));
      setErrors((prev) => ({
        ...prev,
        depositTo: undefined,
        currency: undefined,
      }));

      console.log("🏦 Bank selected:", {
        bank: selectedBank.accountName,
        currency: selectedBank.currencyType,
      });
    }
  };

  // === PAYMENT TYPE CHANGE HANDLER ===
  const handlePaymentTypeChange = (newType) => {
    console.log("💰 Payment type changed:", { from: paymentType, to: newType });

    setPaymentType(newType);
    setErrors({});

    if (newType === "cash_only") {
      // Clear applied credits and restore pool from server snapshot (local "apply"
      // reduces availableCredits and would otherwise disable credit tabs).
      setAppliedCredits([]);
      setAvailableCredits(cloneCreditsPool(creditPoolBaseline));
    } else if (newType === "credit_only") {
      // Set cash amount to 0
      setForm((prev) => ({ ...prev, amount: "0" }));
    }
    // For "mixed", keep both credits and allow cash amount
  };

  // === APPLY CREDIT HANDLER ===
  const handleApplyCredit = async (creditAmount, creditCurrency) => {
    console.log("🎯 Applying credit:", { creditAmount, creditCurrency });

    if (!creditAmount || creditAmount <= 0) {
      console.error("❌ Invalid credit amount");
      return;
    }

    try {
      const targetCurrency = form.currency || invoice?.currency || "USD";
      let convertedAmount = creditAmount;
      let conversionDetails = null;

      // Handle currency conversion if needed
      if (creditCurrency !== targetCurrency) {
        console.log("🔄 Converting currency:", {
          from: creditCurrency,
          to: targetCurrency,
          amount: creditAmount,
        });

        // Extract businessId from multiple sources (similar to ProfessionalBulkPaymentModal)
        const businessIdValue =
          businessId?._id ||
          businessId ||
          invoice?.business_id?._id ||
          invoice?.business_id ||
          invoice?.business;

        console.log("🔍 Business ID extraction for credit conversion:", {
          businessIdProp: businessId,
          invoiceBusinessId: invoice?.business_id,
          extractedBusinessId: businessIdValue,
        });

        const conversionResult = await FinancialService.convertCurrency(
          creditCurrency,
          targetCurrency,
          creditAmount,
          businessIdValue
        );

        if (conversionResult.success) {
          convertedAmount = conversionResult.convertedAmount;
          conversionDetails = {
            originalAmount: creditAmount,
            originalCurrency: creditCurrency,
            convertedAmount: convertedAmount,
            targetCurrency: targetCurrency,
            conversionRate: conversionResult.rate,
            conversionDate: new Date().toISOString(),
            source: conversionResult.source,
          };

          console.log("✅ Currency converted:", conversionDetails);
        } else {
          console.warn("⚠️ Currency conversion failed, using 1:1 rate");
          convertedAmount = creditAmount; // Fallback
        }
      }

      // Create new applied credit
      const newCredit = {
        id: `credit_${Date.now()}_${Math.random()}`,
        amount: creditAmount,
        currency: creditCurrency,
        convertedAmount,
        targetCurrency,
        conversionDetails,
        appliedAt: new Date().toISOString(),
      };

      // Add to applied credits
      setAppliedCredits((prev) => [...prev, newCredit]);

      // Update available credits (reduce the applied amount)
      setAvailableCredits((prev) => {
        const updated = { ...prev };
        if (updated[creditCurrency]) {
          const newTotal = Math.max(
            0,
            updated[creditCurrency].total - creditAmount
          );
          if (newTotal > 0) {
            updated[creditCurrency] = {
              ...updated[creditCurrency],
              total: newTotal,
            };
          } else {
            delete updated[creditCurrency]; // Remove if depleted
          }
        }
        return updated;
      });

      // Auto-switch to appropriate payment type
      if (paymentType === "cash_only") {
        setPaymentType("mixed");
      }

      console.log("✅ Credit applied successfully:", newCredit);
    } catch (error) {
      console.error("❌ Error applying credit:", error);
      setErrors((prev) => ({
        ...prev,
        credits: `Failed to apply credit: ${error.message}`,
      }));
    }
  };

  // === REMOVE CREDIT HANDLER ===
  const handleRemoveCredit = (creditIndex) => {
    const creditToRemove = appliedCredits[creditIndex];
    if (!creditToRemove) return;

    console.log("🗑️ Removing credit:", creditToRemove);

    // Remove from applied credits
    setAppliedCredits((prev) =>
      prev.filter((_, index) => index !== creditIndex)
    );

    // Restore to available credits
    setAvailableCredits((prev) => {
      const updated = { ...prev };
      const currency = creditToRemove.currency;

      if (updated[currency]) {
        updated[currency] = {
          ...updated[currency],
          total: updated[currency].total + creditToRemove.amount,
        };
      } else {
        updated[currency] = {
          total: creditToRemove.amount,
          credits: [],
        };
      }

      return updated;
    });

    // Auto-switch payment type if no credits left
    if (appliedCredits.length === 1 && paymentType === "credit_only") {
      setPaymentType("cash_only");
    }

    console.log("✅ Credit removed successfully");
  };

  // === PAYMENT SUMMARY CALCULATION ===
  const calculatePaymentSummary = useCallback(async () => {
    if (!invoice) return;

    try {
      const cashAmount = parseFloat(form.amount) || 0;
      const remainingAmount = invoice.remaining || 0;
      const invoiceCurrency = invoice.currency || "USD";
      const paymentCurrency = form.currency || invoiceCurrency;

      // Calculate total applied credits in invoice currency
      let totalAppliedCreditsInInvoiceCurrency = 0;
      let creditConversions = [];

      for (const credit of appliedCredits) {
        let creditAmountInInvoiceCurrency = credit.amount;

        if (credit.currency !== invoiceCurrency) {
          // Convert to invoice currency for accurate calculation
          try {
            // Extract businessId from multiple sources (similar to ProfessionalBulkPaymentModal)
            const businessIdValue =
              businessId?._id ||
              businessId ||
              invoice?.business_id?._id ||
              invoice?.business_id ||
              invoice?.business;

            const conversion = await FinancialService.convertCurrency(
              credit.currency,
              invoiceCurrency,
              credit.amount,
              businessIdValue
            );
            if (conversion.success) {
              creditAmountInInvoiceCurrency = conversion.convertedAmount;
              creditConversions.push({
                creditId: credit.id,
                originalAmount: credit.amount,
                originalCurrency: credit.currency,
                convertedAmount: creditAmountInInvoiceCurrency,
                targetCurrency: invoiceCurrency,
                rate: conversion.rate,
              });
            }
          } catch (error) {
            console.warn(
              "Currency conversion failed for credit calculation:",
              error
            );
          }
        }

        totalAppliedCreditsInInvoiceCurrency += creditAmountInInvoiceCurrency;
      }

      // Convert cash amount to invoice currency if needed
      let cashAmountInInvoiceCurrency = cashAmount;
      let cashConversion = null;

      if (paymentCurrency !== invoiceCurrency && cashAmount > 0) {
        try {
          // Extract businessId from multiple sources (similar to ProfessionalBulkPaymentModal)
          const businessIdValue =
            businessId?._id ||
            businessId ||
            invoice?.business_id?._id ||
            invoice?.business_id ||
            invoice?.business;

          const conversion = await FinancialService.convertCurrency(
            paymentCurrency,
            invoiceCurrency,
            cashAmount,
            businessIdValue
          );
          if (conversion.success) {
            cashAmountInInvoiceCurrency = conversion.convertedAmount;
            cashConversion = {
              originalAmount: cashAmount,
              originalCurrency: paymentCurrency,
              convertedAmount: cashAmountInInvoiceCurrency,
              targetCurrency: invoiceCurrency,
              rate: conversion.rate,
            };
          }
        } catch (error) {
          console.warn(
            "Currency conversion failed for cash calculation:",
            error
          );
        }
      }

      // Calculate totals
      const totalPaymentInInvoiceCurrency =
        cashAmountInInvoiceCurrency + totalAppliedCreditsInInvoiceCurrency;
      const difference = totalPaymentInInvoiceCurrency - remainingAmount;

      const MONEY_EPS = 0.005;

      // Determine payment type and create summary
      let summary;
      if (Math.abs(difference) < MONEY_EPS) {
        summary = {
          type: "exact",
          message: ciText("Payment covers the exact remaining amount"),
          totalPayment: totalPaymentInInvoiceCurrency,
          cashPaymentAmount: cashAmount,
          cashPaymentCurrency: paymentCurrency,
          cashAmountInInvoiceCurrency,
          appliedCreditsAmount: totalAppliedCreditsInInvoiceCurrency,
          remainingAfterPayment: 0,
          overpaymentAmount: 0,
          paymentCurrency: paymentCurrency,
          invoiceCurrency: invoiceCurrency,
          cashConversion,
          creditConversions,
        };
      } else if (difference > MONEY_EPS) {
        summary = {
          type: "overpayment",
          message: `Payment exceeds remaining amount by ${invoiceCurrency} ${difference.toFixed(
            2
          )}`,
          totalPayment: totalPaymentInInvoiceCurrency,
          cashPaymentAmount: cashAmount,
          cashPaymentCurrency: paymentCurrency,
          cashAmountInInvoiceCurrency,
          appliedCreditsAmount: totalAppliedCreditsInInvoiceCurrency,
          remainingAfterPayment: 0,
          overpaymentAmount: difference,
          overpaymentCurrency: invoiceCurrency,
          paymentCurrency: paymentCurrency,
          invoiceCurrency: invoiceCurrency,
          cashConversion,
          creditConversions,
        };
      } else {
        const remainingAfterPayment = Math.abs(difference);
        summary = {
          type: "underpayment",
          message: `Payment is ${invoiceCurrency} ${remainingAfterPayment.toFixed(
            2
          )} short of remaining amount`,
          totalPayment: totalPaymentInInvoiceCurrency,
          cashPaymentAmount: cashAmount,
          cashPaymentCurrency: paymentCurrency,
          cashAmountInInvoiceCurrency,
          appliedCreditsAmount: totalAppliedCreditsInInvoiceCurrency,
          remainingAfterPayment,
          overpaymentAmount: 0,
          paymentCurrency: paymentCurrency,
          invoiceCurrency: invoiceCurrency,
          cashConversion,
          creditConversions,
        };
      }

      setPaymentSummary(summary);

      console.log("📊 Payment summary calculated:", {
        type: summary.type,
        totalPayment: summary.totalPayment,
        cashAmount: summary.cashPaymentAmount,
        creditsAmount: summary.appliedCreditsAmount,
        remaining: summary.remainingAfterPayment,
        overpayment: summary.overpaymentAmount,
      });
    } catch (error) {
      console.error("❌ Error calculating payment summary:", error);
      setPaymentSummary(null);
    }
  }, [form.amount, form.currency, appliedCredits, invoice]);

  // === RECALCULATE SUMMARY ON CHANGES ===
  useEffect(() => {
    calculatePaymentSummary();
  }, [calculatePaymentSummary]);

  // === FORM VALIDATION ===
  const validate = () => {
    const errs = {};

    if (!form.paymentDate)
      errs.paymentDate = ciText("Payment date is required");
    if (!form.paymentMode)
      errs.paymentMode = ciText("Payment mode is required");

    const cashAmount = parseFloat(form.amount) || 0;
    const hasAppliedCredits = appliedCredits.length > 0;
    const totalCreditsAmount = appliedCredits.reduce(
      (sum, credit) =>
        sum + (credit.conversionDetails?.convertedAmount || credit.amount),
      0
    );

    // Payment type specific validation
    if (paymentType === "cash_only") {
      if (!form.currency) errs.currency = ciText("Currency is required");
      if (cashAmount <= 0)
        errs.amount = ciText("Payment amount must be greater than 0");
    } else if (paymentType === "credit_only") {
      if (!hasAppliedCredits) errs.credits = ciText("No credits applied");
      if (totalCreditsAmount <= 0)
        errs.credits = ciText("Applied credits amount must be greater than 0");
    } else if (paymentType === "mixed") {
      if (!hasAppliedCredits && cashAmount <= 0) {
        errs.general = ciText(
          "Either apply credits or enter a cash payment amount",
        );
      }
      if (cashAmount > 0) {
        if (!form.currency) errs.currency = ciText("Currency is required");
      }
    }

    // Email validation
    if (
      form.emailThankYou &&
      (!form.email || !/\S+@\S+\.\S+/.test(form.email))
    ) {
      errs.email = ciText("Valid email address is required");
    }

    // Total payment validation
    const totalPayment = cashAmount + totalCreditsAmount;
    if (totalPayment <= 0) {
      errs.general = ciText(
        "Total payment (cash + credits) must be greater than 0",
      );
    }

    console.log("🔍 Validation result:", {
      errorCount: Object.keys(errs).length,
      errors: errs,
      paymentType,
      cashAmount,
      totalCreditsAmount,
      totalPayment,
    });

    return errs;
  };

  // === FORM CHANGE HANDLER ===
  const handleChange = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined, general: undefined }));
  };

  // === FILE UPLOAD HANDLER ===
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    console.log("📎 Uploading file:", { name: file.name, size: file.size });

    setUploading(true);
    setUploadSuccess(false);

    const formData = new FormData();
    formData.append("file_path", `Payments/${invoice?._id}`);
    formData.append(
      "business_id",
      businessId?._id ||
        businessId ||
        invoice?.business_id?._id ||
        invoice?.business_id ||
        ""
    );
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
        setSuccessMsg(ciText("File uploaded successfully"));
        setUploadSuccess(true);
        setTimeout(() => {
          setSuccessMsg("");
          setUploadSuccess(false);
        }, 3000);

        console.log("✅ File uploaded successfully");
      }
    } catch (err) {
      console.error("❌ File upload failed:", err);
      setErrors((prev) => ({ ...prev, attachment: ciText("Upload failed") }));
    } finally {
      setUploading(false);
    }
  };

  // === FILE VIEW HANDLER ===
  const handleOpenFile = async (documentId) => {
    try {
      const response = await axios.get(
        `${Base_URL}/documents/getFileWithAllData/${documentId}`
      );
      window.open(response.data.data.url, "_blank");
    } catch (error) {
      console.error("❌ Error opening file:", error);
      setErrors((prev) => ({ ...prev, file: ciText("Error opening file") }));
    }
  };

  // === FORM SUBMISSION ===
  const handleSubmit = async (e) => {
    e.preventDefault();

    const errs = validate();
    setErrors(errs);

    if (Object.keys(errs).length) {
      console.log("❌ Validation failed:", errs);
      return;
    }

    setLoading(true);

    try {
      console.log("🚀 Submitting payment...");

      // Reserve the cash/body payment # with the same atomic generator the server uses,
      // so the value matches the modal preview and is not skipped by a second generate on save (e.g. mixed payments).
      const bizId = businessId?._id || businessId;
      let paymentNumberClaimed = "";
      if (bizId) {
        try {
          const claimRes = await claimDocumentNumber(
            "payment_received",
            bizId,
            null
          );
          paymentNumberClaimed = String(claimRes.data?.nextNumber || "").trim();
          if (paymentNumberClaimed) {
            setPaymentNumberPreview(paymentNumberClaimed);
          }
        } catch (claimErr) {
          console.warn(
            "Could not claim payment receipt # (server will assign on save):",
            claimErr?.response?.data || claimErr.message
          );
        }
      }

      // Prepare comprehensive submission data
      const submitData = {
        // Basic form data
        ...form,

        // Payment type and classification
        paymentType,
        paymentSummary,

        // Credit applications
        appliedCredits: appliedCredits.map((credit, index) => ({
          creditId: credit.id,
          originalAmount: credit.amount,
          originalCurrency: credit.currency,
          convertedAmount:
            credit.conversionDetails?.convertedAmount || credit.amount,
          targetCurrency: credit.targetCurrency,
          conversionDetails: credit.conversionDetails,
          appliedAt: credit.appliedAt,
          applicationOrder: index + 1,
        })),

        // Payment breakdown
        cashPaymentAmount: parseFloat(form.amount) || 0,
        totalAppliedCredits: appliedCredits.reduce(
          (sum, credit) =>
            sum + (credit.conversionDetails?.convertedAmount || credit.amount),
          0
        ),

        // Currency and conversion info
        paymentCurrency: form.currency,
        invoiceCurrency: invoice?.currency,
        requiresCurrencyConversion: form.currency !== invoice?.currency,

        // Overpayment handling
        createsNewCredit: paymentSummary?.type === "overpayment",
        overpaymentAmount: paymentSummary?.overpaymentAmount || 0,

        // Metadata
        submittedAt: new Date().toISOString(),
        submittedBy: adminInfo?.name || ciText("Unknown"),

        ...(paymentNumberClaimed ? { paymentNumber: paymentNumberClaimed } : {}),
      };

      console.log("📤 Submitting payment data:", {
        paymentType: submitData.paymentType,
        cashAmount: submitData.cashPaymentAmount,
        creditsCount: submitData.appliedCredits.length,
        totalCredits: submitData.totalAppliedCredits,
        summaryType: submitData.paymentSummary?.type,
      });

      // Submit to parent component
      await onSubmit(submitData);

      setSuccessMsg(ciText("Payment recorded successfully!"));

      // Close modal after brief delay
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      console.error("❌ Payment submission error:", error);
      setErrors((prev) => ({
        ...prev,
        submit: error.message || ciText("Failed to record payment"),
      }));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const currencyOptions = currencies.map((currency) => ({
    value: currency.symbol,
    label: `${currency.symbol} (${currency.prefix})`,
  }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* === HEADER === */}
        <div className="p-6 pb-4 border-b border-gray-200 relative">
          <button
            className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-2xl focus:outline-none focus:ring-2 focus:ring-[#AFD039]"
            onClick={onClose}
            aria-label={ciText("Close")}
          >
            <X size={24} />
          </button>
          <h2 className="text-xl md:text-2xl font-bold text-gray-800 pr-8">
            {ciText("Record Payment")}
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Invoice #{invoice?.invoice_number} • Remaining:{" "}
            {formatCurrencyAmount(invoice?.currency, invoice?.remaining || 0)}
          </p>
        </div>

        {/* === CONTENT === */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* === PAYMENT TYPE SELECTOR === */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              {ciText("Payment Method")}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {(() => {
                const customerHasFetchedCredits =
                  Object.keys(creditPoolBaseline).length > 0;
                const creditTabsEnabled =
                  loadingCredits || customerHasFetchedCredits;
                return [
                  {
                    id: "cash_only",
                    name: ciText("Record Payment"),
                    description: ciText("Pay with new funds only"),
                    icon: <DollarSign size={20} />,
                    available: true,
                  },
                  {
                    id: "credit_only",
                    name: ciText("Apply Credits Only"),
                    description: ciText("Use available customer credits"),
                    icon: <Wallet size={20} />,
                    available: creditTabsEnabled,
                  },
                  {
                    id: "mixed",
                    name: ciText("Mixed Payment"),
                    description: ciText("Combine credits and new payment"),
                    icon: <ArrowRightLeft size={20} />,
                    available: creditTabsEnabled,
                  },
                ];
              })().map((type) => (
                <div
                  key={type.id}
                  className={`relative cursor-pointer rounded-lg border-2 p-4 transition-all ${
                    paymentType === type.id
                      ? "border-[#AFD039] bg-green-50 ring-2 ring-[#AFD039] ring-opacity-20"
                      : type.available
                      ? "border-gray-200 hover:border-gray-300 hover:shadow-sm"
                      : "border-gray-100 bg-gray-50 cursor-not-allowed opacity-50"
                  }`}
                  onClick={() =>
                    type.available && handlePaymentTypeChange(type.id)
                  }
                >
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <div
                        className={`${
                          paymentType === type.id
                            ? "text-[#AFD039]"
                            : "text-gray-400"
                        }`}
                      >
                        {type.icon}
                      </div>
                    </div>
                    <div className="ml-3 flex-1">
                      <div className="flex items-center">
                        <h4
                          className={`text-sm font-medium ${
                            paymentType === type.id
                              ? "text-green-900"
                              : "text-gray-900"
                          }`}
                        >
                          {type.name}
                        </h4>
                        {paymentType === type.id && (
                          <CheckCircle
                            size={16}
                            className="ml-2 text-[#AFD039]"
                          />
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {type.description}
                      </p>
                      {!type.available && (
                        <p className="text-xs text-red-500 mt-1">
                          {type.id === "credit_only" || type.id === "mixed"
                            ? loadingCredits
                              ? ciText("Loading credits…")
                              : ciText("No credits available")
                            : ciText("Not available")}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* === CREDIT MANAGEMENT SECTION === */}
          {(paymentType === "credit_only" || paymentType === "mixed") && (
            <div className="mb-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-green-800">
                    {ciText("Customer Credits")}
                  </h3>
                  {loadingCredits && (
                    <Loader size={16} className="animate-spin text-green-600" />
                  )}
                </div>

                {/* Applied Credits Summary */}
                {appliedCredits.length > 0 && (
                  <div className="mb-4 p-3 bg-white rounded border border-green-200">
                    <h4 className="text-sm font-medium text-green-700 mb-2">
                      {ciText("Applied Credits")}
                    </h4>
                    <div className="space-y-2">
                      {appliedCredits.map((credit, index) => (
                        <div
                          key={credit.id}
                          className="flex items-center justify-between p-2 bg-green-50 rounded border"
                        >
                          <div className="flex-1">
                            <span className="text-sm font-medium text-green-800">
                              {formatCurrencyAmount(credit.currency, credit.amount)}
                            </span>
                            {credit.conversionDetails && (
                              <div className="text-xs text-green-600">
                                <ArrowRightLeft
                                  size={10}
                                  className="inline mr-1"
                                />
                                Converted to {credit.targetCurrency}{" "}
                                {credit.conversionDetails.convertedAmount.toFixed(
                                  2
                                )}
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveCredit(index)}
                            className="p-1 text-red-600 hover:text-red-800 hover:bg-red-100 rounded"
                          >
                            <Minus size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Available Credits */}
                {Object.keys(availableCredits).length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(availableCredits).map(
                      ([currency, creditData]) => {
                        if (!creditData?.total || creditData.total <= 0)
                          return null;

                        return (
                          <div
                            key={currency}
                            className="flex items-center justify-between p-3 bg-white rounded border border-green-200"
                          >
                            <div className="flex-1">
                              <div className="flex items-center">
                                <span className="font-medium text-gray-900">
                                  {formatCurrencyAmount(currency, creditData.total)}
                                </span>
                                <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                                  {creditData.credits?.length || 1} credits
                                </span>
                              </div>
                              {currency !==
                                (form.currency || invoice?.currency) && (
                                <div className="text-xs text-blue-600 flex items-center mt-1">
                                  <ArrowRightLeft size={10} className="mr-1" />
                                  Will convert to{" "}
                                  {form.currency || invoice?.currency}
                                </div>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                handleApplyCredit(creditData.total, currency)
                              }
                              disabled={creditData.total <= 0}
                              className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Plus size={12} className="inline mr-1" />
                              {ciText("Apply All")}
                            </button>
                          </div>
                        );
                      }
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <Wallet size={24} className="mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500">
                      {ciText("No customer credits available")}
                    </p>
                  </div>
                )}

                {errors.credits && (
                  <p className="text-red-500 text-sm mt-2">{errors.credits}</p>
                )}
              </div>
            </div>
          )}

          {/* === PAYMENT SUMMARY === */}
          {paymentSummary && (
            <div
              className={`mb-6 p-4 rounded-lg border ${
                paymentSummary.type === "exact"
                  ? "bg-green-50 border-green-200"
                  : paymentSummary.type === "overpayment"
                  ? "bg-blue-50 border-blue-200"
                  : "bg-yellow-50 border-yellow-200"
              }`}
            >
              <div className="flex items-start space-x-3">
                {paymentSummary.type === "exact" ? (
                  <CheckCircle size={16} className="text-green-600 mt-0.5" />
                ) : paymentSummary.type === "overpayment" ? (
                  <ArrowRightLeft size={16} className="text-blue-600 mt-0.5" />
                ) : (
                  <AlertTriangle size={16} className="text-yellow-600 mt-0.5" />
                )}
                <div className="flex-1">
                  <h4
                    className={`font-medium mb-1 ${
                      paymentSummary.type === "exact"
                        ? "text-green-800"
                        : paymentSummary.type === "overpayment"
                        ? "text-blue-800"
                        : "text-yellow-800"
                    }`}
                  >
                    {ciText("Payment Summary")}
                  </h4>
                  <p className="text-sm mb-2">{paymentSummary.message}</p>

                  {/* Payment Breakdown */}
                  <div className="text-xs space-y-1">
                    {paymentSummary.cashPaymentAmount > 0 && (
                      <div>
                        <strong>{ciText("Cash Payment:")}</strong>{" "}
                        {paymentSummary.cashPaymentCurrency}{" "}
                        {paymentSummary.cashPaymentAmount.toFixed(2)}
                        {paymentSummary.cashConversion && (
                          <span className="text-gray-600 ml-1">
                            (= {paymentSummary.invoiceCurrency}{" "}
                            {paymentSummary.cashAmountInInvoiceCurrency.toFixed(
                              2
                            )}
                            )
                          </span>
                        )}
                      </div>
                    )}
                    {paymentSummary.appliedCreditsAmount > 0 && (
                      <div>
                        <strong>{ciText("Applied Credits:")}</strong>{" "}
                        {paymentSummary.invoiceCurrency}{" "}
                        {paymentSummary.appliedCreditsAmount.toFixed(2)}
                      </div>
                    )}
                    <div>
                      <strong>{ciText("Total Payment:")}</strong>{" "}
                      {paymentSummary.invoiceCurrency}{" "}
                      {paymentSummary.totalPayment.toFixed(2)}
                    </div>
                  </div>

                  {/* Special Messages */}
                  {paymentSummary.type === "overpayment" &&
                    paymentSummary.overpaymentAmount > 0 && (
                      <div className="mt-2 text-xs font-medium text-blue-700">
                        <DollarSign size={12} className="inline mr-1" />
                        Overpayment of {paymentSummary.overpaymentCurrency}{" "}
                        {paymentSummary.overpaymentAmount.toFixed(2)} will be
                        added to customer credits
                      </div>
                    )}

                  {paymentSummary.type === "underpayment" &&
                    paymentSummary.remainingAfterPayment > 0 && (
                      <div className="mt-2 text-xs font-medium text-yellow-700">
                        <AlertTriangle size={12} className="inline mr-1" />
                        Remaining balance: {paymentSummary.invoiceCurrency}{" "}
                        {paymentSummary.remainingAfterPayment.toFixed(2)} will
                        stay outstanding
                      </div>
                    )}
                </div>
              </div>
            </div>
          )}

          {/* === PAYMENT FORM === */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Payment Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {ciText("Payment Date *")}
                </label>
                <CustomDatePicker
                  value={form.paymentDate}
                  onChange={(val) => handleChange("paymentDate", val)}
                />
                {errors.paymentDate && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.paymentDate}
                  </p>
                )}
              </div>

              {/* Payment Mode */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {ciText("Payment Mode *")}
                </label>
                <DropdownBasic
                  value={form.paymentMode}
                  onChange={(val) => handleChange("paymentMode", val)}
                  options={[
                    { value: "Bank Transfer", label: ciText("Bank Transfer") },
                    { value: "Cash", label: ciText("Cash") },
                    { value: "Cheque", label: ciText("Cheque") },
                    { value: "Credit Card", label: ciText("Credit Card") },
                    { value: "Customer Credit", label: ciText("Customer Credit") },
                  ]}
                  placeholder={ciText("Select Payment Mode")}
                />
                {errors.paymentMode && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.paymentMode}
                  </p>
                )}
              </div>

              {/* Bank Account - For cash payments and mixed payments */}
              {(paymentType === "cash_only" || paymentType === "mixed") && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {ciText("Deposit To Bank Account")} ({ciText("Optional")})
                  </label>
                  <select
                    value={form.depositTo}
                    onChange={(e) => handleBankSelection(e.target.value)}
                    disabled={loadingBankData}
                    className={`block w-full rounded-lg border ${
                      errors.depositTo ? "border-red-300" : "border-gray-300"
                    } px-3 py-2.5 text-sm focus:border-[#AFD039] focus:outline-none focus:ring-1 focus:ring-[#AFD039] disabled:bg-gray-100`}
                  >
                    <option value="">
                      {loadingBankData ? ciText("Loading...") : ciText("Select Bank Account")}
                    </option>
                    {bankAccounts.map((account) => (
                      <option key={account._id} value={account._id}>
                        {account.accountName} ({account.bankName}) -{" "}
                        {account.currencyType}
                      </option>
                    ))}
                  </select>
                  {errors.depositTo && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.depositTo}
                    </p>
                  )}
                </div>
              )}

              {/* Payment Amount - Only for cash payments */}
              {(paymentType === "cash_only" || paymentType === "mixed") && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {ciText("Cash Payment Amount")} ({form.currency || ciText("Select Bank")}){" "}
                    {paymentType === "mixed" ? "(Optional)" : "*"}
                  </label>
                  <input
                    type="number"
                    value={form.amount}
                    onChange={(e) => handleChange("amount", e.target.value)}
                    placeholder={`0.00 ${form.currency || ""}`}
                    min="0"
                    step="0.01"
                    className={`block w-full rounded-lg border ${
                      errors.amount ? "border-red-300" : "border-gray-300"
                    } px-3 py-2.5 text-sm placeholder-gray-400 focus:border-[#AFD039] focus:outline-none focus:ring-1 focus:ring-[#AFD039]`}
                  />
                  {form.currency &&
                    form.currency !== invoice?.currency &&
                    parseFloat(form.amount) > 0 && (
                      <div className="mt-2 p-2 bg-blue-50 rounded text-xs">
                        <div className="flex items-center gap-1 text-blue-700">
                          <ArrowRightLeft size={12} />
                          <span className="font-medium">
                            {ciText("Currency Conversion:")}
                          </span>
                        </div>
                        <div className="text-blue-600">
                        {formatCurrencyAmount(form.currency, form.amount)} →{" "}
                        {invoice?.currency}
                          (live rate applied)
                        </div>
                      </div>
                    )}
                  {errors.amount && (
                    <p className="text-red-500 text-xs mt-1">{errors.amount}</p>
                  )}
                </div>
              )}

              {paymentNumberPreview && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {ciText("Payment Receipt #")}
                  </label>
                  <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 font-mono text-sm">
                    {paymentNumberPreview}
                  </div>
                </div>
              )}

              {/* Reference */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {ciText("Reference")}
                </label>
                <InputField
                  value={form.reference}
                  onChange={(e) => handleChange("reference", e.target.value)}
                  placeholder={ciText("Payment reference")}
                />
              </div>

              {/* Bank Charges */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {ciText("Bank Charges")}
                </label>
                <InputField
                  type="number"
                  value={form.bankCharges}
                  onChange={(e) => handleChange("bankCharges", e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>

              {/* Tax Deduction */}
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {ciText("Tax Deducted?")}
                </label>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={!form.taxDeducted}
                      onChange={() => handleChange("taxDeducted", false)}
                      className="mr-2"
                    />
                    {ciText("No Tax deducted")}
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={form.taxDeducted}
                      onChange={() => handleChange("taxDeducted", true)}
                      className="mr-2"
                    />
                    {ciText("Yes, TDS")}
                  </label>
                </div>
              </div>

              {/* TDS Type */}
              {form.taxDeducted && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {ciText("TDS Type")}
                  </label>
                  <InputField
                    value={form.tdsType}
                    onChange={(e) => handleChange("tdsType", e.target.value)}
                    placeholder={ciText("TDS Type")}
                  />
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {ciText("Notes")}
              </label>
              <InputField
                value={form.notes}
                onChange={(e) => handleChange("notes", e.target.value)}
                placeholder={ciText("Additional notes about this payment")}
              />
            </div>

            {/* File Attachment */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {ciText("Attachment")}
              </label>
              <div
                className={`border-2 rounded-xl p-6 flex flex-col items-center justify-center transition-all duration-200 ${
                  errors.attachment
                    ? "border-red-400 bg-red-50"
                    : uploadSuccess
                    ? "border-green-400 bg-green-50"
                    : "border-dashed border-[#AFD039] bg-gray-50 hover:bg-gray-100"
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
                  className="cursor-pointer flex items-center gap-2 text-[#AFD039] hover:text-[#7fa02a] font-medium"
                >
                  {uploading ? (
                    <Loader size={20} className="animate-spin" />
                  ) : (
                    <FileText size={20} />
                  )}
                  {uploading ? ciText("Uploading...") : ciText("Upload Payment Attachment")}
                </label>

                {form.attachment && (
                  <div className="mt-3 p-3 bg-white rounded-md w-full flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      {form.attachment.name}
                    </span>
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={() => handleOpenFile(form.attachment.fileId)}
                        className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                      >
                        <Eye size={12} className="inline mr-1" />
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

            {/* Email Thank You */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={form.emailThankYou}
                  onChange={() =>
                    handleChange("emailThankYou", !form.emailThankYou)
                  }
                  className="mr-2"
                />
                {ciText("Email a \"Thank you\" note for this payment")}
              </label>
              {form.emailThankYou && (
                <div className="w-full sm:ml-4">
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    placeholder={ciText("Email address")}
                    className={`block w-full rounded-lg border ${
                      errors.email ? "border-red-300" : "border-gray-300"
                    } px-3 py-2 text-sm placeholder-gray-400 focus:border-[#AFD039] focus:outline-none focus:ring-1 focus:ring-[#AFD039]`}
                  />
                  {errors.email && (
                    <p className="text-red-500 text-xs mt-1">{errors.email}</p>
                  )}
                </div>
              )}
            </div>

            {/* General Error */}
            {errors.general && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 text-sm">{errors.general}</p>
              </div>
            )}

            {/* Submit Error */}
            {errors.submit && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 text-sm">{errors.submit}</p>
              </div>
            )}
          </form>
        </div>

        {/* === FOOTER === */}
        <div className="p-6 pt-4 border-t border-gray-200 bg-white">
          <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="w-full sm:w-auto px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium focus:outline-none focus:ring-2 focus:ring-[#AFD039] disabled:opacity-50"
            >
              {ciText("Cancel")}
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={loading}
              className="w-full sm:w-auto px-6 py-2 bg-[#AFD039] text-white rounded-lg hover:bg-[#9aba33] font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-[#AFD039] disabled:opacity-50 flex items-center justify-center"
            >
              {loading && <Loader size={16} className="animate-spin mr-2" />}
              {ciText("Record Payment")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
