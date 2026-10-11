import React, {
  useState,
  useEffect,
  useContext,
  useMemo,
  useCallback,
} from "react";
import { useHistory } from "react-router-dom";
import {
  ArrowLeft,
  Download,
  FileSpreadsheet,
  FileText,
  Shield,
  Building2,
  Users,
  Layers,
  Info,
  Search,
  DollarSign,
  CheckCircle,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Printer,
  X,
} from "lucide-react";
import { IoClose } from "react-icons/io5";
import axios from "axios";
import * as XLSX from "xlsx";
import { AdminContext } from "@/context/AdminContext";
import { Page } from "@/page-layouts/index";
import DropdownBasic from "@/page-layouts/components/DropdownBasic";
import { formatAmount } from "@/components/formatAmount";
import { notifyError, notifySuccess } from "@/utils/toast";
import YearPicker from "./components/YearPicker";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

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

const fmt = (v) => `RM ${formatAmount(v || 0)}`;

/* -- Section Header -- */
const SectionHeader = ({ icon: Icon, children, badge, info, actions }) => (
  <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-white to-gray-50/80 flex items-center gap-2.5">
    {Icon && <Icon size={16} className="text-[var(--p-blue)]" />}
    <h2 className="text-sm font-semibold text-gray-800 tracking-tight flex-1">
      {children}
    </h2>
    {info && (
      <div className="group relative inline-flex">
        <Info
          size={14}
          className="text-gray-300 hover:text-gray-500 transition-colors cursor-help"
        />
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-[11px] rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 max-w-[280px] text-wrap leading-relaxed">
          {info}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 bg-gray-800 rotate-45" />
        </div>
      </div>
    )}
    {badge && (
      <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
        {badge}
      </span>
    )}
    {actions}
  </div>
);

/* -- Download Button -- */
const DownloadBtn = ({
  onClick,
  label,
  icon: Icon = Download,
  variant = "default",
  disabled,
  small,
}) => {
  const base = small
    ? "px-2.5 py-1.5 text-xs gap-1.5"
    : "px-3.5 py-2 text-sm gap-2";
  const variants = {
    default:
      "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300",
    primary: "bg-[var(--p-blue)] text-white hover:opacity-90",
    green: "bg-green-600 text-white hover:bg-green-700",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center ${base} rounded-lg font-medium transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed ${variants[variant]}`}
    >
      <Icon size={small ? 13 : 15} />
      {label}
    </button>
  );
};

/* -- Status badge -- */
const StatusBadge = ({ status }) => {
  const s = (status || "").toLowerCase();
  const cfg = {
    paid: "bg-green-100 text-green-700",
    finalized: "bg-green-100 text-green-700",
    approved: "bg-blue-100 text-blue-700",
    posted: "bg-blue-100 text-blue-700",
    calculated: "bg-amber-100 text-amber-700",
    reviewed: "bg-amber-100 text-amber-700",
    draft: "bg-gray-100 text-gray-500",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium capitalize ${cfg[s] || "bg-gray-100 text-gray-600"}`}
    >
      {status}
    </span>
  );
};

