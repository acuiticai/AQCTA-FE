import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { QRCodeCanvas } from "qrcode.react";
import {
  X,
  QrCode,
  RefreshCw,
  Download,
  Copy,
  ShieldOff,
  ShieldCheck,
  Check,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import BroadcastServices from "@/services/BroadcastServices";
import { getPublicAppUrl } from "@/utils/publicAppUrl";

const getPublicCampaignQrUrl = (token) => {
  if (!token) return "";
  return `${getPublicAppUrl()}/campaign-signup/${token}`;
};

const BroadcastCampaignQrModal = ({
  open,
  campaign,
  headers,
  onClose,
  onChanged,
}) => {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [current, setCurrent] = useState(null);
  const [copied, setCopied] = useState(false);
  const qrCanvasRef = useRef(null);

  useEffect(() => {
    if (open) {
      setCurrent(campaign || null);
      setError("");
      setCopied(false);
    }
  }, [open, campaign]);

  const publicUrl = useMemo(() => {
    if (!current?.qrToken || !current?.qrEnabled) return "";
    return getPublicCampaignQrUrl(current.qrToken);
  }, [current?.qrToken, current?.qrEnabled]);

  const handleGenerate = useCallback(async () => {
    if (!current?._id) return;
    setWorking(true);
    setError("");
    try {
      const res = await BroadcastServices.generateCampaignQr(current._id, headers);
      if (res.data?.success) {
        setCurrent((prev) => ({ ...(prev || {}), ...res.data.data }));
        onChanged?.(res.data.data);
      } else {
        setError(res.data?.error || "Failed to generate QR");
      }
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to generate QR");
    } finally {
      setWorking(false);
    }
  }, [current?._id, headers, onChanged]);

  const handleRevoke = useCallback(async () => {
    if (!current?._id) return;
    if (
      !window.confirm(
        `Revoke QR for "${current?.title || "this campaign"}"? Existing QR codes will stop working immediately.`,
      )
    ) {
      return;
    }
    setWorking(true);
    setError("");
    try {
      const res = await BroadcastServices.revokeCampaignQr(current._id, headers);
      if (res.data?.success) {
        const updated = {
          ...(current || {}),
          qrEnabled: false,
          qrRevokedAt: new Date().toISOString(),
        };
        setCurrent(updated);
        onChanged?.(updated);
      } else {
        setError(res.data?.error || "Failed to revoke QR");
      }
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to revoke QR");
    } finally {
      setWorking(false);
    }
  }, [current, headers, onChanged]);

  const handleCopy = useCallback(async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Clipboard access denied");
    }
  }, [publicUrl]);

  const handleDownload = useCallback(() => {
    const node = qrCanvasRef.current;
    if (!node) return;
    const canvas = node.querySelector("canvas");
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    const safeTitle = String(current?.title || "campaign")
      .trim()
      .replace(/[^a-z0-9_-]+/gi, "_")
      .slice(0, 40);
    a.download = `Campaign-QR-${safeTitle || "campaign"}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [current?.title]);

  if (!open) return null;

  const isEnabled = !!current?.qrEnabled && !!current?.qrToken;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <QrCode size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Campaign QR Code</h3>
              <p className="text-[11px] text-gray-500 truncate max-w-[280px]">
                {current?.title || "Campaign"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="mx-5 mt-4 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="p-5 space-y-4">
            {!isEnabled ? (
              <div className="text-center py-6">
                <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gray-100 text-gray-400 mb-3">
                  <QrCode size={28} />
                </div>
                <h4 className="text-sm font-bold text-gray-900">
                  No active QR for this campaign
                </h4>
                <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
                  Generate a QR code so people can scan and sign up with their
                  name, email, and phone number.
                </p>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={working}
                  className="mt-4 inline-flex items-center gap-1.5 h-9 px-4 text-xs font-bold text-white bg-[var(--p-blue)] rounded-lg hover:opacity-95 disabled:opacity-50"
                >
                  {working ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <ShieldCheck size={13} />
                  )}
                  Generate QR
                </button>
              </div>
            ) : (
              <>
                <div
                  ref={qrCanvasRef}
                  className="flex flex-col items-center justify-center p-4 bg-white border-2 border-dashed border-gray-200 rounded-xl"
                >
                  <QRCodeCanvas
                    value={publicUrl}
                    size={240}
                    includeMargin
                    level="H"
                    bgColor="#ffffff"
                    fgColor="#111111"
                  />
                  <p className="mt-3 text-xs text-gray-500 text-center max-w-xs">
                    Scan to sign up for <strong>{current?.title}</strong>
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider">
                    Public URL
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={publicUrl}
                      className="flex-1 h-9 px-3 text-[11px] bg-gray-50 border border-gray-200 rounded-xl font-mono text-gray-600 focus:outline-none cursor-text"
                      onFocus={(e) => e.target.select()}
                    />
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="h-9 w-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                      title="Copy URL"
                    >
                      {copied ? (
                        <Check size={13} className="text-emerald-600" />
                      ) : (
                        <Copy size={13} />
                      )}
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400">
                    Anyone scanning this QR can join as a recipient. Revoke to
                    disable all printed codes instantly.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="inline-flex items-center justify-center gap-1 h-9 px-2 text-[11px] font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg"
                  >
                    <Download size={12} />
                    Download
                  </button>
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={working}
                    className="inline-flex items-center justify-center gap-1 h-9 px-2 text-[11px] font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg disabled:opacity-50"
                  >
                    {working ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <RefreshCw size={12} />
                    )}
                    Rotate
                  </button>
                </div>

                <div className="pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={handleRevoke}
                    disabled={working}
                    className="w-full inline-flex items-center justify-center gap-1 h-9 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg disabled:opacity-50"
                  >
                    <ShieldOff size={12} />
                    Revoke QR
                  </button>
                </div>

                {current?.qrIssuedAt && (
                  <div className="text-[10px] text-gray-400 pt-1">
                    Issued: {new Date(current.qrIssuedAt).toLocaleString()}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BroadcastCampaignQrModal;
