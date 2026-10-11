import React from "react";
import { AlertTriangle, Play } from "lucide-react";
import { CustomModal } from "@/page-layouts";
import BroadcastWhatsAppIntegrationAlert from "@/components/Broadcasts/BroadcastWhatsAppIntegrationAlert";

export default function BroadcastRunCampaignModal({
  open,
  onClose,
  campaignTitle = "this campaign",
  recipientCount,
  whatsappRecipientCount,
  businessId,
  running = false,
  onConfirm,
}) {
  const title = (campaignTitle || "this campaign").trim() || "this campaign";

  return (
    <CustomModal
      open={open}
      onClose={onClose}
      title="Run campaign now"
      width="480px"
      showActions
      actions={[
        {
          label: running ? "Close" : "Cancel",
          secondary: true,
          onClick: onClose,
        },
        {
          label: running ? "Running…" : "Run now",
          primary: true,
          onClick: onConfirm,
          disabled: running,
          style: { backgroundColor: "#16a34a", borderColor: "#16a34a" },
        },
      ]}
    >
      <div className="flex gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <AlertTriangle size={20} aria-hidden />
        </span>
        <div className="min-w-0 space-y-2">
          {running ? (
            <>
              <p className="text-sm text-gray-800">
                <strong>{title}</strong> is sending to recipients now.
              </p>
              <p className="text-sm text-gray-600">
                You can close this window — the campaign keeps running in the
                background. You&apos;ll get a notification when it finishes.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-800">
                Send <strong>{title}</strong> to all recipients immediately?
              </p>
              <p className="text-sm text-gray-600">
                This ignores the current status and schedule. Everyone on the
                campaign will receive the message again.
              </p>
              {recipientCount != null && recipientCount > 0 ? (
                <p className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5">
                  <Play size={12} className="text-green-600" aria-hidden />
                  {recipientCount} recipient{recipientCount === 1 ? "" : "s"} will
                  be contacted
                </p>
              ) : null}
            </>
          )}
          {businessId ? (
            <BroadcastWhatsAppIntegrationAlert
              businessId={businessId}
              whatsappRecipientCount={whatsappRecipientCount}
              className="mt-3"
            />
          ) : null}
        </div>
      </div>
    </CustomModal>
  );
}
