import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useLocation } from "react-router-dom";
import { AdminContext } from "@/context/AdminContext";
import {
  getAllModuleLabels,
  getModuleLabel as readModuleLabel,
  getModuleLabelsVersion,
  getModulePath as readModulePath,
  getModuleRouteAliases as readModuleRouteAliases,
  getModuleRoutePath as readModuleRoutePath,
  getModuleSlug as readModuleSlug,
  setModuleLabels,
  subscribeToModuleLabelChanges,
} from "@/utils/moduleLabels";
import { getBusinessGroupModuleLabels } from "@/services/moduleLabelService";

const BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;

const ModuleLabelsContext = createContext({
  moduleLabels: {},
  moduleLabelsVersion: 0,
  loadingModuleLabels: false,
  moduleLabelsHydrated: true,
  refreshModuleLabels: async () => {},
  setLabelsLocally: () => {},
  getModuleLabel: () => "",
  getModuleSlug: () => "",
  getModulePath: () => "/",
  getModuleRoutePath: () => "",
  getModuleRouteAliases: () => [],
});

const groupLabelsCache = new Map();

export function invalidateBusinessGroupModuleLabelsCache(groupId) {
  if (groupId != null && String(groupId).trim() !== "") {
    groupLabelsCache.delete(String(groupId));
  } else {
    groupLabelsCache.clear();
  }
}

const resolveSelectedOrg = (adminInfo, locationSearch = "") => {
  const selectedOrgFromUrl = new URLSearchParams(locationSearch).get("selectedOrg");
  const selectedOrgFromSession = sessionStorage.getItem("settingsSelectedOrg");
  const selectedOrgFromAdmin =
    Array.isArray(adminInfo?.businesses) && adminInfo.businesses.length > 0
      ? adminInfo.businesses[0]?._id || adminInfo.businesses[0]
      : "";
  return selectedOrgFromUrl || selectedOrgFromSession || selectedOrgFromAdmin || "";
};

const resolveBusinessGroupId = (businessRes) =>
  businessRes?.data?.data?.businessGroupId ||
  businessRes?.data?.data?.businessGroup?._id ||
  businessRes?.data?.data?.businessGroup ||
  businessRes?.data?.businessGroup?._id ||
  businessRes?.data?.businessGroup ||
  null;

export const ModuleLabelsProvider = ({ children }) => {
  const { state } = useContext(AdminContext);
  const adminInfo = state?.adminInfo;
  const location = useLocation();
  const [moduleLabels, setModuleLabelsState] = useState(getAllModuleLabels());
  const [moduleLabelsVersion, setModuleLabelsVersion] = useState(getModuleLabelsVersion());
  const [loadingModuleLabels, setLoadingModuleLabels] = useState(false);
  const [moduleLabelsHydrated, setModuleLabelsHydrated] = useState(
    () => !adminInfo?.token,
  );

  const authToken = adminInfo?.token;

  useEffect(() => {
    if (!authToken) {
      setModuleLabelsHydrated(true);
      return;
    }
    setModuleLabelsHydrated(false);
  }, [authToken]);

  useEffect(() => {
    const unsubscribe = subscribeToModuleLabelChanges((version) => {
      setModuleLabelsState(getAllModuleLabels());
      setModuleLabelsVersion(version);
    });
    return unsubscribe;
  }, []);

  const setLabelsLocally = useCallback((labels = {}) => {
    setModuleLabels(labels);
  }, []);

  const refreshModuleLabels = useCallback(async () => {
    if (!adminInfo?.token) return;
    const selectedOrg = resolveSelectedOrg(adminInfo, location.search);
    if (!selectedOrg) {
      setModuleLabelsHydrated(true);
      return;
    }

    const headers = {
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo.token}`,
    };

    setLoadingModuleLabels(true);
    try {
      const businessRes = await axios.get(`${BASE_URL}/Business/${selectedOrg}`, {
        headers,
      });
      const businessGroupId = resolveBusinessGroupId(businessRes);
      if (!businessGroupId) {
        setModuleLabels({});
        return;
      }

      if (groupLabelsCache.has(businessGroupId)) {
        setModuleLabels(groupLabelsCache.get(businessGroupId));
        return;
      }

      const labelsRes = await getBusinessGroupModuleLabels(businessGroupId, { headers });
      const labels = labelsRes?.data?.data?.moduleLabels || {};
      groupLabelsCache.set(businessGroupId, labels);
      setModuleLabels(labels);
    } catch (_) {
      setModuleLabels({});
    } finally {
      setLoadingModuleLabels(false);
      setModuleLabelsHydrated(true);
    }
  }, [adminInfo, location.search]);

  useEffect(() => {
    refreshModuleLabels();
  }, [refreshModuleLabels]);

  const value = useMemo(
    () => ({
      moduleLabels,
      moduleLabelsVersion,
      loadingModuleLabels,
      moduleLabelsHydrated,
      refreshModuleLabels,
      setLabelsLocally,
      getModuleLabel: readModuleLabel,
      getModuleSlug: readModuleSlug,
      getModulePath: readModulePath,
      getModuleRoutePath: readModuleRoutePath,
      getModuleRouteAliases: readModuleRouteAliases,
    }),
    [
      moduleLabels,
      moduleLabelsVersion,
      loadingModuleLabels,
      moduleLabelsHydrated,
      refreshModuleLabels,
      setLabelsLocally,
    ],
  );

  return (
    <ModuleLabelsContext.Provider value={value}>
      {children}
    </ModuleLabelsContext.Provider>
  );
};

export const useModuleLabels = () => useContext(ModuleLabelsContext);
