import React, { useContext } from "react";
import { useHistory } from "react-router-dom";

import { AdminContext } from "@/context/AdminContext";
import CustomerBrandingProvider from "@/customer/branding/CustomerBrandingProvider";
import { PageHeading } from "@/customer/layouts/PortalLayout";
import { Card, CardHeader, CardLink, IconTile } from "@/customer/components/ui/Card";
import StatCard from "@/customer/components/ui/StatCard";
import StatusPill from "@/customer/components/ui/StatusPill";
import DataTable from "@/customer/components/ui/DataTable";
import BarChart from "@/customer/components/ui/charts/BarChart";
import {
  AwardIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClipboardIcon,
  FileIcon,
  InvoiceIcon,
  WalletIcon,
} from "@/customer/components/ui/icons";
import useAdminDashboardData from "@/hooks/useAdminDashboardData";
import "@/customer/styles/index.css";

const UPDATE_ICONS = {
  check: CheckCircleIcon,
  file: FileIcon,
  clipboard: ClipboardIcon,
  invoice: InvoiceIcon,
};

const Dashboard = () => {
  const { state } = useContext(AdminContext);
  const history = useHistory();
  const displayName = state?.adminInfo?.name || "User";
  const { data, loading, error } = useAdminDashboardData();

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
            history.push(`/applications/view/${row._id || row.id}`)
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
    <CustomerBrandingProvider className="epc-admin-dashboard">
      <div
        className="epc-admin-dashboard__inner"
        style={{
          background: "var(--epc-portal-bg)",
          padding: "var(--epc-portal-gutter)",
          minHeight: "100%",
        }}
      >
        <PageHeading
          title={`Welcome back, ${displayName}`}
          subtitle="Overview of applications, inspections, certificates and invoices from your live records."
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
          <p
            className="epc-field__error"
            role="alert"
            style={{ marginBottom: 16 }}
          >
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="epc-muted-small" style={{ marginBottom: 16 }}>
            Loading dashboard…
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
                  ? `${pendingActions.length} item${pendingActions.length === 1 ? "" : "s"} need attention`
                  : "Nothing pending right now"
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
                      <span className="epc-actionlist__label">
                        {action.label}
                      </span>
                      <span className="epc-actionlist__meta">
                        {[action.reference, action.due]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="epc-card-foot">
              <CardLink onClick={() => history.push("/applications")}>
                View all applications
              </CardLink>
            </div>
          </Card>

          <Card span={2}>
            <CardHeader
              title="Upcoming Inspections"
              subtitle="Scheduled applications and factory audit visit dates"
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
              subtitle="Latest activity across all customers"
            />
            {recentUpdates.length === 0 ? (
              <p className="epc-table-empty">No customer updates yet.</p>
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
              <CardLink onClick={() => history.push("/applications")}>
                View applications
              </CardLink>
            </div>
          </Card>

          <Card span={2}>
            <CardHeader
              title="Recent Applications"
              action={
                <CardLink onClick={() => history.push("/applications")}>
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
              subtitle="Certificate numbers recorded on projects and applications"
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
                            `/applications/view/${certificate.application}`,
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
              <CardLink onClick={() => history.push("/projects")}>
                View projects
              </CardLink>
            </div>
          </Card>
        </div>
      </div>
    </CustomerBrandingProvider>
  );
};

export default Dashboard;
