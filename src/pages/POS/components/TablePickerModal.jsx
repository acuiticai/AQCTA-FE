import React, { useMemo, useState } from "react";
import { X, Search, LayoutGrid, Users } from "lucide-react";
import TableCard from "./TableCard";

const TablePickerModal = ({
  isOpen,
  onClose,
  tables = [],
  floors = [],
  selectedTableId,
  onSelectTable,
}) => {
  const [activeFloor, setActiveFloor] = useState("All");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const floorList = useMemo(
    () => (Array.isArray(floors) && floors.length ? floors : ["All"]),
    [floors]
  );

  const filtered = useMemo(() => {
    let list = tables;
    if (activeFloor !== "All") list = list.filter((t) => t.floor === activeFloor);
    if (statusFilter !== "all")
      list = list.filter((t) => t.status === statusFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) =>
          String(t.tableNumber).toLowerCase().includes(q) ||
          (t.label || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [tables, activeFloor, statusFilter, search]);

  const counts = useMemo(() => {
    const c = { total: tables.length, available: 0, occupied: 0, reserved: 0 };
    tables.forEach((t) => {
      if (c[t.status] !== undefined) c[t.status] += 1;
    });
    return c;
  }, [tables]);

  if (!isOpen) return null;

  const handleSelect = (table) => {
    onSelectTable?.(table);
    onClose?.();
  };

  const STATUS_TABS = [
    { key: "all", label: `All (${counts.total})`, color: "gray" },
    {
      key: "available",
      label: `Free (${counts.available})`,
      color: "gray",
    },
    {
      key: "occupied",
      label: `Occupied (${counts.occupied})`,
      color: "amber",
    },
    {
      key: "reserved",
      label: `Reserved (${counts.reserved})`,
      color: "red",
    },
  ];

  return (
    <div className="fixed inset-0 z-[105] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-4xl mx-4 max-h-[88vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[var(--p-blue)]/10 text-[var(--p-blue)]">
              <LayoutGrid size={14} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">All Tables</h3>
              <p className="text-[11px] text-gray-400">
                Select a table to open an order
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Filters */}
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/40 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={`
                  px-3 h-7 text-[11px] font-semibold rounded-full transition-all
                  ${
                    statusFilter === tab.key
                      ? "bg-[var(--p-blue)] text-white shadow-sm"
                      : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-100"
                  }
                `}
              >
                {tab.label}
              </button>
            ))}

            <div className="relative ml-auto w-full sm:w-56">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search table…"
                className="w-full h-9 pl-8 pr-3 text-[12px] bg-gray-50 outline-none border-2 border-gray-200 rounded-xl focus:border-[var(--p-blue)] focus:bg-white transition-all"
              />
            </div>
          </div>

          {floorList.length > 1 && (
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
              {floorList.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setActiveFloor(f)}
                  className={`
                    px-2.5 h-7 text-[11px] font-semibold rounded-md whitespace-nowrap transition-all
                    ${
                      activeFloor === f
                        ? "bg-gray-800 text-white"
                        : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-100"
                    }
                  `}
                >
                  {f}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-gray-400 gap-2">
              <Users size={28} />
              <p className="text-xs">No tables match your filters</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5">
              {filtered.map((t) => (
                <TableCard
                  key={t._id}
                  table={t}
                  isSelected={selectedTableId === t._id}
                  onSelect={handleSelect}
                  uniformShape
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(TablePickerModal);
