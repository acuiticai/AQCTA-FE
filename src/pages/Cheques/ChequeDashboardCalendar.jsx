import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Calendar as BigCalendar, momentLocalizer } from "react-big-calendar";
import moment from "moment";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { formatAmount } from "@/components/formatAmount";
import ChequeNumberLink from "@/components/cheques/ChequeNumberLink";
import { notifyError } from "@/utils/toast";
import { makeChequeT, translateChequeStatus } from "@/utils/chequeI18n";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
const localizer = momentLocalizer(moment);

const STATUS_STYLES = {
  Draft: { backgroundColor: "#64748b", borderColor: "#475569" },
  Issued: { backgroundColor: "#3b82f6", borderColor: "#2563eb" },
  "Due Soon": { backgroundColor: "#f59e0b", borderColor: "#d97706" },
  Cleared: { backgroundColor: "#10b981", borderColor: "#059669" },
  Bounced: { backgroundColor: "#ef4444", borderColor: "#dc2626" },
  Cancelled: { backgroundColor: "#9ca3af", borderColor: "#6b7280" },
  Replaced: { backgroundColor: "#8b5cf6", borderColor: "#7c3aed" },
};

const VIEW_OPTIONS = [
  { key: "day", labelKey: "viewDay", defaultValue: "Day" },
  { key: "week", labelKey: "viewWeek", defaultValue: "Week" },
  { key: "month", labelKey: "viewMonth", defaultValue: "Month" },
];

function rangeForView(date, view) {
  const m = moment(date);
  if (view === "day") {
    return {
      start: m.clone().startOf("day").toDate(),
      end: m.clone().endOf("day").toDate(),
    };
  }
  if (view === "week") {
    return {
      start: m.clone().startOf("week").toDate(),
      end: m.clone().endOf("week").toDate(),
    };
  }
  return {
    start: m.clone().startOf("month").subtract(7, "days").toDate(),
    end: m.clone().endOf("month").add(7, "days").toDate(),
  };
}

function chequesToEvents(cheques) {
  return (cheques || [])
    .filter((c) => c.dueDate)
    .map((c) => {
      const start = moment(c.dueDate).startOf("day");
      const end = start.clone().add(1, "day");
      return {
        id: c._id,
        title: calendarEventTitle(c),
        start: start.toDate(),
        end: end.toDate(),
        allDay: true,
        resource: c,
      };
    });
}

function formatEventAmount(c) {
  const amt = formatAmount(c?.amount || 0);
  const cur = c?.currency ? ` ${c.currency}` : "";
  return `${amt}${cur}`.trim();
}

function calendarEventTitle(c) {
  if (!c) return "";
  const vendor = c.vendorDisplay || "—";
  const num = c.chequeNumber || "—";
  const bank = c.bankAccountLabel || "—";
  return `${vendor} | ${num} | ${formatEventAmount(c)} | ${bank}`;
}

function eventStyleGetter(event, view) {
  const status = event.resource?.status || "Draft";
  const colors = STATUS_STYLES[status] || STATUS_STYLES.Draft;
  const isMonth = view === "month";
  return {
    style: {
      ...colors,
      color: "#fff",
      borderRadius: "8px",
      border: `1px solid ${colors.borderColor}`,
      fontSize: isMonth ? "10px" : "11px",
      fontWeight: 500,
      padding: isMonth ? "4px 5px" : "6px 8px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
      height: "auto",
      minHeight: isMonth ? "4.25rem" : "5.5rem",
      lineHeight: 1.25,
      overflow: "visible",
      whiteSpace: "normal",
    },
  };
}

