import React from "react";

import { useBranding } from "../../branding";

/**
 * Single-column card used for the OTP verification screen: centred logo above
 * a 480px content column, no gradient panel. `footer` pins to the bottom edge.
 */
export default function CenteredAuthLayout({ footer, children }) {
  const { identity } = useBranding();

  return (
    <div className="epc-shell">
      <div className="epc-centered-card">
        <div className="epc-centered-card__inner">
          <img
            className="epc-centered-card__logo"
            src={identity.logo.src}
            alt={identity.logo.alt}
          />
          {children}
        </div>
        {footer && <div className="epc-centered-card__footer">{footer}</div>}
      </div>
    </div>
  );
}
