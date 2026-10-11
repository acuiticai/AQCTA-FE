import React, { useEffect, useState } from "react";
import { Percent } from "lucide-react";

const DiscountControl = ({ discountType, discountValue, subtotal, onChange }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(String(discountValue || ""));

  useEffect(() => {
    if (!isEditing) {
      setLocalValue(String(discountValue || ""));
    }
  }, [discountValue, isEditing]);

  const discountAmount =
    discountType === "percentage"
      ? Math.round((subtotal || 0) * ((discountValue || 0) / 100) * 100) / 100
      : Math.min(discountValue || 0, subtotal || 0);

  const handleTypeChange = (e) => {
    const newType = e.target.value;
    onChange(newType, Number(localValue) || 0);
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setLocalValue(value);
    const val = Number(value);
    onChange(discountType, Number.isFinite(val) ? val : 0);
  };

  const handleBlur = () => {
    setIsEditing(false);
    const val = Number(localValue) || 0;
    onChange(discountType, val);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.target.blur();
    }
  };

  if (!isEditing && discountAmount === 0) {
    return (
      <div className="flex items-center justify-between text-xs text-gray-500">
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="hover:text-[var(--p-blue)] transition-colors underline-offset-2 hover:underline"
        >
          + Add Discount
        </button>
        <span>RM 0.00</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between text-xs">
      <div className="flex items-center gap-1.5">
        <span className="text-gray-600">Discount</span>
        <div className="relative">
          <select
            value={discountType === "fixed" ? "fixed" : "percentage"}
            onChange={handleTypeChange}
            className="h-6 px-1.5 pr-5 text-[10px] font-semibold bg-gray-100 border border-gray-200 rounded focus:border-[var(--p-blue)] focus:outline-none appearance-none"
          >
            <option value="percentage">%</option>
            <option value="fixed">RM</option>
          </select>
          {discountType === "percentage" ? (
            <Percent
              size={10}
              className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
            />
          ) : (
            <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] text-gray-500 font-semibold pointer-events-none">
              RM
            </span>
          )}
        </div>
        <input
          type="number"
          value={isEditing ? localValue : discountValue || ""}
          onChange={handleInputChange}
          onFocus={() => {
            setIsEditing(true);
            setLocalValue(String(discountValue || ""));
          }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder="0"
          min="0"
          max={discountType === "percentage" ? 100 : undefined}
          className="w-14 h-5 text-[11px] text-center bg-gray-50 rounded border border-gray-200 focus:border-[var(--p-blue)] focus:outline-none"
        />
        {discountType === "percentage" && <span className="text-gray-400">%</span>}
      </div>
      <span className="font-medium text-red-500">-RM {discountAmount.toFixed(2)}</span>
    </div>
  );
};

export default React.memo(DiscountControl);
