import { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useHistory } from "react-router-dom";
import axios from "axios";
import {
  FileText,
  Send,
  RotateCcw,
  Download,
  RefreshCw,
  Copy,
  X,
  CheckCircle2,
  FileWarning,
  AlertTriangle,
  Clock,
} from "lucide-react";
import EInvoiceServices from "@/services/EInvoiceServices";
import { redactPasswordsForDisplay } from "@/utils/sanitizeEInvoiceApiDisplay";
import { downloadFlexaCreditDebitEInvoicePdf } from "@/utils/eInvoiceCustomerInvoicePdf";
import { formatLhdnValidationErrorsNotifyBody } from "@/utils/formatLhdnValidationErrors";
import { notifyError, notifySuccess } from "@/utils/toast";
import { customerInvoiceText as ciText } from "@/utils/customerInvoiceI18n";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const LHDN_BADGE_STYLES = {
  Pending: { icon: Clock, cls: "bg-gray-100 text-gray-700 border-gray-300" },
  Submitted: { icon: Send, cls: "bg-blue-50 text-blue-700 border-blue-300" },
  Valid: {
    icon: CheckCircle2,
    cls: "bg-green-50 text-green-700 border-green-300",
  },
  Invalid: {
    icon: FileWarning,
    cls: "bg-amber-50 text-amber-700 border-amber-300",
  },
  Rejected: {
    icon: AlertTriangle,
    cls: "bg-red-50 text-red-700 border-red-300",
  },
  Cancelled: {
    icon: AlertTriangle,
    cls: "bg-red-50 text-red-700 border-red-300",
  },
};

