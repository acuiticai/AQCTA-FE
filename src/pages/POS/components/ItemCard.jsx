import React from "react";
import { Plus, Package } from "lucide-react";

const BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;

const ItemCard = ({ item, cartQty, onAdd, density = "comfortable" }) => {
  const price = item.salesInformation?.sellingPrice || 0;
  const imageSrc = item.featuredImage || item.images?.[0];
  const hasImage = Boolean(imageSrc);
  const isList = density === "list";
  const isCompact = density === "compact";
  const isDense = density === "dense";

  if (isList) {
    return (
      <button
        type="button"
        onClick={() => onAdd(item)}
        className="
          relative flex items-center gap-2.5 px-2.5 h-12 bg-white rounded-xl border border-gray-200
          cursor-pointer transition-all duration-150
          hover:border-[var(--p-blue)] hover:bg-[var(--p-blue)]/[0.02] hover:shadow-sm
          active:scale-[0.98] text-left focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]/30 focus:border-[var(--p-blue)]
        "
      >
        <div className="h-8 w-8 shrink-0 rounded-lg bg-gray-50 ring-1 ring-gray-100 flex items-center justify-center overflow-hidden">
          {hasImage ? (
            <img
              src={imageSrc.startsWith("http") ? imageSrc : `${BASE_URL}/${imageSrc}`}
              alt={item.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <Package size={14} className="text-gray-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-gray-900 truncate leading-tight">
            {item.name}
          </p>
          <p className="text-[10.5px] font-bold text-[var(--p-blue)] leading-tight mt-0.5">
            RM {price.toFixed(2)}
          </p>
        </div>
        {cartQty > 0 && (
          <span className="bg-[var(--p-blue)] text-white text-[10px] font-bold min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center shrink-0 shadow-sm ring-2 ring-white">
            {cartQty}
          </span>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onAdd(item)}
      className="
        relative flex flex-col bg-white rounded-xl border border-gray-200
        overflow-hidden cursor-pointer group shadow-[0_1px_2px_rgba(15,23,42,0.04)]
        transition-all duration-200 ease-out
        hover:border-[var(--p-blue)]/40 hover:shadow-md hover:-translate-y-0.5
        active:scale-[0.97] active:shadow-sm
        focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]/40 focus:ring-offset-1
      "
    >
      {/* Image */}
      <div
        className={`relative w-full bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center overflow-hidden ${
          isCompact ? "aspect-[4/3]" : isDense ? "aspect-[4/3]" : "aspect-[4/3]"
        }`}
      >
        {hasImage ? (
          <img
            src={imageSrc.startsWith("http") ? imageSrc : `${BASE_URL}/${imageSrc}`}
            alt={item.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300 ease-out"
            loading="lazy"
          />
        ) : (
          <Package
            size={isCompact ? 18 : 28}
            className="text-gray-400"
          />
        )}

        {/* Quick add overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end justify-end p-1.5">
          <div
            className={`bg-[var(--p-blue)] rounded-full flex items-center justify-center scale-50 group-hover:scale-100 transition-transform duration-200 shadow-lg ring-2 ring-white/30 ${
              isCompact ? "w-7 h-7" : "w-9 h-9"
            }`}
          >
            <Plus size={isCompact ? 14 : 18} strokeWidth={2.5} className="text-white" />
          </div>
        </div>

        {/* Cart quantity badge */}
        {cartQty > 0 && (
          <span
            key={cartQty}
            className={`pos-badge-pop absolute bg-[var(--p-blue)] text-white font-bold rounded-full flex items-center justify-center shadow-md ring-2 ring-white tabular-nums ${
              isCompact
                ? "top-1 right-1 text-[9px] min-w-[18px] h-[18px] px-1"
                : "top-1.5 right-1.5 text-[10.5px] min-w-[22px] h-[22px] px-1.5"
            }`}
          >
            {cartQty}
          </span>
        )}
      </div>

      {/* Info */}
      <div className={`text-left ${isCompact ? "p-1.5" : isDense ? "p-2" : "p-2.5"}`}>
        <p
          className={`font-semibold text-gray-900 leading-snug line-clamp-2 ${
            isCompact ? "text-[10.5px]" : isDense ? "text-[12px]" : "text-[12.5px]"
          }`}
          title={item.name}
        >
          {item.name}
        </p>
        {item.itemCode && !isCompact && !isDense && (
          <p className="text-gray-400 mt-0.5 truncate text-[10px] font-medium tracking-wide">
            {item.itemCode}
          </p>
        )}
        <p
          className={`font-bold text-[var(--p-blue)] tabular-nums ${
            isCompact ? "text-[11px] mt-0.5" : isDense ? "text-[12.5px] mt-1" : "text-sm mt-1"
          }`}
        >
          RM {price.toFixed(2)}
        </p>
      </div>
    </button>
  );
};

export default React.memo(ItemCard);
