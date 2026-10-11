import React from "react";
import { useHistory } from "react-router-dom";

import DetailDrawer, { DetailGrid, DetailSection } from "./DetailDrawer";
import FlexaQuotationPreview from "@/components/Certification/FlexaQuotationPreview";
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

const money = (value) =>
  `RM ${Number(value || 0).toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/**
 * Certification quotation — detail drawer.
 * Document preview matches Flexa `/quotations/view/:id`.
 */
const QuotationDetail = ({ row, open, onClose }) => {
  const history = useHistory();

  if (!row) return null;

  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      title={`Quotation ${row.quotationRef || "—"}`}
      subtitle={`${row.applicationNumber} · ${row.companyName || "—"}`}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() =>
              history.push(`/applications/actions/${row.application}`)
            }
          >
            Open in Actions
          </Button>
          {row.projectId ? (
            <Button onClick={() => history.push(`/projects/${row.projectId}`)}>
              {row.projectNumber}
            </Button>
          ) : null}
        </>
      }
    >
      <DetailSection title="Customer">
        <DetailGrid
          items={[
            { label: "Company", value: row.companyName },
            { label: "Contact", value: row.contactPerson },
            { label: "Email", value: row.customerEmail },
            { label: "Application", value: row.applicationNumber },
            { label: "Product", value: row.productName },
            { label: "Standard", value: row.standardNumber },
          ]}
        />
      </DetailSection>

      <DetailSection title="Amount">
        <div className="epc-money">
          <div className="epc-money__row">
            <span>Subtotal</span>
            <span className="epc-money__value">{money(row.subtotalValue)}</span>
          </div>
          {row.discountValue > 0 ? (
            <div className="epc-money__row">
              <span>Discount</span>
              <span className="epc-money__value">
                − {money(row.discountValue)}
              </span>
            </div>
          ) : null}
          {row.taxTotalValue > 0 ? (
            <div className="epc-money__row">
              <span>Tax (SST / others)</span>
              <span className="epc-money__value">
                {money(row.taxTotalValue)}
              </span>
            </div>
          ) : null}
          <div className="epc-money__row epc-money__row--total">
            <span>Grand total</span>
            <span className="epc-money__value">{money(row.grandTotalValue)}</span>
          </div>
        </div>
      </DetailSection>

      <DetailSection title="Status">
        <div style={{ marginBottom: 14 }}>
          <StatusPill status={row.quotationDecision || "Awaiting customer"} />
        </div>
        <DetailGrid
          items={[
            { label: "Issued to customer", value: formatDate(row.issuedAt) },
            { label: "Costing approved by", value: row.approvedByName },
            { label: "Prepared by", value: row.preparedByName },
            {
              label: "Customer decision",
              value: row.quotationDecision
                ? `${row.quotationDecision} · ${formatDate(row.quotationDecisionAt)}`
                : "Awaiting response",
            },
            { label: "Decided by", value: row.quotationDecisionBy },
            { label: "Project", value: row.projectNumber },
          ]}
        />
        {row.quotationDecisionNote ? (
          <p className="epc-notice epc-notice--info" style={{ marginTop: 14 }}>
            <span>{row.quotationDecisionNote}</span>
          </p>
        ) : null}
      </DetailSection>

      <DetailSection title="Document">
        <FlexaQuotationPreview
          quotationId={row.salesQuotationId}
          quoteNumber={row.quotationRef}
        />
      </DetailSection>
    </DetailDrawer>
  );
};

export default QuotationDetail;
