import React, { useState } from "react";
import { useLocation } from "react-router-dom";

import Sidebar from "../components/portal/Sidebar";
import Topbar from "../components/portal/Topbar";
import { findNavItemByPath } from "../config/navigation";
import { useAccount } from "../context/AccountContext";

/**
 * Shell for every signed-in portal screen: fixed sidebar, sticky topbar and a
 * single scrolling content column.
 *
 * Only the content column scrolls, so the sidebar and breadcrumb stay put no
 * matter how long a module's page gets. New modules render as `children` and
 * inherit the whole chrome — including a breadcrumb derived from the nav
 * registry, so they never hard-code their own title.
 */
export default function PortalLayout({ children, crumbs }) {
  const location = useLocation();
  const accountCtx = useAccount();
  const account = accountCtx.account || accountCtx;
  const [navOpen, setNavOpen] = useState(false);

  const current = findNavItemByPath(location.pathname);
  const trail = crumbs || [
    { label: "Customer Portal" },
    current
      ? { label: current.label, icon: current.icon }
      : { label: "Overview" },
  ];

  return (
    <div className="epc-portal">
      <Sidebar
        account={account}
        open={navOpen}
        onNavigate={() => setNavOpen(false)}
      />

      {navOpen && (
        <button
          type="button"
          className="epc-portal__scrim"
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
        />
      )}

      <div className="epc-portal__main">
        <Topbar
          crumbs={trail}
          account={account}
          onMenuToggle={() => setNavOpen((open) => !open)}
        />
        <main className="epc-portal__content">{children}</main>
      </div>
    </div>
  );
}

/**
 * Page title block used at the top of a module screen.
 */
export function PageHeading({ title, subtitle, action }) {
  return (
    <div className="epc-pagehead">
      <div>
        <h1 className="epc-pagehead__title">{title}</h1>
        {subtitle && <p className="epc-pagehead__subtitle">{subtitle}</p>}
      </div>
      {action && <div className="epc-pagehead__action">{action}</div>}
    </div>
  );
}
