import React, { useState, useRef, useEffect, useCallback } from "react";
import { User, Search, X, ChevronDown, UserCheck } from "lucide-react";

const CustomerSelector = ({
  customer,
  customers,
  loading,
  onSearch,
  onSelect,
  onClear,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const ref = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      onSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, isOpen]);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    setSearchTerm("");
    onSearch("");
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [onSearch]);

  const handleSelect = useCallback(
    (c) => {
      onSelect(c._id);
      setIsOpen(false);
      setSearchTerm("");
    },
    [onSelect]
  );

  const getDisplayName = (c) => {
    if (!c) return null;
    return (
      c.basicInformation?.customerDisplayName ||
      c.basicInformation?.primaryContact?.firstName ||
      "Customer"
    );
  };

  const getPhone = (c) => {
    return (
      c.basicInformation?.customerPhone?.mobile ||
      c.basicInformation?.customerPhone?.workPhone ||
      ""
    );
  };

  const selectedName = customer ? getDisplayName(customer) : null;

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={handleOpen}
        className={`
          w-full flex items-center gap-2 h-10 px-3
          bg-gray-50 rounded-xl border transition-all text-left
          focus:outline-none
          ${selectedName
            ? "border-[var(--p-blue)]/40 bg-[var(--p-blue)]/[0.03] hover:border-[var(--p-blue)]/60"
            : "border-gray-200 hover:border-gray-300 hover:bg-gray-100"
          }
        `}
      >
        {selectedName ? (
          <div className="w-6 h-6 rounded-full bg-[var(--p-blue)] text-white flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold">{selectedName[0].toUpperCase()}</span>
          </div>
        ) : (
          <User size={14} className="text-gray-400 shrink-0" />
        )}
        {selectedName ? (
          <span className="flex-1 text-[12px] font-semibold text-gray-800 truncate">
            {selectedName}
          </span>
        ) : (
          <span className="flex-1 text-[12px] text-gray-400">Walk-in Customer</span>
        )}
        {selectedName ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className="w-5 h-5 rounded-full bg-gray-200 hover:bg-red-100 hover:text-red-500 flex items-center justify-center transition-colors shrink-0"
          >
            <X size={10} />
          </button>
        ) : (
          <ChevronDown size={12} className="text-gray-400 shrink-0" />
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-xl border border-gray-200 shadow-2xl z-50 overflow-hidden animate-slideDown">
          {/* Search input */}
          <div className="p-2.5 border-b border-gray-100">
            <div className="relative">
              <Search
                size={12}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name or phone..."
                className="w-full h-8 pl-7 pr-2.5 text-[11px] bg-gray-50 rounded-lg outline-none border-2 border-gray-200 focus:border-[var(--p-blue)] focus:bg-white transition-all placeholder:text-gray-300"
              />
            </div>
          </div>

          {/* Results */}
          <div className="max-h-52 overflow-y-auto">
            {/* Walk-in option */}
            <button
              type="button"
              onClick={() => {
                onClear();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                <User size={12} className="text-gray-400" />
              </div>
              <div>
                <p className="text-[12px] font-medium text-gray-600">Walk-in Customer</p>
                <p className="text-[10px] text-gray-400">No customer selected</p>
              </div>
            </button>

            {loading ? (
              <div className="px-3 py-6 text-center">
                <div className="w-5 h-5 mx-auto border-2 border-gray-200 border-t-[var(--p-blue)] rounded-full animate-spin" />
              </div>
            ) : customers.length === 0 && searchTerm ? (
              <div className="px-3 py-6 text-center">
                <UserCheck size={20} className="text-gray-300 mx-auto mb-2" />
                <p className="text-[11px] text-gray-400">No customers found</p>
              </div>
            ) : (
              customers.map((c) => (
                <button
                  key={c._id}
                  type="button"
                  onClick={() => handleSelect(c)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-[var(--p-blue)]/[0.04] transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-[var(--p-blue)]/10 text-[var(--p-blue)] flex items-center justify-center shrink-0 ring-1 ring-[var(--p-blue)]/20">
                    <span className="text-[11px] font-bold">
                      {(getDisplayName(c) || "?")[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-semibold text-gray-800 truncate">
                      {getDisplayName(c)}
                    </p>
                    {getPhone(c) && (
                      <p className="text-[10px] text-gray-400 truncate">
                        {getPhone(c)}
                      </p>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(CustomerSelector);
