import React, { useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useHistory, useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  CalendarClock,
  FileText,
  Pencil,
  Paperclip,
  ExternalLink,
  Download,
  Loader2,
  Hash,
} from "lucide-react";
import { PageHeader, Button, Loader } from "@/page-layouts";
import { notifyError } from "@/utils/toast";
import { AdminContext } from "@/context/AdminContext";
import { formatAmount, formatDate } from "@/components/formatAmount";
import { makeChequeT, translateChequeStatus } from "@/utils/chequeI18n";
import ChequeStatusHistoryModal from "./ChequeStatusHistoryModal";
import ChequeNumberLink from "@/components/cheques/ChequeNumberLink";
import useCheckTokenExpired from "@/hooks/useCheckTokenExpired";
import { isSingleAssignedBusiness } from "@/utils/sessionAssignedBusinesses";

const ATTACHMENT_TYPE_DEFAULTS = {
  cheque_image: "Cheque image",
  payment_voucher: "Payment voucher",
  supporting_invoice: "Supporting invoice",
  additional_document: "Additional document",
};

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

function SectionCard({ title, icon: Icon, children, className = "" }) {
  return (
    <section
      className={`rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800/80 ${className}`}
    >
      <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4 dark:border-gray-700">
        {Icon ? (
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-gray-900 dark:text-slate-300">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
        ) : null}
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      </div>
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}

function DetailField({ label, children, className = "" }) {
  return (
    <div className={className}>
      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </dt>
      <dd className="mt-1.5 text-sm text-gray-900 dark:text-gray-100 break-words">{children}</dd>
    </div>
  );
}

const ChequeDetail = () => {
  const { t } = useTranslation();
  const cq = makeChequeT(t);
  const { id } = useParams();
  const history = useHistory();
  const { state } = useContext(AdminContext);
  const adminInfo =
    state?.adminInfo ||
    (typeof localStorage !== "undefined" && localStorage.getItem("adminInfo")
      ? JSON.parse(localStorage.getItem("adminInfo"))
      : null);

  const checkTokenExpired = useCheckTokenExpired();
  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [attachmentBusy, setAttachmentBusy] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const terminalStatuses = new Set(["Cleared", "Bounced", "Cancelled", "Replaced"]);

  const translatePaymentStatus = (status) => {
    if (status === "Pending Clearance") {
      return cq(
        "detail.paymentStatuses.pendingClearance",
        "Pending Clearance",
      );
    }
    if (status === "Paid") {
      return cq("detail.paymentStatuses.paid", "Paid");
    }
    return status;
  };

  const attachmentTypeLabel = (documentType) => {
    if (documentType && ATTACHMENT_TYPE_DEFAULTS[documentType]) {
      return cq(
        `detail.attachmentTypes.${documentType}`,
        ATTACHMENT_TYPE_DEFAULTS[documentType],
      );
    }
    return (
      documentType || cq("detail.documentFallback", "Document")
    );
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!adminInfo?.token || !id) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const res = await axios.get(`${Base_URL}/cheques/${id}`, {
          headers: {
            authorization: `Bearer ${adminInfo.token}`,
          },
          withCredentials: true,
        });
        if (!cancelled) setRow(res.data?.data || null);
      } catch (e) {
        notifyError(
          e.response?.data?.error ||
            cq("detail.toasts.loadFailed", "Failed to load cheque"),
        );
        if (!cancelled) setRow(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [id, adminInfo?.token]);

  const vendorName = useMemo(() => {
    if (!row?.vendorId) return "—";
    return (
      row.vendorId.basicInformation?.vendorDisplayName ||
      row.vendorId.basicInformation?.companyName ||
      "—"
    );
  }, [row]);

  const bankLabel = useMemo(() => {
    if (!row?.bankAccountId) return "—";
    return (
      [row.bankAccountId.accountName, row.bankAccountId.accountNumber, row.bankAccountId.bankName]
        .filter(Boolean)
        .join(" · ") || "—"
    );
  }, [row]);

  const businessName = useMemo(() => {
    if (!row) return "—";
    if (row.business_id && typeof row.business_id === "object" && row.business_id.name) {
      return row.business_id.name;
    }
    if (row.business_id && typeof row.business_id === "string") {
      return row.business_id;
    }
    return "—";
  }, [row]);

  const amountDisplay = useMemo(() => {
    if (!row || row.amount == null || row.amount === "") return "—";
    const n =
      typeof row.amount === "number" ? row.amount : parseFloat(String(row.amount).replace(/,/g, ""));
    return Number.isFinite(n) ? formatAmount(n) : String(row.amount);
  }, [row]);

  const attachments = useMemo(() => {
    if (!row) return [];
    const list = Array.isArray(row.attachments) ? [...row.attachments] : [];
    const leg = row.attachment;
    if (leg && leg.storageKey && !list.some((a) => a.storageKey === leg.storageKey)) {
      list.push({
        documentType: "additional_document",
        fileName: leg.fileName || cq("detail.attachmentFallback", "Attachment"),
        storageKey: leg.storageKey,
        mimeType: leg.mimeType,
      });
    }
    return list;
  }, [row, t]);

  const relatedInvoiceRows = useMemo(() => {
    if (!row) return [];
    const details = Array.isArray(row.relatedInvoiceDetails)
      ? row.relatedInvoiceDetails
      : [];
    if (details.length > 0) {
      return details.map((d) => {
        const rem =
          d.remainingAmount != null ? Number(d.remainingAmount) : Number(d.total ?? 0);
        const amt = Number.isFinite(rem) ? rem.toFixed(2) : null;
        return {
          id: String(d._id),
          label:
            d.invoiceNumber ||
            cq("detail.invoiceFallback", "Invoice {{idSuffix}}", {
              idSuffix: String(d._id).slice(-6),
            }),
          sub:
            amt != null
              ? cq(
                  "detail.remainingAmount",
                  "{{amount}} {{currency}} remaining",
                  { amount: amt, currency: d.currency || "MYR" },
                )
              : d.currency || null,
          paymentStatus: d.paymentStatus || null,
          amountPaid: d.amountPaid != null ? Number(d.amountPaid) : null,
        };
      });
    }
    const raw = Array.isArray(row.relatedInvoices) ? row.relatedInvoices : [];
    return raw
      .map((inv) => {
        if (inv && typeof inv === "object" && inv._id) {
          const rem =
            inv.remainingAmount != null ? Number(inv.remainingAmount) : Number(inv.total ?? 0);
          const amt = Number.isFinite(rem) ? rem.toFixed(2) : null;
          return {
            id: String(inv._id),
            label:
              inv.invoiceNumber ||
              cq("detail.invoiceFallback", "Invoice {{idSuffix}}", {
                idSuffix: String(inv._id).slice(-6),
              }),
            sub:
              amt != null
                ? cq(
                    "detail.remainingAmount",
                    "{{amount}} {{currency}} remaining",
                    { amount: amt, currency: inv.currency || "MYR" },
                  )
                : inv.currency || null,
            paymentStatus: inv.paymentStatus || null,
            amountPaid: inv.amountPaid != null ? Number(inv.amountPaid) : null,
          };
        }
        if (inv) {
          const sid = String(inv);
          return {
            id: sid,
            label: cq(
              "detail.invoiceFallbackShort",
              "Invoice {{idPrefix}}…",
              { idPrefix: sid.slice(0, 8) },
            ),
            sub: null,
            paymentStatus: null,
          };
        }
        return null;
      })
      .filter(Boolean);
  }, [row, t]);

  const relatedFallbackText = useMemo(() => {
    if (!row) return "";
    if (relatedInvoiceRows.length) return "";
    const labels = row.relatedInvoiceLabels;
    if (Array.isArray(labels) && labels.length) return labels.join(" · ");
    return row.relatedInvoice?.trim() || "";
  }, [row, relatedInvoiceRows.length]);

  const fetchAttachmentUrls = async (storageKey) => {
    const res = await axios.get(`${Base_URL}/cheques/${id}/attachment-url`, {
      params: { storageKey },
      headers: { authorization: `Bearer ${adminInfo.token}` },
      withCredentials: true,
    });
    return res.data?.data || res.data;
  };

  const handleOpenAttachment = async (storageKey) => {
    const key = `open:${storageKey}`;
    setAttachmentBusy(key);
    try {
      const { openUrl } = await fetchAttachmentUrls(storageKey);
      if (openUrl) window.open(openUrl, "_blank", "noopener,noreferrer");
      else notifyError(cq("detail.toasts.noFileUrl", "No file URL returned"));
    } catch (e) {
      notifyError(
        e.response?.data?.error ||
          cq("detail.toasts.openFileFailed", "Could not open file"),
      );
    } finally {
      setAttachmentBusy(null);
    }
  };

  const handleDownloadAttachment = async (storageKey, fileName) => {
    const key = `dl:${storageKey}`;
    setAttachmentBusy(key);
    try {
      const { downloadUrl, openUrl } = await fetchAttachmentUrls(storageKey);
      const url = downloadUrl || openUrl;
      if (!url) {
        notifyError(
          cq("detail.toasts.noDownloadUrl", "No download URL returned"),
        );
        return;
      }
      const a = document.createElement("a");
      a.href = url;
      a.setAttribute("download", fileName || "document");
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      notifyError(
        e.response?.data?.error ||
          cq("detail.toasts.downloadFileFailed", "Could not download file"),
      );
    } finally {
      setAttachmentBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-gray-50 dark:bg-gray-950">
        <Loader color="var(--p-blue)" />
      </div>
    );
  }

  if (!row) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="mx-auto w-full px-4 py-10 sm:px-6">
          <p className="text-gray-600 dark:text-gray-400">
            {cq("detail.notFound", "Cheque not found.")}
          </p>
          <Button type="button" className="mt-4" onClick={() => history.push("/Cheques")}>
            {cq("detail.backToList", "Back to list")}
          </Button>
        </div>
      </div>
    );
  }

  const statusApi = row.status === "Pending" ? "Draft" : row.status;
  const statusLabel = translateChequeStatus(t, row.status);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="mx-auto w-full py-6 px-4 sm:px-6">
        <div className="mb-5">
          <PageHeader
            title={cq("detail.title", "Cheque details")}
            showBackButton
            backFallbackPath="/Cheques"
          />
        </div>

        <div className="mb-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800/80">
          <div className="flex flex-col gap-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white px-6 py-5 dark:border-gray-700 dark:from-gray-900 dark:to-gray-800/80 lg:flex-row lg:items-start lg:justify-between">
            <div>
              {statusLabel ? (
                <span className="inline-flex rounded-md border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-slate-800 dark:border-gray-600 dark:bg-gray-900 dark:text-slate-200">
                  {statusLabel}
                </span>
              ) : null}
              <p className="mt-1.5 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Hash className="h-3.5 w-3.5 text-[var(--p-blue)]" aria-hidden />
                {row.chequeNumber || "—"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setHistoryOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
              >
                {cq("detail.statusHistory", "Status history")}
              </button>
              {!terminalStatuses.has(statusApi) ? (
                <button
                  type="button"
                  onClick={() => history.push(`/Cheques/${id}/edit`)}
                  className="inline-flex items-center gap-2 rounded-lg bg-[var(--p-blue)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--p-blue-dark)]"
                >
                  <Pencil className="h-4 w-4" aria-hidden />
                  {cq("detail.edit", "Edit")}
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-6">
            <SectionCard title={cq("detail.summary", "Summary")} icon={FileText}>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <DetailField label={cq("fields.chequeNumber", "Cheque number")}>
                  {row.chequeNumber || "—"}
                </DetailField>
                {!isSingleAssignedBusiness() && (
                <DetailField label={cq("fields.business", "Business")}>
                  {businessName}
                </DetailField>
                )}
                <DetailField label={cq("fields.vendor", "Vendor")}>
                  {vendorName}
                </DetailField>
                <DetailField label={cq("fields.bankAccount", "Bank account")}>
                  {bankLabel}
                </DetailField>
                <DetailField label={cq("fields.amount", "Amount")}>
                  {amountDisplay} {row.currency ? <span className="text-gray-500">{row.currency}</span> : null}
                </DetailField>
                <DetailField label={cq("fields.issueDate", "Issue date")}>
                  {formatDate(row.issueDate) || "—"}
                </DetailField>
                <DetailField label={cq("fields.dueDate", "Due date")}>
                  {formatDate(row.dueDate) || "—"}
                </DetailField>
                <DetailField label={cq("fields.clearedDateTime", "Cleared date & time")}>
                  {formatDate(row.clearedDate, false, true) || "—"}
                </DetailField>
                <DetailField label={cq("fields.status", "Status")}>
                  {statusLabel || "—"}
                </DetailField>
                <DetailField
                  label={cq(
                    "fields.reminderDaysBeforeDue",
                    "Reminder (days before due)",
                  )}
                >
                  {row.reminderDays != null ? row.reminderDays : "—"}
                </DetailField>
              </div>
              {(row.bounceReason || row.cancelledReason || row.replacedReason) && (
                <div className="mt-6 border-t border-gray-100 pt-6 dark:border-gray-700 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {row.bounceReason ? (
                    <DetailField label={cq("fields.bounceReason", "Bounce reason")}>
                      {row.bounceReason}
                    </DetailField>
                  ) : null}
                  {row.cancelledReason ? (
                    <DetailField
                      label={cq("fields.cancellationReason", "Cancellation reason")}
                    >
                      {row.cancelledReason}
                    </DetailField>
                  ) : null}
                  {row.replacedReason ? (
                    <DetailField
                      label={cq("fields.replacementReason", "Replacement reason")}
                    >
                      {row.replacedReason}
                    </DetailField>
                  ) : null}
                </div>
              )}
              {(row.replacedByChequeId || row.replacesChequeId) && (
                <div className="mt-6 border-t border-gray-100 pt-6 dark:border-gray-700">
                  <DetailField label={cq("detail.replacementLinks", "Replacement links")}>
                    <div className="space-y-2 text-sm">
                      {row.replacesChequeId?._id ? (
                        <p>
                          {cq("detail.replaces", "Replaces:")}{" "}
                          <ChequeNumberLink
                            chequeId={row.replacesChequeId._id}
                            chequeNumber={row.replacesChequeId.chequeNumber}
                          />
                        </p>
                      ) : null}
                      {row.replacedByChequeId?._id ? (
                        <p>
                          {cq("detail.replacedBy", "Replaced by:")}{" "}
                          <ChequeNumberLink
                            chequeId={row.replacedByChequeId._id}
                            chequeNumber={row.replacedByChequeId.chequeNumber}
                          />
                        </p>
                      ) : null}
                    </div>
                  </DetailField>
                </div>
              )}
              <div className="mt-6 border-t border-gray-100 pt-6 dark:border-gray-700">
                <DetailField label={cq("fields.paymentPurpose", "Payment purpose")}>
                  {row.paymentPurpose?.trim() ? (
                    <p className="whitespace-pre-wrap text-gray-800 dark:text-gray-200">{row.paymentPurpose}</p>
                  ) : (
                    "—"
                  )}
                </DetailField>
              </div>
            </SectionCard>

            <SectionCard
              title={cq("detail.relatedVendorInvoices", "Related vendor invoices")}
              icon={FileText}
            >
              {relatedInvoiceRows.length > 0 ? (
                <ul className="space-y-3">
                  {relatedInvoiceRows.map((r) => (
                    <li
                      key={r.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-100 bg-gray-50/80 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/50"
                    >
                      <div className="min-w-0">
                        <Link
                          to={`/view-vendor-invoice/${r.id}`}
                          className="inline-flex items-center gap-1.5 font-medium text-[var(--p-blue)] hover:underline dark:text-sky-400"
                        >
                          {r.label}
                          <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                        </Link>
                        {r.sub ? <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{r.sub}</p> : null}
                        {r.paymentStatus ? (
                          <span
                            className={`mt-1.5 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              r.paymentStatus === "Pending Clearance"
                                ? "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"
                                : r.paymentStatus === "Paid"
                                  ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200"
                                  : "bg-slate-100 text-slate-700 dark:bg-gray-800 dark:text-slate-300"
                            }`}
                          >
                            {translatePaymentStatus(r.paymentStatus)}
                            {r.amountPaid != null && r.paymentStatus !== "Paid"
                              ? cq(
                                  "detail.amountPaidSuffix",
                                  " · {{amount}} paid",
                                  { amount: r.amountPaid.toFixed(2) },
                                )
                              : ""}
                          </span>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : relatedFallbackText ? (
                <p className="text-sm text-gray-700 dark:text-gray-300">{relatedFallbackText}</p>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">—</p>
              )}
            </SectionCard>

            <SectionCard title={cq("detail.attachments", "Attachments")} icon={Paperclip}>
              {attachments.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">—</p>
              ) : (
                <ul className="space-y-3">
                  {attachments.map((a, i) => {
                    const docLabel = attachmentTypeLabel(a.documentType);
                    const displayName = a.fileName || docLabel;
                    const sk = a.storageKey;
                    const busyOpen = attachmentBusy === `open:${sk}`;
                    const busyDl = attachmentBusy === `dl:${sk}`;
                    return (
                      <li
                        key={`${sk}-${i}`}
                        className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-gray-50/80 px-4 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-700 dark:bg-gray-900/50"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            {docLabel}
                          </p>
                          <p className="mt-1 truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                            {displayName}
                          </p>
                          {sk ? (
                            <p className="mt-0.5 truncate font-mono text-[11px] text-gray-400 dark:text-gray-500">
                              {sk}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={!sk || busyOpen || busyDl}
                            onClick={() => handleOpenAttachment(sk)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-800 shadow-sm hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
                          >
                            {busyOpen ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                            ) : (
                              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                            )}
                            {cq("detail.open", "Open")}
                          </button>
                          <button
                            type="button"
                            disabled={!sk || busyOpen || busyDl}
                            onClick={() => handleDownloadAttachment(sk, displayName)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--p-blue)] px-3 py-2 text-xs font-medium text-white shadow-sm hover:opacity-95 disabled:opacity-50"
                          >
                            {busyDl ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                            ) : (
                              <Download className="h-3.5 w-3.5" aria-hidden />
                            )}
                            {cq("detail.download", "Download")}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </SectionCard>

            <SectionCard title={cq("detail.audit", "Audit")} icon={CalendarClock}>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <DetailField label={cq("fields.createdBy", "Created by")}>
                  {row.createdBy?.name || row.createdBy?.email || "—"}
                </DetailField>
                <DetailField label={cq("fields.updatedBy", "Updated by")}>
                  {row.updatedBy?.name || row.updatedBy?.email || "—"}
                </DetailField>
                <DetailField label={cq("fields.approvedBy", "Approved by")}>
                  {row.approvedBy?.name || row.approvedBy?.email || "—"}
                </DetailField>
                <DetailField label={cq("fields.createdAt", "Created at")}>
                  {formatDate(row.createdAt, false, true) || "—"}
                </DetailField>
                <DetailField label={cq("fields.updatedAt", "Updated at")}>
                  {formatDate(row.updatedAt, false, true) || "—"}
                </DetailField>
              </div>
            </SectionCard>
        </div>
      </div>
      <ChequeStatusHistoryModal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        cheque={row}
        adminToken={adminInfo?.token}
        checkTokenExpired={checkTokenExpired}
      />
    </div>
  );
};

export default ChequeDetail;
