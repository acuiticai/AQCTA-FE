import React, { forwardRef } from "react";

const VARIANTS = {
  primary: "epc-btn--primary",
  secondary: "epc-btn--secondary",
  ghost: "epc-btn--ghost",
  danger: "epc-btn--danger",
};

/**
 * Portal button.
 *
 * variant: "primary" | "secondary" | "ghost" | "danger"
 * size:    "sm" (40px) | "md" (48px) | "lg" (52px) — ghost is fixed at 40px
 *          regardless of size, since it is already the compact variant
 * block:   stretch to the container width
 * grow:    flex-grow inside a wizard footer
 */
/** forwardRef so dialogs can move focus to a specific button on open. */
const Button = forwardRef(function Button(
  {
    variant = "primary",
    size = "md",
    block = false,
    grow = false,
    loading = false,
    disabled = false,
    type = "button",
    className = "",
    children,
    ...rest
  },
  ref,
) {
  const classes = [
    "epc-btn",
    VARIANTS[variant] || VARIANTS.primary,
    size === "lg" ? "epc-btn--lg" : size === "sm" ? "epc-btn--sm" : "",
    block ? "epc-btn--block" : "",
    grow ? "epc-btn--grow" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <span className="epc-btn__spinner" aria-hidden="true" />}
      {children}
    </button>
  );
});

export default Button;
