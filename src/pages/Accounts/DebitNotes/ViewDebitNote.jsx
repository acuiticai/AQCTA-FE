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
  Printer,
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
  makeDebitNoteT,
  translateDebitNoteStatus,
} from "@/utils/creditDebitNoteI18n";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const statusConfig = {
  Draft: {
    color: "bg-gray-100 text-gray-800 border-gray-300",
    icon: Edit3,
    bgColor: "bg-gray-50",
    textColor: "text-gray-700",
    description: "Debit note is being prepared",
  },
  Created: {
    color: "bg-blue-100 text-blue-800 border-blue-300",
    icon: FileText,
    bgColor: "bg-blue-50",
    textColor: "text-blue-700",
    description: "Debit note has been created and submitted",
  },
  "Approved by Management": {
    color: "bg-green-100 text-green-800 border-green-300",
    icon: CheckCircle,
    bgColor: "bg-green-50",
    textColor: "text-green-700",
    description: "Debit note has been approved by management",
  },
  Settled: {
    color: "bg-purple-100 text-purple-800 border-purple-300",
    icon: DollarSign,
    bgColor: "bg-purple-50",
    textColor: "text-purple-700",
    description: "Debit note has been settled",
  },
  Cancelled: {
    color: "bg-red-100 text-red-800 border-red-300",
    icon: AlertCircle,
    bgColor: "bg-red-50",
    textColor: "text-red-700",
    description: "Debit note has been cancelled",
  },
};

// Status transitions for debit notes
const getValidStatusTransitions = () => {
  return {
    Draft: ["Created", "Cancelled"],
    Created: ["Approved by Management", "Cancelled"],
    "Approved by Management": ["Settled", "Cancelled"],
    Settled: [],
    Cancelled: [],
  };
};

