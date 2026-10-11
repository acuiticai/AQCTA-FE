import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useHistory } from "react-router-dom";
import axios from "axios";
import {
  Calendar,
  Eye,
  Building2,
  UserRound,
  Stethoscope,
  CheckCircle2,
  Clock3,
  FileText,
  RefreshCw,
  Check,
  XCircle,
  Trash2,
} from "lucide-react";
import { DataTable, SummaryCards, CustomModal } from "@/page-layouts";
import ClinikoServices from "@/services/ClinikoServices";
import StandardPageHeader from "@/components/StandardPageHeader";
import {
  TruncatedCell,
  APPOINTMENT_TABLE_COL_WIDTHS,
} from "@/components/TruncatedCell";
import { AdminContext } from "@/context/AdminContext";
import { notifyError, notifySuccess } from "@/utils/toast";
import SummarySvg from "@/assets/img/summary.svg";
import CompletedSvg from "@/assets/img/completed.svg";
import InProgressSvg from "@/assets/img/in-progress.svg";
import DelayedSvg from "@/assets/img/delayed.svg";
import {
  formatDateTime,
  mapRequestRow,
  mapAppointmentRow,
  mergeBookingRequestMeta,
  indexRequestsByClinikoId,
  appointmentDetailPath,
  appointmentRecencyMs,
  filterRowsForAssignedBusinesses,
} from "./appointmentHelpers";
import { AppointmentStatusPill } from "./AppointmentStatusPill";
import { isSingleAssignedBusiness } from "@/utils/sessionAssignedBusinesses";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const normalizeFilterValue = (value) =>
  value == null || value === undefined ? "" : String(value);

const viewActionBtnClass =
  "p-1.5 rounded-lg text-gray-700 hover:text-gray-900 hover:bg-gray-100 transition-colors";

const statusIcon = (status) => {
  switch (String(status).toLowerCase()) {
    case "cancelled":
    case "no show":
    case "declined":
    case "rejected":
    case "cancelled by patient":
      return XCircle;
    case "completed":
      return CheckCircle2;
    case "confirmed":
      return Check;
    default:
      return Clock3;
  }
};

