import React, { useContext, useEffect, useMemo, useState } from "react";
import { useHistory } from "react-router-dom";
import { FileText } from "lucide-react";
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
import ProjectServices, {
  PROJECT_STATUS_OPTIONS,
} from "@/services/ProjectServices";
import { currentWorkflowStage } from "@/pages/Applications/workflowStages";
import ProjectHistoryModal from "./ProjectHistoryModal";
import SummarySvg from "@/assets/img/summary.svg";
import CompletedSvg from "@/assets/img/completed.svg";
import InProgressSvg from "@/assets/img/in-progress.svg";

const STATUS_STYLES = {
  Open: "bg-blue-100 text-blue-800",
  "In Progress": "bg-indigo-100 text-indigo-800",
  "On Hold": "bg-amber-100 text-amber-800",
  Completed: "bg-emerald-100 text-emerald-800",
  Cancelled: "bg-rose-100 text-rose-800",
};

const formatDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
};

const money = (value, currency = "MYR") =>
  `${currency === "MYR" ? "RM" : currency} ${Number(value || 0).toLocaleString(
    "en-MY",
    { minimumFractionDigits: 2, maximumFractionDigits: 2 },
  )}`;

/**
 * Operations → Projects
 *
 * A project opens when a customer accepts their quotation, and its audit is
 * run from here. An auditor sees only the jobs they were given.
 */
