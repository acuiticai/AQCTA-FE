import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CustomModal, TextArea } from "@/page-layouts";
import { notifyError } from "@/utils/toast";
import { makeChequeT } from "@/utils/chequeI18n";

const ChequeReplaceModal = ({ open, onClose, cheque, onConfirm }) => {
  const { t } = useTranslation();
  const cq = makeChequeT(t);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) setReason("");
  }, [open, cheque?._id]);

  const handleConfirm = () => {
    if (!reason.trim()) {
      notifyError(
        cq(
          "modals.replace.validation.reasonRequired",
          "Please enter a replacement reason.",
        ),
      );
      return;
    }
    onConfirm?.(reason.trim());
    onClose();
  };

  return (
    <CustomModal
      open={open}
      onClose={onClose}
      title={cq("modals.replace.title", "Replace cheque")}
      width="480px"
      showActions
      actions={[
        {
          label: cq("modals.replace.cancel", "Cancel"),
          secondary: true,
          onClick: onClose,
        },
        {
          label: cq("modals.replace.continue", "Continue"),
          primary: true,
          onClick: handleConfirm,
        },
      ]}
    >
      <div className="space-y-3">
        {cheque ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {cq(
              "modals.replace.body",
              "Replace cheque {{chequeNumber}}. You will create a new cheque and the original will be marked Replaced.",
              { chequeNumber: cheque.chequeNumber || "" },
            )}
          </p>
        ) : null}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {cq("modals.replace.replacementReason", "Replacement reason")}{" "}
            <span className="text-red-500">*</span>
          </label>
          <TextArea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={cq(
              "modals.replace.placeholder",
              "Why is this cheque being replaced?",
            )}
          />
        </div>
      </div>
    </CustomModal>
  );
};

export default ChequeReplaceModal;
