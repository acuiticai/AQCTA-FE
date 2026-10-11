import React, { useState, useEffect, useContext, useRef, useMemo } from "react";
import {
  ArrowLeft,
  Edit,
  FileText,
  Eye,
  Download,
  X,
  Upload,
  Calendar,
  DollarSign,
  Users,
  Building,
  CreditCard,
  Package,
  Clock,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  Banknote,
  Calculator,
  ChevronUp,
  Edit3,
  Plus,
  Wallet,
  AlertTriangle,
  Receipt,
  Trash2,
} from "lucide-react";
import SearchableDropdown from "@/components/SearchableDropdown";
import { useHistory, useParams } from "react-router-dom";
import axios from "axios";
import { AdminContext } from "@/context/AdminContext";
import { notifyError, notifySuccess } from "@/utils/toast";
import {
  formatDate,
  formatAmount,
  formatCurrencyAmount,
  formatQuantity,
} from "@/components/formatAmount";
import BackButton from "@/components/BackButton";
import {
  resolveCnDnLineFigures,
  summarizeCnDnLines,
  formatLinePercentCell,
} from "@/utils/creditDebitNoteLineView";
import { useTranslation } from "react-i18next";
import {
  makeCreditNoteT,
  translateCreditNoteStatus,
} from "@/utils/creditDebitNoteI18n";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const statusConfig = {
  Draft: {
    color: "bg-gray-100 text-gray-800 border-gray-300",
    icon: Edit3,
    bgColor: "bg-gray-50",
    textColor: "text-gray-700",
    description: "Credit note is being prepared",
  },
  Created: {
    color: "bg-blue-100 text-blue-800 border-blue-300",
    icon: FileText,
    bgColor: "bg-blue-50",
    textColor: "text-blue-700",
    description: "Credit note has been created and submitted",
  },
  "Approved by Management": {
    color: "bg-green-100 text-green-800 border-green-300",
    icon: CheckCircle,
    bgColor: "bg-green-50",
    textColor: "text-green-700",
    description: "Credit note has been approved by management",
  },
  "Make Transaction": {
    color: "bg-orange-100 text-orange-800 border-orange-300",
    icon: Clock,
    bgColor: "bg-orange-50",
    textColor: "text-orange-700",
    description: "Payment details prepared, awaiting final approval",
  },
  "Approve Transaction": {
    color: "bg-purple-100 text-purple-800 border-purple-300",
    icon: DollarSign,
    bgColor: "bg-purple-50",
    textColor: "text-purple-700",
    description: "Payment completed and funds deducted",
  },
  "Applied to Invoice": {
    color: "bg-cyan-100 text-cyan-800 border-cyan-300",
    icon: Receipt,
    bgColor: "bg-cyan-50",
    textColor: "text-cyan-700",
    description: "Credit has been applied to customer invoice",
  },
  Cancelled: {
    color: "bg-red-100 text-red-800 border-red-300",
    icon: AlertCircle,
    bgColor: "bg-red-50",
    textColor: "text-red-700",
    description: "Credit note has been cancelled",
  },
};

// Dynamic status transitions based on credit note type
const getValidStatusTransitions = (creditNoteType) => {
  if (creditNoteType === "apply_to_invoice") {
    return {
      Draft: ["Created", "Cancelled"],
      Created: ["Approved by Management", "Cancelled"],
      "Approved by Management": ["Applied to Invoice", "Cancelled"],
      "Applied to Invoice": [],
      Cancelled: [],
    };
  } else {
    // refund_to_client
    return {
      Draft: ["Created", "Cancelled"],
      Created: ["Approved by Management", "Cancelled"],
      "Approved by Management": ["Make Transaction", "Cancelled"],
      "Make Transaction": ["Approve Transaction", "Cancelled"],
      "Approve Transaction": [],
      Cancelled: [],
    };
  }
};

