import React, { useMemo } from "react";
import {
  X,
  Clock,
  Utensils,
  ChefHat,
  CheckCircle2,
  StickyNote,
  Store,
  User,
  AlertTriangle,
  Ban,
  ArrowRight,
  History,
  Printer,
  Download,
} from "lucide-react";

const STATUS_META = {
  new: {
    label: "New",
    tag: "bg-gray-100 text-gray-700",
    dot: "bg-gray-400",
    icon: Utensils,
  },
  preparing: {
    label: "Preparing",
    tag: "bg-amber-100 text-amber-800",
    dot: "bg-amber-500",
    icon: ChefHat,
  },
  ready: {
    label: "Ready to serve",
    tag: "bg-emerald-100 text-emerald-800",
    dot: "bg-emerald-500",
    icon: CheckCircle2,
  },
  served: {
    label: "Served",
    tag: "bg-indigo-100 text-indigo-800",
    dot: "bg-indigo-500",
    icon: Clock,
  },
  cancelled: {
    label: "Cancelled",
    tag: "bg-red-100 text-red-700",
    dot: "bg-red-500",
    icon: Ban,
  },
};

const NEXT_STATUS = {
  new: { next: "preparing", label: "Start Prep" },
  preparing: { next: "ready", label: "Mark Ready" },
  ready: { next: "served", label: "Mark Served" },
};

const fmtTime = (iso) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return String(iso);
  }
};

