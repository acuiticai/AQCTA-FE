import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useHistory } from "react-router-dom";

import PortalLayout, { PageHeading } from "../../layouts/PortalLayout";
import { Card, CardHeader } from "../../components/ui/Card";
import DataTable from "../../components/ui/DataTable";
import StatusPill from "../../components/ui/StatusPill";
import FilterBar from "../../components/ui/FilterBar";
import Pagination from "../../components/ui/Pagination";
import Button from "../../components/ui/Button";
import { HelpBanner, RowActions } from "../../components/ui/DetailBlocks";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import AcknowledgeNoticeDialog from "../../components/ui/AcknowledgeNoticeDialog";
import ApplicationHistoryModal from "../../components/ApplicationHistoryModal";
import {
  CheckCircleIcon,
  ClockIcon,
  EyeIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from "../../components/ui/icons";
import useRecordList from "../../hooks/useRecordList";
import { DATE_RANGE_OPTIONS } from "../../data/enquiriesMock";
import {
  APPLICATION_SERVICES,
  APPLICATION_STATUSES,
} from "../../data/applicationsMock";
import { customerPath } from "../../routes/paths";
import CustomerApplicationServices from "../../services/applicationService";

const ACTIVE_STATUSES = [
  "Under Review",
  "Scheduled",
  "In Progress",
  "Draft",
  "Resubmitted",
  "Approved",
];

const withinDays = (isoDate, days) => {
  if (!days || !isoDate) return true;
  const then = new Date(isoDate).getTime();
  if (Number.isNaN(then)) return true;
  return then >= Date.now() - Number(days) * 24 * 60 * 60 * 1000;
};

export default function ApplicationsList() {
  const history = useHistory();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [historyRow, setHistoryRow] = useState(null);
  const [ackRow, setAckRow] = useState(null);
  const [ackBusy, setAckBusy] = useState(false);

  const loadApplications = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await CustomerApplicationServices.getMyApplications({
        limit: 100,
      });
      const data = res?.data?.data;
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setRows([]);
      setLoadError(
        err?.response?.data?.message || "Failed to load your applications.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  const dateScopedRows = useMemo(
    () =>
      rows.filter((row) =>
        withinDays(row.submittedAt || row.createdAt, dateFilter),
      ),
    [rows, dateFilter],
  );

  const list = useRecordList({
    rows: dateScopedRows,
    searchFields: [
      "id",
      "applicationNumber",
      "service",
      "stage",
      "summary",
      "purpose",
    ],
    filterFields: { service: "service", status: "status" },
  });

  const activeCount = rows.filter((row) =>
    ACTIVE_STATUSES.includes(row.status),
  ).length;
  const actionCount = rows.filter(
    (row) =>
      row.status === "Action Required" ||
      row.status === "Rejected" ||
      row.needsAcknowledgement,
  ).length;

  const recordKey = (row) => row._id || row.id;

  const setFilter = (key, value) => {
    if (key === "date") {
      setDateFilter(value || "");
      list.setPage(1);
      return;
    }
    list.setFilter(key, value);
  };

  const reset = () => {
    setDateFilter("");
    list.reset();
  };

  const columns = [
    { key: "id", header: "Reference", width: "14%" },
    { key: "service", header: "Service", width: "14%" },
    {
      key: "summary",
      header: "Summary",
      width: "16%",
      render: (row) =>
        row.summary ||
        row.purpose ||
        row.formData?.productName ||
        row.formData?.projectName ||
        "—",
    },
    {
      key: "created",
      header: "Created",
      width: "10%",
      render: (row) => row.created || "—",
    },
    { key: "submitted", header: "Submitted", width: "10%" },
    {
      key: "status",
      header: "Status",
      width: "12%",
      render: (row) => (
        <StatusPill
          status={
            row.needsAcknowledgement ? "Action Required" : row.status
          }
        />
      ),
    },
    {
      key: "actions",
      header: "Actions",
      width: "10%",
      render: (row) => {
        const key = recordKey(row);
        return (
          <RowActions
            actions={[
              {
                icon: EyeIcon,
                label: `View ${row.id}`,
                onClick: () =>
                  history.push(`${customerPath.applications}/${key}`),
              },
              ...(row.needsAcknowledgement
                ? [
                    {
                      icon: CheckCircleIcon,
                      label: `Confirm receipt — ${row.id}`,
                      onClick: () =>
                        setAckRow({
                          applicationId: key,
                          ...(row.acknowledgementNotice || {
                            formKey: "FOR-01-11",
                            title: "Factory Audit Notice",
                            needsAcknowledgement: true,
                          }),
                        }),
                    },
                  ]
                : []),
              {
                icon: ClockIcon,
                label: `Activity for ${row.id}`,
                onClick: () => setHistoryRow(row),
              },
              ...(row.canEdit
                ? [
                    {
                      icon: PencilIcon,
                      label: `Edit ${row.id}`,
                      onClick: () =>
                        history.push(
                          `${customerPath.applications}/${row.type}/new`,
                          { applicationId: key },
                        ),
                    },
                  ]
                : []),
              ...(row.canDelete
                ? [
                    {
                      icon: TrashIcon,
                      label: `Delete ${row.id}`,
                      tone: "danger",
                      onClick: () => setPendingDelete(row),
                    },
                  ]
                : []),
            ]}
          />
        );
      },
    },
  ];

  const handleDelete = async () => {
    if (!pendingDelete || deleting) return;
    const key = recordKey(pendingDelete);
    setDeleting(true);
    try {
      await CustomerApplicationServices.deleteMyApplication(key);
      setPendingDelete(null);
      await loadApplications();
    } catch (err) {
      setLoadError(
        err?.response?.data?.message || "Failed to delete application.",
      );
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <PortalLayout>
      <PageHeading
        title="My Applications"
        subtitle="View, track and manage all your certification, inspection and assessment applications."
        action={
          <Button onClick={() => history.push(customerPath.applicationsNew)}>
            <PlusIcon size={15} />
            Create Application
          </Button>
        }
      />

      <FilterBar
        subtitle="Narrow the list by reference, service, status or submission date."
        searchPlaceholder="Search by reference, summary or service…"
        searchValue={list.search}
        onSearchChange={list.setSearch}
        values={{ ...list.filters, date: dateFilter }}
        onChange={setFilter}
        onReset={reset}
        filters={[
          { key: "service", placeholder: "All Services", options: APPLICATION_SERVICES },
          { key: "status", placeholder: "All Statuses", options: APPLICATION_STATUSES },
          { key: "date", placeholder: "Any Date", options: DATE_RANGE_OPTIONS },
        ]}
      />

      <Card>
        <CardHeader
          title="Applications"
          subtitle={loading ? "Loading…" : `${list.total} total applications`}
          action={
            <span className="epc-chip">
              {activeCount} active · {actionCount} need action
            </span>
          }
        />
        {loadError ? (
          <p
            className="epc-field__error"
            role="alert"
            style={{ padding: "12px 16px" }}
          >
            {loadError}{" "}
            <button
              type="button"
              className="epc-link"
              onClick={loadApplications}
            >
              Retry
            </button>
          </p>
        ) : null}
        <DataTable
          selectable
          columns={columns}
          rows={loading ? [] : list.rows}
          emptyMessage={
            loading
              ? "Loading applications…"
              : "No applications match these filters."
          }
        />
        <Pagination
          page={list.page}
          pageSize={list.pageSize}
          total={list.total}
          itemLabel="applications"
          onPageChange={list.setPage}
          onPageSizeChange={list.setPageSize}
        />
      </Card>

      <HelpBanner
        title="Need help with an application?"
        body="Open the application and use Messages to contact AQCTA team about documents, schedules or next steps."
        actionLabel="Contact Support"
        onAction={() => history.push(customerPath.dashboard)}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this draft?"
        body={
          pendingDelete
            ? `${pendingDelete.id} will be removed from your list. This cannot be undone.`
            : ""
        }
        confirmLabel={deleting ? "Deleting…" : "Delete draft"}
        onCancel={() => {
          if (!deleting) setPendingDelete(null);
        }}
        onConfirm={handleDelete}
      />

      <ApplicationHistoryModal
        open={Boolean(historyRow)}
        onClose={() => setHistoryRow(null)}
        application={historyRow}
      />

      <AcknowledgeNoticeDialog
        open={Boolean(ackRow)}
        notice={ackRow}
        busy={ackBusy}
        onCancel={() => {
          if (!ackBusy) setAckRow(null);
        }}
        onSubmit={async (payload) => {
          if (!ackRow?.applicationId) return;
          setAckBusy(true);
          try {
            await CustomerApplicationServices.acknowledgeAuditNotice(
              ackRow.applicationId,
              payload,
            );
            setAckRow(null);
            await loadApplications();
          } catch (err) {
            setLoadError(
              err?.response?.data?.message ||
                "Your confirmation could not be recorded.",
            );
            setAckRow(null);
          } finally {
            setAckBusy(false);
          }
        }}
      />
    </PortalLayout>
  );
}