export default function AppointmentsPage() {
  const history = useHistory();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo?.token}`,
    }),
    [adminInfo?.token],
  );

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBusiness, setSelectedBusiness] = useState("");
  const [selectedPractitioner, setSelectedPractitioner] = useState("");
  const [selectedService, setSelectedService] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [rows, setRows] = useState([]);
  const [tableLoading, setTableLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [clinikoConnection, setClinikoConnection] = useState(null);
  const [assignedBusinesses, setAssignedBusinesses] = useState([]);
  const [businessesLoading, setBusinessesLoading] = useState(true);

  useEffect(() => {
    const fetchAssignedBusinesses = async () => {
      if (!adminInfo?.id) {
        setAssignedBusinesses([]);
        setBusinessesLoading(false);
        return;
      }
      try {
        const response = await axios.get(
          `${Base_URL}/admin/assigned/${adminInfo.id}`,
          { headers },
        );
        const list = response.data?.businesses || [];
        setAssignedBusinesses(list);
      } catch (error) {
        console.error("Failed to fetch assigned businesses:", error);
        setAssignedBusinesses([]);
      } finally {
        setBusinessesLoading(false);
      }
    };
    fetchAssignedBusinesses();
  }, [adminInfo?.id, headers]);

  useEffect(() => {
    if (businessesLoading) return;
    if (assignedBusinesses.length !== 1) return;
    const onlyId = assignedBusinesses[0]?._id;
    if (!onlyId) return;
    if (selectedBusiness) return;
    setSelectedBusiness(String(onlyId));
  }, [businessesLoading, assignedBusinesses, selectedBusiness]);

  const loadAppointments = useCallback(
    async ({ showTableLoading = true, businessId = "" } = {}) => {
      if (showTableLoading) setTableLoading(true);
      try {
        const scopeId = businessId ? String(businessId) : "";
        const listParams = scopeId
          ? { limit: 500, businessId: scopeId }
          : { limit: 500 };
        const requestParams = scopeId
          ? { status: "all", businessId: scopeId }
          : { status: "all" };

        const [apptRes, requestRes] = await Promise.all([
          ClinikoServices.listAppointments(listParams),
          ClinikoServices.listAppointmentRequests(requestParams).catch(() => ({
            requests: [],
          })),
        ]);
        if (apptRes?.connection) {
          setClinikoConnection(apptRes.connection);
        }
        const list = apptRes?.appointments || [];
        const allRequests = requestRes?.requests || [];
        const requestsByClinikoId = indexRequestsByClinikoId(allRequests);
        const appointmentRows = list.map((appt, index) => {
          const row = mapAppointmentRow(appt, index);
          const linkedRequest = requestsByClinikoId.get(String(row.id));
          return mergeBookingRequestMeta(row, linkedRequest);
        });
        const clinikoIds = new Set(
          appointmentRows.map((row) => String(row.id)).filter(Boolean),
        );
        const requestRows = allRequests
          .map(mapRequestRow)
          .filter((row) => {
            const status = String(row.status).toLowerCase();
            return (
              status === "pending approval" ||
              status === "pending admin approval" ||
              status === "reschedule requested" ||
              status === "declined" ||
              status === "cancelled by patient"
            );
          })
          .filter((row) => {
            const linkedClinikoId =
              row.raw?.clinikoAppointmentId || row.db?.clinikoAppointmentId;
            if (linkedClinikoId && clinikoIds.has(String(linkedClinikoId))) {
              return false;
            }
            return !clinikoIds.has(String(row.appointmentId));
          });
        const merged = [...requestRows, ...appointmentRows].sort(
          (a, b) => appointmentRecencyMs(b) - appointmentRecencyMs(a),
        );
        setRows(merged);
      } catch (err) {
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          "Failed to load appointments";
        notifyError(msg);
        setRows([]);
      } finally {
        setTableLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (businessesLoading) return;
    loadAppointments({
      showTableLoading: true,
      businessId: selectedBusiness,
    });
  }, [businessesLoading, selectedBusiness, loadAppointments]);

  useEffect(() => {
    let cancelled = false;
    const loadConnection = async () => {
      try {
        const businessId =
          selectedBusiness ||
          (assignedBusinesses.length === 1
            ? String(assignedBusinesses[0]?._id || "")
            : "");
        if (!businessId) return;
        const res = await ClinikoServices.getConnection(businessId);
        if (!cancelled && res?.connection) {
          setClinikoConnection(res.connection);
        }
      } catch {
        /* optional — list response may already include connection */
      }
    };
    loadConnection();
    return () => {
      cancelled = true;
    };
  }, [selectedBusiness, assignedBusinesses]);

  const clearFilters = () => {
    setSelectedBusiness(
      assignedBusinesses.length === 1
        ? String(assignedBusinesses[0]?._id || "")
        : "",
    );
    setSelectedPractitioner("");
    setSelectedService("");
    setSelectedStatus("");
    setSelectedDate("");
    setSearchTerm("");
    setCurrentPage(1);
  };

  const handleSyncFromCliniko = async () => {
    const syncBusinessId =
      selectedBusiness ||
      (assignedBusinesses.length === 1
        ? String(assignedBusinesses[0]?._id || "")
        : "");
    if (!syncBusinessId && assignedBusinesses.length > 1) {
      notifyError("Select a business before syncing from Cliniko");
      return;
    }
    setSyncing(true);
    try {
      const res = await ClinikoServices.sync(
        syncBusinessId ? { businessId: syncBusinessId } : {},
      );
      const accountLabel =
        clinikoConnection?.businessName ||
        res?.connection?.businessName ||
        "connected Cliniko account";
      notifySuccess(
        `${res?.synced ?? 0} appointment${res?.synced === 1 ? "" : "s"} updated from ${accountLabel}`,
      );
      await loadAppointments({
        showTableLoading: true,
        businessId: syncBusinessId,
      });
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Sync failed";
      if (err?.response?.data?.code === "CLINIKO_RATE_LIMIT") {
        notifyError("Cliniko rate limit reached, try again shortly");
      } else if (String(msg).toLowerCase().includes("not connected")) {
        notifyError(
          "Connect your practice system in Settings → Integrations first",
        );
      } else {
        notifyError(msg);
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteAll = async () => {
    const deleteBusinessId =
      selectedBusiness ||
      (assignedBusinesses.length === 1
        ? String(assignedBusinesses[0]?._id || "")
        : "");
    setDeletingAll(true);
    try {
      const res = await ClinikoServices.clearLocalAppointments(deleteBusinessId);
      const deletedAppts = res?.deleted?.appointments ?? 0;
      const deletedReqs = res?.deleted?.requests ?? 0;
      notifySuccess(
        `Deleted ${deletedAppts + deletedReqs} local item${
          deletedAppts + deletedReqs === 1 ? "" : "s"
        } (${deletedReqs} request${deletedReqs === 1 ? "" : "s"}, ${deletedAppts} synced)`,
      );
      setConfirmDeleteAll(false);
      setRows([]);
      await loadAppointments({
        showTableLoading: true,
        businessId: deleteBusinessId,
      });
    } catch (err) {
      notifyError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to delete appointments",
      );
    } finally {
      setDeletingAll(false);
    }
  };

  const businessScopedRows = useMemo(() => {
    return filterRowsForAssignedBusinesses(rows, assignedBusinesses, {
      selectedBusinessId: selectedBusiness,
    });
  }, [rows, assignedBusinesses, selectedBusiness]);

  const stats = useMemo(() => {
    const total = businessScopedRows.length;
    const pendingApproval = businessScopedRows.filter(
      (r) =>
        r.status === "Pending Approval" ||
        r.status === "Pending Admin Approval" ||
        r.status === "Reschedule Requested",
    ).length;
    const pending = businessScopedRows.filter(
      (r) => r.status === "Pending Review",
    ).length;
    const confirmed = businessScopedRows.filter(
      (r) => r.status === "Confirmed",
    ).length;
    const completed = businessScopedRows.filter(
      (r) => r.status === "Completed",
    ).length;
    const cancelled = businessScopedRows.filter(
      (r) =>
        r.status === "Cancelled" ||
        r.status === "No Show" ||
        r.status === "Declined" ||
        r.status === "Cancelled by Patient",
    ).length;
    return {
      total,
      pendingApproval,
      pending,
      pendingTotal: pendingApproval + pending,
      confirmed,
      completed,
      cancelled,
    };
  }, [businessScopedRows]);

  const summaryCards = [
    {
      title: "Total appointments",
      value: stats.total,
      backgroundColor: "summary-light",
      iconColor: "summary-dark",
      Icon: SummarySvg,
    },
    {
      title: "Pending",
      value: stats.pendingTotal,
      backgroundColor: "processing-light",
      iconColor: "processing-dark",
      Icon: InProgressSvg,
    },
    {
      title: "Confirmed / completed",
      value: stats.confirmed + stats.completed,
      backgroundColor: "completed-light",
      iconColor: "completed-dark",
      Icon: CompletedSvg,
    },
    {
      title: "Cancelled / declined",
      value: stats.cancelled,
      backgroundColor: "overdue-light",
      iconColor: "overdue-dark",
      Icon: DelayedSvg,
    },
  ];

  const businessOptions = useMemo(
    () =>
      assignedBusinesses.map((b) => ({
        value: String(b._id),
        label: b.name,
      })),
    [assignedBusinesses],
  );

  const practitionerOptions = useMemo(() => {
    const values = new Set(
      businessScopedRows
        .map((row) => String(row.practitioner || "").trim())
        .filter((name) => name && name !== "—"),
    );
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [businessScopedRows]);

  const serviceOptions = useMemo(() => {
    const values = new Set(
      businessScopedRows
        .map((row) => String(row.service || "").trim())
        .filter((name) => name && name !== "—"),
    );
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [businessScopedRows]);

  useEffect(() => {
    if (
      selectedPractitioner &&
      !practitionerOptions.includes(selectedPractitioner)
    ) {
      setSelectedPractitioner("");
    }
  }, [practitionerOptions, selectedPractitioner]);

  useEffect(() => {
    if (selectedService && !serviceOptions.includes(selectedService)) {
      setSelectedService("");
    }
  }, [serviceOptions, selectedService]);

  const filteredRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return businessScopedRows
      .filter((row) => {
        const matchesSearch =
          !q ||
          String(row.appointmentId).toLowerCase().includes(q) ||
          String(row.patient).toLowerCase().includes(q) ||
          String(row.service).toLowerCase().includes(q) ||
          String(row.practitioner).toLowerCase().includes(q) ||
          String(row.business).toLowerCase().includes(q);

        const matchesPractitioner =
          !selectedPractitioner ||
          String(row.practitioner || "").trim() === selectedPractitioner;
        const matchesService =
          !selectedService ||
          String(row.service || "").trim() === selectedService;
        const matchesStatus =
          !selectedStatus ||
          selectedStatus === "All" ||
          row.status === selectedStatus;
        const matchesDate =
          !selectedDate ||
          (row.startsAt &&
            new Date(row.startsAt).toISOString().slice(0, 10) === selectedDate);

        return (
          matchesSearch &&
          matchesPractitioner &&
          matchesService &&
          matchesStatus &&
          matchesDate
        );
      })
      .sort((a, b) => appointmentRecencyMs(b) - appointmentRecencyMs(a));
  }, [
    businessScopedRows,
    searchTerm,
    selectedPractitioner,
    selectedService,
    selectedStatus,
    selectedDate,
  ]);

  const hideBusinessField = isSingleAssignedBusiness();

  const filters = [
    {
      isClearButton: true,
      buttonProps: {
        onClick: () => {
          clearFilters();
        },
      },
    },
    ...(!hideBusinessField
      ? [
          {
            label: "Business",
            value: selectedBusiness,
            onChange: (value) => {
              setSelectedBusiness(normalizeFilterValue(value));
              setSelectedPractitioner("");
              setSelectedService("");
              setCurrentPage(1);
            },
            options: businessOptions,
            placeholder:
              assignedBusinesses.length > 1
                ? "All assigned businesses"
                : assignedBusinesses.length === 1
                  ? assignedBusinesses[0]?.name || "Business"
                  : "No assigned businesses",
            isClearable: assignedBusinesses.length > 1,
            icon: Building2,
          },
        ]
      : []),
    {
      label: "Practitioner",
      value: selectedPractitioner,
      onChange: (value) => {
        setSelectedPractitioner(normalizeFilterValue(value));
        setCurrentPage(1);
      },
      options: practitionerOptions.map((practitioner) => ({
        value: practitioner,
        label: practitioner,
      })),
      placeholder: "All Practitioners",
      icon: UserRound,
    },
    {
      label: "Status",
      value: selectedStatus,
      onChange: (value) => {
        setSelectedStatus(normalizeFilterValue(value));
        setCurrentPage(1);
      },
      options: [
        { value: "All", label: "All Statuses" },
        { value: "Pending Approval", label: "Pending Approval" },
        { value: "Pending Admin Approval", label: "Pending Admin Approval" },
        { value: "Reschedule Requested", label: "Reschedule Requested" },
        { value: "Pending Review", label: "Pending Review" },
        { value: "Confirmed", label: "Confirmed" },
        { value: "Completed", label: "Completed" },
        { value: "Declined", label: "Declined" },
        { value: "Cancelled by Patient", label: "Cancelled by Patient" },
        { value: "Cancelled", label: "Cancelled" },
        { value: "No Show", label: "No Show" },
      ],
      placeholder: "All Statuses",
      icon: FileText,
    },
    {
      label: "Service",
      value: selectedService,
      onChange: (value) => {
        setSelectedService(normalizeFilterValue(value));
        setCurrentPage(1);
      },
      options: serviceOptions.map((service) => ({
        value: service,
        label: service,
      })),
      placeholder: "All Services",
      icon: Stethoscope,
    },
    {
      label: "Date",
      value: selectedDate,
      onChange: (val) => {
        setSelectedDate(normalizeFilterValue(val));
        setCurrentPage(1);
      },
      isDatePicker: true,
      placeholder: "Date",
      icon: Calendar,
    },
  ];

  const paginated = useMemo(() => {
    const total = filteredRows.length;
    const pages = Math.max(1, Math.ceil(total / recordsPerPage));
    const start = (currentPage - 1) * recordsPerPage;
    return {
      total,
      pages,
      rows: filteredRows.slice(start, start + recordsPerPage),
    };
  }, [filteredRows, currentPage, recordsPerPage]);

  useEffect(() => {
    if (currentPage > paginated.pages) {
      setCurrentPage(paginated.pages);
    }
  }, [currentPage, paginated.pages]);

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <StandardPageHeader
        title="Appointments"
        subtitle="Review booking requests and manage your Cliniko schedule"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* <button
              type="button"
              onClick={() => setConfirmDeleteAll(true)}
              disabled={deletingAll || tableLoading || rows.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              Delete all
            </button> */}
            <button
              type="button"
              onClick={handleSyncFromCliniko}
              disabled={syncing || tableLoading}
              className="flex items-center gap-2 px-6 py-3 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[var(--p-blue-dark)] transition-colors shadow-sm disabled:opacity-50"
            >
              <RefreshCw
                size={20}
                className={syncing ? "animate-spin" : ""}
              />
              {syncing ? "Refreshing…" : "Refresh schedule"}
            </button>
          </div>
        }
      />

      <div className="mt-2">
        <SummaryCards cards={summaryCards} />
      </div>

      <div className="mt-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <DataTable
            filters={filters}
            skipDynamicColumnWidths
            colWidths={APPOINTMENT_TABLE_COL_WIDTHS}
            searchValue={searchTerm}
            onSearch={(val) => {
              setSearchTerm(val);
              setCurrentPage(1);
            }}
            searchPlaceholder="Search appointments..."
            loading={tableLoading || businessesLoading}
            headers={[
              "Appointment ID",
              "Patient",
              "Service",
              "Practitioner",
              ...(!hideBusinessField ? ["Business"] : []),
              "Start",
              "Status",
              "Actions",
            ]}
            data={paginated.rows}
            totalRecords={paginated.total}
            currentPage={currentPage}
            totalPages={paginated.pages}
            recordsPerPage={recordsPerPage}
            onPageChange={setCurrentPage}
            onRecordsPerPageChange={(perPage) => {
              setRecordsPerPage(perPage);
              setCurrentPage(1);
            }}
            emptyMessage={
              rows.length === 0
                ? "No appointments found. Click Refresh schedule to sync from Cliniko."
                : selectedBusiness && !hideBusinessField
                  ? "No appointments for this business. Clear the Business filter or refresh your schedule."
                  : "No appointments match your filters. Clear filters or refresh your schedule."
            }
            renderRow={(row) => (
              <tr>
                <td className="py-4 px-4 max-w-0">
                  <div
                    className="font-semibold text-gray-900 truncate"
                    title={String(row.appointmentId)}
                  >
                    {row.appointmentId}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {row.isBookingRequest ? "New booking" : "Scheduled visit"}
                  </div>
                </td>
                <td className="py-4 px-4 max-w-0">
                  <TruncatedCell
                    icon={UserRound}
                    textClassName="font-medium text-gray-800"
                  >
                    {row.patient}
                  </TruncatedCell>
                </td>
                <td className="py-4 px-4 max-w-0">
                  <TruncatedCell icon={Stethoscope}>
                    {row.service}
                  </TruncatedCell>
                </td>
                <td className="py-4 px-4 max-w-0">
                  <TruncatedCell icon={UserRound}>
                    {row.practitioner}
                  </TruncatedCell>
                </td>
                {!hideBusinessField && (
                  <td className="py-4 px-4 max-w-0">
                    <TruncatedCell icon={Building2}>{row.business}</TruncatedCell>
                  </td>
                )}
                <td className="py-4 px-4 max-w-0">
                  <TruncatedCell icon={Calendar}>
                    {formatDateTime(row.startsAt)}
                  </TruncatedCell>
                </td>
                <td className="py-4 px-4 max-w-0">
                  <AppointmentStatusPill
                    status={row.status}
                    icon={statusIcon(row.status)}
                  />
                </td>
                <td className="py-4 px-4 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => history.push(appointmentDetailPath(row))}
                    className={viewActionBtnClass}
                    title="View details"
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            )}
          />
        </div>
      </div>

      <CustomModal
        open={confirmDeleteAll}
        onClose={() => !deletingAll && setConfirmDeleteAll(false)}
        title="Delete all appointments?"
        width="520px"
        zIndex={10000}
        showActions
        actions={[
          {
            label: "Keep",
            secondary: true,
            onClick: () => setConfirmDeleteAll(false),
            disabled: deletingAll,
          },
          {
            label: deletingAll ? "Deleting…" : "Delete all",
            failure: true,
            onClick: handleDeleteAll,
            disabled: deletingAll,
          },
        ]}
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-700 leading-relaxed">
            This removes all{" "}
            <span className="font-semibold text-gray-900">
              {rows.length} local appointment{rows.length === 1 ? "" : "s"}
            </span>{" "}
            and WonderKids booking requests from PCI for your account.
          </p>
          <p className="text-sm text-gray-500 leading-relaxed">
            Appointments in Cliniko are not deleted. You can refresh the
            schedule later to re-sync from Cliniko.
          </p>
        </div>
      </CustomModal>
    </div>
  );
}
