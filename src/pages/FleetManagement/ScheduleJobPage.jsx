import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useHistory, useLocation, useParams } from "react-router-dom";
import { ArrowLeft, Calendar, CheckCircle, Clock, Loader2, Mail, Truck, Wallet } from "lucide-react";
import { notifyError, notifySuccess } from "@/utils/toast";
import FleetManagementServices from "@/services/FleetManagementServices";
import SalesOrderServices from "@/services/SalesOrderServices";
import { AdminContext } from "@/context/AdminContext";
import SchedulingDispatchEmailModal from "./SchedulingDispatchEmailModal.jsx";
import {
  DEFAULT_FLEET_TERMINOLOGY,
  normalizeFleetTerminology,
} from "@/utils/fleetTerminology";
import {
  billingDocIdPrefix,
  jobBillingDocumentTitle,
  jobBillingDocumentTitleLower,
  shouldRouteRecordPaymentViaInvoice,
} from "@/utils/fleetJobBillingLabels";
import { getModuleRoutePath } from "@/utils/moduleLabels";

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toYMD(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function assignmentDateToYmd(value) {
  if (value == null || value === "") return toYMD(new Date());
  if (typeof value === "string" && value.length >= 10) return value.slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return toYMD(new Date());
  return toYMD(d);
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

function primaryAddressLine(job) {
  const addrs = job?.customerId?.addresses;
  if (!Array.isArray(addrs) || addrs.length === 0) return "—";
  const a = addrs[0];
  const parts = [a.addressLine1, a.city, a.state, a.zipCode].filter(Boolean);
  return parts.length ? parts.join(", ") : "—";
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

function jobDocLabel(job) {
  return jobBillingDocumentTitleLower(job);
}

/** Fills the modal (no tiny 200px strip). Optional preview job from the schedule board for instant context. */
function ScheduleJobLoadingPanel({ onBack, previewJob }) {
  const showHead = previewJob?._id;
  return (
    <div
      className="bg-[#e4e9f0] text-slate-800 min-h-[min(78vh,720px)] flex flex-col"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="shrink-0 border-b border-slate-400/70 bg-[#d6dee8] px-4 py-3 flex items-center gap-3 shadow-[inset_0_-1px_0_rgba(255,255,255,0.35)]">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-md border border-slate-400/70 bg-white text-slate-800 hover:bg-slate-50 shadow-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Schedule board
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <Loader2 className="h-4 w-4 shrink-0 text-[#0C2E5A] animate-spin" aria-hidden />
          <span id="schedule-job-modal-title" className="text-xs font-semibold text-slate-600 truncate">
            Loading {jobDocLabel(previewJob)}…
          </span>
        </div>
      </div>
      <div className="max-w-3xl mx-auto w-full px-4 pt-6 pb-4 flex-1 flex flex-col min-h-0">
        <div className="rounded-lg border border-slate-400/80 bg-white shadow-md overflow-hidden flex-1 flex flex-col min-h-0">
          {showHead ? (
            <div className="shrink-0 px-4 py-3 bg-gradient-to-r from-[#1e4a7a] to-[#2d5a8f] text-white">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-white/80">
                {jobBillingDocumentTitle(previewJob)}
              </div>
              <h2 className="text-lg font-bold leading-tight mt-0.5">{previewJob.title || "—"}</h2>
              <div className="text-xs text-white/90 mt-1">{customerName(previewJob)}</div>
            </div>
          ) : (
            <div className="h-[88px] bg-gradient-to-r from-slate-200 to-slate-100 animate-pulse" />
          )}
          <div className="flex-1 flex flex-col items-center justify-center px-5 py-8 gap-3 min-h-[200px]">
            <Loader2 className="h-11 w-11 text-[#0C2E5A] animate-spin" aria-hidden />
            <p className="text-sm font-medium text-slate-700 text-center">Opening details</p>
            <p className="text-xs text-slate-500 text-center max-w-xs leading-relaxed">
              Syncing vehicle list, team, and appointment data from the server.
            </p>
            <div className="w-full max-w-sm space-y-2 pt-1">
              <div className="h-2 rounded bg-slate-200/90 animate-pulse" />
              <div className="h-2 rounded bg-slate-200/90 animate-pulse w-[88%] mx-auto" />
              <div className="h-2 rounded bg-slate-200/80 animate-pulse w-[72%] mx-auto" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ScheduleJobPage() {
  const { jobId } = useParams();
  const history = useHistory();
  const location = useLocation();
  const background = location.state?.background;
  /** From dispatch sidebar: job snapshot so the modal is not an empty 200px sliver while GET /jobs/:id runs. */
  const jobPreviewFromRoute = useMemo(
    () => (location.state && location.state.initialJob) || null,
    [location.state],
  );
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [job, setJob] = useState(null);
  /** Current route assignment from API (edit mode) */
  const [existingAssignment, setExistingAssignment] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [vehicleId, setVehicleId] = useState("");
  const [dateYmd, setDateYmd] = useState(() => toYMD(new Date()));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [durationMins, setDurationMins] = useState(60);
  const [assignStatus, setAssignStatus] = useState("scheduled");
  const [appointmentType, setAppointmentType] = useState("work");
  const [staffList, setStaffList] = useState([]);
  const [technicianId, setTechnicianId] = useState("");
  const [fleetTerms, setFleetTerms] = useState(DEFAULT_FLEET_TERMINOLOGY);
  const [emailModalOpen, setEmailModalOpen] = useState(false);

  const staffDisplayName = (s) =>
    s?.fullName || s?.displayName || s?.name || s?.email || "Staff";

  const addMinutesToTimeHHmm = (timeStr, addMins) => {
    const [h, m] = String(timeStr || "09:00").split(":").map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return "10:00";
    let total = h * 60 + m + (Number(addMins) || 0);
    total = Math.max(0, Math.min(total, 23 * 60 + 59));
    const nh = Math.floor(total / 60);
    const nm = total % 60;
    return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
  };

  const timeDiffMinutes = (st, et) => {
    const [h1, m1] = String(st || "09:00").split(":").map(Number);
    const [h2, m2] = String(et || "10:00").split(":").map(Number);
    if (!Number.isFinite(h1) || !Number.isFinite(h2)) return 60;
    const d = h2 * 60 + m2 - (h1 * 60 + m1);
    return Math.max(15, Math.min(d, 24 * 60 - 15));
  };

  const load = useCallback(async () => {
    if (!jobId) return;
    setLoading(true);
    try {
      const jobRes = await FleetManagementServices.getJob(jobId);
      const j = jobRes?.data;
      const meta = jobRes?.meta || {};
      const a = meta.assignment;
      setJob(j || null);
      setExistingAssignment(a && a._id ? a : null);

      const businessId = j?.businessId?._id || j?.businessId || "";
      const fleetParams = businessId ? { business: businessId } : {};
      const vehParams = businessId ? { business: businessId } : {};
      const [vehRes, fleetSetRes] = await Promise.all([
        FleetManagementServices.getVehicles(vehParams),
        businessId
          ? FleetManagementServices.getFleetScheduleSettings(fleetParams)
          : Promise.resolve({ data: null }),
      ]);
      setFleetTerms(normalizeFleetTerminology(fleetSetRes?.data));
      const vlist = vehRes?.data || [];
      setVehicles(vlist);

      if (a && a._id) {
        setDateYmd(assignmentDateToYmd(a.date));
        setStartTime(a.startTime || "09:00");
        setEndTime(a.endTime || "10:00");
        setDurationMins(timeDiffMinutes(a.startTime || "09:00", a.endTime || "10:00"));
        setAssignStatus(a.status || "scheduled");
        setAppointmentType(
          (a.appointmentType && String(a.appointmentType).trim()) || j?.visitType || "work",
        );
        const vId = a.vehicleId?._id || a.vehicleId;
        if (vId && vlist.some((v) => String(v._id) === String(vId))) {
          setVehicleId(String(vId));
        } else {
          setVehicleId(vlist[0] ? String(vlist[0]._id) : "");
        }
        const tid = a.technicianId?._id || a.technicianId;
        setTechnicianId(tid ? String(tid) : "");
      } else {
        setDateYmd(toYMD(new Date()));
        setStartTime("09:00");
        setEndTime("10:00");
        setDurationMins(60);
        setAssignStatus("scheduled");
        setAppointmentType(j?.visitType || "work");
        setVehicleId(vlist[0] ? String(vlist[0]._id) : "");
        setTechnicianId("");
      }

      if (businessId) {
        const staffRes = await FleetManagementServices.getBusinessStaff(businessId);
        const list = staffRes?.staffList || staffRes?.data || staffRes || [];
        const rows = Array.isArray(list) ? list : [];
        setStaffList(rows);
        const hasAssignTech = a && a._id && (a.technicianId?._id || a.technicianId);
        if (!hasAssignTech) {
          const loginName = String(adminInfo?.name || "").trim().toLowerCase();
          const loginEmail = String(adminInfo?.email || "").trim().toLowerCase();
          const preferred = rows.find((s) => {
            const name = String(staffDisplayName(s) || "").trim().toLowerCase();
            const email = String(s?.email || "").trim().toLowerCase();
            return (loginName && name === loginName) || (loginEmail && email && email === loginEmail);
          });
          if (preferred?._id) setTechnicianId(String(preferred._id));
        }
      } else {
        setStaffList([]);
      }
    } catch (e) {
      notifyError(e?.response?.data?.message || "Failed to load job");
      setJob(null);
      setExistingAssignment(null);
    } finally {
      setLoading(false);
    }
  }, [jobId, adminInfo?.name, adminInfo?.email]);

  useEffect(() => {
    load();
  }, [load]);

  const woLabel = useMemo(() => {
    const id = job?._id || jobId;
    if (!id) return "—";
    return String(id).replace(/[^a-f0-9]/gi, "").slice(-4).toUpperCase();
  }, [job, jobId]);

  const navigateBackToBoard = useCallback(() => {
    const bg = location.state?.background;
    if (bg?.pathname) {
      // Pop the overlay route so the board underneath is unchanged (same as Quick add cancel — no extra push / refetch).
      history.goBack();
    } else {
      history.push("/scheduling");
    }
  }, [history, location.state]);

  const wrapAsModalOverlay = useCallback(
    (node) => {
      if (!background) return node;
      return (
        <div
          className="fixed inset-0 z-[100] flex justify-center items-start overflow-y-auto bg-slate-900/55 px-3 py-6 sm:py-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby="schedule-job-modal-title"
          onClick={navigateBackToBoard}
        >
          <div
            className="relative w-full max-w-3xl rounded-xl shadow-2xl border border-slate-400/80 bg-[#e4e9f0] max-h-[calc(100vh-3rem)] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {node}
          </div>
        </div>
      );
    },
    [background, navigateBackToBoard],
  );

  const showCompletionWizard = new URLSearchParams(location.search).get("wizard") === "1";
  const soId = job?.createdFrom?._id || job?.createdFrom;
  const openSoEmail = () => {
    if (!soId) {
      notifyError("No sales order is linked to this job.");
      return;
    }
    setEmailModalOpen(true);
  };

  const openSoPayment = async () => {
    if (!soId) {
      notifyError("No sales order is linked to this job.");
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
  };

  const markVisitCompleted = async () => {
    if (!existingAssignment?._id) {
      notifyError("Save a route appointment first, or use the status field below.");
      return;
    }
    setAssignStatus("completed");
    setSaving(true);
    try {
      await FleetManagementServices.updateAssignment(existingAssignment._id, {
        vehicleId,
        date: dateYmd,
        startTime,
        endTime,
        status: "completed",
        appointmentType,
        technicianId: technicianId || null,
      });
      notifySuccess("Visit marked completed.");
      await load();
    } catch (e) {
      notifyError(e?.response?.data?.message || "Could not update status");
    } finally {
      setSaving(false);
    }
  };

  const hasActiveRouteAssignment =
    existingAssignment?._id &&
    String(existingAssignment.status || "").toLowerCase() !== "cancelled";

  const routeActionsDisabled =
    String(job?.status || "").toLowerCase() === "completed" ||
    (String(job?.status || "").toLowerCase() === "cancelled" && hasActiveRouteAssignment);

  const handleSave = async () => {
    if (routeActionsDisabled) {
      return;
    }
    if (!job?._id || !vehicleId || !dateYmd) {
      notifyError(`Choose a ${fleetTerms.vehicleLabelSingular.toLowerCase()} and date.`);
      return;
    }
    setSaving(true);
    try {
      const cancelledRoute =
        existingAssignment?._id &&
        String(existingAssignment.status || "").toLowerCase() === "cancelled";

      if (existingAssignment?._id && !cancelledRoute) {
        await FleetManagementServices.updateAssignment(existingAssignment._id, {
          vehicleId,
          date: dateYmd,
          startTime,
          endTime,
          status: assignStatus,
          appointmentType,
          technicianId: technicianId || null,
        });
        notifySuccess("Appointment updated.");
      } else {
        await FleetManagementServices.assignJob({
          jobId: job._id,
          vehicleId,
          date: dateYmd,
          startTime,
          endTime,
          status: assignStatus,
          appointmentType,
          technicianId: technicianId || undefined,
        });
        notifySuccess("Job scheduled on the board.");
      }
      navigateBackToBoard();
    } catch (e) {
      notifyError(e?.response?.data?.message || "Could not save this appointment");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return wrapAsModalOverlay(
      <ScheduleJobLoadingPanel onBack={navigateBackToBoard} previewJob={jobPreviewFromRoute} />,
    );
  }

  if (!job) {
    return wrapAsModalOverlay(
      <div className="max-w-lg mx-auto p-8 bg-[#e4e9f0]">
        <button
          type="button"
          onClick={navigateBackToBoard}
          className="text-sm text-blue-700 font-medium inline-flex items-center gap-1 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to schedule
        </button>
        <p className="text-slate-600 text-sm">Job not found.</p>
      </div>,
    );
  }

  const pageBody = (
    <div
      className={
        background
          ? "bg-[#e4e9f0] text-slate-800 pb-6"
          : "min-h-[calc(100vh-4rem)] bg-[#e4e9f0] text-slate-800 pb-10"
      }
    >
      <div className="border-b border-slate-400/70 bg-[#d6dee8] px-4 py-3 flex items-center gap-3 shadow-[inset_0_-1px_0_rgba(255,255,255,0.35)]">
        <button
          type="button"
          onClick={navigateBackToBoard}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-md border border-slate-400/70 bg-white text-slate-800 hover:bg-slate-50 shadow-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Schedule board
        </button>
        <span
          id="schedule-job-modal-title"
          className="text-xs font-semibold text-slate-600 uppercase tracking-wide"
        >
          {existingAssignment?._id ? "Edit appointment" : `Assign ${jobDocLabel(job)}`}
        </span>
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-6">
        <div className="rounded-lg border border-slate-400/80 bg-white shadow-md overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-[#1e4a7a] to-[#2d5a8f] text-white flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-white/80">
                {jobBillingDocumentTitle(job)} · {billingDocIdPrefix(job)} {woLabel}
              </div>
              <h1 className="text-lg font-bold leading-tight mt-0.5">{job.title}</h1>
              <div className="text-xs text-white/90 mt-1">{customerName(job)}</div>
            </div>
            <div className="text-right text-[11px] text-white/85">
              <div className="font-medium capitalize">{String(job.status || "").replace("_", " ")}</div>
              {job.createdFrom?.salesOrderNumber && (
                <div className="mt-1">SO {job.createdFrom.salesOrderNumber}</div>
              )}
            </div>
          </div>

          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
            <span className="font-semibold text-slate-700">Service address</span>
            <div className="mt-0.5">{primaryAddressLine(job)}</div>
          </div>

          {routeActionsDisabled ? (
            <div className="px-4 py-4 border-b border-slate-200 bg-rose-50/90 text-slate-800">
              <p className="text-sm font-semibold text-rose-900">
                {String(job?.status || "").toLowerCase() === "completed"
                  ? "Completed"
                  : "Cannot change this route here"}
              </p>
              <p className="text-[12px] text-slate-600 mt-1 leading-relaxed">
                {String(job?.status || "").toLowerCase() === "completed"
                  ? "This appointment is finished. Use the schedule board for history."
                  : "This job still has an active appointment on the board. Open it from the dispatch schedule to edit or cancel the route."}
              </p>
            </div>
          ) : null}

          {!routeActionsDisabled &&
          String(job?.status || "").toLowerCase() === "cancelled" &&
          (!existingAssignment?._id ||
            String(existingAssignment.status || "").toLowerCase() === "cancelled") ? (
            <div className="px-4 py-3 border-b border-amber-200 bg-amber-50/90 text-slate-800">
              <p className="text-sm font-semibold text-amber-900">Previously cancelled</p>
              <p className="text-[12px] text-slate-600 mt-1 leading-relaxed">
                Choose a route, date, and time below, then save to put this {jobDocLabel(job)} back on the schedule board.
              </p>
            </div>
          ) : null}

          {showCompletionWizard && !routeActionsDisabled ? (
            <div className="px-4 py-3 border-b border-emerald-200 bg-emerald-50/90 text-slate-800">
              <div className="text-xs font-bold text-emerald-900 mb-1.5">Completion wizard</div>
              <p className="text-[11px] text-slate-600 mb-3 leading-snug">
                Email the customer, record payment on the linked {shouldRouteRecordPaymentViaInvoice(job) ? "invoice" : "sales order"}, and mark the visit
                complete when work is done.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={openSoEmail}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white border border-slate-300 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  <Mail className="w-3.5 h-3.5" />
                  Send email
                </button>
                <button
                  type="button"
                  onClick={openSoPayment}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white border border-slate-300 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  <Wallet className="w-3.5 h-3.5" />
                  Record payment
                </button>
                <button
                  type="button"
                  onClick={markVisitCompleted}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 disabled:opacity-60"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  Mark visit completed
                </button>
              </div>
            </div>
          ) : null}

          {existingAssignment?._id && !routeActionsDisabled ? (
            <p className="px-4 py-2 text-[11px] text-slate-600 bg-amber-50/90 border-b border-amber-200/80">
              This {jobDocLabel(job)} already has a route on the board. Change{" "}
              {fleetTerms.vehicleLabelSingular.toLowerCase()}, time, status, or technician below, then save.
            </p>
          ) : null}

          {routeActionsDisabled ? null : vehicles.length === 0 ? (
            <div className="p-6 text-sm text-slate-600">
              No {fleetTerms.vehicleLabelPlural.toLowerCase()} configured. Add them under{" "}
              <strong>Settings → Fleet management → {fleetTerms.vehicleLabelPlural}</strong>, then return here.
            </div>
          ) : (
            <div className="p-4 sm:p-6 space-y-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                    <Truck className="w-3.5 h-3.5" />
                    {fleetTerms.vehicleLabelSingular}
                  </span>
                  <select
                    value={vehicleId}
                    onChange={(e) => setVehicleId(e.target.value)}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white shadow-sm"
                  >
                    {vehicles.map((v) => (
                      <option key={v._id} value={v._id}>
                        {v.name || fleetTerms.vehicleLabelSingular}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    Date
                  </span>
                  <input
                    type="date"
                    value={dateYmd}
                    onChange={(e) => setDateYmd(e.target.value)}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white shadow-sm"
                  />
                </label>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Start
                  </span>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => {
                      const v = e.target.value;
                      setStartTime(v);
                      setEndTime(addMinutesToTimeHHmm(v, durationMins));
                    }}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white shadow-sm"
                  />
                </label>
                <label className="block">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Duration
                  </span>
                  <select
                    value={durationMins}
                    onChange={(e) => {
                      const mins = Number(e.target.value);
                      setDurationMins(mins);
                      setEndTime(addMinutesToTimeHHmm(startTime, mins));
                    }}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white shadow-sm"
                  >
                    {[15, 30, 45, 60, 90, 120, 180, 240].map((mins) => (
                      <option key={mins} value={mins}>
                        {mins} min
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    End
                  </span>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => {
                      const v = e.target.value;
                      setEndTime(v);
                      setDurationMins(timeDiffMinutes(startTime, v));
                    }}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white shadow-sm"
                  />
                </label>
              </div>
              <div className="grid sm:grid-cols-3 gap-4">
                <label className="block">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                    Status
                  </span>
                  <select
                    value={assignStatus}
                    onChange={(e) => setAssignStatus(e.target.value)}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white shadow-sm"
                  >
                    <option value="scheduled">Scheduled</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="waiting">Waiting</option>
                    <option value="in_progress">In progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </label>
                <label className="block">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                    Appt Type
                  </span>
                  <select
                    value={appointmentType}
                    onChange={(e) => setAppointmentType(e.target.value)}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white shadow-sm"
                  >
                    <option value="work">Work</option>
                    <option value="estimate">Estimate</option>
                    <option value="rework">Rework</option>
                    <option value="other">Other</option>
                    <option value="drop_off_pickup">Drop off and pickup</option>
                  </select>
                </label>
                <label className="block">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                    Technician
                  </span>
                  <select
                    value={technicianId}
                    onChange={(e) => setTechnicianId(e.target.value)}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white shadow-sm"
                  >
                    <option value="">Select technician</option>
                    {staffList.map((staff) => (
                      <option key={staff._id} value={staff._id}>
                        {staffDisplayName(staff)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSave}
                  className="px-4 py-2 rounded-md text-sm font-semibold bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-60 shadow-sm"
                >
                  {saving ? "Saving…" : existingAssignment?._id ? "Save appointment" : "Assign to board"}
                </button>
                <button
                  type="button"
                  onClick={navigateBackToBoard}
                  className="px-4 py-2 rounded-md text-sm font-medium border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                Times use your business timezone when the job is linked to a business; otherwise UTC is used for
                stored instants.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {wrapAsModalOverlay(pageBody)}
      <SchedulingDispatchEmailModal
        open={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        job={job}
        assignment={existingAssignment || undefined}
        dayYmd={dateYmd}
        businessId={job?.businessId?._id || job?.businessId || ""}
        businessRecord={typeof job?.businessId === "object" ? job.businessId : null}
        customerDisplayName={customerName(job)}
        adminInfo={adminInfo}
      />
    </>
  );
}
