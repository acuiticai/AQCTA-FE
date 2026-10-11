import React from "react";
import { Users } from "lucide-react";

const STATUS_STYLES = {
  available:
    "bg-gray-50 border-gray-300 text-gray-600 hover:border-gray-400 hover:bg-gray-100",
  occupied:
    "bg-amber-50 border-amber-400 text-amber-800 hover:border-amber-500",
  reserved: "bg-red-50 border-red-400 text-red-700 hover:border-red-500",
  selected:
    "bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-300",
};

const SHAPE_CLASSES = {
  rectangle: "rounded-xl",
  circle: "rounded-full",
  square: "rounded-xl",
};

const TableCard = ({ table, isSelected, onSelect, uniformShape = false }) => {
  const status = isSelected ? "selected" : table.status;
  const styleClass = STATUS_STYLES[status] || STATUS_STYLES.available;
  const shapeClass = uniformShape
    ? SHAPE_CLASSES.rectangle
    : SHAPE_CLASSES[table.shape] || SHAPE_CLASSES.rectangle;

  const orderTotal = table.currentOrder?.total;
  const itemCount = table.currentOrder?.items?.length;
  const guestCount = table.currentOrder?.guestCount;

  return (
    <button
      type="button"
      onClick={() => onSelect(table)}
      className={`
        relative flex flex-col items-center justify-center
        border-2 ${shapeClass} ${styleClass}
        w-full aspect-square p-2
        transition-all duration-200 cursor-pointer
        hover:scale-[1.03] active:scale-[0.98]
        focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[var(--p-blue)]
      `}
    >
      <span className="text-sm font-bold leading-none">
        {table.tableNumber}
      </span>

      {table.label && (
        <span className="text-[10px] mt-0.5 opacity-70 truncate max-w-full">
          {table.label}
        </span>
      )}

      {table.status === "occupied" && orderTotal != null && (
        <span className="text-xs font-semibold mt-1">
          RM {orderTotal.toFixed(2)}
        </span>
      )}

      {table.status === "occupied" && itemCount > 0 && (
        <span className="absolute top-1 right-1.5 bg-amber-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
          {itemCount}
        </span>
      )}

      {table.status === "reserved" && (
        <span className="text-[9px] mt-0.5 font-medium uppercase tracking-wider">
          Reserved
        </span>
      )}

      {table.status === "occupied" && guestCount > 0 ? (
        <span className="text-[9px] mt-1 opacity-50 inline-flex items-center gap-0.5">
          <Users size={9} /> {guestCount}
        </span>
      ) : (
        <span className="text-[9px] mt-1 opacity-50">{table.capacity} seats</span>
      )}
    </button>
  );
};

export default React.memo(TableCard);
