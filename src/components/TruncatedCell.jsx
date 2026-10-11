/**
 * Table cell content that truncates long text within the column width.
 * Pair with DataTable colWidths + skipDynamicColumnWidths (no wideTable).
 */
export function TruncatedCell({ icon: Icon, children, textClassName = "" }) {
  const label = children == null || children === "" ? "—" : String(children);

  return (
    <div className="flex items-center gap-2 min-w-0 max-w-full">
      {Icon ? (
        <Icon className="w-4 h-4 text-gray-400 shrink-0" aria-hidden="true" />
      ) : null}
      <span
        className={`block min-w-0 flex-1 truncate ${textClassName}`}
        title={label}
      >
        {label}
      </span>
    </div>
  );
}

export const APPOINTMENT_TABLE_COL_WIDTHS = {
  "Appointment ID": "130px",
  Patient: "150px",
  Service: "140px",
  Practitioner: "150px",
  Business: "130px",
  Start: "170px",
  Status: "160px",
  Actions: "110px",
};

export const PRACTITIONER_TABLE_COL_WIDTHS = {
  Practitioner: "160px",
  Business: "150px",
  "Available days": "180px",
  Designation: "140px",
  Description: "200px",
  Status: "110px",
  Actions: "80px",
};
