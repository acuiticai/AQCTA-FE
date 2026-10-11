import React, { useState, useEffect, useRef, useContext, useMemo } from "react";
import {
  ChevronDown,
  Calendar,
  X,
  Upload,
  Plus,
  ArrowLeft,
  AlertTriangle,
  DollarSign,
  Package,
  FileText,
  Eye,
  Trash2,
  Truck,
  UserPlus,
} from "lucide-react";
import axios from "axios";
import { useHistory, useParams } from "react-router-dom";
import { notifyError, notifySuccess } from "@/utils/toast";
import ZohoStyleItemTable from "@/components/invoice/ZohoStyleItemTable";
import BulkAddItemsModal from "@/components/customer-invoices/BulkAddItemsModal";
import QuickAddVendorModal from "@/components/vendor-invoices/QuickAddVendorModal";
import { AdminContext } from "@/context/AdminContext";
import CustomDatePicker from "@/components/CustomDatePicker";
import useAsync from "@/hooks/useAsync";
import BankManagementServices from "@/services/BankManagementServices";
import BackButton from "@/components/BackButton";
import CurrencyServices from "@/services/CurrencyServices";
import { formatAmount, getCurrencyDisplay } from "@/components/formatAmount";
import InvoiceSummaryPanel from "@/components/invoice/InvoiceSummaryPanel";
import SearchableDropdown from "@/components/SearchableDropdown";
import DropdownBasic from "@/page-layouts/components/DropdownBasic";
import SingleBusinessField from "@/components/SingleBusinessField";
import { isSingleAssignedBusiness } from "@/utils/sessionAssignedBusinesses";
import AddPaymentTermButton from "@/components/AddPaymentTermButton";
import { calculateDueDate, getPaymentTermFromDueDate } from "@/utils/calculateDueDate";
import DynamicCustomFieldsForm from "@/components/custom-fields/DynamicCustomFieldsForm";
import { sumLineTaxAmountsFromItems } from "@/utils/itemDiscountUtils";
import {
  fetchDefinitions,
  fetchLineItemCustomFieldDefinitions,
  upsertValues,
} from "@/services/customFieldServices";
import { validateCustomFieldValues } from "@/utils/customFieldValidation";
import { shouldRenderCustomFieldAtSlot } from "@/utils/customFieldPlacement";
import { useTranslation } from "react-i18next";

