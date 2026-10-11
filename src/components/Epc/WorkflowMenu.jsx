import React, { useCallback, useEffect, useRef, useState } from "react";

import StatusPill from "@/customer/components/ui/StatusPill";
import { GridIcon } from "@/customer/components/ui/icons";

/**
 * A job's stages, offered from the row it belongs to.
 *
 * The list is what the server says can be opened — a stage still waiting on
 * the one before it never reaches here — so every entry goes somewhere that
 * can actually be worked on.
 *
 * Positioned against the viewport rather than the row: the table scrolls
 * horizontally, and a menu laid out inside it would be clipped by that.
 */
export default function WorkflowMenu({
  stages = [],
  onSelect,
  label = "Open a stage",
  emptyMessage = "Nothing to open yet.",
}) {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState({ top: 0, right: 0 });
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    /* Roughly what the menu will occupy, so a row near the foot of the page
       opens upwards instead of off the bottom of it. */
    const height = Math.min(stages.length * 56 + 56, 320);
    const below = window.innerHeight - rect.bottom;
    setAt({
      top: below < height && rect.top > height ? rect.top - height - 6 : rect.bottom + 6,
      right: Math.max(8, window.innerWidth - rect.right),
    });
  }, [stages.length]);

  useEffect(() => {
    if (!open) return undefined;
    place();
    const close = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  return (
    <div className="epc-wfmenu" ref={wrapRef}>
      <button
        type="button"
        ref={triggerRef}
        className="epc-wfmenu__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={() => setOpen((prev) => !prev)}
      >
        <GridIcon size={16} />
      </button>

      {open ? (
        <div
          className="epc-wfmenu__panel"
          role="menu"
          style={{ top: at.top, right: at.right }}
        >
          <p className="epc-wfmenu__head">{label}</p>
          {stages.length ? (
            stages.map((stage) => (
              <button
                key={stage.key}
                type="button"
                role="menuitem"
                className="epc-wfmenu__item"
                onClick={() => {
                  setOpen(false);
                  onSelect?.(stage);
                }}
              >
                <span className="epc-wfmenu__text">
                  <span className="epc-wfmenu__title">{stage.title}</span>
                  {stage.documentCode ? (
                    <span className="epc-wfmenu__code">{stage.documentCode}</span>
                  ) : null}
                </span>
                <StatusPill status={stage.status} />
              </button>
            ))
          ) : (
            <p className="epc-wfmenu__empty">{emptyMessage}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
