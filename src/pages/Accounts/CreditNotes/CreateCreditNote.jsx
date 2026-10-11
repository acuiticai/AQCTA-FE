import React, { useState, useEffect, useRef, useContext, useCallback, useMemo } from "react";
import {
  Calendar,
  Upload,
  FileText,
  Eye,
  Trash2,
  Users,
  Building,
  CreditCard,
  FileSpreadsheet,
  Check,
} from "lucide-react";
import axios from "axios";
import { useHistory } from "react-router-dom";
import { notifyError, notifySuccess } from "@/utils/toast";
import { AdminContext } from "@/context/AdminContext";
import CustomDatePicker from "@/components/CustomDatePicker";
import SearchableDropdown from "@/components/SearchableDropdown";
import SingleBusinessField from "@/components/SingleBusinessField";
import { isSingleAssignedBusiness } from "@/utils/sessionAssignedBusinesses";
import { formatAmount, formatCurrencyAmount } from "@/components/formatAmount";
import ZohoStyleItemTable from "@/components/invoice/ZohoStyleItemTable";
import InvoiceSummaryPanel from "@/components/invoice/InvoiceSummaryPanel";
import CustomerInvoiceServices from "@/services/CustomerInvoiceServices";
import { fetchLineItemCustomFieldDefinitions } from "@/services/customFieldServices";
import { PageHeader } from "@/page-layouts";
import {
  clampDiscountPercent,
  getItemTotal,
  getLineSubtotal,
  getLineTaxAmount,
  roundMoney,
} from "@/utils/itemDiscountUtils";
import {
  getCreditNoteReasonOptions,
  validateCreditNoteForm,
} from "@/utils/creditNoteFormValidation";
import BulkAddItemsModal from "@/components/customer-invoices/BulkAddItemsModal";
import { useTranslation } from "react-i18next";
import { makeCreditNoteT } from "@/utils/creditDebitNoteI18n";

