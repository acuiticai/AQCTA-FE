import { useState, useEffect, useContext } from "react";
import { useTranslation } from "react-i18next";
import Header from "@/components/header/Header";
import AppLayout from "../app-layout";
import { useLocation } from "react-router-dom";
import { AdminContext } from "@/context/AdminContext";
import SettingsOrgBanner from "../SettingsOrgBanner";
import WorkPassTypeSettings from "./WorkPassTypeSettings";
import FWAlertSettings from "./FWAlertSettings";

const TAB_WORK_PASS = "Work Pass Types";
const TAB_FW_ALERTS = "FW Alerts";

const ForeignWorkerManagement = () => {
  const { t } = useTranslation();
  const thr = (key, fallback, options) =>
    t(`settingsPage.hr.${key}`, { defaultValue: fallback, ...options });

  const [activeTab, setActiveTab] = useState(TAB_WORK_PASS);
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const [organization, setOrganization] = useState(null);
  const [isOrgLoaded, setIsOrgLoaded] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const selectedOrg = searchParams.get("selectedOrg");

    if (selectedOrg) {
      setOrganization(selectedOrg);
    }

    setIsOrgLoaded(true);
  }, [location]);

  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo.token}`,
  };

  const tabs = [
    {
      id: TAB_WORK_PASS,
      label: thr("foreignWorker.workPassTypes", "Work Pass Types"),
    },
    {
      id: TAB_FW_ALERTS,
      label: thr("foreignWorker.fwAlerts", "FW Alerts"),
    },
  ];

  return (
    <AppLayout>
      <Header />
      <div className="p-6 bg-white h-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-xl font-semibold text-gray-900">
            {thr("foreignWorker.pageTitle", "Foreign Worker Management")}
          </h1>
        </div>
        <SettingsOrgBanner />

        <div className="border-b border-gray-200 mb-6 mt-6">
          <nav className="flex -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`mr-8 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? "border-[var(--p-blue)] text-[var(--p-blue)]"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {!isOrgLoaded && !organization ? (
          <div className="fixed inset-0 flex items-center justify-center bg-white">
            <p className="text-gray-600">
              {thr("loadingOrganization", "Loading organization...")}
            </p>
          </div>
        ) : activeTab === TAB_WORK_PASS ? (
          <WorkPassTypeSettings organization={organization} headers={headers} />
        ) : activeTab === TAB_FW_ALERTS ? (
          <FWAlertSettings organization={organization} headers={headers} />
        ) : null}
      </div>
    </AppLayout>
  );
};

export default ForeignWorkerManagement;
