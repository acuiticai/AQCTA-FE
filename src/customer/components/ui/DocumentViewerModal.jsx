import React, { useEffect, useRef, useState } from "react";

import Button from "./Button";

/**
 * Inline document preview, customer-portal styled.
 *
 * Two fetchers can be given: `fetchPdf` (primary — reads the document from
 * where it is normally reached) and `fetchFallbackPdf` (used only if the
 * primary one fails). This is how the quotation document stays viewable even
 * if the application-scoped lookup path breaks — the project keeps its own
 * copy of the same archive reference.
 */
export default function DocumentViewerModal({
  open,
  title,
  subtitle,
  fetchPdf,
  fetchFallbackPdf,
  fileName = "document.pdf",
  onClose,
}) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [usedFallback, setUsedFallback] = useState(false);
  const urlRef = useRef("");

  const release = () => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = "";
    }
  };

  useEffect(() => {
    if (!open) {
      release();
      setUrl("");
      setError("");
      setUsedFallback(false);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      setUsedFallback(false);
      try {
        const blob = await fetchPdf();
        if (cancelled) return;
        const next = URL.createObjectURL(blob);
        urlRef.current = next;
        setUrl(next);
      } catch (primaryErr) {
        if (cancelled) return;
        if (!fetchFallbackPdf) {
          setError(
            primaryErr?.response?.data?.message ||
              "This document could not be opened.",
          );
          return;
        }
        try {
          const blob = await fetchFallbackPdf();
          if (cancelled) return;
          const next = URL.createObjectURL(blob);
          urlRef.current = next;
          setUrl(next);
          setUsedFallback(true);
        } catch (fallbackErr) {
          if (cancelled) return;
          setError(
            fallbackErr?.response?.data?.message ||
              "This document could not be opened.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => release, []);

  const download = () => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="epc-modal"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        className="epc-modal__panel epc-modal__panel--doc"
        role="dialog"
        aria-modal="true"
        aria-labelledby="epc-doc-modal-title"
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h2 className="epc-modal__title" id="epc-doc-modal-title">
              {title}
            </h2>
            {subtitle ? <p className="epc-modal__body">{subtitle}</p> : null}
            {usedFallback ? (
              <p className="epc-modal__body" style={{ color: "var(--epc-warning, #a35b00)" }}>
                Opened from your project record — the usual document path was
                unavailable.
              </p>
            ) : null}
          </div>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="epc-modal__doc-frame">
          {loading ? (
            <div className="epc-modal__doc-status">Loading document…</div>
          ) : error ? (
            <div className="epc-modal__doc-status" role="alert">
              {error}
            </div>
          ) : url ? (
            <object data={url} type="application/pdf" aria-label={title}>
              <p className="epc-modal__doc-status">
                Your browser cannot preview this file.{" "}
                <a href={url} target="_blank" rel="noreferrer">
                  Open it in a new tab
                </a>
                .
              </p>
            </object>
          ) : null}
        </div>

        <div className="epc-modal__actions">
          <Button variant="secondary" disabled={!url} onClick={download}>
            Download
          </Button>
          {url ? (
            <a
              className="epc-btn epc-btn--secondary"
              href={url}
              target="_blank"
              rel="noreferrer"
            >
              Open in new tab
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
