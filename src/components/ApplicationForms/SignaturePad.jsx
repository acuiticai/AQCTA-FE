import React, { useEffect, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";

import Button from "@/customer/components/ui/Button";

/**
 * Captures a signature, by drawing it or by uploading an image of one.
 *
 * When `profileSignature` is set (the mark saved on the user's profile), it is
 * shown first so they do not have to redraw every document. They can still
 * clear it and draw or upload a different one for this signing only.
 *
 * The value handed back is a PNG data URL, or the profile URL while the saved
 * mark is still in use. Nothing is stored until the form around it is submitted.
 *
 * @param {(dataUrl: string) => void} onChange  called with "" when cleared
 */
const SignaturePad = ({
  value = "",
  onChange,
  disabled = false,
  label = "Signature",
  hint = "Sign in the box, or upload an image of your signature.",
  profileSignature = "",
  /** Compact layout for embedding in a signature cell (e.g. costing sheet). */
  compact = false,
}) => {
  const padRef = useRef(null);
  const wrapRef = useRef(null);
  const fileRef = useRef(null);
  const saved = String(profileSignature || "").trim();
  const [mode, setMode] = useState(saved ? "saved" : "draw");
  const [uploadError, setUploadError] = useState("");
  const [width, setWidth] = useState(420);
  const seededRef = useRef(false);

  /* Prefill from the profile once per mount when the pad is still empty. */
  useEffect(() => {
    if (seededRef.current) return;
    const profile = String(profileSignature || "").trim();
    if (!profile) return;
    seededRef.current = true;
    setMode("saved");
    if (!value) onChange?.(profile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileSignature]);

  /* The canvas needs pixel dimensions, and a mark drawn at one size then
     re-rendered at another comes out distorted — so it is measured rather
     than guessed, and re-measured when the panel resizes. */
  useEffect(() => {
    const element = wrapRef.current;
    if (!element || mode === "saved") return undefined;
    const measure = () => setWidth(Math.max(240, element.clientWidth - 2));
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [mode]);

  const emitDrawn = () => {
    const pad = padRef.current;
    onChange?.(pad && !pad.isEmpty() ? pad.toDataURL("image/png") : "");
  };

  const clear = () => {
    padRef.current?.clear();
    setUploadError("");
    if (saved && mode === "saved") {
      /* Stepping off the profile mark — leave them on Draw to replace it. */
      setMode("draw");
      onChange?.("");
      return;
    }
    onChange?.("");
  };

  const startFresh = (nextMode) => {
    padRef.current?.clear();
    setUploadError("");
    setMode(nextMode);
    onChange?.("");
  };

  const onFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploadError("");

    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setUploadError("Use a PNG or JPEG image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadError("That image is larger than 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => onChange?.(String(reader.result || ""));
    reader.onerror = () => setUploadError("That image could not be read.");
    reader.readAsDataURL(file);
  };

  const usingSaved = mode === "saved" && Boolean(value || saved);
  const uploaded = mode === "upload" && value;

  return (
    <div className={`epc-sig${compact ? " epc-sig--compact" : ""}`}>
      <div className="epc-sig__head">
        <div>
          {compact ? null : <p className="epc-doc__title">{label}</p>}
          <p className="epc-doc__meta">
            {usingSaved
              ? compact
                ? "Using your profile signature."
                : "Using the signature saved on your profile. Change it below to draw or upload a different one for this document."
              : compact
                ? "Draw or upload your signature."
                : hint}
          </p>
        </div>
        <div className="epc-sig__tabs" role="tablist">
          {saved ? (
            <button
              type="button"
              role="tab"
              aria-selected={mode === "saved"}
              disabled={disabled}
              className={`epc-sig__tab${mode === "saved" ? " is-active" : ""}`}
              onClick={() => {
                padRef.current?.clear();
                setUploadError("");
                setMode("saved");
                onChange?.(saved);
              }}
            >
              Profile
            </button>
          ) : null}
          <button
            type="button"
            role="tab"
            aria-selected={mode === "draw"}
            disabled={disabled}
            className={`epc-sig__tab${mode === "draw" ? " is-active" : ""}`}
            onClick={() => startFresh("draw")}
          >
            Draw
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "upload"}
            disabled={disabled}
            className={`epc-sig__tab${mode === "upload" ? " is-active" : ""}`}
            onClick={() => startFresh("upload")}
          >
            Upload
          </button>
        </div>
      </div>

      <div ref={wrapRef}>
        {usingSaved ? (
          <div className="epc-sig__drop">
            <img
              src={value || saved}
              alt="Profile signature"
              className="epc-sig__preview"
            />
            <Button
              variant="secondary"
              disabled={disabled}
              onClick={() => startFresh("draw")}
            >
              Change signature
            </Button>
          </div>
        ) : mode === "draw" ? (
          <div className="epc-sig__pad">
            <SignatureCanvas
              ref={padRef}
              penColor="#121212"
              onEnd={emitDrawn}
              canvasProps={{
                width,
                height: compact ? 72 : 130,
                style: disabled ? { pointerEvents: "none", opacity: 0.5 } : undefined,
                "aria-label": label,
              }}
            />
          </div>
        ) : (
          <div className="epc-sig__drop">
            {uploaded ? (
              <img src={value} alt="Uploaded signature" className="epc-sig__preview" />
            ) : (
              <p className="epc-section__desc">PNG or JPEG, up to 2MB.</p>
            )}
            <Button
              variant="secondary"
              disabled={disabled}
              onClick={() => fileRef.current?.click()}
            >
              {uploaded ? "Choose a different image" : "Choose an image"}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg"
              hidden
              onChange={onFile}
            />
          </div>
        )}
      </div>

      {uploadError ? (
        <p className="epc-field__error" role="alert">
          {uploadError}
        </p>
      ) : null}

      <div className="epc-sig__foot">
        <span>
          {value
            ? usingSaved
              ? "Using your profile signature."
              : "Signature captured."
            : "Not signed yet."}
        </span>
        <button
          type="button"
          className="epc-sig__clear"
          disabled={disabled || !value}
          onClick={clear}
        >
          {usingSaved ? "Remove" : "Clear"}
        </button>
      </div>
    </div>
  );
};

export default SignaturePad;
