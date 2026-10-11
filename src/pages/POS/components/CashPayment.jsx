import React, { useState, useRef, useEffect, useMemo } from "react";
import { Loader2, Check, ArrowRight } from "lucide-react";
import { getPaymentMethodIcon } from "../utils/paymentIcons";

const buildQuickAmounts = (total) => {
  const t = Math.max(0, Number(total) || 0);
  if (t <= 0) return [];
  const set = new Set();
  set.add(Number(t.toFixed(2)));
  const ceilTo = (n) => Math.ceil(t / n) * n;
  [ceilTo(1), ceilTo(5), ceilTo(10), ceilTo(20), ceilTo(50), ceilTo(100)].forEach(
    (v) => { if (v > t) set.add(Number(v.toFixed(2))); }
  );
  return Array.from(set).sort((a, b) => a - b).slice(0, 4);
};

const CashPayment = ({ total, methods = [], onConfirm, isProcessing = false }) => {
  const [tendered, setTendered]               = useState("");
  const [selectedMethodId, setSelectedMethodId] = useState("");
  const inputRef = useRef(null);

  const cashMethods = methods.length
    ? methods
    : [{ _id: "default-cash", name: "Cash", code: "CASH", type: "Cash" }];

  const selectedMethod =
    cashMethods.find((m) => m._id === selectedMethodId) || cashMethods[0];

  useEffect(() => {
    inputRef.current?.focus();
    setTendered(Number(total || 0).toFixed(2));
    if (cashMethods.length > 0) setSelectedMethodId(cashMethods[0]._id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  const quickAmounts = useMemo(() => buildQuickAmounts(total), [total]);

  const tenderedNum = Number(tendered) || 0;
  const change      = Math.max(0, Math.round((tenderedNum - total) * 100) / 100);
  const isValid     = tenderedNum >= total;
  // Tab says "Cash"; internal method names (e.g. custom labels in settings) only
  // matter when the cashier picks among multiple cash methods.
  const confirmLabel =
    cashMethods.length > 1 ? selectedMethod?.name || "Cash" : "Cash";

  const handleQuickAmount = (value) => {
    setTendered(Number(value).toFixed(2));
    inputRef.current?.focus();
  };

  const handleConfirm = () => {
    if (!isValid || isProcessing) return;
    onConfirm(
      [{
        method:            selectedMethod?.code || selectedMethod?.name || "cash",
        paymentMethodId:   selectedMethod?._id,
        paymentMethodName: selectedMethod?.name || "Cash",
        paymentMethodType: selectedMethod?.type || "Cash",
        amount:            total,
      }],
      tenderedNum
    );
  };

  return (
    <div className="space-y-3">

      {/* ── Method selector (only when > 1 method) ── */}
      {cashMethods.length > 1 && (
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
            Method
          </p>
          <div className="grid grid-cols-2 gap-2">
            {cashMethods.map((m) => {
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
                      ? `${classes.activeBg} ${classes.activeText} ${classes.activeBorder} shadow-sm`
                      : "bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-100"
                    }`}
                >
                  <Icon size={14} className={active ? classes.iconText : "text-gray-400"} />
                  <span className="truncate flex-1 text-left">{m.name}</span>
                  {active && (
                    <Check size={12} strokeWidth={3} className={`${classes.checkText} shrink-0`} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Tendered amount input ── */}
      <div>
        {/* <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            Cash Tendered
          </p>
          <p className="text-[11px] text-gray-400">
            Due{" "}
            <span className="font-bold text-gray-700 tabular-nums">
              RM {Number(total || 0).toFixed(2)}
            </span>
          </p>
        </div> */}

        <div className={`relative rounded-2xl border-2 transition-all duration-150 overflow-hidden
          ${document?.activeElement === inputRef?.current
            ? "border-[var(--p-blue)] bg-white"
            : "border-gray-200 bg-gray-50"
          }`}
        >
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[18px] font-bold text-gray-400 pointer-events-none select-none">
            RM
          </span>
          <input
            ref={inputRef}
            type="number"
            value={tendered}
            onChange={(e) => setTendered(e.target.value)}
            onFocus={(e) => e.currentTarget.closest(".relative")?.classList.add("border-[var(--p-blue)]", "bg-white")}
            onBlur={(e)  => e.currentTarget.closest(".relative")?.classList.remove("border-[var(--p-blue)]", "bg-white")}
            onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
            placeholder="0.00"
            min="0"
            step="0.01"
            className="
              w-full h-16 pl-14 pr-4 text-[28px] font-black text-right tabular-nums
              bg-transparent focus:outline-none placeholder:text-gray-300 placeholder:font-bold
            "
          />
        </div>
      </div>

      {/* ── Quick amounts ── */}
      {quickAmounts.length > 0 && (
        <div className="grid grid-cols-4 gap-1.5">
          {quickAmounts.map((amt) => {
            const isExact = Math.abs(amt - Number(total || 0)) < 0.005;
            return (
              <button
                key={amt}
                type="button"
                onClick={() => handleQuickAmount(amt)}
                disabled={isProcessing}
                className={`flex flex-col items-center justify-center h-12 rounded-2xl border text-[11.5px] font-bold
                  transition-all duration-150 active:scale-[0.96] disabled:opacity-50 gap-0.5
                  ${isExact
                    ? "bg-[var(--p-blue)] text-white border-[var(--p-blue)] shadow-md shadow-[var(--p-blue)]/20"
                    : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100 hover:border-gray-300"
                  }`}
              >
                <span>{isExact ? "Exact" : `RM ${amt.toFixed(0)}`}</span>
                {!isExact && (
                  <span className="text-[9px] text-gray-400 font-medium tabular-nums leading-none">
                    {amt.toFixed(2)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Change display ── */}
      <div className={`rounded-2xl p-4 transition-colors ${
        !tenderedNum
          ? "bg-gray-50 border border-gray-100"
          : isValid
            ? "bg-emerald-50 border border-emerald-200"
            : "bg-red-50 border border-red-200"
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-[10px] font-bold uppercase tracking-widest ${
              !tenderedNum ? "text-gray-400" : isValid ? "text-emerald-600" : "text-red-600"
            }`}>
              {!tenderedNum ? "Change Due" : isValid ? "Change Due" : "Shortfall"}
            </p>
            <p className={`text-[32px] font-black tabular-nums leading-none mt-1 ${
              !tenderedNum ? "text-gray-300" : isValid ? "text-emerald-700" : "text-red-600"
            }`}>
              <span className="text-[16px] font-bold opacity-70 mr-0.5">RM</span>
              {!tenderedNum
                ? "0.00"
                : isValid
                  ? change.toFixed(2)
                  : (total - tenderedNum).toFixed(2)
              }
            </p>
          </div>
          {isValid && tenderedNum > 0 && (
            <div className="h-10 w-10 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-sm shadow-emerald-500/30">
              <Check size={18} strokeWidth={3} className="text-white" />
            </div>
          )}
        </div>
      </div>

      {/* ── Confirm CTA ── */}
      <button
        type="button"
        onClick={handleConfirm}
        disabled={!isValid || isProcessing}
        className={`
          w-full h-14 rounded-2xl text-[14px] font-bold transition-all duration-150
          inline-flex items-center justify-center gap-2.5
          ${isValid && !isProcessing
            ? "bg-[var(--p-blue)] text-white hover:opacity-90 active:scale-[0.98] shadow-lg shadow-[var(--p-blue)]/30"
            : "bg-gray-100 text-gray-400 cursor-not-allowed"
          }
        `}
      >
        {isProcessing ? (
          <Loader2 size={18} className="animate-spin" />
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
        {!isProcessing && isValid && (
          <ArrowRight size={16} className="opacity-60" />
        )}
      </button>
    </div>
  );
};

export default React.memo(CashPayment);
