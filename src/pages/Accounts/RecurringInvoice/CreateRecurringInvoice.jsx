import { useTranslation } from "react-i18next";
import { recurringInvoiceText as riText } from "@/utils/recurringInvoiceI18n";
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
  Mail,
  Info,
  AlertCircle,
} from "lucide-react";
import axios from "axios";
import { format, addMonths } from "date-fns";
import SalesOrderServices from "@/services/SalesOrderServices";
import { useHistory, useLocation, useParams } from "react-router-dom";
import { notifyError, notifySuccess } from "@/utils/toast";
import ItemTable from "@/pages/Accounts/CustomerInvoice/ItemTable";
import ZohoStyleItemTable from "@/components/invoice/ZohoStyleItemTable";
import InvoiceSummaryPanel from "@/components/invoice/InvoiceSummaryPanel";
import { AdminContext } from "@/context/AdminContext";
import DocumentTemplateModal from "@/pages/SalesContract/actions/DocumentTemplates";
import DocumentGenerator from "@/pages/Accounts/CustomerInvoice/DocumentGenerator";
import DocumentViewer from "@/pages/Accounts/CustomerInvoice/document-viewer";
import CustomDatePicker from "@/components/CustomDatePicker";
import { PageHeader } from "@/page-layouts/index";
import {
  formatAmount,
  formatDate,
  formatCurrencyAmount,
} from "@/components/formatAmount";
import SearchableDropdown from "@/components/SearchableDropdown";
import DropdownBasic from "@/page-layouts/components/DropdownBasic";
import SingleBusinessField from "@/components/SingleBusinessField";
import AddressModal from "@/components/AddressModal";
import CustomerBillShipAddressFields from "@/components/CustomerBillShipAddressFields";
import BulkAddItemsModal from "@/components/customer-invoices/BulkAddItemsModal";
import QuickAddCustomerModal from "@/components/customer-invoices/QuickAddCustomerModal";
import AddPaymentTermButton from "@/components/AddPaymentTermButton";
import AddInvoiceRecurrenceButton from "@/components/AddInvoiceRecurrenceButton";
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
} from "@/utils/itemDiscountUtils";
import { getNextDocumentNumber } from "@/services/documentSequenceServices";
import { buildCustomerInvoiceDefaultEmailHtml } from "@/utils/customerInvoiceDefaultEmailHtml";
import DynamicCustomFieldsForm from "@/components/custom-fields/DynamicCustomFieldsForm";
import {
  fetchDefinitions,
  fetchLineItemCustomFieldDefinitions,
  upsertValues,
} from "@/services/customFieldServices";
import { validateCustomFieldValues } from "@/utils/customFieldValidation";
import { shouldRenderCustomFieldAtSlot } from "@/utils/customFieldPlacement";
import {
  buildMissingCustomerAddressMessage,
  fetchAddressTypeConfig,
  findAddressBySystemType,
  getMissingBillShipTypesForCustomerDisplay,
  missingBillShipSectionTitle,
  normalizeAddressOneLine,
  resolveCustomerBillShipAddresses,
  resolveSameAsBillingFlag,
  stringifyAddressForForm,
} from "@/utils/addressTypeUtils";

function getRecurringCustomerPrimaryName(customer) {
  return (
    customer?.basicInformation?.customerDisplayName ||
    customer?.basicInformation?.companyName ||
    customer?.companyInfo?.companyName ||
    customer?.name ||
    ""
  );
}

function getRecurringCustomerSecondaryName(customer) {
  const primary = getRecurringCustomerPrimaryName(customer);
  const companyName =
    customer?.basicInformation?.companyName ||
    customer?.companyInfo?.companyName ||
    "";
  return companyName && companyName !== primary ? companyName : "";
}

