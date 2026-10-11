import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useHistory } from "react-router-dom";
import {
  Utensils,
  ChefHat,
  CheckCircle2,
  Clock,
  LogOut,
  Volume2,
  VolumeX,
  Layers,
  ArrowLeft,
  Bell,
  Search,
} from "lucide-react";
import { AdminContext } from "@/context/AdminContext";
import DropdownBasic from "@/page-layouts/components/DropdownBasic";
import KitchenServices from "@/services/KitchenServices";
import KitchenTicketCard from "./components/KitchenTicketCard";
import KitchenTicketDetailModal from "./components/KitchenTicketDetailModal";
import { notifyError, notifySuccess } from "@/utils/toast";
import Swal from "sweetalert2";
import { usePrinterConnection } from "@/pages/POS/hooks/usePrinterConnection";
import { encodeKitchenTicket } from "./encodeKitchenTicket";
import { Document, Page, Text, View, StyleSheet, pdf as renderPdf } from "@react-pdf/renderer";
import { resolveBusinessLogoUrl } from "@/pages/POS/utils/branding";
import { connectPosSocket, disconnectPosSocket } from "@/services/posSocket";
import axios from "axios";
import { getKitchenSectionIconOption } from "@/pages/Kitchen/constants/sectionIcons";

const LS_KEY_KITCHEN_SECTION_ICON_MAP = "kitchen.sectionIconMap";

const LANES = [
  {
    key: "new",
    title: "New",
    icon: Utensils,
    color: "gray",
    bg: "bg-slate-50",
    accent: "text-slate-700",
    bar: "bg-slate-400",
    borderColor: "#94a3b8",
    badge: "bg-slate-100 text-slate-700",
  },
  {
    key: "preparing",
    title: "Preparing",
    icon: ChefHat,
    color: "amber",
    bg: "bg-amber-50/60",
    accent: "text-amber-800",
    bar: "bg-amber-500",
    borderColor: "#f59e0b",
    badge: "bg-amber-100 text-amber-800",
  },
  {
    key: "ready",
    title: "Ready to Serve",
    icon: CheckCircle2,
    color: "emerald",
    bg: "bg-emerald-50/60",
    accent: "text-emerald-800",
    bar: "bg-emerald-500",
    borderColor: "#10b981",
    badge: "bg-emerald-100 text-emerald-800",
  },
  {
    key: "served",
    title: "Served",
    icon: Clock,
    color: "blue",
    bg: "bg-blue-50/60",
    accent: "text-blue-800",
    bar: "bg-blue-500",
    borderColor: "#3b82f6",
    badge: "bg-blue-100 text-blue-800",
  },
];

const LS_KEY_SOUND = "kitchen.sound.enabled";
const LS_KEY_SECTION = "kitchen.activeSection";
const LS_KEY_NOTIFS = "kitchen.notifications";
const LS_KEY_NOTIF_UNREAD = "kitchen.notif.unread";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

// Valid forward transitions (single-step). Drag-and-drop drops that don't
// map to one of these are silently ignored.
const FORWARD_TRANSITIONS = {
  new: "preparing",
  preparing: "ready",
  ready: "served",
};


const playNewTicketSound = () => {
  // Three loud beeps with a compressor to maximise perceived volume.
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -6;
    compressor.knee.value = 0;
    compressor.ratio.value = 20;
    compressor.attack.value = 0;
    compressor.release.value = 0.1;
    compressor.connect(ctx.destination);

    const makeBeep = (startOffset, freq, duration) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "square";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + startOffset);
      g.gain.exponentialRampToValueAtTime(0.9, ctx.currentTime + startOffset + 0.01);
      g.gain.setValueAtTime(0.9, ctx.currentTime + startOffset + duration - 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startOffset + duration);
      o.connect(g);
      g.connect(compressor);
      o.start(ctx.currentTime + startOffset);
      o.stop(ctx.currentTime + startOffset + duration);
    };

    // Three descending beeps, each 0.25 s, 0.15 s gap between them
    makeBeep(0.0,  1400, 0.25);
    makeBeep(0.4,  1200, 0.25);
    makeBeep(0.8,  1000, 0.35);
  } catch (_) {
    // ignore
  }
};

