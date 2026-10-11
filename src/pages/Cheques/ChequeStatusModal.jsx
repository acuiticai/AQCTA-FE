import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { CustomModal, DropdownBasic, TextArea } from "@/page-layouts";
import CustomDatePicker from "@/components/CustomDatePicker";
import ChequeNumberLink from "@/components/cheques/ChequeNumberLink";
import { formatDate } from "@/components/formatAmount";
import { notifyError, notifySuccess } from "@/utils/toast";
import {
  CHEQUE_STATUS_KEY,
  makeChequeT,
  translateChequeStatus,
} from "@/utils/chequeI18n";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

export const CHEQUE_STATUS_OPTIONS = [
  {
    value: "Draft",
    label: "Draft",
    description: "Cheque record created but not issued",
  },
  {
    value: "Issued",
    label: "Issued",
    description: "Cheque handed over to vendor",
  },
  {
    value: "Due Soon",
    label: "Due Soon",
    description: "Cheque due date approaching",
  },
  {
    value: "Cleared",
    label: "Cleared",
    description: "Cheque successfully cleared",
  },
  {
    value: "Bounced",
    label: "Bounced",
    description: "Cheque rejected by bank",
  },
  {
    value: "Cancelled",
    label: "Cancelled",
    description: "Cheque cancelled",
  },
  {
    value: "Replaced",
    label: "Replaced",
    description: "Cheque replaced with another cheque",
  },
];

