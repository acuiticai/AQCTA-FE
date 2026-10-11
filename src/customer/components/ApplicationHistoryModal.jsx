import React, { useEffect, useMemo, useRef } from "react";

import Button from "./ui/Button";
import { Timeline } from "./ui/DetailBlocks";
import { buildApplicationTimeline } from "../../utils/applicationTimeline";

/**
 * Customer-visible activity log popup for My Applications.
 */
export default function ApplicationHistoryModal({
  open,
  onClose,
  application,
}) {
  const closeRef = useRef(null);

  const entries = useMemo(
    () =>
      application
        ? buildApplicationTimeline(application, { customerFacing: true })
        : [],
    [application],
  );

  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const ref =
    application?.applicationNumber ||
    application?.id ||
    application?._id ||
    "—";

  return (
    <div
      className="epc-modal"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        className="epc-modal__panel epc-modal__panel--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="epc-app-history-title"
      >
        <h2 className="epc-modal__title" id="epc-app-history-title">
          Activity — {ref}
        </h2>
        {application?.status ? (
          <p className="epc-modal__body">
            Current status: <strong>{application.status}</strong>
          </p>
        ) : null}

        <div className="epc-modal__scroll">
          {entries.length ? (
            <Timeline entries={entries} />
          ) : (
            <p className="epc-modal__body">No activity to show yet.</p>
          )}
        </div>

        <div className="epc-modal__actions">
          <Button variant="primary" ref={closeRef} onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