const CreateCreditNote = ({
  embedInHub = false,
  onHubDone,
  onHubCancel,
  initialBusinessId = null,
  /** When true (e.g. Customer Invoices hub), only customer apply/refund — hide vendor path */
  hubCustomerOnly = false,
} = {}) => {
  const { t } = useTranslation();
  const cn = useMemo(() => makeCreditNoteT(t), [t]);
  const reasonOptions = useMemo(() => getCreditNoteReasonOptions(t), [t]);
  const history = useHistory();
  const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);

  const [businesses, setBusinesses] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [expenseAccounts, setExpenseAccounts] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [businessItems, setBusinessItems] = useState([]);
  const [taxes, setTaxes] = useState([]);
  const [lineItemCustomFieldDefs, setLineItemCustomFieldDefs] = useState([]);
  const [customerInvoices, setCustomerInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [vendorInvoices, setVendorInvoices] = useState([]);
  const [loadingVendorInvoices, setLoadingVendorInvoices] = useState(false);
  /** When a source invoice is selected: shipping rules and line guards apply */
  const [sourceInvoiceRules, setSourceInvoiceRules] = useState(null);

  const [currencies, setCurrencies] = useState([]);

  // Form data state
  const [creditNoteData, setCreditNoteData] = useState({
    business: "",
    entityType: "customer", // Default to customer
    customer: "",
    vendor: "",
    sourceInvoice: "",
    vendorInvoice: "",
    purchaseOrder: "",
    creditNoteType: "apply_to_invoice",
    creditNoteDate: formatDateForInput(new Date()),
    dueDate: formatDateForInput(new Date()),
    expenseAccount: "",
    bankAccount: "",
    paidFromBankAccount: "",
    refundDate: formatDateForInput(new Date()),
    paymentMethod: "",
    items: [],
    subtotal: 0,
    discountPercentage: 0,
    discountAmount: 0,
    shippingCharges: 0,
    adjustment: 0,
    taxTotal: 0,
    total: 0,
    currency: "USD",
    terms: "As per agreement",
    notes: "",
    reference: "",
    reason: "",
    allowRefundShipping: false,
    supportingDocuments: [],
    status: "Draft",
  });

  const [formErrors, setFormErrors] = useState({});
  const [showBulkAddItemsModal, setShowBulkAddItemsModal] = useState(false);

  const creditReason = creditNoteData.reason;
  const isReturnReason = creditReason === "01_return_of_goods";
  const isDiscountReason = creditReason === "02_discount_allowance";
  const isOtherReason = creditReason === "04_other";
  const isCorrectionReason = creditReason === "03_invoice_correction";
  const isRefundToClient = creditNoteData.creditNoteType === "refund_to_client";

  /** Shipping opt-in only when the linked document originally had shipping (LHDN or non-LHDN). */
  const canShowShippingCharges = useMemo(
    () => Boolean(sourceInvoiceRules?.shippingWasOnInvoice),
    [sourceInvoiceRules?.shippingWasOnInvoice],
  );

  const showShippingLineInSummary =
    canShowShippingCharges && Boolean(creditNoteData.allowRefundShipping);

  const requiresLhdnCreditReasonFields = useMemo(
    () =>
      creditNoteData.entityType === "customer" &&
      Boolean(creditNoteData.sourceInvoice) &&
      sourceInvoiceRules?.isLhdnLinkedCustomerInvoice === true,
    [
      creditNoteData.entityType,
      creditNoteData.sourceInvoice,
      sourceInvoiceRules?.isLhdnLinkedCustomerInvoice,
    ]
  );

  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo.token}`,
  };

  // Format date for input fields
  function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  useEffect(() => {
    if (hubCustomerOnly) {
      setCreditNoteData((p) => ({ ...p, entityType: "customer" }));
    }
  }, [hubCustomerOnly]);

  useEffect(() => {
    if (initialBusinessId) {
      setCreditNoteData((p) => {
        if (p.business) return p;
        return { ...p, business: initialBusinessId };
      });
    }
  }, [initialBusinessId]);

  useEffect(() => {
    fetchData();
  }, [creditNoteData.business]);

  useEffect(() => {
    const bid = creditNoteData.business;
    if (!bid) {
      setLineItemCustomFieldDefs([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const lineDefs = await fetchLineItemCustomFieldDefinitions(
          {
            businessId: bid,
            transactionContext:
              creditNoteData.entityType === "vendor"
                ? "purchase:vendor_invoice"
                : "sales:invoice",
          },
          headers
        );
        if (!cancelled) setLineItemCustomFieldDefs(lineDefs || []);
      } catch (e) {
        if (!cancelled) setLineItemCustomFieldDefs([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [creditNoteData.business, creditNoteData.entityType, adminInfo?.token]);

  useEffect(() => {
    if (creditNoteData.entityType !== "vendor" || !creditNoteData.business) {
      setVendorInvoices([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingVendorInvoices(true);
      try {
        const res = await axios.get(`${Base_URL}/vendor-invoices`, {
          headers,
          params: { business: creditNoteData.business, limit: 200, page: 1 },
        });
        const list = res.data?.data || [];
        if (!cancelled) setVendorInvoices(Array.isArray(list) ? list : []);
      } catch (e) {
        if (!cancelled) setVendorInvoices([]);
      } finally {
        if (!cancelled) setLoadingVendorInvoices(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [creditNoteData.entityType, creditNoteData.business, Base_URL, adminInfo?.token]);

  useEffect(() => {
    if (!creditNoteData.business) {
      setBusinessItems([]);
      return;
    }
    const fetchItems = async () => {
      try {
        const response = await axios.get(`${Base_URL}/items`, {
          params: {
            businessId: creditNoteData.business,
            status: "Active",
          },
        });
        if (response?.data?.items && Array.isArray(response?.data?.items)) {
          setBusinessItems(response.data.items || []);
        } else if (Array.isArray(response?.data)) {
          setBusinessItems(response.data || []);
        } else {
          setBusinessItems([]);
        }
      } catch (error) {
        setBusinessItems([]);
      }
    };
    fetchItems();
  }, [creditNoteData.business, Base_URL]);

  useEffect(() => {
    if (!creditNoteData.business) {
      setTaxes([]);
      return;
    }
    axios
      .get(`${Base_URL}/taxes?business=${creditNoteData.business}`)
      .then((res) => setTaxes(res.data || []))
      .catch(() => setTaxes([]));
  }, [creditNoteData.business, Base_URL]);

  useEffect(() => {
    if (
      creditNoteData.entityType !== "customer" ||
      !creditNoteData.business ||
      !creditNoteData.customer
    ) {
      setCustomerInvoices([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingInvoices(true);
      try {
        const res = await axios.get(`${Base_URL}/proforma-invoice`, {
          headers,
          params: {
            businessId: creditNoteData.business,
            customerId: creditNoteData.customer,
            module: "customer-invoices",
            limit: 200,
            page: 1,
          },
        });
        const list = Array.isArray(res.data?.data) ? res.data.data : [];
        const lhdnValid = list.filter((inv) =>
          CustomerInvoiceServices.isLhdnStatusValid(inv),
        );
        const linkedInvoices =
          creditNoteData.creditNoteType === "refund_to_client"
            ? lhdnValid
            : list;
        if (!cancelled) setCustomerInvoices(linkedInvoices);
      } catch (e) {
        if (!cancelled) setCustomerInvoices([]);
      } finally {
        if (!cancelled) setLoadingInvoices(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    creditNoteData.entityType,
    creditNoteData.business,
    creditNoteData.customer,
    creditNoteData.creditNoteType,
  ]);

  useEffect(() => {
    if (!creditNoteData?.business) {
      setCurrencies([]);
      return;
    }
    let cancelled = false;
    const fetchCurrencies = async () => {
      try {
        const response = await axios.get(
          `${Base_URL}/finance/currencies?business_id=${creditNoteData.business}`,
        );
        if (!cancelled) setCurrencies(response.data?.data || []);
      } catch {
        if (!cancelled) setCurrencies([]);
      }
    };
    fetchCurrencies();
    return () => {
      cancelled = true;
    };
  }, [creditNoteData.business, Base_URL]);

  /** Business base currency only (same rule as invoices). */
  const baseCurrencyRow = useMemo(() => {
    if (!Array.isArray(currencies) || currencies.length === 0) return null;
    const flagged =
      currencies.find(
        (c) =>
          c?.is_base === true ||
          c?.isBase === true ||
          c?.baseCurrency === true,
      ) || null;
    if (flagged) return flagged;
    if (currencies.length === 1) return currencies[0];
    return null;
  }, [currencies]);

  const currencyOptions = useMemo(() => {
    const row = baseCurrencyRow;
    if (!row) return [];
    const sym =
      String(row.symbol || row.prefix || row.name || "").trim() || "MYR";
    const prefLabel = row.prefix ?? sym;
    return [
      {
        value: sym,
        label: `${sym} (${prefLabel})`,
        conversionRate:
          parseFloat(row.conversion_rate_to_base ?? row.conversionRate) || 1,
      },
    ];
  }, [baseCurrencyRow]);

  useEffect(() => {
    if (!creditNoteData.business || !baseCurrencyRow) return;
    const sym =
      String(
        baseCurrencyRow.symbol ||
          baseCurrencyRow.prefix ||
          baseCurrencyRow.name ||
          "MYR",
      ).trim() || "MYR";
    setCreditNoteData((prev) =>
      prev.currency === sym ? prev : { ...prev, currency: sym },
    );
  }, [creditNoteData.business, baseCurrencyRow]);

  const getEntityBusinessId = useCallback((entity) => {
    if (!entity || typeof entity !== "object") return "";
    return (
      entity.business?._id ||
      entity.business ||
      entity.businessId ||
      entity.business_id ||
      entity?.basicInformation?.business ||
      entity?.basicInformation?.businessId ||
      entity?.basicInformation?.business_id ||
      ""
    );
  }, []);
  const scopedVendors = useMemo(() => {
    const assignedBusinessIds = (businesses || [])
      .map((b) => b?._id)
      .filter(Boolean)
      .map((id) => String(id));
    const allowed = new Set(
      (creditNoteData.business
        ? [creditNoteData.business]
        : assignedBusinessIds
      ).map((id) => String(id)),
    );
    if (allowed.size === 0) return vendors || [];
    return (vendors || []).filter((v) =>
      allowed.has(String(getEntityBusinessId(v))),
    );
  }, [vendors, businesses, creditNoteData.business, getEntityBusinessId]);

  const fetchData = async () => {
    if (creditNoteData.business) {
      setIsLoadingData(true);
    }

    try {
      // Fetch businesses
      const storedBusinesses = localStorage.getItem("businesses");
      let assignedBusinesses = [];
      if (storedBusinesses) {
        assignedBusinesses = JSON.parse(storedBusinesses) || [];
        setBusinesses(assignedBusinesses);
      } else {
        setBusinesses([]);
      }

      if (!creditNoteData.business && assignedBusinesses.length === 1) {
        setCreditNoteData((prev) => ({
          ...prev,
          business: assignedBusinesses[0]._id,
        }));
        return;
      }

      if (
        creditNoteData.business &&
        assignedBusinesses.length > 0 &&
        !assignedBusinesses.some(
          (b) => String(b?._id) === String(creditNoteData.business),
        )
      ) {
        notifyError(cn("toasts.businessNotAssigned", "Selected business is not assigned to your account"));
        setCreditNoteData((prev) => ({ ...prev, business: "" }));
        return;
      }

      // Only fetch business-specific data if business is selected
      if (creditNoteData.business) {
        const [
          customersRes,
          vendorsRes,
          purchaseOrdersRes,
          chartAccountsRes,
          bankAccountsRes,
        ] = await Promise.all([
          axios.get(`${Base_URL}/customers`, {
            params: { businessId: creditNoteData.business },
            headers,
          }),
          axios.get(`${Base_URL}/vendors`, {
            params: { businessId: creditNoteData.business },
            headers,
          }),
          axios.get(`${Base_URL}/purchase-orders`, {
            params: {
              businessId: creditNoteData.business,
              business: creditNoteData.business,
            },
            headers,
          }),
          axios.get(`${Base_URL}/accounts`, {
            params: { business: creditNoteData.business },
            headers,
          }),
          axios.get(`${Base_URL}/bank-management/accounts`, {
            params: { business: creditNoteData.business },
            headers,
          }),
        ]);

        setCustomers(
          customersRes.data.customers || customersRes.data.data || []
        );
        setVendors(vendorsRes.data.vendors || vendorsRes.data.data || []);
        setPurchaseOrders(
          purchaseOrdersRes.data.orders ||
            purchaseOrdersRes.data.data ||
            purchaseOrdersRes.data.purchaseOrders ||
            []
        );
        setExpenseAccounts(chartAccountsRes.data.accounts || []);
        setBankAccounts(bankAccountsRes.data.accounts || []);

        try {
          const pmRes = await axios.post(
            `${Base_URL}/daily-reports/payment-methods/get_all`,
            {
              business_id: creditNoteData.business,
              FilterStatus: "Active",
              FilterName: "",
            },
            { headers }
          );
          const pmList =
            pmRes?.data?.data ??
            pmRes?.data ??
            [];
          setPaymentMethods(Array.isArray(pmList) ? pmList : []);
        } catch (pmErr) {
          console.warn("Payment methods load skipped:", pmErr);
          setPaymentMethods([]);
        }
      } else {
        // Clear data when no business is selected
        setCustomers([]);
        setVendors([]);
        setPurchaseOrders([]);
        setExpenseAccounts([]);
        setBankAccounts([]);
        setPaymentMethods([]);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
      notifyError(cn("toasts.loadDataFailed", "Failed to load data"));
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    // If business is changing, clear dependent fields
    if (name === "business") {
      setSourceInvoiceRules(null);
      setCreditNoteData((prev) => ({
        ...prev,
        [name]: value,
        customer: "",
        vendor: "",
        sourceInvoice: "",
        vendorInvoice: "",
        purchaseOrder: "",
        expenseAccount: "",
        bankAccount: "",
        paidFromBankAccount: "",
        items: [],
        subtotal: 0,
        discountPercentage: 0,
        discountAmount: 0,
        shippingCharges: 0,
        allowRefundShipping: false,
        adjustment: 0,
        taxTotal: 0,
        total: 0,
      }));
    }
    // If entity type is changing, clear entity-specific fields
    else if (name === "entityType") {
      setSourceInvoiceRules(null);
      setCreditNoteData((prev) => ({
        ...prev,
        [name]: value,
        customer: "",
        vendor: "",
        sourceInvoice: "",
        vendorInvoice: "",
        purchaseOrder: "",
        items: [],
        subtotal: 0,
        discountPercentage: 0,
        discountAmount: 0,
        shippingCharges: 0,
        allowRefundShipping: false,
        adjustment: 0,
        taxTotal: 0,
        total: 0,
      }));
    } else if (name === "customer") {
      setSourceInvoiceRules(null);
      setCreditNoteData((prev) => ({
        ...prev,
        [name]: value,
        sourceInvoice: "",
        items: [],
        subtotal: 0,
        discountPercentage: 0,
        discountAmount: 0,
        shippingCharges: 0,
        allowRefundShipping: false,
        adjustment: 0,
        taxTotal: 0,
        total: 0,
      }));
    } else if (name === "vendor") {
      setSourceInvoiceRules(null);
      setCreditNoteData((prev) => ({
        ...prev,
        [name]: value,
        vendorInvoice: "",
        purchaseOrder: "",
        items: [],
        subtotal: 0,
        discountPercentage: 0,
        discountAmount: 0,
        shippingCharges: 0,
        allowRefundShipping: false,
        adjustment: 0,
        taxTotal: 0,
        total: 0,
      }));
    } else if (name === "reason") {
      setCreditNoteData((prev) => ({
        ...prev,
        reason: value,
      }));
    } else {
      setCreditNoteData((prev) => ({ ...prev, [name]: value }));
    }

    // Clear form errors when user starts typing
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  /** Line guards only when linked to an LHDN Valid e‑Invoice */
  const sanitizeRowAgainstSourceInvoice = useCallback((row, fieldChanged) => {
    let r = { ...row };
    const hasSource = r.sourceInvoiceLineIndex != null;
    const enforceMyInvoisLineGuards =
      sourceInvoiceRules?.isLhdnLinkedCustomerInvoice === true;

    if (hasSource && enforceMyInvoisLineGuards) {
      const reason = creditNoteData.reason;
      const maxQ = r._cnMaxQty;
      if (maxQ != null) {
        let q = parseFloat(r.quantity) || 0;
        if (q > maxQ + 1e-9) {
          if (fieldChanged === "quantity") {
            notifyError(
              cn(
                "toasts.qtyExceedsInvoiceLine",
                "Quantity cannot exceed the invoice line ({{max}}).",
                { max: maxQ }
              )
            );
          }
          q = maxQ;
          r.quantity = q;
        }
      }

      const maxAmount = parseFloat(r._cnMaxAmount);
      if (Number.isFinite(maxAmount)) {
        const rawLine = parseFloat(
          getItemTotal(
            parseFloat(r.quantity) || 0,
            parseFloat(r.unitPrice) || 0,
            parseFloat(r.discount) || 0,
            parseFloat(r.taxRate) || 0
          )
        ) || 0;
        const currentLineTotal = roundMoney(rawLine);
        const maxAmt = roundMoney(maxAmount);
        // Compare rounded MYR amounts only — avoids spurious errors/toasts when
        // floats differ from invoice mapping by microscopic amounts.
        if (currentLineTotal > maxAmt) {
          if (["quantity", "unitPrice", "discount", "taxRate"].includes(fieldChanged)) {
            notifyError(
              cn(
                "toasts.lineAmountExceedsOriginal",
                "Line amount cannot exceed the original invoice line amount ({{amount}}).",
                { amount: formatAmount(maxAmt) }
              )
            );
          }
          if ((parseFloat(r.quantity) || 0) > 0) {
            const unit = parseFloat(r.unitPrice) || 0;
            const discountPct = parseFloat(r.discount) || 0;
            const taxPct = parseFloat(r.taxRate) || 0;
            const grossFactor = (1 - discountPct / 100) * (1 + taxPct / 100);
            if (grossFactor > 0 && unit > 0) {
              const maxQtyByAmount = maxAmt / (unit * grossFactor);
              r.quantity = Math.max(0, Math.min(parseFloat(r.quantity) || 0, maxQtyByAmount));
            }
          }
        }
      }

      if (
        reason === "01_return_of_goods" ||
        reason === "04_other"
      ) {
        const origRate = parseFloat(r._cnOriginalRate);
        if (
          Number.isFinite(origRate) &&
          Math.abs((parseFloat(r.unitPrice) || 0) - origRate) > 0.01
        ) {
          if (fieldChanged === "unitPrice") {
            notifyError(cn("toasts.rateCannotChange", "Rate cannot be changed for this credit note reason."));
          }
          r.unitPrice = origRate;
        }
      }

      if (reason === "02_discount_allowance") {
        const qty = parseFloat(r.quantity) || 0;
        if (Math.abs(qty - 1) > 1e-9) {
          if (fieldChanged === "quantity") {
            notifyError(cn("toasts.discountQtyMustBeOne", "For 02 - Discount, quantity must remain 1."));
          }
          r.quantity = 1;
        }
      }

      if (reason === "01_return_of_goods" && maxQ != null) {
        const qty = parseFloat(r.quantity) || 0;
        if (Math.abs(qty - maxQ) > 1e-9) {
          if (fieldChanged === "quantity") {
            notifyError(
              cn(
                "toasts.qtyMustMatchReturn",
                "For 01 - Return of goods, quantity must match invoice quantity ({{max}}).",
                { max: maxQ }
              )
            );
          }
          r.quantity = maxQ;
        }
      }

      if (reason === "01_return_of_goods" || reason === "04_other") {
        const origDiscount = parseFloat(r._cnOriginalDiscount) || 0;
        if (Math.abs((parseFloat(r.discount) || 0) - origDiscount) > 0.01) {
          if (fieldChanged === "discount") {
            notifyError(cn("toasts.discountCannotChange", "Discount cannot be changed for this credit note reason."));
          }
          r.discount = origDiscount;
        }
      }

      const origId = String(r._cnAllowedTaxId || "");
      const origRate = parseFloat(r._cnAllowedTaxRate) || 0;
      const hadNoTax = !origId && origRate === 0;
      const taxFields = ["taxId", "taxRate", "taxName", "itemId"];

      if (hadNoTax) {
        const bad =
          (parseFloat(r.taxRate) || 0) > 1e-6 ||
          (r.taxId && String(r.taxId).trim() !== "");
        if (bad) {
          if (taxFields.includes(fieldChanged)) {
            notifyError(
              cn(
                "toasts.lineHadNoTax",
                "This invoice line had no tax — you cannot add a different tax on the credit note."
              )
            );
          }
          r.taxId = "";
          r.taxRate = 0;
          r.taxName = "";
        }
      } else if (origId) {
        if (String(r.taxId || "") !== origId) {
          if (taxFields.includes(fieldChanged)) {
            notifyError(cn("toasts.taxMustMatchInvoice", "Tax type must match the original invoice line."));
          }
          r.taxId = origId;
          r.taxRate = origRate;
          if (r._cnAllowedTaxName) r.taxName = r._cnAllowedTaxName;
        }
      } else if (Math.abs((parseFloat(r.taxRate) || 0) - origRate) > 0.02) {
        if (taxFields.includes(fieldChanged)) {
          notifyError(
            cn(
              "toasts.taxRateMustMatchInvoice",
              "Tax rate must match the original invoice line ({{rate}}%).",
              { rate: origRate }
            )
          );
        }
        r.taxRate = origRate;
      }
    }

    const quantity = parseFloat(r.quantity) || 0;
    const unitPrice = parseFloat(r.unitPrice) || 0;
    const discount = parseFloat(r.discount) || 0;
    const taxRate = parseFloat(r.taxRate) || 0;
    r.total = getItemTotal(quantity, unitPrice, discount, taxRate);
    return r;
  }, [creditNoteData.reason, sourceInvoiceRules?.isLhdnLinkedCustomerInvoice, cn]);

  const recalcTotalsFromItems = useCallback((prev, updatedItems) => {
    const subtotal = updatedItems.reduce((sum, item) => sum + (item.total || 0), 0);
    const taxTotal = updatedItems.reduce((sum, item) => {
      const lineSub = getLineSubtotal(
        item.quantity,
        item.unitPrice,
        item.discount
      );
      return sum + getLineTaxAmount(lineSub, item.taxRate);
    }, 0);
    const discountAmount = (subtotal * (prev.discountPercentage || 0)) / 100;
    const total = Math.max(
      0,
      subtotal -
        discountAmount +
        (prev.shippingCharges || 0) +
        (prev.adjustment || 0)
    );
    return { subtotal, taxTotal, discountAmount, total };
  }, []);

  const handleBulkAddItemsForCreditNote = useCallback(
    (newItems) => {
      if (!newItems || newItems.length === 0) return;
      setCreditNoteData((prev) => {
        const merged = [...(prev.items || [])];
        let nextRowId =
          merged.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0) + 1;

        for (const ni of newItems) {
          const itemId = ni.itemId;
          if (!itemId) {
            merged.push({ ...ni, id: nextRowId++ });
            continue;
          }
          const ix = merged.findIndex(
            (it) =>
              it.sourceInvoiceLineIndex == null &&
              !it.isAdvancePayment &&
              String(it.itemId || "") === String(itemId)
          );
          if (ix >= 0) {
            const existing = merged[ix];
            const existingQty = parseFloat(existing.quantity) || 1;
            const addQty = parseFloat(ni.quantity) || 1;
            const newQty = existingQty + addQty;
            const unitPrice = parseFloat(existing.unitPrice) || 0;
            const discount = parseFloat(existing.discount) || 0;
            const taxRate = parseFloat(existing.taxRate) || 0;
            const lineSubtotal =
              newQty * unitPrice * (1 - (discount || 0) / 100);
            const taxAmount = (lineSubtotal * taxRate) / 100;
            merged[ix] = {
              ...existing,
              quantity: newQty,
              total: Math.max(0, lineSubtotal + taxAmount),
            };
          } else {
            merged.push({ ...ni, id: nextRowId++ });
          }
        }

        const processed = merged.map((row) =>
          sanitizeRowAgainstSourceInvoice({ ...row }, "quantity"),
        );
        const { subtotal, taxTotal, discountAmount, total } =
          recalcTotalsFromItems(prev, processed);
        return {
          ...prev,
          items: processed,
          subtotal,
          taxTotal,
          discountAmount,
          total,
        };
      });
      notifySuccess(cn("toasts.itemsAdded", "{{count}} item(s) added", { count: newItems.length }));
    },
    [recalcTotalsFromItems, sanitizeRowAgainstSourceInvoice],
  );

  // Keep stored shipping at 0 whenever the summary must not show shipping (totals stay consistent).
  useEffect(() => {
    if (
      creditNoteData.entityType === "customer" &&
      creditNoteData.sourceInvoice &&
      sourceInvoiceRules == null
    ) {
      return;
    }
    if (
      creditNoteData.entityType === "vendor" &&
      sourceInvoiceRules == null &&
      (Boolean(creditNoteData.vendorInvoice) ||
        Boolean(creditNoteData.purchaseOrder))
    ) {
      return;
    }
    if (canShowShippingCharges) return;
    setCreditNoteData((prev) => {
      const shippingZero = (prev.shippingCharges || 0) <= 0;
      const allowAlreadyOff = !prev.allowRefundShipping;
      if (shippingZero && allowAlreadyOff) return prev;
      const next = {
        ...prev,
        allowRefundShipping: false,
        ...(shippingZero ? {} : { shippingCharges: 0 }),
      };
      const { subtotal, taxTotal, discountAmount, total } = recalcTotalsFromItems(
        next,
        next.items || [],
      );
      return { ...next, subtotal, taxTotal, discountAmount, total };
    });
  }, [
    creditNoteData.entityType,
    creditNoteData.sourceInvoice,
    creditNoteData.vendorInvoice,
    creditNoteData.purchaseOrder,
    sourceInvoiceRules,
    canShowShippingCharges,
    recalcTotalsFromItems,
  ]);

  // When shipping section is visible but the business has not opted in, keep stored shipping at 0.
  useEffect(() => {
    if (!canShowShippingCharges || creditNoteData.allowRefundShipping) return;
    setCreditNoteData((prev) => {
      if ((prev.shippingCharges || 0) <= 0) return prev;
      const next = { ...prev, shippingCharges: 0 };
      const { subtotal, taxTotal, discountAmount, total } = recalcTotalsFromItems(
        next,
        next.items || [],
      );
      return { ...next, subtotal, taxTotal, discountAmount, total };
    });
  }, [
    canShowShippingCharges,
    creditNoteData.allowRefundShipping,
    recalcTotalsFromItems,
  ]);

  // Pre-fill shipping from linked document after opt-in only; does not overwrite user edits.
  useEffect(() => {
    if (!canShowShippingCharges || !creditNoteData.allowRefundShipping) return;
    const cap = parseFloat(sourceInvoiceRules?.invoiceShipping) || 0;
    if (!(cap > 0)) return;
    setCreditNoteData((prev) => {
      if ((prev.shippingCharges || 0) > 0) return prev;
      const next = { ...prev, shippingCharges: cap };
      const { subtotal, taxTotal, discountAmount, total } = recalcTotalsFromItems(
        next,
        next.items || [],
      );
      return { ...next, subtotal, taxTotal, discountAmount, total };
    });
  }, [
    creditNoteData.entityType,
    canShowShippingCharges,
    creditNoteData.allowRefundShipping,
    sourceInvoiceRules?.invoiceShipping,
    recalcTotalsFromItems,
  ]);

  const handleLineItemChange = (index, field, value) => {
    if (
      field === "lineItemCustomFields" &&
      value &&
      typeof value === "object" &&
      Object.prototype.hasOwnProperty.call(value, "key")
    ) {
      setCreditNoteData((prev) => {
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

    setCreditNoteData((prev) => {
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

      updatedItems[index] = sanitizeRowAgainstSourceInvoice(
        updatedItems[index],
        field
      );

      const { subtotal, taxTotal, discountAmount, total } = recalcTotalsFromItems(
        prev,
        updatedItems
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
  };

  const mapProformaItemsToRows = (invoice) => {
    return (invoice.items || []).map((item, idx) => {
      const quantity = item.quantity || 0;
      const unitPrice = item.unitPrice || 0;
      const discount = item.discount || 0;
      const taxRate = item.taxRate || 0;
      const lineGross = getItemTotal(quantity, unitPrice, discount, taxRate);
      return {
        id: idx + 1,
        sourceInvoiceLineIndex: idx,
        _cnMaxQty: quantity,
        _cnOriginalRate: unitPrice,
        _cnOriginalDiscount: discount,
        _cnAllowedTaxId: String(item.taxId || ""),
        _cnAllowedTaxRate: parseFloat(item.taxRate) || 0,
        _cnAllowedTaxName: item.taxName || "",
        _cnMaxAmount: Math.max(0, parseFloat(lineGross) || 0),
        quantity,
        unitPrice,
        discount,
        taxRate,
        taxId: item.taxId || "",
        taxName: item.taxName || "",
        tax_class: item.tax_class || "01",
        total: Math.max(0, parseFloat(lineGross) || 0),
        itemName:
          item.itemName || item.item || item.name || item.title || "",
        description: item.description || "",
        item: item.item || item.name || item.title || item.itemName || "",
        itemId: item.itemId || undefined,
        expenseAccount:
          typeof item.expenseAccount === "object" && item.expenseAccount?._id
            ? item.expenseAccount._id
            : item.expenseAccount || null,
        lineItemCustomFields:
          item.lineItemCustomFields &&
          typeof item.lineItemCustomFields === "object"
            ? { ...item.lineItemCustomFields }
            : {},
      };
    });
  };

  const mapVendorInvoiceItemsToRows = (invoice) => {
    return (invoice.items || []).map((item, idx) => {
      const quantity = item.quantity ?? 1;
      const unitPrice = parseFloat(item.unitPrice) || 0;
      const discount = parseFloat(item.discount) || 0;
      const taxRate = parseFloat(item.taxRate) || 0;
      const lineTotal = Math.max(
        0,
        parseFloat(getItemTotal(quantity, unitPrice, discount, taxRate)) || 0,
      );
      const itemId =
        item.itemId && typeof item.itemId === "object"
          ? item.itemId._id
          : item.itemId;
      return {
        id: idx + 1,
        sourceInvoiceLineIndex: idx,
        _cnSourceType: "vendor",
        _cnMaxQty: quantity,
        _cnOriginalRate: unitPrice,
        _cnOriginalDiscount: discount,
        _cnAllowedTaxId: String(item.taxId || ""),
        _cnAllowedTaxRate: taxRate,
        _cnAllowedTaxName: item.taxName || "",
        _cnMaxAmount: lineTotal,
        quantity,
        unitPrice,
        discount,
        taxRate,
        taxId: item.taxId ? String(item.taxId) : "",
        taxName: item.taxName || "",
        tax_class: item.tax_class || "01",
        total: lineTotal,
        itemName: item.description || `Line ${idx + 1}`,
        description: item.description || "",
        item: item.description || "",
        itemId: itemId || undefined,
        expenseAccount:
          typeof item.expenseAccount === "object" && item.expenseAccount?._id
            ? item.expenseAccount._id
            : item.expenseAccount || null,
        lineItemCustomFields: {},
      };
    });
  };

  const mapPurchaseOrderItemsToRows = (purchaseOrder) => {
    return (purchaseOrder.items || []).map((item, idx) => {
      const quantity = item.quantity ?? 1;
      const unitPrice = parseFloat(item.unitPrice) || 0;
      const discount = parseFloat(item.discount) || 0;
      const taxRate = parseFloat(item.taxRate) || 0;
      const lineTotal = Math.max(
        0,
        parseFloat(getItemTotal(quantity, unitPrice, discount, taxRate)) || 0,
      );
      const itemId =
        item.itemId && typeof item.itemId === "object"
          ? item.itemId._id
          : item.itemId;
      return {
        id: idx + 1,
        quantity,
        unitPrice,
        discount,
        taxRate,
        taxId: item.taxId ? String(item.taxId) : "",
        taxName: item.taxName || "",
        tax_class: item.tax_class || "01",
        total: lineTotal,
        itemName: item.itemName || item.description || `Line ${idx + 1}`,
        description: item.description || item.itemName || "",
        item: item.itemName || item.description || "",
        itemId: itemId || undefined,
        expenseAccount:
          typeof item.expenseAccount === "object" && item.expenseAccount?._id
            ? item.expenseAccount._id
            : item.expenseAccount || null,
        lineItemCustomFields: {},
      };
    });
  };

  const applyPurchaseOrder = async (purchaseOrderId) => {
    if (!purchaseOrderId) {
      setSourceInvoiceRules(null);
      setCreditNoteData((prev) => ({
        ...prev,
        purchaseOrder: "",
        items: [],
        subtotal: 0,
        discountPercentage: 0,
        discountAmount: 0,
        shippingCharges: 0,
        allowRefundShipping: false,
        adjustment: 0,
        taxTotal: 0,
        total: 0,
      }));
      return;
    }
    try {
      const res = await axios.get(
        `${Base_URL}/purchase-orders/${purchaseOrderId}/bill-prefill`,
        { headers },
      );
      const po = res.data?.data ?? res.data;
      if (!po) {
        notifyError(cn("toasts.poLoadFailed", "Could not load purchase order"));
        return;
      }
      const rows = mapPurchaseOrderItemsToRows(po);
      const poShip = parseFloat(po.shippingCharges) || 0;
      setSourceInvoiceRules({
        isVendorSource: true,
        shippingWasOnInvoice: poShip > 0,
        invoiceShipping: poShip,
        invoiceTotal: null,
        invoiceDate: null,
        invoicePaymentStatus: "",
        invoicePaidAmount: null,
        originalInvoiceUUID: null,
      });
      setCreditNoteData((prev) => {
        const next = {
          ...prev,
          purchaseOrder: purchaseOrderId,
          vendorInvoice: "",
          currency: po.currency || prev.currency,
          items: rows,
          discountPercentage:
            (parseFloat(po.subtotal) || 0) > 0
              ? ((parseFloat(po.discount) || 0) / parseFloat(po.subtotal)) * 100
              : 0,
          allowRefundShipping: false,
          shippingCharges: 0,
          adjustment: parseFloat(po.adjustment) || 0,
        };
        const subtotal = rows.reduce((s, r) => s + (r.total || 0), 0);
        const taxTotal = rows.reduce((sum, item) => {
          const lineSub = getLineSubtotal(
            item.quantity,
            item.unitPrice,
            item.discount,
          );
          return sum + getLineTaxAmount(lineSub, item.taxRate);
        }, 0);
        const discountAmount = (subtotal * (next.discountPercentage || 0)) / 100;
        const total = Math.max(
          0,
          subtotal -
            discountAmount +
            (next.shippingCharges || 0) +
            (next.adjustment || 0),
        );
        return { ...next, subtotal, taxTotal, discountAmount, total };
      });
      notifySuccess(cn("toasts.poLoaded", "Purchase order lines loaded — adjust as needed"));
    } catch (e) {
      notifyError(cn("toasts.poDetailsFailed", "Failed to load purchase order details"));
    }
  };

  const applyVendorInvoice = async (vendorInvoiceId) => {
    if (!vendorInvoiceId) {
      setSourceInvoiceRules(null);
      setCreditNoteData((prev) => ({
        ...prev,
        vendorInvoice: "",
        items: [],
        subtotal: 0,
        discountPercentage: 0,
        discountAmount: 0,
        shippingCharges: 0,
        allowRefundShipping: false,
        adjustment: 0,
        taxTotal: 0,
        total: 0,
      }));
      return;
    }
    try {
      const res = await axios.get(`${Base_URL}/vendor-invoices/${vendorInvoiceId}`, {
        headers,
      });
      const invoice = res.data?.data ?? res.data;
      if (!invoice) {
        notifyError(cn("toasts.vendorBillLoadFailed", "Could not load vendor bill"));
        return;
      }
      const rows = mapVendorInvoiceItemsToRows(invoice);
      const invTotal = parseFloat(invoice.total) || 0;
      const st = (invoice.status || "").toString().trim().toLowerCase();
      setSourceInvoiceRules({
        isVendorSource: true,
        shippingWasOnInvoice: (parseFloat(invoice.shipping) || 0) > 0,
        invoiceShipping: parseFloat(invoice.shipping) || 0,
        invoiceTotal: invTotal,
        invoiceDate: invoice.invoiceDate || invoice.createdAt || null,
        invoicePaymentStatus: st,
        invoicePaidAmount: st === "paid" ? invTotal : null,
        originalInvoiceUUID: null,
      });
      setCreditNoteData((prev) => {
        const next = {
          ...prev,
          vendorInvoice: vendorInvoiceId,
          currency: invoice.currency || prev.currency,
          items: rows,
          discountPercentage: parseFloat(invoice.discount) || 0,
          allowRefundShipping: false,
          shippingCharges: 0,
          adjustment: parseFloat(invoice.adjustments) || 0,
        };
        const subtotal = rows.reduce((s, r) => s + (r.total || 0), 0);
        const taxTotal = rows.reduce((sum, item) => {
          const lineSub = getLineSubtotal(
            item.quantity,
            item.unitPrice,
            item.discount
          );
          return sum + getLineTaxAmount(lineSub, item.taxRate);
        }, 0);
        const discountAmount = (subtotal * (next.discountPercentage || 0)) / 100;
        const total = Math.max(
          0,
          subtotal -
            discountAmount +
            (next.shippingCharges || 0) +
            (next.adjustment || 0)
        );
        return {
          ...next,
          subtotal,
          taxTotal,
          discountAmount,
          total,
        };
      });
      notifySuccess(cn("toasts.vendorBillLoaded", "Vendor bill lines loaded — adjust as needed"));
    } catch (e) {
      notifyError(cn("toasts.vendorBillDetailsFailed", "Failed to load vendor bill details"));
    }
  };

  const applySourceInvoice = async (invoiceId) => {
    if (!invoiceId) {
      setSourceInvoiceRules(null);
      setCreditNoteData((prev) => ({
        ...prev,
        sourceInvoice: "",
        items: [],
        subtotal: 0,
        discountPercentage: 0,
        discountAmount: 0,
        shippingCharges: 0,
        allowRefundShipping: false,
        adjustment: 0,
        taxTotal: 0,
        total: 0,
      }));
      return;
    }
    try {
      const res = await axios.get(`${Base_URL}/proforma-invoice/${invoiceId}`, {
        headers,
      });
      const invoice = res.data?.data ?? res.data;
      if (!invoice) {
        notifyError(cn("toasts.invoiceLoadFailed", "Could not load invoice"));
        return;
      }
      const rows = mapProformaItemsToRows(invoice);
      const totalPaidFromPayments = (invoice.payments || []).reduce((sum, payment) => {
        const allocated =
          payment?.allocatedAmount ??
          payment?.conversionDetails?.convertedAmount ??
          payment?.amountInInvoiceCurrency ??
          payment?.amount ??
          0;
        return sum + (parseFloat(allocated) || 0);
      }, 0);
      const totalPaid =
        parseFloat(invoice.totalPaid) ||
        parseFloat(invoice.amountPaid) ||
        parseFloat(invoice.paidAmount) ||
        totalPaidFromPayments;
      const invoiceRemaining =
        CustomerInvoiceServices.calculateRemainingAmount(invoice);
      setSourceInvoiceRules({
        isVendorSource: false,
        shippingWasOnInvoice: (parseFloat(invoice.shippingCharges) || 0) > 0,
        invoiceShipping: parseFloat(invoice.shippingCharges) || 0,
        invoiceTotal:
          Number.isFinite(invoiceRemaining)
            ? invoiceRemaining
            : parseFloat(invoice.remaining) ||
              parseFloat(invoice.grandTotal) ||
              parseFloat(invoice.total) ||
              0,
        invoiceDate:
          invoice.invoice_date ||
          invoice.invoiceDate ||
          invoice.date ||
          invoice.createdAt ||
          null,
        invoicePaymentStatus: (
          invoice.paymentStatus ||
          invoice.payment_status ||
          invoice.status ||
          ""
        )
          .toString()
          .trim()
          .toLowerCase(),
        invoicePaidAmount: Math.max(0, totalPaid || 0),
        originalInvoiceUUID:
          invoice.uuid ||
          invoice.documentUUID ||
          invoice.submissionUUID ||
          invoice.irbm_uuid ||
          null,
        isLhdnLinkedCustomerInvoice:
          CustomerInvoiceServices.isLhdnStatusValid(invoice),
      });
      setCreditNoteData((prev) => {
        const next = {
          ...prev,
          sourceInvoice: invoiceId,
          currency: invoice.currency || prev.currency,
          items: rows,
          discountPercentage: invoice.discount || 0,
          allowRefundShipping: false,
          shippingCharges: 0,
          adjustment: invoice.adjustment || 0,
        };
        const subtotal = rows.reduce((s, r) => s + (r.total || 0), 0);
        const taxTotal = rows.reduce((sum, item) => {
          const lineSub = getLineSubtotal(
            item.quantity,
            item.unitPrice,
            item.discount
          );
          return sum + getLineTaxAmount(lineSub, item.taxRate);
        }, 0);
        const discountAmount = (subtotal * (next.discountPercentage || 0)) / 100;
        const total = Math.max(
          0,
          subtotal -
            discountAmount +
            (next.shippingCharges || 0) +
            (next.adjustment || 0)
        );
        return {
          ...next,
          subtotal,
          taxTotal,
          discountAmount,
          total,
        };
      });
      notifySuccess(cn("toasts.invoiceLoaded", "Invoice line items loaded — adjust as needed"));
    } catch (e) {
      notifyError(cn("toasts.invoiceDetailsFailed", "Failed to load invoice details"));
    }
  };

  // If the linked customer invoice is no longer in the selectable list, drop the link
  useEffect(() => {
    if (creditNoteData.entityType !== "customer") return;
    if (loadingInvoices) return;
    if (!creditNoteData.sourceInvoice) return;
    const still = (customerInvoices || []).some(
      (i) => i._id === creditNoteData.sourceInvoice
    );
    if (!still) {
      applySourceInvoice("");
    }
  }, [loadingInvoices, customerInvoices, creditNoteData.sourceInvoice, creditNoteData.entityType]);

  const vendorInvoicesForSelectedVendor = useCallback(() => {
    if (!creditNoteData.vendor) return vendorInvoices || [];
    return (vendorInvoices || []).filter(
      (inv) => String(inv.vendor?._id || inv.vendor || "") === String(creditNoteData.vendor)
    );
  }, [vendorInvoices, creditNoteData.vendor]);

  const getPurchaseOrderVendorId = useCallback((po) => {
    const rawVendor =
      po?.vendor ||
      po?.customer ||
      po?.supplier ||
      po?.basicInfo?.selectedVendorId ||
      po?.vendorId ||
      po?.customerId;
    if (rawVendor && typeof rawVendor === "object") {
      return String(rawVendor._id || rawVendor.id || "");
    }
    return String(rawVendor || "");
  }, []);

  const purchaseOrdersForSelectedVendor = useCallback(() => {
    const list = purchaseOrders || [];
    if (!creditNoteData.vendor) return list;
    return list.filter(
      (po) =>
        String(getPurchaseOrderVendorId(po)) === String(creditNoteData.vendor),
    );
  }, [purchaseOrders, creditNoteData.vendor, getPurchaseOrderVendorId]);

  useEffect(() => {
    if (creditNoteData.entityType !== "vendor") return;
    if (loadingVendorInvoices) return;
    if (!creditNoteData.vendorInvoice) return;
    const list = vendorInvoicesForSelectedVendor();
    const still = list.some((i) => i._id === creditNoteData.vendorInvoice);
    if (!still) {
      applyVendorInvoice("");
    }
  }, [
    loadingVendorInvoices,
    vendorInvoicesForSelectedVendor,
    creditNoteData.vendorInvoice,
    creditNoteData.entityType,
  ]);

  useEffect(() => {
    if (creditNoteData.entityType !== "vendor") return;
    if (!creditNoteData.purchaseOrder) return;
    const list = purchaseOrdersForSelectedVendor();
    const still = list.some((po) => po._id === creditNoteData.purchaseOrder);
    if (!still) {
      applyPurchaseOrder("");
    }
  }, [
    purchaseOrdersForSelectedVendor,
    creditNoteData.entityType,
    creditNoteData.purchaseOrder,
  ]);

  const getFilteredCustomerInvoices = useCallback(() => {
    const invoices = customerInvoices || [];
    if (!isRefundToClient) return invoices;
    return invoices.filter((inv) => {
      const lhdnStatus = (inv?.lhdn_status || inv?.lhdnStatus || "").toString().toLowerCase();
      const paymentStatus = (
        inv?.paymentStatus ||
        inv?.payment_status ||
        inv?.status ||
        ""
      )
        .toString()
        .toLowerCase();
      return lhdnStatus === "valid" && ["paid", "partial", "partially paid"].includes(paymentStatus);
    });
  }, [customerInvoices, isRefundToClient]);

  useEffect(() => {
    if (!isRefundToClient || !creditNoteData.sourceInvoice) return;
    const selectable = getFilteredCustomerInvoices();
    const isStillAllowed = selectable.some((inv) => inv._id === creditNoteData.sourceInvoice);
    if (!isStillAllowed) {
      notifyError(
        cn(
          "toasts.refundOnlyLhdnPaidPartial",
          "Refund to Client allows only LHDN-valid invoices with Paid/Partial payment status. Unpaid invoices cannot be refunded."
        )
      );
      applySourceInvoice("");
    }
  }, [isRefundToClient, creditNoteData.sourceInvoice, getFilteredCustomerInvoices]);

  const handleAllowRefundShippingChange = (checked) => {
    setCreditNoteData((prev) => {
      if (!checked) {
        const next = {
          ...prev,
          allowRefundShipping: false,
          shippingCharges: 0,
        };
        const { subtotal, taxTotal, discountAmount, total } =
          recalcTotalsFromItems(next, next.items || []);
        return { ...next, subtotal, taxTotal, discountAmount, total };
      }
      const cap = parseFloat(sourceInvoiceRules?.invoiceShipping) || 0;
      const next = {
        ...prev,
        allowRefundShipping: true,
        ...(cap > 0 && (prev.shippingCharges || 0) <= 0
          ? { shippingCharges: cap }
          : {}),
      };
      const { subtotal, taxTotal, discountAmount, total } =
        recalcTotalsFromItems(next, next.items || []);
      return { ...next, subtotal, taxTotal, discountAmount, total };
    });
  };

  const onSummaryDiscountChange = (value) => {
    setCreditNoteData((prev) => {
      const next = { ...prev, discountPercentage: value };
      const { subtotal, taxTotal, discountAmount, total } =
        recalcTotalsFromItems(next, next.items || []);
      return { ...next, subtotal, taxTotal, discountAmount, total };
    });
  };

  const onSummaryShippingChange = (value) => {
    if (
      canShowShippingCharges &&
      sourceInvoiceRules?.shippingWasOnInvoice &&
      !creditNoteData.allowRefundShipping &&
      value > 0
    ) {
      notifyError(
        cn(
          "toasts.enableShippingFirst",
          "Turn on “Include shipping on this credit note” above before entering a shipping amount."
        )
      );
      return;
    }
    if (
      sourceInvoiceRules &&
      !sourceInvoiceRules.shippingWasOnInvoice &&
      value > 0
    ) {
      notifyError(
        cn(
          "toasts.shippingOnlyIfOnInvoiceAdjust",
          "Shipping is only allowed when the original invoice had shipping. Use adjustment for other corrections."
        )
      );
      return;
    }
    if (
      sourceInvoiceRules?.invoiceShipping != null &&
      value > sourceInvoiceRules.invoiceShipping + 1e-9
    ) {
      notifyError(cn("toasts.shippingExceedsInvoice", "Shipping cannot exceed the linked invoice shipping amount."));
      return;
    }
    setCreditNoteData((prev) => {
      const next = { ...prev, shippingCharges: value };
      const { subtotal, taxTotal, discountAmount, total } =
        recalcTotalsFromItems(next, next.items || []);
      return { ...next, subtotal, taxTotal, discountAmount, total };
    });
  };

  const onSummaryAdjustmentChange = (value) => {
    setCreditNoteData((prev) => {
      const next = { ...prev, adjustment: value };
      const { subtotal, taxTotal, discountAmount, total } =
        recalcTotalsFromItems(next, next.items || []);
      return { ...next, subtotal, taxTotal, discountAmount, total };
    });
  };

  const validateForm = () =>
    validateCreditNoteForm(creditNoteData, sourceInvoiceRules, t);

  const handleSubmit = async (status) => {
    const errors = validateForm();
    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      notifyError(
        errors.reason
          ? cn("validation.reasonRequired", "Please select reason.")
          : cn("toasts.formHasErrors", "Please fix the errors before submitting"),
      );
      return;
    }

    setIsLoading(true);

    try {
      /**
       * API / LHDN: `amount` = line net (after line discount); `tax` = line tax.
       * Document discount % applies to Σ(net+tax) per line (same as customer invoice). Grand total = that sum − discount + shipping + adjustment.
       */
      let taxTotalComputed = 0;
      let grossLinesSum = 0;
      const apiItems = (creditNoteData.items || []).map((item, idx) => {
        const qty = parseFloat(item.quantity) || 0;
        const rate = parseFloat(item.unitPrice) || 0;
        const disc = parseFloat(item.discount) || 0;
        const taxRate = parseFloat(item.taxRate) || 0;
        const lineNet = roundMoney(getLineSubtotal(qty, rate, disc));
        const taxAmt = roundMoney(getLineTaxAmount(lineNet, taxRate));
        taxTotalComputed += taxAmt;
        grossLinesSum += lineNet + taxAmt;
        const row = {
          item_name:
            item.itemName || item.description || `Line ${idx + 1}`,
          description: item.description || "",
          amount: Math.max(0, lineNet),
          notes: "",
          expenseAccount:
            item.expenseAccount || creditNoteData.expenseAccount || undefined,
          quantity: qty,
          rate,
          discount: disc,
          tax: taxAmt,
          taxRate,
          taxId: item.taxId ? String(item.taxId) : "",
          taxName: item.taxName || "",
          tax_class: item.tax_class || "01",
          item: item.itemId || undefined,
        };
        if (item.sourceInvoiceLineIndex != null) {
          row.sourceInvoiceLineIndex = item.sourceInvoiceLineIndex;
        }
        return row;
      });
      taxTotalComputed = roundMoney(taxTotalComputed);
      grossLinesSum = roundMoney(grossLinesSum);
      const discountAmountComputed = roundMoney(
        (grossLinesSum * (parseFloat(creditNoteData.discountPercentage) || 0)) /
          100,
      );
      const shippingAllowed = Boolean(
        sourceInvoiceRules?.shippingWasOnInvoice,
      );
      const shippingComputed =
        shippingAllowed && creditNoteData.allowRefundShipping
          ? roundMoney(creditNoteData.shippingCharges || 0)
          : 0;
      const adjustmentComputed = roundMoney(creditNoteData.adjustment || 0);
      const totalComputed = Math.max(
        0,
        roundMoney(
          grossLinesSum -
            discountAmountComputed +
            shippingComputed +
            adjustmentComputed,
        ),
      );

      const creditNoteDataToSubmit = {
        business: creditNoteData.business,
        entityType: creditNoteData.entityType,
        customer:
          creditNoteData.entityType === "customer"
            ? creditNoteData.customer
            : undefined,
        vendor:
          creditNoteData.entityType === "vendor"
            ? creditNoteData.vendor
            : undefined,
        sourceInvoice:
          creditNoteData.entityType === "customer" &&
          creditNoteData.sourceInvoice
            ? creditNoteData.sourceInvoice
            : undefined,
        /** InvoisPls-style alias for integrations / LHDN */
        invoiceId:
          creditNoteData.entityType === "customer" &&
          creditNoteData.sourceInvoice
            ? creditNoteData.sourceInvoice
            : undefined,
        linkedVendorInvoice:
          creditNoteData.entityType === "vendor" && creditNoteData.vendorInvoice
            ? creditNoteData.vendorInvoice
            : undefined,
        creditNoteType: creditNoteData.creditNoteType,
        creditNoteDate: new Date(creditNoteData.creditNoteDate),
        dueDate: new Date(creditNoteData.dueDate),
        expenseAccount: creditNoteData.expenseAccount,
        paidFromBankAccount:
          creditNoteData.creditNoteType === "refund_to_client"
            ? creditNoteData.paidFromBankAccount
            : undefined,
        refundDate:
          creditNoteData.creditNoteType === "refund_to_client" && creditNoteData.refundDate
            ? new Date(creditNoteData.refundDate)
            : undefined,
        paymentMethod:
          creditNoteData.creditNoteType === "refund_to_client"
            ? creditNoteData.paymentMethod
            : undefined,
        disbursementType:
          creditNoteData.creditNoteType === "refund_to_client" ? "refund" : undefined,
        paymentDirection:
          creditNoteData.creditNoteType === "refund_to_client" ? "out" : undefined,
        createPaymentOutLedgerEntry:
          creditNoteData.creditNoteType === "refund_to_client",
        originalInvoiceUUID:
          creditNoteData.entityType === "customer"
            ? sourceInvoiceRules?.originalInvoiceUUID || undefined
            : undefined,
        items: apiItems,
        subtotal: grossLinesSum,
        taxTotal: taxTotalComputed,
        totalTaxAmount: taxTotalComputed,
        total: totalComputed,
        discountAmount: discountAmountComputed,
        shippingCharges: shippingComputed,
        adjustment: adjustmentComputed,
        currency: creditNoteData.currency,
        terms: creditNoteData.terms,
        notes: creditNoteData.notes,
        reference: creditNoteData.reference,
        reason: creditNoteData.reason,
        reasonDescription:
          (creditNoteData.notes && creditNoteData.notes.trim()) ||
          creditNoteData.reference ||
          "",
        allowRefundShipping:
          creditNoteData.entityType === "customer" &&
          Boolean(creditNoteData.sourceInvoice) &&
          shippingAllowed &&
          Boolean(creditNoteData.allowRefundShipping),
        supportingDocuments: creditNoteData.supportingDocuments,
        status: status,
      };

      const response = await axios.post(
        `${Base_URL}/credit-notes`,
        creditNoteDataToSubmit,
        { headers }
      );

      if (response.data.success) {
        // Show auto-approval message if applicable
        const message = response.data.autoApproved
          ? response.data.message ||
            cn("toasts.createApprovedSuccess", "Credit note created and automatically approved")
          : response.data.message || cn("toasts.createSuccess", "Credit note created successfully!");

        notifySuccess(message);
        if (embedInHub && typeof onHubDone === "function") {
          onHubDone(response.data?.data);
        } else {
          history.push("/credit-notes");
        }
      } else {
        notifyError(cn("toasts.createFailed", "Failed to create credit note"));
      }
    } catch (error) {
      console.error("Error creating credit note:", error);
      notifyError(
        error.response?.data?.message || cn("toasts.createFailed", "Failed to create credit note")
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      notifyError(cn("toasts.invalidFileType", "Please upload only JPEG, PNG, or PDF files"));
      return;
    }

    // Validate file size (5MB limit)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      notifyError(cn("toasts.fileTooLarge", "File size must be less than 5MB"));
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadSuccess(false);

    try {
      // Use the same document upload API as expenses
      const formDataForUpload = new FormData();
      formDataForUpload.append(
        "file_path",
        `CreditNotes/${creditNoteData.creditNoteNumber || Date.now()}`
      );
      formDataForUpload.append("business_id", creditNoteData?.business);
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

        setCreditNoteData((prev) => ({
          ...prev,
          supportingDocuments: [...prev.supportingDocuments, newDocument],
        }));

        setSuccessMessage(
          response.data.message || cn("toasts.fileUploaded", "File uploaded successfully!")
        );
        setUploadSuccess(true);

        setTimeout(() => {
          setUploadSuccess(false);
          setSuccessMessage("");
        }, 3000);
      }
    } catch (error) {
      console.error("File upload error:", error);
      notifyError(cn("toasts.uploadFailed", "File upload failed. Please try again."));
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleOpenFile = async (documentId) => {
    if (!documentId) return;

    try {
      const response = await axios.get(
        `${Base_URL}/documents/getFileWithAllData/${documentId}`
      );
      window.open(response.data.data.url, "_blank");
    } catch (error) {
      notifyError(cn("toasts.openFileFailed", "Error opening file"));
      console.error("Error: ", error);
    }
  };

  const handleRemoveDocument = (index) => {
    setCreditNoteData((prev) => ({
      ...prev,
      supportingDocuments: prev.supportingDocuments.filter(
        (_, i) => i !== index
      ),
    }));
    notifySuccess(cn("toasts.documentRemoved", "Document removed successfully"));
  };

  const isSingleBusiness = isSingleAssignedBusiness();
  const partyLabel =
    creditNoteData.entityType === "customer"
      ? cn("customer", "Customer")
      : cn("vendor", "Vendor");
  const sectionTitle = isSingleBusiness
    ? partyLabel
    : cn("form.businessAndParty", "Business & {{party}}", { party: partyLabel });
  const sectionHint = isSingleBusiness
    ? cn(
        "form.partyHint",
        "Select the party this credit note belongs to. Required fields are marked with *."
      )
    : cn(
        "form.businessAndPartyHint",
        "Select the business and party this credit note belongs to. Required fields are marked with *."
      );
  const awaitingBusinessPlaceholder = isSingleBusiness
    ? cn("form.loading", "Loading…")
    : cn("form.placeholders.selectBusinessFirst", "Select business first");
  const selectCustomerFirstPlaceholder = cn(
    "form.placeholders.selectCustomerFirst",
    "Select customer first"
  );
  const invoiceLinkBlockedPlaceholder = isSingleBusiness
    ? !creditNoteData.customer
      ? selectCustomerFirstPlaceholder
      : awaitingBusinessPlaceholder
    : cn(
        "form.placeholders.selectBusinessAndCustomerFirst",
        "Select business and customer first"
      );
  const vendorBillListHint = isSingleBusiness
    ? cn(
        "form.hints.vendorBillListSingle",
        "Lists vendor bills (all statuses). Lines can be edited after loading."
      )
    : cn(
        "form.hints.vendorBillList",
        "Lists vendor bills for this business (all statuses). Lines can be edited after loading."
      );

  return (
    <div
      className={`bg-gray-50 h-full overflow-y-auto pb-[120px] ${
        embedInHub
          ? "p-0 max-w-none"
          : "p-6 max-h-[90vh]"
      }`}
    >
      <PageHeader
        title={cn("form.createTitle", "Create Credit Note")}
        showBackButton
        backFallbackPath="/credit-notes"
        onBackClick={() => {
          if (embedInHub && typeof onHubCancel === "function") {
            onHubCancel();
          } else {
            history.goBack();
          }
        }}
      />

      {/* Entity type + credit note type — single setup card */}
      <div className="bg-white p-6 sm:p-8 rounded-xl mb-6 border border-gray-200 shadow-sm space-y-8">
        {!hubCustomerOnly && (
          <div>
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-gray-900 tracking-tight">
                {cn("form.creditNoteFor", "Credit Note For")}
              </h2>
              <p className="mt-1 text-sm text-gray-600 max-w-2xl leading-relaxed">
                {cn(
                  "form.creditNoteForHint",
                  "Choose who this credit note applies to — a customer you sell to, or a vendor or supplier you buy from."
                )}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {[
                {
                  value: "customer",
                  label: cn("form.entityCustomer", "Customer"),
                  icon: Users,
                  description: cn("form.entityCustomerDescription", "Credit note for a customer"),
                },
                {
                  value: "vendor",
                  label: cn("form.entityVendorSupplier", "Vendor/Supplier"),
                  icon: Building,
                  description: cn("form.entityVendorDescription", "Credit note for a vendor/supplier"),
                },
              ].map((entityType) => {
                const IconComponent = entityType.icon;
                const selected =
                  creditNoteData.entityType === entityType.value;
                return (
                  <button
                    key={entityType.value}
                    type="button"
                    onClick={() =>
                      setCreditNoteData((prev) => ({
                        ...prev,
                        entityType: entityType.value,
                        customer: "",
                        vendor: "",
                        purchaseOrder: "",
                        allowRefundShipping: false,
                      }))
                    }
                    className={`group relative flex w-full gap-4 rounded-xl border-2 p-4 sm:p-5 text-left transition-all ${
                      selected
                        ? "border-[var(--p-blue)] bg-[#f0fbf7] shadow-sm"
                        : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
                    }`}
                  >
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border ${
                        selected
                          ? "border-[var(--p-blue)]/30 bg-white"
                          : "border-gray-200 bg-gray-50"
                      }`}
                    >
                      <IconComponent
                        size={22}
                        className={
                          selected ? "text-[var(--p-blue)]" : "text-gray-600"
                        }
                        strokeWidth={1.75}
                      />
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex items-start justify-between gap-3">
                        <span
                          className={`text-base font-semibold leading-snug ${
                            selected ? "text-[var(--p-blue)]" : "text-gray-900"
                          }`}
                        >
                          {entityType.label}
                        </span>
                        {selected && (
                          <span
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--p-blue)] text-white"
                            aria-hidden
                          >
                            <Check className="h-3.5 w-3.5" strokeWidth={3} />
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 text-sm text-gray-600 leading-relaxed">
                        {entityType.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div
          className={
            !hubCustomerOnly ? "pt-8 border-t border-gray-100" : undefined
          }
        >
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-gray-900 tracking-tight">
              {cn("form.creditNoteType", "Credit Note Type")}
            </h2>
            <p className="mt-1 text-sm text-gray-600 max-w-2xl leading-relaxed">
              {cn(
                "form.creditNoteTypeHint",
                "Decide whether the credit stays on account for future invoices or is paid out as a refund."
              )}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {[
              {
                value: "apply_to_invoice",
                label: cn("types.applyToInvoice", "Apply to Invoice"),
                icon: FileText,
                description: cn(
                  "types.applyToInvoiceDescription",
                  "Credit amount will be applied to future invoices"
                ),
              },
              {
                value: "refund_to_client",
                label:
                  creditNoteData.entityType === "customer"
                    ? cn("types.refundToClient", "Refund to Client")
                    : cn("types.refundToVendor", "Refund to Vendor"),
                icon: CreditCard,
                description:
                  creditNoteData.entityType === "customer"
                    ? cn(
                        "types.refundToClientDescription",
                        "Credit amount will be refunded to the client"
                      )
                    : cn(
                        "types.refundToVendorDescription",
                        "Credit amount will be refunded to the vendor"
                      ),
              },
            ].map((type) => {
              const IconComponent = type.icon;
              const selected = creditNoteData.creditNoteType === type.value;
              return (
                <button
                  key={type.value}
                  type="button"
                  onClick={() =>
                    setCreditNoteData((prev) => ({
                      ...prev,
                      creditNoteType: type.value,
                    }))
                  }
                  className={`group relative flex w-full gap-4 rounded-xl border-2 p-4 sm:p-5 text-left transition-all ${
                    selected
                      ? "border-[var(--p-blue)] bg-[#f0fbf7] shadow-sm"
                      : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
                  }`}
                >
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border ${
                      selected
                        ? "border-[var(--p-blue)]/30 bg-white"
                        : "border-gray-200 bg-gray-50"
                    }`}
                  >
                    <IconComponent
                      size={22}
                      className={
                        selected ? "text-[var(--p-blue)]" : "text-gray-600"
                      }
                      strokeWidth={1.75}
                    />
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex items-start justify-between gap-3">
                      <span
                        className={`text-base font-semibold leading-snug ${
                          selected ? "text-[var(--p-blue)]" : "text-gray-900"
                        }`}
                      >
                        {type.label}
                      </span>
                      {selected && (
                        <span
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--p-blue)] text-white"
                          aria-hidden
                        >
                          <Check className="h-3.5 w-3.5" strokeWidth={3} />
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-sm text-gray-600 leading-relaxed">
                      {type.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Business and Entity Section */}
      <div className="bg-white border border-gray-200 shadow-sm p-6 sm:p-8 rounded-xl mb-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 tracking-tight flex flex-wrap items-center gap-x-2 gap-y-1">
            {sectionTitle}
            {isLoadingData && (
              <span className="flex items-center gap-2 text-sm font-normal text-[var(--p-blue)]">
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--p-blue)] inline-block" />
                {cn("form.loading", "Loading…")}
              </span>
            )}
          </h2>
          <p className="mt-1 text-sm text-gray-600">{sectionHint}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
          <SingleBusinessField
            selectedValue={creditNoteData.business}
            onAutoSelect={(id) =>
              handleInputChange({ target: { name: "business", value: id } })
            }
          >
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1.5">
              {cn("form.businessRequired", "Business *")}
            </label>
            <SearchableDropdown
              name="business"
              value={creditNoteData.business}
              onChange={handleInputChange}
              placeholder={cn("form.placeholders.selectBusiness", "Select Business")}
              searchPlaceholder={cn("form.placeholders.searchBusinesses", "Search businesses...")}
              options={
                businesses?.map((business) => ({
                  value: business._id,
                  label: business.name,
                  name: business.name,
                  email: business.email,
                })) || []
              }
              searchKeys={["name", "email"]}
              renderOption={(option) => (
                <div>
                  <div className="font-medium">{option.name}</div>
                  {option.email && (
                    <div className="text-xs text-gray-500">{option.email}</div>
                  )}
                </div>
              )}
            />
            {formErrors.business && (
              <div className="text-red-500 text-xs mt-1">
                {formErrors.business}
              </div>
            )}
          </div>
          </SingleBusinessField>

          {creditNoteData.entityType === "customer" ? (
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1.5">
                {cn("form.customerRequired", "Customer *")}
              </label>
              <SearchableDropdown
                name="customer"
                value={creditNoteData.customer}
                onChange={handleInputChange}
                placeholder={
                  isLoadingData
                    ? cn("form.placeholders.loadingCustomers", "Loading customers...")
                    : !creditNoteData.business
                    ? awaitingBusinessPlaceholder
                    : cn("form.placeholders.selectCustomer", "Select Customer")
                }
                searchPlaceholder={cn("form.placeholders.searchCustomers", "Search customers...")}
                disabled={isLoadingData || !creditNoteData.business}
                loading={isLoadingData}
                loadingText={cn("form.placeholders.loadingCustomers", "Loading customers...")}
                options={
                  customers?.map((customer) => ({
                    value: customer._id,
                    label: `${customer?.basicInformation?.primaryContact?.firstName} ${customer?.basicInformation?.primaryContact?.lastName}`,
                    name: `${customer?.basicInformation?.primaryContact?.firstName} ${customer?.basicInformation?.primaryContact?.lastName}`,
                    email: customer?.basicInformation?.primaryContact?.email,
                    company: customer?.basicInformation?.companyName,
                  })) || []
                }
                searchKeys={["name", "email", "company"]}
                renderOption={(option) => (
                  <div>
                    <div className="font-medium">{option.name}</div>
                    {option.email && (
                      <div className="text-xs text-gray-500">
                        {option.email}
                      </div>
                    )}
                    {option.company && (
                      <div className="text-xs text-gray-400">
                        {option.company}
                      </div>
                    )}
                  </div>
                )}
              />
              {formErrors.customer && (
                <div className="text-red-500 text-xs mt-1">
                  {formErrors.customer}
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1.5">
                {cn("form.vendorRequired", "Vendor *")}
              </label>
              <SearchableDropdown
                name="vendor"
                value={creditNoteData.vendor}
                onChange={handleInputChange}
                placeholder={
                  isLoadingData
                    ? cn("form.placeholders.loadingVendors", "Loading vendors...")
                    : !creditNoteData.business
                    ? awaitingBusinessPlaceholder
                    : cn("form.placeholders.selectVendor", "Select Vendor")
                }
                searchPlaceholder={cn("form.placeholders.searchVendors", "Search vendors...")}
                disabled={isLoadingData || !creditNoteData.business}
                loading={isLoadingData}
                loadingText={cn("form.placeholders.loadingVendors", "Loading vendors...")}
                options={
                  scopedVendors?.map((vendor) => ({
                    value: vendor._id,
                    label:
                      vendor?.basicInformation?.vendorDisplayName ||
                      vendor?.basicInformation?.companyName,
                    name:
                      vendor?.basicInformation?.vendorDisplayName ||
                      vendor?.basicInformation?.companyName,
                    email: vendor?.basicInformation?.email,
                    company: vendor?.basicInformation?.companyName,
                  })) || []
                }
                searchKeys={["name", "email", "company"]}
                renderOption={(option) => (
                  <div>
                    <div className="font-medium">{option.name}</div>
                    {option.email && (
                      <div className="text-xs text-gray-500">
                        {option.email}
                      </div>
                    )}
                    {option.company && (
                      <div className="text-xs text-gray-400">
                        {option.company}
                      </div>
                    )}
                  </div>
                )}
              />
              {formErrors.vendor && (
                <div className="text-red-500 text-xs mt-1">
                  {formErrors.vendor}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
          {creditNoteData.entityType === "customer" ? (
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-800 mb-1.5">
                <FileSpreadsheet className="w-4 h-4 shrink-0 text-[var(--p-blue)]" />
                <span>{cn("form.linkCustomerInvoiceOptional", "Link customer invoice (optional)")}</span>
              </label>
              <SearchableDropdown
                name="sourceInvoice"
                value={creditNoteData.sourceInvoice}
                onChange={(e) => {
                  applySourceInvoice(e.target.value);
                }}
                placeholder={
                  loadingInvoices
                    ? cn("form.placeholders.loadingInvoices", "Loading invoices…")
                    : !creditNoteData.business || !creditNoteData.customer
                    ? invoiceLinkBlockedPlaceholder
                    : getFilteredCustomerInvoices().length === 0
                    ? isRefundToClient
                      ? cn(
                          "form.placeholders.noLhdnValidInvoicesForRefund",
                          "No LHDN-valid invoices for refund"
                        )
                      : cn(
                          "form.placeholders.noInvoicesForCustomer",
                          "No invoices for this customer"
                        )
                    : cn(
                        "form.placeholders.chooseInvoiceOrLeaveBlank",
                        "Choose invoice to load lines, or leave blank and add items below"
                      )
                }
                searchPlaceholder={cn(
                  "form.placeholders.searchByInvoiceNumber",
                  "Search by invoice number…"
                )}
                disabled={
                  isLoadingData ||
                  !creditNoteData.business ||
                  !creditNoteData.customer ||
                  loadingInvoices
                }
                loading={loadingInvoices}
                loadingText={cn("form.placeholders.loadingInvoices", "Loading invoices…")}
                clearable={true}
                options={
                  getFilteredCustomerInvoices()?.map((inv) => ({
                    value: inv._id,
                    label: inv.invoice_number || inv._id,
                    invNo: inv.invoice_number,
                    status: inv.status,
                    paymentStatus: inv.paymentStatus || inv.payment_status || inv.status,
                    lhdn: inv.lhdn_status,
                    remaining:
                      CustomerInvoiceServices.calculateRemainingAmount(inv),
                    grandTotal: inv.grandTotal,
                  })) || []
                }
                searchKeys={["invNo", "status", "lhdn"]}
                renderOption={(option) => (
                  <div>
                    <div className="font-medium">{option.invNo}</div>
                    <div className="text-xs text-gray-500">
                      LHDN {option.lhdn || "—"}
                      {option.status ? ` · ${option.status}` : ""}
                      {option.paymentStatus
                        ? ` · Payment ${option.paymentStatus}`
                        : ""}
                      {option.remaining != null
                        ? ` · Remaining ${formatAmount(option.remaining)}`
                        : ""}
                    </div>
                  </div>
                )}
              />
              <p className="text-xs text-gray-500 mt-1.5">
                {isRefundToClient
                  ? cn(
                      "form.hints.refundInvoiceLink",
                      "Optional for standalone refunds. When linked: only paid or partially paid LHDN-valid e‑Invoices qualify."
                    )
                  : cn(
                      "form.hints.applyInvoiceLink",
                      "Link an invoice to import its lines, or leave blank — use the item table below with catalog rows, bulk add, or custom lines."
                    )}
              </p>
              {formErrors.sourceInvoice && (
                <div className="text-red-500 text-xs mt-1">
                  {formErrors.sourceInvoice}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1.5">
                  {cn("form.vendorBillOptional", "Vendor bill (optional)")}
                </label>
                <SearchableDropdown
                  name="vendorInvoice"
                  value={creditNoteData.vendorInvoice}
                  onChange={(e) => applyVendorInvoice(e.target.value)}
                  placeholder={
                    loadingVendorInvoices
                      ? cn("form.placeholders.loadingVendorBills", "Loading vendor bills…")
                      : !creditNoteData.business
                      ? awaitingBusinessPlaceholder
                      : !creditNoteData.vendor
                      ? cn("form.placeholders.selectVendorFirst", "Select vendor first")
                      : vendorInvoicesForSelectedVendor().length === 0
                      ? cn("form.placeholders.noVendorBills", "No vendor bills for this vendor")
                      : cn("form.placeholders.chooseBillToLoad", "Choose bill to load line items")
                  }
                  searchPlaceholder={cn(
                    "form.placeholders.searchByInvoiceNumber",
                    "Search by invoice number…"
                  )}
                  disabled={
                    isLoadingData ||
                    !creditNoteData.business ||
                    !creditNoteData.vendor ||
                    loadingVendorInvoices
                  }
                  loading={loadingVendorInvoices}
                  loadingText={cn("form.placeholders.loadingVendorBills", "Loading vendor bills…")}
                  clearable={true}
                  options={vendorInvoicesForSelectedVendor().map((inv) => ({
                    value: inv._id,
                    label: inv.invoiceNumber || inv._id,
                    invNo: inv.invoiceNumber,
                    status: inv.status,
                    total: inv.total,
                    currency: inv.currency,
                  }))}
                  searchKeys={["invNo", "status"]}
                  renderOption={(option) => (
                    <div>
                      <div className="font-medium">{option.invNo}</div>
                      <div className="text-xs text-gray-500">
                        {option.status ? `${option.status}` : ""}
                        {option.total != null
                          ? ` · ${formatCurrencyAmount(option.currency, option.total)}`
                          : ""}
                      </div>
                    </div>
                  )}
                />
                <p className="text-xs text-gray-500 mt-1.5">{vendorBillListHint}</p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1.5">
              {cn("form.expenseAccountRequired", "Expense Account *")}
            </label>
            <SearchableDropdown
              name="expenseAccount"
              value={creditNoteData.expenseAccount}
              onChange={handleInputChange}
              placeholder={
                isLoadingData
                  ? cn("form.placeholders.loadingAccounts", "Loading accounts...")
                  : !creditNoteData.business
                  ? awaitingBusinessPlaceholder
                  : cn("form.placeholders.selectExpenseAccount", "Select Expense Account")
              }
              searchPlaceholder={cn(
                "form.placeholders.searchExpenseAccounts",
                "Search expense accounts..."
              )}
              disabled={isLoadingData || !creditNoteData.business}
              loading={isLoadingData}
              loadingText={cn("form.placeholders.loadingAccounts", "Loading accounts...")}
              options={
                expenseAccounts?.map((account) => ({
                  value: account._id,
                  label: `${account.code || "N/A"} - ${account.accountName} (${
                    account.accountType?.name
                  })`,
                  name: account.accountName,
                  type: account.accountType?.name,
                  code: account.code || "N/A",
                })) || []
              }
              searchKeys={["name", "type", "code"]}
              renderOption={(option) => (
                <div>
                  <div className="font-medium">
                    {option.code} - {option.name}
                  </div>
                  <div className="text-xs text-gray-500">{option.type}</div>
                </div>
              )}
            />
            {formErrors.expenseAccount && (
              <div className="text-red-500 text-xs mt-1">
                {formErrors.expenseAccount}
              </div>
            )}
          </div>
        </div>

        {creditNoteData.creditNoteType === "refund_to_client" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1.5">
                {cn("form.payFromBankAccountRequired", "Pay From Bank Account *")}
              </label>
              <SearchableDropdown
                name="paidFromBankAccount"
                value={creditNoteData.paidFromBankAccount}
                onChange={handleInputChange}
                placeholder={
                  isLoadingData
                    ? cn("form.placeholders.loadingBankAccounts", "Loading bank accounts...")
                    : !creditNoteData.business
                    ? awaitingBusinessPlaceholder
                    : cn("form.placeholders.selectBankAccount", "Select Bank Account")
                }
                searchPlaceholder={cn(
                  "form.placeholders.searchBankAccounts",
                  "Search bank accounts..."
                )}
                disabled={isLoadingData || !creditNoteData.business}
                loading={isLoadingData}
                loadingText={cn(
                  "form.placeholders.loadingBankAccounts",
                  "Loading bank accounts..."
                )}
                options={
                  bankAccounts?.map((account) => ({
                    value: account._id,
                    label: `${account.accountName} - ${account.bankName} (${
                      account.currencyType
                    } ${(account.openingBalance || 0).toFixed(2)})`,
                    name: account.accountName,
                    bank: account.bankName,
                    currency: account.currencyType,
                    balance: account.openingBalance || 0,
                  })) || []
                }
                searchKeys={["name", "bank", "currency"]}
                renderOption={(option) => (
                  <div>
                    <div className="font-medium">{option.name}</div>
                    <div className="text-xs text-gray-500">
                      {option.bank} - {option.currency}{" "}
                      {option.balance.toFixed(2)}
                    </div>
                  </div>
                )}
              />
              {formErrors.paidFromBankAccount && (
                <div className="text-red-500 text-xs mt-1">
                  {formErrors.paidFromBankAccount}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1.5">
                {cn("form.refundDateRequired", "Refund Date *")}
              </label>
              <div className="relative">
                <CustomDatePicker
                  value={creditNoteData.refundDate}
                  onChange={(date) =>
                    setCreditNoteData((prev) => ({ ...prev, refundDate: date }))
                  }
                  bgColor="#FFFFFF"
                />
                <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                  <Calendar className="h-5 w-5 text-gray-400" />
                </div>
              </div>
              {formErrors.refundDate && (
                <div className="text-red-500 text-xs mt-1">{formErrors.refundDate}</div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1.5">
                {cn("form.paymentMethodRequired", "Payment Method *")}
              </label>
              <SearchableDropdown
                name="paymentMethod"
                value={creditNoteData.paymentMethod}
                onChange={handleInputChange}
                placeholder={cn("form.placeholders.selectPaymentMethod", "Select payment method")}
                searchPlaceholder={cn(
                  "form.placeholders.searchPaymentMethods",
                  "Search payment methods..."
                )}
                disabled={isLoadingData || !creditNoteData.business}
                options={(paymentMethods || []).map((pm) => ({
                  value: pm._id,
                  label: pm.name || pm.paymentMethodName || "Payment Method",
                  name: pm.name || pm.paymentMethodName || "Payment Method",
                  type: pm.type || "",
                }))}
                searchKeys={["name", "type"]}
                renderOption={(option) => (
                  <div>
                    <div className="font-medium">{option.name}</div>
                    {option.type && (
                      <div className="text-xs text-gray-500">{option.type}</div>
                    )}
                  </div>
                )}
              />
              {formErrors.paymentMethod && (
                <div className="text-red-500 text-xs mt-1">{formErrors.paymentMethod}</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Credit Note Details */}
      <div className="bg-white p-6 sm:p-8 rounded-xl mb-6 border border-gray-200 shadow-sm">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 tracking-tight">
            {cn("form.creditNoteDetails", "Credit Note Details")}
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            {cn(
              "form.creditNoteDetailsHint",
              "Dates, currency, reference, and notes for this document."
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-5">
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1.5">
              {cn("form.creditNoteDate", "Credit Note Date")}
            </label>
            <div className="relative">
              <CustomDatePicker
                value={creditNoteData.creditNoteDate}
                onChange={(date) =>
                  setCreditNoteData({ ...creditNoteData, creditNoteDate: date })
                }
                bgColor="#FFFFFF"
              />
              <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                <Calendar className="h-5 w-5 text-gray-400" />
              </div>
            </div>
            {formErrors.creditNoteDate && (
              <div className="text-red-500 text-xs mt-1">
                {formErrors.creditNoteDate}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1.5">
              {cn("form.dueDate", "Due Date")}
            </label>
            <div className="relative">
              <CustomDatePicker
                value={creditNoteData.dueDate}
                onChange={(date) =>
                  setCreditNoteData({ ...creditNoteData, dueDate: date })
                }
                bgColor="#FFFFFF"
              />
              <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                <Calendar className="h-5 w-5 text-gray-400" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1.5">
              {cn("form.currency", "Currency")}
            </label>
            <SearchableDropdown
              name="currency"
              value={creditNoteData.currency}
              onChange={handleInputChange}
              placeholder={cn("form.placeholders.selectCurrency", "Select Currency")}
              searchPlaceholder={cn("form.placeholders.searchCurrencies", "Search currencies...")}
              options={currencyOptions.map((currency) => ({
                value: currency.value,
                label: currency.label,
                symbol: currency.value,
                prefix: currency.label.split("(")[1]?.replace(")", "") || "",
                rate: currency.conversionRate,
              }))}
              searchKeys={["symbol", "prefix"]}
              renderOption={(option) => (
                <div>
                  <div className="font-medium">{option.symbol}</div>
                  <div className="text-xs text-gray-500">{option.prefix}</div>
                </div>
              )}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1.5">
              {cn("form.referenceRequired", "Reference *")}
            </label>
            <input
              type="text"
              name="reference"
              value={creditNoteData.reference}
              onChange={handleInputChange}
              placeholder={cn("form.placeholders.referenceNumber", "Reference number")}
              className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] ${
                formErrors.reference ? "border-red-500" : "border-gray-300"
              }`}
            />
            {formErrors.reference && (
              <div className="text-red-500 text-xs mt-1">
                {formErrors.reference}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
          {creditNoteData.entityType === "customer" && (
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1.5">
                {cn("form.reason", "Reason")}
                {requiresLhdnCreditReasonFields ? (
                  <span className="text-red-500 ml-0.5" aria-hidden>
                    *
                  </span>
                ) : (
                  <span className="text-gray-500 font-normal ml-1">
                    {cn(
                      "form.reasonRequiredForLhdn",
                      "(required for linked LHDN e‑Invoice)"
                    )}
                  </span>
                )}
              </label>
              <select
                name="reason"
                value={creditNoteData.reason}
                onChange={handleInputChange}
                required={requiresLhdnCreditReasonFields}
                aria-required={requiresLhdnCreditReasonFields}
                className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] bg-white ${
                  formErrors.reason ? "border-red-500" : "border-gray-300"
                }`}
              >
                <option value="">{cn("form.selectReason", "Select reason")}</option>
                {reasonOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {formErrors.reason && (
                <div className="text-red-500 text-xs mt-1">
                  {formErrors.reason}
                </div>
              )}
              
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1.5">
              {cn("form.paymentTerms", "Payment Terms")}
            </label>
            <input
              type="text"
              name="terms"
              value={creditNoteData.terms}
              onChange={handleInputChange}
              placeholder={cn("form.placeholders.enterPaymentTerms", "Enter payment terms")}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1.5">
              {cn("form.notes", "Notes")}
            </label>
            <textarea
              name="notes"
              value={creditNoteData.notes}
              onChange={handleInputChange}
              placeholder={cn("form.placeholders.additionalNotes", "Additional notes")}
              className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] resize-none ${
                formErrors.notes ? "border-red-500" : "border-gray-300"
              }`}
              rows="3"
            />
            {formErrors.notes && (
              <div className="text-red-500 text-xs mt-1">
                {formErrors.notes}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Line items — same table pattern as customer invoice */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-6 mb-6 space-y-6">
        <h2 className="text-lg font-semibold text-gray-900">{cn("form.lineItems", "Line items")}</h2>

        <ZohoStyleItemTable
          invoiceData={creditNoteData}
          setInvoiceData={setCreditNoteData}
          selectedContract={null}
          expenseAccounts={expenseAccounts}
          currency={creditNoteData.currency || "USD"}
          errors={formErrors}
          businessItems={businessItems}
          taxes={taxes}
          onItemChange={handleLineItemChange}
          businessId={creditNoteData.business}
          headers={headers}
          lineItemCustomFieldDefinitions={lineItemCustomFieldDefs}
          isEditMode={true}
          pricingMode={
            creditNoteData.entityType === "vendor" ? "purchase" : "sales"
          }
          onBulkAdd={() => setShowBulkAddItemsModal(true)}
          onTaxCreated={(newTax) => {
            if (!newTax?._id) return;
            setTaxes((prev) =>
              prev.some((t) => String(t._id) === String(newTax._id))
                ? prev
                : [...prev, newTax]
            );
          }}
        />

        {creditNoteData.items && creditNoteData.items.length > 0 && (
          <div className="pt-2 max-w-xl space-y-3">
            {canShowShippingCharges && (
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-[var(--p-blue)] focus:ring-[var(--p-blue)]"
                  checked={Boolean(creditNoteData.allowRefundShipping)}
                  onChange={(ev) =>
                    handleAllowRefundShippingChange(ev.target.checked)
                  }
                />
                <span>
                  {cn(
                    "form.includeShipping",
                    "Include shipping on this credit note. You can refund up to the amount on the source document."
                  )}
                </span>
              </label>
            )}
            <InvoiceSummaryPanel
              invoiceData={creditNoteData}
              onDiscountChange={onSummaryDiscountChange}
              onShippingChange={onSummaryShippingChange}
              onAdjustmentChange={onSummaryAdjustmentChange}
              currency={creditNoteData.currency || "USD"}
              title={cn("form.creditNoteSummary", "Credit note summary")}
              showShipping={showShippingLineInSummary}
            />
            {formErrors.shippingCharges && (
              <p className="text-red-600 text-sm mt-2">
                {formErrors.shippingCharges}
              </p>
            )}
            {formErrors.total && (
              <p className="text-red-600 text-sm mt-2">
                {formErrors.total}
              </p>
            )}
          </div>
        )}

        {formErrors.items && (
          <div className="text-red-500 text-sm">{formErrors.items}</div>
        )}
      </div>

      <BulkAddItemsModal
        isOpen={showBulkAddItemsModal}
        onClose={() => setShowBulkAddItemsModal(false)}
        items={businessItems}
        onAddItems={handleBulkAddItemsForCreditNote}
        currency={creditNoteData.currency || "USD"}
        pricingMode={
          creditNoteData.entityType === "vendor" ? "purchase" : "sales"
        }
      />

      {/* Supporting Documents */}
      <div className="bg-white p-6 rounded-lg mb-6 shadow-sm">
        <h2 className="text-lg font-medium mb-4 text-gray-800">
          {cn("form.supportingDocuments", "Supporting Documents")}
        </h2>

        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
          {creditNoteData.supportingDocuments.length > 0 ? (
            <div className="space-y-3">
              {creditNoteData.supportingDocuments.map((doc, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between bg-gray-50 p-3 rounded-lg"
                >
                  <div className="flex items-center">
                    <FileText className="h-6 w-6 text-[var(--p-blue)] mr-3" />
                    <div>
                      <p className="font-medium text-gray-800">{doc.name}</p>
                      <p className="text-sm text-gray-500">
                        {(doc.size / 1024 / 1024)?.toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleOpenFile(doc.fileId)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => handleRemoveDocument(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center">
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <div className="mt-4">
                <label htmlFor="file-upload" className="cursor-pointer">
                  <span className="mt-2 block text-sm font-medium text-gray-900">
                    {cn("form.uploadSupportingDocuments", "Upload supporting documents")}
                  </span>
                  <span className="text-sm text-gray-500">
                    {cn("form.uploadHint", "PDF, PNG, JPG up to 5MB")}
                  </span>
                </label>
                <input
                  id="file-upload"
                  name="file-upload"
                  type="file"
                  className="sr-only"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleFileChange}
                  ref={fileInputRef}
                />
              </div>
            </div>
          )}

          {creditNoteData.supportingDocuments.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <label
                htmlFor="additional-file-upload"
                className="cursor-pointer"
              >
                <span className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                  <Upload className="mr-2 h-4 w-4" />
                  {cn("actions.addMoreDocuments", "Add More Documents")}
                </span>
              </label>
              <input
                id="additional-file-upload"
                name="additional-file-upload"
                type="file"
                className="sr-only"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleFileChange}
              />
            </div>
          )}

          {uploading && (
            <div className="mt-4">
              <div className="bg-gray-200 rounded-full h-2">
                <div
                  className="bg-[var(--p-blue)] h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                {cn("detail.uploadingProgress", "Uploading... {{progress}}%", {
                  progress: uploadProgress,
                })}
              </p>
            </div>
          )}

          {uploadSuccess && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-800">{successMessage}</p>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-4">
        <button
          type="button"
          onClick={() => handleSubmit("Draft")}
          disabled={isLoading}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          {cn("actions.saveAsDraft", "Save as Draft")}
        </button>
        <button
          type="button"
          onClick={() => handleSubmit("Created")}
          disabled={isLoading}
          className="px-6 py-2 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[#9CBA33] disabled:opacity-50"
        >
          {isLoading
            ? cn("actions.creating", "Creating...")
            : cn("actions.createCreditNote", "Create Credit Note")}
        </button>
      </div>

    </div>
  );
};

export default CreateCreditNote;
