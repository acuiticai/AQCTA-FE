import React from "react";
import { Link } from "react-router-dom";

/**
 * Clickable cheque number that navigates to `/Cheques/:id`.
 * Use `stopPropagation` on click when rendered inside other clickable rows/cells.
 */
const ChequeNumberLink = ({
  chequeId,
  chequeNumber,
  className = "",
  prefix = "",
  fallback = "—",
  /** When true, keeps parent text color (e.g. calendar events on colored backgrounds). */
  inheritColor = false,
  /** When true, wraps long numbers inside table cells (multi-line, no bleed). */
  wrap = false,
  onClick,
}) => {
  const display = chequeNumber?.trim() ? chequeNumber : fallback;
  const linkColorClass = inheritColor
    ? "text-inherit hover:underline"
    : "text-[var(--p-blue)] hover:underline font-medium";
  const wrapClass = wrap
    ? "block max-w-full whitespace-normal break-all [overflow-wrap:anywhere] leading-snug"
    : "";

  if (!chequeId) {
    return <span className={className}>{prefix}{display}</span>;
  }

  return (
    <Link
      to={`/Cheques/${chequeId}`}
      className={`${linkColorClass} ${wrapClass} ${className}`.trim()}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
    >
      {prefix}{display}
    </Link>
  );
};

export default ChequeNumberLink;
