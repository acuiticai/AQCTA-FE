import React from "react";
import { useLocation } from "react-router-dom";

import PortalLayout, { PageHeading } from "../layouts/PortalLayout";
import { findNavItemByPath } from "../config/navigation";

/**
 * Stand-in for a module that is listed in the nav but not built yet.
 *
 * Every declared module therefore has a working route from day one; replacing
 * it is a one-line swap in `CustomerRoutes.jsx` once the real screen exists.
 */
export default function ModulePlaceholder() {
  const location = useLocation();
  const module = findNavItemByPath(location.pathname);
  const label = module?.label || "This module";

  return (
    <PortalLayout>
      <PageHeading
        title={label}
        subtitle="This section of the customer portal is on the way."
      />
      <div className="epc-placeholder">
        <p className="epc-placeholder__title">{label} is coming soon</p>
        <p className="epc-placeholder__text">
          The navigation and portal shell are already in place — this screen will
          appear here once the module is built.
        </p>
      </div>
    </PortalLayout>
  );
}
