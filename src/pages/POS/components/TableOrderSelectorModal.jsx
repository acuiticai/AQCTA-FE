import React, { useEffect, useState } from "react";
import {
  X,
  Plus,
  ShoppingCart,
  Clock,
  Loader2,
  AlertCircle,
  QrCode,
  Monitor,
  User,
} from "lucide-react";
import PosServices from "@/services/PosServices";

const fmt = (n) =>
  new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: 2,
  }).format(Number(n) || 0);

const timeAgo = (iso) => {
  if (!iso) return "";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return "just now";
  if (diff < 60) return `${diff}m ago`;
  return `${Math.floor(diff / 60)}h ${diff % 60}m ago`;
};

const TableOrderSelectorModal = ({
  isOpen,
  tableId,
  tableNumber,
  businessId,
  headers = {},
  onSelectOrder,  // (orderId) => void — load existing
  onNewOrder,     // () => void — forceNew
  onClose,
}) => {
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  useEffect(() => {
    if (!isOpen || !tableId || !businessId) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    PosServices.getOrders(
      { tableId, business: businessId, status: "open", limit: 20 },
      headers,
    )
      .then((res) => {
        if (cancelled) return;
        const list = res.data?.data || res.data?.orders || [];
        setOrders(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load orders for this table.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, tableId, businessId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-md mx-4 bg-white rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-base font-bold text-gray-900 tracking-tight">
                Table {tableNumber} — Active Orders
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Select an order to continue or start a new one
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
        <div className="px-5 py-4 space-y-2 max-h-[55vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10 gap-2 text-gray-400">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Loading orders…</span>
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 text-sm text-red-500 py-6 justify-center">
              <AlertCircle size={16} />
              {error}
            </div>
          ) : orders.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">
              No open orders found for this table.
            </p>
          ) : (
            orders.map((o) => {
              const itemCount  = o.items?.length ?? 0;
              const total      = o.total ?? o.dueAmount ?? 0;
              const isQr       = o.orderSource === "qr_customer" || !!o.qrSessionId;
              const label      = o.guestName
                ? o.guestName
                : isQr
                  ? "QR Customer"
                  : "POS Order";
              return (
                <button
                  key={o._id}
                  type="button"
                  onClick={() => onSelectOrder(o._id)}
                  className="w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 border-gray-100 bg-gray-50 hover:border-[var(--p-blue)]/30 hover:bg-[var(--p-blue)]/5 transition-all duration-150 active:scale-[0.98] text-left group"
                >
                  {/* Source icon */}
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isQr ? "bg-amber-50" : "bg-[var(--p-blue)]/10"
                  }`}>
                    {isQr
                      ? <QrCode size={16} className="text-amber-500" />
                      : <Monitor size={16} className="text-[var(--p-blue)]" />
                    }
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Source badge + name */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide ${
                        isQr
                          ? "bg-amber-100 text-amber-700"
                          : "bg-blue-100 text-blue-700"
                      }`}>
                        {isQr ? <QrCode size={8} /> : <Monitor size={8} />}
                        {isQr ? "QR" : "POS"}
                      </span>
                      <p className="text-[13px] font-bold text-gray-900 leading-tight truncate">
                        {label}
                      </p>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1.5">
                      <span className="font-mono text-gray-400">{o.orderNumber || ""}</span>
                      <span className="text-gray-300">·</span>
                      <span>{itemCount} item{itemCount !== 1 ? "s" : ""}</span>
                      <span className="text-gray-300">·</span>
                      <Clock size={9} className="opacity-50" />
                      <span>{timeAgo(o.createdAt)}</span>
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-[13px] font-black text-gray-900 tabular-nums">
                      {fmt(total)}
                    </p>
                    <p className="text-[10px] text-[var(--p-blue)] font-semibold mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      Continue →
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer — New order CTA */}
        <div className="px-5 pb-5 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={onNewOrder}
            className="w-full h-12 rounded-2xl border-2 border-dashed border-gray-300 text-[13px] font-semibold text-gray-600 hover:border-[var(--p-blue)] hover:text-[var(--p-blue)] hover:bg-[var(--p-blue)]/5 transition-all duration-150 flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            <Plus size={15} />
            New order for this table
          </button>
        </div>
      </div>
    </div>
  );
};

export default TableOrderSelectorModal;
