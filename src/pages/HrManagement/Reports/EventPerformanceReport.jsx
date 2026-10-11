import React, { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";
import {
  Download,
  FileText,
  Search,
  RefreshCw,
  Users,
  Calendar,
} from "lucide-react";
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
import { notifyError, notifySuccess } from "@/utils/toast";
import { exportEventPerformanceReport } from "./hrReportExport";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const EventPerformanceReport = () => {
  const { t } = useTranslation();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state || {};
  // Shared Filters
  const [searchParams, setSearchParams] = useState({
    name: "",
    department: "",
    position: "",
    departmentName: "",
    positionName: "",
    startDate: "",
    endDate: "",
    eventName: "",
    business: "",
    year: "",
  });
  const [selectedBusiness, setSelectedBusiness] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);

  // adminInfo is obtained from AdminContext; local state removed.
  // Staff Performance Data
  const [staffRecords, setStaffRecords] = useState([]);
  const [staffStats, setStaffStats] = useState({
    totalStaff: 0,
    totalEvents: 0,
    averagePerformance: 0,
    dateRange: { start: "", end: "" },
  });

  // Event Attendance Data
  const [eventRecords, setEventRecords] = useState([]);
  const [eventStats, setEventStats] = useState({
    totalEvents: 0,
    totalInvited: 0,
    totalAttended: 0,
    totalNotAttended: 0,
    averageAttendanceRate: 0,
    dateRange: { start: "", end: "" },
  });

  // Loading States
  const [staffLoading, setStaffLoading] = useState(false);
  const [eventLoading, setEventLoading] = useState(false);

  // Staff Pagination
  const [staffCurrentPage, setStaffCurrentPage] = useState(1);
  const [staffTotalPages, setStaffTotalPages] = useState(1);
  const [staffLimit, setStaffLimit] = useState(10);
  const [staffTotal, setStaffTotal] = useState(0);

  // Event Pagination
  const [eventCurrentPage, setEventCurrentPage] = useState(1);
  const [eventTotalPages, setEventTotalPages] = useState(1);
  const [eventLimit, setEventLimit] = useState(10);
  const [eventTotal, setEventTotal] = useState(0);

  const [resetKey, setResetKey] = useState(0);
  const [exporting, setExporting] = useState(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState("staff"); // "staff" or "events"

  // Removed local adminInfo loading as we use AdminContext

  // Fetch departments based on business selection
  const fetchDepartments = async () => {
    if (!selectedBusiness) {
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
    if (!selectedBusiness) {
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

  // Fetch staff performance data - memoized with useCallback
  const fetchStaffData = useCallback(
    async (page = 1, perPage = staffLimit) => {
      setStaffLoading(true);
      try {
        const params = {
          page,
          limit: perPage,
          name: searchParams.name,
          department: searchParams.department,
          position: searchParams.position,
          departmentName: searchParams.departmentName,
          positionName: searchParams.positionName,
          startDate: searchParams.startDate,
          endDate: searchParams.endDate,
          eventName: searchParams.eventName,
          businessId: searchParams.business,
          year: searchParams.year,
        };

        // Remove empty parameters
        Object.keys(params).forEach((key) => {
          if (!params[key]) delete params[key];
        });

        const res = await axios.get(
          `${Base_URL}/event/event-performance-report`,
          { params }
        );

        setStaffRecords(res.data.data || []);
        setStaffStats(res.data.stats || {});
        // Only update current page if the API returns a different page number
        if (res.data.currentPage && res.data.currentPage !== page) {
          setStaffCurrentPage(res.data.currentPage);
        }
        setStaffTotalPages(res.data.totalPages || 1);
        setStaffLimit(res.data.limit || 10);
        setStaffTotal(res.data.total || 0);
      } catch (err) {
        console.error("Staff API Error:", err);
        setStaffRecords([]);
        setStaffStats({});
      } finally {
        setStaffLoading(false);
      }
    },
    [searchParams, staffLimit]
  );

  // Fetch event attendance data - memoized with useCallback
  const fetchEventData = useCallback(
    async (page = 1, perPage = eventLimit) => {
      setEventLoading(true);
      try {
        const params = {
          page,
          limit: perPage,
          name: searchParams.name,
          department: searchParams.department,
          position: searchParams.position,
          departmentName: searchParams.departmentName,
          positionName: searchParams.positionName,
          startDate: searchParams.startDate,
          endDate: searchParams.endDate,
          eventName: searchParams.eventName,
          businessId: searchParams.business,
          year: searchParams.year,
        };

        // Remove empty parameters
        Object.keys(params).forEach((key) => {
          if (!params[key]) delete params[key];
        });

        const res = await axios.get(
          `${Base_URL}/event/get-event-attendance-report`,
          { params }
        );

        setEventRecords(res.data.data || []);
        setEventStats(res.data.stats || {});
        // Only update current page if the API returns a different page number
        if (res.data.currentPage && res.data.currentPage !== page) {
          setEventCurrentPage(res.data.currentPage);
        }
        setEventTotalPages(res.data.totalPages || 1);
        setEventLimit(res.data.limit || 10);
        setEventTotal(res.data.total || 0);
      } catch (err) {
        console.error("Event API Error:", err);
        setEventRecords([]);
        setEventStats({});
      } finally {
        setEventLoading(false);
      }
    },
    [searchParams, eventLimit]
  );

  // Fetch both datasets - memoized with useCallback
  const fetchData = useCallback(async () => {
    await Promise.all([
      fetchStaffData(staffCurrentPage, staffLimit),
      fetchEventData(eventCurrentPage, eventLimit),
    ]);
  }, [
    fetchStaffData,
    fetchEventData,
    staffCurrentPage,
    staffLimit,
    eventCurrentPage,
    eventLimit,
  ]);

  // Initial data fetch on component mount (without filters)
  useEffect(() => {
    const fetchInitialData = async () => {
      setStaffLoading(true);
      setEventLoading(true);
      try {
        const [staffRes, eventRes] = await Promise.all([
          axios.get(`${Base_URL}/event/event-performance-report`),
          axios.get(`${Base_URL}/event/get-event-attendance-report`),
        ]);

        setStaffRecords(staffRes.data.data || []);
        setStaffStats(staffRes.data.stats || {});
        setStaffCurrentPage(staffRes.data.currentPage || 1);
        setStaffTotalPages(staffRes.data.totalPages || 1);
        setStaffLimit(staffRes.data.limit || 10);
        setStaffTotal(staffRes.data.total || 0);

        setEventRecords(eventRes.data.data || []);
        setEventStats(eventRes.data.stats || {});
        setEventCurrentPage(eventRes.data.currentPage || 1);
        setEventTotalPages(eventRes.data.totalPages || 1);
        setEventLimit(eventRes.data.limit || 10);
        setEventTotal(eventRes.data.total || 0);
      } catch (err) {
        console.error("Initial data fetch error:", err);
        setStaffRecords([]);
        setEventRecords([]);
      } finally {
        setStaffLoading(false);
        setEventLoading(false);
      }
    };

    fetchInitialData();
  }, []); // Only run on component mount

  // Remove auto-fetch on filter changes - only fetch when search button is clicked
  // useEffect(() => {
  //   fetchData();
  // }, [fetchData]);

  const handleSearch = useCallback(() => {
    // Reset pagination for both tabs
    setStaffCurrentPage(1);
    setEventCurrentPage(1);
    fetchData();
  }, [fetchData]);

  const handleReset = () => {
    setSelectedBusiness("");
    setSearchParams({
      name: "",
      department: "",
      position: "",
      departmentName: "",
      positionName: "",
      startDate: "",
      endDate: "",
      eventName: "",
      business: "",
      year: "",
    });
    setResetKey((prev) => prev + 1);
    setStaffCurrentPage(1);
    setEventCurrentPage(1);
    // Clear data
    setStaffRecords([]);
    setEventRecords([]);
    fetchData();
  };

  // Handle tab change - reset filters
  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    // Reset filters when changing tabs
    setSearchParams({
      name: "",
      department: "",
      position: "",
      departmentName: "",
      positionName: "",
      startDate: "",
      endDate: "",
      eventName: "",
      business: "",
      year: "",
    });
    setResetKey((prev) => prev + 1);
    // Reset pagination for both tabs
    setStaffCurrentPage(1);
    setEventCurrentPage(1);
    // Clear data and reload initial data
    setStaffRecords([]);
    setEventRecords([]);

    // Fetch initial data again (without filters)
    const fetchInitialData = async () => {
      setStaffLoading(true);
      setEventLoading(true);
      try {
        const [staffRes, eventRes] = await Promise.all([
          axios.get(`${Base_URL}/event/event-performance-report`),
          axios.get(`${Base_URL}/event/get-event-attendance-report`),
        ]);

        setStaffRecords(staffRes.data.data || []);
        setStaffStats(staffRes.data.stats || {});
        setStaffCurrentPage(staffRes.data.currentPage || 1);
        setStaffTotalPages(staffRes.data.totalPages || 1);
        setStaffLimit(staffRes.data.limit || 10);
        setStaffTotal(staffRes.data.total || 0);

        setEventRecords(eventRes.data.data || []);
        setEventStats(eventRes.data.stats || {});
        setEventCurrentPage(eventRes.data.currentPage || 1);
        setEventTotalPages(eventRes.data.totalPages || 1);
        setEventLimit(eventRes.data.limit || 10);
        setEventTotal(eventRes.data.total || 0);
      } catch (err) {
        console.error("Initial data fetch error:", err);
        setStaffRecords([]);
        setEventRecords([]);
      } finally {
        setStaffLoading(false);
        setEventLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  const handleDownload = async (type) => {
    if (exporting) return;
    setExporting(true);
    try {
      const count = await exportEventPerformanceReport({
        format: type,
        activeTab,
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

  // Filtered records for table search
  const filteredStaffRecords = staffRecords.filter((rec) => {
    const q = searchQuery.toLowerCase();
    return (
      (rec.name || "").toLowerCase().includes(q) ||
      (rec.department || "").toLowerCase().includes(q) ||
      (rec.position || "").toLowerCase().includes(q) ||
      (rec.business || "").toLowerCase().includes(q) ||
      (rec.email || "").toLowerCase().includes(q)
    );
  });

  const filteredEventRecords = eventRecords.filter((rec) => {
    const q = searchQuery.toLowerCase();
    return (
      (rec.eventName || "").toLowerCase().includes(q) ||
      (rec.location || "").toLowerCase().includes(q) ||
      (rec.business || "").toLowerCase().includes(q) ||
      (rec.status || "").toLowerCase().includes(q)
    );
  });

  // Format dropdown options
  const departmentOptions = [
    { value: "", label: t("hrReports.common.searchByDepartment") },
    ...departments.map((dept) => ({ value: dept._id, label: dept.name })),
  ];

  const positionOptions = [
    { value: "", label: t("hrReports.common.searchByPosition") },
    ...positions.map((pos) => ({ value: pos._id, label: pos.name })),
  ];

  const yearOptions = [
    { value: "", label: "All Years" },
    { value: "2024", label: "2024" },
    { value: "2026", label: "2026" },
    { value: "2026", label: "2026" },
  ];

  return (
    <div className="p-6 bg-white min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{t("hrReports.eventPerformanceReport.title")}</h2>
          <div className="flex gap-6 mt-2 text-sm text-gray-600">
            {activeTab === "staff" && staffStats.totalStaff > 0 && (
              <>
                <span>
                  {t("hrReports.common.totalStaff")}: <strong>{staffStats.totalStaff}</strong>
                </span>
                <span>
                  {t("hrReports.common.totalEvents")}: <strong>{staffStats.totalEvents}</strong>
                </span>
                {staffStats.dateRange && (
                  <span>
                    {t("hrReports.common.period")}:{" "}
                    <strong>
                      {staffStats.dateRange.start} to {staffStats.dateRange.end}
                    </strong>
                  </span>
                )}
              </>
            )}
            {activeTab === "events" && eventStats.totalEvents > 0 && (
              <>
                <span>
                  {t("hrReports.common.totalEvents")}: <strong>{eventStats.totalEvents}</strong>
                </span>
                {eventStats.dateRange && (
                  <span>
                    {t("hrReports.common.period")}:{" "}
                    <strong>
                      {eventStats.dateRange.start} to {eventStats.dateRange.end}
                    </strong>
                  </span>
                )}
              </>
            )}
          </div>
        </div>
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

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => handleTabChange("staff")}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === "staff"
              ? "border-[var(--p-blue)] text-[var(--p-blue)]"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <Users className="inline w-4 h-4 mr-2" />
          {t("hrReports.common.staffPerformance")}
        </button>
        <button
          onClick={() => handleTabChange("events")}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === "events"
              ? "border-[var(--p-blue)] text-[var(--p-blue)]"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <Calendar className="inline w-4 h-4 mr-2" />
          {t("hrReports.common.eventAttendance")}
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        {/* Name Search */}
        <div className="relative">
          <InputField
            type="text"
            name="name"
            value={searchParams.name || ""}
            placeholder={
              activeTab === "staff"
                ? t("hrReports.common.searchByNameEmail")
                : t("hrReports.common.searchByEventName")
            }
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
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        {/* Business Selection */}
        <SingleBusinessField
          selectedValue={selectedBusiness}
          onAutoSelect={(val) => {
            setSelectedBusiness(val);
            setSearchParams((prev) => ({
              ...prev,
              department: "",
              position: "",
            }));
          }}
        >
          <BusinessDropdown
            adminId={adminInfo?.id}
            selectedBusiness={selectedBusiness}
            onChange={(val) => {
              setSelectedBusiness(val);
              setSearchParams((prev) => ({
                ...prev,
                department: "", // Reset department when business changes
                position: "", // Reset position when business changes
              }));
            }}
            isClearable={true}
            placeholder={t("hrAnalytics.selectBusiness")}
          />
        </SingleBusinessField>

        {/* Department - disabled when no business selected */}
        <DropdownBasic
          placeholder={t("hrReports.common.searchByDepartment")}
          name="department"
          value={searchParams.department || ""}
          onChange={(val) =>
            setSearchParams((prev) => ({ ...prev, department: val }))
          }
          options={departmentOptions}
          className="text-sm"
          disabled={!selectedBusiness}
        />

        {/* Position - disabled when no business selected */}
        <DropdownBasic
          placeholder={t("hrReports.common.searchByPosition")}
          name="position"
          value={searchParams.position || ""}
          onChange={(val) =>
            setSearchParams((prev) => ({ ...prev, position: val }))
          }
          options={positionOptions}
          className="text-sm"
          disabled={!selectedBusiness}
        />

        {/* Event Name */}
        <InputField
          type="text"
          name="eventName"
          value={searchParams.eventName || ""}
          placeholder={t("hrReports.common.searchByEventName")}
          className="text-sm"
          onChange={(e) =>
            setSearchParams((prev) => ({ ...prev, eventName: e.target.value }))
          }
        />

        {/* Year */}
        <DropdownBasic
          placeholder={t("hrReports.common.filterByYear")}
          name="year"
          value={searchParams.year || ""}
          onChange={(val) =>
            setSearchParams((prev) => ({ ...prev, year: val }))
          }
          options={yearOptions}
          className="text-sm"
        />

        {/* Date Range */}
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
          width="100%"
        />

        {/* Search and Reset Buttons */}
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

      {/* Staff Performance Table */}
      {activeTab === "staff" && (
        <DataTable
          headers={[
            t("hrReports.common.staff"),
            t("hrReports.common.department"),
            t("hrReports.common.position"),
            t("hrAnalytics.business"),
            t("hrReports.common.eventsAttended"),
            // "Events with Tasks",
            t("hrReports.common.pointsObtained"),
            // "Possible Points",
            t("hrReports.common.performancePercent"),
          ]}
          data={filteredStaffRecords}
          searchValue={searchQuery}
          onSearch={setSearchQuery}
          searchPlaceholder={t("hrReports.common.searchInResults")}
          totalPages={staffTotalPages}
          colWidths={{
            Staff: "250px",
            Department: "140px",
            Position: "140px",
            Business: "140px",
            EventsAttended: "120px",
            // EventsWithTasks: "120px",
            PointsObtained: "120px",
            // PossiblePoints: "120px",
            "Performance %": "120px",
          }}
          currentPage={staffCurrentPage}
          onPageChange={setStaffCurrentPage}
          recordsPerPage={staffLimit}
          onRecordsPerPageChange={setStaffLimit}
          loading={staffLoading}
          renderRow={(rec) => {
            return (
              <tr key={rec._id} className="border-b hover:bg-gray-50">
                {/* Staff Info */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {rec.image ? (
                      <img
                        src={rec.image}
                        alt={rec.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
                        <span className="text-gray-600 text-sm font-semibold">
                          {rec.name?.charAt(0)?.toUpperCase() || "?"}
                        </span>
                      </div>
                    )}
                    <div>
                      <div className="font-medium text-gray-900">
                        {rec.name || "-"}
                      </div>
                      <div className="text-sm text-gray-500">
                        {rec.email || "-"}
                      </div>
                    </div>
                  </div>
                </td>

                {/* Department */}
                <td className="px-4 py-3">{rec.department || "-"}</td>

                {/* Position */}
                <td className="px-4 py-3">{rec.position || "-"}</td>

                {/* Business */}
                <td className="px-4 py-3">{rec.business || "-"}</td>

                {/* Events Attended */}
                <td className="px-4 py-3 text-center">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {rec.eventsAttended || 0}/{rec.totalEvents || 0}
                  </span>
                </td>

                {/* Events with Tasks */}
                {/* <td className="px-4 py-3 text-center">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                    {rec.eventsWithTasks || 0}
                  </span>
                </td> */}

                {/* Points Obtained */}
                <td className="px-4 py-3 text-center">
                  <span className="font-medium text-gray-900">
                    {rec.totalPointsObtained?.toFixed(1) || "0.0"}/
                    {rec.totalPossiblePoints?.toFixed(1) || "0.0"}
                  </span>
                </td>

                {/* Possible Points */}
                {/* <td className="px-4 py-3 text-center">
                  <span className="font-medium text-gray-600">
                    {rec.totalPossiblePoints?.toFixed(1) || "0.0"}
                  </span>
                </td> */}

                {/* Performance Percentage */}
                <td className="px-4 py-3 text-center">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                      rec.performancePercentage >= 80
                        ? "text-green-700 bg-green-100"
                        : rec.performancePercentage >= 60
                        ? "text-yellow-700 bg-yellow-100"
                        : rec.performancePercentage >= 40
                        ? "text-orange-700 bg-orange-100"
                        : "text-red-700 bg-red-100"
                    }`}
                  >
                    {rec.performancePercentage?.toFixed(1) || "0.0"}%
                  </span>
                </td>
              </tr>
            );
          }}
        />
      )}

      {/* Event Attendance Table */}
      {activeTab === "events" && (
        <DataTable
          headers={[
            t("hrReports.common.eventName"),
            t("hrReports.common.date"),
            t("hrReports.common.location"),
            t("hrAnalytics.business"),
            t("hrReports.common.status"),
            // "Attendance Rate",
            t("hrReports.common.attendance"),
            // "Not Attended",
            // "Tasks",
            t("hrReports.common.weightage"),
          ]}
          data={filteredEventRecords}
          searchValue={searchQuery}
          onSearch={setSearchQuery}
          searchPlaceholder={t("hrReports.common.searchInResults")}
          totalPages={eventTotalPages}
          colWidths={{
            EventName: "200px",
            Date: "120px",
            Location: "200px",
            Business: "120px",
            Status: "100px",
            // AttendanceRate: "120px",
            Attendance: "100px",
            // NotAttended: "50px",
            // Tasks: "80px",
            Weightage: "100px",
          }}
          currentPage={eventCurrentPage}
          onPageChange={setEventCurrentPage}
          recordsPerPage={eventLimit}
          onRecordsPerPageChange={setEventLimit}
          loading={eventLoading}
          renderRow={(rec) => {
            return (
              <tr key={rec._id} className="border-b hover:bg-gray-50">
                {/* Event Name */}
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">
                    {rec.eventName || "-"}
                  </div>
                </td>

                {/* Date */}
                <td className="px-4 py-3">
                  {rec.eventDate
                    ? new Date(rec.eventDate).toLocaleDateString()
                    : "-"}
                </td>

                {/* Location */}
                <td className="px-4 py-3">
                  <div className="max-w-xs truncate" title={rec.location}>
                    {rec.location || "-"}
                  </div>
                </td>

                {/* Business */}
                <td className="px-4 py-3">{rec.business || "-"}</td>

                {/* Status */}
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      rec.status === "Completed"
                        ? "bg-green-100 text-green-800"
                        : rec.status === "Pending"
                        ? "bg-yellow-100 text-yellow-800"
                        : rec.status === "Cancelled"
                        ? "bg-red-100 text-red-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {rec.status || "-"}
                  </span>
                </td>

                {/* Attendance Rate */}
                {/* <td className="px-4 py-3 text-center">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                    rec.attendanceRate >= 80 ? "text-green-700 bg-green-100" :
                    rec.attendanceRate >= 60 ? "text-yellow-700 bg-yellow-100" :
                    rec.attendanceRate >= 40 ? "text-orange-700 bg-orange-100" :
                    "text-red-700 bg-red-100"
                  }`}>
                    {rec.attendanceRate?.toFixed(1) || "0.0"}%
                  </span>
                </td> */}

                {/* Attendance (Combined Invited/Attended) */}
                <td className="px-4 py-3 text-center">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {rec.totalAttended || 0}/{rec.totalInvited || 0}
                  </span>
                </td>

                {/* Not Attended */}
                {/* <td className="px-4 py-3 text-center">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    {rec.totalNotAttended || 0}
                  </span>
                </td> */}

                {/* Tasks */}
                {/* <td className="px-4 py-3 text-center">
                  <div className="flex flex-col items-center">
                    <span className="text-sm font-medium">
                      {rec.completedTasks || 0}/{rec.totalTasks || 0}
                    </span>
                    <span className="text-xs text-gray-500">
                      {rec.hasTasks ? "Has Tasks" : "No Tasks"}
                    </span>
                  </div>
                </td> */}

                {/* Weightage */}
                <td className="px-4 py-3 text-center">
                  <span className="font-medium text-gray-900">
                    {rec.totalWeightage || 0}/100
                  </span>
                </td>
              </tr>
            );
          }}
        />
      )}
    </div>
  );
};

export default EventPerformanceReport;
