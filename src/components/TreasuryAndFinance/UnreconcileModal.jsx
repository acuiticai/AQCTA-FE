import React, { useState } from "react";
import { FiAlertTriangle } from "react-icons/fi";
import { CustomModal, TextAreaField } from "@/page-layouts/index";
import { formatDate } from "@/components/formatAmount";
import { notifyError, notifySuccess } from "@/utils/toast";
import BankReconciliationServices from "@/services/BankReconciliationServices";

/**
 * Reversing a signed-off period is the one action that can undo finalised books,
 * so it asks for a reason and states plainly what is about to happen.
 */
const UnreconcileModal = ({ reconciliation, onClose, onDone }) => {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!reason.trim()) {
      notifyError("A reason is required to un-reconcile a period");
      return;
    }

    try {
      setSubmitting(true);
      await BankReconciliationServices.unreconcile(
        reconciliation._id,
        reason.trim()
      );
      notifySuccess("Period un-reconciled");
      onDone?.();
    } catch (error) {
      notifyError(
        error?.response?.data?.message || "Unable to un-reconcile this period"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CustomModal
      open
      title="Un-reconcile Period"
      width="min(520px, 92vw)"
      style={{ maxWidth: "92vw", padding: "24px" }}
      onClose={onClose}
      onConfirm={handleConfirm}
      loading={submitting}
      disabled={!reason.trim()}
      confirmText="Un-reconcile"
      savingText="Reversing..."
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2 text-sm">
          <FiAlertTriangle className="mt-0.5 shrink-0" />
          <span>
            This unlocks every transaction cleared in{" "}
            <strong>
              {formatDate(reconciliation.startDate)} to{" "}
              {formatDate(reconciliation.endDate)}
            </strong>
            , allowing them to be edited again. The reconciliation is kept on
            record with your reason.
          </span>
        </div>

        <div className="flex flex-col">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reason <span className="text-red-500">*</span>
          </label>
          <TextAreaField
            name="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Bank charge was posted to the wrong account and needs correcting"
          />
        </div>
      </div>
    </CustomModal>
  );
};

export default UnreconcileModal;
