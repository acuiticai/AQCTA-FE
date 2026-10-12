import React, { useContext, useEffect, useMemo, useState } from "react";
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
import StatusPill from "@/customer/components/ui/StatusPill";
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
  const [statusFilter, setStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
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
          status: statusFilter || undefined,
        },
        {
          headers: authHeaders,
          withCredentials: true,
        },
      );
      if (checkTokenExpired(response)) return;

      setRows(Array.isArray(response.data?.data) ? response.data.data : []);
      setTotal(response.data?.meta?.total || 0);
      setScopedToMe(Boolean(response.data?.meta?.scopedToMe));
    } catch (error) {
      notifyError(error?.response?.data?.message || "Failed to load projects");
      setRows([]);
      setTotal(0);
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

  const columns = [
    {
      key: "project",
      header: "Project",
      width: "16%",
      render: (row) => (
        <>
          {row._id ? (
            <button
              type="button"
              className="epc-cell__link"
              title={row.projectNumber || ""}
              onClick={() => history.push(`/projects/${row._id}`)}
            >
              {row.projectNumber || "—"}
            </button>
          ) : (
            <span className="epc-cell__primary">
              {row.projectNumber || "—"}
            </span>
          )}
          <div className="epc-cell__secondary">
            {row.applicationNumber || "—"}
            {row.jobNo ? ` · ${row.jobNo}` : ""}
            {row.quotationRef ? ` · ${row.quotationRef}` : ""}
          </div>
        </>
      ),
    },
    {
      key: "customer",
      header: "Customer / Product",
      width: "16%",
      render: (row) => (
        <>
          <div className="epc-cell__primary">{row.companyName || "—"}</div>
          {row.productName ? (
            <div className="epc-cell__secondary">{row.productName}</div>
          ) : null}
        </>
      ),
    },
    {
      key: "type",
      header: "Type",
      width: "12%",
      render: (row) => (
        <>
          <div className="epc-cell__primary">{row.service || "—"}</div>
          {row.certificationType ? (
            <div className="epc-cell__secondary">{row.certificationType}</div>
          ) : null}
        </>
      ),
    },
    {
      key: "value",
      header: "Value",
      width: "10%",
      render: (row) => money(row.contractValue, row.currency),
    },
    {
      key: "status",
      header: "Status",
      width: "10%",
      render: (row) => <StatusPill status={row.status || "—"} />,
    },
    {
      key: "invoice",
      header: "Invoice",
      width: "12%",
      render: (row) => (
        <>
          <StatusPill status={row.invoiceStatus || "—"} />
          {row.invoiceNumber ? (
            <div className="epc-cell__secondary">{row.invoiceNumber}</div>
          ) : null}
        </>
      ),
    },
    {
      key: "accepted",
      header: "Accepted",
      width: "12%",
      render: (row) => (
        <>
          <div className="epc-cell__primary">
            {formatDate(row.quotationAcceptedAt)}
          </div>
          <div className="epc-cell__secondary">
            {row.quotationAcceptedBy || "—"}
          </div>
        </>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      width: "10%",
      align: "right",
      render: (row) => (
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
            ...[currentWorkflowStage(row.workflow)]
              .filter(Boolean)
              .map((stage) => ({
                action: ACTION_BUTTON_TYPES.WORKFLOW,
                title: stage.title,
                description: [stage.documentCode, stage.status]
                  .filter(Boolean)
                  .join(" · "),
                onClick: () =>
                  history.push(`/projects/${row._id}?stage=${stage.key}`),
              })),
          ]}
        />
      ),
    },
  ];

  return (
    <EpcPage
      title="Projects"
      subtitle={
        scopedToMe
          ? "The certification jobs assigned to you. Open one to run its audit."
          : "Certification work in progress. A project opens when a customer accepts their quotation, and its audit is run from here."
      }
    >
      <SummaryCards
        cards={summaryCardsData}
        columnsCount={4}
        loading={loading && rows.length === 0}
      />

      <FilterBar
        subtitle="Narrow by status or search reference."
        searchPlaceholder="Search by project, job, certificate, report, application, customer or product…"
        searchValue={searchTerm}
        onSearchChange={(value) => {
          setSearchTerm(value);
          setCurrentPage(1);
        }}
        values={{ status: statusFilter }}
        onChange={(key, value) => {
          if (key === "status") {
            setStatusFilter(value || "");
            setCurrentPage(1);
          }
        }}
        onReset={() => {
          setSearchTerm("");
          setStatusFilter("");
          setCurrentPage(1);
        }}
        filters={[
          {
            key: "status",
            placeholder: "All Statuses",
            options: PROJECT_STATUS_OPTIONS,
          },
        ]}
      />

      <Card>
        <CardHeader
          title="Projects"
          subtitle={loading ? "Loading…" : `${total} total projects`}
          action={
            <span className="epc-chip">
              {countOf("Open") + countOf("In Progress")} in progress ·{" "}
              {countOf("Completed")} completed
            </span>
          }
        />
        <PortalDataTable
          columns={columns}
          rows={loading ? [] : rows}
          rowKey="_id"
          emptyMessage={
            loading
              ? "Loading projects…"
              : "No projects match these filters."
          }
        />
        {!loading && total > 0 ? (
          <Pagination
            page={currentPage}
            pageSize={recordsPerPage}
            total={total}
            itemLabel="projects"
            onPageChange={setCurrentPage}
            onPageSizeChange={(perPage) => {
              setRecordsPerPage(perPage);
              setCurrentPage(1);
            }}
          />
        ) : null}
      </Card>

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
              <div>
                <StatusPill status={statusChangeRow.status || "—"} />
              </div>
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
    </EpcPage>
  );
};

export default Projects;
