import { useEffect, useState, useContext, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { recurringInvoiceText as riText } from "@/utils/recurringInvoiceI18n";
import {
  Calendar,
  Building,
  User,
  Plus,
  FileText,
  Eye,
  Edit,
  Trash2,
} from "lucide-react";
import { useHistory } from "react-router-dom";
import axios from "axios";
import {
  DataTable,
  SummaryCards,
  DateRangeComponent,
} from "@/page-layouts/index";
import StandardPageHeader from "@/components/StandardPageHeader";
import { formatAmount } from "@/components/formatAmount";
import { notifyError, notifySuccess } from "@/utils/toast";
import { AdminContext } from "@/context/AdminContext";
import { useRouteModulePermissions } from "@/utils/permissionUtils";
import { isSingleAssignedBusiness } from "@/utils/sessionAssignedBusinesses";
import { format } from "date-fns";
import SummarySvg from "@/assets/img/summary.svg";
import CompletedSvg from "@/assets/img/completed.svg";
import InProgressSvg from "@/assets/img/in-progress.svg";
import DollarSvg from "../../../assets/img/icons/stats-1.png";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const PROFILE_STATUS_LABELS = {
  active: "Active",
  paused: "Paused",
  stopped: "Stopped",
  expired: "Expired",
};

function profileStatusClass(status) {
  const s = (status || "").toLowerCase();
  if (s === "active") return "bg-green-100 text-green-800";
  if (s === "paused") return "bg-yellow-100 text-yellow-800";
  if (s === "stopped") return "bg-gray-100 text-gray-800";
  if (s === "expired") return "bg-red-100 text-red-800";
  return "bg-gray-100 text-gray-800";
}

export default function RecurringInvoices() {
  const { i18n } = useTranslation();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo?.token}`,
  };

  const [selectedBusinessFilter, setSelectedBusinessFilter] = useState("");
  const [selectedCustomerFilter, setSelectedCustomerFilter] = useState("");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("All");
  const [dateRangeStart, setDateRangeStart] = useState("");
  const [dateRangeEnd, setDateRangeEnd] = useState("");
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [businessesLoading, setBusinessesLoading] = useState(true);
  const history = useHistory();

  const routePerms = useRouteModulePermissions();
  const { canAdd, canUpdate, canView, canViewDetails, canDelete } = routePerms;
  const canViewPage = canView || canViewDetails;

  const [businesses, setBusinesses] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [overallStats, setOverallStats] = useState({
    totalProfiles: 0,
    activeProfiles: 0,
    pausedProfiles: 0,
    totalValue: 0,
  });
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [profileToDelete, setProfileToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const clearAllFilters = () => {
    setSelectedBusinessFilter("");
    setSelectedCustomerFilter("");
    setSelectedStatusFilter("All");
    setDateRangeStart("");
    setDateRangeEnd("");
    setSearchTerm("");
    setCurrentPage(1);
  };

  const filters = useMemo(
    () => [
      {
        isClearButton: true,
        buttonProps: {
          onClick: () => {
            clearAllFilters();
            setCurrentPage(1);
          },
        },
      },
      ...(!isSingleAssignedBusiness()
        ? [
            {
              label: riText("Business"),
              value: selectedBusinessFilter,
              onChange: (value) => {
                setSelectedBusinessFilter(value);
                setCurrentPage(1);
              },
              options: businesses.map((b) => ({
                value: b._id,
                label: b.name,
              })),
              placeholder: riText("Select Business"),
              icon: Building,
            },
          ]
        : []),
      {
        label: riText("Customer"),
        value: selectedCustomerFilter,
        onChange: (value) => {
          setSelectedCustomerFilter(value);
          setCurrentPage(1);
        },
        options: customers.map((c) => ({
          value: c._id,
          label:
            c.basicInformation?.customerDisplayName ??
            c.basicInformation?.companyName ??
            "—",
        })),
        placeholder: riText("Select Customer"),
        icon: User,
      },
      {
        label: riText("Profile status"),
        value: selectedStatusFilter,
        onChange: (value) => {
          setSelectedStatusFilter(value);
          setCurrentPage(1);
        },
        options: [
          { value: "All", label: riText("All statuses") },
          { value: "active", label: riText("Active") },
          { value: "paused", label: riText("Paused") },
          { value: "stopped", label: riText("Stopped") },
          { value: "expired", label: riText("Expired") },
        ],
        placeholder: riText("Status: All"),
        icon: FileText,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      selectedBusinessFilter,
      selectedCustomerFilter,
      selectedStatusFilter,
      businesses,
      customers,
      i18n.language,
    ],
  );

  const tableHeaders = useMemo(
    () => [
      riText("Profile #"),
      riText("Profile name"),
      riText("Customer"),
      riText("Repeat"),
      riText("Start — End"),
      riText("Next invoice"),
      riText("Salesperson"),
      riText("Status"),
      riText("Amount"),
      riText("Actions"),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [i18n.language],
  );

  const tableColWidths = useMemo(
    () => ({
      [riText("Profile #")]: "170px",
      [riText("Profile name")]: "220px",
      [riText("Customer")]: "260px",
      [riText("Repeat")]: "150px",
      [riText("Start — End")]: "240px",
      [riText("Next invoice")]: "180px",
      [riText("Salesperson")]: "180px",
      [riText("Status")]: "150px",
      [riText("Amount")]: "180px",
      [riText("Actions")]: "160px",
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [i18n.language],
  );

  const fetchProfiles = async () => {
    if (businesses.length === 0) {
      if (!businessesLoading) setLoading(false);
      setProfiles([]);
      setTotalPages(1);
      setOverallStats({
        totalProfiles: 0,
        activeProfiles: 0,
        pausedProfiles: 0,
        totalValue: 0,
      });
      return;
    }

    setLoading(true);
    try {
      const assignedIds = (businesses || []).map((b) => b._id).filter(Boolean);
      const params = {
        ...(selectedBusinessFilter
          ? { businessId: selectedBusinessFilter }
          : assignedIds.length > 0
            ? { businessIds: assignedIds.join(",") }
            : {}),
        customerId: selectedCustomerFilter || undefined,
        profile_status:
          selectedStatusFilter !== "All" ? selectedStatusFilter : undefined,
        search: searchTerm || undefined,
        page: currentPage,
        limit: entriesPerPage,
        ...(dateRangeStart && { dateFrom: dateRangeStart }),
        ...(dateRangeEnd && { dateTo: dateRangeEnd }),
      };
      Object.keys(params).forEach(
        (key) => params[key] === undefined && delete params[key],
      );

      const res = await axios.get(`${Base_URL}/recurring-invoice`, {
        params,
        headers,
      });

      let rows = res.data?.data || [];
      const assignedBusinessIds = (businesses || []).map((b) => String(b._id));
      if (assignedBusinessIds.length > 0) {
        rows = rows.filter((p) => {
          const bid = p.business_id?._id ?? p.business_id;
          if (!bid) return false;
          const bidStr = typeof bid === "string" ? bid : String(bid);
          return assignedBusinessIds.includes(bidStr);
        });
      } else {
        rows = [];
      }

      setProfiles(rows);
      setTotalPages(res.data?.totalPages || 1);
      setOverallStats(
        res.data?.overallStats || {
          totalProfiles: 0,
          activeProfiles: 0,
          pausedProfiles: 0,
          totalValue: 0,
        },
      );
    } catch (err) {
      console.error(err);
      notifyError(riText("Failed to load recurring invoices"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchBusinesses = async () => {
      if (!adminInfo?.id) {
        setBusinessesLoading(false);
        return;
      }
      try {
        const response = await axios.get(
          `${Base_URL}/admin/assigned/${adminInfo.id}`,
          { headers },
        );
        setBusinesses(response.data?.businesses || []);
      } catch (e) {
        console.error(e);
      } finally {
        setBusinessesLoading(false);
      }
    };
    fetchBusinesses();
  }, [adminInfo?.id]);

  useEffect(() => {
    if (!selectedBusinessFilter) {
      setCustomers([]);
      setSelectedCustomerFilter("");
      return;
    }
    (async () => {
      try {
        const response = await axios.get(
          `${Base_URL}/customers_by_business/${selectedBusinessFilter}`,
          { headers },
        );
        const list = Array.isArray(response?.data)
          ? response.data.filter((c) => !c.status || c.status === "Active")
          : [];
        setCustomers(list);
        setSelectedCustomerFilter("");
      } catch (e) {
        console.error(e);
        setCustomers([]);
      }
    })();
  }, [selectedBusinessFilter, adminInfo?.id]);

  useEffect(() => {
    setCurrentPage(1);
    fetchProfiles();
  }, [
    selectedBusinessFilter,
    selectedCustomerFilter,
    selectedStatusFilter,
    dateRangeStart,
    dateRangeEnd,
    searchTerm,
    businesses.length,
  ]);

  useEffect(() => {
    fetchProfiles();
  }, [currentPage, entriesPerPage, selectedBusinessFilter]);

  const openDeleteModal = (row, e) => {
    e?.stopPropagation?.();
    setProfileToDelete(row);
    setDeleteModalOpen(true);
  };

  const confirmDeleteProfile = async () => {
    const id = profileToDelete?._id;
    if (!id) return;
    setDeleteLoading(true);
    try {
      await axios.delete(`${Base_URL}/recurring-invoice/${id}`, { headers });
      notifySuccess(riText("Profile deleted"));
      setDeleteModalOpen(false);
      setProfileToDelete(null);
      fetchProfiles();
    } catch (e) {
      notifyError(e.response?.data?.message || riText("Delete failed"));
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDateRangeApply = (startDate, endDate) => {
    setDateRangeStart(startDate);
    setDateRangeEnd(endDate);
    setCurrentPage(1);
  };

  const handleDateRangeClear = () => {
    setDateRangeStart("");
    setDateRangeEnd("");
    setCurrentPage(1);
  };

  const summaryCardsData = useMemo(
    () => [
      {
        title: riText("Total profiles"),
        value: overallStats.totalProfiles || 0,
        backgroundColor: "summary-light",
        iconColor: "summary-dark",
        Icon: SummarySvg,
      },
      {
        title: riText("Active"),
        value: overallStats.activeProfiles || 0,
        backgroundColor: "completed-light",
        iconColor: "completed-dark",
        Icon: CompletedSvg,
      },
      {
        title: riText("Paused"),
        value: overallStats.pausedProfiles || 0,
        backgroundColor: "processing-light",
        iconColor: "processing-dark",
        Icon: InProgressSvg,
      },
      {
        title: riText("Total value"),
        value: `${formatAmount(overallStats.totalValue || 0)}`,
        backgroundColor: "completed-light",
        iconColor: "overdue-dark",
        Icon: DollarSvg,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [overallStats, i18n.language],
  );

  const getRepeatLabel = (row) => {
    const unitLabel =
      row.repeat_unit === "day"
        ? riText("day(s)")
        : row.repeat_unit === "week"
          ? riText("week(s)")
          : row.repeat_unit === "year"
            ? riText("year(s)")
            : riText("month(s)");
    return `${row.repeat_interval} ${unitLabel}`;
  };

  const getProfileStatusLabel = (status) => {
    const key = (status || "").toLowerCase();
    const label = PROFILE_STATUS_LABELS[key];
    return label ? riText(label) : status || "—";
  };

  if (!canViewPage) {
    return (
      <div className="p-8 text-center text-gray-600">
        {riText("You do not have permission to view recurring invoices.")}
      </div>
    );
  }

  return (
    <div className="bg-[#f6f8fa] min-h-screen w-full max-w-full overflow-x-hidden">
      <div className="w-full max-w-full mx-auto px-6 py-8 min-w-0 overflow-x-hidden">
        <StandardPageHeader
          title={riText("Recurring Invoices")}
          subtitle={riText("Automate billing on a schedule.")}
          actions={
            <>
              <DateRangeComponent
                startDate={dateRangeStart}
                endDate={dateRangeEnd}
                onApply={handleDateRangeApply}
                onClear={handleDateRangeClear}
                placeholder={riText("Filter by start date range")}
              />
              {canAdd && (
                <button
                  className="flex items-center gap-2 px-6 py-3 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[var(--p-blue-dark)] transition-colors shadow-sm"
                  onClick={() => history.push("/create-recurring-invoice")}
                >
                  <Plus size={20} />
                  {riText("New recurring invoice")}
                </button>
              )}
            </>
          }
        />

        <SummaryCards cards={summaryCardsData} columnsCount={4} />

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mt-6 min-w-0 max-w-full">
          <DataTable
            filters={filters}
            headersWithoutCellTooltip={[riText("Amount")]}
            actionColumnHeaderLabel={riText("Actions")}
            colWidths={tableColWidths}
            currentPage={currentPage}
            totalPages={totalPages}
            totalRecords={overallStats.totalProfiles}
            onPageChange={(page) => setCurrentPage(page)}
            recordsPerPage={entriesPerPage}
            onRecordsPerPageChange={(num) => {
              setEntriesPerPage(num);
              setCurrentPage(1);
            }}
            searchValue={searchTerm}
            onSearch={(val) => {
              setSearchTerm(val);
              setCurrentPage(1);
            }}
            searchPlaceholder={riText("Search profiles...")}
            headers={tableHeaders}
            data={profiles}
            loading={loading}
            renderRow={(row) => {
              const cid = row.customer_id;
              const custName =
                cid?.basicInformation?.customerDisplayName ??
                cid?.basicInformation?.companyName ??
                row.customer_name ??
                "—";
              const startStr = row.start_on
                ? format(new Date(row.start_on), "dd MMM yyyy")
                : "—";
              const endStr = row.never_expire
                ? riText("Never")
                : row.ends_on
                  ? format(new Date(row.ends_on), "dd MMM yyyy")
                  : "—";
              const nextStr = row.next_invoice_date
                ? format(new Date(row.next_invoice_date), "dd MMM yyyy")
                : "—";
              const repeatLabel = getRepeatLabel(row);
              return (
                <tr
                  key={row._id}
                  className="border-b border-gray-100 hover:bg-[#eef1f4] transition-colors cursor-pointer"
                  onClick={() =>
                    history.push(`/view-recurring-invoice/${row._id}`)
                  }
                >
                  <td className="py-4 px-4">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        history.push(`/view-recurring-invoice/${row._id}`);
                      }}
                      className="font-semibold text-[var(--p-blue)] hover:underline"
                    >
                      #{row.profile_number}
                    </button>
                  </td>
                  <td className="py-4 px-4 text-sm text-gray-800">
                    {row.profile_name && String(row.profile_name).trim() !== ""
                      ? String(row.profile_name).trim()
                      : "—"}
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-100 rounded-lg">
                        <User size={16} className="text-gray-600" />
                      </div>
                      <span className="font-medium text-gray-900">
                        {custName}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-sm text-gray-800">
                    {repeatLabel}
                  </td>
                  <td className="py-4 px-4 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-gray-400 shrink-0" />
                      <span>
                        {startStr} — {endStr}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-sm text-gray-800">{nextStr}</td>
                  <td className="py-4 px-4 text-sm text-gray-600">
                    {row.salesperson?.name || "—"}
                  </td>
                  <td className="py-4 px-4">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${profileStatusClass(
                        row.profile_status,
                      )}`}
                    >
                      {getProfileStatusLabel(row.profile_status)}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-sm font-medium text-gray-900 whitespace-nowrap">
                    {row.currency ? (
                      <>
                        <span className="text-gray-500 text-xs">
                          {row.currency}
                        </span>{" "}
                        {formatAmount(row.grand_total || 0)}
                      </>
                    ) : (
                      formatAmount(row.grand_total || 0)
                    )}
                  </td>
                  <td
                    className="py-4 px-4 whitespace-nowrap text-sm font-medium"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center space-x-2">
                      {(canViewDetails || canView) && (
                        <button
                          type="button"
                          title={riText("View")}
                          className="text-blue-600 hover:text-blue-900"
                          onClick={() =>
                            history.push(`/view-recurring-invoice/${row._id}`)
                          }
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                      )}
                      {canUpdate && (
                        <button
                          type="button"
                          title={riText("Edit")}
                          className="text-green-600 hover:text-green-900"
                          onClick={() =>
                            history.push(`/update-recurring-invoice/${row._id}`)
                          }
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          title={riText("Delete")}
                          className="text-red-600 hover:text-red-900"
                          onClick={(e) => openDeleteModal(row, e)}
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            }}
          />
        </div>

        {deleteModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-[400px] max-w-[90%]">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                {riText("Delete recurring profile")}
              </h2>
              <p className="text-sm text-gray-600 mb-6">
                {riText(
                  "Are you sure you want to delete recurring profile #{{number}}? Existing customer invoices are not removed. This action cannot be undone.",
                  { number: profileToDelete?.profile_number },
                )}
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    if (deleteLoading) return;
                    setDeleteModalOpen(false);
                    setProfileToDelete(null);
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  {riText("Cancel")}
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteProfile}
                  disabled={deleteLoading}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60"
                >
                  {deleteLoading ? riText("Deleting…") : riText("Delete")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
