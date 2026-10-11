import React, { useState, useEffect, useRef, useContext } from "react";
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
import { useHistory } from "react-router-dom";
import { notifyError, notifySuccess } from "@/utils/toast";
import ItemTable from "./ItemTable"; // Import the new ItemTable component
import ZohoStyleItemTable from "@/components/invoice/ZohoStyleItemTable";
import BulkAddItemsModal from "@/components/customer-invoices/BulkAddItemsModal";
import QuickAddVendorModal from "@/components/vendor-invoices/QuickAddVendorModal";
import { AdminContext } from "@/context/AdminContext";
import CustomDatePicker from "@/components/CustomDatePicker";
import useAsync from "@/hooks/useAsync";
import BankManagementServices from "@/services/BankManagementServices";
import CurrencyServices from "@/services/CurrencyServices";
import { formatAmount, formatDate } from "@/components/formatAmount";
import InvoiceSummaryPanel from "@/components/invoice/InvoiceSummaryPanel";
import SearchableDropdown from "@/components/SearchableDropdown";
import DropdownBasic from "@/page-layouts/components/DropdownBasic";
import SingleBusinessField from "@/components/SingleBusinessField";
import AddPaymentTermButton from "@/components/AddPaymentTermButton";
import { calculateDueDate, getPaymentTermFromDueDate } from "@/utils/calculateDueDate";
import { sumLineTaxAmountsFromItems } from "@/utils/itemDiscountUtils";
import { getNextDocumentNumber } from "@/services/documentSequenceServices";
import DynamicCustomFieldsForm from "@/components/custom-fields/DynamicCustomFieldsForm";
import {
  fetchDefinitions,
  fetchLineItemCustomFieldDefinitions,
  upsertValues,
} from "@/services/customFieldServices";
import { validateCustomFieldValues } from "@/utils/customFieldValidation";
import { shouldRenderCustomFieldAtSlot } from "@/utils/customFieldPlacement";
import { PageHeader } from "@/page-layouts";
import { useTranslation } from "react-i18next";

