import React, { useState } from "react";
import { FiAlertTriangle } from "react-icons/fi";
import { CustomModal } from "@/page-layouts/index";
import { formatAmount, formatDate } from "@/components/formatAmount";
import { notifyError, notifySuccess } from "@/utils/toast";
import BankReconciliationServices from "@/services/BankReconciliationServices";

/**
 * Confirms deleting a draft or an un-reconciled period. A completed period never
 * reaches here — it is reversed through UnreconcileModal first. Deleting an
 * un-reconciled period also discards the record of why it was reversed, so the
 * wording warns about that; for a draft it simply reassures: nothing posted is
 * affected.
 */
const DeleteDraftModal = ({ reconciliation, currency, onClose, onDeleted }) => {
  const [submitting, setSubmitting] = useState(false);
  const isDraft = reconciliation.status === "draft";
  const isReconciled = reconciliation.status === "reconciled";

  const handleConfirm = async () => {
    try {
      setSubmitting(true);
      await BankReconciliationServices.deleteDraft(reconciliation._id);
      notifySuccess(isDraft ? "Draft deleted" : "Reconciliation deleted");
      onDeleted?.();
    } catch (error) {
      notifyError(
        error?.response?.data?.message || "Unable to delete this reconciliation"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CustomModal
      open
      title={
        isDraft
          ? "Delete Draft Reconciliation"
          : isReconciled
          ? "Delete Reconciled Period"
          : "Delete Un-reconciled Period"
      }
      width="min(520px, 92vw)"
      style={{ maxWidth: "92vw", padding: "24px" }}
      onClose={onClose}
      onConfirm={handleConfirm}
      loading={submitting}
      confirmText={isDraft ? "Delete Draft" : "Delete"}
      savingText="Deleting..."
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2 text-sm">
          <FiAlertTriangle className="mt-0.5 shrink-0" />
          <span>
            {isDraft ? (
              <>
                This removes the draft and everything ticked on it. No
                transaction is deleted and nothing already reconciled is
                affected — you can start the period again at any time.
              </>
            ) : isReconciled ? (
              <>
                This removes a <strong>completed</strong> reconciliation and{" "}
                <strong>unlocks the transactions it cleared</strong> so they can
                be edited again. No transaction is deleted. Only allowed when no
                later period depends on this one; you can reconcile the period
                again afterwards.
              </>
            ) : (
              <>
                This permanently removes this un-reconciled period, including
                the record of why it was reversed. No transaction is deleted —
                you can reconcile the period again at any time.
              </>
            )}
          </span>
        </div>

        <div className="bg-[#F9F9FA] rounded-lg p-4 text-sm">
          <div className="flex items-center justify-between py-1">
            <span className="text-gray-600">Period</span>
            <span className="text-gray-800 font-medium">
              {formatDate(reconciliation.startDate)} to{" "}
              {formatDate(reconciliation.endDate)}
            </span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-gray-600">Closing Balance</span>
            <span className="text-gray-800 font-medium">
              {currency} {formatAmount(reconciliation.closingBalance)}
            </span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-gray-600">Transactions ticked</span>
            <span className="text-gray-800 font-medium">
              {reconciliation.clearedTransactions?.length || 0}
            </span>
          </div>
        </div>
      </div>
    </CustomModal>
  );
};

export default DeleteDraftModal;
