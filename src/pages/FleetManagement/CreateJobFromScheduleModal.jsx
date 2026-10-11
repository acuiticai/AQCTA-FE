import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  X,
  Maximize2,
  Minimize2,
  AlertCircle,
  MapPin,
  Search,
  MessageCircle,
  PhoneOff,
  ChevronRight,
  ClipboardList,
  Bell,
  Pencil,
} from "lucide-react";
import { AdminContext } from "@/context/AdminContext";
import SearchableDropdown from "@/components/SearchableDropdown";
import ZohoStyleItemTable from "@/components/invoice/ZohoStyleItemTable";
import BulkAddItemsModal from "@/components/customer-invoices/BulkAddItemsModal";
import { notifyError, notifySuccess } from "@/utils/toast";
import { hasPathPermission, PERMISSION_ACTION } from "@/utils/permissionUtils";
import { getModuleRoutePath } from "@/utils/moduleLabels";
import {
  DEFAULT_FLEET_TERMINOLOGY,
  normalizeFleetTerminology,
} from "@/utils/fleetTerminology";
import FleetManagementServices from "@/services/FleetManagementServices";
import SalesOrderServices from "@/services/SalesOrderServices";
import { getLineSubtotal, getItemTotal, clampDiscountPercent } from "@/utils/itemDiscountUtils";
import { isSingleAssignedBusiness } from "@/utils/sessionAssignedBusinesses";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const LEAD_SOURCES = ["Website", "Referral", "Walk-in", "Phone", "Other"];

const VISIT_TYPES = [
  { value: "work", label: "Work" },
  { value: "estimate", label: "Estimate" },
  { value: "rework", label: "Rework" },
  { value: "other", label: "Other" },
  { value: "drop_off_pickup", label: "Drop off and pickup" },
];

const ASSIGNMENT_STATUSES = [
  { value: "scheduled", label: "Scheduled" },
  { value: "confirmed", label: "Confirm" },
  { value: "waiting", label: "Waiting" },
  { value: "in_progress", label: "On the job" },
  { value: "completed", label: "Complete" },
  { value: "cancelled", label: "Cancel" },
];

const DURATION_OPTIONS = [
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 45, label: "45 min" },
  { value: 60, label: "1 hr" },
  { value: 90, label: "1.5 hr" },
  { value: 120, label: "2 hr" },
  { value: 180, label: "3 hr" },
  { value: 240, label: "4 hr" },
];

function pad2(n) {
  return String(n).padStart(2, "0");
}

function timeDiffMinutes(startTime, endTime) {
  const [h1, m1] = String(startTime || "09:00").split(":").map(Number);
  const [h2, m2] = String(endTime || "10:00").split(":").map(Number);
  if (!Number.isFinite(h1) || !Number.isFinite(h2)) return 60;
  const d = h2 * 60 + m2 - (h1 * 60 + m1);
  return Math.max(15, Math.min(d, 24 * 60 - 15));
}

function addMinutesToTimeHHmm(timeStr, addMins) {
  const [h, m] = String(timeStr || "09:00").split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return "10:00";
  let total = h * 60 + m + (Number(addMins) || 0);
  total = Math.max(0, Math.min(total, 23 * 60 + 59));
  const nh = Math.floor(total / 60);
  const nm = total % 60;
  return `${pad2(nh)}:${pad2(nm)}`;
}

function businessesFromAdmin(adminInfo) {
  const raw = adminInfo?.businesses || adminInfo?.businessDetails || [];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((b) => {
      if (!b) return null;
      if (typeof b === "string") return { _id: b, name: b };
      return { _id: b._id || b.id, name: b.name || b.companyName || "Business" };
    })
    .filter(Boolean);
}

function firstAddressLine(addr) {
  if (!addr) return "";
  return (
    addr.addressLine1 ||
    addr.street ||
    [addr.city, addr.state, addr.zipCode].filter(Boolean).join(", ")
  );
}

function invoiceRowsToJobLineItems(rows) {
  return (rows || []).map((i) => {
    const qty = parseFloat(i.quantity) || 0;
    const unitPrice = parseFloat(i.unitPrice) || 0;
    const discount = clampDiscountPercent(i.discount);
    const lineSub = getLineSubtotal(qty, unitPrice, discount);
    const total = parseFloat(i.total) || 0;
    const tax = Math.max(0, total - lineSub);
    return {
      itemId: i.itemId || undefined,
      itemName: (i.itemName || "").trim() || (i.description || "").trim(),
      description: (i.description || "").trim(),
      quantity: qty,
      price: unitPrice,
      tax,
      taxRate: parseFloat(i.taxRate) || 0,
      taxId: i.taxId || undefined,
      taxName: i.taxName || "",
      discount,
      total,
    };
  });
}

const DEFAULT_JOB_CURRENCY = "MYR";

function parseFinanceBaseCurrencyCode(base) {
  if (!base) return DEFAULT_JOB_CURRENCY;
  const name = String(base.name || "").trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(name)) return name;
  const sym = String(base.symbol || "").trim().toUpperCase();
  if (sym === "RM" || sym === "MYR") return "MYR";
  return DEFAULT_JOB_CURRENCY;
}

function intlCurrencyOptionsForCode(code) {
  const c =
    String(code || DEFAULT_JOB_CURRENCY)
      .trim()
      .toUpperCase() || DEFAULT_JOB_CURRENCY;
  const o = { style: "currency", currency: c };
  if (c === "MYR") o.currencyDisplay = "code";
  return o;
}

function formatMoney(n, currency = DEFAULT_JOB_CURRENCY) {
  const code =
    String(currency || DEFAULT_JOB_CURRENCY)
      .trim()
      .toUpperCase() || DEFAULT_JOB_CURRENCY;
  const x = Number(n);
  const loc = code === "MYR" ? "en-MY" : "en-US";
  const opts = intlCurrencyOptionsForCode(code);
  if (!Number.isFinite(x)) {
    return new Intl.NumberFormat(loc, opts).format(0);
  }
  return new Intl.NumberFormat(loc, opts).format(x);
}

/** Avoid "MYR 0.00" in previews when there are no lines yet; matches Settings base currency (MYR) in formatMoney when non-zero. */
function formatSubtotalPreview(items, subtotal, total, currency) {
  const t = Number(subtotal || total) || 0;
  if (!(items || []).length && t === 0) return "—";
  return formatMoney(subtotal || total, currency);
}

