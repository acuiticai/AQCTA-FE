import React, { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Stethoscope,
  RefreshCw,
  Unplug,
  AlertTriangle,
  CheckCircle2,
  Clock3,
} from "lucide-react";
import Header from "@/components/header/Header";
import AppLayout from "@/pages/Settings/app-layout";
import SettingsOrgBanner from "@/pages/Settings/SettingsOrgBanner";
import { CustomModal } from "@/page-layouts";
import { notifyError, notifySuccess } from "@/utils/toast";
import ClinikoServices from "@/services/ClinikoServices";
import ClinikoConnectModal from "./ClinikoConnectModal";

const formatDateTime = (val) => {
  if (!val) return "—";
  try {
    return new Date(val).toLocaleString();
  } catch {
    return String(val);
  }
};

const ClinikoManageContent = () => {
  const { t } = useTranslation();
  const tc = (key, defaultValue, options) =>
    t(`settingsPage.integrations.cliniko.${key}`, {
      defaultValue,
      ...options,
    });
  const ti = (key, defaultValue, options) =>
    t(`settingsPage.integrations.${key}`, { defaultValue, ...options });

  const location = useLocation();
  const selectedOrg = new URLSearchParams(location.search).get("selectedOrg");
  const [connection, setConnection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncFromDate, setSyncFromDate] = useState("");
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);

  const loadState = useCallback(async () => {
    if (!selectedOrg) {
      setConnection(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await ClinikoServices.getConnection(selectedOrg);
      if (res?.connected && res?.connection) {
        setConnection(res.connection);
      } else {
        setConnection(null);
      }
    } catch (err) {
      setConnection(null);
      notifyError(
        err?.response?.data?.message ||
          err?.message ||
          tc("loadFailed", "Failed to load Cliniko status"),
      );
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrg, t]);

  useEffect(() => {
    loadState();
  }, [loadState]);

  const connected = !!connection?.connected || !!connection?.shard;

  const handleSettingsChange = async (patch) => {
    if (!selectedOrg) {
      notifyError(
        tc("selectBusinessFirst", "Select a business in Settings first"),
      );
      return;
    }
    try {
      const res = await ClinikoServices.updateSettings({
        ...patch,
        businessId: selectedOrg,
      });
      if (res?.connection) setConnection(res.connection);
      notifySuccess(tc("settingsSaved", "Settings saved"));
    } catch (err) {
      notifyError(
        err?.response?.data?.message ||
          err?.message ||
          tc("updateFailed", "Update failed"),
      );
    }
  };

  const handleSyncNow = async () => {
    if (!connected) {
      notifyError(tc("notConnectedError", "Cliniko is not connected"));
      return;
    }
    if (connection?.syncAppointments === false) {
      notifyError(
        tc("enableSyncFirst", "Enable appointment sync in settings first"),
      );
      return;
    }
    setSyncing(true);
    try {
      const payload = {};
      if (syncFromDate) {
        payload.fromDate = new Date(`${syncFromDate}T00:00:00.000Z`).toISOString();
      }
      const res = await ClinikoServices.sync({
        ...payload,
        businessId: selectedOrg,
      });
      const base = tc("syncedAppointments", "Synced {{count}} appointment(s) into DB", {
        count: res?.synced ?? 0,
      });
      const since = res?.fromDate
        ? tc("syncedSince", " (since {{date}})", {
            date: new Date(res.fromDate).toLocaleDateString(),
          })
        : "";
      notifySuccess(base + since);
      await loadState();
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        tc("syncFailed", "Sync failed");
      if (err?.response?.data?.code === "CLINIKO_RATE_LIMIT") {
        notifyError(
          tc("rateLimit", "Cliniko rate limit reached, try again shortly"),
        );
      } else {
        notifyError(msg);
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await ClinikoServices.disconnect(selectedOrg);
      setDisconnectOpen(false);
      notifySuccess(tc("disconnected", "Cliniko disconnected"));
      await loadState();
    } catch (err) {
      notifyError(
        err?.response?.data?.message ||
          err?.message ||
          tc("disconnectFailed", "Disconnect failed"),
      );
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-white h-full max-h-[90vh] overflow-y-auto">
        <div className="animate-pulse">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-100" />
              <div>
                <div className="h-5 w-28 bg-gray-200 rounded mb-2" />
                <div className="h-3 w-40 bg-gray-100 rounded" />
              </div>
            </div>
            <div className="h-4 w-24 bg-gray-100 rounded" />
          </div>
          <div className="mt-6 rounded-xl border border-gray-200 p-6 bg-white shadow-sm">
            <div className="h-4 w-44 bg-gray-200 rounded mb-4" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="h-20 rounded-lg bg-gray-100 border border-gray-200" />
              <div className="h-20 rounded-lg bg-gray-100 border border-gray-200" />
              <div className="h-20 rounded-lg bg-gray-100 border border-gray-200" />
            </div>
          </div>
          <div className="mt-6 rounded-xl border border-gray-200 p-6 bg-white shadow-sm">
            <div className="h-4 w-32 bg-gray-200 rounded mb-4" />
            <div className="h-10 w-44 bg-gray-100 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="p-6 bg-white h-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-lg bg-indigo-50 text-indigo-700">
              <Stethoscope className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-xl font-semibold text-[#111]">
                {tc("title", "Cliniko")}
              </h1>
              <p className="text-sm text-gray-500">
                {tc("notConnectedLower", "Not connected")}
              </p>
            </div>
          </div>
          <Link
            to={`/Settings${location.search}`}
            className="text-sm text-[var(--p-blue)] hover:underline"
          >
            {ti("backToSettings", "← Back to Settings")}
          </Link>
        </div>

        <SettingsOrgBanner />

        <div className="mt-6 rounded-xl border border-gray-200 p-6 bg-white shadow-sm max-w-2xl">
          <p className="text-sm text-gray-600 mb-4">
            {tc(
              "connectBlurb",
              "Connect your Cliniko account. Credentials are encrypted in the PCI database so silent sync can run every 15 minutes without the browser.",
            )}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
              <p className="text-gray-500">{tc("appointments", "Appointments")}</p>
              <p className="text-[#111] font-semibold mt-1">
                {tc("storedInDb", "Stored in DB")}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
              <p className="text-gray-500">
                {tc("credentialStorage", "Credential storage")}
              </p>
              <p className="text-[#111] font-semibold mt-1">
                {tc("encryptedServerDb", "Encrypted server DB")}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
              <p className="text-gray-500">{tc("silentSync", "Silent sync")}</p>
              <p className="text-[#111] font-semibold mt-1">
                {tc("every15Min", "Every 15 min")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setConnectOpen(true)}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--p-blue)] text-white hover:opacity-90"
          >
            {tc("connectCliniko", "Connect Cliniko")}
          </button>
        </div>

        <ClinikoConnectModal
          open={connectOpen}
          onClose={() => setConnectOpen(false)}
          onConnected={loadState}
          selectedOrg={selectedOrg}
        />
      </div>
    );
  }

  return (
    <div className="p-6 bg-white h-full max-h-[90vh] overflow-y-auto">
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-3">
          <span className="p-2 rounded-lg bg-indigo-50 text-indigo-700">
            <Stethoscope className="w-6 h-6" />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-[#111]">
              {tc("title", "Cliniko")}
            </h1>
            <p className="text-sm text-gray-500">
              {tc("integrationSettings", "Integration settings (server DB)")}
            </p>
          </div>
        </div>
        <Link
          to={`/Settings${location.search}`}
          className="text-sm text-[var(--p-blue)] hover:underline"
        >
          {ti("backToSettings", "← Back to Settings")}
        </Link>
      </div>

      <SettingsOrgBanner />

      <div className="mt-6 rounded-xl border border-gray-200 border-l-4 border-l-[var(--p-blue)] p-6 bg-white shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {tc("connected", "Connected")}
            </p>
            <p className="text-lg font-semibold text-[#111] mt-3">
              {connection?.businessName || tc("clinikoAccount", "Cliniko account")}
            </p>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-gray-500">{tc("region", "Region")}</p>
                <p className="text-[#111] font-semibold mt-1">
                  {connection?.shard?.toUpperCase() || "—"}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-gray-500">{tc("apiKey", "API key")}</p>
                <p className="text-[#111] font-semibold mt-1">
                  {connection?.apiKeyMasked || "••••"}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-gray-500">{tc("lastSync", "Last sync")}</p>
                <p className="text-[#111] font-semibold mt-1">
                  {formatDateTime(connection?.lastSyncedAt)}
                </p>
              </div>
            </div>
            {connection?.lastSyncError ? (
              <p className="mt-2 text-sm text-rose-600">{connection.lastSyncError}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setDisconnectOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
          >
            <Unplug className="w-4 h-4" />
            {tc("disconnect", "Disconnect")}
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-gray-200 p-6 bg-white shadow-sm space-y-5">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          {tc("syncSettings", "Sync settings")}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="rounded-lg border border-gray-200 p-3 bg-gray-50 cursor-pointer hover:border-[var(--p-blue)]">
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={connection?.syncAppointments !== false}
                onChange={(e) =>
                  handleSettingsChange({ syncAppointments: e.target.checked })
                }
                className="mt-0.5 rounded border-gray-300 text-[var(--p-blue)] focus:ring-[var(--p-blue)]"
              />
              <div>
                <p className="text-sm font-medium text-[#111]">
                  {tc("appointments", "Appointments")}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {tc("syncBookingsHint", "Sync bookings into PCI DB")}
                </p>
              </div>
            </div>
          </label>
          <label className="rounded-lg border border-gray-200 p-3 bg-gray-50 cursor-pointer hover:border-[var(--p-blue)]">
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={connection?.silentSyncEnabled !== false}
                onChange={(e) =>
                  handleSettingsChange({ silentSyncEnabled: e.target.checked })
                }
                className="mt-0.5 rounded border-gray-300 text-[var(--p-blue)] focus:ring-[var(--p-blue)]"
              />
              <div>
                <p className="text-sm font-medium text-[#111]">
                  {tc("silentSync", "Silent sync")}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {tc(
                    "silentSyncHint",
                    "Background every 15 minutes (server cron)",
                  )}
                </p>
              </div>
            </div>
          </label>
        </div>

        <div className="flex flex-wrap items-end gap-3 pt-4 border-t border-gray-100">
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              {tc("syncFromDate", "Sync from date (optional)")}
            </label>
            <input
              type="date"
              value={syncFromDate}
              onChange={(e) => setSyncFromDate(e.target.value)}
              className="h-10 border border-gray-200 rounded-lg px-3 text-sm bg-white"
            />
          </div>
          <button
            type="button"
            onClick={handleSyncNow}
            disabled={syncing || connection?.syncAppointments === false}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--p-blue)] text-white hover:opacity-90 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? tc("syncing", "Syncing…") : tc("syncNow", "Sync Now")}
          </button>
          <div className="inline-flex items-center gap-2 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <Clock3 className="w-4 h-4" />
            {tc("lastSynced", "Last synced:")}
            <span className="text-[#111] font-medium">
              {formatDateTime(connection?.lastSyncedAt)}
            </span>
          </div>
        </div>
        <p className="text-xs text-gray-500">
          {tc(
            "syncFromDateHelp",
            "Leave from-date empty to sync from last sync time (incremental). Set a date to pull appointments updated on/after that day.",
          )}
        </p>
      </div>

      <CustomModal
        open={disconnectOpen}
        onClose={() => setDisconnectOpen(false)}
        title={tc("disconnectTitle", "Disconnect Cliniko?")}
        width="420px"
        showActions={false}
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              {tc(
                "disconnectWarning",
                "This removes the stored API key and stops silent sync. Cached appointment rows in DB are kept for history.",
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDisconnect}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-rose-600 text-white hover:bg-rose-700"
            >
              {tc("disconnect", "Disconnect")}
            </button>
            <button
              type="button"
              onClick={() => setDisconnectOpen(false)}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              {tc("cancel", "Cancel")}
            </button>
          </div>
        </div>
      </CustomModal>
    </div>
  );
};

const ClinikoManagePage = () => (
  <AppLayout>
    <Header />
    <ClinikoManageContent />
  </AppLayout>
);

export default ClinikoManagePage;
