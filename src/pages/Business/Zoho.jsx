import React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

/**
 * Legacy Business → Zoho tab stub.
 * Full Books OAuth + sync UX lives under Settings → Integrations → Zoho Books.
 */
const ZohoTab = ({ businessId }) => {
  const { t } = useTranslation();

  return (
    <div className="sm:container mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg">
      <h2 className="text-xl font-semibold mb-4">{t("business.zohoIntegration")}</h2>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
        Zoho Books integration is configured from the global Settings Integrations page (same flow as
        ServiceMonster).
      </p>
      <Link
        to={`/accounts/zoho-books?selectedOrg=${businessId || ""}`}
        className="inline-flex items-center px-4 py-2 rounded-lg bg-[var(--p-blue)] text-white text-sm font-medium hover:opacity-90"
      >
        Open Zoho Books settings
      </Link>
    </div>
  );
};

export default ZohoTab;
