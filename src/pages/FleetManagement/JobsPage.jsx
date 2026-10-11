import { useContext, useEffect, useMemo, useState } from "react";
import { useHistory } from "react-router-dom";
import axios from "axios";
import {
  Building,
  Calendar,
  Edit,
  Eye,
  Ban,
  Package,
  Trash2,
  Truck,
  User,
} from "lucide-react";
import { notifyError, notifySuccess } from "@/utils/toast";
import FleetManagementServices from "@/services/FleetManagementServices";
import {
  DEFAULT_FLEET_TERMINOLOGY,
  normalizeFleetTerminology,
} from "@/utils/fleetTerminology";
import { DataTable, SummaryCards } from "@/page-layouts/index";
import { formatDate } from "@/components/formatAmount";
import { AdminContext } from "@/context/AdminContext";
import { hasPathPermission, PERMISSION_ACTION } from "@/utils/permissionUtils";
import { getModuleRoutePath } from "@/utils/moduleLabels";
import { isSingleAssignedBusiness } from "@/utils/sessionAssignedBusinesses";

import CompletedSvg from "@/assets/img/completed.svg";
import InProgressSvg from "@/assets/img/in-progress.svg";
import SummarySvg from "@/assets/img/summary.svg";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const defaultJob = {
  customerId: "",
  title: "",
  description: "",
  priority: "medium",
  status: "pending",
};

const defaultAssignment = {
  vehicleId: "",
  date: new Date().toISOString().slice(0, 10),
  startTime: "09:00",
  endTime: "10:00",
  status: "scheduled",
  appointmentType: "work",
  technicianId: "",
};

const ASSIGN_STATUSES = [
  { value: "scheduled", label: "Scheduled" },
  { value: "confirmed", label: "Confirmed" },
  { value: "waiting", label: "Waiting" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const APPOINTMENT_TYPES = [
  { value: "work", label: "Work" },
  { value: "estimate", label: "Estimate" },
  { value: "rework", label: "Rework" },
  { value: "other", label: "Other" },
  { value: "drop_off_pickup", label: "Drop off and pickup" },
];

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120, 180, 240];

const staffDisplayName = (staff) =>
  staff?.fullName ||
  staff?.displayName ||
  staff?.name ||
  staff?.email ||
  "Staff";

const addMinutesToTimeHHmm = (timeStr, addMins) => {
  const [h, m] = String(timeStr || "09:00")
    .split(":")
    .map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return "10:00";
  let total = h * 60 + m + (Number(addMins) || 0);
  total = Math.max(0, Math.min(total, 23 * 60 + 59));
  const nh = Math.floor(total / 60);
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
};

const timeDiffMinutes = (startTime, endTime) => {
  const [h1, m1] = String(startTime || "09:00")
    .split(":")
    .map(Number);
  const [h2, m2] = String(endTime || "10:00")
    .split(":")
    .map(Number);
  if (!Number.isFinite(h1) || !Number.isFinite(h2)) return 60;
  const d = h2 * 60 + m2 - (h1 * 60 + m1);
  return Math.max(15, Math.min(d, 24 * 60 - 15));
};

function JobStatusBadge({ status }) {
  const s = String(status || "").toLowerCase();
  const map = {
    draft: "bg-slate-100 text-slate-700",
    pending: "bg-gray-100 text-gray-700",
    confirmed: "bg-cyan-100 text-cyan-900",
    assigned: "bg-blue-100 text-blue-700",
    in_progress: "bg-yellow-100 text-yellow-800",
    completed: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-700",
  };
  const cls = map[s] || "bg-gray-100 text-gray-700";
  const label = status ? String(status).replace(/_/g, " ") : "—";
  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${cls}`}
    >
      {label}
    </span>
  );
}

function PriorityBadge({ priority }) {
  const p = String(priority || "").toLowerCase();
  const map = {
    low: "bg-slate-100 text-slate-700",
    medium: "bg-amber-100 text-amber-800",
    high: "bg-orange-100 text-orange-800",
  };
  const cls = map[p] || "bg-gray-100 text-gray-700";
  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${cls}`}
    >
      {priority || "—"}
    </span>
  );
}

