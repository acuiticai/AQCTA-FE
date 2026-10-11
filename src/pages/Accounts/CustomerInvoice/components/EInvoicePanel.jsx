import { useTranslation } from "react-i18next";
import { customerInvoiceText as ciText } from "@/utils/customerInvoiceI18n";
/**
 * EInvoicePanel
 * ─────────────────────────────────────────────────────────────────────
 * Self-contained UI for the MyInvois (LHDN) e-invoice status for a customer invoice.
 * The invoice record is the e-invoice; there is no separate “convert to invoice” step.
 * Optional business setting auto-submits after save/send when validation passes.
 *
 * Renders:
 *   1. Status badge (Pending / Submitted / Valid / Invalid / Rejected)
 *   2. Actions: Submit to LHDN (when not yet submitted), Refresh, Retry, public link
 *   3. Full-page e-invoice details + modal only for retry validation errors
 *
 * Pairs with `EInvoiceServices` (POST /generate, /submit, GET /status,
 * POST /retry).
 */
import React, { useState } from "react";
import { useHistory } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import {
  Send,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  X,
  FileWarning,
  RotateCcw,
  Copy,
} from "lucide-react";
import EInvoiceServices from "@/services/EInvoiceServices";
import { notifyError, notifySuccess } from "@/utils/toast";
import { redactPasswordsForDisplay } from "@/utils/sanitizeEInvoiceApiDisplay";
import {
  getLhdnValidationUserMessage,
  formatLhdnValidationErrorsNotifyBody,
} from "@/utils/formatLhdnValidationErrors";

