import { getS3Url } from "@/utils/generic";

const getApiOrigin = () => {
  const apiBase =
    (typeof import.meta !== "undefined" &&
      import.meta.env &&
      import.meta.env.VITE_APP_API_BASE_URL) ||
    "";
  return apiBase.replace(/\/api\/?$/i, "").replace(/\/$/, "");
};

// Resolve tenant/business logo URL from mixed storage formats:
// - full http(s)/data/blob URLs
// - absolute app paths (/uploads/...)
// - plain S3 keys (folder/file.ext)
export const resolveBusinessLogoUrl = (business) => {
  const candidates = [
    business?.image,
    business?.logo,
    business?.businessLogo,
    business?.companyLogo,
    business?.imageUrl,
    business?.image?.url,
    business?.logo?.url,
    business?.logoUrl,
  ];
  const raw = candidates.find(
    (v) => typeof v === "string" && v.trim().length > 0,
  );
  if (!raw) return "";
  const value = raw.trim();
  if (!value) return "";

  if (/^(https?:|data:|blob:)/i.test(value)) return value;

  if (value.startsWith("/")) {
    const origin = getApiOrigin();
    return origin ? `${origin}${value}` : `${window.location.origin}${value}`;
  }

  // If it's likely a direct S3 key, use configured S3 host.
  if (!value.includes(" ")) {
    try {
      return getS3Url(value);
    } catch (_) {
      // fall through
    }
  }

  const origin = getApiOrigin();
  return origin ? `${origin}/${value}` : value;
};