/* ====== MAIN COMPONENT ====== */
const PayrollReports = () => {
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const history = useHistory();

  const [selectedBusiness, setSelectedBusiness] = useState("");
  const [year, setYear] = useState(() => {
    const now = new Date();
    return now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  });
  const [month, setMonth] = useState(() => {
    const now = new Date();
    const dMonth = now.getMonth();
    return String(dMonth === 0 ? 12 : dMonth);
  });
  const [department, setDepartment] = useState("");
  const [payGroup, setPayGroup] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [activeTab, setActiveTab] = useState("register");
  const [summaryData, setSummaryData] = useState(null);
  const [statutoryData, setStatutoryData] = useState(null);
  const [departmentData, setDepartmentData] = useState(null);
  const [filtersData, setFiltersData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedDepts, setExpandedDepts] = useState({});
  const [expandedEmployee, setExpandedEmployee] = useState(null);

  useEffect(() => {
    const adminId = adminInfo?.id || adminInfo?._id;
    if (!adminId) return;
    axios
      .get(`${Base_URL}/admin/assigned/${adminId}`, {
        headers: { authorization: `Bearer ${adminInfo?.token}` },
      })
      .then(({ data }) => {
        const list = data?.businesses || [];
        if (list.length > 0) setSelectedBusiness((prev) => prev || list[0]._id);
      })
      .catch(() => {});
  }, [adminInfo?.id, adminInfo?._id, adminInfo?.token]);

  useEffect(() => {
    if (!selectedBusiness) return;
    const params = { business: selectedBusiness };
    if (year) params.year = year;
    axios
      .get(`${Base_URL}/payroll/reports/filters`, { params })
      .then(({ data }) => setFiltersData(data))
      .catch((err) => {
        console.error("Failed to fetch report filters:", err);
        setFiltersData(null);
      });
  }, [selectedBusiness, year]);

  const buildParams = useCallback(() => {
    const params = { business: selectedBusiness };
    if (year) params.year = year;
    if (month) params.month = month;
    if (department) params.department = department;
    if (payGroup) params.payGroup = payGroup;
    return params;
  }, [selectedBusiness, year, month, department, payGroup]);

  const fetchReport = useCallback(async () => {
    if (!selectedBusiness) return;
    setIsLoading(true);
    setError("");
    const params = buildParams();
    try {
      if (activeTab === "register" || activeTab === "employee") {
        const { data } = await axios.get(
          `${Base_URL}/payroll/reports/summary`,
          { params },
        );
        setSummaryData(data);
      } else if (activeTab === "statutory") {
        const { data } = await axios.get(
          `${Base_URL}/payroll/reports/statutory-detail`,
          { params },
        );
        setStatutoryData(data);
      } else if (activeTab === "costcenter") {
        const { data } = await axios.get(
          `${Base_URL}/payroll/reports/department`,
          { params },
        );
        setDepartmentData(data);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch report");
    } finally {
      setIsLoading(false);
    }
  }, [selectedBusiness, activeTab, buildParams]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const filteredEmployees = useMemo(() => {
    let list = summaryData?.employeeBreakdown || [];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (e) =>
          (e.fullName || "").toLowerCase().includes(q) ||
          (e.employeeId || "").toLowerCase().includes(q) ||
          (e.department || "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [summaryData, searchQuery]);

  const filteredMonthly = useMemo(() => {
    let list = summaryData?.monthlyBreakdown || [];
    if (statusFilter) list = list.filter((m) => m.status === statusFilter);
    return list;
  }, [summaryData, statusFilter]);

  const uniqueStatuses = useMemo(() => {
    if (!summaryData?.monthlyBreakdown) return [];
    return [...new Set(summaryData.monthlyBreakdown.map((m) => m.status))];
  }, [summaryData]);

  const exportPayrollRegister = () => {
    if (!summaryData) return;
    try {
      const wb = XLSX.utils.book_new();
      const monthlyRows = filteredMonthly.map((m) => ({
        Period: `${m.monthName} ${m.year}`,
        Status: m.status,
        Employees: m.employees,
        "Gross Pay": m.grossPay,
        "Basic Salary": m.basicSalary || 0,
        "Total Earnings": m.totalEarnings || m.grossPay,
        "Net Pay": m.netPay,
        "Total Deductions": m.totalDeductions,
        "EPF (Employee)": m.epfEmployee,
        "EPF (Employer)": m.epfEmployer,
        "SOCSO (Employee)": m.socsoEmployee,
        "SOCSO (Employer)": m.socsoEmployer,
        "EIS (Employee)": m.eisEmployee,
        "EIS (Employer)": m.eisEmployer,
        "PCB / MTD": m.pcb,
        HRDF: m.hrdf,
        "Employer Cost": m.employerCost,
      }));
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(monthlyRows),
        "Payroll Register",
      );
      const empRows = filteredEmployees.map((e) => ({
        "Employee ID": e.employeeId,
        "Full Name": e.fullName,
        Department: e.department,
        Position: e.position,
        Months: e.months,
        "Gross Pay": e.grossPay,
        "Net Pay": e.netPay,
        "EPF (Employee)": e.epfEmployee,
        "EPF (Employer)": e.epfEmployer,
        "SOCSO (Employee)": e.socsoEmployee,
        "SOCSO (Employer)": e.socsoEmployer,
        "EIS (Employee)": e.eisEmployee || 0,
        "EIS (Employer)": e.eisEmployer || 0,
        "PCB / MTD": e.pcb,
        "Employer Cost": e.employerCost,
      }));
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(empRows),
        "Employee Detail",
      );
      if (summaryData.payGroupBreakdown?.length) {
        const pgRows = summaryData.payGroupBreakdown.map((pg) => ({
          "Pay Group": pg.payGroup,
          Runs: pg.runs,
          Employees: pg.employees,
          "Gross Pay": pg.grossPay,
          "Net Pay": pg.netPay,
          "Employer Cost": pg.employerCost,
        }));
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.json_to_sheet(pgRows),
          "Pay Groups",
        );
      }
      if (summaryData.categoriesBreakdown?.length) {
        const catRows = summaryData.categoriesBreakdown.map((c) => ({
          Type: c.category === "earning" ? "Earning" : "Deduction",
          Name: c.name,
          "Total Amount": c.amount,
        }));
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.json_to_sheet(catRows),
          "Categories",
        );
      }
      const suffix = month ? `_${MONTH_NAMES[month]}` : "";
      XLSX.writeFile(wb, `Payroll_Register_${year}${suffix}.xlsx`);
      notifySuccess("Payroll register exported");
    } catch {
      notifyError("Failed to export");
    }
  };

  const exportEmployeeReport = () => {
    if (!filteredEmployees.length) {
      notifyError("No employee data available to export");
      return;
    }

    try {
      const wb = XLSX.utils.book_new();
      const summaryRows = filteredEmployees.map((e) => ({
        "Employee ID": e.employeeId,
        "Full Name": e.fullName,
        Department: e.department,
        Position: e.position,
        Months: e.months,
        "Gross Pay": e.grossPay,
        "Net Pay": e.netPay,
        "EPF (Employee)": e.epfEmployee,
        "EPF (Employer)": e.epfEmployer,
        "SOCSO (Employee)": e.socsoEmployee,
        "SOCSO (Employer)": e.socsoEmployer,
        "EIS (Employee)": e.eisEmployee || 0,
        "EIS (Employer)": e.eisEmployer || 0,
        "PCB / MTD": e.pcb,
        HRDF: e.hrdf || 0,
        Zakat: e.zakat || 0,
        "Employer Cost": e.employerCost || 0,
      }));
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(summaryRows),
        "Employee Summary",
      );

      const detailRows = filteredEmployees.flatMap((e) =>
        (e.monthlyDetail || []).map((md) => ({
          "Employee ID": e.employeeId,
          "Full Name": e.fullName,
          Department: e.department,
          Position: e.position,
          Period: `${md.monthName || ""} ${md.year || ""}`.trim(),
          "Gross Pay": md.grossPay || 0,
          "EPF (Employee)": md.epfEmployee || 0,
          "EPF (Employer)": md.epfEmployer || 0,
          "SOCSO (Employee)": md.socsoEmployee || 0,
          "SOCSO (Employer)": md.socsoEmployer || 0,
          "EIS (Employee)": md.eisEmployee || 0,
          "EIS (Employer)": md.eisEmployer || 0,
          "PCB / MTD": md.pcb || 0,
          HRDF: md.hrdf || 0,
        })),
      );

      if (detailRows.length) {
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.json_to_sheet(detailRows),
          "Monthly Detail",
        );
      }

      const suffix = month ? `_${MONTH_NAMES[month]}` : "";
      const yearLabel = year || "All_Years";
      XLSX.writeFile(wb, `Employee_Report_${yearLabel}${suffix}.xlsx`);
      notifySuccess("Employee report exported");
    } catch {
      notifyError("Failed to export employee report");
    }
  };

  const exportStatutoryReport = () => {
    if (!statutoryData) return;
    try {
      const wb = XLSX.utils.book_new();
      const rows = (statutoryData.employees || []).map((e) => ({
        "Employee ID": e.employeeId,
        "Full Name": e.fullName,
        Department: e.department,
        "EPF No": e.epfNumber,
        "SOCSO No": e.socsoNumber,
        "Tax File No": e.taxFileNumber,
        Months: e.months,
        "Gross Pay": e.grossPay,
        "EPF (Employee)": e.epfEmployee,
        "EPF (Employer)": e.epfEmployer,
        "SOCSO (Employee)": e.socsoEmployee,
        "SOCSO (Employer)": e.socsoEmployer,
        "EIS (Employee)": e.eisEmployee,
        "EIS (Employer)": e.eisEmployer,
        "PCB / MTD": e.pcb,
        HRDF: e.hrdf,
      }));
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(rows),
        "Statutory Detail",
      );
      if (statutoryData.departmentBreakdown?.length) {
        const deptRows = statutoryData.departmentBreakdown.map((d) => ({
          Department: d.department,
          Headcount: d.headcount,
          "EPF (EE)": d.epfEmployee,
          "EPF (ER)": d.epfEmployer,
          "SOCSO (EE)": d.socsoEmployee,
          "SOCSO (ER)": d.socsoEmployer,
          "EIS (EE)": d.eisEmployee,
          "EIS (ER)": d.eisEmployer,
          PCB: d.pcb,
          HRDF: d.hrdf,
        }));
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.json_to_sheet(deptRows),
          "Dept Statutory",
        );
      }
      const suffix = month ? `_${MONTH_NAMES[month]}` : "";
      XLSX.writeFile(wb, `Statutory_Report_${year}${suffix}.xlsx`);
      notifySuccess("Statutory report exported");
    } catch {
      notifyError("Failed to export");
    }
  };

  const exportCostCenter = () => {
    if (!departmentData?.departments) return;
    try {
      const wb = XLSX.utils.book_new();
      const allRows = [];
      for (const dept of departmentData.departments) {
        allRows.push({
          Department: dept.department,
          Type: "DEPARTMENT TOTAL",
          Employee: "",
          Position: "",
          Headcount: dept.headcount,
          "Gross Pay": dept.grossPay,
          "Net Pay": dept.netPay,
          "Employer Cost": dept.employerCost,
          "EPF (EE+ER)": (dept.epfEmployee || 0) + (dept.epfEmployer || 0),
          "SOCSO (EE+ER)":
            (dept.socsoEmployee || 0) + (dept.socsoEmployer || 0),
          PCB: dept.pcb || 0,
        });
        for (const emp of dept.employees || []) {
          allRows.push({
            Department: dept.department,
            Type: "Employee",
            Employee: emp.fullName,
            Position: emp.position,
            Headcount: "",
            "Gross Pay": emp.grossPay,
            "Net Pay": emp.netPay,
            "Employer Cost": emp.employerCost || 0,
            "EPF (EE+ER)": (emp.epfEmployee || 0) + (emp.epfEmployer || 0),
            "SOCSO (EE+ER)":
              (emp.socsoEmployee || 0) + (emp.socsoEmployer || 0),
            PCB: emp.pcb || 0,
          });
        }
      }
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(allRows),
        "Cost Center",
      );
      XLSX.writeFile(wb, `Cost_Center_Report_${year}.xlsx`);
      notifySuccess("Cost center report exported");
    } catch {
      notifyError("Failed to export");
    }
  };

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

  const triggerFileDownload = (blob, fallbackFilename, contentDisposition) => {
    const fileNameMatch = contentDisposition?.match(
      /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i,
    );
    const fileName = fileNameMatch?.[1]
      ? decodeURIComponent(fileNameMatch[1].replace(/"/g, ""))
      : fallbackFilename;

    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
  };

  const downloadFileWithFeedback = async (
    url,
    fallbackFilename,
    successMessage,
  ) => {
    try {
      const response = await axios.get(url, { responseType: "blob" });
      const blobError = await getBlobErrorMessage(response.data);
      if (blobError) {
        notifyError(blobError);
        return;
      }

      triggerFileDownload(
        response.data,
        fallbackFilename,
        response.headers?.["content-disposition"],
      );
      notifySuccess(successMessage);
    } catch (err) {
      const blobError = await getBlobErrorMessage(err.response?.data);
      notifyError(
        blobError ||
          err.response?.data?.message ||
          err.message ||
          "Failed to download file",
      );
    }
  };

  const downloadStatutoryFile = async (type) => {
    if (!selectedBusiness || !year || !month) {
      notifyError(
        "Select business, year, and month to download statutory files",
      );
      return;
    }

    await downloadFileWithFeedback(
      `${Base_URL}/payroll/reports/statutory-export?business=${selectedBusiness}&year=${year}&month=${month}&type=${type}`,
      `${type.toUpperCase()}_Contribution_${MONTH_NAMES[month] || month}_${year}.csv`,
      `${type.toUpperCase()} statutory file downloaded`,
    );
  };

  const downloadCP39 = async () => {
    if (!selectedBusiness || !year || !month) {
      notifyError("Select business, year, and month to download CP39");
      return;
    }

    await downloadFileWithFeedback(
      `${Base_URL}/payroll/reports/cp39-export?business=${selectedBusiness}&year=${year}&month=${month}`,
      `CP39_${MONTH_NAMES[month] || month}_${year}.txt`,
      "CP39 file downloaded",
    );
  };

  const downloadEAFormPDF = async (employeeId) => {
    if (!selectedBusiness || !year || !employeeId) {
      notifyError(
        "Select business and year before downloading the EA form PDF",
      );
      return;
    }

    await downloadFileWithFeedback(
      `${Base_URL}/payroll/reports/ea-form-pdf?business=${selectedBusiness}&year=${year}&employeeId=${employeeId}`,
      `EA_Form_${employeeId}_${year}.pdf`,
      "EA form PDF downloaded",
    );
  };

  const downloadBorangEPDF = async () => {
    if (!selectedBusiness || !year) {
      notifyError("Select business and year before downloading Borang E PDF");
      return;
    }

    await downloadFileWithFeedback(
      `${Base_URL}/payroll/reports/borang-e-pdf?business=${selectedBusiness}&year=${year}`,
      `Borang_E_${year}.pdf`,
      "Borang E PDF downloaded",
    );
  };

  const TABS = [
    { id: "register", label: "Payroll Register", icon: FileText },
    { id: "statutory", label: "Statutory & Tax", icon: Shield },
    { id: "costcenter", label: "Cost Center", icon: Building2 },
    { id: "employee", label: "Employee Reports", icon: Users },
  ];

  const fStyle =
    "h-[40px] px-3 py-2 border border-gray-300 rounded-xl text-sm bg-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all";

  const registerTotals = useMemo(() => {
    return filteredMonthly.reduce(
      (acc, m) => {
        acc.employees += m.employees || 0;
        acc.grossPay += m.grossPay || 0;
        acc.netPay += m.netPay || 0;
        acc.totalDeductions += m.totalDeductions || 0;
        acc.epfEmployee += m.epfEmployee || 0;
        acc.epfEmployer += m.epfEmployer || 0;
        acc.socsoEmployee += m.socsoEmployee || 0;
        acc.socsoEmployer += m.socsoEmployer || 0;
        acc.pcb += m.pcb || 0;
        acc.hrdf += m.hrdf || 0;
        acc.employerCost += m.employerCost || 0;
        return acc;
      },
      {
        employees: 0,
        grossPay: 0,
        netPay: 0,
        totalDeductions: 0,
        epfEmployee: 0,
        epfEmployer: 0,
        socsoEmployee: 0,
        socsoEmployer: 0,
        pcb: 0,
        hrdf: 0,
        employerCost: 0,
      },
    );
  }, [filteredMonthly]);

  const hasActiveFilters =
    month ||
    department ||
    payGroup ||
    statusFilter ||
    searchQuery ||
    year;

  return (
    <Page
      header={{
        title: "Payroll Reports",
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
                    appearance: "filterPill",
                  },
                },
              ]
            : [],
        renderActions: [
          <div
            key="year"
            className="!p-0 !bg-transparent !shadow-none !rounded-none flex-shrink-0"
          >
            <YearPicker
              value={year}
              onChange={(yr) => setYear(yr ? Number(yr) : "")}
              placeholder="All Years"
              inputClassName={
                fStyle +
                " cursor-pointer flex items-center gap-2 whitespace-nowrap select-none"
              }
            />
          </div>,
          <div key="month" className="w-[145px] max-w-full flex-shrink-0">
            <DropdownBasic
              value={month}
              onChange={(value) => setMonth(value)}
              options={(filtersData?.months?.length
                ? filtersData.months
                : MONTH_NAMES.slice(1).map((m, i) => ({
                    value: i + 1,
                    label: m,
                  }))
              ).map((m) => ({ value: String(m.value), label: m.label }))}
              placeholder="All Months"
              width="145px"
              isClearable={true}
              appearance="filterPill"
              sortOptions={false}
            />
          </div>,
          <div key="department" className="w-[180px] max-w-full flex-shrink-0">
            <DropdownBasic
              value={department}
              onChange={(value) => setDepartment(value)}
              options={(filtersData?.departments || []).map((d) => ({
                value: d,
                label: d,
              }))}
              placeholder="All Departments"
              width="180px"
              isClearable={true}
              appearance="filterPill"
            />
          </div>,
          <div key="paygroup" className="w-[170px] max-w-full flex-shrink-0">
            <DropdownBasic
              value={payGroup}
              onChange={(value) => setPayGroup(value)}
              options={(filtersData?.payGroups || []).map((pg) => ({
                value: pg._id,
                label: pg.name,
              }))}
              placeholder="All Pay Groups"
              width="170px"
              isClearable={true}
              appearance="filterPill"
            />
          </div>,
          activeTab === "register" ? (
            <div key="status" className="w-[155px] max-w-full flex-shrink-0">
              <DropdownBasic
                value={statusFilter}
                onChange={(value) => setStatusFilter(value)}
                options={uniqueStatuses.map((s) => ({
                  value: s,
                  label: s.charAt(0).toUpperCase() + s.slice(1),
                }))}
                placeholder="All Statuses"
                width="155px"
                isClearable={true}
                appearance="filterPill"
              />
            </div>
          ) : null,
          activeTab === "employee" ? (
            <div
              key="search"
              className="relative w-[210px] max-w-full flex-shrink-0"
            >
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search employee..."
                className={`${fStyle} !pl-9 w-full`}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ) : null,
          hasActiveFilters ? (
            <div
              key="clear"
              className="!p-0 !bg-transparent !shadow-none !rounded-none"
            >
              <IoClose
                onClick={() => {
                  setYear("");
                  setMonth("");
                  setDepartment("");
                  setPayGroup("");
                  setStatusFilter("");
                  setSearchQuery("");
                }}
                title="Clear Filters"
                className="w-5 h-5 cursor-pointer bg-transparent rounded-full p-[2px] text-red-500 border border-red-500 font-bold hover:bg-red-500 hover:border-none hover:text-white"
              />
            </div>
          ) : null,
          <button
            key="back"
            onClick={() => history.push("/payroll")}
            className="!h-[40px] !px-3 flex items-center gap-2 text-white text-sm rounded-xl shadow-sm"
            style={{ backgroundColor: "var(--p-blue)" }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>,
        ],
      }}
    >
      <div className="mt-4">
        {/* TAB NAVIGATION */}
        <div className="flex items-center gap-1 bg-white rounded-xl border border-gray-200/80 shadow-md p-1.5 mb-5 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                activeTab === tab.id
                  ? "text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
              style={
                activeTab === tab.id ? { backgroundColor: "var(--p-blue)" } : {}
              }
            >
              <tab.icon size={15} />
              {tab.label}
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="rounded-xl border border-gray-200/80 shadow-md bg-white p-12 text-center mb-5">
            <div
              className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-3"
              style={{ borderColor: "var(--p-blue)" }}
            />
            <p className="text-gray-500 text-sm">Loading report...</p>
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm mb-5">
            {error}
          </div>
        )}

        {/* TAB 1: PAYROLL REGISTER */}
        {activeTab === "register" && summaryData && !isLoading && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                {
                  label: "Total Paid",
                  value: fmt(summaryData.totalPaidRM),
                  icon: CheckCircle,
                  iconColor: "text-green-500",
                },
                {
                  label: "Total Pending",
                  value: fmt(summaryData.totalPendingRM),
                  icon: Clock,
                  iconColor: "text-amber-500",
                },
                {
                  label: "Paid Months",
                  value: summaryData.paidMonths,
                  icon: CheckCircle,
                  iconColor: "text-green-500",
                },
                {
                  label: "Pending Months",
                  value: summaryData.pendingMonths,
                  icon: AlertCircle,
                  iconColor: "text-amber-500",
                },
                {
                  label: "Total Gross",
                  value: fmt(summaryData.totalGross),
                  icon: DollarSign,
                  iconColor: "text-blue-500",
                },
                {
                  label: "Employer Cost",
                  value: fmt(summaryData.totalEmployerCost),
                  icon: Building2,
                  iconColor: "text-purple-500",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-3.5"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <item.icon size={13} className={item.iconColor} />
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                      {item.label}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-gray-800">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-gray-200/80 shadow-md bg-white overflow-hidden">
              <SectionHeader
                icon={FileText}
                badge={`${filteredMonthly.length} periods`}
                info="Monthly payroll register with full statutory breakdown. Use status filter to narrow results."
                actions={
                  <DownloadBtn
                    onClick={exportPayrollRegister}
                    label="Export Excel"
                    icon={FileSpreadsheet}
                    variant="green"
                    small
                  />
                }
              >
                Payroll Register &mdash; {year || "All Years"}
              </SectionHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      {[
                        "Period",
                        "Status",
                        "Emp.",
                        "Gross Pay",
                        "Net Pay",
                        "Deductions",
                        "EPF (EE)",
                        "EPF (ER)",
                        "SOCSO",
                        "PCB/MTD",
                        "HRDF",
                        "Employer Cost",
                      ].map((h, i) => (
                        <th
                          key={h}
                          className={`py-3 px-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap ${i <= 1 ? "text-left" : "text-right"}`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMonthly.length === 0 ? (
                      <tr>
                        <td
                          colSpan={12}
                          className="py-8 text-center text-gray-400 text-sm"
                        >
                          No records match your filters
                        </td>
                      </tr>
                    ) : (
                      filteredMonthly.map((m, idx) => (
                        <tr
                          key={m.period}
                          className={`border-b border-gray-50 hover:bg-gray-50/50 ${idx % 2 !== 0 ? "bg-gray-50/30" : ""}`}
                        >
                          <td className="py-2.5 px-3 font-semibold text-gray-800 whitespace-nowrap">
                            {m.monthName} {m.year}
                          </td>
                          <td className="py-2.5 px-3">
                            <StatusBadge status={m.status} />
                          </td>
                          <td className="py-2.5 px-3 text-right text-gray-600">
                            {m.employees}
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold text-gray-800">
                            {fmt(m.grossPay)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-gray-700">
                            {fmt(m.netPay)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-gray-500">
                            {fmt(m.totalDeductions)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-gray-600">
                            {fmt(m.epfEmployee)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-gray-600">
                            {fmt(m.epfEmployer)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-gray-600">
                            {fmt(
                              (m.socsoEmployee || 0) + (m.socsoEmployer || 0),
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right text-gray-600">
                            {fmt(m.pcb)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-gray-500">
                            {fmt(m.hrdf)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold text-gray-800">
                            {fmt(m.employerCost)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {filteredMonthly.length > 1 && (
                    <tfoot>
                      <tr className="bg-gray-50 border-t-2 border-gray-200 font-bold text-sm">
                        <td className="py-3 px-3 text-gray-900" colSpan={2}>
                          Grand Total
                        </td>
                        <td className="py-3 px-3 text-right text-gray-600">
                          {registerTotals.employees}
                        </td>
                        <td className="py-3 px-3 text-right text-gray-900">
                          {fmt(registerTotals.grossPay)}
                        </td>
                        <td className="py-3 px-3 text-right text-gray-900">
                          {fmt(registerTotals.netPay)}
                        </td>
                        <td className="py-3 px-3 text-right text-gray-700">
                          {fmt(registerTotals.totalDeductions)}
                        </td>
                        <td className="py-3 px-3 text-right text-gray-700">
                          {fmt(registerTotals.epfEmployee)}
                        </td>
                        <td className="py-3 px-3 text-right text-gray-700">
                          {fmt(registerTotals.epfEmployer)}
                        </td>
                        <td className="py-3 px-3 text-right text-gray-700">
                          {fmt(
                            registerTotals.socsoEmployee +
                              registerTotals.socsoEmployer,
                          )}
                        </td>
                        <td className="py-3 px-3 text-right text-gray-700">
                          {fmt(registerTotals.pcb)}
                        </td>
                        <td className="py-3 px-3 text-right text-gray-700">
                          {fmt(registerTotals.hrdf)}
                        </td>
                        <td className="py-3 px-3 text-right text-gray-900">
                          {fmt(registerTotals.employerCost)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {summaryData.payGroupBreakdown?.length > 1 && (
              <div className="rounded-xl border border-gray-200/80 shadow-md bg-white overflow-hidden">
                <SectionHeader
                  icon={Layers}
                  badge={`${summaryData.payGroupBreakdown.length} groups`}
                  info="Payroll totals grouped by pay group"
                >
                  Pay Group Summary
                </SectionHeader>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50">
                        {[
                          "Pay Group",
                          "Runs",
                          "Employees",
                          "Gross Pay",
                          "Net Pay",
                          "Employer Cost",
                        ].map((h, i) => (
                          <th
                            key={h}
                            className={`py-3 px-4 text-[10px] font-semibold text-gray-400 uppercase ${i === 0 ? "text-left" : "text-right"}`}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {summaryData.payGroupBreakdown.map((pg, idx) => (
                        <tr
                          key={pg.payGroup}
                          className={`border-b border-gray-50 hover:bg-gray-50/50 ${idx % 2 !== 0 ? "bg-gray-50/30" : ""}`}
                        >
                          <td className="py-2.5 px-4 font-semibold text-gray-800">
                            {pg.payGroup}
                          </td>
                          <td className="py-2.5 px-4 text-right text-gray-600">
                            {pg.runs}
                          </td>
                          <td className="py-2.5 px-4 text-right text-gray-600">
                            {pg.employees}
                          </td>
                          <td className="py-2.5 px-4 text-right font-semibold text-gray-800">
                            {fmt(pg.grossPay)}
                          </td>
                          <td className="py-2.5 px-4 text-right text-gray-700">
                            {fmt(pg.netPay)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-semibold text-gray-800">
                            {fmt(pg.employerCost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {summaryData.categoriesBreakdown?.length > 0 && (
              <div className="rounded-xl border border-gray-200/80 shadow-md bg-white overflow-hidden">
                <SectionHeader
                  icon={Layers}
                  badge={`${summaryData.categoriesBreakdown.length} types`}
                  info="All earning and deduction categories with totals"
                >
                  Earnings &amp; Deductions Breakdown
                </SectionHeader>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50">
                        {["#", "Type", "Name", "Total Amount"].map((h, i) => (
                          <th
                            key={h}
                            className={`py-3 px-4 text-[10px] font-semibold text-gray-400 uppercase ${i <= 2 ? "text-left" : "text-right"}`}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {summaryData.categoriesBreakdown.map((c, idx) => (
                        <tr
                          key={idx}
                          className={`border-b border-gray-50 hover:bg-gray-50/50 ${idx % 2 !== 0 ? "bg-gray-50/30" : ""}`}
                        >
                          <td className="py-2.5 px-4 text-gray-400 text-xs">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-4">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                                c.category === "earning"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {c.category === "earning"
                                ? "Earning"
                                : "Deduction"}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 font-medium text-gray-800">
                            {c.name}
                          </td>
                          <td className="py-2.5 px-4 text-right font-semibold text-gray-800">
                            {fmt(c.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: STATUTORY & TAX */}
        {activeTab === "statutory" && statutoryData && !isLoading && (
          <div className="space-y-5">
            <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <Download size={14} className="text-gray-400" />
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Download Statutory Files
                </span>
                {!month && (
                  <span className="text-[11px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                    Select a month for file downloads
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <DownloadBtn
                  onClick={() => downloadStatutoryFile("epf")}
                  label="EPF Contribution (CSV)"
                  icon={Download}
                  disabled={!month}
                />
                <DownloadBtn
                  onClick={() => downloadStatutoryFile("socso")}
                  label="SOCSO Contribution (CSV)"
                  icon={Download}
                  disabled={!month}
                />
                <DownloadBtn
                  onClick={() => downloadStatutoryFile("eis")}
                  label="EIS Contribution (CSV)"
                  icon={Download}
                  disabled={!month}
                />
                <DownloadBtn
                  onClick={downloadCP39}
                  label="CP39 / PCB (TXT)"
                  icon={FileText}
                  disabled={!month}
                />
                <DownloadBtn
                  onClick={downloadBorangEPDF}
                  label="Borang E (PDF)"
                  icon={Printer}
                  variant="primary"
                />
                <DownloadBtn
                  onClick={exportStatutoryReport}
                  label="Full Report (Excel)"
                  icon={FileSpreadsheet}
                  variant="green"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                {
                  label: "EPF Total",
                  value: fmt(
                    (statutoryData.totals?.epfEmployee || 0) +
                      (statutoryData.totals?.epfEmployer || 0),
                  ),
                  color: "bg-orange-500",
                },
                {
                  label: "SOCSO Total",
                  value: fmt(
                    (statutoryData.totals?.socsoEmployee || 0) +
                      (statutoryData.totals?.socsoEmployer || 0),
                  ),
                  color: "bg-green-500",
                },
                {
                  label: "EIS Total",
                  value: fmt(
                    (statutoryData.totals?.eisEmployee || 0) +
                      (statutoryData.totals?.eisEmployer || 0),
                  ),
                  color: "bg-yellow-500",
                },
                {
                  label: "PCB / MTD",
                  value: fmt(statutoryData.totals?.pcb || 0),
                  color: "bg-red-500",
                },
                {
                  label: "HRDF",
                  value: fmt(statutoryData.totals?.hrdf || 0),
                  color: "bg-teal-500",
                },
              ].map((s) => (
                <div
                  key={s.label}
                  className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-3.5"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                      {s.label}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-gray-800">{s.value}</p>
                </div>
              ))}
            </div>

            {statutoryData.departmentBreakdown?.length > 0 && (
              <div className="rounded-xl border border-gray-200/80 shadow-md bg-white overflow-hidden">
                <SectionHeader
                  icon={Building2}
                  badge={`${statutoryData.departmentBreakdown.length} depts`}
                  info="Statutory contribution totals per department"
                >
                  Department Statutory Summary
                </SectionHeader>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50">
                        {[
                          "Department",
                          "Headcount",
                          "EPF (EE)",
                          "EPF (ER)",
                          "SOCSO (EE)",
                          "SOCSO (ER)",
                          "EIS (EE)",
                          "EIS (ER)",
                          "PCB",
                          "HRDF",
                        ].map((h, i) => (
                          <th
                            key={h}
                            className={`py-3 px-3 text-[10px] font-semibold text-gray-400 uppercase ${i === 0 ? "text-left" : "text-right"}`}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {statutoryData.departmentBreakdown.map((d, idx) => (
                        <tr
                          key={d.department}
                          className={`border-b border-gray-50 hover:bg-gray-50/50 ${idx % 2 !== 0 ? "bg-gray-50/30" : ""}`}
                        >
                          <td className="py-2.5 px-3 font-semibold text-gray-800">
                            {d.department}
                          </td>
                          <td className="py-2.5 px-3 text-right text-gray-600">
                            {d.headcount}
                          </td>
                          <td className="py-2.5 px-3 text-right text-gray-600">
                            {fmt(d.epfEmployee)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-gray-600">
                            {fmt(d.epfEmployer)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-gray-600">
                            {fmt(d.socsoEmployee)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-gray-600">
                            {fmt(d.socsoEmployer)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-gray-600">
                            {fmt(d.eisEmployee)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-gray-600">
                            {fmt(d.eisEmployer)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-gray-600">
                            {fmt(d.pcb)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-gray-600">
                            {fmt(d.hrdf)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {statutoryData.employees?.length > 0 && (
              <div className="rounded-xl border border-gray-200/80 shadow-md bg-white overflow-hidden">
                <SectionHeader
                  icon={Users}
                  badge={`${statutoryData.employees.length} employees`}
                  info="Per-employee statutory detail. Click EA Form to download individual Borang EA PDF."
                >
                  Employee Statutory Detail
                </SectionHeader>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50">
                        {[
                          "Employee",
                          "Dept",
                          "EPF No",
                          "Tax File",
                          "EPF (EE)",
                          "EPF (ER)",
                          "SOCSO",
                          "EIS",
                          "PCB",
                          "HRDF",
                          "Gross Pay",
                          "",
                        ].map((h, i) => (
                          <th
                            key={h + i}
                            className={`py-3 px-2.5 text-[10px] font-semibold text-gray-400 uppercase ${i <= 3 ? "text-left" : "text-right"}`}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {statutoryData.employees.map((e, idx) => (
                        <tr
                          key={e.employeeId || idx}
                          className={`border-b border-gray-50 hover:bg-gray-50/50 ${idx % 2 !== 0 ? "bg-gray-50/30" : ""}`}
                        >
                          <td className="py-2.5 px-2.5 font-medium text-gray-800">
                            <div className="text-sm">{e.fullName}</div>
                            <div className="text-[11px] text-gray-400">
                              {e.employeeId}
                            </div>
                          </td>
                          <td className="py-2.5 px-2.5 text-gray-600 text-xs">
                            {e.department}
                          </td>
                          <td className="py-2.5 px-2.5 text-gray-500 text-xs font-mono">
                            {e.epfNumber || "-"}
                          </td>
                          <td className="py-2.5 px-2.5 text-gray-500 text-xs font-mono">
                            {e.taxFileNumber || "-"}
                          </td>
                          <td className="py-2.5 px-2.5 text-right text-gray-600">
                            {fmt(e.epfEmployee)}
                          </td>
                          <td className="py-2.5 px-2.5 text-right text-gray-600">
                            {fmt(e.epfEmployer)}
                          </td>
                          <td className="py-2.5 px-2.5 text-right text-gray-600">
                            {fmt(
                              (e.socsoEmployee || 0) + (e.socsoEmployer || 0),
                            )}
                          </td>
                          <td className="py-2.5 px-2.5 text-right text-gray-600">
                            {fmt((e.eisEmployee || 0) + (e.eisEmployer || 0))}
                          </td>
                          <td className="py-2.5 px-2.5 text-right text-gray-600">
                            {fmt(e.pcb)}
                          </td>
                          <td className="py-2.5 px-2.5 text-right text-gray-500">
                            {fmt(e.hrdf)}
                          </td>
                          <td className="py-2.5 px-2.5 text-right font-semibold text-gray-800">
                            {fmt(e.grossPay)}
                          </td>
                          <td className="py-2.5 px-2.5 text-right">
                            <button
                              onClick={() =>
                                downloadEAFormPDF(
                                  e.employeeObjId || e.employeeId,
                                )
                              }
                              className="text-[11px] font-medium text-[var(--p-blue)] hover:underline whitespace-nowrap"
                              title="Download EA Form PDF"
                            >
                              EA Form
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {statutoryData.employees.length > 1 && (
                      <tfoot>
                        <tr className="bg-gray-50 border-t-2 border-gray-200 font-bold text-sm">
                          <td className="py-3 px-2.5 text-gray-900" colSpan={4}>
                            Grand Total ({statutoryData.totalEmployees}{" "}
                            employees)
                          </td>
                          <td className="py-3 px-2.5 text-right text-gray-900">
                            {fmt(statutoryData.totals?.epfEmployee)}
                          </td>
                          <td className="py-3 px-2.5 text-right text-gray-900">
                            {fmt(statutoryData.totals?.epfEmployer)}
                          </td>
                          <td className="py-3 px-2.5 text-right text-gray-900">
                            {fmt(
                              (statutoryData.totals?.socsoEmployee || 0) +
                                (statutoryData.totals?.socsoEmployer || 0),
                            )}
                          </td>
                          <td className="py-3 px-2.5 text-right text-gray-900">
                            {fmt(
                              (statutoryData.totals?.eisEmployee || 0) +
                                (statutoryData.totals?.eisEmployer || 0),
                            )}
                          </td>
                          <td className="py-3 px-2.5 text-right text-gray-900">
                            {fmt(statutoryData.totals?.pcb)}
                          </td>
                          <td className="py-3 px-2.5 text-right text-gray-900">
                            {fmt(statutoryData.totals?.hrdf)}
                          </td>
                          <td className="py-3 px-2.5 text-right text-gray-900">
                            {fmt(statutoryData.totals?.grossPay)}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: COST CENTER */}
        {activeTab === "costcenter" && departmentData && !isLoading && (
          <div className="space-y-5">
            {departmentData.departments?.length > 0 ? (
              <div className="rounded-xl border border-gray-200/80 shadow-md bg-white overflow-hidden">
                <SectionHeader
                  icon={Building2}
                  badge={`${departmentData.departments.length} departments`}
                  info="Department-level cost breakdown. Click a row to expand employee details."
                  actions={
                    <DownloadBtn
                      onClick={exportCostCenter}
                      label="Export Excel"
                      icon={FileSpreadsheet}
                      variant="green"
                      small
                    />
                  }
                >
                  Cost Center Report &mdash; {year || "All Years"}
                </SectionHeader>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50">
                        {[
                          "",
                          "Department",
                          "Headcount",
                          "Gross Pay",
                          "Net Pay",
                          "EPF (EE+ER)",
                          "SOCSO (EE+ER)",
                          "PCB/MTD",
                          "OT",
                          "Employer Cost",
                        ].map((h, i) => (
                          <th
                            key={h + i}
                            className={`py-3 px-3 text-[10px] font-semibold text-gray-400 uppercase ${i <= 1 ? "text-left" : "text-right"}`}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {departmentData.departments.map((dept, idx) => {
                        const isExpanded = expandedDepts[dept.department];
                        return (
                          <React.Fragment key={dept.department}>
                            <tr
                              className={`border-b border-gray-100 hover:bg-gray-50/50 cursor-pointer ${idx % 2 !== 0 ? "bg-gray-50/30" : ""}`}
                              onClick={() =>
                                setExpandedDepts((prev) => ({
                                  ...prev,
                                  [dept.department]: !prev[dept.department],
                                }))
                              }
                            >
                              <td className="py-2.5 px-3 w-8">
                                {isExpanded ? (
                                  <ChevronDown
                                    size={14}
                                    className="text-gray-400"
                                  />
                                ) : (
                                  <ChevronRight
                                    size={14}
                                    className="text-gray-400"
                                  />
                                )}
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-gray-800">
                                {dept.department}
                              </td>
                              <td className="py-2.5 px-3 text-right text-gray-600">
                                {dept.headcount}
                              </td>
                              <td className="py-2.5 px-3 text-right font-semibold text-gray-800">
                                {fmt(dept.grossPay)}
                              </td>
                              <td className="py-2.5 px-3 text-right text-gray-700">
                                {fmt(dept.netPay)}
                              </td>
                              <td className="py-2.5 px-3 text-right text-gray-600">
                                {fmt(
                                  (dept.epfEmployee || 0) +
                                    (dept.epfEmployer || 0),
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right text-gray-600">
                                {fmt(
                                  (dept.socsoEmployee || 0) +
                                    (dept.socsoEmployer || 0),
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right text-gray-600">
                                {fmt(dept.pcb || 0)}
                              </td>
                              <td className="py-2.5 px-3 text-right text-gray-600">
                                {fmt(dept.overtimePay || 0)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-semibold text-gray-800">
                                {fmt(dept.employerCost)}
                              </td>
                            </tr>
                            {isExpanded &&
                              dept.employees?.map((emp, eIdx) => (
                                <tr
                                  key={emp.employeeId || eIdx}
                                  className="bg-blue-50/30 border-b border-gray-50"
                                >
                                  <td className="py-2 px-3"></td>
                                  <td className="py-2 px-3 pl-8">
                                    <div className="text-sm text-gray-700">
                                      {emp.fullName}
                                    </div>
                                    <div className="text-[11px] text-gray-400">
                                      {emp.position} &middot; {emp.employeeId}
                                    </div>
                                  </td>
                                  <td className="py-2 px-3"></td>
                                  <td className="py-2 px-3 text-right text-gray-700">
                                    {fmt(emp.grossPay)}
                                  </td>
                                  <td className="py-2 px-3 text-right text-gray-600">
                                    {fmt(emp.netPay)}
                                  </td>
                                  <td className="py-2 px-3 text-right text-gray-500">
                                    {fmt(
                                      (emp.epfEmployee || 0) +
                                        (emp.epfEmployer || 0),
                                    )}
                                  </td>
                                  <td className="py-2 px-3 text-right text-gray-500">
                                    {fmt(
                                      (emp.socsoEmployee || 0) +
                                        (emp.socsoEmployer || 0),
                                    )}
                                  </td>
                                  <td className="py-2 px-3 text-right text-gray-500">
                                    {fmt(emp.pcb || 0)}
                                  </td>
                                  <td className="py-2 px-3 text-right text-gray-500">
                                    {fmt(emp.overtimePay || 0)}
                                  </td>
                                  <td className="py-2 px-3 text-right text-gray-700">
                                    {fmt(emp.employerCost || 0)}
                                  </td>
                                </tr>
                              ))}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 border-t-2 border-gray-200 font-bold text-sm">
                        <td></td>
                        <td className="py-3 px-3 text-gray-900">Total</td>
                        <td className="py-3 px-3 text-right text-gray-600">
                          {departmentData.departments.reduce(
                            (s, d) => s + (d.headcount || 0),
                            0,
                          )}
                        </td>
                        <td className="py-3 px-3 text-right text-gray-900">
                          {fmt(
                            departmentData.departments.reduce(
                              (s, d) => s + (d.grossPay || 0),
                              0,
                            ),
                          )}
                        </td>
                        <td className="py-3 px-3 text-right text-gray-900">
                          {fmt(
                            departmentData.departments.reduce(
                              (s, d) => s + (d.netPay || 0),
                              0,
                            ),
                          )}
                        </td>
                        <td className="py-3 px-3 text-right text-gray-700">
                          {fmt(
                            departmentData.departments.reduce(
                              (s, d) =>
                                s + (d.epfEmployee || 0) + (d.epfEmployer || 0),
                              0,
                            ),
                          )}
                        </td>
                        <td className="py-3 px-3 text-right text-gray-700">
                          {fmt(
                            departmentData.departments.reduce(
                              (s, d) =>
                                s +
                                (d.socsoEmployee || 0) +
                                (d.socsoEmployer || 0),
                              0,
                            ),
                          )}
                        </td>
                        <td className="py-3 px-3 text-right text-gray-700">
                          {fmt(
                            departmentData.departments.reduce(
                              (s, d) => s + (d.pcb || 0),
                              0,
                            ),
                          )}
                        </td>
                        <td className="py-3 px-3 text-right text-gray-700">
                          {fmt(
                            departmentData.departments.reduce(
                              (s, d) => s + (d.overtimePay || 0),
                              0,
                            ),
                          )}
                        </td>
                        <td className="py-3 px-3 text-right text-gray-900">
                          {fmt(
                            departmentData.departments.reduce(
                              (s, d) => s + (d.employerCost || 0),
                              0,
                            ),
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-gray-200/80 shadow-md bg-white p-12 text-center">
                <Building2 size={32} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-400 text-sm">
                  No department data available for the selected filters
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: EMPLOYEE REPORTS */}
        {activeTab === "employee" && summaryData && !isLoading && (
          <div className="space-y-5">
            <div className="rounded-xl border border-gray-200/80 shadow-md bg-white overflow-hidden">
              <SectionHeader
                icon={Users}
                badge={`${filteredEmployees.length} of ${summaryData.employeeBreakdown?.length || 0}`}
                info="Search by name, ID, or department. Click a row to expand monthly payroll detail."
                actions={
                  <DownloadBtn
                    onClick={exportEmployeeReport}
                    label="Export All"
                    icon={FileSpreadsheet}
                    variant="green"
                    small
                  />
                }
              >
                Employee Payroll Report &mdash; {year || "All Years"}
              </SectionHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      {[
                        "",
                        "Employee",
                        "Department",
                        "Position",
                        "Months",
                        "Gross Pay",
                        "Net Pay",
                        "EPF (EE+ER)",
                        "PCB",
                        "Employer Cost",
                        "EA Form",
                      ].map((h, i) => (
                        <th
                          key={h + i}
                          className={`py-3 px-3 text-[10px] font-semibold text-gray-400 uppercase ${i <= 3 ? "text-left" : "text-right"}`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.length === 0 ? (
                      <tr>
                        <td
                          colSpan={11}
                          className="py-8 text-center text-gray-400 text-sm"
                        >
                          {searchQuery
                            ? "No employees match your search"
                            : "No employee data"}
                        </td>
                      </tr>
                    ) : (
                      filteredEmployees.map((e, idx) => {
                        const isExpanded =
                          expandedEmployee === (e.employeeId || idx);
                        return (
                          <React.Fragment key={e.employeeId || idx}>
                            <tr
                              className={`border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer ${idx % 2 !== 0 ? "bg-gray-50/30" : ""}`}
                              onClick={() =>
                                setExpandedEmployee(
                                  isExpanded ? null : e.employeeId || idx,
                                )
                              }
                            >
                              <td className="py-2.5 px-3 w-8">
                                {isExpanded ? (
                                  <ChevronDown
                                    size={14}
                                    className="text-gray-400"
                                  />
                                ) : (
                                  <ChevronRight
                                    size={14}
                                    className="text-gray-400"
                                  />
                                )}
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-gray-800">
                                <div>{e.fullName}</div>
                                <div className="text-[11px] text-gray-400">
                                  {e.employeeId}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-gray-600 text-xs">
                                {e.department}
                              </td>
                              <td className="py-2.5 px-3 text-gray-600 text-xs">
                                {e.position}
                              </td>
                              <td className="py-2.5 px-3 text-right text-gray-600">
                                {e.months}
                              </td>
                              <td className="py-2.5 px-3 text-right font-semibold text-gray-800">
                                {fmt(e.grossPay)}
                              </td>
                              <td className="py-2.5 px-3 text-right text-gray-700">
                                {fmt(e.netPay)}
                              </td>
                              <td className="py-2.5 px-3 text-right text-gray-600">
                                {fmt(
                                  (e.epfEmployee || 0) + (e.epfEmployer || 0),
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right text-gray-600">
                                {fmt(e.pcb)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-semibold text-gray-800">
                                {fmt(e.employerCost)}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <button
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    downloadEAFormPDF(
                                      e.employeeObjId || e.employeeId,
                                    );
                                  }}
                                  className="inline-flex items-center gap-1 text-xs font-medium text-[var(--p-blue)] hover:underline"
                                >
                                  <Printer size={12} /> EA Form PDF
                                </button>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr className="bg-blue-50/20">
                                <td colSpan={11} className="p-0">
                                  <div className="px-8 py-4">
                                    <div className="flex items-center justify-between mb-3">
                                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        Monthly Breakdown &mdash; {e.fullName}
                                      </h4>
                                      <button
                                        onClick={(ev) => {
                                          ev.stopPropagation();
                                          downloadEAFormPDF(
                                            e.employeeObjId || e.employeeId,
                                          );
                                        }}
                                        className="text-xs font-medium text-[var(--p-blue)] hover:underline flex items-center gap-1"
                                      >
                                        <Printer size={12} /> EA Form PDF
                                      </button>
                                    </div>
                                    {e.monthlyDetail?.length > 0 ? (
                                      <table className="w-full text-xs">
                                        <thead>
                                          <tr className="border-b border-gray-200">
                                            {[
                                              "Month",
                                              "Basic",
                                              "Earnings",
                                              "OT",
                                              "Gross",
                                              "EPF(EE)",
                                              "EPF(ER)",
                                              "SOCSO",
                                              "PCB",
                                              "Net Pay",
                                            ].map((h, i) => (
                                              <th
                                                key={h}
                                                className={`py-2 px-2 font-semibold text-gray-400 ${i === 0 ? "text-left" : "text-right"}`}
                                              >
                                                {h}
                                              </th>
                                            ))}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {e.monthlyDetail.map((md) => (
                                            <tr
                                              key={md.month}
                                              className="border-b border-gray-100"
                                            >
                                              <td className="py-1.5 px-2 text-gray-700">
                                                {MONTH_NAMES[md.month]}
                                              </td>
                                              <td className="py-1.5 px-2 text-right text-gray-600">
                                                {fmt(md.basicSalary)}
                                              </td>
                                              <td className="py-1.5 px-2 text-right text-gray-600">
                                                {fmt(md.totalEarnings)}
                                              </td>
                                              <td className="py-1.5 px-2 text-right text-gray-600">
                                                {fmt(md.overtimePay)}
                                              </td>
                                              <td className="py-1.5 px-2 text-right font-semibold text-gray-800">
                                                {fmt(md.grossPay)}
                                              </td>
                                              <td className="py-1.5 px-2 text-right text-gray-600">
                                                {fmt(md.epfEmployee)}
                                              </td>
                                              <td className="py-1.5 px-2 text-right text-gray-600">
                                                {fmt(md.epfEmployer)}
                                              </td>
                                              <td className="py-1.5 px-2 text-right text-gray-600">
                                                {fmt(
                                                  (md.socsoEmployee || 0) +
                                                    (md.socsoEmployer || 0),
                                                )}
                                              </td>
                                              <td className="py-1.5 px-2 text-right text-gray-600">
                                                {fmt(md.pcb)}
                                              </td>
                                              <td className="py-1.5 px-2 text-right font-semibold text-gray-800">
                                                {fmt(md.netPay)}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    ) : (
                                      <p className="text-xs text-gray-400 italic">
                                        Monthly detail not available. Use the
                                        Statutory tab for per-employee
                                        breakdown.
                                      </p>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {!selectedBusiness && !isLoading && (
          <div className="rounded-xl border border-gray-200/80 shadow-md bg-white p-12 text-center">
            <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 inline-block">
              Please select a business to view reports.
            </p>
          </div>
        )}
      </div>
    </Page>
  );
};

export default PayrollReports;
