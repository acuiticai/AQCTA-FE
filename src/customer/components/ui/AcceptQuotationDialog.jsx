import React, { useEffect, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";

import Button from "./Button";
import { TextField } from "./Field";

/**
 * Customer acceptance / rejection of an inspection quotation (AQCTA-FOR-06-03).
 *
 * Name / position / e-sign / company chop can be prefilled from the customer
 * profile; all remain editable so the authorised representative can correct
 * them before they are stamped onto page 2 of the quotation PDF.
 */
export default function AcceptQuotationDialog({
  open,
  decision = "Accepted",
  quotationRef = "",
  defaultName = "",
  defaultPosition = "",
  defaultSignature = "",
  defaultCompanyChop = "",
  onCancel,
  onSubmit,
  busy = false,
}) {
  const padRef = useRef(null);
  const wrapRef = useRef(null);
  const chopFileRef = useRef(null);
  const [name, setName] = useState("");
  const [position, setPosition] = useState("");
  const [signature, setSignature] = useState("");
  /** Saved profile e-sign shown as a preview until the user clears / redraws. */
  const [usingSavedSignature, setUsingSavedSignature] = useState(false);
  const [companyChop, setCompanyChop] = useState("");
  const [usingSavedChop, setUsingSavedChop] = useState(false);
  const [error, setError] = useState("");
  const [nameError, setNameError] = useState("");
  const [width, setWidth] = useState(420);

  const accepting = decision === "Accepted";

  useEffect(() => {
    if (!open) {
      setName("");
      setPosition("");
      setSignature("");
      setUsingSavedSignature(false);
      setCompanyChop("");
      setUsingSavedChop(false);
      setError("");
      setNameError("");
      return;
    }
    setName(defaultName || "");
    setPosition(defaultPosition || "");
    const savedSig = String(defaultSignature || "").trim();
    if (savedSig) {
      setSignature(savedSig);
      setUsingSavedSignature(true);
    } else {
      setSignature("");
      setUsingSavedSignature(false);
    }
    const savedChop = String(defaultCompanyChop || "").trim();
    if (savedChop) {
      setCompanyChop(savedChop);
      setUsingSavedChop(true);
    } else {
      setCompanyChop("");
      setUsingSavedChop(false);
    }
  }, [open, defaultName, defaultPosition, defaultSignature, defaultCompanyChop]);

  useEffect(() => {
    const element = wrapRef.current;
    if (!element || !open || usingSavedSignature) return undefined;
    const measure = () => setWidth(Math.max(240, element.clientWidth - 2));
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [open, usingSavedSignature]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !busy) onCancel?.();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const clearSignature = () => {
    padRef.current?.clear();
    setSignature("");
    setUsingSavedSignature(false);
    setError("");
  };

  const clearCompanyChop = () => {
    setCompanyChop("");
    setUsingSavedChop(false);
  };

  const onChopFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setError("Company chop must be a PNG or JPEG image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Company chop image must be 2MB or smaller.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setUsingSavedChop(false);
      setCompanyChop(String(reader.result || ""));
      setError("");
    };
    reader.onerror = () => setError("Company chop image could not be read.");
    reader.readAsDataURL(file);
  };

  const submit = () => {
    if (!name.trim()) {
      setNameError("Please give your name.");
      setError("");
      return;
    }
    setNameError("");
    if (accepting && !signature) {
      setError("Please sign in the box.");
      return;
    }
    setError("");
    onSubmit?.({
      name: name.trim(),
      position: position.trim(),
      signatureDataUrl: signature || "",
      companyChop: companyChop || "",
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
        className="epc-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="epc-accept-quote-title"
        style={{ maxWidth: 520 }}
      >
        <h2 className="epc-modal__title" id="epc-accept-quote-title">
          {accepting ? "Accept quotation" : "Decline quotation"}
          {quotationRef ? ` ${quotationRef}` : ""}
        </h2>
        <p className="epc-section__desc">
          {accepting
            ? "Your name, position, signature and company chop will be filled on the quotation (authorised representative). Edit any field if needed."
            : "Confirm you disagree with this quotation. AQCTA will be notified so they can revise it and send it back to you. Your name will be recorded on the document."}
        </p>

        <div className="epc-stack" style={{ marginTop: 16 }}>
          <TextField
            label="Name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            error={nameError}
            disabled={busy}
          />
          <TextField
            label="Position"
            value={position}
            onChange={(event) => setPosition(event.target.value)}
            disabled={busy}
          />

          {accepting ? (
            <>
              <div>
                <p className="epc-field__label">
                  Signature <span aria-hidden="true">*</span>
                </p>
                <div
                  ref={wrapRef}
                  style={{
                    border: "1px solid #d1d5db",
                    borderRadius: 8,
                    background: "#fff",
                    overflow: "hidden",
                    minHeight: 140,
                  }}
                >
                  {usingSavedSignature && signature ? (
                    <img
                      src={signature}
                      alt="Saved e-signature"
                      style={{
                        display: "block",
                        width: "100%",
                        height: 140,
                        objectFit: "contain",
                        background: "#fff",
                      }}
                    />
                  ) : (
                    <SignatureCanvas
                      ref={padRef}
                      penColor="#111"
                      canvasProps={{
                        width,
                        height: 140,
                        className: "epc-signature-pad",
                        style: { width: "100%", display: "block" },
                      }}
                      onEnd={() => {
                        const pad = padRef.current;
                        if (!pad || pad.isEmpty()) {
                          setSignature("");
                          return;
                        }
                        setSignature(
                          pad.getTrimmedCanvas().toDataURL("image/png"),
                        );
                      }}
                    />
                  )}
                </div>
                <div className="epc-actions" style={{ marginTop: 8 }}>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={clearSignature}
                  >
                    {usingSavedSignature
                      ? "Change signature"
                      : "Clear signature"}
                  </Button>
                </div>
                {usingSavedSignature ? (
                  <p className="epc-section__desc" style={{ marginTop: 6 }}>
                    Using the signature from your profile. Change it to draw a
                    different one for this document only.
                  </p>
                ) : null}
              </div>

              <div>
                <p className="epc-field__label">Company chop</p>
                <div
                  style={{
                    border: "1px solid #d1d5db",
                    borderRadius: 8,
                    background: "#fff",
                    overflow: "hidden",
                    minHeight: 100,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 8,
                  }}
                >
                  {companyChop ? (
                    <img
                      src={companyChop}
                      alt="Company chop"
                      style={{
                        display: "block",
                        maxWidth: "100%",
                        maxHeight: 120,
                        objectFit: "contain",
                      }}
                    />
                  ) : (
                    <p className="epc-section__desc" style={{ margin: 0 }}>
                      Optional — upload your company stamp / chop
                    </p>
                  )}
                </div>
                <div className="epc-actions" style={{ marginTop: 8 }}>
                  {companyChop ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={clearCompanyChop}
                    >
                      {usingSavedChop ? "Change chop" : "Clear chop"}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => chopFileRef.current?.click()}
                  >
                    {companyChop ? "Upload different chop" : "Upload company chop"}
                  </Button>
                  <input
                    ref={chopFileRef}
                    type="file"
                    accept="image/png,image/jpeg"
                    hidden
                    onChange={onChopFile}
                  />
                </div>
                {usingSavedChop ? (
                  <p className="epc-section__desc" style={{ marginTop: 6 }}>
                    Using the company chop from your profile. Change it to use
                    a different stamp for this document only.
                  </p>
                ) : null}
              </div>
            </>
          ) : null}

          {error ? (
            <p className="epc-field__error" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="epc-actions" style={{ marginTop: 20 }}>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            loading={busy}
            disabled={busy}
            variant={accepting ? "primary" : "danger"}
          >
            {busy
              ? "Saving…"
              : accepting
                ? "Accept & sign"
                : "Confirm decline"}
          </Button>
        </div>
      </div>
    </div>
  );
}
