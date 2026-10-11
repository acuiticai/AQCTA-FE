"use client";

import { useState, useEffect, useContext } from "react";
import { useTranslation } from "react-i18next";
import Header from "@/components/header/Header";
import AppLayout from "../app-layout";
import axios from "axios";
import SettingsOrgBanner from "../SettingsOrgBanner";
import { useLocation } from "react-router-dom";
import { AdminContext } from "@/context/AdminContext";
import WFHGroupSettings from "./WFHGroupSettings";
const BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;

const WFHSettingsPage = () => {
  const { t } = useTranslation();
  const thr = (key, fallback, options) =>
    t(`settingsPage.hr.${key}`, { defaultValue: fallback, ...options });

  const [activeTab, setActiveTab] = useState("WFH Groups");
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [organization, setOrganization] = useState(null); // Set initially as null
  const [isOrgLoaded, setIsOrgLoaded] = useState(false); // To track when organization is loaded
  const location = useLocation();

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const selectedOrg = searchParams.get("selectedOrg");

    if (selectedOrg) {
      setOrganization(selectedOrg);
    }

    setIsOrgLoaded(true); // Organization has been fetched
  }, [location]);

  useEffect(() => {
    if (isOrgLoaded && organization) {
      // Ensure organization is loaded before fetching items
      fetchItems(activeTab, organization);
    }
  }, [activeTab, organization, isOrgLoaded]);

  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo.token}`,
  };

  const tabs = [];

  const fetchItems = async (ActiveTab, selectedOrg) => {
    if (!selectedOrg) return;
    setLoading(true);
    try {
      const payload = {
        business_id: selectedOrg,
        FilterStatus: "",
        FilterName: "",
      };

      const response = await axios.post(
        `${BASE_URL}/wfh-groups/get_all`,
        payload,
        { headers }
      );
      setItems(response.data.data);
      setError(null);
    } catch (err) {
      setError(thr("wfhGroups.fetchFailed", "Failed to fetch WFH groups"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <Header />
      <div className="p-6 bg-white h-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-xl font-semibold text-gray-900">
            {thr("wfh.wfhManagement", "WFH Management")}
          </h1>
        </div>
        <SettingsOrgBanner />

        <div className="border-b border-gray-200 mb-6">
          <nav className="flex -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  fetchItems(tab, organization);
                }}
                className={`mr-8 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab
                    ? "border-[#A6C437] text-[#A6C437]"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tab}
              </button>
            ))}
            <button
              key={"WFH Groups"}
              onClick={() => {
                setActiveTab("WFH Groups");
                fetchItems("WFH Groups", organization);
              }}
              className={`mr-8 py-4 px-1 border-b-2 font-medium text-sm transition-colors border-[#A6C437] text-[#A6C437]`}
            >
              {thr("wfhGroups.wfhGroups", "WFH Groups")}
            </button>
          </nav>
        </div>

        {!isOrgLoaded && !organization ? (
          <div className="fixed inset-0 flex items-center justify-center bg-white">
            <p className="text-gray-600">
              {thr("loadingOrganization", "Loading organization...")}
            </p>
          </div>
        ) : loading ? (
          <div>{thr("loading", "Loading...")}</div>
        ) : error ? (
          <div>{thr("errorPrefix", "Error: {{error}}", { error })}</div>
        ) : (
          activeTab === "WFH Groups" && (
            <WFHGroupSettings organization={organization} headers={headers} />
          )
        )}
      </div>
    </AppLayout>
  );
};

export default WFHSettingsPage;
