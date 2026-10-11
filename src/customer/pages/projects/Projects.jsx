import React, { useCallback, useEffect, useState } from "react";
import { useHistory } from "react-router-dom";

import PortalLayout, { PageHeading } from "../../layouts/PortalLayout";
import { Card, CardHeader } from "../../components/ui/Card";
import DataTable from "../../components/ui/DataTable";
import StatusPill from "../../components/ui/StatusPill";
import { RowActions } from "../../components/ui/DetailBlocks";
import AcknowledgeNoticeDialog from "../../components/ui/AcknowledgeNoticeDialog";
import { CheckCircleIcon, EyeIcon } from "../../components/ui/icons";
import CustomerProjectServices from "../../services/projectService";
import CustomerApplicationServices from "../../services/applicationService";
import { customerPath } from "../../routes/paths";

const formatDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

const formatMoney = (amount, currency = "MYR") =>
  `${currency === "MYR" ? "RM" : currency} ${Number(amount || 0).toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/**
 * Customer Portal → Projects
 *
 * A project opens once you accept a quotation — this is where your
 * certification work is tracked from there. When an audit notice needs
 * confirmation, Confirm receipt is offered here as well as on the
 * linked application.
 */
export default function Projects() {
  const history = useHistory();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [ackRow, setAckRow] = useState(null);
  const [ackBusy, setAckBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await CustomerProjectServices.getMyProjects();
      setRows(Array.isArray(res?.data?.data) ? res.data.data : []);
    } catch (err) {
      setLoadError(err?.response?.data?.message || "Failed to load projects.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openApplication = (row) => {
    if (!row?.application) return;
    history.push(`${customerPath.applications}/${row.application}`);
  };

  const columns = [
    {
      key: "projectNumber",
      header: "Project",
      width: "14%",
      render: (row) => (
        <>
          <button
            type="button"
            className="epc-rowlink"
            onClick={() => openApplication(row)}
          >
            {row.projectNumber}
          </button>
          {row.jobNo ? (
            <div className="epc-muted-small">Job {row.jobNo}</div>
          ) : null}
        </>
      ),
    },
    {
      key: "productName",
      header: "Product",
      width: "22%",
      render: (row) => (
        <div>
          <div>{row.productName || "—"}</div>
          <div className="epc-muted-small">{row.applicationNumber}</div>
        </div>
      ),
    },
    { key: "quotationRef", header: "Quotation", width: "12%" },
    {
      key: "contractValue",
      header: "Value",
      width: "12%",
      render: (row) => formatMoney(row.contractValue, row.currency),
    },
    {
      key: "status",
      header: "Status",
      width: "12%",
      render: (row) =>
        row.needsAcknowledgement ? (
          <StatusPill status="Action Required" />
        ) : (
          <StatusPill status={row.status} />
        ),
    },
    {
      key: "invoiceStatus",
      header: "Invoice",
      width: "10%",
      render: (row) => <StatusPill status={row.invoiceStatus} />,
    },
    {
      key: "quotationAcceptedAt",
      header: "Started",
      width: "8%",
      render: (row) => formatDate(row.quotationAcceptedAt),
    },
    {
      key: "actions",
      header: "Actions",
      width: "10%",
      render: (row) => (
        <RowActions
          actions={[
            {
              icon: EyeIcon,
              label: `View ${row.projectNumber}`,
              onClick: () => openApplication(row),
            },
            ...(row.needsAcknowledgement && row.application
              ? [
                  {
                    icon: CheckCircleIcon,
                    label: `Confirm receipt — ${row.projectNumber}`,
                    onClick: () =>
                      setAckRow({
                        applicationId: row.application,
                        ...(row.acknowledgementNotice || {
                          formKey: "FOR-01-11",
                          title: "Factory Audit Notice",
                          needsAcknowledgement: true,
                        }),
                      }),
                  },
                ]
              : []),
          ]}
        />
      ),
    },
  ];

  return (
    <PortalLayout>
      <PageHeading
        title="Projects"
        subtitle="Certification work in progress and completed, opened once a quotation is accepted."
      />

      <Card>
        <CardHeader
          title="Projects"
          subtitle={loading ? "Loading…" : `${rows.length} total project${rows.length === 1 ? "" : "s"}`}
        />
        {loadError ? (
          <p className="epc-field__error" role="alert" style={{ padding: "12px 16px" }}>
            {loadError}
          </p>
        ) : null}

        {!loading && rows.length === 0 && !loadError ? (
          <div className="epc-placeholder" style={{ padding: "32px 16px" }}>
            <p className="epc-placeholder__title">No projects yet</p>
            <p className="epc-placeholder__text">
              A project opens here once you accept a quotation for one of your
              applications.
            </p>
          </div>
        ) : (
          <DataTable rowKey="projectNumber" columns={columns} rows={rows} />
        )}
      </Card>

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
            await load();
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