function formatDayPretty(ymd) {
  if (!ymd) return "—";
  const d = new Date(`${ymd}T12:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatTime12(timeStr) {
  const [h, m] = String(timeStr || "").split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return "";
  const am = h < 12;
  let hr = h % 12;
  if (hr === 0) hr = 12;
  return `${hr}:${pad2(m)} ${am ? "AM" : "PM"}`;
}

function formatAddressLines(addr) {
  if (!addr) return [];
  const lines = [];
  if (addr.addressLine1) lines.push(addr.addressLine1);
  if (addr.addressLine2) lines.push(addr.addressLine2);
  const cityLine = [addr.city, addr.state, addr.zipCode].filter(Boolean).join(", ");
  if (cityLine) lines.push(cityLine);
  if (addr.country) lines.push(addr.country);
  return lines.length ? lines : [];
}

function pickBillingShippingFromCustomer(addresses) {
  const list = Array.isArray(addresses) ? addresses : [];
  const norm = (t) => String(t || "").toLowerCase();
  const billing =
    list.find((a) => norm(a.addressType) === "billing") ||
    list.find((a) => norm(a.addressType).includes("bill"));
  const shipping =
    list.find((a) => norm(a.addressType) === "shipping") ||
    list.find((a) => norm(a.addressType).includes("ship")) ||
    list.find((a) => norm(a.addressType) === "service");
  return { billing, shipping, all: list };
}

function addressToServiceFields(addr) {
  if (!addr) return { street: "", city: "", area: "", zip: "" };
  return {
    street: addr.addressLine1 || "",
    city: addr.city || "",
    area: addr.state || "",
    zip: addr.zipCode || "",
  };
}

function mapsQueryFromAddress(street, city, area, zip) {
  return [street, city, area, zip].filter(Boolean).join(", ");
}

function staffDisplayName(s) {
  if (!s) return "";
  if (s.name) return String(s.name);
  const fn = s.firstName || s.first_name || "";
  const ln = s.lastName || s.last_name || "";
  const joined = [fn, ln].filter(Boolean).join(" ").trim();
  if (joined) return joined;
  return s.email || "Technician";
}

export default function CreateJobFromScheduleModal({
  isOpen,
  onClose,
  initial,
  vehicles = [],
  fleetTerminology = DEFAULT_FLEET_TERMINOLOGY,
  onCreated,
}) {
  const fleetTerms = normalizeFleetTerminology(fleetTerminology);
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      authorization: adminInfo?.token ? `Bearer ${adminInfo.token}` : undefined,
    }),
    [adminInfo?.token],
  );

  const businessOptions = useMemo(() => businessesFromAdmin(adminInfo), [adminInfo]);
  const roleModules = adminInfo?.role?.modules || [];
  const canCreateLinkedSalesOrder = hasPathPermission(
    roleModules,
    getModuleRoutePath("saleOrder", "list"),
    PERMISSION_ACTION.ADD,
  );

  const [maximized, setMaximized] = useState(false);
  const [activeTab, setActiveTab] = useState("customer");

  const [businessId, setBusinessId] = useState("");
  const [businessData, setBusinessData] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [businessItems, setBusinessItems] = useState([]);
  const [taxes, setTaxes] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [customerMode, setCustomerMode] = useState("select");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [customerKind, setCustomerKind] = useState("individual");
  const [selectedCustomerDetail, setSelectedCustomerDetail] = useState(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertDraft, setAlertDraft] = useState({ message: "", level: "warning" });
  const [savedAlert, setSavedAlert] = useState(null);
  const [smsOptIn, setSmsOptIn] = useState(true);
  const [phoneDoNotContact, setPhoneDoNotContact] = useState(false);
  const siteStreetInputRef = useRef(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    email: "",
    phone: "",
    customerType: "individual",
    companyName: "",
    contactPerson: "",
    companyAddress: "",
  });
  const [phoneType, setPhoneType] = useState("mobile");
  const [leadSource, setLeadSource] = useState("");
  const [address, setAddress] = useState({
    street: "",
    city: "",
    area: "",
    zip: "",
  });
  const [invoiceData, setInvoiceData] = useState({
    items: [],
    subtotal: 0,
    discountPercentage: 0,
    discountAmount: 0,
    shippingCharges: 0,
    adjustment: 0,
    total: 0,
    currency: DEFAULT_JOB_CURRENCY,
  });
  const [bulkOpen, setBulkOpen] = useState(false);
  const [jobTitle, setJobTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [schedule, setSchedule] = useState({
    dayYmd: "",
    startTime: "09:00",
    endTime: "10:00",
    vehicleId: "",
  });
  const [durationMins, setDurationMins] = useState(60);
  const [visitType, setVisitType] = useState("work");
  const [assignmentStatus, setAssignmentStatus] = useState("scheduled");
  const [selectedTechnicianIds, setSelectedTechnicianIds] = useState([]);
  const [saving, setSaving] = useState(false);
  /** Defaults for linked sales order (same masters as Sales Order form) */
  const [salesOrderMeta, setSalesOrderMeta] = useState({
    paymentTerms: "",
    deliveryMethod: "",
    salesperson: "",
  });

  const customerOptions = useMemo(
    () =>
      customers.map((c) => {
        const label =
          c?.basicInformation?.customerDisplayName ||
          c?.basicInformation?.companyName ||
          "Customer";
        return { value: c._id, label, name: label };
      }),
    [customers],
  );

  const resetWhenOpen = useCallback(() => {
    if (!isOpen || !initial) return;
    const vId = initial.vehicle?._id ? String(initial.vehicle._id) : "";
    const st = initial.startTime || "09:00";
    const et = initial.endTime || "10:00";
    const dur = timeDiffMinutes(st, et);
    setDurationMins(dur);
    setSchedule({
      dayYmd: initial.dayYmd || "",
      startTime: st,
      endTime: et,
      vehicleId: vId,
    });
    setInvoiceData((prev) => ({
      ...prev,
      items: [],
      subtotal: 0,
      total: 0,
    }));
    setJobTitle("");
    setDescription("");
    setPriority("medium");
    setVisitType("work");
    setAssignmentStatus("scheduled");
    setCustomerMode("select");
    setSelectedCustomerId("");
    setCustomerKind("individual");
    setSelectedCustomerDetail(null);
    setReviewOpen(false);
    setAlertOpen(false);
    setAlertDraft({ message: "", level: "warning" });
    setSavedAlert(null);
    setSmsOptIn(true);
    setPhoneDoNotContact(false);
    setFirstName("");
    setLastName("");
    setPhoneType("mobile");
    setLeadSource("");
    setSelectedTechnicianIds([]);
    setActiveTab("customer");
    setMaximized(false);
    setNewCustomer({
      name: "",
      email: "",
      phone: "",
      customerType: "individual",
      companyName: "",
      contactPerson: "",
      companyAddress: "",
    });
    setAddress({ street: "", city: "", area: "", zip: "" });
    const firstBiz = businessOptions[0]?._id || "";
    const fromToolbar = initial?.businessId ? String(initial.businessId) : "";
    setBusinessId(fromToolbar || firstBiz);
  }, [isOpen, initial, businessOptions]);

  useEffect(() => {
    resetWhenOpen();
  }, [resetWhenOpen]);

  useEffect(() => {
    if (!isOpen || !businessId) {
      setBusinessData(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${Base_URL}/Business/${businessId}`, { headers });
        const b = res.data?.data;
        if (!cancelled) setBusinessData(b || null);
      } catch {
        if (!cancelled) setBusinessData(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, businessId, headers]);

  useEffect(() => {
    if (!isOpen || !businessId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${Base_URL}/finance/currencies`, {
          params: { business_id: businessId },
          headers,
        });
        const currencies = res.data?.data || [];
        const base = currencies.find((c) => c.is_base === true);
        const code = parseFinanceBaseCurrencyCode(base);
        if (!cancelled) setInvoiceData((prev) => ({ ...prev, currency: code }));
      } catch {
        if (!cancelled) {
          setInvoiceData((prev) => ({ ...prev, currency: DEFAULT_JOB_CURRENCY }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, businessId, headers]);

  useEffect(() => {
    if (!isOpen || !businessId) {
      setSalesOrderMeta({ paymentTerms: "", deliveryMethod: "", salesperson: "" });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [ptRes, dmRes, spRes] = await Promise.all([
          axios.post(
            `${Base_URL}/items/Payment Terms/get_all`,
            { business_id: businessId, FilterStatus: "active", FilterName: "" },
            { headers },
          ),
          SalesOrderServices.getDeliveryMethods(businessId, headers),
          SalesOrderServices.getSalespersons(businessId, headers),
        ]);
        const ptList = ptRes?.data?.success ? ptRes.data.data || [] : [];
        const dmList = dmRes?.data?.success ? dmRes.data.data || [] : [];
        const spList = spRes?.data?.success ? spRes.data.data || [] : [];
        const pt0 = ptList[0];
        const dm0 = dmList[0];
        const sp0 = spList[0];
        if (!cancelled) {
          setSalesOrderMeta({
            paymentTerms: pt0?.name || "",
            deliveryMethod: dm0?._id ? String(dm0._id) : "",
            salesperson: sp0?._id ? String(sp0._id) : "",
          });
        }
      } catch {
        if (!cancelled) {
          setSalesOrderMeta({ paymentTerms: "", deliveryMethod: "", salesperson: "" });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, businessId, headers]);

  useEffect(() => {
    if (!isOpen || !businessId) {
      setCustomers([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${Base_URL}/customers`, {
          headers,
          params: { businessId, limit: 9999 },
        });
        const list = res.data?.customers || res.data || [];
        if (!cancelled) setCustomers(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setCustomers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, businessId, headers]);

  useEffect(() => {
    if (!isOpen || !businessId) {
      setBusinessItems([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${Base_URL}/items`, {
          headers,
          params: { businessId, status: "Active" },
        });
        const list = res.data?.items || res.data || [];
        if (!cancelled) setBusinessItems(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setBusinessItems([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, businessId, headers]);

  useEffect(() => {
    if (!isOpen || !businessId) {
      setTaxes([]);
      return;
    }
    let cancelled = false;
    axios
      .get(`${Base_URL}/taxes?business=${businessId}`, { headers })
      .then((res) => {
        if (!cancelled) setTaxes(res.data || []);
      })
      .catch(() => {
        if (!cancelled) setTaxes([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, businessId, headers]);

  useEffect(() => {
    if (!isOpen || !businessId) {
      setStaffList([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${Base_URL}/staff-management`, {
          headers,
          params: { business: businessId, limit: 1000 },
        });
        const list = res.data?.staffList || res.data?.data || res.data || [];
        if (!cancelled) setStaffList(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setStaffList([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, businessId, headers]);

  useEffect(() => {
    if (customerKind === "company") {
      setNewCustomer((p) => ({ ...p, customerType: "company" }));
    } else {
      setNewCustomer((p) => ({ ...p, customerType: "individual" }));
    }
  }, [customerKind]);

  useEffect(() => {
    if (customerMode !== "select" || !selectedCustomerId) {
      setSelectedCustomerDetail(null);
    }
  }, [customerMode, selectedCustomerId]);

  const loadCustomerIntoForm = useCallback(
    async (customerId) => {
      if (!customerId) return;
      try {
        const res = await axios.get(`${Base_URL}/customers/${customerId}`, { headers });
        const c = res.data;
        if (!c?.basicInformation) return;
        const bi = c.basicInformation || {};
        const type = (bi.client_type || "Individual").toLowerCase() === "company" ? "company" : "individual";
        setCustomerKind(type === "company" ? "company" : "individual");
        setSelectedCustomerDetail(c);
        const display = bi.customerDisplayName || "";
        const parts = display.trim().split(/\s+/);
        setFirstName(parts[0] || "");
        setLastName(parts.slice(1).join(" ") || "");
        setNewCustomer((prev) => ({
          ...prev,
          customerType: type,
          name: display,
          email: bi.customerEmail || "",
          phone: bi.customerPhone?.mobile || bi.customerPhone?.workPhone || "",
          companyName: bi.companyName || "",
          contactPerson: [bi.primaryContact?.firstName, bi.primaryContact?.lastName].filter(Boolean).join(" "),
          companyAddress: "",
        }));
        const { shipping, billing, all } = pickBillingShippingFromCustomer(c.addresses);
        const serviceSource = shipping || billing || (all.length ? all[0] : null);
        const ad = serviceSource || {};
        setAddress({
          street: ad.addressLine1 || "",
          city: ad.city || "",
          area: ad.state || "",
          zip: ad.zipCode || "",
        });
      } catch {
        /* ignore */
      }
    },
    [headers],
  );

  useEffect(() => {
    if (customerMode === "select" && selectedCustomerId) {
      loadCustomerIntoForm(selectedCustomerId);
    }
  }, [customerMode, selectedCustomerId, loadCustomerIntoForm]);

  const handleBulkAddItems = useCallback(
    (newItems) => {
      if (!newItems || !newItems.length) return;
      const formatted = newItems.map((item) => {
        const quantity = Number(item.quantity) || 1;
        const rate = Number(item.unitPrice) || 0;
        const discount = Number(item.discount) || 0;
        const taxRate = Number(item.taxRate) || 0;
        const taxId = item.taxId || item?.taxOnItem?._id || "";
        const lineSubtotal = getLineSubtotal(quantity, rate, discount);
        const taxAmount = taxRate > 0 ? (lineSubtotal * taxRate) / 100 : 0;
        const amount = Math.max(0, lineSubtotal + taxAmount);
        const displayName = (item.itemName || "").trim() || (item.description || "").trim();
        return {
          id: Date.now() + Math.random(),
          itemId: item.itemId || "",
          itemName: displayName,
          description: item.description || item.itemName || "",
          quantity,
          unitPrice: rate,
          discount,
          taxRate,
          taxId,
          taxName: item.taxName || "",
          total: amount,
          unit: item.unit || "",
          lineItemCustomFields: {},
        };
      });
      setInvoiceData((prev) => {
        const merged = [...(prev.items || [])];
        for (const row of formatted) {
          const itemId = row.itemId;
          if (!itemId) {
            merged.push(row);
            continue;
          }
          const idx = merged.findIndex((it) => String(it.itemId) === String(itemId));
          if (idx >= 0) {
            const existing = merged[idx];
            const newQty = (parseFloat(existing.quantity) || 0) + (parseFloat(row.quantity) || 0);
            const rate = parseFloat(existing.unitPrice) || 0;
            const discount = parseFloat(existing.discount) || 0;
            const taxRate = parseFloat(existing.taxRate) || 0;
            merged[idx] = {
              ...existing,
              quantity: newQty,
              total: getItemTotal(newQty, rate, discount, taxRate),
            };
          } else merged.push(row);
        }
        const subtotal = merged.reduce((s, it) => s + (parseFloat(it.total) || 0), 0);
        return { ...prev, items: merged, subtotal, total: subtotal };
      });
    },
    [setInvoiceData],
  );

  const toggleTechnician = useCallback((id) => {
    const sid = String(id);
    setSelectedTechnicianIds((prev) =>
      prev.includes(sid) ? prev.filter((x) => x !== sid) : [...prev, sid],
    );
  }, []);

  /** Switching to "Create new" must clear fields filled from a previously selected customer. */
  const switchCustomerMode = useCallback((mode) => {
    setCustomerMode(mode);
    if (mode === "create") {
      setSelectedCustomerId("");
      setSelectedCustomerDetail(null);
      setCustomerKind("individual");
      setFirstName("");
      setLastName("");
      setPhoneType("mobile");
      setNewCustomer({
        name: "",
        email: "",
        phone: "",
        customerType: "individual",
        companyName: "",
        contactPerson: "",
        companyAddress: "",
      });
      setAddress({ street: "", city: "", area: "", zip: "" });
    }
  }, []);

  const customerDisplayName = useMemo(() => {
    if (customerMode === "select" && selectedCustomerId) {
      const opt = customerOptions.find((o) => String(o.value) === String(selectedCustomerId));
      return opt?.label || "";
    }
    if (newCustomer.customerType === "company") {
      return (newCustomer.companyName || newCustomer.name || "").trim();
    }
    return [firstName, lastName].filter(Boolean).join(" ").trim() || newCustomer.name.trim();
  }, [
    customerMode,
    selectedCustomerId,
    customerOptions,
    newCustomer.companyName,
    newCustomer.name,
    newCustomer.customerType,
    firstName,
    lastName,
  ]);

  const billingShipping = useMemo(() => {
    if (!selectedCustomerDetail?.addresses) return { billing: null, shipping: null };
    return pickBillingShippingFromCustomer(selectedCustomerDetail.addresses);
  }, [selectedCustomerDetail]);

  const openServiceInMaps = useCallback(() => {
    const q = mapsQueryFromAddress(address.street, address.city, address.area, address.zip);
    if (!String(q).trim()) {
      notifyError("Enter a service address first.");
      return;
    }
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }, [address.street, address.city, address.area, address.zip]);

  const applyServiceFromAddress = useCallback((addr) => {
    setAddress(addressToServiceFields(addr));
    notifySuccess("Service site updated from customer address.");
  }, []);

  const hasCustomer = Boolean(
    (customerMode === "select" && selectedCustomerId) ||
      (customerMode === "create" &&
        customerDisplayName &&
        newCustomer.email?.trim()),
  );

  const appointmentSummary = useMemo(() => {
    if (!schedule.dayYmd) return "Pick a date";
    return `${formatDayPretty(schedule.dayYmd)}, ${formatTime12(schedule.startTime)} – ${formatTime12(
      schedule.endTime,
    )}`;
  }, [schedule.dayYmd, schedule.startTime, schedule.endTime]);

  const technicianNamesPayload = useMemo(
    () =>
      selectedTechnicianIds
        .map((id) => staffList.find((s) => String(s._id) === String(id)))
        .filter(Boolean)
        .map((s) => staffDisplayName(s)),
    [selectedTechnicianIds, staffList],
  );

  const submit = async (e) => {
    e.preventDefault();
    if (!businessId) {
      notifyError("Select a business.");
      return;
    }
    if (!schedule.vehicleId || !schedule.dayYmd) {
      notifyError("Scheduling information is incomplete.");
      return;
    }
    if (!invoiceData.items?.length) {
      notifyError("Add at least one line item.");
      return;
    }

    const combinedName =
      newCustomer.customerType === "company"
        ? (newCustomer.companyName || newCustomer.name || "").trim()
        : [firstName, lastName].filter(Boolean).join(" ").trim() || newCustomer.name.trim();

    setSaving(true);
    try {
      let customerId = selectedCustomerId;
      if (customerMode === "create") {
        if (!combinedName || !newCustomer.email?.trim()) {
          notifyError("Customer name and email are required.");
          setSaving(false);
          return;
        }
        const isCo = newCustomer.customerType === "company";
        const nameParts = combinedName.split(/\s+/);
        const phoneVal = newCustomer.phone?.trim() || "";
        const customerPhone =
          phoneType === "work"
            ? { workPhone: phoneVal, mobile: "" }
            : { workPhone: "", mobile: phoneVal };
        const payload = {
          business: businessId,
          basicInformation: {
            business: businessId,
            client_type: isCo ? "Company" : "Individual",
            customerDisplayName: combinedName,
            customerEmail: newCustomer.email.trim(),
            customerPhone,
            primaryContact: {
              firstName: nameParts[0] || combinedName,
              lastName: nameParts.slice(1).join(" ") || "",
            },
            ...(isCo
              ? {
                  companyName: newCustomer.companyName?.trim() || combinedName,
                }
              : {}),
          },
          addresses: [
            {
              addressType: "Service",
              addressLine1: address.street?.trim() || "—",
              city: address.city?.trim() || "",
              state: address.area?.trim() || "",
              zipCode: address.zip?.trim() || "",
              country: "",
            },
          ],
        };
        if (isCo && newCustomer.contactPerson?.trim()) {
          const cp = newCustomer.contactPerson.trim().split(/\s+/);
          payload.basicInformation.primaryContact = {
            firstName: cp[0] || "",
            lastName: cp.slice(1).join(" ") || "",
          };
        }
        const cr = await axios.post(`${Base_URL}/customers`, payload, { headers });
        customerId = cr.data?.data?._id || cr.data?._id;
        if (!customerId) {
          notifyError("Customer was not created.");
          setSaving(false);
          return;
        }
      }

      if (!customerId) {
        notifyError("Select or create a customer.");
        setSaving(false);
        return;
      }

      const lineItems = invoiceRowsToJobLineItems(invoiceData.items);
      const descParts = [description.trim()];
      if (leadSource) descParts.unshift(`Lead source: ${leadSource}`);
      const descriptionOut = descParts.filter(Boolean).join("\n");

      let memoOut = "";
      if (savedAlert?.message?.trim()) {
        memoOut = `${memoOut}\n[Alert — ${savedAlert.level}] ${savedAlert.message.trim()}`.trim();
      }
      const flags = [];
      if (!smsOptIn) flags.push("sms_opt_out");
      if (phoneDoNotContact) flags.push("phone_do_not_contact");
      if (flags.length) memoOut = `${memoOut}\n[Contact: ${flags.join(", ")}]`.trim();

      const body = {
        businessId,
        customerId,
        visitType,
        accountMemo: memoOut,
        techNote: "",
        orderNote: "",
        siteNote: "",
        adminNote: "",
        technicianNames: technicianNamesPayload,
        lineItems,
        title: jobTitle.trim() || undefined,
        description: descriptionOut,
        priority,
        status: "assigned",
        serviceAddress: {
          street: address.street,
          city: address.city,
          area: address.area,
          zip: address.zip,
        },
        assignment: {
          vehicleId: schedule.vehicleId,
          date: schedule.dayYmd,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          status: assignmentStatus,
        },
        salesOrderMeta: {
          ...(salesOrderMeta.paymentTerms?.trim()
            ? { paymentTerms: salesOrderMeta.paymentTerms.trim() }
            : {}),
          ...(salesOrderMeta.deliveryMethod?.trim()
            ? { deliveryMethod: salesOrderMeta.deliveryMethod.trim() }
            : {}),
          ...(salesOrderMeta.salesperson?.trim()
            ? { salesperson: salesOrderMeta.salesperson.trim() }
            : {}),
        },
        createLinkedSalesOrder: canCreateLinkedSalesOrder,
      };

      const res = await FleetManagementServices.createJobFromSchedule(body);
      if (res?.success === false) {
        notifyError(res?.message || "Failed to create job");
        return;
      }
      const soNum = res?.data?.salesOrderNumber;
      notifySuccess(
        soNum
          ? `Job created and assigned. Sales order ${soNum} is linked.`
          : "Job created and assigned.",
      );
      onCreated?.(res?.data);
      onClose();
    } catch (err) {
      notifyError(err?.response?.data?.message || err?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const shellClass = maximized
    ? "w-full max-w-[min(120rem,calc(100vw-0.5rem))] max-h-[calc(100vh-0.5rem)]"
    : "w-full max-w-[min(80rem,calc(100vw-0.5rem))] max-h-[calc(100vh-2rem)]";

  const tabs = [
    { id: "customer", label: "Customer detail" },
    { id: "lineItems", label: "Line items" },
    { id: "appointment", label: "Appointment" },
  ];

  return (
    <>
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/50 p-1 sm:p-3 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        className={`${shellClass} flex flex-col overflow-hidden rounded-lg border border-slate-300 bg-white shadow-2xl text-sm text-slate-800`}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 bg-[#1a3a5c] px-4 py-3 text-white">
          <h2 className="text-lg font-semibold tracking-tight">Quick add</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMaximized((m) => !m)}
              className="flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium text-white/90 hover:bg-white/10"
            >
              {maximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              {maximized ? "Restore" : "Maximize"}
            </button>
            <button
              type="button"
              className="rounded-full p-1.5 text-white hover:bg-white/15"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 overflow-hidden">
            {/* Left summary */}
            <aside className="hidden w-[220px] shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
              <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
                {!isSingleAssignedBusiness() && businessOptions.length > 1 ? (
                  <div className="rounded border border-slate-200 p-2.5">
                    <div className="font-bold text-slate-800">Business</div>
                    <select
                      className="mt-2 w-full rounded border border-slate-300 px-2 py-1.5 text-xs"
                      value={businessId}
                      onChange={(e) => setBusinessId(e.target.value)}
                      required
                    >
                      <option value="">Select…</option>
                      {businessOptions.map((b) => (
                        <option key={b._id} value={b._id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => setActiveTab("customer")}
                  className={`w-full rounded border p-2.5 text-left transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                    activeTab === "customer"
                      ? "border-sky-400 bg-sky-50/80 ring-1 ring-sky-300"
                      : "border-slate-200"
                  }`}
                >
                  <div className="font-bold text-slate-800">Account</div>
                  {!hasCustomer ? (
                    <div className="mt-2 flex items-start gap-1.5 text-amber-800">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>No customer selected</span>
                    </div>
                  ) : (
                    <div className="mt-2 text-slate-700 leading-snug">{customerDisplayName || "—"}</div>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("lineItems")}
                  className={`w-full rounded border p-2.5 text-left transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                    activeTab === "lineItems"
                      ? "border-sky-400 bg-sky-50/80 ring-1 ring-sky-300"
                      : "border-slate-200"
                  }`}
                >
                  <div className="font-bold text-slate-800">Order</div>
                  <div className="mt-1 text-slate-700">New work order</div>
                  <div className="mt-1 text-slate-600">
                    Sub total:{" "}
                    {formatSubtotalPreview(
                      invoiceData.items,
                      invoiceData.subtotal,
                      invoiceData.total,
                      invoiceData.currency,
                    )}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("appointment")}
                  className={`w-full rounded border p-2.5 text-left transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                    activeTab === "appointment"
                      ? "border-sky-400 bg-sky-50/80 ring-1 ring-sky-300"
                      : "border-slate-200"
                  }`}
                >
                  <div className="font-bold text-slate-800">Appointment</div>
                  <div className="mt-1 text-sky-700 font-medium">{appointmentSummary}</div>
                  {schedule.vehicleId ? (
                    <div className="mt-1 text-slate-500">
                      {vehicles.find((v) => String(v._id) === String(schedule.vehicleId))?.name ||
                        fleetTerms.vehicleLabelSingular}
                    </div>
                  ) : null}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("customer")}
                  className={`w-full rounded border p-2.5 text-left transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                    activeTab === "customer"
                      ? "border-sky-400 bg-sky-50/80 ring-1 ring-sky-300"
                      : "border-slate-200"
                  }`}
                >
                  <div className="font-bold text-slate-800">Confirmation</div>
                  <div className="mt-1 text-slate-500">
                    {newCustomer.email?.trim() || (customerMode === "select" && selectedCustomerDetail)
                      ? "Email on file — send confirmation from dispatch when ready."
                      : "Add email to enable confirmations."}
                  </div>
                </button>
              </div>
            </aside>

            {/* Main */}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-slate-50/80">
                <div className="flex flex-wrap items-end gap-2 border-b border-slate-200 bg-slate-100 px-2 pt-2">
                  <div className="flex flex-wrap gap-1">
                    {tabs.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setActiveTab(t.id)}
                        className={`rounded-t-md border border-b-0 px-4 py-2 text-xs font-semibold transition-colors ${
                          activeTab === t.id
                            ? "border-slate-200 bg-white text-slate-900"
                            : "border-transparent bg-transparent text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
                {activeTab === "customer" && (
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                    <div className="space-y-3 xl:col-span-4">
                      {!isSingleAssignedBusiness() && businessOptions.length > 1 ? (
                        <div className="md:hidden">
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Business</label>
                          <select
                            className="w-full rounded border border-slate-300 px-2 py-2 text-xs"
                            value={businessId}
                            onChange={(e) => setBusinessId(e.target.value)}
                            required
                          >
                            <option value="">Select business</option>
                            {businessOptions.map((b) => (
                              <option key={b._id} value={b._id}>
                                {b.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : null}

                      {/* Scheduling: hide "Create new" customer for now — re-enable by restoring radios below.
                      <div className="flex gap-3 text-xs border-b border-slate-200 pb-2">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            checked={customerMode === "select"}
                            onChange={() => switchCustomerMode("select")}
                          />
                          Select existing
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            checked={customerMode === "create"}
                            onChange={() => switchCustomerMode("create")}
                          />
                          Create new
                        </label>
                      </div>
                      */}
                      <div className="text-xs font-semibold text-slate-700 border-b border-slate-200 pb-2">
                        Select customer
                      </div>

                      {customerMode === "select" ? (
                        <div className="space-y-3">
                          <SearchableDropdown
                            options={customerOptions}
                            value={selectedCustomerId}
                            onChange={(e) => setSelectedCustomerId(e.target.value)}
                            placeholder="Search customer…"
                            searchKeys={["label", "name"]}
                            sortKey="label"
                          />
                          {selectedCustomerDetail ? (
                            <div
                              className={`rounded border px-2 py-2 text-xs leading-snug ${
                                customerKind === "company"
                                  ? "border-indigo-200 bg-indigo-50/50 text-indigo-950"
                                  : "border-emerald-200 bg-emerald-50/50 text-emerald-950"
                              }`}
                            >
                              <div className="font-semibold">
                                {customerKind === "company" ? "Company" : "Individual"} on file
                              </div>
                              <div className="mt-1 text-slate-700">
                                <span className="text-slate-500">Email:</span> {newCustomer.email || "—"}
                              </div>
                              <div className="text-slate-700">
                                <span className="text-slate-500">Phone:</span> {newCustomer.phone || "—"}
                              </div>
                              <p className="mt-1.5 text-[10px] text-slate-500">
                                Billing and shipping from this account are on the right. Use the buttons there to copy
                                an address into the service site.
                              </p>
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div className="rounded-lg border border-sky-200 bg-sky-50/40 p-3 space-y-3">
                          <div className="text-[11px] font-semibold text-slate-800">
                            New customer
                            <span className="block font-normal text-slate-500 mt-0.5">
                              Saved under the business selected above (same as full Add Customer).
                            </span>
                          </div>
                          <div className="inline-flex rounded-md border border-slate-300 bg-white p-0.5 text-xs">
                            <button
                              type="button"
                              onClick={() => setCustomerKind("individual")}
                              className={`rounded px-3 py-1.5 font-medium ${
                                customerKind === "individual" ? "bg-slate-800 text-white" : "text-slate-600"
                              }`}
                            >
                              Individual
                            </button>
                            <button
                              type="button"
                              onClick={() => setCustomerKind("company")}
                              className={`rounded px-3 py-1.5 font-medium ${
                                customerKind === "company" ? "bg-slate-800 text-white" : "text-slate-600"
                              }`}
                            >
                              Company
                            </button>
                          </div>

                          {customerKind === "company" ? (
                            <div className="space-y-2">
                              <input
                                className="w-full rounded border border-slate-300 px-2 py-2"
                                placeholder="Company name *"
                                value={newCustomer.companyName}
                                onChange={(e) => setNewCustomer((p) => ({ ...p, companyName: e.target.value }))}
                              />
                              <input
                                className="w-full rounded border border-slate-300 px-2 py-2"
                                placeholder="Contact person"
                                value={newCustomer.contactPerson}
                                onChange={(e) => setNewCustomer((p) => ({ ...p, contactPerson: e.target.value }))}
                              />
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                className="rounded border border-slate-300 px-2 py-2"
                                placeholder="First name"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                              />
                              <input
                                className="rounded border border-slate-300 px-2 py-2"
                                placeholder="Last name"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                              />
                            </div>
                          )}
                          <div className="flex gap-2">
                            <select
                              className="w-28 shrink-0 rounded border border-slate-300 px-2 py-2 text-xs"
                              value={phoneType}
                              onChange={(e) => setPhoneType(e.target.value)}
                            >
                              <option value="mobile">Mobile</option>
                              <option value="work">Work</option>
                            </select>
                            <div className="relative min-w-0 flex-1">
                              <input
                                className="w-full rounded border border-slate-300 px-2 py-2 pr-[4.25rem]"
                                placeholder="Phone"
                                value={newCustomer.phone}
                                onChange={(e) => setNewCustomer((p) => ({ ...p, phone: e.target.value }))}
                              />
                              <div className="absolute right-1 top-1/2 flex -translate-y-1/2 gap-0.5">
                                <button
                                  type="button"
                                  title={smsOptIn ? "SMS updates on — click to opt out" : "SMS off — click to opt in"}
                                  aria-pressed={smsOptIn}
                                  onClick={() => {
                                    setSmsOptIn((v) => {
                                      const next = !v;
                                      notifySuccess(
                                        next
                                          ? "SMS updates enabled for this job."
                                          : "SMS updates disabled for this job.",
                                      );
                                      return next;
                                    });
                                  }}
                                  className={`rounded p-1 ${
                                    smsOptIn ? "text-sky-600 hover:bg-sky-50" : "text-slate-300 hover:bg-slate-100"
                                  }`}
                                >
                                  <MessageCircle className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  title={
                                    phoneDoNotContact
                                      ? "Do not contact — click to allow calls"
                                      : "Allow contact — click to mark do not contact"
                                  }
                                  aria-pressed={phoneDoNotContact}
                                  onClick={() => {
                                    setPhoneDoNotContact((v) => {
                                      const next = !v;
                                      notifySuccess(
                                        next ? "Phone marked do not contact." : "Phone contact allowed.",
                                      );
                                      return next;
                                    });
                                  }}
                                  className={`rounded p-1 ${
                                    phoneDoNotContact
                                      ? "text-amber-700 hover:bg-amber-50"
                                      : "text-slate-300 hover:bg-slate-100"
                                  }`}
                                >
                                  <PhoneOff className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                          <input
                            className="w-full rounded border border-slate-300 px-2 py-2"
                            placeholder="Email *"
                            type="email"
                            value={newCustomer.email}
                            onChange={(e) => setNewCustomer((p) => ({ ...p, email: e.target.value }))}
                            required
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Lead source</label>
                        <select
                          className="w-full rounded border border-slate-300 px-2 py-2"
                          value={leadSource}
                          onChange={(e) => setLeadSource(e.target.value)}
                        >
                          <option value="">Select…</option>
                          {LEAD_SOURCES.map((ls) => (
                            <option key={ls} value={ls}>
                              {ls}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setReviewOpen(true)}
                          className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <ClipboardList className="h-3.5 w-3.5" />
                          Review
                        </button>
                        <button
                          type="button"
                          onClick={() => setAlertOpen(true)}
                          className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100"
                        >
                          <Bell className="h-3.5 w-3.5" />
                          Alert
                        </button>
                        {savedAlert?.message ? (
                          <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                            Alert: {savedAlert.level} — {savedAlert.message.slice(0, 40)}
                            {savedAlert.message.length > 40 ? "…" : ""}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="space-y-3 xl:col-span-4">
                      <div className="text-xs font-bold text-slate-800">Site</div>
                      <div className="flex gap-1">
                        <input
                          ref={siteStreetInputRef}
                          className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-2"
                          placeholder="Service address / street"
                          value={address.street}
                          onChange={(e) => setAddress((p) => ({ ...p, street: e.target.value }))}
                        />
                        <button
                          type="button"
                          title="Open in Google Maps"
                          onClick={openServiceInMaps}
                          className="shrink-0 rounded border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-sky-700"
                        >
                          <MapPin className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Edit street line"
                          onClick={() => siteStreetInputRef.current?.focus()}
                          className="shrink-0 rounded border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Search address in Maps"
                          onClick={openServiceInMaps}
                          className="shrink-0 rounded border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-sky-700"
                        >
                          <Search className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          className="rounded border border-slate-300 px-2 py-2"
                          placeholder="City"
                          value={address.city}
                          onChange={(e) => setAddress((p) => ({ ...p, city: e.target.value }))}
                        />
                        <input
                          className="rounded border border-slate-300 px-2 py-2"
                          placeholder="Area / state"
                          value={address.area}
                          onChange={(e) => setAddress((p) => ({ ...p, area: e.target.value }))}
                        />
                        <input
                          className="col-span-2 rounded border border-slate-300 px-2 py-2"
                          placeholder="ZIP"
                          value={address.zip}
                          onChange={(e) => setAddress((p) => ({ ...p, zip: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="space-y-3 text-xs xl:col-span-4">
                      {selectedCustomerDetail && customerMode === "select" ? (
                        <>
                          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                              Billing address
                            </div>
                            <div className="mt-1.5 text-slate-700 leading-relaxed">
                              {billingShipping.billing ? (
                                formatAddressLines(billingShipping.billing).map((ln, i) => <div key={i}>{ln}</div>)
                              ) : (
                                <span className="text-slate-400">No billing address on file.</span>
                              )}
                            </div>
                            <button
                              type="button"
                              disabled={!billingShipping.billing}
                              onClick={() => billingShipping.billing && applyServiceFromAddress(billingShipping.billing)}
                              className="mt-2 w-full rounded border border-slate-200 py-1.5 text-[11px] font-semibold text-sky-700 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Use billing for service site
                            </button>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                              Shipping address
                            </div>
                            <div className="mt-1.5 text-slate-700 leading-relaxed">
                              {billingShipping.shipping ? (
                                formatAddressLines(billingShipping.shipping).map((ln, i) => <div key={i}>{ln}</div>)
                              ) : (
                                <span className="text-slate-400">No shipping address on file.</span>
                              )}
                            </div>
                            <button
                              type="button"
                              disabled={!billingShipping.shipping}
                              onClick={() =>
                                billingShipping.shipping && applyServiceFromAddress(billingShipping.shipping)
                              }
                              className="mt-2 w-full rounded border border-slate-200 py-1.5 text-[11px] font-semibold text-sky-700 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Use shipping for service site
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 p-4 text-center text-slate-500">
                          <div className="font-semibold text-slate-700">Customer addresses</div>
                          <p className="mt-2 leading-relaxed">
                            Choose <span className="font-medium">Select existing</span> and pick a customer to load
                            billing and shipping here, or enter the service site in the middle column.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === "lineItems" && (
                  <div className="space-y-4 min-w-0">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <input
                        className="rounded border border-slate-300 px-3 py-2.5 text-sm"
                        placeholder="Job title (optional)"
                        value={jobTitle}
                        onChange={(e) => setJobTitle(e.target.value)}
                      />
                      <select
                        className="rounded border border-slate-300 px-3 py-2.5 text-sm"
                        value={priority}
                        onChange={(e) => setPriority(e.target.value)}
                      >
                        <option value="low">Low priority</option>
                        <option value="medium">Medium priority</option>
                        <option value="high">High priority</option>
                      </select>
                    </div>
                    <textarea
                      className="w-full rounded border border-slate-300 px-3 py-2.5 text-sm"
                      rows={2}
                      placeholder="Job description (optional)"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                    {/* Min width so item/qty/rate fields do not collapse in non-maximized Quick add; scroll horizontally if needed. */}
                    <div className="rounded border border-slate-200 bg-white p-2 sm:p-3 overflow-x-auto">
                      <div className={maximized ? "min-w-0" : "min-w-[58rem]"}>
                        <ZohoStyleItemTable
                          invoiceData={invoiceData}
                          setInvoiceData={setInvoiceData}
                          currency={invoiceData.currency || DEFAULT_JOB_CURRENCY}
                          businessItems={businessItems}
                          taxes={taxes}
                          businessId={businessId}
                          headers={headers}
                          onBulkAdd={() => setBulkOpen(true)}
                          lineItemCustomFieldDefinitions={[]}
                          fitNumericColumns={!maximized}
                        />
                      </div>
                    </div>
                    {businessData?.timezone ? (
                      <p className="text-xs text-slate-500">
                        Business timezone: <span className="font-mono">{businessData.timezone}</span>
                      </p>
                    ) : (
                      <p className="text-xs text-amber-700">
                        No business timezone set — UTC is used for stored times.
                      </p>
                    )}
                  </div>
                )}

                {activeTab === "appointment" && (
                  <div className="mx-auto max-w-xl space-y-4">
                    <label className="block text-xs font-semibold text-slate-700">
                      Date
                      <input
                        type="date"
                        className="mt-1 w-full rounded border border-slate-300 px-2 py-2"
                        value={schedule.dayYmd}
                        onChange={(e) => setSchedule((p) => ({ ...p, dayYmd: e.target.value }))}
                      />
                    </label>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="block text-xs font-semibold text-slate-700">
                        Start time
                        <input
                          type="time"
                          className="mt-1 w-full rounded border border-slate-300 px-2 py-2 font-mono"
                          value={schedule.startTime}
                          onChange={(e) => {
                            const v = e.target.value;
                            setSchedule((p) => ({
                              ...p,
                              startTime: v,
                              endTime: addMinutesToTimeHHmm(v, durationMins),
                            }));
                          }}
                        />
                      </label>
                      <label className="block text-xs font-semibold text-slate-700">
                        Duration
                        <select
                          className="mt-1 w-full rounded border border-slate-300 px-2 py-2"
                          value={durationMins}
                          onChange={(e) => {
                            const mins = Number(e.target.value);
                            setDurationMins(mins);
                            setSchedule((p) => ({
                              ...p,
                              endTime: addMinutesToTimeHHmm(p.startTime, mins),
                            }));
                          }}
                        >
                          {DURATION_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label className="block text-xs font-semibold text-slate-700">
                      End time
                      <input
                        type="time"
                        className="mt-1 w-full rounded border border-slate-300 px-2 py-2 font-mono"
                        value={schedule.endTime}
                        onChange={(e) => {
                          const v = e.target.value;
                          setSchedule((p) => {
                            const d = timeDiffMinutes(p.startTime, v);
                            setDurationMins(d);
                            return { ...p, endTime: v };
                          });
                        }}
                      />
                    </label>
                    <label className="block text-xs font-semibold text-slate-700">
                      {fleetTerms.vehicleLabelSingular}
                      <select
                        className="mt-1 w-full rounded border border-slate-300 px-2 py-2"
                        value={schedule.vehicleId}
                        onChange={(e) => setSchedule((p) => ({ ...p, vehicleId: e.target.value }))}
                      >
                        <option value="">{`Select ${fleetTerms.vehicleLabelSingular.toLowerCase()}`}</option>
                        {vehicles.map((v) => (
                          <option key={v._id} value={v._id}>
                            {v.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-xs font-semibold text-slate-700">
                      Status
                      <select
                        className="mt-1 w-full rounded border border-slate-300 px-2 py-2"
                        value={assignmentStatus}
                        onChange={(e) => setAssignmentStatus(e.target.value)}
                      >
                        {ASSIGNMENT_STATUSES.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-xs font-semibold text-slate-700">
                      Type
                      <select
                        className="mt-1 w-full rounded border border-slate-300 px-2 py-2"
                        value={visitType}
                        onChange={(e) => setVisitType(e.target.value)}
                      >
                        {VISIT_TYPES.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div>
                      <div className="text-xs font-semibold text-slate-700">Technicians</div>
                      <p className="text-[11px] text-slate-500 mt-0.5 mb-2">Staff for this business (multi-select)</p>
                      <div className="max-h-44 overflow-y-auto rounded border border-slate-200 bg-white p-2 space-y-1">
                        {staffList.length === 0 ? (
                          <div className="text-xs text-slate-500 py-2">No staff loaded for this business.</div>
                        ) : (
                          staffList.map((s) => {
                            const id = String(s._id);
                            const checked = selectedTechnicianIds.includes(id);
                            return (
                              <label
                                key={id}
                                className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-slate-50"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleTechnician(id)}
                                />
                                <span className="text-xs">{staffDisplayName(s)}</span>
                              </label>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                )}
                </div>
            </div>
          </div>

          <BulkAddItemsModal
            isOpen={bulkOpen}
            onClose={() => setBulkOpen(false)}
            items={businessItems}
            onAddItems={handleBulkAddItems}
            currency={invoiceData.currency || DEFAULT_JOB_CURRENCY}
          />

          <footer className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-slate-200 bg-slate-100 px-4 py-3">
            <button
              type="button"
              className="rounded border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save and close"}
              <ChevronRight className="h-4 w-4" />
            </button>
          </footer>
        </form>
      </div>
    </div>

    {reviewOpen ? (
      <div
        className="fixed inset-0 z-[225] flex items-center justify-center bg-slate-900/50 p-4"
        role="presentation"
        onClick={() => setReviewOpen(false)}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-add-review-title"
          className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 text-sm shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
            <h3 id="quick-add-review-title" className="text-base font-bold text-slate-900">
              Job review
            </h3>
            <button
              type="button"
              className="rounded p-1 text-slate-500 hover:bg-slate-100"
              onClick={() => setReviewOpen(false)}
              aria-label="Close review"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="mt-3 text-xs text-slate-600">
            Summary before you save — same flow as dispatch boards (customer, order, route window).
          </p>
          <ul className="mt-4 space-y-3 text-xs text-slate-800">
            {!isSingleAssignedBusiness() && businessOptions.length > 1 ? (
              <li className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <span className="font-bold text-slate-600">Business</span>
                <div className="mt-1">{businessOptions.find((b) => String(b._id) === String(businessId))?.name || "—"}</div>
              </li>
            ) : null}
            <li className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <span className="font-bold text-slate-600">Customer</span>
              <div className="mt-1">{customerDisplayName || "—"}</div>
              <div className="text-slate-600 mt-0.5">
                {newCustomer.email || "—"} · {newCustomer.phone || "—"}
              </div>
            </li>
            <li className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <span className="font-bold text-slate-600">Service site</span>
              <div className="mt-1">{mapsQueryFromAddress(address.street, address.city, address.area, address.zip) || "—"}</div>
            </li>
            <li className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <span className="font-bold text-slate-600">Line items</span>
              <div className="mt-1">
                {(invoiceData.items || []).length} line(s) · Subtotal{" "}
                {formatSubtotalPreview(
                  invoiceData.items,
                  invoiceData.subtotal,
                  invoiceData.total,
                  invoiceData.currency,
                )}
              </div>
            </li>
            <li className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <span className="font-bold text-slate-600">Appointment</span>
              <div className="mt-1">{appointmentSummary}</div>
              <div className="text-slate-600">
                {vehicles.find((v) => String(v._id) === String(schedule.vehicleId))?.name ||
                  `${fleetTerms.vehicleLabelSingular} not set`}{" "}
                ·{" "}
                {ASSIGNMENT_STATUSES.find((s) => s.value === assignmentStatus)?.label} ·{" "}
                {VISIT_TYPES.find((s) => s.value === visitType)?.label}
              </div>
            </li>
            {savedAlert?.message ? (
              <li className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-amber-950">
                <span className="font-bold">Alert</span>
                <div className="mt-1">
                  [{savedAlert.level}] {savedAlert.message}
                </div>
              </li>
            ) : null}
          </ul>
          <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50"
              onClick={() => {
                setActiveTab("customer");
                setReviewOpen(false);
              }}
            >
              Edit customer
            </button>
            <button
              type="button"
              className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50"
              onClick={() => {
                setActiveTab("lineItems");
                setReviewOpen(false);
              }}
            >
              Edit line items
            </button>
            <button
              type="button"
              className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50"
              onClick={() => {
                setActiveTab("appointment");
                setReviewOpen(false);
              }}
            >
              Edit appointment
            </button>
            <button
              type="button"
              className="ml-auto rounded-md bg-[#1a3a5c] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#15324f]"
              onClick={() => setReviewOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    ) : null}

    {alertOpen ? (
      <div
        className="fixed inset-0 z-[226] flex items-center justify-center bg-slate-900/50 p-4"
        role="presentation"
        onClick={() => setAlertOpen(false)}
      >
        <div
          role="dialog"
          aria-modal="true"
          className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 text-sm shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900">Dispatch alert</h3>
            <button
              type="button"
              className="rounded p-1 text-slate-500 hover:bg-slate-100"
              onClick={() => setAlertOpen(false)}
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-600">
            Crew-facing alert stored on this job (shown in account memo when saved).
          </p>
          <label className="mt-4 block text-xs font-semibold text-slate-700">
            Severity
            <select
              className="mt-1 w-full rounded border border-slate-300 px-2 py-2"
              value={alertDraft.level}
              onChange={(e) => setAlertDraft((d) => ({ ...d, level: e.target.value }))}
            >
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
          </label>
          <label className="mt-3 block text-xs font-semibold text-slate-700">
            Message
            <textarea
              className="mt-1 w-full rounded border border-slate-300 px-2 py-2 text-xs"
              rows={3}
              placeholder="e.g. Dog on site, gate code 1234…"
              value={alertDraft.message}
              onChange={(e) => setAlertDraft((d) => ({ ...d, message: e.target.value }))}
            />
          </label>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="rounded-md border border-slate-200 px-3 py-2 text-xs font-medium hover:bg-slate-50"
              onClick={() => {
                setSavedAlert(null);
                setAlertDraft({ message: "", level: "warning" });
                notifySuccess("Alert removed from this draft.");
              }}
            >
              Clear saved
            </button>
            <button
              type="button"
              className="rounded-md border border-slate-200 px-3 py-2 text-xs font-medium hover:bg-slate-50"
              onClick={() => setAlertOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-md bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700"
              onClick={() => {
                if (!alertDraft.message.trim()) {
                  notifyError("Enter an alert message.");
                  return;
                }
                setSavedAlert({ message: alertDraft.message.trim(), level: alertDraft.level });
                setAlertOpen(false);
                notifySuccess("Alert saved on this draft — it will be stored when you save the job.");
              }}
            >
              Save alert
            </button>
          </div>
        </div>
      </div>
    ) : null}
    </>
  );
}
