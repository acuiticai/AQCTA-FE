import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CustomModal } from "@/page-layouts";
import { notifyError, notifySuccess } from "@/utils/toast";
import ClinikoServices from "@/services/ClinikoServices";
import { CheckCircle2, KeyRound, Globe2, ShieldCheck } from "lucide-react";
import {
  CLINIKO_SHARD_OPTIONS,
  parseShardFromApiKey,
  resolveClinikoShard,
  shardMismatchWarning,
} from "@/utils/cliniko/clinikoShard";

/**
 * Modal for connecting a Cliniko account — credentials saved to PCI DB (encrypted).
 */
const ClinikoConnectModal = ({ open, onClose, onConnected, selectedOrg }) => {
  const { t } = useTranslation();
  const tc = (key, defaultValue, options) =>
    t(`settingsPage.integrations.cliniko.${key}`, {
      defaultValue,
      ...options,
    });

  const [apiKey, setApiKey] = useState("");
  const [shard, setShard] = useState("au1");
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testPassed, setTestPassed] = useState(false);
  const [businessPreview, setBusinessPreview] = useState(null);
  const [resolvedShard, setResolvedShard] = useState(null);

  const shardLabelKey = {
    au1: "shardAu1",
    au2: "shardAu2",
    au3: "shardAu3",
    au4: "shardAu4",
    au5: "shardAu5",
    uk1: "shardUk1",
    uk2: "shardUk2",
    uk3: "shardUk3",
    ca1: "shardCa1",
    eu1: "shardEu1",
  };

  const shardOptions = useMemo(
    () =>
      CLINIKO_SHARD_OPTIONS.map((opt) => ({
        ...opt,
        label: tc(shardLabelKey[opt.value] || opt.value, opt.label),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t],
  );

  const resetForm = () => {
    setApiKey("");
    setShard("au1");
    setTesting(false);
    setSaving(false);
    setTestPassed(false);
    setBusinessPreview(null);
    setResolvedShard(null);
  };

  const handleClose = () => {
    resetForm();
    onClose?.();
  };

  const handleApiKeyChange = (value) => {
    setApiKey(value);
    setTestPassed(false);
    const detected = parseShardFromApiKey(value);
    if (detected) setShard(detected);
  };

  const mismatchNote = shardMismatchWarning(apiKey, shard, (key, fallback, opts) =>
    tc(key, fallback, opts),
  );

  const handleTestConnection = async () => {
    const key = apiKey.trim();
    if (!key) {
      notifyError(tc("enterApiKey", "Please enter your Cliniko API key"));
      return;
    }
    const shardToUse = resolveClinikoShard(key, shard);
    setTesting(true);
    setTestPassed(false);
    setBusinessPreview(null);
    setResolvedShard(null);
    try {
      const res = await ClinikoServices.testConnection({
        apiKey: key,
        shard: shardToUse,
      });
      const usedShard = res?.shard || shardToUse;
      setResolvedShard(usedShard);
      setShard(usedShard);
      const businessName =
        res?.business?.name ||
        res?.businesses?.[0]?.name ||
        tc("clinikoAccount", "Cliniko account");
      setBusinessPreview(businessName);
      setTestPassed(true);
      notifySuccess(
        tc("connectedTo", "Connected to {{name}} ({{shard}})", {
          name: businessName,
          shard: usedShard.toUpperCase(),
        }),
      );
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        tc("connectionTestFailed", "Connection test failed");
      if (err?.response?.data?.code === "CLINIKO_RATE_LIMIT") {
        notifyError(
          tc("rateLimit", "Cliniko rate limit reached, try again shortly"),
        );
      } else {
        notifyError(msg);
      }
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!testPassed) {
      notifyError(
        tc("testBeforeSaving", "Please test the connection before saving"),
      );
      return;
    }
    if (!selectedOrg) {
      notifyError(
        tc(
          "selectBusinessBeforeConnect",
          "Select a business in Settings before connecting Cliniko",
        ),
      );
      return;
    }
    const key = apiKey.trim();
    const shardToSave = resolvedShard || resolveClinikoShard(key, shard);
    setSaving(true);
    try {
      await ClinikoServices.saveConnection({
        apiKey: key,
        shard: shardToSave,
        businessName: businessPreview || tc("clinikoAccount", "Cliniko account"),
        businessId: selectedOrg,
      });
      notifySuccess(
        tc(
          "connectedSuccess",
          "Cliniko connected — credentials stored securely on server",
        ),
      );
      onConnected?.();
      handleClose();
    } catch (err) {
      notifyError(
        err?.response?.data?.message ||
          err?.message ||
          tc("saveFailed", "Failed to save connection"),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <CustomModal
      open={open}
      onClose={handleClose}
      title={tc("connectModalTitle", "Connect Cliniko")}
      width="560px"
      showActions={false}
    >
      <div className="space-y-5">
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
          <p className="text-sm text-indigo-900 font-medium">
            {tc("connectSecurely", "Connect your Cliniko account securely")}
          </p>
          <p className="text-xs text-indigo-700 mt-1">
            {tc(
              "connectSecurelyHint",
              "API key is encrypted and stored in PCI DB so silent sync can run without your browser.",
            )}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white border border-indigo-200 text-indigo-700">
              <KeyRound className="w-3.5 h-3.5" />
              {tc("apiKeyAuth", "API key auth")}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white border border-indigo-200 text-indigo-700">
              <Globe2 className="w-3.5 h-3.5" />
              {tc("autoShardDetect", "Auto shard detect")}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white border border-indigo-200 text-indigo-700">
              <ShieldCheck className="w-3.5 h-3.5" />
              {tc("encryptedDbStorage", "Encrypted DB storage")}
            </span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {tc("apiKeyLabel", "API Key")}
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => handleApiKeyChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            placeholder={tc("apiKeyPlaceholder", "Paste your Cliniko API key")}
            autoComplete="off"
          />
          {mismatchNote ? (
            <p className="text-xs text-amber-700 mt-1">{mismatchNote}</p>
          ) : null}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {tc("regionShard", "Region (shard)")}
          </label>
          <select
            value={shard}
            onChange={(e) => {
              setShard(e.target.value);
              setTestPassed(false);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            {shardOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {testPassed && (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-emerald-800">
                {businessPreview}
              </p>
              <p className="text-xs text-emerald-700 mt-0.5">
                {tc("readyToSave", "Shard {{shard}} — ready to save", {
                  shard: resolvedShard?.toUpperCase() || shard.toUpperCase(),
                })}
              </p>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing || !apiKey.trim()}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {testing
              ? tc("testing", "Testing…")
              : tc("testConnection", "Test connection")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!testPassed || saving}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--p-blue)] text-white disabled:opacity-50"
          >
            {saving
              ? tc("saving", "Saving…")
              : tc("saveAndConnect", "Save & connect")}
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700"
          >
            {tc("cancel", "Cancel")}
          </button>
        </div>
      </div>
    </CustomModal>
  );
};

export default ClinikoConnectModal;
