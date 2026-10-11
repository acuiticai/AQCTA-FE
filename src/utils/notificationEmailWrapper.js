/**
 * Notification Events only — preview wrapper (matches backend notificationEmailWrapper.js).
 * Branding (logo, system name, email, website) comes from Configuration.
 */

import {
  applyEmailBrandingToHtml,
  fetchEmailBranding,
} from "@/utils/emailBranding";

const BODY_SLOT = "<!-- NOTIFICATION_EVENT_BODY -->";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildNotificationEmailShell(branding = {}) {
  const logoSrc = branding.logoSrc || branding.logoBase64 || "";
  const systemName = escapeHtml(branding.systemName || "AQCTA");
  const supportEmail = escapeHtml(branding.supportEmail || "");
  const websiteHref = escapeHtml(branding.websiteHref || "");
  const websiteDisplay = escapeHtml(
    branding.websiteDisplay || branding.website || "",
  );
  const brandColor = escapeHtml(branding.brandColor || "#1a365d");
  const tagline = escapeHtml(
    branding.tagline || "SMART BUSINESS. SIMPLIFIED.",
  );

  const contactBits = [];
  if (supportEmail) {
    contactBits.push(
      `<a href="mailto:${supportEmail}" style="color: #C8102E; text-decoration: none; font-weight: bold;">${supportEmail}</a>`,
    );
  }
  if (websiteHref) {
    contactBits.push(
      `<a href="${websiteHref}" style="color: #C8102E; text-decoration: none; font-weight: bold;">${websiteDisplay || websiteHref}</a>`,
    );
  }
  const contactHtml = contactBits.join(
    '<span style="color: #4a6596; margin: 0 10px;">|</span>',
  );

  const supportLine = supportEmail
    ? `This is an automated notification from ${systemName}. Please do not reply directly to this email. For support, contact us at <a href="mailto:${supportEmail}" style="color: ${brandColor}; text-decoration: none; font-weight: bold;">${supportEmail}</a>.`
    : `This is an automated notification from ${systemName}. Please do not reply directly to this email.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Notification</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f4f6f8;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f4f6f8;">
        <tr>
            <td align="center">
                <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; max-width: 600px; margin: 20px auto; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                    <tr>
                        <td style="background-color: ${brandColor}; padding: 40px 20px; text-align: center;">
                            <table border="0" cellspacing="0" cellpadding="0" align="center" style="background-color: #ffffff; border-radius: 8px;">
                                <tr>
                                    <td style="padding: 15px 30px; text-align: center;">
                                        <img src="${logoSrc}" alt="${systemName}" style="max-height: 60px; height: auto; display: block; margin: 0 auto;">
                                    </td>
                                </tr>
                            </table>
                            <p style="color: #8ba1c6; font-size: 12px; letter-spacing: 2px; font-weight: bold; margin-top: 20px; margin-bottom: 0;">${tagline}</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: ${brandColor}; height: 30px; border-bottom-left-radius: 50% 100%; border-bottom-right-radius: 50% 100%;"></td>
                    </tr>
                    <tr>
                        <td style="padding: 40px 40px 20px; color: #4a5568; font-size: 14px; line-height: 1.6;">
                            ${BODY_SLOT}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 40px 30px;">
                            <div style="border-top: 1px solid #e2e8f0; margin-bottom: 20px;"></div>
                            <p style="color: #a0aec0; font-size: 11px; line-height: 1.5; margin: 0; text-align: left;">
                                ${supportLine}
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: ${brandColor}; border-top: 4px solid #C8102E; padding: 30px 20px; text-align: center;">
                            <div style="margin-bottom: 20px;">
                                <div style="color: #a0aec0; font-size: 9px; letter-spacing: 1.5px; margin-bottom: 4px;">POWERED BY</div>
                                <div style="color: #ffffff; font-size: 16px; font-weight: bold; letter-spacing: 1px;">
                                    ${systemName}
                                </div>
                            </div>
                            <div style="border-top: 1px solid #2c4a7c; width: 80%; margin: 0 auto 20px;"></div>
                            <p style="margin: 0; font-size: 12px;">
                                ${contactHtml}
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}

export async function buildNotificationEmailPreviewHtml(emailBody = "") {
  const branding = await fetchEmailBranding();
  const shell = buildNotificationEmailShell(branding);
  return applyEmailBrandingToHtml(
    shell.replace(BODY_SLOT, emailBody || ""),
    branding,
  );
}
