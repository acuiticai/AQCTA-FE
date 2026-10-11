"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import {
  ArrowLeft,
  Eye,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link,
  ImageIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Code,
  Upload,
  X,
  FileText,
  Trash2,
} from "lucide-react";
import { useLocation, useHistory } from "react-router-dom";
import axios from "axios";
import ejs from "ejs";
import { is } from "immutable";
import { toast } from "react-toastify";
import { notifyError, notifySuccess } from "@/utils/toast";
import { useEmailDefaults } from "@/hooks/useEmailDefaults";
import CustomerInvoiceServices from "@/services/CustomerInvoiceServices";
import {
  formatInvoiceLineTaxColumnDisplay,
  mapInvoiceToUnifiedInvoiceContract,
  rewriteInvoiceTemplateForDisplayLabels,
  resolveTemplateLineItemDisplayCells,
} from "@/utils/invoiceContractMapper";
import { buildCustomerInvoiceDefaultEmailHtml } from "@/utils/customerInvoiceDefaultEmailHtml";
import { buildCustomerInvoiceStandardEmailHtml } from "@/utils/standardEmailTemplate";
import { getDefaultEmailTemplateDoc } from "@/utils/defaultEmailTemplateShell";
import useStandardEmailTemplate from "@/hooks/useStandardEmailTemplate";
import EmailTemplateIframePreview from "@/components/email/EmailTemplateIframePreview";
import { fetchPdfPayload, upsertValues } from "@/services/customFieldServices";
import {
  applyFullPdfCustomFieldsToHtml,
  buildInlinePdfCustomFieldsPayload,
  replaceLineItemsTbodyRowsHtml,
} from "@/utils/customFieldsPdf";
import { parsePlaceholdersDeep } from "@/utils/dynamicPlaceholders";
import { buildInvoicePlaceholderOptions } from "@/utils/invoicePlaceholderResolver";
import { useTranslation } from "react-i18next";

// Assuming these are defined elsewhere in your application
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
const headers = {
  "Content-Type": "application/json",
  authorization: `Bearer ${localStorage.getItem("token")}`,
};
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeTermsAndConditions = (value) => {
  if (typeof value !== "string") return "";
  return value.replace(/\r\n/g, "\n").trim();
};

const hasMeaningfulSummaryContent = (element) => {
  if (!element) return false;
  const text = (element.textContent || "").replace(/\u00a0/g, " ").trim();
  if (text) return true;
  return !!element.querySelector("img, svg, canvas, table, iframe");
};

const applyInvoiceTermsAndConditionsToHtml = (html, termsAndConditions) => {
  const normalizedTerms = normalizeTermsAndConditions(termsAndConditions);
  const termsHtml = normalizedTerms
    .replace(/\$/g, "$$$$")
    .replace(/\n/g, "<br/>");
  const replacement = normalizedTerms
    ? `<div class="payment-info">${termsHtml}</div>\n      <div class="financial-summary">`
    : `<div class="financial-summary">`;

  let nextHtml = html;
  nextHtml = nextHtml.replace(
    /<div class="payment-info">\s*<div>1\. Method Of Payment[\s\S]*?21400015058\s*<\/div>\s*<\/div>\s*<div class="financial-summary">/g,
    replacement
  );
  nextHtml = nextHtml.replace(
    /<div class="payment-info">\s*(?:<div>[\s\S]*?<\/div>\s*){2,}\s*<\/div>\s*<div class="financial-summary">/g,
    replacement
  );
  nextHtml = nextHtml.replace(
    /<div class="payment-info">[\s\S]*?ABDUL HAMEED[\s\S]*?21400015058[\s\S]*?<\/div>\s*<div class="financial-summary">/gi,
    replacement
  );

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(nextHtml, "text/html");

    if (normalizedTerms) {
      doc
        .querySelectorAll(".terms-section .terms-content, .terms-content")
        .forEach((el) => {
          const raw = (el.innerHTML || "").trim();
          const hasUnresolvedEjs = /<%=|<%-|<%[\s]/.test(raw);
          if (hasUnresolvedEjs || raw === "") {
            el.innerHTML = termsHtml;
          }
        });
      doc.querySelectorAll(".payment-info").forEach((el) => {
        el.innerHTML = termsHtml;
      });
    } else {
      doc
        .querySelectorAll(".terms-section, .payment-info")
        .forEach((el) => el.remove());
    }

    doc.querySelectorAll(".notes-summary-row").forEach((row) => {
      const leftColumn = row.querySelector(".notes-summary-left");
      const summarySection = row.querySelector(".summary-section");
      if (summarySection && !hasMeaningfulSummaryContent(leftColumn)) {
        leftColumn?.remove();
        row.style.display = "flex";
        row.style.justifyContent = "flex-end";
        row.style.gap = "0";
        summarySection.style.marginLeft = "auto";
        summarySection.style.maxWidth = "320px";
        summarySection.style.width = "100%";
      }
    });

    doc.querySelectorAll(".summary-section").forEach((section) => {
      const paymentInfo = section.querySelector(":scope > .payment-info");
      const financialSummary =
        section.querySelector(":scope > .financial-summary") ||
        section.querySelector(":scope > .summary-box");

      if (paymentInfo && !hasMeaningfulSummaryContent(paymentInfo)) {
        paymentInfo.remove();
      }

      if (!section.querySelector(":scope > .payment-info") && financialSummary) {
        section.style.display = "grid";
        section.style.gridTemplateColumns = "minmax(0, 320px)";
        section.style.justifyContent = "end";
        section.style.width = "100%";
        financialSummary.style.marginLeft = "auto";
        financialSummary.style.width = "100%";
      }
    });

    return doc.documentElement.outerHTML;
  } catch (error) {
    return nextHtml;
  }
};

