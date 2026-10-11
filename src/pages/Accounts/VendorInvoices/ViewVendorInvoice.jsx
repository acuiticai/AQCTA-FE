import React, { useState, useEffect, useContext, useRef } from "react";
import { useParams, useHistory } from "react-router-dom";
import axios from "axios";
import {
  ChevronDown,
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
  Loader2,
} from "lucide-react";
import { notifyError, notifySuccess } from "@/utils/toast";
import ChequeNumberLink from "@/components/cheques/ChequeNumberLink";
import { downloadPaymentReceiptSlip } from "@/utils/paymentReceiptFromTemplate";
import { AdminContext } from "@/context/AdminContext";
import {
  formatAmount,
  getCurrencyDisplay,
  formatCurrencyAmount,
} from "@/components/formatAmount";
import BackButton from "@/components/BackButton";
import { DataTable } from "@/page-layouts/index";
import { formatDate } from "@/components/formatAmount";
import SearchableDropdown from "@/components/SearchableDropdown";
import { getNextDocumentNumber } from "@/services/documentSequenceServices";
import { useTranslation } from "react-i18next";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const statusConfig = {
  Draft: {
    color: "bg-gray-100 text-gray-800 border-gray-300",
    icon: Edit3,
    bgColor: "bg-gray-50",
    textColor: "text-gray-700",
    description: "Invoice is being prepared",
  },
  Created: {
    color: "bg-blue-100 text-blue-800 border-blue-300",
    icon: FileText,
    bgColor: "bg-blue-50",
    textColor: "text-blue-700",
    description: "Invoice has been created",
  },
  "Approved by Management": {
    color: "bg-yellow-100 text-yellow-800 border-yellow-300",
    icon: CheckCircle,
    bgColor: "bg-yellow-50",
    textColor: "text-yellow-700",
    description: "Invoice has been approved by management",
  },
  "Make Transaction": {
    color: "bg-orange-100 text-orange-800 border-orange-300",
    icon: Clock,
    bgColor: "bg-orange-50",
    textColor: "text-orange-700",
    description: "Transaction is being processed",
  },
  "Approve Transaction": {
    color: "bg-green-100 text-green-800 border-green-300",
    icon: DollarSign,
    bgColor: "bg-green-50",
    textColor: "text-green-700",
    description: "Transaction has been approved (Paid)",
  },
  Cancelled: {
    color: "bg-red-100 text-red-800 border-red-300",
    icon: XCircle,
    bgColor: "bg-red-50",
    textColor: "text-red-700",
    description: "Invoice has been cancelled",
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

const ViewVendorInvoice = () => {
  const { t } = useTranslation();
  const vi = (key, defaultValue, options = {}) =>
    t(`accounts.vendorInvoices.${key}`, { defaultValue, ...options });
  const translateStatus = (status) => {
    const map = {
      Draft: vi("statusDraft", "Draft"),
      Created: vi("statusCreated", "Created"),
      "Approved by Management": vi(
        "statusApprovedByManagement",
        "Approved by Management",
      ),
      "Make Transaction": vi("statusMakeTransaction", "Make Transaction"),
      "Approve Transaction": vi(
        "statusApproveTransaction",
        "Approve Transaction",
      ),
      Cancelled: vi("statusCancelled", "Cancelled"),
      Approved: vi("statusApproved", "Approved"),
      Pending: vi("statusPending", "Pending"),
      "Pending Clearance": vi("statusPendingClearance", "Pending Clearance"),
    };
    return map[status] || status;
  };
  const translateStatusDescription = (status) => {
    const map = {
      Draft: vi("statusDescDraft", "Invoice is being prepared"),
      Created: vi("statusDescCreated", "Invoice has been created"),
      "Approved by Management": vi(
        "statusDescApprovedByManagement",
        "Invoice has been approved by management",
      ),
      "Make Transaction": vi(
        "statusDescMakeTransaction",
        "Transaction is being processed",
      ),
      "Approve Transaction": vi(
        "statusDescApproveTransaction",
        "Transaction has been approved (Paid)",
      ),
      Cancelled: vi("statusDescCancelled", "Invoice has been cancelled"),
    };
    return map[status] || statusConfig[status]?.description || "";
  };
  const { id } = useParams();
  const history = useHistory();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const [invoice, setInvoice] = useState(null);
  console.log("invoice", invoice);
  console.log("invoice.payments", invoice?.payments);
  console.log("invoice.vendor", invoice?.vendor);
  console.log("invoice.vendor?.bankInfo", invoice?.vendor?.bankInfo);
  const [loading, setLoading] = useState(true);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [downloadingReceiptId, setDownloadingReceiptId] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const fileInputRef = useRef(null);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [selectedBankAccount, setSelectedBankAccount] = useState(null);
  const [amountToPay, setAmountToPay] = useState("");
  const [conversionDetails, setConversionDetails] = useState(null);
  const [isLoadingConversion, setIsLoadingConversion] = useState(false);
  const [isPaymentHistoryExpanded, setIsPaymentHistoryExpanded] =
    useState(false);
  const [vpNumberPreview, setVpNumberPreview] = useState("");

  // 1. Calculate totalPaid and remainingAmount from approved payments only
  const approvedPayments =
    invoice && Array.isArray(invoice.payments)
      ? invoice.payments.filter((p) => p.status === "Approved")
      : [];
  const totalPaid = approvedPayments.reduce(
    (sum, p) => sum + (parseFloat(p.amount) || 0),
    0,
  );
  const remainingAmount = invoice
    ? (parseFloat(invoice.total) || 0) - totalPaid
    : 0;

  // Normalize remaining amount to 2 decimal places to avoid floating point issues
  const normalizedRemainingAmount = Math.max(
    0,
    Math.round(remainingAmount * 100) / 100,
  );

  // 2. Find if there is a pending payment intent
  const pendingPayment =
    invoice && Array.isArray(invoice.payments)
      ? invoice.payments.find((p) => p.status === "Pending")
      : null;
  const hasPendingPayment = !!pendingPayment;
  const hasPendingClearance =
    invoice?.paymentStatus === "Pending Clearance" ||
    (Array.isArray(invoice?.payments) &&
      invoice.payments.some((p) => p.status === "Pending Clearance"));

  // 3. Auto-populate amountToPay with remainingAmount if no pending payment (rounded to 2 decimals)
  useEffect(() => {
    if (
      invoice &&
      selectedStatus === "Make Transaction" &&
      !hasPendingPayment &&
      (amountToPay === "" || Number(amountToPay) !== normalizedRemainingAmount)
    ) {
      const rounded =
        normalizedRemainingAmount > 0
          ? parseFloat(Number(normalizedRemainingAmount).toFixed(2))
          : "";
      setAmountToPay(rounded);
    }
    // eslint-disable-next-line
  }, [invoice, selectedStatus, hasPendingPayment, normalizedRemainingAmount]);

  useEffect(() => {
    fetchInvoice();
  }, [id]);

  // Fetch VP number preview when user selects "Make Transaction"
  useEffect(() => {
    if (selectedStatus !== "Make Transaction" || !invoice) return;
    const bizId = invoice.business?._id || invoice.business;
    if (!bizId) return;
    getNextDocumentNumber("vendor_payment", bizId, null)
      .then((res) => setVpNumberPreview(res.data?.nextNumber || ""))
      .catch(() => setVpNumberPreview(""));
  }, [selectedStatus, invoice?._id]);

  useEffect(() => {
    if (
      invoice &&
      (selectedStatus === "Make Transaction" ||
        invoice.status === "Make Transaction")
    ) {
      const fetchBankAccounts = async () => {
        try {
          const businessId = invoice.business?._id || invoice.business;
          const response = await axios.get(
            `${Base_URL}/bank-management/accounts`,
            {
              params: { business: businessId },
              headers: { authorization: `Bearer ${adminInfo.token}` },
            },
          );
          setBankAccounts(response.data.accounts || []);
        } catch (error) {
          notifyError(
            vi("fetchBankAccountsFailed", "Failed to fetch bank accounts"),
          );
        }
      };
      fetchBankAccounts();
    }
  }, [invoice, selectedStatus]);

  useEffect(() => {
    if (
      selectedBankAccount &&
      amountToPay &&
      selectedStatus === "Make Transaction"
    ) {
      handleBankAccountChange(selectedBankAccount._id);
    }
    // eslint-disable-next-line
  }, [amountToPay]);

  const getNextPendingStatus = (invoiceData) => {
    const status = invoiceData?.status;
    if (!status) return "";
    if (status === "Make Transaction") {
      const hasPending = Array.isArray(invoiceData.payments)
        ? invoiceData.payments.some((p) => p.status === "Pending")
        : false;
      // Resume payment setup if intent was cancelled; otherwise go to approval
      return hasPending ? "Approve Transaction" : "Make Transaction";
    }
    const transitions = validStatusTransitions[status] || [];
    return transitions.find((s) => s !== "Cancelled") || status;
  };

  const fetchInvoice = async (options = {}) => {
    const { preferNextAction = true } = options;
    setLoading(true);
    try {
      const response = await axios.get(`${Base_URL}/vendor-invoices/${id}`, {
        headers: {
          authorization: `Bearer ${adminInfo.token}`,
        },
      });
      const data = response.data.data;
      setInvoice(data);
      // Resume at the next pending action so the user can continue without re-selecting
      setSelectedStatus(
        preferNextAction ? getNextPendingStatus(data) : data.status,
      );
    } catch (error) {
      console.log("Error: ", error);
      notifyError(
        vi("fetchInvoiceDetailsFailed", "Failed to fetch invoice details"),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadVendorPaymentSlip = async (payment, idx) => {
    const receiptKey = payment?._id || `${idx ?? 0}`;
    try {
      setDownloadingReceiptId(receiptKey);
      const businessId = invoice?.business?._id ?? invoice?.business;
      await downloadPaymentReceiptSlip({
        token: adminInfo?.token,
        businessId: businessId ? String(businessId) : "",
        invoice,
        payment,
        kind: "vendor",
        paymentIndex: idx,
      });
      notifySuccess(vi("paymentSlipDownloaded", "Payment slip downloaded"));
    } catch (e) {
      console.error(e);
      notifyError(vi("downloadSlipFailed", "Failed to download slip"));
    } finally {
      setDownloadingReceiptId(null);
    }
  };

  const getDocumentForStatus = (status) => {
    if (!invoice?.documents) return null;
    const docs = invoice.documents.filter((doc) => doc.status === status);
    return docs.length > 0 ? docs[docs.length - 1] : null;
  };

  const handleStatusChange = (e) => {
    setSelectedStatus(e.target.value);
  };

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
  };

  const handleBankAccountChange = async (accountId) => {
    if (!accountId) {
      setSelectedBankAccount(null);
      setConversionDetails(null);
      return;
    }
    const account = bankAccounts.find((acc) => acc._id === accountId);
    if (!account) {
      notifyError(vi("bankAccountNotFound", "Bank account not found"));
      return;
    }
    setSelectedBankAccount(account);
    const payAmount =
      parseFloat(amountToPay) || invoice.remainingAmount || invoice.total;
    if (account.currencyType !== invoice.currency && payAmount > 0) {
      setIsLoadingConversion(true);
      try {
        const response = await axios.get(`${Base_URL}/currency/convert`, {
          params: {
            from: invoice.currency,
            to: account.currencyType,
            amount: payAmount,
            businessId: invoice.business?._id || invoice.business,
          },
          headers: { authorization: `Bearer ${adminInfo.token}` },
        });
        if (response.data.success) {
          setConversionDetails({
            fromCurrency: account.currencyType,
            toCurrency: invoice.currency,
            paidAmount: payAmount,
            requiredAmount: response.data.convertedAmount,
            exchangeRate: response.data.rate,
            accountBalance: account.openingBalance || account.balance,
            hasSufficientFunds:
              (account.openingBalance || account.balance) >=
              response.data.convertedAmount,
            displayText:
              response.data.displayText ||
              `${payAmount} ${invoice.currency} = ${response.data.convertedAmount} ${account.currencyType}`,
          });
        } else {
          setConversionDetails(null);
          notifyError(
            response.data.error ||
              vi("currencyConversionFailed", "Currency conversion failed"),
          );
        }
      } catch (error) {
        setConversionDetails(null);
        notifyError(vi("currencyConversionError", "Currency conversion error"));
      } finally {
        setIsLoadingConversion(false);
      }
    } else {
      setConversionDetails({
        fromCurrency: account.currencyType,
        toCurrency: invoice.currency,
        paidAmount: payAmount,
        requiredAmount: payAmount,
        exchangeRate: 1,
        accountBalance: account.openingBalance || account.balance,
        hasSufficientFunds:
          (account.openingBalance || account.balance) >= payAmount,
        displayText: `${payAmount} ${invoice.currency} = ${payAmount} ${account.currencyType} (Same Currency)`,
      });
    }
  };

  const handleAmountChange = (e) => {
    const val = e.target.value;
    setAmountToPay(val);
    if (selectedBankAccount) {
      handleBankAccountChange(selectedBankAccount._id);
    }
  };

  const handleUploadAndStatusUpdatePatched = async () => {
    const isMakeTransactionRetry =
      selectedStatus === "Make Transaction" &&
      invoice.status === "Make Transaction" &&
      !hasPendingPayment;
    if (
      !selectedStatus ||
      (selectedStatus === invoice.status && !isMakeTransactionRetry)
    ) {
      notifyError(vi("selectNewStatus", "Please select a new status"));
      return;
    }
    if (selectedStatus === "Make Transaction") {
      const payAmount = parseFloat(amountToPay);
      if (!payAmount || payAmount <= 0) {
        notifyError(vi("enterValidAmountToPay", "Enter a valid amount to pay"));
        return;
      }
      // Compare against normalizedRemainingAmount to avoid float precision issues
      if (payAmount > normalizedRemainingAmount) {
        notifyError(
          vi(
            "amountExceedsRemaining",
            "Amount exceeds remaining invoice amount",
          ),
        );
        return;
      }
      if (
        selectedBankAccount &&
        conversionDetails &&
        !conversionDetails.hasSufficientFunds
      ) {
        notifyError(
          vi(
            "insufficientFunds",
            "Insufficient funds in selected bank account",
          ),
        );
        return;
      }
    }
    if (
      selectedStatus === "Approve Transaction" &&
      invoice.payments?.length > 0
    ) {
      const lastPayment = invoice.payments[invoice.payments.length - 1];
      if (!lastPayment) {
        notifyError(
          vi("noPaymentIntentToApprove", "No payment intent found to approve"),
        );
        return;
      }
    }
    setUploading(true);
    setUploadProgress(0);
    try {
      let documentData = null;
      if (selectedFile) {
        const formDataForUpload = new FormData();
        formDataForUpload.append(
          "file_path",
          `VendorInvoices/${invoice.invoiceNumber}`,
        );
        formDataForUpload.append("business_id", invoice.business._id);
        formDataForUpload.append("customer_id", "67875f6b9d9ca959a461317e");
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
                (progressEvent.loaded * 100) / progressEvent.total,
              );
              setUploadProgress(percentCompleted);
            },
          },
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

      const updateData = {
        status: selectedStatus,
        ...(documentData && { documents: documentData }),
        ...(selectedStatus === "Make Transaction" && {
          amount: parseFloat(amountToPay),
          paymentBankAccount: selectedBankAccount?._id || null,
          conversionDetails: conversionDetails || null,
        }),
      };

      const updateResponse = await axios.put(
        `${Base_URL}/vendor-invoices/${invoice._id}`,
        updateData,
      );

      if (updateResponse.data.success) {
        setUploadSuccess(true);
        const nextPending = getNextPendingStatus({
          status: selectedStatus,
          payments:
            selectedStatus === "Make Transaction"
              ? [
                  ...(Array.isArray(invoice.payments) ? invoice.payments : []),
                  { status: "Pending" },
                ]
              : invoice.payments,
        });
        const isFullyComplete =
          selectedStatus === "Approve Transaction" ||
          !validStatusTransitions[selectedStatus]?.some(
            (s) => s !== "Cancelled",
          );
        setSuccessMessage(
          documentData
            ? vi(
                "statusUpdatedAndDocumentUploaded",
                "Status updated and document uploaded successfully!",
              )
            : isFullyComplete
              ? vi(
                  "paymentProcessComplete",
                  "Payment process complete!",
                )
              : vi(
                  "statusUpdatedContinueNext",
                  "Step completed. Continue with the next action below.",
                ),
        );
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setTimeout(async () => {
          setUploadSuccess(false);
          setSuccessMessage("");
          await fetchInvoice({ preferNextAction: !isFullyComplete });
          if (!isFullyComplete && nextPending) {
            setSelectedStatus(nextPending);
          }
        }, 800);
      }
    } catch (error) {
      console.error("Upload error:", error);
      notifyError(
        error.response?.data?.error ||
          vi(
            "updateOrUploadFailed",
            "Failed to update status or upload document",
          ),
      );
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleOpenFile = async (documentId) => {
    if (!documentId) return;

    try {
      const response = await axios.get(
        `${Base_URL}/documents/getFileWithAllData/${documentId}`,
        {
          headers: { authorization: `Bearer ${adminInfo?.token}` },
        },
      );
      const fileData = response.data?.data;
      const viewUrl = fileData?.url || fileData?.downloadUrl;

      if (!viewUrl) {
        notifyError(
          vi(
            "viewLinkUnavailable",
            "View link not available for this document.",
          ),
        );
        return;
      }

      window.open(viewUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      notifyError(
        vi("openDocumentFailed", "Failed to open document. Please try again."),
      );
      console.log("Error: ", error);
    }
  };

  const handleDownloadFile = async (documentId) => {
    if (!documentId) return;

    try {
      const response = await axios.get(
        `${Base_URL}/documents/getFileWithAllData/${documentId}`,
        {
          headers: { authorization: `Bearer ${adminInfo?.token}` },
        },
      );
      console.log("response", response.data);

      const fileData = response.data?.data;
      const downloadUrl = fileData?.downloadUrl || fileData?.url;
      const fileName = fileData?.name || "document";

      if (!downloadUrl) {
        notifyError(
          vi(
            "downloadLinkUnavailable",
            "Download link not available for this document.",
          ),
        );
        return;
      }

      await downloadFileFromUrl(downloadUrl, fileName);
    } catch (error) {
      console.error("Error getting file:", error);
      notifyError(
        vi("downloadFailed", "Failed to download file. Please try again."),
      );
    }
  };

  const downloadFileFromUrl = async (url, filename) => {
    try {
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      link.style.display = "none";

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      console.log(`File download triggered: ${filename}`);
    } catch (error) {
      console.error("Error downloading file:", error);
      throw error;
    }
  };

  // 4. Fix isUpdateStatusEnabled to allow amountToPay === remainingAmount
  const isUpdateStatusEnabled = () => {
    if (selectedStatus === "Make Transaction") {
      return (
        Number(amountToPay) > 0 &&
        // Use normalizedRemainingAmount so 0.02 is treated as equal to 0.02 even with float noise
        Number(amountToPay) <= normalizedRemainingAmount &&
        (!selectedBankAccount ||
          !conversionDetails ||
          conversionDetails.hasSufficientFunds !== false) &&
        !hasPendingPayment
      );
    }
    if (selectedStatus === "Approve Transaction") {
      return hasPendingPayment;
    }
    return true;
  };

  // Add cancel pending payment logic
  const handleCancelPendingPayment = async () => {
    if (!pendingPayment) return;
    try {
      setLoading(true);
      await axios.patch(
        `${Base_URL}/vendor-invoices/${invoice._id}/cancel-pending-payment`,
        {
          paymentId: pendingPayment._id,
        },
        { headers: { authorization: `Bearer ${adminInfo.token}` } },
      );
      // Refetch invoice data after cancel
      await fetchInvoice();
      notifySuccess(
        vi(
          "pendingPaymentCancelled",
          "Pending payment cancelled. You can now create a new payment.",
        ),
      );
    } catch (error) {
      notifyError(
        vi("cancelPendingPaymentFailed", "Failed to cancel pending payment."),
      );
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--p-blue)] mx-auto mb-4"></div>
          <p className="text-gray-600">
            {vi("loadingInvoiceDetails", "Loading invoice details...")}
          </p>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            {vi("invoiceNotFound", "Invoice Not Found")}
          </h2>
          <p className="text-gray-600 mb-4">
            {vi(
              "requestedInvoiceNotFound",
              "The requested invoice could not be found.",
            )}
          </p>
          <button
            onClick={() => history.goBack()}
            className="px-4 py-2 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[#9CBA33] transition-colors"
          >
            {vi("goBack", "Go Back")}
          </button>
        </div>
      </div>
    );
  }

  // Compute effective display status:
  // If the invoice is fully paid (from daily report or otherwise), show "Approve Transaction"
  // even if the raw DB status hasn't been advanced through the workflow.
  const isPaidFromDailyReport =
    invoice &&
    parseFloat(invoice.total) > 0 &&
    totalPaid >= parseFloat(invoice.total);
  const displayStatus = isPaidFromDailyReport
    ? "Approve Transaction"
    : invoice.status;

  const StatusIcon = statusConfig[displayStatus]?.icon || FileText;
  const statusTimeline = [
    "Draft",
    "Created",
    "Approved by Management",
    "Make Transaction",
    "Approve Transaction",
  ];
  const currentStatusIdx = statusTimeline.indexOf(displayStatus);

  return (
    <div className="p-6 bg-gray-50 h-full max-h-[90vh] overflow-y-auto pb-[120px] ">
      <div className="mb-6">
        <BackButton />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className={`p-3 rounded-lg ${
                statusConfig[displayStatus]?.bgColor
              }`}
            >
              <StatusIcon
                className={`h-6 w-6 ${statusConfig[displayStatus]?.textColor}`}
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {vi("invoiceNumberHeading", "Invoice #{{number}}", {
                  number: invoice.invoiceNumber,
                })}
              </h1>
              <p className="text-gray-600 mt-1">
                {translateStatusDescription(displayStatus)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`px-4 py-2 rounded-full text-sm font-medium border ${
                statusConfig[displayStatus]?.color
              }`}
            >
              {translateStatus(displayStatus)}
            </span>
            <button
              onClick={() =>
                history.push(`/update-vendor-invoice/${invoice._id}`)
              }
              className="flex items-center gap-2 px-4 py-2 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[#9CBA33] transition-colors"
            >
              <Edit3 size={16} />
              {vi("editInvoice", "Edit Invoice")}
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {vi("vendorInvoiceNumberHeading", "Vendor Invoice #{{number}}", {
            number: invoice.invoiceNumber,
          })}
        </h1>
        {hasPendingClearance && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-amber-100 text-amber-900 border border-amber-300">
            <svg
              className="w-4 h-4 mr-1 text-amber-600"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" />
            </svg>
            {vi("pendingClearance", "Pending Clearance")}
          </span>
        )}
        {invoice.amountPaid &&
          invoice.amountPaid !== 0 &&
          invoice.amountPaid < invoice.total &&
          !hasPendingClearance && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-yellow-100 text-yellow-800 border border-yellow-300">
              <svg
                className="w-4 h-4 mr-1 text-yellow-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13v4l3 3-1.5 1.5L9 9.5V5h2z" />
              </svg>
              {vi("partialPaid", "Partial Paid")}
            </span>
          )}
        {invoice.amountPaid === invoice.total && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-800 border border-green-300">
            <svg
              className="w-4 h-4 mr-1 text-green-500"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M16.707 5.293a1 1 0 00-1.414 0L9 11.586 6.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l7-7a1 1 0 000-1.414z" />
            </svg>
            {vi("paid", "Paid")}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-[var(--p-blue)]" />
              {vi("invoiceInformation", "Invoice Information")}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Building className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">
                      {vi("business", "Business")}
                    </p>
                    <p className="font-medium text-gray-900">
                      {invoice.business?.name}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">
                      {vi("vendor", "Vendor")}
                    </p>
                    <p className="font-medium text-gray-900">
                      {invoice.vendor?.basicInformation?.vendorDisplayName}
                    </p>
                  </div>
                </div>

                {invoice.vendor?.bankInfo && (
                  <div className="flex items-start gap-3">
                    <CreditCard className="h-5 w-5 text-gray-400 mt-1" />
                    <div>
                      <p className="text-sm text-gray-500">
                        {vi("bankInformation", "Bank Information")}
                      </p>
                      <div className="mt-2 space-y-1">
                        <p className="font-medium text-gray-900">
                          {invoice.vendor.bankInfo.bankDetails?.bankName ||
                            vi("na", "N/A")}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">
                      {vi("invoiceDate", "Invoice Date")}
                    </p>
                    <p className="font-medium text-gray-900">
                      {formatDate(invoice.invoiceDate)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">
                      {vi("dueDate", "Due Date")}
                    </p>
                    <p className="font-medium text-gray-900">
                      {formatDate(invoice.dueDate)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">
                      {vi("terms", "Terms")}
                    </p>
                    <p className="font-medium text-gray-900">{invoice.terms}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Package className="h-5 w-5 text-[var(--p-blue)]" />
              {vi("invoiceItems", "Invoice Items")}
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-700">
                      {vi("itemName", "Item Name")}
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">
                      {vi("description", "Description")}
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-gray-700">
                      {vi("quantity", "Quantity")}
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-gray-700">
                      {vi("unitPrice", "Unit Price")}
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-gray-700">
                      {vi("discount", "Discount")}
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-gray-700">
                      {vi("tax", "Tax")}
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-gray-700">
                      {vi("amount", "Amount")}
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">
                      {vi("expenseAccount", "Expense Account")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items?.map((item, idx) => {
                    const quantity = parseFloat(item.quantity) || 1;
                    const unitPrice = parseFloat(item.unitPrice) || 0;
                    const discount = parseFloat(item.discount) || 0;
                    const taxRate = parseFloat(item.taxRate) || 0;
                    const lineSubtotal =
                      quantity * unitPrice * (1 - (discount || 0) / 100);
                    const taxAmount = (lineSubtotal * taxRate) / 100;
                    const total = lineSubtotal + taxAmount;

                    return (
                      <tr
                        key={idx}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="py-4 px-4">
                          <p className="font-medium text-gray-900">
                            {item.itemName || "—"}
                          </p>
                        </td>
                        <td className="py-4 px-4">
                          <div>
                            <p className="font-medium text-gray-900">
                              {item.description}
                            </p>
                            {item.itemType && (
                              <p className="text-sm text-gray-500 capitalize">
                                {item.itemType.replace("_", " ")}
                                {item.itemType === "commission" &&
                                  item.totalAgentCommission && (
                                    <span className="ml-2 text-[var(--p-blue)]">
                                      Total Commission:{" "}
                                      {formatCurrencyAmount(
                                        invoice.currency,
                                        item.totalAgentCommission,
                                      )}
                                    </span>
                                  )}
                              </p>
                            )}
                            {item.itemType === "commission" &&
                              item.contractType && (
                                <p className="text-xs text-gray-400 mt-1">
                                  {item.contractType === "sales"
                                    ? vi("salesContract", "Sales Contract")
                                    : vi(
                                        "purchaseContract",
                                        "Purchase Contract",
                                      )}{" "}
                                  {vi("commission", "Commission")}
                                </p>
                              )}
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right text-gray-900">
                          {item.quantity}
                        </td>
                        <td className="py-4 px-4 text-right text-gray-900">
                          {formatCurrencyAmount(
                            invoice.currency,
                            item.unitPrice,
                          )}
                        </td>
                        <td className="py-4 px-4 text-right text-gray-900">
                          {formatCurrencyAmount(invoice.currency, discount)}
                        </td>
                        <td className="py-4 px-4 text-right text-gray-900">
                          {taxRate > 0 ? (
                            <div>
                              <div className="font-medium">{taxRate}%</div>
                              <div className="text-xs text-gray-500">
                                {formatCurrencyAmount(
                                  invoice.currency,
                                  taxAmount,
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-right font-semibold text-gray-900">
                          {formatCurrencyAmount(
                            invoice.currency,
                            item.total || item.amount || total,
                          )}
                        </td>
                        <td className="py-4 px-4 text-left text-gray-900">
                          {item.expenseAccount ? (
                            <div>
                              <div className="font-medium text-blue-600">
                                {item.expenseAccount.code || vi("na", "N/A")} -{" "}
                                {item.expenseAccount.accountName ||
                                  vi("unknownAccount", "Unknown Account")}
                              </div>
                              <div className="text-xs text-gray-500">
                                {item.expenseAccount.accountType?.name ||
                                  item.expenseAccount.accountType
                                    ?.accountHeader ||
                                  ""}
                              </div>
                            </div>
                          ) : invoice.expenseAccount ? (
                            <div>
                              <div className="font-medium text-green-600">
                                {invoice.expenseAccount.code || vi("na", "N/A")}{" "}
                                -{" "}
                                {invoice.expenseAccount.accountName ||
                                  vi("mainAccount", "Main Account")}
                              </div>
                              <div className="text-xs text-gray-500">
                                {vi(
                                  "mainExpenseAccount",
                                  "Main expense account",
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="text-gray-500 italic">
                              {vi("noAccountSpecified", "No account specified")}
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

          {invoice.documents &&
            invoice.documents.filter((doc) => doc.documentType === "Supporting")
              .length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-[var(--p-blue)]" />
                  {vi("supportingDocuments", "Supporting Documents")}
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {invoice.documents
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
                                {vi("uploaded", "Uploaded:")}{" "}
                                {formatDate(doc.uploadedAt)}
                              </span>
                              {doc.size && (
                                <span>
                                  {vi("size", "Size:")}{" "}
                                  {(doc.size / 1024 / 1024).toFixed(2)} MB
                                </span>
                              )}
                            </div>
                            <div className="flex gap-2 mt-3">
                              <button
                                onClick={() => handleOpenFile(doc.fileId)}
                                className="text-sm text-[var(--p-blue)] hover:underline flex items-center gap-1"
                              >
                                <FileText size={14} />
                                {vi("view", "View")}
                              </button>
                              <button
                                onClick={() => handleDownloadFile(doc.fileId)}
                                className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                              >
                                <Package size={14} />
                                {vi("download", "Download")}
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

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-[var(--p-blue)]" />
              {vi("invoiceTotals", "Invoice Totals")}
            </h2>

            <div className="space-y-3">
              <div className="flex justify-between text-gray-600">
                <span>{vi("subtotal", "Subtotal")}</span>
                <span className="font-medium">
                  {formatCurrencyAmount(invoice.currency, invoice.subtotal)}
                </span>
              </div>

              {invoice.discountAmount > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>
                    {vi("discountPercent", "Discount ({{percent}}%)", {
                      percent: invoice.discount,
                    })}
                  </span>
                  <span className="font-medium text-red-600">
                    -
                    {formatCurrencyAmount(
                      invoice.currency,
                      invoice.discountAmount,
                    )}
                  </span>
                </div>
              )}

              {invoice.shipping > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>{vi("shipping", "Shipping")}</span>
                  <span className="font-medium">
                    {formatCurrencyAmount(invoice.currency, invoice.shipping)}
                  </span>
                </div>
              )}

              {invoice.adjustments !== 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>{vi("adjustments", "Adjustments")}</span>
                  <span
                    className={`font-medium ${
                      invoice.adjustments >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {invoice.adjustments >= 0 ? "+" : ""}
                    {formatCurrencyAmount(
                      invoice.currency,
                      Math.abs(invoice.adjustments),
                    )}
                  </span>
                </div>
              )}

              <div className="border-t pt-3">
                <div className="flex justify-between text-lg font-bold text-gray-900">
                  <span>
                    {vi("totalWithCurrency", "Total ({{currency}})", {
                      currency: invoice.currency,
                    })}
                  </span>
                  <span className="text-[var(--p-blue)]">
                    {formatCurrencyAmount(invoice.currency, invoice.total)}
                  </span>
                </div>
              </div>
              {invoice && (
                <>
                  <div className="flex justify-between text-gray-600 mt-2">
                    <span>{vi("totalPaid", "Total Paid")}</span>
                    <span className="font-medium text-green-600">
                      {formatCurrencyAmount(invoice.currency, totalPaid)}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>{vi("remainingAmount", "Remaining Amount")}</span>
                    <span className="font-medium text-red-600">
                      {formatCurrencyAmount(
                        invoice.currency,
                        normalizedRemainingAmount,
                      )}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">
              {vi("bankingInformation", "Banking Information")}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-md font-medium mb-3 text-gray-700">
                  {vi("vendorBankDetails", "Vendor Bank Details")}
                </h4>
                {invoice.vendor?.bankInfo &&
                (invoice.vendor.bankInfo.bankDetails ||
                  invoice.vendor.bankInfo.bankAccountDetails) ? (
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm text-gray-500">
                        {vi("bankName", "Bank Name:")}
                      </span>
                      <p className="text-sm font-medium text-gray-900">
                        {invoice.vendor.bankInfo.bankDetails?.bankName ||
                          vi("notProvided", "Not provided")}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">
                        {vi("accountName", "Account Name:")}
                      </span>
                      <p className="text-sm font-medium text-gray-900">
                        {invoice.vendor.bankInfo.bankAccountDetails
                          ?.accountName || vi("notProvided", "Not provided")}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">
                        {vi("accountNumber", "Account Number:")}
                      </span>
                      <p className="text-sm font-medium text-gray-900">
                        {invoice.vendor.bankInfo.bankAccountDetails
                          ?.accountNumber || vi("notProvided", "Not provided")}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">
                        {vi("swiftCode", "SWIFT Code:")}
                      </span>
                      <p className="text-sm font-medium text-gray-900">
                        {invoice.vendor.bankInfo.bankAccountDetails
                          ?.swiftCode || vi("notProvided", "Not provided")}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">
                        {vi("bankAddress", "Bank Address:")}
                      </span>
                      <p className="text-sm font-medium text-gray-900">
                        {invoice.vendor.bankInfo.bankDetails?.bankAddress ||
                          vi("notProvided", "Not provided")}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 italic">
                    {vi(
                      "noBankAccountForVendor",
                      "No bank account for this vendor.",
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Payment History Section */}
      {invoice && invoice.payments && invoice.payments.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() =>
              setIsPaymentHistoryExpanded(!isPaymentHistoryExpanded)
            }
          >
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-[var(--p-blue)]" />
              {vi(
                "paymentHistoryCount",
                "Payment History ({{count}} payments)",
                { count: invoice.payments.length },
              )}
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">
                {isPaymentHistoryExpanded
                  ? vi("collapse", "Collapse")
                  : vi("expand", "Expand")}
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
                        {vi("paymentNumber", "Payment #")}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 border-b">
                        {vi("date", "Date")}
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 border-b">
                        {vi("amountPaid", "Amount Paid")}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 border-b">
                        {vi("currency", "Currency")}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 border-b">
                        {vi("bankAccount", "Bank Account")}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 border-b">
                        {vi("exchangeRate", "Exchange Rate")}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 border-b">
                        {vi("reference", "Reference")}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 border-b">
                        {vi("status", "Status")}
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 border-b w-[100px]">
                        {vi("slip", "Slip")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.payments.map((p, idx) => {
                      const bankPop = p.bankAccount;
                      const legacyBank = Array.isArray(bankAccounts)
                        ? bankAccounts.find((b) => b._id === p.bankAccount)
                        : undefined;
                      const paymentNo =
                        (p.paymentNumber || invoice.vendorPaymentNumber || "")
                          .toString()
                          .trim() || "—";
                      const rate =
                        p.conversionDetails?.conversionRate ??
                        p.conversionDetails?.exchangeRate ??
                        p.conversionDetails?.rate;
                      return (
                        <tr
                          key={idx}
                          className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-4 py-3 text-sm align-middle">
                            <span className="inline-block font-mono text-xs font-semibold text-gray-800 bg-gray-100 px-2 py-0.5 rounded">
                              {paymentNo}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {p.date ? formatDate(p.date) : "-"}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900">
                            {p.amount}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {p.currency || invoice.currency}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {bankPop?.accountName ||
                              legacyBank?.accountName ||
                              "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {rate != null && rate !== ""
                              ? Number(rate).toLocaleString(undefined, {
                                  maximumFractionDigits: 8,
                                })
                              : "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {p.chequeId ? (
                              <ChequeNumberLink
                                chequeId={p.chequeId}
                                chequeNumber={
                                  p.reference || vi("viewCheque", "View cheque")
                                }
                              />
                            ) : (
                              p.reference || "-"
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                p.status === "Approved"
                                  ? "bg-green-100 text-green-800"
                                  : p.status === "Pending Clearance"
                                    ? "bg-amber-100 text-amber-900"
                                    : p.status === "Pending"
                                      ? "bg-yellow-100 text-yellow-800"
                                      : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {translateStatus(p.status || "Pending")}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {p.status === "Approved" ? (
                              <button
                                type="button"
                                onClick={() =>
                                  handleDownloadVendorPaymentSlip(p, idx)
                                }
                                disabled={
                                  downloadingReceiptId ===
                                  (p?._id || `${idx ?? 0}`)
                                }
                                className="inline-flex p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
                                title={
                                  downloadingReceiptId ===
                                  (p?._id || `${idx ?? 0}`)
                                    ? vi("preparingSlip", "Preparing slip...")
                                    : vi(
                                        "downloadPaymentSlip",
                                        "Download payment slip",
                                      )
                                }
                                aria-label={vi(
                                  "downloadPaymentSlip",
                                  "Download payment slip",
                                )}
                              >
                                {downloadingReceiptId ===
                                (p?._id || `${idx ?? 0}`) ? (
                                  <Loader2 size={18} className="animate-spin" />
                                ) : (
                                  <Download size={18} />
                                )}
                              </button>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
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

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <Clock className="h-5 w-5 text-[var(--p-blue)]" />
          {vi("statusTimelineAndDocuments", "Status Timeline & Documents")}
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
                  {index < statusTimeline.length - 1 && (
                    <>
                      <div
                        className={`hidden sm:block absolute top-6 left-6 w-full h-0.5 ${
                          isCompleted ? "bg-[var(--p-blue)]" : "bg-gray-200"
                        }`}
                        style={{ width: "calc(100% + 1.5rem)" }}
                      />
                      <div
                        className={`sm:hidden absolute top-12 left-1/2 transform -translate-x-1/2 w-0.5 h-12 ${
                          isCompleted ? "bg-[var(--p-blue)]" : "bg-gray-200"
                        }`}
                      />
                    </>
                  )}

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

                  <div className="mt-3 text-center">
                    <p
                      className={`text-sm font-medium ${
                        isCompleted ? "text-gray-900" : "text-gray-500"
                      }`}
                    >
                      {translateStatus(status)}
                    </p>
                    {isCurrent && (
                      <p className="text-xs text-[var(--p-blue)] mt-1">
                        {vi("current", "Current")}
                      </p>
                    )}
                  </div>

                  {/* {(() => {
                    const doc = getDocumentForStatus(status);
                    return doc ? (
                      <div className="mt-2 flex items-center gap-2">
                        <FileText size={14} className="text-[var(--p-blue)]" />
                        <button
                          onClick={() => handleOpenFile(doc.fileId)}
                          className="text-xs text-[var(--p-blue)] hover:underline"
                          title={doc.name}
                        >
                          View Document
                        </button>
                      </div>
                    ) : isCompleted && status !== "Draft" ? (
                      <div className="mt-2 text-xs text-gray-400">
                        No document
                      </div>
                    ) : null;
                  })()} */}
                </div>
              );
            })}
          </div>
        </div>

        {validStatusTransitions[displayStatus]?.length > 0 && (
          <div className="border-t pt-6">
            <div className="mb-4">
              <h3 className="text-md font-medium text-gray-900">
                {vi("paymentProcess", "Payment Process")}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {vi(
                  "paymentProcessHint",
                  "Complete each step in order. You can leave anytime and continue later from the next pending action.",
                )}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {vi("newStatus", "New Status")}
                  </label>
                  <div className="relative">
                    <select
                      value={selectedStatus}
                      onChange={handleStatusChange}
                      disabled={statusUpdating}
                      className="w-full p-3 border border-gray-300 rounded-lg appearance-none bg-white pr-10 focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                    >
                      <option value={invoice.status}>
                        {vi("currentStatus", "Current: {{status}}", {
                          status: translateStatus(invoice.status),
                        })}
                      </option>
                      {validStatusTransitions[invoice.status].map((status) => (
                        <option key={status} value={status}>
                          {translateStatus(status)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {vi("supportingDocument", "Supporting Document")}
                    <span className="text-xs text-blue-600 ml-1">
                      {vi("optional", "(Optional)")}
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      className="hidden"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-[var(--p-blue)] transition-colors flex items-center justify-center gap-2 text-gray-600 hover:text-[var(--p-blue)]"
                    >
                      <Upload size={20} />
                      {selectedFile
                        ? selectedFile.name
                        : vi("chooseFile", "Choose file...")}
                    </button>
                  </div>
                  {selectedFile && (
                    <div className="mt-2 flex items-center justify-between text-sm text-gray-600">
                      <span className="truncate mr-2">
                        {vi("selectedFile", "Selected: {{name}}", {
                          name: selectedFile.name,
                        })}
                      </span>
                      <button
                        onClick={() => {
                          setSelectedFile(null);
                          if (fileInputRef.current)
                            fileInputRef.current.value = "";
                        }}
                        className="text-red-500 hover:text-red-700 flex-shrink-0"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    {vi(
                      "uploadSupportingDocumentsHint",
                      "Upload supporting documents for this status change (Optional)",
                    )}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {uploading && (
                  <div>
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                      <span>{vi("uploading", "Uploading...")}</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-[var(--p-blue)] h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {uploadSuccess && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <p className="text-green-700 text-sm">{successMessage}</p>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleUploadAndStatusUpdatePatched}
                  disabled={
                    uploading ||
                    !selectedStatus ||
                    (selectedStatus === invoice.status &&
                      !(
                        selectedStatus === "Make Transaction" &&
                        !hasPendingPayment
                      )) ||
                    !isUpdateStatusEnabled()
                  }
                  className="w-full px-4 py-3 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[#9CBA33] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      {selectedFile
                        ? vi("uploadingAndUpdating", "Uploading & Updating...")
                        : vi("updatingStatus", "Updating Status...")}
                    </>
                  ) : (
                    <>
                      <CheckCircle size={16} />
                      {(() => {
                        const hasNext =
                          selectedStatus &&
                          selectedStatus !== "Approve Transaction" &&
                          (validStatusTransitions[selectedStatus] || []).some(
                            (s) => s !== "Cancelled",
                          );
                        if (selectedFile) {
                          return hasNext
                            ? vi(
                                "updateAndContinue",
                                "Update & Continue to Next Step",
                              )
                            : vi(
                                "updateStatusAndUpload",
                                "Update Status & Upload",
                              );
                        }
                        if (selectedStatus === "Approve Transaction") {
                          return vi(
                            "completePaymentProcess",
                            "Complete Payment Process",
                          );
                        }
                        return hasNext
                          ? vi(
                              "completeAndContinue",
                              "Complete Step & Continue",
                            )
                          : vi("updateStatus", "Update Status");
                      })()}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {selectedStatus === "Make Transaction" && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          {vpNumberPreview && (
            <div className="mb-4 p-3 bg-white border border-blue-200 rounded-lg flex items-center gap-3">
              <span className="text-sm text-gray-600">
                {vi("vendorPaymentNumber", "Vendor Payment #:")}
              </span>
              <span className="font-mono font-semibold text-blue-700">
                {vpNumberPreview}
              </span>
              <span className="text-xs text-gray-400">
                {vi("autoAssignedOnSave", "(auto-assigned on save)")}
              </span>
            </div>
          )}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {vi("selectBankAccountLabel", "Select Bank Account")}
            </label>
            <SearchableDropdown
              value={
                hasPendingPayment
                  ? pendingPayment.bankAccount
                  : selectedBankAccount?._id || ""
              }
              onChange={(e) =>
                !hasPendingPayment && handleBankAccountChange(e.target.value)
              }
              disabled={hasPendingPayment}
              placeholder={vi(
                "selectBankAccountPlaceholder",
                "Select Bank Account",
              )}
              searchPlaceholder={vi(
                "searchBankAccounts",
                "Search bank accounts...",
              )}
              options={bankAccounts.map((acc) => ({
                value: acc._id,
                label: acc.accountName,
              }))}
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {vi("amountToPay", "Amount to Pay ({{currency}})", {
                currency: getCurrencyDisplay(invoice.currency),
              })}{" "}
              <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              className="w-full p-3 border border-gray-300 rounded-lg"
              value={
                hasPendingPayment && pendingPayment?.amount != null
                  ? parseFloat(pendingPayment.amount).toFixed(2)
                  : amountToPay
              }
              onChange={(e) => {
                if (!hasPendingPayment) setAmountToPay(e.target.value);
              }}
              disabled={hasPendingPayment}
            />
          </div>
          {isLoadingConversion && (
            <div className="text-blue-600 text-sm mb-2">
              {vi(
                "loadingCurrencyConversion",
                "Loading currency conversion...",
              )}
            </div>
          )}
          {/* Show conversion details for current input if not pending */}
          {!hasPendingPayment && conversionDetails && (
            <div className="mt-2 text-sm">
              <div>
                <span>{vi("conversionRate", "Conversion Rate:")}</span>{" "}
                <b>{conversionDetails.exchangeRate}</b>
              </div>
              <div>
                <span>{vi("from", "From:")}</span>{" "}
                <b>{conversionDetails.fromCurrency}</b>{" "}
                <span>{vi("to", "To:")}</span>{" "}
                <b>{conversionDetails.toCurrency}</b>
              </div>
              <div>
                <span>{vi("requiredAmount", "Required Amount:")}</span>{" "}
                <b>{conversionDetails.requiredAmount}</b>
              </div>
              <div>
                {amountToPay} {conversionDetails.toCurrency} ={" "}
                {conversionDetails.requiredAmount}{" "}
                {conversionDetails.fromCurrency}
              </div>
              {!conversionDetails.hasSufficientFunds && (
                <div className="mt-2 text-red-600 font-semibold">
                  {vi(
                    "insufficientFundsMessage",
                    "Insufficient funds in selected bank account.",
                  )}
                </div>
              )}
            </div>
          )}
          {/* Show conversion details for pending payment if present */}
          {hasPendingPayment && pendingPayment.conversionDetails && (
            <div className="mt-2 text-sm text-blue-700 bg-blue-50 p-2 rounded">
              <div>
                {vi("conversionRate", "Conversion Rate:")}{" "}
                {pendingPayment.conversionDetails.exchangeRate}
              </div>
              <div>
                {vi("from", "From:")}{" "}
                {pendingPayment.conversionDetails.fromCurrency}{" "}
                {vi("to", "To:")} {pendingPayment.conversionDetails.toCurrency}
              </div>
              <div>
                {vi("requiredAmount", "Required Amount:")}{" "}
                {pendingPayment.conversionDetails.requiredAmount}
              </div>
            </div>
          )}
          {hasPendingPayment && (
            <div className="mt-2">
              <button
                className="px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 font-semibold"
                onClick={handleCancelPendingPayment}
                disabled={loading}
              >
                {vi("cancelPendingPayment", "Cancel Pending Payment")}
              </button>
            </div>
          )}
        </div>
      )}

      {selectedStatus === "Approve Transaction" && hasPendingPayment && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="mb-2 font-semibold text-gray-700">
            {vi(
              "pendingPaymentDetailsMaker",
              "Pending Payment Details (Maker)",
            )}
          </div>
          <div className="flex flex-wrap gap-6">
            <div>
              <div className="text-xs text-gray-500">
                {vi("amount", "Amount")}
              </div>
              <div className="font-bold text-lg">
                {formatCurrencyAmount(
                  pendingPayment.currency,
                  pendingPayment.amount,
                )}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">
                {vi("bankAccount", "Bank Account")}
              </div>
              <div className="font-medium">
                {(Array.isArray(bankAccounts)
                  ? bankAccounts.find(
                      (b) => b._id === pendingPayment.bankAccount,
                    )
                  : undefined
                )?.accountName || "-"}
              </div>
            </div>
            {pendingPayment.conversionDetails && (
              <div>
                <div className="text-xs text-gray-500">
                  {vi("conversionRateLabel", "Conversion Rate")}
                </div>
                <div className="font-medium">
                  {pendingPayment.conversionDetails.exchangeRate || "-"}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {console.log(invoice.payments)}

      {selectedStatus === "Make Transaction" &&
        Array.isArray(invoice.payments) &&
        invoice.payments.length > 0 &&
        invoice.status === "Make Transaction" && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="mb-2 font-semibold text-gray-700">
              {vi("pendingPaymentMaker", "Pending Payment (Maker)")}
            </div>
            <div className="flex flex-wrap gap-6">
              <div>
                <div className="text-xs text-gray-500">
                  {vi("amount", "Amount")}
                </div>
                <div className="font-bold text-lg">
                  {invoice.payments[invoice.payments.length - 1].amount}{" "}
                  {invoice.payments[invoice.payments.length - 1].currency}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">
                  {vi("bankAccount", "Bank Account")}
                </div>
                <div className="font-medium">
                  {(Array.isArray(bankAccounts)
                    ? bankAccounts.find(
                        (b) =>
                          b._id ===
                          invoice.payments[invoice.payments.length - 1]
                            .bankAccount,
                      )
                    : undefined
                  )?.accountName || "-"}
                </div>
              </div>
              {invoice.payments[invoice.payments.length - 1]
                .conversionDetails && (
                <div>
                  <div className="text-xs text-gray-500">
                    {vi("conversionRateLabel", "Conversion Rate")}
                  </div>
                  <div className="font-medium">
                    {invoice.payments[invoice.payments.length - 1]
                      .conversionDetails.exchangeRate || "-"}
                  </div>
                </div>
              )}
            </div>
            <div className="mt-2 text-sm text-gray-500">
              {vi(
                "cannotEditPaymentUntilApproved",
                "You cannot edit this payment until it is approved or rejected by the checker.",
              )}
            </div>
          </div>
        )}
    </div>
  );
};

export default ViewVendorInvoice;
