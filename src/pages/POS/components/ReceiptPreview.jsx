import React, { useEffect, useMemo, useRef, useState } from "react";
import { Download, Printer, X, Loader2, Unplug, Usb, Bluetooth, Cable } from "lucide-react";
import { pdf as renderPdf } from "@react-pdf/renderer";
import buildReceiptHtml from "./receiptTemplate";
import { buildPosReceiptPdfDoc } from "./posReceiptPdfDocument";
import { usePrinterConnection } from "../hooks/usePrinterConnection";
import { encodePosReceipt } from "../utils/encodePosReceipt";
import { notifyError, notifySuccess } from "@/utils/toast";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL || "";

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

const getPreferredBusinessImage = (biz = {}) => {
  const candidates = [
    biz?.image, biz?.imageUrl, biz?.businessLogo,
    biz?.companyLogo, biz?.image?.url, biz?.logo?.url, biz?.logoUrl,
  ];
  return candidates.find((v) => typeof v === "string" && v.trim()) || "";
};

const normalizeAssetUrl = (value) => {
  if (!value || typeof value !== "string") return "";
  const t = value.trim();
  if (!t) return "";
  if (/^(https?:|data:|blob:)/i.test(t)) return t;
  const apiBase = Base_URL || (typeof window !== "undefined" ? `${window.location.origin}/api` : "");
  const origin = apiBase.replace(/\/api\/?$/i, "").replace(/\/$/, "");
  if (t.startsWith("/")) return origin ? `${origin}${t}` : `${window.location.origin}${t}`;
  return t;
};

const loadLogoAsDataUrl = async (business) => {
  const src = normalizeAssetUrl(getPreferredBusinessImage(business));
  if (!src) return "";
  if (src.startsWith("data:")) return src;
  const apiBase = Base_URL || (typeof window !== "undefined" ? `${window.location.origin}/api` : "");
  const proxyUrl = `${apiBase.replace(/\/$/, "")}/proxy-image?url=${encodeURIComponent(src)}`;
  const res = await fetch(proxyUrl, { method: "GET" });
  if (!res.ok) return "";
  const blob = await res.blob();
  return blobToDataUrl(blob);
};

// Wait for all images inside a document to settle (used for iframe preview).
const waitForSingleImage = (img) =>
  new Promise((resolve) => {
    if (!img) return resolve();
    const startedAt = Date.now();
    const check = () => {
      const src = img.getAttribute("src") || "";
      if (!src || img.style?.display === "none") return resolve();
      if (img.complete && img.naturalWidth > 0) return resolve();
      if (Date.now() - startedAt > 4500) return resolve();
      window.setTimeout(check, 120);
    };
    img.addEventListener("load", check, { once: true });
    img.addEventListener("error", () => window.setTimeout(check, 140), { once: true });
    check();
  });

const waitForImages = async (doc) => {
  if (!doc) return;
  const imgs = Array.from(doc.images || []);
  if (imgs.length) await Promise.all(imgs.map(waitForSingleImage));
};

