import React, { useState, useEffect, useContext, useMemo } from "react";
import { useHistory } from "react-router-dom";
import { Building, FileText, Layers } from "lucide-react";
import {
  DataTable,
  ActionButtons,
  SummaryCards,
  CustomModal,
  DropdownBasic,
} from "@/page-layouts";
import { notifyError, notifySuccess } from "@/utils/toast";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";
import useCheckTokenExpired from "@/hooks/useCheckTokenExpired";
import { AdminContext } from "@/context/AdminContext";
import { useRouteModulePermissions } from "@/utils/permissionUtils";
import {
  isSingleAssignedBusiness,
  syncAssignedBusinessesFromApi,
} from "@/utils/sessionAssignedBusinesses";
import ApplicationServices, {
  APPLICATION_STATUS_OPTIONS,
  APPLICATION_SERVICE_OPTIONS,
} from "@/services/ApplicationServices";
import { useApplicationStatusChange } from "./useApplicationStatusChange";
import ApplicationHistoryModal from "./ApplicationHistoryModal";
import ApplicationAssignModal from "./ApplicationAssignModal";
import { currentWorkflowStage, applicationActionsPath } from "./workflowStages";
import { downloadAxiosBlob } from "@/utils/certificationFormData";
import SummarySvg from "@/assets/img/summary.svg";
import CompletedSvg from "@/assets/img/completed.svg";
import InProgressSvg from "@/assets/img/in-progress.svg";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const REVIEWABLE_STATUSES = ["Under Review", "Resubmitted", "Action Required"];
const ASSIGNABLE_STATUSES = [
  "Under Review",
  "Resubmitted",
  "Action Required",
  "Approved",
  "Scheduled",
  "In Progress",
  "Certified",
  "Completed",
];

const ISSUED_CONTRACT_REVIEW_STATUSES = ["Accepted", "Declined"];

const hasIssuedContractReviewLetter = (row) => {
  if (!row || row.type === "inspection") return false;
  const fromField = String(row.contractReviewStatus || "").trim();
  if (ISSUED_CONTRACT_REVIEW_STATUSES.includes(fromField)) return true;
  const stage = (row.workflow || []).find((s) => s.key === "contract_review");
  return ISSUED_CONTRACT_REVIEW_STATUSES.includes(stage?.status);
};

const STATUS_STYLES = {
  Draft: "bg-gray-100 text-gray-800",
  "Under Review": "bg-amber-100 text-amber-800",
  Resubmitted: "bg-orange-100 text-orange-800",
  Approved: "bg-teal-100 text-teal-800",
  Rejected: "bg-rose-100 text-rose-800",
  Scheduled: "bg-blue-100 text-blue-800",
  "In Progress": "bg-indigo-100 text-indigo-800",
  Certified: "bg-green-100 text-green-800",
  Completed: "bg-emerald-100 text-emerald-800",
  "Action Required": "bg-red-100 text-red-800",
};

