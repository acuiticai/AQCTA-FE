import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { Download, FileText, Search, RefreshCw } from "lucide-react";
import {
  DataTable,
  InputField,
  DropdownBasic,
  FormInput,
} from "@/page-layouts/index";
import { AdminContext } from "@/context/AdminContext";
import BusinessDropdown from "@/page-layouts/components/helpers/BusinessDropdown";
import SingleBusinessField from "@/components/SingleBusinessField";
import { useContext } from "react";
import {
  applyPaginationFromResponse,
  getHrReportStaffColWidths,
  readConfiguredPageSize,
} from "./hrReportHelpers";
import { ReportNameCell, ReportTextCell } from "./ReportTableCells";
import { notifyError, notifySuccess } from "@/utils/toast";
import { exportLeaveUtilizationReport } from "./hrReportExport";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const LeaveUtilizationReport = () => {
  const { t } = useTranslation();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state || {};
  // Filters
  const [searchParams, setSearchParams] = useState({
    name: "",
    department: "",
    position: "",
    business: "",
    leaveGroup: "",
  });
  const [selectedBusiness, setSelectedBusiness] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  const [leaveGroups, setLeaveGroups] = useState([]);

  // Data
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit, setLimit] = useState(() => readConfiguredPageSize(10));
  const [total, setTotal] = useState(0);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [resetKey, setResetKey] = useState(0);
  const [exporting, setExporting] = useState(false);
  const fetchAbortRef = useRef(null);

  // Admin info is obtained from AdminContext; local state removed.

  // Removed local adminInfo loading as we use AdminContext

  // Fetch leave groups based on business selection
  const fetchLeaveGroups = async () => {
    if (!selectedBusiness) {
      setLeaveGroups([]);
      return;
    }

    try {
      const payload = {
        business_id: selectedBusiness,
        FilterStatus: "",
        FilterName: "",
      };

      const response = await axios.post(
        `${Base_URL}/LeaveGroups/get_all`,
        payload
      );
      setLeaveGroups(response.data.data || []);
    } catch (error) {
      console.error("Error fetching leave groups:", error);
      setLeaveGroups([]);
    }
  };

  useEffect(() => {
    fetchLeaveGroups();
  }, [selectedBusiness]);

  // Fetch departments and positions based on business selection
  const fetchDepartments = async () => {
    if (!searchParams.business || searchParams.business === t("hrAnalytics.selectBusiness")) {
      setDepartments([]);
      return;
    }

    try {
      const response = await axios.get(`${Base_URL}/Departments/get`, {
        params: { business: selectedBusiness },
      });
      setDepartments(response.data.data || []);
    } catch (err) {
      console.error("Error fetching departments:", err);
      setDepartments([]);
    }
  };

  const fetchPositions = async () => {
    if (!searchParams.business || searchParams.business === t("hrAnalytics.selectBusiness")) {
      setPositions([]);
      return;
    }

    try {
      const response = await axios.post(`${Base_URL}/Positions/get_all`, {
        params: { business: selectedBusiness },
      });
      setPositions(response.data.data || []);
    } catch (err) {
      console.error("Error fetching positions:", err);
      setPositions([]);
    }
  };

  useEffect(() => {
    fetchDepartments();
    fetchPositions();
  }, [selectedBusiness]);

  // Clear data when business or leave group is unselected
  useEffect(() => {
    if (!selectedBusiness || !searchParams.leaveGroup) {
      setRecords([]);
      setLeaveTypes([]);
      setCurrentPage(1);
      setTotalPages(1);
      setTotal(0);
    }
  }, [selectedBusiness, searchParams.leaveGroup]);

  // Fetch data
  const fetchData = async (page = 1, perPage = limit) => {
    if (!searchParams.leaveGroup) {
      setRecords([]);
      return;
    }

    if (fetchAbortRef.current) fetchAbortRef.current.abort();
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
        leaveGroup: searchParams.leaveGroup,
        business: selectedBusiness,
      };

      const res = await axios.get(`${Base_URL}/leaves/utilization-report`, {
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
      setLeaveTypes(res.data.leaveTypes || []);
    } catch (err) {
      if (err?.code === "ERR_CANCELED" || err?.name === "CanceledError") return;
      console.error("API Error:", err);
      setRecords([]);
      setLeaveTypes([]);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  // Remove auto-fetch on pagination - only fetch when user clicks search
  // useEffect(() => {
  //   if (searchParams.leaveGroup) {
  //     fetchData(currentPage, limit);
  //   }
  //   // eslint-disable-next-line
  // }, [currentPage, limit]);

  const handleSearch = () => {
    if (selectedBusiness && searchParams.leaveGroup) {
      setCurrentPage(1);
      fetchData(1, limit);
    }
  };

  const handleReset = () => {
    setSelectedBusiness("");
    setSearchParams({
      name: "",
      department: "",
      position: "",
      leaveGroup: "",
    });
    setResetKey((prev) => prev + 1);
    setCurrentPage(1);
    setRecords([]);
    setLeaveTypes([]);
    setDepartments([]);
    setPositions([]);
  };

  const handleDownload = async (type) => {
    if (exporting) return;
    setExporting(true);
    try {
      const leaveGroupLabel = leaveGroups.find(
        (g) => g._id === searchParams.leaveGroup
      )?.name;
      const count = await exportLeaveUtilizationReport({
        format: type,
        searchParams,
        selectedBusiness,
        adminId: adminInfo?.id,
        t,
        leaveGroupLabel,
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
      (rec.name || "").toLowerCase().includes(q) ||
      (rec.department || "").toLowerCase().includes(q) ||
      (rec.position || "").toLowerCase().includes(q)
    );
  });

  // Unique department/position options
  const departmentOptions = [
    { value: "", label: t("hrReports.common.searchByDepartment") },
    ...departments.map((dept) => ({ value: dept._id, label: dept.name })),
  ];
  const positionOptions = [
    { value: "", label: t("hrReports.common.searchByPosition") },
    ...positions.map((pos) => ({ value: pos._id, label: pos.name })),
  ];

  const businessOptions = [{ value: "", label: t("hrAnalytics.selectBusiness") }];

  const leaveGroupOptions = [
    { value: "", label: t("hrReports.common.selectLeaveGroup") },
    ...leaveGroups.map((group) => ({ value: group._id, label: group.name })),
  ];

  // Dynamic headers based on leave types
  const getTableHeaders = () => {
    const baseHeaders = [
      t("hrReports.common.name"),
      t("hrReports.common.department"),
      t("hrReports.common.position"),
    ];
    const leaveTypeHeaders = leaveTypes.map((lt) => lt.name);
    return [...baseHeaders, ...leaveTypeHeaders];
  };

  // Dynamic column widths
  const getColumnWidths = () => {
    const leaveTypeWidths = {};
    leaveTypes.forEach((lt) => {
      leaveTypeWidths[lt.name] = "88px";
    });
    return { ...getHrReportStaffColWidths(t), ...leaveTypeWidths };
  };

  return (
    <div className="p-6 bg-white min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <h2 className="text-xl font-semibold text-gray-900">
          {t("hrReports.leaveUtilizationReport.title")}
        </h2>
        <div className="flex gap-2">
          <button
            className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
            onClick={() => handleDownload("excel")}
          >
            <Download className="w-4 h-4" /> {t("hrReports.common.downloadExcel")}
          </button>
          <button
            className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
            onClick={() => handleDownload("pdf")}
          >
            <FileText className="w-4 h-4" /> {t("hrReports.common.downloadPDF")}
          </button>
        </div>
      </div>

      {/* Business and Leave Group Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <SingleBusinessField
          selectedValue={selectedBusiness}
          onAutoSelect={(val) => {
            setSelectedBusiness(val);
            setSearchParams((prev) => ({
              ...prev,
              leaveGroup: "",
            }));
          }}
        >
          <label className="block text-gray-500 mb-1">{t("hrAnalytics.business")}</label>
          <div className="relative">
            <BusinessDropdown
              adminId={adminInfo?.id}
              selectedBusiness={selectedBusiness}
              onChange={(val) => {
                setSelectedBusiness(val);
                setSearchParams((prev) => ({
                  ...prev,
                  leaveGroup: "", // Reset leave group when business changes
                }));
              }}
              isClearable={true}
              placeholder={t("hrAnalytics.selectBusiness")}
            />
          </div>
        </SingleBusinessField>
        <div>
          <label className="block text-gray-500 mb-1">{t("hrReports.common.leaveGroup")}</label>
          <div className="relative">
            <DropdownBasic
              name="leaveGroup"
              type="select"
              options={leaveGroupOptions}
              value={searchParams.leaveGroup || ""}
              onChange={(val) =>
                setSearchParams((prev) => ({ ...prev, leaveGroup: val }))
              }
              placeholder={t("hrReports.common.selectLeaveGroup")}
              disabled={!selectedBusiness}
            />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
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
        <div className="flex gap-4">
          <button
            onClick={handleSearch}
            className="bg-[var(--p-blue)] text-white flex items-center justify-center px-4 py-1 rounded-lg text-sm"
            disabled={!selectedBusiness || !searchParams.leaveGroup}
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
      {selectedBusiness && searchParams.leaveGroup ? (
        <DataTable
          skipAutoPageSizeFromConfig
          isCollapsible={false}
          skipDynamicColumnWidths
          headers={getTableHeaders()}
          data={filteredRecords}
          searchValue={searchQuery}
          onSearch={setSearchQuery}
          searchPlaceholder={t("hrReports.common.search")}
          totalPages={totalPages}
          colWidths={getColumnWidths()}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          recordsPerPage={limit}
          onRecordsPerPageChange={setLimit}
          loading={loading}
          renderRow={(rec) => {
            return (
              <tr key={rec._id} className="border-b hover:bg-gray-50">
                <ReportNameCell image={rec.image} name={rec.name} alt={rec.name} />
                <ReportTextCell>{rec.department || "-"}</ReportTextCell>
                <ReportTextCell>{rec.position || "-"}</ReportTextCell>
                {leaveTypes.map((leaveType) => (
                  <ReportTextCell key={leaveType.code}>
                    {rec[leaveType.name] || "0/0"}
                  </ReportTextCell>
                ))}
              </tr>
            );
          }}
        />
      ) : (
        <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
          <div className="text-center">
            <div className="text-gray-500 text-lg mb-2">
              {t("hrReports.common.pleaseSelectBusinessAndLeaveGroup")}
            </div>
            <div className="text-gray-400 text-sm">
              {t("hrReports.common.chooseFromDropdowns")}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveUtilizationReport;
