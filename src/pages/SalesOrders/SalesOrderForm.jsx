import React, { useState, useEffect, useContext, useRef, useMemo, useCallback } from "react";
import {
  ArrowLeft,
  Save,
  X,
  Plus,
  UserPlus,
  Trash2,
  Upload,
  Building2,
  User,
  Calendar,
  FileText,
  ChevronDown,
  Send,
  Mail,
} from "lucide-react";
import { useHistory, useParams, useLocation } from "react-router-dom";
import axios from "axios";
import { notifyError, notifySuccess } from "@/utils/toast";
import { AdminContext } from "@/context/AdminContext";
import SalesOrderServices from "@/services/SalesOrderServices";
import QuotationServices from "@/services/QuotationServices";
import SearchableDropdown from "@/components/SearchableDropdown";
import SingleBusinessField from "@/components/SingleBusinessField";
import CustomDatePicker from "@/components/CustomDatePicker";
import { PageHeader } from "@/page-layouts/index";
import { formatAmount } from "@/components/formatAmount";
import DocumentTemplateModal from "@/pages/SalesContract/actions/DocumentTemplates";
import DocumentGenerator from "@/pages/Accounts/CustomerInvoice/DocumentGenerator";
import DocumentViewer from "@/pages/Accounts/CustomerInvoice/document-viewer";
import BulkAddItemsModal from "@/components/customer-invoices/BulkAddItemsModal";
import QuickAddCustomerModal from "@/components/customer-invoices/QuickAddCustomerModal";
import AddressModal from "@/components/AddressModal";
import CustomerBillShipAddressFields from "@/components/CustomerBillShipAddressFields";
import ZohoStyleItemTable from "@/components/invoice/ZohoStyleItemTable";
import InvoiceSummaryPanel from "@/components/invoice/InvoiceSummaryPanel";
import AddPaymentTermButton from "@/components/AddPaymentTermButton";
import { getNextDocumentNumber } from "@/services/documentSequenceServices";
import { calculateDueDate, getPaymentTermFromDueDate } from "@/utils/calculateDueDate";
import { getLineSubtotal, getItemTotal, clampDiscountPercent } from "@/utils/itemDiscountUtils";
import {
  calculateOrderDiscountPercentage,
  isSaleOrderDocumentTemplateType,
  normalizeDocumentTemplateType,
} from "@/utils/invoiceContractMapper";
import { hasPathPermission, PERMISSION_ACTION } from "@/utils/permissionUtils";
import DynamicCustomFieldsForm from "@/components/custom-fields/DynamicCustomFieldsForm";
import { useModuleLabels } from "@/context/ModuleLabelsContext";
import { useTranslation } from "react-i18next";
import {
  fetchDefinitions,
  fetchLineItemCustomFieldDefinitions,
  upsertValues,
} from "@/services/customFieldServices";
import { validateCustomFieldValues } from "@/utils/customFieldValidation";
import { shouldRenderCustomFieldAtSlot } from "@/utils/customFieldPlacement";
import {
  fetchAddressTypeConfig,
  findAddressBySystemType,
  getMissingBillShipTypesForCustomerDisplay,
  normalizeAddressOneLine,
  resolveSameAsBillingFlag,
} from "@/utils/addressTypeUtils";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

// Map Sales Order formData to invoice-style data for ZohoStyleItemTable
function soToInvoiceData(formData, baseCurrency) {
  const items = (formData.items || []).map((i) => ({
    id: i.id,
    itemId: i.itemId,
    // Do not trim here: controlled item input needs trailing spaces while typing (e.g. “Word ” before next word).
    itemName: i.itemName == null ? "" : String(i.itemName),
    description: i.description == null ? "" : String(i.description),
    quantity: parseFloat(i.quantity) || 1,
    unitPrice: parseFloat(i.rate) || 0,
    discount: parseFloat(i.discount) || 0,
    taxRate: parseFloat(i.taxRate) || 0,
    taxId: i.taxId || "",
    taxName: i.taxName || "",
    total: parseFloat(i.amount) || 0,
    unit: i.unit || "",
    lineItemCustomFields:
      i.lineItemCustomFields && typeof i.lineItemCustomFields === "object"
        ? { ...i.lineItemCustomFields }
        : {},
  }));
  return {
    items,
    subtotal: formData.subtotal || 0,
    discountPercentage:
      formData.discountPercentage ||
      calculateOrderDiscountPercentage(formData.subtotal, formData.discount),
    discountAmount: formData.discount || 0,
    shippingCharges: formData.shippingCharges || 0,
    adjustment: formData.adjustment || 0,
    total: formData.total || 0,
    currency: formData.customerCurrency || baseCurrency || "MYR",
  };
}

function calculateOrderDiscountAmount(subtotal, discountPercentage) {
  const safeSubtotal = parseFloat(subtotal) || 0;
  const safePercentage = Math.min(100, Math.max(0, parseFloat(discountPercentage) || 0));
  return (safeSubtotal * safePercentage) / 100;
}

// Map invoice-style items back to Sales Order formData items
function invoiceItemsToSo(invoiceItems) {
  return (invoiceItems || []).map((i, idx) => {
    const qty = parseFloat(i.quantity) || 0;
    const unitPrice = parseFloat(i.unitPrice) || 0;
    const discount = parseFloat(i.discount) || 0;
    const lineSub = getLineSubtotal(qty, unitPrice, discount);
    const total = parseFloat(i.total) || 0;
    const tax = total - lineSub;
    const rowName = i.itemName == null ? "" : String(i.itemName);
    const rowDesc = i.description == null ? "" : String(i.description);
    return {
      id: i.id || idx + 1,
      itemId: i.itemId,
      itemName: rowName,
      description: rowDesc,
      quantity: qty,
      rate: unitPrice,
      tax,
      taxRate: parseFloat(i.taxRate) || 0,
      taxId: i.taxId,
      taxName: i.taxName,
      discount,
      amount: total,
      lineItemCustomFields:
        i.lineItemCustomFields && typeof i.lineItemCustomFields === "object"
          ? { ...i.lineItemCustomFields }
          : {},
    };
  });
}

/** PUT /sales-orders/:id historically returned only `{ data }` without `success`; treat 2xx + data as OK. */
function isSalesOrderSaveResponseOk(response) {
  const body = response?.data;
  if (!body || typeof body !== "object" || body.success === false) return false;
  if (body.success === true) return true;
  const status = response?.status ?? 0;
  return status >= 200 && status < 300 && body.data != null;
}

function computeSalesOrderItem(item) {
  const quantity = parseFloat(item?.quantity) || 0;
  const rate = parseFloat(item?.rate) || 0;
  const discount = clampDiscountPercent(item?.discount);
  const lineSubtotal = getLineSubtotal(quantity, rate, discount);
  const taxRate = parseFloat(item?.taxRate) || 0;
  const taxAmount =
    taxRate > 0
      ? (lineSubtotal * taxRate) / 100
      : parseFloat(item?.tax) || 0;
  const amount = Math.max(0, lineSubtotal + taxAmount);

  return {
    quantity,
    rate,
    discount,
    taxRate,
    taxAmount,
    lineSubtotal,
    amount,
  };
}

function computeSalesOrderTotals(items = [], orderDiscount = 0, shippingCharges = 0, adjustment = 0) {
  const computed = (items || []).map(computeSalesOrderItem);
  const preTaxSubtotal = computed.reduce((sum, row) => sum + row.lineSubtotal, 0);
  const subtotal = computed.reduce((sum, row) => sum + row.amount, 0);
  const taxTotal = computed.reduce((sum, row) => sum + row.taxAmount, 0);
  const total =
    subtotal -
    (parseFloat(orderDiscount) || 0) +
    (parseFloat(shippingCharges) || 0) +
    (parseFloat(adjustment) || 0);

  return {
    computedItems: computed,
    subtotal,
    preTaxSubtotal,
    lineItemsSubtotal: subtotal,
    taxTotal,
    total: Math.max(0, total),
  };
}

