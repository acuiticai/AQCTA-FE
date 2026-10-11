import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import ToggleSwitch from "@/components/toggle/ToggleSwitch";
import axios from "axios";
import { notifySuccess, notifyError } from "@/utils/toast";

const BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;

const GeneralSettings = ({ organization, headers }) => {
  const { t } = useTranslation();
  const tg = (key, fallback, options) =>
    t(`settingsPage.documentManager.general.${key}`, {
      defaultValue: fallback,
      ...options,
    });

  const [Settings, setSettings] = useState({
    keep_in_trash: 30,
    business_id: organization,
    versioning: false,
  });

  const handlekeep_in_trashChange = (e) => {
    const value = parseInt(e.target.value) || 0;
    setSettings((prev) => ({
      ...prev,
      keep_in_trash: value,
    }));
  };

  const handleVersioningToggle = () => {
    setSettings((prev) => ({
      ...prev,
      versioning: !prev.versioning,
    }));
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        let payload = {
          business_id: organization,
          FilterStatus: "",
          FilterName: "",
        };
        let response = await axios.post(
          `${BASE_URL}/items/documentgenerals/get_all`,
          payload,
          { headers },
        );
        setSettings(response?.data?.data?.[0]);
      } catch (error) {
        console.error("Failed to fetch general settings:", error);
      }
    };

    if (organization) {
      fetchSettings();
    }
  }, [organization]);

  const SaveSettings = async () => {
    try {
      let payload = {
        keep_in_trash: Settings?.keep_in_trash,
        versioning: Settings?.versioning,
        business_id: organization,
      };
      await axios.post(`${BASE_URL}/items/document_general/add`, payload, {
        headers,
      });
      notifySuccess(
        tg("updatedSuccess", "General Settings Updated Successfully"),
      );
    } catch (error) {
      console.error("Failed to save general settings:", error);
      notifyError(error?.response?.data?.message || error?.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="mb-3">
          <h3 className="text-lg font-medium text-gray-900">
            {tg("trashSettings", "Trash Settings")}
          </h3>
        </div>
        <div className="mt-4">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">
              {tg("keepInTrashFor", "Keep items in trash for")}
            </label>
            <input
              type="number"
              min="1"
              max="365"
              value={Settings?.keep_in_trash}
              onChange={handlekeep_in_trashChange}
              className="w-24 p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#A6C437] focus:border-transparent"
            />
            <span className="text-sm text-gray-600">{tg("days", "days")}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="mb-3">
          <h3 className="text-lg font-medium text-gray-900">
            {tg("fileVersioning", "File Versioning")}
          </h3>
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">
                {tg("enableFileVersioning", "Enable File Versioning")}
              </p>
              <p className="text-sm text-gray-500">
                {tg("versioningHint", "Keep track of changes made to files")}
              </p>
            </div>
            <ToggleSwitch
              isOn={Settings?.versioning}
              handleToggle={handleVersioningToggle}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={SaveSettings}
          className="px-4 py-2 bg-[#A6C437] text-white rounded-lg hover:bg-opacity-90 transition-colors"
        >
          {tg("saveChanges", "Save Changes")}
        </button>
      </div>
    </div>
  );
};

export default GeneralSettings;
