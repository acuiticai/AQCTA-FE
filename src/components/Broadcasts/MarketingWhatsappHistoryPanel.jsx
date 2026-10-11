import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { notifyError, notifySuccess } from "@/utils/toast";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const STATUS_STYLES = {
  pending: "bg-amber-100 text-amber-800",
  sent: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  skipped: "bg-gray-100 text-gray-600",
  replied: "bg-purple-100 text-purple-800",
};

function latestReply(delivery) {
  const replies = delivery?.replies || [];
  if (!replies.length) return null;
  return replies[replies.length - 1];
}

function deliveryStatusLabel(delivery) {
  if ((delivery?.replies || []).length > 0) return "replied";
  return delivery?.status || "pending";
}

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

const RUN_STATUS_LABEL = {
  in_progress: "In progress",
  partial: "Partial",
  completed: "Completed",
};

const MarketingWhatsappHistoryPanel = ({
  announcementId,
  authHeaders,
  checkTokenExpired,
  variant = "embedded",
  onResendComplete,
}) => {
  const isModal = variant === "modal";
  const [loading, setLoading] = useState(true);
  const [resending, setResending] = useState(false);
  const [runs, setRuns] = useState([]);
  const [expandedGo, setExpandedGo] = useState(null);

  const loadRuns = useCallback(async () => {
    if (!announcementId) return;
    try {
      setLoading(true);
      const response = await axios.get(
        `${Base_URL}/broadcasts/${announcementId}/whatsapp-runs`,
        { headers: authHeaders },
      );
      if (checkTokenExpired?.(response)) return;
      if (!response.data?.status) {
        notifyError("Failed to load history");
        setRuns([]);
        return;
      }
      const list = response.data?.data?.runs || [];
      setRuns(list);
      setExpandedGo((prev) =>
        prev != null && list.some((r) => r.goNumber === prev)
          ? prev
          : list.length > 0
            ? list[0].goNumber
            : null,
      );
    } catch (error) {
      notifyError(error.response?.data?.error || "Failed to load history");
      setRuns([]);
    } finally {
      setLoading(false);
    }
  }, [announcementId, authHeaders, checkTokenExpired]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

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
      onResendComplete?.();
      await loadRuns();
    } catch (error) {
      notifyError(error.response?.data?.error || "Re-send failed");
    } finally {
      setResending(false);
    }
  };

  const handleResendOne = (recipientId) => {
    postResume({ recipientIds: [recipientId], mode: "failed" });
  };

  const handleResendAllFailed = (run) => {
    const failedIds = (run.deliveries || [])
      .filter((d) => d.status === "failed")
      .map((d) => d.recipientId);
    if (!failedIds.length) return;
    postResume({ recipientIds: failedIds, mode: "failed" });
  };

  if (loading) {
    return (
      <p className="text-sm text-gray-500 py-8 text-center">Loading history…</p>
    );
  }

  if (!runs.length) {
    return (
      <p className="text-sm text-gray-500 py-8 text-center">
        No send history yet for this announcement. History appears after the
        scheduled job runs.
      </p>
    );
  }

  const listMaxHeight = isModal ? "" : "max-h-64 overflow-y-auto";

  return (
    <div className={isModal ? "" : "border-t mt-4 pt-4"}>
      {!isModal && (
        <p className="font-medium text-gray-800 mb-3 text-sm">History (by go)</p>
      )}
      <div className={`space-y-3 ${listMaxHeight}`}>
        {runs.map((run) => {
          const open = expandedGo === run.goNumber;
          const s = run.summary || {};
          const deliveries = run.deliveries || [];
          const failedInRun = deliveries.filter((d) => d.status === "failed");
          const canResendRun =
            failedInRun.length > 0 && run.status !== "in_progress";
          return (
            <div
              key={run._id || run.goNumber}
              className="border border-gray-200 rounded-lg overflow-hidden"
            >
              <button
                type="button"
                className="w-full flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm text-left hover:bg-gray-50 bg-white"
                onClick={() => setExpandedGo(open ? null : run.goNumber)}
              >
                <span className="font-medium text-gray-900">
                  Go #{run.goNumber} — {formatDateTime(run.startedAt)}
                </span>
                <span className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                  {RUN_STATUS_LABEL[run.status] ? (
                    <span className="px-2 py-0.5 rounded-full bg-gray-100 font-medium">
                      {RUN_STATUS_LABEL[run.status]}
                    </span>
                  ) : null}
                  <span>
                    {s.sent ?? 0} sent · {s.replied ?? 0} replied · {s.failed ?? 0}{" "}
                    failed · {s.pending ?? 0} pending
                  </span>
                  {canResendRun ? (
                    <button
                      type="button"
                      className="text-orange-600 font-medium hover:underline disabled:opacity-50"
                      disabled={resending}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleResendAllFailed(run);
                      }}
                    >
                      {resending ? "Sending…" : `Re-send failed (${failedInRun.length})`}
                    </button>
                  ) : null}
                </span>
              </button>
              {open && (
                  <div className="border-t border-gray-200 bg-gray-50/50">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100 sticky top-0">
                        <tr className="text-gray-600 text-xs">
                          <th className="text-left px-3 py-2 font-medium">Name</th>
                          <th className="text-left px-3 py-2 font-medium">WhatsApp</th>
                          <th className="text-left px-3 py-2 font-medium">Status</th>
                          <th className="text-left px-3 py-2 font-medium">Sent at</th>
                          <th className="text-left px-3 py-2 font-medium">Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deliveries.length === 0 ? (
                          <tr>
                            <td
                              colSpan={6}
                              className="px-3 py-4 text-center text-gray-500 text-xs"
                            >
                              No delivery records for this go.
                            </td>
                          </tr>
                        ) : (
                          deliveries.map((d) => {
                            const reply = latestReply(d);
                            const statusLabel = deliveryStatusLabel(d);
                            return (
                            <tr
                              key={d._id || d.recipientId}
                              className="border-t border-gray-100 bg-white"
                            >
                              <td className="px-3 py-2">{d.name || "—"}</td>
                              <td className="px-3 py-2">{d.whatsappNumber || "—"}</td>
                              <td className="px-3 py-2">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                                    STATUS_STYLES[statusLabel] || "bg-gray-100"
                                  }`}
                                >
                                  {statusLabel}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-gray-600 text-xs whitespace-nowrap">
                                {reply
                                  ? formatDateTime(reply.receivedAt)
                                  : formatDateTime(d.sentAt)}
                              </td>
                              <td className="px-3 py-2 text-xs text-gray-600 max-w-[14rem]">
                                {reply ? (
                                  <>
                                    <span
                                      className="block text-purple-800 font-medium truncate"
                                      title={reply.body}
                                    >
                                      {reply.body || "—"}
                                    </span>
                                    {d.messageId ? (
                                      <span
                                        className="block truncate text-gray-400"
                                        title={d.messageId}
                                      >
                                        Outbound ID: {d.messageId}
                                      </span>
                                    ) : null}
                                  </>
                                ) : d.status === "sent" ? (
                                  <>
                                    {d.messageId ? (
                                      <span className="block truncate" title={d.messageId}>
                                        ID: {d.messageId}
                                      </span>
                                    ) : null}
                                    {d.providerStatus ? (
                                      <span className="block text-gray-500">
                                        {d.providerStatus}
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
                                ) : (
                                  <span
                                    className="text-red-600 block truncate"
                                    title={d.error || d.providerMessage || ""}
                                  >
                                    {d.error || d.providerMessage || "—"}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-xs">
                                {d.status === "failed" &&
                                run.status !== "in_progress" ? (
                                  <button
                                    type="button"
                                    className="text-orange-600 hover:underline disabled:opacity-50"
                                    disabled={resending}
                                    onClick={() =>
                                      handleResendOne(d.recipientId)
                                    }
                                  >
                                    Re-send
                                  </button>
                                ) : null}
                              </td>
                            </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MarketingWhatsappHistoryPanel;
