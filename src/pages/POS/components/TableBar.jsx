import React, { useMemo, useRef, useState, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  UserPlus,
  RefreshCw,
  LayoutGrid,
  Building2,
  LogOut,
  Repeat,
  MoreVertical,
  Search,
  Users,
  CheckCircle2,
  Trash2,
  CalendarCheck,
} from "lucide-react";
import { resolveBusinessLogoUrl } from "../utils/branding";

const STATUS_PILL = {
  available: "bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200",
  occupied:
    "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100",
  reserved: "bg-red-50 text-red-700 border-red-300 hover:bg-red-100",
};

const STATUS_DOT = {
  available: "bg-gray-400",
  occupied: "bg-amber-500",
  reserved: "bg-red-500",
};

// Visual overrides when a table has an active order with a specific kitchen phase
const PHASE_OVERRIDE = {
  new: {
    pill: "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100",
    dot: "bg-amber-500",
    badge: "NEW",
    badgeCls: "text-amber-600",
  },
  preparing: {
    pill: "bg-orange-50 text-orange-800 border-orange-400 hover:bg-orange-100",
    dot: "bg-orange-500",
    badge: "PREP",
    badgeCls: "text-orange-600",
  },
  ready: {
    pill: "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100",
    dot: "bg-emerald-500",
    badge: "READY",
    badgeCls: "text-emerald-700",
  },
  served: {
    pill: "bg-indigo-50 text-indigo-800 border-indigo-300 hover:bg-indigo-100",
    dot: "bg-indigo-500",
    badge: "BILL",
    badgeCls: "text-indigo-700",
  },
};

const TablePill = ({ table, isSelected, isActive, onSelect }) => {
  const phase = table.kitchenPhase;
  const override =
    table.status === "occupied" && PHASE_OVERRIDE[phase]
      ? PHASE_OVERRIDE[phase]
      : null;
  const baseStyle = override
    ? override.pill
    : STATUS_PILL[table.status] || STATUS_PILL.available;
  const dotStyle = override
    ? override.dot
    : STATUS_DOT[table.status] || STATUS_DOT.available;

  const phaseLabel = {
    new: "New order",
    preparing: "Preparing",
    ready: "Ready to serve",
    served: "Awaiting payment",
  }[phase];

  return (
    <button
      type="button"
      onClick={() => onSelect(table)}
      title={`Table ${table.tableNumber}${
        table.label ? ` — ${table.label}` : ""
      } (${table.status}${phaseLabel ? ` • ${phaseLabel}` : ""})`}
      className={`
        relative inline-flex items-center gap-1.5 shrink-0
        px-3 h-9 rounded-xl border text-[12px] font-semibold
        transition-all duration-150 whitespace-nowrap
        active:scale-[0.97]
        ${baseStyle}
        ${
          isSelected
            ? "border-[var(--p-blue)] border-2 shadow-[0_0_0_3px_rgba(242,144,16,0.22)] shadow-sm"
            : isActive
            ? "border-2 border-[var(--p-blue)] shadow-[0_0_0_3px_rgba(242,144,16,0.30)]"
            : "hover:shadow-sm"
        }
      `}
    >
      <span className={`h-2 w-2 rounded-full ${dotStyle}`} />
      <span className="tabular-nums">{table.tableNumber}</span>
      {table.status === "occupied" && (
        <span className="text-[10px] font-bold text-amber-700 tabular-nums bg-white/60 px-1 rounded">
          {table.currentOrder?.items?.length || 0}
        </span>
      )}
      {override && (
        <span
          className={`text-[9px] font-black tracking-wide ${override.badgeCls}`}
        >
          {override.badge}
        </span>
      )}
      {isSelected && (
        <CheckCircle2 size={12} className="text-[var(--p-blue)]" />
      )}
    </button>
  );
};

