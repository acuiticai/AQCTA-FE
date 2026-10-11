import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { notifyError, notifySuccess } from "@/utils/toast";
import ApplicationServices from "@/services/ApplicationServices";
import SignaturePad from "@/components/ApplicationForms/SignaturePad";
import SigningPanel from "@/components/ApplicationForms/SigningPanel";
import FormFieldRenderer from "@/components/ApplicationForms/FormFieldRenderer";
import { isFieldVisible } from "@/components/ApplicationForms/fieldVisibility";
import { applyComputations } from "@/components/ApplicationForms/computations";
import DocumentPreview from "@/components/ApplicationForms/DocumentPreview";
import FlexaQuotationPreview from "@/components/Certification/FlexaQuotationPreview";
import Button from "@/customer/components/ui/Button";
import StatusPill from "@/customer/components/ui/StatusPill";
import { Card, CardHeader } from "@/customer/components/ui/Card";
import { TextareaField } from "@/customer/components/ui/Field";
import {
  AlertIcon,
  CheckCircleIcon,
  ClockIcon,
} from "@/customer/components/ui/icons";

/** A short explanation of the state a stage is in. */
const Notice = ({ tone = "info", icon: Icon, children }) => (
  <p className={`epc-notice epc-notice--${tone}`}>
    {Icon ? <Icon size={16} className="epc-notice__icon" /> : null}
    <span>{children}</span>
  </p>
);

/**
 * One stage of the certification workflow.
 *
 * Every stage works the same way: one system user prepares the form, a second
 * approves or rejects it, and approval may generate a document. What differs
 * between stages — the status field, the prerequisite, whether approval has an
 * outcome, what it generates — is decided server-side, so this component only
 * reflects what it is told and is reused unchanged by each new stage.
 */
