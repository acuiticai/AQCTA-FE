import { useState } from "react";
import { CustomModal } from "@/page-layouts";
import { notifyError, notifySuccess } from "@/utils/toast";
import ApplicationServices from "@/services/ApplicationServices";

const SYSTEM_DRIVEN_STATUSES = ["Resubmitted"];

/**
 * Admin status changes that need review API + modal vs plain PATCH.
 */
export function useApplicationStatusChange({
  authHeaders,
  checkTokenExpired,
  onSuccess,
}) {
  const [pending, setPending] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionRemarks, setActionRemarks] = useState("");
  const [requiredInfo, setRequiredInfo] = useState("");
  const [approveRemarks, setApproveRemarks] = useState("");
  const [loading, setLoading] = useState(false);

  const closePending = () => {
    if (loading) return;
    setPending(null);
    setRejectReason("");
    setActionRemarks("");
    setRequiredInfo("");
    setApproveRemarks("");
  };

  const refresh = async () => {
    if (typeof onSuccess === "function") {
      await onSuccess();
    }
  };

  const applyDirectStatus = async (id, status) => {
    try {
      setLoading(true);
      setPending({ row: { _id: id }, targetStatus: status, mode: "direct" });
      const response = await ApplicationServices.updateApplicationStatus(
        id,
        { status },
        { headers: authHeaders, withCredentials: true },
      );
      if (checkTokenExpired(response)) return;
      if (response.data?.status) {
        notifySuccess("Status updated");
        await refresh();
      } else {
        notifyError(response.data?.message || "Failed to update status");
      }
    } catch (error) {
      notifyError(
        error?.response?.data?.message || "Failed to update status",
      );
    } finally {
      setLoading(false);
      setPending(null);
    }
  };

  const handleStatusChange = (application, newStatus) => {
    const row =
      application && typeof application === "object"
        ? application
        : { _id: application };
    const id = row._id;
    if (!id) return;

    const currentStatus = row.status || "Draft";

    if (newStatus === currentStatus) return;

    if (SYSTEM_DRIVEN_STATUSES.includes(newStatus)) {
      notifyError(
        "This status is set automatically when the customer resubmits.",
      );
      return;
    }

    if (newStatus === "Draft" && currentStatus !== "Draft") {
      notifyError("Cannot revert a submitted application to Draft.");
      return;
    }

    if (newStatus === "Rejected") {
      setRejectReason("");
      setPending({ row, targetStatus: "Rejected", mode: "reject" });
      return;
    }

    if (newStatus === "Action Required") {
      setActionRemarks("");
      setRequiredInfo("");
      setPending({ row, targetStatus: "Action Required", mode: "action_required" });
      return;
    }

    if (newStatus === "Approved") {
      setApproveRemarks("");
      setPending({ row, targetStatus: "Approved", mode: "approve" });
      return;
    }

    applyDirectStatus(id, newStatus);
  };

  const confirmReject = async () => {
    if (!pending?.row?._id) return;
    const reason = String(rejectReason || "").trim();
    if (!reason) {
      notifyError("Rejection reason is required");
      return;
    }
    try {
      setLoading(true);
      const response = await ApplicationServices.reviewApplication(
        pending.row._id,
        { outcome: "reject", remarks: reason },
        { headers: authHeaders, withCredentials: true },
      );
      if (checkTokenExpired(response)) return;
      if (response.data?.status) {
        notifySuccess(response.data?.message || "Application rejected");
        closePending();
        await refresh();
      } else {
        notifyError(response.data?.message || "Failed to reject application");
      }
    } catch (error) {
      notifyError(
        error?.response?.data?.message || "Failed to reject application",
      );
    } finally {
      setLoading(false);
    }
  };

  const confirmActionRequired = async () => {
    if (!pending?.row?._id) return;
    const remarks = String(actionRemarks || "").trim();
    const info = String(requiredInfo || "").trim();
    if (!remarks && !info) {
      notifyError(
        "Please describe what the customer must provide (remarks and/or required information).",
      );
      return;
    }
    try {
      setLoading(true);
      const response = await ApplicationServices.reviewApplication(
        pending.row._id,
        { outcome: "request_info", remarks, requiredInfo: info },
        { headers: authHeaders, withCredentials: true },
      );
      if (checkTokenExpired(response)) return;
      if (response.data?.status) {
        notifySuccess(
          response.data?.message ||
            "Modification requested — customer can update and resubmit the same application",
        );
        closePending();
        await refresh();
      } else {
        notifyError(
          response.data?.message || "Failed to request additional information",
        );
      }
    } catch (error) {
      notifyError(
        error?.response?.data?.message ||
          "Failed to request additional information",
      );
    } finally {
      setLoading(false);
    }
  };

  const confirmApprove = async () => {
    if (!pending?.row?._id) return;
    try {
      setLoading(true);
      const remarks = String(approveRemarks || "").trim();
      const response = await ApplicationServices.reviewApplication(
        pending.row._id,
        { outcome: "approve", remarks },
        { headers: authHeaders, withCredentials: true },
      );
      if (checkTokenExpired(response)) return;
      if (response.data?.status) {
        notifySuccess(
          response.data?.message || "Application approved — eligible for Costing",
        );
        closePending();
        await refresh();
      } else {
        notifyError(response.data?.message || "Failed to approve application");
      }
    } catch (error) {
      notifyError(
        error?.response?.data?.message || "Failed to approve application",
      );
    } finally {
      setLoading(false);
    }
  };

  const statusUpdatingId =
    loading && pending?.row?._id ? pending.row._id : null;

  const appLabel =
    pending?.row?.applicationNumber ||
    pending?.row?.application_number ||
    "this application";

  // Return JSX (not an inline component) so typing does not remount the modal.
  const statusModals = (
    <>
      <CustomModal
        open={pending?.mode === "reject"}
        onClose={closePending}
        title="Reject Application"
        width="480px"
        showActions
        actions={[
          {
            label: "Cancel",
            secondary: true,
            onClick: closePending,
            disabled: loading,
          },
          {
            label: loading ? "Rejecting..." : "Reject",
            failure: true,
            disabled: loading,
            onClick: confirmReject,
          },
        ]}
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            Reject <span className="font-semibold">{appLabel}</span>. Use this
            only when the application is not acceptable. To ask the customer to
            correct details and resubmit the same application, choose{" "}
            <span className="font-semibold">Request Modification</span> instead
            — that is not a rejection.
          </p>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Rejection reason <span className="text-red-500">*</span>
            </label>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              rows={4}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Explain why this application is rejected…"
            />
          </div>
        </div>
      </CustomModal>

      <CustomModal
        open={pending?.mode === "action_required"}
        onClose={closePending}
        title="Request Modification"
        width="520px"
        showActions
        actions={[
          {
            label: "Cancel",
            secondary: true,
            onClick: closePending,
            disabled: loading,
          },
          {
            label: loading ? "Saving..." : "Send to Customer",
            disabled: loading,
            onClick: confirmActionRequired,
          },
        ]}
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            Ask the customer to modify{" "}
            <span className="font-semibold">{appLabel}</span>. This is{" "}
            <span className="font-semibold">not a rejection</span> — they edit
            and resubmit the same application (status becomes Action Required,
            then Resubmitted).
          </p>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Message to customer{" "}
              <span className="text-xs font-normal text-gray-500">
                (remarks)
              </span>
            </label>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              rows={3}
              value={actionRemarks}
              onChange={(e) => setActionRemarks(e.target.value)}
              placeholder="e.g. Please upload revised test reports and clarify manufacturing location…"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              What to change / provide{" "}
              <span className="text-xs font-normal text-gray-500">
                (shown as a checklist to customer)
              </span>
            </label>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              rows={3}
              value={requiredInfo}
              onChange={(e) => setRequiredInfo(e.target.value)}
              placeholder="e.g. Updated ISO certificate, Factory layout drawing, Signed declaration…"
            />
          </div>
          <p className="text-xs text-gray-500">
            At least one field is required. The customer keeps the same
            application number when they resubmit.
          </p>
        </div>
      </CustomModal>

      <CustomModal
        open={pending?.mode === "approve"}
        onClose={closePending}
        title="Approve Application"
        width="480px"
        showActions
        actions={[
          {
            label: "Cancel",
            secondary: true,
            onClick: closePending,
            disabled: loading,
          },
          {
            label: loading ? "Approving..." : "Approve",
            disabled: loading,
            onClick: confirmApprove,
          },
        ]}
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            Approve <span className="font-semibold">{appLabel}</span>. The
            application will move to Approved and become eligible for Costing.
          </p>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Approval note{" "}
              <span className="text-xs font-normal text-gray-500">
                (optional, visible to customer)
              </span>
            </label>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              rows={3}
              value={approveRemarks}
              onChange={(e) => setApproveRemarks(e.target.value)}
              placeholder="Optional note for the customer…"
            />
          </div>
        </div>
      </CustomModal>
    </>
  );

  return {
    handleStatusChange,
    statusUpdatingId,
    statusModals,
  };
}
