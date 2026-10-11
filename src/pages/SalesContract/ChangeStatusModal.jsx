import React, { useState, useEffect } from "react";
import {
  DropdownBasic,
  CustomModal,
} from "@/page-layouts/index";
import { notifySuccess, notifyError } from "@/utils/toast";
import axios from "axios";
import { useTranslation } from "react-i18next";

const getStatusOptions = (t) => [
  { label: t("salesContract.status.draft", { defaultValue: "Draft" }), value: "Draft" },
  {
    label: t("salesContract.status.waitingManagementApproval", { defaultValue: "Waiting Management Approval" }),
    value: "Waiting Management Approval",
  },
  {
    label: t("salesContract.status.amendmentsRequestedManagement", { defaultValue: "Amendments Requested (Management)" }),
    value: "Amendments Requested (Management)",
  },
  {
    label: t("salesContract.status.amendmentsRequestedAccounts", { defaultValue: "Amendments Requested (Accounts)" }),
    value: "Amendments Requested (Accounts)",
  },
  { label: t("salesContract.status.rejectedManagement", { defaultValue: "Rejected (Management)" }), value: "Rejected (Management)" },
  { label: t("salesContract.status.preparingContract", { defaultValue: "Preparing Contract" }), value: "Preparing Contract" },
  { label: t("salesContract.status.waitingCustomerApproval", { defaultValue: "Waiting Customer Approval" }), value: "Waiting Customer Approval" },
  { label: t("salesContract.status.pending", { defaultValue: "Pending" }), value: "Pending" },
  { label: t("salesContract.status.processing", { defaultValue: "Processing" }), value: "Processing" },
  { label: t("salesContract.status.onHold", { defaultValue: "On-hold" }), value: "On-hold" },
  { label: t("salesContract.status.cancelled", { defaultValue: "Cancelled" }), value: "Cancelled" },
  { label: t("salesContract.status.completed", { defaultValue: "Completed" }), value: "Completed" },
];

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

export default function ChangeStatusModal({
  onClose,
  contractId,
  currentStatus,
}) {
  const { t } = useTranslation();
  const [selectedStatus, setSelectedStatus] = useState("");
  const [loading, setLoading] = useState(false);

  // Reset selected status when modal opens
  useEffect(() => {
    setSelectedStatus("");
  }, [currentStatus]);

  const handleStatusUpdate = async () => {
    if (!selectedStatus) return;

    try {
      setLoading(true);
      await axios.put(
        `${Base_URL}/sales-contracts/status/${contractId}`,
        {
          status: selectedStatus,
        }
      );
      notifySuccess(
        `Status updated from "${currentStatus}" to "${selectedStatus}"`,
        () => {
          onClose();
          window.location.reload();
        }
      );
    } catch (error) {
      notifyError("Failed to update status. Please try again.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const actions = [
    {
      label: t("common.cancel", { defaultValue: "Cancel" }),
      secondary: true,
      onClick: onClose,
    },
    {
      label: loading
        ? t("common.updating", { defaultValue: "Updating..." })
        : t("salesContract.status.update", { defaultValue: "Update Status" }),
      primary: true,
      onClick: handleStatusUpdate,
      disabled: loading || !selectedStatus,
    },
  ];

  return (
    <CustomModal
      open={true}
      onClose={onClose}
      title={t("salesContract.status.changeTitle", { defaultValue: "Change Contract Status" })}
      actions={actions}
      width="500px"
      showActions={true}
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t("salesContract.status.current", { defaultValue: "Current Status" })}
          </label>
          <div className="px-3 py-2 bg-gray-100 rounded-lg text-sm">
            {currentStatus}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t("salesContract.status.new", { defaultValue: "New Status" })}
          </label>
          <DropdownBasic
            options={getStatusOptions(t)}
            value={selectedStatus}
            onChange={setSelectedStatus}
            placeholder={t("salesContract.status.selectNew", {
              defaultValue: "Select new status",
            })}
            className="w-full"
            sortOptions={false}
          />
        </div>
      </div>
    </CustomModal>
  );
}
