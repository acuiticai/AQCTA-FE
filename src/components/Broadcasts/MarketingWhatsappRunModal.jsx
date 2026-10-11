import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { CustomModal } from "@/page-layouts";
import { notifyError, notifySuccess } from "@/utils/toast";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
const POLL_MS = 2000;

const STATUS_STYLES = {
  pending: "bg-amber-100 text-amber-800",
  sending: "bg-blue-100 text-blue-800",
  sent: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  skipped: "bg-gray-100 text-gray-600",
  replied: "bg-purple-100 text-purple-800",
};

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

/** Resume only when send stopped — not while cron is actively processing this go. */
function canResumeDelivery(delivery, runInProgress) {
  if (delivery.status === "failed") return true;
  if (delivery.status === "pending" && !runInProgress) return true;
  return false;
}

function deliveryDetailsText(delivery, runInProgress) {
  if (delivery.status === "sent") return null;
  if (delivery.status === "failed") return null;
  if (delivery.status === "sending") {
    return "Sending…";
  }
  if (delivery.status === "pending") {
    return runInProgress
      ? "Queued — sending in progress…"
      : "Not sent — use Resume";
  }
  return "—";
}

function latestReply(delivery) {
  const replies = delivery?.replies || [];
  if (!replies.length) return null;
  return replies[replies.length - 1];
}

function deliveryStatusLabel(delivery) {
  if ((delivery?.replies || []).length > 0) return "replied";
  return delivery?.status || "pending";
}

