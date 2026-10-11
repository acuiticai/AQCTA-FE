import React, { useEffect, useState } from "react";
import { X, Wallet, StopCircle, Users, Receipt, TrendingUp } from "lucide-react";

const fmt = (n) => `RM ${(Number(n) || 0).toFixed(2)}`;

const StatCard = ({ label, value, icon: Icon }) => (
  <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
      {Icon && <Icon size={11} />}
      {label}
    </div>
    <div className="mt-1 text-sm font-bold text-gray-900 tabular-nums">{value}</div>
  </div>
);

const EndShiftModal = ({
  isOpen,
  shiftSession,
  preview, // { salesSummary, expectedCashOnHand } | null
  previewLoading = false,
  loading = false,
  onConfirm, // ({ declaredCashOnHand, notes }) => void
  onClose,
}) => {
  const [declaredCash, setDeclaredCash] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (isOpen) {
      setDeclaredCash("");
      setNotes("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const summary = preview?.salesSummary || {};
  const expectedCashOnHand = preview?.expectedCashOnHand ?? 0;
  const declaredNum = declaredCash === "" ? null : parseFloat(declaredCash) || 0;
  const variance = declaredNum !== null ? declaredNum - expectedCashOnHand : null;

  const handleConfirm = () => {
    if (declaredCash === "") return;
    onConfirm?.({ declaredCashOnHand: parseFloat(declaredCash) || 0, notes });
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
                End Shift{shiftSession?.shiftSnapshot?.name ? ` — ${shiftSession.shiftSnapshot.name}` : ""}
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {shiftSession?.businessDate} · Shift {shiftSession?.shiftNo}
                {shiftSession?.shiftSnapshot?.startTime
                  ? ` · ${shiftSession.shiftSnapshot.startTime} – ${shiftSession.shiftSnapshot.endTime}`
                  : ""}
              </p>
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
          {previewLoading ? (
            <p className="text-xs text-gray-400 text-center py-6">Loading shift summary…</p>
          ) : (
            <>
              {/* Sales summary */}
              <div className="grid grid-cols-2 gap-2">
                <StatCard label="Net Sales" value={fmt(summary.netSales)} icon={TrendingUp} />
                <StatCard label="Orders" value={summary.completedOrders ?? 0} icon={Receipt} />
                <StatCard label="Guests Served" value={summary.totalGuests ?? 0} icon={Users} />
                <StatCard
                  label="Avg / Guest"
                  value={fmt(summary.averageSpendPerGuest)}
                  icon={Users}
                />
              </div>

              {/* Payment breakdown */}
              {(summary.byPaymentMethod || []).length > 0 && (
                <div className="rounded-xl border border-gray-100 px-3 py-2.5 space-y-1">
                  <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
                    Payment Breakdown
                  </div>
                  {summary.byPaymentMethod.map((p, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">
                        {p.method} ({p.count})
                      </span>
                      <span className="font-semibold text-gray-800 tabular-nums">{fmt(p.amount)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Cash reconciliation */}
              <div className="rounded-xl border border-gray-100 px-3 py-2.5 space-y-1.5">
                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
                  Cash Reconciliation
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Opening Cash</span>
                  <span className="font-semibold text-gray-800 tabular-nums">
                    {fmt(shiftSession?.openingCash)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Cash Sales</span>
                  <span className="font-semibold text-gray-800 tabular-nums">
                    {fmt(summary.cashSales)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-100">
                  <span className="text-gray-600 font-semibold">Expected Cash on Hand</span>
                  <span className="font-bold text-gray-900 tabular-nums">
                    {fmt(expectedCashOnHand)}
                  </span>
                </div>
              </div>

              {/* Declared cash input */}
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                  Counted Cash on Hand (RM)
                </label>
                <div className="mt-1.5 flex items-center gap-2 px-3 h-11 rounded-xl border-2 border-gray-100 bg-gray-50 focus-within:border-[var(--p-blue)]/40">
                  <Wallet size={14} className="text-gray-400 shrink-0" />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    autoFocus
                    value={declaredCash}
                    onChange={(e) => setDeclaredCash(e.target.value)}
                    placeholder="Enter counted cash"
                    className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none"
                  />
                </div>
                {variance !== null && (
                  <p
                    className={`mt-1.5 text-[11px] font-semibold ${
                      variance === 0
                        ? "text-emerald-600"
                        : variance > 0
                        ? "text-blue-600"
                        : "text-red-600"
                    }`}
                  >
                    {variance === 0
                      ? "Cash drawer balanced"
                      : variance > 0
                      ? `Over by ${fmt(variance)}`
                      : `Short by ${fmt(Math.abs(variance))}`}
                  </p>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Any handover notes for the next shift…"
                  className="mt-1.5 w-full px-3 py-2 rounded-xl border-2 border-gray-100 bg-gray-50 focus:border-[var(--p-blue)]/40 text-sm text-gray-900 placeholder:text-gray-400 outline-none resize-none"
                />
              </div>
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
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={declaredCash === "" || loading || previewLoading}
            className="flex-1 h-12 inline-flex items-center justify-center gap-2 rounded-2xl bg-red-500 text-white text-[13px] font-bold hover:opacity-90 transition-opacity active:scale-[0.98] disabled:opacity-50"
          >
            <StopCircle size={16} />
            {loading ? "Closing…" : "Close Shift"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EndShiftModal;
