import React, { useEffect, useRef, useState } from "react";
import { useHistory, useLocation } from "react-router-dom";

import PortalLayout, { PageHeading } from "../../layouts/PortalLayout";
import { Card, CardHeader } from "../../components/ui/Card";
import DataTable from "../../components/ui/DataTable";
import StatusPill from "../../components/ui/StatusPill";
import Button from "../../components/ui/Button";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import CustomerQuotationPreviewModal from "../../components/ui/CustomerQuotationPreviewModal";
import DocumentViewerModal from "../../components/ui/DocumentViewerModal";
import AcceptQuotationDialog from "../../components/ui/AcceptQuotationDialog";
import CustomerQuotationServices from "../../services/quotationService";
import CustomerApplicationServices from "../../services/applicationService";
import { useAccount } from "../../context/AccountContext";
import { customerPath } from "../../routes/paths";

/** Authorised-representative defaults from the signed-in customer session. */
const applicantDefaultsFromAccount = (account) => {
  const primary = Array.isArray(account?.contacts) ? account.contacts[0] : null;
  return {
    name:
      account?.contactPerson ||
      primary?.name ||
      account?.name ||
      "",
    position:
      account?.contactPosition ||
      primary?.position ||
      primary?.designation ||
      "",
    signature:
      account?.eSignature ||
      account?.signatureDataUrl ||
      account?.signature ||
      "",
    companyChop:
      account?.companyChop ||
      account?.companyStamp ||
      "",
  };
};

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

const blobFromResponse = (res) =>
  new Blob([res.data], { type: res.headers?.["content-type"] || "application/pdf" });

/**
 * Customer Portal → Quotation
 *
 * Certification quotes use the Flexa Accounts Quotation DocumentTemplate.
 * Inspection quotes show the official AQCTA-FOR-06-03 PDF.
 *
 * Deep link from the issued email: `/customer/quotation?ref=QT-…&action=approve`
 * opens the Accept confirmation for that quotation when it still needs a decision.
 */
