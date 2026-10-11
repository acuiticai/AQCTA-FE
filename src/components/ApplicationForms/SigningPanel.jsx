import React, { useMemo, useState } from "react";

import SignaturePad from "./SignaturePad";
import Button from "@/customer/components/ui/Button";
import { Card, CardHeader } from "@/customer/components/ui/Card";
import { TextField, TextareaField, FormGrid } from "@/customer/components/ui/Field";
import AcknowledgeNoticeDialog from "@/customer/components/ui/AcknowledgeNoticeDialog";
import {
  CheckCircleIcon,
  ClockIcon,
  CloseIcon,
  DocumentIcon,
} from "@/customer/components/ui/icons";
import { notifyError, notifySuccess } from "@/utils/toast";
import ApplicationServices from "@/services/ApplicationServices";

const formatWhen = (value) => {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
};

/** One signature block: whether it has been given, and by whom. */
const SignerRow = ({ block }) => (
  <li className="epc-signers__row">
    <span
      className={`epc-rail__dot epc-rail__dot--${block.signed ? "done" : "busy"}`}
      aria-hidden="true"
    >
      {block.signed ? <CheckCircleIcon size={10} /> : <ClockIcon size={10} />}
    </span>
    <div style={{ minWidth: 0, flex: 1 }}>
      <p className="epc-signers__name">{block.label}</p>
      <p className="epc-signers__meta">
        {block.signed
          ? [
              block.signedBy,
              formatWhen(block.signedAt),
              block.method === "upload" ? "uploaded image" : "",
            ]
              .filter(Boolean)
              .join(" · ")
          : block.required
            ? "Required — not signed yet."
            : "Not signed yet."}
      </p>
    </div>
  </li>
);

/**
 * The signature side of an audit-phase document.
 *
 * These are not approved by a second reviewer — they are signed, sometimes by
 * somebody who is not a reviewer at all. This panel shows who a document is
 * waiting on, and gives the awaited party the means to answer.
 */
