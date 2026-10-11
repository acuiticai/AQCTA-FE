import { useTranslation } from "react-i18next";
import { customerInvoiceText as ciText } from "@/utils/customerInvoiceI18n";
import React, {
  useState,
  useEffect,
  useRef,
  useContext,
  useCallback,
  useMemo,
} from "react";
import {
  ChevronDown,
  Calendar,
  X,
  Upload,
  Plus,
  UserPlus,
  ArrowLeft,
  Eye,
  FileText,
  Building2,
  User,
  Save,
  Send,
  Info,
  AlertCircle,
} from "lucide-react";
import axios from "axios";
import { useHistory, useLocation } from "react-router-dom";
import { notifyError, notifySuccess } from "@/utils/toast";
import ItemTable from "./ItemTable"; // Import the new ItemTable component
import ZohoStyleItemTable from "@/components/invoice/ZohoStyleItemTable";
import InvoiceSummaryPanel from "@/components/invoice/InvoiceSummaryPanel";
import { AdminContext } from "@/context/AdminContext";
import DocumentTemplateModal from "@/pages/SalesContract/actions/DocumentTemplates";
import DocumentTermsAndConditionsSection from "@/components/documents/DocumentTermsAndConditionsSection";
import DocumentGenerator from "./DocumentGenerator";
import DocumentViewer from "./document-viewer";
import CustomDatePicker from "@/components/CustomDatePicker";
import { PageHeader } from "@/page-layouts/index";
import { formatAmount, formatDate, formatCurrencyAmount } from "@/components/formatAmount";
import SearchableDropdown from "@/components/SearchableDropdown";
import DropdownBasic from "@/page-layouts/components/DropdownBasic";
import SingleBusinessField from "@/components/SingleBusinessField";
import AddressModal from "@/components/AddressModal";
import CustomerBillShipAddressFields from "@/components/CustomerBillShipAddressFields";
import BulkAddItemsModal from "@/components/customer-invoices/BulkAddItemsModal";
import QuickAddCustomerModal from "@/components/customer-invoices/QuickAddCustomerModal";
import AddPaymentTermButton from "@/components/AddPaymentTermButton";
import ejs from "ejs";
import numberToWords from "number-to-words";
import {
  calculateDueDate,
  getPaymentTermFromDueDate,
} from "@/utils/calculateDueDate";
import {
  getItemTotal,
  clampDiscountPercent,
  sumLineTaxAmountsFromItems,
  sumLineGrossFromItems,
  computeInvoiceTotalFromHeader,
  getLineSubtotal,
  getLineTaxAmount,
} from "@/utils/itemDiscountUtils";
import { getNextDocumentNumber } from "@/services/documentSequenceServices";
import DynamicCustomFieldsForm from "@/components/custom-fields/DynamicCustomFieldsForm";
import {
  fetchDefinitions,
  fetchLineItemCustomFieldDefinitions,
  upsertValues,
} from "@/services/customFieldServices";
import { validateCustomFieldValues } from "@/utils/customFieldValidation";
import { shouldRenderCustomFieldAtSlot } from "@/utils/customFieldPlacement";
import QuotationServices from "@/services/QuotationServices";
import {
  buildMissingCustomerAddressMessage,
  fetchAddressTypeConfig,
  findAddressBySystemType,
  getConfiguredBillShipTypes,
  getMissingBillShipTypesForCustomer,
  missingBillShipSectionTitle,
} from "@/utils/addressTypeUtils";
import { resolveOrderLineItemAndDescription } from "@/utils/invoiceContractMapper";

/** Map quotation lines to invoice/Zoho line rows for "Convert to invoice" prefill. */
function mapQuotationItemsToInvoiceItems(items = []) {
  if (!Array.isArray(items) || items.length === 0) return [];
  return items.map((item, index) => ({
    id: index + 1,
    itemId: item.itemId?._id || item.itemId || "",
    itemName:
      item.itemName ||
      item.itemId?.itemName ||
      item.itemId?.name ||
      item.itemId?.title ||
      item.title ||
      item.description ||
      "",
    description: item.description || item.title || item.itemName || "",
    quantity: Number(item.quantity) || 1,
    unitPrice: Number(item.unitPrice ?? item.rate) || 0,
    discount: Number(item.discount) || 0,
    taxId: item.taxId?._id || item.taxId || "",
    taxRate: Number(item.taxRate) || 0,
    taxName: item.taxName || "",
    total: Number(item.totalValue ?? item.amount ?? item.total) || 0,
    unit: item.unit || "",
    itemType: item.itemType || "",
    expenseAccount: item.expenseAccount?._id || item.expenseAccount || "",
    lineItemCustomFields: item.lineItemCustomFields || {},
  }));
}

