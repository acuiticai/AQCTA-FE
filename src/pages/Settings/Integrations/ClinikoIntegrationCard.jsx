import React, { useState, useEffect, useCallback } from "react";
import { useHistory } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Stethoscope } from "lucide-react";
import ClinikoServices from "@/services/ClinikoServices";
import ClinikoConnectModal from "./ClinikoConnectModal";

const StatusPill = ({ connected }) => {
  const { t } = useTranslation();
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
        connected
          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
          : "bg-gray-100 text-gray-600 border border-gray-200"
      }`}
    >
      {connected
        ? t("settingsPage.integrations.cliniko.connected", "Connected")
        : t("settingsPage.integrations.cliniko.notConnected", "Not Connected")}
    </span>
  );
};

/**
 * Integration card for Cliniko — shown in the Settings → Integrations grid.
 */
const ClinikoIntegrationCard = ({ selectedOrg }) => {
  const { t } = useTranslation();
  const history = useHistory();
  const [connected, setConnected] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const tc = (key, defaultValue, options) =>
    t(`settingsPage.integrations.cliniko.${key}`, {
      defaultValue,
      ...options,
    });

  const refresh = useCallback(async () => {
    if (!selectedOrg) {
      setConnected(false);
      return;
    }
    try {
      const res = await ClinikoServices.getConnection(selectedOrg);
      setConnected(!!(res?.connected && res?.connection));
    } catch {
      setConnected(false);
    }
  }, [selectedOrg]);

  useEffect(() => {
    refresh();
  }, [refresh, connectOpen]);

  const orgQuery = selectedOrg
    ? `?selectedOrg=${encodeURIComponent(selectedOrg)}`
    : "";

  const handlePrimaryAction = () => {
    if (connected) {
      history.push(`/settings/integrations/cliniko${orgQuery}`);
    } else {
      setConnectOpen(true);
    }
  };

  const handleConnected = () => {
    setConnected(true);
    setConnectOpen(false);
    refresh();
  };

  return (
    <>
      <div
        className={`bg-white rounded-lg border p-6 flex flex-col h-full transition-shadow hover:shadow-md ${
          connected
            ? "border-l-4 border-l-[var(--p-blue)] border-gray-200"
            : "border-gray-200"
        }`}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-lg bg-indigo-50 text-indigo-700">
              <Stethoscope className="w-6 h-6" />
            </span>
            <div>
              <h3 className="text-base font-semibold text-[#111]">
                {tc("title", "Cliniko")}
              </h3>
              <p className="text-sm text-gray-500 mt-0.5">
                {tc("practiceManagement", "Practice management")}
              </p>
            </div>
          </div>
          <StatusPill connected={connected} />
        </div>

        <p className="text-sm text-gray-600 flex-1 mb-5">
          {tc(
            "cardDescription",
            "Sync patient bookings from Cliniko into PCI DB. Confirm, reschedule, or cancel — silent sync keeps data fresh every 15 minutes.",
          )}
        </p>

        <button
          type="button"
          onClick={handlePrimaryAction}
          className="w-full px-4 py-2 text-sm font-medium rounded-lg bg-[var(--p-blue)] text-white hover:opacity-90 transition-opacity"
        >
          {connected ? tc("manage", "Manage") : tc("connect", "Connect")}
        </button>
      </div>

      <ClinikoConnectModal
        open={connectOpen}
        onClose={() => setConnectOpen(false)}
        onConnected={handleConnected}
        selectedOrg={selectedOrg}
      />
    </>
  );
};

export default ClinikoIntegrationCard;
