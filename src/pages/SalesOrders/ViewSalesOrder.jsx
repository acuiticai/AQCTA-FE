import React, { useState, useEffect, useContext, useRef } from "react";
import { useHistory, useParams } from "react-router-dom";
import {
  ChevronLeft,
  Download,
  Mail,
  Calendar,
  Building2,
  User,
  Package,
  FileText,
  CheckCircle,
  Clock,
  TrendingUp,
  Receipt,
  MoreVertical,
} from "lucide-react";
import axios from "axios";
import { notifyError, notifySuccess } from "@/utils/toast";
import { AdminContext } from "@/context/AdminContext";
import SalesOrderServices from "@/services/SalesOrderServices";
import { PageHeader } from "@/page-layouts/index";
import { formatDate, formatAmount, formatCurrencyAmount } from "@/components/formatAmount";
import { formatInvoiceDownloadName } from "@/utils/generic";
import { enrichSavedRecordHtmlWithCustomFields } from "@/utils/customFieldsPdf";
import { fetchPdfPayload } from "@/services/customFieldServices";
import InvoiceRenderer from "@/pages/Accounts/CustomerInvoice/components/InvoiceRenderer";
import CustomerInvoiceServices from "@/services/CustomerInvoiceServices";
import FleetManagementServices from "@/services/FleetManagementServices";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { getLineSubtotal } from "@/utils/itemDiscountUtils";
import {
  calculateOrderDiscountPercentage,
  isSaleOrderDocumentTemplateType,
  normalizeDocumentTemplateType,
  resolveOrderLineItemAndDescription,
} from "@/utils/invoiceContractMapper";
import {
  hasPathPermission,
  hasModulePermission,
  PERMISSION_ACTION,
} from "@/utils/permissionUtils";
import { fetchAddressTypeConfig } from "@/utils/addressTypeUtils";
import { useModuleLabels } from "@/context/ModuleLabelsContext";
import { useTranslation } from "react-i18next";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const hasValidOrderDate = (value) => {
  if (value == null || value === "") return false;
  const t = new Date(value).getTime();
  return Number.isFinite(t);
};

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
  const storedDiscountAmount = parseFloat(order.discount) || 0;
  const explicitDiscountPct = parseFloat(order.discountPercentage);
  /**
   * Match SalesOrderForm summary: when an explicit order-level % is stored
   * (e.g. Zoho's "20%"), derive the amount from PCI's tax-inclusive subtotal
   * so View ≡ Edit. Otherwise fall back to the stored amount.
   */
  const discountPercentage =
    Number.isFinite(explicitDiscountPct) && explicitDiscountPct > 0
      ? Math.min(100, Math.max(0, explicitDiscountPct))
      : calculateOrderDiscountPercentage(subtotal, storedDiscountAmount);
  const discount =
    Number.isFinite(explicitDiscountPct) && explicitDiscountPct > 0
      ? (subtotal * discountPercentage) / 100
      : storedDiscountAmount;
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
const PdfViewerIframe = ({ pdfUrl, onError, title }) => {
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
      title={title}
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
const StatusBadge = ({ status, t }) => {
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "draft":
        return "bg-gray-100 text-gray-700 border-gray-300";
      case "confirmed":
        return "bg-blue-100 text-blue-700 border-blue-300";
      case "partially invoiced":
        return "bg-yellow-100 text-yellow-700 border-yellow-300";
      case "fully invoiced":
        return "bg-purple-100 text-purple-700 border-purple-300";
      case "partially delivered":
        return "bg-orange-100 text-orange-700 border-orange-300";
      case "delivered":
        return "bg-green-100 text-green-700 border-green-300";
      case "closed":
        return "bg-gray-200 text-gray-800 border-gray-400";
      case "invoiced":
        return "bg-purple-100 text-purple-700 border-purple-300";
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
      {status
        ? t(`salesOrder.status.${status.toLowerCase().replace(/\s+/g, "")}`, {
            defaultValue: status,
          })
        : t("salesOrder.status.draft", { defaultValue: "Draft" })}
    </span>
  );
};

