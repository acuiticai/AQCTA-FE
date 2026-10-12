"use client";

import { useState, useEffect, useRef, useContext, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { formatDate } from "@/components/formatAmount";
import { useLocation } from "react-router-dom";
import axios from "axios";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { formatAmount } from "@/components/formatAmount";

import {
  CurrencyDropdown,
  FormInput,
  CustomModal,
  ActionButtons,
} from "@/page-layouts/index";
import { notifyError, notifySuccess } from "@/utils/toast";
import csv from "../../../assets/img/icons/csv.png";
import pdf from "../../../assets/img/icons/pdf.png";
import { useHistory } from "react-router-dom";
import { useDebounce } from "use-debounce";
import HrListStatsSummaryCards from "../components/HrListStatsSummaryCards";
import { AdminContext } from "@/context/AdminContext";
import request from "@/services/httpService";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";
import { EpcPage } from "@/components/Epc/EpcSurface";
import FilterBar from "@/customer/components/ui/FilterBar";
import { Card, CardHeader } from "@/customer/components/ui/Card";
import PortalDataTable from "@/customer/components/ui/DataTable";
import Pagination from "@/customer/components/ui/Pagination";
import Button from "@/customer/components/ui/Button";
import { PlusIcon } from "@/customer/components/ui/icons";

// Import the enhanced currency helpers
import {
  calculateTotalClaimableAmount,
  getUniqueCurrencies,
  getCurrencyWiseTotals,
} from "./currency-helpers";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const ClaimsDashboard = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const [claims, setClaims] = useState([]);
  const [filteredClaims, setFilteredClaims] = useState([]);
  const [totalResults, setTotalResults] = useState(0);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const currentPageRef = useRef(1);
  const skipClaimStructuralFilterEffect = useRef(true);
  const [stats, setStats] = useState({
    total: 0,
    approved: 0,
    pending: 0,
    rejected: 0,
    totalAmount: 0,
  });

  // Modal states
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [currentClaimId, setCurrentClaimId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showClaimApprovalLevelsModal, setShowClaimApprovalLevelsModal] =
    useState(false);
  const [currentClaimForLevels, setCurrentClaimForLevels] = useState(null);

  // Filter states
  const [nameIdFilter, setNameIdFilter] = useState("");
  const [claimReference, setClaimReference] = useState("");
  // const [amountFilter, setAmountFilter] = useState("");
  const [claimGroupFilter, setClaimGroupFilter] = useState("");
  const [claimTypeFilter, setClaimTypeFilter] = useState("");
  const [currencyFilter, setCurrencyFilter] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [claimGroups, setClaimGroups] = useState([]);
  const [claimTypes, setClaimTypes] = useState([]);
  const [dateRangeFilter, setDateRangeFilter] = useState({
    startDate: "",
    endDate: "",
  });
  const [businesses, setBusinesses] = useState([]);
  const [claimsLoading, setClaimsLoading] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [tableSearchFilter] = useDebounce(searchInput, 500);
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const location = useLocation();
  const [pagePermissions, setPagePermissions] = useState([]);

  // Check page permissions
  const checkPagePermissions = () => {
    if (!adminInfo || !adminInfo.role || !adminInfo.role.modules) {
      console.log("No admin info or modules found");
      return;
    }

    const currentPath = location.pathname;
    console.log("Current Path:", currentPath);

    let permissions = [];

    adminInfo.role.modules.forEach((module) => {
      if (!module.path) {
        console.log(`⚠️ Missing path for module: ${module.name}`);
        return;
      }

      console.log("Checking module:", module.name, "Path:", module.path);

      if (currentPath === module.path) {
        console.log("✅ Matched Module:", module.name);
        permissions = [...permissions, ...module.permissions];
      }

      module.subModules?.forEach((subModule) => {
        if (!subModule.path) {
          console.log(`⚠️ Missing path for subModule: ${subModule.name}`);
          return;
        }

        console.log(
          "Checking subModule:",
          subModule.name,
          "Path:",
          subModule.path
        );

        if (currentPath === subModule.path) {
          console.log("✅ Matched SubModule:", subModule.name);
          permissions = [...permissions, ...subModule.permissions];
        }
      });
    });

    if (permissions.length > 0) {
      console.log("✅ Final Permissions:", permissions);
      setPagePermissions([...new Set(permissions)]);
    } else {
      console.log("🚨 No permissions found for this page.");
      setPagePermissions([]);
    }
  };

  const fetchClaimGroups = async () => {
    try {
      const payload = {
        bid: companyFilter,
        // FilterStatus: "",
        // FilterName: "",
      };
      const response = await axios.get(`${Base_URL}/claim-groups`, {
        params: payload,
      });
      setClaimGroups(response.data || []);
    } catch (error) {
      console.error("Error fetching claim groups:", error);
    } finally {
    }
  };

  const fetchClaimTypes = async () => {
    try {
      const res = await axios.get(`${Base_URL}/claim-types`, {
        params: { bid: companyFilter, claimGroup: claimGroupFilter },
      });
      setClaimTypes(res.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  useEffect(() => {
    if (adminInfo) {
      checkPagePermissions();
    }
  }, [location.pathname, adminInfo]);

  console.log("pagePermissions", pagePermissions);

  const hasPermission = (permission) => {
    console.log("permission", permission);
    console.log("pagePermissions", pagePermissions);
    return pagePermissions.includes(permission);
  };

  /** Prefer chain frozen at claim creation (matches backend). */
  const getClaimApprovalChainForRow = (claim) => {
    const snap = claim?.approvalLevelsSnapshot;
    if (Array.isArray(snap) && snap.length > 0) return snap;
    return claim?.employee?.claimApprovalLevels || [];
  };

  const getClaimStatusColor = (status) => {
    switch (status) {
      case "Approved":
        return "text-green-500 bg-green-50";
      case "Rejected":
        return "text-red-500 bg-red-50";
      case "Pending":
        return "text-yellow-500 bg-yellow-50";
      default:
        return "text-yellow-500 bg-yellow-50";
    }
  };

  const renderClaimStatusCell = (claim) => {
    const chain = getClaimApprovalChainForRow(claim);
    const approvals = claim.approvals || [];

    if (chain.length === 0) {
      return (
        <div className="flex flex-col items-center gap-1.5 w-fit max-w-[200px]">
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${getClaimStatusColor(
              claim.status
            )}`}
          >
            {claim.status}
          </span>
          {claim.status === "Pending" &&
            claim.hasActed &&
            claim.nextActionMessage && (
              <span className="text-xs text-gray-500 text-center max-w-[180px] leading-snug">
                {claim.nextActionMessage}
              </span>
            )}
          {claim.status === "Approved" && (
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${
                claim.isExpenseCreated
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {claim.isExpenseCreated
                ? "Expense Created"
                : "Expense Not Created"}
            </span>
          )}
        </div>
      );
    }

    if (claim.status === "Approved") {
      return (
        <div className="flex flex-col gap-1.5 w-fit max-w-[200px]">
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium w-fit ${getClaimStatusColor(
              "Approved"
            )}`}
          >
            Approved
          </span>
          <div
            className="relative group cursor-pointer w-full"
            title="This claim has been fully approved"
          >
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div className="bg-green-500 h-2 w-full rounded-full" />
            </div>
          </div>
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium w-fit ${
              claim.isExpenseCreated
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {claim.isExpenseCreated
              ? "Expense Created"
              : "Expense Not Created"}
          </span>
        </div>
      );
    }

    if (claim.status === "Rejected") {
      return (
        <div className="flex flex-col gap-1.5 w-fit max-w-[200px]">
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium w-fit ${getClaimStatusColor(
              "Rejected"
            )}`}
          >
            Rejected
          </span>
          <div
            className="relative group cursor-pointer w-full"
            title="This claim has been rejected"
          >
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div className="bg-red-500 h-2 w-full rounded-full" />
            </div>
          </div>
        </div>
      );
    }

    const allLevels = chain
      .map((l) => ({
        level:
          typeof l.level === "number"
            ? l.level
            : parseInt(String(l.level), 10) || 0,
        config: l,
      }))
      .filter((x) => x.level > 0)
      .sort((a, b) => a.level - b.level);

    if (allLevels.length === 0) {
      return (
        <div className="flex flex-col items-center gap-1.5 w-fit max-w-[200px]">
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${getClaimStatusColor(
              claim.status
            )}`}
          >
            {claim.status}
          </span>
        </div>
      );
    }

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
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium w-fit ${getClaimStatusColor(
            overallStatus
          )}`}
        >
          {overallStatus}
        </span>
        <div
          className="relative group cursor-pointer w-full min-w-[72px]"
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

  const compareIds = (id1, id2) => {
    if (!id1 || !id2) return false;
    const str1 = String(id1.toString ? id1.toString() : id1);
    const str2 = String(id2.toString ? id2.toString() : id2);
    return str1 === str2;
  };

  const canUserApproveAtLevel = (claim, level) => {
    if (
      !adminInfo ||
      (!claim.employee && getClaimApprovalChainForRow(claim).length === 0)
    ) {
      return false;
    }
    const chain = getClaimApprovalChainForRow(claim);
    const levelConfig = chain.find((l) => {
      const configLevel =
        typeof l.level === "number" ? l.level : parseInt(String(l.level), 10);
      const checkLevel = typeof level === "number" ? level : parseInt(level, 10);
      return configLevel === checkLevel;
    });
    if (!levelConfig || !levelConfig.role) return false;

    const userRoleName = adminInfo.role?.name || adminInfo.role || "";
    const userId = adminInfo.id
      ? adminInfo.id.toString
        ? adminInfo.id.toString()
        : String(adminInfo.id)
      : adminInfo._id?.toString
      ? adminInfo._id.toString()
      : String(adminInfo._id || "");

    const requiredRoleName = levelConfig.role || "";
    const requiredUserId = levelConfig.user?._id
      ? levelConfig.user._id.toString
        ? levelConfig.user._id.toString()
        : String(levelConfig.user._id)
      : levelConfig.user?.toString
      ? levelConfig.user.toString()
      : String(levelConfig.user || "");

    const roleMatches =
      userRoleName && requiredRoleName && userRoleName === requiredRoleName;

    if (requiredUserId) {
      return roleMatches && compareIds(requiredUserId, userId);
    }
    return roleMatches;
  };

  const arePreviousLevelsApproved = (claim, level) => {
    if (level === 1) return true;
    const approvals = claim.approvals || [];
    const approvedLevels = approvals
      .filter((a) => a.status === "Approved")
      .map((a) => a.level);
    for (let i = 1; i < level; i++) {
      if (!approvedLevels.includes(i)) return false;
    }
    return true;
  };

  const getNextApprovableLevel = (claim) => {
    const approvals = claim.approvals || [];
    const approvedLevels = approvals
      .filter((a) => a.status === "Approved")
      .map((a) => a.level);

    const chain = getClaimApprovalChainForRow(claim);
    const sortedLevels =
      chain.length > 0
        ? [...chain]
            .map((l) => ({
              ...l,
              level: typeof l.level === "number" ? l.level : parseInt(l.level, 10),
            }))
            .sort((a, b) => a.level - b.level)
            .map((l) => l.level)
        : [];

    const levelsToCheck = sortedLevels.length > 0 ? sortedLevels : [1];

    for (const level of levelsToCheck) {
      if (approvedLevels.includes(level)) continue;
      let allPreviousApproved = true;
      for (let prevLevel = 1; prevLevel < level; prevLevel++) {
        if (!approvedLevels.includes(prevLevel)) {
          allPreviousApproved = false;
          break;
        }
      }
      if (!allPreviousApproved) continue;
      if (canUserApproveAtLevel(claim, level)) return level;
    }
    return null;
  };

  const hasUserApprovedClaim = (claim) => {
    if (!adminInfo || !claim.approvals) return false;
    const userId = adminInfo.id
      ? adminInfo.id.toString
        ? adminInfo.id.toString()
        : String(adminInfo.id)
      : adminInfo._id?.toString
      ? adminInfo._id.toString()
      : String(adminInfo._id || "");
    return claim.approvals.some((a) => a._id && compareIds(a._id, userId));
  };

  const getRemainingApprovalsCount = (claim) => {
    const chain = getClaimApprovalChainForRow(claim);
    if (chain.length === 0) return 0;
    const approvals = claim.approvals || [];
    const approvedLevels = approvals
      .filter((a) => a.status === "Approved")
      .map((a) => a.level);
    const allLevels = chain.map((l) =>
      typeof l.level === "number" ? l.level : parseInt(l.level, 10)
    );
    const maxLevel = Math.max(...allLevels);
    return maxLevel - approvedLevels.length;
  };

  const canUserApproveClaim = (claim) => {
    if (
      !adminInfo ||
      (!claim.employee && getClaimApprovalChainForRow(claim).length === 0)
    )
      return { result: false, message: "No admin info or employee" };
    if (claim.status !== "Pending") {
      return { result: false, message: "N/A" };
    }
    const nextLevel = getNextApprovableLevel(claim);
    return {
      result: nextLevel !== null,
      message:
        nextLevel !== null
          ? `User can approve claim at level ${nextLevel}`
          : "Not your turn",
    };
  };

  const handleViewClaimApprovalLevels = (claim) => {
    setCurrentClaimForLevels(claim);
    setShowClaimApprovalLevelsModal(true);
  };

  const renderClaimApprovalSummary = (claim) => {
    const chain = getClaimApprovalChainForRow(claim);
    if (chain.length === 0) {
      return (
        <button
          type="button"
          onClick={() => handleViewClaimApprovalLevels(claim)}
          className="text-gray-400 text-xs hover:text-gray-600 underline"
        >
          View details
        </button>
      );
    }
    const approvals = claim.approvals || [];
    const approvedLevels = approvals
      .filter((a) => a.status === "Approved")
      .map((a) => a.level);
    const rejectedLevels = approvals
      .filter((a) => a.status === "Rejected")
      .map((a) => a.level);
    const levelsMatchAllApproved = chain.every((l) =>
      approvedLevels.includes(
        typeof l.level === "number" ? l.level : parseInt(l.level, 10)
      )
    );
    const anyRejected = rejectedLevels.length > 0;
    const allApproved =
      claim.status === "Approved" || levelsMatchAllApproved;

    return (
      <button
        type="button"
        onClick={() => handleViewClaimApprovalLevels(claim)}
        className="text-blue-600 text-xs hover:text-blue-800 underline"
      >
        {allApproved
          ? claim.status === "Approved" && !levelsMatchAllApproved
            ? "Approved"
            : `All ${chain.length} Approved`
          : claim.status === "Rejected" || anyRejected
          ? `Rejected (${rejectedLevels.length || "—"})`
          : `${approvedLevels.length}/${chain.length} Approved`}
      </button>
    );
  };

  const renderClaimApprovalsDetail = (claim) => {
    const chain = getClaimApprovalChainForRow(claim);
    if (chain.length === 0) {
      return (
        <span className="text-gray-400 text-sm">No approval levels configured</span>
      );
    }
    const approvalsByLevel = {};
    (claim.approvals || []).forEach((approval) => {
      if (!approvalsByLevel[approval.level]) {
        approvalsByLevel[approval.level] = [];
      }
      approvalsByLevel[approval.level].push(approval);
    });
    const allLevels = chain
      .map((l) => (typeof l.level === "number" ? l.level : parseInt(l.level, 10)))
      .sort((a, b) => a - b);

    return (
      <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
        {allLevels.map((level) => {
          const levelApprovals = approvalsByLevel[level] || [];
          const levelConfig = chain.find((l) => {
            const lv =
              typeof l.level === "number" ? l.level : parseInt(l.level, 10);
            return lv === level;
          });
          const roleName = levelConfig?.role || `Level ${level}`;
          const userName = levelConfig?.user
            ? `${levelConfig.user.name || ""} ${
                levelConfig.user.last_name || ""
              }`.trim() || levelConfig.user.email
            : null;
          const approved = levelApprovals.some((a) => a.status === "Approved");
          const rejected = levelApprovals.some((a) => a.status === "Rejected");
          const canApprove =
            canUserApproveAtLevel(claim, level) &&
            arePreviousLevelsApproved(claim, level);
          const isNextLevel = getNextApprovableLevel(claim) === level;
          const approval = levelApprovals.find(
            (a) => a.status === "Approved" || a.status === "Rejected"
          );

          return (
            <div
              key={level}
              className="border-l-2 pl-2 py-1"
              style={{
                borderColor: approved ? "#10b981" : rejected ? "#ef4444" : "#f59e0b",
              }}
            >
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-gray-700">Level {level}:</span>
                {approved ? (
                  <span className="text-green-600 font-medium">✓ Approved</span>
                ) : rejected ? (
                  <span className="text-red-600 font-medium">✗ Rejected</span>
                ) : (
                  <span className="text-yellow-600 font-medium">⏳ Pending</span>
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
                    <span className="font-semibold">Assigned user:</span>{" "}
                    <span className="font-medium">{userName}</span>
                  </div>
                ) : (
                  <div className="mb-1 text-gray-500 italic">
                    Any user with role &quot;{roleName}&quot; may act at this level.
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

  const getClaimActionButtons = (claim) => {
    const viewItem = {
      action: ACTION_BUTTON_TYPES.VIEW,
      tooltip: t("claimManagement.viewClaim"),
      permission: true,
      onClick: () => history.push(`/claim-details/${claim._id}`),
    };

    const wrap = (iconRow, extras = null) => (
      <div className="flex flex-col items-center gap-0.5 w-full px-1 text-center align-top">
        <div className="flex justify-center w-full overflow-visible leading-none">
          {iconRow}
        </div>
        {extras}
        {renderClaimApprovalSummary(claim)}
      </div>
    );

    if (claim.status !== "Pending") {
      return wrap(
        <ActionButtons isCell justifyCenter items={[viewItem]} />
      );
    }

    const userHasApproved = hasUserApprovedClaim(claim);
    const remainingCount = getRemainingApprovalsCount(claim);
    const canApproveClaim = canUserApproveClaim(claim);

    if (canApproveClaim.result) {
      const nextLevel = getNextApprovableLevel(claim);
      const levelConfig = getClaimApprovalChainForRow(claim).find((l) => {
        const lv = typeof l.level === "number" ? l.level : parseInt(l.level, 10);
        return lv === nextLevel;
      });
      const roleName = levelConfig?.role || `Level ${nextLevel}`;

      return wrap(
        <ActionButtons
          isCell
          justifyCenter
          items={[
            viewItem,
            {
              action: ACTION_BUTTON_TYPES.APPROVE,
              tooltip: t("claimManagement.approveClaim", {
                level: nextLevel,
                role: roleName,
              }),
              permission: true,
              onClick: () => handleApproveClick(claim._id),
            },
            {
              action: ACTION_BUTTON_TYPES.REJECT,
              tooltip: t("claimManagement.rejectClaim", {
                level: nextLevel,
                role: roleName,
              }),
              permission: true,
              onClick: () => handleRejectClick(claim._id),
            },
          ]}
        />,
        <span className="text-xs text-gray-500">
          {t("claimManagement.approvalLevelShort", { level: nextLevel })}
        </span>
      );
    }

    if (userHasApproved && claim.status === "Pending") {
      if (remainingCount > 0) {
        return wrap(
          <ActionButtons isCell justifyCenter items={[viewItem]} />,
          <>
            <span className="text-green-600 text-sm font-medium">
              ✓ {t("claimManagement.approvedLabel")}
            </span>
            <span className="text-gray-500 text-xs max-w-[280px] leading-snug">
              {remainingCount === 1
                ? t("claimManagement.waitingOneMoreApproval")
                : t("claimManagement.waitingMoreApprovals", {
                    count: remainingCount,
                  })}
            </span>
          </>
        );
      }
      return wrap(
        <ActionButtons isCell justifyCenter items={[viewItem]} />,
        <span className="text-green-600 text-sm font-medium">
          ✓ {t("claimManagement.approvedLabel")}
        </span>
      );
    }

    if (!canApproveClaim.result) {
      if (remainingCount > 0) {
        return wrap(
          <ActionButtons isCell justifyCenter items={[viewItem]} />,
          <span className="text-gray-400 text-sm italic max-w-[280px] leading-snug">
            {remainingCount === 1
              ? t("claimManagement.waitingOneApproval")
              : t("claimManagement.waitingManyApprovals", {
                  count: remainingCount,
                })}
          </span>
        );
      }
      return wrap(
        <ActionButtons isCell justifyCenter items={[viewItem]} />,
        <span className="text-gray-400 text-sm italic">
          {t("claimManagement.waitingPreviousApprovals")}
        </span>
      );
    }

    return null;
  };

  // Helper function to get all supporting documents from items
  const getAllSupportingDocuments = (items) => {
    if (!items || !Array.isArray(items)) return [];
    return items
      .map((item) => item.supportingDocuments)
      .filter((doc) => doc && (doc.fileId || doc.file_id || doc._id));
  };

  // Component for rendering claim amount with currency awareness
  const ClaimAmountCell = ({ items }) => {
    if (!items || !Array.isArray(items) || items.length === 0) {
      return <span className="text-gray-500">-</span>;
    }

    const currencies = getUniqueCurrencies(items);

    // Single currency or no currency - show simple total
    if (currencies.length <= 1) {
      const total = calculateTotalClaimableAmount(items);
      return <span className="font-medium">{formatAmount(total)}</span>;
    }

    // Multiple currencies - show breakdown
    const currencyTotals = getCurrencyWiseTotals(items);

    return (
      <div className="space-y-1">
        {Object.entries(currencyTotals).map(([currency, amount], index) => (
          <div key={currency} className="text-xs">
            <span className="font-medium">{formatAmount(amount)}</span>
            <span className="text-gray-500 ml-1">{currency}</span>
          </div>
        ))}
      </div>
    );
  };

  useEffect(() => {
    const storedBusinesses = localStorage.getItem("businesses");
    if (storedBusinesses) {
      setBusinesses(JSON.parse(storedBusinesses));
    }
    fetchClaims();
  }, []);

  useEffect(() => {
    fetchClaims(currentPage, recordsPerPage);
  }, [tableSearchFilter]);

  useEffect(() => {
    if (companyFilter) {
      fetchClaimGroups();
    }
  }, [companyFilter]);

  useEffect(() => {
    if (companyFilter) {
      fetchClaimTypes();
    }
  }, [companyFilter, claimGroupFilter]);

  const fetchClaims = async (
    page = 1,
    limit = recordsPerPage,
    searchOverride
  ) => {
    try {
      setClaimsLoading(true);
      console.log("date range filter", dateRangeFilter);
      const searchParam =
        searchOverride !== undefined && searchOverride !== null
          ? searchOverride || undefined
          : tableSearchFilter || undefined;
      const res = await request.get(`${Base_URL}/claims/role-base`, {
        params: {
          page,
          limit,
          empName: nameIdFilter || undefined,
          empCode: nameIdFilter || undefined,
          claimReference: claimReference || undefined,
          // claimAmount: amountFilter || undefined,
          currency: currencyFilter || undefined,
          claimGroup: claimGroupFilter || undefined,
          claimType: claimTypeFilter || undefined,
          company: companyFilter || undefined,
          status: statusFilter || undefined,
          dateRange: dateRangeFilter || undefined,
          search: searchParam,
        },
      });
      setClaims(res.data);
      setFilteredClaims(res.data);
      setTotalResults(res.total);
      setTotalPages(res.pagination.totalPages);
      setStats(res.stats);
      setClaimsLoading(false);
    } catch (error) {
      console.error("Error fetching claims", error);
      setClaimsLoading(false);
    }
  };

  useEffect(() => {
    if (skipClaimStructuralFilterEffect.current) {
      skipClaimStructuralFilterEffect.current = false;
      return;
    }
    const id = setTimeout(() => {
      setCurrentPage(1);
      currentPageRef.current = 1;
      fetchClaims(1, recordsPerPage);
    }, 350);
    return () => clearTimeout(id);
  }, [
    companyFilter,
    nameIdFilter,
    claimReference,
    claimGroupFilter,
    claimTypeFilter,
    currencyFilter,
    statusFilter,
    dateRangeFilter.startDate,
    dateRangeFilter.endDate,
  ]);

  const fetchAllClaimsForExport = async () => {
    try {
      const res = await request.get(`${Base_URL}/claims/role-base`, {
        params: {
          page: 1,
          limit: 10000, // Large limit to get all filtered results
          empName: nameIdFilter || undefined,
          empCode: nameIdFilter || undefined,
          claimReference: claimReference || undefined,
          currency: currencyFilter || undefined,
          claimGroup: claimGroupFilter || undefined,
          claimType: claimTypeFilter || undefined,
          company: companyFilter || undefined,
          status: statusFilter || undefined,
          dateRange: dateRangeFilter || undefined,
          search: tableSearchFilter || undefined,
        },
      });
      return res.data; // Return the filtered data
    } catch (error) {
      console.error("Error fetching all claims for export:", error);
      return [];
    }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    currentPageRef.current = page;
    fetchClaims(page, recordsPerPage);
  };

  const handleRecordsPerPageChange = (perPage) => {
    setRecordsPerPage(perPage);
    setCurrentPage(1);
    currentPageRef.current = 1;
    fetchClaims(1, perPage);
  };

  const resetFilters = () => {
    setNameIdFilter("");
    setClaimReference("");
    setClaimGroupFilter("");
    setClaimTypeFilter("");
    setCurrencyFilter("");
    setCompanyFilter("");
    setStatusFilter("");
    setDateRangeFilter({ startDate: "", endDate: "" });
    setSearchInput("");
    setCurrentPage(1);
    currentPageRef.current = 1;
  };

  const HandleOpenFile = async (documentId) => {
    console.log("document_id", documentId);
    try {
      const Response = await axios.get(
        `${Base_URL}/documents/getFileWithAllData/${documentId}`
      );
      console.log("document_id Response", Response);
      window.open(Response.data.data.url, "_blank");
    } catch (error) {
      console.error("Error getting file", error);
    }
  };

  // Approval and Rejection handlers
  const handleApproveClick = (claimId) => {
    console.log("claim id", claimId);
    setCurrentClaimId(claimId);
    setShowApproveModal(true);
  };

  const handleRejectClick = (claimId) => {
    console.log("claim id", claimId);
    setCurrentClaimId(claimId);
    setRejectReason("");
    setShowRejectModal(true);
  };

  const handleApproveConfirm = async () => {
    setIsSubmitting(true);
    try {
      await updateClaimStatus(currentClaimId, "Approved");
      setShowApproveModal(false);
      notifySuccess("Claim approved successfully.");
      await fetchClaims(currentPageRef.current, recordsPerPage);
    } catch (error) {
      console.error("Error approving claim:", error);
      notifyError(
        error?.response?.data?.message ||
          "Failed to approve claim. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectConfirm = async () => {
    setIsSubmitting(true);
    try {
      await updateClaimStatus(currentClaimId, "Rejected", rejectReason);
      setShowRejectModal(false);
      setRejectReason("");
      notifySuccess("Claim rejected.");
      await fetchClaims(currentPageRef.current, recordsPerPage);
    } catch (error) {
      console.error("Error rejecting claim:", error);
      notifyError(
        error?.response?.data?.message ||
          "Failed to reject claim. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateClaimStatus = async (claimId, status, remarks = "") => {
    try {
      const response = await axios.put(
        `${Base_URL}/claims/${claimId}/status`,
        { status, remarks },
        {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${
              JSON.parse(localStorage.getItem("adminInfo")).token
            }`,
          },
        }
      );
      console.log("Claim status updated:", response.data);
      return response.data;
    } catch (error) {
      console.error("Error updating claim status:", error);
      throw error;
    }
  };

  const downloadExcel = async () => {
    try {
      const exportClaims = await fetchAllClaimsForExport();
      const headers = [
        "Claim #",
        "Item #",
        "Claim Reference",
        "Employee",
        "Emp Code",
        "Company",
        "Status",
        "Receipt Date",
        "Claim Type",
        "Receipt No",
        "Receipt Amount",
        "Claimable Amount",
        "Currency",
        "Purpose",
        "Remarks",
      ];
      const exportData = [];

      exportClaims.forEach((claim, claimIndex) => {
        // Claim header row with numbering
        exportData.push({
          "Claim #": claimIndex + 1,
          "Item #": "",
          "Claim Reference": claim.claimReference || "",
          Employee: claim.employee?.displayName || "",
          "Emp Code": claim.employeeCode || "",
          Company: claim.company?.name || "",
          Status: claim.status || "",
          "Receipt Date": "",
          "Claim Type": "",
          "Receipt No": "",
          "Receipt Amount": "",
          "Claimable Amount": "",
          Currency: "",
          Purpose: "",
          Remarks: "",
        });

        // Item rows with numbering
        if (Array.isArray(claim.items) && claim.items.length > 0) {
          claim.items.forEach((item, itemIndex) => {
            exportData.push({
              "Claim #": "",
              "Item #": itemIndex + 1,
              "Claim Reference": "",
              Employee: "",
              "Emp Code": "",
              Company: "",
              Status: "",
              "Receipt Date": item.receiptDate
                ? formatDate(item.receiptDate.split("T")[0])
                : "",
              "Claim Type": item.claimType?.name || "",
              "Receipt No": item.receiptNo || "",
              "Receipt Amount": item.receiptAmount ?? "",
              "Claimable Amount": item.claimableAmount ?? "",
              Currency: item.currency?.symbol || item.currency?.name || "",
              Purpose: item.purpose || "",
              Remarks: item.remarks || "",
            });
          });
        }
      });

      const workbook = XLSX.utils.book_new();
      // Prepend title and generated-on rows to align with PDF
      const worksheet = XLSX.utils.aoa_to_sheet([
        ["Claims Report"],
        ["Generated on:", formatDate(new Date())],
        [],
      ]);
      XLSX.utils.sheet_add_json(worksheet, exportData, {
        header: headers,
        origin: -1,
      });
      // Improve readability: set reasonable column widths
      worksheet["!cols"] = headers.map((h) => ({
        wch: Math.max(14, String(h).length + 2),
      }));
      XLSX.utils.book_append_sheet(workbook, worksheet, "Claims");

      const filterInfo = [];
      if (companyFilter) filterInfo.push("Company");
      if (statusFilter) filterInfo.push("Status");
      if (nameIdFilter) filterInfo.push("Employee");
      if (claimGroupFilter) filterInfo.push("Group");
      if (claimTypeFilter) filterInfo.push("Type");
      if (currencyFilter) filterInfo.push("Currency");
      if (dateRangeFilter.startDate || dateRangeFilter.endDate)
        filterInfo.push("DateRange");

      const filename =
        filterInfo.length > 0
          ? `Filtered_Claims_Report_${filterInfo.join("_")}.xlsx`
          : "All_Claims_Report.xlsx";

      XLSX.writeFile(workbook, filename);
    } catch (error) {
      console.error("Error downloading Excel:", error);
      alert("Error downloading Excel file. Please try again.");
    }
  };

  const downloadPDF = async () => {
    try {
      const allClaims = await fetchAllClaimsForExport();
      const doc = new jsPDF();

      doc.setFontSize(16);
      doc.text("Claims Report", 14, 15);

      doc.setFontSize(10);
      doc.text(`Generated on: ${formatDate(new Date())}`, 14, 22);

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const marginX = 14;
      const marginY = 14;
      const contentWidth = pageWidth - marginX * 2;
      let y = 30;

      const ensureSpace = (needed = 20) => {
        if (y + needed > pageHeight - marginY) {
          doc.addPage();
          y = marginY;
        }
      };

      const drawKeyValue = (label, value, x, labelWidth, valueWidth) => {
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text(label, x, y);
        doc.setTextColor(0);
        const text = value == null || value === "" ? "-" : String(value);
        const wrapped = doc.splitTextToSize(text, valueWidth);
        doc.text(wrapped, x + labelWidth, y);
        const lineHeight = 4.5;
        const height = Math.max(lineHeight, wrapped.length * lineHeight);
        return height;
      };

      allClaims.forEach((claim, claimIndex) => {
        // Header bar (high contrast)
        ensureSpace(20);
        doc.setFillColor(173, 208, 57);
        doc.rect(marginX, y, contentWidth, 9, "F");
        doc.setTextColor(0);
        doc.setFontSize(10);
        doc.text(
          `${claimIndex + 1}. Claim Ref: ${claim.claimReference || ""}`,
          marginX + 4,
          y + 6
        );
        const statusText = `Status: ${claim.status || ""}`;
        const statusWidth = doc.getTextWidth(statusText);
        doc.text(statusText, marginX + contentWidth - statusWidth - 4, y + 6);
        y += 13;

        // Two-column claim details
        const half = contentWidth / 2;
        const col1X = marginX + 4;
        const col2X = marginX + half + 4;
        const labelW = 28;
        const valW = half - labelW - 8;

        let h1 = drawKeyValue(
          "Employee",
          claim.employee?.displayName || "",
          col1X,
          labelW,
          valW
        );
        let h2 = drawKeyValue(
          "Company",
          claim.company?.name || "",
          col2X,
          labelW,
          valW
        );
        y += Math.max(h1, h2) + 2;

        h1 = drawKeyValue(
          "Emp Code",
          claim.employeeCode || "",
          col1X,
          labelW,
          valW
        );
        h2 = drawKeyValue(
          "Claim Group",
          claim.claimGroup?.name || "",
          col2X,
          labelW,
          valW
        );
        y += Math.max(h1, h2) + 6;

        // Items section title
        ensureSpace(10);
        doc.setDrawColor(200);
        doc.line(marginX, y, marginX + contentWidth, y);
        y += 5;
        doc.setFontSize(10);
        doc.setTextColor(0);
        doc.text("Items", marginX, y);
        y += 4;

        const items = Array.isArray(claim.items) ? claim.items : [];
        if (items.length === 0) {
          ensureSpace(8);
          doc.setFontSize(9);
          doc.setTextColor(120);
          doc.text("- No items -", marginX + 4, y + 4);
          y += 10;
        } else {
          items.forEach((item, itemIndex) => {
            ensureSpace(32);
            doc.setFontSize(9);
            doc.setTextColor(0);
            const headerLeft = `#${itemIndex + 1} ${
              item.claimType?.name || ""
            }`;
            const dateText = item.receiptDate
              ? formatDate(item.receiptDate.split("T")[0])
              : "";
            const dateWidth = doc.getTextWidth(dateText);
            doc.text(headerLeft, marginX + 4, y + 2);
            if (dateText)
              doc.text(dateText, marginX + contentWidth - dateWidth - 4, y + 4);
            y += 6;

            // Row: Receipt No / Currency
            let r1 = drawKeyValue(
              "Receipt No",
              item.receiptNo || "",
              marginX + 4,
              28,
              contentWidth / 2 - 40
            );
            let r2 = drawKeyValue(
              "Currency",
              item.currency?.symbol || item.currency?.name || "",
              marginX + contentWidth / 2 + 4,
              28,
              contentWidth / 2 - 40
            );
            y += Math.max(r1, r2) + 2;

            // Row: Receipt Amount / Claimable Amount
            r1 = drawKeyValue(
              "Receipt Amount",
              item.receiptAmount != null
                ? formatAmount(item.receiptAmount)
                : "",
              marginX + 4,
              28,
              contentWidth / 2 - 40
            );
            r2 = drawKeyValue(
              "Claimable Amount",
              item.claimableAmount != null
                ? formatAmount(item.claimableAmount)
                : "",
              marginX + contentWidth / 2 + 4,
              28,
              contentWidth / 2 - 40
            );
            y += Math.max(r1, r2) + 2;

            // Purpose
            const purposeWrapped = doc.splitTextToSize(
              item.purpose || "-",
              contentWidth - 28 - 8
            );
            doc.setFontSize(8);
            doc.setTextColor(100);
            doc.text("Purpose", marginX + 4, y);
            doc.setTextColor(0);
            doc.text(purposeWrapped, marginX + 4 + 28, y);
            y += Math.max(4.5, purposeWrapped.length * 4.5) + 2;

            // Remarks
            const remarksWrapped = doc.splitTextToSize(
              item.remarks || "-",
              contentWidth - 28 - 8
            );
            doc.setFontSize(8);
            doc.setTextColor(100);
            doc.text("Remarks", marginX + 4, y);
            doc.setTextColor(0);
            doc.text(remarksWrapped, marginX + 4 + 28, y);
            y += Math.max(4.5, remarksWrapped.length * 4.5) + 6;

            // Separator
            doc.setDrawColor(235);
            doc.line(marginX, y, marginX + contentWidth, y);
            y += 6;
          });
        }

        // space after claim
        y += 6;
      });

      const filterInfo = [];
      if (companyFilter) filterInfo.push("Company");
      if (statusFilter) filterInfo.push("Status");
      if (nameIdFilter) filterInfo.push("Employee");
      if (claimGroupFilter) filterInfo.push("Group");
      if (claimTypeFilter) filterInfo.push("Type");
      if (currencyFilter) filterInfo.push("Currency");
      if (dateRangeFilter.startDate || dateRangeFilter.endDate)
        filterInfo.push("DateRange");

      const filename =
        filterInfo.length > 0
          ? `Filtered_Claims_Report_${filterInfo.join("_")}.pdf`
          : "All_Claims_Report.pdf";

      doc.save(filename);
    } catch (error) {
      console.error("Error downloading PDF:", error);
      alert("Error downloading PDF file. Please try again.");
    }
  };

  const portalFilters = [
    {
      key: "company",
      placeholder: t("claimManagement.searchByCompany"),
      options: [
        { value: "", label: t("claimManagement.searchByCompany") },
        ...businesses.map((b) => ({
          value: b._id,
          label: b.name,
        })),
      ],
    },
    {
      key: "claimGroup",
      placeholder: t("claimManagement.selectClaimGroup"),
      options: [
        { value: "", label: t("claimManagement.selectClaimGroup") },
        ...(claimGroups?.map((item) => ({
          value: item._id,
          label: item.name,
        })) || []),
      ],
    },
    {
      key: "claimType",
      placeholder: t("claimManagement.selectClaimType"),
      options: [
        { value: "", label: t("claimManagement.selectClaimType") },
        ...(claimTypes?.map((item) => ({
          value: item._id,
          label: item.type,
        })) || []),
      ],
    },
    {
      key: "status",
      placeholder: t("claimManagement.searchByClaimStatus"),
      options: [
        { value: "", label: t("claimManagement.searchByClaimStatus") },
        { value: "approved", label: "Approved" },
        { value: "rejected", label: "Rejected" },
        { value: "pending", label: "Pending" },
      ],
    },
  ];

  const portalFilterValues = {
    company: companyFilter || "",
    claimGroup: claimGroupFilter || "",
    claimType: claimTypeFilter || "",
    status: statusFilter || "",
  };

  const handlePortalFilterChange = (key, value) => {
    const next = value || "";
    if (key === "company") {
      setCompanyFilter(next);
      setClaimGroupFilter("");
      setClaimTypeFilter("");
      return;
    }
    if (key === "claimGroup") {
      setClaimGroupFilter(next);
      setClaimTypeFilter("");
      return;
    }
    if (key === "claimType") {
      setClaimTypeFilter(next);
      return;
    }
    if (key === "status") {
      setStatusFilter(next);
    }
  };

  const columns = useMemo(
    () => [
      {
        key: "employee",
        header: t("claimManagement.empName"),
        render: (claim) => (
          <span className="epc-cell__primary">
            {claim.employee?.displayName || "—"}
          </span>
        ),
      },
      {
        key: "items",
        header: t("claimManagement.itemsCount"),
        render: (claim) => (
          <span className="epc-chip">
            {claim.items?.length || 0} items
          </span>
        ),
      },
      {
        key: "amount",
        header: t("claimManagement.claimAmount"),
        render: (claim) => <ClaimAmountCell items={claim.items} />,
      },
      {
        key: "currencies",
        header: t("claimManagement.currencies"),
        render: (claim) => (
          <div className="flex flex-wrap gap-1">
            {getUniqueCurrencies(claim.items).map((currency, index) => (
              <span
                key={index}
                className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs font-medium"
              >
                {currency}
              </span>
            ))}
          </div>
        ),
      },
      {
        key: "company",
        header: t("claimManagement.company"),
        render: (claim) => claim.company?.name || "—",
      },
      {
        key: "status",
        header: t("claimManagement.status"),
        render: (claim) => renderClaimStatusCell(claim),
      },
      {
        key: "documents",
        header: t("claimManagement.documents"),
        render: (claim) => {
          const documents = getAllSupportingDocuments(claim.items);
          if (documents.length === 0) return "—";
          if (documents.length === 1) {
            const d0 = documents[0];
            const fid = d0.fileId || d0.file_id || d0._id;
            return (
              <button
                type="button"
                onClick={() => HandleOpenFile(fid)}
                className="epc-cell__link"
              >
                {d0.name || "Document"}
              </button>
            );
          }
          return (
            <div className="flex flex-col gap-1">
              {documents.slice(0, 2).map((doc, index) => {
                const fid = doc.fileId || doc.file_id || doc._id;
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => HandleOpenFile(fid)}
                    className="epc-cell__link text-left"
                  >
                    {doc.name || "Document"}
                  </button>
                );
              })}
              {documents.length > 2 && (
                <span className="epc-cell__secondary">
                  +{documents.length - 2} more
                </span>
              )}
            </div>
          );
        },
      },
      {
        key: "actions",
        header: t("claimManagement.action"),
        align: "right",
        render: (claim) => getClaimActionButtons(claim),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t]
  );

  return (
    <EpcPage
      flush
      title={t("claimManagement.claim")}
      subtitle={t("claimManagement.pageDescription")}
      action={
        hasPermission("Add") ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={downloadExcel}>
              <img
                src={csv || "/placeholder.svg"}
                alt=""
                className="w-4 h-4 object-contain"
              />
              {t("claimManagement.downloadExcel")}
            </Button>
            <Button variant="secondary" onClick={downloadPDF}>
              <img
                src={pdf || "/placeholder.svg"}
                alt=""
                className="w-4 h-4 object-contain"
              />
              {t("claimManagement.downloadPDF")}
            </Button>
            <Button onClick={() => history.push("/new-claim")}>
              <PlusIcon size={15} />
              {t("claimManagement.applyClaimOnBehalf")}
            </Button>
          </div>
        ) : null
      }
    >
      <div className="epc-stack">
        <HrListStatsSummaryCards
          stats={stats}
          labels={{
            total: t("claimManagement.totalClaims"),
            approved: t("claimManagement.approvedClaims"),
            pending: t("claimManagement.pendingClaims"),
            rejected: t("claimManagement.rejectedClaims"),
          }}
        />

        <FilterBar
          subtitle={t("claimManagement.search")}
          searchPlaceholder={t("claimManagement.search")}
          searchValue={searchInput}
          onSearchChange={(value) => setSearchInput(value)}
          filters={portalFilters}
          values={portalFilterValues}
          onChange={handlePortalFilterChange}
          onReset={resetFilters}
        />

        <div className="flex flex-wrap gap-3 items-end">
          <div className="min-w-[180px]">
            <label className="block text-xs text-gray-500 mb-1">
              {t("claimManagement.searchByNameId")}
            </label>
            <input
              type="text"
              value={nameIdFilter}
              onChange={(e) => setNameIdFilter(e.target.value)}
              placeholder={t("claimManagement.searchByNameId")}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div className="min-w-[180px]">
            <label className="block text-xs text-gray-500 mb-1">
              {t("claimManagement.searchByClaimReference")}
            </label>
            <input
              type="text"
              value={claimReference}
              onChange={(e) => setClaimReference(e.target.value)}
              placeholder={t("claimManagement.searchByClaimReference")}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div className="min-w-[200px]">
            <CurrencyDropdown
              businessId={companyFilter}
              value={currencyFilter}
              onChange={(currencyData) => {
                setCurrencyFilter(currencyData?.value || "");
              }}
              placeholder={t("claimManagement.selectCurrency")}
            />
          </div>
          <div className="min-w-[240px]">
            <FormInput
              type="date-range"
              initialStartDate={dateRangeFilter.startDate}
              initialEndDate={dateRangeFilter.endDate}
              onChange={(value) => {
                setDateRangeFilter((prev) => ({
                  ...prev,
                  startDate: value.startDate,
                  endDate: value.endDate,
                }));
              }}
              marginLeft="-44px"
              width="100%"
            />
          </div>
        </div>

        <Card>
          <CardHeader
            title={t("claimManagement.claim")}
            subtitle={
              claimsLoading
                ? "Loading…"
                : `${totalResults} total claims`
            }
          />

          <PortalDataTable
            columns={columns}
            rows={claimsLoading ? [] : filteredClaims}
            rowKey="_id"
            emptyMessage={
              claimsLoading
                ? "Loading…"
                : t("No data available") || "No claims found."
            }
          />

          {!claimsLoading && totalResults > 0 ? (
            <Pagination
              page={currentPage}
              pageSize={recordsPerPage}
              total={totalResults}
              itemLabel="claims"
              onPageChange={handlePageChange}
              onPageSizeChange={handleRecordsPerPageChange}
            />
          ) : null}
        </Card>
      </div>

      {/* Approval Modal */}
      {showApproveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Claim approval</h2>
              <button
                type="button"
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
              Are you sure you want to approve this claim?
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
            <button
              type="button"
              onClick={handleApproveConfirm}
              disabled={isSubmitting}
              className="w-full bg-[var(--p-blue)] hover:bg-[#9FBF29] text-white py-3 px-4 rounded-md transition duration-200"
            >
              {isSubmitting ? "Processing..." : "Approve"}
            </button>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Claim rejection</h2>
              <button
                type="button"
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
              Please add the reason below to reject the claim.
            </p>
            <div className="mb-6">
              <label className="block text-gray-700 mb-2">
                Reason (Optional)
              </label>
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
                disabled={isSubmitting}
                className={`w-full bg-red-500 hover:bg-red-600 text-white py-3 px-4 rounded-md transition duration-200 ${
                  isSubmitting ? "opacity-60 cursor-not-allowed" : ""
                }`}
              >
                {isSubmitting ? "Processing..." : "Reject Claim Request"}
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

      <CustomModal
        open={showClaimApprovalLevelsModal && !!currentClaimForLevels}
        title="Approval levels"
        onClose={() => {
          setShowClaimApprovalLevelsModal(false);
          setCurrentClaimForLevels(null);
        }}
        width="700px"
        showActions={false}
        actions={[
          {
            label: "Close",
            secondary: true,
            onClick: () => {
              setShowClaimApprovalLevelsModal(false);
              setCurrentClaimForLevels(null);
            },
          },
        ]}
      >
        {currentClaimForLevels &&
          renderClaimApprovalsDetail(currentClaimForLevels)}
      </CustomModal>
    </EpcPage>
  );
};

export default ClaimsDashboard;