// Open receiptHtml in a new window and auto-trigger the print dialog.
// This bypasses printer-selection dialogs on POS terminals that have a
// default printer configured — same technique as Path 3 fallback.
const openHtmlForPrint = (receiptHtml) => {
  const printHtml = receiptHtml.replace(
    "</body>",
    `<script>window.onload=function(){setTimeout(function(){window.print();window.onafterprint=function(){window.close();};},300);}</script></body>`,
  );
  const blob = new Blob([printHtml], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  const win  = window.open(url, "_blank", "width=420,height=700,noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return win;
};

const TYPE_ICONS = { usb: Usb, bluetooth: Bluetooth, serial: Cable };

const ReceiptPreview = ({
  isOpen,
  order,
  businessName,
  business,
  onClose,
}) => {
  const iframeRef = useRef(null);
  const [iframeReady, setIframeReady] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [inlineLogo, setInlineLogo] = useState("");
  const printer = usePrinterConnection();

  // Read logo visibility setting from localStorage (default: show)
  const showLogoInReceipt = localStorage.getItem("pos.receipt.showLogo") !== "false";

  useEffect(() => {
    let mounted = true;
    if (!isOpen || !order) {
      setInlineLogo("");
      return () => {
        mounted = false;
      };
    }
    (async () => {
      try {
        const dataUrl = await loadLogoAsDataUrl(business || order?.business || {});
        if (mounted) setInlineLogo(dataUrl || "");
      } catch (_) {
        if (mounted) setInlineLogo("");
      }
    })();
    return () => {
      mounted = false;
    };
  }, [isOpen, order, business]);

  const receiptHtml = useMemo(() => {
    if (!order) return "";
    return buildReceiptHtml({
      order,
      business: business || { name: businessName },
      logo: inlineLogo,
      showLogo: showLogoInReceipt,
    });
  }, [order, business, businessName, inlineLogo, showLogoInReceipt]);

  // Reset readiness whenever the source changes, and mark ready once the
  // iframe finishes writing the latest HTML + loading its images.
  useEffect(() => {
    setIframeReady(false);
    if (!isOpen || !receiptHtml) return;

    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = async () => {
      try {
        await waitForImages(iframe.contentDocument);
      } catch (_) {
        // ignore
      }
      setIframeReady(true);
    };

    iframe.addEventListener("load", handleLoad);
    return () => iframe.removeEventListener("load", handleLoad);
  }, [isOpen, receiptHtml]);

  const sendToThermalPrinter = (printerColumns = 42) => {
    const data = encodePosReceipt({
      order,
      business: business || { name: businessName },
      printerModel: "generic-escpos",
      columns: printerColumns,
    });
    printer.print(data);
    notifySuccess("Receipt sent to printer");
  };

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      // Path 1 — already connected: direct silent print, zero dialogs.
      if (printer.isConnected) {
        sendToThermalPrinter();
        return;
      }

      // Path 2 — Web API available but not yet connected: open device picker
      // (one-time pairing), then print silently. No browser print dialog.
      if (printer.supported.length > 0) {
        await printer.connect(printer.connectionType);
        sendToThermalPrinter();
        return;
      }

      // Path 3 — browser has no Web Bluetooth/USB/Serial (non-Chromium):
      // open receipt HTML in a new window that auto-triggers the print dialog.
      const forcedLogo = showLogoInReceipt
        ? await loadLogoAsDataUrl(business || order?.business || {})
        : "";
      const printHtml = buildReceiptHtml({
        order,
        business: business || { name: businessName },
        logo: forcedLogo || inlineLogo,
        showLogo: showLogoInReceipt,
      });
      const win = openHtmlForPrint(printHtml);
      if (!win) {
        notifyError("Pop-up blocked. Allow pop-ups to print.");
      }
    } catch (err) {
      // Connection was cancelled or failed — tell the user, do NOT fall back
      // to the browser print dialog (that would defeat the whole purpose).
      const msg = err?.message || "";
      if (msg.toLowerCase().includes("cancel") || msg.toLowerCase().includes("user")) {
        notifyError("Printer connection cancelled. Select your printer to continue.");
      } else if (msg.toLowerCase().includes("timeout")) {
        notifyError("Printer connection timed out. Try again.");
      } else {
        notifyError(msg || "Could not connect to printer. Check it is on and in range.");
      }
      console.error("Print failed:", err);
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const fileBase = String(
        order?.salesOrderNumber || order?.orderNumber || "receipt"
      ).replace(/[^a-zA-Z0-9-_]/g, "_");
      const logoDataUrl = showLogoInReceipt
        ? await loadLogoAsDataUrl(business || order?.business || {})
        : "";
      const doc = buildPosReceiptPdfDoc({
        order,
        business: business || { name: businessName },
        logo: showLogoInReceipt ? (logoDataUrl || inlineLogo) : "",
      });
      const blob = await renderPdf(doc).toBlob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `${fileBase}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      notifyError("Failed to download receipt PDF");
      console.error("Receipt download failed:", err);
    } finally {
      setIsDownloading(false);
    }
  };

  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="
          relative w-full h-[100dvh] sm:h-auto sm:max-w-md md:max-w-lg lg:max-w-xl
          bg-white rounded-none sm:rounded-2xl shadow-2xl overflow-hidden
          flex flex-col max-h-[100dvh] sm:max-h-[92vh]
        "
      >
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2.5 sm:py-3 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
              <Printer size={13} className="text-[var(--p-blue)]" />
              Receipt
            </h3>
            <p className="text-[11px] text-gray-400 mt-0.5 font-mono truncate">
              {order.orderNumber}
            </p>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">

            {/* Printer connection widget — only shown when Web APIs are available */}
            {printer.supported.length > 0 && (() => {
              const TypeIcon = TYPE_ICONS[printer.connectionType] || Usb;
              return (
                <div className="flex items-center gap-1">
                  <select
                    value={printer.connectionType}
                    onChange={(e) => printer.changeType(e.target.value)}
                    disabled={printer.isConnecting}
                    className="text-[9px] border border-gray-200 rounded px-1 py-0.5 bg-white text-gray-500 cursor-pointer"
                  >
                    {printer.supported.map((t) => (
                      <option key={t} value={t}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      printer.isConnected
                        ? printer.disconnect()
                        : printer.connect()
                    }
                    disabled={printer.isConnecting}
                    title={
                      printer.isConnected
                        ? `Connected: ${printer.deviceName} — click to disconnect`
                        : `Connect ${printer.connectionType} printer`
                    }
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-semibold rounded border transition-all ${
                      printer.isConnected
                        ? "bg-green-50 border-green-200 text-green-700"
                        : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100"
                    }`}
                  >
                    {printer.isConnecting ? (
                      <Loader2 size={9} className="animate-spin" />
                    ) : printer.isConnected ? (
                      <Unplug size={9} />
                    ) : (
                      <TypeIcon size={9} />
                    )}
                    <span className="hidden sm:inline">
                      {printer.isConnecting
                        ? "Connecting…"
                        : printer.isConnected
                          ? printer.deviceName || "Connected"
                          : "Connect"}
                    </span>
                    {!printer.isConnecting && (
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          printer.isConnected ? "bg-green-500" : "bg-gray-300"
                        }`}
                      />
                    )}
                  </button>
                </div>
              );
            })()}

            <button
              type="button"
              onClick={handleDownload}
              disabled={isDownloading}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-semibold bg-amber-500 text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isDownloading ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Download size={13} />
              )}
              <span className="hidden xs:inline sm:inline">Download</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting || (printer.isConnecting)}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-semibold bg-[var(--p-blue)] text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isPrinting ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Printer size={13} />
              )}
              <span className="hidden xs:inline sm:inline">
                {printer.isConnected ? "Print" : "Print"}
              </span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              aria-label="Close receipt"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Iframe preview (single source of truth for preview + print + PDF) */}
        <div className="relative flex-1 overflow-hidden bg-gray-100 p-1.5 sm:p-3">
          {!iframeReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50/60 backdrop-blur-[1px] z-10">
              <Loader2
                size={22}
                className="animate-spin text-[var(--p-blue)]"
              />
            </div>
          )}
          <div className="mx-auto w-full max-w-[320px] sm:max-w-[340px] h-full rounded-lg shadow-sm bg-white overflow-hidden">
            <iframe
              ref={iframeRef}
              title="POS Receipt Preview"
              srcDoc={receiptHtml}
              sandbox="allow-same-origin allow-modals allow-scripts"
              className="w-full h-full border-0 bg-white"
              style={{ minHeight: "480px" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(ReceiptPreview);
