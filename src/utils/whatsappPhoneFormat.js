/** Supported WhatsApp phone regions for broadcast recipients. */
export const PHONE_REGIONS = {
  MY: {
    code: "MY",
    dialCode: "+60",
    label: "Malaysia (+60)",
    placeholder: "12 345 6789",
    maxNationalLength: 10,
  },
  PK: {
    code: "PK",
    dialCode: "+92",
    label: "Pakistan (+92)",
    placeholder: "300 1234567",
    maxNationalLength: 10,
  },
};

/** Default from VITE_BROADCAST_PHONE_REGION (MY | PK). Falls back to Malaysia. */
export function getDefaultPhoneRegion() {
  const env = String(import.meta.env.VITE_BROADCAST_PHONE_REGION || "MY")
    .trim()
    .toUpperCase();
  return PHONE_REGIONS[env] ? env : "MY";
}

/**
 * Strip input to national digits (no country code, no leading 0).
 */
export function parseNationalDigits(value, region = "MY") {
  let digits = String(value ?? "").replace(/\D/g, "");
  if (region === "MY") {
    if (digits.startsWith("60")) digits = digits.slice(2);
  } else if (region === "PK") {
    if (digits.startsWith("92")) digits = digits.slice(2);
  }
  if (digits.startsWith("0")) digits = digits.slice(1);
  const max = PHONE_REGIONS[region]?.maxNationalLength ?? 10;
  return digits.slice(0, max);
}

/** Format national digits for display (without dial code). */
export function formatNationalDisplay(national, region = "MY") {
  const n = national || "";
  if (!n) return "";

  if (region === "MY") {
    if (n.length <= 2) return n;
    if (n.length <= 5) return `${n.slice(0, 2)} ${n.slice(2)}`;
    if (n.length <= 9) return `${n.slice(0, 2)} ${n.slice(2, 5)} ${n.slice(5)}`;
    return `${n.slice(0, 2)} ${n.slice(2, 5)} ${n.slice(5, 9)} ${n.slice(9)}`.trim();
  }

  if (region === "PK") {
    if (n.length <= 3) return n;
    return `${n.slice(0, 3)} ${n.slice(3)}`;
  }

  return n;
}

/** Full display value: dial code + spaced national number. */
export function formatWhatsappDisplay(value, region = "MY") {
  const national = parseNationalDigits(value, region);
  if (!national) return "";
  const dial = PHONE_REGIONS[region]?.dialCode || "+60";
  const spaced = formatNationalDisplay(national, region);
  return `${dial} ${spaced}`.trim();
}

/** E.164-style value for API / WhatsApp sender (+60… / +92…, no spaces). */
export function toWhatsappE164(value, region = "MY") {
  const national = parseNationalDigits(value, region);
  if (!national) return "";
  const dialDigits = region === "PK" ? "92" : "60";
  return `+${dialDigits}${national}`;
}

/** Guess MY vs PK from stored number (+60 / +92 or leading digits). */
export function inferPhoneRegionFromValue(value) {
  const compact = String(value ?? "").replace(/\s/g, "");
  if (/^\+?92/.test(compact)) return "PK";
  if (/^\+?60/.test(compact)) return "MY";
  return null;
}

/** Per-recipient region (saved on row, inferred from number, or default). */
export function getRecipientPhoneRegion(recipient, fallback) {
  const code = recipient?.phoneRegion;
  if (code && PHONE_REGIONS[code]) return code;
  const inferred = inferPhoneRegionFromValue(recipient?.whatsappNumber);
  if (inferred) return inferred;
  return fallback && PHONE_REGIONS[fallback] ? fallback : getDefaultPhoneRegion();
}

export function formatRecipientWhatsapp(recipient, fallbackRegion) {
  if (!recipient) return recipient;
  const region = getRecipientPhoneRegion(recipient, fallbackRegion);
  const raw = recipient?.whatsappNumber?.trim();
  if (!raw) {
    return { ...recipient, phoneRegion: region };
  }
  return {
    ...recipient,
    phoneRegion: region,
    whatsappNumber: formatWhatsappDisplay(raw, region),
  };
}

export function formatRecipientsWhatsapp(recipients, fallbackRegion) {
  if (!Array.isArray(recipients)) return recipients;
  return recipients.map((r) => formatRecipientWhatsapp(r, fallbackRegion));
}

export function recipientToWhatsappE164(recipient, fallbackRegion) {
  const raw = recipient?.whatsappNumber?.trim();
  if (!raw) return "";
  return toWhatsappE164(raw, getRecipientPhoneRegion(recipient, fallbackRegion));
}