const Projects = () => {
  const history = useHistory();
  const { state } = useContext(AdminContext);
  const adminInfo =
    state?.adminInfo ||
    (localStorage.getItem("adminInfo")
      ? JSON.parse(localStorage.getItem("adminInfo"))
      : null);
  const checkTokenExpired = useCheckTokenExpired();
  const routePerms = useRouteModulePermissions();

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [scopedToMe, setScopedToMe] = useState(false);
  const [statusChangeRow, setStatusChangeRow] = useState(null);
  const [statusChangeValue, setStatusChangeValue] = useState("");
  const [statusUpdatingId, setStatusUpdatingId] = useState("");
  const [historyRow, setHistoryRow] = useState(null);

  const authHeaders = useMemo(
    () => ({
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo?.token}`,
    }),
    [adminInfo?.token],
  );

  const headers = [
    "Project",
    "Customer / Product",
    "Type",
    "Value",
    "Status",
    "Invoice",
    "Accepted",
    "Actions",
  ];

  const colWidths = {
    Project: "180px",
    "Customer / Product": "220px",
    Type: "160px",
    Value: "130px",
    Status: "130px",
    Invoice: "140px",
    Accepted: "140px",
    Actions: "160px",
  };

  const fetchProjects = async () => {
    if (!adminInfo?.token) {
      setLoading(false);
      setRows([]);
      setTotal(0);
      return;
    }

    try {
      setLoading(true);
      const response = await ProjectServices.getAllProjects(
        {
          page: currentPage,
          limit: recordsPerPage,
          search: searchTerm || undefined,
          status: statusFilter !== "all" ? statusFilter : undefined,
        },
        {
          headers: authHeaders,
          withCredentials: true,
        },
      );
      if (checkTokenExpired(response)) return;

      setRows(Array.isArray(response.data?.data) ? response.data.data : []);
      const metaTotal = response.data?.meta?.total || 0;
      setTotal(metaTotal);
      setTotalPages(
        Math.max(1, Math.ceil(metaTotal / (Number(recordsPerPage) || 10))),
      );
      setScopedToMe(Boolean(response.data?.meta?.scopedToMe));
    } catch (error) {
      notifyError(error?.response?.data?.message || "Failed to load projects");
      setRows([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!adminInfo?.token) return;
    fetchProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminInfo?.token, currentPage, statusFilter, recordsPerPage]);

  useEffect(() => {
    if (!adminInfo?.token) return;
    const timeoutId = setTimeout(() => {
      setCurrentPage(1);
      fetchProjects();
    }, 400);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  const getStatusBadge = (status) => (
    <span
      className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
        STATUS_STYLES[status] || "bg-gray-100 text-gray-800"
      }`}
    >
      {status || "—"}
    </span>
  );

  const openStatusChangeModal = (row) => {
    setStatusChangeRow(row);
    setStatusChangeValue(row?.status || "Open");
  };

  const closeStatusChangeModal = () => {
    if (statusUpdatingId) return;
    setStatusChangeRow(null);
    setStatusChangeValue("");
  };

  const confirmStatusChange = async () => {
    if (!statusChangeRow) return;
    const next = statusChangeValue || statusChangeRow.status;
    if (next === (statusChangeRow.status || "Open")) {
      closeStatusChangeModal();
      return;
    }

    const row = statusChangeRow;
    setStatusUpdatingId(row._id);
    try {
      const res = await ProjectServices.updateProject(
        row._id,
        { status: next },
        {
          headers: authHeaders,
          withCredentials: true,
        },
      );
      if (checkTokenExpired(res)) return;
      if (res.data?.status) {
        notifySuccess("Project updated");
        setStatusChangeRow(null);
        setStatusChangeValue("");
        fetchProjects();
      } else {
        notifyError(res.data?.message || "Could not update the project");
      }
    } catch (error) {
      notifyError(
        error?.response?.data?.message || "Could not update the project",
      );
    } finally {
      setStatusUpdatingId("");
    }
  };

  const clearAllFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setCurrentPage(1);
  };

  const filters = [
    {
      isClearButton: true,
      buttonProps: { onClick: clearAllFilters },
    },
    {
      label: "Status",
      value: statusFilter,
      onChange: (value) => {
        setStatusFilter(value);
        setCurrentPage(1);
      },
      options: [
        { value: "all", label: "All Statuses" },
        ...PROJECT_STATUS_OPTIONS.map((s) => ({ value: s, label: s })),
      ],
      placeholder: "Select Status",
      icon: FileText,
    },
  ];

  const countOf = (status) => rows.filter((r) => r.status === status).length;

  const summaryCardsData = [
    {
      title: "Total Projects",
      value: total || 0,
      backgroundColor: "summary-light",
      iconColor: "summary-dark",
      Icon: SummarySvg,
    },
    {
      title: "In Progress",
      value: countOf("Open") + countOf("In Progress"),
      backgroundColor: "processing-light",
      iconColor: "processing-dark",
      Icon: InProgressSvg,
    },
    {
      title: "Completed",
      value: countOf("Completed"),
      backgroundColor: "completed-light",
      iconColor: "completed-dark",
      Icon: CompletedSvg,
    },
    {
      title: "On Hold",
      value: countOf("On Hold"),
      backgroundColor: "processing-light",
      iconColor: "processing-dark",
      Icon: InProgressSvg,
    },
  ];

  return (
    <div className="bg-gray-50 min-h-screen w-full max-w-full overflow-x-hidden">
      <div className="w-full max-w-full mx-auto px-6 py-8 min-w-0 overflow-x-hidden">
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
              <p className="text-gray-600 mt-2">
                {scopedToMe
                  ? "The certification jobs assigned to you. Open one to run its audit."
                  : "Certification work in progress. A project opens when a customer accepts their quotation, and its audit is run from here."}
              </p>
            </div>
          </div>
        </div>

        <SummaryCards cards={summaryCardsData} columnsCount={4} />

        <DataTable
          onSearch={(value) => {
            setSearchTerm(value);
            setCurrentPage(1);
          }}
          searchValue={searchTerm}
          searchPlaceholder="Search by project, job, certificate, report, application, customer or product…"
          filters={filters}
          headers={headers}
          headersToHide={[]}
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
                {row._id ? (
                  <button
                    type="button"
                    className="text-[var(--p-blue)] hover:underline font-medium text-left whitespace-nowrap"
                    title={row.projectNumber || ""}
                    onClick={() => history.push(`/projects/${row._id}`)}
                  >
                    {row.projectNumber || "—"}
                  </button>
                ) : (
                  <span className="whitespace-nowrap">
                    {row.projectNumber || "—"}
                  </span>
                )}
                <div className="text-xs text-gray-500">
                  {row.applicationNumber || "—"}
                  {row.jobNo ? ` · ${row.jobNo}` : ""}
                  {row.quotationRef ? ` · ${row.quotationRef}` : ""}
                </div>
              </td>
              <td className="py-2 px-4">
                <div className="font-medium text-gray-900">
                  {row.companyName || "—"}
                </div>
                <div className="text-xs text-gray-500">
                  {row.productName || ""}
                </div>
              </td>
              <td className="py-2 px-4 text-sm" title={row.service || ""}>
                <div className="font-medium text-gray-900">
                  {row.service || "—"}
                </div>
                {row.certificationType ? (
                  <div className="text-xs text-gray-500">
                    {row.certificationType}
                  </div>
                ) : null}
              </td>
              <td className="py-2 px-4 whitespace-nowrap text-sm">
                {money(row.contractValue, row.currency)}
              </td>
              <td className="py-2 px-4 whitespace-nowrap">
                {getStatusBadge(row.status)}
              </td>
              <td className="py-2 px-4">
                {getStatusBadge(row.invoiceStatus)}
                {row.invoiceNumber ? (
                  <div className="text-xs text-gray-500 mt-0.5">
                    {row.invoiceNumber}
                  </div>
                ) : null}
              </td>
              <td className="py-2 px-4 whitespace-nowrap">
                <div className="text-sm">
                  {formatDate(row.quotationAcceptedAt)}
                </div>
                <div className="text-xs text-gray-500">
                  {row.quotationAcceptedBy || "—"}
                </div>
              </td>
              <td className="py-2 px-4">
                <ActionButtons
                  maxVisibleActions={2}
                  items={[
                    {
                      action: ACTION_BUTTON_TYPES.VIEW,
                      title: "Open audit",
                      onClick: () => history.push(`/projects/${row._id}`),
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
                    /* List menu: only the next unfinished audit stage.
                       Completed / approved ones stay off this overflow —
                       the project detail page shows the full workflow. */
                    ...[currentWorkflowStage(row.workflow)]
                      .filter(Boolean)
                      .map((stage) => ({
                        action: ACTION_BUTTON_TYPES.WORKFLOW,
                        title: stage.title,
                        description: [stage.documentCode, stage.status]
                          .filter(Boolean)
                          .join(" · "),
                        onClick: () =>
                          history.push(
                            `/projects/${row._id}?stage=${stage.key}`,
                          ),
                      })),
                  ]}
                />
              </td>
            </tr>
          )}
        />
      </div>

      <ProjectHistoryModal
        open={Boolean(historyRow)}
        onClose={() => setHistoryRow(null)}
        project={historyRow}
      />

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
              statusChangeValue === (statusChangeRow?.status || "Open"),
            onClick: confirmStatusChange,
          },
        ]}
      >
        {statusChangeRow ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-700">
              Update status for{" "}
              <span className="font-semibold">
                {statusChangeRow.projectNumber || "this project"}
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
                options={PROJECT_STATUS_OPTIONS.map((s) => ({
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
    </div>
  );
};

export default Projects;
