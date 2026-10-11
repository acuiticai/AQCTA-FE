import React, {
  useState,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { useHistory } from "react-router-dom";
import { AdminContext } from "@/context/AdminContext";
import { notifyError, notifySuccess, notifyInfo } from "@/utils/toast";
import Swal from "sweetalert2";
import usePosData from "./hooks/usePosData";
import usePosOrder from "./hooks/usePosOrder";
import PosBusinessSelect from "./components/PosBusinessSelect";
import TableBar from "./components/TableBar";
import TablePickerModal from "./components/TablePickerModal";
import ItemCatalog from "./components/ItemCatalog";
import OrderPanel from "./components/OrderPanel";
import PaymentModal from "./components/PaymentModal";
import ReceiptPreview from "./components/ReceiptPreview";
import TableOrderSelectorModal from "./components/TableOrderSelectorModal";
import GuestCountModal from "./components/GuestCountModal";
import StartShiftModal from "./components/StartShiftModal";
import EndShiftModal from "./components/EndShiftModal";
import EndDayModal from "./components/EndDayModal";
import ShiftStatusPill from "./components/ShiftStatusPill";
import useConfigLogo from "@/hooks/useConfigLogo";
import axios from "axios";
import PosServices from "@/services/PosServices";
import { connectPosSocket, disconnectPosSocket } from "@/services/posSocket";
import { useNotifications } from "./hooks/useNotifications";
import NotificationCenter from "./components/NotificationCenter";

const MOBILE_TABS = ["Items", "Order"];
const POS_SELECTED_BUSINESS_KEY = "pos.selectedBusiness";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
const VOID_REASON_OPTIONS = {
  customer_walked_out: "Customer Walked Out",
  wrong_table: "Wrong Table",
  duplicate_draft: "Duplicate Draft",
  system_error: "System Error",
  other: "Other",
};
const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

const getSingleVoidReasonInput = async (title, confirmText) => {
  const optionsHtml = Object.entries(VOID_REASON_OPTIONS)
    .map(([k, v]) => `<option value="${k}">${v}</option>`)
    .join("");

  const { isConfirmed, value } = await Swal.fire({
    title,
    html: `
      <div style="display:flex;flex-direction:column;gap:10px;text-align:left">
        <label style="font-size:12px;color:#6b7280">Choose reason (optional)</label>
        <select id="swal-void-reason-select" class="swal2-input" style="margin:0;width:100%">
          <option value="">-- Select reason --</option>
          ${optionsHtml}
        </select>
        <label style="font-size:12px;color:#6b7280">Or type custom reason</label>
        <input id="swal-void-reason-text" class="swal2-input" style="margin:0;width:100%" placeholder="Type reason" />
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: confirmText,
    confirmButtonColor: "#f59e0b",
    focusConfirm: false,
    preConfirm: () => {
      const selected = document
        .getElementById("swal-void-reason-select")
        ?.value?.trim();
      const typed = document
        .getElementById("swal-void-reason-text")
        ?.value?.trim();
      const resolved =
        typed ||
        (selected
          ? VOID_REASON_OPTIONS[selected] || ""
          : "");
      if (!resolved) {
        Swal.showValidationMessage("Please select or enter a reason");
        return null;
      }
      return resolved;
    },
  });

  if (!isConfirmed) return null;
  return String(value || "").trim();
};

const PosPage = () => {
  const hasInitializedBusinessRef = useRef(false);
  const history = useHistory();

  const {
    state: { adminInfo },
  } = useContext(AdminContext);
  const tenantLogo = useConfigLogo();

  // ── Business selection ────────────────────────────────────
  const businesses = useMemo(
    () => adminInfo?.businesses || [],
    [adminInfo?.businesses],
  );
  const [resolvedBusinesses, setResolvedBusinesses] = useState([]);
  const [selectedBusiness, setSelectedBusiness] = useState("");
  const [mode, setMode] = useState("select"); // "select" | "terminal"

  const selectedBusinessRef = useRef(selectedBusiness);
  selectedBusinessRef.current = selectedBusiness;

  useEffect(() => {
    let mounted = true;
    const assignedBusinesses = Array.isArray(businesses) ? businesses : [];
    const assignedIds = assignedBusinesses
      .map((b) => String(b?._id || ""))
      .filter(Boolean);

    if (!assignedIds.length) {
      setResolvedBusinesses([]);
      return () => {
        mounted = false;
      };
    }

    const hasLogoData = assignedBusinesses.every((b) =>
      Boolean(b?.image || b?.logo || b?.businessLogo || b?.companyLogo),
    );
    if (hasLogoData) {
      setResolvedBusinesses(assignedBusinesses);
      return () => {
        mounted = false;
      };
    }

    const headers = adminInfo?.token
      ? {
          "Content-Type": "application/json",
          authorization: `Bearer ${adminInfo.token}`,
        }
      : {};

    const hydrateBusinesses = async () => {
      try {
        const res = await axios.post(`${Base_URL}/Business/getALL`, {}, { headers });
        const allBusinesses = Array.isArray(res?.data?.data) ? res.data.data : [];
        const mapById = new Map(
          allBusinesses.map((b) => [String(b?._id || ""), b]),
        );
        const merged = assignedBusinesses.map((b) => {
          const key = String(b?._id || "");
          return mapById.get(key) || b;
        });
        if (mounted) setResolvedBusinesses(merged);
      } catch (_) {
        if (mounted) setResolvedBusinesses(assignedBusinesses);
      }
    };

    hydrateBusinesses();
    return () => {
      mounted = false;
    };
  }, [businesses, adminInfo?.token]);

  // Init selection from URL → localStorage → (auto-pick if single business)
  useEffect(() => {
    if (!resolvedBusinesses.length) return;

    const validIds = new Set(resolvedBusinesses.map((b) => b._id));

    if (hasInitializedBusinessRef.current) {
      // Already initialized: guard against removal
      if (
        selectedBusinessRef.current &&
        !validIds.has(selectedBusinessRef.current)
      ) {
        setSelectedBusiness("");
        setMode("select");
      }
      return;
    }

    hasInitializedBusinessRef.current = true;
    const fromQuery =
      new URLSearchParams(window.location.search).get("selectedOrg") || "";
    const fromStorage = localStorage.getItem(POS_SELECTED_BUSINESS_KEY) || "";

    let resolved = "";
    if (fromQuery && validIds.has(fromQuery)) resolved = fromQuery;
    else if (fromStorage && validIds.has(fromStorage)) resolved = fromStorage;
    else if (resolvedBusinesses.length === 1) resolved = resolvedBusinesses[0]._id;

    if (resolved) {
      setSelectedBusiness(resolved);
      setMode("terminal");
    } else {
      setMode("select");
    }
  }, [resolvedBusinesses]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync URL + storage when selection changes
  useEffect(() => {
    if (!hasInitializedBusinessRef.current) return;

    if (selectedBusiness) {
      localStorage.setItem(POS_SELECTED_BUSINESS_KEY, selectedBusiness);
    } else {
      localStorage.removeItem(POS_SELECTED_BUSINESS_KEY);
    }

    const params = new URLSearchParams(window.location.search);
    if (selectedBusiness) {
      params.set("selectedOrg", selectedBusiness);
    } else {
      params.delete("selectedOrg");
    }

    const nextSearch = params.toString();
    const currentSearch = window.location.search.startsWith("?")
      ? window.location.search.slice(1)
      : window.location.search;

    if (nextSearch !== currentSearch) {
      const nextUrl = `${window.location.pathname}${
        nextSearch ? `?${nextSearch}` : ""
      }${window.location.hash || ""}`;
      window.history.replaceState(window.history.state, "", nextUrl);
    }
  }, [selectedBusiness]);

  const businessId = selectedBusiness || null;
  const currentBusiness = useMemo(
    () => resolvedBusinesses.find((b) => b._id === businessId) || null,
    [resolvedBusinesses, businessId],
  );

  const posAuthHeaders = useMemo(
    () => (adminInfo?.token ? { Authorization: `Bearer ${adminInfo.token}` } : {}),
    [adminInfo?.token],
  );

  // ── Data + order hooks ────────────────────────────────────
  const {
    tables,
    floors,
    categories,
    items,
    customers,
    paymentMethods,
    salesChannels,
    tablesLoading,
    itemsLoading,
    customersLoading,
    fetchTables,
    fetchItems,
    searchCustomers,
  } = usePosData(businessId);

  const {
    order,
    loading: orderLoading,
    openOrder,
    loadOrder,
    openWalkinOrder,
    addItem,
    updateItemQty,
    removeItem,
    updateItemNote,
    updateStaffNotes,
    updateGuestCount,
    confirmGuestCount,
    holdOrder,
    resumeOrder,
    transferTable,
    syncState,
    updateDiscount,
    updateCustomer,
    updateSalesChannel,
    sendToKitchen,
    checkout,
    voidOrder,
    clearOrder,
    softRefreshOrder,
  } = usePosOrder(businessId);

  const { notifications, unreadCount, addEvent, markAllRead, clearAll } = useNotifications();

  const [selectedTableId, setSelectedTableId] = useState(null);
  const [orderOpening, setOrderOpening] = useState(false);
  const [isWalkin, setIsWalkin] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [showTransferPicker, setShowTransferPicker] = useState(false);
  const [orderSelectorTable, setOrderSelectorTable] = useState(null);
  const orderSelectorTableRef = useRef(null);
  const [completedOrder, setCompletedOrder] = useState(null);
  const [mobileTab, setMobileTab] = useState(0);
  const tablePhaseByIdRef = useRef({});
  const tablePhaseInitializedRef = useRef(false);
  // Items queued before a table/order exists. Drained into addItem() once the
  // first order opens so cashiers can scan items then pick a table.
  const pendingItemsRef = useRef([]);
  const [pendingCount, setPendingCount] = useState(0);
  // Table pre-selected before any items added. openOrder is deferred until the
  // first item is added so the table stays "available" in the meantime.
  const pendingTableIdRef = useRef(null);
  // Guest count/phone numbers captured via GuestCountModal, applied to the
  // order when it's eventually created (see pendingTableIdRef above).
  const pendingGuestInfoRef = useRef(null);
  const [guestModalTable, setGuestModalTable] = useState(null);
  const guestModalTableRef = useRef(null);
  // First-touch guest count prompt: shown the first time staff opens an order
  // (e.g. QR self-ordered) where guestCountConfirmed is still false.
  const [firstTouchOrder, setFirstTouchOrder] = useState(null);

  // ── Shift management & Day Closing ────────────────────────
  const [activeShift, setActiveShift] = useState(null);
  const [shiftLoading, setShiftLoading] = useState(false);
  const [shiftDefinitions, setShiftDefinitions] = useState([]);
  const [showStartShiftModal, setShowStartShiftModal] = useState(false);
  const [showEndShiftModal, setShowEndShiftModal] = useState(false);
  const [shiftPreview, setShiftPreview] = useState(null);
  const [shiftPreviewLoading, setShiftPreviewLoading] = useState(false);
  const [shiftActionLoading, setShiftActionLoading] = useState(false);
  const [showEndDayModal, setShowEndDayModal] = useState(false);
  const [dayStatus, setDayStatus] = useState(null);
  const [dayStatusLoading, setDayStatusLoading] = useState(false);
  const [dayActionLoading, setDayActionLoading] = useState(false);

  // Drain the pre-order item queue as soon as an order is created.
  useEffect(() => {
    if (!order || pendingItemsRef.current.length === 0) return;
    const queue = [...pendingItemsRef.current];
    pendingItemsRef.current = [];
    setPendingCount(0);
    queue.forEach((item) => addItem(item));
  }, [order?._id]); // only fire when the order ID changes (new order opened)

  const hasActivePosContext = useMemo(() => {
    const hasOpenOrder = order?.status === "open";
    const hasCartItems = Boolean(order?.items?.length);
    return hasOpenOrder || hasCartItems || showPayment || showReceipt || pendingCount > 0;
  }, [order, showPayment, showReceipt, pendingCount]);

  const confirmDiscardContext = useCallback(
    async (title, text) => {
      if (!hasActivePosContext) return true;
      const result = await Swal.fire({
        icon: "warning",
        title,
        text,
        showCancelButton: true,
        confirmButtonColor: "#2563eb",
        cancelButtonColor: "#6b7280",
        confirmButtonText: "Yes, continue",
        cancelButtonText: "Cancel",
      });
      return result.isConfirmed;
    },
    [hasActivePosContext],
  );

  // ── Business switch / exit ───────────────────────────────
  const handleSelectBusiness = useCallback((nextBusinessId) => {
    if (!nextBusinessId) return;
    setSelectedBusiness(nextBusinessId);
    setMode("terminal");
  }, []);

  const handleSwitchBusiness = useCallback(async () => {
    const ok = await confirmDiscardContext(
      "Switch Business?",
      "Switching will clear your current order context.",
    );
    if (!ok) return;
    setSelectedBusiness("");
    setMode("select");
  }, [confirmDiscardContext]);

  const handleExitPos = useCallback(async () => {
    const ok = await confirmDiscardContext(
      "Exit POS?",
      "You have an active order. Exiting will lose unsaved cart context.",
    );
    if (!ok) return;
    history.push("/dashboard");
  }, [confirmDiscardContext, history]);

  // Reset terminal state when business changes, then auto-open table picker
  useEffect(() => {
    setSelectedTableId(null);
    setIsWalkin(false);
    setShowPayment(false);
    setShowReceipt(false);
    setShowTablePicker(false);
    setCompletedOrder(null);
    setMobileTab(0);
    setOrderSelectorTable(null);
    orderSelectorTableRef.current = null;
    setGuestModalTable(null);
    guestModalTableRef.current = null;
    pendingGuestInfoRef.current = null;
    pendingItemsRef.current = [];
    setPendingCount(0);
    pendingTableIdRef.current = null;
    clearOrder();
    setActiveShift(null);
    setShiftDefinitions([]);
    setShowStartShiftModal(false);
    setShowEndShiftModal(false);
    setShiftPreview(null);
    setShowEndDayModal(false);
    setDayStatus(null);
    const timer = setTimeout(() => setShowTablePicker(true), 300);
    return () => clearTimeout(timer);
  }, [businessId, clearOrder]);

  // Load active shift + configured shift definitions for this business.
  const fetchActiveShift = useCallback(async () => {
    if (!businessId) {
      setActiveShift(null);
      return;
    }
    setShiftLoading(true);
    try {
      const res = await PosServices.getActiveShift({ business: businessId }, posAuthHeaders);
      setActiveShift(res?.data?.data || null);
    } catch (_) {
      setActiveShift(null);
    } finally {
      setShiftLoading(false);
    }
  }, [businessId, posAuthHeaders]);

  useEffect(() => {
    if (mode !== "terminal" || !businessId) return;
    fetchActiveShift();
    PosServices.getShiftDefinitions({ business: businessId }, posAuthHeaders)
      .then((res) => setShiftDefinitions(res?.data?.data || []))
      .catch(() => setShiftDefinitions([]));
  }, [mode, businessId, posAuthHeaders, fetchActiveShift]);

  const handleShiftPillClick = useCallback(() => {
    if (activeShift) {
      setShowEndShiftModal(true);
    } else {
      setShowStartShiftModal(true);
    }
  }, [activeShift]);

  const handleStartShift = useCallback(
    async ({ shiftId, openingCash }) => {
      setShiftActionLoading(true);
      try {
        const payload = { business: businessId, shiftId };
        if (openingCash !== undefined) payload.openingCash = openingCash;
        const res = await PosServices.startShift(payload, posAuthHeaders);
        setActiveShift(res?.data?.data || null);
        setShowStartShiftModal(false);
        notifySuccess("Shift started");
      } catch (err) {
        notifyError(err?.response?.data?.message || "Failed to start shift");
      } finally {
        setShiftActionLoading(false);
      }
    },
    [businessId, posAuthHeaders],
  );

  // Pull a live preview of the shift's totals whenever the End Shift modal opens.
  useEffect(() => {
    if (!showEndShiftModal || !activeShift?._id) return;
    let cancelled = false;
    setShiftPreviewLoading(true);
    PosServices.getShiftPreview(activeShift._id, posAuthHeaders)
      .then((res) => {
        if (!cancelled) setShiftPreview(res?.data?.data || null);
      })
      .catch(() => {
        if (!cancelled) setShiftPreview(null);
      })
      .finally(() => {
        if (!cancelled) setShiftPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showEndShiftModal, activeShift?._id, posAuthHeaders]);

  const handleCloseShift = useCallback(
    async ({ declaredCashOnHand, notes }) => {
      if (!activeShift?._id) return;
      setShiftActionLoading(true);
      try {
        await PosServices.closeShift(activeShift._id, { declaredCashOnHand, notes }, posAuthHeaders);
        setActiveShift(null);
        setShiftPreview(null);
        setShowEndShiftModal(false);
        notifySuccess("Shift closed");
      } catch (err) {
        notifyError(err?.response?.data?.message || "Failed to close shift");
      } finally {
        setShiftActionLoading(false);
      }
    },
    [activeShift?._id, posAuthHeaders],
  );

  // ── Day Closing ────────────────────────────────────────────
  const fetchDayStatus = useCallback(async () => {
    if (!businessId) return;
    setDayStatusLoading(true);
    try {
      const res = await PosServices.getDayStatus({ business: businessId }, posAuthHeaders);
      setDayStatus(res?.data?.data || null);
    } catch (_) {
      setDayStatus(null);
    } finally {
      setDayStatusLoading(false);
    }
  }, [businessId, posAuthHeaders]);

  const handleOpenDayClosing = useCallback(() => {
    setShowEndDayModal(true);
    fetchDayStatus();
  }, [fetchDayStatus]);

  const handleCloseDay = useCallback(
    async ({ notes }) => {
      if (!businessId || !dayStatus?.businessDate) return;
      setDayActionLoading(true);
      try {
        await PosServices.closeDay(
          { business: businessId, businessDate: dayStatus.businessDate, notes },
          posAuthHeaders,
        );
        notifySuccess("Business day closed");
        await fetchDayStatus();
      } catch (err) {
        notifyError(err?.response?.data?.message || "Failed to close day");
      } finally {
        setDayActionLoading(false);
      }
    },
    [businessId, dayStatus?.businessDate, posAuthHeaders, fetchDayStatus],
  );

  // Notify POS operator when kitchen phase changes for currently selected table.
  useEffect(() => {
    if (!Array.isArray(tables) || tables.length === 0) return;
    const nextMap = {};
    tables.forEach((t) => {
      if (!t?._id) return;
      nextMap[String(t._id)] = String(t.kitchenPhase || t.status || "");
    });

    if (!tablePhaseInitializedRef.current) {
      tablePhaseByIdRef.current = nextMap;
      tablePhaseInitializedRef.current = true;
      return;
    }

    const selectedKey = String(selectedTableId || "");
    const prevPhase = selectedKey ? tablePhaseByIdRef.current[selectedKey] : "";
    const nextPhase = selectedKey ? nextMap[selectedKey] : "";
    if (
      selectedKey &&
      prevPhase &&
      nextPhase &&
      prevPhase !== nextPhase &&
      (nextPhase === "ready" || nextPhase === "served")
    ) {
      notifySuccess(
        nextPhase === "served"
          ? "Kitchen marked this table as served."
          : "Kitchen marked this table as ready."
      );
    }

    tablePhaseByIdRef.current = nextMap;
  }, [tables, selectedTableId]);

  // Realtime push via Socket.io for POS/Kitchen events.
  const selectedTableIdRef = useRef(selectedTableId);
  selectedTableIdRef.current = selectedTableId;
  const openOrderRef = useRef(openOrder);
  openOrderRef.current = openOrder;
  const softRefreshOrderRef = useRef(softRefreshOrder);
  softRefreshOrderRef.current = softRefreshOrder;
  const currentOrderIdRef = useRef(null);
  currentOrderIdRef.current = order?._id || null;

  useEffect(() => {
    if (mode !== "terminal" || !businessId || !adminInfo?.token) return undefined;

    connectPosSocket({
      businessId,
      token: adminInfo.token,
      onEvent: (event) => {
        if (!event?.type) return;
        addEvent(event);

        // Refresh table list on order/kitchen lifecycle events
        const refreshTypes = new Set([
          "order:created",
          "order:fired",
          "order:completed",
          "order:voided",
          "kitchen:ticket:status",
          "kitchen:ticket:new",
        ]);
        if (refreshTypes.has(event.type)) {
          fetchTables();
        }

        // Re-sync the active order when an EXTERNAL source changes it.
        // - order:fired: a QR customer placed/added items → soft-refresh to merge new QR lines
        //   without discarding any unsaved POS cart changes (softRefreshOrder handles the merge).
        // - order:items_updated: fired by this POS's own updateOrderItems call — skip,
        //   because the API response already gave us the updated state.
        // - kitchen:ticket:status: only affects table phase badge (handled by fetchTables above),
        //   not order items — no order reload needed.
        const tid = selectedTableIdRef.current;
        const orderId = currentOrderIdRef.current;
        if (
          event.type === "order:fired" &&
          tid &&
          event.tableId &&
          String(event.tableId) === String(tid) &&
          orderId
        ) {
          softRefreshOrderRef.current(orderId);
        }
      },
    });

    return () => disconnectPosSocket();
  }, [mode, businessId, adminInfo?.token, fetchTables, addEvent]);

  // ── Order actions ─────────────────────────────────────────
  // Show the guest-count prompt the first time staff opens an order whose
  // headcount hasn't been confirmed yet (e.g. orders placed via QR self-order).
  const maybePromptGuestCount = useCallback((loadedOrder, tableMeta) => {
    if (!loadedOrder || !loadedOrder.table || loadedOrder.guestCountConfirmed) {
      return;
    }
    const tableNumber =
      loadedOrder.table?.tableNumber ?? tableMeta?.tableNumber ?? "?";
    const capacity =
      tableMeta?.capacity ?? loadedOrder.table?.capacity ?? null;
    setFirstTouchOrder({
      orderId: loadedOrder._id,
      tableNumber,
      capacity,
      guestCount: loadedOrder.guestCount || 1,
    });
  }, []);

  const handleTableSelect = useCallback(
    (tableOrId) => {
      const tableId =
        typeof tableOrId === "string" ? tableOrId : tableOrId?._id || null;
      if (!tableId) { notifyError("Invalid table selected"); return; }

      const tableObj =
        typeof tableOrId === "object"
          ? tableOrId
          : tables.find((t) => String(t._id) === String(tableId));
      const isOccupied = tableObj?.status === "occupied";

      setSelectedTableId(tableId);
      setIsWalkin(false);

      if (isOccupied) {
        pendingTableIdRef.current = null;
        const headers = adminInfo?.token
          ? { Authorization: `Bearer ${adminInfo.token}` }
          : {};
        setOrderOpening(true);
        (async () => {
          try {
            const res = await PosServices.getOrders(
              {
                tableId,
                business: businessId,
                status: "open",
                limit: 50,
              },
              headers,
            );
            const list = res.data?.data || [];
            const openOrders = Array.isArray(list) ? list : [];
            // Show picker when there are 2+ open bills that are not the same "identity"
            // (e.g. staff shared null vs a guest session, or two different guest sessions).
            // Pure duplicate staff-only bills on one table stay on single-order flow.
            const billKeys = new Set(
              openOrders.map((o) =>
                o.qrSessionId != null && String(o.qrSessionId).trim() !== ""
                  ? `g:${String(o.qrSessionId)}`
                  : "staff",
              ),
            );
            const needsOrderPicker =
              openOrders.length > 1 && billKeys.size >= 2;

            if (needsOrderPicker) {
              const meta =
                tableObj && tableObj._id
                  ? tableObj
                  : { _id: tableId, tableNumber: "?" };
              orderSelectorTableRef.current = meta;
              setOrderSelectorTable(meta);
              setMobileTab(0);
            } else if (openOrders.length === 1) {
              const loaded = await loadOrder(openOrders[0]._id);
              if (!loaded) setSelectedTableId(null);
              else {
                setMobileTab(0);
                maybePromptGuestCount(loaded, tableObj);
              }
            } else {
              const opened = await openOrder(tableId);
              if (!opened) setSelectedTableId(null);
              else {
                setMobileTab(0);
                maybePromptGuestCount(opened, tableObj);
              }
            }
          } catch (err) {
            setSelectedTableId(null);
            notifyError(
              err?.response?.data?.message || err.message || "Failed to open order",
            );
          } finally {
            setOrderOpening(false);
          }
        })();
      } else {
        // Available table — ask how many guests are seated before deferring
        // backend order creation until at least one item is added. This
        // prevents the table from appearing occupied with an empty cart.
        clearOrder();
        pendingGuestInfoRef.current = null;
        const meta =
          tableObj && tableObj._id
            ? tableObj
            : { _id: tableId, tableNumber: "?" };
        guestModalTableRef.current = meta;
        setGuestModalTable(meta);
      }
    },
    [openOrder, loadOrder, clearOrder, tables, businessId, adminInfo?.token, maybePromptGuestCount],
  );

  const handleGuestCountConfirm = useCallback(({ guestCount }) => {
    const tableObj = guestModalTableRef.current;
    guestModalTableRef.current = null;
    setGuestModalTable(null);
    if (!tableObj?._id) return;
    pendingTableIdRef.current = tableObj._id;
    pendingGuestInfoRef.current = { guestCount };
    setMobileTab(0);
  }, []);

  const handleGuestCountClose = useCallback(() => {
    guestModalTableRef.current = null;
    setGuestModalTable(null);
    pendingGuestInfoRef.current = null;
    setSelectedTableId(null);
  }, []);

  // First-touch guest count prompt (for orders not yet confirmed by staff,
  // e.g. QR self-ordered tables) — confirms or adjusts the headcount.
  const handleFirstTouchConfirm = useCallback(
    ({ guestCount }) => {
      setFirstTouchOrder(null);
      updateGuestCount(guestCount);
    },
    [updateGuestCount],
  );

  const handleFirstTouchClose = useCallback(() => {
    setFirstTouchOrder(null);
    confirmGuestCount();
  }, [confirmGuestCount]);

  const handleOrderSelectorSelect = useCallback(async (orderId) => {
    const tableObj = orderSelectorTableRef.current;
    orderSelectorTableRef.current = null;
    setOrderSelectorTable(null);
    const tid = tableObj?._id;
    if (!tid || !orderId) return;
    setSelectedTableId(tid);
    setIsWalkin(false);
    pendingTableIdRef.current = null;
    const loaded = await loadOrder(orderId);
    if (!loaded) setSelectedTableId(null);
    else {
      setMobileTab(0);
      maybePromptGuestCount(loaded, tableObj);
    }
  }, [loadOrder, maybePromptGuestCount]);

  const handleOrderSelectorNew = useCallback(async () => {
    const tableObj = orderSelectorTableRef.current;
    orderSelectorTableRef.current = null;
    setOrderSelectorTable(null);
    if (!tableObj?._id) return;
    setSelectedTableId(tableObj._id);
    setIsWalkin(false);
    pendingTableIdRef.current = null;
    const opened = await openOrder(tableObj._id, { forceNew: true });
    if (!opened) setSelectedTableId(null);
    else setMobileTab(0);
  }, [openOrder]);

  const handleOrderSelectorClose = useCallback(() => {
    orderSelectorTableRef.current = null;
    setOrderSelectorTable(null);
    setSelectedTableId(null);
  }, []);

  const handleWalkin = useCallback(async () => {
    pendingTableIdRef.current = null;
    setSelectedTableId(null);
    setIsWalkin(true);
    try {
      await openWalkinOrder();
      setMobileTab(0);
    } catch (err) {
      notifyError(err.message || "Failed to create walk-in order");
    }
  }, [openWalkinOrder]);

  const handleAddItem = useCallback(
    async (item) => {
      if (!order) {
        // Queue the item — drained into addItem() once an order is created.
        pendingItemsRef.current = [...pendingItemsRef.current, item];
        setPendingCount((c) => c + 1);

        // If a table was pre-selected (deferred), now is the time to create
        // the backend order. The table moves to "occupied" only at this point,
        // ensuring 0-item carts never mark a table as occupied.
        if (pendingTableIdRef.current) {
          const tableId = pendingTableIdRef.current;
          const guestInfo = pendingGuestInfoRef.current;
          pendingTableIdRef.current = null;
          pendingGuestInfoRef.current = null;
          openOrder(tableId, guestInfo || {}).then((opened) => {
            if (!opened) setSelectedTableId(null);
            else setMobileTab(0);
          }).catch((err) => {
            setSelectedTableId(null);
            notifyError(err.message || "Failed to open order");
          });
        }
        return;
      }
      try {
        addItem(item);
      } catch (err) {
        notifyError(err.message || "Failed to add item");
      }
    },
    [order, addItem, openOrder],
  );

  const handleCharge = useCallback(() => {
    if (!order || !order.items?.length) return;
    setShowPayment(true);
  }, [order]);

  const handlePaymentConfirm = useCallback(
    async (
      payments,
      cashTendered,
      {
        force = false,
        customerPhone,
        stockWarehouseId,
        stockLocationId,
      } = {},
    ) => {
      const result = await checkout(payments, cashTendered, {
        force,
        customerPhone,
        stockWarehouseId,
        stockLocationId,
      });

      // 409: kitchen still has active tickets — ask manager to confirm override
      if (result?.blocked) {
        const ticketLines = (result.activeTickets || [])
          .map((t) => `• ${t.sectionName || "Kitchen"} — ${t.status}`)
          .join("<br>");
        const { isConfirmed } = await Swal.fire({
          icon: "warning",
          title: "Kitchen tickets still active",
          html: `<p style="margin-bottom:8px">The following tickets are still in progress:</p><div style="text-align:left;font-size:13px">${ticketLines}</div><p style="margin-top:8px">Override and charge anyway?</p>`,
          showCancelButton: true,
          confirmButtonColor: "#ef4444",
          cancelButtonColor: "#6b7280",
          confirmButtonText: "Force Checkout",
          cancelButtonText: "Wait",
        });
        if (isConfirmed) {
          const forced = await checkout(payments, cashTendered, {
            force: true,
            customerPhone,
            stockWarehouseId,
            stockLocationId,
          });
          setShowPayment(false);
          if (forced?.success && forced?.data) {
            setCompletedOrder(forced.data);
            setShowReceipt(true);
          }
          fetchTables();
        }
        return;
      }

      setShowPayment(false);
      if (result?.success && result?.data) {
        setCompletedOrder(result.data);
        setShowReceipt(true);
      }
      fetchTables();
    },
    [checkout, fetchTables],
  );

  const handleTransferTable = useCallback(() => {
    setShowTransferPicker(true);
  }, []);

  const handleTransferConfirm = useCallback(
    async (table) => {
      setShowTransferPicker(false);
      const targetTableId = table?._id ?? table;
      const result = await transferTable(targetTableId);
      if (result) {
        setSelectedTableId(targetTableId);
        fetchTables();
      }
    },
    [transferTable, fetchTables],
  );

  const handleRemoveItem = useCallback(
    async (itemRef) => {
      if (order?.kitchenLastSentAt) {
        const { isConfirmed } = await Swal.fire({
          icon: "warning",
          title: "Item sent to kitchen",
          text: "This item may already be in preparation. Remove it anyway?",
          showCancelButton: true,
          confirmButtonColor: "#ef4444",
          cancelButtonColor: "#6b7280",
          confirmButtonText: "Remove",
          cancelButtonText: "Keep",
        });
        if (!isConfirmed) return;
      }
      removeItem(itemRef);
    },
    [order?.kitchenLastSentAt, removeItem],
  );

  const handleVoid = useCallback(async () => {
    if (!order) return;
    const reason = await getSingleVoidReasonInput(
      "Void order and release table?",
      "Void order",
    );
    if (!reason) return;
    try {
      await voidOrder(reason);
      setSelectedTableId(null);
      setIsWalkin(false);
      fetchTables();
    } catch (err) {
      notifyError(err.message || "Failed to void order");
    }
  }, [order, voidOrder, fetchTables]);

  const handleReleaseSelectedTable = useCallback(async () => {
    if (!selectedTableId) return;
    const reason = await getSingleVoidReasonInput("Clear table", "Clear Table");
    if (!reason) return;
    try {
      const headers = adminInfo?.token
        ? { Authorization: `Bearer ${adminInfo.token}` }
        : {};
      await PosServices.releaseTable(selectedTableId, { reason }, headers);
      pendingTableIdRef.current = null;
      setSelectedTableId(null);
      setIsWalkin(false);
      clearOrder();
      // Refresh in short retries so UI reflects released status without manual action.
      await fetchTables();
      await sleep(250);
      await fetchTables();
      await sleep(700);
      await fetchTables();
    } catch (err) {
      const fallback = err?.response?.data?.message || "Failed to release table";
      const activeTickets = err?.response?.data?.data?.activeTickets || [];
      if (activeTickets.length) {
        const details = activeTickets
          .slice(0, 4)
          .map(
            (t) =>
              `${t.ticketNumber || "Ticket"}${t.sectionName ? ` (${t.sectionName})` : ""} - ${t.status || ""}`,
          )
          .join(", ");
        notifyError(`${fallback} Active tickets: ${details}`);
      } else {
        notifyError(fallback);
      }
    }
  }, [selectedTableId, adminInfo?.token, fetchTables, clearOrder]);

  const handleReceiptClose = useCallback(() => {
    setShowReceipt(false);
    setCompletedOrder(null);
    pendingTableIdRef.current = null;
    clearOrder();
    setSelectedTableId(null);
    setIsWalkin(false);
    setMobileTab(0);
    setShowTablePicker(true);
  }, [clearOrder]);

  const handleSelectCustomer = useCallback(
    async (customerId) => {
      try {
        await updateCustomer(customerId);
      } catch (err) {
        notifyError(err.message || "Failed to update customer");
      }
    },
    [updateCustomer],
  );

  const handleClearCustomer = useCallback(async () => {
    try {
      await updateCustomer(null);
    } catch (err) {
      notifyError(err.message || "Failed to clear customer");
    }
  }, [updateCustomer]);

  const handleDiscountChange = useCallback(
    async (type, value) => {
      try {
        await updateDiscount(type, value);
      } catch (err) {
        notifyError(err.message || "Failed to update discount");
      }
    },
    [updateDiscount],
  );

  // Keyboard shortcuts — only in terminal mode
  useEffect(() => {
    if (mode !== "terminal") return;
    const handler = (e) => {
      if (e.key === "F9" && order?.items?.length) {
        e.preventDefault();
        setShowPayment(true);
      }
      if (e.key === "F2") {
        e.preventDefault();
        handleWalkin();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [order, handleWalkin, mode]);

  // ── Render ────────────────────────────────────────────────
  return (
    <div
      className="flex flex-col bg-gray-100 overflow-hidden min-h-0"
      style={{
        height: "100dvh",
      }}
    >
      {mode === "select" ? (
        <PosBusinessSelect
          businesses={resolvedBusinesses}
          logo={tenantLogo}
          onSelect={handleSelectBusiness}
        />
      ) : (
        <>
          <TableBar
            business={currentBusiness}
            logo={tenantLogo}
            tables={tables}
            floors={floors}
            loading={tablesLoading}
            selectedTableId={selectedTableId}
            orderHasItems={order?.items?.length > 0}
            isWalkin={isWalkin}
            onSelectTable={handleTableSelect}
            onWalkin={handleWalkin}
            onRefresh={fetchTables}
            onOpenAllTables={() => setShowTablePicker(true)}
            onSwitchBusiness={handleSwitchBusiness}
            onExit={handleExitPos}
            orderNumber={order?.orderNumber}
            onReleaseTable={handleReleaseSelectedTable}
            shiftNode={
              <ShiftStatusPill
                activeShift={activeShift}
                loading={shiftLoading}
                onClick={handleShiftPillClick}
              />
            }
            onOpenDayClosing={handleOpenDayClosing}
            notificationNode={
              <NotificationCenter
                notifications={notifications}
                unreadCount={unreadCount}
                onMarkAllRead={markAllRead}
                onClear={clearAll}
              />
            }
          />

          {/* Mobile tabs (< lg) */}
          <div className="flex lg:hidden border-b border-gray-200 bg-white shrink-0">
            {MOBILE_TABS.map((tab, idx) => (
              <button
                key={tab}
                type="button"
                onClick={() => setMobileTab(idx)}
                className={`
                  flex-1 py-2.5 text-xs font-medium text-center transition-colors
                  ${
                    mobileTab === idx
                      ? "text-[var(--p-blue)] border-b-2 border-[var(--p-blue)]"
                      : "text-gray-500"
                  }
                `}
              >
                {tab}
                {idx === 1 && (order?.items?.length > 0 || pendingCount > 0) && (
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-[var(--p-blue)] text-white rounded-full">
                    {order?.items?.length || pendingCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Main 2-panel layout */}
          <div className="flex-1 flex overflow-hidden p-2 gap-2 min-h-0">
            {/* Item Catalog — wider for high-SKU production menus */}
            <div
              className={`
                w-full lg:w-[66%] xl:w-[68%] shrink-0 overflow-hidden
                ${mobileTab === 0 ? "block" : "hidden lg:block"}
              `}
            >
              <ItemCatalog
                items={items}
                categories={categories}
                loading={itemsLoading}
                cartItems={order?.items}
                onAddItem={handleAddItem}
                onFetchItems={fetchItems}
              />
            </div>

            {/* Order Panel — compact side rail */}
            <div
              className={`
                w-full lg:w-[34%] xl:w-[32%] shrink-0 overflow-hidden
                ${mobileTab === 1 ? "block" : "hidden lg:block"}
              `}
            >
              <OrderPanel
                order={order}
                loading={orderLoading || orderOpening}
                salesChannels={salesChannels}
                customers={customers}
                customersLoading={customersLoading}
                onSearchCustomers={searchCustomers}
                onSelectCustomer={handleSelectCustomer}
                onClearCustomer={handleClearCustomer}
                onSelectSalesChannel={updateSalesChannel}
                onUpdateQty={updateItemQty}
                onRemoveItem={handleRemoveItem}
                onUpdateNote={updateItemNote}
                onStaffNotesChange={updateStaffNotes}
                onUpdateGuestCount={updateGuestCount}
                onTransferTable={handleTransferTable}
                onHold={holdOrder}
                onResume={resumeOrder}
                syncState={syncState}
                onDiscountChange={handleDiscountChange}
                onCharge={handleCharge}
                onPayLater={async () => {
                  const sent = await sendToKitchen();
                  if (sent) {
                    notifyInfo("Order sent to kitchen. You can collect payment later.");
                  }
                }}
                onVoid={handleVoid}
              />
            </div>
          </div>

          {/* Table Picker Modal */}
          <TablePickerModal
            isOpen={showTablePicker}
            onClose={() => setShowTablePicker(false)}
            tables={tables}
            floors={floors}
            selectedTableId={selectedTableId}
            orderHasItems={order?.items?.length > 0}
            onSelectTable={handleTableSelect}
          />

          {/* Transfer Table Picker — shows only available tables */}
          <TablePickerModal
            isOpen={showTransferPicker}
            onClose={() => setShowTransferPicker(false)}
            tables={tables.filter(
              (t) => t.status === "available" && String(t._id) !== String(order?.table?._id || order?.table),
            )}
            floors={floors}
            selectedTableId={null}
            onSelectTable={handleTransferConfirm}
          />

          <GuestCountModal
            isOpen={!!guestModalTable}
            tableNumber={guestModalTable?.tableNumber}
            defaultCount={guestModalTable?.capacity || 1}
            onConfirm={handleGuestCountConfirm}
            onClose={handleGuestCountClose}
          />

          {/* First-touch headcount confirmation for orders staff hasn't
              reviewed yet (e.g. QR self-ordered tables). */}
          <GuestCountModal
            isOpen={!!firstTouchOrder}
            tableNumber={firstTouchOrder?.tableNumber}
            defaultCount={firstTouchOrder?.capacity || firstTouchOrder?.guestCount || 1}
            title={`Table ${firstTouchOrder?.tableNumber} — Confirm Guests`}
            subtitle="How many guests are at this table?"
            confirmLabel="Confirm"
            onConfirm={handleFirstTouchConfirm}
            onClose={handleFirstTouchClose}
          />

          <StartShiftModal
            isOpen={showStartShiftModal}
            shiftDefinitions={shiftDefinitions}
            loading={shiftActionLoading}
            onConfirm={handleStartShift}
            onClose={() => setShowStartShiftModal(false)}
          />

          <EndShiftModal
            isOpen={showEndShiftModal}
            shiftSession={activeShift}
            preview={shiftPreview}
            previewLoading={shiftPreviewLoading}
            loading={shiftActionLoading}
            onConfirm={handleCloseShift}
            onClose={() => setShowEndShiftModal(false)}
          />

          <EndDayModal
            isOpen={showEndDayModal}
            dayStatus={dayStatus}
            statusLoading={dayStatusLoading}
            loading={dayActionLoading}
            onConfirm={handleCloseDay}
            onClose={() => setShowEndDayModal(false)}
          />

          <TableOrderSelectorModal
            isOpen={!!orderSelectorTable}
            tableId={orderSelectorTable?._id}
            tableNumber={orderSelectorTable?.tableNumber}
            businessId={businessId}
            headers={adminInfo?.token ? { Authorization: `Bearer ${adminInfo.token}` } : {}}
            onSelectOrder={handleOrderSelectorSelect}
            onNewOrder={handleOrderSelectorNew}
            onClose={handleOrderSelectorClose}
          />

          {/* Payment Modal */}
          <PaymentModal
            isOpen={showPayment}
            order={order}
            paymentMethods={paymentMethods}
            businessId={businessId}
            headers={posAuthHeaders}
            onClose={() => setShowPayment(false)}
            onConfirm={handlePaymentConfirm}
          />

          {/* Receipt Preview */}
          <ReceiptPreview
            isOpen={showReceipt}
            order={
              completedOrder
                ? {
                    ...completedOrder,
                    cashierName:
                      completedOrder.cashierName ||
                      adminInfo?.name ||
                      adminInfo?.email?.split("@")[0] ||
                      "",
                  }
                : completedOrder
            }
            business={completedOrder?.business || currentBusiness}
            businessName={currentBusiness?.name || "Your Business"}
            onClose={handleReceiptClose}
          />
        </>
      )}
    </div>
  );
};

export default PosPage;
