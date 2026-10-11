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

    // Sidebar accents follow primary (soft fill reads on white chrome)
    root.style.setProperty("--sidebar-hover", buttons_color);
    root.style.setProperty("--sidebar-active", buttons_color);
    root.style.setProperty("--sidebar-active-bg", soft);

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
    root.style.setProperty("--topbar-color", topbar_color);
    root.style.setProperty("--header-bg", topbar_color);
  }

  if (leftbar_color) {
    root.style.setProperty("--leftbar-color", leftbar_color);
    root.style.setProperty("--sidebar-bg", leftbar_color);

    const accent =
      root.style.getPropertyValue("--sidebar-active") ||
      getComputedStyle(root).getPropertyValue("--sidebar-active").trim() ||
      "#c5061a";

    // White / light sidebars need solid dark labels (never translucent light text).
    if (isDarkSurface(leftbar_color)) {
      root.style.setProperty("--sidebar-text", "#E8F0FA");
      root.style.setProperty("--sidebar-text-hover", "#ffffff");
      root.style.setProperty("--sidebar-active-bg", "rgba(8, 160, 248, 0.22)");
      root.style.setProperty("--sidebar-active", accent);
    } else {
      root.style.setProperty("--sidebar-text", "#1A2740");
      root.style.setProperty("--sidebar-text-hover", "#C5061A");
      root.style.setProperty("--sidebar-active-bg", lightenHex(accent, 0.85));
      root.style.setProperty("--sidebar-active", accent);
    }
  }

  if (buttons_text_color) {
    root.style.setProperty("--buttons-text-color", buttons_text_color);
  }
}
