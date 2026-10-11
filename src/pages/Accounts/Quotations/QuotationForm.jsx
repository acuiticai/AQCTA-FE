import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useHistory, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { AlertCircle, File, FileText, Paperclip, Plus, Save, Send, Upload, X } from "lucide-react";
import SearchableDropdown from "@/components/SearchableDropdown";
import DropdownBasic from "@/page-layouts/components/DropdownBasic";
import CustomDatePicker from "@/components/CustomDatePicker";
import AddressModal from "@/components/AddressModal";
import CustomerBillShipAddressFields from "@/components/CustomerBillShipAddressFields";
import ZohoStyleItemTable from "@/components/invoice/ZohoStyleItemTable";
import InvoiceSummaryPanel from "@/components/invoice/InvoiceSummaryPanel";
import { AdminContext } from "@/context/AdminContext";
import { notifyError, notifySuccess } from "@/utils/toast";
import QuotationServices from "@/services/QuotationServices";
import { getNextDocumentNumber } from "@/services/documentSequenceServices";
import { PageHeader } from "@/page-layouts/index";
import { formatDateToYMD, getCurrencyDisplay } from "@/components/formatAmount";
import {
  buildMissingCustomerAddressMessage,
  fetchAddressTypeConfig,
  getMissingBillShipTypesForCustomerDisplay,
  missingBillShipSectionTitle,
  resolveSameAsBillingFlag,
} from "@/utils/addressTypeUtils";
import DocumentTermsAndConditionsSection from "@/components/documents/DocumentTermsAndConditionsSection";
import DocumentTemplateModal from "@/pages/SalesContract/actions/DocumentTemplates";
import {
  fetchBusinessTemplateAssignments,
  uniqueTemplateObjectsFromAssignments,
  pickDefaultTemplateFromAssignments,
  fetchDocumentTemplateById,
} from "@/services/documentTemplateService";
import { isQuotationDocumentTemplateType } from "@/utils/invoiceContractMapper";
import SingleBusinessField from "@/components/SingleBusinessField";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const emptyItem = {
  id: 1,
  itemId: "",
  itemName: "",
  description: "",
  quantity: 1,
  unitPrice: 0,
  discount: 0,
  taxId: "",
  taxRate: 0,
  taxName: "",
  total: 0,
  lineItemCustomFields: {},
};

const toDateInputValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const getCustomerName = (customer) =>
  customer?.basicInformation?.customerDisplayName ||
  customer?.basicInformation?.companyName ||
  customer?.companyInfo?.companyName ||
  "";

const getAddressString = (customer, type) => {
  const direct =
    type === "billing"
      ? customer?.companyInfo?.billingAddress
      : customer?.companyInfo?.shippingAddress;
  if (direct) return direct;

  const address = (customer?.addresses || []).find((item) =>
    String(item?.addressType || "").toLowerCase().includes(type),
  );
  if (!address) return "";
  return [
    address.addressLine1,
    address.addressLine2,
    address.city,
    address.state,
    address.zipCode,
    address.country,
  ]
    .filter(Boolean)
    .join(", ");
};

const getCustomerCurrencyCode = (customer) => {
  if (!customer?.basicInformation?.currency) return "";
  const c = customer.basicInformation.currency;
  if (typeof c === "string") return c;
  return c.code || c.currencyCode || (typeof c.symbol === "string" ? c.symbol : "") || "";
};

const normalizeItems = (items = []) =>
  (items.length ? items : [emptyItem]).map((item, index) => ({
    id: item.id || item._id || index + 1,
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
    unit: item.unit || "",
    itemType: item.itemType || "",
    expenseAccount: item.expenseAccount?._id || item.expenseAccount || "",
    total: Number(item.total ?? item.totalValue ?? item.amount) || 0,
    lineItemCustomFields: item.lineItemCustomFields || {},
  }));

/** Matches backend `sanitizeItems`: line must identify a product/description and have qty > 0. */
const lineHasLabel = (item) => {
  if (!item) return false;
  const label = String(
    item.description || item.itemName || item.title || "",
  ).trim();
  if (label) return true;
  const id = item.itemId;
  if (id && typeof id === "object" && id._id) return true;
  return Boolean(id);
};

const isValidQuotationLine = (item) =>
  lineHasLabel(item) && Number(item.quantity) > 0;

const calculateTaxTotal = (items = []) =>
  items.reduce((sum, item) => {
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.unitPrice) || 0;
    const discount = Number(item.discount) || 0;
    const taxRate = Number(item.taxRate) || 0;
    const lineBase = quantity * unitPrice;
    const lineDiscount = (lineBase * discount) / 100;
    return sum + ((lineBase - lineDiscount) * taxRate) / 100;
  }, 0);

