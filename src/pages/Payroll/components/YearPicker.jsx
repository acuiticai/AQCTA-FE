import React, { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

/**
 * YearPicker — replaces year dropdown with a free-form year picker.
 * Allows user to pick any year (no hard-coded range).
 *
 * Props:
 *  - value: current year (Number or "")
 *  - onChange: (year) => void   — receives Number or "" for "All Years"
 *  - placeholder: string (default "All Years")
 *  - allowAll: boolean — show "All Years" option (default true)
 *  - className: extra container classes
 *  - style: inline styles on container
 *  - inputClassName: class for the trigger button
 */
const YearPicker = ({
  value,
  onChange,
  placeholder = "All Years",
  allowAll = true,
  className = "",
  style = {},
  inputClassName = "",
  popupAlign = "left",
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const currentYear = new Date().getFullYear();
  const [decadeStart, setDecadeStart] = useState(() => {
    const base = value ? Number(value) : currentYear;
    return Math.floor(base / 10) * 10;
  });

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const years = Array.from({ length: 12 }, (_, i) => decadeStart - 1 + i);

  const handleSelect = (yr) => {
    onChange(yr);
    setOpen(false);
  };

  const handleAllYears = () => {
    onChange("");
    setOpen(false);
  };

  const baseInputCls =
    "h-[40px] px-3 py-2 border border-gray-300 rounded-xl text-sm bg-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap select-none";

  return (
    <div ref={ref} className={`relative ${className}`} style={style}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={inputClassName || baseInputCls}
        style={!value ? { color: "var(--placeholder-text, #9ca3af)" } : {}}
      >
        <Calendar size={14} className="text-gray-400 flex-shrink-0" />
        <span>{value ? value : placeholder}</span>
      </button>

      {open && (
        <div
          className={`absolute top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-[260px] max-w-[calc(100vw-2rem)] animate-in fade-in-0 zoom-in-95 ${popupAlign === "right" ? "right-0" : "left-0"}`}
        >
          {/* Header with decade nav */}
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => setDecadeStart((d) => d - 10)}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft size={16} className="text-gray-500" />
            </button>
            <span className="text-sm font-semibold text-gray-700">
              {decadeStart} — {decadeStart + 9}
            </span>
            <button
              type="button"
              onClick={() => setDecadeStart((d) => d + 10)}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight size={16} className="text-gray-500" />
            </button>
          </div>

          {/* Year grid */}
          <div className="grid grid-cols-3 gap-1.5">
            {years.map((yr) => {
              const isSelected = value && Number(value) === yr;
              const isCurrent = yr === currentYear;
              const isOutOfDecade = yr < decadeStart || yr > decadeStart + 9;
              return (
                <button
                  key={yr}
                  type="button"
                  onClick={() => handleSelect(yr)}
                  className={`py-2 px-1 rounded-lg text-sm font-medium transition-all ${
                    isSelected
                      ? "bg-[var(--p-blue)] text-white shadow-sm"
                      : isCurrent
                        ? "bg-blue-50 text-[var(--p-blue)] ring-1 ring-[var(--p-blue)]/30"
                        : isOutOfDecade
                          ? "text-gray-300 hover:bg-gray-50 hover:text-gray-500"
                          : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {yr}
                </button>
              );
            })}
          </div>

          {/* All Years button */}
          {allowAll && (
            <button
              type="button"
              onClick={handleAllYears}
              className={`w-full mt-2 py-2 rounded-lg text-sm font-medium transition-all ${
                !value
                  ? "bg-gray-100 text-gray-800 ring-1 ring-gray-300"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
              }`}
            >
              {placeholder}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default YearPicker;
