import React from "react";

import { useBranding } from "../../branding";

/**
 * Eyebrow + title + subtitle block that opens each auth screen.
 *
 * size: "hero" (40px — sign-in) | "display" (44px — OTP) | "title" (32px — wizard)
 * airy:  widens the title/subtitle gap, matching the OTP frame.
 * tight: drops the bottom margin when the step chevrons follow immediately.
 */
export default function AuthHeader({
  eyebrow,
  title,
  subtitle,
  size = "title",
  airy = false,
  tight = false,
}) {
  const headingClass =
    size === "hero"
      ? "epc-hero"
      : size === "display"
        ? "epc-display"
        : "epc-title";

  return (
    <header
      className={[
        "epc-auth-header",
        airy ? "epc-auth-header--airy" : "",
        tight ? "epc-auth-header--tight" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {eyebrow && (
        <span className="epc-eyebrow epc-auth-header__eyebrow">{eyebrow}</span>
      )}
      <h1 className={headingClass}>{title}</h1>
      {subtitle && (
        <p className="epc-lead epc-auth-header__subtitle">{subtitle}</p>
      )}
    </header>
  );
}

export function SecureNote({ className = "" }) {
  const { identity } = useBranding();
  return (
    <p className={`epc-secure-note ${className}`.trim()}>
      {identity.secureNote}
    </p>
  );
}