export default function ViewDebitNote() {
  const { t } = useTranslation();
  const dn = makeDebitNoteT(t);
  const history = useHistory();
  const { id } = useParams();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const fileInputRef = useRef(null);

  const [debitNote, setDebitNote] = useState(null);
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
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const lineRollup = useMemo(
    () => summarizeCnDnLines(debitNote?.items),
    [debitNote?.items]
  );
  const taxPercent = useMemo(() => {
    const base = Number(lineRollup.totalNetExTax) || 0;
    if (base <= 0) return null;
    const pct = ((Number(lineRollup.totalTax) || 0) / base) * 100;
    if (!Number.isFinite(pct)) return null;
    return pct;
  }, [lineRollup.totalNetExTax, lineRollup.totalTax]);
  const documentDiscountPercent = useMemo(() => {
    const explicit = Number(debitNote?.discountPercentage);
    if (Number.isFinite(explicit)) return explicit;
    const subtotal = Number(debitNote?.subtotal) || 0;
    const discountAmount = Number(debitNote?.discountAmount) || 0;
    if (subtotal <= 0 || discountAmount <= 0) return null;
    const pct = (discountAmount / subtotal) * 100;
    if (!Number.isFinite(pct)) return null;
    return pct;
  }, [debitNote?.discountAmount, debitNote?.discountPercentage, debitNote?.subtotal]);

  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo.token}`,
  };

  useEffect(() => {
    fetchDebitNote();
  }, [id]);

  const fetchDebitNote = async () => {
    try {
      const response = await axios.get(`${Base_URL}/debit-notes/${id}`, {
        headers,
      });
      if (response.data.success) {
        setDebitNote(response.data.data);
        setSelectedStatus(response.data.data.status);
      }
    } catch (error) {
      console.error("Error fetching debit note:", error);
      notifyError(dn("toasts.loadOneFailed", "Failed to load debit note"));
      history.push("/debit-notes");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      Draft: "bg-gray-100 text-gray-800",
      Created: "bg-blue-100 text-blue-800",
      "Approved by Management": "bg-green-100 text-green-800",
      Settled: "bg-purple-100 text-purple-800",
      Cancelled: "bg-red-100 text-red-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const getValidTransitions = (currentStatus) => {
    const validTransitions = getValidStatusTransitions();
    return validTransitions[currentStatus] || [];
  };

  const handleStatusChange = (e) => {
    const newStatus = e.target.value;
    setSelectedStatus(newStatus);
  };

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
  };

  const handleUploadAndStatusUpdate = async () => {
    if (!selectedStatus || selectedStatus === debitNote.status) {
      notifyError(dn("toasts.selectNewStatus", "Please select a new status"));
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
          `DebitNotes/${debitNote.debitNoteNumber}`
        );
        formDataForUpload.append("business_id", debitNote.business._id);
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
            description: dn("detail.statusChangeDocument", "Status change document - {{status}}", { status: translateDebitNoteStatus(t, selectedStatus) }),
            size: selectedFile.size,
            type: selectedFile.type,
          };

          console.log("Document data being sent:", documentData);
        }
      }

      // Prepare update data
      const updateData = {
        status: selectedStatus,
        ...(documentData && { documents: documentData }),
      };

      // Update debit note status with or without document using the correct endpoint
      const updateResponse = await axios.patch(
        `${Base_URL}/debit-notes/${debitNote._id}/status`,
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
            ? dn("toasts.statusUpdatedWithDocument", "Status updated and document uploaded successfully!")
            : dn("toasts.statusUpdated", "Status updated successfully!")
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
          dn("toasts.statusUpdateFailed", "Failed to update status or upload document")
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
      notifyError(dn("toasts.openFileFailed", "Error opening file"));
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
      notifyError(dn("toasts.downloadFailed", "Failed to download file"));
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
      notifyError(dn("toasts.downloadFailed", "Failed to download file"));
    }
  };

  const generateProfessionalInvoiceHTML = () => {
    const businessName =
      debitNote.business?.name ||
      dn("detail.pdfYourBusinessName", "Your Business Name");

    // Dynamic entity information based on entity type
    const entityName =
      debitNote.entityType === "vendor"
        ? debitNote.vendor?.basicInformation?.vendorDisplayName ||
          dn("detail.pdfVendorName", "Vendor Name")
        : `${debitNote.customer?.basicInformation?.primaryContact?.firstName} ${debitNote.customer?.basicInformation?.primaryContact?.lastName}` ||
          dn("detail.pdfCustomerName", "Customer Name");

    const entityEmail =
      debitNote.entityType === "vendor"
        ? debitNote.vendor?.basicInformation?.vendorEmail || ""
        : debitNote.customer?.basicInformation?.customerEmail || "";

    const entityPhone =
      debitNote.entityType === "vendor"
        ? debitNote.vendor?.basicInformation?.primaryContact?.phone || ""
        : debitNote.customer?.basicInformation?.primaryContact?.phone || "";

    const entityAddress =
      debitNote.entityType === "vendor"
        ? debitNote.vendor?.basicInformation?.address || ""
        : debitNote.customer?.basicInformation?.address || "";

    const entityType =
      debitNote.entityType === "vendor"
        ? dn("detail.vendor", "Vendor")
        : dn("detail.customer", "Customer");
    const translatedStatus = translateDebitNoteStatus(t, debitNote.status);

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${dn("detail.pdfHtmlTitle", "Debit Note - {{number}}", { number: debitNote.debitNoteNumber })}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            color: #333;
            background: white;
          }
          
          .invoice-container {
            max-width: 800px;
            margin: 0 auto;
            padding: 40px;
            background: white;
          }
          
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 40px;
            border-bottom: 3px solid var(--p-blue);
            padding-bottom: 20px;
          }
          
          .company-info h1 {
            color: var(--p-blue);
            font-size: 28px;
            font-weight: bold;
            margin-bottom: 5px;
          }
          
          .company-info p {
            color: #666;
            font-size: 14px;
          }
          
          .invoice-title {
            text-align: right;
          }
          
          .invoice-title h2 {
            color: #333;
            font-size: 32px;
            font-weight: bold;
            margin-bottom: 10px;
          }
          
          .invoice-number {
            background: var(--p-blue);
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            font-weight: bold;
            display: inline-block;
          }
          
          .details-section {
            display: flex;
            justify-content: space-between;
            margin-bottom: 40px;
          }
          
          .vendor-details, .invoice-details {
            width: 48%;
          }
          
          .section-title {
            background: #f8f9fa;
            padding: 10px 15px;
            border-left: 4px solid var(--p-blue);
            font-weight: bold;
            color: #333;
            margin-bottom: 15px;
          }
          
          .detail-row {
            display: flex;
            margin-bottom: 8px;
          }
          
          .detail-label {
            font-weight: bold;
            width: 120px;
            color: #555;
          }
          
          .detail-value {
            color: #333;
          }
          
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          
          .items-table th {
            background: var(--p-blue);
            color: white;
            padding: 15px 10px;
            text-align: left;
            font-weight: bold;
          }
          
          .items-table td {
            padding: 12px 10px;
            border-bottom: 1px solid #eee;
          }
          
          .items-table tr:nth-child(even) {
            background: #f9f9f9;
          }
          
          .items-table tr:hover {
            background: #f5f5f5;
          }
          
          .amount-cell {
            text-align: right;
            font-weight: bold;
            color: var(--p-blue);
          }
          
          .totals-section {
            margin-left: auto;
            width: 300px;
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            border: 1px solid #e9ecef;
          }
          
          .total-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            padding: 5px 0;
          }
          
          .total-row.final {
            border-top: 2px solid var(--p-blue);
            padding-top: 15px;
            margin-top: 15px;
            font-size: 18px;
            font-weight: bold;
            color: var(--p-blue);
          }
          
          .notes-section {
            margin-top: 30px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
            border-left: 4px solid var(--p-blue);
          }
          
          .notes-title {
            font-weight: bold;
            color: #333;
            margin-bottom: 10px;
          }
          
          .status-badge {
            display: inline-block;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
          }
          
          .status-draft { background: #f3f4f6; color: #374151; }
          .status-created { background: #dbeafe; color: #1e40af; }
          .status-approved { background: #dcfce7; color: #16a34a; }
          .status-settled { background: #f3e8ff; color: #7c3aed; }
          .status-cancelled { background: #fee2e2; color: #dc2626; }
          
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            text-align: center;
            color: #666;
            font-size: 12px;
          }
          
          .purchase-contract {
            background: #e1f5fe;
            padding: 10px 15px;
            border-radius: 4px;
            margin-bottom: 15px;
            border-left: 4px solid #01579b;
          }
          
          @media print {
            body { print-color-adjust: exact; }
            .invoice-container { margin: 0; padding: 20px; }
          }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <!-- Header -->
          <div class="header">
            <div class="company-info">
              <h1>${businessName}</h1>
              <p>${dn("detail.pdfGeneratedOn", "Generated on {{date}}", { date: formatDate(new Date()) })}</p>
            </div>
            <div class="invoice-title">
              <h2>${dn("detail.pdfTitle", "DEBIT NOTE")}</h2>
              <div class="invoice-number">${debitNote.debitNoteNumber}</div>
            </div>
          </div>

          <!-- Details Section -->
          <div class="details-section">
            <div class="vendor-details">
              <div class="section-title">${dn("detail.pdfEntityInformation", "{{entity}} Information", { entity: entityType })}</div>
              <div class="detail-row">
                <span class="detail-label">${entityType}:</span>
                <span class="detail-value">${entityName}</span>
              </div>
              ${
                entityEmail
                  ? `
              <div class="detail-row">
                <span class="detail-label">${dn("detail.pdfEmail", "Email:")}</span>
                <span class="detail-value">${entityEmail}</span>
              </div>
              `
                  : ""
              }
              ${
                entityPhone
                  ? `
              <div class="detail-row">
                <span class="detail-label">${dn("detail.pdfPhone", "Phone:")}</span>
                <span class="detail-value">${entityPhone}</span>
              </div>
              `
                  : ""
              }
              ${
                entityAddress
                  ? `
              <div class="detail-row">
                <span class="detail-label">${dn("detail.pdfAddress", "Address:")}</span>
                <span class="detail-value">${entityAddress}</span>
              </div>
              `
                  : ""
              }
            </div>
            
            <div class="invoice-details">
              <div class="section-title">${dn("detail.pdfSectionTitle", "Debit Note Details")}</div>
              <div class="detail-row">
                <span class="detail-label">${dn("detail.pdfDate", "Date:")}</span>
                <span class="detail-value">${formatDate(
                  debitNote.debitNoteDate
                )}</span>
              </div>

              <div class="detail-row">
                <span class="detail-label">${dn("detail.pdfCurrency", "Currency:")}</span>
                <span class="detail-value">${debitNote.currency}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">${dn("detail.pdfStatus", "Status:")}</span>
                <span class="status-badge status-${debitNote.status
                  .toLowerCase()
                  .replace(/\s+/g, "-")}">${translatedStatus}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">${dn("detail.pdfTerms", "Terms:")}</span>
                <span class="detail-value">${debitNote.terms}</span>
              </div>
              ${
                debitNote.reference
                  ? `
              <div class="detail-row">
                <span class="detail-label">${dn("detail.pdfReference", "Reference:")}</span>
                <span class="detail-value">${debitNote.reference}</span>
              </div>
              `
                  : ""
              }
            </div>
          </div>

          ${
            debitNote.vendorInvoice || debitNote.customerInvoice
              ? `
          <div class="purchase-contract">
            <strong>${
              debitNote.entityType === "vendor"
                ? dn("detail.vendorInvoice", "Vendor Invoice")
                : dn("detail.customerInvoice", "Customer Invoice")
            }:</strong> ${
                  debitNote.vendorInvoice?.invoiceNumber ||
                  debitNote.customerInvoice?.invoice_number ||
                  dn("list.na", "N/A")
                }
          </div>
          `
              : ""
          }

          <!-- Items Table -->
          <table class="items-table">
            <thead>
              <tr>
                <th style="width:34%;">${dn("detail.pdfItem", "Item")}</th>
                <th style="width:28%;">${dn("detail.pdfDescription", "Description")}</th>
                <th style="width:9%;text-align:right;">${dn("detail.pdfQty", "Qty")}</th>
                <th style="width:12%;text-align:right;">${dn("detail.pdfRate", "Rate")}</th>
                <th style="width:9%;text-align:right;">${dn("detail.pdfDiscPercent", "Disc %")}</th>
                <th style="width:12%;text-align:right;">${dn("detail.pdfTotal", "Total")}</th>
              </tr>
            </thead>
            <tbody>
              ${
                debitNote.items
                  ?.map((item) => {
                    const f = resolveCnDnLineFigures(item);
                    const q =
                      f.quantity != null ? formatQuantity(f.quantity) : "—";
                    const ur =
                      f.unitRate != null
                        ? formatCurrencyAmount(
                            debitNote.currency,
                            f.unitRate,
                          )
                        : "—";
                    return `
                <tr>
                  <td><strong>${item.item_name}</strong></td>
                  <td>${item.description || "-"}</td>
                  <td style="text-align:right;">${q}</td>
                  <td style="text-align:right;">${ur}</td>
                  <td style="text-align:right;">${formatLinePercentCell(
                    f.discountPct
                  )}</td>
                  <td class="amount-cell">${formatCurrencyAmount(
                    debitNote.currency,
                    f.lineTotal,
                  )}</td>
                </tr>
              `;
                  })
                  .join("") ||
                `<tr><td colspan="6">${dn("detail.pdfNoItems", "No items found")}</td></tr>`
              }
            </tbody>
          </table>

          <!-- Totals Section -->
          <div class="totals-section">
            ${
              (() => {
                const r = summarizeCnDnLines(debitNote.items);
                const disc = Number(debitNote.discountAmount) || 0;
                const ship = Number(debitNote.shippingCharges) || 0;
                const adj = debitNote.adjustment;
                const adjN = adj != null ? Number(adj) : null;
                let extra = "";
                if (disc > 0) {
                  extra += `
            <div class="total-row">
              <span>${dn("detail.pdfDocumentDiscount", "Document discount:")}</span>
              <span>−${formatCurrencyAmount(debitNote.currency, disc)}</span>
            </div>`;
                }
                if (ship > 0) {
                  extra += `
            <div class="total-row">
              <span>${dn("detail.pdfShippingCharges", "Shipping charges:")}</span>
              <span>${formatCurrencyAmount(debitNote.currency, ship)}</span>
            </div>`;
                }
                if (
                  adjN != null &&
                  Number.isFinite(adjN) &&
                  Math.abs(adjN) > 1e-9
                ) {
                  extra += `
            <div class="total-row">
              <span>${dn("detail.pdfOverallAdjustment", "Overall adjustment:")}</span>
              <span>${adjN < 0 ? "−" : "+"}${formatCurrencyAmount(
                    debitNote.currency,
                    Math.abs(adjN),
                  )}</span>
            </div>`;
                }
                return `
            <div class="total-row">
              <span>${dn("detail.pdfAmountBeforeTax", "Amount (before tax):")}</span>
              <span>${formatCurrencyAmount(
                debitNote.currency,
                r.totalNetExTax,
              )}</span>
            </div>
            <div class="total-row">
              <span>${dn("detail.pdfTax", "Tax:")}</span>
              <span>${formatCurrencyAmount(
                debitNote.currency,
                r.totalTax,
              )}</span>
            </div>
            <div class="total-row">
              <span>${dn("detail.pdfSubtotalInclTax", "Subtotal (lines, incl. tax):")}</span>
              <span>${formatCurrencyAmount(
                debitNote.currency,
                debitNote.subtotal,
              )}</span>
            </div>${extra}`;
              })()
            }
            <div class="total-row final">
              <span>${dn("detail.pdfTotalAmount", "Total Amount:")}</span>
              <span>${formatCurrencyAmount(
                debitNote.currency,
                debitNote.total,
              )}</span>
            </div>
          </div>

          ${
            debitNote.notes
              ? `
          <div class="notes-section">
            <div class="notes-title">${dn("detail.pdfAdditionalNotes", "Additional Notes:")}</div>
            <p>${debitNote.notes}</p>
          </div>
          `
              : ""
          }

          <!-- Footer -->
          <div class="footer">
            <p>${dn("detail.pdfFooter", "This is a computer-generated debit note. No signature is required.")}</p>
            <p>${dn("detail.pdfGeneratedOnAt", "Generated on {{date}} at {{time}}", {
              date: formatDate(new Date()),
              time: new Date().toLocaleTimeString(),
            })}</p>
            <p>${dn("detail.pdfAllRightsReserved", "© {{year}} {{business}}. All rights reserved.", {
              year: new Date().getFullYear(),
              business: businessName,
            })}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  const handlePrint = async () => {
    if (isGeneratingPDF) return;

    setIsGeneratingPDF(true);

    try {
      // Create a temporary iframe for PDF generation
      const iframe = document.createElement("iframe");
      iframe.style.position = "absolute";
      iframe.style.left = "-9999px";
      iframe.style.width = "800px";
      iframe.style.height = "1200px";
      document.body.appendChild(iframe);

      // Write the HTML content to the iframe
      const htmlContent = generateProfessionalInvoiceHTML();
      iframe.contentDocument.open();
      iframe.contentDocument.write(htmlContent);
      iframe.contentDocument.close();

      // Wait for the content to load
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Generate PDF using html2canvas and jsPDF
      const canvas = await html2canvas(iframe.contentDocument.body, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        width: 800,
        height: iframe.contentDocument.body.scrollHeight,
      });

      const imgData = canvas.toDataURL("image/jpeg", 1.0);

      // Create PDF with A4 dimensions
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "a4",
      });

      const pageWidth = 595;
      const pageHeight = 842;

      // Calculate image dimensions to fit the page
      const imgWidth = pageWidth - 40; // 20pt margin on each side
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // Add image to PDF
      pdf.addImage(imgData, "JPEG", 20, 20, imgWidth, imgHeight);

      // Generate filename
      const fileName = `DebitNote-${debitNote.debitNoteNumber}.pdf`;

      // Create blob and download
      const pdfBlob = pdf.output("blob");
      const pdfFile = new File([pdfBlob], fileName, {
        type: "application/pdf",
        lastModified: new Date().getTime(),
      });

      // Download the PDF
      const link = document.createElement("a");
      link.href = URL.createObjectURL(pdfBlob);
      link.download = fileName;
      link.click();

      // Upload to server for record keeping
      await uploadPDFToServer(pdfFile);

      // Clean up
      document.body.removeChild(iframe);
      URL.revokeObjectURL(link.href);

      notifySuccess(dn("toasts.pdfDownloadSuccess", "Debit note invoice downloaded successfully!"));
    } catch (error) {
      console.error("Error generating PDF:", error);
      notifyError(dn("toasts.pdfGenerateFailed", "Failed to generate PDF invoice. Please try again."));
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const uploadPDFToServer = async (pdfFile) => {
    try {
      const formData = new FormData();
      formData.append("file", pdfFile);
      formData.append("uploadedBy", adminInfo.id);
      formData.append(
        "file_path",
        `DebitNotes/${
          debitNote.business?.name || "Business"
        }/${new Date().getFullYear()}/${
          debitNote.debitNoteNumber
        }/Generated Invoice`
      );
      formData.append("business_id", debitNote.business?._id);
      formData.append("file_type", "application/pdf");
      formData.append("file_size", pdfFile.size.toString());

      const response = await axios.post(
        `${Base_URL}/documents/uploadDocument`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      if (response.data.message === "File uploaded successfully") {
        // Add the generated PDF to the debit note documents
        const newDocument = {
          fileId: response.data.file._id,
          name: pdfFile.name,
          url: response.data.file.url || response.data.file.downloadUrl || "#",
          downloadUrl:
            response.data.file.downloadUrl || response.data.file.url || "#",
          uploadedAt: new Date().toISOString(),
          status: debitNote.status,
          documentType: "Generated",
          description: dn(
            "detail.pdfGeneratedDescription",
            "Debit note invoice (auto-generated)"
          ),
          size: pdfFile.size,
          type: "application/pdf",
        };

        // Update the debit note with the new document
        await axios.put(
          `${Base_URL}/debit-notes/${debitNote._id}`,
          {
            documents: newDocument,
          },
          { headers }
        );

        console.log("✅ PDF uploaded and linked to debit note successfully");
      }
    } catch (error) {
      console.error("❌ Error uploading PDF to server:", error);
      // Don't show error to user as the download was successful
      console.log(
        "PDF downloaded successfully but failed to upload to server for record keeping"
      );
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--p-blue)]"></div>
      </div>
    );
  }

  if (!debitNote) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-500 text-lg">{dn("detail.notFound", "Debit note not found")}</p>
          <button
            onClick={() => history.push("/debit-notes")}
            className="mt-4 px-4 py-2 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[#9CBA33] transition-colors"
          >
            {dn("actions.backToDebitNotes", "Back to Debit Notes")}
          </button>
        </div>
      </div>
    );
  }

  // Status timeline for debit notes
  const getStatusTimeline = () => {
    return ["Draft", "Created", "Approved by Management", "Settled"];
  };

  const statusTimeline = getStatusTimeline();
  const currentStatusIdx = statusTimeline.indexOf(debitNote.status);
  const currentConfig = statusConfig[debitNote.status];
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
                {dn("detail.title", "Debit Note #{{number}}", {
                  number: debitNote.debitNoteNumber,
                })}
              </h1>
              <p className="text-gray-600 mt-2">
                {dn("detail.createdOn", "Created on {{date}}", {
                  date: formatDate(debitNote.createdAt),
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
                  {translateDebitNoteStatus(t, debitNote.status)}
                </span>
              </div>

              {/* Action Buttons */}
              {(debitNote.status === "Draft" ||
                debitNote.status === "Cancelled") && (
                <button
                  onClick={() =>
                    history.push(`/update-debit-note/${debitNote._id}`)
                  }
                  className="flex items-center gap-2 px-4 py-2 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[#9CBA33] transition-colors"
                >
                  <Edit3 size={18} />
                  {dn("actions.editDebitNote", "Edit Debit Note")}
                </button>
              )}

              <button
                onClick={handlePrint}
                disabled={isGeneratingPDF}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGeneratingPDF ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    {dn("actions.generating", "Generating...")}
                  </>
                ) : (
                  <>
                    <Printer size={18} />
                    {dn("actions.downloadInvoice", "Download Invoice")}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Debit Note Details */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="xl:col-span-2 space-y-6">
            {/* Debit Note Information */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <Receipt className="h-5 w-5 text-[var(--p-blue)]" />
                {dn("detail.debitNoteInformation", "Debit Note Information")}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-500">
                      {dn("detail.business", "Business")}
                    </label>
                    <p className="font-medium text-gray-900">
                      {debitNote.business?.name || dn("list.na", "N/A")}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm text-gray-500">
                      {debitNote.entityType === "vendor"
                        ? dn("detail.vendor", "Vendor")
                        : dn("detail.customer", "Customer")}
                    </label>
                    <p className="font-medium text-gray-900">
                      {debitNote.entityType === "vendor"
                        ? debitNote.vendor?.basicInformation
                            ?.vendorDisplayName || dn("list.na", "N/A")
                        : `${debitNote.customer?.basicInformation?.primaryContact?.firstName} ${debitNote.customer?.basicInformation?.primaryContact?.lastName}` ||
                          dn("list.na", "N/A")}
                    </p>
                  </div>

                  {(debitNote.vendorInvoice || debitNote.customerInvoice) && (
                    <div>
                      <label className="text-sm text-gray-500">
                        {debitNote.entityType === "vendor"
                          ? dn("detail.vendorInvoice", "Vendor Invoice")
                          : dn("detail.customerInvoice", "Customer Invoice")}
                      </label>
                      <div className="flex items-center gap-2">
                        <CreditCard
                          size={16}
                          className="text-[var(--p-blue)]"
                        />
                        <span className="font-medium text-gray-900">
                          {debitNote.vendorInvoice?.invoiceNumber ||
                            debitNote.customerInvoice?.invoice_number ||
                            dn("list.na", "N/A")}
                        </span>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-sm text-gray-500">
                      {dn("detail.currency", "Currency")}
                    </label>
                    <p className="font-medium text-gray-900">
                      {debitNote.currency}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-500">
                      {dn("detail.debitNoteDate", "Debit Note Date")}
                    </label>
                    <p className="font-medium text-gray-900">
                      {formatDate(debitNote.debitNoteDate)}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm text-gray-500">
                      {dn("detail.expenseAccount", "Expense Account")}
                    </label>
                    <p className="font-medium text-gray-900">
                      {debitNote.expenseAccount?.code || dn("list.na", "N/A")} -{" "}
                      {debitNote.expenseAccount?.accountName || dn("list.na", "N/A")}
                    </p>
                  </div>
                </div>
              </div>

              {(debitNote.reference || debitNote.notes) && (
                <div className="border-t pt-6 mt-6">
                  {debitNote.reference && (
                    <div className="mb-4">
                      <label className="text-sm text-gray-500">
                        {dn("detail.reference", "Reference")}
                      </label>
                      <p className="font-medium text-gray-900">
                        {debitNote.reference}
                      </p>
                    </div>
                  )}
                  {debitNote.notes && (
                    <div>
                      <label className="text-sm text-gray-500">
                        {dn("detail.notes", "Notes")}
                      </label>
                      <p className="text-gray-900">{debitNote.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Supporting Documents */}
            {debitNote.documents &&
              debitNote.documents.filter(
                (doc) => doc.documentType === "Supporting"
              ).length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <FileText className="h-5 w-5 text-[var(--p-blue)]" />
                    {dn("detail.supportingDocuments", "Supporting Documents")}
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {debitNote.documents
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
                                  {dn("list.uploaded", "Uploaded: {{date}}", {
                                    date: formatDate(doc.uploadedAt),
                                  })}
                                </span>
                                {doc.size && (
                                  <span>
                                    {dn("list.sizeMb", "Size: {{size}} MB", {
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
                                  {dn("actions.view", "View")}
                                </button>
                                <button
                                  onClick={() => handleDownloadFile(doc.fileId)}
                                  className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                                >
                                  <Download size={14} />
                                  {dn("actions.download", "Download")}
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
            {/* Debit Note Summary */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-[var(--p-blue)]" />
                {dn("detail.debitNoteSummary", "Debit Note Summary")}
              </h2>

              <div className="space-y-3">
                <div className="flex justify-between text-gray-600 text-sm gap-4">
                  <span>{dn("detail.amountBeforeTax", "Amount (before tax)")}</span>
                  <span className="font-medium text-gray-900 text-right whitespace-nowrap">
                    {formatCurrencyAmount(
                      debitNote.currency,
                      lineRollup.totalNetExTax,
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-gray-600 text-sm gap-4">
                  <span>{dn("detail.tax", "Tax")}</span>
                  <span className="font-medium text-gray-900 text-right whitespace-nowrap">
                    {taxPercent != null ? formatLinePercentCell(taxPercent) : "—"}
                  </span>
                </div>
                <div className="flex justify-between text-gray-600 text-sm gap-4 border-b border-gray-100 pb-3">
                  <span className="pr-2">
                    {dn("detail.subtotalInclTax", "Subtotal (lines, incl. tax)")}
                  </span>
                  <span className="font-medium text-gray-900 text-right whitespace-nowrap">
                    {formatCurrencyAmount(
                      debitNote.currency,
                      debitNote.subtotal,
                    )}
                  </span>
                </div>

                {(debitNote.discountAmount || 0) > 0 && (
                  <div className="flex justify-between text-gray-600 text-sm gap-4">
                    <span>{dn("detail.documentDiscount", "Document discount")}</span>
                    <span className="font-medium text-gray-900 text-right whitespace-nowrap">
                      {documentDiscountPercent != null
                        ? formatLinePercentCell(documentDiscountPercent)
                        : "—"}
                    </span>
                  </div>
                )}
                {(debitNote.shippingCharges || 0) > 0 && (
                  <div className="flex justify-between text-gray-600 text-sm gap-4">
                    <span>{dn("detail.shippingCharges", "Shipping charges")}</span>
                    <span className="font-medium text-gray-900 text-right whitespace-nowrap">
                      {formatCurrencyAmount(
                        debitNote.currency,
                        debitNote.shippingCharges,
                      )}
                    </span>
                  </div>
                )}
                {debitNote.adjustment != null &&
                  Number.isFinite(Number(debitNote.adjustment)) &&
                  Math.abs(Number(debitNote.adjustment)) > 1e-9 && (
                    <div className="flex justify-between text-gray-600 text-sm gap-4">
                      <span>{dn("detail.overallAdjustment", "Overall adjustment")}</span>
                      <span className="font-medium text-gray-900 text-right whitespace-nowrap">
                        {Number(debitNote.adjustment) < 0 ? "−" : "+"}
                        {formatCurrencyAmount(
                          debitNote.currency,
                          Math.abs(Number(debitNote.adjustment)),
                        )}
                      </span>
                    </div>
                  )}

                <div className="border-t pt-3">
                  <div className="flex justify-between text-lg font-bold text-gray-900">
                    <span>{dn("detail.total", "Total")}</span>
                    <span className="text-[var(--p-blue)]">
                      {formatCurrencyAmount(
                        debitNote.currency,
                        debitNote.total,
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Audit Trail */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Clock className="h-5 w-5 text-[var(--p-blue)]" />
                {dn("detail.auditTrail", "Audit Trail")}
              </h2>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-[var(--p-blue)] mt-2"></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {dn("detail.created", "Created")}
                    </p>
                    <p className="text-xs text-gray-500">
                      {dn("detail.byUser", "{{date}} by {{user}}", {
                        date: formatDate(debitNote.createdAt),
                        user:
                          debitNote.createdBy?.name ||
                          debitNote.createdBy?.email ||
                          dn("detail.system", "System"),
                      })}
                    </p>
                  </div>
                </div>

                {debitNote.approvedAt && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500 mt-2"></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {dn("detail.approved", "Approved")}
                      </p>
                      <p className="text-xs text-gray-500">
                        {dn("detail.byUser", "{{date}} by {{user}}", {
                          date: formatDate(debitNote.approvedAt),
                          user:
                            debitNote.approvedBy?.name ||
                            debitNote.approvedBy?.email ||
                            dn("detail.system", "System"),
                        })}
                      </p>
                    </div>
                  </div>
                )}

                {debitNote.settledAt && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-purple-500 mt-2"></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {dn("detail.settled", "Settled")}
                      </p>
                      <p className="text-xs text-gray-500">
                        {dn("detail.byUser", "{{date}} by {{user}}", {
                          date: formatDate(debitNote.settledAt),
                          user:
                            debitNote.settledBy?.name ||
                            debitNote.settledBy?.email ||
                            dn("detail.system", "System"),
                        })}
                      </p>
                    </div>
                  </div>
                )}

                {debitNote.rejectedAt && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-red-500 mt-2"></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {dn("detail.cancelled", "Cancelled")}
                      </p>
                      <p className="text-xs text-gray-500">
                        {dn("detail.byUser", "{{date}} by {{user}}", {
                          date: formatDate(debitNote.rejectedAt),
                          user:
                            debitNote.rejectedBy?.name ||
                            debitNote.rejectedBy?.email ||
                            dn("detail.system", "System"),
                        })}
                      </p>
                      {debitNote.rejectionReason && (
                        <p className="text-xs text-red-600 mt-1">
                          {dn("detail.reasonLabel", "Reason: {{reason}}", {
                            reason: debitNote.rejectionReason,
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Debit Note Items */}
          <div className="xl:col-span-full bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <Package className="h-5 w-5 text-[var(--p-blue)]" />
              {dn("detail.debitNoteItems", "Debit Note Items")}
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 whitespace-nowrap">
                      {dn("headers.itemName", "Item Name")}
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 min-w-[120px]">
                      {dn("headers.description", "Description")}
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-500 whitespace-nowrap">
                      {dn("headers.qty", "Qty")}
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-500 whitespace-nowrap">
                      {dn("headers.unitRate", "Unit rate")}
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-500 whitespace-nowrap">
                      {dn("headers.discPercent", "Disc. %")}
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-500 whitespace-nowrap">
                      {dn("headers.taxPercent", "Tax %")}
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-500 whitespace-nowrap">
                      {dn("headers.lineTotal", "Line total")}
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                      {dn("headers.expenseAccount", "Expense Account")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {debitNote.items?.map((item, index) => {
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
                                debitNote.currency,
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
                            debitNote.currency,
                            f.lineTotal,
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {item.expenseAccount ? (
                            <div>
                              <div className="font-medium text-blue-600">
                                {item.expenseAccount.code || dn("list.na", "N/A")} -{" "}
                                {item.expenseAccount.accountName ||
                                  dn("detail.unknownAccount", "Unknown Account")}
                              </div>
                              <div className="text-xs text-gray-500">
                                {item.expenseAccount.accountType?.name ||
                                  item.expenseAccount.accountType?.accountHeader ||
                                  ""}
                              </div>
                            </div>
                          ) : debitNote.expenseAccount ? (
                            <div>
                              <div className="font-medium text-green-600">
                                {debitNote.expenseAccount.code || dn("list.na", "N/A")} -{" "}
                                {debitNote.expenseAccount.accountName ||
                                  dn("detail.mainAccount", "Main Account")}
                              </div>
                              <div className="text-xs text-gray-500">
                                {dn("detail.mainExpenseAccount", "Main expense account")}
                              </div>
                            </div>
                          ) : (
                            <div className="text-gray-500 italic">
                              {dn("detail.noAccountSpecified", "No account specified")}
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
            {dn("detail.statusTimeline", "Status Timeline & Updates")}
          </h2>

          <div className="flex flex-col gap-8 relative">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8 flex-1">
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
                        {translateDebitNoteStatus(t, status)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Status Update Section */}
          {getValidTransitions(debitNote.status)?.length > 0 && (
            <div className="border-t pt-6 mt-8">
              <h3 className="text-md font-medium text-gray-900 mb-4">
                {dn("actions.updateStatus", "Update Status")}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
                {/* Status Selection */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {dn("detail.newStatus", "New Status")}
                    </label>
                    <SearchableDropdown
                      value={selectedStatus}
                      onChange={handleStatusChange}
                      disabled={statusUpdating}
                      placeholder={dn("detail.currentStatus", "Current: {{status}}", {
                        status: translateDebitNoteStatus(t, debitNote.status),
                      })}
                      searchPlaceholder={dn(
                        "detail.searchStatus",
                        "Search status..."
                      )}
                      options={[
                        {
                          value: debitNote.status,
                          label: dn("detail.currentStatus", "Current: {{status}}", {
                            status: translateDebitNoteStatus(t, debitNote.status),
                          }),
                        },
                        ...getValidTransitions(debitNote.status).map(
                          (status) => ({
                            value: status,
                            label: translateDebitNoteStatus(t, status),
                          })
                        ),
                      ]}
                      searchKeys={["label"]}
                      renderOption={(option) => (
                        <div className="font-medium">{option.label}</div>
                      )}
                    />
                  </div>
                </div>

                {/* Document Upload */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {dn(
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
                            {dn("detail.uploadingProgress", "Uploading... {{progress}}%", {
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
                            {dn(
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
                            {dn("actions.chooseFile", "Choose File")}
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
                      selectedStatus === debitNote.status
                    }
                    className="w-full px-4 py-3 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[#9CBA33] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {statusUpdating
                      ? dn("actions.updating", "Updating...")
                      : dn("actions.updateTo", "Update to {{status}}", {
                          status: translateDebitNoteStatus(t, selectedStatus),
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
