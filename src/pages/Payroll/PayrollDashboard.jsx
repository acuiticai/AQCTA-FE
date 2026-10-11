import React, { useState, useEffect, useContext, useRef, useMemo } from "react";
import { useHistory, useLocation } from "react-router-dom";
import {
  FileSpreadsheet as ExcelIcon,
  Eye,
  Trash2,
  Calculator,
  Download,
  Mail,
  FileText,
  Printer,
  BarChart3,
} from "lucide-react";
import { IoClose } from "react-icons/io5";
import axios from "axios";
import { AdminContext } from "@/context/AdminContext";
import { Page, SummaryCards } from "@/page-layouts/index";
import { formatAmount } from "@/components/formatAmount";
import { notifyError, notifySuccess } from "@/utils/toast";
import * as XLSX from "xlsx";
import CompletedSvg from "@/assets/img/completed.svg";
import InProgressSvg from "@/assets/img/in-progress.svg";
import PendingApprovalSvg from "@/assets/img/pending-approval.svg";
import ConfirmationModal from "@/pages/Customer/reusablecomponents/ConfirmationModal ";
import DropdownBasic from "@/page-layouts/components/DropdownBasic";
import YearPicker from "./components/YearPicker";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
const PAYROLL_SELECTED_BUSINESS_KEY = "payroll.selectedBusiness";