const UpdateVendorInvoice = () => {
  const { t } = useTranslation();
  const vi = (key, defaultValue, options = {}) =>
    t(`accounts.vendorInvoices.${key}`, { defaultValue, ...options });
  const { id } = useParams();
  const history = useHistory();
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
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [businesses, setBusinesses] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState();
  const [invoiceNumber, setInvoiceNumber] = useState("");

  const [contracts, setContracts] = useState([]);
  const [vendors, setVendors] = useState([]);
  // const {
  //   data: { accounts: bankAccounts, loading, error },
  // } = useAsync(BankManagementServices.getAllAccounts);
  // const { data, loading, error } = useAsync(CurrencyServices.getAllCurrency);
  const [currencies, setCurrencies] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [expenseAccounts, setExpenseAccounts] = useState([]);
  const [selectedVendorAccount, setSelectedVendorAccount] = useState(null);
  const [businessItems, setBusinessItems] = useState([]);
  const [taxes, setTaxes] = useState([]);
  const [showBulkAddItemsModal, setShowBulkAddItemsModal] = useState(false);
  const [showQuickAddVendor, setShowQuickAddVendor] = useState(false);
  const [paymentTerms, setPaymentTerms] = useState([]);
  const [lineItemCustomFieldDefs, setLineItemCustomFieldDefs] = useState([]);
  const [invoiceCustomFieldValues, setInvoiceCustomFieldValues] = useState({});
  // Business base currency; used as fallback when vendor currency is missing.
  const [baseCurrency, setBaseCurrency] = useState("MYR");

  // Enhanced state for new flow
  const [selectedInvoiceType, setSelectedInvoiceType] = useState("supplier");
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [addItemData, setAddItemData] = useState({
    purchaseContract: "",
    salesContract: "",
    itemType: "cost_of_goods",
    contractType: "sales",
    description: "",
    amount: 0,
    currency: "",
    quantity: 1,
    expenseAccount: "",
    unitPrice: 0,
    taxRate: 0,
    taxId: "",
    taxName: "",
    // Contract Information
    contractId: "",
    contractNo: "",
    // Commission-specific fields
    totalAgentCommission: 0,
  });
  const [purchaseContracts, setPurchaseContracts] = useState([]);
  const [salesContracts, setSalesContracts] = useState([]);

  // Form data state
  const [invoiceData, setInvoiceData] = useState({
    business: "",
    vendor: "",
    invoiceNumber: "",
    invoiceType: "supplier",
    invoiceDate: formatDateForInput(new Date()),
    dueDate: formatDateForInput(new Date()),
    terms: "Due on Receipt",
    vendorType: "",
    vendorAccount: "",
    phoneNumber: "",
    vendorEmail: "",
    items: [],
    subtotal: 0,
    discountPercentage: 0,
    discountAmount: 0,
    discountType: "percentage", // 'percentage' or 'amount'
    discountValue: 0,
    taxTotal: 0,
    total: 0,
    currency: "",
    expenseAccount: "",
    supportingDocument: null,
    supportingDocuments: [],
    module: "vendor-invoices",
  });

  const [formErrors, setFormErrors] = useState({});
  const [modalErrors, setModalErrors] = useState({});

  // Currency conversion states
  const [convertingCurrency, setConvertingCurrency] = useState(false);
  const [conversionRates, setConversionRates] = useState({});
  const [existingInvoiceTypes, setExistingInvoiceTypes] = useState([]);
  const [selectedContractForValidation, setSelectedContractForValidation] =
    useState(null);
  // Populated expense account snapshot from the loaded invoice so the dropdown can
  // always render the previously saved selection even before /accounts has resolved
  // or if the account is missing from the current business-scoped list.
  const [savedExpenseAccount, setSavedExpenseAccount] = useState(null);

  const filteredExpenseAccounts = useMemo(() => {
    if (!invoiceData.business) return [];
    const selectedBusinessId = String(invoiceData.business);
    const savedExpenseAccountId =
      invoiceData.expenseAccount?._id || invoiceData.expenseAccount;
    const filtered = (expenseAccounts || []).filter((account) => {
      if (savedExpenseAccountId && String(account?._id) === String(savedExpenseAccountId)) {
        return true;
      }
      const accountBusiness =
        account?.business?._id ||
        account?.business?.id ||
        account?.business ||
        account?.business_id?._id ||
        account?.business_id?.id ||
        account?.business_id ||
        account?.businessId?._id ||
        account?.businessId?.id ||
        account?.businessId;
      return !accountBusiness || String(accountBusiness) === selectedBusinessId;
    });
    // Inject the previously saved account if the loaded chart-accounts list does not
    // include it yet (slow fetch / different business scope).
    if (
      savedExpenseAccountId &&
      savedExpenseAccount &&
      String(savedExpenseAccount._id) === String(savedExpenseAccountId) &&
      !filtered.some((a) => String(a?._id) === String(savedExpenseAccountId))
    ) {
      return [savedExpenseAccount, ...filtered];
    }
    return filtered;
  }, [
    expenseAccounts,
    invoiceData.business,
    invoiceData.expenseAccount,
    savedExpenseAccount,
  ]);

  // Format date for input fields
  function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  // Currency conversion function
  const convertCurrency = async (fromCurrency, toCurrency, amount) => {
    if (fromCurrency === toCurrency) {
      return { convertedAmount: amount, exchangeRate: 1 };
    }

    const cacheKey = `${fromCurrency}_${toCurrency}`;
    if (conversionRates[cacheKey]) {
      return {
        convertedAmount: amount * conversionRates[cacheKey],
        exchangeRate: conversionRates[cacheKey],
      };
    }

    try {
      setConvertingCurrency(true);
      const response = await axios.get(`${Base_URL}/currency/convert`, {
        params: {
          from: fromCurrency,
          to: toCurrency,
          amount: amount,
          businessId: invoiceData.business,
        },
        headers,
      });

      const rate = response.data.rate;
      setConversionRates((prev) => ({
        ...prev,
        [cacheKey]: rate,
      }));

      return {
        convertedAmount: response.data.convertedAmount,
        exchangeRate: rate,
      };
    } catch (error) {
      console.error("Currency conversion failed:", error);
      notifyError(vi("currencyConversionFailed", "Currency conversion failed. Using original amount."));
      return { convertedAmount: amount, exchangeRate: 1 };
    } finally {
      setConvertingCurrency(false);
    }
  };

  // Function to fetch existing invoice types for a specific contract (like ExpensesTable)
  const fetchExistingInvoiceTypesForContract = async (
    contractId,
    contractNo
  ) => {
    try {
      const response = await axios.get(`${Base_URL}/vendor-invoices`, {
        params: {
          contract: contractNo, // Use contractNo like ExpensesTable
          business: invoiceData.business,
        },
        headers,
      });

      // Extract existing invoice types for this contract
      const existingTypes = (response.data.data || [])
        .filter((invoice) => invoice._id !== id) // Exclude current invoice being updated
        .map((invoice) => invoice.invoiceType);

      const uniqueTypes = [...new Set(existingTypes)];
      setExistingInvoiceTypes(uniqueTypes);
      setSelectedContractForValidation(contractId);

      console.log(
        `Existing invoice types for contract ${contractNo}:`,
        uniqueTypes
      );
      return uniqueTypes;
    } catch (error) {
      console.error("Error fetching existing invoice types:", error);
      setExistingInvoiceTypes([]);
      setSelectedContractForValidation(null);
      return [];
    }
  };

  // Function to check if an invoice type can be created for current contract
  const canCreateInvoiceType = (
    invoiceType,
    contractId,
    existingTypesOverride = null
  ) => {
    // If no contract selected, allow (no validation needed)
    if (!contractId) {
      return true;
    }

    // Use override data if provided (for immediate validation after fetch)
    const typesToCheck =
      existingTypesOverride !== null
        ? existingTypesOverride
        : existingInvoiceTypes;
    const contractToCheck =
      existingTypesOverride !== null
        ? contractId
        : selectedContractForValidation;

    // If this is a different contract than the one we've validated, we need to fetch its invoice types first
    if (existingTypesOverride === null && contractToCheck !== contractId) {
      // We haven't fetched invoice types for this contract yet, so we can't validate
      // This should trigger a fetch in the calling function
      return false;
    }

    // Check if this invoice type already exists for the selected contract
    return !typesToCheck.includes(invoiceType);
  };

  // Function to get reason why invoice type cannot be created
  const getInvoiceTypeDisabledReason = (
    invoiceType,
    contractId,
    existingTypesOverride = null
  ) => {
    if (!contractId) {
      return "";
    }

    // Use override data if provided (for immediate validation after fetch)
    const typesToCheck =
      existingTypesOverride !== null
        ? existingTypesOverride
        : existingInvoiceTypes;
    const contractToCheck =
      existingTypesOverride !== null
        ? contractId
        : selectedContractForValidation;

    if (existingTypesOverride === null && contractToCheck !== contractId) {
      return vi("pleaseWaitCheckingInvoices", "Please wait while we check existing invoices for this contract");
    }

    if (typesToCheck.includes(invoiceType)) {
      return vi("invoiceTypeAlreadyCreated", "{{invoiceType}} invoice already created for this contract", { invoiceType });
    }

    return "";
  };

  // Fetch invoice data
  const fetchInvoice = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${Base_URL}/vendor-invoices/${id}`, {
        headers,
      });
      // Support both { data: invoice } and direct invoice response
      const data = response.data?.data ?? response.data;
      if (!data) {
        notifyError(vi("invoiceNotFound", "Invoice not found"));
        setIsLoading(false);
        return;
      }

      // Resolve vendor: if backend returned only vendor ID, fetch full vendor
      let vendorObj = data.vendor;
      const vendorId = typeof vendorObj === "string" ? vendorObj : vendorObj?._id;
      if (vendorId && (!vendorObj?.basicInformation)) {
        try {
          const vendorRes = await axios.get(`${Base_URL}/vendors/${vendorId}`, { headers });
          vendorObj = vendorRes.data?.data ?? vendorRes.data;
        } catch (err) {
          console.error("Error fetching vendor for invoice:", err);
        }
      }

      const businessId = data.business?._id || data.business;
      const loadedItems = (data.items || []).map((item, idx) => {
          const qty = parseFloat(item.quantity) || 1;
          const unitPrice = parseFloat(item.unitPrice) || 0;
          const itemTotal = item.total ?? item.totalValue ?? item.amount ?? qty * unitPrice;
          return {
            ...item,
            id: item.id ?? idx + 1,
            itemName: item.itemName ?? "",
            description: item.description ?? "",
            quantity: qty,
            unitPrice,
            amount: item.amount ?? itemTotal,
            total: parseFloat(itemTotal) || 0,
            totalValue: parseFloat(itemTotal) || 0,
            discount: parseFloat(item.discount) || 0,
            tax: parseFloat(item.tax) || 0,
            taxRate: parseFloat(item.taxRate) || 0,
            taxId: item.taxId || "",
            taxName: item.taxName || "",
            lineItemCustomFields:
              item.lineItemCustomFields && typeof item.lineItemCustomFields === "object"
                ? { ...item.lineItemCustomFields }
                : {},
          };
        });
      const loadedTaxTotal = sumLineTaxAmountsFromItems(loadedItems);

      setInvoiceData({
        business: businessId,
        vendor: vendorObj ?? "",
        invoiceNumber: data.invoiceNumber,
        invoiceType: data.invoiceType,
        invoiceDate: formatDateForInput(
          new Date(data.invoiceDate || Date.now())
        ),
        dueDate: formatDateForInput(new Date(data.dueDate || Date.now())),
        // Vendor Payment Terms (Purchase_Misc_Data_Types > Vendor Payment Terms)
        terms: data.terms || "Due on Receipt",
        paymentTermId: data.paymentTermId || "",
        vendorType: vendorObj?.basicInformation?.vendorType ?? vendorObj?.basicInformation?.vendorCategory ?? "",
        vendorAccount: data.vendorBankAccount?._id || "",
        phoneNumber: vendorObj?.basicInformation?.vendorPhone?.mobile ?? vendorObj?.basicInformation?.vendorPhone?.workPhone ?? "",
        vendorEmail: vendorObj?.basicInformation?.vendorEmail || "",
        items: loadedItems,
        subtotal: parseFloat(data.subtotal) || 0,
        discountPercentage: parseFloat(data.discount) || 0,
        discountAmount:
          parseFloat(data.discountAmount) ||
          (parseFloat(data.subtotal) || 0) * (parseFloat(data.discount) || 0) / 100,
        taxTotal: loadedTaxTotal,
        total: parseFloat(data.total) || 0,
        discountType: "percentage",
        discountValue: parseFloat(data.discount) || 0,
        shippingCharges: parseFloat(data.shipping) || parseFloat(data.shippingCharges) || 0,
        adjustment: parseFloat(data.adjustments) || parseFloat(data.adjustment) || 0,
        expenseAccount: data.expenseAccount?._id || data.expenseAccount || "",
        // Use vendor's currency (customer currency) when available; else saved invoice currency
        currency:
          vendorObj?.basicInformation?.currency?.symbol ||
          vendorObj?.basicInformation?.currency?.name ||
          (typeof vendorObj?.basicInformation?.currency === "string"
            ? vendorObj.basicInformation.currency
            : null) ||
          data.currency ||
          "",
        supportingDocument:
          data.documents && data.documents.length > 0
            ? data.documents.find((doc) => doc.documentType === "Supporting")
            : null,
        supportingDocuments: data.documents
          ? data.documents.filter((doc) => doc.documentType === "Supporting")
          : [],
        module: "vendor-invoices",
      });

      setSelectedVendor(vendorObj || null);
      setInvoiceNumber(data.invoiceNumber);
      setSelectedInvoiceType(data.invoiceType || "supplier");

      // Keep a copy of the populated expense account so the dropdown can render the
      // previously saved selection even when /accounts hasn't returned yet.
      if (data.expenseAccount && typeof data.expenseAccount === "object" && data.expenseAccount._id) {
        setSavedExpenseAccount(data.expenseAccount);
      } else {
        setSavedExpenseAccount(null);
      }

      // baseCurrency is fetched from the selected business (see useEffect below).

      if (data.vendorBankAccount) {
        setSelectedVendorAccount(data.vendorBankAccount);
      }
    } catch (error) {
      console.error("Error fetching invoice:", error);
      notifyError(vi("failedToFetchInvoiceDetails", "Failed to fetch invoice details"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const fetchCurrencies = async () => {
      const response = await axios.get(
        `${Base_URL}/finance/currencies?business_id=${invoiceData?.business}`
      );
      setCurrencies(response.data.data || []);
    };
    fetchCurrencies();
  }, [invoiceData?.business]);

  // Resolve currency ObjectId to symbol when currencies load (vendor stores currency as ObjectId ref)
  useEffect(() => {
    if (!invoiceData.currency || currencies.length === 0) return;
    const curr = invoiceData.currency;
    if (typeof curr === "string" && /^[a-f0-9]{24}$/i.test(curr)) {
      const found = currencies.find((c) => c._id === curr || c.symbol === curr);
      if (found?.symbol) {
        setInvoiceData((prev) => ({ ...prev, currency: found.symbol }));
      }
    }
  }, [invoiceData.currency, currencies]);

  // Fetch base currency when business changes (fallback when no vendor selected) – same as Create Customer Invoice
  useEffect(() => {
    if (invoiceData.business) {
      const fetchCurrency = async () => {
        try {
          const currencyResponse = await axios.get(
            `${Base_URL}/finance/currencies`,
            { params: { business_id: invoiceData.business } }
          );
          const currenciesList = currencyResponse?.data?.data || [];
          const base = currenciesList.find((c) => c.is_base === true);
          if (base) {
            const currencySymbol = base.symbol || base.prefix || base.name || "MYR";
            setBaseCurrency(currencySymbol);
            setInvoiceData((prev) => ({
              ...prev,
              currency: prev.currency || currencySymbol,
            }));
          } else {
            setBaseCurrency("MYR");
          }
        } catch (currencyError) {
          console.error("Error fetching base currency:", currencyError);
          setBaseCurrency("MYR");
        }
      };
      fetchCurrency();
    }
  }, [invoiceData.business, Base_URL, selectedVendor]);

  // Load items when business changes
  useEffect(() => {
    if (invoiceData.business) {
      const fetchItems = async () => {
        try {
          const response = await axios.get(`${Base_URL}/items`, {
            params: {
              businessId: invoiceData.business,
              status: "Active",
            },
          });
          console.log("Items API response:", response?.data);
          
          // Handle both paginated and non-paginated responses
          if (response?.data?.items && Array.isArray(response?.data?.items)) {
            setBusinessItems(response.data.items || []);
          } else if (Array.isArray(response?.data)) {
            setBusinessItems(response.data || []);
          } else {
            console.warn("Unexpected response format:", response?.data);
            setBusinessItems([]);
          }
        } catch (error) {
          console.error("Error fetching items:", error);
          setBusinessItems([]);
        }
      };
      fetchItems();
    } else {
      setBusinessItems([]);
    }
  }, [invoiceData.business, Base_URL]);

  // Load taxes (Accounts > Taxes) when business changes
  useEffect(() => {
    if (invoiceData.business) {
      axios.get(`${Base_URL}/taxes?business=${invoiceData.business}`).then((res) => setTaxes(res.data || [])).catch(() => setTaxes([]));
    } else {
      setTaxes([]);
    }
  }, [invoiceData.business, Base_URL]);

  useEffect(() => {
    const bid = invoiceData.business;
    if (!bid) {
      setLineItemCustomFieldDefs([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const defs = await fetchLineItemCustomFieldDefinitions(
          { businessId: bid, transactionContext: "purchase:vendor_invoice" },
          headers,
        );
        if (!cancelled) setLineItemCustomFieldDefs(defs || []);
      } catch (e) {
        console.error(e);
        if (!cancelled) setLineItemCustomFieldDefs([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [invoiceData.business, adminInfo?.token]);

  // Fetch active Vendor Payment Terms when business is selected
  useEffect(() => {
    const fetchPaymentTerms = async () => {
      if (!invoiceData?.business) {
        setPaymentTerms([]);
        return;
      }
      try {
        const paymentTermsResponse = await axios.post(
          `${Base_URL}/items/Vendor Payment Terms/get_all`,
          {
            business_id: invoiceData.business,
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
      } catch (error) {
        console.error("Error fetching payment terms:", error);
        setPaymentTerms([]);
      }
    };
    fetchPaymentTerms();
  }, [invoiceData.business]);

  // Auto-calculate due date when Vendor Payment Terms or invoice date changes (uses Number of Days from term when available)
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
      invoiceData.invoiceDate
    );
    if (calculatedDueDate && calculatedDueDate !== invoiceData.dueDate) {
      setInvoiceData((prev) => {
        const term = paymentTerms.find((t) => t.name === prev.terms);
        return {
          ...prev,
          dueDate: calculatedDueDate,
          paymentTermId: term?._id || "",
        };
      });
    }
  }, [invoiceData.terms, invoiceData.invoiceDate, paymentTerms]);

  const currencyOptions = currencies.map((currency) => ({
    value: currency.symbol,
    label: `${currency.symbol} (${currency.prefix})`,
    conversionRate: currency.conversion_rate_to_base,
  }));

  useEffect(() => {
    fetchInvoice();

    const fetchData = async () => {
      try {
        // Fetch businesses
        const storedBusinesses = localStorage.getItem("businesses");
        if (storedBusinesses) {
          const parsedData = JSON.parse(storedBusinesses);
          setBusinesses(parsedData);
        }

        // Fetch vendors
        const vendorsRes = await axios.get(
          invoiceData?.business
            ? `${Base_URL}/vendors/all/${invoiceData.business}`
            : `${Base_URL}/vendors`,
          { params: { status: "Active" } }
        );

        // Filter vendors based on invoice type (inactive already excluded by API)
        let filteredVendors = (vendorsRes.data.data || []).filter(
          (vendor) => !vendor.status || vendor.status === "Active"
        );
        if (selectedInvoiceType === "commission") {
          filteredVendors = filteredVendors.filter(
            (vendor) => vendor.basicInformation?.vendorType === "Agent"
          );
        } else if (selectedInvoiceType === "logistic") {
          filteredVendors = filteredVendors.filter(
            (vendor) =>
              vendor.basicInformation?.vendorType ===
              "Logistic Service Provider"
          );
        }
        setVendors(filteredVendors);

        const bankAccountsRes = await axios.get(
          `${Base_URL}/bank-management/accounts`,
          {
            params: { business: invoiceData?.business },
          }
        );

        const chartAccountsRes = await axios.get(`${Base_URL}/accounts`, {
          params: { business: invoiceData?.business },
        });
        setBankAccounts(bankAccountsRes.data.accounts || []);
        setExpenseAccounts(chartAccountsRes.data.accounts || []);

        // Fetch purchase contracts
        const purchaseContractsRes = await axios.get(
          `${Base_URL}/purchase-contracts`
        );
        setPurchaseContracts(purchaseContractsRes.data.contracts || []);

        // Fetch sales contracts
        const salesContractsRes = await axios.get(
          `${Base_URL}/sales-contracts`
        );
        setSalesContracts(salesContractsRes.data.contracts || []);
      } catch (error) {
        console.error("Failed to fetch data:", error);
        notifyError(vi("failedToLoadData", "Failed to load data"));
      }
    };

    fetchData();
  }, [id, invoiceData?.business]);

  // Refetch vendors when invoice type changes
  useEffect(() => {
    const fetchVendorsForType = async () => {
      try {
        const vendorsRes = await axios.get(
          invoiceData?.business
            ? `${Base_URL}/vendors/all/${invoiceData.business}`
            : `${Base_URL}/vendors`,
          { params: { status: "Active" } }
        );

        // Filter vendors based on invoice type (inactive already excluded by API)
        let filteredVendors = (vendorsRes.data.data || []).filter(
          (vendor) => !vendor.status || vendor.status === "Active"
        );
        if (selectedInvoiceType === "commission") {
          filteredVendors = filteredVendors.filter(
            (vendor) => vendor.basicInformation?.vendorType === "Agent"
          );
        } else if (selectedInvoiceType === "logistic") {
          filteredVendors = filteredVendors.filter(
            (vendor) =>
              vendor.basicInformation?.vendorType ===
              "Logistic Service Provider"
          );
        }
        setVendors(filteredVendors);
      } catch (error) {
        console.error("Error fetching vendors for type:", error);
      }
    };

    if (invoiceData?.business) {
      fetchVendorsForType();
    }
  }, [selectedInvoiceType, invoiceData?.business]);

  const handleChangeVendor = async (vendorId) => {
    try {
      const response = await axios.get(`${Base_URL}/vendors/${vendorId}`);
      const vendorData = response?.data?.data;
      setSelectedVendor(vendorData);
      // Auto-fill currency from vendor (customer currency), not business
      const vendorCurrency =
        vendorData?.basicInformation?.currency?.symbol ||
        vendorData?.basicInformation?.currency?.name ||
        (typeof vendorData?.basicInformation?.currency === "string"
          ? vendorData.basicInformation.currency
          : "") ||
        "";
      setInvoiceData({
        ...invoiceData,
        vendor: vendorData?.basicInformation?.vendorDisplayName,
        phoneNumber: vendorData?.basicInformation?.vendorPhone?.mobile || "",
        vendorType: vendorData?.basicInformation?.vendorType,
        vendorEmail: vendorData?.basicInformation?.vendorEmail || "",
        // Prefer vendor currency; if missing/invalid, fall back to business base currency.
        currency: vendorCurrency || invoiceData.currency || baseCurrency || "MYR",
      });
    } catch (error) {
      console.error("Error fetching vendor data:", error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    // Shipping / Adjustment affect grand total (Invoice Totals section)
    if (name === "shippingCharges" || name === "adjustment") {
      const numeric = value === "" ? "" : parseFloat(value) || 0;
      const nextShipping =
        name === "shippingCharges"
          ? (numeric === "" ? 0 : numeric)
          : parseFloat(invoiceData.shippingCharges) || 0;
      const nextAdjustment =
        name === "adjustment"
          ? (numeric === "" ? 0 : numeric)
          : parseFloat(invoiceData.adjustment) || 0;
      const subtotal = parseFloat(invoiceData.subtotal) || 0;
      const discountAmount = parseFloat(invoiceData.discountAmount) || 0;

      setInvoiceData({
        ...invoiceData,
        [name]: numeric,
        total: Math.max(subtotal - discountAmount + nextShipping + nextAdjustment, 0),
      });
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
          total:
            (parseFloat(invoiceData.subtotal) || 0) +
            (parseFloat(invoiceData.shippingCharges) || 0) +
            (parseFloat(invoiceData.adjustment) || 0),
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
          discountType: "percentage",
          total: Math.max(
            (parseFloat(invoiceData.subtotal) || 0) -
              discountAmount +
              (parseFloat(invoiceData.shippingCharges) || 0) +
              (parseFloat(invoiceData.adjustment) || 0),
            0
          ),
        });
      } else if (name === "discountValue") {
        const clampedValue = Math.max(0, Math.min(valueNum, 100));
        discountAmount = (invoiceData.subtotal * clampedValue) / 100;
        setInvoiceData({
          ...invoiceData,
          discountPercentage: clampedValue,
          discountValue: clampedValue,
          discountAmount,
          discountType: "percentage",
          total: Math.max(
            (parseFloat(invoiceData.subtotal) || 0) -
              discountAmount +
              (parseFloat(invoiceData.shippingCharges) || 0) +
              (parseFloat(invoiceData.adjustment) || 0),
            0
          ),
        });
      }
      return;
    }

    setInvoiceData({
      ...invoiceData,
      [name]: value,
    });

    // Clear error when field is filled
    if (name === "expenseAccount" && formErrors.expenseAccount) {
      setFormErrors({
        ...formErrors,
        expenseAccount: "",
      });
    }
  };

  const getFriendlyVendorInvoiceError = (err) => {
    const code = err?.response?.data?.error || err?.response?.data?.code;
    if (code === "PO_QTY_EXCEEDED") {
      return vi("poQtyExceeded", "The quantity on this bill exceeds the remaining quantity on the linked Purchase Order. Please reduce the quantity to the remaining PO quantity and try again.");
    }
    return err?.response?.data?.message || err?.response?.data?.error || err?.message || vi("failedToUpdateInvoice", "Failed to update invoice");
  };

  const validateModalForm = () => {
    const errors = {};

    if (selectedInvoiceType === "supplier") {
      if (!addItemData.purchaseContract) {
        errors.purchaseContract = vi("purchaseContractRequired", "Purchase contract is required.");
      }
      if (addItemData.itemType === "expense") {
        if (!addItemData.amount || parseFloat(addItemData.amount) <= 0) {
          errors.amount = vi("amountRequiredAndGreaterThanZero", "Amount is required and must be greater than 0.");
        }
      }
    } else if (selectedInvoiceType === "commission") {
      if (addItemData.contractType === "sales") {
        if (!addItemData.salesContract) {
          errors.salesContract = vi("salesContractRequired", "Sales contract is required.");
        }
      } else if (addItemData.contractType === "purchase") {
        if (!addItemData.purchaseContract) {
          errors.purchaseContract = vi("purchaseContractRequired", "Purchase contract is required.");
        }
      }
    } else if (selectedInvoiceType === "logistic") {
      if (!addItemData.purchaseContract) {
        errors.purchaseContract = vi("purchaseContractRequired", "Purchase contract is required.");
      }
      if (!addItemData.amount || parseFloat(addItemData.amount) <= 0) {
        errors.amount = vi("amountRequiredAndGreaterThanZero", "Amount is required and must be greater than 0.");
      }
    }

    return errors;
  };

  const handleAddItemToInvoice = async () => {
    // Validate modal form first
    const modalValidationErrors = validateModalForm();
    if (Object.keys(modalValidationErrors).length > 0) {
      setModalErrors(modalValidationErrors);
      notifyError(vi("pleaseFillRequiredFields", "Please fill in all required fields"));
      return;
    }

    // Clear any previous errors
    setModalErrors({});

    // Handle Supplier Invoice
    if (selectedInvoiceType === "supplier") {
      if (!addItemData.purchaseContract) {
        notifyError(vi("pleaseSelectPurchaseContract", "Please select a purchase contract"));
        return;
      }

      const selectedContract = purchaseContracts.find(
        (c) => c._id === addItemData.purchaseContract
      );

      if (!selectedContract) {
        notifyError(vi("selectedContractNotFound", "Selected contract not found"));
        return;
      }

      // Validate if this invoice type can be created for the selected contract
      let existingTypes = existingInvoiceTypes;
      if (selectedContractForValidation !== selectedContract._id) {
        // Fetch validation data if not already available
        existingTypes = await fetchExistingInvoiceTypesForContract(
          selectedContract._id,
          selectedContract.contractNo
        );
      }

      if (
        !canCreateInvoiceType(
          selectedInvoiceType,
          selectedContract._id,
          existingTypes
        )
      ) {
        const reason = getInvoiceTypeDisabledReason(
          selectedInvoiceType,
          selectedContract._id,
          existingTypes
        );
        notifyError(reason);
        return;
      }

      // For cost of goods, check if contract already exists in items
      if (addItemData.itemType === "cost_of_goods") {
        const existingCostOfGoodsItem = invoiceData.items.find(
          (item) =>
            item.contractId === selectedContract._id &&
            item.itemType === "cost_of_goods"
        );

        if (existingCostOfGoodsItem) {
          notifyError(
            vi("costOfGoodsAlreadyExists", "Cost of goods item for contract {{contractNo}} already exists. You cannot add multiple cost of goods items for the same contract.", { contractNo: selectedContract.contractNo })
          );
          return;
        }
      }

      let description = "";
      let amount = 0;

      if (addItemData.itemType === "cost_of_goods") {
        // For cost of goods, use the auto-generated description from contract products
        // If no description was auto-generated, fall back to vendor company name
        if (addItemData.description && addItemData.description.trim() !== "") {
          description = addItemData.description;
          // Ensure contract number is included in parentheses if not already present
          const contractNo = selectedContract.contractNo;
          if (contractNo && !description.includes(`(${contractNo})`)) {
            description = `${description} (${contractNo})`;
          }
        } else {
          const vendorName =
            selectedContract.basicInfo?.selectedVendorId?.basicInformation
              ?.companyName || "Goods";
          const contractNo = selectedContract.contractNo;
          description = contractNo
            ? `${vendorName} (${contractNo})`
            : vendorName;
        }

        // Calculate total amount from contract's productInfo
        amount =
          selectedContract.productInfo?.reduce(
            (sum, product) => sum + (product.totalValue || 0),
            0
          ) || 0;

        // Currency conversion if needed
        if (
          selectedContract.productInfo &&
          selectedContract.productInfo.length > 0
        ) {
          const selectedCurrency =
            selectedContract.productInfo[0].selectedCurrency;
          let contractCurrency;

          // Handle both string and object formats for currency
          if (typeof selectedCurrency === "string") {
            contractCurrency = selectedCurrency;
          } else if (selectedCurrency && typeof selectedCurrency === "object") {
            contractCurrency =
              selectedCurrency.symbol ||
              selectedCurrency.code ||
              selectedCurrency.value ||
              baseCurrency || "MYR";
          } else {
            contractCurrency = baseCurrency || "MYR";
          }

          const invoiceCurrency = invoiceData.currency;

          if (contractCurrency && contractCurrency !== invoiceCurrency) {
            try {
              const conversion = await convertCurrency(
                contractCurrency,
                invoiceCurrency,
                amount
              );
              amount = conversion.convertedAmount;
              notifySuccess(
                vi("amountConvertedFrom", "Amount converted from {{from}} to {{to}} (Rate: {{rate}})", { from: contractCurrency, to: invoiceCurrency, rate: conversion.exchangeRate })
              );
            } catch (error) {
              console.error("Currency conversion failed:", error);
              notifyError(vi("currencyConversionFailed", "Currency conversion failed. Using original amount."));
            }
          }
        }
      } else {
        // For expense, use user-entered description and amount
        description = addItemData.description;
        amount = parseFloat(addItemData.amount) || 0;
      }

      if (!description.trim()) {
        notifyError(vi("pleaseProvideItemDescription", "Please provide item description"));
        return;
      }

      if (amount <= 0) {
        notifyError(vi("amountMustBeGreaterThanZero", "Amount must be greater than 0"));
        return;
      }

      // Get full expense account object
      const expenseAccountObj = addItemData.expenseAccount
        ? expenseAccounts.find((acc) => acc._id === addItemData.expenseAccount)
        : null;

      // Add item to invoice
      const newItem = {
        id: invoiceData.items.length + 1,
        quantity: 1,
        itemName: description,
        description: description,
        unitPrice: amount,
        amount: amount,
        discount: 0,
        total: amount,
        tax: 0,
        taxRate: addItemData.taxRate || 0,
        taxId: addItemData.taxId || "",
        taxName: addItemData.taxName || "",
        contractId: selectedContract._id,
        contractNo: selectedContract.contractNo,
        itemType: addItemData.itemType,
        expenseAccount: expenseAccountObj,
        itemId:
          selectedContract.productInfo?.[0]?.item?._id ||
          selectedContract.productInfo?.[0]?.itemId ||
          null,
      };

      const updatedItems = [...invoiceData.items, newItem];
      const subtotal = updatedItems.reduce(
        (sum, item) => sum + (item.total || 0),
        0
      );
      const taxTotal = sumLineTaxAmountsFromItems(updatedItems);
      const discountAmount = (subtotal * invoiceData.discountPercentage) / 100;

      setInvoiceData({
        ...invoiceData,
        items: updatedItems,
        subtotal,
        taxTotal,
        discountAmount,
        total:
          subtotal -
          discountAmount +
          (parseFloat(invoiceData.shippingCharges) || 0) +
          (parseFloat(invoiceData.adjustment) || 0),
      });

      // Reset modal data
      setAddItemData({
        purchaseContract: "",
        salesContract: "",
        itemType: "cost_of_goods",
        contractType: "sales",
        description: "",
        amount: 0,
        expenseAccount: "",
      });
      setModalErrors({});
      setShowAddItemModal(false);
      notifySuccess(vi("itemAddedSuccessfully", "Item added successfully"));
    }
    // Handle Commission Agent Invoice
    else if (selectedInvoiceType === "commission") {
      if (addItemData.contractType === "purchase") {
        if (!addItemData.purchaseContract) {
          notifyError(vi("pleaseSelectPurchaseContract", "Please select a purchase contract"));
          return;
        }

        const selectedPurchaseContract = purchaseContracts.find(
          (c) => c._id === addItemData.purchaseContract
        );

        if (!selectedPurchaseContract) {
          notifyError(vi("selectedPurchaseContractNotFound", "Selected purchase contract not found"));
          return;
        }

        // Validate if this invoice type can be created for the selected contract
        let existingTypes = existingInvoiceTypes;
        if (selectedContractForValidation !== selectedPurchaseContract._id) {
          // Fetch validation data if not already available
          existingTypes = await fetchExistingInvoiceTypesForContract(
            selectedPurchaseContract._id,
            selectedPurchaseContract.contractNo
          );
        }

        if (
          !canCreateInvoiceType(
            selectedInvoiceType,
            selectedPurchaseContract._id,
            existingTypes
          )
        ) {
          const reason = getInvoiceTypeDisabledReason(
            selectedInvoiceType,
            selectedPurchaseContract._id,
            existingTypes
          );
          notifyError(reason);
          return;
        }

        // Get commission amount from purchase contract
        const totalAgentCommission =
          selectedPurchaseContract.productInfo?.[0]?.totalAgentCommission || 0;

        if (totalAgentCommission <= 0) {
          notifyError(
            vi("noCommissionAmountSet", "Selected purchase contract has no commission amount set")
          );
          return;
        }

        let commissionAmount = totalAgentCommission;

        // Currency conversion if needed
        if (
          selectedPurchaseContract.productInfo &&
          selectedPurchaseContract.productInfo.length > 0
        ) {
          const selectedCurrency =
            selectedPurchaseContract.productInfo[0].selectedCurrency;
          let contractCurrency;

          // Handle both string and object formats for currency
          if (typeof selectedCurrency === "string") {
            contractCurrency = selectedCurrency;
          } else if (selectedCurrency && typeof selectedCurrency === "object") {
            contractCurrency =
              selectedCurrency.symbol ||
              selectedCurrency.code ||
              selectedCurrency.value ||
              baseCurrency || "MYR";
          } else {
            contractCurrency = baseCurrency || "MYR";
          }

          const invoiceCurrency = invoiceData.currency;

          if (contractCurrency && contractCurrency !== invoiceCurrency) {
            try {
              const conversion = await convertCurrency(
                contractCurrency,
                invoiceCurrency,
                commissionAmount
              );
              commissionAmount = conversion.convertedAmount;
              notifySuccess(
                vi("commissionAmountConvertedFrom", "Commission amount converted from {{from}} to {{to}} (Rate: {{rate}})", { from: contractCurrency, to: invoiceCurrency, rate: conversion.exchangeRate })
              );
            } catch (error) {
              console.error("Currency conversion failed:", error);
              notifyError(vi("currencyConversionFailed", "Currency conversion failed. Using original amount."));
            }
          }
        }

        if (commissionAmount <= 0) {
          notifyError(vi("commissionAmountMustBeGreaterThanZero", "Commission amount must be greater than 0"));
          return;
        }

        const description = addItemData.description || "Commission";
        const contractNoDisplay = `(${selectedPurchaseContract.contractNo})`;

        // Get full expense account object
        const expenseAccountObj = addItemData.expenseAccount
          ? expenseAccounts.find(
              (acc) => acc._id === addItemData.expenseAccount
            )
          : null;

        // Add commission item to invoice
        const newItem = {
          id: invoiceData.items.length + 1,
          quantity: 1,
          itemName: `${description} ${contractNoDisplay}`,
          description: `${description} ${contractNoDisplay}`,
          unitPrice: commissionAmount,
          amount: commissionAmount,
          discount: 0,
          total: commissionAmount,
          tax: 0,
          taxRate: addItemData.taxRate || 0,
          taxId: addItemData.taxId || "",
          taxName: addItemData.taxName || "",
          contractId: selectedPurchaseContract._id,
          contractNo: selectedPurchaseContract.contractNo,
          itemType: "commission",
          contractType: "purchase",
          totalAgentCommission: totalAgentCommission,
          expenseAccount: expenseAccountObj,
          itemId: selectedPurchaseContract.productInfo?.[0]?.item || null,
        };

        const updatedItems = [...invoiceData.items, newItem];
        const subtotal = updatedItems.reduce(
          (sum, item) => sum + (item.total || 0),
          0
        );
        const taxTotal = sumLineTaxAmountsFromItems(updatedItems);
        const discountAmount =
          (subtotal * invoiceData.discountPercentage) / 100;

        setInvoiceData({
          ...invoiceData,
          items: updatedItems,
          subtotal,
          taxTotal,
          discountAmount,
          total:
            subtotal -
            discountAmount +
            (parseFloat(invoiceData.shippingCharges) || 0) +
            (parseFloat(invoiceData.adjustment) || 0),
        });

        // Reset modal data
        setAddItemData({
          purchaseContract: "",
          salesContract: "",
          itemType: "cost_of_goods",
          contractType: "sales",
          description: "",
          amount: 0,
        });
        setModalErrors({});
        setShowAddItemModal(false);
        notifySuccess(vi("commissionItemAddedSuccessfully", "Commission item added successfully"));
        return;
      }

      if (!addItemData.salesContract) {
        notifyError(vi("pleaseSelectSalesContract", "Please select a sales contract"));
        return;
      }

      const selectedSalesContract = salesContracts.find(
        (c) => c._id === addItemData.salesContract
      );

      if (!selectedSalesContract) {
        notifyError(vi("selectedSalesContractNotFound", "Selected sales contract not found"));
        return;
      }

      // Validate if this invoice type can be created for the selected contract
      let existingTypes = existingInvoiceTypes;
      if (selectedContractForValidation !== selectedSalesContract._id) {
        // Fetch validation data if not already available
        existingTypes = await fetchExistingInvoiceTypesForContract(
          selectedSalesContract._id,
          selectedSalesContract.contractNo
        );
      }

      if (
        !canCreateInvoiceType(
          selectedInvoiceType,
          selectedSalesContract._id,
          existingTypes
        )
      ) {
        const reason = getInvoiceTypeDisabledReason(
          selectedInvoiceType,
          selectedSalesContract._id,
          existingTypes
        );
        notifyError(reason);
        return;
      }

      // Get commission amount from sales contract
      const totalAgentCommission =
        selectedSalesContract.productInfo?.[0]?.totalAgentCommission || 0;

      let commissionAmount = totalAgentCommission;

      // Currency conversion if needed
      if (
        selectedSalesContract.productInfo &&
        selectedSalesContract.productInfo.length > 0
      ) {
        const selectedCurrency =
          selectedSalesContract.productInfo[0].selectedCurrency;
        let contractCurrency;

        // Handle both string and object formats for currency
        if (typeof selectedCurrency === "string") {
          contractCurrency = selectedCurrency;
        } else if (selectedCurrency && typeof selectedCurrency === "object") {
          contractCurrency =
            selectedCurrency.symbol ||
            selectedCurrency.code ||
            selectedCurrency.value ||
            baseCurrency || "MYR";
        } else {
          contractCurrency = baseCurrency || "MYR";
        }

        const invoiceCurrency = invoiceData.currency;

        if (contractCurrency && contractCurrency !== invoiceCurrency) {
          try {
            const conversion = await convertCurrency(
              contractCurrency,
              invoiceCurrency,
              commissionAmount
            );
            commissionAmount = conversion.convertedAmount;
            notifySuccess(
              vi("commissionAmountConvertedFrom", "Commission amount converted from {{from}} to {{to}} (Rate: {{rate}})", { from: contractCurrency, to: invoiceCurrency, rate: conversion.exchangeRate })
            );
          } catch (error) {
            console.error("Currency conversion failed:", error);
            notifyError(vi("currencyConversionFailed", "Currency conversion failed. Using original amount."));
          }
        }
      }

      if (commissionAmount <= 0) {
        notifyError(vi("commissionAmountMustBeGreaterThanZero", "Commission amount must be greater than 0"));
        return;
      }

      const description = addItemData.description || "Commission";
      const contractNoDisplay = `(${selectedSalesContract.contractNo})`;

      // Get full expense account object
      const expenseAccountObj = addItemData.expenseAccount
        ? expenseAccounts.find((acc) => acc._id === addItemData.expenseAccount)
        : null;

      // Add commission item to invoice
      const newItem = {
        id: invoiceData.items.length + 1,
        quantity: 1,
        itemName: `${description} ${contractNoDisplay}`,
        description: `${description} ${contractNoDisplay}`,
        unitPrice: commissionAmount,
        amount: commissionAmount,
        discount: 0,
        total: commissionAmount,
        tax: 0,
        taxRate: addItemData.taxRate || 0,
        taxId: addItemData.taxId || "",
        taxName: addItemData.taxName || "",
        contractId: selectedSalesContract._id,
        contractNo: selectedSalesContract.contractNo,
        itemType: "commission",
        contractType: "sales",
        totalAgentCommission: totalAgentCommission,
        expenseAccount: expenseAccountObj,
        itemId:
          selectedSalesContract.productInfo?.[0]?.item?._id ||
          selectedSalesContract.productInfo?.[0]?.itemId ||
          null,
      };

      const updatedItems = [...invoiceData.items, newItem];
      const subtotal = updatedItems.reduce(
        (sum, item) => sum + (item.total || 0),
        0
      );
      const taxTotal = sumLineTaxAmountsFromItems(updatedItems);
      const discountAmount = (subtotal * invoiceData.discountPercentage) / 100;

      setInvoiceData({
        ...invoiceData,
        items: updatedItems,
        subtotal,
        taxTotal,
        discountAmount,
        total:
          subtotal -
          discountAmount +
          (parseFloat(invoiceData.shippingCharges) || 0) +
          (parseFloat(invoiceData.adjustment) || 0),
      });

      // Reset modal data
      setAddItemData({
        purchaseContract: "",
        salesContract: "",
        itemType: "cost_of_goods",
        contractType: "sales",
        description: "",
        amount: 0,
        expenseAccount: "",
      });
      setModalErrors({});
      setShowAddItemModal(false);
      notifySuccess(vi("commissionItemAddedSuccessfully", "Commission item added successfully"));
    }
    // Handle Logistic Service Provider Invoice
    else if (selectedInvoiceType === "logistic") {
      if (!addItemData.purchaseContract) {
        notifyError(vi("pleaseSelectPurchaseContract", "Please select a purchase contract"));
        return;
      }

      if (!addItemData.description || addItemData.description.trim() === "") {
        notifyError(vi("pleaseEnterLogisticDescription", "Please enter a description for the logistic service"));
        return;
      }

      if (!addItemData.amount || addItemData.amount <= 0) {
        notifyError(vi("pleaseEnterValidAmount", "Please enter a valid amount"));
        return;
      }

      const selectedContract = purchaseContracts.find(
        (c) => c._id === addItemData.purchaseContract
      );

      if (!selectedContract) {
        notifyError(vi("selectedContractNotFound", "Selected contract not found"));
        return;
      }

      // Validate if this invoice type can be created for the selected contract
      let existingTypes = existingInvoiceTypes;
      if (selectedContractForValidation !== selectedContract._id) {
        // Fetch validation data if not already available
        existingTypes = await fetchExistingInvoiceTypesForContract(
          selectedContract._id,
          selectedContract.contractNo
        );
      }

      if (
        !canCreateInvoiceType(
          selectedInvoiceType,
          selectedContract._id,
          existingTypes
        )
      ) {
        const reason = getInvoiceTypeDisabledReason(
          selectedInvoiceType,
          selectedContract._id,
          existingTypes
        );
        notifyError(reason);
        return;
      }

      // Get full expense account object
      const expenseAccountObj = addItemData.expenseAccount
        ? expenseAccounts.find((acc) => acc._id === addItemData.expenseAccount)
        : null;

      // Add logistic service item to invoice
      const amount = parseFloat(addItemData.amount) || 0;
      const desc = addItemData.description || "Logistic Service";
      const newItem = {
        id: invoiceData.items.length + 1,
        itemName: desc,
        description: desc,
        quantity: 1,
        unitPrice: amount,
        amount: amount,
        total: amount, // Add total field for display
        tax: 0,
        taxRate: addItemData.taxRate || 0,
        taxId: addItemData.taxId || "",
        taxName: addItemData.taxName || "",
        currency:
          addItemData.currency ||
          invoiceData.currency ||
          baseCurrency ||
          "MYR", // Add currency
        contractId: selectedContract._id,
        contractNo: selectedContract.contractNo,
        itemType: "logistic_service",
        contractType: "purchase",
        expenseAccount: expenseAccountObj,
      };

      const updatedItems = [...invoiceData.items, newItem];
      const subtotal = updatedItems.reduce(
        (sum, item) => sum + (item.total || 0),
        0
      );
      const taxTotal = sumLineTaxAmountsFromItems(updatedItems);
      const discountAmount = (subtotal * invoiceData.discountPercentage) / 100;

      setInvoiceData((prev) => ({
        ...prev,
        items: updatedItems,
        subtotal: subtotal,
        taxTotal,
        discountAmount: discountAmount,
        total:
          subtotal -
          discountAmount +
          (prev.shippingCharges || 0) +
          (prev.adjustment || 0),
        purchaseContract: selectedContract._id,
      }));

      // Reset form
      setAddItemData({
        purchaseContract: "",
        salesContract: "",
        itemType: "logistic_service",
        contractType: "purchase",
        description: "",
        amount: 0,
        currency: "",
        expenseAccount: "",
      });
      setModalErrors({});
      setShowAddItemModal(false);
      notifySuccess(vi("logisticServiceItemAddedSuccessfully", "Logistic service item added successfully"));
    }
  };

  const handleRemoveItem = (index) => {
    const updatedItems = invoiceData.items.filter((_, i) => i !== index);
    const subtotal = updatedItems.reduce(
      (sum, item) => sum + (item.total || 0),
      0
    );
    const taxTotal = sumLineTaxAmountsFromItems(updatedItems);
    const discountAmount = (subtotal * invoiceData.discountPercentage) / 100;

    setInvoiceData({
      ...invoiceData,
      items: updatedItems,
      subtotal,
      taxTotal,
      discountAmount,
      total:
        subtotal -
        discountAmount +
        (parseFloat(invoiceData.shippingCharges) || 0) +
        (parseFloat(invoiceData.adjustment) || 0),
    });

    notifySuccess(vi("itemRemovedSuccessfully", "Item removed successfully"));
  };

  // Handle bulk add items (merge by itemId: same product increases quantity, different product adds new row)
  const handleBulkAddItems = (newItems) => {
    if (!newItems || newItems.length === 0) return;

    const formattedItems = newItems.map((item) => {
      const quantity = item.quantity || 1;
      const taxOnItem =
        item.purchaseInformation?.taxOnItem || item.salesInformation?.taxOnItem;
      const unitPrice =
        item.unitPrice ||
        item.purchaseInformation?.costPrice ||
        item.salesInformation?.sellingPrice ||
        0;
      const taxRate =
        taxOnItem?.rate ?? taxOnItem?.percentage ?? 0;
      const lineSubtotal = quantity * unitPrice;
      const taxAmount = (lineSubtotal * taxRate) / 100;
      const itemName = item.name || item.description || "";
      return {
        id: `bulk-${Date.now()}-${Math.random()}`,
        itemId: item.itemId || item._id || "",
        itemName: itemName,
        description: itemName,
        itemType: "cost_of_goods",
        quantity: quantity,
        unitPrice: unitPrice,
        discount: 0,
        tax: taxAmount,
        taxRate: taxRate,
        taxId: taxOnItem?._id || "",
        taxName: taxOnItem?.name || "",
        total: Math.max(0, lineSubtotal + taxAmount),
        expenseAccount: invoiceData.expenseAccount || "",
      };
    });

    const existingItems = invoiceData.items || [];
    const merged = [...existingItems];

    for (const newItem of formattedItems) {
      const itemId = newItem.itemId;
      if (!itemId) {
        merged.push(newItem);
        continue;
      }
      const existingIndex = merged.findIndex(
        (it) => !it.isAdvancePayment && String(it.itemId) === String(itemId)
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

    const subtotal = merged.reduce(
      (sum, item) => sum + (item.total || 0),
      0
    );
    const taxTotal = sumLineTaxAmountsFromItems(merged);
    const discountAmount = (subtotal * invoiceData.discountPercentage) / 100;
    const total = Math.max(
      0,
      subtotal -
        discountAmount +
        (invoiceData.shippingCharges || 0) +
        (invoiceData.adjustment || 0)
    );

    setInvoiceData((prev) => ({
      ...prev,
      items: merged,
      subtotal,
      taxTotal,
      discountAmount,
      total,
    }));

    notifySuccess(vi("bulkItemsAdded", "{{count}} item(s) added successfully", { count: newItems.length }));
  };

  // Handler for purchase contract selection
  const handlePurchaseContractChange = async (contractId) => {
    const selectedContract = purchaseContracts.find(
      (c) => c._id === contractId
    );

    // Auto-populate description from product info based on invoice type
    let autoDescription = "";
    if (selectedContract) {
      if (selectedInvoiceType === "commission") {
        // Build detailed commission description from product info
        const productInfo = selectedContract.productInfo?.[0];
        if (productInfo) {
          autoDescription = productInfo.title
            ? `${productInfo.title} - ${productInfo.quantityMTS || 0} MTS @ $${
                productInfo.price || 0
              }/MT`
            : "Commission";
        } else {
          autoDescription = "Commission";
        }
      } else if (
        selectedInvoiceType === "supplier" &&
        addItemData.itemType === "cost_of_goods"
      ) {
        // Populate from product info
        const productDescription =
          selectedContract.productInfo
            ?.map(
              (product) =>
                `${product.title} - ${product.quantityMTS} MTS @ $${product.price}/MT`
            )
            .join(", ") || "";
        autoDescription = productDescription
          ? `${productDescription} (${selectedContract.contractNo})`
          : "";
      } else if (selectedInvoiceType === "logistic") {
        autoDescription = `Logistic service for ${selectedContract.contractNo}`;
      }
    }

    setAddItemData({
      ...addItemData,
      purchaseContract: contractId,
      description: autoDescription,
    });

    if (contractId) {
      if (selectedContract) {
        // Fetch existing invoice types and get immediate data for validation
        const existingTypes = await fetchExistingInvoiceTypesForContract(
          selectedContract._id,
          selectedContract.contractNo
        );

        // Check if current invoice type can be created for this contract using immediate data
        if (existingTypes.includes(selectedInvoiceType)) {
          notifyError(
            getInvoiceTypeDisabledReason(
              selectedInvoiceType,
              contractId,
              existingTypes
            )
          );
        }
      }
    } else {
      // Clear validation when no contract selected
      setExistingInvoiceTypes([]);
      setSelectedContractForValidation(null);
    }
  };

  // Handler for sales contract selection
  const handleSalesContractChange = async (contractId) => {
    const selectedContract = salesContracts.find((c) => c._id === contractId);

    // Auto-populate description from product info for commission invoices
    let autoDescription = "";
    if (selectedContract && selectedInvoiceType === "commission") {
      // Build detailed commission description from product info
      const productInfo = selectedContract.productInfo?.[0];
      if (productInfo) {
        autoDescription = productInfo.title
          ? `${productInfo.title} - ${productInfo.quantityMTS || 0} MTS @ $${
              productInfo.price || 0
            }/MT`
          : "Commission";
      } else {
        autoDescription = "Commission";
      }
    }

    setAddItemData({
      ...addItemData,
      salesContract: contractId,
      description: autoDescription,
    });

    if (contractId) {
      if (selectedContract) {
        // Fetch existing invoice types and get immediate data for validation
        const existingTypes = await fetchExistingInvoiceTypesForContract(
          selectedContract._id,
          selectedContract.contractNo
        );

        // Check if current invoice type can be created for this contract using immediate data
        if (existingTypes.includes(selectedInvoiceType)) {
          notifyError(
            getInvoiceTypeDisabledReason(
              selectedInvoiceType,
              contractId,
              existingTypes
            )
          );
        }
      }
    } else {
      // Clear validation when no contract selected
      setExistingInvoiceTypes([]);
      setSelectedContractForValidation(null);
    }
  };

  // Handler for invoice type change
  const handleInvoiceTypeChange = async (newInvoiceType) => {
    setSelectedInvoiceType(newInvoiceType);

    // Re-validate any already selected contracts with the new invoice type
    const currentContractId =
      newInvoiceType === "supplier"
        ? addItemData.purchaseContract
        : addItemData.salesContract;

    if (currentContractId) {
      // Get current contract details to refetch validation data
      const currentContract =
        newInvoiceType === "supplier"
          ? purchaseContracts.find((c) => c._id === currentContractId)
          : salesContracts.find((c) => c._id === currentContractId);

      if (currentContract) {
        // Fetch fresh validation data for the current contract
        const existingTypes = await fetchExistingInvoiceTypesForContract(
          currentContract._id,
          currentContract.contractNo
        );

        // Check if the new invoice type can be created for the currently selected contract
        if (existingTypes.includes(newInvoiceType)) {
          notifyError(
            getInvoiceTypeDisabledReason(
              newInvoiceType,
              currentContractId,
              existingTypes
            )
          );
        }
      }
    }
  };

  const validateForm = () => {
    const errors = {};
    if (!invoiceData.business) errors.business = vi("businessRequired", "Business is required.");
    if (!selectedVendor) errors.vendor = vi("vendorRequired", "Vendor is required.");
    if (!invoiceNumber) errors.invoiceNumber = vi("invoiceNumberRequired", "Invoice number is required.");
    if (!invoiceData.items || invoiceData.items.length === 0)
      errors.items = vi("atLeastOneItemRequired", "At least one item is required.");
    return errors;
  };

  const handleSubmit = async (status) => {
    const errors = validateForm();
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    if (invoiceData.business) {
      try {
        const defs = await fetchDefinitions(
          {
            businessId: invoiceData.business,
            module: "purchase",
            screen: "vendor_invoice",
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
          e?.response?.data?.message || vi("couldNotValidateCustomFields", "Could not validate custom fields."),
        );
        return;
      }
    }

    setIsLoading(true);

    try {
      const invoiceDataToSubmit = {
        business: invoiceData.business,
        vendor: selectedVendor?._id,
        invoiceNumber: invoiceNumber,
        invoiceDate: new Date(invoiceData.invoiceDate),
        invoiceType: selectedInvoiceType, // Use selectedInvoiceType
        dueDate: new Date(invoiceData.dueDate),
        terms: invoiceData.terms,
        // Link to Vendor Payment Term master by ID (while still sending terms name for backward compatibility)
        ...(invoiceData.paymentTermId && { paymentTermId: invoiceData.paymentTermId }),
        vendorBankAccount: selectedVendorAccount?._id,
        items: invoiceData.items.map((item) => {
          const itemExpenseAccountId = item.expenseAccount?._id || item.expenseAccount;
          const qty = item.quantity || 1;
          const unitPrice = item.unitPrice || item.amount || 0;
          const lineSubtotal = qty * unitPrice * (1 - (parseFloat(item.discount) || 0) / 100);
          const taxRate = parseFloat(item.taxRate) || 0;
          const taxAmount = taxRate > 0 ? (lineSubtotal * taxRate) / 100 : (item.tax || 0);
          let itemNameVal = (item.itemName || item.description || "").trim();
          let descVal = (item.description || item.itemName || "").trim();
          if (!itemNameVal && !descVal && item.itemId) {
            const itemIdStr = typeof item.itemId === "object" && item.itemId?._id ? String(item.itemId._id) : String(item.itemId || "");
            const bi = businessItems.find((b) => String(b._id) === itemIdStr) || (typeof item.itemId === "object" ? item.itemId : null);
            const fallback = bi?.name || bi?.purchaseInformation?.description || bi?.salesInformation?.description || bi?.itemCode || "";
            itemNameVal = fallback;
            descVal = fallback;
          }
          const finalItemName = itemNameVal || descVal;
          const finalDesc = descVal || itemNameVal;
          return {
          itemName: finalItemName,
          description: finalDesc,
          quantity: qty,
          unitPrice: unitPrice,
          amount:
            item.amount ||
            item.total ||
            qty * unitPrice,
          // Contract Information
          contractId: item.contractId,
          contractNo: item.contractNo,
          // Item Type Information
          itemType: item.itemType,
          contractType: item.contractType,
          // Commission-specific fields
          totalAgentCommission: item.totalAgentCommission,
          commissionPerMTS: item.commissionPerMTS,
          contractValue: item.contractValue,
          // Expense Account: only send valid ObjectId (omit empty string to avoid Cast error)
          ...(itemExpenseAccountId && itemExpenseAccountId !== "" && { expenseAccount: itemExpenseAccountId }),
          // Item reference - omit when empty to allow description-only line items
          ...(item.itemId && item.itemId !== "" && { itemId: item.itemId }),
          // Tax fields (aligned with customer invoice)
          tax: taxAmount,
          taxRate: taxRate,
          taxId: item.taxId || undefined,
          taxName: item.taxName || "",
          // Additional metadata
          discount: item.discount || 0,
          total:
            item.total ||
            item.amount ||
            qty * unitPrice,
          ...(item.lineItemCustomFields &&
          typeof item.lineItemCustomFields === "object" &&
          Object.keys(item.lineItemCustomFields).length > 0
            ? { lineItemCustomFields: item.lineItemCustomFields }
            : {}),
          };
        }),
        subtotal: invoiceData.subtotal,
        discount: invoiceData.discountPercentage,
        discountAmount: invoiceData.discountAmount,
        total: invoiceData.total,
        currency: invoiceData.currency,
        expenseAccount:
          invoiceData.expenseAccount?._id || invoiceData.expenseAccount || null,
        status: status,
        supportingDocuments: invoiceData.supportingDocuments,
      };
      console.log("invoiceDataToSubmit", invoiceDataToSubmit);

      const response = await axios.put(
        `${Base_URL}/vendor-invoices/${id}`,
        invoiceDataToSubmit,
        { headers }
      );

      if (response.data.success) {
        if (id && invoiceData.business) {
          try {
            await upsertValues(
              {
                business_id: invoiceData.business,
                module: "purchase",
                screen: "vendor_invoice",
                record_id: String(id),
                values: invoiceCustomFieldValues,
              },
              headers,
            );
          } catch (cfErr) {
            notifyError(
              cfErr?.response?.data?.message ||
                vi("updateCustomFieldsSaveFailed", "Invoice updated but custom fields failed to save."),
            );
            setIsLoading(false);
            return;
          }
        }
        notifySuccess(vi("updatedSuccess", "Invoice updated successfully"));
        history.push("/vendor-invoices");
      } else {
        const code = response.data?.error || response.data?.code;
        if (code === "PO_QTY_EXCEEDED") {
          notifyError(
            vi("poQtyExceeded", "The quantity on this bill exceeds the remaining quantity on the linked Purchase Order. Please reduce the quantity to the remaining PO quantity and try again.")
          );
        } else {
          notifyError(response.data.error || vi("failedToUpdateInvoice", "Failed to update invoice"));
        }
      }
    } catch (error) {
      console.error("Error updating invoice:", error);
      notifyError(getFriendlyVendorInvoiceError(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVendorAccountChange = async (e) => {
    setInvoiceData({ ...invoiceData, vendorAccount: e.target.value });
    try {
      const response = await axios.get(
        `${Base_URL}/bank-managements/accounts/${e.target.value}`
      );
      setSelectedVendorAccount(response.data);
    } catch (error) {
      console.log("error", error);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploading(true);
      setUploadSuccess(false);

      const formDataForUpload = new FormData();
      formDataForUpload.append("file_path", `VendorInvoices/${invoiceNumber}`);
      formDataForUpload.append("business_id", invoiceData?.business);
      formDataForUpload.append("customer_id", adminInfo?.id);
      formDataForUpload.append("file_type", file.type);
      formDataForUpload.append("file_size", file.size);
      formDataForUpload.append("file", file);

      try {
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

          const newDoc = {
            fileId: uploadedFile._id,
            name: uploadedFile.name,
            url: uploadedFile.url || "#",
            downloadUrl: uploadedFile.downloadUrl || "#",
            uploadedAt: new Date().toISOString(),
            size: file.size,
            type: file.type,
            documentType: "Supporting",
          };

          setInvoiceData((prev) => ({
            ...prev,
            supportingDocument: newDoc,
            supportingDocuments: [...(prev.supportingDocuments || []), newDoc],
          }));

          // reset file input so same file can be re-uploaded if needed
          if (fileInputRef.current) fileInputRef.current.value = "";

          setSuccessMessage(vi("fileUploadedSuccessfully", "File uploaded successfully!"));
          setUploadSuccess(true);

          setTimeout(() => {
            setUploadSuccess(false);
            setSuccessMessage("");
          }, 3000);
        }
      } catch (error) {
        console.error("File upload error:", error);
        notifyError(vi("fileUploadFailed", "File upload failed. Please try again."));
      } finally {
        setUploading(false);
        setUploadProgress(0);
      }
    }
  };

  const handleOpenFile = async (documentId) => {
    if (!documentId) return;

    try {
      let response = await axios.get(
        `${Base_URL}/documents/getFileWithAllData/${documentId}`
      );
      window.open(response.data.data.url, "_blank");
    } catch (error) {
      notifyError(vi("errorGettingFile", "Error getting file"));
      console.log("Error: ", error);
    }
  };

  const handleRemoveDocument = (fileId) => {
    setInvoiceData((prev) => {
      const updated = (prev.supportingDocuments || []).filter(
        (d) => d.fileId !== fileId
      );
      return {
        ...prev,
        supportingDocuments: updated,
        supportingDocument: updated.length > 0 ? updated[updated.length - 1] : null,
      };
    });
  };

  // Populate description from product info when modal opens with selected contract
  useEffect(() => {
    if (showAddItemModal) {
      // Populate description from product info if contract is already selected
      if (selectedInvoiceType === "supplier" && addItemData.purchaseContract) {
        const selectedContract = purchaseContracts.find(
          (c) => c._id === addItemData.purchaseContract
        );
        if (selectedContract && addItemData.itemType === "cost_of_goods") {
          const autoDescription =
            selectedContract.productInfo
              ?.map(
                (product) =>
                  `${product.title} - ${product.quantityMTS} MTS @ $${product.price}/MT`
              )
              .join(", ") || "";
          if (autoDescription && addItemData.description !== autoDescription) {
            setAddItemData((prev) => ({
              ...prev,
              description: autoDescription,
            }));
          }
        }
      } else if (selectedInvoiceType === "commission") {
        if (addItemData.contractType === "sales" && addItemData.salesContract) {
          const selectedContract = salesContracts.find(
            (c) => c._id === addItemData.salesContract
          );
          if (selectedContract) {
            const productInfo = selectedContract.productInfo?.[0];
            if (productInfo) {
              const autoDescription = productInfo.title
                ? `${productInfo.title} - ${
                    productInfo.quantityMTS || 0
                  } MTS @ $${productInfo.price || 0}/MT`
                : "Commission";
              if (
                autoDescription &&
                addItemData.description !== autoDescription
              ) {
                setAddItemData((prev) => ({
                  ...prev,
                  description: autoDescription,
                }));
              }
            }
          }
        } else if (
          addItemData.contractType === "purchase" &&
          addItemData.purchaseContract
        ) {
          const selectedContract = purchaseContracts.find(
            (c) => c._id === addItemData.purchaseContract
          );
          if (selectedContract) {
            const productInfo = selectedContract.productInfo?.[0];
            if (productInfo) {
              const autoDescription = productInfo.title
                ? `${productInfo.title} - ${
                    productInfo.quantityMTS || 0
                  } MTS @ $${productInfo.price || 0}/MT`
                : "Commission";
              if (
                autoDescription &&
                addItemData.description !== autoDescription
              ) {
                setAddItemData((prev) => ({
                  ...prev,
                  description: autoDescription,
                }));
              }
            }
          }
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    showAddItemModal,
    addItemData.purchaseContract,
    addItemData.salesContract,
    addItemData.contractType,
  ]);

  const renderAddItemModal = () => {
    if (!showAddItemModal) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">
              {vi("addNewItem", "Add New Item")}
            </h3>
            <button
              onClick={() => setShowAddItemModal(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
          </div>

          <div className="space-y-4">
            {/* Contract Type Selection for Commission Agent */}
            {selectedInvoiceType === "commission" && (
              <div>
                <label className="block text-gray-700 mb-2">
                  {vi("contractType", "Contract Type")} *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setAddItemData({
                        ...addItemData,
                        contractType: "sales",
                        purchaseContract: "",
                        salesContract: "",
                      })
                    }
                    className={`p-3 rounded-lg border-2 transition-all ${
                      addItemData.contractType === "sales"
                        ? "border-[var(--p-blue)] bg-[#f0fbf7] text-[var(--p-blue)]"
                        : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                    }`}
                  >
                    <FileText size={20} className="mx-auto mb-1" />
                    <span className="text-sm font-medium">{vi("salesContract", "Sales Contract")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setAddItemData({
                        ...addItemData,
                        contractType: "purchase",
                        purchaseContract: "",
                        salesContract: "",
                      })
                    }
                    className={`p-3 rounded-lg border-2 transition-all ${
                      addItemData.contractType === "purchase"
                        ? "border-[var(--p-blue)] bg-[#f0fbf7] text-[var(--p-blue)]"
                        : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                    }`}
                  >
                    <Package size={20} className="mx-auto mb-1" />
                    <span className="text-sm font-medium">
                      {vi("purchaseContract", "Purchase Contract")}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Contract Selection */}
            {selectedInvoiceType === "supplier" && (
              <div>
                <label className="block text-gray-700 mb-2">
                  {vi("purchaseContract", "Purchase Contract")} *
                </label>
                <SearchableDropdown
                  value={addItemData.purchaseContract}
                  onChange={(e) => {
                    const selectedContract = purchaseContracts.find(
                      (c) => c._id === e.target.value
                    );

                    // Auto-populate description from product info
                    let autoDescription = "";
                    if (selectedContract) {
                      if (
                        selectedInvoiceType === "supplier" &&
                        addItemData.itemType === "cost_of_goods"
                      ) {
                        autoDescription =
                          selectedContract.productInfo
                            ?.map(
                              (product) =>
                                `${product.title} - ${product.quantityMTS} MTS @ $${product.price}/MT`
                            )
                            .join(", ") || "";
                      } else if (selectedInvoiceType === "commission") {
                        const productInfo = selectedContract.productInfo?.[0];
                        if (productInfo) {
                          autoDescription = productInfo.title
                            ? `${productInfo.title} - ${
                                productInfo.quantityMTS || 0
                              } MTS @ $${productInfo.price || 0}/MT`
                            : "Commission";
                        } else {
                          autoDescription = "Commission";
                        }
                      }
                    }

                    setAddItemData({
                      ...addItemData,
                      purchaseContract: e.target.value,
                      description: autoDescription,
                    });

                    handlePurchaseContractChange(e.target.value);
                    // Clear error when field is filled
                    if (modalErrors.purchaseContract) {
                      setModalErrors({
                        ...modalErrors,
                        purchaseContract: "",
                      });
                    }
                  }}
                  placeholder={vi("selectPurchaseContract", "Select Purchase Contract")}
                  searchPlaceholder={vi("searchPurchaseContracts", "Search purchase contracts...")}
                  options={purchaseContracts.map((contract) => ({
                    value: contract._id,
                    label: `${contract.contractNo} - ${contract.basicInfo?.selectedVendorId?.basicInformation?.companyName}`,
                  }))}
                />
                {modalErrors.purchaseContract && (
                  <div className="text-red-500 text-xs mt-1">
                    {modalErrors.purchaseContract}
                  </div>
                )}
              </div>
            )}

            {/* Purchase Contract Selection for Logistic Service Provider */}
            {selectedInvoiceType === "logistic" && (
              <div>
                <label className="block text-gray-700 mb-2">
                  {vi("purchaseContract", "Purchase Contract")} *
                </label>
                {!invoiceData?.business ? (
                  <div className="p-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-500">
                    {vi("selectBusinessFirst", "Please select a business first")}
                  </div>
                ) : purchaseContracts.length === 0 ? (
                  <div className="p-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-500">
                    {vi("noPurchaseContractsForBusiness", "No purchase contracts available for this business")}
                  </div>
                ) : (
                  <SearchableDropdown
                    value={addItemData.purchaseContract}
                    onChange={(e) => {
                      handlePurchaseContractChange(e.target.value);
                      // Clear error when field is filled
                      if (modalErrors.purchaseContract) {
                        setModalErrors({
                          ...modalErrors,
                          purchaseContract: "",
                        });
                      }
                    }}
                    placeholder={vi("selectPurchaseContract", "Select Purchase Contract")}
                    searchPlaceholder={vi("searchPurchaseContracts", "Search purchase contracts...")}
                    options={purchaseContracts.map((contract) => ({
                      value: contract._id,
                      label: `${contract.contractNo} - ${contract.basicInfo?.selectedVendorId?.basicInformation?.companyName}`,
                    }))}
                  />
                )}
                {modalErrors.purchaseContract && (
                  <div className="text-red-500 text-xs mt-1">
                    {modalErrors.purchaseContract}
                  </div>
                )}
              </div>
            )}

            {/* Purchase Contract Selection for Commission Agent */}
            {selectedInvoiceType === "commission" &&
              addItemData.contractType === "purchase" && (
                <div>
                  <label className="block text-gray-700 mb-2">
                    {vi("purchaseContract", "Purchase Contract")} *
                  </label>
                  <SearchableDropdown
                    value={addItemData.purchaseContract}
                    onChange={(e) => {
                      const selectedContract = purchaseContracts.find(
                        (c) => c._id === e.target.value
                      );

                      // Auto-populate description from product info for commission
                      let autoDescription = "";
                      if (
                        selectedContract &&
                        selectedInvoiceType === "commission"
                      ) {
                        const productInfo = selectedContract.productInfo?.[0];
                        if (productInfo) {
                          autoDescription = productInfo.title
                            ? `${productInfo.title} - ${
                                productInfo.quantityMTS || 0
                              } MTS @ $${productInfo.price || 0}/MT`
                            : "Commission";
                        } else {
                          autoDescription = "Commission";
                        }
                      }

                      setAddItemData((prev) => ({
                        ...prev,
                        purchaseContract: e.target.value,
                        description: autoDescription || prev.description,
                      }));

                      handlePurchaseContractChange(e.target.value);
                      // Clear error when field is filled
                      if (modalErrors.purchaseContract) {
                        setModalErrors({
                          ...modalErrors,
                          purchaseContract: "",
                        });
                      }
                    }}
                    placeholder={vi("selectPurchaseContract", "Select Purchase Contract")}
                    searchPlaceholder={vi("searchPurchaseContracts", "Search purchase contracts...")}
                    options={purchaseContracts
                      .filter((contract) => {
                        // For commission invoices, only show contracts where selected agent is involved
                        if (
                          selectedInvoiceType === "commission" &&
                          selectedVendor
                        ) {
                          return (
                            contract.basicInfo?.agent_id === selectedVendor._id
                          );
                        }
                        return true;
                      })
                      .map((contract) => ({
                        value: contract._id,
                        label: `${contract.contractNo} - ${
                          contract.basicInfo?.selectedVendorId?.basicInformation
                            ?.vendorDisplayName || vi("vendor", "Vendor")
                        }${
                          contract.productInfo?.[0]?.totalAgentCommission
                            ? ` ($${contract.productInfo[0].totalAgentCommission.toLocaleString()} ${vi("commissionSuffix", "commission")})`
                            : ""
                        }`,
                      }))}
                  />
                  {modalErrors.purchaseContract && (
                    <div className="text-red-500 text-xs mt-1">
                      {modalErrors.purchaseContract}
                    </div>
                  )}
                </div>
              )}

            {/* Sales Contract Selection for Commission Agent */}
            {selectedInvoiceType === "commission" &&
              addItemData.contractType === "sales" && (
                <div>
                  <label className="block text-gray-700 mb-2">
                    {vi("salesContract", "Sales Contract")} *
                  </label>
                  <SearchableDropdown
                    value={addItemData.salesContract}
                    onChange={(e) => {
                      const selectedContract = salesContracts.find(
                        (c) => c._id === e.target.value
                      );

                      // Auto-populate description from product info for commission
                      let autoDescription = "";
                      if (
                        selectedContract &&
                        selectedInvoiceType === "commission"
                      ) {
                        const productInfo = selectedContract.productInfo?.[0];
                        if (productInfo) {
                          autoDescription = productInfo.title
                            ? `${productInfo.title} - ${
                                productInfo.quantityMTS || 0
                              } MTS @ $${productInfo.price || 0}/MT`
                            : "Commission";
                        } else {
                          autoDescription = "Commission";
                        }
                      }

                      setAddItemData((prev) => ({
                        ...prev,
                        salesContract: e.target.value,
                        description: autoDescription || prev.description,
                      }));

                      handleSalesContractChange(e.target.value);
                      // Clear error when field is filled
                      if (modalErrors.salesContract) {
                        setModalErrors({
                          ...modalErrors,
                          salesContract: "",
                        });
                      }
                    }}
                    placeholder={vi("selectSalesContract", "Select Sales Contract")}
                    searchPlaceholder={vi("searchSalesContracts", "Search sales contracts...")}
                    options={salesContracts
                      .filter((contract) => {
                        // For commission invoices, only show contracts where selected agent is involved
                        if (
                          selectedInvoiceType === "commission" &&
                          selectedVendor
                        ) {
                          return (
                            contract.basicInfo?.agent_id === selectedVendor._id
                          );
                        }
                        return true;
                      })
                      .map((contract) => ({
                        value: contract._id,
                        label: `${contract.contractNo} - ${
                          contract.basicInfo?.buyerCompanyName
                        }${
                          contract.productInfo?.[0]?.totalAgentCommission
                            ? ` ($${contract.productInfo[0].totalAgentCommission.toLocaleString()} ${vi("commissionSuffix", "commission")})`
                            : ""
                        }`,
                      }))}
                  />
                  {modalErrors.salesContract && (
                    <div className="text-red-500 text-xs mt-1">
                      {modalErrors.salesContract}
                    </div>
                  )}
                </div>
              )}

            {/* Item Type Selection - Only for Supplier Invoice */}
            {selectedInvoiceType === "supplier" && (
              <div>
                <label className="block text-gray-700 mb-2">{vi("type", "Type")} *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setAddItemData({
                        ...addItemData,
                        itemType: "cost_of_goods",
                        description: "",
                        amount: 0,
                      })
                    }
                    className={`p-3 rounded-lg border-2 transition-all ${
                      addItemData.itemType === "cost_of_goods"
                        ? "border-[var(--p-blue)] bg-[#f0fbf7] text-[var(--p-blue)]"
                        : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                    }`}
                  >
                    <Package size={20} className="mx-auto mb-1" />
                    <span className="text-sm font-medium">{vi("costOfGoodsLabel", "Cost of Goods")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setAddItemData({
                        ...addItemData,
                        itemType: "expense",
                        description: "",
                        amount: 0,
                      })
                    }
                    className={`p-3 rounded-lg border-2 transition-all ${
                      addItemData.itemType === "expense"
                        ? "border-[var(--p-blue)] bg-[#f0fbf7] text-[var(--p-blue)]"
                        : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                    }`}
                  >
                    <DollarSign size={20} className="mx-auto mb-1" />
                    <span className="text-sm font-medium">{vi("expenseLabel", "Expense")}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Description field */}
            {/* For supplier invoice - show for both cost of goods and expense items */}
            {selectedInvoiceType === "supplier" && (
              <div>
                <label className="block text-gray-700 mb-2">
                  {vi("description", "Description")}{" "}
                  {addItemData.itemType === "expense"
                    ? "*"
                    : `(${vi("autoGeneratedEditable", "Auto-generated, editable")})`}
                </label>
                <textarea
                  value={addItemData.description}
                  onChange={(e) => {
                    setAddItemData({
                      ...addItemData,
                      description: e.target.value,
                    });
                    // Clear error when field is filled
                    if (modalErrors.description) {
                      setModalErrors({
                        ...modalErrors,
                        description: "",
                      });
                    }
                  }}
                  placeholder={
                    addItemData.itemType === "cost_of_goods"
                      ? vi("autoGeneratedFromContractProducts", "Auto-generated from contract products (editable)")
                      : vi("enterItemDescription", "Enter item description")
                  }
                  className={`w-full min-h-[5rem] p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] resize-y ${
                    modalErrors.description
                      ? "border-red-500"
                      : "border-gray-300"
                  }`}
                  rows="3"
                />
                {modalErrors.description && (
                  <div className="text-red-500 text-xs mt-1">
                    {modalErrors.description}
                  </div>
                )}
                {addItemData.itemType === "cost_of_goods" && (
                  <p className="text-sm text-blue-600 mt-1">
                    {vi("descriptionAutoGeneratedHint", "Description auto-generated from contract products. You can edit it if needed.")}
                  </p>
                )}
              </div>
            )}

            {/* For commission agent - always show description field */}
            {selectedInvoiceType === "commission" &&
              (addItemData.contractType === "sales" ||
                addItemData.contractType === "purchase") && (
                <div>
                  <label className="block text-gray-700 mb-2">
                    {vi("itemDescription", "Item Description")}
                  </label>
                  <input
                    type="text"
                    value={addItemData.description}
                    onChange={(e) =>
                      setAddItemData({
                        ...addItemData,
                        description: e.target.value,
                      })
                    }
                    placeholder={vi("descriptionAutoPopulatedPlaceholder", "Description (auto-populated from product info)")}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    {vi("descriptionAutoPopulatedNote", "Description is auto-populated from product info. Contract number will be automatically added in brackets.")}
                  </p>
                </div>
              )}

            {/* Description field for Logistic Service Provider */}
            {selectedInvoiceType === "logistic" && (
              <div>
                <label className="block text-gray-700 mb-2">
                  {vi("description", "Description")} *
                </label>
                <input
                  type="text"
                  value={addItemData.description}
                  onChange={(e) => {
                    setAddItemData({
                      ...addItemData,
                      description: e.target.value,
                    });
                    // Clear error when field is filled
                    if (modalErrors.description) {
                      setModalErrors({
                        ...modalErrors,
                        description: "",
                      });
                    }
                  }}
                  placeholder={vi("enterLogisticServiceDescription", "Enter logistic service description")}
                  className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] ${
                    modalErrors.description
                      ? "border-red-500"
                      : "border-gray-300"
                  }`}
                  required
                />
                {modalErrors.description && (
                  <div className="text-red-500 text-xs mt-1">
                    {modalErrors.description}
                  </div>
                )}
              </div>
            )}

            {/* Amount (only for supplier expense items) */}
            {selectedInvoiceType === "supplier" &&
              addItemData.itemType === "expense" && (
                <div>
                  <label className="block text-gray-700 mb-2">{vi("amount", "Amount")} *</label>
                  <input
                    type="number"
                    value={addItemData.amount}
                    onChange={(e) => {
                      setAddItemData({
                        ...addItemData,
                        amount: e.target.value,
                      });
                      // Clear error when field is filled
                      if (modalErrors.amount) {
                        setModalErrors({
                          ...modalErrors,
                          amount: "",
                        });
                      }
                    }}
                    placeholder="0.00"
                    className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] ${
                      modalErrors.amount ? "border-red-500" : "border-gray-300"
                    }`}
                    step="0.01"
                    min="0"
                  />
                  {modalErrors.amount && (
                    <div className="text-red-500 text-xs mt-1">
                      {modalErrors.amount}
                    </div>
                  )}
                </div>
              )}

            {/* Amount Input for Logistic Service Provider */}
            {selectedInvoiceType === "logistic" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 mb-2">{vi("amount", "Amount")} *</label>
                  <input
                    type="number"
                    value={addItemData.amount}
                    onChange={(e) => {
                      setAddItemData({
                        ...addItemData,
                        amount: e.target.value,
                      });
                      // Clear error when field is filled
                      if (modalErrors.amount) {
                        setModalErrors({
                          ...modalErrors,
                          amount: "",
                        });
                      }
                    }}
                    placeholder={vi("enterAmount", "Enter amount")}
                    className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] ${
                      modalErrors.amount ? "border-red-500" : "border-gray-300"
                    }`}
                    step="0.01"
                    min="0"
                    required
                  />
                  {modalErrors.amount && (
                    <div className="text-red-500 text-xs mt-1">
                      {modalErrors.amount}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-gray-700 mb-2">{vi("currency", "Currency")} *</label>
                  <select
                    value={
                      addItemData.currency ||
                      invoiceData.currency ||
                      baseCurrency ||
                      "MYR"
                    }
                    onChange={(e) =>
                      setAddItemData({
                        ...addItemData,
                        currency: e.target.value,
                      })
                    }
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
                    required
                  >
                    <option value="USD">USD</option>
                    <option value="PKR">PKR</option>
                    <option value="MYR">MYR</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
              </div>
            )}

            {/* Expense Account Selection */}
            <div>
              <label className="block text-gray-700 mb-2">
                {vi("expenseAccount", "Expense Account")} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={addItemData.expenseAccount}
                  onChange={(e) => {
                    setAddItemData({
                      ...addItemData,
                      expenseAccount: e.target.value,
                    });
                    // Clear error when field is filled
                    if (modalErrors.expenseAccount) {
                      setModalErrors({
                        ...modalErrors,
                        expenseAccount: "",
                      });
                    }
                  }}
                  className={`w-full p-3 border rounded-lg appearance-none pr-10 focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] bg-white ${
                    modalErrors.expenseAccount
                      ? "border-red-500"
                      : "border-gray-300"
                  }`}
                >
                  <option value="">{vi("selectExpenseAccount", "Select Expense Account")}</option>
                  {filteredExpenseAccounts?.map((account) => (
                    <option key={account._id} value={account._id}>
                      {account.code || vi("na", "N/A")} - {account.accountName} (
                      {account.accountType?.name ||
                        account.accountType?.accountHeader}
                      )
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                </div>
              </div>
              {modalErrors.expenseAccount && (
                <div className="text-red-500 text-xs mt-1">
                  {modalErrors.expenseAccount}
                </div>
              )}
            </div>

            {/* Commission Amount Display for Purchase Contracts */}
            {selectedInvoiceType === "commission" &&
              addItemData.contractType === "purchase" &&
              addItemData.purchaseContract && (
                <div>
                  <label className="block text-gray-700 mb-2">
                    {vi("commissionAmount", "Commission Amount")}
                  </label>
                  <div className="p-3 bg-gray-50 border border-gray-300 rounded-lg">
                    <div className="flex justify-between text-lg font-semibold text-gray-800">
                      <span>{vi("totalAgentCommission", "Total Agent Commission")}:</span>
                      <span>
                        $
                        {(
                          purchaseContracts.find(
                            (c) => c._id === addItemData.purchaseContract
                          )?.productInfo?.[0]?.totalAgentCommission || 0
                        ).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}

            {/* Commission Amount Display for Sales Contracts */}
            {selectedInvoiceType === "commission" &&
              addItemData.contractType === "sales" &&
              addItemData.salesContract && (
                <div>
                  <label className="block text-gray-700 mb-2">
                    {vi("commissionAmount", "Commission Amount")}
                  </label>
                  <div className="p-3 bg-gray-50 border border-gray-300 rounded-lg">
                    <div className="flex justify-between text-lg font-semibold text-gray-800">
                      <span>{vi("totalAgentCommission", "Total Agent Commission")}:</span>
                      <span>
                        $
                        {(
                          salesContracts.find(
                            (c) => c._id === addItemData.salesContract
                          )?.productInfo?.[0]?.totalAgentCommission || 0
                        ).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}

            {/* Info message for cost of goods */}
            {selectedInvoiceType === "supplier" &&
              addItemData.itemType === "cost_of_goods" &&
              addItemData.purchaseContract && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-blue-800 text-sm">
                    <strong>{vi("note", "Note")}:</strong> {vi("costOfGoodsNote", "For cost of goods, the item description will be the vendor company name and the amount will be calculated from the contract's total value.")}
                  </p>
                </div>
              )}

            {/* Info message for commission items */}
            {selectedInvoiceType === "commission" &&
              (addItemData.contractType === "sales" ||
                addItemData.contractType === "purchase") &&
              (addItemData.salesContract || addItemData.purchaseContract) && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-green-800 text-sm">
                    <strong>{vi("note", "Note")}:</strong> {vi("commissionAmountNote", "Commission amount is pre-defined in the contract's totalAgentCommission field. The contract number will be added to the description automatically.")}
                  </p>
                </div>
              )}
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => {
                setShowAddItemModal(false);
                setModalErrors({});
              }}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              {vi("cancel", "Cancel")}
            </button>
            <button
              onClick={handleAddItemToInvoice}
              disabled={convertingCurrency}
              className="flex-1 px-4 py-2 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[#9CBA33] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {convertingCurrency ? vi("convertingCurrency", "Converting Currency...") : vi("addItem", "Add Item")}
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--p-blue)] mx-auto mb-4"></div>
          <p className="text-gray-600">{vi("loadingInvoice", "Loading invoice...")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 h-full max-h-[90vh] overflow-y-auto pb-[120px] ">
      <div className="mb-6">
        <BackButton />
      </div>

      <h1 className="text-xl font-semibold mb-6">{vi("updateVendorInvoice", "Update Vendor Invoice")}</h1>

      <div>
        {/* Invoice Type Section - Removed */}
        {/* <div className="bg-white p-6 rounded-lg mb-6 shadow-sm">
          <h2 className="text-lg font-medium mb-4 text-gray-800">
            Invoice Type
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <button
              type="button"
              onClick={() => handleInvoiceTypeChange("supplier")}
              className={`p-4 rounded-lg border-2 transition-colors ${
                selectedInvoiceType === "supplier"
                  ? "border-[var(--p-blue)] bg-[var(--p-blue)] text-white"
                  : "border-gray-300 bg-white text-gray-700 hover:border-[var(--p-blue)]"
              }`}
            >
              <div className="text-center">
                <Package className="mx-auto mb-2" size={24} />
                <div className="font-medium">Supplier Invoice</div>
                <div className="text-sm opacity-75">For goods and services</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => handleInvoiceTypeChange("commission")}
              className={`p-4 rounded-lg border-2 transition-colors ${
                selectedInvoiceType === "commission"
                  ? "border-[var(--p-blue)] bg-[var(--p-blue)] text-white"
                  : "border-gray-300 bg-white text-gray-700 hover:border-[var(--p-blue)]"
              }`}
            >
              <div className="text-center">
                <DollarSign className="mx-auto mb-2" size={24} />
                <div className="font-medium">Commission Agent Invoice</div>
                <div className="text-sm opacity-75">
                  For commission payments
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => handleInvoiceTypeChange("logistic")}
              className={`p-4 rounded-lg border-2 transition-colors ${
                selectedInvoiceType === "logistic"
                  ? "border-[var(--p-blue)] bg-[var(--p-blue)] text-white"
                  : "border-gray-300 bg-white text-gray-700 hover:border-[var(--p-blue)]"
              }`}
            >
              <div className="text-center">
                <Truck className="mx-auto mb-2" size={24} />
                <div className="font-medium">Logistic Service Provider</div>
                <div className="text-sm opacity-75">For logistics services</div>
              </div>
            </button>
          </div>
        </div> */}

        {/* Vendor Section */}
        <div className="bg-[#f0fbf7] p-6 rounded-lg mb-6">
          <h2 className="text-lg font-medium mb-4 text-gray-800">
            {vi("vendorInformation", "Vendor Information")}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {!isSingleAssignedBusiness() && (
            <div>
              <label className="block text-gray-700 mb-2">{vi("business", "Business")} *</label>
              <DropdownBasic
                options={
                  businesses?.map((business) => ({
                    value: business._id,
                    label: business.name,
                  })) || []
                }
                value={invoiceData.business}
                onChange={(value) =>
                  handleInputChange({ target: { name: "business", value } })
                }
                placeholder={vi("selectBusiness", "Select Business")}
                isDisabled={true}
                isClearable={false}
              />
              {formErrors.business && (
                <div className="text-red-500 text-xs mt-1">
                  {formErrors.business}
                </div>
              )}
            </div>
            )}

            <div>
              <label className="block text-gray-700 mb-2">{vi("vendorName", "Vendor Name")} *</label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <SearchableDropdown
                    name="vendorName"
                    value={selectedVendor?._id || ""}
                    onChange={(e) => handleChangeVendor(e.target.value)}
                    placeholder={
                      selectedVendor?.basicInformation?.vendorDisplayName ||
                      invoiceData?.vendor?.basicInformation?.vendorDisplayName ||
                      vi("selectVendor", "Select Vendor")
                    }
                    searchPlaceholder={vi("searchVendors", "Search vendors...")}
                    options={(() => {
                      const list = vendors?.map((vendor) => ({
                        value: vendor._id,
                        label: vendor.basicInformation?.vendorDisplayName || vendor.basicInformation?.companyName || "",
                      })) || [];
                      // Ensure current vendor is in options so it displays when list is loaded async or filtered
                      if (selectedVendor?._id && !list.some((o) => o.value === selectedVendor._id)) {
                        list.unshift({
                          value: selectedVendor._id,
                          label: selectedVendor.basicInformation?.vendorDisplayName || selectedVendor.basicInformation?.companyName || vi("currentVendor", "Current vendor"),
                        });
                      }
                      return list;
                    })()}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowQuickAddVendor(true)}
                  disabled={!invoiceData.business}
                  title={
                    !invoiceData.business
                      ? vi("selectBusinessFirst", "Select a business first")
                      : vi("quickAddNewVendor", "Quick add a new vendor")
                  }
                  className="flex items-center justify-center gap-1.5 shrink-0 px-3 py-2.5 text-sm font-medium text-[var(--p-blue)] bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-[var(--p-blue)] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[var(--p-blue)] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-white"
                >
                  <UserPlus className="w-4 h-4" />
                  {vi("add", "Add")}
                </button>
              </div>
              {formErrors.vendor && (
                <div className="text-red-500 text-xs mt-1">
                  {formErrors.vendor}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-gray-700 mb-2">{vi("bankName", "Bank Name")}</label>
              <input
                type="text"
                value={selectedVendor?.bankInfo?.bankDetails?.bankName || ""}
                readOnly
                className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
                placeholder={vi("noBankInformation", "No bank information")}
              />
            </div>
            <div>
              <label className="block text-gray-700 mb-2">{vi("vendorType", "Vendor Type")}</label>
              <input
                type="text"
                name="vendorType"
                value={invoiceData.vendorType}
                onChange={handleInputChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
                readOnly
              />
            </div>
            {/* <div>
              <label className="block text-gray-700 mb-2">Bank Account</label>
              <div className="relative">
                <select
                  name="vendorAccount"
                  value={invoiceData.vendorAccount}
                  onChange={handleVendorAccountChange}
                  className="w-full p-3 border border-gray-300 rounded-lg appearance-none bg-white pr-10 focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
                >
                  <option value="">Select Bank Account</option>
                  {bankAccounts?.map((account) => (
                    <option key={account._id} value={account._id}>
                      {account.accountName} - {account.bankName}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                </div>
              </div>
            </div> */}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-gray-700 mb-2">{vi("email", "Email")}</label>
              <input
                type="text"
                name="vendorEmail"
                value={invoiceData.vendorEmail}
                onChange={handleInputChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
                readOnly
              />
            </div>

            <div>
              <label className="block text-gray-700 mb-2">{vi("phone", "Phone")}</label>
              <input
                type="text"
                name="phoneNumber"
                value={invoiceData.phoneNumber}
                onChange={handleInputChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
                readOnly
              />
            </div>
          </div>
        </div>

        {/* Invoice Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div>
            <label className="block text-gray-700 mb-2">{vi("invoiceNumber", "Invoice Number")}</label>
            <div
              className={
                formErrors.invoiceNumber
                  ? "border-2 border-red-500 rounded-lg"
                  : ""
              }
            >
              <input
                type="text"
                name="invoiceNumber"
                value={invoiceNumber}
                className="w-full p-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
                readOnly
              />
            </div>
            {formErrors.invoiceNumber && (
              <div className="text-red-500 text-xs mt-1">
                {formErrors.invoiceNumber}
              </div>
            )}
          </div>
          <div>
            <label className="block text-gray-700 mb-2">{vi("invoiceDate", "Invoice Date")}</label>
            <div className="relative">
              <CustomDatePicker
                value={invoiceData.invoiceDate}
                onChange={(date) =>
                  setInvoiceData({ ...invoiceData, invoiceDate: date })
                }
                bgColor="#FFFFFF"
                style={{
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #EEEEEE",
                  borderRadius: "4px",
                }}
              />
              <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                <Calendar className="h-5 w-5 text-gray-400" />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-gray-700 mb-2">{vi("currency", "Currency")}</label>
            <input
              type="text"
              value={
                getCurrencyDisplay(invoiceData.currency, currencies) ||
                baseCurrency ||
                "MYR"
              }
              readOnly
              className="w-full px-3 py-2.5 text-sm bg-gray-100 text-gray-700 border border-gray-300 rounded-lg cursor-not-allowed"
              placeholder={vi("vendorCurrencyWillAppear", "Vendor currency will appear here")}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div>
            <label className="block text-gray-700 mb-2">
              {vi("mainExpenseAccount", "Main Expense Account")}
            </label>
            <div
              className={
                formErrors.expenseAccount
                  ? "border-2 border-red-500 rounded-lg"
                  : ""
              }
            >
              <SearchableDropdown
                name="expenseAccount"
                value={invoiceData.expenseAccount}
                onChange={handleInputChange}
                placeholder={vi("selectExpenseAccount", "Select Expense Account")}
                searchPlaceholder={vi("searchExpenseAccounts", "Search expense accounts...")}
                options={
                  filteredExpenseAccounts?.map((account) => ({
                    value: account._id,
                    label: `${account.code || vi("na", "N/A")} - ${
                      account.accountName
                    } (${
                      account.accountType?.name ||
                      account.accountType?.accountHeader
                    })`,
                  })) || []
                }
              />
            </div>
            {formErrors.expenseAccount && (
              <div className="text-red-500 text-xs mt-1">
                {formErrors.expenseAccount}
              </div>
            )}
          </div>
          <div>
            <label className="block text-gray-700 mb-2">{vi("paymentTerms", "Payment Terms")}</label>
            <SearchableDropdown
              name="terms"
              value={invoiceData.terms}
              onChange={(e) => {
                const selectedTermName = e.target.value;
                setInvoiceData((prev) => {
                  const term = paymentTerms.find((t) => t.name === selectedTermName);
                  const next = {
                    ...prev,
                    terms: selectedTermName,
                    paymentTermId: term?._id || "",
                  };
                  if (selectedTermName && prev.invoiceDate) {
                    const calculatedDueDate = calculateDueDate(term || selectedTermName, prev.invoiceDate);
                    if (calculatedDueDate) next.dueDate = calculatedDueDate;
                  }
                  return next;
                });
              }}
              placeholder={
                invoiceData.terms || vi("selectPaymentTerm", "Select Payment Term")
              }
              searchPlaceholder={vi("searchPaymentTerms", "Search payment terms...")}
              disabled={!invoiceData.business}
              options={(() => {
                const list = (paymentTerms?.map((term) => ({
                  value: term.name,
                  label: term.name,
                  name: term.name,
                })) || []);
                const currentTerm = invoiceData.terms?.trim();
                if (currentTerm && !list.some((o) => o.value === currentTerm)) {
                  list.push({
                    value: currentTerm,
                    label: currentTerm,
                    name: currentTerm,
                  });
                }
                return list.filter((t, i, a) => a.findIndex((x) => x.value === t.value) === i);
              })()}
              searchKeys={["name"]}
              dropdownFooter={
                <AddPaymentTermButton
                  businessId={invoiceData.business}
                  headers={headers}
                  disabled={!invoiceData.business}
                  displayMode="dropdown"
                  tableName="Vendor Payment Terms"
                  onAdded={(newTerm) => {
                    setPaymentTerms((prev) => (prev.some((t) => t._id === newTerm._id) ? prev : [...prev, newTerm]));
                    setInvoiceData((prev) => {
                      const next = {
                        ...prev,
                        terms: newTerm.name,
                        paymentTermId: newTerm._id || "",
                      };
                      if (prev.invoiceDate) {
                        const calculatedDueDate = calculateDueDate(newTerm, prev.invoiceDate);
                        if (calculatedDueDate) next.dueDate = calculatedDueDate;
                      }
                      return next;
                    });
                  }}
                />
              }
            />
          </div>
          <div>
            <label className="block text-gray-700 mb-2">{vi("dueDate", "Due Date")}</label>
            <div className="relative">
              <CustomDatePicker
                value={invoiceData.dueDate}
                onChange={(date) => {
                  const resolvedTerm = getPaymentTermFromDueDate(
                    invoiceData.invoiceDate,
                    date,
                    paymentTerms || []
                  );
                  const term = paymentTerms.find((t) => t.name === resolvedTerm);
                  setInvoiceData({
                    ...invoiceData,
                    dueDate: date,
                    terms: resolvedTerm,
                    paymentTermId: term?._id || "",
                  });
                }}
                bgColor="#FFFFFF"
                style={{
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #EEEEEE",
                  borderRadius: "4px",
                }}
              />
              <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                <Calendar className="h-5 w-5 text-gray-400" />
              </div>
            </div>
          </div>

          {shouldRenderCustomFieldAtSlot(
            "purchase",
            "vendor_invoice",
            "after_due_date",
          ) && invoiceData.business ? (
            <div className="md:col-span-3">
              <DynamicCustomFieldsForm
                businessId={invoiceData.business}
                module="purchase"
                screen="vendor_invoice"
                columns={3}
                recordId={id || undefined}
                values={invoiceCustomFieldValues}
                onValuesChange={setInvoiceCustomFieldValues}
                headers={headers}
                useBreakpointGrid
              />
            </div>
          ) : null}
        </div>

        {/* Items Section */}
        <div className="bg-white rounded-lg mb-6 shadow-sm">
          <ZohoStyleItemTable
            invoiceData={invoiceData}
            setInvoiceData={setInvoiceData}
            selectedContract={null}
            expenseAccounts={expenseAccounts}
            currency={invoiceData.currency || baseCurrency || "MYR"}
            errors={formErrors}
            businessItems={businessItems}
            taxes={taxes}
            onBulkAdd={() => setShowBulkAddItemsModal(true)}
            onRemoveItem={handleRemoveItem}
            onItemChange={(index, field, value) => {
              setInvoiceData((prev) => {
                const updatedItems = [...(prev.items || [])];

                if (
                  field === "lineItemCustomFields" &&
                  value &&
                  typeof value === "object" &&
                  Object.prototype.hasOwnProperty.call(value, "key")
                ) {
                  const currentRow = updatedItems[index] || {};
                  updatedItems[index] = {
                    ...currentRow,
                    lineItemCustomFields: {
                      ...(currentRow.lineItemCustomFields || {}),
                      [value.key]: value.value,
                    },
                  };
                } else {
                let sanitizedValue = value;

                if (
                  field === "quantity" ||
                  field === "unitPrice" ||
                  field === "discount"
                ) {
                  sanitizedValue = parseFloat(value) || 0;
                  if (sanitizedValue < 0) sanitizedValue = 0;
                }

                if (field === "taxRate") {
                  let n = parseFloat(value);
                  if (Number.isNaN(n)) n = 0;
                  if (n < 0) n = 0;
                  if (n > 100) n = 100;
                  sanitizedValue = n;
                }

                updatedItems[index] = {
                  ...updatedItems[index],
                  [field]: sanitizedValue,
                };

                if (field === "itemId" && !sanitizedValue) {
                  updatedItems[index].lineItemCustomFields = {};
                }

                // Recalculate total for this item
                if (field === "quantity" || field === "unitPrice" || field === "discount" || field === "taxRate" || field === "taxId" || field === "taxName") {
                  const quantity = parseFloat(updatedItems[index].quantity) || 1;
                  const unitPrice = parseFloat(updatedItems[index].unitPrice) || 0;
                  const discount = parseFloat(updatedItems[index].discount) || 0;
                  const taxRate = parseFloat(updatedItems[index].taxRate) || 0;
                  const lineSubtotal = quantity * unitPrice * (1 - (discount || 0) / 100);
                  const taxAmount = (lineSubtotal * taxRate) / 100;
                  updatedItems[index].total = Math.max(0, lineSubtotal + taxAmount);
                }
                }

                const subtotal = updatedItems.reduce(
                  (sum, item) => sum + (item.total || 0),
                  0
                );
                const taxTotal = sumLineTaxAmountsFromItems(updatedItems);
                const discountAmount = (subtotal * (prev.discountPercentage || 0)) / 100;
                const total = Math.max(
                  0,
                  subtotal -
                    discountAmount +
                    (prev.shippingCharges || 0) +
                    (prev.adjustment || 0)
                );

                return {
                  ...prev,
                  items: updatedItems,
                  subtotal,
                  taxTotal,
                  discountAmount,
                  total,
                };
              });
            }}
            lineItemCustomFieldDefinitions={lineItemCustomFieldDefs}
            businessId={invoiceData.business}
            headers={headers}
            onTaxCreated={(newTax) => {
              if (!newTax?._id) return;
              setTaxes((prev) =>
                prev.some((t) => String(t._id) === String(newTax._id))
                  ? prev
                  : [...prev, newTax]
              );
            }}
            pricingMode="purchase"
          />

          {formErrors.items && (
            <div className="text-red-500 text-sm mt-2 mx-6">{formErrors.items}</div>
          )}
        </div>

        {/* Supporting Document Section */}
        <div className="bg-white p-6 rounded-lg mb-6 shadow-sm">
          <h2 className="text-lg font-medium mb-4 text-gray-800">
            {vi("supportingDocuments", "Supporting Documents")}
          </h2>
          <div className="space-y-3">
            {/* List all existing + newly uploaded supporting documents */}
            {(invoiceData.supportingDocuments || []).map((doc, idx) => (
              <div key={doc.fileId || idx} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center min-w-0">
                    <FileText className="h-8 w-8 text-[var(--p-blue)] mr-3 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 truncate">{doc.name}</p>
                      <p className="text-sm text-gray-500">
                        {doc.size ? (doc.size / 1024 / 1024).toFixed(2) + " MB" : vi("unknownSize", "Unknown size")}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0 ml-3">
                    <button
                      type="button"
                      onClick={() => handleOpenFile(doc.fileId)}
                      className="p-2 text-[var(--p-blue)] hover:bg-[var(--p-blue)] hover:text-white rounded-lg transition-colors"
                      title={vi("viewDocument", "View Document")}
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveDocument(doc.fileId)}
                      className="p-2 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-colors"
                      title={vi("removeDocument", "Remove Document")}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Upload area — always visible so user can add more */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
              <div className="text-center">
                <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <div className="space-y-2">
                  <p className="text-gray-600">
                    {(invoiceData.supportingDocuments || []).length > 0
                      ? vi("addAnotherSupportingDocument", "Add another supporting document")
                      : vi("uploadSupportingDocuments", "Upload supporting documents for this invoice")}
                  </p>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="inline-flex items-center px-4 py-2 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[#9CBA33] transition-colors disabled:opacity-50"
                  >
                    <Upload size={16} className="mr-2" />
                    {uploading ? vi("uploading", "Uploading...") : vi("chooseFile", "Choose File")}
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
                      {vi("percentUploaded", "{{progress}}% uploaded", { progress: uploadProgress })}
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
          </div>
        </div>

        {/* Invoice summary — same panel as customer invoice / credit note */}
        <div className="mb-6 max-w-md">
          <InvoiceSummaryPanel
            currency={getCurrencyDisplay(invoiceData.currency, currencies)}
            invoiceData={{
              subtotal: invoiceData.subtotal,
              taxTotal: invoiceData.taxTotal ?? 0,
              discountPercentage: invoiceData.discountPercentage,
              discountAmount: invoiceData.discountAmount,
              shippingCharges: invoiceData.shippingCharges ?? 0,
              adjustment: invoiceData.adjustment ?? 0,
            }}
            onDiscountChange={(value) =>
              setInvoiceData((prev) => {
                const subtotal = parseFloat(prev.subtotal) || 0;
                const discountAmount = (subtotal * value) / 100;
                const total =
                  subtotal -
                  discountAmount +
                  (parseFloat(prev.shippingCharges) || 0) +
                  (parseFloat(prev.adjustment) || 0);
                return {
                  ...prev,
                  discountPercentage: value,
                  discountValue: value,
                  discountAmount,
                  discountType: "percentage",
                  total: Math.max(total, 0),
                };
              })
            }
            onShippingChange={(v) =>
              setInvoiceData((prev) => {
                const subtotal = parseFloat(prev.subtotal) || 0;
                const disc = parseFloat(prev.discountAmount) || 0;
                const total =
                  subtotal - disc + v + (parseFloat(prev.adjustment) || 0);
                return {
                  ...prev,
                  shippingCharges: v,
                  total: Math.max(total, 0),
                };
              })
            }
            onAdjustmentChange={(v) =>
              setInvoiceData((prev) => {
                const subtotal = parseFloat(prev.subtotal) || 0;
                const disc = parseFloat(prev.discountAmount) || 0;
                const ship = parseFloat(prev.shippingCharges) || 0;
                const total = subtotal - disc + ship + v;
                return {
                  ...prev,
                  adjustment: v,
                  total: Math.max(total, 0),
                };
              })
            }
          />
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => history.goBack()}
            className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
          >
            {vi("cancel", "Cancel")}
          </button>
          <button
            onClick={() => handleSubmit("Draft")}
            disabled={isLoading}
            className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            {vi("saveAsDraft", "Save as Draft")}
          </button>
          <button
            onClick={() => handleSubmit("Created")}
            disabled={isLoading}
            className="px-6 py-3 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[#9CBA33] transition-colors flex items-center"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                {vi("updating", "Updating...")}
              </>
            ) : (
              vi("updateInvoice", "Update Invoice")
            )}
          </button>
        </div>
      </div>

      {/* Add Item Modal */}
      {renderAddItemModal()}

      {/* Bulk Add Items Modal */}
      <BulkAddItemsModal
        isOpen={showBulkAddItemsModal}
        onClose={() => setShowBulkAddItemsModal(false)}
        items={businessItems}
        onAddItems={handleBulkAddItems}
        currency={invoiceData.currency || baseCurrency || "MYR"}
        pricingMode="purchase"
      />
      <QuickAddVendorModal
        isOpen={showQuickAddVendor}
        onClose={() => setShowQuickAddVendor(false)}
        businessId={invoiceData.business}
        baseUrl={Base_URL}
        headers={headers}
        onSuccess={(newVendor) => {
          setVendors((prev) => {
            const has = prev.some((v) => v._id === newVendor._id);
            return has ? prev : [...prev, newVendor];
          });
          handleChangeVendor(newVendor._id);
          setShowQuickAddVendor(false);
        }}
      />
    </div>
  );
};

export default UpdateVendorInvoice;
