import React, { useState, useEffect, useRef } from "react";
import {
  FiX,
  FiClock,
  FiUser,
  FiMessageSquare,
  FiAlertCircle,
  FiCheckCircle,
  FiEdit,
  FiFileText,
  FiDownload,
  FiEye,
  FiPrinter,
  FiUpload,
  FiMail,
  FiBell,
  FiArchive,
  FiRefreshCw,
  FiPause,
  FiPlay,
  FiTrash2,
  FiSettings,
  FiCalendar,
  FiShield,
  FiInfo,
} from "react-icons/fi";
import { formatDate, formatTime } from "@/components/formatAmount";
import request from "@/services/httpService";
import { notifyError } from "@/utils/toast";

const ContractHistoryModal = ({
  isOpen,
  onClose,
  contractId,
  contractNo,
  contractType = "sales", // "sales" or "purchase"
}) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const modalRef = useRef(null);

  const actionIcons = {
    DRAFT_CREATED: <FiFileText className="text-blue-500" />,
    SENT_FOR_APPROVAL: <FiClock className="text-yellow-500" />,
    MANAGEMENT_APPROVED: <FiCheckCircle className="text-green-500" />,
    MANAGEMENT_REJECTED: <FiAlertCircle className="text-red-500" />,
    SALES_CONTRACT_AMENDMENTS_REQUESTED: <FiEdit className="text-orange-500" />,
    SALES_CONTRACT_AMENDMENTS_REQUESTED_BY_ACCOUNTS: (
      <FiEdit className="text-orange-500" />
    ),
    AMENDMENTS_REPLIED: <FiMessageSquare className="text-purple-500" />,
    ACCOUNTS_APPROVED: <FiCheckCircle className="text-green-500" />,
    SENT_FOR_APPROVAL_ACCOUNTS: <FiClock className="text-yellow-500" />,
    DOCUMENT_GENERATED_BY_ACCOUNTS: <FiFileText className="text-indigo-500" />,
    ACCOUNTS_REJECTED: <FiAlertCircle className="text-red-500" />,
    CUSTOMER_APPROVED: <FiCheckCircle className="text-green-500" />,
    SUPPLIER_APPROVED: <FiCheckCircle className="text-green-500" />,
    STATUS_CHANGED: <FiClock className="text-gray-500" />,
    CONTRACT_DUPLICATED: <FiFileText className="text-blue-500" />,
    DOCUMENT_GENERATED: <FiFileText className="text-indigo-500" />,
    DOCUMENT_VIEWED: <FiFileText className="text-gray-500" />,
    CONTRACT_EDITED: <FiEdit className="text-blue-500" />,
    CONTRACT_VIEWED: <FiEye className="text-gray-500" />,
    CONTRACT_DOWNLOADED: <FiDownload className="text-blue-500" />,
    CONTRACT_PRINTED: <FiPrinter className="text-gray-500" />,
    SIGNATURE_ADDED: <FiEdit className="text-green-500" />,
    SIGNATURE_REMOVED: <FiTrash2 className="text-red-500" />,
    COMMENT_ADDED: <FiMessageSquare className="text-blue-500" />,
    COMMENT_UPDATED: <FiEdit className="text-yellow-500" />,
    COMMENT_DELETED: <FiTrash2 className="text-red-500" />,
    FILE_UPLOADED: <FiUpload className="text-green-500" />,
    FILE_DOWNLOADED: <FiDownload className="text-blue-500" />,
    FILE_DELETED: <FiTrash2 className="text-red-500" />,
    EMAIL_SENT: <FiMail className="text-blue-500" />,
    NOTIFICATION_SENT: <FiBell className="text-yellow-500" />,
    CONTRACT_CANCELLED: <FiAlertCircle className="text-red-500" />,
    CONTRACT_COMPLETED: <FiCheckCircle className="text-green-500" />,
    CONTRACT_PAUSED: <FiPause className="text-yellow-500" />,
    CONTRACT_RESUMED: <FiPlay className="text-green-500" />,
    CONTRACT_ARCHIVED: <FiArchive className="text-gray-500" />,
    CONTRACT_RESTORED: <FiRefreshCw className="text-blue-500" />,
    PERMISSION_CHANGED: <FiShield className="text-purple-500" />,
    ASSIGNMENT_CHANGED: <FiUser className="text-blue-500" />,
    PRIORITY_CHANGED: <FiSettings className="text-orange-500" />,
    DUE_DATE_CHANGED: <FiCalendar className="text-blue-500" />,
    CONTRACT_RENEWED: <FiRefreshCw className="text-green-500" />,
    CONTRACT_EXTENDED: <FiCalendar className="text-blue-500" />,
    CONTRACT_TERMINATED: <FiAlertCircle className="text-red-500" />,
  };

  const actionLabels = {
    DRAFT_CREATED: "Contract Created",
    SENT_FOR_APPROVAL: "Sent for Management Approval",
    MANAGEMENT_APPROVED: "Management Approved",
    MANAGEMENT_REJECTED: "Management Rejected",
    SALES_CONTRACT_AMENDMENTS_REQUESTED: "Amendments Requested by Management",
    DOCUMENT_GENERATED_BY_ACCOUNTS: "Accounts Approved, Document Generated",
    SALES_CONTRACT_AMENDMENTS_REQUESTED_BY_ACCOUNTS:
      "Amendments Requested by Accounts",
    AMENDMENTS_REPLIED: "Amendment Reply Submitted by Sales",
    ACCOUNTS_APPROVED: "Accounts Team Approved",
    ACCOUNTS_REJECTED: "Accounts Team Rejected",
    SENT_FOR_APPROVAL_ACCOUNTS: "Sent for Accounts Approval",
    CUSTOMER_APPROVED: "Customer Approved",
    SUPPLIER_APPROVED: "Supplier Approved",
    STATUS_CHANGED: "Status Changed",
    CONTRACT_DUPLICATED: "Contract Duplicated",
    DOCUMENT_GENERATED: "Document Generated",
    DOCUMENT_VIEWED: "Document Viewed",
    CONTRACT_EDITED: "Contract Edited",
    CONTRACT_VIEWED: "Contract Viewed",
    CONTRACT_DOWNLOADED: "Contract Downloaded",
    CONTRACT_PRINTED: "Contract Printed",
    SIGNATURE_ADDED: "Signature Added",
    SIGNATURE_REMOVED: "Signature Removed",
    COMMENT_ADDED: "Comment Added",
    COMMENT_UPDATED: "Comment Updated",
    COMMENT_DELETED: "Comment Deleted",
    FILE_UPLOADED: "File Uploaded",
    FILE_DOWNLOADED: "File Downloaded",
    FILE_DELETED: "File Deleted",
    EMAIL_SENT: "Email Sent",
    NOTIFICATION_SENT: "Notification Sent",
    CONTRACT_CANCELLED: "Contract Cancelled",
    CONTRACT_COMPLETED: "Contract Completed",
    CONTRACT_PAUSED: "Contract Paused",
    CONTRACT_RESUMED: "Contract Resumed",
    CONTRACT_ARCHIVED: "Contract Archived",
    CONTRACT_RESTORED: "Contract Restored",
    PERMISSION_CHANGED: "Permission Changed",
    ASSIGNMENT_CHANGED: "Assignment Changed",
    PRIORITY_CHANGED: "Priority Changed",
    DUE_DATE_CHANGED: "Due Date Changed",
    CONTRACT_RENEWED: "Contract Renewed",
    CONTRACT_EXTENDED: "Contract Extended",
    CONTRACT_TERMINATED: "Contract Terminated",
  };

  const actionColors = {
    DRAFT_CREATED: "bg-blue-50 border-blue-200",
    SENT_FOR_APPROVAL: "bg-yellow-50 border-yellow-200",
    MANAGEMENT_APPROVED: "bg-green-50 border-green-200",
    MANAGEMENT_REJECTED: "bg-red-50 border-red-200",

    SALES_CONTRACT_AMENDMENTS_REQUESTED: "bg-orange-50 border-orange-200",
    SALES_CONTRACT_AMENDMENTS_REQUESTED_BY_ACCOUNTS:
      "bg-orange-50 border-orange-200",
    AMENDMENTS_REPLIED: "bg-purple-50 border-purple-200",
    ACCOUNTS_APPROVED: "bg-green-50 border-green-200",
    SENT_FOR_APPROVAL_ACCOUNTS: "bg-yellow-50 border-yellow-200",
    ACCOUNTS_REJECTED: "bg-red-50 border-red-200",
    CUSTOMER_APPROVED: "bg-green-50 border-green-200",
    SUPPLIER_APPROVED: "bg-green-50 border-green-200",
    STATUS_CHANGED: "bg-gray-50 border-gray-200",
    CONTRACT_DUPLICATED: "bg-blue-50 border-blue-200",
    DOCUMENT_GENERATED: "bg-indigo-50 border-indigo-200",
    DOCUMENT_VIEWED: "bg-gray-50 border-gray-200",
    CONTRACT_EDITED: "bg-blue-50 border-blue-200",
    CONTRACT_VIEWED: "bg-gray-50 border-gray-200",
    CONTRACT_DOWNLOADED: "bg-blue-50 border-blue-200",
    CONTRACT_PRINTED: "bg-gray-50 border-gray-200",
    SIGNATURE_ADDED: "bg-green-50 border-green-200",
    DOCUMENT_GENERATED_BY_ACCOUNTS: "bg-indigo-50 border-indigo-200",
    SIGNATURE_REMOVED: "bg-red-50 border-red-200",
    COMMENT_ADDED: "bg-blue-50 border-blue-200",
    COMMENT_UPDATED: "bg-yellow-50 border-yellow-200",
    COMMENT_DELETED: "bg-red-50 border-red-200",
    FILE_UPLOADED: "bg-green-50 border-green-200",
    FILE_DOWNLOADED: "bg-blue-50 border-blue-200",
    FILE_DELETED: "bg-red-50 border-red-200",
    EMAIL_SENT: "bg-blue-50 border-blue-200",
    NOTIFICATION_SENT: "bg-yellow-50 border-yellow-200",
    CONTRACT_CANCELLED: "bg-red-50 border-red-200",
    CONTRACT_COMPLETED: "bg-green-50 border-green-200",
    CONTRACT_PAUSED: "bg-yellow-50 border-yellow-200",
    CONTRACT_RESUMED: "bg-green-50 border-green-200",
    CONTRACT_ARCHIVED: "bg-gray-50 border-gray-200",
    CONTRACT_RESTORED: "bg-blue-50 border-blue-200",
    PERMISSION_CHANGED: "bg-purple-50 border-purple-200",
    ASSIGNMENT_CHANGED: "bg-blue-50 border-blue-200",
    PRIORITY_CHANGED: "bg-orange-50 border-orange-200",
    DUE_DATE_CHANGED: "bg-blue-50 border-blue-200",
    CONTRACT_RENEWED: "bg-green-50 border-green-200",
    CONTRACT_EXTENDED: "bg-blue-50 border-blue-200",
    CONTRACT_TERMINATED: "bg-red-50 border-red-200",
  };

  const fetchLogs = async (page = 1) => {
    if (!contractId) return;

    setLoading(true);
    try {
      const endpoint =
        contractType === "sales"
          ? `/sales-contracts/action-logs/${contractId}?page=${page}&limit=20`
          : `/purchase-contracts/action-logs/${contractId}?page=${page}&limit=20`;

      const response = await request.get(endpoint);
      if (response.success) {
        console.log("Raw logs from API:", response.data.logs);

        // Filter out logs with "" or "" - but be less strict
        const filteredLogs = response.data.logs.filter((log) => {
          // Only filter if BOTH name and role are unknown/invalid
          const hasValidName =
            log.actionByName &&
            log.actionByName !== "" &&
            log.actionByName !== "N/A" &&
            log.actionByName.trim() !== "";
          const hasValidRole =
            log.actionByRole &&
            log.actionByRole !== "" &&
            log.actionByRole !== "N/A" &&
            log.actionByRole.trim() !== "";

          // Show log if either name or role is valid, or if both are missing (system logs)
          return (
            hasValidName ||
            hasValidRole ||
            (!log.actionByName && !log.actionByRole)
          );
        });

        console.log("Filtered logs:", filteredLogs);

        // If filtering removed all logs, show all logs instead
        const finalLogs =
          filteredLogs.length > 0 ? filteredLogs : response.data.logs;
        console.log("Final logs to display:", finalLogs);

        setLogs(finalLogs);
        setTotalPages(response.data.pagination.totalPages);
        setTotalLogs(response.data.pagination.totalLogs);
        setCurrentPage(page);
      }
    } catch (error) {
      console.error("Error fetching contract logs:", error);
      notifyError("Failed to fetch contract history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && contractId) {
      fetchLogs(1);
    }
  }, [isOpen, contractId]);

  const handlePageChange = (page) => {
    fetchLogs(page);
  };

  const renderLogItem = (log) => {
    const actionIcon = actionIcons[log.action] || (
      <FiClock className="text-gray-500" />
    );
    const actionLabel = actionLabels[log.action] || log.action;
    const actionColor =
      actionColors[log.action] || "bg-gray-50 border-gray-200";

    return (
      <div
        key={log._id}
        className={`border rounded-lg p-4 mb-3 ${actionColor}`}
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-1">{actionIcon}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-gray-900">
                {actionLabel}
              </h4>
              <span className="text-xs text-gray-500">
                {formatDate(log.createdAt)} {formatTime(log.createdAt)}
              </span>
            </div>

            <div className="text-sm text-gray-600 mb-2">
              {log.actionByName && log.actionByRole && (
                <div className="flex items-center gap-2 mb-1">
                  <FiUser className="text-gray-400" />
                  <span>
                    {log?.actionByName || "Unknown"}{" "}
                    {log.actionByRole && `(${log.actionByRole})`}
                  </span>
                </div>
              )}

              {log.previousStatus && log.newStatus && (
                <div className="text-xs text-gray-500 mb-2">
                  Status:{" "}
                  <span className="font-medium">{log.previousStatus}</span> →{" "}
                  <span className="font-medium">{log.newStatus}</span>
                </div>
              )}
            </div>

            {/* Comments and Details */}
            {log.comment && (
              <div className="bg-white rounded p-3 mb-2">
                <div className="text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <FiMessageSquare className="text-blue-500" />
                  Comment:
                </div>
                <div className="text-sm text-gray-600">{log.comment}</div>
              </div>
            )}

            {log.rejectionReason && (
              <div className="bg-red-50 rounded p-3 mb-2">
                <div className="text-xs font-medium text-red-700 mb-1 flex items-center gap-1">
                  <FiAlertCircle className="text-red-500" />
                  Rejection Reason:
                </div>
                <div className="text-sm text-red-600">
                  {log.rejectionReason}
                </div>
              </div>
            )}

            {/* {log.amendmentDetails && (
              <div className="bg-orange-50 rounded p-3 mb-2">
                <div className="text-xs font-medium text-orange-700 mb-1 flex items-center gap-1">
                  <FiEdit className="text-orange-500" />
                  Amendment Details:
                </div>
                <div className="text-sm text-orange-600">{log.amendmentDetails}</div>
              </div>
            )} */}

            {log.replyToAmendment && (
              <div className="bg-purple-50 rounded p-3 mb-2">
                <div className="text-xs font-medium text-purple-700 mb-1 flex items-center gap-1">
                  <FiMessageSquare className="text-purple-500" />
                  Amendment Reply:
                </div>
                <div className="text-sm text-purple-600">
                  {log.replyToAmendment}
                </div>
              </div>
            )}

            {log?.additionalData?.changes &&
              Object.keys(log?.additionalData?.changes).length > 0 && (
                <div className="bg-white rounded p-2 pt-[0.05px] mt-2 mb-2">
                  {/* Render 'changes' object if present */}
                  {log?.additionalData?.changes &&
                    typeof log?.additionalData?.changes === "object" &&
                    Object.keys(log?.additionalData?.changes).length > 0 && (
                      <div className="mt-2">
                        <div className="text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                          <FiEdit className="text-gray-500" />
                          Changes:
                        </div>
                        <ul className="list-none mt-1 space-y-0.5 pt-1">
                          {Object.entries(log?.additionalData?.changes).map(
                            ([changeKey, changeVal]) => (
                              <li
                                key={changeKey}
                                className="flex items-center gap-1 text-xs text-gray-700"
                              >
                                <span className="text-xs text-gray-600">
                                  {
                                    changeKey
                                      .replace(/([a-z0-9])([A-Z])/g, "$1 $2") // Insert space before capital letter
                                      .replace(/^./, (str) => str.toUpperCase()) // Uppercase first letter
                                      .replace(/([A-Z]+)/g, (match) =>
                                        match.length > 1
                                          ? match.charAt(0) +
                                            match.slice(1).toLowerCase()
                                          : match
                                      ) // Lowercase all-uppercase chunks, except first char
                                  }
                                  :
                                </span>
                                <span className="text-xxs font-medium text-black">
                                  {typeof changeVal === "boolean"
                                    ? changeVal
                                      ? "Yes"
                                      : "No"
                                    : String(changeVal)}
                                </span>
                              </li>
                            )
                          )}
                        </ul>
                      </div>
                    )}
                </div>
              )}

            {/* Additional Data */}
            {log.additionalData &&
              Object.keys(log.additionalData).length > 0 && (
                <div className="bg-white rounded p-2">
                  <div className="text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                    <FiInfo className="text-gray-500" />
                    Additional Info:
                  </div>
                  <div className="text-xs text-gray-600">
                    {log.additionalData.contractNo && (
                      <div>
                        Contract:{" "}
                        <span className="font-medium text-black">
                          {log.additionalData.contractNo}
                        </span>
                      </div>
                    )}
                    {log.additionalData.businessName && (
                      <div>
                        Business:{" "}
                        <span className="font-medium text-black">
                          {log.additionalData.businessName}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            {/* Additional Data (Flat Key/Value Rendering) */}
          </div>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {contractType === "sales" ? "Sales" : "Purchase"} Contract History
            </h2>
            <p className="text-sm text-gray-500">Contract: {contractNo}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <FiX className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8">
              <FiClock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">
                No history found for this contract
              </p>
            </div>
          ) : (
            <div>
              <div className="mb-4 text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
                Showing {logs.length} of {totalLogs} entries
              </div>
              {logs.map(renderLogItem)}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t p-4 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContractHistoryModal;