const MONTH_NAMES = [
  "",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const STATUS_STYLES = {
  draft:
    "bg-gradient-to-r from-gray-50 to-gray-100 text-gray-600 ring-1 ring-gray-200",
  calculated:
    "bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 ring-1 ring-blue-200",
  reviewed:
    "bg-gradient-to-r from-amber-50 to-yellow-100 text-amber-700 ring-1 ring-amber-200",
  approved:
    "bg-gradient-to-r from-emerald-50 to-green-100 text-emerald-700 ring-1 ring-emerald-200",
  posted:
    "bg-gradient-to-r from-violet-50 to-purple-100 text-violet-700 ring-1 ring-violet-200",
  paid: "bg-gradient-to-r from-teal-50 to-emerald-100 text-teal-700 ring-1 ring-teal-200",
};
const STATUS_DOT = {
  draft: "bg-gray-400",
  calculated: "bg-blue-500",
  reviewed: "bg-amber-500",
  approved: "bg-emerald-500",
  posted: "bg-violet-500",
  paid: "bg-teal-500",
};

const PayrollDashboard = () => {
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const history = useHistory();
  const location = useLocation();
  const [runs, setRuns] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [year, setYear] = useState(() => {
    const now = new Date();
    return now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  });
  const [month, setMonth] = useState(() => {
    const now = new Date();
    const dMonth = now.getMonth();
    return String(dMonth === 0 ? 12 : dMonth);
  });
  const [showNewRunModal, setShowNewRunModal] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState(() => {
    try {
      return localStorage.getItem(PAYROLL_SELECTED_BUSINESS_KEY) || "";
    } catch {
      return "";
    }
  });
  const [statementRunId, setStatementRunId] = useState("");

  const [selectedRuns, setSelectedRuns] = useState(new Set());

  const toggleSelectAll = () => {
    if (selectedRuns.size === filteredRuns.length && filteredRuns.length > 0) {
      setSelectedRuns(new Set());
    } else {
      setSelectedRuns(new Set(filteredRuns.map((r) => r._id)));
    }
  };

  const toggleSelectRun = (id) => {
    const next = new Set(selectedRuns);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedRuns(next);
  };

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("Confirm");
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmText, setConfirmText] = useState("Confirm");
  const confirmActionRef = useRef(null);

  const openConfirmModal = ({
    title,
    message,
    confirmText = "Confirm",
    onConfirm,
  }) => {
    confirmActionRef.current = onConfirm;
    setConfirmTitle(title || "Confirm");
    setConfirmMessage(message || "");
    setConfirmText(confirmText);
    setConfirmOpen(true);
  };

  const handleConfirmModal = async () => {
    const fn = confirmActionRef.current;
    confirmActionRef.current = null;
    setConfirmOpen(false);
    if (typeof fn === "function") await fn();
  };

  useEffect(() => {
    const adminId = adminInfo?.id || adminInfo?._id;
    if (!adminId) return;

    const headers = {
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo?.token}`,
    };

    const fetchAssigned = async () => {
      try {
        await axios.get(`${Base_URL}/admin/assigned/${adminId}`, {
          headers,
        });
      } catch {
        // ignore
      }
    };

    fetchAssigned();
  }, [adminInfo?.id, adminInfo?._id, adminInfo?.token]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const incomingBusiness =
      params.get("selectedOrg") ||
      location.state?.selectedBusiness ||
      location.state?.selectedOrg ||
      location.state?.businessId ||
      "";

    if (incomingBusiness && incomingBusiness !== selectedBusiness) {
      setSelectedBusiness(String(incomingBusiness));
    }
  }, [location.search, location.state, selectedBusiness]);

  useEffect(() => {
    try {
      if (selectedBusiness) {
        localStorage.setItem(PAYROLL_SELECTED_BUSINESS_KEY, selectedBusiness);
      } else {
        localStorage.removeItem(PAYROLL_SELECTED_BUSINESS_KEY);
      }
    } catch {
      // ignore localStorage issues
    }

    if (selectedBusiness) fetchRuns();
    else {
      setRuns([]);
      setIsLoading(false);
    }
  }, [selectedBusiness, year, month]);

  useEffect(() => {
    if (runs.length && !statementRunId) setStatementRunId(runs[0]._id);
  }, [runs, statementRunId]);

  const fetchRuns = async () => {
    setIsLoading(true);
    try {
      const { data } = await axios.get(`${Base_URL}/payroll/runs`, {
        params: {
          business: selectedBusiness,
          ...(year ? { year } : {}),
          ...(month ? { month } : {}),
        },
      });
      setRuns(data);
    } catch (err) {
      console.error(err);
      setRuns([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredRuns = runs;

  const handleDelete = async (id) => {
    openConfirmModal({
      title: "Delete Payroll Run",
      message:
        "Delete this payroll run? This will remove all associated payroll lines.",
      confirmText: "Delete",
      onConfirm: async () => {
        try {
          await axios.delete(`${Base_URL}/payroll/runs/${id}`, {
            params: {
              business: selectedBusiness,
              allowLockedDelete: true,
            },
          });
          fetchRuns();
        } catch (err) {
          notifyError(err.response?.data?.message || "Failed to delete");
        }
      },
    });
  };

  const handleCalculate = async (id) => {
    openConfirmModal({
      title: "Calculate Payroll",
      message:
        "Calculate payroll for this run? This will compute salaries for all employees.",
      confirmText: "Calculate",
      onConfirm: async () => {
        try {
          await axios.post(`${Base_URL}/payroll/runs/${id}/calculate`, null, {
            params: { business: selectedBusiness },
          });
          fetchRuns();
        } catch (err) {
          notifyError(err.response?.data?.message || "Calculation failed");
        }
      },
    });
  };

  const handleBulkDelete = () => {
    if (!selectedRuns.size) return;
    openConfirmModal({
      title: "Bulk Delete Payroll Runs",
      message: `Are you sure you want to delete ${selectedRuns.size} payroll runs? This action cannot be undone.`,
      confirmText: "Delete All",
      onConfirm: async () => {
        let success = 0;
        let failed = 0;
        for (const runId of selectedRuns) {
          try {
            await axios.delete(`${Base_URL}/payroll/runs/${runId}`, {
              params: { business: selectedBusiness, allowLockedDelete: true },
            });
            success++;
          } catch {
            failed++;
          }
        }
        notifySuccess(`Successfully deleted ${success} runs.`);
        if (failed > 0) notifyError(`Failed to delete ${failed} runs.`);
        setSelectedRuns(new Set());
        fetchRuns();
      },
    });
  };

  const handleBulkRecalculate = () => {
    if (!selectedRuns.size) return;
    openConfirmModal({
      title: "Bulk Recalculate Payroll",
      message: `Recalculate payroll for ${selectedRuns.size} selected runs?`,
      confirmText: "Recalculate All",
      onConfirm: async () => {
        let success = 0;
        let failed = 0;
        for (const runId of selectedRuns) {
          try {
            await axios.post(
              `${Base_URL}/payroll/runs/${runId}/calculate`,
              null,
              {
                params: { business: selectedBusiness },
              },
            );
            success++;
          } catch {
            failed++;
          }
        }
        notifySuccess(`Successfully recalculated ${success} runs.`);
        if (failed > 0) notifyError(`Failed to recalculate ${failed} runs.`);
        setSelectedRuns(new Set());
        fetchRuns();
      },
    });
  };

  // Summary stats
  const totalEmployees = filteredRuns.reduce(
    (s, r) => s + (r.totalEmployees || 0),
    0,
  );
  const totalGross = filteredRuns.reduce(
    (s, r) => s + (r.totalGrossPay || 0),
    0,
  );
  const totalNet = filteredRuns.reduce((s, r) => s + (r.totalNetPay || 0), 0);
  const totalEmployerCost = filteredRuns.reduce(
    (s, r) => s + (r.totalEmployerCost || 0),
    0,
  );
  const paidStatuses = ["paid", "finalized"];
  const paidRuns = filteredRuns.filter((r) => paidStatuses.includes(r.status));
  const pendingRuns = filteredRuns.filter(
    (r) => !paidStatuses.includes(r.status),
  );
  const totalPaidRM = paidRuns.reduce((s, r) => s + (r.totalNetPay || 0), 0);
  const totalPendingRM = pendingRuns.reduce(
    (s, r) => s + (r.totalNetPay || 0),
    0,
  );
  const paidMonths = [...new Set(paidRuns.map((r) => `${r.year}-${r.month}`))]
    .length;
  const pendingMonths = [
    ...new Set(pendingRuns.map((r) => `${r.year}-${r.month}`)),
  ].length;
  const formatCurrency = (amt) => `RM ${formatAmount(amt || 0)}`;

  const handleExportExcel = () => {
    if (!selectedBusiness) {
      notifyError("Please select a business first.");
      return;
    }

    if (!filteredRuns.length) {
      notifyError("No payroll runs found for the current filters.");
      return;
    }

    try {
      const exportData = filteredRuns.map((r) => ({
        Month: `${MONTH_NAMES[r.month]} ${r.year}`,
        PeriodStart: r.periodStart
          ? new Date(r.periodStart).toISOString().split("T")[0]
          : "",
        PeriodEnd: r.periodEnd
          ? new Date(r.periodEnd).toISOString().split("T")[0]
          : "",
        Employees: r.totalEmployees || 0,
        "Gross Pay": r.totalGrossPay || 0,
        "Net Pay": r.totalNetPay || 0,
        "Employer Cost": r.totalEmployerCost || 0,
        Status: r.status || "",
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Payroll Runs");
      XLSX.writeFile(
        wb,
        `Payroll_Runs_${year || "all-years"}_${new Date().toISOString().split("T")[0]}.xlsx`,
      );
      notifySuccess("Excel exported successfully");
    } catch {
      notifyError("Failed to export Excel");
    }
  };

  const summaryCardsData = [
    {
      title: "Total Paid",
      value: formatCurrency(totalPaidRM),
      backgroundColor: "completed-light",
      iconColor: "completed-dark",
      Icon: CompletedSvg,
    },
    {
      title: "Total Pending",
      value: formatCurrency(totalPendingRM),
      backgroundColor: "pending-light",
      iconColor: "pending-dark",
      Icon: PendingApprovalSvg,
    },
    {
      title: "Paid Months",
      value: paidMonths,
      backgroundColor: "completed-light",
      iconColor: "completed-dark",
      Icon: CompletedSvg,
    },
    {
      title: "Pending Months",
      value: pendingMonths,
      backgroundColor: "processing-light",
      iconColor: "processing-dark",
      Icon: InProgressSvg,
    },
  ];

  const secondaryCardsData = [
    {
      title: "Total Gross Pay",
      value: formatCurrency(totalGross),
      backgroundColor: "processing-light",
      iconColor: "processing-dark",
      Icon: InProgressSvg,
    },
    {
      title: "Total Net Pay",
      value: formatCurrency(totalNet),
      backgroundColor: "completed-light",
      iconColor: "completed-dark",
      Icon: CompletedSvg,
    },
    {
      title: "Employer Cost",
      value: formatCurrency(totalEmployerCost),
      backgroundColor: "pending-light",
      iconColor: "pending-dark",
      Icon: PendingApprovalSvg,
    },
    {
      title: "Total Employees",
      value: totalEmployees,
      backgroundColor: "completed-light",
      iconColor: "completed-dark",
      Icon: CompletedSvg,
    },
  ];

  const selectedStatementRun =
    filteredRuns.find((r) => r._id === statementRunId) ||
    filteredRuns[0] ||
    null;

  const yearlyTotals = filteredRuns.reduce(
    (acc, r) => {
      const t = r.totals || {};
      acc.epfEmployee += t.epfEmployee || 0;
      acc.epfEmployer += t.epfEmployer || 0;
      acc.socsoEmployee += t.socsoEmployee || 0;
      acc.socsoEmployer += t.socsoEmployer || 0;
      acc.eisEmployee += t.eisEmployee || 0;
      acc.eisEmployer += t.eisEmployer || 0;
      acc.pcb += t.pcb || 0;
      acc.hrdf += t.hrdf || 0;
      acc.totalDeductions += t.totalDeductions || 0;
      return acc;
    },
    {
      epfEmployee: 0,
      epfEmployer: 0,
      socsoEmployee: 0,
      socsoEmployer: 0,
      eisEmployee: 0,
      eisEmployer: 0,
      pcb: 0,
      hrdf: 0,
      totalDeductions: 0,
    },
  );
  const hasActiveFilters = year || month;

  return (
    <Page
      header={{
        title: "Payroll",
        filters:
          adminInfo?.id || adminInfo?._id
            ? [
                {
                  name: "business",
                  type: "select",
                  isBusinessDropdown: true,
                  businessDropdownProps: {
                    adminId: adminInfo?.id || adminInfo?._id,
                    selectedBusiness: selectedBusiness || "",
                    onChange: (value) => setSelectedBusiness(value || ""),
                    placeholder: "All Businesses",
                    style: { width: "220px" },
                  },
                },
              ]
            : [],
        showAddButton: !!selectedBusiness,
        addButtonText: "New Payroll Run",
        addNewButtonClassName: "!h-[40px] !px-3 whitespace-nowrap",
        onAddNew: () => setShowNewRunModal(true),
        renderActions: [
          <div
            key="year"
            className="!p-0 !bg-transparent !shadow-none !rounded-none"
          >
            <YearPicker
              value={year}
              onChange={(yr) => setYear(yr ? Number(yr) : "")}
              placeholder="All Years"
            />
          </div>,
          <div key="month" className="w-[145px] max-w-full flex-shrink-0">
            <DropdownBasic
              value={month}
              onChange={(value) => setMonth(value)}
              options={[
                { value: "1", label: "January" },
                { value: "2", label: "February" },
                { value: "3", label: "March" },
                { value: "4", label: "April" },
                { value: "5", label: "May" },
                { value: "6", label: "June" },
                { value: "7", label: "July" },
                { value: "8", label: "August" },
                { value: "9", label: "September" },
                { value: "10", label: "October" },
                { value: "11", label: "November" },
                { value: "12", label: "December" },
              ]}
              placeholder="All Months"
              width="145px"
              isClearable={true}
              appearance="filterPill"
              sortOptions={false}
            />
          </div>,
          hasActiveFilters ? (
            <div
              key="clear"
              className="!p-0 !bg-transparent !shadow-none !rounded-none"
            >
              <IoClose
                onClick={() => {
                  setYear("");
                  setMonth("");
                }}
                title="Clear Filters"
                className="w-5 h-5 cursor-pointer bg-transparent rounded-full p-[2px] text-red-500 border border-red-500 font-bold hover:bg-red-500 hover:border-none hover:text-white"
              />
            </div>
          ) : null,
          <button
            key="analytics"
            onClick={() => history.push("/payroll/analytics")}
            className="!h-[40px] !px-3 flex items-center gap-2 text-white text-sm rounded-xl shadow-sm"
            style={{ backgroundColor: "var(--p-blue)" }}
          >
            <BarChart3 className="w-4 h-4" />
            Analytics
          </button>,
          <button
            key="reports"
            onClick={() => history.push("/payroll/reports")}
            className="!h-[40px] !px-3 flex items-center gap-2 text-white text-sm rounded-xl shadow-sm"
            style={{ backgroundColor: "#008080" }}
          >
            <FileText className="w-4 h-4" />
            Reports
          </button>,
          <button
            key="export"
            onClick={handleExportExcel}
            className="!h-[40px] !px-3 flex items-center gap-2 text-white text-sm rounded-xl shadow-sm bg-green-600 hover:bg-green-700 disabled:opacity-50"
            disabled={!filteredRuns.length}
          >
            <ExcelIcon className="w-4 h-4" />
            Export
          </button>,
        ],
      }}
    >
      <div className="mt-8">
        <SummaryCards cards={summaryCardsData} columnsCount={4} />
        <SummaryCards cards={secondaryCardsData} columnsCount={4} />

        <div className="rounded-xl border border-gray-200/80 shadow-md font-sans text-[#303030] font-normal mb-6 bg-white overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-white to-gray-50/80 flex justify-between items-center gap-3">
            <h2 className="text-sm font-semibold text-gray-800 tracking-tight">
              Payroll Runs — {month ? [
                "", "January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"
              ][month] + " " : ""}{year || "All Years"}
            </h2>
            <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
              {filteredRuns.length} runs
            </span>
          </div>

          {/* Bulk Action Bar - Matching PayrollRunDetail design */}
          {selectedRuns.size > 0 && (
            <div className="flex items-center gap-3 px-6 py-3 bg-blue-50 border-b border-blue-100 animate-in fade-in duration-300">
              <span className="text-sm font-medium text-blue-700">
                {selectedRuns.size} selected
              </span>
              <button
                onClick={handleBulkRecalculate}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-sm active:scale-95"
              >
                <Calculator className="w-3.5 h-3.5" />
                Recalculate Selected
              </button>
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-500 hover:bg-red-600 text-white transition-colors shadow-sm active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Selected
              </button>
              <button
                onClick={() => setSelectedRuns(new Set())}
                className="text-sm text-gray-500 hover:text-gray-700 underline ml-auto font-medium"
              >
                Clear selection
              </button>
            </div>
          )}

          {isLoading ? (
            <div className="p-8 text-center text-gray-500">
              Loading payroll runs...
            </div>
          ) : !selectedBusiness ? (
            <div className="p-8 text-center">
              <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 inline-block">
                Please select a business to view payroll runs.
              </p>
            </div>
          ) : filteredRuns.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500 mb-4">
                No payroll runs found{year ? ` for ${year}` : ""}.
              </p>
              {!!selectedBusiness && (
                <button
                  onClick={() => setShowNewRunModal(true)}
                  className="text-[var(--p-blue)] hover:underline font-medium"
                >
                  Create your first payroll run
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-gray-50 to-slate-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3.5 text-left">
                      <div className="flex items-center h-5">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-gray-300 text-[var(--p-blue)] focus:ring-[var(--p-blue)] transition-colors duration-200 cursor-pointer"
                          checked={
                            filteredRuns.length > 0 &&
                            selectedRuns.size === filteredRuns.length
                          }
                          ref={(input) => {
                            if (input) {
                              input.indeterminate =
                                selectedRuns.size > 0 &&
                                selectedRuns.size < filteredRuns.length;
                            }
                          }}
                          onChange={toggleSelectAll}
                        />
                      </div>
                    </th>
                    {[
                      "Month",
                      "Period",
                      "Employees",
                      "Gross Pay",
                      "Net Pay",
                      "Employer Cost",
                      "Status",
                      "Actions",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRuns.map((run) => (
                    <tr
                      key={run._id}
                      className={`hover:bg-blue-50/40 cursor-pointer transition-colors duration-150 ${
                        selectedRuns.has(run._id) ? "bg-blue-50/60" : ""
                      }`}
                      onClick={() => history.push(`/payroll/run/${run._id}`)}
                    >
                      <td
                        className="px-6 py-4 whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center h-5">
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded border-gray-300 text-[var(--p-blue)] focus:ring-[var(--p-blue)] transition-colors duration-200 cursor-pointer"
                            checked={selectedRuns.has(run._id)}
                            onChange={() => toggleSelectRun(run._id)}
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        <div>
                          {MONTH_NAMES[run.month]} {run.year}
                        </div>
                        {run.payGroup && (
                          <div className="text-xs text-gray-400">
                            {run.payGroup?.name || ""}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(run.periodStart).toLocaleDateString()} -{" "}
                        {new Date(run.periodEnd).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {run.totalEmployees}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {formatCurrency(run.totalGrossPay)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-700">
                        {formatCurrency(run.totalNetPay)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatCurrency(run.totalEmployerCost)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[run.status] || "bg-gray-100 text-gray-700"}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[run.status] || "bg-gray-400"}`}
                          />
                          {run.status}
                        </span>
                      </td>
                      <td
                        className="px-6 py-4 whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              history.push(`/payroll/run/${run._id}`)
                            }
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {["draft", "calculated"].includes(run.status) && (
                            <button
                              onClick={() => handleCalculate(run._id)}
                              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                              title={
                                run.status === "calculated"
                                  ? "Recalculate"
                                  : "Calculate"
                              }
                            >
                              <Calculator className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(run._id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Monthly + Yearly Statements */}
        {!isLoading && filteredRuns.length > 0 && (
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-6 rounded-xl border border-gray-200/80 shadow-md font-sans text-[#303030] font-normal bg-white relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-cyan-400" />
              <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 tracking-tight">
                    Monthly Statement
                  </h3>
                  {selectedStatementRun && (
                    <p className="text-sm text-gray-500">
                      {MONTH_NAMES[selectedStatementRun.month]}{" "}
                      {selectedStatementRun.year}
                    </p>
                  )}
                </div>
                <select
                  value={statementRunId}
                  onChange={(e) => setStatementRunId(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-xl text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all"
                >
                  {filteredRuns.map((r) => (
                    <option key={r._id} value={r._id}>
                      {MONTH_NAMES[r.month]} ({r.status})
                    </option>
                  ))}
                </select>
              </div>

              {selectedStatementRun && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      {
                        label: "Employees",
                        value: selectedStatementRun.totalEmployees || 0,
                      },
                      {
                        label: "Gross Pay",
                        value: formatCurrency(
                          selectedStatementRun.totalGrossPay,
                        ),
                      },
                      {
                        label: "Net Pay",
                        value: formatCurrency(selectedStatementRun.totalNetPay),
                      },
                      {
                        label: "Employer Cost",
                        value: formatCurrency(
                          selectedStatementRun.totalEmployerCost,
                        ),
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl p-3.5 border border-gray-100/80 hover:shadow-sm transition-shadow"
                      >
                        <p className="text-xs text-gray-400 mb-1 font-medium uppercase tracking-wide">
                          {item.label}
                        </p>
                        <p className="text-sm font-bold text-gray-800">
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-gray-100 pt-4">
                    <h4 className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wider">
                      Statutory Totals
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      {[
                        [
                          "EPF (EE)",
                          selectedStatementRun.totals?.epfEmployee || 0,
                        ],
                        [
                          "EPF (ER)",
                          selectedStatementRun.totals?.epfEmployer || 0,
                        ],
                        [
                          "SOCSO (EE)",
                          selectedStatementRun.totals?.socsoEmployee || 0,
                        ],
                        [
                          "SOCSO (ER)",
                          selectedStatementRun.totals?.socsoEmployer || 0,
                        ],
                        [
                          "EIS (EE)",
                          selectedStatementRun.totals?.eisEmployee || 0,
                        ],
                        [
                          "EIS (ER)",
                          selectedStatementRun.totals?.eisEmployer || 0,
                        ],
                        ["PCB (Tax)", selectedStatementRun.totals?.pcb || 0],
                        ["HRDF", selectedStatementRun.totals?.hrdf || 0],
                      ].map(([label, value]) => (
                        <div
                          key={label}
                          className="flex justify-between items-center"
                        >
                          <span className="text-gray-600">{label}</span>
                          <span className="font-semibold text-gray-800">
                            {formatCurrency(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex justify-between items-center">
                      <span className="text-gray-600">Total Deductions</span>
                      <span className="font-semibold text-gray-800">
                        {formatCurrency(
                          selectedStatementRun.totals?.totalDeductions || 0,
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 rounded-xl border border-gray-200/80 shadow-md font-sans text-[#303030] font-normal bg-white relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 to-purple-400" />
              <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 tracking-tight">
                    Yearly Statement
                  </h3>
                  <p className="text-sm text-gray-500">{year}</p>
                </div>
                <span className="text-sm text-gray-500">
                  {filteredRuns.length} runs
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: "Total Employees (sum)", value: totalEmployees },
                  {
                    label: "Total Gross Pay",
                    value: formatCurrency(totalGross),
                  },
                  { label: "Total Net Pay", value: formatCurrency(totalNet) },
                  {
                    label: "Total Employer Cost",
                    value: formatCurrency(totalEmployerCost),
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl p-3.5 border border-gray-100/80 hover:shadow-sm transition-shadow"
                  >
                    <p className="text-xs text-gray-400 mb-1 font-medium uppercase tracking-wide">
                      {item.label}
                    </p>
                    <p className="text-sm font-bold text-gray-800">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-100 pt-4 mt-4">
                <h4 className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wider">
                  Statutory Totals
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  {[
                    ["EPF (EE)", yearlyTotals.epfEmployee],
                    ["EPF (ER)", yearlyTotals.epfEmployer],
                    ["SOCSO (EE)", yearlyTotals.socsoEmployee],
                    ["SOCSO (ER)", yearlyTotals.socsoEmployer],
                    ["EIS (EE)", yearlyTotals.eisEmployee],
                    ["EIS (ER)", yearlyTotals.eisEmployer],
                    ["PCB (Tax)", yearlyTotals.pcb],
                    ["HRDF", yearlyTotals.hrdf],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="flex justify-between items-center"
                    >
                      <span className="text-gray-600">{label}</span>
                      <span className="font-semibold text-gray-800">
                        {formatCurrency(value)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex justify-between items-center">
                  <span className="text-gray-600">Total Deductions</span>
                  <span className="font-semibold text-gray-800">
                    {formatCurrency(yearlyTotals.totalDeductions)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Reports & Exports */}
        {!isLoading && filteredRuns.length > 0 && (
          <ReportsSection
            business={selectedBusiness}
            year={year}
            onYearChange={setYear}
            runs={filteredRuns}
            statementRunId={statementRunId}
            openConfirmModal={openConfirmModal}
          />
        )}
      </div>

      {showNewRunModal && (
        <NewPayrollRunModal
          business={selectedBusiness}
          year={year}
          onClose={() => setShowNewRunModal(false)}
          onSuccess={() => {
            setShowNewRunModal(false);
            fetchRuns();
          }}
        />
      )}
      <ConfirmationModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmModal}
        title={confirmTitle}
        message={confirmMessage}
        confirmText={confirmText}
        cancelText="Cancel"
      />
    </Page>
  );
};

const ReportsSection = ({
  business,
  year,
  onYearChange,
  runs,
  statementRunId,
  openConfirmModal,
}) => {
  const [eaForms, setEaForms] = useState(null);
  const [loadingEA, setLoadingEA] = useState(false);
  const [exportingStatutory, setExportingStatutory] = useState("");
  const [emailingRun, setEmailingRun] = useState("");
  const [bulkPrintingRun, setBulkPrintingRun] = useState("");
  const [showEAModal, setShowEAModal] = useState(false);
  const [exportingCP39, setExportingCP39] = useState(false);
  const [loadingBorangE, setLoadingBorangE] = useState(false);
  const [statutoryMonth, setStatutoryMonth] = useState(() => {
    const sel = runs.find((r) => r._id === statementRunId);
    return sel?.month || runs[0]?.month || 1;
  });

  const availableMonths = useMemo(
    () =>
      [...new Set(runs.map((r) => Number(r.month)).filter(Boolean))].sort(
        (a, b) => a - b,
      ),
    [runs],
  );

  useEffect(() => {
    if (!availableMonths.length) {
      if (statutoryMonth !== 1) setStatutoryMonth(1);
      return;
    }

    if (!availableMonths.includes(Number(statutoryMonth))) {
      setStatutoryMonth(availableMonths[0]);
    }
  }, [availableMonths, statutoryMonth]);

  const getBlobErrorMessage = async (blob) => {
    if (!(blob instanceof Blob)) return "";
    if (
      !blob.type?.includes("application/json") &&
      !blob.type?.includes("text/plain")
    ) {
      return "";
    }

    try {
      const text = await blob.text();
      if (!text) return "";
      const parsed = JSON.parse(text);
      return parsed?.message || text;
    } catch {
      return "";
    }
  };

  const downloadBlobFile = (blob, fallbackFilename, contentDisposition) => {
    const fileNameMatch = contentDisposition?.match(
      /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i,
    );
    const fileName = fileNameMatch?.[1]
      ? decodeURIComponent(fileNameMatch[1].replace(/"/g, ""))
      : fallbackFilename;

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const ensureReportFilters = (actionLabel, { requireMonth = false } = {}) => {
    if (!business) {
      notifyError("Please select a business first.");
      return false;
    }

    if (!year) {
      notifyError(`Please select a year first to ${actionLabel}.`);
      return false;
    }

    if (requireMonth && !availableMonths.length) {
      notifyError("No payroll runs are available for the selected year.");
      return false;
    }

    return true;
  };

  const handleGenerateEA = async () => {
    if (!ensureReportFilters("generate EA forms")) return;

    setLoadingEA(true);
    try {
      const { data } = await axios.get(`${Base_URL}/payroll/reports/ea-form`, {
        params: { business, year },
      });
      setEaForms(Array.isArray(data) ? data : [data]);
      setShowEAModal(true);
    } catch (err) {
      notifyError(err.response?.data?.message || "Failed to generate EA forms");
    } finally {
      setLoadingEA(false);
    }
  };

  const handleDownloadEAPDF = async (employeeId, empName) => {
    if (!ensureReportFilters("download the EA form PDF")) return;
    if (!employeeId) {
      notifyError("Employee information is missing for this EA form.");
      return;
    }

    try {
      const response = await axios.get(
        `${Base_URL}/payroll/reports/ea-form-pdf`,
        {
          params: { business, year, employeeId },
          responseType: "blob",
        },
      );
      const blobError = await getBlobErrorMessage(response.data);
      if (blobError) {
        notifyError(blobError);
        return;
      }

      downloadBlobFile(
        response.data,
        `EA_Form_${empName || "employee"}_${year}.pdf`,
        response.headers?.["content-disposition"],
      );
      notifySuccess("EA Form PDF downloaded");
    } catch (err) {
      const blobError = await getBlobErrorMessage(err.response?.data);
      notifyError(blobError || "Failed to download EA Form PDF");
    }
  };

  const handleStatutoryExport = async (type) => {
    if (
      !ensureReportFilters(`download the ${type.toUpperCase()} file`, {
        requireMonth: true,
      })
    ) {
      return;
    }

    setExportingStatutory(type);
    try {
      const response = await axios.get(
        `${Base_URL}/payroll/reports/statutory-export`,
        {
          params: { business, year, month: statutoryMonth, type },
          responseType: "blob",
        },
      );
      const blobError = await getBlobErrorMessage(response.data);
      if (blobError) {
        notifyError(blobError);
        return;
      }

      downloadBlobFile(
        response.data,
        `${type.toUpperCase()}_${MONTH_NAMES[statutoryMonth] || statutoryMonth}_${year}.csv`,
        response.headers?.["content-disposition"],
      );
      notifySuccess(`${type.toUpperCase()} export downloaded`);
    } catch (err) {
      const blobError = await getBlobErrorMessage(err.response?.data);
      notifyError(blobError || `Failed to export ${type.toUpperCase()}`);
    } finally {
      setExportingStatutory("");
    }
  };

  const handleBulkPrint = async (runId) => {
    if (!runId) {
      notifyError("Please select a payroll run first.");
      return;
    }

    setBulkPrintingRun(runId);
    try {
      const run = runs.find((r) => r._id === runId);
      const response = await axios.get(
        `${Base_URL}/payroll/reports/runs/${runId}/bulk-payslips-pdf`,
        {
          responseType: "blob",
        },
      );
      const blobError = await getBlobErrorMessage(response.data);
      if (blobError) {
        notifyError(blobError);
        return;
      }

      downloadBlobFile(
        response.data,
        `All_Payslips_${run ? MONTH_NAMES[run.month] : "payroll"}_${year || "selected-year"}.pdf`,
        response.headers?.["content-disposition"],
      );
      notifySuccess("Bulk payslips PDF downloaded");
    } catch (err) {
      const blobError = await getBlobErrorMessage(err.response?.data);
      notifyError(blobError || "Failed to generate bulk payslips PDF");
    } finally {
      setBulkPrintingRun("");
    }
  };

  const handleEmailPayslips = async (runId) => {
    const run = runs.find((r) => r._id === runId);
    openConfirmModal?.({
      title: "Email Payslips",
      message: `Send payslip emails to all employees for ${run ? MONTH_NAMES[run.month] : ""}? This will email individual payslips with PDF attachments.`,
      confirmText: "Send",
      onConfirm: async () => {
        setEmailingRun(runId);
        try {
          const { data } = await axios.post(
            `${Base_URL}/payroll/reports/runs/${runId}/email-payslips`,
          );
          notifySuccess(data.message || "Payslip emails sent");
        } catch (err) {
          notifyError(
            err.response?.data?.message || "Failed to email payslips",
          );
        } finally {
          setEmailingRun("");
        }
      },
    });
  };

  const handleCP39Export = async () => {
    if (
      !ensureReportFilters("download the CP39 file", { requireMonth: true })
    ) {
      return;
    }

    setExportingCP39(true);
    try {
      const response = await axios.get(
        `${Base_URL}/payroll/reports/cp39-export`,
        {
          params: { business, year, month: statutoryMonth },
          responseType: "blob",
        },
      );
      const blobError = await getBlobErrorMessage(response.data);
      if (blobError) {
        notifyError(blobError);
        return;
      }

      downloadBlobFile(
        response.data,
        `CP39_${String(statutoryMonth).padStart(2, "0")}_${year}.txt`,
        response.headers?.["content-disposition"],
      );
      notifySuccess("CP39 file exported");
    } catch (err) {
      const blobError = await getBlobErrorMessage(err.response?.data);
      notifyError(blobError || "Failed to export CP39");
    } finally {
      setExportingCP39(false);
    }
  };

  const handleBorangEPDF = async () => {
    if (!ensureReportFilters("download Borang E")) return;

    setLoadingBorangE(true);
    try {
      const response = await axios.get(
        `${Base_URL}/payroll/reports/borang-e-pdf`,
        {
          params: { business, year },
          responseType: "blob",
        },
      );
      const blobError = await getBlobErrorMessage(response.data);
      if (blobError) {
        notifyError(blobError);
        return;
      }

      downloadBlobFile(
        response.data,
        `Borang_E_${year}.pdf`,
        response.headers?.["content-disposition"],
      );
      notifySuccess("Borang E PDF downloaded");
    } catch (err) {
      const blobError = await getBlobErrorMessage(err.response?.data);
      notifyError(blobError || "Failed to generate Borang E");
    } finally {
      setLoadingBorangE(false);
    }
  };

  const calculatedRuns = runs.filter((r) => !["draft"].includes(r.status));

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* EA Form (Borang EA) */}
        <div className="p-6 rounded-xl border border-gray-200/80 shadow-md font-sans text-[#303030] font-normal bg-white relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-blue-400" />
          <h3 className="text-sm font-semibold text-gray-800 mb-2 tracking-tight">
            EA Form (Borang EA / C.P.8A)
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Generate annual employment income statements for all employees for{" "}
            {year || "the selected year"}.
          </p>
          <button
            onClick={handleGenerateEA}
            disabled={loadingEA}
            className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            style={{ backgroundColor: "var(--p-blue)" }}
          >
            <FileText className="w-4 h-4" />
            {loadingEA ? "Generating..." : "Generate EA Forms"}
          </button>
        </div>

        {/* Statutory File Exports */}
        <div className="p-6 rounded-xl border border-gray-200/80 shadow-md font-sans text-[#303030] font-normal bg-white relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-sky-400" />
          <h3 className="text-sm font-semibold text-gray-800 mb-2 tracking-tight">
            Statutory File Exports
          </h3>
          <p className="text-sm text-gray-500 mb-3">
            Download EPF, SOCSO, or EIS contribution files for statutory filing.
          </p>
          <div className="flex items-center gap-3 mb-4">
            <label className="text-sm text-gray-600">Month:</label>
            <div className="w-[160px]">
              <DropdownBasic
                value={String(statutoryMonth || "")}
                onChange={(value) =>
                  setStatutoryMonth(
                    value ? Number(value) : availableMonths[0] || 1,
                  )
                }
                options={availableMonths.map((monthValue) => ({
                  value: String(monthValue),
                  label: MONTH_NAMES[monthValue],
                }))}
                placeholder="Select month"
                width="160px"
                isClearable={true}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {["epf", "socso", "eis"].map((type) => (
              <button
                key={type}
                onClick={() => handleStatutoryExport(type)}
                disabled={!!exportingStatutory}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                {exportingStatutory === type
                  ? "Exporting..."
                  : `${type.toUpperCase()} CSV`}
              </button>
            ))}
            <button
              onClick={handleCP39Export}
              disabled={exportingCP39}
              className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              {exportingCP39 ? "Exporting..." : "CP39 (PCB/LHDN)"}
            </button>
          </div>
        </div>

        {/* Bulk Print Payslips */}
        <div className="p-6 rounded-xl border border-gray-200/80 shadow-md font-sans text-[#303030] font-normal bg-white relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-pink-400" />
          <h3 className="text-sm font-semibold text-gray-800 mb-2 tracking-tight">
            Bulk Print / Save Payslips
          </h3>
          <p className="text-sm text-gray-500 mb-3">
            Download all payslips as a single PDF for printing or archiving.
          </p>
          <div className="space-y-2">
            {calculatedRuns.length === 0 ? (
              <p className="text-sm text-gray-400">
                No calculated runs available.
              </p>
            ) : (
              calculatedRuns.map((r) => (
                <div
                  key={r._id}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="text-sm text-gray-700">
                    {MONTH_NAMES[r.month]} {r.year} ({r.totalEmployees} emp)
                  </span>
                  <button
                    onClick={() => handleBulkPrint(r._id)}
                    disabled={bulkPrintingRun === r._id}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-xs font-medium disabled:opacity-50"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    {bulkPrintingRun === r._id
                      ? "Generating..."
                      : "Download PDF"}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Email Payslips */}
        <div className="p-6 rounded-xl border border-gray-200/80 shadow-md font-sans text-[#303030] font-normal bg-white relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 to-amber-400" />
          <h3 className="text-sm font-semibold text-gray-800 mb-2 tracking-tight">
            Email Payslips
          </h3>
          <p className="text-sm text-gray-500 mb-3">
            Send individual payslip PDFs via email to each employee.
          </p>
          <div className="space-y-2">
            {calculatedRuns.length === 0 ? (
              <p className="text-sm text-gray-400">
                No calculated runs available.
              </p>
            ) : (
              calculatedRuns.map((r) => (
                <div
                  key={r._id}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="text-sm text-gray-700">
                    {MONTH_NAMES[r.month]} {r.year} ({r.totalEmployees} emp)
                  </span>
                  <button
                    onClick={() => handleEmailPayslips(r._id)}
                    disabled={emailingRun === r._id}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-xs font-medium disabled:opacity-50"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    {emailingRun === r._id ? "Sending..." : "Send Emails"}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Borang E (Employer Annual Return) */}
        <div className="p-6 rounded-xl border border-gray-200/80 shadow-md font-sans text-[#303030] font-normal bg-white relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 to-red-400" />
          <h3 className="text-sm font-semibold text-gray-800 mb-2 tracking-tight">
            Borang E (Employer Annual Return)
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Generate the annual employer return form (Borang E) summarizing all
            employees' remuneration for {year || "the selected year"}.
          </p>
          <button
            onClick={handleBorangEPDF}
            disabled={loadingBorangE}
            className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            style={{ backgroundColor: "var(--p-blue)" }}
          >
            <FileText className="w-4 h-4" />
            {loadingBorangE ? "Generating..." : "Download Borang E PDF"}
          </button>
        </div>
      </div>

      {showEAModal && eaForms && (
        <EAFormModal
          eaForms={eaForms}
          year={year}
          onClose={() => {
            setShowEAModal(false);
            setEaForms(null);
          }}
          onDownloadPDF={handleDownloadEAPDF}
        />
      )}
    </>
  );
};

const EAFormModal = ({ eaForms, year, onClose, onDownloadPDF }) => {
  const [selected, setSelected] = useState(0);
  const form = eaForms[selected] || null;
  const formatCurrency = (amt) =>
    `RM ${(amt || 0).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center overflow-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto border border-gray-200/50">
        <div className="flex justify-between items-center p-5 border-b sticky top-0 bg-white/95 backdrop-blur-sm z-10 rounded-t-2xl">
          <h2 className="text-lg font-bold tracking-tight">
            EA Forms (Borang EA) - {year}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl"
          >
            &times;
          </button>
        </div>

        <div className="p-4 border-b bg-gray-50 flex items-center gap-4 flex-wrap sticky top-[57px] z-10">
          <label className="block text-sm font-medium text-gray-700">
            Employee:
          </label>
          <div className="min-w-[280px]">
            <DropdownBasic
              value={String(selected)}
              onChange={(value) => setSelected(value ? Number(value) : 0)}
              options={eaForms.map((f, i) => ({
                value: String(i),
                label: `${f.employee?.fullName || `Employee ${i + 1}`} (${f.employee?.employeeId || "-"})`,
              }))}
              placeholder="Select employee"
              width="280px"
              isClearable={true}
            />
          </div>
          {form && (
            <button
              onClick={() =>
                onDownloadPDF(
                  form.employee?._id || form.employee?.employeeId,
                  form.employee?.fullName || "employee",
                )
              }
              className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-medium ml-auto"
              style={{ backgroundColor: "var(--p-blue)" }}
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>
          )}
        </div>

        {form && (
          <div className="p-6 space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-bold">BORANG EA / C.P.8A</h3>
              <p className="text-sm text-gray-500">
                Penyata Saraan Daripada Penggajian / Statement of Remuneration
                from Employment
              </p>
              <p className="text-sm text-gray-500">
                Bagi Tahun / For Year: {year}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                <h4 className="text-sm font-bold text-gray-700 mb-2">
                  A. Employer Details
                </h4>
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="text-gray-500">Name:</span>{" "}
                    {form.employer?.name || "-"}
                  </p>
                  <p>
                    <span className="text-gray-500">Address:</span>{" "}
                    {form.employer?.address || "-"}
                  </p>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                <h4 className="text-sm font-bold text-gray-700 mb-2">
                  B. Employee Details
                </h4>
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="text-gray-500">Name:</span>{" "}
                    {form.employee?.fullName || "-"}
                  </p>
                  <p>
                    <span className="text-gray-500">NRIC:</span>{" "}
                    {form.employee?.nric || "-"}
                  </p>
                  <p>
                    <span className="text-gray-500">Tax File No:</span>{" "}
                    {form.employee?.taxFileNumber || "-"}
                  </p>
                  <p>
                    <span className="text-gray-500">EPF No:</span>{" "}
                    {form.employee?.epfNumber || "-"}
                  </p>
                  <p>
                    <span className="text-gray-500">Position:</span>{" "}
                    {form.employee?.position || "-"}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-bold text-gray-700 mb-3">
                C. Employment Income Breakdown
              </h4>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {[
                        "Month",
                        "Basic Salary",
                        "Allowances",
                        "OT",
                        "Gross Pay",
                        "EPF (EE)",
                        "PCB",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {form.monthlyBreakdown?.map((m, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium">{m.monthName}</td>
                        <td className="px-3 py-2">
                          {formatCurrency(m.basicSalary)}
                        </td>
                        <td className="px-3 py-2">
                          {formatCurrency(m.allowances)}
                        </td>
                        <td className="px-3 py-2">
                          {formatCurrency(m.overtime)}
                        </td>
                        <td className="px-3 py-2 font-medium">
                          {formatCurrency(m.grossPay)}
                        </td>
                        <td className="px-3 py-2 text-red-600">
                          {formatCurrency(m.epfEmployee)}
                        </td>
                        <td className="px-3 py-2 text-red-600">
                          {formatCurrency(m.pcb)}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-gray-100 font-bold">
                      <td className="px-3 py-2">TOTAL</td>
                      <td className="px-3 py-2">
                        {formatCurrency(form.totals?.grossSalary)}
                      </td>
                      <td className="px-3 py-2">
                        {formatCurrency(form.totals?.allowances)}
                      </td>
                      <td className="px-3 py-2">
                        {formatCurrency(form.totals?.overtime)}
                      </td>
                      <td className="px-3 py-2">
                        {formatCurrency(form.totals?.grossPay)}
                      </td>
                      <td className="px-3 py-2 text-red-600">
                        {formatCurrency(form.totals?.epfEmployee)}
                      </td>
                      <td className="px-3 py-2 text-red-600">
                        {formatCurrency(form.totals?.pcb)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-bold text-gray-700 mb-3">
                D. Deductions Summary
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  ["EPF (Employee)", form.totals?.epfEmployee],
                  ["EPF (Employer)", form.totals?.epfEmployer],
                  ["SOCSO (Employee)", form.totals?.socsoEmployee],
                  ["SOCSO (Employer)", form.totals?.socsoEmployer],
                  ["EIS (Employee)", form.totals?.eisEmployee],
                  ["EIS (Employer)", form.totals?.eisEmployer],
                  ["PCB (Tax)", form.totals?.pcb],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="bg-gray-50 rounded-lg p-3 border border-gray-100"
                  >
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className="text-sm font-semibold text-gray-800">
                      {formatCurrency(value)}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-4 bg-green-50 rounded-lg p-4 border border-green-100 flex justify-between items-center">
                <span className="text-sm font-bold text-green-800">
                  Net Income
                </span>
                <span className="text-lg font-bold text-green-800">
                  {formatCurrency(form.totals?.netPay)}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 p-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const NewPayrollRunModal = ({
  business,
  year: initialYear,
  onClose,
  onSuccess,
}) => {
  const [runYear, setRunYear] = useState(
    initialYear || new Date().getFullYear(),
  );
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [payGroup, setPayGroup] = useState("");
  const [payGroups, setPayGroups] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!business) return;
    axios
      .get(`${Base_URL}/payroll/pay-groups`, { params: { business } })
      .then(({ data }) => setPayGroups(data || []))
      .catch(() => setPayGroups([]));
  }, [business]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");
    try {
      const body = { business, year: runYear, month };
      if (payGroup) body.payGroup = payGroup;
      await axios.post(`${Base_URL}/payroll/runs`, body);
      onSuccess();
    } catch (err) {
        setError(err.response?.data?.message || "Failed to create payroll run");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 border border-gray-200/50">
        <div className="flex justify-between items-center p-5 border-b rounded-t-2xl">
          <h2 className="text-lg font-bold tracking-tight">New Payroll Run</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl"
          >
            &times;
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Year
            </label>
            <YearPicker
              value={runYear}
              onChange={(yr) =>
                setRunYear(yr ? Number(yr) : new Date().getFullYear())
              }
              allowAll={false}
              className="w-full"
              inputClassName="h-[40px] w-full px-3 py-2 border border-gray-300 rounded-xl text-sm bg-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap select-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Month
            </label>
            <DropdownBasic
              value={String(month)}
              onChange={(value) => setMonth(Number(value))}
              options={MONTH_NAMES.slice(1).map((m, i) => ({
                value: String(i + 1),
                label: m,
              }))}
              placeholder="Select Month"
              width="100%"
              isClearable={false}
              sortOptions={false}
            />
          </div>
          {payGroups.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Pay Group{" "}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <DropdownBasic
                value={payGroup}
                onChange={(value) => setPayGroup(value)}
                options={payGroups.map((g) => ({
                  value: g._id,
                  label: `${g.name} (${g.code})`,
                }))}
                placeholder="All Employees"
                width="100%"
                isClearable={true}
              />
            </div>
          )}
          <p className="text-sm text-gray-500">
            This will create a payroll run for{" "}
            <strong>
              {MONTH_NAMES[month]} {runYear}
            </strong>
            {payGroup
              ? ` for the selected pay group`
              : ` and include all active employees with payroll profiles`}
            .
          </p>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-white rounded-lg disabled:opacity-50 font-medium text-sm"
              style={{ backgroundColor: "var(--p-blue)" }}
            >
              {isSubmitting ? "Creating..." : "Create Payroll Run"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PayrollDashboard;
