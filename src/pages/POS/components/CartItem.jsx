import React, { useState } from "react";
import { Minus, Plus, Trash2, MessageSquare } from "lucide-react";

const CartItem = ({ item, onUpdateQty, onRemove, onUpdateNote }) => {
  const [showNote, setShowNote] = useState(false);
  const [noteText, setNoteText] = useState(item.note || "");

  const itemId = item.itemId?._id || item.itemId;
  const lineId = item._id || null;
  const isQr = item.lineSource === "qr_customer";

  const handleNoteBlur = () => {
    if (noteText !== (item.note || "")) {
      onUpdateNote(lineId || itemId, noteText);
    }
    if (!noteText) setShowNote(false);
  };

  return (
    <div className="group border-b border-gray-100 last:border-b-0 py-2 px-1.5 hover:bg-gray-50/60 transition-colors rounded-lg pos-cart-item-in">
      <div className="flex items-center gap-2">
        {/* Source indicator dot */}
        <span
          className={`shrink-0 h-2 w-2 rounded-full ${isQr ? "bg-amber-400 ring-2 ring-amber-100" : "bg-[var(--p-blue)] ring-2 ring-[var(--p-blue)]/15"}`}
          title={isQr ? "QR customer" : "POS staff"}
        />

        {/* Item info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="text-[12.5px] font-semibold text-gray-900 truncate leading-tight">
              {item.name}
            </p>
            <span
              className={`shrink-0 text-[8.5px] font-bold px-1 py-0.5 rounded ${
                isQr ? "bg-amber-100 text-amber-700" : "bg-[var(--p-blue)]/10 text-[var(--p-blue)]"
              }`}
            >
              {isQr ? "QR" : "POS"}
            </span>
          </div>
          <p className="text-[10px] text-gray-400 leading-tight mt-0.5 tabular-nums">
            RM {item.rate.toFixed(2)} each
          </p>
        </div>

        {/* Qty stepper */}
        <div className="flex items-center gap-0.5 shrink-0 bg-gray-100 rounded-lg p-0.5">
          <button
            type="button"
            onClick={() =>
              item.quantity <= 1
                ? onRemove(lineId || itemId)
                : onUpdateQty(lineId || itemId, item.quantity - 1)
            }
            className="w-7 h-7 rounded-md bg-white hover:bg-gray-50 active:scale-95 flex items-center justify-center transition-all shadow-sm"
            title={item.quantity <= 1 ? "Remove" : "Decrease"}
          >
            {item.quantity <= 1 ? (
              <Trash2 size={11} className="text-red-500" />
            ) : (
              <Minus size={11} className="text-gray-700" strokeWidth={2.5} />
            )}
          </button>
          <span className="w-6 text-center text-[12px] font-bold text-gray-900 tabular-nums">
            {item.quantity}
          </span>
          <button
            type="button"
            onClick={() => onUpdateQty(lineId || itemId, item.quantity + 1)}
            className="w-7 h-7 rounded-md bg-white hover:bg-gray-50 active:scale-95 flex items-center justify-center transition-all shadow-sm"
            title="Increase"
          >
            <Plus size={11} className="text-gray-700" strokeWidth={2.5} />
          </button>
        </div>

        {/* Line total */}
        <span className="text-[12.5px] font-bold text-gray-900 w-[68px] text-right shrink-0 tabular-nums">
          RM {item.amount.toFixed(2)}
        </span>

        {/* Note action — single, focused affordance.
            Item removal is handled by the qty stepper (minus → trash at qty 1). */}
        <button
          type="button"
          onClick={() => setShowNote(!showNote)}
          className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors shrink-0 ${
            item.note
              ? "text-[var(--p-blue)] bg-[var(--p-blue)]/10 hover:bg-[var(--p-blue)]/15"
              : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
          }`}
          title={item.note ? "Edit note" : "Add note"}
        >
          <MessageSquare size={12} />
        </button>
      </div>

      {/* Note input */}
      {(showNote || item.note) && (
        <div className="mt-1.5 ml-4">
          <input
            type="text"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onBlur={handleNoteBlur}
            placeholder="Add a note..."
            className="w-full text-[11px] px-2.5 py-1.5 bg-gray-50 rounded-lg outline-none border-2 border-gray-200 focus:border-[var(--p-blue)] focus:bg-white placeholder:text-gray-300 transition-all"
          />
        </div>
      )}
    </div>
  );
};

export default React.memo(CartItem);