export default function SalesOrderForm() {
  const { t } = useTranslation();
  const { getModuleLabel, getModuleRoutePath } = useModuleLabels();
  const configuredSaleOrderLabel = getModuleLabel("saleOrder", "Sale Order");
  const saleOrderLabel =
    configuredSaleOrderLabel === "Sale Order"
      ? t("salesOrder.label", { defaultValue: "Sale Order" })
      : configuredSaleOrderLabel;
  const saleOrderListPath = getModuleRoutePath("saleOrder", "list");
  const history = useHistory();
  const location = useLocation();
  const { id } = useParams();
  // Check if we're in view mode (shouldn't happen since we have separate component, but just in case)
  const isViewMode = location.pathname.includes("/view/");
  const isEditMode = !!id && !isViewMode;
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo.token}`,
  };

  const [loading, setLoading] = useState(false);
  const [businesses, setBusinesses] = useState([]);
  const [businessData, setBusinessData] = useState(null); // Full business data for document generation
  const [docNumMissing, setDocNumMissing] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [businessItems, setBusinessItems] = useState([]);
  const [taxes, setTaxes] = useState([]);
  const [deliveryMethods, setDeliveryMethods] = useState([]);
  const [salespersons, setSalespersons] = useState([]);
  const [paymentTerms, setPaymentTerms] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [DocumentData, setDocumentData] = useState({});
  const documentSnapshotRef = useRef(null);
  const fromQuotationHydratedKeyRef = useRef(null);
  const fromQuotationIdForLinkRef = useRef(null);
  const originalDocumentStateRef = useRef(null); // Store original document state to restore if user changes back
  const fileInputRef = useRef(null);
  const [showBulkAddItemsModal, setShowBulkAddItemsModal] = useState(false);
  const [showQuickAddCustomer, setShowQuickAddCustomer] = useState(false);
  const [sameAsBilling, setSameAsBilling] = useState(false);
  const lastDistinctShippingAddressRef = useRef(""); // Preserve shipping when "same as billing" is checked
  const [termsAndConditionsList, setTermsAndConditionsList] = useState([]);
  const [addTermsModalOpen, setAddTermsModalOpen] = useState(false);
  const [newTermName, setNewTermName] = useState("");
  const [newTermContent, setNewTermContent] = useState("");
  const [savingNewTerm, setSavingNewTerm] = useState(false);
  const [termsDropdownOpen, setTermsDropdownOpen] = useState(false);
  const termsDropdownRef = useRef(null);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [addressModalType, setAddressModalType] = useState("Billing");
  const [editingAddress, setEditingAddress] = useState(null);
  const [addressTypeConfig, setAddressTypeConfig] = useState({
    billingLabel: t("common.billing", { defaultValue: "Billing" }),
    shippingLabel: t("common.shipping", { defaultValue: "Shipping" }),
  });
  const [customFieldValues, setCustomFieldValues] = useState({});
  const [lineItemCustomFieldDefs, setLineItemCustomFieldDefs] = useState([]);
  const [salesOrderFieldDefinitions, setSalesOrderFieldDefinitions] = useState(
    [],
  );
  const roleModules = adminInfo?.role?.modules || [];
  const canCreateLinkedJob = hasPathPermission(
    roleModules,
    "/jobs",
    PERMISSION_ACTION.ADD,
  );
  const [createLinkedJob, setCreateLinkedJob] = useState(true);

  const [formData, setFormData] = useState({
    business: "",
    customer: "",
    salesOrderNumber: "",
    referenceNumber: "",
    salesOrderDate: new Date().toISOString().split("T")[0],
    expectedShipmentDate: "",
    paymentTerms: "",
    dueDate: "",
    deliveryMethod: "",
    salesperson: "",
    billingAddress: "",
    shippingAddress: "",
    phone: "",
    fax: "",
    customerCurrency: "",
    items: [
      {
        id: 1,
        description: "",
        quantity: 1,
        rate: 0,
        tax: 0,
        amount: 0,
        lineItemCustomFields: {},
      },
    ],
    customerNotes: "",
    termsAndConditions: "",
    subtotal: 0,
    discountPercentage: 0,
    discount: 0,
    tax: 0,
    shippingCharges: 0,
    adjustment: 0,
    total: 0,
    status: "Draft",
  });

  // Business base currency; used as fallback when customer currency is missing.
  const [baseCurrency, setBaseCurrency] = useState("MYR");

  useEffect(() => {
    const quoteData = location.state?.fromQuotationData;
    const qid = location.state?.fromQuotationId;
    if (!quoteData && !qid) return;

    const key = quoteData?._id ? String(quoteData._id) : String(qid);
    if (fromQuotationHydratedKeyRef.current === key) return;

    const toYmd = (d) => {
      if (!d) return "";
      const dt = new Date(d);
      if (Number.isNaN(dt.getTime())) return "";
      return dt.toISOString().slice(0, 10);
    };

    const mapQuoteItemToSo = (item, idx) => {
      const qty = Number(item.quantity) || 0;
      const rate = Number(item.unitPrice ?? item.rate) || 0;
      const discount = Math.min(100, Math.max(0, Number(item.discount) || 0));
      const lineSub = getLineSubtotal(qty, rate, discount);
      const taxRate = Number(item.taxRate) || 0;
      const taxAmount = taxRate > 0 ? (lineSub * taxRate) / 100 : 0;
      const amount =
        Number(item.totalValue ?? item.amount) || Math.max(0, lineSub + taxAmount);
      const hasLabel =
        String(item.description || item.itemName || item.title || "").trim() ||
        item.itemId;
      if (!hasLabel || qty <= 0) return null;
      return {
        id: item._id || item.id || idx + 1,
        itemId: item.itemId?._id || item.itemId || "",
        itemName: String(item.itemName || item.title || item.name || "").trim(),
        description: String(item.description ?? "").trim(),
        quantity: qty,
        rate,
        tax: taxAmount,
        taxRate,
        taxId: item.taxId?._id || item.taxId || "",
        taxName: item.taxName || "",
        discount,
        amount,
        lineItemCustomFields: item.lineItemCustomFields || {},
      };
    };

    const applyQuote = (quote) => {
      fromQuotationHydratedKeyRef.current = key;
      fromQuotationIdForLinkRef.current = quote?._id ? String(quote._id) : null;

      const bizId = String(quote.business_id?._id || quote.business_id || "");
      const custObj =
        quote.customer_id && typeof quote.customer_id === "object"
          ? quote.customer_id
          : null;
      const custId = custObj?._id
        ? String(custObj._id)
        : String(quote.customer_id || "");

      const resolvedSameAs = resolveSameAsBillingFlag(
        quote.sameAsBilling,
        quote.billingAddress,
        quote.shippingAddress,
      );
      setSameAsBilling(resolvedSameAs);

      const rawItems = (quote.items || []).map(mapQuoteItemToSo).filter(Boolean);
      const lines = rawItems.length ? rawItems : null;

      setFormData((prev) => ({
        ...prev,
        business: bizId || prev.business,
        customer: custId || prev.customer,
        referenceNumber: quote.quote_number || prev.referenceNumber,
        salesOrderDate: toYmd(quote.quote_date) || prev.salesOrderDate,
        expectedShipmentDate: toYmd(quote.expiry_date) || prev.expectedShipmentDate,
        paymentTerms: quote.terms ? String(quote.terms).trim() : prev.paymentTerms,
        billingAddress: (quote.billingAddress || "").replace(/\n/g, ", "),
        shippingAddress: resolvedSameAs
          ? (quote.billingAddress || "").replace(/\n/g, ", ")
          : (quote.shippingAddress || "").replace(/\n/g, ", "),
        customerNotes: quote.customerNotes ?? prev.customerNotes,
        termsAndConditions: quote.termsAndConditions ?? prev.termsAndConditions,
        customerCurrency: quote.currency || prev.customerCurrency,
        discountPercentage: Number(quote.discount) || 0,
        shippingCharges: Number(quote.shippingCharges) || 0,
        adjustment: Number(quote.adjustment) || 0,
        ...(lines ? { items: lines } : {}),
      }));

      if (custObj) setSelectedCustomer(custObj);
      else if (custId) {
        axios
          .get(`${Base_URL}/customers/${custId}`, { headers })
          .then((r) => setSelectedCustomer(r.data))
          .catch(() => {});
      }
    };

    if (quoteData) {
      applyQuote(quoteData);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await QuotationServices.getQuotationById(qid);
        const quote = res.data?.data;
        if (cancelled || !quote) return;
        applyQuote(quote);
      } catch (err) {
        notifyError(
          err.response?.data?.message ||
            t("salesOrder.notifications.quotationLoadFailed", {
              defaultValue: "Could not load quotation for sale order.",
            }),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [location.state?.fromQuotationData, location.state?.fromQuotationId, headers]);

  useEffect(() => {
    const loadAddressTypes = async () => {
      const businessId = formData.business || businessData?._id;
      const config = await fetchAddressTypeConfig(businessId, headers);
      setAddressTypeConfig(config);
    };
    loadAddressTypes();
  }, [formData.business, businessData?._id]);

  const salesOrderBusinessId = useMemo(() => {
    const b = formData.business;
    if (!b) return "";
    return typeof b === "object" ? b._id || "" : b;
  }, [formData.business]);

  useEffect(() => {
    if (!salesOrderBusinessId) {
      setLineItemCustomFieldDefs([]);
      setSalesOrderFieldDefinitions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [lineDefs, docDefs] = await Promise.all([
          fetchLineItemCustomFieldDefinitions(
            { businessId: salesOrderBusinessId, transactionContext: "sales:sales_order" },
            headers,
          ),
          fetchDefinitions(
            {
              businessId: salesOrderBusinessId,
              module: "sales",
              screen: "sales_order",
            },
            headers,
          ),
        ]);
        if (!cancelled) {
          setLineItemCustomFieldDefs(lineDefs || []);
          setSalesOrderFieldDefinitions(docDefs || []);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setLineItemCustomFieldDefs([]);
          setSalesOrderFieldDefinitions([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [salesOrderBusinessId, adminInfo?.token]);

  // Invoice-style data for ZohoStyleItemTable (derived from formData)
  const invoiceDataForTable = useMemo(
    () => soToInvoiceData(formData, baseCurrency),
    [
      formData.items,
      formData.subtotal,
      formData.discount,
      formData.discountPercentage,
      formData.shippingCharges,
      formData.adjustment,
      formData.total,
      formData.customerCurrency,
      baseCurrency,
    ]
  );

  // Support both setInvoiceData(updated) and setInvoiceData(prev => updated) so tax dropdown etc. work.
  // Only sync items; subtotal/tax/grand total are recalculated by the useEffect from formData.items (and formData.tax, discount, etc.).
  const setInvoiceDataFromTable = (arg) => {
    setFormData((prevFormData) => {
      const prevInvoice = soToInvoiceData(prevFormData, baseCurrency);
      const updated = typeof arg === "function" ? arg(prevInvoice) : arg;
      if (!updated || !Array.isArray(updated.items)) return prevFormData;
      return {
        ...prevFormData,
        items: invoiceItemsToSo(updated.items),
      };
    });
  };

  /** Same pattern as CreateCustomerInvoice: per-field updates avoid form↔invoice round-trip on every keystroke (fixes line typing / spaces). */
  const handleZohoLineItemChange = useCallback((index, field, value) => {
    if (
      field === "lineItemCustomFields" &&
      value &&
      typeof value === "object" &&
      Object.prototype.hasOwnProperty.call(value, "key")
    ) {
      setFormData((prev) => {
        const items = [...(prev.items || [])];
        const row = { ...(items[index] || {}) };
        const cfKey = value.key;
        const cfVal = value.value;
        row.lineItemCustomFields = {
          ...(row.lineItemCustomFields || {}),
          [cfKey]: cfVal,
        };
        items[index] = row;
        return { ...prev, items };
      });
      return;
    }

    setFormData((prev) => {
      const items = [...(prev.items || [])];
      const row = { ...(items[index] || {}) };

      if (field === "unitPrice") {
        const n = parseFloat(value) || 0;
        row.rate = n < 0 ? 0 : n;
      } else if (field === "quantity") {
        const n = parseFloat(value) || 0;
        row.quantity = n < 0 ? 0 : n;
      } else if (field === "discount") {
        row.discount = clampDiscountPercent(value);
      } else if (field === "taxRate") {
        let n = parseFloat(value);
        if (Number.isNaN(n)) n = 0;
        if (n < 0) n = 0;
        if (n > 100) n = 100;
        row.taxRate = n;
      } else {
        row[field] = value;
      }

      const c = computeSalesOrderItem(row);
      items[index] = {
        ...row,
        quantity: c.quantity,
        rate: c.rate,
        discount: c.discount,
        taxRate: c.taxRate,
        tax: c.taxAmount,
        amount: c.amount,
      };
      return { ...prev, items };
    });
  }, []);

  // Fetch business base currency for fallback logic
  useEffect(() => {
    const fetchBaseCurrency = async () => {
      if (!formData.business) return;
      try {
        const currencyResponse = await axios.get(
          `${Base_URL}/finance/currencies`,
          { params: { business_id: formData.business } }
        );
        const currencies = currencyResponse?.data?.data || [];
        const base = currencies.find((c) => c.is_base === true);
        const currencySymbol =
          base?.symbol || base?.prefix || base?.name || "MYR";
        setBaseCurrency(currencySymbol);
      } catch (e) {
        console.error("Error fetching base currency:", e);
        setBaseCurrency("MYR");
      }
    };

    fetchBaseCurrency();
  }, [formData.business, Base_URL]);

  // Handle bulk add items (merge by itemId: same product increases quantity, different product adds new row)
  const handleBulkAddItems = (newItems) => {
    if (!newItems || newItems.length === 0) return;

    const formatted = newItems.map((item) => {
      const quantity = Number(item.quantity) || 1;
      const rate = Number(item.unitPrice) || 0;
      const discount = Number(item.discount) || 0;
      const taxRate = Number(item.taxRate) || 0;
      const taxId = item.taxId || item?.taxOnItem?._id || "";
      const lineSubtotal = getLineSubtotal(quantity, rate, discount);
      const taxAmount = taxRate > 0 ? (lineSubtotal * taxRate) / 100 : 0;
      const amount = Math.max(0, lineSubtotal + taxAmount);
      return {
        id: Date.now() + Math.random(),
        itemId: item.itemId || "",
        itemName: (item.itemName || "").trim(),
        description: item.description || "",
        quantity,
        rate,
        tax: taxAmount,
        discount,
        amount,
        taxRate,
        taxId,
        taxName: item.taxName || "",
        unit: item.unit || "",
        itemType: item.itemType || "",
        lineItemCustomFields:
          item.lineItemCustomFields && typeof item.lineItemCustomFields === "object"
            ? { ...item.lineItemCustomFields }
            : {},
      };
    });

    const existingItems = formData.items || [];
    const merged = [...existingItems];

    for (const newItem of formatted) {
      const itemId = newItem.itemId;
      if (!itemId) {
        merged.push(newItem);
        continue;
      }
      const existingIndex = merged.findIndex(
        (it) => String(it.itemId) === String(itemId)
      );
      if (existingIndex >= 0) {
        const existing = merged[existingIndex];
        const existingQty = parseFloat(existing.quantity) || 1;
        const addQty = parseFloat(newItem.quantity) || 1;
        const newQty = existingQty + addQty;
        const rate = parseFloat(existing.rate) || 0;
        const discount = parseFloat(existing.discount) || 0;
        const hadLineTax =
          (parseFloat(existing.taxRate) || 0) > 0 || Boolean(existing.taxId);
        const taxRate = hadLineTax
          ? parseFloat(existing.taxRate) || 0
          : parseFloat(newItem.taxRate) || 0;
        const taxId = hadLineTax
          ? (existing.taxId || "")
          : (newItem.taxId || "");
        const taxName = hadLineTax
          ? (existing.taxName || "")
          : (newItem.taxName || "");
        const newTaxAmount =
          taxRate > 0
            ? (getLineSubtotal(newQty, rate, discount) * taxRate) / 100
            : 0;
        merged[existingIndex] = {
          ...existing,
          quantity: newQty,
          tax: newTaxAmount,
          taxRate,
          taxId,
          taxName,
          amount: getItemTotal(newQty, rate, discount, taxRate),
        };
      } else {
        merged.push(newItem);
      }
    }

    setFormData((prev) => ({
      ...prev,
      items: merged,
    }));

    notifySuccess(
      t("salesOrder.notifications.itemsAdded", {
        defaultValue: "{{count}} item(s) added successfully",
        count: newItems.length,
      })
    );
  };

  const [formErrors, setFormErrors] = useState({});

  // Fetch assigned businesses for the logged-in user (not all businesses)
  useEffect(() => {
    const fetchBusinesses = async () => {
      if (!adminInfo?.id) return;
      try {
        const response = await axios.get(
          `${Base_URL}/admin/assigned/${adminInfo.id}`,
          { headers }
        );
        const businessesList = response.data?.businesses || [];
        setBusinesses(businessesList);

        if (businessesList.length > 0) {
          localStorage.setItem("businesses", JSON.stringify(businessesList));
          // Auto-select first assigned business by default on create
          if (!isEditMode && !formData.business) {
            setFormData((prev) => ({
              ...prev,
              business: businessesList[0]._id,
            }));
          }
        }
      } catch (error) {
        console.error("Error fetching assigned businesses:", error);
        notifyError(
          t("salesOrder.notifications.businessesLoadFailed", {
            defaultValue: "Failed to load businesses",
          })
        );
      }
    };

    fetchBusinesses();
  }, [adminInfo?.id]);

  // Preview next SO number without incrementing — fires after businessData is loaded
  useEffect(() => {
    if (!businessData?._id || isEditMode) return;

    const fetchPreview = async () => {
      const businessGroupId = businessData.businessGroup?._id || businessData.businessGroup;
      try {
        const res = await getNextDocumentNumber("sales_order", businessData._id, businessGroupId);
        setFormData((prev) => ({
          ...prev,
          salesOrderNumber: res.data?.nextNumber,
        }));
        setDocNumMissing(res.data?.isFallback === true);
      } catch (err) {
        console.error("Error fetching SO number preview:", err);
      }
    };

    fetchPreview();
  }, [businessData?._id, isEditMode]);

  // Fetch full business data for document generation (similar to CreateCustomerInvoice)
  useEffect(() => {
    const fetchBusinessData = async () => {
      if (!formData.business) {
        setBusinessData(null);
        return;
      }

      try {
        const response = await axios.get(
          `${Base_URL}/business/${formData.business}`,
          { headers }
        );
        if (response.data?.data) {
          const business = response.data.data;
          setBusinessData(business);
          // Auto-populate terms & conditions from business if form doesn't have custom terms
          if (business?.termsAndConditions && !formData.termsAndConditions) {
            setFormData((prev) => ({
              ...prev,
              termsAndConditions: business.termsAndConditions,
            }));
          }
        }
      } catch (error) {
        console.error("Error fetching business data:", error);
        setBusinessData(null);
      }
    };

    fetchBusinessData();
  }, [formData.business]);

  // Fetch customers when business is selected
  useEffect(() => {
    const fetchCustomers = async () => {
      if (!formData.business) {
        setCustomers([]);
        return;
      }

      try {
        const customerResponse = await axios.get(`${Base_URL}/customers`, {
          headers,
          params: {
            businessId: formData.business,
            limit: 9999,
          },
        });
        
        if (customerResponse.data.customers || customerResponse.data) {
          setCustomers(customerResponse.data.customers || customerResponse.data || []);
        }
      } catch (error) {
        console.error("Error fetching customers:", error);
        setCustomers([]);
      }
    };

    fetchCustomers();
  }, [formData.business]);

  // Fetch items when business is selected
  useEffect(() => {
    const fetchItems = async () => {
      if (!formData.business) {
        setBusinessItems([]);
        return;
      }

      try {
        const response = await axios.get(`${Base_URL}/items`, {
          headers,
          params: {
            businessId: formData.business,
            status: "Active",
          },
        });

        // Handle both paginated and non-paginated responses
        if (response?.data?.items && Array.isArray(response?.data?.items)) {
          setBusinessItems(response.data.items || []);
        } else if (Array.isArray(response?.data)) {
          setBusinessItems(response.data || []);
        } else {
          setBusinessItems([]);
        }
      } catch (error) {
        console.error("Error fetching items:", error);
        setBusinessItems([]);
      }
    };

    fetchItems();
  }, [formData.business]);

  // Load taxes (Accounts > Taxes) when business is selected
  useEffect(() => {
    if (!formData.business) {
      setTaxes([]);
      return;
    }
    axios.get(`${Base_URL}/taxes?business=${formData.business}`, { headers }).then((res) => setTaxes(res.data || [])).catch(() => setTaxes([]));
  }, [formData.business]);

  // Backfill missing taxId on existing sales order rows (older data may only have taxRate/taxName).
  useEffect(() => {
    if (!Array.isArray(taxes) || taxes.length === 0) return;

    setFormData((prev) => {
      const prevItems = Array.isArray(prev.items) ? prev.items : [];
      let changed = false;

      const mappedItems = prevItems.map((item) => {
        if (item?.taxId) return item;

        const itemTaxRate = parseFloat(item?.taxRate) || 0;
        const itemTaxName = (item?.taxName || "").trim().toLowerCase();
        if (!itemTaxRate && !itemTaxName) return item;

        const match =
          taxes.find(
            (tax) =>
              itemTaxName &&
              String(tax?.name || "").trim().toLowerCase() === itemTaxName
          ) ||
          taxes.find((tax) => (parseFloat(tax?.rate) || 0) === itemTaxRate);

        if (!match?._id) return item;
        changed = true;
        return {
          ...item,
          taxId: match._id,
          taxName: item.taxName || match.name || "",
          taxRate: itemTaxRate || (parseFloat(match.rate) || 0),
        };
      });

      return changed ? { ...prev, items: mappedItems } : prev;
    });
  }, [taxes, formData.items]);

  // Fetch delivery methods, salespersons, and payment terms when business is selected
  useEffect(() => {
    const fetchSettingsData = async () => {
      if (!formData.business) {
        setDeliveryMethods([]);
        setSalespersons([]);
        setPaymentTerms([]);
        return;
      }

      try {
        // Fetch active Payment Terms only
        const paymentTermsResponse = await axios.post(
          `${Base_URL}/items/Payment Terms/get_all`,
          {
            business_id: formData.business,
            FilterStatus: "active",
            FilterName: "",
          },
          { headers }
        );
        if (paymentTermsResponse.data.success) {
          setPaymentTerms(paymentTermsResponse.data.data || []);
        } else {
          setPaymentTerms([]);
        }

        // Fetch Delivery Methods
        const deliveryResponse = await SalesOrderServices.getDeliveryMethods(
          formData.business,
          headers
        );
        if (deliveryResponse.data.success) {
          setDeliveryMethods(deliveryResponse.data.data || []);
        } else {
          setDeliveryMethods([]);
        }

        // Fetch Salespersons from staff flagged as sales person
        let activeSalesStaff = [];
        try {
          const salespersonResponse = await SalesOrderServices.getSalespersons(
            formData.business,
            headers
          );
          activeSalesStaff = Array.isArray(salespersonResponse?.data?.staffList)
            ? salespersonResponse.data.staffList
            : [];
        } catch (salesErr) {
          console.warn("Unable to fetch sales staff list:", salesErr);
          activeSalesStaff = [];
        }

        // Keep logged-in user's staff profile available by default in Sales Order.
        let currentUserStaff = null;
        const currentUserId = adminInfo?.id || adminInfo?._id;
        if (currentUserId) {
          try {
            const currentStaffRes = await axios.get(`${Base_URL}/staff-management`, {
              headers,
              params: { business: formData.business, id: currentUserId, page: 1, limit: 1 },
            });
            currentUserStaff = currentStaffRes?.data?.staffList?.[0] || null;
          } catch (selfErr) {
            console.warn("Unable to fetch current user's staff profile:", selfErr);
          }
        }

        let mergedSalesStaff = [...activeSalesStaff];
        if (currentUserStaff?._id) {
          const currentUserStaffId = String(currentUserStaff._id);
          const existingIndex = mergedSalesStaff.findIndex(
            (staff) => String(staff._id) === currentUserStaffId
          );

          if (existingIndex >= 0) {
            // Keep selectable list intact, but mark and prioritize current user at top.
            const tagged = {
              ...mergedSalesStaff[existingIndex],
              _id: String(mergedSalesStaff[existingIndex]._id),
              isDefaultCurrentUser: true,
            };
            mergedSalesStaff.splice(existingIndex, 1);
            mergedSalesStaff.unshift(tagged);
          } else {
            mergedSalesStaff.unshift({
              _id: String(currentUserStaff._id),
              displayName:
                currentUserStaff.displayName ||
                currentUserStaff.fullName ||
                t("common.currentUser", { defaultValue: "Current User" }),
              isDefaultCurrentUser: true,
            });
          }
        } else if (currentUserId) {
          const standaloneIndex = mergedSalesStaff.findIndex(
            (staff) =>
              String(staff._id) === String(currentUserId) ||
              String(staff.systemUserId) === String(currentUserId)
          );
          if (standaloneIndex >= 0) {
            const tagged = {
              ...mergedSalesStaff[standaloneIndex],
              _id: String(mergedSalesStaff[standaloneIndex]._id),
              isDefaultCurrentUser: true,
            };
            mergedSalesStaff.splice(standaloneIndex, 1);
            mergedSalesStaff.unshift(tagged);
          }
        }
        setSalespersons(mergedSalesStaff);

        if (!isEditMode && !formData.salesperson && mergedSalesStaff.length > 0) {
          const preferredStaff =
            mergedSalesStaff.find((staff) => staff.isDefaultCurrentUser) ||
            mergedSalesStaff[0];
          if (preferredStaff?._id) {
            setFormData((prev) => ({
              ...prev,
              salesperson: String(preferredStaff._id),
            }));
          }
        }
      } catch (error) {
        console.error("Error fetching settings data:", error);
        setDeliveryMethods([]);
        setSalespersons([]);
        setPaymentTerms([]);
      }
    };

    fetchSettingsData();
  }, [formData.business, adminInfo?.id, adminInfo?._id, isEditMode]);

  // Fetch Terms and Conditions from Settings > Sales > Misc. Data Types (same as Customer Invoice)
  useEffect(() => {
    const fetchTermsAndConditions = async () => {
      if (!formData.business) {
        setTermsAndConditionsList([]);
        return;
      }
      try {
        const res = await axios.post(
          `${Base_URL}/items/Terms and Conditions/get_all`,
          { business_id: formData.business, FilterStatus: "active", FilterName: "" },
          { headers }
        );
        setTermsAndConditionsList(res.data?.success ? res.data.data || [] : []);
      } catch (err) {
        console.error("Error fetching terms and conditions:", err);
        setTermsAndConditionsList([]);
      }
    };
    fetchTermsAndConditions();
  }, [formData.business]);

  const selectedTermsValue = useMemo(() => {
    const content = (formData.termsAndConditions || "").trim();
    if (businessData?.termsAndConditions && content === (businessData.termsAndConditions || "").trim()) return "__default__";
    const fromSettings = termsAndConditionsList.find((t) => (t.content || "").trim() === content);
    if (fromSettings) return `item_${fromSettings._id}`;
    const tIdx = (businessData?.termsTemplates || []).findIndex((t) => (t.content || "").trim() === content);
    if (tIdx >= 0) return `tpl_${tIdx}`;
    return "";
  }, [formData.termsAndConditions, businessData, termsAndConditionsList]);

  const selectedTermsLabel = useMemo(() => {
    if (!selectedTermsValue) return null;
    if (selectedTermsValue === "__default__")
      return t("common.default", { defaultValue: "Default" });
    if (selectedTermsValue.startsWith("item_")) {
      const id = selectedTermsValue.replace("item_", "");
      const selectedTerm = termsAndConditionsList.find((x) => x._id === id);
      return (
        selectedTerm?.name ||
        t("documents.terms", { defaultValue: "Terms" })
      );
    }
    if (selectedTermsValue.startsWith("tpl_")) {
      const idx = parseInt(selectedTermsValue.replace("tpl_", ""), 10);
      const selectedTerm = (businessData?.termsTemplates || [])[idx];
      return (
        selectedTerm?.name ||
        t("documents.termsNumber", {
          defaultValue: "Terms {{number}}",
          number: idx + 1,
        })
      );
    }
    return null;
  }, [selectedTermsValue, termsAndConditionsList, businessData?.termsTemplates, t]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (termsDropdownRef.current && !termsDropdownRef.current.contains(e.target)) {
        setTermsDropdownOpen(false);
      }
    };
    if (termsDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [termsDropdownOpen]);

  const handleTermsSelect = React.useCallback((v) => {
    setTermsDropdownOpen(false);
    if (v === "") {
      setFormData((prev) => ({ ...prev, termsAndConditions: "" }));
      return;
    }
    if (v === "__default__" && businessData?.termsAndConditions) {
      setFormData((prev) => ({ ...prev, termsAndConditions: businessData.termsAndConditions }));
      return;
    }
    if (v.startsWith("item_")) {
      const id = v.replace("item_", "");
      const item = termsAndConditionsList.find((t) => t._id === id);
      if (item) setFormData((prev) => ({ ...prev, termsAndConditions: item.content || "" }));
      return;
    }
    if (v.startsWith("tpl_")) {
      const idx = parseInt(v.replace("tpl_", ""), 10);
      const templates = businessData?.termsTemplates || [];
      if (Number.isFinite(idx) && templates[idx])
        setFormData((prev) => ({ ...prev, termsAndConditions: templates[idx].content || "" }));
    }
    if (v === "__add_new__") {
      setAddTermsModalOpen(true);
    }
  }, [businessData, termsAndConditionsList]);

  // Auto-calculate due date when payment term or sales order date changes (uses Number of Days from term when available)
  // Skip when payment term is Custom/Manual so manual due date is not overwritten
  useEffect(() => {
    const termsName = (formData.paymentTerms || "").trim();
    if (
      termsName === "Custom" ||
      termsName === "Manual" ||
      !formData.paymentTerms ||
      !formData.salesOrderDate
    ) {
      return;
    }
    const selectedTerm = paymentTerms.find((t) => t.name === formData.paymentTerms);
    const calculatedDueDate = calculateDueDate(
      selectedTerm || formData.paymentTerms,
      formData.salesOrderDate
    );
    if (calculatedDueDate && calculatedDueDate !== formData.dueDate) {
      setFormData((prev) => ({
        ...prev,
        dueDate: calculatedDueDate,
      }));
    }
  }, [formData.paymentTerms, formData.salesOrderDate, paymentTerms]);

  // Fetch sales order data if editing
  useEffect(() => {
    const fetchSalesOrder = async () => {
      if (!isEditMode || !id) return;

      try {
        setLoading(true);
        const response = await SalesOrderServices.getSalesOrderById(id, headers);
        if (response.data.success) {
          const orderData = response.data.data;
          // If this sales order already has a generated document, load its full data
          try {
            // Determine document id from possible fields on orderData (including documentUrl)
            const possibleDocIds = [
              orderData?.documentUrl,
              orderData?.documentId,
              orderData?.document && orderData.document._id,
              orderData?.document,
            ].filter(Boolean);
            const docId = possibleDocIds.length > 0 ? possibleDocIds[0] : null;
            if (docId) {
              const docResp = await axios.get(`${Base_URL}/documents/getFileWithAllData/${docId}`, { headers });
              if (docResp && docResp.data && docResp.data.data) {
                const docData = docResp.data.data;
                setDocumentData(docData);
                const tid = docData.templateId || (docData.template && (docData.template._id || docData.template.id));
                if (tid) {
                  const tidStr = typeof tid === "object" && tid.toString ? tid.toString() : String(tid);
                  setSelectedTemplateId(tidStr);
                  // If templates already loaded, set selectedTemplate object too
                  const match = (templates || []).find((t) => String(t._id || t.id) === String(tidStr));
                  if (match) setSelectedTemplate(match);
                  // Store original document state to restore if user changes back to original values
                  originalDocumentStateRef.current = {
                    documentData: docData,
                    templateId: tidStr,
                    template: match || null,
                  };
                }
              }
            }
          } catch (docErr) {
            // ignore document load errors silently; form should still function
            console.warn("Could not load related document data for sales order edit", docErr);
          }
          // Normalize potentially different backend field names (older/newer APIs)
          const salesOrderDateRaw =
            orderData.salesOrderDate ||
            orderData.sales_order_date ||
            orderData.orderDate ||
            orderData.date ||
            orderData.createdAt ||
            "";
          const salesOrderDateStr = salesOrderDateRaw
            ? new Date(salesOrderDateRaw).toISOString().split("T")[0]
            : "";

          const paymentTermsRaw = orderData.paymentTerms ?? orderData.payment_terms ?? "";
          const paymentTermsStr =
            typeof paymentTermsRaw === "object" && paymentTermsRaw
              ? (paymentTermsRaw.name || paymentTermsRaw.value || paymentTermsRaw.label || "")
              : (paymentTermsRaw || "");
          
          // Calculate due date if payment terms and order date exist
          let dueDateStr = "";
          const dueDateRaw = orderData.dueDate || orderData.due_date || "";
          if (dueDateRaw) {
            // If dueDate exists in backend, use it
            dueDateStr = new Date(dueDateRaw).toISOString().split("T")[0];
          } else if (paymentTermsStr && salesOrderDateStr) {
            // Otherwise calculate from payment terms
            dueDateStr = calculateDueDate(paymentTermsStr, salesOrderDateStr) || "";
          }
          
          // Ensure business and customer fields are IDs (not objects) so downstream fetches work
          const businessId = orderData.business && typeof orderData.business === "object"
            ? (orderData.business._id || orderData.business.id || String(orderData.business))
            : orderData.business;
          const customerId = orderData.customer && typeof orderData.customer === "object"
            ? (orderData.customer._id || orderData.customer.id || String(orderData.customer))
            : orderData.customer;

          // Normalize line items; order-level discount % is derived from tax-inclusive subtotal.
          const editedItemsFromApi = (orderData.items || [
            {
              id: 1,
              description: "",
              quantity: 1,
              rate: 0,
              tax: 0,
              amount: 0,
            },
          ]).map((it, idx) => {
            const qty = parseFloat(it.quantity) || 0;
            const rate = parseFloat(it.rate) || 0;
            const discount = parseFloat(it.discount) || 0;
            const lineSub = getLineSubtotal(qty, rate, discount);
            const taxAmount = parseFloat(it.tax) || 0;
            const taxRate =
              parseFloat(it.taxRate) ||
              (lineSub > 0 && taxAmount ? (taxAmount / lineSub) * 100 : 0);
            return {
              ...it,
              id: it.id ?? idx + 1,
              taxRate,
              taxId: it.taxId ?? "",
              taxName: it.taxName ?? "",
            };
          });

          const grossSubtotalForOrderDiscount = computeSalesOrderTotals(
            editedItemsFromApi,
            0,
            0,
            0,
          ).subtotal;

          setFormData({
            ...orderData,
            business: businessId,
            customer: customerId,
            salesOrderDate: salesOrderDateStr,
            expectedShipmentDate: orderData.expectedShipmentDate
              ? new Date(orderData.expectedShipmentDate)
                  .toISOString()
                  .split("T")[0]
              : "",
            paymentTerms: paymentTermsStr,
            dueDate: dueDateStr,
            deliveryMethod: orderData.deliveryMethod || orderData.delivery_method || orderData.delivery || "",
            salesperson: orderData.salesperson || orderData.salesPerson || orderData.sales_person || "",
            items: editedItemsFromApi,
            discountPercentage:
              Number(orderData.discountPercentage) > 0
                ? Math.min(
                    100,
                    Number(orderData.discountPercentage),
                  )
                : calculateOrderDiscountPercentage(
                    grossSubtotalForOrderDiscount,
                    orderData.discount,
                  ),
          });
          const normalizedBilling = normalizeAddressOneLine(
            orderData.billingAddress || orderData.billing_address || "",
          );
          const normalizedShipping = normalizeAddressOneLine(
            orderData.shippingAddress || orderData.shipping_address || "",
          );
          const resolvedSameAs = resolveSameAsBillingFlag(
            orderData.sameAsBilling,
            normalizedBilling,
            normalizedShipping,
          );
          setSameAsBilling(resolvedSameAs);
          setFormData((prev) => ({
            ...prev,
            billingAddress: normalizedBilling,
            shippingAddress: resolvedSameAs
              ? normalizedBilling || normalizedShipping
              : normalizedShipping,
          }));
          if (orderData.customer) {
            // Keep full customer object in selectedCustomer for previews and auto-fill
            setSelectedCustomer(orderData.customer);
          }
          
          // Extract currency: prefer sales order currency, fallback to customer currency
          let currencyDisplay = "";
          
          // Check if sales order has currency (should be a string like "AED", "USD")
          if (orderData.currency) {
            // Check if it's a valid currency string (not an ObjectId)
            // ObjectIds are 24 hex characters, currency codes are typically 3 characters
            const isObjectId = /^[0-9a-fA-F]{24}$/.test(orderData.currency);
            if (!isObjectId && typeof orderData.currency === "string") {
              // It's a valid currency string
              currencyDisplay = orderData.currency;
            }
          }
          
          // If no valid currency from sales order, try customer currency
          if (!currencyDisplay && orderData.customer) {
            const customerCurrency = orderData.customer?.basicInformation?.currency;
            if (customerCurrency) {
              currencyDisplay = typeof customerCurrency === "object"
                ? customerCurrency.symbol || customerCurrency.prefix || customerCurrency.code || ""
                : customerCurrency;
            }
          }
          
          // Set currency in form data
          if (currencyDisplay) {
            setFormData((prev) => ({
              ...prev,
              customerCurrency: currencyDisplay,
            }));
          }
        } else {
          notifyError(
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
  }, [id, isEditMode]);

  // Auto-fill customer data when customer is selected (matching CreateCustomerInvoice)
  const handleCustomerChange = async (customerId) => {
    try {
      const response = await axios.get(`${Base_URL}/customers/${customerId}`, {
        headers,
      });
      const customerData = response?.data;
      setSelectedCustomer(customerData);
      setSameAsBilling(false);
      lastDistinctShippingAddressRef.current = "";

      // Helper function to format address from address object
      const formatAddress = (addressObj) => {
        if (!addressObj) return "";
        const parts = [];
        if (addressObj.addressLine1) parts.push(addressObj.addressLine1);
        if (addressObj.addressLine2) parts.push(addressObj.addressLine2);
        if (addressObj.city) parts.push(addressObj.city);
        if (addressObj.state) parts.push(addressObj.state);
        if (addressObj.zipCode) parts.push(addressObj.zipCode);
        if (addressObj.country) parts.push(addressObj.country);
        return parts.join("\n");
      };

      // Get addresses from addresses array
      const addresses = customerData?.addresses || [];
      const billingAddressObj = findAddressBySystemType(
        addresses,
        addressTypeConfig,
        "BILLING"
      );
      const shippingAddressObj = findAddressBySystemType(
        addresses,
        addressTypeConfig,
        "SHIPPING"
      );

      // Format addresses
      const billingAddress = billingAddressObj
        ? formatAddress(billingAddressObj)
        : customerData?.companyInfo?.billingAddress || "";
      const shippingAddress = shippingAddressObj
        ? formatAddress(shippingAddressObj)
        : customerData?.companyInfo?.shippingAddress || "";

      // Get phone and fax from address objects or fallback to customer info
      const phoneNumber =
        billingAddressObj?.phone ||
        shippingAddressObj?.phone ||
        customerData?.basicInformation?.customerPhone?.mobile ||
        customerData?.companyInfo?.phone ||
        "";
      const faxNumber =
        billingAddressObj?.fax ||
        shippingAddressObj?.fax ||
        customerData?.companyInfo?.contact?.fax ||
        customerData?.companyInfo?.fax ||
        "";

      // Get customer currency
      const customerCurrency = customerData?.basicInformation?.currency;
      const currencyDisplay = customerCurrency
        ? typeof customerCurrency === "object"
          ? customerCurrency.symbol || customerCurrency.prefix || customerCurrency.code || ""
          : customerCurrency
        : "";

      // Use functional update to preserve existing form data
      setFormData((prev) => ({
        ...prev,
        customer: customerId,
        billingAddress: billingAddress ? billingAddress.replace(/\n/g, ", ") : "",
        shippingAddress: shippingAddress,
        phone: phoneNumber,
        fax: faxNumber,
        customerCurrency: currencyDisplay || baseCurrency || "MYR",
      }));
    } catch (error) {
      notifyError(
        t("salesOrder.notifications.customerFetchFailed", {
          defaultValue: "Failed to fetch customer details",
        })
      );
    }
  };

  // Calculate totals when items change
  const getDocumentSnapshot = React.useCallback(() => {
    const items = formData.items || [];
    // Create a comprehensive snapshot that includes all fields that affect the PDF
    // Include item details: name, description, quantity, rate, discount, tax
    const itemsDigest = items.map(it => 
      `${it.itemName || it.description || ""}-${parseFloat(it.quantity) || 0}-${parseFloat(it.rate) || 0}-${parseFloat(it.discount) || 0}-${parseFloat(it.taxRate) || 0}-${parseFloat(it.amount) || 0}`
    ).join("|");
    
    // Include customer info, addresses, and other relevant fields
    return [
      formData.customer || "",
      selectedCustomer?.name || "",
      formData.billingAddress || "",
      formData.shippingAddress || "",
      formData.phone || "",
      formData.fax || "",
      formData.salesOrderNumber || "",
      formData.referenceNumber || "",
      formData.salesOrderDate || "",
      formData.paymentTerms || "",
      formData.dueDate || "",
      formData.deliveryMethod || "",
      formData.salesperson || "",
      itemsDigest,
      formData.subtotal || 0,
      formData.total || 0,
      formData.discount || 0,
      formData.shippingCharges || 0,
      formData.adjustment || 0,
      formData.customerNotes || "",
      formData.termsAndConditions || "",
    ].join("||");
  }, [
    formData.items, 
    formData.customer,
    formData.billingAddress,
    formData.shippingAddress,
    formData.phone,
    formData.fax,
    formData.salesOrderNumber,
    formData.referenceNumber,
    formData.salesOrderDate,
    formData.paymentTerms,
    formData.dueDate,
    formData.deliveryMethod,
    formData.salesperson,
    formData.subtotal, 
    formData.total, 
    formData.discount, 
    formData.shippingCharges, 
    formData.adjustment,
    formData.customerNotes,
    formData.termsAndConditions,
    selectedCustomer?.name
  ]);

  useEffect(() => {
    const baseSummary = computeSalesOrderTotals(
      formData.items,
      0,
      formData.shippingCharges,
      formData.adjustment
    );
    const nextDiscountAmount = calculateOrderDiscountAmount(
      baseSummary.subtotal,
      formData.discountPercentage,
    );
    const { subtotal, taxTotal, total } = computeSalesOrderTotals(
      formData.items,
      nextDiscountAmount,
      formData.shippingCharges,
      formData.adjustment
    );

    setFormData((prev) => {
      const subtotalChanged = Math.abs((parseFloat(prev.subtotal) || 0) - subtotal) > 0.0001;
      const taxChanged = Math.abs((parseFloat(prev.tax) || 0) - taxTotal) > 0.0001;
      const totalChanged = Math.abs((parseFloat(prev.total) || 0) - total) > 0.0001;
      const discountChanged = Math.abs((parseFloat(prev.discount) || 0) - nextDiscountAmount) > 0.0001;
      if (!subtotalChanged && !taxChanged && !totalChanged && !discountChanged) return prev;
      return {
        ...prev,
        subtotal,
        discount: nextDiscountAmount,
        tax: taxTotal,
        total,
      };
    });
  }, [formData.items, formData.discountPercentage, formData.shippingCharges, formData.adjustment]);

  /** Summary panel: subtotal = sum of line totals (incl. tax); header discount on that subtotal. */
  const orderSummaryInvoiceData = useMemo(() => {
    const base = computeSalesOrderTotals(formData.items, 0, 0, 0);
    const discountAmount = calculateOrderDiscountAmount(
      base.subtotal,
      formData.discountPercentage,
    );
    const full = computeSalesOrderTotals(
      formData.items,
      discountAmount,
      formData.shippingCharges,
      formData.adjustment,
    );
    return {
      subtotal: full.subtotal,
      taxTotal: full.taxTotal,
      discountPercentage: formData.discountPercentage,
      discountAmount,
      shippingCharges: formData.shippingCharges,
      adjustment: formData.adjustment,
      total: full.total,
    };
  }, [
    formData.items,
    formData.discountPercentage,
    formData.shippingCharges,
    formData.adjustment,
  ]);

  // Set document snapshot reference when a document is loaded in edit mode (handled by main useEffect now)

  // When invoice data changes after a PDF was generated, clear or restore the document based on snapshot match
  useEffect(() => {
    const hasDocument = DocumentData?.s3Key || DocumentData?.url || DocumentData?.file?.s3Key || DocumentData?.file?.url;
    const hasOriginalState = originalDocumentStateRef.current !== null;
    const hasSnapshot = documentSnapshotRef.current !== null;
    
    // Initialize snapshot if we have document but no snapshot yet (first load in edit mode)
    if (hasDocument && !hasSnapshot && formData.customer && formData.items && formData.items.length > 0) {
      try {
        documentSnapshotRef.current = getDocumentSnapshot();
      } catch (err) {
        console.warn("Error setting document snapshot:", err);
      }
      return; // Skip comparison on first initialization
    }
    
    // If we have a snapshot reference, check if current state matches original
    if (hasSnapshot) {
      const currentSnapshot = getDocumentSnapshot();
      
      if (currentSnapshot === documentSnapshotRef.current) {
        // Snapshot matches original - restore document if it was cleared
        if (!hasDocument && hasOriginalState) {
          const originalState = originalDocumentStateRef.current;
          setDocumentData(originalState.documentData);
          setSelectedTemplateId(originalState.templateId);
          setSelectedTemplate(originalState.template);
        }
      } else {
        // Snapshot doesn't match - clear document if it exists
        if (hasDocument) {
          setDocumentData({});
          setSelectedTemplateId(null);
          setSelectedTemplate(null);
        }
      }
    }
  }, [getDocumentSnapshot, DocumentData?.s3Key, DocumentData?.url, DocumentData?.file?.s3Key, DocumentData?.file?.url, formData.customer, formData.items]);

  // Validate form
  const validateForm = () => {
    const errors = {};

    if (!formData.business)
      errors.business = t("salesOrder.validation.businessRequired", {
        defaultValue: "Business is required",
      });
    if (!formData.customer)
      errors.customer = t("salesOrder.validation.customerRequired", {
        defaultValue: "Customer is required",
      });
    if (!formData.salesOrderDate)
      errors.salesOrderDate = t("salesOrder.validation.orderDateRequired", {
        defaultValue: "{{label}} Date is required",
        label: saleOrderLabel,
      });
    if (!formData.paymentTerms)
      errors.paymentTerms = t("salesOrder.validation.paymentTermsRequired", {
        defaultValue: "Payment Terms is required",
      });
    if (!formData.dueDate)
      errors.dueDate = t("salesOrder.validation.dueDateRequired", {
        defaultValue: "Due Date is required",
      });
    if ((parseFloat(formData.discountPercentage) || 0) > 100) {
      errors.discountPercentage = t("salesOrder.validation.discountMaximum", {
        defaultValue: "Discount cannot exceed 100%.",
      });
    }
    if (!formData.deliveryMethod)
      errors.deliveryMethod = t("salesOrder.validation.deliveryMethodRequired", {
        defaultValue: "Delivery Method is required",
      });
    if (!formData.salesperson)
      errors.salesperson = t("salesOrder.validation.salespersonRequired", {
        defaultValue: "Salesperson is required",
      });

    // Validate items
    if (!formData.items || formData.items.length === 0) {
      errors.items = t("salesOrder.validation.itemRequired", {
        defaultValue: "At least one item is required",
      });
    } else {
      formData.items.forEach((item, index) => {
        if (!item.quantity || item.quantity <= 0) {
          errors[`items.${index}.quantity`] = t(
            "salesOrder.validation.quantityPositive",
            { defaultValue: "Quantity must be greater than 0" }
          );
        }
        if (!item.rate || item.rate <= 0) {
          errors[`items.${index}.rate`] = t("salesOrder.validation.ratePositive", {
            defaultValue: "Rate must be greater than 0",
          });
        }
      });
    }

    setFormErrors(errors);
    return { isValid: Object.keys(errors).length === 0, errors };
  };

  // Handle file upload
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    if (attachments.length + files.length > 10) {
      notifyError(
        t("documents.validation.maximumFiles", {
          defaultValue: "Maximum {{count}} files allowed",
          count: 10,
        })
      );
      return;
    }

    const validFiles = files.filter((file) => {
      if (file.size > 5 * 1024 * 1024) {
        notifyError(
          t("documents.validation.fileSizeExceeded", {
            defaultValue: "{{name}} exceeds {{size}} limit",
            name: file.name,
            size: "5MB",
          })
        );
        return false;
      }
      return true;
    });

    setAttachments([...attachments, ...validFiles]);
  };

  const handleRemoveFile = (index) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  // Fetch templates for Sales Orders - same approach as CreateCustomerInvoice
  const fetchTemplates = async () => {
    // Don't fetch if business is not set
    if (!formData?.business) {
      return;
    }

    try {
      const businessTemplates = await axios.get(
        `${Base_URL}/business-templates/${formData?.business}`,
        { headers }
      );

      const assignments = businessTemplates?.data?.data || [];

      // Document templates use type `saleorder` (see Document Template builder).
      const salesOrderTemplates = assignments.filter((a) => {
        if (!a || a.isActive !== true) return false;
        return isSaleOrderDocumentTemplateType(a.type, a.templateId?.type);
      });

      const templateObjects = salesOrderTemplates
        .map((item) => {
          const template = item.templateId;
          if (!template) {
            console.warn("Template ID is null/undefined for item:", item);
            return null;
          }
          // Ensure template has all necessary properties
          return {
            ...template,
            isDefault: item.isDefault || false,
            isActive: item.isActive || false,
          };
        })
        .filter((template) => template !== null && template !== undefined);

      // Remove duplicates based on template _id (same template might be assigned multiple times)
      // This is critical - same template can be assigned with different types or multiple times
      // Normalize IDs to strings for comparison (handles ObjectId vs string)
      const uniqueTemplates = [];
      const seenTemplateIds = new Set();
      
      templateObjects.forEach((template) => {
        // Normalize ID to string for comparison (handles both ObjectId objects and string IDs)
        // Handle both _id (MongoDB ObjectId) and id fields
        let templateId = template._id || template.id;
        
        // Convert to string if it's an object (MongoDB ObjectId)
        if (templateId && typeof templateId === 'object' && templateId.toString) {
          templateId = templateId.toString();
        } else {
          templateId = String(templateId || "");
        }
        
        // Only add if we haven't seen this ID before
        if (templateId && templateId !== "undefined" && templateId !== "null" && !seenTemplateIds.has(templateId)) {
          seenTemplateIds.add(templateId);
          uniqueTemplates.push(template);
        }
      });

      if (uniqueTemplates.length === 0) {
        try {
          const templatesResponse = await axios.get(`${Base_URL}/document-templates`, {
            headers,
          });
          const allTemplates =
            templatesResponse.data?.data || templatesResponse.data || [];
          const saleOnly = allTemplates.filter(
            (tmp) => isSaleOrderDocumentTemplateType(tmp.type, tmp.type),
          );
          saleOnly.forEach((template) => {
            let tid = template._id || template.id;
            if (tid && typeof tid === "object" && tid.toString) tid = tid.toString();
            else tid = String(tid || "");
            if (tid && tid !== "undefined" && tid !== "null" && !seenTemplateIds.has(tid)) {
              seenTemplateIds.add(tid);
              uniqueTemplates.push(template);
            }
          });
        } catch (fallbackErr) {
          console.warn("Error fetching sale order templates from document-templates:", fallbackErr);
        }
      }

      setTemplates(uniqueTemplates);

      const preferredTemplate =
        uniqueTemplates.find((t) => t.isDefault) || uniqueTemplates[0];
      if (preferredTemplate) {
        const templateId = preferredTemplate._id || preferredTemplate.id;
        setSelectedTemplate(preferredTemplate);
        setSelectedTemplateId(templateId);
      }
    } catch (error) {
      console.error("Error fetching templates:", error);
      // Set empty array on error to prevent stale data
      setTemplates([]);
    }
  };

  // Fetch templates when business is selected
  useEffect(() => {
    if (formData?.business) {
      fetchTemplates();
    } else {
      setTemplates([]);
      setSelectedTemplate(null);
      setSelectedTemplateId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData?.business]);

  // Handle template selection from modal
  const handleGenerateDocument = async ({ templateId, template }) => {

    let templateToUse = template || templates.find((t) => t._id === templateId);
    
    if (!templateToUse) {
      console.error("Template not found:", templateId);
      notifyError(
        t("documents.notifications.templateNotFound", {
          defaultValue: "Template not found. Please select a template.",
        })
      );
      return;
    }
    
    // If template doesn't have htmlContent, fetch the full template
    if (!templateToUse.htmlContent && templateId) {
      try {
        const templateResponse = await axios.get(
          `${Base_URL}/document-templates/${templateId}`,
          { headers }
        );
        if (templateResponse.data?.data?.htmlContent) {
          templateToUse = {
            ...templateToUse,
            ...templateResponse.data.data,
          };
        }
      } catch (error) {
        console.error("Error fetching full template:", error);
        notifyError(
          t("documents.notifications.templateLoadFailed", {
            defaultValue: "Failed to load template details",
          })
        );
        return;
      }
    }
    
    // Just select template; do not open document generator. PDF generated at runtime on email preview when "Attach sales order PDF" is checked.
    setSelectedTemplate(templateToUse);
    setSelectedTemplateId(templateId);
    setIsModalOpen(false);
  };

  // Handle document generation success
  const handleGenerationSuccess = (data) => {
    // Some generators return { file: { url/s3Key } }, others return { url/s3Key } directly.
    // Normalize so the UI can reliably show "View PDF" after success.
    const pdfData = data?.file || data;
    setDocumentData(pdfData);
    // Save a snapshot of current form data so we can invalidate the document if data changes
    try {
      documentSnapshotRef.current = getDocumentSnapshot();
      // Store original document state to restore if user changes back to original values
      originalDocumentStateRef.current = {
        documentData: pdfData,
        templateId: selectedTemplateId,
        template: selectedTemplate,
      };
    } catch (err) {
      documentSnapshotRef.current = null;
      originalDocumentStateRef.current = null;
    }
    setIsGeneratorOpen(false);
    notifySuccess(
      t("salesOrder.notifications.templateSelected", {
        defaultValue:
          "PDF template selected successfully! You can now save or send the {{label}}.",
        label: saleOrderLabel.toLowerCase(),
      })
    );
    // Removed window.open and handleOpenFile - PDF will not open in browser, only success message is shown
  };

  const handleOpenFile = async (documentId) => {
    if (!documentId) return;

    try {
      const response = await axios.get(
        `${Base_URL}/documents/getFileWithAllData/${documentId}`,
        { headers }
      );
      const url = response?.data?.data?.url;
      if (url) window.open(url, "_blank");
      else
        notifyError(
          t("documents.notifications.fileUrlNotFound", {
            defaultValue: "File URL not found",
          })
        );
    } catch (error) {
      notifyError(
        t("documents.notifications.openFailed", {
          defaultValue: "Error opening file",
        })
      );
      console.error("Error: ", error);
    }
  };

  // Handle form submission
  const handleSubmit = async (e, action = "draft") => {
    if (e) {
      e.preventDefault();
    }

    // Prevent editing/saving when status is "Closed"
    if (isEditMode && formData.status?.toLowerCase() === "closed") {
      notifyError(
        t("salesOrder.validation.closedReadOnly", {
          defaultValue: "Cannot edit or save a {{label}} with 'Closed' status",
          label: saleOrderLabel.toLowerCase(),
        })
      );
      return;
    }

    const validation = validateForm();
    if (!validation.isValid) {
      const firstError = Object.values(validation.errors || {}).find(Boolean);
      notifyError(
        firstError ||
          t("common.validation.requiredFields", {
            defaultValue: "Please fill in all required fields",
          })
      );
      return;
    }

    if (salesOrderBusinessId) {
      try {
        const defs = await fetchDefinitions(
          {
            businessId: salesOrderBusinessId,
            module: "sales",
            screen: "sales_order",
          },
          headers,
        );
        const cfErr = validateCustomFieldValues(defs, customFieldValues);
        if (cfErr) {
          notifyError(cfErr);
          return;
        }
      } catch (e) {
        notifyError(
          e?.response?.data?.message ||
            t("salesOrder.validation.customFieldsFailed", {
              defaultValue: "Could not validate custom fields",
            })
        );
        return;
      }
    }

    // ✅ PDF TEMPLATE VALIDATION: Require PDF only when template changed. If order already has document, allow.
    const hasDocument =
      DocumentData?.s3Key ||
      DocumentData?.url ||
      DocumentData?.file?.s3Key ||
      DocumentData?.file?.url ||
      formData?.documentUrl;
    // PDF optional for "Save and Send" - generated at runtime on email preview when attach is checked

    setLoading(true);
    try {
      // Determine documentUrl - prefer documentId (_id) for API calls, fallback to s3Key/url
      const documentId = DocumentData?._id || DocumentData?.fileId || DocumentData?.file?._id || DocumentData?.file?.fileId;
      const documentS3Key = DocumentData?.s3Key || DocumentData?.file?.s3Key;
      const documentUrl = DocumentData?.url || DocumentData?.file?.url;
      
      // Prefer documentId (for API calls), then s3Key, then url, then existing
      const finalDocumentUrl = documentId || documentS3Key || documentUrl || formData.documentUrl || "";

      // Determine status based on action and current status
      let newStatus = formData.status || "Draft";
      if (!isEditMode) {
        // New sales order: set status based on action
        newStatus = action === "send" ? "Confirmed" : "Draft";
      } else {
        // Editing existing: preserve status unless explicitly changing
        if (action === "save") {
          // "Save" action: preserve current status (for Confirmed orders)
          newStatus = formData.status;
        } else if (action === "send") {
          // "Save & Send": if Draft, change to Confirmed; if already Confirmed, keep Confirmed
          newStatus = formData.status === "Draft" ? "Confirmed" : formData.status;
        } else if (action === "draft") {
          // "Save as Draft": only for Draft status
          newStatus = "Draft";
        }
      }

      const summary = computeSalesOrderTotals(
        formData.items,
        formData.discount,
        formData.shippingCharges,
        formData.adjustment
      );

      const payload = {
        ...formData,
        status: newStatus,
        createLinkedJob: !isEditMode && canCreateLinkedJob && createLinkedJob,
        sameAsBilling,
        // Include documentUrl (prefer documentId for API compatibility)
        documentUrl: finalDocumentUrl,
        // Map customerCurrency to currency for backend
        currency: formData.customerCurrency || baseCurrency || "MYR",
        subtotal: summary.subtotal,
        tax: summary.taxTotal,
        total: summary.total,
        items: formData.items.map((item) => {
          const computed = computeSalesOrderItem(item);
          return {
          ...computed,
          itemId: item.itemId || undefined,
          itemName: String(item.itemName ?? "").trim(),
          description: String(item.description ?? "").trim(),
          quantity: computed.quantity,
          ordered_quantity: computed.quantity,
          fulfilled_quantity: item.fulfilled_quantity || 0, // Preserve existing fulfilled quantity
          rate: computed.rate,
          tax: computed.taxAmount,
          taxRate: computed.taxRate,
          taxId: item.taxId || undefined,
          taxName: item.taxName || undefined,
          discount: computed.discount,
          amount: computed.amount,
          ...(item.lineItemCustomFields &&
          typeof item.lineItemCustomFields === "object" &&
          Object.keys(item.lineItemCustomFields).length > 0
            ? { lineItemCustomFields: item.lineItemCustomFields }
            : {}),
        };
        }),
      };

      if (!isEditMode && fromQuotationIdForLinkRef.current) {
        payload.quotationId = fromQuotationIdForLinkRef.current;
      }

      let response;
      if (isEditMode) {
        response = await SalesOrderServices.updateSalesOrder(id, payload, headers);
      } else {
        response = await SalesOrderServices.createSalesOrder(payload, headers);
      }

      if (isSalesOrderSaveResponseOk(response)) {
        const salesOrderData = response.data.data;
        const recordIdStr = String(salesOrderData._id || id || "");
        if (salesOrderBusinessId && recordIdStr) {
          try {
            await upsertValues(
              {
                business_id: salesOrderBusinessId,
                module: "sales",
                screen: "sales_order",
                record_id: recordIdStr,
                values: customFieldValues,
              },
              headers,
            );
          } catch (cfErr) {
            notifyError(
              cfErr?.response?.data?.message ||
                t("salesOrder.notifications.savedCustomFieldsFailed", {
                  defaultValue:
                    "{{label}} saved but custom fields failed to save",
                  label: saleOrderLabel,
                }),
            );
          }
        }

        if (action === "draft" || action === "save") {
          // "Save as Draft" or "Save" (for Confirmed): just update and go back
          notifySuccess(
            t(
              isEditMode
                ? "salesOrder.notifications.updated"
                : "salesOrder.notifications.created",
              {
                defaultValue: isEditMode
                  ? "{{label}} updated successfully"
                  : "{{label}} created successfully",
                label: saleOrderLabel,
              }
            )
          );
          if (!isEditMode && response.data?.fleetJobId && canCreateLinkedJob) {
            notifySuccess(
              t("salesOrder.notifications.fleetJobCreated", {
                defaultValue:
                  "A fleet work order was created — open Schedule → On-Deck to assign vehicle and time.",
              })
            );
          }
          if (response.data?.fleetJobWarning) {
            notifyError(response.data.fleetJobWarning);
          }
          history.push(saleOrderListPath);
        } else         if (action === "send") {
          if (!isEditMode && response.data?.fleetJobId && canCreateLinkedJob) {
            notifySuccess(
              t("salesOrder.notifications.fleetJobCreated", {
                defaultValue:
                  "A fleet work order was created — open Schedule → On-Deck to assign vehicle and time.",
              })
            );
          }
          if (response.data?.fleetJobWarning) {
            notifyError(response.data.fleetJobWarning);
          }
          history.push({
            pathname: getModuleRoutePath("saleOrder", "emailPreview"),
            state: {
              salesOrderData: {
                ...salesOrderData,
                subtotal: summary.subtotal,
                subTotal: summary.subtotal,
                discountPercentage: formData.discountPercentage,
                customer_email: selectedCustomer?.basicInformation?.customerEmail || "",
                customer_phone:
                  selectedCustomer?.basicInformation?.customerPhone?.mobile ||
                  selectedCustomer?.basicInformation?.customerPhone?.workPhone ||
                  formData.phone ||
                  "",
                customer_name: selectedCustomer?.basicInformation?.companyName ||
                              selectedCustomer?.basicInformation?.customerDisplayName ||
                              t("common.customer", { defaultValue: "Customer" }),
                templateId: selectedTemplateId,
              },
              isUpdate: isEditMode,
              salesOrderId: salesOrderData._id || id,
              templateData: selectedTemplate,
              businessData,
              adminInfo,
              invoiceCustomFieldDefinitions: salesOrderFieldDefinitions,
              invoiceCustomFieldValues: customFieldValues,
              lineItemCustomFieldDefinitions: lineItemCustomFieldDefs,
              itemsForPdfCustomFields: formData.items || [],
            },
          });
        }
      } else {
        notifyError(
          response.data.message ||
            t("salesOrder.notifications.saveFailed", {
              defaultValue: "Failed to save {{label}}",
              label: saleOrderLabel.toLowerCase(),
            })
        );
      }
    } catch (error) {
      console.error("Error saving sales order:", error);
        notifyError(
          error?.response?.data?.message ||
            t("salesOrder.notifications.saveFailed", {
              defaultValue: "Failed to save {{label}}",
              label: saleOrderLabel.toLowerCase(),
            }),
        );
    } finally {
      setLoading(false);
    }
  };

  // Determine if form should be read-only
  const isReadOnly = isEditMode && formData.status?.toLowerCase() === "closed";
  
  // Determine current status for button logic
  const currentStatus = formData.status || "Draft";
  const isConfirmed = currentStatus.toLowerCase() === "confirmed";
  const isDraft = currentStatus.toLowerCase() === "draft";
  const isClosed = currentStatus.toLowerCase() === "closed";
  const showLinkedJobOption = canCreateLinkedJob && !isClosed;
  const linkedJobChecked = isEditMode ? true : createLinkedJob;

  if (loading && isEditMode) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">
          {t("common.loading", { defaultValue: "Loading..." })}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main Content - Two Column Layout */}
      <div className=" mx-auto py-4 px-4">
        <div className="grid grid-cols-1 gap-6">
          {/* Left Column - Main Form */}
          <div className="space-y-6 px-4">
            <PageHeader
              title={t(
                isEditMode ? "salesOrder.form.editTitle" : "salesOrder.form.newTitle",
                {
                  defaultValue: isEditMode
                    ? "Edit {{label}}"
                    : "New {{label}}",
                  label: saleOrderLabel,
                }
              )}
              showBackButton
              backFallbackPath={saleOrderListPath}
            />
            
            {/* Business & Sales Order Info Card */}
            <form onSubmit={handleSubmit}>
              <div className="bg-white rounded-lg shadow-sm">
                <div className="p-6 bg-green-50 space-y-6 rounded-b-lg">
                  {/* Business and Customer Selection - Side by Side */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Business Selection */}
                    <SingleBusinessField
                      selectedValue={formData.business}
                      onAutoSelect={(id) =>
                        setFormData((prev) => ({ ...prev, business: id }))
                      }
                    >
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t("common.business", { defaultValue: "Business" })}{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <div className="bg-white rounded-lg">
                          <SearchableDropdown
                          name="business"
                          value={formData.business}
                          disabled={isReadOnly || isEditMode}
                          onChange={(e) => {
                            const newBusinessId = e.target.value;
                            // Clear customer and related data when business changes
                            setFormData((prev) => ({
                              ...prev,
                              business: newBusinessId,
                              customer: "",
                              billingAddress: "",
                              shippingAddress: "",
                              expectedShipmentDate: "",
                              phone: "",
                              fax: "",
                              deliveryMethod: "",
                              salesperson: "",
                              items: [
                                {
                                  id: 1,
                                  itemId: "",
                                  description: "",
                                  quantity: 1,
                                  rate: 0,
                                  tax: 0,
                                  discount: 0,
                                  amount: 0,
                                },
                              ],
                              subtotal: 0,
                              discount: 0,
                              tax: 0,
                              shippingCharges: 0,
                              adjustment: 0,
                              total: 0,
                            }));
                            setSelectedCustomer(null);
                          }}
                          placeholder={t("salesOrder.placeholders.selectBusiness", {
                            defaultValue: "Select Business",
                          })}
                          searchPlaceholder={t("salesOrder.placeholders.searchBusinesses", {
                            defaultValue: "Search businesses...",
                          })}
                          options={(() => {
                            const opts = (businesses || []).map((business) => ({
                              value: business._id,
                              label: business.name,
                              name: business.name,
                            }));
                            // If editing and selected business is not in assigned businesses,
                            // include it so the dropdown shows the current selection (similar to customer behavior)
                            if (formData.business && !opts.find((o) => String(o.value) === String(formData.business))) {
                              // Try to use fetched businessData or fallback to a minimal label
                              let label = (businessData && (businessData.name || businessData.businessName)) || formData.businessName || formData.business || t("salesOrder.placeholders.selectedBusiness", { defaultValue: "Selected Business" });
                              if (typeof label === "object") {
                                label = label.name || label.businessName || JSON.stringify(label);
                              }
                              opts.unshift({ value: formData.business, label, name: label });
                            }
                            return opts;
                          })()}
                          searchKeys={["name"]}
                          renderOption={(option) => (
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-gray-400" />
                              <span className="font-medium">{option.name}</span>
                            </div>
                          )}
                        />
                      </div>
                      {formErrors.business && (
                        <p className="mt-1 text-xs text-red-500">{formErrors.business}</p>
                      )}
                    </div>
                    </SingleBusinessField>

                    {/* Customer Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t("salesOrder.fields.customerName", {
                          defaultValue: "Customer Name",
                        })}{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-2">
                        <div className="flex-1 bg-white rounded-lg">
                          <SearchableDropdown
                            name="customerName"
                            value={formData.customer}
                            onChange={(e) => handleCustomerChange(e.target.value)}
                            placeholder={
                              selectedCustomer
                                ? selectedCustomer?.basicInformation?.customerDisplayName
                                : t("salesOrder.placeholders.selectCustomer", {
                                    defaultValue: "Select Customer",
                                  })
                            }
                            searchPlaceholder={t("salesOrder.placeholders.searchCustomers", {
                              defaultValue: "Search customers...",
                            })}
                            disabled={!formData.business || isReadOnly}
                            options={
                              customers?.map((customer) => ({
                                value: customer._id,
                                label: customer.basicInformation?.companyName || customer.basicInformation?.customerDisplayName || "",
                                name: customer.basicInformation?.companyName || customer.basicInformation?.customerDisplayName || "",
                                displayName: customer.basicInformation?.customerDisplayName,
                                email: customer.basicInformation?.customerEmail,
                              })) || []
                            }
                            searchKeys={["name", "displayName", "email"]}
                            renderOption={(option) => (
                              <div>
                                <div className="font-medium text-sm">{option.name}</div>
                                {option.displayName &&
                                  option.displayName !== option.name && (
                                    <div className="text-xs text-gray-500">
                                      {option.displayName}
                                    </div>
                                  )}
                                {option.email && (
                                  <div className="text-xs text-gray-400">
                                    {option.email}
                                  </div>
                                )}
                              </div>
                            )}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowQuickAddCustomer(true)}
                          disabled={!formData.business || isReadOnly}
                          title={
                            !formData.business
                              ? t("salesOrder.actions.selectBusinessFirst", {
                                  defaultValue: "Select a business first",
                                })
                              : t("salesOrder.actions.quickAddCustomer", {
                                  defaultValue: "Quick add a new customer",
                                })
                          }
                          className="flex items-center justify-center gap-1.5 shrink-0 px-3 py-2.5 text-sm font-medium text-[var(--p-blue)] bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-[var(--p-blue)] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[var(--p-blue)] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-white"
                        >
                          <UserPlus className="w-4 h-4" />
                          {t("common.add", { defaultValue: "Add" })}
                        </button>
                      </div>
                      {formErrors.customer && (
                        <p className="mt-1 text-xs text-red-500">
                          {formErrors.customer}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Billing & Shipping Address: only show after customer is selected. Show only fields that exist; show Add section for missing ones. */}
                  {selectedCustomer?._id && (
                    <>
                    {!addressTypeConfig?.hasConfiguredTypes && (
                      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 text-center">
                        <h3 className="text-sm font-medium text-gray-700 mb-3">
                          {t("salesOrder.addresses.notConfigured", {
                            defaultValue: "Address Types Not Configured",
                          })}
                        </h3>
                        <p className="text-xs text-gray-500 mb-4">
                          {t("salesOrder.addresses.configureFirst", {
                            defaultValue:
                              "You do not have any address type yet. Please add address types in Settings first.",
                          })}
                        </p>
                      </div>
                    )}
                    {addressTypeConfig?.hasConfiguredTypes &&
                      (() => {
                        const missingBillShip =
                          getMissingBillShipTypesForCustomerDisplay(
                            selectedCustomer?.addresses,
                            addressTypeConfig,
                            sameAsBilling,
                          );
                        if (!missingBillShip.length) return null;
                        return (
                          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 text-center">
                            <h3 className="text-sm font-medium text-gray-700 mb-3">
                              {t("salesOrder.addresses.missingTitle", {
                                defaultValue: "Missing {{types}} Address",
                                types: missingBillShip
                                  .map((typeObj) => typeObj.name)
                                  .join(" / "),
                              })}
                            </h3>
                            <p className="text-xs text-gray-500 mb-4">
                              {t("salesOrder.addresses.missingMessage", {
                                defaultValue:
                                  "Add the missing {{types}} address for this customer.",
                                types: missingBillShip
                                  .map((typeObj) => typeObj.name)
                                  .join(" / "),
                              })}
                            </p>
                            <div className="flex flex-wrap items-center justify-center gap-3">
                              {missingBillShip.map((typeObj) => (
                                <button
                                  key={typeObj.name}
                                  type="button"
                                  onClick={() => {
                                    setAddressModalType(typeObj.name);
                                    setEditingAddress(null);
                                    setIsAddressModalOpen(true);
                                  }}
                                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-[var(--p-blue)] bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-[var(--p-blue)] transition-colors"
                                >
                                  <Plus className="w-4 h-4" />
                                  {t("salesOrder.addresses.add", {
                                    defaultValue: "Add {{type}} Address",
                                    type: typeObj.name,
                                  })}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      <CustomerBillShipAddressFields
                        addressTypeConfig={addressTypeConfig}
                        billingAddress={formData.billingAddress}
                        shippingAddress={formData.shippingAddress}
                        sameAsBilling={sameAsBilling}
                        onBillingChange={(nextBilling) => {
                          setFormData((prev) => {
                            return {
                              ...prev,
                              billingAddress: nextBilling,
                              shippingAddress: sameAsBilling ? nextBilling : prev.shippingAddress,
                            };
                          });
                        }}
                        onShippingChange={(nextShipping) => {
                          setSameAsBilling(false);
                          setFormData((prev) => ({
                            ...prev,
                            shippingAddress: nextShipping,
                          }));
                        }}
                        onSameAsBillingToggle={(checked) => {
                          setSameAsBilling(checked);
                          setFormData((prev) => {
                            if (checked) {
                              lastDistinctShippingAddressRef.current = prev.shippingAddress || "";
                              return { ...prev, shippingAddress: prev.billingAddress };
                            }
                            return {
                              ...prev,
                              shippingAddress: lastDistinctShippingAddressRef.current || "",
                            };
                          });
                        }}
                        disabled={isReadOnly}
                      />
                    </>
                  )}

                  {/* Phone, Fax Number, and Currency - Three columns */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t("common.phone", { defaultValue: "Phone" })}
                      </label>
                      <input
                        type="text"
                        name="phone"
                        value={formData.phone || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, phone: e.target.value })
                        }
                        placeholder={t("salesOrder.placeholders.phone", {
                          defaultValue: "Enter phone number",
                        })}
                        className={`w-full px-3 py-2.5 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] ${
                          isReadOnly ? "cursor-not-allowed opacity-60" : ""
                        }`}
                        readOnly={isReadOnly}
                        disabled={isReadOnly}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t("salesOrder.fields.faxNumber", {
                          defaultValue: "Fax Number",
                        })}
                      </label>
                      <input
                        type="text"
                        name="fax"
                        value={formData.fax || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, fax: e.target.value })
                        }
                        placeholder={t("salesOrder.placeholders.fax", {
                          defaultValue: "Enter fax number",
                        })}
                        className={`w-full px-3 py-2.5 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] ${
                          isReadOnly ? "cursor-not-allowed opacity-60" : ""
                        }`}
                        readOnly={isReadOnly}
                        disabled={isReadOnly}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t("common.currency", { defaultValue: "Currency" })}
                      </label>
                      <input
                        type="text"
                        name="customerCurrency"
                        value={formData.customerCurrency || ""}
                        readOnly
                        placeholder={t("salesOrder.placeholders.customerCurrency", {
                          defaultValue: "Customer currency",
                        })}
                        className="w-full px-3 py-2.5 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                      />
                    </div>
                  </div>

                  {/* Dynamic module number, Reference Number */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t("salesOrder.fields.orderNumber", {
                          defaultValue: "{{label}} Number",
                          label: saleOrderLabel,
                        })}
                      </label>
                      {docNumMissing && (
                        <div className="mb-2 flex items-center justify-between gap-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs">
                          <span>
                            {t("salesOrder.numbering.fallback", {
                              defaultValue:
                                "{{label}} numbering is not configured for this business group. Numbers will be auto-generated using the Business Group fallback sequence.",
                              label: saleOrderLabel,
                            })}
                          </span>
                          {(adminInfo?.role?.isSuperAdmin ||
                            adminInfo?.role?.modules?.some((mod) =>
                              mod.subModules?.some((sub) => sub.path === "/document-sequencing")
                            )) && (
                            <a
                              href="/document-sequencing"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-shrink-0 px-2.5 py-1 text-xs font-semibold bg-amber-500 text-white rounded-md hover:bg-amber-600 transition-colors whitespace-nowrap"
                            >
                              {t("salesOrder.actions.configureNow", {
                                defaultValue: "Configure Now",
                              })}
                            </a>
                          )}
                        </div>
                      )}
                      <input
                        type="text"
                        value={formData.salesOrderNumber}
                        readOnly
                        className="w-full px-3 py-2.5 text-sm bg-[#374151] text-white border border-gray-300 rounded-lg cursor-not-allowed"
                        style={{ color: '#ffffff' }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t("salesOrder.fields.referenceNumber", {
                          defaultValue: "Reference Number",
                        })}
                      </label>
                      <input
                        type="text"
                        name="referenceNumber"
                        value={formData.referenceNumber || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, referenceNumber: e.target.value })
                        }
                        placeholder={t("salesOrder.placeholders.referenceNumber", {
                          defaultValue: "Enter reference number",
                        })}
                        className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                      />
                    </div>
                  </div>

                  {/* Dynamic module date, Expected Shipment Date, Payment Terms Row */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t("salesOrder.fields.orderDate", {
                          defaultValue: "{{label}} Date",
                          label: saleOrderLabel,
                        })}{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <CustomDatePicker
                        value={formData.salesOrderDate}
                        onChange={(date) => {
                          const updatedData = { ...formData, salesOrderDate: date };
                          if (updatedData.paymentTerms) {
                            const term = paymentTerms.find((t) => t.name === updatedData.paymentTerms);
                            const calculatedDueDate = calculateDueDate(term || updatedData.paymentTerms, date);
                            if (calculatedDueDate) updatedData.dueDate = calculatedDueDate;
                          }
                          setFormData(updatedData);
                        }}
                        disabled={isReadOnly}
                        bgColor="#FFFFFF"
                        style={{
                          backgroundColor: "#FFFFFF",
                          border: "1px solid #E5E7EB",
                          borderRadius: "8px",
                        }}
                      />
                      {formErrors.salesOrderDate && (
                        <p className="mt-1 text-xs text-red-500">
                          {formErrors.salesOrderDate}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t("salesOrder.fields.expectedShipmentDate", {
                          defaultValue: "Expected Shipment Date",
                        })}
                      </label>
                      <CustomDatePicker
                        value={formData.expectedShipmentDate}
                        onChange={(date) =>
                          setFormData({ ...formData, expectedShipmentDate: date })
                        }
                        disabled={isReadOnly}
                        bgColor="#FFFFFF"
                        style={{
                          backgroundColor: "#FFFFFF",
                          border: "1px solid #E5E7EB",
                          borderRadius: "8px",
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t("salesOrder.fields.paymentTerms", {
                          defaultValue: "Payment Terms",
                        })}{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <div className="bg-white rounded-lg">
                        <SearchableDropdown
                          value={formData.paymentTerms}
                          onChange={(e) => {
                            const selectedTermName = e.target.value;
                            const updatedData = {
                              ...formData,
                              paymentTerms: selectedTermName,
                            };
                            if (selectedTermName && updatedData.salesOrderDate) {
                              const term = paymentTerms.find(
                                (t) => t.name === selectedTermName
                              );
                              const calculatedDueDate = calculateDueDate(
                                term || selectedTermName,
                                updatedData.salesOrderDate
                              );
                              if (calculatedDueDate)
                                updatedData.dueDate = calculatedDueDate;
                            }
                            setFormData(updatedData);
                          }}
                          placeholder={t("salesOrder.placeholders.selectPaymentTerm", {
                            defaultValue: "Select Payment Term",
                          })}
                          searchPlaceholder={t("salesOrder.placeholders.searchPaymentTerms", {
                            defaultValue: "Search payment terms...",
                          })}
                          disabled={!formData.business || isReadOnly}
                          options={
                            (paymentTerms?.map((term) => ({
                              value: term.name,
                              label: term.name,
                              name: term.name,
                            })) || []
                          ).filter(
                            (t, i, a) => a.findIndex((x) => x.value === t.value) === i
                          )}
                          searchKeys={["name"]}
                          dropdownFooter={
                            <AddPaymentTermButton
                              businessId={formData.business}
                              headers={headers}
                              disabled={!formData.business || isReadOnly}
                              displayMode="dropdown"
                              onAdded={(newTerm) => {
                                setPaymentTerms((prev) =>
                                  prev.some((t) => t._id === newTerm._id)
                                    ? prev
                                    : [...prev, newTerm]
                                );
                                const updatedData = {
                                  ...formData,
                                  paymentTerms: newTerm.name,
                                };
                                if (formData.salesOrderDate) {
                                  const calculatedDueDate = calculateDueDate(
                                    newTerm,
                                    formData.salesOrderDate
                                  );
                                  if (calculatedDueDate)
                                    updatedData.dueDate = calculatedDueDate;
                                }
                                setFormData(updatedData);
                              }}
                            />
                          }
                        />
                      </div>
                      {formErrors.paymentTerms && (
                        <p className="mt-1 text-xs text-red-500">
                          {formErrors.paymentTerms}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Due Date Row */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t("salesOrder.fields.dueDate", { defaultValue: "Due Date" })}{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <CustomDatePicker
                        value={formData.dueDate}
                        onChange={(date) => {
                          const resolvedTerm = getPaymentTermFromDueDate(
                            formData.salesOrderDate,
                            date,
                            paymentTerms || []
                          );
                          setFormData({ ...formData, dueDate: date, paymentTerms: resolvedTerm });
                        }}
                        disabled={isReadOnly}
                        bgColor="#FFFFFF"
                        style={{
                          backgroundColor: "#FFFFFF",
                          border: "1px solid #E5E7EB",
                          borderRadius: "8px",
                        }}
                      />
                      {formErrors.dueDate && (
                        <p className="mt-1 text-xs text-red-500">
                          {formErrors.dueDate}
                        </p>
                      )}
                    </div>
                  </div>

                  {shouldRenderCustomFieldAtSlot(
                    "sales",
                    "sales_order",
                    "after_due_date",
                  ) && salesOrderBusinessId ? (
                    <DynamicCustomFieldsForm
                      businessId={salesOrderBusinessId}
                      module="sales"
                      screen="sales_order"
                      columns={3}
                      recordId={isEditMode ? id : undefined}
                      values={customFieldValues}
                      onValuesChange={setCustomFieldValues}
                      headers={headers}
                      readOnly={isReadOnly}
                      useBreakpointGrid
                    />
                  ) : null}

                  {/* Delivery Method and Salesperson */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t("salesOrder.fields.deliveryMethod", {
                          defaultValue: "Delivery Method",
                        })}{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <div className="bg-white rounded-lg">
                        <SearchableDropdown
                          value={formData.deliveryMethod}
                          onChange={(e) =>
                            setFormData({ ...formData, deliveryMethod: e.target.value })
                          }
                          placeholder={t("salesOrder.placeholders.selectDeliveryMethod", {
                            defaultValue: "Select Delivery Method",
                          })}
                          searchPlaceholder={t("salesOrder.placeholders.searchDeliveryMethods", {
                            defaultValue: "Search delivery methods...",
                          })}
                          disabled={!formData.business || isReadOnly}
                          options={
                            deliveryMethods?.map((method) => ({
                              value: method._id,
                              label: method.name,
                              name: method.name,
                            })) || []
                          }
                          searchKeys={["name"]}
                        />
                      </div>
                      {formErrors.deliveryMethod && (
                        <p className="mt-1 text-xs text-red-500">
                          {formErrors.deliveryMethod}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t("salesOrder.fields.salesperson", {
                          defaultValue: "Salesperson",
                        })}{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <div className="bg-white rounded-lg">
                        <SearchableDropdown
                          value={formData.salesperson != null ? String(formData.salesperson) : ""}
                          onChange={(e) =>
                            setFormData({ ...formData, salesperson: e.target.value })
                          }
                          placeholder={t("salesOrder.placeholders.selectSalesperson", {
                            defaultValue: "Select Salesperson",
                          })}
                          searchPlaceholder={t("salesOrder.placeholders.searchSalespersons", {
                            defaultValue: "Search salespersons...",
                          })}
                          disabled={!formData.business || isReadOnly}
                          alphabeticalSort={false}
                          options={
                            salespersons?.map((person) => ({
                              value: String(person._id),
                              label: person.displayName || person.name,
                              name: person.displayName || person.name,
                            })) || []
                          }
                          searchKeys={["name"]}
                        />
                      </div>
                      {formErrors.salesperson && (
                        <p className="mt-1 text-xs text-red-500">
                          {formErrors.salesperson}
                        </p>
                      )}
                    </div>
                  </div>

                </div>
              </div>

              {/* Single Column Layout: Item Table, then Summary Panel below */}
              <div className="space-y-6">
                {/* Item Table Card - same ZohoStyleItemTable as Customer Invoice & Vendor Invoice */}
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                  <ZohoStyleItemTable
                    invoiceData={invoiceDataForTable}
                    setInvoiceData={setInvoiceDataFromTable}
                    onItemChange={handleZohoLineItemChange}
                    selectedContract={null}
                    expenseAccounts={[]}
                    currency={formData.customerCurrency || baseCurrency || "MYR"}
                    errors={formErrors}
                    businessItems={businessItems}
                    taxes={taxes}
                    onBulkAdd={() => setShowBulkAddItemsModal(true)}
                    isEditMode={isEditMode}
                    businessId={formData.business}
                    headers={headers}
                    onTaxCreated={(newTax) => {
                      if (!newTax?._id) return;
                      setTaxes((prev) =>
                        prev.some((t) => String(t._id) === String(newTax._id))
                          ? prev
                          : [...prev, newTax]
                      );
                    }}
                    lineItemCustomFieldDefinitions={lineItemCustomFieldDefs}
                  />
                  {formErrors.items && (
                    <p className="text-sm text-red-500 px-6 pb-4">{formErrors.items}</p>
                  )}
                </div>

                {/* Summary and Attach Files - Horizontal Layout */}
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex-1 min-w-0">
                    <InvoiceSummaryPanel
                      invoiceData={orderSummaryInvoiceData}
                      title={t("salesOrder.summary.orderSummary", {
                        defaultValue: "Order summary",
                      })}
                      currency={
                        formData.customerCurrency || baseCurrency || "MYR"
                      }
                      onDiscountChange={(value) => {
                        const grossSubtotal = computeSalesOrderTotals(
                          formData.items,
                          0,
                          0,
                          0,
                        ).subtotal;
                        setFormData((prev) => ({
                          ...prev,
                          discountPercentage: value,
                          discount: calculateOrderDiscountAmount(
                            grossSubtotal,
                            value,
                          ),
                        }));
                      }}
                      onShippingChange={(value) =>
                        setFormData((prev) => ({
                          ...prev,
                          shippingCharges: value,
                        }))
                      }
                      onAdjustmentChange={(value) =>
                        setFormData((prev) => ({
                          ...prev,
                          adjustment: value,
                        }))
                      }
                    />
                  </div>

                  {/* Attach Files Card */}
                  <div className="flex-1 rounded-lg ">
                    {/* <div className="p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        Attach Files
                      </h3>
                      <p className="text-sm text-gray-500 mb-4">
                        {t("documents.attachmentsLimit", {
                          defaultValue: "Maximum 10 files, 5 MB each",
                        })}
                      </p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <Upload className="w-4 h-4" />
                        Upload Files
                      </button>

                      {attachments.length > 0 && (
                        <div className="mt-4 space-y-2">
                          {attachments.map((file, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                            >
                              <span className="text-sm text-gray-700 truncate flex-1">{file.name}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveFile(index)}
                                className="text-red-500 hover:text-red-700 ml-2"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div> */}
                  </div>
                </div>

                {/* Notes & Attachments Card */}
                <div className="bg-white rounded-lg shadow-sm">
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      {t("documents.notesAndAttachments", {
                        defaultValue: "Notes & Attachments",
                      })}
                    </h3>
                    {showLinkedJobOption && (
                      <div className="mb-4">
                        <label
                          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                            isEditMode
                              ? "border-gray-200 bg-gray-50 text-gray-500"
                              : "border-[#D9E5A8] bg-[#F8FBEF] text-gray-700"
                          }`}
                          title={
                            isEditMode
                              ? t("salesOrder.jobs.autoSyncHint", {
                                  defaultValue:
                                    "Linked jobs are auto-synced with {{label}} status while unassigned.",
                                  label: saleOrderLabel.toLowerCase(),
                                })
                              : t("salesOrder.jobs.createHint", {
                                  defaultValue:
                                    "Create and link a job with this {{label}}.",
                                  label: saleOrderLabel.toLowerCase(),
                                })
                          }
                        >
                          <input
                            type="checkbox"
                            checked={linkedJobChecked}
                            onChange={(e) => setCreateLinkedJob(e.target.checked)}
                            disabled={isEditMode}
                            className="h-4 w-4 rounded border-gray-300 text-[#A6C437] focus:ring-[#A6C437]"
                          />
                          {isEditMode
                            ? t("salesOrder.jobs.linked", {
                                defaultValue: "Linked Job & Scheduling",
                              })
                            : t("salesOrder.jobs.create", {
                                defaultValue: "Create Job & Scheduling",
                              })}
                        </label>
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {t("salesOrder.fields.customerNotes", {
                            defaultValue: "Customer Notes",
                          })}
                        </label>
                        <textarea
                          value={formData.customerNotes}
                          onChange={(e) =>
                            setFormData({ ...formData, customerNotes: e.target.value })
                          }
                          disabled={isReadOnly}
                          rows={4}
                          placeholder={t("salesOrder.placeholders.customerNotes", {
                            defaultValue: "Optional notes for customer",
                          })}
                          className={`w-full min-h-[6rem] px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] resize-y ${isReadOnly ? "bg-gray-100 cursor-not-allowed" : ""}`}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {t("documents.termsAndConditions", {
                            defaultValue: "Terms & Conditions",
                          })}
                        </label>
                        <div className="relative mb-3" ref={termsDropdownRef}>
                          <button
                            type="button"
                            onClick={() => !isReadOnly && setTermsDropdownOpen((o) => !o)}
                            disabled={isReadOnly}
                            className={`w-full flex items-center justify-between px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] bg-white text-left ${isReadOnly ? "bg-gray-100 cursor-not-allowed" : ""}`}
                          >
                            <span className={selectedTermsValue ? "text-gray-900" : "text-gray-500"}>
                              {selectedTermsLabel ??
                                t("documents.placeholders.selectTerms", {
                                  defaultValue: "Select terms and conditions",
                                })}
                            </span>
                            <ChevronDown className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform ${termsDropdownOpen ? "rotate-180" : ""}`} />
                          </button>
                          {termsDropdownOpen && !isReadOnly && (
                            <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg py-1 max-h-60 overflow-auto">
                              {businessData?.termsAndConditions ? (
                                <button
                                  type="button"
                                  onClick={() => handleTermsSelect("__default__")}
                                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${selectedTermsValue === "__default__" ? "bg-blue-50 text-[var(--p-blue)]" : "text-gray-900"}`}
                                >
                                  {t("common.default", { defaultValue: "Default" })}
                                </button>
                              ) : null}
                              {termsAndConditionsList.map((term) => (
                                <button
                                  key={term._id}
                                  type="button"
                                  onClick={() => handleTermsSelect(`item_${term._id}`)}
                                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${selectedTermsValue === `item_${term._id}` ? "bg-blue-50 text-[var(--p-blue)]" : "text-gray-900"}`}
                                >
                                  {term.name ||
                                    t("documents.terms", { defaultValue: "Terms" })}
                                </button>
                              ))}
                              {(businessData?.termsTemplates || []).map((term, i) => (
                                <button
                                  key={`tpl-${i}`}
                                  type="button"
                                  onClick={() => handleTermsSelect(`tpl_${i}`)}
                                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${selectedTermsValue === `tpl_${i}` ? "bg-blue-50 text-[var(--p-blue)]" : "text-gray-900"}`}
                                >
                                  {term.name ||
                                    t("documents.termsNumber", {
                                      defaultValue: "Terms {{number}}",
                                      number: i + 1,
                                    })}
                                </button>
                              ))}
                              <button
                                type="button"
                                onClick={() => handleTermsSelect("__add_new__")}
                                className="w-full px-3 py-2 text-left text-sm text-[var(--p-blue)] hover:bg-blue-50 border-t border-gray-100 mt-1"
                              >
                                {t("common.addNew", { defaultValue: "Add new" })}
                              </button>
                            </div>
                          )}
                        </div>
                        {formData.termsAndConditions ? (
                          <>
                            <textarea
                              value={formData.termsAndConditions || ""}
                              onChange={(e) =>
                                setFormData({ ...formData, termsAndConditions: e.target.value })
                              }
                              disabled={isReadOnly}
                              rows={4}
                              placeholder={t("documents.placeholders.termsContent", {
                                defaultValue:
                                  "Terms content (editable after selection)",
                              })}
                              className={`w-full min-h-[6rem] px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] resize-y ${isReadOnly ? "bg-gray-100 cursor-not-allowed" : ""}`}
                            />
                            <p className="mt-2 text-xs text-gray-500">
                              {t("documents.termsPreviewHint", {
                                defaultValue:
                                  "Terms appear on the document preview and PDF. Edit above if needed.",
                              })}
                            </p>
                          </>
                        ) : null}
                      </div>
                    </div>

                  
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex justify-between items-center pb-6">
                  {/* Template selection - Left Side */}
                  <div className="flex items-center gap-3">
                    {!isEditMode && (DocumentData?.s3Key || DocumentData?.url || DocumentData?.file?.s3Key || DocumentData?.file?.url) ? (
                      <div className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg">
                        <FileText className="w-4 h-4" />
                        <span>
                          {t("documents.selectedTemplate", {
                            defaultValue: "Selected Template",
                          })}
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsViewerOpen(true)}
                          className="text-green-700 hover:text-green-900 underline"
                        >
                          {t("common.view", { defaultValue: "View" })}
                        </button>
                      </div>
                    ) : selectedTemplateId ? (
                      <div className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg">
                        <FileText className="w-4 h-4" />
                        <span>
                          {t("documents.templateValue", {
                            defaultValue: "Template: {{name}}",
                            name:
                              selectedTemplate?.name ||
                              t("common.selected", { defaultValue: "Selected" }),
                          })}
                        </span>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              if ((!templates || templates.length === 0) && formData?.business) await fetchTemplates();
                            } catch (e) { console.warn('Error preloading templates', e); }
                            setIsModalOpen(true);
                          }}
                          className="text-green-700 hover:text-green-900 underline"
                        >
                          {t("common.change", { defaultValue: "Change" })}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            if ((!templates || templates.length === 0) && formData?.business) await fetchTemplates();
                          } catch (e) { console.warn('Error preloading templates', e); }
                          setIsModalOpen(true);
                        }}
                        disabled={loading || !selectedCustomer || !formData.items || formData.items.length === 0 || !formData?.business}
                        className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        <FileText className="w-4 h-4" />
                        {t("documents.selectPdfTemplate", {
                          defaultValue: "Select PDF Template",
                        })}
                      </button>
                    )}
                  </div>

                  {/* Save Buttons - Right Side */}
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => history.push(saleOrderListPath)}
                      className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      {t("common.cancel", { defaultValue: "Cancel" })}
                    </button>
                    
                    {/* Button Logic Based on Status */}
                    {!isClosed && (
                      <>
                        {/* Show "Save as Draft" only for Draft status or new orders */}
                        {isDraft && (
                          <button
                            type="button"
                            onClick={(e) => handleSubmit(e, "draft")}
                            disabled={loading || isReadOnly}
                            className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title={
                              isReadOnly
                                ? t("salesOrder.actions.cannotEditClosed", {
                                    defaultValue: "Cannot edit closed {{label}}",
                                    label: saleOrderLabel.toLowerCase(),
                                  })
                                : ""
                            }
                          >
                            <Save className="w-4 h-4" />
                            {loading
                              ? t("common.saving", { defaultValue: "Saving..." })
                              : t("salesOrder.actions.saveAsDraft", {
                                  defaultValue: "Save as Draft",
                                })}
                          </button>
                        )}
                        
                        {/* Show "Save" for Confirmed status (updates without changing status) */}
                        {isConfirmed && (
                          <button
                            type="button"
                            onClick={(e) => handleSubmit(e, "save")}
                            disabled={loading || isReadOnly}
                            className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title={
                              isReadOnly
                                ? t("salesOrder.actions.cannotEditClosed", {
                                    defaultValue: "Cannot edit closed {{label}}",
                                    label: saleOrderLabel.toLowerCase(),
                                  })
                                : t("salesOrder.actions.saveConfirmedHint", {
                                    defaultValue:
                                      "Save changes to confirmed {{label}}",
                                    label: saleOrderLabel.toLowerCase(),
                                  })
                            }
                          >
                            <Save className="w-4 h-4" />
                            {loading
                              ? t("common.saving", { defaultValue: "Saving..." })
                              : t("common.save", { defaultValue: "Save" })}
                          </button>
                        )}
                        
                        {/* Show "Save and Send" for both Draft and Confirmed */}
                        <button
                          type="button"
                          onClick={(e) => handleSubmit(e, "send")}
                          disabled={
                            loading ||
                            !selectedCustomer?.basicInformation?.customerEmail ||
                            isReadOnly
                          }
                          className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-[#A6C437] rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title={
                            isReadOnly
                              ? t("salesOrder.actions.cannotEditClosed", {
                                  defaultValue: "Cannot edit closed {{label}}",
                                  label: saleOrderLabel.toLowerCase(),
                                })
                              : !selectedCustomer?.basicInformation?.customerEmail
                              ? t("salesOrder.validation.customerEmailRequired", {
                                  defaultValue: "Customer email is required",
                                })
                              : ""
                          }
                        >
                          <Send className="w-4 h-4" />
                          {loading
                            ? t("common.saving", { defaultValue: "Saving..." })
                            : t("salesOrder.actions.saveAndSend", {
                                defaultValue: "Save and Send",
                              })}
                        </button>
                      </>
                    )}
                    
                    {/* Show message when Closed */}
                    {isClosed && (
                      <div className="px-4 py-2 text-sm text-gray-500 italic">
                        {t("salesOrder.closedMessage", {
                          defaultValue:
                            "This {{label}} is closed and cannot be edited",
                          label: saleOrderLabel.toLowerCase(),
                        })}
                      </div>
                    )}
                  </div>
              </div>
                </div>
            </form>
          </div>
        </div>
      </div>

      <BulkAddItemsModal
        isOpen={showBulkAddItemsModal}
        onClose={() => setShowBulkAddItemsModal(false)}
        items={businessItems}
        onAddItems={handleBulkAddItems}
        currency={formData.customerCurrency || baseCurrency || "MYR"}
      />
      <QuickAddCustomerModal
        isOpen={showQuickAddCustomer}
        onClose={() => setShowQuickAddCustomer(false)}
        businessId={formData.business}
        baseUrl={Base_URL}
        headers={headers}
        onSuccess={(newCustomer) => {
          setCustomers((prev) => {
            const has = prev.some((c) => c._id === newCustomer._id);
            return has ? prev : [...prev, newCustomer];
          });
          handleCustomerChange(newCustomer._id);
          setShowQuickAddCustomer(false);
        }}
      />
      <AddressModal
        isOpen={isAddressModalOpen}
        onClose={() => {
          setIsAddressModalOpen(false);
          setEditingAddress(null);
        }}
        addressType={addressModalType}
        customerId={selectedCustomer?._id}
        existingAddress={editingAddress}
        onSaveSuccess={async (savedAddress) => {
          if (selectedCustomer?._id) {
            try {
              const response = await axios.get(
                `${Base_URL}/customers/${selectedCustomer._id}`
              );
              const updatedCustomer = response?.data;
              setSelectedCustomer(updatedCustomer);

              const formatAddress = (addressObj) => {
                if (!addressObj) return "";
                const parts = [];
                if (addressObj.addressLine1) parts.push(addressObj.addressLine1);
                if (addressObj.addressLine2) parts.push(addressObj.addressLine2);
                if (addressObj.city) parts.push(addressObj.city);
                if (addressObj.state) parts.push(addressObj.state);
                if (addressObj.zipCode) parts.push(addressObj.zipCode);
                if (addressObj.country) parts.push(addressObj.country);
                return parts.join("\n");
              };

              const formattedAddress = formatAddress(savedAddress);

              if (addressModalType === "Billing") {
                setFormData((prev) => ({
                  ...prev,
                  billingAddress: formattedAddress,
                  shippingAddress: sameAsBilling
                    ? formattedAddress
                    : prev.shippingAddress,
                  phone: savedAddress.phone || prev.phone,
                  fax: savedAddress.fax || prev.fax,
                }));
              } else {
                setFormData((prev) => ({
                  ...prev,
                  shippingAddress: formattedAddress,
                }));
              }
            } catch (error) {
              console.error("Error refreshing customer data:", error);
            }
          }
        }}
      />

      {/* Document Template Modal */}
      <DocumentTemplateModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        contractId={null}
        onSubmit={handleGenerateDocument}
        onPreview={null}
        templates={templates}
        type={saleOrderLabel}
        businessData={businessData}
        initialTemplateId={selectedTemplateId}
      />

      {/* Document Generator */}
      {isGeneratorOpen && (
        (() => {
          const summary = computeSalesOrderTotals(
            formData.items,
            formData.discount,
            formData.shippingCharges,
            formData.adjustment
          );
          return (
        <DocumentGenerator
          open={isGeneratorOpen}
          onClose={() => setIsGeneratorOpen(false)}
          templateId={selectedTemplateId}
          templateData={selectedTemplate}
          invoiceData={{
            ...formData,
            location: "sales-orders",
            // Sales Order specific fields
            salesOrderNumber: formData.salesOrderNumber,
            invoice_number: formData.salesOrderNumber,
            invoiceNumber: formData.salesOrderNumber,
            // Customer information - extract properly from selectedCustomer object
            customer: selectedCustomer,
            customer_name: selectedCustomer?.basicInformation?.companyName || 
                          selectedCustomer?.basicInformation?.customerDisplayName || 
                          selectedCustomer?.name ||
                          t("common.customer", { defaultValue: "Customer" }),
            customerCompany: selectedCustomer?.companyInfo?.companyName ||
                            selectedCustomer?.basicInformation?.companyName ||
                            selectedCustomer?.basicInformation?.customerDisplayName ||
                            "",
            customerEmail: selectedCustomer?.basicInformation?.customerEmail || "",
            customer_email: selectedCustomer?.basicInformation?.customerEmail || "",
            // Dates - ensure proper formatting (YYYY-MM-DD)
            invoiceDate: formData.salesOrderDate ? (formData.salesOrderDate instanceof Date 
              ? formData.salesOrderDate.toISOString().split("T")[0]
              : formData.salesOrderDate.split("T")[0]) : "",
            invoice_date: formData.salesOrderDate ? (formData.salesOrderDate instanceof Date 
              ? formData.salesOrderDate.toISOString().split("T")[0]
              : formData.salesOrderDate.split("T")[0]) : "",
            dueDate: formData.dueDate ? (formData.dueDate instanceof Date 
              ? formData.dueDate.toISOString().split("T")[0]
              : formData.dueDate.split("T")[0]) : "",
            due_date: formData.dueDate ? (formData.dueDate instanceof Date 
              ? formData.dueDate.toISOString().split("T")[0]
              : formData.dueDate.split("T")[0]) : "",
            // Addresses - ensure they're strings, not objects
            billingAddress: typeof formData.billingAddress === "string" 
              ? formData.billingAddress 
              : (formData.billingAddress && typeof formData.billingAddress === "object"
                ? Object.values(formData.billingAddress).filter(Boolean).join(", ")
                : ""),
            shippingAddress: typeof formData.shippingAddress === "string" 
              ? formData.shippingAddress 
              : (formData.shippingAddress && typeof formData.shippingAddress === "object"
                ? Object.values(formData.shippingAddress).filter(Boolean).join(", ")
                : ""),
            phoneNumber: formData.phone || "",
            customerPhone: formData.phone || "",
            customer_phone: formData.phone || "",
            faxNumber: formData.fax || "",
            // Ship To fields - extract from customer if needed
            shipToName: selectedCustomer?.basicInformation?.customerDisplayName || 
                        selectedCustomer?.basicInformation?.customerName ||
                        selectedCustomer?.name ||
                        "",
            shipToCompany: selectedCustomer?.companyInfo?.companyName ||
                          selectedCustomer?.basicInformation?.companyName ||
                          "",
            shipToPhone: formData.phone || "",
            shipToEmail: selectedCustomer?.basicInformation?.customerEmail || "",
            // Payment terms
            terms: formData.paymentTerms,
            // Items - map sales order items to invoice format (include taxRate so DocumentGenerator can show article tax)
            items: (formData.items || []).map((item) => {
              const computed = computeSalesOrderItem(item);
              const lineName = String(item.itemName ?? "").trim();
              const lineDesc = String(item.description ?? "").trim();
              return {
                itemName: lineName,
                item: lineName,
                name: lineName,
                title: lineName,
                description: lineDesc,
                goods_description: lineDesc || lineName,
                quantity: computed.quantity,
                rate: computed.rate,
                unitPrice: computed.rate,
                tax: computed.taxAmount,
                taxAmount: computed.taxAmount,
                taxRate: computed.taxRate,
                discount: computed.discount,
                discountAmount: computed.discount,
                amount: computed.amount,
                total: computed.amount,
                totalValue: computed.amount,
                ...(item.lineItemCustomFields &&
                typeof item.lineItemCustomFields === "object" &&
                Object.keys(item.lineItemCustomFields).length
                  ? { lineItemCustomFields: { ...item.lineItemCustomFields } }
                  : {}),
              };
            }),
            // Financial summary — subtotal = sum of line totals (incl. tax)
            subTotal: summary.subtotal,
            subtotal: summary.subtotal,
            discount: formData.discount || 0,
            discountAmount: formData.discount || 0,
            discountPercentage:
              formData.discountPercentage ||
              calculateOrderDiscountPercentage(summary.subtotal, formData.discount),
            shippingCharges: formData.shippingCharges || 0,
            tax: summary.taxTotal,
            taxTotal: summary.taxTotal,
            adjustment: formData.adjustment || 0,
            total: summary.total,
            grandTotal: summary.total,
            // Currency
            currency: formData.customerCurrency || baseCurrency || "MYR",
            // Notes
            customerNotes: formData.customerNotes || "",
            notes: formData.customerNotes || "",
            termsAndConditions: formData.termsAndConditions || "",
          }}
          businessData={businessData}
          business_id={formData?.business}
          contract={null}
          accountTypeName=""
          adminInfo={adminInfo}
          proformaInvoice={true}
          onSuccess={handleGenerationSuccess}
          contractDetails={null}
          savedRecordIdForPdf={isEditMode ? id : undefined}
          pdfModule="sales"
          pdfScreen="sales_order"
          documentCustomFieldDefinitions={salesOrderFieldDefinitions}
          documentCustomFieldValues={customFieldValues}
          lineItemCustomFieldDefinitions={lineItemCustomFieldDefs}
        />
          );
        })()
      )}
      {isViewerOpen && (
        <DocumentViewer
          business_id={formData?.business}
          open={isViewerOpen}
          onClose={() => setIsViewerOpen(false)}
          documentUrl={DocumentData?.s3Key || DocumentData?.url || DocumentData?.file?.s3Key || DocumentData?.file?.url}
          contractNo={formData?.orderNumber || formData?.salesOrderNumber}
          invoiceNumber={formData?.salesOrderNumber || formData?.orderNumber}
        />
      )}
      {/* Add new Terms & Conditions modal */}
      {addTermsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => !savingNewTerm && setAddTermsModalOpen(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {t("documents.addTermsTitle", {
                defaultValue: "Add new Terms & Conditions",
              })}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("common.name", { defaultValue: "Name" })}
                </label>
                <input
                  type="text"
                  value={newTermName}
                  onChange={(e) => setNewTermName(e.target.value)}
                  placeholder={t("documents.placeholders.termsNameExample", {
                    defaultValue: "e.g. Standard, Net 30",
                  })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("common.content", { defaultValue: "Content" })}
                </label>
                <textarea
                  value={newTermContent}
                  onChange={(e) => setNewTermContent(e.target.value)}
                  rows={6}
                  placeholder={t("documents.placeholders.enterTerms", {
                    defaultValue: "Enter terms and conditions text...",
                  })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] resize-y"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setAddTermsModalOpen(false);
                  setNewTermName("");
                  setNewTermContent("");
                }}
                disabled={savingNewTerm}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                {t("common.cancel", { defaultValue: "Cancel" })}
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!newTermName.trim() || !formData.business) return;
                  setSavingNewTerm(true);
                  try {
                    await axios.post(
                      `${Base_URL}/items/Terms and Conditions/add`,
                      {
                        name: newTermName.trim(),
                        content: newTermContent.trim(),
                        status: "active",
                        business_id: formData.business,
                      },
                      { headers }
                    );
                    const res = await axios.post(
                      `${Base_URL}/items/Terms and Conditions/get_all`,
                      { business_id: formData.business, FilterStatus: "active", FilterName: "" },
                      { headers }
                    );
                    setTermsAndConditionsList(res.data?.success ? res.data.data || [] : []);
                    setFormData((prev) => ({ ...prev, termsAndConditions: newTermContent.trim() }));
                    setAddTermsModalOpen(false);
                    setNewTermName("");
                    setNewTermContent("");
                    notifySuccess(
                      t("documents.notifications.termsAdded", {
                        defaultValue: "Terms & Conditions added.",
                      })
                    );
                  } catch (err) {
                    console.error("Error saving terms:", err);
                    notifyError(
                      err.response?.data?.message ||
                        t("documents.notifications.termsSaveFailed", {
                          defaultValue: "Failed to save terms.",
                        })
                    );
                  } finally {
                    setSavingNewTerm(false);
                  }
                }}
                disabled={savingNewTerm || !newTermName.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-[var(--p-blue)] rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                {savingNewTerm
                  ? t("common.saving", { defaultValue: "Saving..." })
                  : t("common.save", { defaultValue: "Save" })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