export default function ViewCreditNote() {
  const { t } = useTranslation();
  const cn = makeCreditNoteT(t);
  const history = useHistory();
  const { id } = useParams();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const fileInputRef = useRef(null);

  const [creditNote, setCreditNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [bankAccounts, setBankAccounts] = useState([]);
  const [selectedBankAccount, setSelectedBankAccount] = useState(null);
  const [conversionDetails, setConversionDetails] = useState(null);
  const [showConversionModal, setShowConversionModal] = useState(false);
  const [isLoadingConversion, setIsLoadingConversion] = useState(false);
  const [isPaymentAccountCollapsed, setIsPaymentAccountCollapsed] =
    useState(false);
  const [isCurrencyConversionCollapsed, setIsCurrencyConversionCollapsed] =
    useState(true);

  const lineRollup = useMemo(
    () => summarizeCnDnLines(creditNote?.items),
    [creditNote?.items]
  );
  const taxPercent = useMemo(() => {
    const base = Number(lineRollup.totalNetExTax) || 0;
    if (base <= 0) return null;
    const pct = ((Number(lineRollup.totalTax) || 0) / base) * 100;
    if (!Number.isFinite(pct)) return null;
    return pct;
  }, [lineRollup.totalNetExTax, lineRollup.totalTax]);
  const documentDiscountPercent = useMemo(() => {
    const explicit = Number(creditNote?.discountPercentage);
    if (Number.isFinite(explicit)) return explicit;
    const subtotal = Number(creditNote?.subtotal) || 0;
    const discountAmount = Number(creditNote?.discountAmount) || 0;
    if (subtotal <= 0 || discountAmount <= 0) return null;
    const pct = (discountAmount / subtotal) * 100;
    if (!Number.isFinite(pct)) return null;
    return pct;
  }, [creditNote?.discountAmount, creditNote?.discountPercentage, creditNote?.subtotal]);

  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo.token}`,
  };

  // Currency conversion function
  const getCurrencyConversion = async (fromCurrency, toCurrency, amount) => {
    if (!fromCurrency || !toCurrency || !amount || amount <= 0) {
      const error = `Invalid conversion parameters: from=${fromCurrency}, to=${toCurrency}, amount=${amount}`;
      console.error(`[Frontend] ${error}`);
      throw new Error("Invalid currency conversion parameters");
    }

    if (fromCurrency === toCurrency) {
      return {
        rate: 1,
        convertedAmount: amount,
        displayText: cn("detail.sameCurrencyText", "{{amount}} {{from}} = {{amount}} {{to}} (Same Currency)", { amount, from: fromCurrency, to: toCurrency }),
        rateDisplayText: cn("detail.sameCurrencyRateDisplay", "1 {{from}} = 1 {{to}}", { from: fromCurrency, to: toCurrency }),
        isRealTime: true,
        source: "same_currency",
      };
    }

    setIsLoadingConversion(true);
    try {
      console.log(
        `[Frontend] Converting: ${amount} ${fromCurrency} to ${toCurrency}`
      );

      console.log("💱 Converting:", fromCurrency, toCurrency, amount);

      const response = await axios.get(`${Base_URL}/currency/convert`, {
        params: { from: fromCurrency, to: toCurrency, amount },
        headers: {
          authorization: `Bearer ${adminInfo.token}`,
        },
      });

      console.log("[Frontend] Conversion API response:", response.data);

      if (response.data.success) {
        const { rate, convertedAmount, isRealTime, source } = response.data;

        const conversionInfo = {
          rate,
          convertedAmount,
          displayText: cn("detail.conversionDisplayText", "{{amount}} {{from}} = {{converted}} {{to}} (Rate: {{rate}})", { amount, from: fromCurrency, converted: convertedAmount.toFixed(2), to: toCurrency, rate }),
          rateDisplayText: cn("detail.rateDisplayText", "1 {{from}} = {{rate}} {{to}}", { from: fromCurrency, rate, to: toCurrency }),
          isRealTime,
          source,
        };

        console.log("[Frontend] Processed conversion:", conversionInfo);
        return conversionInfo;
      } else {
        throw new Error(response.data.error || "Conversion failed");
      }
    } catch (error) {
      console.error("[Frontend] Currency conversion error:", error);
      throw new Error(
        error.response?.data?.error ||
          error.message ||
          "Failed to get currency conversion"
      );
    } finally {
      setIsLoadingConversion(false);
    }
  };

  // Helper function to calculate conversion for an account
  const calculateConversionForAccount = async (account) => {
    if (!creditNote || !account) {
      console.log(
        "❌ Cannot calculate conversion - missing credit note or account"
      );
      return;
    }

    console.log("🔄 Calculating conversion for account:", account.accountName);
    console.log("Account currency:", account.currencyType);
    console.log("Credit note currency:", creditNote.currency);
    console.log("Credit note total:", creditNote.total);

    if (account.currencyType !== creditNote.currency) {
      console.log(
        "💱 Different currencies, fetching conversion rate...",
        creditNote.currency,
        account.currencyType
      );
      try {
        const conversion = await getCurrencyConversion(
          creditNote.currency,
          account.currencyType,
          creditNote.total
        );

        console.log("✅ Conversion result:", conversion);

        const conversionData = {
          fromCurrency: creditNote.currency,
          toCurrency: account.currencyType,
          creditNoteAmount: creditNote.total,
          accountCurrency: account.currencyType,
          requiredAmount: conversion.convertedAmount,
          exchangeRate: conversion.rate,
          accountBalance: account.openingBalance || account.balance,
          hasSufficientFunds:
            (account.openingBalance || account.balance) >=
            conversion.convertedAmount,
          displayText: conversion.displayText,
          rateDisplayText: conversion.rateDisplayText,
          isRealTime: conversion.isRealTime,
          source: conversion.source,
          isConversion: true,
        };

        console.log("🎯 Setting conversion details:", conversionData);
        setConversionDetails(conversionData);
      } catch (error) {
        console.error("❌ Currency conversion failed:", error);
        notifyError(cn("toasts.exchangeRateFailed", "Failed to get exchange rate: {{message}}", { message: error.message }));
      }
    } else {
      // Same currency case
      console.log("💰 Same currencies, no conversion needed");
      const sameCurrencyData = {
        fromCurrency: account.currencyType,
        toCurrency: creditNote.currency,
        creditNoteAmount: creditNote.total,
        accountCurrency: account.currencyType,
        requiredAmount: creditNote.total,
        exchangeRate: 1,
        accountBalance: account.openingBalance || account.balance,
        hasSufficientFunds:
          (account.openingBalance || account.balance) >= creditNote.total,
        displayText: cn("detail.sameCurrencyText", "{{amount}} {{from}} = {{amount}} {{to}} (Same Currency)", { amount: creditNote.total, from: creditNote.currency, to: account.currencyType }),
        isConversion: false,
      };

      console.log("🎯 Setting same currency details:", sameCurrencyData);
      setConversionDetails(sameCurrencyData);
    }
  };

  useEffect(() => {
    fetchCreditNote();
  }, [id]);

  // Fetch bank accounts when credit note is loaded and preselect existing bank account
  useEffect(() => {
    const fetchBankAccounts = async () => {
      if (creditNote?.business?._id || creditNote?.business) {
        try {
          const businessId = creditNote.business?._id || creditNote.business;
          console.log("🏦 Fetching bank accounts for business:", businessId);

          const response = await axios.get(
            `${Base_URL}/bank-management/accounts`,
            {
              params: { business: businessId },
              headers: {
                authorization: `Bearer ${adminInfo.token}`,
              },
            }
          );
          setBankAccounts(response.data.accounts || []);
          console.log(
            "🏦 Bank accounts fetched:",
            response.data.accounts?.length || 0
          );

          // Preselect existing bank account if available
          if (creditNote.paidFromBankAccount) {
            console.log(
              "🔍 Looking for pre-selected bank account:",
              creditNote.paidFromBankAccount
            );

            let existingAccount = response.data.accounts?.find(
              (acc) =>
                acc._id === creditNote.paidFromBankAccount._id ||
                acc._id === creditNote.paidFromBankAccount
            );

            // If not found in business accounts, try fetching all accounts
            if (!existingAccount && creditNote.paidFromBankAccount._id) {
              console.log(
                "🔄 Account not found in business accounts, fetching all accounts..."
              );
              try {
                const allAccountsResponse = await axios.get(
                  `${Base_URL}/bank-management/accounts`,
                  {
                    headers: {
                      authorization: `Bearer ${adminInfo.token}`,
                    },
                  }
                );
                const allAccounts = allAccountsResponse.data.accounts || [];
                existingAccount = allAccounts.find(
                  (acc) => acc._id === creditNote.paidFromBankAccount._id
                );
                if (existingAccount) {
                  console.log(
                    "✅ Found account in all accounts:",
                    existingAccount.accountName
                  );
                }
              } catch (error) {
                console.error("Error fetching all accounts:", error);
              }
            }

            if (existingAccount) {
              console.log(
                "✅ Pre-selected bank account found:",
                existingAccount.accountName
              );
              setSelectedBankAccount(existingAccount);

              // Calculate conversion details for pre-selected bank account
              console.log("🔄 Triggering conversion calculation...");

              // Use setTimeout to ensure state is updated
              setTimeout(async () => {
                await calculateConversionForAccount(existingAccount);
              }, 500);
            } else {
              console.log(
                "❌ Pre-selected bank account not found in available accounts"
              );
            }
          } else {
            console.log("ℹ️ No pre-selected bank account found");
          }
        } catch (error) {
          console.error("❌ Error fetching bank accounts:", error);
        }
      }
    };

    if (creditNote) {
      console.log("📄 Credit note loaded, fetching bank accounts...");
      fetchBankAccounts();
    }
  }, [creditNote]);

  // Additional useEffect to ensure conversion details are calculated for pre-selected accounts
  useEffect(() => {
    if (creditNote && selectedBankAccount && !conversionDetails) {
      console.log("🔄 Recalculating conversion for selected bank account...");
      calculateConversionForAccount(selectedBankAccount);
    }
  }, [creditNote, selectedBankAccount]);

  const fetchCreditNote = async () => {
    try {
      const response = await axios.get(`${Base_URL}/credit-notes/${id}`, {
        headers,
      });
      if (response.data.success) {
        setCreditNote(response.data.data);
        setSelectedStatus(response.data.data.status);
      }
    } catch (error) {
      console.error("Error fetching credit note:", error);
      notifyError(cn("toasts.loadOneFailed", "Failed to load credit note"));
      history.push("/credit-notes");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      Draft: "bg-gray-100 text-gray-800",
      Created: "bg-blue-100 text-blue-800",
      "Approved by Management": "bg-green-100 text-green-800",
      "Make Transaction": "bg-yellow-100 text-yellow-800",
      "Approve Transaction": "bg-purple-100 text-purple-800",
      "Applied to Invoice": "bg-cyan-100 text-cyan-800",
      Cancelled: "bg-red-100 text-red-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const getCreditNoteTypeColor = (type) => {
    const colors = {
      apply_to_invoice: "bg-blue-100 text-blue-800",
      refund_to_client: "bg-green-100 text-green-800",
    };
    return colors[type] || "bg-gray-100 text-gray-800";
  };

  const getCreditNoteTypeLabel = (type, entityType) => {
    if (type === "apply_to_invoice") {
      return cn("types.applyToInvoice", "Apply to Invoice");
    }
    if (type === "refund_to_client") {
      return entityType === "customer"
        ? cn("types.refundToClient", "Refund to Client")
        : cn("types.refundToVendor", "Refund to Vendor");
    }
    return type;
  };

  const getValidTransitions = (currentStatus) => {
    if (!creditNote) return [];

    const validTransitions = getValidStatusTransitions(
      creditNote.creditNoteType
    );
    return validTransitions[currentStatus] || [];
  };

  const handleStatusChange = (e) => {
    const newStatus = e.target.value;
    setSelectedStatus(newStatus);

    // Reset bank account and conversion when status changes, unless we're keeping the preselected account
    if (newStatus === "Approve Transaction" && creditNote.paidFromBankAccount) {
      // Keep preselected bank account for Approve Transaction if it exists
      return;
    }

    // Reset for other status changes
    setSelectedBankAccount(null);
    setConversionDetails(null);
  };

  const handleBankAccountChange = async (accountId) => {
    if (!accountId) {
      setSelectedBankAccount(null);
      setConversionDetails(null);
      return;
    }

    const account = bankAccounts.find((acc) => acc._id === accountId);
    if (!account) {
      notifyError(cn("toasts.bankAccountNotFound", "Bank account not found"));
      return;
    }

    setSelectedBankAccount(account);

    // Calculate conversion if currencies differ
    if (creditNote && account.currencyType !== creditNote.currency) {
      console.log(
        `[Frontend] Starting conversion: ${creditNote.total} ${creditNote.currency} from ${account.currencyType}`
      );

      // Validate parameters before calling conversion
      if (
        !account.currencyType ||
        !creditNote.currency ||
        !creditNote.total ||
        creditNote.total <= 0
      ) {
        console.error("[Frontend] Missing or invalid conversion parameters:", {
          accountCurrency: account.currencyType,
          creditNoteCurrency: creditNote.currency,
          creditNoteTotal: creditNote.total,
        });

        let missingParams = [];
        if (!account.currencyType) missingParams.push("account currency");
        if (!creditNote.currency) missingParams.push("credit note currency");
        if (!creditNote.total || creditNote.total <= 0)
          missingParams.push("valid credit note amount");

        notifyError(
          `Cannot convert currency - missing: ${missingParams.join(", ")}`
        );
        return;
      }

      try {
        const conversion = await getCurrencyConversion(
          creditNote.currency,
          account.currencyType,
          creditNote.total
        );

        setConversionDetails({
          fromCurrency: creditNote.currency,
          toCurrency: account.currencyType,
          creditNoteAmount: creditNote.total,
          accountCurrency: account.currencyType,
          requiredAmount: conversion.convertedAmount,
          exchangeRate: conversion.rate,
          accountBalance: account.openingBalance || account.balance,
          hasSufficientFunds:
            (account.openingBalance || account.balance) >=
            conversion.convertedAmount,
          displayText: conversion.displayText,
          rateDisplayText: conversion.rateDisplayText,
          isRealTime: conversion.isRealTime,
          source: conversion.source,
          isConversion: true,
        });
      } catch (error) {
        console.error("[Frontend] Currency conversion failed:", error);
        notifyError(cn("toasts.exchangeRateFailed", "Failed to get exchange rate: {{message}}", { message: error.message }));
      }
    } else {
      // Same currency, no conversion needed
      const accountBalance = account.openingBalance || account.balance;
      setConversionDetails({
        fromCurrency: creditNote.currency,
        toCurrency: account.currencyType,
        creditNoteAmount: creditNote.total,
        accountCurrency: account.currencyType,
        requiredAmount: creditNote.total,
        exchangeRate: 1,
        accountBalance: accountBalance,
        hasSufficientFunds: accountBalance >= creditNote.total,
        displayText: cn("detail.sameCurrencyText", "{{amount}} {{from}} = {{amount}} {{to}} (Same Currency)", { amount: creditNote.total, from: creditNote.currency, to: account.currencyType }),
        isConversion: false,
      });
    }
  };

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
  };

  const handleUploadAndStatusUpdate = async () => {
    if (!selectedStatus || selectedStatus === creditNote.status) {
      notifyError(cn("toasts.selectNewStatus", "Please select a new status"));
      return;
    }

    // Validation for status transitions that require bank account (only for refund_to_client)
    if (
      (selectedStatus === "Make Transaction" ||
        selectedStatus === "Approve Transaction") &&
      creditNote.creditNoteType === "refund_to_client" &&
      !selectedBankAccount &&
      !creditNote.paidFromBankAccount
    ) {
      notifyError(cn("toasts.selectBankAccountForPayment", "Please select a bank account for payment"));
      return;
    }

    // Validation for insufficient funds (only for refund_to_client)
    if (
      conversionDetails &&
      !conversionDetails.hasSufficientFunds &&
      creditNote.creditNoteType === "refund_to_client" &&
      (selectedStatus === "Make Transaction" ||
        selectedStatus === "Approve Transaction")
    ) {
      notifyError(
        `Insufficient funds. Required: ${
          conversionDetails.fromCurrency
        } ${conversionDetails.requiredAmount.toFixed(2)}, Available: ${
          conversionDetails.fromCurrency
        } ${conversionDetails.accountBalance.toFixed(2)}`
      );
      return;
    }

    setStatusUpdating(true);
    setUploading(true);

    try {
      let documentData = null;

      // Upload document if provided
      if (selectedFile) {
        const formDataForUpload = new FormData();
        formDataForUpload.append(
          "file_path",
          `CreditNotes/${creditNote.creditNoteNumber}`
        );
        formDataForUpload.append("business_id", creditNote.business._id);
        formDataForUpload.append("customer_id", adminInfo?.id);
        formDataForUpload.append("file_type", selectedFile.type);
        formDataForUpload.append("file_size", selectedFile.size);
        formDataForUpload.append("file", selectedFile);

        const uploadResponse = await axios.post(
          `${Base_URL}/documents/uploadDocument`,
          formDataForUpload,
          {
            headers: { "Content-Type": "multipart/form-data" },
            onUploadProgress: (progressEvent) => {
              const percentCompleted = Math.round(
                (progressEvent.loaded * 100) / progressEvent.total
              );
              setUploadProgress(percentCompleted);
            },
          }
        );

        if (uploadResponse.data.message === "File uploaded successfully") {
          const uploadedFile = uploadResponse.data.file;
          console.log("Upload response file:", uploadedFile);

          documentData = {
            fileId: uploadedFile._id,
            name: uploadedFile.name,
            url: uploadedFile.url || uploadedFile.downloadUrl || "#",
            downloadUrl: uploadedFile.downloadUrl || uploadedFile.url || "#",
            uploadedAt: new Date().toISOString(),
            status: selectedStatus,
            documentType: "Supporting",
            description: `Status change document - ${selectedStatus}`,
            size: selectedFile.size,
            type: selectedFile.type,
          };

          console.log("Document data being sent:", documentData);
        }
      }

      // Prepare update data with bank account information for payment statuses (only for refund_to_client)
      const updateData = {
        status: selectedStatus,
        ...(documentData && { documents: documentData }),
        ...((selectedStatus === "Make Transaction" ||
          selectedStatus === "Approve Transaction") &&
          creditNote.creditNoteType === "refund_to_client" &&
          (selectedBankAccount || creditNote.paidFromBankAccount) && {
            paidFromBankAccount:
              selectedBankAccount?._id ||
              creditNote.paidFromBankAccount?._id ||
              creditNote.paidFromBankAccount,
            conversionDetails: conversionDetails,
          }),
      };

      // Update credit note status with or without document
      const updateResponse = await axios.put(
        `${Base_URL}/credit-notes/${creditNote._id}`,
        updateData,
        {
          headers: {
            "Content-Type": "application/json",
            authorization: `Bearer ${adminInfo.token}`,
          },
        }
      );

      if (updateResponse.data.success) {
        setUploadSuccess(true);
        setSuccessMessage(
          documentData
            ? cn("toasts.statusUpdatedWithDocument", "Status updated and document uploaded successfully!")
            : cn("toasts.statusUpdated", "Status updated successfully!")
        );
        setTimeout(() => {
          setUploadSuccess(false);
          setSuccessMessage("");
          window.location.reload();
        }, 2000);
      }
    } catch (error) {
      console.error("Upload error:", error);
      notifyError(
        error.response?.data?.error ||
          cn("toasts.statusUpdateFailed", "Failed to update status or upload document")
      );
    } finally {
      setStatusUpdating(false);
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleOpenFile = async (documentId) => {
    if (!documentId) return;
    try {
      const response = await axios.get(
        `${Base_URL}/documents/getFileWithAllData/${documentId}`
      );
      window.open(response.data.data.url, "_blank");
    } catch (error) {
      notifyError(cn("toasts.openFileFailed", "Error opening file"));
      console.error("Error: ", error);
    }
  };

  const handleDownloadFile = async (documentId) => {
    try {
      const response = await axios.get(
        `${Base_URL}/documents/getFileWithAllData/${documentId}`
      );
      const fileUrl = response.data.data.downloadUrl || response.data.data.url;
      const fileName = response.data.data.name;

      await downloadFileFromUrl(fileUrl, fileName);
    } catch (error) {
      console.error("Error downloading file:", error);
      notifyError(cn("toasts.downloadFailed", "Failed to download file"));
    }
  };

  const downloadFileFromUrl = async (url, filename) => {
    try {
      const response = await fetch(url, { credentials: "include" });
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename || "download";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error("Error downloading file:", error);
      notifyError(cn("toasts.downloadFailed", "Failed to download file"));
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--p-blue)]"></div>
      </div>
    );
  }

  if (!creditNote) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-500 text-lg">{cn("detail.notFound", "Credit note not found")}</p>
          <button
            onClick={() => history.push("/credit-notes")}
            className="mt-4 px-4 py-2 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[#9CBA33] transition-colors"
          >
            {cn("actions.backToCreditNotes", "Back to Credit Notes")}
          </button>
        </div>
      </div>
    );
  }

  // Different status timelines based on credit note type
  const getStatusTimeline = (creditNoteType) => {
    if (creditNoteType === "apply_to_invoice") {
      return [
        "Draft",
        "Created",
        "Approved by Management",
        "Applied to Invoice",
      ];
    } else {
      // refund_to_client
      return [
        "Draft",
        "Created",
        "Approved by Management",
        "Make Transaction",
        "Approve Transaction",
      ];
    }
  };

  const statusTimeline = getStatusTimeline(creditNote.creditNoteType);
  const currentStatusIdx = statusTimeline.indexOf(creditNote.status);
  const currentConfig = statusConfig[creditNote.status];
  const StatusIcon = currentConfig?.icon || FileText;

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className=" mx-auto px-6 py-8">
        <BackButton />

        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {cn("detail.title", "Credit Note #{{number}}", {
                  number: creditNote.creditNoteNumber,
                })}
              </h1>
              <p className="text-gray-600 mt-2">
                {getCreditNoteTypeLabel(
                  creditNote.creditNoteType,
                  creditNote.entityType
                )}{" "}
                •{" "}
                {cn("detail.createdOn", "Created on {{date}}", {
                  date: formatDate(creditNote.createdAt),
                })}
              </p>
            </div>

            <div className="flex items-center gap-4">
              {/* Current Status Badge */}
              <div
                className={`px-4 py-2 rounded-full border-2 ${currentConfig.color} flex items-center gap-2`}
              >
                <StatusIcon size={18} />
                <span className="font-semibold">
                  {translateCreditNoteStatus(t, creditNote.status)}
                </span>
              </div>

              {/* Action Buttons */}
              {(creditNote.status === "Draft" ||
                creditNote.status === "Cancelled") && (
                <button
                  onClick={() =>
                    history.push(`/update-credit-note/${creditNote._id}`)
                  }
                  className="flex items-center gap-2 px-4 py-2 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[#9CBA33] transition-colors"
                >
                  <Edit3 size={18} />
                  {cn("actions.editCreditNote", "Edit Credit Note")}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Credit Note Details */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          {/* Main Content */}
          <div className="xl:col-span-3 space-y-6">
            {/* Credit Note Information */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <Receipt className="h-5 w-5 text-[var(--p-blue)]" />
                {cn("detail.creditNoteInformation", "Credit Note Information")}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-500">
                      {cn("detail.business", "Business")}
                    </label>
                    <p className="font-medium text-gray-900">
                      {creditNote.business?.name || cn("list.na", "N/A")}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm text-gray-500">
                      {creditNote.entityType === "vendor"
                        ? cn("detail.vendor", "Vendor")
                        : cn("detail.customer", "Customer")}
                    </label>
                    <p className="font-medium text-gray-900">
                      {
                        creditNote.customer?.basicInformation?.primaryContact
                          ?.firstName
                      }{" "}
                      {
                        creditNote.customer?.basicInformation?.primaryContact
                          ?.lastName
                      }
                    </p>
                  </div>

                  <div>
                    <label className="text-sm text-gray-500">
                      {cn("detail.creditNoteType", "Credit Note Type")}
                    </label>
                    <div className="flex items-center gap-2">
                      <CreditCard size={16} className="text-[var(--p-blue)]" />
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getCreditNoteTypeColor(
                          creditNote.creditNoteType
                        )}`}
                      >
                        {getCreditNoteTypeLabel(
                          creditNote.creditNoteType,
                          creditNote.entityType
                        )}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm text-gray-500">
                      {cn("detail.currency", "Currency")}
                    </label>
                    <p className="font-medium text-gray-900">
                      {creditNote.currency}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-500">
                      {cn("detail.creditNoteDate", "Credit Note Date")}
                    </label>
                    <p className="font-medium text-gray-900">
                      {formatDate(creditNote.creditNoteDate)}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm text-gray-500">
                      {cn("detail.dueDate", "Due Date")}
                    </label>
                    <p className="font-medium text-gray-900">
                      {formatDate(creditNote.dueDate)}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm text-gray-500">
                      {cn("detail.paymentTerms", "Payment Terms")}
                    </label>
                    <p className="font-medium text-gray-900">
                      {creditNote.terms}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm text-gray-500">
                      {cn("detail.expenseAccount", "Expense Account")}
                    </label>
                    <p className="font-medium text-gray-900">
                      {creditNote.expenseAccount?.code || cn("list.na", "N/A")} -{" "}
                      {creditNote.expenseAccount?.accountName}
                    </p>
                  </div>

                  {creditNote.creditNoteType === "refund_to_client" &&
                    creditNote.bankAccount && (
                      <div>
                        <label className="text-sm text-gray-500">
                          {cn("detail.refundBankAccount", "Refund Bank Account")}
                        </label>
                        <p className="font-medium text-gray-900">
                          {creditNote.bankAccount.accountName} -{" "}
                          {creditNote.bankAccount.bankName}
                        </p>
                      </div>
                    )}
                </div>
              </div>

              {(creditNote.reference || creditNote.notes) && (
                <div className="border-t pt-6 mt-6">
                  {creditNote.reference && (
                    <div className="mb-4">
                      <label className="text-sm text-gray-500">
                        {cn("detail.reference", "Reference")}
                      </label>
                      <p className="font-medium text-gray-900">
                        {creditNote.reference}
                      </p>
                    </div>
                  )}
                  {creditNote.notes && (
                    <div>
                      <label className="text-sm text-gray-500">
                        {cn("detail.notes", "Notes")}
                      </label>
                      <p className="text-gray-900">{creditNote.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Supporting Documents */}
            {creditNote.documents &&
              creditNote.documents.filter(
                (doc) => doc.documentType === "Supporting"
              ).length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <FileText className="h-5 w-5 text-[var(--p-blue)]" />
                    {cn("detail.supportingDocuments", "Supporting Documents")}
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {creditNote.documents
                      .filter((doc) => doc.documentType === "Supporting")
                      .map((doc, idx) => (
                        <div
                          key={idx}
                          className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-start gap-3">
                            <FileText className="h-8 w-8 text-[var(--p-blue)] flex-shrink-0 mt-1" />
                            <div className="flex-1 min-w-0">
                              <h3
                                className="font-medium text-gray-900 truncate"
                                title={doc.name}
                              >
                                {doc.name}
                              </h3>
                              <p className="text-sm text-gray-500 mt-1">
                                {doc.description}
                              </p>
                              <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                                <span>
                                  {cn("list.uploaded", "Uploaded: {{date}}", {
                                    date: formatDate(doc.uploadedAt),
                                  })}
                                </span>
                                {doc.size && (
                                  <span>
                                    {cn("list.sizeMb", "Size: {{size}} MB", {
                                      size: (doc.size / 1024 / 1024).toFixed(2),
                                    })}
                                  </span>
                                )}
                              </div>
                              <div className="flex gap-2 mt-3">
                                <button
                                  onClick={() => handleOpenFile(doc.fileId)}
                                  className="text-sm text-[var(--p-blue)] hover:underline flex items-center gap-1"
                                >
                                  <FileText size={14} />
                                  {cn("actions.view", "View")}
                                </button>
                                <button
                                  onClick={() => handleDownloadFile(doc.fileId)}
                                  className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                                >
                                  <Package size={14} />
                                  {cn("actions.download", "Download")}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Credit Note Summary */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-[var(--p-blue)]" />
                {cn("detail.creditNoteSummary", "Credit Note Summary")}
              </h2>

              <div className="space-y-3">
                <div className="flex justify-between text-gray-600 text-sm gap-4">
                  <span>{cn("detail.amountBeforeTax", "Amount (before tax)")}</span>
                  <span className="font-medium text-gray-900 text-right whitespace-nowrap">
                    {formatCurrencyAmount(
                      creditNote.currency,
                      lineRollup.totalNetExTax,
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-gray-600 text-sm gap-4">
                  <span>{cn("detail.tax", "Tax")}</span>
                  <span className="font-medium text-gray-900 text-right whitespace-nowrap">
                    {taxPercent != null ? formatLinePercentCell(taxPercent) : "—"}
                  </span>
                </div>
                <div className="flex justify-between text-gray-600 text-sm gap-4 border-b border-gray-100 pb-3">
                  <span className="pr-2">
                    {cn("detail.subtotalInclTax", "Subtotal (lines, incl. tax)")}
                  </span>
                  <span className="font-medium text-gray-900 text-right whitespace-nowrap">
                    {formatCurrencyAmount(
                      creditNote.currency,
                      creditNote.subtotal,
                    )}
                  </span>
                </div>
                {(creditNote.discountAmount || 0) > 0 && (
                  <div className="flex justify-between text-gray-600 text-sm gap-4">
                    <span>{cn("detail.documentDiscount", "Document discount")}</span>
                    <span className="font-medium text-gray-900 text-right whitespace-nowrap">
                      {documentDiscountPercent != null
                        ? formatLinePercentCell(documentDiscountPercent)
                        : "—"}
                    </span>
                  </div>
                )}
                {(creditNote.shippingCharges || 0) > 0 && (
                  <div className="flex justify-between text-gray-600 text-sm gap-4">
                    <span>{cn("detail.shippingCharges", "Shipping charges")}</span>
                    <span className="font-medium text-gray-900 text-right whitespace-nowrap">
                      {formatCurrencyAmount(
                        creditNote.currency,
                        creditNote.shippingCharges,
                      )}
                    </span>
                  </div>
                )}
                {creditNote.adjustment != null &&
                  Number.isFinite(Number(creditNote.adjustment)) &&
                  Math.abs(Number(creditNote.adjustment)) > 1e-9 && (
                    <div className="flex justify-between text-gray-600 text-sm gap-4">
                      <span>{cn("detail.overallAdjustment", "Overall adjustment")}</span>
                      <span className="font-medium text-gray-900 text-right whitespace-nowrap">
                        {Number(creditNote.adjustment) < 0 ? "−" : "+"}
                        {formatCurrencyAmount(
                          creditNote.currency,
                          Math.abs(Number(creditNote.adjustment)),
                        )}
                      </span>
                    </div>
                  )}

                <div className="border-t pt-3">
                  <div className="flex justify-between text-lg font-bold text-gray-900">
                    <span>{cn("detail.total", "Total")}</span>
                    <span className="text-[var(--p-blue)]">
                      {formatCurrencyAmount(
                        creditNote.currency,
                        creditNote.total,
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Banking Information Section */}
            <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-800 flex items-center gap-2">
                <Building className="h-5 w-5 text-[var(--p-blue)]" />
                {cn("detail.bankingInformation", "Banking Information")}
              </h3>

              <div className="space-y-4">
                {/* Customer Bank Details */}
                {/* {creditNote.customer && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="text-sm font-medium mb-3 text-gray-700 flex items-center gap-2">
                      <Users className="h-4 w-4 text-blue-500" />
                      Customer Details
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-500 text-xs uppercase tracking-wide block">
                          Customer Name:
                        </span>
                        <div className="font-medium text-gray-900 mt-1">
                          {creditNote.customer?.basicInformation?.primaryContact
                            ?.firstName}{" "}
                          {creditNote.customer?.basicInformation?.primaryContact
                            ?.lastName}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs uppercase tracking-wide block">
                          Credit Note Type:
                        </span>
                        <div className="font-medium text-gray-900 mt-1">
                          {getCreditNoteTypeLabel(creditNote.creditNoteType, creditNote.entityType)}
                        </div>
                      </div>
                    </div>
                  </div>
                )} */}

                {/* Payment Bank Account Info - Enhanced */}
                {(creditNote.status === "Make Transaction" ||
                  creditNote.status === "Approve Transaction") &&
                  creditNote.paidFromBankAccount && (
                    <div
                      className={`p-4 rounded-lg border ${
                        creditNote.status === "Make Transaction"
                          ? "bg-orange-50 border-orange-200"
                          : "bg-green-50 border-green-200"
                      }`}
                    >
                      <h4 className="text-sm font-medium mb-3 text-gray-900 flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-[var(--p-blue)]" />
                        {creditNote.status === "Make Transaction"
                          ? cn(
                              "detail.paymentAccountPrepared",
                              "Payment Account (Prepared - Funds Not Yet Deducted)"
                            )
                          : cn(
                              "detail.paymentAccountCompleted",
                              "Payment Account (Payment Completed)"
                            )}
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            creditNote.status === "Make Transaction"
                              ? "bg-orange-100 text-orange-800"
                              : "bg-green-100 text-green-800"
                          }`}
                        >
                          {creditNote.paidFromBankAccount.currencyType}
                        </span>
                        <button
                          onClick={() =>
                            setIsPaymentAccountCollapsed(
                              !isPaymentAccountCollapsed
                            )
                          }
                          className="ml-auto p-1 hover:bg-gray-200 rounded-full transition-colors"
                        >
                          {isPaymentAccountCollapsed ? (
                            <ChevronDown className="h-4 w-4 text-gray-500" />
                          ) : (
                            <ChevronUp className="h-4 w-4 text-gray-500" />
                          )}
                        </button>
                      </h4>
                      {!isPaymentAccountCollapsed && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-gray-500 text-xs uppercase tracking-wide block">
                              {cn("detail.bankName", "Bank Name:")}
                            </span>
                            <div className="font-medium text-gray-900 mt-1">
                              {creditNote.paidFromBankAccount.bankName}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-500 text-xs uppercase tracking-wide block">
                              {cn("detail.accountNumber", "Account Number:")}
                            </span>
                            <div className="font-mono text-gray-900 mt-1">
                              {creditNote.paidFromBankAccount.accountNumber ||
                                "****"}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-500 text-xs uppercase tracking-wide block">
                              {cn("detail.accountName", "Account Name:")}
                            </span>
                            <div className="font-medium text-gray-900 mt-1">
                              {creditNote.paidFromBankAccount.accountName}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-500 text-xs uppercase tracking-wide block">
                              {cn("detail.accountType", "Account Type:")}
                            </span>
                            <div className="font-medium text-gray-900 mt-1">
                              {creditNote.paidFromBankAccount.accountType ||
                                cn("detail.notSpecified", "Not specified")}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-500 text-xs uppercase tracking-wide block">
                              {cn("detail.currencyLabel", "Currency:")}
                            </span>
                            <div className="font-medium text-blue-600 mt-1">
                              {creditNote.paidFromBankAccount.currencyType}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-500 text-xs uppercase tracking-wide block">
                              {cn("detail.currentBalance", "Current Balance:")}
                            </span>
                            <div className="font-bold text-green-600 mt-1">
                              {creditNote.paidFromBankAccount.currencyType}{" "}
                              {(
                                creditNote.paidFromBankAccount.openingBalance ||
                                0
                              ).toFixed(2)}
                            </div>
                          </div>
                          {creditNote.paidFromBankAccount.swiftCode && (
                            <div>
                              <span className="text-gray-500 text-xs uppercase tracking-wide block">
                                {cn("detail.swiftCode", "SWIFT Code:")}
                              </span>
                              <div className="font-mono text-gray-900 mt-1">
                                {creditNote.paidFromBankAccount.swiftCode}
                              </div>
                            </div>
                          )}
                          {creditNote.paidFromBankAccount.iban && (
                            <div>
                              <span className="text-gray-500 text-xs uppercase tracking-wide block">
                                {cn("detail.iban", "IBAN:")}
                              </span>
                              <div className="font-mono text-gray-900 mt-1">
                                {creditNote.paidFromBankAccount.iban}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                {/* Live Currency Conversion Details for Pre-selected Bank Account */}
                {(conversionDetails || creditNote.paidFromBankAccount) && (
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h4 className="text-sm font-medium text-blue-900 mb-3 flex items-center">
                      <DollarSign className="h-4 w-4 mr-2" />
                      {cn(
                          "detail.currencyConversionDetailsPreselected",
                          "Currency Conversion Details (Pre-selected Account)"
                        )}
                      {conversionDetails?.isRealTime && (
                        <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                          {cn("detail.liveRate", "Live Rate")}
                        </span>
                      )}
                    </h4>

                    <div className="space-y-2 text-sm">
                      {conversionDetails ? (
                        <>
                          <div className="flex justify-between">
                            <span className="text-blue-700">
                              {cn("detail.creditNoteAmount", "Credit Note Amount:")}
                            </span>
                            <span className="font-medium">
                              {conversionDetails.creditNoteAmount?.toFixed(2) ||
                                0}{" "}
                              {conversionDetails.fromCurrency}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-4">
                          <div className="animate-pulse">
                            <div className="h-4 bg-blue-200 rounded w-3/4 mx-auto mb-2"></div>
                            <div className="h-4 bg-blue-200 rounded w-1/2 mx-auto"></div>
                          </div>
                          <p className="text-blue-600 text-sm mt-2">
                            {cn("detail.loadingConversionDetails", "Loading conversion details...")}
                          </p>
                        </div>
                      )}

                      {conversionDetails && conversionDetails.isConversion && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-blue-700">
                              {cn("detail.exchangeRate", "Exchange Rate:")}
                            </span>
                            <span className="font-medium">
                              {conversionDetails.rateDisplayText ||
                                `1 ${conversionDetails.fromCurrency} = ${conversionDetails.exchangeRate} ${conversionDetails.toCurrency}`}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-blue-700">
                              {cn("detail.amountToDeduct", "Amount to Deduct:")}
                            </span>
                            <span className="font-medium">
                              {conversionDetails.requiredAmount?.toFixed(2) ||
                                0}{" "}
                              {conversionDetails.toCurrency}
                            </span>
                          </div>
                        </>
                      )}

                      <div className="flex justify-between">
                        <span className="text-blue-700">{cn("detail.accountBalance", "Account Balance:")}</span>
                        <span
                          className={`font-medium ${
                            conversionDetails?.hasSufficientFunds
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {conversionDetails?.accountBalance?.toFixed(2) || 0}{" "}
                          {conversionDetails?.toCurrency}
                        </span>
                      </div>

                      <div className="border-t pt-2 mt-3">
                        <div className="flex justify-between font-medium">
                          <span className="text-blue-700">{cn("detail.fundsStatus", "Funds Status:")}</span>
                          <span
                            className={
                              conversionDetails?.hasSufficientFunds
                                ? "text-green-600"
                                : "text-red-600"
                            }
                          >
                            {conversionDetails?.hasSufficientFunds
                              ? `✅ ${cn("detail.sufficientFunds", "Sufficient Funds")}`
                              : `❌ ${cn("detail.insufficientFunds", "Insufficient Funds")}`}
                          </span>
                        </div>
                      </div>

                      {conversionDetails?.displayText && (
                        <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded text-gray-700 text-xs">
                          {conversionDetails.displayText}
                        </div>
                      )}

                      {conversionDetails?.source &&
                        conversionDetails.source !== "same_currency" && (
                          <div className="mt-2 text-xs text-gray-500">
                            {cn("detail.rateSource", "Rate source: {{source}}", { source: conversionDetails.source })}
                            {conversionDetails.timestamp &&
                              ` • Updated: ${new Date(
                                conversionDetails.timestamp
                              ).toLocaleTimeString()}`}
                          </div>
                        )}
                    </div>
                  </div>
                )}

                {/* Show loading state for conversion details if bank account exists but no conversion details yet */}
                {creditNote.paidFromBankAccount &&
                  !conversionDetails &&
                  isLoadingConversion && (
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <h4 className="text-sm font-medium text-blue-900 mb-3 flex items-center">
                        <DollarSign className="h-4 w-4 mr-2" />
                        {cn(
                          "detail.loadingCurrencyConversionDetails",
                          "Loading Currency Conversion Details..."
                        )}
                      </h4>
                      <div className="flex items-center justify-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                        <span className="ml-2 text-blue-700">
                          {cn("detail.converting", "Converting...")}
                        </span>
                      </div>
                    </div>
                  )}

                {/* Show bank account info when no conversion needed */}
                {creditNote.paidFromBankAccount &&
                  !conversionDetails &&
                  !isLoadingConversion && (
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                        <DollarSign className="h-4 w-4 mr-2" />
                        {cn("detail.preselectedPaymentAccount", "Pre-selected Payment Account")}
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-700">
                            {cn("detail.account", "Account:")}
                          </span>
                          <span className="font-medium">
                            {creditNote.paidFromBankAccount.accountName} -{" "}
                            {creditNote.paidFromBankAccount.bankName}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-700">{cn("detail.currencyLabel", "Currency:")}</span>
                          <span className="font-medium">
                            {creditNote.paidFromBankAccount.currencyType}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-700">
                            {cn("detail.balance", "Balance:")}
                          </span>
                          <span className="font-medium">
                            {creditNote.paidFromBankAccount.currencyType}{" "}
                            {(
                              creditNote.paidFromBankAccount.openingBalance || 0
                            ).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                {/* Show placeholder if no payment account selected */}
                {(creditNote.status === "Make Transaction" ||
                  creditNote.status === "Approve Transaction") &&
                  !creditNote.paidFromBankAccount && (
                    <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                      <h4 className="text-sm font-medium mb-2 text-gray-900 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        {cn("detail.paymentAccountRequired", "Payment Account Required")}
                      </h4>
                      <p className="text-sm text-gray-600">
                        {cn(
                          "detail.paymentAccountRequiredHint",
                          "Select a payment account below to prepare the transaction details."
                        )}
                      </p>
                    </div>
                  )}
              </div>

              {/* Currency Conversion Summary */}
              {creditNote.conversionDetails && (
                <div
                  className={`mt-6 p-4 rounded-lg border ${
                    creditNote.status === "Make Transaction"
                      ? "bg-orange-50 border-orange-200"
                      : creditNote.status === "Approve Transaction"
                      ? "bg-green-50 border-green-200"
                      : "bg-blue-50 border-blue-200"
                  }`}
                >
                  <h4 className="text-md font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-blue-500" />
                    {cn("detail.currencyConversionSummary", "Currency Conversion Summary")}
                    {creditNote.status === "Make Transaction" && (
                      <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">
                        {cn("detail.paymentPrepared", "Payment Prepared")}
                      </span>
                    )}
                    {creditNote.status === "Approve Transaction" && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                        {cn("detail.paymentCompleted", "Payment Completed")}
                      </span>
                    )}
                    <button
                      onClick={() =>
                        setIsCurrencyConversionCollapsed(
                          !isCurrencyConversionCollapsed
                        )
                      }
                      className="ml-auto p-1 hover:bg-gray-200 rounded-full transition-colors"
                    >
                      {isCurrencyConversionCollapsed ? (
                        <ChevronDown className="h-4 w-4 text-gray-500" />
                      ) : (
                        <ChevronUp className="h-4 w-4 text-gray-500" />
                      )}
                    </button>
                  </h4>
                  {!isCurrencyConversionCollapsed && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">
                            {cn("detail.creditNoteAmount", "Credit Note Amount:")}
                          </span>
                          <span className="text-sm font-medium text-gray-900">
                            {creditNote.conversionDetails.fromCurrency}{" "}
                            {creditNote.conversionDetails.creditNoteAmount?.toFixed(
                              2
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">
                            {cn("detail.exchangeRate", "Exchange Rate:")}
                          </span>
                          <span className="text-sm font-mono text-gray-900">
                            1 {creditNote.conversionDetails.fromCurrency} ={" "}
                            {creditNote.conversionDetails.exchangeRate?.toFixed(
                              6
                            )}{" "}
                            {creditNote.conversionDetails.toCurrency}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">
                            {cn("detail.amountToDeduct", "Amount to Deduct:")}
                          </span>
                          <span className="text-sm font-bold text-orange-600">
                            {creditNote.conversionDetails.toCurrency}{" "}
                            {creditNote.conversionDetails.requiredAmount?.toFixed(
                              2
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">
                            {cn("detail.conversionStatus", "Conversion Status:")}
                          </span>
                          <span
                            className={`text-xs px-2 py-1 rounded-full ${
                              creditNote.conversionDetails.hasSufficientFunds
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {creditNote.conversionDetails.hasSufficientFunds
                              ? cn("detail.sufficientFunds", "Sufficient Funds")
                              : cn("detail.insufficientFunds", "Insufficient Funds")}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Conversion Flow Indicator */}
                  <div className="mt-4 pt-4 border-t border-blue-200/50">
                    <div className="flex items-center justify-center space-x-2 text-sm text-gray-600">
                      <span className="font-medium text-blue-600">
                        {creditNote.conversionDetails.fromCurrency}{" "}
                        {creditNote.conversionDetails.creditNoteAmount?.toFixed(
                          2
                        )}
                      </span>
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                      </div>
                      <span className="font-medium text-orange-600">
                        {creditNote.conversionDetails.toCurrency}{" "}
                        {creditNote.conversionDetails.requiredAmount?.toFixed(
                          2
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Audit Trail */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Clock className="h-5 w-5 text-[var(--p-blue)]" />
                {cn("detail.auditTrail", "Audit Trail")}
              </h2>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-[var(--p-blue)] mt-2"></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {cn("detail.created", "Created")}
                    </p>
                    <p className="text-xs text-gray-500">
                      {cn("detail.byUser", "{{date}} by {{user}}", {
                        date: formatDate(creditNote.createdAt),
                        user:
                          creditNote.createdBy?.name ||
                          creditNote.createdBy?.email ||
                          cn("detail.system", "System"),
                      })}
                    </p>
                  </div>
                </div>

                {creditNote.approvedAt && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500 mt-2"></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {cn("detail.approved", "Approved")}
                      </p>
                      <p className="text-xs text-gray-500">
                        {cn("detail.byUser", "{{date}} by {{user}}", {
                          date: formatDate(creditNote.approvedAt),
                          user:
                            creditNote.approvedBy?.name ||
                            creditNote.approvedBy?.email ||
                            cn("detail.system", "System"),
                        })}
                      </p>
                    </div>
                  </div>
                )}

                {creditNote.paidAt && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-purple-500 mt-2"></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {cn("detail.paymentCompleted", "Payment Completed")}
                      </p>
                      <p className="text-xs text-gray-500">
                        {cn("detail.byUser", "{{date}} by {{user}}", {
                          date: formatDate(creditNote.paidAt),
                          user:
                            creditNote.paidBy?.name ||
                            creditNote.paidBy?.email ||
                            cn("detail.system", "System"),
                        })}
                      </p>
                      {creditNote.paymentReference && (
                        <p className="text-xs text-gray-500">
                          {cn("detail.referenceLabel", "Reference: {{reference}}", {
                          reference: creditNote.paymentReference,
                        })}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {creditNote.rejectedAt && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-red-500 mt-2"></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {cn("detail.rejected", "Rejected")}
                      </p>
                      <p className="text-xs text-gray-500">
                        {cn("detail.byUser", "{{date}} by {{user}}", {
                          date: formatDate(creditNote.rejectedAt),
                          user:
                            creditNote.rejectedBy?.name ||
                            creditNote.rejectedBy?.email ||
                            cn("detail.system", "System"),
                        })}
                      </p>
                      {creditNote.rejectionReason && (
                        <p className="text-xs text-red-600 mt-1">
                          {cn("detail.reasonLabel", "Reason: {{reason}}", {
                          reason: creditNote.rejectionReason,
                        })}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Credit Note Items */}
          <div className="xl:col-span-full bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <Package className="h-5 w-5 text-[var(--p-blue)]" />
              {cn("detail.creditNoteItems", "Credit Note Items")}
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 whitespace-nowrap">
                      {cn("headers.itemName", "Item Name")}
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 min-w-[120px]">
                      {cn("headers.description", "Description")}
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-500 whitespace-nowrap">
                      {cn("headers.qty", "Qty")}
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-500 whitespace-nowrap">
                      {cn("headers.unitRate", "Unit rate")}
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-500 whitespace-nowrap">
                      {cn("headers.discPercent", "Disc. %")}
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-500 whitespace-nowrap">
                      {cn("headers.taxPercent", "Tax %")}
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-500 whitespace-nowrap">
                      {cn("headers.lineTotal", "Line total")}
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                      {cn("headers.expenseAccount", "Expense Account")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {creditNote.items?.map((item, index) => {
                    const f = resolveCnDnLineFigures(item);
                    return (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                          {item.item_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {item.description || "-"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right tabular-nums">
                          {f.quantity != null ? formatQuantity(f.quantity) : "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right tabular-nums whitespace-nowrap">
                          {f.unitRate != null
                            ? formatCurrencyAmount(
                                creditNote.currency,
                                f.unitRate,
                              )
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right tabular-nums">
                          {formatLinePercentCell(f.discountPct)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right tabular-nums">
                          {formatLinePercentCell(f.taxRatePct)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium tabular-nums whitespace-nowrap">
                          {formatCurrencyAmount(
                            creditNote.currency,
                            f.lineTotal,
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {item.expenseAccount ? (
                            <div>
                              <div className="font-medium text-blue-600">
                                {item.expenseAccount.code || cn("list.na", "N/A")} -{" "}
                                {item.expenseAccount.accountName ||
                                  cn("detail.unknownAccount", "Unknown Account")}
                              </div>
                              <div className="text-xs text-gray-500">
                                {item.expenseAccount.accountType?.name ||
                                  item.expenseAccount.accountType?.accountHeader ||
                                  ""}
                              </div>
                            </div>
                          ) : creditNote.expenseAccount ? (
                            <div>
                              <div className="font-medium text-green-600">
                                {creditNote.expenseAccount.code || cn("list.na", "N/A")} -{" "}
                                {creditNote.expenseAccount.accountName ||
                                  cn("detail.mainAccount", "Main Account")}
                              </div>
                              <div className="text-xs text-gray-500">
                                {cn("detail.mainExpenseAccount", "Main expense account")}
                              </div>
                            </div>
                          ) : (
                            <div className="text-gray-500 italic">
                              {cn("detail.noAccountSpecified", "No account specified")}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Status Timeline & Update */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <Clock className="h-5 w-5 text-[var(--p-blue)]" />
            {cn("detail.statusTimeline", "Status Timeline & Updates")}
          </h2>

          <div className="flex flex-col gap-8 relative">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6 lg:gap-8 flex-1">
              {statusTimeline.map((status, index) => {
                const isCompleted = index <= currentStatusIdx;
                const isCurrent = index === currentStatusIdx;
                const StatusIcon = statusConfig[status]?.icon || FileText;

                return (
                  <div
                    key={status}
                    className="flex flex-col items-center relative"
                  >
                    {/* Timeline Line */}
                    {index < statusTimeline.length - 1 && (
                      <>
                        {/* Desktop/Tablet horizontal line */}
                        <div
                          className={`hidden sm:block absolute top-6 left-6 w-full h-0.5 ${
                            isCompleted ? "bg-[var(--p-blue)]" : "bg-gray-200"
                          }`}
                          style={{ width: "calc(100% + 1.5rem)" }}
                        />
                        {/* Mobile vertical line */}
                        <div
                          className={`sm:hidden absolute top-12 left-1/2 transform -translate-x-1/2 w-0.5 h-12 ${
                            isCompleted ? "bg-[var(--p-blue)]" : "bg-gray-200"
                          }`}
                        />
                      </>
                    )}

                    {/* Status Circle */}
                    <div
                      className={`
                      relative z-10 w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all
                      ${
                        isCompleted
                          ? "bg-[var(--p-blue)] border-[var(--p-blue)] text-white"
                          : "bg-white border-gray-300 text-gray-400"
                      }
                      ${isCurrent ? "ring-4 ring-[var(--p-blue)]/20" : ""}
                    `}
                    >
                      <StatusIcon size={20} />
                    </div>

                    {/* Status Label */}
                    <div className="mt-3 text-center">
                      <p
                        className={`text-sm font-medium ${
                          isCompleted ? "text-gray-900" : "text-gray-500"
                        }`}
                      >
                        {translateCreditNoteStatus(t, status)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Status Update Section */}
          {getValidTransitions(creditNote.status)?.length > 0 && (
            <div className="border-t pt-6 mt-8">
              <h3 className="text-md font-medium text-gray-900 mb-4">
                {cn("actions.updateStatus", "Update Status")}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
                {/* Status Selection */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {cn("detail.newStatus", "New Status")}
                    </label>
                    <SearchableDropdown
                      value={selectedStatus}
                      onChange={handleStatusChange}
                      disabled={statusUpdating}
                      placeholder={cn("detail.currentStatus", "Current: {{status}}", {
                        status: translateCreditNoteStatus(t, creditNote.status),
                      })}
                      searchPlaceholder={cn("detail.searchStatus", "Search status...")}
                      options={[
                        {
                          value: creditNote.status,
                          label: cn("detail.currentStatus", "Current: {{status}}", {
                            status: translateCreditNoteStatus(t, creditNote.status),
                          }),
                        },
                        ...getValidTransitions(creditNote.status).map(
                          (status) => ({
                            value: status,
                            label: translateCreditNoteStatus(t, status),
                          })
                        ),
                      ]}
                      searchKeys={["label"]}
                      renderOption={(option) => (
                        <div className="font-medium">{option.label}</div>
                      )}
                    />
                  </div>

                  {/* Bank Account Selection for Payment Statuses - Only for refund_to_client */}
                  {(selectedStatus === "Make Transaction" ||
                    selectedStatus === "Approve Transaction") &&
                    creditNote.creditNoteType === "refund_to_client" && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {cn("detail.paymentBankAccount", "Payment Bank Account")}
                          <span className="text-red-500">*</span>
                          {creditNote.paidFromBankAccount && (
                            <span className="text-sm text-gray-500 font-normal ml-2">
                              {cn(
                          "detail.preselectedFromCreation",
                          "(Pre-selected from credit note creation)"
                        )}
                            </span>
                          )}
                        </label>

                        {/* Show pre-selected bank account if available */}
                        {creditNote.paidFromBankAccount ? (
                          <div className="w-full p-3 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-900">
                                {creditNote.paidFromBankAccount.accountName} -{" "}
                                {creditNote.paidFromBankAccount.bankName}
                                {creditNote.paidFromBankAccount
                                  .currencyType && (
                                  <span className="text-gray-600 ml-2">
                                    (
                                    {
                                      creditNote.paidFromBankAccount
                                        .currencyType
                                    }{" "}
                                    {(
                                      creditNote.paidFromBankAccount
                                        .openingBalance ||
                                      creditNote.paidFromBankAccount.balance ||
                                      0
                                    ).toFixed(2)}
                                    )
                                  </span>
                                )}
                              </span>
                              <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
                                {cn("detail.preselected", "Pre-selected")}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <SearchableDropdown
                            value={selectedBankAccount?._id || ""}
                            onChange={(e) =>
                              handleBankAccountChange(e.target.value)
                            }
                            disabled={statusUpdating}
                            placeholder={cn(
                              "form.placeholders.selectBankAccount",
                              "Select Bank Account"
                            )}
                            searchPlaceholder={cn(
                              "form.placeholders.searchBankAccounts",
                              "Search bank accounts..."
                            )}
                            options={bankAccounts.map((account) => ({
                              value: account._id,
                              label: `${account.accountName} - ${
                                account.bankName
                              } (${account.currencyType} ${(
                                account.openingBalance ||
                                account.balance ||
                                0
                              ).toFixed(2)})`,
                              name: account.accountName,
                              bank: account.bankName,
                              currency: account.currencyType,
                              balance:
                                account.openingBalance || account.balance || 0,
                            }))}
                            searchKeys={["name", "bank", "currency"]}
                            renderOption={(option) => (
                              <div>
                                <div className="font-medium">{option.name}</div>
                                <div className="text-xs text-gray-500">
                                  {option.bank} - {option.currency}{" "}
                                  {option.balance.toFixed(2)}
                                </div>
                              </div>
                            )}
                          />
                        )}

                        {creditNote.paidFromBankAccount && (
                          <p className="text-xs text-gray-600 mt-1">
                            {cn(
                              "detail.paymentAccountLockedHint",
                              "Payment account was pre-selected during credit note creation and cannot be changed."
                            )}
                          </p>
                        )}
                      </div>
                    )}

                  {/* Currency Conversion Display - Only for refund_to_client */}
                  {conversionDetails &&
                    creditNote.creditNoteType === "refund_to_client" &&
                    (selectedBankAccount || creditNote.paidFromBankAccount) && (
                      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <h4 className="text-sm font-medium text-blue-900 mb-3 flex items-center">
                          <DollarSign className="h-4 w-4 mr-2" />
                          {cn(
                            "detail.currencyConversionDetails",
                            "Currency Conversion Details"
                          )}
                          {conversionDetails.isRealTime && (
                            <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                              {cn("detail.liveRate", "Live Rate")}
                            </span>
                          )}
                        </h4>

                        {isLoadingConversion ? (
                          <div className="flex items-center justify-center py-4">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                            <span className="ml-2 text-blue-700">
                              {cn("detail.converting", "Converting...")}
                            </span>
                          </div>
                        ) : (
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-blue-700">
                                {cn("detail.creditNoteAmount", "Credit Note Amount:")}
                              </span>
                              <span className="font-medium">
                                {conversionDetails.creditNoteAmount?.toFixed(
                                  2
                                ) || 0}{" "}
                                {conversionDetails.fromCurrency}
                              </span>
                            </div>

                            {conversionDetails.isConversion && (
                              <>
                                <div className="flex justify-between">
                                  <span className="text-blue-700">
                                    {cn("detail.exchangeRate", "Exchange Rate:")}
                                  </span>
                                  <span className="font-medium">
                                    {conversionDetails.rateDisplayText ||
                                      `1 ${conversionDetails.fromCurrency} = ${conversionDetails.exchangeRate} ${conversionDetails.toCurrency}`}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-blue-700">
                                    {cn("detail.convertedAmount", "Converted Amount:")}
                                  </span>
                                  <span className="font-medium">
                                    {conversionDetails.requiredAmount?.toFixed(
                                      2
                                    ) || 0}{" "}
                                    {conversionDetails.toCurrency}
                                  </span>
                                </div>
                              </>
                            )}

                            <div className="flex justify-between">
                              <span className="text-blue-700">
                                {cn("detail.accountBalance", "Account Balance:")}
                              </span>
                              <span
                                className={`font-medium ${
                                  conversionDetails.hasSufficientFunds
                                    ? "text-green-600"
                                    : "text-red-600"
                                }`}
                              >
                                {conversionDetails.accountBalance?.toFixed(2) ||
                                  0}{" "}
                                {conversionDetails.toCurrency}
                              </span>
                            </div>

                            <div className="border-t pt-2 mt-3">
                              <div className="flex justify-between font-medium">
                                <span className="text-blue-700">Status:</span>
                                <span
                                  className={
                                    conversionDetails.hasSufficientFunds
                                      ? "text-green-600"
                                      : "text-red-600"
                                  }
                                >
                                  {conversionDetails.hasSufficientFunds
                                    ? "✅ Sufficient Funds"
                                    : "❌ Insufficient Funds"}
                                </span>
                              </div>
                            </div>

                            {conversionDetails.displayText && (
                              <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded text-gray-700 text-xs">
                                {conversionDetails.displayText}
                              </div>
                            )}

                            {!conversionDetails.hasSufficientFunds && (
                              <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
                                <AlertTriangle
                                  size={14}
                                  className="inline mr-1"
                                />
                                {cn(
                                  "detail.insufficientFundsApproveWarning",
                                  'Insufficient funds in selected account. Cannot proceed with "Approve Transaction".'
                                )}
                              </div>
                            )}

                            {conversionDetails.source &&
                              conversionDetails.source !== "same_currency" && (
                                <div className="mt-2 text-xs text-gray-500">
                                  {cn("detail.rateSource", "Rate source: {{source}}", { source: conversionDetails.source })}
                                  {conversionDetails.timestamp &&
                                    ` • Updated: ${new Date(
                                      conversionDetails.timestamp
                                    ).toLocaleTimeString()}`}
                                </div>
                              )}
                          </div>
                        )}
                      </div>
                    )}
                </div>

                {/* Document Upload */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {cn(
                      "detail.supportingDocumentOptional",
                      "Supporting Document (Optional)"
                    )}
                    </label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      />

                      {uploading ? (
                        <div className="space-y-2">
                          <div className="animate-spin mx-auto h-6 w-6 border-4 border-[var(--p-blue)] border-t-transparent rounded-full"></div>
                          <p className="text-sm text-gray-600">
                            {cn("detail.uploadingProgress", "Uploading... {{progress}}%", {
                        progress: uploadProgress,
                      })}
                          </p>
                        </div>
                      ) : (
                        <>
                          <Upload
                            size={24}
                            className="mx-auto text-gray-400 mb-2"
                          />
                          <p className="text-sm text-gray-600 mb-2">
                            {cn(
                        "detail.uploadForStatusChange",
                        "Upload supporting documents for this status change"
                      )}
                          </p>
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="text-[var(--p-blue)] hover:text-[#9CBA33] text-sm font-medium"
                            disabled={statusUpdating}
                          >
                            {cn("actions.chooseFile", "Choose File")}
                          </button>
                        </>
                      )}
                    </div>

                    {selectedFile && (
                      <div className="mt-2 p-2 bg-gray-50 rounded flex items-center justify-between">
                        <span className="text-sm text-gray-700">
                          {selectedFile.name}
                        </span>
                        <button
                          onClick={() => {
                            setSelectedFile(null);
                            if (fileInputRef.current) {
                              fileInputRef.current.value = "";
                            }
                          }}
                          className="text-red-500 hover:text-red-700"
                          disabled={statusUpdating}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Action Button */}
                  <button
                    onClick={handleUploadAndStatusUpdate}
                    disabled={
                      statusUpdating ||
                      !selectedStatus ||
                      selectedStatus === creditNote.status ||
                      ((selectedStatus === "Make Transaction" ||
                        selectedStatus === "Approve Transaction") &&
                        !selectedBankAccount &&
                        !creditNote.paidFromBankAccount) ||
                      (conversionDetails &&
                        !conversionDetails.hasSufficientFunds)
                    }
                    className="w-full px-4 py-3 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[#9CBA33] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {statusUpdating
                      ? cn("actions.updating", "Updating...")
                      : conversionDetails &&
                        !conversionDetails.hasSufficientFunds
                      ? cn("detail.insufficientFunds", "Insufficient Funds")
                      : cn("actions.updateTo", "Update to {{status}}", {
                          status: translateCreditNoteStatus(t, selectedStatus),
                        })}
                  </button>
                </div>
              </div>

              {uploadSuccess && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-green-800 text-sm">{successMessage}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
