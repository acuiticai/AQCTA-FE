import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Eye,
  RefreshCw,
  UserRound,
  Stethoscope,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Clock3,
  Building2,
} from "lucide-react";
import { DataTable, CustomModal, SummaryCards } from "@/page-layouts";
import StandardPageHeader from "@/components/StandardPageHeader";
import {
  TruncatedCell,
  PRACTITIONER_TABLE_COL_WIDTHS,
} from "@/components/TruncatedCell";
import { notifyError, notifySuccess } from "@/utils/toast";
import ClinikoServices from "@/services/ClinikoServices";
import { AdminContext } from "@/context/AdminContext";
import { filterRowsForAssignedBusinesses } from "@/pages/Appointments/appointmentHelpers";
import SummarySvg from "@/assets/img/summary.svg";
import CompletedSvg from "@/assets/img/completed.svg";
import InProgressSvg from "@/assets/img/in-progress.svg";
import DelayedSvg from "@/assets/img/delayed.svg";
import { isSingleAssignedBusiness } from "@/utils/sessionAssignedBusinesses";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const viewActionBtnClass =
  "p-1.5 rounded-lg text-gray-700 hover:text-gray-900 hover:bg-gray-100 transition-colors";

const normalizeFilterValue = (value) =>
  value == null || value === undefined ? "" : String(value);

function mapPractitionerRow(p, index, businessNameById = new Map()) {
  const flexaBusinessId = p?.flexaBusinessId || p?.businessId || null;
  const active =
    p?.active === false || p?.db?.active === false ? false : p?.active !== false;

  return {
    id: p?.clinikoId || p?.id || `practitioner-${index}`,
    name: p?.name || "—",
    availableDays: p?.availableDays || "—",
    designation: p?.designation || "—",
    description: p?.description || "—",
    active,
    flexaBusinessId,
    businessId: flexaBusinessId,
    business:
      businessNameById.get(String(flexaBusinessId || "")) ||
      p?.businessName ||
      "—",
    db: p,
  };
}

const statusPillClass = (active) =>
  active ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700";