const Applications = () => {
  const checkTokenExpired = useCheckTokenExpired();
  const history = useHistory();
  const { state } = useContext(AdminContext);
  const adminInfo =
    state?.adminInfo ||
    (localStorage.getItem("adminInfo")
      ? JSON.parse(localStorage.getItem("adminInfo"))
      : null);

  const routePerms = useRouteModulePermissions();
  const authHeaders = useMemo(
    () => ({
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo?.token}`,
    }),
    [adminInfo?.token],
  );

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [businessFilter, setBusinessFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [businesses, setBusinesses] = useState([]);
  const [stats, setStats] = useState({ total: 0 });
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [rowToDelete, setRowToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [historyRow, setHistoryRow] = useState(null);
  const [assignRow, setAssignRow] = useState(null);
  const [statusChangeRow, setStatusChangeRow] = useState(null);
  const [statusChangeValue, setStatusChangeValue] = useState("");
  const [downloadingNotificationId, setDownloadingNotificationId] =
    useState("");

  const headers = [
    "Reference",
    "Stage",
    "Customer / Company",
    "Type",
    "Purpose / Summary",
    "Status",
    "Submitted",
    "Actions",
  ];

  const colWidths = {
    Reference: "200px",
    Stage: "140px",
    "Customer / Company": "220px",
    Type: "160px",
    "Purpose / Summary": "220px",
    Status: "130px",
    Submitted: "110px",
    Actions: "160px",
  };

  // Shown only in the row expand panel (not in the main listing).
  const headersToHide = ["Stage", "Submitted"];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await syncAssignedBusinessesFromApi(Base_URL);
      if (cancelled) return;
      setBusinesses(list);
      if (list.length === 1) {
        setBusinessFilter(list[0]._id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchApplications = async () => {
    if (!adminInfo?.token || businesses.length === 0) {
      setLoading(false);
      setRows([]);
      setTotal(0);
      return;
    }

    try {
      setLoading(true);
      const params = {
        page: currentPage,
        limit: recordsPerPage,
        status: statusFilter !== "all" ? statusFilter : undefined,
        type: typeFilter !== "all" ? typeFilter : undefined,
        service: serviceFilter !== "all" ? serviceFilter : undefined,
        search: searchTerm || undefined,
      };

      if (businessFilter) {
        params.business_id = businessFilter;
      } else {
        params.business_ids = businesses.map((b) => b._id).join(",");
      }

      const response = await ApplicationServices.getAllApplications(params, {
        headers: authHeaders,
        withCredentials: true,
      });
      if (checkTokenExpired(response)) return;

      if (response.data?.status) {
        setRows(response.data.data || []);
        setTotal(response.data.total || 0);
        setTotalPages(response.data.totalPages || 1);
        if (response.data.stats) {
          setStats((prev) => ({ ...prev, ...response.data.stats }));
        }
      } else {
        notifyError(response.data?.message || "Failed to load applications");
      }
    } catch (error) {
      console.error("Error fetching applications:", error);
      notifyError(
        error?.response?.data?.message || "Failed to load applications",
      );
    } finally {
      setLoading(false);
    }
  };

  const {
    handleStatusChange,
    statusUpdatingId,
    statusModals,
  } = useApplicationStatusChange({
    authHeaders,
    checkTokenExpired,
    onSuccess: fetchApplications,
  });

  useEffect(() => {
    if (!adminInfo?.token || businesses.length === 0) return;
    fetchApplications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    businessFilter,
    adminInfo?.token,
    currentPage,
    statusFilter,
    typeFilter,
    serviceFilter,
    recordsPerPage,
    businesses.length,
  ]);

  useEffect(() => {
    if (!adminInfo?.token || businesses.length === 0) return;
    const timeoutId = setTimeout(() => {
      setCurrentPage(1);
      fetchApplications();
    }, 400);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  const formatDate = (dateString) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getStatusBadge = (status) => (
    <span
      className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
        STATUS_STYLES[status] || "bg-gray-100 text-gray-800"
      }`}
    >
      {status || "—"}
    </span>
  );

  const downloadContractReviewNotification = async (row) => {
    if (!row?._id || downloadingNotificationId) return;
    setDownloadingNotificationId(row._id);
    try {
      const res = await ApplicationServices.getApplicationFormPdf(
        row._id,
        "FOR-01-24",
        { headers: authHeaders, withCredentials: true },
      );
      downloadAxiosBlob(
        res,
        `Contract-Review-Notification-${
          row.applicationNumber || row._id
        }.pdf`,
      );
    } catch (error) {
      notifyError(
        error?.response?.data?.message ||
          "Failed to download the contract review notification.",
      );
    } finally {
      setDownloadingNotificationId("");
    }
  };

  const openStatusChangeModal = (row) => {
    setStatusChangeRow(row);
    setStatusChangeValue(row?.status || "Draft");
  };

  const closeStatusChangeModal = () => {
    if (statusUpdatingId) return;
    setStatusChangeRow(null);
    setStatusChangeValue("");
  };

  const confirmStatusChange = () => {
    if (!statusChangeRow) return;
    const next = statusChangeValue || statusChangeRow.status;
    if (next === (statusChangeRow.status || "Draft")) {
      closeStatusChangeModal();
      return;
    }
    const row = statusChangeRow;
    setStatusChangeRow(null);
    setStatusChangeValue("");
    handleStatusChange(row, next);
  };

  const openDeleteModal = (row) => {
    setRowToDelete(row);
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    if (deleteLoading) return;
    setDeleteModalOpen(false);
    setRowToDelete(null);
  };

  const confirmDelete = async () => {
    if (!rowToDelete?._id) return;
    try {
      setDeleteLoading(true);
      const response = await ApplicationServices.deleteApplication(
        rowToDelete._id,
        {
          headers: authHeaders,
          withCredentials: true,
        },
      );
      if (checkTokenExpired(response)) return;
      if (response.data?.status) {
        notifySuccess("Application deleted");
        closeDeleteModal();
        fetchApplications();
      } else {
        notifyError(response.data?.message || "Failed to delete application");
      }
    } catch (error) {
      notifyError(
        error?.response?.data?.message || "Failed to delete application",
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  const clearAllFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setTypeFilter("all");
    setServiceFilter("all");
    setBusinessFilter(businesses.length === 1 ? businesses[0]._id : "");
    setCurrentPage(1);
  };

  const filters = [
    {
      isClearButton: true,
      buttonProps: { onClick: clearAllFilters },
    },
    ...(!isSingleAssignedBusiness()
      ? [
          {
            label: "Business",
            value: businessFilter,
            onChange: (value) => {
              setBusinessFilter(value);
              setCurrentPage(1);
            },
            options: [
              ...(businesses.length > 1
                ? [{ value: "", label: "All Businesses" }]
                : []),
              ...businesses.map((b) => ({ value: b._id, label: b.name })),
            ],
            placeholder:
              businesses.length > 1 ? "All Businesses" : "Select Business",
            icon: Building,
          },
        ]
      : []),
    {
      label: "Status",
      value: statusFilter,
      onChange: (value) => {
        setStatusFilter(value);
        setCurrentPage(1);
      },
      options: [
        { value: "all", label: "All Statuses" },
        ...APPLICATION_STATUS_OPTIONS.map((s) => ({ value: s, label: s })),
      ],
      placeholder: "Select Status",
      icon: FileText,
    },
    {
      label: "Type",
      value: typeFilter,
      onChange: (value) => {
        setTypeFilter(value);
        setCurrentPage(1);
      },
      options: [
        { value: "all", label: "All Types" },
        { value: "certification", label: "Conformity Assessment" },
      ],
      placeholder: "Select Type",
      icon: Layers,
    },
    {
      label: "Scheme",
      value: serviceFilter,
      onChange: (value) => {
        setServiceFilter(value);
        setCurrentPage(1);
      },
      options: [
        { value: "all", label: "All Schemes" },
        ...APPLICATION_SERVICE_OPTIONS.map((s) => ({ value: s, label: s })),
      ],
      placeholder: "Select Scheme",
      icon: FileText,
    },
  ];

  const summaryCardsData = [
    {
      title: "Total Applications",
      value: stats.total || 0,
      backgroundColor: "summary-light",
      iconColor: "summary-dark",
      Icon: SummarySvg,
    },
    {
      title: "Under Review",
      value: stats["Under Review"] || 0,
      backgroundColor: "processing-light",
      iconColor: "processing-dark",
      Icon: InProgressSvg,
    },
    {
      title: "In Progress",
      value: stats["In Progress"] || 0,
      backgroundColor: "processing-light",
      iconColor: "processing-dark",
      Icon: InProgressSvg,
    },
    {
      title: "Certified / Completed",
      value: (stats.Certified || 0) + (stats.Completed || 0),
      backgroundColor: "completed-light",
      iconColor: "completed-dark",
      Icon: CompletedSvg,
    },
  ];

  return (
    <div className="bg-gray-50 min-h-screen w-full max-w-full overflow-x-hidden">
      <div className="w-full max-w-full mx-auto px-6 py-8 min-w-0 overflow-x-hidden">
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Applications</h1>
              <p className="text-gray-600 mt-2">
                Review and manage customer certification and inspection
                applications.
              </p>
            </div>
            {routePerms.canAdd ? (
              <button
                type="button"
                onClick={() => history.push("/applications/new")}
                className="flex items-center gap-2 px-6 py-3 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[var(--p-blue-dark)] transition-colors shadow-sm"
              >
                Create Application
              </button>
            ) : null}
          </div>
        </div>

        <SummaryCards cards={summaryCardsData} columnsCount={4} />

        <DataTable
          onSearch={(value) => {
            setSearchTerm(value);
            setCurrentPage(1);
          }}
          searchValue={searchTerm}
          searchPlaceholder="Search by text..."
          filters={filters}
          headers={headers}
          headersToHide={headersToHide}
          colWidths={colWidths}
          wideTable
          skipDynamicColumnWidths
          data={rows}
          totalRecords={total}
          loading={loading}
          currentPage={currentPage}
          totalPages={totalPages}
          recordsPerPage={recordsPerPage}
          onPageChange={setCurrentPage}
          onRecordsPerPageChange={(perPage) => {
            setRecordsPerPage(perPage);
            setCurrentPage(1);
          }}
          renderRow={(row) => (
            <tr key={row._id} className="border-b">
              <td className="py-2 px-4 whitespace-nowrap">
                {routePerms.canViewDetails && row._id ? (
                  <button
                    type="button"
                    className="text-[var(--p-blue)] hover:underline font-medium text-left whitespace-nowrap"
                    title={row.applicationNumber || ""}
                    onClick={() => history.push(`/applications/view/${row._id}`)}
                  >
                    {row.applicationNumber || "—"}
                  </button>
                ) : (
                  <span className="whitespace-nowrap">
                    {row.applicationNumber || "—"}
                  </span>
                )}
              </td>
              <td className="py-2 px-4 whitespace-nowrap text-sm">
                {row.commercialStage || row.stage || "—"}
              </td>
              <td className="py-2 px-4">
                <div className="font-medium text-gray-900">
                  {row.companyName || "—"}
                </div>
              </td>
              <td className="py-2 px-4 text-sm" title={row.service || ""}>
                <div className="font-medium text-gray-900">
                  {row.service || "—"}
                </div>
                {(row.certificationType ||
                  (row.type === "inspection"
                    ? "Inspection application"
                    : "")) && (
                  <div className="text-xs text-gray-500">
                    {row.certificationType || "Inspection application"}
                  </div>
                )}
              </td>
              <td className="py-2 px-4">
                <div
                  className="text-sm"
                  title={row.summary || row.purpose || ""}
                >
                  {row.summary ||
                    row.purpose ||
                    row.productName ||
                    row.projectName ||
                    "—"}
                </div>
                {row.standardNumber ? (
                  <div className="text-xs text-gray-500">
                    Std: {row.standardNumber}
                    {row.standardTitle ? ` — ${row.standardTitle}` : ""}
                  </div>
                ) : null}
                <div className="text-xs text-gray-500 capitalize">
                  {row.type || ""}
                </div>
              </td>
              <td className="py-2 px-4 whitespace-nowrap">
                {getStatusBadge(row.status)}
              </td>
              <td className="py-2 px-4 whitespace-nowrap">
                {formatDate(row.submittedAt || row.createdAt)}
              </td>
              <td className="py-2 px-4">
                <ActionButtons
                  maxVisibleActions={2}
                  items={[
                    {
                      action: ACTION_BUTTON_TYPES.VIEW,
                      title: "View",
                      onClick: () =>
                        history.push(`/applications/view/${row._id}`),
                    },
                    {
                      action: ACTION_BUTTON_TYPES.HISTORY,
                      title: "Activity log",
                      onClick: () => setHistoryRow(row),
                    },
                    ...(routePerms.canUpdate
                      ? [
                          {
                            action: ACTION_BUTTON_TYPES.CHANGE_STATUS,
                            title: "Change Status",
                            onClick: () => openStatusChangeModal(row),
                          },
                        ]
                      : []),
                    /* List menu: only the next unfinished stage, and only after
                       the application is submitted (not Draft). Completed ones
                       stay off this overflow — the view page shows all. */
                    ...(row.status !== "Draft"
                      ? [currentWorkflowStage(row.workflow)]
                          .filter(Boolean)
                          .map((stage) => ({
                            action: ACTION_BUTTON_TYPES.WORKFLOW,
                            title: stage.title,
                            description: [stage.documentCode, stage.status]
                              .filter(Boolean)
                              .join(" · "),
                            href: applicationActionsPath(row._id, stage.key),
                            target: "_blank",
                          }))
                      : []),
                    ...(hasIssuedContractReviewLetter(row)
                      ? [
                          {
                            action: ACTION_BUTTON_TYPES.DOWNLOAD,
                            title:
                              downloadingNotificationId === row._id
                                ? "Downloading…"
                                : "Download customer notification",
                            description: "AQCTA-FOR-01-24 · sent to the customer",
                            onClick: () =>
                              downloadContractReviewNotification(row),
                          },
                        ]
                      : []),
                    ...(row.canEdit ||
                    ["Draft", "Action Required", "Rejected"].includes(
                      row.status,
                    )
                      ? [
                          {
                            action: ACTION_BUTTON_TYPES.EDIT,
                            title:
                              row.status === "Draft"
                                ? "Complete draft"
                                : "Edit / resubmit",
                            onClick: () =>
                              history.push(
                                `/applications/${row.type}/new`,
                                {
                                  applicationId: row._id,
                                  customerId: row.customerId
                                    ? String(row.customerId)
                                    : undefined,
                                  businessId: row.business_id
                                    ? String(row.business_id)
                                    : undefined,
                                  customerLabel:
                                    row.companyName ||
                                    row.customerName ||
                                    "",
                                },
                              ),
                          },
                        ]
                      : []),
                    ...(routePerms.canUpdate &&
                    ASSIGNABLE_STATUSES.includes(row.status)
                      ? [
                          {
                            action: ACTION_BUTTON_TYPES.ASSIGN,
                            title: row.assignedTo
                              ? "Reassign System User"
                              : "Assign System User",
                            onClick: () => setAssignRow(row),
                          },
                        ]
                      : []),
                    ...(routePerms.canUpdate &&
                    REVIEWABLE_STATUSES.includes(row.status)
                      ? [
                          {
                            action: ACTION_BUTTON_TYPES.APPROVE,
                            title: "Approve",
                            onClick: () =>
                              handleStatusChange(row, "Approved"),
                          },
                          {
                            action: ACTION_BUTTON_TYPES.REQUEST_MODIFICATION,
                            title: "Request Modification",
                            description:
                              "Not a rejection — customer edits and resubmits the same application",
                            onClick: () =>
                              handleStatusChange(row, "Action Required"),
                          },
                          {
                            action: ACTION_BUTTON_TYPES.REJECT,
                            title: "Reject",
                            onClick: () =>
                              handleStatusChange(row, "Rejected"),
                          },
                        ]
                      : []),
                    ...(routePerms.canDelete &&
                    (row.canDelete || row.status === "Draft")
                      ? [
                          {
                            action: ACTION_BUTTON_TYPES.DELETE,
                            title: "Delete",
                            onClick: () => openDeleteModal(row),
                          },
                        ]
                      : []),
                  ]}
                />
              </td>
            </tr>
          )}
        />
      </div>

      {statusModals}

      <CustomModal
        open={Boolean(statusChangeRow)}
        onClose={closeStatusChangeModal}
        title="Change Status"
        width="440px"
        showActions
        actions={[
          {
            label: "Cancel",
            secondary: true,
            onClick: closeStatusChangeModal,
            disabled: Boolean(statusUpdatingId),
          },
          {
            label: statusUpdatingId ? "Updating..." : "Update Status",
            disabled:
              Boolean(statusUpdatingId) ||
              !statusChangeValue ||
              statusChangeValue === (statusChangeRow?.status || "Draft"),
            onClick: confirmStatusChange,
          },
        ]}
      >
        {statusChangeRow ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-700">
              Update status for{" "}
              <span className="font-semibold">
                {statusChangeRow.applicationNumber || "this application"}
              </span>
              .
            </p>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Current status
              </label>
              <div>{getStatusBadge(statusChangeRow.status)}</div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                New status
              </label>
              <DropdownBasic
                options={APPLICATION_STATUS_OPTIONS.map((s) => ({
                  value: s,
                  label: s,
                }))}
                value={statusChangeValue}
                onChange={setStatusChangeValue}
                placeholder="Select status"
                className="w-full"
                isDisabled={Boolean(statusUpdatingId)}
                isClearable={false}
                sortOptions={false}
              />
            </div>
          </div>
        ) : null}
      </CustomModal>

      <ApplicationHistoryModal
        open={Boolean(historyRow)}
        onClose={() => setHistoryRow(null)}
        application={historyRow}
      />

      <ApplicationAssignModal
        open={Boolean(assignRow)}
        onClose={() => setAssignRow(null)}
        application={assignRow}
        authHeaders={authHeaders}
        checkTokenExpired={checkTokenExpired}
        onSuccess={fetchApplications}
      />

      <CustomModal
        open={deleteModalOpen}
        onClose={closeDeleteModal}
        title="Delete Application"
        width="440px"
        showActions
        actions={[
          {
            label: "Cancel",
            secondary: true,
            onClick: closeDeleteModal,
            disabled: deleteLoading,
          },
          {
            label: deleteLoading ? "Deleting..." : "Delete",
            failure: true,
            disabled: deleteLoading,
            onClick: confirmDelete,
          },
        ]}
      >
        {rowToDelete && (
          <p className="text-sm text-gray-700">
            Are you sure you want to delete application{" "}
            <span className="font-semibold">
              {rowToDelete.applicationNumber || "—"}
            </span>
            ? This action cannot be undone.
          </p>
        )}
      </CustomModal>
    </div>
  );
};

export default Applications;
