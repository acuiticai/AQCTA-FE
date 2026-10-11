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
import { formatDate } from "@/components/formatAmount";
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
import { exportWorkPassExpiryReport } from "./hrReportExport";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const WorkPassExpiryReport = () => {
  const { t } = useTranslation();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state || {};
  // Filters
  const [searchParams, setSearchParams] = useState({
    name: "",
    department: "",
    position: "",
    workPassType: "",
    startDate: "",
    endDate: "",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  const [workPassTypes, setWorkPassTypes] = useState([]);
  const [selectedBusiness, setSelectedBusiness] = useState("");

  // Data
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit, setLimit] = useState(() => readConfiguredPageSize(10));
  const [total, setTotal] = useState(0);
  const [resetKey, setResetKey] = useState(0);
  const [exporting, setExporting] = useState(false);
  const fetchAbortRef = useRef(null);

  // Fetch departments, positions and work pass types for dropdowns
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
    const fetchWorkPassTypes = async () => {
      if (!selectedBusiness) {
        setWorkPassTypes([]);
        return;
      }
      try {
        const response = await axios.get(`${Base_URL}/work-pass-types/get?business=${selectedBusiness}`);
        setWorkPassTypes(response.data.data || []);
      } catch (err) {
        setWorkPassTypes([]);
      }
    };

    fetchDepartments();
    fetchPositions();
    fetchWorkPassTypes();
  }, [selectedBusiness]);

  // Fetch data
  const fetchData = async (page = 1, perPage = limit) => {
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
        workPassType: searchParams.workPassType,
        startDate: searchParams.startDate,
        endDate: searchParams.endDate,
        business: selectedBusiness,
      };

      const res = await axios.get(`${Base_URL}/attendance/work-pass-report`, {
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
      if (err?.code === "ERR_CANCELED" || err?.name === "CanceledError") return;
      console.error("API Error:", err);
      setRecords([]);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(currentPage, limit);
    // eslint-disable-next-line
  }, [currentPage, limit, selectedBusiness]);

  useEffect(() => () => fetchAbortRef.current?.abort(), []);

  const handleSearch = () => {
    if (currentPage === 1) fetchData(1, limit);
    else setCurrentPage(1);
  };

  const handleReset = () => {
    setSearchParams({
      name: "",
      department: "",
      position: "",
      workPassType: "",
      startDate: "",
      endDate: "",
    });
    setResetKey((prev) => prev + 1); // Force FormInput to re-render
    setCurrentPage(1);
    fetchData(1, limit);
  };

  const handleDownload = async (type) => {
    if (exporting) return;
    setExporting(true);
    try {
      const count = await exportWorkPassExpiryReport({
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
      (rec.name || "").toLowerCase().includes(q) ||
      (rec.department || "").toLowerCase().includes(q) ||
      (rec.position || "").toLowerCase().includes(q) ||
      (rec.workPassType || "").toLowerCase().includes(q) ||
      (rec.nationality || "").toLowerCase().includes(q)
    );
  });

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

  const workPassTypeOptions = [
    { value: "", label: t("hrReports.common.searchByWorkPassType") },
    ...workPassTypes.map((type) => ({
      value: type.name,
      label: type.name,
    })),
  ];

  return (
    <div className="p-6 bg-white min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <h2 className="text-xl font-semibold text-gray-900">
          {t("hrReports.workPassExpiryReport.title")}
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
          <Search className="w-5 h-5 absolute left-[0.8rem] top-[0.675rem] text-gray-400" />
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
          placeholder={t("hrReports.common.searchByWorkPassType")}
          name="workPassType"
          value={searchParams.workPassType || ""}
          onChange={(val) =>
            setSearchParams((prev) => ({ ...prev, workPassType: val }))
          }
          options={workPassTypeOptions}
          className="text-sm"
        />
        <FormInput
          key={resetKey}
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
        headers={[
          t("hrReports.common.name"),
          t("hrReports.common.nationality"),
          t("hrReports.common.department"),
          t("hrReports.common.position"),
          t("hrReports.common.workPassType"),
          t("hrReports.common.visaExpiryDate"),
        ]}
        data={filteredRecords}
        searchValue={searchQuery}
        onSearch={setSearchQuery}
        searchPlaceholder={t("hrReports.common.search")}
        totalPages={totalPages}
        colWidths={{
          ...getHrReportStaffColWidths(t),
          [t("hrReports.common.nationality")]: "95px",
          [t("hrReports.common.workPassType")]: "115px",
          [t("hrReports.common.visaExpiryDate")]: "105px",
        }}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        recordsPerPage={limit}
        onRecordsPerPageChange={setLimit}
        loading={loading}
        renderRow={(rec) => {
          const isExpiringSoon = rec.visaExpiryDate && 
            (new Date(rec.visaExpiryDate) - new Date()) / (1000 * 60 * 60 * 24) < 30;

          return (
            <tr key={rec._id} className="border-b hover:bg-gray-50">
              <ReportNameCell image={rec.image} name={rec.name} alt={rec.name} />
              <ReportTextCell>{rec.nationality || "-"}</ReportTextCell>
              <ReportTextCell>{rec.department || "-"}</ReportTextCell>
              <ReportTextCell>{rec.position || "-"}</ReportTextCell>
              <td className="px-4 py-3 max-w-0">
                <span className="px-3 py-1 rounded-full font-semibold bg-blue-50 text-blue-600">
                  {rec.workPassType || "-"}
                </span>
              </td>
              <ReportTextCell>
                <span className={isExpiringSoon ? "text-red-600 font-bold" : ""}>
                  {rec.visaExpiryDate ? formatDate(rec.visaExpiryDate) : "-"}
                </span>
              </ReportTextCell>
            </tr>
          );
        }}
      />
    </div>
  );
};

export default WorkPassExpiryReport;