/** SRS: each entry shows vendor, cheque #, amount, bank account */
function CalendarEventContent({ event, view }) {
  const { t } = useTranslation();
  const cq = makeChequeT(t);
  const c = event.resource;
  if (!c) return <span>{event.title}</span>;

  const vendor = c.vendorDisplay || "—";
  const chequeNumber = c.chequeNumber || "—";
  const amount = formatEventAmount(c);
  const bank = c.bankAccountLabel || "—";
  const compact = view === "month";

  if (compact) {
    return (
      <div
        className="cheque-cal-event cheque-cal-event--compact"
        title={calendarEventTitle(c)}
      >
        <p className="cheque-cal-event__vendor">{vendor}</p>
        <p className="cheque-cal-event__meta">
          <ChequeNumberLink
            chequeId={c._id}
            chequeNumber={chequeNumber}
            prefix="#"
            inheritColor
            className="cheque-cal-event__tag"
          />
          <span className="cheque-cal-event__sep">·</span>
          <span className="cheque-cal-event__tag">{amount}</span>
        </p>
        <p className="cheque-cal-event__bank">{bank}</p>
      </div>
    );
  }

  return (
    <div className="cheque-cal-event" title={calendarEventTitle(c)}>
      <p className="cheque-cal-event__row">
        <span className="cheque-cal-event__label">
          {cq("dashboard.calendar.labelVendor", "Vendor")}
        </span>
        <span className="cheque-cal-event__value">{vendor}</span>
      </p>
      <p className="cheque-cal-event__row">
        <span className="cheque-cal-event__label">
          {cq("dashboard.calendar.labelCheque", "Cheque")}
        </span>
        <ChequeNumberLink
          chequeId={c._id}
          chequeNumber={chequeNumber}
          inheritColor
          className="cheque-cal-event__value"
        />
      </p>
      <p className="cheque-cal-event__row">
        <span className="cheque-cal-event__label">
          {cq("dashboard.calendar.labelAmount", "Amount")}
        </span>
        <span className="cheque-cal-event__value cheque-cal-event__value--amount">
          {amount}
        </span>
      </p>
      <p className="cheque-cal-event__row">
        <span className="cheque-cal-event__label">
          {cq("dashboard.calendar.labelBank", "Bank")}
        </span>
        <span className="cheque-cal-event__value">{bank}</span>
      </p>
    </div>
  );
}

