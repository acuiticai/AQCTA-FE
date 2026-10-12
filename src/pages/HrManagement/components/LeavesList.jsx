import React, { useContext, useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
import { notifyError, notifySuccess } from "@/utils/toast";
import { CustomModal, ActionButtons } from "@/page-layouts/index";
import { formatDate } from "@/components/formatAmount";
import { AdminContext } from "@/context/AdminContext";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";
import { EpcPage } from "@/components/Epc/EpcSurface";
import FilterBar from "@/customer/components/ui/FilterBar";
import { Card, CardHeader } from "@/customer/components/ui/Card";
import PortalDataTable from "@/customer/components/ui/DataTable";
import Pagination from "@/customer/components/ui/Pagination";
import StatusPill from "@/customer/components/ui/StatusPill";

const LeavesList = ({
  leaves,
  updateLeaveStatus: parentUpdateLeaveStatus,
  currentPage,
  recordsPerPage,
  totalPages,
  totalResults = 0,
  onPageChange,
  onRecordsPerPageChange,
  loading,
  isStaff = false,
  searchParams = {},
  setSearchParams = () => {},
  departments = [],
  positions = [],
  onClearLeaveFilters = () => window.location.reload(),
}) => {
  const { t } = useTranslation();
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showApprovalLevelsModal, setShowApprovalLevelsModal] = useState(false);
  const [showCancellationRequestModal, setShowCancellationRequestModal] =
    useState(false);
  const [showCancellationApproveModal, setShowCancellationApproveModal] =
    useState(false);
  const [showCancellationRejectModal, setShowCancellationRejectModal] =
    useState(false);
  const [currentLeaveId, setCurrentLeaveId] = useState(null);
  const [currentLeave, setCurrentLeave] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [cancellationReason, setCancellationReason] = useState("");
  const [cancellationRejectionReason, setCancellationRejectionReason] =
    useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [systemUsers, setSystemUsers] = useState([]);
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;

  /** Prefer approval chain frozen at leave creation (matches backend). */
  const getLeaveApprovalChainForRow = (leave) => {
    const snap = leave?.approvalLevelsSnapshot;
    if (Array.isArray(snap) && snap.length > 0) return snap;
    return leave?.employee?.leaveApprovalLevels || [];
  };

  useEffect(() => {
    if (!adminInfo?.token) return;

    const fetchSystemUsers = async () => {
      try {
        const headers = {
          "Content-Type": "application/json",
          authorization: `Bearer ${adminInfo.token}`,
        };

        const response = await axios.post(
          `${Base_URL}/SystemUsers/get_all`,
          { FilterStatus: "", FilterName: "", page: 1, limit: 1000 },
          { headers }
        );

        setSystemUsers(response.data.data || []);
      } catch (error) {
        console.error("Error fetching system users:", error);
      }
    };

    fetchSystemUsers();
  }, [adminInfo?.token]);

  // Function to format date to DD-MM-YYYY
  // const formatDate = (dateString) => {
  //   const date = new Date(dateString);
  //   return format(date, "dd-MM-yyyy");
  // };

  // Check if leave date has passed
  const isLeaveDatePassed = (startDate) => {
    const currentDate = new Date();
    const leaveStartDate = new Date(startDate);

    // Reset time components to compare dates only
    currentDate.setHours(0, 0, 0, 0);
    leaveStartDate.setHours(0, 0, 0, 0);

    // console.log("start!", leaveStartDate, "currentDate!", currentDate);
    return leaveStartDate < currentDate;
  };

  // Check if cancellation can be requested (1 day before leave start)
  const canRequestCancellation = (leave) => {
    if (!leave.startDate) return false;
    if (leave.status === "Cancelled") return false;
    if (
      leave.cancellationRequest?.requested &&
      leave.cancellationRequest?.status === "Pending"
    )
      return false;

    const now = new Date();
    const leaveStartDate = new Date(leave.startDate);
    leaveStartDate.setHours(0, 0, 0, 0);

    const oneDayBefore = new Date(leaveStartDate);
    oneDayBefore.setDate(oneDayBefore.getDate() - 1);
    oneDayBefore.setHours(23, 59, 59, 999);

    return now <= oneDayBefore;
  };

  // Check if cancellation can be approved/rejected (6 hours before leave start)
  const canApproveCancellation = (leave) => {
    if (!leave) return false;
    if (
      !leave.cancellationRequest?.requested ||
      leave.cancellationRequest?.status !== "Pending"
    )
      return false;
    if (leave.status === "Cancelled") return false;
    if (!leave.startDate) return false;

    const now = new Date();
    const leaveStartDate = new Date(leave.startDate);
    const sixHoursBefore = new Date(leaveStartDate);
    sixHoursBefore.setHours(sixHoursBefore.getHours() - 6);

    return now <= sixHoursBefore;
  };

  // Helper function to format time remaining
  const formatTimeRemaining = (milliseconds) => {
    const totalHours = Math.floor(milliseconds / (1000 * 60 * 60));
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;

    if (days > 0) {
      return hours > 0
        ? `${days} day${days !== 1 ? "s" : ""} and ${hours} hour${
            hours !== 1 ? "s" : ""
          }`
        : `${days} day${days !== 1 ? "s" : ""}`;
    }
    return `${hours} hour${hours !== 1 ? "s" : ""}`;
  };

  // Get time remaining messages
  const getCancellationTimeMessage = (leave, isRequest = true) => {
    if (!leave.startDate) return "";

    const now = new Date();
    const leaveStartDate = new Date(leave.startDate);
    const oneDayBefore = new Date(leaveStartDate);
    oneDayBefore.setDate(oneDayBefore.getDate() - 1);
    oneDayBefore.setHours(23, 59, 59, 999);

    const sixHoursBefore = new Date(leaveStartDate);
    sixHoursBefore.setHours(sixHoursBefore.getHours() - 6);

    if (isRequest) {
      if (now > oneDayBefore) {
        const timeRemaining = Math.max(0, leaveStartDate - now);
        const hoursRemaining = Math.floor(timeRemaining / (1000 * 60 * 60));

        if (hoursRemaining <= 0) {
          return "❌ Deadline passed. Cancellation requests must be made at least 1 day before the leave start date.";
        }

        const timeStr = formatTimeRemaining(timeRemaining);
        return `⚠️ Deadline passed. Only ${timeStr} remaining. Cancellation requests must be made at least 1 day before the leave start date.`;
      }
      const timeUntilDeadline = oneDayBefore - now;
      const timeStr = formatTimeRemaining(timeUntilDeadline);
      return `⏰ Cancellation requests must be made at least 1 day before the leave start date. ${timeStr} remaining.`;
    } else {
      if (now > sixHoursBefore) {
        const timeRemaining = Math.max(0, leaveStartDate - now);
        const hoursRemaining = Math.floor(timeRemaining / (1000 * 60 * 60));

        if (hoursRemaining <= 0) {
          return "❌ Deadline passed. Approval/rejection must be done at least 6 hours before the leave start date.";
        }

        const timeStr = formatTimeRemaining(timeRemaining);
        return `⚠️ Deadline passed. Only ${timeStr} remaining. Approval/rejection must be done at least 6 hours before the leave start date.`;
      }
      const timeUntilDeadline = sixHoursBefore - now;
      const timeStr = formatTimeRemaining(timeUntilDeadline);
      return `⏰ Approval/rejection must be done at least 6 hours before the leave start date. ${timeStr} remaining.`;
    }
  };

  // Helper function to compare IDs (handles ObjectId, string, etc.)
  const compareIds = (id1, id2) => {
    if (!id1 || !id2) return false;
    // Handle both string and object IDs
    const str1 = String(id1.toString ? id1.toString() : id1);
    const str2 = String(id2.toString ? id2.toString() : id2);
    const matches = str1 === str2;
    if (!matches) {
      console.log("ID comparison failed:", { id1, id2, str1, str2 });
    }
    return matches;
  };

  // Check if current user can approve at a specific level
  const canUserApproveAtLevel = (leave, level) => {
    if (
      !adminInfo ||
      (!leave.employee && getLeaveApprovalChainForRow(leave).length === 0)
    ) {
      console.log("canUserApproveAtLevel: No adminInfo or employee");
      return false;
    }

    const leaveApprovalLevels = getLeaveApprovalChainForRow(leave);
    // Handle both numeric and string level comparisons
    const levelConfig = leaveApprovalLevels.find((l) => {
      const configLevel =
        typeof l.level === "number" ? l.level : parseInt(l.level);
      const checkLevel = typeof level === "number" ? level : parseInt(level);
      return configLevel === checkLevel;
    });

    if (!levelConfig || !levelConfig.role) {
      console.log(`canUserApproveAtLevel: No config found for level ${level}`, {
        level,
        leaveApprovalLevels,
        levelConfig,
      });
      return false;
    }

    // Get user's role name
    const userRoleName = adminInfo.role?.name || adminInfo.role || "";

    // Get user's ID - handle both formats
    const userId = adminInfo.id
      ? adminInfo.id.toString
        ? adminInfo.id.toString()
        : String(adminInfo.id)
      : adminInfo._id?.toString
      ? adminInfo._id.toString()
      : String(adminInfo._id || "");

    // Get required role name (role is now stored as string, not object)
    const requiredRoleName = levelConfig.role || "";

    // Get required user ID (if specified)
    const requiredUserId = levelConfig.user?._id
      ? levelConfig.user._id.toString
        ? levelConfig.user._id.toString()
        : String(levelConfig.user._id)
      : levelConfig.user?.toString
      ? levelConfig.user.toString()
      : String(levelConfig.user || "");

    // Check if user's role matches (compare by name)
    const roleMatches =
      userRoleName && requiredRoleName && userRoleName === requiredRoleName;

    console.log("canUserApproveAtLevel check:", {
      level,
      userRoleName,
      requiredRoleName,
      roleMatches,
      userId,
      requiredUserId,
      userMatches: requiredUserId ? compareIds(requiredUserId, userId) : "N/A",
    });

    // If specific user is set, only that user can approve (and must have the role)
    if (requiredUserId) {
      const userMatches = compareIds(requiredUserId, userId);
      const canApprove = roleMatches && userMatches;
      console.log(`canUserApproveAtLevel level ${level}:`, canApprove);
      return canApprove;
    } else {
      // If only role is set, any user with that role can approve
      console.log(
        `canUserApproveAtLevel level ${level} (role only):`,
        roleMatches
      );
      return roleMatches;
    }
  };

  // Check if previous levels are approved
  const arePreviousLevelsApproved = (leave, level) => {
    if (level === 1) return true; // First level doesn't need previous approvals

    const approvals = leave.approvals || [];
    const approvedLevels = approvals
      .filter((a) => a.status === "Approved")
      .map((a) => a.level);

    // Check all levels before current level
    for (let i = 1; i < level; i++) {
      if (!approvedLevels.includes(i)) {
        return false;
      }
    }
    return true;
  };

  // Get the next level that can be approved
  const getNextApprovableLevel = (leave) => {
    const approvals = leave.approvals || [];
    const approvedLevels = approvals
      .filter((a) => a.status === "Approved")
      .map((a) => a.level);

    console.log("getNextApprovableLevel:", {
      leaveId: leave._id,
      approvals,
      approvedLevels,
      employee: leave.employee?.displayName,
    });

    // Get all configured levels sorted
    const leaveApprovalLevels = getLeaveApprovalChainForRow(leave);
    const sortedLevels =
      leaveApprovalLevels.length > 0
        ? [...leaveApprovalLevels]
            .map((l) => ({
              ...l,
              level: typeof l.level === "number" ? l.level : parseInt(l.level),
            }))
            .sort((a, b) => a.level - b.level)
            .map((l) => l.level)
        : [];

    // If no levels configured, use default level 1
    const levelsToCheck = sortedLevels.length > 0 ? sortedLevels : [1];

    console.log("getNextApprovableLevel levelsToCheck:", levelsToCheck);

    for (const level of levelsToCheck) {
      // Skip if already approved
      if (approvedLevels.includes(level)) {
        console.log(`Level ${level} already approved, skipping`);
        continue;
      }

      // Check if previous levels are approved (level 1 doesn't need previous)
      if (level >= 1) {
        let allPreviousApproved = true;
        for (let prevLevel = 1; prevLevel < level; prevLevel++) {
          if (!approvedLevels.includes(prevLevel)) {
            allPreviousApproved = false;
            break;
          }
        }
        if (!allPreviousApproved) {
          console.log(`Level ${level} - previous levels not approved yet`);
          continue; // Previous levels not approved yet
        }
      }

      // Check if user can approve at this level
      console.log(`Checking if user can approve at level ${level}`);
      if (canUserApproveAtLevel(leave, level)) {
        console.log(`User CAN approve at level ${level}`);
        return level;
      } else {
        console.log(`User CANNOT approve at level ${level}`);
      }
    }

    console.log("getNextApprovableLevel: No approvable level found");
    return null;
  };

  const renderApprovals = (leave) => {
    const leaveApprovalLevels = getLeaveApprovalChainForRow(leave);

    if (leaveApprovalLevels.length === 0) {
      return <span className="text-gray-400 text-sm">No approval levels</span>;
    }

    // Group approvals by level
    const approvalsByLevel = {};
    (leave.approvals || []).forEach((approval) => {
      if (!approvalsByLevel[approval.level]) {
        approvalsByLevel[approval.level] = [];
      }
      approvalsByLevel[approval.level].push(approval);
    });

    // Create array of all configured levels
    const allLevels = leaveApprovalLevels
      .map((l) => l.level)
      .sort((a, b) => a - b);

    return (
      <div className="space-y-2">
        {allLevels.map((level) => {
          const levelApprovals = approvalsByLevel[level] || [];
          const levelConfig = leaveApprovalLevels.find(
            (l) => l.level === level
          );
          // Role is now stored as name (string), not as object with _id
          const roleName = levelConfig?.role || `Level ${level}`;
          const userName = levelConfig?.user
            ? `${levelConfig.user.name || ""} ${
                levelConfig.user.last_name || ""
              }`.trim() || levelConfig.user.email
            : null;

          const approved = levelApprovals.some((a) => a.status === "Approved");
          const rejected = levelApprovals.some((a) => a.status === "Rejected");
          const pending = !approved && !rejected;

          const approval = levelApprovals.find(
            (a) => a.status === "Approved" || a.status === "Rejected"
          );
          const canApprove =
            canUserApproveAtLevel(leave, level) &&
            arePreviousLevelsApproved(leave, level);
          const isNextLevel = getNextApprovableLevel(leave) === level;

          return (
            <div
              key={level}
              className="border-l-2 pl-2 py-1"
              style={{
                borderColor: approved
                  ? "#10b981"
                  : rejected
                  ? "#ef4444"
                  : "#f59e0b",
              }}
            >
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-gray-700">
                  Level {level}:
                </span>
                {approved ? (
                  <span className="text-green-600 font-medium">✓ Approved</span>
                ) : rejected ? (
                  <span className="text-red-600 font-medium">✗ Rejected</span>
                ) : (
                  <span className="text-yellow-600 font-medium">
                    ⏳ Pending
                  </span>
                )}
                {isNextLevel && canApprove && (
                  <span className="text-blue-600 font-medium text-[10px] bg-blue-50 px-1.5 py-0.5 rounded">
                    Your Turn
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-600 mt-0.5">
                <div className="mb-1">
                  <span className="font-semibold">Role:</span>{" "}
                  <span className="font-medium">{roleName}</span>
                </div>
                {userName ? (
                  <div className="mb-1">
                    <span className="font-semibold">Assigned User:</span>
                    <div className="ml-2 mt-0.5">
                      <div className="font-medium">{userName}</div>
                      {levelConfig.user?.email && (
                        <div className="text-gray-500 text-[10px]">
                          {levelConfig.user.email}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="mb-1">
                    <span className="font-semibold">Eligible Users:</span>
                    <div className="ml-2 mt-0.5 space-y-0.5 max-h-32 overflow-y-auto">
                      {(() => {
                        // Role is now stored as name (string), not as object
                        const roleName = levelConfig.role || "";
                        const usersWithRole = systemUsers.filter((user) => {
                          if (!user.role) return false;
                          const userRoleName = user.role?.name || user.role;
                          return (
                            userRoleName &&
                            roleName &&
                            userRoleName === roleName
                          );
                        });

                        if (usersWithRole.length === 0) {
                          return (
                            <div className="text-gray-400 italic text-[10px]">
                              No users found with this role
                            </div>
                          );
                        }

                        return usersWithRole.map((user) => (
                          <div key={user._id} className="text-[10px]">
                            <span className="font-medium">
                              {user.name} {user.last_name ? user.last_name : ""}
                            </span>
                            {user.email && (
                              <span className="text-gray-500 ml-1">
                                ({user.email})
                              </span>
                            )}
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                )}
              </div>
              {approval && (
                <div className="text-xs text-gray-500 mt-0.5">
                  {approval.status === "Approved" ? "Approved" : "Rejected"} by{" "}
                  {approval.role || roleName}
                  {approval.date && (
                    <span className="ml-1">on {formatDate(approval.date)}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const HandleOpenFile = async (documentId) => {
    try {
      let Response = await axios.get(
        `${Base_URL}/documents/getFileWithAllData/${documentId}`
      );
      window.open(Response.data.data.url, "_blank");
    } catch (error) {
      console.log("Error : ", error);
    }
  };

  const handleApproveClick = (leaveId) => {
    setCurrentLeaveId(leaveId);
    setShowApproveModal(true);
  };

  const handleRejectClick = (leaveId) => {
    setCurrentLeaveId(leaveId);
    setRejectReason("");
    setShowRejectModal(true);
  };

  const handleApproveConfirm = async () => {
    setIsSubmitting(true);
    try {
      await parentUpdateLeaveStatus(currentLeaveId, "Approved");
      setShowApproveModal(false);
      notifySuccess("Leave successfully approved!"); // Success toast
    } catch (error) {
      console.error("Error approving leave:", error);
      notifyError(
        error?.response?.data?.message ||
          "Failed to approve leave. Please try again."
      ); // Error toast with server message
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectReason.trim()) {
      return; // Don't submit if reason is empty
    }

    setIsSubmitting(true);
    try {
      await parentUpdateLeaveStatus(currentLeaveId, "Rejected", rejectReason);
      setShowRejectModal(false);
      setRejectReason("");
      notifySuccess("Leave successfully rejected!"); // Success toast
    } catch (error) {
      console.error("Error rejecting leave:", error?.response?.data?.message);
      notifyError(
        error?.response?.data?.message ||
          "Failed to reject leave. Please try again."
      ); // Error toast with server message
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancellationRequest = (leaveId) => {
    setCurrentLeaveId(leaveId);
    setCancellationReason("");
    setShowCancellationRequestModal(true);
  };

  const handleCancellationRequestConfirm = async () => {
    setIsSubmitting(true);
    try {
      const headers = {
        "Content-Type": "application/json",
        authorization: `Bearer ${adminInfo?.token}`,
      };

      const response = await axios.post(
        `${Base_URL}/leaves/${currentLeaveId}/cancellation-request`,
        { reason: cancellationReason },
        { headers }
      );

      if (response.data.success) {
        setShowCancellationRequestModal(false);
        setCancellationReason("");
        notifySuccess("Cancellation request submitted successfully!");
        // Refresh the page to show updated data
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    } catch (error) {
      console.error("Error requesting cancellation:", error);
      notifyError(
        error?.response?.data?.message ||
          "Failed to submit cancellation request. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancellationApprove = (leaveId) => {
    setCurrentLeaveId(leaveId);
    setShowCancellationApproveModal(true);
    setCurrentLeave(leaves.find((l) => l._id === leaveId));
  };

  const handleCancellationReject = (leaveId) => {
    setCurrentLeaveId(leaveId);
    setCancellationRejectionReason("");
    setShowCancellationRejectModal(true);
    setCurrentLeave(leaves.find((l) => l._id === leaveId));
  };

  const handleCancellationApproveConfirm = async () => {
    setIsSubmitting(true);
    try {
      const headers = {
        "Content-Type": "application/json",
        authorization: `Bearer ${adminInfo?.token}`,
      };

      const response = await axios.put(
        `${Base_URL}/leaves/${currentLeaveId}/cancellation-status`,
        { status: "Approved" },
        { headers }
      );

      if (response.data.success) {
        setShowCancellationApproveModal(false);
        notifySuccess("Cancellation request approved successfully!");
        // Refresh the page to show updated data
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    } catch (error) {
      console.error("Error approving cancellation:", error);
      notifyError(
        error?.response?.data?.message ||
          "Failed to approve cancellation request. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancellationRejectConfirm = async () => {
    if (!cancellationRejectionReason.trim()) {
      notifyError("Please provide a reason for rejection");
      return;
    }

    setIsSubmitting(true);
    try {
      const headers = {
        "Content-Type": "application/json",
        authorization: `Bearer ${adminInfo?.token}`,
      };

      const response = await axios.put(
        `${Base_URL}/leaves/${currentLeaveId}/cancellation-status`,
        {
          status: "Rejected",
          rejectionReason: cancellationRejectionReason,
        },
        { headers }
      );

      if (response.data.success) {
        setShowCancellationRejectModal(false);
        setCancellationRejectionReason("");
        notifySuccess("Cancellation request rejected successfully!");
        // Refresh the page to show updated data
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    } catch (error) {
      console.error("Error rejecting cancellation:", error);
      notifyError(
        error?.response?.data?.message ||
          "Failed to reject cancellation request. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check if current user has already approved at any level
  const hasUserApproved = (leave) => {
    if (!adminInfo || !leave.approvals) return false;

    const userId = adminInfo.id
      ? adminInfo.id.toString
        ? adminInfo.id.toString()
        : String(adminInfo.id)
      : adminInfo._id?.toString
      ? adminInfo._id.toString()
      : String(adminInfo._id || "");

    return leave.approvals.some(
      (approval) =>
        approval.status === "Approved" &&
        (approval.userId === userId ||
          approval.user?._id?.toString() === userId ||
          approval.user?._id === userId ||
          String(approval.user?._id || "") === userId)
    );
  };

  // Get count of remaining approvals needed
  const getRemainingApprovalsCount = (leave) => {
    const leaveApprovalLevels = getLeaveApprovalChainForRow(leave);
    if (leaveApprovalLevels.length === 0) return 0;

    const approvals = leave.approvals || [];
    const approvedLevels = approvals
      .filter((a) => a.status === "Approved")
      .map((a) => a.level);

    const allLevels = leaveApprovalLevels.map((l) =>
      typeof l.level === "number" ? l.level : parseInt(l.level)
    );
    const maxLevel = Math.max(...allLevels);

    return maxLevel - approvedLevels.length;
  };

  // Check if user can approve/reject this leave
  const canUserApproveLeave = (leave) => {
    if (
      !adminInfo ||
      (!leave.employee && getLeaveApprovalChainForRow(leave).length === 0)
    )
      return { result: false, message: "No admin info or employee" };

    // No actions if leave date has passed
    if (isLeaveDatePassed(leave.startDate)) {
      return { result: false, message: "Leave date has passed" };
    }

    // Only pending leaves can be acted upon
    if (leave.status !== "Pending") {
      return { result: false, message: "N/A" };
    }

    // Check if user can approve at any level
    const nextLevel = getNextApprovableLevel(leave);
    return {
      result: nextLevel !== null,
      message: "User can approve leave at level " + nextLevel,
    };
  };

  const handleViewApprovalLevels = (leave) => {
    setCurrentLeave(leave);
    setShowApprovalLevelsModal(true);
  };

  // Determines which action buttons to show based on status
  const getActionButtons = (leave) => {
    // Check for cancellation request status
    const hasCancellationRequest =
      leave.cancellationRequest?.requested &&
      leave.cancellationRequest?.status === "Pending";
    const cancellationApproved =
      leave.cancellationRequest?.status === "Approved";
    const cancellationRejected =
      leave.cancellationRequest?.status === "Rejected";

    // Check if current user has already approved
    const userHasApproved = hasUserApproved(leave);
    const remainingCount = getRemainingApprovalsCount(leave);
    const leaveApprovalLevels = getLeaveApprovalChainForRow(leave);

    const viewLeaveItem = {
      action: ACTION_BUTTON_TYPES.VIEW,
      tooltip: t("leaveManagement.viewLeaveDetails"),
      permission: true,
      onClick: () => handleViewApprovalLevels(leave),
    };

    // Show approval levels summary with view button
    const renderApprovalSummary = () => {
      if (leaveApprovalLevels.length === 0) {
        return (
          <button
            onClick={() => handleViewApprovalLevels(leave)}
            className="text-gray-400 text-xs hover:text-gray-600 underline"
          >
            View Details
          </button>
        );
      }

      const approvals = leave.approvals || [];
      const approvedLevels = approvals
        .filter((a) => a.status === "Approved")
        .map((a) => a.level);
      const rejectedLevels = approvals
        .filter((a) => a.status === "Rejected")
        .map((a) => a.level);
      const levelsMatchAllApproved = leaveApprovalLevels.every((l) =>
        approvedLevels.includes(
          typeof l.level === "number" ? l.level : parseInt(l.level)
        )
      );
      const anyRejected = rejectedLevels.length > 0;
      // Terminal status from the leave record — do not derive from current
      // employee leaveApprovalLevels (those can change after the leave was finalized).
      const allApproved =
        leave.status === "Approved" || levelsMatchAllApproved;

      return (
        <button
          onClick={() => handleViewApprovalLevels(leave)}
          className="text-blue-600 text-xs hover:text-blue-800 underline"
        >
          {allApproved
            ? leave.status === "Approved" && !levelsMatchAllApproved
              ? "Approved"
              : `All ${leaveApprovalLevels.length} Approved`
            : leave.status === "Rejected" || anyRejected
            ? `Rejected (${rejectedLevels.length || "—"})`
            : `${approvedLevels.length}/${leaveApprovalLevels.length} Approved`}
        </button>
      );
    };

    const wrapActions = (iconRow, extras = null) => (
      <div className="flex flex-col items-center gap-0.5 w-full px-1 text-center align-top">
        {iconRow != null && (
          <div className="flex justify-center w-full overflow-visible leading-none">
            {iconRow}
          </div>
        )}
        {extras}
        {renderApprovalSummary()}
      </div>
    );

    // If cancellation is approved, show cancelled status
    if (cancellationApproved) {
      return wrapActions(
        <ActionButtons isCell justifyCenter items={[viewLeaveItem]} />,
        <span className="text-gray-500 text-sm font-medium">Cancelled</span>
      );
    }

    // Show cancellation request actions for non-staff (only if user can't approve leave)
    if (!isStaff && hasCancellationRequest && canApproveCancellation(leave)) {
      return (
        <div className="flex flex-col items-center gap-0.5 w-full px-1 text-center">
          <div className="flex justify-center w-full overflow-visible">
            <ActionButtons isCell justifyCenter items={[viewLeaveItem]} />
          </div>
          <div className="flex flex-col justify-center gap-2 mb-1 w-full max-w-xs mx-auto">
            <button
              onClick={() => handleCancellationApprove(leave._id)}
              className="bg-green-500 hover:bg-green-600 text-white text-xs px-3 py-1 rounded"
            >
              Approve Cancellation
            </button>
            <button
              onClick={() => handleCancellationReject(leave._id)}
              className="bg-red-500 hover:bg-red-600 text-white text-xs px-3 py-1 rounded"
            >
              Reject Cancellation
            </button>
          </div>
          <span className="text-orange-600 text-xs font-medium">
            Cancellation Request Pending
          </span>
          <div className="relative group">
            <svg
              className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              ></path>
            </svg>
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 max-w-xs">
              {getCancellationTimeMessage(leave, false)}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                <div className="border-4 border-transparent border-t-gray-800"></div>
              </div>
            </div>
          </div>
          {renderApprovalSummary()}
        </div>
      );
    }

    // Show cancellation request status (only if user can't approve leave)
    if (hasCancellationRequest && !canApproveCancellation(leave)) {
      return (
        <div className="flex flex-col items-center gap-0.5 w-full px-1 text-center">
          <div className="flex justify-center w-full overflow-visible">
            <ActionButtons isCell justifyCenter items={[viewLeaveItem]} />
          </div>
          <span className="text-orange-600 text-sm font-medium">
            Cancellation Request Pending
          </span>
          <div className="relative group">
            <svg
              className="w-4 h-4 text-red-400 hover:text-red-600 cursor-help"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              ></path>
            </svg>
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 max-w-xs">
              {getCancellationTimeMessage(leave, false)}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                <div className="border-4 border-transparent border-t-gray-800"></div>
              </div>
            </div>
          </div>
          {renderApprovalSummary()}
        </div>
      );
    }

    // Check if user can approve the leave (prioritize this over cancellation requests)
    const canApproveLeave = canUserApproveLeave(leave);
    if (canApproveLeave.result) {
      const nextLevel = getNextApprovableLevel(leave);
      const levelConfig = getLeaveApprovalChainForRow(leave).find(
        (l) => l.level === nextLevel
      );
      // Role is now stored as name (string), not as object
      const roleName = levelConfig?.role || `Level ${nextLevel}`;

      return wrapActions(
        <ActionButtons
          isCell
          justifyCenter
          items={[
            viewLeaveItem,
            {
              action: ACTION_BUTTON_TYPES.APPROVE,
              tooltip: t("leaveManagement.approveLeave", {
                level: nextLevel,
                role: roleName,
              }),
              permission: true,
              onClick: () => handleApproveClick(leave._id),
            },
            {
              action: ACTION_BUTTON_TYPES.REJECT,
              tooltip: t("leaveManagement.rejectLeave", {
                level: nextLevel,
                role: roleName,
              }),
              permission: true,
              onClick: () => handleRejectClick(leave._id),
            },
          ]}
        />,
        <span className="text-xs text-gray-500">
          {t("leaveManagement.approvalLevelShort", { level: nextLevel })}
        </span>
      );
    }

    if (userHasApproved && leave.status === "Pending") {
      if (remainingCount > 0) {
        return wrapActions(
          <ActionButtons isCell justifyCenter items={[viewLeaveItem]} />,
          <>
            <span className="text-green-600 text-sm font-medium">
              ✓ {t("leaveManagement.approvedLabel")}
            </span>
            <span className="text-gray-500 text-xs max-w-[280px] leading-snug">
              {remainingCount === 1
                ? t("leaveManagement.waitingOneMoreApproval")
                : t("leaveManagement.waitingMoreApprovals", {
                    count: remainingCount,
                  })}
            </span>
          </>
        );
      } else {
        return wrapActions(
          <ActionButtons isCell justifyCenter items={[viewLeaveItem]} />,
          <span className="text-green-600 text-sm font-medium">
            ✓ {t("leaveManagement.approvedLabel")}
          </span>
        );
      }
    }

    if (!canApproveLeave.result) {
      const nextLevel = getNextApprovableLevel(leave);
      if (nextLevel === null && leave.status === "Pending") {
        if (remainingCount > 0) {
          return wrapActions(
            <ActionButtons isCell justifyCenter items={[viewLeaveItem]} />,
            <span className="text-gray-400 text-sm italic max-w-[280px] leading-snug">
              {remainingCount === 1
                ? t("leaveManagement.waitingOneApproval")
                : t("leaveManagement.waitingManyApprovals", {
                    count: remainingCount,
                  })}
            </span>
          );
        }
        return wrapActions(
          <ActionButtons isCell justifyCenter items={[viewLeaveItem]} />,
          <span className="text-gray-400 text-sm italic">
            {t("leaveManagement.waitingPreviousApprovals")}
          </span>
        );
      }
      return wrapActions(
        <ActionButtons isCell justifyCenter items={[viewLeaveItem]} />,
        <span className="text-gray-400 text-sm italic">
          {canApproveLeave.message}
        </span>
      );
    }

    // Fallback - should not reach here
    return wrapActions(
      <ActionButtons isCell justifyCenter items={[viewLeaveItem]} />,
      <span className="text-gray-400 text-sm italic">
        {canApproveLeave.message}
      </span>
    );
  };

  const portalFilters = useMemo(() => {
    const filters = [];

    if (!isStaff) {
      filters.push(
        {
          key: "department",
          placeholder: t("leaveManagement.searchByDepartment"),
          options: [
            { value: "", label: t("leaveManagement.searchByDepartment") },
            ...(departments?.map((dept) => ({
              value: dept._id,
              label: dept.name,
            })) || []),
          ],
        },
        {
          key: "position",
          placeholder: t("leaveManagement.searchByPosition"),
          options: [
            { value: "", label: t("leaveManagement.searchByPosition") },
            ...(positions?.map((pos) => ({
              value: pos._id,
              label: pos.name,
            })) || []),
          ],
        }
      );
    }

    filters.push({
      key: "status",
      placeholder: t("leaveManagement.searchByStatus"),
      options: [
        { value: "", label: t("leaveManagement.searchByStatus") },
        { value: "Applied", label: "Applied" },
        { value: "Approved", label: "Approved" },
        { value: "Rejected", label: "Rejected" },
        { value: "Cancelled", label: "Cancelled" },
      ],
    });

    return filters;
  }, [departments, positions, isStaff, t]);

  const portalFilterValues = {
    department: searchParams.department || "",
    position: searchParams.position || "",
    status: searchParams.status || "",
  };

  const handlePortalFilterChange = (key, value) => {
    setSearchParams((prev) => ({ ...prev, [key]: value || "" }));
  };

  const filteredLeaves = leaves.filter(
    (leave) =>
      leave.employee?.displayName
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      leave.leaveType?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      leave.status?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderLeaveStatusCell = (leave) => {
    const leaveApprovalLevels = getLeaveApprovalChainForRow(leave);
    const approvals = leave.approvals || [];

    if (leaveApprovalLevels.length === 0) {
      const displayStatus =
        leave.status === "Cancelled" ? "Cancelled" : leave.status;
      return <StatusPill status={displayStatus || "—"} />;
    }

    if (
      leave.status === "Cancelled" ||
      leave.cancellationRequest?.status === "Approved"
    ) {
      return <StatusPill status="Cancelled" />;
    }

    if (leave.status === "Approved") {
      return (
        <div className="flex flex-col gap-1.5 w-fit max-w-[200px]">
          <StatusPill status="Approved" />
          <div
            className="relative group cursor-pointer w-full"
            title="This leave has been fully approved"
          >
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div className="bg-green-500 h-2 w-full rounded-full" />
            </div>
          </div>
        </div>
      );
    }

    if (leave.status === "Rejected") {
      return (
        <div className="flex flex-col gap-1.5 w-fit max-w-[200px]">
          <StatusPill status="Rejected" />
          <div
            className="relative group cursor-pointer w-full"
            title="This leave has been rejected"
          >
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div className="bg-red-500 h-2 w-full rounded-full" />
            </div>
          </div>
        </div>
      );
    }

    const allLevels = leaveApprovalLevels
      .map((l) => ({
        level: typeof l.level === "number" ? l.level : parseInt(l.level),
        config: l,
      }))
      .sort((a, b) => a.level - b.level);

    const approvedLevels = approvals
      .filter((a) => a.status === "Approved")
      .map((a) => a.level);
    const rejectedLevels = approvals
      .filter((a) => a.status === "Rejected")
      .map((a) => a.level);

    const allApproved = allLevels.every((l) =>
      approvedLevels.includes(l.level)
    );
    const anyRejected = rejectedLevels.length > 0;
    const pendingCount = allLevels.length - approvedLevels.length;

    const tooltipText = allApproved
      ? `All ${allLevels.length} level(s) approved`
      : anyRejected
        ? `Rejected at level(s): ${rejectedLevels.join(", ")}`
        : `${approvedLevels.length} of ${allLevels.length} level(s) approved. ${pendingCount} remaining.`;

    const overallStatus = allApproved
      ? "Approved"
      : anyRejected
        ? "Rejected"
        : "Pending";

    return (
      <div className="flex flex-col gap-1.5 w-fit max-w-[200px]">
        <StatusPill status={overallStatus} />
        <div
          className="relative group cursor-pointer w-full"
          title={tooltipText}
        >
          <div className="w-full bg-gray-200 rounded-full h-2 flex overflow-hidden">
            {allLevels.map((levelInfo, index) => {
              const isApproved = approvedLevels.includes(levelInfo.level);
              const isRejected = rejectedLevels.includes(levelInfo.level);
              let bgColor = "bg-gray-300";
              if (isApproved) bgColor = "bg-green-500";
              if (isRejected) bgColor = "bg-red-500";

              return (
                <div
                  key={levelInfo.level}
                  className={`${bgColor} flex-1 ${
                    index < allLevels.length - 1 ? "border-r border-white" : ""
                  } transition-colors duration-200`}
                  style={{ width: `${100 / allLevels.length}%` }}
                  title={`Level ${levelInfo.level}: ${
                    isApproved
                      ? "Approved"
                      : isRejected
                        ? "Rejected"
                        : "Pending"
                  }`}
                />
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderStaffActions = (leave) => {
    const hasCancellationRequest =
      leave.cancellationRequest?.requested &&
      leave.cancellationRequest?.status === "Pending";
    const cancellationApproved =
      leave.cancellationRequest?.status === "Approved";
    const canCancel =
      canRequestCancellation(leave) &&
      leave.status !== "Cancelled" &&
      !hasCancellationRequest;

    if (leave.status === "Cancelled" || cancellationApproved) {
      return (
        <span className="text-gray-400 text-sm font-medium flex flex-col items-center gap-1">
          <span>N/A</span>
        </span>
      );
    }

    if (hasCancellationRequest) {
      return (
        <div className="flex items-center justify-center gap-1">
          <span className="text-orange-600 text-sm font-medium text-center flex flex-col items-center justify-center gap-1">
            <span>Cancellation</span> <span>Requested</span>
          </span>
          <div className="relative group">
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 max-w-xs whitespace-normal text-left">
              {getCancellationTimeMessage(leave, false)}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                <div className="border-4 border-transparent border-t-gray-800"></div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (canCancel) {
      return (
        <div className="flex items-center justify-center gap-1">
          <div className="relative group">
            <button
              type="button"
              onClick={() => handleCancellationRequest(leave._id)}
              className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs px-3 py-1.5 rounded transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                ></path>
              </svg>
              <span>Cancel</span>
            </button>
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 max-w-xs whitespace-normal text-left">
              {getCancellationTimeMessage(leave, true)}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                <div className="border-4 border-transparent border-t-gray-800"></div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center gap-1">
        <span className="text-gray-400 text-sm font-medium flex flex-col items-center gap-1">
          <span>N/A</span>
        </span>
        <div className="relative group">
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 max-w-xs">
            {getCancellationTimeMessage(leave, true)}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
              <div className="border-4 border-transparent border-t-gray-800"></div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const columns = useMemo(
    () => [
      ...(!isStaff
        ? [
            {
              key: "name",
              header: t("leaveManagement.name"),
              render: (leave) => (
                <div className="flex items-center gap-2">
                  {leave.employee?.image ? (
                    <img
                      src={`${leave.employee?.image}`}
                      alt={leave.employee.displayName}
                      className="w-10 h-10 rounded-xl object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                      {leave.employee?.displayName?.charAt(0) || "?"}
                    </div>
                  )}
                  <span className="epc-cell__primary">
                    {leave.employee?.displayName || "—"}
                  </span>
                </div>
              ),
            },
          ]
        : []),
      {
        key: "leaveType",
        header: t("leaveManagement.leaveType"),
        render: (leave) => (
          <span className="epc-cell__primary">
            {leave.leaveType?.name || "—"}
          </span>
        ),
      },
      {
        key: "startDate",
        header: t("leaveManagement.startDate"),
        render: (leave) => formatDate(leave.startDate),
      },
      {
        key: "endDate",
        header: t("leaveManagement.endDate"),
        render: (leave) => formatDate(leave.endDate),
      },
      {
        key: "documents",
        header: t("leaveManagement.supportingDocuments"),
        render: (leave) =>
          leave.supportingDocuments ? (
            <button
              type="button"
              onClick={() =>
                HandleOpenFile(leave.supportingDocuments.fileId)
              }
              className="epc-cell__link"
            >
              {leave.supportingDocuments.name}
            </button>
          ) : (
            "—"
          ),
      },
      {
        key: "status",
        header: t("leaveManagement.status"),
        render: (leave) => renderLeaveStatusCell(leave),
      },
      {
        key: "remarks",
        header: t("leaveManagement.remarks"),
        render: (leave) => (
          <span className="epc-cell__secondary">{leave.remarks || "—"}</span>
        ),
      },
      {
        key: "actions",
        header: t("leaveManagement.action"),
        align: "right",
        render: (leave) =>
          isStaff ? renderStaffActions(leave) : getActionButtons(leave),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, isStaff]
  );

  const tableRows = filteredLeaves.filter((leave) => leave?.employee);

  return (
    <EpcPage flush>
      <div className="epc-stack">
      <FilterBar
        subtitle={t("leaveManagement.search")}
        searchPlaceholder={
          isStaff
            ? t("leaveManagement.search")
            : t("leaveManagement.searchByNameIc")
        }
        searchValue={isStaff ? searchQuery : searchParams.name || searchQuery}
        onSearchChange={(value) => {
          setSearchQuery(value);
          if (!isStaff) {
            setSearchParams((prev) => ({ ...prev, name: value }));
          }
        }}
        filters={portalFilters}
        values={portalFilterValues}
        onChange={handlePortalFilterChange}
        onReset={() => {
          setSearchQuery("");
          onClearLeaveFilters();
        }}
      />

      <div className="flex flex-wrap gap-3 items-center">
        <label className="text-sm text-gray-600 flex items-center gap-2">
          <span>From</span>
          <input
            type="date"
            value={searchParams.startDate || ""}
            onChange={(e) =>
              setSearchParams((prev) => ({
                ...prev,
                startDate: e.target.value,
              }))
            }
            className="border border-gray-300 rounded-md px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-sm text-gray-600 flex items-center gap-2">
          <span>To</span>
          <input
            type="date"
            value={searchParams.endDate || ""}
            onChange={(e) =>
              setSearchParams((prev) => ({
                ...prev,
                endDate: e.target.value,
              }))
            }
            className="border border-gray-300 rounded-md px-2 py-1.5 text-sm"
          />
        </label>
      </div>

      <Card>
        <CardHeader
          title={t("leaveManagement.leave") || "Leaves"}
          subtitle={
            loading
              ? "Loading…"
              : `${tableRows.length} ${
                  tableRows.length === 1 ? "leave" : "leaves"
                }`
          }
        />

        <PortalDataTable
          columns={columns}
          rows={loading ? [] : tableRows}
          rowKey="_id"
          emptyMessage={
            loading ? "Loading…" : t("No data available") || "No leaves found."
          }
        />

        {!loading && (totalResults > 0 || totalPages > 0) ? (
          <Pagination
            page={currentPage}
            pageSize={recordsPerPage}
            total={
              totalResults ||
              (totalPages > 0 ? totalPages * recordsPerPage : tableRows.length)
            }
            itemLabel="leaves"
            onPageChange={onPageChange}
            onPageSizeChange={onRecordsPerPageChange}
          />
        ) : null}
      </Card>
      </div>

      {/* Approval Modal */}
      <CustomModal
        open={showApproveModal}
        title="Leave Approval"
        onClose={() => setShowApproveModal(false)}
        onConfirm={handleApproveConfirm}
        loading={isSubmitting}
        confirmText="Approve Leave"
        savingText="Processing..."
        width="500px"
        actions={[
          {
            label: "Cancel",
            secondary: true,
            onClick: () => setShowApproveModal(false),
          },
          {
            label: isSubmitting ? "Processing..." : "Approve Leave",
            primary: true,
            onClick: handleApproveConfirm,
            disabled: isSubmitting,
            style: { backgroundColor: "var(--p-blue)" },
          },
        ]}
      >
        <p className="text-gray-700 mb-6">
          Are you sure you want to approve this leave application?
        </p>
        <div className="flex justify-center mb-6">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--p-blue)] shadow-sm"
            aria-hidden
          >
            <svg
              className="h-11 w-11 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>
      </CustomModal>

      {/* Rejection Modal */}
      <CustomModal
        open={showRejectModal}
        title="Leave Rejection"
        onClose={() => setShowRejectModal(false)}
        onConfirm={handleRejectConfirm}
        loading={isSubmitting}
        confirmText="Reject Leave Request"
        savingText="Processing..."
        width="500px"
        disabled={!rejectReason.trim()}
        actions={[
          {
            label: "Cancel",
            secondary: true,
            onClick: () => setShowRejectModal(false),
          },
          {
            label: isSubmitting ? "Processing..." : "Reject Leave Request",
            primary: true,
            onClick: handleRejectConfirm,
            disabled: isSubmitting || !rejectReason.trim(),
            style: { backgroundColor: "#ef4444" },
          },
        ]}
      >
        <p className="text-gray-700 mb-4">
          Please add the reason below to reject the leave application.
        </p>
        <div className="mb-6">
          <label className="block text-gray-700 mb-2">Reason</label>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Enter your reason"
            className="w-full border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
            rows="4"
          ></textarea>
        </div>
      </CustomModal>

      {/* Approval Levels Modal */}
      <CustomModal
        open={showApprovalLevelsModal && !!currentLeave}
        title="Approval Levels"
        onClose={() => {
          setShowApprovalLevelsModal(false);
          setCurrentLeave(null);
        }}
        width="700px"
        showActions={false}
        actions={[
          {
            label: "Close",
            secondary: true,
            onClick: () => {
              setShowApprovalLevelsModal(false);
              setCurrentLeave(null);
            },
          },
        ]}
      >
        {currentLeave && (
          <>
            <div className="mb-4 pb-4 border-b">
              <div className="text-sm text-gray-600">
                <span className="font-semibold">Employee:</span>{" "}
                {currentLeave.employee?.displayName}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                <span className="font-semibold">Leave Type:</span>{" "}
                {currentLeave.leaveType?.name}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                <span className="font-semibold">Period:</span>{" "}
                {formatDate(currentLeave.startDate)} -{" "}
                {formatDate(currentLeave.endDate)}
              </div>
            </div>
            <div className="mt-4">{renderApprovals(currentLeave)}</div>
          </>
        )}
      </CustomModal>

      {/* Cancellation Request Modal (for staff) */}
      <CustomModal
        open={showCancellationRequestModal}
        title="Request Leave Cancellation"
        onClose={() => setShowCancellationRequestModal(false)}
        onConfirm={handleCancellationRequestConfirm}
        loading={isSubmitting}
        confirmText="Submit Cancellation Request"
        savingText="Submitting..."
        width="500px"
        disabled={!cancellationReason.trim()}
        actions={[
          {
            label: "Cancel",
            secondary: true,
            onClick: () => setShowCancellationRequestModal(false),
          },
          {
            label: isSubmitting
              ? "Submitting..."
              : "Submit Cancellation Request",
            primary: true,
            onClick: handleCancellationRequestConfirm,
            disabled: isSubmitting || !cancellationReason.trim(),
            style: { backgroundColor: "#f97316" },
          },
        ]}
      >
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-sm text-yellow-800">
            <strong>Important:</strong> Cancellation requests must be made at
            least 1 day before the leave start date.
          </p>
        </div>
        <p className="text-gray-700 mb-4">
          Please provide a reason for cancelling this leave request:
        </p>
        <div className="mb-6">
          <label className="block text-gray-700 mb-2">Reason</label>
          <textarea
            value={cancellationReason}
            onChange={(e) => setCancellationReason(e.target.value)}
            placeholder="Enter your reason for cancellation"
            className="w-full border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
            rows="4"
          ></textarea>
        </div>
      </CustomModal>

      {/* Cancellation Approve Modal (for non-staff) */}
      <CustomModal
        open={showCancellationApproveModal && !!currentLeave}
        title="Approve Cancellation Request"
        onClose={() => {
          setShowCancellationApproveModal(false);
          setCurrentLeave(null);
        }}
        onConfirm={handleCancellationApproveConfirm}
        loading={isSubmitting}
        confirmText="Approve Cancellation"
        savingText="Processing..."
        width="500px"
        disabled={!currentLeave || !canApproveCancellation(currentLeave)}
        actions={[
          {
            label: "Cancel",
            secondary: true,
            onClick: () => {
              setShowCancellationApproveModal(false);
              setCurrentLeave(null);
            },
          },
          {
            label: isSubmitting ? "Processing..." : "Approve Cancellation",
            primary: true,
            onClick: handleCancellationApproveConfirm,
            disabled:
              isSubmitting ||
              !currentLeave ||
              !canApproveCancellation(currentLeave),
            style: { backgroundColor: "#22c55e" },
          },
        ]}
      >
        {currentLeave && (
          <>
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-sm text-yellow-800">
                <strong>Important:</strong> Approval must be done at least 6
                hours before the leave start date, otherwise it will be
                auto-cancelled.
              </p>
              <p className="text-xs text-yellow-700 mt-1">
                {getCancellationTimeMessage(currentLeave, false)}
              </p>
            </div>

            {currentLeave.cancellationRequest?.reason && (
              <div className="mb-4">
                <label className="block text-gray-700 mb-2 font-semibold">
                  Cancellation Reason:
                </label>
                <p className="text-gray-600 text-sm bg-gray-50 p-3 rounded">
                  {currentLeave.cancellationRequest.reason}
                </p>
              </div>
            )}

            {!canApproveCancellation(currentLeave) && (
              <div className="mb-4">
                <p className="text-red-600 text-sm font-medium">
                  {getCancellationTimeMessage(currentLeave, false)}
                </p>
              </div>
            )}

            <p className="text-gray-700 mb-4">
              Are you sure you want to approve this cancellation request?
            </p>
          </>
        )}
      </CustomModal>

      {/* Cancellation Reject Modal (for non-staff) */}
      <CustomModal
        open={showCancellationRejectModal && !!currentLeave}
        title="Reject Cancellation Request"
        onClose={() => {
          setShowCancellationRejectModal(false);
          setCurrentLeave(null);
        }}
        onConfirm={handleCancellationRejectConfirm}
        loading={isSubmitting}
        confirmText="Reject Cancellation"
        savingText="Processing..."
        width="500px"
        disabled={
          !cancellationRejectionReason.trim() ||
          !currentLeave ||
          !canApproveCancellation(currentLeave)
        }
        actions={[
          {
            label: "Cancel",
            secondary: true,
            onClick: () => {
              setShowCancellationRejectModal(false);
              setCurrentLeave(null);
            },
          },
          {
            label: isSubmitting ? "Processing..." : "Reject Cancellation",
            primary: true,
            onClick: handleCancellationRejectConfirm,
            disabled:
              isSubmitting ||
              !cancellationRejectionReason.trim() ||
              !currentLeave ||
              !canApproveCancellation(currentLeave),
            style: { backgroundColor: "#ef4444" },
          },
        ]}
      >
        {currentLeave && (
          <>
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-sm text-yellow-800">
                <strong>Important:</strong> Rejection must be done at least 6
                hours before the leave start date, otherwise it will be
                auto-cancelled.
              </p>
              <p className="text-xs text-yellow-700 mt-1">
                {getCancellationTimeMessage(currentLeave, false)}
              </p>
            </div>

            {currentLeave.cancellationRequest?.reason && (
              <div className="mb-4">
                <label className="block text-gray-700 mb-2 font-semibold">
                  Cancellation Reason:
                </label>
                <p className="text-gray-600 text-sm bg-gray-50 p-3 rounded">
                  {currentLeave.cancellationRequest.reason}
                </p>
              </div>
            )}

            {!canApproveCancellation(currentLeave) && (
              <div className="mb-4">
                <p className="text-red-600 text-sm font-medium">
                  {getCancellationTimeMessage(currentLeave, false)}
                </p>
              </div>
            )}

            <div className="mb-6">
              <label className="block text-gray-700 mb-2">
                Rejection Reason <span className="text-red-500">*</span>:
              </label>
              <textarea
                value={cancellationRejectionReason}
                onChange={(e) => setCancellationRejectionReason(e.target.value)}
                placeholder="Enter reason for rejection (required)"
                className="w-full border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-red-500"
                rows="3"
              ></textarea>
            </div>
          </>
        )}
      </CustomModal>
    </EpcPage>
  );
};

export default LeavesList;
