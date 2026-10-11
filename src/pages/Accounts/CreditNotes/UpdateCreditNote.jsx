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
  CreditCard,
  Check,
} from "lucide-react";
import axios from "axios";
import { useHistory, useParams } from "react-router-dom";
import { notifyError, notifySuccess } from "@/utils/toast";
import { AdminContext } from "@/context/AdminContext";
import CustomDatePicker from "@/components/CustomDatePicker";
import SearchableDropdown from "@/components/SearchableDropdown";
import SingleBusinessField from "@/components/SingleBusinessField";
import { isSingleAssignedBusiness } from "@/utils/sessionAssignedBusinesses";
import { formatAmount } from "@/components/formatAmount";
import CustomerInvoiceServices from "@/services/CustomerInvoiceServices";
import ZohoStyleItemTable from "@/components/invoice/ZohoStyleItemTable";
import InvoiceSummaryPanel from "@/components/invoice/InvoiceSummaryPanel";
import { fetchLineItemCustomFieldDefinitions } from "@/services/customFieldServices";
import {
  clampDiscountPercent,
  getItemTotal,
  getLineSubtotal,
  getLineTaxAmount,
  roundMoney,
} from "@/utils/itemDiscountUtils";
import {
  CREDIT_NOTE_REASON_OPTIONS,
  getCreditNoteReasonOptions,
  validateCreditNoteForm,
} from "@/utils/creditNoteFormValidation";
import BulkAddItemsModal from "@/components/customer-invoices/BulkAddItemsModal";
import { useTranslation } from "react-i18next";
import { makeCreditNoteT } from "@/utils/creditDebitNoteI18n";