const ChequeDashboardCalendar = ({
  adminToken,
  businessFilter,
  assignedBusinessIds,
  checkTokenExpired,
  onSelectCheque,
}) => {
  const { t } = useTranslation();
  const cq = makeChequeT(t);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState("month");
  const [cheques, setCheques] = useState([]);
  const [loading, setLoading] = useState(false);

  const buildParams = useCallback(() => {
    const params = {};
    if (businessFilter && String(businessFilter).trim()) {
      params.business_id = businessFilter;
    } else if (assignedBusinessIds?.length) {
      params.business_ids = assignedBusinessIds.join(",");
    }
    return params;
  }, [businessFilter, assignedBusinessIds]);

  const fetchCalendar = useCallback(
    async (rangeStart, rangeEnd) => {
      if (!adminToken) return;
      const base = buildParams();
      if (!base.business_id && !base.business_ids) return;

      try {
        setLoading(true);
        const response = await axios.get(`${Base_URL}/cheques/calendar`, {
          params: {
            ...base,
            from: moment(rangeStart).format("YYYY-MM-DD"),
            to: moment(rangeEnd).format("YYYY-MM-DD"),
          },
          headers: {
            "Content-Type": "application/json",
            authorization: `Bearer ${adminToken}`,
          },
          withCredentials: true,
        });
        if (checkTokenExpired?.(response)) return;
        setCheques(response.data?.data || []);
      } catch (e) {
        console.error(e);
        notifyError(
          e.response?.data?.error ||
            t("accounts.cheques.dashboard.calendar.errors.loadFailed", {
              defaultValue: "Failed to load calendar",
            }),
        );
        setCheques([]);
      } finally {
        setLoading(false);
      }
    },
    [adminToken, buildParams, checkTokenExpired, t],
  );

  useEffect(() => {
    const { start, end } = rangeForView(currentDate, currentView);
    fetchCalendar(start, end);
  }, [currentDate, currentView, fetchCalendar]);

  const events = useMemo(() => chequesToEvents(cheques), [cheques]);

  const handleNavigate = (date) => setCurrentDate(date);

  const handleViewChange = (view) => setCurrentView(view);

  const handleRangeChange = (range, view) => {
    let start;
    let end;
    if (Array.isArray(range)) {
      start = range[0];
      end = range[range.length - 1];
    } else if (range?.start && range?.end) {
      start = range.start;
      end = range.end;
    } else {
      const r = rangeForView(currentDate, view || currentView);
      start = r.start;
      end = r.end;
    }
    fetchCalendar(start, end);
  };

  const goToday = () => setCurrentDate(new Date());
  const goPrev = () => {
    const unit = currentView === "day" ? "day" : currentView === "week" ? "week" : "month";
    setCurrentDate(moment(currentDate).subtract(1, unit).toDate());
  };
  const goNext = () => {
    const unit = currentView === "day" ? "day" : currentView === "week" ? "week" : "month";
    setCurrentDate(moment(currentDate).add(1, unit).toDate());
  };

  const headerLabel =
    currentView === "day"
      ? moment(currentDate).format("dddd, MMMM D, YYYY")
      : currentView === "week"
        ? cq("dashboard.calendar.weekOf", "Week of {{date}}", {
            date: moment(currentDate).format("MMM D, YYYY"),
          })
        : moment(currentDate).format("MMMM YYYY");

  return (
    <section className="rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900 ring-1 ring-slate-900/5 overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-slate-100 px-4 py-4 sm:px-5 sm:flex-row sm:items-center sm:justify-between dark:border-gray-700 bg-slate-50/60 dark:bg-gray-800/40">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900 dark:text-gray-100">
            {cq("dashboard.calendar.title", "Cheque due calendar")}
          </h2>
          <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
            {cq(
              "dashboard.calendar.subtitle",
              "Each entry shows vendor, cheque number, amount & bank · Click to open details",
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5 dark:border-gray-600 dark:bg-gray-900">
            {VIEW_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setCurrentView(opt.key)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  currentView === opt.key
                    ? "bg-[var(--p-blue)] text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-50 dark:text-gray-300 dark:hover:bg-gray-800"
                }`}
              >
                {cq(`dashboard.calendar.${opt.labelKey}`, opt.defaultValue)}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white dark:border-gray-600 dark:bg-gray-900">
            <button
              type="button"
              onClick={goPrev}
              className="p-2 text-slate-600 hover:bg-slate-50 rounded-l-xl dark:text-gray-300 dark:hover:bg-gray-800"
              aria-label={cq("dashboard.calendar.previous", "Previous")}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={goToday}
              className="px-2.5 py-1.5 text-xs font-semibold text-[var(--p-blue)] hover:bg-blue-50 dark:hover:bg-blue-950/40"
            >
              {cq("dashboard.calendar.today", "Today")}
            </button>
            <button
              type="button"
              onClick={goNext}
              className="p-2 text-slate-600 hover:bg-slate-50 rounded-r-xl dark:text-gray-300 dark:hover:bg-gray-800"
              aria-label={cq("dashboard.calendar.next", "Next")}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <p className="px-5 pt-3 text-sm font-medium text-slate-700 dark:text-gray-300">{headerLabel}</p>

      {/* Status legend */}
      <div className="flex flex-wrap gap-2 px-5 pb-3">
        {Object.entries(STATUS_STYLES).map(([status, colors]) => (
          <span
            key={status}
            className="inline-flex items-center gap-1.5 text-[10px] font-medium text-slate-600 dark:text-gray-400"
          >
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: colors.backgroundColor }}
            />
            {translateChequeStatus(t, status)}
          </span>
        ))}
      </div>

      <div className="relative px-2 pb-4 sm:px-4 cheque-dashboard-calendar">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 dark:bg-gray-900/70 rounded-b-2xl">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--p-blue)]" />
          </div>
        )}
        <BigCalendar
          localizer={localizer}
          events={events}
          view={currentView}
          date={currentDate}
          onNavigate={handleNavigate}
          onView={handleViewChange}
          onRangeChange={handleRangeChange}
          onSelectEvent={(ev) => onSelectCheque?.(ev.id)}
          eventPropGetter={(event) => eventStyleGetter(event, currentView)}
          components={{
            event: (props) => <CalendarEventContent {...props} view={currentView} />,
          }}
          tooltipAccessor={(ev) => {
            const c = ev.resource;
            if (!c) return ev.title;
            return [
              cq("dashboard.calendar.tooltipVendor", "Vendor: {{value}}", {
                value: c.vendorDisplay || "—",
              }),
              cq("dashboard.calendar.tooltipCheque", "Cheque: {{value}}", {
                value: c.chequeNumber || "—",
              }),
              cq("dashboard.calendar.tooltipAmount", "Amount: {{value}}", {
                value: formatEventAmount(c),
              }),
              cq("dashboard.calendar.tooltipBank", "Bank: {{value}}", {
                value: c.bankAccountLabel || "—",
              }),
              cq("dashboard.calendar.tooltipStatus", "Status: {{value}}", {
                value: translateChequeStatus(t, c.status),
              }),
            ].join("\n");
          }}
          popup
          selectable={false}
          style={{ height: 560 }}
          views={["month", "week", "day"]}
          toolbar={false}
        />
      </div>

      <style>{`
        .cheque-dashboard-calendar .rbc-calendar {
          font-family: inherit;
        }
        .cheque-dashboard-calendar .rbc-header {
          padding: 10px 4px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #64748b;
          border-color: #e2e8f0;
        }
        .cheque-dashboard-calendar .rbc-month-view,
        .cheque-dashboard-calendar .rbc-time-view {
          border-color: #e2e8f0;
          border-radius: 12px;
          overflow: hidden;
        }
        .cheque-dashboard-calendar .rbc-day-bg + .rbc-day-bg,
        .cheque-dashboard-calendar .rbc-month-row + .rbc-month-row {
          border-color: #f1f5f9;
        }
        .cheque-dashboard-calendar .rbc-off-range-bg {
          background: #f8fafc;
        }
        .cheque-dashboard-calendar .rbc-today {
          background: rgba(59, 130, 246, 0.06);
        }
        .cheque-dashboard-calendar .rbc-event {
          cursor: pointer;
          height: auto !important;
        }
        .cheque-dashboard-calendar .rbc-event-content {
          height: auto !important;
          overflow: visible !important;
          white-space: normal !important;
          line-height: 1.25;
        }
        .cheque-dashboard-calendar .rbc-event-label {
          display: none;
        }
        .cheque-dashboard-calendar .rbc-event:focus {
          outline: 2px solid var(--p-blue);
          outline-offset: 1px;
        }
        .cheque-dashboard-calendar .rbc-show-more {
          color: var(--p-blue);
          font-weight: 600;
          font-size: 11px;
        }
        .cheque-dashboard-calendar .rbc-overlay {
          max-width: 320px;
          padding: 8px;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.15);
        }
        .cheque-dashboard-calendar .rbc-overlay .rbc-event {
          min-height: 5.5rem !important;
          margin-bottom: 6px;
        }
        .cheque-cal-event {
          display: flex;
          flex-direction: column;
          gap: 2px;
          width: 100%;
          text-align: left;
        }
        .cheque-cal-event--compact {
          gap: 1px;
        }
        .cheque-cal-event__vendor {
          font-weight: 700;
          font-size: 10px;
          line-height: 1.2;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          margin: 0;
        }
        .cheque-cal-event__meta {
          margin: 0;
          font-size: 9px;
          line-height: 1.2;
          opacity: 0.95;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 2px;
        }
        .cheque-cal-event__bank {
          margin: 0;
          font-size: 9px;
          line-height: 1.2;
          opacity: 0.9;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .cheque-cal-event__sep {
          opacity: 0.7;
        }
        .cheque-cal-event__row {
          margin: 0;
          display: flex;
          gap: 6px;
          align-items: flex-start;
          line-height: 1.3;
        }
        .cheque-cal-event__label {
          flex-shrink: 0;
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          opacity: 0.85;
          min-width: 2.75rem;
        }
        .cheque-cal-event__value {
          flex: 1;
          font-size: 10px;
          font-weight: 600;
          word-break: break-word;
        }
        .cheque-cal-event__value--amount {
          font-weight: 700;
        }
      `}</style>
    </section>
  );
};

export default ChequeDashboardCalendar;
