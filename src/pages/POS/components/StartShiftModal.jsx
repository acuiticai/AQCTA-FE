import React, { useEffect, useState } from "react";
import { X, Clock, Wallet, PlayCircle } from "lucide-react";

const StartShiftModal = ({
  isOpen,
  shiftDefinitions = [],
  loading = false,
  onConfirm, // ({ shiftId, openingCash }) => void
  onClose,
}) => {
  const [shiftId, setShiftId] = useState("");
  const [openingCash, setOpeningCash] = useState("");

  useEffect(() => {
    if (isOpen) {
      setShiftId(shiftDefinitions[0]?._id || "");
      setOpeningCash("");
    }
  }, [isOpen, shiftDefinitions]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!shiftId) return;
    onConfirm?.({
      shiftId,
      openingCash: openingCash === "" ? undefined : parseFloat(openingCash) || 0,
    });
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-sm mx-4 bg-white rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-base font-bold text-gray-900 tracking-tight">
                Start Shift
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Pick a shift and confirm your opening cash float
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
        <div className="px-5 py-5 space-y-4">
          <div>
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
              Shift
            </label>
            {shiftDefinitions.length === 0 ? (
              <p className="mt-1.5 text-xs text-gray-400">
                No shifts configured. Add shifts in HR → Shift Settings.
              </p>
            ) : (
              <div className="mt-1.5 space-y-1.5">
                {shiftDefinitions.map((s) => (
                  <button
                    key={s._id}
                    type="button"
                    onClick={() => setShiftId(s._id)}
                    className={`
                      w-full flex items-center justify-between gap-2 px-3 h-11 rounded-xl border-2 text-left transition-colors
                      ${
                        shiftId === s._id
                          ? "border-[var(--p-blue)] bg-[var(--p-blue)]/5"
                          : "border-gray-100 hover:border-gray-200"
                      }
                    `}
                  >
                    <span className="text-sm font-semibold text-gray-800">{s.name}</span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
                      <Clock size={11} />
                      {s.startTime} – {s.endTime}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
              Opening Cash (RM)
            </label>
            <div className="mt-1.5 flex items-center gap-2 px-3 h-11 rounded-xl border-2 border-gray-100 bg-gray-50 focus-within:border-[var(--p-blue)]/40">
              <Wallet size={14} className="text-gray-400 shrink-0" />
              <input
                type="number"
                min="0"
                step="0.01"
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
                placeholder="Auto (from last shift's closing cash)"
                className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none"
              />
            </div>
            <p className="mt-1 text-[10px] text-gray-400">
              Leave blank to carry over the previous shift's closing cash automatically.
            </p>
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
            disabled={!shiftId || loading}
            className="flex-1 h-12 inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--p-blue)] text-white text-[13px] font-bold hover:opacity-90 transition-opacity active:scale-[0.98] disabled:opacity-50"
          >
            <PlayCircle size={16} />
            {loading ? "Starting…" : "Start Shift"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StartShiftModal;