const fmtDuration = (msVal) => {
  const ms = Math.max(0, Number(msVal || 0));
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}m ${sec}s`;
};

const KitchenTicketDetailModal = ({
  isOpen,
  ticket,
  onClose,
  onAdvance,
  onCancel,
  onTogglePriority,
  onPrint,
  onDownload,
}) => {
  const durations = useMemo(() => {
    if (!ticket) return null;
    const now = Date.now();
    const created = ticket.createdAt ? new Date(ticket.createdAt).getTime() : null;
    const started = ticket.startedAt ? new Date(ticket.startedAt).getTime() : null;
    const readyAt = ticket.readyAt ? new Date(ticket.readyAt).getTime() : null;
    const servedAt = ticket.servedAt ? new Date(ticket.servedAt).getTime() : null;

    return {
      waitBeforeStart:
        started && created ? started - created : null,
      prepTime: readyAt && started ? readyAt - started : null,
      readyTime: servedAt && readyAt ? servedAt - readyAt : null,
      totalOpen:
        (servedAt || now) - (created || now),
    };
  }, [ticket]);

  if (!isOpen || !ticket) return null;

  const meta = STATUS_META[ticket.status] || STATUS_META.new;
  const StatusIcon = meta.icon;
  const next = NEXT_STATUS[ticket.status];
  const isTerminal = ["served", "cancelled"].includes(ticket.status);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-2xl mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center text-white shadow-md shrink-0"
              style={{ background: ticket.sectionColor || "#6366f1" }}
            >
              <StatusIcon size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-gray-900">
                  {ticket.ticketNumber || ticket.orderNumber || "Ticket"}
                </h3>
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded ${meta.tag}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                  {meta.label}
                </span>
                {ticket.priority === "urgent" && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded bg-red-100 text-red-700">
                    <AlertTriangle size={10} />
                    Urgent
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                {ticket.sectionName || "Kitchen"} · Order{" "}
                {ticket.orderNumber || "—"}
                {ticket.source ? ` · ${ticket.source.toUpperCase()}` : ""}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Meta grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
              <div className="text-[10px] uppercase text-gray-400 font-semibold tracking-wider">
                Table
              </div>
              <div className="text-sm font-bold text-gray-900 mt-1 truncate flex items-center gap-1">
                <Store size={12} className="text-gray-400" />
                {ticket.tableNumber
                  ? `T-${ticket.tableNumber}`
                  : "Walk-in"}
              </div>
              {ticket.tableLabel && (
                <div className="text-[10px] text-gray-500 truncate">
                  {ticket.tableLabel}
                </div>
              )}
            </div>

            <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
              <div className="text-[10px] uppercase text-gray-400 font-semibold tracking-wider">
                Customer
              </div>
              <div className="text-sm font-bold text-gray-900 mt-1 truncate flex items-center gap-1">
                <User size={12} className="text-gray-400" />
                {ticket.customerName || "—"}
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
              <div className="text-[10px] uppercase text-gray-400 font-semibold tracking-wider">
                Opened
              </div>
              <div className="text-sm font-bold text-gray-900 mt-1">
                {fmtTime(ticket.createdAt)}
              </div>
              <div className="text-[10px] text-gray-500">
                Total {fmtDuration(durations?.totalOpen)}
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
              <div className="text-[10px] uppercase text-gray-400 font-semibold tracking-wider">
                Floor
              </div>
              <div className="text-sm font-bold text-gray-900 mt-1 truncate">
                {ticket.floor || "—"}
              </div>
            </div>
          </div>

          {/* Order-level note */}
          {ticket.orderNote && (
            <div className="p-3 rounded-lg bg-yellow-50 border border-yellow-200 flex items-start gap-2">
              <StickyNote size={14} className="text-yellow-600 shrink-0 mt-0.5" />
              <div>
                <div className="text-[10px] uppercase text-yellow-700 font-bold tracking-wider">
                  Order Note
                </div>
                <div className="text-xs text-yellow-900 mt-0.5 whitespace-pre-wrap">
                  {ticket.orderNote}
                </div>
              </div>
            </div>
          )}

          {/* Items */}
          <div>
            <h4 className="text-[11px] uppercase tracking-wider text-gray-400 font-bold mb-2 flex items-center gap-1">
              <Utensils size={11} />
              Items ({ticket.items?.length || 0})
            </h4>
            <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
              {(ticket.items || []).map((item, idx) => (
                <div
                  key={item._id || idx}
                  className="flex items-start justify-between gap-3 p-3 bg-white hover:bg-gray-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-1.5 rounded-md bg-gray-900 text-white text-[11px] font-bold">
                        x{item.quantity}
                      </span>
                      <span className="text-sm font-semibold text-gray-900 truncate">
                        {item.name}
                      </span>
                    </div>
                    {item.note && (
                      <div className="mt-1 ml-10 pl-2 text-[11px] text-gray-600 italic border-l-2 border-gray-300 whitespace-pre-wrap">
                        {item.note}
                      </div>
                    )}
                  </div>
                  <span
                    className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0 ${
                      STATUS_META[item.status]?.tag || "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {item.status || "pending"}
                  </span>
                </div>
              ))}
              {(!ticket.items || ticket.items.length === 0) && (
                <div className="p-4 text-center text-xs text-gray-400">
                  No items on this ticket
                </div>
              )}
            </div>
          </div>

          {/* Timings */}
          <div>
            <h4 className="text-[11px] uppercase tracking-wider text-gray-400 font-bold mb-2 flex items-center gap-1">
              <Clock size={11} />
              Timings
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                <div className="text-[10px] text-gray-400 uppercase font-semibold">
                  Started
                </div>
                <div className="font-bold text-gray-800 mt-0.5">
                  {fmtTime(ticket.startedAt)}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                <div className="text-[10px] text-gray-400 uppercase font-semibold">
                  Ready
                </div>
                <div className="font-bold text-gray-800 mt-0.5">
                  {fmtTime(ticket.readyAt)}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                <div className="text-[10px] text-gray-400 uppercase font-semibold">
                  Served
                </div>
                <div className="font-bold text-gray-800 mt-0.5">
                  {fmtTime(ticket.servedAt)}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-100">
                <div className="text-[10px] text-emerald-700 uppercase font-semibold">
                  Prep time
                </div>
                <div className="font-bold text-emerald-900 mt-0.5">
                  {fmtDuration(durations?.prepTime)}
                </div>
              </div>
            </div>
          </div>

          {/* Status history */}
          {Array.isArray(ticket.statusHistory) && ticket.statusHistory.length > 0 && (
            <div>
              <h4 className="text-[11px] uppercase tracking-wider text-gray-400 font-bold mb-2 flex items-center gap-1">
                <History size={11} />
                Status History
              </h4>
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                {ticket.statusHistory.map((h, i) => {
                  const m = STATUS_META[h.status] || STATUS_META.new;
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-3 px-3 py-2 border-b border-gray-100 last:border-0 bg-white"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${m.tag}`}
                        >
                          {m.label}
                        </span>
                        {h.note && (
                          <span className="text-[11px] text-gray-600 italic">
                            {h.note}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-400 shrink-0">
                        {fmtTime(h.at)}{" "}
                        {h.bySource ? `· ${h.bySource}` : ""}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50/60">
          <div className="flex items-center gap-2">
            {onPrint && (
              <button
                type="button"
                onClick={() => onPrint(ticket)}
                className="inline-flex items-center gap-1 h-9 px-3 rounded-lg text-xs font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <Printer size={12} />
                Print
              </button>
            )}
            {onDownload && (
              <button
                type="button"
                onClick={() => onDownload(ticket)}
                className="inline-flex items-center gap-1 h-9 px-3 rounded-lg text-xs font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <Download size={12} />
                Download
              </button>
            )}
            {!isTerminal && onTogglePriority && (
              <button
                type="button"
                onClick={() => onTogglePriority(ticket)}
                className={`inline-flex items-center gap-1 h-9 px-3 rounded-lg text-xs font-semibold transition-colors ${
                  ticket.priority === "urgent"
                    ? "bg-red-100 text-red-700 hover:bg-red-200"
                    : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
                }`}
              >
                <AlertTriangle size={12} />
                {ticket.priority === "urgent" ? "Remove urgent" : "Mark urgent"}
              </button>
            )}
            {!isTerminal && onCancel && (
              <button
                type="button"
                onClick={() => onCancel(ticket)}
                className="inline-flex items-center gap-1 h-9 px-3 rounded-lg text-xs font-semibold text-red-700 bg-white border border-red-200 hover:bg-red-50 transition-colors"
              >
                <Ban size={12} />
                Cancel
              </button>
            )}
          </div>

          {next && onAdvance && (
            <button
              type="button"
              onClick={() => onAdvance(ticket, next.next)}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-95 shadow-sm transition-all"
            >
              {next.label}
              <ArrowRight size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default KitchenTicketDetailModal;