// Resolve the business-specific logo (never falls back to the system logo).
// Keeping this centralized ensures POS header / receipts / kitchen slip always
// show the tenant's own branding.
const TableBar = ({
  business,
  // NOTE: `logo` (system logo) is intentionally ignored here. POS must show the
  // business-specific logo only. Kept in props for backward compatibility.
  // eslint-disable-next-line no-unused-vars
  logo,
  tables = [],
  floors = [],
  loading,
  selectedTableId,
  orderHasItems = false,
  isWalkin,
  onSelectTable,
  onWalkin,
  onRefresh,
  onOpenAllTables,
  onSwitchBusiness,
  onExit,
  onReleaseTable,
  orderNumber,
  notificationNode,
  shiftNode,
  onOpenDayClosing,
}) => {
  const businessLogo = resolveBusinessLogoUrl(business);
  const [activeFloor, setActiveFloor] = useState("All");
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const menuRef = useRef(null);
  const stripRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  const floorList = useMemo(() => {
    const safe = Array.isArray(floors) && floors.length ? floors : ["All"];
    return safe;
  }, [floors]);

  const filtered = useMemo(() => {
    let list = tables;
    if (activeFloor !== "All") {
      list = list.filter((t) => t.floor === activeFloor);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) =>
          String(t.tableNumber).toLowerCase().includes(q) ||
          (t.label || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [tables, activeFloor, search]);

  const counts = useMemo(() => {
    const c = { total: tables.length, available: 0, occupied: 0, reserved: 0 };
    tables.forEach((t) => {
      if (c[t.status] !== undefined) c[t.status] += 1;
    });
    return c;
  }, [tables]);

  const scroll = (dir) => {
    const el = stripRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 220, behavior: "smooth" });
  };

  return (
    <div className="flex bg-white border-b border-gray-200 shrink-0">
      {/* Left: full-height branding */}
      <div className="w-[300px] max-w-[42vw] px-4 py-3 border-r border-gray-100 flex items-center gap-3 shrink-0">
        <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden shrink-0">
          {businessLogo ? (
            <img
              src={businessLogo}
              alt={`${business?.name || "Business"} logo`}
              className="h-full w-full object-contain p-1"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <Building2 size={22} className="text-gray-400" />
          )}
        </div>
        <div className="flex flex-col justify-center min-w-0">
          <span className="text-lg font-extrabold text-gray-900 leading-tight truncate">
            {business?.name || "POS Terminal"}
          </span>
          <span className="text-[11px] text-gray-500 leading-tight inline-flex items-center gap-1.5 mt-0.5">
            {isWalkin ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold">
                <UserPlus size={10} /> Walk-in
              </span>
            ) : selectedTableId && orderHasItems ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold">
                <CheckCircle2 size={10} /> Table selected
              </span>
            ) : selectedTableId ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-semibold">
                <LayoutGrid size={10} /> Add items to start
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-gray-400 font-medium">
                <LayoutGrid size={10} /> {counts.total} tables available
              </span>
            )}
            {orderNumber ? (
              <span className="text-gray-400 truncate">· {orderNumber}</span>
            ) : null}
          </span>
        </div>
      </div>

      {/* Right: filters + actions + table slider */}
      <div className="flex-1 min-w-0 flex flex-col px-3 py-2">
        {/* Top row: filters on left, actions on right */}
        <div className="flex items-center justify-between gap-2 pb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            {floorList.length > 1 && (
              <div className="flex items-center gap-1 shrink-0 overflow-x-auto max-w-[45vw] scrollbar-hide bg-gray-100 rounded-full p-0.5">
                {floorList.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setActiveFloor(f)}
                    className={`
                      px-3.5 h-8 text-[11.5px] font-semibold rounded-full whitespace-nowrap transition-all duration-150 active:scale-[0.97]
                      ${
                        activeFloor === f
                          ? "bg-[var(--p-blue)] text-white shadow-sm"
                          : "text-gray-600 hover:text-gray-800"
                      }
                    `}
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}
            <div className="relative w-[220px] shrink-0">
              <Search
                size={13}
                className="absolute left-1 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search table"
                className="w-full h-9 pl-9 pr-3 text-[12px] bg-gray-50 outline-none border-2 border-gray-200 rounded-full focus:border-[var(--p-blue)] focus:bg-white transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {shiftNode}

            <button
              type="button"
              onClick={onWalkin}
              className={`
                inline-flex items-center gap-1.5 h-9 px-3 text-xs font-semibold rounded-lg border transition-all duration-150 active:scale-[0.97]
                ${
                  isWalkin
                    ? "bg-[var(--p-blue)] text-white border-[var(--p-blue)] shadow-sm"
                    : "bg-white text-[var(--p-blue)] border-[var(--p-blue)]/30 hover:bg-[var(--p-blue)]/5 hover:border-[var(--p-blue)]/50"
                }
              `}
              title="Walk-in (F2)"
            >
              <UserPlus size={13} />
              <span className="hidden sm:inline">Walk-in</span>
            </button>

            <button
              type="button"
              onClick={onOpenAllTables}
              className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 rounded-lg transition-all duration-150 active:scale-[0.97]"
              title="View all tables"
            >
              <LayoutGrid size={13} />
              <span className="hidden sm:inline">All Tables</span>
              <ChevronDown size={12} className="opacity-60" />
            </button>

            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="h-9 w-9 inline-flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh tables"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>

            {notificationNode}

            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="h-9 w-9 inline-flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="More actions"
              >
                <MoreVertical size={15} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl border border-gray-200 shadow-xl py-1 z-30">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onSwitchBusiness?.();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Repeat size={13} className="text-gray-500" />
                    Switch Business
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenDayClosing?.();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <CalendarCheck size={13} className="text-gray-500" />
                    Day Closing
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onReleaseTable?.();
                    }}
                    disabled={!selectedTableId || isWalkin}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Trash2 size={13} className="text-gray-500" />
                    Clear Table
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onExit?.();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <LogOut size={13} className="text-gray-500" />
                    Exit POS
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom row: table slider */}
        <div className="flex items-center gap-2">
        {/* Scroll controls */}
        <button
          type="button"
          onClick={() => scroll(-1)}
          className="h-7 w-7 inline-flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-lg shrink-0"
        >
          <ChevronLeft size={14} />
        </button>

        {/* Scrollable strip */}
        <div
          ref={stripRef}
          className="flex-1 flex items-center gap-1.5 overflow-x-auto scrollbar-hide min-w-0 py-1 px-0.5"
        >
          {loading && filtered.length === 0 ? (
            <span className="inline-flex items-center gap-2 text-[11px] text-gray-400 px-2">
              <span className="w-3.5 h-3.5 border-2 border-gray-200 border-t-[var(--p-blue)] rounded-full animate-spin" />
              Loading tables…
            </span>
          ) : filtered.length === 0 ? (
            <span className="text-[11px] text-gray-400 px-2">
              No tables in this view
            </span>
          ) : (
            filtered.map((t) => (
              <TablePill
                key={t._id}
                table={t}
                isSelected={selectedTableId === t._id && orderHasItems}
                isActive={selectedTableId === t._id}
                onSelect={onSelectTable}
              />
            ))
          )}
        </div>

        <button
          type="button"
          onClick={() => scroll(1)}
          className="h-7 w-7 inline-flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-lg shrink-0"
        >
          <ChevronRight size={14} />
        </button>

        {/* Summary badges */}
        <div className="hidden lg:flex items-center gap-1.5 pl-1 shrink-0 text-[10px] text-gray-500">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-gray-400" />
            {counts.available}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            {counts.occupied}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            {counts.reserved}
          </span>
          <span className="inline-flex items-center gap-1 text-gray-700 font-semibold">
            <Users size={10} />
            {counts.total}
          </span>
        </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(TableBar);
