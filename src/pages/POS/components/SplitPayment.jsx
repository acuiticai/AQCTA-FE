import React, { useState, useMemo } from "react";
import { Plus, Trash2, CheckCircle2, SquareSplitHorizontal } from "lucide-react";

const SplitPayment = ({ total, methods = [], onConfirm }) => {
  const availableMethods = methods.length
    ? methods
    : [
        { _id: "default-cash", name: "Cash", code: "CASH", type: "Cash" },
        { _id: "default-online", name: "Card", code: "CARD", type: "Online" },
      ];

  const firstMethodId = availableMethods[0]?._id || "";
  const secondMethodId = availableMethods[1]?._id || firstMethodId;

  const [rows, setRows] = useState([
    { paymentMethodId: firstMethodId, amount: "", reference: "" },
    { paymentMethodId: secondMethodId, amount: "", reference: "" },
  ]);

  const allocated = useMemo(
    () => rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0),
    [rows]
  );

  const remaining = Math.round((total - allocated) * 100) / 100;
  const isValid = Math.abs(remaining) < 0.01 && rows.every((r) => Number(r.amount) > 0);

  const handleRowChange = (idx, field, value) => {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r))
    );
  };

  const addRow = () => {
    if (rows.length >= 5) return;
    setRows((prev) => [
      ...prev,
      { paymentMethodId: availableMethods[0]?._id || "", amount: "", reference: "" },
    ]);
  };

  const removeRow = (idx) => {
    if (rows.length <= 2) return;
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleFillRemaining = (idx) => {
    if (remaining <= 0) return;
    const otherTotal = rows.reduce(
      (sum, r, i) => (i === idx ? sum : sum + (Number(r.amount) || 0)),
      0
    );
    const fill = Math.round((total - otherTotal) * 100) / 100;
    handleRowChange(idx, "amount", String(fill));
  };

  const handleConfirm = () => {
    if (!isValid) return;

    const payments = rows.map((r) => {
      const method =
        availableMethods.find((m) => m._id === r.paymentMethodId) ||
        availableMethods[0];

      return {
        method: method?.code || method?.name || "other",
        paymentMethodId: method?._id,
        paymentMethodName: method?.name || "Other",
        paymentMethodType: method?.type || "Online",
        amount: Number(r.amount),
        reference: r.reference.trim() || undefined,
      };
    });

    const cashTotal = payments
      .filter((p) => p.paymentMethodType === "Cash")
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    onConfirm(payments, cashTotal);
  };

  const isCashMethod = (paymentMethodId) => {
    const method = availableMethods.find((m) => m._id === paymentMethodId);
    return method?.type === "Cash";
  };

  const allocatedPct = total > 0 ? Math.min(100, (allocated / total) * 100) : 0;

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      <div className="p-3 bg-gray-50 rounded-2xl">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Allocation</span>
          <span className="text-[11px] font-bold text-gray-700 tabular-nums">
            RM {allocated.toFixed(2)} / RM {total.toFixed(2)}
          </span>
        </div>
        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${isValid ? "bg-emerald-500" : "bg-[var(--p-blue)]"}`}
            style={{ width: `${allocatedPct}%` }}
          />
        </div>
      </div>

      {/* Payment rows */}
      {rows.map((row, idx) => (
        <div
          key={idx}
          className="p-3 bg-white rounded-2xl border border-gray-200 shadow-[0_1px_3px_rgba(15,23,42,0.06)] space-y-2"
        >
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold flex items-center justify-center shrink-0">
              {idx + 1}
            </span>
            <select
              value={row.paymentMethodId}
              onChange={(e) =>
                handleRowChange(idx, "paymentMethodId", e.target.value)
              }
              className="pos-ring-sm h-9 px-2.5 text-[12px] font-semibold bg-gray-50 rounded-xl border border-gray-200 focus:border-[var(--p-blue)] focus:outline-none cursor-pointer"
            >
              {availableMethods.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.name}
                </option>
              ))}
            </select>

            <div className="flex-1 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-gray-400 font-semibold pointer-events-none">
                RM
              </span>
              <input
                type="number"
                value={row.amount}
                onChange={(e) => handleRowChange(idx, "amount", e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="pos-ring w-full h-9 pl-9 pr-2.5 text-[13px] font-bold tabular-nums bg-gray-50 rounded-xl border border-gray-200 focus:border-[var(--p-blue)] focus:bg-white focus:outline-none transition-all"
              />
            </div>

            <button
              type="button"
              onClick={() => handleFillRemaining(idx)}
              disabled={remaining <= 0}
              className="h-9 px-2.5 text-[11px] font-bold text-[var(--p-blue)] bg-[var(--p-blue)]/10 rounded-xl hover:bg-[var(--p-blue)]/20 transition-colors whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
              title="Fill remaining amount"
            >
              Fill
            </button>

            {rows.length > 2 && (
              <button
                type="button"
                onClick={() => removeRow(idx)}
                className="w-8 h-8 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>

          {!isCashMethod(row.paymentMethodId) && (
            <input
              type="text"
              value={row.reference}
              onChange={(e) => handleRowChange(idx, "reference", e.target.value)}
              placeholder="Reference / Approval code (optional)"
              maxLength={50}
              className="pos-ring-sm w-full h-8 px-3 text-[11px] bg-gray-50 rounded-xl border border-gray-200 focus:border-[var(--p-blue)] focus:bg-white focus:outline-none transition-all placeholder:text-gray-300"
            />
          )}
        </div>
      ))}

      {/* Add row */}
      {rows.length < 5 && (
        <button
          type="button"
          onClick={addRow}
          className="w-full flex items-center justify-center gap-1.5 h-9 text-[12px] font-semibold text-gray-500 hover:text-[var(--p-blue)] border-2 border-dashed border-gray-200 rounded-2xl hover:border-[var(--p-blue)]/40 hover:bg-[var(--p-blue)]/[0.02] transition-all"
        >
          <Plus size={13} />
          Add Payment Method
        </button>
      )}

      {/* Remaining summary */}
      <div className={`p-3.5 rounded-2xl text-center border ${
        isValid
          ? "bg-emerald-50 border-emerald-200"
          : "bg-gray-50 border-gray-200"
      }`}>
        {isValid ? (
          <div className="flex items-center justify-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span className="text-sm font-bold text-emerald-700">Fully Allocated</span>
          </div>
        ) : (
          <>
            <p className="text-[10.5px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Remaining to Allocate
            </p>
            <p className="text-2xl font-black text-[var(--p-blue)] tabular-nums">
              RM {Math.max(0, remaining).toFixed(2)}
            </p>
          </>
        )}
      </div>

      {/* Confirm */}
      <button
        type="button"
        onClick={handleConfirm}
        disabled={!isValid}
        className={`
          w-full h-14 rounded-2xl text-sm font-bold inline-flex items-center justify-center gap-2 transition-all
          ${
            isValid
              ? "bg-purple-600 text-white hover:bg-purple-700 active:scale-[0.98] shadow-lg shadow-purple-500/25"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          }
        `}
      >
        <SquareSplitHorizontal size={17} />
        Confirm Split Payment
      </button>
    </div>
  );
};

export default React.memo(SplitPayment);
