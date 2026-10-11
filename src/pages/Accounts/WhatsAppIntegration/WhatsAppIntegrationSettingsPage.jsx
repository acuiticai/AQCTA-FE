import React, { useState, useEffect, useContext, useCallback } from "react";
import { Link, useLocation, useHistory } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  KeyRound,
  MessageCircle,
  Plug,
  PlugZap,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import Header from "@/components/header/Header";
import AppLayout from "@/pages/Settings/app-layout";
import SettingsOrgBanner from "@/pages/Settings/SettingsOrgBanner";
import { CustomModal, Loader } from "@/page-layouts";
import { AdminContext } from "@/context/AdminContext";
import { notifyError, notifySuccess } from "@/utils/toast";
import WhatsAppIntegrationServices from "@/services/WhatsAppIntegrationServices";
import { formatWhatsappDisplay } from "@/utils/whatsappPhoneFormat";
import { useSettingsCrudPermissions } from "@/hooks/useSettingsCrudPermissions";

const SectionCard = ({ title, description, icon: Icon, children, footer }) => (
  <div className="w-full bg-white rounded-lg border border-gray-200 p-6 space-y-4">
    <div className="flex items-start gap-3 border-b border-gray-200 pb-3">
      {Icon ? (
        <span className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
          <Icon className="w-5 h-5" />
        </span>
      ) : null}
      <div className="flex-1">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        {description ? (
          <p className="text-sm text-gray-600 mt-1">{description}</p>
        ) : null}
      </div>
    </div>
    <div>{children}</div>
    {footer ? <div className="pt-2">{footer}</div> : null}
  </div>
);