export function LhdnStatusBadge({ status }) {
  const resolved = status || "Pending";
  const style = LHDN_BADGE_STYLES[resolved] || LHDN_BADGE_STYLES.Pending;
  const Icon = style.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${style.cls}`}
    >
      <Icon size={12} />
      {ciText(resolved)}
    </span>
  );
}

function lhdnPatchFromApiData(d) {
  const patch = {};
  if (!d || typeof d !== "object") return patch;
  if (d.lhdn_status != null) patch.lhdn_status = d.lhdn_status;
  if (d.uuid != null) patch.uuid = d.uuid;
  if (d.submissionUid != null) patch.submissionUid = d.submissionUid;
  if (d.longID != null) patch.longID = d.longID;
  if (d.invoiceLink != null) patch.invoiceLink = d.invoiceLink;
  if (d.reason != null) patch.lhdnReason = d.reason;
  return patch;
}

/**
 * LHDN submit / view / retry / refresh / PDF for a single credit or debit note row.
 * Use only when the row's business has e-invoice enabled (parent gates with rowShowsLhdn).
 *
 * @param {"credit"|"debit"} params.variant
 */
export function useCreditDebitNoteLhdnActions({
  variant,
  headers,
  canSubmitLhdn,
  patchNoteInList,
  refreshList,
}) {
  useTranslation();
  const history = useHistory();
  const isCredit = variant === "credit";

  const noteLabelLower = isCredit
    ? ciText("credit note")
    : ciText("debit note");
  const noteLabelTitle = isCredit
    ? ciText("Credit note")
    : ciText("Debit note");

  const docNo = useCallback(
    (r) => r?.creditNoteNumber || r?.debitNoteNumber || "",
    [],
  );

  const [eInvoiceBusyId, setEInvoiceBusyId] = useState(null);
  const [eInvoiceDownloadId, setEInvoiceDownloadId] = useState(null);
  const [lhdnResponseModal, setLhdnResponseModal] = useState(null);
  const [lhdnActionConfirm, setLhdnActionConfirm] = useState(null);

  const applyPatch = useCallback(
    (id, patch) => {
      if (typeof patchNoteInList === "function") patchNoteInList(id, patch);
    },
    [patchNoteInList],
  );

  const performSubmitToLhdn = async (row) => {
    if (!row?._id) return;
    try {
      setEInvoiceBusyId(row._id);
      const { data } = isCredit
        ? await EInvoiceServices.submitCreditNote(row._id)
        : await EInvoiceServices.submitDebitNote(row._id);
      notifySuccess(data?.message || ciText("Submitted to LHDN"));
      const patch = lhdnPatchFromApiData(data?.data);
      if (data?.status === true && patch.lhdn_status === "Submitted") {
        patch.lhdnReason = null;
        patch.validationResults = [];
      }
      applyPatch(row._id, patch);
      if (!data?.data && typeof refreshList === "function") refreshList();
    } catch (err) {
      const resp = err?.response?.data;
      if (resp?.validationErrors?.length) {
        const intro =
          isCredit
            ? ciText("Couldn’t submit this credit note to MyInvois (LHDN)")
            : ciText("Couldn’t submit this debit note to MyInvois (LHDN)");
        notifyError(
          formatLhdnValidationErrorsNotifyBody(resp.validationErrors, intro, {
            maxLines: 6,
          }),
        );
      } else {
        notifyError(
          resp?.message || err.message || ciText("Submission failed"),
        );
      }
    } finally {
      setEInvoiceBusyId(null);
    }
  };

  const performRetryLhdn = async (row) => {
    if (!row?._id) return;
    try {
      setEInvoiceBusyId(row._id);
      const { data } = isCredit
        ? await EInvoiceServices.retryCreditNote(row._id)
        : await EInvoiceServices.retryDebitNote(row._id);
      notifySuccess(data?.message || ciText("Resubmitted to LHDN"));
      /**
       * Only show the raw LHDN API response modal when the call did NOT
       * succeed (status: false or LHDN soft-rejected). On a clean retry
       * success, the toast + row patch is enough — same as the customer
       * invoices list. Same applies to refund notes (creditNoteType =
       * "refund_to_client") since they share this hook.
       */
      if (data && typeof data === "object" && data.status !== true) {
        setLhdnResponseModal({
          title: ciText("LHDN — retry"),
          docNo: docNo(row),
          body: data,
        });
      }
      const patch = lhdnPatchFromApiData(data?.data);
      if (data?.status === true && patch.lhdn_status === "Submitted") {
        patch.lhdnReason = null;
        patch.validationResults = [];
      }
      applyPatch(row._id, patch);
      if (!data?.data && typeof refreshList === "function") refreshList();
    } catch (err) {
      const resp = err?.response?.data;
      if (resp?.validationErrors?.length) {
        const intro =
          isCredit
            ? ciText("Couldn’t resubmit this credit note to MyInvois (LHDN)")
            : ciText("Couldn’t resubmit this debit note to MyInvois (LHDN)");
        notifyError(
          formatLhdnValidationErrorsNotifyBody(resp.validationErrors, intro, {
            maxLines: 6,
          }),
        );
      } else {
        notifyError(resp?.message || err.message || ciText("Retry failed"));
      }
    } finally {
      setEInvoiceBusyId(null);
    }
  };

  const handleConfirmLhdnAction = async () => {
    const pending = lhdnActionConfirm;
    if (!pending?.row?._id) {
      setLhdnActionConfirm(null);
      return;
    }
    const { action, row } = pending;
    setLhdnActionConfirm(null);
    if (action === "submit") await performSubmitToLhdn(row);
    else if (action === "retry") await performRetryLhdn(row);
  };

  const handleRefreshLhdn = async (row) => {
    if (!row?._id) return;
    try {
      setEInvoiceBusyId(row._id);
      const { data } = isCredit
        ? await EInvoiceServices.getCreditNoteStatus(row._id)
        : await EInvoiceServices.getDebitNoteStatus(row._id);
      notifySuccess(ciText("Status refreshed from LHDN"));
      /**
       * Skip the raw response dump on a successful refresh — the badge
       * already reflects the latest LHDN status via `applyPatch`. Only
       * surface the modal if the API reports a non-success.
       */
      if (data && typeof data === "object" && data.status !== true) {
        setLhdnResponseModal({
          title: ciText("LHDN — status refresh"),
          docNo: docNo(row),
          body: data,
        });
      }
      applyPatch(row._id, lhdnPatchFromApiData(data?.data));
    } catch (err) {
      notifyError(err?.response?.data?.message || err.message);
    } finally {
      setEInvoiceBusyId(null);
    }
  };

  const handleViewLhdn = useCallback(
    (row) => {
      if (!row?._id) return;
      const code = isCredit ? `cn-${row._id}` : `dn-${row._id}`;
      history.push(`/invoices/e-invoice/${encodeURIComponent(code)}`);
    },
    [history, isCredit],
  );

  const handleDownloadPdf = async (row) => {
    if ((row.lhdn_status || "").toString() !== "Valid") {
      notifyError(
        ciText("Only valid LHDN documents can be downloaded as PDF"),
      );
      return;
    }
    if (!row?._id) return;
    setEInvoiceDownloadId(row._id);
    try {
      await downloadFlexaCreditDebitEInvoicePdf(
        row,
        isCredit ? "credit" : "debit",
        {
          getCreditNoteById: (id) =>
            axios.get(`${Base_URL}/credit-notes/${id}`, { headers }),
          getDebitNoteById: (id) =>
            axios.get(`${Base_URL}/debit-notes/${id}`, { headers }),
          getEInvoiceDetails: async (code) => {
            const { data } = await EInvoiceServices.getDetails(code);
            return data;
          },
          getBusinessById: (businessId) =>
            axios.get(`${Base_URL}/business/${businessId}`, { headers }),
          getBusinessLhdnByBusinessId: async (businessId) => {
            if (!businessId) return null;
            try {
              const { data: res } = await axios.get(
                `${Base_URL}/BusinessDetails/get_by_business_id/${businessId}`,
                { headers },
              );
              const d = res?.data;
              if (Array.isArray(d) && d[0]) return d[0];
              return d && typeof d === "object" ? d : null;
            } catch {
              return null;
            }
          },
        },
      );
      notifySuccess(ciText("E-invoice PDF downloaded"));
    } catch (err) {
      notifyError(err?.message || ciText("Failed to download PDF"));
    } finally {
      setEInvoiceDownloadId(null);
    }
  };

  const renderLhdnActionButtons = useCallback(
    (row, rowShowsLhdn) => {
      if (!rowShowsLhdn) return null;
      const id = row._id;
      const lhdn = (row.lhdn_status || "Pending").toString();
      const busy = eInvoiceBusyId === id;
      const downloading = eInvoiceDownloadId === id;
      const canRetry = lhdn === "Rejected" || lhdn === "Invalid";
      const isSubmitted = lhdn === "Submitted";
      const isValid = lhdn === "Valid";
      const canSubmit = lhdn === "Pending" && canSubmitLhdn;

      return (
        <>
          <button
            type="button"
            onClick={() => handleViewLhdn(row)}
            className="rounded p-1 text-[var(--p-blue)] hover:bg-blue-50"
            title={ciText("View LHDN details")}
          >
            <FileText className="h-5 w-5" />
          </button>
          {canSubmit && (
            <button
              type="button"
              onClick={() => setLhdnActionConfirm({ action: "submit", row })}
              disabled={busy}
              className="rounded p-1 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
              title={ciText("Submit to LHDN")}
            >
              <Send className="h-5 w-5" />
            </button>
          )}
          {canRetry && canSubmitLhdn && (
            <button
              type="button"
              onClick={() => setLhdnActionConfirm({ action: "retry", row })}
              disabled={busy}
              className="rounded p-1 text-amber-600 hover:bg-amber-50 disabled:opacity-50"
              title={ciText("Retry LHDN")}
            >
              <RotateCcw className="h-5 w-5" />
            </button>
          )}
          {isSubmitted && (
            <button
              type="button"
              onClick={() => handleRefreshLhdn(row)}
              disabled={busy}
              className="rounded p-1 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
              title={ciText("Refresh LHDN status")}
            >
              <RefreshCw
                className={`h-5 w-5 ${busy ? "animate-spin" : ""}`}
              />
            </button>
          )}
          {isValid && (
            <button
              type="button"
              onClick={() => handleDownloadPdf(row)}
              disabled={downloading}
              className="rounded p-1 text-indigo-600 hover:bg-indigo-50 disabled:opacity-50"
              title={ciText("Download e-invoice PDF")}
            >
              {downloading ? (
                <RefreshCw className="h-5 w-5 animate-spin" />
              ) : (
                <Download className="h-5 w-5" />
              )}
            </button>
          )}
        </>
      );
    },
    [
      canSubmitLhdn,
      eInvoiceBusyId,
      eInvoiceDownloadId,
      handleViewLhdn,
    ],
  );

  const LhdnModals = () => (
    <>
      {lhdnActionConfirm && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 backdrop-blur-[2px] p-4 sm:p-6"
          onClick={() => setLhdnActionConfirm(null)}
          role="presentation"
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col border border-gray-200/90 ring-1 ring-black/[0.06]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="lhdn-note-confirm-title"
          >
            <div
              className="h-1 w-full bg-[var(--p-blue)] shrink-0"
              aria-hidden
            />
            <div className="px-6 pt-5 pb-1">
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--p-blue)] text-white shadow-md shadow-[#0C2E5A]/30">
                  <Send className="h-5 w-5" strokeWidth={2} />
                </span>
                <div className="min-w-0 pt-0.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--p-blue-dark)] mb-1">
                    {ciText("MyInvois · LHDN")}
                  </p>
                  <h3
                    id="lhdn-note-confirm-title"
                    className="text-lg font-semibold text-p-black leading-snug"
                  >
                    {lhdnActionConfirm.action === "retry"
                      ? ciText("Resubmit this document?")
                      : ciText("Submit to LHDN?")}
                  </h3>
                  <p className="text-sm text-p-gray mt-2.5 leading-relaxed">
                    {lhdnActionConfirm.action === "retry"
                      ? ciText(
                          "{{document}} {{number}} is {{status}}. We will send this {{note}} to LHDN (MyInvois) again.",
                          {
                            document: noteLabelTitle,
                            number: docNo(lhdnActionConfirm.row) || "—",
                            status: ciText(
                              lhdnActionConfirm.row.lhdn_status || "unknown",
                            ),
                            note: noteLabelLower,
                          },
                        )
                      : ciText(
                          "Send {{note}} {{number}} to LHDN (MyInvois).",
                          {
                            note: noteLabelLower,
                            number: docNo(lhdnActionConfirm.row) || "—",
                          },
                        )}
                  </p>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 bg-p-gray-light/40 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setLhdnActionConfirm(null)}
                className="w-full sm:w-auto px-4 py-2.5 text-sm font-medium text-p-black bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                {ciText("Cancel")}
              </button>
              <button
                type="button"
                onClick={handleConfirmLhdnAction}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-[var(--p-blue)] rounded-lg shadow-sm"
              >
                <Send className="h-4 w-4" strokeWidth={2} />
                {lhdnActionConfirm.action === "retry"
                  ? ciText("Resubmit to LHDN")
                  : ciText("Submit to LHDN")}
              </button>
            </div>
          </div>
        </div>
      )}

      {lhdnResponseModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {ciText("LHDN API response")}
                </h3>
                <p className="text-xs text-gray-700 font-medium mt-0.5">
                  {lhdnResponseModal.title}
                  {lhdnResponseModal.docNo
                    ? ` · ${lhdnResponseModal.docNo}`
                    : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(
                        JSON.stringify(
                          redactPasswordsForDisplay(lhdnResponseModal.body),
                          null,
                          2,
                        ),
                      );
                      notifySuccess(ciText("JSON copied to clipboard"));
                    } catch {
                      notifyError(ciText("Could not copy"));
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <Copy size={16} />
                  {ciText("Copy")}
                </button>
                <button
                  type="button"
                  onClick={() => setLhdnResponseModal(null)}
                  className="p-1.5 text-gray-800 hover:bg-gray-100 rounded-lg"
                  title={ciText("Close")}
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto">
              <pre className="text-xs font-mono bg-gray-50 border border-gray-200 rounded-lg p-3 whitespace-pre-wrap break-words text-gray-800">
                {JSON.stringify(
                  redactPasswordsForDisplay(lhdnResponseModal.body),
                  null,
                  2,
                )}
              </pre>
            </div>
            <div className="px-4 py-3 border-t bg-gray-50 flex justify-end">
              <button
                type="button"
                onClick={() => setLhdnResponseModal(null)}
                className="px-4 py-2 text-sm font-medium text-p-black bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                {ciText("Close")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  return { renderLhdnActionButtons, LhdnModals };
}
