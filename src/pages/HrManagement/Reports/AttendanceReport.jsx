import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { Download, FileText, Search, RefreshCw, Eye } from "lucide-react";
import {
  DataTable,
  InputField,
  DropdownBasic,
  FormInput,
} from "@/page-layouts/index";
import { formatDate } from "@/components/formatAmount";
import { AdminContext } from "@/context/AdminContext";
import BusinessDropdown from "@/page-layouts/components/helpers/BusinessDropdown";
import SingleBusinessField from "@/components/SingleBusinessField";
import { useContext } from "react";
import {
  applyPaginationFromResponse,
  getAttendanceInOutDisplay,
  getAttendanceStatusColor,
  readConfiguredPageSize,
  staffDeptPositionShift,
} from "./hrReportHelpers";
import { ReportNameCell, ReportTextCell } from "./ReportTableCells";
import { notifyError, notifySuccess } from "@/utils/toast";
import { exportAttendanceReport } from "./hrReportExport";
import AttendanceReportDetailModal from "./AttendanceReportDetailModal";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const statusColors = {
  Present: "text-green-500",
  Absent: "text-red-500",
  Late: "text-yellow-500",
  // Add more as needed
};

const AttendanceReport = () => {
  const { t } = useTranslation();

  const attendanceColWidths = useMemo(
    () => ({
      [t("hrReports.common.name")]: "148px",
      [t("hrReports.common.department")]: "112px",
      [t("hrReports.common.position")]: "104px",
      [t("hrReports.common.shift")]: "100px",
      [t("hrReports.common.date")]: "88px",
      [t("hrReports.common.in")]: "72px",
      [t("hrReports.common.out")]: "72px",
      [t("hrReports.common.totalHours")]: "100px",
      [t("hrReports.common.overtime")]: "88px",
      [t("hrReports.common.status")]: "100px",
      [t("hrReports.common.action")]: "96px",
    }),
    [t]
  );
  const [detailRecord, setDetailRecord] = useState(null);
  const { state } = useContext(AdminContext);
  const { adminInfo } = state || {};
  // Filters
  const [searchParams, setSearchParams] = useState({
    name: "",
    department: "",
    position: "",
    startDate: "",
    endDate: "",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);

  // Data
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit, setLimit] = useState(() => readConfiguredPageSize(10));
  const [total, setTotal] = useState(0);
  const [selectedBusiness, setSelectedBusiness] = useState("");
  const [resetKey, setResetKey] = useState(0);
  const [exporting, setExporting] = useState(false);
  const fetchAbortRef = useRef(null);

  // Fetch departments and positions for dropdowns
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const params = selectedBusiness ? { business_id: selectedBusiness } : {};
        const response = await axios.get(`${Base_URL}/Departments/get`, { params });
        setDepartments(response.data.data || []);
      } catch (err) {
        setDepartments([]);
      }
    };
    const fetchPositions = async () => {
      try {
        const params = selectedBusiness ? { business_id: selectedBusiness } : {};
        const response = await axios.get(`${Base_URL}/Positions/get`, { params });
        setPositions(response.data.data || []);
      } catch (err) {
        setPositions([]);
      }
    };
    fetchDepartments();
    fetchPositions();
  }, [selectedBusiness]);

  // Fetch data
  const fetchData = async (page = 1, perPage = limit) => {
    if (fetchAbortRef.current) {
      fetchAbortRef.current.abort();
    }
    const controller = new AbortController();
    fetchAbortRef.current = controller;

    setLoading(true);
    try {
      const params = {
        page,
        limit: perPage,
        name: searchParams.name,
        department: searchParams.department,
        position: searchParams.position,
        startDate: searchParams.startDate,
        endDate: searchParams.endDate,
        status: searchParams.status,
        business: selectedBusiness,
      };

      const res = await axios.get(`${Base_URL}/attendance/report`, {
        params,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;

      setRecords(res.data.data || []);
      applyPaginationFromResponse({
        res,
        setCurrentPage,
        setTotalPages,
        setTotal,
        fallbackLimit: perPage,
      });
    } catch (err) {
      if (err?.code === "ERR_CANCELED" || err?.name === "CanceledError") {
        return;
      }
      console.error("API Error:", err);
      setRecords([]);
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchData(currentPage, limit);
    // eslint-disable-next-line
  }, [currentPage, limit, selectedBusiness]);

  useEffect(() => {
    return () => {
      fetchAbortRef.current?.abort();
    };
  }, []);

  const handleSearch = () => {
    if (currentPage === 1) {
      fetchData(1, limit);
    } else {
      setCurrentPage(1);
    }
  };

  const handleReset = () => {
    setSearchParams({
      name: "",
      department: "",
      position: "",
      startDate: "",
      endDate: "",
      status: "",
    });
    setResetKey((prev) => prev + 1); // Force FormInput to re-render
    setCurrentPage(1);
    fetchData(1, limit);
  };

  const handleDownload = async (type) => {
    if (exporting) return;
    setExporting(true);
    try {
      const count = await exportAttendanceReport({
        format: type,
        searchParams,
        selectedBusiness,
        adminId: adminInfo?.id,
        t,
      });
      notifySuccess(`Exported ${count} record(s)`);
    } catch (err) {
      notifyError(err?.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  // Filtered records for table search (search bar in DataTable)
  const filteredRecords = records.filter((rec) => {
    const q = searchQuery.toLowerCase();
    return (
      (rec.staff?.displayName || "").toLowerCase().includes(q) ||
      (rec.staff?.department || "").toLowerCase().includes(q) ||
      (rec.staff?.position || "").toLowerCase().includes(q) ||
      (rec.status || "").toLowerCase().includes(q)
    );
  });

  // Unique department/position options
  const departmentOptions = [
    { value: "", label: t("hrReports.common.searchByDepartment") },
    ...[...new Set(departments.map((d) => d.name))].map((name) => ({
      value: name,
      label: name,
    })),
  ];
  const positionOptions = [
    { value: "", label: t("hrReports.common.searchByPosition") },
    ...[...new Set(positions.map((p) => p.name))].map((name) => ({
      value: name,
      label: name,
    })),
  ];

  return (
    <div className="p-6 bg-white min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <h2 className="text-xl font-semibold text-gray-900">
          {t("hrReports.attendanceReport.title")}
        </h2>
        <div className="flex gap-2">
          <button
            disabled={exporting}
            className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
            onClick={() => handleDownload("excel")}
          >
            <Download className="w-4 h-4" /> {t("hrReports.common.downloadExcel")}
          </button>
          <button
            disabled={exporting}
            className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
            onClick={() => handleDownload("pdf")}
          >
            <FileText className="w-4 h-4" /> {t("hrReports.common.downloadPDF")}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <SingleBusinessField
          selectedValue={selectedBusiness}
          onAutoSelect={setSelectedBusiness}
        >
          <BusinessDropdown
            adminId={adminInfo?.id}
            selectedBusiness={selectedBusiness}
            onChange={setSelectedBusiness}
            isClearable={true}
            placeholder="Select Business"
          />
        </SingleBusinessField>
        <div className="relative">
          <InputField
            type="text"
            name="name"
            value={searchParams.name || ""}
            placeholder={t("hrReports.common.searchByNameIc")}
            className="pl-10 text-sm"
            onChange={(e) =>
              setSearchParams((prev) => ({ ...prev, name: e.target.value }))
            }
          />
          <svg
            className="w-5 h-5 absolute left-[0.8rem] top-[0.675rem] text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            ></path>
          </svg>
        </div>
        <DropdownBasic
          placeholder={t("hrReports.common.searchByDepartment")}
          name="department"
          value={searchParams.department || ""}
          onChange={(val) =>
            setSearchParams((prev) => ({ ...prev, department: val }))
          }
          options={departmentOptions}
          className="text-sm"
        />
        <DropdownBasic
          placeholder={t("hrReports.common.searchByPosition")}
          name="position"
          value={searchParams.position || ""}
          onChange={(val) =>
            setSearchParams((prev) => ({ ...prev, position: val }))
          }
          options={positionOptions}
          className="text-sm"
        />
        <DropdownBasic
          placeholder={t("hrReports.common.searchByStatus")}
          name="status"
          value={searchParams.status || ""}
          onChange={(val) =>
            setSearchParams((prev) => ({ ...prev, status: val }))
          }
          options={[
            { value: "", label: t("hrReports.common.allStatuses") },
            { value: "Present", label: t("hrReports.common.present") },
            { value: "Absent", label: t("hrReports.common.absent") },
            { value: "Leave", label: t("hrReports.common.leave") },
          ]}
          className="text-sm w-full"
        />
        {/* <input
          type="text"
          placeholder="Search by Shift"
          className="border border-gray-200 rounded-lg px-4 py-2 text-sm w-full"
          value={searchParams.shift || ""}
          onChange={(e) => setSearchParams((prev) => ({ ...prev, shift: e.target.value }))}
        /> */}
        <FormInput
          key={resetKey} // Force re-render when reset happens
          //   label="Date Range"
          //   direction="column"
          type="date-range"
          initialStartDate={searchParams.startDate}
          initialEndDate={searchParams.endDate}
          onChange={(value) => {
            setSearchParams((prev) => ({
              ...prev,
              startDate: value.startDate,
              endDate: value.endDate,
            }));
          }}
          marginLeft="-44px"
        />
        <div className="flex gap-4">
          <button
            onClick={handleSearch}
            className="bg-[var(--p-blue)] text-white flex items-center justify-center px-4 py-1 rounded-lg text-sm"
          >
            <Search className="mr-2" size={16} />
            {t("hrReports.common.search")}
          </button>
          <button
            onClick={handleReset}
            className="bg-gray-800 w-max text-white p-3 rounded-lg flex items-center justify-center"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>
      {/* Table */}
      <DataTable
        skipAutoPageSizeFromConfig
        isCollapsible={false}
        skipDynamicColumnWidths
        actionColumnHeaderLabel={t("hrReports.common.action")}
        headers={[
          t("hrReports.common.name"),
          t("hrReports.common.department"),
          t("hrReports.common.position"),
          t("hrReports.common.shift"),
          t("hrReports.common.date"),
          t("hrReports.common.in"),
          t("hrReports.common.out"),
          t("hrReports.common.totalHours"),
          t("hrReports.common.overtime"),
          t("hrReports.common.status"),
          t("hrReports.common.action"),
        ]}
        data={filteredRecords}
        searchValue={searchQuery}
        onSearch={setSearchQuery}
        searchPlaceholder={t("hrReports.common.search")}
        totalPages={totalPages}
        colWidths={attendanceColWidths}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        recordsPerPage={limit}
        onRecordsPerPageChange={setLimit}
        loading={loading}
        renderRow={(rec) => {
          const status = rec.status;
          const statusColor = getAttendanceStatusColor(status);
          const { inValue, outValue } = getAttendanceInOutDisplay(rec);
          const { department, position, shift } = staffDeptPositionShift(rec.staff);

          return (
            <tr key={rec._id} className="border-b hover:bg-gray-50">
              <ReportNameCell
                image={rec.staff?.image}
                name={rec.staff?.displayName}
                alt={rec.staff?.displayName}
              />
              <ReportTextCell>{department}</ReportTextCell>
              <ReportTextCell>{position}</ReportTextCell>
              <ReportTextCell>{shift}</ReportTextCell>
              <ReportTextCell>
                {rec.date ? formatDate(rec.date) : "-"}
              </ReportTextCell>
              <ReportTextCell compact>{inValue}</ReportTextCell>
              <ReportTextCell compact>{outValue}</ReportTextCell>
              <ReportTextCell compact>{rec.totalHours || "-"}</ReportTextCell>
              <ReportTextCell compact>{rec.overTime || "-"}</ReportTextCell>
              <td className="px-4 py-3 max-w-0">
                <span
                  className={`px-3 py-1 rounded-full font-semibold ${statusColor}`}
                >
                  {status || t("hrReports.common.noRecord")}
                </span>
              </td>
              <td className="px-2 py-3 text-center whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => setDetailRecord(rec)}
                  className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-[var(--p-blue)] shrink-0"
                  title={t("hrReports.common.recordDetails")}
                  aria-label={t("hrReports.common.recordDetails")}
                >
                  <Eye className="w-5 h-5" />
                </button>
              </td>
            </tr>
          );
        }}
      />
      {detailRecord && (
        <AttendanceReportDetailModal
          record={detailRecord}
          onClose={() => setDetailRecord(null)}
        />
      )}
    </div>
  );
};

export default AttendanceReport;
