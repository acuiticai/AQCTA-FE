import React, { useEffect, useMemo, useState } from "react";

import PortalLayout, { PageHeading } from "../../layouts/PortalLayout";
import { Card, CardHeader } from "../../components/ui/Card";
import DataTable from "../../components/ui/DataTable";
import StatusPill from "../../components/ui/StatusPill";
import CustomerInvoiceServices from "../../services/invoiceService";

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
 * Customer Portal → Invoices
 *
 * Lists the shared customer-invoice ledger (Proforma_Invoice) — the same
 * records admin sees under Customer Invoices — including invoices raised
 * automatically when a quotation is accepted.
 */
export default function Invoices() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [downloadingId, setDownloadingId] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError("");
      try {
        const res = await CustomerInvoiceServices.getMyInvoices();
        if (!cancelled) {
          setRows(Array.isArray(res?.data?.data) ? res.data.data : []);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err?.response?.data?.message || "Failed to load invoices.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openInvoice = async (row) => {
    const key = row.downloadKey || row.projectNumber || row.id || row.invoiceNumber;
    if (!key) {
      setLoadError("Could not open that invoice. Please try again.");
      return;
    }
    setDownloadingId(key);
    try {
      const res = await CustomerInvoiceServices.getMyInvoicePdf(key);
      const url = URL.createObjectURL(
        new Blob([res.data], { type: "application/pdf" }),
      );
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setLoadError("Could not open that invoice. Please try again.");
    } finally {
      setDownloadingId("");
    }
  };

  const totalOutstanding = useMemo(
    () =>
      rows
        .filter((r) => r.status === "Raised" || r.status === "pending")
        .reduce((sum, r) => sum + Number(r.amount || 0), 0),
    [rows],
  );

  const columns = [
    {
      key: "invoiceNumber",
      header: "Invoice",
      width: "16%",
      render: (row) => {
        const key = row.downloadKey || row.projectNumber || row.id || row.invoiceNumber;
        return (
          <button
            type="button"
            className="epc-rowlink"
            onClick={() => openInvoice(row)}
            disabled={downloadingId === key}
          >
            {downloadingId === key ? "Opening…" : row.invoiceNumber}
          </button>
        );
      },
    },
    {
      key: "productName",
      header: "Project",
      width: "26%",
      render: (row) => (
        <div>
          <div>{row.productName || "—"}</div>
          <div className="epc-muted-small">
            {[row.projectNumber, row.applicationNumber].filter(Boolean).join(" · ") ||
              "—"}
          </div>
        </div>
      ),
    },
    { key: "quotationRef", header: "Quotation", width: "14%" },
    {
      key: "amount",
      header: "Amount",
      width: "14%",
      render: (row) => formatMoney(row.amount, row.currency),
    },
    {
      key: "status",
      header: "Status",
      width: "12%",
      render: (row) => <StatusPill status={row.status} />,
    },
    {
      key: "issuedAt",
      header: "Issued",
      width: "18%",
      render: (row) => formatDate(row.issuedAt),
    },
  ];

  return (
    <PortalLayout>
      <PageHeading
        title="Invoices"
        subtitle="Invoices raised once a quotation has been accepted, for the projects you have with AQCTA."
      />

      <Card>
        <CardHeader
          title="Invoices"
          subtitle={loading ? "Loading…" : `${rows.length} total invoice${rows.length === 1 ? "" : "s"}`}
          action={
            totalOutstanding > 0 ? (
              <span className="epc-chip">
                {formatMoney(totalOutstanding)} raised
              </span>
            ) : null
          }
        />
        {loadError ? (
          <p className="epc-field__error" role="alert" style={{ padding: "12px 16px" }}>
            {loadError}
          </p>
        ) : null}

        {!loading && rows.length === 0 && !loadError ? (
          <div className="epc-placeholder" style={{ padding: "32px 16px" }}>
            <p className="epc-placeholder__title">No invoices yet</p>
            <p className="epc-placeholder__text">
              Invoices appear here when a quotation is accepted, or when AQCTA
              issues an invoice against your account.
            </p>
          </div>
        ) : (
          <DataTable rowKey="invoiceNumber" columns={columns} rows={rows} />
        )}
      </Card>
    </PortalLayout>
  );
}
