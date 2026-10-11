import React, {
  useState,
  useEffect,
  useRef,
  useContext,
  useMemo,
  useCallback,
} from "react";
import {
  Calendar,
  Upload,
  ArrowLeft,
  FileText,
  Eye,
  Trash2,
  Users,
  Building,
  Save,
  FileSpreadsheet,
  Check,
} from "lucide-react";
import axios from "axios";
import { useHistory, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { notifyError, notifySuccess } from "@/utils/toast";
import { makeDebitNoteT } from "@/utils/creditDebitNoteI18n";
import { AdminContext } from "@/context/AdminContext";
import CustomDatePicker from "@/components/CustomDatePicker";
import SearchableDropdown from "@/components/SearchableDropdown";
import { isSingleAssignedBusiness } from "@/utils/sessionAssignedBusinesses";
import CustomerInvoiceServices from "@/services/CustomerInvoiceServices";
import ZohoStyleItemTable from "@/components/invoice/ZohoStyleItemTable";
import InvoiceSummaryPanel from "@/components/invoice/InvoiceSummaryPanel";
import { formatCurrencyAmount } from "@/components/formatAmount";
import { fetchLineItemCustomFieldDefinitions } from "@/services/customFieldServices";
import {
  clampDiscountPercent,
  getItemTotal,
  getLineSubtotal,
  getLineTaxAmount,
  roundMoney,
} from "@/utils/itemDiscountUtils";
import {
  getDebitNoteReasonOptions,
  normalizeDebitNoteReason,
  validateDebitNoteForm,
} from "@/utils/debitNoteFormValidation";
import BulkAddItemsModal from "@/components/customer-invoices/BulkAddItemsModal";

const UpdateDebitNote = ({
  embedInHub = false,
  embedNoteId = null,
  onHubDone,
  onHubCancel,
  hubCustomerOnly = false,
} = {}) => {
  const { t } = useTranslation();
  const dn = makeDebitNoteT(t);
  const reasonOptions = useMemo(() => getDebitNoteReasonOptions(t), [t]);
  const history = useHistory();
  const { id: routeId } = useParams();
  const id = embedNoteId || routeId;
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
  const [isLoadingDebitNote, setIsLoadingDebitNote] = useState(true);

  const [businesses, setBusinesses] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [vendorInvoices, setVendorInvoices] = useState([]);
  const [customerInvoices, setCustomerInvoices] = useState([]);
  const [expenseAccounts, setExpenseAccounts] = useState([]);
  const [salesContracts, setSalesContracts] = useState([]);
  const [purchaseContracts, setPurchaseContracts] = useState([]);

  // const {
  //   data: currencies,
  //   loading,
  //   error,
  // } = useAsync(CurrencyServices.getAllCurrency);

  const [currencies, setCurrencies] = useState([]);

  const [businessItems, setBusinessItems] = useState([]);
  const [taxes, setTaxes] = useState([]);
  const [lineItemCustomFieldDefs, setLineItemCustomFieldDefs] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [customerInvoicesLhdn, setCustomerInvoicesLhdn] = useState([]);
  const [sourceInvoiceRules, setSourceInvoiceRules] = useState(null);

  // Form data state
  const [debitNoteData, setDebitNoteData] = useState({
    business: "",
    entityType: "vendor", // Default to vendor for backward compatibility
    vendor: "",
    customer: "",
    vendorInvoice: "",
    customerInvoice: "",
    debitNoteDate: formatDateForInput(new Date()),
    expenseAccount: "",
    items: [],
    subtotal: 0,
    discountPercentage: 0,
    discountAmount: 0,
    shippingCharges: 0,
    adjustment: 0,
    taxTotal: 0,
    total: 0,
    currency: "USD",
    notes: "",
    reference: "",
    reason: "",
    supportingDocuments: [],
    status: "Draft",
  });

  const [formErrors, setFormErrors] = useState({});
  const [showBulkAddItemsModal, setShowBulkAddItemsModal] = useState(false);

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

  const recalcDebitTotalsFromItems = useCallback((prev, items) => {
    const subtotal = (items || []).reduce(
      (sum, item) => sum + (item.total || 0),
      0
    );
    const taxTotal = (items || []).reduce((sum, item) => {
      const lineSub = getLineSubtotal(
        item.quantity,
        item.unitPrice,
        item.discount
      );
      return sum + getLineTaxAmount(lineSub, item.taxRate);
    }, 0);
    const discountAmount = (subtotal * (prev?.discountPercentage || 0)) / 100;
    const total = Math.max(
      0,
      subtotal -
        discountAmount +
        (prev?.shippingCharges || 0) +
        (prev?.adjustment || 0),
    );
    return { subtotal, taxTotal, discountAmount, total };
  }, []);

  const sanitizeRowForDebit = useCallback((row, fieldChanged) => {
    let r = { ...row };
    const hasSource = r.sourceInvoiceLineIndex != null;
    const enforceMyInvoisLineGuards =
      sourceInvoiceRules?.isLhdnLinkedCustomerInvoice === true;

    if (hasSource && enforceMyInvoisLineGuards) {
      const origId = String(r._cnAllowedTaxId || "");
      const origRate = parseFloat(r._cnAllowedTaxRate) || 0;
      const hadNoTax = !origId && origRate === 0;
      const taxFields = ["taxId", "taxRate", "taxName", "itemId"];

      if (!hadNoTax) {
        if (origId) {
          if (String(r.taxId || "") !== origId) {
            if (taxFields.includes(fieldChanged)) {
              notifyError(dn("toasts.taxMustMatchInvoice", "Tax type must match the original invoice line."));
            }
            r.taxId = origId;
            r.taxRate = origRate;
            if (r._cnAllowedTaxName) r.taxName = r._cnAllowedTaxName;
          }
        } else if (Math.abs((parseFloat(r.taxRate) || 0) - origRate) > 0.02) {
          if (taxFields.includes(fieldChanged)) {
            notifyError(
              dn(
                "toasts.taxRateMustMatchInvoice",
                "Tax rate must match the original invoice line ({{rate}}%).",
                { rate: origRate },
              ),
            );
          }
          r.taxRate = origRate;
        }
      }
    }

    const quantity = parseFloat(r.quantity) || 1;
    const unitPrice = parseFloat(r.unitPrice) || 0;
    const discount = parseFloat(r.discount) || 0;
    const taxRate = parseFloat(r.taxRate) || 0;
    r.total = getItemTotal(quantity, unitPrice, discount, taxRate);
    return r;
  }, [sourceInvoiceRules?.isLhdnLinkedCustomerInvoice]);

  const handleBulkAddItemsForDebitNote = useCallback(
    (newItems) => {
      if (!newItems || newItems.length === 0) return;
      setDebitNoteData((prev) => {
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
              String(it.itemId || "") === String(itemId),
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
          sanitizeRowForDebit({ ...row }, "quantity"),
        );
        const { subtotal, taxTotal, discountAmount, total } =
          recalcDebitTotalsFromItems(prev, processed);
        return {
          ...prev,
          items: processed,
          subtotal,
          taxTotal,
          discountAmount,
          total,
        };
      });
      notifySuccess(dn("toasts.itemsAdded", "{{count}} item(s) added", { count: newItems.length }));
    },
    [recalcDebitTotalsFromItems, sanitizeRowForDebit],
  );

  const mapDebitNoteItemsFromApi = (rawItems) => {
    return (rawItems || []).map((item, idx) => {
      const expenseAccount =
        item.expenseAccount?._id || item.expenseAccount || null;
      const itemIdRaw =
        item.item ??
        item.itemId ??
        item.item_id ??
        item.product ??
        item.productId;
      const itemId =
        itemIdRaw && typeof itemIdRaw === "object" ? itemIdRaw._id : itemIdRaw;
      const qtyRaw = parseFloat(item.quantity ?? item.qty);
      const quantity = Number.isFinite(qtyRaw) && qtyRaw > 0 ? qtyRaw : 1;
      const rateRaw = parseFloat(item.rate ?? item.unitPrice);
      const amount = parseFloat(item.amount ?? item.total) || 0;
      const unitPrice = Number.isFinite(rateRaw) ? rateRaw : amount / quantity;
      const discount = parseFloat(item.discount) || 0;
      const taxRate = parseFloat(item.taxRate ?? item.tax_rate) || 0;
      const taxIdRaw = item.taxId ?? item.tax_id ?? "";
      const taxIdStr = taxIdRaw != null ? String(taxIdRaw) : "";
      const srcIdx = item.sourceInvoiceLineIndex;
      const row = {
        id: idx + 1,
        quantity,
        unitPrice,
        discount,
        taxRate,
        taxId: taxIdStr,
        taxName: item.taxName || "",
        tax_class: item.tax_class || "01",
        itemName:
          item.item_name ||
          item.itemName ||
          item.name ||
          item.description ||
          `Line ${idx + 1}`,
        description: item.description || "",
        item: item.item_name || item.itemName || item.name || "",
        itemId: itemId || undefined,
        expenseAccount,
        lineItemCustomFields:
          item.lineItemCustomFields &&
          typeof item.lineItemCustomFields === "object"
            ? { ...item.lineItemCustomFields }
            : {},
      };
      if (srcIdx != null) {
        row.sourceInvoiceLineIndex = srcIdx;
        row._cnAllowedTaxId = taxIdStr;
        row._cnAllowedTaxRate = taxRate;
        row._cnAllowedTaxName = item.taxName || "";
      }
      row.total = getItemTotal(
        row.quantity,
        row.unitPrice,
        row.discount,
        row.taxRate,
      );
      return row;
    });
  };

  useEffect(() => {
    if (id) {
      fetchDebitNote();
    }
  }, [id]);

  useEffect(() => {
    if (!debitNoteData?.business) {
      setCurrencies([]);
      return;
    }
    let cancelled = false;
    const fetchCurrencies = async () => {
      try {
        const response = await axios.get(
          `${Base_URL}/finance/currencies?business_id=${debitNoteData.business}`,
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
  }, [debitNoteData.business, Base_URL]);

  /** Business base currency only (same as credit notes / invoices). */
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
    if (!debitNoteData.business || !baseCurrencyRow) return;
    const sym =
      String(
        baseCurrencyRow.symbol ||
          baseCurrencyRow.prefix ||
          baseCurrencyRow.name ||
          "MYR",
      ).trim() || "MYR";
    setDebitNoteData((prev) =>
      prev.currency === sym ? prev : { ...prev, currency: sym },
    );
  }, [debitNoteData.business, baseCurrencyRow]);

  const vendorInvoicesForSelectedVendor = useMemo(() => {
    if (!debitNoteData.vendor) return vendorInvoices || [];
    return (vendorInvoices || []).filter(
      (inv) =>
        String(inv.vendor?._id || inv.vendor || "") ===
        String(debitNoteData.vendor)
    );
  }, [vendorInvoices, debitNoteData.vendor]);

  const linkedCustomerInvoice = useMemo(() => {
    if (!debitNoteData.customerInvoice) return null;
    return (customerInvoices || []).find(
      (invoice) =>
        String(invoice?._id) === String(debitNoteData.customerInvoice),
    );
  }, [customerInvoices, debitNoteData.customerInvoice]);

  const linkedVendorInvoice = useMemo(() => {
    if (!debitNoteData.vendorInvoice) return null;
    return (vendorInvoices || []).find(
      (inv) => String(inv?._id) === String(debitNoteData.vendorInvoice),
    );
  }, [vendorInvoices, debitNoteData.vendorInvoice]);

  useEffect(() => {
    if (
      debitNoteData.entityType === "customer" &&
      debitNoteData.customerInvoice
    ) {
      const inv = linkedCustomerInvoice;
      if (!inv) {
        setSourceInvoiceRules(null);
        return;
      }
      const invoiceDate =
        inv.invoice_date ||
        inv.invoiceDate ||
        inv.date ||
        inv.createdAt ||
        null;
      const isLhdn = CustomerInvoiceServices.isLhdnStatusValid(inv);
      const invId = String(debitNoteData.customerInvoice);
      setSourceInvoiceRules((prev) => {
        if (
          prev?.invoiceRulesFromDetailFetch &&
          String(prev._invoiceId) === invId
        ) {
          return {
            ...prev,
            invoiceDate,
            isLhdnLinkedCustomerInvoice: isLhdn,
          };
        }
        return {
          invoiceDate,
          isLhdnLinkedCustomerInvoice: isLhdn,
          _invoiceId: invId,
        };
      });
      return;
    }
    if (
      debitNoteData.entityType === "vendor" &&
      debitNoteData.vendorInvoice &&
      linkedVendorInvoice
    ) {
      const inv = linkedVendorInvoice;
      const invTotal = parseFloat(inv.total) || 0;
      const st = (inv.status || "").toString().trim().toLowerCase();
      setSourceInvoiceRules({
        isVendorSource: true,
        shippingWasOnInvoice: (parseFloat(inv.shipping) || 0) > 0,
        invoiceShipping: parseFloat(inv.shipping) || 0,
        invoiceTotal: invTotal,
        invoiceDate: inv.invoiceDate || inv.createdAt || null,
        invoicePaymentStatus: st,
        invoicePaidAmount: st === "paid" ? invTotal : null,
      });
      return;
    }
    setSourceInvoiceRules(null);
  }, [
    debitNoteData.entityType,
    debitNoteData.customerInvoice,
    debitNoteData.vendorInvoice,
    linkedCustomerInvoice,
    linkedVendorInvoice,
  ]);

  const requiresLhdnDebitReasonFields =
    debitNoteData.entityType === "customer" &&
    Boolean(debitNoteData.customerInvoice) &&
    sourceInvoiceRules?.isLhdnLinkedCustomerInvoice === true;

  useEffect(() => {
    if (
      debitNoteData.entityType !== "customer" ||
      !debitNoteData.business ||
      !debitNoteData.customer
    ) {
      setCustomerInvoicesLhdn([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingInvoices(true);
      try {
        const res = await axios.get(`${Base_URL}/proforma-invoice`, {
          headers,
          params: {
            businessId: debitNoteData.business,
            customerId: debitNoteData.customer,
            module: "customer-invoices",
            limit: 200,
            page: 1,
          },
        });
        const list = res.data?.data || [];
        const arr = Array.isArray(list) ? list : [];
        if (!cancelled) {
          const selId = debitNoteData.customerInvoice;
          let merged = arr;
          if (
            selId &&
            !merged.some((i) => String(i._id) === String(selId))
          ) {
            const hit = arr.find((i) => String(i._id) === String(selId));
            if (hit) merged = [hit, ...merged];
          }
          setCustomerInvoicesLhdn(merged);
        }
      } catch (e) {
        if (!cancelled) setCustomerInvoicesLhdn([]);
      } finally {
        if (!cancelled) setLoadingInvoices(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    debitNoteData.entityType,
    debitNoteData.business,
    debitNoteData.customer,
    debitNoteData.customerInvoice,
  ]);

  useEffect(() => {
    const bid = debitNoteData.business;
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
              debitNoteData.entityType === "vendor"
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
  }, [debitNoteData.business, debitNoteData.entityType, adminInfo?.token]);

  useEffect(() => {
    if (!debitNoteData.business) {
      setBusinessItems([]);
      return;
    }
    const fetchItems = async () => {
      try {
        const response = await axios.get(`${Base_URL}/items`, {
          params: {
            businessId: debitNoteData.business,
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
  }, [debitNoteData.business, Base_URL]);

  useEffect(() => {
    if (!debitNoteData.business) {
      setTaxes([]);
      return;
    }
    axios
      .get(`${Base_URL}/taxes?business=${debitNoteData.business}`)
      .then((res) => setTaxes(res.data || []))
      .catch(() => setTaxes([]));
  }, [debitNoteData.business, Base_URL]);

  useEffect(() => {
    fetchData();
  }, [debitNoteData.business]);

  const fetchDebitNote = async () => {
    if (!id) return;
    setIsLoadingDebitNote(true);
    try {
      const response = await axios.get(`${Base_URL}/debit-notes/${id}`, {
        headers,
      });

      if (response.data.success) {
        const debitNote = response.data.data;
        const items = mapDebitNoteItemsFromApi(debitNote.items);
        const discountPercentage =
          parseFloat(debitNote.discountPercentage) || 0;
        const shippingCharges =
          parseFloat(debitNote.shippingCharges) || 0;
        const adjustment = parseFloat(debitNote.adjustment) || 0;
        const parsedDebitNoteDate = new Date(debitNote.debitNoteDate);
        const safeDebitNoteDate = Number.isNaN(parsedDebitNoteDate.getTime())
          ? new Date()
          : parsedDebitNoteDate;
        const base = {
          business: String(debitNote.business?._id || debitNote.business || ""),
          entityType: debitNote.entityType || "vendor",
          vendor: String(debitNote.vendor?._id || debitNote.vendor || ""),
          customer: String(debitNote.customer?._id || debitNote.customer || ""),
          vendorInvoice:
            String(
              debitNote.vendorInvoice?._id || debitNote.vendorInvoice || ""
            ),
          customerInvoice:
            String(
              debitNote.customerInvoice?._id || debitNote.customerInvoice || ""
            ),
          debitNoteDate: formatDateForInput(safeDebitNoteDate),
          expenseAccount:
            debitNote.expenseAccount?._id || debitNote.expenseAccount,
          items,
          discountPercentage,
          shippingCharges,
          adjustment,
          currency: debitNote.currency || "USD",
          notes: debitNote.notes || "",
          reference: debitNote.reference || "",
          reason: normalizeDebitNoteReason(debitNote.reason),
          supportingDocuments:
            debitNote.documents || debitNote.supportingDocuments || [],
          status: debitNote.status || "Draft",
        };
        const { subtotal, taxTotal, discountAmount, total } =
          recalcDebitTotalsFromItems(base, items);
        setDebitNoteData({
          ...base,
          subtotal,
          taxTotal,
          discountAmount,
          total,
        });
      }
    } catch (error) {
      console.error("Error fetching debit note:", error);
      notifyError(dn("toasts.loadOneFailed", "Failed to load debit note"));
      if (embedInHub && typeof onHubCancel === "function") onHubCancel();
    } finally {
      setIsLoadingDebitNote(false);
    }
  };

  const fetchData = async () => {
    if (debitNoteData.business) {
      setIsLoadingData(true);
    }

    try {
      const storedBusinesses = localStorage.getItem("businesses");
      let assignedBusinesses = [];
      if (storedBusinesses) {
        assignedBusinesses = JSON.parse(storedBusinesses) || [];
        setBusinesses(assignedBusinesses);
      } else {
        setBusinesses([]);
      }

      if (
        debitNoteData.business &&
        assignedBusinesses.length > 0 &&
        !assignedBusinesses.some(
          (b) => String(b?._id) === String(debitNoteData.business),
        )
      ) {
        notifyError(dn("toasts.notAssignedBusiness", "This debit note does not belong to your assigned business"));
        if (embedInHub && typeof onHubCancel === "function") onHubCancel();
        else history.push("/debit-notes");
        return;
      }

      if (debitNoteData.business) {
        const [
          vendorsRes,
          customersRes,
          vendorInvoicesRes,
          customerInvoicesRes,
          chartAccountsRes,
          salesContractsRes,
          purchaseContractsRes,
        ] = await Promise.all([
          axios.get(`${Base_URL}/vendors`, {
            params: { businessId: debitNoteData.business },
            headers,
          }),
          axios.get(`${Base_URL}/customers`, {
            params: { businessId: debitNoteData.business },
            headers,
          }),
          axios.get(`${Base_URL}/vendor-invoices`, {
            params: { business: debitNoteData.business },
            headers,
          }),
          axios.get(`${Base_URL}/proforma-invoice`, {
            params: { businessId: debitNoteData.business },
            headers,
          }),
          axios.get(`${Base_URL}/accounts`, {
            params: { business: debitNoteData.business },
            headers,
          }),
          axios.get(`${Base_URL}/sales-contracts`, {
            params: { businessId: debitNoteData.business },
            headers,
          }),
          axios.get(`${Base_URL}/purchase-contracts`, {
            params: { businessId: debitNoteData.business },
            headers,
          }),
        ]);

        setVendors(vendorsRes.data.vendors || vendorsRes.data.data || []);
        setCustomers(
          customersRes.data.customers || customersRes.data.data || [],
        );
        setVendorInvoices(vendorInvoicesRes.data.data || []);
        setCustomerInvoices(customerInvoicesRes.data.data || []);
        setExpenseAccounts(chartAccountsRes.data.accounts || []);
        setSalesContracts(
          salesContractsRes.data.contracts || salesContractsRes.data.data || [],
        );
        setPurchaseContracts(
          purchaseContractsRes.data.contracts ||
            purchaseContractsRes.data.data ||
            [],
        );
      } else {
        setVendors([]);
        setCustomers([]);
        setVendorInvoices([]);
        setCustomerInvoices([]);
        setExpenseAccounts([]);
        setSalesContracts([]);
        setPurchaseContracts([]);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
      notifyError(dn("toasts.loadDataFailed", "Failed to load data"));
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    if (name === "business" || name === "entityType") {
      return;
    }

    if (name === "customer") {
      setSourceInvoiceRules(null);
      setDebitNoteData((prev) => ({
        ...prev,
        [name]: value,
        customerInvoice: "",
        items: [],
        subtotal: 0,
        discountPercentage: 0,
        discountAmount: 0,
        shippingCharges: 0,
        adjustment: 0,
        taxTotal: 0,
        total: 0,
      }));
    } else if (name === "vendor") {
      setSourceInvoiceRules(null);
      setDebitNoteData((prev) => ({
        ...prev,
        [name]: value,
        vendorInvoice: "",
        items: [],
        subtotal: 0,
        discountPercentage: 0,
        discountAmount: 0,
        shippingCharges: 0,
        adjustment: 0,
        taxTotal: 0,
        total: 0,
      }));
    } else {
      setDebitNoteData((prev) => ({ ...prev, [name]: value }));
    }

    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleLineItemChange = (index, field, value) => {
    if (
      field === "lineItemCustomFields" &&
      value &&
      typeof value === "object" &&
      Object.prototype.hasOwnProperty.call(value, "key")
    ) {
      setDebitNoteData((prev) => {
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
        const { subtotal, taxTotal, discountAmount, total } =
          recalcDebitTotalsFromItems(prev, updatedItems);
        return {
          ...prev,
          items: updatedItems,
          subtotal,
          taxTotal,
          discountAmount,
          total,
        };
      });
      return;
    }

    setDebitNoteData((prev) => {
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

      updatedItems[index] = sanitizeRowForDebit(
        updatedItems[index],
        field,
      );

      const { subtotal, taxTotal, discountAmount, total } =
        recalcDebitTotalsFromItems(prev, updatedItems);

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

  const mapProformaItemsToDebitRows = (invoice) => {
    return (invoice.items || []).map((item, idx) => {
      const quantity = item.quantity || 0;
      const unitPrice = item.unitPrice || 0;
      const discount = item.discount || 0;
      const taxRate = item.taxRate || 0;
      const taxIdRaw = item.taxId?._id ?? item.taxId;
      const taxIdStr =
        taxIdRaw !== undefined && taxIdRaw !== null && taxIdRaw !== ""
          ? String(taxIdRaw)
          : "";
      const lineGross = getItemTotal(quantity, unitPrice, discount, taxRate);
      const itemId =
        item.itemId && typeof item.itemId === "object"
          ? item.itemId._id
          : item.itemId;
      return {
        id: idx + 1,
        sourceInvoiceLineIndex: idx,
        _cnAllowedTaxId: taxIdStr,
        _cnAllowedTaxRate: parseFloat(item.taxRate) || 0,
        _cnAllowedTaxName: item.taxName || "",
        quantity,
        unitPrice,
        discount,
        taxRate,
        taxId: taxIdStr,
        taxName: item.taxName || "",
        tax_class: item.tax_class || "01",
        total: Math.max(0, parseFloat(lineGross) || 0),
        itemName:
          item.itemName || item.item || item.name || item.title || "",
        description: item.description || "",
        item: item.item || item.name || item.title || item.itemName || "",
        itemId: itemId || undefined,
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

  const applyCustomerInvoice = async (invoiceId) => {
    if (!invoiceId) {
      setSourceInvoiceRules(null);
      setDebitNoteData((prev) => ({
        ...prev,
        customerInvoice: "",
        items: [],
        subtotal: 0,
        discountPercentage: 0,
        discountAmount: 0,
        shippingCharges: 0,
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
        notifyError(dn("toasts.invoiceLoadFailed", "Could not load invoice"));
        return;
      }
      const rows = mapProformaItemsToDebitRows(invoice);
      const totalPaidFromPayments = (invoice.payments || []).reduce(
        (sum, payment) => {
          const allocated =
            payment?.allocatedAmount ??
            payment?.conversionDetails?.convertedAmount ??
            payment?.amountInInvoiceCurrency ??
            payment?.amount ??
            0;
          return sum + (parseFloat(allocated) || 0);
        },
        0,
      );
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
        invoiceTotal: Number.isFinite(invoiceRemaining)
          ? invoiceRemaining
          : parseFloat(invoice.remaining) ||
            parseFloat(invoice.grandTotal) ||
            parseFloat(invoice.subTotal) ||
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
        invoiceRulesFromDetailFetch: true,
        _invoiceId: String(invoiceId),
      });
      setDebitNoteData((prev) => {
        const discountPct = parseFloat(invoice.discount) || 0;
        const ship = parseFloat(invoice.shippingCharges) || 0;
        const adj = parseFloat(invoice.adjustment) || 0;
        const next = {
          ...prev,
          customerInvoice: invoiceId,
          currency: invoice.currency || prev.currency,
          items: rows,
          discountPercentage: discountPct,
          shippingCharges: ship,
          adjustment: adj,
        };
        const { subtotal, taxTotal, discountAmount, total } =
          recalcDebitTotalsFromItems(next, rows);
        return {
          ...next,
          subtotal,
          taxTotal,
          discountAmount,
          total,
        };
      });
      notifySuccess(
        dn(
          "toasts.invoiceLoaded",
          "Invoice lines loaded — remove lines you do not need or increase quantities for additional billing.",
        ),
      );
    } catch (e) {
      notifyError(dn("toasts.invoiceDetailsFailed", "Failed to load invoice details"));
    }
  };

  const mapVendorInvoiceItemsToDebitRows = (invoice) => {
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

  const applyVendorInvoiceForDebit = async (vendorInvoiceId) => {
    if (!vendorInvoiceId) {
      setSourceInvoiceRules(null);
      setDebitNoteData((prev) => ({
        ...prev,
        vendorInvoice: "",
        items: [],
        subtotal: 0,
        taxTotal: 0,
        total: 0,
        discountPercentage: 0,
        discountAmount: 0,
        shippingCharges: 0,
        adjustment: 0,
      }));
      if (formErrors.vendorInvoice) {
        setFormErrors((prev) => ({ ...prev, vendorInvoice: "" }));
      }
      return;
    }
    try {
      const res = await axios.get(
        `${Base_URL}/vendor-invoices/${vendorInvoiceId}`,
        {
          headers,
        },
      );
      const invoice = res.data?.data ?? res.data;
      if (!invoice) {
        notifyError(dn("toasts.vendorBillLoadFailed", "Could not load vendor bill"));
        return;
      }
      const rows = mapVendorInvoiceItemsToDebitRows(invoice);
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
      });
      setDebitNoteData((prev) => {
        const next = {
          ...prev,
          vendorInvoice: vendorInvoiceId,
          currency: invoice.currency || prev.currency,
          items: rows,
        };
        const { subtotal, taxTotal, discountAmount, total } =
          recalcDebitTotalsFromItems(next, rows);
        return {
          ...next,
          subtotal,
          taxTotal,
          discountAmount,
          total,
        };
      });
      if (formErrors.vendorInvoice) {
        setFormErrors((prev) => ({ ...prev, vendorInvoice: "" }));
      }
      notifySuccess(dn("toasts.vendorBillLoaded", "Vendor bill lines loaded — adjust as needed"));
    } catch (e) {
      notifyError(dn("toasts.vendorBillDetailsFailed", "Failed to load vendor bill details"));
    }
  };

  useEffect(() => {
    if (loadingInvoices) return;
    if (!debitNoteData.customerInvoice) return;
    if (debitNoteData.entityType !== "customer") return;
    const still = (customerInvoicesLhdn || []).some(
      (i) => String(i._id) === String(debitNoteData.customerInvoice),
    );
    if (!still) {
      applyCustomerInvoice("");
    }
  }, [
    loadingInvoices,
    customerInvoicesLhdn,
    debitNoteData.customerInvoice,
    debitNoteData.entityType,
  ]);

  const validateForm = () =>
    validateDebitNoteForm(debitNoteData, sourceInvoiceRules, t);

  const handleSubmit = async (status) => {
    const errors = validateForm();
    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      notifyError(dn("toasts.formHasErrors", "Please fix the errors before submitting"));
      return;
    }

    setIsLoading(true);

    try {
      const zohoItems = (debitNoteData.items || []).some(
        (r) => r.unitPrice !== undefined,
      );

      let itemsPayload = debitNoteData.items;

      let debitSubtotalFinal = debitNoteData.subtotal;
      let debitTaxFinal = debitNoteData.taxTotal || 0;
      let debitDiscountFinal = debitNoteData.discountAmount || 0;
      let debitShippingFinal = debitNoteData.shippingCharges || 0;
      let debitAdjustmentFinal = debitNoteData.adjustment || 0;
      let debitTotalFinal = debitNoteData.total;

      if (zohoItems) {
        let accumTax = 0;
        let grossLinesSum = 0;
        itemsPayload = (debitNoteData.items || []).map((item, idx) => {
          const qty = parseFloat(item.quantity) || 0;
          const rate = parseFloat(item.unitPrice) || 0;
          const disc = parseFloat(item.discount) || 0;
          const taxRate = parseFloat(item.taxRate) || 0;
          const lineNet = roundMoney(getLineSubtotal(qty, rate, disc));
          const taxAmt = roundMoney(getLineTaxAmount(lineNet, taxRate));
          accumTax += taxAmt;
          grossLinesSum += lineNet + taxAmt;
          const row = {
            item_name:
              item.itemName || item.description || `Line ${idx + 1}`,
            description: item.description || "",
            amount: Math.max(0, lineNet),
            notes: "",
            expenseAccount:
              item.expenseAccount || debitNoteData.expenseAccount || undefined,
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
        grossLinesSum = roundMoney(grossLinesSum);
        debitSubtotalFinal = grossLinesSum;
        debitTaxFinal = roundMoney(accumTax);
        debitShippingFinal = roundMoney(debitNoteData.shippingCharges || 0);
        debitAdjustmentFinal = roundMoney(debitNoteData.adjustment || 0);
        debitDiscountFinal = roundMoney(
          (grossLinesSum * (parseFloat(debitNoteData.discountPercentage) || 0)) /
            100,
        );
        debitTotalFinal = Math.max(
          0,
          roundMoney(
            grossLinesSum -
              debitDiscountFinal +
              debitShippingFinal +
              debitAdjustmentFinal,
          ),
        );
      }

      const debitNoteDataToSubmit = {
        business: debitNoteData.business,
        entityType: debitNoteData.entityType,
        vendor:
          debitNoteData.entityType === "vendor"
            ? debitNoteData.vendor
            : undefined,
        customer:
          debitNoteData.entityType === "customer"
            ? debitNoteData.customer
            : undefined,
        vendorInvoice:
          debitNoteData.entityType === "vendor" && debitNoteData.vendorInvoice
            ? debitNoteData.vendorInvoice
            : undefined,
        customerInvoice:
          debitNoteData.entityType === "customer" &&
          debitNoteData.customerInvoice
            ? debitNoteData.customerInvoice
            : undefined,
        debitNoteDate: new Date(debitNoteData.debitNoteDate),
        expenseAccount: debitNoteData.expenseAccount,
        items: itemsPayload,
        subtotal: debitSubtotalFinal,
        taxTotal: debitTaxFinal,
        totalTaxAmount: debitTaxFinal,
        total: debitTotalFinal,
        discountAmount: debitDiscountFinal,
        shippingCharges: debitShippingFinal,
        adjustment: debitAdjustmentFinal,
        currency: debitNoteData.currency,
        notes: debitNoteData.notes,
        reference: debitNoteData.reference,
        reason: normalizeDebitNoteReason(debitNoteData.reason),
        reasonDescription:
          (debitNoteData.notes && String(debitNoteData.notes).trim()) ||
          debitNoteData.reference ||
          "",
        supportingDocuments: debitNoteData.supportingDocuments,
        status: status,
      };

      const response = await axios.put(
        `${Base_URL}/debit-notes/${id}`,
        debitNoteDataToSubmit,
        { headers }
      );

      if (response.data.success) {
        notifySuccess(
          response.data.message ||
            dn("toasts.updateSuccess", "Debit note updated successfully!"),
        );
        if (embedInHub && typeof onHubDone === "function") {
          onHubDone(response.data?.data);
        } else {
          history.push("/debit-notes");
        }
      } else {
        notifyError(dn("toasts.updateFailed", "Failed to update debit note"));
      }
    } catch (error) {
      console.error("Error updating debit note:", error);
      notifyError(
        error.response?.data?.error ||
          error.response?.data?.message ||
          dn("toasts.updateFailed", "Failed to update debit note"),
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
      notifyError(dn("toasts.invalidFileType", "Please upload only JPEG, PNG, or PDF files"));
      return;
    }

    // Validate file size (5MB limit)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      notifyError(dn("toasts.fileTooLarge", "File size must be less than 5MB"));
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
        `DebitNotes/${debitNoteData.debitNoteNumber || Date.now()}`
      );
      formDataForUpload.append("business_id", debitNoteData?.business);
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

        setDebitNoteData((prev) => ({
          ...prev,
          supportingDocuments: [...prev.supportingDocuments, newDocument],
        }));

        setSuccessMessage(
          response.data.message || dn("toasts.fileUploadedSuccess", "File uploaded successfully!")
        );
        setUploadSuccess(true);

        setTimeout(() => {
          setUploadSuccess(false);
          setSuccessMessage("");
        }, 3000);
      }
    } catch (error) {
      console.error("File upload error:", error);
      notifyError(dn("toasts.uploadFailed", "File upload failed. Please try again."));
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
      notifyError(dn("toasts.openFileFailed", "Error opening file"));
      console.error("Error: ", error);
    }
  };

  const handleRemoveDocument = (index) => {
    setDebitNoteData((prev) => ({
      ...prev,
      supportingDocuments: prev.supportingDocuments.filter(
        (_, i) => i !== index
      ),
    }));
    notifySuccess(dn("toasts.documentRemoved", "Document removed successfully"));
  };

  if (isLoadingDebitNote) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--p-blue)]"></div>
      </div>
    );
  }

  return (
    <div
      className={`bg-gray-50 ${
        embedInHub ? "p-0 min-h-0" : "p-6 min-h-screen"
      }`}
    >
      {/* Header */}
      <div className="mb-6">
        <button
          type="button"
          className="flex items-center text-gray-600 hover:text-gray-800"
          onClick={() => {
            if (embedInHub && typeof onHubCancel === "function") {
              onHubCancel();
            } else {
              history.goBack();
            }
          }}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> {dn("actions.back", "Back")}
        </button>
      </div>

      <h1 className="text-2xl font-semibold mb-6 text-gray-800">
        {dn("form.updateTitle", "Update Debit Note")}
      </h1>

      {/* Debit Note For — locked on edit (same as create-time selection) */}
      {!hubCustomerOnly && (
        <div className="bg-white p-6 sm:p-8 rounded-xl mb-6 border border-gray-200 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-gray-900 tracking-tight">
              {dn("form.debitNoteFor", "Debit Note For")}
            </h2>
            <p className="mt-1 text-sm text-gray-600 max-w-2xl leading-relaxed">
              {dn("form.debitNoteForLockedHint", "Vendor vs customer cannot be changed when editing this debit note.")}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {[
              {
                value: "vendor",
                label: dn("form.entityVendorSupplier", "Vendor/Supplier"),
                icon: Building,
                description: dn("form.entityVendorDescription", "Debit note for a vendor/supplier"),
              },
              {
                value: "customer",
                label: dn("form.entityCustomer", "Customer"),
                icon: Users,
                description: dn("form.entityCustomerDescription", "Debit note for a customer"),
              },
            ].map((entityType) => {
              const IconComponent = entityType.icon;
              const selected = debitNoteData.entityType === entityType.value;
              return (
                <button
                  key={entityType.value}
                  type="button"
                  disabled
                  aria-disabled="true"
                  className={`group relative flex w-full gap-4 rounded-xl border-2 p-4 sm:p-5 text-left transition-all cursor-default ${
                    selected
                      ? "border-[var(--p-blue)] bg-[#f0fbf7] shadow-sm"
                      : "border-gray-200 bg-gray-50 opacity-80"
                  }`}
                >
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border ${
                      selected
                        ? "border-[var(--p-blue)]/30 bg-white"
                        : "border-gray-200 bg-white"
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

      {/* Business and Entity Section */}
      <div className="bg-[#f0fbf7] p-6 rounded-lg mb-6">
        <h2 className="text-lg font-medium mb-4 text-gray-800 flex items-center gap-2">
          {dn("form.businessAndParty", "Business & {{party}}", {
            party:
              debitNoteData.entityType === "vendor"
                ? dn("vendor", "Vendor")
                : dn("customer", "Customer"),
          })}
          {isLoadingData && (
            <div className="flex items-center gap-2 text-sm text-[var(--p-blue)]">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--p-blue)]"></div>
              {dn("form.loadingData", "Loading data...")}
            </div>
          )}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {!isSingleAssignedBusiness() && (
          <div>
            <label className="block text-gray-700 mb-2">{dn("form.businessRequired", "Business *")}</label>
            <SearchableDropdown
              name="business"
              value={debitNoteData.business}
              onChange={handleInputChange}
              placeholder={dn("form.placeholders.selectBusiness", "Select Business")}
              searchPlaceholder={dn("form.placeholders.searchBusinesses", "Search businesses...")}
              disabled={true}
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
            <p className="text-xs text-gray-500 mt-1">
              {dn("form.businessCannotChange", "Business cannot be changed when editing.")}
            </p>
            {formErrors.business && (
              <div className="text-red-500 text-xs mt-1">
                {formErrors.business}
              </div>
            )}
          </div>
          )}

          {debitNoteData.entityType === "vendor" ? (
            <div>
              <label className="block text-gray-700 mb-2">{dn("form.vendorRequired", "Vendor *")}</label>
              <SearchableDropdown
                name="vendor"
                value={debitNoteData.vendor}
                onChange={handleInputChange}
                placeholder={
                  isLoadingData
                    ? dn("form.placeholders.loadingVendors", "Loading vendors...")
                    : !debitNoteData.business
                    ? dn("form.placeholders.selectBusinessFirst", "Select business first")
                    : dn("form.placeholders.selectVendor", "Select Vendor")
                }
                searchPlaceholder={dn("form.placeholders.searchVendors", "Search vendors...")}
                disabled={isLoadingData || !debitNoteData.business}
                loading={isLoadingData}
                loadingText={dn("form.placeholders.loadingVendors", "Loading vendors...")}
                options={
                  vendors?.map((vendor) => ({
                    value: vendor._id,
                    label:
                      vendor.basicInformation?.vendorDisplayName || vendor.name,
                    name:
                      vendor.basicInformation?.vendorDisplayName || vendor.name,
                    email: vendor.basicInformation?.email,
                    company: vendor.basicInformation?.companyName,
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
          ) : (
            <div>
              <label className="block text-gray-700 mb-2">{dn("form.customerRequired", "Customer *")}</label>
              <SearchableDropdown
                name="customer"
                value={debitNoteData.customer}
                onChange={handleInputChange}
                placeholder={
                  isLoadingData
                    ? dn("form.placeholders.loadingCustomers", "Loading customers...")
                    : !debitNoteData.business
                    ? dn("form.placeholders.selectBusinessFirst", "Select business first")
                    : dn("form.placeholders.selectCustomer", "Select Customer")
                }
                searchPlaceholder={dn("form.placeholders.searchCustomers", "Search customers...")}
                disabled={isLoadingData || !debitNoteData.business}
                loading={isLoadingData}
                loadingText={dn("form.placeholders.loadingCustomers", "Loading customers...")}
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
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {debitNoteData.entityType === "vendor" ? (
            <div>
              <label className="block text-gray-700 mb-2">
                {dn("form.vendorBillOptional", "Vendor bill (optional)")}
              </label>
              <SearchableDropdown
                name="vendorInvoice"
                value={debitNoteData.vendorInvoice}
                onChange={(e) => applyVendorInvoiceForDebit(e.target.value)}
                placeholder={
                  isLoadingData
                    ? dn("form.placeholders.loadingInvoices", "Loading invoices...")
                    : !debitNoteData.business
                    ? dn("form.placeholders.selectBusinessFirst", "Select business first")
                    : !debitNoteData.vendor
                    ? dn("form.placeholders.selectVendorFirst", "Select vendor first")
                    : vendorInvoicesForSelectedVendor.length === 0
                    ? dn("form.placeholders.noVendorBills", "No vendor bills for this vendor")
                    : dn("form.placeholders.selectVendorInvoice", "Select vendor invoice")
                }
                searchPlaceholder={dn("form.placeholders.searchVendorInvoices", "Search vendor invoices...")}
                disabled={
                  isLoadingData ||
                  !debitNoteData.business ||
                  !debitNoteData.vendor
                }
                loading={isLoadingData}
                loadingText={dn("form.placeholders.loadingInvoices", "Loading invoices...")}
                clearable={true}
                options={vendorInvoicesForSelectedVendor.map((invoice) => ({
                  value: invoice._id,
                  label: `${invoice.invoiceNumber} - ${
                    invoice.vendor?.basicInformation?.vendorDisplayName ||
                    dn("form.placeholders.unknownVendor", "Unknown Vendor")
                  }`,
                  invoiceNumber: invoice.invoiceNumber,
                  vendor:
                    invoice.vendor?.basicInformation?.vendorDisplayName ||
                    dn("form.placeholders.unknownVendor", "Unknown Vendor"),
                  amount: invoice.total,
                  currency: invoice.currency,
                }))}
                searchKeys={["invoiceNumber", "vendor"]}
                renderOption={(option) => (
                  <div>
                    <div className="font-medium">{option.invoiceNumber}</div>
                    <div className="text-xs text-gray-500">{option.vendor}</div>
                    {option.amount && (
                      <div className="text-xs text-gray-400">
                        {formatCurrencyAmount(option.currency, option.amount)}
                      </div>
                    )}
                  </div>
                )}
              />
              {formErrors.vendorInvoice && (
                <div className="text-red-500 text-xs mt-1">
                  {formErrors.vendorInvoice}
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-800 mb-2">
                <FileSpreadsheet className="w-4 h-4 shrink-0 text-[var(--p-blue)]" />
                <span>{dn("form.customerInvoiceOptional", "Customer invoice (optional)")}</span>
              </label>
              <SearchableDropdown
                name="customerInvoice"
                value={debitNoteData.customerInvoice}
                onChange={(e) => applyCustomerInvoice(e.target.value)}
                placeholder={
                  loadingInvoices
                    ? dn("form.placeholders.loadingCustomerInvoices", "Loading customer invoices…")
                    : isLoadingData
                    ? dn("form.placeholders.loading", "Loading...")
                    : !debitNoteData.business
                    ? dn("form.placeholders.selectBusinessFirst", "Select business first")
                    : !debitNoteData.customer
                    ? dn("form.placeholders.selectCustomerFirst", "Select customer first")
                    : customerInvoicesLhdn.length === 0
                    ? dn("form.placeholders.noInvoicesForCustomer", "No invoices for this customer")
                    : dn(
                        "form.placeholders.chooseInvoiceToLoad",
                        "Choose invoice to load line items",
                      )
                }
                searchPlaceholder={dn("form.placeholders.searchByInvoiceNumber", "Search by invoice number…")}
                disabled={
                  isLoadingData ||
                  !debitNoteData.business ||
                  !debitNoteData.customer ||
                  loadingInvoices
                }
                loading={loadingInvoices}
                loadingText={dn("form.placeholders.loadingInvoicesEllipsis", "Loading invoices…")}
                clearable={true}
                options={
                  customerInvoicesLhdn.map((invoice) => ({
                    value: invoice._id,
                    label: `${invoice.invoice_number} - ${invoice.customer_id?.basicInformation?.primaryContact?.firstName} ${invoice.customer_id?.basicInformation?.primaryContact?.lastName}`,
                    invoiceNumber: invoice.invoice_number,
                    customer: `${invoice.customer_id?.basicInformation?.primaryContact?.firstName} ${invoice.customer_id?.basicInformation?.primaryContact?.lastName}`,
                    lhdn: invoice.lhdn_status,
                    amount: invoice.total,
                    currency: invoice.currency,
                  })) || []
                }
                searchKeys={["invoiceNumber", "customer", "lhdn"]}
                renderOption={(option) => (
                  <div>
                    <div className="font-medium">{option.invoiceNumber}</div>
                    <div className="text-xs text-gray-500">
                      LHDN {option.lhdn || "—"} · {option.customer}
                    </div>
                    {option.amount != null && (
                      <div className="text-xs text-gray-400">
                        {formatCurrencyAmount(option.currency, option.amount)}
                      </div>
                    )}
                  </div>
                )}
              />
              {formErrors.customerInvoice && (
                <div className="text-red-500 text-xs mt-1">
                  {formErrors.customerInvoice}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-gray-700 mb-2">
              {dn("form.expenseAccountRequired", "Expense Account *")}
            </label>
            <SearchableDropdown
              name="expenseAccount"
              value={debitNoteData.expenseAccount}
              onChange={handleInputChange}
              placeholder={
                isLoadingData
                  ? dn("form.placeholders.loadingAccounts", "Loading accounts...")
                  : !debitNoteData.business
                  ? dn("form.placeholders.selectBusinessFirst", "Select business first")
                  : dn("form.placeholders.selectExpenseAccount", "Select Expense Account")
              }
              searchPlaceholder={dn("form.placeholders.searchExpenseAccounts", "Search expense accounts...")}
              disabled={isLoadingData || !debitNoteData.business}
              loading={isLoadingData}
              loadingText={dn("form.placeholders.loadingAccounts", "Loading accounts...")}
              options={
                expenseAccounts?.map((account) => ({
                  value: account._id,
                  label: `${account.code || dn("list.na", "N/A")} - ${account.accountName} (${
                    account.accountType?.name
                  })`,
                  name: account.accountName,
                  type: account.accountType?.name,
                  code: account.code || dn("list.na", "N/A"),
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
      </div>

      {/* Debit Note Details */}
      <div className="bg-white p-6 rounded-lg mb-6 shadow-sm">
        <h2 className="text-lg font-medium mb-4 text-gray-800">
          {dn("form.debitNoteDetails", "Debit Note Details")}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-gray-700 mb-2">{dn("form.debitNoteDate", "Debit Note Date")}</label>
            <div className="relative">
              <CustomDatePicker
                value={debitNoteData.debitNoteDate}
                onChange={(date) =>
                  setDebitNoteData({ ...debitNoteData, debitNoteDate: date })
                }
                bgColor="#FFFFFF"
              />
              <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                <Calendar className="h-5 w-5 text-gray-400" />
              </div>
            </div>
            {formErrors.debitNoteDate && (
              <div className="text-red-500 text-xs mt-1">
                {formErrors.debitNoteDate}
              </div>
            )}
          </div>

          <div>
            <label className="block text-gray-700 mb-2">{dn("form.currency", "Currency")}</label>
            <SearchableDropdown
              name="currency"
              value={debitNoteData.currency}
              onChange={handleInputChange}
              placeholder={dn("form.placeholders.selectCurrency", "Select Currency")}
              searchPlaceholder={dn("form.placeholders.searchCurrencies", "Search currencies...")}
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
            <label className="block text-gray-700 mb-2">{dn("form.referenceRequired", "Reference *")}</label>
            <input
              type="text"
              name="reference"
              value={debitNoteData.reference}
              onChange={handleInputChange}
              placeholder={dn("form.placeholders.referenceNumber", "Reference number")}
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

        {debitNoteData.entityType === "customer" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-gray-700 mb-2">
                {dn("form.reason", "Reason")}
                {requiresLhdnDebitReasonFields ? (
                  <span className="text-red-500 ml-0.5" aria-hidden>
                    *
                  </span>
                ) : (
                  <span className="text-gray-500 font-normal text-sm ml-1">
                    {dn("form.reasonRequiredForLhdn", "(required for linked LHDN e‑Invoice)")}
                  </span>
                )}
              </label>
              <select
                name="reason"
                value={debitNoteData.reason}
                onChange={handleInputChange}
                required={requiresLhdnDebitReasonFields}
                aria-required={requiresLhdnDebitReasonFields}
                className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] bg-white ${
                  formErrors.reason ? "border-red-500" : "border-gray-300"
                }`}
              >
                <option value="">{dn("form.selectReason", "Select reason")}</option>
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
          </div>
        )}

        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-gray-700 mb-2">{dn("form.notes", "Notes")}</label>
            <textarea
              name="notes"
              value={debitNoteData.notes}
              onChange={handleInputChange}
              placeholder={dn("form.placeholders.additionalNotes", "Additional notes")}
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

      {/* Line items — same Zoho-style table as create */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-6 mb-6 space-y-6">
        <h2 className="text-lg font-semibold text-gray-900">{dn("form.lineItems", "Line items")}</h2>

        <ZohoStyleItemTable
          invoiceData={debitNoteData}
          setInvoiceData={setDebitNoteData}
          selectedContract={null}
          expenseAccounts={expenseAccounts}
          currency={debitNoteData.currency || "USD"}
          errors={formErrors}
          businessItems={businessItems}
          taxes={taxes}
          onItemChange={handleLineItemChange}
          businessId={debitNoteData.business}
          headers={headers}
          lineItemCustomFieldDefinitions={lineItemCustomFieldDefs}
          isEditMode={true}
          pricingMode={
            debitNoteData.entityType === "vendor" ? "purchase" : "sales"
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

        {debitNoteData.entityType === "vendor" && (
          <p className="text-sm text-gray-600">
            {dn(
              "form.vendorBillLinesHintUpdate",
              "Link a vendor bill to import lines, or leave blank and compose lines.",
            )}
          </p>
        )}

        {debitNoteData.items && debitNoteData.items.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <InvoiceSummaryPanel
              title={dn("form.debitNoteSummary", "Debit Note Summary")}
              invoiceData={debitNoteData}
              currency={debitNoteData.currency || "USD"}
              onDiscountChange={(value) =>
                setDebitNoteData((prev) => {
                  const next = { ...prev, discountPercentage: value };
                  const { subtotal, taxTotal, discountAmount, total } =
                    recalcDebitTotalsFromItems(next, next.items || []);
                  return {
                    ...prev,
                    discountPercentage: value,
                    subtotal,
                    taxTotal,
                    discountAmount,
                    total,
                  };
                })
              }
              onShippingChange={(value) =>
                setDebitNoteData((prev) => {
                  const next = { ...prev, shippingCharges: value };
                  const { subtotal, taxTotal, discountAmount, total } =
                    recalcDebitTotalsFromItems(next, next.items || []);
                  return {
                    ...prev,
                    shippingCharges: value,
                    subtotal,
                    taxTotal,
                    discountAmount,
                    total,
                  };
                })
              }
              onAdjustmentChange={(value) =>
                setDebitNoteData((prev) => {
                  const next = { ...prev, adjustment: value };
                  const { subtotal, taxTotal, discountAmount, total } =
                    recalcDebitTotalsFromItems(next, next.items || []);
                  return {
                    ...prev,
                    adjustment: value,
                    subtotal,
                    taxTotal,
                    discountAmount,
                    total,
                  };
                })
              }
            />
          </div>
        )}

        {formErrors.items && (
          <div className="text-red-500 text-sm">{formErrors.items}</div>
        )}
        {formErrors.total && (
          <div className="text-red-500 text-sm">{formErrors.total}</div>
        )}
      </div>

      <BulkAddItemsModal
        isOpen={showBulkAddItemsModal}
        onClose={() => setShowBulkAddItemsModal(false)}
        items={businessItems}
        onAddItems={handleBulkAddItemsForDebitNote}
        currency={debitNoteData.currency || "USD"}
        pricingMode={
          debitNoteData.entityType === "vendor" ? "purchase" : "sales"
        }
      />

      {/* Supporting Documents */}
      <div className="bg-white p-6 rounded-lg mb-6 shadow-sm">
        <h2 className="text-lg font-medium mb-4 text-gray-800">
          {dn("form.supportingDocuments", "Supporting Documents")}
        </h2>

        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
          {debitNoteData.supportingDocuments.length > 0 ? (
            <div className="space-y-3">
              {debitNoteData.supportingDocuments.map((doc, index) => (
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
                    {dn(
                      "form.uploadSupportingDocuments",
                      "Upload supporting documents",
                    )}
                  </span>
                  <span className="text-sm text-gray-500">
                    {dn("form.uploadHint", "PDF, PNG, JPG up to 5MB")}
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

          {debitNoteData.supportingDocuments.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <label
                htmlFor="additional-file-upload"
                className="cursor-pointer"
              >
                <span className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                  <Upload className="mr-2 h-4 w-4" />
                  {dn("actions.addMoreDocuments", "Add More Documents")}
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
                {dn("detail.uploadingProgress", "Uploading... {{progress}}%", { progress: uploadProgress })}
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
          {dn("actions.saveAsDraft", "Save as Draft")}
        </button>
        <button
          type="button"
          onClick={() => handleSubmit(debitNoteData.status)}
          disabled={isLoading}
          className="px-6 py-2 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[#9CBA33] disabled:opacity-50 flex items-center gap-2"
        >
          <Save size={16} />
          {isLoading ? dn("actions.updating", "Updating...") : dn("actions.updateDebitNote", "Update Debit Note")}
        </button>
      </div>
    </div>
  );
};

export default UpdateDebitNote;
