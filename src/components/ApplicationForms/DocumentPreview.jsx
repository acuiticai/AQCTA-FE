import React, { useCallback, useEffect, useRef, useState } from "react";

import Button from "@/customer/components/ui/Button";
import StatusPill from "@/customer/components/ui/StatusPill";
import {
  ChevronDownIcon,
  ClockIcon,
  DocumentIcon,
} from "@/customer/components/ui/icons";

/**
 * Inline preview of a generated document.
 *
 * Fetching is deferred until the panel is opened, and the blob URL is revoked
 * on close and unmount — a stage can list several documents, and generating
 * every one on render would be wasteful.
 *
 * @param {() => Promise<Blob>} fetchPdf  loads the document on demand
 */
const DocumentPreview = ({
  title,
  documentCode,
  audience = "internal",
  state,
  note,
  available = true,
  warn = false,
  unavailableNote = "Not available yet.",
  defaultOpen = false,
  fetchPdf,
  fileName = "document.pdf",
  archived = false,
  archiveNote = "",
  /** Changes whenever the form is saved, so an already-open preview refetches
      instead of continuing to show what was true before the edit. */
  refreshToken,
}) => {
  const [open, setOpen] = useState(defaultOpen && available);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const urlRef = useRef("");

  const release = useCallback(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = "";
    }
  }, []);

  useEffect(() => release, [release]);

  const loadPdf = useCallback(
    async (force = false) => {
      if ((urlRef.current && !force) || loading) return;
      if (force) release();
      setLoading(true);
      setError("");
      try {
        const blob = await fetchPdf();
        const next = URL.createObjectURL(blob);
        urlRef.current = next;
        setUrl(next);
      } catch (err) {
        let message = "This document could not be generated.";
        const data = err?.response?.data;
        if (typeof data?.message === "string" && data.message) {
          message = data.message;
        } else if (data instanceof Blob) {
          try {
            const text = await data.text();
            const parsed = JSON.parse(text);
            if (parsed?.message) message = parsed.message;
          } catch (_) {
            /* keep generic message */
          }
        }
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fetchPdf, loading],
  );

  useEffect(() => {
    if (open && available) loadPdf();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, available]);

  /* A save can happen while the panel is already open — the approver reads the
     letter while the preparer edits the fees behind it — so refetch rather
     than go on showing what was true before the edit. */
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (open && available) loadPdf(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken]);

  const download = () => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <article className="epc-doc">
      <button
        type="button"
        className="epc-doc__head"
        disabled={!available}
        onClick={() => available && setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="epc-rail__dot epc-rail__dot--idle" aria-hidden="true">
          {available ? <DocumentIcon size={10} /> : <ClockIcon size={10} />}
        </span>

        <span className="epc-doc__grow">
          <span className="epc-doc__title">{title}</span>
          <span className="epc-doc__meta">
            {documentCode ? `${documentCode} · ` : ""}
            {audience === "customer" ? "Sent to the customer" : "Internal"}
            {archived && archiveNote ? ` · ${archiveNote}` : ""}
            {!archived && archiveNote ? ` · ${archiveNote}` : ""}
          </span>
        </span>

        {state ? <StatusPill status={state} /> : null}
        {available ? (
          <span
            aria-hidden="true"
            style={{
              transform: open ? "rotate(180deg)" : "none",
              transition: "transform 150ms ease",
              lineHeight: 0,
            }}
          >
            <ChevronDownIcon size={16} />
          </span>
        ) : null}
      </button>

      {!available ? (
        <div className="epc-doc__body">
          <p className={`epc-notice epc-notice--${warn ? "warn" : "info"}`}>
            {unavailableNote}
          </p>
        </div>
      ) : null}

      {available && open ? (
        <div className="epc-doc__body">
          {note ? <p className="epc-section__desc" style={{ marginBottom: 10 }}>{note}</p> : null}

          <div className="epc-doc__frame">
            {loading ? (
              <p className="epc-doc__status">Generating…</p>
            ) : error ? (
              <p className="epc-doc__status" role="alert">
                {error}
              </p>
            ) : url ? (
              <object data={url} type="application/pdf" aria-label={title}>
                <p className="epc-doc__status">
                  Your browser cannot preview this file.{" "}
                  <a href={url} target="_blank" rel="noreferrer">
                    Open it in a new tab
                  </a>
                  .
                </p>
              </object>
            ) : null}
          </div>

          <div className="epc-doc__tools">
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
      ) : null}
    </article>
  );
};

export default DocumentPreview;
