import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Database } from "lucide-react";

import Header from "@/components/header/Header";
import AppLayout from "@/pages/Settings/app-layout";
import SettingsOrgBanner from "@/pages/Settings/SettingsOrgBanner";
import { ZohoBooksIntegrationPanel } from "./ZohoBooksIntegrationPanel";

/** Settings shell route: `/accounts/zoho-books` */
const ZohoBooksSettingsPage = () => {
  const { t } = useTranslation();
  const location = useLocation();

  return (
    <AppLayout>
      <Header />
      <div className="p-6 min-h-screen bg-gray-50 max-h-[90vh] overflow-y-auto">
        <div className="w-full space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                {t("accountsSettings.zohoBooks.pageTitle", "Zoho Books Integration")}
              </h1>
              <p className="text-sm text-gray-600 mt-2">
                {t(
                  "accountsSettings.zohoBooks.pageSubtitle",
                  "Connect your Zoho Books account to import customers, items, and invoices into PCI.",
                )}
              </p>
            </div>
            <Link
              to={`/Settings${location.search || ""}`}
              className="inline-flex items-center gap-1.5 text-sm text-[var(--p-blue)] font-medium hover:underline shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              {t("accountsSettings.zohoBooks.backToSettings", "Back to Settings")}
            </Link>
          </div>

          <SettingsOrgBanner />

          <ZohoBooksIntegrationPanel />

          <p className="text-xs text-gray-500 flex items-center gap-1.5 pb-4">
            <Database className="w-3.5 h-3.5" />
            {t(
              "accountsSettings.zohoBooks.footerNote",
              "Tokens are stored per business on the server. Redirect URI must match Zoho API Console exactly.",
            )}
          </p>
        </div>
      </div>
    </AppLayout>
  );
};

export default ZohoBooksSettingsPage;