const StageFormCard = ({
  application,
  authHeaders,
  canUpdate,
  onChanged,
  formKey,
  statusField = "contractReviewStatus",
}) => {
  const applicationId = application?._id;

  const [state, setState] = useState(null);
  const [values, setValues] = useState({});
  const [invalidKeys, setInvalidKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  /* Collected on the form itself when a document is issued rather than
     approved: the issuer's mark. Who the assignment letter appoints is not
     asked here — that appointment is made on the project, and this reads it. */
  const [issueSignature, setIssueSignature] = useState("");
  const preparedSigSeeded = useRef(false);
  const [rejectReason, setRejectReason] = useState("");
  const [notFound, setNotFound] = useState(false);

  const closeReject = useCallback(() => {
    setRejectOpen(false);
    setRejectReason("");
  }, []);

  useEffect(() => {
    if (!rejectOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") closeReject();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [rejectOpen, closeReject]);

  const request = useMemo(
    () => ({ headers: authHeaders, withCredentials: true }),
    [authHeaders],
  );

  const [docVersion, setDocVersion] = useState(0);

  const load = useCallback(async () => {
    if (!applicationId) return;
    setLoading(true);
    try {
      const res = await ApplicationServices.getApplicationForm(
        applicationId,
        formKey,
        request,
      );
      if (res.data?.status) {
        setState(res.data.data);
        setValues(res.data.data.values || {});
        setExtraRows({});
        setNotFound(false);
        preparedSigSeeded.current = false;
        setIssueSignature("");
        // Any already-open document preview refetches rather than continuing
        // to show what was true before this reload.
        setDocVersion((v) => v + 1);
      } else {
        setNotFound(true);
      }
    } catch (error) {
      // A missing template is a configuration gap, not a page error.
      if (error?.response?.status === 404) setNotFound(true);
      else
        notifyError(
          error?.response?.data?.message || "Failed to load this stage",
        );
    } finally {
      setLoading(false);
    }
  }, [applicationId, request, formKey]);

  useEffect(() => {
    load();
  }, [load]);

  const handleChange = (key, value) => {
    setValues((prev) => {
      const next = { ...prev, [key]: value };
      // Clear anything the new value hides, so a decline reason typed and then
      // abandoned does not linger in state and get sent back on save.
      for (const field of state?.template?.fields || []) {
        if (!isFieldVisible(field, next)) next[field.key] = "";
      }
      /* Totals are derived, so they have to move with the entries rather than
         waiting for the next save to bring them back from the server. */
      return applyComputations(formKey, next);
    });
    setInvalidKeys((prev) => prev.filter((k) => k !== key));
  };

  /* Repeatable rows are added and removed locally; they only become real when
     the form is saved, like every other value on it. */
  const [extraRows, setExtraRows] = useState({});
  const rowCounts = { ...(state?.repeatableRows || {}), ...extraRows };

  const addRow = (section) => {
    const max = section.repeatable?.max || 8;
    setExtraRows((prev) => {
      const current = prev[section.key] ?? state?.repeatableRows?.[section.key] ?? 0;
      return { ...prev, [section.key]: Math.min(current + 1, max) };
    });
  };

  const removeRow = (section, index) => {
    const { keyPrefix, fields = [] } = section.repeatable || {};
    setValues((prev) => {
      const next = { ...prev };
      for (const field of fields) delete next[`${keyPrefix}_${index}_${field.key}`];
      return next;
    });
    setExtraRows((prev) => {
      const current = prev[section.key] ?? state?.repeatableRows?.[section.key] ?? 0;
      return { ...prev, [section.key]: Math.max(current - 1, 0) };
    });
  };

  const persist = async (submit) => {
    setSaving(submit ? "submit" : "draft");
    setInvalidKeys([]);
    try {
      const res = await ApplicationServices.saveApplicationForm(
        applicationId,
        formKey,
        {
          values,
          submit,
          /* Signature: audit issue pads, or inspection costing preparer mark. */
          ...((submit || formKey === "FOR-06-02") && issueSignature
            ? { signature: { dataUrl: issueSignature } }
            : {}),
        },
        request,
      );
      if (res.data?.status) {
        notifySuccess(res.data.message || "Saved");
        if (submit) {
          setIssueSignature("");
          const notice = res.data.notice;
          if (notice && notice.sent === false && notice.reason) {
            notifyError(`Issued, but nobody was notified: ${notice.reason}`);
          } else if (notice?.warning) {
            // Sent, but not with everything it said it carried.
            notifyError(notice.warning);
          }
        }
        await load();
        if (submit) onChanged?.();
      }
    } catch (error) {
      const data = error?.response?.data;
      // Prefer field keys; fall back to label→key for older API responses.
      if (Array.isArray(data?.fields) && data.fields.length) {
        const templateFields = state?.template?.fields || [];
        const knownKeys = new Set(templateFields.map((f) => f.key));
        const byLabel = new Map(templateFields.map((f) => [f.label, f.key]));
        setInvalidKeys(
          data.fields.map((f) =>
            knownKeys.has(f) ? f : byLabel.get(f) || f,
          ),
        );
        notifyError("Complete every required field before submitting.");
        window.setTimeout(() => {
          document
            .querySelector(".epc-root .is-invalid")
            ?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 80);
      } else {
        notifyError(data?.message || "Could not save this form");
      }
    } finally {
      setSaving("");
    }
  };

  const decide = async (decision) => {
    if (decision === "reject" && !rejectReason.trim()) {
      notifyError("Give a reason so the preparer knows what to change");
      return;
    }
    setSaving(decision);
    try {
      const res = await ApplicationServices.decideApplicationForm(
        applicationId,
        formKey,
        { decision, reason: rejectReason },
        request,
      );
      if (res.data?.status) {
        notifySuccess(res.data.message || "Decision recorded");

        /* The decision stands even if a message failed, so any failure is
           reported separately — and only for messages this stage actually
           tries to send. `notification` is null when the stage produces no
           customer document, which is not a failure. */
        if (decision === "approve") {
          const toCustomer = res.data.data?.notification;
          if (toCustomer && toCustomer.sent === false) {
            notifyError(
              `Approved, but the customer document was not sent: ${
                toCustomer.reason || "the mail service did not accept it"
              }`,
            );
          }
          const toManagement = res.data.data?.internalNotice;
          if (toManagement && toManagement.sent === false && toManagement.reason) {
            notifyError(
              `Approved, but management was not notified: ${toManagement.reason}`,
            );
          }
        }
        if (decision === "reject") {
          const notice = res.data.notice;
          if (notice && notice.sent === false && notice.reason) {
            notifyError(
              `Rejected, but the preparer was not notified: ${notice.reason}`,
            );
          }
        }
        closeReject();
        await load();
        onChanged?.();
      }
    } catch (error) {
      notifyError(
        error?.response?.data?.message || "Could not record the decision",
      );
    } finally {
      setSaving("");
    }
  };

  /* The preview component owns the blob URL lifecycle; this only fetches. */
  const fetchPdf = useCallback(
    async (formKey) => {
      const res = await ApplicationServices.getApplicationFormPdf(
        applicationId,
        formKey,
        request,
      );
      return new Blob([res.data], { type: "application/pdf" });
    },
    [applicationId, request],
  );

  /* Must run on every render (before any early return) — inspection costing
     and appointment letter collect the issuer mark on the sheet itself. */
  const sheetOwnsIssuerSignature =
    formKey === "FOR-06-02" ||
    formKey === "FOR-06-06" ||
    formKey === "FOR-01-10" ||
    formKey === "FOR-01-08" ||
    formKey === "FOR-01-09" ||
    formKey === "FOR-01-11" ||
    formKey === "FOR-01-12" ||
    formKey === "FOR-01-13" ||
    formKey === "FOR-01-15" ||
    formKey === "FOR-01-16" ||
    formKey === "FOR-01-14" ||
    formKey === "FOR-01-17" ||
    formKey === "FOR-01-18";
  const needsPreparedSignature = sheetOwnsIssuerSignature;
  const storedPreparerSignature = String(
    state?.preparerSignatureDataUrl || "",
  ).trim();
  const storedAuditorSignature = String(
    state?.auditorSignatureDataUrl || "",
  ).trim();
  const storedCustomerSignature = String(
    state?.customerSignatureDataUrl || "",
  ).trim();

  useEffect(() => {
    if (!needsPreparedSignature || preparedSigSeeded.current) return;
    if (!storedPreparerSignature) return;
    preparedSigSeeded.current = true;
    setIssueSignature(storedPreparerSignature);
  }, [needsPreparedSignature, storedPreparerSignature]);

  if (loading) {
    return <p className="epc-section__desc">Loading…</p>;
  }

  if (notFound || !state) {
    return (
      <Notice tone="warn">
        No template is configured for {formKey} yet. Templates are seeded when
        the API starts — restart the server, then check Settings → Dynamic
        Forms.
      </Notice>
    );
  }

  const {
    template,
    submission,
    permissions,
    editableKeys,
    placeholders,
    signoffPreview,
    documents,
    prerequisite,
    generatesCustomerDocument,
  } = state;

  /* A stage whose prerequisite is unmet shows why, not an unusable form. */
  if (prerequisite && prerequisite.met === false && !submission) {
    return (
      <Notice tone="warn" icon={ClockIcon}>
        {prerequisite.message}
      </Notice>
    );
  }
  const status = submission?.status || "Not Started";
  const outcome = submission?.outcome;
  const reviewStatus = application?.[statusField] || "Not Started";
  const isApproved = status === "Approved";
  const isPending = status === "Pending Approval";
  /* A form the server says is this person's own assigned work is authorised by
     the assignment itself — an auditor's / inspector's role carries no module
     Update permission, and gating on one here would show them a form they are
     the only person allowed to fill in and then not let them type in it. */
  const canPrepare =
    (canUpdate || permissions?.ownWork) && permissions?.canPrepare;
  const canApprove = canUpdate && permissions?.canApprove;
  const canReturn =
    canUpdate &&
    (permissions?.canReturn !== undefined
      ? permissions.canReturn
      : permissions?.canApprove);
  const busy = Boolean(saving);

  /* An audit-phase form is issued and signed in one action rather than sent
     for approval, so the issuer's mark is collected on the form itself. */
  const signing = state?.signing || null;
  const issuerBlock = (signing?.blocks || []).find((b) => b.signedOnIssue);
  const needsIssuerSignature = Boolean(issuerBlock) && !issuerBlock.signed;
  /* The assignment letter appoints whoever the project is assigned to. It is
     chosen there, not here, so the letter cannot name a different person from
     the one every later stage is scoped to. */
  const namesAnAuditor = formKey === "FOR-01-10";
  const namedAuditorMissing = namesAnAuditor && !signing?.assignedAuditor;
  const namesAnInspector = formKey === "FOR-06-06";
  const namedInspectorMissing =
    namesAnInspector && !signing?.assignedInspector;
  const namedAssigneeMissing = namedAuditorMissing || namedInspectorMissing;

  const profileSignature = String(signing?.actorSignature || "").trim();

  /* A form still open but not this person's to fill in reads as broken unless
     it says whose it is — the fields alone just look mysteriously empty. */
  const readOnlyBecauseOthers =
    !canPrepare &&
    Boolean(permissions?.preparedByOther) &&
    !["Signed", "Completed", "Approved"].includes(status);

  return (
    <div className="epc-stack">
      <div className="epc-recordhead">
        <StatusPill status={status} />
        {reviewStatus && reviewStatus !== status ? (
          <StatusPill status={reviewStatus} />
        ) : null}
      </div>

      {status === "Rejected" && submission?.rejectionReason ? (
        <Notice tone="stop">
          <strong>
            Rejected by{" "}
            {submission.returnedBy?.name ||
              submission.approvedBy?.name ||
              "the reviewer"}
            :
          </strong>{" "}
          {submission.rejectionReason}
        </Notice>
      ) : null}

      {status === "Rejected" && canPrepare ? (
        <Notice tone="info">
          Correct the entries using the reason above, then resubmit for
          approval.
        </Notice>
      ) : null}

      {status === "Declined" && canPrepare ? (
        <Notice tone="info">
          {signing?.auditorDecisionNote
            ? `Declined — ${signing.auditorDecisionNote}. `
            : "This assignment was declined. "}
          Confirm the auditor above, then sign and re-issue a new letter.
        </Notice>
      ) : null}

      {isPending && permissions?.blockedBecauseSamePreparer ? (
        <Notice tone="warn" icon={AlertIcon}>
          You prepared this checklist, so you cannot also approve it. A second
          system user has to review it.
        </Notice>
      ) : null}

      {isPending &&
      formKey === "FOR-06-02" &&
      permissions?.loa &&
      !permissions?.blockedBecauseSamePreparer ? (
        <Notice tone={permissions.loa.allowed ? "info" : "warn"} icon={AlertIcon}>
          <strong>LOA:</strong> Final price RM{" "}
          {permissions.loa.priceDisplay || "—"} requires{" "}
          <strong>{permissions.loa.requiredLabel}</strong>
          {permissions.loa.allowed
            ? permissions.loa.actorRole
              ? ` — your role (${permissions.loa.actorRole}) may approve.`
              : " — you may approve."
            : permissions.loa.message
              ? ` — ${permissions.loa.message}`
              : " — your role cannot approve this amount."}
        </Notice>
      ) : null}

      {isPending && canApprove ? (
        <Notice tone="info">
          Prepared by <strong>{submission?.preparedBy?.name || "—"}</strong>.
          Review the entries below, then approve or reject it with a reason.
        </Notice>
      ) : null}

      {isApproved ? (
        <Notice
          tone={
            !outcome || outcome === "accept" ? "ok" : "stop"
          }
          icon={
            !outcome || outcome === "accept" ? CheckCircleIcon : AlertIcon
          }
        >
          Approved by <strong>{submission?.approvedBy?.name || "—"}</strong>
          {outcome === "accept"
            ? " — accepted to undertake this request."
            : outcome === "decline"
              ? ` — declined${
                  submission?.outcomeReason
                    ? ` (${submission.outcomeReason})`
                    : ""
                }.`
              : "."}{" "}
          {generatesCustomerDocument
            ? submission?.releasedToCustomerAt
              ? "The document has been sent to the customer."
              : "The customer document was not sent — check the notification event recipients."
            : "Recorded internally; nothing is sent to the customer at this stage."}
        </Notice>
      ) : null}

      {readOnlyBecauseOthers ? (
        <Notice tone="info" icon={AlertIcon}>
          {permissions.preparedByOther}
        </Notice>
      ) : null}

      {/* The letter appoints whoever holds the job. Saying so here is what
          stops this reading as a missing field. */}
      {namesAnAuditor && canPrepare ? (
        <Notice tone={namedAuditorMissing ? "warn" : "info"} icon={AlertIcon}>
          {namedAuditorMissing
            ? "No auditor is assigned to this project yet. Assign one above before issuing this letter."
            : `This letter appoints ${signing.assignedAuditorName}, the auditor assigned to this project. Change the assignment above to appoint somebody else.`}
        </Notice>
      ) : null}

      {namesAnInspector && canPrepare ? (
        <Notice tone={namedInspectorMissing ? "warn" : "info"} icon={AlertIcon}>
          {namedInspectorMissing
            ? "No inspector is assigned to this project yet. Assign one above before issuing this letter."
            : `This letter appoints ${signing.assignedInspectorName}, the inspector assigned to this project. Change the assignment above to appoint somebody else.`}
        </Notice>
      ) : null}

      <FormFieldRenderer
        template={template}
        values={values}
        editableKeys={editableKeys}
        invalidKeys={invalidKeys}
        readOnly={!canPrepare}
        placeholders={placeholders}
        preview={Boolean(signoffPreview) && canPrepare}
        repeatableRows={rowCounts}
        onAddRow={addRow}
        onRemoveRow={removeRow}
        onChange={handleChange}
        documentTitle={
          state?.formPresentation?.formHeading ||
          state?.formPresentation?.title ||
          ""
        }
        documentCode={
          state?.formPresentation?.documentCode || template?.documentCode || ""
        }
        feeCatalogItems={state?.feeCatalogItems || []}
        serviceOptions={state?.serviceOptions || []}
        activityCatalog={state?.activityCatalog || []}
        preparedSignature={needsPreparedSignature ? issueSignature : ""}
        onPreparedSignatureChange={
          needsPreparedSignature ? setIssueSignature : undefined
        }
        profileSignature={needsPreparedSignature ? profileSignature : ""}
        preparedSignatureUrl={storedPreparerSignature}
        auditorSignatureUrl={storedAuditorSignature}
        customerSignatureUrl={storedCustomerSignature}
        attendanceSyncKey={`${submission?._id || "new"}:${submission?.updatedAt || submission?.status || "empty"}:${docVersion}`}
        attachmentUrlFor={(purpose) =>
          ApplicationServices.formAttachmentUrl(applicationId, formKey, purpose)
        }
        fetchAttachmentBlob={async (purpose) => {
          const res = await ApplicationServices.getFormAttachment(
            applicationId,
            formKey,
            purpose,
            request,
          );
          return res.data;
        }}
      />

      {needsIssuerSignature && canPrepare && !sheetOwnsIssuerSignature ? (
        <SignaturePad
          value={issueSignature}
          onChange={setIssueSignature}
          profileSignature={profileSignature}
          label={`${issuerBlock.label} signature`}
          hint="Signing issues the document. It cannot be edited afterwards."
        />
      ) : null}

      <div className="epc-actions">
        {canPrepare ? (
          <>
            <Button variant="secondary" disabled={busy} onClick={() => persist(false)}>
              {saving === "draft" ? "Saving…" : "Save draft"}
            </Button>
            <Button
              disabled={
                busy ||
                (needsIssuerSignature && !issueSignature) ||
                namedAssigneeMissing
              }
              onClick={() => persist(true)}
              title={
                namedAuditorMissing
                  ? "Assign an auditor to this project before issuing the letter"
                  : namedInspectorMissing
                    ? "Assign an inspector to this project before issuing the letter"
                  : needsIssuerSignature && !issueSignature
                    ? "Sign the document before issuing it"
                    : ""
              }
            >
              {saving === "submit"
                ? signing
                  ? "Issuing…"
                  : status === "Rejected"
                    ? "Resubmitting…"
                    : "Submitting…"
                : signing
                  ? status === "Declined"
                    ? "Sign and re-issue"
                    : "Sign and issue"
                  : status === "Rejected"
                    ? "Resubmit for approval"
                    : "Submit for approval"}
            </Button>
          </>
        ) : null}

        {canApprove ? (
          <Button disabled={busy} onClick={() => decide("approve")}>
            {saving === "approve" ? "Approving…" : "Approve"}
          </Button>
        ) : null}

        {canReturn ? (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => setRejectOpen(true)}
          >
            Reject
          </Button>
        ) : null}
      </div>

      {/* Who this document is still waiting on, and the means to answer if
          that is you. */}
      <SigningPanel
        applicationId={applicationId}
        formKey={formKey}
        signing={signing}
        status={status}
        request={request}
        canRecordOnBehalf={Boolean(canUpdate)}
        onChanged={async () => {
          await load();
          onChanged?.();
        }}
      />

      {/* Documents for this stage. The approver sees the customer letter here
          before deciding, so nothing goes out unread.
          Quotation (FOR-01-07) uses the Flexa Accounts Quotation DocumentTemplate
          preview — not the parked AQCTA master PDF. */}
      {(documents || []).length ? (
        <Card>
          <CardHeader
            title="Documents"
            subtitle="What this stage produces, exactly as it is issued."
          />
          {documents.map((doc) =>
            doc.formKey === "FOR-01-07" ? (
              <div key={doc.formKey} className="epc-stack" style={{ marginTop: 12 }}>
                <p className="epc-section__desc">
                  {doc.title}
                  {doc.documentCode ? ` · ${doc.documentCode}` : ""} — Flexa
                  Quotation preview
                  {submission?.quotationRef
                    ? ` (${submission.quotationRef})`
                    : ""}
                </p>
                {submission?.quotationRef || submission?.salesQuotationId ? (
                  <FlexaQuotationPreview
                    quotationId={submission?.salesQuotationId}
                    quoteNumber={submission?.quotationRef}
                  />
                ) : (
                  <p className="epc-notice epc-notice--info">
                    <span>
                      Quotation appears here after the costing sheet is approved
                      and mirrored into Finance → Quotations.
                    </span>
                  </p>
                )}
              </div>
            ) : (
              <DocumentPreview
                key={doc.formKey}
                refreshToken={docVersion}
                title={doc.title}
                documentCode={doc.documentCode}
                audience={doc.audience}
                state={doc.state}
                note={
                  doc.archiveNote ? `${doc.note} ${doc.archiveNote}` : doc.note
                }
                warn={Boolean(doc.archiveNote) && !doc.archived}
                available={doc.available}
                unavailableNote={
                  doc.formKey === formKey
                    ? "Available once the form is saved"
                    : "Generated once the form is submitted"
                }
                /* Open the customer letter automatically for the approver — it
                   is the thing they are actually deciding about. */
                defaultOpen={
                  doc.formKey !== formKey && (canApprove || isApproved)
                }
                fetchPdf={() => fetchPdf(doc.formKey)}
                fileName={`${doc.documentCode}.pdf`}
              />
            ),
          )}
        </Card>
      ) : null}

      {rejectOpen && canReturn ? (
        <div
          className="epc-modal"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeReject();
          }}
        >
          <div
            className="epc-modal__panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="epc-return-preparer-title"
          >
            <h2 className="epc-modal__title" id="epc-return-preparer-title">
              Reject and return
            </h2>
            <p className="epc-modal__body">
              Give a reason. This sends the form back so it can be corrected
              and resubmitted.
            </p>
            <div style={{ marginTop: 16 }}>
              <TextareaField
                label="Reason"
                rows={3}
                autoFocus
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Tell them what to correct"
              />
            </div>
            <div className="epc-modal__actions">
              <Button variant="secondary" disabled={busy} onClick={closeReject}>
                Cancel
              </Button>
              <button
                type="button"
                className="epc-btn epc-btn--danger"
                disabled={busy}
                onClick={() => decide("reject")}
              >
                {saving === "reject" ? "Rejecting…" : "Reject"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default StageFormCard;