const CreateCustomerInvoice = ({ id }) => {
  useTranslation();
  const history = useHistory();
  const location = useLocation();
  const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo.token}`,
  };
  const [businessData, setBusinessData] = useState(null);
  // Business base currency; used as fallback when customer currency is missing.
  const [baseCurrency, setBaseCurrency] = useState("MYR");
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [businesses, setBusinesses] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState();
  const [selectedContract, setSelectedContract] = useState();
  console.log("selectedContract", selectedContract);
  const [accountTypeName, setAccountTypeName] = useState("");
  const [salesContracts, setSalesContracts] = useState([]);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [docNumMissing, setDocNumMissing] = useState(false);
  const [expenseAccounts, setExpenseAccounts] = useState([]);
  const [businessItems, setBusinessItems] = useState([]);
  const [taxes, setTaxes] = useState([]); // Accounts > Taxes for item tax dropdown
  const [paymentTerms, setPaymentTerms] = useState([]);
  const [termsAndConditionsList, setTermsAndConditionsList] = useState([]); // From Settings > Sales > Misc. Data Types

  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [tempSelectedTemplate, setTempSelectedTemplate] = useState(null);
  const [templatePreviews, setTemplatePreviews] = useState({});
  const [viewMode, setViewMode] = useState("normal"); // "normal" or "template-select"
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedContractId, setSelectedContractId] = useState(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [DocumentData, setDocumentData] = useState({});
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [previewRenderedHtml, setPreviewRenderedHtml] = useState("");
  const [profileSignature, setProfileSignature] = useState("");
  const [existingProformaInvoices, setExistingProformaInvoices] = useState([]);
  const [canCreateProforma, setCanCreateProforma] = useState(true);
  const [canCreateCommercial, setCanCreateCommercial] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [addressModalType, setAddressModalType] = useState("Billing"); // "Billing" or "Shipping"
  const [addressTypeConfig, setAddressTypeConfig] = useState({
    billingLabel: "Billing",
    shippingLabel: "Shipping",
  });
  const [sameAsBilling, setSameAsBilling] = useState(false);
  const lastDistinctShippingAddressRef = useRef(""); // Preserve shipping when "same as billing" is checked
  const [editingAddress, setEditingAddress] = useState(null);
  const [proformaValidationMessage, setProformaValidationMessage] =
    useState("");
  const [commercialValidationMessage, setCommercialValidationMessage] =
    useState("");
  const [invoiceTypeInitialized, setInvoiceTypeInitialized] = useState(false);
  const isUpdatingInvoiceTypeRef = useRef(false);
  const lastInvoiceTypeRef = useRef(null);
  const isFetchingContractDetailsRef = useRef(false);
  const hasInitializedRef = useRef(false);
  const isInitializingFromContractRef = useRef(false);
  const [isCalculatingDetails, setIsCalculatingDetails] = useState(false);
  const [showBulkAddItemsModal, setShowBulkAddItemsModal] = useState(false);
  const [showQuickAddCustomer, setShowQuickAddCustomer] = useState(false);
  // Snapshot of invoice data when PDF was generated; if data changes, document is stale and must be regenerated
  const documentSnapshotRef = useRef(null);
  const normalizeSignatureUrl = useCallback(
    (value) => {
      if (!value || typeof value !== "string") return "";
      const trimmed = value.trim();
      if (!trimmed) return "";
      if (/^https?:\/\//i.test(trimmed)) return trimmed;
      if (trimmed.startsWith("//")) return `https:${trimmed}`;
      const base = (Base_URL || "").replace(/\/$/, "");
      const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
      return `${base}${path}`;
    },
    [Base_URL],
  );
  console.log("selectedTemplateId", selectedTemplateId);
  console.log("selectedTemplate", selectedTemplate);
  console.log("location.state?.contractId", location.state?.contractId);
  console.log("selectedTemplateId", selectedTemplateId);

  // Form data state
  const [invoiceData, setInvoiceData] = useState({
    business: "",
    customer: "",
    invoiceNumber: "",
    salesContractNumber: "",
    orderNumber: "",
    invoiceType: "Proforma",
    invoiceDate: formatDateForInput(new Date()),
    dueDate: formatDateForInput(new Date()),
    terms: "Due on Receipt",
    customTerms: "",
    billingAddress: "",
    shippingAddress: "",
    phoneNumber: "",
    faxNumber: "",
    items: [],
    subtotal: 0,
    discountPercentage: 0,
    discountAmount: 0,
    shippingCharges: 0,
    adjustment: 0,
    taxTotal: 0,
    total: 0,
    currency: "",
    supportingDocuments: [],
    template: "Selected Template Name",
    module: "customer-invoices",
    expenseAccount: "", // Main expense account for the invoice
    bankAccount: "",
    customerNotes: "",
    termsAndConditions: "",
  });

  const [formErrors, setFormErrors] = useState({});
  const [invoiceCustomFieldValues, setInvoiceCustomFieldValues] = useState({});
  const [lineItemCustomFieldDefs, setLineItemCustomFieldDefs] = useState([]);
  const [invoiceCustomFieldDefinitions, setInvoiceCustomFieldDefinitions] =
    useState([]);
  const [stockWarnings, setStockWarnings] = useState({}); // { itemIndex: { available, requested, message, isOverstock } }
  const stockCheckTimeoutRef = useRef(null);
  const quotationIdForInvoiceRef = useRef(null);
  const latestItemsRef = useRef([]); // Store latest items for stock checking

  const [advancePayment, setAdvancePayment] = useState({
    isAdvance: false,
    amount: 0,
  });

  useEffect(() => {
    const loadAddressTypes = async () => {
      const businessId = invoiceData.business || businessData?._id;
      const config = await fetchAddressTypeConfig(businessId, headers);
      setAddressTypeConfig(config);
    };
    loadAddressTypes();
  }, [invoiceData.business, businessData?._id]);

  const [contractDetails, setContractDetails] = useState({
    totalAmount: 0,
    remainingAmount: 0,
    advancePayments: [],
    allProformaInvoices: [],
  });

  console.log("invoice data!", invoiceData);
  console.log("selected customer", selectedCustomer);
  console.log("selected Contract", selectedContract);

  // Format date for input fields
  function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  // Prefill invoice from quotation — mirrors the sales order prefill pattern.
  // fromQuotationData: full object passed by QuotationViewer (no extra fetch needed).
  // fromQuotationId:   only ID passed by Quotations list page (fetched async).
  useEffect(() => {
    const quoteData = location.state?.fromQuotationData;
    const qid = location.state?.fromQuotationId;
    if (!quoteData && !qid) return;

    // Prevent re-running for the same quotation (same guard used by fetchBusinesses).
    const key = quoteData?._id ? String(quoteData._id) : String(qid);
    if (quotationIdForInvoiceRef.current === key) return;
    quotationIdForInvoiceRef.current = key;

    // ─── Inline helper: map a quotation → invoice fields ───────────────────
    const applyQuote = (quote) => {
      const moduleKey = String(quote.module || "").trim();
      if (
        moduleKey === "product_certification" ||
        moduleKey === "engineering_inspection"
      ) {
        notifyError(
          "AQCTA quotations generate an invoice only after the customer accepts.",
        );
        return;
      }
      const bizId = String(quote.business_id?._id || quote.business_id || "");
      const custObj =
        quote.customer_id && typeof quote.customer_id === "object"
          ? quote.customer_id
          : null;
      const custId = custObj?._id
        ? String(custObj._id)
        : String(quote.customer_id || "");
      const custName =
        custObj?.basicInformation?.customerDisplayName ||
        custObj?.basicInformation?.companyName ||
        quote.customer_name ||
        "";

      const mappedItems = mapQuotationItemsToInvoiceItems(quote.items);

      const normBill = (quote.billingAddress || "").replace(/\n/g, ", ").trim();
      const normShip = (quote.shippingAddress || "")
        .replace(/\n/g, ", ")
        .trim();
      setSameAsBilling(
        Boolean(quote.sameAsBilling) || !!(normBill && normShip === normBill),
      );

      // 1. Set all invoice fields synchronously (same as sales-order prefill)
      setInvoiceData((prev) => ({
        ...prev,
        business: bizId || prev.business,
        customer: custName || prev.customer,
        orderNumber: quote.quote_number || prev.orderNumber,
        invoiceDate: formatDateForInput(
          quote.quote_date ? new Date(quote.quote_date) : new Date(),
        ),
        dueDate: formatDateForInput(
          quote.expiry_date
            ? new Date(quote.expiry_date)
            : quote.quote_date
              ? new Date(quote.quote_date)
              : new Date(),
        ),
        billingAddress: (quote.billingAddress || "").replace(/\n/g, ", "),
        shippingAddress: (quote.shippingAddress || "").replace(/\n/g, ", "),
        terms: quote.terms || prev.terms || "Due on Receipt",
        customerNotes: quote.customerNotes ?? prev.customerNotes,
        termsAndConditions: quote.termsAndConditions ?? prev.termsAndConditions,
        supportingDocuments: Array.isArray(quote.supportingDocuments)
          ? quote.supportingDocuments
          : prev.supportingDocuments,
        currency:
          custObj?.basicInformation?.currency?.symbol ||
          custObj?.basicInformation?.currency?.prefix ||
          quote.currency ||
          prev.currency ||
          "",
        discountPercentage: Number(quote.discount) || 0,
        discountAmount: Number(quote.discountAmount) || 0,
        shippingCharges: Number(quote.shippingCharges) || 0,
        adjustment: Number(quote.adjustment) || 0,
        subtotal: Number(quote.subTotal) || 0,
        total: Number(quote.grandTotal) || 0,
        items: mappedItems.length ? mappedItems : prev.items,
        taxTotal: sumLineTaxAmountsFromItems(
          mappedItems.length ? mappedItems : prev.items || [],
        ),
      }));

      // 2. Set selectedCustomer — use populated object directly if available,
      //    otherwise fetch by ID (mirrors how sales order prefill works).
      if (custObj) {
        setSelectedCustomer(custObj);
      } else if (custId && String(custId).trim() !== "") {
        setSelectedCustomer({
          _id: custId,
          basicInformation: {
            customerDisplayName: custName || "Customer",
            companyName: custName || "",
            customerEmail: quote.customer_email || "",
          },
        });
        axios
          .get(`${Base_URL}/customers/${custId}`, { headers })
          .then((r) => {
            const cd = r.data;
            setSelectedCustomer(cd);
            setInvoiceData((prev) => ({
              ...prev,
              customer:
                cd?.basicInformation?.customerDisplayName || prev.customer,
              currency:
                cd?.basicInformation?.currency?.symbol ||
                cd?.basicInformation?.currency?.prefix ||
                prev.currency ||
                "",
            }));
          })
          .catch(() => {
            /* keep minimal customer so Save / validation still work */
          });
      }
    };

    // ─── Entry A: full object already available ─────────────────────────────
    if (quoteData) {
      applyQuote(quoteData);
      return;
    }

    // ─── Entry B: only ID — fetch then apply ────────────────────────────────
    let cancelled = false;
    (async () => {
      try {
        const res = await QuotationServices.getQuotationById(qid);
        const quote = res.data?.data;
        if (!quote || cancelled) return;
        applyQuote(quote);
      } catch (e) {
        notifyError(
          e.response?.data?.message ||
            ciText("Could not load quotation for invoice draft."),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [location.state?.fromQuotationData, location.state?.fromQuotationId]);

  console.log("invoiceData.business", invoiceData?.business);

  useEffect(() => {
    const bid = invoiceData.business;
    if (!bid) {
      setLineItemCustomFieldDefs([]);
      setInvoiceCustomFieldDefinitions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [lineDefs, invDefs] = await Promise.all([
          fetchLineItemCustomFieldDefinitions(
            { businessId: bid, transactionContext: "sales:invoice" },
            headers,
          ),
          fetchDefinitions(
            { businessId: bid, module: "sales", screen: "invoice" },
            headers,
          ),
        ]);
        if (!cancelled) {
          setLineItemCustomFieldDefs(lineDefs || []);
          setInvoiceCustomFieldDefinitions(invDefs || []);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setLineItemCustomFieldDefs([]);
          setInvoiceCustomFieldDefinitions([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [invoiceData.business, adminInfo?.token]);

  // Handle sales order or recurring-profile pre-fill (same payload shape)
  useEffect(() => {
    const prefill =
      location.state?.salesOrderData || location.state?.recurringInvoicePrefill;
    if (!prefill || isInitializingFromContractRef.current) {
      return;
    }
    const salesOrderData = prefill;

    const resolvedQuotationId =
      salesOrderData.quotationId?._id ?? salesOrderData.quotationId;
    if (resolvedQuotationId != null && String(resolvedQuotationId).trim()) {
      quotationIdForInvoiceRef.current = String(resolvedQuotationId);
    }

    // Pre-fill invoice data from sales order
    const invoiceDate =
      salesOrderData.invoiceDate || formatDateForInput(new Date());
    const terms = salesOrderData.terms || "Due on Receipt";
    // Calculate due date if payment terms and invoice date are available
    const calculatedDueDate =
      terms && invoiceDate
        ? calculateDueDate(terms, invoiceDate) ||
          salesOrderData.dueDate ||
          formatDateForInput(new Date())
        : salesOrderData.dueDate || formatDateForInput(new Date());

    const bizRaw = salesOrderData.business;
    const businessIdStr =
      bizRaw && typeof bizRaw === "object" && bizRaw._id
        ? String(bizRaw._id)
        : String(bizRaw || "");

    const discountAmt =
      Number(salesOrderData.discountAmount ?? salesOrderData.discount ?? 0) ||
      0;
    const discountPct =
      salesOrderData.discountPercentage != null &&
      salesOrderData.discountPercentage !== ""
        ? Number(salesOrderData.discountPercentage)
        : null;
    const shippingNum = Number(salesOrderData.shippingCharges) || 0;
    const adjustmentNum = Number(salesOrderData.adjustment) || 0;

    const salesOrderMappedItems =
      salesOrderData.items?.map((item, idx) => {
        const { itemName: resolvedName, description: resolvedDesc } =
          resolveOrderLineItemAndDescription(item, idx);
        return {
        id: idx + 1,
        itemName: resolvedName,
        description: resolvedDesc,
        quantity:
          item.quantity !== undefined && item.quantity !== null
            ? Number(item.quantity)
            : 1,
        unitPrice: Number(item.unitPrice ?? item.rate ?? 0) || 0,
        discount: Number(item.discount) || 0,
        total: (() => {
          const fromApi = Number(item.totalValue ?? item.total);
          if (Number.isFinite(fromApi) && fromApi >= 0) return fromApi;
          const amtPlusTax =
            Number(item.amount ?? 0) + Number(item.tax ?? 0);
          if (amtPlusTax > 0) return amtPlusTax;
          return getItemTotal(
            item.quantity ?? 1,
            item.unitPrice ?? item.rate ?? 0,
            item.discount ?? 0,
            item.taxRate ?? 0,
          );
        })(),
        tax: Number(item.tax) || 0,
        taxRate: Number(item.taxRate) || 0,
        itemId: item.itemId || undefined,
        taxId: item.taxId || undefined,
        taxName: item.taxName || undefined,
        expenseAccount: item.expenseAccount || undefined,
        unit: item.unit || undefined,
        itemType: item.itemType || undefined,
        isAdvancePayment: item.isAdvancePayment || false,
        lineItemCustomFields:
          item.lineItemCustomFields &&
          typeof item.lineItemCustomFields === "object"
            ? { ...item.lineItemCustomFields }
            : {},
      };
      }) || [];

    const prefTax =
      salesOrderData.taxTotal !== undefined &&
      salesOrderData.taxTotal !== null &&
      salesOrderData.taxTotal !== ""
        ? Number(salesOrderData.taxTotal)
        : null;
    const salesOrderTaxTotal =
      prefTax != null && !Number.isNaN(prefTax)
        ? prefTax
        : sumLineTaxAmountsFromItems(salesOrderMappedItems);

    const subtotalNum = sumLineGrossFromItems(salesOrderMappedItems);

    const headerTotalRaw =
      salesOrderData.grandTotal !== undefined &&
      salesOrderData.grandTotal !== null
        ? Number(salesOrderData.grandTotal)
        : salesOrderData.total !== undefined && salesOrderData.total !== null
          ? Number(salesOrderData.total)
          : null;
    const computedTotal = computeInvoiceTotalFromHeader({
      subtotal: subtotalNum,
      discountAmount: discountAmt,
      shippingCharges: shippingNum,
      adjustment: adjustmentNum,
    });
    const headerTotal =
      headerTotalRaw != null && !Number.isNaN(headerTotalRaw)
        ? headerTotalRaw
        : computedTotal;

    setInvoiceData((prev) => ({
      ...prev,
      business: businessIdStr || prev.business,
      customer:
        typeof salesOrderData.customer === "object" &&
        salesOrderData.customer !== null &&
        salesOrderData.customer._id
          ? String(salesOrderData.customer._id)
          : String(salesOrderData.customer || ""),
      orderNumber: salesOrderData.orderNumber || "",
      invoiceDate: invoiceDate,
      dueDate: calculatedDueDate,
      terms: terms,
      billingAddress: salesOrderData.billingAddress || "",
      shippingAddress: salesOrderData.shippingAddress || "",
      phoneNumber: salesOrderData.phone || "",
      faxNumber: salesOrderData.fax || "",
      currency: salesOrderData.currency || "",
      invoiceType: salesOrderData.invoiceType || prev.invoiceType,
      bankAccount: salesOrderData.bankAccount || prev.bankAccount,
      items: salesOrderMappedItems,
      subtotal: subtotalNum,
      discountPercentage:
        discountPct != null && !Number.isNaN(discountPct)
          ? discountPct
          : subtotalNum > 0 && discountAmt > 0
            ? (discountAmt / subtotalNum) * 100
            : 0,
      discountAmount: discountAmt,
      taxTotal: salesOrderTaxTotal,
      shippingCharges: shippingNum,
      adjustment: adjustmentNum,
      total: headerTotal,
      customerNotes: salesOrderData.customerNotes || "",
      termsAndConditions: salesOrderData.termsAndConditions || "",
    }));

    // Note: keep `baseCurrency` as business base currency (fallback only).

    // Check stock for pre-filled items after a short delay
    const preFilledItems = salesOrderMappedItems.map((row) => ({
      id: row.id,
      description: row.description || "",
      quantity: row.quantity,
      unitPrice: row.unitPrice,
      discount: row.discount,
      total: row.total,
      tax: row.tax,
      taxRate: row.taxRate,
      itemId: row.itemId,
      taxId: row.taxId,
    }));

    // Check stock after state is updated
    setTimeout(() => {
      checkItemsStock(preFilledItems);
    }, 1500);

    // Set selected customer (stub first so Save/Draft work before fetch completes)
    const custRef = salesOrderData.customer;
    if (
      custRef &&
      typeof custRef === "object" &&
      custRef._id &&
      custRef.basicInformation
    ) {
      setSelectedCustomer(custRef);
    } else if (salesOrderData.customer) {
      const custIdStr =
        typeof custRef === "object" && custRef?._id
          ? String(custRef._id)
          : String(custRef || "").trim();
      if (custIdStr) {
        const label =
          salesOrderData.customerName ||
          (typeof custRef === "object"
            ? custRef?.basicInformation?.customerDisplayName
            : "") ||
          "Customer";
        setSelectedCustomer({
          _id: custIdStr,
          basicInformation: {
            customerDisplayName: label,
            companyName: label,
            customerEmail: "",
          },
        });
      }
      axios
        .get(`${Base_URL}/customers/${custIdStr}`, { headers })
        .then((response) => {
          const customerData = response.data;
          setSelectedCustomer(customerData);
          // Update invoiceData with customer name instead of ID
          setInvoiceData((prev) => ({
            ...prev,
            customer:
              customerData?.basicInformation?.customerDisplayName ||
              prev.customer,
          }));
          // Currency will be updated from customer data if available
          // But preserve sales order currency if customer doesn't have one
          if (
            !customerData?.basicInformation?.currency &&
            salesOrderData.currency
          ) {
            // Keep invoice currency as prefilled from sales order.
          }
        })
        .catch((error) => {
          console.error("Error fetching customer:", error);
        });
    }
  }, [location.state?.salesOrderData, location.state?.recurringInvoicePrefill]);

  // Cleanup debounced stock-check timeout on unmount
  useEffect(() => {
    return () => {
      if (stockCheckTimeoutRef.current) {
        clearTimeout(stockCheckTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (
      location.state?.contractId &&
      !selectedContract &&
      !isInitializingFromContractRef.current &&
      !location.state?.salesOrderData &&
      !location.state?.recurringInvoicePrefill
    ) {
      const fetchData = async () => {
        if (!location.state?.contractId) return;

        // Prevent multiple initializations
        if (isInitializingFromContractRef.current) return;
        isInitializingFromContractRef.current = true;
        setIsCalculatingDetails(true);

        try {
          const response = await axios.get(
            `${Base_URL}/sales-contracts/${location.state?.contractId}`,
            { headers },
          );
          console.log("response?.data!!!", response?.data);
          const contractData = response?.data;

          // First check contract status to set correct invoice type BEFORE setting any state
          const statusResult = await checkContractInvoiceStatus(
            location.state?.contractId,
          );

          // Use the invoice type returned from checkContractInvoiceStatus, or determine from status
          const correctInvoiceType =
            statusResult?.invoiceType ||
            (statusResult?.proformaExists
              ? "Commercial"
              : statusResult?.defaultType || "Proforma");

          // Fetch existing proforma invoices for this contract BEFORE setting state
          const proformaResponse = await axios.get(
            `${Base_URL}/proforma-invoice/get_by_contract/${location.state?.contractId}`,
          );
          const allProformaInvoices = proformaResponse.data.data || [];

          // Calculate all values BEFORE setting any state to prevent flickering
          // Use amountInSelectedCurrency or totalValue from contract, not calculated quantity * price
          const contractItems = (contractData?.productInfo || []).map(
            (product, idx) => {
              const quantity = product.quantityMTS || 0;
              const unitPrice = product.price || 0;
              const total =
                product.amountInSelectedCurrency ||
                product.totalValue ||
                quantity * unitPrice;
              return {
                id: idx + 1,
                quantity,
                description: product.title || "",
                unitPrice,
                discount: 0,
                total: Math.max(0, total),
              };
            },
          );
          // Contract total should be sum of amountInSelectedCurrency from all products
          const contractTotal = (contractData?.productInfo || []).reduce(
            (sum, product) =>
              sum +
              (product.amountInSelectedCurrency ||
                product.totalValue ||
                (product.quantityMTS || 0) * (product.price || 0) ||
                0),
            0,
          );
          const depositPercentage = contractData.productInfo[0]?.deposit || 0;
          const depositAmount = (contractTotal * depositPercentage) / 100;

          // Calculate final items and totals based on invoice type
          let finalItems = [...contractItems];
          let finalTotal = contractTotal;

          console.log("Initialization - Before Commercial calculation:", {
            correctInvoiceType,
            contractTotal,
            contractItemsCount: contractItems.length,
            contractItemsTotal: contractItems.reduce(
              (sum, item) => sum + (item.total || 0),
              0,
            ),
            allProformaInvoicesCount: allProformaInvoices.length,
          });

          if (correctInvoiceType === "Commercial") {
            const advancePayments = allProformaInvoices.filter(
              (inv) =>
                inv.invoiceType === "Proforma" &&
                (inv.status === "generated" || inv.status === "draft"),
            );

            console.log(
              "Initialization - Advance payments found:",
              advancePayments.map((inv) => ({
                invoice_number: inv.invoice_number,
                invoiceType: inv.invoiceType,
                status: inv.status,
                advanceDepositAmount: inv.advanceDepositAmount,
                grandTotal: inv.grandTotal,
              })),
            );

            if (advancePayments.length > 0) {
              const negativeItems = advancePayments.map((inv, idx) => {
                const actualAdvanceAmount =
                  inv.advanceDepositAmount || inv.grandTotal || 0;
                console.log("Initialization - Creating negative item:", {
                  invoice_number: inv.invoice_number,
                  actualAdvanceAmount,
                  advanceDepositAmount: inv.advanceDepositAmount,
                  grandTotal: inv.grandTotal,
                });
                return {
                  id: contractItems.length + idx + 1,
                  quantity: 1,
                  description: `Advance Payment - ${inv.invoice_number}`,
                  unitPrice: -Math.abs(actualAdvanceAmount),
                  discount: 0,
                  total: -Math.abs(actualAdvanceAmount),
                  isAdvancePayment: true,
                };
              });

              finalItems = [...contractItems, ...negativeItems];
              const totalAdvancePayments = advancePayments.reduce(
                (sum, inv) => {
                  const advanceAmount =
                    inv.advanceDepositAmount || inv.grandTotal || 0;
                  return sum + advanceAmount;
                },
                0,
              );
              finalTotal = contractTotal - totalAdvancePayments;

              console.log("Initialization - Final items calculation:", {
                contractItemsCount: contractItems.length,
                negativeItemsCount: negativeItems.length,
                finalItemsCount: finalItems.length,
                totalAdvancePayments,
                finalTotal,
                finalItemsTotal: finalItems.reduce(
                  (sum, item) => sum + (item.total || 0),
                  0,
                ),
              });
            } else {
              console.log(
                "Initialization - No advance payments, using full contract items",
              );
            }
          }

          // Calculate invoice data values
          let baseSubtotal;
          if (
            correctInvoiceType === "Proforma" &&
            depositPercentage > 0 &&
            depositPercentage < 100
          ) {
            baseSubtotal = depositAmount;
          } else if (correctInvoiceType === "Commercial") {
            const itemsSubtotal = finalItems.reduce(
              (sum, item) => sum + (item.total || 0),
              0,
            );
            console.log("Initialization - Commercial Invoice Calculation:", {
              contractTotal,
              contractItems: contractItems.map((item) => ({
                description: item.description,
                total: item.total,
              })),
              finalItems: finalItems.map((item) => ({
                description: item.description,
                total: item.total,
                isAdvancePayment: item.isAdvancePayment,
              })),
              itemsSubtotal,
              finalTotal,
              advancePayments: allProformaInvoices
                .filter(
                  (inv) =>
                    inv.invoiceType === "Proforma" &&
                    (inv.status === "generated" || inv.status === "draft"),
                )
                .map((inv) => ({
                  invoice_number: inv.invoice_number,
                  advanceDepositAmount: inv.advanceDepositAmount,
                  grandTotal: inv.grandTotal,
                })),
            });
            baseSubtotal = Math.max(0, itemsSubtotal);
          } else {
            baseSubtotal = Math.abs(finalTotal);
          }

          const discountAmount = 0; // Initial discount
          const calculatedTotal = baseSubtotal - discountAmount;

          let advanceDepositAmount = 0;
          if (correctInvoiceType === "Proforma" && depositPercentage > 0) {
            advanceDepositAmount = depositAmount;
          }

          const finalTotalAmount = Math.max(
            0,
            correctInvoiceType === "Commercial"
              ? Math.max(0, calculatedTotal)
              : calculatedTotal,
          );

          // Get account type
          const accountTypeRes = await axios.get(
            `${Base_URL}/bank-account-types/${contractData.Account_Info.accountType}`,
          );

          // Now set all state in one batch to prevent flickering
          setAccountTypeName(accountTypeRes.data?.name || "");
          setSelectedContract(contractData);
          setExistingProformaInvoices(allProformaInvoices);

          setContractDetails({
            totalAmount: contractTotal,
            depositPercentage,
            depositAmount,
            advancePayments: allProformaInvoices,
            remainingAmount: finalTotal,
          });

          // Set invoice data with all calculated values at once
          console.log("Initialization - Setting invoice data:", {
            finalItemsCount: finalItems.length,
            finalItems: finalItems.map((item) => ({
              description: item.description,
              total: item.total,
              isAdvancePayment: item.isAdvancePayment,
            })),
            baseSubtotal,
            finalTotalAmount,
            contractTotal,
            finalTotal,
          });

          setInvoiceData({
            business: response?.data?.business,
            customer: response?.data?.basicInfo?.customer_id,
            invoiceNumber: invoiceData.invoiceNumber || "INV-0006541",
            salesContractNumber: contractData?.contractNo,
            invoiceType: correctInvoiceType,
            invoiceDate: formatDateForInput(new Date()),
            dueDate: formatDateForInput(new Date()),
            terms:
              contractData?.productInfo[0]?.shippingTerms || "Due on Receipt",
            billingAddress: "",
            phoneNumber: "",
            faxNumber: "",
            items: finalItems,
            subtotal: baseSubtotal,
            taxTotal: sumLineTaxAmountsFromItems(finalItems),
            discountPercentage: 0,
            discountAmount: 0,
            shippingCharges: 0,
            adjustment: 0,
            total: finalTotalAmount,
            currency:
              typeof contractData?.productInfo[0]?.selectedCurrency === "object"
                ? contractData?.productInfo[0]?.selectedCurrency?.symbol ||
                  contractData?.productInfo[0]?.selectedCurrency?.prefix ||
                  baseCurrency ||
                  "MYR"
                : contractData?.productInfo[0]?.selectedCurrency ||
                  baseCurrency ||
                  "MYR",
            supportingDocuments: [],
            template: "Selected Template Name",
            module: "customer-invoices",
            expenseAccount: "",
            deposit: depositPercentage,
            depositAmount,
            contractTotal,
            advanceDepositAmount,
            salesContractTotal: contractTotal,
            remainingAmount: finalTotal,
            bankAccount: contractData?.Account_Info?.bankAccount || "",
          });

          console.log("Initialization - Invoice data set successfully");

          // Set customer data - but preserve invoice data that was just set
          // Don't call handleChangeCustomer here as it will reset invoice data
          // Instead, set customer data directly
          const customerResponse = await axios.get(
            `${Base_URL}/customers/${contractData?.basicInfo?.customer_id}`,
          );
          const customerData = customerResponse?.data;
          setSelectedCustomer(customerData);

          // Update invoice data with customer info while preserving items and totals
          setInvoiceData((prev) => ({
            ...prev,
            customer: customerData?.basicInformation?.customerDisplayName || "",
            phoneNumber:
              customerData?.basicInformation?.customerPhone?.mobile ||
              customerData?.companyInfo?.phone ||
              "",
            billingAddress: customerData?.companyInfo?.billingAddress || "",
            faxNumber:
              customerData?.companyInfo?.contact?.fax ||
              customerData?.companyInfo?.fax ||
              "",
          }));

          // Mark as initialized AFTER all state is set
          hasInitializedRef.current = true;
          lastInvoiceTypeRef.current = correctInvoiceType;
          setInvoiceTypeInitialized(true);
        } catch (err) {
          console.log("error!!", err);
          notifyError(ciText("Failed to fetch contract details"));
        } finally {
          setIsCalculatingDetails(false);
        }
      };

      fetchData();
    } else if (
      selectedContract?._id &&
      !location.state?.contractId &&
      !hasInitializedRef.current
    ) {
      // Check proforma validation immediately when component loads with selected contract
      // Only if not coming from contract route
      fetchContractDetails(selectedContract._id);
    }
    // Admin info is already loaded from context, no need to set it from localStorage

    if (!location.state?.contractId || selectedContract) {
      const prefillBusinessId =
        location.state?.recurringInvoicePrefill?.business ||
        location.state?.salesOrderData?.business ||
        "";

      const fetchBusinesses = async () => {
        try {
          // Use same source as Customer Invoices list (admin/assigned) so saved drafts appear in the list
          if (adminInfo?.id) {
            const response = await axios.get(
              `${Base_URL}/admin/assigned/${adminInfo.id}`,
              { headers },
            );
            const list = response.data?.businesses || [];
            if (list.length > 0) {
              setBusinesses(list);
              // When coming from a quotation, the prefill effect sets the correct business —
              // do NOT auto-select list[0] and overwrite it.
              const isQuotationConversion = !!quotationIdForInvoiceRef.current;
              const businessId =
                invoiceData?.business ||
                prefillBusinessId ||
                (!isQuotationConversion ? list[0]?._id : "") ||
                "";
              if (
                businessId &&
                !invoiceData?.business &&
                !isQuotationConversion
              ) {
                setInvoiceData((prev) => ({
                  ...prev,
                  business: businessId,
                }));
                try {
                  const bizRes = await axios.get(
                    `${Base_URL}/business/${businessId}`,
                    { headers },
                  );
                  setBusinessData(bizRes.data?.data);
                } catch (err) {
                  console.error("Error fetching business data:", err);
                }
              }
              return;
            }
          }
          // Fallback: localStorage (e.g. when admin/assigned not available)
          const storedBusinesses = localStorage.getItem("businesses");
          if (storedBusinesses) {
            const parsedData = JSON.parse(storedBusinesses);
            setBusinesses(parsedData);
            const isQuotationConversion = !!quotationIdForInvoiceRef.current;
            const businessId =
              invoiceData?.business ||
              prefillBusinessId ||
              (!isQuotationConversion ? parsedData[0]?._id : "") ||
              "";
            if (
              businessId &&
              !invoiceData?.business &&
              !isQuotationConversion
            ) {
              setInvoiceData((prev) => ({
                ...prev,
                business: businessId,
              }));
              try {
                const response = await axios.get(
                  `${Base_URL}/business/${businessId}`,
                  { headers },
                );
                setBusinessData(response.data?.data);
              } catch (error) {
                console.error("Error fetching business data:", error);
              }
            }
          }
        } catch (error) {
          console.error("Failed to fetch businesses:", error);
          notifyError(ciText("Failed to load businesses"));
        }
      };

      fetchBusinesses();

      // Fetch business data if business is already set (or provided via navigation prefill — effect may run before prefill state is merged)
      const effectiveBusinessId = invoiceData?.business || prefillBusinessId;
      if (effectiveBusinessId) {
        const fetchBusinessData = async () => {
          try {
            const response = await axios.get(
              `${Base_URL}/business/${effectiveBusinessId}`,
              { headers },
            );
            console.log("response?.data?.business", response?.data);
            const business = response.data.data;
            setBusinessData(business);
            // Auto-populate terms & conditions from business if invoice doesn't have custom terms
            if (
              business?.termsAndConditions &&
              !invoiceData.termsAndConditions
            ) {
              setInvoiceData((prev) => ({
                ...prev,
                termsAndConditions: business.termsAndConditions,
              }));
            }
            // Currency will be fetched in the dedicated useEffect when invoiceData.business changes
          } catch (error) {
            console.error("Error fetching business data:", error);
          }
        };
        fetchBusinessData();
      }

      const fetchSalesContracts = async () => {
        if (!selectedCustomer?._id) return;
        const bizForContracts = invoiceData?.business || prefillBusinessId;
        if (!bizForContracts) return;
        try {
          const response = await axios.get(
            `${Base_URL}/sales-contracts/customer/${selectedCustomer._id}?businessId=${bizForContracts}`,
          );
          console.log("response?.data?.contracts", response?.data?.contracts);
          setSalesContracts(response?.data?.contracts || []);
        } catch (error) {
          console.error("Error fetching sales contracts:", error);
        }
      };

      const fetchExpenseAccounts = async () => {
        const bizForAccounts = invoiceData?.business || prefillBusinessId;
        if (!bizForAccounts) return;
        try {
          const response = await axios.get(`${Base_URL}/accounts`, {
            params: { business: bizForAccounts },
          });
          console.log("expense accounts response", response?.data);
          setExpenseAccounts(response?.data?.accounts || []);
        } catch (error) {
          console.error("Error fetching expense accounts:", error);
        }
      };

      fetchSalesContracts();
      fetchExpenseAccounts();
    }
  }, [
    id,
    Base_URL,
    invoiceData.business,
    selectedCustomer?._id,
    adminInfo?.id,
  ]);

  // Generate invoice number from document sequences when business is known (new invoices only)
  useEffect(() => {
    if (id) return;
    const bizId = businessData?._id || invoiceData?.business;
    if (!bizId) return;
    const businessGroupId =
      businessData?.businessGroup?._id || businessData?.businessGroup;
    const linkedSalesOrderNumber =
      location.state?.salesOrderNumber ||
      location.state?.salesOrderData?.salesOrderNumber ||
      null;
    const linkedSalesOrderId = location.state?.salesOrderId || null;
    if (linkedSalesOrderId && linkedSalesOrderNumber) {
      generateInvoiceNumber(bizId, businessGroupId || undefined, {
        sourceDocumentType: "sales_order",
        sourceDocumentNumber: linkedSalesOrderNumber,
      });
    } else {
      generateInvoiceNumber(bizId, businessGroupId || undefined);
    }
  }, [
    businessData?._id,
    businessData?.businessGroup,
    invoiceData?.business,
    id,
    location.state?.salesOrderId,
    location.state?.salesOrderNumber,
    location.state?.salesOrderData?.salesOrderNumber,
  ]);

  // Load business terms & conditions when business changes
  useEffect(() => {
    const loadBusinessTerms = async () => {
      if (!invoiceData?.business) {
        return;
      }
      try {
        const response = await axios.get(
          `${Base_URL}/business/${invoiceData.business}`,
          { headers },
        );
        const business = response.data.data;
        if (business?.termsAndConditions && !invoiceData.termsAndConditions) {
          setInvoiceData((prev) => ({
            ...prev,
            termsAndConditions: business.termsAndConditions,
          }));
        }
      } catch (error) {
        console.error("Error loading business terms & conditions:", error);
      }
    };
    loadBusinessTerms();
  }, [invoiceData.business]);

  // Fetch active payment terms when business is selected
  useEffect(() => {
    const fetchPaymentTerms = async () => {
      if (!invoiceData?.business) {
        setPaymentTerms([]);
        return;
      }

      try {
        const paymentTermsResponse = await axios.post(
          `${Base_URL}/items/Payment Terms/get_all`,
          {
            business_id: invoiceData.business,
            FilterStatus: "active",
            FilterName: "",
          },
          { headers },
        );
        if (paymentTermsResponse.data.success) {
          setPaymentTerms(paymentTermsResponse.data.data || []);
        } else {
          setPaymentTerms([]);
        }
      } catch (error) {
        console.error("Error fetching payment terms:", error);
        setPaymentTerms([]);
      }
    };

    fetchPaymentTerms();
  }, [invoiceData.business]);

  // Fetch Terms and Conditions from Settings > Sales > Misc. Data Types (same org)
  useEffect(() => {
    const fetchTermsAndConditions = async () => {
      if (!invoiceData?.business) {
        setTermsAndConditionsList([]);
        return;
      }
      try {
        const res = await axios.post(
          `${Base_URL}/items/Terms and Conditions/get_all`,
          {
            business_id: invoiceData.business,
            FilterStatus: "active",
            FilterName: "",
          },
          { headers },
        );
        setTermsAndConditionsList(res.data?.success ? res.data.data || [] : []);
      } catch (err) {
        console.error("Error fetching terms and conditions:", err);
        setTermsAndConditionsList([]);
      }
    };
    fetchTermsAndConditions();
  }, [invoiceData.business]);

  // Auto-calculate due date when payment term or invoice date changes (uses Number of Days from term when available)
  // Skip when terms is Custom/Manual so manual due date is not overwritten
  useEffect(() => {
    const termsName = (invoiceData.terms || "").trim();
    if (
      termsName === "Custom" ||
      termsName === "Manual" ||
      !invoiceData.terms ||
      !invoiceData.invoiceDate
    ) {
      return;
    }
    const selectedTerm = paymentTerms.find((t) => t.name === invoiceData.terms);
    const calculatedDueDate = calculateDueDate(
      selectedTerm || invoiceData.terms,
      invoiceData.invoiceDate,
    );
    if (calculatedDueDate && calculatedDueDate !== invoiceData.dueDate) {
      setInvoiceData((prev) => ({
        ...prev,
        dueDate: calculatedDueDate,
      }));
    }
  }, [invoiceData.terms, invoiceData.invoiceDate, paymentTerms]);

  // Sync invoiceNumber state with invoiceData.invoiceNumber
  useEffect(() => {
    if (invoiceNumber) {
      setInvoiceData((prev) => {
        // Only update if different to avoid unnecessary re-renders
        if (prev.invoiceNumber !== invoiceNumber) {
          return {
            ...prev,
            invoiceNumber: invoiceNumber,
          };
        }
        return prev;
      });
    }
  }, [invoiceNumber]);

  // Check proforma validation immediately when contract is selected
  // Skip if we're initializing from contract route
  useEffect(() => {
    if (
      selectedContract?._id &&
      !location.state?.contractId &&
      !hasInitializedRef.current &&
      !isInitializingFromContractRef.current
    ) {
      const initializeContract = async () => {
        hasInitializedRef.current = true;
        setIsCalculatingDetails(true);
        try {
          const statusResult = await checkContractInvoiceStatus(
            selectedContract._id,
          );
          const correctInvoiceType =
            statusResult?.invoiceType ||
            (statusResult?.proformaExists
              ? "Commercial"
              : statusResult?.defaultType || "Proforma");
          await fetchContractDetails(selectedContract._id, correctInvoiceType);
        } finally {
          setIsCalculatingDetails(false);
        }
      };
      initializeContract();
    }
  }, [selectedContract?._id]);

  // Recalculate totals when invoice type changes (but only after initialization and if it's a user change)
  useEffect(() => {
    // Skip if we're in the middle of updating invoice type programmatically
    if (isUpdatingInvoiceTypeRef.current) {
      return;
    }

    // Skip if we haven't initialized yet
    if (!hasInitializedRef.current) {
      return;
    }

    // Skip if we're initializing from contract route (to prevent double calculation)
    if (isInitializingFromContractRef.current) {
      return;
    }

    // Skip if we're currently calculating details
    if (isCalculatingDetails) {
      return;
    }

    if (
      selectedContract?._id &&
      invoiceData.invoiceType &&
      invoiceTypeInitialized &&
      lastInvoiceTypeRef.current !== invoiceData.invoiceType &&
      lastInvoiceTypeRef.current !== null &&
      !location.state?.contractId // Don't recalculate if coming from contract route
    ) {
      // Only recalculate if the invoice type actually changed and it's not during initialization
      lastInvoiceTypeRef.current = invoiceData.invoiceType;

      // Only fetch if not already fetching
      if (!isFetchingContractDetailsRef.current) {
        fetchContractDetails(selectedContract._id, invoiceData.invoiceType);
      }
    }
  }, [invoiceData.invoiceType]);

  const handleChangeCustomer = async (customerId) => {
    console.log("customer Id!!", customerId);
    try {
      const response = await axios.get(`${Base_URL}/customers/${customerId}`);
      console.log("customer response!!", response?.data);
      const customerData = response?.data;
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
      const billingAddressObj = findAddressBySystemType(
        addresses,
        addressTypeConfig,
        "BILLING",
      );
      const shippingAddressObj = findAddressBySystemType(
        addresses,
        addressTypeConfig,
        "SHIPPING",
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

      // Get customer currency from basicInformation.currency
      const customerCurrency =
        customerData?.basicInformation?.currency?.symbol ||
        customerData?.basicInformation?.currency?.prefix ||
        baseCurrency ||
        "MYR";

      console.log("Customer data:", {
        addresses,
        billingAddressObj,
        shippingAddressObj,
        billingAddress,
        shippingAddress,
        phoneNumber,
        faxNumber,
        customerCurrency,
        currencyObject: customerData?.basicInformation?.currency,
      });

      // Use functional update to preserve existing invoice data (especially items and totals)
      setInvoiceData((prev) => ({
        ...prev,
        customer: customerData?.basicInformation?.customerDisplayName || "",
        phoneNumber,
        billingAddress: billingAddress
          ? billingAddress.replace(/\n/g, ", ")
          : "",
        shippingAddress,
        faxNumber,
        currency: customerCurrency, // Set currency from customer
      }));
      const normalizedBilling = (billingAddress || "")
        .replace(/\n/g, ", ")
        .trim();
      const normalizedShipping = (shippingAddress || "")
        .replace(/\n/g, ", ")
        .trim();
      setSameAsBilling(
        !!normalizedBilling && normalizedBilling === normalizedShipping,
      );
    } catch (error) {
      console.log("Error fetching customer data:", error);
    }
  };
  console.log("can create proforma", canCreateProforma);
  console.log("can create commercial", canCreateCommercial);
  console.log("proforma validation message", proformaValidationMessage);
  console.log("commercial validation message", commercialValidationMessage);

  const checkContractInvoiceStatus = async (contractId) => {
    try {
      console.log("Checking contract invoice status for:", contractId);
      const response = await axios.get(
        `${Base_URL}/proforma-invoice/check-contract-status/${contractId}`,
        { headers },
      );

      console.log("Contract status response:", response.data);
      const { availableTypes, defaultType, proformaExists, commercialExists } =
        response.data.data;

      // Set invoice type availability
      setCanCreateProforma(availableTypes.proforma.available);
      setCanCreateCommercial(availableTypes.commercial.available);

      console.log("Can create proforma:", availableTypes.proforma.available);
      console.log(
        "Can create commercial:",
        availableTypes.commercial.available,
      );

      // Set validation messages
      if (!availableTypes.proforma.available) {
        setProformaValidationMessage(
          "A Proforma Invoice already exists for this contract.",
        );
      } else {
        setProformaValidationMessage("");
      }

      if (!availableTypes.commercial.available) {
        if (commercialExists) {
          setCommercialValidationMessage(
            "A Commercial Invoice already exists for this contract.",
          );
        } else if (!proformaExists) {
          setCommercialValidationMessage(
            "A Proforma Invoice must be created first.",
          );
        } else {
          setCommercialValidationMessage("");
        }
      } else {
        setCommercialValidationMessage("");
      }

      // Set default invoice type - prioritize Commercial if proforma exists
      // If proforma exists, default to Commercial; otherwise use the defaultType from backend
      const preferredDefaultType = proformaExists
        ? "Commercial"
        : defaultType || "Proforma";

      // Always set the invoice type based on what's available
      // If proforma exists, set to Commercial; if not, set to Proforma
      const finalInvoiceType =
        proformaExists && availableTypes.commercial.available
          ? "Commercial"
          : !proformaExists && availableTypes.proforma.available
            ? "Proforma"
            : preferredDefaultType;

      setInvoiceData((prev) => {
        // Only update if the type actually changed and we're not already updating
        if (
          finalInvoiceType !== prev.invoiceType &&
          !isUpdatingInvoiceTypeRef.current
        ) {
          isUpdatingInvoiceTypeRef.current = true;
          lastInvoiceTypeRef.current = prev.invoiceType; // Store the previous value
          setInvoiceTypeInitialized(true);

          // Reset the flag after a short delay to allow useEffect to run
          setTimeout(() => {
            isUpdatingInvoiceTypeRef.current = false;
          }, 200);

          return {
            ...prev,
            invoiceType: finalInvoiceType,
          };
        } else {
          // Even if type didn't change, mark as initialized and set the ref
          if (!invoiceTypeInitialized) {
            setInvoiceTypeInitialized(true);
            lastInvoiceTypeRef.current = prev.invoiceType;
          }
        }
        return prev;
      });

      return {
        availableTypes,
        defaultType: preferredDefaultType,
        proformaExists,
        commercialExists,
        invoiceType: finalInvoiceType,
      };
    } catch (error) {
      console.error("Error checking contract invoice status:", error);
      return null;
    }
  };

  const fetchContractDetails = async (
    contractId,
    currentInvoiceType = null,
  ) => {
    // Prevent multiple simultaneous calls
    if (isFetchingContractDetailsRef.current) {
      console.log("fetchContractDetails already in progress, skipping...");
      return;
    }

    // Don't recalculate if we're initializing from contract route (already calculated)
    if (
      isInitializingFromContractRef.current &&
      location.state?.contractId === contractId
    ) {
      console.log(
        "fetchContractDetails: Skipping - already initialized from contract route",
      );
      return;
    }

    isFetchingContractDetailsRef.current = true;
    setIsCalculatingDetails(true);

    try {
      const response = await axios.get(
        `${Base_URL}/sales-contracts/${contractId}`,
      );
      const contract = response.data;

      // Check contract invoice status first (but don't update state if we're just recalculating)
      const contractStatus = await checkContractInvoiceStatus(contractId);

      // Fetch existing proforma invoices for this contract
      const proformaResponse = await axios.get(
        `${Base_URL}/proforma-invoice/get_by_contract/${contractId}`,
      );
      const allProformaInvoices = proformaResponse.data.data || [];

      // Only update existing proforma invoices if not already set (to prevent flickering)
      if (!isInitializingFromContractRef.current) {
        setExistingProformaInvoices(allProformaInvoices);
      }

      // Build contract items from productInfo
      // Use amountInSelectedCurrency or totalValue from contract, not calculated quantity * price
      const contractItems = (contract.productInfo || []).map((product, idx) => {
        const quantity = product.quantityMTS || 0;
        const unitPrice = product.price || 0;
        const total =
          product.amountInSelectedCurrency ||
          product.totalValue ||
          quantity * unitPrice;
        return {
          id: idx + 1,
          quantity,
          description: product.title || "",
          unitPrice,
          discount: 0,
          total: Math.max(0, total),
        };
      });
      // Contract total should be sum of amountInSelectedCurrency from all products
      const contractTotal = (contract.productInfo || []).reduce(
        (sum, product) =>
          sum +
          (product.amountInSelectedCurrency ||
            product.totalValue ||
            (product.quantityMTS || 0) * (product.price || 0) ||
            0),
        0,
      );
      const depositPercentage = contract.productInfo[0]?.deposit || 0;
      const depositAmount = (contractTotal * depositPercentage) / 100;

      // Handle different invoice types based on SOPs
      let finalItems = [...contractItems];
      let finalTotal = contractTotal;

      // Use the passed currentInvoiceType if available, otherwise use invoiceData.invoiceType
      const activeInvoiceTypeForCalculation =
        currentInvoiceType || invoiceData.invoiceType;

      if (activeInvoiceTypeForCalculation === "Proforma") {
        // For Proforma Invoice: always show full contract items, deposit amount handled in footer
        finalItems = [...contractItems];
        finalTotal = contractTotal; // Keep full amount for items, deposit handled in footer calculations
      } else if (activeInvoiceTypeForCalculation === "Commercial") {
        // For Commercial Invoice: show contract items minus any proforma advance payments
        const advancePayments = allProformaInvoices.filter(
          (inv) =>
            inv.invoiceType === "Proforma" &&
            (inv.status === "generated" || inv.status === "draft"),
        );

        if (advancePayments.length > 0) {
          // Add negative lines for proforma invoices using actual amounts paid
          const negativeItems = advancePayments.map((inv, idx) => {
            // For proforma invoices with deposit, use the deposit amount (advanceDepositAmount)
            // Otherwise use the full grand total
            const actualAdvanceAmount =
              inv.advanceDepositAmount || inv.grandTotal || 0;

            console.log("Processing advance payment:", {
              invoice_number: inv.invoice_number,
              grandTotal: inv.grandTotal,
              advanceDepositAmount: inv.advanceDepositAmount,
              actualAdvanceAmount,
            });

            return {
              id: contractItems.length + idx + 1,
              quantity: 1,
              description: `Advance Payment - ${inv.invoice_number}`,
              unitPrice: -Math.abs(actualAdvanceAmount), // Make it negative
              discount: 0,
              total: -Math.abs(actualAdvanceAmount), // Make it negative
              isAdvancePayment: true, // Flag to identify advance payment rows
            };
          });

          finalItems = [...contractItems, ...negativeItems];

          // Calculate remaining amount using actual proforma invoice amounts
          // Use deposit amount for proforma invoices with deposits, otherwise use grand total
          const totalAdvancePayments = advancePayments.reduce((sum, inv) => {
            const advanceAmount =
              inv.advanceDepositAmount || inv.grandTotal || 0;
            return sum + advanceAmount;
          }, 0);

          finalTotal = contractTotal - totalAdvancePayments;

          console.log("Total advance payments calculation:", {
            contractTotal,
            totalAdvancePayments,
            finalTotal,
          });

          console.log("Advance payments found:", advancePayments);
          console.log("Negative items created:", negativeItems);
          console.log("Final items array:", finalItems);
        }
      }

      // Batch state updates to prevent flickering
      const newContractDetails = {
        totalAmount: contractTotal,
        depositPercentage,
        depositAmount,
        advancePayments: allProformaInvoices,
        remainingAmount: finalTotal,
      };

      setContractDetails(newContractDetails);

      // Calculate all values before setting state to prevent rendering with intermediate values
      const activeInvoiceTypeForUpdate =
        currentInvoiceType || invoiceData.invoiceType;
      let baseSubtotal;
      if (
        activeInvoiceTypeForUpdate === "Proforma" &&
        depositPercentage > 0 &&
        depositPercentage < 100
      ) {
        baseSubtotal = depositAmount; // Use deposit amount for proforma with percentage
      } else if (activeInvoiceTypeForUpdate === "Commercial") {
        // For commercial invoices, calculate subtotal from items (which includes negative advance payments)
        const itemsSubtotal = finalItems.reduce(
          (sum, item) => sum + (item.total || 0),
          0,
        );
        console.log("Commercial Invoice Calculation:", {
          finalItems,
          itemsSubtotal,
          contractTotal,
          finalTotal,
          contractItemsTotal: contractItems.reduce(
            (sum, item) => sum + (item.total || 0),
            0,
          ),
        });
        // Ensure subtotal doesn't go below 0
        baseSubtotal = Math.max(0, itemsSubtotal);
      } else {
        baseSubtotal = Math.abs(finalTotal); // Use finalTotal for other cases
      }

      // Use current invoice data values, but get them from a fresh read to avoid stale closure values
      // We'll use a functional update to get the latest values
      const currentInvoiceData = invoiceData; // Capture current state
      const currentDiscountPercentage =
        currentInvoiceData.discountPercentage || 0;
      const currentShippingCharges = currentInvoiceData.shippingCharges || 0;
      const currentAdjustment = currentInvoiceData.adjustment || 0;

      const discountAmount = (baseSubtotal * currentDiscountPercentage) / 100;
      const calculatedTotal =
        baseSubtotal -
        discountAmount +
        currentShippingCharges +
        currentAdjustment;

      // Calculate advance deposit amount and commercial invoice logic
      let advanceDepositAmount = 0;
      let commercialInvoiceTotal = calculatedTotal;

      if (activeInvoiceTypeForUpdate === "Proforma" && depositPercentage > 0) {
        // For proforma invoices with deposit, the advance deposit amount is the deposit amount
        advanceDepositAmount = depositAmount;
      } else if (activeInvoiceTypeForUpdate === "Commercial") {
        // For commercial invoices, use the calculated total (which already accounts for advance payments)
        commercialInvoiceTotal = Math.max(0, calculatedTotal);
        console.log("Commercial Invoice Total:", {
          baseSubtotal,
          discountAmount,
          calculatedTotal,
          commercialInvoiceTotal,
        });
      }

      const finalInvoiceTotal = Math.max(
        0,
        activeInvoiceTypeForUpdate === "Commercial"
          ? commercialInvoiceTotal
          : calculatedTotal,
      );

      // Set all state at once to prevent intermediate renders
      // Use functional update to preserve other fields and ensure we have latest state
      setInvoiceData((prev) => {
        // Use the latest discount, shipping, and adjustment from prev state
        const latestDiscountPercentage = prev.discountPercentage || 0;
        const latestShippingCharges = prev.shippingCharges || 0;
        const latestAdjustment = prev.adjustment || 0;

        // Recalculate with latest values to ensure accuracy
        const recalculatedDiscountAmount =
          (baseSubtotal * latestDiscountPercentage) / 100;
        const recalculatedTotal =
          baseSubtotal -
          recalculatedDiscountAmount +
          latestShippingCharges +
          latestAdjustment;

        let recalculatedCommercialTotal = recalculatedTotal;
        if (activeInvoiceTypeForUpdate === "Commercial") {
          recalculatedCommercialTotal = Math.max(0, recalculatedTotal);
        }

        const finalRecalculatedTotal = Math.max(
          0,
          activeInvoiceTypeForUpdate === "Commercial"
            ? recalculatedCommercialTotal
            : recalculatedTotal,
        );

        return {
          ...prev,
          items: finalItems,
          subtotal: baseSubtotal,
          taxTotal: sumLineTaxAmountsFromItems(finalItems),
          discountAmount: recalculatedDiscountAmount,
          total: finalRecalculatedTotal,
          deposit: depositPercentage,
          depositAmount,
          contractTotal,
          advanceDepositAmount,
          salesContractTotal: contractTotal, // Always store original contract total
          remainingAmount: finalTotal,
        };
      });

      console.log("Invoice data after setting items - calculation complete");
    } catch (error) {
      console.error("Error fetching contract details:", error);
      notifyError(ciText("Failed to load contract details"));
    } finally {
      // Always reset the flags, even if there was an error
      isFetchingContractDetailsRef.current = false;
      setIsCalculatingDetails(false);
    }
  };

  const handleChangeContract = async (contractId) => {
    try {
      const response = await axios.get(
        `${Base_URL}/sales-contracts/${contractId}`,
      );
      const contract = response?.data;
      const accountTypeRes = await axios.get(
        `${Base_URL}/bank-account-types/${contract.Account_Info.accountType}`,
      );
      setAccountTypeName(accountTypeRes.data?.name || "");
      setSelectedContract(contract);

      // Mark as initialized to prevent loops
      hasInitializedRef.current = true;

      const statusResult = await checkContractInvoiceStatus(contractId);
      const correctInvoiceType =
        statusResult?.invoiceType ||
        (statusResult?.proformaExists
          ? "Commercial"
          : statusResult?.defaultType || "Proforma");

      await fetchContractDetails(contractId, correctInvoiceType);

      setInvoiceData((prev) => ({
        ...prev,
        salesContractNumber: contract?.contractNo,
        bankAccount: contract?.Account_Info?.bankAccount || "",
      }));
    } catch (error) {
      console.error("Error fetching contract data:", error);
      notifyError(ciText("Failed to load contract details"));
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    // When business changes, clear customer section and reset currency (currency will be set from new business in useEffect)
    if (name === "business" && value !== invoiceData.business) {
      setSelectedCustomer(null);
      setSelectedContract(null);
      setInvoiceData((prev) => ({
        ...prev,
        business: value,
        customer: "",
        billingAddress: "",
        shippingAddress: "",
        phoneNumber: "",
        termsAndConditions: "", // Clear terms when business changes, will be loaded from new business
        faxNumber: "",
        currency: "", // Clear; currency will show only when customer is selected
      }));
      return;
    }

    if (name === "discountPercentage" || name === "discountValue") {
      // Allow empty string for input field
      if (value === "") {
        setInvoiceData({
          ...invoiceData,
          [name]: "",
          discountAmount: 0,
          discountPercentage:
            name === "discountPercentage" ? "" : invoiceData.discountPercentage,
          discountValue:
            name === "discountValue" ? "" : invoiceData.discountValue,
          total: invoiceData.subtotal,
        });
        return;
      }

      const valueNum = parseFloat(value) || 0;
      let discountAmount = 0;

      if (name === "discountPercentage") {
        // Clamp between 0 and 100
        const clampedValue = Math.max(0, Math.min(valueNum, 100));
        discountAmount = (invoiceData.subtotal * clampedValue) / 100;
        setInvoiceData({
          ...invoiceData,
          discountPercentage: clampedValue,
          discountValue: clampedValue,
          discountAmount,
          total: Math.max(invoiceData.subtotal - discountAmount, 0),
        });
      } else if (name === "discountValue") {
        if (invoiceData.discountType === "percentage") {
          const clampedValue = Math.max(0, Math.min(valueNum, 100));
          discountAmount = (invoiceData.subtotal * clampedValue) / 100;
          setInvoiceData({
            ...invoiceData,
            discountPercentage: clampedValue,
            discountValue: clampedValue,
            discountAmount,
            total: Math.max(invoiceData.subtotal - discountAmount, 0),
          });
        } else {
          // Amount-based discount
          discountAmount = Math.max(
            0,
            Math.min(valueNum, invoiceData.subtotal),
          );
          setInvoiceData({
            ...invoiceData,
            discountAmount,
            discountValue: discountAmount,
            total: Math.max(invoiceData.subtotal - discountAmount, 0),
          });
        }
      }
      return;
    }

    if (name === "discountType") {
      setInvoiceData({
        ...invoiceData,
        discountType: value,
        discountValue: 0,
        discountPercentage: 0,
        discountAmount: 0,
        total: invoiceData.subtotal,
      });
      return;
    } else if (name === "invoiceType") {
      // When invoice type changes manually by user, update it and trigger recalculation
      isUpdatingInvoiceTypeRef.current = false; // Allow the useEffect to run
      lastInvoiceTypeRef.current = invoiceData.invoiceType; // Track the previous value
      setInvoiceData({
        ...invoiceData,
        [name]: value,
      });
      // fetchContractDetails will be triggered by the useEffect that watches invoiceData.invoiceType
      return;
    } else {
      setInvoiceData({
        ...invoiceData,
        [name]: value,
      });
    }
  };

  const fetchTemplates = async () => {
    // Don't fetch if business is not set
    if (!invoiceData?.business) {
      console.log("fetchTemplates: Skipping - no business selected");
      return;
    }

    try {
      const businessTemplates = await axios.get(
        `${Base_URL}/business-templates/${invoiceData?.business}`,
      );
      console.log("businessTemplates", businessTemplates.data.data);

      console.log("invoicee data type", invoiceData.invoiceType);

      const desiredType =
        invoiceData?.invoiceType === "Commercial"
          ? "Commercial Invoice"
          : "Proforma Invoice";

      const assignments = businessTemplates?.data?.data || [];

      // NOTE: /business-templates returns assignment objects:
      // { businessId, templateId (populated), type, isActive, isDefault }
      // Some setups store invoice type on assignment.type; others store it on templateId.type.
      // We accept either to avoid empty lists.
      const invoiceTemplates = assignments.filter((a) => {
        if (!a || a.isActive !== true) return false;
        const assignmentType = a.type;
        const templateType = a.templateId?.type;

        if (assignmentType === desiredType) return true;
        if (templateType === desiredType) return true;

        // Fallback: if template type is generic "invoice", allow it for invoice flows
        if (
          typeof templateType === "string" &&
          templateType.toLowerCase() === "invoice" &&
          desiredType.toLowerCase().includes("invoice")
        ) {
          return true;
        }

        return false;
      });

      console.log("invoiceTemplates after filtering:", invoiceTemplates);
      console.log("invoiceTemplates length:", invoiceTemplates?.length);

      // Map to full template objects (templateId should have type property)
      // Ensure we're passing the full template objects, not just IDs
      const templateObjects = invoiceTemplates
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

      const uniqueTemplates = [];
      const seenTemplateIds = new Set();
      templateObjects.forEach((template) => {
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

      console.log("Template objects after mapping:", uniqueTemplates);
      console.log("Template objects length:", uniqueTemplates.length);
      console.log("Setting templates:", uniqueTemplates);
      setTemplates(uniqueTemplates);

      // Set the first template as default
      if (uniqueTemplates.length > 0 && uniqueTemplates[0]) {
        const firstTemplate = uniqueTemplates[0];
        const templateId = firstTemplate?._id || firstTemplate?.id;

        setSelectedTemplate(firstTemplate);
        setSelectedTemplateId(templateId); // Set selectedTemplateId when template is loaded
        setTempSelectedTemplate(templateId);

        // Update invoice data with template name
        setInvoiceData((prev) => ({
          ...prev,
          template: firstTemplate?.name || "Selected Template",
        }));
      }

      // Generate previews for templates
      const previews = {};
      for (const template of uniqueTemplates) {
        const tid = template?._id || template?.id;
        if (tid) previews[tid] = template.previewImage || "#";
      }
      setTemplatePreviews(previews);
    } catch (error) {
      console.error("Error fetching templates:", error);
      // Set empty array on error to prevent stale data
      setTemplates([]);
    }
  };

  // Add this to your existing useEffect or create a new one
  useEffect(() => {
    fetchTemplates();
  }, [Base_URL, invoiceData?.business, invoiceData?.invoiceType]);

  useEffect(() => {
    const fetchProfileSignature = async () => {
      if (!adminInfo?.id) return;
      try {
        const response = await axios.get(
          `${Base_URL}/admin/profile/${adminInfo.id}`,
          {
            headers: adminInfo?.token
              ? { authorization: `Bearer ${adminInfo.token}` }
              : undefined,
          },
        );
        setProfileSignature(
          normalizeSignatureUrl(response?.data?.signature || ""),
        );
      } catch (error) {
        // Signature is optional for previews.
      }
    };
    fetchProfileSignature();
  }, [Base_URL, adminInfo?.id, adminInfo?.token, normalizeSignatureUrl]);

  useEffect(() => {
    console.log("invoiceData?.business", invoiceData?.business);
    const fetchCustomers = async () => {
      console.log("invoiceData?.business", invoiceData?.business);
      try {
        const response = await axios.get(`${Base_URL}/customers`, {
          params: { businessId: invoiceData?.business },
        });
        console.log("response?.data?.customers", response?.data?.customers);
        setCustomers(response?.data?.customers || []);
      } catch (error) {
        console.error("Error fetching customers:", error);
      }
    };

    fetchCustomers();
  }, [invoiceData.business]);

  // When no customer selected, clear currency so we don't show business currency (e.g. MYR). Currency only shows after customer is selected.
  useEffect(() => {
    if (!selectedCustomer) {
      setInvoiceData((prev) => ({ ...prev, currency: "" }));
    }
  }, [selectedCustomer]);

  // Fetch business base currency so we can fall back when customer currency is missing.
  useEffect(() => {
    const fetchBaseCurrency = async () => {
      if (!invoiceData?.business) return;
      try {
        const currencyResponse = await axios.get(
          `${Base_URL}/finance/currencies`,
          { params: { business_id: invoiceData.business } },
        );
        const currencies = currencyResponse?.data?.data || [];
        const base = currencies.find((c) => c.is_base === true);
        const currencySymbol =
          base?.symbol || base?.prefix || base?.name || "MYR";
        setBaseCurrency(currencySymbol);
      } catch (currencyError) {
        console.error("Error fetching base currency:", currencyError);
        setBaseCurrency("MYR");
      }
    };

    fetchBaseCurrency();
  }, [invoiceData?.business, Base_URL]);

  // Load items when business changes
  useEffect(() => {
    if (invoiceData.business) {
      const fetchItems = async () => {
        try {
          // Use businessId parameter (singular) for single business
          // Don't include page/limit to get all items, or use a high limit
          const response = await axios.get(`${Base_URL}/items`, {
            params: {
              businessId: invoiceData.business,
              status: "Active",
              // Optionally fetch all items by not using pagination, or use a high limit
              // limit: 1000, // Uncomment if you want to limit results
            },
          });
          console.log("Items API response:", response?.data);
          console.log("Items API response type:", typeof response?.data);
          console.log("Is array?", Array.isArray(response?.data));

          // Handle both paginated and non-paginated responses
          if (response?.data?.items && Array.isArray(response?.data?.items)) {
            // Paginated response: { items: [...], total: 1 }
            console.log(
              "Using paginated response, items count:",
              response.data.items.length,
            );
            setBusinessItems(response.data.items || []);
          } else if (Array.isArray(response?.data)) {
            // Non-paginated response: [...]
            console.log(
              "Using non-paginated response, items count:",
              response.data.length,
            );
            setBusinessItems(response.data || []);
          } else {
            console.warn("Unexpected response format:", response?.data);
            setBusinessItems([]);
          }
        } catch (error) {
          console.error("Error fetching items:", error);
          console.error(
            "Error details:",
            error.response?.data || error.message,
          );
          setBusinessItems([]);
        }
      };
      fetchItems();
    } else {
      setBusinessItems([]);
    }
  }, [invoiceData.business, Base_URL]);

  // Load taxes (Accounts > Taxes) when business changes – for item tax dropdown
  useEffect(() => {
    if (invoiceData.business) {
      axios
        .get(`${Base_URL}/taxes?business=${invoiceData.business}`)
        .then((res) => setTaxes(res.data || []))
        .catch(() => setTaxes([]));
    } else {
      setTaxes([]);
    }
  }, [invoiceData.business, Base_URL]);

  // Check stock availability for items
  const checkItemsStock = async (itemsToCheck) => {
    if (!itemsToCheck || itemsToCheck.length === 0) {
      setStockWarnings({});
      return;
    }

    // Filter items that have itemId and quantity > 0
    const itemsWithStock = itemsToCheck
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.itemId && parseFloat(item.quantity) > 0);

    if (itemsWithStock.length === 0) {
      setStockWarnings({});
      return;
    }

    try {
      const payload = {
        items: itemsWithStock.map(({ item }) => ({
          itemId: item.itemId,
          quantity: parseFloat(item.quantity) || 0,
        })),
      };

      const response = await axios.post(
        `${Base_URL}/items/check-stock`,
        payload,
        { headers },
      );

      // Process stock results - always process data array regardless of success status
      // We want to show warnings even when API returns success: false (because there are errors)
      if (
        response.data &&
        response.data.data &&
        Array.isArray(response.data.data)
      ) {
        const warnings = {};

        response.data.data.forEach((result, idx) => {
          if (itemsWithStock[idx]) {
            const originalIndex = itemsWithStock[idx].index;

            // Show warning for any item that has stock tracking enabled
            if (result.available !== null && result.available !== undefined) {
              if (!result.valid || result.isOverstock) {
                // Overstock or insufficient stock - show RED error
                warnings[originalIndex] = {
                  available: result.available,
                  requested: result.requested,
                  message:
                    result.message ||
                    `Insufficient stock: Available ${result.available}, Requested ${result.requested}`,
                  isOverstock: true,
                  itemName: result.itemName,
                };
              }
            }
          }
        });
        // Merge with existing warnings (preserve warnings for items not in this check)
        setStockWarnings((prev) => {
          const merged = { ...prev };
          // Update warnings for items that were checked
          Object.keys(warnings).forEach((idx) => {
            merged[idx] = warnings[idx];
          });
          // Clear warnings for items that were checked but no longer have issues
          itemsWithStock.forEach(({ index }) => {
            if (!warnings[index]) {
              delete merged[index];
            }
          });
          return merged;
        });
      } else {
        console.warn(
          "⚠️ Unexpected stock check response format:",
          response.data,
        );
        // Don't clear all warnings on unexpected format - might be a temporary API issue
      }
    } catch (error) {
      console.error("Error checking stock:", error);
      // Don't show error to user, just log it
    }
  };

  // Handle item change with stock checking
  const handleItemChangeWithStockCheck = (index, field, value) => {
    if (
      field === "lineItemCustomFields" &&
      value &&
      typeof value === "object" &&
      Object.prototype.hasOwnProperty.call(value, "key")
    ) {
      setInvoiceData((prev) => {
        const prevItems = prev.items || [];
        const updatedItems = [...prevItems];
        const currentRow = updatedItems[index] || {};
        updatedItems[index] = {
          ...currentRow,
          lineItemCustomFields: {
            ...(currentRow.lineItemCustomFields || {}),
            [value.key]: value.value,
          },
        };
        return { ...prev, items: updatedItems };
      });
      return;
    }

    setInvoiceData((prev) => {
      const prevItems = prev.items || [];
      const updatedItems = [...prevItems];
      const currentRow = updatedItems[index] || {};

      let sanitizedValue = value;
      if (
        field === "quantity" ||
        field === "unitPrice" ||
        field === "taxRate"
      ) {
        sanitizedValue = parseFloat(value) || 0;
        if (sanitizedValue < 0) sanitizedValue = 0;
      }
      if (field === "discount") {
        sanitizedValue = clampDiscountPercent(value);
      }

      updatedItems[index] = {
        ...currentRow,
        [field]: sanitizedValue,
      };
      if (field === "itemId" && !sanitizedValue) {
        updatedItems[index].lineItemCustomFields = {};
      }

      // Recalculate line total + line tax together so downstream summaries
      // (sumLineTaxAmountsFromItems, viewer's resolveFlexaLineBillingTotal)
      // can't keep using a stale explicit item.tax from a previous discount/rate.
      if (
        field === "quantity" ||
        field === "unitPrice" ||
        field === "discount" ||
        field === "taxRate" ||
        field === "itemId"
      ) {
        const quantity = parseFloat(updatedItems[index].quantity) || 1;
        const unitPrice = parseFloat(updatedItems[index].unitPrice) || 0;
        const discount = parseFloat(updatedItems[index].discount) || 0;
        const taxRate = parseFloat(updatedItems[index].taxRate) || 0;
        const lineSubtotal = getLineSubtotal(quantity, unitPrice, discount);
        const lineTax = getLineTaxAmount(lineSubtotal, taxRate);
        updatedItems[index].total = Math.max(0, lineSubtotal + lineTax);
        updatedItems[index].tax = lineTax;
        updatedItems[index].taxAmount = lineTax;
      }

      // Subtotal = sum of line totals (qty×price after line discount + line tax)
      const taxTotal = sumLineTaxAmountsFromItems(updatedItems);
      const subtotal = sumLineGrossFromItems(updatedItems);
      const discountAmount = (subtotal * (prev.discountPercentage || 0)) / 100;
      const total = computeInvoiceTotalFromHeader({
        subtotal,
        discountAmount,
        shippingCharges: prev.shippingCharges,
        adjustment: prev.adjustment,
      });

      // Real-time stock check with immediate trigger for itemId changes
      if (field === "quantity" || field === "itemId") {
        // Clear any existing timeout
        if (stockCheckTimeoutRef.current) {
          clearTimeout(stockCheckTimeoutRef.current);
        }

        // If itemId is cleared or quantity is 0, clear warnings immediately
        if (
          (field === "quantity" && (parseFloat(value) === 0 || !value)) ||
          (field === "itemId" && !value)
        ) {
          setStockWarnings((prev) => {
            const updated = { ...prev };
            delete updated[index];
            return updated;
          });
        } else {
          // For itemId changes, check stock immediately if quantity exists
          if (field === "itemId" && value) {
            const quantity = parseFloat(updatedItems[index]?.quantity) || 0;
            if (quantity > 0) {
              // Immediate check for item selection with existing quantity
              // Use the updated items snapshot
              setTimeout(() => {
                setInvoiceData((currentState) => {
                  const currentItems = currentState.items || [];
                  checkItemsStock(currentItems);
                  return currentState; // Don't modify state, just use it for stock check
                });
              }, 100); // Small delay to ensure state is updated
            }
          } else if (field === "quantity") {
            // For quantity changes, ALWAYS check if itemId exists and quantity > 0
            const currentItem = updatedItems[index];
            const quantityValue = parseFloat(value) || 0;

            if (currentItem?.itemId && quantityValue > 0) {
              // For quantity changes with valid itemId, use very short debounce (150ms)
              const itemsSnapshot = updatedItems.map((it) => ({ ...it }));
              stockCheckTimeoutRef.current = setTimeout(() => {
                // Get the latest items from state to ensure we have the most up-to-date data
                setInvoiceData((currentState) => {
                  const currentItems = currentState.items || [];
                  // Check stock with current state items
                  checkItemsStock(currentItems);
                  return currentState; // Don't modify state, just use it for stock check
                });
              }, 150);
            } else {
              // If no itemId or quantity is 0, clear warning for this item
              setStockWarnings((prev) => {
                const updated = { ...prev };
                delete updated[index];
                return updated;
              });
            }
          }
        }
      }

      // Update ref with latest items for stock checking
      latestItemsRef.current = updatedItems;

      return {
        ...prev,
        items: updatedItems,
        subtotal,
        taxTotal,
        discountAmount,
        total,
      };
    });
  };

  // Handle bulk add items (merge by itemId: same product increases quantity, different product adds new row)
  const handleBulkAddItems = (newItems) => {
    if (!newItems || newItems.length === 0) return;

    const existingItems = invoiceData.items || [];
    const merged = [...existingItems];

    for (const newItem of newItems) {
      const itemId = newItem.itemId;
      if (!itemId) {
        merged.push(newItem);
        continue;
      }
      const existingIndex = merged.findIndex(
        (it) => !it.isAdvancePayment && it.itemId === itemId,
      );
      if (existingIndex >= 0) {
        const existing = merged[existingIndex];
        const existingQty = parseFloat(existing.quantity) || 1;
        const addQty = parseFloat(newItem.quantity) || 1;
        const newQty = existingQty + addQty;
        const unitPrice = parseFloat(existing.unitPrice) || 0;
        const discount = parseFloat(existing.discount) || 0;
        const taxRate = parseFloat(existing.taxRate) || 0;
        const lineSubtotal = newQty * unitPrice * (1 - (discount || 0) / 100);
        const taxAmount = (lineSubtotal * taxRate) / 100;
        merged[existingIndex] = {
          ...existing,
          quantity: newQty,
          total: Math.max(0, lineSubtotal + taxAmount),
          tax: taxAmount,
          taxAmount,
        };
      } else {
        merged.push(newItem);
      }
    }

    const taxTotal = sumLineTaxAmountsFromItems(merged);
    const subtotal = sumLineGrossFromItems(merged);
    const discountAmount = (subtotal * invoiceData.discountPercentage) / 100;
    const total = computeInvoiceTotalFromHeader({
      subtotal,
      discountAmount,
      shippingCharges: invoiceData.shippingCharges,
      adjustment: invoiceData.adjustment,
    });

    setInvoiceData((prev) => ({
      ...prev,
      items: merged,
      subtotal,
      taxTotal,
      discountAmount,
      total,
    }));

    setTimeout(() => {
      checkItemsStock(merged);
    }, 300);

    notifySuccess(
      ciText("{{count}} item(s) added successfully", {
        count: newItems.length,
      }),
    );
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);

    if (files.length === 0) return;

    // Validate file count (max 10 files)
    const currentFileCount = invoiceData.supportingDocuments?.length || 0;
    if (currentFileCount + files.length > 10) {
      notifyError(
        ciText(
          "You can upload a maximum of 10 files. Currently have {{count}} file(s).",
          { count: currentFileCount },
        ),
      );
      e.target.value = ""; // Reset input
      return;
    }

    // Validate file sizes (max 10MB each)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    const invalidFiles = files.filter((file) => file.size > maxSize);

    if (invalidFiles.length > 0) {
      notifyError(
        ciText("The following files exceed 10MB limit: {{files}}", {
          files: invalidFiles.map((f) => f.name).join(", "),
        }),
      );
      e.target.value = ""; // Reset input
      return;
    }

    // Start upload process
    setUploading(true);
    setUploadSuccess(false);
    setUploadProgress(0);

    const uploadedDocuments = [];
    let successCount = 0;
    let failCount = 0;

    // Upload files one by one
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      try {
        // Prepare form data for upload
        const formDataForUpload = new FormData();
        formDataForUpload.append(
          "file_path",
          `Invoices/${invoiceData.invoiceNumber || invoiceNumber || "Draft"}`,
        );
        formDataForUpload.append("business_id", invoiceData?.business);
        formDataForUpload.append("customer_id", adminInfo?.id);
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
                ((progressEvent.loaded * 100) / progressEvent.total) *
                  (100 / files.length),
              );
              const baseProgress = (i / files.length) * 100;
              setUploadProgress(baseProgress + percentCompleted / files.length);
            },
          },
        );

        if (response.data.message === "File uploaded successfully") {
          const uploadedFile = response.data.file;

          uploadedDocuments.push({
            fileId: uploadedFile._id,
            name: uploadedFile.name,
            url: uploadedFile.url || "#",
            downloadUrl: uploadedFile.downloadUrl || "#",
            uploadedAt: new Date().toISOString(),
            size: file.size,
            type: file.type,
          });

          successCount++;
        } else {
          failCount++;
          console.error(`Failed to upload ${file.name}`);
        }
      } catch (error) {
        failCount++;
        console.error(`Error uploading ${file.name}:`, error);
        notifyError(
          ciText("Failed to upload {{file}}. Please try again.", {
            file: file.name,
          }),
        );
      }
    }

    // Update invoice data with all uploaded documents
    if (uploadedDocuments.length > 0) {
      setInvoiceData((prev) => ({
        ...prev,
        supportingDocuments: [
          ...(prev.supportingDocuments || []),
          ...uploadedDocuments,
        ],
      }));

      // Show success message
      if (successCount > 0) {
        const message =
          failCount > 0
            ? `${successCount} file(s) uploaded successfully. ${failCount} file(s) failed.`
            : `${successCount} file(s) uploaded successfully!`;
        setSuccessMessage(message);
        setUploadSuccess(true);
        notifySuccess(message);

        // Auto-hide success message after 3 seconds
        setTimeout(() => {
          setUploadSuccess(false);
          setSuccessMessage("");
        }, 3000);
      }
    }

    // Reset input
    e.target.value = "";
    setUploading(false);
    setUploadProgress(0);
  };

  const handleRemoveFile = (fileId) => {
    setInvoiceData((prev) => ({
      ...prev,
      supportingDocuments:
        prev.supportingDocuments?.filter((doc) => doc.fileId !== fileId) || [],
    }));
    notifySuccess(ciText("File removed successfully"));
  };

  const handleOpenFile = async (documentId) => {
    if (!documentId) return;

    try {
      let response = await axios.get(
        `${Base_URL}/documents/getFileWithAllData/${documentId}`,
      );
      window.open(response.data.data.url, "_blank");
    } catch (error) {
      alert(ciText("Error getting file"));
      console.log("Error: ", error);
    }
  };

  // Show PREVIEW of next number — does NOT increment the counter.
  // Server now returns isFallback=true (with a generated number) instead of 404
  // when no sequence is configured, so the field is always populated.
  const generateInvoiceNumber = async (
    businessId,
    businessGroupId,
    linkOptions,
  ) => {
    if (!businessId) return;
    try {
      const response = await getNextDocumentNumber(
        "invoice",
        businessId,
        businessGroupId,
        linkOptions,
      );
      setInvoiceNumber(response.data?.nextNumber);
      setDocNumMissing(response.data?.isFallback === true);
    } catch (err) {
      console.error("Failed to fetch invoice number preview:", err);
    }
  };

  const stripHtml = (html) => {
    if (!html) return "";
    const doc = new DOMParser().parseFromString(html, "text/html");
    return doc.body.textContent || "";
  };

  const validateForm = () => {
    const errors = {};
    if (!invoiceData.business)
      errors.business = ciText("Business is required");
    if (!selectedCustomer)
      errors.customer = ciText("Customer selection is required");
    if (!invoiceData.customer)
      errors.customer = ciText("Customer is required");
    if (!invoiceNumber)
      errors.invoiceNumber =
        ciText(
          "Invoice number is required. Please check document sequencing.",
        );
    if (!invoiceData.invoiceDate)
      errors.invoiceDate = ciText("Invoice date is required");
    if (!invoiceData.items || invoiceData.items.length === 0) {
      errors.items = ciText("At least one item is required");
    }

    // Validate items have required fields
    (invoiceData.items || []).forEach((item, index) => {
      if (!item.itemName && !item.itemId) {
        errors[`items.${index}.itemName`] = ciText(
          "Item name or ID is required",
        );
      }
      if (!item.quantity || item.quantity <= 0) {
        errors[`items.${index}.quantity`] = ciText(
          "Quantity must be greater than 0",
        );
      }
      if (item.unitPrice === undefined || item.unitPrice === null) {
        errors[`items.${index}.rate`] = ciText("Rate is required");
      }
    });

    if (invoiceData.discountPercentage > 100)
      errors.discountPercentage = ciText("Discount cannot exceed 100%.");

    // Proforma/commercial sequencing only applies to sales-contract invoices.
    const shouldEnforceContractInvoiceTypeRules = Boolean(
      selectedContract?._id,
    );
    if (shouldEnforceContractInvoiceTypeRules) {
      if (invoiceData.invoiceType === "Proforma" && !canCreateProforma) {
        errors.invoiceType =
          proformaValidationMessage ||
          ciText("A Proforma Invoice cannot be created for this contract.");
      }

      if (invoiceData.invoiceType === "Commercial" && !canCreateCommercial) {
        errors.invoiceType =
          commercialValidationMessage ||
          ciText("A Commercial Invoice cannot be created for this contract.");
      }
    }

    return errors;
  };

  console.log(
    "selectedContract?.productInfo[0]?.totalValue,",
    selectedContract?.productInfo[0]?.totalValue,
  );

  const handleSubmit = async (status) => {
    const errors = validateForm();
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      // Find the first error message to show in the toast
      const firstErrorKey = Object.keys(errors)[0];
      const firstErrorMessage = errors[firstErrorKey];
      notifyError(
        ciText("Please fix validation errors: {{message}}", {
          message: firstErrorMessage,
        }),
      );
      return;
    }

    if (status === "generated" && !selectedTemplateId) {
      notifyError(
        ciText(
          "Select a PDF template before Save & Send, or configure invoice templates for this business.",
        ),
      );
      return;
    }

    // PDF is optional for ciText("Save & Send"): user can go to email preview with template only.
    // If they check "Attach invoice PDF" on email preview, PDF will be generated at runtime.
    const hasDocument =
      DocumentData?.s3Key || DocumentData?.url || DocumentData?._id;

    // ✅ STOCK VALIDATION: Check for stock warnings before submission
    const hasStockErrors = Object.keys(stockWarnings).some(
      (index) => stockWarnings[index]?.isOverstock === true,
    );

    if (hasStockErrors) {
      // Find items with stock errors
      const stockErrorItems = Object.keys(stockWarnings)
        .filter((index) => stockWarnings[index]?.isOverstock === true)
        .map((index) => {
          const item = invoiceData.items[parseInt(index)];
          const warning = stockWarnings[index];
          return ciText(
            "{{item}}: Available {{available}}, Requested {{requested}}",
            {
              item: item?.description || ciText("Item"),
              available: warning.available,
              requested: warning.requested,
            },
          );
        });

      notifyError(
        ciText(
          "Cannot create invoice: Insufficient stock for one or more items.\n{{items}}",
          { items: stockErrorItems.join("\n") },
        ),
      );
      return;
    }

    // ✅ FINAL STOCK CHECK: Perform a final stock validation before submission
    // This ensures we catch any stock issues that might have been missed
    const itemsWithStock = (invoiceData.items || [])
      .filter((item) => item.itemId && parseFloat(item.quantity) > 0)
      .map((item) => ({
        itemId: item.itemId,
        quantity: parseFloat(item.quantity) || 0,
      }));

    if (itemsWithStock.length > 0 && status !== "draft") {
      // Only check stock for non-draft invoices (pending, generated, etc.)
      try {
        const response = await axios.post(
          `${Base_URL}/items/check-stock`,
          { items: itemsWithStock },
          { headers },
        );

        if (
          response.data &&
          response.data.data &&
          Array.isArray(response.data.data)
        ) {
          const hasErrors = response.data.data.some(
            (result) => !result.valid || result.isOverstock,
          );

          if (hasErrors) {
            const errorMessages = response.data.data
              .filter((result) => !result.valid || result.isOverstock)
              .map(
                (result) =>
                  ciText(
                    "{{item}}: Available {{available}}, Requested {{requested}}",
                    {
                      item: result.itemName || ciText("Item"),
                      available: result.available || 0,
                      requested: result.requested || 0,
                    },
                  ),
              );

            notifyError(
              ciText(
                "Cannot create invoice: Insufficient stock.\n{{items}}",
                { items: errorMessages.join("\n") },
              ),
            );
            setIsLoading(false);
            return;
          }
        }
      } catch (stockError) {
        console.error("Error performing final stock check:", stockError);
        // If stock check fails, still allow submission (backend will validate)
        // But log the error for debugging
      }
    }

    if (invoiceData.business) {
      try {
        const defs = await fetchDefinitions(
          {
            businessId: invoiceData.business,
            module: "sales",
            screen: "invoice",
          },
          headers,
        );
        if (defs.length) {
          const cfErr = validateCustomFieldValues(
            defs,
            invoiceCustomFieldValues,
          );
          if (cfErr) {
            notifyError(cfErr);
            return;
          }
        }
      } catch (e) {
        notifyError(
          e?.response?.data?.message || ciText("Could not validate custom fields."),
        );
        return;
      }
    }

    setIsLoading(true);

    try {
      const computedLineItemsSubtotal = (invoiceData?.items || []).reduce(
        (sum, item) =>
          sum + (Number(item?.total) || Number(item?.totalValue) || 0),
        0,
      );
      const headerSubNum = Number(invoiceData?.subtotal);
      const subTotalPayload =
        Number.isFinite(headerSubNum) && headerSubNum !== 0
          ? headerSubNum
          : computedLineItemsSubtotal;
      const invoiceDataToSend = {
        templateId: selectedTemplateId,
        invoiceType: invoiceData?.invoiceType,
        invoice_number: invoiceNumber,
        customer_id: selectedCustomer?._id,
        customer_name: selectedCustomer?.basicInformation?.customerDisplayName,
        customer_email: selectedCustomer?.basicInformation?.customerEmail,
        contract_id: selectedContract?._id,
        contract_no: selectedContract?.contractNo,
        business_id: invoiceData?.business,
        invoice_date: new Date(invoiceData?.invoiceDate),
        due_date: new Date(invoiceData?.dueDate),
        items: invoiceData?.items?.map((item) => {
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

          const quantity = Number(item.quantity) || 0;
          const unitPrice = Number(item.unitPrice) || 0;
          const discountPct = Number(item.discount) || 0;
          const taxRatePct = Number(item.taxRate) || 0;
          // Always recompute from the source of truth so a stale item.tax
          // (e.g. from before a line discount change) can't poison subtotal
          // / tax on the saved record. Matches PCI-BE/invoice-summary.md.
          const lineSubtotal = getLineSubtotal(
            quantity || 1,
            unitPrice,
            discountPct,
          );
          const taxAmount = getLineTaxAmount(lineSubtotal, taxRatePct);
          const lineTotalValue = Math.max(0, lineSubtotal + taxAmount);

          return {
            title: item.itemName || item.title || item.description || "",
            quantity: item.quantity,
            description: item.description || "",
            unitPrice: item.unitPrice,
            totalValue: lineTotalValue,
            discount: item.discount || 0, // Include item-level discount
            isAdvancePayment: item.isAdvancePayment || false, // Include the flag for backend reference
            expenseAccount: expenseAccountId || undefined, // Use item-level expense account only
            itemId: item.itemId || undefined, // Include item ID reference
            taxId: item.taxId || undefined, // Include tax ID
            taxRate: item.taxRate || 0, // Include tax rate
            tax: taxAmount,
            taxName: item.taxName || undefined, // Include tax name
            unit: item.unit || undefined, // Include unit
            itemType: item.itemType || undefined, // Include item type
            ...(item.lineItemCustomFields &&
            typeof item.lineItemCustomFields === "object" &&
            Object.keys(item.lineItemCustomFields).length > 0
              ? { lineItemCustomFields: item.lineItemCustomFields }
              : {}),
          };
        }),
        subTotal: subTotalPayload,
        discount: Number.parseFloat(invoiceData?.discountPercentage),
        discountAmount: invoiceData?.discountAmount,
        documentUrl: DocumentData?.s3Key || DocumentData?.url,
        documentId: DocumentData?._id,
        shippingCharges: Number.parseFloat(invoiceData?.shippingCharges),
        adjustment: Number.parseFloat(invoiceData?.adjustment),
        grandTotal: invoiceData?.total,
        // Save & Send should keep invoice in "pending" (unpaid) status
        status: status === "draft" ? "draft" : "pending",
        billingAddress: invoiceData?.billingAddress,
        shippingAddress: invoiceData?.shippingAddress || "",
        sameAsBilling,
        phoneNumber: invoiceData?.phoneNumber || "",
        faxNumber: invoiceData?.faxNumber || "",
        orderNumber: invoiceData?.orderNumber || "",
        customerNotes: invoiceData?.customerNotes || "",
        termsAndConditions: invoiceData?.termsAndConditions || "",
        terms:
          invoiceData.terms ||
          stripHtml(selectedContract?.productInfo[0]?.shippingTerms) ||
          "",
        supportingDocuments: invoiceData?.supportingDocuments || [],
        location: location.state?.contractId
          ? "view-sales-contract"
          : location.state?.salesOrderId
            ? "sales-orders"
            : "customer-invoices",
        module: "customer-invoices",
        salesOrderId: location.state?.salesOrderId || undefined, // Link to sales order
        recurring_invoice_profile_id:
          location.state?.recurringInvoicePrefill?.recurringInvoiceProfileId ||
          undefined,
        deposit: invoiceData.deposit,
        depositAmount: invoiceData.depositAmount,
        contractTotal: invoiceData.contractTotal,
        salesContractTotal:
          invoiceData.salesContractTotal ||
          selectedContract?.productInfo[0]?.totalValue,
        remainingAmount: invoiceData.remainingAmount,
        bankAccount: invoiceData.bankAccount,
        currency: invoiceData?.currency || baseCurrency || "MYR",
        advanceDepositAmount: invoiceData.advanceDepositAmount || 0,
        ...(quotationIdForInvoiceRef.current
          ? { quotationId: quotationIdForInvoiceRef.current }
          : {}),
      };

      /**
       * Keep dynamic placeholders (e.g. %(d)(m)(y)%, %(m+1)%/%(y)%) RAW in
       * the persisted invoice so the next Edit screen shows what the user
       * actually typed instead of frozen dates. Render-time consumers
       * (PDF generation in DocumentGenerator / EmailPreview, the recurring
       * preview & cron) resolve the tokens against their own reference date
       * + Configuration date format, matching the recurring profile flow.
       */

      console.log("Items being sent to backend:", invoiceDataToSend.items);
      console.log("Order Number being sent:", invoiceDataToSend.orderNumber);
      console.log("Invoice data being sent:", invoiceDataToSend);

      if (status === "draft") {
        const response = await axios.post(
          `${Base_URL}/proforma-invoice`,
          invoiceDataToSend,
          { headers },
        );
        if (response.data) {
          const invId =
            response.data?._id || response.data?.data?._id || undefined;
          if (invId && invoiceData.business) {
            try {
              await upsertValues(
                {
                  business_id: invoiceData.business,
                  module: "sales",
                  screen: "invoice",
                  record_id: String(invId),
                  values: invoiceCustomFieldValues,
                },
                headers,
              );
            } catch (cfErr) {
              notifyError(
                cfErr?.response?.data?.message ||
                  "Invoice saved but custom fields failed to save.",
              );
              setIsLoading(false);
              return;
            }
          }
          // Invoice is automatically linked to sales order via salesOrderId in backend
          // No need to update Sales Order Status - Invoice Status is tracked separately
          notifySuccess(ciText("Invoice saved successfully!"));
          // Navigate to invoice view or list
          if (invId) {
            history.push(`/customer-invoices/view/${invId}`);
          } else {
            history.push("/customer-invoices");
          }
        }
      } else if (status === "generated") {
        history.push({
          pathname: "/email-preview",
          state: {
            invoiceData: invoiceDataToSend,
            templateData: selectedTemplate,
            businessData,
            selectedCustomer,
            adminInfo,
            invoiceCustomFieldDefinitions: invoiceCustomFieldDefinitions,
            invoiceCustomFieldValues: invoiceCustomFieldValues,
            lineItemCustomFieldDefinitions: lineItemCustomFieldDefs,
          },
        });
      }
    } catch (error) {
      console.error("Error saving invoice:", error);

      // Handle duplicate invoice number error
      if (error.response?.data?.error === "DUPLICATE_INVOICE_NUMBER") {
        notifyError(ciText("Invoice number conflict. Retrying with new number..."));
        // Retry — BE will atomically generate a new number on the next attempt
        setTimeout(() => handleSubmit(status), 500);
        return;
      }

      // Handle insufficient stock error
      if (error.response?.data?.error === "INSUFFICIENT_STOCK") {
        const stockErrors = error.response?.data?.details || [];
        const errorMessages = stockErrors
          .map(
            (err) =>
              err.message ||
              ciText(
                "{{item}}: Available {{available}}, Requested {{requested}}",
                {
                  item: err.itemName,
                  available: err.available,
                  requested: err.requested,
                },
              ),
          )
          .join("\n");

        notifyError(
          ciText("Insufficient stock:\n{{items}}", {
            items: errorMessages,
          }),
        );

        // Set form errors to highlight the issue
        setFormErrors({
          ...formErrors,
          stock: errorMessages,
        });
        return;
      }

        notifyError(
          error.response?.data?.message ||
            ciText("Failed to save invoice. Please try again."),
        );
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangeTemplate = () => {
    setViewMode("template-select");
    setTempSelectedTemplate(selectedTemplate);
  };

  const handleTempTemplateSelect = (templateId) => {
    setTempSelectedTemplate(templateId);
  };

  const handleConfirmTemplateSelection = () => {
    setSelectedTemplate(tempSelectedTemplate);

    // Update invoice template name
    const selectedTemplateName =
      templates.find((t) => t._id === tempSelectedTemplate)?.name ||
      "Selected Template";
    setInvoiceData((prev) => ({
      ...prev,
      template: selectedTemplateName,
    }));

    setViewMode("normal");
  };

  // Template selection modal
  const renderTemplateSelectionModal = () => {
    if (viewMode !== "template-select") return null;

    // Function to sanitize template HTML content before rendering in iframe
    const sanitizeTemplateContent = (htmlContent) => {
      // Replace template variables with placeholder values or empty strings
      return htmlContent
        .replace(/<%= ?contract\.businessLogo ?%>/g, "/api/placeholder/200/100")
        .replace(
          /<%= ?contract\.(signature|authorizedSignature|approver_signature) ?%>/g,
          profileSignature || "",
        )
        .replace(/<%= ?[^%]+ ?%>/g, ""); // Replace other template variables with empty strings
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-4/5 max-w-6xl max-h-[90vh] overflow-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">{ciText("Select Invoice Template")}</h2>
            <button
              onClick={() => setViewMode("normal")}
              className="text-gray-500 hover:text-gray-700"
            >
              <X size={24} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => (
              <div
                key={template._id}
                className={`border rounded-lg cursor-pointer overflow-hidden ${
                  tempSelectedTemplate === template._id
                    ? "border-[var(--p-blue)] ring-2 ring-[var(--p-blue)]"
                    : "border-gray-200"
                }`}
                onClick={() => handleTempTemplateSelect(template._id)}
              >
                <div
                  className="h-64 bg-gray-50 flex items-center justify-center overflow-hidden"
                  onClick={(e) => {
                    e.stopPropagation();
                    openTemplatePreview(template._id);
                  }}
                >
                  <div
                    className="w-full h-full scale-25 origin-top-left"
                    style={{ transform: "scale(0.25)" }}
                  >
                    <iframe
                      srcDoc={sanitizeTemplateContent(template.htmlContent)}
                      title={template.name}
                      className="w-[400%] h-[400%] border-0 pointer-events-none"
                      sandbox="allow-same-origin"
                    />
                  </div>
                </div>
                <div className="p-4">
                  <span className="font-medium">{template.name}</span>
                  <p className="text-xs text-gray-500 mt-1">{template.type}</p>
                  <div className="flex mt-2">
                    <button
                      className="text-xs text-blue-600 hover:underline mr-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        openTemplatePreview(template._id);
                      }}
                    >
                      {ciText("View Preview")}
                    </button>
                    <button
                      className="text-xs text-[var(--p-blue)] hover:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTempTemplateSelect(template._id);
                      }}
                    >
                      {ciText("Select")}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end mt-6 gap-4">
            <button
              onClick={() => setViewMode("normal")}
              className="px-4 py-2 border border-gray-300 rounded-md"
            >
              {ciText("Cancel")}
            </button>
            <button
              onClick={handleConfirmTemplateSelection}
              className="px-4 py-2 bg-[var(--p-blue)] text-white rounded-md"
              disabled={!tempSelectedTemplate}
            >
              {ciText("Select Template")}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderTemplatePreviewModal = () => {
    if (!previewTemplate) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60]">
        <div className="bg-white rounded-lg p-4 w-11/12 max-w-5xl max-h-[90vh] flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">{previewTemplate.name}</h2>
            <button
              onClick={closeTemplatePreview}
              className="text-gray-500 hover:text-gray-700"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-auto bg-gray-100">
            {previewRenderedHtml ? (
              <iframe
                srcDoc={previewRenderedHtml}
                title={`${previewTemplate.name} Preview`}
                className="w-full h-full border-0 min-h-[70vh]"
                sandbox="allow-same-origin"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="border-t-4 border-blue-500 border-solid rounded-full animate-spin w-8 h-8 mx-auto mb-2"></div>
                  <p className="text-gray-600">{ciText("Loading preview...")}</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end mt-4 gap-3">
            <button
              onClick={closeTemplatePreview}
              className="px-4 py-2 border border-gray-300 rounded-md"
            >
              {ciText("Close")}
            </button>
            <button
              onClick={() => {
                // When user confirms from preview, proceed to generate document
                handleTempTemplateSelect(previewTemplate._id);
                setSelectedTemplateId(previewTemplate._id);
                setSelectedTemplate(previewTemplate);
                closeTemplatePreview();
                // Now open the document generator
                setIsGeneratorOpen(true);
              }}
              className="px-4 py-2 bg-[var(--p-blue)] text-white rounded-md"
            >
              {ciText("Use This Template")}
            </button>
          </div>
        </div>
      </div>
    );
  };

  //new code

  console.log("selectedTemplateId", selectedTemplateId);
  const handleGenerateDocument = async ({ templateId, template }) => {
    console.log("handleGenerateDocument called with:", {
      templateId,
      template,
    });

    // If template object is provided, use it; otherwise find it from templates array
    let templateToUse = template || templates.find((t) => t._id === templateId);

    if (!templateToUse) {
      console.error("Template not found:", templateId);
      notifyError(ciText("Template not found. Please select a template."));
      return;
    }

    // If template doesn't have htmlContent, fetch the full template (needed for email-preview PDF generation)
    if (!templateToUse.htmlContent && templateId) {
      console.log("Template missing htmlContent, fetching full template...");
      try {
        const templateResponse = await axios.get(
          `${Base_URL}/document-templates/${templateId}`,
          { headers },
        );
        if (templateResponse.data?.data?.htmlContent) {
          templateToUse = {
            ...templateToUse,
            ...templateResponse.data.data,
          };
        }
      } catch (error) {
        console.error("Error fetching full template:", error);
        notifyError(ciText("Failed to load template details"));
        return;
      }
    }

    // Just select template: set state and close modal. Do NOT open document generator.
    // PDF is generated at runtime on the email preview screen when "Attach invoice PDF" is checked.
    setSelectedTemplate(templateToUse);
    setSelectedTemplateId(templateId);
    setInvoiceData((prev) => ({
      ...prev,
      template: templateToUse?.name || prev.template,
    }));
    setIsModalOpen(false);
  };

  // Build a digest of invoice data that affects the PDF (items, totals, etc.)
  const getDocumentSnapshot = useCallback(() => {
    const items = invoiceData?.items || [];
    const itemsDigest =
      items.length +
      "-" +
      items.reduce(
        (acc, it) =>
          acc + (it.quantity || 0) + (it.unitPrice || 0) + (it.total || 0),
        0,
      );
    return [
      itemsDigest,
      invoiceData?.subtotal ?? 0,
      invoiceData?.total ?? 0,
      invoiceData?.discountAmount ?? 0,
      invoiceData?.shippingCharges ?? 0,
      invoiceData?.adjustment ?? 0,
      invoiceData?.termsAndConditions ?? "",
    ].join("|");
  }, [
    invoiceData?.items,
    invoiceData?.subtotal,
    invoiceData?.total,
    invoiceData?.discountAmount,
    invoiceData?.shippingCharges,
    invoiceData?.adjustment,
    invoiceData?.termsAndConditions,
  ]);

  const handleGenerationSuccess = (data) => {
    console.log("Document generated and saved successfully!", data);
    setIsGeneratorOpen(false);
    documentSnapshotRef.current = getDocumentSnapshot();
    const pdfData = data.file || data;
    setDocumentData(pdfData);
    notifySuccess(
      "PDF template selected successfully! You can now save or send the invoice.",
    );
  };

  // When invoice data (items, totals, etc.) changes after a PDF was generated, clear the document so user must regenerate (no notification)
  useEffect(() => {
    if (!DocumentData?.s3Key || documentSnapshotRef.current === null) return;
    const currentSnapshot = getDocumentSnapshot();
    if (currentSnapshot !== documentSnapshotRef.current) {
      setDocumentData({});
      documentSnapshotRef.current = null;
    }
  }, [getDocumentSnapshot, DocumentData?.s3Key]);

  // Render template with dummy invoice data for preview
  const renderTemplatePreview = useCallback(
    (templateContent) => {
      if (!templateContent) {
        return `<!DOCTYPE html><html><head><title>${ciText("Invoice Preview")}</title></head><body><p>${ciText("No template content")}</p></body></html>`;
      }

      // Create dummy invoice data for preview
      const dummyData = {
        contract: {
          businessLogo:
            businessData?.image ||
            businessData?.logo ||
            businessData?.companyLogo ||
            "",
          businessName: businessData?.name || "Company Name",
          businessCountry: businessData?.country || "",
          businessEmail: businessData?.email || "",
          contract_no: invoiceNumber || "INV-000001",
          invoice_number: invoiceNumber || "INV-000001",
          currency: invoiceData?.currency || baseCurrency || "MYR",
          totalValue: invoiceData?.total || invoiceData?.subtotal || 1000,
          grandTotal: invoiceData?.total || invoiceData?.subtotal || 1000,
          customerName:
            selectedCustomer?.basicInformation?.customerDisplayName ||
            "Customer Name",
          buyerInfo:
            selectedCustomer?.basicInformation?.customerDisplayName ||
            "Customer Name",
          customerAddress: invoiceData?.billingAddress || "Customer Address",
          buyerAddress: invoiceData?.billingAddress || "Customer Address",
          date_of_issue: invoiceData?.invoiceDate
            ? formatDate(invoiceData.invoiceDate)
            : formatDate(new Date()),
          invoice_date: invoiceData?.invoiceDate
            ? formatDate(invoiceData.invoiceDate)
            : formatDate(new Date()),
          terms: invoiceData?.terms || "",
          payment: invoiceData?.terms || "",
          dueDate: invoiceData?.dueDate ? formatDate(invoiceData.dueDate) : "",
          signature: profileSignature || "",
          authorizedSignature: profileSignature || "",
          approver_signature: profileSignature || "",
          items:
            invoiceData?.items?.length > 0
              ? (() => {
                  const mapped = invoiceData.items.map((item, idx) => {
                    const quantity = Number(item.quantity || 0);
                    const unitPrice = Number(item.unitPrice || item.rate || 0);
                    const discountPercent = Number(item.discount ?? 0);
                    const lineSubtotal =
                      quantity * unitPrice * (1 - discountPercent / 100);
                    const taxRate = Number(item.taxRate || 0);
                    const taxAmount =
                      Number(item.taxAmount ?? item.tax ?? 0) ||
                      (taxRate ? (lineSubtotal * taxRate) / 100 : 0);
                    const total =
                      Number(item.total ?? item.totalValue ?? 0) ||
                      Math.max(0, lineSubtotal + taxAmount);
                    return {
                      name: item.description || "Item",
                      description: item.description || "",
                      quantity,
                      unit: "",
                      unitPrice,
                      rate: unitPrice,
                      discount: discountPercent,
                      tax: taxAmount,
                      taxAmount,
                      taxRate,
                      total,
                    };
                  });
                  return mapped;
                })()
              : [
                  {
                    name: "Sample Item",
                    description: "Sample description",
                    quantity: 1,
                    unitPrice: 100,
                    discount: 0,
                    tax: 0,
                    total: 100,
                  },
                ],
          customerNotes: invoiceData?.customerNotes ?? "",
          termsAndConditions: invoiceData?.termsAndConditions ?? "",
          subtotal: invoiceData?.subtotal || 1000,
          discountAmount: invoiceData?.discountAmount || 0,
          tax:
            invoiceData?.taxTotal ??
            invoiceData?.tax ??
            (invoiceData?.items?.length
              ? invoiceData.items.reduce((sum, item) => {
                  const q = Number(item.quantity || 0);
                  const p = Number(item.unitPrice || item.rate || 0);
                  const d = Number(item.discount ?? 0);
                  const sub = q * p * (1 - d / 100);
                  const rate = Number(item.taxRate || 0);
                  const amt =
                    Number(item.taxAmount ?? item.tax ?? 0) ||
                    (rate ? (sub * rate) / 100 : 0);
                  return sum + amt;
                }, 0)
              : 0),
          shippingCharges: invoiceData?.shippingCharges || 0,
          adjustment: invoiceData?.adjustment || 0,
          total:
            invoiceData?.total ??
            invoiceData?.grandTotal ??
            (invoiceData?.subtotal || 1000),
        },
      };

      // Calculate total in words
      const totalAmount = dummyData.contract.totalValue || 0;
      if (totalAmount > 0) {
        const integerPart = Math.floor(totalAmount);
        const decimalPart = Math.round((totalAmount - integerPart) * 100);
        let totalInWords = numberToWords
          .toWords(integerPart, { and: true })
          .toUpperCase();
        if (decimalPart > 0) {
          totalInWords +=
            " AND " +
            numberToWords.toWords(decimalPart, { and: true }).toUpperCase() +
            " CENTS";
        }
        totalInWords += " ONLY";
        dummyData.contract.total_in_words = totalInWords;
      } else {
        dummyData.contract.total_in_words = "ZERO ONLY";
      }

      try {
        const rendered = ejs.render(templateContent, dummyData, {
          strict: false,
        });
        return rendered;
      } catch (error) {
        console.error("EJS rendering error in preview:", error);
        return `<!DOCTYPE html><html><head><title>${ciText("Preview Error")}</title></head><body><p>${ciText("Error rendering template preview. Please try again.")}</p></body></html>`;
      }
    },
    [
      businessData,
      invoiceData,
      selectedCustomer,
      invoiceNumber,
      profileSignature,
    ],
  );

  const openTemplatePreview = async (template) => {
    // Handle both template object and templateId
    let templateToPreview = null;

    if (typeof template === "string") {
      templateToPreview = templates.find((t) => t._id === template);
    } else if (template && template._id) {
      templateToPreview = template;
    }

    if (templateToPreview) {
      // Close the template selection modal when opening preview
      setIsModalOpen(false);
      setPreviewTemplate(templateToPreview);

      // If template doesn't have htmlContent, fetch it
      if (!templateToPreview.htmlContent && templateToPreview._id) {
        try {
          const response = await axios.get(
            `${Base_URL}/document-templates/${templateToPreview._id}`,
            { headers },
          );
          if (response.data?.data?.htmlContent) {
            templateToPreview = {
              ...templateToPreview,
              htmlContent: response.data.data.htmlContent,
            };
            setPreviewTemplate(templateToPreview);
          }
        } catch (error) {
          console.error("Failed to fetch template for preview:", error);
          notifyError(ciText("Failed to load template content"));
          return;
        }
      }

      // Render the template with dummy data
      if (templateToPreview.htmlContent) {
        const renderedHtml = renderTemplatePreview(
          templateToPreview.htmlContent,
        );
        setPreviewRenderedHtml(renderedHtml);
      }
    }
  };

  const closeTemplatePreview = () => {
    setPreviewTemplate(null);
    setPreviewRenderedHtml("");
  };

  const calculateDepositAmount = (contract) => {
    if (!contract?.productInfo?.[0]) return 0;
    const depositPercentage = contract.productInfo[0].deposit || 0;
    const totalAmount = contract.productInfo[0].amountInSelectedCurrency || 0;
    return (totalAmount * depositPercentage) / 100;
  };

  const canSave =
    invoiceData.business && selectedCustomer && invoiceData.items?.length > 0;
  const shouldEnforceContractInvoiceTypeRules = Boolean(selectedContract?._id);
  const hasDocument =
    DocumentData?.s3Key || DocumentData?.url || DocumentData?._id;

  return (
    <div className="min-h-screen bg-gray-50 ">
      {/* Main Content - Two Column Layout */}
      <div className=" mx-auto  py-4 px-4       ">
        <div className="grid grid-cols-1 gap-6">
          {/* Left Column - Main Form */}
          <div className="space-y-6 px-4">
            <PageHeader
              title={ciText("New Invoice")}
              showBackButton
              backFallbackPath="/customer-invoices"
            />
            {/* Business & Invoice Info Card */}
            <div className="bg-white rounded-lg  shadow-sm ">
              <div className="p-6 bg-green-50 space-y-6 rounded-b-lg">
                {/* Business and Customer Selection - Side by Side */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Business Selection */}
                  <SingleBusinessField
                    selectedValue={invoiceData.business}
                    onAutoSelect={(id) =>
                      handleInputChange({
                        target: { name: "business", value: id },
                      })
                    }
                  >
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {ciText("Business")} <span className="text-red-500">*</span>
                    </label>
                    <div className="bg-white rounded-lg">
                      <DropdownBasic
                        options={
                          businesses?.map((business) => ({
                            value: business._id,
                            label: business.name,
                          })) || []
                        }
                        value={invoiceData.business}
                        onChange={(value) =>
                          handleInputChange({
                            target: { name: "business", value },
                          })
                        }
                        placeholder={ciText("Select Business")}
                        isDisabled={!!location.state?.contractId}
                        isClearable={false}
                      />
                    </div>
                    {formErrors.business && (
                      <p className="mt-1 text-xs text-red-500">
                        {formErrors.business}
                      </p>
                    )}
                  </div>
                  </SingleBusinessField>

                  {/* Customer Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {ciText("Customer Name")} <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      <div className="flex-1 bg-white rounded-lg">
                        <SearchableDropdown
                          name="customerName"
                          value={invoiceData.customer}
                          onChange={(e) => handleChangeCustomer(e.target.value)}
                          placeholder={
                            selectedCustomer
                              ? selectedCustomer?.basicInformation
                                  .customerDisplayName
                              : ciText("Select Customer")
                          }
                          searchPlaceholder={ciText("Search customers...")}
                          disabled={location.state?.contractId}
                          options={
                            customers?.map((customer) => ({
                              value: customer._id,
                              label: customer.basicInformation?.companyName,
                              name: customer.basicInformation?.companyName,
                              displayName:
                                customer.basicInformation?.customerDisplayName,
                              email: customer.basicInformation?.customerEmail,
                            })) || []
                          }
                          searchKeys={["name", "displayName", "email"]}
                          renderOption={(option) => (
                            <div>
                              <div className="font-medium text-sm">
                                {option.name}
                              </div>
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
                        disabled={
                          !invoiceData.business || !!location.state?.contractId
                        }
                        title={
                          !invoiceData.business
                            ? ciText("Select a business first")
                            : ciText("Quick add a new customer")
                        }
                        className="flex items-center justify-center gap-1.5 shrink-0 px-3 py-2.5 text-sm font-medium text-[var(--p-blue)] bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-[var(--p-blue)] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[var(--p-blue)] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-white"
                      >
                        <UserPlus className="w-4 h-4" />
                        {ciText("Add")}
                      </button>
                    </div>
                    {formErrors.customer && (
                      <p className="mt-1 text-xs text-red-500">
                        {formErrors.customer}
                      </p>
                    )}
                  </div>
                </div>

                {/* Dynamic Address Types section */}
                {selectedCustomer?._id && (
                  <>
                    {!addressTypeConfig?.hasConfiguredTypes && (
                      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 text-center">
                        <h3 className="text-sm font-medium text-gray-700 mb-3">
                          {ciText("Address Types Not Configured")}
                        </h3>
                        <p className="text-xs text-gray-500 mb-4">
                          {ciText(
                            "You do not have any address type yet. Please add address types in Settings first.",
                          )}
                        </p>
                      </div>
                    )}
                    {addressTypeConfig?.hasConfiguredTypes &&
                      (() => {
                        const billShipConfigured =
                          getConfiguredBillShipTypes(addressTypeConfig);
                        if (!billShipConfigured.length) {
                          return (
                            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 text-center">
                              <p className="text-xs text-gray-500">
                                {ciText(
                                  "No billing or shipping address types are configured in Settings.",
                                )}
                              </p>
                            </div>
                          );
                        }
                        const missingBillShip =
                          getMissingBillShipTypesForCustomer(
                            selectedCustomer?.addresses,
                            addressTypeConfig,
                          ).filter(
                            (t) =>
                              !(sameAsBilling && t.systemType === "SHIPPING"),
                          );
                        if (!missingBillShip.length) return null;
                        return (
                          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 text-center">
                            <h3 className="text-sm font-medium text-gray-700 mb-3">
                              {missingBillShipSectionTitle(missingBillShip)}
                            </h3>
                            <p className="text-xs text-gray-500 mb-4">
                              {buildMissingCustomerAddressMessage(
                                missingBillShip,
                              )}
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
                                  {ciText("Add {{type}} Address", {
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
                      billingAddress={invoiceData.billingAddress}
                      shippingAddress={invoiceData.shippingAddress}
                      sameAsBilling={sameAsBilling}
                      onBillingChange={(nextBilling) => {
                        setInvoiceData((prev) => ({
                          ...prev,
                          billingAddress: nextBilling,
                          shippingAddress: sameAsBilling
                            ? nextBilling
                            : prev.shippingAddress,
                        }));
                      }}
                      onShippingChange={(nextShipping) => {
                        setSameAsBilling(false);
                        setInvoiceData((prev) => ({
                          ...prev,
                          shippingAddress: nextShipping,
                        }));
                      }}
                      onSameAsBillingToggle={(checked) => {
                        setSameAsBilling(checked);
                        setInvoiceData((prev) => {
                          if (checked) {
                            lastDistinctShippingAddressRef.current =
                              prev.shippingAddress || "";
                            return {
                              ...prev,
                              shippingAddress: prev.billingAddress,
                            };
                          }
                          return {
                            ...prev,
                            shippingAddress:
                              lastDistinctShippingAddressRef.current || "",
                          };
                        });
                      }}
                    />
                  </>
                )}

                {/* Phone and Fax Number - Side by Side */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {ciText("Phone")}
                    </label>
                    <input
                      type="text"
                      name="phoneNumber"
                      value={invoiceData.phoneNumber || ""}
                      onChange={handleInputChange}
                      placeholder={ciText("Enter phone number")}
                      className="w-full px-3 py-2.5 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {ciText("Fax Number")}
                    </label>
                    <input
                      type="text"
                      name="faxNumber"
                      value={invoiceData.faxNumber || ""}
                      onChange={handleInputChange}
                      placeholder={ciText("Enter fax number")}
                      className="w-full px-3 py-2.5 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                    />
                  </div>
                </div>

                {/* Doc numbering not configured banner */}
                {docNumMissing && !id && (
                  <div className="flex items-center justify-between gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-500" />
                      <span>
                        Invoice numbering is not configured for this business
                        group. Numbers will be auto-generated using the Business
                        Group fallback sequence.
                      </span>
                    </div>
                    {(adminInfo?.role?.isSuperAdmin ||
                      adminInfo?.role?.modules?.some((mod) =>
                        mod.subModules?.some(
                          (sub) => sub.path === "/document-sequencing",
                        ),
                      )) && (
                      <a
                        href="/document-sequencing"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 px-3 py-1 text-xs font-semibold bg-amber-500 text-white rounded-md hover:bg-amber-600 transition-colors whitespace-nowrap"
                      >
                        {ciText("Configure Now")}
                      </a>
                    )}
                  </div>
                )}

                {/* Invoice Number, Order Number, Currency*/}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {ciText("Invoice Number")}
                    </label>
                    <input
                      type="text"
                      value={invoiceNumber}
                      readOnly
                      className="w-full px-3 py-2.5 text-sm bg-[#374151] text-white border border-gray-300 rounded-lg  cursor-not-allowed"
                    />
                    {formErrors.invoiceNumber && (
                      <p className="mt-1 text-xs text-red-500">
                        {formErrors.invoiceNumber}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {ciText("Order Number")}
                    </label>
                    <input
                      type="text"
                      name="orderNumber"
                      value={invoiceData.orderNumber || ""}
                      onChange={handleInputChange}
                      placeholder={ciText("Enter order number")}
                      className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {ciText("Currency")}
                    </label>
                    <input
                      type="text"
                      value={
                        selectedCustomer
                          ? invoiceData.currency || baseCurrency || "MYR"
                          : ""
                      }
                      readOnly
                      className="w-full px-3 py-2.5 text-sm bg-gray-100 text-gray-700 border border-gray-300 rounded-lg cursor-not-allowed"
                      placeholder={
                        selectedCustomer
                          ? "Customer currency will appear here"
                          : "Select customer"
                      }
                    />
                  </div>
                </div>

                {/* Invoice Date, Terms, Due Date Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {ciText("Invoice Date")} <span className="text-red-500">*</span>
                    </label>
                    <CustomDatePicker
                      value={invoiceData.invoiceDate}
                      onChange={(date) => {
                        const updatedData = {
                          ...invoiceData,
                          invoiceDate: date,
                        };
                        if (updatedData.terms) {
                          const selectedTerm = paymentTerms.find(
                            (t) => t.name === updatedData.terms,
                          );
                          const calculatedDueDate = calculateDueDate(
                            selectedTerm || updatedData.terms,
                            date,
                          );
                          if (calculatedDueDate)
                            updatedData.dueDate = calculatedDueDate;
                        }
                        setInvoiceData(updatedData);
                      }}
                      bgColor="#FFFFFF"
                      style={{
                        backgroundColor: "#FFFFFF",
                        border: "1px solid #E5E7EB",
                        borderRadius: "8px",
                      }}
                    />
                    {formErrors.invoiceDate && (
                      <p className="mt-1 text-xs text-red-500">
                        {formErrors.invoiceDate}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {ciText("Payment Terms")} <span className="text-red-500">*</span>
                    </label>
                    <div className="bg-white rounded-lg">
                      <SearchableDropdown
                        value={invoiceData.terms}
                        onChange={(e) => {
                          const selectedTermName = e.target.value;
                          const updatedData = {
                            ...invoiceData,
                            terms: selectedTermName,
                          };
                          if (selectedTermName && updatedData.invoiceDate) {
                            const term = paymentTerms.find(
                              (t) => t.name === selectedTermName,
                            );
                            const calculatedDueDate = calculateDueDate(
                              term || selectedTermName,
                              updatedData.invoiceDate,
                            );
                            if (calculatedDueDate)
                              updatedData.dueDate = calculatedDueDate;
                          }
                          setInvoiceData(updatedData);
                        }}
                        placeholder={ciText("Select Payment Term")}
                        searchPlaceholder={ciText("Search payment terms...")}
                        disabled={!invoiceData.business}
                        options={(
                          paymentTerms?.map((term) => ({
                            value: term.name,
                            label: term.name,
                            name: term.name,
                          })) || []
                        ).filter(
                          (t, i, a) =>
                            a.findIndex((x) => x.value === t.value) === i,
                        )}
                        searchKeys={["name"]}
                        dropdownFooter={
                          <AddPaymentTermButton
                            businessId={invoiceData.business}
                            headers={headers}
                            disabled={!invoiceData.business}
                            displayMode="dropdown"
                            onAdded={(newTerm) => {
                              setPaymentTerms((prev) =>
                                prev.some((t) => t._id === newTerm._id)
                                  ? prev
                                  : [...prev, newTerm],
                              );
                              const updatedData = {
                                ...invoiceData,
                                terms: newTerm.name,
                              };
                              if (invoiceData.invoiceDate) {
                                const calculatedDueDate = calculateDueDate(
                                  newTerm,
                                  invoiceData.invoiceDate,
                                );
                                if (calculatedDueDate)
                                  updatedData.dueDate = calculatedDueDate;
                              }
                              setInvoiceData(updatedData);
                            }}
                          />
                        }
                      />
                    </div>
                    {formErrors.terms && (
                      <p className="mt-1 text-xs text-red-500">
                        {formErrors.terms}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {ciText("Due Date")} <span className="text-red-500">*</span>
                    </label>
                    <CustomDatePicker
                      value={invoiceData.dueDate}
                      minDate={
                        invoiceData.invoiceDate
                          ? new Date(
                              new Date(invoiceData.invoiceDate).setHours(
                                0,
                                0,
                                0,
                                0,
                              ),
                            )
                          : undefined
                      }
                      onChange={(date) => {
                        const resolvedTerm = getPaymentTermFromDueDate(
                          invoiceData.invoiceDate,
                          date,
                          paymentTerms || [],
                        );
                        const updatedData = {
                          ...invoiceData,
                          dueDate: date,
                          terms: resolvedTerm,
                        };
                        setInvoiceData(updatedData);
                      }}
                      bgColor="#FFFFFF"
                      style={{
                        backgroundColor: "#FFFFFF",
                        border: "1px solid #E5E7EB",
                        borderRadius: "8px",
                      }}
                    />
                  </div>
                </div>

                {shouldRenderCustomFieldAtSlot(
                  "sales",
                  "invoice",
                  "after_due_date",
                ) && invoiceData.business ? (
                  <DynamicCustomFieldsForm
                    businessId={invoiceData.business}
                    module="sales"
                    screen="invoice"
                    columns={3}
                    recordId={id || undefined}
                    values={invoiceCustomFieldValues}
                    onValuesChange={setInvoiceCustomFieldValues}
                    headers={headers}
                    useBreakpointGrid
                  />
                ) : null}

                {/* Invoice Type & Contract */}
                {/* <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {ciText("Invoice Type")} <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        name="invoiceType"
                        value={invoiceData.invoiceType}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg appearance-none pr-10 focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] bg-white"
                      >
                        <option
                          value="Proforma"
                          disabled={
                            shouldEnforceContractInvoiceTypeRules &&
                            !canCreateProforma
                          }
                        >
                          Proforma{" "}
                          {shouldEnforceContractInvoiceTypeRules &&
                          !canCreateProforma
                            ? "(Already exists)"
                            : ""}
                        </option>
                        <option
                          value="Commercial"
                          disabled={
                            shouldEnforceContractInvoiceTypeRules &&
                            !canCreateCommercial
                          }
                        >
                          Commercial{" "}
                          {shouldEnforceContractInvoiceTypeRules &&
                          !canCreateCommercial
                            ? "(Not available)"
                            : ""}
                        </option>
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                    {formErrors.invoiceType && (
                      <p className="mt-1 text-xs text-red-500">
                        {formErrors.invoiceType}
                      </p>
                    )}
                  </div>
                </div> */}
              </div>
            </div>

            {/* Single Column Layout: Item Table, then Summary Panel below */}
            <div className="space-y-6">
              {/* Item Table Card */}
              <div className="bg-white rounded-lg ">
                <ZohoStyleItemTable
                  invoiceData={invoiceData}
                  setInvoiceData={setInvoiceData}
                  selectedContract={selectedContract}
                  expenseAccounts={expenseAccounts}
                  currency={invoiceData.currency || baseCurrency || "MYR"}
                  errors={formErrors}
                  businessItems={businessItems}
                  taxes={taxes}
                  onBulkAdd={() => setShowBulkAddItemsModal(true)}
                  onItemChange={handleItemChangeWithStockCheck}
                  stockWarnings={stockWarnings}
                  businessId={invoiceData.business}
                  headers={headers}
                  lineItemCustomFieldDefinitions={lineItemCustomFieldDefs}
                  onTaxCreated={(newTax) => {
                    if (!newTax?._id) return;
                    setTaxes((prev) =>
                      prev.some((t) => String(t._id) === String(newTax._id))
                        ? prev
                        : [...prev, newTax],
                    );
                  }}
                />
              </div>

              {/* Invoice Summary Panel - Only show when items exist */}
              {invoiceData.items && invoiceData.items.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 ">
                  {/* Invoice Summary Panel */}
                  <div>
                    <InvoiceSummaryPanel
                      invoiceData={invoiceData}
                      onDiscountChange={(value) =>
                        setInvoiceData((prev) => {
                          const discountAmount = (prev.subtotal * value) / 100;
                          const total =
                            prev.subtotal -
                            discountAmount +
                            prev.shippingCharges +
                            prev.adjustment;
                          return {
                            ...prev,
                            discountPercentage: value,
                            discountAmount,
                            total,
                          };
                        })
                      }
                      onShippingChange={(value) =>
                        setInvoiceData((prev) => {
                          const total =
                            prev.subtotal -
                            prev.discountAmount +
                            value +
                            prev.adjustment;
                          return {
                            ...prev,
                            shippingCharges: value,
                            total,
                          };
                        })
                      }
                      onAdjustmentChange={(value) =>
                        setInvoiceData((prev) => {
                          const total =
                            prev.subtotal -
                            prev.discountAmount +
                            prev.shippingCharges +
                            value;
                          return {
                            ...prev,
                            adjustment: value,
                            total,
                          };
                        })
                      }
                      currency={invoiceData.currency || baseCurrency || "MYR"}
                    />
                  </div>
                </div>
              )}

              {/* Notes & Terms Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Customer Notes */}
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                  <label className="block text-sm font-semibold text-gray-900 mb-3">
                    {ciText("Customer Notes")}
                  </label>
                  <textarea
                    name="customerNotes"
                    value={invoiceData.customerNotes ?? ""}
                    placeholder={ciText("Thanks for your business.")}
                    onChange={handleInputChange}
                    rows={4}
                    className="w-full min-h-[6rem] px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] resize-y"
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    {ciText("Will be displayed on the invoice")}
                  </p>
                </div>

                <DocumentTermsAndConditionsSection
                  businessId={invoiceData.business}
                  headers={headers}
                  businessData={businessData}
                  termsAndConditionsList={termsAndConditionsList}
                  onTermsListChange={setTermsAndConditionsList}
                  termsAndConditions={invoiceData.termsAndConditions}
                  onTermsContentChange={(value) =>
                    setInvoiceData((prev) => ({
                      ...prev,
                      termsAndConditions: value,
                    }))
                  }
                  footerNote={ciText(
                    "Terms appear on the invoice preview and PDF. Edit above if needed.",
                  )}
                />
              </div>
            </div>

            {/* Contract Information Display */}
            {selectedContract && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-blue-900 mb-2">
                      {ciText("Contract Information")}
                    </h3>
                    {isCalculatingDetails ? (
                      <div className="flex items-center gap-2 text-sm text-blue-700">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        {ciText("Calculating contract details...")}
                      </div>
                    ) : (
                      <div className="space-y-1 text-sm text-blue-800">
                        <p>
                          <span className="font-medium">{ciText("Contract Total:")}</span>{" "}
                          {formatCurrencyAmount(
                            invoiceData.currency,
                            contractDetails.totalAmount ?? 0,
                          )}
                        </p>
                        {contractDetails.depositPercentage > 0 && (
                          <p>
                            <span className="font-medium">{ciText("Deposit:")}</span>{" "}
                            {contractDetails.depositPercentage}% (
                            {formatCurrencyAmount(
                              invoiceData.currency,
                              contractDetails.depositAmount ?? 0,
                            )})
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Summary Panel */}
          {/* <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-6">
              {/* Invoice Summary */}
          {/* <InvoiceSummaryPanel
                invoiceData={invoiceData}
                onDiscountChange={(value) => {
                  setInvoiceData((prev) => ({
                    ...prev,
                    discountPercentage: value,
                    discountAmount: (prev.subtotal * value) / 100,
                  }));
                }}
                currency={invoiceData.currency || baseCurrency || "MYR"}
              /> */}

          {/* Template Selection */}
          {/* <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="p-4 border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-900">
                    {ciText("Template")}
                  </h3>
                </div>
                <div className="p-4">
                  <div className="mb-3">
                    <p className="text-sm text-gray-600 mb-2">
                      {invoiceData.template ||
                        (selectedTemplate && selectedTemplate.name) ||
                        "No template selected"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(true)}
                    disabled={!invoiceData.items || invoiceData.items.length === 0}
                    className={`w-full px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                      !invoiceData.items || invoiceData.items.length === 0
                        ? "border-gray-300 text-gray-400 bg-gray-50 cursor-not-allowed"
                        : "border-[var(--p-blue)] text-[var(--p-blue)] hover:bg-blue-50"
                    }`}
                  >
                    {ciText("Choose Template")}
                  </button>
                </div>
              </div> */}

          {/* Deposit Info for Proforma */}
          {/* {invoiceData.invoiceType === "Proforma" &&
                contractDetails.depositPercentage > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <Info className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-green-900">
                          {ciText("Deposit Required")}
                        </p>
                        <p className="text-xs text-green-700 mt-1">
                          {contractDetails.depositPercentage}% of contract total
                        </p>
                        <p className="text-lg font-bold text-green-900 mt-2">
                          {invoiceData.currency}{" "}
                          {contractDetails.depositAmount?.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                )} */}

          {/* Commercial Invoice Info */}
          {/* {invoiceData.invoiceType === "Commercial" &&
                existingProformaInvoices.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-amber-900">
                          {ciText("Advance Payments Applied")}
                        </p>
                        <p className="text-xs text-amber-700 mt-1">
                          Total reduced by advance payments from Proforma
                          Invoice(s)
                        </p>
                      </div>
                    </div>
                  </div>
                )} */}
          {/* </div>
          </div> */}
        </div>
      </div>

      {/* Action Buttons - Bottom of Screen */}
      <div className="bg-white border-t border-gray-200 sticky bottom-0 z-10 shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            {/* Template selection - Left Side */}
            <div className="flex items-center gap-3">
              {DocumentData?.s3Key || DocumentData?.url ? (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg">
                    <FileText className="w-4 h-4" />
                    <span>{ciText("Selected Template")}</span>
                    <button
                      type="button"
                      onClick={() => setIsViewerOpen(true)}
                      className="text-green-700 hover:text-green-900 underline"
                    >
                      {ciText("View")}
                    </button>
                  </div>
                </div>
              ) : selectedTemplateId ? (
                <div className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg">
                  <FileText className="w-4 h-4" />
                  <span>
                    Template:{" "}
                    {selectedTemplate?.name ||
                      invoiceData?.template ||
                      "Selected"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(true)}
                    className="text-green-700 hover:text-green-900 underline"
                  >
                    {ciText("Change")}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  disabled={
                    isLoading ||
                    !selectedCustomer ||
                    !invoiceData.items ||
                    invoiceData.items.length === 0 ||
                    !invoiceData?.business
                  }
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  {ciText("Select PDF Template")}
                </button>
              )}
            </div>

            {/* Save Buttons - Right Side */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleSubmit("draft")}
                disabled={isLoading || !canSave}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {ciText("Save as Draft")}
              </button>
              <button
                type="button"
                onClick={() => handleSubmit("generated")}
                disabled={
                  isLoading ||
                  !canSave ||
                  (templates.length > 0 && !selectedTemplateId)
                }
                title={
                  templates.length > 0 && !selectedTemplateId
                    ? "Select a PDF template (or wait for templates to load)"
                    : undefined
                }
                className="px-4 py-2 text-sm font-medium text-white bg-[var(--p-blue)] rounded-lg hover:bg-[var(--p-blue-dark)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                {isLoading ? ciText("Saving...") : ciText("Save & Send")}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {renderTemplatePreviewModal()}
      <DocumentTemplateModal
        key={`template-modal-${templates.length}-${invoiceData?.invoiceType}`}
        isOpen={isModalOpen}
        type={
          invoiceData?.invoiceType === "Commercial"
            ? "Commercial Invoice"
            : "Proforma Invoice"
        }
        onClose={() => {
          setIsModalOpen(false);
          // setSelectedContractId(null)
        }}
        // contractId={selectedContract?._id}
        // contractId={selectedContractId}
        onSubmit={handleGenerateDocument}
        onPreview={openTemplatePreview}
        templates={templates}
        businessData={businessData}
      />
      {isGeneratorOpen && (
        <DocumentGenerator
          open={isGeneratorOpen}
          onClose={() => setIsGeneratorOpen(false)}
          templateId={selectedTemplateId}
          templateData={selectedTemplate}
          invoiceData={{
            ...invoiceData,
            customer_id: selectedCustomer,
            customer:
              selectedCustomer?.basicInformation?.customerDisplayName ||
              invoiceData?.customer,
            customerEmail:
              selectedCustomer?.basicInformation?.customerEmail ||
              selectedCustomer?.keyContacts?.[0]?.email ||
              invoiceData?.customerEmail,
            customer_email:
              selectedCustomer?.basicInformation?.customerEmail ||
              selectedCustomer?.keyContacts?.[0]?.email ||
              invoiceData?.customer_email,
            customer_phone:
              selectedCustomer?.basicInformation?.customerPhone?.mobile ||
              selectedCustomer?.basicInformation?.customerPhone?.workPhone ||
              invoiceData?.phoneNumber,
            customerCompany:
              selectedCustomer?.basicInformation?.companyName ||
              selectedCustomer?.companyInfo?.companyName ||
              invoiceData?.customerCompany,
            invoiceNumber: invoiceNumber || invoiceData?.invoiceNumber,
            invoice_number:
              invoiceNumber ||
              invoiceData?.invoiceNumber ||
              invoiceData?.invoice_number,
          }}
          businessData={businessData}
          business_id={invoiceData?.business}
          contract={selectedContract}
          accountTypeName={accountTypeName}
          adminInfo={adminInfo}
          proformaInvoice={true}
          onSuccess={handleGenerationSuccess}
          contractDetails={contractDetails}
          savedRecordIdForPdf={id || undefined}
          documentCustomFieldDefinitions={invoiceCustomFieldDefinitions}
          documentCustomFieldValues={invoiceCustomFieldValues}
          lineItemCustomFieldDefinitions={lineItemCustomFieldDefs}
        />
      )}
      {isViewerOpen && (
        <DocumentViewer
          business_id={invoiceData?.business}
          open={isViewerOpen}
          onClose={() => setIsViewerOpen(false)}
          documentUrl={DocumentData?.s3Key || DocumentData?.url}
          contractNo={
            selectedContract?.contractNo ||
            invoiceData?.salesContractNumber ||
            invoiceData?.invoiceNumber
          }
          invoiceNumber={
            invoiceData?.invoice_number || invoiceData?.invoiceNumber
          }
        />
      )}
      <BulkAddItemsModal
        isOpen={showBulkAddItemsModal}
        onClose={() => setShowBulkAddItemsModal(false)}
        items={businessItems}
        onAddItems={handleBulkAddItems}
        currency={invoiceData.currency || baseCurrency || "MYR"}
      />
      <QuickAddCustomerModal
        isOpen={showQuickAddCustomer}
        onClose={() => setShowQuickAddCustomer(false)}
        businessId={invoiceData.business}
        baseUrl={Base_URL}
        headers={headers}
        onSuccess={(newCustomer) => {
          setCustomers((prev) => {
            const has = prev.some((c) => c._id === newCustomer._id);
            return has ? prev : [...prev, newCustomer];
          });
          handleChangeCustomer(newCustomer._id);
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
          // Refresh customer data to get updated addresses
          if (selectedCustomer?._id) {
            try {
              const response = await axios.get(
                `${Base_URL}/customers/${selectedCustomer._id}`,
              );
              const updatedCustomer = response?.data;
              setSelectedCustomer(updatedCustomer);

              // Update invoice data with formatted address
              const formatAddress = (addressObj) => {
                if (!addressObj) return "";
                const parts = [];
                if (addressObj.addressLine1)
                  parts.push(addressObj.addressLine1);
                if (addressObj.addressLine2)
                  parts.push(addressObj.addressLine2);
                if (addressObj.city) parts.push(addressObj.city);
                if (addressObj.state) parts.push(addressObj.state);
                if (addressObj.zipCode) parts.push(addressObj.zipCode);
                if (addressObj.country) parts.push(addressObj.country);
                return parts.join("\n");
              };

              const formattedAddress = formatAddress(savedAddress);

              if (addressModalType === "Billing") {
                setInvoiceData((prev) => ({
                  ...prev,
                  billingAddress: formattedAddress,
                  shippingAddress: sameAsBilling
                    ? formattedAddress
                    : prev.shippingAddress,
                  phoneNumber: savedAddress.phone || prev.phoneNumber,
                  faxNumber: savedAddress.fax || prev.faxNumber,
                }));
              } else {
                setInvoiceData((prev) => ({
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
    </div>
  );
};

export default CreateCustomerInvoice;
