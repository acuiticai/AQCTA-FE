import React, { useState } from "react";
import { LayoutGrid, RefreshCw, UserPlus } from "lucide-react";
import TableCard from "./TableCard";

const TableMap = ({
  tables,
  floors,
  loading,
  selectedTableId,
  onSelectTable,
  onWalkin,
  onRefresh,
}) => {
  const [activeFloor, setActiveFloor] = useState("All");

  const filteredTables =
    activeFloor === "All"
      ? tables
      : tables.filter((t) => t.floor === activeFloor);

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <LayoutGrid size={16} className="text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-800">Tables</h2>
          <span className="text-xs text-gray-400">
            ({filteredTables.length})
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onRefresh}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title="Refresh tables"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Floor tabs */}
      {floors.length > 1 && (
        <div className="flex gap-1 px-4 py-2 border-b border-gray-100 overflow-x-auto scrollbar-hide">
          {floors.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setActiveFloor(f)}
              className={`
                px-3 py-1 text-xs rounded-full whitespace-nowrap transition-all
                ${
                  activeFloor === f
                    ? "bg-[var(--p-blue)] text-white font-semibold"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }
              `}
            >
              {f}
            </button>
          ))}
        </div>
      )}

      {/* Table grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading && filteredTables.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-[var(--p-blue)] rounded-full animate-spin" />
          </div>
        ) : filteredTables.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
            <LayoutGrid size={32} />
            <p className="text-sm">No tables found</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 xl:grid-cols-4 gap-2">
            {filteredTables.map((table) => (
              <TableCard
                key={table._id}
                table={table}
                isSelected={selectedTableId === table._id}
                onSelect={onSelectTable}
                uniformShape
              />
            ))}
          </div>
        )}
      </div>

      {/* Walk-in button */}
      {onWalkin && (
        <div className="px-3 pb-2">
          <button
            type="button"
            onClick={onWalkin}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-[var(--p-blue)] bg-[var(--p-blue)]/5 hover:bg-[var(--p-blue)]/10 border border-dashed border-[var(--p-blue)]/30 rounded-lg transition-colors"
          >
            <UserPlus size={13} />
            Walk-in Order (no table)
          </button>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-3 px-4 py-2 border-t border-gray-100 bg-gray-50/50">
        <span className="flex items-center gap-1 text-[10px] text-gray-500">
          <span className="w-2.5 h-2.5 rounded-sm bg-gray-200 border border-gray-300" />{" "}
          Free
        </span>
        <span className="flex items-center gap-1 text-[10px] text-gray-500">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-100 border border-amber-400" />{" "}
          Occupied
        </span>
        <span className="flex items-center gap-1 text-[10px] text-gray-500">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-100 border border-emerald-500" />{" "}
          Selected
        </span>
        <span className="flex items-center gap-1 text-[10px] text-gray-500">
          <span className="w-2.5 h-2.5 rounded-sm bg-red-100 border border-red-400" />{" "}
          Reserved
        </span>
      </div>
    </div>
  );
};

export default React.memo(TableMap);
