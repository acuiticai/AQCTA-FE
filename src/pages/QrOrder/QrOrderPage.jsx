import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams } from "react-router-dom";
import {
  Search,
  Plus,
  Minus,
  ShoppingCart,
  X,
  Send,
  Building2,
  Utensils,
  CheckCircle2,
  StickyNote,
  Loader2,
  AlertCircle,
  ChevronDown,
} from "lucide-react";
import QrOrderServices from "@/services/QrOrderServices";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const resolveLogo = (url) => {
  if (!url || typeof url !== "string") return "";
  if (url.startsWith("http") || url.startsWith("data:")) return url;
  return `${Base_URL}${url.startsWith("/") ? "" : "/"}${url}`;
};

// Return a stable device-session ID for this token, persisted in localStorage
// so each physical device (phone/tablet) gets its own separate order on the table.
const getGuestSessionId = (token) => {
  if (typeof window === "undefined") return "";
  const key = `qr_session_${token}`;
  let id = localStorage.getItem(key);
  if (!id) {
    id =
      (typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `guest_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    localStorage.setItem(key, id);
  }
  return id;
};

const QrOrderPage = () => {
  const { token } = useParams();
  const guestSessionId = useMemo(() => getGuestSessionId(token), [token]);
  const [context, setContext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [cart, setCart] = useState([]); // [{itemId, name, quantity, note, rate}]
  const [cartOpen, setCartOpen] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [orderNote, setOrderNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [noteEditorFor, setNoteEditorFor] = useState(null);
  const [statusPoll, setStatusPoll] = useState(null);
  const [displayCount, setDisplayCount] = useState(12);
  // Optional guest name — persisted per session so it survives page reloads.
  const [guestName, setGuestName] = useState(
    () => (typeof window !== "undefined" ? localStorage.getItem(`qr_name_${token}`) || "" : "")
  );
  const mountedRef = useRef(true);
  const previousTicketStatusRef = useRef({});

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const notifyGuestStatusChange = useCallback((title, body) => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "granted") {
      try {
        new Notification(title, { body });
      } catch (_) {
        // no-op
      }
      return;
    }
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  const fetchContext = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await QrOrderServices.getContext(token, guestSessionId);
      if (res.data?.success) {
        setContext(res.data.data);
      } else {
        setLoadError(res.data?.message || "Unable to load menu.");
      }
    } catch (err) {
      setLoadError(
        err?.response?.data?.message ||
          "This QR code is invalid, expired, or has been revoked."
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchContext();
  }, [fetchContext]);

  // Poll order status so the guest can track their food even across reloads.
  const pollOrderStatus = useCallback(async () => {
    try {
      const res = await QrOrderServices.getOrderStatus(token, guestSessionId);
      if (mountedRef.current && res.data?.success) {
        const data = res.data.data || {};
        const tickets = Array.isArray(data.tickets) ? data.tickets : [];
        const prev = previousTicketStatusRef.current || {};
        const next = {};

        tickets.forEach((t) => {
          const key = String(t?._id || t?.ticketNumber || "");
          if (!key) return;
          const currentStatus = String(t?.status || "");
          next[key] = currentStatus;
          const previousStatus = prev[key];
          if (
            previousStatus &&
            previousStatus !== currentStatus &&
            (currentStatus === "ready" || currentStatus === "served")
          ) {
            const ticketLabel = t?.ticketNumber ? `Ticket ${t.ticketNumber}` : "Your order";
            notifyGuestStatusChange(
              currentStatus === "served" ? "Order Served" : "Order Ready",
              `${ticketLabel} is now ${currentStatus}.`
            );
          }
        });

        previousTicketStatusRef.current = next;
        setStatusPoll(data);
      }
    } catch (_) {
      // silent
    }
  }, [token, guestSessionId, notifyGuestStatusChange]);

  // Determine whether polling should stay active. Stop once the guest's
  // order has been fully served AND checked out (so the card doesn't linger
  // forever after the table is freed).
  const shouldKeepPolling = useMemo(() => {
    const order = statusPoll?.order;
    const tickets = statusPoll?.tickets || [];
    if (!order && !successMsg) return false;
    if (!order) return !!successMsg;
    if (order.status === "completed") {
      const allServedOrCancelled = tickets.every(
        (t) => t.status === "served" || t.status === "cancelled"
      );
      return !allServedOrCancelled;
    }
    return true; // order open → keep polling
  }, [statusPoll, successMsg]);

  // Initial fetch on mount — surface any order that already exists for this
  // table/QR even if the guest reloaded or came back later.
  useEffect(() => {
    pollOrderStatus();
  }, [pollOrderStatus]);

  // Realtime stream from backend for immediate kitchen status updates.
  useEffect(() => {
    if (!token) return undefined;
    const stream = QrOrderServices.createRealtimeStream(token, guestSessionId);
    stream.onmessage = (evt) => {
      if (!evt?.data) return;
      let payload = null;
      try {
        payload = JSON.parse(evt.data);
      } catch (_) {
        payload = null;
      }
      if (!payload) return;
      // Refresh on kitchen updates OR when POS staff edits order items.
      if (payload.event === "kitchen.ticket.updated" || payload.type === "order:items_updated") {
        pollOrderStatus();
      }
    };
    stream.onerror = () => {
      // EventSource handles automatic reconnect.
    };
    return () => stream.close();
  }, [token, pollOrderStatus]);

  // Live polling — only while an order is active
  useEffect(() => {
    if (!shouldKeepPolling) return;
    const id = setInterval(pollOrderStatus, 10000);
    return () => clearInterval(id);
  }, [shouldKeepPolling, pollOrderStatus]);

  // Clear this device's session from localStorage once the order is fully complete
  // so the next customer scanning the same QR starts fresh.
  useEffect(() => {
    if (!token) return;
    const order = statusPoll?.order;
    if (!order || order.status !== "completed") return;
    const tickets = statusPoll?.tickets || [];
    const allTerminal =
      tickets.length === 0 ||
      tickets.every((t) => t.status === "served" || t.status === "cancelled");
    if (allTerminal) {
      localStorage.removeItem(`qr_session_${token}`);
      localStorage.removeItem(`qr_name_${token}`);
    }
  }, [statusPoll, token]);

  const categories = context?.menu?.categories || [];
  const items = context?.menu?.items || [];

  const filteredItems = useMemo(() => {
    let list = items;
    if (activeCategory !== "all") {
      list = list.filter(
        (i) => String(i.category) === String(activeCategory)
      );
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (i) =>
          (i.name || "").toLowerCase().includes(q) ||
          (i.itemCode || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [items, activeCategory, search]);

  // Reset pagination when search or category changes
  useEffect(() => {
    setDisplayCount(12);
  }, [activeCategory, search]);

  const totals = useMemo(() => {
    const subtotal = cart.reduce(
      (sum, c) => sum + (Number(c.rate) || 0) * (Number(c.quantity) || 0),
      0
    );
    const count = cart.reduce((sum, c) => sum + (Number(c.quantity) || 0), 0);
    const cfg = context?.chargeSettings || {};
    const taxEnabled = !!cfg.taxEnabled;
    const taxType = cfg.taxType === "fixed" ? "fixed" : "percentage";
    const taxValue = Number(cfg.taxValue ?? cfg.taxRate ?? 0) || 0;
    const serviceEnabled = !!cfg.serviceChargeEnabled;
    const serviceType =
      cfg.serviceChargeType === "fixed" ? "fixed" : "percentage";
    const serviceValue =
      Number(cfg.serviceChargeValue ?? cfg.serviceChargeRate ?? 0) || 0;
    const taxOnService = cfg.taxOnServiceCharge !== false;

    const serviceChargeAmount = serviceEnabled
      ? serviceType === "fixed"
        ? serviceValue
        : (subtotal * serviceValue) / 100
      : 0;
    const taxBase = taxOnService
      ? subtotal + serviceChargeAmount
      : subtotal;
    const taxAmount = taxEnabled
      ? taxType === "fixed"
        ? taxValue
        : (taxBase * taxValue) / 100
      : 0;
    const total = subtotal + serviceChargeAmount + taxAmount;

    return {
      subtotal,
      count,
      taxAmount,
      serviceChargeAmount,
      total,
      taxType,
      taxValue,
      serviceType,
      serviceValue,
    };
  }, [cart, context?.chargeSettings]);

  const liveOrderSummary = useMemo(() => {
    const o = statusPoll?.order;
    if (!o) return null;
    const orderItems = Array.isArray(o.items) ? o.items : [];
    const itemsCount = orderItems.reduce(
      (s, it) => s + Number(it.quantity || 0),
      0,
    );
    // Separate items by who added them
    const customerItems = orderItems.filter((it) => it.lineSource === "qr_customer");
    const waiterItems = orderItems.filter((it) => it.lineSource !== "qr_customer");
    const hasMixedSources = customerItems.length > 0 && waiterItems.length > 0;
    return {
      orderNumber: o.orderNumber || "-",
      orderTime: o.createdAt || o.updatedAt || null,
      status: o.status || "open",
      paymentState: o.paymentState || "unpaid",
      items: orderItems,
      customerItems,
      waiterItems,
      hasMixedSources,
      itemsCount,
      subtotal: Number(o.subtotal || 0),
      serviceChargeAmount: Number(o.serviceChargeAmount || 0),
      taxAmount: Number(o.taxAmount || 0),
      total: Number(o.total || 0),
      paidAmount: Number(o.paidAmount || 0),
      dueAmount: Number(o.dueAmount ?? o.total ?? 0),
    };
  }, [statusPoll]);

  const addToCart = useCallback((item) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.itemId === item._id);
      if (existing) {
        return prev.map((c) =>
          c.itemId === item._id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [
        ...prev,
        {
          itemId: item._id,
          name: item.name,
          rate: Number(item?.salesInformation?.sellingPrice || 0),
          quantity: 1,
          note: "",
        },
      ];
    });
  }, []);

  const updateQty = useCallback((itemId, delta) => {
    setCart((prev) =>
      prev
        .map((c) =>
          c.itemId === itemId
            ? { ...c, quantity: Math.max(0, c.quantity + delta) }
            : c
        )
        .filter((c) => c.quantity > 0)
    );
  }, []);

  const setItemNote = useCallback((itemId, note) => {
    setCart((prev) =>
      prev.map((c) => (c.itemId === itemId ? { ...c, note } : c))
    );
  }, []);

  const submit = useCallback(async () => {
    if (!cart.length) return;
    setSubmitting(true);
    try {
      const trimmedName = guestName.trim();
      if (trimmedName) localStorage.setItem(`qr_name_${token}`, trimmedName);
      const payload = {
        items: cart.map((c) => ({
          itemId: c.itemId,
          quantity: c.quantity,
          note: c.note || "",
        })),
        customerNotes: orderNote,
        paymentOption: "pay_later",
        qrSessionId: guestSessionId,
        guestName: trimmedName || undefined,
      };
      const res = await QrOrderServices.submitOrder(token, payload);
      if (res.data?.success) {
        setCart([]);
        setCartOpen(false);
        setOrderNote("");
        setSuccessMsg(
          res.data.resumed
            ? "Added to your existing table order — heading to the kitchen!"
            : "Order sent to kitchen. Pay at the counter when ready."
        );
        fetchContext();
        // Immediately surface the order summary so the customer doesn't
        // wait up to 10 s for the polling interval to fire.
        pollOrderStatus();
      } else {
        setLoadError(res.data?.message || "Failed to submit order");
      }
    } catch (err) {
      setLoadError(
        err?.response?.data?.message || "Could not send order. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }, [cart, orderNote, token, guestName, fetchContext, pollOrderStatus]);

  // ── Render states ────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-3">
        <div className="h-12 w-12 rounded-2xl bg-[var(--p-blue)]/10 flex items-center justify-center">
          <Loader2 size={22} className="animate-spin text-[var(--p-blue)]" />
        </div>
        <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider">Loading menu…</p>
      </div>
    );
  }

  if (loadError && !context) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-sm w-full text-center bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-red-100 text-red-600 mb-3">
            <AlertCircle size={24} />
          </div>
          <h1 className="text-base font-bold text-gray-900">
            QR link unavailable
          </h1>
          <p className="text-sm text-gray-500 mt-1">{loadError}</p>
          <button
            type="button"
            onClick={fetchContext}
            className="mt-4 inline-flex items-center gap-1.5 px-3 h-9 text-xs font-semibold text-white bg-[var(--p-blue)] rounded-lg hover:opacity-90"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const biz = context?.business || {};
  const tbl = context?.table || {};
  const bizLogo = resolveLogo(biz.image);

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-y-auto overscroll-contain">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-sm border-b border-gray-200/80 sticky top-0 z-20 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 pt-3.5 pb-3 flex items-center gap-3">
          <div className="h-14 w-14 rounded-2xl border border-gray-200/80 bg-gray-50 overflow-hidden flex items-center justify-center shrink-0 shadow-sm">
            {bizLogo ? (
              <img
                src={bizLogo}
                alt={biz.name}
                className="h-full w-full object-contain"
              />
            ) : (
              <Building2 size={24} className="text-gray-400" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-extrabold text-gray-900 leading-tight truncate tracking-tight">
              {biz.name || "Our Restaurant"}
            </h1>
            <div className="mt-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 text-[11px] font-semibold text-gray-600">
                <Utensils size={10} className="text-gray-400" />
                Table <span className="text-gray-900 font-bold">{tbl.tableNumber}</span>
                {tbl.label ? ` · ${tbl.label}` : ""}
                {tbl.floor ? ` · ${tbl.floor}` : ""}
              </span>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="max-w-2xl mx-auto px-4 pb-3">
          <div className="relative">
            <Search
              size={15}
              className="absolute left-1 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search menu…"
              className="w-full pl-10 pr-3 h-11 text-sm bg-gray-50 outline-none border-2 border-gray-200 rounded-2xl focus:border-[var(--p-blue)] focus:bg-white transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 inline-flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Category chips */}
        <div className="max-w-2xl mx-auto px-4 pb-3 overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveCategory("all")}
              className={`px-4 h-8 text-[12px] font-semibold rounded-xl whitespace-nowrap transition-all duration-150 ${
                activeCategory === "all"
                  ? "bg-[var(--p-blue)] text-white shadow-sm shadow-[var(--p-blue)]/30"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c._id}
                type="button"
                onClick={() => setActiveCategory(c._id)}
                className={`px-4 h-8 text-[12px] font-semibold rounded-xl whitespace-nowrap transition-all duration-150 ${
                  activeCategory === c._id
                    ? "bg-[var(--p-blue)] text-white shadow-sm shadow-[var(--p-blue)]/30"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Table has active orders notice — shown when this device has no order yet
          but other customers/staff already have open orders at this table */}
      {statusPoll && !statusPoll.order && !successMsg &&
        (statusPoll.tableContext?.openOrderCount ?? 0) > 0 && (
        <div className="max-w-2xl mx-auto w-full px-4 pt-3">
          <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-3">
            <Utensils size={16} className="text-amber-500 mt-0.5 shrink-0" />
            <div className="text-[12px] text-amber-800">
              <span className="font-bold">Table is occupied</span>
              {" "}— {statusPoll.tableContext.openOrderCount} active order{statusPoll.tableContext.openOrderCount !== 1 ? "s" : ""} in progress.
              Browse the menu and add items to place your own separate order.
            </div>
          </div>
        </div>
      )}

      {/* Live order status banner */}
      {(successMsg || statusPoll?.order) && (
        <div className="max-w-2xl mx-auto w-full px-4 pt-3">
          <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 overflow-hidden shadow-sm">
            <div className="flex items-start gap-3 p-4">
              <div className="h-9 w-9 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0 shadow-sm">
                <CheckCircle2 size={18} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-emerald-900">
                  {successMsg ||
                    (statusPoll?.order?.status === "completed"
                      ? "Your order is checked out. Enjoy your meal!"
                      : "Your order is in the kitchen")}
                </div>
                {statusPoll?.order?.orderNumber && (
                  <div className="text-[11px] text-emerald-700 mt-0.5 font-medium">
                    Order #{statusPoll.order.orderNumber}
                  </div>
                )}
                {(() => {
                  const allTickets = statusPoll?.tickets || [];
                  // Only show active (non-served, non-cancelled) tickets.
                  // Served/cancelled tickets are from previous kitchen batches and
                  // should not re-appear when new items are added to the same order.
                  const activeTickets = allTickets.filter(
                    (t) => t.status !== "served" && t.status !== "cancelled",
                  );
                  const allDone =
                    allTickets.length > 0 && activeTickets.length === 0;

                  if (allDone) {
                    return (
                      <div className="mt-2 text-[11px] text-emerald-700 font-semibold flex items-center gap-1.5">
                        <CheckCircle2 size={11} />
                        All dishes served!
                      </div>
                    );
                  }
                  if (activeTickets.length > 0) {
                    return (
                      <div className="mt-2.5 space-y-1.5">
                        {activeTickets.map((t) => (
                          <div
                            key={t._id}
                            className="flex items-center justify-between gap-2 bg-white rounded-xl px-3 py-2 border border-emerald-100 shadow-sm"
                          >
                            <span className="text-[12px] font-semibold text-gray-800 truncate">
                              {t.sectionName} · {t.ticketNumber}
                              <span className="font-normal text-gray-500 ml-1">
                                ({(t.items || []).reduce((s, i) => s + (i.quantity || 0), 0)} items)
                              </span>
                            </span>
                            <span
                              className={`font-bold uppercase text-[9px] px-2 py-1 rounded-lg shrink-0 ${
                                t.status === "ready"
                                  ? "bg-emerald-500 text-white"
                                  : t.status === "preparing"
                                  ? "bg-amber-500 text-white"
                                  : "bg-gray-200 text-gray-700"
                              }`}
                            >
                              {t.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  return (
                    <div className="mt-2 text-[11px] text-emerald-700 flex items-center gap-1.5">
                      <Loader2 size={11} className="animate-spin" />
                      Order received — waiting to be sent to kitchen
                    </div>
                  );
                })()}
              </div>
              {successMsg && (
                <button
                  type="button"
                  onClick={() => setSuccessMsg("")}
                  className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-emerald-500 hover:text-emerald-700 hover:bg-emerald-100 transition-colors shrink-0"
                  title="Dismiss"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {liveOrderSummary && (
        <section className="max-w-2xl mx-auto w-full px-4 pt-3">
          <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
            {/* Clickable header — always visible */}
            <button
              type="button"
              onClick={() => setSummaryExpanded((v) => !v)}
              className="w-full px-4 py-3 bg-gradient-to-b from-white to-gray-50/60 border-b border-gray-100 text-left"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-extrabold text-gray-900 tracking-tight">
                  Current order summary
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-500 font-mono bg-gray-100 px-2 py-0.5 rounded-md">
                    {liveOrderSummary.orderNumber}
                  </span>
                  <ChevronDown
                    size={14}
                    className={`text-gray-400 transition-transform duration-200 ${summaryExpanded ? "rotate-180" : ""}`}
                  />
                </div>
              </div>
              {/* Always-visible compact status + total */}
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-[10px] font-bold uppercase tracking-wide text-gray-600">
                    {liveOrderSummary.status}
                  </span>
                  <span className="text-[11px] text-amber-700 font-semibold">Due RM {liveOrderSummary.dueAmount.toFixed(2)}</span>
                  <span className="text-[10px] text-gray-400">{liveOrderSummary.itemsCount} item{liveOrderSummary.itemsCount !== 1 ? "s" : ""}</span>
                </div>
                <span className="text-base font-bold text-gray-900 shrink-0">
                  RM {liveOrderSummary.total.toFixed(2)}
                </span>
              </div>
            </button>

            {/* Collapsible body */}
            {summaryExpanded && (
              <>
                <div className="px-3 py-2">
                  {liveOrderSummary.hasMixedSources ? (
                    <>
                      {liveOrderSummary.customerItems.length > 0 && (
                        <div className="mb-1">
                          <div className="flex items-center gap-1.5 px-1.5 py-1 rounded-md bg-amber-50 border border-amber-100 mb-1">
                            <span className="text-[9px] font-bold uppercase tracking-wide text-amber-700">
                              Your Order
                            </span>
                          </div>
                          <div className="divide-y divide-gray-100">
                            {liveOrderSummary.customerItems.map((it, idx) => (
                              <div key={`cust-${idx}`} className="py-1.5 flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="text-xs font-semibold text-gray-900">{it.name || "Item"}</div>
                                  {it.note && <div className="mt-0.5 text-[10px] text-gray-500 italic">{it.note}</div>}
                                </div>
                                <div className="text-[11px] font-bold text-gray-700 shrink-0">x{Number(it.quantity || 0)}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {liveOrderSummary.waiterItems.length > 0 && (
                        <div>
                          <div className="flex items-center gap-1.5 px-1.5 py-1 rounded-md bg-blue-50 border border-blue-100 mb-1">
                            <span className="text-[9px] font-bold uppercase tracking-wide text-blue-700">
                              Added by Staff
                            </span>
                          </div>
                          <div className="divide-y divide-gray-100">
                            {liveOrderSummary.waiterItems.map((it, idx) => (
                              <div key={`waiter-${idx}`} className="py-1.5 flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="text-xs font-semibold text-gray-900">{it.name || "Item"}</div>
                                  {it.note && <div className="mt-0.5 text-[10px] text-gray-500 italic">{it.note}</div>}
                                </div>
                                <div className="text-[11px] font-bold text-gray-700 shrink-0">x{Number(it.quantity || 0)}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {liveOrderSummary.items.map((it, idx) => (
                        <div key={`${liveOrderSummary.orderNumber}-${idx}`} className="py-1.5 flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-gray-900">{it.name || "Item"}</div>
                            {it.note && <div className="mt-0.5 text-[10px] text-gray-500 italic">{it.note}</div>}
                          </div>
                          <div className="text-[11px] font-bold text-gray-700 shrink-0">x{Number(it.quantity || 0)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="px-3 py-2.5 bg-gray-50 border-t border-gray-100 text-[11px] space-y-1.5">
                  <div className="flex items-center justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span>RM {liveOrderSummary.subtotal.toFixed(2)}</span>
                  </div>
                  {liveOrderSummary.serviceChargeAmount > 0 && (
                    <div className="flex items-center justify-between text-gray-600">
                      <span>Service Charge</span>
                      <span>RM {liveOrderSummary.serviceChargeAmount.toFixed(2)}</span>
                    </div>
                  )}
                  {liveOrderSummary.taxAmount > 0 && (
                    <div className="flex items-center justify-between text-gray-600">
                      <span>Tax</span>
                      <span>RM {liveOrderSummary.taxAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm font-bold text-gray-900 pt-1 border-t border-gray-200">
                    <span>Total</span>
                    <span>RM {liveOrderSummary.total.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-gray-500">
                    <span>Paid</span>
                    <span className="text-emerald-700 font-semibold">RM {liveOrderSummary.paidAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-gray-500">
                    <span>Due</span>
                    <span className="text-amber-700 font-semibold">RM {liveOrderSummary.dueAmount.toFixed(2)}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {/* Menu */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-4 pb-28">
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center">
              <Utensils size={24} className="text-gray-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">
                {search ? "No matching items" : "No items available"}
              </p>
              {search && (
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Nothing found for &ldquo;{search}&rdquo;
                </p>
              )}
            </div>
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="inline-flex items-center gap-1 px-3 h-8 text-xs font-semibold text-[var(--p-blue)] bg-[var(--p-blue)]/8 hover:bg-[var(--p-blue)]/12 rounded-xl transition-colors"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredItems.slice(0, displayCount).map((it) => {
              const price = Number(it?.salesInformation?.sellingPrice || 0);
              const image =
                resolveLogo(it.featuredImage) ||
                (Array.isArray(it.images) ? resolveLogo(it.images[0]) : "");
              const inCart = cart.find((c) => c.itemId === it._id);
              return (
                <div
                  key={it._id}
                  className="flex gap-3 p-3 bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md active:scale-[0.99] transition-all duration-150"
                >
                  <div className="h-20 w-20 rounded-2xl bg-gray-50 border border-gray-100 overflow-hidden shrink-0">
                    {image ? (
                      <img
                        src={image}
                        alt={it.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-gray-400">
                        <Utensils size={22} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                    <div>
                      <h3 className="text-[13px] font-bold text-gray-900 leading-snug">
                        {it.name}
                      </h3>
                      <p className="text-sm font-bold text-[var(--p-blue)] mt-0.5">
                        RM {price.toFixed(2)}
                      </p>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      {inCart ? (
                        <div className="inline-flex items-center rounded-xl border border-gray-200 overflow-hidden bg-gray-50">
                          <button
                            type="button"
                            onClick={() => updateQty(it._id, -1)}
                            className="h-9 w-9 flex items-center justify-center text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors"
                          >
                            <Minus size={13} />
                          </button>
                          <span className="w-8 text-center text-sm font-bold text-gray-900">
                            {inCart.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQty(it._id, 1)}
                            className="h-9 w-9 flex items-center justify-center text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors"
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => addToCart(it)}
                          className="inline-flex items-center gap-1.5 h-9 px-4 text-[12px] font-bold text-[var(--p-blue)] bg-[var(--p-blue)]/10 hover:bg-[var(--p-blue)]/15 active:bg-[var(--p-blue)]/20 rounded-xl transition-colors"
                        >
                          <Plus size={13} />
                          Add
                        </button>
                      )}
                      {inCart && (
                        <button
                          type="button"
                          onClick={() => setNoteEditorFor(inCart)}
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold transition-colors ${
                            inCart.note
                              ? "text-indigo-600"
                              : "text-gray-400 hover:text-gray-600"
                          }`}
                        >
                          <StickyNote size={10} />
                          {inCart.note ? "Note added" : "Add note"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Load more */}
          {displayCount < filteredItems.length && (
            <div className="pt-5 flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => setDisplayCount((c) => c + 12)}
                className="inline-flex items-center gap-2 h-11 px-6 text-[13px] font-bold text-[var(--p-blue)] bg-white border-2 border-[var(--p-blue)]/20 hover:border-[var(--p-blue)]/40 hover:bg-[var(--p-blue)]/5 rounded-2xl transition-all active:scale-[0.98] shadow-sm"
              >
                <Plus size={14} />
                Show more items
              </button>
              <p className="text-[11px] text-gray-400">
                Showing {Math.min(displayCount, filteredItems.length)} of {filteredItems.length} items
              </p>
            </div>
          )}
          </>
        )}
      </main>

      {/* Floating cart button */}
      {cart.length > 0 && (
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="fixed bottom-5 left-1/2 -translate-x-1/2 inline-flex items-center gap-3 pl-2 pr-5 h-14 bg-[var(--p-blue)] text-white rounded-full shadow-2xl shadow-[var(--p-blue)]/40 hover:opacity-95 active:scale-[0.97] transition-all z-20"
        >
          <span className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <ShoppingCart size={18} />
          </span>
          <span className="font-extrabold text-[13px] tracking-tight">
            RM {totals.subtotal.toFixed(2)}
          </span>
          <span className="text-[11px] font-semibold opacity-80">
            View cart · {totals.count}
          </span>
        </button>
      )}

      {/* Cart drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-30 flex items-end sm:items-center sm:justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setCartOpen(false)}
          />
          <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 bg-gradient-to-r from-[var(--p-blue)]/5 to-white">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-[var(--p-blue)]/10 flex items-center justify-center">
                  <ShoppingCart size={15} className="text-[var(--p-blue)]" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-gray-900 leading-tight">Your Order</h3>
                  <p className="text-[10px] text-gray-400 leading-none mt-0.5">{totals.count} item{totals.count !== 1 ? "s" : ""}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCartOpen(false)}
                className="h-8 w-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {cart.map((c) => (
                <div
                  key={c.itemId}
                  className="p-3.5 rounded-2xl bg-gray-50 border border-gray-100"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-gray-900 truncate">
                        {c.name}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        RM {c.rate.toFixed(2)} each
                      </div>
                    </div>
                    <div className="inline-flex items-center rounded-xl bg-white border border-gray-200 overflow-hidden shrink-0">
                      <button
                        type="button"
                        onClick={() => updateQty(c.itemId, -1)}
                        className="h-8 w-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors"
                      >
                        <Minus size={13} />
                      </button>
                      <span className="w-8 text-center text-sm font-bold tabular-nums text-gray-900">
                        {c.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQty(c.itemId, 1)}
                        className="h-8 w-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>
                  {c.note && (
                    <div className="mt-2 px-2 py-1 text-[11px] text-indigo-900 bg-indigo-50 border-l-2 border-indigo-400 rounded-r italic">
                      {c.note}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setNoteEditorFor(c)}
                    className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    <StickyNote size={10} />
                    {c.note ? "Edit note" : "Add note"}
                  </button>
                </div>
              ))}

              <div className="pt-3">
                <label className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider">
                  Your Name (optional)
                </label>
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value.slice(0, 100))}
                  placeholder="e.g. Ahmed — helps staff identify your order"
                  className="mt-1 w-full text-sm p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-[var(--p-blue)] focus:ring-2 focus:ring-[var(--p-blue)]/15"
                />
              </div>

              <div className="pt-2">
                <label className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider">
                  Order Note (optional)
                </label>
                <textarea
                  value={orderNote}
                  onChange={(e) => setOrderNote(e.target.value.slice(0, 500))}
                  placeholder="Any special requests?"
                  className="mt-1 w-full text-sm p-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-[var(--p-blue)] focus:ring-2 focus:ring-[var(--p-blue)]/15"
                  rows={2}
                />
              </div>
            </div>

            <div className="border-t border-gray-100 p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-bold text-gray-900">
                  RM {totals.subtotal.toFixed(2)}
                </span>
              </div>
              {totals.serviceChargeAmount > 0 && (
                <div className="flex items-center justify-between text-[12px] text-gray-600">
                  <span>
                    Service Charge{" "}
                    {totals.serviceType === "fixed"
                      ? `(RM ${totals.serviceValue.toFixed(2)})`
                      : `(${totals.serviceValue}%)`}
                  </span>
                  <span>RM {totals.serviceChargeAmount.toFixed(2)}</span>
                </div>
              )}
              {totals.taxAmount > 0 && (
                <div className="flex items-center justify-between text-[12px] text-gray-600">
                  <span>
                    Tax{" "}
                    {totals.taxType === "fixed"
                      ? `(RM ${totals.taxValue.toFixed(2)})`
                      : `(${totals.taxValue}%)`}
                  </span>
                  <span>RM {totals.taxAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm font-bold text-gray-900 pt-1 border-t border-gray-100">
                <span>Total</span>
                <span>RM {totals.total.toFixed(2)}</span>
              </div>
              <button
                type="button"
                onClick={() => submit("pay_later")}
                disabled={submitting || !cart.length}
                className="w-full h-14 inline-flex items-center justify-center gap-2 text-sm font-bold text-white bg-[var(--p-blue)] rounded-2xl hover:opacity-95 active:scale-[0.99] transition-all disabled:opacity-50 shadow-lg shadow-[var(--p-blue)]/30"
              >
                {submitting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
                {submitting ? "Sending to Kitchen..." : "Send to Kitchen"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Note editor */}
      {noteEditorFor && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setNoteEditorFor(null)}
          />
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-gray-900">
                Note for {noteEditorFor.name}
              </h4>
              <button
                type="button"
                onClick={() => setNoteEditorFor(null)}
                className="p-1 rounded text-gray-400 hover:bg-gray-100"
              >
                <X size={14} />
              </button>
            </div>
            <textarea
              autoFocus
              defaultValue={noteEditorFor.note || ""}
              onChange={(e) =>
                setItemNote(noteEditorFor.itemId, e.target.value.slice(0, 300))
              }
              placeholder="e.g., No onions, extra spicy…"
              className="w-full p-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-[var(--p-blue)] focus:ring-2 focus:ring-[var(--p-blue)]/15"
              rows={3}
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNoteEditorFor(null)}
                className="inline-flex items-center gap-1 h-8 px-3 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inline error toast for post-load issues */}
      {loadError && context && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 text-xs bg-red-600 text-white rounded-full shadow-lg z-40">
          {loadError}
        </div>
      )}
    </div>
  );
};

export default QrOrderPage;
