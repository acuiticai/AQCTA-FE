import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Search, X } from "lucide-react";
import { AdminContext } from "@/context/AdminContext";
import FleetManagementServices from "@/services/FleetManagementServices";
import { notifyError, notifySuccess } from "@/utils/toast";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

function staffDisplayName(s) {
  if (!s) return "";
  if (s.name) return String(s.name);
  const fn = s.firstName || s.first_name || "";
  const ln = s.lastName || s.last_name || "";
  const joined = [fn, ln].filter(Boolean).join(" ").trim();
  if (joined) return joined;
  return s.fullName || s.displayName || s.email || "Technician";
}

function normName(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Same technician picker pattern as CreateJobFromScheduleModal (search + multi-select),
 * without customer / line items / schedule fields — edit names only, then save to job (+ optional assignment).
 */
export default function ScheduleTechniciansModal({
  isOpen,
  onClose,
  businessId,
  job,
  assignment,
  onSaved,
}) {
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      authorization: adminInfo?.token ? `Bearer ${adminInfo.token}` : undefined,
    }),
    [adminInfo?.token],
  );

  const [staffList, setStaffList] = useState([]);
  const [selectedTechnicianIds, setSelectedTechnicianIds] = useState([]);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const jobId = job?._id ? String(job._id) : "";
  const assignmentId = assignment?._id ? String(assignment._id) : "";

  const toggleTechnician = useCallback((id) => {
    const sid = String(id);
    setSelectedTechnicianIds((prev) =>
      prev.includes(sid) ? prev.filter((x) => x !== sid) : [...prev, sid],
    );
  }, []);

  useEffect(() => {
    if (!isOpen || !businessId) {
      setStaffList([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${Base_URL}/staff-management`, {
          headers,
          params: { business: businessId, limit: 1000 },
        });
        const list = res.data?.staffList || res.data?.data || res.data || [];
        if (!cancelled) setStaffList(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setStaffList([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, businessId, headers]);

  useEffect(() => {
    if (!isOpen) return;
    setSearch("");
    const ids = new Set();
    const techId = assignment?.technicianId?._id || assignment?.technicianId;
    if (techId) {
      ids.add(String(techId));
    }
    const nameSet = new Set(
      (Array.isArray(job?.technicianNames) ? job.technicianNames : [])
        .map((n) => normName(n))
        .filter(Boolean),
    );
    const assignNm = normName(assignment?.technicianName);
    if (assignNm) nameSet.add(assignNm);

    (staffList || []).forEach((s) => {
      if (nameSet.has(normName(staffDisplayName(s)))) {
        ids.add(String(s._id));
      }
    });
    setSelectedTechnicianIds([...ids]);
  }, [isOpen, job, assignment, staffList]);

  const filteredStaff = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return staffList;
    return staffList.filter((s) => staffDisplayName(s).toLowerCase().includes(q));
  }, [staffList, search]);

  const submit = async (e) => {
    e.preventDefault();
    if (!jobId) {
      notifyError("No job selected.");
      return;
    }
    setSaving(true);
    try {
      const ordered = selectedTechnicianIds
        .map((id) => staffList.find((s) => String(s._id) === String(id)))
        .filter(Boolean);
      const technicianNames = ordered.map((s) => staffDisplayName(s));

      const jobRes = await FleetManagementServices.updateJob(jobId, { technicianNames });
      if (jobRes?.success === false) {
        notifyError(jobRes?.message || "Failed to update job");
        return;
      }

      if (assignmentId) {
        const first = ordered[0];
        const assignPayload = first
          ? { technicianId: first._id, technicianName: staffDisplayName(first) }
          : { technicianId: null, technicianName: "" };
        const ar = await FleetManagementServices.updateAssignment(assignmentId, assignPayload);
        if (ar?.success === false) {
          notifyError(ar?.message || "Job updated but assignment technician failed");
          return;
        }
      }

      notifySuccess("Technicians updated");
      onSaved?.();
      onClose();
    } catch (err) {
      notifyError(err?.response?.data?.message || err?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[240] flex items-center justify-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-tech-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-lg border border-slate-300 bg-white shadow-xl flex flex-col max-h-[min(90vh,520px)]">
        <div className="flex items-start justify-between gap-2 border-b border-slate-200 px-4 py-3 shrink-0">
          <div>
            <h2 id="schedule-tech-modal-title" className="text-sm font-semibold text-slate-900">
              Technicians
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Same picker as new appointment — search staff and multi-select. Only technician names are
              saved; other job fields are unchanged.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-col flex-1 min-h-0">
          <div className="px-4 pt-3 pb-2 shrink-0">
            <div className="text-xs font-semibold text-slate-700">Search staff</div>
            <div className="mt-1 flex items-center gap-2 rounded border border-slate-300 bg-white px-2 py-1.5">
              <Search className="w-4 h-4 text-slate-400 shrink-0" aria-hidden />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Type to filter…"
                className="flex-1 min-w-0 text-xs outline-none bg-transparent"
                autoComplete="off"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-2">Staff for this business (multi-select)</p>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-3">
            <div className="rounded border border-slate-200 bg-white p-2 space-y-1 max-h-[280px] overflow-y-auto">
              {!businessId ? (
                <div className="text-xs text-slate-500 py-2">Select a business first.</div>
              ) : filteredStaff.length === 0 ? (
                <div className="text-xs text-slate-500 py-2">
                  {staffList.length === 0 ? "No staff loaded for this business." : "No matches."}
                </div>
              ) : (
                filteredStaff.map((s) => {
                  const id = String(s._id);
                  const checked = selectedTechnicianIds.includes(id);
                  return (
                    <label
                      key={id}
                      className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleTechnician(id)}
                      />
                      <span className="text-xs text-slate-800">{staffDisplayName(s)}</span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !jobId}
              className="rounded bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
