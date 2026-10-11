import React, { useEffect, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";

import Button from "./Button";
import { TextField } from "./Field";

/**
 * Confirming a factory audit notice.
 *
 * The paper form offers two ways to confirm — sign the slip, or return a
 * signed copy — so both are offered here rather than forcing everyone onto a
 * signature pad on whatever device they happen to be using.
 */
export default function AcknowledgeNoticeDialog({
  open,
  notice,
  onCancel,
  onSubmit,
  busy = false,
  title = "Confirm receipt of the audit notice",
  body,
  nameLabel = "Your name",
  namePlaceholder = "Who is confirming",
  submitLabel = "Confirm receipt",
}) {
  const padRef = useRef(null);
  const wrapRef = useRef(null);
  const fileRef = useRef(null);
  const [mode, setMode] = useState("sign");
  const [name, setName] = useState("");
  const [position, setPosition] = useState("");
  const [signature, setSignature] = useState("");
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  /* A missing name belongs on the name field; the signature and upload
     problems have no field to sit under, so they stay in the message line. */
  const [nameError, setNameError] = useState("");
  const [width, setWidth] = useState(420);

  useEffect(() => {
    if (!open) {
      setMode("sign");
      setName("");
      setPosition("");
      setSignature("");
      setFile(null);
      setError("");
      setNameError("");
    }
  }, [open]);

  /* The canvas needs real pixel dimensions or the mark comes out distorted. */
  useEffect(() => {
    const element = wrapRef.current;
    if (!element || !open) return undefined;
    const measure = () => setWidth(Math.max(240, element.clientWidth - 2));
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [open, mode]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !busy) onCancel?.();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const pickFile = (event) => {
    const chosen = event.target.files?.[0];
    event.target.value = "";
    if (!chosen) return;
    setError("");
    if (!["application/pdf", "image/png", "image/jpeg"].includes(chosen.type)) {
      setError("Please upload a PDF, PNG or JPEG.");
      return;
    }
    if (chosen.size > 10 * 1024 * 1024) {
      setError("That file is larger than 10MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      setFile({ name: chosen.name, dataUrl: String(reader.result || "") });
    reader.onerror = () => setError("That file could not be read.");
    reader.readAsDataURL(chosen);
  };

  const submit = () => {
    if (!name.trim()) {
      setNameError("Please give your name.");
      setError("");
      return;
    }
    setNameError("");
    if (mode === "sign" && !signature) {
      setError("Please sign in the box.");
      return;
    }
    if (mode === "upload" && !file) {
      setError("Please choose the signed copy to upload.");
      return;
    }
    setError("");
    onSubmit?.({
      mode,
      name: name.trim(),
      position: position.trim(),
      signature: mode === "sign" ? { dataUrl: signature } : undefined,
      upload:
        mode === "upload"
          ? { dataUrl: file.dataUrl, fileName: file.name }
          : undefined,
    });
  };

  return (
    <div
      className="epc-modal"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel?.();
      }}
    >
      <div
        className="epc-modal__panel epc-modal__panel--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="epc-ack-title"
      >
        <h2 className="epc-modal__title" id="epc-ack-title">
          {title}
        </h2>
        <p className="epc-modal__body">
          {body ||
            (notice?.visitDate
              ? `AQCTA intends to visit on ${notice.visitDate}${
                  notice.visitTime ? ` at ${notice.visitTime}` : ""
                }. Confirming tells them the arrangement suits you.`
              : "Confirming tells AQCTA the arrangement suits you.")}
        </p>

        <div className="epc-ack__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "sign"}
            className={`epc-ack__tab${mode === "sign" ? " is-active" : ""}`}
            onClick={() => setMode("sign")}
          >
            Sign here
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "upload"}
            className={`epc-ack__tab${mode === "upload" ? " is-active" : ""}`}
            onClick={() => setMode("upload")}
          >
            Upload a signed copy
          </button>
        </div>

        <div className="epc-modal__scroll">
          <div className="epc-ack__grid">
            <TextField
              label={nameLabel}
              value={name}
              error={nameError}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError("");
              }}
              placeholder={namePlaceholder}
              autoComplete="name"
            />
            <TextField
              label="Position"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="e.g. Quality Manager"
              autoComplete="organization-title"
            />
          </div>

          {mode === "sign" ? (
            <div ref={wrapRef} className="epc-ack__pad">
              <SignatureCanvas
                ref={padRef}
                penColor="#111827"
                onEnd={() => {
                  const pad = padRef.current;
                  setSignature(pad && !pad.isEmpty() ? pad.toDataURL("image/png") : "");
                }}
                canvasProps={{ width, height: 140, "aria-label": "Signature" }}
              />
              <div className="epc-ack__padfoot">
                <span>{signature ? "Signed." : "Sign above."}</span>
                <button
                  type="button"
                  className="epc-ack__clear"
                  onClick={() => {
                    padRef.current?.clear();
                    setSignature("");
                  }}
                >
                  Clear
                </button>
              </div>
            </div>
          ) : (
            <div className="epc-ack__upload">
              {file ? (
                <p className="epc-ack__file">{file.name}</p>
              ) : (
                <p className="epc-placeholder__text">
                  Print the notice, sign the acknowledgement slip, then upload
                  the signed copy here. PDF, PNG or JPEG, up to 10MB.
                </p>
              )}
              <Button variant="secondary" onClick={() => fileRef.current?.click()}>
                {file ? "Choose a different file" : "Choose file"}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                hidden
                onChange={pickFile}
              />
            </div>
          )}

          {error ? (
            <p className="epc-field__error" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="epc-modal__actions">
          <Button variant="secondary" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
          <Button disabled={busy} onClick={submit}>
            {busy ? "Sending…" : submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
