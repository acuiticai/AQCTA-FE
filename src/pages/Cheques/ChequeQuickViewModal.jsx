import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useHistory } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CustomModal, Loader } from "@/page-layouts";
import { formatAmount, formatDate } from "@/components/formatAmount";
import { notifyError } from "@/utils/toast";
import ChequeNumberLink from "@/components/cheques/ChequeNumberLink";
import { makeChequeT, translateChequeStatus } from "@/utils/chequeI18n";
import { isSingleAssignedBusiness } from "@/utils/sessionAssignedBusinesses";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

function DetailRow({ label, children }) {
  return (
    <div className="grid grid-cols-[minmax(0,38%)] sm:grid-cols-[140px_1fr] gap-1 sm:gap-3 py-2 border-b border-slate-100 last:border-0 dark:border-gray-800">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">
        {label}
      </dt>
      <dd className="text-sm text-slate-900 dark:text-gray-100 break-words min-w-0">{children}</dd>
    </div>
  );
}

function ChequeQuickViewModal({ open, onClose, chequeId, token }) {
  const { t } = useTranslation();
  const cq = makeChequeT(t);
  const history = useHistory();
  const [loading, setLoading] = useState(false);
  const [row, setRow] = useState(null);

  useEffect(() => {
    if (!open || !chequeId || !token) {
      setRow(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${Base_URL}/cheques/${chequeId}`, {
          headers: {
            "Content-Type": "application/json",
            authorization: `Bearer ${token}`,
          },
          withCredentials: true,
        });
        if (!cancelled) setRow(res.data?.data || null);
      } catch (e) {
        if (!cancelled) {
          notifyError(
            e.response?.data?.error ||
              cq("modals.quickView.errors.loadFailed", "Failed to load cheque"),
          );
          setRow(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [open, chequeId, token]);

  const vendorName = useMemo(() => {
    if (!row?.vendorId) return "—";
    if (typeof row.vendorId === "object") {
      return (
        row.vendorId.basicInformation?.vendorDisplayName ||
        row.vendorId.basicInformation?.companyName ||
        "—"
      );
    }
    return "—";
  }, [row]);

  const bankLabel = useMemo(() => {
    if (!row?.bankAccountId || typeof row.bankAccountId !== "object") return "—";
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
    return "—";
  }, [row]);

  const amountDisplay = useMemo(() => {
    if (!row || row.amount == null || row.amount === "") return "—";
    const n =
      typeof row.amount === "number" ? row.amount : parseFloat(String(row.amount).replace(/,/g, ""));
    return Number.isFinite(n) ? formatAmount(n) : String(row.amount);
  }, [row]);

  const relatedLabels = useMemo(() => {
    if (!row) return [];
    if (Array.isArray(row.relatedInvoiceLabels) && row.relatedInvoiceLabels.length) {
      return row.relatedInvoiceLabels;
    }
    return [];
  }, [row]);

  const attachmentCount = Array.isArray(row?.attachments) ? row.attachments.length : 0;
  const statusLabel = row?.status
    ? translateChequeStatus(t, row.status)
    : "—";

  return (
    <CustomModal
      open={open}
      onClose={onClose}
      title={
        row?.chequeNumber
          ? cq("modals.quickView.titleWithNumber", "Cheque {{chequeNumber}}", {
              chequeNumber: row.chequeNumber,
            })
          : cq("modals.quickView.title", "Cheque details")
      }
      width="min(520px, 96vw)"
      showActions
      actions={[
        {
          label: cq("modals.quickView.close", "Close"),
          secondary: true,
          onClick: onClose,
        },
        {
          label: cq("modals.quickView.openFullPage", "Open full page"),
          onClick: () => {
            if (chequeId) history.push(`/Cheques/${chequeId}`);
            onClose();
          },
        },
      ]}
    >
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader color="var(--p-blue)" />
        </div>
      ) : !row ? (
        <p className="text-sm text-slate-500 py-6 text-center">
          {cq("modals.quickView.notFound", "Cheque not found.")}
        </p>
      ) : (
        <dl className="divide-y divide-slate-100 dark:divide-gray-800">
          <DetailRow label={cq("fields.chequeNumberShort", "Cheque #")}>
            <ChequeNumberLink chequeId={row._id} chequeNumber={row.chequeNumber} />
          </DetailRow>
          {!isSingleAssignedBusiness() && (
          <DetailRow label={cq("fields.business", "Business")}>{businessName}</DetailRow>
          )}
          <DetailRow label={cq("fields.vendor", "Vendor")}>{vendorName}</DetailRow>
          <DetailRow label={cq("fields.bank", "Bank")}>{bankLabel}</DetailRow>
          <DetailRow label={cq("fields.amount", "Amount")}>
            {amountDisplay}
            {row.currency ? ` ${row.currency}` : ""}
          </DetailRow>
          <DetailRow label={cq("fields.status", "Status")}>{statusLabel}</DetailRow>
          <DetailRow label={cq("fields.issueDate", "Issue date")}>
            {formatDate(row.issueDate) || "—"}
          </DetailRow>
          <DetailRow label={cq("fields.dueDate", "Due date")}>
            {formatDate(row.dueDate) || "—"}
          </DetailRow>
          <DetailRow label={cq("fields.cleared", "Cleared")}>
            {formatDate(row.clearedDate, false, true) || "—"}
          </DetailRow>
          <DetailRow label={cq("fields.reminder", "Reminder")}>
            {row.reminderDays != null
              ? cq("modals.quickView.reminderDays", "{{count}} day(s) before due", {
                  count: row.reminderDays,
                })
              : "—"}
          </DetailRow>
          {row.paymentPurpose?.trim() ? (
            <DetailRow label={cq("fields.purpose", "Purpose")}>
              <span className="whitespace-pre-wrap">{row.paymentPurpose}</span>
            </DetailRow>
          ) : null}
          {relatedLabels.length > 0 ? (
            <DetailRow label={cq("fields.invoices", "Invoices")}>
              <ul className="space-y-1 text-sm">
                {relatedLabels.map((label, i) => (
                  <li key={`${label}-${i}`}>{label}</li>
                ))}
              </ul>
            </DetailRow>
          ) : null}
          {row.bounceReason ? (
            <DetailRow label={cq("fields.bounceReason", "Bounce reason")}>
              {row.bounceReason}
            </DetailRow>
          ) : null}
          {row.cancelledReason ? (
            <DetailRow label={cq("fields.cancelReason", "Cancel reason")}>
              {row.cancelledReason}
            </DetailRow>
          ) : null}
          {row.replacedReason ? (
            <DetailRow label={cq("fields.replaceReason", "Replace reason")}>
              {row.replacedReason}
            </DetailRow>
          ) : null}
          <DetailRow label={cq("fields.attachments", "Attachments")}>
            {attachmentCount > 0
              ? cq("modals.quickView.attachmentsCount", "{{count}} file(s)", {
                  count: attachmentCount,
                })
              : "—"}
          </DetailRow>
        </dl>
      )}
    </CustomModal>
  );
}

export default ChequeQuickViewModal;
