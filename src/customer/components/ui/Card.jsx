import React from "react";

import { ArrowRightIcon } from "./icons";

/**
 * The portal's surface primitive. Every dashboard panel is a Card, so padding,
 * radius and border live in exactly one place.
 *
 * span: how many of the 3 dashboard grid columns to occupy.
 */
export function Card({ span, padded = true, className = "", children, ...rest }) {
  return (
    <section
      className={[
        "epc-card-panel",
        padded ? "" : "epc-card-panel--flush",
        span ? `epc-span-${span}` : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </section>
  );
}

/**
 * Title + optional subtitle on the left, arbitrary controls on the right.
 */
export function CardHeader({ title, subtitle, action, className = "" }) {
  return (
    <header className={`epc-card-head ${className}`.trim()}>
      <div className="epc-card-head__text">
        <h2 className="epc-card-head__title">{title}</h2>
        {subtitle && <p className="epc-card-head__subtitle">{subtitle}</p>}
      </div>
      {action && <div className="epc-card-head__action">{action}</div>}
    </header>
  );
}

/** Trailing "View all …" affordance shared by every panel. */
export function CardLink({ children, onClick, href }) {
  const content = (
    <>
      {children}
      <ArrowRightIcon size={14} />
    </>
  );

  return href ? (
    <a className="epc-card-link" href={href}>
      {content}
    </a>
  ) : (
    <button type="button" className="epc-card-link" onClick={onClick}>
      {content}
    </button>
  );
}

/** Right-aligned footer link row. */
export function CardFooterLink({ children, onClick }) {
  return (
    <div className="epc-card-foot">
      <CardLink onClick={onClick}>{children}</CardLink>
    </div>
  );
}

/**
 * Rounded icon container used by stat cards and activity rows.
 * tone: "brand" | "neutral" | "success" | "warning" | "info"
 */
export function IconTile({ icon: Icon, tone = "brand", size = "md" }) {
  return (
    <span
      className={`epc-icon-tile epc-icon-tile--${tone} epc-icon-tile--${size}`}
      aria-hidden="true"
    >
      <Icon size={size === "sm" ? 16 : 18} />
    </span>
  );
}

export default Card;
