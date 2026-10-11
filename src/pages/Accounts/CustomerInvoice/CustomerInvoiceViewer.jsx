import { useTranslation } from "react-i18next";
import { customerInvoiceText as ciText } from "@/utils/customerInvoiceI18n";
import React, { useState, useEffect, useRef, useContext, useMemo } from "react";
import {
  ChevronLeft,
  Download,
  Mail,
  FileText,
  Edit,
  Bell,
  BellOff,
  Calendar,
  Printer,
  CheckCircle,
  Receipt,
  DollarSign,
  TrendingUp,
  MoreVertical,
  History,
} from "lucide-react";
import { useHistory, useParams, useLocation } from "react-router-dom";
import axios from "axios";
import InvoiceRenderer from "./components/InvoiceRenderer";
import { formatAmount, formatDate, formatCurrencyAmount } from "@/components/formatAmount";
import { notifyError, notifySuccess } from "@/utils/toast";
import ExpectedPaymentDateModal from "./ExpectedPaymentDateModal";
import CommentModal from "./components/CommentModal";
import EInvoicePanel from "./components/EInvoicePanel";
// PDF download: generated locally with html2canvas + jsPDF (no server call).
// Import the enhanced payment modal instead of the old one
import PaymentModal from "./components/PaymentModalFixed";
import PaymentsTable from "./components/PaymentsTable";
import InvoiceActivityTimeline from "./components/InvoiceActivityTimeline";
import { PageHeader } from "@/page-layouts/index";
import { AdminContext } from "@/context/AdminContext";
import CustomerInvoiceServices from "@/services/CustomerInvoiceServices";
import { formatInvoiceDownloadName } from "@/utils/generic";
import { enrichSavedRecordHtmlWithCustomFields } from "@/utils/customFieldsPdf";
import { fetchPdfPayload } from "@/services/customFieldServices";
import {
  sumLineGrossFromItems,
  sumLineTaxAmountsFromItems,
  computeInvoiceTotalFromHeader,
  resolveFlexaLineBillingTotal,
} from "@/utils/itemDiscountUtils";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
const MemoizedInvoiceRenderer = React.memo(InvoiceRenderer);

/**
 * Summary math matches PCI-BE/invoice-summary.md:
 * Subtotal = Σ (each line total incl. line discount + line tax).
 * Grand total applies header discount, shipping, adjustment on top of that subtotal.
 */
function computeInvoiceSummary(invoice = {}) {
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  /** Line-total billing: always roll up stored/computed line amounts when rows exist */
  const summarySubtotal =
    items.length > 0 ? sumLineGrossFromItems(items) : Number(invoice.subTotal ?? invoice.subtotal ?? 0);
  const taxTotal =
    items.length > 0
      ? sumLineTaxAmountsFromItems(items)
      : Number(invoice.taxTotal ?? invoice.tax ?? 0) || 0;

  const discountPct = Number(
    invoice.discountPercentage ?? invoice.discount ?? 0,
  );
  const providedDiscountAmount = Number(invoice.discountAmount);
  const discountAmount =
    Number.isFinite(providedDiscountAmount) && providedDiscountAmount > 0
      ? providedDiscountAmount
      : discountPct > 0 && discountPct <= 100
        ? (summarySubtotal * discountPct) / 100
        : 0;
  const shippingCharges = Number(
    invoice.shippingCharges ?? invoice.shipping ?? 0,
  );
  const adjustment = Number(invoice.adjustment ?? 0);

  const total = computeInvoiceTotalFromHeader({
    subtotal: summarySubtotal,
    discountAmount,
    shippingCharges,
    adjustment,
  });

  return {
    subtotal: summarySubtotal,
    taxTotal,
    discountAmount,
    shippingCharges,
    adjustment,
    total,
  };
}

/**
 * View-customer-invoice only: reconcile lines to PCI's tax-inclusive billing (qty×rate,
 * line discount %, + line tax). Zoho/header `subTotal` often excludes tax; we derive amounts
 * from lines and aliases (`qty`, `rate`, `item_tax_amount`, etc.) instead of trusting the header.
 */
function coerceLineItemForViewer(raw = {}) {
  const qty = Number(raw.quantity ?? raw.qty ?? 0);
  const rate = Number(raw.unitPrice ?? raw.rate ?? raw.price ?? 0);
  const discount = Number(raw.discount ?? 0);
  const taxRate = Number(
    raw.taxRate ?? raw.tax_percentage ?? raw.taxPercentage ?? raw.line_tax_rate ?? 0,
  );
  const rawTax = raw.taxAmount ?? raw.item_tax_amount ?? raw.tax;
  let taxExplicit;
  if (rawTax !== undefined && rawTax !== null && rawTax !== "") {
    const n = Number(rawTax);
    taxExplicit = Number.isFinite(n) ? n : undefined;
  }

  const next = {
    ...raw,
    quantity: qty,
    unitPrice: rate,
    discount,
    taxRate,
  };
  if (taxExplicit !== undefined) {
    next.tax = taxExplicit;
    next.taxAmount = taxExplicit;
  }
  return next;
}

function buildInvoiceViewModel(invoice) {
  if (!invoice || !Array.isArray(invoice.items) || invoice.items.length === 0) {
    return invoice;
  }

  const items = invoice.items.map((raw) => {
    if (raw?.isAdvancePayment) {
      return { ...raw };
    }
    const coerced = coerceLineItemForViewer(raw);
    const lineTotal = resolveFlexaLineBillingTotal(coerced);
    return {
      ...coerced,
      total: lineTotal,
      totalValue: lineTotal,
    };
  });

  const rolledSubtotal = sumLineGrossFromItems(items);
  const rolledTaxTotal = sumLineTaxAmountsFromItems(items);

  return {
    ...invoice,
    items,
    subTotal: rolledSubtotal,
    subtotal: rolledSubtotal,
    taxTotal: rolledTaxTotal,
  };
}