const STATUS_STYLES = {
  Pending: {
    icon: Clock,
    className: "bg-gray-100 text-gray-700 border-gray-300",
  },
  Submitted: {
    icon: Send,
    className:
      "bg-[#E8F0FA] text-[var(--blue-700)] border-[var(--blue-600)]",
  },
  Valid: {
    icon: CheckCircle2,
    className: "bg-green-50 text-green-700 border-green-300",
  },
  Invalid: {
    icon: FileWarning,
    className: "bg-amber-50 text-amber-700 border-amber-300",
  },
  Rejected: {
    icon: AlertTriangle,
    className: "bg-red-50 text-red-700 border-red-300",
  },
  Cancelled: {
    icon: X,
    className: "bg-red-50 text-red-700 border-red-300",
  },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.Pending;
  const Icon = s.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${s.className}`}
    >
      <Icon size={13} />
      {ciText(status || "Pending")}
    </span>
  );
}

export default function EInvoicePanel({
  invoice,
  onUpdated,
  eInvoiceAutoApproval = false,
}) {
  useTranslation();
  const history = useHistory();
  const [loading, setLoading] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [rejectReason, setRejectReason] = useState(null);
  /** Last e-invoice API envelope { status, message, data, link } from refresh/retry. */
  const [lastApiEnvelope, setLastApiEnvelope] = useState(null);

  if (!invoice?._id) return null;

  const status = invoice.lhdn_status || "Pending";
  const isRejected = ["Rejected", "Invalid"].includes(status);

  const applyUpdated = (data) => {
    if (typeof onUpdated === "function") onUpdated(data);
  };

  const handleRefresh = async () => {
    try {
      setLoading(true);
      const { data } = await EInvoiceServices.getStatus(invoice._id);
      if (data && typeof data === "object") setLastApiEnvelope(data);
      notifySuccess(ciText("Status refreshed"));
      applyUpdated(data.data);
    } catch (err) {
      notifyError(err?.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const openEInvoiceDetailsPage = () => {
    if (!invoice?._id) return;
    history.push(`/invoices/e-invoice/${encodeURIComponent(String(invoice._id))}`);
  };

  const handleRetry = async () => {
    try {
      setLoading(true);
      setValidationErrors([]);
      setRejectReason(null);
      const { data } = await EInvoiceServices.retry(invoice._id);
      if (data && typeof data === "object") setLastApiEnvelope(data);
      notifySuccess(ciText("Invoice retried"));
      applyUpdated(data.data);
    } catch (err) {
      const resp = err?.response?.data;
      if (resp?.validationErrors?.length) {
        setValidationErrors(resp.validationErrors);
        setDetailsOpen(true);
        notifyError(
          formatLhdnValidationErrorsNotifyBody(
            resp.validationErrors,
            "Couldn’t resubmit this invoice to MyInvois (LHDN)",
            { maxLines: 6 },
          ),
        );
      } else {
        notifyError(resp?.message || err.message || ciText("Retry failed"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg">
            <span className="text-xs text-gray-500 font-medium">E-Invoice (MyInvois)</span>
            <StatusBadge status={status} />
            <button
              type="button"
              onClick={openEInvoiceDetailsPage}
              className="text-xs font-medium text-[var(--p-blue)] hover:text-[var(--p-blue-dark)] hover:underline"
            >
              {invoice.uuid ? "details" : "E-invoice response"}
            </button>
          </div>
          {eInvoiceAutoApproval && (
            <p className="text-xs text-gray-500 max-w-xl">
              Auto-approval is enabled for this business: invoices are submitted to LHDN
              after save or send when supplier, buyer, and credentials validate. If status
              is still Pending, fix validation issues and save again, or submit manually.
            </p>
          )}
        </div>

        {/*
          NOTE: The manual "Submit to LHDN" button has been removed from the
          Customer Invoice viewer. When auto-approval is enabled on the
          business, the invoice is submitted automatically on save/send.
          When auto-approval is disabled, users submit from the Customer
          Invoices list page (the row actions include "Submit to LHDN"
          and "View E-Invoice"). The viewer only surfaces status + retry
          + refresh so submission responsibility lives in one place.
        */}

        {status === "Submitted" && (
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm disabled:opacity-60"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            {ciText("Refresh Status")}
          </button>
        )}

        {isRejected && (
          <button
            type="button"
            onClick={handleRetry}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg disabled:opacity-60"
          >
            <RotateCcw size={16} />
            {loading ? ciText("Retrying...") : ciText("Retry")}
          </button>
        )}

        {invoice.invoiceLink && (
          <a
            href={invoice.invoiceLink}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 px-3 py-2 text-[var(--blue-700)] bg-gradient-to-r from-[#FFF8F0] to-[#E8F0FA] border border-[var(--p-blue-light)] hover:from-[#FFF3E0] hover:to-[#DCE8F5] text-sm font-medium rounded-lg"
          >
            <ExternalLink size={16} />
            {ciText("View on MyInvois")}
          </a>
        )}
      </div>

      {detailsOpen && (
        <EInvoiceDetailsModal
          invoice={invoice}
          validationErrors={validationErrors}
          rejectReason={rejectReason}
          apiEnvelope={lastApiEnvelope}
          onClose={() => setDetailsOpen(false)}
        />
      )}
    </>
  );
}

function buildSyntheticApiEnvelope(invoice) {
  return {
    status: true,
    data: invoice,
    link: invoice?.invoiceLink || null,
  };
}

/** Large LHDN status pill — same semantics as InvoisPls EInvoiceDetails; Submitted uses PCI navy. */
function LhdnStatusPill({ status }) {
  const s = status || "N/A";
  const cls =
    s === "Valid"
      ? "bg-green-100 text-green-800 border border-green-300"
      : s === "Invalid"
        ? "bg-red-100 text-red-800 border border-red-300"
        : s === "Pending"
          ? "bg-yellow-100 text-yellow-800 border border-yellow-300"
          : s === "Rejected"
            ? "bg-red-100 text-red-800 border border-red-300"
            : s === "Submitted"
              ? "bg-[#E8F0FA] text-[var(--blue-700)] border border-[var(--blue-600)]"
              : "bg-gray-100 text-gray-800 border border-gray-300";
  return (
    <span
      className={`inline-block px-4 py-1.5 rounded-full text-xs font-semibold shadow-sm ${cls}`}
    >
      {s}
    </span>
  );
}

function resolveCustomerBusiness(invoice) {
  let customer = null;
  let business = null;

  const rawC = invoice?.customerDetails || invoice?.customer_id;
  if (rawC && typeof rawC === "object" && !Array.isArray(rawC)) {
    const bi = rawC.basicInformation || rawC;
    customer = {
      name:
        bi.customerDisplayName ||
        bi.companyName ||
        rawC.name ||
        "N/A",
      email: bi.customerEmail || rawC.email || "N/A",
    };
  }

  const rawB = invoice?.businessDetails || invoice?.business_id || invoice?.business;
  if (rawB && typeof rawB === "object") {
    const b = Array.isArray(rawB) ? rawB[0] : rawB;
    if (b && typeof b === "object") {
      business = {
        name: b.name || b.businessName || "N/A",
        code: b.code || b.businessCode || "N/A",
      };
    }
  }

  return { customer, business };
}

function EInvoiceDetailsModal({
  invoice,
  validationErrors,
  rejectReason,
  apiEnvelope,
  onClose,
}) {
  const envelope =
    apiEnvelope && typeof apiEnvelope === "object"
      ? apiEnvelope
      : buildSyntheticApiEnvelope(invoice);
  const fullJsonPayload = redactPasswordsForDisplay(envelope);
  const fullJsonText = JSON.stringify(fullJsonPayload, null, 2);

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(fullJsonText);
      notifySuccess(ciText("JSON copied to clipboard"));
    } catch {
      notifyError(ciText("Could not copy"));
    }
  };

  const errors = validationErrors.length
    ? validationErrors
    : Array.isArray(invoice.validationResults)
      ? invoice.validationResults.map((v) => ({
          field: v.field || "Unknown",
          error: v.error || v.message || v.errorMessage || JSON.stringify(v),
        }))
      : [];

  const lhdnStatus = invoice.lhdn_status || "Pending";
  const publicLink =
    (typeof envelope.link === "string" && envelope.link) ||
    invoice.invoiceLink ||
    null;
  const apiMessage =
    typeof envelope.message === "string" ? envelope.message : "";
  const { customer, business } = resolveCustomerBusiness(invoice);

  const fmt = (d) => (d ? new Date(d).toLocaleString() : null);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              E-Invoice Details
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {ciText("View detailed information about the e-invoice submission")}
            </p>
            <p className="text-xs font-medium text-gray-600 mt-1">
              Invoice {invoice.invoice_number || "—"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {/* Status — mirrors InvoisPls; accent dot uses PCI primary */}
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-5 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-base font-bold text-gray-800 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--p-blue)] shrink-0" />
                {ciText("Status Information")}
              </h4>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-white rounded-lg p-3 shadow-sm border border-gray-100">
                <span className="text-sm font-medium text-gray-700">
                  {ciText("LHDN Status:")}
                </span>
                <LhdnStatusPill status={lhdnStatus} />
              </div>
              {apiMessage ? (
                <div className="rounded-lg p-3 border border-[var(--p-blue-light)] bg-[#FFF8F0]">
                  <p className="text-sm text-gray-800">
                    <span className="font-semibold text-[var(--p-blue-dark)]">
                      Message:{" "}
                    </span>
                    {apiMessage}
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
              <h4 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--blue-600)] shrink-0" />
                {ciText("Invoice Information")}
              </h4>
              <div className="space-y-3">
                <div className="flex flex-col gap-1 pb-2 border-b border-gray-100">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {ciText("Invoice Number")}
                  </span>
                  <span className="text-sm font-semibold text-gray-900">
                    {invoice.invoice_number || invoice.code || "N/A"}
                  </span>
                </div>
                {invoice.code ? (
                  <div className="flex flex-col gap-1 pb-2 border-b border-gray-100">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {ciText("Code")}
                    </span>
                    <span className="text-sm font-semibold text-gray-900">
                      {invoice.code}
                    </span>
                  </div>
                ) : null}
                {invoice.uuid ? (
                  <div className="flex flex-col gap-1 pb-2 border-b border-gray-100">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {ciText("UUID")}
                    </span>
                    <span className="text-xs font-mono text-gray-700 break-all bg-gray-50 p-2 rounded border border-gray-100">
                      {invoice.uuid}
                    </span>
                  </div>
                ) : null}
                {invoice.submissionUid ? (
                  <div className="flex flex-col gap-1 pb-2 border-b border-gray-100">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {ciText("Submission UID")}
                    </span>
                    <span className="text-xs font-mono text-gray-700 break-all bg-gray-50 p-2 rounded border border-gray-100">
                      {invoice.submissionUid}
                    </span>
                  </div>
                ) : null}
                {invoice.longID ? (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {ciText("Long ID")}
                    </span>
                    <span className="text-xs font-mono text-gray-700 break-all bg-gray-50 p-2 rounded border border-gray-100">
                      {invoice.longID}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
              <h4 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--p-blue)] shrink-0" />
                {ciText("Timestamps")}
              </h4>
              <div className="space-y-3">
                {invoice.submitted_time ? (
                  <div className="flex flex-col gap-1 pb-2 border-b border-gray-100">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {ciText("Submitted")}
                    </span>
                    <span className="text-sm font-semibold text-gray-900">
                      {fmt(invoice.submitted_time)}
                    </span>
                  </div>
                ) : null}
                {invoice.processed_time ? (
                  <div className="flex flex-col gap-1 pb-2 border-b border-gray-100">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {ciText("Processed")}
                    </span>
                    <span className="text-sm font-semibold text-gray-900">
                      {fmt(invoice.processed_time)}
                    </span>
                  </div>
                ) : null}
                {invoice.createdAt ? (
                  <div className="flex flex-col gap-1 pb-2 border-b border-gray-100">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {ciText("Created")}
                    </span>
                    <span className="text-sm font-semibold text-gray-900">
                      {fmt(invoice.createdAt)}
                    </span>
                  </div>
                ) : null}
                {invoice.updatedAt ? (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {ciText("Updated")}
                    </span>
                    <span className="text-sm font-semibold text-gray-900">
                      {fmt(invoice.updatedAt)}
                    </span>
                  </div>
                ) : null}
                {!invoice.submitted_time &&
                !invoice.processed_time &&
                !invoice.createdAt &&
                !invoice.updatedAt ? (
                  <p className="text-sm text-gray-400">{ciText("No timestamps yet")}</p>
                ) : null}
              </div>
            </div>
          </div>

          {publicLink ? (
            <div className="rounded-xl p-5 border border-[var(--p-blue-light)] shadow-sm bg-gradient-to-r from-[#FFF8F0] to-[#E8F0FA]">
              <h4 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--p-blue)] shrink-0" />
                E-Invoice Access
              </h4>
              <div className="flex flex-col items-center mb-5">
                <div className="bg-white p-4 rounded-lg border-2 border-[var(--p-blue-light)] shadow-md">
                  <QRCodeSVG
                    value={publicLink}
                    size={200}
                    level="H"
                    includeMargin
                  />
                </div>
                <p className="text-xs text-gray-600 mt-3 text-center max-w-xs">
                  {ciText("Scan this QR code to view the e-invoice")}
                </p>
              </div>
              <div className="border-t border-[var(--p-blue-light)] pt-4">
                <p className="text-xs font-medium text-gray-700 mb-2 uppercase tracking-wide">
                  {ciText("Or open link directly:")}
                </p>
                <a
                  href={publicLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 font-medium text-sm break-all bg-white px-4 py-2 rounded-lg border border-[var(--blue-600)] text-[var(--blue-700)] hover:bg-gray-50 transition-colors w-full"
                >
                  <ExternalLink size={16} className="flex-shrink-0" />
                  <span className="truncate">{publicLink}</span>
                </a>
              </div>
            </div>
          ) : null}

          {(rejectReason || invoice.reason) && (
            <div className="bg-gradient-to-r from-red-50 to-pink-50 rounded-xl p-5 border border-red-200 shadow-sm">
              <h4 className="text-base font-bold text-red-800 mb-3 flex items-center gap-2">
                <AlertTriangle size={18} className="text-red-600 shrink-0" />
                {ciText("Error / Reason")}
              </h4>
              <div className="bg-white rounded-lg p-4 border border-red-200">
                <p className="text-sm text-red-900 font-medium whitespace-pre-wrap">
                  {typeof (rejectReason || invoice.reason) === "string"
                    ? rejectReason || invoice.reason
                    : JSON.stringify(rejectReason || invoice.reason, null, 2)}
                </p>
              </div>
            </div>
          )}

          {errors.length > 0 && (
            <div className="bg-gradient-to-r from-yellow-50 to-amber-50 rounded-xl p-5 border border-yellow-200 shadow-sm">
              <h4 className="text-base font-bold text-yellow-800 mb-3 flex items-center gap-2">
                <FileWarning size={18} className="text-yellow-700 shrink-0" />
                Validation Results ({errors.length})
              </h4>
              <ul className="bg-white rounded-lg border border-yellow-200 max-h-64 overflow-y-auto divide-y divide-yellow-100">
                {errors.map((e, i) => (
                  <li key={i} className="px-3 py-2 text-sm text-gray-800">
                    {getLhdnValidationUserMessage(e)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!errors.length &&
            Array.isArray(invoice.validationResults) &&
            invoice.validationResults.length > 0 && (
              <div className="bg-gradient-to-r from-yellow-50 to-amber-50 rounded-xl p-5 border border-yellow-200 shadow-sm">
                <h4 className="text-base font-bold text-yellow-800 mb-3 flex items-center gap-2">
                  <FileWarning size={18} className="text-yellow-700 shrink-0" />
                  {ciText("Validation Results")}
                </h4>
                <div className="bg-white rounded-lg p-4 border border-yellow-200 max-h-64 overflow-auto">
                  <pre className="text-xs text-yellow-900 font-mono whitespace-pre-wrap">
                    {JSON.stringify(invoice.validationResults, null, 2)}
                  </pre>
                </div>
              </div>
            )}

          {(customer || business) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {customer ? (
                <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                  <h4 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                    {ciText("Customer Details")}
                  </h4>
                  <div className="space-y-3">
                    <div className="flex flex-col gap-1 pb-2 border-b border-gray-100">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        {ciText("Name")}
                      </span>
                      <span className="text-sm font-semibold text-gray-900">
                        {customer.name}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        {ciText("Email")}
                      </span>
                      <span className="text-sm font-semibold text-gray-900 break-all">
                        {customer.email}
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}
              {business ? (
                <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                  <h4 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[var(--p-blue-dark)] shrink-0" />
                    {ciText("Business Details")}
                  </h4>
                  <div className="space-y-3">
                    <div className="flex flex-col gap-1 pb-2 border-b border-gray-100">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        {ciText("Name")}
                      </span>
                      <span className="text-sm font-semibold text-gray-900">
                        {business.name}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        {ciText("Code")}
                      </span>
                      <span className="text-sm font-semibold text-gray-900">
                        {business.code}
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          <details className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden group">
            <summary className="text-sm font-bold text-gray-700 cursor-pointer hover:text-gray-900 p-4 flex items-center justify-between hover:bg-gray-100 transition-colors list-none [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2">
                <Copy size={16} className="opacity-60" />
                {ciText("View full API response")}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  copyJson();
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[var(--blue-700)] bg-white border border-[var(--blue-600)] rounded-lg hover:bg-[#E8F0FA]"
              >
                <Copy size={14} />
                {ciText("Copy JSON")}
              </button>
            </summary>
            <div className="p-4 bg-white border-t border-gray-200">
              <p className="text-xs text-gray-500 mb-2">
                {ciText("Shape:")} <code className="text-gray-600">status</code>,{" "}
                <code className="text-gray-600">message</code>,{" "}
                <code className="text-gray-600">data</code>,{" "}
                <code className="text-gray-600">link</code>. Passwords redacted.
              </p>
              <pre className="text-xs text-gray-800 font-mono overflow-auto max-h-96 bg-gray-50 p-4 rounded-lg border border-gray-200 whitespace-pre-wrap break-words">
                {fullJsonText}
              </pre>
            </div>
          </details>
        </div>

        <div className="px-6 py-3 border-t bg-gray-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-[var(--blue-700)] bg-white border border-[var(--blue-600)] rounded-lg hover:bg-[#E8F0FA]"
          >
            {ciText("Close")}
          </button>
        </div>
      </div>
    </div>
  );
}
