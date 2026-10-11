import React, { useState, useEffect, useContext } from "react";
import { useTranslation } from "react-i18next";
import { useHistory, useLocation } from "react-router-dom";
import axios from "axios";
import {
  Plus,
  Eye,
  Edit,
  Trash2,
  Calendar,
  Clock,
  Building,
  FileText,
  CheckCircle,
  Lock,
  FileSpreadsheet as ExcelIcon,
} from "lucide-react";
import * as XLSX from "xlsx";
import { AdminContext } from "@/context/AdminContext";
import { useDailyReportsPermissions } from "@/hooks/useDailyReportsPermissions";
import useSingleBusinessMode from "@/hooks/useSingleBusinessMode";
import { DataTable, SummaryCards, Page } from "@/page-layouts/index";
import { formatDate, formatAmount } from "@/components/formatAmount";
import DateRangePicker from "@/components/common/DateRangePicker";
import { notifySuccess, notifyError } from "@/utils/toast";
import DailyReportsService, {
  resolveDailyReportsScopeFromPath,
  setDailyReportsApiScope,
} from "@/services/dailyReportsService";

import CompletedSvg from "@/assets/img/completed.svg";
import InProgressSvg from "@/assets/img/in-progress.svg";
import PendingApprovalSvg from "@/assets/img/pending-approval.svg";
import SummarySvg from "@/assets/img/summary.svg";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

/** shiftNo is only 1|2 (daily slot). Actual label comes from HR shift master / snapshot (e.g. Afternoon). */
function getShiftDisplayLabel(report, t) {
  const name = report?.shiftSnapshot?.name || report?.shiftId?.name;
  if (name && String(name).trim()) return String(name).trim();
  return t("dailyReports.common.shiftFallback", { number: report.shiftNo });
}

function getStatusLabel(status, t) {
  return t(`dailyReports.status.${status}`, { defaultValue: status });
}

