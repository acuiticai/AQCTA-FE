import React, { useEffect } from "react";

import EpcSurface from "@/components/Epc/EpcSurface";
import { CloseIcon } from "@/customer/components/ui/icons";

/**
 * Right-hand slide-over for a certification record.
 *
 * The platform's generic Quotation and Invoice screens belong to the sales
 * module and carry its own fields and operations. A certification quotation or
 * invoice is a different object with a different lifecycle, so it gets its own
 * presentation rather than borrowing one that nearly fits.
 *
 * It carries its own `EpcSurface` because it renders through a portal-like
 * overlay: the tokens have to be on an ancestor of the panel, not merely on
 * the page behind it.
 */
const DetailDrawer = ({ open, title, subtitle, onClose, children, footer }) => {
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
    <EpcSurface>
      <div className="epc-drawer">
        <div
          className="epc-drawer__scrim"
          role="presentation"
          onClick={onClose}
        />
        <aside
          className="epc-drawer__panel"
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <header className="epc-drawer__head">
            <div style={{ minWidth: 0 }}>
              <h2 className="epc-card-head__title">{title}</h2>
              {subtitle ? (
                <p className="epc-card-head__subtitle">{subtitle}</p>
              ) : null}
            </div>
            <button
              type="button"
              className="epc-drawer__close"
              onClick={onClose}
              aria-label="Close"
            >
              <CloseIcon size={18} />
            </button>
          </header>

          <div className="epc-drawer__body">{children}</div>

          {footer ? <footer className="epc-drawer__foot">{footer}</footer> : null}
        </aside>
      </div>
    </EpcSurface>
  );
};

/** Label/value pairs, as the portal sets them on a detail screen. */
export const DetailGrid = ({ items = [] }) => (
  <div className="epc-facts">
    {items.map((item) => (
      <div key={item.label}>
        <p className="epc-facts__label">{item.label}</p>
        <p className="epc-facts__value">{item.value || "—"}</p>
      </div>
    ))}
  </div>
);

/** A titled block inside a drawer. */
export const DetailSection = ({ title, children }) => (
  <section className="epc-section" style={{ marginTop: 0 }}>
    {title ? (
      <header className="epc-section__head">
        <h3 className="epc-section__title">{title}</h3>
      </header>
    ) : null}
    {children}
  </section>
);

export default DetailDrawer;
