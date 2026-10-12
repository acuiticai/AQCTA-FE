"use client";

import { WindmillContext } from "@windmill/react-ui";
import { useContext, useRef, useState, useEffect } from "react";
import {
  FiSun,
  FiMoon,
  FiBell,
  FiPlus,
  FiTrash2,
  FiCheck,
  FiMenu,
  FiChevronLeft,
  FiSearch,
  FiGlobe,
} from "react-icons/fi";
import { Link, useLocation, useHistory } from "react-router-dom";
import { AdminContext } from "@/context/AdminContext";
import { SidebarContext } from "@/context/SidebarContext";
import { useMainShell } from "@/context/MainShellContext";
import { useTranslation } from "react-i18next";
import searchIcon01 from "../../assets/img/icons/searchIcon01.svg";
import searchIcon02 from "../../assets/img/icons/searchIcon02.svg";
import Cookies from "js-cookie";
import { useHeaderNotifications } from "@/hooks/useHeaderNotifications";
import {
  cleanupNotifications,
  removeFCMToken,
} from "@/utils/initializeNotifications";
import notificationService from "@/services/notificationService.jsx";
import { toast } from "react-toastify";
import DropdownBasic from "@/page-layouts/components/DropdownBasic";
import { logoutUser } from "@/utils/generic";
import {
  DEFAULT_ADMIN_AVATAR_URL,
  getAdminAvatarUrl,
} from "@/utils/adminAvatar";

/**
 * Header component, responsible for rendering the top navigation bar
 * @returns {JSX.Element} The header component
 */
