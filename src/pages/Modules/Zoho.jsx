import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

/**
 * Modules → Integrations stub: redirect users to centralized Settings UX.
 */
const ZohoModulesTab = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const bid = location.state?.business_id || "";

  return (
    <div className="sm:container mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg">
      <h2 className="text-xl font-semibold mb-4">{t("zohoIntegration")}</h2>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
        Manage Zoho Books OAuth, organizations, and sync from Settings → Integrations → Zoho Books.
      </p>
      <Link
        to={`/accounts/zoho-books?selectedOrg=${encodeURIComponent(String(bid))}`}
        className="inline-flex items-center px-4 py-2 rounded-lg bg-[var(--p-blue)] text-white text-sm font-medium"
      >
        Open Zoho Books settings
      </Link>
    </div>
  );
};

export default ZohoModulesTab;
