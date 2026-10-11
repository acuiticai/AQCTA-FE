"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { useHistory } from "react-router-dom";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

import tickCircle from "../../../assets/img/icons/tick-circle.png";
import closeCircle from "../../../assets/img/icons/close-circle.png";
import { notifyError, notifySuccess } from "@/utils/toast";
import { CustomDatePicker, DataTable } from "@/page-layouts/index";
import { Link } from "react-router-dom";
import {
  formatAttendanceTime,
  formatShiftScheduleDisplay,
  resolveStaffTimezone,
} from "@/components/formatAmount";

const SKIP_IN_STATUSES = ["Absent", "Leave", "Public Holiday", "Weekly Off"];

const AttendanceTimeCell = ({ checkInOrOut, staff }) => {
  const tz = staff?.staffTimezone || resolveStaffTimezone(staff?.shift);
  if (!checkInOrOut?.timestamp) {
    return <span className="text-gray-400">-</span>;
  }
  return (
    <span>
      {formatAttendanceTime({
        formattedTime: checkInOrOut.formattedTime,
        timestamp: checkInOrOut.timestamp,
        timezone: tz,
      })}
    </span>
  );
};

const ShiftScheduleCell = ({ shift }) => {
  const line = formatShiftScheduleDisplay(shift);
  if (!line) return <span className="text-gray-400">-</span>;
  return <span className="text-sm text-gray-700">{line}</span>;
};

