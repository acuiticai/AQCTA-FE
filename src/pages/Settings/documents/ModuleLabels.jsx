import React, { useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import Header from "@/components/header/Header";
import AppLayout from "../app-layout";
import SettingsOrgBanner from "../SettingsOrgBanner";
import { AdminContext } from "@/context/AdminContext";
import { notifyError, notifySuccess } from "@/utils/toast";
import { getBusinessGroupModuleLabels, updateBusinessGroupModuleLabels } from "@/services/moduleLabelService";
import {
  invalidateBusinessGroupModuleLabelsCache,
  useModuleLabels,
} from "@/context/ModuleLabelsContext";
import { useSettingsCrudPermissions } from "@/hooks/useSettingsCrudPermissions";

const BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;

const editableKeys = [
  { key: "saleOrder", label: "Sale Order" },
];

export default function ModuleLabels() {
  const { canUpdate } = useSettingsCrudPermissions();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const { setLabelsLocally, refreshModuleLabels } = useModuleLabels();
  const [selectedOrg, setSelectedOrg] = useState(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("selectedOrg");
    const fromSession = sessionStorage.getItem("settingsSelectedOrg");
    return String(fromUrl || fromSession || "");
  });
  const [businessGroupId, setBusinessGroupId] = useState("");
  const [loading, setLoading] = useState(false);
  const [isResolvingContext, setIsResolvingContext] = useState(() => {
    const fromUrl = typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("selectedOrg")
      : "";
    const fromSession = typeof window !== "undefined" ? sessionStorage.getItem("settingsSelectedOrg") : "";
    return !(fromUrl || fromSession || "");
  });
  const [labels, setLabels] = useState({});

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo?.token}`,
    }),
    [adminInfo?.token],
  );

  useEffect(() => {
    if (selectedOrg) {
      setIsResolvingContext(false);
      return;
    }
    const fromUrl = new URLSearchParams(window.location.search).get("selectedOrg");
    const fromSession = sessionStorage.getItem("settingsSelectedOrg");
    const fromAdminBusinesses =
      Array.isArray(adminInfo?.businesses) && adminInfo.businesses.length > 0
        ? adminInfo.businesses[0]?._id || adminInfo.businesses[0]
        : "";
    const resolved = fromUrl || fromSession || fromAdminBusinesses || "";
    if (resolved) {
      setSelectedOrg(String(resolved));
      setIsResolvingContext(false);
      return;
    }
    if (Array.isArray(adminInfo?.businesses)) {
      setIsResolvingContext(false);
    }
  }, [adminInfo?.businesses, selectedOrg]);

  useEffect(() => {
    if (selectedOrg) {
      sessionStorage.setItem("settingsSelectedOrg", selectedOrg);
    }
  }, [selectedOrg]);

  useEffect(() => {
    if (isResolvingContext) return;

    let cancelled = false;
    const load = async () => {
      if (!selectedOrg || !adminInfo?.token) return;
      setLoading(true);
      try {
        const bizRes = await axios.get(`${BASE_URL}/Business/${selectedOrg}`, { headers });
        if (cancelled) return;
        const businessRow = bizRes?.data?.data || bizRes?.data || {};
        const rawGroup =
          businessRow?.businessGroupId ||
          businessRow?.businessGroup ||
          null;
        const groupId = rawGroup?._id || rawGroup;
        if (!groupId) {
          notifyError("Business group not found for selected business.");
          return;
        }
        setBusinessGroupId(groupId);
        const res = await getBusinessGroupModuleLabels(groupId, { headers });
        const loadedLabels = res?.data?.data?.moduleLabels || {};
        setLabels(loadedLabels);
        // Context is already synced by ModuleLabelsProvider.refreshModuleLabels(); avoid duplicate set → version bump → whole-app Switch remount (blink).
      } catch (e) {
        if (cancelled) return;
        notifyError("Failed to load module labels.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
      setLoading(false);
    };
  }, [selectedOrg, adminInfo?.token, headers, isResolvingContext]);

  const handleSave = async () => {
    if (!canUpdate) return;
    if (!businessGroupId) {
      notifyError("Business context is missing. Please open this from Settings.");
      return;
    }
    try {
      await updateBusinessGroupModuleLabels(businessGroupId, labels, { headers });
      invalidateBusinessGroupModuleLabelsCache(businessGroupId);
      setLabelsLocally(labels);
      await refreshModuleLabels();
      notifySuccess("Module labels updated successfully.");
    } catch {
      notifyError("Failed to update module labels.");
    }
  };

  const handleResetDefaults = () => {
    if (!canUpdate) return;
    const defaultLabels = { ...labels, saleOrder: "Sale Order" };
    setLabels(defaultLabels);
    setLabelsLocally(defaultLabels);
  };

  return (
    <AppLayout>
      <Header />
      <div className="p-6 bg-white h-full max-h-[90vh] overflow-y-auto">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Dynamic Module Labels</h1>
          <p className="text-sm text-gray-500 mt-1">
            Change module names globally without touching technical keys, DB tables, or permissions.
          </p>
        </div>
        <SettingsOrgBanner />

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          {!selectedOrg && (
            <div className="mt-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              No organization context found. Open this page from Settings with an organization selected.
            </div>
          )}

          {selectedOrg ? (
            <>
              {loading && (
                <div className="mt-4 text-xs text-gray-500">Refreshing labels...</div>
              )}
              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                {editableKeys.map((item) => (
                  <div key={item.key}>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      {item.label}
                    </label>
                    <input
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#A6C437]/30"
                      value={labels[item.key] || ""}
                      placeholder={`e.g. ${item.label}`}
                      readOnly={!canUpdate}
                      onChange={(e) =>
                        setLabels((prev) => ({ ...prev, [item.key]: e.target.value }))
                      }
                    />
                  </div>
                ))}
              </div>

              <div className="mt-5 p-3 rounded-lg border border-blue-100 bg-blue-50 text-xs text-blue-800">
                Example: if <b>Sale Order</b> is set to <b>Work Order</b>, UI labels like
                create/view/header messages will use Work Order automatically where integrated.
              </div>

              <div className="pt-4 flex items-center gap-2">
                {canUpdate && (
                  <button
                    onClick={handleSave}
                    className="px-4 py-2 rounded-md bg-[#A6C437] text-white text-sm font-medium hover:bg-[#93ae2c]"
                  >
                    Save Labels
                  </button>
                )}
                {canUpdate && (
                  <button
                    onClick={handleResetDefaults}
                    className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
                  >
                    Reset Default
                  </button>
                )}
              </div>
            </>
          ) : isResolvingContext ? (
            <div className="mt-5 text-sm text-gray-500">Loading…</div>
          ) : null}
        </div>
      </div>
    </AppLayout>
  );
}
