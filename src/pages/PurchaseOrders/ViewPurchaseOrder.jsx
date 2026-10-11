import React, { useState, useEffect, useContext, useRef } from "react";
import { useHistory, useParams } from "react-router-dom";
import {
  ChevronLeft,
  Download,
  Mail,
  Calendar,
  Building2,
  Package,
  FileText,
  CheckCircle,
  Clock,
  TrendingUp,
  Receipt,
  MoreVertical,
  XCircle,
  Ban,
  Send,
} from "lucide-react";
import axios from "axios";
import { notifyError, notifySuccess } from "@/utils/toast";
import { AdminContext } from "@/context/AdminContext";
import PurchaseOrderServices from "@/services/PurchaseOrderServices";
import BackButton from "@/components/BackButton";
import { formatDate, formatAmount, formatCurrencyAmount } from "@/components/formatAmount";
import { formatInvoiceDownloadName } from "@/utils/generic";
import { enrichSavedRecordHtmlWithCustomFields } from "@/utils/customFieldsPdf";
import { fetchPdfPayload } from "@/services/customFieldServices";
import InvoiceRenderer from "@/pages/Accounts/CustomerInvoice/components/InvoiceRenderer";
import CustomerInvoiceServices from "@/services/CustomerInvoiceServices";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { getLineSubtotal } from "@/utils/itemDiscountUtils";
import {
  calculateOrderDiscountPercentage,
  resolveOrderLineItemAndDescription,
} from "@/utils/invoiceContractMapper";
import ModuleAccessGate from "@/components/ModuleAccessGate";
import {
  PERMISSION_ACTION,
  useModulePermissions,
} from "@/utils/permissionUtils";
import StockLocationPicker from "@/components/Inventory/StockLocationPicker";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

/** PO document date: API serializes `purchaseOrderDate` and omits `salesOrderDate`. */
function getPurchaseOrderDate(order) {
  return order?.purchaseOrderDate ?? order?.salesOrderDate;
}

/** Display name for purchase order vendor (stored in `customer` field). */
function getVendorDisplayLabel(vendor) {
  if (!vendor?.basicInformation) return "";
  const bi = vendor.basicInformation;
  return (
    bi.companyName ||
    bi.vendorDisplayName ||
    bi.customerDisplayName ||
    ""
  );
}

function computeSoLine(item = {}) {
  const quantity = parseFloat(item.quantity || item.ordered_quantity) || 0;
  const rate = parseFloat(item.rate) || 0;
  const discount = parseFloat(item.discount) || 0;
  const lineSubtotal = getLineSubtotal(quantity, rate, discount);
  const taxRate = parseFloat(item.taxRate) || 0;
  const taxAmount =
    taxRate > 0
      ? (lineSubtotal * taxRate) / 100
      : parseFloat(item.tax) || 0;
  const amount = Math.max(0, lineSubtotal + taxAmount);
  return { quantity, rate, discount, taxRate, taxAmount, lineSubtotal, amount };
}

function computeSoSummary(order = {}) {
  const items = order.items || [];
  const computedItems = items.map((item) => computeSoLine(item));
  const preTaxSubtotal = computedItems.reduce((sum, row) => sum + row.lineSubtotal, 0);
  const subtotal = computedItems.reduce((sum, row, index) => {
    const savedLineAmount = parseFloat(items[index]?.amount);
    return sum + (Number.isFinite(savedLineAmount) ? savedLineAmount : row.amount);
  }, 0);
  const taxTotal = computedItems.reduce((sum, row) => sum + row.taxAmount, 0);
  const discount = parseFloat(order.discount) || 0;
  const discountPercentage = calculateOrderDiscountPercentage(subtotal, discount);
  const shippingCharges = parseFloat(order.shippingCharges) || 0;
  const adjustment = parseFloat(order.adjustment) || 0;
  const total = Math.max(0, subtotal - discount + shippingCharges + adjustment);
  return {
    computedItems,
    subtotal,
    preTaxSubtotal,
    lineItemsSubtotal: subtotal,
    taxTotal,
    discount,
    discountPercentage,
    shippingCharges,
    adjustment,
    total,
  };
}

// PDF Viewer Iframe Component
const PdfViewerIframe = ({ pdfUrl, onError }) => {
  const timeoutRef = React.useRef(null);

  React.useEffect(() => {
    timeoutRef.current = setTimeout(() => {
      onError(new Error("PDF loading timeout"));
    }, 20000);
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [pdfUrl]);

  const handleLoad = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const handleError = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    onError(new Error("Failed to load PDF"));
  };

  return (
    <iframe
      src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
      title="Document PDF"
      width="100%"
      height="1000px"
      style={{ border: "none", minHeight: "800px" }}
      className="w-full"
      onLoad={handleLoad}
      onError={handleError}
    />
  );
};

// Status Badge Component
function formatPoStatusLabel(status) {
  if (!status) return "Draft";
  const s = String(status).toLowerCase();
  if (s === "confirmed" || s === "issued") return "Approved";
  if (s === "partially delivered") return "Partially Received";
  if (s === "delivered" || s === "received") return "Fully Received";
  // Legacy: billing lived on PO status — prefer receipt wording; Bill Status is separate
  if (s === "partially billed" || s === "partially invoiced") {
    return "Partially Received";
  }
  if (s === "fully billed" || s === "fully invoiced") return "Fully Received";
  return status;
}

function canonicalizePoStatus(status) {
  const s = String(status || "Draft");
  const map = {
    Confirmed: "Approved",
    Issued: "Approved",
    "Partially Delivered": "Partially Received",
    Delivered: "Fully Received",
    Received: "Fully Received",
    "Partially Billed": "Partially Received",
    "Fully Billed": "Fully Received",
    "Partially Invoiced": "Partially Received",
    "Fully Invoiced": "Fully Received",
  };
  return map[s] || s;
}

const GRN_STATUS_LABELS = {
  draft: "Draft",
  pending_inspection: "Pending Inspection",
  confirmed: "Confirmed",
  rejected: "Rejected",
  returned: "Returned",
  reversed: "Reversed",
};

function grnStatusLabel(status) {
  return GRN_STATUS_LABELS[String(status || "").toLowerCase()] || status || "—";
}

function grnStatusClass(status) {
  switch (String(status || "").toLowerCase()) {
    case "draft":
      return "bg-gray-100 text-gray-700";
    case "pending_inspection":
      return "bg-amber-100 text-amber-800";
    case "confirmed":
      return "bg-green-100 text-green-800";
    case "rejected":
      return "bg-red-100 text-red-700";
    case "returned":
      return "bg-orange-100 text-orange-800";
    case "reversed":
      return "bg-purple-100 text-purple-800";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function changeHistoryActionLabel(action) {
  const a = String(action || "").toLowerCase();
  if (a === "edit") return "Edited";
  if (a === "submit") return "Submitted";
  if (a === "approve") return "Approved";
  if (a === "reject") return "Rejected";
  if (a === "cancel") return "Cancelled";
  return action ? String(action) : "Update";
}

const StatusBadge = ({ status }) => {
  const getStatusColor = (statusRaw) => {
    const s = statusRaw?.toLowerCase() || "";
    switch (s) {
      case "draft":
        return "bg-gray-100 text-gray-700 border-gray-300";
      case "submitted":
        return "bg-amber-100 text-amber-800 border-amber-300";
      case "approved":
      case "issued":
      case "confirmed":
        return "bg-blue-100 text-blue-700 border-blue-300";
      case "partially received":
      case "partially delivered":
        return "bg-orange-100 text-orange-700 border-orange-300";
      case "fully received":
      case "received":
      case "delivered":
        return "bg-green-100 text-green-700 border-green-300";
      case "cancelled":
        return "bg-red-100 text-red-700 border-red-300";
      case "closed":
        return "bg-gray-200 text-gray-800 border-gray-400";
      default:
        return "bg-gray-100 text-gray-700 border-gray-300";
    }
  };

  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
        status
      )} border`}
    >
      {formatPoStatusLabel(status)}
    </span>
  );
};

// Receipt (goods) badge — Zoho-style
const FulfillmentBadge = ({ status }) => {
  const normalized = (status || "Not Received").toString().toLowerCase();
  const getColor = () => {
    if (normalized === "received" || normalized === "shipped")
      return "bg-green-100 text-green-700 border-green-300";
    if (normalized === "partially received" || normalized === "partially shipped")
      return "bg-orange-100 text-orange-700 border-orange-300";
    return "bg-gray-100 text-gray-700 border-gray-300";
  };

  const label =
    normalized === "shipped"
      ? "Received"
      : normalized === "not shipped"
        ? "Not Received"
        : normalized === "partially shipped"
          ? "Partially Received"
          : status || "Not Received";

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getColor()} border`}>
      {label}
    </span>
  );
};

