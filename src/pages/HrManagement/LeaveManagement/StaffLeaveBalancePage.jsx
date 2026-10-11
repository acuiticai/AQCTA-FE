import React, { useState, useEffect, useContext, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Users, RefreshCw, Search as SearchIcon, Calendar } from "lucide-react";
import request from "@/services/httpService";
import { notifyError } from "@/utils/toast";
import { DropdownBasic } from "@/page-layouts";
import axios from "axios";
import { AdminContext } from "@/context/AdminContext";
import CustomPagination from "@/components/CustomPagination";
import BusinessDropdown from "@/page-layouts/components/helpers/BusinessDropdown";
import SingleBusinessField from "@/components/SingleBusinessField";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const StaffLeaveBalancePage = () => {
  const { t } = useTranslation();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state || {};

  const [staffBalances, setStaffBalances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [leaveGroups, setLeaveGroups] = useState([]);
  const [selectedBusiness, setSelectedBusiness] = useState("");
  const [filters, setFilters] = useState({
    department: "",
    leaveGroup: "",
  });

  // Pagination states
  const [totalResults, setTotalResults] = useState(0);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const currentPageRef = useRef(1);

  useEffect(() => {
    // Fetch staff balances on initial load
    fetchStaffBalances(1, 10);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBusiness]);

  useEffect(() => {
    // Fetch departments and leave groups when business changes
    if (selectedBusiness) {
      fetchDepartments(selectedBusiness);
      fetchLeaveGroups(selectedBusiness);
    } else {
      setDepartments([]);
      setLeaveGroups([]);
      setFilters((prev) => ({ ...prev, department: "", leaveGroup: "" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBusiness]);

  const fetchBusinesses = async () => {
    try {
      const response = await axios.get(`${Base_URL}/Business/getALL`, {
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${adminInfo?.token}`,
        },
      });
      const businessData = response.data?.data || [];
      setBusinesses(businessData);
      localStorage.setItem("businesses", JSON.stringify(businessData));
    } catch (err) {
      console.error("Failed to fetch businesses:", err);
    }
  };

  const fetchDepartments = async (businessId) => {
    try {
      const payload = {
        business_id: businessId,
        FilterStatus: "",
        FilterName: "",
      };
      const response = await axios.post(
        `${Base_URL}/Departments/get_all`,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
            authorization: `Bearer ${adminInfo?.token}`,
          },
        }
      );
      setDepartments(response.data?.data || []);
    } catch (err) {
      console.error("Failed to fetch departments:", err);
      setDepartments([]);
    }
  };

  const fetchLeaveGroups = async (businessId) => {
    try {
      const payload = {
        business_id: businessId,
        FilterStatus: "",
        FilterName: "",
      };
      const response = await axios.post(
        `${Base_URL}/LeaveGroups/get_all`,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
            authorization: `Bearer ${adminInfo?.token}`,
          },
        }
      );
      setLeaveGroups(response.data?.data || []);
    } catch (err) {
      console.error("Failed to fetch leave groups:", err);
      setLeaveGroups([]);
    }
  };

  const fetchStaffBalances = async (page = 1, limit = 10) => {
    try {
      setLoading(true);
      const params = {
        page,
        limit,
      };

      // Add filters to params if they exist
      if (selectedBusiness) params.business = selectedBusiness;
      if (filters.department) params.department = filters.department;
      if (filters.leaveGroup) params.leaveGroup = filters.leaveGroup;

      const response = await request.get("/leaves/staff-balance", { params });

      if (response && response.data) {
        setStaffBalances(response.data);
        setTotalResults(response.total || 0);
        setTotalPages(response.totalPages || 1);
        setCurrentPage(response.currentPage || page);
      } else {
        setStaffBalances([]);
        setTotalResults(0);
        setTotalPages(1);
        setCurrentPage(1);
      }
    } catch (err) {
      console.error("Error fetching staff balances:", err);
      notifyError(
        err?.response?.data?.message || "Failed to fetch staff leave balances"
      );
      setStaffBalances([]);
      setTotalResults(0);
      setTotalPages(1);
      setCurrentPage(1);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (name, value) => {
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleSearch = () => {
    setCurrentPage(1);
    currentPageRef.current = 1;
    fetchStaffBalances(1, recordsPerPage);
  };

  const handleRefresh = () => {
    setSelectedBusiness("");
    setFilters({
      department: "",
      leaveGroup: "",
    });
    setCurrentPage(1);
    currentPageRef.current = 1;
    setStaffBalances([]);
    fetchStaffBalances(1, recordsPerPage);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    currentPageRef.current = page;
    fetchStaffBalances(page, recordsPerPage);
  };

  const handleRecordsPerPageChange = (perPage) => {
    setRecordsPerPage(perPage);
    setCurrentPage(1);
    currentPageRef.current = 1;
    fetchStaffBalances(1, perPage);
  };

  const LeaveBalanceCard = ({ staff }) => {
    const getLeaveTypeColor = (leaveName) => {
      const name = leaveName?.toLowerCase() || "";
      if (name.includes("annual") || name.includes("vacation"))
        return "from-blue-500 to-cyan-500";
      if (name.includes("sick")) return "from-red-500 to-pink-500";
      if (name.includes("casual")) return "from-purple-500 to-indigo-500";
      return "from-emerald-500 to-teal-500";
    };

    const getBalanceStatus = (balance, eligible) => {
      const percentage = eligible > 0 ? (balance / eligible) * 100 : 0;
      if (percentage >= 70) return "text-emerald-600 bg-emerald-50";
      if (percentage >= 40) return "text-amber-600 bg-amber-50";
      return "text-red-600 bg-red-50";
    };

    return (
      <div className="group bg-gradient-to-br from-white to-gray-50 rounded-2xl p-6 shadow-md hover:shadow-lg transition-all duration-300 border border-gray-100 hover:border-[var(--p-blue)]/30 transform">
        {/* Staff Header with Avatar */}
        <div className="flex items-center gap-4 mb-6 pb-4 border-b border-gray-200">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--p-blue)] to-[#8BB030] flex items-center justify-center shadow-lg">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              {staff.staffName}
            </h3>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {staff.leaveBalances?.length || 0} {t("hrReports.staffLeaveBalance.leaveType")}
              {staff.leaveBalances?.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Leave Types Grid - 2 Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
          {staff.leaveBalances.map((leave, index) => {
            const usedPercentage =
              leave.eligible > 0 ? (leave.taken / leave.eligible) * 100 : 0;

            return (
              <div
                key={index}
                className="group/card relative bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100 hover:border-[var(--p-blue)]/50 overflow-hidden"
              >
                {/* Gradient Background Accent */}
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${getLeaveTypeColor(
                    leave.name
                  )} opacity-0 group-hover/card:opacity-5 transition-opacity duration-300`}
                ></div>

                {/* Content */}
                <div className="relative z-10">
                  {/* Leave Type Header */}
                  <div className="mb-4">
                    <h4 className="text-sm font-bold text-gray-900 leading-tight">
                      {leave.name}
                    </h4>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-medium text-gray-600">
                        {t("hrReports.staffLeaveBalance.used")}
                      </span>
                      <span className="text-xs font-bold text-gray-900">
                        {usedPercentage.toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${getLeaveTypeColor(
                          leave.name
                        )} rounded-full transition-all duration-500`}
                        style={{ width: `${Math.min(usedPercentage, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-3 rounded-lg bg-blue-50 border border-blue-100">
                      <p className="text-xs font-medium text-blue-600 mb-1">
                        {t("hrReports.staffLeaveBalance.eligible")}
                      </p>
                      <p className="text-base font-bold text-blue-900">
                        {leave.eligible?.toFixed(1) || "0.0"}
                      </p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-orange-50 border border-orange-100">
                      <p className="text-xs font-medium text-orange-600 mb-1">
                        {t("hrReports.staffLeaveBalance.taken")}
                      </p>
                      <p className="text-base font-bold text-orange-900">
                        {leave.taken?.toFixed(1) || "0.0"}
                      </p>
                    </div>
                    <div
                      className={`text-center p-3 rounded-lg border ${getBalanceStatus(
                        leave.balance,
                        leave.eligible
                      )}`}
                    >
                      <p className="text-xs font-medium mb-1">{t("hrReports.staffLeaveBalance.balance")}</p>
                      <p className="text-base font-bold">
                        {leave.balance?.toFixed(1) || "0.0"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <div className="w-full container py-8 px-8">
        {/* Page Header - Premium Design */}
        <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between mb-6 gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {t("hrReports.staffLeaveBalance.title")}
            </h2>
          </div>
          <div className="flex gap-2">
            <span className="text-sm text-gray-600 border border-gray-200 rounded-lg px-4 py-2">
              {t("hrReports.common.totalStaff")}: {totalResults}
            </span>
          </div>
        </div>
        {/* <div className="mb-8">
          <div className="bg-gradient-to-r from-[var(--p-blue)] to-[#8BB030] rounded-2xl p-8 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg">
                  <Users className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white mb-2">
                    Staff Leave Balance
                  </h1>
                  <p className="text-white/90 text-sm">
                    Monitor and manage employee leave allocations
                  </p>
                </div>
              </div>
              <div className="hidden lg:flex items-center gap-6 text-white/90">
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">{totalResults}</p>
                  <p className="text-sm">Total Staff</p>
                </div>
              </div>
            </div>
          </div>
        </div> */}

        {/* Filters Section - Modern Card Design */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-3 border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-[var(--p-blue)] to-[#8BB030] rounded-lg flex items-center justify-center">
              <SearchIcon className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">{t("hrReports.staffLeaveBalance.filterAndSearch")}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Business Dropdown */}
            <SingleBusinessField
              className="relative"
              selectedValue={selectedBusiness}
              onAutoSelect={setSelectedBusiness}
            >
              <label className="block text-xs font-semibold text-gray-700 mb-2">
                {t("hrAnalytics.business")}
              </label>
              <BusinessDropdown
                adminId={adminInfo?.id}
                selectedBusiness={selectedBusiness}
                onChange={setSelectedBusiness}
                isClearable={true}
                placeholder={t("hrAnalytics.selectBusiness")}
              />
            </SingleBusinessField>

            {/* Department Dropdown */}
            <div className="relative">
              <label className="block text-xs font-semibold text-gray-700 mb-2">
                {t("hrReports.common.department")}
              </label>
              <DropdownBasic
                name="department"
                value={filters.department}
                onChange={(val) => handleFilterChange("department", val)}
                placeholder={t("hrReports.staffLeaveBalance.selectDepartment")}
                options={[
                  { value: "", label: t("hrReports.staffLeaveBalance.allDepartments") },
                  ...(departments?.map((dept) => ({
                    value: dept._id,
                    label: dept.name,
                  })) || []),
                ]}
                className="text-sm"
                disabled={!selectedBusiness}
              />
            </div>

            {/* Leave Group Dropdown */}
            <div className="relative">
              <label className="block text-xs font-semibold text-gray-700 mb-2">
                {t("hrReports.common.leaveGroup")}
              </label>
              <DropdownBasic
                name="leaveGroup"
                value={filters.leaveGroup}
                onChange={(val) => handleFilterChange("leaveGroup", val)}
                placeholder={t("hrReports.common.selectLeaveGroup")}
                options={[
                  { value: "", label: t("hrReports.staffLeaveBalance.allLeaveGroups") },
                  ...(leaveGroups?.map((group) => ({
                    value: group._id,
                    label: group.name,
                  })) || []),
                ]}
                className="text-sm"
                disabled={!selectedBusiness}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 items-end">
              <button
                onClick={handleSearch}
                className="flex-1 bg-gradient-to-r w-min max-w-40 from-[var(--p-blue)] to-[#8BB030] text-white flex items-center justify-center px-6 py-3 rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl transform transition-all duration-200"
              >
                <SearchIcon className="mr-2" size={18} />
                {t("hrReports.common.search")}
              </button>
              <button
                onClick={handleRefresh}
                className="bg-gradient-to-br from-gray-800 to-gray-900 text-white p-3 rounded-xl flex items-center justify-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
                title="Refresh"
              >
                <RefreshCw size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Content Section */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="relative">
              <div className="animate-spin rounded-full h-20 w-20 border-t-2 border-b-2 border-[var(--p-blue)]"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Users className="w-8 h-8 text-[var(--p-blue)]" />
              </div>
            </div>
            <p className="mt-6 text-gray-600 font-medium">
              {t("hrReports.staffLeaveBalance.loadingStaffBalances")}
            </p>
          </div>
        ) : staffBalances.length === 0 ? (
          <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-xl p-16 text-center border border-gray-100">
            <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
              <Users className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">
              {t("hrReports.staffLeaveBalance.noStaffFound")}
            </h3>
            <p className="text-base text-gray-600 max-w-md mx-auto">
              {filters.business || filters.department || filters.leaveGroup
                ? t("hrReports.staffLeaveBalance.noStaffMatchFilters")
                : t("hrReports.staffLeaveBalance.noStaffWithLeaveBalances")}
            </p>
          </div>
        ) : (
          <>
            {/* Staff Cards - Masonry Layout */}
            <div className="columns-1 lg:columns-2 gap-3 space-y-3">
              {staffBalances.map((staff, index) => (
                <div
                  key={staff.staffId || index}
                  className="break-inside-avoid"
                >
                  <LeaveBalanceCard staff={staff} />
                </div>
              ))}
            </div>

            {/* Pagination with Results Summary */}
            <div className="mt-8">
              <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  {/* Results Summary */}
                  <div className="text-sm text-gray-600">
                    {t("hrReports.staffLeaveBalance.showing")}{" "}
                    <span className="font-semibold text-gray-900">
                      {(currentPage - 1) * recordsPerPage + 1}
                    </span>{" "}
                    {t("hrReports.common.to")}{" "}
                    <span className="font-semibold text-gray-900">
                      {Math.min(currentPage * recordsPerPage, totalResults)}
                    </span>{" "}
                    {t("hrReports.staffLeaveBalance.of")}{" "}
                    <span className="font-semibold text-gray-900">
                      {totalResults}
                    </span>{" "}
                    {t("hrReports.staffLeaveBalance.staff")}
                  </div>

                  {/* Pagination */}
                  <CustomPagination
                    totalResults={totalResults}
                    resultsPerPage={recordsPerPage}
                    currentPage={currentPage}
                    onChange={handlePageChange}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default StaffLeaveBalancePage;
