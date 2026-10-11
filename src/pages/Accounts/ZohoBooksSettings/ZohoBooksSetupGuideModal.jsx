import React, { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy, ExternalLink } from "lucide-react";
import { CustomModal } from "@/page-layouts";
import { getPublicAppUrl } from "@/utils/publicAppUrl";

function getRegionBaseUrls(t) {
  return [
    {
      key: "baseUrlUS",
      label: t("accountsSettings.zohoBooks.guideRegionUS", "US / Default"),
      value: "https://www.zohoapis.com/books/v3",
    },
    {
      key: "baseUrlEU",
      label: t("accountsSettings.zohoBooks.guideRegionEU", "EU"),
      value: "https://www.zohoapis.eu/books/v3",
    },
    {
      key: "baseUrlIN",
      label: t("accountsSettings.zohoBooks.guideRegionIN", "India"),
      value: "https://www.zohoapis.in/books/v3",
    },
    {
      key: "baseUrlAU",
      label: t("accountsSettings.zohoBooks.guideRegionAU", "Australia"),
      value: "https://www.zohoapis.com.au/books/v3",
    },
  ];
}

function CopyRow({ label, value, fieldKey, copiedField, onCopy, hint, copyTitle }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-700 mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <input
          type="text"
          readOnly
          value={value}
          className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg bg-white text-xs font-mono text-gray-900"
        />
        <button
          type="button"
          onClick={() => onCopy(value, fieldKey)}
          className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shrink-0"
          title={copyTitle}
        >
          {copiedField === fieldKey ? (
            <Check size={16} className="text-green-600" />
          ) : (
            <Copy size={16} className="text-gray-600" />
          )}
        </button>
      </div>
      {hint ? <p className="text-xs text-amber-700 mt-1">{hint}</p> : null}
    </div>
  );
}

