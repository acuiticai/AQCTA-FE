import React, { Fragment, useState } from "react";
import { useTranslation } from "react-i18next";
import Configurations from "./Configurations";
import TabEmailConfig from "./TabEmailConfig";
import TabPrivacyPolicy from "./TabPrivacyPolicy";
import TabSupportInfo from "./TabSupportInfo";
import {
  FiSettings,
  FiMail,
  FiShield,
  FiHelpCircle,
} from "react-icons/fi";

const ConfigTab = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("1");

  const tabClass = (id) =>
    `no-background flex items-center gap-2 px-4 py-2.5 text-sm font-medium border transition-all ${
      activeTab === id
        ? "border-0 border-b-2 border-[var(--p-blue)] text-gray-900 rounded-none"
        : "border-0 border-b-2 border-transparent text-gray-600 hover:text-gray-900 rounded-none"
    }`;

  return (
    <Fragment>
      <div className="bg-gray-50 min-h-screen w-full max-w-full overflow-x-hidden">
        <div className="w-full max-w-full mx-auto px-6 py-8 min-w-0 overflow-x-hidden">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">
              {t("configTab.globalSettings")}
            </h1>
            <p className="text-gray-600 mt-2">
              {t("configTab.manageSystemSettings")}
            </p>
          </div>

          <div className="mb-6 flex flex-wrap gap-1 border-b border-gray-200">
            <button
              type="button"
              onClick={() => setActiveTab("1")}
              className={tabClass("1")}
              aria-selected={activeTab === "1"}
              role="tab"
            >
              <FiSettings />
              {t("configTab.configuration")}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("2")}
              className={tabClass("2")}
              aria-selected={activeTab === "2"}
              role="tab"
            >
              <FiMail />
              {t("configTab.emailSettings")}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("3")}
              className={tabClass("3")}
              aria-selected={activeTab === "3"}
              role="tab"
            >
              <FiShield />
              {t("configTab.privacyPolicy")}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("4")}
              className={tabClass("4")}
              aria-selected={activeTab === "4"}
              role="tab"
            >
              <FiHelpCircle />
              {t("configTab.supportInfo")}
            </button>
          </div>

          <div className="min-w-0">
            {activeTab === "1" && <Configurations />}
            {activeTab === "2" && <TabEmailConfig />}
            {activeTab === "3" && <TabPrivacyPolicy />}
            {activeTab === "4" && <TabSupportInfo />}
          </div>
        </div>
      </div>
    </Fragment>
  );
};

export default ConfigTab;
