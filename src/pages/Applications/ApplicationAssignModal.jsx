import React, { useEffect, useState } from "react";
import { CustomModal, DropdownBasic } from "@/page-layouts";
import { notifyError, notifySuccess } from "@/utils/toast";
import ApplicationServices from "@/services/ApplicationServices";

/**
 * Assign / reassign System User from the Applications list.
 */
const ApplicationAssignModal = ({
  open,
  onClose,
  application,
  authHeaders,
  checkTokenExpired,
  onSuccess,
}) => {
  const [systemUsers, setSystemUsers] = useState([]);
  const [userId, setUserId] = useState("");
  const [remarks, setRemarks] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !application) return;
    setUserId(application.assignedTo ? String(application.assignedTo) : "");
    setRemarks(application.assignmentRemarks || "");
  }, [open, application]);

  useEffect(() => {
    if (!open || !authHeaders?.authorization) return;
    let cancelled = false;
    (async () => {
      setLoadingUsers(true);
      try {
        const res = await ApplicationServices.getAssignableSystemUsers({
          headers: authHeaders,
          withCredentials: true,
        });
        if (checkTokenExpired?.(res)) return;
        const list = Array.isArray(res?.data?.data) ? res.data.data : [];
        if (!cancelled) setSystemUsers(list);
      } catch {
        if (!cancelled) setSystemUsers([]);
      } finally {
        if (!cancelled) setLoadingUsers(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, authHeaders, checkTokenExpired]);

  const handleClose = () => {
    if (saving) return;
    onClose?.();
  };

  const handleSave = async () => {
    if (!application?._id || !userId) {
      notifyError("Select a System User");
      return;
    }
    try {
      setSaving(true);
      const response = await ApplicationServices.assignApplication(
        application._id,
        { assignedTo: userId, remarks },
        { headers: authHeaders, withCredentials: true },
      );
      if (checkTokenExpired?.(response)) return;
      if (response.data?.status) {
        notifySuccess(response.data?.message || "Application assigned");
        onClose?.();
        if (typeof onSuccess === "function") await onSuccess();
      } else {
        notifyError(response.data?.message || "Failed to assign");
      }
    } catch (error) {
      notifyError(
        error?.response?.data?.message || "Failed to assign application",
      );
    } finally {
      setSaving(false);
    }
  };

  const ref =
    application?.applicationNumber || application?._id || "—";

  return (
    <CustomModal
      open={open}
      onClose={handleClose}
      title={`Assign — ${ref}`}
      width="480px"
      showActions
      actions={[
        {
          label: "Cancel",
          secondary: true,
          onClick: handleClose,
          disabled: saving,
        },
        {
          label: saving
            ? "Saving…"
            : application?.assignedTo
              ? "Reassign"
              : "Assign",
          primary: true,
          onClick: handleSave,
          disabled: saving || !userId || loadingUsers,
        },
      ]}
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-gray-600">
          Currently assigned:{" "}
          <span className="font-medium text-gray-900">
            {application?.assignedToName || "Unassigned"}
          </span>
        </p>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">System User</span>
          <DropdownBasic
            options={systemUsers.map((u) => ({
              value: u._id,
              label:
                [u.name, u.last_name].filter(Boolean).join(" ") || u.email,
            }))}
            value={userId}
            onChange={(val) => setUserId(val || "")}
            placeholder={
              loadingUsers ? "Loading users…" : "Select System User"
            }
            className="w-full"
            isDisabled={saving || loadingUsers}
            isClearable={false}
            sortOptions={false}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">Remarks</span>
          <textarea
            className="min-h-[72px] rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            disabled={saving}
            placeholder="Optional assignment remarks"
          />
        </label>
      </div>
    </CustomModal>
  );
};

export default ApplicationAssignModal;