function normalizeStatus(s) {
  return s === "Pending" ? "Draft" : s;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

export function issueDateAllowsBankOutcome(issueDate) {
  if (!issueDate) return false;
  return startOfDay(new Date()) >= startOfDay(issueDate);
}

const ChequeStatusModal = ({
  open,
  onClose,
  cheque,
  adminToken,
  onSuccess,
  checkTokenExpired,
  /** When set, opens directly for this target status (list quick actions). */
  presetStatus = null,
}) => {
  const { t } = useTranslation();
  const cq = makeChequeT(t);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [reason, setReason] = useState("");
  const [replacementChequeId, setReplacementChequeId] = useState("");
  const [clearedDate, setClearedDate] = useState(null);
  const [loading, setLoading] = useState(false);

  const currentStatus = cheque ? normalizeStatus(cheque.status) : "";
  const lockedPreset =
    presetStatus && CHEQUE_STATUS_OPTIONS.some((o) => o.value === presetStatus)
      ? presetStatus
      : null;

  useEffect(() => {
    if (!open) return;
    setSelectedStatus(lockedPreset || "");
    setReason("");
    setReplacementChequeId("");
    setClearedDate(new Date());
  }, [open, cheque?._id, lockedPreset]);

  const statusOptions = useMemo(() => {
    return CHEQUE_STATUS_OPTIONS.filter((o) => o.value !== currentStatus).map(
      (o) => ({
        value: o.value,
        label: translateChequeStatus(t, o.value),
      }),
    );
  }, [currentStatus, t]);

  const selectedMeta = CHEQUE_STATUS_OPTIONS.find(
    (o) => o.value === selectedStatus,
  );

  const selectedDescription = (() => {
    if (!selectedMeta?.description) return "";
    const key = CHEQUE_STATUS_KEY[selectedMeta.value];
    if (!key) return selectedMeta.description;
    return cq(
      `statuses.descriptions.${key}`,
      selectedMeta.description,
    );
  })();

  const needsReason =
    selectedStatus === "Bounced" ||
    selectedStatus === "Cancelled" ||
    selectedStatus === "Replaced";
  const needsReplacementId = selectedStatus === "Replaced";
  const needsClearedDate = selectedStatus === "Cleared";
  const bankOutcomeBlocked =
    (selectedStatus === "Cleared" || selectedStatus === "Bounced") &&
    cheque &&
    !issueDateAllowsBankOutcome(cheque.issueDate);

  const handleSubmit = async () => {
    if (!cheque?._id || !selectedStatus) return;
    if (needsReason && !reason.trim()) {
      notifyError(
        selectedStatus === "Bounced"
          ? cq(
              "modals.status.validation.bounceReasonRequired",
              "Please enter a bounce reason.",
            )
          : selectedStatus === "Replaced"
            ? cq(
                "modals.status.validation.replacementReasonRequired",
                "Please enter a replacement reason.",
              )
            : cq(
                "modals.status.validation.cancellationReasonRequired",
                "Please enter a cancellation reason.",
              ),
      );
      return;
    }
    if (needsReplacementId && !replacementChequeId.trim()) {
      notifyError(
        cq(
          "modals.status.validation.replacementChequeIdRequired",
          "Please enter the replacement cheque ID.",
        ),
      );
      return;
    }
    if (bankOutcomeBlocked) {
      notifyError(
        cq(
          "modals.status.validation.bankOutcomeTooEarly",
          "Cannot mark as Cleared or Bounced before the issue date has passed.",
        ),
      );
      return;
    }

    try {
      setLoading(true);
      const body = { status: selectedStatus };
      if (needsReason) body.reason = reason.trim();
      if (needsReplacementId) body.replacementChequeId = replacementChequeId.trim();
      if (needsClearedDate && clearedDate) {
        body.clearedDate = new Date(clearedDate).toISOString();
      }
      const res = await axios.patch(
        `${Base_URL}/cheques/${cheque._id}/status`,
        body,
        {
          headers: {
            "Content-Type": "application/json",
            authorization: `Bearer ${adminToken}`,
          },
          withCredentials: true,
        },
      );
      if (checkTokenExpired?.(res)) return;
      const paidCount = res.data?.invoicesMarkedPaid?.length ?? 0;
      if (selectedStatus === "Cleared" && paidCount > 0) {
        notifySuccess(
          cq(
            "modals.status.toasts.clearedWithInvoices",
            "Cheque cleared. {{count}} linked invoice marked as paid.",
            { count: paidCount },
          ),
        );
      } else {
        notifySuccess(
          cq(
            "modals.status.toasts.statusUpdatedTo",
            "Status updated to {{status}}",
            { status: translateChequeStatus(t, selectedStatus) },
          ),
        );
      }
      onSuccess?.();
      onClose();
    } catch (e) {
      notifyError(
        e.response?.data?.error ||
          cq("modals.status.toasts.updateFailed", "Failed to update status"),
      );
    } finally {
      setLoading(false);
    }
  };

  const submitLabel = lockedPreset
    ? lockedPreset === "Cleared"
      ? cq("modals.status.submitMarkCleared", "Mark as cleared")
      : lockedPreset === "Bounced"
        ? cq("modals.status.submitMarkBounced", "Mark as bounced")
        : lockedPreset === "Cancelled"
          ? cq("modals.status.submitCancelCheque", "Cancel cheque")
          : cq("modals.status.submitConfirm", "Confirm")
    : cq("modals.status.submitUpdate", "Update status");

  const actions = [
    {
      label: cq("modals.status.close", "Close"),
      secondary: true,
      onClick: onClose,
    },
    {
      label: loading
        ? cq("modals.status.saving", "Saving…")
        : submitLabel,
      primary: true,
      onClick: handleSubmit,
      disabled:
        loading ||
        !selectedStatus ||
        (needsReason && !reason.trim()) ||
        (needsReplacementId && !replacementChequeId.trim()) ||
        bankOutcomeBlocked,
    },
  ];

  const modalTitle = lockedPreset
    ? lockedPreset === "Cleared"
      ? cq("modals.status.titleMarkCleared", "Mark as cleared")
      : lockedPreset === "Bounced"
        ? cq("modals.status.titleMarkBounced", "Mark as bounced")
        : lockedPreset === "Cancelled"
          ? cq("modals.status.titleCancelCheque", "Cancel cheque")
          : cq("modals.status.title", "Update cheque status")
    : cq("modals.status.title", "Update cheque status");

  const reasonLabel =
    selectedStatus === "Bounced"
      ? cq("modals.status.bounceReason", "Bounce reason")
      : selectedStatus === "Replaced"
        ? cq("modals.status.replacementReason", "Replacement reason")
        : cq("modals.status.cancellationReason", "Cancellation reason");

  const reasonPlaceholder =
    selectedStatus === "Bounced"
      ? cq(
          "modals.status.placeholders.bounceReason",
          "Why was this cheque bounced?",
        )
      : selectedStatus === "Replaced"
        ? cq(
            "modals.status.placeholders.replacementReason",
            "Why is this cheque being replaced?",
          )
        : cq(
            "modals.status.placeholders.cancellationReason",
            "Why was this cheque cancelled?",
          );

  return (
    <CustomModal
      open={open}
      onClose={onClose}
      title={modalTitle}
      actions={actions}
      width="520px"
      showActions
    >
      <div className="space-y-4">
        {cheque && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {cq("modals.status.chequeLabel", "Cheque")}{" "}
            <ChequeNumberLink
              chequeId={cheque._id}
              chequeNumber={cheque.chequeNumber || cheque._id}
              className="font-semibold"
            />
          </p>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {cq("modals.status.currentStatus", "Current status")}
          </label>
          <div className="px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm">
            {currentStatus
              ? translateChequeStatus(t, currentStatus)
              : "—"}
          </div>
        </div>

        {!lockedPreset ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {cq("modals.status.newStatus", "New status")}
            </label>
            <DropdownBasic
              options={statusOptions}
              value={selectedStatus}
              onChange={setSelectedStatus}
              placeholder={cq(
                "modals.status.selectNewStatus",
                "Select new status",
              )}
              className="w-full"
              sortOptions={false}
            />
            {selectedDescription && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {selectedDescription}
              </p>
            )}
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {cq("modals.status.newStatus", "New status")}
            </label>
            <div className="px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm font-medium">
              {translateChequeStatus(t, lockedPreset)}
            </div>
            {selectedDescription && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {selectedDescription}
              </p>
            )}
          </div>
        )}

        {bankOutcomeBlocked && (
          <p className="text-sm text-red-600">
            {cq(
              "modals.status.bankOutcomeBlocked",
              "Issue date must be today or earlier before marking as Cleared or Bounced.",
            )}
            {cheque?.issueDate
              ? cq(
                  "modals.status.bankOutcomeIssueDate",
                  " (Issue date: {{date}})",
                  { date: formatDate(cheque.issueDate) || "—" },
                )
              : cq(
                  "modals.status.bankOutcomeSetIssueDate",
                  " Set an issue date on the cheque first.",
                )}
          </p>
        )}

        {needsReason && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {reasonLabel}
              <span className="text-red-500"> *</span>
            </label>
            <TextArea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={reasonPlaceholder}
              rows={3}
            />
          </div>
        )}

        {needsReplacementId && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {cq(
                "modals.status.replacementChequeId",
                "Replacement cheque ID",
              )}
              <span className="text-red-500"> *</span>
            </label>
            <input
              type="text"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm dark:bg-gray-900"
              value={replacementChequeId}
              onChange={(e) => setReplacementChequeId(e.target.value)}
              placeholder={cq(
                "modals.status.placeholders.replacementChequeId",
                "ID of the new replacement cheque",
              )}
            />
            <p className="mt-1 text-xs text-gray-500">
              {cq(
                "modals.status.replacementIdHint",
                "Or use Replace on the list to create a linked replacement automatically.",
              )}
            </p>
          </div>
        )}

        {needsClearedDate && !bankOutcomeBlocked && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {cq("modals.status.clearedDateTime", "Cleared date & time")}
            </label>
            <CustomDatePicker
              value={clearedDate}
              onChange={(date) => setClearedDate(date)}
              showTimeSelect
              clearable={false}
            />
          </div>
        )}
      </div>
    </CustomModal>
  );
};

export default ChequeStatusModal;
