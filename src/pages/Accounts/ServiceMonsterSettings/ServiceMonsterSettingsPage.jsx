import React, { useState, useEffect, useContext, useCallback } from "react";
import { Link, useLocation, useHistory } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";
import {
  Eye,
  EyeOff,
  CircleHelp,
  BookOpenText,
  KeyRound,
  Plug,
  PlugZap,
  RefreshCcw,
  Users,
  FileText,
  Wallet,
  Package,
  ShieldCheck,
  Webhook,
  AlertTriangle,
  CheckCircle2,
  Trash2,
} from "lucide-react";

import Header from "@/components/header/Header";
import AppLayout from "@/pages/Settings/app-layout";
import SettingsOrgBanner from "@/pages/Settings/SettingsOrgBanner";
import { CustomModal, Loader } from "@/page-layouts";
import { AdminContext } from "@/context/AdminContext";
import { notifyError, notifySuccess } from "@/utils/toast";
import ServiceMonsterServices from "@/services/ServiceMonsterServices";
import { useSettingsCrudPermissions } from "@/hooks/useSettingsCrudPermissions";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

/**
 * Settings → Integrations → ServiceMonster Integration
 * ─────────────────────────────────────────────────
 * Per-business connection screen. Mirrors the InvoisPls implementation but
 * scoped to the Settings app shell (sidebar, org banner, "Back to All
 * Settings" header) used by the rest of PCI's Accounts settings.
 */

const TODAY_ISO = () => new Date().toISOString().split("T")[0];

const SectionCard = ({
  title,
  description,
  icon: Icon,
  headerAction,
  children,
  footer,
}) => (
  <div className="w-full bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-4">
    <div className="flex items-start gap-3 border-b border-gray-200 dark:border-gray-600 pb-3">
      {Icon ? (
        <span className="p-2 rounded-lg bg-blue-50 text-blue-600">
          <Icon className="w-5 h-5" />
        </span>
      ) : null}
      <div className="flex-1">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          {title}
        </h3>
        {description ? (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {description}
          </p>
        ) : null}
      </div>
      {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
    </div>
    <div>{children}</div>
    {footer ? <div className="pt-2">{footer}</div> : null}
  </div>
);

const StatusPill = ({ connected }) => {
  const { t } = useTranslation();
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
        connected
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
        ? t("accountsSettings.serviceMonster.connected", "Connected")
        : t("accountsSettings.serviceMonster.notConnected", "Not connected")}
    </span>
  );
};

const formatDateTime = (t, val) => {
  if (!val) return t("accountsSettings.serviceMonster.noDateValue", "—");
  try {
    return new Date(val).toLocaleString();
  } catch {
    return String(val);
  }
};

// Maps each sync target to the translation key + English fallback used for
// lowercase, plural-ish labels (e.g. inside error messages).
const SYNC_LABEL_INFO = {
  customers: { key: "customers", fallback: "customers" },
  orders: { key: "invoices", fallback: "invoices" },
  payments: { key: "payments", fallback: "payments" },
  items: { key: "items", fallback: "items" },
};

const SYNC_TILE_LABEL_FALLBACKS = {
  customers: "Customers",
  orders: "Invoices",
  payments: "Payments",
  items: "Items",
};

const getSyncLabel = (t, target) => {
  const info = SYNC_LABEL_INFO[target] || { key: "records", fallback: "records" };
  return t(`accountsSettings.serviceMonster.syncLabels.${info.key}`, info.fallback);
};

const getSyncTileLabel = (t, target) => {
  const fallback = SYNC_TILE_LABEL_FALLBACKS[target] || target;
  return t(`accountsSettings.serviceMonster.sync.tiles.${target}.label`, fallback);
};

const getFriendlySyncErrorMessage = (t, target, rawMessage) => {
  const label = getSyncLabel(t, target);
  const fallback = t(
    "accountsSettings.serviceMonster.errors.syncFailed",
    "Could not sync {{label}}. Please try again in a moment.",
    { label }
  );
  if (!rawMessage || typeof rawMessage !== "string") return fallback;

  const normalized = rawMessage.toLowerCase();
  if (normalized.includes("requiresstartdate") || normalized.includes("start date")) {
    return t(
      "accountsSettings.serviceMonster.errors.startDateRequired",
      "Please choose a start date before syncing {{label}}.",
      { label }
    );
  }
  if (normalized.includes("unauthorized") || normalized.includes("invalid credentials")) {
    return t(
      "accountsSettings.serviceMonster.errors.invalidCredentials",
      "ServiceMonster credentials look invalid. Please recheck username and password."
    );
  }
  if (normalized.includes("forbidden") || normalized.includes("permission")) {
    return t(
      "accountsSettings.serviceMonster.errors.noPermissionSync",
      "You do not have permission to sync this data from ServiceMonster."
    );
  }
  if (
    normalized.includes("network") ||
    normalized.includes("timeout") ||
    normalized.includes("econn") ||
    normalized.includes("socket hang up")
  ) {
    return t(
      "accountsSettings.serviceMonster.errors.timeout",
      "ServiceMonster is taking too long to respond. Please try again shortly."
    );
  }
  if (normalized.includes("not found")) {
    return t(
      "accountsSettings.serviceMonster.errors.notFound",
      "Could not find matching {{label}} data to sync.",
      { label }
    );
  }

  return fallback;
};

