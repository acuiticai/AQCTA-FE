import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import ClaimGroups from "./ClaimGroups";
import ClaimTypes from "./ClaimTypes";
import { useLocation } from "react-router-dom";
import Header from "@/components/header/Header";
import AppLayout from "../../app-layout";
import SettingsOrgBanner from "../../SettingsOrgBanner";

const Claims = () => {
  const { t } = useTranslation();
  const thr = (key, fallback, options) =>
    t(`settingsPage.hr.${key}`, { defaultValue: fallback, ...options });

  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const selectedOrg = queryParams.get("selectedOrg");

  // State to track the active tab
  const [activeTab, setActiveTab] = useState("groups"); // Default to 'groups' tab

  return (
    <AppLayout>
      <Header />
      <div className="w-full max-w-7xl mx-auto py-6 px-4 max-h-[90vh] overflow-y-auto pb-[120px]">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">{thr("hrManagement", "HR Management")}</h1>
        </div>
        <SettingsOrgBanner />

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex">
              <a
                href="#"
                className={`py-4 px-6 font-medium ${
                  activeTab === "groups"
                    ? "border-b-2 border-[#A6C437] text-[#A6C437]"
                    : "text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab("groups");
                }}
              >
                {thr("claims.claimGroups", "Claim Groups")}
              </a>
              <a
                href="#"
                className={`py-4 px-6 font-medium ${
                  activeTab === "types"
                    ? "border-b-2 border-[#A6C437] text-[#A6C437]"
                    : "text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab("types");
                }}
              >
                {thr("claims.claimTypes", "Claim Types")}
              </a>
            </nav>
          </div>

          {/* Render the active component based on the selected tab */}
          {activeTab === "groups" ? (
            <ClaimGroups selectedOrg={selectedOrg} />
          ) : (
            <ClaimTypes selectedOrg={selectedOrg} />
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Claims;