const SigningPanel = ({
  applicationId,
  formKey,
  signing,
  status,
  request,
  onChanged,
  canRecordOnBehalf = false,
}) => {
  const [signature, setSignature] = useState("");
  const [name, setName] = useState("");
  const [nric, setNric] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [declining, setDeclining] = useState(false);
  const [ackOpen, setAckOpen] = useState(false);
  const [ackBusy, setAckBusy] = useState(false);

  const awaitedBlock = useMemo(
    () => (signing?.blocks || []).find((b) => b.role === signing?.awaiting),
    [signing],
  );

  if (!signing) return null;

  const answer = async (decision) => {
    if (decision === "accept" && !signature) {
      notifyError("Sign the document before accepting.");
      return;
    }
    if (decision === "accept" && awaitedBlock?.collectsNric && !nric.trim()) {
      notifyError("Your NRIC is required to accept this assignment.");
      return;
    }
    if (decision === "decline" && !note.trim()) {
      notifyError("Give a reason so the job can be reassigned.");
      return;
    }

    setBusy(decision);
    try {
      const res = await ApplicationServices.signForm(
        applicationId,
        formKey,
        {
          decision,
          note,
          signature:
            decision === "accept" ? { dataUrl: signature, name, nric } : undefined,
        },
        request,
      );
      if (res.data?.status) {
        notifySuccess(res.data.message || "Recorded");
        const notice = res.data.notice;
        if (notice && notice.sent === false && notice.reason) {
          notifyError(`Recorded, but nobody was notified: ${notice.reason}`);
        }
        setSignature("");
        setNric("");
        setNote("");
        setDeclining(false);
        onChanged?.();
      }
    } catch (error) {
      notifyError(error?.response?.data?.message || "Could not record your answer");
    } finally {
      setBusy("");
    }
  };

  const recordOnBehalf = async (payload) => {
    setAckBusy(true);
    try {
      const res = await ApplicationServices.acknowledgeForm(
        applicationId,
        formKey,
        payload,
        request,
      );
      if (res.data?.status) {
        notifySuccess(
          res.data.message || "Confirmation recorded on behalf of the customer.",
        );
        const notice = res.data.notice;
        if (notice && notice.sent === false && notice.reason) {
          notifyError(`Recorded, but nobody was notified: ${notice.reason}`);
        }
        setAckOpen(false);
        onChanged?.();
      } else {
        notifyError(res.data?.message || "Could not record confirmation.");
      }
    } catch (error) {
      notifyError(
        error?.response?.data?.message || "Could not record confirmation.",
      );
    } finally {
      setAckBusy(false);
    }
  };

  const declined = status === "Declined";
  const waiting = Boolean(signing.awaiting);
  const needsYourSignature = waiting && signing.isAwaitedParty;
  const signedBlocks = (signing.blocks || []).filter((block) => block.signed);
  /* Form-field uploads (e.g. Inspection Notes attach_N_file) live on the sheet
     itself — do not re-list them here after save. */
  const confirmationAttachments = (signing.attachments || []).filter(
    (file) => !/^attach_\d+_file$/i.test(String(file.purpose || "")),
  );
  const hasExtras =
    declined ||
    Boolean(signing.customerAcknowledgement) ||
    confirmationAttachments.length > 0;
  const showWaitingNotice = waiting && !signing.isAwaitedParty;
  const canConfirmOnBehalf =
    canRecordOnBehalf &&
    signing.awaiting === "customer" &&
    !signing.customerAcknowledgement;

  /* Don't render an empty "who still needs to sign" checklist — it clutters
     the stage with no action. Only surface this panel when there is something
     to do, something already signed, or a waiting/declined state to report. */
  if (!needsYourSignature && !signedBlocks.length && !showWaitingNotice && !hasExtras) {
    return null;
  }

  return (
    <Card className="epc-stack" style={{ marginTop: 20 }}>
      {needsYourSignature ? (
        <CardHeader
          title="Your signature required"
          subtitle="Sign below to accept this document."
        />
      ) : signedBlocks.length ? (
        <CardHeader title="Signed" subtitle="Who signed this document." />
      ) : null}

      {signedBlocks.length ? (
        <ul className="epc-signers">
          {signedBlocks.map((block) => (
            <SignerRow key={block.role} block={block} />
          ))}
        </ul>
      ) : null}

      {signing.assignedAuditorName && (needsYourSignature || showWaitingNotice) ? (
        <p className="epc-section__desc">
          Assigned auditor: <strong>{signing.assignedAuditorName}</strong>
        </p>
      ) : null}

      {signing.customerAcknowledgement ? (
        <p className="epc-notice epc-notice--ok">
          <span>
            Confirmed by {signing.customerAcknowledgedBy || "the customer"}
            {formatWhen(signing.customerAcknowledgedAt)
              ? ` on ${formatWhen(signing.customerAcknowledgedAt)}`
              : ""}
            {signing.customerAcknowledgement === "Uploaded"
              ? " — a signed copy was uploaded."
              : " — signed in the portal."}
          </span>
        </p>
      ) : null}

      {confirmationAttachments.map((file) => (
        <a
          key={file.purpose}
          className="epc-link"
          href={ApplicationServices.formAttachmentUrl(
            applicationId,
            formKey,
            file.purpose,
          )}
          target="_blank"
          rel="noreferrer"
        >
          <DocumentIcon size={14} /> {file.fileName || "Uploaded confirmation"}
        </a>
      ))}

      {declined ? (
        <div className="epc-notice epc-notice--stop">
          <CloseIcon size={16} className="epc-notice__icon" />
          <span>
            <strong>Declined.</strong>{" "}
            {signing.auditorDecisionNote ? (
              <>
                Reason: {signing.auditorDecisionNote}.{" "}
              </>
            ) : null}
            Assign a different auditor (or the same one again) and issue a new
            letter — that clears this decline.
          </span>
        </div>
      ) : null}

      {showWaitingNotice ? (
        canConfirmOnBehalf ? (
          <div className="epc-notice epc-notice--info">
            <ClockIcon size={16} className="epc-notice__icon" />
            <span>
              Waiting for the customer to confirm. You can also record
              confirmation on their behalf if they confirmed outside the portal.
            </span>
            <div className="epc-actions" style={{ marginTop: 12 }}>
              <Button
                onClick={() => setAckOpen(true)}
                disabled={ackBusy || Boolean(busy)}
              >
                Confirm on behalf of customer
              </Button>
            </div>
          </div>
        ) : (
          <p className="epc-notice epc-notice--warn">
            <ClockIcon size={16} className="epc-notice__icon" />
            <span>
              {signing.awaiting === "customer"
                ? "Waiting for the customer to confirm."
                : `Waiting for ${signing.assignedAuditorName || "the assigned auditor"} to answer.`}
            </span>
          </p>
        )
      ) : null}

      {needsYourSignature ? (
        <div className="epc-stack">
          {declining ? (
            <>
              <TextareaField
                label="Why are you declining?"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="A conflict of interest, unavailable on those dates, and so on."
              />
              <div className="epc-actions" style={{ marginTop: 0 }}>
                <button
                  type="button"
                  className="epc-btn epc-btn--danger"
                  disabled={Boolean(busy)}
                  onClick={() => answer("decline")}
                >
                  {busy === "decline" ? "Declining…" : "Confirm decline"}
                </button>
                <Button
                  variant="secondary"
                  disabled={Boolean(busy)}
                  onClick={() => setDeclining(false)}
                >
                  Back
                </Button>
              </div>
            </>
          ) : (
            <>
              <FormGrid>
                <TextField
                  label="Your name, as it should appear"
                  placeholder="Leave blank to use your account name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                {awaitedBlock?.collectsNric ? (
                  <TextField
                    label="NRIC *"
                    placeholder="e.g. 880101-14-5533"
                    value={nric}
                    onChange={(e) => setNric(e.target.value)}
                  />
                ) : null}
              </FormGrid>

              <SignaturePad
                value={signature}
                onChange={setSignature}
                label="Your signature"
                hint="Stamped onto the document exactly where the paper form asks for it."
              />

              <div className="epc-actions" style={{ marginTop: 0 }}>
                <Button
                  disabled={Boolean(busy) || !signature}
                  onClick={() => answer("accept")}
                >
                  {busy === "accept" ? "Signing…" : "Accept and sign"}
                </Button>
                <Button
                  variant="secondary"
                  disabled={Boolean(busy)}
                  onClick={() => setDeclining(true)}
                >
                  Decline
                </Button>
              </div>
            </>
          )}
        </div>
      ) : null}

      <AcknowledgeNoticeDialog
        open={ackOpen}
        busy={ackBusy}
        title="Confirm on behalf of customer"
        body="Record the customer's confirmation here if they signed outside the portal — by drawing their mark, or by uploading the signed copy."
        nameLabel="Customer name"
        namePlaceholder="Who confirmed"
        submitLabel="Record confirmation"
        onCancel={() => {
          if (!ackBusy) setAckOpen(false);
        }}
        onSubmit={recordOnBehalf}
      />
    </Card>
  );
};

export default SigningPanel;