export default function JobsPage() {
  const history = useHistory();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const roleModules = adminInfo?.role?.modules || [];
  const canViewSalesOrders = hasPathPermission(
    roleModules,
    getModuleRoutePath("saleOrder", "list"),
    PERMISSION_ACTION.VIEW_DETAILS,
  );
  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo.token}`,
  };

  const [jobs, setJobs] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isBusinessesLoaded, setIsBusinessesLoaded] = useState(false);
  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [jobForm, setJobForm] = useState(defaultJob);
  const [assignmentForm, setAssignmentForm] = useState(defaultAssignment);
  const [editingJobId, setEditingJobId] = useState(null);
  const [assigningJob, setAssigningJob] = useState(null);
  const [assignDurationMins, setAssignDurationMins] = useState(60);
  const [businessStaff, setBusinessStaff] = useState([]);
  const [fleetTerms, setFleetTerms] = useState(DEFAULT_FLEET_TERMINOLOGY);
  /** Vehicles / labels for the assign modal only — scoped to the job's business (not the page filter). */
  const [assignContextVehicles, setAssignContextVehicles] = useState([]);
  const [assignModalFleetTerms, setAssignModalFleetTerms] = useState(
    DEFAULT_FLEET_TERMINOLOGY,
  );
  const [assignContextLoading, setAssignContextLoading] = useState(false);

  const [businesses, setBusinesses] = useState([]);
  const [selectedBusiness, setSelectedBusiness] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  /** Set when opening delete confirmation; `_id` and optional `title` for the modal copy */
  const [jobPendingDelete, setJobPendingDelete] = useState(null);
  const [jobPendingVoid, setJobPendingVoid] = useState(null);
  const [voidReason, setVoidReason] = useState("");

  useEffect(() => {
    const fetchBusinesses = async () => {
      if (!adminInfo?.id) {
        setIsBusinessesLoaded(true);
        return;
      }
      try {
        const response = await axios.get(
          `${Base_URL}/admin/assigned/${adminInfo.id}`,
          { headers },
        );
        const list = response.data?.businesses || [];
        setBusinesses(list);
        if (list.length === 1) {
          setSelectedBusiness(String(list[0]._id));
        }
      } catch (error) {
        console.error("Error fetching assigned businesses:", error);
      } finally {
        setIsBusinessesLoaded(true);
      }
    };
    fetchBusinesses();
  }, [adminInfo?.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedBusiness) params.business = selectedBusiness;

      const fleetParams = selectedBusiness
        ? { business: selectedBusiness }
        : {};
      const [jobsRes, vehiclesRes, fleetSetRes] = await Promise.all([
        FleetManagementServices.getJobs(params),
        FleetManagementServices.getVehicles(fleetParams),
        selectedBusiness
          ? FleetManagementServices.getFleetScheduleSettings(fleetParams)
          : Promise.resolve({ data: null }),
      ]);
      setJobs(jobsRes?.data || []);
      setVehicles(vehiclesRes?.data || []);
      setFleetTerms(normalizeFleetTerminology(fleetSetRes?.data));
    } catch (error) {
      notifyError(error?.response?.data?.message || "Failed to load jobs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isBusinessesLoaded) return;
    loadData();
  }, [selectedBusiness, isBusinessesLoaded]);

  useEffect(() => {
    if (!isBusinessesLoaded || businesses.length !== 1) return;
    const only = String(businesses[0]._id);
    if (selectedBusiness !== only) setSelectedBusiness(only);
  }, [isBusinessesLoaded, businesses, selectedBusiness]);

  /** With no business selected: only jobs whose business is one of the admin's assigned businesses (excludes unassigned / other businesses). */
  const jobsScoped = useMemo(() => {
    if (!isBusinessesLoaded) return [];
    if (selectedBusiness) return jobs;
    const ids = new Set(businesses.map((b) => String(b._id)));
    if (ids.size === 0) return jobs;
    return jobs.filter((j) => {
      const bid = j.businessId?._id || j.businessId;
      if (!bid) return false;
      return ids.has(String(bid));
    });
  }, [jobs, businesses, selectedBusiness, isBusinessesLoaded]);

  const filteredJobs = useMemo(() => {
    let list = jobsScoped;
    // Cleared react-select passes undefined; treat like "All" so the table is not empty.
    const statusRaw =
      selectedStatus == null ? "" : String(selectedStatus).trim();
    const statusIsAll = statusRaw === "" || statusRaw.toLowerCase() === "all";
    if (!statusIsAll) {
      const want = statusRaw.toLowerCase();
      list = list.filter((j) => String(j.status ?? "").toLowerCase() === want);
    }
    const priorityRaw =
      priorityFilter == null ? "" : String(priorityFilter).trim();
    const priorityIsAll =
      priorityRaw === "" || priorityRaw.toLowerCase() === "all";
    if (!priorityIsAll) {
      const want = priorityRaw.toLowerCase();
      list = list.filter(
        (j) => String(j.priority ?? "").toLowerCase() === want,
      );
    }
    const q = searchTerm.trim().toLowerCase();
    if (q) {
      list = list.filter((job) => {
        const title = (job.title || "").toLowerCase();
        const cust =
          job.customerId?.basicInformation?.customerDisplayName ||
          job.customerId?.basicInformation?.companyName ||
          "";
        const biz = job.businessId?.name || "";
        return (
          title.includes(q) ||
          String(cust).toLowerCase().includes(q) ||
          String(biz).toLowerCase().includes(q)
        );
      });
    }
    return list;
  }, [jobsScoped, selectedStatus, priorityFilter, searchTerm]);

  const overallStats = useMemo(() => {
    const base = jobsScoped;
    const total = base.length;
    const pending = base.filter((j) =>
      ["pending", "confirmed"].includes(String(j.status || "").toLowerCase()),
    ).length;
    const active = base.filter((j) =>
      ["assigned", "in_progress"].includes(j.status),
    ).length;
    const done = base.filter((j) => j.status === "completed").length;
    return { total, pending, active, done };
  }, [jobsScoped]);

  const paginatedJobs = useMemo(() => {
    const total = filteredJobs.length;
    const pages = Math.max(1, Math.ceil(total / recordsPerPage) || 1);
    const start = (currentPage - 1) * recordsPerPage;
    return {
      rows: filteredJobs.slice(start, start + recordsPerPage),
      total,
      pages,
    };
  }, [filteredJobs, currentPage, recordsPerPage]);

  const assigningJobBusinessId = useMemo(() => {
    const b = assigningJob?.businessId;
    return b?._id || b || "";
  }, [assigningJob]);

  const assigningJobBusinessName = useMemo(() => {
    const b = assigningJob?.businessId;
    if (b?.name) return b.name;
    if (!assigningJobBusinessId) return "";
    const found = businesses.find(
      (x) => String(x._id) === String(assigningJobBusinessId),
    );
    return found?.name || "";
  }, [assigningJob, assigningJobBusinessId, businesses]);

  useEffect(() => {
    if (currentPage > paginatedJobs.pages) setCurrentPage(1);
  }, [paginatedJobs.pages, currentPage]);

  const openEdit = (job) => {
    const soId = job.createdFrom?._id || job.createdFrom;
    if (soId) {
      history.push({
        pathname: getModuleRoutePath("saleOrder", "edit", { id: soId }),
        state: {
          fromJobEdit: true,
          linkedJobId: job._id,
        },
      });
      return;
    }
    setEditingJobId(job._id);
    setJobForm({
      customerId: job.customerId?._id || job.customerId || "",
      title: job.title || "",
      description: job.description || "",
      priority: job.priority || "medium",
      status: job.status || "pending",
    });
    setJobModalOpen(true);
  };

  const submitJob = async (e) => {
    e.preventDefault();
    try {
      if (editingJobId) {
        await FleetManagementServices.updateJob(editingJobId, jobForm);
        notifySuccess("Job updated successfully");
      } else {
        await FleetManagementServices.createJob(jobForm);
        notifySuccess("Job created successfully");
      }
      setJobModalOpen(false);
      await loadData();
    } catch (error) {
      notifyError(error?.response?.data?.message || "Failed to save job");
    }
  };

  const openDeleteJobModal = (job) => {
    setJobPendingDelete({
      _id: job._id,
      title: job.title?.trim() || "",
    });
    setDeleteModalOpen(true);
  };

  const confirmDeleteJob = async () => {
    const id = jobPendingDelete?._id;
    if (!id) return;
    try {
      await FleetManagementServices.deleteJob(id);
      notifySuccess("Job deleted successfully");
      setDeleteModalOpen(false);
      setJobPendingDelete(null);
      await loadData();
    } catch (error) {
      notifyError(error?.response?.data?.message || "Failed to delete job");
    }
  };

  const openVoidJobModal = (job) => {
    setJobPendingVoid({
      _id: job._id,
      title: job.title?.trim() || "",
    });
    setVoidReason("");
    setVoidModalOpen(true);
  };

  const confirmVoidJob = async () => {
    const id = jobPendingVoid?._id;
    if (!id) return;
    try {
      await FleetManagementServices.voidJob(id, { reason: voidReason.trim() });
      notifySuccess("Job voided successfully");
      setVoidModalOpen(false);
      setJobPendingVoid(null);
      setVoidReason("");
      await loadData();
    } catch (error) {
      notifyError(error?.response?.data?.message || "Failed to void job");
    }
  };

  const openAssign = (job) => {
    setAssigningJob(job);
    setAssignmentForm(defaultAssignment);
    setAssignDurationMins(60);
    setAssignModalOpen(true);
  };

  useEffect(() => {
    if (!assignModalOpen || !assigningJobBusinessId) {
      setAssignContextVehicles([]);
      setAssignModalFleetTerms(DEFAULT_FLEET_TERMINOLOGY);
      setAssignContextLoading(false);
      return;
    }

    let cancelled = false;
    const loadVehiclesAndTerms = async () => {
      setAssignContextLoading(true);
      try {
        const fleetParams = { business: assigningJobBusinessId };
        const [vehiclesRes, fleetSetRes] = await Promise.all([
          FleetManagementServices.getVehicles(fleetParams),
          FleetManagementServices.getFleetScheduleSettings(fleetParams),
        ]);
        if (cancelled) return;
        setAssignContextVehicles(vehiclesRes?.data || []);
        setAssignModalFleetTerms(normalizeFleetTerminology(fleetSetRes?.data));
      } catch {
        if (!cancelled) {
          setAssignContextVehicles([]);
          setAssignModalFleetTerms(DEFAULT_FLEET_TERMINOLOGY);
        }
      } finally {
        if (!cancelled) setAssignContextLoading(false);
      }
    };
    loadVehiclesAndTerms();
    return () => {
      cancelled = true;
    };
  }, [assignModalOpen, assigningJob?._id, assigningJobBusinessId]);

  useEffect(() => {
    const loadStaff = async () => {
      if (!assignModalOpen || !assigningJobBusinessId) {
        setBusinessStaff([]);
        return;
      }
      try {
        const res = await FleetManagementServices.getBusinessStaff(
          assigningJobBusinessId,
        );
        const list = res?.staffList || res?.data || res || [];
        const rows = Array.isArray(list) ? list : [];
        setBusinessStaff(rows);
        const loginName = String(adminInfo?.name || "")
          .trim()
          .toLowerCase();
        const loginEmail = String(adminInfo?.email || "")
          .trim()
          .toLowerCase();
        const preferred = rows.find((s) => {
          const name = String(staffDisplayName(s) || "")
            .trim()
            .toLowerCase();
          const email = String(s?.email || "")
            .trim()
            .toLowerCase();
          return (
            (loginName && name === loginName) ||
            (loginEmail && email && email === loginEmail)
          );
        });
        setAssignmentForm((prev) => ({
          ...prev,
          technicianId:
            prev.technicianId || (preferred?._id ? String(preferred._id) : ""),
        }));
      } catch {
        setBusinessStaff([]);
      }
    };
    loadStaff();
  }, [
    assignModalOpen,
    assigningJob?._id,
    assigningJobBusinessId,
    adminInfo?.name,
    adminInfo?.email,
  ]);

  const submitAssignment = async (e) => {
    e.preventDefault();
    if (!assigningJob?._id) return;
    try {
      await FleetManagementServices.assignJob({
        ...assignmentForm,
        jobId: assigningJob._id,
      });
      notifySuccess("Job assigned successfully");
      setAssignModalOpen(false);
      await loadData();
    } catch (error) {
      notifyError(error?.response?.data?.message || "Failed to assign job");
    }
  };

  const filters = useMemo(
    () => [
      ...(!isSingleAssignedBusiness()
        ? [
            {
              label: "Business",
              value: selectedBusiness,
              onChange: (value) => {
                setSelectedBusiness(value == null ? "" : String(value));
                setCurrentPage(1);
              },
              options: businesses.map((b) => ({
                value: b._id,
                label: b.name,
              })),
              placeholder:
                businesses.length > 1
                  ? "All assigned businesses"
                  : businesses.length === 1
                    ? businesses[0]?.name || "Business"
                    : "All businesses",
              isClearable: businesses.length > 1,
              icon: Building,
            },
          ]
        : []),
      {
        label: "Status",
        value: selectedStatus,
        onChange: (value) => {
          const v =
            value == null || String(value).trim() === "" ? "All" : value;
          setSelectedStatus(v);
          setCurrentPage(1);
        },
        options: [
          { value: "All", label: "All statuses" },
          { value: "draft", label: "Draft" },
          { value: "pending", label: "Pending" },
          { value: "confirmed", label: "Confirmed" },
          { value: "assigned", label: "Assigned" },
          { value: "in_progress", label: "In progress" },
          { value: "completed", label: "Completed" },
          { value: "cancelled", label: "Cancelled" },
        ],
        placeholder: "Status",
        icon: Package,
      },
      {
        label: "Priority",
        value: priorityFilter,
        onChange: (value) => {
          const v =
            value == null || String(value).trim() === "" ? "All" : value;
          setPriorityFilter(v);
          setCurrentPage(1);
        },
        options: [
          { value: "All", label: "All priorities" },
          { value: "low", label: "Low" },
          { value: "medium", label: "Medium" },
          { value: "high", label: "High" },
        ],
        placeholder: "Priority",
        icon: Truck,
      },
    ],
    [businesses, selectedBusiness, selectedStatus, priorityFilter],
  );

  /** Same pattern as Customer Invoices — compact data columns, Actions fits all icons in one row. */
  const hideBusinessField = isSingleAssignedBusiness();
  const jobTableColWidths = useMemo(
    () => ({
      "Order Type": "8%",
      "Job No": "9%",
      ...(hideBusinessField ? {} : { Business: "10%" }),
      Customer: "12%",
      "Job Title": "14%",
      Priority: "7%",
      Status: "9%",
      Created: "10%",
      Actions: "max-content",
    }),
    [hideBusinessField],
  );

  const summaryCardsData = [
    {
      title: "Total jobs",
      value: overallStats.total,
      backgroundColor: "summary-light",
      iconColor: "summary-dark",
      Icon: SummarySvg,
    },
    {
      title: "Pending",
      value: overallStats.pending,
      backgroundColor: "processing-light",
      iconColor: "processing-dark",
      Icon: InProgressSvg,
    },
    {
      title: "Active (assigned / in progress)",
      value: overallStats.active,
      backgroundColor: "completed-light",
      iconColor: "completed-dark",
      Icon: InProgressSvg,
    },
    {
      title: "Completed",
      value: overallStats.done,
      backgroundColor: "completed-light",
      iconColor: "overdue-dark",
      Icon: CompletedSvg,
    },
  ];

  return (
    <div className="bg-gray-50 min-h-screen w-full max-w-full overflow-x-hidden">
      <div className="w-full max-w-full mx-auto px-6 py-8 min-w-0 overflow-x-hidden">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Jobs</h1>
          <p className="text-gray-600 mt-2">
            Manage and track work orders and fleet jobs
          </p>
        </div>

        <div className="w-full max-w-full min-w-0 overflow-x-hidden">
          <SummaryCards cards={summaryCardsData} columnsCount={4} />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 min-w-0 max-w-full overflow-hidden mt-6">
          <DataTable
            title=""
            colWidths={jobTableColWidths}
            wideTable
            skipDynamicColumnWidths
            headersWithoutCellTooltip={["Actions", "Title"]}
            headers={[
              "Order Type",
              "Job No",
              ...(!hideBusinessField ? ["Business"] : []),
              "Customer",
              "Job Title",
              "Priority",
              "Status",
              "Created",
              "Actions",
            ]}
            data={paginatedJobs.rows}
            loading={loading}
            totalRecords={paginatedJobs.total}
            currentPage={currentPage}
            totalPages={paginatedJobs.pages}
            recordsPerPage={recordsPerPage}
            onPageChange={setCurrentPage}
            onRecordsPerPageChange={(perPage) => {
              setRecordsPerPage(perPage);
              setCurrentPage(1);
            }}
            searchValue={searchTerm}
            onSearch={setSearchTerm}
            searchPlaceholder="Search jobs..."
            filters={filters}
            emptyMessage="No jobs found"
            renderRow={(job) => {
              const rowStatus = String(job.status || "").toLowerCase();
              const isCompleted = rowStatus === "completed";
              const isVoided = rowStatus === "cancelled";
              const orderTypeLabel = String(
                job.orderType || "work_order",
              ).replace(/_/g, " ");
              return (
                <tr>
                  <td className="py-4 px-4 min-w-0">
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full border bg-slate-50 text-slate-800 border-slate-200 capitalize">
                      {orderTypeLabel}
                    </span>
                  </td>
                  <td className="py-4 px-4 min-w-0">
                    <div className="min-w-0">
                      {job.createdFrom?._id &&
                      job.createdFrom?.salesOrderNumber &&
                      canViewSalesOrders ? (
                        <button
                          type="button"
                          onClick={() =>
                            history.push({
                              pathname: getModuleRoutePath(
                                "saleOrder",
                                "view",
                                {
                                  id: job.createdFrom._id,
                                },
                              ),
                            })
                          }
                          className="font-semibold text-[var(--p-blue)] hover:underline truncate text-left w-full"
                          title="Open linked sales order"
                        >
                          {job.createdFrom.salesOrderNumber}
                        </button>
                      ) : (
                        <p className="font-semibold text-gray-900 truncate">
                          {`WO-${
                            String(job._id || "")
                              .replace(/[^a-f0-9]/gi, "")
                              .slice(-4)
                              .toUpperCase() || "—"
                          }`}
                        </p>
                      )}
                      <p className="text-sm text-gray-500">Job reference</p>
                    </div>
                  </td>
                  {!hideBusinessField && (
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {job.businessId?.name || "—"}
                          </p>
                          <p className="text-sm text-gray-500">Business</p>
                        </div>
                      </div>
                    </td>
                  )}
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {job.customerId?.basicInformation
                            ?.customerDisplayName ||
                            job.customerId?.basicInformation?.companyName ||
                            "—"}
                        </p>
                        <p className="text-sm text-gray-500">Customer</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 min-w-0">
                    <p
                      className="font-medium text-gray-900 truncate"
                      title={job.title || ""}
                    >
                      {job.title || "—"}
                    </p>
                    {/* <p className="text-sm text-gray-500">Title</p> */}
                  </td>
                  <td className="py-4 px-4 whitespace-nowrap">
                    <PriorityBadge priority={job.priority} />
                  </td>
                  <td className="py-4 px-4 whitespace-nowrap">
                    <JobStatusBadge status={job.status} />
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-gray-400 shrink-0" />
                      <span className="text-sm text-gray-600">
                        {job.createdAt ? formatDate(job.createdAt) : "—"}
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-1.5 w-max flex-nowrap">
                      <button
                        type="button"
                        onClick={() => history.push(`/jobs/${job._id}`)}
                        className="p-1.5 rounded-lg text-gray-700 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                        title="View job details"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      {rowStatus !== "assigned" && !isCompleted && (
                        <button
                          type="button"
                          onClick={() => openAssign(job)}
                          className="p-1.5 rounded-lg text-blue-600 hover:text-blue-900 hover:bg-blue-50 transition-colors"
                          title="Assign job"
                        >
                          <Truck className="w-5 h-5" />
                        </button>
                      )}
                      {!isCompleted && (
                        <button
                          type="button"
                          onClick={() => openEdit(job)}
                          className="p-1.5 rounded-lg text-green-600 hover:text-green-900 hover:bg-green-50 transition-colors"
                          title={
                            job.createdFrom?._id || job.createdFrom
                              ? "Edit linked sales order"
                              : "Edit job"
                          }
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                      )}
                      {!isCompleted && !isVoided && (
                        <button
                          type="button"
                          onClick={() => openVoidJobModal(job)}
                          className="p-1.5 rounded-lg text-amber-600 hover:text-amber-900 hover:bg-amber-50 transition-colors"
                          title="Void job"
                        >
                          <Ban className="w-5 h-5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openDeleteJobModal(job)}
                        className="p-1.5 rounded-lg text-red-600 hover:text-red-900 hover:bg-red-50 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            }}
          />
        </div>
      </div>

      {jobModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <form
            onSubmit={submitJob}
            className="bg-white rounded-lg w-full max-w-lg p-6 space-y-3"
          >
            <h2 className="text-lg font-semibold">
              {editingJobId ? "Edit job" : "Create job"}
            </h2>
            <input
              className="w-full border rounded-md px-3 py-2"
              placeholder="Customer ID"
              value={jobForm.customerId}
              onChange={(e) =>
                setJobForm((p) => ({ ...p, customerId: e.target.value }))
              }
              required
            />
            <input
              className="w-full border rounded-md px-3 py-2"
              placeholder="Title"
              value={jobForm.title}
              onChange={(e) =>
                setJobForm((p) => ({ ...p, title: e.target.value }))
              }
              required
            />
            <textarea
              className="w-full border rounded-md px-3 py-2"
              placeholder="Description"
              value={jobForm.description}
              onChange={(e) =>
                setJobForm((p) => ({ ...p, description: e.target.value }))
              }
            />
            <div className="grid grid-cols-2 gap-3">
              <select
                className="border rounded-md px-3 py-2"
                value={jobForm.priority}
                onChange={(e) =>
                  setJobForm((p) => ({ ...p, priority: e.target.value }))
                }
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <select
                className="border rounded-md px-3 py-2"
                value={jobForm.status}
                onChange={(e) =>
                  setJobForm((p) => ({ ...p, status: e.target.value }))
                }
              >
                <option value="draft">Draft</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="assigned">Assigned</option>
                <option value="in_progress">In progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setJobModalOpen(false)}
                className="px-4 py-2 rounded bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded bg-[#0C2E5A] text-white"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      {assignModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <form
            onSubmit={submitAssignment}
            className="bg-white rounded-lg w-full max-w-lg p-6 space-y-3"
          >
            <h2 className="text-lg font-semibold">Assign job</h2>
            <p className="text-sm text-gray-600">{assigningJob?.title}</p>
            {assigningJobBusinessName && !isSingleAssignedBusiness() && (
              <p className="text-sm font-medium text-gray-800">
                {assigningJobBusinessName}
              </p>
            )}
            {!assigningJobBusinessId && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                This job has no business linked. Assign a business to the job
                before scheduling.
              </p>
            )}
            <select
              className="w-full border rounded-md px-3 py-2 disabled:bg-gray-100 disabled:text-gray-500"
              value={assignmentForm.vehicleId}
              onChange={(e) =>
                setAssignmentForm((p) => ({ ...p, vehicleId: e.target.value }))
              }
              required
              disabled={assignContextLoading || !assigningJobBusinessId}
            >
              <option value="">
                {assignContextLoading
                  ? "Loading…"
                  : `Select ${assignModalFleetTerms.vehicleLabelSingular.toLowerCase()}`}
              </option>
              {assignContextVehicles.map((vehicle) => (
                <option key={vehicle._id} value={vehicle._id}>
                  {vehicle.name} ({vehicle.plateNumber})
                  {vehicle.vehicleType?.name
                    ? ` - ${vehicle.vehicleType.name}`
                    : ""}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-3 gap-3">
              <input
                type="date"
                className="border rounded-md px-3 py-2"
                value={assignmentForm.date}
                onChange={(e) =>
                  setAssignmentForm((p) => ({ ...p, date: e.target.value }))
                }
                required
              />
              <input
                type="time"
                className="border rounded-md px-3 py-2"
                value={assignmentForm.startTime}
                onChange={(e) =>
                  setAssignmentForm((p) => ({
                    ...p,
                    startTime: e.target.value,
                    endTime: addMinutesToTimeHHmm(
                      e.target.value,
                      assignDurationMins,
                    ),
                  }))
                }
                required
              />
              <select
                className="border rounded-md px-3 py-2"
                value={assignDurationMins}
                onChange={(e) => {
                  const mins = Number(e.target.value);
                  setAssignDurationMins(mins);
                  setAssignmentForm((p) => ({
                    ...p,
                    endTime: addMinutesToTimeHHmm(p.startTime, mins),
                  }));
                }}
              >
                {DURATION_OPTIONS.map((mins) => (
                  <option key={mins} value={mins}>
                    {mins} min
                  </option>
                ))}
              </select>
              <input
                type="time"
                className="border rounded-md px-3 py-2"
                value={assignmentForm.endTime}
                onChange={(e) =>
                  setAssignmentForm((p) => {
                    const d = timeDiffMinutes(p.startTime, e.target.value);
                    setAssignDurationMins(d);
                    return { ...p, endTime: e.target.value };
                  })
                }
                required
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <select
                className="border rounded-md px-3 py-2"
                value={assignmentForm.status}
                onChange={(e) =>
                  setAssignmentForm((p) => ({ ...p, status: e.target.value }))
                }
              >
                {ASSIGN_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <select
                className="border rounded-md px-3 py-2"
                value={assignmentForm.appointmentType}
                onChange={(e) =>
                  setAssignmentForm((p) => ({
                    ...p,
                    appointmentType: e.target.value,
                  }))
                }
              >
                {APPOINTMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <select
                className="border rounded-md px-3 py-2"
                value={assignmentForm.technicianId}
                onChange={(e) =>
                  setAssignmentForm((p) => ({
                    ...p,
                    technicianId: e.target.value,
                  }))
                }
              >
                <option value="">Select technician</option>
                {businessStaff.map((staff) => (
                  <option key={staff._id} value={staff._id}>
                    {staffDisplayName(staff)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAssignModalOpen(false)}
                className="px-4 py-2 rounded bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded bg-[#0C2E5A] text-white"
              >
                Assign
              </button>
            </div>
          </form>
        </div>
      )}

      {deleteModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 shadow-lg">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Delete job
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete
              {jobPendingDelete?.title ? (
                <>
                  {" "}
                  <span className="font-medium text-gray-900">
                    {`"${jobPendingDelete.title}"`}
                  </span>
                </>
              ) : (
                " this job"
              )}
              ? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setDeleteModalOpen(false);
                  setJobPendingDelete(null);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteJob}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {voidModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 shadow-lg">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Void job
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Voiding this job also cancels linked order/invoice flows and
              removes it from active operations.
            </p>
            <p className="text-sm text-gray-700 mb-3">
              {jobPendingVoid?.title
                ? `Job: "${jobPendingVoid.title}"`
                : "This action will void the selected job."}
            </p>
            <textarea
              className="w-full border rounded-md px-3 py-2 text-sm mb-6"
              placeholder="Reason (optional)"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              rows={3}
            />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setVoidModalOpen(false);
                  setJobPendingVoid(null);
                  setVoidReason("");
                }}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmVoidJob}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
              >
                Void Job
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
