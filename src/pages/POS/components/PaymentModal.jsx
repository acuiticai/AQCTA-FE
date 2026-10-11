import React, { useState, useEffect, useCallback } from "react";
import { X, Banknote, CreditCard, Phone } from "lucide-react";
import CashPayment from "./CashPayment";
import CardPayment from "./CardPayment";

const TABS = [
  { key: "cash", label: "Cash", icon: Banknote, color: "emerald" },
  { key: "card", label: "Online", icon: CreditCard, color: "blue" },
];

const PaymentModal = ({
  isOpen,
  order,
  paymentMethods = [],
  businessId,
  headers,
  onClose,
  onConfirm,
}) => {
  const [activeTab, setActiveTab] = useState("cash");
  const [isProcessing, setIsProcessing] = useState(false);
  const [customerPhone, setCustomerPhone] = useState("");

  const activeMethods = (paymentMethods || []).filter(
    (m) => String(m.status || "Active") === "Active",
  );
  const cashMethods = activeMethods.filter((m) => m.type === "Cash");
  const onlineMethods = activeMethods.filter((m) => m.type === "Online");

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(cashMethods.length > 0 ? "cash" : "card");
    setCustomerPhone(order?.guestPhones?.[0] || "");
  }, [isOpen, cashMethods.length, order?.guestPhones]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === "Escape" && !isProcessing) onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, isProcessing, onClose]);

  const handleConfirm = useCallback(
    async (payments, cashTendered) => {
      setIsProcessing(true);
      try {
        // Stock out is automatic via FEFO (if expiry) or FIFO
        await Promise.resolve(
          onConfirm(payments, cashTendered, {
            customerPhone: customerPhone.trim(),
            stockWarehouseId: null,
            stockLocationId: null,
          }),
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [onConfirm, customerPhone],
  );

  if (!isOpen || !order) return null;

  const total = Math.max(0, Number(order?.dueAmount ?? order?.total ?? 0));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => {
          if (!isProcessing) onClose();
        }}
      />

      <div className="relative w-full max-w-[420px] mx-4 bg-white rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
        <div className="px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-base font-bold text-gray-900 tracking-tight">
                Payment
              </h3>
              <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                {order.orderNumber}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!isProcessing) onClose();
              }}
              disabled={isProcessing}
              className="h-8 w-8 inline-flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <X size={15} />
            </button>
          </div>

          <div className="mt-4 px-4 py-3.5 rounded-2xl bg-[var(--p-blue)]/8 border border-[var(--p-blue)]/15 flex items-center justify-between">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              Amount Due
            </p>
            <p className="text-[28px] font-black text-gray-900 tabular-nums leading-none tracking-tight">
              <span className="text-[14px] font-bold text-gray-400 mr-1">RM</span>
              {total.toFixed(2)}
            </p>
          </div>

          <div className="mt-2.5 flex items-center gap-2 px-3 h-10 rounded-2xl border-2 border-gray-100 bg-gray-50 focus-within:border-[var(--p-blue)]/40 transition-colors">
            <Phone size={14} className="text-gray-400 shrink-0" />
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              disabled={isProcessing}
              placeholder="Customer phone (optional)"
              className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none disabled:opacity-60"
            />
          </div>
        </div>

        <div className="px-5 pt-4 pb-0">
          <div className="flex bg-gray-100 rounded-2xl p-1 gap-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => !isProcessing && setActiveTab(tab.key)}
                  disabled={isProcessing}
                  className={`
                    flex-1 flex items-center justify-center gap-2 h-9 text-[12.5px] font-semibold
                    rounded-xl transition-all duration-150 active:scale-[0.98] disabled:opacity-50
                    ${
                      active
                        ? "bg-[var(--p-blue)] text-white shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }
                  `}
                >
                  <Icon size={14} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-5 py-4 max-h-[62vh] overflow-y-auto">
          <p className="text-[11px] text-gray-500 mb-3">
            Stock is deducted automatically (FEFO if expiry dates exist,
            otherwise FIFO).
          </p>
          {activeTab === "cash" && (
            <CashPayment
              total={total}
              methods={cashMethods}
              onConfirm={handleConfirm}
              isProcessing={isProcessing}
            />
          )}
          {activeTab === "card" && (
            <CardPayment
              total={total}
              methods={onlineMethods}
              onConfirm={handleConfirm}
              isProcessing={isProcessing}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(PaymentModal);
