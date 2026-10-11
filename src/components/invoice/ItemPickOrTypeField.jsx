import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { sortAlphabetically } from "@/utils/sortAlphabetically";

/**
 * Zoho Books–style item line: users can either type a free‑form item name or
 * open the dropdown to pick from inventory (search + keyboard friendly).
 */
function ItemPickOrTypeField({
  itemName = "",
  disabled = false,
  businessItems = [],
  currency = "USD",
  getItemPrice = () => 0,
  placeholder = "Type item name or select from list",
  searchPlaceholder = "Search items…",
  onTextChange,
  onSelectProduct,
  clearable = true,
}) {
  const [open, setOpen] = useState(false);
  /** While true, list shows all inventory so you can pick another item (not stuck on a single-name filter). */
  const [browseMode, setBrowseMode] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
  });
  const [maxHeight, setMaxHeight] = useState(320);
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const panelRef = useRef(null);
  const suppressOpenAfterPickRef = useRef(false);

  const sortedItems = useMemo(
    () => sortAlphabetically(businessItems || [], "name"),
    [businessItems],
  );

  const filterLower = String(itemName ?? "")
    .trim()
    .toLowerCase();
  const filtered = useMemo(() => {
    if (browseMode) return sortedItems;
    if (!filterLower) return sortedItems;
    return sortedItems.filter((bi) => {
      const nm = String(bi.name || "").toLowerCase();
      const code = String(bi.itemCode || "").toLowerCase();
      return nm.includes(filterLower) || code.includes(filterLower);
    });
  }, [browseMode, sortedItems, filterLower]);

  const updatePosition = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const padding = 8;
    const viewportBottom = window.innerHeight - padding;
    const spaceBelow = viewportBottom - rect.bottom;
    setMaxHeight(Math.max(160, Math.min(320, spaceBelow)));
    setDropdownPosition({
      top: Math.min(rect.bottom, viewportBottom),
      left: rect.left,
      width: rect.width,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      const t = e.target;
      if (rootRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      if (typeof t.closest === "function" && t.closest("[data-modal-root]"))
        return;
      setOpen(false);
      setHighlight(-1);
    };
    const id = setTimeout(
      () => document.addEventListener("mousedown", onDown, true),
      0,
    );
    return () => {
      clearTimeout(id);
      document.removeEventListener("mousedown", onDown, true);
    };
  }, [open]);

  useEffect(() => {
    setHighlight(-1);
  }, [filtered.length, filterLower]);

  useEffect(() => {
    if (!open) setBrowseMode(false);
  }, [open]);

  const openForBrowse = useCallback(() => {
    if (disabled) return;
    if (suppressOpenAfterPickRef.current) return;
    setBrowseMode(true);
    setOpen(true);
  }, [disabled]);

  const pick = useCallback(
    (product, e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      suppressOpenAfterPickRef.current = true;
      setOpen(false);
      setHighlight(-1);
      onSelectProduct(product);
      requestAnimationFrame(() => {
        suppressOpenAfterPickRef.current = false;
      });
    },
    [onSelectProduct],
  );

  const handleKeyDown = (e) => {
    if (disabled) return;
    if (e.key === "Escape") {
      if (open) {
        setOpen(false);
        setHighlight(-1);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) {
        openForBrowse();
      } else {
        setHighlight((h) =>
          filtered.length === 0 ? -1 : h < filtered.length - 1 ? h + 1 : 0,
        );
      }
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (open && filtered.length) {
        setHighlight((h) => (h <= 0 ? filtered.length - 1 : h - 1));
      }
    }
    if (e.key === "Enter" && open && highlight >= 0 && filtered[highlight]) {
      e.preventDefault();
      pick(filtered[highlight]);
    }
  };

  const showClear =
    clearable && !disabled && String(itemName ?? "").trim() !== "";

  return (
    <div ref={rootRef} className="relative w-full">
      <div
        className={`flex w-full rounded-lg border border-gray-300 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-[var(--p-blue)] focus-within:border-[var(--p-blue)] ${
          disabled ? "bg-gray-100 opacity-75" : ""
        }`}
      >
        <input
          ref={inputRef}
          type="text"
          autoComplete="off"
          disabled={disabled}
          value={itemName ?? ""}
          placeholder={placeholder}
          onChange={(e) => {
            setBrowseMode(false);
            onTextChange?.(e.target.value);
          }}
          onFocus={() => openForBrowse()}
          onClick={() => openForBrowse()}
          onKeyDown={handleKeyDown}
          className="min-w-0 flex-1 px-3 py-2 text-sm border-0 focus:outline-none focus:ring-0 bg-transparent"
        />
        {showClear && (
          <button
            type="button"
            className="shrink-0 px-2 text-gray-400 hover:text-gray-600"
            onMouseDown={(e) => {
              e.preventDefault();
              onTextChange?.("");
              onSelectProduct?.(null);
            }}
            aria-label="Clear item"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (disabled) return;
            setOpen((v) => {
              const next = !v;
              if (next) setBrowseMode(true);
              return next;
            });
          }}
          className="shrink-0 px-2 border-l border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700"
          aria-label="Browse items"
        >
          <ChevronDown
            className={`h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {open && !disabled && (
        <div
          ref={panelRef}
          className="fixed z-[9999999] flex max-h-[min(320px,80vh)] min-h-[10rem] flex-col overflow-hidden rounded-lg border border-gray-300 bg-white shadow-xl"
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${Math.max(dropdownPosition.width, 260)}px`,
            maxHeight: `${maxHeight}px`,
          }}
        >
          <div className="shrink-0 border-b border-gray-200 p-2 text-xs text-gray-500 px-3 py-2 flex items-center gap-2 bg-gray-50">
            <Search className="h-3.5 w-3.5 shrink-0" />
            <span>{searchPlaceholder}</span>
          </div>
          <div
            className="flex-1 min-h-0 overflow-y-auto py-1 overscroll-contain"
            style={{ overscrollBehavior: "contain" }}
          >
            {filtered.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-gray-500">
                No inventory match — keep typing for a custom line item.
              </div>
            ) : (
              filtered.map((bi, idx) => {
                const price = Number(getItemPrice(bi)) || 0;
                const active = idx === highlight;
                return (
                  <button
                    key={String(bi._id)}
                    type="button"
                    onMouseDown={(e) => pick(bi, e)}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 ${active ? "bg-gray-100" : ""}`}
                  >
                    <div className="font-medium text-gray-900">{bi.name}</div>
                    {bi.itemCode ? (
                      <div className="text-xs text-gray-500">
                        Code: {bi.itemCode}
                      </div>
                    ) : null}
                    {price > 0 ? (
                      <div className="text-xs text-gray-400">
                        {currency} {price.toFixed(2)}
                      </div>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ItemPickOrTypeField;
