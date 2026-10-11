import React, { useEffect, useRef } from "react";

import Button from "./Button";

/**
 * Modal confirmation for destructive actions.
 *
 * Focus moves to the cancel button on open (so a stray Enter does not delete),
 * Escape closes, and a click on the backdrop cancels.
 */
export default function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  onConfirm,
  onCancel,
}) {
  const cancelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    cancelRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") onCancel?.();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="epc-modal"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel?.();
      }}
    >
      <div
        className="epc-modal__panel"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="epc-modal-title"
      >
        <h2 className="epc-modal__title" id="epc-modal-title">
          {title}
        </h2>
        {body && <p className="epc-modal__body">{body}</p>}
        <div className="epc-modal__actions">
          <Button variant="secondary" ref={cancelRef} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <button
            type="button"
            className={`epc-btn epc-btn--${tone === "danger" ? "danger" : "primary"}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