const Header = () => {
  const {
    toggleSidebar,
    isSidebarOpen,
    isSidebarCollapsed,
    toggleSidebarCollapse,
    windowDimension,
  } = useContext(SidebarContext);
  // Tailwind `lg` — desktop collapse vs mobile drawer
  const isDesktopNav = windowDimension >= 1024;
  const { state, dispatch } = useContext(AdminContext);
  const { mode } = useContext(WindmillContext);
  const { adminInfo } = state;
  const location = useLocation();
  const history = useHistory();
  const profileRef = useRef(null);
  const notificationRef = useRef(null);
  const languageRef = useRef(null);
  const { t, i18n } = useTranslation();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isNotificationLoading, setIsNotificationLoading] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState(i18n.language || "en");

  const isStaff = state?.adminInfo?.userType === "staff" || false;
  const inMainShell = useMainShell();

  // Legacy settings shell only (routes still outside Layout). Product settings
  // now live under System Settings in the main sidebar.
  const settingsRoutes = [
    "/Settings",
    "/reminders",
    "/cheque-reminders",
    "/taxes",
    "/vendor-invoice-approval",
    "/credit-notes-approval",
    "/special-transfers-types",
    "/PaymentMethods",
    "/TransactionTypes",
    "/AdvanceTypes",
    "/Channels",
    "/Documents_Misc_Data_Types",
    "/Finance_Misc_Data_Types",
    "/Currency",
    "/Leaves",
    "/claims",
    "/Shifts",
    "/PublicHolidays",
    "/WFHSettings",
    "/WFHGroups",
    "/Item_Misc_Data_Types",
    "/Miscellanious_Misc_Data_Types",
    "/EmailTemplatesUI",
    "/Operations_Misc_Data_Types",
    "/Purchase_Misc_Data_Types",
    "/settings/module-labels",
    "/account-types",
    "/bank-account-types",
    "/bank-account-mapping",
    "/document-types",
    "/document_templates",
    "/payroll-pay-elements",
    "/payroll-company-settings",
    "/payroll-statutory-settings",
    "/payroll-pay-groups",
  ];

  const isSettingsPage = settingsRoutes.some(
    (route) =>
      location.pathname === route || location.pathname.startsWith(route + "/"),
  );

  const handleSidebarButtonClick = () => {
    if (isSettingsPage && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("toggle-settings-sidebar"));
      return;
    }
    if (isDesktopNav) {
      toggleSidebarCollapse();
      return;
    }
    toggleSidebar();
  };

  // Language options
  const languageOptions = [
    { label: "English", value: "en" },
    { label: "Bahasa Indonesia", value: "id" },
    { label: "العربية", value: "ar" },
  ];

  // Use the header notification hook
  const { notifications, unreadCount, loading, refreshNotifications } =
    useHeaderNotifications(adminInfo?.id);

  // Debug logging for unreadCount changes
  useEffect(() => {
    console.log("📬 Header: unreadCount changed to:", unreadCount);
    console.log("📬 Header: notifications count:", notifications.length);
    console.log(
      "📬 Header: notifications:",
      notifications.map((n) => ({
        id: n._id,
        isRead: n.isRead || n.is_read,
        title: n.title,
      })),
    );
  }, [unreadCount, notifications.length, notifications]);

  // Handle language change
  const handleLanguageChange = (lang) => {
    i18n.changeLanguage(lang);
    setCurrentLanguage(lang);
    setLanguageOpen(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target)
      ) {
        setNotificationOpen(false);
      }
      if (languageRef.current && !languageRef.current.contains(event.target)) {
        setLanguageOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [profileRef, notificationRef, languageRef]);

  // Update current language when i18n language changes
  useEffect(() => {
    setCurrentLanguage(i18n.language || "en");
  }, [i18n.language]);

  const handleProfileOpen = () => {
    setProfileOpen(!profileOpen);
    setNotificationOpen(false);
  };

  const handleNotificationOpen = async () => {
    if (!notificationOpen) {
      // When opening the dropdown, fetch latest notifications
      console.log(
        "🔍 Header: Opening notification dropdown, fetching latest notifications",
      );
      setIsNotificationLoading(true); // Show loading state
      try {
        await refreshNotifications();
        console.log("✅ Header: Successfully fetched latest notifications");
      } catch (error) {
        console.error("❌ Header: Error fetching notifications:", error);
      } finally {
        setIsNotificationLoading(false); // Hide loading state
      }
    }
    setNotificationOpen(!notificationOpen);
    setProfileOpen(false);
  };

  const handleLogout = async () => {
    try {
      // Remove FCM token from backend before logout (only for web platform)
      if (adminInfo?.id) {
        console.log(
          "🗑️ Removing FCM token before logout for user:",
          adminInfo.id,
        );
        await removeFCMToken(adminInfo.id, "web"); // Explicitly specify web platform
      }
    } catch (error) {
      console.warn("⚠️ Failed to remove FCM token during logout:", error);
      // Continue with logout even if FCM token removal fails
    }

    // Cleanup local state and redirect
    dispatch({ type: "USER_LOGOUT" });
    logoutUser();
    cleanupNotifications();
    history.push("/login");
  };

  const handleNotificationClick = ({ link, ...notification }) => {
    // Navigate to the appropriate page based on notification link
    if (link) {
      console.log("🧭 Navigating to:", { notification });
      if (/^https?:\/\//.test(link)) {
        // If link is absolute, navigate directly
        window.location.href = link;
      } else if (notification?.state) {
        history.push(link, { ...notification?.state });
      } else {
        history.push(link);
      }
      setNotificationOpen(false);
    }
  };

  // Delete notification from header
  const handleDeleteNotification = async (notificationId, event, isTask) => {
    event.stopPropagation();
    if (isTask) {
      toast.warn("Task notifications cannot be deleted.");
      return;
    }
    await notificationService.deleteNotification(notificationId);
    refreshNotifications();
  };

  const handleMarkAllAsRead = async () => {
    if (!unreadCount || loading || isNotificationLoading || !adminInfo?.id)
      return;
    try {
      setIsNotificationLoading(true);
      // Pass adminInfo.id explicitly — service.userId may be null if FCM init failed
      await notificationService.markAllAsRead(adminInfo.id);
      toast.success("All notifications marked as read");
      await refreshNotifications();
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      toast.error("Failed to mark all notifications as read");
    } finally {
      setIsNotificationLoading(false);
    }
  };

  // Filter notifications based on search term
  const filteredNotifications = notifications.filter(
    (notification) =>
      notification.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      notification.body?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      notification.message?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Format time
  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const generateBreadcrumbs = () => {
    const adjustmentModules =
      location.pathname === "/onboarding/modules" &&
      ["1", "true"].includes(
        new URLSearchParams(location.search).get("adjustment") || "",
      );
    if (adjustmentModules) {
      return (
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <Link
            to="/home"
            className="font-semibold text-gray-700 hover:text-[var(--header-text-hover)] transition-colors"
          >
            {t("Dashboard")}
          </Link>
          <span>/</span>
          <Link to="/billing" className="text-gray-600 hover:underline">
            Billing
          </Link>
          <span>/</span>
          <span className="font-semibold text-gray-900">Adjust modules</span>
        </div>
      );
    }

    const adjustmentPricing =
      location.pathname === "/onboarding/pricing" &&
      ["1", "true"].includes(
        new URLSearchParams(location.search).get("adjustment") || "",
      );
    if (adjustmentPricing) {
      return (
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <Link
            to="/home"
            className="font-semibold text-gray-700 hover:text-[var(--header-text-hover)] transition-colors"
          >
            {t("Dashboard")}
          </Link>
          <span>/</span>
          <Link to="/billing" className="text-gray-600 hover:underline">
            Billing
          </Link>
          <span>/</span>
          <span className="font-semibold text-gray-900">Confirm plan</span>
        </div>
      );
    }

    const subscriptionCatalogEditMatch = /^\/subscription-catalog\/edit\/[^/]+$/.exec(
      location.pathname,
    );
    if (subscriptionCatalogEditMatch) {
      return (
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <Link
            to="/home"
            className="font-semibold text-gray-700 hover:text-[var(--header-text-hover)] transition-colors"
          >
            {t("Dashboard")}
          </Link>
          <span>/</span>
          <Link
            to="/subscription-catalog"
            className="text-gray-600 hover:underline"
          >
            Subscription Catalog
          </Link>
          <span>/</span>
          <span className="font-semibold text-gray-900">Edit</span>
        </div>
      );
    }

    if (location.pathname === "/subscription-catalog/create") {
      return (
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <Link
            to="/home"
            className="font-semibold text-gray-700 hover:text-[var(--header-text-hover)] transition-colors"
          >
            {t("Dashboard")}
          </Link>
          <span>/</span>
          <Link
            to="/subscription-catalog"
            className="text-gray-600 hover:underline"
          >
            Subscription Catalog
          </Link>
          <span>/</span>
          <span className="font-semibold text-gray-900">Create</span>
        </div>
      );
    }

    const subscriptionInvitationsMatch =
      /^\/subscription-catalog\/[^/]+\/invitations$/.exec(location.pathname);
    if (subscriptionInvitationsMatch) {
      return (
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <Link
            to="/home"
            className="font-semibold text-gray-700 hover:text-[var(--header-text-hover)] transition-colors"
          >
            {t("Dashboard")}
          </Link>
          <span>/</span>
          <Link
            to="/subscription-catalog"
            className="text-gray-600 hover:underline"
          >
            Subscription Catalog
          </Link>
          <span>/</span>
          <span className="font-semibold text-gray-900">Invitations</span>
        </div>
      );
    }

    if (location.pathname === "/subscription-catalog") {
      return (
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <Link
            to="/home"
            className="font-semibold text-gray-700 hover:text-[var(--header-text-hover)] transition-colors"
          >
            {t("Dashboard")}
          </Link>
          <span>/</span>
          <span className="font-semibold text-gray-900">Subscription Catalog</span>
        </div>
      );
    }

    const customBreadcrumbsByPath = {
      "/settings/custom-fields": ["Custom fields"],
      "/settings/module-labels": ["Module Labels"],
      "/accounts/zoho-books": ["Zoho Books"],
      "/accounts/service-monster": ["ServiceMonster"],
      "/accounts/e-invoice-settings": ["E-Invoice"],
    };
    const pathnames =
      customBreadcrumbsByPath[location.pathname] ||
      location.pathname.split("/").filter((x) => x);

    const isObjectId = (value) => /^[a-f\d]{24,}$/i.test(value);
    const isUuid = (value) =>
      /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(
        decodeURIComponent(value || ""),
      );
    const containsMultipleObjectIds = (value) => {
      const ids = value.split(",");
      return ids.every((id) => /^[a-f\d]{24,}$/i.test(id));
    };

    const formatLabel = (str) => {
      return str
        .replace(/[_-]/g, " ")
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
    };

    const visibleIndexes = pathnames
      .map((value, index) => {
        if (isObjectId(value) || isUuid(value) || containsMultipleObjectIds(value)) {
          return null;
        }
        return index;
      })
      .filter((index) => index !== null);
    const lastVisibleIndex = visibleIndexes[visibleIndexes.length - 1];

    return (
      <div className="flex items-center space-x-2 text-[13px] text-[#5a5a5a]">
        <Link
          to="/home"
          className="font-medium text-[#5a5a5a] transition-colors hover:text-[var(--header-text-hover)]"
        >
          {t("Dashboard")}
        </Link>
        {pathnames.map((value, index) => {
          if (isObjectId(value) || isUuid(value) || containsMultipleObjectIds(value)) {
            return null;
          }
          const routeTo = `/${pathnames.slice(0, index + 1).join("/")}`;
          const isLast = index === lastVisibleIndex;

          return (
            <span key={routeTo} className="flex items-center space-x-2">
              <span className="text-[#848484]">/</span>
              {isLast ? (
                <span className="font-semibold text-[#0a0a0a]">
                  {formatLabel(value)}
                </span>
              ) : (
                <Link
                  to={routeTo}
                  className="text-[#5a5a5a] hover:text-[var(--header-text-hover)]"
                >
                  {formatLabel(value)}
                </Link>
              )}
            </span>
          );
        })}
      </div>
    );
  };

  // Nested page Headers no-op when already inside the main Layout chrome.
  if (inMainShell) return null;

  return (
    <header
      className="admin-topbar"
      style={{ backgroundColor: "var(--header-bg)" }}
    >
      <div className="admin-topbar__inner">
        {/* Left Section: Sidebar Toggle Icon and Breadcrumbs */}
        <div className="flex flex-1 items-center space-x-3">
          <button
            type="button"
            onClick={handleSidebarButtonClick}
            className="admin-iconbtn"
            aria-expanded={
              isSettingsPage
                ? undefined
                : isDesktopNav
                  ? !isSidebarCollapsed
                  : isSidebarOpen
            }
            aria-label={
              isSettingsPage
                ? "Toggle Settings Sidebar"
                : isDesktopNav
                  ? isSidebarCollapsed
                    ? "Expand Sidebar"
                    : "Collapse Sidebar"
                  : isSidebarOpen
                    ? "Close Menu"
                    : "Open Menu"
            }
            title={
              isSettingsPage
                ? "Toggle Settings Sidebar"
                : isDesktopNav
                  ? isSidebarCollapsed
                    ? "Expand Sidebar"
                    : "Collapse Sidebar"
                  : isSidebarOpen
                    ? "Close Menu"
                    : "Open Menu"
            }
          >
            {isDesktopNav && !isSidebarCollapsed ? (
              <FiChevronLeft className="h-[18px] w-[18px]" />
            ) : (
              <FiMenu className="h-[18px] w-[18px]" />
            )}
          </button>

          <div className="hidden md:block">{generateBreadcrumbs()}</div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Search Bar */}
          {/* <div className="relative hidden lg:block">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FiSearch className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder={t("Search")}
              className="block w-64 pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--header-focus-ring)] focus:border-transparent bg-gray-50 transition-all duration-200"
            />
          </div> */}

          <div className="relative" ref={languageRef}>
            <button
              type="button"
              onClick={() => setLanguageOpen(!languageOpen)}
              className="admin-iconbtn admin-iconbtn--pill"
              aria-label="Change Language"
            >
              <FiGlobe className="h-[18px] w-[18px]" />
              <span className="hidden text-sm font-medium text-[#1a1a1a] sm:block">
                {languageOptions.find((lang) => lang.value === currentLanguage)
                  ?.label || "English"}
              </span>
            </button>

            {languageOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-50">
                {languageOptions.map((lang) => (
                  <button
                    key={lang.value}
                    onClick={() => handleLanguageChange(lang.value)}
                    className={`w-full text-left px-4 py-3 text-sm transition-colors duration-150 ${
                      currentLanguage === lang.value
                        ? "bg-[var(--header-hover-bg)] text-[var(--header-text-hover)] font-medium"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative" ref={notificationRef}>
            <button
              type="button"
              className="admin-iconbtn relative disabled:opacity-50"
              onClick={handleNotificationOpen}
              disabled={loading || isNotificationLoading}
              aria-label={t("Notifications")}
            >
              <FiBell className="h-[18px] w-[18px]" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#C5061A] px-1.5 text-xs font-bold leading-none text-white">
                  {unreadCount > 50 ? "50+" : unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {notificationOpen && (
              <div
                key={`notifications-${notifications.length}-${unreadCount}`}
                className="absolute right-0 w-96 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-50 transform transition-all duration-200 ease-out"
              >
                {/* Header with title and actions */}
                <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-[var(--header-hover-bg)] to-[var(--blue-100)]">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <FiBell className="w-5 h-5 text-[var(--header-icon-hover)]" />
                      <h3 className="text-lg font-semibold text-gray-900">
                        {t("Notifications")}
                      </h3>
                      {unreadCount > 0 && (
                        <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-500 rounded-full">
                          {unreadCount}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={handleMarkAllAsRead}
                        disabled={loading || isNotificationLoading || !unreadCount}
                        className="flex items-center text-xs bg-gray-500 text-white px-2 py-1.5 rounded-md hover:bg-gray-600 disabled:opacity-50 transition-colors duration-200"
                        title="Mark all as read"
                        aria-label="Mark all as read"
                      >
                        <FiCheck className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={refreshNotifications}
                        disabled={loading || isNotificationLoading}
                        className="flex items-center text-xs bg-gray-500 text-white px-2 py-1.5 rounded-md hover:bg-gray-600 disabled:opacity-50 transition-colors duration-200"
                        title="Refresh notifications"
                      >
                        {isNotificationLoading ? (
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                        ) : (
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                          </svg>
                        )}
                      </button>
                      <button
                        onClick={() => setNotificationOpen(false)}
                        className="text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100 transition-colors duration-200"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
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
                  </div>
                </div>

                {/* Search box for notifications */}
                <div className="p-3 border-b border-gray-200 bg-gray-50">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder={`${t("Search")} ${t(
                        "Notifications",
                      ).toLowerCase()}...`}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full p-2 pl-8 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <svg
                      className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400"
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
                </div>

                {/* Notifications list */}
                <div className="max-h-96 overflow-y-auto">
                  {isNotificationLoading || loading ? (
                    <div className="p-6 text-center">
                      <div className="inline-flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--header-focus-ring)]"></div>
                        <span className="text-gray-500">
                          {isNotificationLoading
                            ? "Loading notifications..."
                            : "Loading notifications..."}
                        </span>
                      </div>
                    </div>
                  ) : filteredNotifications.length === 0 ? (
                    <div className="p-6 text-center">
                      <FiBell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">
                        {searchTerm
                          ? t("No data available")
                          : t("No notifications yet")}
                      </p>
                      {!searchTerm && (
                        <p className="text-xs text-gray-400 mt-1">
                          {t("New notifications will appear here")}
                        </p>
                      )}
                    </div>
                  ) : (
                    filteredNotifications.map((notification, index) => (
                      <div
                        key={notification._id}
                        className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-all duration-200 ${
                          !notification.isRead && !notification.is_read
                            ? "bg-[var(--header-hover-bg)] border-l-4 border-l-[var(--header-focus-ring)]"
                            : ""
                        } ${index === 0 ? "notification-slide-in" : ""}`}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start space-x-3">
                              <div
                                className={`flex-shrink-0 w-2 h-2 rounded-full mt-2 ${
                                  !notification.isRead && !notification.is_read
                                    ? "bg-[var(--header-focus-ring)]"
                                    : "bg-gray-300"
                                }`}
                              ></div>
                              <div className="flex-1 min-w-0">
                                <p
                                  className={`text-sm font-medium truncate ${
                                    !notification.isRead &&
                                    !notification.is_read
                                      ? "text-gray-900"
                                      : "text-gray-700"
                                  }`}
                                >
                                  {notification.title || notification.message}
                                </p>
                                {(notification.body ||
                                  notification.message) && (
                                  <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                                    {notification.body || notification.message}
                                  </p>
                                )}
                                <div className="flex items-center justify-between mt-2">
                                  <p className="text-xs text-gray-400">
                                    {formatTime(notification.createdAt)}
                                  </p>
                                  {!notification.isRead &&
                                    !notification.is_read && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--blue-100)] text-[var(--blue-800)]">
                                        New
                                      </span>
                                    )}
                                </div>
                              </div>
                            </div>
                          </div>
                          <button
                            disabled={notification.hasTask}
                            onClick={(e) =>
                              handleDeleteNotification(
                                notification._id,
                                e,
                                notification.hasTask,
                              )
                            }
                            className="ml-3 text-gray-400 hover:text-red-500 transition-colors duration-200 p-1 rounded-full hover:bg-red-50"
                            title={
                              notification.hasTask
                                ? "Task notifications cannot be deleted"
                                : "Delete notification"
                            }
                          >
                            <FiTrash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* View all link */}
                <div className="p-3 border-t border-gray-200 bg-gray-50">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        history.push("/notifications");
                        setNotificationOpen(false);
                      }}
                      className="flex-1 text-center text-sm text-[var(--header-text-hover)] hover:text-[var(--blue-800)] font-medium py-2 rounded-md hover:bg-[var(--header-hover-bg)] transition-colors duration-200"
                    >
                      {t("View All")} {t("Notifications").toLowerCase()}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={handleProfileOpen}
              className="admin-iconbtn admin-iconbtn--pill admin-topbar__profile"
              aria-expanded={profileOpen}
              aria-label={adminInfo?.role?.name || "Admin profile"}
            >
              <img
                src={getAdminAvatarUrl(adminInfo)}
                alt=""
                className="admin-topbar__profile-photo"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = DEFAULT_ADMIN_AVATAR_URL;
                }}
              />
              <span className="admin-topbar__profile-role hidden max-w-[140px] truncate sm:inline">
                {adminInfo?.role?.name || "Admin"}
              </span>
            </button>

            {profileOpen && (
              <ul
                className="absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-lg border border-[var(--acu-border)] bg-white text-sm shadow-xl"
              >
                <li
                  className="cursor-pointer px-4 py-2.5 text-gray-700 transition-colors hover:bg-[var(--header-hover-bg)] hover:text-[var(--header-text-hover)]"
                  onClick={() => {
                    history.push("/dashboard");
                    setProfileOpen(false);
                  }}
                >
                  {t("Dashboard")}
                </li>
                {isStaff && (
                  <li
                    className="cursor-pointer px-4 py-2.5 text-gray-700 transition-colors hover:bg-[var(--header-hover-bg)] hover:text-[var(--header-text-hover)]"
                    onClick={() => {
                      history.push("/my-HR");
                      setProfileOpen(false);
                    }}
                  >
                    {t("My HR")}
                  </li>
                )}
                <li
                  className="cursor-pointer px-4 py-2.5 text-gray-700 transition-colors hover:bg-[var(--header-hover-bg)] hover:text-[var(--header-text-hover)]"
                  onClick={() => {
                    history.push("/edit-profile");
                    setProfileOpen(false);
                  }}
                >
                  {t("Edit Profile")}
                </li>
                <li className="border-t border-[var(--acu-border)]" />
                <li
                  className="cursor-pointer px-4 py-2.5 text-red-600 transition-colors hover:bg-red-50"
                  onClick={handleLogout}
                >
                  {t("Logout")}
                </li>
              </ul>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
