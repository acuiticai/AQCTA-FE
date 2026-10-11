import React, { useState, useEffect, useContext } from "react";
import { Users, Calendar, ArrowLeft, RefreshCw } from "lucide-react";
import request from "@/services/httpService";
import { notifyError } from "@/utils/toast";
import axios from "axios";
import { AdminContext } from "@/context/AdminContext";
import { useHistory } from "react-router-dom";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const StaffIndividualLeaveBalancePage = () => {
  const history = useHistory();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;

  const [leaveBalances, setLeaveBalances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [staffInfo, setStaffInfo] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (adminInfo?.token && adminInfo?.id) {
      fetchStaffInfo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminInfo]);

  const fetchStaffInfo = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${Base_URL}/staff-management`, {
        params: { id: adminInfo.id },
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${adminInfo?.token}`,
        },
      });

      const staff = response.data.staffList[0];
      setStaffInfo(staff);

      if (staff?._id) {
        fetchLeaveBalance(staff._id);
      }
    } catch (err) {
      console.error("Error fetching staff info:", err);
      notifyError("Failed to load staff information");
      setLoading(false);
    }
  };

  const fetchLeaveBalance = async (staffId) => {
    try {
      const response = await request.get(`/leaves/staff/${staffId}/balance`);

      // Handle API response structure: { success: true, data: [...] }
      if (response && response.success && Array.isArray(response.data)) {
        setLeaveBalances(response.data);
      } else if (response && Array.isArray(response.data)) {
        // Fallback: if response.data is directly an array
        setLeaveBalances(response.data);
      } else if (Array.isArray(response)) {
        // Fallback: if response is directly an array
        setLeaveBalances(response);
      } else {
        setLeaveBalances([]);
      }
    } catch (err) {
      console.error("Error fetching leave balance:", err);
      notifyError(
        err?.response?.data?.message || "Failed to fetch leave balance"
      );
      setLeaveBalances([]);
    } finally {
      setLoading(false);
    }
  };

  const getLeaveTypeColor = (leaveName) => {
    const name = leaveName?.toLowerCase() || "";
    if (name.includes("annual") || name.includes("vacation"))
      return "from-blue-500 to-cyan-500";
    if (name.includes("sick") || name.includes("medical"))
      return "from-red-500 to-pink-500";
    if (name.includes("casual")) return "from-purple-500 to-indigo-500";
    return "from-emerald-500 to-teal-500";
  };

  const getBalanceStatus = (balance, eligible) => {
    const percentage = eligible > 0 ? (balance / eligible) * 100 : 0;
    if (percentage >= 70)
      return "text-emerald-600 bg-emerald-50 border-emerald-200";
    if (percentage >= 40) return "text-amber-600 bg-amber-50 border-amber-200";
    return "text-red-600 bg-red-50 border-red-200";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <div className="w-full container py-8 px-8">
        {/* Page Header */}
        <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between mb-6 gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => history.goBack()}
              className="w-10 h-10 flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              title="Go Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-semibold text-gray-900">
              My Leave Balance
            </h2>
          </div>
          <div className="flex gap-2">
            {/* <button
              onClick={()=>{}}
              disabled={refreshing || loading}
              className="text-sm text-gray-600 border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-2"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button> */}
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
              Loading leave balance...
            </p>
          </div>
        ) : leaveBalances.length === 0 ? (
          <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-xl p-16 text-center border border-gray-100">
            <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
              <Calendar className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">
              No Leave Balance Found
            </h3>
            <p className="text-base text-gray-600 max-w-md mx-auto">
              No leave balance information is available at the moment.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {leaveBalances.map((leave, index) => {
              const usedPercentage =
                leave.eligible > 0 ? (leave.taken / leave.eligible) * 100 : 0;

              return (
                <div
                  key={index}
                  className="group/card relative bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-300 border border-gray-100 hover:border-[var(--p-blue)]/50 overflow-hidden"
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
                    <div className="mb-6">
                      <h4 className="text-lg font-bold text-gray-900">
                        {leave.name}
                      </h4>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-6">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-medium text-gray-600">
                          Used
                        </span>
                        <span className="text-xs font-bold text-gray-900">
                          {usedPercentage.toFixed(0)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                        <div
                          className={`h-full bg-gradient-to-r ${getLeaveTypeColor(
                            leave.name
                          )} rounded-full transition-all duration-500`}
                          style={{ width: `${Math.min(usedPercentage, 100)}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Main Stats Grid */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="text-center p-3 rounded-lg bg-blue-50 border border-blue-100">
                        <p className="text-xs font-medium text-blue-600 mb-1">
                          Eligible
                        </p>
                        <p className="text-lg font-bold text-blue-900">
                          {leave.eligible?.toFixed(1) || "0.0"}
                        </p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-orange-50 border border-orange-100">
                        <p className="text-xs font-medium text-orange-600 mb-1">
                          Taken
                        </p>
                        <p className="text-lg font-bold text-orange-900">
                          {leave.taken?.toFixed(1) || "0.0"}
                        </p>
                      </div>
                      <div
                        className={`text-center p-3 rounded-lg border ${getBalanceStatus(
                          leave.balance,
                          leave.eligible
                        )}`}
                      >
                        <p className="text-xs font-medium mb-1">Balance</p>
                        <p className="text-lg font-bold">
                          {leave.balance?.toFixed(1) || "0.0"}
                        </p>
                      </div>
                    </div>

                    {/* Breakdown Section */}
                    {(leave.currentYearEligible !== undefined ||
                      leave.carryOverEligible !== undefined) && (
                      <div className="pt-4 border-t border-gray-200">
                        <p className="text-xs font-semibold text-gray-600 mb-2">
                          Eligibility Breakdown
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {leave.currentYearEligible !== undefined && (
                            <div className="p-2 bg-gray-50 rounded-lg">
                              <p className="text-[10px] text-gray-500 mb-1">
                                Current Year
                              </p>
                              <p className="text-sm font-semibold text-gray-900">
                                {leave.currentYearEligible?.toFixed(1) || "0.0"}
                              </p>
                            </div>
                          )}
                          {leave.carryOverEligible !== undefined && (
                            <div className="p-2 bg-gray-50 rounded-lg">
                              <p className="text-[10px] text-gray-500 mb-1">
                                Carry Over
                              </p>
                              <p className="text-sm font-semibold text-gray-900">
                                {leave.carryOverEligible?.toFixed(1) || "0.0"}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default StaffIndividualLeaveBalancePage;
