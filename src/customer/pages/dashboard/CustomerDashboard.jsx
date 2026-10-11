import React from "react";
import { useHistory } from "react-router-dom";

import PortalLayout, { PageHeading } from "../../layouts/PortalLayout";
import { useAccount } from "../../context/AccountContext";
import { Card, CardHeader, CardLink, IconTile } from "../../components/ui/Card";
import StatCard from "../../components/ui/StatCard";
import StatusPill from "../../components/ui/StatusPill";
import DataTable from "../../components/ui/DataTable";
import BarChart from "../../components/ui/charts/BarChart";
import {
  AwardIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClipboardIcon,
  FileIcon,
  InvoiceIcon,
  WalletIcon,
} from "../../components/ui/icons";
import { customerPath } from "../../routes/paths";
import useCustomerDashboardData from "../../hooks/useCustomerDashboardData";

const UPDATE_ICONS = {
  check: CheckCircleIcon,
  file: FileIcon,
  clipboard: ClipboardIcon,
  invoice: InvoiceIcon,
};

export default function CustomerDashboard() {
  const account = useAccount();
  const history = useHistory();
  const { data, loading, error } = useCustomerDashboardData();

  const {
    dashboardSummary,
    applicationOverview: overview,
    pendingActions,
    upcomingInspections,
    recentUpdates,
    recentApplications,
    certificates,
  } = data;

  const inspectionColumns = [
    { key: "id", header: "Reference", width: "20%" },
    { key: "service", header: "Service", width: "26%" },
    { key: "date", header: "Date", width: "18%" },
    { key: "location", header: "Location", width: "20%" },
    {
      key: "status",
      header: "Status",
      width: "16%",
      render: (row) => <StatusPill status={row.status} />,
    },
  ];

  const applicationColumns = [
    { key: "id", header: "Reference", width: "22%" },
    { key: "service", header: "Service", width: "28%" },
    { key: "submitted", header: "Submitted", width: "18%" },
    {
      key: "status",
      header: "Status",
      width: "20%",
      render: (row) => <StatusPill status={row.status} />,
    },
    {
      key: "action",
      header: "Action",
      width: "12%",
      render: (row) => (
        <button
          type="button"
          className="epc-rowlink"
          onClick={() =>
            history.push(
              `${customerPath.applications}/${row._id || row.id}`,
            )
          }
        >
          View
        </button>
      ),
    },
  ];

  const deltaClass =
    overview.changeDirection === "down"
      ? "epc-delta epc-delta--down"
      : overview.changeDirection === "up"
        ? "epc-delta epc-delta--up"
        : "epc-delta";

  const deltaArrow =
    overview.changeDirection === "down"
      ? "↓"
      : overview.changeDirection === "up"
        ? "↑"
        : "→";

  return (
    <PortalLayout>
      <PageHeading
        title={`Welcome back, ${account.name}`}
        subtitle="Manage your applications, inspections, assessments, certificates and payments — all in one place."
        action={
          <button
            type="button"
            className="epc-iconbtn epc-iconbtn--boxed"
            aria-label="Open calendar"
          >
            <CalendarIcon size={18} />
          </button>
        }
      />

      {error ? (
        <p className="epc-field__error" role="alert" style={{ marginBottom: 16 }}>
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="epc-muted-small" style={{ marginBottom: 16 }}>
          Loading your dashboard…
        </p>
      ) : null}

      <div className="epc-statgrid">
        <StatCard
          icon={FileIcon}
          tone="brand"
          label="Active Applications"
          {...dashboardSummary.activeApplications}
        />
        <StatCard
          icon={CalendarIcon}
          tone="neutral"
          label="Upcoming Inspections"
          {...dashboardSummary.upcomingInspections}
        />
        <StatCard
          icon={AwardIcon}
          tone="success"
          label="Valid Certificates"
          {...dashboardSummary.validCertificates}
        />
        <StatCard
          icon={WalletIcon}
          tone="warning"
          label="Outstanding Invoices"
          {...dashboardSummary.outstandingInvoices}
        />
      </div>

      <div className="epc-dashgrid">
        <Card span={2}>
          <CardHeader
            title="Application Overview"
            subtitle="Applications submitted across the last eight months"
            action={
              <button type="button" className="epc-chip">
                {overview.rangeLabel}
              </button>
            }
          />

          <div className="epc-overview__summary">
            <span className="epc-overview__total">{overview.total}</span>
            <span className="epc-overview__unit">active applications</span>
            <span className={deltaClass}>
              {deltaArrow} {overview.changePercent}%
            </span>
          </div>

          <BarChart
            data={overview.months}
            highlightIndex={overview.currentMonthIndex}
            valueLabel="applications"
            formatTooltip={(point) => `${point.value} applications`}
          />
        </Card>

        <Card>
          <CardHeader
            title="Pending Actions"
            subtitle={
              pendingActions.length
                ? `${pendingActions.length} item${pendingActions.length === 1 ? "" : "s"} need your attention`
                : "Nothing needs your attention right now"
            }
          />
          {pendingActions.length === 0 ? (
            <p className="epc-table-empty">You're all caught up.</p>
          ) : (
            <ul className="epc-actionlist">
              {pendingActions.map((action) => (
                <li key={action.id} className="epc-actionlist__item">
                  <span
                    className={`epc-dot epc-dot--${action.tone}`}
                    aria-hidden="true"
                  />
                  <button
                    type="button"
                    className="epc-actionlist__text"
                    style={{
                      background: "none",
                      border: 0,
                      padding: 0,
                      textAlign: "left",
                      cursor: action.href ? "pointer" : "default",
                      width: "100%",
                    }}
                    onClick={() => action.href && history.push(action.href)}
                  >
                    <span className="epc-actionlist__label">{action.label}</span>
                    <span className="epc-actionlist__meta">
                      {[action.reference, action.due].filter(Boolean).join(" · ")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="epc-card-foot">
            <CardLink onClick={() => history.push(customerPath.applications)}>
              View all applications
            </CardLink>
          </div>
        </Card>

        <Card span={2}>
          <CardHeader
            title="Upcoming Inspections"
            subtitle="Scheduled visits and audit notices from your applications"
          />
          <DataTable
            columns={inspectionColumns}
            rows={upcomingInspections}
            emptyMessage="No inspections scheduled yet."
          />
        </Card>

        <Card>
          <CardHeader
            title="Recent Updates"
            subtitle="Latest activity on your account"
          />
          {recentUpdates.length === 0 ? (
            <p className="epc-table-empty">No notifications yet.</p>
          ) : (
            <ul className="epc-activity">
              {recentUpdates.map((update) => (
                <li key={update.id} className="epc-activity__item">
                  <IconTile
                    icon={UPDATE_ICONS[update.icon] || FileIcon}
                    tone={update.tone}
                    size="sm"
                  />
                  <button
                    type="button"
                    className="epc-activity__text"
                    style={{
                      background: "none",
                      border: 0,
                      padding: 0,
                      textAlign: "left",
                      cursor: update.link ? "pointer" : "default",
                      width: "100%",
                    }}
                    onClick={() => update.link && history.push(update.link)}
                  >
                    <span className="epc-activity__title">{update.title}</span>
                    <span className="epc-activity__meta">{update.meta}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="epc-card-foot">
            <CardLink onClick={() => history.push(customerPath.applications)}>
              View applications
            </CardLink>
          </div>
        </Card>

        <Card span={2}>
          <CardHeader
            title="Recent Applications"
            action={
              <CardLink onClick={() => history.push(customerPath.applications)}>
                View all applications
              </CardLink>
            }
          />
          <DataTable
            columns={applicationColumns}
            rows={recentApplications}
            emptyMessage="No applications yet."
          />
        </Card>

        <Card>
          <CardHeader
            title="Certificates &amp; Renewals"
            subtitle="Certificate numbers on your projects and applications"
          />

          <div className="epc-certsummary">
            <span className="epc-certsummary__label">Valid certificates</span>
            <span className="epc-certsummary__row">
              <span className="epc-certsummary__value">
                {certificates.validCount}
              </span>
              <span className="epc-certsummary__note">
                {certificates.validNote}
              </span>
            </span>
          </div>

          {certificates.renewals.length === 0 ? (
            <p className="epc-table-empty">No certificates on file yet.</p>
          ) : (
            <ul className="epc-renewals">
              {certificates.renewals.map((certificate) => (
                <li key={certificate.id} className="epc-renewals__item">
                  <span className="epc-renewals__text">
                    <span className="epc-renewals__id">{certificate.id}</span>
                    <span className="epc-renewals__meta">
                      {certificate.expires}
                    </span>
                  </span>
                  {certificate.application ? (
                    <button
                      type="button"
                      className="epc-rowlink"
                      onClick={() =>
                        history.push(
                          `${customerPath.applications}/${certificate.application}`,
                        )
                      }
                    >
                      View →
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          <div className="epc-card-foot">
            <CardLink onClick={() => history.push("/customer/projects")}>
              View projects
            </CardLink>
          </div>
        </Card>
      </div>
    </PortalLayout>
  );
}
