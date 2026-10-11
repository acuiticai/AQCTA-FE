/**
 * Fetch Configuration branding for email previews (logo, system name, email, website).
 */
import axios from "axios";
import { fetchBrandingLogo, normalizeLogoUrl } from "@/utils/brandingLogo";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

function stripWebsiteDisplay(url) {
  return String(url || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/$/, "");
}

function ensureWebsiteHref(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

const DEFAULT_BRAND_COLOR = "#C5061A";

function normalizeHexColor(value, fallback = DEFAULT_BRAND_COLOR) {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  const withHash = raw.startsWith("#") ? raw : `#${raw}`;
  if (/^#[0-9a-fA-F]{3}$/.test(withHash)) {
    const full = withHash
      .slice(1)
      .split("")
      .map((c) => c + c)
      .join("");
    return `#${full}`.toLowerCase();
  }
  if (/^#[0-9a-fA-F]{6}$/.test(withHash)) {
    return withHash.toLowerCase();
  }
  return fallback;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result || "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function urlToDataUrl(url) {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("data:")) return trimmed;
  try {
    const response = await fetch(trimmed);
    if (!response.ok) return "";
    return blobToDataUrl(await response.blob());
  } catch {
    return "";
  }
}

export async function fetchEmailBranding(axiosConfig = {}) {
  let systemName = "AQCTA";
  let supportEmail = "";
  let website = "";
  let logoUrl = null;
  let brandColor = DEFAULT_BRAND_COLOR;

  try {
    const configRes = await axios.get(`${Base_URL}/configuration`, axiosConfig);
    const configuration = Array.isArray(configRes?.data)
      ? configRes.data[0]
      : configRes?.data;
    if (configuration) {
      systemName = String(configuration.name || "").trim() || systemName;
      supportEmail = String(
        configuration.email || configuration.from_email || "",
      ).trim();
      website = String(configuration.website || "").trim();
      logoUrl = normalizeLogoUrl(configuration.system_logo);
      brandColor = normalizeHexColor(
        configuration.buttons_color || configuration.system_color,
        DEFAULT_BRAND_COLOR,
      );
    }
  } catch (_) {
    // fall through
  }

  if (!logoUrl) {
    logoUrl = await fetchBrandingLogo(axiosConfig);
  }

  const logoSrc = (await urlToDataUrl(logoUrl)) || logoUrl || "";

  return {
    systemName,
    supportEmail,
    website,
    websiteHref: ensureWebsiteHref(website),
    websiteDisplay: stripWebsiteDisplay(website),
    logoSrc,
    logoBase64: logoSrc,
    brandColor,
    tagline: "SMART BUSINESS. SIMPLIFIED.",
  };
}

export function applyEmailBrandingToHtml(html, branding = {}) {
  let out = String(html || "");
  if (!out) return out;

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const systemName = escapeHtml(branding.systemName || "AQCTA");
  const supportEmail = escapeHtml(branding.supportEmail || "");
  const websiteDisplay = escapeHtml(
    branding.websiteDisplay || branding.website || "",
  );
  const websiteHref = escapeHtml(
    branding.websiteHref || ensureWebsiteHref(branding.website || ""),
  );
  const logoSrc = branding.logoSrc || branding.logoBase64 || "";
  const brandColor = normalizeHexColor(
    branding.brandColor,
    DEFAULT_BRAND_COLOR,
  );

  if (logoSrc) {
    out = out.replace(
      /(<img\b[^>]*alt=["'](?:Flexa ERP|PCI|AQCTA|Company Logo)["'][^>]*src=["'])([^"']*)(["'])/gi,
      `$1${logoSrc}$3`,
    );
    out = out.replace(
      /(<img\b[^>]*src=["'])([^"']*)(["'][^>]*alt=["'](?:Flexa ERP|PCI|AQCTA|Company Logo)["'])/gi,
      `$1${logoSrc}$3`,
    );
  }

  if (brandColor && brandColor.toLowerCase() !== DEFAULT_BRAND_COLOR) {
    out = out.replace(/#1a365d/gi, brandColor);
  }

  out = out.replace(
    /flexa\s*<span\s+style="color:\s*#[0-9a-fA-F]{3,8};">\s*ERP\s*<\/span>/gi,
    systemName,
  );
  out = out.replace(/\bflexa\s+ERP\b/gi, systemName);
  out = out.replace(/\bFlexa\s+ERP\b/gi, systemName);
  out = out.replace(/\bFlexa\b/gi, systemName);
  out = out.replace(/\bPCI Group\b/gi, systemName);

  if (supportEmail) {
    out = out.replace(
      /href=["']mailto:info@flexaerp\.com["']/gi,
      `href="mailto:${supportEmail}"`,
    );
    out = out.replace(/>\s*info@flexaerp\.com\s*</gi, `>${supportEmail}<`);
    out = out.replace(/\binfo@flexaerp\.com\b/gi, supportEmail);
  }

  if (websiteHref && websiteDisplay) {
    out = out.replace(
      /href=["']https?:\/\/(?:www\.)?flexaerp\.com\/?["']/gi,
      `href="${websiteHref}"`,
    );
    out = out.replace(/>\s*www\.flexaerp\.com\s*</gi, `>${websiteDisplay}<`);
    out = out.replace(/\bwww\.flexaerp\.com\b/gi, websiteDisplay);
  }

  return out;
}
