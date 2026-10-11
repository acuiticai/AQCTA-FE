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
import {
  EyeIcon,
  PencilIcon,
  PlusIcon,
  RefreshIcon,
  TrashIcon,
} from "../../components/ui/icons";
import useRecordList from "../../hooks/useRecordList";
import {
  DATE_RANGE_OPTIONS,
  ENQUIRY_STATUSES,
  ENQUIRY_TYPE_OPTIONS,
} from "../../data/enquiriesMock";
import { customerPath } from "../../routes/paths";
import CustomerEnquiryServices from "../../services/enquiryService";

const withinDays = (isoDate, days) => {
  if (!days || !isoDate) return true;
  const then = new Date(isoDate).getTime();
  if (Number.isNaN(then)) return true;
  return then >= Date.now() - Number(days) * 24 * 60 * 60 * 1000;
};

export default function EnquiriesList() {
  const history = useHistory();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [dateFilter, setDateFilter] = useState("");

  const loadEnquiries = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await CustomerEnquiryServices.getMyEnquiries({ limit: 100 });
      const data = res?.data?.data;
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setRows([]);
      setLoadError(
        err?.response?.data?.message || "Failed to load your enquiries.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEnquiries();
  }, [loadEnquiries]);

  const dateScopedRows = useMemo(
    () => rows.filter((row) => withinDays(row.createdAt, dateFilter)),
    [rows, dateFilter],
  );

  const list = useRecordList({
    rows: dateScopedRows,
    searchFields: ["id", "enquiryNumber", "subject", "enquiringFor", "message"],
    filterFields: { type: "enquiringFor", status: "status" },
  });

  const openCount = rows.filter((row) => row.status === "Open").length;
  const convertedCount = rows.filter((row) => row.status === "Converted").length;
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
    { key: "id", header: "Enquiry No.", width: "15%" },
    { key: "enquiringFor", header: "Enquiring For", width: "18%" },
    { key: "submitted", header: "Submitted", width: "13%" },
    { key: "subject", header: "Enquiry", width: "20%" },
    {
      key: "status",
      header: "Status",
      width: "12%",
      render: (row) => <StatusPill status={row.status} />,
    },
    { key: "updated", header: "Updated", width: "10%" },
    {
      key: "actions",
      header: "Actions",
      width: "12%",
      render: (row) => {
        const key = recordKey(row);
        return (
          <RowActions
            actions={[
              {
                icon: EyeIcon,
                label: `View ${row.id}`,
                onClick: () => history.push(`${customerPath.enquiries}/${key}`),
              },
              ...(row.canEdit
                ? [
                    {
                      icon: PencilIcon,
                      label: `Edit ${row.id}`,
                      onClick: () =>
                        history.push(`${customerPath.enquiries}/${key}/edit`),
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
              ...(row.canConvert
                ? [
                    {
                      icon: RefreshIcon,
                      label: `Start an application from ${row.id}`,
                      tone: "brand",
                      onClick: () =>
                        history.push(customerPath.applicationsNew, {
                          enquiryId: key,
                          enquiringFor: row.enquiringFor,
                        }),
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
      await CustomerEnquiryServices.deleteMyEnquiry(key);
      setPendingDelete(null);
      await loadEnquiries();
    } catch (err) {
      setLoadError(err?.response?.data?.message || "Failed to delete enquiry.");
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <PortalLayout>
      <PageHeading
        title="My Enquiries"
        subtitle="View, track and manage your enquiries with AQCTA before starting an application."
        action={
          <Button onClick={() => history.push(customerPath.enquiriesNew)}>
            <PlusIcon size={15} />
            Create New Enquiry
          </Button>
        }
      />

      <FilterBar
        subtitle="Narrow the list by enquiry number, type, status or submission date."
        searchPlaceholder="Search by enquiry no. or keyword…"
        searchValue={list.search}
        onSearchChange={list.setSearch}
        values={{ ...list.filters, date: dateFilter }}
        onChange={setFilter}
        onReset={reset}
        filters={[
          { key: "type", placeholder: "All Enquiry Types", options: ENQUIRY_TYPE_OPTIONS },
          { key: "status", placeholder: "All Statuses", options: ENQUIRY_STATUSES },
          { key: "date", placeholder: "Any Date", options: DATE_RANGE_OPTIONS },
        ]}
      />

      <Card>
        <CardHeader
          title="Enquiries"
          subtitle={loading ? "Loading…" : `${list.total} total enquiries`}
          action={
            <span className="epc-chip">
              {openCount} open · {convertedCount} converted
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
            <button type="button" className="epc-link" onClick={loadEnquiries}>
              Retry
            </button>
          </p>
        ) : null}
        <DataTable
          selectable
          columns={columns}
          rows={loading ? [] : list.rows}
          emptyMessage={
            loading ? "Loading enquiries…" : "No enquiries match these filters."
          }
        />
        <Pagination
          page={list.page}
          pageSize={list.pageSize}
          total={list.total}
          itemLabel="enquiries"
          onPageChange={list.setPage}
          onPageSizeChange={list.setPageSize}
        />
      </Card>

      <HelpBanner
        title="Need help with an enquiry?"
        body="Open the enquiry to review AQCTA responses, update your enquiry, or contact Support / Messages for assistance."
        actionLabel="Contact Support"
        onAction={() => history.push(customerPath.dashboard)}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this enquiry?"
        body={
          pendingDelete
            ? `${pendingDelete.id} will be removed from your list. This cannot be undone.`
            : ""
        }
        confirmLabel={deleting ? "Deleting…" : "Delete enquiry"}
        onCancel={() => {
          if (!deleting) setPendingDelete(null);
        }}
        onConfirm={handleDelete}
      />
    </PortalLayout>
  );
}
