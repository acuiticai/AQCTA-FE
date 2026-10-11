"use client";

import React, { useState, useEffect, useContext, useRef } from "react";
import axios from "axios";
import useButtonColor from "@/hooks/useButtonColor";
import { DataTable, PageHeader, ActionButtons } from "@/page-layouts";
import { notifyError, notifySuccess } from "@/utils/toast";
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Badge,
} from "@windmill/react-ui";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";
import useCheckTokenExpired from "@/hooks/useCheckTokenExpired";
import { AdminContext } from "@/context/AdminContext";
import useUtilsFunction from "@/hooks/useUtilsFunction";
import { FiCheck, FiCheckCircle } from "react-icons/fi";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const Notifications = () => {
  const checkTokenExpired = useCheckTokenExpired();
  const buttonColor = useButtonColor();
  const { showDateTimeFormat } = useUtilsFunction();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;

  const [filteredNotifications, setFilteredNotifications] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalResults, setTotalResults] = useState(0);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("All");
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [statistics, setStatistics] = useState({
    totalNotifications: 0,
    unreadCount: 0,
    readCount: 0,
  });

  const currentPageRef = useRef(1);

  useEffect(() => {
    if (adminInfo?.id) {
      fetchNotifications(1, recordsPerPage, "", "All");
    }
  }, [adminInfo?.id]);

  const handleViewDetails = (notification) => {
    setSelectedNotification(notification);
    setIsModalOpen(true);
  };

  // Handle notification click with navigation
  const handleNotificationClick = ({ _id, link, ...notification }) => {
    // Mark as read first
    markAsRead(_id || notification?.id || notification?.notificationId);

    // Navigate to the appropriate page based on notification link
    if (link) {
      console.log("🧭 Navigating to:", { notification });
      if (/^https?:\/\//.test(link)) {
        // If link is absolute, navigate directly
        window.location.href = link;
      } else if (notification?.state) {
        history.push(link, { ...notification?.state });
      } else {
        window.location.href = link;
      }
      setNotificationOpen(false);
    } else {
      // Default behavior - just mark as read
      markAsRead(_id || notification?.id || notification?.notificationId);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedNotification(null);
  };

  const fetchNotifications = async (
    page = currentPage,
    limit = recordsPerPage,
    search = searchTerm,
    status = statusFilter
  ) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.append("page", page.toString());
      params.append("limit", limit.toString());

      if (search && search.trim() !== "") {
        params.append("search", search.trim());
      }

      if (status && status !== "All") {
        params.append("status", status);
      }

      console.log(
        "🔍 Fetching notifications with params:",
        Object.fromEntries(params)
      );
      console.log("👤 User ID:", adminInfo.id);

      const response = await axios.get(
        `${Base_URL}/notifications/user/${adminInfo.id}?${params.toString()}`
      );
      if (checkTokenExpired(response)) return;

      console.log("📊 API Response:", response.data);

      if (response.data.success) {
        setFilteredNotifications(response.data.notifications);
        setTotalResults(response.data.pagination.totalCount);
        setStatistics(response.data.statistics);
        setCurrentPage(response.data.pagination.currentPage);

        // Log pagination info
        console.log("📊 Pagination info:", {
          currentPage: response.data.pagination.currentPage,
          totalPages: response.data.pagination.totalPages,
          totalCount: response.data.pagination.totalCount,
          hasNextPage: response.data.pagination.hasNextPage,
          hasPrevPage: response.data.pagination.hasPrevPage,
        });
      } else {
        setError("Failed to fetch notifications");
      }
    } catch (err) {
      console.error("Error fetching notifications:", err);
      setError(err.response?.data?.message || "Failed to fetch notifications.");
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (page) => {
    console.log("📄 Page change requested:", page);
    setCurrentPage(page);
    currentPageRef.current = page;
    fetchNotifications(page, recordsPerPage, searchTerm, statusFilter);
  };

  const debounce = (func, delay) => {
    let timeoutId;
    return function (...args) {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        func.apply(this, args);
      }, delay);
    };
  };

  const debouncedSearch = useRef(
    debounce((value) => {
      console.log("🔍 Search triggered:", value);
      setCurrentPage(1);
      currentPageRef.current = 1;
      fetchNotifications(1, recordsPerPage, value, statusFilter);
    }, 500)
  ).current;

  const handleSearch = (searchValue) => {
    console.log("🔍 Search input:", searchValue);
    setSearchTerm(searchValue);
    debouncedSearch(searchValue);
  };

  const handleStatusFilterChange = (value) => {
    console.log("📊 Status filter changed:", value);
    setStatusFilter(value);
    setCurrentPage(1);
    currentPageRef.current = 1;
    fetchNotifications(1, recordsPerPage, searchTerm, value);
  };

  const handleRecordsPerPageChange = (perPage) => {
    console.log("📊 Records per page changed:", perPage);
    setRecordsPerPage(perPage);
    currentPageRef.current = 1;
    setCurrentPage(1);
    fetchNotifications(1, perPage, searchTerm, statusFilter);
  };

  const markAsRead = async (notificationId) => {
    try {
      const response = await axios.patch(
        `${Base_URL}/notifications/mark-read/${notificationId}`
      );
      if (checkTokenExpired(response)) return;
      if (response.data.success) {
        notifySuccess("Notification marked as read");
        fetchNotifications(
          currentPage,
          recordsPerPage,
          searchTerm,
          statusFilter
        );
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
      notifyError("Failed to mark notification as read");
    }
  };

  const markAllAsRead = async () => {
    if (!adminInfo?.id || !statistics.unreadCount || markingAllRead) return;

    try {
      setMarkingAllRead(true);
      const response = await axios.patch(
        `${Base_URL}/notifications/mark-all-read/${adminInfo.id}`
      );
      if (checkTokenExpired(response)) return;

      if (response.data.success) {
        const count = response.data.modifiedCount;
        notifySuccess(
          count > 0
            ? `${count} notification${count === 1 ? "" : "s"} marked as read`
            : "All notifications marked as read"
        );

        fetchNotifications(
          currentPage,
          recordsPerPage,
          searchTerm,
          statusFilter
        );
      } else {
        notifyError("Failed to mark all notifications as read");
      }
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      notifyError("Failed to mark all notifications as read");
    } finally {
      setMarkingAllRead(false);
    }
  };

  const deleteNotification = async (notificationId) => {
    if (!window.confirm("Are you sure you want to delete this notification?"))
      return;

    try {
      const response = await axios.delete(
        `${Base_URL}/notifications/${notificationId}`
      );
      if (checkTokenExpired(response)) return;
      if (response.data.success) {
        notifySuccess("Notification deleted successfully");
        fetchNotifications(
          currentPage,
          recordsPerPage,
          searchTerm,
          statusFilter
        );
      }
    } catch (error) {
      console.error("Error deleting notification:", error);
      notifyError("Failed to delete notification");
    }
  };

  const headers = ["Message", "Status", "Date", "Action"];

  const clearAllFilters = () => {
    console.log("🧹 Clearing all filters");
    setStatusFilter("All");
    setSearchTerm("");
    setCurrentPage(1);
    setError(null);
    fetchNotifications(1, recordsPerPage, "", "All");
  };

  const handleRefresh = () => {
    console.log("🔄 Refreshing notifications");
    setError(null);
    fetchNotifications(currentPage, recordsPerPage, searchTerm, statusFilter);
  };

  const filters = [
    {
      isClearButton: true,
      buttonProps: {
        onClick: () => {
          clearAllFilters();
          setCurrentPage(1);
        },
      },
    },
    {
      value: statusFilter,
      onChange: (value) => {
        handleStatusFilterChange(value);
        setCurrentPage(1);
      },
      placeholder: "Select Status",
      options: [
        { value: "All", label: "All Statuses" },
        { value: "unread", label: "Unread" },
        { value: "read", label: "Read" },
      ],
    },
  ];

  const isUnread = (notification) => {
    return !notification.isRead && !notification.is_read;
  };

  return (
    <div
      className="p-6 bg-white min-h-screen"
      style={{ backgroundColor: "#FFFF" }}
    >
      <div className="relative">
        <PageHeader title="Notifications" showAddButton={false} />
        <div className="absolute top-0 right-0 flex items-center gap-2">
          <button
            onClick={markAllAsRead}
            disabled={loading || markingAllRead || !statistics.unreadCount}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[var(--p-blue)] hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--p-blue)] disabled:opacity-50 disabled:cursor-not-allowed"
            title={
              statistics.unreadCount
                ? `Mark ${statistics.unreadCount} unread as read`
                : "No unread notifications"
            }
          >
            <FiCheckCircle
              className={`h-4 w-4 mr-2 ${markingAllRead ? "animate-pulse" : ""}`}
            />
            {markingAllRead ? "Marking..." : "Mark all as read"}
          </button>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            <svg
              className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-white rounded-lg shadow-md">
          <p className="text-sm text-gray-600">Total Notifications</p>
          <h2 className="text-xl font-bold">{statistics.totalNotifications}</h2>
        </div>
        <div className="p-4 bg-white rounded-lg shadow-md">
          <p className="text-sm text-gray-600">Unread Notifications</p>
          <h2 className="text-xl font-bold">{statistics.unreadCount}</h2>
        </div>
        <div className="p-4 bg-white rounded-lg shadow-md">
          <p className="text-sm text-gray-600">Read Notifications</p>
          <h2 className="text-xl font-bold">{statistics.readCount}</h2>
        </div>
      </div>

      <DataTable
        onSearch={handleSearch}
        searchValue={searchTerm}
        searchPlaceholder="Search notifications"
        filters={filters}
        loading={loading}
        totalRecords={totalResults}
        headers={headers}
        tableWidths={{
          [headers[0]]: "600px",
          [headers[1]]: "120px",
          [headers[2]]: "180px",
          [headers[3]]: "150px",
        }}
        data={filteredNotifications}
        renderRow={(notification) => (
          <tr
            key={notification._id}
            className={`border-b ${isUnread(notification) ? "bg-blue-50" : ""}`}
            style={{ fontSize: "12px", fontWeight: "400" }}
          >
            <td
              className="py-2 px-4"
              style={{ fontSize: "14px", fontWeight: "400", width: "600px" }}
            >
              <div className="flex items-center">
                <div
                  className={`flex-shrink-0 w-2 h-2 rounded-full mr-3 ${
                    isUnread(notification) ? "bg-blue-500" : "bg-gray-300"
                  }`}
                ></div>
                <div className="text-sm font-medium text-gray-900 max-w-lg">
                  {notification.message ||
                    notification.body ||
                    notification.title}
                </div>
              </div>
            </td>
            <td
              className="py-2 px-4"
              style={{ fontSize: "14px", fontWeight: "400", width: "120px" }}
            >
              <Badge type={isUnread(notification) ? "success" : "danger"}>
                {isUnread(notification) ? "Unread" : "Read"}
              </Badge>
            </td>
            <td
              className="py-2 px-4"
              style={{ fontSize: "14px", fontWeight: "400", width: "180px" }}
            >
              {showDateTimeFormat(notification.createdAt)}
            </td>
            <td className="py-2 px-4" style={{ width: "150px" }}>
              <div className="flex space-x-2">
                <ActionButtons
                  items={[
                    {
                      tooltip: "View Details",
                      action: ACTION_BUTTON_TYPES.VIEW,
                      onClick: () => handleViewDetails(notification),
                    },
                    ...(isUnread(notification)
                      ? [
                          {
                            tooltip: "Proceed",
                            action: ACTION_BUTTON_TYPES.CUSTOM,
                            icon: FiCheck,
                            onClick: () =>
                              handleNotificationClick(notification),
                          },
                        ]
                      : []),
                    ...(!notification.hasTask
                      ? [
                          {
                            tooltip: "Delete",
                            action: ACTION_BUTTON_TYPES.DELETE,
                            onClick: () =>
                              deleteNotification(
                                notification?._id ||
                                  notification?.id ||
                                  notification?.notificationId
                              ),
                          },
                        ]
                      : []),
                  ]}
                />
              </div>
            </td>
          </tr>
        )}
        recordsPerPage={recordsPerPage}
        onRecordsPerPageChange={handleRecordsPerPageChange}
        totalResults={totalResults}
        totalPages={Math.ceil(totalResults / recordsPerPage)}
        currentPage={currentPage}
        onPageChange={handlePageChange}
      />

      {/* Error Display */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Error loading notifications
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={closeModal}>
        <ModalHeader>Notification Details</ModalHeader>
        <ModalBody>
          {selectedNotification && (
            <div className="grid grid-cols-1 gap-4">
              <div className="col-span-1 pb-2 border-b">
                <h3 className="text-lg font-semibold">Notification</h3>
              </div>
              <div>
                <p className="text-sm text-[var(--p-blue)]">Message:</p>
                <p className="font-medium">
                  {selectedNotification.message ||
                    selectedNotification.body ||
                    selectedNotification.title}
                </p>
              </div>
              <div>
                <p className="text-sm text-[var(--p-blue)]">Status:</p>
                <Badge
                  type={isUnread(selectedNotification) ? "success" : "danger"}
                >
                  {isUnread(selectedNotification) ? "Unread" : "Read"}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-[var(--p-blue)]">Date:</p>
                <p className="font-medium">
                  {showDateTimeFormat(selectedNotification.createdAt)}
                </p>
              </div>
              {selectedNotification.readAt && (
                <div>
                  <p className="text-sm text-[var(--p-blue)]">Read At:</p>
                  <p className="font-medium">
                    {showDateTimeFormat(selectedNotification.readAt)}
                  </p>
                </div>
              )}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <div className="flex justify-end items-center w-full space-x-3">
            <button
              onClick={closeModal}
              className="px-5 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors duration-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-300"
            >
              Close
            </button>
            {selectedNotification && isUnread(selectedNotification) && (
              <button
                className="px-5 py-2 text-sm font-medium text-white bg-[var(--p-blue)] hover:bg-[#9abb32] transition-colors duration-200 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:ring-opacity-50"
                onClick={() => {
                  handleNotificationClick(selectedNotification);
                  closeModal();
                }}
              >
                Proceed
              </button>
            )}
          </div>
        </ModalFooter>
      </Modal>
    </div>
  );
};

export default Notifications;