export default function ShiftReportsList({
  selectedBusiness: selectedBusinessFromParent,
  onBusinessChange,
  assignedBusinesses: assignedBusinessesFromParent,
}) {
  const { t } = useTranslation();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const history = useHistory();
  const location = useLocation();
  const { canCreate, canView, canViewOwn, canUpdate, canDelete } = useDailyReportsPermissions();
  const canOpenReport = canView || canViewOwn;
  const { isSingleBusiness } = useSingleBusinessMode();

  // Sync with parent (Dashboard) business when provided; otherwise use local state. "All" = all assigned only.
  const [selectedBusinessFilter, setSelectedBusinessFilter] = useState("All");
  const effectiveBusiness =
    selectedBusinessFromParent !== undefined && selectedBusinessFromParent !== null && selectedBusinessFromParent !== ""
      ? selectedBusinessFromParent
      : selectedBusinessFilter;
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("All");
  const [selectedShiftFilter, setSelectedShiftFilter] = useState("All");
  const [dateRangeStart, setDateRangeStart] = useState("");
  const [dateRangeEnd, setDateRangeEnd] = useState("");
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);

  // Data states
  const [businesses, setBusinesses] = useState([]);
  const [reports, setReports] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [overallStats, setOverallStats] = useState({
    totalReports: 0,
    draftReports: 0,
    submittedReports: 0,
    approvedReports: 0,
  });

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [reportToDelete, setReportToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    setDailyReportsApiScope(resolveDailyReportsScopeFromPath(location.pathname));
  }, [location.pathname]);

  // Use assigned businesses from parent when provided; otherwise fetch from API (assigned only)
  useEffect(() => {
    if (Array.isArray(assignedBusinessesFromParent)) {
      setBusinesses(assignedBusinessesFromParent);
      if (assignedBusinessesFromParent.length === 1) {
        setSelectedBusinessFilter(assignedBusinessesFromParent[0]._id);
      }
      return;
    }
    const adminId = adminInfo?.id || adminInfo?._id;
    if (!adminId) return;
    const headers = {
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo?.token}`,
    };
    const fetchAssigned = async () => {
      try {
        const res = await axios.get(`${Base_URL}/admin/assigned/${adminId}`, { headers });
        const list = res.data?.businesses || [];
        setBusinesses(list);
        if (list.length === 1) setSelectedBusinessFilter(list[0]._id);
      } catch (err) {
        console.error("Failed to fetch assigned businesses:", err);
        setBusinesses([]);
      }
    };
    fetchAssigned();
  }, [adminInfo?.id, adminInfo?._id, assignedBusinessesFromParent?.length]);

  // Fetch reports when filters or effective business change
  useEffect(() => {
    fetchReports();
  }, [
    currentPage,
    entriesPerPage,
    effectiveBusiness,
    selectedStatusFilter,
    selectedShiftFilter,
    dateRangeStart,
    dateRangeEnd,
    searchTerm,
    businesses,
  ]);

  const fetchReports = async () => {
    const assignedIds = (businesses || []).map((b) => b._id).filter(Boolean);
    const isAll = effectiveBusiness === "All" || effectiveBusiness === "" || !effectiveBusiness;
    const hasAccess = isAll ? assignedIds.length > 0 : assignedIds.some((id) => id === effectiveBusiness || id?.toString() === effectiveBusiness);
    if (!hasAccess) {
      setLoading(false);
      setReports([]);
      setTotalPages(1);
      setTotalRecords(0);
      setOverallStats({ totalReports: 0, draftReports: 0, submittedReports: 0, approvedReports: 0 });
      return;
    }
    setLoading(true);
    try {
      const params = {
        page: currentPage,
        limit: entriesPerPage,
        ...(selectedStatusFilter !== "All" && { status: selectedStatusFilter }),
        ...(selectedShiftFilter !== "All" && { shiftNo: selectedShiftFilter }),
        ...(dateRangeStart && { startDate: dateRangeStart }),
        ...(dateRangeEnd && { endDate: dateRangeEnd }),
        ...(searchTerm && { search: searchTerm }),
      };
      if (isAll) {
        params.businessIds = assignedIds.join(",");
      } else {
        params.business = effectiveBusiness;
      }

      const response = await DailyReportsService.getAllShiftReports(params);

      if (response?.success) {
        setReports(response.data || []);
        setTotalPages(response.pagination?.totalPages || 1);
        setTotalRecords(response.pagination?.total || 0);

        // Calculate stats
        const allReports = response.data || [];
        setOverallStats({
          totalReports: response.pagination?.total || allReports.length,
          draftReports: allReports.filter(r => r.status === "DRAFT").length,
          submittedReports: allReports.filter(r => r.status === "SUBMITTED").length,
          approvedReports: allReports.filter(r => r.status === "APPROVED" || r.status === "LOCKED").length,
        });
      }
    } catch (error) {
      console.error("Error fetching reports:", error);
      notifyError(t("dailyReports.messages.error.loadReports"));
    } finally {
      setLoading(false);
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

  const clearAllFilters = () => {
    setSelectedBusinessFilter("All");
    onBusinessChange?.("");
    setSelectedStatusFilter("All");
    setSelectedShiftFilter("All");
    setDateRangeStart("");
    setDateRangeEnd("");
    setSearchTerm("");
    setCurrentPage(1);
  };

  const handleDelete = async () => {
    if (!reportToDelete) return;

    setDeleteLoading(true);
    try {
      const response = await DailyReportsService.deleteShiftReport(reportToDelete._id);
      if (response?.success) {
        notifySuccess(t("dailyReports.messages.success.reportDeleted"));
        fetchReports();
      } else {
        notifyError(response?.message || t("dailyReports.messages.error.deleteReport"));
      }
    } catch (error) {
      console.error("Error deleting report:", error);
      notifyError(t("dailyReports.messages.error.deleteReport"));
    } finally {
      setDeleteLoading(false);
      setShowDeleteModal(false);
      setReportToDelete(null);
    }
  };

  const handleExportExcel = async () => {
    try {
      setLoading(true);
      const assignedIds = (businesses || []).map((b) => b._id).filter(Boolean);
      const isAll = effectiveBusiness === "All" || effectiveBusiness === "" || !effectiveBusiness;
      const params = {
        page: 1,
        limit: 999999,
        ...(selectedStatusFilter !== "All" && { status: selectedStatusFilter }),
        ...(selectedShiftFilter !== "All" && { shiftNo: selectedShiftFilter }),
        ...(dateRangeStart && { startDate: dateRangeStart }),
        ...(dateRangeEnd && { endDate: dateRangeEnd }),
        ...(searchTerm && { search: searchTerm }),
      };
      if (isAll && assignedIds.length > 0) {
        params.businessIds = assignedIds.join(",");
      } else if (!isAll) {
        params.business = effectiveBusiness;
      }

      const response = await DailyReportsService.getAllShiftReports(params);
      const allReports = response?.data || [];

      if (allReports.length === 0) {
        notifyError(t("dailyReports.messages.error.noReportsToExport"));
        return;
      }

      const exportData = allReports.map((report) => ({
        [t("dailyReports.export.columns.businessDate")]: formatDate(report.businessDate),
        [t("dailyReports.export.columns.business")]: report.business?.name || "",
        [t("dailyReports.export.columns.shift")]: getShiftDisplayLabel(report, t),
        [t("dailyReports.export.columns.status")]: getStatusLabel(report.status, t),
        [t("dailyReports.export.columns.openingCash")]: report.cashSummary?.openingCash || 0,
        [t("dailyReports.export.columns.totalCollected")]: report.cashSummary?.totalCollected || 0,
        [t("dailyReports.export.columns.totalPaidOut")]: report.cashSummary?.totalPaidOut || 0,
        [t("dailyReports.export.columns.declaredCash")]: report.cashSummary?.declaredCashOnHand || 0,
        [t("dailyReports.export.columns.openedBy")]: report.openedBy?.fullName || report.openedBy?.displayName || "",
        [t("dailyReports.export.columns.closedBy")]: report.closedBy?.fullName || report.closedBy?.displayName || "",
        [t("dailyReports.export.columns.createdAt")]: formatDate(report.createdAt),
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, t("dailyReports.export.sheetName"));

      const filename = `Daily_Reports_${new Date().toISOString().split("T")[0]}.xlsx`;
      XLSX.writeFile(workbook, filename);

      notifySuccess(t("dailyReports.messages.success.reportsExported"));
    } catch (error) {
      console.error("Error exporting:", error);
      notifyError(t("dailyReports.messages.error.exportReports"));
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      DRAFT: "bg-gray-100 text-gray-800",
      SUBMITTED: "bg-blue-100 text-blue-800",
      APPROVED: "bg-green-100 text-green-800",
      LOCKED: "bg-purple-100 text-purple-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  // Filter configuration
  const filters = [
    {
      isClearButton: true,
      buttonProps: {
        onClick: clearAllFilters,
      },
    },
    {
      label: t("dailyReports.list.filters.status"),
      value: selectedStatusFilter,
      onChange: (val) => {
        setSelectedStatusFilter(val);
        setCurrentPage(1);
      },
      options: [
        { value: "All", label: t("dailyReports.placeholders.allStatuses") },
        { value: "DRAFT", label: t("dailyReports.status.DRAFT") },
        { value: "SUBMITTED", label: t("dailyReports.status.SUBMITTED") },
        { value: "APPROVED", label: t("dailyReports.status.APPROVED") },
        { value: "LOCKED", label: t("dailyReports.status.LOCKED") },
      ],
      placeholder: t("dailyReports.placeholders.allStatuses"),
      icon: FileText,
    },
    {
      label: t("dailyReports.list.filters.shift"),
      value: selectedShiftFilter,
      onChange: (val) => {
        setSelectedShiftFilter(val);
        setCurrentPage(1);
      },
      options: [
        { value: "All", label: t("dailyReports.placeholders.allShifts") },
        ...Array.from({ length: 20 }, (_, i) => ({
          value: String(i + 1),
          label: t("dailyReports.list.filters.shiftOption", { number: i + 1 }),
        })),
      ],
      placeholder: t("dailyReports.fields.shift"),
      icon: Clock,
    },
  ];

  // Summary cards data
  const summaryCardsData = [
    {
      title: t("dailyReports.list.summaryCards.totalReports"),
      value: overallStats.totalReports,
      backgroundColor: "summary-light",
      iconColor: "summary-dark",
      Icon: SummarySvg,
    },
    {
      title: t("dailyReports.list.summaryCards.draft"),
      value: overallStats.draftReports,
      backgroundColor: "pending-light",
      iconColor: "pending-dark",
      Icon: PendingApprovalSvg,
    },
    {
      title: t("dailyReports.list.summaryCards.submitted"),
      value: overallStats.submittedReports,
      backgroundColor: "processing-light",
      iconColor: "processing-dark",
      Icon: InProgressSvg,
    },
    {
      title: t("dailyReports.list.summaryCards.approvedLocked"),
      value: overallStats.approvedReports,
      backgroundColor: "completed-light",
      iconColor: "completed-dark",
      Icon: CompletedSvg,
    },
  ];

  return (
    <Page
      header={{
        title: t("dailyReports.list.title"),
        filters: adminInfo?.id || adminInfo?._id ? [
          {
            name: "business",
            type: "select",
            isBusinessDropdown: true,
            businessDropdownProps: {
              adminId: adminInfo?.id || adminInfo?._id,
              selectedBusiness: effectiveBusiness === "All" ? "" : effectiveBusiness || "",
              onChange: (value) => {
                const newVal = value ? value : "All";
                setSelectedBusinessFilter(newVal);
                onBusinessChange?.(value || "");
                setCurrentPage(1);
              },
              placeholder: t("dailyReports.placeholders.allBusinesses"),
              style: {
                width: "270px",
              },
            },
          },
        ] : [],
        showAddButton: canCreate,
        addButtonText: t("dailyReports.buttons.createReport"),
        onAddNew: () =>
          history.push("/daily-reports/create", {
            returnTo: "/daily-reports-collection",
          }),
        renderActions: [
          <DateRangePicker
            key="date-range"
            startDate={dateRangeStart}
            endDate={dateRangeEnd}
            onApply={handleDateRangeApply}
            onClear={handleDateRangeClear}
            placeholder={t("dailyReports.placeholders.selectDateRange")}
          />,
          <button
            key="export"
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2 text-white text-sm rounded-xl shadow-sm bg-green-600 hover:bg-green-700"
          >
            <ExcelIcon className="w-4 h-4" />
            {t("dailyReports.buttons.export")}
          </button>,
        ],
      }}
    >
      <div className="space-y-6">
        {/* Stats Cards */}
        <SummaryCards cards={summaryCardsData} columnsCount={4} />

        {/* Main Table */}
        <div className="bg-white rounded-lg border shadow-sm">
          <DataTable
            filters={filters}
            currentPage={currentPage}
            totalPages={totalPages}
            totalRecords={totalRecords}
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
            searchPlaceholder={t("dailyReports.placeholders.searchReports")}
            headers={[
              isSingleBusiness
                ? t("dailyReports.fields.date")
                : t("dailyReports.tables.dateAndBusiness"),
              t("dailyReports.fields.shift"),
              t("dailyReports.fields.status"),
              t("dailyReports.fields.collections"),
              t("dailyReports.fields.payouts"),
              t("dailyReports.fields.openedBy"),
              t("dailyReports.fields.actions"),
            ]}
            data={reports}
            loading={loading}
            renderRow={(report) => {
              return (
                <tr
                  key={report._id}
                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  {/* Date & Business */}
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-50 rounded-lg">
                        <Calendar size={16} className="text-[var(--p-blue)]" />
                      </div>
                      <div>
                        <p className="font-medium text-sm text-gray-800">
                          {formatDate(report.businessDate)}
                        </p>
                        {!isSingleBusiness && (
                        <p className="text-xs text-gray-500">
                          {report.business?.name || t("dailyReports.common.na")}
                        </p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Shift */}
                  <td className="py-4 px-4">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                      report.shiftNo === 1
                        ? "bg-amber-100 text-amber-700"
                        : "bg-indigo-100 text-indigo-700"
                    }`}>
                      <Clock size={12} />
                      {getShiftDisplayLabel(report, t)}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="py-4 px-4">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(report.status)}`}>
                      {report.status === "APPROVED" || report.status === "LOCKED" ? (
                        report.status === "LOCKED" ? <Lock size={12} /> : <CheckCircle size={12} />
                      ) : null}
                      {getStatusLabel(report.status, t)}
                    </span>
                  </td>

                  {/* Collections */}
                  <td className="py-4 px-4 text-right">
                    <p className="font-medium text-sm text-green-600">
                      {formatAmount(report.cashSummary?.totalCollected || 0)}
                    </p>
                  </td>

                  {/* Payouts */}
                  <td className="py-4 px-4 text-right">
                    <p className="font-medium text-sm text-red-600">
                      {formatAmount(report.cashSummary?.totalPaidOut || 0)}
                    </p>
                  </td>

                  {/* Opened By */}
                  <td className="py-4 px-4">
                    <p className="text-sm text-gray-700">
                      {report.openedBy?.fullName || report.openedBy?.displayName || t("dailyReports.common.na")}
                    </p>
                  </td>

                  {/* Actions */}
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      {canOpenReport && (
                        <button
                          onClick={() =>
                            history.push(`/daily-reports/view/${report._id}`, {
                              returnTo: "/daily-reports-collection",
                            })
                          }
                          className="text-blue-600 hover:text-blue-800 p-1.5 hover:bg-blue-50 rounded transition-colors"
                          title={t("dailyReports.buttons.view")}
                        >
                          <Eye size={16} />
                        </button>
                      )}
                      {canUpdate && (report.status === "DRAFT" || report.status === "SUBMITTED") && (
                        <button
                          onClick={() =>
                            history.push(`/daily-reports/edit/${report._id}`, {
                              returnTo: "/daily-reports-collection",
                            })
                          }
                          className="text-green-600 hover:text-green-800 p-1.5 hover:bg-green-50 rounded transition-colors"
                          title={t("dailyReports.buttons.edit")}
                        >
                          <Edit size={16} />
                        </button>
                      )}
                      {canDelete && report.status === "DRAFT" && (
                        <button
                          onClick={() => {
                            setReportToDelete(report);
                            setShowDeleteModal(true);
                          }}
                          className="text-red-600 hover:text-red-800 p-1.5 hover:bg-red-50 rounded transition-colors"
                          title={t("dailyReports.buttons.delete")}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            }}
          />
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl">
              <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-base font-semibold text-gray-800 text-center mb-2">
                {t("dailyReports.list.deleteModal.title")}
              </h3>
              <p className="text-sm text-gray-500 text-center mb-6">
                {t("dailyReports.list.deleteModal.message", {
                  date: reportToDelete?.businessDate ? formatDate(reportToDelete.businessDate) : "",
                })}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setReportToDelete(null);
                  }}
                  className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  {t("dailyReports.buttons.cancel")}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteLoading}
                  className="flex-1 px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium disabled:opacity-50"
                >
                  {deleteLoading ? t("dailyReports.buttons.deleting") : t("dailyReports.buttons.delete")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Page>
  );
}
