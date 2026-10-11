import React, { useState, useEffect } from "react";
import {
  DropdownBasic,
  CustomModal,
} from "@/page-layouts/index";
import { notifySuccess, notifyError } from "@/utils/toast";
import axios from "axios";

const statusOptions = [
  { label: "Draft", value: "Draft" },
  {
    label: "Waiting Management Approval",
    value: "Waiting Management Approval",
  },
  { label: "Pending Management Review", value: "Pending Management Review" },
  { label: "Pending Accounts Review", value: "Pending Accounts Review" },
  {
    label: "Amendments Requested (Management)",
    value: "Amendments Requested (Management)",
  },
  {
    label: "Amendments Requested (Accounts)",
    value: "Amendments Requested (Accounts)",
  },
  { label: "Rejected (Management)", value: "Rejected (Management)" },
  { label: "Preparing Contract", value: "Preparing Contract" },
  { label: "Waiting Vendor Approval", value: "Waiting Vendor Approval" },
  { label: "Pending", value: "Pending" },
  { label: "Processing", value: "Processing" },
  { label: "On-hold", value: "On-hold" },
  { label: "Cancelled", value: "Cancelled" },
  { label: "Completed", value: "Completed" },
];

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

export default function ChangeStatusModal({
  onClose,
  contractId,
  currentStatus,
}) {
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
        `${Base_URL}/purchase-contracts/status/${contractId}`,
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
      label: "Cancel",
      secondary: true,
      onClick: onClose,
    },
    {
      label: loading ? "Updating..." : "Update Status",
      primary: true,
      onClick: handleStatusUpdate,
      disabled: loading || !selectedStatus,
    },
  ];

  return (
    <CustomModal
      open={true}
      onClose={onClose}
      title="Change Contract Status"
      actions={actions}
      width="500px"
      showActions={true}
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Current Status
          </label>
          <div className="px-3 py-2 bg-gray-100 rounded-lg text-sm">
            {currentStatus}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            New Status
          </label>
          <DropdownBasic
            options={statusOptions}
            value={selectedStatus}
            onChange={setSelectedStatus}
            placeholder="Select new status"
            className="w-full"
            sortOptions={false}
          />
        </div>
      </div>
    </CustomModal>
  );
}
