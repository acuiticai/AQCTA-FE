import React, { useEffect, useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

import Button from "./Button";
import CustomerQuotationServices from "../../services/quotationService";
import { QuotationTemplateRenderer } from "@/pages/Accounts/CustomerInvoice/components/InvoiceRenderer";
import { formatInvoiceDownloadName } from "@/utils/generic";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

/**
 * Customer-portal modal — Flexa Quotation DocumentTemplate preview
 * (same renderer as admin `/quotations/view/:id`), with Download + Open in new tab.
 */
export default function CustomerQuotationPreviewModal({
  open,
  quoteNumber = "",
  title = "",
  subtitle = "",
  onClose,
}) {
  const [quotation, setQuotation] = useState(null);
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const templateRef = useRef(null);
  const pdfUrlRef = useRef("");

  const releasePdfUrl = () => {
    if (pdfUrlRef.current) {
      URL.revokeObjectURL(pdfUrlRef.current);
      pdfUrlRef.current = "";
    }
  };

  useEffect(() => {
    if (!open || !quoteNumber) {
      setQuotation(null);
      setTemplate(null);
      setError("");
      releasePdfUrl();
      return undefined;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      releasePdfUrl();
      try {
        const res = await CustomerQuotationServices.getMyQuotationPreview(
          quoteNumber,
        );
        if (cancelled) return;
        const data = res?.data?.data || {};
        setQuotation(data.quotation || null);
        setTemplate(data.template || null);
        if (!data.quotation || !data.template) {
          setError("Quotation preview is not available yet.");
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err?.response?.data?.message ||
              "This quotation could not be opened.",
          );
          setQuotation(null);
          setTemplate(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, quoteNumber]);

  useEffect(() => () => releasePdfUrl(), []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const buildPdfBlob = async () => {
    const root = templateRef.current;
    if (!root) throw new Error("Quotation content is not ready yet.");

    const PAGE_PT_WIDTH = 595;
    const PAGE_PT_HEIGHT = 842;
    const CAPTURE_PX_WIDTH = 794;
    const base = (Base_URL || "").replace(/\/$/, "");

    const targetPage = root.querySelector(".tpl-doc-page") || root;
    const clone = targetPage.cloneNode(true);
    const wrap = document.createElement("div");
    wrap.style.cssText = `position:fixed;left:-9999px;top:0;width:${CAPTURE_PX_WIDTH}px;background:#ffffff;`;
    wrap.appendChild(clone);
    clone.style.width = `${CAPTURE_PX_WIDTH}px`;
    clone.style.maxWidth = `${CAPTURE_PX_WIDTH}px`;
    clone.style.boxShadow = "none";
    clone.style.border = "0";
    document.body.appendChild(wrap);

    try {
      await new Promise((r) => requestAnimationFrame(r));
      await new Promise((r) => setTimeout(r, 200));

      const imgs = clone.querySelectorAll("img[src]");
      await Promise.all(
        Array.from(imgs).map((img) => {
          const src = (img.getAttribute("src") || "").trim();
          if (!src || src.startsWith("data:")) return Promise.resolve();
          const isHttp = src.startsWith("http://") || src.startsWith("https://");
          if (!isHttp && !src.startsWith("/")) return Promise.resolve();
          const proxyUrl = isHttp
            ? `${base}/proxy-image?url=${encodeURIComponent(src.replace(/&amp;/g, "&"))}`
            : `${base}/proxy-image?url=${encodeURIComponent(base + (src.startsWith("/") ? src : `/${src}`))}`;
          return fetch(proxyUrl, { credentials: "include" })
            .then((r) => (r.ok ? r.blob() : null))
            .then((blob) => {
              if (!blob) return;
              return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                  if (typeof reader.result === "string") {
                    img.setAttribute("src", reader.result);
                  }
                  resolve();
                };
                reader.onerror = () => resolve();
                reader.readAsDataURL(blob);
              });
            })
            .catch(() => {});
        }),
      );

      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.92);
      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const marginTop = 28;
      const marginBottom = 28;
      const contentHeight = PAGE_PT_HEIGHT - marginTop - marginBottom;
      const imgWidth = PAGE_PT_WIDTH;
      const imgHeight = (canvas.height * PAGE_PT_WIDTH) / canvas.width;

      if (imgHeight <= contentHeight) {
        pdf.addImage(imgData, "JPEG", 0, marginTop, imgWidth, imgHeight);
      } else {
        let heightLeft = imgHeight - contentHeight;
        let position = marginTop - PAGE_PT_HEIGHT;
        pdf.addImage(imgData, "JPEG", 0, marginTop, imgWidth, imgHeight);
        while (heightLeft > 0) {
          pdf.addPage("a4", "portrait");
          pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
          heightLeft -= PAGE_PT_HEIGHT - marginBottom;
          position -= PAGE_PT_HEIGHT;
        }
      }

      return pdf.output("blob");
    } finally {
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    }
  };

  const ensurePdfUrl = async () => {
    if (pdfUrlRef.current) return pdfUrlRef.current;
    const blob = await buildPdfBlob();
    const url = URL.createObjectURL(blob);
    pdfUrlRef.current = url;
    return url;
  };

  const handleDownload = async () => {
    if (!quotation || !template || busy) return;
    setBusy(true);
    setError("");
    try {
      const url = await ensurePdfUrl();
      const fileName = formatInvoiceDownloadName(
        quotation.quote_number || quoteNumber || "Quotation",
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      setError(err?.message || "Could not download this quotation.");
    } finally {
      setBusy(false);
    }
  };

  const handleOpenNewTab = async () => {
    if (!quotation || !template || busy) return;
    setBusy(true);
    setError("");
    try {
      const url = await ensurePdfUrl();
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err?.message || "Could not open this quotation.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  const ready = Boolean(quotation && template && !loading && !error);

  return (
    <div
      className="epc-modal"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className="epc-modal__panel epc-modal__panel--doc epc-modal__panel--quotation"
        role="dialog"
        aria-modal="true"
        aria-labelledby="epc-quote-modal-title"
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <h2 className="epc-modal__title" id="epc-quote-modal-title">
              {title || `Quotation ${quoteNumber}`}
            </h2>
            {subtitle ? <p className="epc-modal__body">{subtitle}</p> : null}
          </div>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="epc-modal__doc-frame epc-modal__doc-frame--quotation">
          {loading ? (
            <div className="epc-modal__doc-status">Loading quotation…</div>
          ) : error && !quotation ? (
            <div className="epc-modal__doc-status" role="alert">
              {error}
            </div>
          ) : (
            <div className="epc-modal__quote-scroll" ref={templateRef}>
              <QuotationTemplateRenderer
                quotation={quotation}
                template={template}
              />
            </div>
          )}
        </div>

        {error && quotation ? (
          <p className="epc-field__error" role="alert" style={{ marginTop: 8 }}>
            {error}
          </p>
        ) : null}

        <div className="epc-modal__actions">
          <Button
            variant="secondary"
            disabled={!ready || busy}
            onClick={handleDownload}
          >
            {busy ? "Preparing…" : "Download"}
          </Button>
          <Button
            variant="secondary"
            disabled={!ready || busy}
            onClick={handleOpenNewTab}
          >
            Open in new tab
          </Button>
        </div>
      </div>
    </div>
  );
}