const UpdateCreditNote = ({
  embedInHub = false,
  embedNoteId = null,
  onHubDone,
  onHubCancel,
  hubCustomerOnly = false,
} = {}) => {
  const { t } = useTranslation();
  const cn = useMemo(() => makeCreditNoteT(t), [t]);
  const reasonOptions = useMemo(() => getCreditNoteReasonOptions(t), [t]);
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

  const [businesses, setBusinesses] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [expenseAccounts, setExpenseAccounts] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [vendorInvoices, setVendorInvoices] = useState([]);

  // const {
  //   data: currencies,
  //   loading,
  //   error,
  // } = useAsync(CurrencyServices.getAllCurrency);
  const [currencies, setCurrencies] = useState([]);
  const [businessItems, setBusinessItems] = useState([]);
  const [taxes, setTaxes] = useState([]);
  const [lineItemCustomFieldDefs, setLineItemCustomFieldDefs] = useState([]);

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
    reason: "",
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
    allowRefundShipping: false,
    supportingDocuments: [],
    status: "Draft",
  });

  const [formErrors, setFormErrors] = useState({});
  const [showBulkAddItemsModal, setShowBulkAddItemsModal] = useState(false);
  const [sourceInvoiceRules, setSourceInvoiceRules] = useState(null);

  const creditReason = creditNoteData.reason;
  const isReturnReason = creditReason === "01_return_of_goods";
  const isDiscountReason = creditReason === "02_discount_allowance";
  const isOtherReason = creditReason === "04_other";
  const isCorrectionReason = creditReason === "03_invoice_correction";

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
    if (id) fetchCreditNote();
  }, [id]);

  useEffect(() => {
    if (creditNoteData.business) {
      fetchData();
    }
  }, [creditNoteData.business]);

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
          headers,
        );
        if (!cancelled) setLineItemCustomFieldDefs(lineDefs || []);
      } catch {
        if (!cancelled) setLineItemCustomFieldDefs([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [creditNoteData.business, creditNoteData.entityType, adminInfo?.token]);

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
      } catch {
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

  useEffect(() => {
    if (creditNoteData.entityType !== "vendor" || !creditNoteData.business) {
      setVendorInvoices([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${Base_URL}/vendor-invoices`, {
          headers,
          params: { business: creditNoteData.business, limit: 200, page: 1 },
        });
        const list = res.data?.data || [];
        if (!cancelled) setVendorInvoices(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setVendorInvoices([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [creditNoteData.entityType, creditNoteData.business, Base_URL]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (creditNoteData.entityType !== "customer") {
        setSourceInvoiceRules(null);
        return;
      }
      if (!creditNoteData.sourceInvoice || !creditNoteData.business) {
        setSourceInvoiceRules(null);
        return;
      }
      try {
        const res = await axios.get(
          `${Base_URL}/proforma-invoice/${creditNoteData.sourceInvoice}`,
          { headers },
        );
        const invoice = res.data?.data ?? res.data;
        if (!invoice || cancelled) return;

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
          shippingWasOnInvoice:
            (parseFloat(invoice.shippingCharges) || 0) > 0,
          invoiceShipping: parseFloat(invoice.shippingCharges) || 0,
          invoiceTotal: Number.isFinite(invoiceRemaining)
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
      } catch {
        if (!cancelled) setSourceInvoiceRules(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    creditNoteData.entityType,
    creditNoteData.sourceInvoice,
    creditNoteData.business,
    Base_URL,
    adminInfo?.token,
  ]);

  const linkedVendorInvoice = useMemo(() => {
    if (!creditNoteData.vendorInvoice) return null;
    return (vendorInvoices || []).find(
      (inv) => String(inv?._id) === String(creditNoteData.vendorInvoice),
    );
  }, [vendorInvoices, creditNoteData.vendorInvoice]);

  const combinedSourceInvoiceRules = useMemo(() => {
    if (
      creditNoteData.entityType === "vendor" &&
      creditNoteData.vendorInvoice &&
      linkedVendorInvoice
    ) {
      const inv = linkedVendorInvoice;
      const invTotal = parseFloat(inv.total) || 0;
      const st = (inv.status || "").toString().trim().toLowerCase();
      return {
        isVendorSource: true,
        shippingWasOnInvoice: (parseFloat(inv.shipping) || 0) > 0,
        invoiceShipping: parseFloat(inv.shipping) || 0,
        invoiceTotal: invTotal,
        invoiceDate: inv.invoiceDate || inv.createdAt || null,
        invoicePaymentStatus: st,
        invoicePaidAmount: st === "paid" ? invTotal : null,
      };
    }
    return sourceInvoiceRules;
  }, [
    creditNoteData.entityType,
    creditNoteData.vendorInvoice,
    linkedVendorInvoice,
    sourceInvoiceRules,
  ]);

  /** Opt-in row only when the linked bill/invoice originally had shipping. */
  const canShowShippingCharges = useMemo(
    () => Boolean(combinedSourceInvoiceRules?.shippingWasOnInvoice),
    [combinedSourceInvoiceRules?.shippingWasOnInvoice],
  );

  const showShippingLineInSummary =
    canShowShippingCharges && Boolean(creditNoteData.allowRefundShipping);

  const requiresLhdnCreditReasonFields = useMemo(
    () =>
      creditNoteData.entityType === "customer" &&
      Boolean(creditNoteData.sourceInvoice) &&
      combinedSourceInvoiceRules?.isLhdnLinkedCustomerInvoice === true,
    [
      creditNoteData.entityType,
      creditNoteData.sourceInvoice,
      combinedSourceInvoiceRules?.isLhdnLinkedCustomerInvoice,
    ],
  );

  const sanitizeRowAgainstSourceInvoice = useCallback(
    (row, fieldChanged) => {
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
                ),
              );
            }
            q = maxQ;
            r.quantity = q;
          }
        }

        const maxAmount = parseFloat(r._cnMaxAmount);
        if (Number.isFinite(maxAmount)) {
          const rawLine =
            parseFloat(
              getItemTotal(
                parseFloat(r.quantity) || 0,
                parseFloat(r.unitPrice) || 0,
                parseFloat(r.discount) || 0,
                parseFloat(r.taxRate) || 0,
              ),
            ) || 0;
          const currentLineTotal = roundMoney(rawLine);
          const maxAmt = roundMoney(maxAmount);
          if (currentLineTotal > maxAmt) {
            if (
              ["quantity", "unitPrice", "discount", "taxRate"].includes(
                fieldChanged,
              )
            ) {
              notifyError(
                cn(
                  "toasts.lineAmountExceedsOriginal",
                  "Line amount cannot exceed the original invoice line amount ({{amount}}).",
                  { amount: formatAmount(maxAmt) }
                ),
              );
            }
            if ((parseFloat(r.quantity) || 0) > 0) {
              const unit = parseFloat(r.unitPrice) || 0;
              const discountPct = parseFloat(r.discount) || 0;
              const taxPct = parseFloat(r.taxRate) || 0;
              const grossFactor = (1 - discountPct / 100) * (1 + taxPct / 100);
              if (grossFactor > 0 && unit > 0) {
                const maxQtyByAmount = maxAmt / (unit * grossFactor);
                r.quantity = Math.max(
                  0,
                  Math.min(parseFloat(r.quantity) || 0, maxQtyByAmount),
                );
              }
            }
          }
        }

        if (reason === "01_return_of_goods" || reason === "04_other") {
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
                ),
              );
            }
            r.quantity = maxQ;
          }
        }

        if (reason === "01_return_of_goods" || reason === "04_other") {
          const origDiscount = parseFloat(r._cnOriginalDiscount) || 0;
          if (Math.abs((parseFloat(r.discount) || 0) - origDiscount) > 0.01) {
            if (fieldChanged === "discount") {
              notifyError(
                cn("toasts.discountCannotChange", "Discount cannot be changed for this credit note reason."),
              );
            }
            r.discount = origDiscount;
          }
        }

        const origId = String(r._cnAllowedTaxId || "");
        const origRateTax = parseFloat(r._cnAllowedTaxRate) || 0;
        const hadNoTax = !origId && origRateTax === 0;
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
                ),
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
            r.taxRate = origRateTax;
            if (r._cnAllowedTaxName) r.taxName = r._cnAllowedTaxName;
          }
        } else if (
          Math.abs((parseFloat(r.taxRate) || 0) - origRateTax) > 0.02
        ) {
          if (taxFields.includes(fieldChanged)) {
            notifyError(
              cn(
                "toasts.taxRateMustMatchInvoice",
                "Tax rate must match the original invoice line ({{rate}}%).",
                { rate: origRateTax }
              ),
            );
          }
          r.taxRate = origRateTax;
        }
      }

      const quantity = parseFloat(r.quantity) || 0;
      const unitPrice = parseFloat(r.unitPrice) || 0;
      const discount = parseFloat(r.discount) || 0;
      const taxRate = parseFloat(r.taxRate) || 0;
      r.total = getItemTotal(quantity, unitPrice, discount, taxRate);
      return r;
    },
    [creditNoteData.reason, sourceInvoiceRules?.isLhdnLinkedCustomerInvoice, cn],
  );

  const recalcTotalsFromItems = useCallback((prev, updatedItems) => {
    const subtotal = updatedItems.reduce(
      (sum, item) => sum + (item.total || 0),
      0,
    );
    const taxTotal = updatedItems.reduce((sum, item) => {
      const lineSub = getLineSubtotal(
        item.quantity,
        item.unitPrice,
        item.discount,
      );
      return sum + getLineTaxAmount(lineSub, item.taxRate);
    }, 0);
    const discountAmount = (subtotal * (prev.discountPercentage || 0)) / 100;
    const total = Math.max(
      0,
      subtotal -
        discountAmount +
        (prev.shippingCharges || 0) +
        (prev.adjustment || 0),
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
      combinedSourceInvoiceRules == null &&
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
      const { subtotal, taxTotal, discountAmount, total } =
        recalcTotalsFromItems(next, next.items || []);
      return { ...next, subtotal, taxTotal, discountAmount, total };
    });
  }, [
    creditNoteData.entityType,
    creditNoteData.sourceInvoice,
    creditNoteData.vendorInvoice,
    creditNoteData.purchaseOrder,
    sourceInvoiceRules,
    combinedSourceInvoiceRules,
    canShowShippingCharges,
    recalcTotalsFromItems,
  ]);

  useEffect(() => {
    if (!canShowShippingCharges || creditNoteData.allowRefundShipping) return;
    setCreditNoteData((prev) => {
      if ((prev.shippingCharges || 0) <= 0) return prev;
      const next = { ...prev, shippingCharges: 0 };
      const { subtotal, taxTotal, discountAmount, total } =
        recalcTotalsFromItems(next, next.items || []);
      return { ...next, subtotal, taxTotal, discountAmount, total };
    });
  }, [
    canShowShippingCharges,
    creditNoteData.allowRefundShipping,
    recalcTotalsFromItems,
  ]);

  // Pre-fill shipping cap after opt-in only; does not overwrite user-entered amounts.
  useEffect(() => {
    if (!canShowShippingCharges || !creditNoteData.allowRefundShipping) return;
    const cap = parseFloat(combinedSourceInvoiceRules?.invoiceShipping) || 0;
    if (!(cap > 0)) return;
    setCreditNoteData((prev) => {
      if ((prev.shippingCharges || 0) > 0) return prev;
      const next = { ...prev, shippingCharges: cap };
      const { subtotal, taxTotal, discountAmount, total } =
        recalcTotalsFromItems(next, next.items || []);
      return { ...next, subtotal, taxTotal, discountAmount, total };
    });
  }, [
    canShowShippingCharges,
    creditNoteData.allowRefundShipping,
    combinedSourceInvoiceRules?.invoiceShipping,
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
        field,
      );

      const { subtotal, taxTotal, discountAmount, total } =
        recalcTotalsFromItems(prev, updatedItems);

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
      const cap = parseFloat(combinedSourceInvoiceRules?.invoiceShipping) || 0;
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
    const shipRules = combinedSourceInvoiceRules;
    if (
      canShowShippingCharges &&
      shipRules?.shippingWasOnInvoice &&
      !creditNoteData.allowRefundShipping &&
      value > 0
    ) {
      notifyError(
        cn(
          "toasts.enableShippingFirst",
          "Turn on “Include shipping on this credit note” above before entering a shipping amount."
        ),
      );
      return;
    }
    if (
      shipRules &&
      !shipRules.shippingWasOnInvoice &&
      value > 0
    ) {
      notifyError(
        creditNoteData.entityType === "customer"
          ? cn(
              "toasts.shippingOnlyIfOnInvoiceAdjust",
              "Shipping is only allowed when the original invoice had shipping. Use adjustment for other corrections."
            )
          : cn(
              "validation.shippingOnlyIfOnVendorBill",
              "Shipping is only allowed when the vendor bill included shipping."
            ),
      );
      return;
    }
    if (
      shipRules?.invoiceShipping != null &&
      value > shipRules.invoiceShipping + 1e-9
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

  const fetchCreditNote = async () => {
    try {
      const response = await axios.get(`${Base_URL}/credit-notes/${id}`, {
        headers,
      });

      console.log("update credit note response", response);
      if (response.data.success) {
        const creditNote = response.data.data;
        const items = (creditNote.items || []).map((item) => {
            const catalogItemId =
              item.itemId ||
              (typeof item.item === "object" && item.item?._id
                ? item.item._id
                : undefined);
            const quantity =
              item.quantity !== undefined && item.quantity !== ""
                ? parseFloat(item.quantity)
                : 1;
            const unitPrice =
              item.unitPrice != null
                ? parseFloat(item.unitPrice)
                : parseFloat(item.rate) || 0;
            const discount = parseFloat(item.discount) || 0;
            const taxRate = parseFloat(item.taxRate) || 0;
            const computedLineTotal = Math.max(
              0,
              getItemTotal(
                quantity,
                unitPrice,
                discount,
                taxRate,
              ),
            );
            return {
              ...item,
              itemName:
                item.itemName ||
                item.item_name ||
                item.name ||
                item.title ||
                "",
              description: item.description || "",
              item:
                (typeof item.item === "string" && item.item) ||
                item.name ||
                item.title ||
                item.itemName ||
                item.item_name ||
                "",
              itemId: catalogItemId || undefined,
              expenseAccount:
                item.expenseAccount?._id || item.expenseAccount || null,
              unitPrice,
              quantity,
              discount,
              taxRate,
              taxId: item.taxId ? String(item.taxId) : "",
              taxName: item.taxName || "",
              tax_class: item.tax_class || "01",
              total: computedLineTotal,
              lineItemCustomFields:
                item.lineItemCustomFields &&
                typeof item.lineItemCustomFields === "object"
                  ? { ...item.lineItemCustomFields }
                  : {},
            };
          });

        const shippingCharges =
          parseFloat(creditNote.shippingCharges) || 0;
        const adjustment = parseFloat(creditNote.adjustment) || 0;
        const storedDiscountAmount = roundMoney(
          parseFloat(creditNote.discountAmount) || 0,
        );
        const subtotalAgg = items.reduce(
          (sum, item) => sum + (item.total || 0),
          0,
        );
        const taxTotalAgg = items.reduce((sum, item) => {
          const lineSub = getLineSubtotal(
            item.quantity,
            item.unitPrice,
            item.discount,
          );
          return sum + getLineTaxAmount(lineSub, item.taxRate);
        }, 0);
        /** API persists `discountAmount` only. Recover summary % so edit matches create. */
        let discountPctForForm = 0;
        if (subtotalAgg > 1e-9 && storedDiscountAmount > 0) {
          discountPctForForm = clampDiscountPercent(
            (storedDiscountAmount / subtotalAgg) * 100,
          );
        } else if (
          creditNote.discountPercentage !== undefined &&
          creditNote.discountPercentage !== null
        ) {
          discountPctForForm = clampDiscountPercent(
            parseFloat(creditNote.discountPercentage) || 0,
          );
        }
        let discountFinal = roundMoney(
          (subtotalAgg * discountPctForForm) / 100,
        );
        if (
          storedDiscountAmount > 0 &&
          Math.abs(discountFinal - storedDiscountAmount) > 0.02
        ) {
          discountFinal = storedDiscountAmount;
        }
        const totalAgg = Math.max(
          0,
          roundMoney(
            subtotalAgg -
              discountFinal +
              shippingCharges +
              adjustment,
          ),
        );

        setCreditNoteData({
          business: creditNote.business?._id || creditNote.business || "",
          entityType: creditNote.entityType || "customer",
          customer: creditNote.customer?._id || creditNote.customer || "",
          vendor: creditNote.vendor?._id || creditNote.vendor || "",
          sourceInvoice:
            creditNote.sourceInvoice?._id || creditNote.sourceInvoice || "",
          vendorInvoice:
            creditNote.vendorInvoice?._id || creditNote.vendorInvoice || "",
          purchaseOrder:
            creditNote.purchaseOrder?._id ||
            creditNote.purchaseOrder ||
            creditNote.purchaseContract?._id ||
            creditNote.purchaseContract ||
            "",
          creditNoteType: creditNote.creditNoteType || "apply_to_invoice",
          creditNoteDate: formatDateForInput(
            new Date(creditNote.creditNoteDate || new Date()),
          ),
          dueDate: formatDateForInput(
            new Date(creditNote.dueDate || new Date()),
          ),
          expenseAccount:
            creditNote.expenseAccount?._id || creditNote.expenseAccount || "",
          bankAccount:
            creditNote.bankAccount?._id || creditNote.bankAccount || "",
          paidFromBankAccount:
            creditNote.paidFromBankAccount?._id ||
            creditNote.paidFromBankAccount ||
            "",
          refundDate:
            creditNote.refundDate != null
              ? formatDateForInput(new Date(creditNote.refundDate))
              : formatDateForInput(new Date()),
          paymentMethod: creditNote.paymentMethod || "",
          reason:
            CREDIT_NOTE_REASON_OPTIONS.some((o) => o.value === creditNote.reason)
              ? creditNote.reason
              : creditNote.reason || "",
          discountPercentage: discountPctForForm,
          discountAmount: discountFinal,
          shippingCharges,
          allowRefundShipping:
            Boolean(creditNote.allowRefundShipping) || shippingCharges > 0,
          adjustment,
          taxTotal: taxTotalAgg,
          items,
          subtotal: subtotalAgg,
          total: totalAgg,
          currency: creditNote.currency || "USD",
          terms: creditNote.terms || "As per agreement",
          notes: creditNote.notes || "",
          reference: creditNote.reference || "",
          supportingDocuments:
            creditNote.documents?.filter(
              (doc) => doc.documentType === "Supporting"
            ) || [],
          status: creditNote.status || "Draft",
        });
      }
    } catch (error) {
      console.error("Error fetching credit note:", error);
      notifyError(cn("toasts.loadOneFailed", "Failed to load credit note"));
      if (embedInHub && typeof onHubCancel === "function") onHubCancel();
      else history.push("/credit-notes");
    }
  };

  const fetchData = async () => {
    setIsLoadingData(true);
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

      if (
        creditNoteData.business &&
        assignedBusinesses.length > 0 &&
        !assignedBusinesses.some(
          (b) => String(b?._id) === String(creditNoteData.business),
        )
      ) {
        notifyError(cn("toasts.notAssignedBusiness", "This credit note does not belong to your assigned business"));
        if (embedInHub && typeof onHubCancel === "function") onHubCancel();
        else history.push("/credit-notes");
        return;
      }

      // Fetch business-specific data
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
            business: creditNoteData.business,
            businessId: creditNoteData.business,
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

      setCustomers(customersRes.data.customers || customersRes.data.data || []);
      setVendors(vendorsRes.data.vendors || vendorsRes.data.data || []);
      setPurchaseOrders(
        purchaseOrdersRes.data.orders ||
          purchaseOrdersRes.data.data ||
          purchaseOrdersRes.data.purchaseOrders ||
          []
      );
      setExpenseAccounts(chartAccountsRes.data.accounts || []);
      setBankAccounts(bankAccountsRes.data.accounts || []);
    } catch (error) {
      console.error("Failed to fetch data:", error);
      notifyError(cn("toasts.loadDataFailed", "Failed to load data"));
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    // If entity type is changing, clear entity-specific fields
    if (name === "entityType") {
      setCreditNoteData((prev) => ({
        ...prev,
        [name]: value,
        customer: "",
        vendor: "",
        sourceInvoice: "",
        vendorInvoice: "",
        purchaseOrder: "",
        allowRefundShipping: false,
      }));
      setSourceInvoiceRules(null);
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

  const validateForm = () =>
    validateCreditNoteForm(creditNoteData, combinedSourceInvoiceRules, t);

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
        combinedSourceInvoiceRules?.shippingWasOnInvoice,
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
        invoiceId:
          creditNoteData.entityType === "customer" &&
          creditNoteData.sourceInvoice
            ? creditNoteData.sourceInvoice
            : undefined,
        linkedVendorInvoice:
          creditNoteData.entityType === "vendor" &&
          creditNoteData.vendorInvoice
            ? creditNoteData.vendorInvoice
            : undefined,
        creditNoteType: creditNoteData.creditNoteType,
        creditNoteDate: new Date(creditNoteData.creditNoteDate),
        dueDate: new Date(creditNoteData.dueDate),
        expenseAccount: creditNoteData.expenseAccount,
        bankAccount: creditNoteData.bankAccount || undefined,
        paidFromBankAccount:
          creditNoteData.creditNoteType === "refund_to_client"
            ? creditNoteData.paidFromBankAccount
            : undefined,
        refundDate:
          creditNoteData.creditNoteType === "refund_to_client" &&
          creditNoteData.refundDate
            ? new Date(creditNoteData.refundDate)
            : undefined,
        paymentMethod:
          creditNoteData.creditNoteType === "refund_to_client"
            ? creditNoteData.paymentMethod
            : undefined,
        disbursementType:
          creditNoteData.creditNoteType === "refund_to_client"
            ? "refund"
            : undefined,
        paymentDirection:
          creditNoteData.creditNoteType === "refund_to_client" ? "out" : undefined,
        createPaymentOutLedgerEntry:
          creditNoteData.creditNoteType === "refund_to_client",
        originalInvoiceUUID:
          creditNoteData.entityType === "customer"
            ? sourceInvoiceRules?.originalInvoiceUUID || undefined
            : undefined,
        reason: creditNoteData.reason,
        reasonDescription:
          (creditNoteData.notes && String(creditNoteData.notes).trim()) ||
          creditNoteData.reference ||
          "",
        shippingCharges: shippingComputed,
        allowRefundShipping:
          creditNoteData.entityType === "customer" &&
          Boolean(creditNoteData.sourceInvoice) &&
          shippingAllowed &&
          Boolean(creditNoteData.allowRefundShipping),
        adjustment: adjustmentComputed,
        discountAmount: discountAmountComputed,
        items: apiItems,
        subtotal: grossLinesSum,
        taxTotal: taxTotalComputed,
        totalTaxAmount: taxTotalComputed,
        total: totalComputed,
        currency: creditNoteData.currency,
        terms: creditNoteData.terms,
        notes: creditNoteData.notes,
        reference: creditNoteData.reference,
        supportingDocuments: creditNoteData.supportingDocuments,
        status: status,
      };

      const response = await axios.put(
        `${Base_URL}/credit-notes/${id}`,
        creditNoteDataToSubmit,
        { headers }
      );

      if (response.data.success) {
        // Show auto-approval message if applicable
        const message = response.data.autoApproved
          ? response.data.message ||
            cn("toasts.updateApprovedSuccess", "Credit note updated and automatically approved")
          : response.data.message || cn("toasts.updateSuccess", "Credit note updated successfully!");

        notifySuccess(message);
        if (embedInHub && typeof onHubDone === "function") {
          onHubDone(response.data?.data);
        } else {
          history.push("/credit-notes");
        }
      } else {
        notifyError(cn("toasts.updateFailed", "Failed to update credit note"));
      }
    } catch (error) {
      console.error("Error updating credit note:", error);
      notifyError(
        error.response?.data?.message || cn("toasts.updateFailed", "Failed to update credit note")
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

  return (
    <div
      className={`bg-gray-50 h-full overflow-y-auto pb-[120px] ${
        embedInHub ? "p-0 max-w-none" : "p-6 max-h-[90vh]"
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
          <ArrowLeft className="mr-2 h-4 w-4" /> {cn("actions.back", "Back")}
        </button>
      </div>

      <h1 className="text-2xl font-semibold mb-6 text-gray-800">
        {cn("form.updateTitle", "Update Credit Note")}
      </h1>

      {/* Credit Note For — locked on edit (same pattern as update debit note) */}
      {!hubCustomerOnly && (
        <div className="bg-white p-6 sm:p-8 rounded-xl mb-6 border border-gray-200 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-gray-900 tracking-tight">
              {cn("form.creditNoteFor", "Credit Note For")}
            </h2>
            <p className="mt-1 text-sm text-gray-600 max-w-2xl leading-relaxed">
              {cn(
                "form.creditNoteForLockedHint",
                "Customer vs vendor cannot be changed when editing this credit note."
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
              const selected = creditNoteData.entityType === entityType.value;
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

      {/* Credit Note Type — locked on edit */}
      <div className="bg-white p-6 sm:p-8 rounded-xl mb-6 border border-gray-200 shadow-sm">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-gray-900 tracking-tight">
            {cn("form.creditNoteType", "Credit Note Type")}
          </h2>
          <p className="mt-1 text-sm text-gray-600 max-w-2xl leading-relaxed">
            {cn(
              "form.creditNoteTypeLockedHint",
              "Apply to invoice vs refund cannot be changed when editing this credit note."
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
                      "types.refundToClientDescriptionEdit",
                      "Credit amount will be refunded directly to customer"
                    )
                  : cn(
                      "types.refundToVendorDescriptionEdit",
                      "Credit amount will be refunded directly to vendor"
                    ),
            },
          ].map((type) => {
            const IconComponent = type.icon;
            const selected = creditNoteData.creditNoteType === type.value;
            return (
              <button
                key={type.value}
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

      {/* Business and Entity Section */}
      <div className="bg-[#f0fbf7] p-6 rounded-lg mb-6">
        <h2 className="text-lg font-medium mb-4 text-gray-800 flex items-center gap-2">
          {cn("form.businessAndParty", "Business & {{party}}", {
            party:
              creditNoteData.entityType === "customer"
                ? cn("customer", "Customer")
                : cn("vendor", "Vendor"),
          })}{" "}
          {cn("form.information", "Information")}
          {isLoadingData && (
            <div className="flex items-center gap-2 text-sm text-[var(--p-blue)]">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--p-blue)]"></div>
              {cn("form.loadingData", "Loading data...")}
            </div>
          )}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {!isSingleAssignedBusiness() && (
          <div>
            <label className="block text-gray-700 mb-2">{cn("form.businessRequired", "Business *")}</label>
            <SearchableDropdown
              name="business"
              value={creditNoteData.business}
              onChange={handleInputChange}
              placeholder={cn("form.placeholders.selectBusiness", "Select Business")}
              searchPlaceholder={cn("form.placeholders.searchBusinesses", "Search businesses...")}
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
              {cn("form.businessCannotChange", "Business cannot be changed when editing.")}
            </p>
            {formErrors.business && (
              <div className="text-red-500 text-xs mt-1">
                {formErrors.business}
              </div>
            )}
          </div>
          )}

          {creditNoteData.entityType === "customer" ? (
            <div>
              <label className="block text-gray-700 mb-2">{cn("form.customerRequired", "Customer *")}</label>
              <SearchableDropdown
                name="customer"
                value={creditNoteData.customer}
                onChange={handleInputChange}
                placeholder={
                  isLoadingData
                    ? cn("form.placeholders.loadingCustomers", "Loading customers...")
                    : !creditNoteData.business
                    ? cn("form.placeholders.selectBusinessFirst", "Select business first")
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
              <label className="block text-gray-700 mb-2">{cn("form.vendorRequired", "Vendor *")}</label>
              <SearchableDropdown
                name="vendor"
                value={creditNoteData.vendor}
                onChange={handleInputChange}
                placeholder={
                  isLoadingData
                    ? cn("form.placeholders.loadingVendors", "Loading vendors...")
                    : !creditNoteData.business
                    ? cn("form.placeholders.selectBusinessFirst", "Select business first")
                    : cn("form.placeholders.selectVendor", "Select Vendor")
                }
                searchPlaceholder={cn("form.placeholders.searchVendors", "Search vendors...")}
                disabled={isLoadingData || !creditNoteData.business}
                loading={isLoadingData}
                loadingText={cn("form.placeholders.loadingVendors", "Loading vendors...")}
                options={
                  vendors?.map((vendor) => ({
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-gray-700 mb-2">
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
                  ? cn("form.placeholders.selectBusinessFirst", "Select business first")
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 mb-2">
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
                    ? cn("form.placeholders.selectBusinessFirst", "Select business first")
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
          </div>
        )}
      </div>

      {/* Credit Note Details */}
      <div className="bg-white p-6 rounded-lg mb-6 shadow-sm">
        <h2 className="text-lg font-medium mb-4 text-gray-800">
          {cn("form.creditNoteDetails", "Credit Note Details")}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-gray-700 mb-2">{cn("form.creditNoteDate", "Credit Note Date")}</label>
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
          </div>

          <div>
            <label className="block text-gray-700 mb-2">{cn("form.dueDate", "Due Date")}</label>
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
            <label className="block text-gray-700 mb-2">{cn("form.currency", "Currency")}</label>
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
            <label className="block text-gray-700 mb-2">{cn("form.referenceRequired", "Reference *")}</label>
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

        {creditNoteData.entityType === "customer" && (
          <div className="mb-4">
            <label className="block text-gray-700 mb-2">
              {cn("form.reason", "Reason")}
              {requiresLhdnCreditReasonFields ? (
                <span className="text-red-500 ml-0.5" aria-hidden>
                  *
                </span>
              ) : (
                <span className="text-gray-500 font-normal text-sm ml-1">
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
              className={`w-full max-w-md p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] bg-white ${
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-700 mb-2">{cn("form.paymentTerms", "Payment Terms")}</label>
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
            <label className="block text-gray-700 mb-2">{cn("form.notes", "Notes")}</label>
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

      {/* Line items — same Zoho-style table as create / update debit note */}
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
              <p className="text-red-600 text-sm mt-2">{formErrors.total}</p>
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
                        {(doc.size / 1024 / 1024).toFixed(2)} MB
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
          onClick={() => handleSubmit(creditNoteData.status)}
          disabled={isLoading}
          className="px-6 py-2 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[#9CBA33] disabled:opacity-50"
        >
          {isLoading
            ? cn("actions.updating", "Updating...")
            : cn("actions.updateCreditNote", "Update Credit Note")}
        </button>
      </div>
    </div>
  );
};

export default UpdateCreditNote;
