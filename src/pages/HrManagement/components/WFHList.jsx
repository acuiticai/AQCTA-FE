"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { useHistory } from "react-router-dom";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

import tickCircle from "../../../assets/img/icons/tick-circle.png";
import closeCircle from "../../../assets/img/icons/close-circle.png";
import { notifyError, notifySuccess } from "@/utils/toast";
import { CustomDatePicker, DataTable, InputField } from "@/page-layouts/index";
import { Link } from "react-router-dom";
import { formatDate } from "@/components/formatAmount";

const WFHList = ({
  wfhRequests,
  updateWFHStatus: parentUpdateWFHStatus,
  parentUpdateWFHDates,
  currentPage,
  recordsPerPage,
  totalPages,
  onPageChange,
  onRecordsPerPageChange,
  loading,
  isStaff,
  tableFilters = [],
}) => {
  const { t } = useTranslation();
  const history = useHistory();
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [currentWFHId, setCurrentWFHId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  // Check if WFH date has passed
  const isWFHDatePassed = (startDate) => {
    const currentDate = new Date();
    const wfhStartDate = new Date(startDate);

    // Reset time components to compare dates only
    currentDate.setHours(0, 0, 0, 0);
    wfhStartDate.setHours(0, 0, 0, 0);

    return wfhStartDate < currentDate;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Approved":
        return "text-green-500 bg-green-50";
      case "Rejected":
        return "text-red-500 bg-red-50";
      case "Applied":
        return "text-yellow-500 bg-yellow-50";
      default:
        return "text-yellow-500 bg-yellow-50";
    }
  };

  const handleApproveClick = (wfhId) => {
    setCurrentWFHId(wfhId);
    setShowApproveModal(true);
  };

  const handleRejectClick = (wfhId) => {
    setCurrentWFHId(wfhId);
    setRejectReason("");
    setShowRejectModal(true);
  };

  const handleEditClick = (wfh) => {
    setCurrentWFHId(wfh._id);
    setEditData({
      date_from: new Date(wfh.date_from),
      date_to: new Date(wfh.date_to),
    });
    setShowEditModal(true);
  };

  const handleApproveConfirm = async () => {
    setIsSubmitting(true);
    try {
      await parentUpdateWFHStatus(currentWFHId, "Approved");
      setShowApproveModal(false);
      notifySuccess("WFH request successfully approved!"); // Success toast
    } catch (error) {
      console.error("Error approving WFH request:", error);
      notifyError(
        error?.response?.data?.message ||
          "Failed to approve WFH request. Please try again."
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
      await parentUpdateWFHStatus(currentWFHId, "Rejected", rejectReason);
      setShowRejectModal(false);
      setRejectReason("");
      notifySuccess("WFH request successfully rejected!"); // Success toast
    } catch (error) {
      console.error(
        "Error rejecting WFH request:",
        error?.response?.data?.message
      );
      notifyError(
        error?.response?.data?.message ||
          "Failed to reject WFH request. Please try again."
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
      await parentUpdateWFHDates(
        currentWFHId,
        editData.date_from,
        editData.date_to
      );
      setShowEditModal(false);
      notifySuccess("WFH request successfully updated!");
    } catch (error) {
      console.error("Error updating WFH request:", error);
      notifyError(
        error?.response?.data?.message ||
          "Failed to update WFH request. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Determines if action buttons should be shown based on business rules
  const shouldShowActions = (wfh) => {
    // No actions if WFH date has passed
    if (isWFHDatePassed(wfh.date_from)) {
      return false;
    }

    // Based on business rules:
    // 1. If status is Applied: can be approved or rejected
    // 2. If status is Approved: can be rejected (cancelled)
    // 3. If status is Rejected: can be approved
    return ["Applied", "Approved", "Rejected"].includes(wfh.status);
  };

  // Determines which action buttons to show based on status
  const getActionButtons = (wfh) => {
    if (!shouldShowActions(wfh)) {
      return (
        <span className="text-gray-400 text-sm italic">
          No actions available
        </span>
      );
    }

    return (
      <div className="flex justify-center">
        {/* Show approve button only for Applied or Rejected status */}
        {/* {(wfh.status === "Applied" || wfh.status === "Rejected") && ( */}
        {wfh.status === "Applied" && (
          <img
            src={tickCircle || "/placeholder.svg"}
            alt="approve"
            onClick={() => handleApproveClick(wfh._id)}
            className="w-6 h-6 mr-2 cursor-pointer"
            title="Approve WFH Request"
          />
        )}

        {/* Show reject button only for Applied or Approved status */}
        {/* {(wfh.status === "Applied" || wfh.status === "Approved") && ( */}
        {wfh.status === "Applied" && (
          <img
            src={closeCircle || "/placeholder.svg"}
            alt="reject"
            onClick={() => handleRejectClick(wfh._id)}
            className="w-6 h-6 cursor-pointer"
            title="Reject WFH Request"
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
            handleEditClick(wfh);
          }}
          title="Edit WFH Request"
        >
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
      </div>
    );
  };

  return (
    <div>
      <div className="overflow-x-auto">
        <DataTable
          wideTable
          filters={tableFilters}
          headers={[
            ...(!isStaff ? [t("wfhRequests.name")] : []),
            t("wfhRequests.date"),
            t("wfhRequests.reason"),
            t("wfhRequests.status"),
            ...(!isStaff ? [t("wfhRequests.action")] : []),
          ]}
          data={wfhRequests}
          colWidths={{
            Name: "200px",
          }}
          totalPages={totalPages}
          currentPage={currentPage}
          onPageChange={onPageChange}
          recordsPerPage={recordsPerPage}
          onRecordsPerPageChange={onRecordsPerPageChange}
          loading={loading}
          renderRow={(wfh) => {
            return (
              wfh?.employee && (
                <tr key={wfh._id} className="border-b border-gray-100">
                  {!isStaff && (
                    <td className="py-4 px-4">
                      <div className="flex items-center">
                        {wfh.employee?.image ? (
                          <img
                            src={`${wfh.employee?.image}`}
                            alt={wfh.employee.displayName}
                            className="w-16 h-16 rounded-xl mr-3 object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-200 mr-3 flex items-center justify-center text-gray-600 font-medium">
                            {wfh.employee.displayName.charAt(0)}
                          </div>
                        )}
                        <Link
                          to={`/staff/${wfh.employee._id}`}
                          className="hover:underline"
                        >
                          {wfh.employee.displayName}
                        </Link>
                      </div>
                    </td>
                  )}
                  <td className="py-4 px-4">{formatDate(wfh.date_from)}</td>
                  {/* <td className="py-4 px-4">{formatDate(wfh.date_to)}</td> */}
                  <td className="py-4 px-4">{wfh.reason || "-"}</td>
                  <td className="py-4 px-4">
                    <span
                      className={`px-3 py-1 rounded-full ${getStatusColor(
                        wfh.status
                      )}`}
                    >
                      {wfh.status}
                    </span>
                  </td>
                  {!isStaff && (
                    <td className="py-4 px-4">{getActionButtons(wfh)}</td>
                  )}
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
              <h2 className="text-xl font-semibold">WFH Request Approval</h2>
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
              Are you sure you want to approve this work from home request?
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
                {/* {isSubmitting
                  ? "Processing..."
                  : "Approve & Send Email to User"} */}
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
              <h2 className="text-xl font-semibold">WFH Request Rejection</h2>
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
              Please add the reason below to reject the work from home request.
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
                {isSubmitting ? "Processing..." : "Reject WFH Request"}
                {/* {isSubmitting ? "Processing..." : "Reject & Send Email to User"} */}
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
              <h2 className="text-xl font-semibold">Edit WFH Request</h2>
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
              Update the work from home request details below.
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-gray-700 mb-2">Date</label>
                <CustomDatePicker
                  type="date"
                  value={editData.date_from}
                  onChange={(value) =>
                    setEditData({
                      ...editData,
                      date_from: value,
                      date_to: value, // ✅ Auto-sync here
                    })
                  }
                />
                {editErrors.date_from && (
                  <p className="text-red-500 text-sm mt-1">
                    {editErrors.date_from}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col space-y-3">
              <button
                onClick={handleEditConfirm}
                disabled={isSubmitting || !editData.date_from}
                className={`w-full bg-[var(--p-blue)] hover:bg-[#9FBF29] text-white py-3 px-4 rounded-md transition duration-200 ${
                  !editData.date_from || isSubmitting
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

export default WFHList;