const StatusPill = ({ connected }) => {
  const { t } = useTranslation();
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${connected
          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
          : "bg-amber-50 text-amber-700 border border-amber-200"
        }`}
    >
      {connected ? (
        <CheckCircle2 className="w-3.5 h-3.5" />
      ) : (
        <AlertTriangle className="w-3.5 h-3.5" />
      )}
      {connected
        ? t("accountsSettings.whatsappIntegration.connected", "Connected")
        : t("accountsSettings.whatsappIntegration.notConnected", "Not connected")}
    </span>
  );
};

const formatDateTime = (val) => {
  if (!val) return "—";
  try {
    return new Date(val).toLocaleString();
  } catch {
    return String(val);
  }
};

const WhatsAppIntegrationSettingsContent = () => {
  const { t } = useTranslation();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const location = useLocation();
  const history = useHistory();

  const [businessId, setBusinessId] = useState("");
  const [recordReady, setRecordReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirmDisconnectOpen, setConfirmDisconnectOpen] = useState(false);
  const [revealOpen, setRevealOpen] = useState(false);
  const [revealPasswordInput, setRevealPasswordInput] = useState("");
  const [revealedApiKey, setRevealedApiKey] = useState("");
  const [revealing, setRevealing] = useState(false);
  const [record, setRecord] = useState(null);
  const [form, setForm] = useState({
    whatsappNumber: "",
    apiKey: "",
  });
  const { canAdd, canUpdate, canDelete } = useSettingsCrudPermissions();

  useEffect(() => {
    if (!adminInfo?.id) return;
    const fromUrl = new URLSearchParams(location.search).get("selectedOrg");
    const sessionId = sessionStorage.getItem("settingsSelectedOrg");
    const id = fromUrl || sessionId || "";
    if (id) {
      setBusinessId(id);
      sessionStorage.setItem("settingsSelectedOrg", id);
      const want = `?selectedOrg=${encodeURIComponent(id)}`;
      if (location.search !== want) {
        history.replace({ pathname: location.pathname, search: want });
      }
    }
  }, [adminInfo?.id, location.search, location.pathname, history]);

  const fetchRecord = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    setRecordReady(false);
    try {
      const res = await WhatsAppIntegrationServices.getByBusinessId(businessId);
      const row = res?.data || null;
      setRecord(row);
      setRevealedApiKey("");
      setForm({
        whatsappNumber: row?.whatsappNumber
          ? formatWhatsappDisplay(row.whatsappNumber, "MY")
          : "",
        apiKey: "",
      });
    } catch (err) {
      console.error("[WhatsApp] load failed:", err?.message || err);
      setRecord(null);
    } finally {
      setLoading(false);
      setRecordReady(true);
    }
  }, [businessId]);

  useEffect(() => {
    if (!businessId) return;
    fetchRecord();
  }, [businessId, fetchRecord]);

  const isConnected =
    !!record && record.isConnected !== false && !!record.hasApiKey;

  const handleConnect = async (e) => {
    e?.preventDefault?.();
    const allowSave = record?.hasApiKey ? canUpdate : canAdd;
    if (!allowSave) {
      notifyError(
        record?.hasApiKey
          ? t(
            "accountsSettings.whatsappIntegration.errors.noPermissionUpdate",
            "You do not have permission to update WhatsApp settings.",
          )
          : t(
            "accountsSettings.whatsappIntegration.errors.noPermissionConnect",
            "You do not have permission to connect WhatsApp.",
          ),
      );
      return;
    }
    if (!businessId)
      return notifyError(
        t("accountsSettings.whatsappIntegration.errors.selectBusinessFirst", "Select a business first"),
      );
    const phone = String(form.whatsappNumber ?? "").trim();
    const key = String(form.apiKey ?? "").trim();
    if (!phone)
      return notifyError(
        t("accountsSettings.whatsappIntegration.errors.numberRequired", "WhatsApp number is required"),
      );
    if (!record?.hasApiKey && !key) {
      return notifyError(
        t("accountsSettings.whatsappIntegration.errors.apiKeyRequired", "API key is required"),
      );
    }

    setSaving(true);
    try {
      const res = await WhatsAppIntegrationServices.saveDetails({
        business_id: businessId,
        whatsappNumber: phone,
        apiKey: key || undefined,
      });
      if (res?.status === false) {
        notifyError(
          res?.message ||
          t("accountsSettings.whatsappIntegration.errors.connectFailed", "Failed to connect"),
        );
      } else {
        notifySuccess(t("accountsSettings.whatsappIntegration.success.connected", "WhatsApp connected."));
        setForm((f) => ({ ...f, apiKey: "" }));
        setRevealedApiKey("");
        await fetchRecord();
      }
    } catch (err) {
      notifyError(
        err?.response?.data?.message ||
        err?.message ||
        t("accountsSettings.whatsappIntegration.errors.connectFailed", "Failed to connect"),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!canUpdate) {
      notifyError(
        t(
          "accountsSettings.whatsappIntegration.errors.noPermissionUpdate",
          "You do not have permission to update WhatsApp settings.",
        ),
      );
      return;
    }
    if (!businessId) return;
    if (!record?.hasApiKey) {
      return notifyError(
        t(
          "accountsSettings.whatsappIntegration.errors.saveApiKeyFirst",
          "Save API key and WhatsApp number first",
        ),
      );
    }
    setTesting(true);
    try {
      const res = await WhatsAppIntegrationServices.testConnection(businessId);
      if (res?.status) {
        notifySuccess(
          res?.message ||
          t("accountsSettings.whatsappIntegration.success.testSent", "Test message sent."),
        );
      } else {
        notifyError(
          res?.message ||
          t("accountsSettings.whatsappIntegration.errors.testFailed", "Connection test failed"),
        );
      }
      await fetchRecord();
    } catch (err) {
      notifyError(
        err?.response?.data?.message ||
        err?.message ||
        t("accountsSettings.whatsappIntegration.errors.testFailed", "Connection test failed"),
      );
      await fetchRecord();
    } finally {
      setTesting(false);
    }
  };

  const handleRevealApiKey = async () => {
    if (!revealPasswordInput) {
      return notifyError(
        t(
          "accountsSettings.whatsappIntegration.errors.passwordRequired",
          "Enter your account password to reveal the API key",
        ),
      );
    }
    setRevealing(true);
    try {
      const res = await WhatsAppIntegrationServices.revealApiKey(
        businessId,
        revealPasswordInput,
      );
      if (res?.status && res?.data?.apiKey) {
        setRevealedApiKey(res.data.apiKey);
        setForm((f) => ({ ...f, apiKey: res.data.apiKey }));
        notifySuccess(t("accountsSettings.whatsappIntegration.success.apiKeyRevealed", "API key revealed."));
      } else {
        notifyError(
          res?.message ||
          t("accountsSettings.whatsappIntegration.errors.verifyFailed", "Could not verify password"),
        );
      }
    } catch (err) {
      notifyError(
        err?.response?.data?.message ||
        err?.message ||
        t("accountsSettings.whatsappIntegration.errors.verifyFailed", "Could not verify password"),
      );
    } finally {
      setRevealing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!canDelete) {
      notifyError(
        t(
          "accountsSettings.whatsappIntegration.errors.noPermissionDisconnect",
          "You do not have permission to disconnect WhatsApp.",
        ),
      );
      return;
    }
    setDisconnecting(true);
    try {
      const res = await WhatsAppIntegrationServices.disconnect(businessId);
      if (res?.status) {
        notifySuccess(
          t(
            "accountsSettings.whatsappIntegration.success.disconnected",
            "WhatsApp disconnected for this business.",
          ),
        );
        setConfirmDisconnectOpen(false);
        await fetchRecord();
      } else {
        notifyError(
          res?.message ||
          t("accountsSettings.whatsappIntegration.errors.disconnectFailed", "Failed to disconnect"),
        );
      }
    } catch (err) {
      notifyError(
        err?.response?.data?.message ||
        err?.message ||
        t("accountsSettings.whatsappIntegration.errors.disconnectFailed", "Failed to disconnect"),
      );
    } finally {
      setDisconnecting(false);
    }
  };

  const settingsQuery = businessId
    ? `?selectedOrg=${encodeURIComponent(businessId)}`
    : "";

  const shouldShowLoading = !!businessId && !recordReady;

  return (
    <div className="p-6 bg-white h-full max-h-[90vh] overflow-y-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-emerald-600" />
            {t("accountsSettings.whatsappIntegration.title", "WhatsApp Integration")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t(
              "accountsSettings.whatsappIntegration.subtitle",
              "Credentials used for sending broadcast messages.",
            )}
          </p>
        </div>
        <Link
          to={`/Settings${settingsQuery}`}
          className="text-sm text-[var(--p-blue)] font-medium hover:underline"
        >
          {t("accountsSettings.whatsappIntegration.backToSettings", "← Back to All Settings")}
        </Link>
      </div>

      <SettingsOrgBanner />

      {!businessId ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-600">
          {t(
            "accountsSettings.whatsappIntegration.selectBusinessPrompt",
            "Select a business from All Settings, then open WhatsApp Integration again.",
          )}
        </div>
      ) : shouldShowLoading ? (
        <div className="rounded-lg border border-gray-200 p-10 flex justify-center">
          <Loader />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill connected={isConnected} />
            {record?.lastTestedAt ? (
              <span className="text-xs text-gray-500">
                {t("accountsSettings.whatsappIntegration.lastTested", {
                  defaultValue: "Last tested: {{datetime}}",
                  datetime: formatDateTime(record.lastTestedAt),
                })}
              </span>
            ) : null}
            {canUpdate && record?.hasApiKey ? (
              <button
                type="button"
                onClick={handleTest}
                disabled={testing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                <Plug className="w-3.5 h-3.5" />
                {testing
                  ? t("accountsSettings.whatsappIntegration.sendingTest", "Sending test…")
                  : t("accountsSettings.whatsappIntegration.testConnection", "Test connection")}
              </button>
            ) : null}
          </div>

          <SectionCard
            title={t("accountsSettings.whatsappIntegration.credentialsTitle", "WhatsApp credentials")}
            description={t(
              "accountsSettings.whatsappIntegration.credentialsDescription",
              "Campaigns send through this integration.",
            )}
            icon={KeyRound}
          >
            <form
              onSubmit={handleConnect}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t("accountsSettings.whatsappIntegration.whatsappNumberLabel", "WhatsApp number *")}
                </label>
                <input
                  type="tel"
                  className="border border-gray-300 rounded-lg p-2 w-full"
                  value={form.whatsappNumber}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, whatsappNumber: e.target.value }))
                  }
                  placeholder={t(
                    "accountsSettings.whatsappIntegration.whatsappNumberPlaceholder",
                    "+60 12 345 6789",
                  )}
                  autoComplete="off"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {t("accountsSettings.whatsappIntegration.whatsappNumberHelp", "Your registered sender number.")}
                </p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t("accountsSettings.whatsappIntegration.apiKeyLabel", "API key *")}
                </label>
                {record?.hasApiKey && !form.apiKey && !revealedApiKey ? (
                  <div className="flex gap-2">
                    <input
                      type="password"
                      readOnly
                      className="border border-gray-300 rounded-lg p-2 w-full font-mono text-sm bg-gray-50 text-gray-500"
                      value="••••••••••••••••••••••••"
                      tabIndex={-1}
                    />
                  </div>
                ) : (
                  <input
                    type="password"
                    className="border border-gray-300 rounded-lg p-2 w-full font-mono text-sm"
                    value={form.apiKey}
                    onChange={(e) => {
                      setRevealedApiKey("");
                      setForm((f) => ({ ...f, apiKey: e.target.value }));
                    }}
                    placeholder={t(
                      "accountsSettings.whatsappIntegration.apiKeyPlaceholder",
                      "Paste API key here...",
                    )}
                    autoComplete="new-password"
                  />
                )}
                {record?.hasApiKey ? (
                  <button
                    type="button"
                    onClick={() => {
                      setRevealOpen(true);
                      setRevealPasswordInput("");
                      setRevealedApiKey("");
                    }}
                    className="text-xs text-[var(--p-blue)] mt-1 hover:underline"
                  >
                    {t("accountsSettings.whatsappIntegration.revealSavedApiKey", "Reveal saved API key")}
                  </button>
                ) : null}
              </div>

              {record?.lastTestError ? (
                <div className="md:col-span-2 text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                  {t("accountsSettings.whatsappIntegration.lastTestErrorPrefix", {
                    defaultValue: "Last test error: {{error}}",
                    error: record.lastTestError,
                  })}
                </div>
              ) : null}

              <div className="md:col-span-2 flex flex-wrap items-center gap-3 pt-2">
                {!isConnected && (record?.hasApiKey ? canUpdate : canAdd) ? (
                  <button
                    type="submit"
                    disabled={saving || loading}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--p-blue)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
                  >
                    <Plug className="w-4 h-4" />
                    {saving
                      ? t("accountsSettings.whatsappIntegration.connecting", "Connecting…")
                      : t("accountsSettings.whatsappIntegration.connect", "Connect")}
                  </button>
                ) : null}
                {isConnected && canDelete ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDisconnectOpen(true)}
                    disabled={disconnecting}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg hover:bg-rose-100"
                  >
                    <PlugZap className="w-4 h-4" />
                    {t("accountsSettings.whatsappIntegration.disconnect", "Disconnect")}
                  </button>
                ) : null}
              </div>
            </form>
          </SectionCard>
        </div>
      )}

      <CustomModal
        open={confirmDisconnectOpen}
        onClose={() => setConfirmDisconnectOpen(false)}
        title={t("accountsSettings.whatsappIntegration.disconnectModal.title", "Disconnect WhatsApp?")}
        width="440px"
        showActions
        actions={[
          {
            label: t("accountsSettings.whatsappIntegration.disconnectModal.cancel", "Cancel"),
            secondary: true,
            onClick: () => setConfirmDisconnectOpen(false),
          },
          {
            label: disconnecting
              ? t("accountsSettings.whatsappIntegration.disconnecting", "Disconnecting…")
              : t("accountsSettings.whatsappIntegration.disconnect", "Disconnect"),
            primary: true,
            onClick: handleDisconnect,
            disabled: disconnecting,
            style: { backgroundColor: "#dc2626", borderColor: "#dc2626" },
          },
        ]}
      >
        <p className="text-sm text-gray-600">
          {t(
            "accountsSettings.whatsappIntegration.disconnectModal.body",
            "WhatsApp sends for this business will stop until you save new credentials. The saved API key remains stored but marked disconnected.",
          )}
        </p>
      </CustomModal>

      <CustomModal
        open={revealOpen}
        onClose={() => !revealing && setRevealOpen(false)}
        title={t("accountsSettings.whatsappIntegration.revealModal.title", "Reveal saved API key")}
        width="440px"
        showActions
        actions={[
          {
            label: t("accountsSettings.whatsappIntegration.revealModal.close", "Close"),
            secondary: true,
            onClick: () => setRevealOpen(false),
            disabled: revealing,
          },
          {
            label: revealing
              ? t("accountsSettings.whatsappIntegration.revealModal.verifying", "Verifying…")
              : t("accountsSettings.whatsappIntegration.revealModal.reveal", "Reveal"),
            primary: true,
            onClick: handleRevealApiKey,
            disabled: revealing,
          },
        ]}
      >
        <p className="text-sm text-gray-700 mb-3">
          {t(
            "accountsSettings.whatsappIntegration.revealModal.body",
            "For your security, re-enter your PCI login password to view the saved WhatsApp API key.",
          )}
        </p>
        <input
          type="password"
          autoFocus
          className="border border-gray-300 rounded-lg p-2 w-full"
          value={revealPasswordInput}
          onChange={(e) => setRevealPasswordInput(e.target.value)}
          placeholder={t(
            "accountsSettings.whatsappIntegration.revealModal.passwordPlaceholder",
            "Your login password",
          )}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleRevealApiKey();
            }
          }}
        />
        {revealedApiKey ? (
          <div className="mt-3 p-3 rounded-lg border border-emerald-200 bg-emerald-50 text-sm break-all">
            <span className="text-emerald-700 font-medium">
              {t("accountsSettings.whatsappIntegration.revealModal.apiKeyLabel", "API key:")}
            </span>{" "}
            <code className="font-mono">{revealedApiKey}</code>
          </div>
        ) : null}
      </CustomModal>
    </div>
  );
};

const WhatsAppIntegrationSettingsPage = () => (
  <AppLayout>
    <Header />
    <WhatsAppIntegrationSettingsContent />
  </AppLayout>
);

export default WhatsAppIntegrationSettingsPage;