const MarketingWhatsappRunModal = ({
  open,
  onClose,
  announcementId,
  announcementTitle,
  authHeaders,
  checkTokenExpired,
  onResendComplete,
}) => {
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [run, setRun] = useState(null);

  const fetchCurrentRun = useCallback(
    async ({ silent = false } = {}) => {
      if (!announcementId || !authHeaders?.authorization) return;
      try {
        if (!silent) setLoading(true);
        const response = await axios.get(
          `${Base_URL}/broadcasts/${announcementId}/whatsapp-run/current`,
          { headers: authHeaders },
        );
        if (checkTokenExpired?.(response)) return;
        setRun(response.data?.data || null);
      } catch (error) {
        if (!silent) {
          notifyError(
            error.response?.data?.error || "Failed to load WhatsApp delivery log",
          );
          setRun(null);
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [announcementId, authHeaders, checkTokenExpired],
  );

  useEffect(() => {
    if (open) fetchCurrentRun();
    else setRun(null);
  }, [open, fetchCurrentRun]);

  /** Refresh while sending or while waiting for client replies on sent messages. */
  useEffect(() => {
    if (!open || !run) return undefined;
    const awaitingReplies = (run.deliveries || []).some(
      (d) => d.status === "sent" && !(d.replies || []).length,
    );
    if (run.status !== "in_progress" && !awaitingReplies) return undefined;
    const interval = setInterval(() => {
      fetchCurrentRun({ silent: true });
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [open, run?.status, run?._id, run?.deliveries, fetchCurrentRun]);

  const postResume = async (body) => {
    try {
      setResending(true);
      const response = await axios.post(
        `${Base_URL}/broadcasts/${announcementId}/whatsapp-resend`,
        body,
        { headers: authHeaders },
      );
      if (checkTokenExpired?.(response)) return;
      notifySuccess(
        `Done: ${response.data?.sent ?? 0} sent, ${response.data?.failed ?? 0} failed`,
      );
      setRun(response.data?.data || null);
      onResendComplete?.();
      fetchCurrentRun({ silent: true });
    } catch (error) {
      notifyError(error.response?.data?.error || "Re-send failed");
    } finally {
      setResending(false);
    }
  };

  const handleResendAllFailed = () => postResume({ mode: "failed" });
  const handleResumePending = () => postResume({ mode: "pending" });
  const handleResumeAllStuck = () => postResume({ mode: "all" });

  const handleResendOne = (recipientId, status) => {
    const mode = status === "failed" ? "failed" : "pending";
    postResume({ recipientIds: [recipientId], mode });
  };

  const summary = run?.summary || {};
  const failedCount = summary.failed || 0;
  const pendingCount = summary.pending || 0;
  const isInProgress = run?.status === "in_progress";
  const deliveries = run?.deliveries || [];
  const stuckPendingCount = deliveries.filter(
    (d) => d.status === "pending" && !isInProgress,
  ).length;
  const stuckCount = failedCount + stuckPendingCount;

  const modalActions = [
    {
      label: "Close",
      onClick: onClose,
    },
    ...(stuckPendingCount > 0
      ? [
          {
            label: resending
              ? "Resuming…"
              : `Resume pending (${stuckPendingCount})`,
            primary: !failedCount,
            onClick: handleResumePending,
            disabled: resending,
          },
        ]
      : []),
    ...(failedCount > 0
      ? [
          {
            label: resending
              ? "Re-sending…"
              : `Re-send failed (${failedCount})`,
            primary: true,
            onClick: handleResendAllFailed,
            disabled: resending,
          },
        ]
      : []),
    ...(stuckCount > 1 && failedCount > 0 && stuckPendingCount > 0
      ? [
          {
            label: resending
              ? "Working…"
              : `Resume all stuck (${stuckCount})`,
            onClick: handleResumeAllStuck,
            disabled: resending,
          },
        ]
      : []),
  ];

  return (
    <CustomModal
      open={open}
      onClose={onClose}
      title={`WhatsApp send — ${announcementTitle || "Announcement"}`}
      width="760px"
      showActions
      actions={modalActions}
    >
      {loading ? (
        <p className="text-sm text-gray-500 py-8 text-center">Loading current send…</p>
      ) : !run ? (
        <p className="text-sm text-gray-500 py-8 text-center">
          No WhatsApp send is in progress for this announcement. When the scheduled
          job runs, delivery status for the current go will appear here.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 text-sm items-center">
            <span className="font-medium text-gray-800">Go #{run.goNumber}</span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                run.status === "in_progress"
                  ? "bg-blue-100 text-blue-800"
                  : run.status === "partial"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-green-100 text-green-800"
              }`}
            >
              {run.status === "in_progress"
                ? "In progress"
                : run.status === "partial"
                  ? "Partial"
                  : "Completed"}
            </span>
            <span className="text-gray-500">
              Started {formatDateTime(run.startedAt)}
            </span>
            {isInProgress && (
              <span className="text-xs text-blue-600">Updating every few seconds…</span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: "Total", value: summary.total ?? 0, color: "text-gray-800" },
              {
                label: "Delivered",
                value: summary.sent ?? 0,
                color: "text-green-700",
              },
              {
                label: "Replied",
                value: summary.replied ?? 0,
                color: "text-purple-700",
              },
              { label: "Pending", value: summary.pending ?? 0, color: "text-amber-700" },
              { label: "Failed", value: summary.failed ?? 0, color: "text-red-700" },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-center"
              >
                <div className={`text-lg font-semibold ${item.color}`}>
                  {item.value}
                </div>
                <div className="text-xs text-gray-500">{item.label}</div>
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-500">
            Current go only. Older sends are in History (clock icon on the list).
            {isInProgress && pendingCount > 0
              ? " Remaining recipients are queued; no action needed while sending."
              : null}
            {stuckPendingCount > 0 && !isInProgress
              ? " Sending stopped — use Resume pending for unsent recipients."
              : null}
          </p>

          <div className="border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">WhatsApp</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Details</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {(run.deliveries || []).map((d) => {
                  const detailHint = deliveryDetailsText(d, isInProgress);
                  const showResume = canResumeDelivery(d, isInProgress);
                  const reply = latestReply(d);
                  const statusLabel = deliveryStatusLabel(d);
                  return (
                  <tr key={d._id || d.recipientId} className="border-t">
                    <td className="px-3 py-2">{d.name || "—"}</td>
                    <td className="px-3 py-2">{d.whatsappNumber || "—"}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          STATUS_STYLES[statusLabel] || STATUS_STYLES.pending
                        }`}
                      >
                        {statusLabel}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600 max-w-[240px]">
                      {reply ? (
                        <>
                          <span className="block text-purple-800 font-medium">
                            {reply.body || "—"}
                          </span>
                          <span className="block text-gray-500">
                            {formatDateTime(reply.receivedAt)}
                          </span>
                        </>
                      ) : null}
                      {d.status === "sent" && !reply && (
                        <>
                          {formatDateTime(d.sentAt)}
                          {d.providerStatus ? (
                            <span className="block text-gray-500">
                              Provider: {d.providerStatus}
                            </span>
                          ) : null}
                          {d.messageId ? (
                            <span className="block truncate" title={d.messageId}>
                              ID: {d.messageId}
                            </span>
                          ) : null}
                          {d.providerMessage ? (
                            <span className="block truncate" title={d.providerMessage}>
                              {d.providerMessage}
                            </span>
                          ) : null}
                          {d.apiResponse ? (
                            <span
                              className="block truncate text-gray-400"
                              title={d.apiResponse}
                            >
                              {d.apiResponse}
                            </span>
                          ) : null}
                        </>
                      )}
                      {d.status === "sent" && reply ? (
                        <>
                          <span className="block text-gray-500 mt-1">
                            Sent {formatDateTime(d.sentAt)}
                          </span>
                          {d.messageId ? (
                            <span className="block truncate text-gray-400" title={d.messageId}>
                              Outbound ID: {d.messageId}
                            </span>
                          ) : null}
                        </>
                      ) : null}
                      {d.status === "failed" && (
                        <>
                          <span className="text-red-600 block" title={d.error}>
                            {d.error || "Failed"}
                          </span>
                          {d.providerStatus ? (
                            <span className="block text-gray-500">
                              Provider: {d.providerStatus}
                            </span>
                          ) : null}
                          {d.apiResponse ? (
                            <span
                              className="block truncate text-gray-400"
                              title={d.apiResponse}
                            >
                              {d.apiResponse}
                            </span>
                          ) : null}
                        </>
                      )}
                      {detailHint && (d.status === "pending" || d.status === "sending") && (
                          <span
                            className={
                              isInProgress ? "text-blue-600" : ""
                            }
                          >
                            {detailHint}
                          </span>
                        )}
                      {d.attemptCount > 1 && (
                        <span className="block text-gray-400">
                          Attempts: {d.attemptCount}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {showResume && (
                        <button
                          type="button"
                          className="text-xs text-[var(--p-blue)] hover:underline disabled:opacity-50"
                          disabled={resending}
                          onClick={() => handleResendOne(d.recipientId, d.status)}
                        >
                          {d.status === "failed" ? "Re-send" : "Resume"}
                        </button>
                      )}
                      {(d.status === "pending" || d.status === "sending") &&
                        isInProgress && (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </CustomModal>
  );
};

export default MarketingWhatsappRunModal;
