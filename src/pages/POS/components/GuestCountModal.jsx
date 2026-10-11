import React, { useEffect, useState } from "react";
import { X, Users, Minus, Plus } from "lucide-react";

const GuestCountModal = ({
  isOpen,
  tableNumber,
  defaultCount = 1,
  title,
  subtitle,
  confirmLabel = "Start Order",
  onConfirm, // ({ guestCount }) => void
  onClose,
}) => {
  const [count, setCount] = useState(defaultCount || 1);

  useEffect(() => {
    if (isOpen) {
      setCount(defaultCount || 1);
    }
  }, [isOpen, defaultCount]);

  if (!isOpen) return null;

  const adjust = (delta) => {
    setCount((c) => Math.max(1, Math.min(99, c + delta)));
  };

  const handleCountChange = (e) => {
    const raw = e.target.value;
    if (raw === "") {
      setCount("");
      return;
    }
    const next = parseInt(raw, 10);
    if (Number.isNaN(next)) return;
    setCount(Math.max(1, Math.min(99, next)));
  };

  const handleCountBlur = () => {
    if (count === "" || count < 1) setCount(1);
  };

  const handleConfirm = () => {
    const guestCount = count === "" || count < 1 ? 1 : count;
    onConfirm?.({ guestCount });
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-sm mx-4 bg-white rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-base font-bold text-gray-900 tracking-tight">
                {title || `Table ${tableNumber} — New Order`}
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {subtitle || "How many guests are seated?"}
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
        <div className="px-5 py-5">
          {/* Guest count stepper */}
          <div className="flex items-center justify-center gap-5">
            <button
              type="button"
              onClick={() => adjust(-1)}
              disabled={count <= 1}
              className="h-12 w-12 inline-flex items-center justify-center rounded-2xl border-2 border-gray-200 text-gray-600 hover:border-[var(--p-blue)] hover:text-[var(--p-blue)] disabled:opacity-30 disabled:hover:border-gray-200 disabled:hover:text-gray-600 transition-colors active:scale-95"
            >
              <Minus size={18} />
            </button>

            <div className="flex flex-col items-center min-w-[90px]">
              <div className="flex items-center gap-2 text-3xl font-black text-gray-900 tabular-nums">
                <Users size={22} className="text-[var(--p-blue)] shrink-0" />
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={99}
                  value={count}
                  onChange={handleCountChange}
                  onBlur={handleCountBlur}
                  onFocus={(e) => e.target.select()}
                  className="w-[1.6em] bg-transparent text-center outline-none focus:bg-[var(--p-blue)]/5 rounded-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <span className="text-[11px] text-gray-400 mt-1">
                {count === 1 ? "guest" : "guests"}
              </span>
            </div>

            <button
              type="button"
              onClick={() => adjust(1)}
              disabled={count >= 99}
              className="h-12 w-12 inline-flex items-center justify-center rounded-2xl border-2 border-gray-200 text-gray-600 hover:border-[var(--p-blue)] hover:text-[var(--p-blue)] disabled:opacity-30 transition-colors active:scale-95"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-1 flex items-center gap-2.5">
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
            className="flex-1 h-12 rounded-2xl bg-[var(--p-blue)] text-white text-[13px] font-bold hover:opacity-90 transition-opacity active:scale-[0.98]"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GuestCountModal;
