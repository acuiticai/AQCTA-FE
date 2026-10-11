import React, { useMemo } from "react";
import {
  Clock,
  StickyNote,
  Flame,
  CheckCircle2,
  ChevronRight,
  X,
  AlertTriangle,
  Info,
  Printer,
  Download,
  GripVertical,
} from "lucide-react";

const STATUS_ACTIONS = {
  new: { next: "preparing", label: "Start Prep", icon: Flame, color: "amber" },
  preparing: { next: "ready", label: "Mark Ready", icon: CheckCircle2, color: "emerald" },
  ready: { next: "served", label: "Mark Served", icon: CheckCircle2, color: "blue" },
};

const STATUS_ACCENT = {
  new: "bg-slate-400",
  preparing: "bg-amber-500",
  ready: "bg-emerald-500",
  served: "bg-blue-500",
  cancelled: "bg-gray-300",
};

const ACTION_STYLES = {
  amber: "bg-amber-500 hover:bg-amber-600 text-white shadow-sm shadow-amber-500/30 active:scale-[0.97]",
  emerald: "bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm shadow-emerald-500/30 active:scale-[0.97]",
  blue: "bg-blue-500 hover:bg-blue-600 text-white shadow-sm shadow-blue-500/30 active:scale-[0.97]",
};

const KitchenTicketCard = ({
  ticket,
  onAdvance,
  onCancel,
  onTogglePriority,
  onViewDetails,
  onPrint,
  onDownload,
  now,
}) => {
  const action = STATUS_ACTIONS[ticket.status];
  const items = ticket.items || [];
  const totalQty = items.reduce((sum, i) => sum + (i.quantity || 0), 0);

  const elapsed = useMemo(() => {
    const base =
      ticket.status === "new"
        ? ticket.createdAt || ticket.firedAt
        : ticket.status === "preparing"
        ? ticket.startedAt || ticket.createdAt
        : ticket.status === "ready"
        ? ticket.readyAt || ticket.startedAt || ticket.createdAt
        : ticket.status === "served"
        ? ticket.servedAt
        : ticket.createdAt;
    if (!base) return null;
    const secs = Math.max(0, Math.floor((now - new Date(base).getTime()) / 1000));
    if (secs < 60) return `${secs}s`;
    const m = Math.floor(secs / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  }, [ticket, now]);

  const isOverdue =
    ticket.status !== "served" &&
    ticket.status !== "cancelled" &&
    (() => {
      const base = ticket.firedAt || ticket.createdAt;
      if (!base) return false;
      const mins = (Date.now() - new Date(base).getTime()) / 60000;
      return mins > 15;
    })();

  const isUrgent = ticket.priority === "urgent";

  const borderClass = isUrgent
    ? "border-red-300 ring-2 ring-red-200"
    : isOverdue
    ? "border-amber-300 ring-1 ring-amber-200"
    : "border-gray-200";

  // Elapsed badge color: red if overdue, amber if > 10 min, gray otherwise
  const elapsedMinutes = elapsed
    ? elapsed.includes("h")
      ? 9999
      : elapsed.includes("m")
      ? parseInt(elapsed)
      : 0
    : 0;
  const elapsedBadgeClass = isOverdue
    ? "bg-red-100 text-red-700"
    : elapsedMinutes >= 10
    ? "bg-amber-100 text-amber-700"
    : "bg-gray-100 text-gray-500";

  const handleCardClick = (e) => {
    if (!onViewDetails) return;
    if (e.target.closest("button")) return;
    onViewDetails(ticket);
  };

  return (
    <div
      onClick={handleCardClick}
      className={`group relative rounded-xl border ${borderClass} shadow-sm hover:shadow-md transition-all duration-150 overflow-hidden flex flex-col ${
        onViewDetails ? "cursor-pointer active:scale-[0.99]" : ""
      } ${isOverdue && !isUrgent ? "bg-amber-50/40" : "bg-white"}`}
    >
      {/* Status accent strip */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${STATUS_ACCENT[ticket.status] || "bg-gray-300"}`} />

      {/* Urgent pulsing banner */}
      {isUrgent && (
        <div className="relative ml-1 overflow-hidden bg-red-500 text-white text-[9px] font-black tracking-widest uppercase text-center py-0.5 leading-tight">
          <span className="relative z-10">⚡ URGENT ⚡</span>
          <div className="absolute inset-0 bg-red-300 animate-pulse opacity-40" />
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-2 px-3 pt-2.5 pb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 font-bold text-gray-900 leading-tight">
            <span className="text-[13px]">{ticket.tableNumber ? `T-${ticket.tableNumber}` : "Walk-in"}</span>
            {ticket.tableLabel && (
              <span className="text-[10px] font-normal text-gray-400 truncate">· {ticket.tableLabel}</span>
            )}
          </div>
          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
            <span className="font-mono font-semibold text-[10px] text-gray-500">
              {ticket.ticketNumber || ticket.orderNumber}
            </span>
            <span className={`px-1.5 py-px rounded text-[8px] font-bold uppercase tracking-wide ${
              ticket.source === "qr"
                ? "bg-amber-100 text-amber-700"
                : ticket.source === "mixed"
                ? "bg-violet-100 text-violet-700"
                : "bg-sky-100 text-sky-700"
            }`}>
              {ticket.source === "qr" ? "QR" : ticket.source === "mixed" ? "MIXED" : "POS"}
            </span>
            {ticket.sectionName && (
              <span className="text-[10px] text-gray-400 truncate">· {ticket.sectionName}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
          <span
            className="h-6 w-4 hidden lg:inline-flex items-center justify-center text-gray-400 cursor-grab active:cursor-grabbing"
            title="Drag to another lane"
          >
            <GripVertical size={11} />
          </span>
          {onPrint && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onPrint(ticket); }}
              title="Print ticket"
              className="h-6 w-6 inline-flex items-center justify-center rounded-md text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
            >
              <Printer size={11} />
            </button>
          )}
          {onDownload && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDownload(ticket); }}
              title="Download ticket"
              className="h-6 w-6 inline-flex items-center justify-center rounded-md text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
            >
              <Download size={11} />
            </button>
          )}
          {onViewDetails && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onViewDetails(ticket); }}
              title="View details"
              className="h-6 w-6 inline-flex items-center justify-center rounded-md text-gray-400 hover:text-[var(--p-blue)] hover:bg-[var(--p-blue)]/10 transition-colors"
            >
              <Info size={11} />
            </button>
          )}
          {onTogglePriority && ticket.status !== "served" && ticket.status !== "cancelled" && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onTogglePriority(ticket); }}
              title={isUrgent ? "Unmark urgent" : "Mark urgent"}
              className={`h-6 w-6 inline-flex items-center justify-center rounded-md border transition-colors ${
                isUrgent
                  ? "bg-red-500 text-white border-red-500"
                  : "text-gray-400 border-transparent hover:text-red-500 hover:bg-red-50"
              }`}
            >
              <AlertTriangle size={11} />
            </button>
          )}
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md ml-0.5 tabular-nums ${elapsedBadgeClass}`}>
            <Clock size={9} />
            {elapsed || "—"}
          </span>
        </div>
      </div>

      {/* Customer / order-level note */}
      {(ticket.customerName || ticket.orderNote) && (
        <div className="px-3 pb-2 text-[11px] space-y-0.5">
          {ticket.customerName && (
            <div className="truncate text-gray-500">
              <span className="text-gray-400">Guest:</span>{" "}
              <span className="font-semibold text-gray-600">{ticket.customerName}</span>
            </div>
          )}
          {ticket.orderNote && (
            <div className="flex items-start gap-1 p-1.5 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-900 text-[10.5px]">
              <StickyNote size={10} className="shrink-0 mt-0.5 text-yellow-600" />
              <span className="italic">{ticket.orderNote}</span>
            </div>
          )}
        </div>
      )}

      {/* Items */}
      <div className="px-3 pb-2 flex-1">
        <div className="rounded-lg bg-gray-50 border border-gray-100 overflow-hidden">
          {items.length === 0 ? (
            <div className="py-2 px-2 text-[11px] text-gray-400 italic">No items</div>
          ) : (
            items.map((it, idx) => (
              <div
                key={it._id || idx}
                className={`flex items-start gap-2 px-2.5 py-1.5 ${
                  idx !== items.length - 1 ? "border-b border-gray-100" : ""
                }`}
              >
                <span className="shrink-0 inline-flex items-center justify-center h-5 min-w-[24px] px-1 rounded bg-slate-800 text-white text-[10px] font-bold leading-none">
                  ×{it.quantity}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-gray-800 leading-tight">{it.name}</div>
                  {it.note && (
                    <div className="flex items-start gap-1 mt-0.5 text-[10.5px] text-indigo-800 bg-indigo-50 border-l-2 border-indigo-400 px-1.5 py-0.5 rounded-r-sm italic">
                      <StickyNote size={9} className="shrink-0 mt-0.5 text-indigo-500" />
                      <span className="break-words">{it.note}</span>
                    </div>
                  )}
                </div>
                {it.status && it.status !== "pending" && (
                  <span className={`shrink-0 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                    it.status === "ready" ? "bg-emerald-100 text-emerald-800"
                    : it.status === "served" ? "bg-blue-100 text-blue-800"
                    : it.status === "cancelled" ? "bg-gray-200 text-gray-500"
                    : "bg-amber-100 text-amber-800"
                  }`}>
                    {it.status}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex items-center gap-1.5 px-3 pb-3">
        {action ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onAdvance?.(ticket, action.next); }}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 h-9 px-3 text-[11px] font-bold uppercase tracking-wide rounded-lg transition-all ${ACTION_STYLES[action.color]}`}
          >
            <action.icon size={13} />
            {action.label}
            <ChevronRight size={11} />
          </button>
        ) : (
          <div className="flex-1 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wider py-1">
            {ticket.status === "served" ? "Completed" : "Cancelled"}
          </div>
        )}
        {onCancel && ticket.status !== "served" && ticket.status !== "cancelled" && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onCancel(ticket); }}
            title="Cancel ticket"
            className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-colors"
          >
            <X size={13} />
          </button>
        )}
        <span className="text-[10px] text-gray-400 tabular-nums shrink-0">
          {totalQty} {totalQty === 1 ? "item" : "items"}
        </span>
      </div>
    </div>
  );
};

export default React.memo(KitchenTicketCard);
