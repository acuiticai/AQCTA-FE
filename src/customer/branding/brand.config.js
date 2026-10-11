/**
 * AQCTA Customer Portal — branding configuration.
 *
 * Company identity comes from `src/config/aqctaIdentity.js` so admin, portal,
 * and emails stay aligned. Tokens here still own the portal visual system.
 *
 * Every value here is published as a CSS custom property on the portal root by
 * `CustomerBrandingProvider`. Token names are emitted as `--epc-<kebab-case-key>`.
 */

import { AQCTA_IDENTITY } from "@/config/aqctaIdentity";

export const brandIdentity = {
  productName: AQCTA_IDENTITY.productName,
  portalName: AQCTA_IDENTITY.portalName,
  companyName: AQCTA_IDENTITY.companyName,
  companyTagline: AQCTA_IDENTITY.companyTagline,
  logo: {
    src: AQCTA_IDENTITY.logoLightPath,
    alt: AQCTA_IDENTITY.companyName,
    width: 280,
  },
  logoDark: {
    src: AQCTA_IDENTITY.logoDarkPath,
    alt: AQCTA_IDENTITY.companyName,
    width: 280,
  },
  mark: {
    src: AQCTA_IDENTITY.markPath,
    alt: AQCTA_IDENTITY.shortName,
    width: 48,
  },
  secureNote: `Secure access to ${AQCTA_IDENTITY.shortName} customer services`,
};

/**
 * Marketing copy shown on the gradient brand panel of the split auth screens.
 */
export const brandPanelCopy = {
  eyebrow: AQCTA_IDENTITY.shortName,
  headline: "Assessed, verified — for acceptance, trust & quality.",
  body: `Conformity assessment for medical devices — ISO 13485, GDPMD, and verification workflows in one secure workspace. CAB ${AQCTA_IDENTITY.cabReg}.`,
};

/**
 * Core palette derived from the TECHNICAL assessors logo.
 * Signature ramp: soft rose → brand red → deep crimson → ink black.
 */
export const brandColors = {
  // Signature ramp (logo red on black)
  "brand-mist": "#FDF2F3",
  "brand-sky": "#F5C4C9",
  "brand-cyan": "#FE0032",
  "brand-royal": "#C5061A",
  "brand-navy": "#0A0A0A",
  "brand-ink": "#111111",

  // Primary action colour
  primary: "#C5061A",
  "primary-hover": "#A30516",
  "primary-active": "#860412",
  "primary-soft": "#FDECEE",
  "primary-ring": "rgba(197, 6, 26, 0.22)",

  // Surfaces — cool content plane against black chrome
  "page-bg": "#F4F0F1",
  surface: "#FFFFFF",
  "surface-muted": "#FAF6F7",
  "surface-subtle": "#F0E6E8",

  // Text
  "text-strong": "#0A0A0A",
  text: "#1A1A1A",
  "text-muted": "#5A5A5A",
  "text-subtle": "#848484",
  "text-inverse": "#FFFFFF",
  "text-on-navy": "#F5F5F5",
  "text-on-navy-muted": "rgba(245, 245, 245, 0.72)",

  // Lines & fields
  border: "#E0D6D8",
  "border-strong": "#C5B8BA",
  "field-bg": "#FFFFFF",
  "field-border": "#E0D6D8",
  "field-border-hover": "#B8A8AA",
  placeholder: "#95A3A8",
  "scrollbar-thumb": "#B0B0B0",
  "scrollbar-thumb-hover": "#848484",

  // Feedback / status. Reserved: these never double as chart series colours.
  danger: "#C5061A",
  "danger-soft": "#FDECEE",
  success: "#1F8A4C",
  "success-soft": "#EAF6EF",
  warning: "#B7791F",
  "warning-soft": "#FDF4E3",
  info: "#C5061A",
  "info-soft": "#FDECEE",

  // Signed-in portal — black chrome, warm content
  "portal-bg": "#F5F2F3",
  "sidebar-bg": "#0A0A0A",
  "sidebar-border": "rgba(255, 255, 255, 0.08)",
  "nav-hover-bg": "rgba(255, 255, 255, 0.06)",
  "nav-active-bg": "rgba(197, 6, 26, 0.22)",
  "nav-active-color": "#FE0032",
  "nav-text": "rgba(245, 245, 245, 0.68)",
  "nav-label": "rgba(245, 245, 245, 0.38)",
};

/**
 * Chart colours — single red hue family matching the logo.
 */
export const brandChart = {
  "chart-track": "#FDECEE",
  "chart-fill": "#F08090",
  "chart-emphasis": "#C5061A",
  "chart-positive": "#1F8A4C",
  "chart-negative": "#C5061A",
  "tooltip-bg": "#111111",
};

/**
 * Progress-chevron states used by the multi-step registration wizard.
 */
export const brandStepColors = {
  "step-idle-bg": "#F0E8EA",
  "step-idle-border": "#F0E8EA",
  "step-idle-title": "#8A9098",
  "step-idle-caption": "#9AA0A8",

  "step-done-bg": "#F5C4C9",
  "step-done-border": "#C5061A",
  "step-done-title": "#C5061A",
  "step-done-caption": "#A30516",

  "step-active-bg": "#C5061A",
  "step-active-border": "#C5061A",
  "step-active-title": "#FFFFFF",
  "step-active-caption": "#FDECEE",
};

/**
 * Brand panel — deep black field with red glow (logo energy).
 */
