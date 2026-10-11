import React, { useState, useEffect, useContext, useRef } from "react";
import {
  ChevronDown,
  ChevronUp,
  Upload,
  ArrowLeft,
  FileText,
  CheckCircle,
  XCircle,
  Download,
  Eye,
  Calendar,
  User,
  Building,
  CreditCard,
  Package,
  DollarSign,
  Clock,
  AlertCircle,
  Trash2,
  Edit3,
  Plus,
  Wallet,
  AlertTriangle,
  Users,
  Receipt,
  BookOpen,
} from "lucide-react";
import { useParams, useHistory } from "react-router-dom";
import axios from "axios";
import { notifyError, notifySuccess } from "@/utils/toast";
import { AdminContext } from "@/context/AdminContext";
import { formatAmount, formatDate } from "@/components/formatAmount";
import BackButton from "@/components/BackButton";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const statusConfig = {
  Draft: {
    color: "bg-gray-100 text-gray-800 border-gray-300",
    icon: Edit3,
    bgColor: "bg-gray-50",
    textColor: "text-gray-700",
    description: "Expense is being prepared",
  },
  Created: {
    color: "bg-blue-100 text-blue-800 border-blue-300",
    icon: FileText,
    bgColor: "bg-blue-50",
    textColor: "text-blue-700",
    description: "Expense has been created and submitted",
  },
  "Approved by Management": {
    color: "bg-green-100 text-green-800 border-green-300",
    icon: CheckCircle,
    bgColor: "bg-green-50",
    textColor: "text-green-700",
    description: "Expense has been approved by management",
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
  Cancelled: {
    color: "bg-red-100 text-red-800 border-red-300",
    icon: XCircle,
    bgColor: "bg-red-50",
    textColor: "text-red-700",
    description: "Expense has been cancelled",
  },
};

const validStatusTransitions = {
  Draft: ["Created", "Cancelled"],
  Created: ["Approved by Management", "Cancelled"],
  "Approved by Management": ["Make Transaction", "Cancelled"],
  "Make Transaction": ["Approve Transaction", "Cancelled"],
  "Approve Transaction": [],
  Cancelled: [],
};

const ViewExpense = () => {
  const { id } = useParams();
  const history = useHistory();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;

  const [expense, setExpense] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [bankAccounts, setBankAccounts] = useState([]);
  const [selectedBankAccount, setSelectedBankAccount] = useState(null);
  const [isLoadingConversion, setIsLoadingConversion] = useState(false);
  const [conversionDetails, setConversionDetails] = useState(null);
  const [isPaymentAccountCollapsed, setIsPaymentAccountCollapsed] =
    useState(false);
  const [isCurrencyConversionCollapsed, setIsCurrencyConversionCollapsed] =
    useState(true);
  const [isPaymentHistoryExpanded, setIsPaymentHistoryExpanded] =
    useState(false);
  const [amountToPay, setAmountToPay] = useState("");
  const [associatedClaims, setAssociatedClaims] = useState([]);
  const [isLoadingClaims, setIsLoadingClaims] = useState(false);
  const fileInputRef = useRef(null);

  // 1. Calculate totalPaid and remainingAmount from approved payments only
  const approvedPayments =
    expense && Array.isArray(expense.payments)
      ? expense.payments.filter((p) => p.status === "Approved")
      : [];
  const totalPaid = approvedPayments.reduce(
    (sum, p) => sum + (parseFloat(p.amount) || 0),
    0
  );
  const remainingAmount = expense
    ? (parseFloat(expense.total) || 0) - totalPaid
    : 0;

  // 2. Find if there is a pending payment intent
  const pendingPayment =
    expense && Array.isArray(expense.payments)
      ? expense.payments.find((p) => p.status === "Pending")
      : null;
  const hasPendingPayment = !!pendingPayment;

  // 3. Auto-populate amountToPay with remainingAmount if no pending payment
  useEffect(() => {
    if (
      expense &&
      selectedStatus === "Make Transaction" &&
      !hasPendingPayment &&
      (amountToPay === "" || Number(amountToPay) !== remainingAmount)
    ) {
      setAmountToPay(remainingAmount > 0 ? remainingAmount : "");
    }
    // eslint-disable-next-line
  }, [expense, selectedStatus, hasPendingPayment, remainingAmount]);

  // Currency conversion function
  const getCurrencyConversion = async (fromCurrency, toCurrency, amount) => {
    // Validate input parameters
    if (!fromCurrency || !toCurrency || !amount || amount <= 0) {
      const error = `Invalid conversion parameters: from=${fromCurrency}, to=${toCurrency}, amount=${amount}`;
      console.error(`[Frontend] ${error}`);
      throw new Error("Invalid currency conversion parameters");
    }

    if (fromCurrency === toCurrency) {
      return {
        rate: 1,
        convertedAmount: amount,
        displayText: `${amount} ${fromCurrency} = ${amount} ${toCurrency} (Same Currency)`,
        rateDisplayText: `1 ${fromCurrency} = 1 ${toCurrency}`,
        isRealTime: true,
        source: "same_currency",
      };
    }

    setIsLoadingConversion(true);
    try {
      console.log(
        `[Frontend] Converting: ${amount} ${toCurrency} to ${fromCurrency}`
      );

      const response = await axios.get(`${Base_URL}/currency/convert`, {
        params: {
          from: fromCurrency,
          to: toCurrency,
          amount,
          businessId: expense.business?._id || expense.business,
        },
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
          displayText: `${amount} ${fromCurrency} = ${convertedAmount.toFixed(
            2
          )} ${toCurrency} (Rate: ${rate})`,
          rateDisplayText: `1 ${fromCurrency} = ${rate} ${toCurrency}`,
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
    if (!expense || !account) {
      console.log(
        "❌ Cannot calculate conversion - missing expense or account"
      );
      return;
    }

    console.log("🔄 Calculating conversion for account:", account.accountName);
    console.log("Account currency:", account.currencyType);
    console.log("Expense currency:", expense.currency);
    console.log("Expense total:", expense.total);

    if (account.currencyType !== expense.currency) {
      console.log("💱 Different currencies, fetching conversion rate...");
      try {
        const conversion = await getCurrencyConversion(
          expense.currency,
          account.currencyType,
          expense.total
        );

        console.log("✅ Conversion result:", conversion);

        const conversionData = {
          fromCurrency: expense.currency,
          toCurrency: account.currencyType,
          expenseAmount: expense.total,
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
        notifyError(`Failed to get exchange rate: ${error.message}`);
      }
    } else {
      // Same currency case
      console.log("💰 Same currencies, no conversion needed");
      const sameCurrencyData = {
        fromCurrency: account.currencyType,
        toCurrency: expense.currency,
        expenseAmount: expense.total,
        accountCurrency: account.currencyType,
        requiredAmount: expense.total,
        exchangeRate: 1,
        accountBalance: account.openingBalance || account.balance,
        hasSufficientFunds:
          (account.openingBalance || account.balance) >= expense.total,
        displayText: `${expense.total} ${expense.currency} = ${expense.total} ${account.currencyType} (Same Currency)`,
        isConversion: false,
      };

      console.log("🎯 Setting same currency details:", sameCurrencyData);
      setConversionDetails(sameCurrencyData);
    }
  };

  useEffect(() => {
    fetchExpense();
  }, [id]);

  // Fetch bank accounts when expense is loaded and preselect existing bank account
  useEffect(() => {
    const fetchBankAccounts = async () => {
      if (expense?.business?._id || expense?.business) {
        try {
          const businessId = expense.business?._id || expense.business;
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
          if (expense.paidFromBankAccount) {
            console.log(
              "🔍 Looking for pre-selected bank account:",
              expense.paidFromBankAccount
            );

            let existingAccount = response.data.accounts?.find(
              (acc) =>
                acc._id === expense.paidFromBankAccount._id ||
                acc._id === expense.paidFromBankAccount
            );

            // If not found in business accounts, try fetching all accounts
            if (!existingAccount && expense.paidFromBankAccount._id) {
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
                  (acc) => acc._id === expense.paidFromBankAccount._id
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

    if (expense) {
      console.log("📄 Expense loaded, fetching bank accounts...");
      fetchBankAccounts();
    }
  }, [expense]);

  // Additional useEffect to ensure conversion details are calculated for pre-selected accounts
  useEffect(() => {
    if (expense && selectedBankAccount && !conversionDetails) {
      console.log("🔄 Recalculating conversion for selected bank account...");
      calculateConversionForAccount(selectedBankAccount);
    }
  }, [expense, selectedBankAccount]);

  const fetchExpense = async () => {
    try {
      const response = await axios.get(`${Base_URL}/expenses/${id}`, {
        headers: {
          authorization: `Bearer ${adminInfo.token}`,
        },
      });

      console.log("Expense response:", response.data);

      if (response.data.success) {
        const expenseData = response.data.data;
        setExpense(expenseData);
        setSelectedStatus(expenseData.status);

        // Fetch associated claims if expense type is staff_claims
        if (
          expenseData.expenseType === "staff_claims" &&
          expenseData.associatedClaims?.length > 0
        ) {
          await fetchAssociatedClaims(expenseData.associatedClaims);
        }
      }
    } catch (error) {
      console.error("Error fetching expense:", error);
      notifyError("Failed to load expense details");
    } finally {
      setLoading(false);
    }
  };

  const fetchAssociatedClaims = async (claimIds) => {
    try {
      setIsLoadingClaims(true);
      const claimPromises = claimIds.map((claimId) =>
        axios.get(`${Base_URL}/claims/${claimId}`, {
          headers: {
            authorization: `Bearer ${adminInfo.token}`,
          },
        })
      );

      const claimResponses = await Promise.all(claimPromises);
      const claims = claimResponses.map((response) => response.data.data);
      setAssociatedClaims(claims);
    } catch (error) {
      console.error("Failed to fetch associated claims:", error);
      notifyError("Failed to fetch associated claims");
    } finally {
      setIsLoadingClaims(false);
    }
  };

  const getDocumentForStatus = (status) => {
    return expense.documents?.find((doc) => doc.status === status);
  };

  const handleStatusChange = (e) => {
    const newStatus = e.target.value;
    setSelectedStatus(newStatus);

    // Reset bank account and conversion when status changes, unless we're keeping the preselected account
    if (newStatus === "Approve Transaction" && expense.paidFromBankAccount) {
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
      notifyError("Bank account not found");
      return;
    }

    setSelectedBankAccount(account);

    // Calculate conversion if currencies differ
    if (expense && account.currencyType !== expense.currency) {
      console.log(
        `[Frontend] Starting conversion: ${expense.total} ${expense.currency} from ${account.currencyType}`
      );

      // Validate parameters before calling conversion
      if (
        !account.currencyType ||
        !expense.currency ||
        !expense.total ||
        expense.total <= 0
      ) {
        console.error("[Frontend] Missing or invalid conversion parameters:", {
          accountCurrency: account.currencyType,
          expenseCurrency: expense.currency,
          expenseTotal: expense.total,
        });

        let missingParams = [];
        if (!account.currencyType) missingParams.push("account currency");
        if (!expense.currency) missingParams.push("expense currency");
        if (!expense.total || expense.total <= 0)
          missingParams.push("valid expense amount");

        notifyError(
          `Cannot convert currency - missing: ${missingParams.join(", ")}`
        );
        return;
      }

      try {
        const conversion = await getCurrencyConversion(
          expense.currency,
          account.currencyType,
          expense.total
        );

        setConversionDetails({
          fromCurrency: account.currencyType,
          toCurrency: expense.currency,
          expenseAmount: expense.total,
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
        notifyError(`Failed to get exchange rate: ${error.message}`);
      }
    } else {
      // Same currency, no conversion needed
      const accountBalance = account.openingBalance || account.balance;
      setConversionDetails({
        fromCurrency: account.currencyType,
        toCurrency: expense.currency,
        expenseAmount: expense.total,
        accountCurrency: account.currencyType,
        requiredAmount: expense.total,
        exchangeRate: 1,
        accountBalance: accountBalance,
        hasSufficientFunds: accountBalance >= expense.total,
        displayText: `${expense.total} ${expense.currency} = ${expense.total} ${account.currencyType} (Same Currency)`,
        isConversion: false,
      });
    }
  };

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
  };

  const handleUploadAndStatusUpdate = async () => {
    if (!selectedStatus || selectedStatus === expense.status) {
      notifyError("Please select a new status");
      return;
    }

    // Validation for status transitions that require bank account
    const bankAccountToUse = selectedBankAccount || expense.paidFromBankAccount;
    if (
      (selectedStatus === "Make Transaction" ||
        selectedStatus === "Approve Transaction") &&
      !bankAccountToUse
    ) {
      notifyError("Please select a bank account for payment");
      return;
    }

    // Validation for Make Transaction
    if (selectedStatus === "Make Transaction") {
      const payAmount = parseFloat(amountToPay);
      if (!payAmount || payAmount <= 0) {
        notifyError("Enter a valid amount to pay");
        return;
      }
      if (payAmount > remainingAmount) {
        notifyError("Amount exceeds remaining expense amount");
        return;
      }
      if (conversionDetails && !conversionDetails.hasSufficientFunds) {
        notifyError("Insufficient funds in selected bank account");
        return;
      }
    }

    // Validation for Approve Transaction
    if (
      selectedStatus === "Approve Transaction" &&
      expense.payments?.length > 0
    ) {
      const lastPayment = expense.payments[expense.payments.length - 1];
      if (!lastPayment) {
        notifyError("No payment intent found to approve");
        return;
      }
    }

    // Validation for insufficient funds
    if (
      conversionDetails &&
      !conversionDetails.hasSufficientFunds &&
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
        // First upload the document using the same API as VendorInvoices
        const formDataForUpload = new FormData();
        formDataForUpload.append(
          "file_path",
          `Expenses/${expense.expenseNumber}`
        );
        formDataForUpload.append("business_id", expense.business._id);
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

          // Prepare document data with proper URL structure
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

      // Prepare update data with bank account information for payment statuses
      const updateData = {
        status: selectedStatus,
        ...(documentData && { documents: documentData }),
        ...((selectedStatus === "Make Transaction" ||
          selectedStatus === "Approve Transaction") &&
          bankAccountToUse && {
            paymentBankAccount: bankAccountToUse._id || bankAccountToUse,
            conversionDetails: conversionDetails,
            ...(selectedStatus === "Make Transaction" && {
              amountToPay: amountToPay,
            }),
          }),
      };

      // Update expense status with or without document
      const updateResponse = await axios.put(
        `${Base_URL}/expenses/${expense._id}`,
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
            ? "Status updated and document uploaded successfully!"
            : "Status updated successfully!"
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
          "Failed to update status or upload document"
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
      notifyError("Error opening file");
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
      notifyError("Failed to download file");
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
      notifyError("Failed to download file");
    }
  };

  const handleCancelPendingPayment = async () => {
    if (!pendingPayment) {
      notifyError("No pending payment to cancel");
      return;
    }

    try {
      const response = await axios.patch(
        `${Base_URL}/expenses/${expense._id}/cancel-pending-payment`,
        {
          paymentId: pendingPayment._id,
        },
        {
          headers: {
            authorization: `Bearer ${adminInfo.token}`,
          },
        }
      );

      if (response.data.success) {
        notifySuccess("Pending payment cancelled successfully");
        fetchExpense(); // Refresh the expense data
      }
    } catch (error) {
      console.error("Error cancelling pending payment:", error);
      notifyError(
        error.response?.data?.error || "Failed to cancel pending payment"
      );
    }
  };

  const getExpenseTypeIcon = (type) => {
    const icons = {
      staff_claims: Users,
      bills: Receipt,
      rents: Building,
      non_trading_invoices: FileText,
    };
    return icons[type] || FileText;
  };

  const getExpenseTypeLabel = (type) => {
    const labels = {
      staff_claims: "Staff Claims",
      bills: "Bills",
      rents: "Rents",
      non_trading_invoices: "Non-trading Invoices",
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--p-blue)]"></div>
      </div>
    );
  }

  if (!expense) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-500 text-lg">Expense not found</p>
          <button
            onClick={() => history.push("/expenses")}
            className="mt-4 px-4 py-2 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[#9CBA33] transition-colors"
          >
            Back to Expenses
          </button>
        </div>
      </div>
    );
  }

  const statusTimeline = [
    "Draft",
    "Created",
    "Approved by Management",
    "Make Transaction",
    "Approve Transaction",
  ];
  const currentStatusIdx = statusTimeline.indexOf(expense.status);
  const currentConfig = statusConfig[expense.status];
  const StatusIcon = currentConfig?.icon || FileText;
  const ExpenseTypeIcon = getExpenseTypeIcon(expense.expenseType);

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <BackButton />

        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Expense #{expense.expenseNumber}
              </h1>
              <p className="text-gray-600 mt-2">
                {getExpenseTypeLabel(expense.expenseType)} • Created on{" "}
                {formatDate(expense.createdAt)}
              </p>
            </div>

            <div className="flex items-center gap-4">
              {/* Current Status Badge */}
              <div
                className={`px-4 py-2 rounded-full border-2 ${currentConfig.color} flex items-center gap-2`}
              >
                <StatusIcon size={18} />
                <span className="font-semibold">{expense.status}</span>
              </div>

              {/* Action Buttons */}
              {(expense.status === "Draft" ||
                expense.status === "Cancelled") && (
                <button
                  onClick={() =>
                    history.push(`/expenses/update/${expense._id}`)
                  }
                  className="flex items-center gap-2 px-4 py-2 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[#9CBA33] transition-colors"
                >
                  <Edit3 size={18} />
                  Edit Expense
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="xl:col-span-2 space-y-6">
            {/* Expense Information */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <ExpenseTypeIcon className="h-5 w-5 text-[var(--p-blue)]" />
                Expense Information
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-500">Business</label>
                    <p className="font-medium text-gray-900">
                      {expense.business?.name || "N/A"}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm text-gray-500">
                      Expense Type
                    </label>
                    <div className="flex items-center gap-2">
                      <ExpenseTypeIcon
                        size={16}
                        className="text-[var(--p-blue)]"
                      />
                      <p className="font-medium text-gray-900">
                        {getExpenseTypeLabel(expense.expenseType)}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm text-gray-500">
                      {expense.expenseType === "staff_claims"
                        ? "Employee"
                        : "Vendor"}
                    </label>
                    <p className="font-medium text-gray-900">
                      {expense.expenseType === "staff_claims"
                        ? expense.employee?.displayName ||
                          `${expense.employee?.personalInfo?.firstName} ${expense.employee?.personalInfo?.lastName}`
                        : expense.vendor?.basicInformation?.vendorDisplayName ||
                          "N/A"}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm text-gray-500">Currency</label>
                    <p className="font-medium text-gray-900">
                      {expense.currency}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-500">
                      Expense Date
                    </label>
                    <p className="font-medium text-gray-900">
                      {formatDate(expense.expenseDate)}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm text-gray-500">Due Date</label>
                    <p className="font-medium text-gray-900">
                      {formatDate(expense.dueDate)}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm text-gray-500">
                      Payment Terms
                    </label>
                    <p className="font-medium text-gray-900">{expense.terms}</p>
                  </div>

                  <div>
                    <label className="text-sm text-gray-500">
                      Payment Account
                    </label>
                    <p className="font-medium text-gray-900">
                      {expense.paidFromBankAccount?.accountName} -{" "}
                      {expense.paidFromBankAccount?.bankName}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm text-gray-500">
                      Expense Account
                    </label>
                    <p className="font-medium text-gray-900">
                      {expense.expenseAccount?.code || "N/A"} -{" "}
                      {expense.expenseAccount?.accountName}
                    </p>
                  </div>
                </div>
              </div>

              {(expense.reference || expense.notes) && (
                <div className="border-t pt-6 mt-6">
                  {expense.reference && (
                    <div className="mb-4">
                      <label className="text-sm text-gray-500">Reference</label>
                      <p className="font-medium text-gray-900">
                        {expense.reference}
                      </p>
                    </div>
                  )}
                  {expense.notes && (
                    <div>
                      <label className="text-sm text-gray-500">Notes</label>
                      <p className="text-gray-900">{expense.notes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Vendor Bank Details */}
              {expense.vendor?.bankInfo && (
                <div className="mt-4">
                  <label className="text-sm text-gray-500">
                    Vendor Bank Details
                  </label>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mt-2 text-sm">
                    {expense.vendor.bankInfo.bankDetails?.bankName && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Bank Name:</span>
                        <span className="font-medium text-gray-900">
                          {expense.vendor.bankInfo.bankDetails.bankName}
                        </span>
                      </div>
                    )}
                    {expense.vendor.bankInfo.bankAccountDetails
                      ?.accountName && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Account Name:</span>
                        <span className="font-medium text-gray-900">
                          {
                            expense.vendor.bankInfo.bankAccountDetails
                              .accountName
                          }
                        </span>
                      </div>
                    )}
                    {expense.vendor.bankInfo.bankAccountDetails
                      ?.accountNumber && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Account Number:</span>
                        <span className="font-medium text-gray-900">
                          {
                            expense.vendor.bankInfo.bankAccountDetails
                              .accountNumber
                          }
                        </span>
                      </div>
                    )}
                    {expense.vendor.bankInfo.bankAccountDetails?.swiftCode && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">SWIFT Code:</span>
                        <span className="font-medium text-gray-900">
                          {expense.vendor.bankInfo.bankAccountDetails.swiftCode}
                        </span>
                      </div>
                    )}
                    {expense.vendor.bankInfo.bankDetails?.branchCode && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Branch Code:</span>
                        <span className="font-medium text-gray-900">
                          {expense.vendor.bankInfo.bankDetails.branchCode}
                        </span>
                      </div>
                    )}
                    {/* Add more fields as needed */}
                  </div>
                </div>
              )}
            </div>

            {/* Expense Items */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <Package className="h-5 w-5 text-[var(--p-blue)]" />
                Expense Items
              </h2>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                        Item Name
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                        Amount & Currency
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                        Discount
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                        Converted Amount
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                        Expense Account
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                        Contract
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                        Notes
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {expense.items?.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {item.item_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          <div className="font-medium">
                            {item.currency || expense.currency}{" "}
                            {formatAmount(item.amount)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {item.discount > 0 ? (
                            <div>
                              <div className="text-orange-600 font-medium">
                                {item.discount}%
                              </div>
                              <div className="text-xs text-gray-500">
                                -{item.currency || expense.currency}{" "}
                                {formatAmount(item.discountAmount || 0)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400">No discount</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          <div className="font-medium text-green-600">
                            {expense.currency}{" "}
                            {formatAmount(item.convertedAmount || item.amount)}
                          </div>
                          {item.currency &&
                            item.currency !== expense.currency &&
                            item.exchangeRate && (
                              <div className="text-xs text-gray-500">
                                Rate: {item.exchangeRate?.toFixed(4)}
                              </div>
                            )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {item.expenseAccount ? (
                            <div>
                              <div className="font-medium text-blue-600">
                                {item.expenseAccount.code || "N/A"} -{" "}
                                {item.expenseAccount.accountName ||
                                  "Unknown Account"}
                              </div>
                              <div className="text-xs text-gray-500">
                                {item.expenseAccount.accountType?.name ||
                                  item.expenseAccount.accountType
                                    ?.accountHeader ||
                                  ""}
                              </div>
                            </div>
                          ) : expense.expenseAccount ? (
                            <div>
                              <div className="font-medium text-green-600">
                                {expense.expenseAccount.code || "N/A"} -{" "}
                                {expense.expenseAccount.accountName ||
                                  "Main Account"}
                              </div>
                              <div className="text-xs text-gray-500">
                                Main expense account
                              </div>
                            </div>
                          ) : (
                            <div className="text-gray-500 italic">
                              No account specified
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {item.contractType && item.contractNumber ? (
                            <div>
                              <div className="font-medium text-purple-600">
                                {item.contractType === "sales"
                                  ? "Sales"
                                  : "Purchase"}{" "}
                                Contract
                              </div>
                              <div className="text-xs text-gray-500">
                                {item.contractNumber}
                              </div>
                            </div>
                          ) : (
                            <div className="text-gray-500 italic">
                              No contract linked
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {item.notes || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Supporting Documents */}
            {expense.documents &&
              expense.documents.filter(
                (doc) => doc.documentType === "Supporting"
              ).length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <FileText className="h-5 w-5 text-[var(--p-blue)]" />
                    Supporting Documents
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {expense.documents
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
                                  Uploaded: {formatDate(doc.uploadedAt)}
                                </span>
                                {doc.size && (
                                  <span>
                                    Size: {(doc.size / 1024 / 1024).toFixed(2)}{" "}
                                    MB
                                  </span>
                                )}
                              </div>
                              <div className="flex gap-2 mt-3">
                                <button
                                  onClick={() => handleOpenFile(doc.fileId)}
                                  className="text-sm text-[var(--p-blue)] hover:underline flex items-center gap-1"
                                >
                                  <FileText size={14} />
                                  View
                                </button>
                                <button
                                  onClick={() => handleDownloadFile(doc.fileId)}
                                  className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                                >
                                  <Package size={14} />
                                  Download
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
            {/* Expense Summary */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-[var(--p-blue)]" />
                Expense Summary
              </h2>

              <div className="space-y-3">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span className="font-medium">
                    {expense.currency} {formatAmount(expense.subtotal)}
                  </span>
                </div>

                {expense.taxAmount > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Tax</span>
                    <span className="font-medium">
                      {expense.currency} {formatAmount(expense.taxAmount)}
                    </span>
                  </div>
                )}

                <div className="border-t pt-3">
                  <div className="flex justify-between text-lg font-bold text-gray-900">
                    <span>Total</span>
                    <span className="text-[var(--p-blue)]">
                      {expense.currency} {formatAmount(expense.total)}
                    </span>
                  </div>
                </div>
                {expense && (
                  <>
                    <div className="flex justify-between text-gray-600 mt-2">
                      <span>Total Paid</span>
                      <span className="font-medium text-green-600">
                        {expense.currency} {formatAmount(totalPaid)}
                      </span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Remaining Amount</span>
                      <span className="font-medium text-red-600">
                        {expense.currency} {formatAmount(remainingAmount)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Banking Information Section */}
            <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-800 flex items-center gap-2">
                <Building className="h-5 w-5 text-[var(--p-blue)]" />
                Banking Information
              </h3>

              <div className="space-y-4">
                {/* Employee Bank Details */}
                {expense.employee && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="text-sm font-medium mb-3 text-gray-700 flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-blue-500" />
                      Employee Details
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-500 text-xs uppercase tracking-wide block">
                          Employee Name:
                        </span>
                        <div className="font-medium text-gray-900 mt-1">
                          {expense.employee?.personalInfo?.firstName}{" "}
                          {expense.employee?.personalInfo?.lastName}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs uppercase tracking-wide block">
                          Employee ID:
                        </span>
                        <div className="font-mono text-gray-900 mt-1">
                          {expense.employee?.employeeId || "Not provided"}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs uppercase tracking-wide block">
                          Department:
                        </span>
                        <div className="font-medium text-gray-900 mt-1">
                          {expense.employee?.jobInfo?.department ||
                            "Not provided"}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs uppercase tracking-wide block">
                          Position:
                        </span>
                        <div className="font-medium text-gray-900 mt-1">
                          {expense.employee?.jobInfo?.position ||
                            "Not provided"}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Payment Bank Account Info - Enhanced */}
                {(expense.status === "Make Transaction" ||
                  expense.status === "Approve Transaction") &&
                  expense.paidFromBankAccount && (
                    <div
                      className={`p-4 rounded-lg border ${
                        expense.status === "Make Transaction"
                          ? "bg-orange-50 border-orange-200"
                          : "bg-green-50 border-green-200"
                      }`}
                    >
                      <h4 className="text-sm font-medium mb-3 text-gray-900 flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-[var(--p-blue)]" />
                        {expense.status === "Make Transaction"
                          ? "Payment Account (Prepared - Funds Not Yet Deducted)"
                          : "Payment Account (Payment Completed)"}
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            expense.status === "Make Transaction"
                              ? "bg-orange-100 text-orange-800"
                              : "bg-green-100 text-green-800"
                          }`}
                        >
                          {expense.paidFromBankAccount.currencyType}
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
                              Bank Name:
                            </span>
                            <div className="font-medium text-gray-900 mt-1">
                              {expense.paidFromBankAccount.bankName}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-500 text-xs uppercase tracking-wide block">
                              Account Number:
                            </span>
                            <div className="font-mono text-gray-900 mt-1">
                              {expense.paidFromBankAccount.accountNumber ||
                                "****"}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-500 text-xs uppercase tracking-wide block">
                              Account Name:
                            </span>
                            <div className="font-medium text-gray-900 mt-1">
                              {expense.paidFromBankAccount.accountName}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-500 text-xs uppercase tracking-wide block">
                              Account Type:
                            </span>
                            <div className="font-medium text-gray-900 mt-1">
                              {expense.paidFromBankAccount.accountType ||
                                "Not specified"}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-500 text-xs uppercase tracking-wide block">
                              Currency:
                            </span>
                            <div className="font-medium text-blue-600 mt-1">
                              {expense.paidFromBankAccount.currencyType}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-500 text-xs uppercase tracking-wide block">
                              Current Balance:
                            </span>
                            <div className="font-bold text-green-600 mt-1">
                              {expense.paidFromBankAccount.currencyType}{" "}
                              {parseFloat(
                                expense.paidFromBankAccount.openingBalance || 0
                              ).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </div>
                          </div>
                          {expense.paidFromBankAccount.swiftCode && (
                            <div>
                              <span className="text-gray-500 text-xs uppercase tracking-wide block">
                                SWIFT Code:
                              </span>
                              <div className="font-mono text-gray-900 mt-1">
                                {expense.paidFromBankAccount.swiftCode}
                              </div>
                            </div>
                          )}
                          {expense.paidFromBankAccount.iban && (
                            <div>
                              <span className="text-gray-500 text-xs uppercase tracking-wide block">
                                IBAN:
                              </span>
                              <div className="font-mono text-gray-900 mt-1">
                                {expense.paidFromBankAccount.iban}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                {/* Expense Account Information */}
                {expense.expenseAccount && (
                  <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                    <h4 className="text-sm font-medium text-purple-900 mb-3 flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-purple-500" />
                      Expense Account
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-500 text-xs uppercase tracking-wide block">
                          Account Name:
                        </span>
                        <div className="font-medium text-gray-900 mt-1">
                          {expense.expenseAccount.code || "N/A"} -{" "}
                          {expense.expenseAccount.accountName}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs uppercase tracking-wide block">
                          Account Code:
                        </span>
                        <div className="font-mono text-gray-900 mt-1">
                          {expense.expenseAccount.code || "Not provided"}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs uppercase tracking-wide block">
                          Account Type:
                        </span>
                        <div className="font-medium text-gray-900 mt-1">
                          {expense.expenseAccount.accountType ||
                            "Not specified"}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Live Currency Conversion Details for Pre-selected Bank Account */}
                {/* Debug info */}
                {/* <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                  <strong>Debug Info:</strong>
                  <br />
                  Has conversionDetails: {conversionDetails ? "Yes" : "No"}
                  <br />
                  Has paidFromBankAccount:{" "}
                  {expense.paidFromBankAccount ? "Yes" : "No"}
                  <br />
                  selectedBankAccount:{" "}
                  {selectedBankAccount
                    ? selectedBankAccount.accountName
                    : "None"}
                  <br />
                  Conversion Details:{" "}
                  {conversionDetails
                    ? JSON.stringify(conversionDetails, null, 2)
                    : "None"}
                </div> */}

                {(conversionDetails || expense.paidFromBankAccount) && (
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h4 className="text-sm font-medium text-blue-900 mb-3 flex items-center">
                      <DollarSign className="h-4 w-4 mr-2" />
                      Currency Conversion Details (Pre-selected Account)
                      {conversionDetails?.isRealTime && (
                        <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                          Live Rate
                        </span>
                      )}
                    </h4>

                    <div className="space-y-2 text-sm">
                      {conversionDetails ? (
                        <>
                          <div className="flex justify-between">
                            <span className="text-blue-700">
                              Expense Amount:
                            </span>
                            <span className="font-medium">
                              {conversionDetails.expenseAmount?.toFixed(2) || 0}{" "}
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
                            Loading conversion details...
                          </p>
                        </div>
                      )}

                      {conversionDetails && conversionDetails.isConversion && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-blue-700">
                              Exchange Rate:
                            </span>
                            <span className="font-medium">
                              {conversionDetails.rateDisplayText ||
                                `1 ${conversionDetails.fromCurrency} = ${conversionDetails.exchangeRate} ${conversionDetails.toCurrency}`}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-blue-700">
                              Amount to Deduct:
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
                        <span className="text-blue-700">Account Balance:</span>
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
                          <span className="text-blue-700">Funds Status:</span>
                          <span
                            className={
                              conversionDetails?.hasSufficientFunds
                                ? "text-green-600"
                                : "text-red-600"
                            }
                          >
                            {conversionDetails?.hasSufficientFunds
                              ? "✅ Sufficient Funds"
                              : "❌ Insufficient Funds"}
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
                            Rate source: {conversionDetails.source}
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
                {expense.paidFromBankAccount &&
                  !conversionDetails &&
                  isLoadingConversion && (
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <h4 className="text-sm font-medium text-blue-900 mb-3 flex items-center">
                        <DollarSign className="h-4 w-4 mr-2" />
                        Loading Currency Conversion Details...
                      </h4>
                      <div className="flex items-center justify-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                        <span className="ml-2 text-blue-700">
                          Converting...
                        </span>
                      </div>
                    </div>
                  )}

                {/* Show bank account info when no conversion needed */}
                {expense.paidFromBankAccount &&
                  !conversionDetails &&
                  !isLoadingConversion && (
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                        <DollarSign className="h-4 w-4 mr-2" />
                        Pre-selected Payment Account
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-700">Account:</span>
                          <span className="font-medium">
                            {expense.paidFromBankAccount.accountName} -{" "}
                            {expense.paidFromBankAccount.bankName}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-700">Currency:</span>
                          <span className="font-medium">
                            {expense.paidFromBankAccount.currencyType}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-700">Balance:</span>
                          <span className="font-medium">
                            {expense.paidFromBankAccount.currencyType}{" "}
                            {(
                              expense.paidFromBankAccount.openingBalance || 0
                            ).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                {/* Show placeholder if no payment account selected */}
                {(expense.status === "Make Transaction" ||
                  expense.status === "Approve Transaction") &&
                  !expense.paidFromBankAccount && (
                    <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                      <h4 className="text-sm font-medium mb-2 text-gray-900 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        Payment Account Required
                      </h4>
                      <p className="text-sm text-gray-600">
                        Select a payment account below to proceed with the
                        transaction.
                      </p>
                    </div>
                  )}

                {/* Employee Bank Details */}
                {expense.employee?.bankDetails && (
                  <div className="mt-4">
                    <label className="text-sm text-gray-500">
                      Employee Bank Details
                    </label>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mt-2 text-sm">
                      {expense.employee.bankDetails.accountHolderName && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Account Holder:</span>
                          <span className="font-medium text-gray-900">
                            {expense.employee.bankDetails.accountHolderName}
                          </span>
                        </div>
                      )}
                      {expense.employee.bankDetails.bankName && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Bank Name:</span>
                          <span className="font-medium text-gray-900">
                            {expense.employee.bankDetails.bankName}
                          </span>
                        </div>
                      )}
                      {expense.employee.bankDetails.accountNumber && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Account Number:</span>
                          <span className="font-medium text-gray-900">
                            {expense.employee.bankDetails.accountNumber}
                          </span>
                        </div>
                      )}
                      {expense.employee.bankDetails.swiftCode && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">SWIFT Code:</span>
                          <span className="font-medium text-gray-900">
                            {expense.employee.bankDetails.swiftCode}
                          </span>
                        </div>
                      )}
                      {expense.employee.bankDetails.iban && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">IBAN:</span>
                          <span className="font-medium text-gray-900">
                            {expense.employee.bankDetails.iban}
                          </span>
                        </div>
                      )}
                      {expense.employee.bankDetails.currency && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Currency:</span>
                          <span className="font-medium text-gray-900">
                            {expense.employee.bankDetails.currency}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Currency Conversion Summary */}
              {expense.conversionDetails && (
                <div
                  className={`mt-6 p-4 rounded-lg border ${
                    expense.status === "Make Transaction"
                      ? "bg-orange-50 border-orange-200"
                      : expense.status === "Approve Transaction"
                      ? "bg-green-50 border-green-200"
                      : "bg-blue-50 border-blue-200"
                  }`}
                >
                  <h4 className="text-md font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-blue-500" />
                    Currency Conversion Summary
                    {expense.status === "Make Transaction" && (
                      <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">
                        Payment Prepared
                      </span>
                    )}
                    {expense.status === "Approve Transaction" && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                        Payment Completed
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
                            Expense Amount:
                          </span>
                          <span className="text-sm font-medium text-gray-900">
                            {expense.conversionDetails.toCurrency}{" "}
                            {expense.conversionDetails.expenseAmount?.toFixed(
                              2
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">
                            Exchange Rate:
                          </span>
                          <span className="text-sm font-mono text-gray-900">
                            1 {expense.conversionDetails.fromCurrency} ={" "}
                            {expense.conversionDetails.exchangeRate?.toFixed(6)}{" "}
                            {expense.conversionDetails.toCurrency}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">
                            Amount to Deduct:
                          </span>
                          <span className="text-sm font-bold text-orange-600">
                            {expense.conversionDetails.fromCurrency}{" "}
                            {expense.conversionDetails.requiredAmount?.toFixed(
                              2
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">
                            Conversion Status:
                          </span>
                          <span
                            className={`text-xs px-2 py-1 rounded-full ${
                              expense.conversionDetails.hasSufficientFunds
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {expense.conversionDetails.hasSufficientFunds
                              ? "Sufficient Funds"
                              : "Insufficient Funds"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Conversion Flow Indicator */}
                  <div className="mt-4 pt-4 border-t border-blue-200/50">
                    <div className="flex items-center justify-center space-x-2 text-sm text-gray-600">
                      <span className="font-medium text-orange-600">
                        {expense.conversionDetails.fromCurrency}{" "}
                        {expense.conversionDetails.requiredAmount?.toFixed(2)}
                      </span>
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                      </div>
                      <span className="font-medium text-blue-600">
                        {expense.conversionDetails.toCurrency}{" "}
                        {expense.conversionDetails.expenseAmount?.toFixed(2)}
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
                Audit Trail
              </h2>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-[var(--p-blue)] mt-2"></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Created</p>
                    <p className="text-xs text-gray-500">
                      {formatDate(expense.createdAt)} by{" "}
                      {expense.createdBy?.name ||
                        expense.createdBy?.email ||
                        "System"}
                    </p>
                  </div>
                </div>

                {expense.approvedAt && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500 mt-2"></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Approved
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(expense.approvedAt)} by{" "}
                        {expense.approvedBy?.name ||
                          expense.approvedBy?.email ||
                          "System"}
                      </p>
                    </div>
                  </div>
                )}

                {expense.paidAt && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-purple-500 mt-2"></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Payment Completed
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(expense.paidAt)} by{" "}
                        {expense.paidBy?.name ||
                          expense.paidBy?.email ||
                          "System"}
                      </p>
                      {expense.paymentReference && (
                        <p className="text-xs text-gray-500">
                          Reference: {expense.paymentReference}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {expense.rejectedAt && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-red-500 mt-2"></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Rejected
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(expense.rejectedAt)} by{" "}
                        {expense.rejectedBy?.name ||
                          expense.rejectedBy?.email ||
                          "System"}
                      </p>
                      {expense.rejectionReason && (
                        <p className="text-xs text-red-600 mt-1">
                          Reason: {expense.rejectionReason}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Payment History Section */}
        {expense && expense.payments && expense.payments.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() =>
                setIsPaymentHistoryExpanded(!isPaymentHistoryExpanded)
              }
            >
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-[var(--p-blue)]" />
                Payment History ({expense.payments.length} payments)
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">
                  {isPaymentHistoryExpanded ? "Collapse" : "Expand"}
                </span>
                <ChevronDown
                  className={`h-5 w-5 text-gray-400 transition-transform ${
                    isPaymentHistoryExpanded ? "rotate-180" : ""
                  }`}
                />
              </div>
            </div>

            {isPaymentHistoryExpanded && (
              <div className="mt-4">
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="min-w-full bg-white">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 border-b">
                          #
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 border-b">
                          Date
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 border-b">
                          Amount Paid
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 border-b">
                          Currency
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 border-b">
                          Bank Account
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 border-b">
                          Exchange Rate
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 border-b">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {expense.payments.map((p, idx) => {
                        const bank = Array.isArray(bankAccounts)
                          ? bankAccounts.find(
                              (b) =>
                                b._id === (p.bankAccount?._id || p.bankAccount)
                            )
                          : undefined;
                        return (
                          <tr
                            key={idx}
                            className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                          >
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              {idx + 1}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {p.date ? new Date(p.date).toLocaleString() : "-"}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-900">
                              {p.amount}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {p.currency || expense.currency}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {bank?.accountName || "-"}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {p.conversionDetails?.exchangeRate || "-"}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              <span
                                className={`px-2 py-1 text-xs rounded-full ${
                                  p.status === "Approved"
                                    ? "bg-green-100 text-green-800"
                                    : p.status === "Pending"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {p.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Status Timeline & Update */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <Clock className="h-5 w-5 text-[var(--p-blue)]" />
            Status Timeline & Updates
          </h2>

          {/* Pending Payment Details */}
          {selectedStatus === "Approve Transaction" && hasPendingPayment && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="mb-2 font-semibold text-gray-700">
                Pending Payment Details (Maker)
              </div>
              <div className="flex flex-wrap gap-6">
                <div>
                  <div className="text-xs text-gray-500">Amount</div>
                  <div className="font-bold text-lg">
                    {pendingPayment.amount} {pendingPayment.currency}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Bank Account</div>
                  <div className="font-medium">
                    {(Array.isArray(bankAccounts)
                      ? bankAccounts.find(
                          (b) => b._id === pendingPayment.bankAccount._id
                        )
                      : undefined
                    )?.accountName || "-"}
                  </div>
                </div>
                {pendingPayment.conversionDetails && (
                  <div>
                    <div className="text-xs text-gray-500">Conversion Rate</div>
                    <div className="font-medium">
                      {pendingPayment.conversionDetails.exchangeRate || "-"}
                    </div>
                  </div>
                )}
              </div>
              {/* Show conversion details for pending payment */}
              {pendingPayment.conversionDetails && (
                <div className="mt-4 p-4 bg-blue-100 border border-blue-300 rounded-lg">
                  <div className="flex flex-col gap-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-blue-700">Expense Amount:</span>
                      <span className="font-medium">
                        {pendingPayment.conversionDetails.expenseAmount?.toFixed(
                          2
                        ) || 0}{" "}
                        {pendingPayment.conversionDetails.toCurrency}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700">Exchange Rate:</span>
                      <span className="font-medium">
                        {pendingPayment.conversionDetails.exchangeRate}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700">Converted Amount:</span>
                      <span className="font-medium">
                        {pendingPayment.conversionDetails.requiredAmount?.toFixed(
                          2
                        ) || 0}{" "}
                        {pendingPayment.conversionDetails.fromCurrency}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700">Account Balance:</span>
                      <span
                        className={`font-medium ${
                          pendingPayment.conversionDetails.hasSufficientFunds
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {pendingPayment.conversionDetails.accountBalance?.toFixed(
                          2
                        ) || 0}{" "}
                        {pendingPayment.conversionDetails.fromCurrency}
                      </span>
                    </div>
                    <div className="border-t pt-2 mt-3">
                      <div className="flex justify-between font-medium">
                        <span className="text-blue-700">Status:</span>
                        <span
                          className={
                            pendingPayment.conversionDetails.hasSufficientFunds
                              ? "text-green-600"
                              : "text-red-600"
                          }
                        >
                          {pendingPayment.conversionDetails.hasSufficientFunds
                            ? "✅ Sufficient Funds"
                            : "❌ Insufficient Funds"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div className="mt-2">
                <button
                  className="px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 font-semibold"
                  onClick={handleCancelPendingPayment}
                  disabled={loading}
                >
                  Cancel Pending Payment
                </button>
              </div>
            </div>
          )}

          {selectedStatus === "Make Transaction" &&
            Array.isArray(expense.payments) &&
            expense.payments.length > 0 &&
            expense.status === "Make Transaction" && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="mb-2 font-semibold text-gray-700">
                  Pending Payment (Maker)
                </div>
                <div className="flex flex-wrap gap-6">
                  <div>
                    <div className="text-xs text-gray-500">Amount</div>
                    <div className="font-bold text-lg">
                      {expense.payments[expense.payments.length - 1].amount}{" "}
                      {expense.payments[expense.payments.length - 1].currency}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Bank Account</div>
                    <div className="font-medium">
                      {(Array.isArray(bankAccounts)
                        ? bankAccounts.find(
                            (b) =>
                              b._id ===
                              expense.payments[expense.payments.length - 1]
                                .bankAccount
                          )
                        : undefined
                      )?.accountName || "-"}
                    </div>
                  </div>
                  {expense.payments[expense.payments.length - 1]
                    .conversionDetails && (
                    <div>
                      <div className="text-xs text-gray-500">
                        Conversion Rate
                      </div>
                      <div className="font-medium">
                        {expense.payments[expense.payments.length - 1]
                          .conversionDetails.exchangeRate || "-"}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

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
                        {status}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Status Update Section */}
          {validStatusTransitions[expense.status]?.length > 0 && (
            <div className="border-t pt-6 mt-8">
              <h3 className="text-md font-medium text-gray-900 mb-4">
                Update Status
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
                {/* Status Selection */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      New Status
                    </label>
                    <div className="relative">
                      <select
                        value={selectedStatus}
                        onChange={handleStatusChange}
                        disabled={statusUpdating}
                        className="w-full p-3 border border-gray-300 rounded-lg appearance-none bg-white pr-10 focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                      >
                        <option value={expense.status}>
                          Current: {expense.status}
                        </option>
                        {validStatusTransitions[expense.status].map(
                          (status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          )
                        )}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                    </div>
                  </div>

                  {/* Bank Account Selection for Payment Statuses */}
                  {(selectedStatus === "Make Transaction" ||
                    selectedStatus === "Approve Transaction") && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Payment Bank Account
                        <span className="text-red-500">*</span>
                        {expense.paidFromBankAccount && (
                          <span className="text-sm text-gray-500 font-normal ml-2">
                            (Pre-selected from expense creation)
                          </span>
                        )}
                      </label>

                      {/* Show pre-selected bank account if available */}
                      {expense.paidFromBankAccount ? (
                        <div className="w-full p-3 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-900">
                              {expense.paidFromBankAccount.accountName} -{" "}
                              {expense.paidFromBankAccount.bankName}
                              {expense.paidFromBankAccount.currencyType && (
                                <span className="text-gray-600 ml-2">
                                  ({expense.paidFromBankAccount.currencyType}{" "}
                                  {(
                                    expense.paidFromBankAccount
                                      .openingBalance ||
                                    expense.paidFromBankAccount.balance ||
                                    0
                                  ).toFixed(2)}
                                  )
                                </span>
                              )}
                            </span>
                            <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
                              Pre-selected
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="relative">
                          <select
                            value={selectedBankAccount?._id || ""}
                            onChange={(e) =>
                              handleBankAccountChange(e.target.value)
                            }
                            disabled={statusUpdating}
                            className="w-full p-3 border border-gray-300 rounded-lg appearance-none pr-10 focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] bg-white"
                          >
                            <option value="">Select Bank Account</option>
                            {bankAccounts.map((account) => (
                              <option key={account._id} value={account._id}>
                                {account.accountName} - {account.bankName} (
                                {account.currencyType}{" "}
                                {(
                                  account.openingBalance ||
                                  account.balance ||
                                  0
                                ).toFixed(2)}
                                )
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                        </div>
                      )}

                      {expense.paidFromBankAccount && (
                        <p className="text-xs text-gray-600 mt-1">
                          Payment account was pre-selected during expense
                          creation and cannot be changed.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Amount Input for Make Transaction */}
                  {selectedStatus === "Make Transaction" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Amount to Pay
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        value={
                          hasPendingPayment
                            ? pendingPayment.amount
                            : amountToPay
                        }
                        onChange={(e) =>
                          !hasPendingPayment && setAmountToPay(e.target.value)
                        }
                        disabled={hasPendingPayment || statusUpdating}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] disabled:bg-gray-100"
                        placeholder="Enter amount to pay"
                        min="0"
                        step="0.01"
                      />
                      <p className="text-xs text-gray-600 mt-1">
                        Remaining amount: {expense.currency}{" "}
                        {formatAmount(remainingAmount)}
                      </p>
                      {/* Show conversion details for pending payment if exists, else for current input */}
                      {hasPendingPayment && pendingPayment.conversionDetails ? (
                        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex flex-col gap-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-blue-700">
                                Expense Amount:
                              </span>
                              <span className="font-medium">
                                {pendingPayment.conversionDetails.expenseAmount?.toFixed(
                                  2
                                ) || 0}{" "}
                                {pendingPayment.conversionDetails.fromCurrency}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-blue-700">
                                Exchange Rate:
                              </span>
                              <span className="font-medium">
                                {pendingPayment.conversionDetails.exchangeRate}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-blue-700">
                                Converted Amount:
                              </span>
                              <span className="font-medium">
                                {pendingPayment.conversionDetails.requiredAmount?.toFixed(
                                  2
                                ) || 0}{" "}
                                {pendingPayment.conversionDetails.toCurrency}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-blue-700">
                                Account Balance:
                              </span>
                              <span
                                className={`font-medium ${
                                  pendingPayment.conversionDetails
                                    .hasSufficientFunds
                                    ? "text-green-600"
                                    : "text-red-600"
                                }`}
                              >
                                {pendingPayment.conversionDetails.accountBalance?.toFixed(
                                  2
                                ) || 0}{" "}
                                {pendingPayment.conversionDetails.toCurrency}
                              </span>
                            </div>
                            <div className="border-t pt-2 mt-3">
                              <div className="flex justify-between font-medium">
                                <span className="text-blue-700">Status:</span>
                                <span
                                  className={
                                    pendingPayment.conversionDetails
                                      .hasSufficientFunds
                                      ? "text-green-600"
                                      : "text-red-600"
                                  }
                                >
                                  {pendingPayment.conversionDetails
                                    .hasSufficientFunds
                                    ? "✅ Sufficient Funds"
                                    : "❌ Insufficient Funds"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        conversionDetails && (
                          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex flex-col gap-1 text-sm">
                              <div className="flex justify-between">
                                <span className="text-blue-700">
                                  Expense Amount:
                                </span>
                                <span className="font-medium">
                                  {conversionDetails.expenseAmount?.toFixed(
                                    2
                                  ) || 0}{" "}
                                  {conversionDetails.toCurrency}
                                </span>
                              </div>
                              {conversionDetails.isConversion && (
                                <>
                                  <div className="flex justify-between">
                                    <span className="text-blue-700">
                                      Exchange Rate:
                                    </span>
                                    <span className="font-medium">
                                      {conversionDetails.rateDisplayText ||
                                        `1 ${conversionDetails.fromCurrency} = ${conversionDetails.exchangeRate} ${conversionDetails.toCurrency}`}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-blue-700">
                                      Converted Amount:
                                    </span>
                                    <span className="font-medium">
                                      {conversionDetails.requiredAmount?.toFixed(
                                        2
                                      ) || 0}{" "}
                                      {conversionDetails.fromCurrency}
                                    </span>
                                  </div>
                                </>
                              )}
                              <div className="flex justify-between">
                                <span className="text-blue-700">
                                  Account Balance:
                                </span>
                                <span
                                  className={`font-medium ${
                                    conversionDetails.hasSufficientFunds
                                      ? "text-green-600"
                                      : "text-red-600"
                                  }`}
                                >
                                  {conversionDetails.accountBalance?.toFixed(
                                    2
                                  ) || 0}{" "}
                                  {conversionDetails.fromCurrency}
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
                              {conversionDetails.source &&
                                conversionDetails.source !==
                                  "same_currency" && (
                                  <div className="mt-2 text-xs text-gray-500">
                                    Rate source: {conversionDetails.source}
                                    {conversionDetails.timestamp &&
                                      ` • Updated: ${new Date(
                                        conversionDetails.timestamp
                                      ).toLocaleTimeString()}`}
                                  </div>
                                )}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}

                  {/* Pending Payment UI */}
                  {hasPendingPayment && (
                    <div className="mt-2">
                      <button
                        className="px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 font-semibold"
                        onClick={handleCancelPendingPayment}
                        disabled={loading}
                      >
                        Cancel Pending Payment
                      </button>
                    </div>
                  )}

                  {/* Currency Conversion Display */}
                  {conversionDetails &&
                    (selectedBankAccount || expense.paidFromBankAccount) && (
                      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <h4 className="text-sm font-medium text-blue-900 mb-3 flex items-center">
                          <DollarSign className="h-4 w-4 mr-2" />
                          Currency Conversion Details
                          {conversionDetails.isRealTime && (
                            <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                              Live Rate
                            </span>
                          )}
                        </h4>

                        {isLoadingConversion ? (
                          <div className="flex items-center justify-center py-4">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                            <span className="ml-2 text-blue-700">
                              Converting...
                            </span>
                          </div>
                        ) : (
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-blue-700">
                                Expense Amount:
                              </span>
                              <span className="font-medium">
                                {conversionDetails.expenseAmount?.toFixed(2) ||
                                  0}{" "}
                                {conversionDetails.fromCurrency}
                              </span>
                            </div>

                            {conversionDetails.isConversion && (
                              <>
                                <div className="flex justify-between">
                                  <span className="text-blue-700">
                                    Exchange Rate:
                                  </span>
                                  <span className="font-medium">
                                    {conversionDetails.rateDisplayText ||
                                      `1 ${conversionDetails.fromCurrency} = ${conversionDetails.exchangeRate} ${conversionDetails.toCurrency}`}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-blue-700">
                                    Converted Amount:
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
                                Account Balance:
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
                                {conversionDetails.fromCurrency}
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
                                Insufficient funds in selected account. Cannot
                                proceed with "Approve Transaction".
                              </div>
                            )}

                            {conversionDetails.source &&
                              conversionDetails.source !== "same_currency" && (
                                <div className="mt-2 text-xs text-gray-500">
                                  Rate source: {conversionDetails.source}
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

                  {/* Payment Account Details */}
                  {/* {(selectedStatus === "Make Transaction" ||
                    selectedStatus === "Approve Transaction") &&
                    (selectedBankAccount || expense.paidFromBankAccount) && (
                      <div className="mt-4">
                        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                          <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                            <Building className="h-4 w-4 mr-2" />
                            Payment Account Details
                          </h4>

                          {(() => {
                            const accountDetails =
                              selectedBankAccount ||
                              expense.paidFromBankAccount;
                            return (
                              <div className="grid grid-cols-1 gap-3 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-gray-600">
                                    Account Name:
                                  </span>
                                  <span className="font-medium text-gray-900">
                                    {accountDetails?.accountName}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Bank:</span>
                                  <span className="font-medium text-gray-900">
                                    {accountDetails?.bankName}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">
                                    Account Number:
                                  </span>
                                  <span className="font-medium text-gray-900">
                                    {accountDetails?.accountNumber || "****"}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">
                                    Currency:
                                  </span>
                                  <span className="font-medium text-gray-900">
                                    {accountDetails?.currencyType ||
                                      accountDetails?.currency}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">
                                    Balance:
                                  </span>
                                  <span className="font-medium text-gray-900">
                                    {accountDetails?.currencyType ||
                                      accountDetails?.currency}{" "}
                                    {(
                                      accountDetails?.openingBalance ||
                                      accountDetails?.balance ||
                                      0
                                    ).toFixed(2)}
                                  </span>
                                </div>
                                {accountDetails?.swiftCode && (
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">
                                      SWIFT Code:
                                    </span>
                                    <span className="font-medium text-gray-900">
                                      {accountDetails.swiftCode}
                                    </span>
                                  </div>
                                )}
                                {accountDetails?.iban && (
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">IBAN:</span>
                                    <span className="font-medium text-gray-900">
                                      {accountDetails.iban}
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    )} */}
                </div>

                {/* Document Upload */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Supporting Document (Optional)
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
                            Uploading... {uploadProgress}%
                          </p>
                        </div>
                      ) : (
                        <>
                          <Upload
                            size={24}
                            className="mx-auto text-gray-400 mb-2"
                          />
                          <p className="text-sm text-gray-600 mb-2">
                            Upload supporting documents for this status change
                          </p>
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="text-[var(--p-blue)] hover:text-[#9CBA33] text-sm font-medium"
                            disabled={statusUpdating}
                          >
                            Choose File
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
                      selectedStatus === expense.status ||
                      ((selectedStatus === "Make Transaction" ||
                        selectedStatus === "Approve Transaction") &&
                        !selectedBankAccount &&
                        !expense.paidFromBankAccount) ||
                      (conversionDetails &&
                        !conversionDetails.hasSufficientFunds)
                    }
                    className="w-full px-4 py-3 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[#9CBA33] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {statusUpdating
                      ? "Updating..."
                      : conversionDetails &&
                        !conversionDetails.hasSufficientFunds
                      ? "Insufficient Funds"
                      : `Update to ${selectedStatus}`}
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
};

export default ViewExpense;
