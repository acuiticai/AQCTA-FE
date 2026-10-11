import React, { useContext, useEffect, useState } from "react";
import { Link, useHistory, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plug } from "lucide-react";
import Header from "@/components/header/Header";
import AppLayout from "@/pages/Settings/app-layout";
import SettingsOrgBanner from "@/pages/Settings/SettingsOrgBanner";
import { AdminContext } from "@/context/AdminContext";
import ClinikoIntegrationCard from "./ClinikoIntegrationCard";

/**
 * Integrations hub — grid of integration cards (Cliniko + links to legacy pages).
 */
const IntegrationsContent = () => {
  const { t } = useTranslation();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const location = useLocation();
  const history = useHistory();
  const [selectedOrg, setSelectedOrg] = useState("");
  const ti = (key, defaultValue, options) =>
    t(`settingsPage.integrations.${key}`, { defaultValue, ...options });

  useEffect(() => {
    if (!adminInfo?.id) return;
    const fromUrl = new URLSearchParams(location.search).get("selectedOrg");
    const sessionId = sessionStorage.getItem("settingsSelectedOrg");
    const id = fromUrl || sessionId || "";
    if (id) {
      setSelectedOrg(id);
      sessionStorage.setItem("settingsSelectedOrg", id);
      const want = `?selectedOrg=${encodeURIComponent(id)}`;
      if (location.search !== want) {
        history.replace({ pathname: location.pathname, search: want });
      }
    }
  }, [adminInfo?.id, location.search, location.pathname, history]);

  const orgQuery = selectedOrg
    ? `?selectedOrg=${encodeURIComponent(selectedOrg)}`
    : "";

  const legacyIntegrations = [
    {
      name: ti("serviceMonsterName", "Service Monster"),
      description: ti(
        "serviceMonsterDesc",
        "Sync customers and jobs from ServiceMonster.",
      ),
      href: `/accounts/service-monster${orgQuery}`,
    },
    {
      name: ti("zohoBooksName", "Zoho Books"),
      description: ti("zohoBooksDesc", "Accounting sync with Zoho Books."),
      href: `/accounts/zoho-books${orgQuery}`,
    },
    {
      name: ti("whatsappName", "WhatsApp"),
      description: ti(
        "whatsappDesc",
        "Send broadcasts via WhatsApp Business API.",
      ),
      href: `/accounts/whatsapp-integration${orgQuery}`,
    },
  ];

  return (
    <div className="p-6 bg-white h-full max-h-[90vh] overflow-y-auto">
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-3">
          <span className="p-2 rounded-lg bg-indigo-100 text-indigo-700">
            <Plug className="w-6 h-6" />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-[#111]">
              {ti("title", "Integrations")}
            </h1>
            <p className="text-sm text-gray-500">
              {ti("subtitle", "Connect third-party services to PCI")}
            </p>
          </div>
        </div>
        <Link
          to={`/Settings${orgQuery}`}
          className="text-sm text-[var(--p-blue)] hover:underline"
        >
          {ti("backToSettings", "← Back to Settings")}
        </Link>
      </div>

      <SettingsOrgBanner />

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <ClinikoIntegrationCard selectedOrg={selectedOrg} />

        {legacyIntegrations.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className="bg-white rounded-lg border border-gray-200 p-6 flex flex-col h-full hover:shadow-md hover:border-gray-300 transition-all no-underline"
          >
            <h3 className="text-base font-semibold text-[#111] mb-2">
              {item.name}
            </h3>
            <p className="text-sm text-gray-600 flex-1">{item.description}</p>
            <span className="mt-4 text-sm font-medium text-[var(--p-blue)]">
              {ti("openSettings", "Open settings →")}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
};

const IntegrationsPage = () => (
  <AppLayout>
    <Header />
    <IntegrationsContent />
  </AppLayout>
);

export default IntegrationsPage;
