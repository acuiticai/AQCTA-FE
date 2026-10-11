import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useHistory, useLocation } from "react-router-dom";
import axios from "axios";
import {
  Receipt,
  Building,
  CalendarCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  GripVertical,
  Mail,
  Loader2,
  Map as MapIcon,
  PanelRight,
  Printer,
  RefreshCw,
  Search,
  Thermometer,
  Truck,
  User,
  X,
} from "lucide-react";
import { notifyError, notifySuccess } from "@/utils/toast";
import { AdminContext } from "@/context/AdminContext";
import FleetManagementServices from "@/services/FleetManagementServices";
import SalesOrderServices from "@/services/SalesOrderServices";
import CreateJobFromScheduleModal from "./CreateJobFromScheduleModal.jsx";
import ScheduleTechniciansModal from "./ScheduleTechniciansModal.jsx";
import DispatchAppointmentNotes from "./DispatchAppointmentNotes.jsx";
import SchedulingDispatchEmailModal from "./SchedulingDispatchEmailModal.jsx";
import {
  DEFAULT_FLEET_TERMINOLOGY,
  normalizeFleetTerminology,
} from "@/utils/fleetTerminology";
import { downloadWorkOrderPdf } from "@/utils/workOrderPdf";
import {
  billingDocIdPrefix,
  jobBillingDocumentTitle,
  jobBillingDocumentTitleLower,
  shouldRouteRecordPaymentViaInvoice,
} from "@/utils/fleetJobBillingLabels";
import { getModuleRoutePath } from "@/utils/moduleLabels";
import {
  computeFleetJobLineSummary,
  fleetJobLineItemDetailSubtitle,
  fleetJobLineItemLabel,
  fleetJobLineUnitRate,
} from "@/utils/fleetJobLineDisplay";
import { isSingleAssignedBusiness } from "@/utils/sessionAssignedBusinesses";

const JOB_HOVER_W = 340;
const JOB_HOVER_H = 280;
/** Time labels + corner stay fixed; week/resource columns flex to fill width */
const TIME_GUTTER_WIDTH_PX = 42;

/**
 * Minimum width for each fleet/vehicle lane. Many fleets share one day column; without this the UI squeezes
 * everything into one narrow strip — horizontal scroll on the board keeps lanes readable.
 */
const VEHICLE_LANE_MIN_PX = 100;
/** Day column must be at least wide enough for the date header and all vehicle lanes. */
const WEEK_DAY_HEADER_MIN_PX = 112;

/** Week grid column when there are no vehicles — keeps business hours / working days visible */
const SCHEDULE_BOARD_PLACEHOLDER_VEHICLE_ID = "__schedule_board_no_vehicles__";

/** Last successful schedule fetch params — used to skip the "Updating schedule…" overlay on same-params refetch (e.g. after closing work order overlay). */
const SCHEDULE_LAST_LOAD_KEY = "flexa-sch-lpk";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

function schedulingSelectedBusinessStorageKey(adminId) {
  return adminId ? `flexa-scheduling-business:${adminId}` : null;
}

function jobMatchesBusinessFilter(job, selectedBusinessId, assignedBusinesses) {
  if (!assignedBusinesses?.length) return true;
  const bid = job?.businessId?._id || job?.businessId;
  if (selectedBusinessId) {
    return String(bid || "") === String(selectedBusinessId);
  }
  if (!bid) return true;
  const allowed = new Set(assignedBusinesses.map((b) => String(b._id)));
  return allowed.has(String(bid));
}

/** Hide cancelled work from the board, queues, and month summaries. */
function isJobDocumentCancelled(job) {
  if (!job || typeof job !== "object") return false;
  return String(job.status || "").toLowerCase() === "cancelled";
}

function isJobOrAssignmentCancelled(assignment) {
  if (String(assignment?.status || "").toLowerCase() === "cancelled") return true;
  const j = assignment?.jobId;
  if (j && typeof j === "object") return isJobDocumentCancelled(j);
  return false;
}

/** “Scheduled” sidebar tab: all assignments on a route/day except waiting (which has its own tab). */
function isRoutedForScheduledSidebar(assignment) {
  const s = String(assignment?.status || "").toLowerCase();
  return s !== "waiting" && s !== "cancelled";
}

const DEFAULT_SCHEDULE_SETTINGS = {
  businessStartHour: 6,
  businessEndHour: 20,
  slotIntervalMinutes: 30,
  workingDays: [1, 2, 3, 4, 5, 6],
  dispatchAddress: "",
  dispatchLatitude: "",
  dispatchLongitude: "",
};

function normalizeScheduleSettings(data) {
  if (!data) return { ...DEFAULT_SCHEDULE_SETTINGS };
  const wd = Array.isArray(data.workingDays) && data.workingDays.length
    ? [...new Set(data.workingDays.map((d) => Number(d)).filter((d) => d >= 0 && d <= 6))]
    : DEFAULT_SCHEDULE_SETTINGS.workingDays;
  return {
    businessStartHour: Number(data.businessStartHour) || DEFAULT_SCHEDULE_SETTINGS.businessStartHour,
    businessEndHour: Number(data.businessEndHour) || DEFAULT_SCHEDULE_SETTINGS.businessEndHour,
    slotIntervalMinutes: [15, 30].includes(Number(data.slotIntervalMinutes))
      ? Number(data.slotIntervalMinutes)
      : DEFAULT_SCHEDULE_SETTINGS.slotIntervalMinutes,
    workingDays: wd.length ? wd : DEFAULT_SCHEDULE_SETTINGS.workingDays,
    dispatchAddress: data.dispatchAddress ?? "",
    dispatchLatitude: data.dispatchLatitude ?? "",
    dispatchLongitude: data.dispatchLongitude ?? "",
  };
}

