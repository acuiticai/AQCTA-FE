import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  Search,
  Package,
  LayoutGrid,
  Grid3x3,
  Grid2x2,
  List,
} from "lucide-react";
import CategoryTabs from "./CategoryTabs";
import ItemCard from "./ItemCard";

const LAYOUT_STORAGE_KEY = "pos.itemsLayout";

// Catalog layout presets. Column counts are tuned so a typical production
// menu always shows 10-12 items per row on common POS screens (dense mode
// is the default and targets ~12/row on laptop/2xl, 10/row on wider desktops).
const LAYOUTS = {
  comfortable: {
    label: "Comfortable",
    icon: Grid2x2,
    density: "comfortable",
    description: "Big cards — fewer per row",
    gridClass:
      "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2.5",
  },
  dense: {
    label: "Dense",
    icon: LayoutGrid,
    density: "dense",
    description: "Default — 10-12 per row",
    gridClass:
      "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-9 2xl:grid-cols-10 gap-2",
  },
  compact: {
    label: "Compact",
    icon: Grid3x3,
    density: "compact",
    description: "Smaller cards — more per row",
    gridClass:
      "grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12 gap-1.5",
  },
  list: {
    label: "List",
    icon: List,
    density: "list",
    description: "Quick name-only list",
    gridClass:
      "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-1.5",
  },
};

const LAYOUT_ORDER = ["comfortable", "dense", "compact", "list"];

const ItemCatalog = ({
  items,
  categories,
  loading,
  cartItems,
  onAddItem,
  onFetchItems,
}) => {
  const [activeCategory, setActiveCategory] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [layoutKey, setLayoutKey] = useState(() => {
    if (typeof window === "undefined") return "dense";
    const stored = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
    return LAYOUTS[stored] ? stored : "dense";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(LAYOUT_STORAGE_KEY, layoutKey);
    } catch (_) {
      // localStorage may be unavailable (private mode, quota) — ignore.
    }
  }, [layoutKey]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      onFetchItems(activeCategory, searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, activeCategory, onFetchItems]);

  const handleCategoryChange = useCallback((catId) => {
    setActiveCategory(catId);
    // fetch triggered by useEffect
  }, []);

  // Map cart quantities by item ID for badge display
  const cartQtyMap = {};
  (cartItems || []).forEach((ci) => {
    const id = ci.itemId?._id || ci.itemId;
    if (id) cartQtyMap[id] = (cartQtyMap[id] || 0) + ci.quantity;
  });

  const layout = LAYOUTS[layoutKey] || LAYOUTS.dense;
  const { density, gridClass } = useMemo(
    () => ({ density: layout.density, gridClass: layout.gridClass }),
    [layout]
  );

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 space-y-3 bg-gradient-to-b from-white to-gray-50/40">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-bold text-gray-900 tracking-tight">Menu</h2>
            <span className="text-[11px] font-medium text-gray-400">
              {items.length} {items.length === 1 ? "item" : "items"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Layout switcher */}
            <div
              className="hidden sm:inline-flex items-center gap-0.5 p-1 bg-gray-100 rounded-xl"
              role="radiogroup"
              aria-label="Items layout"
            >
              {LAYOUT_ORDER.map((key) => {
                const L = LAYOUTS[key];
                const active = layoutKey === key;
                const LayoutIcon = L.icon;
                return (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={L.label}
                    title={`${L.label} — ${L.description}`}
                    onClick={() => setLayoutKey(key)}
                    className={`h-7 w-7 inline-flex items-center justify-center rounded-lg transition-all duration-150 ${
                      active
                        ? "bg-white text-[var(--p-blue)] shadow-sm ring-1 ring-gray-200/60"
                        : "text-gray-500 hover:text-gray-700 hover:bg-white/60"
                    }`}
                  >
                    <LayoutIcon size={13} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search
            size={14}
            className="absolute left-1 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search items by name or code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="
              w-full h-10 pl-9 pr-9 text-[13px] bg-gray-50 rounded-xl
              outline-none border-2 border-gray-200 focus:border-[var(--p-blue)] focus:bg-white
              transition-all duration-150 placeholder:text-gray-400
            "
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 inline-flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              aria-label="Clear search"
            >
              <span className="text-base leading-none">×</span>
            </button>
          )}
        </div>

        {/* Categories */}
        <CategoryTabs
          categories={categories}
          activeCategory={activeCategory}
          onSelect={handleCategoryChange}
        />
      </div>

      {/* Items grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-8 h-8 border-[3px] border-gray-200 border-t-[var(--p-blue)] rounded-full animate-spin" />
            <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">Loading menu</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-10">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center ring-1 ring-gray-200">
              <Package size={28} className="text-gray-300" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">
                {searchTerm ? "No matching items" : "No items available"}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {searchTerm
                  ? `Nothing found for "${searchTerm}"`
                  : "Add items to your catalog to get started"}
              </p>
            </div>
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="mt-1 inline-flex items-center gap-1 px-3 h-8 text-xs font-semibold text-[var(--p-blue)] bg-[var(--p-blue)]/5 hover:bg-[var(--p-blue)]/10 rounded-lg transition-colors"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className={gridClass}>
            {items.map((item) => (
              <ItemCard
                key={item._id}
                item={item}
                cartQty={cartQtyMap[item._id] || 0}
                onAdd={onAddItem}
                density={density}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(ItemCatalog);