// Fulfillment Badge Component
const FulfillmentBadge = ({ status, t }) => {
  const normalized = (status || "Not Shipped").toString().toLowerCase();
  const getColor = () => {
    if (normalized === "shipped")
      return "bg-green-100 text-green-700 border-green-300";
    if (normalized === "partially shipped")
      return "bg-orange-100 text-orange-700 border-orange-300";
    return "bg-gray-100 text-gray-700 border-gray-300";
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getColor()} border`}>
      {status
        ? t(
            `salesOrder.fulfillmentStatus.${status
              .toLowerCase()
              .replace(/\s+/g, "")}`,
            { defaultValue: status }
          )
        : t("salesOrder.fulfillmentStatus.notShipped", {
            defaultValue: "Not Shipped",
          })}
    </span>
  );
};

export default function ViewSalesOrder() {
  const { t } = useTranslation();
  const { getModuleLabel, getModuleRoutePath } = useModuleLabels();
  const configuredSaleOrderLabel = getModuleLabel("saleOrder", "Sale Order");
  const saleOrderLabel =
    configuredSaleOrderLabel === "Sale Order"
      ? t("salesOrder.label", { defaultValue: "Sale Order" })
      : configuredSaleOrderLabel;
  const saleOrderListPath = getModuleRoutePath("saleOrder", "list");
  const history = useHistory();
  const { id } = useParams();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const roleModules = adminInfo?.role?.modules || [];
  const canViewJobs = hasPathPermission(roleModules, "/jobs", PERMISSION_ACTION.VIEW);
  const canCreateJobs = hasPathPermission(roleModules, "/jobs", PERMISSION_ACTION.ADD);
  const canOpenJobScheduling = canViewJobs || canCreateJobs;
  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo.token}`,
  };

  const [salesOrder, setSalesOrder] = useState(null);
  const [addressTypeConfig, setAddressTypeConfig] = useState({
    billingLabel: t("common.billing", { defaultValue: "Billing" }),
    shippingLabel: t("common.shipping", { defaultValue: "Shipping" }),
  });
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [convertingToInvoice, setConvertingToInvoice] = useState(false);
  const [creatingInstantInvoice, setCreatingInstantInvoice] = useState(false);
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
  const [openingAppointment, setOpeningAppointment] = useState(false);
  const [fleetAppointmentMeta, setFleetAppointmentMeta] = useState({
    loading: false,
    jobId: "",
    hasAssignment: false,
  });

  useEffect(() => {
    const loadAddressTypes = async () => {
      const businessId =
        (salesOrder?.business && typeof salesOrder.business === "object"
          ? salesOrder.business._id
          : salesOrder?.business) ||
        salesOrder?.business_id?._id ||
        salesOrder?.business_id ||
        "";
      const config = await fetchAddressTypeConfig(businessId, headers);
      setAddressTypeConfig(config);
    };
    loadAddressTypes();
  }, [salesOrder?.business?._id, salesOrder?.business, salesOrder?.business_id?._id, salesOrder?.business_id]);

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
            module: "sales",
            screen: "sales_order",
            recordId: rid,
          },
          headers,
        );
        if (!cancelled) setOrderPdfPayload(payload);
      } catch (e) {
        console.warn("Sales order PDF payload (preview):", e);
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
  const fulfillmentMenuRef = useRef(null);
  const [soPickLists, setSoPickLists] = useState([]);
  const [soPickListsLoading, setSoPickListsLoading] = useState(false);
  const canViewPickLists = hasPathPermission(
    roleModules,
    "/pick-lists",
    PERMISSION_ACTION.VIEW,
  );

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

  const isShipped =
    (salesOrder?.fulfillment_status || "").toString().toLowerCase() === "shipped";

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

  useEffect(() => {
    if (!id || !adminInfo?.token || salesOrder?.status === "Draft") {
      setSoPickLists([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setSoPickListsLoading(true);
      try {
        const res = await axios.get(`${Base_URL}/pick-lists`, {
          headers,
          params: {
            referenceType: "sales_order",
            referenceId: id,
            status: "all",
            limit: 20,
            businessId: orderBusinessId || undefined,
          },
        });
        if (!cancelled) setSoPickLists(res.data?.data || []);
      } catch (err) {
        if (!cancelled) setSoPickLists([]);
      } finally {
        if (!cancelled) setSoPickListsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, salesOrder?.status, salesOrder?.updatedAt, adminInfo?.token, orderBusinessId]);

  // Fetch signed PDF URL for sales order document (when no template, show in iframe)
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
          throw new Error(
            t("documents.errors.noUrlFromDocument", {
              defaultValue: "No URL returned from document",
            })
          );
        }
      } else {
        const response = await CustomerInvoiceServices.getSignedInvoiceUrl(documentUrl);
        const url = response.data?.url || response.data?.data?.url || response.data?.data?.signedUrl;
        if (url) {
          setPdfUrl(url);
          setRetryCount(0);
        } else {
          throw new Error(
            t("documents.errors.noUrlFromServer", {
              defaultValue: "No URL returned from server",
            })
          );
        }
      }
    } catch (error) {
      console.error(`Error fetching sales order PDF URL (attempt ${retryAttempt + 1}):`, error);
      const isConnectionError = error.message?.includes("timeout") || error.message?.includes("Connection") || error.code === "ECONNRESET" || error.code === "ETIMEDOUT";
      if (isConnectionError && retryAttempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, retryAttempt);
        setTimeout(() => fetchSalesOrderPdfUrl(documentUrl, retryAttempt + 1), delay);
        return;
      }
      setPdfError(
        error.response?.data?.message ||
          error.message ||
          t("documents.notifications.pdfLoadFailed", {
            defaultValue: "Failed to load document PDF",
          })
      );
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
        const response = await SalesOrderServices.getSalesOrderById(id, headers);
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
            console.error("ViewSalesOrder: failed to fetch business for renderer", e);
            // Set empty object to prevent errors, but log the issue
            businessObj = businessObj || {};
          }

          let customerObj = orderData.customer;
          try {
            if (!customerObj || typeof customerObj === "string") {
              const customerId = customerObj || orderData.customer_id || orderData.customer;
              if (customerId) {
                const cRes = await axios.get(`${Base_URL}/customers/${customerId}`, {
                  headers,
                });
                // Handle both response formats
                customerObj = cRes?.data?.data || cRes?.data || customerObj;
              }
            }
          } catch (e) {
            console.warn("ViewSalesOrder: failed to fetch customer for renderer", e);
            // Set empty object to prevent errors
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
                const salespersonRes = await SalesOrderServices.getSalespersons(
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
              console.warn("ViewSalesOrder: failed to resolve salesperson name", e);
            }
          }

          const summary = computeSoSummary(orderData);

          // Convert sales order to invoice format for rendering
          // Structure must match exactly what CustomerInvoiceViewer passes to InvoiceRenderer
          // const soInvoiceType =
          //   orderData?.invoiceType === "Proforma" ? "Proforma" : "Commercial";

             const soInvoiceType = orderData.invoiceType || "Commercial";

          const convertedInvoiceData = {
            ...orderData,
            // Mark as coming from Sales Orders so InvoiceRenderer (UnifiedInvoice)
            // can apply sales-order specific handling and use raw items.
            location: "sales-orders",
            // Invoice number fields (InvoiceRenderer checks multiple)
            invoice_number: orderData.salesOrderNumber,
            invoiceNumber: orderData.salesOrderNumber,
            ref: orderData.salesOrderNumber,
            number: orderData.salesOrderNumber,
            // Legacy invoice-type field on pseudo-invoice payload (view uses sale order document templates).
            invoiceType: soInvoiceType,
            // Date fields (InvoiceRenderer checks multiple formats)
            invoice_date: orderData.salesOrderDate,
            invoiceDate: orderData.salesOrderDate,
            date: orderData.salesOrderDate,
            due_date: orderData.expectedShipmentDate,
            dueDate: orderData.expectedShipmentDate,
            due_date_value: orderData.expectedShipmentDate,
            // Customer fields - must be populated objects, not just IDs
            customer_id: customerObj,
            customer: customerObj, // InvoiceRenderer also checks this
            customer_name: customerObj?.basicInformation?.companyName || 
                          customerObj?.basicInformation?.customerDisplayName || 
                          orderData.customer_name ||
                          t("common.customer", { defaultValue: "Customer" }),
            customer_company: customerObj?.companyInfo?.companyName || customerObj?.basicInformation?.companyName,
            customer_address: orderData.billingAddress || customerObj?.companyInfo?.billingAddress,
            customerPhone: customerObj?.basicInformation?.customerPhone?.mobile || customerObj?.companyInfo?.phone,
            customerEmail: customerObj?.basicInformation?.customerEmail,
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
            // Totals — subtotal = sum of line totals (incl. tax)
            subTotal: summary.subtotal,
            subtotal: summary.subtotal,
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
                return isSaleOrderDocumentTemplateType(a.type, a.templateId?.type);
              });
              filteredTemplates = activeAssignments
                .map((item) => {
                  const template = item.templateId;
                  if (!template) return null;
                  return {
                    ...template,
                    isDefault: item.isDefault || false,
                    isActive: item.isActive || false,
                  };
                })
                .filter((t) => t != null);
            } catch (err) {
              console.warn("Error fetching business templates:", err);
            }
          }

          if (filteredTemplates.length === 0) {
            try {
              const templatesResponse = await axios.get(`${Base_URL}/document-templates`, { headers });
              const allTemplates = templatesResponse.data?.data || templatesResponse.data || [];
              filteredTemplates = allTemplates.filter(
                (tmp) => isSaleOrderDocumentTemplateType(tmp.type, tmp.type)
              );
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
              const preferredTemplate = uniqueTemplates.find((t) => t.isDefault) || uniqueTemplates[0];
              const tid = preferredTemplate._id || preferredTemplate.id;
              setSelectedTemplate(tid);
              setTempSelectedTemplate(tid);
              if (preferredTemplate._id && !preferredTemplate.htmlContent) {
                try {
                  const fullTemplateResponse = await axios.get(
                    `${Base_URL}/document-templates/${preferredTemplate._id}`,
                    { headers }
                  );
                  setTemplateData(fullTemplateResponse.data?.data || fullTemplateResponse.data);
                } catch (e) {
                  console.warn("Failed to fetch full template, using partial:", e);
                  setTemplateData(preferredTemplate);
                }
              } else {
                setTemplateData(preferredTemplate);
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
          notifyError(
            response.data.message ||
              t("salesOrder.notifications.fetchOneFailed", {
                defaultValue: "Failed to fetch {{label}}",
                label: saleOrderLabel.toLowerCase(),
              })
          );
          history.push(saleOrderListPath);
        }
      } catch (error) {
        console.error("Error fetching sales order:", error);
        notifyError(
          error.response?.data?.message ||
            t("salesOrder.notifications.fetchOneFailed", {
              defaultValue: "Failed to fetch {{label}}",
              label: saleOrderLabel.toLowerCase(),
            })
        );
        history.push(saleOrderListPath);
      } finally {
        setLoading(false);
      }
    };

    fetchSalesOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleBack = () => {
    history.push(saleOrderListPath);
  };

  useEffect(() => {
    let cancelled = false;
    const loadFleetAppointmentMeta = async () => {
      if (!salesOrder?._id) return;
      setFleetAppointmentMeta((prev) => ({ ...prev, loading: true }));
      try {
        const resp = await FleetManagementServices.getJobFromSalesOrder(salesOrder._id);
        if (cancelled) return;
        const job = resp?.data;
        setFleetAppointmentMeta({
          loading: false,
          jobId: job?._id || "",
          hasAssignment: (Number(resp?.meta?.assignmentCount) || 0) > 0,
        });
      } catch {
        if (cancelled) return;
        setFleetAppointmentMeta({ loading: false, jobId: "", hasAssignment: false });
      }
    };
    loadFleetAppointmentMeta();
    return () => {
      cancelled = true;
    };
  }, [salesOrder?._id]);

  const handleOpenAppointment = async () => {
    if (!salesOrder?._id || openingAppointment) return;
    setOpeningAppointment(true);
    try {
      const resp = canCreateJobs
        ? await FleetManagementServices.getOrCreateJobFromSalesOrder(salesOrder._id)
        : await FleetManagementServices.getJobFromSalesOrder(salesOrder._id);
      const job = resp?.data;
      if (!job?._id) {
        notifyError(
          canCreateJobs
            ? t("salesOrder.appointment.openFailed", {
                defaultValue: "Could not open appointment",
              })
            : t("salesOrder.appointment.noLinkedJob", {
                defaultValue: "No linked job found for this {{label}}",
                label: saleOrderLabel.toLowerCase(),
              }),
        );
        return;
      }
      const assignmentCount = Number(resp?.meta?.assignmentCount) || 0;
      notifySuccess(
        assignmentCount > 0
          ? t("salesOrder.appointment.openingBoard", {
              defaultValue: "Opening scheduling board",
            })
          : t("salesOrder.appointment.pending", {
              defaultValue: "Job is pending and available in Waiting / On-Deck",
            }),
      );
      setFleetAppointmentMeta({
        loading: false,
        jobId: job._id,
        hasAssignment: assignmentCount > 0,
      });
      history.push("/scheduling");
    } catch (error) {
      notifyError(
        error?.response?.data?.message ||
          t("salesOrder.appointment.openFailed", {
            defaultValue: "Failed to open appointment",
          })
      );
    } finally {
      setOpeningAppointment(false);
    }
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
      notifySuccess(
        t("documents.notifications.templateUpdated", {
          defaultValue:
            "Template updated. Download PDF to use the new template.",
        })
      );
    } catch (err) {
      console.error("Error updating template:", err);
      notifyError(
        t("documents.notifications.templateUpdateFailed", {
          defaultValue: "Failed to update template.",
        })
      );
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
        a.download = formatInvoiceDownloadName(salesOrder?.salesOrderNumber || "Sales-Order");
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        notifySuccess(
          t("documents.notifications.pdfDownloaded", {
            defaultValue: "PDF downloaded successfully!",
          })
        );
      } catch (error) {
        console.error("Error downloading PDF:", error);
        notifyError(
          t("documents.notifications.pdfDownloadFailed", {
            defaultValue: "Failed to download PDF",
          })
        );
      } finally {
        setIsGeneratingPdf(false);
      }
      return;
    }
    const root = invoiceRef.current;
    if (!root) {
      notifyError(
        t("salesOrder.notifications.downloadContentMissing", {
          defaultValue: "Could not find {{label}} content to download.",
          label: saleOrderLabel.toLowerCase(),
        })
      );
      return;
    }
    setIsGeneratingPdf(true);
    const PAGE_PT_WIDTH = 595;
    const PAGE_PT_HEIGHT = 842;
    const CAPTURE_PX_WIDTH = 794;
    const base = (Base_URL || "").replace(/\/$/, "");
    let wrap = null;

    try {
      const targetPage = root.querySelector(".tpl-doc-page") || root;
      const clone = targetPage.cloneNode(true);
      wrap = document.createElement("div");
      wrap.style.cssText = "position:fixed;left:-9999px;top:0;width:" + CAPTURE_PX_WIDTH + "px;max-width:" + CAPTURE_PX_WIDTH + "px;background:#fff;";
      wrap.appendChild(clone);
      const cloneInner = clone.classList?.contains("tpl-doc-page")
        ? clone
        : clone.querySelector(".tpl-doc-page") ||
          clone.querySelector(".invoice-container") ||
          clone;
      cloneInner.style.width = CAPTURE_PX_WIDTH + "px";
      cloneInner.style.maxWidth = CAPTURE_PX_WIDTH + "px";
      cloneInner.style.boxShadow = "none";
      cloneInner.style.border = "0";
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
              module: "sales",
              screen: "sales_order",
              recordId: salesOrder._id,
              headers,
            }
          );
        } catch (cfErr) {
          console.warn("Sales order PDF custom fields:", cfErr);
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

      const fullFileName = formatInvoiceDownloadName(salesOrder?.salesOrderNumber || "Sales-Order");
      const pdfBlob = pdf.output("blob");

      const link = document.createElement("a");
      link.href = URL.createObjectURL(pdfBlob);
      link.download = fullFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      notifySuccess(
        t("documents.notifications.pdfDownloaded", {
          defaultValue: "PDF downloaded successfully!",
        })
      );
    } catch (error) {
      if (wrap?.parentNode) try { document.body.removeChild(wrap); } catch (_) {}
      console.error("Error generating PDF:", error);
      notifyError(
        t("documents.notifications.pdfGenerateFailed", {
          defaultValue: "Failed to generate PDF. Please try again.",
        })
      );
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Handle Mark as Confirmed
  const handleMarkAsConfirmed = async () => {
    if (!salesOrder || salesOrder.status !== "Draft") return;

    setUpdatingStatus(true);
    try {
      const response = await SalesOrderServices.updateSalesOrderStatus(
        id,
        "Confirmed",
        headers
      );
      if (response.data.success) {
        notifySuccess(
          t("salesOrder.notifications.markedConfirmed", {
            defaultValue:
              "{{label}} marked as Confirmed — pick list ready with warehouse / location / batch",
            label: saleOrderLabel,
          })
        );
        // Refresh the sales order data
        const updatedResponse = await SalesOrderServices.getSalesOrderById(id, headers);
        if (updatedResponse.data.success) {
          setSalesOrder(updatedResponse.data.data);
        }
      } else {
        notifyError(
          response.data.message ||
            t("salesOrder.notifications.statusUpdateFailed", {
              defaultValue: "Failed to update status",
            })
        );
      }
    } catch (error) {
      console.error("Error updating status:", error);
      notifyError(
        error.response?.data?.message ||
          t("salesOrder.notifications.statusUpdateFailed", {
            defaultValue: "Failed to update status",
          })
      );
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Handle Instant Invoice (quick-create invoice immediately)
  const handleInstantInvoice = async () => {
    if (!salesOrder) return;

    setCreatingInstantInvoice(true);
    try {
      const response = await SalesOrderServices.instantInvoice(id, headers);
      if (response.data.success) {
        notifySuccess(
          response.data.message ||
            t("salesOrder.notifications.invoiceCreated", {
              defaultValue: "Invoice created successfully",
            })
        );
        // Update local sales order status
        // Don't update status - Invoice Status is tracked separately
        // Sales Order Status remains as Confirmed/Delivered
        // Navigate to the created invoice
        if (response.data.data?.invoiceId) {
          history.push(`/customer-invoices/view/${response.data.data.invoiceId}`);
        } else {
          history.push("/customer-invoices");
        }
      } else {
        notifyError(
          response.data.message ||
            t("salesOrder.notifications.invoiceCreateFailed", {
              defaultValue: "Failed to create invoice",
            })
        );
      }
    } catch (error) {
      console.error("Error creating instant invoice:", error);
      notifyError(
        error.response?.data?.message ||
          t("salesOrder.notifications.invoiceCreateFailed", {
            defaultValue: "Failed to create invoice",
          })
      );
    } finally {
      setCreatingInstantInvoice(false);
    }
  };

  // Handle Convert to Invoice (opens invoice creation page with pre-filled data)
  const handleConvertToInvoice = async () => {
    if (!salesOrder) return;

    setConvertingToInvoice(true);
    try {
      // Get sales order data for pre-filling
      const response = await SalesOrderServices.convertToInvoice(id, headers);
      if (response.data.success) {
        if (response.data.data?.wasDraft) {
          notifySuccess(
            t("salesOrder.notifications.autoConfirmed", {
              defaultValue:
                "{{label}} was in Draft and has been automatically confirmed. Opening invoice creation page...",
              label: saleOrderLabel,
            })
          );
        }
        // Show info about remaining quantities
        // Refresh sales order to get updated status
        const updatedResponse = await SalesOrderServices.getSalesOrderById(id, headers);
        if (updatedResponse.data.success) {
          setSalesOrder(updatedResponse.data.data);
        }
        // Navigate to invoice creation page with pre-filled data
        history.push({
          pathname: "/create-customer-invoice",
          state: {
            salesOrderId: id,
            salesOrderNumber:
              response.data.data?.salesOrderNumber ||
              salesOrder?.salesOrderNumber ||
              "",
            salesOrderData: response.data.data,
          },
        });
      } else {
        notifyError(
          response.data.message ||
            t("salesOrder.notifications.invoiceDataFailed", {
              defaultValue: "Failed to get sales order data",
            })
        );
      }
    } catch (error) {
      console.error("Error converting to invoice:", error);
      notifyError(
        error.response?.data?.message ||
          t("salesOrder.notifications.convertInvoiceFailed", {
            defaultValue: "Failed to convert to invoice",
          })
      );
    } finally {
      setConvertingToInvoice(false);
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
    setFulfillmentDraft(draft);
    setShowFulfillmentModal(true);
  };

  const handleSaveFulfillment = async () => {
    try {
      setSavingFulfillment(true);
      // Stock out is automatic via FEFO (if expiry) or FIFO
      const payload = {
        items: fulfillmentDraft.map((row) => ({
          index: row.index,
          fulfilled_quantity: Number(row.newFulfilled) || 0,
        })),
      };

      const res = await SalesOrderServices.updateFulfillment(id, payload, headers);
      if (res.data?.success) {
        notifySuccess(
          res.data.message ||
            t("salesOrder.notifications.fulfillmentUpdated", {
              defaultValue: "Fulfillment updated — stock decreased",
            })
        );
        setSalesOrder(res.data.data);
        setShowFulfillmentModal(false);
      } else {
        notifyError(
          res.data?.message ||
            t("salesOrder.notifications.fulfillmentUpdateFailed", {
              defaultValue: "Failed to update fulfillment",
            })
        );
      }
    } catch (error) {
      console.error("Error updating fulfillment:", error);
      notifyError(
        error.response?.data?.message ||
          t("salesOrder.notifications.fulfillmentUpdateFailed", {
            defaultValue: "Failed to update fulfillment",
          })
      );
    } finally {
      setSavingFulfillment(false);
    }
  };

  const openCompleteLocationModal = () => {
    setShowCompleteLocationModal(true);
  };

  const handleCompleteFulfillment = async () => {
    try {
      setCompletingFulfillment(true);
      const res = await SalesOrderServices.completeFulfillment(
        id,
        {},
        headers,
      );
      if (res.data?.success) {
        notifySuccess(
          res.data.message ||
            t("salesOrder.notifications.markedShipped", {
              defaultValue: "{{label}} marked as Shipped — stock decreased",
              label: saleOrderLabel,
            })
        );
        setSalesOrder(res.data.data);
        setShowCompleteLocationModal(false);
      } else {
        notifyError(
          res.data?.message ||
            t("salesOrder.notifications.fulfillmentCompleteFailed", {
              defaultValue: "Failed to complete fulfillment",
            })
        );
      }
    } catch (error) {
      console.error("Error completing fulfillment:", error);
      notifyError(
        error.response?.data?.message ||
          t("salesOrder.notifications.fulfillmentCompleteFailed", {
            defaultValue: "Failed to complete fulfillment",
          })
      );
    } finally {
      setCompletingFulfillment(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="w-14 h-14 border-4 border-t-4 border-gray-200 border-t-[var(--p-blue)] rounded-full animate-spin mb-4"></div>
        {/* <p className="text-gray-600 text-sm font-medium">Loading sales order...</p> */}
      </div>
    );
  }

  if (!salesOrder) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">
          {t("salesOrder.notFound", {
            defaultValue: "{{label}} not found",
            label: saleOrderLabel,
          })}
        </div>
      </div>
    );
  }

  const salesOrderStatus = salesOrder?.status;
  const canInvoiceWithInstantAndConvert = [
    "Confirmed",
    "Partially Invoiced",
    "Partially Delivered",
    "Delivered",
  ].includes(salesOrderStatus);
  const canConvertFromDraft = salesOrderStatus === "Draft";

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
            {t("common.back", { defaultValue: "Back" })}
          </button>
        </div>
        <div className="container mx-auto">
          <h1 className="text-2xl font-bold mb-8 text-gray-800">
            {t("documents.changeTemplateTitle", {
              defaultValue: "Change {{type}} Template",
              type:
                invoiceData?.invoiceType === "Proforma"
                  ? t("documents.proformaInvoice", {
                      defaultValue: "Proforma Invoice",
                    })
                  : t("documents.commercialInvoice", {
                      defaultValue: "Commercial Invoice",
                    }),
            })}
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
                    {template.name ||
                      t("documents.templateName", {
                        defaultValue: "Template Name",
                      })}
                  </h3>
                  <p className="text-gray-500 text-sm mt-1">
                    {template.description ||
                      template.type ||
                      t("documents.noDescription", {
                        defaultValue: "No description",
                      })}
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
              {t("common.cancel", { defaultValue: "Cancel" })}
            </button>
            <button
              className="px-6 py-2.5 bg-[var(--p-blue)] text-white rounded-md hover:bg-[var(--p-blue-dark)] transition-colors font-medium shadow-sm"
              onClick={handleConfirmTemplateSelection}
            >
              {t("documents.applyTemplate", { defaultValue: "Apply Template" })}
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
          <PageHeader
            title={salesOrder?.salesOrderNumber || "---"}
            showBackButton
            onBackClick={handleBack}
            backFallbackPath={saleOrderListPath}
            actionsContainerClassName="flex flex-wrap gap-2 justify-end min-w-0"
            renderActions={
              <div className="flex items-center gap-2 flex-wrap justify-end">
              {/* Mark as Confirmed - Only show when status is Draft */}
              {salesOrder?.status === "Draft" && (
                <button
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-sm transition-all font-medium"
                  onClick={handleMarkAsConfirmed}
                  disabled={updatingStatus}
                >
                  <CheckCircle size={18} className="mr-2" />
                  {updatingStatus
                    ? t("common.updating", { defaultValue: "Updating..." })
                    : t("salesOrder.actions.markConfirmed", {
                        defaultValue: "Mark as Confirmed",
                      })}
                </button>
              )}

              {canInvoiceWithInstantAndConvert && (
                <>
                  {/* Instant Invoice - Quick create */}
                  <button
                    className="flex items-center px-4 py-2 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[var(--p-blue-dark)] shadow-sm transition-all font-medium"
                    onClick={handleInstantInvoice}
                    disabled={creatingInstantInvoice}
                  >
                    <Receipt size={18} className="mr-2" />
                    {creatingInstantInvoice
                      ? t("common.creating", { defaultValue: "Creating..." })
                      : t("salesOrder.actions.instantInvoice", {
                          defaultValue: "Instant Invoice",
                        })}
                  </button>

                  {/* Convert to Invoice - Opens invoice creation page */}
                  <button
                    className="flex items-center px-4 py-2 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[var(--p-blue-dark)] shadow-sm transition-all font-medium"
                    onClick={handleConvertToInvoice}
                    disabled={convertingToInvoice}
                  >
                    <FileText size={18} className="mr-2" />
                    {convertingToInvoice
                      ? t("common.loading", { defaultValue: "Loading..." })
                      : t("salesOrder.actions.convertToInvoice", {
                          defaultValue: "Convert to Invoice",
                        })}
                  </button>
                </>
              )}

              {/* Convert to Invoice - Draft (backend auto-confirms when opening invoice flow) */}
              {canConvertFromDraft && (
                <button
                  className="flex items-center px-4 py-2 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[var(--p-blue-dark)] shadow-sm transition-all font-medium"
                  onClick={handleConvertToInvoice}
                  disabled={convertingToInvoice}
                >
                  <FileText size={18} className="mr-2" />
                  {convertingToInvoice
                    ? t("common.loading", { defaultValue: "Loading..." })
                    : t("salesOrder.actions.convertToInvoice", {
                        defaultValue: "Convert to Invoice",
                      })}
                </button>
              )}

              <button
                className="flex items-center px-3 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all"
                title={t("documents.downloadPdf", {
                  defaultValue: "Download PDF",
                })}
                onClick={handleDownloadPDF}
                disabled={isGeneratingPdf}
              >
                <Download size={18} className="mr-2" />
                <span className="hidden sm:inline">
                  {isGeneratingPdf
                    ? t("documents.generating", {
                        defaultValue: "Generating...",
                      })
                    : t("common.download", { defaultValue: "Download" })}
                </span>
              </button>

              {canOpenJobScheduling && (
                <button
                  className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-sm transition-all font-medium disabled:opacity-70"
                  onClick={handleOpenAppointment}
                  disabled={openingAppointment || fleetAppointmentMeta.loading}
                >
                  <Calendar size={18} className="mr-2" />
                  {openingAppointment
                    ? t("salesOrder.appointment.opening", {
                        defaultValue: "Opening...",
                      })
                    : fleetAppointmentMeta.hasAssignment
                      ? t("salesOrder.appointment.view", {
                          defaultValue: "View Appointment",
                        })
                      : t("salesOrder.jobs.createJob", {
                          defaultValue: "Create Job",
                        })}
                </button>
              )}

              {/* Fulfillment menu (3-dots) */}
              <div className="relative" ref={fulfillmentMenuRef}>
                <button
                  type="button"
                  className="flex items-center px-3 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all"
                  title={t("salesOrder.fulfillment.options", {
                    defaultValue: "Fulfillment options",
                  })}
                  onClick={() => setShowFulfillmentMenu((prev) => !prev)}
                >
                  <MoreVertical size={18} />
                </button>

                {showFulfillmentMenu && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => {
                        if (isShipped) return;
                        setShowFulfillmentMenu(false);
                        openFulfillmentModal();
                      }}
                      disabled={isShipped || savingFulfillment}
                      className={`flex items-center w-full px-4 py-2.5 text-left transition-colors ${
                        isShipped || savingFulfillment
                          ? "text-gray-400 cursor-not-allowed bg-gray-50"
                          : "text-gray-700 hover:bg-orange-50 hover:text-orange-700"
                      }`}
                      title={
                        isShipped
                          ? t("salesOrder.fulfillment.partialDisabled", {
                              defaultValue:
                                "Partial fulfillment is disabled after complete fulfillment (Shipped)",
                            })
                          : t("salesOrder.fulfillment.recordPartial", {
                              defaultValue: "Record partial fulfillment",
                            })
                      }
                    >
                      <Package size={18} className="mr-3" />
                      {t("salesOrder.fulfillment.partial", {
                        defaultValue: "Partial Fulfillment",
                      })}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (isShipped) return;
                        setShowFulfillmentMenu(false);
                        openCompleteLocationModal();
                      }}
                      disabled={isShipped || completingFulfillment}
                      className={`flex items-center w-full px-4 py-2.5 text-left transition-colors ${
                        isShipped || completingFulfillment
                          ? "text-gray-400 cursor-not-allowed bg-gray-50"
                          : "text-gray-700 hover:bg-green-50 hover:text-green-700"
                      }`}
                      title={
                        isShipped
                          ? t("salesOrder.fulfillment.alreadyShipped", {
                              defaultValue: "Already shipped",
                            })
                          : t("salesOrder.fulfillment.shipRemaining", {
                              defaultValue:
                                "Mark all remaining quantities as shipped",
                            })
                      }
                    >
                      <CheckCircle size={18} className="mr-3" />
                      {completingFulfillment
                        ? t("salesOrder.fulfillment.completing", {
                            defaultValue: "Completing...",
                          })
                        : t("salesOrder.fulfillment.complete", {
                            defaultValue: "Complete Fulfillment",
                          })}
                    </button>

                    {/* Send Email Button - Below Complete Fulfillment */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowFulfillmentMenu(false);
                        history.push({
                          pathname: getModuleRoutePath("saleOrder", "emailPreview"),
                          state: {
                            salesOrderData: {
                              ...salesOrder,
                              customer_email: salesOrder?.customer?.basicInformation?.customerEmail || "",
                              customer_phone:
                                salesOrder?.customer?.basicInformation?.customerPhone?.mobile ||
                                salesOrder?.customer?.basicInformation?.customerPhone?.workPhone ||
                                salesOrder?.phone ||
                                "",
                              customer_name: salesOrder?.customer?.basicInformation?.companyName ||
                                            salesOrder?.customer?.basicInformation?.customerDisplayName ||
                                            t("common.customer", {
                                              defaultValue: "Customer",
                                            }),
                              templateId: salesOrder?.templateId || selectedTemplate,
                            },
                            isUpdate: true,
                            salesOrderId: salesOrder._id,
                            templateData: templateData || templates.find((t) => t._id === selectedTemplate),
                            // invoiceData.business is the full /business/:id payload (logo, etc.); salesOrder.business is often only minimally populated from getSalesOrderById
                            businessData:
                              invoiceData?.business ||
                              invoiceData?.business_id ||
                              salesOrder?.business,
                          },
                        });
                      }}
                      className="flex items-center w-full px-4 py-2.5 text-left transition-colors text-gray-700 hover:bg-blue-50 hover:text-blue-700 border-t border-gray-200"
                      title={t("documents.sendEmail", {
                        defaultValue: "Send Email",
                      })}
                    >
                      <Mail size={18} className="mr-3" />
                      {t("documents.sendEmail", { defaultValue: "Send Email" })}
                    </button>
                  </div>
                )}
              </div>
              </div>
            }
          />
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <StatusBadge status={salesOrder?.status} t={t} />
            <FulfillmentBadge status={salesOrder?.fulfillment_status} t={t} />
          </div>
        </div>
      </div>

      {/* Enhanced module summary - Zoho Style */}
      <div className="container mx-auto px-0 py-0">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold mb-6 text-gray-900 flex items-center">
            <TrendingUp size={20} className="mr-2 text-gray-600" />
            {t("salesOrder.summary.financialSummary", {
              defaultValue: "Financial Summary",
            })}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Module total */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-5 border border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
                  {t("salesOrder.fields.totalAmount", {
                    defaultValue: "Total Amount",
                  })}
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
                  {t("salesOrder.summary.subtotal", {
                    defaultValue: "Subtotal",
                  })}
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
                  {t("salesOrder.summary.discount", {
                    defaultValue: "Discount",
                  })}
                </h4>
                <TrendingUp size={16} className="text-orange-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrencyAmount(
                  salesOrder?.currency,
                  computeSoSummary(salesOrder || {}).discount,
                )}
              </p>
            </div>

            {/* Shipping Charges */}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-5 border border-purple-200">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-purple-700 uppercase tracking-wide">
                  {t("salesOrder.summary.shippingCharges", {
                    defaultValue: "Shipping Charges",
                  })}
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

      {salesOrder?.status && salesOrder.status !== "Draft" && (
        <div className="container mx-auto px-0 py-0 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {t("salesOrder.pickList.title", {
                    defaultValue: "Pick list — where to pick from",
                  })}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {t("salesOrder.pickList.hint", {
                    defaultValue:
                      "Warehouse, location and batch are planned when this order is confirmed (FEFO if expiry, otherwise FIFO).",
                  })}
                </p>
              </div>
              {canViewPickLists && (
                <button
                  type="button"
                  onClick={() => history.push("/pick-lists")}
                  className="px-4 py-2 text-sm font-medium text-[var(--p-blue)] border border-blue-200 rounded-lg hover:bg-blue-50"
                >
                  {t("salesOrder.pickList.openInventory", {
                    defaultValue: "Open Inventory Pick Lists",
                  })}
                </button>
              )}
            </div>
            <div className="px-6 py-4">
              {soPickListsLoading ? (
                <p className="text-sm text-gray-500">Loading pick list…</p>
              ) : soPickLists.length === 0 ? (
                <p className="text-sm text-amber-700">
                  {t("salesOrder.pickList.empty", {
                    defaultValue:
                      "No pick list yet. Confirm the order (with catalog items that have stock/composition) to generate warehouse / location / batch instructions.",
                  })}
                </p>
              ) : (
                soPickLists.map((pl) => (
                  <div key={pl._id} className="mb-4 last:mb-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2 text-sm">
                      <span className="font-mono font-semibold text-gray-900">
                        {pl.reference}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 capitalize">
                        {pl.status}
                      </span>
                      {Number(pl.summary?.totalShortQty) > 0 && (
                        <span className="text-xs text-red-600 font-medium">
                          Short: {pl.summary.totalShortQty}
                        </span>
                      )}
                    </div>
                    <div className="overflow-x-auto border rounded-lg">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                          <tr>
                            <th className="px-3 py-2">Item</th>
                            <th className="px-3 py-2 text-right">Qty</th>
                            <th className="px-3 py-2">
                              Pick from (warehouse / location / batch)
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {(pl.lines || []).map((line, li) => {
                            const itemName =
                              line.itemName ||
                              line.item?.name ||
                              line.item?.itemCode ||
                              "—";
                            const unit = line.item?.unit || line.item?.uom || "";
                            const allocs = Array.isArray(line.allocations)
                              ? line.allocations
                              : [];
                            return (
                              <tr
                                key={line._id || `${pl._id}-${li}`}
                                className="border-t align-top"
                              >
                                <td className="px-3 py-2 font-medium text-gray-900">
                                  {itemName}
                                </td>
                                <td className="px-3 py-2 text-right whitespace-nowrap">
                                  {line.requiredQty}
                                  {unit ? ` ${unit}` : ""}
                                </td>
                                <td className="px-3 py-2">
                                  {allocs.length === 0 ? (
                                    <span className="text-amber-700 text-xs">
                                      No stock allocation — short / not found
                                    </span>
                                  ) : (
                                    <ul className="space-y-1">
                                      {allocs.map((a, ai) => {
                                        const wh =
                                          a.warehouse?.name ||
                                          a.warehouse?.code ||
                                          "Warehouse";
                                        const loc =
                                          a.location?.name ||
                                          a.location?.code ||
                                          "Location";
                                        const lot = a.lotNumber
                                          ? `Batch ${a.lotNumber}`
                                          : "No batch";
                                        const exp = a.expiryDate
                                          ? formatDate(a.expiryDate)
                                          : "";
                                        return (
                                          <li
                                            key={a._id || ai}
                                            className="text-xs text-gray-700"
                                          >
                                            <span className="font-semibold text-gray-900">
                                              {a.quantity}
                                              {unit ? ` ${unit}` : ""}
                                            </span>
                                            {" → "}
                                            {wh} / {loc} / {lot}
                                            {exp ? ` (exp ${exp})` : ""}
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {(pl.warnings || []).length > 0 && (
                      <ul className="mt-2 text-xs text-amber-700 list-disc pl-5">
                        {pl.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Enhanced module details card - Zoho Style */}
      <div className="container mx-auto px-0 py-0">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-white px-8 py-6 border-b border-gray-200">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Column - Customer Info */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                  {t("salesOrder.view.customerDetails", {
                    defaultValue: "Customer Details",
                  })}
                </h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                      {t("salesOrder.fields.customerName", {
                        defaultValue: "Customer Name",
                      })}
                    </h3>
                    <p className="text-base font-medium text-gray-900">
                      {salesOrder?.customer?.basicInformation?.companyName ||
                        salesOrder?.customer?.basicInformation?.customerDisplayName ||
                        "---"}
                    </p>
                  </div>
                  {salesOrder?.billingAddress && (
                    <div>
                      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                        {t("salesOrder.addresses.typeAddress", {
                          defaultValue: "{{type}} Address",
                          type: addressTypeConfig.billingLabel,
                        })}
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
                        {t("salesOrder.addresses.typeAddress", {
                          defaultValue: "{{type}} Address",
                          type: addressTypeConfig.shippingLabel,
                        })}
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
                        {t("common.phone", { defaultValue: "Phone" })}
                      </h3>
                      <p className="text-sm text-gray-800">{salesOrder.phone}</p>
                    </div>
                  )}
                  {salesOrder?.fax && (
                    <div>
                      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                        {t("common.fax", { defaultValue: "Fax" })}
                      </h3>
                      <p className="text-sm text-gray-800">{salesOrder.fax}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column - Module Info */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                  {t("salesOrder.view.orderDetails", {
                    defaultValue: "{{label}} Details",
                    label: saleOrderLabel,
                  })}
                </h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                      {t("salesOrder.fields.orderNumberShort", {
                        defaultValue: "{{label}} No.",
                        label: saleOrderLabel,
                      })}
                    </h3>
                    <p className="text-base font-medium text-gray-900">
                      {salesOrder?.salesOrderNumber || "---"}
                    </p>
                  </div>
                  {salesOrder?.referenceNumber && (
                    <div>
                      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                        {t("salesOrder.fields.referenceNumber", {
                          defaultValue: "Reference Number",
                        })}
                      </h3>
                      <p className="text-sm text-gray-800">
                        {salesOrder.referenceNumber}
                      </p>
                    </div>
                  )}
                  <div>
                    <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                      {t("salesOrder.fields.orderDate", {
                        defaultValue: "{{label}} Date",
                        label: saleOrderLabel,
                      })}
                    </h3>
                    <p className="text-sm text-gray-800 flex items-center gap-2">
                      <Calendar size={14} className="text-gray-400" />
                      {formatDate(salesOrder?.salesOrderDate)}
                    </p>
                  </div>
                  {hasValidOrderDate(salesOrder?.expectedShipmentDate) && (
                    <div>
                      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                        {t("salesOrder.fields.expectedShipmentDate", {
                          defaultValue: "Expected Shipment Date",
                        })}
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
                        {t("salesOrder.fields.paymentTerms", {
                          defaultValue: "Payment Terms",
                        })}
                      </h3>
                      <p className="text-sm text-gray-800">{salesOrder.paymentTerms}</p>
                    </div>
                  )}
                  {salesOrder?.deliveryMethod?.name && (
                    <div>
                      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                        {t("salesOrder.fields.deliveryMethod", {
                          defaultValue: "Delivery Method",
                        })}
                      </h3>
                      <p className="text-sm text-gray-800 flex items-center gap-2">
                        <Package size={14} className="text-gray-400" />
                        {salesOrder.deliveryMethod.name}
                      </p>
                    </div>
                  )}
                  {salesOrder?.salesperson?.name && (
                    <div>
                      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                        {t("salesOrder.fields.salesperson", {
                          defaultValue: "Salesperson",
                        })}
                      </h3>
                      <p className="text-sm text-gray-800 flex items-center gap-2">
                        <User size={14} className="text-gray-400" />
                        {salesOrder.salesperson.name}
                      </p>
                    </div>
                  )}
                  {salesOrder?.business?.name && (
                    <div>
                      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                        {t("common.business", { defaultValue: "Business" })}
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

      {/* Fulfillment Summary */}
      {/* <div className="container mx-auto px-0 py-0">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-8 py-6 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Fulfillment</h2>
              <p className="text-sm text-gray-500 mt-1">
                Status: <span className="font-medium">{salesOrder?.fulfillment_status || "Not Shipped"}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={openFulfillmentModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Record Fulfillment
              </button>
            </div>
          </div>
          <div className="px-8 py-6 overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Item</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Ordered</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Fulfilled</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Remaining</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {(salesOrder?.items || []).map((it, idx) => {
                  const ordered =
                    typeof it.ordered_quantity === "number"
                      ? it.ordered_quantity
                      : typeof it.quantity === "number"
                      ? it.quantity
                      : 0;
                  const fulfilled =
                    typeof it.fulfilled_quantity === "number" ? it.fulfilled_quantity : 0;
                  const remaining = Math.max(0, ordered - fulfilled);
                  return (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{it.description}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">{formatAmount(ordered)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">{formatAmount(fulfilled)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">{formatAmount(remaining)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div> */}

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
                    <p className="text-gray-600 text-sm mb-1">
                      {t("documents.loadingPdf", {
                        defaultValue: "Loading document PDF...",
                      })}
                    </p>
                    {retryCount > 0 && (
                      <p className="text-gray-500 text-xs">
                        {t("documents.retryAttempt", {
                          defaultValue: "Retry attempt {{attempt}} of {{total}}",
                          attempt: retryCount,
                          total: 3,
                        })}
                      </p>
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
                      {t("documents.retryLoadingPdf", {
                        defaultValue: "Retry Loading PDF",
                      })}
                    </button>
                  </div>
                ) : pdfUrl ? (
                  <PdfViewerIframe
                    pdfUrl={pdfUrl}
                    title={t("documents.pdfTitle", {
                      defaultValue: "Document PDF",
                    })}
                    onError={(err) => {
                      console.error("Sales order PDF iframe error:", err);
                      setPdfError(
                        t("documents.notifications.pdfLoadConnectionFailed", {
                          defaultValue:
                            "Failed to load document PDF. Connection may have been reset.",
                        })
                      );
                      setPdfUrl("");
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-[800px]">
                    <p className="text-gray-600 text-sm">
                      {t("documents.noPdfAvailable", {
                        defaultValue: "No PDF document available",
                      })}
                    </p>
                  </div>
                )}
              </div>
            )}
            {invoiceData && !templateData && !salesOrder?.documentUrl && (
              <div className="flex flex-col items-center justify-center py-24 px-6">
                <FileText size={48} className="text-gray-300 mb-4" />
                <p className="text-gray-600 text-center">
                  {t("documents.noTemplateOrDocument", {
                    defaultValue: "No template or document available",
                  })}
                </p>
                <p className="text-gray-500 text-sm mt-1 text-center">
                  {t("salesOrder.view.generateDocumentHint", {
                    defaultValue:
                      "Download PDF from the {{label}} form to generate a document.",
                    label: saleOrderLabel.toLowerCase(),
                  })}
                </p>
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
                <span className="text-sm text-gray-600">
                  {t("documents.currentTemplate", {
                    defaultValue: "Current Template:",
                  })}
                </span>
                <span className="ml-2 font-semibold text-gray-900">
                  {templates.find((t) => (t._id || t.id) === selectedTemplate)?.name ||
                    t("salesOrder.standardTemplate", {
                      defaultValue: "Standard {{label}}",
                      label: saleOrderLabel,
                    })}
                </span>
              </div>
            </div>
            <button
              className="px-4 py-2 text-sm font-medium text-[var(--p-blue)] hover:text-[var(--p-blue-dark)] transition-colors"
              onClick={handleChangeTemplate}
            >
              {t("documents.changeTemplate", {
                defaultValue: "Change Template",
              })}
            </button>
          </div>
        </div>
      )}

      {/* Fulfillment Modal */}
      {showFulfillmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white w-full max-w-3xl rounded-xl shadow-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {t("salesOrder.fulfillment.record", {
                  defaultValue: "Record Fulfillment",
                })}
              </h3>
              <button
                type="button"
                onClick={() => setShowFulfillmentModal(false)}
                className="text-gray-500 hover:text-gray-900"
              >
                ✕
              </button>
            </div>

            <div className="p-6 max-h-[70vh] overflow-auto">
              <p className="text-xs text-gray-500 mb-4">
                Stock will be deducted automatically using FEFO when lots have
                expiry dates, otherwise FIFO (oldest stock first).
              </p>
              <div className="space-y-4">
                {fulfillmentDraft.map((row) => {
                  const remaining = Math.max(0, row.ordered - row.fulfilled);
                  return (
                    <div key={row.index} className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">{row.description}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {t("salesOrder.fulfillment.quantitySummary", {
                              defaultValue:
                                "Ordered: {{ordered}} • Fulfilled: {{fulfilled}} • Remaining: {{remaining}}",
                              ordered: row.ordered,
                              fulfilled: row.fulfilled,
                              remaining,
                            })}
                          </div>
                        </div>
                        <div className="w-40">
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            {t("salesOrder.fulfillment.newQuantity", {
                              defaultValue: "New Fulfilled Qty",
                            })}
                          </label>
                          <input
                            type="number"
                            min={row.fulfilled}
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
                {t("common.cancel", { defaultValue: "Cancel" })}
              </button>
              <button
                type="button"
                onClick={handleSaveFulfillment}
                disabled={savingFulfillment}
                className="px-4 py-2 text-sm font-medium text-white bg-[var(--p-blue)] rounded-lg hover:bg-[var(--p-blue-dark)] disabled:opacity-60"
              >
                {savingFulfillment
                  ? t("common.saving", { defaultValue: "Saving..." })
                  : t("salesOrder.fulfillment.save", {
                      defaultValue: "Save Fulfillment",
                    })}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Complete ship — stock out is automatic */}
      {showCompleteLocationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {t("salesOrder.fulfillment.completeTitle", {
                  defaultValue: "Mark as fully shipped",
                })}
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                {t("salesOrder.fulfillment.completeHintAuto", {
                  defaultValue:
                    "Remaining stock will be deducted automatically using FEFO when expiry exists, otherwise FIFO.",
                })}
              </p>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCompleteLocationModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                {t("common.cancel", { defaultValue: "Cancel" })}
              </button>
              <button
                type="button"
                onClick={handleCompleteFulfillment}
                disabled={completingFulfillment}
                className="px-4 py-2 text-sm font-medium text-white bg-[var(--p-blue)] rounded-lg disabled:opacity-60"
              >
                {completingFulfillment
                  ? t("salesOrder.fulfillment.shipping", {
                      defaultValue: "Shipping…",
                    })
                  : t("salesOrder.fulfillment.confirmShip", {
                      defaultValue: "Confirm ship",
                    })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
