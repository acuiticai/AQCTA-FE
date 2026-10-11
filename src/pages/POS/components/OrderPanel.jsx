import React, { useMemo, useState, useCallback, useEffect } from "react";
import { ShoppingCart, Trash2, CreditCard, ArrowRightLeft, PauseCircle, PlayCircle, ChevronDown, Users, Minus, Plus } from "lucide-react";
import CartItem from "./CartItem";
import CustomerSelector from "./CustomerSelector";
import SalesChannelSelector from "./SalesChannelSelector";
import DiscountControl from "./DiscountControl";

// Extract creation time from a MongoDB ObjectId string
const idToTime = (id) => {
  if (!id || typeof id !== "string" || id.length < 8) return "";
  try {
    return new Date(parseInt(id.substring(0, 8), 16) * 1000).toLocaleTimeString(
      [],
      { hour: "2-digit", minute: "2-digit" }
    );
  } catch {
    return "";
  }
};

const OrderPanel = ({
  order,
  loading = false,
  salesChannels = [],
  customers,
  customersLoading,
  onSearchCustomers,
  onSelectCustomer,
  onClearCustomer,
  onSelectSalesChannel,
  onUpdateQty,
  onRemoveItem,
  onUpdateNote,
  syncState,
  onDiscountChange,
  onStaffNotesChange,
  onTransferTable,
  onHold,
  onResume,
  onCharge,
  onPayLater,
  onVoid,
  onUpdateGuestCount,
}) => {
  const [noteDraft, setNoteDraft] = useState(order?.staffNotes || "");
  const [totalsOpen, setTotalsOpen] = useState(false);
  const [guestEditOpen, setGuestEditOpen] = useState(false);

  // Sync draft when a different order is loaded
  useEffect(() => {
    setNoteDraft(order?.staffNotes || "");
    setGuestEditOpen(false);
  }, [order?._id]);

  const handleNotesBlur = useCallback(() => {
    if (noteDraft !== (order?.staffNotes || "")) {
      onStaffNotesChange?.(noteDraft);
    }
  }, [noteDraft, order?.staffNotes, onStaffNotesChange]);
  const items = order?.items || [];
  const hasItems = items.length > 0;

  // Group items into QR-customer and POS-staff sections
  const itemGroups = useMemo(() => {
    const qr = items.filter((i) => i.lineSource === "qr_customer");
    const staff = items.filter((i) => i.lineSource !== "qr_customer");
    const groups = [];
    if (qr.length > 0) groups.push({ source: "qr_customer", label: "Customer", items: qr });
    if (staff.length > 0) groups.push({ source: "pos_staff", label: "Waiter", items: staff });
    // Fall back to ungrouped if all items have same source or no source
    return groups.length === 2 ? groups : null;
  }, [items]);
  const isOpen = order?.status === "open";
  const isHeld = order?.status === "held";
  const tableLabel = order?.table
    ? order.table.label || `Table ${order.table.tableNumber || ""}`.trim()
    : "Walk-in";
  const sourceLabel =
    order?.serviceType === "qr_table"
      ? "QR Table"
      : order?.serviceType === "dine_in"
        ? "POS Dine-in"
        : "POS";

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gradient-to-b from-white to-gray-50/40">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-8 w-8 rounded-xl bg-[var(--p-blue)]/10 flex items-center justify-center shrink-0">
            <ShoppingCart size={15} className="text-[var(--p-blue)]" />
          </div>
          <h2 className="text-sm font-bold text-gray-900 truncate">
            {loading ? "Loading…" : order?.orderNumber || "New Order"}
          </h2>
          {syncState === "saving" && (
            <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 h-5 rounded-md animate-pulse">
              <span className="h-1 w-1 rounded-full bg-amber-500" />
              Saving
            </span>
          )}
          {syncState === "saved" && (
            <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 h-5 rounded-md">
              <span className="h-1 w-1 rounded-full bg-emerald-500" />
              Saved
            </span>
          )}
          {syncState === "error" && (
            <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-red-700 bg-red-50 border border-red-200 px-1.5 h-5 rounded-md">
              <span className="h-1 w-1 rounded-full bg-red-500" />
              Save failed
            </span>
          )}
        </div>
        {!loading && order && (isOpen || isHeld) && (
          <div className="flex items-center gap-0.5 shrink-0">
            {isHeld && (
              <button
                type="button"
                onClick={onResume}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-amber-500 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                title="Resume order"
              >
                <PlayCircle size={16} />
              </button>
            )}
            {isOpen && order.table && (
              <button
                type="button"
                onClick={onTransferTable}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                title="Transfer table"
              >
                <ArrowRightLeft size={15} />
              </button>
            )}
            {isOpen && hasItems && (
              <button
                type="button"
                onClick={onHold}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-gray-400 hover:text-amber-500 hover:bg-amber-50 transition-colors"
                title="Park order"
              >
                <PauseCircle size={15} />
              </button>
            )}
            {isOpen && hasItems && (
              <button
                type="button"
                onClick={onVoid}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                title="Void order"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Held order banner */}
      {!loading && isHeld && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-100">
          <PauseCircle size={13} className="text-amber-500 shrink-0" />
          <span className="text-[11px] font-semibold text-amber-700">Order parked — tap Resume to continue</span>
        </div>
      )}

      {/* Customer selector */}
      {!loading && order && isOpen && (
        <div className="px-3 py-2 border-b border-gray-100 space-y-2">
          <div className="flex items-center gap-2 text-[11px]">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-bold">
              {tableLabel}
            </span>
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full font-bold ${
                order?.serviceType === "qr_table"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-[var(--p-blue)]/10 text-[var(--p-blue)]"
              }`}
            >
              {sourceLabel}
            </span>
            {order?.table && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setGuestEditOpen((v) => !v)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                  title="Edit guest count"
                >
                  <Users size={11} />
                  {order?.guestCount || 1}
                </button>
                {guestEditOpen && (
                  <div className="absolute left-0 top-full mt-1.5 z-20 flex items-center gap-2 bg-white border-2 border-gray-100 rounded-xl shadow-lg p-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const next = Math.max(1, (order?.guestCount || 1) - 1);
                        onUpdateGuestCount?.(next);
                      }}
                      disabled={(order?.guestCount || 1) <= 1}
                      className="h-7 w-7 inline-flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:border-[var(--p-blue)] hover:text-[var(--p-blue)] disabled:opacity-30 transition-colors"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="text-xs font-bold text-gray-900 tabular-nums w-5 text-center">
                      {order?.guestCount || 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const next = Math.min(99, (order?.guestCount || 1) + 1);
                        onUpdateGuestCount?.(next);
                      }}
                      className="h-7 w-7 inline-flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:border-[var(--p-blue)] hover:text-[var(--p-blue)] transition-colors"
                    >
                      <Plus size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setGuestEditOpen(false)}
                      className="h-7 px-2 text-[10px] font-bold text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      Done
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          {!order?.table && (
            <SalesChannelSelector
              channels={salesChannels}
              selectedId={order?.salesChannel?._id || order?.salesChannel || ""}
              selectedName={order?.salesChannelName}
              onSelect={(id) => onSelectSalesChannel?.(id)}
              onClear={() => onSelectSalesChannel?.(null)}
            />
          )}
          {order?.kitchenLastSentAt && (
            <div className="text-[10px] text-gray-500">
              Last sent to kitchen:{" "}
              <span className="font-semibold text-gray-700">
                {new Date(order.kitchenLastSentAt).toLocaleTimeString()}
              </span>
            </div>
          )}
          <CustomerSelector
            customer={
              order.customer && typeof order.customer === "object"
                ? order.customer
                : null
            }
            customers={customers}
            loading={customersLoading}
            onSearch={onSearchCustomers}
            onSelect={onSelectCustomer}
            onClear={onClearCustomer}
          />
        </div>
      )}

      {/* Cart items */}
      <div className="flex-1 overflow-y-auto px-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-10">
            <div className="w-8 h-8 border-[3px] border-gray-200 border-t-[var(--p-blue)] rounded-full animate-spin" />
            <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">
              Loading order
            </p>
          </div>
        ) : !order ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-10">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center ring-1 ring-gray-200">
              <ShoppingCart size={28} className="text-gray-300" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">Select a table</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Or create a walk-in order
              </p>
            </div>
          </div>
        ) : !hasItems ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-10">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-[var(--p-blue)]/5 to-[var(--p-blue)]/10 flex items-center justify-center ring-1 ring-[var(--p-blue)]/15">
              <ShoppingCart size={28} className="text-[var(--p-blue)]/60" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">Cart is empty</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Tap menu items to add them
              </p>
            </div>
          </div>
        ) : itemGroups ? (
          // Mixed order: show Customer and Waiter sections separately
          <div className="py-1 space-y-1">
            {itemGroups.map((group) => {
              const firstId = group.items[0]?._id;
              const time = idToTime(firstId);
              const isQr = group.source === "qr_customer";
              return (
                <div key={group.source}>
                  {/* Section header */}
                  <div
                    className={`flex items-center justify-between px-2 py-1 rounded-md mb-0.5 ${
                      isQr
                        ? "bg-amber-50 border border-amber-100"
                        : "bg-blue-50 border border-blue-100"
                    }`}
                  >
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wide ${
                        isQr ? "text-amber-700" : "text-blue-700"
                      }`}
                    >
                      {group.label}
                    </span>
                    {time && (
                      <span className="text-[10px] text-gray-400">{time}</span>
                    )}
                  </div>
                  {group.items.map((item, idx) => (
                    <CartItem
                      key={item._id || idx}
                      item={item}
                      onUpdateQty={onUpdateQty}
                      onRemove={onRemoveItem}
                      onUpdateNote={onUpdateNote}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-1">
            {items.map((item, idx) => (
              <CartItem
                key={item._id || idx}
                item={item}
                onUpdateQty={onUpdateQty}
                onRemove={onRemoveItem}
                onUpdateNote={onUpdateNote}
              />
            ))}
          </div>
        )}
      </div>

      {/* Totals & Charge */}
      {!loading && order && isOpen && (
        <div className="border-t border-gray-200 bg-gray-50/50 shrink-0">
          {/* Always-visible: toggle row + grand total */}
          <button
            type="button"
            onClick={() => setTotalsOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-100/60 transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <ChevronDown
                size={13}
                className={`text-gray-400 transition-transform duration-200 ${totalsOpen ? "rotate-180" : ""}`}
              />
              <span className="text-[10px] text-gray-500 font-medium">
                {totalsOpen ? "Hide details" : "Show details"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-[9px] text-gray-400 leading-none">Due</div>
                <div className="text-[11px] font-bold text-amber-700 leading-tight">
                  RM {Math.max(0, Number(order.dueAmount ?? order.total ?? 0)).toFixed(2)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[9px] text-gray-400 leading-none">Total</div>
                <div className="text-base font-bold text-gray-900 leading-tight">
                  RM {(order.total || 0).toFixed(2)}
                </div>
              </div>
            </div>
          </button>

          {/* Collapsible detail breakdown */}
          {totalsOpen && (
            <div className="px-4 pb-2 space-y-1.5 border-t border-gray-200/80">
              <div className="flex items-center justify-between text-xs text-gray-600 pt-2">
                <span>Subtotal</span>
                <span className="font-medium">RM {(order.subtotal || 0).toFixed(2)}</span>
              </div>

              <DiscountControl
                discountType={order.discountType || "percentage"}
                discountValue={order.discountValue || 0}
                subtotal={order.subtotal || 0}
                onChange={onDiscountChange}
              />

              {(order.serviceChargeAmount || 0) > 0 && (
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span>
                    Service Charge{" "}
                    {order.serviceChargeType === "fixed"
                      ? `(RM ${(order.serviceChargeValue || order.serviceChargeRate || 0).toFixed(2)})`
                      : `(${order.serviceChargeValue ?? order.serviceChargeRate ?? 0}%)`}
                  </span>
                  <span>RM {(order.serviceChargeAmount || 0).toFixed(2)}</span>
                </div>
              )}

              {Array.isArray(order.taxBreakdown) && order.taxBreakdown.length > 0
                ? order.taxBreakdown.map((bd, i) => (
                    <div key={i} className="space-y-0.5">
                      <div className="flex items-center justify-between text-[10px] text-gray-400">
                        <span>Taxable Amount</span>
                        <span>RM {Number(bd.taxableAmount || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-600">
                        <span>{bd.taxName || `Tax ${bd.taxRate}%`}</span>
                        <span>RM {Number(bd.taxAmount || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  ))
                : (order.taxAmount || 0) > 0 && (
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>{order.taxName || `Tax (${order.taxRate ?? 0}%)`}</span>
                      <span>RM {(order.taxAmount || 0).toFixed(2)}</span>
                    </div>
                  )}

              <div className="flex items-center justify-between text-xs text-gray-600 pt-1 border-t border-gray-200">
                <span>Paid</span>
                <span className="font-semibold text-emerald-700">
                  RM {Number(order.paidAmount || 0).toFixed(2)}
                </span>
              </div>

              <textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                onBlur={handleNotesBlur}
                placeholder="Staff notes (internal)..."
                rows={2}
                maxLength={1000}
                className="w-full text-[10px] px-2 py-1.5 bg-white rounded-lg border border-gray-200 focus:border-[var(--p-blue)] focus:outline-none placeholder:text-gray-300 resize-none mt-1"
              />
            </div>
          )}

          {/* Action buttons — always visible */}
          <div className="grid grid-cols-2 gap-2 px-4 pb-3 pt-2">
            <button
              type="button"
              onClick={onPayLater}
              disabled={!hasItems}
              className={`
                h-11 rounded-xl text-xs font-bold
                border transition-all duration-200
                ${
                  hasItems
                    ? "bg-gray-900 text-white border-gray-900 hover:bg-gray-800 active:scale-[0.98] shadow-sm"
                    : "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                }
              `}
            >
              Send to Kitchen
            </button>
            <button
              type="button"
              onClick={onCharge}
              disabled={!hasItems}
              className={`
                h-11 rounded-xl text-xs font-bold
                flex items-center justify-center gap-1.5
                transition-all duration-200
                ${
                  hasItems
                    ? "bg-[var(--p-blue)] text-white hover:opacity-90 active:scale-[0.98] shadow-sm shadow-[var(--p-blue)]/30"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }
              `}
            >
              <CreditCard size={14} />
              Pay Now
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(OrderPanel);