const AttendanceList = ({
  filters = [],
  attendanceRecords,
  updateAttendanceStatus,
  updateAttendanceDates,
  currentPage,
  recordsPerPage,
  totalResults,
  totalPages,
  onPageChange,
  onRecordsPerPageChange,
  loading,
}) => {
  const { t } = useTranslation();
  const history = useHistory();
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [currentAttendanceId, setCurrentAttendanceId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState({
    date_from: "",
    date_to: "",
  });

  const [editErrors, setEditErrors] = useState({});

  // Function to format date to DD-MM-YYYY
  // const formatDate = (dateString) => {
  //   const date = new Date(dateString)
  //   return format(date, "dd-MM-yyyy")
  // }

  // Check if attendance date has passed
  const isAttendanceDatePassed = (startDate) => {
    const currentDate = new Date();
    const attendanceStartDate = new Date(startDate);

    // Reset time components to compare dates only
    currentDate.setHours(0, 0, 0, 0);
    attendanceStartDate.setHours(0, 0, 0, 0);

    return attendanceStartDate < currentDate;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Present":
        return "text-green-500 bg-green-50";
      case "Absent":
        return "text-red-500 bg-red-50";
      case "Leave":
        return "text-yellow-500 bg-yellow-50";
      default:
        return "text-yellow-500 bg-yellow-50";
    }
  };

  const handleApproveClick = (attendanceId) => {
    setCurrentAttendanceId(attendanceId);
    setShowApproveModal(true);
  };

  const handleRejectClick = (attendanceId) => {
    setCurrentAttendanceId(attendanceId);
    setRejectReason("");
    setShowRejectModal(true);
  };

  const handleEditClick = (attendance) => {
    setCurrentAttendanceId(attendance._id);
    setEditData({
      date_from: new Date(attendance.date_from),
      date_to: new Date(attendance.date_to),
    });
    setShowEditModal(true);
  };

  const handleApproveConfirm = async () => {
    setIsSubmitting(true);
    try {
      await updateAttendanceStatus(currentAttendanceId, "Approved");
      setShowApproveModal(false);
      notifySuccess("Attendance request successfully approved!"); // Success toast
    } catch (error) {
      console.error("Error approving attendance request:", error);
      notifyError(
        error?.response?.data?.message ||
          "Failed to approve attendance request. Please try again."
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
      await updateAttendanceStatus(
        currentAttendanceId,
        "Rejected",
        rejectReason
      );
      setShowRejectModal(false);
      setRejectReason("");
      notifySuccess("Attendance request successfully rejected!"); // Success toast
    } catch (error) {
      console.error(
        "Error rejecting attendance request:",
        error?.response?.data?.message
      );
      notifyError(
        error?.response?.data?.message ||
          "Failed to reject attendance request. Please try again."
      ); // Error toast with server message
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditConfirm = async () => {
    const errors = {};

    if (!editData.date_from) {
      errors.date_from = "Start date is required";
    }

    if (!editData.date_to) {
      errors.date_to = "End date is required";
    }

    if (editData.date_from && editData.date_to) {
      const from = new Date(editData.date_from);
      const to = new Date(editData.date_to);

      if (to < from) {
        errors.date_to = "End date must be after start date";
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (from < today) {
        errors.date_from = "Start date cannot be in the past";
      }

      if (to < today) {
        errors.date_to = "End date cannot be in the past";
      }
    }

    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }

    setEditErrors({});
    setIsSubmitting(true);
    try {
      await updateAttendanceDates(
        currentAttendanceId,
        editData.date_from,
        editData.date_to
      );
      setShowEditModal(false);
      notifySuccess("Attendance request successfully updated!");
    } catch (error) {
      console.error("Error updating attendance request:", error);
      notifyError(
        error?.response?.data?.message ||
          "Failed to update attendance request. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Determines if action buttons should be shown based on business rules
  const shouldShowActions = (attendance) => {
    // No actions if attendance date has passed
    if (isAttendanceDatePassed(attendance.date_from)) {
      return false;
    }

    // Based on business rules:
    // 1. If status is Applied: can be approved or rejected
    // 2. If status is Approved: can be rejected (cancelled)
    // 3. If status is Rejected: can be approved
    return ["Applied", "Approved", "Rejected"].includes(attendance.status);
  };

  // Determines which action buttons to show based on status
  const getActionButtons = (attendance) => {
    if (!shouldShowActions(attendance)) {
      return (
        <span className="text-gray-400 text-sm italic">
          No actions available
        </span>
      );
    }

    return (
      <div className="flex justify-center">
        {/* Show approve button only for Applied or Rejected status */}
        {(attendance.status === "Applied" ||
          attendance.status === "Rejected") && (
          <img
            src={tickCircle || "/placeholder.svg"}
            alt="approve"
            onClick={() => handleApproveClick(attendance._id)}
            className="w-6 h-6 mr-2 cursor-pointer"
            title="Approve Attendance Request"
          />
        )}

        {/* Show reject button only for Applied or Approved status */}
        {(attendance.status === "Applied" ||
          attendance.status === "Approved") && (
          <img
            src={closeCircle || "/placeholder.svg"}
            alt="reject"
            onClick={() => handleRejectClick(attendance._id)}
            className="w-6 h-6 cursor-pointer"
            title="Reject Attendance Request"
          />
        )}
        {/* Edit button */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-6 h-6 ml-2 cursor-pointer"
          onClick={() => {
            handleEditClick(attendance);
          }}
          title="Edit Attendance Request"
        >
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
      </div>
    );
  };

  const q = searchQuery.trim().toLowerCase();
  const filteredAttendanceRecords = q
    ? attendanceRecords.filter(
        (attendance) =>
          (attendance.displayName || "")
            .toLowerCase()
            .includes(q) ||
          attendance.status?.toLowerCase().includes(q) ||
          attendance.reason?.toLowerCase().includes(q)
      )
    : attendanceRecords;

  return (
    <div>
      <div className="overflow-x-auto">
        <DataTable
          filters={filters}
          // actionButtons={[
          //   {
          //     label: "New Attendance Request",
          //     onClick: () => history.push("/apply-attendance"),
          //   },
          // ]}
          searchValue={searchQuery}
          onSearch={(value) => setSearchQuery(value)}
          searchPlaceholder={t("attendance.search")}
          // headers={["Name", "IN", "OUT", "Reason", "Status", "Action"]}
          headers={[
            t("attendance.name"),
            t("attendance.date"),
            "Shift Time",
            t("attendance.in"),
            t("attendance.out"),
            t("attendance.status"),
          ]}
          data={filteredAttendanceRecords}
          colWidths={{
            Name: "200px",
          }}
          totalPages={totalPages}
          totalRecords={totalResults}
          currentPage={currentPage}
          onPageChange={onPageChange}
          recordsPerPage={recordsPerPage}
          onRecordsPerPageChange={onRecordsPerPageChange}
          loading={loading}
          renderRow={(attendance) => {
            const latest = attendance?.attendance?.at(-1);
            return (
              attendance && (
                <tr key={attendance._id} className="border-b border-gray-100">
                  <td className="py-4 px-4">
                    <div className="flex items-center">
                      {attendance?.image ? (
                        <img
                          src={`${attendance.image}`}
                          alt={attendance.displayName}
                          className="w-16 h-16 rounded-xl mr-3 object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-200 mr-3 flex items-center justify-center text-gray-600 font-medium">
                          {attendance.displayName.charAt(0)}
                        </div>
                      )}
                      <Link
                        to={`/attendance-details?id=${attendance._id}`}
                        className="hover:underline"
                      >
                        {attendance.displayName}
                      </Link>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    {attendance.attendance.length > 0
                      ? attendance.attendance.at(-1).formattedDate
                      : "-"}
                  </td>
                  <td className="py-4 px-4">
                    <ShiftScheduleCell shift={attendance.shift} />
                  </td>
                  <td className="py-4 px-4">
                    {latest && SKIP_IN_STATUSES.includes(latest.status) ? (
                      "-"
                    ) : (
                      <AttendanceTimeCell
                        checkInOrOut={latest?.firstCheckIn}
                        staff={attendance}
                      />
                    )}
                  </td>
                  <td className="py-4 px-4">
                    {latest?.status === "Absent" ? (
                      "-"
                    ) : (
                      <AttendanceTimeCell
                        checkInOrOut={latest?.lastCheckOut}
                        staff={attendance}
                      />
                    )}
                  </td>
                  <td className="py-4 px-4">
                    <span
                      className={`px-3 py-1 rounded-full ${getStatusColor(
                        attendance?.attendance?.at(-1)?.status
                      )}`}
                    >
                      {attendance?.attendance?.at(-1)?.status
                        ? attendance?.attendance?.at(-1)?.status
                        : "No Record"}
                    </span>
                  </td>
                  {/* <td className="py-4 px-4">
                    {attendance.attendance.length > 0 ? formatDate(attendance.attendance.at(-1).date) : "-"}
                  </td>
                  <td className="py-4 px-4">
                    {attendance.attendance.length > 0 &&
                      attendance.attendance.at(-1).firstCheckIn?.timestamp ?
                      formatTime(attendance.attendance.at(-1).firstCheckIn.timestamp) :
                      (attendance.attendance.length > 0 && attendance.attendance.at(-1).status === 'absent' ?
                        "Absent" : "-")}
                  </td>
                  <td className="py-4 px-4">
                    {attendance.attendance.length > 0 &&
                      attendance.attendance.at(-1)?.lastCheckOut?.timestamp ?
                      formatTime(attendance.attendance.at(-1).lastCheckOut.timestamp) :
                      (attendance.attendance.length > 0 && attendance.attendance.at(-1).status === 'absent' ?
                        "Absent" : "-")}
                  </td> */}

                  {/* <td className="py-4 px-4">
                    <span className={`px-3 py-1 rounded-full ${getStatusColor(attendance.status)}`}>
                      {attendance.status}
                    </span>
                  </td> */}
                  {/* <td className="py-4 px-4">{getActionButtons(attendance)}</td> */}
                </tr>
              )
            );
          }}
        />
      </div>

      {/* Approval Modal */}
      {showApproveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                Attendance Request Approval
              </h2>
              <button
                onClick={() => setShowApproveModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  ></path>
                </svg>
              </button>
            </div>

            <p className="text-gray-700 mb-6">
              Are you sure you want to approve this attendance request?
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

            <div className="flex flex-col space-y-3">
              <button
                onClick={handleApproveConfirm}
                disabled={isSubmitting}
                className="w-full bg-[var(--p-blue)] hover:bg-[#9FBF29] text-white py-3 px-4 rounded-md transition duration-200"
              >
                {isSubmitting ? "Processing..." : "Approve"}
              </button>

              <button
                onClick={() => setShowApproveModal(false)}
                disabled={isSubmitting}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-4 rounded-md transition duration-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                Attendance Request Rejection
              </h2>
              <button
                onClick={() => setShowRejectModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  ></path>
                </svg>
              </button>
            </div>

            <p className="text-gray-700 mb-4">
              Please add the reason below to reject the attendance request.
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

            <div className="flex flex-col space-y-3">
              <button
                onClick={handleRejectConfirm}
                disabled={isSubmitting || !rejectReason.trim()}
                className={`w-full bg-red-500 hover:bg-red-600 text-white py-3 px-4 rounded-md transition duration-200 ${
                  !rejectReason.trim() || isSubmitting
                    ? "opacity-60 cursor-not-allowed"
                    : ""
                }`}
              >
                {isSubmitting ? "Processing..." : "Reject"}
              </button>

              <button
                onClick={() => setShowRejectModal(false)}
                disabled={isSubmitting}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-4 rounded-md transition duration-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Edit Attendance Request</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  ></path>
                </svg>
              </button>
            </div>

            <p className="text-gray-700 mb-4">
              Update the attendance request details below.
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-gray-700 mb-2">Date From</label>
                <CustomDatePicker
                  type="date"
                  value={editData.date_from}
                  onChange={(value) =>
                    setEditData({ ...editData, date_from: value })
                  }
                />
                {editErrors.date_from && (
                  <p className="text-red-500 text-sm mt-1">
                    {editErrors.date_from}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-gray-700 mb-2">Date To</label>
                <CustomDatePicker
                  type="date"
                  value={editData.date_to}
                  onChange={(value) =>
                    setEditData({ ...editData, date_to: value })
                  }
                />
                {editErrors.date_to && (
                  <p className="text-red-500 text-sm mt-1">
                    {editErrors.date_to}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col space-y-3">
              <button
                onClick={handleEditConfirm}
                disabled={
                  isSubmitting || !editData.date_from || !editData.date_to
                }
                className={`w-full bg-[var(--p-blue)] hover:bg-[#9FBF29] text-white py-3 px-4 rounded-md transition duration-200 ${
                  !editData.date_from || !editData.date_to || isSubmitting
                    ? "opacity-60 cursor-not-allowed"
                    : ""
                }`}
              >
                {isSubmitting ? "Processing..." : "Update"}
              </button>

              <button
                onClick={() => setShowEditModal(false)}
                disabled={isSubmitting}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-4 rounded-md transition duration-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceList;
