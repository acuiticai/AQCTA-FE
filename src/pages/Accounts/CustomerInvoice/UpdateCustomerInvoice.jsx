import { useTranslation } from "react-i18next";
import { customerInvoiceText as ciText } from "@/utils/customerInvoiceI18n";
import React, { useState, useEffect, useRef, useContext, useMemo } from "react";
import {
  ChevronDown,
  Calendar,
  X,
  Plus,
  ArrowLeft,
  Eye,
  FileText,
  Building2,
  User,
  UserPlus,
  Save,
  Send,
  Info,
  AlertCircle,
} from "lucide-react";
import axios from "axios";
import { useHistory, useParams, useLocation } from "react-router-dom";
import { notifyError, notifySuccess } from "@/utils/toast";
import ZohoStyleItemTable from "@/components/invoice/ZohoStyleItemTable";
import InvoiceSummaryPanel from "@/components/invoice/InvoiceSummaryPanel";
import { AdminContext } from "@/context/AdminContext";
import DocumentTemplateModal from "@/pages/SalesContract/actions/DocumentTemplates";
import DocumentGenerator from "./DocumentGenerator";
import DocumentViewer from "./document-viewer";
import CustomDatePicker from "@/components/CustomDatePicker";
import { PageHeader } from "@/page-layouts/index";
import { formatAmount, formatCurrencyAmount } from "@/components/formatAmount";
import SearchableDropdown from "@/components/SearchableDropdown";
import DropdownBasic from "@/page-layouts/components/DropdownBasic";
import { isSingleAssignedBusiness } from "@/utils/sessionAssignedBusinesses";
import AddressModal from "@/components/AddressModal";
import CustomerBillShipAddressFields from "@/components/CustomerBillShipAddressFields";
import BulkAddItemsModal from "@/components/customer-invoices/BulkAddItemsModal";
import QuickAddCustomerModal from "@/components/customer-invoices/QuickAddCustomerModal";
import AddPaymentTermButton from "@/components/AddPaymentTermButton";
import {
  calculateDueDate,
  getPaymentTermFromDueDate,
} from "@/utils/calculateDueDate";
import {
  getItemTotal,
  sumLineTaxAmountsFromItems,
  getLineSubtotal,
  getLineTaxAmount,
} from "@/utils/itemDiscountUtils";
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
  getMissingBillShipTypesForCustomer,
  missingBillShipSectionTitle,
} from "@/utils/addressTypeUtils";

