import React, {
  useState,
  useEffect,
  useContext,
  useMemo,
  useCallback,
} from "react";
import { useHistory } from "react-router-dom";
import {
  ActionButtons,
  CustomModal,
  DropdownBasic,
  SummaryCards,
} from "@/page-layouts";
import { EpcPage } from "@/components/Epc/EpcSurface";
import FilterBar from "@/customer/components/ui/FilterBar";
import { Card, CardHeader } from "@/customer/components/ui/Card";
import PortalDataTable from "@/customer/components/ui/DataTable";
import Pagination from "@/customer/components/ui/Pagination";
import Button from "@/customer/components/ui/Button";
import StatusPill from "@/customer/components/ui/StatusPill";
import { PlusIcon } from "@/customer/components/ui/icons";
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

  const underReviewCount = stats["Under Review"] || 0;
  const actionRequiredCount =
    (stats["Action Required"] || 0) + (stats.Rejected || 0);

  const buildActionItems = useCallback(
    (row) => [
      {
        action: ACTION_BUTTON_TYPES.VIEW,
        title: "View",
        onClick: () => history.push(`/applications/view/${row._id}`),
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
              onClick: () => downloadContractReviewNotification(row),
            },
          ]
        : []),
      ...(row.canEdit ||
      ["Draft", "Action Required", "Rejected"].includes(row.status)
        ? [
            {
              action: ACTION_BUTTON_TYPES.EDIT,
              title:
                row.status === "Draft"
                  ? "Complete draft"
                  : "Edit / resubmit",
              onClick: () =>
                history.push(`/applications/${row.type}/new`, {
                  applicationId: row._id,
                  customerId: row.customerId
                    ? String(row.customerId)
                    : undefined,
                  businessId: row.business_id
                    ? String(row.business_id)
                    : undefined,
                  customerLabel:
                    row.companyName || row.customerName || "",
                }),
            },
          ]
        : []),
      ...(routePerms.canUpdate && ASSIGNABLE_STATUSES.includes(row.status)
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
      ...(routePerms.canUpdate && REVIEWABLE_STATUSES.includes(row.status)
        ? [
            {
              action: ACTION_BUTTON_TYPES.APPROVE,
              title: "Approve",
              onClick: () => handleStatusChange(row, "Approved"),
            },
            {
              action: ACTION_BUTTON_TYPES.REQUEST_MODIFICATION,
              title: "Request Modification",
              description:
                "Not a rejection — customer edits and resubmits the same application",
              onClick: () => handleStatusChange(row, "Action Required"),
            },
            {
              action: ACTION_BUTTON_TYPES.REJECT,
              title: "Reject",
              onClick: () => handleStatusChange(row, "Rejected"),
            },
          ]
        : []),
      ...(routePerms.canDelete && (row.canDelete || row.status === "Draft")
        ? [
            {
              action: ACTION_BUTTON_TYPES.DELETE,
              title: "Delete",
              onClick: () => openDeleteModal(row),
            },
          ]
        : []),
    ],
    [
      history,
      routePerms.canUpdate,
      routePerms.canDelete,
      downloadingNotificationId,
      handleStatusChange,
    ],
  );

  const columns = useMemo(
    () => [
      {
        key: "reference",
        header: "Reference",
        width: "14%",
        render: (row) =>
          routePerms.canViewDetails && row._id ? (
            <button
              type="button"
              className="epc-cell__link"
              title={row.applicationNumber || ""}
              onClick={() => history.push(`/applications/view/${row._id}`)}
            >
              {row.applicationNumber || "—"}
            </button>
          ) : (
            row.applicationNumber || "—"
          ),
      },
      {
        key: "customer",
        header: "Customer / Company",
        width: "16%",
        render: (row) => (
          <>
            <div className="epc-cell__primary">{row.companyName || "—"}</div>
            {(row.commercialStage || row.stage) && (
              <div className="epc-cell__secondary">
                {row.commercialStage || row.stage}
              </div>
            )}
          </>
        ),
      },
      {
        key: "service",
        header: "Service",
        width: "14%",
        render: (row) => (
          <>
            <div className="epc-cell__primary">{row.service || "—"}</div>
            {(row.certificationType ||
              (row.type === "inspection" ? "Inspection application" : "")) && (
              <div className="epc-cell__secondary">
                {row.certificationType || "Inspection application"}
              </div>
            )}
          </>
        ),
      },
      {
        key: "summary",
        header: "Summary",
        width: "18%",
        render: (row) => (
          <>
            <div className="epc-cell__primary">
              {row.summary ||
                row.purpose ||
                row.productName ||
                row.projectName ||
                "—"}
            </div>
            {row.standardNumber ? (
              <div className="epc-cell__secondary">
                Std: {row.standardNumber}
                {row.standardTitle ? ` — ${row.standardTitle}` : ""}
              </div>
            ) : null}
            {row.type ? (
              <div className="epc-cell__secondary capitalize">{row.type}</div>
            ) : null}
          </>
        ),
      },
      {
        key: "status",
        header: "Status",
        width: "12%",
        render: (row) => <StatusPill status={row.status || "—"} />,
      },
      {
        key: "submitted",
        header: "Submitted",
        width: "10%",
        render: (row) => formatDate(row.submittedAt || row.createdAt),
      },
      {
        key: "actions",
        header: "Actions",
        width: "10%",
        align: "right",
        render: (row) => (
          <ActionButtons maxVisibleActions={2} items={buildActionItems(row)} />
        ),
      },
    ],
    [buildActionItems, history, routePerms.canViewDetails],
  );

  const portalFilterValues = {
    status: statusFilter === "all" ? "" : statusFilter,
    type: typeFilter === "all" ? "" : typeFilter,
    service: serviceFilter === "all" ? "" : serviceFilter,
    business: businessFilter || "",
  };

  const portalFilters = [
    ...(!isSingleAssignedBusiness()
      ? [
          {
            key: "business",
            placeholder: "All Businesses",
            options: [
              { value: "", label: "All Businesses" },
              ...businesses.map((b) => ({ value: b._id, label: b.name })),
            ],
          },
        ]
      : []),
    {
      key: "status",
      placeholder: "All Statuses",
      options: [
        { value: "", label: "All Statuses" },
        ...APPLICATION_STATUS_OPTIONS.map((s) => ({ value: s, label: s })),
      ],
    },
    {
      key: "type",
      placeholder: "All Types",
      options: [
        { value: "", label: "All Types" },
        { value: "certification", label: "Conformity Assessment" },
      ],
    },
    {
      key: "service",
      placeholder: "All Schemes",
      options: [
        { value: "", label: "All Schemes" },
        ...APPLICATION_SERVICE_OPTIONS.map((s) => ({ value: s, label: s })),
      ],
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

  const handlePortalFilterChange = (key, value) => {
    if (key === "status") {
      setStatusFilter(value || "all");
      setCurrentPage(1);
      return;
    }
    if (key === "type") {
      setTypeFilter(value || "all");
      setCurrentPage(1);
      return;
    }
    if (key === "service") {
      setServiceFilter(value || "all");
      setCurrentPage(1);
      return;
    }
    if (key === "business") {
      setBusinessFilter(value || "");
      setCurrentPage(1);
    }
  };

  return (
    <EpcPage
      flush
      title="Applications"
      subtitle="Review and manage customer certification and inspection applications."
      action={
        routePerms.canAdd ? (
          <Button onClick={() => history.push("/applications/new")}>
            <PlusIcon size={15} />
            Create Application
          </Button>
        ) : null
      }
    >
      <SummaryCards
        cards={summaryCardsData}
        columnsCount={4}
        loading={loading && rows.length === 0}
      />

      <FilterBar
        subtitle="Narrow the list by reference, customer, status, type or scheme."
        searchPlaceholder="Search by reference, customer or summary…"
        searchValue={searchTerm}
        onSearchChange={(value) => {
          setSearchTerm(value);
          setCurrentPage(1);
        }}
        values={portalFilterValues}
        onChange={handlePortalFilterChange}
        onReset={clearAllFilters}
        filters={portalFilters}
      />

      <Card>
        <CardHeader
          title="Applications"
          subtitle={
            loading ? "Loading…" : `${total} total applications`
          }
          action={
            <span className="epc-chip">
              {underReviewCount} under review · {actionRequiredCount} need action
            </span>
          }
        />

        <PortalDataTable
          columns={columns}
          rows={loading ? [] : rows}
          rowKey="_id"
          emptyMessage={
            loading
              ? "Loading applications…"
              : "No applications match these filters."
          }
        />
        {!loading && total > 0 ? (
          <Pagination
            page={currentPage}
            pageSize={recordsPerPage}
            total={total}
            itemLabel="applications"
            onPageChange={setCurrentPage}
            onPageSizeChange={(perPage) => {
              setRecordsPerPage(perPage);
              setCurrentPage(1);
            }}
          />
        ) : null}
      </Card>

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
              <div>
                <StatusPill status={statusChangeRow.status || "—"} />
              </div>
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
    </EpcPage>
  );
};

export default Applications;