const replaceInvoiceItemsRowsForPdf = (html, items) => {
  if (!html || typeof html !== "string" || !Array.isArray(items) || !items.length) {
    return html;
  }

  const hasSeparateDescCol =
    /<th[^>]*>\s*Description\s*<\/th>/i.test(html) &&
    !/<th[^>]*>.*Item\s*&\s*Description.*<\/th>/i.test(html);

  const rowsHtml = items
    .map((item, idx) => {
      const {
        combinedPrimary,
        combinedSubtitle,
        separateNameCell,
        separateDescriptionCell,
      } = resolveTemplateLineItemDisplayCells(item);
      const quantity = Number(item.quantity || item.qty || 0);
      const price = Number(item.price || item.unitPrice || item.rate || 0);
      const discountPercent = Number(item.discount ?? 0);
      const lineSubtotal = Math.max(
        0,
        quantity * price * (1 - discountPercent / 100),
      );
      const taxRate = Number(item.taxRate ?? 0);
      const taxName = String(
        item.taxName || item.tax_label || item.taxLabel || "",
      ).trim();
      const taxAmountFromApi = Number(item.taxAmount ?? item.tax ?? 0);
      const tax = taxAmountFromApi || (taxRate ? (lineSubtotal * taxRate) / 100 : 0);
      const computedLineTotal = Math.max(0, lineSubtotal + tax);
      const providedTotal = Number(item.total ?? item.totalValue ?? item.amount ?? 0);
      const tolerance = 0.01;
      const total =
        providedTotal > 0
          ? Math.abs(providedTotal - computedLineTotal) < tolerance
            ? providedTotal
            : Math.abs(providedTotal - lineSubtotal) < tolerance && tax > 0
              ? providedTotal + tax
              : computedLineTotal
          : computedLineTotal;
      const taxDisplay = formatInvoiceLineTaxColumnDisplay({
        tax,
        taxRate,
        taxName,
        taxAmount: tax,
      });

      if (hasSeparateDescCol) {
        const nameHtml = separateNameCell || "&nbsp;";
        const itemCell = `<div class="item-desc-main">${nameHtml}</div>`;
        const descCell = separateDescriptionCell
          ? `<div class="item-desc-sub">${separateDescriptionCell}</div>`
          : "";
        return `
          <tr>
            <td>${idx + 1}</td>
            <td>${itemCell}</td>
            <td>${descCell}</td>
            <td>${quantity}</td>
            <td>${price.toFixed(2)}</td>
            <td>${discountPercent.toFixed(2)}%</td>
            <td>${taxDisplay}</td>
            <td>${total.toFixed(2)}</td>
          </tr>
        `;
      }

      const itemDescCell = combinedSubtitle
        ? `<div class="item-desc-main">${combinedPrimary}</div><div class="item-desc-sub" style="font-size: 0.9em; color: #666; margin-top: 2px;">${combinedSubtitle}</div>`
        : `<div class="item-desc-main">${combinedPrimary}</div>`;
      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${itemDescCell}</td>
          <td>${quantity}</td>
          <td>${price.toFixed(2)}</td>
          <td>${discountPercent.toFixed(2)}%</td>
          <td>${taxDisplay}</td>
          <td>${total.toFixed(2)}</td>
        </tr>
      `;
    })
    .join("");

  const afterRows = replaceLineItemsTbodyRowsHtml(html, items.length, rowsHtml);
  if (afterRows !== html) return afterRows;

  const headerIndex =
    html.indexOf("Item</th>") !== -1
      ? html.indexOf("Item</th>")
      : html.indexOf("Item & Description</th>");
  const tbodyStart =
    headerIndex !== -1 ? html.indexOf("<tbody", headerIndex) : html.indexOf("<tbody");

  if (tbodyStart === -1) return html;
  const openTagEnd = html.indexOf(">", tbodyStart);
  const tbodyEnd = html.indexOf("</tbody>", openTagEnd);
  if (openTagEnd === -1 || tbodyEnd === -1) return html;
  const before = html.slice(0, openTagEnd + 1);
  const after = html.slice(tbodyEnd);
  return `${before}${rowsHtml}${after}`;
};

const injectInvoicePdfSafetyStyles = (html) => {
  if (!html || typeof html !== "string") return html;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    if (doc.body) {
      doc.body.classList.add("invoice-pdf");
    }
    const style = doc.createElement("style");
    style.setAttribute("data-flexa-invoice-pdf-safety", "1");
    style.textContent = `
      body.invoice-pdf {
        overflow: visible !important;
        height: auto !important;
        max-height: none !important;
        box-sizing: border-box;
      }
      body.invoice-pdf table {
        width: 100% !important;
        max-width: 100% !important;
        border-collapse: collapse;
        margin: 0 !important;
        box-sizing: border-box;
        table-layout: auto;
      }
      body.invoice-pdf .items-table,
      body.invoice-pdf table.items-table {
        width: 100% !important;
        max-width: 100% !important;
        margin-left: 0 !important;
        margin-right: 0 !important;
      }
      body.invoice-pdf thead { display: table-header-group; }
      body.invoice-pdf tbody { display: table-row-group; }
      body.invoice-pdf tr { display: table-row; }
      body.invoice-pdf th, body.invoice-pdf td {
        display: table-cell;
        box-sizing: border-box;
      }
      body.invoice-pdf .items-table thead tr {
        border-bottom: 2px solid #777 !important;
      }
      body.invoice-pdf .items-table tbody tr {
        border-bottom: 1px solid #e5e5e5 !important;
      }
    `;
    doc.head?.appendChild(style);
    const out = doc.documentElement.outerHTML;
    return /<!doctype/i.test(html) ? `<!DOCTYPE html>${out}` : out;
  } catch {
    return html;
  }
};

export default function EmailPreview() {
  const { t } = useTranslation();
  const location = useLocation();
  const history = useHistory();
  const stateData = location.state || {};
  let { invoiceData, isUpdate, invoiceId, templateData, businessData, adminInfo, selectedCustomer, emailTemplateDoc: emailTemplateFromNav } = stateData;
  // Fallback: adminInfo may be missing when navigating from CustomerInvoiceViewer
  if (!adminInfo) {
    try {
      const stored = localStorage.getItem("adminInfo");
      if (stored) adminInfo = JSON.parse(stored);
    } catch (_) {}
  }
  const editorIframeRef = useRef(null);
  const fileInputRef = useRef(null);

  console.log("invoice data", invoiceData);

  console.log("invoice data email", invoiceData);

  console.log("invoiceData email preview", invoiceData);
  const emailDefaults = useEmailDefaults();

  const [emailData, setEmailData] = useState({
    from: "",
    to: invoiceData?.customer_email || invoiceData?.email?.to,
    cc: "",
    bcc: "",
    subject: "Customer Invoice",
  });
  const [contactOptions, setContactOptions] = useState([]);
  const [toEmails, setToEmails] = useState(
    invoiceData?.customer_email || invoiceData?.email?.to
      ? [invoiceData?.customer_email || invoiceData?.email?.to]
      : []
  );
  const [toInput, setToInput] = useState("");
  const [ccEmails, setCcEmails] = useState([]);
  const [ccInput, setCcInput] = useState("");
  const [bccEmails, setBccEmails] = useState([]);
  const [bccInput, setBccInput] = useState("");
  const [showCcField, setShowCcField] = useState(false);

  useEffect(() => {
    if (emailDefaults.loading) return;
    setEmailData((prev) => ({
      ...prev,
      from: emailDefaults.from,
      cc: emailDefaults.cc,
    }));
    if (emailDefaults.cc) {
      setCcEmails((prev) => (prev.length ? prev : [emailDefaults.cc]));
    }
  }, [emailDefaults.loading, emailDefaults.from, emailDefaults.cc]);
  const [showBccField, setShowBccField] = useState(false);
  const [showToDropdown, setShowToDropdown] = useState(false);
  const [showCcDropdown, setShowCcDropdown] = useState(false);
  const [showBccDropdown, setShowBccDropdown] = useState(false);
  const [recipientError, setRecipientError] = useState("");
  const [loading, setLoading] = useState(false);
  const [attachInvoice, setAttachInvoice] = useState(true);
  const [attachStatement, setAttachStatement] = useState(true);
  // Removed attachSalesContract for Proforma Invoices - not applicable
  const [isEditingHtml, setIsEditingHtml] = useState(false);

  // New state for additional documents
  const [additionalDocuments, setAdditionalDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // State for signed URL
  const [signedInvoiceUrl, setSignedInvoiceUrl] = useState("");

  const previewBusinessId =
    (typeof businessData?._id === "string" && businessData._id) ||
    (typeof invoiceData?.business_id === "object"
      ? invoiceData.business_id?._id
      : invoiceData?.business_id) ||
    (typeof invoiceData?.business === "object"
      ? invoiceData.business?._id
      : invoiceData?.business) ||
    null;

  const { emailTemplateDoc, htmlContent: emailTemplateHtmlContent } =
    useStandardEmailTemplate(previewBusinessId, headers, emailTemplateFromNav);

  const normalizeEmail = (value) => (value || "").trim().toLowerCase();
  const firstNonEmptyValue = (...values) => {
    for (const value of values) {
      if (typeof value === "string") {
        if (value.trim()) return value;
        continue;
      }
      if (value !== undefined && value !== null) return value;
    }
    return "";
  };

  const extractContactOptions = () => {
    const options = [];
    const seen = new Set();
    const addOption = (email, label, type = "contact") => {
      const normalized = normalizeEmail(email);
      if (!normalized || !EMAIL_REGEX.test(normalized) || seen.has(normalized)) return;
      seen.add(normalized);
      options.push({ email: normalized, label, type });
    };

    const customerObj =
      invoiceData?.customer_id && typeof invoiceData.customer_id === "object"
        ? invoiceData.customer_id
        : invoiceData?.customer && typeof invoiceData.customer === "object"
        ? invoiceData.customer
        : null;

    const primaryEmail =
      invoiceData?.customer_email ||
      invoiceData?.email?.to ||
      customerObj?.basicInformation?.customerEmail ||
      customerObj?.basicInformation?.email ||
      "";
    const primaryName =
      invoiceData?.customer_name ||
      customerObj?.basicInformation?.customerDisplayName ||
      customerObj?.basicInformation?.companyName ||
      "Primary Contact";

    addOption(primaryEmail, `${primaryName} (Primary)`, "primary");

    const keyContacts = customerObj?.keyContacts || customerObj?.key_contacts || [];
    if (Array.isArray(keyContacts)) {
      keyContacts.forEach((contact, idx) => {
        addOption(
          contact?.email,
          `${contact?.name || `Contact ${idx + 1}`} - ${contact?.designation || "Customer Contact"}`
        );
      });
    }

    return options;
  };

  useEffect(() => {
    const options = extractContactOptions();
    setContactOptions(options);
    const primary = options.find((o) => o.type === "primary")?.email || options[0]?.email || "";
    setToEmails((prev) => (prev.length ? prev : primary ? [primary] : []));
  }, [invoiceData]);

  const addRecipient = (target, rawEmail) => {
    const email = normalizeEmail(rawEmail);
    if (!email) return;
    if (!EMAIL_REGEX.test(email)) {
      setRecipientError(`Invalid email format: ${rawEmail}`);
      return;
    }
    setRecipientError("");
    if (target === "to") {
      if (!toEmails.map(normalizeEmail).includes(email)) {
        setToEmails((prev) => [...prev, email]);
      }
      setToInput("");
      setShowToDropdown(false);
      return;
    }
    if (target === "cc") {
      if (!ccEmails.map(normalizeEmail).includes(email)) {
        setCcEmails((prev) => [...prev, email]);
      }
      setCcInput("");
      setShowCcDropdown(false);
      return;
    }
    if (target === "bcc") {
      if (!bccEmails.map(normalizeEmail).includes(email)) {
        setBccEmails((prev) => [...prev, email]);
      }
      setBccInput("");
      setShowBccDropdown(false);
    }
  };

  const removeRecipient = (target, email) => {
    if (target === "to") setToEmails((prev) => prev.filter((e) => normalizeEmail(e) !== normalizeEmail(email)));
    if (target === "cc") setCcEmails((prev) => prev.filter((e) => normalizeEmail(e) !== normalizeEmail(email)));
    if (target === "bcc") setBccEmails((prev) => prev.filter((e) => normalizeEmail(e) !== normalizeEmail(email)));
  };

  const isSelectedInTarget = (email, target) => {
    const normalized = normalizeEmail(email);
    if (!normalized) return false;
    if (target === "to") return toEmails.map(normalizeEmail).includes(normalized);
    if (target === "cc") return ccEmails.map(normalizeEmail).includes(normalized);
    if (target === "bcc") return bccEmails.map(normalizeEmail).includes(normalized);
    return false;
  };

  const getSuggestedContacts = (target, inputValue) => {
    const q = (inputValue || "").trim().toLowerCase();
    return contactOptions
      .filter((opt) => !isSelectedInTarget(opt.email, target))
      .filter((opt) =>
        !q
          ? true
          : opt.email.includes(q) || opt.label.toLowerCase().includes(q)
      )
      .slice(0, 8);
  };

  // Removed sales contract data fetching - not applicable for Proforma Invoices

  // Generate signed URL for invoice document
  useEffect(() => {
    const generateSignedUrl = async () => {
      if (invoiceData?.documentUrl) {
        try {
          const response = await CustomerInvoiceServices.getSignedInvoiceUrl(
            invoiceData.documentUrl
          );
          if (response.data?.success && response.data?.url) {
            setSignedInvoiceUrl(response.data.url);
          }
        } catch (error) {
          console.error("Error generating signed URL:", error);
        }
      }
    };

    generateSignedUrl();
  }, [invoiceData?.documentUrl]);

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "2-digit",
    });
  };

  // Removed getSalesContractSigningLink - not applicable for Proforma Invoices

  const getDefaultEmailHtml = () => {
    const shellHtml =
      emailTemplateHtmlContent || getDefaultEmailTemplateDoc().htmlContent;
    if (shellHtml) {
      return buildCustomerInvoiceStandardEmailHtml(
        shellHtml,
        emailTemplateDoc?.dummyData,
        invoiceData || {},
      );
    }
    return buildCustomerInvoiceDefaultEmailHtml(invoiceData || {});
  };

  const [emailHtml, setEmailHtml] = useState(() => getDefaultEmailHtml());
  const [rawHtmlMode, setRawHtmlMode] = useState(false);

  const resolvedPreviewHtml = useMemo(
    () =>
      (emailHtml || "").replace(
        /{{VIEW_INVOICE_URL}}/g,
        signedInvoiceUrl || "#",
      ),
    [emailHtml, signedInvoiceUrl],
  );

  useEffect(() => {
    setEmailHtml(getDefaultEmailHtml());
  }, [
    emailTemplateHtmlContent,
    emailTemplateDoc,
    invoiceData?.invoice_number,
    invoiceData?.grandTotal,
    invoiceData?.invoice_date,
    invoiceData?.due_date,
    invoiceData?.customer_name,
    invoiceData?.currency,
  ]);

  // Removed sales contract related effects - not applicable for Proforma Invoices

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEmailData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Strip HTML tags from text
  const stripHtml = (html) => {
    if (!html) return "";
    const doc = new DOMParser().parseFromString(html, "text/html");
    return doc.body.textContent || "";
  };

  // Handle file upload for additional documents
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    if (!allowedTypes.includes(file.type)) {
      notifyError(
        "Please upload only JPEG, PNG, PDF, DOC, DOCX, XLS, or XLSX files"
      );
      return;
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      notifyError("File size must be less than 10MB");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadSuccess(false);

    try {
      // Use the same document upload API as other components
      const formDataForUpload = new FormData();
      formDataForUpload.append(
        "file_path",
        `EmailAttachments/${invoiceData?.invoice_number || Date.now()}`
      );

      // Extract business_id - handle both string and object cases
      let businessId = invoiceData?.business_id;
      if (businessId && typeof businessId === "object" && businessId._id) {
        businessId = businessId._id;
      } else if (
        businessId &&
        typeof businessId === "object" &&
        businessId.id
      ) {
        businessId = businessId.id;
      }
      formDataForUpload.append("business_id", businessId);

      // Extract customer_id - handle both string and object cases
      let customerId = invoiceData?.customer_id;
      if (customerId && typeof customerId === "object" && customerId._id) {
        customerId = customerId._id;
      } else if (
        customerId &&
        typeof customerId === "object" &&
        customerId.id
      ) {
        customerId = customerId.id;
      }
      formDataForUpload.append("customer_id", customerId);

      formDataForUpload.append("file_type", file.type);
      formDataForUpload.append("file_size", file.size);
      formDataForUpload.append("file", file);

      const response = await axios.post(
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

      if (response.data.message === "File uploaded successfully") {
        const uploadedFile = response.data.file;

        const newDocument = {
          fileId: uploadedFile._id,
          name: uploadedFile.name,
          s3Key: uploadedFile.s3Key, // Send the S3 key instead of signed URL
          url: uploadedFile.url || "#",
          downloadUrl: uploadedFile.downloadUrl || "#",
          uploadedAt: new Date().toISOString(),
          size: file.size,
          type: file.type,
        };

        // Add to additional documents
        console.log("Adding new document to additionalDocuments:", newDocument);
        setAdditionalDocuments((prev) => [...prev, newDocument]);

        setSuccessMessage(
          response.data.message || "File uploaded successfully!"
        );
        setUploadSuccess(true);

        setTimeout(() => {
          setUploadSuccess(false);
          setSuccessMessage("");
        }, 3000);
      }
    } catch (error) {
      console.error("File upload error:", error);
      notifyError("File upload failed. Please try again.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleRemoveDocument = (documentId) => {
    setAdditionalDocuments((prev) =>
      prev.filter((doc) => doc.fileId !== documentId)
    );
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

  // Handle final submission
  const handleSendEmail = async () => {
    console.log("handle send email");

    // Validate required fields
    if (!toEmails.length) {
      notifyError("At least one To email is required");
      return;
    }
    const invalidTo = toEmails.find((email) => !EMAIL_REGEX.test(normalizeEmail(email)));
    if (invalidTo) {
      notifyError(`Invalid To email: ${invalidTo}`);
      return;
    }
    const invalidInLists = [...ccEmails, ...bccEmails].find((email) => !EMAIL_REGEX.test(normalizeEmail(email)));
    if (invalidInLists) {
      notifyError(`Invalid recipient email: ${invalidInLists}`);
      return;
    }

    if (!emailData.subject) {
      notifyError("Email subject is required");
      return;
    }

    if (!emailHtml.trim()) {
      notifyError("Email content is required");
      return;
    }

    console.log("invoice data", invoiceData);

    setLoading(true);
    try {
      // Always regenerate the invoice attachment from the current screen state when a template exists.
      // Otherwise updates can keep reusing an older PDF stored at documentUrl.
      let documentUrlToUse = invoiceData.documentUrl;
      const templateIdForPdf =
        invoiceData?.templateId && typeof invoiceData.templateId === "object"
          ? invoiceData.templateId._id || invoiceData.templateId.id
          : invoiceData?.templateId;
      const hasTemplateForPdf =
        !!(templateData?.htmlContent || templateIdForPdf);
      const shouldGenerateInvoicePdf =
        attachInvoice && hasTemplateForPdf;

      if (shouldGenerateInvoicePdf) {
        try {
          let templateToUse = templateData;
          if (!templateToUse?.htmlContent && templateIdForPdf) {
            const templateRes = await axios.get(
              `${Base_URL}/document-templates/${templateIdForPdf}`,
              { headers }
            );
            templateToUse = templateRes.data?.data;
          }
          if (!templateToUse?.htmlContent) {
            notifyError("Template content not found. Cannot generate PDF.");
            setLoading(false);
            return;
          }
          let sourceInvoiceData = invoiceData;
          if (invoiceId) {
            try {
              const freshRes = await axios.get(`${Base_URL}/proforma-invoice/${invoiceId}`, { headers });
              const freshInvoice = freshRes?.data?.data;
              if (freshInvoice && typeof freshInvoice === "object") {
                const resolvedCustomerObject =
                  (invoiceData?.customer_id && typeof invoiceData.customer_id === "object" && invoiceData.customer_id) ||
                  (invoiceData?.customer && typeof invoiceData.customer === "object" && invoiceData.customer) ||
                  (selectedCustomer && typeof selectedCustomer === "object" && selectedCustomer) ||
                  (freshInvoice?.customer_id && typeof freshInvoice.customer_id === "object" && freshInvoice.customer_id) ||
                  (freshInvoice?.customer && typeof freshInvoice.customer === "object" && freshInvoice.customer);
                sourceInvoiceData = {
                  ...freshInvoice,
                  ...invoiceData,
                  customer_id: resolvedCustomerObject || invoiceData?.customer_id || freshInvoice?.customer_id,
                  customer: resolvedCustomerObject || invoiceData?.customer || freshInvoice?.customer,
                  customer_name: firstNonEmptyValue(
                    invoiceData?.customer_name,
                    freshInvoice?.customer_name,
                    selectedCustomer?.basicInformation?.customerDisplayName,
                  ),
                  customer_email: firstNonEmptyValue(
                    invoiceData?.customer_email,
                    freshInvoice?.customer_email,
                    selectedCustomer?.basicInformation?.customerEmail,
                  ),
                  phoneNumber: firstNonEmptyValue(
                    invoiceData?.phoneNumber,
                    freshInvoice?.phoneNumber,
                  ),
                  faxNumber: firstNonEmptyValue(
                    invoiceData?.faxNumber,
                    freshInvoice?.faxNumber,
                  ),
                  templateId: firstNonEmptyValue(invoiceData?.templateId, freshInvoice?.templateId),
                  termsAndConditions:
                    invoiceData?.termsAndConditions ??
                    freshInvoice?.termsAndConditions ??
                    "",
                };
              }
            } catch (refreshErr) {
              console.warn("Could not reload invoice for PDF; using navigation state.", refreshErr);
            }
          } else if (selectedCustomer && typeof selectedCustomer === "object") {
            sourceInvoiceData = {
              ...invoiceData,
              customer_id:
                (invoiceData?.customer_id && typeof invoiceData.customer_id === "object" && invoiceData.customer_id) ||
                selectedCustomer,
              customer:
                (invoiceData?.customer && typeof invoiceData.customer === "object" && invoiceData.customer) ||
                selectedCustomer,
            };
          }
          const businessForPdf =
            businessData ||
            (sourceInvoiceData?.business_id &&
            typeof sourceInvoiceData.business_id === "object"
              ? sourceInvoiceData.business_id
              : null) ||
            (sourceInvoiceData?.business &&
            typeof sourceInvoiceData.business === "object"
              ? sourceInvoiceData.business
              : null) ||
            {};
          /**
           * Templates may carry `%(d)(m)(y)%` style date expressions that
           * the Create / Update forms now persist as-is (so the user can
           * keep editing the template later). Resolve them into real
           * values here, against the invoice's own `invoice_date` and the
           * user's configured Date Format, so the generated PDF — which is
           * uploaded to S3 and attached to the email customer receives —
           * shows "26 May 2026 - 26 May 2027" instead of the raw token.
           * The `payload` POSTed below intentionally keeps the original
           * `invoiceData`, so the saved row stays template-shaped for the
           * next edit. Mirrors the recurring-invoice render pipeline.
           */
          const businessNameForPlaceholders =
            businessForPdf?.name ||
            (sourceInvoiceData?.business_id &&
            typeof sourceInvoiceData.business_id === "object"
              ? sourceInvoiceData.business_id.name
              : null);
          /**
           * Shared opts pipeline (customer-invoice viewer / PDF / recurring
           * preview all build options the same way). `parsePlaceholdersDeep`
           * is used here because the email preview walks the entire
           * invoiceData payload (not just `contract`) — items, addresses,
           * subject, etc. all need resolution before mapping.
           */
          const resolvedInvoiceDataForPdf = parsePlaceholdersDeep(
            sourceInvoiceData,
            buildInvoicePlaceholderOptions({
              invoice: sourceInvoiceData,
              business: { name: businessNameForPlaceholders },
            }),
          );

          const contract = mapInvoiceToUnifiedInvoiceContract(resolvedInvoiceDataForPdf, businessForPdf, {
            purchaseOrderEmailTaxColumn: true,
          });

          // Fetch admin signature so it appears in the PDF (same as DocumentGenerator)
          let adminSignature = "";
          if (adminInfo?.id) {
            try {
              const profileRes = await axios.get(
                `${Base_URL}/admin/profile/${adminInfo.id}`,
                { headers: adminInfo?.token ? { authorization: `Bearer ${adminInfo.token}` } : headers }
              );
              const raw = profileRes?.data?.signature || "";
              if (raw && typeof raw === "string" && raw.trim()) {
                if (/^https?:\/\//i.test(raw.trim())) adminSignature = raw.trim();
                else if (raw.trim().startsWith("//")) adminSignature = `https:${raw.trim()}`;
                else adminSignature = `${(Base_URL || "").replace(/\/$/, "")}${raw.trim().startsWith("/") ? raw.trim() : `/${raw.trim()}`}`;
              }
            } catch (profileErr) {
              console.warn("Could not fetch admin signature for PDF:", profileErr);
            }
          }
          contract.signature = contract.signature || contract.authorizedSignature || contract.approver_signature || adminSignature || "";
          contract.authorizedSignature = contract.signature;
          contract.approver_signature = contract.signature;

          const templateHtmlForRender = rewriteInvoiceTemplateForDisplayLabels(
            templateToUse.htmlContent
          );
          let html = ejs.render(templateHtmlForRender, { contract }, { strict: false });
          html = applyInvoiceTermsAndConditionsToHtml(
            html,
            resolvedInvoiceDataForPdf?.termsAndConditions ??
              contract?.termsAndConditions ??
              ""
          );
          html = replaceInvoiceItemsRowsForPdf(html, contract.items || []);

          try {
            const bid =
              typeof invoiceData?.business_id === "object"
                ? invoiceData.business_id?._id
                : invoiceData?.business_id;
            const rid =
              invoiceId ||
              sourceInvoiceData?._id ||
              invoiceData?._id;
            const formDocDefs =
              stateData?.invoiceCustomFieldDefinitions ||
              stateData?.documentCustomFieldDefinitions;
            const formDocVals =
              stateData?.invoiceCustomFieldValues ||
              stateData?.documentCustomFieldValues;
            const formLineDefs =
              stateData?.lineItemCustomFieldDefinitions;

            let headerRows = [];
            let line_items = null;

            if (bid && rid) {
              try {
                const payload = await fetchPdfPayload(
                  {
                    businessId: bid,
                    module: "sales",
                    screen: "invoice",
                    recordId: String(rid),
                  },
                  adminInfo?.token
                    ? { authorization: `Bearer ${adminInfo.token}` }
                    : headers
                );
                headerRows = payload.rows || [];
                line_items = payload.line_items || null;
              } catch (fetchErr) {
                console.warn(
                  "Custom fields PDF fetch (invoice email):",
                  fetchErr,
                );
              }
            }

            const inline = buildInlinePdfCustomFieldsPayload({
              documentFieldDefinitions: formDocDefs || [],
              documentFieldValues: formDocVals || {},
              lineItemDefinitions: formLineDefs || [],
              items: resolvedInvoiceDataForPdf.items || [],
            });
            if (inline) {
              if (inline.headerRows?.length) headerRows = inline.headerRows;
              if (inline.line_items?.rows?.length) line_items = inline.line_items;
            }

            if (
              headerRows.length ||
              (line_items?.columns?.length && line_items?.rows?.length)
            ) {
              html = applyFullPdfCustomFieldsToHtml(html, {
                headerRows,
                line_items,
              });
            }
          } catch (cfPdfErr) {
            console.warn("Custom fields PDF section skipped (invoice email):", cfPdfErr);
          }
          html = injectInvoicePdfSafetyStyles(html);

          // Inject signature into .signature-section (same as DocumentGenerator)
          const signatureUrl = contract.signature || "";
          if (signatureUrl) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");
            const signatureSections = Array.from(doc.querySelectorAll(".signature-section"));
            signatureSections.forEach((section) => {
              const existingImages = Array.from(section.querySelectorAll("img"));
              const mainImage = existingImages[0] || doc.createElement("img");
              if (!existingImages.length) section.insertBefore(mainImage, section.firstChild);
              existingImages.slice(1).forEach((img) => img.remove());
              mainImage.setAttribute("src", signatureUrl);
              mainImage.setAttribute("alt", "Authorized Signature");
              mainImage.style.maxHeight = "80px";
              mainImage.style.display = "block";
              mainImage.style.marginBottom = "6px";
              const signatureLine = section.querySelector(".signature-line");
              if (signatureLine) section.insertBefore(mainImage, signatureLine);
            });
            const signatureImg = doc.querySelector(".signature-box .logo img");
            if (signatureImg) {
              signatureImg.setAttribute("src", signatureUrl);
              signatureImg.style.height = "80px";
            }
            html = doc.documentElement.outerHTML;
          }

          // Convert logo and signature to base64 so they render in PDF (avoids CORS/auth issues)
          const convertImageToBase64 = async (imageUrl, imageName) => {
            if (!imageUrl || (!imageUrl.startsWith("http") && !imageUrl.startsWith("//"))) return;
            try {
              const normalizedUrl = imageUrl.startsWith("//") ? `https:${imageUrl}` : imageUrl;
              const imageResponse = await fetch(normalizedUrl, { mode: "cors", credentials: "omit" });
              if (imageResponse.ok) {
                const imageBlob = await imageResponse.blob();
                const imageBase64 = await new Promise((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onloadend = () => resolve(reader.result);
                  reader.onerror = reject;
                  reader.readAsDataURL(imageBlob);
                });
                const escapedUrl = normalizedUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                html = html.replace(new RegExp(`(<img[^>]+src=["'])(${escapedUrl})(["'])`, "gi"), `$1${imageBase64}$3`);
                html = html.replace(new RegExp(`(<img[^>]+src=['])(${escapedUrl})(['])`, "gi"), `$1${imageBase64}$3`);
              }
            } catch (err) {
              console.warn(`Could not embed ${imageName} as base64:`, err);
            }
          };
          const businessLogoUrl = businessForPdf?.image || businessForPdf?.logo || businessForPdf?.companyLogo || businessForPdf?.businessLogo || "";
          if (businessLogoUrl) await convertImageToBase64(businessLogoUrl, "logo");
          if (signatureUrl) await convertImageToBase64(signatureUrl, "signature");

          const fileName = `invoice-${invoiceData.invoice_number || Date.now()}.pdf`;
          const pdfRes = await axios.post(
            `${Base_URL}/html-to-pdf`,
            {
              html,
              filename: fileName,
              format: "A4",
              margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
              documentType: "INV",
            },
            { responseType: "blob" }
          );
          const pdfBlob = pdfRes.data;
          const pdfFile = new File([pdfBlob], fileName, {
            type: "application/pdf",
            lastModified: Date.now(),
          });
          const formData = new FormData();
          formData.append("file", pdfFile);
          formData.append("uploadedBy", adminInfo?.id || "");
          formData.append("file_name", pdfFile.name);
          const basePath = invoiceData?.title || invoiceData?.businessName || "Invoices";
          const currentYear = new Date().getFullYear();
          const customerName = invoiceData?.customer_name || invoiceData?.customerName || "Customer";
          const invNum = invoiceData?.invoice_number || invoiceData?.invoiceNumber || "Draft";
          formData.append(
            "file_path",
            `${basePath}/${currentYear}/Customers/${customerName}/${invNum}/Proforma Invoice`
          );
          const businessId = typeof invoiceData.business_id === "object" ? invoiceData.business_id?._id : invoiceData.business_id;
          formData.append("business_id", businessId || "");
          formData.append("file_type", "application/pdf");
          formData.append("file_size", pdfFile.size.toString());
          const uploadRes = await axios.post(
            `${Base_URL}/documents/uploadDocument`,
            formData,
            { headers: { "Content-Type": "multipart/form-data" } }
          );
          const file = uploadRes.data?.file || uploadRes.data?.data;
          documentUrlToUse = file?.s3Key || file?.key || uploadRes.data?.s3Key;
        } catch (genErr) {
          console.error("PDF generation for email attachment failed:", genErr);
          notifyError("Failed to generate invoice PDF for attachment. " + (genErr.response?.data?.message || genErr.message));
          setLoading(false);
          return;
        }
      } else if (attachInvoice && !documentUrlToUse) {
        notifyError("Cannot attach PDF: select a template on the previous screen and try again, or uncheck Attach invoice PDF.");
        setLoading(false);
        return;
      }

      const payload = {
        templateId: invoiceData?.templateId, // Invoice template ID (for invoice generation)
        currency: invoiceData?.currency,
        invoiceType: invoiceData?.invoiceType,
        invoice_number: invoiceData.invoice_number,
        customer_id: invoiceData.customer_id,
        customer_name: invoiceData.customer_name,
        customer_email: invoiceData.customer_email,
        email: {
          from: emailData.from,
          to: toEmails.map(normalizeEmail).join(","),
          cc: ccEmails.join(","),
          bcc: bccEmails.join(","),
          subject: emailData.subject,
        },
        email_html: emailHtml,
        AttachInvoice: attachInvoice,
        AttachStatement: attachStatement,
        // Removed AttachSalesContract - not applicable for Proforma Invoices
        additionalDocuments: additionalDocuments, // Add additional documents
        contract_id: invoiceData.contract_id,
        contract_no: invoiceData.contract_no,
        contract_password: invoiceData.contract_password,
        invoice_date: invoiceData.invoice_date,
        due_date: invoiceData.due_date,
        items: invoiceData.items?.map((item) => {
          // Extract expenseAccount ID - handle both object (populated) and string cases
          let expenseAccountId = null;
          if (item.expenseAccount) {
            if (
              typeof item.expenseAccount === "object" &&
              item.expenseAccount._id
            ) {
              expenseAccountId = item.expenseAccount._id;
            } else if (
              typeof item.expenseAccount === "string" &&
              item.expenseAccount.trim() !== ""
            ) {
              expenseAccountId = item.expenseAccount;
            }
          }

          return {
            ...item,
            // Remove empty string expenseAccount fields
            expenseAccount: expenseAccountId || undefined,
          };
        }),
        business_id: invoiceData.business_id,
        subTotal: invoiceData.subTotal,
        discount: Number.parseFloat(invoiceData.discount) || 0,
        discountAmount: invoiceData.discountAmount || 0,
        documentUrl: attachInvoice ? documentUrlToUse : undefined,
        shippingCharges: Number.parseFloat(invoiceData.shippingCharges) || 0,
        adjustment: Number.parseFloat(invoiceData.adjustment) || 0,
        grandTotal: invoiceData.grandTotal,
        status: "pending", // Set to pending when saving and sending invoice
        billingAddress: invoiceData.billingAddress,
        shippingAddress: invoiceData.shippingAddress || "",
        sameAsBilling: invoiceData.sameAsBilling === true,
        termsAndConditions: invoiceData.termsAndConditions || "",
        terms: stripHtml(invoiceData.terms),
        supportingDocument: invoiceData?.supportingDocument,
        module: invoiceData?.module,
        isAdvancePayment: invoiceData.isAdvancePayment || false,
        advanceAmount: invoiceData.advanceAmount || 0,
        originalContractAmount: invoiceData.originalContractAmount || 0,
        remainingAmount: invoiceData.remainingAmount || 0,
        deposit: invoiceData.deposit || 0,
        depositAmount: invoiceData.depositAmount || 0,
        contractTotal: invoiceData.contractTotal || 0,
        advanceDepositAmount: invoiceData.advanceDepositAmount || 0,
        salesContractTotal: invoiceData.salesContractTotal || 0,
        orderNumber: invoiceData.orderNumber,
        ...(invoiceData?.quotationId && {
          quotationId: invoiceData.quotationId,
        }),
        ...(invoiceData?.salesOrderId ? { salesOrderId: invoiceData.salesOrderId } : {}),
        ...(invoiceData.recurring_invoice_profile_id && {
          recurring_invoice_profile_id:
            invoiceData.recurring_invoice_profile_id,
        }),
      };

      console.log("payload", payload);
      console.log("additionalDocuments being sent:", additionalDocuments);
      console.log("is update", isUpdate, "invoice id", invoiceId);

      let response;
      if (
        isUpdate !== undefined &&
        isUpdate === true &&
        invoiceId !== undefined
      ) {
        response = await axios.put(
          `${Base_URL}/proforma-invoice/${invoiceId}`,
          payload,
          { headers }
        );
      } else {
        response = await axios.post(`${Base_URL}/proforma-invoice`, payload, {
          headers,
        });
      }

      console.log("Backend response:", response.data);

      if (response.data && response.data.status === true) {
        // Check if invoice was actually created
        if (!response.data.data || !response.data.data._id) {
          notifyError(
            "Email sent but invoice creation failed. Please check the invoice listing."
          );
          console.error("Invoice not created:", response.data);
          return;
        }

        const persistedInvoiceId =
          invoiceId || response.data?.data?._id || response.data?._id;
        const customFieldValuesToPersist =
          stateData?.invoiceCustomFieldValues ||
          stateData?.documentCustomFieldValues ||
          {};
        const businessIdForCustomFields =
          (typeof response.data?.data?.business_id === "object"
            ? response.data?.data?.business_id?._id
            : response.data?.data?.business_id) ||
          (typeof invoiceData?.business_id === "object"
            ? invoiceData?.business_id?._id
            : invoiceData?.business_id) ||
          (typeof businessData?._id === "string" ? businessData._id : "");

        if (persistedInvoiceId && businessIdForCustomFields) {
          try {
            await upsertValues(
              {
                business_id: String(businessIdForCustomFields),
                module: "sales",
                screen: "invoice",
                record_id: String(persistedInvoiceId),
                values: customFieldValuesToPersist,
              },
              headers,
            );
          } catch (cfErr) {
            notifyError(
              cfErr?.response?.data?.message ||
                "Invoice was saved, but custom fields could not be persisted.",
            );
            return;
          }
        }

        notifySuccess("Email sent successfully!");
        // Redirect back to where the user came from
        if (invoiceData?.location === "customer-invoices") {
          history.push("/customer-invoices");
        } else if (
          invoiceData?.location === "view-sales-contract" &&
          invoiceData.contract_id
        ) {
          // Redirect to the specific contract details page
          history.push(`/view-sales-contract/${invoiceData.contract_id}`);
        } else {
          // Fallback to customer invoices list
          history.push("/customer-invoices");
        }
      } else {
        notifyError(response.data?.message || "Failed to create invoice");
      }
    } catch (error) {
      console.error("Error sending email:", error);
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to send email";
      notifyError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Editor commands
  const execCommand = (command, value = null) => {
    if (!isEditingHtml) return;
    const doc = editorIframeRef.current?.getDocument?.();
    if (!doc) return;
    doc.execCommand(command, false, value);
    const html = editorIframeRef.current?.getHtml?.();
    if (html) setEmailHtml(html);
  };

  // Toggle between WYSIWYG and raw HTML mode
  const toggleHtmlMode = () => {
    setRawHtmlMode(!rawHtmlMode);
  };

  // Update HTML content when editing raw HTML
  const handleRawHtmlChange = (e) => {
    setEmailHtml(e.target.value);
  };


  // Add advance payment information to email template
  const renderAdvancePaymentInfo = () => {
    if (
      invoiceData.invoiceType === "Commercial" &&
      invoiceData.advanceAmount > 0
    ) {
      return `
        <div style="margin: 20px 0; padding: 15px; background-color: #f8f9fa; border-radius: 5px;">
          <h3 style="color: #333; margin-bottom: 10px;">Payment Summary</h3>
          <p>Original Contract Amount: USD ${invoiceData.originalContractAmount.toFixed(
        2
      )}</p>
          <p>Advance Payment: USD ${invoiceData.advanceAmount.toFixed(2)}</p>
          <p style="font-weight: bold;">Remaining Balance: USD ${invoiceData.remainingAmount.toFixed(
        2
      )}</p>
        </div>
      `;
    } else if (
      invoiceData.invoiceType === "Proforma" &&
      (invoiceData.isAdvancePayment ||
        invoiceData.advanceDepositAmount > 0 ||
        invoiceData.depositAmount > 0)
    ) {
      const depositAmount =
        invoiceData.advanceDepositAmount ||
        invoiceData.depositAmount ||
        invoiceData.advanceAmount ||
        0;
      const contractTotal =
        invoiceData.contractTotal || invoiceData.originalContractAmount || 0;
      const depositPercentage =
        invoiceData.depositPercentage || invoiceData.deposit || 0;
      const remainingAmount = contractTotal - depositAmount;

      return `
        <div style="margin: 20px 0; padding: 15px; background-color: #e8f4fd; border-radius: 5px;">
          <h3 style="color: #333; margin-bottom: 10px;">Advance Deposit Information</h3>
          <p>This is a Customer Invoice for advance deposit payment of ${invoiceData.currency || "USD"
        } ${depositAmount.toFixed(2)}</p>
          ${contractTotal > 0
          ? `<p>Total Contract Amount: ${invoiceData.currency || "USD"
          } ${contractTotal.toFixed(2)}</p>`
          : ""
        }
          ${depositPercentage > 0
          ? `<p>Deposit Percentage: ${depositPercentage}%</p>`
          : ""
        }
          ${remainingAmount > 0
          ? `<p>Remaining Balance After This Payment: ${invoiceData.currency || "USD"
          } ${remainingAmount.toFixed(2)}</p>`
          : ""
        }
        </div>
      `;
    }
    return "";
  };

  // Modify the email template to include advance payment info
  const getEmailTemplate = () => {
    const template = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Invoice ${invoiceData.invoice_number}</h2>
        ${renderAdvancePaymentInfo()}
        <div style="margin: 20px 0;">
          <p>Dear ${invoiceData.customer_name},</p>
          <p>Please find attached the ${invoiceData.invoiceType.toLowerCase()} invoice for your reference.</p>
          <p>Invoice Details:</p>
          <ul>
            <li>Invoice Number: ${invoiceData.invoice_number}</li>
            <li>Date: ${formatDate(invoiceData.invoice_date)}</li>
            <li>Due Date: ${formatDate(invoiceData.due_date)}</li>
            <li>Total Amount: ${invoiceData.currency || "USD"} ${invoiceData.invoiceType === "Proforma" &&
        (invoiceData.advanceDepositAmount > 0 || invoiceData.depositAmount > 0)
        ? (
          invoiceData.advanceDepositAmount || invoiceData.depositAmount
        ).toFixed(2)
        : invoiceData.grandTotal.toFixed(2)
      }</li>
          </ul>
          <p>Please process the payment according to the terms mentioned in the invoice.</p>
          <p>Thank you for your business.</p>
          <p>Best regards,<br>Finance Department</p>
        </div>
      </div>
    `;
    return template;
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Back button */}
      <div className="mb-8">
        <button
          className="flex items-center text-gray-700 text-sm"
          onClick={() => history.goBack()}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("common.back", { defaultValue: "Back" })}
        </button>
      </div>

      {/* Email Title */}
      <h1 className="text-2xl font-medium mb-8">
        {t("salesContract.invoice.emailTo", {
          defaultValue: "Email to {{customer}}",
          customer: invoiceData?.customer_name || "AF Juta Trading",
        })}
      </h1>

      {/* Email Form */}
      <div className="border border-gray-200 rounded-lg p-6 mb-8">
        <div className="grid grid-cols-[100px_1fr] items-center mb-4 border-b border-gray-100 pb-4">
          <label className="text-gray-600">
            {t("common.from", { defaultValue: "From" })}
          </label>
          <input
            type="email"
            name="from"
            value={emailData.from}
            onChange={handleInputChange}
            className="border-none outline-none w-full"
          />
        </div>

        <div className="grid grid-cols-[100px_1fr] items-center mb-4 border-b border-gray-100 pb-4">
          <label className="text-gray-600">
            {t("common.sendTo", { defaultValue: "Send To" })}
          </label>
          <div className="relative">
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-gray-300 px-2 py-1 min-h-[40px] bg-white">
              {toEmails.map((email) => (
                <span
                  key={email}
                  className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-slate-700 text-sm border border-slate-200"
                >
                  {email}
                  <button
                    type="button"
                    className="ml-1 text-slate-400 hover:text-red-500"
                    onClick={() => removeRecipient("to", email)}
                  >
                    <X size={14} />
                  </button>
                </span>
              ))}
              <input
                type="email"
                value={toInput}
                onChange={(e) => {
                  setToInput(e.target.value);
                  setRecipientError("");
                  setShowToDropdown(true);
                }}
                onFocus={() => setShowToDropdown(true)}
                onBlur={() => setTimeout(() => setShowToDropdown(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addRecipient("to", toInput);
                  }
                }}
                className="border-none outline-none flex-1 min-w-[180px]"
                placeholder={t("salesContract.invoice.addRecipientEmail", {
                  defaultValue: "Add recipient email",
                })}
              />
            </div>
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowCcField(true);
                  setShowCcDropdown(true);
                }}
                className={`text-sm font-medium ${showCcField ? "text-[var(--p-blue)]" : "text-gray-500 hover:text-[var(--p-blue)]"}`}
              >
                Cc
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowBccField(true);
                  setShowBccDropdown(true);
                }}
                className={`text-sm font-medium ${showBccField ? "text-[var(--p-blue)]" : "text-gray-500 hover:text-[var(--p-blue)]"}`}
              >
                Bcc
              </button>
            </div>
            {showToDropdown && getSuggestedContacts("to", toInput).length > 0 && (
              <div className="absolute z-20 mt-2 w-full max-h-44 overflow-auto rounded-md border border-gray-200 bg-white shadow-sm">
                {getSuggestedContacts("to", toInput).map((opt) => (
                  <button
                    key={opt.email}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      addRecipient("to", opt.email);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 border-b last:border-b-0"
                  >
                    {opt.label} ({opt.email})
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {showCcField && (
        <div className="grid grid-cols-[100px_1fr] items-center mb-4 border-b border-gray-100 pb-4">
          <label className="text-gray-600">
            {t("common.cc", { defaultValue: "CC" })}
          </label>
          <div className="relative">
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-gray-300 px-2 py-1 min-h-[40px] bg-white">
              {ccEmails.map((email) => (
                <span key={email} className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-slate-700 text-sm border border-slate-200">
                  {email}
                  <button
                    type="button"
                    className="ml-1 text-slate-400 hover:text-red-500"
                    onClick={() => removeRecipient("cc", email)}
                  >
                    <X size={14} />
                  </button>
                </span>
              ))}
              <input
                type="email"
                value={ccInput}
                onChange={(e) => {
                  setCcInput(e.target.value);
                  setRecipientError("");
                  setShowCcDropdown(true);
                }}
                onFocus={() => setShowCcDropdown(true)}
                onBlur={() => setTimeout(() => setShowCcDropdown(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addRecipient("cc", ccInput);
                  }
                }}
                className="border-none outline-none flex-1 min-w-[180px]"
                placeholder={t("salesContract.invoice.addCcEmail", {
                  defaultValue: "Add CC email",
                })}
              />
            </div>
            {showCcDropdown && getSuggestedContacts("cc", ccInput).length > 0 && (
              <div className="absolute z-20 mt-2 w-full max-h-44 overflow-auto rounded-md border border-gray-200 bg-white shadow-sm">
                {getSuggestedContacts("cc", ccInput).map((opt) => (
                  <button
                    key={opt.email}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      addRecipient("cc", opt.email);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 border-b last:border-b-0"
                  >
                    {opt.label} ({opt.email})
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        )}

        {showBccField && (
        <div className="grid grid-cols-[100px_1fr] items-center mb-4 border-b border-gray-100 pb-4">
          <label className="text-gray-600">
            {t("common.bcc", { defaultValue: "BCC" })}
          </label>
          <div className="relative">
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-gray-300 px-2 py-1 min-h-[40px] bg-white">
              {bccEmails.map((email) => (
                <span key={email} className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-slate-700 text-sm border border-slate-200">
                  {email}
                  <button
                    type="button"
                    className="ml-1 text-slate-400 hover:text-red-500"
                    onClick={() => removeRecipient("bcc", email)}
                  >
                    <X size={14} />
                  </button>
                </span>
              ))}
              <input
                type="email"
                value={bccInput}
                onChange={(e) => {
                  setBccInput(e.target.value);
                  setRecipientError("");
                  setShowBccDropdown(true);
                }}
                onFocus={() => setShowBccDropdown(true)}
                onBlur={() => setTimeout(() => setShowBccDropdown(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addRecipient("bcc", bccInput);
                  }
                }}
                className="border-none outline-none flex-1 min-w-[180px]"
                placeholder={t("salesContract.invoice.addBccEmail", {
                  defaultValue: "Add BCC email",
                })}
              />
            </div>
            {showBccDropdown && getSuggestedContacts("bcc", bccInput).length > 0 && (
              <div className="absolute z-20 mt-2 w-full max-h-44 overflow-auto rounded-md border border-gray-200 bg-white shadow-sm">
                {getSuggestedContacts("bcc", bccInput).map((opt) => (
                  <button
                    key={opt.email}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      addRecipient("bcc", opt.email);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 border-b last:border-b-0"
                  >
                    {opt.label} ({opt.email})
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        )}
        {recipientError && (
          <div className="text-red-500 text-xs mb-4">{recipientError}</div>
        )}

        <div className="grid grid-cols-[100px_1fr] items-center mb-4">
          <label className="text-gray-600">
            {t("common.subject", { defaultValue: "Subject" })}
          </label>
          <input
            type="text"
            name="subject"
            value={emailData.subject}
            onChange={handleInputChange}
            className="border-none outline-none w-full"
          />
        </div>
      </div>

      {/* Email Content Editor */}
      <div className="mb-8">
        <div className="bg-gray-100 p-2 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                className={`px-3 py-1 rounded ${!isEditingHtml ? "bg-white font-bold" : "bg-gray-200"
                  }`}
                onClick={() => setIsEditingHtml(false)}
              >
                {t("common.preview", { defaultValue: "Preview" })}
              </button>
              <button
                className={`px-3 py-1 rounded ${isEditingHtml ? "bg-white font-bold" : "bg-gray-200"
                  }`}
                onClick={() => setIsEditingHtml(true)}
              >
                HTML
              </button>
            </div>

            {isEditingHtml && (
              <div className="flex items-center gap-1">
                <button
                  className={`p-1 rounded ${rawHtmlMode ? "bg-white" : "bg-gray-200"
                    }`}
                  onClick={toggleHtmlMode}
                  title={
                    rawHtmlMode
                      ? t("documents.wysiwygEditor", { defaultValue: "WYSIWYG Editor" })
                      : t("documents.rawHtml", { defaultValue: "Raw HTML" })
                  }
                >
                  <Code className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {isEditingHtml && !rawHtmlMode && (
            <div className="flex items-center gap-1 mt-2 flex-wrap border-t border-gray-200 pt-2">
              <button
                className="p-1 rounded hover:bg-white"
                onClick={() => execCommand("bold")}
                title={t("documents.editor.bold", { defaultValue: "Bold" })}
              >
                <Bold className="h-4 w-4" />
              </button>
              <button
                className="p-1 rounded hover:bg-white"
                onClick={() => execCommand("italic")}
                title={t("documents.editor.italic", { defaultValue: "Italic" })}
              >
                <Italic className="h-4 w-4" />
              </button>
              <button
                className="p-1 rounded hover:bg-white"
                onClick={() => execCommand("underline")}
                title={t("documents.editor.underline", { defaultValue: "Underline" })}
              >
                <Underline className="h-4 w-4" />
              </button>
              <div className="w-px h-5 bg-gray-300 mx-1"></div>
              <button
                className="p-1 rounded hover:bg-white"
                onClick={() => execCommand("insertUnorderedList")}
                title={t("documents.editor.bulletList", { defaultValue: "Bullet List" })}
              >
                <List className="h-4 w-4" />
              </button>
              <button
                className="p-1 rounded hover:bg-white"
                onClick={() => execCommand("insertOrderedList")}
                title={t("documents.editor.numberedList", { defaultValue: "Numbered List" })}
              >
                <ListOrdered className="h-4 w-4" />
              </button>
              <div className="w-px h-5 bg-gray-300 mx-1"></div>
              <button
                className="p-1 rounded hover:bg-white"
                onClick={() => execCommand("justifyLeft")}
                title={t("documents.editor.alignLeft", { defaultValue: "Align Left" })}
              >
                <AlignLeft className="h-4 w-4" />
              </button>
              <button
                className="p-1 rounded hover:bg-white"
                onClick={() => execCommand("justifyCenter")}
                title={t("documents.editor.alignCenter", { defaultValue: "Align Center" })}
              >
                <AlignCenter className="h-4 w-4" />
              </button>
              <button
                className="p-1 rounded hover:bg-white"
                onClick={() => execCommand("justifyRight")}
                title={t("documents.editor.alignRight", { defaultValue: "Align Right" })}
              >
                <AlignRight className="h-4 w-4" />
              </button>
              <button
                className="p-1 rounded hover:bg-white"
                onClick={() => execCommand("justifyFull")}
                title={t("documents.editor.justify", { defaultValue: "Justify" })}
              >
                <AlignJustify className="h-4 w-4" />
              </button>
              <div className="w-px h-5 bg-gray-300 mx-1"></div>
              <button
                className="p-1 rounded hover:bg-white"
                onClick={() => {
                  const url = prompt(
                    t("documents.editor.enterLinkUrl", { defaultValue: "Enter link URL:" })
                  );
                  if (url) execCommand("createLink", url);
                }}
                title={t("documents.editor.insertLink", { defaultValue: "Insert Link" })}
              >
                <Link className="h-4 w-4" />
              </button>
              <button
                className="p-1 rounded hover:bg-white"
                onClick={() => {
                  const url = prompt(
                    t("documents.editor.enterImageUrl", { defaultValue: "Enter image URL:" })
                  );
                  if (url) execCommand("insertImage", url);
                }}
                title={t("documents.editor.insertImage", { defaultValue: "Insert Image" })}
              >
                <ImageIcon className="h-4 w-4" />
              </button>
              <div className="w-px h-5 bg-gray-300 mx-1"></div>
              <select
                className="p-1 rounded text-xs bg-white border border-gray-200"
                onChange={(e) => execCommand("formatBlock", e.target.value)}
                defaultValue=""
              >
                <option value="" disabled>
                  {t("documents.editor.format", { defaultValue: "Format" })}
                </option>
                <option value="h1">{t("documents.editor.heading1", { defaultValue: "Heading 1" })}</option>
                <option value="h2">{t("documents.editor.heading2", { defaultValue: "Heading 2" })}</option>
                <option value="h3">{t("documents.editor.heading3", { defaultValue: "Heading 3" })}</option>
                <option value="p">{t("documents.editor.paragraph", { defaultValue: "Paragraph" })}</option>
                <option value="pre">{t("documents.editor.preformatted", { defaultValue: "Preformatted" })}</option>
              </select>
              <select
                className="p-1 rounded text-xs bg-white border border-gray-200"
                onChange={(e) => execCommand("fontName", e.target.value)}
                defaultValue=""
              >
                <option value="" disabled>
                  {t("documents.editor.font", { defaultValue: "Font" })}
                </option>
                <option value="Arial">Arial</option>
                <option value="Helvetica">Helvetica</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Courier New">Courier New</option>
                <option value="Verdana">Verdana</option>
              </select>
              <select
                className="p-1 rounded text-xs bg-white border border-gray-200"
                onChange={(e) => execCommand("fontSize", e.target.value)}
                defaultValue=""
              >
                <option value="" disabled>
                  {t("documents.editor.size", { defaultValue: "Size" })}
                </option>
                <option value="1">{t("documents.editor.small", { defaultValue: "Small" })}</option>
                <option value="3">{t("documents.editor.normal", { defaultValue: "Normal" })}</option>
                <option value="5">{t("documents.editor.large", { defaultValue: "Large" })}</option>
                <option value="7">{t("documents.editor.extraLarge", { defaultValue: "X-Large" })}</option>
              </select>
              <input
                type="color"
                className="w-6 h-6 p-0 border-0 rounded"
                onChange={(e) => execCommand("foreColor", e.target.value)}
                title={t("documents.editor.textColor", { defaultValue: "Text Color" })}
              />
              <input
                type="color"
                className="w-6 h-6 p-0 border-0 rounded"
                onChange={(e) => execCommand("hiliteColor", e.target.value)}
                title={t("documents.editor.backgroundColor", {
                  defaultValue: "Background Color",
                })}
              />
            </div>
          )}
        </div>

        {isEditingHtml ? (
          rawHtmlMode ? (
            <textarea
              className="w-full h-96 p-4 border border-gray-200 rounded-lg font-mono text-sm"
              value={emailHtml}
              onChange={handleRawHtmlChange}
            ></textarea>
          ) : (
            <div className="w-full">
              <EmailTemplateIframePreview
                ref={editorIframeRef}
                html={resolvedPreviewHtml}
                editable
                onChange={setEmailHtml}
                minHeight="24rem"
                fullWidth
              />
            </div>
          )
        ) : (
          <div className="w-full">
            <EmailTemplateIframePreview
              html={resolvedPreviewHtml}
              minHeight={400}
              fullWidth
            />
          </div>
        )}
      </div>

      {/* Attachments */}
      <div className="mb-8">
        <div className="bg-[#f9f9f9] p-4 rounded-lg mb-4 flex items-center">
          <input
            type="checkbox"
            id="invoices"
            className="mr-3"
            checked={attachInvoice}
            onChange={(e) => setAttachInvoice(e.target.checked)}
          />
          <div className="flex-1">
            <label htmlFor="invoices" className="font-medium block">
              {t("salesContract.invoice.attachInvoicePdf", {
                defaultValue: "Attach invoice PDF",
              })}
            </label>
            <p className="text-sm text-gray-500">
              {t("salesContract.invoice.attachInvoiceDescription", {
                defaultValue: "Include Customer Invoice and attach to this email.",
              })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">invoice.pdf</span>
            <Eye className="h-5 w-5 text-gray-500" />
          </div>
        </div>

        {/* Removed Sales Contract attachment option - not applicable for Proforma Invoices */}

        {/* <div className="bg-[#f9f9f9] p-4 rounded-lg flex items-center">
          <input
            type="checkbox"
            id="statement"
            className="mr-3"
            checked={attachStatement}
            onChange={(e) => setAttachStatement(e.target.checked)}
          />
          <div className="flex-1">
            <label htmlFor="statement" className="font-medium block">
              Attach Customer Statement
            </label>
            <p className="text-sm text-gray-500">Date Range: 01 Dec 2024 - 03 Dec 2024</p>
            <p className="text-sm text-gray-500">Filter By: All</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">INV-1</span>
            <Eye className="h-5 w-5 text-gray-500" />
          </div>
        </div> */}
      </div>

      {/* Additional Documents Upload */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">
          {t("documents.additionalDocuments", { defaultValue: "Additional Documents" })}
        </h3>
        <div className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-6">
          <div className="text-center">
            <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <div className="space-y-2">
              <p className="text-gray-600">
                {t("documents.additionalDocumentsDescription", {
                  defaultValue:
                    "Upload additional documents to send with this email (e.g., sales contract, terms & conditions)",
                })}
              </p>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center px-4 py-2 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[#9CBA33] transition-colors disabled:opacity-50"
              >
                <Upload size={16} className="mr-2" />
                {uploading
                  ? t("documents.uploading", { defaultValue: "Uploading..." })
                  : t("documents.chooseFile", { defaultValue: "Choose File" })}
              </button>
            </div>
            {uploading && (
              <div className="mt-4">
                <div className="bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-[var(--p-blue)] h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  {t("documents.uploadProgress", {
                    defaultValue: "{{progress}}% uploaded",
                    progress: uploadProgress,
                  })}
                </p>
              </div>
            )}
            {uploadSuccess && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-700 text-sm">{successMessage}</p>
              </div>
            )}
          </div>
        </div>

        {/* Display uploaded documents */}
        {additionalDocuments.length > 0 && (
          <div className="mt-4">
            <h4 className="text-md font-medium mb-3 text-gray-700">
              {t("documents.uploadedDocumentsCount", {
                defaultValue: "Uploaded Documents ({{count}})",
                count: additionalDocuments.length,
              })}
            </h4>
            <div className="space-y-2">
              {additionalDocuments.map((doc) => (
                <div
                  key={doc.fileId}
                  className="bg-gray-50 p-4 rounded-lg flex items-center justify-between"
                >
                  <div className="flex items-center">
                    <FileText className="h-6 w-6 text-[var(--p-blue)] mr-3" />
                    <div>
                      <p className="font-medium text-gray-800">{doc.name}</p>
                      <p className="text-sm text-gray-500">
                        {(doc.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenFile(doc.fileId)}
                      className="p-2 text-[var(--p-blue)] hover:text-[#9CBA33] rounded-lg transition-colors"
                      title={t("documents.viewDocument", { defaultValue: "View Document" })}
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveDocument(doc.fileId)}
                      className="p-2 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-colors"
                      title={t("documents.removeDocument", {
                        defaultValue: "Remove Document",
                      })}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-4">
        <button
          className="px-8 py-3 bg-[#f5f5f5] rounded-md text-sm"
          onClick={() => history.goBack()}
        >
          {t("common.cancel", { defaultValue: "Cancel" })}
        </button>
        <button
          className="px-8 py-3 bg-[#bcd351] text-white rounded-md text-sm"
          onClick={handleSendEmail}
          disabled={loading}
        >
          {loading
            ? t("common.sending", { defaultValue: "Sending..." })
            : t("common.send", { defaultValue: "Send" })}
        </button>
      </div>
    </div>
  );
}