export default function Quotations() {
  const history = useHistory();
  const location = useLocation();
  const account = useAccount();
  const applicantDefaults = applicantDefaultsFromAccount(account);
  const deepLinkHandled = useRef(false);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [decidingRef, setDecidingRef] = useState("");
  const [decidingAction, setDecidingAction] = useState(""); // "Accepted" | "Rejected"
  const [pendingDecision, setPendingDecision] = useState(null); // { row, decision }
  const [viewingRow, setViewingRow] = useState(null);

  const load = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await CustomerQuotationServices.getMyQuotations();
      setRows(Array.isArray(res?.data?.data) ? res.data.data : []);
    } catch (err) {
      setLoadError(err?.response?.data?.message || "Failed to load quotations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  /* Email "Review & Approve" link lands here with ?ref=&action=approve. */
  useEffect(() => {
    if (loading || deepLinkHandled.current || !rows.length) return;
    const params = new URLSearchParams(location.search || "");
    const ref = String(params.get("ref") || "").trim();
    const action = String(params.get("action") || "").trim().toLowerCase();
    if (!ref || action !== "approve") return;

    deepLinkHandled.current = true;
    const match = rows.find(
      (row) => String(row.quotationRef || "").toLowerCase() === ref.toLowerCase()
    );
    if (match?.needsDecision) {
      setPendingDecision({ row: match, decision: "Accepted" });
    } else if (match) {
      setViewingRow(match);
    }

    history.replace(customerPath.quotation);
  }, [loading, rows, location.search, history]);

  const decide = async (applicant = null) => {
    if (!pendingDecision) return;
    const { row, decision } = pendingDecision;
    setPendingDecision(null);
    setDecidingRef(row.quotationRef);
    setDecidingAction(decision);
    try {
      const payload = { decision };
      if (applicant) {
        payload.applicant = {
          name: applicant.name || "",
          position: applicant.position || "",
          signatureDataUrl: applicant.signatureDataUrl || "",
          companyChop: applicant.companyChop || "",
        };
      }
      await CustomerApplicationServices.decideMyQuotation(
        row.applicationId,
        payload,
      );
      await load();
    } catch (err) {
      setLoadError(err?.response?.data?.message || "Could not record your response.");
    } finally {
      setDecidingRef("");
      setDecidingAction("");
    }
  };

  const isInspectionQuote = (row) =>
    row?.serviceType === "inspection" || row?.quotationFormKey === "FOR-06-03";

  const columns = [
    {
      key: "quotationRef",
      header: "Quotation",
      width: "14%",
      render: (row) => (
        <button type="button" className="epc-rowlink" onClick={() => setViewingRow(row)}>
          {row.quotationRef}
        </button>
      ),
    },
    {
      key: "productName",
      header: "Application",
      width: "24%",
      render: (row) => (
        <button
          type="button"
          className="epc-rowlink"
          onClick={() => history.push(`${customerPath.applications}/${row.applicationId}`)}
        >
          <div>{row.productName || "—"}</div>
          <div className="epc-muted-small">{row.applicationNumber}</div>
        </button>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      width: "14%",
      render: (row) => formatMoney(row.amount, row.currency),
    },
    {
      key: "decision",
      header: "Status",
      width: "14%",
      render: (row) =>
        row.decision ? (
          <StatusPill status={row.decision} />
        ) : (
          <StatusPill status="Awaiting your decision" />
        ),
    },
    { key: "issuedAt", header: "Issued", width: "14%", render: (row) => formatDate(row.issuedAt) },
    {
      key: "actions",
      header: "",
      width: "20%",
      render: (row) => (
        <div className="epc-quote-actions">
          <Button size="sm" variant="secondary" onClick={() => setViewingRow(row)}>
            View
          </Button>
          {row.needsDecision ? (
            <>
              <Button
                size="sm"
                disabled={Boolean(decidingRef)}
                onClick={() => setPendingDecision({ row, decision: "Accepted" })}
              >
                {decidingRef === row.quotationRef && decidingAction === "Accepted"
                  ? "Accepting…"
                  : "Accept"}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={Boolean(decidingRef)}
                onClick={() => setPendingDecision({ row, decision: "Rejected" })}
              >
                {decidingRef === row.quotationRef && decidingAction === "Rejected"
                  ? "Declining…"
                  : "Decline"}
              </Button>
            </>
          ) : null}
        </div>
      ),
    },
  ];

  const viewingInspection = viewingRow && isInspectionQuote(viewingRow);

  return (
    <PortalLayout>
      <PageHeading
        title="Quotation"
        subtitle="Quotations issued for your applications. Accepting one starts the project."
      />

      <Card>
        <CardHeader
          title="Quotations"
          subtitle={loading ? "Loading…" : `${rows.length} total quotation${rows.length === 1 ? "" : "s"}`}
        />
        {loadError ? (
          <p className="epc-field__error" role="alert" style={{ padding: "12px 16px" }}>
            {loadError}
          </p>
        ) : null}

        {!loading && rows.length === 0 && !loadError ? (
          <div className="epc-placeholder" style={{ padding: "32px 16px" }}>
            <p className="epc-placeholder__title">No quotations yet</p>
            <p className="epc-placeholder__text">
              A quotation appears here once AQCTA approves the costing for one
              of your applications.
            </p>
          </div>
        ) : (
          <DataTable rowKey="quotationRef" columns={columns} rows={rows} />
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(pendingDecision) && !isInspectionQuote(pendingDecision?.row)}
        title={
          pendingDecision?.decision === "Accepted"
            ? "Accept this quotation?"
            : "Decline this quotation?"
        }
        body={
          pendingDecision?.decision === "Accepted"
            ? "This confirms the fees shown, starts your project, and raises the invoice. This cannot be undone."
            : "AQCTA will be notified so they can revise the quotation and send it back to you. No invoice is raised unless you accept."
        }
        confirmLabel={pendingDecision?.decision === "Accepted" ? "Accept quotation" : "Decline quotation"}
        tone={pendingDecision?.decision === "Accepted" ? "primary" : "danger"}
        onConfirm={() => decide()}
        onCancel={() => setPendingDecision(null)}
      />

      <AcceptQuotationDialog
        open={Boolean(pendingDecision) && isInspectionQuote(pendingDecision?.row)}
        decision={pendingDecision?.decision || "Accepted"}
        quotationRef={pendingDecision?.row?.quotationRef || ""}
        defaultName={applicantDefaults.name}
        defaultPosition={applicantDefaults.position}
        defaultSignature={applicantDefaults.signature}
        defaultCompanyChop={applicantDefaults.companyChop}
        busy={Boolean(decidingRef)}
        onCancel={() => setPendingDecision(null)}
        onSubmit={(applicant) => decide(applicant)}
      />

      <CustomerQuotationPreviewModal
        open={Boolean(viewingRow) && !viewingInspection}
        quoteNumber={viewingRow?.quotationRef || ""}
        title={viewingRow ? `Quotation ${viewingRow.quotationRef}` : ""}
        subtitle={
          viewingRow
            ? `${viewingRow.applicationNumber} — ${viewingRow.productName}`
            : ""
        }
        onClose={() => setViewingRow(null)}
      />

      <DocumentViewerModal
        open={Boolean(viewingInspection)}
        title={viewingRow ? `Quotation ${viewingRow.quotationRef}` : "Quotation"}
        subtitle={
          viewingRow
            ? [
                "AQCTA-FOR-06-03",
                viewingRow.applicationNumber,
                viewingRow.productName,
              ]
                .filter(Boolean)
                .join(" · ")
            : ""
        }
        fileName={`${String(viewingRow?.quotationRef || "quotation").replace(/[^\w.\-]+/g, "_")}.pdf`}
        fetchPdf={
          viewingInspection
            ? async () => {
                const res =
                  await CustomerApplicationServices.getMyApplicationDocumentPdf(
                    viewingRow.applicationId,
                    viewingRow.quotationFormKey || "FOR-06-03",
                  );
                return blobFromResponse(res);
              }
            : undefined
        }
        onClose={() => setViewingRow(null)}
      />
    </PortalLayout>
  );
}
