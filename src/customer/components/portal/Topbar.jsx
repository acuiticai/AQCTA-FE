import React, { useEffect, useRef, useState } from "react";
import { useHistory } from "react-router-dom";

import { useAccount } from "../../context/AccountContext";
import { customerPath } from "../../routes/paths";
import { GridIcon, LogoutIcon } from "../ui/icons";
import NotificationBell from "./NotificationBell";

/**
 * Breadcrumb on the left, account chrome on the right. `crumbs` is
 * `[{ label, icon? }]`; the last entry renders as the current page.
 */
export default function Topbar({ crumbs = [], account, onMenuToggle }) {
  const history = useHistory();
  const { signOut } = useAccount();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;

    const handlePointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const handleLogout = () => {
    setMenuOpen(false);
    signOut();
    history.push(customerPath.login);
  };

  return (
    <header className="epc-topbar">
      <button
        type="button"
        className="epc-topbar__menu"
        onClick={onMenuToggle}
        aria-label="Toggle navigation"
      >
        <GridIcon size={18} />
      </button>

      <nav className="epc-breadcrumbs" aria-label="Breadcrumb">
        <ol>
          {crumbs.map((crumb, index) => {
            const isLast = index === crumbs.length - 1;
            return (
              <li key={crumb.label} aria-current={isLast ? "page" : undefined}>
                {index > 0 && (
                  <span className="epc-breadcrumbs__sep" aria-hidden="true">
                    /
                  </span>
                )}
                {crumb.icon && (
                  <span className="epc-breadcrumbs__icon" aria-hidden="true">
                    <crumb.icon size={15} />
                  </span>
                )}
                <span className={isLast ? "epc-breadcrumbs__current" : undefined}>
                  {crumb.label}
                </span>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="epc-topbar__actions">
        <NotificationBell />

        <div className="epc-account-menu" ref={menuRef}>
          <button
            type="button"
            className="epc-avatar epc-avatar--sm epc-avatar--btn"
            aria-label="Account menu"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {account.initials}
          </button>

          {menuOpen && (
            <div className="epc-account-menu__panel" role="menu">
              <div className="epc-account-menu__meta">
                <span className="epc-account-menu__name">{account.name}</span>
                <span className="epc-account-menu__email">{account.email}</span>
              </div>
              <button
                type="button"
                className="epc-account-menu__item"
                role="menuitem"
                onClick={handleLogout}
              >
                <LogoutIcon size={16} aria-hidden="true" />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
