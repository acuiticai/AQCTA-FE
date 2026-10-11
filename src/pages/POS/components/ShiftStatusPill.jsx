import React from "react";
import { PlayCircle, Clock } from "lucide-react";

// Pill shown in the table bar: prompts staff to start a shift, or shows the
// active shift and opens the End Shift flow when clicked.
const ShiftStatusPill = ({ activeShift, loading, onClick }) => {
  if (loading) {
    return (
      <span className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-semibold text-gray-400 bg-gray-50 border border-gray-100 rounded-lg">
        <Clock size={13} className="animate-pulse" />
        <span className="hidden sm:inline">Shift…</span>
      </span>
    );
  }

  if (!activeShift) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-semibold rounded-lg border transition-all duration-150 active:scale-[0.97] bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
        title="Start Shift"
      >
        <PlayCircle size={13} />
        <span className="hidden sm:inline">Start Shift</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-semibold rounded-lg border transition-all duration-150 active:scale-[0.97] bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
      title="End Shift"
    >
      <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
      <span className="hidden sm:inline">
        Shift {activeShift.shiftNo} · {activeShift.shiftSnapshot?.name || ""}
      </span>
      <span className="sm:hidden">Shift {activeShift.shiftNo}</span>
    </button>
  );
};

export default React.memo(ShiftStatusPill);
