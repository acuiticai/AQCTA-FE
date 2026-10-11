import React, { useContext, useMemo } from "react";
import { useHistory } from "react-router-dom";

import DetailDrawer, { DetailGrid, DetailSection } from "./DetailDrawer";
import DocumentPreview from "@/components/ApplicationForms/DocumentPreview";
import { AdminContext } from "@/context/AdminContext";
import ProjectServices from "@/services/ProjectServices";
import Button from "@/customer/components/ui/Button";
import StatusPill from "@/customer/components/ui/StatusPill";

const formatDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-GB", {
        day: "numeric",
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
 * Certification invoice — detail view.
 *
 * Deliberately separate from the platform's Customer Invoices screen: those
 * post into the sales ledger and carry its adjustment chain, while a
 * certification invoice is raised against a project and is fixed once issued.
 */
const InvoiceDetail = ({ row, open, onClose }) => {
  const history = useHistory();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;

  const authConfig = useMemo(
    () => ({
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${adminInfo?.token}`,
      },
      withCredentials: true,
    }),
    [adminInfo?.token],
  );

  if (!row) return null;

  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      title={`Invoice ${row.invoiceNumber || "—"}`}
      subtitle={`${row.projectNumber} · ${row.companyName || "—"}`}
      footer={
        <>
          {row.application ? (
            <Button
              variant="secondary"
              onClick={() =>
                history.push(`/applications/actions/${row.application}`)
              }
            >
              Open in Actions
            </Button>
          ) : null}
          <Button onClick={() => history.push(`/projects/${row._id}`)}>
            {row.projectNumber}
          </Button>
        </>
      }
    >
      <DetailSection title="Billed to">
        <DetailGrid
          items={[
            { label: "Company", value: row.companyName },
            { label: "Product", value: row.productName },
            { label: "Project", value: row.projectNumber },
            { label: "Application", value: row.applicationNumber },
            { label: "Quotation", value: row.quotationRef },
            { label: "Raised", value: formatDate(row.invoiceRaisedAt) },
          ]}
        />
      </DetailSection>

      <DetailSection title="Amount">
        <div className="epc-money">
          <div className="epc-money__row epc-money__row--total">
            <span>Total payable</span>
            <span className="epc-money__value">
              {money(row.contractValue, row.currency)}
            </span>
          </div>
          <div className="epc-money__row">
            <span>Status</span>
            <StatusPill status={row.invoiceStatus} />
          </div>
        </div>
      </DetailSection>

      <DetailSection title="Document">
        <DocumentPreview
          title="Tax Invoice"
          documentCode={row.invoiceNumber}
          audience="customer"
          state={row.invoiceStatus}
          note="The exact document the customer received."
          available={Boolean(row.invoiceNumber)}
          unavailableNote="No invoice has been raised for this project yet."
          defaultOpen
          fileName={`${row.invoiceNumber || "invoice"}.pdf`}
          fetchPdf={async () => {
            const res = await ProjectServices.getProjectInvoicePdf(
              row._id,
              authConfig,
            );
            return new Blob([res.data], { type: "application/pdf" });
          }}
        />
      </DetailSection>
    </DetailDrawer>
  );
};

export default InvoiceDetail;
