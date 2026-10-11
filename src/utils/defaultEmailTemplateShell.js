/** Header/footer shell only — body is injected via emailContent at runtime.
 * Branding placeholders are filled from Configuration at send/preview time.
 */
export const DEFAULT_EMAIL_TEMPLATE_SHELL = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Notification</title>
    <style type="text/css">
        body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
        .email-outer { width: 100%; background-color: #f4f6f8; }
        .email-container {
            width: 100%;
            max-width: 640px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 0;
            overflow: hidden;
        }
        .email-header-cell { padding: 24px 16px; }
        .email-content-cell { padding: 32px 32px 16px; }
        .email-footer-banner { padding: 18px 16px; }
        @media only screen and (max-width: 620px) {
            .email-header-cell { padding: 20px 12px !important; }
            .email-content-cell { padding: 20px 16px !important; }
            .email-footer-banner { padding: 14px 12px !important; }
        }
    </style>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f4f6f8;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" class="email-outer" style="background-color: #f4f6f8;">
        <tr>
            <td align="center" style="padding: 0;">
                <table width="640" border="0" cellspacing="0" cellpadding="0" class="email-container" style="background-color: #ffffff; max-width: 640px; width: 100%; margin: 0 auto;">
                    <tr>
                        <td class="email-header-cell" style="background-color: <%= typeof brandColor !== 'undefined' && brandColor ? brandColor : '#1a365d' %>; padding: 24px 16px; text-align: center;">
                            <table border="0" cellspacing="0" cellpadding="0" align="center" style="background-color: #ffffff; border-radius: 6px;">
                                <tr>
                                    <td style="padding: 10px 20px; text-align: center;">
                                        <img src="<%= typeof logoSrc !== 'undefined' && logoSrc ? logoSrc : (typeof logoBase64 !== 'undefined' ? logoBase64 : '') %>" alt="<%= typeof systemName !== 'undefined' && systemName ? systemName : 'AQCTA' %>" style="max-height: 48px; height: auto; display: block; margin: 0 auto;">
                                    </td>
                                </tr>
                            </table>
                            <p style="color: #8ba1c6; font-size: 11px; letter-spacing: 1.5px; font-weight: bold; margin-top: 12px; margin-bottom: 0;"><%= typeof tagline !== 'undefined' && tagline ? tagline : 'SMART BUSINESS. SIMPLIFIED.' %></p>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: <%= typeof brandColor !== 'undefined' && brandColor ? brandColor : '#1a365d' %>; height: 16px; border-bottom-left-radius: 50% 100%; border-bottom-right-radius: 50% 100%;"></td>
                    </tr>
                    <tr>
                        <td class="email-content-cell" style="padding: 32px 32px 16px; color: #4a5568; font-size: 14px; line-height: 1.6;">
                            <%- typeof emailContent !== 'undefined' ? emailContent : '' %>
                        </td>
                    </tr>
                    <tr>
                        <td class="email-footer-banner" style="background-color: <%= typeof brandColor !== 'undefined' && brandColor ? brandColor : '#1a365d' %>; border-top: 3px solid #C8102E; padding: 18px 16px; text-align: center;">
                            <div style="margin-bottom: 10px;">
                                <div style="color: #a0aec0; font-size: 8px; letter-spacing: 1.2px; margin-bottom: 2px;">POWERED BY</div>
                                <div style="color: #ffffff; font-size: 14px; font-weight: bold; letter-spacing: 1px;">
                                    <%= typeof systemName !== 'undefined' && systemName ? systemName : 'AQCTA' %>
                                </div>
                            </div>
                            <div style="border-top: 1px solid #2c4a7c; width: 80%; margin: 0 auto 10px;"></div>
                            <p style="margin: 0; font-size: 11px;">
                                <% if (typeof supportEmail !== 'undefined' && supportEmail) { %>
                                <a href="mailto:<%= supportEmail %>" style="color: #C8102E; text-decoration: none; font-weight: bold;"><%= supportEmail %></a>
                                <% } %>
                                <% if (typeof supportEmail !== 'undefined' && supportEmail && typeof websiteHref !== 'undefined' && websiteHref) { %>
                                <span style="color: #4a6596; margin: 0 10px;">|</span>
                                <% } %>
                                <% if (typeof websiteHref !== 'undefined' && websiteHref) { %>
                                <a href="<%= websiteHref %>" style="color: #C8102E; text-decoration: none; font-weight: bold;"><%= typeof websiteDisplay !== 'undefined' && websiteDisplay ? websiteDisplay : websiteHref %></a>
                                <% } %>
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;

export function getDefaultEmailTemplateDoc() {
  return {
    name: "Standard Email Template",
    type: "email",
    htmlContent: DEFAULT_EMAIL_TEMPLATE_SHELL,
    dummyData: {},
  };
}
