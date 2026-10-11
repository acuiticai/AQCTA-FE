import React, { useState, useRef, useEffect } from "react";
import { Loader2, Check, ArrowRight } from "lucide-react";
import { getPaymentMethodIcon } from "../utils/paymentIcons";

const CardPayment = ({ total, methods = [], onConfirm, isProcessing = false }) => {
  const [reference, setReference]           = useState("");
  const [selectedMethodId, setSelectedMethodId] = useState("");
  const inputRef = useRef(null);

  const onlineMethods = methods.length
    ? methods
    : [{ _id: "default-online", name: "Card", code: "CARD", type: "Online" }];

  const selectedMethod =
    onlineMethods.find((m) => m._id === selectedMethodId) || onlineMethods[0];

  const confirmLabel =
    onlineMethods.length > 1 ? selectedMethod?.name || "Online" : "Online";

  useEffect(() => {
    inputRef.current?.focus();
    if (onlineMethods.length > 0) setSelectedMethodId(onlineMethods[0]._id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  const handleConfirm = () => {
    if (isProcessing) return;
    onConfirm(
      [{
        method:            selectedMethod?.code || selectedMethod?.name || "online",
        paymentMethodId:   selectedMethod?._id,
        paymentMethodName: selectedMethod?.name || "Online",
        paymentMethodType: selectedMethod?.type || "Online",
        amount:            total,
        reference:         reference.trim() || undefined,
      }],
      0
    );
  };

  return (
    <div className="space-y-3">

      {/* ── Method selector ── */}
      {onlineMethods.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
            Method
          </p>
          <div className="grid grid-cols-2 gap-2">
            {onlineMethods.map((m) => {
              const { Icon, classes } = getPaymentMethodIcon(m);
              const active = selectedMethodId === m._id;
              return (
                <button
                  key={m._id}
                  type="button"
                  onClick={() => setSelectedMethodId(m._id)}
                  disabled={isProcessing}
                  className={`inline-flex items-center gap-2 h-11 px-3 text-[12.5px] font-semibold
                    rounded-2xl border transition-all duration-150 active:scale-[0.97]
                    disabled:opacity-50 disabled:cursor-not-allowed
                    ${active
                      ? "bg-[var(--p-blue)]/10 text-[var(--p-blue)] border-[var(--p-blue)]/30 shadow-sm"
                      : "bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-100"
                    }`}
                >
                  <Icon size={14} className={active ? "text-[var(--p-blue)]" : "text-gray-400"} />
                  <span className="truncate flex-1 text-left">{m.name}</span>
                  {active && (
                    <Check size={12} strokeWidth={3} className="text-[var(--p-blue)] shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Reference field ── */}
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
          Reference / Approval Code{" "}
          <span className="normal-case font-normal text-gray-400">(optional)</span>
        </p>
        <input
          ref={inputRef}
          type="text"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
          placeholder="e.g. AUTH-1234"
          maxLength={50}
          className="
            w-full h-12 px-4 text-sm font-medium
            bg-gray-50 rounded-2xl border-2 border-gray-200
            focus:border-[var(--p-blue)] focus:bg-white focus:outline-none
            transition-all placeholder:text-gray-300
          "
        />
      </div>

      {/* ── Charge summary ── */}
      <div className="rounded-2xl bg-gray-50 border border-gray-200 px-4 py-3.5 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            Charge Amount
          </p>
          <p className="text-[26px] font-black text-gray-900 tabular-nums leading-none mt-1">
            <span className="text-[14px] font-bold text-gray-400 mr-0.5">RM</span>
            {total.toFixed(2)}
          </p>
        </div>
        <div className="h-10 w-10 rounded-2xl bg-[var(--p-blue)] flex items-center justify-center shadow-sm shadow-[var(--p-blue)]/25">
          {(() => {
            const { Icon } = getPaymentMethodIcon(selectedMethod);
            return <Icon size={18} className="text-white" />;
          })()}
        </div>
      </div>

      {/* ── Confirm CTA ── */}
      <button
        type="button"
        onClick={handleConfirm}
        disabled={isProcessing}
        className="
          w-full h-14 rounded-2xl text-[14px] font-bold
          inline-flex items-center justify-center gap-2.5
          bg-[var(--p-blue)] text-white hover:opacity-90
          shadow-lg shadow-[var(--p-blue)]/30
          active:scale-[0.98] transition-all duration-150
          disabled:opacity-60 disabled:cursor-not-allowed
        "
      >
        {isProcessing ? (
          <Loader2 size={17} className="animate-spin" />
        ) : (
          (() => {
            const { Icon } = getPaymentMethodIcon(selectedMethod);
            return <Icon size={17} />;
          })()
        )}
        <span>
          {isProcessing
            ? "Processing…"
            : `Confirm ${confirmLabel} Payment`}
        </span>
        {!isProcessing && <ArrowRight size={15} className="opacity-60" />}
      </button>
    </div>
  );
};

export default React.memo(CardPayment);