const CreateVendorInvoice = ({ id }) => {
  const { t } = useTranslation();
  const vi = (key, defaultValue, options = {}) =>
    t(`accounts.vendorInvoices.${key}`, { defaultValue, ...options });
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
  const [docNumMissing, setDocNumMissing] = useState(false);

  const [contracts, setContracts] = useState([]);
  const [vendors, setVendors] = useState([]);

  const [salesContracts, setSalesContracts] = useState([]); // Add sales contracts for commission agent
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
  // Business base currency; used as fallback when vendor currency is missing.
  const [baseCurrency, setBaseCurrency] = useState("MYR");

  // Enhanced state for new flow
  const [selectedInvoiceType, setSelectedInvoiceType] = useState("supplier"); // "supplier" or "commission"
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [addItemData, setAddItemData] = useState({
    purchaseContract: "",
    salesContract: "", // Add sales contract for commission agent
    itemType: "Goods", // "Goods" or "Service" for backend enum, mapped from UI
    contractType: "sales", // "sales" or "purchase" for commission agent
    itemName: "",
    description: "",
    quantity: 1,
    amount: 0,
    expenseAccount: "", // Add expense account for item-level tracking
    taxRate: 0,
    taxId: "",
    taxName: "",
  });

  // Currency conversion states
  const [conversionRates, setConversionRates] = useState({});
  const [isLoadingConversion, setIsLoadingConversion] = useState(false);

  // Contract validation states - simplified approach like ExpensesTable
  const [existingInvoiceTypes, setExistingInvoiceTypes] = useState([]);
  const [selectedContractForValidation, setSelectedContractForValidation] =
    useState(null);

  // Contract context state
  const [contractContext, setContractContext] = useState({
    fromContract: false,
    contractType: null, // 'sales' or 'purchase'
    contractId: null,
    businessId: null,
    vendorId: null,
    contractData: null,
  });

  // Add loading state for when coming from contract
  const [isLoadingContractContext, setIsLoadingContractContext] =
    useState(false);

  /** PO → vendor bill (Convert to bill) */
  const [linkedPurchaseOrderId, setLinkedPurchaseOrderId] = useState(null);

  // Form data state
  const [invoiceData, setInvoiceData] = useState({
    business: "",
    vendor: "",
    invoiceNumber: "",
    invoiceType: "Purchase",
    invoiceDate: formatDateForInput(new Date()),
    dueDate: formatDateForInput(new Date()),
    // Vendor Payment Terms (Purchase_Misc_Data_Types > Vendor Payment Terms)
    terms: "Due on Receipt",
    paymentTermId: "",
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
    shippingCharges: 0,
    adjustment: 0,
    taxTotal: 0,
    total: 0,
    currency: "", // Auto-filled from selected vendor's currency (not by business)
    expenseAccount: "", // Main expense account for the invoice
    supportingDocument: null,
    supportingDocuments: [],
    module: "vendor-invoices",
    termsAndConditions: "",
  });

  const [formErrors, setFormErrors] = useState({});
  const [modalErrors, setModalErrors] = useState({});
  const [lineItemCustomFieldDefs, setLineItemCustomFieldDefs] = useState([]);
  const [invoiceCustomFieldValues, setInvoiceCustomFieldValues] = useState({});

  console.log("invoice data!", invoiceData);
  console.log("selected vendor", selectedVendor);

  // Format date for input fields
  function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  // Initialize contract context from URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const contractId = urlParams.get("contractId");
    const contractType = urlParams.get("contractType"); // 'sales' or 'purchase'
    const businessId = urlParams.get("businessId");
    const vendorId = urlParams.get("vendorId");
    const invoiceType = urlParams.get("invoiceType"); // 'supplier', 'commission', or 'logistic'

    console.log("vendorId", vendorId, "invoiceType", invoiceType);

    if (contractId && contractType) {
      setIsLoadingContractContext(true);
      setContractContext({
        fromContract: true,
        contractType,
        contractId,
        businessId,
        vendorId,
        contractData:
          history.location?.state?.salesContractData ||
          history.location?.state?.purchaseContractData,
      });

      // Set business from URL parameters
      if (businessId) {
        setInvoiceData((prev) => ({ ...prev, business: businessId }));
      }

      // Set invoice type based on URL parameter (preferred) or contract type
      if (invoiceType) {
        setSelectedInvoiceType(invoiceType);
      } else if (contractType === "sales") {
        setSelectedInvoiceType("commission");
      } else if (contractType === "purchase") {
        setSelectedInvoiceType("supplier");
      }

      // Pre-populate addItemData with contract context
      if (contractType === "sales") {
        setAddItemData((prev) => ({
          ...prev,
          salesContract: contractId,
          contractType: "sales",
        }));
      } else if (contractType === "purchase") {
        setAddItemData((prev) => ({
          ...prev,
          purchaseContract: contractId,
          contractType: "purchase",
        }));
      }
    }
  }, []);

  // Load bill prefill from Purchase Order (?purchaseOrderId= on /create-vendor-invoice)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const poId = params.get("purchaseOrderId");
    if (!poId || !adminInfo?.token) return;

    let cancelled = false;
    setLinkedPurchaseOrderId(poId);
    (async () => {
      try {
        setIsLoading(true);
        const res = await axios.get(
          `${Base_URL}/purchase-orders/${poId}/bill-prefill`,
          {
            headers: {
              authorization: `Bearer ${adminInfo.token}`,
              "Content-Type": "application/json",
            },
          }
        );
        if (cancelled || !res.data?.success || !res.data.data) return;
        const d = res.data.data;
        const vRes = await axios.get(`${Base_URL}/vendors/${d.vendor}`, {
          headers: { authorization: `Bearer ${adminInfo.token}` },
        });
        const vendorData = vRes.data?.data;
        if (!vendorData) {
          notifyError(vi("vendorNotFoundForPo", "Vendor not found for this purchase order"));
          return;
        }
        setSelectedVendor(vendorData);
        const vendorCurrency =
          vendorData?.basicInformation?.currency?.symbol ||
          vendorData?.basicInformation?.currency?.name ||
          (typeof vendorData?.basicInformation?.currency === "string"
            ? vendorData.basicInformation.currency
            : "") ||
          "";
        if (vendorCurrency) setBaseCurrency(vendorCurrency);
        const mappedItems = (d.items || []).map((row, idx) => {
          const rawTaxId = row.taxId;
          const taxIdStr =
            rawTaxId != null && rawTaxId !== ""
              ? typeof rawTaxId === "object" && rawTaxId._id != null
                ? String(rawTaxId._id)
                : String(rawTaxId)
              : "";
          return {
            id: idx + 1,
            itemName: row.itemName || row.description || "",
            description: row.description || row.itemName || "",
            quantity: row.quantity ?? 1,
            unitPrice: row.unitPrice ?? 0,
            amount: row.amount ?? row.total ?? 0,
            total: row.total ?? row.amount ?? 0,
            tax: row.tax ?? 0,
            taxRate: row.taxRate ?? 0,
            taxId: taxIdStr,
            taxName: row.taxName || "",
            discount: row.discount ?? 0,
            ...(row.itemId && { itemId: row.itemId }),
          };
        });
        const prefillSub = d.subtotal ?? 0;
        const prefillDisc = d.discount ?? 0;
        const prefillDiscPct =
          prefillSub > 0 && prefillDisc > 0 ? (prefillDisc / prefillSub) * 100 : 0;
        setInvoiceData((prev) => ({
          ...prev,
          business: d.business,
          vendor: vendorData?.basicInformation?.vendorDisplayName,
          phoneNumber:
            vendorData?.basicInformation?.vendorPhone?.mobile ||
            vendorData?.companyInfo?.phone,
          vendorType: vendorData?.basicInformation?.vendorType,
          vendorEmail:
            vendorData?.basicInformation?.vendorEmail ||
            vendorData?.companyInfo?.fax,
          invoiceDate: d.invoiceDate || prev.invoiceDate,
          dueDate: d.dueDate || prev.dueDate,
          terms: d.terms || prev.terms,
          items: mappedItems,
          subtotal: prefillSub,
          taxTotal: sumLineTaxAmountsFromItems(mappedItems),
          discountAmount: prefillDisc,
          discountPercentage: prefillDiscPct,
          discountValue: prefillDiscPct,
          discountType: "percentage",
          shippingCharges: d.shippingCharges ?? 0,
          adjustment: d.adjustment ?? 0,
          total: d.total ?? 0,
          currency: d.currency || vendorCurrency || prev.currency || baseCurrency || "MYR",
          termsAndConditions: d.termsAndConditions || prev.termsAndConditions,
        }));
        notifySuccess(vi("poLoadedForBill", "Purchase order loaded for vendor bill"));
      } catch (e) {
        console.error(e);
        notifyError(e.response?.data?.message || vi("failedToLoadPo", "Failed to load purchase order for bill"));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adminInfo?.token]);

  // Fetch currencies list (for modal etc.)
  useEffect(() => {
    const fetchCurrencies = async () => {
      const response = await axios.get(
        `${Base_URL}/finance/currencies?business_id=${invoiceData?.business}`
      );
      setCurrencies(response.data.data || []);
    };
    fetchCurrencies();
  }, [invoiceData?.business]);

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

  // PO → bill: line tax column is a tax dropdown (taxId). Select master tax by rate when PO has rate but no id.
  useEffect(() => {
    if (!linkedPurchaseOrderId || !taxes.length) return;
    setInvoiceData((prev) => {
      if (!prev.items?.length) return prev;
      let changed = false;
      const newItems = prev.items.map((it) => {
        const tid = it.taxId != null ? String(it.taxId).trim() : "";
        if (tid) return it;
        const rate = parseFloat(it.taxRate);
        if (!Number.isFinite(rate) || rate <= 0) return it;
        const match = taxes.find((t) => {
          const tr = parseFloat(t.rate);
          return Number.isFinite(tr) && Math.abs(tr - rate) <= 0.02;
        });
        if (!match) return it;
        changed = true;
        return {
          ...it,
          taxId: String(match._id),
          taxName: match.name || it.taxName || "",
        };
      });
      if (!changed) return prev;
      return { ...prev, items: newItems };
    });
  }, [linkedPurchaseOrderId, taxes]);

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

  // Default to first business when none selected (e.g. open create page without URL params)
  useEffect(() => {
    if (businesses.length > 0 && !invoiceData.business) {
      setInvoiceData((prev) => ({ ...prev, business: businesses[0]._id }));
    }
  }, [businesses, invoiceData.business]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch businesses
        const storedBusinesses = localStorage.getItem("businesses");
        if (storedBusinesses) {
          const parsedData = JSON.parse(storedBusinesses);
          setBusinesses(parsedData);
        }

        // Fetch business data if needed
        if (invoiceData?.business) {
          const response = await axios.get(
            `${Base_URL}/business/${invoiceData.business}`
          );
          const business = response.data.data;
          setBusinessData(business);
          // Auto-populate terms & conditions from business if invoice doesn't have custom terms
          if (business?.termsAndConditions && !invoiceData.termsAndConditions) {
            setInvoiceData((prev) => ({
              ...prev,
              termsAndConditions: business.termsAndConditions,
            }));
          }
        }

        // Fetch contracts, vendors, and sales contracts
        const [
          contractsRes,
          vendorsRes,
          salesContractsRes,
          bankAccountsRes,
          chartAccountsRes,
        ] = await Promise.all([
          axios.get(`${Base_URL}/purchase-contracts`, {
            params: { businessId: invoiceData?.business },
          }),
          axios.get(
            invoiceData?.business
              ? `${Base_URL}/vendors/all/${invoiceData.business}`
              : `${Base_URL}/vendors`,
            { params: { status: "Active" } }
          ),
          axios.get(`${Base_URL}/sales-contracts`, {
            params: { businessId: invoiceData?.business },
          }),
          axios.get(`${Base_URL}/bank-management/accounts`, {
            params: { business: invoiceData?.business },
          }),
          axios.get(`${Base_URL}/accounts`, {
            params: { business: invoiceData?.business },
          }),
        ]);

        console.log("bankAccountsRes", bankAccountsRes.data);

        const purchaseContracts = contractsRes.data.contracts || [];
        console.log("purchaseContracts", purchaseContracts);
        const salesContractsData = salesContractsRes.data.contracts || [];

        setContracts(purchaseContracts);
        setSalesContracts(salesContractsData);

        setVendors(
          (vendorsRes.data.data || []).filter(
            (vendor) => !vendor.status || vendor.status === "Active"
          )
        );
        setBankAccounts(bankAccountsRes.data.accounts || []);
        setExpenseAccounts(chartAccountsRes.data.accounts || []);

        console.log("Data loaded successfully");

        // If coming from contract context, fetch existing invoice types for that contract
        if (contractContext.fromContract && contractContext.contractId) {
          const contract = [...purchaseContracts, ...salesContractsData].find(
            (c) => c._id === contractContext.contractId
          );
          if (contract) {
            await fetchExistingInvoiceTypesForContract(
              contract._id,
              contract.contractNo
            );
          }
        }

        // Auto-select vendor and contracts if coming from contract context
        if (contractContext.fromContract && contractContext.vendorId) {
          await handleChangeVendor(contractContext.vendorId);
          setIsLoadingContractContext(false);
        } else {
          setIsLoadingContractContext(false);
        }

        // Re-populate addItemData with contract context if needed
        if (contractContext.fromContract) {
          if (contractContext.contractType === "sales") {
            setAddItemData((prev) => ({
              ...prev,
              salesContract: contractContext.contractId,
              contractType: "sales",
            }));

            // Auto-populate description for commission from sales contract
            const selectedContract = salesContractsRes.data.contracts?.find(
              (c) => c._id === contractContext.contractId
            );
            if (selectedContract) {
              setAddItemData((prev) => ({
                ...prev,
                description: "Commission",
              }));
            }
          } else if (contractContext.contractType === "purchase") {
            setAddItemData((prev) => ({
              ...prev,
              purchaseContract: contractContext.contractId,
              contractType: "purchase",
            }));

            // Auto-populate description for cost of goods from purchase contract
            const selectedContract = contractsRes.data.contracts?.find(
              (c) => c._id === contractContext.contractId
            );
            if (selectedContract && selectedContract.productInfo) {
              const productDescriptions = selectedContract.productInfo
                .map(
                  (product) =>
                    `${product.title} - ${product.quantityMTS} MTS @ $${product.price}/MT`
                )
                .join(", ");
              setAddItemData((prev) => ({
                ...prev,
                description: productDescriptions,
              }));
            }
          }
        }
      } catch (error) {
        console.log("Failed to fetch data:", error);
        notifyError(vi("failedToLoadData", "Failed to load data"));
        setIsLoadingContractContext(false);
      }
    };

    fetchData();
  }, [invoiceData.business, contractContext.fromContract, selectedInvoiceType]);

  const handleChangeVendor = async (vendorId) => {
    try {
      const response = await axios.get(`${Base_URL}/vendors/${vendorId}`);
      const vendorData = response?.data?.data;
      setSelectedVendor(vendorData);
      // Currency = vendor's currency (customer currency), not business default
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
        phoneNumber:
          vendorData?.basicInformation?.vendorPhone?.mobile ||
          vendorData?.companyInfo?.phone,
        vendorType: vendorData?.basicInformation?.vendorType,
        vendorEmail:
          vendorData?.basicInformation?.vendorEmail ||
          vendorData?.companyInfo?.fax,
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
    } else {
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
    }
  };

  const getFriendlyVendorInvoiceError = (err) => {
    const code = err?.response?.data?.error || err?.response?.data?.code;
    if (code === "PO_QTY_EXCEEDED") {
      return vi("poQtyExceeded", "Quantity recorded cannot be more than quantity ordered.");
    }
    return (
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      err?.message ||
      vi("failedToCreateInvoice", "Failed to create invoice. Please check all required fields.")
    );
  };

  // Auto-generate invoice number from document sequences (same logic as CreateCustomerInvoice).
  // Per business group: same group → BILL-000001, BILL-000002…; different group → BILL-000001 again.
  // Backend resolves businessGroupId from businessId when not provided.
  const generateInvoiceNumber = async (businessId, businessGroupId) => {
    if (!businessId) return;
    try {
      const response = await getNextDocumentNumber("bill", businessId, businessGroupId);
      setInvoiceNumber(response.data?.nextNumber);
      setDocNumMissing(response.data?.isFallback === true);
    } catch (err) {
      console.error("Failed to fetch vendor invoice number preview:", err);
    }
  };

  // Trigger auto-generation when business data loads (new invoices only)
  useEffect(() => {
    if (!id && businessData?._id) {
      const businessGroupId =
        businessData.businessGroup?._id || businessData.businessGroup;
      generateInvoiceNumber(businessData._id, businessGroupId);
    }
  }, [businessData?._id, businessData?.businessGroup, id]);

  const validateModalForm = () => {
    const errors = {};

    // Validate fields based on invoice type
    if (selectedInvoiceType === "supplier") {
      // If no purchase contract selected, use simple manual item fields
      if (!addItemData.purchaseContract) {
        if (!addItemData.itemName || addItemData.itemName.trim() === "") {
          errors.itemName = vi("itemNameRequired", "Item name is required.");
        }
        const qty = Number(addItemData.quantity);
        if (!qty || qty <= 0) {
          errors.quantity = vi("quantityMustBeGreaterThanZero", "Quantity must be greater than 0.");
        }
        const unitPrice = Number(addItemData.amount);
        if (!unitPrice || unitPrice <= 0) {
          errors.amount = vi("amountMustBeGreaterThanZero", "Amount must be greater than 0.");
        }
        return errors;
      }

      // For supplier invoices, amount is required only for expense items
      if (addItemData.itemType === "expense") {
        if (!addItemData.amount || parseFloat(addItemData.amount) <= 0) {
          errors.amount =
            vi("amountRequiredForExpense", "Amount is required for expense items and must be greater than 0.");
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

    if (selectedInvoiceType === "supplier") {
      // If a purchase contract is selected (e.g. coming from contract context),
      // keep the existing contract-based behaviour. Otherwise, fall back to
      // a simple manual item using description and amount.
      let newItem;
      if (addItemData.purchaseContract) {
        const selectedContract = contracts.find(
          (c) => c._id === addItemData.purchaseContract
        );

        if (!selectedContract) {
          notifyError(vi("selectedContractNotFound", "Selected contract not found"));
          return;
        }

        // Check if contract can be selected
        if (!canCreateInvoiceType(selectedInvoiceType, selectedContract._id)) {
          // If validation failed because we haven't fetched invoice types yet, fetch them
          if (selectedContractForValidation !== selectedContract._id) {
            const fetchedTypes = await fetchExistingInvoiceTypesForContract(
              selectedContract._id,
              selectedContract.contractNo
            );
            // Re-validate after fetching using the returned data
            if (
              !canCreateInvoiceType(
                selectedInvoiceType,
                selectedContract._id,
                fetchedTypes
              )
            ) {
              notifyError(
                getInvoiceTypeDisabledReason(
                  selectedInvoiceType,
                  selectedContract._id,
                  fetchedTypes
                )
              );
              return;
            }
          } else {
            notifyError(
              getInvoiceTypeDisabledReason(
                selectedInvoiceType,
                selectedContract._id
              )
            );
            return;
          }
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
              vi("costOfGoodsAlreadyExists", `Cost of goods item for contract ${selectedContract.contractNo} already exists. You cannot add multiple cost of goods items for the same contract.`, { contractNo: selectedContract.contractNo })
            );
            return;
          }
        }

        let itemAmount = 0;
        let itemDescription = "";

        if (addItemData.itemType === "cost_of_goods") {
          // Auto-calculate amount from product info
          itemAmount =
            selectedContract.productInfo
              ?.map((product) => product.totalValue || 0)
              .reduce((sum, value) => sum + value, 0) || 0;

          // Get contract currency and convert if needed
          const contractCurrency =
            selectedContract.productInfo?.[0]?.selectedCurrency || baseCurrency || "MYR";

          if (contractCurrency !== invoiceData.currency) {
            try {
              const conversion = await convertCurrency(
                contractCurrency,
                invoiceData.currency,
                itemAmount
              );
              itemAmount = conversion.convertedAmount;
              notifySuccess(
                `Amount converted from ${contractCurrency} to ${invoiceData.currency} (Rate: ${conversion.exchangeRate})`
              );
            } catch (error) {
              notifyError(
                vi("currencyConversionFailedOriginal", "Currency conversion failed. Using original amount.")
              );
            }
          }

          const contractNoDisplay = `(${selectedContract.contractNo})`;
          itemDescription = `${selectedContract.productInfo
            ?.map(
              (product) =>
                `${product.title} - ${product.quantityMTS} MTS @ ${contractCurrency}${product.price}/MT`
            )
            .join(", ")} ${contractNoDisplay}`;
        } else {
          // For expense items, use manual input
          itemAmount = parseFloat(addItemData.amount) || 0;
          itemDescription = addItemData.description;
        }

        console.log("selected contract", selectedContract);

        newItem = {
          id: invoiceData.items.length + 1,
          quantity: 1,
          itemName: itemDescription,
          description: itemDescription,
          unitPrice: itemAmount,
          amount: itemAmount,
          discount: 0,
          total: itemAmount,
          tax: 0,
          taxRate: addItemData.taxRate || 0,
          taxId: addItemData.taxId || "",
          taxName: addItemData.taxName || "",
          contractId: selectedContract._id,
          contractNo: selectedContract.contractNo,
          itemType: addItemData.itemType,
          contractType: "purchase",
          expenseAccount: addItemData.expenseAccount,
          itemId:
            selectedContract.productInfo?.[0]?.item?._id ||
            selectedContract.productInfo?.[0]?.itemId ||
            null,
          lineItemCustomFields: {},
        };
      } else {
        // No purchase contract selected: create a simple manual item (name + qty + unit price)
        const qty = Number(addItemData.quantity) || 1;
        const unitPrice = Number(addItemData.amount) || 0;
        const taxRate = parseFloat(addItemData.taxRate) || 0;
        const lineSubtotal = qty * unitPrice;
        const taxAmount = taxRate > 0 ? (lineSubtotal * taxRate) / 100 : 0;
        const total = Math.max(0, lineSubtotal + taxAmount);
        const itemName = (addItemData.itemName || "").trim();
        const desc = (addItemData.description || "").trim();

        newItem = {
          id: invoiceData.items.length + 1,
          quantity: qty,
          itemName: itemName,
          description: desc ? `${itemName} - ${desc}` : itemName,
          unitPrice: unitPrice,
          amount: lineSubtotal,
          discount: 0,
          total: total,
          tax: taxAmount,
          taxRate: taxRate,
          taxId: addItemData.taxId || "",
          taxName: addItemData.taxName || "",
          itemType: "Goods",
          contractType: null,
          expenseAccount: null,
          lineItemCustomFields: {},
        };
      }

      console.log("newItem", newItem);

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

      // Reset modal data but preserve contract context
      setAddItemData({
        purchaseContract:
          contractContext.fromContract &&
          contractContext.contractType === "purchase"
            ? contractContext.contractId
            : "",
        salesContract:
          contractContext.fromContract &&
          contractContext.contractType === "sales"
            ? contractContext.contractId
            : "",
        itemType: "cost_of_goods",
        contractType: contractContext.fromContract
          ? contractContext.contractType
          : "sales",
        itemName: "",
        description: "",
        quantity: 1,
        amount: 0,
        expenseAccount: "",
        taxRate: 0,
        taxId: "",
        taxName: "",
      });
      setModalErrors({});
      setShowAddItemModal(false);
      notifySuccess(vi("itemAddedSuccessfully", "Item added successfully"));
      return;
    }

    // Handle Logistic Service Provider Invoice
    if (selectedInvoiceType === "logistic") {
      if (!addItemData.purchaseContract) {
        notifyError(vi("pleaseSelectPurchaseContract", "Please select a purchase contract"));
        return;
      }

      if (!addItemData.description || addItemData.description.trim() === "") {
        notifyError(vi("pleaseEnterLogisticDescription", "Please enter a description for the logistic service"));
        return;
      }

      if (!addItemData.amount || addItemData.amount <= 0) {
        notifyError(vi("pleaseEnterValidLogisticAmount", "Please enter a valid amount for the logistic service"));
        return;
      }

      const selectedContract = contracts.find(
        (c) => c._id === addItemData.purchaseContract
      );

      if (!selectedContract) {
        notifyError(vi("selectedContractNotFound", "Selected contract not found"));
        return;
      }

      // Check if contract can be selected
      if (!canCreateInvoiceType(selectedInvoiceType, selectedContract._id)) {
        // If validation failed because we haven't fetched invoice types yet, fetch them
        if (selectedContractForValidation !== selectedContract._id) {
          const fetchedTypes = await fetchExistingInvoiceTypesForContract(
            selectedContract._id,
            selectedContract.contractNo
          );
          // Re-validate after fetching using the returned data
          if (
            !canCreateInvoiceType(
              selectedInvoiceType,
              selectedContract._id,
              fetchedTypes
            )
          ) {
            notifyError(
              getInvoiceTypeDisabledReason(
                selectedInvoiceType,
                selectedContract._id,
                fetchedTypes
              )
            );
            return;
          }
        } else {
          notifyError(
            getInvoiceTypeDisabledReason(
              selectedInvoiceType,
              selectedContract._id
            )
          );
          return;
        }
      }

      // Add logistic service item to invoice
      const amount = parseFloat(addItemData.amount) || 0;
      const logisticLabel = addItemData.description || "Logistic Service";
      const newItem = {
        id: invoiceData.items.length + 1,
        itemName: logisticLabel,
        description: logisticLabel,
        quantity: 1,
        unitPrice: amount,
        amount: amount,
        total: amount, // Add total field for display
          currency:
            addItemData.currency ||
            invoiceData.currency ||
            baseCurrency ||
            "MYR", // Add currency
        contractId: selectedContract._id,
        contractNo: selectedContract.contractNo,
        itemType: "logistic_service",
        contractType: "purchase",
        expenseAccount: addItemData.expenseAccount,
        itemId:
          selectedContract.productInfo?.[0]?.item?._id ||
          selectedContract.productInfo?.[0]?.itemId ||
          null,
        lineItemCustomFields: {},
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

      // Reset form but preserve contract context
      setAddItemData({
        purchaseContract:
          contractContext.fromContract &&
          contractContext.contractType === "purchase"
            ? contractContext.contractId
            : "",
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
      notifySuccess(vi("itemAddedSuccessfully", "Item added successfully"));
      return;
    }

    // Handle Commission Invoice
    if (selectedInvoiceType === "commission") {
      if (addItemData.contractType === "purchase") {
        if (!addItemData.purchaseContract) {
          notifyError(vi("pleaseSelectPurchaseContract", "Please select a purchase contract"));
          return;
        }

        const selectedPurchaseContract = contracts.find(
          (c) => c._id === addItemData.purchaseContract
        );

        if (!selectedPurchaseContract) {
          notifyError(vi("selectedPurchaseContractNotFound", "Selected purchase contract not found"));
          return;
        }

        // Check if contract can be selected
        if (
          !canCreateInvoiceType(
            selectedInvoiceType,
            selectedPurchaseContract._id
          )
        ) {
          // If validation failed because we haven't fetched invoice types yet, fetch them
          if (selectedContractForValidation !== selectedPurchaseContract._id) {
            const fetchedTypes = await fetchExistingInvoiceTypesForContract(
              selectedPurchaseContract._id,
              selectedPurchaseContract.contractNo
            );
            // Re-validate after fetching using the returned data
            if (
              !canCreateInvoiceType(
                selectedInvoiceType,
                selectedPurchaseContract._id,
                fetchedTypes
              )
            ) {
              notifyError(
                getInvoiceTypeDisabledReason(
                  selectedInvoiceType,
                  selectedPurchaseContract._id,
                  fetchedTypes
                )
              );
              return;
            }
          } else {
            notifyError(
              getInvoiceTypeDisabledReason(
                selectedInvoiceType,
                selectedPurchaseContract._id
              )
            );
            return;
          }
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

        // Get contract currency and convert commission if needed
        const contractCurrency =
          selectedPurchaseContract.productInfo?.[0]?.selectedCurrency || baseCurrency || "MYR";
        let commissionAmount = totalAgentCommission;

        if (contractCurrency !== invoiceData.currency) {
          try {
            const conversion = await convertCurrency(
              contractCurrency,
              invoiceData.currency,
              totalAgentCommission
            );
            commissionAmount = conversion.convertedAmount;
            notifySuccess(
              `Commission amount converted from ${contractCurrency} to ${invoiceData.currency} (Rate: ${conversion.exchangeRate})`
            );
          } catch (error) {
            notifyError(vi("currencyConversionFailedOriginal", "Currency conversion failed. Using original amount."));
          }
        }

        if (commissionAmount <= 0) {
          notifyError(vi("commissionAmountMustBeGreaterThanZero", "Commission amount must be greater than 0"));
          return;
        }

        // Check if commission already exists for this contract
        const existingCommissionItem = invoiceData.items.find(
          (item) =>
            item.contractId === selectedPurchaseContract._id &&
            item.itemType === "commission"
        );

        if (existingCommissionItem) {
          notifyError(vi("commissionItemAlreadyExists", "Commission item already exists for this contract"));
          return;
        }

        const description = addItemData.description || "Commission";
        const contractNoDisplay = `(${selectedPurchaseContract.contractNo})`;
        const lineLabel = `${description} ${contractNoDisplay}`;

        // Add commission item to invoice
        const newItem = {
          id: invoiceData.items.length + 1,
          quantity: 1,
          itemName: lineLabel,
          description: lineLabel,
          unitPrice: commissionAmount,
          amount: commissionAmount,
          discount: 0,
          total: commissionAmount,
          contractId: selectedPurchaseContract._id,
          contractNo: selectedPurchaseContract.contractNo,
          itemType: "commission",
          contractType: "purchase",
          totalAgentCommission: totalAgentCommission,
          originalCurrency: contractCurrency,
          convertedAmount: commissionAmount,
          expenseAccount: addItemData.expenseAccount,
          itemId: selectedPurchaseContract.productInfo?.[0]?.item || null,
          lineItemCustomFields: {},
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

        // Reset modal data but preserve contract context
        setAddItemData({
          purchaseContract:
            contractContext.fromContract &&
            contractContext.contractType === "purchase"
              ? contractContext.contractId
              : "",
          salesContract:
            contractContext.fromContract &&
            contractContext.contractType === "sales"
              ? contractContext.contractId
              : "",
          itemType: "cost_of_goods",
          contractType: contractContext.fromContract
            ? contractContext.contractType
            : "sales",
          description: "",
          amount: 0,
          expenseAccount: "",
        });
        setModalErrors({});
        setShowAddItemModal(false);
        notifySuccess(vi("commissionItemAddedSuccessfully", "Commission item added successfully"));
        return;
      }

      // Handle Sales Contract Commission
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

      // Check if contract can be selected
      if (
        !canCreateInvoiceType(selectedInvoiceType, selectedSalesContract._id)
      ) {
        // If validation failed because we haven't fetched invoice types yet, fetch them
        if (selectedContractForValidation !== selectedSalesContract._id) {
          const fetchedTypes = await fetchExistingInvoiceTypesForContract(
            selectedSalesContract._id,
            selectedSalesContract.contractNo
          );
          // Re-validate after fetching using the returned data
          if (
            !canCreateInvoiceType(
              selectedInvoiceType,
              selectedSalesContract._id,
              fetchedTypes
            )
          ) {
            notifyError(
              getInvoiceTypeDisabledReason(
                selectedInvoiceType,
                selectedSalesContract._id,
                fetchedTypes
              )
            );
            return;
          }
        } else {
          notifyError(
            getInvoiceTypeDisabledReason(
              selectedInvoiceType,
              selectedSalesContract._id
            )
          );
          return;
        }
      }

      // Get commission amount from sales contract
      const totalAgentCommission =
        selectedSalesContract.productInfo?.[0]?.totalAgentCommission || 0;

      // Get contract currency and convert commission if needed
      const contractCurrency =
        selectedSalesContract.productInfo?.[0]?.selectedCurrency || baseCurrency || "MYR";
      let commissionAmount = totalAgentCommission;

      if (contractCurrency !== invoiceData.currency) {
        try {
          const conversion = await convertCurrency(
            contractCurrency,
            invoiceData.currency,
            totalAgentCommission
          );
          commissionAmount = conversion.convertedAmount;
          notifySuccess(
            `Commission amount converted from ${contractCurrency} to ${invoiceData.currency} (Rate: ${conversion.exchangeRate})`
          );
        } catch (error) {
          notifyError(vi("currencyConversionFailedOriginal", "Currency conversion failed. Using original amount."));
        }
      }

      if (commissionAmount <= 0) {
        notifyError(vi("commissionAmountMustBeGreaterThanZero", "Commission amount must be greater than 0"));
        return;
      }

      const description = addItemData.description || "Commission";
      const contractNoDisplay = `(${selectedSalesContract.contractNo})`;
      const lineLabel = `${description} ${contractNoDisplay}`;

      // Add commission item to invoice
      const newItem = {
        id: invoiceData.items.length + 1,
        quantity: 1,
        itemName: lineLabel,
        description: lineLabel,
        unitPrice: commissionAmount,
        amount: commissionAmount,
        discount: 0,
        total: commissionAmount,
        contractId: selectedSalesContract._id,
        contractNo: selectedSalesContract.contractNo,
        itemType: "commission",
        contractType: "sales",
        totalAgentCommission: totalAgentCommission,
        originalCurrency: contractCurrency,
        convertedAmount: commissionAmount,
        expenseAccount: addItemData.expenseAccount,
        itemId:
          selectedSalesContract.productInfo?.[0]?.item?._id ||
          selectedSalesContract.productInfo?.[0]?.itemId ||
          null,
        lineItemCustomFields: {},
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

      // Reset modal data but preserve contract context
      setAddItemData({
        purchaseContract:
          contractContext.fromContract &&
          contractContext.contractType === "purchase"
            ? contractContext.contractId
            : "",
        salesContract:
          contractContext.fromContract &&
          contractContext.contractType === "sales"
            ? contractContext.contractId
            : "",
        itemType: "cost_of_goods",
        contractType: contractContext.fromContract
          ? contractContext.contractType
          : "sales",
        description: "",
        amount: 0,
        expenseAccount: "",
      });
      setModalErrors({});
      setShowAddItemModal(false);
      notifySuccess(vi("commissionItemAddedSuccessfully", "Commission item added successfully"));
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
        itemType: "Goods",
        quantity: quantity,
        unitPrice: unitPrice,
        discount: 0,
        tax: taxAmount,
        taxRate: taxRate,
        taxId: taxOnItem?._id || "",
        taxName: taxOnItem?.name || "",
        total: Math.max(0, lineSubtotal + taxAmount),
        expenseAccount: invoiceData.expenseAccount || "",
        lineItemCustomFields: {},
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
        (it) => String(it.itemId) === String(itemId)
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
          lineItemCustomFields: {
            ...(existing.lineItemCustomFields || {}),
            ...(newItem.lineItemCustomFields || {}),
          },
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
        invoiceData.shippingCharges +
        invoiceData.adjustment
    );

    setInvoiceData((prev) => ({
      ...prev,
      items: merged,
      subtotal,
      taxTotal,
      discountAmount,
      total,
    }));

    notifySuccess(vi("bulkItemsAdded", `${newItems.length} item(s) added successfully`, { count: newItems.length }));
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
      const vendorId =
        selectedVendor?._id || contractContext?.vendorId || invoiceData?.vendorId || null;

      // Prepare supporting documents array
      let supportingDocuments = [];
      if (
        invoiceData.supportingDocuments &&
        invoiceData.supportingDocuments.length > 0
      ) {
        supportingDocuments = invoiceData.supportingDocuments;
      } else if (invoiceData.supportingDocument) {
        supportingDocuments = [invoiceData.supportingDocument];
      }

      const invoiceDataToSubmit = {
        business: invoiceData.business,
        vendor: vendorId,
        vendorId,
        invoiceNumber: invoiceNumber,
        invoiceDate: new Date(invoiceData.invoiceDate),
        invoiceType: selectedInvoiceType, // Use selectedInvoiceType instead of invoiceData.invoiceType
        dueDate: new Date(invoiceData.dueDate),
        terms: invoiceData.terms || "Due on Receipt",
        vendorBankAccount: selectedVendorAccount?._id,
        // Handle both purchase and sales contracts
        purchaseContract: invoiceData.purchaseContract,
        salesContract: invoiceData.salesContract,
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
        shipping: invoiceData.shippingCharges || 0,
        adjustments: invoiceData.adjustment || 0,
        total: invoiceData.total,
        currency:
          invoiceData.currency ||
          (selectedVendor?.basicInformation?.currency?.symbol ||
            selectedVendor?.basicInformation?.currency?.name) ||
          baseCurrency || "MYR",
        // Main expense account: only include if valid (omit empty string to avoid Cast error)
        ...(invoiceData.expenseAccount &&
          invoiceData.expenseAccount !== "" && {
            expenseAccount: invoiceData.expenseAccount,
          }),
        // Link to Vendor Payment Term master by ID (while still sending terms name for backward compatibility)
        ...(invoiceData.paymentTermId && {
          paymentTermId: invoiceData.paymentTermId,
        }),
        status: status,
        supportingDocuments: supportingDocuments,
        // Backward compatibility
        supportingDocument: invoiceData.supportingDocument,
        ...(linkedPurchaseOrderId && { purchaseOrder: linkedPurchaseOrderId }),
      };

      console.log("Sending invoice data:", invoiceDataToSubmit);

      const response = await axios.post(
        `${Base_URL}/vendor-invoices`,
        invoiceDataToSubmit,
        { headers },
      );

      if (response.data.success) {
        const newId = response.data?.data?._id;
        if (newId && invoiceData.business) {
          try {
            await upsertValues(
              {
                business_id: invoiceData.business,
                module: "purchase",
                screen: "vendor_invoice",
                record_id: String(newId),
                values: invoiceCustomFieldValues,
              },
              headers,
            );
          } catch (cfErr) {
            notifyError(
              cfErr?.response?.data?.message ||
                vi("customFieldsSaveFailed", "Invoice saved but custom fields failed to save."),
            );
            setIsLoading(false);
            return;
          }
        }
        notifySuccess(
          response.data.message ||
            (status === "Draft"
              ? vi("savedAsDraftSuccess", "Invoice saved as draft successfully")
              : vi("createdSuccess", "Invoice created successfully"))
        );
        history.push("/vendor-invoices");
      } else {
        const code = response.data?.error || response.data?.code;
        if (code === "PO_QTY_EXCEEDED") {
          notifyError(
            vi("poQtyExceededDetailed", "The quantity on this bill exceeds the remaining quantity on the linked Purchase Order. Please reduce the quantity to the remaining PO quantity and try again.")
          );
        } else {
          notifyError(response.data.error || vi("failedToCreateInvoiceShort", "Failed to create invoice"));
        }
      }
    } catch (error) {
      console.error("Error saving invoice:", error);
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

  // Render Add Item Modal
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      // Start upload process
      setUploading(true);
      setUploadSuccess(false);

      // Prepare form data for upload
      const formDataForUpload = new FormData();
      formDataForUpload.append(
        "file_path",
        `VendorInvoices/${invoiceData.invoiceNumber || invoiceNumber}`
      );
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

          const newDocument = {
            fileId: uploadedFile._id,
            name: uploadedFile.name,
            url: uploadedFile.url || "#",
            downloadUrl: uploadedFile.downloadUrl || "#",
            uploadedAt: new Date().toISOString(),
            size: file.size,
            type: file.type,
          };

          // Update the form data with the uploaded document information
          setInvoiceData({
            ...invoiceData,
            supportingDocument: newDocument,
            supportingDocuments: [
              ...invoiceData.supportingDocuments,
              newDocument,
            ],
          });

          // Show success message in UI
          setSuccessMessage(
            response.data.message || vi("fileUploadedSuccessfully", "File uploaded successfully!")
          );
          setUploadSuccess(true);

          // Auto-hide success message after 3 seconds
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

  const handleRemoveDocument = () => {
    setInvoiceData({
      ...invoiceData,
      supportingDocument: null,
      supportingDocuments: [],
    });
  };

  // Restore contract context and populate description when modal opens
  useEffect(() => {
    if (showAddItemModal) {
      // If contract context exists, restore it
      if (contractContext.fromContract && contractContext.contractId) {
        if (contractContext.contractType === "sales") {
          setAddItemData((prev) => {
            // Only restore if contract is not already set
            if (prev.salesContract === contractContext.contractId) {
              return prev;
            }
            return {
              ...prev,
              salesContract: contractContext.contractId,
              contractType: "sales",
              purchaseContract: "",
              description:
                selectedInvoiceType === "commission"
                  ? prev.description || "Commission"
                  : prev.description,
            };
          });
        } else if (contractContext.contractType === "purchase") {
          setAddItemData((prev) => {
            // Only restore if contract is not already set
            if (prev.purchaseContract === contractContext.contractId) {
              return prev;
            }
            return {
              ...prev,
              purchaseContract: contractContext.contractId,
              contractType: "purchase",
              salesContract: "",
              description: prev.description || "",
            };
          });
        }
      }

      // Populate description from product info if contract is already selected
      if (selectedInvoiceType === "supplier" && addItemData.purchaseContract) {
        const selectedContract = contracts.find(
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
          const selectedContract = contracts.find(
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
              type="button"
              onClick={() => {
                setShowAddItemModal(false);
                setModalErrors({});
                setAddItemData({
                  purchaseContract:
                    contractContext.fromContract &&
                    contractContext.contractType === "purchase"
                      ? contractContext.contractId
                      : "",
                  salesContract:
                    contractContext.fromContract &&
                    contractContext.contractType === "sales"
                      ? contractContext.contractId
                      : "",
                  itemType: "cost_of_goods",
                  contractType: contractContext.fromContract
                    ? contractContext.contractType
                    : "sales",
                  itemName: "",
                  description: "",
                  quantity: 1,
                  amount: 0,
                  expenseAccount: "",
                });
              }}
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
                      !contractContext.fromContract &&
                      setAddItemData({
                        ...addItemData,
                        contractType: "sales",
                        purchaseContract: "",
                        salesContract: "",
                      })
                    }
                    disabled={
                      contractContext.fromContract &&
                      contractContext.contractType !== "sales"
                    }
                    className={`p-3 rounded-lg border-2 transition-all ${
                      addItemData.contractType === "sales"
                        ? "border-[var(--p-blue)] bg-[#f0fbf7] text-[var(--p-blue)]"
                        : contractContext.fromContract &&
                          contractContext.contractType !== "sales"
                        ? "border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                    }`}
                  >
                    <FileText size={20} className="mx-auto mb-1" />
                    <span className="text-sm font-medium">{vi("salesContract", "Sales Contract")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      !contractContext.fromContract &&
                      setAddItemData({
                        ...addItemData,
                        contractType: "purchase",
                        purchaseContract: "",
                        salesContract: "",
                      })
                    }
                    disabled={
                      contractContext.fromContract &&
                      contractContext.contractType !== "purchase"
                    }
                    className={`p-3 rounded-lg border-2 transition-all ${
                      addItemData.contractType === "purchase"
                        ? "border-[var(--p-blue)] bg-[#f0fbf7] text-[var(--p-blue)]"
                        : contractContext.fromContract &&
                          contractContext.contractType !== "purchase"
                        ? "border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                    }`}
                  >
                    <Package size={20} className="mx-auto mb-1" />
                    <span className="text-sm font-medium">
                      {vi("purchaseContract", "Purchase Contract")}
                    </span>
                  </button>
                </div>
                {contractContext.fromContract && (
                  <div className="text-blue-600 text-xs mt-1">
                    {vi("contractTypePreSelected", "Contract type pre-selected from expense table")}
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
                {!invoiceData.business ? (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-yellow-800 text-sm">
                      {vi("selectBusinessFirstForContracts", "Please select a business first to view purchase contracts.")}
                    </p>
                  </div>
                ) : contracts.length === 0 ? (
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <p className="text-gray-600 text-sm">
                      {vi("noPurchaseContractsAvailable", "No purchase contracts available for the selected business.")}
                    </p>
                    <p className="text-gray-500 text-xs mt-1">
                      {vi("businessId", "Business ID")}: {invoiceData?.business || vi("notSet", "Not set")}
                    </p>
                  </div>
                ) : (
                  <SearchableDropdown
                    value={addItemData.purchaseContract}
                    onChange={(e) => {
                      const selectedContract = contracts.find(
                        (c) => c._id === e.target.value
                      );

                      // Auto-populate description for logistic service
                      let autoDescription = addItemData.description;
                      if (selectedContract) {
                        autoDescription = `Logistic service for ${selectedContract.contractNo}`;
                      }

                      setAddItemData({
                        ...addItemData,
                        purchaseContract: e.target.value,
                        description: autoDescription,
                      });
                    }}
                    disabled={
                      contractContext.fromContract &&
                      contractContext.contractType === "purchase"
                    }
                    placeholder={vi("selectPurchaseContract", "Select Purchase Contract")}
                    searchPlaceholder={vi("searchPurchaseContracts", "Search purchase contracts...")}
                    options={contracts
                      .filter((contract) => {
                        // For logistic invoices, show ALL contracts (no filtering except business which is already applied)
                        return true; // Show all contracts
                      })
                      .map((contract) => ({
                        value: contract._id,
                        label: contract.contractNo,
                      }))}
                  />
                )}
                {contractContext.fromContract &&
                  contractContext.contractType === "purchase" && (
                    <div className="text-blue-600 text-xs mt-1">
                      {vi("purchaseContractPreSelected", "Purchase contract pre-selected from expense table")}
                    </div>
                  )}
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
                  onChange={(e) =>
                    setAddItemData({
                      ...addItemData,
                      description: e.target.value,
                    })
                  }
                  placeholder={vi("enterLogisticServiceDescription", "Enter logistic service description")}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
                  required
                />
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
                    onChange={(e) =>
                      setAddItemData({ ...addItemData, amount: e.target.value })
                    }
                    placeholder={vi("enterAmount", "Enter amount")}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
                    step="0.01"
                    min="0"
                    required
                  />
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

            {/* Purchase Contract Selection for Commission Agent */}
            {selectedInvoiceType === "commission" &&
              addItemData.contractType === "purchase" && (
                <div>
                  <label className="block text-gray-700 mb-2">
                    {vi("purchaseContract", "Purchase Contract")} *
                  </label>
                  <div className="relative">
                    <select
                      value={addItemData.purchaseContract}
                      onChange={(e) =>
                        handlePurchaseContractChange(e.target.value)
                      }
                      className="w-full p-3 border border-gray-300 rounded-lg appearance-none bg-white pr-10 focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
                    >
                      <option value="">{vi("selectPurchaseContract", "Select Purchase Contract")}</option>
                      {console.log("contracts", contracts)}
                      {contracts
                        .filter((contract) => {
                          if (selectedInvoiceType === "commission") {
                            return contract.basicInfo?.agent_id;
                          }
                          return true;
                        })
                        .map((contract) => (
                          <option key={contract._id} value={contract._id}>
                            {contract.contractNo} -{" "}
                            {contract.basicInfo?.selectedVendorId
                              ?.basicInformation?.vendorDisplayName || "Vendor"}
                            {contract.productInfo?.[0]?.totalAgentCommission &&
                              ` ($${contract.productInfo[0].totalAgentCommission.toLocaleString()} commission)`}
                          </option>
                        ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    </div>
                  </div>
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

                      setAddItemData({
                        ...addItemData,
                        salesContract: e.target.value,
                        description: autoDescription,
                      });

                      handleSalesContractChange(e.target.value);
                    }}
                    disabled={
                      contractContext.fromContract &&
                      contractContext.contractType === "sales"
                    }
                    placeholder={vi("selectSalesContract", "Select Sales Contract")}
                    searchPlaceholder={vi("searchSalesContracts", "Search sales contracts...")}
                    options={salesContracts
                      .filter((contract) => {
                        // If coming from contract context, only show that specific contract
                        if (
                          contractContext.fromContract &&
                          contractContext.contractType === "sales"
                        ) {
                          return contract._id === contractContext.contractId;
                        }
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
                            ? ` ($${contract.productInfo[0].totalAgentCommission.toLocaleString()} commission)`
                            : ""
                        }`,
                      }))}
                  />
                  {contractContext.fromContract &&
                    contractContext.contractType === "sales" && (
                      <div className="text-blue-600 text-xs mt-1">
                        {vi("salesContractPreSelected", "Sales contract pre-selected from expense table")}
                      </div>
                    )}
                </div>
              )}

            {/* Item Type Selection - Only for Supplier Invoice (only when using contract-based items) */}
            {selectedInvoiceType === "supplier" && addItemData.purchaseContract && (
              <div>
                <label className="block text-gray-700 mb-2">{vi("type", "Type")} *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      // Preserve contract selections but clear description/amount
                      const selectedContract = contracts.find(
                        (c) => c._id === addItemData.purchaseContract
                      );
                      const autoDescription =
                        selectedContract?.productInfo
                          ?.map(
                            (product) =>
                              `${product.title} - ${product.quantityMTS} MTS @ $${product.price}/MT`
                          )
                          .join(", ") || "";

                      setAddItemData((prev) => ({
                        ...prev,
                        // UI: Cost of Goods -> Backend: Goods
                        itemType: "Goods",
                        description: autoDescription || prev.description,
                        amount: 0,
                      }));
                    }}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      addItemData.itemType === "cost_of_goods"
                        ? "border-[var(--p-blue)] bg-[#f0fbf7] text-[var(--p-blue)]"
                        : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                    }`}
                  >
                    <Package size={20} className="mx-auto mb-1" />
                    <span className="text-sm font-medium">{vi("costOfGoods", "Cost of Goods")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setAddItemData((prev) => ({
                        ...prev,
                        // UI: Expense -> Backend: Service
                        itemType: "Service",
                        description: "",
                        amount: 0,
                      }))
                    }
                    className={`p-3 rounded-lg border-2 transition-all ${
                      addItemData.itemType === "expense"
                        ? "border-[var(--p-blue)] bg-[#f0fbf7] text-[var(--p-blue)]"
                        : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                    }`}
                  >
                    <DollarSign size={20} className="mx-auto mb-1" />
                    <span className="text-sm font-medium">{vi("expense", "Expense")}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Supplier Invoice: Simple manual item fields (no contract/type UI) */}
            {selectedInvoiceType === "supplier" && !addItemData.purchaseContract && (
              <>
                <div>
                  <label className="block text-gray-700 mb-2">{vi("itemName", "Item Name")} *</label>
                  <input
                    type="text"
                    value={addItemData.itemName}
                    onChange={(e) =>
                      setAddItemData({ ...addItemData, itemName: e.target.value })
                    }
                    placeholder={vi("enterItemName", "Enter item name")}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
                  />
                  {modalErrors?.itemName && (
                    <p className="text-red-500 text-xs mt-1">
                      {modalErrors.itemName}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-gray-700 mb-2">{vi("description", "Description")}</label>
                  <textarea
                    value={addItemData.description}
                    onChange={(e) =>
                      setAddItemData({
                        ...addItemData,
                        description: e.target.value,
                      })
                    }
                    placeholder={vi("enterDescriptionOptional", "Enter description (optional)")}
                    className="w-full min-h-[5rem] p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] resize-y"
                    rows="3"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-700 mb-2">{vi("qty", "Qty")} *</label>
                    <input
                      type="number"
                      value={addItemData.quantity}
                      onChange={(e) =>
                        setAddItemData({
                          ...addItemData,
                          quantity: e.target.value,
                        })
                      }
                      placeholder={vi("qty", "Qty")}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
                      step="1"
                      min="1"
                    />
                    {modalErrors?.quantity && (
                      <p className="text-red-500 text-xs mt-1">
                        {modalErrors.quantity}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2">{vi("amount", "Amount")} *</label>
                    <input
                      type="number"
                      value={addItemData.amount}
                      onChange={(e) =>
                        setAddItemData({ ...addItemData, amount: e.target.value })
                      }
                      placeholder={vi("amount", "Amount")}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
                      step="0.01"
                      min="0"
                    />
                    {modalErrors?.amount && (
                      <p className="text-red-500 text-xs mt-1">
                        {modalErrors.amount}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-gray-700 mb-2">{vi("tax", "Tax")}</label>
                  {taxes && taxes.length > 0 ? (
                    <SearchableDropdown
                      value={addItemData.taxId || ""}
                      onChange={(e) => {
                        const taxId = e.target.value || "";
                        const selectedTax = taxes.find((t) => String(t._id) === String(taxId));
                        setAddItemData({
                          ...addItemData,
                          taxId,
                          taxRate: selectedTax ? parseFloat(selectedTax.rate) || 0 : 0,
                          taxName: selectedTax?.name || "",
                        });
                      }}
                      placeholder={vi("selectTax", "Select tax")}
                      searchPlaceholder={vi("searchTaxes", "Search taxes...")}
                      clearable={true}
                      options={[
                        { value: "", label: vi("noTax", "No tax") },
                        ...(taxes || []).map((t) => ({
                          value: t._id,
                          label: `${t.name} (${t.rate}%)`,
                        })),
                      ]}
                      searchKeys={["label"]}
                      className="border-gray-300"
                    />
                  ) : (
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={addItemData.taxRate ?? ""}
                      onChange={(e) =>
                        setAddItemData({
                          ...addItemData,
                          taxRate: e.target.value,
                          taxId: "",
                          taxName: "",
                        })
                      }
                      className="w-full px-3 py-2 text-sm text-right border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)]"
                      placeholder="0–100%"
                      title={vi("itemTaxPercentage", "Item tax percentage (0–100%)")}
                    />
                  )}
                </div>
              </>
            )}

            {/* Description field */}
            {/* For supplier invoice - show for both cost of goods and expense items */}
            {selectedInvoiceType === "supplier" && addItemData.purchaseContract && (
              <div>
                <label className="block text-gray-700 mb-2">
                  {vi("description", "Description")}{" "}
                  {addItemData.itemType === "expense"
                    ? "*"
                    : vi("autoGeneratedEditable", "(Auto-generated, editable)")}
                </label>
                <textarea
                  value={addItemData.description}
                  onChange={(e) =>
                    setAddItemData({
                      ...addItemData,
                      description: e.target.value,
                    })
                  }
                  placeholder={
                    addItemData.itemType === "cost_of_goods"
                      ? vi("autoGeneratedFromContractProducts", "Auto-generated from contract products (editable)")
                      : vi("enterItemDescription", "Enter item description")
                  }
                  className="w-full min-h-[5rem] p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] resize-y"
                  rows="3"
                />
                {addItemData.itemType === "cost_of_goods" && (
                  <p className="text-sm text-blue-600 mt-1">
                    {vi("descriptionAutoGenerated", "Description auto-generated from contract products. You can edit it if needed.")}
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
                    placeholder={vi("descriptionAutoPopulated", "Description (auto-populated from product info)")}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    {vi("descriptionAutoPopulatedNote", "Description is auto-populated from product info. Contract number will be automatically added in brackets.")}
                  </p>
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
                    onChange={(e) =>
                      setAddItemData({ ...addItemData, amount: e.target.value })
                    }
                    placeholder="0.00"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
                    step="0.01"
                    min="0"
                  />
                </div>
              )}

            {/* Expense Account Selection (only for contract-based supplier/expense flows) */}
            {(selectedInvoiceType !== "supplier" || addItemData.purchaseContract) && (
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
                      if (modalErrors?.expenseAccount) {
                        setModalErrors({
                          ...modalErrors,
                          expenseAccount: "",
                        });
                      }
                    }}
                    className={`w-full p-3 border rounded-lg appearance-none pr-10 focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] bg-white ${
                      modalErrors?.expenseAccount
                        ? "border-red-500"
                        : "border-gray-300"
                    }`}
                  >
                    <option value="">{vi("selectExpenseAccount", "Select Expense Account")}</option>
                    {expenseAccounts?.map((account) => (
                      <option key={account._id} value={account._id}>
                        {account.code || "N/A"} - {account.accountName} (
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
                {modalErrors?.expenseAccount && (
                  <div className="text-red-500 text-xs mt-1">
                    {modalErrors.expenseAccount}
                  </div>
                )}
              </div>
            )}

            {/* Commission Amount Display for Purchase Contracts */}
            {selectedInvoiceType === "commission" &&
              addItemData.contractType === "purchase" &&
              addItemData.purchaseContract && (
                <div>
                  <label className="block text-gray-700 mb-2">
                    {vi("commissionAmountPredefined", "Commission Amount (Pre-defined)")}
                  </label>
                  <div className="p-3 bg-gray-50 border border-gray-300 rounded-lg">
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>{vi("totalAgentCommission", "Total Agent Commission")}:</span>
                      <span>
                        $
                        {(
                          contracts.find(
                            (c) => c._id === addItemData.purchaseContract
                          )?.productInfo?.[0]?.totalAgentCommission || 0
                        ).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between font-medium text-[var(--p-blue)] pt-2 border-t">
                      <span>{vi("commissionAmount", "Commission Amount")}:</span>
                      <span>
                        $
                        {(
                          contracts.find(
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
                    {vi("commissionAmountPredefined", "Commission Amount (Pre-defined)")}
                  </label>
                  <div className="p-3 bg-gray-50 border border-gray-300 rounded-lg">
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
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
                    <div className="flex justify-between font-medium text-[var(--p-blue)] pt-2 border-t">
                      <span>{vi("commissionAmount", "Commission Amount")}:</span>
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
                    <strong>{vi("note", "Note")}:</strong> {vi("commissionNote", "Commission amount is pre-defined in the contract's totalAgentCommission field. The contract number will be added to the description automatically.")}
                  </p>
                </div>
              )}
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={() => {
                setShowAddItemModal(false);
                setModalErrors({});
                setAddItemData({
                  purchaseContract:
                    contractContext.fromContract &&
                    contractContext.contractType === "purchase"
                      ? contractContext.contractId
                      : "",
                  salesContract:
                    contractContext.fromContract &&
                    contractContext.contractType === "sales"
                      ? contractContext.contractId
                      : "",
                  itemType: "cost_of_goods",
                  contractType: contractContext.fromContract
                    ? contractContext.contractType
                    : "sales",
                  itemName: "",
                  description: "",
                  quantity: 1,
                  amount: 0,
                  expenseAccount: "",
                });
              }}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              {vi("cancel", "Cancel")}
            </button>
            <button
              onClick={handleAddItemToInvoice}
              className="flex-1 px-4 py-2 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[#9CBA33]"
            >
              {vi("addItem", "Add Item")}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Currency conversion function (same as ViewVendorInvoice)
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
      setIsLoadingConversion(true);
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
      notifyError(vi("currencyConversionFailedOriginal", "Currency conversion failed. Using original amount."));
      return { convertedAmount: amount, exchangeRate: 1 };
    } finally {
      setIsLoadingConversion(false);
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
      const existingTypes = (response.data.data || []).map(
        (invoice) => invoice.invoiceType
      );

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
      return vi("invoiceTypeAlreadyCreated", `${invoiceType} invoice already created for this contract`, { invoiceType });
    }

    return "";
  };

  // Handler for purchase contract selection
  const handlePurchaseContractChange = async (contractId) => {
    const selectedContract = contracts.find((c) => c._id === contractId);

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
        autoDescription =
          selectedContract.productInfo
            ?.map(
              (product) =>
                `${product.title} - ${product.quantityMTS} MTS @ $${product.price}/MT`
            )
            .join(", ") || "";
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

  const handleInvoiceTypeChange = async (newInvoiceType) => {
    setSelectedInvoiceType(newInvoiceType);

    // Clear selected vendor if it's not compatible with the new invoice type
    if (selectedVendor) {
      const isCurrentVendorCompatible =
        newInvoiceType === "commission"
          ? selectedVendor.basicInformation.vendorType === "Agent"
          : newInvoiceType === "supplier"
          ? selectedVendor.basicInformation.vendorType !== "Agent"
          : newInvoiceType === "logistic"
          ? selectedVendor.basicInformation.vendorType ===
            "Logistic Service Provider"
          : true; // For other invoice types, all vendors are compatible

      if (!isCurrentVendorCompatible) {
        setSelectedVendor(null);
        setSelectedVendorAccount(null);
        notifyError(
          vi("vendorNotCompatible", "Selected vendor is not compatible with the new invoice type. Please select a different vendor.")
        );
      }
    }

    // Re-validate any already selected contracts with the new invoice type
    const currentContractId =
      newInvoiceType === "supplier"
        ? addItemData.purchaseContract
        : addItemData.salesContract;

    if (currentContractId) {
      // Get current contract details to refetch validation data
      const currentContract =
        newInvoiceType === "supplier"
          ? contracts.find((c) => c._id === currentContractId)
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

  // Compute if all sales contracts are already used (add before renderAddItemModal)
  const usedSalesContractIds = invoiceData.items
    .filter((item) => item.contractType === "sales")
    .map((item) => item.contractId);

  const availableSalesContracts = salesContracts.filter(
    (contract) => !usedSalesContractIds.includes(contract._id)
  );

  const allSalesContractsUsed = availableSalesContracts.length === 0;

  // Check if we're coming from a single sales contract and that contract is already added
  const isFromSingleSalesContract =
    contractContext.fromContract &&
    contractContext.contractType === "sales" &&
    contractContext.contractId;

  const isSingleSalesContractAlreadyAdded =
    isFromSingleSalesContract &&
    invoiceData.items.some(
      (item) =>
        item.contractId === contractContext.contractId &&
        item.contractType === "sales"
    );

  // Disable Add More button if:
  // 1. Coming from single sales contract and that contract is already added, OR
  // 2. All available sales contracts are used
  const shouldDisableAddMoreButton =
    isSingleSalesContractAlreadyAdded ||
    (selectedInvoiceType === "commission" &&
      addItemData.contractType === "sales" &&
      allSalesContractsUsed);

  return (
    <div className="p-6 bg-gray-50 h-full max-h-[90vh] overflow-y-auto pb-[120px] ">
      {/* Show loading when fetching contract context */}
      {isLoadingContractContext && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--p-blue)]"></div>
              <p className="text-gray-700">{vi("loadingContractDetails", "Loading contract details...")}</p>
            </div>
          </div>
        </div>
      )}

      <PageHeader
        title={vi("createVendorInvoice", "Create Vendor Invoice")}
        showBackButton
        backFallbackPath="/vendor-invoices"
      />

      {/* Invoice Type Selection */}
     

      {/* Continue with form based on selected invoice type */}
      {(selectedInvoiceType === "supplier" ||
        selectedInvoiceType === "commission" ||
        selectedInvoiceType === "logistic") && (
        <>
          {/* Vendor Section */}
          <div className="bg-[#f0fbf7] p-6 rounded-lg mb-6">
            <h2 className="text-lg font-medium mb-4 text-gray-800">
              {selectedInvoiceType === "commission"
                ? vi("agentInformation", "Agent Information")
                : vi("vendorInformation", "Vendor Information")}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <SingleBusinessField
                selectedValue={invoiceData.business}
                onAutoSelect={(id) =>
                  handleInputChange({ target: { name: "business", value: id } })
                }
              >
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
                  isDisabled={contractContext.fromContract}
                  isClearable={false}
                />
                {contractContext.fromContract && (
                  <div className="text-blue-600 text-xs mt-1">
                    {vi("businessPreSelectedFromContract", "Business pre-selected from contract")}
                  </div>
                )}
                {formErrors.business && (
                  <div className="text-red-500 text-xs mt-1">
                    {formErrors.business}
                  </div>
                )}
              </div>
              </SingleBusinessField>

              <div>
                <label className="block text-gray-700 mb-2">
                  {selectedInvoiceType === "commission"
                    ? vi("agentName", "Agent Name") + " *"
                    : vi("vendorName", "Vendor Name") + " *"}
                </label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <SearchableDropdown
                      name="vendorName"
                      value={selectedVendor?._id || ""}
                      onChange={(e) => handleChangeVendor(e.target.value)}
                      disabled={
                        contractContext.fromContract && contractContext.vendorId
                      }
                      placeholder={
                        selectedInvoiceType === "commission"
                          ? vi("selectAgent", "Select Agent")
                          : selectedInvoiceType === "logistic"
                          ? vi("selectLogisticServiceProvider", "Select Logistic Service Provider")
                          : vi("selectVendor", "Select Vendor")
                      }
                      searchPlaceholder={
                        selectedInvoiceType === "commission"
                          ? vi("searchAgents", "Search agents...")
                          : selectedInvoiceType === "logistic"
                          ? vi("searchLogisticServiceProviders", "Search logistic service providers...")
                          : vi("searchVendors", "Search vendors...")
                      }
                      options={
                        vendors
                          ?.filter((vendor) => {
                            // Exclude inactive vendors from selection
                            if (vendor.status && vendor.status !== "Active") {
                              return false;
                            }
                            // For commission invoice type, only show Agent vendors
                            if (selectedInvoiceType === "commission") {
                              return vendor.basicInformation.vendorType === "Agent";
                            }
                            // For supplier invoice type, exclude Agent vendors
                            if (selectedInvoiceType === "supplier") {
                              return vendor.basicInformation.vendorType !== "Agent";
                            }
                            // For logistic invoice type, only show Logistic Service Provider vendors
                            if (selectedInvoiceType === "logistic") {
                              return (
                                vendor.basicInformation.vendorType ===
                                "Logistic Service Provider"
                              );
                            }
                            // For other invoice types, show all active vendors
                            return true;
                          })
                          .map((vendor) => ({
                            value: vendor._id,
                            label: vendor.basicInformation.vendorDisplayName,
                          })) || []
                      }
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
                {contractContext.fromContract && contractContext.vendorId && (
                  <div className="text-blue-600 text-xs mt-1">
                    {vi("vendorPreSelectedFromContract", "Vendor pre-selected from contract")}
                  </div>
                )}
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
                  placeholder={vi("enterVendorType", "Enter vendor type")}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-700 mb-2">{vi("phone", "Phone")}</label>
                <input
                  type="text"
                  name="phoneNumber"
                  value={invoiceData.phoneNumber}
                  onChange={handleInputChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
                  placeholder={vi("enterPhoneNumber", "Enter phone number")}
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-2">{vi("vendorEmail", "Vendor Email")}</label>
                <input
                  type="email"
                  name="vendorEmail"
                  value={invoiceData.vendorEmail}
                  onChange={handleInputChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
                  placeholder={vi("enterVendorEmail", "Enter vendor email")}
                />
              </div>
            </div>
          </div>

          {/* Invoice Details */}
          <div className="bg-white p-6 rounded-lg mb-6 shadow-sm">
            <h2 className="text-lg font-medium mb-4 text-gray-800">
              {vi("invoiceDetails", "Invoice Details")}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label className="block text-gray-700 mb-2">
                  {vi("invoiceNumber", "Invoice Number")} *
                </label>
                {docNumMissing && (
                  <div className="mb-2 flex items-center justify-between gap-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs">
                    <span>
                      {vi("invoiceNumberingNotConfigured", "Invoice numbering is not configured for this business group. Numbers will be auto-generated using the Business Group fallback sequence.")}
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
                        {vi("configureNow", "Configure Now")}
                      </a>
                    )}
                  </div>
                )}
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
                    readOnly
                    placeholder={vi("autoGeneratedOnBusinessSelection", "Auto-generated on business selection")}
                    className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 cursor-not-allowed"
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
                  value={invoiceData.currency || baseCurrency || "MYR"}
                  readOnly
                  className="w-full px-3 py-2.5 text-sm bg-gray-100 text-gray-700 border border-gray-300 rounded-lg cursor-not-allowed"
                  placeholder={vi("vendorCurrencyWillAppear", "Vendor currency will appear here")}
                />
              </div>

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
                      expenseAccounts?.map((account) => ({
                        value: account._id,
                        label: `${account.code || "N/A"} - ${
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
                  placeholder={vi("selectPaymentTerm", "Select Payment Term")}
                  searchPlaceholder={vi("searchPaymentTerms", "Search payment terms...")}
                  disabled={!invoiceData.business}
                  options={
                    (paymentTerms?.map((term) => ({
                      value: term.name,
                      label: term.name,
                      name: term.name,
                    })) || []
                  ).filter((t, i, a) => a.findIndex((x) => x.value === t.value) === i)}
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
                <div className="md:col-span-4 w-full">
                  <DynamicCustomFieldsForm
                    businessId={invoiceData.business}
                    module="purchase"
                    screen="vendor_invoice"
                    columns={3}
                    values={invoiceCustomFieldValues}
                    onValuesChange={setInvoiceCustomFieldValues}
                    headers={headers}
                    useBreakpointGrid
                  />
                </div>
              ) : null}
            </div>
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

                    if (
                      field === "quantity" ||
                      field === "unitPrice" ||
                      field === "discount" ||
                      field === "taxRate" ||
                      field === "taxId" ||
                      field === "taxName"
                    ) {
                      const quantity = parseFloat(updatedItems[index].quantity) || 1;
                      const unitPrice = parseFloat(updatedItems[index].unitPrice) || 0;
                      const discount = parseFloat(updatedItems[index].discount) || 0;
                      const taxRate = parseFloat(updatedItems[index].taxRate) || 0;
                      const lineSubtotal =
                        quantity * unitPrice * (1 - (discount || 0) / 100);
                      const taxAmount = (lineSubtotal * taxRate) / 100;
                      updatedItems[index].total = Math.max(
                        0,
                        lineSubtotal + taxAmount
                      );
                    }
                  }

                  const subtotal = updatedItems.reduce(
                    (sum, item) => sum + (item.total || 0),
                    0
                  );
                  const taxTotal = sumLineTaxAmountsFromItems(updatedItems);
                  const discountAmount =
                    (subtotal * (parseFloat(prev.discountPercentage) || 0)) / 100;
                  const total = Math.max(
                    0,
                    subtotal -
                      discountAmount +
                      (parseFloat(prev.shippingCharges) || 0) +
                      (parseFloat(prev.adjustment) || 0)
                  );

                  return {
                    ...prev,
                    items: updatedItems,
                    subtotal,
                    taxTotal,
                    discountAmount,
                    discountValue: prev.discountPercentage,
                    total,
                  };
                });
              }}
              lineItemCustomFieldDefinitions={lineItemCustomFieldDefs}
              businessId={invoiceData.business}
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
            />
            
            {shouldDisableAddMoreButton && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg mx-6">
                <p className="text-yellow-800 text-sm">
                  {isSingleSalesContractAlreadyAdded
                    ? vi("salesContractAlreadyAdded", "This sales contract has already been added as an item. No more items can be added for this contract.")
                    : vi("allSalesContractsUsed", "All available sales contracts have been added as items. No more items can be added.")}
                </p>
              </div>
            )}

            {formErrors.items && (
              <div className="text-red-500 text-sm mt-2 mx-6">
                {formErrors.items}
              </div>
            )}
          </div>

          {/* Supporting Document Section */}
          <div className="bg-white p-6 rounded-lg mb-6 shadow-sm">
            <h2 className="text-lg font-medium mb-4 text-gray-800">
              {vi("supportingDocuments", "Supporting Documents")}
            </h2>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
              {invoiceData.supportingDocument ? (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <FileText className="h-8 w-8 text-[var(--p-blue)] mr-3" />
                      <div>
                        <p className="font-medium text-gray-800">
                          {invoiceData.supportingDocument.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {(
                            invoiceData.supportingDocument.size /
                            1024 /
                            1024
                          ).toFixed(2)}{" "}
                          MB
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleOpenFile(invoiceData.supportingDocument.fileId)
                        }
                        className="p-2 text-[var(--p-blue)] hover:bg-[var(--p-blue)] hover:text-white rounded-lg transition-colors"
                        title={vi("viewDocument", "View Document")}
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveDocument}
                        className="p-2 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-colors"
                        title={vi("removeDocument", "Remove Document")}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <div className="space-y-2">
                    <p className="text-gray-600">
                      {vi("uploadSupportingDocuments", "Upload supporting documents for this invoice")}
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
              )}
            </div>
          </div>

        {/* Invoice summary — same panel as customer invoice / credit note */}
          <div className="mb-6 max-w-md">
            <InvoiceSummaryPanel
              currency={invoiceData.currency || baseCurrency || "MYR"}
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
                    subtotal -
                    disc +
                    v +
                    (parseFloat(prev.adjustment) || 0);
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
                  {vi("processing", "Processing...")}
                </>
              ) : (
                vi("createInvoice", "Create Invoice")
              )}
            </button>
          </div>
        </>
      )}

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

export default CreateVendorInvoice;