export default function ViewPurchaseOrder() {
  const history = useHistory();
  const { id } = useParams();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const { canView, canViewDetails } = useModulePermissions("Purchase", "");
  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo.token}`,
  };

  const [salesOrder, setSalesOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [convertingToBill, setConvertingToBill] = useState(false);
  const [templateData, setTemplateData] = useState(null);
  const [invoiceData, setInvoiceData] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [tempSelectedTemplate, setTempSelectedTemplate] = useState(null);
  const [viewMode, setViewMode] = useState("preview"); // "preview" or "select"
  const invoiceRef = useRef(null);
  const invoiceContainerRef = useRef(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [orderPdfPayload, setOrderPdfPayload] = useState(null);

  const resolveEntityId = (raw) => {
    if (raw == null || raw === "") return "";
    if (typeof raw === "object") {
      return String(raw._id ?? raw.id ?? raw.$oid ?? "");
    }
    return String(raw);
  };

  useEffect(() => {
    const bid =
      resolveEntityId(salesOrder?.business_id) ||
      resolveEntityId(salesOrder?.business);
    const rid =
      resolveEntityId(salesOrder?._id) ||
      resolveEntityId(salesOrder?.id) ||
      String(id || "");
    if (!salesOrder || !bid || !rid) {
      setOrderPdfPayload(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const payload = await fetchPdfPayload(
          {
            businessId: bid,
            module: "purchase",
            screen: "purchase_order",
            recordId: rid,
          },
          headers,
        );
        if (!cancelled) setOrderPdfPayload(payload);
      } catch (e) {
        console.warn("Purchase order PDF payload (preview):", e);
        if (!cancelled) setOrderPdfPayload(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [salesOrder, id, adminInfo?.token]);

  // Fulfillment UI state
  const [showFulfillmentModal, setShowFulfillmentModal] = useState(false);
  const [fulfillmentDraft, setFulfillmentDraft] = useState([]); // [{ index, description, ordered, fulfilled, newFulfilled }]
  const [savingFulfillment, setSavingFulfillment] = useState(false);
  const [completingFulfillment, setCompletingFulfillment] = useState(false);
  const [showFulfillmentMenu, setShowFulfillmentMenu] = useState(false);
  const [showCompleteLocationModal, setShowCompleteLocationModal] =
    useState(false);
  const [stockWarehouseId, setStockWarehouseId] = useState("");
  const [stockLocationId, setStockLocationId] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectRemark, setRejectRemark] = useState("");
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const fulfillmentMenuRef = useRef(null);

  const orderBusinessId =
    (typeof salesOrder?.business === "object" && salesOrder?.business?._id) ||
    salesOrder?.business ||
    salesOrder?.business_id ||
    "";

  // PDF iframe state (when no template, show generated PDF)
  const [pdfUrl, setPdfUrl] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const documentUrlRef = useRef(null);

  const isFullyReceived = (() => {
    const fs = (salesOrder?.fulfillment_status || "").toString().toLowerCase();
    return fs === "received" || fs === "shipped";
  })();

  // Close fulfillment menu on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        showFulfillmentMenu &&
        fulfillmentMenuRef.current &&
        !fulfillmentMenuRef.current.contains(event.target)
      ) {
        setShowFulfillmentMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showFulfillmentMenu]);

  // Fetch signed PDF URL for purchase order document (when no template, show in iframe)
  const fetchSalesOrderPdfUrl = async (documentUrl, retryAttempt = 0) => {
    if (!documentUrl) return;
    documentUrlRef.current = documentUrl;
    setPdfLoading(true);
    setPdfError(null);
    setRetryCount(retryAttempt);
    const maxRetries = 3;
    const baseDelay = 1000;
    try {
      if (typeof documentUrl === "string" && (documentUrl.startsWith("http://") || documentUrl.startsWith("https://"))) {
        setPdfUrl(documentUrl);
        setPdfLoading(false);
        return;
      }
      const isObjectId = /^[a-f\d]{24}$/i.test(documentUrl);
      if (isObjectId) {
        const docRes = await axios.get(`${Base_URL}/documents/getFileWithAllData/${documentUrl}`, { headers });
        const url = docRes?.data?.data?.url || docRes?.data?.data?.downloadUrl;
        if (url) {
          setPdfUrl(url);
          setRetryCount(0);
        } else {
          throw new Error("No URL returned from document");
        }
      } else {
        const response = await CustomerInvoiceServices.getSignedInvoiceUrl(documentUrl);
        const url = response.data?.url || response.data?.data?.url || response.data?.data?.signedUrl;
        if (url) {
          setPdfUrl(url);
          setRetryCount(0);
        } else {
          throw new Error("No URL returned from server");
        }
      }
    } catch (error) {
      console.error(`Error fetching purchase order PDF URL (attempt ${retryAttempt + 1}):`, error);
      const isConnectionError = error.message?.includes("timeout") || error.message?.includes("Connection") || error.code === "ECONNRESET" || error.code === "ETIMEDOUT";
      if (isConnectionError && retryAttempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, retryAttempt);
        setTimeout(() => fetchSalesOrderPdfUrl(documentUrl, retryAttempt + 1), delay);
        return;
      }
      setPdfError(error.response?.data?.message || error.message || "Failed to load document PDF");
    } finally {
      if (retryAttempt === 0 || retryAttempt >= maxRetries) {
        setPdfLoading(false);
      }
    }
  };

  const handleRetryPdfLoad = () => {
    if (documentUrlRef.current) {
      fetchSalesOrderPdfUrl(documentUrlRef.current, 0);
    }
  };

  useEffect(() => {
    const fetchSalesOrder = async () => {
      if (!id) {
        setLoading(false);
        return;
      }

      if (!adminInfo?.token) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await PurchaseOrderServices.getSalesOrderById(id, headers);
        if (response.data.success) {
          const orderData = response.data.data;
          setSalesOrder(orderData);

          // Ensure we have populated business + customer objects for template rendering (logo/name/etc.)
          // This is critical for InvoiceRenderer to display business logo and info correctly
          let businessObj = orderData.business;
          try {
            // Get business ID - handle both string ID and populated object
            let businessId = null;
            if (typeof businessObj === "string") {
              businessId = businessObj;
            } else if (businessObj?._id) {
              businessId = businessObj._id;
            } else {
              businessId = orderData.business_id || orderData.business;
            }
            
            // Always fetch business to ensure we have all fields (image, email, tel, address, etc.)
            // Even if business is already an object, fetch to ensure we have complete data
            if (businessId) {
              const bRes = await axios.get(`${Base_URL}/business/${businessId}`, {
                headers,
              });
              // Handle both response formats: { data: { data: {...} } } or { data: {...} }
              const fetchedBusiness = bRes?.data?.data || bRes?.data;
              if (fetchedBusiness && typeof fetchedBusiness === "object") {
                businessObj = fetchedBusiness;
              }
            }
            
            // Ensure business object has the structure InvoiceRenderer expects
            if (businessObj && typeof businessObj === "object") {
              // InvoiceRenderer looks for: business.image, business.logo, business.email, business.tel, business.phone
              // Make sure all required fields exist
              if (!businessObj.image && !businessObj.logo) {
                // Try to get from nested structure if exists
                businessObj.image = businessObj.image || businessObj.logo || businessObj.businessLogo || "";
              }
              // Ensure email exists (InvoiceRenderer checks business.email)
              if (!businessObj.email) {
                businessObj.email = businessObj.businessEmail || "";
              }
              // Ensure phone/tel exists (InvoiceRenderer checks both business.tel and business.phone)
              if (!businessObj.tel && !businessObj.phone) {
                const phoneValue = businessObj.businessPhone || "";
                businessObj.tel = phoneValue;
                businessObj.phone = phoneValue;
              } else if (!businessObj.tel) {
                businessObj.tel = businessObj.phone || businessObj.businessPhone || "";
              } else if (!businessObj.phone) {
                businessObj.phone = businessObj.tel || businessObj.businessPhone || "";
              }
              
            }
          } catch (e) {
            console.error("ViewPurchaseOrder: failed to fetch business for renderer", e);
            // Set empty object to prevent errors, but log the issue
            businessObj = businessObj || {};
          }

          let customerObj = orderData.customer;
          try {
            if (!customerObj || typeof customerObj === "string") {
              const vendorId = customerObj || orderData.customer_id || orderData.customer;
              if (vendorId) {
                const vRes = await axios.get(`${Base_URL}/vendors/${vendorId}`, {
                  headers,
                });
                customerObj = vRes?.data?.data || vRes?.data || customerObj;
              }
            }
          } catch (e) {
            console.warn("ViewPurchaseOrder: failed to fetch vendor for renderer", e);
            customerObj = customerObj || {};
          }

          // Resolve salesperson ID -> readable name for invoice templates.
          const rawSalesperson =
            orderData?.salesperson ??
            orderData?.salesPerson ??
            orderData?.salesPersonName ??
            "";
          const rawSalespersonId =
            typeof rawSalesperson === "string"
              ? rawSalesperson
              : rawSalesperson?._id || "";
          let resolvedSalespersonName =
            (typeof rawSalesperson === "object" &&
              (rawSalesperson?.name || rawSalesperson?.displayName)) ||
            orderData?.salesPersonName ||
            "";

          if (
            !resolvedSalespersonName &&
            typeof rawSalespersonId === "string" &&
            /^[a-f\d]{24}$/i.test(rawSalespersonId)
          ) {
            try {
              const businessId =
                (typeof orderData?.business === "object" && orderData?.business?._id) ||
                (typeof orderData?.business === "string" && orderData?.business) ||
                orderData?.business_id ||
                "";

              if (businessId) {
                const salespersonRes = await PurchaseOrderServices.getSalespersons(
                  businessId,
                  headers
                );
                const salespersons = salespersonRes?.data?.data || [];
                const matchedSalesperson = salespersons.find(
                  (person) => person?._id === rawSalespersonId
                );
                resolvedSalespersonName =
                  matchedSalesperson?.name || matchedSalesperson?.displayName || "";
              }
            } catch (e) {
              console.warn("ViewPurchaseOrder: failed to resolve salesperson name", e);
            }
          }

          const summary = computeSoSummary(orderData);

          // Convert purchase order to invoice format for rendering
          // Structure must match exactly what CustomerInvoiceViewer passes to InvoiceRenderer
          // const soInvoiceType =
          //   orderData?.invoiceType === "Proforma" ? "Proforma" : "Commercial";

             const soInvoiceType = orderData.invoiceType || "Commercial";
      const desiredType = soInvoiceType === "Proforma" ? "Proforma Invoice" : "Commercial Invoice";

          const convertedInvoiceData = {
            ...orderData,
            // Mark as coming from Purchase Orders so InvoiceRenderer (UnifiedInvoice)
            // can apply sales-order specific handling and use raw items.
            location: "purchase-orders",
            // Invoice number fields (InvoiceRenderer checks multiple)
            invoice_number: orderData.purchaseOrderNumber,
            invoiceNumber: orderData.purchaseOrderNumber,
            ref: orderData.purchaseOrderNumber,
            number: orderData.purchaseOrderNumber,
            // Invoice type for template filtering/rendering parity with Customer Invoice view.
            invoiceType: soInvoiceType,
            // Date fields (InvoiceRenderer checks multiple formats)
            invoice_date: getPurchaseOrderDate(orderData),
            invoiceDate: getPurchaseOrderDate(orderData),
            date: getPurchaseOrderDate(orderData),
            due_date: orderData.expectedShipmentDate,
            dueDate: orderData.expectedShipmentDate,
            due_date_value: orderData.expectedShipmentDate,
            // Customer fields - must be populated objects, not just IDs
            customer_id: customerObj,
            customer: customerObj, // InvoiceRenderer also checks this
            customer_name: customerObj?.basicInformation?.companyName || 
                          customerObj?.basicInformation?.vendorDisplayName || 
                          customerObj?.basicInformation?.customerDisplayName || 
                          orderData.customer_name ||
                          "Vendor",
            customer_company: customerObj?.companyInfo?.companyName || customerObj?.basicInformation?.companyName,
            customer_address: orderData.billingAddress || customerObj?.companyInfo?.billingAddress,
            customerPhone:
              customerObj?.basicInformation?.vendorPhone?.mobile ||
              customerObj?.basicInformation?.vendorPhone?.workPhone ||
              customerObj?.basicInformation?.customerPhone?.mobile ||
              customerObj?.companyInfo?.phone,
            customerEmail:
              customerObj?.basicInformation?.vendorEmail ||
              customerObj?.basicInformation?.customerEmail,
            // Business fields - must be populated object with image/logo, name, address, etc.
            // InvoiceRenderer checks: invoice.business_id.image, invoice.business.image, invoice.businessLogo
            business_id: businessObj,
            business: businessObj, // InvoiceRenderer also checks this
            // Direct fields for InvoiceRenderer fallback
            businessName: businessObj?.name || businessObj?.businessName || "",
            businessLogo: businessObj?.image || businessObj?.logo || businessObj?.businessLogo || "",
            businessAddress: businessObj?.address || businessObj?.businessAddress || "",
            businessPhone: businessObj?.phone || businessObj?.tel || businessObj?.businessPhone || "",
            businessEmail: businessObj?.email || businessObj?.businessEmail || "",
            // Items — catalog itemName + free-text description (both persist on the line)
            items: (orderData.items || []).map((item, index) => {
              const computed = computeSoLine(item);
              const { itemName: resolvedName, description: resolvedDesc } =
                resolveOrderLineItemAndDescription(item, index);

              return {
                itemId: item?.itemId,
                // What InvoiceRenderer/templates read (name vs description — do not merge into one field)
                item: resolvedName,
                name: resolvedName,
                title: resolvedName,
                itemName: resolvedName,
                description: resolvedDesc,
                goods_description: resolvedDesc,
                // Numeric fields
                quantity: computed.quantity,
                qty: computed.quantity,
                rate: computed.rate,
                unitPrice: computed.rate,
                price: computed.rate,
                tax: computed.taxAmount,
                taxAmount: computed.taxAmount,
                taxRate: computed.taxRate,
                taxName: item?.taxName || "",
                discount: computed.discount,
                discountAmount: computed.discount,
                amount: computed.amount,
                total: computed.amount,
                totalValue: computed.amount,
              };
            }),
            // Totals - InvoiceRenderer checks multiple field names
            subTotal: summary.lineItemsSubtotal,
            subtotal: summary.lineItemsSubtotal,
            discount: summary.discount,
            discountAmount: summary.discount,
            discountPercentage: summary.discountPercentage,
            shippingCharges: summary.shippingCharges,
            shipping: summary.shippingCharges,
            taxTotal: summary.taxTotal,
            tax: summary.taxTotal,
            adjustment: summary.adjustment,
            grandTotal: summary.total,
            total: summary.total,
            currency: orderData.currency || orderData.customerCurrency || "USD",
            // Salesperson fields for invoice template rendering
            salesPerson:
              resolvedSalespersonName ||
              (typeof orderData?.salesperson === "string" ? "" : orderData?.salesperson?.name) ||
              (typeof orderData?.salesperson === "string"
                ? ""
                : orderData?.salesperson?.displayName) ||
              (typeof orderData?.salesPerson === "string" ? "" : orderData?.salesPerson?.name) ||
              (typeof orderData?.salesPerson === "string"
                ? ""
                : orderData?.salesPerson?.displayName) ||
              orderData?.salesPersonName ||
              "",
            sales_person:
              resolvedSalespersonName ||
              (typeof orderData?.salesperson === "string" ? "" : orderData?.salesperson?.name) ||
              (typeof orderData?.salesperson === "string"
                ? ""
                : orderData?.salesperson?.displayName) ||
              (typeof orderData?.salesPerson === "string" ? "" : orderData?.salesPerson?.name) ||
              (typeof orderData?.salesPerson === "string"
                ? ""
                : orderData?.salesPerson?.displayName) ||
              orderData?.salesPersonName ||
              "",
            salesperson:
              resolvedSalespersonName ||
              (typeof orderData?.salesperson === "string" ? "" : orderData?.salesperson?.name) ||
              (typeof orderData?.salesperson === "string"
                ? ""
                : orderData?.salesperson?.displayName) ||
              (typeof orderData?.salesPerson === "string" ? "" : orderData?.salesPerson?.name) ||
              (typeof orderData?.salesPerson === "string"
                ? ""
                : orderData?.salesPerson?.displayName) ||
              orderData?.salesPersonName ||
              "",
            // Terms and addresses
            terms: orderData.paymentTerms,
            billingAddress: orderData.billingAddress,
            shippingAddress: orderData.shippingAddress || orderData.billingAddress,
            customerNotes: orderData.customerNotes,
            termsAndConditions: orderData.termsAndConditions ?? "",
          };
          
          setInvoiceData(convertedInvoiceData);
          
          // Fetch template - try to get from documentUrl if it exists, otherwise fetch default Proforma template
          let templateId = null;
          if (orderData.documentUrl) {
            // Try to get template from document
            try {
              const docResponse = await axios.get(
                `${Base_URL}/documents/getFileWithAllData/${orderData.documentUrl}`,
                { headers }
              );
              // If document has template info, use it
              if (docResponse.data?.data?.templateId) {
                templateId = docResponse.data.data.templateId;
              }
            } catch (err) {
              console.log("Could not get template from document, using default");
            }
          }
          
          // Fetch templates assigned to this business - only active ones (matches CustomerInvoiceViewer)
          const businessId =
            (typeof orderData?.business === "object" && orderData?.business?._id) ||
            (typeof orderData?.business === "string" && orderData?.business) ||
            orderData?.business_id ||
            "";


          let filteredTemplates = [];
          if (businessId) {
            try {
              const businessTemplatesRes = await axios.get(
                `${Base_URL}/business-templates/${businessId}`,
                { headers }
              );
              const assignments = businessTemplatesRes?.data?.data || [];
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
                ) {
                  return true;
                }
                return false;
              });
              filteredTemplates = activeAssignments
                .map((item) => item.templateId)
                .filter((t) => t != null);
            } catch (err) {
              console.warn("Error fetching business templates:", err);
            }
          }

          // Fallback: document-templates if no business or no assignments
          if (filteredTemplates.length === 0) {
            try {
              const templatesResponse = await axios.get(`${Base_URL}/document-templates`, { headers });
              const allTemplates = templatesResponse.data?.data || templatesResponse.data || [];
              filteredTemplates = allTemplates.filter((tmp) => {
                const templateType = (tmp.type || "").toLowerCase();
                if (templateType === "invoice") return true;
                if (soInvoiceType === "Proforma") return templateType === "proforma invoice";
                return templateType === "commercial invoice";
              });
            } catch (err) {
              console.warn("Error fetching document templates:", err);
            }
          }

          const uniqueTemplates = [];
          const seenTemplateIds = new Set();
          filteredTemplates.forEach((template) => {
            let templateId = template?._id || template?.id;
            templateId =
              templateId && typeof templateId === "object" && templateId.toString
                ? templateId.toString()
                : String(templateId || "");
            if (
              templateId &&
              templateId !== "undefined" &&
              templateId !== "null" &&
              !seenTemplateIds.has(templateId)
            ) {
              seenTemplateIds.add(templateId);
              uniqueTemplates.push(template);
            }
          });

          setTemplates(uniqueTemplates);

          const isTemplateIdActive = uniqueTemplates.some(
            (t) => String(t._id || t.id) === String(templateId)
          );

          try {
            if (templateId && isTemplateIdActive) {
              const templateResponse = await axios.get(
                `${Base_URL}/document-templates/${templateId}`,
                { headers }
              );
              const template = templateResponse.data?.data || templateResponse.data;
              setTemplateData(template);
              setSelectedTemplate(templateId);
              setTempSelectedTemplate(templateId);
            } else if (uniqueTemplates.length > 0) {
              const firstTemplate = uniqueTemplates[0];
              const tid = firstTemplate._id || firstTemplate.id;
              setSelectedTemplate(tid);
              setTempSelectedTemplate(tid);
              if (firstTemplate._id && !firstTemplate.htmlContent) {
                try {
                  const fullTemplateResponse = await axios.get(
                    `${Base_URL}/document-templates/${firstTemplate._id}`,
                    { headers }
                  );
                  setTemplateData(fullTemplateResponse.data?.data || fullTemplateResponse.data);
                } catch (e) {
                  console.warn("Failed to fetch full template, using partial:", e);
                  setTemplateData(firstTemplate);
                }
              } else {
                setTemplateData(firstTemplate);
              }
            } else {
              setTemplateData(null);
              setSelectedTemplate(null);
              setTempSelectedTemplate(null);
            }
          } catch (templateError) {
            console.error("Error fetching templates:", templateError);
          }

          // When documentUrl exists, fetch PDF URL (used when no template - show in iframe)
          if (orderData.documentUrl) {
            fetchSalesOrderPdfUrl(orderData.documentUrl);
          }
        } else {
          notifyError(response.data.message || "Failed to fetch purchase order");
          history.push("/purchase-orders");
        }
      } catch (error) {
        console.error("Error fetching purchase order:", error);
        notifyError(error.response?.data?.message || "Failed to fetch purchase order");
        history.push("/purchase-orders");
      } finally {
        setLoading(false);
      }
    };

    fetchSalesOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleBack = () => {
    history.push("/purchase-orders");
  };

  const handleChangeTemplate = () => {
    setViewMode("select");
    setTempSelectedTemplate(selectedTemplate);
  };

  const handleTempTemplateSelect = (templateId) => {
    setTempSelectedTemplate(templateId);
  };

  const handleConfirmTemplateSelection = async () => {
    try {
      setSelectedTemplate(tempSelectedTemplate);
      setViewMode("preview");
      const templateResponse = await axios.get(
        `${Base_URL}/document-templates/${tempSelectedTemplate}`,
        { headers }
      );
      const template = templateResponse.data?.data || templateResponse.data;
      setTemplateData(template);
      notifySuccess("Template updated. Download PDF to use the new template.");
    } catch (err) {
      console.error("Error updating template:", err);
      notifyError("Failed to update template.");
    }
  };

  // PDF from off-screen clone — same logic as CustomerInvoiceViewer (html2canvas + jsPDF, no server call).
  const handleDownloadPDF = async () => {
    // No template but we have generated PDF - download from signed URL
    if (!templateData && pdfUrl) {
      setIsGeneratingPdf(true);
      try {
        const response = await fetch(pdfUrl, { credentials: "include", mode: "cors" });
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = formatInvoiceDownloadName(salesOrder?.purchaseOrderNumber || "Purchase-Order");
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        notifySuccess("PDF downloaded successfully!");
      } catch (error) {
        console.error("Error downloading PDF:", error);
        notifyError("Failed to download PDF");
      } finally {
        setIsGeneratingPdf(false);
      }
      return;
    }
    const root = invoiceRef.current;
    if (!root) {
      notifyError("Could not find purchase order content to download.");
      return;
    }
    setIsGeneratingPdf(true);
    const PAGE_PT_WIDTH = 595;
    const PAGE_PT_HEIGHT = 800;
    const CAPTURE_PX_WIDTH = 894;
    const base = (Base_URL || "").replace(/\/$/, "");
    let wrap = null;

    try {
      const clone = root.cloneNode(true);
      wrap = document.createElement("div");
      wrap.style.cssText = "position:fixed;left:-9999px;top:0;width:" + CAPTURE_PX_WIDTH + "px;max-width:" + CAPTURE_PX_WIDTH + "px;background:#fff;";
      wrap.appendChild(clone);
      const cloneInner = clone.querySelector(".invoice-container") || clone;
      cloneInner.style.width = CAPTURE_PX_WIDTH + "px";
      cloneInner.style.maxWidth = CAPTURE_PX_WIDTH + "px";
      document.body.appendChild(wrap);
      await new Promise((r) => requestAnimationFrame(r));
      await new Promise((r) => setTimeout(r, 200));

      const invEl = clone.querySelector(".invoice-container");
      const bid =
        salesOrder?.business &&
        typeof salesOrder.business === "object"
          ? salesOrder.business._id
          : salesOrder?.business;
      if (invEl && bid && salesOrder?._id) {
        try {
          invEl.innerHTML = await enrichSavedRecordHtmlWithCustomFields(
            invEl.innerHTML,
            {
              businessId: bid,
              module: "purchase",
              screen: "purchase_order",
              recordId: salesOrder._id,
              headers,
            }
          );
        } catch (cfErr) {
          console.warn("Purchase order PDF custom fields:", cfErr);
        }
      }

      const imgs = clone.querySelectorAll("img[src]");
      const imageRestore = [];
      await Promise.all(
        Array.from(imgs).map((img) => {
          const originalSrc = (img.getAttribute("src") || "").trim();
          if (!originalSrc || originalSrc.startsWith("data:")) return Promise.resolve();
          const isHttp = originalSrc.startsWith("http://") || originalSrc.startsWith("https://");
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
        })
      );

      await Promise.all(
        imageRestore.map((img) =>
          (img.decode ? img.decode() : new Promise((r) => { img.onload = r; img.onerror = r; })).catch(() => {})
        )
      );

      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      document.body.removeChild(wrap);

      const imgData = canvas.toDataURL("image/jpeg", 0.92);
      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
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
        while (heightLeft > 0) {
          pdf.addPage("a4", "portrait");
          pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight - marginBottom;
          position -= pageHeight;
        }
      }

      const fullFileName = formatInvoiceDownloadName(salesOrder?.purchaseOrderNumber || "Purchase-Order");
      const pdfBlob = pdf.output("blob");

      const link = document.createElement("a");
      link.href = URL.createObjectURL(pdfBlob);
      link.download = fullFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      notifySuccess("PDF downloaded successfully!");
    } catch (error) {
      if (wrap?.parentNode) try { document.body.removeChild(wrap); } catch (_) {}
      console.error("Error generating PDF:", error);
      notifyError("Failed to generate PDF. Please try again.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const refreshPurchaseOrder = async () => {
    const updatedResponse = await PurchaseOrderServices.getSalesOrderById(
      id,
      headers,
    );
    if (updatedResponse.data.success) {
      setSalesOrder(updatedResponse.data.data);
    }
  };

  const poStatus = canonicalizePoStatus(salesOrder?.status);
  const canSubmit = poStatus === "Draft";
  const canApproveOrReject = poStatus === "Submitted";
  const canCancel = ["Draft", "Submitted", "Approved"].includes(poStatus);
  const canReceive = ["Approved", "Partially Received"].includes(poStatus);
  const canConvertToBill = [
    "Approved",
    "Partially Received",
    "Fully Received",
  ].includes(poStatus);

  const linkedGrns = Array.isArray(salesOrder?.linkedGrnIds)
    ? salesOrder.linkedGrnIds.filter((g) => g && typeof g === "object" && g._id)
    : [];
  const changeHistory = Array.isArray(salesOrder?.changeHistory)
    ? [...salesOrder.changeHistory].sort(
        (a, b) => new Date(b.at || 0) - new Date(a.at || 0),
      )
    : [];

  const handleSubmitForApproval = async () => {
    if (!canSubmit) return;
    setUpdatingStatus(true);
    try {
      const response = await PurchaseOrderServices.submitPurchaseOrder(
        id,
        headers,
      );
      if (response.data.success) {
        notifySuccess(response.data.message || "Submitted for approval");
        await refreshPurchaseOrder();
      } else {
        notifyError(response.data.message || "Failed to submit");
      }
    } catch (error) {
      notifyError(error.response?.data?.message || "Failed to submit");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleApprove = async () => {
    if (!canApproveOrReject) return;
    setUpdatingStatus(true);
    try {
      const response = await PurchaseOrderServices.approvePurchaseOrder(
        id,
        headers,
      );
      if (response.data.success) {
        notifySuccess(response.data.message || "Purchase order approved");
        await refreshPurchaseOrder();
      } else {
        notifyError(response.data.message || "Failed to approve");
      }
    } catch (error) {
      notifyError(error.response?.data?.message || "Failed to approve");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectRemark.trim()) {
      notifyError("Rejection remark is required");
      return;
    }
    setUpdatingStatus(true);
    try {
      const response = await PurchaseOrderServices.rejectPurchaseOrder(
        id,
        rejectRemark.trim(),
        headers,
      );
      if (response.data.success) {
        notifySuccess(response.data.message || "Purchase order rejected");
        setShowRejectModal(false);
        setRejectRemark("");
        await refreshPurchaseOrder();
      } else {
        notifyError(response.data.message || "Failed to reject");
      }
    } catch (error) {
      notifyError(error.response?.data?.message || "Failed to reject");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleCancelConfirm = async () => {
    setUpdatingStatus(true);
    try {
      const response = await PurchaseOrderServices.cancelPurchaseOrder(
        id,
        cancelReason.trim(),
        headers,
      );
      if (response.data.success) {
        notifySuccess(response.data.message || "Purchase order cancelled");
        setShowCancelModal(false);
        setCancelReason("");
        await refreshPurchaseOrder();
      } else {
        notifyError(response.data.message || "Failed to cancel");
      }
    } catch (error) {
      notifyError(error.response?.data?.message || "Failed to cancel");
    } finally {
      setUpdatingStatus(false);
    }
  };

  /** Open vendor bill (AP) with lines prefilled from PO */
  const handleConvertToBill = async () => {
    if (!salesOrder) return;

    setConvertingToBill(true);
    try {
      const response = await PurchaseOrderServices.convertToBill(id, headers);
      if (response.data.success) {
        if (response.data.data?.wasDraft) {
          notifySuccess(
            "Opening vendor bill…"
          );
        }
        const updatedResponse = await PurchaseOrderServices.getSalesOrderById(id, headers);
        if (updatedResponse.data.success) {
          setSalesOrder(updatedResponse.data.data);
        }
        history.push({
          pathname: "/create-vendor-invoice",
          search: `?purchaseOrderId=${encodeURIComponent(id)}`,
          state: { purchaseOrderBillPrefill: response.data.data },
        });
      } else {
        notifyError(response.data.message || "Could not prepare vendor bill");
      }
    } catch (error) {
      console.error("Error converting to bill:", error);
      notifyError(error.response?.data?.message || "Failed to convert to bill");
    } finally {
      setConvertingToBill(false);
    }
  };

  const openFulfillmentModal = () => {
    const draft = (salesOrder?.items || []).map((it, idx) => {
      const ordered =
        typeof it.ordered_quantity === "number"
          ? it.ordered_quantity
          : typeof it.quantity === "number"
          ? it.quantity
          : 0;
      const fulfilled = typeof it.fulfilled_quantity === "number" ? it.fulfilled_quantity : 0;
      return {
        index: idx,
        description: it.description,
        ordered,
        fulfilled,
        newFulfilled: fulfilled,
      };
    });
    const whId =
      salesOrder?.warehouse?._id || salesOrder?.warehouse || stockWarehouseId || "";
    if (whId) setStockWarehouseId(String(whId));
    setFulfillmentDraft(draft);
    setShowFulfillmentModal(true);
  };

  const handleSaveFulfillment = async () => {
    if (!stockLocationId) {
      notifyError("Select a warehouse location to receive stock into");
      return;
    }
    try {
      setSavingFulfillment(true);
      const payload = {
        locationId: stockLocationId,
        warehouseId: stockWarehouseId || undefined,
        items: fulfillmentDraft.map((row) => ({
          index: row.index,
          fulfilled_quantity: Number(row.newFulfilled) || 0,
        })),
      };

      const res = await PurchaseOrderServices.updateFulfillment(id, payload, headers);
      if (res.data?.success) {
        notifySuccess(res.data.message || "Receipt updated — stock increased");
        setSalesOrder(res.data.data);
        setShowFulfillmentModal(false);
      } else {
        notifyError(res.data?.message || "Failed to update fulfillment");
      }
    } catch (error) {
      console.error("Error updating fulfillment:", error);
      notifyError(error.response?.data?.message || "Failed to update fulfillment");
    } finally {
      setSavingFulfillment(false);
    }
  };

  const openCompleteLocationModal = () => {
    setShowCompleteLocationModal(true);
  };

  const handleCompleteFulfillment = async () => {
    if (!stockLocationId) {
      notifyError("Select a warehouse location to receive stock into");
      return;
    }
    try {
      setCompletingFulfillment(true);
      const res = await PurchaseOrderServices.completeFulfillment(
        id,
        {
          locationId: stockLocationId,
          warehouseId: stockWarehouseId || undefined,
        },
        headers,
      );
      if (res.data?.success) {
        notifySuccess(res.data.message || "Marked as fully received — stock increased");
        setSalesOrder(res.data.data);
        setShowCompleteLocationModal(false);
      } else {
        notifyError(res.data?.message || "Failed to complete fulfillment");
      }
    } catch (error) {
      console.error("Error completing fulfillment:", error);
      notifyError(error.response?.data?.message || "Failed to complete fulfillment");
    } finally {
      setCompletingFulfillment(false);
    }
  };

  if (!canView && !canViewDetails) {
    return (
      <ModuleAccessGate
        moduleName="Purchase"
        subModuleName=""
        title="Purchase Orders"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <div className="hidden" aria-hidden />
      </ModuleAccessGate>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="w-14 h-14 border-4 border-t-4 border-gray-200 border-t-[var(--p-blue)] rounded-full animate-spin mb-4"></div>
        {/* <p className="text-gray-600 text-sm font-medium">Loading purchase order...</p> */}
      </div>
    );
  }

  if (!salesOrder) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Purchase Order not found</div>
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
            Back
          </button>
        </div>
        <div className="container mx-auto">
          <h1 className="text-2xl font-bold mb-8 text-gray-800">
            Change {invoiceData?.invoiceType === "Proforma" ? "Proforma Invoice" : "Commercial Invoice"} Template
          </h1>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => (
              <div
                key={template._id}
                className={`relative bg-white rounded-xl border-2 ${
                  tempSelectedTemplate === template._id
                    ? "border-[var(--p-blue)] ring-2 ring-[var(--p-blue)]"
                    : "border-gray-200 hover:border-gray-300"
                } shadow-sm overflow-hidden hover:shadow-lg transition-all duration-200 cursor-pointer`}
                onClick={() => handleTempTemplateSelect(template._id)}
              >
                <div className="h-80 p-3 bg-gray-50 overflow-hidden border-b border-gray-200">
                  <div className="w-full h-full overflow-auto bg-white shadow-inner scale-75 origin-top transform">
                    <InvoiceRenderer
                      invoice={invoiceData}
                      template={template}
                      previewMode={true}
                      pdfPayload={orderPdfPayload}
                    />
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-800 text-lg">
                    {template.name || "Template Name"}
                  </h3>
                  <p className="text-gray-500 text-sm mt-1">
                    {template.description || template.type || "No description"}
                  </p>
                </div>
                {tempSelectedTemplate === template._id && (
                  <div className="absolute top-3 right-3 bg-[var(--p-blue)] text-white rounded-full p-1.5 shadow-md">
                    <CheckCircle size={20} />
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-8 flex justify-end">
            <button
              className="px-6 py-2.5 bg-gray-200 text-gray-800 rounded-md mr-4 hover:bg-gray-300 transition-colors font-medium"
              onClick={() => setViewMode("preview")}
            >
              Cancel
            </button>
            <button
              className="px-6 py-2.5 bg-[var(--p-blue)] text-white rounded-md hover:bg-[var(--p-blue-dark)] transition-colors font-medium shadow-sm"
              onClick={handleConfirmTemplateSelection}
            >
              Apply Template
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Enhanced Header - Zoho Style */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="container mx-auto px-6 py-3">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={handleBack}
              className="flex items-center text-gray-600 hover:text-gray-900 transition-colors group"
            >
              <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
              <span className="ml-1 text-sm font-medium">Back</span>
            </button>
          </div>

          {/* Purchase Order Header Section */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-gray-900">
                  {salesOrder?.purchaseOrderNumber || "---"}
                </h1>
                <StatusBadge status={salesOrder?.status} />
                <FulfillmentBadge status={salesOrder?.fulfillment_status} />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              {canSubmit && (
                <button
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm transition-all font-medium"
                  onClick={handleSubmitForApproval}
                  disabled={updatingStatus}
                >
                  <Send size={18} className="mr-2" />
                  {updatingStatus ? "Submitting..." : "Submit for Approval"}
                </button>
              )}

              {canApproveOrReject && (
                <>
                  <button
                    className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-sm transition-all font-medium"
                    onClick={handleApprove}
                    disabled={updatingStatus}
                  >
                    <CheckCircle size={18} className="mr-2" />
                    {updatingStatus ? "Updating..." : "Approve"}
                  </button>
                  <button
                    className="flex items-center px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 shadow-sm transition-all font-medium"
                    onClick={() => setShowRejectModal(true)}
                    disabled={updatingStatus}
                  >
                    <XCircle size={18} className="mr-2" />
                    Reject
                  </button>
                </>
              )}

              {canCancel && (
                <button
                  className="flex items-center px-4 py-2 bg-white text-red-600 border border-red-300 rounded-lg hover:bg-red-50 shadow-sm transition-all font-medium"
                  onClick={() => setShowCancelModal(true)}
                  disabled={updatingStatus}
                >
                  <Ban size={18} className="mr-2" />
                  Cancel PO
                </button>
              )}

              {canConvertToBill && (
                <button
                  className="flex items-center px-4 py-2 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[var(--p-blue-dark)] shadow-sm transition-all font-medium"
                  onClick={handleConvertToBill}
                  disabled={convertingToBill}
                >
                  <Receipt size={18} className="mr-2" />
                  {convertingToBill ? "Loading..." : "Convert to bill"}
                </button>
              )}

              <button
                className="flex items-center px-3 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all"
                title="Download PDF"
                onClick={handleDownloadPDF}
                disabled={isGeneratingPdf}
              >
                <Download size={18} className="mr-2" />
                <span className="hidden sm:inline">{isGeneratingPdf ? "Generating..." : "Download"}</span>
              </button>

              {templates.length > 0 && (
                <button
                  className="flex items-center px-3 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all"
                  title="Change PDF Template"
                  onClick={handleChangeTemplate}
                >
                  <FileText size={18} className="mr-2" />
                  <span className="hidden sm:inline">Change Template</span>
                </button>
              )}

              {/* Create GRN instead of direct PO receive */}
              {canReceive && (
                <button
                  type="button"
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-sm transition-all font-medium"
                  onClick={() =>
                    history.push({
                      pathname: "/goods-receipts/create",
                      state: { purchaseOrderId: id },
                    })
                  }
                  title="Create Goods Receipt Note to receive stock"
                >
                  <Package size={18} className="mr-2" />
                  Create GRN
                </button>
              )}

              <button
                type="button"
                className="flex items-center px-3 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all"
                title="Send Email"
                onClick={() => {
                  history.push({
                    pathname: "/purchase-order-email-preview",
                    state: {
                      salesOrderData: {
                        ...salesOrder,
                        customer_email:
                          salesOrder?.customer?.basicInformation?.vendorEmail ||
                          salesOrder?.customer?.basicInformation?.customerEmail ||
                          "",
                        customer_phone:
                          salesOrder?.customer?.basicInformation?.vendorPhone?.mobile ||
                          salesOrder?.customer?.basicInformation?.vendorPhone?.workPhone ||
                          salesOrder?.customer?.basicInformation?.customerPhone?.mobile ||
                          salesOrder?.customer?.basicInformation?.customerPhone?.workPhone ||
                          salesOrder?.phone ||
                          "",
                        customer_name:
                          getVendorDisplayLabel(salesOrder?.customer) || "Vendor",
                        templateId: salesOrder?.templateId || selectedTemplate,
                      },
                      isUpdate: true,
                      salesOrderId: salesOrder._id,
                      templateData:
                        templateData ||
                        templates.find((t) => t._id === selectedTemplate),
                      businessData:
                        invoiceData?.business ||
                        invoiceData?.business_id ||
                        salesOrder?.business,
                    },
                  });
                }}
              >
                <Mail size={18} className="mr-2" />
                <span className="hidden sm:inline">Send Email</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Purchase Order Summary - Zoho Style */}
      <div className="container mx-auto px-0 py-0">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold mb-6 text-gray-900 flex items-center">
            <TrendingUp size={20} className="mr-2 text-gray-600" />
            Financial Summary
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Purchase Order Total */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-5 border border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
                  Total Amount
                </h4>
                <FileText size={16} className="text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrencyAmount(
                  salesOrder?.currency,
                  computeSoSummary(salesOrder || {}).total,
                )}
              </p>
            </div>

            {/* Subtotal */}
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-5 border border-green-200">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-green-700 uppercase tracking-wide">
                  Subtotal
                </h4>
                <CheckCircle size={16} className="text-green-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrencyAmount(
                  salesOrder?.currency,
                  computeSoSummary(salesOrder || {}).lineItemsSubtotal,
                )}
              </p>
            </div>

            {/* Discount */}
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-5 border border-orange-200">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-orange-700 uppercase tracking-wide">
                  Discount
                </h4>
                <TrendingUp size={16} className="text-orange-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrencyAmount(
                  salesOrder?.currency,
                  salesOrder?.discount || 0,
                )}
              </p>
            </div>

            {/* Shipping Charges */}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-5 border border-purple-200">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-purple-700 uppercase tracking-wide">
                  Shipping Charges
                </h4>
                <Package size={16} className="text-purple-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrencyAmount(
                  salesOrder?.currency,
                  salesOrder?.shippingCharges || 0,
                )}
              </p>
            </div>
          </div>

          
        </div>
      </div>

      {/* Enhanced Purchase Order Details Card - Zoho Style */}
      <div className="container mx-auto px-0 py-0">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-white px-8 py-6 border-b border-gray-200">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Column - Vendor Info */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                  Vendor Details
                </h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                      Vendor Name
                    </h3>
                    <p className="text-base font-medium text-gray-900">
                      {getVendorDisplayLabel(salesOrder?.customer) || "---"}
                    </p>
                  </div>
                  {salesOrder?.billingAddress && (
                    <div>
                      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                        Billing Address
                      </h3>
                      <p className="text-sm text-gray-800 leading-relaxed">
                        {salesOrder.billingAddress
                          .split("\n")
                          .filter((line) => line.trim())
                          .map((line) => line.trim())
                          .join(", ")}
                      </p>
                    </div>
                  )}
                  {salesOrder?.shippingAddress && (
                    <div>
                      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                        Shipping Address
                      </h3>
                      <p className="text-sm text-gray-800 leading-relaxed">
                        {salesOrder.shippingAddress
                          .split("\n")
                          .filter((line) => line.trim())
                          .map((line) => line.trim())
                          .join(", ")}
                      </p>
                    </div>
                  )}
                  {salesOrder?.phone && (
                    <div>
                      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                        Phone
                      </h3>
                      <p className="text-sm text-gray-800">{salesOrder.phone}</p>
                    </div>
                  )}
                  {salesOrder?.fax && (
                    <div>
                      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                        Fax
                      </h3>
                      <p className="text-sm text-gray-800">{salesOrder.fax}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column - Purchase Order Info */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                  Purchase Order Details
                </h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                      PO Number
                    </h3>
                    <p className="text-base font-medium text-gray-900">
                      {salesOrder?.purchaseOrderNumber || "---"}
                    </p>
                  </div>
                  {salesOrder?.referenceNumber && (
                    <div>
                      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                        Reference Number
                      </h3>
                      <p className="text-sm text-gray-800">
                        {salesOrder.referenceNumber}
                      </p>
                    </div>
                  )}
                  <div>
                    <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                      Purchase Order Date
                    </h3>
                    <p className="text-sm text-gray-800 flex items-center gap-2">
                      <Calendar size={14} className="text-gray-400" />
                      {formatDate(getPurchaseOrderDate(salesOrder))}
                    </p>
                  </div>

                  {salesOrder?.expectedShipmentDate && (
                    <div>
                      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                        Expected Delivery Date
                      </h3>
                      <p className="text-sm text-gray-800 flex items-center gap-2">
                        <Calendar size={14} className="text-gray-400" />
                        {formatDate(salesOrder.expectedShipmentDate)}
                      </p>
                    </div>
                  )}

                  {salesOrder?.paymentTerms && (
                    <div>
                      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                        Payment Terms
                      </h3>
                      <p className="text-sm text-gray-800">{salesOrder.paymentTerms}</p>
                    </div>
                  )}
                  {salesOrder?.rejectionRemark && (
                    <div>
                      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                        Rejection Remark
                      </h3>
                      <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        {salesOrder.rejectionRemark}
                      </p>
                    </div>
                  )}
                  {salesOrder?.cancelReason && (
                    <div>
                      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                        Cancel Reason
                      </h3>
                      <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        {salesOrder.cancelReason}
                      </p>
                    </div>
                  )}
                  {salesOrder?.business?.name && (
                    <div>
                      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                        Business
                      </h3>
                      <p className="text-sm text-gray-800 flex items-center gap-2">
                        <Building2 size={14} className="text-gray-400" />
                        {salesOrder.business.name}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* File attachments (same as create / email preview) */}
      {Array.isArray(salesOrder?.attachments) && salesOrder.attachments.length > 0 && (
        <div className="container mx-auto px-0 py-0 mt-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileText size={20} className="text-gray-600" />
              Attachments
            </h2>
            <ul className="space-y-2">
              {salesOrder.attachments.map((att, idx) => (
                <li
                  key={String(att.fileId || att.s3Key || att._id || idx)}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 bg-gray-50 rounded-lg border border-gray-100"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {att.fileName || att.name || "File"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {att.fileSize
                        ? `${(att.fileSize / 1024 / 1024).toFixed(2)} MB`
                        : ""}
                      {att.includeInEmail === false ? " · Not set for vendor email" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {(att.fileId || att.s3Key) && (
                      <button
                        type="button"
                        onClick={async () => {
                          const fid = att.fileId || att.s3Key;
                          try {
                            const r = await axios.get(
                              `${Base_URL}/documents/getFileWithAllData/${fid}`,
                              { headers }
                            );
                            const u = r?.data?.data?.url;
                            if (u) window.open(u, "_blank");
                            else notifyError("File URL not available");
                          } catch (e) {
                            notifyError("Could not open file");
                          }
                        }}
                        className="text-sm text-[var(--p-blue)] hover:underline"
                      >
                        View
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Linked Goods Receipt Notes */}
      <div className="container mx-auto px-0 py-0 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Package size={18} className="text-gray-600" />
                Linked Goods Receipts
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                GRNs raised against this purchase order
              </p>
            </div>
            {canReceive && (
              <button
                type="button"
                className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
                onClick={() =>
                  history.push({
                    pathname: "/goods-receipts/create",
                    state: { purchaseOrderId: id },
                  })
                }
              >
                Create GRN
              </button>
            )}
          </div>
          {linkedGrns.length === 0 ? (
            <div className="px-6 py-8 text-sm text-gray-500">
              No GRNs linked yet. Create a Goods Receipt Note to receive stock.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      GRN
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Supplier DN
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Warehouse
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Date
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {linkedGrns.map((grn) => {
                    const label =
                      grn.reference || grn.name || String(grn._id).slice(-6);
                    const wh =
                      grn.warehouse?.name ||
                      grn.warehouse?.code ||
                      "—";
                    const when =
                      grn.confirmedAt || grn.reversedAt || grn.createdAt;
                    return (
                      <tr key={String(grn._id)} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {label}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${grnStatusClass(
                              grn.status,
                            )}`}
                          >
                            {grnStatusLabel(grn.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {grn.supplierDeliveryNote || "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{wh}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {when ? formatDate(when) : "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          <button
                            type="button"
                            className="text-[var(--p-blue)] hover:underline font-medium"
                            onClick={() =>
                              history.push(`/goods-receipts/${grn._id}`)
                            }
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Change history */}
      <div className="container mx-auto px-0 py-0 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Clock size={18} className="text-gray-600" />
              Change History
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Status transitions and commercial edits
            </p>
          </div>
          {changeHistory.length === 0 ? (
            <div className="px-6 py-8 text-sm text-gray-500">
              No changes recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      When
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Action
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      By
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {changeHistory.map((row, idx) => {
                    const byName =
                      row.by?.name || row.by?.email || (row.by ? "User" : "—");
                    const statusMove =
                      row.fromStatus || row.toStatus
                        ? `${formatPoStatusLabel(row.fromStatus || "—")} → ${formatPoStatusLabel(
                            row.toStatus || "—",
                          )}`
                        : "—";
                    return (
                      <tr key={row._id || idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                          {row.at ? formatDate(row.at) : "—"}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {changeHistoryActionLabel(row.action)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {statusMove}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{byName}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 max-w-md">
                          {row.note || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Invoice Renderer - Template when available, else PDF iframe when documentUrl exists */}
      <div className="container mx-auto px-0 py-0">
        <div className="space-y-4">
          <div
            className="bg-white border border-gray-200 rounded-lg w-full overflow-hidden shadow-sm"
            ref={invoiceContainerRef}
          >
            {invoiceData && templateData && (
              <div ref={invoiceRef} key={templateData?._id || salesOrder?._id}>
                <InvoiceRenderer
                  invoice={invoiceData}
                  template={templateData}
                  pdfPayload={orderPdfPayload}
                />
              </div>
            )}
            {invoiceData && !templateData && salesOrder?.documentUrl && (
              <div className="w-full bg-gray-100" style={{ minHeight: "800px" }}>
                {pdfLoading ? (
                  <div className="flex flex-col items-center justify-center h-[800px]">
                    <div className="w-14 h-14 border-4 border-t-4 border-gray-200 border-t-[var(--p-blue)] rounded-full animate-spin mb-4"></div>
                    <p className="text-gray-600 text-sm mb-1">Loading document PDF...</p>
                    {retryCount > 0 && (
                      <p className="text-gray-500 text-xs">Retry attempt {retryCount} of 3</p>
                    )}
                  </div>
                ) : pdfError ? (
                  <div className="flex flex-col items-center justify-center h-[800px] p-6">
                    <div className="text-red-500 text-5xl mb-4">⚠️</div>
                    <p className="text-red-600 font-medium mb-2 text-center max-w-md">{pdfError}</p>
                    <button
                      onClick={handleRetryPdfLoad}
                      className="flex items-center px-4 py-2 text-sm text-white bg-[var(--p-blue)] rounded-lg hover:bg-[var(--p-blue-dark)] transition-all mb-2"
                    >
                      <FileText size={16} className="mr-2" />
                      Retry Loading PDF
                    </button>
                  </div>
                ) : pdfUrl ? (
                  <PdfViewerIframe
                    pdfUrl={pdfUrl}
                    onError={(err) => {
                      console.error("Purchase order PDF iframe error:", err);
                      setPdfError("Failed to load document PDF. Connection may have been reset.");
                      setPdfUrl("");
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-[800px]">
                    <p className="text-gray-600 text-sm">No PDF document available</p>
                  </div>
                )}
              </div>
            )}
            {invoiceData && !templateData && !salesOrder?.documentUrl && (
              <div className="flex flex-col items-center justify-center py-24 px-6">
                <FileText size={48} className="text-gray-300 mb-4" />
                <p className="text-gray-600 text-center">No template or document available</p>
                <p className="text-gray-500 text-sm mt-1 text-center">Download PDF from the purchase order form to generate a document.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Template Selection - same pattern as CustomerInvoiceViewer */}
      {templates.length > 0 && (
        <div className="container mx-auto px-6 pb-6">
          <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center gap-3">
              <FileText size={18} className="text-gray-500" />
              <div>
                <span className="text-sm text-gray-600">Current Template:</span>
                <span className="ml-2 font-semibold text-gray-900">
                  {templates.find((t) => (t._id || t.id) === selectedTemplate)?.name ||
                    "Standard Purchase Order"}
                </span>
              </div>
            </div>
            <button
              className="px-4 py-2 text-sm font-medium text-[var(--p-blue)] hover:text-[var(--p-blue-dark)] transition-colors"
              onClick={handleChangeTemplate}
            >
              Change Template
            </button>
          </div>
        </div>
      )}

      {/* Fulfillment Modal */}
      {showFulfillmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white w-full max-w-3xl rounded-xl shadow-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Record receipt</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Increase or lower quantities to mark lines as received or unreceived.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowFulfillmentModal(false)}
                className="text-gray-500 hover:text-gray-900"
              >
                ✕
              </button>
            </div>

            <div className="p-6 max-h-[70vh] overflow-auto">
              <StockLocationPicker
                businessId={orderBusinessId}
                headers={headers}
                warehouseId={stockWarehouseId}
                locationId={stockLocationId}
                onWarehouseChange={setStockWarehouseId}
                onLocationChange={setStockLocationId}
                receiveMode
              />
              <div className="space-y-4">
                {fulfillmentDraft.map((row) => {
                  const remaining = Math.max(0, row.ordered - (Number(row.newFulfilled) || 0));
                  return (
                    <div key={row.index} className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">{row.description}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            Ordered: {row.ordered} • Previously received: {row.fulfilled} • Remaining to receive: {remaining}
                          </div>
                        </div>
                        <div className="w-40">
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Received qty
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={row.ordered}
                            step="0.01"
                            value={row.newFulfilled}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              setFulfillmentDraft((prev) =>
                                prev.map((x) =>
                                  x.index === row.index
                                    ? { ...x, newFulfilled: Number.isFinite(v) ? v : x.newFulfilled }
                                    : x
                                )
                              );
                            }}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowFulfillmentModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveFulfillment}
                disabled={savingFulfillment}
                className="px-4 py-2 text-sm font-medium text-white bg-[var(--p-blue)] rounded-lg hover:bg-[var(--p-blue-dark)] disabled:opacity-60"
              >
                {savingFulfillment ? "Saving..." : "Save receipt"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Complete receive — pick location */}
      {showCompleteLocationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Mark as fully received
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Choose where remaining quantities will be stocked.
              </p>
            </div>
            <div className="p-6">
              <StockLocationPicker
                businessId={orderBusinessId}
                headers={headers}
                warehouseId={stockWarehouseId}
                locationId={stockLocationId}
                onWarehouseChange={setStockWarehouseId}
                onLocationChange={setStockLocationId}
                receiveMode
              />
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCompleteLocationModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCompleteFulfillment}
                disabled={completingFulfillment || !stockLocationId}
                className="px-4 py-2 text-sm font-medium text-white bg-[var(--p-blue)] rounded-lg disabled:opacity-60"
              >
                {completingFulfillment ? "Receiving…" : "Confirm receive"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject PO modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white w-full max-w-md rounded-xl shadow-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Reject Purchase Order</h3>
              <p className="text-xs text-gray-500 mt-1">
                The PO will return to Draft. A rejection remark is required.
              </p>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rejection remark <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectRemark}
                onChange={(e) => setRejectRemark(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
                placeholder="Reason for rejection…"
              />
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectRemark("");
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleRejectConfirm}
                disabled={updatingStatus || !rejectRemark.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg disabled:opacity-60"
              >
                {updatingStatus ? "Rejecting…" : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel PO modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white w-full max-w-md rounded-xl shadow-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Cancel Purchase Order</h3>
              <p className="text-xs text-gray-500 mt-1">
                Cancelled POs cannot be used for goods receipt. Only allowed if nothing has been received yet.
              </p>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cancel reason (optional)
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
                placeholder="Reason for cancellation…"
              />
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowCancelModal(false);
                  setCancelReason("");
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleCancelConfirm}
                disabled={updatingStatus}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg disabled:opacity-60"
              >
                {updatingStatus ? "Cancelling…" : "Confirm Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
