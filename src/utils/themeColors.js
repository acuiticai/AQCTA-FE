/**
 * Theme color helpers — maps Configurations "Theme Colors" onto global CSS vars
 * so `bg-p-blue`, `var(--p-blue)`, sidebar active, header accents, etc. all follow theme.
 */

function parseHex(hex) {
  if (!hex || typeof hex !== "string") return null;
  const raw = hex.trim().replace("#", "");
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(raw)) return null;
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function toHex({ r, g, b }) {
  return (
    "#" +
    [r, g, b]
      .map((x) =>
        Math.max(0, Math.min(255, Math.round(x)))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

function mix(rgb, target, amount) {
  return {
    r: rgb.r + (target.r - rgb.r) * amount,
    g: rgb.g + (target.g - rgb.g) * amount,
    b: rgb.b + (target.b - rgb.b) * amount,
  };
}

export function darkenHex(hex, amount = 0.22) {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  return toHex(mix(rgb, { r: 0, g: 0, b: 0 }, amount));
}

export function lightenHex(hex, amount = 0.35) {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  return toHex(mix(rgb, { r: 255, g: 255, b: 255 }, amount));
}

export function hexToRgbCss(hex) {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  return `${rgb.r}, ${rgb.g}, ${rgb.b}`;
}

function relativeLuminance(hex) {
  const rgb = parseHex(hex);
  if (!rgb) return 1;
  const channel = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel(rgb.r) +
    0.7152 * channel(rgb.g) +
    0.0722 * channel(rgb.b)
  );
}

function isDarkSurface(hex) {
  return relativeLuminance(hex) < 0.45;
}


/**
 * Apply theme colors from configuration onto :root.
 * buttons_color drives primary UI accent (--p-blue and related).
 */
export function applyThemeColorVars({
  buttons_color,
  topbar_color,
  leftbar_color,
  buttons_text_color,
} = {}) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  if (buttons_color) {
    const dark = darkenHex(buttons_color, 0.22);
    const darker = darkenHex(buttons_color, 0.4);
    const light = lightenHex(buttons_color, 0.35);
    const light2 = lightenHex(buttons_color, 0.55);
    const soft = lightenHex(buttons_color, 0.85);
    const rgb = hexToRgbCss(buttons_color);

    root.style.setProperty("--buttons-color", buttons_color);
    root.style.setProperty("--p-blue", buttons_color);
    root.style.setProperty("--p-blue-dark", dark);
    root.style.setProperty("--p-blue-dark2", darker);
    root.style.setProperty("--p-blue-light", light);
    root.style.setProperty("--p-blue-light-2", light2);
    if (rgb) root.style.setProperty("--p-blue-rgb", rgb);

    // Tailwind / UI blue scale commonly used for primary actions
    root.style.setProperty("--blue-50", soft);
    root.style.setProperty("--blue-100", lightenHex(buttons_color, 0.75));
    root.style.setProperty("--blue-200", lightenHex(buttons_color, 0.6));
    root.style.setProperty("--blue-300", lightenHex(buttons_color, 0.4));
    root.style.setProperty("--blue-400", lightenHex(buttons_color, 0.2));
    root.style.setProperty("--blue-500", lightenHex(buttons_color, 0.08));
    root.style.setProperty("--blue-600", buttons_color);
    root.style.setProperty("--blue-700", dark);
    root.style.setProperty("--blue-800", darker);
    root.style.setProperty("--blue-900", darkenHex(buttons_color, 0.55));

    // Sidebar accents follow primary — tone depends on chrome (dark vs light).
    const sidebarSurface =
      leftbar_color ||
      root.style.getPropertyValue("--sidebar-bg") ||
      getComputedStyle(root).getPropertyValue("--sidebar-bg").trim() ||
      "#0a0a0a";
    if (isDarkSurface(sidebarSurface)) {
      root.style.setProperty("--sidebar-hover", "#FE0032");
      root.style.setProperty("--sidebar-active", "#FE0032");
      root.style.setProperty("--sidebar-active-bg", "rgba(197, 6, 26, 0.22)");
    } else {
      root.style.setProperty("--sidebar-hover", buttons_color);
      root.style.setProperty("--sidebar-active", buttons_color);
      root.style.setProperty("--sidebar-active-bg", soft);
    }

    // Header accent (icons / focus) follow primary
    root.style.setProperty("--header-text-hover", buttons_color);
    root.style.setProperty("--header-icon-hover", buttons_color);
    root.style.setProperty("--header-focus-ring", buttons_color);
    root.style.setProperty(
      "--header-hover-bg",
      lightenHex(buttons_color, 0.9),
    );
  }

  if (topbar_color) {
    // Legacy solid-white topbars → flat warm portal canvas
    const nearWhite =
      String(topbar_color).trim().toLowerCase() === "#ffffff" ||
      String(topbar_color).trim().toLowerCase() === "#fff" ||
      String(topbar_color).trim().toLowerCase() === "white" ||
      relativeLuminance(topbar_color) > 0.92;
    const effectiveTopbar = nearWhite ? "#F5F2F3" : topbar_color;
    root.style.setProperty("--topbar-color", effectiveTopbar);
    root.style.setProperty("--header-bg", effectiveTopbar);
  }

  if (leftbar_color) {
    // Legacy white leftbars → customer-portal black chrome (AQCTA product look).
    const nearWhite =
      String(leftbar_color).trim().toLowerCase() === "#ffffff" ||
      String(leftbar_color).trim().toLowerCase() === "#fff" ||
      String(leftbar_color).trim().toLowerCase() === "white" ||
      relativeLuminance(leftbar_color) > 0.92;
    const effectiveLeftbar = nearWhite ? "#0A0A0A" : leftbar_color;

    root.style.setProperty("--leftbar-color", effectiveLeftbar);
    root.style.setProperty("--sidebar-bg", effectiveLeftbar);

    const accent =
      root.style.getPropertyValue("--sidebar-active") ||
      getComputedStyle(root).getPropertyValue("--sidebar-active").trim() ||
      "#c5061a";

    // Dark chrome matches customer portal; light chrome keeps solid dark labels.
    if (isDarkSurface(effectiveLeftbar)) {
      root.style.setProperty("--sidebar-border", "rgba(255, 255, 255, 0.08)");
      root.style.setProperty("--sidebar-hover-bg", "rgba(255, 255, 255, 0.06)");
      root.style.setProperty("--sidebar-text", "rgba(245, 245, 245, 0.68)");
      root.style.setProperty("--sidebar-text-hover", "#F5F5F5");
      root.style.setProperty("--sidebar-active-bg", "rgba(197, 6, 26, 0.22)");
      root.style.setProperty("--sidebar-active", "#FE0032");
      root.style.setProperty("--sidebar-hover", "#FE0032");
    } else {
      root.style.setProperty("--sidebar-border", "#E0D6D8");
      root.style.setProperty("--sidebar-hover-bg", "#F5F2F3");
      root.style.setProperty("--sidebar-text", "#1A1A1A");
      root.style.setProperty("--sidebar-text-hover", accent);
      root.style.setProperty("--sidebar-active-bg", lightenHex(accent, 0.85));
      root.style.setProperty("--sidebar-active", accent);
      root.style.setProperty("--sidebar-hover", accent);
    }
  }

  if (buttons_text_color) {
    root.style.setProperty("--buttons-text-color", buttons_text_color);
  }
}