function StepBlock({ borderColor, title, badge, children }) {
  return (
    <div className={`border-l-4 ${borderColor} pl-4 py-2`}>
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        {badge ? (
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">{badge}</span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

/**
 * InvoisPls-style Zoho API setup walkthrough for PCI Books integration.
 */
export function ZohoBooksSetupGuideModal({ open, onClose, oauthCallbackUrl, homepageUrl }) {
  const { t } = useTranslation();
  const [copiedField, setCopiedField] = useState(null);

  const regionBaseUrls = useMemo(() => getRegionBaseUrls(t), [t]);
  const copyTitle = t("accountsSettings.zohoBooks.guideCopyTooltip", "Copy");

  const handleCopy = useCallback(async (text, field) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      setCopiedField(null);
    }
  }, []);

  const redirectUri = oauthCallbackUrl || "";
  const home = homepageUrl || getPublicAppUrl();

  return (
    <CustomModal
      open={open}
      onClose={onClose}
      title={t(
        "accountsSettings.zohoBooks.guideTitle",
        "Zoho API Setup Guide — Get Your Credentials",
      )}
      width="92vw"
      style={{ maxWidth: "1100px" }}
      showActions
      actions={[
        {
          label: t("accountsSettings.zohoBooks.guideClose", "Close"),
          secondary: true,
          onClick: onClose,
        },
      ]}
      contentStyles={{ maxHeight: "calc(90vh - 180px)" }}
    >
      <div className="space-y-4 pr-1">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900 font-medium mb-1">
            {t(
              "accountsSettings.zohoBooks.guideIntro",
              "Follow these steps to connect Zoho Books with PCI",
            )}
          </p>
          <p className="text-xs text-blue-700">
            {t(
              "accountsSettings.zohoBooks.guideIntroSub",
              "You will need: Client ID, Client Secret, Organization ID, Redirect URL, and Base URL (by region).",
            )}
          </p>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <p className="text-xs text-gray-700 mb-2">
            <strong>
              {t(
                "accountsSettings.zohoBooks.guideNoAccountQuestion",
                "Don't have a Zoho Books account?",
              )}
            </strong>
          </p>
          <button
            type="button"
            onClick={() => window.open("https://www.zoho.com/books/signup.html", "_blank")}
            className="inline-flex items-center gap-1.5 w-full justify-center px-3 py-2 text-xs font-medium border border-gray-300 rounded-lg bg-white hover:bg-gray-50"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            {t("accountsSettings.zohoBooks.guideCreateAccountBtn", "Create Zoho Books Account")}
          </button>
          <p className="text-xs text-gray-500 mt-2">
            {t(
              "accountsSettings.zohoBooks.guideAfterSignupHint",
              "After signup, get your Organization ID and create API credentials in Zoho API Console.",
            )}
          </p>
        </div>

        <StepBlock
          borderColor="border-blue-500"
          title={t("accountsSettings.zohoBooks.guideStep1Title", "Step 1: Access Zoho API Console")}
          badge={t("accountsSettings.zohoBooks.guideStep1Badge", "Open in Browser")}
        >
          <p className="text-xs text-gray-600 mb-2">
            {t(
              "accountsSettings.zohoBooks.guideStep1Desc",
              "Create a Server-based Application in the console:",
            )}
          </p>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 mb-2 font-mono text-xs text-gray-800">
            https://api-console.zoho.com/
          </div>
          <button
            type="button"
            onClick={() => window.open("https://api-console.zoho.com/", "_blank")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 rounded-lg bg-white hover:bg-gray-50"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            {t("accountsSettings.zohoBooks.guideStep1Btn", "Open Zoho API Console")}
          </button>
        </StepBlock>

        <StepBlock
          borderColor="border-green-500"
          title={t("accountsSettings.zohoBooks.guideStep2Title", "Step 2: Sign in to Zoho")}
        >
          <ol className="text-xs text-gray-700 space-y-1 list-decimal list-inside">
            <li>{t("accountsSettings.zohoBooks.guideStep2Item1", "Sign in with your Zoho account")}</li>
            <li>
              {t(
                "accountsSettings.zohoBooks.guideStep2Item2",
                "If you have multiple Zoho accounts, pick the one that owns your Books organization",
              )}
            </li>
            <li>
              {t(
                "accountsSettings.zohoBooks.guideStep2Item3",
                "Confirm you can open Zoho Books in the browser before continuing",
              )}
            </li>
          </ol>
        </StepBlock>

        <StepBlock
          borderColor="border-purple-500"
          title={t("accountsSettings.zohoBooks.guideStep3Title", "Step 3: Create a new application")}
        >
          <ol className="text-xs text-gray-700 space-y-1 list-decimal list-inside mb-2">
            <li>
              {t("accountsSettings.zohoBooks.guideStep3ClickWord", "Click")}{" "}
              <strong>{t("accountsSettings.zohoBooks.guideStep3AddClient", "Add Client")}</strong>{" "}
              {t("accountsSettings.zohoBooks.guideStep3Or", "or")}{" "}
              <strong>{t("accountsSettings.zohoBooks.guideStep3CreateClient", "Create Client")}</strong>
            </li>
            <li>
              {t("accountsSettings.zohoBooks.guideStep3Choose", "Choose")}{" "}
              <strong>
                {t("accountsSettings.zohoBooks.guideStep3ServerBasedApps", "Server-based Applications")}
              </strong>
            </li>
            <li>
              {t("accountsSettings.zohoBooks.guideStep3FillIn", "Fill in:")}
              <ul className="list-disc list-inside ml-4 mt-1 space-y-0.5">
                <li>
                  <strong>{t("accountsSettings.zohoBooks.guideStep3ClientNameLabel", "Client Name:")}</strong>{" "}
                  {t("accountsSettings.zohoBooks.guideStep3ClientNameValue", "e.g. PCI Integration")}
                </li>
                <li>
                  <strong>{t("accountsSettings.zohoBooks.guideStep3HomepageLabel", "Homepage URL:")}</strong>{" "}
                  {t("accountsSettings.zohoBooks.guideStep3HomepageValue", "copy below")}
                </li>
                <li>
                  <strong>
                    {t(
                      "accountsSettings.zohoBooks.guideStep3RedirectLabel",
                      "Authorized Redirect URIs:",
                    )}
                  </strong>{" "}
                  {t(
                    "accountsSettings.zohoBooks.guideStep3RedirectValue",
                    "copy below (must match exactly)",
                  )}
                </li>
              </ul>
            </li>
          </ol>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-3">
            <CopyRow
              label={t("accountsSettings.zohoBooks.guideHomepageCopyLabel", "Homepage URL (copy this)")}
              value={home}
              fieldKey="homepageUrl"
              copiedField={copiedField}
              onCopy={handleCopy}
              copyTitle={copyTitle}
            />
            <CopyRow
              label={t(
                "accountsSettings.zohoBooks.guideRedirectCopyLabel",
                "Authorized Redirect URIs (copy this — very important)",
              )}
              value={redirectUri}
              fieldKey="redirectUri"
              copiedField={copiedField}
              onCopy={handleCopy}
              copyTitle={copyTitle}
              hint={t(
                "accountsSettings.zohoBooks.guideRedirectCopyHint",
                "⚠️ This must match exactly the Redirect URL field on the PCI Zoho Books settings page.",
              )}
            />
          </div>
        </StepBlock>

        <StepBlock
          borderColor="border-orange-500"
          title={t(
            "accountsSettings.zohoBooks.guideStep4Title",
            "Step 4: Get Client ID and Client Secret",
          )}
        >
          <p className="text-xs text-gray-600 mb-2">
            {t("accountsSettings.zohoBooks.guideStep4Desc", "After creating the app, copy from the console:")}
          </p>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2 text-xs text-gray-600">
            <p>
              <strong className="text-gray-800">
                {t("accountsSettings.zohoBooks.guideStep4ClientId", "Client ID")}
              </strong>{" "}
              {t("accountsSettings.zohoBooks.guideStep4ClientIdDesc", "— visible on the app details page")}
            </p>
            <p>
              <strong className="text-gray-800">
                {t("accountsSettings.zohoBooks.guideStep4ClientSecret", "Client Secret")}
              </strong>{" "}
              {t(
                "accountsSettings.zohoBooks.guideStep4ClientSecretDesc",
                "— click Generate if hidden, then copy immediately (shown once)",
              )}
            </p>
          </div>
        </StepBlock>

        <StepBlock
          borderColor="border-red-500"
          title={t("accountsSettings.zohoBooks.guideStep5Title", "Step 5: Get Organization ID")}
        >
          <ol className="text-xs text-gray-700 space-y-1 list-decimal list-inside">
            <li>
              {t("accountsSettings.zohoBooks.guideStep5OpenPrefix", "Open")}{" "}
              <a
                href="https://books.zoho.com"
                target="_blank"
                rel="noreferrer"
                className="text-[var(--p-blue)] underline"
              >
                {t("accountsSettings.zohoBooks.guideStep5ZohoBooksLink", "Zoho Books")}
              </a>
            </li>
            <li>{t("accountsSettings.zohoBooks.guideStep5Item2", "Go to Settings → Organization")}</li>
            <li>
              {t(
                "accountsSettings.zohoBooks.guideStep5Item3",
                "Copy the Organization ID from organization details (or from the settings URL)",
              )}
            </li>
          </ol>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mt-2 text-xs text-blue-800">
            {t(
              "accountsSettings.zohoBooks.guideStep5Tip",
              "Tip: Organization ID must belong to the same Zoho account you used in the API Console.",
            )}
          </div>
        </StepBlock>

        <StepBlock
          borderColor="border-indigo-500"
          title={t("accountsSettings.zohoBooks.guideStep6Title", "Step 6: Choose Base URL (region)")}
        >
          <p className="text-xs text-gray-600 mb-2">
            {t(
              "accountsSettings.zohoBooks.guideStep6Desc",
              "Pick the Books API host for your Zoho data center:",
            )}
          </p>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-3">
            {regionBaseUrls.map((r) => (
              <CopyRow
                key={r.key}
                label={r.label}
                value={r.value}
                fieldKey={r.key}
                copiedField={copiedField}
                onCopy={handleCopy}
                copyTitle={copyTitle}
              />
            ))}
          </div>
          <p className="text-xs text-gray-600 mt-2">
            {t(
              "accountsSettings.zohoBooks.guideStep6Note",
              "Most accounts use US/Default unless you signed up on EU, India, or Australia portals.",
            )}
          </p>
        </StepBlock>

        <StepBlock
          borderColor="border-teal-500"
          title={t("accountsSettings.zohoBooks.guideStep7Title", "Step 7: Fill the form in PCI and connect")}
        >
          <ol className="text-xs text-gray-700 space-y-1 list-decimal list-inside">
            <li>
              {t(
                "accountsSettings.zohoBooks.guideStep7Item1",
                "Paste Organization ID, Client ID, and Client Secret",
              )}
            </li>
            <li>{t("accountsSettings.zohoBooks.guideStep7Item2", "Paste Redirect URL (same as Step 3)")}</li>
            <li>{t("accountsSettings.zohoBooks.guideStep7Item3", "Paste Base URL from Step 6")}</li>
            <li>
              {t("accountsSettings.zohoBooks.guideStep7ClickWord", "Click")}{" "}
              <strong>{t("accountsSettings.zohoBooks.guideStep7SaveWord", "Save")}</strong>
              {", "}
              {t("accountsSettings.zohoBooks.guideStep7ThenWord", "then")}{" "}
              <strong>
                {t("accountsSettings.zohoBooks.guideStep7ConnectWord", "Connect to Zoho Books")}
              </strong>
            </li>
            <li>
              {t(
                "accountsSettings.zohoBooks.guideStep7Item5",
                "After OAuth, select your Books organization and click Save organization",
              )}
            </li>
          </ol>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mt-2 text-xs text-blue-800">
            <strong>{t("accountsSettings.zohoBooks.guideStep7ScopeLabel", "Scope:")}</strong>{" "}
            {t("accountsSettings.zohoBooks.guideStep7ScopeUseWord", "use")}{" "}
            <code className="bg-white/80 px-1 rounded">ZohoBooks.fullaccess.all</code>{" "}
            {t(
              "accountsSettings.zohoBooks.guideStep7ScopeSuffix",
              "in the API Console unless your admin requires narrower scopes.",
            )}
          </div>
        </StepBlock>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <p className="text-xs font-semibold text-gray-800 mb-1">
            {t("accountsSettings.zohoBooks.guideTroubleshootTitle", "Need help troubleshooting?")}
          </p>
          <ul className="text-xs text-gray-600 list-disc list-inside space-y-1">
            <li>
              {t(
                "accountsSettings.zohoBooks.guideTroubleshootItem1",
                "Redirect URI in Zoho must match PCI character-for-character (https, host, port, path)",
              )}
            </li>
            <li>
              {t("accountsSettings.zohoBooks.guideTroubleshootItem2", "Client ID is not your Zoho login email")}
            </li>
            <li>
              {t(
                "accountsSettings.zohoBooks.guideTroubleshootItem3",
                "Base URL region must match where your Books organization was created",
              )}
            </li>
            {redirectUri ? (
              <li>
                {t(
                  "accountsSettings.zohoBooks.guideTroubleshootItem4Prefix",
                  "Register this exact Authorized Redirect URI in the Zoho API Console:",
                )}{" "}
                <code className="bg-gray-100 px-1 rounded break-all">{redirectUri}</code>
              </li>
            ) : null}
          </ul>
        </div>
      </div>
    </CustomModal>
  );
}
