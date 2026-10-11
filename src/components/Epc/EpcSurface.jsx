import React from "react";

import CustomerBrandingProvider from "@/customer/branding/CustomerBrandingProvider";
import { ArrowLeftIcon } from "@/customer/components/ui/icons";
import "@/customer/styles/index.css";
import "./epc-admin.css";

/**
 * Runs a slice of the admin app on the customer portal's design system.
 *
 * The portal was built to be mountable next to the admin application: its
 * stylesheet is scoped under `.epc-root` and its tokens are published on that
 * element rather than on `:root`, so nothing here reaches the rest of the
 * admin. `CustomerBrandingProvider` renders that element, which is why this
 * wrapper delegates to it rather than re-implementing the scoping.
 *
 * One consequence worth knowing: the portal is authored in `px` because the
 * admin sets a 14px root font size, so `rem` would rescale every measurement.
 * Anything written for this surface should follow the same rule.
 */
export default function EpcSurface({ children, className = "" }) {
  return (
    <CustomerBrandingProvider className={`epc-admin-surface ${className}`.trim()}>
      {children}
    </CustomerBrandingProvider>
  );
}

/**
 * The way back, up one level.
 *
 * Given its own component because it appears on every detail screen and needs
 * to look and sit identically on each — a back affordance that moves between
 * pages reads as a different control every time.
 */
export function EpcBack({ label = "Back", onClick }) {
  return (
    <button type="button" className="epc-back" onClick={onClick}>
      <span className="epc-back__icon" aria-hidden="true">
        <ArrowLeftIcon size={15} />
      </span>
      <span>{label}</span>
    </button>
  );
}

/**
 * The page shell: the way back, a heading, optional actions, and the portal's
 * own page padding — matching what a customer sees on their own screens.
 *
 * `flush` drops the outer padding for a page already sitting inside a padded
 * frame, which the Settings screens do.
 */
export function EpcPage({
  title,
  subtitle,
  action,
  back,
  flush = false,
  children,
}) {
  return (
    <EpcSurface>
      <div className={`epc-admin-page${flush ? " epc-admin-page--flush" : ""}`}>
        {back ? <EpcBack label={back.label} onClick={back.onClick} /> : null}
        {title ? (
          <div className="epc-pagehead">
            <div>
              <h1 className="epc-pagehead__title">{title}</h1>
              {subtitle ? (
                <p className="epc-pagehead__subtitle">{subtitle}</p>
              ) : null}
            </div>
            {action ? <div className="epc-pagehead__action">{action}</div> : null}
          </div>
        ) : null}
        {children}
      </div>
    </EpcSurface>
  );
}
