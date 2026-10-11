import React, { useState, useEffect, useContext, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  Save,
  X,
  Plus,
  UserPlus,
  Trash2,
  Eye,
  Pencil,
  Upload,
  Building2,
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
import PurchaseOrderServices from "@/services/PurchaseOrderServices";
import SearchableDropdown from "@/components/SearchableDropdown";
import SingleBusinessField from "@/components/SingleBusinessField";
import CustomDatePicker from "@/components/CustomDatePicker";
import { PageHeader } from "@/page-layouts";
import { formatCurrencyAmount } from "@/components/formatAmount";
import DocumentTemplateModal from "@/pages/SalesContract/actions/DocumentTemplates";
import DocumentGenerator from "@/pages/Accounts/CustomerInvoice/DocumentGenerator";
import DocumentViewer from "@/pages/Accounts/CustomerInvoice/document-viewer";
import BulkAddItemsModal from "@/components/customer-invoices/BulkAddItemsModal";
import QuickAddVendorModal from "@/components/vendor-invoices/QuickAddVendorModal";
import AddressModal from "@/components/AddressModal";
import ZohoStyleItemTable from "@/components/invoice/ZohoStyleItemTable";
import AddPaymentTermButton from "@/components/AddPaymentTermButton";
import { getNextDocumentNumber } from "@/services/documentSequenceServices";
import { calculateDueDate, getPaymentTermFromDueDate } from "@/utils/calculateDueDate";
import { getLineSubtotal, getItemTotal, clampDiscountPercent } from "@/utils/itemDiscountUtils";
import { calculateOrderDiscountPercentage } from "@/utils/invoiceContractMapper";
import ModuleAccessGate from "@/components/ModuleAccessGate";
import { PERMISSION_ACTION } from "@/utils/permissionUtils";
import DynamicCustomFieldsForm from "@/components/custom-fields/DynamicCustomFieldsForm";
import {
  fetchDefinitions,
  fetchLineItemCustomFieldDefinitions,
  upsertValues,
} from "@/services/customFieldServices";
import { validateCustomFieldValues } from "@/utils/customFieldValidation";
import { shouldRenderCustomFieldAtSlot } from "@/utils/customFieldPlacement";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

// Map Purchase Order formData to invoice-style data for ZohoStyleItemTable
function soToInvoiceData(formData, baseCurrency) {
  const items = (formData.items || []).map((i) => ({
    id: i.id,
    itemId: i.itemId,
    // Catalog `itemName` must not fall back to `description` or the item box mirrors the note field and breaks typing.
    // Do not trim here: trailing spaces are valid while typing multi-word names.
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

// Map invoice-style items back to Purchase Order formData items
function invoiceItemsToSo(invoiceItems) {
  return (invoiceItems || []).map((i, idx) => {
    const qty = parseFloat(i.quantity) || 0;
    const unitPrice = parseFloat(i.unitPrice) || 0;
    const discount = parseFloat(i.discount) || 0;
    const lineSub = getLineSubtotal(qty, unitPrice, discount);
    const total = parseFloat(i.total) || 0;
    const resolvedTaxRate =
      parseFloat(i.taxRate) ||
      parseFloat(i?.tax?.rate) ||
      parseFloat(i?.tax?.percentage) ||
      0;
    const tax =
      parseFloat(i.tax) ||
      parseFloat(i.taxAmount) ||
      (total - lineSub);
    const resolvedTaxId =
      i.taxId ||
      i.tax_id ||
      i?.tax?._id ||
      "";
    const resolvedTaxName =
      i.taxName ||
      i.tax_name ||
      i?.tax?.name ||
      "";
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
      taxRate: resolvedTaxRate,
      taxId: resolvedTaxId,
      taxName: resolvedTaxName,
      discount,
      amount: total,
      lineItemCustomFields:
        i.lineItemCustomFields && typeof i.lineItemCustomFields === "object"
          ? { ...i.lineItemCustomFields }
          : {},
    };
  });
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

export default function PurchaseOrderForm() {
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
  /** Saved + pending PO file attachments (uploaded to S3; includeInEmail controls email send). */
  const [poFileAttachments, setPoFileAttachments] = useState([]);
  const [poAttachmentUploading, setPoAttachmentUploading] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [DocumentData, setDocumentData] = useState({});
  const documentSnapshotRef = useRef(null);
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
  const [selectedDeliveryBusinessAddressId, setSelectedDeliveryBusinessAddressId] = useState("");
  const [deletingDeliveryAddressId, setDeletingDeliveryAddressId] = useState(null);
  const [isDeliveryAddressDropdownOpen, setIsDeliveryAddressDropdownOpen] = useState(false);
  const [customFieldValues, setCustomFieldValues] = useState({});
  const [lineItemCustomFieldDefs, setLineItemCustomFieldDefs] = useState([]);
  const [purchaseOrderFieldDefinitions, setPurchaseOrderFieldDefinitions] =
    useState([]);

  // Pre-fill (vendor + line items) passed via history.push("/purchase-orders/create", {...})
  // e.g. from the Purchase Planning report's "Create PO" action.
  const purchasePlanningPrefill = !isEditMode ? location.state : null;

  const [formData, setFormData] = useState({
    business: purchasePlanningPrefill?.business || "",
    customer: purchasePlanningPrefill?.customer || "",
    purchaseOrderNumber: "",
    referenceNumber: "",
    salesOrderDate: new Date().toISOString().split("T")[0],
    expectedShipmentDate: "",
    warehouse: "",
    paymentTerms: "",
    paymentTermId: "",
    dueDate: "",
    deliveryMethod: "",
    salesperson: "",
    billingAddress: "",
    shippingAddress: "",
    deliveryAddress: "",
    phone: "",
    fax: "",
    customerCurrency: "",
    items: purchasePlanningPrefill?.items?.length
      ? purchasePlanningPrefill.items.map((it, idx) => ({
          id: idx + 1,
          itemId: it.itemId || "",
          itemName: it.itemName || "",
          description: it.description || it.itemName || "",
          quantity: parseFloat(it.quantity) || 1,
          rate: parseFloat(it.rate) || 0,
          tax: 0,
          taxRate: 0,
          amount: (parseFloat(it.quantity) || 1) * (parseFloat(it.rate) || 0),
          lineItemCustomFields: {},
        }))
      : [
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

  // Business base currency; used as fallback when vendor currency is missing.
  const [baseCurrency, setBaseCurrency] = useState("MYR");

  const purchaseOrderBusinessId = useMemo(() => {
    const b = formData.business;
    if (!b) return "";
    return typeof b === "object" ? b._id || "" : String(b);
  }, [formData.business]);

  useEffect(() => {
    if (!purchaseOrderBusinessId) {
      setLineItemCustomFieldDefs([]);
      setPurchaseOrderFieldDefinitions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [lineDefs, docDefs] = await Promise.all([
          fetchLineItemCustomFieldDefinitions(
            {
              businessId: purchaseOrderBusinessId,
              transactionContext: "purchase:purchase_order",
            },
            headers,
          ),
          fetchDefinitions(
            {
              businessId: purchaseOrderBusinessId,
              module: "purchase",
              screen: "purchase_order",
            },
            headers,
          ),
        ]);
        if (!cancelled) {
          setLineItemCustomFieldDefs(lineDefs || []);
          setPurchaseOrderFieldDefinitions(docDefs || []);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setLineItemCustomFieldDefs([]);
          setPurchaseOrderFieldDefinitions([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [purchaseOrderBusinessId, adminInfo?.token]);

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
        taxId: item.taxId || item?.taxOnItem?._id || "",
        taxName: item.taxName || "",
        unit: item.unit || "",
        itemType: item.itemType || "",
        lineItemCustomFields: {},
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
        const taxRate = parseFloat(existing.taxRate) || 0;
        const newTaxAmount = taxRate > 0
          ? (getLineSubtotal(newQty, rate, discount) * taxRate) / 100
          : 0;
        merged[existingIndex] = {
          ...existing,
          quantity: newQty,
          tax: newTaxAmount,
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

    notifySuccess(`${newItems.length} item(s) added successfully`);
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
        notifyError("Failed to load businesses");
      }
    };

    fetchBusinesses();
  }, [adminInfo?.id]);

  // Preview next PO number without incrementing — fires after businessData is loaded
  useEffect(() => {
    if (!businessData?._id || isEditMode) return;

    const fetchPreview = async () => {
      const businessGroupId = businessData.businessGroup?._id || businessData.businessGroup;
      try {
        const res = await getNextDocumentNumber("purchase_order", businessData._id, businessGroupId);
        setFormData((prev) => ({
          ...prev,
          purchaseOrderNumber: res.data?.nextNumber,
        }));
        setDocNumMissing(res.data?.isFallback === true);
      } catch (err) {
        console.error("Error fetching PO number preview:", err);
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

  // Fetch vendors when business is selected
  useEffect(() => {
    const fetchVendors = async () => {
      if (!formData.business) {
        setCustomers([]);
        return;
      }

      try {
        const vendorResponse = await axios.get(`${Base_URL}/vendors`, {
          headers,
          params: {
            business: formData.business,
            limit: 9999,
          },
        });

        const vendorList = vendorResponse?.data?.data || vendorResponse?.data?.vendors || [];
        if (Array.isArray(vendorList)) {
          // Only Active vendors in the selector (missing status treated as Active)
          setCustomers(
            vendorList.filter(
              (v) => String(v?.status ?? "Active").toLowerCase() === "active"
            )
          );
        } else {
          setCustomers([]);
        }
      } catch (error) {
        console.error("Error fetching vendors:", error);
        setCustomers([]);
      }
    };

    fetchVendors();
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

  // Backfill missing taxId on existing purchase order rows (older data may only have taxRate/taxName).
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
  }, [taxes]);

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
        const [deliveryResponse, salespersonsResponse, paymentTermsResponse] =
          await Promise.all([
            PurchaseOrderServices.getDeliveryMethods(formData.business, headers),
            PurchaseOrderServices.getSalespersons(formData.business, headers),
            axios.post(
              `${Base_URL}/items/Vendor Payment Terms/get_all`,
              {
                business_id: formData.business,
                FilterStatus: "active",
                FilterName: "",
              },
              { headers }
            ),
          ]);

        setDeliveryMethods(
          deliveryResponse?.data?.success ? deliveryResponse.data.data || [] : []
        );
        setSalespersons(
          salespersonsResponse?.data?.success
            ? salespersonsResponse.data.data || []
            : []
        );
        if (paymentTermsResponse.data.success) {
          setPaymentTerms(paymentTermsResponse.data.data || []);
        } else {
          setPaymentTerms([]);
        }
      } catch (error) {
        console.error("Error fetching settings data:", error);
        setDeliveryMethods([]);
        setSalespersons([]);
        setPaymentTerms([]);
      }
    };

    fetchSettingsData();
  }, [formData.business]);

  const deliveryAddressOptions = useMemo(() => {
    // Extract only addresses of the requested type.
    // Note: older/untyped records are treated as the requested type for backward compatibility.
    const matchesType = (addressObj, requestedType) => {
      const rawType =
        addressObj?.addressType ?? addressObj?.type ?? addressObj?.address_type ?? "";
      const normalized = String(rawType || "").trim();
      if (!normalized) return true; // untyped -> treat as requested type
      return normalized === requestedType;
    };

    const formatAddress = (addressObj) => {
      if (!addressObj) return "";
      if (typeof addressObj === "string") return addressObj;
      if (typeof addressObj !== "object") return "";
      return [
        addressObj.addressLine1,
        addressObj.addressLine2,
        addressObj.city,
        addressObj.state,
        addressObj.zipCode,
        addressObj.country,
      ]
        .filter(Boolean)
        .join(", ")
        .trim();
    };

    const options = [];
    const pushIfValid = (value, addressObj, label, isPrimary = false) => {
      if (!isPrimary && (value === null || value === undefined || value === "")) return;
      const addressText = formatAddress(addressObj);
      const normalized = String(addressText || "").trim().replace(/\n/g, ", ");
      if (!normalized) return;
      if (options.some((opt) => opt.value === String(value))) return;
      options.push({
        value: String(value),
        addressText: normalized,
        label: `${label}${normalized ? ` - ${normalized}` : ""}`,
        name: `${label} ${normalized}`.trim(),
        isPrimary,
        rawAddress: addressObj,
      });
    };

    if (businessData) {
      const businessName = businessData?.name || businessData?.businessName || "Business";
      const requestedType = "Delivery";

      // Primary business address (if present) is treated as the requested type unless it explicitly has a different type.
      if (matchesType(businessData?.address, requestedType)) {
        pushIfValid("primary", businessData?.address, businessName, true);
      }

      if (Array.isArray(businessData?.addresses)) {
        businessData.addresses.forEach((addr) => {
          if (!matchesType(addr, requestedType)) return;
          pushIfValid(addr?._id, addr, businessName, false);
        });
      }
    }

    return options;
  }, [businessData]);

  useEffect(() => {
    if (!formData.business) return;
    if (formData.deliveryAddress?.trim()) return;

    const preferred = deliveryAddressOptions[0];

    if (!preferred?.addressText) return;
    setSelectedDeliveryBusinessAddressId(preferred.value || "");
    setFormData((prev) => (prev.deliveryAddress?.trim() ? prev : { ...prev, deliveryAddress: preferred.addressText }));
  }, [formData.business, formData.deliveryAddress, deliveryAddressOptions]);

  useEffect(() => {
    if (!formData.deliveryAddress) {
      setSelectedDeliveryBusinessAddressId("");
      return;
    }
    const matched = deliveryAddressOptions.find(
      (opt) => opt.addressText === String(formData.deliveryAddress || "").trim().replace(/\n/g, ", ")
    );
    setSelectedDeliveryBusinessAddressId(matched?.value || "");
  }, [formData.deliveryAddress, deliveryAddressOptions]);

  const openDeliveryAddressModalForAdd = () => {
    setIsDeliveryAddressDropdownOpen(false);
    setAddressModalType("Delivery");
    setEditingAddress(null);
    setIsAddressModalOpen(true);
  };

  const openDeliveryAddressModalForEdit = (addressObj) => {
    if (!addressObj) return;
    setIsDeliveryAddressDropdownOpen(false);
    setAddressModalType("Delivery");
    setEditingAddress(addressObj);
    setIsAddressModalOpen(true);
  };

  const handleDeleteDeliveryAddress = async (addressObj) => {
    if (!addressObj?._id || !formData.business || isReadOnly) return;
    const idStr = String(addressObj._id);
    if (deletingDeliveryAddressId === idStr) return;

    // Safety: allow explicit untyped/primary guard.
    if (idStr === "primary") return;

    const ok = window.confirm("Delete this delivery address?");
    if (!ok) return;

    setDeletingDeliveryAddressId(idStr);
    try {
      await axios.delete(
        `${Base_URL}/Business/${formData.business}/addresses/${addressObj._id}`,
        { headers }
      );

      const response = await axios.get(`${Base_URL}/business/${formData.business}`, { headers });
      const updatedBusiness = response?.data?.data || response?.data;
      setBusinessData(updatedBusiness);
      setSelectedDeliveryBusinessAddressId("");
      setFormData((prev) => ({ ...prev, deliveryAddress: "" }));
      notifySuccess("Delivery address deleted successfully");
    } catch (error) {
      console.error("Error deleting delivery address:", error);
      notifyError(error.response?.data?.message || "Failed to delete delivery address");
    } finally {
      setDeletingDeliveryAddressId(null);
    }
  };

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
    if (selectedTermsValue === "__default__") return "Default";
    if (selectedTermsValue.startsWith("item_")) {
      const id = selectedTermsValue.replace("item_", "");
      const t = termsAndConditionsList.find((x) => x._id === id);
      return t?.name || "Terms";
    }
    if (selectedTermsValue.startsWith("tpl_")) {
      const idx = parseInt(selectedTermsValue.replace("tpl_", ""), 10);
      const t = (businessData?.termsTemplates || [])[idx];
      return t?.name || `Terms ${idx + 1}`;
    }
    return null;
  }, [selectedTermsValue, termsAndConditionsList, businessData?.termsTemplates]);

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

  // Auto-calculate due date when payment term or purchase order date changes (uses Number of Days from term when available)
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
        paymentTermId: selectedTerm?._id || prev.paymentTermId || "",
      }));
    }
  }, [formData.paymentTerms, formData.salesOrderDate, paymentTerms]);

  // Fetch purchase order data if editing
  useEffect(() => {
    const fetchSalesOrder = async () => {
      if (!isEditMode || !id) return;

      try {
        setLoading(true);
        const response = await PurchaseOrderServices.getSalesOrderById(id, headers);
        if (response.data.success) {
          const orderData = response.data.data;
          // If this purchase order already has a generated document, load its full data
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
            console.warn("Could not load related document data for purchase order edit", docErr);
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

          const paymentTermsRaw =
            orderData.paymentTerms ??
            orderData.payment_terms ??
            orderData.terms ??
            "";
          const paymentTermsStr =
            typeof paymentTermsRaw === "object" && paymentTermsRaw
              ? (paymentTermsRaw.name || paymentTermsRaw.value || paymentTermsRaw.label || "")
              : (paymentTermsRaw || "");
          const paymentTermId =
            orderData.paymentTermId ||
            orderData.payment_term_id ||
            (typeof paymentTermsRaw === "object" && paymentTermsRaw
              ? (paymentTermsRaw._id || paymentTermsRaw.id || "")
              : "");
          
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
          const customerSource = orderData.customer || orderData.vendor || orderData.supplier || null;
          const customerId = customerSource && typeof customerSource === "object"
            ? (customerSource._id || customerSource.id || String(customerSource))
            : customerSource;

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

          const populatedVendor = customerSource && typeof customerSource === "object" ? customerSource : null;
          const vendorAddresses = populatedVendor?.addresses || [];
          const billingAddressObj = vendorAddresses.find((a) => a.addressType === "Billing");
          const shippingAddressObj =
            vendorAddresses.find((a) => a.addressType === "Shipping") ||
            billingAddressObj;
          const fallbackBillingAddress = billingAddressObj
            ? formatAddress(billingAddressObj).replace(/\n/g, ", ")
            : populatedVendor?.companyInfo?.billingAddress || "";
          const fallbackShippingAddress = shippingAddressObj
            ? formatAddress(shippingAddressObj)
            : populatedVendor?.companyInfo?.shippingAddress || "";
          const fallbackPhone =
            billingAddressObj?.phone ||
            shippingAddressObj?.phone ||
            populatedVendor?.basicInformation?.vendorPhone?.mobile ||
            populatedVendor?.basicInformation?.vendorPhone?.workPhone ||
            populatedVendor?.companyInfo?.phone ||
            "";
          const fallbackFax =
            billingAddressObj?.fax ||
            shippingAddressObj?.fax ||
            populatedVendor?.companyInfo?.fax ||
            "";

          // Normalize line items once; reuse for order-level discount % (must match calculateOrderDiscountAmount base).
          // Backend historically stored `subtotal` as sum of line amounts (tax-incl.) on some updates — do not derive % from it.
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

          const preTaxSubtotalForOrderDiscount = computeSalesOrderTotals(
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
            warehouse:
              orderData.warehouse?._id ||
              orderData.warehouse ||
              "",
            paymentTerms: paymentTermsStr,
            paymentTermId,
            dueDate: dueDateStr,
            billingAddress: orderData.billingAddress || orderData.billing_address || fallbackBillingAddress || "",
            shippingAddress: orderData.shippingAddress || orderData.shipping_address || fallbackShippingAddress || "",
            phone: orderData.phone || fallbackPhone || "",
            fax: orderData.fax || fallbackFax || "",
            deliveryMethod: orderData.deliveryMethod || orderData.delivery_method || orderData.delivery || "",
            deliveryAddress:
              orderData.deliveryAddress ||
              orderData.delivery_address ||
              orderData.deliveryAddressText ||
              "",
            salesperson: orderData.salesperson || orderData.salesPerson || orderData.sales_person || "",
            items: editedItemsFromApi,
            discountPercentage: calculateOrderDiscountPercentage(
              preTaxSubtotalForOrderDiscount,
              orderData.discount,
            ),
          });
          const normalizedBilling = (
            orderData.billingAddress ||
            orderData.billing_address ||
            fallbackBillingAddress ||
            ""
          )
            .replace(/\n/g, ", ")
            .trim();
          const normalizedShipping = (
            orderData.shippingAddress ||
            orderData.shipping_address ||
            fallbackShippingAddress ||
            ""
          )
            .replace(/\n/g, ", ")
            .trim();
          setSameAsBilling(
            typeof orderData.sameAsBilling === "boolean"
              ? orderData.sameAsBilling
              : !!normalizedBilling && normalizedBilling === normalizedShipping
          );
          if (populatedVendor) {
            // Keep full customer object in selectedCustomer for previews and auto-fill
            setSelectedCustomer(populatedVendor);
          } else if (customerId) {
            // Ensure vendor data is fetched in edit mode when API returns only ID
            await handleCustomerChange(customerId);
          }
          
          // Extract currency: prefer purchase order currency, fallback to customer currency
          let currencyDisplay = "";
          
          // Check if purchase order has currency (should be a string like "AED", "USD")
          if (orderData.currency) {
            // Check if it's a valid currency string (not an ObjectId)
            // ObjectIds are 24 hex characters, currency codes are typically 3 characters
            const isObjectId = /^[0-9a-fA-F]{24}$/.test(orderData.currency);
            if (!isObjectId && typeof orderData.currency === "string") {
              // It's a valid currency string
              currencyDisplay = orderData.currency;
            }
          }
          
          // If no valid currency from purchase order, try customer currency
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

          const rawAtt = orderData.attachments;
          if (Array.isArray(rawAtt) && rawAtt.length) {
            setPoFileAttachments(
              rawAtt
                .map((a) => ({
                  fileId: a.fileId || a._id,
                  name: a.fileName || a.name || "attachment",
                  s3Key: a.s3Key,
                  url: a.fileUrl || a.url || "#",
                  size: a.fileSize || a.size || 0,
                  includeInEmail: a.includeInEmail !== false,
                }))
                .filter((a) => a.s3Key || a.fileId)
            );
          } else {
            setPoFileAttachments([]);
          }
        } else {
          notifyError("Failed to fetch purchase order");
          history.push("/purchase-orders");
        }
      } catch (error) {
        console.error("Error fetching purchase order:", error);
        notifyError("Failed to fetch purchase order");
        history.push("/purchase-orders");
      } finally {
        setLoading(false);
      }
    };

    fetchSalesOrder();
  }, [id, isEditMode]);

  // Auto-fill vendor data when vendor is selected
  const handleCustomerChange = async (customerId) => {
    try {
      const response = await axios.get(`${Base_URL}/vendors/${customerId}`, {
        headers,
      });
      const customerData = response?.data?.data || response?.data;
      setSelectedCustomer(customerData);

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
      const billingAddressObj = addresses.find(
        (addr) => addr.addressType === "Billing"
      );
      const shippingAddressObj =
        addresses.find((addr) => addr.addressType === "Shipping") ||
        addresses.find((addr) => !addr.addressType || addr.addressType === ""); // Fallback to address without type

      // Format addresses
      const billingAddress = billingAddressObj
        ? formatAddress(billingAddressObj)
        : customerData?.companyInfo?.billingAddress || "";
      const shippingAddress = shippingAddressObj
        ? formatAddress(shippingAddressObj)
        : customerData?.companyInfo?.shippingAddress || "";

      // Get phone and fax from address objects or fallback to vendor info
      const phoneNumber =
        billingAddressObj?.phone ||
        shippingAddressObj?.phone ||
        customerData?.basicInformation?.vendorPhone?.mobile ||
        customerData?.basicInformation?.vendorPhone?.workPhone ||
        customerData?.companyInfo?.phone ||
        "";
      const faxNumber =
        billingAddressObj?.fax ||
        shippingAddressObj?.fax ||
        customerData?.companyInfo?.fax ||
        "";

      // Get vendor currency
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
        // Prefer vendor currency; fall back to business base currency then MYR.
        customerCurrency: currencyDisplay || baseCurrency || "MYR",
      }));
    } catch (error) {
      notifyError("Failed to fetch vendor details");
    }
  };

  // Populate vendor address/currency when arriving with a pre-filled vendor
  // (e.g. from the Purchase Planning report's "Create PO" action).
  useEffect(() => {
    if (purchasePlanningPrefill?.customer) {
      handleCustomerChange(purchasePlanningPrefill.customer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      formData.deliveryAddress || "",
      formData.phone || "",
      formData.fax || "",
      formData.purchaseOrderNumber || "",
      formData.referenceNumber || "",
      formData.salesOrderDate || "",
      formData.paymentTerms || "",
      formData.dueDate || "",
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
    formData.deliveryAddress,
    formData.phone,
    formData.fax,
    formData.purchaseOrderNumber,
    formData.referenceNumber,
    formData.salesOrderDate,
    formData.paymentTerms,
    formData.dueDate,
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

    if (!formData.business) errors.business = "Business is required";
    if (!formData.customer) errors.customer = "Vendor is required";
    if (!formData.salesOrderDate) errors.salesOrderDate = "Purchase Order Date is required";
    if (!formData.paymentTerms) errors.paymentTerms = "Payment Terms is required";
    if (!formData.dueDate) errors.dueDate = "Due Date is required";
    if (!formData.deliveryAddress?.trim()) errors.deliveryAddress = "Delivery Address is required";
    if ((parseFloat(formData.discountPercentage) || 0) > 100) {
      errors.discountPercentage = "Discount cannot exceed 100%.";
    }

    // Validate items
    if (!formData.items || formData.items.length === 0) {
      errors.items = "At least one item is required";
    } else {
      formData.items.forEach((item, index) => {
        if (!item.quantity || item.quantity <= 0) {
          errors[`items.${index}.quantity`] = "Quantity must be greater than 0";
        }
        if (!item.rate || item.rate <= 0) {
          errors[`items.${index}.rate`] = "Rate must be greater than 0";
        }
      });
    }

    setFormErrors(errors);
    return { isValid: Object.keys(errors).length === 0, errors };
  };

  const uploadPoAttachmentFile = async (file) => {
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
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      notifyError("File size must be less than 10MB");
      return;
    }
    if (!formData.business || !formData.customer) {
      notifyError("Select business and vendor before uploading files");
      return;
    }
    if (poFileAttachments.length >= 10) {
      notifyError("Maximum 10 files allowed");
      return;
    }

    let businessId = formData.business;
    if (businessId && typeof businessId === "object" && businessId._id) {
      businessId = businessId._id;
    }
    const formDataForUpload = new FormData();
    formDataForUpload.append(
      "file_path",
      `PurchaseOrderAttachments/${formData.purchaseOrderNumber || formData.salesOrderNumber || Date.now()}`
    );
    formDataForUpload.append("business_id", businessId);
    formDataForUpload.append("customer_id", formData.customer);
    formDataForUpload.append("file_type", file.type);
    formDataForUpload.append("file_size", file.size);
    formDataForUpload.append("file", file);

    setPoAttachmentUploading(true);
    try {
      const response = await axios.post(
        `${Base_URL}/documents/uploadDocument`,
        formDataForUpload,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      if (response.data.message === "File uploaded successfully") {
        const uploadedFile = response.data.file;
        setPoFileAttachments((prev) => [
          ...prev,
          {
            fileId: uploadedFile._id,
            name: uploadedFile.name,
            s3Key: uploadedFile.s3Key,
            url: uploadedFile.url || "#",
            size: file.size,
            includeInEmail: true,
          },
        ]);
        notifySuccess("File attached");
      } else {
        notifyError("Upload failed");
      }
    } catch (err) {
      console.error("PO attachment upload error:", err);
      notifyError(err?.response?.data?.message || "Upload failed");
    } finally {
      setPoAttachmentUploading(false);
    }
  };

  const handlePoAttachmentInputChange = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    for (const f of files) {
      await uploadPoAttachmentFile(f);
    }
  };

  const removePoAttachment = (idOrKey) => {
    setPoFileAttachments((prev) =>
      prev.filter(
        (a) =>
          String(a.fileId || "") !== String(idOrKey) &&
          String(a.s3Key || "") !== String(idOrKey)
      )
    );
  };

  // Fetch templates for Purchase Orders - same approach as CreateCustomerInvoice
  const fetchTemplates = async () => {
    // Don't fetch if business is not set
    if (!formData?.business) {
      return;
    }

    try {
      const businessTemplates = await axios.get(
        `${Base_URL}/business-templates/${formData?.business}`
      );
      const desiredType = "Purchase Order"; // For purchase orders, look for Purchase Order type templates

      const assignments = businessTemplates?.data?.data || [];

      // NOTE: /business-templates returns assignment objects:
      // { businessId, templateId (populated), type, isActive, isDefault }
      // Some setups store invoice type on assignment.type; others store it on templateId.type.
      // We accept either to avoid empty lists.
      const salesOrderTemplates = assignments.filter((a) => {
        if (!a || a.isActive !== true) return false;
        const assignmentType = a.type;
        const templateType = a.templateId?.type;

        // Match Purchase Order type
        if (assignmentType === desiredType) return true;
        if (templateType === desiredType) return true;

        // Also allow "Proforma Invoice" and "invoice" type templates for purchase orders
        if (assignmentType === "Proforma Invoice") return true;
        if (templateType === "Proforma Invoice") return true;

        // Fallback: if template type is generic "invoice", allow it
        if (
          typeof templateType === "string" &&
          templateType.toLowerCase() === "invoice"
        ) {
          return true;
        }

        return false;
      });



      // Map to full template objects (templateId should have type property)
      // Ensure we're passing the full template objects, not just IDs
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

      setTemplates(uniqueTemplates);

      // Set the first template as default (use deduplicated list)
      if (uniqueTemplates.length > 0 && uniqueTemplates[0]) {
        const firstTemplate = uniqueTemplates[0];
        const templateId = firstTemplate?._id || firstTemplate?.id;
        
        setSelectedTemplate(firstTemplate);
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
      notifyError("Template not found. Please select a template.");
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
        notifyError("Failed to load template details");
        return;
      }
    }
    
    // Just select template; do not open document generator. PDF generated at runtime on email preview when "Attach purchase order PDF" is checked.
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
    notifySuccess("PDF template selected successfully! You can now save or send the purchase order.");
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
      else notifyError("File URL not found");
    } catch (error) {
      notifyError("Error opening file");
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
      notifyError("Cannot edit or save a purchase order with 'Closed' status");
      return;
    }

    const validation = validateForm();
    if (!validation.isValid) {
      const firstError = Object.values(validation.errors || {}).find(Boolean);
      notifyError(firstError || "Please fill in all required fields");
      return;
    }

    if (purchaseOrderBusinessId) {
      try {
        const defs = await fetchDefinitions(
          {
            businessId: purchaseOrderBusinessId,
            module: "purchase",
            screen: "purchase_order",
          },
          headers,
        );
        const cfErr = validateCustomFieldValues(defs, customFieldValues);
        if (cfErr) {
          notifyError(cfErr);
          return;
        }
      } catch (e) {
        notifyError(e?.response?.data?.message || "Could not validate custom fields");
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

      // Determine status based on action and current status (SRS lifecycle)
      let newStatus = formData.status || "Draft";
      if (!isEditMode) {
        // New PO: draft → Draft; submit/send → Submitted (never auto-approve)
        if (action === "submit" || action === "send") {
          newStatus = "Submitted";
        } else {
          newStatus = "Draft";
        }
      } else {
        if (action === "save") {
          newStatus = formData.status;
        } else if (action === "submit" || action === "send") {
          const cur = String(formData.status || "Draft").toLowerCase();
          newStatus =
            cur === "draft" || cur === ""
              ? "Submitted"
              : formData.status;
        } else if (action === "draft") {
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
        sameAsBilling,
        // Include documentUrl (prefer documentId for API compatibility)
        documentUrl: finalDocumentUrl,
        // Map customerCurrency to currency for backend
        currency: formData.customerCurrency || baseCurrency || "MYR",
        ...(formData.paymentTermId && { paymentTermId: formData.paymentTermId }),
        // Keep terms + conditions explicit for create/update compatibility
        termsAndConditions: formData.termsAndConditions || "",
        terms_and_conditions: formData.termsAndConditions || "",
        deliveryAddress: formData.deliveryAddress || "",
        delivery_address: formData.deliveryAddress || "",
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
        attachments: poFileAttachments.map((a) => ({
          fileName: a.name,
          fileUrl: a.url && a.url !== "#" ? a.url : "",
          s3Key: a.s3Key,
          fileId: a.fileId,
          fileSize: a.size,
          includeInEmail: a.includeInEmail !== false,
        })),
      };

      // Optional ObjectId fields: do not send empty strings.
      if (!payload.deliveryMethod || !String(payload.deliveryMethod).trim()) {
        delete payload.deliveryMethod;
      }
      if (!payload.salesperson || !String(payload.salesperson).trim()) {
        delete payload.salesperson;
      }
      if (!payload.warehouse || !String(payload.warehouse).trim()) {
        payload.warehouse = null;
      }
      if (!payload.expectedShipmentDate) {
        delete payload.expectedShipmentDate;
      }

      let response;
      if (isEditMode) {
        response = await PurchaseOrderServices.updateSalesOrder(id, payload, headers);
      } else {
        response = await PurchaseOrderServices.createSalesOrder(payload, headers);
      }

      if (response.data.success) {
        const salesOrderData = response.data.data;
        const recordIdStr = String(salesOrderData._id || id || "");
        if (purchaseOrderBusinessId && recordIdStr) {
          try {
            await upsertValues(
              {
                business_id: purchaseOrderBusinessId,
                module: "purchase",
                screen: "purchase_order",
                record_id: recordIdStr,
                values: customFieldValues,
              },
              headers,
            );
          } catch (cfErr) {
            notifyError(
              cfErr?.response?.data?.message ||
                "Purchase order saved but custom fields failed to save",
            );
          }
        }

        if (action === "draft" || action === "save") {
          // "Save as Draft" or "Save": just update and go back
          notifySuccess(
            `Purchase order ${isEditMode ? "updated" : "created"} successfully`
          );
          history.push("/purchase-orders");
        } else if (action === "submit") {
          const recordId = salesOrderData._id || id;
          const cur = String(formData.status || "Draft").toLowerCase();
          // Create already persisted Submitted; on edit, transition via status API
          if (isEditMode && cur === "draft") {
            const statusRes = await PurchaseOrderServices.submitPurchaseOrder(
              recordId,
              headers,
            );
            if (!statusRes.data?.success) {
              notifyError(
                statusRes.data?.message ||
                  "Saved, but failed to submit for approval",
              );
              history.push(`/purchase-orders/view/${recordId}`);
              return;
            }
          }
          notifySuccess(
            isEditMode
              ? "Purchase order submitted for approval"
              : "Purchase order created and submitted for approval"
          );
          history.push(`/purchase-orders/view/${recordId}`);
        } else if (action === "send") {
          const recordId = salesOrderData._id || id;
          const cur = String(formData.status || "Draft").toLowerCase();
          if (isEditMode && cur === "draft") {
            try {
              await PurchaseOrderServices.submitPurchaseOrder(recordId, headers);
            } catch (e) {
              console.error(e);
            }
          }
          history.push({
            pathname: "/purchase-order-email-preview",
            state: {
              salesOrderData: {
                ...salesOrderData,
                attachments: poFileAttachments.map((a) => ({
                  fileName: a.name,
                  fileUrl: a.url && a.url !== "#" ? a.url : "",
                  s3Key: a.s3Key,
                  fileId: a.fileId,
                  fileSize: a.size,
                  includeInEmail: a.includeInEmail !== false,
                })),
                subtotal: summary.lineItemsSubtotal,
                subTotal: summary.lineItemsSubtotal,
                customer_email:
                  selectedCustomer?.basicInformation?.vendorEmail ||
                  selectedCustomer?.basicInformation?.customerEmail ||
                  "",
                customer_phone:
                  selectedCustomer?.basicInformation?.vendorPhone?.mobile ||
                  selectedCustomer?.basicInformation?.vendorPhone?.workPhone ||
                  selectedCustomer?.basicInformation?.customerPhone?.mobile ||
                  selectedCustomer?.basicInformation?.customerPhone?.workPhone ||
                  formData.phone ||
                  "",
                customer_name:
                  selectedCustomer?.basicInformation?.companyName ||
                  selectedCustomer?.basicInformation?.vendorDisplayName ||
                  selectedCustomer?.basicInformation?.customerDisplayName ||
                  "Vendor",
                templateId: selectedTemplateId,
              },
              poEmailAttachments: poFileAttachments,
              isUpdate: isEditMode,
              salesOrderId: salesOrderData._id || id,
              templateData: selectedTemplate,
              businessData,
              adminInfo,
              invoiceCustomFieldDefinitions: purchaseOrderFieldDefinitions,
              invoiceCustomFieldValues: customFieldValues,
              lineItemCustomFieldDefinitions: lineItemCustomFieldDefs,
              itemsForPdfCustomFields: formData.items || [],
            },
          });
        }
      } else {
        notifyError(response.data.message || "Failed to save purchase order");
      }
    } catch (error) {
      console.error("Error saving purchase order:", error);
        notifyError(
          error?.response?.data?.message ||
            error?.response?.data?.error ||
            "Failed to save purchase order",
        );
    } finally {
      setLoading(false);
    }
  };

  // Determine if form should be read-only
  const isReadOnly =
    isEditMode &&
    ["closed", "cancelled", "fully received"].includes(
      formData.status?.toLowerCase() || "",
    );

  // Determine current status for button logic
  const currentStatus = formData.status || "Draft";
  const statusLower = currentStatus.toLowerCase();
  const isApprovedLike =
    statusLower === "approved" ||
    statusLower === "issued" ||
    statusLower === "confirmed" ||
    statusLower === "partially received" ||
    statusLower === "partially delivered" ||
    statusLower === "submitted";
  const isDraft = statusLower === "draft";
  const isClosed =
    statusLower === "closed" ||
    statusLower === "cancelled" ||
    statusLower === "fully received";
  const isIssued = isApprovedLike; // keep legacy name used in buttons

  if (loading && isEditMode) {
    return (
      <ModuleAccessGate
        moduleName="Purchase"
        subModuleName=""
        title="Purchase Orders"
        requiredPermission={PERMISSION_ACTION.UPDATE}
      >
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-gray-600">Loading...</div>
        </div>
      </ModuleAccessGate>
    );
  }

  return (
    <ModuleAccessGate
      moduleName="Purchase"
      subModuleName=""
      title="Purchase Orders"
      requiredPermission={
        isEditMode ? PERMISSION_ACTION.UPDATE : PERMISSION_ACTION.ADD
      }
    >
    <div className="min-h-screen bg-gray-50">
      {/* Main Content - Two Column Layout */}
      <div className=" mx-auto py-4 px-4">
        <div className="grid grid-cols-1 gap-6">
          {/* Left Column - Main Form */}
          <div className="space-y-6 px-4">
            <PageHeader
              title={isEditMode ? "Edit Purchase Order" : "New Purchase Order"}
              showBackButton
              backFallbackPath="/purchase-orders"
            />
            
            {/* Business & Purchase Order Info Card */}
            <form onSubmit={handleSubmit}>
              <div className="bg-white rounded-lg shadow-sm">
                <div className="p-6 bg-green-50 space-y-6 rounded-b-lg">
                  {/* Business and vendor selection - side by side */}
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
                        Business <span className="text-red-500">*</span>
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
                              deliveryAddress: "",
                                                        phone: "",
                              fax: "",
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
                            setSelectedDeliveryBusinessAddressId("");
                            setSelectedCustomer(null);
                          }}
                          placeholder="Select Business"
                          searchPlaceholder="Search businesses..."
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
                              let label = (businessData && (businessData.name || businessData.businessName)) || formData.businessName || formData.business || "Selected Business";
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

                    {/* Vendor Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Vendor Name <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-2">
                        <div className="flex-1 bg-white rounded-lg">
                          <SearchableDropdown
                            name="customerName"
                            value={formData.customer}
                            onChange={(e) => handleCustomerChange(e.target.value)}
                            placeholder={
                              selectedCustomer
                                ? selectedCustomer?.basicInformation?.vendorDisplayName
                                : "Select Vendor"
                            }
                            searchPlaceholder="Search vendors..."
                            disabled={!formData.business || isReadOnly}
                            options={(() => {
                              const opts =
                                customers
                                  ?.filter(
                                    (customer) =>
                                      String(customer?.status ?? "Active").toLowerCase() ===
                                      "active"
                                  )
                                  .map((customer) => ({
                                  value: customer._id,
                                  label: customer.basicInformation?.companyName || customer.basicInformation?.vendorDisplayName || "",
                                  name: customer.basicInformation?.companyName || customer.basicInformation?.vendorDisplayName || "",
                                  displayName: customer.basicInformation?.vendorDisplayName,
                                  email: customer.basicInformation?.vendorEmail,
                                })) || [];
                              // Keep currently selected vendor visible even if inactive (edit / prefill)
                              if (
                                formData.customer &&
                                selectedCustomer &&
                                !opts.find((o) => String(o.value) === String(formData.customer))
                              ) {
                                const name =
                                  selectedCustomer?.basicInformation?.companyName ||
                                  selectedCustomer?.basicInformation?.vendorDisplayName ||
                                  "Selected Vendor";
                                opts.unshift({
                                  value: formData.customer,
                                  label: name,
                                  name,
                                  displayName: selectedCustomer?.basicInformation?.vendorDisplayName,
                                  email: selectedCustomer?.basicInformation?.vendorEmail,
                                });
                              }
                              return opts;
                            })()}
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
                              ? "Select a business first"
                              : "Quick add a new vendor"
                          }
                          className="flex items-center justify-center gap-1.5 shrink-0 px-3 py-2.5 text-sm font-medium text-[var(--p-blue)] bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-[var(--p-blue)] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[var(--p-blue)] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-white"
                        >
                          <UserPlus className="w-4 h-4" />
                          Add
                        </button>
                      </div>
                      {formErrors.customer && (
                        <p className="mt-1 text-xs text-red-500">
                          {formErrors.customer}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Billing & Shipping Address: only show after vendor is selected. Show only fields that exist; show Add section for missing ones. */}
                  {selectedCustomer?._id && (
                    <>
                      {/* Add section: show when billing or shipping is missing */}
                      {(!formData.billingAddress?.trim() || !formData.shippingAddress?.trim()) && (
                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 text-center">
                          <h3 className="text-sm font-medium text-gray-700 mb-3">
                            Billing & Shipping Address
                          </h3>
                          <p className="text-xs text-gray-500 mb-4">
                            No billing or shipping address for this vendor.
                          </p>
                          <div className="flex flex-wrap items-center justify-center gap-3">
                            {!formData.billingAddress?.trim() && (
                              <button
                                type="button"
                                onClick={() => {
                                  setAddressModalType("Billing");
                                  setEditingAddress(null);
                                  setIsAddressModalOpen(true);
                                }}
                                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-[var(--p-blue)] bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-[var(--p-blue)] transition-colors"
                              >
                                <Plus className="w-4 h-4" />
                                Add Billing Address
                              </button>
                            )}
                            {!formData.shippingAddress?.trim() && (
                              <button
                                type="button"
                                onClick={() => {
                                  setAddressModalType("Shipping");
                                  setEditingAddress(null);
                                  setIsAddressModalOpen(true);
                                }}
                                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-[var(--p-blue)] bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-[var(--p-blue)] transition-colors"
                              >
                                <Plus className="w-4 h-4" />
                                Add Shipping Address
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Billing Address field: show only when we have billing address */}
                      {formData.billingAddress?.trim() && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Billing Address
                          </label>
                          <input
                            type="text"
                            name="billingAddress"
                            value={formData.billingAddress ? formData.billingAddress.replace(/\n/g, ", ") : ""}
                            onChange={(e) => {
                              setFormData((prev) => {
                                const nextBilling = e.target.value;
                                return {
                                  ...prev,
                                  billingAddress: nextBilling,
                                  shippingAddress: sameAsBilling
                                    ? nextBilling
                                    : prev.shippingAddress,
                                };
                              });
                            }}
                            placeholder="Enter billing address (e.g., house no 23, street 5)"
                            className="w-full px-3 py-2.5 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                          />
                        </div>
                      )}

                      {/* Shipping Address field: always show label + checkbox (when billing exists),
                          but only show the input when user opts-in or a shipping address already exists */}
                      {(formData.billingAddress?.trim() || formData.shippingAddress?.trim() || sameAsBilling) && (
                        <div>
                          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                            <label className="block text-sm font-medium text-gray-700">
                              Shipping Address
                            </label>
                            <div className="flex items-center gap-3">
                              {formData.billingAddress?.trim() && (
                                <label className="flex items-center gap-2 text-xs text-gray-600 select-none">
                                  <input
                                    type="checkbox"
                                    checked={sameAsBilling}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
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
                                    className="h-4 w-4"
                                  />
                                  Same as Billing
                                </label>
                              )}
                            </div>
                          </div>
                          {(sameAsBilling || formData.shippingAddress?.trim()) && (
                            <input
                              type="text"
                              name="shippingAddress"
                              value={formData.shippingAddress ? formData.shippingAddress.replace(/\n/g, ", ") : ""}
                              onChange={(e) => {
                                setSameAsBilling(false);
                                setFormData((prev) => ({
                                  ...prev,
                                  shippingAddress: e.target.value,
                                }));
                              }}
                              placeholder="Enter shipping address"
                              disabled={sameAsBilling && !!formData.billingAddress?.trim()}
                              className={`w-full px-3 py-2.5 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] ${
                                sameAsBilling && formData.billingAddress?.trim() ? "cursor-not-allowed opacity-60" : ""
                              }`}
                            />
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {/* Delivery Address should be selectable after business selection */}
                  {formData.business && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Delivery Address <span className="text-red-500">*</span>
                        </label>
                        <div className="bg-white rounded-lg">
                          <SearchableDropdown
                            name="deliveryAddress"
                            value={selectedDeliveryBusinessAddressId || ""}
                            isOpen={isDeliveryAddressDropdownOpen}
                            onOpenChange={setIsDeliveryAddressDropdownOpen}
                            onChange={(e) => {
                              const selected = deliveryAddressOptions.find(
                                (opt) => opt.value === e.target.value
                              );
                              setSelectedDeliveryBusinessAddressId(e.target.value || "");
                              setFormData((prev) => ({
                                ...prev,
                                deliveryAddress: selected?.addressText || "",
                              }));
                            }}
                            placeholder={formData.deliveryAddress || "Select delivery address"}
                            searchPlaceholder="Search business delivery address..."
                            disabled={!formData.business || isReadOnly}
                            options={deliveryAddressOptions.map((opt) => ({
                              value: opt.value,
                              label: opt.label,
                              name: opt.name,
                              addressText: opt.addressText,
                              isPrimary: opt.isPrimary,
                              rawAddress: opt.rawAddress,
                            }))}
                            searchKeys={["name", "label"]}
                            renderOption={(option) => {
                              const isDeleting =
                                deletingDeliveryAddressId &&
                                String(option?.rawAddress?._id || "") === String(deletingDeliveryAddressId || "");
                              const canEdit = !option?.isPrimary && !!option?.rawAddress?._id;

                              return (
                                <div className="flex items-center justify-between gap-2 w-full">
                                  <div className="min-w-0 flex-1">
                                    <span className="truncate">{option.label}</span>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    {canEdit && (
                                      <>
                                        <span
                                          title="Edit delivery address"
                                          className={`text-gray-600 hover:text-[var(--p-blue)] ${isReadOnly ? "opacity-50" : "cursor-pointer"}`}
                                          onMouseDown={(e) => {
                                            e.preventDefault();
                                            if (isReadOnly) return;
                                            openDeliveryAddressModalForEdit(option.rawAddress);
                                          }}
                                        >
                                          <Pencil size={14} />
                                        </span>
                                        <span
                                          title="Delete delivery address"
                                          className={`text-gray-600 hover:text-red-600 ${
                                            isDeleting ? "opacity-50 cursor-not-allowed hover:text-red-600" : "cursor-pointer"
                                          }`}
                                          onMouseDown={(e) => {
                                            e.preventDefault();
                                            if (isDeleting) return;
                                            handleDeleteDeliveryAddress(option.rawAddress);
                                          }}
                                        >
                                          <Trash2 size={14} />
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              );
                            }}
                            dropdownFooter={
                              <button
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  if (!formData.business || isReadOnly) return;
                                  openDeliveryAddressModalForAdd();
                                }}
                                disabled={!formData.business || isReadOnly}
                                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-[var(--p-blue)] hover:bg-blue-50 border border-[var(--p-blue)] rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <Plus size={14} />
                                 Add New Address
                              </button>
                            }
                          />
                        </div>
                        {formErrors.deliveryAddress && (
                          <p className="mt-1 text-xs text-red-500">
                            {formErrors.deliveryAddress}
                          </p>
                        )}
                      </div>
                    </>
                  )}

                  {/* Phone, Fax Number, and Currency - Three columns */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Phone
                      </label>
                      <input
                        type="text"
                        name="phone"
                        value={formData.phone || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, phone: e.target.value })
                        }
                        placeholder="Enter phone number"
                        className={`w-full px-3 py-2.5 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] ${
                          isReadOnly ? "cursor-not-allowed opacity-60" : ""
                        }`}
                        readOnly={isReadOnly}
                        disabled={isReadOnly}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Fax Number
                      </label>
                      <input
                        type="text"
                        name="fax"
                        value={formData.fax || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, fax: e.target.value })
                        }
                        placeholder="Enter fax number"
                        className={`w-full px-3 py-2.5 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] ${
                          isReadOnly ? "cursor-not-allowed opacity-60" : ""
                        }`}
                        readOnly={isReadOnly}
                        disabled={isReadOnly}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Currency
                      </label>
                      <input
                        type="text"
                        name="customerCurrency"
                        value={formData.customerCurrency || ""}
                        readOnly
                        placeholder="Currency"
                        className="w-full px-3 py-2.5 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                      />
                    </div>
                  </div>

                  {/* Purchase Order Number, Reference Number */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Purchase Order Number
                      </label>
                      {docNumMissing && (
                        <div className="mb-2 flex items-center justify-between gap-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs">
                          <span>
                            Purchase order numbering is not configured for this business group.
                            Numbers will be auto-generated using the Business Group fallback sequence.
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
                              Configure Now
                            </a>
                          )}
                        </div>
                      )}
                      <input
                        type="text"
                        value={formData.purchaseOrderNumber}
                        readOnly
                        className="w-full px-3 py-2.5 text-sm bg-[#374151] text-white border border-gray-300 rounded-lg cursor-not-allowed"
                        style={{ color: '#ffffff' }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Reference Number
                      </label>
                      <input
                        type="text"
                        name="referenceNumber"
                        value={formData.referenceNumber || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, referenceNumber: e.target.value })
                        }
                        placeholder="Enter reference number"
                        className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                      />
                    </div>
                  </div>

                  {/* Purchase Order Date and Payment Terms Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Purchase Order Date <span className="text-red-500">*</span>
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
                        Expected Delivery Date
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
                  </div>

                  {/* Payment Terms */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Payment Terms <span className="text-red-500">*</span>
                      </label>
                      <div className="bg-white rounded-lg">
                        <SearchableDropdown
                          value={formData.paymentTerms}
                          onChange={(e) => {
                            const selectedTermName = e.target.value;
                            const term = paymentTerms.find(
                              (t) => t.name === selectedTermName
                            );
                            const updatedData = {
                              ...formData,
                              paymentTerms: selectedTermName,
                              paymentTermId: term?._id || "",
                            };
                            if (selectedTermName && updatedData.salesOrderDate) {
                              const calculatedDueDate = calculateDueDate(
                                term || selectedTermName,
                                updatedData.salesOrderDate
                              );
                              if (calculatedDueDate)
                                updatedData.dueDate = calculatedDueDate;
                            }
                            setFormData(updatedData);
                          }}
                          placeholder="Select Payment Term"
                          searchPlaceholder="Search payment terms..."
                          disabled={!formData.business || isReadOnly}
                          options={
                            (paymentTerms?.map((term) => ({
                              value: term.name || term.value || term.label || "",
                              label: term.name || term.label || term.value || "",
                              name: term.name || term.label || term.value || "",
                            })) || []
                          ).filter(
                            (t, i, a) => t.value && a.findIndex((x) => x.value === t.value) === i
                          )}
                          searchKeys={["name"]}
                          dropdownFooter={
                            <AddPaymentTermButton
                              businessId={formData.business}
                              headers={headers}
                              disabled={!formData.business || isReadOnly}
                              displayMode="dropdown"
                              tableName="Vendor Payment Terms"
                              onAdded={(newTerm) => {
                                const normalizedTerm = {
                                  ...newTerm,
                                  name:
                                    newTerm?.name ||
                                    newTerm?.label ||
                                    newTerm?.value ||
                                    "",
                                };
                                setPaymentTerms((prev) =>
                                  prev.some((t) => t._id === normalizedTerm._id)
                                    ? prev
                                    : [...prev, normalizedTerm]
                                );
                                const updatedData = {
                                  ...formData,
                                  paymentTerms: normalizedTerm.name,
                                  paymentTermId: normalizedTerm._id || "",
                                };
                                if (formData.salesOrderDate) {
                                  const calculatedDueDate = calculateDueDate(
                                    normalizedTerm,
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
                        Due Date <span className="text-red-500">*</span>
                      </label>
                      <CustomDatePicker
                        value={formData.dueDate}
                        onChange={(date) => {
                          const resolvedTerm = getPaymentTermFromDueDate(
                            formData.salesOrderDate,
                            date,
                            paymentTerms || []
                          );
                          const term = paymentTerms.find((t) => t.name === resolvedTerm);
                          setFormData({
                            ...formData,
                            dueDate: date,
                            paymentTerms: resolvedTerm,
                            paymentTermId: term?._id || "",
                          });
                        }}
                        disabled={isReadOnly}
                        bgColor="#FFFFFF"
                        style={{
                          backgroundColor: "#FFFFFF",
                          border: "1px solid #E5E7EB",
                          borderRadius: "8px",
                        }}
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Payment due date (from payment terms) — not related to goods receipt.
                      </p>
                      {formErrors.dueDate && (
                        <p className="mt-1 text-xs text-red-500">
                          {formErrors.dueDate}
                        </p>
                      )}
                    </div>
                  </div>

                  {shouldRenderCustomFieldAtSlot(
                    "purchase",
                    "purchase_order",
                    "after_due_date",
                  ) && purchaseOrderBusinessId ? (
                    <DynamicCustomFieldsForm
                      businessId={purchaseOrderBusinessId}
                      module="purchase"
                      screen="purchase_order"
                      columns={3}
                      recordId={isEditMode ? id : undefined}
                      values={customFieldValues}
                      onValuesChange={setCustomFieldValues}
                      headers={headers}
                      readOnly={isReadOnly}
                      useBreakpointGrid
                    />
                  ) : null}

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
                    pricingMode="purchase"
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
                  {/* Summary Panel Card */}
                  <div className="flex-1 bg-white rounded-lg border border-gray-200 shadow-sm">
                    <div className="p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Summary</h3>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center py-2 border-b border-gray-200">
                          <span className="text-sm font-medium text-gray-700">Sub Total</span>
                          <span className="text-sm font-semibold text-gray-900">
                            {formatCurrencyAmount(
                              formData.customerCurrency || baseCurrency || "MYR",
                              formData.subtotal,
                            )}
                          </span>
                        </div>
                        {formData.tax > 0 && (
                          <div className="flex justify-between items-center py-2 border-b border-gray-200">
                            <span className="text-sm font-medium text-gray-700">Tax</span>
                            <span className="text-sm font-semibold text-gray-900">
                              {formatCurrencyAmount(
                                formData.customerCurrency || baseCurrency || "MYR",
                                formData.tax,
                              )}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between items-center py-2 border-b border-gray-200">
                          <span className="text-sm font-medium text-gray-700">Discount</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={formData.discountPercentage}
                              onChange={(e) => {
                                const nextPercentage = Math.min(
                                  100,
                                  Math.max(0, parseFloat(e.target.value) || 0)
                                );
                                setFormData((prev) => {
                                  const net = computeSalesOrderTotals(
                                    prev.items,
                                    0,
                                    0,
                                    0,
                                  ).subtotal;
                                  return {
                                    ...prev,
                                    discountPercentage: nextPercentage,
                                    discount: calculateOrderDiscountAmount(
                                      net,
                                      nextPercentage,
                                    ),
                                  };
                                });
                              }}
                              className="w-24 px-2 py-1 text-sm text-right border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)]"
                            />
                            <span className="text-sm text-gray-500">%</span>
                          </div>
                        </div>
                        <div className="flex justify-end -mt-1">
                          <span className="text-xs text-gray-500">
                            {formatCurrencyAmount(
                              formData.customerCurrency || baseCurrency || "MYR",
                              formData.discount || 0,
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-gray-200">
                          <span className="text-sm font-medium text-gray-700">Shipping Charges</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">
                              {formData.customerCurrency || baseCurrency || "MYR"}
                            </span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={formData.shippingCharges}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  shippingCharges: parseFloat(e.target.value) || 0,
                                })
                              }
                              className="w-24 px-2 py-1 text-sm text-right border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)]"
                            />
                          </div>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-gray-200">
                          <span className="text-sm font-medium text-gray-700">Adjustment</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">
                              {formData.customerCurrency || baseCurrency || "MYR"}
                            </span>
                            <input
                              type="number"
                              step="0.01"
                              value={formData.adjustment}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  adjustment: parseFloat(e.target.value) || 0,
                                })
                              }
                              className="w-24 px-2 py-1 text-sm text-right border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)]"
                            />
                          </div>
                        </div>
                        <div className="flex justify-between items-center py-3 bg-gray-50 rounded-lg px-4 mt-4">
                          <span className="text-base font-semibold text-gray-900">Total</span>
                          <span className="text-lg font-bold text-gray-900">
                            {formatCurrencyAmount(
                              formData.customerCurrency || baseCurrency || "MYR",
                              formData.total,
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* File attachments — same card style as Summary */}
                  <div className="flex-1 bg-white rounded-lg border border-gray-200 shadow-sm">
                    <div className="p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        File attachments
                      </h3>
                      <p className="text-xs text-gray-500 mb-4">
                        Up to 10 files (10MB each). Stored on this purchase order; use the
                        checkboxes to choose which files to send to the vendor from the
                        email screen.
                      </p>
                      {!isReadOnly && (
                        <>
                          <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx"
                            onChange={handlePoAttachmentInputChange}
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              !poAttachmentUploading && fileInputRef.current?.click()
                            }
                            disabled={poAttachmentUploading}
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                          >
                            <Upload className="w-4 h-4" />
                            {poAttachmentUploading ? "Uploading…" : "Upload files"}
                          </button>
                        </>
                      )}
                      {poFileAttachments.length > 0 && (
                        <ul className="mt-4 space-y-2">
                          {poFileAttachments.map((att) => (
                            <li
                              key={String(att.fileId || att.s3Key)}
                              className="rounded-lg border border-gray-200 bg-gray-50/80 p-3"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-start gap-2 min-w-0 flex-1">
                                  <FileText className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-gray-800 truncate">
                                      {att.name}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {att.size
                                        ? `${(att.size / 1024 / 1024).toFixed(2)} MB`
                                        : "—"}
                                    </p>
                                    {!isReadOnly && (
                                      <label className="mt-2 flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          className="rounded border-gray-300"
                                          checked={att.includeInEmail !== false}
                                          onChange={(e) => {
                                            const checked = e.target.checked;
                                            setPoFileAttachments((prev) =>
                                              prev.map((x) =>
                                                (x.fileId || x.s3Key) ===
                                                (att.fileId || att.s3Key)
                                                  ? { ...x, includeInEmail: checked }
                                                  : x
                                              )
                                            );
                                          }}
                                        />
                                        Include when emailing vendor
                                      </label>
                                    )}
                                    {isReadOnly && (
                                      <p className="text-xs text-gray-500 mt-1">
                                        {att.includeInEmail === false
                                          ? "Not included in vendor email"
                                          : "Included in vendor email when sent"}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {att.fileId && (
                                    <button
                                      type="button"
                                      title="View"
                                      onClick={async () => {
                                        try {
                                          const r = await axios.get(
                                            `${Base_URL}/documents/getFileWithAllData/${att.fileId}`,
                                            { headers }
                                          );
                                          const u = r?.data?.data?.url;
                                          if (u) window.open(u, "_blank");
                                          else notifyError("File URL not available");
                                        } catch (err) {
                                          notifyError("Could not open file");
                                        }
                                      }}
                                      className="p-2 text-[var(--p-blue)] hover:bg-white rounded-md border border-transparent hover:border-gray-200"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </button>
                                  )}
                                  {!isReadOnly && (
                                    <button
                                      type="button"
                                      title="Remove"
                                      onClick={() =>
                                        removePoAttachment(att.fileId || att.s3Key)
                                      }
                                      className="p-2 text-red-600 hover:bg-white rounded-md border border-transparent hover:border-red-200"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
                {/* Notes & Attachments Card */}
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Notes & Attachments
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Customer Notes
                        </label>
                        <textarea
                          value={formData.customerNotes}
                          onChange={(e) =>
                            setFormData({ ...formData, customerNotes: e.target.value })
                          }
                          disabled={isReadOnly}
                          rows={4}
                          placeholder="Optional notes for customer"
                          className={`w-full min-h-[6rem] px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] resize-y ${isReadOnly ? "bg-gray-100 cursor-not-allowed" : ""}`}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Terms & Conditions
                        </label>
                        <div className="relative mb-3" ref={termsDropdownRef}>
                          <button
                            type="button"
                            onClick={() => !isReadOnly && setTermsDropdownOpen((o) => !o)}
                            disabled={isReadOnly}
                            className={`w-full flex items-center justify-between px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] bg-white text-left ${isReadOnly ? "bg-gray-100 cursor-not-allowed" : ""}`}
                          >
                            <span className={selectedTermsValue ? "text-gray-900" : "text-gray-500"}>
                              {selectedTermsLabel ?? "Select terms and Conditions"}
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
                                  Default
                                </button>
                              ) : null}
                              {termsAndConditionsList.map((t) => (
                                <button
                                  key={t._id}
                                  type="button"
                                  onClick={() => handleTermsSelect(`item_${t._id}`)}
                                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${selectedTermsValue === `item_${t._id}` ? "bg-blue-50 text-[var(--p-blue)]" : "text-gray-900"}`}
                                >
                                  {t.name || "Terms"}
                                </button>
                              ))}
                              {(businessData?.termsTemplates || []).map((t, i) => (
                                <button
                                  key={`tpl-${i}`}
                                  type="button"
                                  onClick={() => handleTermsSelect(`tpl_${i}`)}
                                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${selectedTermsValue === `tpl_${i}` ? "bg-blue-50 text-[var(--p-blue)]" : "text-gray-900"}`}
                                >
                                  {t.name || `Terms ${i + 1}`}
                                </button>
                              ))}
                              <button
                                type="button"
                                onClick={() => handleTermsSelect("__add_new__")}
                                className="w-full px-3 py-2 text-left text-sm text-[var(--p-blue)] hover:bg-blue-50 border-t border-gray-100 mt-1"
                              >
                                Add new
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
                              placeholder="Terms content (editable after selection)"
                              className={`w-full min-h-[6rem] px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] resize-y ${isReadOnly ? "bg-gray-100 cursor-not-allowed" : ""}`}
                            />
                            <p className="mt-2 text-xs text-gray-500">
                              Terms appear on the document preview and PDF. Edit above if needed.
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
                        <span>Selected Template</span>
                        <button
                          type="button"
                          onClick={() => setIsViewerOpen(true)}
                          className="text-green-700 hover:text-green-900 underline"
                        >
                          View
                        </button>
                      </div>
                    ) : selectedTemplateId ? (
                      <div className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg">
                        <FileText className="w-4 h-4" />
                        <span>Template: {selectedTemplate?.name || "Selected"}</span>
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
                          Change
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
                        Select PDF Template
                      </button>
                    )}
                  </div>

                  {/* Save Buttons - Right Side */}
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => history.push("/purchase-orders")}
                      className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
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
                            title={isReadOnly ? "Cannot edit closed purchase orders" : ""}
                          >
                            <Save className="w-4 h-4" />
                            {loading ? "Saving..." : "Save as Draft"}
                          </button>
                        )}

                        {/* Save without changing status */}
                        {isIssued && (
                          <button
                            type="button"
                            onClick={(e) => handleSubmit(e, "save")}
                            disabled={loading || isReadOnly}
                            className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title={isReadOnly ? "Cannot edit this purchase order" : "Save changes"}
                          >
                            <Save className="w-4 h-4" />
                            {loading ? "Saving..." : "Save"}
                          </button>
                        )}

                        {/* Submit for approval (Draft → Submitted) */}
                        {isDraft && (
                          <button
                            type="button"
                            onClick={(e) => handleSubmit(e, "submit")}
                            disabled={loading || isReadOnly}
                            className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Submit for approval"
                          >
                            <Send className="w-4 h-4" />
                            {loading ? "Submitting..." : "Submit for Approval"}
                          </button>
                        )}

                        {/* Save and Send email (also submits Draft → Submitted) */}
                        <button
                          type="button"
                          onClick={(e) => handleSubmit(e, "send")}
                          disabled={
                            loading ||
                            !(
                              selectedCustomer?.basicInformation?.vendorEmail ||
                              selectedCustomer?.basicInformation?.customerEmail
                            ) ||
                            isReadOnly
                          }
                          className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-[#A6C437] rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title={
                            isReadOnly
                              ? "Cannot edit this purchase order"
                              : !(
                                  selectedCustomer?.basicInformation?.vendorEmail ||
                                  selectedCustomer?.basicInformation?.customerEmail
                                )
                              ? "Vendor email is required"
                              : "Save, submit if Draft, and open email"
                          }
                        >
                          <Send className="w-4 h-4" />
                          {loading ? "Saving..." : "Save and Send"}
                        </button>
                      </>
                    )}
                    
                    {/* Show message when Closed / Cancelled / Fully Received */}
                    {isClosed && (
                      <div className="px-4 py-2 text-sm text-gray-500 italic">
                        This purchase order cannot be edited ({formData.status || "locked"})
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
        pricingMode="purchase"
      />
      <QuickAddVendorModal
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
        customerId={null}
        vendorId={addressModalType === "Delivery" ? null : selectedCustomer?._id}
        businessId={addressModalType === "Delivery" ? formData.business : null}
        existingAddress={editingAddress}
        onSaveSuccess={async (savedAddress) => {
          if (addressModalType === "Delivery" && formData.business) {
            try {
              const response = await axios.get(`${Base_URL}/business/${formData.business}`, { headers });
              const updatedBusiness = response?.data?.data || response?.data;
              setBusinessData(updatedBusiness);
              const parts = [
                savedAddress?.addressLine1,
                savedAddress?.addressLine2,
                savedAddress?.city,
                savedAddress?.state,
                savedAddress?.zipCode,
                savedAddress?.country,
              ].filter(Boolean);
              const formattedAddress = parts.join(", ");
              setSelectedDeliveryBusinessAddressId(savedAddress?._id ? String(savedAddress._id) : "");
              setFormData((prev) => ({
                ...prev,
                deliveryAddress: formattedAddress || prev.deliveryAddress || "",
              }));
            } catch (error) {
              console.error("Error refreshing business data:", error);
            }
            return;
          }

          if (selectedCustomer?._id) {
            try {
              const response = await axios.get(
                `${Base_URL}/vendors/${selectedCustomer._id}`
              );
              const updatedCustomer = response?.data?.data || response?.data;
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
              console.error("Error refreshing vendor data:", error);
            }
          }
        }}
        onDeleteSuccess={async () => {
          if (addressModalType !== "Delivery" || !formData.business) return;
          try {
            const response = await axios.get(`${Base_URL}/business/${formData.business}`, { headers });
            const updatedBusiness = response?.data?.data || response?.data;
            setBusinessData(updatedBusiness);
            setSelectedDeliveryBusinessAddressId("");
            setFormData((prev) => ({ ...prev, deliveryAddress: "" }));
          } catch (error) {
            console.error("Error refreshing business data after delete:", error);
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
        type="Purchase Order"
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
            location: "purchase-orders",
            // Purchase Order specific fields
            purchaseOrderNumber: formData.purchaseOrderNumber,
            invoice_number: formData.purchaseOrderNumber,
            invoiceNumber: formData.purchaseOrderNumber,
            // Invoice type - treat purchase orders as Proforma for template rendering
            invoiceType: "Proforma",
            // Vendor (stored as customer on PO) — fields map to document template contract names
            customer: selectedCustomer,
            customer_name: selectedCustomer?.basicInformation?.companyName || 
                          selectedCustomer?.basicInformation?.vendorDisplayName || 
                          selectedCustomer?.basicInformation?.customerDisplayName || 
                          selectedCustomer?.name ||
                          "Vendor",
            customerCompany: selectedCustomer?.companyInfo?.companyName ||
                            selectedCustomer?.basicInformation?.companyName ||
                            selectedCustomer?.basicInformation?.vendorDisplayName ||
                            selectedCustomer?.basicInformation?.customerDisplayName ||
                            "",
            customerEmail:
              selectedCustomer?.basicInformation?.vendorEmail ||
              selectedCustomer?.basicInformation?.customerEmail ||
              "",
            customer_email:
              selectedCustomer?.basicInformation?.vendorEmail ||
              selectedCustomer?.basicInformation?.customerEmail ||
              "",
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
            shipToName: selectedCustomer?.basicInformation?.vendorDisplayName || 
                        selectedCustomer?.basicInformation?.customerDisplayName || 
                        selectedCustomer?.basicInformation?.customerName ||
                        selectedCustomer?.name ||
                        "",
            shipToCompany: selectedCustomer?.companyInfo?.companyName ||
                          selectedCustomer?.basicInformation?.companyName ||
                          "",
            shipToPhone: formData.phone || "",
            shipToEmail:
              selectedCustomer?.basicInformation?.vendorEmail ||
              selectedCustomer?.basicInformation?.customerEmail ||
              "",
            // Payment terms
            terms: formData.paymentTerms,
            // Items - map purchase order items to invoice format (include taxRate so DocumentGenerator can show article tax)
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
            // Financial summary
            subTotal: summary.lineItemsSubtotal,
            subtotal: summary.lineItemsSubtotal,
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
          pdfModule="purchase"
          pdfScreen="purchase_order"
          documentCustomFieldDefinitions={purchaseOrderFieldDefinitions}
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
          contractNo={formData?.orderNumber || formData?.purchaseOrderNumber}
          invoiceNumber={formData?.purchaseOrderNumber || formData?.orderNumber}
        />
      )}
      {/* Add new Terms & Conditions modal — portaled so parent layout/stacking cannot trap or unmount it */}
      {addTermsModalOpen &&
        createPortal(
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
          data-modal-root="terms-and-conditions"
          onClick={() => !savingNewTerm && setAddTermsModalOpen(false)}
          role="presentation"
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add new Terms & Conditions</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={newTermName}
                  onChange={(e) => setNewTermName(e.target.value)}
                  placeholder="e.g. Standard, Net 30"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                <textarea
                  value={newTermContent}
                  onChange={(e) => setNewTermContent(e.target.value)}
                  rows={6}
                  placeholder="Enter terms and conditions text..."
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
                Cancel
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
                    notifySuccess("Terms & Conditions added.");
                  } catch (err) {
                    console.error("Error saving terms:", err);
                    notifyError(err.response?.data?.message || "Failed to save terms.");
                  } finally {
                    setSavingNewTerm(false);
                  }
                }}
                disabled={savingNewTerm || !newTermName.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-[var(--p-blue)] rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                {savingNewTerm ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>,
        document.body
        )}
    </div>
    </ModuleAccessGate>
  );
}
