import React from "react";

const textCellClass = "px-4 py-3 max-w-0 truncate";
const compactTextCellClass = "px-1.5 py-3 max-w-0 truncate text-center";

/** Name + avatar — flex inside a wrapper, not on <td> (flex on td breaks table-fixed columns). */
export function ReportNameCell({ image, name, alt }) {
  const label = name || "-";
  return (
    <td className={textCellClass}>
      <div className="flex items-center gap-2 min-w-0">
        {image ? (
          <img
            src={image}
            alt={alt || label}
            className="h-8 w-8 shrink-0 rounded-full object-cover"
          />
        ) : null}
        <span className="min-w-0 truncate block" title={label}>
          {label}
        </span>
      </div>
    </td>
  );
}

export function ReportTextCell({ children, title, compact = false }) {
  const value = children ?? "-";
  const text =
    typeof value === "string" || typeof value === "number"
      ? String(value)
      : value;
  const tooltip =
    title ??
    (typeof text === "string" || typeof text === "number" ? String(text) : "");
  return (
    <td
      className={compact ? compactTextCellClass : textCellClass}
      title={tooltip || undefined}
    >
      {value}
    </td>
  );
}