const UpdateCustomerInvoice = () => {
  useTranslation();
  const { id } = useParams();
  const history = useHistory();
  const location = useLocation();
  const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

  // Check if redirected from payment attempt
  const fromPaymentRedirect = location.state?.fromPayment || false;
  const paymentRedirectMessage =
    location.state?.message ||
    "Please Save and Send the invoice before recording payment.";
  const [isLoading, setIsLoading] = useState(false);
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo.token}`,
  };
  const [businessData, setBusinessData] = useState(null);
  // Business base currency; used as fallback when customer currency is missing.
  const [baseCurrency, setBaseCurrency] = useState("MYR");
  const [businesses, setBusinesses] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState();
  const [selectedContract, setSelectedContract] = useState();
  const [salesContracts, setSalesContracts] = useState([]);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [expenseAccounts, setExpenseAccounts] = useState([]);
  const [businessItems, setBusinessItems] = useState([]);
  const [taxes, setTaxes] = useState([]);
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
  const [profileSignature, setProfileSignature] = useState("");
  const [canCreateProforma, setCanCreateProforma] = useState(true);
  const [canCreateCommercial, setCanCreateCommercial] = useState(false);
  const [accountTypeName, setAccountTypeName] = useState("");
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [addressModalType, setAddressModalType] = useState("Billing"); // "Billing" or "Shipping"
  const [addressTypeConfig, setAddressTypeConfig] = useState({
    billingLabel: "Billing",
    shippingLabel: "Shipping",
  });
  const [sameAsBilling, setSameAsBilling] = useState(false);
  const lastDistinctShippingAddressRef = useRef(""); // Preserve shipping when "same as billing" is checked
  const [editingAddress, setEditingAddress] = useState(null);
  const [originalInvoiceStatus, setOriginalInvoiceStatus] = useState(null); // Store original invoice status
  const [showBulkAddItemsModal, setShowBulkAddItemsModal] = useState(false);
  const [showQuickAddCustomer, setShowQuickAddCustomer] = useState(false);
  const [addTermsModalOpen, setAddTermsModalOpen] = useState(false);
  const [newTermName, setNewTermName] = useState("");
  const [newTermContent, setNewTermContent] = useState("");
  const [savingNewTerm, setSavingNewTerm] = useState(false);
  const normalizeSignatureUrl = (value) => {
    if (!value || typeof value !== "string") return "";
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (trimmed.startsWith("//")) return `https:${trimmed}`;
    const base = (Base_URL || "").replace(/\/$/, "");
    const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    return `${base}${path}`;
  };
  const normalizeSameAsBilling = (value) => {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value === 1;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      return (
        normalized === "true" || normalized === "1" || normalized === "yes"
      );
    }
    return null;
  };
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
  console.log("invoiceData update", invoiceData);

  const [formErrors, setFormErrors] = useState({});
  const [invoiceCustomFieldValues, setInvoiceCustomFieldValues] = useState({});
  const [lineItemCustomFieldDefs, setLineItemCustomFieldDefs] = useState([]);
  const [invoiceCustomFieldDefinitions, setInvoiceCustomFieldDefinitions] =
    useState([]);

  // Add contractDetails state for template generation
  const [contractDetails, setContractDetails] = useState({
    totalAmount: 0,
    remainingAmount: 0,
    advancePayments: [],
    allProformaInvoices: [],
  });

  // Add flag to prevent automatic recalculation in edit mode
  const [isEditMode, setIsEditMode] = useState(true);
  const [originalTotals, setOriginalTotals] = useState({
    subtotal: 0,
    total: 0,
    discountAmount: 0,
  });

  useEffect(() => {
    const loadAddressTypes = async () => {
      const businessId = invoiceData.business || businessData?._id;
      const config = await fetchAddressTypeConfig(businessId, headers);
      setAddressTypeConfig(config);
    };
    loadAddressTypes();
  }, [invoiceData.business, businessData?._id]);

  // Baseline snapshot for "invoice data changed" detection (template/PDF UI)
  const invoiceDataBaselineRef = useRef(null);
  const hasSetInitialBaselineRef = useRef(false);

  // Snapshot of invoice data for change detection (items + totals only)
  const snapshotInvoiceData = (data) => {
    if (!data?.items)
      return {
        items: [],
        subtotal: 0,
        total: 0,
        discountAmount: 0,
        termsAndConditions: "",
      };
    return {
      items: (data.items || []).map((item) => ({
        quantity: Number(item.quantity) || 0,
        unitPrice: Number(item.unitPrice) || 0,
        discount: Number(item.discount) || 0,
        total: Number(item.total) || 0,
        lineCf: JSON.stringify(item.lineItemCustomFields ?? {}),
      })),
      subtotal: Number(data.subtotal) || 0,
      total: Number(data.total) || 0,
      discountAmount: Number(data.discountAmount) || 0,
      termsAndConditions: (data.termsAndConditions || "").trim(),
    };
  };

  const isInvoiceDataEqual = (a, b) => {
    if (!a || !b) return !a && !b;
    if (a.items?.length !== b.items?.length) return false;
    if (Math.abs((a.subtotal || 0) - (b.subtotal || 0)) > 0.005) return false;
    if (Math.abs((a.total || 0) - (b.total || 0)) > 0.005) return false;
    if (Math.abs((a.discountAmount || 0) - (b.discountAmount || 0)) > 0.005)
      return false;
    if ((a.termsAndConditions || "") !== (b.termsAndConditions || ""))
      return false;
    for (let i = 0; i < (a.items?.length || 0); i++) {
      const ai = a.items[i];
      const bi = b.items[i];
      if (!bi) return true;
      if (Math.abs((ai?.quantity || 0) - (bi?.quantity || 0)) > 0.005)
        return false;
      if (Math.abs((ai?.unitPrice || 0) - (bi?.unitPrice || 0)) > 0.005)
        return false;
      if (Math.abs((ai?.discount || 0) - (bi?.discount || 0)) > 0.005)
        return false;
      if (Math.abs((ai?.total || 0) - (bi?.total || 0)) > 0.005) return false;
      if ((ai?.lineCf || "{}") !== (bi?.lineCf || "{}")) return false;
    }
    return true;
  };

  const validateForm = () => {
    const errors = {};
    if (!invoiceData.business)
      errors.business = ciText("Business is required.");
    if (!selectedCustomer) errors.customer = ciText("Customer is required.");
    if (!invoiceNumber)
      errors.invoiceNumber = ciText("Invoice number is required.");
    if (!invoiceData.terms)
      errors.terms = ciText("Payment Terms is required.");
    if (!invoiceData.items || invoiceData.items.length === 0)
      errors.items = ciText("At least one item is required.");
    if (invoiceData.items.some((item) => !item.quantity || !item.unitPrice))
      errors.items = ciText(
        "Each item must have quantity and unit price > 0.",
      );
    if (invoiceData.discountPercentage > 100)
      errors.discountPercentage = ciText("Discount cannot exceed 100%.");

    // Due Date must not be earlier than Invoice Date
    if (invoiceData.invoiceDate && invoiceData.dueDate) {
      const inv = new Date(invoiceData.invoiceDate);
      const due = new Date(invoiceData.dueDate);
      const invDay = new Date(inv.getFullYear(), inv.getMonth(), inv.getDate());
      const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
      if (
        !isNaN(invDay.getTime()) &&
        !isNaN(dueDay.getTime()) &&
        dueDay < invDay
      ) {
        errors.dueDate = ciText(
          "Due Date cannot be earlier than Invoice Date.",
        );
      }
    }

    return errors;
  };

  // Format date for input fields
  function formatDateForInput(date) {
    if (!date) return "";

    // Check if date is a Date object or a string
    const d = date instanceof Date ? date : new Date(date);

    if (isNaN(d.getTime())) return ""; // Return empty string if invalid date

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  useEffect(() => {
    // Fetch the invoice data when component mounts
    const fetchInvoiceData = async () => {
      try {
        const response = await axios.get(`${Base_URL}/proforma-invoice/${id}`, {
          headers,
        });
        console.log("update invoice", response.data);

        const invoice = response.data;

        // Store original invoice status
        setOriginalInvoiceStatus(invoice.status || "draft");

        // Set invoice number
        setInvoiceNumber(invoice.invoice_number);

        // Set selected template ID if available
        if (invoice.templateId) {
          setSelectedTemplateId(invoice.templateId);
          // setSelectedTemplate(invoice.templateId);
        }

        console.log("populate form data", invoice);
        console.log("subtotal update", invoice.subTotal);
        console.log("total update", invoice.grandTotal);

        // Extract fax number from customer addresses (similar to handleChangeCustomer logic)
        const customerData = invoice.customer_id;
        const addresses = customerData?.addresses || [];
        const billingAddressObj = addresses.find(
          (addr) => addr.addressType === "Billing",
        );
        const shippingAddressObj =
          addresses.find((addr) => addr.addressType === "Shipping") ||
          addresses.find(
            (addr) => !addr.addressType || addr.addressType === "",
          );

        const faxNumber =
          invoice?.faxNumber ||
          billingAddressObj?.fax ||
          shippingAddressObj?.fax ||
          customerData?.companyInfo?.contact?.fax ||
          customerData?.companyInfo?.fax ||
          "";

        // Populate form data
        const loadedItems = (invoice.items || []).map((item) => {
          // Calculate total if not present
          const quantity = item.quantity || 0;
          const unitPrice = item.unitPrice || 0;
          const discount = item.discount || 0; // percentage
          const taxRate = item.taxRate || 0;
          const total =
            item.totalValue ||
            item.total ||
            getItemTotal(quantity, unitPrice, discount, taxRate);

          return {
            ...item,
            quantity,
            unitPrice,
            discount,
            taxRate, // Preserve tax rate
            taxId: item.taxId || "", // Preserve tax ID
            taxName: item.taxName || "", // Preserve tax name
            total: Math.max(0, total), // Ensure total is not negative
            // Extract expenseAccount ID if it's an object (populated from DB)
            expenseAccount:
              typeof item.expenseAccount === "object" &&
              item.expenseAccount?._id
                ? item.expenseAccount._id
                : item.expenseAccount || null,
            // Item name (from product) and description (additional) - show both on invoice
            itemName:
              item.itemName || item.item || item.name || item.title || "",
            description: item.description || "",
            item:
              item.item ||
              item.name ||
              item.title ||
              item.itemName ||
              item.description ||
              "",
            lineItemCustomFields:
              item.lineItemCustomFields &&
              typeof item.lineItemCustomFields === "object"
                ? { ...item.lineItemCustomFields }
                : {},
          };
        });
        const loadedTaxTotal = sumLineTaxAmountsFromItems(loadedItems);

        setInvoiceData({
          business: invoice.business_id?._id || "",
          customer: invoice.customer_id?._id || "",
          invoiceNumber: invoice.invoice_number || "",
          salesContractNumber: invoice.contract_no || "",
          orderNumber: invoice.orderNumber || "",
          invoiceType: invoice.invoiceType || "Commercial",
          invoiceDate: formatDateForInput(new Date(invoice.invoice_date)),
          dueDate: formatDateForInput(new Date(invoice.due_date)),
          terms: invoice.terms || "",
          customTerms: invoice.customTerms || "",
          billingAddress: invoice.billingAddress || "",
          shippingAddress: invoice.shippingAddress || "",
          phoneNumber:
            invoice?.customer_id?.basicInformation?.customerPhone?.mobile ||
            invoice?.phoneNumber,
          faxNumber: faxNumber,
          items: loadedItems,
          subtotal: invoice.subTotal || 0,
          discountPercentage: invoice.discount || 0,
          discountAmount: invoice.discountAmount || 0,
          shippingCharges: invoice.shippingCharges || 0,
          adjustment: invoice.adjustment || 0,
          taxTotal: loadedTaxTotal,
          total: invoice.grandTotal || 0,
          currency: invoice.currency || "",
          supportingDocuments:
            invoice.supportingDocuments || invoice.supportingDocument
              ? [invoice.supportingDocument]
              : [],
          template: "Selected Template Name", // This will be updated when templates are fetched
          module: "customer-invoices",
          bankAccount: invoice.bankAccount || "",
          advanceDepositAmount: invoice.advanceDepositAmount || 0,
          salesContractTotal: invoice.salesContractTotal || 0,
          expenseAccount: invoice.expenseAccount || "",
          customerNotes:
            invoice.customerNotes ||
            invoice.notes ||
            invoice.customer_notes ||
            "",
          termsAndConditions:
            invoice.termsAndConditions ||
            invoice.terms_and_conditions ||
            invoice.termsCondition ||
            "",
          documentUrl: invoice.documentUrl || "", // Include documentUrl in invoiceData
        });

        const normalizedSameAsBilling = normalizeSameAsBilling(
          invoice.sameAsBilling,
        );
        if (normalizedSameAsBilling !== null) {
          setSameAsBilling(normalizedSameAsBilling);
        } else {
          setSameAsBilling(
            !!invoice?.billingAddress &&
              !!invoice?.shippingAddress &&
              invoice.billingAddress.trim() === invoice.shippingAddress.trim(),
          );
        }

        // Store original totals to prevent recalculation
        setOriginalTotals({
          subtotal: invoice.subTotal || 0,
          total: invoice.grandTotal || 0,
          discountAmount: invoice.discountAmount || 0,
        });

        console.log("Loaded invoice data:", {
          subtotal: invoice.subTotal,
          total: invoice.grandTotal,
          items: invoice.items,
          discountAmount: invoice.discountAmount,
        });

        console.log("Original totals stored:", {
          subtotal: invoice.subTotal || 0,
          total: invoice.grandTotal || 0,
          discountAmount: invoice.discountAmount || 0,
        });

        // Set document data if available
        if (invoice.documentUrl) {
          console.log(
            "Setting DocumentData from invoice:",
            invoice.documentUrl,
          );
          setDocumentData({
            s3Key: invoice.documentUrl,
            url: invoice.documentUrl, // Also set url as fallback
            _id: invoice._id, // Store invoice ID for reference
          });
        } else {
          console.log("No documentUrl found in invoice");
          setDocumentData({}); // Reset if no document
        }

        // Fetch additional data about the customer and contract
        if (invoice.customer_id) {
          // Pass the ID, not the object
          const customerId =
            typeof invoice.customer_id === "object"
              ? invoice.customer_id._id
              : invoice.customer_id;
          handleChangeCustomer(customerId, { preserveAddressState: true });
        }
        if (invoice?.customer_id) {
          setSelectedCustomer(invoice.customer_id);
        }

        if (invoice.contract_id) {
          const contract = invoice.contract_id;
          setSelectedContract(contract);
          setSelectedContractId(contract?._id);

          // Get account type
          if (contract?.Account_Info?.accountType) {
            const accountTypeRes = await axios.get(
              `${Base_URL}/bank-account-types/${contract.Account_Info.accountType}`,
            );
            setAccountTypeName(accountTypeRes.data?.name || "");
          }

          // Fetch contract details for template generation only
          await fetchContractDetails(contract._id);
        }

        setIsDataLoaded(true);
      } catch (error) {
        console.error("Error fetching invoice data:", error);
        notifyError(ciText("Failed to load invoice data"));
      }
    };

    fetchInvoiceData();
  }, [id, Base_URL]);

  useEffect(() => {
    // Load admin info from localStorage
    const storedAdminInfo = localStorage.getItem("adminInfo");
    if (storedAdminInfo) {
      try {
        const parsedAdminInfo = JSON.parse(storedAdminInfo);
        // setAdminInfo(parsedAdminInfo);
      } catch (error) {
        console.error("Error parsing admin info from localStorage:", error);
      }
    }

    const fetchBusinesses = async () => {
      try {
        // Try to get from localStorage first
        const storedBusinesses = localStorage.getItem("businesses");
        if (storedBusinesses) {
          const parsedData = JSON.parse(storedBusinesses);
          setBusinesses(parsedData);
        }
      } catch (error) {
        console.error("Failed to fetch businesses:", error);
        notifyError(ciText("Failed to load businesses"));
      }
    };

    fetchBusinesses();

    // Fetch business data if needed
    const fetchBusinessData = async () => {
      try {
        if (invoiceData.business) {
          const response = await axios.get(
            `${Base_URL}/business/${invoiceData.business}`,
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
      } catch (error) {
        console.error("Error fetching business data:", error);
      }
    };

    fetchBusinessData();

    const fetchSalesContracts = async () => {
      try {
        const response = await axios.get(`${Base_URL}/sales-contracts`);
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

    const fetchPaymentTerms = async () => {
      if (!invoiceData?.business) {
        setPaymentTerms([]);
        return;
      }
      try {
        const res = await axios.post(
          `${Base_URL}/items/Payment Terms/get_all`,
          {
            business_id: invoiceData.business,
            FilterStatus: "active",
            FilterName: "",
          },
          { headers },
        );
        setPaymentTerms(res.data?.success ? res.data.data || [] : []);
      } catch (err) {
        console.error("Error fetching payment terms:", err);
        setPaymentTerms([]);
      }
    };

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

    fetchPaymentTerms();
    fetchTermsAndConditions();
    fetchSalesContracts();
    fetchExpenseAccounts();
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

  // Auto-calculate due date when payment term or invoice date changes; skip when terms is Custom/Manual
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
      setInvoiceData((prev) => ({ ...prev, dueDate: calculatedDueDate }));
    }
  }, [invoiceData.terms, invoiceData.invoiceDate, paymentTerms]);

  // Set baseline snapshot once when invoice is first loaded (for "data changed" detection)
  useEffect(() => {
    if (!isDataLoaded || hasSetInitialBaselineRef.current) return;
    if (
      !invoiceData?.items?.length &&
      !invoiceData?.subtotal &&
      !invoiceData?.total
    )
      return;
    hasSetInitialBaselineRef.current = true;
    invoiceDataBaselineRef.current = snapshotInvoiceData(invoiceData);
  }, [isDataLoaded, invoiceData]);

  const hasInvoiceDataChanged = (() => {
    if (!invoiceDataBaselineRef.current) return false;
    return !isInvoiceDataEqual(
      snapshotInvoiceData(invoiceData),
      invoiceDataBaselineRef.current,
    );
  })();

  // When invoice data changes, clear stored PDF so user must pick template again (like Create); don't show old PDF.
  useEffect(() => {
    if (!hasSetInitialBaselineRef.current || !invoiceDataBaselineRef.current)
      return;
    const currentSnapshot = snapshotInvoiceData(invoiceData);
    if (!isInvoiceDataEqual(currentSnapshot, invoiceDataBaselineRef.current)) {
      setDocumentData({});
    }
  }, [
    invoiceData?.items,
    invoiceData?.subtotal,
    invoiceData?.total,
    invoiceData?.discountAmount,
    invoiceData?.termsAndConditions,
  ]);

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
        // Signature is optional in template previews.
      }
    };
    fetchProfileSignature();
  }, [Base_URL, adminInfo?.id, adminInfo?.token]);

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

  useEffect(() => {
    const fetchCustomers = async () => {
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

  // Fetch base currency when business changes (fallback if customer doesn't have currency)
  useEffect(() => {
    if (invoiceData.business && !selectedCustomer) {
      const fetchCurrency = async () => {
        try {
          console.log("Fetching currency for business:", invoiceData.business);
          const currencyResponse = await axios.get(
            `${Base_URL}/finance/currencies`,
            {
              params: { business_id: invoiceData.business },
            },
          );
          console.log("Currency API response:", currencyResponse?.data);
          const currencies = currencyResponse?.data?.data || [];
          const base = currencies.find((c) => c.is_base === true);
          console.log("Base currency found:", base);
          if (base) {
            const currencySymbol =
              base.symbol || base.prefix || base.name || "MYR";
            console.log("Setting base currency to:", currencySymbol);
            setBaseCurrency(currencySymbol);
            // Only update invoice currency if customer is not selected yet
            setInvoiceData((prev) => ({
              ...prev,
              currency: prev.currency || currencySymbol,
            }));
          } else {
            console.warn("No base currency found, defaulting to MYR");
            setBaseCurrency("MYR");
          }
        } catch (currencyError) {
          console.error("Error fetching base currency:", currencyError);
          console.error(
            "Currency error details:",
            currencyError.response?.data,
          );
          setBaseCurrency("MYR");
        }
      };
      fetchCurrency();
    }
  }, [invoiceData.business, Base_URL, selectedCustomer]);

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

  useEffect(() => {
    const bid = invoiceData.business;
    if (!bid) {
      setInvoiceCustomFieldDefinitions([]);
      setLineItemCustomFieldDefs([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [lineDefs, docDefs] = await Promise.all([
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
          setInvoiceCustomFieldDefinitions(docDefs || []);
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

  // Load taxes (Accounts > Taxes) when business changes
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
        (it) => !it.isAdvancePayment && String(it.itemId) === String(itemId),
      );
      if (existingIndex >= 0) {
        const existing = merged[existingIndex];
        const existingQty = parseFloat(existing.quantity) || 1;
        const addQty = parseFloat(newItem.quantity) || 1;
        const newQty = existingQty + addQty;
        const unitPrice = parseFloat(existing.unitPrice) || 0;
        const discount = parseFloat(existing.discount) || 0;
        const taxRate = parseFloat(existing.taxRate) || 0;
        const lineSubtotal = newQty * unitPrice * (1 - discount / 100);
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

    notifySuccess(
      ciText("{{count}} item(s) added successfully", {
        count: newItems.length,
      }),
    );
  };

  // In edit mode, totals are recalculated from items when user adds/removes/edits line items (see ZohoStyleItemTable).
  // We no longer restore original totals so that delete/edit line items correctly updates invoice total.
  useEffect(() => {
    if (!isDataLoaded) return;

    setInvoiceData((prev) => {
      const prevItems = prev.items || [];
      if (prevItems.length === 0) return prev;

      let hasItemTotalChange = false;
      const normalizedItems = prevItems.map((item) => {
        if (item?.isAdvancePayment) return item;

        const quantity = parseFloat(item.quantity) || 0;
        const unitPrice = parseFloat(item.unitPrice) || 0;
        const discount = parseFloat(item.discount) || 0;
        const taxRate = parseFloat(item.taxRate) || 0;
        const computedTotal = getItemTotal(
          quantity,
          unitPrice,
          discount,
          taxRate,
        );
        const currentTotal = Number(item.total) || 0;

        if (Math.abs(currentTotal - computedTotal) > 0.005) {
          hasItemTotalChange = true;
          return { ...item, total: computedTotal };
        }
        return item;
      });

      const subtotal = normalizedItems.reduce(
        (sum, item) => sum + (Number(item.total) || 0),
        0,
      );
      const taxTotal = sumLineTaxAmountsFromItems(normalizedItems);
      const discountAmount =
        (subtotal * (parseFloat(prev.discountPercentage) || 0)) / 100;
      const total = Math.max(
        0,
        subtotal -
          discountAmount +
          (parseFloat(prev.shippingCharges) || 0) +
          (parseFloat(prev.adjustment) || 0),
      );

      const totalsChanged =
        Math.abs((Number(prev.subtotal) || 0) - subtotal) > 0.005 ||
        Math.abs((Number(prev.taxTotal) || 0) - taxTotal) > 0.005 ||
        Math.abs((Number(prev.discountAmount) || 0) - discountAmount) > 0.005 ||
        Math.abs((Number(prev.total) || 0) - total) > 0.005;

      if (!hasItemTotalChange && !totalsChanged) {
        return prev;
      }

      return {
        ...prev,
        items: normalizedItems,
        subtotal,
        taxTotal,
        discountAmount,
        total,
      };
    });
  }, [
    isDataLoaded,
    invoiceData.items,
    invoiceData.discountPercentage,
    invoiceData.shippingCharges,
    invoiceData.adjustment,
    setInvoiceData,
  ]);

  const handleChangeCustomer = async (
    customerId,
    { preserveAddressState = false } = {},
  ) => {
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
        phoneNumber:
          preserveAddressState && prev.phoneNumber
            ? prev.phoneNumber
            : phoneNumber,
        billingAddress:
          preserveAddressState && prev.billingAddress
            ? prev.billingAddress
            : billingAddress,
        shippingAddress:
          preserveAddressState && prev.shippingAddress
            ? prev.shippingAddress
            : shippingAddress,
        faxNumber:
          preserveAddressState && prev.faxNumber ? prev.faxNumber : faxNumber,
        currency: customerCurrency, // Set currency from customer
      }));

      // Keep `baseCurrency` as business fallback (do not overwrite it with customer currency).
    } catch (error) {
      console.log("Error fetching customer data:", error);
    }
  };

  const checkContractInvoiceStatus = async (contractId) => {
    try {
      const response = await axios.get(
        `${Base_URL}/proforma-invoice/check-contract-status/${contractId}`,
        { headers },
      );

      const { availableTypes, defaultType, proformaExists, commercialExists } =
        response.data.data;

      // Set invoice type availability
      setCanCreateProforma(availableTypes.proforma.available);
      setCanCreateCommercial(availableTypes.commercial.available);

      return { availableTypes, defaultType, proformaExists, commercialExists };
    } catch (error) {
      console.error("Error checking contract invoice status:", error);
      return null;
    }
  };

  const handleChangeContract = async (contractId) => {
    try {
      const response = await axios.get(
        `${Base_URL}/sales-contracts/${contractId}`,
      );
      const contract = response?.data;

      // Get account type
      if (contract?.Account_Info?.accountType) {
        const accountTypeRes = await axios.get(
          `${Base_URL}/bank-account-types/${contract.Account_Info.accountType}`,
        );
        setAccountTypeName(accountTypeRes.data?.name || "");
      }

      setSelectedContract(contract);
      setInvoiceData((prev) => ({
        ...prev,
        salesContractNumber: contract?.contractNo,
        bankAccount: contract?.Account_Info?.bankAccount || "",
      }));
      // Check contract invoice status
      await checkContractInvoiceStatus(contractId);
      // Fetch contract details for template generation only
      await fetchContractDetails(contractId);
    } catch (error) {
      console.error("Error fetching contract data:", error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    if (name === "discountPercentage" || name === "discountValue") {
      // Allow empty string for input field
      if (value === "") {
        setInvoiceData((prev) => ({
          ...prev,
          [name]: "",
          discountAmount: 0,
          discountPercentage:
            name === "discountPercentage" ? "" : prev.discountPercentage,
          discountValue: name === "discountValue" ? "" : prev.discountValue,
          total: prev.subtotal,
        }));
        return;
      }

      const valueNum = parseFloat(value) || 0;
      let discountAmount = 0;

      if (name === "discountPercentage") {
        // Clamp between 0 and 100
        const clampedValue = Math.max(0, Math.min(valueNum, 100));
        discountAmount = (invoiceData.subtotal * clampedValue) / 100;
        setInvoiceData((prev) => ({
          ...prev,
          discountPercentage: clampedValue,
          discountValue: clampedValue,
          discountAmount,
          total: Math.max(invoiceData.subtotal - discountAmount, 0),
        }));
      } else if (name === "discountValue") {
        if (invoiceData.discountType === "percentage") {
          const clampedValue = Math.max(0, Math.min(valueNum, 100));
          discountAmount = (invoiceData.subtotal * clampedValue) / 100;
          setInvoiceData((prev) => ({
            ...prev,
            discountPercentage: clampedValue,
            discountValue: clampedValue,
            discountAmount,
            total: Math.max(invoiceData.subtotal - discountAmount, 0),
          }));
        } else {
          // Amount-based discount
          discountAmount = Math.max(
            0,
            Math.min(valueNum, invoiceData.subtotal),
          );
          setInvoiceData((prev) => ({
            ...prev,
            discountAmount,
            discountValue: discountAmount,
            total: Math.max(invoiceData.subtotal - discountAmount, 0),
          }));
        }
      }
      return;
    }

    if (name === "discountType") {
      setInvoiceData((prev) => ({
        ...prev,
        discountType: value,
        discountValue: 0,
        discountPercentage: 0,
        discountAmount: 0,
        total: invoiceData.subtotal,
      }));
      return;
    } else {
      setInvoiceData((prev) => ({
        ...prev,
        [name]: value,
      }));
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

      const invoiceTemplates = assignments.filter((a) => {
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

      // Map to full template objects (templateId should have type property)
      // Ensure we're passing the full template objects, not just IDs
      const templateObjects = invoiceTemplates
        .map((item) => item.templateId)
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

      console.log("Setting templates:", uniqueTemplates);
      setTemplates(uniqueTemplates);

      // If we already have a selected template from the invoice data, use that
      if (selectedTemplateId && uniqueTemplates.length > 0) {
        const selectedTemplateData = uniqueTemplates.find(
          (t) => String(t._id || t.id) === String(selectedTemplateId),
        );
        if (selectedTemplateData) {
          setSelectedTemplate(selectedTemplateData);
          setTempSelectedTemplate(selectedTemplateId);

          // Find the template name from businessTemplates
          const businessTemplate = invoiceTemplates.find(
            (bt) => bt.templateId?._id === selectedTemplateId,
          );
          const templateName =
            businessTemplate?.name ||
            selectedTemplateData?.name ||
            "Selected Template";

          // Update invoice data with template name
          setInvoiceData((prev) => ({
            ...prev,
            template: templateName,
          }));
        }
      }
      // Otherwise set the first template as default
      else if (uniqueTemplates.length > 0 && uniqueTemplates[0]) {
        const firstTemplate = uniqueTemplates[0];
        const templateId = firstTemplate?._id || firstTemplate?.id;

        setSelectedTemplate(firstTemplate);
        // Only set selectedTemplateId if it's not already set (preserve existing selection)
        if (!selectedTemplateId) {
          setSelectedTemplateId(templateId);
        }
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

  const stripHtml = (html) => {
    if (!html) return "";
    const doc = new DOMParser().parseFromString(html, "text/html");
    return doc.body.textContent || "";
  };

  const handleSubmit = async (status) => {
    const errors = validateForm();
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    // ✅ PDF TEMPLATE VALIDATION: Require PDF only when template changed. If invoice already has document, allow.
    const hasDocument =
      DocumentData?.s3Key ||
      DocumentData?.url ||
      DocumentData?._id ||
      invoiceData?.documentUrl;
    // PDF optional for ciText("Save & Send") - generated at runtime on email preview when "Attach invoice PDF" is checked

    setIsLoading(true);

    // console.log("document data", DocumentData)
    // return
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
          const lineSubtotal = getLineSubtotal(
            quantity || 1,
            unitPrice,
            discountPct,
          );
          const explicitTax = Number(item.tax);
          const taxAmount =
            Number.isFinite(explicitTax) && explicitTax >= 0
              ? explicitTax
              : getLineTaxAmount(lineSubtotal, taxRatePct);

          return {
            title: item.title || item.itemName || item.item || item.name || "",
            description: item.description || "",
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalValue: item.total || item.totalValue,
            discount: item.discount || 0, // Include item-level discount
            isAdvancePayment: item.isAdvancePayment || false,
            expenseAccount: expenseAccountId || undefined, // Use item-level expense account only
            itemId: item.itemId || undefined,
            taxId: item.taxId || undefined,
            taxRate: item.taxRate || 0,
            tax: taxAmount,
            taxName: item.taxName || undefined,
            unit: item.unit || undefined,
            itemType: item.itemType || undefined,
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
        documentUrl: DocumentData?.s3Key,
        shippingCharges: Number.parseFloat(invoiceData?.shippingCharges),
        adjustment: Number.parseFloat(invoiceData?.adjustment),
        grandTotal: invoiceData?.total,
        // When ciText("Save & Send") is clicked (status === "generated"), change Draft to Pending
        // When "Save" is clicked (status === "draft"), preserve pending/sent/send-email, else Draft
        status:
          status === "generated" &&
          originalInvoiceStatus?.toLowerCase() === "draft"
            ? "pending"
            : status === "draft" &&
                !["pending", "sent", "send-email", "request sent"].includes(
                  originalInvoiceStatus?.toLowerCase(),
                )
              ? "draft"
              : originalInvoiceStatus || "pending",
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
        location: "customer-invoices",
        isAdvancePayment: false,
        advanceAmount: 0,
        deposit: invoiceData.deposit,
        depositAmount: invoiceData.depositAmount,
        contractTotal: invoiceData.contractTotal,
        remainingAmount: invoiceData.remainingAmount,
        bankAccount: invoiceData.bankAccount,
        currency: invoiceData?.currency || baseCurrency || "MYR",
        advanceDepositAmount: invoiceData.advanceDepositAmount || 0,
        salesContractTotal: invoiceData.salesContractTotal || 0,
      };

      if (invoiceData.business) {
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
      }

      // For update, use PUT request
      if (status === "draft") {
        const response = await axios.put(
          `${Base_URL}/proforma-invoice/${id}`,
          invoiceDataToSend,
          { headers },
        );

        const updateSucceeded =
          response.status >= 200 &&
          response.status < 300 &&
          response.data &&
          (response.data.status === true ||
            response.data.success === true ||
            response.data.data != null);

        if (updateSucceeded) {
          if (id && invoiceData.business) {
            try {
              await upsertValues(
                {
                  business_id: invoiceData.business,
                  module: "sales",
                  screen: "invoice",
                  record_id: String(id),
                  values: invoiceCustomFieldValues,
                },
                headers,
              );
            } catch (cfErr) {
              notifyError(
                cfErr?.response?.data?.message ||
                  "Invoice updated, but custom fields could not be saved.",
              );
              return;
            }
          }
          notifySuccess(ciText("Invoice updated successfully!"));
          history.push("/customer-invoices");
        } else {
          // Handle case where backend returns success but status is false
          const errorMessage =
            response.data?.message || ciText("Failed to update invoice");
          notifyError(errorMessage);
        }
      } else if (status === "generated") {
        history.push({
          pathname: "/email-preview",
          state: {
            invoiceData: invoiceDataToSend,
            isUpdate: true,
            invoiceId: id,
            templateData: selectedTemplate,
            businessData,
            selectedCustomer,
            adminInfo,
            invoiceCustomFieldDefinitions,
            invoiceCustomFieldValues,
            lineItemCustomFieldDefinitions: lineItemCustomFieldDefs,
          },
        });
      }
    } catch (error) {
      console.error("Error updating invoice:", error);

      // Extract error message from response if available
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to update invoice. Please try again.";

      notifyError(errorMessage);
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

  const openTemplatePreview = (templateId) => {
    const template = templates.find((t) => t._id === templateId);
    if (template) {
      setPreviewTemplate(template);
    }
  };

  const closeTemplatePreview = () => {
    setPreviewTemplate(null);
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
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
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
            <iframe
              srcDoc={sanitizeTemplateContent(
                previewTemplate.htmlContent || "",
              )}
              title={`${previewTemplate.name} Preview`}
              className="w-full h-full border-0 min-h-[70vh]"
              sandbox="allow-same-origin"
            />
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
                handleTempTemplateSelect(previewTemplate._id);
                closeTemplatePreview();
              }}
              className="px-4 py-2 bg-[var(--p-blue)] text-white rounded-md"
            >
              {ciText("Select This Template")}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const handleGenerateDocument = async ({ templateId, template }) => {
    let templateToUse = template || templates.find((t) => t._id === templateId);
    if (!templateToUse) {
      notifyError(ciText("Template not found. Please select a template."));
      return;
    }
    if (!templateToUse.htmlContent && templateId) {
      try {
        const templateResponse = await axios.get(
          `${Base_URL}/document-templates/${templateId}`,
          { headers },
        );
        if (templateResponse.data?.data?.htmlContent) {
          templateToUse = { ...templateToUse, ...templateResponse.data.data };
        }
      } catch (error) {
        notifyError(ciText("Failed to load template details"));
        return;
      }
    }
    setSelectedTemplate(templateToUse);
    setSelectedTemplateId(templateId);
    setInvoiceData((prev) => ({
      ...prev,
      template: templateToUse?.name || prev.template,
    }));
    setIsModalOpen(false);
    // Do not open DocumentGenerator - PDF generated at runtime on email preview when "Attach invoice PDF" is checked
  };

  const handleGenerationSuccess = (data) => {
    console.log("Document generated successfully!", data);
    setIsGeneratorOpen(false);
    const fileData = data.file || data;
    setDocumentData({
      ...fileData,
      s3Key: fileData.s3Key || fileData.url || fileData._id,
      url: fileData.url || fileData.s3Key,
    });
    // Update baseline so UI shows "View Selected Template" until user edits again
    invoiceDataBaselineRef.current = snapshotInvoiceData(invoiceData);
    notifySuccess(
      "PDF template selected successfully! You can now save or send the invoice.",
    );
  };

  // Add fetchContractDetails function for template generation only
  const fetchContractDetails = async (contractId) => {
    try {
      const response = await axios.get(
        `${Base_URL}/sales-contracts/${contractId}`,
      );
      const contract = response.data;

      // Fetch existing proforma invoices for this contract
      const proformaResponse = await axios.get(
        `${Base_URL}/proforma-invoice/get_by_contract/${contractId}`,
      );
      const allProformaInvoices = proformaResponse.data.data || [];

      // Build contract items from productInfo
      const contractItems = (contract.productInfo || []).map(
        (product, idx) => ({
          id: idx + 1,
          quantity: product.quantityMTS || 0,
          description: product.title || "",
          unitPrice: product.price || 0,
          discount: 0,
          total: (product.quantityMTS || 0) * (product.price || 0),
        }),
      );
      const contractTotal = contractItems.reduce(
        (sum, item) => sum + (item.total || 0),
        0,
      );
      const depositPercentage = contract.productInfo[0]?.deposit || 0;
      const depositAmount = (contractTotal * depositPercentage) / 100;

      // Handle different invoice types based on SOPs
      let finalTotal = contractTotal;

      // For Commercial Invoice: calculate remaining amount after proforma payments
      if (invoiceData.invoiceType === "Commercial") {
        const advancePayments = allProformaInvoices.filter(
          (inv) =>
            inv.invoiceType === "Proforma" &&
            (inv.status === "generated" || inv.status === "draft"),
        );

        if (advancePayments.length > 0) {
          // Calculate total amount paid in proforma invoices
          const totalAdvancePayments = advancePayments.reduce((sum, inv) => {
            return sum + (inv.grandTotal || 0);
          }, 0);

          finalTotal = contractTotal - totalAdvancePayments;
        }
      }

      // Set contract details for template generation only
      // DO NOT override invoice data
      setContractDetails({
        totalAmount: contractTotal,
        depositPercentage,
        depositAmount,
        advancePayments: allProformaInvoices,
        remainingAmount: finalTotal,
      });
    } catch (error) {
      console.error("Error fetching contract details:", error);
      notifyError(ciText("Failed to load contract details"));
    }
  };

  console.log("invoice data", invoiceData);
  console.log("isDataLoaded", isDataLoaded);

  // Show loading indicator while the data is being fetched
  if (!isDataLoaded) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--p-blue)]"></div>
      </div>
    );
  }

  const canSave =
    invoiceData.business && selectedCustomer && invoiceData.items?.length > 0;
  const hasDocument =
    DocumentData?.s3Key ||
    DocumentData?.url ||
    DocumentData?._id ||
    invoiceData?.documentUrl;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main Content - Two Column Layout */}
      <div className=" mx-auto  py-4 px-4">
        <div className="grid grid-cols-1 gap-6">
          {/* Left Column - Main Form */}
          <div className="space-y-6 px-4">
            <PageHeader
              title={ciText("Edit Invoice")}
              showBackButton
              backFallbackPath="/customer-invoices"
            />
            {/* Business & Invoice Info Card */}
            <div className="bg-white rounded-lg  shadow-sm ">
              <div className="p-6 bg-green-50 space-y-6 rounded-b-lg">
                {/* Business and Customer Selection - Side by Side */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Business Selection */}
                  {!isSingleAssignedBusiness() && (
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
                        isDisabled={true}
                        isClearable={false}
                      />
                    </div>
                    {formErrors.business && (
                      <p className="mt-1 text-xs text-red-500">
                        {formErrors.business}
                      </p>
                    )}
                  </div>
                  )}

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
                          options={
                            customers?.map((customer) => ({
                              value: customer._id,
                              label: customer.basicInformation.companyName,
                              name: customer.basicInformation.companyName,
                              displayName:
                                customer.basicInformation.customerDisplayName,
                              email: customer.basicInformation.customerEmail,
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
                        disabled={!invoiceData.business}
                        title={
                          !invoiceData.business
                            ? "Select a business first"
                            : "Quick add a new customer"
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

                {/* Billing & Shipping Address: match create screen behavior */}
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

                {/* Invoice Number, Order Number, Currency */}
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
                          ? "Customer currency"
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
                        const updated = { ...invoiceData, invoiceDate: date };
                        if (updated.terms) {
                          const term = paymentTerms.find(
                            (t) => t.name === updated.terms,
                          );
                          const calc = calculateDueDate(
                            term || updated.terms,
                            date,
                          );
                          if (calc) updated.dueDate = calc;
                        } else if (updated.dueDate) {
                          const invDay = new Date(
                            new Date(date).setHours(0, 0, 0, 0),
                          );
                          const dueDay = new Date(
                            new Date(updated.dueDate).setHours(0, 0, 0, 0),
                          );
                          if (dueDay < invDay) updated.dueDate = date;
                        }
                        setInvoiceData(updated);
                        setFormErrors((prev) => ({
                          ...prev,
                          dueDate: undefined,
                        }));
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
                      {ciText("Payment Terms")} <span className="text-red-500">*</span>
                    </label>
                    <div className="bg-white rounded-lg">
                      <SearchableDropdown
                        value={invoiceData.terms}
                        onChange={(e) => {
                          const selectedTermName = e.target.value;
                          const updated = {
                            ...invoiceData,
                            terms: selectedTermName,
                          };
                          if (selectedTermName && updated.invoiceDate) {
                            const term = paymentTerms.find(
                              (t) => t.name === selectedTermName,
                            );
                            const calc = calculateDueDate(
                              term || selectedTermName,
                              updated.invoiceDate,
                            );
                            if (calc) updated.dueDate = calc;
                          }
                          setInvoiceData(updated);
                          setFormErrors((prev) => ({
                            ...prev,
                            dueDate: undefined,
                          }));
                        }}
                        placeholder={ciText("Select Payment Term")}
                        searchPlaceholder={ciText("Search payment terms...")}
                        disabled={!invoiceData.business}
                        options={(() => {
                          const list =
                            paymentTerms?.map((term) => ({
                              value: term.name,
                              label: term.name,
                              name: term.name,
                            })) || [];
                          const currentTerm = invoiceData.terms?.trim();
                          if (
                            currentTerm &&
                            !list.some((o) => o.value === currentTerm)
                          ) {
                            list.push({
                              value: currentTerm,
                              label: currentTerm,
                              name: currentTerm,
                            });
                          }
                          return list.filter(
                            (t, i, a) =>
                              a.findIndex((x) => x.value === t.value) === i,
                          );
                        })()}
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
                              const updated = {
                                ...invoiceData,
                                terms: newTerm.name,
                              };
                              if (invoiceData.invoiceDate) {
                                const calc = calculateDueDate(
                                  newTerm,
                                  invoiceData.invoiceDate,
                                );
                                if (calc) updated.dueDate = calc;
                              }
                              setInvoiceData(updated);
                              setFormErrors((prev) => ({
                                ...prev,
                                dueDate: undefined,
                              }));
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
                        const updated = {
                          ...invoiceData,
                          dueDate: date,
                          terms: resolvedTerm,
                        };
                        setInvoiceData(updated);
                        const inv = new Date(updated.invoiceDate);
                        const due = date ? new Date(date) : null;
                        const invDay = new Date(
                          inv.getFullYear(),
                          inv.getMonth(),
                          inv.getDate(),
                        );
                        const dueDay = due
                          ? new Date(
                              due.getFullYear(),
                              due.getMonth(),
                              due.getDate(),
                            )
                          : null;
                        const isInvalid =
                          dueDay &&
                          !isNaN(invDay.getTime()) &&
                          !isNaN(dueDay.getTime()) &&
                          dueDay < invDay;
                        setFormErrors((prev) => ({
                          ...prev,
                          dueDate: isInvalid
                            ? "Due Date cannot be earlier than Invoice Date."
                            : undefined,
                        }));
                      }}
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
              </div>
            </div>

            {/* Single Column Layout: Item Table, then Summary Panel below */}
            <div className="space-y-6">
              {/* Item Table Card */}
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
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
                  isEditMode={true}
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
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

                {/* Terms & Conditions */}
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                  <label className="block text-sm font-semibold text-gray-900 mb-3">
                    {ciText("Terms & Conditions")}
                  </label>
                  <div className="flex gap-2 mb-3 items-center">
                    <select
                      value={selectedTermsValue}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "") {
                          setInvoiceData((prev) => ({
                            ...prev,
                            termsAndConditions: "",
                          }));
                          return;
                        }
                        if (v === "__add_new__") {
                          setAddTermsModalOpen(true);
                          return;
                        }
                        if (
                          v === "__default__" &&
                          businessData?.termsAndConditions
                        ) {
                          setInvoiceData((prev) => ({
                            ...prev,
                            termsAndConditions: businessData.termsAndConditions,
                          }));
                          return;
                        }
                        if (v.startsWith("item_")) {
                          const id = v.replace("item_", "");
                          const item = termsAndConditionsList.find(
                            (t) => t._id === id,
                          );
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
                      }}
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                    >
                      <option value="">{ciText("Select terms and Conditions")}</option>
                      {businessData?.termsAndConditions ? (
                        <option value="__default__">{ciText("Default")}</option>
                      ) : null}
                      {termsAndConditionsList.map((t) => (
                        <option key={t._id} value={`item_${t._id}`}>
                          {t.name || ciText("Terms")}
                        </option>
                      ))}
                      {(businessData?.termsTemplates || []).map((t, i) => (
                        <option key={`tpl-${i}`} value={`tpl_${i}`}>
                          {t.name || `Terms ${i + 1}`}
                        </option>
                      ))}
                      <option value="__add_new__">{ciText("Add new")}</option>
                    </select>
                  </div>
                  {invoiceData.termsAndConditions ? (
                    <>
                      <textarea
                        name="termsAndConditions"
                        value={invoiceData.termsAndConditions || ""}
                        onChange={handleInputChange}
                        rows={4}
                        placeholder={ciText("Terms content (editable after selection)")}
                        className="w-full min-h-[6rem] px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] resize-y"
                      />
                      <p className="mt-2 text-xs text-gray-500">
                        Terms appear on the invoice preview and PDF. Edit above
                        if needed.
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
                      {ciText("Contract Information")}
                    </h3>
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
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons - Bottom of Screen */}
      <div className="bg-white border-t border-gray-200 sticky bottom-0 z-10 shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            {/* Template selection - Left Side */}
            <div className="flex items-center gap-3">
              {selectedTemplateId ? (
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
              {/* Save as Draft (draft) or Save (pending/sent) - always visible. */}
              <button
                type="button"
                onClick={() => handleSubmit("draft")}
                disabled={isLoading || !canSave}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
                  ["pending", "sent", "send-email", "request sent"].includes(
                    originalInvoiceStatus?.toLowerCase(),
                  )
                    ? "text-white bg-[var(--p-blue)] hover:bg-[var(--p-blue-dark)]"
                    : "text-gray-700 bg-gray-100 border border-gray-300 hover:bg-gray-200"
                }`}
              >
                <Save className="w-4 h-4" />
                {["pending", "sent", "send-email", "request sent"].includes(
                  originalInvoiceStatus?.toLowerCase(),
                )
                  ? isLoading
                    ? ciText("Saving...")
                    : ciText("Save")
                  : isLoading
                    ? ciText("Saving...")
                    : ciText("Save as Draft")}
              </button>
              <button
                type="button"
                onClick={() => handleSubmit("generated")}
                disabled={isLoading || !canSave}
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
      {renderTemplateSelectionModal()}
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
        }}
        contractId={selectedContract?._id}
        onSubmit={handleGenerateDocument}
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
            customer_id: selectedCustomer || invoiceData?.customer_id,
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
          savedRecordIdForPdf={id}
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
          documentUrl={
            DocumentData?.s3Key || DocumentData?.url || invoiceData?.documentUrl
          }
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
              {ciText("Add new Terms & Conditions")}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {ciText("Name")}
                </label>
                <input
                  type="text"
                  value={newTermName}
                  onChange={(e) => setNewTermName(e.target.value)}
                  placeholder={ciText("e.g. Standard, Net 30")}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {ciText("Content")}
                </label>
                <textarea
                  value={newTermContent}
                  onChange={(e) => setNewTermContent(e.target.value)}
                  rows={6}
                  placeholder={ciText("Enter terms and conditions text...")}
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
                {ciText("Cancel")}
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
                    notifySuccess(ciText("Success"));
                  } catch (err) {
                    console.error("Error saving terms:", err);
                    notifyError(
                      err.response?.data?.message || ciText("Failed to save terms."),
                    );
                  } finally {
                    setSavingNewTerm(false);
                  }
                }}
                disabled={savingNewTerm || !newTermName.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-[var(--p-blue)] rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                {savingNewTerm ? ciText("Saving...") : ciText("Save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UpdateCustomerInvoice;
