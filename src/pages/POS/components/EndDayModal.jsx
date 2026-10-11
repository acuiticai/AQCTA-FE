import React, { useEffect, useState } from "react";
import { X, CalendarCheck, AlertTriangle, CheckCircle2, Users, TrendingUp } from "lucide-react";

const fmt = (n) => `RM ${(Number(n) || 0).toFixed(2)}`;

const STATUS_BADGE = {
  open: "bg-amber-50 text-amber-700 border-amber-200",
  closed: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const StatCard = ({ label, value, icon: Icon }) => (
  <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
      {Icon && <Icon size={11} />}
      {label}
    </div>
    <div className="mt-1 text-sm font-bold text-gray-900 tabular-nums">{value}</div>
  </div>
);

const EndDayModal = ({
  isOpen,
  dayStatus, // { businessDate, dailyClosing, shiftSessions, hasOpenShift, canCloseDay } | null
  statusLoading = false,
  loading = false,
  onConfirm, // ({ notes }) => void
  onClose,
}) => {
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (isOpen) setNotes("");
  }, [isOpen]);

  if (!isOpen) return null;

  const sessions = dayStatus?.shiftSessions || [];
  const dailyClosing = dayStatus?.dailyClosing;
  const isClosed = dailyClosing?.status === "closed";
  const summary = isClosed ? dailyClosing.salesSummary : null;
  const cash = isClosed ? dailyClosing.cashSummary : null;

  const handleConfirm = () => {
    onConfirm?.({ notes });
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md mx-4 bg-white rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-base font-bold text-gray-900 tracking-tight">
                Day Closing
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">{dayStatus?.businessDate}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 inline-flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-5 py-4 space-y-4 overflow-y-auto">
          {statusLoading ? (
            <p className="text-xs text-gray-400 text-center py-6">Loading day status…</p>
          ) : (
            <>
              {/* Shift list */}
              <div>
                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                  Shifts Today
                </div>
                {sessions.length === 0 ? (
                  <p className="text-xs text-gray-400">No shifts recorded yet today.</p>
                ) : (
                  <div className="space-y-1.5">
                    {sessions.map((s) => (
                      <div
                        key={s._id}
                        className="flex items-center justify-between gap-2 px-3 h-10 rounded-xl border border-gray-100"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-semibold text-gray-800 truncate">
                            Shift {s.shiftNo} · {s.shiftSnapshot?.name || ""}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-semibold text-gray-700 tabular-nums">
                            {fmt(s.salesSummary?.netSales)}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded-md border text-[10px] font-bold uppercase ${
                              STATUS_BADGE[s.status] || STATUS_BADGE.open
                            }`}
                          >
                            {s.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {dayStatus?.hasOpenShift && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <span>End the active shift before closing the day.</span>
                </div>
              )}

              {isClosed ? (
                <>
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                    <CheckCircle2 size={14} />
                    Day closed
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <StatCard label="Net Sales" value={fmt(summary?.netSales)} icon={TrendingUp} />
                    <StatCard label="Orders" value={summary?.completedOrders ?? 0} />
                    <StatCard label="Guests Served" value={summary?.totalGuests ?? 0} icon={Users} />
                    <StatCard label="Avg / Guest" value={fmt(summary?.averageSpendPerGuest)} icon={Users} />
                  </div>
                  <div className="rounded-xl border border-gray-100 px-3 py-2.5 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Total Cash Variance</span>
                      <span
                        className={`font-bold tabular-nums ${
                          (cash?.totalVariance || 0) === 0
                            ? "text-emerald-600"
                            : (cash?.totalVariance || 0) > 0
                            ? "text-blue-600"
                            : "text-red-600"
                        }`}
                      >
                        {fmt(cash?.totalVariance)}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {dayStatus?.canCloseDay && (
                    <div>
                      <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                        Notes (optional)
                      </label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={2}
                        placeholder="Any remarks for today's closing…"
                        className="mt-1.5 w-full px-3 py-2 rounded-xl border-2 border-gray-100 bg-gray-50 focus:border-[var(--p-blue)]/40 text-sm text-gray-900 placeholder:text-gray-400 outline-none resize-none"
                      />
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 flex items-center gap-2.5 border-t border-gray-100 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-12 px-4 rounded-2xl border-2 border-gray-200 text-[13px] font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
          >
            {isClosed || !dayStatus?.canCloseDay ? "Close" : "Cancel"}
          </button>
          {!isClosed && (
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!dayStatus?.canCloseDay || loading || statusLoading}
              className="flex-1 h-12 inline-flex items-center justify-center gap-2 rounded-2xl bg-gray-900 text-white text-[13px] font-bold hover:opacity-90 transition-opacity active:scale-[0.98] disabled:opacity-50"
            >
              <CalendarCheck size={16} />
              {loading ? "Closing Day…" : "Close Day"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default EndDayModal;