function PractitionerDetailsModal({ practitionerId, businessId, open, onClose }) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !practitionerId) {
      setDetails(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    ClinikoServices.getPractitionerDetails(practitionerId, businessId)
      .then((res) => {
        if (cancelled) return;
        setDetails(res);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err?.response?.data?.message ||
            err?.message ||
            "Could not load practitioner details",
        );
        setDetails(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, practitionerId, businessId]);

  const practitioner = details?.practitioner;
  const stats = details?.stats;

  return (
    <CustomModal
      open={open}
      onClose={onClose}
      title="Practitioner profile"
      width="760px"
      showActions={false}
    >
      {loading ? (
        <div className="py-12 text-center text-sm text-gray-500">
          Loading practitioner details…
        </div>
      ) : error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      ) : practitioner ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-5">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-full bg-[var(--p-blue)]/10 text-[var(--p-blue)] flex items-center justify-center text-xl font-bold shrink-0">
                {(practitioner.name || "P").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-xl font-bold text-gray-900 break-words">
                  {practitioner.name || "—"}
                </h3>
                <p className="mt-1 text-sm text-gray-600 break-words">
                  {practitioner.designation ||
                    practitioner.title ||
                    "Team member"}
                </p>
                <span
                  className={`inline-flex items-center gap-1 mt-3 px-2.5 py-1 rounded-full text-xs font-semibold ${statusPillClass(
                    practitioner.active !== false,
                  )}`}
                >
                  {practitioner.active !== false ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5" />
                  )}
                  {practitioner.active !== false ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {[
              ["Full name", practitioner.name],
              [
                "First / last name",
                [practitioner.firstName, practitioner.lastName]
                  .filter(Boolean)
                  .join(" ") || null,
              ],
              ["Email", practitioner.email],
              ["Title", practitioner.title],
              ["Role", practitioner.designation || practitioner.title],
              [
                "Online bookings",
                practitioner.showInOnlineBookings
                  ? "Accepting bookings"
                  : "Not listed for booking",
              ],
              ["Total appointments", stats?.totalAppointments ?? 0],
              ["Available days", practitioner.availableDays],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-lg border border-gray-200 bg-gray-50 p-3"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {label}
                </p>
                <p className="mt-1 text-[#111] font-semibold break-words">
                  {value == null || value === "" ? "—" : String(value)}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
              About
            </p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
              {practitioner.description ||
                "No profile description has been added yet."}
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock3 className="w-4 h-4 text-gray-500" />
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Available slots
              </p>
            </div>
            {practitioner.schedule?.length ? (
              <div className="space-y-2">
                {practitioner.schedule.map((entry) => (
                  <div
                    key={entry.day}
                    className="flex flex-wrap items-start gap-2 rounded-lg bg-gray-50 px-3 py-2"
                  >
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-gray-800 min-w-[52px]">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      {entry.day}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {entry.slots.map((slot) => (
                        <span
                          key={`${entry.day}-${slot}`}
                          className="inline-flex px-2 py-0.5 rounded-md bg-white border border-gray-200 text-xs font-medium text-gray-700"
                        >
                          {slot}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : practitioner.availableSlots ? (
              <p className="text-sm text-gray-700 break-words">
                {practitioner.availableSlots}
              </p>
            ) : (
              <p className="text-sm text-gray-500">
                No regular availability has been set up for this practitioner.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </CustomModal>
  );
}

export default function PractitionersPage() {
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
  const [selectedStatus, setSelectedStatus] = useState("");
  const [sort, setSort] = useState("az");
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [rows, setRows] = useState([]);
  const [tableLoading, setTableLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [assignedBusinesses, setAssignedBusinesses] = useState([]);
  const [businessesLoading, setBusinessesLoading] = useState(true);
  const [selectedPractitioner, setSelectedPractitioner] = useState(null);

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
        setAssignedBusinesses(response.data?.businesses || []);
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
    if (!onlyId || selectedBusiness) return;
    setSelectedBusiness(String(onlyId));
  }, [businessesLoading, assignedBusinesses, selectedBusiness]);

  const businessNameById = useMemo(() => {
    const map = new Map();
    assignedBusinesses.forEach((b) => {
      if (b?._id) map.set(String(b._id), b.name || "Business");
    });
    return map;
  }, [assignedBusinesses]);

  const loadPractitioners = useCallback(
    async ({ showTableLoading = true, businessId = "" } = {}) => {
      if (showTableLoading) setTableLoading(true);
      try {
        const scopeId = businessId ? String(businessId) : "";
        const res = await ClinikoServices.listPractitioners({
          limit: 500,
          ...(scopeId ? { businessId: scopeId } : {}),
        });
        const list = res?.practitioners || [];
        setRows(list);
      } catch (err) {
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          "Failed to load practitioners";
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
    loadPractitioners({
      showTableLoading: true,
      businessId: selectedBusiness,
    });
  }, [businessesLoading, selectedBusiness, loadPractitioners]);

  const displayRows = useMemo(
    () =>
      rows.map((p, index) => mapPractitionerRow(p, index, businessNameById)),
    [rows, businessNameById],
  );

  const clearFilters = () => {
    setSelectedBusiness(
      assignedBusinesses.length === 1
        ? String(assignedBusinesses[0]?._id || "")
        : "",
    );
    setSelectedStatus("");
    setSearchTerm("");
    setSort("az");
    setCurrentPage(1);
  };

  const handleSyncFromCliniko = async () => {
    const syncBusinessId =
      selectedBusiness ||
      (assignedBusinesses.length === 1
        ? String(assignedBusinesses[0]?._id || "")
        : "");
    if (!syncBusinessId && assignedBusinesses.length > 1) {
      notifyError("Select a business before syncing practitioners from Cliniko");
      return;
    }
    setSyncing(true);
    try {
      const res = await ClinikoServices.syncPractitioners(
        syncBusinessId ? { businessId: syncBusinessId } : {},
      );
      notifySuccess(
        `${res?.synced ?? 0} team member${res?.synced === 1 ? "" : "s"} updated`,
      );
      await loadPractitioners({
        showTableLoading: true,
        businessId: syncBusinessId,
      });
    } catch (err) {
      const msg =
        err?.response?.data?.message || err?.message || "Sync failed";
      if (err?.response?.data?.code === "CLINIKO_RATE_LIMIT") {
        notifyError("Cliniko rate limit reached, try again shortly");
      } else {
        notifyError(msg);
      }
    } finally {
      setSyncing(false);
    }
  };

  const businessOptions = useMemo(
    () =>
      assignedBusinesses.map((b) => ({
        value: String(b._id),
        label: b.name,
      })),
    [assignedBusinesses],
  );

  const businessScopedRows = useMemo(() => {
    return filterRowsForAssignedBusinesses(displayRows, assignedBusinesses, {
      selectedBusinessId: selectedBusiness,
    });
  }, [displayRows, assignedBusinesses, selectedBusiness]);

  const summaryCards = useMemo(() => {
    const total = businessScopedRows.length;
    const active = businessScopedRows.filter((r) => r.active).length;
    const inactive = total - active;
    const online = businessScopedRows.filter(
      (r) => r.db?.showInOnlineBookings,
    ).length;

    return [
      {
        title: "Total practitioners",
        value: total,
        backgroundColor: "summary-light",
        iconColor: "summary-dark",
        Icon: SummarySvg,
      },
      {
        title: "Active",
        value: active,
        backgroundColor: "completed-light",
        iconColor: "completed-dark",
        Icon: CompletedSvg,
      },
      {
        title: "Inactive",
        value: inactive,
        backgroundColor: "in-progress-light",
        iconColor: "in-progress-dark",
        Icon: InProgressSvg,
      },
      {
        title: "Available online",
        value: online,
        backgroundColor: "overdue-light",
        iconColor: "overdue-dark",
        Icon: DelayedSvg,
      },
    ];
  }, [businessScopedRows]);

  const filteredRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    let list = businessScopedRows.filter((row) => {
      const matchesSearch =
        !q ||
        String(row.name).toLowerCase().includes(q) ||
        String(row.business).toLowerCase().includes(q) ||
        String(row.availableDays).toLowerCase().includes(q) ||
        String(row.designation).toLowerCase().includes(q) ||
        String(row.description).toLowerCase().includes(q);

      const statusNorm = normalizeFilterValue(selectedStatus);
      const matchesStatus =
        !statusNorm ||
        statusNorm === "All" ||
        (statusNorm === "Active" && row.active) ||
        (statusNorm === "Inactive" && !row.active);

      return matchesSearch && matchesStatus;
    });

    list.sort((a, b) => {
      const nameA = String(a.name || "").toLowerCase();
      const nameB = String(b.name || "").toLowerCase();
      return sort === "az"
        ? nameA.localeCompare(nameB)
        : nameB.localeCompare(nameA);
    });

    return list;
  }, [businessScopedRows, searchTerm, selectedStatus, sort]);

  const hideBusinessField = isSingleAssignedBusiness();

  const filters = [
    {
      isClearButton: true,
      buttonProps: {
        onClick: clearFilters,
      },
    },
    ...(!hideBusinessField
      ? [
          {
            label: "Business",
            value: selectedBusiness,
            onChange: (value) => {
              setSelectedBusiness(normalizeFilterValue(value));
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
      label: "Status",
      value: selectedStatus,
      onChange: (value) => {
        setSelectedStatus(normalizeFilterValue(value));
        setCurrentPage(1);
      },
      options: [
        { value: "All", label: "All Statuses" },
        { value: "Active", label: "Active" },
        { value: "Inactive", label: "Inactive" },
      ],
      placeholder: "All Statuses",
      icon: FileText,
    },
    {
      label: "Sort",
      value: sort,
      onChange: (value) => {
        setSort(value || "az");
        setCurrentPage(1);
      },
      options: [
        { value: "az", label: "Name A–Z" },
        { value: "za", label: "Name Z–A" },
      ],
      placeholder: "Sort by name",
      icon: UserRound,
    },
  ];

  const paginated = useMemo(() => {
    const total = filteredRows.length;
    const pages = Math.max(1, Math.ceil(total / recordsPerPage));
    const start = (currentPage - 1) * recordsPerPage;
    return {
      rows: filteredRows.slice(start, start + recordsPerPage),
      total,
      pages,
    };
  }, [filteredRows, currentPage, recordsPerPage]);

  useEffect(() => {
    if (currentPage > paginated.pages) {
      setCurrentPage(paginated.pages);
    }
  }, [currentPage, paginated.pages]);

  return (
    <div className="bg-gray-50 min-h-screen w-full max-w-full overflow-x-hidden">
      <div className="w-full max-w-full mx-auto px-6 py-8 min-w-0 overflow-x-hidden">
        <StandardPageHeader
          title="Practitioners"
          subtitle="View your care team, roles, and availability."
          className="mb-2"
          actions={
            <button
              type="button"
              onClick={handleSyncFromCliniko}
              disabled={syncing || tableLoading}
              className="flex items-center gap-2 px-6 py-3 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[var(--p-blue-dark)] transition-colors shadow-sm disabled:opacity-50"
            >
              <RefreshCw size={20} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Refreshing…" : "Refresh team list"}
            </button>
          }
        />

        <div className="mb-6 mt-6">
          <SummaryCards cards={summaryCards} columnsCount={4} />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 min-w-0 max-w-full overflow-hidden">
          <DataTable
            title=""
            filters={filters}
            skipDynamicColumnWidths
            colWidths={PRACTITIONER_TABLE_COL_WIDTHS}
            searchValue={searchTerm}
            onSearch={(val) => {
              setSearchTerm(val);
              setCurrentPage(1);
            }}
            searchPlaceholder="Search practitioners..."
            loading={tableLoading || businessesLoading}
            headers={[
              "Practitioner",
              ...(!hideBusinessField ? ["Business"] : []),
              "Available days",
              "Designation",
              "Description",
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
              displayRows.length === 0
                ? hideBusinessField
                  ? "No practitioners found. Refresh from Cliniko."
                  : "No practitioners found. Select a business and refresh from Cliniko."
                : selectedBusiness && !hideBusinessField
                  ? "No practitioners for this business. Clear the filter or sync from Cliniko."
                  : "No practitioners match your filters."
            }
            renderRow={(row) => (
              <tr>
                <td className="py-4 px-4 max-w-0">
                  <TruncatedCell
                    icon={UserRound}
                    textClassName="font-medium text-gray-800"
                  >
                    {row.name}
                  </TruncatedCell>
                </td>
                {!hideBusinessField && (
                  <td className="py-4 px-4 max-w-0">
                    <TruncatedCell icon={Building2}>{row.business}</TruncatedCell>
                  </td>
                )}
                <td className="py-4 px-4 max-w-0">
                  <TruncatedCell icon={Calendar}>
                    {row.availableDays}
                  </TruncatedCell>
                </td>
                <td className="py-4 px-4 max-w-0">
                  <TruncatedCell icon={Stethoscope}>
                    {row.designation}
                  </TruncatedCell>
                </td>
                <td className="py-4 px-4 max-w-0">
                  <TruncatedCell>{row.description}</TruncatedCell>
                </td>
                <td className="py-4 px-4 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusPillClass(
                      row.active,
                    )}`}
                  >
                    {row.active ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    )}
                    {row.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="py-4 px-4 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedPractitioner({
                        id: row.id || row.db?.clinikoId,
                        businessId: row.flexaBusinessId || row.businessId,
                      })
                    }
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

      <PractitionerDetailsModal
        practitionerId={selectedPractitioner?.id}
        businessId={selectedPractitioner?.businessId}
        open={!!selectedPractitioner?.id}
        onClose={() => setSelectedPractitioner(null)}
      />
    </div>
  );
}
