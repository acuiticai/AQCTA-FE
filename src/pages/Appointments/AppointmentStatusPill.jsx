import { statusPillClass } from "./appointmentHelpers";

/** Compact status pill for table cells — truncates long labels cleanly. */
export function AppointmentStatusPill({ status, icon: Icon }) {
  const label = String(status || "—");

  return (
    <span
      className={`inline-flex items-center gap-1 min-w-0 max-w-full px-2.5 py-1 rounded-full text-xs font-medium leading-tight ${statusPillClass(
        status,
      )}`}
      title={label}
    >
      {Icon ? (
        <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      ) : null}
      <span className="truncate">{label}</span>
    </span>
  );
}