const statusOptions = ["scheduled", "confirmed", "waiting", "in_progress", "completed", "cancelled"];

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toYMD(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Monday 00:00 of the week containing `anchor` */
function getMonday(anchor) {
  const d = new Date(anchor + "T12:00:00");
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Sun-start grid for `year` / `monthIndex` (0–11). Uses 5–6 weeks; drops a trailing week when it is only “next month” filler. */
function buildMonthCalendarCells(year, monthIndex) {
  const first = new Date(year, monthIndex, 1);
  const start = new Date(year, monthIndex, 1 - first.getDay());
  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push({
      ymd: toYMD(d),
      date: d,
      inMonth: d.getMonth() === monthIndex,
      dow: d.getDay(),
    });
  }
  while (cells.length > 7) {
    const tail = cells.slice(-7);
    if (tail.every((c) => !c.inMonth)) {
      cells.splice(-7, 7);
    } else {
      break;
    }
  }
  return cells;
}

const MONTH_GRID_WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function closedColumnPatternStyle() {
  return {
    backgroundImage: `repeating-linear-gradient(
      -42deg,
      rgba(148, 163, 184, 0.22),
      rgba(148, 163, 184, 0.22) 5px,
      rgba(248, 250, 252, 0.65) 5px,
      rgba(248, 250, 252, 0.65) 10px
    )`,
  };
}

/** Month grid: full-cell diagonal hatch for closed days (in-month vs trailing/leading days). */
function monthClosedDayFullCellStyle(outOfMonth, isToday) {
  const base = isToday ? "#FFF8E0" : outOfMonth ? "#EFEFEF" : "#F5FBFF";
  return {
    backgroundColor: base,
    backgroundImage: `repeating-linear-gradient(
      45deg,
      transparent 0px,
      transparent 5px,
      rgba(148, 163, 184, 0.32) 5px,
      rgba(148, 163, 184, 0.32) 7px
    )`,
  };
}

function timeToMinutes(t) {
  if (!t) return null;
  const [h, m] = String(t).split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function minutesToLabel(mins) {
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const am = h24 < 12;
  let h = h24 % 12;
  if (h === 0) h = 12;
  const suffix = am ? "AM" : "PM";
  return `${h}:${pad2(m)} ${suffix}`;
}

function minutesToLabelLower(mins) {
  return minutesToLabel(mins).replace("AM", "am").replace("PM", "pm");
}

function weekdayLongFromYmd(ymd) {
  const d = new Date(`${ymd}T12:00:00`);
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  return days[d.getDay()] || "";
}

function formatHoverTimeRange(dayYmd, startTime, endTime) {
  const a = timeToMinutes(startTime);
  const b = timeToMinutes(endTime);
  if (a == null || b == null) return "";
  return `${weekdayLongFromYmd(dayYmd)} ${minutesToLabelLower(a)} - ${minutesToLabelLower(b)}`;
}

function workOrderLabel(job) {
  const id = job?._id;
  const prefix = billingDocIdPrefix(job);
  if (!id) return `${prefix}: —`;
  const s = String(id);
  return `${prefix}: ${s.slice(-4).toUpperCase()}`;
}

/** SO / order number for week block (matches reference: e.g. 5005), else last 4 of id */
function workOrderNumberDisplay(job) {
  if (!job) return "—";
  const n = job.workOrderNumber ?? job.salesOrderNumber ?? job.orderNumber;
  if (n != null && String(n).trim() !== "") return String(n).trim();
  const id = job._id;
  if (!id) return "—";
  return String(id).replace(/[^a-f0-9]/gi, "").slice(-4).toUpperCase();
}

function formatWeekBlockTimeRange(startTime, endTime) {
  const a = timeToMinutes(startTime);
  const b = timeToMinutes(endTime);
  if (a == null || b == null) return "—";
  return `${minutesToLabel(a)} - ${minutesToLabel(b)}`;
}

const SCHEDULE_APPOINTMENT_TYPE_OPTIONS = [
  { value: "work", label: "Work" },
  { value: "estimate", label: "Estimate" },
  { value: "rework", label: "Rework" },
  { value: "other", label: "Other" },
  { value: "drop_off_pickup", label: "Drop off and pickup" },
];

function scheduleAppointmentTypeLabel(raw) {
  const v = String(raw || "").trim().toLowerCase();
  if (!v) return "Work";
  const opt = SCHEDULE_APPOINTMENT_TYPE_OPTIONS.find((o) => o.value === v);
  if (opt) return opt.label;
  return v
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Hover tooltip headline: routed appointment type — not job.title (often "Work order — SO …"). */
function scheduleHoverHeadlineFromAssignment(assignment, job) {
  const fromA =
    assignment && typeof assignment === "object" ? assignment.appointmentType : "";
  const raw =
    String(fromA || "").trim() || String(job?.visitType || "").trim() || "work";
  return scheduleAppointmentTypeLabel(raw);
}

/** Week grid cell first line — appointment type caps (assignment.appointmentType / job.visitType). */
function scheduleBoardAppointmentTypeCaps(assignment, job) {
  const fromA =
    assignment && typeof assignment === "object" ? assignment.appointmentType : "";
  const raw =
    String(fromA || "").trim() || (job ? String(job.visitType || "").trim() : "") || "work";
  return scheduleAppointmentTypeLabel(raw).toUpperCase();
}

function linkedInvoiceIdFromSalesOrder(so) {
  const rawCandidates = [
    so?.linkedInvoiceId,
    ...(Array.isArray(so?.linkedInvoiceIds) ? so.linkedInvoiceIds : []),
    so?.invoiceId,
  ];
  for (const v of rawCandidates) {
    const id = typeof v === "object" && v ? v._id || v.id : v;
    if (id && String(id).trim()) return String(id);
  }
  return "";
}


function categoryFromPriority(job) {
  if (job?.priority === "high") return "Commercial";
  return "Residential";
}

const DEFAULT_SCHEDULE_CURRENCY = "MYR";

function parseFinanceBaseCurrencyCode(base) {
  if (!base) return DEFAULT_SCHEDULE_CURRENCY;
  const name = String(base.name || "").trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(name)) return name;
  const sym = String(base.symbol || "").trim().toUpperCase();
  if (sym === "RM" || sym === "MYR") return "MYR";
  return DEFAULT_SCHEDULE_CURRENCY;
}

function localeForCurrency(currency) {
  return String(currency).toUpperCase() === "MYR" ? "en-MY" : "en-US";
}

/** en-MY defaults to the "RM" symbol; use ISO code so labels match Settings → Currency (MYR). */
function intlCurrencyOptionsForCode(code) {
  const c = String(code || DEFAULT_SCHEDULE_CURRENCY)
    .trim()
    .toUpperCase() || DEFAULT_SCHEDULE_CURRENCY;
  const o = { style: "currency", currency: c };
  if (c === "MYR") o.currencyDisplay = "code";
  return o;
}

function formatMoneyDisplay(n, currency = DEFAULT_SCHEDULE_CURRENCY) {
  const code = String(currency || DEFAULT_SCHEDULE_CURRENCY)
    .trim()
    .toUpperCase() || DEFAULT_SCHEDULE_CURRENCY;
  const x = Number(n);
  const loc = localeForCurrency(code);
  const opts = intlCurrencyOptionsForCode(code);
  if (!Number.isFinite(x)) {
    return new Intl.NumberFormat(loc, opts).format(0);
  }
  return new Intl.NumberFormat(loc, opts).format(x);
}

function jobCurrencyOrFallback(job, scheduleCurrency) {
  const c = job?.currency;
  if (c != null && /^[A-Za-z]{3}$/.test(String(c).trim())) {
    return String(c).trim().toUpperCase();
  }
  return scheduleCurrency;
}

function getJobTotalAmount(job) {
  const preferred = Number(job?.totalAmount ?? job?.grandTotal);
  if (Number.isFinite(preferred) && preferred > 0) return preferred;
  const rows = Array.isArray(job?.lineItems) ? job.lineItems : [];
  const rowsSum = rows.reduce((sum, row) => sum + (Number(row?.amount ?? row?.total) || 0), 0);
  return Number.isFinite(rowsSum) ? rowsSum : 0;
}

/** Balance due if present on job payload (API may add from SO/invoice). */
function getJobBalanceAmount(job) {
  if (!job) return null;
  const bal = Number(job.balanceDue ?? job.balance ?? job.amountDue);
  return Number.isFinite(bal) ? bal : null;
}

/** Line-item table + roll-up totals for schedule sidebars (SO discount/tax-aware). */
function SchedulingJobLineItemsSection({ job, currencyCode, scrollAreaClassName = "" }) {
  const rows = Array.isArray(job?.lineItems) ? job.lineItems : [];
  const cur = jobCurrencyOrFallback(job, currencyCode);
  const summary = computeFleetJobLineSummary(job, rows);
  const bal = getJobBalanceAmount(job);
  const balanceShown = bal != null ? bal : summary.grand;
  const fmt = (n) => formatMoneyDisplay(n, cur);

  return (
    <>
      <div
        className={["px-2 py-1.5 text-[10px] max-h-40 overflow-y-auto", scrollAreaClassName]
          .filter(Boolean)
          .join(" ")}
      >
        {rows.length === 0 ? (
          <div className="text-center text-slate-500 py-2">No line items</div>
        ) : (
          <table className="w-full text-[9px] border-collapse">
            <thead>
              <tr className="text-slate-500 border-b border-slate-200">
                <th className="text-left font-medium py-0.5 pr-1">Item</th>
                <th className="text-right font-medium py-0.5 px-0.5 whitespace-nowrap">Qty</th>
                <th className="text-right font-medium py-0.5 px-0.5 whitespace-nowrap">Rate</th>
                <th className="text-right font-medium py-0.5 pl-1 whitespace-nowrap">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => {
                const label = fleetJobLineItemLabel(r);
                const sub = fleetJobLineItemDetailSubtitle(r, fmt);
                const rate = fleetJobLineUnitRate(r);
                const amt = Number(r.amount ?? r.total) || 0;
                const qty = r.quantity;
                return (
                  <tr key={idx} className="border-b border-slate-100 align-top">
                    <td className="py-0.5 pr-1 break-words max-w-[154px]">
                      <div className="text-slate-900 font-medium">{label}</div>
                      {sub ? (
                        <div className="text-[8px] text-slate-500 font-normal mt-px leading-snug">
                          {sub}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-0.5 text-right tabular-nums whitespace-nowrap align-top">
                      {qty != null && qty !== "" ? qty : "—"}
                    </td>
                    <td className="py-0.5 text-right tabular-nums whitespace-nowrap align-top">
                      {fmt(rate)}
                    </td>
                    <td className="py-0.5 text-right tabular-nums whitespace-nowrap align-top">
                      {fmt(amt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <div className="text-[9px] px-2 py-1.5 space-y-0.5 bg-slate-50 border-t border-slate-100">
        <div className="flex justify-between gap-2">
          <span>Subtotal</span>
          <span className="tabular-nums">{fmt(summary.subtotalExTax)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>Discount</span>
          <span className="tabular-nums">{fmt(summary.discountTotal)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>Tax</span>
          <span className="tabular-nums">{fmt(summary.taxTotal)}</span>
        </div>
        <div className="flex justify-between gap-2 font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{fmt(summary.grand)}</span>
        </div>
        <div className="flex justify-between gap-2 text-emerald-800 font-semibold">
          <span>Balance due</span>
          <span className="tabular-nums">{fmt(balanceShown)}</span>
        </div>
      </div>
    </>
  );
}

/** Total for payment math (prefers stored totals, else line-item sum). */
function getJobTotalForPayment(job) {
  if (!job) return null;
  const preferred = Number(job.totalAmount ?? job.grandTotal);
  if (Number.isFinite(preferred) && preferred > 0) return preferred;
  const fromItems = getJobTotalAmount(job);
  return Number.isFinite(fromItems) && fromItems > 0 ? fromItems : null;
}

function formatJobBalanceDisplay(job, scheduleCurrency = DEFAULT_SCHEDULE_CURRENCY) {
  const bal = getJobBalanceAmount(job);
  if (bal != null) return formatMoneyDisplay(bal, jobCurrencyOrFallback(job, scheduleCurrency));
  return "—";
}

function formatJobTotalDisplay(job, scheduleCurrency = DEFAULT_SCHEDULE_CURRENCY) {
  const t = getJobTotalForPayment(job);
  if (t != null) return formatMoneyDisplay(t, jobCurrencyOrFallback(job, scheduleCurrency));
  return "—";
}

function normalizePaymentStatusLabel(raw) {
  const s = String(raw).trim();
  if (!s) return "—";
  const lower = s.toLowerCase();
  if (lower.includes("partial")) return "Partially paid";
  if (lower === "paid" || lower === "fully paid" || lower === "complete" || lower === "completed") {
    return "Paid";
  }
  if (
    lower.includes("unpaid") ||
    lower === "due" ||
    lower.includes("outstanding") ||
    lower.includes("open")
  ) {
    return "Unpaid";
  }
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** e.g. UTC−8 — negative getTimezoneOffset means ahead of UTC for display math */
function formatLocalUtcOffsetLabel() {
  const offMin = new Date().getTimezoneOffset();
  const hoursFloat = -offMin / 60;
  const sign = hoursFloat >= 0 ? "+" : "−";
  const abs = Math.abs(hoursFloat);
  const h = Math.floor(abs);
  const m = Math.round((abs - h) * 60);
  const mPart = m ? `:${pad2(m)}` : "";
  return `UTC ${sign}${h}${mPart}`;
}

function formatShortDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US");
}

function primaryAddressLine(job) {
  const addrs = job?.customerId?.addresses;
  if (!Array.isArray(addrs) || addrs.length === 0) return "(No address on file)";
  const a = addrs[0];
  const parts = [a.addressLine1, a.city, a.state, a.zipCode].filter(Boolean);
  if (!parts.length) return "(No address on file)";
  return parts.join(", ");
}

function scheduleAddressLine(job) {
  if (!job) return "—";
  const fromCustomer = primaryAddressLine(job);
  if (fromCustomer !== "(No address on file)") return fromCustomer;
  const s = job.serviceAddress;
  if (s && (s.street || s.city || s.area || s.zip)) {
    return [s.street, s.city, s.area, s.zip].filter(Boolean).join(", ");
  }
  return "(No address on file)";
}

function assignmentStatusLabel(status) {
  if (status === "in_progress") return "On the job";
  if (status === "confirmed") return "Confirmed";
  if (status === "waiting") return "Waiting";
  if (status === "cancelled") return "Cancelled";
  if (!status) return "Scheduled";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/**
 * Human-readable payment status: API fields first, else inferred from balance vs total.
 * Estimates show "Not invoiced" unless an explicit status exists.
 */
function paymentStatusDisplay(job) {
  if (!job) return "—";
  const orderType = String(job.orderType || "work_order").toLowerCase();

  const raw =
    job.salesOrderPaymentStatus ??
    job.paymentStatus ??
    job.payment_state ??
    job.paymentStatusLabel ??
    job.invoicePaymentStatus ??
    job.billingStatus ??
    job.payment?.status;
  if (raw != null && String(raw).trim() !== "") {
    return normalizePaymentStatusLabel(String(raw).trim());
  }

  if (orderType === "estimate") return "Not invoiced";

  const bal = getJobBalanceAmount(job);
  const total = getJobTotalForPayment(job);

  if (bal == null) {
    if (total != null && total > 0) return "Unpaid";
    return "—";
  }
  if (bal <= 0.01) {
    return total != null && total > 0 ? "Paid" : "Paid";
  }
  if (total != null && total > 0.01 && bal < total - 0.01) {
    return "Partially paid";
  }
  return "Unpaid";
}

function technicianDisplayName(assignment, job) {
  return (
    assignment?.technicianName ||
    assignment?.assignedTechnicianName ||
    (Array.isArray(job?.technicianNames) && job.technicianNames[0]) ||
    job?.technicianName ||
    "—"
  );
}

function placeJobHoverTooltip(rect) {
  const pad = 8;
  let left = rect.right + 8;
  let top = rect.top;
  if (left + JOB_HOVER_W > window.innerWidth - pad) {
    left = Math.max(pad, rect.left - JOB_HOVER_W - 8);
  }
  if (top + JOB_HOVER_H > window.innerHeight - pad) {
    top = Math.max(pad, window.innerHeight - JOB_HOVER_H - pad);
  }
  if (left < pad) left = pad;
  if (top < pad) top = pad;
  return { left, top };
}

function formatDayHeader(d) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return {
    weekday: days[d.getDay()],
    rest: `${months[d.getMonth()]} ${d.getDate()}${ordinal(d.getDate())}`,
  };
}

function formatAssignmentDayTimeRange(dayYmd, startTime, endTime) {
  if (!dayYmd) return "—";
  const d = new Date(`${dayYmd}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  const a = timeToMinutes(startTime);
  const b = timeToMinutes(endTime);
  if (a == null || b == null) return "—";
  const dateStr = d.toLocaleDateString("en-US");
  return `${dateStr} ${minutesToLabel(a)} - ${minutesToLabel(b)}`;
}

function ordinal(n) {
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return "st";
  if (j === 2 && k !== 12) return "nd";
  if (j === 3 && k !== 13) return "rd";
  return "th";
}

function minutesToTimeStr(totalMins) {
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

function buildSlotLabels(startHour, endHour, intervalMins) {
  const labels = [];
  const start = startHour * 60;
  const end = endHour * 60;
  for (let m = start; m < end; m += intervalMins) {
    labels.push({ minutes: m, label: minutesToLabel(m) });
  }
  return labels;
}

function customerName(job) {
  const c = job?.customerId;
  if (!c) return "Customer";
  return (
    c?.basicInformation?.customerDisplayName ||
    c?.basicInformation?.companyName ||
    "Customer"
  );
}

function businessDisplayName(job) {
  if (!job) return "";
  if (job.businessName && String(job.businessName).trim()) return String(job.businessName).trim();
  const b = job.businessId;
  if (b && typeof b === "object" && b.name) return String(b.name);
  return "";
}

function durationHours(startTime, endTime) {
  const a = timeToMinutes(startTime);
  const b = timeToMinutes(endTime);
  if (a == null || b == null || b <= a) return 1;
  return Math.max(1, Math.round(((b - a) / 60) * 10) / 10);
}

/** On-Deck queue: no assignment times — show created time and a nominal duration. */
function formatDeckQueueTimeLabel(job) {
  const d = job?.createdAt ? new Date(job.createdAt) : null;
  if (!d || Number.isNaN(d.getTime())) return "— · 2h";
  const mins = d.getHours() * 60 + d.getMinutes();
  return `${minutesToLabel(mins)} - 2h`;
}

function assignmentQueueTimeLabel(a) {
  const start = timeToMinutes(a?.startTime);
  if (start == null) return "— · 1h";
  const dur = durationHours(a.startTime, a.endTime);
  return `${minutesToLabel(start)} - ${dur}h`;
}

function jobIdFromAssignment(assignment) {
  const j = assignment?.jobId;
  if (!j) return "";
  return typeof j === "object" && j._id != null ? String(j._id) : String(j);
}

/** Populated job for the work-order modal preview (route `state.initialJob`). */
function jobDocForModalPreview(assignmentOrJob) {
  if (!assignmentOrJob) return null;
  if (assignmentOrJob.jobId !== undefined) {
    const j = assignmentOrJob.jobId;
    return j && typeof j === "object" && j._id ? j : null;
  }
  if (assignmentOrJob._id) return assignmentOrJob;
  return null;
}

function OnDeckExpandedDetails({
  job,
  onOpenJob,
  onOpenTechnicians,
  onOpenEmail,
  onOpenRecordPayment,
  onOpenCompletionWizard,
  onDispatchNotesChanged,
  onDownloadWorkOrderPdf,
  pdfDownloadingId,
  currencyCode = DEFAULT_SCHEDULE_CURRENCY,
}) {
  const created = job?.createdAt ? new Date(job.createdAt) : null;
  const deckYmd =
    created && !Number.isNaN(created.getTime()) ? toYMD(created) : null;
  const startM = created && !Number.isNaN(created.getTime())
    ? created.getHours() * 60 + created.getMinutes()
    : null;
  const rangeLine =
    deckYmd && startM != null
      ? formatAssignmentDayTimeRange(
          deckYmd,
          minutesToTimeStr(startM),
          minutesToTimeStr(startM + 120),
        )
      : "—";

  return (
    <div className="mt-0 space-y-1.5 border-0 pt-0">
      <div className="rounded-none overflow-hidden border border-slate-300 bg-white shadow-sm">
        <div className="bg-[#4A76B2] text-white">
          <div className="px-2.5 pt-1.5 pb-2.5 text-center">
            <div className="text-[16px]  leading-tight tracking-tight">
              Appointment – Unscheduled
            </div>
              <div className="text-[12px] opacity-95 mt-1 tabular-nums">{rangeLine}</div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenJob();
              }}
              className="mt-2 text-[12px] italic underline underline-offset-2 hover:opacity-90"
            >
              Click to Open Details
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1">
        {[
          { Icon: Mail, label: "Email", onClick: (e) => { e.stopPropagation(); onOpenEmail?.(); } },
          { Icon: Receipt, label: "Record payment", short: "Payment", onClick: (e) => { e.stopPropagation(); onOpenRecordPayment?.(); } },
          { Icon: CalendarCheck, label: "Completion Wizard", short: "Wizard", onClick: (e) => { e.stopPropagation(); onOpenCompletionWizard?.(); } },
          { Icon: X, label: "Cancel", danger: true, onClick: (e) => e.stopPropagation() },
        ].map(({ Icon, label, short, danger, onClick }) => (
          <button
            key={label}
            type="button"
            onClick={onClick}
            className={`flex flex-col items-center justify-center gap-0.5 rounded-md border px-1 py-1.5 text-[8px] font-semibold leading-tight shadow-sm ${
              danger
                ? "border-red-300 bg-red-50 text-red-700"
                : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
            }`}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden />
            <span className="text-center">{short || label}</span>
          </button>
        ))}
      </div>

      <DispatchAppointmentNotes job={job} onSaved={onDispatchNotesChanged} />

      <div>
        <div className="text-[10px] font-semibold text-slate-600 mb-0.5">Technicians:</div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenTechnicians?.();
          }}
          className="flex w-full items-center gap-1.5 text-[10px] border border-slate-300 rounded-md px-2 py-1.5 bg-white text-slate-500 text-left hover:bg-slate-50 hover:border-slate-400"
        >
          <span className="flex-1 min-w-0">
            {Array.isArray(job?.technicianNames) && job.technicianNames.length
              ? job.technicianNames.join(", ")
              : "Click to search and add…"}
          </span>
          <Search className="w-3.5 h-3.5 shrink-0 text-slate-400" aria-hidden />
        </button>
      </div>

      <div className="rounded-md border border-emerald-800/25 overflow-hidden bg-white shadow-sm">
        <div className="flex items-center justify-between px-2 py-1.5 bg-[#c1e1b9] text-slate-900 text-[11px] font-semibold border-b border-emerald-800/20 gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenJob();
            }}
            className="text-blue-800 underline font-semibold tabular-nums shrink-0 min-w-0 text-left"
          >
            {workOrderNumberDisplay(job)}
          </button>
          <button
            type="button"
            disabled={pdfDownloadingId === job._id}
            onClick={(e) => {
              e.stopPropagation();
              onDownloadWorkOrderPdf?.(job, null, null);
            }}
            className="flex items-center gap-1.5 shrink-0 ml-auto rounded px-1 py-0.5 hover:bg-emerald-900/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:opacity-50"
            title={`Download ${jobBillingDocumentTitleLower(job)} PDF`}
          >
            {pdfDownloadingId === job._id ? (
              <Loader2 className="w-3.5 h-3.5 text-slate-800 animate-spin" />
            ) : (
              <Printer className="w-3.5 h-3.5 text-slate-800" aria-hidden />
            )}
            <span>{pdfDownloadingId === job._id ? "Downloading..." : jobBillingDocumentTitle(job)}</span>
          </button>
        </div>
        <SchedulingJobLineItemsSection job={job} currencyCode={currencyCode} />
      </div>
    </div>
  );
}

function ExpandedAssignmentSidebarDetails({
  assignment,
  vehicleList,
  onStatusUpdate,
  onMoveVehicle,
  onOpenJob,
  onOpenTechnicians,
  onOpenEmail,
  onOpenRecordPayment,
  onOpenCompletionWizard,
  onDispatchNotesChanged,
  onDownloadWorkOrderPdf,
  pdfDownloadingId,
  fleetTerms = DEFAULT_FLEET_TERMINOLOGY,
  currencyCode = DEFAULT_SCHEDULE_CURRENCY,
}) {
  const a = assignment;
  const job = a.jobId;
  const dayYmd = a.dayYmd;
  const statusLine = assignmentStatusLabel(a.status);
  const bannerTitle = `Appointment – ${statusLine}`;
  const rangeLine = formatAssignmentDayTimeRange(dayYmd, a.startTime, a.endTime);
  const techShown = technicianDisplayName(a, job);
  const showTechPlaceholder = !techShown || techShown === "—";

  return (
    <div className="mt-0 space-y-1.5 border-0 pt-0">
      <div className="rounded-none overflow-hidden border border-slate-300 bg-white shadow-sm">
        <div className="bg-[#4A76B2] text-white">
          <div className="px-2.5 pt-1.5 pb-2.5 text-center">
            <div className="text-[16px] leading-tight tracking-tight">{bannerTitle}</div>
            <div className="text-[12px] opacity-95 mt-1 tabular-nums">{rangeLine}</div>
            {onOpenJob ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenJob();
                }}
                className="mt-2 text-[12px] italic underline underline-offset-2 hover:opacity-90"
              >
                Click to Open Details
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 px-2 py-2 border-b border-slate-200 bg-white">
          <div className="grid grid-cols-4 gap-1 flex-1 min-w-0">
            {[
              { Icon: Mail, label: "Email", onClick: (e) => { e.stopPropagation(); onOpenEmail?.(); } },
              { Icon: Receipt, label: "Record payment", short: "Payment", onClick: (e) => { e.stopPropagation(); onOpenRecordPayment?.(); } },
              { Icon: CalendarCheck, label: "Completion Wizard", short: "Wizard", onClick: (e) => { e.stopPropagation(); onOpenCompletionWizard?.(); } },
              {
                Icon: X,
                label: "Cancel",
                danger: true,
                onClick: (e) => {
                  e.stopPropagation();
                  onStatusUpdate("cancelled");
                },
              },
            ].map(({ Icon, label, short, danger, onClick }) => (
              <button
                key={label}
                type="button"
                onClick={onClick}
                className={`flex flex-col items-center justify-center gap-0.5 rounded-md border px-0.5 py-1.5 text-[8px] font-semibold leading-tight shadow-sm ${
                  danger
                    ? "border-red-300 bg-red-50 text-red-700"
                    : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden />
                <span className="text-center">{short || label}</span>
              </button>
            ))}
          </div>
          <select
            value={a.status}
            onChange={(e) => onStatusUpdate(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 text-[9px] border border-slate-300 rounded-md px-1 py-1 max-w-[6.5rem] bg-white"
            title="Status"
          >
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>

        <div className="px-2 py-2 bg-white">
          <DispatchAppointmentNotes job={job} onSaved={onDispatchNotesChanged} />
        </div>

        <div className="px-2 py-2 border-t border-slate-200 bg-white">
          <div className="text-[10px] font-semibold text-slate-600 mb-0.5">Technicians:</div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenTechnicians?.();
            }}
            className="flex w-full items-center gap-1.5 text-[10px] border border-slate-300 rounded-md px-2 py-1.5 bg-white text-left hover:bg-slate-50 hover:border-slate-400"
          >
            <span className="flex-1 min-w-0 truncate text-slate-800 font-medium">
              {Array.isArray(job?.technicianNames) && job.technicianNames.length
                ? job.technicianNames.join(", ")
                : showTechPlaceholder
                  ? "Click to search and add…"
                  : techShown}
            </span>
            <Search className="w-3.5 h-3.5 shrink-0 text-slate-400" aria-hidden />
          </button>
        </div>
      </div>

      <div className="rounded-md border border-emerald-800/25 overflow-hidden bg-white shadow-sm">
        <div className="flex items-center justify-between px-2 py-1.5 bg-[#c1e1b9] text-slate-900 text-[11px] font-semibold border-b border-emerald-800/20 gap-2">
          {onOpenJob ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenJob();
              }}
              className="text-blue-800 underline font-semibold tabular-nums shrink-0 min-w-0 text-left"
            >
              {workOrderNumberDisplay(job)}
            </button>
          ) : (
            <span className="text-blue-800 font-semibold tabular-nums shrink-0">
              {workOrderNumberDisplay(job)}
            </span>
          )}
          <button
            type="button"
            disabled={pdfDownloadingId === job._id}
            onClick={(e) => {
              e.stopPropagation();
              onDownloadWorkOrderPdf?.(job, a, a.dayYmd);
            }}
            className="flex items-center gap-1.5 shrink-0 ml-auto rounded px-1 py-0.5 hover:bg-emerald-900/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:opacity-50"
            title={`Download ${jobBillingDocumentTitleLower(job)} PDF`}
          >
            {pdfDownloadingId === job._id ? (
              <Loader2 className="w-3.5 h-3.5 text-slate-800 animate-spin" />
            ) : (
              <Printer className="w-3.5 h-3.5 text-slate-800" aria-hidden />
            )}
            <span>{pdfDownloadingId === job._id ? "Downloading..." : jobBillingDocumentTitle(job)}</span>
          </button>
        </div>
        <SchedulingJobLineItemsSection
          job={job}
          currencyCode={currencyCode}
          scrollAreaClassName="border-b border-slate-100"
        />
      </div>

      {!isJobOrAssignmentCancelled(a) ? (
        <div className="pt-0.5">
          <div className="text-[10px] font-semibold text-blue-700 mb-1">
            Move to {fleetTerms.vehicleLabelSingular}
          </div>
          <div className="flex flex-wrap gap-1">
            {(vehicleList || [])
              .filter((v) => {
                const selectedVehicleId = a.vehicleId?._id || a.vehicleId;
                return String(v._id) !== String(selectedVehicleId || "");
              })
              .map((vehicle) => (
                <button
                  key={vehicle._id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMoveVehicle(vehicle._id);
                  }}
                  className="text-[9px] px-2 py-1 rounded-md bg-slate-200 hover:bg-slate-300 text-slate-800 font-medium"
                >
                  {vehicle.name}
                </button>
              ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function SchedulingPage() {
  const history = useHistory();
  const location = useLocation();
  const { state } = useContext(AdminContext);

  const openJobPageOverBoard = useCallback(
    (jobId, initialJob) => {
      if (!jobId) return;
      const state = { background: location };
      if (initialJob && typeof initialJob === "object" && initialJob._id) {
        state.initialJob = initialJob;
      }
      history.push({
        pathname: `/scheduling/job/${jobId}`,
        state,
      });
    },
    [history, location],
  );

  const [dispatchEmail, setDispatchEmail] = useState({
    open: false,
    job: null,
    assignment: null,
    dayYmd: null,
  });

  const openDispatchEmail = useCallback((job, meta = {}) => {
    const soId = job?.createdFrom?._id || job?.createdFrom;
    if (!soId) {
      notifyError("This job is not linked to an order yet.");
      return;
    }
    setDispatchEmail({
      open: true,
      job,
      assignment: meta.assignment ?? null,
      dayYmd: meta.dayYmd ?? null,
    });
  }, []);

  const closeDispatchEmail = useCallback(() => {
    setDispatchEmail({ open: false, job: null, assignment: null, dayYmd: null });
  }, []);

  const openDispatchRecordPayment = useCallback(
    async (job) => {
      const soId = job?.createdFrom?._id || job?.createdFrom;
      if (!soId) {
        notifyError("Link an order to this job before recording payment.");
        return;
      }
      if (shouldRouteRecordPaymentViaInvoice(job)) {
        try {
          const soRes = await SalesOrderServices.getSalesOrderById(soId);
          const soData = soRes?.data?.data || soRes?.data || {};
          const linkedInvoiceId = linkedInvoiceIdFromSalesOrder(soData);
          if (linkedInvoiceId) {
            history.push({
              pathname: `/customer-invoices/view/${linkedInvoiceId}`,
              state: { openRecordPayment: true, fromDispatch: true },
            });
            return;
          }
        } catch (e) {
          console.error(e);
        }
      }
      history.push({
        pathname: getModuleRoutePath("saleOrder", "view", { id: soId }),
        state: { openRecordPayment: true, fromDispatch: true },
      });
    },
    [history],
  );

  const openDispatchCompletionWizard = useCallback(
    (jobId) => {
      if (!jobId) return;
      history.push({ pathname: `/scheduling/job/${jobId}`, search: "?wizard=1", state: { background: location } });
    },
    [history, location],
  );
  const { adminInfo } = state;
  const [businesses, setBusinesses] = useState([]);
  const [selectedBusiness, setSelectedBusiness] = useState("");
  const [scheduleCurrency, setScheduleCurrency] = useState(DEFAULT_SCHEDULE_CURRENCY);

  const apiHeaders = useMemo(
    () => ({
      "Content-Type": "application/json",
      authorization: adminInfo?.token ? `Bearer ${adminInfo.token}` : undefined,
    }),
    [adminInfo?.token],
  );

  const persistSelectedBusiness = useCallback((businessId) => {
    const key = schedulingSelectedBusinessStorageKey(adminInfo?.id);
    if (!key || businessId == null || businessId === "") return;
    try {
      localStorage.setItem(key, String(businessId));
    } catch {
      /* ignore quota / private mode */
    }
  }, [adminInfo?.id]);

  const [view, setView] = useState("week");
  const [weekAnchor, setWeekAnchor] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [loading, setLoading] = useState(true);
  /** After the first load attempt we keep the board mounted and use an overlay for refetch (avoids layout swap / column collapse). */
  const [hasLoadedScheduleOnce, setHasLoadedScheduleOnce] = useState(false);
  /** False until assigned-business list is fetched so we do not run schedule with wrong scope or double-fetch. */
  const [businessesHydrated, setBusinessesHydrated] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  /** Map key `${ymd}|${vehicleId}` -> assignments[] (raw from API) */
  const [assignMapRaw, setAssignMapRaw] = useState(() => new Map());
  /** Pending / unassigned jobs (no route row yet) — “On-Deck”. */
  const [unscheduledJobsRaw, setUnscheduledJobsRaw] = useState([]);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [stackConflicts, setStackConflicts] = useState(true);
  const [density, setDensity] = useState("medium");
  const [resourceFilter, setResourceFilter] = useState("all");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [pdfDownloadingId, setPdfDownloadingId] = useState(null);
  /** Dispatch queue tab: Scheduled / On-Deck / Waiting (matches reference dispatch UI). */
  const [sidebarTab, setSidebarTab] = useState("ondeck");
  const [selectedOnDeckJobId, setSelectedOnDeckJobId] = useState(null);
  const [activeJobId, setActiveJobId] = useState(null);
  /** Month view: single-click selection (double-click opens week for that day). */
  const [monthViewSelectedYmd, setMonthViewSelectedYmd] = useState(null);
  /** Sidebar list cards: expand details when chevron toggled (job _id or assignment _id). */
  const [expandedSidebarCards, setExpandedSidebarCards] = useState(() => ({}));
  /** Week grid job blocks: expand extra rows when chevron toggled (assignment _id). */
  const [hoverTooltip, setHoverTooltip] = useState(null);
  const hoverLeaveTimerRef = useRef(null);
  const [scheduleSettings, setScheduleSettings] = useState(DEFAULT_SCHEDULE_SETTINGS);
  const [fleetTerms, setFleetTerms] = useState(DEFAULT_FLEET_TERMINOLOGY);
  const [createJobModal, setCreateJobModal] = useState({
    open: false,
    dayYmd: "",
    vehicle: null,
    startTime: "09:00",
    endTime: "10:00",
  });
  /** Technician picker: same UI pattern as create-job modal, job/assignment fields only. */
  const [technicianPicker, setTechnicianPicker] = useState({
    open: false,
    job: null,
    assignment: null,
  });
  useEffect(() => {
    const fetchBusinesses = async () => {
      if (!adminInfo?.id || !adminInfo?.token) {
        setBusinessesHydrated(true);
        return;
      }
      try {
        const response = await axios.get(`${Base_URL}/admin/assigned/${adminInfo.id}`, {
          headers: {
            "Content-Type": "application/json",
            authorization: `Bearer ${adminInfo.token}`,
          },
        });
        const list = response.data?.businesses || [];
        setBusinesses(list);
        setSelectedBusiness((prev) => {
          if (!list.length) return "";
          const ids = new Set(list.map((b) => String(b._id)));
          const prevStr = prev != null && prev !== "" ? String(prev) : "";
          const storageKey = schedulingSelectedBusinessStorageKey(adminInfo?.id);
          let storedStr = "";
          if (storageKey) {
            try {
              const raw = localStorage.getItem(storageKey);
              if (raw != null && raw !== "") storedStr = String(raw);
            } catch {
              /* ignore */
            }
          }
          if (prevStr && ids.has(prevStr)) return prevStr;
          if (storedStr && ids.has(storedStr)) return storedStr;
          return String(list[0]._id);
        });
      } catch (e) {
        console.error("Error fetching assigned businesses:", e);
      } finally {
        setBusinessesHydrated(true);
      }
    };
    fetchBusinesses();
  }, [adminInfo?.id, adminInfo?.token]);

  useEffect(() => {
    if (!selectedBusiness) {
      setScheduleCurrency(DEFAULT_SCHEDULE_CURRENCY);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${Base_URL}/finance/currencies`, {
          params: { business_id: selectedBusiness },
          headers: apiHeaders,
        });
        const currencies = res.data?.data || [];
        const base = currencies.find((c) => c.is_base === true);
        if (!cancelled) setScheduleCurrency(parseFinanceBaseCurrencyCode(base));
      } catch {
        if (!cancelled) setScheduleCurrency(DEFAULT_SCHEDULE_CURRENCY);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedBusiness, apiHeaders]);

  const selectedBusinessRecord = useMemo(
    () => businesses.find((b) => String(b._id) === String(selectedBusiness)),
    [businesses, selectedBusiness],
  );

  /** Business row (with `image`) for work-order PDF when emailing from schedule. */
  const dispatchBusinessForPdf = useMemo(() => {
    const j = dispatchEmail.job;
    if (!j) return null;
    const bid = j.businessId?._id || j.businessId;
    if (bid) {
      const found = businesses.find((b) => String(b._id) === String(bid));
      if (found) return found;
    }
    return selectedBusinessRecord || (businesses.length === 1 ? businesses[0] : null) || null;
  }, [dispatchEmail.job, businesses, selectedBusinessRecord]);

  const handleDownloadWorkOrderPdf = useCallback(
    async (job, assignment, dayYmd) => {
      if (!job) {
        notifyError("No job data to export.");
        return;
      }
      try {
        setPdfDownloadingId(job._id);
        const jobBusinessId = job.businessId?._id || job.businessId;
        const businessForPdf = jobBusinessId
          ? businesses.find((b) => String(b._id) === String(jobBusinessId)) ||
            selectedBusinessRecord
          : selectedBusinessRecord;
        await downloadWorkOrderPdf({
          job,
          assignment: assignment || undefined,
          dayYmd: dayYmd || undefined,
          business: businessForPdf,
          scheduleCurrency,
        });
        notifySuccess(`${jobBillingDocumentTitle(job)} PDF downloaded.`);
      } catch (err) {
        console.error(err);
        notifyError(`Could not generate the ${jobBillingDocumentTitleLower(job)} PDF.`);
      } finally {
        setPdfDownloadingId(null);
      }
    },
    [businesses, selectedBusinessRecord, scheduleCurrency],
  );

  /** Row height (time slots); column widths stretch with the week area. */
  const cellSize =
    density === "compact" ? 44 : density === "small" ? 56 : density === "medium" ? 72 : 88;
  const gridBoardRef = useRef(null);

  const slotMinutes = scheduleSettings.slotIntervalMinutes;
  const gridStartMins = scheduleSettings.businessStartHour * 60;
  const gridEndMins = scheduleSettings.businessEndHour * 60;
  const timeSlots = useMemo(
    () =>
      buildSlotLabels(
        scheduleSettings.businessStartHour,
        scheduleSettings.businessEndHour,
        slotMinutes,
      ),
    [scheduleSettings.businessStartHour, scheduleSettings.businessEndHour, slotMinutes],
  );
  const gridBodyHeight = Math.max(timeSlots.length * cellSize, cellSize * 4);

  const weekDays = useMemo(() => {
    const mon = getMonday(weekAnchor);
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(mon, i);
      const ymd = toYMD(d);
      const { weekday, rest } = formatDayHeader(d);
      const today = toYMD(new Date());
      return { date: d, ymd, weekday, rest, isToday: ymd === today };
    });
  }, [weekAnchor]);

  const workingDaySet = useMemo(
    () => new Set(scheduleSettings.workingDays),
    [scheduleSettings.workingDays],
  );

  /** Full Mon–Sun week on the board (includes non-working days so jobs can still be placed). */
  const visibleWeekDays = useMemo(() => weekDays, [weekDays]);

  const mondayStr = weekDays[0]?.ymd;

  const monthCalendarCells = useMemo(() => {
    const d = new Date(`${weekAnchor}T12:00:00`);
    if (Number.isNaN(d.getTime())) return [];
    return buildMonthCalendarCells(d.getFullYear(), d.getMonth());
  }, [weekAnchor]);

  const filteredVehicles = useMemo(() => {
    if (resourceFilter === "all") return vehicles;
    return vehicles.filter((v) => String(v._id) === resourceFilter);
  }, [vehicles, resourceFilter]);

  const scheduleBoardHasRealVehicles = filteredVehicles.length > 0;

  const boardVehicles = useMemo(() => {
    if (filteredVehicles.length > 0) return filteredVehicles;
    return [
      {
        _id: SCHEDULE_BOARD_PLACEHOLDER_VEHICLE_ID,
        name: `Add ${fleetTerms.vehicleLabelSingular.toLowerCase()}`,
        __scheduleBoardPlaceholder: true,
      },
    ];
  }, [filteredVehicles, fleetTerms.vehicleLabelSingular]);

  const weekDayColumnMinPx = useMemo(() => {
    const n = Math.max(1, boardVehicles.length);
    return Math.max(WEEK_DAY_HEADER_MIN_PX, n * VEHICLE_LANE_MIN_PX);
  }, [boardVehicles.length]);

  const assignMap = useMemo(() => {
    const next = new Map();
    assignMapRaw.forEach((arr, key) => {
      const filtered = (arr || []).filter((a) => {
        if (!jobMatchesBusinessFilter(a?.jobId, selectedBusiness, businesses)) return false;
        if (isJobOrAssignmentCancelled(a)) return false;
        return true;
      });
      next.set(key, filtered);
    });
    return next;
  }, [assignMapRaw, selectedBusiness, businesses]);

  const monthCellSummaries = useMemo(() => {
    const m = new Map();
    monthCalendarCells.forEach((cell) => {
      if (m.has(cell.ymd)) return;
      let total = 0;
      const pairs = [];
      filteredVehicles.forEach((v) => {
        (assignMap.get(`${cell.ymd}|${String(v._id)}`) || []).forEach((a) => {
          total += getJobTotalAmount(a?.jobId);
          pairs.push({ assignment: a, vehicle: v });
        });
      });
      pairs.sort((x, y) =>
        String(x.assignment.startTime || "").localeCompare(String(y.assignment.startTime || "")),
      );
      const list = pairs.map((p) => p.assignment);
      const cap = Math.max(1, filteredVehicles.length * 4);
      const pct = Math.min(100, Math.round((list.length / cap) * 100));
      const head = pairs[0];
      m.set(cell.ymd, {
        total,
        list,
        pct,
        first: head?.assignment ?? null,
        firstVehicle: head?.vehicle ?? null,
      });
    });
    return m;
  }, [monthCalendarCells, assignMap, filteredVehicles]);

  const unscheduledJobs = useMemo(
    () =>
      unscheduledJobsRaw.filter(
        (job) =>
          jobMatchesBusinessFilter(job, selectedBusiness, businesses) && !isJobDocumentCancelled(job),
      ),
    [unscheduledJobsRaw, selectedBusiness, businesses],
  );

  const loadScheduleSettings = useCallback(async () => {
    try {
      const bizForSettings =
        selectedBusiness || (businesses.length === 1 ? businesses[0]?._id : "");
      if (!bizForSettings) {
        setScheduleSettings({ ...DEFAULT_SCHEDULE_SETTINGS });
        setFleetTerms(normalizeFleetTerminology(null));
        return;
      }
      const res = await FleetManagementServices.getFleetScheduleSettings({ business: bizForSettings });
      if (res?.data) {
        setScheduleSettings(normalizeScheduleSettings(res.data));
        setFleetTerms(normalizeFleetTerminology(res.data));
      }
    } catch {
      setScheduleSettings({ ...DEFAULT_SCHEDULE_SETTINGS });
      setFleetTerms(normalizeFleetTerminology(null));
    }
  }, [selectedBusiness, businesses]);

  const loadScheduleSettingsRef = useRef(loadScheduleSettings);
  useEffect(() => {
    loadScheduleSettingsRef.current = loadScheduleSettings;
  }, [loadScheduleSettings]);

  const loadRunGenRef = useRef(0);

  const loadWeek = useCallback(async (opts = {}) => {
    const force = Boolean(opts?.force);
    if (!weekAnchor) {
      setLoading(false);
      setHasLoadedScheduleOnce(true);
      return;
    }
    const anchorDate = new Date(`${weekAnchor}T12:00:00`);
    if (Number.isNaN(anchorDate.getTime())) {
      setLoading(false);
      setHasLoadedScheduleOnce(true);
      return;
    }

    let dateList = [];
    if (view === "month") {
      const cells = buildMonthCalendarCells(anchorDate.getFullYear(), anchorDate.getMonth());
      dateList = [...new Set(cells.map((c) => c.ymd))];
    } else {
      const mon = getMonday(weekAnchor);
      for (let i = 0; i < 7; i += 1) {
        dateList.push(toYMD(addDays(mon, i)));
      }
    }

    if (dateList.length === 0) {
      setLoading(false);
      setHasLoadedScheduleOnce(true);
      return;
    }

    const scheduleParamsKey = JSON.stringify({
      w: weekAnchor,
      v: view,
      b: selectedBusiness || "",
    });
    let silentRefresh = false;
    if (!force && typeof window !== "undefined") {
      try {
        silentRefresh = window.sessionStorage.getItem(SCHEDULE_LAST_LOAD_KEY) === scheduleParamsKey;
      } catch {
        silentRefresh = false;
      }
    }

    const runGen = (loadRunGenRef.current += 1);
    await loadScheduleSettingsRef.current();
    if (!silentRefresh) {
      setLoading(true);
    }
    try {
      const businessParams = selectedBusiness ? { business: selectedBusiness } : {};
      const unschedPromise = FleetManagementServices.getUnscheduledJobs(businessParams).catch(() => ({
        data: [],
      }));
      const vehicleMap = new Map();
      const nextMap = new Map();

      const sortedYmds = [...dateList].sort();
      const fromYmd = sortedYmds[0];
      const toYmd = sortedYmds[sortedYmds.length - 1];
      const rangeRes = await FleetManagementServices.getSchedule(fromYmd, { ...businessParams, endDate: toYmd });
      const byDate = rangeRes?.dataByDate;
      if (byDate && typeof byDate === "object") {
        dateList.forEach((ymd) => {
          const grouped = byDate[ymd] || [];
          grouped.forEach(({ vehicle, assignments }) => {
            if (!vehicle?._id) return;
            vehicleMap.set(String(vehicle._id), vehicle);
            const key = `${ymd}|${String(vehicle._id)}`;
            nextMap.set(key, assignments || []);
          });
        });
      } else {
        const scheduleResults = await Promise.all(
          dateList.map((ymd) =>
            FleetManagementServices.getSchedule(ymd, businessParams).then((res) => ({ ymd, res })),
          ),
        );
        scheduleResults.forEach(({ ymd, res }) => {
          const grouped = res?.data || [];
          grouped.forEach(({ vehicle, assignments }) => {
            if (!vehicle?._id) return;
            vehicleMap.set(String(vehicle._id), vehicle);
            const key = `${ymd}|${String(vehicle._id)}`;
            nextMap.set(key, assignments || []);
          });
        });
      }

      if (runGen !== loadRunGenRef.current) return;

      const list = Array.from(vehicleMap.values()).sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || "")),
      );
      setVehicles(list);
      setAssignMapRaw(nextMap);
      const unschedRes = await unschedPromise;
      if (runGen !== loadRunGenRef.current) return;
      setUnscheduledJobsRaw(Array.isArray(unschedRes?.data) ? unschedRes.data : []);
      if (typeof window !== "undefined") {
        try {
          window.sessionStorage.setItem(SCHEDULE_LAST_LOAD_KEY, scheduleParamsKey);
        } catch {
          /* ignore */
        }
      }
    } catch (error) {
      if (typeof window !== "undefined") {
        try {
          window.sessionStorage.removeItem(SCHEDULE_LAST_LOAD_KEY);
        } catch {
          /* ignore */
        }
      }
      const data = error?.response?.data;
      let msg =
        (data?.message && String(data.message)) ||
        (!data && error?.message) ||
        "Failed to fetch schedule";
      if (data?.error && !String(msg).includes(String(data.error))) {
        msg = `${msg} (${data.error})`;
      }
      notifyError(msg);
    } finally {
      if (runGen === loadRunGenRef.current) {
        setLoading(false);
        setHasLoadedScheduleOnce(true);
      }
    }
  }, [weekAnchor, view, selectedBusiness]);

  useEffect(() => {
    if (!businessesHydrated) return;
    loadWeek();
  }, [loadWeek, businessesHydrated]);

  const refreshBoard = useCallback(() => {
    loadWeek({ force: true });
  }, [loadWeek]);

  const clearHoverLeaveTimer = useCallback(() => {
    if (hoverLeaveTimerRef.current) {
      clearTimeout(hoverLeaveTimerRef.current);
      hoverLeaveTimerRef.current = null;
    }
  }, []);

  const scheduleHideJobHover = useCallback(() => {
    clearHoverLeaveTimer();
    hoverLeaveTimerRef.current = setTimeout(() => {
      setHoverTooltip(null);
      hoverLeaveTimerRef.current = null;
    }, 280);
  }, [clearHoverLeaveTimer]);

  /** Week / month board + hover tip: pick correct queue tab so Waiting jobs open Waiting details on the right. */
  const selectAssignmentFromBoard = useCallback(
    (assignment, vehicleList) => {
      setHoverTooltip(null);
      clearHoverLeaveTimer();
      setSelectedOnDeckJobId(null);
      setActiveJobId(jobIdFromAssignment(assignment));
      const st = String(assignment?.status || "").toLowerCase();
      setSidebarTab(st === "waiting" ? "waiting" : "scheduled");
      setSidebarOpen(true);
      setExpandedSidebarCards((prev) => ({ ...prev, [assignment._id]: true }));
      setSelectedAssignment({
        ...assignment,
        vehicleList,
      });
    },
    [clearHoverLeaveTimer],
  );

  useEffect(() => {
    setHoverTooltip(null);
  }, [weekAnchor]);

  useEffect(() => () => clearHoverLeaveTimer(), [clearHoverLeaveTimer]);

  const goPrevWeek = () => {
    const mon = getMonday(weekAnchor);
    mon.setDate(mon.getDate() - 7);
    setWeekAnchor(toYMD(mon));
    setSelectedAssignment(null);
    setSelectedOnDeckJobId(null);
  };

  const goNextWeek = () => {
    const mon = getMonday(weekAnchor);
    mon.setDate(mon.getDate() + 7);
    setWeekAnchor(toYMD(mon));
    setSelectedAssignment(null);
    setSelectedOnDeckJobId(null);
  };

  const goPrevMonth = () => {
    const d = new Date(`${weekAnchor}T12:00:00`);
    d.setMonth(d.getMonth() - 1);
    const y = toYMD(d);
    setWeekAnchor(y);
    setMonthViewSelectedYmd(y);
    setSelectedAssignment(null);
    setSelectedOnDeckJobId(null);
  };

  const goNextMonth = () => {
    const d = new Date(`${weekAnchor}T12:00:00`);
    d.setMonth(d.getMonth() + 1);
    const y = toYMD(d);
    setWeekAnchor(y);
    setMonthViewSelectedYmd(y);
    setSelectedAssignment(null);
    setSelectedOnDeckJobId(null);
  };

  const goThisWeek = () => {
    const y = new Date().toISOString().slice(0, 10);
    setWeekAnchor(y);
    setSelectedAssignment(null);
    setSelectedOnDeckJobId(null);
    if (view === "month") setMonthViewSelectedYmd(y);
  };

  const scheduledCount = useMemo(() => {
    let n = 0;
    assignMap.forEach((arr) => {
      arr.forEach((a) => {
        if (isRoutedForScheduledSidebar(a)) n += 1;
      });
    });
    return n;
  }, [assignMap]);

  const sidebarAssignments = useMemo(() => {
    const rows = [];
    const days = view === "month" ? monthCalendarCells : visibleWeekDays;
    days.forEach((day) => {
      const ymd = day.ymd;
      filteredVehicles.forEach((vehicle) => {
        const key = `${ymd}|${String(vehicle._id)}`;
        const assignments = assignMap.get(key) || [];
        assignments.forEach((a) => {
          rows.push({
            ...a,
            dayYmd: ymd,
            vehicle,
            vehicleList: filteredVehicles,
          });
        });
      });
    });
    return rows;
  }, [view, monthCalendarCells, assignMap, visibleWeekDays, filteredVehicles]);

  const scheduledAssignments = useMemo(
    () => sidebarAssignments.filter((a) => isRoutedForScheduledSidebar(a)),
    [sidebarAssignments],
  );

  const waitingAssignments = useMemo(
    () => sidebarAssignments.filter((a) => String(a.status || "") === "waiting"),
    [sidebarAssignments],
  );

  const dispatchQueueTabs = useMemo(
    () => [
      { id: "scheduled", label: "Scheduled", count: scheduledAssignments.length || scheduledCount },
      { id: "ondeck", label: "On-Deck", count: unscheduledJobs.length },
      { id: "waiting", label: "Waiting", count: waitingAssignments.length },
    ],
    [
      scheduledAssignments.length,
      scheduledCount,
      unscheduledJobs.length,
      waitingAssignments.length,
    ],
  );

  const dayTotals = useMemo(() => {
    const totals = new Map();
    visibleWeekDays.forEach((day) => {
      let sum = 0;
      filteredVehicles.forEach((vehicle) => {
        const key = `${day.ymd}|${String(vehicle._id)}`;
        const assignments = assignMap.get(key) || [];
        assignments.forEach((a) => {
          sum += getJobTotalAmount(a?.jobId);
        });
      });
      totals.set(day.ymd, sum);
    });
    return totals;
  }, [visibleWeekDays, filteredVehicles, assignMap]);

  const dayVehicleTotals = useMemo(() => {
    const totals = new Map();
    visibleWeekDays.forEach((day) => {
      filteredVehicles.forEach((vehicle) => {
        const key = `${day.ymd}|${String(vehicle._id)}`;
        const assignments = assignMap.get(key) || [];
        const sum = assignments.reduce((acc, a) => acc + getJobTotalAmount(a?.jobId), 0);
        totals.set(key, sum);
      });
    });
    return totals;
  }, [visibleWeekDays, filteredVehicles, assignMap]);

  const handleStatusUpdate = async (assignmentId, status) => {
    try {
      await FleetManagementServices.updateAssignment(assignmentId, { status });
      notifySuccess("Assignment status updated");
      loadWeek({ force: true });
      if (selectedAssignment?._id === assignmentId) {
        setSelectedAssignment((prev) => (prev ? { ...prev, status } : null));
      }
    } catch (error) {
      notifyError(error?.response?.data?.message || "Failed to update assignment");
    }
  };

  const handleMoveVehicle = async (assignmentId, vehicleId) => {
    try {
      await FleetManagementServices.updateAssignment(assignmentId, { vehicleId });
      notifySuccess("Assignment moved successfully");
      setSelectedAssignment(null);
      loadWeek({ force: true });
    } catch (error) {
      notifyError(error?.response?.data?.message || "Failed to move assignment");
    }
  };

  const toggleSidebarCard = useCallback((id) => {
    setExpandedSidebarCards((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const selectDispatchQueueTab = useCallback((id) => {
    setSidebarTab(id);
    setSidebarOpen(true);
    if (id === "ondeck") {
      setSelectedAssignment(null);
    } else {
      setSelectedOnDeckJobId(null);
    }
  }, []);

  const openDispatchMap = () => {
    const addr = scheduleSettings.dispatchAddress?.trim();
    const lat = scheduleSettings.dispatchLatitude?.trim();
    const lng = scheduleSettings.dispatchLongitude?.trim();
    if (lat && lng) {
      window.open(
        `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`,
        "_blank",
        "noopener,noreferrer",
      );
    } else if (addr) {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`,
        "_blank",
        "noopener,noreferrer",
      );
    } else {
      notifyError("Set a dispatch location under Settings → Fleet management → Dispatch schedule.");
    }
  };

  const rangeLabel = useMemo(() => {
    if (view === "month") {
      const d = new Date(`${weekAnchor}T12:00:00`);
      if (Number.isNaN(d.getTime())) return "";
      return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    }
    if (!weekDays.length) return "";
    const a = weekDays[0].date;
    const b = weekDays[6].date;
    return `${a.getMonth() + 1}/${a.getDate()}/${a.getFullYear()} – ${b.getMonth() + 1}/${b.getDate()}/${b.getFullYear()}`;
  }, [view, weekAnchor, weekDays]);

  const goToWeekForDate = useCallback((ymd) => {
    setWeekAnchor(ymd);
    setView("week");
    setSelectedAssignment(null);
    setSelectedOnDeckJobId(null);
  }, []);

  const renderJobBlock = (assignment, vehicleList, vehicle, dayYmd) => {
    if (isJobOrAssignmentCancelled(assignment)) return null;
    const start = timeToMinutes(assignment.startTime);
    const end = timeToMinutes(assignment.endTime);
    if (start == null || end == null) return null;
    const top = ((start - gridStartMins) / slotMinutes) * cellSize;
    const job = assignment.jobId && typeof assignment.jobId === "object" ? assignment.jobId : null;
    const height = Math.max(
      ((end - start) / slotMinutes) * cellSize,
      cellSize * 0.75,
    );
    const selected = selectedAssignment?._id === assignment._id;
    const totalStr = job ? formatJobTotalDisplay(job, scheduleCurrency) : "—";
    const balanceStr = job ? formatJobBalanceDisplay(job, scheduleCurrency) : "—";
    const timeLabel = formatWeekBlockTimeRange(assignment.startTime, assignment.endTime);
    const statusLabel = assignmentStatusLabel(assignment.status);
    const paymentCaps = (job ? paymentStatusDisplay(job) : "—").toUpperCase();

    return (
      <button
        key={assignment._id}
        type="button"
        title="Double-click to open full job page"
        onDoubleClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setHoverTooltip(null);
          clearHoverLeaveTimer();
          const jid = jobIdFromAssignment(assignment);
          if (jid) openJobPageOverBoard(jid, job);
        }}
        onMouseEnter={(e) => {
          clearHoverLeaveTimer();
          const pos = placeJobHoverTooltip(e.currentTarget.getBoundingClientRect());
          setHoverTooltip({
            assignment,
            vehicle,
            dayYmd,
            vehicleList,
            left: pos.left,
            top: pos.top,
          });
        }}
        onMouseLeave={scheduleHideJobHover}
        onClick={() => {
          selectAssignmentFromBoard(assignment, vehicleList);
        }}
        className={`absolute left-1 right-1 z-[8] rounded-md border text-[9px] leading-snug overflow-hidden shadow-sm transition-shadow border-l-[3px] border-l-slate-600 ${
          selected
            ? "bg-white border-blue-500 ring-2 ring-blue-500 border-l-blue-600"
            : "bg-white border-slate-300 hover:border-blue-400"
        }`}
        style={{ top, height: Math.min(height, gridBodyHeight - top) }}
      >
        <div className="h-full overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden flex flex-col items-stretch text-center min-w-0">
          <div className="w-full flex flex-col gap-0.5 px-1 pt-1 pb-1.5 bg-white">
            <div className="font-extrabold text-slate-800 text-[9px] tracking-wide truncate px-px">
              {scheduleBoardAppointmentTypeCaps(assignment, job)}
            </div>
            <div className="text-slate-700 text-[9px] font-normal tabular-nums">{timeLabel}</div>
            <div className="font-bold text-slate-800 text-[9px]">{statusLabel}</div>
          </div>
          <div className="h-px w-full bg-slate-200 shrink-0" aria-hidden />
          {/* <div className="w-full bg-slate-100 py-1 px-1 font-bold text-slate-800 text-[9px] truncate">
            {customerName(assignment.jobId)}
          </div> */}
          <div className="w-full bg-white py-1 ">
            <div className="w-full bg-slate-200 py-1  font-bold text-slate-800 text-[9px] truncate">
              {customerName(assignment.jobId)}
            </div>
            <div className="font-bold text-slate-800 text-[8px] px-1">Primary Address</div>
            <div className="text-[8px] text-slate-600 truncate mt-0.5 px-1">{job ? scheduleAddressLine(job) : "—"}</div>
          </div>
          <div className="h-px w-full bg-slate-200 shrink-0" aria-hidden />
          <div className="w-full bg-pink-100/95 py-1.5 px-1 font-bold text-rose-700 text-[9px] tracking-wide">
            {paymentCaps}
          </div>
          <div className="w-full bg-emerald-50 border-y border-emerald-200/80 py-1.5 px-1 font-bold text-slate-800 text-[8px] flex flex-col gap-0.5">
            <div>{jobBillingDocumentTitle(job)}</div>
            <div className="text-[10px] text-slate-900 tabular-nums">{job ? workOrderNumberDisplay(job) : "—"}</div>
            <div className="text-[9px] tabular-nums">Total: {totalStr}</div>
            {/* <div className="text-[9px] tabular-nums">Balance: {balanceStr}</div> */}
          </div>
          <div className="w-full bg-white py-1 px-1 font-bold text-slate-800 text-[8px] leading-tight">
            Tech(s): {technicianDisplayName(assignment, job)}
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] min-h-[640px] w-full max-w-full min-w-0 flex-col overflow-hidden bg-[#e4e9f0] text-slate-800">
      {/* Top toolbar — dispatch board reference styling */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-[#d6dee8] border-b border-slate-400/70 shrink-0 shadow-[inset_0_-1px_0_rgba(255,255,255,0.35)]">
        {!isSingleAssignedBusiness() && businesses.length > 1 ? (
          <div className="inline-flex items-center gap-1.5 min-w-0">
            <Building className="w-3.5 h-3.5 text-slate-600 shrink-0" aria-hidden />
            <select
              value={selectedBusiness}
              onChange={(e) => {
                const v = e.target.value;
                setSelectedBusiness(v);
                persistSelectedBusiness(v);
              }}
              className="text-xs font-semibold border border-slate-400/70 rounded-md px-2 py-1.5 bg-white min-w-[140px] max-w-[min(100%,220px)] shadow-sm"
              aria-label="Business"
            >
              {businesses.map((b) => (
                <option key={String(b._id)} value={String(b._id)}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="flex rounded-md border border-slate-400/80 overflow-hidden text-xs font-semibold shadow-sm">
          <button
            type="button"
            onClick={() => {
              setView("month");
              setMonthViewSelectedYmd(weekAnchor);
            }}
            className={`px-3 py-1.5 transition-colors ${
              view === "month"
                ? "bg-sky-100 text-blue-900 border-b-2 border-blue-600 -mb-px"
                : "bg-slate-200/90 text-slate-600 hover:bg-slate-100"
            }`}
          >
            Month
          </button>
          <button
            type="button"
            onClick={() => setView("week")}
            className={`px-3 py-1.5 border-l border-slate-400/60 transition-colors ${
              view === "week"
                ? "bg-sky-100 text-blue-900 border-b-2 border-blue-600 -mb-px"
                : "bg-slate-200/90 text-slate-600 hover:bg-slate-100"
            }`}
          >
            Week
          </button>
        </div>

        <div className="flex items-center rounded-md border border-slate-400/80 bg-white shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={goPrevMonth}
            className="p-1.5 text-slate-600 hover:bg-slate-100 border-r border-slate-200"
            aria-label="Previous month"
            title="Previous month"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={goPrevWeek}
            className="p-1.5 text-slate-600 hover:bg-slate-100 border-r border-slate-200"
            aria-label="Previous week"
            title="Previous week"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span
            className="min-w-[9.5rem] text-center text-xs font-semibold text-slate-800 px-2 py-1.5 tabular-nums bg-white"
            title="Visible week range"
          >
            {rangeLabel || "—"}
          </span>
          <button
            type="button"
            onClick={goNextWeek}
            className="p-1.5 text-slate-600 hover:bg-slate-100 border-l border-slate-200"
            aria-label="Next week"
            title="Next week"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={goNextMonth}
            className="p-1.5 text-slate-600 hover:bg-slate-100 border-l border-slate-200"
            aria-label="Next month"
            title="Next month"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={goThisWeek}
          className="text-xs font-semibold px-2.5 py-1.5 rounded-md border border-slate-400/70 bg-white text-slate-800 hover:bg-slate-50 shadow-sm"
        >
          This Week
        </button>

        <button
          type="button"
          onClick={() => refreshBoard()}
          className="p-1.5 rounded-md border border-slate-400/50 bg-white/80 hover:bg-white shadow-sm text-slate-600"
          aria-label="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>

        <select
          value={resourceFilter}
          onChange={(e) => setResourceFilter(e.target.value)}
          className="text-xs font-medium border border-slate-400/70 rounded-md px-2 py-1.5 bg-white max-w-[160px] shadow-sm"
        >
          <option value="all">All {fleetTerms.vehicleLabelPlural}</option>
          {vehicles.map((v) => (
            <option key={v._id} value={v._id}>
              {v.name}
            </option>
          ))}
        </select>

        <label
          className={`flex items-center gap-1.5 text-xs font-medium cursor-pointer select-none px-2 py-1 rounded-md border transition-colors ${
            stackConflicts
              ? "border-blue-500/80 text-blue-800 bg-sky-50/90 shadow-sm"
              : "border-slate-300/80 text-slate-600 bg-white/70 hover:bg-white"
          }`}
        >
          <input
            type="checkbox"
            checked={stackConflicts}
            onChange={(e) => setStackConflicts(e.target.checked)}
            className="rounded border-slate-400 text-blue-600 focus:ring-blue-500"
          />
          Stack Conflicts
        </label>

        <select
          value={density}
          onChange={(e) => setDensity(e.target.value)}
          title="Row height / cell size"
          className="text-xs font-medium border border-slate-400/70 rounded-md px-2 py-1.5 bg-white shadow-sm"
        >
          <option value="compact">compact (min 44px)</option>
          <option value="small">Small (56px)</option>
          <option value="medium">Medium (72px)</option>
          <option value="large">Large (88px)</option>
        </select>

        <div className=" min-w-[8px]" />

        {/* <button
          type="button"
          onClick={openDispatchMap}
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-white/80 text-slate-700 border border-transparent hover:border-slate-300/60"
          title="Map (dispatch location)"
        >
          <MapIcon className="w-4 h-4 shrink-0" />
          <span className="hidden xl:inline text-xs font-medium">Map</span>
        </button> */}
        <button
          type="button"
          onClick={() => setSidebarOpen((o) => !o)}
          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-slate-700 ${
            sidebarOpen
              ? "bg-white border-slate-300 shadow-sm"
              : "border-transparent hover:bg-white/80 hover:border-slate-300/60"
          }`}
          title="Sidebar"
          aria-expanded={sidebarOpen}
          aria-controls="scheduling-dispatch-sidebar"
        >
          <PanelRight className="w-4 h-4 shrink-0" />
          <span className="hidden xl:inline text-xs font-medium">Sidebar</span>
        </button>
      </div>

      <div className="flex min-h-0 min-w-0 w-full flex-1 overflow-hidden">
        {/* Main grid — flex column so first-load state can fill the remaining viewport under the toolbar */}
        <div className="flex flex-1 min-h-0 min-w-0 flex-col p-2 relative">
          {!businessesHydrated || (!hasLoadedScheduleOnce && loading) ? (
            <div className="flex flex-1 min-h-0 w-full min-w-0 items-center justify-center rounded-lg border border-slate-300/80 bg-white shadow-sm">
              <div className="flex flex-col items-center gap-3 text-slate-600 px-4 py-8" role="status" aria-live="polite">
                <Loader2 className="h-9 w-9 animate-spin text-[#0C2E5A]" aria-hidden />
                <span className="text-sm font-medium">
                  {!businessesHydrated ? "Loading…" : "Loading schedule…"}
                </span>
              </div>
            </div>
          ) : (
            <div className="min-h-0 min-w-0 flex-1 overflow-auto overscroll-x-contain">
            {view === "month" ? (
            <div
              className={`rounded-lg border border-slate-400/80 bg-white shadow-md w-full ${
                sidebarOpen ? "max-w-[1100px] mx-auto" : "max-w-none"
              }`}
            >
              {/* <div className="px-3 py-2 bg-[#eef2f6] border-b border-slate-300 text-[11px] text-slate-600">
                Open days match your{" "}
                <strong>business working days</strong> (Settings → Fleet management → Dispatch schedule). Closed days are
                shaded; you can still add and view jobs on any day in Week view.
              </div> */}
              <div className="sticky top-0 z-40 grid grid-cols-7 border-b border-slate-300 bg-slate-100 shadow-[0_2px_6px_rgba(15,23,42,0.08)]">
                {MONTH_GRID_WEEKDAYS.map((w) => (
                  <div
                    key={w}
                    className="text-center text-[10px] font-bold text-slate-600 py-2 border-r border-slate-200 last:border-r-0 bg-slate-100"
                  >
                    {w}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-px bg-slate-300">
                {monthCalendarCells.map((cell) => {
                  const summary = monthCellSummaries.get(cell.ymd) || {
                    total: 0,
                    pct: 0,
                    first: null,
                    firstVehicle: null,
                    list: [],
                  };
                  const isWorking = workingDaySet.has(cell.dow);
                  const todayYmd = toYMD(new Date());
                  const isTodayCell = cell.ymd === todayYmd;
                  const outOfMonth = !cell.inMonth;
                  const first = summary.first;
                  const firstVehicle = summary.firstVehicle;
                  const hasCellData = Array.isArray(summary.list) && summary.list.length > 0;
                  const startM = first?.startTime != null ? timeToMinutes(first.startTime) : null;
                  const startHm =
                    startM != null
                      ? minutesToLabel(startM)
                          .replace(/\s*AM\s*$/i, "am")
                          .replace(/\s*PM\s*$/i, "pm")
                      : "";
                  const isMonthCellSelected = monthViewSelectedYmd === cell.ymd;
                  const monthJobSelected = first && selectedAssignment?._id === first._id;
                  return (
                    <div
                      key={`${cell.ymd}-${cell.dow}`}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setMonthViewSelectedYmd(cell.ymd);
                        }
                      }}
                      onClick={() => setMonthViewSelectedYmd(cell.ymd)}
                      onDoubleClick={(e) => {
                        e.preventDefault();
                        goToWeekForDate(cell.ymd);
                      }}
                      title="Select day — double-click to open week view"
                      className={`group relative flex flex-col items-stretch justify-start min-h-[108px] text-left overflow-hidden transition-[filter,background-color] duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset cursor-default ${
                        isMonthCellSelected ? "z-[2]" : "z-0"
                      } ${cell.inMonth ? "text-slate-900" : "text-slate-400"} ${
                        !isWorking
                          ? "hover:brightness-[0.98]"
                          : isTodayCell
                            ? "bg-[#FFF8E0] hover:brightness-[0.99]"
                            : outOfMonth
                              ? "bg-[#EFEFEF] hover:brightness-[0.97]"
                              : "bg-white hover:bg-sky-50/90"
                      }`}
                      style={
                        !isWorking ? monthClosedDayFullCellStyle(outOfMonth, isTodayCell) : undefined
                      }
                    >
                      <div
                        className={`relative z-[1] shrink-0 px-1.5 pt-1.5 pb-1 flex items-start justify-between gap-1 ${
                          isWorking
                            ? isTodayCell
                              ? "bg-[#FFF8E0]"
                              : outOfMonth
                                ? "bg-[#EFEFEF]"
                                : "bg-[#F5FBFF]"
                            : ""
                        }`}
                      >
                        <div className="min-w-0 self-start">
                          <span className="block text-[13px] font-bold tabular-nums leading-none text-slate-800">
                            {cell.date.getDate()}
                          </span>
                          {!isWorking && (
                            <div className="text-[8px] font-semibold text-slate-500 uppercase mt-0.5 tracking-wide">
                              Closed
                            </div>
                          )}
                        </div>
                        {hasCellData && (
                          <div className="flex flex-col items-end gap-0.5 shrink-0 text-[9px] self-start">
                            <span className="inline-flex flex-row items-center gap-0.5 text-emerald-700 font-bold tabular-nums leading-none whitespace-nowrap">
                              {summary.pct}%
                              <Thermometer className="w-3 h-3 shrink-0 text-emerald-600" aria-hidden />
                            </span>
                            <span className="text-slate-700 font-semibold tabular-nums leading-none">
                              {formatMoneyDisplay(summary.total, scheduleCurrency)}
                            </span>
                          </div>
                        )}
                      </div>
                      <div
                        className={`relative z-[1] flex-1 flex flex-col justify-end min-h-0 px-1.5 pb-1.5 pt-1 ${
                          isWorking
                            ? isTodayCell
                              ? "bg-[#FFF8E0]"
                              : outOfMonth
                                ? "bg-[#EFEFEF]"
                                : "bg-white"
                            : ""
                        }`}
                      >
                        {first && firstVehicle && (
                          <button
                            type="button"
                            title="Double-click to open full job page"
                            className={`relative z-[6] flex w-full items-start gap-1 min-w-0 rounded border px-1 py-1 shrink-0 text-left cursor-pointer transition-shadow ${
                              monthJobSelected
                                ? "border-blue-500 bg-white ring-2 ring-blue-500"
                                : isTodayCell
                                  ? "border-amber-300/80 bg-amber-50/70 hover:border-blue-400"
                                  : "border-slate-200 bg-white/90 backdrop-blur-[2px] hover:border-blue-400"
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              selectAssignmentFromBoard(first, filteredVehicles);
                            }}
                            onDoubleClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setHoverTooltip(null);
                              clearHoverLeaveTimer();
                              const jid = jobIdFromAssignment(first);
                              if (jid) openJobPageOverBoard(jid, jobDocForModalPreview(first));
                            }}
                            onMouseEnter={(e) => {
                              clearHoverLeaveTimer();
                              const pos = placeJobHoverTooltip(e.currentTarget.getBoundingClientRect());
                              setHoverTooltip({
                                assignment: first,
                                vehicle: firstVehicle,
                                dayYmd: cell.ymd,
                                vehicleList: filteredVehicles,
                                left: pos.left,
                                top: pos.top,
                              });
                            }}
                            onMouseLeave={scheduleHideJobHover}
                          >
                            <User
                              className={`w-3 h-3 shrink-0 mt-0.5 ${
                                isTodayCell ? "text-amber-700" : "text-blue-700"
                              }`}
                              aria-hidden
                            />
                            <div
                              className={`min-w-0 text-[9px] leading-tight ${
                                isTodayCell ? "text-amber-900" : "text-slate-700"
                              }`}
                            >
                              <div className="font-semibold tabular-nums">{startHm}</div>
                              <div className="truncate font-medium">{customerName(first.jobId)}</div>
                            </div>
                          </button>
                        )}
                      </div>
                      {/* Inset border above cell content so hover (#CBEFFF) / selected (#56A6FF) stay visible in month preview */}
                      <span
                        className={`pointer-events-none absolute inset-0 z-[5] transition-[box-shadow] duration-150 ${
                          isMonthCellSelected
                            ? "shadow-[inset_0_0_0_2px_#56A6FF]"
                            : "shadow-[inset_0_0_0_2px_transparent] group-hover:shadow-[inset_0_0_0_3px_#CBEFFF] group-focus-visible:shadow-[inset_0_0_0_2px_#56A6FF]"
                        }`}
                        aria-hidden
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            ) : (
            <div
              ref={gridBoardRef}
              className="flex min-w-full w-max max-w-none flex-col rounded-md border border-slate-400/80 bg-white shadow-md"
            >
              {!scheduleBoardHasRealVehicles && (
                <div className="px-3 py-2 text-xs text-slate-700 bg-amber-50/95 border-b border-amber-200/90">
                  No {fleetTerms.vehicleLabelPlural.toLowerCase()} yet. Add them under{" "}
                  <strong>Settings → Fleet management → {fleetTerms.vehicleLabelPlural}</strong>, then refresh. The
                  week below uses your <strong>dispatch schedule</strong> (hours and working days).
                </div>
              )}
              {/* Corner + day headers — sticky while scrolling the time grid */}
              <div className="sticky top-0 z-40 flex min-w-full w-max border-b border-slate-400/70 bg-[#eef2f6] shadow-[0_2px_8px_rgba(15,23,42,0.12)]">
                <div
                  className="shrink-0 border-r border-slate-400/70 bg-[#eef2f6] relative flex flex-col justify-end items-stretch overflow-hidden"
                  style={{ width: TIME_GUTTER_WIDTH_PX, minWidth: TIME_GUTTER_WIDTH_PX }}
                >
                  <div
                    className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-violet-500 via-sky-400 to-amber-400 opacity-90"
                    aria-hidden
                  />
                  <div className="flex items-center justify-end gap-0.5 pr-0.5 pb-1 pl-1">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full bg-gradient-to-br from-rose-400 via-amber-300 to-emerald-500 ring-1 ring-white/80"
                      aria-hidden
                    />
                    <span className="text-[9px] font-medium text-slate-600 tabular-nums leading-none">
                      {formatLocalUtcOffsetLabel()}
                    </span>
                  </div>
                </div>
                {visibleWeekDays.map((day) => {
                  const isWorkingCol = workingDaySet.has(day.date.getDay());
                  return (
                  <div
                    key={day.ymd}
                    className={`relative flex flex-1 flex-col border-r border-slate-400/70 last:border-r-0 ${
                      isWorkingCol ? "bg-[#e8edf3]" : "bg-slate-100/95"
                    }`}
                    style={{
                      minWidth: weekDayColumnMinPx,
                      ...(!isWorkingCol ? closedColumnPatternStyle() : {}),
                    }}
                  >
                    <div className="border-b border-slate-300/80 py-1.5 text-center">
                      <div className="font-regular font-serif text-[14px] tracking-tight text-gray-500">
                        {day.weekday} {day.rest}
                      </div>
                      {!isWorkingCol && (
                        <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                          Closed
                        </div>
                      )}
                      <div className="text-[12px] font-semibold tabular-nums text-emerald-700">
                        {formatMoneyDisplay(dayTotals.get(day.ymd) || 0, scheduleCurrency)}
                      </div>
                    </div>
                    <div className="flex w-full min-w-0 flex-1">
                      {boardVehicles.map((v) => (
                        <div
                          key={`${day.ymd}-${v._id}`}
                          className={`flex min-w-0 flex-1 basis-0 flex-col items-center justify-center border-r border-sky-200/80 py-1.5 text-center last:border-r-0 ${
                            v.__scheduleBoardPlaceholder ? "bg-slate-100/90" : "bg-sky-100/90"
                          }`}
                          style={{ minWidth: VEHICLE_LANE_MIN_PX }}
                        >
                          <Truck
                            className={`mx-auto mb-0.5 h-4 w-4 shrink-0 ${
                              v.__scheduleBoardPlaceholder ? "text-slate-400" : "text-blue-800"
                            }`}
                            strokeWidth={2.25}
                          />
                          <div
                            className={`line-clamp-2 w-full px-1 text-[11px] font-bold leading-tight ${
                              v.__scheduleBoardPlaceholder ? "text-slate-600 italic" : "text-blue-950"
                            }`}
                            title={v.name}
                          >
                            {v.name}
                          </div>
                          <div className="mt-0.5 text-[10px] font-semibold tabular-nums leading-none text-emerald-700">
                            {formatMoneyDisplay(dayVehicleTotals.get(`${day.ymd}|${String(v._id)}`) || 0, scheduleCurrency)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  );
                })}
              </div>

              {/* Time rows + cells */}
              <div className="flex min-w-full w-max">
                <div
                  className="shrink-0 border-r border-slate-400/70 bg-[#f4f6f9] text-[10px] text-slate-700 relative overflow-hidden"
                  style={{
                    width: TIME_GUTTER_WIDTH_PX,
                    minWidth: TIME_GUTTER_WIDTH_PX,
                    height: gridBodyHeight,
                  }}
                >
                  <div
                    className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-violet-500 via-sky-400 to-amber-400 opacity-90 pointer-events-none"
                    aria-hidden
                  />
                  {timeSlots.map((slot) => (
                    <div
                      key={slot.minutes}
                      className="text-right pr-0.5 pl-0.5 border-b border-slate-300/70 flex items-start justify-end font-medium leading-tight"
                      style={{ height: cellSize }}
                    >
                      {slot.label.replace(" ", "\u00A0")}
                    </div>
                  ))}
                </div>

                {visibleWeekDays.map((day) => {
                  const isWorkingCol = workingDaySet.has(day.date.getDay());
                  const isTodayCol = day.isToday;
                  const workingCellBg = isTodayCol ? "#FFF8E0" : "#ffffff";
                  const closedCellBg = isTodayCol ? "#FFF8E0" : "#efefef";
                  const slotRowLines = `repeating-linear-gradient(
                    to bottom,
                    ${workingCellBg},
                    ${workingCellBg} ${cellSize - 1}px,
                    rgba(148,163,184,0.2) ${cellSize - 1}px,
                    rgba(148,163,184,0.2) ${cellSize}px
                  )`;
                  const closedSlotRowLines = `repeating-linear-gradient(
                    to bottom,
                    ${closedCellBg},
                    ${closedCellBg} ${cellSize - 1}px,
                    rgba(148,163,184,0.22) ${cellSize - 1}px,
                    rgba(148,163,184,0.22) ${cellSize}px
                  )`;
                  return (
                  <div
                    key={`body-${day.ymd}`}
                    className={`relative flex flex-1 border-r border-slate-400/70 last:border-r-0 ${
                      isTodayCol ? "z-[1] ring-2 ring-blue-500 ring-inset" : ""
                    } ${!isWorkingCol ? "bg-[#EFEFEF]" : ""}`}
                    style={{ minWidth: weekDayColumnMinPx }}
                  >
                    {boardVehicles.map((v) => {
                      const key = `${day.ymd}|${String(v._id)}`;
                      const assignments = assignMap.get(key) || [];
                      const slotBg = isWorkingCol ? workingCellBg : closedCellBg;
                      const canAddJobHere = scheduleBoardHasRealVehicles && !v.__scheduleBoardPlaceholder;
                      return (
                        <div
                          key={key}
                          className="relative min-w-0 flex-1 basis-0 border-r border-slate-300/80 last:border-r-0"
                          style={{
                            minWidth: VEHICLE_LANE_MIN_PX,
                            height: gridBodyHeight,
                            backgroundColor: slotBg,
                            backgroundImage: isWorkingCol ? slotRowLines : closedSlotRowLines,
                          }}
                        >
                          {assignments.map((a) =>
                            renderJobBlock(a, filteredVehicles, v, day.ymd),
                          )}
                          {timeSlots.map((slot) => {
                            const slotIndex = Math.round((slot.minutes - gridStartMins) / slotMinutes);
                            const top = slotIndex * cellSize;
                            const endBlock = Math.min(slot.minutes + slotMinutes, gridEndMins);
                            return (
                              <div
                                key={`slot-${slot.minutes}`}
                                className={`group absolute left-0 right-0 z-[1] transition-colors ${
                                  canAddJobHere ? "hover:bg-sky-100/80" : ""
                                }`}
                                style={{ top, height: cellSize }}
                                title={canAddJobHere ? "Hover to add a job" : undefined}
                              >
                                {canAddJobHere ? (
                                  <button
                                    type="button"
                                    className="absolute left-1/2 top-1/2 z-[3] -translate-x-1/2 -translate-y-1/2 text-[28px] leading-none font-semibold text-emerald-500 opacity-0 pointer-events-none transition-opacity duration-150 group-hover:opacity-100 group-hover:pointer-events-auto focus:opacity-100 focus:pointer-events-auto focus:outline-none"
                                    aria-label="Create job in this slot"
                                    title="Create job in this slot"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setHoverTooltip(null);
                                      clearHoverLeaveTimer();
                                      setCreateJobModal({
                                        open: true,
                                        dayYmd: day.ymd,
                                        vehicle: v,
                                        startTime: minutesToTimeStr(slot.minutes),
                                        endTime: minutesToTimeStr(endBlock),
                                      });
                                    }}
                                  >
                                    +
                                  </button>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                  );
                })}
              </div>
            </div>
            )}
            </div>
          )}
          {hasLoadedScheduleOnce && loading ? (
            <div
              className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-white/55 backdrop-blur-[1px]"
              role="status"
              aria-live="polite"
            >
              <div className="flex flex-col items-center gap-2 rounded-lg border border-slate-200 bg-white/95 px-6 py-5 shadow-lg">
                <Loader2 className="h-8 w-8 animate-spin text-[#0C2E5A]" aria-hidden />
                <span className="text-xs font-medium text-slate-600">Updating schedule…</span>
              </div>
            </div>
          ) : null}
        </div>

        {/* Right sidebar — fixed width; board scrolls horizontally inside the left pane only */}
        {sidebarOpen && (
          <aside
            id="scheduling-dispatch-sidebar"
            className="flex w-[min(100%,380px)] shrink-0 flex-col overflow-hidden border-l border-slate-300 bg-[#f2f5f8] shadow-[inset_1px_0_0_rgba(255,255,255,0.6)] sm:w-[380px]"
          >
            <div className="flex text-xs font-semibold border-b border-slate-300 bg-[#e4e9ef]" role="tablist" aria-label="Dispatch queue sidebar">
              {dispatchQueueTabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={sidebarTab === t.id}
                  onClick={() => selectDispatchQueueTab(t.id)}
                  className={`flex-1 py-2 px-2 border-r border-slate-300/80 last:border-r-0 ${
                    sidebarTab === t.id
                      ? "bg-[#f8fafc] text-slate-900"
                      : "text-slate-600 hover:bg-white/40"
                  }`}
                >
                  {t.label} ({t.count})
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {sidebarTab === "ondeck" ? (
                <div className="space-y-2">
                  <p className="text-[11px] text-slate-600 leading-snug px-0.5">
                    Work orders without a {fleetTerms.vehicleLabelSingular.toLowerCase()} and time. Use the chevron
                    to expand details; click the customer row to open scheduling.
                  </p>
                  {unscheduledJobs.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-10">No jobs on deck.</p>
                  ) : (
                    unscheduledJobs.map((job) => {
                      const isActive = String(activeJobId || "") === String(job._id);
                      const open = isActive && !!expandedSidebarCards[job._id];
                      return (
                        <div
                          key={job._id}
                          className={`rounded-md border-t border-l border-b border-slate-300 border-r-[4px] border-r-amber-500 bg-white shadow-sm overflow-hidden ${
                            String(activeJobId || "") === String(job._id) ? "ring-2 ring-blue-500" : ""
                          }`}
                        >
                          <div
                            className="flex items-center gap-1 px-2 py-1.5 border-b border-slate-200 bg-white cursor-pointer hover:bg-slate-50/80"
                            onClick={() => {
                              setSelectedOnDeckJobId(job._id);
                              setActiveJobId(job._id);
                              setSelectedAssignment(null);
                              setExpandedSidebarCards((prev) => ({ ...prev, [job._id]: true }));
                            }}
                            onDoubleClick={(e) => {
                              e.preventDefault();
                              openJobPageOverBoard(job._id, job);
                            }}
                            title="Double-click to open full job"
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setSelectedOnDeckJobId(job._id);
                                setActiveJobId(job._id);
                                setSelectedAssignment(null);
                                setExpandedSidebarCards((prev) => ({ ...prev, [job._id]: true }));
                              }
                            }}
                          >
                            <span className="text-[10px] font-semibold text-slate-800 tabular-nums shrink-0">
                              {formatDeckQueueTimeLabel(job)}
                            </span>
                            <GripVertical className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden />
                            <span className="flex-1 min-w-[4px]" />
                            <span className="text-[10px] font-bold text-slate-900 shrink-0">Unscheduled Appt</span>
                            <button
                              type="button"
                              className="shrink-0 p-0.5 rounded hover:bg-slate-100 text-slate-600"
                              aria-expanded={open}
                              aria-label={open ? "Hide details" : "Show details"}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveJobId(job._id);
                                toggleSidebarCard(job._id);
                              }}
                            >
                              <ChevronDown
                                className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
                              />
                            </button>
                          </div>
                          {open && (
                            <div className="px-2 pt-0 pb-2">
                              <OnDeckExpandedDetails
                                job={job}
                                currencyCode={scheduleCurrency}
                                onDownloadWorkOrderPdf={handleDownloadWorkOrderPdf}
                                pdfDownloadingId={pdfDownloadingId}
                                onDispatchNotesChanged={refreshBoard}
                                onOpenJob={() => openJobPageOverBoard(job._id, job)}
                                onOpenEmail={() => openDispatchEmail(job)}
                                onOpenRecordPayment={() => openDispatchRecordPayment(job)}
                                onOpenCompletionWizard={() => openDispatchCompletionWizard(job._id)}
                                onOpenTechnicians={() =>
                                  setTechnicianPicker({
                                    open: true,
                                    job,
                                    assignment: null,
                                  })
                                }
                              />
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              ) : sidebarTab === "waiting" ? (
                waitingAssignments.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-8">No jobs in waiting list.</p>
                ) : (
                  <div className="space-y-2">
                    {waitingAssignments.map((a) => {
                      const isActive = String(activeJobId || "") === String(jobIdFromAssignment(a) || "");
                      const open = isActive && !!expandedSidebarCards[a._id];
                      return (
                        <div
                          key={a._id}
                          className={`rounded-md border-t border-l border-b border-slate-300 border-r-[4px] border-r-amber-500 bg-white shadow-sm overflow-hidden ${
                            String(activeJobId || "") === String(jobIdFromAssignment(a) || "")
                              ? "ring-2 ring-blue-500"
                              : ""
                          }`}
                        >
                          <div
                            className="flex items-center gap-1 px-2 py-1.5 border-b border-slate-200 cursor-pointer hover:bg-slate-50/80"
                            onClick={() => {
                              setSelectedOnDeckJobId(null);
                              setActiveJobId(jobIdFromAssignment(a));
                              setSelectedAssignment({ ...a, vehicleList: filteredVehicles });
                              setExpandedSidebarCards((prev) => ({ ...prev, [a._id]: true }));
                            }}
                            onDoubleClick={() => {
                              const jid = jobIdFromAssignment(a);
                              if (jid) openJobPageOverBoard(jid, jobDocForModalPreview(a));
                            }}
                            title="Double-click to open full job"
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setSelectedOnDeckJobId(null);
                                setActiveJobId(jobIdFromAssignment(a));
                                setSelectedAssignment({ ...a, vehicleList: filteredVehicles });
                                setExpandedSidebarCards((prev) => ({ ...prev, [a._id]: true }));
                              }
                            }}
                          >
                            <span className="text-[10px] font-semibold text-slate-800 tabular-nums shrink-0">
                              {assignmentQueueTimeLabel(a)}
                            </span>
                            <GripVertical className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden />
                            <span className="flex-1 min-w-[4px]" />
                            <span className="text-[10px] font-bold text-slate-900 shrink-0">{`${assignmentStatusLabel(a.status)} Appt`}</span>
                            <button
                              type="button"
                              className="shrink-0 p-0.5 rounded hover:bg-slate-100 text-slate-600"
                              aria-expanded={open}
                              aria-label={open ? "Hide details" : "Show details"}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveJobId(jobIdFromAssignment(a));
                                toggleSidebarCard(a._id);
                              }}
                            >
                              <ChevronDown
                                className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
                              />
                            </button>
                          </div>
                          {open && (
                            <div className="px-2 pt-0 pb-2">
                              <ExpandedAssignmentSidebarDetails
                                assignment={a}
                                vehicleList={filteredVehicles}
                                fleetTerms={fleetTerms}
                                currencyCode={scheduleCurrency}
                                onDownloadWorkOrderPdf={handleDownloadWorkOrderPdf}
                                pdfDownloadingId={pdfDownloadingId}
                                onDispatchNotesChanged={refreshBoard}
                                onStatusUpdate={(status) => handleStatusUpdate(a._id, status)}
                                onMoveVehicle={(vehicleId) => handleMoveVehicle(a._id, vehicleId)}
                                onOpenJob={() => {
                                  const jid = jobIdFromAssignment(a);
                                  if (jid) openJobPageOverBoard(jid, jobDocForModalPreview(a));
                                }}
                                onOpenEmail={() => {
                                  const j = a.jobId && typeof a.jobId === "object" ? a.jobId : null;
                                  if (j) openDispatchEmail(j, { assignment: a, dayYmd: a.dayYmd });
                                }}
                                onOpenRecordPayment={() => {
                                  const j = a.jobId && typeof a.jobId === "object" ? a.jobId : null;
                                  if (j) openDispatchRecordPayment(j);
                                }}
                                onOpenCompletionWizard={() => {
                                  const jid = jobIdFromAssignment(a);
                                  if (jid) openDispatchCompletionWizard(jid);
                                }}
                                onOpenTechnicians={() => {
                                  const jid = jobIdFromAssignment(a);
                                  const doc =
                                    typeof a.jobId === "object" && a.jobId?._id
                                      ? a.jobId
                                      : jid
                                        ? { _id: jid, technicianNames: [] }
                                        : null;
                                  if (!doc?._id) return;
                                  setTechnicianPicker({
                                    open: true,
                                    job: doc,
                                    assignment: a,
                                  });
                                }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
              ) : scheduledAssignments.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-8">
                  No scheduled jobs for the selected week/resources.
                </p>
              ) : (
                <div className="space-y-2">
                  {scheduledAssignments.map((a) => {
                    const isActive = String(activeJobId || "") === String(jobIdFromAssignment(a) || "");
                    const open = isActive && !!expandedSidebarCards[a._id];
                    const vName = a.vehicle?.name || "Van";
                    return (
                      <div
                        key={a._id}
                        className={`rounded-md border-t border-l border-b border-slate-300 border-r-[4px] border-r-sky-400 bg-white shadow-sm overflow-hidden ${
                          String(activeJobId || "") === String(jobIdFromAssignment(a) || "")
                            ? "ring-2 ring-blue-500"
                            : ""
                        }`}
                      >
                        <div
                          className="flex items-center gap-1 px-2 py-1.5 border-b border-slate-200 cursor-pointer hover:bg-slate-50/80"
                          onClick={() => {
                            setSelectedOnDeckJobId(null);
                            setActiveJobId(jobIdFromAssignment(a));
                            setSelectedAssignment({ ...a, vehicleList: filteredVehicles });
                            setExpandedSidebarCards((prev) => ({ ...prev, [a._id]: true }));
                          }}
                          onDoubleClick={() => {
                            const jid = jobIdFromAssignment(a);
                            if (jid) openJobPageOverBoard(jid, jobDocForModalPreview(a));
                          }}
                          title="Double-click to open full job"
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelectedOnDeckJobId(null);
                              setActiveJobId(jobIdFromAssignment(a));
                              setSelectedAssignment({ ...a, vehicleList: filteredVehicles });
                              setExpandedSidebarCards((prev) => ({ ...prev, [a._id]: true }));
                            }
                          }}
                        >
                          <span className="text-[10px] font-semibold text-slate-800 tabular-nums shrink-0">
                            {assignmentQueueTimeLabel(a)}
                          </span>
                          <GripVertical className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden />
                          <span className="flex-1 min-w-0 text-[10px] font-bold text-slate-900 truncate text-right">
                            Route | {vName}
                          </span>
                          <Truck className="w-3.5 h-3.5 text-sky-600 shrink-0" aria-hidden />
                          <button
                            type="button"
                            className="shrink-0 p-0.5 rounded hover:bg-slate-100 text-slate-600"
                            aria-expanded={open}
                            aria-label={open ? "Hide details" : "Show details"}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveJobId(jobIdFromAssignment(a));
                              toggleSidebarCard(a._id);
                            }}
                          >
                            <ChevronDown
                              className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
                            />
                          </button>
                        </div>
                        {open && (
                          <div className="px-2 pt-0 pb-2">
                            <ExpandedAssignmentSidebarDetails
                              assignment={a}
                              vehicleList={filteredVehicles}
                              fleetTerms={fleetTerms}
                              currencyCode={scheduleCurrency}
                              onDownloadWorkOrderPdf={handleDownloadWorkOrderPdf}
                              onDispatchNotesChanged={refreshBoard}
                              onStatusUpdate={(status) => handleStatusUpdate(a._id, status)}
                              onMoveVehicle={(vehicleId) => handleMoveVehicle(a._id, vehicleId)}
                              onOpenJob={() => {
                                const jid = jobIdFromAssignment(a);
                                if (jid) openJobPageOverBoard(jid, jobDocForModalPreview(a));
                              }}
                              onOpenEmail={() => {
                                const j = a.jobId && typeof a.jobId === "object" ? a.jobId : null;
                                if (j) openDispatchEmail(j, { assignment: a, dayYmd: a.dayYmd });
                              }}
                              onOpenRecordPayment={() => {
                                const j = a.jobId && typeof a.jobId === "object" ? a.jobId : null;
                                if (j) openDispatchRecordPayment(j);
                              }}
                              onOpenCompletionWizard={() => {
                                const jid = jobIdFromAssignment(a);
                                if (jid) openDispatchCompletionWizard(jid);
                              }}
                              onOpenTechnicians={() => {
                                const jid = jobIdFromAssignment(a);
                                const doc =
                                  typeof a.jobId === "object" && a.jobId?._id
                                    ? a.jobId
                                    : jid
                                      ? { _id: jid, technicianNames: [] }
                                      : null;
                                if (!doc?._id) return;
                                setTechnicianPicker({
                                  open: true,
                                  job: doc,
                                  assignment: a,
                                });
                              }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      <ScheduleTechniciansModal
        isOpen={technicianPicker.open}
        onClose={() => setTechnicianPicker({ open: false, job: null, assignment: null })}
        businessId={
          selectedBusiness ||
          (businesses.length === 1 ? String(businesses[0]._id) : "") ||
          ""
        }
        job={technicianPicker.job}
        assignment={technicianPicker.assignment}
        onSaved={() => refreshBoard()}
      />

      <SchedulingDispatchEmailModal
        open={dispatchEmail.open}
        onClose={closeDispatchEmail}
        job={dispatchEmail.job}
        assignment={dispatchEmail.assignment}
        dayYmd={dispatchEmail.dayYmd}
        scheduleCurrency={scheduleCurrency}
        businessId={selectedBusiness || (businesses.length === 1 ? String(businesses[0]._id) : "")}
        businessRecord={dispatchBusinessForPdf}
        customerDisplayName={dispatchEmail.job ? customerName(dispatchEmail.job) : "Customer"}
        adminInfo={adminInfo}
      />

      <CreateJobFromScheduleModal
        isOpen={createJobModal.open}
        onClose={() => setCreateJobModal((m) => ({ ...m, open: false }))}
        initial={{
          dayYmd: createJobModal.dayYmd,
          vehicle: createJobModal.vehicle,
          startTime: createJobModal.startTime,
          endTime: createJobModal.endTime,
          businessId:
            selectedBusiness ||
            (businesses.length === 1 ? businesses[0]._id : "") ||
            "",
        }}
        vehicles={vehicles}
        fleetTerminology={fleetTerms}
        onCreated={() => refreshBoard()}
      />

      {typeof document !== "undefined" &&
        hoverTooltip &&
        createPortal(
          <div
            className="fixed z-[200] w-[340px] rounded border border-slate-300 bg-white shadow-xl text-xs text-slate-800 pointer-events-auto"
            style={{ left: hoverTooltip.left, top: hoverTooltip.top }}
            role="tooltip"
            onMouseEnter={clearHoverLeaveTimer}
            onMouseLeave={scheduleHideJobHover}
          >
            {(() => {
              const a = hoverTooltip.assignment;
              const job = a.jobId && typeof a.jobId === "object" ? a.jobId : null;
              const veh = hoverTooltip.vehicle;
              const timeRange = formatHoverTimeRange(
                hoverTooltip.dayYmd,
                a.startTime,
                a.endTime,
              );
              const techName =
                a.technicianName ||
                a.assignedTechnicianName ||
                job?.technicianName ||
                "Unassigned";
              const totalStr = formatJobTotalDisplay(job, scheduleCurrency);
              const balanceStr = formatJobBalanceDisplay(job, scheduleCurrency);
              const paymentLabel = paymentStatusDisplay(job);
              const selectFromTip = () => {
                selectAssignmentFromBoard(a, hoverTooltip.vehicleList);
              };

              return (
                <>
                  <div className="px-3 pt-2.5 pb-2 border-b border-slate-200">
                    <div className="flex justify-between gap-2 items-start">
                      <div>
                        {job?.priority === "high" ? (
                          <div className="text-[10px] font-semibold text-amber-800 uppercase tracking-wide mb-0.5">
                            This is an important job
                          </div>
                        ) : null}
                        <div className="text-[13px] font-semibold text-slate-900 leading-tight">
                          {scheduleHoverHeadlineFromAssignment(a, job)}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {assignmentStatusLabel(a.status)}
                        </div>
                        <div className="text-[11px] text-slate-700 font-semibold mt-1">
                          Payment: {paymentLabel}
                        </div>
                      </div>
                      <div className="text-right shrink-0 flex items-start gap-1.5">
                        <div className="text-[11px] text-slate-700 leading-tight max-w-[200px]">
                          {timeRange}
                        </div>
                        <Truck className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" aria-hidden />
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 mt-2 text-[11px] text-slate-600">
                      <User className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden />
                      <span className="truncate">{techName}</span>
                    </div>
                  </div>

                  <div className="flex min-h-[140px]">
                    <div className="w-[108px] shrink-0 bg-emerald-50/90 border-r border-emerald-100/80 px-2.5 py-2.5 flex flex-col gap-1.5">
                      <div className="text-[10px] font-medium text-slate-600 leading-tight tabular-nums">
                        {totalStr}
                      </div>
                      <button
                        type="button"
                        onClick={selectFromTip}
                        className="text-left text-[11px] font-medium text-blue-600 hover:underline"
                      >
                        {workOrderLabel(job)}
                      </button>
                      <div className="text-[9px] text-slate-600 space-y-0.5">
                        <div className="font-semibold text-slate-800">
                          Balance: <span className="tabular-nums">{balanceStr}</span>
                        </div>
                        <div>Created: {formatShortDate(job?.createdAt)}</div>
                        <div className="text-slate-700 font-medium pt-0.5">
                          {categoryFromPriority(job)}
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 px-3 py-2.5">
                      {businessDisplayName(job) ? (
                        <div className="text-[11px] font-semibold text-slate-800 truncate">
                          {businessDisplayName(job)}
                        </div>
                      ) : null}
                      <button
                        type="button"
                        onClick={selectFromTip}
                        className="text-left text-[12px] font-medium text-blue-600 hover:underline truncate block w-full"
                      >
                        {customerName(job)}
                      </button>
                      <div className="text-[10px] font-semibold text-slate-600 mt-2 mb-0.5">
                        Primary Address
                      </div>
                      <div className="text-[11px] text-slate-600 leading-snug">
                        {job ? scheduleAddressLine(job) : "—"}
                      </div>
                      {veh?.name && (
                        <div className="text-[10px] text-slate-500 mt-2 truncate">
                          {fleetTerms.vehicleLabelSingular}: {veh.name}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>,
          document.body,
        )}
    </div>
  );
}
