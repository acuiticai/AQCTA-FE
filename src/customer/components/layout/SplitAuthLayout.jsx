import React from "react";

import BrandPanel from "./BrandPanel";

/**
 * Sign-in / registration shell: gradient brand panel beside the form panel,
 * both inside the 1184x720 card.
 *
 * width:  "narrow" centres a 480px column (sign-in),
 *         "wide" fills the 536px registration column.
 * align:  "center" floats the form in the panel (sign-in),
 *         "top" anchors it so `footer` sits on the bottom edge (wizard).
 * footer: block pinned to the bottom of the form panel.
 */
export default function SplitAuthLayout({
  width = "wide",
  align = "top",
  footer,
  children,
}) {
  return (
    <div className="epc-shell">
      <div className="epc-card">
        <BrandPanel />
        <main
          className={`epc-form-panel epc-form-panel--${width} epc-form-panel--${align}`}
        >
          <div className="epc-form-panel__inner">{children}</div>
          {footer && <div className="epc-form-panel__footer">{footer}</div>}
        </main>
      </div>
    </div>
  );
}