export default function QuotationForm({ mode = "create" }) {
  const { t } = useTranslation();
  const isEditMode = mode === "edit";
  const { id } = useParams();
  const history = useHistory();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo?.token}`,
    }),
    [adminInfo?.token],
  );

  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [businesses, setBusinesses] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [businessItems, setBusinessItems] = useState([]);
  const [taxes, setTaxes] = useState([]);
  const [expenseAccounts, setExpenseAccounts] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [errors, setErrors] = useState({});
  const fileInputRef = useRef(null);
  const lastDistinctShippingAddressRef = useRef("");
  const [uploading, setUploading] = useState(false);
  const [baseCurrency, setBaseCurrency] = useState("USD");
  const [currenciesList, setCurrenciesList] = useState([]);
  const [docNumMissing, setDocNumMissing] = useState(false);
  const [businessData, setBusinessData] = useState(null);
  const [termsAndConditionsList, setTermsAndConditionsList] = useState([]);
  const [quotationTemplateAssignments, setQuotationTemplateAssignments] = useState([]);
  const [quotationTemplates, setQuotationTemplates] = useState([]);
  const [selectedQuoteTemplate, setSelectedQuoteTemplate] = useState(null);
  const [selectedQuoteTemplateId, setSelectedQuoteTemplateId] = useState(null);
  const [isQuoteTemplateModalOpen, setIsQuoteTemplateModalOpen] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [addressModalType, setAddressModalType] = useState("Billing");
  const [addressTypeConfig, setAddressTypeConfig] = useState({
    billingLabel: t("common.billing", { defaultValue: "Billing" }),
    shippingLabel: t("common.shipping", { defaultValue: "Shipping" }),
  });
  const [editingAddress, setEditingAddress] = useState(null);
  const [quotationData, setQuotationData] = useState({
    business: "",
    customer: "",
    quoteNumber: "",
    quoteDate: new Date().toISOString().slice(0, 10),
    expiryDate: "",
    billingAddress: "",
    shippingAddress: "",
    sameAsBilling: false,
    subject: "",
    items: [emptyItem],
    subtotal: 0,
    discountPercentage: 0,
    discountAmount: 0,
    shippingCharges: 0,
    adjustment: 0,
    taxTotal: 0,
    total: 0,
    currency: "",
    customerNotes: "",
    termsAndConditions: "",
    terms: "",
    status: "draft",
    supportingDocuments: [],
    templateId: "",
    templateName: "",
  });

  useEffect(() => {
    const loadAddressTypes = async () => {
      const businessId = quotationData.business || businessData?._id;
      const config = await fetchAddressTypeConfig(businessId, headers);
      setAddressTypeConfig({
        ...config,
        billingLabel:
          config?.billingLabel === "Billing"
            ? t("common.billing", { defaultValue: "Billing" })
            : config?.billingLabel,
        shippingLabel:
          config?.shippingLabel === "Shipping"
            ? t("common.shipping", { defaultValue: "Shipping" })
            : config?.shippingLabel,
      });
    };
    loadAddressTypes();
  }, [quotationData.business, businessData?._id, headers, t]);

  const displayCurrencyLabel = useMemo(() => {
    if (!quotationData.business) return "";
    const fromCustomer = selectedCustomer?.basicInformation?.currency;
    if (fromCustomer != null) {
      const r = getCurrencyDisplay(fromCustomer, currenciesList);
      if (r && r !== "—") return r;
    }
    if (quotationData.currency) {
      const r = getCurrencyDisplay(quotationData.currency, currenciesList);
      if (r && r !== "—") return r;
    }
    return baseCurrency || "";
  }, [
    quotationData.business,
    quotationData.currency,
    selectedCustomer,
    currenciesList,
    baseCurrency,
  ]);

  useEffect(() => {
    const bizId = quotationData.business;
    if (!bizId) return;
    let cancelled = false;
    (async () => {
      try {
        const currencyResponse = await axios.get(`${Base_URL}/finance/currencies`, {
          params: { business_id: bizId },
        });
        const currencies = currencyResponse?.data?.data || [];
        const base = currencies.find((c) => c.is_base === true);
        const code = base?.symbol || base?.prefix || base?.code || base?.name || "USD";
        if (!cancelled) {
          setCurrenciesList(currencies);
          setBaseCurrency(code);
        }
      } catch {
        if (!cancelled) {
          setCurrenciesList([]);
          setBaseCurrency("USD");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [quotationData.business]);

  useEffect(() => {
    const applyBusinessList = (list) => {
      const safe = Array.isArray(list) ? list : [];
      setBusinesses(safe);
      if (!isEditMode && safe[0]?._id) {
        setQuotationData((prev) => ({ ...prev, business: prev.business || safe[0]._id }));
      }
    };

    const fetchBusinesses = async () => {
      if (adminInfo?.id) {
        try {
          const response = await axios.get(`${Base_URL}/admin/assigned/${adminInfo.id}`, {
            headers,
          });
          const list = response.data?.businesses || [];
          applyBusinessList(list);
          if (list.length) {
            try {
              localStorage.setItem("businesses", JSON.stringify(list));
            } catch {
              /* ignore quota */
            }
          }
        } catch (error) {
          console.error("QuotationForm: assigned businesses:", error);
          const stored = localStorage.getItem("businesses");
          if (stored) {
            try {
              applyBusinessList(JSON.parse(stored));
            } catch {
              applyBusinessList([]);
            }
            notifyError(
              error.response?.data?.message ||
                t("accounts.quotations.messages.businessesCached", {
                  defaultValue:
                    "Could not refresh businesses from server; showing cached list.",
                }),
            );
          } else {
            applyBusinessList([]);
            notifyError(
              error.response?.data?.message ||
                t("accounts.quotations.messages.businessesLoadFailed", {
                  defaultValue: "Failed to load businesses. Please sign in again.",
                }),
            );
          }
        }
        return;
      }

      const storedBusinesses = localStorage.getItem("businesses");
      if (storedBusinesses) {
        try {
          applyBusinessList(JSON.parse(storedBusinesses));
        } catch {
          applyBusinessList([]);
          notifyError(
            t("accounts.quotations.messages.invalidCachedBusinesses", {
              defaultValue: "Invalid cached businesses data.",
            }),
          );
        }
      } else {
        applyBusinessList([]);
      }
    };

    fetchBusinesses();
  }, [adminInfo?.id, headers, isEditMode]);

  useEffect(() => {
    const fetchQuotation = async () => {
      if (!isEditMode || !id) return;
      try {
        setLoading(true);
        const response = await QuotationServices.getQuotationById(id);
        const quote = response.data?.data;
        if (!quote)
          throw new Error(
            t("accounts.quotations.messages.notFound", {
              defaultValue: "Quotation not found",
            }),
          );
        const customer = quote.customer_id && typeof quote.customer_id === "object"
          ? quote.customer_id
          : null;
        setSelectedCustomer(customer);
        const billingLine = (quote.billingAddress || "").replace(/\n/g, ", ");
        const shippingLine = (quote.shippingAddress || "").replace(/\n/g, ", ");
        const resolvedSameAs = resolveSameAsBillingFlag(
          quote.sameAsBilling,
          billingLine,
          shippingLine,
        );
        lastDistinctShippingAddressRef.current = shippingLine || "";
        setQuotationData({
          business: quote.business_id?._id || quote.business_id || "",
          customer: quote.customer_id?._id || quote.customer_id || "",
          quoteNumber: quote.quote_number || "",
          quoteDate: toDateInputValue(quote.quote_date),
          expiryDate: toDateInputValue(quote.expiry_date),
          billingAddress: billingLine,
          shippingAddress: resolvedSameAs
            ? billingLine
            : shippingLine,
          sameAsBilling: resolvedSameAs,
          subject: quote.subject || "",
          items: normalizeItems(quote.items),
          subtotal: Number(quote.subTotal) || 0,
          discountPercentage: Number(quote.discount) || 0,
          discountAmount: Number(quote.discountAmount) || 0,
          shippingCharges: Number(quote.shippingCharges) || 0,
          adjustment: Number(quote.adjustment) || 0,
          taxTotal: Number(quote.taxTotal) || calculateTaxTotal(quote.items),
          total: Number(quote.grandTotal) || 0,
          currency: quote.currency || "USD",
          customerNotes: quote.customerNotes || "",
          termsAndConditions: quote.termsAndConditions || "",
          terms: quote.terms || "",
          status: quote.status || "draft",
          supportingDocuments: Array.isArray(quote.supportingDocuments)
            ? quote.supportingDocuments
            : [],
          templateId: quote.templateId?._id || quote.templateId || "",
          templateName: quote.templateName || quote.templateId?.name || "",
        });
      } catch (error) {
        notifyError(
          error.response?.data?.message ||
            t("accounts.quotations.messages.loadFailed", {
              defaultValue: "Failed to load quotation",
            }),
        );
        history.push("/quotations");
      } finally {
        setLoading(false);
      }
    };

    fetchQuotation();
  }, [history, id, isEditMode]);

  useEffect(() => {
    const businessId = quotationData.business;
    if (!businessId) {
      setCustomers([]);
      setBusinessItems([]);
      setTaxes([]);
      return;
    }

    const fetchBusinessData = async () => {
      try {
        const [customersRes, itemsRes, taxesRes, accountsRes] = await Promise.all([
          axios.get(`${Base_URL}/customers`, { params: { businessId } }),
          axios.get(`${Base_URL}/items`, { params: { businessId, limit: 1000 } }),
          axios.get(`${Base_URL}/taxes?business=${businessId}`),
          axios.get(`${Base_URL}/accounts`, { params: { business: businessId } }),
        ]);

        setCustomers(customersRes.data?.customers || []);
        setBusinessItems(itemsRes.data?.items || itemsRes.data || []);
        setTaxes(Array.isArray(taxesRes.data) ? taxesRes.data : taxesRes.data?.data || []);
        setExpenseAccounts(accountsRes.data?.data || accountsRes.data || []);
      } catch (error) {
        setCustomers([]);
        setBusinessItems([]);
        setTaxes([]);
        setExpenseAccounts([]);
      }
    };

    fetchBusinessData();
  }, [quotationData.business]);

  useEffect(() => {
    const businessId = quotationData.business;
    if (!businessId) {
      setBusinessData(null);
      return;
    }
    const fetchBusinessData = async () => {
      try {
        const response = await axios.get(`${Base_URL}/business/${businessId}`, { headers });
        setBusinessData(response.data?.data || null);
        setQuotationData((prev) => {
          if (!prev.termsAndConditions && response.data?.data?.termsAndConditions) {
            return {
              ...prev,
              termsAndConditions: response.data.data.termsAndConditions,
            };
          }
          return prev;
        });
      } catch {
        setBusinessData(null);
      }
    };
    fetchBusinessData();
  }, [quotationData.business, headers]);

  useEffect(() => {
    const businessId = quotationData.business;
    if (!businessId) {
      setTermsAndConditionsList([]);
      return;
    }
    const fetchTermsAndConditions = async () => {
      try {
        const response = await axios.post(
          `${Base_URL}/items/Terms and Conditions/get_all`,
          { business_id: businessId, FilterStatus: "active", FilterName: "" },
          { headers },
        );
        setTermsAndConditionsList(response.data?.success ? response.data.data || [] : []);
      } catch {
        setTermsAndConditionsList([]);
      }
    };
    fetchTermsAndConditions();
  }, [quotationData.business, headers]);

  useEffect(() => {
    const businessId = quotationData.business;
    if (!businessId) {
      setQuotationTemplates([]);
      setQuotationTemplateAssignments([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const assignments = await fetchBusinessTemplateAssignments(businessId, headers);
        if (cancelled) return;
        setQuotationTemplateAssignments(assignments);
        setQuotationTemplates(
          uniqueTemplateObjectsFromAssignments(assignments, isQuotationDocumentTemplateType),
        );
      } catch {
        if (!cancelled) {
          setQuotationTemplates([]);
          setQuotationTemplateAssignments([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [quotationData.business, headers]);

  useEffect(() => {
    if (isEditMode) return;
    if (!quotationData.business || quotationData.templateId) return;
    if (!quotationTemplates.length) return;
    const def = pickDefaultTemplateFromAssignments(
      quotationTemplateAssignments,
      isQuotationDocumentTemplateType,
    );
    const chosen =
      def && quotationTemplates.some((t) => String(t._id) === String(def._id))
        ? def
        : quotationTemplates[0];
    if (!chosen) return;
    const tid = chosen._id || chosen.id;
    setSelectedQuoteTemplate(chosen);
    setSelectedQuoteTemplateId(tid);
    setQuotationData((prev) => ({
      ...prev,
      templateId: tid,
      templateName: chosen.name || "",
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only auto-fill when no template yet
  }, [isEditMode, quotationData.business, quotationData.templateId, quotationTemplates, quotationTemplateAssignments]);

  useEffect(() => {
    if (!isEditMode || !quotationData.templateId || !quotationData.business) return;
    let cancelled = false;
    const tid = quotationData.templateId;
    (async () => {
      const fromList = quotationTemplates.find((t) => String(t._id || t.id) === String(tid));
      if (fromList) {
        if (!cancelled) {
          setSelectedQuoteTemplate(fromList);
          setSelectedQuoteTemplateId(fromList._id || fromList.id);
        }
        return;
      }
      try {
        const t = await fetchDocumentTemplateById(tid, headers);
        if (!cancelled && t) {
          setSelectedQuoteTemplate(t);
          setSelectedQuoteTemplateId(t._id || tid);
        }
      } catch {
        /* keep form usable */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEditMode, quotationData.templateId, quotationData.business, quotationTemplates, headers]);

  const selectedBusiness = useMemo(
    () => businesses.find((b) => String(b._id) === String(quotationData.business)),
    [businesses, quotationData.business],
  );

  useEffect(() => {
    const previewQuoteNumber = async () => {
      if (isEditMode || !quotationData.business || quotationData.quoteNumber) return;
      try {
        const businessGroupId =
          selectedBusiness?.businessGroup?._id || selectedBusiness?.businessGroup || null;
        const response = await getNextDocumentNumber(
          "quotation",
          quotationData.business,
          businessGroupId,
        );
        const nextNum =
          response.data?.nextNumber ||
          response.data?.data?.nextNumber ||
          "";
        setDocNumMissing(response.data?.isFallback === true);
        if (nextNum) {
          setQuotationData((prev) => ({ ...prev, quoteNumber: nextNum }));
        }
      } catch {
        setQuotationData((prev) => ({
          ...prev,
          quoteNumber: prev.quoteNumber || "QT-000001",
        }));
      }
    };
    previewQuoteNumber();
  }, [isEditMode, quotationData.business, quotationData.quoteNumber, selectedBusiness]);

  useEffect(() => {
    const taxTotal = calculateTaxTotal(quotationData.items);
    setQuotationData((prev) => {
      const discountAmount = ((Number(prev.subtotal) || 0) * (Number(prev.discountPercentage) || 0)) / 100;
      const total = Math.max(
        0,
        (Number(prev.subtotal) || 0) -
          discountAmount +
          (Number(prev.shippingCharges) || 0) +
          (Number(prev.adjustment) || 0),
      );
      if (
        Math.abs((Number(prev.taxTotal) || 0) - taxTotal) < 0.01 &&
        Math.abs((Number(prev.discountAmount) || 0) - discountAmount) < 0.01 &&
        Math.abs((Number(prev.total) || 0) - total) < 0.01
      ) {
        return prev;
      }
      return { ...prev, taxTotal, discountAmount, total };
    });
  }, [
    quotationData.items,
    quotationData.subtotal,
    quotationData.discountPercentage,
    quotationData.shippingCharges,
    quotationData.adjustment,
  ]);

  const businessOptions = businesses.map((business) => ({
    value: business._id,
    label: business.name,
    name: business.name,
  }));

  const customerOptions = customers.map((customer) => ({
    value: customer._id,
    label: customer.basicInformation?.companyName || getCustomerName(customer),
    name: customer.basicInformation?.companyName || getCustomerName(customer),
    displayName: customer.basicInformation?.customerDisplayName,
    email: customer.basicInformation?.customerEmail,
  }));

  const handleBusinessChange = (value) => {
    setSelectedCustomer(null);
    lastDistinctShippingAddressRef.current = "";
    setSelectedQuoteTemplate(null);
    setSelectedQuoteTemplateId(null);
    setQuotationData((prev) => ({
      ...prev,
      business: value,
      customer: "",
      quoteNumber: "",
      billingAddress: "",
      shippingAddress: "",
      sameAsBilling: false,
      currency: "",
      items: [emptyItem],
      supportingDocuments: [],
      templateId: "",
      templateName: "",
    }));
  };

  const handleCustomerChange = async (event) => {
    const customerId = event.target.value;
    try {
      const response = await axios.get(`${Base_URL}/customers/${customerId}`, { headers });
      const customer = response.data;
      setSelectedCustomer(customer);
      const billing = getAddressString(customer, "billing");
      const shipping = getAddressString(customer, "shipping");
      lastDistinctShippingAddressRef.current = shipping || "";
      setQuotationData((prev) => ({
        ...prev,
        customer: customerId,
        billingAddress: billing,
        shippingAddress: shipping,
        sameAsBilling: false,
        currency:
          getCustomerCurrencyCode(customer) ||
          prev.currency ||
          baseCurrency ||
          "USD",
      }));
    } catch (error) {
      notifyError(
        t("accounts.quotations.messages.customerLoadFailed", {
          defaultValue: "Failed to load customer details",
        }),
      );
    }
  };

  const validate = (options = {}) => {
    const { requireTemplate = true } = options;
    const nextErrors = {};
    if (!quotationData.business)
      nextErrors.business = t("accounts.quotations.validation.businessRequired", {
        defaultValue: "Business is required.",
      });
    if (!quotationData.customer)
      nextErrors.customer = t("accounts.quotations.validation.customerRequired", {
        defaultValue: "Customer is required.",
      });
    if (!quotationData.quoteDate)
      nextErrors.quoteDate = t("accounts.quotations.validation.quoteDateRequired", {
        defaultValue: "Quote date is required.",
      });
    if (!quotationData.expiryDate)
      nextErrors.expiryDate = t("accounts.quotations.validation.expiryDateRequired", {
        defaultValue: "Expiry date is required.",
      });
    if (!quotationData.items.some(isValidQuotationLine)) {
      nextErrors.items =
        t("accounts.quotations.validation.lineRequired", {
          defaultValue:
            "Add at least one line with a product or description and quantity greater than zero.",
        });
    }
    if (requireTemplate && !quotationData.templateId) {
      nextErrors.template = t("accounts.quotations.validation.templateRequired", {
        defaultValue: "Select a quotation document template.",
      });
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const buildPayload = (statusOverride) => ({
    quote_number: quotationData.quoteNumber,
    business_id: quotationData.business,
    customer_id: quotationData.customer,
    customer_name: selectedCustomer ? getCustomerName(selectedCustomer) : "",
    customer_email: selectedCustomer?.basicInformation?.customerEmail || "",
    quote_date: quotationData.quoteDate,
    expiry_date: quotationData.expiryDate,
    billingAddress: quotationData.billingAddress,
    shippingAddress: quotationData.shippingAddress,
    sameAsBilling: quotationData.sameAsBilling,
    subject: quotationData.subject,
    items: quotationData.items.map((item) => ({
      ...item,
      title: item.itemName || item.description,
      totalValue: item.total,
      amount: item.total,
    })),
    subTotal: quotationData.subtotal,
    discount: quotationData.discountPercentage,
    discountAmount: quotationData.discountAmount,
    shippingCharges: quotationData.shippingCharges,
    adjustment: quotationData.adjustment,
    taxTotal: quotationData.taxTotal,
    grandTotal: quotationData.total,
    currency:
      getCustomerCurrencyCode(selectedCustomer) ||
      baseCurrency ||
      quotationData.currency ||
      "USD",
    customerNotes: quotationData.customerNotes,
    termsAndConditions: quotationData.termsAndConditions,
    terms: quotationData.terms,
    status: statusOverride ?? quotationData.status ?? "draft",
    supportingDocuments: quotationData.supportingDocuments || [],
    templateId: quotationData.templateId || undefined,
    templateName: quotationData.templateName || "",
  });

  const handleAttachmentChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (!quotationData.business) {
      notifyError(
        t("accounts.quotations.validation.businessBeforeUpload", {
          defaultValue: "Select a business before uploading files.",
        }),
      );
      e.target.value = "";
      return;
    }
    const currentCount = quotationData.supportingDocuments?.length || 0;
    if (currentCount + files.length > 10) {
      notifyError(
        t("documents.validation.maxFiles", {
          defaultValue:
            "You can upload a maximum of 10 files. You already have {{count}} attachment(s).",
          count: currentCount,
        }),
      );
      e.target.value = "";
      return;
    }
    const maxSize = 10 * 1024 * 1024;
    const tooLarge = files.filter((f) => f.size > maxSize);
    if (tooLarge.length > 0) {
      notifyError(
        t("documents.validation.filesTooLarge", {
          defaultValue: "These files exceed 10MB: {{files}}",
          files: tooLarge.map((f) => f.name).join(", "),
        }),
      );
      e.target.value = "";
      return;
    }

    setUploading(true);
    const uploadedDocuments = [];
    const pathLabel = quotationData.quoteNumber || (isEditMode ? "Edit" : "Draft");

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const formDataForUpload = new FormData();
        formDataForUpload.append("file_path", `Quotations/${pathLabel}`);
        formDataForUpload.append("business_id", quotationData.business);
        formDataForUpload.append("customer_id", adminInfo?.id);
        formDataForUpload.append("file_type", file.type);
        formDataForUpload.append("file_size", file.size);
        formDataForUpload.append("file", file);

        const response = await axios.post(`${Base_URL}/documents/uploadDocument`, formDataForUpload, {
          headers: { "Content-Type": "multipart/form-data" },
        });

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
        }
      } catch (error) {
        console.error(error);
        notifyError(
          t("documents.messages.uploadFileFailed", {
            defaultValue: "Failed to upload {{file}}.",
            file: file.name,
          }),
        );
      }
    }

    if (uploadedDocuments.length > 0) {
      setQuotationData((prev) => ({
        ...prev,
        supportingDocuments: [...(prev.supportingDocuments || []), ...uploadedDocuments],
      }));
      notifySuccess(
        uploadedDocuments.length === 1
          ? t("documents.messages.uploaded", {
              defaultValue: "File uploaded successfully.",
            })
          : t("documents.messages.uploadedCount", {
              defaultValue: "{{count}} files uploaded successfully.",
              count: uploadedDocuments.length,
            }),
      );
    }

    e.target.value = "";
    setUploading(false);
  };

  const handleRemoveAttachment = (fileId) => {
    setQuotationData((prev) => ({
      ...prev,
      supportingDocuments: (prev.supportingDocuments || []).filter((doc) => doc.fileId !== fileId),
    }));
    notifySuccess(
      t("documents.messages.attachmentRemoved", {
        defaultValue: "Attachment removed",
      }),
    );
  };

  const handleOpenAttachment = async (documentId) => {
    if (!documentId) return;
    try {
      const response = await axios.get(`${Base_URL}/documents/getFileWithAllData/${documentId}`);
      const url = response.data?.data?.url;
      if (url) window.open(url, "_blank");
      else
        notifyError(
          t("documents.messages.resolveUrlFailed", {
            defaultValue: "Could not resolve file URL.",
          }),
        );
    } catch {
      notifyError(
        t("documents.messages.openFailed", {
          defaultValue: "Could not open file.",
        }),
      );
    }
  };

  const persistQuotation = async (nextStatus) => {
    if (nextStatus === "send") {
      if (!validate({ requireTemplate: true })) return;
    } else if (!validate({ requireTemplate: nextStatus === "sent" })) return;
    if (nextStatus === "send") {
      try {
        setSaving(true);
        const payload = buildPayload("draft");
        let quoteRes;
        if (isEditMode) {
          quoteRes = await QuotationServices.updateQuotation(id, payload);
        } else {
          quoteRes = await QuotationServices.createQuotation(payload);
        }
        const quote = quoteRes.data?.data;
        const qid = quote?._id || id;
        if (!qid) {
          notifyError(
            t("accounts.quotations.messages.saveFailed", {
              defaultValue: "Could not save quotation.",
            }),
          );
          return;
        }
        notifySuccess(
          t("accounts.quotations.messages.savedForEmail", {
            defaultValue: "Quotation saved. Compose your email on the next screen.",
          }),
        );
        history.push({
          pathname: "/quotation-email-preview",
          state: {
            quotationId: qid,
            quotationData: quote,
            businessData,
            templateData: selectedQuoteTemplate,
            selectedCustomer,
          },
        });
      } catch (error) {
          notifyError(
            error.response?.data?.message ||
              t("accounts.quotations.messages.saveFailed", {
                defaultValue: "Failed to save quotation",
              }),
          );
      } finally {
        setSaving(false);
      }
      return;
    }

    try {
      setSaving(true);
      const payload = buildPayload(nextStatus);
      if (isEditMode) {
        await QuotationServices.updateQuotation(id, payload);
        notifySuccess(
          nextStatus === "sent"
            ? t("accounts.quotations.messages.updatedAndSent", {
                defaultValue: "Quotation updated and marked as sent",
              })
            : t("accounts.quotations.messages.savedDraft", {
                defaultValue: "Quotation saved as draft",
              }),
        );
      } else {
        await QuotationServices.createQuotation(payload);
        notifySuccess(
          nextStatus === "sent"
            ? t("accounts.quotations.messages.createdAndSent", {
                defaultValue: "Quotation created and marked as sent",
              })
            : t("accounts.quotations.messages.savedDraft", {
                defaultValue: "Quotation saved as draft",
              }),
        );
      }
      history.push("/quotations");
    } catch (error) {
        notifyError(
          error.response?.data?.message ||
            t("accounts.quotations.messages.saveFailed", {
              defaultValue: "Failed to save quotation",
            }),
        );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-gray-600">
        {t("accounts.quotations.loading", { defaultValue: "Loading quotation..." })}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <div className="mx-auto max-w-[1600px] py-4 px-4 min-w-0 w-full">
        <div className="space-y-6 px-2 md:px-4 min-w-0">
          <PageHeader
            title={
              isEditMode
                ? t("accounts.quotations.actions.edit", { defaultValue: "Edit Quotation" })
                : t("accounts.quotations.actions.new", { defaultValue: "New Quotation" })
            }
            // description="Prepare customer quotes without accounting impact until conversion."
            showBackButton
            backFallbackPath="/quotations"
          />

          <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 bg-green-50 space-y-6 rounded-b-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SingleBusinessField
                    selectedValue={quotationData.business}
                    onAutoSelect={(id) =>
                      setQuotationData((prev) => ({
                        ...prev,
                        business: prev.business || id,
                      }))
                    }
                  >
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t("common.business", { defaultValue: "Business" })}{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <div className="bg-white rounded-lg">
                      <DropdownBasic
                        options={businessOptions.map((o) => ({
                          value: o.value,
                          label: o.label,
                        }))}
                        value={quotationData.business}
                        onChange={handleBusinessChange}
                        placeholder={t("common.selectBusiness", {
                          defaultValue: "Select Business",
                        })}
                        isClearable={false}
                      />
                    </div>
                    {errors.business && (
                      <p className="mt-1 text-xs text-red-500">{errors.business}</p>
                    )}
                  </div>
                  </SingleBusinessField>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t("common.customer", { defaultValue: "Customer" })}{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <div className="flex-1 bg-white rounded-lg">
                      <SearchableDropdown
                        value={quotationData.customer}
                        onChange={handleCustomerChange}
                        placeholder={
                          selectedCustomer
                            ? selectedCustomer?.basicInformation?.customerDisplayName
                            : t("common.selectCustomer", { defaultValue: "Select customer" })
                        }
                        searchPlaceholder={t("accounts.quotations.form.searchCustomers", {
                          defaultValue: "Search customers...",
                        })}
                        disabled={!quotationData.business}
                        options={customerOptions}
                        searchKeys={["name", "displayName", "email"]}
                        renderOption={(option) => (
                          <div>
                            <div className="font-medium text-sm">{option.name}</div>
                            {option.displayName && option.displayName !== option.name && (
                              <div className="text-xs text-gray-500">{option.displayName}</div>
                            )}
                            {option.email && (
                              <div className="text-xs text-gray-400">{option.email}</div>
                            )}
                          </div>
                        )}
                      />
                    </div>
                    {errors.customer && (
                      <p className="mt-1 text-xs text-red-500">{errors.customer}</p>
                    )}
                  </div>
                </div>

                {docNumMissing && !isEditMode && (
                  <div className="flex items-center justify-between gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-500" />
                      <span>
                        {t("accounts.quotations.form.numberingFallback", {
                          defaultValue:
                            "Quotation numbering is not configured for this business group. Preview numbers use the Business Group fallback sequence (same as invoice numbering).",
                        })}
                      </span>
                    </div>
                    {/* Document sequencing link disabled for quotation
                    {(adminInfo?.role?.isSuperAdmin ||
                      adminInfo?.role?.modules?.some((mod) =>
                        mod.subModules?.some((sub) => sub.path === "/document-sequencing"),
                      )) && (
                      <a
                        href="/document-sequencing"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 px-3 py-1 text-xs font-semibold bg-amber-500 text-white rounded-md hover:bg-amber-600 transition-colors whitespace-nowrap"
                      >
                        Configure Now
                      </a>
                    )}
                    */}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t("accounts.quotations.fields.quoteNumber", {
                        defaultValue: "Quote Number",
                      })}
                    </label>
                    <input
                      type="text"
                      value={quotationData.quoteNumber}
                      readOnly
                      className="w-full px-3 py-2.5 text-sm bg-[#374151] text-white border border-gray-300 rounded-lg cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t("common.currency", { defaultValue: "Currency" })}
                    </label>
                    <input
                      type="text"
                      value={displayCurrencyLabel}
                      readOnly
                      className="w-full px-3 py-2.5 text-sm bg-gray-100 text-gray-700 border border-gray-300 rounded-lg cursor-not-allowed"
                      placeholder={
                        !quotationData.business
                          ? t("common.selectBusiness", { defaultValue: "Select business" })
                          : !selectedCustomer?._id
                            ? t("accounts.quotations.form.selectCustomerCurrency", {
                                defaultValue: "Select customer or use business base",
                              })
                            : t("accounts.quotations.form.customerCurrency", {
                                defaultValue: "Customer currency or business base",
                              })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t("accounts.quotations.fields.quoteDate", {
                        defaultValue: "Quote Date",
                      })}{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <CustomDatePicker
                      value={quotationData.quoteDate}
                      onChange={(date) => {
                        const ymd = date && formatDateToYMD(date);
                        setQuotationData((prev) => ({ ...prev, quoteDate: ymd || "" }));
                      }}
                      bgColor="#FFFFFF"
                      style={{
                        backgroundColor: "#FFFFFF",
                        border: "1px solid #E5E7EB",
                        borderRadius: "8px",
                      }}
                    />
                    {errors.quoteDate && (
                      <p className="mt-1 text-xs text-red-500">{errors.quoteDate}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t("accounts.quotations.fields.expiryDate", {
                        defaultValue: "Expiry Date",
                      })}{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <CustomDatePicker
                      value={quotationData.expiryDate}
                      minDate={
                        quotationData.quoteDate
                          ? new Date(
                              new Date(quotationData.quoteDate).setHours(0, 0, 0, 0),
                            )
                          : undefined
                      }
                      onChange={(date) => {
                        const ymd = date && formatDateToYMD(date);
                        setQuotationData((prev) => ({ ...prev, expiryDate: ymd || "" }));
                      }}
                      bgColor="#FFFFFF"
                      style={{
                        backgroundColor: "#FFFFFF",
                        border: "1px solid #E5E7EB",
                        borderRadius: "8px",
                      }}
                    />
                    {errors.expiryDate && (
                      <p className="mt-1 text-xs text-red-500">{errors.expiryDate}</p>
                    )}
                  </div>
                </div>

                {selectedCustomer?._id && (
                  <>
                    {!addressTypeConfig?.hasConfiguredTypes && (
                      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 text-center">
                        <p className="text-xs text-gray-500">
                          {t("accounts.quotations.form.noAddressTypes", {
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
                            quotationData.sameAsBilling,
                          );
                        if (!missingBillShip.length) return null;
                        return (
                          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 text-center">
                            <h3 className="text-sm font-medium text-gray-700 mb-3">
                              {missingBillShipSectionTitle(missingBillShip)}
                            </h3>
                            <p className="text-xs text-gray-500 mb-4">
                              {buildMissingCustomerAddressMessage(missingBillShip)}
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
                                  {t("accounts.quotations.form.addAddress", {
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
                      billingAddress={quotationData.billingAddress}
                      shippingAddress={quotationData.shippingAddress}
                      sameAsBilling={quotationData.sameAsBilling}
                      onBillingChange={(nextBilling) => {
                        setQuotationData((prev) => ({
                          ...prev,
                          billingAddress: nextBilling,
                          shippingAddress: prev.sameAsBilling ? nextBilling : prev.shippingAddress,
                        }));
                      }}
                      onShippingChange={(nextShipping) => {
                        setQuotationData((prev) => ({
                          ...prev,
                          sameAsBilling: false,
                          shippingAddress: nextShipping,
                        }));
                      }}
                      onSameAsBillingToggle={(checked) => {
                        setQuotationData((prev) => {
                          if (checked) {
                            lastDistinctShippingAddressRef.current = prev.shippingAddress || "";
                            return {
                              ...prev,
                              sameAsBilling: true,
                              shippingAddress: prev.billingAddress,
                            };
                          }
                          return {
                            ...prev,
                            sameAsBilling: false,
                            shippingAddress: lastDistinctShippingAddressRef.current || "",
                          };
                        });
                      }}
                    />
                  </>
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm min-w-0 overflow-x-auto">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  {t("documents.lineItems", { defaultValue: "Line Items" })}
                </h2>
                {errors.items && <p className="mt-1 text-xs text-red-600">{errors.items}</p>}
              </div>
              <ZohoStyleItemTable
                invoiceData={quotationData}
                setInvoiceData={setQuotationData}
                selectedContract={null}
                expenseAccounts={expenseAccounts}
                currency={displayCurrencyLabel || baseCurrency || "USD"}
                businessItems={businessItems}
                taxes={taxes}
                isEditMode
                businessId={quotationData.business}
                headers={headers}
              />
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <Paperclip className="text-gray-600 shrink-0" size={20} />
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      {t("documents.attachments", { defaultValue: "Attachments" })}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {t("accounts.quotations.form.attachmentHelp", {
                        defaultValue:
                          "Supporting documents (max 10 files, 10MB each). Same upload flow as customer invoices.",
                      })}
                    </p>
                  </div>
                </div>
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleAttachmentChange}
                    disabled={uploading || !quotationData.business}
                  />
                  <button
                    type="button"
                    disabled={uploading || !quotationData.business}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <Upload size={16} />
                    {uploading
                      ? t("documents.uploading", { defaultValue: "Uploading…" })
                      : t("documents.uploadFiles", { defaultValue: "Upload files" })}
                  </button>
                </div>
              </div>
              {(quotationData.supportingDocuments || []).length === 0 ? (
                <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-sm text-gray-500">
                  {t("accounts.quotations.form.noAttachments", {
                    defaultValue:
                      "No attachments yet. Upload files to keep supporting records with this quotation.",
                  })}
                </div>
              ) : (
                <ul className="divide-y divide-gray-100 border border-gray-100 rounded-md overflow-hidden">
                  {(quotationData.supportingDocuments || []).map((doc) => (
                    <li
                      key={doc.fileId || doc.name}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm bg-white hover:bg-gray-50 transition-colors"
                    >
                      <div className="min-w-0 flex items-center gap-2">
                        <File size={16} className="text-gray-400 shrink-0" />
                        <button
                          type="button"
                          onClick={() => handleOpenAttachment(doc.fileId)}
                          className="text-[var(--p-blue)] hover:underline text-left truncate max-w-[min(100%,280px)]"
                        >
                          {doc.name || t("documents.file", { defaultValue: "File" })}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(doc.fileId)}
                        className="p-1 rounded text-gray-500 hover:bg-gray-100 hover:text-red-600"
                        aria-label={t("documents.removeAttachment", {
                          defaultValue: "Remove attachment",
                        })}
                      >
                        <X size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                    <label className="block text-sm font-semibold text-gray-900 mb-3">
                      {t("accounts.quotations.fields.customerNotes", {
                        defaultValue: "Customer Notes",
                      })}
                    </label>
                    <textarea
                      rows={4}
                      value={quotationData.customerNotes}
                      onChange={(event) =>
                        setQuotationData((prev) => ({
                          ...prev,
                          customerNotes: event.target.value,
                        }))
                      }
                      placeholder={t("accounts.quotations.form.notesPlaceholder", {
                        defaultValue: "Thanks for your business.",
                      })}
                      className="w-full min-h-[6rem] px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] resize-y"
                    />
                    <p className="mt-2 text-xs text-gray-500">
                      {t("accounts.quotations.form.notesHelp", {
                        defaultValue: "Will be displayed on the quotation",
                      })}
                    </p>
                  </div>
                  <DocumentTermsAndConditionsSection
                    businessId={quotationData.business}
                    headers={headers}
                    businessData={businessData}
                    termsAndConditionsList={termsAndConditionsList}
                    onTermsListChange={setTermsAndConditionsList}
                    termsAndConditions={quotationData.termsAndConditions}
                    onTermsContentChange={(value) =>
                      setQuotationData((prev) => ({ ...prev, termsAndConditions: value }))
                    }
                    footerNote={t("accounts.quotations.form.termsHelp", {
                      defaultValue:
                        "Terms appear on the quotation preview and PDF. Edit above if needed.",
                    })}
                  />
                </div>
              </div>

              <InvoiceSummaryPanel
                invoiceData={quotationData}
                currency={displayCurrencyLabel || baseCurrency || "USD"}
                title={t("accounts.quotations.form.summary", {
                  defaultValue: "Quotation Summary",
                })}
                onDiscountChange={(value) =>
                  setQuotationData((prev) => ({ ...prev, discountPercentage: value }))
                }
                onShippingChange={(value) =>
                  setQuotationData((prev) => ({ ...prev, shippingCharges: value }))
                }
                onAdjustmentChange={(value) =>
                  setQuotationData((prev) => ({ ...prev, adjustment: value }))
                }
              />
            </div>

            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <FileText className="text-gray-600 shrink-0" size={18} />
                {selectedQuoteTemplateId || quotationData.templateId ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-gray-800">
                      {t("documents.template", { defaultValue: "Template" })}:{" "}
                      {selectedQuoteTemplate?.name ||
                        quotationData.templateName ||
                        t("common.selected", { defaultValue: "Selected" })}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsQuoteTemplateModalOpen(true)}
                      disabled={!quotationData.business}
                      className="text-[var(--p-blue)] hover:underline disabled:opacity-50"
                    >
                      {t("common.change", { defaultValue: "Change" })}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsQuoteTemplateModalOpen(true)}
                    disabled={!quotationData.business}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                  >
                    <FileText size={16} />
                    {t("documents.selectPdfTemplate", {
                      defaultValue: "Select PDF template",
                    })}
                  </button>
                )}
              </div>
              {errors.template && (
                <p className="text-xs text-red-600 w-full sm:w-auto">{errors.template}</p>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-3 pb-8">
              <button
                type="button"
                onClick={() => history.push("/quotations")}
                className="px-4 py-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              >
                {t("common.cancel", { defaultValue: "Cancel" })}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => persistQuotation("draft")}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 disabled:opacity-60"
              >
                <Save size={16} />
                {saving
                  ? t("common.saving", { defaultValue: "Saving…" })
                  : t("accounts.quotations.actions.saveDraft", {
                      defaultValue: "Save as draft",
                    })}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => persistQuotation("send")}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[var(--p-blue)] text-white hover:opacity-90 disabled:opacity-60"
              >
                <Send size={16} />
                {saving
                  ? t("common.saving", { defaultValue: "Saving…" })
                  : t("accounts.quotations.actions.saveAndSend", {
                      defaultValue: "Save and send",
                    })}
              </button>
            </div>
          </form>

          <DocumentTemplateModal
            key={`quotation-templates-${quotationTemplates.length}`}
            isOpen={isQuoteTemplateModalOpen}
            type="Quotation"
            templates={quotationTemplates}
            businessData={businessData}
            initialTemplateId={selectedQuoteTemplateId || quotationData.templateId}
            onClose={() => setIsQuoteTemplateModalOpen(false)}
            onSubmit={(payload) => {
              const t = payload.template;
              const tid = payload.templateId || t?._id || t?.id;
              setSelectedQuoteTemplate(t || null);
              setSelectedQuoteTemplateId(tid || null);
              setQuotationData((prev) => ({
                ...prev,
                templateId: tid || "",
                templateName: t?.name || prev.templateName || "",
              }));
              setIsQuoteTemplateModalOpen(false);
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
              if (!selectedCustomer?._id) return;
              try {
                const response = await axios.get(`${Base_URL}/customers/${selectedCustomer._id}`, {
                  headers,
                });
                const updatedCustomer = response?.data;
                setSelectedCustomer(updatedCustomer);

                const formatAddr = (addressObj) => {
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

                const formatted = formatAddr(savedAddress);
                if (addressModalType === "Billing") {
                  setQuotationData((prev) => ({
                    ...prev,
                    billingAddress: formatted,
                    shippingAddress: prev.sameAsBilling ? formatted : prev.shippingAddress,
                  }));
                } else {
                  setQuotationData((prev) => ({
                    ...prev,
                    shippingAddress: formatted,
                  }));
                }
              } catch {
                notifyError(
                  t("accounts.quotations.messages.customerRefreshFailed", {
                    defaultValue: "Could not refresh customer after saving address.",
                  }),
                );
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