function CreateRecurringInvoice() {
  const { i18n } = useTranslation();
  const { id: profileId } = useParams();
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
  const [addTermsModalOpen, setAddTermsModalOpen] = useState(false);
  const [termsDropdownOpen, setTermsDropdownOpen] = useState(false);
  const termsDropdownRef = useRef(null);
  /** "draft" | "send" — chosen via Action row + gear menu (same as former dual buttons). */
  const [recurringSaveAction, setRecurringSaveAction] = useState("send");
  const [saveActionMenuOpen, setSaveActionMenuOpen] = useState(false);
  const saveActionMenuRef = useRef(null);
  const [newTermName, setNewTermName] = useState("");
  const [newTermContent, setNewTermContent] = useState("");
  const [savingNewTerm, setSavingNewTerm] = useState(false);
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
    subject: "",
  });

  useEffect(() => {
    const loadAddressTypes = async () => {
      const businessId = invoiceData.business || businessData?._id;
      const config = await fetchAddressTypeConfig(businessId, headers);
      setAddressTypeConfig(config);
    };
    loadAddressTypes();
  }, [invoiceData.business, businessData?._id]);

  // Edit: if template had no addresses, backfill from customer once config + customer are ready
  useEffect(() => {
    if (
      !profileId ||
      !selectedCustomer?._id ||
      !addressTypeConfig?.hasConfiguredTypes
    ) {
      return;
    }
    setInvoiceData((prev) => {
      const billEmpty = !normalizeAddressOneLine(prev.billingAddress);
      const shipEmpty = !normalizeAddressOneLine(prev.shippingAddress);
      if (!billEmpty && !shipEmpty) return prev;

      const fromCustomer = resolveCustomerBillShipAddresses(
        selectedCustomer,
        addressTypeConfig,
      );
      if (!fromCustomer.billing && !fromCustomer.shipping) return prev;

      const billing = billEmpty
        ? fromCustomer.billing
        : normalizeAddressOneLine(prev.billingAddress);
      const shipping = sameAsBilling
        ? billing
        : shipEmpty
          ? fromCustomer.shipping
          : normalizeAddressOneLine(prev.shippingAddress);

      if (
        billing === normalizeAddressOneLine(prev.billingAddress) &&
        shipping === normalizeAddressOneLine(prev.shippingAddress)
      ) {
        return prev;
      }
      return { ...prev, billingAddress: billing, shippingAddress: shipping };
    });
  }, [profileId, selectedCustomer, addressTypeConfig, sameAsBilling]);

  const [formErrors, setFormErrors] = useState({});
  const [recurringCustomFieldValues, setRecurringCustomFieldValues] = useState(
    {},
  );
  const [lineItemCustomFieldDefs, setLineItemCustomFieldDefs] = useState([]);
  const [invoiceCustomFieldDefinitions, setInvoiceCustomFieldDefinitions] =
    useState([]);
  const [stockWarnings, setStockWarnings] = useState({}); // { itemIndex: { available, requested, message, isOverstock } }
  const stockCheckTimeoutRef = useRef(null);
  const latestItemsRef = useRef([]); // Store latest items for stock checking

  const [advancePayment, setAdvancePayment] = useState({
    isAdvance: false,
    amount: 0,
  });

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
            { businessId: bid, transactionContext: "sales:recurring_invoice" },
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

  function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function toYmdFromPicker(date) {
    if (!date) return "";
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return "";
    return formatDateForInput(d);
  }

  function formatYmdLabel(ymd) {
    if (!ymd) return "";
    if (ymd instanceof Date) {
      if (Number.isNaN(ymd.getTime())) return "";
      return format(ymd, "dd MMM yyyy");
    }
    if (typeof ymd === "string" && /^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
      const d = new Date(`${ymd}T12:00:00`);
      return Number.isNaN(d.getTime()) ? "" : format(d, "dd MMM yyyy");
    }
    const d = new Date(ymd);
    return Number.isNaN(d.getTime()) ? "" : format(d, "dd MMM yyyy");
  }

  const [profileName, setProfileName] = useState("");
  /**
   * Recurring profile number. New profiles preview the next number from the
   * Settings → Document Numbering sequence configured for the resolved Business
   * Group (per-group running counter); edits show the persisted number read-only.
   */
  const [profileNumber, setProfileNumber] = useState("");
  const [profileNumberIsFallback, setProfileNumberIsFallback] = useState(false);
  const [repeatEveryInterval, setRepeatEveryInterval] = useState(1);
  const [repeatEveryUnit, setRepeatEveryUnit] = useState("month");
  const [recurringStartOn, setRecurringStartOn] = useState(() =>
    formatDateForInput(new Date()),
  );
  const [recurringEndsOn, setRecurringEndsOn] = useState("");
  const [recurringNeverExpire, setRecurringNeverExpire] = useState(true);
  const [invoiceRecurrencePresets, setInvoiceRecurrencePresets] = useState([]);
  const [recurrencePresetsLoaded, setRecurrencePresetsLoaded] = useState(false);
  const [recurrencePresetId, setRecurrencePresetId] = useState("");
  const [pendingProfileRecurrenceMatch, setPendingProfileRecurrenceMatch] =
    useState(null);
  const [salespersonOptions, setSalespersonOptions] = useState([]);
  const [selectedSalesperson, setSelectedSalesperson] = useState(null);
  const [profileBootstrapLoading, setProfileBootstrapLoading] = useState(false);

  console.log("invoiceData.business", invoiceData?.business);

  useEffect(() => {
    if (!profileId || !adminInfo?.token) {
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setProfileBootstrapLoading(true);
      try {
        const res = await axios.get(
          `${Base_URL}/recurring-invoice/${profileId}`,
          {
            headers,
          },
        );
        const row = res.data?.data;
        if (!row || cancelled) return;
        const tpl = row.invoice_template;
        if (!tpl) {
          notifyError(riText("Invalid recurring profile data."));
          history.push("/recurring-Invoice");
          return;
        }
        const bid = tpl.business_id?._id || tpl.business_id;
        const cid = tpl.customer_id?._id || tpl.customer_id;
        const invDate = tpl.invoice_date
          ? new Date(tpl.invoice_date)
          : new Date();
        const dueD = tpl.due_date ? new Date(tpl.due_date) : invDate;
        const mappedItems = (tpl.items || []).map((it, idx) => {
          const qty = Number(it.quantity) || 0;
          const unit = Number(it.unitPrice) || 0;
          const disc = Number(it.discount) || 0;
          const lineSub = qty * unit * (1 - disc / 100);
          const taxRate = Number(it.taxRate) || 0;
          const taxAmt = (lineSub * taxRate) / 100;
          const total = Number(it.totalValue) || Math.max(0, lineSub + taxAmt);
          const storedTitle = it.title != null ? String(it.title).trim() : "";
          const storedItemName =
            it.itemName != null ? String(it.itemName).trim() : "";
          const lineItemName =
            storedItemName !== "" ? storedItemName : storedTitle;
          return {
            id: idx + 1,
            itemName: lineItemName,
            description: it.description != null ? String(it.description) : "",
            quantity: qty,
            unitPrice: unit,
            discount: disc,
            total,
            totalValue: total,
            taxRate,
            taxId: it.taxId,
            taxName: it.taxName,
            itemId: it.itemId,
            unit: it.unit,
            itemType: it.itemType,
            expenseAccount: it.expenseAccount,
            isAdvancePayment: it.isAdvancePayment,
          };
        });
        const tplBillingAddress = stringifyAddressForForm(tpl.billingAddress);
        const tplShippingAddress = stringifyAddressForForm(tpl.shippingAddress);
        let addressConfig = addressTypeConfig;
        if (bid) {
          addressConfig = await fetchAddressTypeConfig(bid, headers);
          if (!cancelled) setAddressTypeConfig(addressConfig);
        }
        const normalizedBilling = normalizeAddressOneLine(tplBillingAddress);
        const normalizedShipping = normalizeAddressOneLine(tplShippingAddress);
        const resolvedSameAs = resolveSameAsBillingFlag(
          tpl.sameAsBilling,
          normalizedBilling,
          normalizedShipping,
        );
        /**
         * Recompute header discount amount + grand total from the stored
         * discount percentage so Edit ≡ InvoiceSummaryPanel's own formula
         * (subtotal × % / 100). Otherwise a Zoho-synced template carrying
         * `discountAmount = 30` (on Zoho's pre-tax base) with `discount = 30%`
         * and PCI tax-inclusive subtotal `110` would render mismatched
         * rows: amount `PKR 30` and total `PKR 100` instead of `PKR 33` / `PKR 97`.
         */
        const tplSubtotal =
          tpl.subTotal != null
            ? Number(tpl.subTotal) || 0
            : mappedItems.reduce((s, it) => s + (Number(it.total) || 0), 0);
        const tplDiscountPercent = Math.min(
          100,
          Math.max(0, Number(tpl.discount) || 0),
        );
        const tplShippingCharges = Number(tpl.shippingCharges) || 0;
        const tplAdjustment = Number(tpl.adjustment) || 0;
        const tplDiscountAmount =
          tplDiscountPercent > 0
            ? (tplSubtotal * tplDiscountPercent) / 100
            : Number(tpl.discountAmount) || 0;
        const tplGrandTotal = Math.max(
          0,
          tplSubtotal - tplDiscountAmount + tplShippingCharges + tplAdjustment,
        );
        setInvoiceData((prev) => ({
          ...prev,
          business: bid ? String(bid) : "",
          customer: cid ? String(cid) : "",
          invoiceNumber: tpl.invoice_number || "",
          invoiceType: tpl.invoiceType || "Proforma",
          invoiceDate: formatDateForInput(invDate),
          dueDate: formatDateForInput(dueD),
          terms: tpl.terms || prev.terms,
          billingAddress: normalizedBilling,
          shippingAddress: resolvedSameAs
            ? normalizedBilling || normalizedShipping
            : normalizedShipping,
          orderNumber: tpl.orderNumber || "",
          customerNotes: tpl.customerNotes || "",
          termsAndConditions: tpl.termsAndConditions || "",
          items: mappedItems,
          subtotal: tplSubtotal,
          taxTotal: sumLineTaxAmountsFromItems(mappedItems),
          discountPercentage: tplDiscountPercent,
          discountAmount: tplDiscountAmount,
          shippingCharges: tplShippingCharges,
          adjustment: tplAdjustment,
          total: tplGrandTotal,
          currency: tpl.currency || prev.currency,
          bankAccount: tpl.bankAccount?._id || tpl.bankAccount || "",
          salesContractTotal: tpl.salesContractTotal,
          contractTotal: tpl.contractTotal,
          remainingAmount: tpl.remainingAmount,
          subject:
            (row.subject != null && String(row.subject).trim() !== ""
              ? row.subject
              : tpl.subject) || "",
        }));
        setSameAsBilling(resolvedSameAs);
        setInvoiceNumber(tpl.invoice_number || "");
        if (cid) {
          try {
            const customerRes = await axios.get(
              `${Base_URL}/customers/${cid}`,
              {
                headers,
              },
            );
            const customerData = customerRes?.data;
            if (!cancelled && customerData) {
              setSelectedCustomer(customerData);
              const customerAddrs = customerData?.addresses || [];
              const billingAddrObj = findAddressBySystemType(
                customerAddrs,
                addressConfig,
                "BILLING",
              );
              const shippingAddrObj = findAddressBySystemType(
                customerAddrs,
                addressConfig,
                "SHIPPING",
              );
              const fromCustomer = resolveCustomerBillShipAddresses(
                customerData,
                addressConfig,
              );
              const finalBilling = normalizedBilling || fromCustomer.billing;
              const finalShipping = resolvedSameAs
                ? finalBilling || normalizedShipping || fromCustomer.shipping
                : normalizedShipping || fromCustomer.shipping;
              setInvoiceData((prev) => ({
                ...prev,
                customer: String(customerData?._id || cid),
                billingAddress: finalBilling,
                shippingAddress: finalShipping,
                phoneNumber:
                  billingAddrObj?.phone ||
                  shippingAddrObj?.phone ||
                  customerData?.basicInformation?.customerPhone?.mobile ||
                  customerData?.companyInfo?.phone ||
                  prev.phoneNumber ||
                  "",
                faxNumber:
                  billingAddrObj?.fax ||
                  shippingAddrObj?.fax ||
                  customerData?.companyInfo?.contact?.fax ||
                  customerData?.companyInfo?.fax ||
                  prev.faxNumber ||
                  "",
              }));
            }
          } catch (customerError) {
            console.error(
              "Error loading customer details for recurring profile:",
              customerError,
            );
            if (row.customer_id && typeof row.customer_id === "object") {
              const partialCustomer = row.customer_id;
              setSelectedCustomer(partialCustomer);
              const fromCustomer = resolveCustomerBillShipAddresses(
                partialCustomer,
                addressConfig,
              );
              if (fromCustomer.billing || fromCustomer.shipping) {
                setInvoiceData((prev) => ({
                  ...prev,
                  billingAddress:
                    prev.billingAddress?.trim() || fromCustomer.billing,
                  shippingAddress: resolvedSameAs
                    ? prev.billingAddress?.trim() ||
                      fromCustomer.billing ||
                      fromCustomer.shipping
                    : prev.shippingAddress?.trim() || fromCustomer.shipping,
                }));
              }
            }
          }
        } else if (row.customer_id && typeof row.customer_id === "object") {
          setSelectedCustomer(row.customer_id);
        }
        setProfileName(
          row.profile_name != null ? String(row.profile_name).trim() : "",
        );
        if (row.profile_number) {
          setProfileNumber(String(row.profile_number));
          setProfileNumberIsFallback(false);
        }
        setRepeatEveryInterval(row.repeat_interval || 1);
        setRepeatEveryUnit(row.repeat_unit || "month");
        setRecurringStartOn(
          row.start_on
            ? formatDateForInput(new Date(row.start_on))
            : formatDateForInput(new Date()),
        );
        setRecurringNeverExpire(!!row.never_expire);
        setRecurringEndsOn(
          row.ends_on && !row.never_expire
            ? formatDateForInput(new Date(row.ends_on))
            : "",
        );
        setPendingProfileRecurrenceMatch({
          interval: row.repeat_interval || 1,
          unit: row.repeat_unit || "month",
        });
        if (row.salesperson?.id) {
          setSelectedSalesperson({
            _id: row.salesperson.id,
            name: row.salesperson.name,
            displayName: row.salesperson.name,
          });
        }
        const tid = tpl.templateId?._id || tpl.templateId;
        if (tid) setSelectedTemplateId(String(tid));
      } catch (e) {
        console.error(e);
        notifyError(riText("Could not load recurring profile."));
        history.push("/recurring-Invoice");
      } finally {
        if (!cancelled) setProfileBootstrapLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profileId, adminInfo?.token]);

  // Salesperson fetching mirrors Sale Order: pull active sales staff, then
  // surface logged-in user's staff profile at the top (default for new records).
  useEffect(() => {
    if (!invoiceData.business || !adminInfo?.token) {
      setSalespersonOptions([]);
      return undefined;
    }
    let cancelled = false;
    const isEditMode = Boolean(profileId);
    (async () => {
      try {
        let activeSalesStaff = [];
        try {
          const salespersonResponse = await SalesOrderServices.getSalespersons(
            invoiceData.business,
            headers,
          );
          activeSalesStaff = Array.isArray(salespersonResponse?.data?.staffList)
            ? salespersonResponse.data.staffList
            : [];
        } catch (salesErr) {
          console.warn("Unable to fetch sales staff list:", salesErr);
          activeSalesStaff = [];
        }

        let currentUserStaff = null;
        const currentUserId = adminInfo?.id || adminInfo?._id;
        if (currentUserId) {
          try {
            const currentStaffRes = await axios.get(
              `${Base_URL}/staff-management`,
              {
                headers,
                params: {
                  business: invoiceData.business,
                  id: currentUserId,
                  page: 1,
                  limit: 1,
                },
              },
            );
            currentUserStaff = currentStaffRes?.data?.staffList?.[0] || null;
          } catch (selfErr) {
            console.warn(
              "Unable to fetch current user's staff profile:",
              selfErr,
            );
          }
        }

        let mergedSalesStaff = [...activeSalesStaff];
        if (currentUserStaff?._id) {
          const currentUserStaffId = String(currentUserStaff._id);
          const existingIndex = mergedSalesStaff.findIndex(
            (staff) => String(staff._id) === currentUserStaffId,
          );

          if (existingIndex >= 0) {
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
                "Current User",
              isDefaultCurrentUser: true,
            });
          }
        }

        if (cancelled) return;
        setSalespersonOptions(mergedSalesStaff);

        if (!isEditMode && mergedSalesStaff.length > 0) {
          const preferredStaff =
            mergedSalesStaff.find((staff) => staff.isDefaultCurrentUser) ||
            mergedSalesStaff[0];
          if (preferredStaff?._id) {
            setSelectedSalesperson((prev) =>
              prev?._id
                ? prev
                : {
                    _id: String(preferredStaff._id),
                    name:
                      preferredStaff.displayName || preferredStaff.name || "",
                    displayName:
                      preferredStaff.displayName || preferredStaff.name || "",
                  },
            );
          }
        }
      } catch (e) {
        console.error("Salespersons load failed", e);
        if (!cancelled) setSalespersonOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    invoiceData.business,
    adminInfo?.token,
    adminInfo?.id,
    adminInfo?._id,
    profileId,
  ]);

  // Handle sales order pre-fill
  useEffect(() => {
    if (
      location.state?.salesOrderData &&
      !isInitializingFromContractRef.current
    ) {
      const salesOrderData = location.state.salesOrderData;

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

      const salesOrderMappedItems =
        salesOrderData.items?.map((item, idx) => ({
          id: idx + 1,
          itemName: item.itemName || item.item || item.name || item.title || "",
          description: item.description || "",
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice || item.rate || 0,
          discount: item.discount || 0,
          total: item.total || item.amount || 0,
          tax: item.tax || 0,
          taxRate: item.taxRate || 0,
          itemId: item.itemId || undefined, // Include itemId for stock checking
        })) || [];
      const salesOrderTaxTotal = sumLineTaxAmountsFromItems(
        salesOrderMappedItems,
      );

      setInvoiceData((prev) => ({
        ...prev,
        business: salesOrderData.business || "",
        customer: salesOrderData.customer || "",
        orderNumber: salesOrderData.orderNumber || "",
        invoiceDate: invoiceDate,
        dueDate: calculatedDueDate,
        terms: terms,
        billingAddress: salesOrderData.billingAddress || "",
        shippingAddress: salesOrderData.shippingAddress || "",
        phoneNumber: salesOrderData.phone || "",
        faxNumber: salesOrderData.fax || "",
        currency: salesOrderData.currency || "",
        items: salesOrderMappedItems,
        subtotal: salesOrderData.subtotal || 0,
        discountPercentage:
          salesOrderData.discount > 0
            ? (salesOrderData.discount / salesOrderData.subtotal) * 100
            : 0,
        discountAmount:
          salesOrderData.discountAmount || salesOrderData.discount || 0,
        taxTotal: salesOrderTaxTotal,
        shippingCharges: salesOrderData.shippingCharges || 0,
        adjustment: salesOrderData.adjustment || 0,
        total:
          (salesOrderData.subtotal || 0) -
          (salesOrderData.discountAmount || salesOrderData.discount || 0) +
          salesOrderTaxTotal +
          (salesOrderData.shippingCharges || 0) +
          (salesOrderData.adjustment || 0),
        customerNotes: salesOrderData.customerNotes || "",
        termsAndConditions: salesOrderData.termsAndConditions || "",
      }));

      // Note: keep `baseCurrency` as business base currency (fallback only).

      // Check stock for pre-filled items after a short delay
      // Store items for stock check
      const preFilledItems =
        salesOrderData.items?.map((item, idx) => ({
          id: idx + 1,
          description: item.description || "",
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice || item.rate || 0,
          discount: item.discount || 0,
          total: item.total || item.amount || 0,
          tax: item.tax || 0,
          taxRate: item.taxRate || 0,
          itemId: item.itemId || undefined, // Include itemId for stock checking
        })) || [];

      // Check stock after state is updated
      setTimeout(() => {
        checkItemsStock(preFilledItems);
      }, 1500);

      // Set selected customer
      if (salesOrderData.customer) {
        // Fetch customer details
        axios
          .get(`${Base_URL}/customers/${salesOrderData.customer}`, { headers })
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
    }
  }, [location.state?.salesOrderData]);

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
      !location.state?.salesOrderData
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
          notifyError(riText("Failed to fetch contract details"));
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
              const businessId = invoiceData?.business || list[0]?._id || "";
              if (businessId && !invoiceData?.business) {
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
            const businessId =
              invoiceData?.business || parsedData[0]?._id || "";
            if (businessId && !invoiceData?.business) {
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
          notifyError(riText("Failed to load businesses"));
        }
      };

      fetchBusinesses();

      // Fetch business data if business is already set
      if (invoiceData?.business) {
        const fetchBusinessData = async () => {
          try {
            const response = await axios.get(
              `${Base_URL}/business/${invoiceData?.business}`,
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
        try {
          const response = await axios.get(
            `${Base_URL}/sales-contracts/customer/${selectedCustomer._id}?businessId=${invoiceData?.business}`,
          );
          console.log("response?.data?.contracts", response?.data?.contracts);
          setSalesContracts(response?.data?.contracts || []);
        } catch (error) {
          console.error("Error fetching sales contracts:", error);
        }
      };

      const fetchExpenseAccounts = async () => {
        try {
          const response = await axios.get(`${Base_URL}/accounts`, {
            params: { business: invoiceData?.business },
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
    profileId,
    Base_URL,
    invoiceData.business,
    selectedCustomer?._id,
    adminInfo?.id,
  ]);

  // Generate invoice number preview when business data is loaded (create only — not when editing a profile)
  useEffect(() => {
    if (!profileId && businessData?._id) {
      const businessGroupId =
        businessData.businessGroup?._id || businessData.businessGroup;
      if (businessGroupId) {
        generateInvoiceNumber(businessData._id, businessGroupId);
        previewProfileNumber(businessData._id, businessGroupId);
      }
    }
  }, [businessData?._id, businessData?.businessGroup, profileId]);

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

  useEffect(() => {
    const fetchRecurrencePresets = async () => {
      if (!invoiceData?.business) {
        setInvoiceRecurrencePresets([]);
        setRecurrencePresetsLoaded(false);
        if (!profileId) setRecurrencePresetId("");
        return;
      }
      if (!profileId) {
        setRecurrencePresetId("");
      }
      setRecurrencePresetsLoaded(false);
      try {
        const res = await axios.post(
          `${Base_URL}/items/Invoice Recurrence/get_all`,
          {
            business_id: invoiceData.business,
            FilterStatus: "active",
            FilterName: "",
          },
          { headers },
        );
        if (res.data?.success) {
          setInvoiceRecurrencePresets(res.data.data || []);
        } else {
          setInvoiceRecurrencePresets([]);
        }
      } catch (e) {
        console.error("Error fetching invoice recurrence presets:", e);
        setInvoiceRecurrencePresets([]);
      } finally {
        setRecurrencePresetsLoaded(true);
      }
    };
    fetchRecurrencePresets();
  }, [invoiceData.business, profileId]);

  useEffect(() => {
    if (!pendingProfileRecurrenceMatch || !recurrencePresetsLoaded) return;
    const m = invoiceRecurrencePresets.find(
      (p) =>
        Number(p.repeatInterval) ===
          Number(pendingProfileRecurrenceMatch.interval) &&
        p.repeatUnit === pendingProfileRecurrenceMatch.unit,
    );
    setRecurrencePresetId(m ? String(m._id) : "");
    setPendingProfileRecurrenceMatch(null);
  }, [
    pendingProfileRecurrenceMatch,
    invoiceRecurrencePresets,
    recurrencePresetsLoaded,
  ]);

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

  const selectedTermsValue = useMemo(() => {
    const content = invoiceData.termsAndConditions || "";
    if (
      businessData?.termsAndConditions &&
      content === businessData.termsAndConditions
    )
      return "__default__";
    const fromSettings = termsAndConditionsList.find(
      (t) => (t.content || "") === content,
    );
    if (fromSettings) return `item_${fromSettings._id}`;
    const tIdx = (businessData?.termsTemplates || []).findIndex(
      (t) => (t.content || "") === content,
    );
    if (tIdx >= 0) return `tpl_${tIdx}`;
    return "";
  }, [invoiceData.termsAndConditions, businessData, termsAndConditionsList]);

  const selectedTermsLabel = useMemo(() => {
    if (!selectedTermsValue) return null;
    if (selectedTermsValue === "__default__") return riText("Default");
    if (selectedTermsValue.startsWith("item_")) {
      const id = selectedTermsValue.replace("item_", "");
      const t = termsAndConditionsList.find((x) => x._id === id);
      return t?.name || riText("Terms");
    }
    if (selectedTermsValue.startsWith("tpl_")) {
      const idx = parseInt(selectedTermsValue.replace("tpl_", ""), 10);
      const t = (businessData?.termsTemplates || [])[idx];
      return t?.name || riText("Terms {{number}}", { number: idx + 1 });
    }
    return null;
  }, [
    selectedTermsValue,
    termsAndConditionsList,
    businessData?.termsTemplates,
  ]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        termsDropdownRef.current &&
        !termsDropdownRef.current.contains(e.target)
      ) {
        setTermsDropdownOpen(false);
      }
    };
    if (termsDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [termsDropdownOpen]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        saveActionMenuRef.current &&
        !saveActionMenuRef.current.contains(e.target)
      ) {
        setSaveActionMenuOpen(false);
      }
    };
    if (saveActionMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [saveActionMenuOpen]);

  const handleTermsSelect = useCallback(
    (v) => {
      setTermsDropdownOpen(false);
      if (v === "") {
        setInvoiceData((prev) => ({ ...prev, termsAndConditions: "" }));
        return;
      }
      if (v === "__default__" && businessData?.termsAndConditions) {
        setInvoiceData((prev) => ({
          ...prev,
          termsAndConditions: businessData.termsAndConditions,
        }));
        return;
      }
      if (v.startsWith("item_")) {
        const id = v.replace("item_", "");
        const item = termsAndConditionsList.find((t) => t._id === id);
        if (item)
          setInvoiceData((prev) => ({
            ...prev,
            termsAndConditions: item.content || "",
          }));
        return;
      }
      if (v.startsWith("tpl_")) {
        const idx = parseInt(v.replace("tpl_", ""), 10);
        const templates = businessData?.termsTemplates || [];
        if (Number.isFinite(idx) && templates[idx])
          setInvoiceData((prev) => ({
            ...prev,
            termsAndConditions: templates[idx].content || "",
          }));
      }
      if (v === "__add_new__") {
        setAddTermsModalOpen(true);
      }
    },
    [businessData, termsAndConditionsList],
  );

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
      setSameAsBilling(false);
      lastDistinctShippingAddressRef.current = "";

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
      const { billing: billingAddress, shipping: shippingAddress } =
        resolveCustomerBillShipAddresses(customerData, addressTypeConfig);

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
        customer: customerId || customerData?._id || "",
        phoneNumber,
        billingAddress,
        shippingAddress,
        faxNumber,
        currency: customerCurrency, // Set currency from customer
      }));
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
          riText("A Proforma Invoice already exists for this contract."),
        );
      } else {
        setProformaValidationMessage("");
      }

      if (!availableTypes.commercial.available) {
        if (commercialExists) {
          setCommercialValidationMessage(
            riText("A Commercial Invoice already exists for this contract."),
          );
        } else if (!proformaExists) {
          setCommercialValidationMessage(
            riText("A Proforma Invoice must be created first."),
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
      notifyError(riText("Failed to load contract details"));
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
      notifyError(riText("Failed to load contract details"));
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

      // Recalculate line total when needed (includes tax)
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
        updatedItems[index].total = getItemTotal(
          quantity,
          unitPrice,
          discount,
          taxRate,
        );
      }

      // Recalculate invoice totals
      const subtotal = updatedItems.reduce(
        (sum, item) => sum + (item.total || 0),
        0,
      );
      const taxTotal = sumLineTaxAmountsFromItems(updatedItems);
      const discountAmount = (subtotal * (prev.discountPercentage || 0)) / 100;
      const total = Math.max(
        0,
        subtotal -
          discountAmount +
          (prev.shippingCharges || 0) +
          (prev.adjustment || 0),
      );

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
        };
      } else {
        merged.push(newItem);
      }
    }

    const subtotal = merged.reduce((sum, item) => sum + (item.total || 0), 0);
    const taxTotal = sumLineTaxAmountsFromItems(merged);
    const discountAmount = (subtotal * invoiceData.discountPercentage) / 100;
    const total = Math.max(
      0,
      subtotal -
        discountAmount +
        invoiceData.shippingCharges +
        invoiceData.adjustment,
    );

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
      riText("{{count}} item(s) added successfully", {
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
        riText(
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
        riText("The following files exceed 10MB limit: {{files}}", {
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
          riText("Failed to upload {{file}}. Please try again.", {
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
            ? riText(
                "{{success}} file(s) uploaded successfully. {{fail}} file(s) failed.",
                { success: successCount, fail: failCount },
              )
            : riText("{{count}} file(s) uploaded successfully!", {
                count: successCount,
              });
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
    notifySuccess(riText("File removed successfully"));
  };

  const handleOpenFile = async (documentId) => {
    if (!documentId) return;

    try {
      let response = await axios.get(
        `${Base_URL}/documents/getFileWithAllData/${documentId}`,
      );
      window.open(response.data.data.url, "_blank");
    } catch (error) {
      alert(riText("Error getting file"));
      console.log("Error: ", error);
    }
  };

  // Show PREVIEW of next number — does NOT increment the counter.
  // Server now returns isFallback=true (with a generated number) instead of 404
  // when no sequence is configured, so the field is always populated.
  const generateInvoiceNumber = async (businessId, businessGroupId) => {
    if (!businessId) return;
    try {
      const response = await getNextDocumentNumber(
        "invoice",
        businessId,
        businessGroupId,
      );
      setInvoiceNumber(response.data?.nextNumber);
    } catch (err) {
      console.error("Failed to fetch invoice number preview:", err);
    }
  };

  /**
   * Preview next Recurring Invoice / profile number for the resolved Business
   * Group's `recurring_invoice` sequence. Counter increments only on actual
   * save (server-side `generateDocumentNumber`).
   */
  const previewProfileNumber = async (businessId, businessGroupId) => {
    if (!businessId) return;
    try {
      const response = await getNextDocumentNumber(
        "recurring_invoice",
        businessId,
        businessGroupId,
      );
      setProfileNumber(response.data?.nextNumber || "");
      setProfileNumberIsFallback(response.data?.isFallback === true);
    } catch (err) {
      console.error("Failed to fetch recurring invoice number preview:", err);
    }
  };

  const stripHtml = (html) => {
    console.log("html", html);
    if (!html) return "";
    const doc = new DOMParser().parseFromString(html, "text/html");
    return doc.body.textContent || "";
  };

  const validateForm = () => {
    const errors = {};
    if (!invoiceData.business)
      errors.business = riText("Business is required.");
    if (!selectedCustomer) errors.customer = riText("Customer is required.");
    // Profile uses template only; live invoice numbers are assigned when invoices are generated.
    if (!invoiceData.terms) errors.terms = riText("Payment Terms is required.");
    if (!invoiceData.items || invoiceData.items.length === 0) {
      errors.items = riText("At least one item is required.");
    } else if (
      invoiceData.items.some((item) => !item.quantity || !item.unitPrice)
    ) {
      errors.items = riText("Each item must have quantity and unit price > 0.");
    } else if (
      invoiceData.items.some(
        (item) =>
          !String(item.itemName || item.title || "").trim() &&
          !String(item.description || "").trim(),
      )
    ) {
      errors.items = riText(
        "Each line needs an item name (or select a product) and/or a description.",
      );
    }
    if (invoiceData.discountPercentage > 100)
      errors.discountPercentage = riText("Discount cannot exceed 100%.");

    // Add proforma validation
    if (invoiceData.invoiceType === "Proforma" && !canCreateProforma) {
      errors.invoiceType = proformaValidationMessage;
    }

    // Add commercial validation
    if (invoiceData.invoiceType === "Commercial" && !canCreateCommercial) {
      errors.invoiceType = commercialValidationMessage;
    }

    if (!String(recurrencePresetId || "").trim()) {
      errors.invoiceRecurrence = riText("Invoice recurrence is required.");
    }

    if (!recurringStartOn)
      errors.recurringStartOn = riText("Start date is required.");
    if (!recurringNeverExpire && !recurringEndsOn) {
      errors.recurringEndsOn = riText(
        "End date is required unless Never expire is checked.",
      );
    }
    if (
      !recurringNeverExpire &&
      recurringEndsOn &&
      recurringStartOn &&
      new Date(recurringEndsOn) < new Date(recurringStartOn)
    ) {
      errors.recurringEndsOn = riText(
        "End date must be on or after start date.",
      );
    }
    const ri = Number(repeatEveryInterval);
    if (!ri || ri < 1) {
      errors.repeatEvery = riText("Repeat interval must be at least 1.");
    }

    return errors;
  };

  console.log(
    "selectedContract?.productInfo[0]?.totalValue,",
    selectedContract?.productInfo[0]?.totalValue,
  );

  const handleSubmit = async (creationPreference = "draft") => {
    const errors = validateForm();
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    if (creationPreference === "send") {
      const em =
        selectedCustomer?.basicInformation?.customerEmail ||
        selectedCustomer?.keyContacts?.[0]?.email;
      if (!em || !String(em).trim()) {
        notifyError(
          riText(
            "Customer must have an email before saving with “Email customer on each run”.",
          ),
        );
        return;
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
            recurringCustomFieldValues,
          );
          if (cfErr) {
            notifyError(cfErr);
            return;
          }
        }
      } catch (e) {
        notifyError(
          e?.response?.data?.message ||
            riText("Could not validate custom fields."),
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
      const invoiceDataToSend = {
        templateId: selectedTemplateId,
        invoiceType: invoiceData?.invoiceType,
        invoice_number: invoiceNumber,
        customer_id: selectedCustomer?._id,
        customer_name: selectedCustomer?.basicInformation?.customerDisplayName,
        customer_email: selectedCustomer?.basicInformation?.customerEmail,
        customer_phone:
          selectedCustomer?.basicInformation?.customerPhone?.mobile ||
          selectedCustomer?.basicInformation?.customerPhone?.workPhone ||
          invoiceData?.phoneNumber ||
          "",
        contract_id: selectedContract?._id,
        contract_no: selectedContract?.contractNo,
        business_id: invoiceData?.business,
        invoice_date: new Date(invoiceData?.invoiceDate),
        due_date: new Date(invoiceData?.dueDate),
        sameAsBilling,
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

          return {
            title: item.itemName || item.title || item.description || "",
            /** Round-trip typed / catalog line label (template is Mixed — safe to persist). */
            itemName: String(item.itemName || "").trim(),
            quantity: item.quantity,
            description: item.description || "",
            unitPrice: item.unitPrice,
            totalValue: item.total,
            discount: item.discount || 0, // Include item-level discount
            isAdvancePayment: item.isAdvancePayment || false, // Include the flag for backend reference
            expenseAccount: expenseAccountId || undefined, // Use item-level expense account only
            itemId: item.itemId || undefined, // Include item ID reference
            taxId: item.taxId || undefined, // Include tax ID
            taxRate: item.taxRate || 0, // Include tax rate
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
        subTotal: computedLineItemsSubtotal || invoiceData?.subtotal || 0,
        discount: Number.parseFloat(invoiceData?.discountPercentage),
        discountAmount: invoiceData?.discountAmount,
        documentUrl: DocumentData?.s3Key || DocumentData?.url,
        documentId: DocumentData?._id,
        shippingCharges: Number.parseFloat(invoiceData?.shippingCharges),
        adjustment: Number.parseFloat(invoiceData?.adjustment),
        grandTotal: invoiceData?.total,
        status: "draft",
        billingAddress: invoiceData?.billingAddress,
        shippingAddress: invoiceData?.shippingAddress || "",
        orderNumber: invoiceData?.orderNumber || "",
        customerNotes: invoiceData?.customerNotes || "",
        subject: invoiceData?.subject || "",
        termsAndConditions: invoiceData?.termsAndConditions || "",
        terms:
          invoiceData.terms ||
          stripHtml(selectedContract?.productInfo[0]?.shippingTerms) ||
          "Due on Receipt",
        supportingDocuments: invoiceData?.supportingDocuments || [],
        location: location.state?.contractId
          ? "view-sales-contract"
          : location.state?.salesOrderId
            ? "sales-orders"
            : "customer-invoices",
        module: "customer-invoices",
        salesOrderId: location.state?.salesOrderId || undefined, // Link to sales order
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
      };

      if (creationPreference === "send") {
        const custEmail = (
          selectedCustomer?.basicInformation?.customerEmail ||
          selectedCustomer?.keyContacts?.[0]?.email ||
          ""
        ).trim();
        const subjLine = (invoiceData?.subject || "").trim();
        const bizName = (businessData?.name || "").trim();
        invoiceDataToSend.email = {
          to: custEmail,
          subject: subjLine
            ? `Invoice: ${subjLine}`
            : `Invoice ${invoiceNumber} from ${bizName || "Us"}`.trim(),
          cc: "",
          bcc: "",
        };
        invoiceDataToSend.email_html = buildCustomerInvoiceDefaultEmailHtml({
          customer_name: invoiceDataToSend.customer_name,
          invoice_number: invoiceDataToSend.invoice_number,
          invoice_date: invoiceDataToSend.invoice_date,
          due_date: invoiceDataToSend.due_date,
          grandTotal: invoiceDataToSend.grandTotal,
          currency: invoiceDataToSend.currency,
          invoiceType: invoiceDataToSend.invoiceType,
          advanceDepositAmount: invoiceDataToSend.advanceDepositAmount,
          depositAmount: invoiceDataToSend.depositAmount,
          depositPercentage: invoiceDataToSend.deposit,
          deposit: invoiceDataToSend.deposit,
        });
      }

      console.log("Items being sent to backend:", invoiceDataToSend.items);
      console.log("Order Number being sent:", invoiceDataToSend.orderNumber);
      console.log("Invoice data being sent:", invoiceDataToSend);

      const recurringBody = {
        invoice_template: invoiceDataToSend,
        repeat_interval: Number(repeatEveryInterval) || 1,
        repeat_unit: repeatEveryUnit,
        start_on: recurringStartOn,
        ends_on: recurringNeverExpire
          ? undefined
          : recurringEndsOn || undefined,
        never_expire: !!recurringNeverExpire,
        salesperson:
          selectedSalesperson && selectedSalesperson._id
            ? {
                id: selectedSalesperson._id,
                name:
                  selectedSalesperson.name ||
                  selectedSalesperson.displayName ||
                  "",
              }
            : undefined,
        subject: (invoiceData?.subject || "").trim(),
        profile_name: (profileName || "").trim(),
        /** Only pass profile_number on create; updates never rename the doc id. */
        ...(profileId
          ? {}
          : profileNumber && profileNumber.trim() !== ""
            ? { profile_number: profileNumber.trim() }
            : {}),
        creation_preference: creationPreference,
      };
      const response = profileId
        ? await axios.put(
            `${Base_URL}/recurring-invoice/${profileId}`,
            recurringBody,
            { headers },
          )
        : await axios.post(`${Base_URL}/recurring-invoice`, recurringBody, {
            headers,
          });
      if (response.data?.success !== false) {
        const savedProfileId = profileId || response.data?.data?._id;
        if (savedProfileId && invoiceData.business) {
          try {
            await upsertValues(
              {
                business_id: invoiceData.business,
                module: "sales",
                screen: "invoice",
                record_id: String(savedProfileId),
                values: recurringCustomFieldValues,
              },
              headers,
            );
          } catch (cfErr) {
            notifyError(
              cfErr?.response?.data?.message ||
                riText("Profile saved but custom fields failed to save."),
            );
            setIsLoading(false);
            return;
          }
        }
        if (response.data?.immediate_invoice_error) {
          notifyError(
            riText(
              "Recurring profile was saved, but the first customer invoice was not created (start date is today): {{error}}",
              { error: response.data.immediate_invoice_error },
            ),
          );
        } else {
          const imm = response.data?.immediate_invoice;
          if (imm?._id && imm?.invoice_number) {
            notifySuccess(
              creationPreference === "send"
                ? riText(
                    "Recurring profile saved. Customer invoice {{number}} was created and emailed (start date is today).",
                    { number: imm.invoice_number },
                  )
                : riText(
                    "Recurring profile saved. Customer invoice {{number}} was created as draft (start date is today).",
                    { number: imm.invoice_number },
                  ),
            );
          } else {
            notifySuccess(
              profileId
                ? creationPreference === "send"
                  ? riText(
                      "Recurring profile updated. Future runs will email the customer.",
                    )
                  : riText("Recurring profile updated.")
                : creationPreference === "send"
                  ? riText(
                      "Recurring profile saved. Future runs will email the customer.",
                    )
                  : riText("Recurring profile saved."),
            );
          }
        }
        const createdId = response.data?.data?._id;
        if (profileId) {
          history.push(`/view-recurring-invoice/${profileId}`);
        } else if (createdId) {
          history.push(`/view-recurring-invoice/${createdId}`);
        } else {
          history.push("/recurring-Invoice");
        }
      }
    } catch (error) {
      console.error("Error saving invoice:", error);

      // Handle duplicate invoice number error
      if (error.response?.data?.error === "DUPLICATE_INVOICE_NUMBER") {
        notifyError(
          riText("Invoice number conflict. Retrying with new number..."),
        );
        // Retry — BE will atomically generate a new number on the next attempt
        setTimeout(() => handleSubmit(creationPreference), 500);
        return;
      }

      // Handle insufficient stock error
      if (error.response?.data?.error === "INSUFFICIENT_STOCK") {
        const stockErrors = error.response?.data?.details || [];
        const errorMessages = stockErrors
          .map(
            (err) =>
              err.message ||
              `${err.itemName}: Available ${err.available}, Requested ${err.requested}`,
          )
          .join("\n");

        notifyError(
          riText("Insufficient stock:\n{{items}}", { items: errorMessages }),
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
          riText("Failed to save invoice. Please try again."),
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
      riText("Selected Template");
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
            <h2 className="text-xl font-semibold">
              {riText("Select Invoice Template")}
            </h2>
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
                      {riText("View Preview")}
                    </button>
                    <button
                      className="text-xs text-[var(--p-blue)] hover:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTempTemplateSelect(template._id);
                      }}
                    >
                      {riText("Select")}
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
              {riText("Cancel")}
            </button>
            <button
              onClick={handleConfirmTemplateSelection}
              className="px-4 py-2 bg-[var(--p-blue)] text-white rounded-md"
              disabled={!tempSelectedTemplate}
            >
              {riText("Select Template")}
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
                  <p className="text-gray-600">
                    {riText("Loading preview...")}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end mt-4 gap-3">
            <button
              onClick={closeTemplatePreview}
              className="px-4 py-2 border border-gray-300 rounded-md"
            >
              {riText("Close")}
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
              {riText("Use This Template")}
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
      notifyError(riText("Template not found. Please select a template."));
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
        notifyError(riText("Failed to load template details"));
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
      riText(
        "PDF template selected successfully! You can now save or send the invoice.",
      ),
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
        return `<!DOCTYPE html><html><head><title>${riText("Invoice Preview")}</title></head><body><p>${riText("No template content")}</p></body></html>`;
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
          terms: invoiceData?.terms || "Due on Receipt",
          payment: invoiceData?.terms || "Due on Receipt",
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
                    const lineDisplayName =
                      item.itemName ||
                      item.title ||
                      item.name ||
                      (typeof item.item === "string" ? item.item : null) ||
                      item.description ||
                      "Item";
                    const lineDescRaw = item.description ?? "";
                    const mainName = String(lineDisplayName).trim();
                    const descOnly =
                      mainName &&
                      String(lineDescRaw).trim() &&
                      String(lineDescRaw).trim() !== mainName.trim()
                        ? String(lineDescRaw).trim()
                        : "";
                    return {
                      /** Match invoicePayloadToContract + recurring preview */
                      item: mainName,
                      name: mainName,
                      description: descOnly,
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
                    item: "Sample Item",
                    name: "Sample Item",
                    description: "",
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
        return `<!DOCTYPE html><html><head><title>${riText("Preview Error")}</title></head><body><p>${riText("Error rendering template preview. Please try again.")}</p></body></html>`;
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
          notifyError(riText("Failed to load template content"));
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
              title={
                profileId
                  ? riText("Edit recurring invoice")
                  : riText("New recurring invoice")
              }
              showBackButton
              backFallbackPath="/recurring-Invoice"
            />
            {profileBootstrapLoading && (
              <p className="text-sm text-gray-500">
                {riText("Loading profile…")}
              </p>
            )}

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
                      {riText("Business")}{" "}
                      <span className="text-red-500">*</span>
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
                        placeholder={riText("Select Business")}
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
                      {riText("Customer Name")}{" "}
                      <span className="text-red-500">*</span>
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
                                  ?.customerDisplayName
                              : riText("Select Customer")
                          }
                          searchPlaceholder={riText("Search customers...")}
                          disabled={location.state?.contractId}
                          options={
                            customers?.map((customer) => ({
                              value: customer._id,
                              label: getRecurringCustomerPrimaryName(customer),
                              name: getRecurringCustomerPrimaryName(customer),
                              displayName:
                                getRecurringCustomerPrimaryName(customer),
                              secondaryName:
                                getRecurringCustomerSecondaryName(customer),
                              email: customer.basicInformation?.customerEmail,
                            })) || []
                          }
                          searchKeys={["name", "displayName", "email"]}
                          renderSelected={(option) => (
                            <span className="text-gray-900">
                              {option.displayName ||
                                option.name ||
                                option.label}
                            </span>
                          )}
                          renderOption={(option) => (
                            <div>
                              <div className="font-medium text-sm">
                                {option.displayName ||
                                  option.name ||
                                  option.label}
                              </div>
                              {option.secondaryName ? (
                                <div className="text-xs text-gray-500">
                                  {option.secondaryName}
                                </div>
                              ) : null}
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
                            ? riText("Select a business first")
                            : riText("Quick add a new customer")
                        }
                        className="flex items-center justify-center gap-1.5 shrink-0 px-3 py-2.5 text-sm font-medium text-[var(--p-blue)] bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-[var(--p-blue)] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[var(--p-blue)] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-white"
                      >
                        <UserPlus className="w-4 h-4" />
                        {riText("Add")}
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
                          {riText("Address Types Not Configured")}
                        </h3>
                        <p className="text-xs text-gray-500 mb-4">
                          {riText(
                            "You do not have any address type yet. Please add address types in Settings first.",
                          )}
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
                                  {riText("Add {{type}} Address", {
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
                      {riText("Phone")}
                    </label>
                    <input
                      type="text"
                      name="phoneNumber"
                      value={invoiceData.phoneNumber || ""}
                      onChange={handleInputChange}
                      placeholder={riText("Enter phone number")}
                      className="w-full px-3 py-2.5 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {riText("Fax Number")}
                    </label>
                    <input
                      type="text"
                      name="faxNumber"
                      value={invoiceData.faxNumber || ""}
                      onChange={handleInputChange}
                      placeholder={riText("Enter fax number")}
                      className="w-full px-3 py-2.5 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                    />
                  </div>
                </div>

                {/* Order Number, Currency */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {riText("Order Number")}
                    </label>
                    <input
                      type="text"
                      name="orderNumber"
                      value={invoiceData.orderNumber || ""}
                      onChange={handleInputChange}
                      placeholder={riText("Enter order number")}
                      className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {riText("Currency")}
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
                          ? riText("Customer currency will appear here")
                          : riText("Select customer")
                      }
                    />
                  </div>
                </div>

                {/* Invoice Date, Terms, Due Date Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {riText("Invoice Date")}{" "}
                      <span className="text-red-500">*</span>
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
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {riText("Payment Terms")}{" "}
                      <span className="text-red-500">*</span>
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
                        placeholder={riText("Select Payment Term")}
                        searchPlaceholder={riText("Search payment terms...")}
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
                      {riText("Due Date")}{" "}
                      <span className="text-red-500">*</span>
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
                    useBreakpointGrid
                    businessId={invoiceData.business}
                    module="sales"
                    screen="invoice"
                    columns={3}
                    recordId={profileId || undefined}
                    values={recurringCustomFieldValues}
                    onValuesChange={setRecurringCustomFieldValues}
                    headers={headers}
                  />
                ) : null}

                {/* Invoice Type & Contract */}
                {/* <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Invoice Type <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        name="invoiceType"
                        value={invoiceData.invoiceType}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg appearance-none pr-10 focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] bg-white"
                      >
                        <option value="Proforma" disabled={!canCreateProforma}>
                          Proforma {!canCreateProforma ? "(Already exists)" : ""}
                        </option>
                        <option
                          value="Commercial"
                          disabled={!canCreateCommercial}
                        >
                          Commercial{" "}
                          {!canCreateCommercial ? "(Not available)" : ""}
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
              <div className="bg-white rounded-lg overflow-hidden">
                <div className="px-4 sm:px-6 pt-6 pb-4 space-y-4 border-b border-gray-200/80">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:items-end">
                      <div className="min-w-0">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {riText("Invoice recurrence")}{" "}
                          <span className="text-red-500">*</span>
                        </label>
                        <div className="bg-white rounded-lg">
                          <SearchableDropdown
                            value={recurrencePresetId}
                            onChange={(e) => {
                              const v = e.target.value;
                              setRecurrencePresetId(v);
                              if (v) {
                                setFormErrors((prev) => {
                                  const next = { ...prev };
                                  delete next.invoiceRecurrence;
                                  return next;
                                });
                                const p = invoiceRecurrencePresets.find(
                                  (x) => String(x._id) === String(v),
                                );
                                if (p) {
                                  setRepeatEveryInterval(
                                    Math.max(
                                      1,
                                      parseInt(p.repeatInterval, 10) || 1,
                                    ),
                                  );
                                  setRepeatEveryUnit(p.repeatUnit || "month");
                                }
                              }
                            }}
                            placeholder={riText("Select saved schedule")}
                            searchPlaceholder={riText("Search schedules…")}
                            disabled={!invoiceData.business}
                            clearable
                            options={invoiceRecurrencePresets.map((p) => ({
                              value: String(p._id),
                              label: p.name,
                              name: p.name,
                            }))}
                            searchKeys={["name", "label"]}
                            dropdownFooter={
                              <AddInvoiceRecurrenceButton
                                businessId={invoiceData.business}
                                headers={headers}
                                disabled={!invoiceData.business}
                                displayMode="dropdown"
                                onAdded={(row) => {
                                  setInvoiceRecurrencePresets((prev) =>
                                    prev.some((x) => x._id === row._id)
                                      ? prev
                                      : [...prev, row],
                                  );
                                  setRecurrencePresetId(String(row._id));
                                  setFormErrors((prev) => {
                                    const next = { ...prev };
                                    delete next.invoiceRecurrence;
                                    return next;
                                  });
                                  setRepeatEveryInterval(
                                    Math.max(
                                      1,
                                      parseInt(row.repeatInterval, 10) || 1,
                                    ),
                                  );
                                  setRepeatEveryUnit(row.repeatUnit || "month");
                                }}
                              />
                            }
                          />
                        </div>
                        {formErrors.invoiceRecurrence && (
                          <p className="mt-1 text-xs text-red-500">
                            {formErrors.invoiceRecurrence}
                          </p>
                        )}
                      </div>
                      <div className="min-w-0">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {riText("Salesperson")}{" "}
                          <span className="text-gray-400 font-normal">
                            {riText("(optional)")}
                          </span>
                        </label>
                        <div className="bg-white rounded-lg">
                          <SearchableDropdown
                            value={
                              selectedSalesperson?._id != null
                                ? String(selectedSalesperson._id)
                                : ""
                            }
                            onChange={(e) => {
                              const v = e.target.value;
                              if (!v) {
                                setSelectedSalesperson(null);
                                return;
                              }
                              const found = salespersonOptions.find(
                                (x) => String(x._id) === String(v),
                              );
                              if (found) {
                                setSelectedSalesperson({
                                  _id: String(found._id),
                                  name: found.displayName || found.name || "",
                                  displayName:
                                    found.displayName || found.name || "",
                                });
                              } else {
                                setSelectedSalesperson(null);
                              }
                            }}
                            placeholder={riText("Select Salesperson")}
                            searchPlaceholder={riText("Search salespersons...")}
                            disabled={!invoiceData.business}
                            clearable
                            alphabeticalSort={false}
                            options={
                              salespersonOptions?.map((person) => ({
                                value: String(person._id),
                                label: person.displayName || person.name,
                                name: person.displayName || person.name,
                              })) || []
                            }
                            searchKeys={["name"]}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
                      <div className="min-w-0 w-full lg:w-auto lg:min-w-[200px]">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {riText("Start on")}
                        </label>
                        <CustomDatePicker
                          value={recurringStartOn}
                          onChange={(date) =>
                            setRecurringStartOn(toYmdFromPicker(date))
                          }
                          bgColor="#FFFFFF"
                          style={{
                            backgroundColor: "#FFFFFF",
                            border: "1px solid #E5E7EB",
                            borderRadius: "8px",
                          }}
                        />
                        {/* <p className="mt-1 text-xs text-gray-500">
                          {formatYmdLabel(recurringStartOn)}
                        </p> */}
                        {formErrors.recurringStartOn && (
                          <p className="mt-1 text-xs text-red-500">
                            {formErrors.recurringStartOn}
                          </p>
                        )}
                      </div>
                      <div className="min-w-0 w-full lg:w-auto lg:min-w-[200px]">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {riText("End on")}
                        </label>
                        <CustomDatePicker
                          value={recurringNeverExpire ? "" : recurringEndsOn}
                          onChange={(date) =>
                            setRecurringEndsOn(toYmdFromPicker(date))
                          }
                          disabled={recurringNeverExpire}
                          bgColor="#FFFFFF"
                          style={{
                            backgroundColor: "#FFFFFF",
                            border: "1px solid #E5E7EB",
                            borderRadius: "8px",
                          }}
                        />
                        {/* <p className="mt-1 text-xs text-gray-500">
                          {recurringNeverExpire
                            ? "— Not set when “Never expire” is on"
                            : formatYmdLabel(recurringEndsOn) ||
                              "Select end date"}
                        </p> */}
                        {formErrors.recurringEndsOn && (
                          <p className="mt-1 text-xs text-red-500">
                            {formErrors.recurringEndsOn}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center pb-1 lg:pb-3 shrink-0 w-full lg:w-auto">
                        <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={recurringNeverExpire}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setRecurringNeverExpire(checked);
                              if (checked) {
                                setRecurringEndsOn("");
                              } else {
                                setRecurringEndsOn((prev) => {
                                  if (prev) return prev;
                                  if (!recurringStartOn) return "";
                                  const start = new Date(
                                    `${recurringStartOn}T12:00:00`,
                                  );
                                  if (Number.isNaN(start.getTime())) return "";
                                  return formatDateForInput(
                                    addMonths(start, 12),
                                  );
                                });
                              }
                            }}
                            className="rounded border-gray-300 text-[var(--p-blue)] focus:ring-[var(--p-blue)]"
                          />
                          {riText("Never expire")}
                        </label>
                      </div>
                    </div>
                  </div>
                  {/* Doc numbering not configured banner — mirrors CreateCustomerInvoice */}
                  {profileNumberIsFallback && !profileId && (
                    <div className="flex items-center justify-between gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-500" />
                        <span>
                          {riText(
                            "Recurring invoice numbering is not configured for this business group. Numbers will be auto-generated using the Business Group fallback sequence.",
                          )}
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
                          {riText("Configure Now")}
                        </a>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        {riText("Recurring Invoice No")}
                      </label>
                      <input
                        type="text"
                        value={profileNumber}
                        onChange={(e) => setProfileNumber(e.target.value)}
                        readOnly={!!profileId}
                        placeholder={riText("RINV-000001")}
                        className={`w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] ${
                          profileId ? "bg-gray-50 text-gray-700" : ""
                        }`}
                      />
                      {profileId ? (
                        <p className="mt-1.5 text-xs text-gray-500">
                          {riText(
                            "System-assigned profile number (immutable after save).",
                          )}
                        </p>
                      ) : null}
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        {riText("Profile name")}
                      </label>
                      <input
                        type="text"
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        placeholder={riText("e.g. Acme monthly retainer")}
                        className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        {riText("Subject")}
                      </label>
                      <textarea
                        name="subject"
                        value={invoiceData.subject ?? ""}
                        placeholder={riText(
                          "e.g. Monthly subscription invoice",
                        )}
                        onChange={handleInputChange}
                        rows={4}
                        className="w-full min-h-[6rem] px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] resize-y"
                      />
                      <p className="mt-1.5 text-xs text-gray-500">
                        {riText("Will be displayed on the invoice")}
                      </p>
                    </div>
                  </div>
                </div>
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
                  onTaxCreated={(newTax) => {
                    if (!newTax?._id) return;
                    setTaxes((prev) =>
                      prev.some((t) => String(t._id) === String(newTax._id))
                        ? prev
                        : [...prev, newTax],
                    );
                  }}
                  lineItemCustomFieldDefinitions={lineItemCustomFieldDefs}
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
                    {riText("Customer Notes")}
                  </label>
                  <textarea
                    name="customerNotes"
                    value={invoiceData.customerNotes ?? ""}
                    placeholder={riText("Thanks for your business.")}
                    onChange={handleInputChange}
                    rows={4}
                    className="w-full min-h-[6rem] px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] resize-y"
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    {riText("Will be displayed on the invoice")}
                  </p>

                  {/* Save preference — full-width control (same pattern as Terms) */}
                  <div className="mt-4 pt-4 border-t-2 border-gray-200">
                    <label
                      htmlFor="recurring-save-preference-trigger"
                      className="block text-sm font-semibold text-gray-900 mb-2"
                    >
                      {riText("Save preference")}
                    </label>
                    <p className="text-xs text-gray-500 mb-2">
                      {riText("Choose what happens when you use Save below.")}
                    </p>
                    <div
                      className={`relative transition-[padding-bottom] duration-150 ${
                        saveActionMenuOpen
                          ? "pb-[220px] sm:pb-[200px] mb-2"
                          : ""
                      }`}
                      ref={saveActionMenuRef}
                    >
                      <button
                        id="recurring-save-preference-trigger"
                        type="button"
                        aria-label={riText("Open save preference options")}
                        aria-expanded={saveActionMenuOpen}
                        aria-haspopup="listbox"
                        onClick={() => setSaveActionMenuOpen((o) => !o)}
                        className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-sm border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] bg-white text-left shadow-sm hover:border-gray-400 transition-colors"
                      >
                        <span className="flex items-start gap-2.5 min-w-0">
                          {recurringSaveAction === "draft" ? (
                            <Save className="h-4 w-4 shrink-0 mt-0.5 text-[var(--p-blue)]" />
                          ) : (
                            <Mail className="h-4 w-4 shrink-0 mt-0.5 text-[var(--p-blue)]" />
                          )}
                          <span className="min-w-0">
                            <span className="block font-medium text-gray-900">
                              {recurringSaveAction === "draft"
                                ? riText("Save as draft")
                                : riText("Save and send")}
                            </span>
                            <span className="block text-xs text-gray-500 mt-0.5 leading-snug">
                              {recurringSaveAction === "draft"
                                ? riText(
                                    "New invoices from this profile stay as drafts until you send them.",
                                  )
                                : riText(
                                    "Email the customer when invoices are generated (needs a valid customer email).",
                                  )}
                            </span>
                          </span>
                        </span>
                        <ChevronDown
                          className={`w-5 h-5 text-gray-600 shrink-0 transition-transform ${saveActionMenuOpen ? "rotate-180" : ""}`}
                        />
                      </button>
                      {saveActionMenuOpen && (
                        <div
                          className="absolute z-50 mt-2 w-full rounded-lg border-2 border-gray-200 bg-white shadow-sm py-1 overflow-hidden"
                          role="listbox"
                        >
                          <button
                            type="button"
                            role="option"
                            aria-selected={recurringSaveAction === "draft"}
                            className={`flex w-full items-start gap-3 px-3 py-3 text-left border-b border-gray-100 last:border-b-0 ${
                              recurringSaveAction === "draft"
                                ? "bg-orange-50"
                                : "hover:bg-gray-50"
                            }`}
                            onClick={() => {
                              setRecurringSaveAction("draft");
                              setSaveActionMenuOpen(false);
                            }}
                          >
                            <Save className="h-4 w-4 shrink-0 mt-0.5 text-[var(--p-blue)]" />
                            <span>
                              <span className="block text-sm font-semibold text-gray-900">
                                {riText("Save as draft")}
                              </span>
                              <span className="block text-xs text-gray-600 mt-1 leading-snug">
                                {riText(
                                  "Keep generated invoices as drafts; send them manually when ready.",
                                )}
                              </span>
                            </span>
                          </button>
                          <button
                            type="button"
                            role="option"
                            aria-selected={recurringSaveAction === "send"}
                            className={`flex w-full items-start gap-3 px-3 py-3 text-left ${
                              recurringSaveAction === "send"
                                ? "bg-orange-50"
                                : "hover:bg-gray-50"
                            }`}
                            onClick={() => {
                              setRecurringSaveAction("send");
                              setSaveActionMenuOpen(false);
                            }}
                          >
                            <Mail className="h-4 w-4 shrink-0 mt-0.5 text-[var(--p-blue)]" />
                            <span>
                              <span className="block text-sm font-semibold text-gray-900">
                                {riText("Save and send")}
                              </span>
                              <span className="block text-xs text-gray-600 mt-1 leading-snug">
                                {riText(
                                  "Email the customer when each invoice is created from this schedule.",
                                )}
                              </span>
                            </span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Terms & Conditions */}
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                  <label className="block text-sm font-semibold text-gray-900 mb-3">
                    {riText("Terms & Conditions")}
                  </label>
                  <div className="flex gap-2 mb-3 items-center">
                    <div className="flex-1 relative" ref={termsDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setTermsDropdownOpen((o) => !o)}
                        className="w-full flex items-center justify-between px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] bg-white text-left"
                      >
                        <span
                          className={
                            selectedTermsValue
                              ? "text-gray-900"
                              : "text-gray-500"
                          }
                        >
                          {selectedTermsLabel ??
                            riText("Select terms and Conditions")}
                        </span>
                        <ChevronDown
                          className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform ${termsDropdownOpen ? "rotate-180" : ""}`}
                        />
                      </button>
                      {termsDropdownOpen && (
                        <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg py-1 max-h-60 overflow-auto">
                          {businessData?.termsAndConditions ? (
                            <button
                              type="button"
                              onClick={() => handleTermsSelect("__default__")}
                              className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${selectedTermsValue === "__default__" ? "bg-blue-50 text-[var(--p-blue)]" : "text-gray-900"}`}
                            >
                              {riText("Default")}
                            </button>
                          ) : null}
                          {termsAndConditionsList.map((t) => (
                            <button
                              key={t._id}
                              type="button"
                              onClick={() => handleTermsSelect(`item_${t._id}`)}
                              className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${selectedTermsValue === `item_${t._id}` ? "bg-blue-50 text-[var(--p-blue)]" : "text-gray-900"}`}
                            >
                              {t.name || riText("Terms")}
                            </button>
                          ))}
                          {(businessData?.termsTemplates || []).map((t, i) => (
                            <button
                              key={`tpl-${i}`}
                              type="button"
                              onClick={() => handleTermsSelect(`tpl_${i}`)}
                              className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${selectedTermsValue === `tpl_${i}` ? "bg-blue-50 text-[var(--p-blue)]" : "text-gray-900"}`}
                            >
                              {t.name ||
                                riText("Terms {{number}}", { number: i + 1 })}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => handleTermsSelect("__add_new__")}
                            className="w-full px-3 py-2 text-left text-sm text-[var(--p-blue)] hover:bg-blue-50 border-t border-gray-100 mt-1"
                          >
                            {riText("Add new")}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  {invoiceData.termsAndConditions ? (
                    <>
                      <textarea
                        name="termsAndConditions"
                        value={invoiceData.termsAndConditions || ""}
                        onChange={handleInputChange}
                        rows={4}
                        placeholder={riText(
                          "Terms content (editable after selection)",
                        )}
                        className="w-full min-h-[6rem] px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] resize-y"
                      />
                      <p className="mt-2 text-xs text-gray-500">
                        {riText(
                          "Terms appear on the invoice preview and PDF. Edit above if needed.",
                        )}
                      </p>
                    </>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Contract Information Display */}
            {selectedContract && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-blue-900 mb-2">
                      {riText("Contract Information")}
                    </h3>
                    {isCalculatingDetails ? (
                      <div className="flex items-center gap-2 text-sm text-blue-700">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        {riText("Calculating contract details...")}
                      </div>
                    ) : (
                      <div className="space-y-1 text-sm text-blue-800">
                        <p>
                          <span className="font-medium">
                            {riText("Contract Total:")}
                          </span>{" "}
                          {formatCurrencyAmount(
                            invoiceData.currency,
                            contractDetails.totalAmount ?? 0,
                          )}
                        </p>
                        {contractDetails.depositPercentage > 0 && (
                          <p>
                            <span className="font-medium">
                              {riText("Deposit:")}
                            </span>{" "}
                            {contractDetails.depositPercentage}% (
                            {formatCurrencyAmount(
                              invoiceData.currency,
                              contractDetails.depositAmount ?? 0,
                            )}
                            )
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
                    Template
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
                    Choose Template
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
                          Deposit Required
                        </p>
                        <p className="text-xs text-green-700 mt-1">
                          {contractDetails.depositPercentage}% of contract total
                        </p>
                        <p className="text-lg font-bold text-green-900 mt-2">
                          {formatCurrencyAmount(
                            invoiceData.currency,
                            contractDetails.depositAmount ?? 0,
                          )}
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
                          Advance Payments Applied
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Template selection - Left Side */}
            <div className="flex items-center gap-3 min-w-0">
              {DocumentData?.s3Key || DocumentData?.url ? (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg">
                    <FileText className="w-4 h-4" />
                    <span>{riText("Selected Template")}</span>
                    <button
                      type="button"
                      onClick={() => setIsViewerOpen(true)}
                      className="text-green-700 hover:text-green-900 underline"
                    >
                      {riText("View")}
                    </button>
                  </div>
                </div>
              ) : selectedTemplateId ? (
                <div className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg">
                  <FileText className="w-4 h-4" />
                  <span>
                    {riText("Template: {{name}}", {
                      name:
                        selectedTemplate?.name ||
                        invoiceData?.template ||
                        riText("Selected"),
                    })}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(true)}
                    className="text-green-700 hover:text-green-900 underline"
                  >
                    {riText("Change")}
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
                  {riText("Select PDF Template")}
                </button>
              )}
            </div>

            {/* Save / Cancel — uses Preference under Customer Notes */}
            <div className="flex items-center justify-end gap-3 shrink-0 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => history.push("/recurring-Invoice")}
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {riText("Cancel")}
              </button>
              <button
                type="button"
                onClick={() => handleSubmit(recurringSaveAction)}
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-[var(--p-blue)] rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <span className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {riText("Saving…")}
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 shrink-0" />
                    {riText("Save")}
                  </>
                )}
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
            ? riText("Commercial Invoice")
            : riText("Proforma Invoice")
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
          savedRecordIdForPdf={profileId || undefined}
          pdfModule="sales"
          pdfScreen="invoice"
          documentCustomFieldDefinitions={invoiceCustomFieldDefinitions}
          documentCustomFieldValues={recurringCustomFieldValues}
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
      {/* Add new Terms & Conditions modal */}
      {addTermsModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => !savingNewTerm && setAddTermsModalOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {riText("Add new Terms & Conditions")}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {riText("Name")}
                </label>
                <input
                  type="text"
                  value={newTermName}
                  onChange={(e) => setNewTermName(e.target.value)}
                  placeholder={riText("e.g. Standard, Net 30")}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {riText("Content")}
                </label>
                <textarea
                  value={newTermContent}
                  onChange={(e) => setNewTermContent(e.target.value)}
                  rows={6}
                  placeholder={riText("Enter terms and conditions text...")}
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
                {riText("Cancel")}
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!newTermName.trim() || !invoiceData.business) return;
                  setSavingNewTerm(true);
                  try {
                    await axios.post(
                      `${Base_URL}/items/Terms and Conditions/add`,
                      {
                        name: newTermName.trim(),
                        content: newTermContent.trim(),
                        status: "active",
                        business_id: invoiceData.business,
                      },
                      { headers },
                    );
                    const res = await axios.post(
                      `${Base_URL}/items/Terms and Conditions/get_all`,
                      {
                        business_id: invoiceData.business,
                        FilterStatus: "active",
                        FilterName: "",
                      },
                      { headers },
                    );
                    setTermsAndConditionsList(
                      res.data?.success ? res.data.data || [] : [],
                    );
                    setInvoiceData((prev) => ({
                      ...prev,
                      termsAndConditions: newTermContent.trim(),
                    }));
                    setAddTermsModalOpen(false);
                    setNewTermName("");
                    setNewTermContent("");
                    notifySuccess(riText("Success"));
                  } catch (err) {
                    console.error("Error saving terms:", err);
                    notifyError(
                      err.response?.data?.message ||
                        riText("Failed to save terms."),
                    );
                  } finally {
                    setSavingNewTerm(false);
                  }
                }}
                disabled={savingNewTerm || !newTermName.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-[var(--p-blue)] rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                {savingNewTerm ? riText("Saving...") : riText("Save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CreateRecurringInvoice;