const ServiceMonsterSettingsContent = () => {
  const { t } = useTranslation();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const location = useLocation();
  const history = useHistory();

  const [businesses, setBusinesses] = useState([]);
  const [businessId, setBusinessId] = useState("");
  const [businessesLoading, setBusinessesLoading] = useState(false);
  const [recordReady, setRecordReady] = useState(false);

  // Form / record state
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [credentials, setCredentials] = useState({ username: "", password: "" });
  const [record, setRecord] = useState(null);

  // Sync state
  const [syncing, setSyncing] = useState({
    customers: false,
    orders: false,
    payments: false,
    items: false,
  });
  const [startDateModal, setStartDateModal] = useState({
    open: false,
    target: null, // "customers" | "orders" | "payments" | "items"
    date: TODAY_ISO(),
  });

  // Webhook state
  const [webhookStatus, setWebhookStatus] = useState(null);
  const [webhookBusy, setWebhookBusy] = useState(false);
  const [webhookLogs, setWebhookLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Disconnect modal
  const [confirmDisconnectOpen, setConfirmDisconnectOpen] = useState(false);

  // Reveal password modal
  const [revealOpen, setRevealOpen] = useState(false);
  const [revealPasswordInput, setRevealPasswordInput] = useState("");
  const [revealedPassword, setRevealedPassword] = useState("");
  const [revealing, setRevealing] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const { canAdd, canUpdate, canDelete } = useSettingsCrudPermissions();

  // ── Load assigned businesses
  useEffect(() => {
    if (!adminInfo?.id) return;
    setBusinessesLoading(true);
    axios
      .get(`${Base_URL}/admin/assigned/${adminInfo.id}`, {
        headers: { authorization: `Bearer ${adminInfo?.token}` },
      })
      .then((res) =>
        setBusinesses(Array.isArray(res.data?.businesses) ? res.data.businesses : [])
      )
      .catch(() => setBusinesses([]))
      .finally(() => setBusinessesLoading(false));
  }, [adminInfo?.id, adminInfo?.token]);

  // ── Pick the active business (URL > sessionStorage > first)
  useEffect(() => {
    if (!businesses.length) return;
    const fromUrl = new URLSearchParams(location.search).get("selectedOrg");
    if (fromUrl && businesses.some((b) => String(b._id) === fromUrl)) {
      setBusinessId(fromUrl);
      sessionStorage.setItem("settingsSelectedOrg", fromUrl);
      return;
    }
    const sessionId = sessionStorage.getItem("settingsSelectedOrg");
    const id =
      sessionId && businesses.some((b) => String(b._id) === sessionId)
        ? sessionId
        : String(businesses[0]._id);
    setBusinessId(id);
    sessionStorage.setItem("settingsSelectedOrg", id);
    const next = new URLSearchParams({ selectedOrg: id });
    const want = `?${next.toString()}`;
    if (location.search !== want) {
      history.replace({ pathname: location.pathname, search: want });
    }
  }, [businesses, location.search, location.pathname, history]);

  const fetchRecord = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    setRecordReady(false);
    try {
      const res = await ServiceMonsterServices.getByBusinessId(businessId);
      const row = Array.isArray(res?.data) && res.data.length ? res.data[0] : null;
      setRecord(row);
      setCredentials({
        username: row?.username || "",
        password: "", // never received from API
      });
    } catch (err) {
      console.error("[ServiceMonster] load record failed:", err?.message || err);
      setRecord(null);
    } finally {
      setLoading(false);
      setRecordReady(true);
    }
  }, [businessId]);

  const fetchWebhookStatus = useCallback(async () => {
    if (!businessId) return;
    try {
      const res = await ServiceMonsterServices.getWebhookStatus(businessId);
      setWebhookStatus(res?.data || null);
    } catch (err) {
      console.warn("[ServiceMonster] webhook status:", err?.message || err);
      setWebhookStatus(null);
    }
  }, [businessId]);

  const fetchWebhookLogs = useCallback(async () => {
    if (!businessId) return;
    setLogsLoading(true);
    try {
      const res = await ServiceMonsterServices.getWebhookLogs(businessId, 50);
      const logs = res?.data?.logs || [];
      setWebhookLogs(logs);
    } catch (err) {
      console.warn("[ServiceMonster] webhook logs:", err?.message || err);
      setWebhookLogs([]);
    } finally {
      setLogsLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    if (!businessId) return;
    fetchRecord();
    fetchWebhookStatus();
    fetchWebhookLogs();
  }, [businessId, fetchRecord, fetchWebhookStatus, fetchWebhookLogs]);

  const isConnected = !!record && record.isConnected !== false && !!record.basicToken;

  // ── Save credentials
  const handleSave = async (e) => {
    e?.preventDefault?.();
    const allowSave = record?.username ? canUpdate : canAdd;
    if (!allowSave) {
      notifyError(
        record?.username
          ? t(
              "accountsSettings.serviceMonster.errors.noPermissionUpdate",
              "You do not have permission to update ServiceMonster settings."
            )
          : t(
              "accountsSettings.serviceMonster.errors.noPermissionConnect",
              "You do not have permission to connect ServiceMonster."
            ),
      );
      return;
    }
    if (!businessId)
      return notifyError(
        t("accountsSettings.serviceMonster.errors.selectBusiness", "Select a business first")
      );
    if (!credentials.username || !credentials.password) {
      return notifyError(
        t(
          "accountsSettings.serviceMonster.errors.usernamePasswordRequired",
          "Username and password are required"
        )
      );
    }
    setSaving(true);
    try {
      const res = await ServiceMonsterServices.saveDetails({
        business_id: businessId,
        username: credentials.username,
        password: credentials.password,
      });
      if (res?.status === false) {
        notifyError(
          res?.message ||
            t("accountsSettings.serviceMonster.errors.saveFailed", "Failed to save")
        );
      } else {
        notifySuccess(
          t(
            "accountsSettings.serviceMonster.success.credentialsSaved",
            "ServiceMonster credentials saved."
          )
        );
        await fetchRecord();
        await fetchWebhookStatus();
      }
    } catch (err) {
      notifyError(
        err?.response?.data?.message ||
          err?.message ||
          t("accountsSettings.serviceMonster.errors.saveFailed", "Failed to save")
      );
    } finally {
      setSaving(false);
    }
  };

  // ── Test connection (also marks record as connected on success)
  const handleTest = async () => {
    if (!canUpdate) {
      notifyError(
        t(
          "accountsSettings.serviceMonster.errors.noPermissionUpdate",
          "You do not have permission to update ServiceMonster settings."
        )
      );
      return;
    }
    if (!businessId) return;
    if (!record) {
      return notifyError(
        t("accountsSettings.serviceMonster.errors.saveCredentialsFirst", "Save credentials first")
      );
    }
    setTesting(true);
    try {
      const res = await ServiceMonsterServices.testConnection(businessId);
      if (res?.status) {
        notifySuccess(
          res?.message ||
            t("accountsSettings.serviceMonster.success.connectionSuccess", "Connection successful!")
        );
        await fetchRecord();
      } else {
        notifyError(
          res?.message ||
            t("accountsSettings.serviceMonster.errors.connectionFailed", "Connection failed")
        );
      }
    } catch (err) {
      notifyError(
        err?.response?.data?.message ||
          err?.message ||
          t("accountsSettings.serviceMonster.errors.connectionFailed", "Connection failed")
      );
    } finally {
      setTesting(false);
    }
  };

  // ── Disconnect (soft-disable)
  const handleDisconnect = async () => {
    if (!canDelete) {
      notifyError(
        t(
          "accountsSettings.serviceMonster.errors.noPermissionDisconnect",
          "You do not have permission to disconnect ServiceMonster."
        )
      );
      return;
    }
    setDisconnecting(true);
    try {
      const res = await ServiceMonsterServices.disconnect(businessId);
      if (res?.status) {
        notifySuccess(
          t("accountsSettings.serviceMonster.success.disconnected", "ServiceMonster disconnected.")
        );
        setConfirmDisconnectOpen(false);
        await fetchRecord();
        await fetchWebhookStatus();
      } else {
        notifyError(
          res?.message ||
            t("accountsSettings.serviceMonster.errors.disconnectFailed", "Failed to disconnect")
        );
      }
    } catch (err) {
      notifyError(
        err?.response?.data?.message ||
          err?.message ||
          t("accountsSettings.serviceMonster.errors.disconnectFailed", "Failed to disconnect")
      );
    } finally {
      setDisconnecting(false);
    }
  };

  // ── Reveal password
  const handleRevealPassword = async () => {
    if (!revealPasswordInput) {
      return notifyError(
        t(
          "accountsSettings.serviceMonster.errors.enterPasswordToReveal",
          "Enter your account password to reveal"
        )
      );
    }
    setRevealing(true);
    try {
      const res = await ServiceMonsterServices.revealPassword(
        businessId,
        revealPasswordInput
      );
      if (res?.status && res?.data?.password) {
        setRevealedPassword(res.data.password);
        setCredentials((prev) => ({ ...prev, password: res.data.password }));
        notifySuccess(
          t("accountsSettings.serviceMonster.success.passwordRevealed", "Password revealed.")
        );
      } else {
        notifyError(
          res?.message ||
            t("accountsSettings.serviceMonster.errors.couldNotVerifyPassword", "Could not verify password")
        );
      }
    } catch (err) {
      notifyError(
        err?.response?.data?.message ||
          err?.message ||
          t("accountsSettings.serviceMonster.errors.couldNotVerifyPassword", "Could not verify password")
      );
    } finally {
      setRevealing(false);
    }
  };

  // ── Sync helper (handles first-time → date picker flow)
  const runSync = async (target, providedDate) => {
    if (!canUpdate) {
      notifyError(
        t(
          "accountsSettings.serviceMonster.errors.noPermissionSyncData",
          "You do not have permission to sync ServiceMonster data."
        )
      );
      return;
    }
    setSyncing((s) => ({ ...s, [target]: true }));
    try {
      const fn = {
        customers: ServiceMonsterServices.syncCustomers,
        orders: ServiceMonsterServices.syncOrders,
        payments: ServiceMonsterServices.syncPayments,
        items: ServiceMonsterServices.syncItems,
      }[target];
      const res = await fn(businessId, providedDate || null);
      if (res?.status === false) {
        if (res?.requiresStartDate) {
          setStartDateModal({ open: true, target, date: providedDate || TODAY_ISO() });
          notifyError(
            t(
              "accountsSettings.serviceMonster.errors.startDateRequiredGeneric",
              "Please choose a start date to begin first-time sync."
            )
          );
        } else {
          notifyError(getFriendlySyncErrorMessage(t, target, res?.message));
        }
      } else {
        const counts = res?.data || {};
        const formatSummaryValue = (key, value) => {
          if (Array.isArray(value)) {
            if (!value.length) return null;
            if (key === "failures") {
              const reasons = value
                .slice(0, 3)
                .map((item) => item?.reason || item?.message || String(item))
                .join("; ");
              return `${key}: ${value.length}${reasons ? ` (${reasons})` : ""}`;
            }
            return `${key}: ${value.length}`;
          }
          if (value && typeof value === "object") return null;
          return `${key}: ${value}`;
        };
        const summary = Object.entries(counts)
          .filter(([k]) => k !== "total")
          .map(([k, v]) => formatSummaryValue(k, v))
          .filter(Boolean)
          .join(", ");
        notifySuccess(
          t(
            "accountsSettings.serviceMonster.success.syncSummary",
            "{{target}} synced. {{summary}} (total: {{total}})",
            {
              target: getSyncTileLabel(t, target),
              summary,
              total: counts.total ?? t("accountsSettings.serviceMonster.noDateValue", "—"),
            }
          )
        );
        await fetchRecord();
        if (target === "orders" || target === "payments") {
          await fetchWebhookLogs();
        }
      }
    } catch (err) {
      const data = err?.response?.data;
      if (data?.requiresStartDate) {
        setStartDateModal({ open: true, target, date: providedDate || TODAY_ISO() });
      }
      notifyError(getFriendlySyncErrorMessage(t, target, data?.message || err?.message));
    } finally {
      setSyncing((s) => ({ ...s, [target]: false }));
    }
  };

  const submitStartDateModal = async () => {
    const { target, date } = startDateModal;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return notifyError(
        t("accountsSettings.serviceMonster.errors.invalidDateFormat", "Please use YYYY-MM-DD format")
      );
    }
    setStartDateModal({ open: false, target: null, date: TODAY_ISO() });
    await runSync(target, date);
  };

  // ── Webhook actions
  const handleSubscribeAll = async () => {
    if (!canUpdate) {
      notifyError(
        t(
          "accountsSettings.serviceMonster.errors.noPermissionWebhookUpdate",
          "You do not have permission to update ServiceMonster webhooks."
        )
      );
      return;
    }
    setWebhookBusy(true);
    try {
      const res = await ServiceMonsterServices.subscribeAllWebhooks(businessId);
      if (res?.status) {
        notifySuccess(
          res?.message ||
            t("accountsSettings.serviceMonster.success.webhooksSubscribed", "Webhooks subscribed.")
        );
        await fetchWebhookStatus();
        await fetchWebhookLogs();
      } else {
        notifyError(
          res?.message ||
            t("accountsSettings.serviceMonster.errors.subscribeFailed", "Failed to subscribe webhooks")
        );
      }
    } catch (err) {
      notifyError(
        err?.response?.data?.message ||
          err?.message ||
          t("accountsSettings.serviceMonster.errors.subscribeFailed", "Failed to subscribe webhooks")
      );
    } finally {
      setWebhookBusy(false);
    }
  };

  const handleUnsubscribeAll = async () => {
    if (!canUpdate) {
      notifyError(
        t(
          "accountsSettings.serviceMonster.errors.noPermissionWebhookUpdate",
          "You do not have permission to update ServiceMonster webhooks."
        )
      );
      return;
    }
    setWebhookBusy(true);
    try {
      const res = await ServiceMonsterServices.unsubscribeAllWebhooks(businessId);
      if (res?.status) {
        notifySuccess(
          res?.message ||
            t("accountsSettings.serviceMonster.success.webhooksUnsubscribed", "Webhooks unsubscribed.")
        );
        await fetchWebhookStatus();
        await fetchWebhookLogs();
      } else {
        notifyError(
          res?.message ||
            t("accountsSettings.serviceMonster.errors.unsubscribeFailed", "Failed to unsubscribe webhooks")
        );
      }
    } catch (err) {
      notifyError(
        err?.response?.data?.message ||
          err?.message ||
          t("accountsSettings.serviceMonster.errors.unsubscribeFailed", "Failed to unsubscribe webhooks")
      );
    } finally {
      setWebhookBusy(false);
    }
  };

  const handleClearLogs = async () => {
    if (!canDelete) {
      notifyError(
        t(
          "accountsSettings.serviceMonster.errors.noPermissionClearLogs",
          "You do not have permission to clear webhook logs."
        )
      );
      return;
    }
    try {
      await ServiceMonsterServices.clearWebhookLogs(businessId);
      notifySuccess(
        t("accountsSettings.serviceMonster.success.logsCleared", "Webhook logs cleared.")
      );
      await fetchWebhookLogs();
    } catch (err) {
      notifyError(
        err?.response?.data?.message ||
          err?.message ||
          t("accountsSettings.serviceMonster.errors.clearLogsFailed", "Failed to clear logs")
      );
    }
  };

  const settingsQuery = businessId
    ? `?selectedOrg=${encodeURIComponent(businessId)}`
    : "";

  const syncTiles = [
    {
      key: "customers",
      label: t("accountsSettings.serviceMonster.sync.tiles.customers.label", "Customers"),
      description: t(
        "accountsSettings.serviceMonster.sync.tiles.customers.description",
        "Pulls ServiceMonster Accounts into PCI Customers."
      ),
      icon: Users,
      lastFetched: record?.lastFetchedCustomers,
    },
    {
      key: "orders",
      label: t("accountsSettings.serviceMonster.sync.tiles.orders.label", "Invoices"),
      description: t(
        "accountsSettings.serviceMonster.sync.tiles.orders.description",
        "Pulls Orders of type Invoice into PCI invoices (skips Work Orders)."
      ),
      icon: FileText,
      lastFetched: record?.lastFetchedOrders,
    },
    {
      key: "payments",
      label: t("accountsSettings.serviceMonster.sync.tiles.payments.label", "Payments"),
      description: t(
        "accountsSettings.serviceMonster.sync.tiles.payments.description",
        "Attaches ServiceMonster payments to matching PCI invoices."
      ),
      icon: Wallet,
      lastFetched: record?.lastFetchedPayments,
    },
    {
      key: "items",
      label: t("accountsSettings.serviceMonster.sync.tiles.items.label", "Items"),
      description: t(
        "accountsSettings.serviceMonster.sync.tiles.items.description",
        "Pulls catalog items / order items into PCI Items."
      ),
      icon: Package,
      lastFetched: record?.lastFetchedItems,
    },
  ];

  const shouldShowInitialLoading = businessesLoading || (!!businessId && !recordReady);

  return (
    <div className="p-6 bg-white h-full max-h-[90vh] overflow-y-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {t("accountsSettings.serviceMonster.title", "ServiceMonster Integration")}
          </h1>
        </div>
        <Link
          to={`/Settings${settingsQuery}`}
          className="text-sm text-[var(--p-blue)] font-medium hover:underline"
        >
          {t("accountsSettings.serviceMonster.backToSettings", "← Back to All Settings")}
        </Link>
      </div>

      <SettingsOrgBanner />

      {shouldShowInitialLoading ? (
        <div className="rounded-lg border border-gray-200 bg-white p-10 flex justify-center">
          <Loader />
        </div>
      ) : !businessId ? null : (
        <div className="space-y-6">
          {/* ── Connection card ───────────────────────────────────────── */}
          <SectionCard
            title={t("accountsSettings.serviceMonster.connection.title", "Connection")}
            icon={KeyRound}
            headerAction={
              <button
                type="button"
                onClick={() => setHelpOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm hover:from-blue-100 hover:to-indigo-100 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <CircleHelp className="h-3.5 w-3.5" />
                {t("accountsSettings.serviceMonster.connection.needHelp", "Need help?")}
              </button>
            }
          >
            <form
              onSubmit={handleSave}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t(
                    "accountsSettings.serviceMonster.connection.usernameLabel",
                    "Username (ServiceMonster login email)"
                  )}
                </label>
                <input
                  type="text"
                  className="border border-gray-300 rounded-lg p-2 w-full"
                  value={credentials.username}
                  onChange={(e) =>
                    setCredentials((c) => ({ ...c, username: e.target.value }))
                  }
                  placeholder={t(
                    "accountsSettings.serviceMonster.connection.usernamePlaceholder",
                    "user@example.com"
                  )}
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t("accountsSettings.serviceMonster.connection.passwordLabel", "Password")}
                </label>
                <div className="flex gap-2">
                  <input
                    type={showPassword ? "text" : "password"}
                    className="border border-gray-300 rounded-lg p-2 w-full"
                    value={credentials.password}
                    onChange={(e) =>
                      setCredentials((c) => ({ ...c, password: e.target.value }))
                    }
                    placeholder={
                      record?.username
                        ? t(
                            "accountsSettings.serviceMonster.connection.passwordPlaceholderExisting",
                            "Leave blank to keep saved password"
                          )
                        : t(
                            "accountsSettings.serviceMonster.connection.passwordPlaceholderNew",
                            "Password"
                          )
                    }
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="px-3 py-2 text-sm bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200"
                    title={
                      showPassword
                        ? t("accountsSettings.serviceMonster.connection.hidePassword", "Hide password")
                        : t("accountsSettings.serviceMonster.connection.showPassword", "Show password")
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {record?.username ? (
                  <button
                    type="button"
                    onClick={() => {
                      setRevealOpen(true);
                      setRevealPasswordInput("");
                      setRevealedPassword("");
                    }}
                    className="text-xs text-[var(--p-blue)] mt-1 hover:underline"
                  >
                    {t(
                      "accountsSettings.serviceMonster.connection.revealSavedPassword",
                      "Reveal saved password"
                    )}
                  </button>
                ) : null}
              </div>

              <div className="md:col-span-2 flex flex-wrap items-center gap-3 pt-2">
                {(record?.username ? canUpdate : canAdd) && (
                <button
                  type="submit"
                  disabled={saving || loading}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--p-blue)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
                >
                  <ShieldCheck className="w-4 h-4" />
                  {saving
                    ? t("accountsSettings.serviceMonster.connection.saving", "Saving…")
                    : t("accountsSettings.serviceMonster.connection.saveCredentials", "Save credentials")}
                </button>
                )}
                {canUpdate && (
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={testing || !record}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  <Plug className="w-4 h-4" />
                  {testing
                    ? t("accountsSettings.serviceMonster.connection.testing", "Testing…")
                    : t("accountsSettings.serviceMonster.connection.testConnection", "Test connection")}
                </button>
                )}
                {record && canDelete ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDisconnectOpen(true)}
                    disabled={disconnecting}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg hover:bg-rose-100"
                  >
                    <PlugZap className="w-4 h-4" />
                    {t("accountsSettings.serviceMonster.connection.disconnect", "Disconnect")}
                  </button>
                ) : null}
              </div>
            </form>
          </SectionCard>

          {isConnected ? (
            <>
              {/* ── Sync card ─────────────────────────────────────────────── */}
              <SectionCard
                title={t("accountsSettings.serviceMonster.sync.title", "Data sync")}
                description={t(
                  "accountsSettings.serviceMonster.sync.description",
                  "The first sync requires a start date so PCI knows from when to import. Subsequent syncs are incremental and only pull data changed since the last run."
                )}
                icon={RefreshCcw}
              >
                <div className="space-y-3">
                  {syncTiles.map((tile) => (
                    <div
                      key={tile.key}
                      className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <span className="p-2 rounded-md bg-blue-50 text-blue-600 mt-0.5 shrink-0">
                          <tile.icon className="w-5 h-5" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="font-semibold text-gray-900">{tile.label}</span>
                            <span className="text-xs text-gray-500">
                              {t("accountsSettings.serviceMonster.sync.last", "Last: {{datetime}}", {
                                datetime: formatDateTime(t, tile.lastFetched),
                              })}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{tile.description}</p>
                        </div>
                      </div>
                      {canUpdate && (
                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        <button
                          type="button"
                          onClick={() => runSync(tile.key)}
                          disabled={syncing[tile.key]}
                          className="text-xs px-3 py-1.5 rounded-md bg-[var(--p-blue)] text-white hover:opacity-90 disabled:opacity-50"
                        >
                          {syncing[tile.key]
                            ? t("accountsSettings.serviceMonster.sync.syncing", "Syncing…")
                            : t("accountsSettings.serviceMonster.sync.syncNow", "Sync now")}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setStartDateModal({
                              open: true,
                              target: tile.key,
                              date: TODAY_ISO(),
                            })
                          }
                          disabled={syncing[tile.key]}
                          className="text-xs px-3 py-1.5 rounded-md bg-gray-100 border border-gray-300 hover:bg-gray-200 disabled:opacity-50"
                        >
                          {t("accountsSettings.serviceMonster.sync.syncFromDate", "Sync from date…")}
                        </button>
                      </div>
                      )}
                    </div>
                  ))}
                </div>
              </SectionCard>

              {/* ── Webhook card ──────────────────────────────────────────── */}
              <SectionCard
                title={t("accountsSettings.serviceMonster.webhooks.title", "Webhooks")}
                description={t(
                  "accountsSettings.serviceMonster.webhooks.description",
                  "When ServiceMonster invoices an order, it can push the change to PCI in real-time so the data stays in sync without manual refresh."
                )}
                icon={Webhook}
              >
                <div className="rounded-lg border border-slate-200 bg-slate-50/80 dark:bg-slate-900/30 p-4 mb-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
                    {t("accountsSettings.serviceMonster.webhooks.publicUrlLabel", "Public webhook URL")}
                  </p>
                  <p className="font-mono text-xs sm:text-sm text-slate-800 break-all mt-1">
                    {webhookStatus?.webhookUrl ||
                      t(
                        "accountsSettings.serviceMonster.webhooks.publicUrlPlaceholder",
                        "Available after credentials are saved and a webhook is subscribed."
                      )}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3 mb-4">
                  {canUpdate && (
                  <>
                  <button
                    type="button"
                    onClick={handleSubscribeAll}
                    disabled={webhookBusy}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-[var(--p-blue)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
                  >
                    {t("accountsSettings.serviceMonster.webhooks.subscribeAll", "Subscribe to all events")}
                  </button>
                  <button
                    type="button"
                    onClick={handleUnsubscribeAll}
                    disabled={
                      webhookBusy ||
                      !(webhookStatus?.subscriptions || []).some((s) => s.active)
                    }
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                  >
                    {t("accountsSettings.serviceMonster.webhooks.unsubscribeAll", "Unsubscribe all")}
                  </button>
                  </>
                  )}
                  <button
                    type="button"
                    onClick={fetchWebhookStatus}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200"
                  >
                    <RefreshCcw className="w-3.5 h-3.5" />
                    {t("accountsSettings.serviceMonster.webhooks.refreshStatus", "Refresh status")}
                  </button>
                </div>

                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr className="text-left">
                        <th className="px-3 py-2 font-semibold text-gray-700">
                          {t("accountsSettings.serviceMonster.webhooks.tableEvent", "Event")}
                        </th>
                        <th className="px-3 py-2 font-semibold text-gray-700">
                          {t("accountsSettings.serviceMonster.webhooks.tableSubscribedAt", "Subscribed at")}
                        </th>
                        <th className="px-3 py-2 font-semibold text-gray-700">
                          {t("accountsSettings.serviceMonster.webhooks.tableStatus", "Status")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(webhookStatus?.subscriptions || []).length === 0 ? (
                        <tr>
                          <td
                            colSpan={3}
                            className="px-3 py-6 text-center text-gray-500 text-sm"
                          >
                            {t(
                              "accountsSettings.serviceMonster.webhooks.noSubscriptions",
                              "No active webhook subscriptions."
                            )}
                          </td>
                        </tr>
                      ) : (
                        (webhookStatus?.subscriptions || []).map((sub, idx) => (
                          <tr key={idx} className="border-t border-gray-100">
                            <td className="px-3 py-2 font-mono text-xs">{sub.event}</td>
                            <td className="px-3 py-2 text-gray-600">
                              {formatDateTime(t, sub.subscribedAt)}
                            </td>
                            <td className="px-3 py-2">
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" />
                                {t("accountsSettings.serviceMonster.webhooks.active", "Active")}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900 text-sm">
                      {t("accountsSettings.serviceMonster.webhooks.recentEvents", "Recent events")}
                    </h4>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={fetchWebhookLogs}
                        className="text-xs text-[var(--p-blue)] hover:underline"
                      >
                        {t("accountsSettings.serviceMonster.webhooks.refresh", "Refresh")}
                      </button>
                      {webhookLogs.length > 0 && canDelete ? (
                        <button
                          type="button"
                          onClick={handleClearLogs}
                          className="text-xs text-rose-600 hover:underline inline-flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          {t("accountsSettings.serviceMonster.webhooks.clear", "Clear")}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="rounded-lg border border-gray-200 max-h-64 overflow-y-auto bg-gray-50">
                    {logsLoading ? (
                      <p className="text-xs text-gray-500 px-3 py-4">
                        {t("accountsSettings.serviceMonster.webhooks.loadingLogs", "Loading logs…")}
                      </p>
                    ) : webhookLogs.length === 0 ? (
                      <p className="text-xs text-gray-500 px-3 py-4">
                        {t("accountsSettings.serviceMonster.webhooks.noLogs", "No webhook events recorded yet.")}
                      </p>
                    ) : (
                      <ul className="divide-y divide-gray-200">
                        {webhookLogs.map((log) => (
                          <li key={log.id} className="px-3 py-2 text-xs">
                            <div className="flex justify-between gap-3">
                              <span
                                className={`font-medium ${
                                  log.type?.includes("error")
                                    ? "text-rose-700"
                                    : log.type?.includes("processed") ||
                                      log.type === "subscription"
                                    ? "text-emerald-700"
                                    : "text-gray-800"
                                }`}
                              >
                                {log.type}
                              </span>
                              <span className="text-gray-500">
                                {formatDateTime(t, log.timestamp)}
                              </span>
                            </div>
                            <div className="mt-0.5 text-gray-700">{log.message}</div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </SectionCard>
            </>
          ) : null}
        </div>
      )}

      {/* ── Modals ────────────────────────────────────────────────────── */}
      <CustomModal
        open={startDateModal.open}
        onClose={() =>
          setStartDateModal({ open: false, target: null, date: TODAY_ISO() })
        }
        title={t("accountsSettings.serviceMonster.modals.startDate.title", "Start syncing from date")}
        showActions
        actions={[
          {
            label: t("accountsSettings.serviceMonster.modals.startDate.cancel", "Cancel"),
            secondary: true,
            onClick: () =>
              setStartDateModal({ open: false, target: null, date: TODAY_ISO() }),
          },
          {
            label: t("accountsSettings.serviceMonster.modals.startDate.sync", "Sync"),
            primary: true,
            onClick: submitStartDateModal,
          },
        ]}
      >
        <p className="text-sm text-gray-600 mb-3">
          {t(
            "accountsSettings.serviceMonster.modals.startDate.descriptionPrefix",
            "ServiceMonster does not return historical data unless you specify a start date. Pick the earliest record you want PCI to import for"
          )}{" "}
          <strong>{getSyncTileLabel(t, startDateModal.target)}</strong>.
        </p>
        <input
          type="date"
          className="border border-gray-300 rounded-lg p-2 w-full"
          value={startDateModal.date}
          onChange={(e) =>
            setStartDateModal((s) => ({ ...s, date: e.target.value }))
          }
        />
      </CustomModal>

      <CustomModal
        open={confirmDisconnectOpen}
        onClose={() => !disconnecting && setConfirmDisconnectOpen(false)}
        title={t("accountsSettings.serviceMonster.modals.disconnect.title", "Disconnect ServiceMonster?")}
        showActions
        actions={[
          {
            label: t("accountsSettings.serviceMonster.modals.disconnect.cancel", "Cancel"),
            secondary: true,
            onClick: () => setConfirmDisconnectOpen(false),
            disabled: disconnecting,
          },
          {
            label: disconnecting
              ? t("accountsSettings.serviceMonster.modals.disconnect.disconnecting", "Disconnecting…")
              : t("accountsSettings.serviceMonster.modals.disconnect.disconnect", "Disconnect"),
            primary: true,
            failure: true,
            onClick: handleDisconnect,
            disabled: disconnecting,
          },
        ]}
      >
        <p className="text-sm text-gray-700">
          {t(
            "accountsSettings.serviceMonster.modals.disconnect.descriptionPrefix",
            "Disconnecting stops all syncs and unsubscribes any active webhooks. The credentials stay saved so you can reconnect by clicking"
          )}{" "}
          <strong>{t("accountsSettings.serviceMonster.connection.testConnection", "Test connection")}</strong>{" "}
          {t("accountsSettings.serviceMonster.modals.disconnect.descriptionSuffix", "later.")}
        </p>
      </CustomModal>

      <CustomModal
        open={revealOpen}
        onClose={() => !revealing && setRevealOpen(false)}
        title={t("accountsSettings.serviceMonster.modals.reveal.title", "Reveal saved password")}
        showActions
        actions={[
          {
            label: t("accountsSettings.serviceMonster.modals.reveal.close", "Close"),
            secondary: true,
            onClick: () => setRevealOpen(false),
            disabled: revealing,
          },
          {
            label: revealing
              ? t("accountsSettings.serviceMonster.modals.reveal.verifying", "Verifying…")
              : t("accountsSettings.serviceMonster.modals.reveal.reveal", "Reveal"),
            primary: true,
            onClick: handleRevealPassword,
            disabled: revealing,
          },
        ]}
      >
        <p className="text-sm text-gray-700 mb-3">
          {t(
            "accountsSettings.serviceMonster.modals.reveal.description",
            "For your security, please re-enter your PCI account password to view the saved ServiceMonster password."
          )}
        </p>
        <input
          type="password"
          autoFocus
          className="border border-gray-300 rounded-lg p-2 w-full"
          value={revealPasswordInput}
          onChange={(e) => setRevealPasswordInput(e.target.value)}
          placeholder={t("accountsSettings.serviceMonster.modals.reveal.placeholder", "Your account password")}
        />
        {revealedPassword ? (
          <div className="mt-3 p-3 rounded-lg border border-emerald-200 bg-emerald-50 text-sm">
            <span className="text-emerald-700 font-medium">
              {t("accountsSettings.serviceMonster.modals.reveal.revealedLabel", "ServiceMonster password:")}
            </span>{" "}
            <code className="font-mono">{revealedPassword}</code>
          </div>
        ) : null}
      </CustomModal>

      <CustomModal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title={t(
          "accountsSettings.serviceMonster.modals.help.title",
          "How to Get ServiceMonster API Credentials"
        )}
        showActions
        actions={[
          {
            label: t("accountsSettings.serviceMonster.modals.help.close", "Close"),
            secondary: true,
            onClick: () => setHelpOpen(false),
          },
        ]}
      >
        <div className="space-y-4 text-sm text-gray-700">
          <div className="rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-3.5">
            <p className="font-semibold text-blue-900 flex items-center gap-2">
              <BookOpenText className="w-4 h-4" />
              {t("accountsSettings.serviceMonster.modals.help.guideTitle", "ServiceMonster API Credentials Guide")}
            </p>
            <p className="text-blue-800 mt-1.5 leading-relaxed">
              {t(
                "accountsSettings.serviceMonster.modals.help.guideIntro",
                "ServiceMonster does not give you an API key directly. You need to create API user credentials (username and password) from your ServiceMonster account."
              )}
            </p>
          </div>

          <div className="rounded-lg border border-indigo-200 border-l-4 border-l-indigo-500 bg-indigo-50/50 p-3.5">
            <h4 className="font-semibold text-gray-900 mb-2.5">
              {t("accountsSettings.serviceMonster.modals.help.step1.heading", "Step 1: Login to ServiceMonster Admin Dashboard")}
            </h4>
            <ol className="list-decimal pl-5 space-y-1.5 leading-relaxed">
              <li>{t("accountsSettings.serviceMonster.modals.help.step1.li1", "Open your browser and login with an admin account.")}</li>
              <li>
                {t("accountsSettings.serviceMonster.modals.help.step1.li2Prefix", "Go to:")}{" "}
                <code className="font-mono px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-900">
                  six.servicemonster.net
                </code>
              </li>
            </ol>
          </div>

          <div className="rounded-lg border border-emerald-200 border-l-4 border-l-emerald-500 bg-emerald-50/50 p-3.5">
            <h4 className="font-semibold text-gray-900 mb-2.5">
              {t("accountsSettings.serviceMonster.modals.help.step2.heading", "Step 2: Navigate to API Users Settings")}
            </h4>
            <ol className="list-decimal pl-5 space-y-1.5 leading-relaxed">
              <li>
                {t("accountsSettings.serviceMonster.modals.help.step2.goToPrefix", "Go to")}{" "}
                <strong>{t("accountsSettings.serviceMonster.modals.help.step2.settingsLabel", "Settings")}</strong>{" "}
                →{" "}
                <strong>{t("accountsSettings.serviceMonster.modals.help.step2.apiUsersLabel", "API Users")}</strong>.
              </li>
              <li>{t("accountsSettings.serviceMonster.modals.help.step2.li2", "This area lets you create users specifically for API access.")}</li>
            </ol>
          </div>

          <div className="rounded-lg border border-violet-200 border-l-4 border-l-violet-500 bg-violet-50/50 p-3.5">
            <h4 className="font-semibold text-gray-900 mb-2.5">
              {t("accountsSettings.serviceMonster.modals.help.step3.heading", "Step 3: Create New API User")}
            </h4>
            <ol className="list-decimal pl-5 space-y-1.5 leading-relaxed">
              <li>
                {t("accountsSettings.serviceMonster.modals.help.step3.li1Prefix", "Click")}{" "}
                <strong>{t("accountsSettings.serviceMonster.modals.help.step3.apiUserButtonLabel", '"+ API User"')}</strong>{" "}
                {t("accountsSettings.serviceMonster.modals.help.step3.li1Suffix", "to create a new API user.")}
              </li>
              <li>{t("accountsSettings.serviceMonster.modals.help.step3.li2", "Give it a role (e.g. Admin or Super User).")}</li>
              <li>
                {t("accountsSettings.serviceMonster.modals.help.step3.li3Prefix", "Save")}{" "}
                <strong>{t("accountsSettings.serviceMonster.modals.help.step3.usernamePasswordLabel", "username + password")}</strong>{" "}
                {t("accountsSettings.serviceMonster.modals.help.step3.li3Suffix", "that is generated. You will not be able to retrieve the password again later.")}
              </li>
            </ol>
            <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900 leading-relaxed">
              <strong>{t("accountsSettings.serviceMonster.modals.help.step3.importantLabel", "Important:")}</strong>{" "}
              {t("accountsSettings.serviceMonster.modals.help.step3.importantText", "Store those credentials securely. You will use them for API calls, and the password cannot be retrieved later.")}
            </div>
          </div>

          <div className="rounded-lg border border-rose-200 border-l-4 border-l-rose-500 bg-rose-50/50 p-3.5">
            <h4 className="font-semibold text-gray-900 mb-2.5">
              {t("accountsSettings.serviceMonster.modals.help.step4.heading", "Step 4: Fill in the Form & Test Connection")}
            </h4>
            <p className="mb-2 leading-relaxed">
              {t("accountsSettings.serviceMonster.modals.help.step4.intro", "Now paste your credentials into the form above:")}
            </p>
            <ol className="list-decimal pl-5 space-y-1.5 leading-relaxed">
              <li>
                <strong>{t("accountsSettings.serviceMonster.modals.help.step4.usernameLabel", "Username:")}</strong>{" "}
                {t("accountsSettings.serviceMonster.modals.help.step4.usernameText", "The API user username you created.")}
              </li>
              <li>
                <strong>{t("accountsSettings.serviceMonster.modals.help.step4.passwordLabel", "Password:")}</strong>{" "}
                {t("accountsSettings.serviceMonster.modals.help.step4.passwordText", "The API user password you saved.")}
              </li>
              <li>
                {t("accountsSettings.serviceMonster.modals.help.step4.li3Prefix", "Click")}{" "}
                <strong>{t("accountsSettings.serviceMonster.modals.help.step4.saveButtonLabel", '"Save ServiceMonster Details"')}</strong>.{" "}
                {t("accountsSettings.serviceMonster.modals.help.step4.li3Suffix", "The Basic Token is automatically generated by the backend.")}
              </li>
              <li>
                {t("accountsSettings.serviceMonster.modals.help.step4.li4Prefix", "Click")}{" "}
                <strong>{t("accountsSettings.serviceMonster.modals.help.step4.testButtonLabel", '"Test Connection"')}</strong>{" "}
                {t("accountsSettings.serviceMonster.modals.help.step4.li4Suffix", "to verify your credentials are working correctly.")}
              </li>
            </ol>
            <div className="mt-3 rounded-md border border-sky-200 bg-sky-50 p-3 text-sky-900 leading-relaxed">
              <strong>{t("accountsSettings.serviceMonster.modals.help.step4.noteLabel", "Note:")}</strong>{" "}
              {t("accountsSettings.serviceMonster.modals.help.step4.noteText", "The Basic Token is automatically generated by the backend when you save credentials. You do not need to encode it manually.")}
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-3">
            <span className="font-medium">{t("accountsSettings.serviceMonster.modals.help.footer.needMoreHelp", "Need more help?")}</span>{" "}
            {t("accountsSettings.serviceMonster.modals.help.footer.checkDocs", "Check ServiceMonster API documentation:")}{" "}
            <a
              href="https://demo.invoispls.my/business/details/6971d8b246a982197f51f90d"
              target="_blank"
              rel="noreferrer"
              className="text-[var(--p-blue)] hover:underline"
            >
              {t("accountsSettings.serviceMonster.modals.help.footer.linkLabel", "ServiceMonster Developer Docs")}
            </a>
          </div>
        </div>
      </CustomModal>
    </div>
  );
};

const ServiceMonsterSettingsPage = () => (
  <AppLayout>
    <Header />
    <ServiceMonsterSettingsContent />
  </AppLayout>
);

export default ServiceMonsterSettingsPage;