// ── Kitchen ticket PDF via @react-pdf/renderer ───────────────────────────────
// Renders a proper vector PDF matching the print receipt layout.
// Page width: 72mm = 204pt. Height is calculated from content.
const buildKitchenTicketPdfDoc = (ticket) => {
  const items    = Array.isArray(ticket?.items) ? ticket.items : [];
  const totalQty = items.reduce((s, it) => s + Number(it.quantity || 0), 0);
  const tableNum  = String(ticket.tableNumber || "WALK-IN");
  const tableLabel = ticket.tableLabel ? String(ticket.tableLabel) : "";
  const ticketNo  = ticket.ticketNumber ? String(ticket.ticketNumber) : "";
  const orderNo   = ticket.orderNumber  ? String(ticket.orderNumber)  : "";
  const section   = ticket.sectionName  || "Kitchen";
  const pax       = ticket.pax || ticket.covers || "";
  const dateStr   = ticket.createdAt
    ? new Date(ticket.createdAt).toLocaleString([], {
        year: "numeric", month: "short", day: "2-digit",
        hour: "2-digit", minute: "2-digit",
      })
    : "";
  const subtitle = [tableLabel, orderNo].filter(Boolean).join(" · ");

  // Page dimensions in PDF points (1pt = 1/72 inch, 72mm ≈ 204pt)
  const PW  = 204;
  const PAD = 8;
  const noteCount = items.filter((i) => i.note).length;
  // Generous height so content never overflows to a second page
  const PH  = Math.max(
    120 + (subtitle ? 16 : 0) + items.length * 22 + noteCount * 16,
    110,
  );

  const S = StyleSheet.create({
    page:     { width: PW, height: PH, padding: PAD, fontFamily: "Courier", backgroundColor: "#ffffff", color: "#000000" },
    header:   { textAlign: "center", borderBottomWidth: 1, borderBottomStyle: "dashed", borderBottomColor: "#000000", paddingBottom: 4, marginBottom: 4 },
    tnum:     { fontSize: 18, fontWeight: "bold", textAlign: "center", color: "#000000" },
    tkt:      { fontSize: 13, fontWeight: "bold", color: "#000000" },
    tsub:     { fontSize: 8, color: "#555555", textAlign: "center", marginTop: 2 },
    meta:     { flexDirection: "row", justifyContent: "space-between", fontSize: 8, fontWeight: "bold", color: "#000000", paddingVertical: 2, borderBottomWidth: 1, borderBottomStyle: "dashed", borderBottomColor: "#000000", marginBottom: 3 },
    metaText: { color: "#000000", fontSize: 8 },
    itemRow:  { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingVertical: 2 },
    itemName: { flex: 1, fontSize: 10, fontWeight: "bold", color: "#000000", paddingRight: 4 },
    itemQty:  { fontSize: 13, fontWeight: "bold", color: "#000000" },
    note:     { fontSize: 7, color: "#777777", paddingLeft: 4, paddingBottom: 2 },
    footer:   { borderTopWidth: 1, borderTopStyle: "dashed", borderTopColor: "#000000", flexDirection: "row", justifyContent: "space-between", marginTop: 3, paddingTop: 3, fontSize: 9, fontWeight: "bold", color: "#000000" },
    footerText: { fontSize: 9, fontWeight: "bold", color: "#000000" },
  });

  return (
    <Document>
      <Page size={[PW, PH]} style={S.page}>
        {/* wrap={false} prevents any page break — everything stays on one page */}
        <View wrap={false}>
          <View style={S.header}>
            <Text style={S.tnum}>
              {tableNum}
              {ticketNo ? <Text style={S.tkt}> · {ticketNo}</Text> : null}
            </Text>
            {subtitle ? <Text style={S.tsub}>{subtitle}</Text> : null}
          </View>
          <View style={S.meta}>
            <Text style={S.metaText}>{dateStr}</Text>
            {pax ? <Text style={S.metaText}>PAX {pax}</Text> : null}
          </View>
          {items.map((it, idx) => (
            <View key={idx}>
              <View style={S.itemRow}>
                <Text style={S.itemName}>{String(it.name || "")}</Text>
                <Text style={S.itemQty}>{String(it.quantity || 0)}</Text>
              </View>
              {it.note ? <Text style={S.note}>  ({it.note})</Text> : null}
            </View>
          ))}
          <View style={S.footer}>
            <Text style={S.footerText}>{section}</Text>
            <Text style={S.footerText}>{totalQty} item{totalQty !== 1 ? "s" : ""}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};

const KitchenBoard = () => {
  const getCachedSectionIcon = useCallback((sectionId) => {
    if (!sectionId) return null;
    try {
      const raw = localStorage.getItem(LS_KEY_KITCHEN_SECTION_ICON_MAP);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      return parsed[String(sectionId)] || null;
    } catch {
      return null;
    }
  }, []);

  const {
    state: { adminInfo },
  } = useContext(AdminContext);
  const history = useHistory();

  const businesses = useMemo(
    () => adminInfo?.businesses || [],
    [adminInfo?.businesses],
  );
  const [resolvedBusinesses, setResolvedBusinesses] = useState([]);
  const token = adminInfo?.token;
  const headers = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token],
  );

  const [businessId, setBusinessId] = useState(() => {
    const fromQuery =
      new URLSearchParams(window.location.search).get("selectedOrg") || "";
    return fromQuery || localStorage.getItem("pos.selectedBusiness") || "";
  });

  useEffect(() => {
    if (!resolvedBusinesses.length) return;
    const valid = new Set(resolvedBusinesses.map((b) => b._id));
    if (!businessId || !valid.has(businessId)) {
      setBusinessId(resolvedBusinesses[0]._id);
    }
  }, [resolvedBusinesses, businessId]);

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

    const reqHeaders = token
      ? {
          "Content-Type": "application/json",
          authorization: `Bearer ${token}`,
        }
      : {};

    const hydrateBusinesses = async () => {
      try {
        const res = await axios.post(
          `${Base_URL}/Business/getALL`,
          {},
          { headers: reqHeaders },
        );
        const allBusinesses = Array.isArray(res?.data?.data)
          ? res.data.data
          : [];
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
  }, [businesses, token]);

  const currentBusiness = useMemo(
    () =>
      resolvedBusinesses.find(
        (b) => String(b?._id || "") === String(businessId || ""),
      ) || null,
    [resolvedBusinesses, businessId],
  );

  const [sections, setSections] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState(
    () => localStorage.getItem(LS_KEY_SECTION) || "all",
  );
  const [searchText, setSearchText] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const raw = localStorage.getItem(LS_KEY_SOUND);
    return raw === null ? true : raw === "true";
  });
  const printer = usePrinterConnection();
  const [now, setNow] = useState(Date.now());
  const [detailTicketId, setDetailTicketId] = useState(null);
  const lastKnownTicketIdsRef = useRef(new Set());
  const [liveStatus, setLiveStatus] = useState("fallback");

  // In-board notification banner (non-blocking, auto-dismisses)
  const [newOrderBanner, setNewOrderBanner] = useState(null);
  const bannerTimerRef = useRef(null);

  // Persistent kitchen notification log
  const [kitchenNotifs, setKitchenNotifs] = useState(() => {
    try {
      const saved = localStorage.getItem(LS_KEY_NOTIFS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const notifPanelOpenRef = useRef(false);
  notifPanelOpenRef.current = notifPanelOpen;
  const [notifUnread, setNotifUnread] = useState(() => {
    try {
      const saved = localStorage.getItem(LS_KEY_NOTIF_UNREAD);
      return saved ? Number(saved) : 0;
    } catch {
      return 0;
    }
  });
  const notifBtnRef = useRef(null);
  const notifPanelRef = useRef(null);
  const [notifPanelStyle, setNotifPanelStyle] = useState({});
  const [notifSearch, setNotifSearch] = useState("");

  // Drag-and-drop state
  const [draggingTicketId, setDraggingTicketId] = useState(null);
  const [dragOverLane, setDragOverLane] = useState(null);

  // Persist preferences
  useEffect(() => {
    localStorage.setItem(LS_KEY_SOUND, String(soundEnabled));
  }, [soundEnabled]);
  useEffect(() => {
    localStorage.setItem(LS_KEY_SECTION, activeSection);
  }, [activeSection]);
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY_NOTIFS, JSON.stringify(kitchenNotifs));
    } catch {
      // quota exceeded — skip
    }
  }, [kitchenNotifs]);
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY_NOTIF_UNREAD, String(notifUnread));
    } catch {
      // ignore
    }
  }, [notifUnread]);

  useEffect(() => {
    const id = window.setTimeout(
      () => setDebouncedSearch(String(searchText || "").trim()),
      250,
    );
    return () => window.clearTimeout(id);
  }, [searchText]);

  // Heartbeat for "X minutes ago" counters
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Fetch sections on business change
  const fetchSections = useCallback(async () => {
    if (!businessId) return;
    try {
      const res = await KitchenServices.getSections(
        { business: businessId },
        headers,
      );
      if (res.data?.success) {
        setSections(res.data.data || []);
      }
    } catch (err) {
      notifyError(
        err?.response?.data?.message || "Failed to load kitchen sections",
      );
    }
  }, [businessId, headers]);

  // Use a ref so sound preference can be read inside fetchTickets without
  // making it a dependency (toggling sound must not re-trigger fetches).
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  // Fetch tickets (poll)
  const fetchTickets = useCallback(
    async (silent = false) => {
      if (!businessId) return;
      if (!silent) setLoading(true);
      try {
        const params = { business: businessId, limit: 200 };
        if (activeSection !== "all") params.section = activeSection;
        if (sourceFilter !== "all") params.source = sourceFilter;
        if (statusFilter !== "all") params.status = statusFilter;
        if (debouncedSearch) params.search = debouncedSearch;
        const res = await KitchenServices.getTickets(params, headers);
        if (res.data?.success) {
          const next = res.data.data || [];
          // Detect new tickets for the audible + visible alert
          const prevIds = lastKnownTicketIdsRef.current;
          const newOnes = next.filter(
            (t) => t.status === "new" && !prevIds.has(t._id),
          );
          if (prevIds.size > 0 && newOnes.length > 0) {
            if (soundEnabledRef.current) playNewTicketSound();
            const sectionsSeen = Array.from(
              new Set(newOnes.map((t) => t.sectionName).filter(Boolean)),
            );
            // Surface source from first new ticket for banner context
            const firstNew = newOnes[0];
            const bannerSource =
              firstNew?.source === "qr" ? "QR"
              : firstNew?.source === "mixed" ? "Mixed"
              : "POS";
            setNewOrderBanner({
              count: newOnes.length,
              sections: sectionsSeen,
              orderNumber: firstNew?.orderNumber || null,
              source: newOnes.length === 1 ? bannerSource : null,
              timestamp: Date.now(),
            });
            if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
            bannerTimerRef.current = setTimeout(
              () => setNewOrderBanner(null),
              6000,
            );
          }
          lastKnownTicketIdsRef.current = new Set(next.map((t) => t._id));
          // Preserve any ticket that is still in an optimistic (in-flight) state.
          // A full refresh triggered by an unrelated socket event can race with an
          // in-flight advanceTicket call and temporarily revert the ticket to its
          // previous status (the "flicker"). We skip overwriting those tickets here;
          // they are updated by handleAdvance's own setTickets call when the API resolves.
          setTickets((prev) => {
            const optimisticById = new Map(
              prev.filter((t) => t._optimistic).map((t) => [t._id, t]),
            );
            if (optimisticById.size === 0) return next;
            return next.map((t) => optimisticById.get(t._id) || t);
          });
        }
      } catch (err) {
        if (!silent) {
          notifyError(
            err?.response?.data?.message || "Failed to load kitchen tickets",
          );
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [
      businessId,
      activeSection,
      sourceFilter,
      statusFilter,
      debouncedSearch,
      headers,
    ],
  );

  useEffect(() => {
    fetchSections();
  }, [fetchSections]);

  // Kitchen notification panel positioning + close-on-outside-click
  const openNotifPanel = useCallback(() => {
    if (notifBtnRef.current) {
      const rect = notifBtnRef.current.getBoundingClientRect();
      const w = 320;
      let left = rect.right - w;
      if (left < 8) left = 8;
      setNotifPanelStyle({ position: "fixed", top: rect.bottom + 8, left, width: w, zIndex: 9999 });
    }
    setNotifUnread(0);
    setNotifSearch("");
    setNotifPanelOpen(true);
  }, []);

  useEffect(() => {
    if (!notifPanelOpen) return;
    const handler = (e) => {
      if (
        notifBtnRef.current && !notifBtnRef.current.contains(e.target) &&
        notifPanelRef.current && !notifPanelRef.current.contains(e.target)
      ) {
        setNotifPanelOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [notifPanelOpen]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // Realtime updates via Socket.io.
  const fetchTicketsRef = useRef(fetchTickets);
  fetchTicketsRef.current = fetchTickets;

  useEffect(() => {
    if (!businessId || !token) return undefined;
    setLiveStatus("fallback");

    const KITCHEN_EVENT_TYPES = new Set([
      "kitchen:ticket:new",
      "kitchen:ticket:status",
      "kitchen:ticket:priority",
      "order:fired",
      "order:created",
      "order:voided",
    ]);

    connectPosSocket({
      businessId,
      token,
      onConnect: () => setLiveStatus("connected"),
      onDisconnect: () => setLiveStatus("fallback"),
      onEvent: (event) => {
        setLiveStatus("connected");
        if (KITCHEN_EVENT_TYPES.has(event?.type)) {
          fetchTicketsRef.current(true);
        }
        // Feed kitchen notification log
        if (event?.type) {
          const srcLabel =
            event.source === "qr" || event.serviceType === "qr_table" ? "QR"
            : event.source === "mixed" ? "Mixed"
            : "POS";
          const notif = {
            id: `${event.type}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            type: event.type,
            orderNumber: event.orderNumber || null,
            ticketNumber: event.ticketNumber || null,
            sectionName: event.sectionName || null,
            nextStatus: event.nextStatus || null,
            source: srcLabel,
            ts: event.ts || new Date().toISOString(),
          };
          setKitchenNotifs((prev) => [notif, ...prev].slice(0, 100));
          if (!notifPanelOpenRef.current) setNotifUnread((n) => n + 1);
        }
      },
    });

    return () => {
      setLiveStatus("fallback");
      disconnectPosSocket();
    };
  }, [businessId, token]);

  // Lightweight fallback refresh (in case socket is temporarily disconnected).
  useEffect(() => {
    if (!businessId) return undefined;
    const id = setInterval(() => fetchTicketsRef.current(true), 60000);
    return () => clearInterval(id);
  }, [businessId]);

  // ── Actions ──────────────────────────────────────────────
  const handleAdvance = useCallback(
    async (ticket, nextStatus) => {
      // Optimistic update — instant feedback without a blocking toast
      const prevSnapshot = ticket;
      setTickets((prev) =>
        prev.map((t) =>
          t._id === ticket._id
            ? { ...t, status: nextStatus, _optimistic: true }
            : t,
        ),
      );
      try {
        const res = await KitchenServices.updateTicketStatus(
          ticket._id,
          nextStatus,
          "",
          headers,
        );
        if (res.data?.success) {
          setTickets((prev) =>
            prev.map((t) => (t._id === ticket._id ? res.data.data : t)),
          );
        }
      } catch (err) {
        // Rollback on failure
        setTickets((prev) =>
          prev.map((t) => (t._id === ticket._id ? prevSnapshot : t)),
        );
        notifyError(err?.response?.data?.message || "Failed to update ticket");
      }
    },
    [headers],
  );

  // ── Drag & drop handlers ────────────────────────────────
  const handleDragStart = useCallback((ticket) => {
    setDraggingTicketId(ticket._id);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingTicketId(null);
    setDragOverLane(null);
  }, []);

  const handleLaneDragOver = useCallback((e, laneKey) => {
    e.preventDefault();
    setDragOverLane(laneKey);
  }, []);

  const handleLaneDrop = useCallback(
    (e, laneKey) => {
      e.preventDefault();
      setDragOverLane(null);
      const ticketId = draggingTicketId;
      setDraggingTicketId(null);
      if (!ticketId) return;
      const ticket = tickets.find((t) => t._id === ticketId);
      if (!ticket) return;
      const expectedNext = FORWARD_TRANSITIONS[ticket.status];
      if (!expectedNext) return; // terminal status
      if (laneKey !== expectedNext) return; // ignore invalid drops silently
      handleAdvance(ticket, expectedNext);
    },
    [draggingTicketId, tickets, handleAdvance],
  );

  const handleCancel = useCallback(
    async (ticket) => {
      const result = await Swal.fire({
        icon: "warning",
        title: "Cancel ticket?",
        text: `This will mark ticket ${
          ticket.ticketNumber || ticket.orderNumber
        } as cancelled.`,
        showCancelButton: true,
        confirmButtonColor: "#ef4444",
        confirmButtonText: "Yes, cancel",
        cancelButtonText: "Keep",
      });
      if (!result.isConfirmed) return;
      try {
        const res = await KitchenServices.updateTicketStatus(
          ticket._id,
          "cancelled",
          "Cancelled by kitchen",
          headers,
        );
        if (res.data?.success) {
          setTickets((prev) =>
            prev.map((t) => (t._id === ticket._id ? res.data.data : t)),
          );
        }
      } catch (err) {
        notifyError(err?.response?.data?.message || "Failed to cancel ticket");
      }
    },
    [headers],
  );

  const handleTogglePriority = useCallback(
    async (ticket) => {
      const next = ticket.priority === "urgent" ? "normal" : "urgent";
      try {
        const res = await KitchenServices.updateTicketPriority(
          ticket._id,
          next,
          headers,
        );
        if (res.data?.success) {
          setTickets((prev) =>
            prev.map((t) => (t._id === ticket._id ? res.data.data : t)),
          );
        }
      } catch (err) {
        notifyError(
          err?.response?.data?.message || "Failed to update priority",
        );
      }
    },
    [headers],
  );

  // Build a concise kitchen KDS slip HTML (shared by print + download).
  // Intentionally minimal for kitchen workflow: order no, table, items, qty only.
  const buildTicketHtml = useCallback(
    (ticket) => {
      const items = Array.isArray(ticket?.items) ? ticket.items : [];
      const escaped = (v) =>
        String(v ?? "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");

      const tableNum = ticket.tableNumber ? escaped(ticket.tableNumber) : "WALK-IN";
      const tableLabel = ticket.tableLabel ? escaped(ticket.tableLabel) : "";

      const totalQty = items.reduce((s, it) => s + Number(it.quantity || 0), 0);
      const pax = ticket.pax || ticket.covers || "";
      const dateStr = ticket.createdAt
        ? new Date(ticket.createdAt).toLocaleString([], {
            year: "numeric", month: "short", day: "2-digit",
            hour: "2-digit", minute: "2-digit",
          })
        : "";
      const ticketNo = escaped(ticket.ticketNumber || "");
      const orderNo = escaped(ticket.orderNumber || "");
      const sectionName = escaped(ticket.sectionName || "Kitchen");

      return `<!doctype html>
<html><head><meta charset="utf-8"/>
<title>KT-${ticketNo}</title>
<style>
@page{margin:4mm 3mm;size:80mm auto}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#fff;color:#000;font-family:"Courier New",Courier,monospace;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.wrap{width:min(294px,100%);margin:0 auto;padding:4px 2px 8px}
.top{text-align:center;border-bottom:1px dashed #000;padding-bottom:4px;margin-bottom:4px}
.tnum{font-size:18pt;font-weight:700;letter-spacing:2px;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tkt{font-size:13pt;font-weight:700;letter-spacing:1px}
.tsub{font-size:8pt;font-weight:400;color:#555;margin-top:3px;letter-spacing:0.5px}
.meta{display:flex;justify-content:space-between;font-size:8pt;padding:2px 0;border-bottom:1px dashed #000;margin-bottom:3px}
.meta span{font-weight:700;color:#000}
.divider{border-top:1px dashed #000;margin:3px 0}
.row{display:flex;justify-content:space-between;align-items:baseline;font-size:10pt;font-weight:700;padding:2px 0;line-height:1.3}
.row .name{flex:1;padding-right:6px;word-break:break-word}
.row .qty{font-size:13pt;font-weight:700;white-space:nowrap}
.footer{border-top:1px dashed #000;margin-top:3px;padding-top:3px;display:flex;justify-content:space-between;font-size:9pt;font-weight:700}
</style></head><body>
<div class="wrap">
  <div class="top">
    <div class="tnum">${tableNum}${ticketNo ? `<span class="tkt"> · ${ticketNo}</span>` : ""}</div>
    ${tableLabel || orderNo ? `<div class="tsub">${[tableLabel, orderNo].filter(Boolean).join(" · ")}</div>` : ""}
  </div>
  <div class="meta">
    <span>${escaped(dateStr)}</span>
    ${pax ? `<span>PAX ${escaped(pax)}</span>` : ""}
  </div>
  ${items.map((it) => `<div class="row">
    <span class="name">${escaped(it.name)}${it.note ? ` <em style="font-size:10px;font-weight:400">(${escaped(it.note)})</em>` : ""}</span>
    <span class="qty">${escaped(it.quantity || 0)}</span>
  </div>`).join("")}
  <div class="footer">
    <span>${sectionName}</span>
    <span>${totalQty} item${totalQty !== 1 ? "s" : ""}</span>
  </div>
</div></body></html>`;
    },
    [],
  );

  const sendTicketToThermalPrinter = useCallback(
    (ticket) => {
      const data = encodeKitchenTicket(ticket, { columns: 42 });
      printer.print(data);
      notifySuccess("Ticket sent to printer");
    },
    [printer],
  );

  const handlePrintTicket = useCallback(
    async (ticket) => {
      if (!ticket) return;

      // Path 1 — already connected: silent direct print, no dialog.
      if (printer.isConnected) {
        sendTicketToThermalPrinter(ticket);
        return;
      }

      // Path 2 — Web API available but not yet paired: open picker once,
      // then print silently on every subsequent click.
      if (printer.supported.length > 0) {
        try {
          await printer.connect(printer.connectionType);
          sendTicketToThermalPrinter(ticket);
        } catch (err) {
          const msg = err?.message || "";
          if (msg.toLowerCase().includes("cancel") || msg.toLowerCase().includes("user")) {
            notifyError("Printer connection cancelled.");
          } else if (msg.toLowerCase().includes("timeout")) {
            notifyError("Printer connection timed out. Try again.");
          } else {
            notifyError(msg || "Could not connect to printer.");
          }
        }
        return;
      }

      // Path 3 — no Web Serial/USB/BT (non-Chromium): open receipt HTML in a
      // new window that auto-triggers the print dialog.
      const html = buildTicketHtml(ticket);
      const printHtml = html.replace(
        "</body>",
        `<script>window.onload=function(){setTimeout(function(){window.print();window.onafterprint=function(){window.close();};},300);}</script></body>`,
      );
      const blob = new Blob([printHtml], { type: "text/html" });
      const url  = URL.createObjectURL(blob);
      const win  = window.open(url, "_blank", "width=420,height=700,noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      if (!win) notifyError("Pop-up blocked. Allow pop-ups to print.");
    },
    [printer, sendTicketToThermalPrinter, buildTicketHtml],
  );

  const handleDownloadTicket = useCallback(
    async (ticket) => {
      if (!ticket) return;
      try {
        const blob = await renderPdf(buildKitchenTicketPdfDoc(ticket)).toBlob();
        const fileBase = String(
          ticket.ticketNumber || ticket.orderNumber || "kitchen-ticket",
        ).replace(/[^a-zA-Z0-9-_]/g, "_");
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${fileBase}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (err) {
        notifyError("Failed to download kitchen ticket PDF");
        console.error("Kitchen PDF download failed:", err);
      }
    },
    [],
  );

  // Group into lanes
  const lanes = useMemo(() => {
    const base = {
      new: [],
      preparing: [],
      ready: [],
      served: [],
    };
    tickets.forEach((t) => {
      if (base[t.status]) base[t.status].push(t);
    });
    // Urgent first; active lanes newest-first so latest orders surface at top;
    // served lane also newest-first so most recently served appears first.
    for (const k of Object.keys(base)) {
      base[k].sort((a, b) => {
        if (a.priority === "urgent" && b.priority !== "urgent") return -1;
        if (a.priority !== "urgent" && b.priority === "urgent") return 1;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
    }
    return base;
  }, [tickets]);

  const totalActive =
    lanes.new.length + lanes.preparing.length + lanes.ready.length;
  const sourceOptions = useMemo(
    () => [
      { value: "all", label: "All Sources" },
      { value: "pos", label: "POS" },
      { value: "qr", label: "QR" },
      { value: "mixed", label: "Mixed" },
    ],
    [],
  );
  const statusOptions = useMemo(
    () => [
      { value: "all", label: "All Statuses" },
      { value: "new", label: "New" },
      { value: "preparing", label: "Preparing" },
      { value: "ready", label: "Ready" },
      { value: "served", label: "Served" },
      { value: "cancelled", label: "Cancelled" },
    ],
    [],
  );
  const toolbarControlHeight = 46;
  const toolbarSelectStyles = useMemo(
    () => ({
      control: (provided, state) => ({
        ...provided,
        minHeight: "100%",
        height: "100%",
        boxSizing: "border-box",
        padding: "0 6px",
        background: "#f9fafb",
        borderColor: state.isFocused || state.menuIsOpen ? "var(--p-blue)" : "#e5e7eb",
        boxShadow: "none",
        "&:hover": {
          borderColor: state.isFocused || state.menuIsOpen ? "var(--p-blue)" : "#d1d5db",
        },
      }),
      container: (provided) => ({
        ...provided,
        height: `${toolbarControlHeight}px`,
      }),
      valueContainer: (provided) => ({
        ...provided,
        height: "100%",
        padding: "0 4px",
        display: "flex",
        alignItems: "center",
      }),
      indicatorsContainer: (provided) => ({
        ...provided,
        height: "100%",
        display: "flex",
        alignItems: "center",
      }),
      singleValue: (provided) => ({
        ...provided,
        color: "#374151",
        fontSize: "12px",
        fontWeight: 500,
        lineHeight: "1.2",
        margin: 0,
      }),
      placeholder: (provided) => ({
        ...provided,
        color: "#9ca3af",
        fontSize: "12px",
        lineHeight: "1.2",
        margin: 0,
      }),
      input: (provided) => ({
        ...provided,
        color: "#111827",
        fontSize: "12px",
        margin: 0,
        padding: 0,
      }),
      option: (provided, state) => ({
        ...provided,
        backgroundColor: state.isSelected ? "#e5e7eb" : state.isFocused ? "#f3f4f6" : "#ffffff",
        color: "#1f2937",
        fontSize: "12px",
        "&:active": { backgroundColor: "#e5e7eb", color: "#1f2937" },
      }),
      indicatorSeparator: () => ({ display: "none" }),
      dropdownIndicator: (provided) => ({
        ...provided,
        padding: "0 6px",
        color: "#9ca3af",
        "&:hover": { color: "#6b7280" },
      }),
      menu: (provided) => ({
        ...provided,
        background: "white",
        border: "1px solid #e5e7eb",
        boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
        zIndex: 50,
      }),
    }),
    [toolbarControlHeight],
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gray-100 overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => history.push("/dashboard")}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            title="Back to Dashboard"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="inline-flex items-center gap-2.5 min-w-0">
            {resolveBusinessLogoUrl(currentBusiness) ? (
              <div className="h-16 w-16 rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden flex items-center justify-center shrink-0">
                <img
                  src={resolveBusinessLogoUrl(currentBusiness)}
                  alt={`${currentBusiness.name} logo`}
                  className="h-full w-full object-contain p-1.5"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              </div>
            ) : (
              <div className="h-16 w-16 rounded-2xl bg-[var(--p-blue)]/10 text-[var(--p-blue)] flex items-center justify-center shrink-0">
                <ChefHat size={24} />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-gray-900 truncate leading-tight">
                {currentBusiness?.name || "Kitchen Board"}
              </h1>
              <div className="text-[10.5px] text-gray-500 leading-tight flex items-center gap-1.5">
                <ChefHat size={10} className="text-[var(--p-blue)]" />
                Kitchen Board
                <span className="text-gray-300">·</span>
                <span className="tabular-nums">
                  {totalActive} active ticket{totalActive === 1 ? "" : "s"}
                </span>
                <span className="text-gray-300">·</span>
                <span className={`flex items-center gap-1 ${liveStatus === "connected" ? "text-emerald-600" : "text-amber-500"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${liveStatus === "connected" ? "bg-emerald-500" : "bg-amber-500 animate-pulse"}`} />
                  {liveStatus === "connected" ? "Live" : "Polling"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-end gap-1.5 flex-wrap justify-end">
          <div className="relative w-[220px] h-[46px]">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search order, ticket, table..."
              className="w-full h-[46px] pl-8 pr-3 text-[12px] bg-gray-50 border border-gray-200 text-gray-900 rounded-lg focus:outline-none focus:border-[var(--p-blue)] placeholder:text-gray-400"
            />
          </div>
          <div className="w-40 h-[46px]">
            <DropdownBasic
              value={sourceFilter}
              onChange={(v) => setSourceFilter(v || "all")}
              options={sourceOptions}
              placeholder="All Sources"
              width="100%"
              appearance="filterPill"
              isClearable={false}
              styles={toolbarSelectStyles}
            />
          </div>
          <div className="w-40 h-[46px]">
            <DropdownBasic
              value={statusFilter}
              onChange={(v) => setStatusFilter(v || "all")}
              options={statusOptions}
              placeholder="All Statuses"
              width="100%"
              appearance="filterPill"
              isClearable={false}
              styles={toolbarSelectStyles}
            />
          </div>
          {resolvedBusinesses.length > 1 && (
            <div className="w-52 h-[46px]">
              <DropdownBasic
                value={businessId}
                onChange={(v) => setBusinessId(v || "")}
                options={resolvedBusinesses.map((b) => ({
                  value: b._id,
                  label: b.name,
                }))}
                placeholder="Select Business"
                width="100%"
                appearance="filterPill"
                isClearable={false}
                styles={toolbarSelectStyles}
              />
            </div>
          )}

          <button
            type="button"
            onClick={() => setSoundEnabled((v) => !v)}
            title={soundEnabled ? "Mute new ticket sound" : "Unmute"}
            className={`h-[46px] w-[46px] inline-flex items-center justify-center leading-none rounded-lg border transition-colors ${
              soundEnabled
                ? "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                : "bg-gray-100 text-gray-400 border-gray-200"
            }`}
          >
            {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
          </button>

          {/* Kitchen notification bell */}
          <div className="relative h-[46px]">
            <button
              ref={notifBtnRef}
              type="button"
              onClick={() => notifPanelOpen ? setNotifPanelOpen(false) : openNotifPanel()}
              title="Kitchen notifications"
              className="h-[46px] w-[46px] inline-flex items-center justify-center leading-none rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Bell size={14} />
              {notifUnread > 0 && (
                <>
                  <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-red-500 animate-ping opacity-60" />
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[9.5px] font-bold rounded-full flex items-center justify-center leading-none ring-2 ring-white">
                    {notifUnread > 99 ? "99+" : notifUnread}
                  </span>
                </>
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={() => history.push("/dashboard")}
            className="h-[46px] inline-flex items-center gap-1.5 px-4 leading-none text-xs font-semibold text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <LogOut size={12} />
            Exit
          </button>
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide px-3 py-2 bg-white border-b border-gray-100 shrink-0">
        <button
          type="button"
          onClick={() => setActiveSection("all")}
          className={`
            inline-flex items-center gap-1.5 px-3.5 h-8 text-[11px] font-semibold rounded-full whitespace-nowrap transition-all
            ${
              activeSection === "all"
                ? "bg-[var(--p-blue)] text-white shadow-sm"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }
          `}
        >
          <Layers size={11} />
          All Sections
        </button>
        {sections.map((s) => {
          const active = activeSection === s._id;
          const iconValue =
            s?.icon || s?.sectionIcon || s?.iconKey || getCachedSectionIcon(s._id) || "utensils";
          const SectionIcon = getKitchenSectionIconOption(iconValue).icon;
          return (
            <button
              key={s._id}
              type="button"
              onClick={() => setActiveSection(s._id)}
              className={`
                inline-flex items-center gap-1.5 px-3.5 h-8 text-[11px] font-semibold rounded-full whitespace-nowrap transition-all
                ${
                  active
                    ? "text-white shadow-sm"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }
              `}
              style={active ? { background: s.color || "#6366f1" } : undefined}
            >
              <SectionIcon size={11} className={active ? "text-white/85" : "text-gray-500"} />
              {s.name}
            </button>
          );
        })}
      </div>

      {/* New order notification banner */}
      {newOrderBanner && (
        <div className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-between gap-3 shrink-0 animate-slideDown shadow-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-white shadow-sm">
              <Bell size={14} />
              <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-white border-2 border-amber-500 animate-ping opacity-70" />
            </span>
            <div className="min-w-0">
              <div className="text-[13px] font-bold text-white truncate leading-tight">
                {newOrderBanner.count} new{" "}
                {newOrderBanner.count === 1 ? "ticket" : "tickets"} arrived
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                {newOrderBanner.orderNumber && (
                  <span className="text-[10px] font-mono font-bold text-white/80">
                    {newOrderBanner.orderNumber}
                  </span>
                )}
                {newOrderBanner.source && (
                  <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-white/20 text-white">
                    {newOrderBanner.source}
                  </span>
                )}
                {newOrderBanner.sections.length > 0 && (
                  <span className="text-[10.5px] text-white/80 truncate">
                    {newOrderBanner.sections.join(" · ")}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setNewOrderBanner(null)}
            className="text-[11px] font-semibold text-white/80 hover:text-white px-2.5 py-1 rounded-lg hover:bg-white/20 transition-colors shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Board */}
      <div className="flex-1 overflow-hidden min-h-0">
        <div className="h-full overflow-y-auto overflow-x-hidden px-3 py-3">
          <div className="flex xl:grid xl:grid-cols-4 gap-3 h-full min-w-max xl:min-w-0">
            {LANES.map((lane) => {
              const LaneIcon = lane.icon;
              const laneTickets = lanes[lane.key] || [];
              const dragging = tickets.find((t) => t._id === draggingTicketId);
              const isValidDrop =
                dragging && FORWARD_TRANSITIONS[dragging.status] === lane.key;
              const isOver = dragOverLane === lane.key && isValidDrop;
              return (
                <div
                  key={lane.key}
                  onDragOver={(e) =>
                    isValidDrop ? handleLaneDragOver(e, lane.key) : undefined
                  }
                  onDragLeave={() => setDragOverLane(null)}
                  onDrop={(e) => handleLaneDrop(e, lane.key)}
                  style={{ borderTop: `3px solid ${isOver ? "var(--p-blue)" : lane.borderColor}` }}
                  className={`w-[320px] xl:w-full h-full min-h-[360px] flex flex-col bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
                    isOver
                      ? "border-[var(--p-blue)] ring-2 ring-[var(--p-blue)]/20 scale-[1.01]"
                      : dragging && isValidDrop
                        ? "border-dashed border-[var(--p-blue)]/40"
                        : "border-gray-200"
                  }`}
                >
                  {/* Lane header */}
                  <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 bg-white">
                    <div className="flex items-center gap-2">
                      <LaneIcon size={14} className={lane.accent} />
                      <h3 className={`text-[12px] font-bold uppercase tracking-wide ${lane.accent}`}>
                        {lane.title}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {lane.key === "served" && laneTickets.length > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setTickets((prev) =>
                              prev.filter((t) => t.status !== "served"),
                            )
                          }
                          className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                        >
                          Clear all
                        </button>
                      )}
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full tabular-nums ${lane.badge}`}>
                        {laneTickets.length}
                      </span>
                    </div>
                  </div>

                  {/* Lane body */}
                  <div
                    className={`flex-1 overflow-y-auto px-2 py-2 space-y-2 ${lane.bg} ${
                      isOver ? "bg-[var(--p-blue)]/[0.03]" : ""
                    }`}
                  >
                    {laneTickets.length === 0 ? (
                      <div className={`flex flex-col items-center justify-center h-full py-10 ${isOver ? "text-[var(--p-blue)]" : "text-gray-400"}`}>
                        <LaneIcon size={24} />
                        <p className="text-[10px] mt-2 uppercase tracking-widest font-semibold">
                          {isOver ? "Drop here" : "No tickets"}
                        </p>
                      </div>
                    ) : (
                      laneTickets.map((t) => (
                        <div
                          key={t._id}
                          draggable={
                            t.status !== "served" && t.status !== "cancelled"
                          }
                          onDragStart={() => handleDragStart(t)}
                          onDragEnd={handleDragEnd}
                          className={`transition-opacity ${
                            draggingTicketId === t._id ? "opacity-40" : ""
                          }`}
                        >
                          <KitchenTicketCard
                            ticket={t}
                            now={now}
                            onAdvance={handleAdvance}
                            onCancel={handleCancel}
                            onTogglePriority={handleTogglePriority}
                            onViewDetails={(tk) => setDetailTicketId(tk._id)}
                            onPrint={handlePrintTicket}
                            onDownload={handleDownloadTicket}
                          />
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Kitchen notification panel */}
      {notifPanelOpen && (
        <div
          ref={notifPanelRef}
          style={notifPanelStyle}
          className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col"
        >
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50 shrink-0">
            <div className="flex items-center gap-2">
              <Bell size={13} className="text-[var(--p-blue)]" />
              <span className="text-xs font-bold text-gray-800">Kitchen Activity</span>
              {kitchenNotifs.length > 0 && (
                <span className="text-[9px] font-semibold bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">
                  {kitchenNotifs.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {kitchenNotifs.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setKitchenNotifs([]);
                    setNotifUnread(0);
                    try {
                      localStorage.removeItem(LS_KEY_NOTIFS);
                      localStorage.removeItem(LS_KEY_NOTIF_UNREAD);
                    } catch {
                      // ignore
                    }
                  }}
                  className="inline-flex items-center gap-1 text-[10px] text-gray-400 hover:text-red-500 px-2 py-1 rounded-md hover:bg-red-50 transition-colors"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={() => setNotifPanelOpen(false)}
                className="w-6 h-6 inline-flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors text-sm leading-none"
              >
                ✕
              </button>
            </div>
          </div>
          <div className="px-3 py-2 border-b border-gray-100 shrink-0">
            <div className="relative">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={notifSearch}
                onChange={(e) => setNotifSearch(e.target.value)}
                placeholder="Search order, ticket, source…"
                className="w-full pl-7 pr-3 h-7 text-[11px] bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-[var(--p-blue)] placeholder:text-gray-300"
              />
            </div>
          </div>
          <div className="max-h-[380px] overflow-y-auto divide-y divide-gray-50">
            {kitchenNotifs.filter((n) => {
              const q = notifSearch.trim().toLowerCase();
              if (!q) return true;
              return (
                (n.orderNumber || "").toLowerCase().includes(q) ||
                (n.ticketNumber || "").toLowerCase().includes(q) ||
                (n.sectionName || "").toLowerCase().includes(q) ||
                (n.type || "").toLowerCase().includes(q) ||
                (n.source || "").toLowerCase().includes(q)
              );
            }).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400 gap-2">
                <Bell size={20} className="text-gray-300" />
                <p className="text-xs font-medium">{notifSearch ? "No matching events" : "No kitchen events yet"}</p>
              </div>
            ) : (
              kitchenNotifs
                .filter((n) => {
                  const q = notifSearch.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    (n.orderNumber || "").toLowerCase().includes(q) ||
                    (n.ticketNumber || "").toLowerCase().includes(q) ||
                    (n.sectionName || "").toLowerCase().includes(q) ||
                    (n.type || "").toLowerCase().includes(q) ||
                    (n.source || "").toLowerCase().includes(q)
                  );
                })
                .map((n) => {
                  const typeLabel = {
                    "kitchen:ticket:new": { icon: "🍽️", label: "Ticket created" },
                    "kitchen:ticket:status": { icon: "🔔", label: "Ticket status" },
                    "kitchen:ticket:priority": { icon: "⚡", label: "Ticket urgent" },
                    "order:fired": { icon: "🔥", label: "Order fired" },
                    "order:created": { icon: "🧾", label: "Order created" },
                    "order:voided": { icon: "❌", label: "Order voided" },
                    "order:completed": { icon: "✅", label: "Order completed" },
                  }[n.type] || { icon: "📡", label: n.type };
                  return (
                    <div key={n.id} className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-gray-50">
                      <span className="text-[13px] shrink-0 mt-0.5">{typeLabel.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-gray-800 leading-snug">{typeLabel.label}</p>
                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                          {n.orderNumber && (
                            <span className="text-[9px] font-mono font-bold text-gray-600">{n.orderNumber}</span>
                          )}
                          {n.ticketNumber && (
                            <span className="text-[9px] font-mono text-gray-400">[{n.ticketNumber}]</span>
                          )}
                          {n.source && (
                            <span className={`text-[8px] font-bold uppercase px-1 py-0.5 rounded ${
                              n.source === "QR" ? "bg-amber-100 text-amber-700"
                              : n.source === "Mixed" ? "bg-violet-100 text-violet-700"
                              : "bg-blue-100 text-blue-700"
                            }`}>{n.source}</span>
                          )}
                          {n.nextStatus && (
                            <span className="text-[8px] font-bold uppercase px-1 py-0.5 rounded bg-gray-100 text-gray-600">
                              → {n.nextStatus}
                            </span>
                          )}
                          {n.sectionName && (
                            <span className="text-[9px] text-gray-400 truncate">{n.sectionName}</span>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] text-gray-400 shrink-0 mt-0.5 whitespace-nowrap">
                        {new Date(n.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      )}

      {/* Ticket detail modal */}
      <KitchenTicketDetailModal
        isOpen={!!detailTicketId}
        ticket={tickets.find((t) => t._id === detailTicketId) || null}
        onClose={() => setDetailTicketId(null)}
        onAdvance={async (t, next) => {
          await handleAdvance(t, next);
        }}
        onCancel={async (t) => {
          await handleCancel(t);
          setDetailTicketId(null);
        }}
        onTogglePriority={handleTogglePriority}
        onPrint={handlePrintTicket}
        onDownload={handleDownloadTicket}
      />
    </div>
  );
};

export default KitchenBoard;
