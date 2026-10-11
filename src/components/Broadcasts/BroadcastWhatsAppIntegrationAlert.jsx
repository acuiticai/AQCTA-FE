import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, MessageCircle } from "lucide-react";
import WhatsAppIntegrationServices from "@/services/WhatsAppIntegrationServices";

function isWhatsAppConnected(record) {
  return !!record && record.isConnected !== false && !!record.hasApiKey;
}

export function countWhatsappRecipients(recipients) {
  return (recipients || []).filter((r) => String(r.whatsappNumber || "").trim())
    .length;
}

/**
 * Warns when the selected business has no active WhatsApp integration.
 * Email broadcasts still work; WhatsApp deliveries are skipped until connected.
 */
export default function BroadcastWhatsAppIntegrationAlert({
  businessId,
  whatsappRecipientCount = null,
  className = "",
}) {
  const [checking, setChecking] = useState(false);
  const [connected, setConnected] = useState(null);

  useEffect(() => {
    if (!businessId) {
      setConnected(null);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      setChecking(true);
      try {
        const res = await WhatsAppIntegrationServices.getByBusinessId(businessId);
        if (cancelled) return;
        setConnected(isWhatsAppConnected(res?.data));
      } catch {
        if (!cancelled) setConnected(false);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [businessId]);

  if (!businessId || checking || connected !== false) {
    return null;
  }

  const connectUrl = `/accounts/whatsapp-integration?selectedOrg=${encodeURIComponent(businessId)}`;
  const hasWaRecipients =
    whatsappRecipientCount != null && Number(whatsappRecipientCount) > 0;

  return (
    <div
      className={`flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950 ${className}`}
      role="status"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
        <AlertTriangle size={16} aria-hidden />
      </span>
      <div className="min-w-0 space-y-1">
        <p className="font-medium flex items-center gap-1.5">
          <MessageCircle size={14} className="text-emerald-700 shrink-0" aria-hidden />
          WhatsApp not connected for this business
        </p>
        <p className="text-amber-900/90 leading-snug">
          {hasWaRecipients ? (
            <>
              {whatsappRecipientCount} recipient
              {whatsappRecipientCount === 1 ? "" : "s"} have WhatsApp numbers, but
              messages will <strong>not</strong> be sent until you connect the
              integration. Email will still be delivered.
            </>
          ) : (
            <>
              Campaign emails will send as usual, but WhatsApp messages will be
              skipped until you connect WhatsApp under Settings.
            </>
          )}
        </p>
        <Link
          to={connectUrl}
          className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--p-blue)] hover:underline"
        >
          Connect WhatsApp integration →
        </Link>
      </div>
    </div>
  );
}
