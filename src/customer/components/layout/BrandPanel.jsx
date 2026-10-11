import React from "react";

import { useBranding } from "../../branding";

/**
 * Left auth brand panel: dark navy field, light wordmark, copy at the bottom.
 */
export default function BrandPanel() {
  const { identity, panelCopy } = useBranding();
  const logo = identity.logoDark || identity.logo;

  return (
    <aside className="epc-brand-panel" aria-label="AQCTA">
      <div className="epc-brand-panel__glow" aria-hidden="true" />

      <img
        className="epc-brand-panel__logo"
        src={`${logo.src}?v=on-dark-2`}
        alt={logo.alt}
        width={logo.width}
      />

      <div className="epc-brand-panel__copy">
        <span className="epc-eyebrow epc-brand-panel__eyebrow">
          {panelCopy.eyebrow}
        </span>
        <h2 className="epc-brand-panel__headline">{panelCopy.headline}</h2>
        <p className="epc-brand-panel__body">{panelCopy.body}</p>
      </div>
    </aside>
  );
}
