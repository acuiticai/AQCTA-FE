import React, { useEffect, useMemo, useState } from "react";
import { useHistory } from "react-router-dom";

import ApplicationServices from "@/services/ApplicationServices";
import FlexaQuotationPreview from "@/components/Certification/FlexaQuotationPreview";
import DocumentPreview from "@/components/ApplicationForms/DocumentPreview";
import StatusPill from "@/customer/components/ui/StatusPill";
import { DefinitionList } from "@/customer/components/ui/DetailBlocks";
import Button from "@/customer/components/ui/Button";
import { CustomModal } from "@/page-layouts";
import { notifyError, notifySuccess } from "@/utils/toast";

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

/**
 * Quotation stage.
 *
 * Approving the costing sheet issues the quotation. Certification uses the
 * Flexa Accounts Quotation template; inspection shows AQCTA-FOR-06-03.
 */
const QuotationStagePanel = ({ application, authHeaders, onChanged }) => {
  const history = useHistory();
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [revising, setRevising] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null); // "revise" | "accept"

  const isInspection = application?.type === "inspection";
  const costingFormKey = isInspection ? "FOR-06-02" : "FOR-01-06";
  const quotationFormKey = isInspection ? "FOR-06-03" : "FOR-01-07";

  const request = useMemo(
    () => ({ headers: authHeaders, withCredentials: true }),
    [authHeaders],
  );

  const load = async () => {
    setLoading(true);
    try {
      const res = await ApplicationServices.getApplicationForm(
        application._id,
        costingFormKey,
        request,
      );
      setSubmission(res?.data?.data?.submission || null);
    } catch {
      setSubmission(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await ApplicationServices.getApplicationForm(
          application._id,
          costingFormKey,
          request,
        );
        if (!cancelled) setSubmission(res?.data?.data?.submission || null);
      } catch {
        if (!cancelled) setSubmission(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [application._id, costingFormKey, request]);

  const handleRevise = async () => {
    if (revising) return;
    setRevising(true);
    try {
      const res = await ApplicationServices.reviseQuotation(
        application._id,
        {},
        request,
      );
      if (!res?.data?.status) {
        notifyError(res?.data?.message || "Could not open quotation for revision.");
        return;
      }
      notifySuccess(
        res.data.message ||
          "Costing unlocked. Edit the costing sheet and re-approve to resend.",
      );
      setConfirmAction(null);
      await load();
      if (typeof onChanged === "function") await onChanged();
      history.push(
        `/applications/actions/${application._id}?stage=costing`,
      );
    } catch (err) {
      notifyError(
        err?.response?.data?.message || "Could not open quotation for revision.",
      );
    } finally {
      setRevising(false);
    }
  };

  const handleAcceptOnBehalf = async () => {
    if (deciding) return;
    setDeciding(true);
    try {
      const res = await ApplicationServices.decideQuotation(
        application._id,
        { decision: "Accepted" },
        request,
      );
      if (!res?.data?.status) {
        notifyError(res?.data?.message || "Could not accept this quotation.");
        return;
      }
      notifySuccess(
        res.data.message || "Quotation accepted on behalf of the customer.",
      );
      setConfirmAction(null);
      await load();
      if (typeof onChanged === "function") await onChanged();
    } catch (err) {
      notifyError(
        err?.response?.data?.message || "Could not accept this quotation.",
      );
    } finally {
      setDeciding(false);
    }
  };

  if (loading) {
    return <p className="epc-section__desc">Loading quotation…</p>;
  }

  const quotationRef = submission?.quotationRef || "";
  const decision = submission?.quotationDecision || "";
  const canRevise = decision === "Rejected";
  const canAcceptOnBehalf =
    Boolean(quotationRef) &&
    !decision &&
    Boolean(submission?.releasedToCustomerAt);

  if (!quotationRef) {
    return (
      <p className="epc-notice epc-notice--info">
        <span>
          No quotation yet. One is issued automatically when the costing sheet
          is approved.
        </span>
      </p>
    );
  }

  const busy = revising || deciding;

  return (
    <div className="epc-stack">
      <div className="epc-recordhead">
        <span className="epc-recordhead__ref">{quotationRef}</span>
        <StatusPill
          status={
            decision ||
            application.quotationStatus ||
            "Awaiting customer response"
          }
        />
      </div>

      <DefinitionList
        items={[
          { label: "Issued", value: formatDate(submission?.releasedToCustomerAt) },
          {
            label: "Customer decision",
            value: decision
              ? formatDate(submission?.quotationDecisionAt)
              : "Pending",
          },
          { label: "Decided by", value: submission?.quotationDecisionBy || "—" },
        ]}
      />

      {submission?.quotationDecisionNote ? (
        <p className="epc-notice epc-notice--info">
          <span>{submission.quotationDecisionNote}</span>
        </p>
      ) : null}

      {canAcceptOnBehalf ? (
        <div className="epc-notice epc-notice--info">
          <span>
            Waiting for the customer to accept or decline. You can also record
            acceptance on their behalf if they confirmed outside the portal.
          </span>
          <div className="epc-actions" style={{ marginTop: 12 }}>
            <Button
              onClick={() => setConfirmAction("accept")}
              disabled={busy}
            >
              Accept on behalf of customer
            </Button>
          </div>
        </div>
      ) : null}

      {canRevise ? (
        <div className="epc-notice epc-notice--warning">
          <span>
            The customer rejected this quotation. Revise the costing sheet and
            re-approve to resend. An invoice is raised only after they accept.
          </span>
          <div className="epc-actions" style={{ marginTop: 12 }}>
            <Button
              onClick={() => setConfirmAction("revise")}
              disabled={busy}
            >
              Revise &amp; resend
            </Button>
          </div>
        </div>
      ) : null}

      {application.quotationStatus === "Revision Required" && !decision ? (
        <p className="epc-notice epc-notice--info">
          <span>
            Costing is unlocked for revision. Open the Costing Sheet stage,
            update fees, submit for approval, then re-approve to issue and
            email the updated quotation.
          </span>
          <div className="epc-actions" style={{ marginTop: 12 }}>
            <Button
              variant="secondary"
              onClick={() =>
                history.push(
                  `/applications/actions/${application._id}?stage=costing`,
                )
              }
            >
              Open costing sheet
            </Button>
          </div>
        </p>
      ) : null}

      {isInspection ? (
        <DocumentPreview
          title="Quotation"
          documentCode="AQCTA-FOR-06-03"
          audience="customer"
          state={decision || "Issued"}
          note="Official inspection quotation (AQCTA-FOR-06-03)."
          available
          defaultOpen
          fileName={`${quotationRef || "Inspection-Quotation"}.pdf`}
          fetchPdf={async () => {
            const res = await ApplicationServices.getApplicationFormPdf(
              application._id,
              quotationFormKey,
              request,
            );
            return new Blob([res.data], { type: "application/pdf" });
          }}
        />
      ) : (
        <FlexaQuotationPreview
          quotationId={submission?.salesQuotationId}
          quoteNumber={quotationRef}
        />
      )}

      <CustomModal
        open={confirmAction === "revise"}
        onClose={() => !revising && setConfirmAction(null)}
        title="Revise & resend quotation"
        width="480px"
        loading={revising}
        confirmText="Revise & resend"
        savingText="Opening…"
        onConfirm={handleRevise}
      >
        <p className="text-sm text-gray-700 leading-relaxed">
          Reopen the costing sheet so you can revise fees and resend the
          quotation to the customer? The same quotation number is kept. No
          invoice will be raised until they accept.
        </p>
      </CustomModal>

      <CustomModal
        open={confirmAction === "accept"}
        onClose={() => !deciding && setConfirmAction(null)}
        title="Accept on behalf of customer"
        width="480px"
        loading={deciding}
        confirmText="Accept quotation"
        savingText="Accepting…"
        onConfirm={handleAcceptOnBehalf}
      >
        <p className="text-sm text-gray-700 leading-relaxed">
          Record acceptance of{" "}
          <span className="font-semibold">{quotationRef}</span> on the
          customer&apos;s behalf? This opens the project and raises the invoice
          the same way as if they accepted in the portal.
        </p>
      </CustomModal>
    </div>
  );
};

export default QuotationStagePanel;