export const brandGradient = {
  "panel-gradient": [
    "radial-gradient(90% 70% at 12% 8%, rgba(254, 0, 50, 0.32) 0%, transparent 55%)",
    "radial-gradient(70% 55% at 92% 88%, rgba(197, 6, 26, 0.45) 0%, transparent 58%)",
    "radial-gradient(50% 40% at 70% 20%, rgba(254, 0, 50, 0.12) 0%, transparent 50%)",
    "linear-gradient(165deg, #111111 0%, #0A0A0A 42%, #140808 72%, #1A0A0A 100%)",
  ].join(", "),
};

/**
 * Typography. Outfit = geometric display; Plus Jakarta Sans = readable UI body.
 * Both load from Google Fonts in index.html.
 */
export const brandTypography = {
  "font-display":
    '"Outfit", "Plus Jakarta Sans", "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif',
  "font-body":
    '"Plus Jakarta Sans", "Outfit", "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif',

  "text-hero": "40px",
  "text-hero-lh": "48px",
  "text-display": "44px",
  "text-display-lh": "52px",
  "text-title": "32px",
  "text-title-lh": "40px",
  "text-panel": "36px",
  "text-panel-lh": "46px",
  "text-lead": "14px",
  "text-lead-lh": "22px",
  "text-body": "14px",
  "text-body-lh": "22px",
  "text-label": "13px",
  "text-label-lh": "18px",
  "text-input": "13px",
  "text-caption": "12px",
  "text-caption-lh": "18px",
  "text-micro": "10px",
  "text-micro-lh": "14px",

  "weight-regular": "400",
  "weight-medium": "500",
  "weight-semibold": "600",
  "weight-bold": "700",

  "tracking-eyebrow": "0.14em",
};

/**
 * Geometry: card, field and control metrics measured off the Figma frames.
 */
export const brandGeometry = {
  // The auth surface runs full-bleed: the card fills the viewport rather than
  // floating in it. To restore the boxed Figma frame, set `card-max-width` to
  // 1184px, `card-radius` to 24px and `shell-padding` to 32px 24px.
  "card-max-width": "none",
  "card-min-height": "100vh",
  "card-radius": "0px",
  "shell-padding": "0px",
  "scroll-padding": "20px",

  // 36% lands on the Figma's 520px at a 1440px frame and stays sane either
  // side of it; the clamp keeps the brand copy measure readable.
  "brand-panel-width": "clamp(440px, 36%, 640px)",
  "brand-panel-padding": "clamp(40px, 3.4vw, 64px)",
  "form-panel-padding-x": "clamp(32px, 4vw, 80px)",

  // Vertical rhythm is viewport-relative so a full-height card still fits on
  // short screens (a 1080p laptop at 125% display scaling is ~700 CSS px tall)
  // instead of overflowing the fold. Tall screens get the full Figma spacing.
  "form-panel-padding-y": "clamp(18px, 3.6vh, 56px)",
  "centered-panel-padding-y": "clamp(20px, 3.4vh, 40px)",
  "space-section": "clamp(12px, 2.4vh, 40px)",
  "space-footer": "clamp(12px, 2.2vh, 32px)",
  "form-column-narrow": "480px",
  "form-column-wide": "536px",

  // Signed-in portal shell
  "sidebar-width": "244px",
  "topbar-height": "64px",
  "portal-gutter": "clamp(16px, 2vw, 28px)",
  "panel-gap": "clamp(12px, 1.4vw, 18px)",
  "panel-padding": "clamp(16px, 1.4vw, 20px)",
  "chart-height": "clamp(150px, 20vh, 190px)",
  "chart-bar-width": "46px",

  "radius-sm": "8px",
  "radius-md": "12px",
  "radius-lg": "16px",
  "radius-xl": "22px",
  "radius-pill": "999px",

  "field-height": "40px",
  "field-height-lg": "50px",
  "field-padding-x": "16px",
  "textarea-min-height": "clamp(56px, 8vh, 104px)",
  "dropzone-height": "clamp(92px, 13vh, 136px)",
  "control-height": "48px",
  "control-height-lg": "52px",
  "control-height-sm": "40px",

  "step-width": "129px",
  "step-height": "48px",
  "step-notch": "14px",
  "step-overlap": "6px",

  "grid-gap-x": "24px",
  "grid-gap-y": "clamp(8px, 1.2vh, 14px)",

  "otp-box-width": "64px",
  "otp-box-height": "56px",
  "otp-gap": "19px",
};

export const brandEffects = {
  "shadow-card": "0 24px 64px rgba(10, 10, 10, 0.14)",
  "shadow-control": "0 1px 2px rgba(10, 10, 10, 0.05)",
  "shadow-focus": "0 0 0 3px var(--epc-primary-ring)",
  "shadow-glow": "0 0 40px rgba(197, 6, 26, 0.28)",
  "transition-fast": "160ms cubic-bezier(0.4, 0, 0.2, 1)",
  "transition-base": "240ms cubic-bezier(0.4, 0, 0.2, 1)",
  "transition-panel": "8s ease-in-out infinite alternate",
};

/**
 * Flat token map handed to the provider. Merged in order, later wins.
 */
export const brandTokens = {
  ...brandColors,
  ...brandChart,
  ...brandStepColors,
  ...brandGradient,
  ...brandTypography,
  ...brandGeometry,
  ...brandEffects,
};

const brandConfig = {
  identity: brandIdentity,
  panelCopy: brandPanelCopy,
  tokens: brandTokens,
};

export default brandConfig;
