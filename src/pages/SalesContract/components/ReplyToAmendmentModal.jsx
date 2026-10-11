import React, { useState } from "react";
import { FiX, FiMessageSquare } from "react-icons/fi";
import request from "@/services/httpService";
import { notifySuccess, notifyError } from "@/utils/toast";
import { useTranslation } from "react-i18next";

const ReplyToAmendmentModal = ({ isOpen, onClose, contractId, contractNo, onSuccess }) => {
  const { t } = useTranslation();
  const [replyText, setReplyText] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!replyText.trim()) {
      notifyError("Please provide a reply to the amendment request");
      return;
    }

    setLoading(true);
    try {
      await request.put(`/sales-contracts/reply-to-amendment/${contractId}`, {
        replyToAmendment: replyText.trim()
      });

      notifySuccess("Amendment reply submitted successfully!");
      onSuccess?.();
      onClose();
      setReplyText("");
    } catch (error) {
      console.error("Error submitting amendment reply:", error);
      notifyError("Failed to submit amendment reply");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setReplyText("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <FiMessageSquare className="text-purple-500 text-xl" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {t("salesContract.amendment.replyTitle", {
                  defaultValue: "Reply to Amendment",
                })}
              </h2>
              <p className="text-sm text-gray-500">
                {t("salesContract.contract", { defaultValue: "Contract" })}: {contractNo}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <FiX className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("salesContract.amendment.yourReplyRequired", {
                defaultValue: "Your Reply *",
              })}
            </label>
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              rows={6}
              placeholder={t("salesContract.amendment.replyPlaceholder", {
                defaultValue: "Please provide your response to the amendment request...",
              })}
              required
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
            <div className="text-sm text-blue-800">
              <strong>{t("common.note", { defaultValue: "Note" })}:</strong>{" "}
              {t("salesContract.amendment.reviewNote", {
                defaultValue:
                  'Your reply will be sent to management for review. The contract status will be updated to "Waiting Management Approval".',
              })}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            {t("common.cancel", { defaultValue: "Cancel" })}
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !replyText.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? t("common.submitting", { defaultValue: "Submitting..." })
              : t("salesContract.amendment.submitReply", {
                  defaultValue: "Submit Reply",
                })}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReplyToAmendmentModal;