// PDF Viewer Iframe Component with timeout and error handling
const PdfViewerIframe = ({ pdfUrl, onError }) => {
  const iframeRef = useRef(null);
  const timeoutRef = useRef(null);
  const [iframeError, setIframeError] = useState(false);

  useEffect(() => {
    // Reset error state when URL changes
    setIframeError(false);

    // Set a timeout to detect if iframe fails to load (20 seconds)
    // If onLoad doesn't fire within 20 seconds, assume connection issue
    timeoutRef.current = setTimeout(() => {
      if (!iframeError) {
        console.warn(
          "PDF iframe loading timeout - connection may have been reset",
        );
        setIframeError(true);
        onError(
          new Error("PDF loading timeout - connection may have been reset"),
        );
      }
    }, 20000); // 20 second timeout

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [pdfUrl]); // Only depend on pdfUrl, not onError or iframeError

  const handleLoad = () => {
    // Clear timeout on successful load
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    console.log("Invoice PDF iframe loaded successfully");
    setIframeError(false);
  };

  const handleError = (e) => {
    console.error("Invoice PDF iframe error:", e);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIframeError(true);
    onError(new Error("Failed to load PDF - connection was reset"));
  };

  return (
    <iframe
      ref={iframeRef}
      src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
      title={ciText("Invoice PDF")}
      width="100%"
      height="1000px"
      style={{ border: "none", minHeight: "800px" }}
      className="w-full"
      onLoad={handleLoad}
      onError={handleError}
    />
  );
};

const CustomerInvoiceViewer = () => {
  useTranslation();
  // State variables
  const [invoice, setInvoice] = useState(null);
  const [templateData, setTemplateData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [tempSelectedTemplate, setTempSelectedTemplate] = useState(null);
  const [viewMode, setViewMode] = useState("preview"); // "preview" or "select"
  const [templatePreviews, setTemplatePreviews] = useState({});
  const [previewLoading, setPreviewLoading] = useState({});
  const [templateSwitching, setTemplateSwitching] = useState(false);
  const [isExpectedDateModalOpen, setIsExpectedDateModalOpen] = useState(false);
  const history = useHistory();
  const location = useLocation();
  const { id } = useParams();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state || {};
  console.log("invoice viewer", invoice);
  console.log("template data", templateData);

  // Comment modal state
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);

  const [reminderStatus, setReminderStatus] = useState("");
  const [isUpdatingReminder, setIsUpdatingReminder] = useState(false);

  // Dropdown states
  const [showPdfDropdown, setShowPdfDropdown] = useState(false);
  const [moreDropdownOpen, setMoreDropdownOpen] = useState(false);

  // Important refs for PDF generation
  const invoiceRef = useRef(null);
  const invoiceContainerRef = useRef(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Refs for dropdown click-outside detection
  const moreDropdownRef = useRef(null);

  // Add new state variables for payment modal and payments list
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [payments, setPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [viewerTab, setViewerTab] = useState("details");
  const [activityRefreshKey, setActivityRefreshKey] = useState(0);

  // Customer credit management state
  const [customerCredits, setCustomerCredits] = useState({});
  const [loadingCredits, setLoadingCredits] = useState(false);

  // Embedded PDF viewer state (similar to ViewSalesOrder)
  const [pdfUrl, setPdfUrl] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [pdfLoadTimeout, setPdfLoadTimeout] = useState(null);
  const documentUrlRef = useRef(null); // Store documentUrl for retries
  const [invoicePdfPayload, setInvoicePdfPayload] = useState(null);
  const [eInvoiceAutoApproval, setEInvoiceAutoApproval] = useState(false);

  const resolveEntityId = (raw) => {
    if (raw == null || raw === "") return "";
    if (typeof raw === "object") {
      return String(raw._id ?? raw.id ?? raw.$oid ?? "");
    }
    return String(raw);
  };

  /** Display-only billing: line roll-up + field aliases; API `invoice` stays unchanged for payments/API. */
  const invoiceViewModel = useMemo(
    () => (invoice ? buildInvoiceViewModel(invoice) : null),
    [invoice],
  );

  const invoiceSummary = useMemo(
    () => computeInvoiceSummary(invoiceViewModel || invoice || {}),
    [invoiceViewModel, invoice],
  );

  const getTemplateIdentifier = (template) =>
    resolveEntityId(template?._id || template?.id);

  const loadFullTemplate = async (templateOrId) => {
    const templateId =
      typeof templateOrId === "string"
        ? templateOrId
        : getTemplateIdentifier(templateOrId);
    if (!templateId) return typeof templateOrId === "object" ? templateOrId : null;
    if (
      typeof templateOrId === "object" &&
      (templateOrId?.htmlContent || templateOrId?.data?.htmlContent)
    ) {
      return templateOrId;
    }

    const templateResponse = await axios.get(
      `${Base_URL}/document-templates/${templateId}`,
    );
    return templateResponse.data?.data || templateResponse.data;
  };

  useEffect(() => {
    const bid =
      resolveEntityId(invoice?.business_id) ||
      resolveEntityId(invoice?.business);
    const rid =
      resolveEntityId(invoice?._id) ||
      resolveEntityId(invoice?.id) ||
      String(id || "");
    if (!invoice || !bid || !rid) {
      setInvoicePdfPayload(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const payload = await fetchPdfPayload(
          {
            businessId: bid,
            module: "sales",
            screen: "invoice",
            recordId: rid,
          },
          {
            "Content-Type": "application/json",
            ...(adminInfo?.token
              ? { authorization: `Bearer ${adminInfo.token}` }
              : {}),
          },
        );
        if (!cancelled) setInvoicePdfPayload(payload);
      } catch (e) {
        console.warn("Invoice PDF payload (preview):", e);
        if (!cancelled) setInvoicePdfPayload(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [invoice, id, adminInfo?.token]);

  // Fetch payments for this invoice
  const fetchPayments = async () => {
    if (!id) return;
    setPaymentsLoading(true);
    try {
      const res = await axios.get(
        `${Base_URL}/proforma-invoice/${id}/payments`,
      );
      setPayments(res.data.data || []);
    } catch (err) {
      setPayments([]);
    } finally {
      setPaymentsLoading(false);
    }
  };

  // Fetch PDF for invoice document using backend proxy (for embedded iframe) with retry logic
  const fetchInvoicePdfUrl = async (documentUrl, retryAttempt = 0) => {
    if (!documentUrl) return;

    // Store documentUrl for retries
    documentUrlRef.current = documentUrl;

    setPdfLoading(true);
    setPdfError(null);
    setRetryCount(retryAttempt);

    const maxRetries = 3;
    const baseDelay = 1000; // 1 second base delay

    try {
      // If already a full URL, use it directly
      if (
        typeof documentUrl === "string" &&
        (documentUrl.startsWith("http://") ||
          documentUrl.startsWith("https://"))
      ) {
        setPdfUrl(documentUrl);
        setPdfLoading(false);
        return;
      }

      // Create a timeout promise (15 seconds timeout)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error("Request timeout: Connection took too long"));
        }, 15000);
      });

      // Create the actual request promise - use backend proxy that streams PDF as blob
      const requestPromise = (async () => {
        const blob =
          await CustomerInvoiceServices.getInvoiceDocumentPdfBlob(documentUrl);
        // Create an object URL for the blob
        const objectUrl = URL.createObjectURL(blob);
        return { objectUrl };
      })();

      // Race between timeout and request
      const response = await Promise.race([requestPromise, timeoutPromise]);

      const objectUrl = response.objectUrl;

      if (objectUrl) {
        setPdfUrl(objectUrl);
        setRetryCount(0); // Reset retry count on success
      } else {
        throw new Error(ciText("No URL returned from server"));
      }
    } catch (error) {
      console.error(
        `Error fetching invoice PDF URL (attempt ${retryAttempt + 1}):`,
        error,
      );

      // Check if it's a connection reset error or timeout
      const isConnectionError =
        error.message?.includes("timeout") ||
        error.message?.includes("Connection") ||
        error.message?.includes("reset") ||
        error.message?.includes("ECONNRESET") ||
        error.code === "ECONNRESET" ||
        error.code === "ETIMEDOUT" ||
        (error.response?.status >= 500 && error.response?.status < 600);

      // Retry logic for connection errors
      if (isConnectionError && retryAttempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, retryAttempt); // Exponential backoff
        console.log(
          `Retrying PDF URL fetch in ${delay}ms (attempt ${retryAttempt + 1}/${maxRetries})`,
        );

        setTimeout(() => {
          fetchInvoicePdfUrl(documentUrl, retryAttempt + 1);
        }, delay);
        return; // Don't set error state yet, we're retrying
      }

      // If all retries failed or it's not a connection error, show error
      const errorMessage = isConnectionError
        ? ciText("Connection was reset. Please try again.")
        : error.response?.data?.message ||
          error.message ||
          ciText("Failed to load invoice PDF document");

      setPdfError(errorMessage);
    } finally {
      if (retryAttempt === 0 || retryAttempt >= maxRetries) {
        setPdfLoading(false);
      }
    }
  };

  // Manual retry function
  const handleRetryPdfLoad = () => {
    if (documentUrlRef.current) {
      fetchInvoicePdfUrl(documentUrlRef.current, 0);
    }
  };

  // Fetch customer credits
  const fetchCustomerCredits = async () => {
    if (!invoice?.customer_id?._id || !invoice?.business_id?._id) return;

    setLoadingCredits(true);
    try {
      const response = await axios.get(
        `${Base_URL}/customer-payment-history/customer/${invoice.customer_id._id}/business/${invoice.business_id._id}/balance`,
        {
          headers: { authorization: `Bearer ${adminInfo?.token}` },
        },
      );

      if (response.data.success) {
        setCustomerCredits(response.data.data);
        console.log(
          "✅ Customer credits loaded:",
          response.data.data.availableCredits,
        );
      }
    } catch (error) {
      console.error("❌ Error fetching customer credits:", error);
      setCustomerCredits({});
    } finally {
      setLoadingCredits(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchPayments();
      if (invoice?.customer_id?._id && invoice?.business_id?._id) {
        fetchCustomerCredits();
      }
    }
  }, [id, invoice?.customer_id?._id, invoice?.business_id?._id]);

  // Mark as sent handler
  const handleMarkAsSent = async () => {
    try {
      await axios.patch(`${Base_URL}/proforma-invoice/${id}/mark-sent`);
      setInvoice((prev) => ({ ...prev, sent: true }));
      fetchInvoiceData();
      setActivityRefreshKey((k) => k + 1);
      notifySuccess(ciText("Invoice marked as sent."));
    } catch (err) {
      notifyError(ciText("Failed to mark as sent."));
    }
    setMoreDropdownOpen(false);
  };

  // Record payment handler
  const handleRecordPayment = () => {
    // Check invoice status - Draft invoices cannot have payments recorded
    if (invoice?.status?.toLowerCase() === "draft") {
      notifyError(ciText("Please Save and Send the invoice before recording payment."));
      history.push(`/update-customer-invoice/${invoice._id}`, {
        fromPayment: true,
        message: "Please Save and Send the invoice before recording payment.",
      });
      return;
    }

    const invoiceStatus = invoice?.status?.toLowerCase();
    if (invoiceStatus === "cancelled") {
      notifyError(
        `Cannot record payment. Invoice status is ${invoice?.status}.`,
      );
      return;
    }

    const remaining = Number(invoice?.remaining);
    const openBalance = Number.isFinite(remaining)
      ? remaining
      : Number(invoice?.remaining || 0);
    if (!Number.isFinite(openBalance) || openBalance <= 0) {
      notifyError(ciText("Cannot record payment. Invoice is already fully paid."));
      return;
    }
    setIsPaymentModalOpen(true);
    setMoreDropdownOpen(false);
  };

  // Enhanced payment submission handler
  const handleSubmitPayment = async (paymentData) => {
    try {
      console.log("🚀 Submitting enhanced payment:", {
        paymentType: paymentData.paymentType,
        cashAmount: paymentData.cashPaymentAmount,
        creditsCount: paymentData.appliedCredits?.length || 0,
        totalCredits: paymentData.totalAppliedCredits,
      });

      // Submit payment with enhanced data structure
      const response = await axios.post(
        `${Base_URL}/proforma-invoice/${id}/payments`,
        {
          ...paymentData,
          // Ensure enhanced payment tracking
          enhancedPayment: true,
          submittedAt: new Date().toISOString(),
        },
      );

      console.log("✅ Payment submitted successfully:", response.data);

      setIsPaymentModalOpen(false);

      // Add delay to ensure backend processing is complete
      await new Promise((resolve) => setTimeout(resolve, 750));

      // Refresh payments, invoice data, and customer credits
      await Promise.all([
        fetchPayments(),
        fetchInvoiceData(),
        fetchCustomerCredits(),
      ]);

      setActivityRefreshKey((k) => k + 1);

      // Show success message with payment details
      const paymentSummary = paymentData.paymentSummary;
      let successMessage = ciText("Payment recorded successfully!");

      if (paymentSummary) {
        if (paymentSummary.type === "overpayment") {
          successMessage += ` Overpayment of ${
            paymentSummary.overpaymentCurrency
          } ${paymentSummary.overpaymentAmount.toFixed(
            2,
          )} added to customer credits.`;
        } else if (paymentSummary.type === "underpayment") {
          successMessage += ` Remaining balance: ${
            paymentSummary.invoiceCurrency
          } ${paymentSummary.remainingAfterPayment.toFixed(2)}.`;
        } else if (paymentSummary.type === "exact") {
          successMessage += " Invoice is now fully paid.";
        }
      }

      notifySuccess(successMessage);
    } catch (err) {
      console.error("❌ Payment submission error:", err);

      const errorMessage =
        err.response?.data?.message ||
        err.response?.data?.error ||
        ciText("Failed to record payment.");

      notifyError(errorMessage);

      // Provide more specific error information
      if (err.response?.data?.details) {
        console.error("Payment error details:", err.response.data.details);
      }

      throw err; // Re-throw to let PaymentModal know about the error
    }
  };

  // Handle bulk payment completion
  const handleBulkPaymentComplete = async () => {
    // Add a small delay to ensure backend has processed the payment
    await new Promise((resolve) => setTimeout(resolve, 500));
    fetchPayments();
    fetchInvoiceData();
  };

  const fetchInvoiceData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${Base_URL}/proforma-invoice/${id}`);
      setInvoice(response.data);

      // Set reminder status from invoice data
      if (response.data.reminders) {
        setReminderStatus(response.data.reminders);
      }

      // Fetch templates assigned to this business - only active ones (matches CreateCustomerInvoice)
      const businessId =
        response.data.business_id?._id || response.data.business_id;

      if (businessId && adminInfo?.token) {
        try {
          const bdRes = await axios.get(
            `${Base_URL}/BusinessDetails/get_by_business_id/${businessId}`,
            {
              headers: {
                "Content-Type": "application/json",
                authorization: `Bearer ${adminInfo.token}`,
              },
            },
          );
          const row = bdRes.data?.data?.[0];
          setEInvoiceAutoApproval(!!row?.eInvoiceAutoApproval);
        } catch (bdErr) {
          console.warn("Business details (e-invoice settings):", bdErr);
          setEInvoiceAutoApproval(false);
        }
      } else {
        setEInvoiceAutoApproval(false);
      }

      const invoiceType = response.data.invoiceType || "Commercial";
      const desiredType =
        invoiceType === "Proforma" ? "Proforma Invoice" : "Commercial Invoice";

      let filteredTemplates = [];
      let hasBusinessAssignments = false;

      if (businessId) {
        try {
          const businessTemplatesRes = await axios.get(
            `${Base_URL}/business-templates/${businessId}`,
          );
          const assignments = businessTemplatesRes?.data?.data || [];
          hasBusinessAssignments = assignments.length > 0;

          // Filter: only isActive, and type matches
          const activeAssignments = assignments.filter((a) => {
            if (!a || a.isActive !== true) return false;
            const assignmentType = a.type;
            const templateType = a.templateId?.type;
            if (assignmentType === desiredType) return true;
            if (templateType === desiredType) return true;
            if (
              typeof templateType === "string" &&
              templateType.toLowerCase() === "invoice" &&
              desiredType.toLowerCase().includes("invoice")
            )
              return true;
            return false;
          });
          filteredTemplates = activeAssignments
            .map((item) => item.templateId)
            .filter((t) => t != null);
        } catch (err) {
          console.warn("Error fetching business templates:", err);
        }
      }

      // Fallback: if there is no business OR there are no business assignments at all,
      // try document-templates (legacy). But if assignments exist and are all disabled,
      // do NOT fall back – treat as "no active template for this business".
      if (
        filteredTemplates.length === 0 &&
        (!businessId || !hasBusinessAssignments)
      ) {
        try {
          const templatesResponse = await axios.get(
            `${Base_URL}/document-templates`,
          );
          const allTemplates =
            templatesResponse.data?.data || templatesResponse.data || [];
          filteredTemplates = allTemplates.filter((tmp) => {
            const templateType = (tmp.type || "").toLowerCase();
            if (templateType === "invoice") return true;
            if (invoiceType === "Proforma")
              return templateType === "proforma invoice";
            return (
              templateType === "commercial invoice" ||
              templateType === "invoice"
            );
          });
        } catch (err) {
          console.warn("Error fetching document templates:", err);
        }
      }

      setTemplates(filteredTemplates);

      // Only use template if it's in the active list (disabled templates = no template)
      const invoiceTemplateId = resolveEntityId(response.data.templateId);
      const isInvoiceTemplateActive = filteredTemplates.some(
        (t) => getTemplateIdentifier(t) === invoiceTemplateId,
      );

      if (invoiceTemplateId && isInvoiceTemplateActive) {
        try {
          const templateResponse = await axios.get(
            `${Base_URL}/document-templates/${invoiceTemplateId}`,
          );
          const template = templateResponse.data?.data || templateResponse.data;
          setTemplateData(template);
          setSelectedTemplate(invoiceTemplateId);
          setTempSelectedTemplate(invoiceTemplateId);
        } catch (templateErr) {
          console.warn("Error fetching invoice template:", templateErr);
          if (filteredTemplates.length > 0) {
            const fallbackTemplateId = getTemplateIdentifier(filteredTemplates[0]);
            const fallbackTemplate = await loadFullTemplate(filteredTemplates[0]);
            setTemplateData(fallbackTemplate);
            setSelectedTemplate(fallbackTemplateId);
            setTempSelectedTemplate(fallbackTemplateId);
          }
        }
      } else if (filteredTemplates.length > 0) {
        // No templateId or template is disabled - use first active template
        const fallbackTemplateId = getTemplateIdentifier(filteredTemplates[0]);
        const fallbackTemplate = await loadFullTemplate(filteredTemplates[0]);
        setTemplateData(fallbackTemplate);
        setSelectedTemplate(fallbackTemplateId);
        setTempSelectedTemplate(fallbackTemplateId);
      } else {
        // No active templates - clear templateData so PDF iframe shows when documentUrl exists
        setTemplateData(null);
        setSelectedTemplate(null);
        setTempSelectedTemplate(null);
      }

      // If there's a generated document, prepare PDF URL for embedded viewer
      if (response.data.documentUrl) {
        fetchInvoicePdfUrl(response.data.documentUrl);
      } else {
        setPdfUrl("");
      }

      setLoading(false);
    } catch (err) {
      console.error("Error fetching invoice:", err);
      const errorMessage =
        err.response?.data?.error ||
        err.message ||
        error.response?.data?.message || ciText("Failed to fetch invoice data");
      setError(errorMessage);
      setLoading(false);
      notifyError(errorMessage);
    }
  };

  useEffect(() => {
    if (id) {
      fetchInvoiceData();
    }
  }, [id]);

  // Auto-open payment modal when coming from receivables
  useEffect(() => {
    if (
      location.state?.fromReceivables &&
      location.state?.autoOpenPaymentModal &&
      invoice &&
      (invoice?.remaining || 0) > 0
    ) {
      // Small delay to ensure invoice data is loaded
      const timer = setTimeout(() => {
        setIsPaymentModalOpen(true);
        // Clear the state to prevent reopening on refresh
        history.replace(location.pathname, {});
      }, 500);

      return () => clearTimeout(timer);
    } else if (
      location.state?.fromReceivables &&
      location.state?.autoOpenPaymentModal &&
      invoice &&
      (invoice?.remaining || 0) <= 0
    ) {
      // Clear the state if invoice is fully paid
      history.replace(location.pathname, {});
      notifyError(ciText("Cannot record payment. Invoice is already fully paid."));
    }
  }, [invoice, location.state, history, location.pathname]);

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Close "More" dropdown if clicked outside
      if (
        moreDropdownOpen &&
        moreDropdownRef.current &&
        !moreDropdownRef.current.contains(event.target)
      ) {
        setMoreDropdownOpen(false);
      }
    };

    if (moreDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    // Cleanup
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [moreDropdownOpen]);

  // Handle updating reminder status
  const handleUpdateReminderStatus = async (status) => {
    try {
      setIsUpdatingReminder(true);

      setMoreDropdownOpen(false);

      // Call API to update reminder status
      await axios.patch(`${Base_URL}/proforma-invoice/${id}/reminders`, {
        reminders: status,
      });

      // Update local state with new reminder status
      setReminderStatus(status);

      // Update invoice object
      setInvoice({
        ...invoice,
        reminders: status,
      });

      setIsUpdatingReminder(false);
      notifySuccess(
        `Reminders ${status === "active" ? "started" : "stopped"}.`,
      );
    } catch (err) {
      console.error("Error updating reminder status:", err);
      setIsUpdatingReminder(false);
      notifyError(ciText("Something went wrong, try again later."));
    }
  };

  const handleSetExpectedPaymentDate = () => {
    setMoreDropdownOpen(false);
    // Open the date picker modal
    setIsExpectedDateModalOpen(true);
  };

  const saveExpectedPaymentDate = async (date) => {
    try {
      // Call API to update expected payment date
      await axios.patch(
        `${Base_URL}/proforma-invoice/${id}/expected-payment-date`,
        {
          expectedPaymentDate: date,
        },
      );

      // Update invoice object
      setInvoice({
        ...invoice,
        expectedPaymentDate: date,
      });

      notifySuccess(ciText("Expected payment date updated successfully."));
    } catch (err) {
      console.error("Error updating expected payment date:", err);
      notifyError(ciText("Failed to update expected payment date."));
    }
  };

  const handleBack = () => {
    history.goBack();
  };

  const handleChangeTemplate = () => {
    setViewMode("select");
    setTempSelectedTemplate(selectedTemplate);
  };

  const handleTempTemplateSelect = (templateId) => {
    setTempSelectedTemplate(templateId);
  };

  const handleConfirmTemplateSelection = async () => {
    if (!tempSelectedTemplate || templateSwitching) return;

    const selectedTemplateFromList = templates.find(
      (template) => getTemplateIdentifier(template) === tempSelectedTemplate,
    );

    try {
      setTemplateSwitching(true);

      const template = await loadFullTemplate(
        selectedTemplateFromList || tempSelectedTemplate,
      );
      if (!template) {
        throw new Error(ciText("Selected template could not be loaded."));
      }

      setTemplateData(template);
      setSelectedTemplate(tempSelectedTemplate);
      setViewMode("preview");

      // Update the invoice with the new template ID
      // await axios.patch(`${Base_URL}/proforma-invoice/${id}`, {
      //   templateId: tempSelectedTemplate,
      // });
      // notifySuccess(ciText("Template updated successfully."));
    } catch (err) {
      console.error("Error updating template:", err);
      notifyError(ciText("Failed to update template."));
    } finally {
      setTemplateSwitching(false);
    }
  };

  // Invoice status styling
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "paid":
        return "text-green-700 bg-green-50 border-green-200";
      case "partially paid":
        return "text-yellow-700 bg-yellow-50 border-yellow-200";
      case "pending":
        return "text-orange-700 bg-orange-50 border-orange-200";
      case "overdue":
        return "text-red-700 bg-red-50 border-red-200";
      case "draft":
        return "text-gray-700 bg-gray-50 border-gray-200";
      default:
        return "text-gray-700 bg-gray-50 border-gray-200";
    }
  };

  // PDF from off-screen clone so visible invoice is never modified. A3 page (larger, not too small).
  // When no template but documentUrl exists, download from pdfUrl directly.
  const handleDownloadPDF = async () => {
    // No template but we have generated PDF - download from signed URL
    if (!templateData && pdfUrl) {
      setIsGeneratingPdf(true);
      try {
        const response = await fetch(pdfUrl, {
          credentials: "include",
          mode: "cors",
        });
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = formatInvoiceDownloadName(
          invoice?.invoice_number || invoice?.invoiceNumber,
        );
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        notifySuccess(ciText("PDF downloaded successfully!"));
      } catch (error) {
        console.error("Error downloading invoice PDF:", error);
        notifyError(ciText("Failed to download PDF"));
      } finally {
        setIsGeneratingPdf(false);
      }
      return;
    }
    const root = invoiceRef.current;
    if (!root) {
      notifyError(ciText("Could not find invoice content to download."));
      return;
    }
    setIsGeneratingPdf(true);
    const PAGE_PT_WIDTH = 595;
    const PAGE_PT_HEIGHT = 800;
    // Narrower capture so content column fills it; then scaled to full page = content appears larger on PDF
    const CAPTURE_PX_WIDTH = 894;
    const base = (Base_URL || "").replace(/\/$/, "");
    let wrap = null;

    try {
      const clone = root.cloneNode(true);
      wrap = document.createElement("div");
      wrap.style.cssText =
        "position:fixed;left:-9999px;top:0;width:" +
        CAPTURE_PX_WIDTH +
        "px;max-width:" +
        CAPTURE_PX_WIDTH +
        "px;background:#fff;";
      wrap.appendChild(clone);
      const cloneInner = clone.querySelector(".invoice-container") || clone;
      cloneInner.style.width = CAPTURE_PX_WIDTH + "px";
      cloneInner.style.maxWidth = CAPTURE_PX_WIDTH + "px";
      document.body.appendChild(wrap);
      await new Promise((r) => requestAnimationFrame(r));
      await new Promise((r) => setTimeout(r, 200));

      const invEl = clone.querySelector(".invoice-container");
      const resolveEntityId = (raw) => {
        if (raw == null || raw === "") return "";
        if (typeof raw === "object") {
          return String(raw._id ?? raw.id ?? raw.$oid ?? "");
        }
        return String(raw);
      };
      const bid =
        resolveEntityId(invoice?.business_id) ||
        resolveEntityId(invoice?.business);
      const recordId =
        resolveEntityId(invoice?._id) ||
        resolveEntityId(invoice?.id) ||
        String(id || "");
      const pdfHeaders = {
        "Content-Type": "application/json",
        ...(adminInfo?.token
          ? { authorization: `Bearer ${adminInfo.token}` }
          : {}),
      };
      if (invEl && bid && recordId) {
        try {
          invEl.innerHTML = await enrichSavedRecordHtmlWithCustomFields(
            invEl.innerHTML,
            {
              businessId: bid,
              module: "sales",
              screen: "invoice",
              recordId,
              headers: pdfHeaders,
            },
          );
        } catch (cfErr) {
          console.warn("Invoice PDF custom fields:", cfErr);
        }
      }

      const imgs = clone.querySelectorAll("img[src]");
      const imageRestore = [];
      await Promise.all(
        Array.from(imgs).map((img) => {
          const originalSrc = (img.getAttribute("src") || "").trim();
          if (!originalSrc || originalSrc.startsWith("data:"))
            return Promise.resolve();
          const isHttp =
            originalSrc.startsWith("http://") ||
            originalSrc.startsWith("https://");
          const proxyUrl = isHttp
            ? `${base}/proxy-image?url=${encodeURIComponent(originalSrc.replace(/&amp;/g, "&"))}`
            : `${base}/proxy-image?url=${encodeURIComponent(base + (originalSrc.startsWith("/") ? originalSrc : "/" + originalSrc))}`;
          if (!isHttp && !originalSrc.startsWith("/")) return Promise.resolve();
          return fetch(proxyUrl, { credentials: "include" })
            .then((r) => (r.ok ? r.blob() : null))
            .then((blob) => {
              if (!blob) return;
              return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                  const dataUrl = reader.result;
                  if (typeof dataUrl === "string") {
                    imageRestore.push(img);
                    img.setAttribute("src", dataUrl);
                  }
                  resolve();
                };
                reader.onerror = () => resolve();
                reader.readAsDataURL(blob);
              });
            })
            .catch(() => {});
        }),
      );

      await Promise.all(
        imageRestore.map((img) =>
          (img.decode
            ? img.decode()
            : new Promise((r) => {
                img.onload = r;
                img.onerror = r;
              })
          ).catch(() => {}),
        ),
      );

      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      document.body.removeChild(wrap);

      const imgData = canvas.toDataURL("image/jpeg", 0.92);
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "a4",
      });
      const pageHeight = PAGE_PT_HEIGHT;
      const marginTop = 28;
      const marginBottom = 28;
      const contentHeight = pageHeight - marginTop - marginBottom;
      const imgWidth = PAGE_PT_WIDTH;
      const imgHeight = (canvas.height * PAGE_PT_WIDTH) / canvas.width;

      if (imgHeight <= contentHeight) {
        pdf.addImage(imgData, "JPEG", 0, marginTop, imgWidth, imgHeight);
      } else {
        let heightLeft = imgHeight - contentHeight;
        let position = marginTop - pageHeight;
        pdf.addImage(imgData, "JPEG", 0, marginTop, imgWidth, imgHeight);
        let page = 1;
        while (heightLeft > 0) {
          pdf.addPage("a4", "portrait");
          pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight - marginBottom;
          position -= pageHeight;
          page += 1;
        }
      }

      const fullFileName = formatInvoiceDownloadName(
        invoice?.invoice_number || invoice?.invoiceNumber,
      );
      const pdfBlob = pdf.output("blob");

      const link = document.createElement("a");
      link.href = URL.createObjectURL(pdfBlob);
      link.download = fullFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      notifySuccess(ciText("PDF downloaded successfully!"));
    } catch (error) {
      if (wrap?.parentNode)
        try {
          document.body.removeChild(wrap);
        } catch (_) {}
      console.error("Error generating PDF:", error);
      notifyError(ciText("Failed to generate PDF. Please try again."));
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Show loading state
  if (loading) {
    return (
      <div className="bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-[var(--p-blue)] rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">{ciText("Loading invoice...")}</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-lg shadow-md max-w-md">
          <div className="text-red-500 text-5xl mb-4">!</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            {ciText("Error Loading Invoice")}
          </h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={handleBack}
            className="px-4 py-2 bg-[var(--p-blue)] text-white rounded-md hover:bg-[var(--p-blue)]"
          >
            {ciText("Go Back")}
          </button>
        </div>
      </div>
    );
  }

  // Template selection grid view
  if (viewMode === "select") {
    return (
      <div className="bg-gray-50 min-h-screen p-6">
        <div className="mb-6">
          <button
            className="flex items-center text-gray-600 hover:text-gray-800"
            onClick={() => setViewMode("preview")}
          >
            <ChevronLeft size={20} className="mr-1" />
            {ciText("Back")}
          </button>
        </div>

        <div className="container mx-auto">
          <h1 className="text-2xl font-bold mb-8 text-gray-800">
            {ciText("Change")}{" "}
            {invoice?.invoiceType === "proforma"
              ? ciText("Proforma")
              : ciText("Commercial")}{" "}
            {ciText("Invoice Template")}
          </h1>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => {
              const templateId = getTemplateIdentifier(template);
              return (
              <div
                key={templateId}
                className={`relative bg-white rounded-xl border-2 ${
                  tempSelectedTemplate === templateId
                    ? "border-[var(--p-blue)] ring-2 ring-[var(--p-blue)]"
                    : "border-gray-200 hover:border-gray-300"
                } shadow-sm overflow-hidden hover:shadow-lg transition-all duration-200 cursor-pointer`}
                onClick={() => handleTempTemplateSelect(templateId)}
              >
                {/* Template Preview */}
                <div className="h-80 p-3 bg-gray-50 overflow-hidden border-b border-gray-200">
                  {previewLoading[templateId] ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="w-8 h-8 border-4 border-gray-200 border-t-[var(--p-blue)] rounded-full animate-spin"></div>
                    </div>
                  ) : (
                    <div className="w-full h-full overflow-auto bg-white shadow-inner scale-75 origin-top transform">
                      <MemoizedInvoiceRenderer
                        invoice={invoiceViewModel || invoice}
                        template={template}
                        previewMode={true}
                        pdfPayload={invoicePdfPayload}
                      />
                    </div>
                  )}
                </div>

                {/* Template Name and Actions */}
                <div className="p-4 flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold text-gray-800 text-lg">
                      {template.name || ciText("Template Name")}
                    </h3>
                    <p className="text-gray-500 text-sm mt-1">
                      {template.description || ciText("No description available")}
                    </p>
                  </div>
                </div>

                {/* Selection Indicator */}
                {tempSelectedTemplate === templateId && (
                  <div className="absolute top-3 right-3 bg-[var(--p-blue)] text-white rounded-full p-1.5 shadow-md">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                )}
              </div>
              );
            })}
          </div>

          <div className="mt-8 flex justify-end">
            <button
              className="px-6 py-2.5 bg-gray-200 text-gray-800 rounded-md mr-4 hover:bg-gray-300 transition-colors font-medium"
              onClick={() => setViewMode("preview")}
            >
              {ciText("Cancel")}
            </button>
            <button
              className="px-6 py-2.5 bg-[var(--p-blue)] text-white rounded-md hover:bg-[var(--p-blue)] transition-colors font-medium shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
              onClick={handleConfirmTemplateSelection}
              disabled={!tempSelectedTemplate || templateSwitching}
            >
              {templateSwitching ? ciText("Applying...") : ciText("Apply Template")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <ExpectedPaymentDateModal
        isOpen={isExpectedDateModalOpen}
        onClose={() => setIsExpectedDateModalOpen(false)}
        onSave={saveExpectedPaymentDate}
        currentDate={invoice?.expectedPaymentDate}
      />
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onSubmit={handleSubmitPayment}
        invoice={invoice}
        businessId={invoice?.business_id}
      />
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto max-w-[1600px] px-4 py-3 sm:px-6">
          <PageHeader
            title={invoice?.invoice_number || ciText("Invoice")}
            description={
              invoice?.customer_name ||
              invoice?.customer?.basicInformation?.customerDisplayName ||
              ciText("Customer invoice")
            }
            showBackButton
            backFallbackPath="/customer-invoices"
            actionsContainerClassName="flex flex-wrap gap-2 justify-end min-w-0 max-w-full"
            renderActions={
              <>
                <span
                  className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-xs font-semibold ${getStatusColor(invoice?.status)} bg-opacity-10`}
                >
                  {invoice?.status || "---"}
                </span>
                {invoice?.remaining === 0 && invoice?.status === "Paid" && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-green-200 bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                    <CheckCircle size={12} />
                    {ciText("Fully Paid")}
                  </span>
                )}
                {reminderStatus === "active" && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-blue-200 bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                    <Bell size={12} />
                    {ciText("Reminders Active")}
                  </span>
                )}
                <div className="flex flex-wrap items-center gap-2 justify-end">
                  {!(
                    invoice?.status &&
                    ["paid", "partially paid"].includes(
                      invoice.status.toLowerCase(),
                    )
                  ) &&
                    (invoice?.remaining === undefined ||
                      invoice?.remaining > 0) && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:bg-gray-50"
                        title={ciText("Edit Invoice")}
                        onClick={() =>
                          history.push(
                            `/update-customer-invoice/${invoice._id}`,
                          )
                        }
                      >
                        <Edit size={18} />
                        <span className="hidden sm:inline">{ciText("Edit")}</span>
                      </button>
                    )}

                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                    title={ciText("Download PDF")}
                    onClick={handleDownloadPDF}
                    disabled={isGeneratingPdf}
                  >
                    <Download size={18} />
                    <span className="hidden sm:inline">
                      {isGeneratingPdf ? ciText("Generating...") : ciText("Download PDF")}
                    </span>
                  </button>

                  <div className="relative" ref={moreDropdownRef}>
                    <button
                      type="button"
                      aria-label={ciText("More invoice actions")}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 shadow-sm transition-all hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800"
                      onClick={() => setMoreDropdownOpen((v) => !v)}
                    >
                      <MoreVertical size={18} />
                    </button>
                    {moreDropdownOpen && (
                      <div className="absolute right-0 top-full z-50 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-gray-200 bg-white py-1 shadow-xl ring-1 ring-black/5">
                        <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                          {ciText("Communication")}
                        </div>
                        <button
                          type="button"
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-800 hover:bg-slate-50"
                          onClick={() => {
                            setMoreDropdownOpen(false);
                            history.push({
                              pathname: "/email-preview",
                              state: {
                                invoiceData: {
                                  ...invoice,
                                  status: "generated",
                                  location: "customer-invoices",
                                  templateId:
                                    selectedTemplate ||
                                    invoice?.templateId?._id ||
                                    invoice?.templateId ||
                                    "",
                                },
                                isUpdate: true,
                                invoiceId: invoice._id,
                                templateData,
                                businessData:
                                  invoice?.business_id &&
                                  typeof invoice.business_id === "object"
                                    ? invoice.business_id
                                    : invoice?.business &&
                                        typeof invoice.business === "object"
                                      ? invoice.business
                                      : null,
                                selectedCustomer:
                                  invoice?.customer_id &&
                                  typeof invoice.customer_id === "object"
                                    ? invoice.customer_id
                                    : invoice?.customer &&
                                        typeof invoice.customer === "object"
                                      ? invoice.customer
                                      : null,
                                adminInfo,
                              },
                            });
                          }}
                        >
                          <Mail
                            size={18}
                            className="shrink-0 text-[var(--p-blue)]"
                          />
                          {ciText("Send Email")}
                        </button>

                        <div className="my-1 border-t border-gray-100" />
                        <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                          {ciText("Reminders")}
                        </div>
                        {reminderStatus !== "active" && (
                          <button
                            type="button"
                            onClick={() => handleUpdateReminderStatus("active")}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-800 hover:bg-slate-50 disabled:opacity-50"
                            disabled={isUpdatingReminder}
                          >
                            <Bell
                              size={18}
                              className="shrink-0 text-blue-600"
                            />
                            {ciText("Start Reminders")}
                          </button>
                        )}
                        {reminderStatus !== "inactive" && (
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateReminderStatus("inactive")
                            }
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-800 hover:bg-slate-50 disabled:opacity-50"
                            disabled={isUpdatingReminder}
                          >
                            <BellOff
                              size={18}
                              className="shrink-0 text-slate-500"
                            />
                            {ciText("Stop Reminders")}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleSetExpectedPaymentDate}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-800 hover:bg-slate-50"
                        >
                          <Calendar
                            size={18}
                            className="shrink-0 text-gray-500"
                          />
                          {ciText("Expected Payment Date")}
                        </button>

                        <div className="my-1 border-t border-gray-100" />
                        <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                          {ciText("Invoice Actions")}
                        </div>
                        {invoice?.status !== "Sent" && (
                          <button
                            type="button"
                            onClick={handleMarkAsSent}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-800 hover:bg-slate-50"
                          >
                            <FileText
                              size={18}
                              className="shrink-0 text-gray-500"
                            />
                            {ciText("Mark as Sent")}
                          </button>
                        )}
                        {(invoice?.remaining || 0) > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setMoreDropdownOpen(false);
                              handleRecordPayment();
                            }}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-emerald-800 hover:bg-emerald-50"
                          >
                            <DollarSign size={18} className="shrink-0" />
                            {ciText("Record Payment")}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </>
            }
          />
        </div>
      </div>

      <div className="border-b border-gray-100 bg-white">
        <div className="mx-auto max-w-[1600px] px-4 pb-4 pt-4 sm:px-6">
          <div
            role="tablist"
            aria-label={ciText("Invoice viewer sections")}
            className="inline-flex w-full max-w-xl rounded-xl border border-gray-200 bg-gray-100/95 p-1 shadow-sm sm:max-w-none"
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewerTab === "details"}
              onClick={() => setViewerTab("details")}
              className={`relative flex min-h-[40px] flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all sm:flex-none sm:px-6 ${
                viewerTab === "details"
                  ? "bg-white text-[var(--p-blue)] shadow-sm ring-1 ring-gray-200/80"
                  : "text-gray-600 hover:bg-white/60 hover:text-gray-900"
              }`}
            >
              <FileText size={16} className="shrink-0 opacity-80" />
              <span>{ciText("Invoice details")}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewerTab === "activity"}
              onClick={() => setViewerTab("activity")}
              className={`relative flex min-h-[40px] flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all sm:flex-none sm:px-6 ${
                viewerTab === "activity"
                  ? "bg-white text-[var(--p-blue)] shadow-sm ring-1 ring-gray-200/80"
                  : "text-gray-600 hover:bg-white/60 hover:text-gray-900"
              }`}
            >
              <History size={16} className="shrink-0 opacity-80" />
              <span>{ciText("Activity log")}</span>
            </button>
          </div>
        </div>
      </div>
      {/* Comment Modal */}
      {/* <CommentModal
        isOpen={isCommentModalOpen}
        onClose={() => setIsCommentModalOpen(false)}
        invoiceId={invoice?._id}
      /> */}
      <div
        className={
          viewerTab === "details"
            ? "block pb-10"
            : "pointer-events-none fixed left-[-10000px] top-0 z-0 isolate w-[min(100vw,1600px)] max-w-[1600px] overflow-x-auto overflow-y-visible pb-10 opacity-0"
        }
        aria-hidden={viewerTab !== "details"}
      >
        {/* Enhanced Invoice Summary - Zoho Style */}
        <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 pb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h3 className="text-lg font-semibold mb-6 text-gray-900 flex items-center">
              <TrendingUp size={20} className="mr-2 text-gray-600" />
              {ciText("Financial Summary")}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Invoice total */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-5 border border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
                    {ciText("Total Amount")}
                  </h4>
                  <FileText size={16} className="text-blue-600" />
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrencyAmount(invoice?.currency, invoiceSummary.total)}
                </p>
              </div>

              {/* Subtotal */}
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-5 border border-green-200">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-green-700 uppercase tracking-wide">
                    {ciText("Subtotal")}
                  </h4>
                  <CheckCircle size={16} className="text-green-600" />
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrencyAmount(invoice?.currency, invoiceSummary.subtotal)}
                </p>
              </div>

              {/* Discount */}
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-5 border border-orange-200">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-orange-700 uppercase tracking-wide">
                    {ciText("Discount")}
                  </h4>
                  <TrendingUp size={16} className="text-orange-600" />
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrencyAmount(invoice?.currency, invoiceSummary.discountAmount)}
                </p>
              </div>

              {/* Shipping Charges */}
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-5 border border-purple-200">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-purple-700 uppercase tracking-wide">
                    {ciText("Shipping Charges")}
                  </h4>
                  <Receipt size={16} className="text-purple-600" />
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrencyAmount(invoice?.currency, invoiceSummary.shippingCharges)}
                </p>
              </div>
            </div>

            {/* Enhanced Credit Details */}
            {customerCredits?.availableCredits?.length > 0 && (
              <div className="mt-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                <h4 className="text-sm font-medium text-purple-800 mb-2 flex items-center">
                  <Receipt size={16} className="mr-2" />
                  {ciText("Customer Credit Balance")}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {customerCredits.availableCredits.map((credit, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-white rounded border"
                    >
                      <div>
                        <span className="font-medium text-purple-700">
                          {formatCurrencyAmount(credit.currency, credit.amount)}
                        </span>
                        <div className="text-xs text-gray-500">
                          {credit.credits?.length || 1} credit(s)
                        </div>
                      </div>
                      <div className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                        {ciText("Available")}
                      </div>
                    </div>
                  ))}
                </div>
                {customerCredits.metadata?.hasAvailableCredits && (
                  <p className="text-xs text-purple-600 mt-2">
                    💡 These credits can be applied to this invoice or saved for
                    future invoices
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Customer & billing details */}
        <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 pb-6">
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="px-8 py-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column - Customer Info */}
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                    {ciText("Customer Details")}
                  </h2>
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                        {ciText("Customer Name")}
                      </h3>
                      <p className="text-base font-medium text-gray-900">
                        {invoice?.customer_name || "---"}
                      </p>
                    </div>
                    {invoice?.billingAddress && (
                      <div>
                        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                          {ciText("Billing Address")}
                        </h3>
                        <p className="text-sm text-gray-800 leading-relaxed">
                          {invoice.billingAddress
                            .split("\n")
                            .filter((line) => line.trim())
                            .map((line) => line.trim())
                            .join(", ")}
                        </p>
                      </div>
                    )}
                    {invoice?.phone && (
                      <div>
                        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                          {ciText("Phone")}
                        </h3>
                        <p className="text-sm text-gray-800">{invoice.phone}</p>
                      </div>
                    )}
                    {invoice?.fax && (
                      <div>
                        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                          {ciText("Fax Number")}
                        </h3>
                        <p className="text-sm text-gray-800">{invoice.fax}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column - Invoice Info */}
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                    {ciText("Invoice Information")}
                  </h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                        {ciText("INVOICE NO.:")}
                      </h3>
                      <p className="text-sm font-medium text-gray-900">
                        {invoice?.invoice_number || "---"}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                        {ciText("Invoice Date")}
                      </h3>
                      <p className="text-sm font-medium text-gray-900">
                        {formatDate(invoice?.invoice_date)}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                        {ciText("DUE DATE:")}
                      </h3>
                      <p className="text-sm font-medium text-gray-900">
                        {formatDate(invoice?.due_date)}
                      </p>
                    </div>
                    {invoice?.expectedPaymentDate && (
                      <div>
                        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                          {ciText("Expected Payment")}
                        </h3>
                        <p className="text-sm font-medium text-gray-900">
                          {formatDate(invoice.expectedPaymentDate)}
                        </p>
                      </div>
                    )}
                    {invoice?.currency && (
                      <div>
                        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                          {ciText("Currency")}
                        </h3>
                        <p className="text-sm font-medium text-gray-900">
                          {invoice.currency}
                        </p>
                      </div>
                    )}
                    {invoice?.invoiceType === "Proforma" &&
                      (invoice?.advanceDepositAmount > 0 ||
                        invoice?.depositAmount > 0) && (
                        <div className="col-span-2">
                          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                            {ciText("Advance Deposit")}
                          </h3>
                          <p className="text-sm font-medium text-blue-600">
                            {invoice.currency || "USD"}{" "}
                            {(
                              invoice.advanceDepositAmount ||
                              invoice.depositAmount ||
                              0
                            ).toFixed(2)}
                          </p>
                        </div>
                      )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <section
          className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 pb-8"
          aria-label={ciText("Invoice PDF and template preview")}
        >
          <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">
            {ciText("Invoice preview")}
          </h3>
          <div className="w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div ref={invoiceContainerRef} className="w-full min-w-0">
              <div className="w-full overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm">
                {invoice && templateData && (
                  <div
                    ref={invoiceRef}
                    key={templateData._id || selectedTemplate}
                  >
                    <MemoizedInvoiceRenderer
                      invoice={invoiceViewModel || invoice}
                      template={templateData}
                      pdfPayload={invoicePdfPayload}
                    />
                  </div>
                )}
                {invoice && !templateData && invoice?.documentUrl && (
                  <div
                    className="w-full bg-gray-50"
                    style={{ minHeight: "75vh" }}
                  >
                    {pdfLoading ? (
                      <div className="flex min-h-[70vh] flex-col items-center justify-center">
                        <div className="mb-4 h-14 w-14 animate-spin rounded-full border-4 border-gray-200 border-t-[var(--p-blue)]" />
                        <p className="text-sm text-gray-600">
                          {ciText("Loading stored PDF…")}
                        </p>
                        {retryCount > 0 && (
                          <p className="text-xs text-gray-500">
                            Retry {retryCount} of 3
                          </p>
                        )}
                      </div>
                    ) : pdfError ? (
                      <div className="flex min-h-[70vh] flex-col items-center justify-center p-6">
                        <div className="mb-4 text-5xl text-red-500">⚠️</div>
                        <p className="max-w-md text-center font-medium text-red-600">
                          {pdfError}
                        </p>
                        {pdfError === ciText("Connection was reset. Please try again.") && (
                          <p className="mt-2 max-w-md text-center text-sm text-gray-500">
                            {ciText(
                              "Connection was interrupted — the preview link may have expired.",
                            )}
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={handleRetryPdfLoad}
                          className="mt-6 inline-flex items-center rounded-lg bg-[var(--p-blue)] px-4 py-2 text-sm text-white hover:bg-[var(--p-blue-dark)]"
                        >
                          <FileText size={16} className="mr-2" />
                          {ciText("Retry preview")}
                        </button>
                      </div>
                    ) : pdfUrl ? (
                      <PdfViewerIframe
                        pdfUrl={pdfUrl}
                        onError={(err) => {
                          console.error("Invoice PDF iframe error:", err);
                          setPdfError(
                            ciText(
                              "Failed to load invoice PDF — connection may have been reset.",
                            ),
                          );
                          setPdfUrl("");
                        }}
                      />
                    ) : (
                      <div className="flex min-h-[320px] items-center justify-center p-8 text-center">
                        <p className="text-sm text-gray-600">
                          {ciText(
                            "Stored PDF preview is not available in the browser — try {{action}} above.",
                            { action: ciText("Download PDF") },
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                )}
                {invoice && !templateData && !invoice?.documentUrl && (
                  <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                    <FileText size={52} className="mb-4 text-gray-300" />
                    <p className="text-base font-medium text-gray-800">
                      {ciText("No printable preview loaded")}
                    </p>
                    <p className="mt-2 max-w-md text-sm text-gray-600">
                      {ciText(
                        "This usually means no active document template is linked, or the invoice has not been saved with a PDF. Use {{edit}} from the toolbar to assign lines and generate a document.",
                        { edit: ciText("Edit") },
                      )}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        history.push(`/update-customer-invoice/${invoice._id}`)
                      }
                      className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[var(--p-blue)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--p-blue-dark)]"
                    >
                      <Edit size={18} />
                      {ciText("Open edit invoice")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
        {/* Payments — above invoice preview */}
        <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 pb-6">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
              <Receipt size={20} className="text-emerald-600" />
              {ciText("Payments received")}
            </h3>
            {paymentsLoading ? (
              <div className="flex flex-col items-center justify-center gap-2 py-14 text-gray-500">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-200 border-t-[var(--p-blue)]" />
                <span className="text-sm">{ciText("Loading payments…")}</span>
              </div>
            ) : payments && payments.length > 0 ? (
              <PaymentsTable
                invoice={invoice}
                payments={payments}
                currency={invoice?.currency || "USD"}
                allowDelete={false}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/90 px-6 py-12 text-center">
                <DollarSign className="mx-auto mb-3 h-10 w-10 text-gray-300" />
                <p className="text-sm font-medium text-gray-700">
                  {ciText("No payments recorded yet")}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  When you record a payment, it will appear here and in Activity
                  log.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Template picker — above preview */}
        {templates.length > 0 && (
          <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 pb-6">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex min-w-0 items-center gap-3">
                <FileText size={18} className="shrink-0 text-gray-500" />
                <div className="min-w-0">
                  <span className="text-sm text-gray-600">
                    {ciText("Document template:")}
                  </span>
                  <span className="ml-2 font-semibold text-gray-900">
                    {templates.find(
                      (t) => getTemplateIdentifier(t) === selectedTemplate,
                    )?.name ||
                      ciText("Standard Invoice")}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-[var(--p-blue)] shadow-sm hover:bg-blue-50/60"
                onClick={handleChangeTemplate}
              >
                {ciText("Change Template")}
              </button>
            </div>
          </div>
        )}

        {/* Full-width printable preview (still mounted while Activity tab visible — PDF download works) */}
      </div>

      <div
        className={viewerTab === "activity" ? "block pb-10" : "hidden"}
        aria-hidden={viewerTab !== "activity"}
      >
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6">
          <InvoiceActivityTimeline key={activityRefreshKey} invoiceId={id} />
        </div>
      </div>
    </div>
  );
};

export default CustomerInvoiceViewer;
