import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Store, ChevronDown, X } from "lucide-react";

const SalesChannelSelector = ({
  channels = [],
  selectedId,
  selectedName,
  onSelect,
  onClear,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  const selectedChannel = useMemo(() => {
    if (!selectedId) return null;
    const id = String(selectedId);
    return (channels || []).find((c) => String(c._id) === id) || null;
  }, [channels, selectedId]);

  const displayName =
    selectedChannel?.name ||
    selectedName ||
    null;

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = useCallback(
    (id) => {
      onSelect?.(id || null);
      setIsOpen(false);
    },
    [onSelect],
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className={`
          w-full flex items-center gap-2 h-10 px-3
          bg-gray-50 rounded-xl border transition-all text-left
          focus:outline-none
          ${
            displayName
              ? "border-[var(--p-blue)]/40 bg-[var(--p-blue)]/[0.03] hover:border-[var(--p-blue)]/60"
              : "border-gray-200 hover:border-gray-300 hover:bg-gray-100"
          }
        `}
      >
        {displayName ? (
          <div className="w-6 h-6 rounded-full bg-[var(--p-blue)] text-white flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold">
              {displayName[0].toUpperCase()}
            </span>
          </div>
        ) : (
          <Store size={14} className="text-gray-400 shrink-0" />
        )}
        {displayName ? (
          <span className="flex-1 text-[12px] font-semibold text-gray-800 truncate">
            {displayName}
          </span>
        ) : (
          <span className="flex-1 text-[12px] text-gray-400">POS / Walk-in</span>
        )}
        {displayName ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClear?.();
              setIsOpen(false);
            }}
            className="w-5 h-5 rounded-full bg-gray-200 hover:bg-red-100 hover:text-red-500 flex items-center justify-center transition-colors shrink-0"
          >
            <X size={10} />
          </button>
        ) : (
          <ChevronDown size={12} className="text-gray-400 shrink-0" />
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-xl border border-gray-200 shadow-2xl z-50 overflow-hidden animate-slideDown">
          <div className="max-h-52 overflow-y-auto">
            <button
              type="button"
              onClick={() => handleSelect(null)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                <Store size={12} className="text-gray-400" />
              </div>
              <div>
                <p className="text-[12px] font-medium text-gray-600">POS / Walk-in</p>
                <p className="text-[10px] text-gray-400">Default counter sale</p>
              </div>
            </button>

            {(channels || []).map((c) => (
              <button
                key={c._id}
                type="button"
                onClick={() => handleSelect(c._id)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-[var(--p-blue)]/[0.04] transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-[var(--p-blue)]/10 text-[var(--p-blue)] flex items-center justify-center shrink-0 ring-1 ring-[var(--p-blue)]/20">
                  <span className="text-[11px] font-bold">
                    {(c.name || "?")[0].toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold text-gray-800 truncate">
                    {c.name}
                  </p>
                  {c.code ? (
                    <p className="text-[10px] text-gray-400 truncate">{c.code}</p>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(SalesChannelSelector);
