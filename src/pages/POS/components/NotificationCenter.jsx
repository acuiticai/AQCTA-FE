import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Bell, X, CheckCheck, Trash2, Search } from "lucide-react";

const formatTs = (iso) => {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const SOURCE_COLORS = {
  QR: "bg-amber-100 text-amber-700",
  POS: "bg-blue-100 text-blue-700",
  Mixed: "bg-violet-100 text-violet-700",
};

const STATUS_COLORS = {
  Preparing: "bg-amber-100 text-amber-800",
  Ready: "bg-emerald-100 text-emerald-800",
  Served: "bg-blue-100 text-blue-800",
  Cancelled: "bg-gray-200 text-gray-600",
  New: "bg-gray-100 text-gray-700",
  Completed: "bg-emerald-100 text-emerald-800",
  Voided: "bg-red-100 text-red-700",
};

const NotificationCenter = ({ notifications, unreadCount, onMarkAllRead, onClear }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dropdownStyle, setDropdownStyle] = useState({});
  const btnRef = useRef(null);
  const panelRef = useRef(null);
  const searchRef = useRef(null);

  const positionPanel = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const panelWidth = 340;
    let left = rect.right - panelWidth;
    if (left < 8) left = 8;
    setDropdownStyle({
      position: "fixed",
      top: rect.bottom + 8,
      left,
      width: panelWidth,
      zIndex: 9999,
    });
  }, []);

  const handleOpen = () => {
    if (!open) {
      positionPanel();
      if (unreadCount > 0) onMarkAllRead?.();
    }
    setOpen((v) => !v);
  };

  // Focus search when opened
  useEffect(() => {
    if (open && searchRef.current) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
    if (!open) setSearch("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target) &&
        panelRef.current && !panelRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = () => positionPanel();
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [open, positionPanel]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notifications;
    return notifications.filter((n) =>
      (n.label || "").toLowerCase().includes(q) ||
      (n.orderNumber || "").toLowerCase().includes(q) ||
      (n.ticketNumber || "").toLowerCase().includes(q) ||
      (n.sectionName || "").toLowerCase().includes(q) ||
      (n.source || "").toLowerCase().includes(q)
    );
  }, [notifications, search]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        className="relative h-9 w-9 inline-flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        title="Notifications"
      >
        <Bell size={15} />
        {unreadCount > 0 && (
          <>
            <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-red-500 animate-ping opacity-60" />
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[9.5px] font-bold rounded-full flex items-center justify-center leading-none ring-2 ring-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          </>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          style={dropdownStyle}
          className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50 shrink-0">
            <div className="flex items-center gap-2">
              <Bell size={13} className="text-gray-500" />
              <span className="text-xs font-bold text-gray-800">Notifications</span>
              {notifications.length > 0 && (
                <span className="text-[9px] font-semibold bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">
                  {notifications.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={onClear}
                  className="inline-flex items-center gap-1 text-[10px] text-gray-400 hover:text-red-500 px-2 py-1 rounded-md hover:bg-red-50 transition-colors"
                  title="Clear all"
                >
                  <Trash2 size={10} />
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-6 h-6 inline-flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="px-3 py-2 border-b border-gray-100 shrink-0">
            <div className="relative">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search order, ticket, source…"
                className="w-full pl-7 pr-3 h-7 text-[11px] bg-gray-50 outline-none border-2 border-gray-200 rounded-lg focus:border-[var(--p-blue)] focus:bg-white transition-all placeholder:text-gray-300"
              />
            </div>
          </div>

          {/* Notification list */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center gap-2.5">
                <div className="h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center ring-1 ring-emerald-100">
                  <CheckCheck size={20} className="text-emerald-500" />
                </div>
                <p className="text-xs font-semibold text-gray-700">
                  {search ? "No matching notifications" : "All caught up"}
                </p>
                {!search && (
                  <p className="text-[10.5px] text-gray-400 -mt-1.5">You'll see new events here</p>
                )}
              </div>
            ) : (
              filtered.map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-2.5 px-3 py-2.5 transition-colors ${
                    !n.read ? "bg-blue-50/40" : "bg-white hover:bg-gray-50"
                  }`}
                >
                  {/* Icon */}
                  <span className="text-[13px] shrink-0 mt-0.5 w-5 text-center">{n.icon}</span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-gray-800 leading-snug">
                      {n.label}
                    </p>

                    {/* Badges row */}
                    <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                      {n.orderNumber && (
                        <span className="text-[9px] font-mono font-bold text-gray-500">
                          {n.orderNumber}
                        </span>
                      )}
                      {n.ticketNumber && (
                        <span className="text-[9px] font-mono text-gray-400">
                          [{n.ticketNumber}]
                        </span>
                      )}
                      {n.source && (
                        <span className={`text-[8px] font-bold uppercase px-1 py-0.5 rounded ${SOURCE_COLORS[n.source] || "bg-gray-100 text-gray-600"}`}>
                          {n.source}
                        </span>
                      )}
                      {n.nextStatus && (
                        <span className={`text-[8px] font-bold uppercase px-1 py-0.5 rounded ${STATUS_COLORS[n.nextStatus] || "bg-gray-100 text-gray-600"}`}>
                          {n.nextStatus}
                        </span>
                      )}
                      {n.sectionName && (
                        <span className="text-[9px] text-gray-400 truncate">
                          {n.sectionName}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Time */}
                  <span className="text-[10px] text-gray-400 shrink-0 mt-0.5 whitespace-nowrap">
                    {formatTs(n.ts)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default NotificationCenter;
