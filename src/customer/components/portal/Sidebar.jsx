import React from "react";
import { NavLink, useHistory } from "react-router-dom";

import { useBranding } from "../../branding";
import navSections from "../../config/navigation";
import { useAccount } from "../../context/AccountContext";
import { customerPath } from "../../routes/paths";
import { HelpIcon, LogoutIcon } from "../ui/icons";

/**
 * Portal navigation. Renders whatever `config/navigation.js` declares, so a new
 * module never requires touching this file.
 */
export default function Sidebar({ account, open, onNavigate }) {
  const { identity } = useBranding();
  const history = useHistory();
  const { signOut } = useAccount();

  const handleLogout = () => {
    onNavigate?.();
    signOut();
    history.push(customerPath.login);
  };

  return (
    <aside className={`epc-sidebar${open ? " is-open" : ""}`}>
      <div className="epc-sidebar__brand">
        <img
          src={(identity.logoDark || identity.logo).src}
          alt={(identity.logoDark || identity.logo).alt}
          className="epc-sidebar__logo"
        />
      </div>

      <nav className="epc-sidebar__nav" aria-label="Portal sections">
        {navSections.map((section) => (
          <div className="epc-navgroup" key={section.id}>
            <p className="epc-navgroup__label">{section.label}</p>
            <ul className="epc-navgroup__list">
              {section.items
                .filter((item) => !item.hidden)
                .map((item) => (
                  <li key={item.id}>
                    <NavLink
                      to={item.path}
                      className="epc-navitem"
                      activeClassName="is-active"
                      onClick={onNavigate}
                    >
                      <span className="epc-navitem__icon" aria-hidden="true">
                        <item.icon size={18} />
                      </span>
                      <span className="epc-navitem__label">{item.label}</span>
                    </NavLink>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="epc-sidebar__foot">
        <button type="button" className="epc-navitem epc-navitem--quiet">
          <span className="epc-navitem__icon" aria-hidden="true">
            <HelpIcon size={18} />
          </span>
          <span className="epc-navitem__label">Help &amp; Support</span>
        </button>

        <button
          type="button"
          className="epc-navitem epc-navitem--quiet"
          onClick={handleLogout}
        >
          <span className="epc-navitem__icon" aria-hidden="true">
            <LogoutIcon size={18} />
          </span>
          <span className="epc-navitem__label">Logout</span>
        </button>

        <div className="epc-account">
          <span className="epc-avatar" aria-hidden="true">
            {account.initials}
          </span>
          <span className="epc-account__text">
            <span className="epc-account__name">{account.name}</span>
            <span className="epc-account__email">{account.email}</span>
          </span>
        </div>
      </div>
    </aside>
  );
}
