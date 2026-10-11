import React, {
  useState,
  useEffect,
  useContext,
  useCallback,
  useMemo,
} from "react";
import { useHistory, useLocation } from "react-router-dom";
import axios from "axios";
import { useTranslation } from "react-i18next";
import {
  Users,
  FileText,
  Package,
  BookOpen,
  Link2,
  CheckCircle2,
  RefreshCw,
  ClipboardList,
  Repeat,
  FileSpreadsheet,
  CreditCard,
  Building2,
  Landmark,
  Wallet,
} from "lucide-react";

import { notifyError, notifySuccess } from "@/utils/toast";
import { AdminContext } from "@/context/AdminContext";
import ZohoBooksServices from "@/services/ZohoBooksServices";
import { getPublicAppUrl } from "@/utils/publicAppUrl";
import CustomDatePicker from "@/components/CustomDatePicker";
import ModalPortal from "@/components/ModalPortal";
import { formatDateTime, getConfig } from "@/components/formatAmount";
import { ZohoBooksSetupGuideModal } from "./ZohoBooksSetupGuideModal";
import { ZohoBooksPanelSkeleton } from "./ZohoBooksPanelSkeleton";
import { useSettingsCrudPermissions } from "@/hooks/useSettingsCrudPermissions";
import { hasViewOnRegisteredModulePath } from "@/utils/permissionUtils";

const API = import.meta.env.VITE_APP_API_BASE_URL;

const toApiStartDate = (value) => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const todayForPicker = () => new Date();

/** Translated singular/plural labels for each syncable Zoho entity. */
function getSyncEntityLabels(t) {
  return {
    customers: {
      singular: t("accountsSettings.zohoBooks.entitySingularCustomers", "customer"),
      plural: t("accountsSettings.zohoBooks.entityPluralCustomers", "customers"),
    },
    items: {
      singular: t("accountsSettings.zohoBooks.entitySingularItems", "item"),
      plural: t("accountsSettings.zohoBooks.entityPluralItems", "items"),
    },
    invoices: {
      singular: t("accountsSettings.zohoBooks.entitySingularInvoices", "invoice"),
      plural: t("accountsSettings.zohoBooks.entityPluralInvoices", "invoices"),
    },
    salesOrders: {
      singular: t("accountsSettings.zohoBooks.entitySingularSalesOrders", "sales order"),
      plural: t("accountsSettings.zohoBooks.entityPluralSalesOrders", "sales orders"),
    },
    recurringInvoices: {
      singular: t(
        "accountsSettings.zohoBooks.entitySingularRecurringInvoices",
        "recurring invoice",
      ),
      plural: t(
        "accountsSettings.zohoBooks.entityPluralRecurringInvoices",
        "recurring invoices",
      ),
    },
    quotations: {
      singular: t("accountsSettings.zohoBooks.entitySingularQuotations", "quotation"),
      plural: t("accountsSettings.zohoBooks.entityPluralQuotations", "quotations"),
    },
    payments: {
      singular: t("accountsSettings.zohoBooks.entitySingularPayments", "payment"),
      plural: t("accountsSettings.zohoBooks.entityPluralPayments", "payments"),
    },
    vendors: {
      singular: t("accountsSettings.zohoBooks.entitySingularVendors", "vendor"),
      plural: t("accountsSettings.zohoBooks.entityPluralVendors", "vendors"),
    },
    chartAccounts: {
      singular: t("accountsSettings.zohoBooks.entitySingularChartAccounts", "chart account"),
      plural: t("accountsSettings.zohoBooks.entityPluralChartAccounts", "chart accounts"),
    },
    bankAccounts: {
      singular: t("accountsSettings.zohoBooks.entitySingularBankAccounts", "bank account"),
      plural: t("accountsSettings.zohoBooks.entityPluralBankAccounts", "bank accounts"),
    },
  };
}

/** Each Zoho sync card requires View on the matching PCI module route. */
function getZohoSyncCards(t) {
  return [
    {
      k: "customers",
      label: t("accountsSettings.zohoBooks.cardLabelCustomers", "Customers"),
      icon: Users,
      permissionPaths: ["/customers"],
      lastKey: "lastFetchedCustomers",
    },
    {
      k: "items",
      label: t("accountsSettings.zohoBooks.cardLabelItems", "Items"),
      icon: Package,
      permissionPaths: ["/items"],
      lastKey: "lastFetchedItems",
    },
    {
      k: "invoices",
      label: t("accountsSettings.zohoBooks.cardLabelInvoices", "Invoices"),
      icon: FileText,
      permissionPaths: ["/customer-invoices"],
      lastKey: "lastFetchedInvoices",
    },
    {
      k: "salesOrders",
      label: t("accountsSettings.zohoBooks.cardLabelSalesOrders", "Sales Orders"),
      icon: ClipboardList,
      permissionPaths: ["/sales-orders", "/sale-order"],
      lastKey: "lastFetchedSalesOrders",
      hint: t(
        "accountsSettings.zohoBooks.cardHintSalesOrders",
        "Linked invoices are auto-synced; existing ones are skipped.",
      ),
    },
    {
      k: "recurringInvoices",
      label: t("accountsSettings.zohoBooks.cardLabelRecurringInvoices", "Recurring Invoices"),
      icon: Repeat,
      permissionPaths: ["/recurring-Invoice"],
      lastKey: "lastFetchedRecurringInvoices",
    },
    {
      k: "quotations",
      label: t("accountsSettings.zohoBooks.cardLabelQuotations", "Quotations"),
      icon: FileSpreadsheet,
      permissionPaths: ["/quotations"],
      lastKey: "lastFetchedEstimates",
    },
    {
      k: "payments",
      label: t("accountsSettings.zohoBooks.cardLabelPayments", "Payments"),
      icon: CreditCard,
      permissionPaths: ["/customer-payments"],
      lastKey: "lastFetchedPayments",
      hint: t(
        "accountsSettings.zohoBooks.cardHintPayments",
        "Syncs Zoho payments to linked invoices.",
      ),
    },
    {
      k: "vendors",
      label: t("accountsSettings.zohoBooks.cardLabelVendors", "Vendors"),
      icon: Building2,
      permissionPaths: ["/Vendors"],
      lastKey: "lastFetchedVendors",
    },
    {
      k: "chartAccounts",
      label: t("accountsSettings.zohoBooks.cardLabelChartAccounts", "Chart of Accounts"),
      icon: Landmark,
      permissionPaths: ["/chart-of-accounts"],
      lastKey: "lastFetchedChartAccounts",
    },
    {
      k: "bankAccounts",
      label: t("accountsSettings.zohoBooks.cardLabelBankAccounts", "Bank Accounts"),
      icon: Wallet,
      permissionPaths: ["/bank-management"],
      lastKey: "lastFetchedBankAccounts",
    },
  ];
}

function canSyncZohoEntity(isSuperAdmin, modules, permissionPaths = []) {
  if (isSuperAdmin) return true;
  const paths = Array.isArray(permissionPaths) ? permissionPaths : [permissionPaths];
  return paths.some((path) => hasViewOnRegisteredModulePath(modules, path));
}

function getSyncFromDateHints(t) {
  return {
    customers: t(
      "accountsSettings.zohoBooks.dateHintCustomers",
      "Only customers from Zoho on or after this date will be imported.",
    ),
    items: t(
      "accountsSettings.zohoBooks.dateHintItems",
      "Only items from Zoho on or after this date will be imported.",
    ),
    invoices: t(
      "accountsSettings.zohoBooks.dateHintInvoices",
      "Only invoices from Zoho on or after this date will be imported.",
    ),
    salesOrders: t(
      "accountsSettings.zohoBooks.dateHintSalesOrders",
      "Only sales orders from Zoho on or after this date will be imported. Linked invoices may also be pulled in.",
    ),
    recurringInvoices: t(
      "accountsSettings.zohoBooks.dateHintRecurringInvoices",
      "Only recurring invoice profiles from Zoho on or after this date will be imported.",
    ),
    quotations: t(
      "accountsSettings.zohoBooks.dateHintQuotations",
      "Only quotations from Zoho on or after this date will be imported.",
    ),
    payments: t(
      "accountsSettings.zohoBooks.dateHintPayments",
      "Only customer payments from Zoho on or after this date will be imported.",
    ),
    vendors: t(
      "accountsSettings.zohoBooks.dateHintVendors",
      "Only vendors from Zoho on or after this date will be imported.",
    ),
    chartAccounts: t(
      "accountsSettings.zohoBooks.dateHintChartAccounts",
      "Only chart accounts from Zoho on or after this date will be imported.",
    ),
    bankAccounts: t(
      "accountsSettings.zohoBooks.dateHintBankAccounts",
      "Only bank accounts from Zoho on or after this date will be imported.",
    ),
  };
}

const getSyncFromDateModalCopy = (t, kind, entityLabels, dateHints) => {
  const labels = entityLabels[kind] || { singular: kind, plural: `${kind}s` };
  const title = t("accountsSettings.zohoBooks.importFromZohoTitle", "Import {{plural}} from Zoho", {
    plural: labels.plural,
  });
  const description =
    dateHints[kind] ||
    t(
      "accountsSettings.zohoBooks.importFromZohoDescriptionFallback",
      "Only {{plural}} from Zoho on or after this date will be imported into PCI.",
      { plural: labels.plural },
    );
  return { title, description };
};

/** Build a user-facing sync result message from API summary counts. */
function formatSyncSummaryMessage(t, kind, summary, entityLabels) {
  const labels = entityLabels[kind] || { singular: kind, plural: `${kind}s` };
  const inserted = Number(summary?.inserted) || 0;
  const updated = Number(summary?.updated) || 0;
  const attached = Number(summary?.attached) || 0;
  const failed = Number(summary?.failed) || 0;
  const total = Number(summary?.total) || 0;
  const synced = inserted + updated + attached;

  if (failed > 0) {
    const noun = synced === 1 ? labels.singular : labels.plural;
    return synced
      ? t("accountsSettings.zohoBooks.syncedFailed", "{{synced}} {{noun}} synced, {{failed}} failed.", {
          synced,
          noun,
          failed,
        })
      : t("accountsSettings.zohoBooks.syncFailedForAll", "Sync failed for {{failed}} {{plural}}.", {
          failed,
          plural: labels.plural,
        });
  }

  const skipped = Number(summary?.skipped) || 0;
  const unchanged = Number(summary?.unchanged) || 0;
  const fetched = Number(summary?.fetched) || 0;

  if (kind === "payments") {
    const invoicesSynced = Number(summary?.invoicesSynced) || 0;
    const invoicesRefreshed = Number(summary?.invoicesRefreshed) || 0;
    const invoicesChecked = Number(summary?.invoicesChecked) || 0;
    const invoiceNotes = [];
    if (invoicesSynced > 0) {
      invoiceNotes.push(
        invoicesSynced === 1
          ? t(
              "accountsSettings.zohoBooks.linkedInvoiceImportedSingular",
              "{{count}} linked invoice imported from Zoho",
              { count: invoicesSynced },
            )
          : t(
              "accountsSettings.zohoBooks.linkedInvoiceImportedPlural",
              "{{count}} linked invoices imported from Zoho",
              { count: invoicesSynced },
            ),
      );
    }
    if (invoicesRefreshed > 0) {
      invoiceNotes.push(
        invoicesRefreshed === 1
          ? t(
              "accountsSettings.zohoBooks.invoiceUpdatedSingular",
              "{{count}} invoice updated with latest payment/status",
              { count: invoicesRefreshed },
            )
          : t(
              "accountsSettings.zohoBooks.invoiceUpdatedPlural",
              "{{count}} invoices updated with latest payment/status",
              { count: invoicesRefreshed },
            ),
      );
    }

    if (synced > 0) {
      let msg =
        synced === 1
          ? t(
              "accountsSettings.zohoBooks.paymentsAppliedSingular",
              "{{count}} payment applied to PCI invoices.",
              { count: synced },
            )
          : t(
              "accountsSettings.zohoBooks.paymentsAppliedPlural",
              "{{count}} payments applied to PCI invoices.",
              { count: synced },
            );
      if (invoiceNotes.length) msg += ` (${invoiceNotes.join("; ")})`;
      return msg;
    }

    if (invoicesRefreshed > 0 || invoicesSynced > 0) {
      return t("accountsSettings.zohoBooks.noNewPaymentsToSync", "No new payments to sync.");
    }

    if (invoicesChecked > 0) {
      return t("accountsSettings.zohoBooks.noNewPaymentsToSync", "No new payments to sync.");
    }

    if (total === 0) {
      if (fetched > 0) {
        return t(
          "accountsSettings.zohoBooks.noPaymentsToSyncForDate",
          "No payments to sync for the selected date.",
        );
      }
      return t("accountsSettings.zohoBooks.noPaymentsToSync", "No payments to sync.");
    }
    if (synced === 0) {
      const failureHint =
        summary?.failures?.length > 0
          ? ` ${summary.failures
              .slice(0, 2)
              .map((f) => f.reason)
              .filter(Boolean)
              .join("; ")}`
          : "";
      if (skipped > 0) {
        return `${t("accountsSettings.zohoBooks.noPaymentsToSync", "No payments to sync.")}${failureHint}`;
      }
      if (unchanged > 0) {
        return t("accountsSettings.zohoBooks.noNewPaymentsToSync", "No new payments to sync.");
      }
      return `${t("accountsSettings.zohoBooks.noPaymentsToSync", "No payments to sync.")}${failureHint}`;
    }
  }

  if (total === 0 || synced === 0) {
    if (synced === 0 && unchanged > 0) {
      return t(
        "accountsSettings.zohoBooks.alreadyUpToDate",
        "{{count}} {{plural}} already up to date.",
        { count: unchanged, plural: labels.plural },
      );
    }
    if (synced === 0 && skipped > 0) {
      return t(
        "accountsSettings.zohoBooks.skippedNothingNew",
        "{{count}} {{plural}} skipped — nothing new to apply.",
        { count: skipped, plural: labels.plural },
      );
    }
    return t(
      "accountsSettings.zohoBooks.noEntitiesToSyncForDate",
      "No {{plural}} to sync for the selected date.",
      { plural: labels.plural },
    );
  }

  const parts = [];
  if (inserted > 0)
    parts.push(t("accountsSettings.zohoBooks.countNew", "{{count}} new", { count: inserted }));
  if (updated > 0)
    parts.push(t("accountsSettings.zohoBooks.countUpdated", "{{count}} updated", { count: updated }));
  if (attached > 0)
    parts.push(
      t("accountsSettings.zohoBooks.countAttached", "{{count}} attached", { count: attached }),
    );
  const noun = synced === 1 ? labels.singular : labels.plural;
  let message = t("accountsSettings.zohoBooks.syncedSummary", "{{parts}} {{noun}} synced.", {
    parts: parts.join(", "),
    noun,
  });

  const linkedInv =
    (Number(summary?.linkedInvoicesInserted) || 0) +
    (Number(summary?.linkedInvoicesUpdated) || 0);
  const linkedSo =
    (Number(summary?.linkedSalesOrdersInserted) || 0) +
    (Number(summary?.linkedSalesOrdersUpdated) || 0);
  const linkedNotes = [];
  if (linkedSo > 0) {
    linkedNotes.push(
      linkedSo === 1
        ? t("accountsSettings.zohoBooks.linkedSalesOrderSingular", "{{count}} linked sales order", {
            count: linkedSo,
          })
        : t("accountsSettings.zohoBooks.linkedSalesOrderPlural", "{{count}} linked sales orders", {
            count: linkedSo,
          }),
    );
  }
  if (linkedInv > 0) {
    linkedNotes.push(
      linkedInv === 1
        ? t("accountsSettings.zohoBooks.linkedInvoiceSingular", "{{count}} linked invoice", {
            count: linkedInv,
          })
        : t("accountsSettings.zohoBooks.linkedInvoicePlural", "{{count}} linked invoices", {
            count: linkedInv,
          }),
    );
  }
  if (linkedNotes.length) {
    message += t("accountsSettings.zohoBooks.alsoSyncedSuffix", " ({{notes}} also synced)", {
      notes: linkedNotes.join(", "),
    });
  }
  return message;
}

/** Ensure saved org appears in dropdown even if Zoho list omits it. */
function mergeSavedOrganization(list, savedId, savedName) {
  const id = String(savedId || "").trim();
  if (!id) return list;
  if (list.some((o) => String(o.organization_id) === id)) return list;
  return [
    {
      organization_id: id,
      name: savedName || `Organization ${id}`,
      is_saved_only: true,
    },
    ...list,
  ];
}

const BOOKS_V3_SUFFIX = "/books/v3";

/** Strip `/books/v3` suffix for storage (PCI API client appends `/books/v3`). */
function normalizeBooksApiRoot(raw) {
  let t = (raw || "").trim().replace(/\/+$/, "");
  if (!t) return "";
  if (t.toLowerCase().endsWith(BOOKS_V3_SUFFIX)) {
    t = t.slice(0, -BOOKS_V3_SUFFIX.length).replace(/\/+$/, "");
  }
  return t.replace(/\/+$/, "");
}

function deriveAccountsHost(booksRoot) {
  const low = (booksRoot || "").toLowerCase();
  if (low.includes("zohoapis.eu")) return "https://accounts.zoho.eu";
  if (low.includes("zohoapis.in")) return "https://accounts.zoho.in";
  if (low.includes("zohoapis.com.au")) return "https://accounts.zoho.com.au";
  return "https://accounts.zoho.com";
}

function booksRootToInvoisplsStyleDisplay(booksApiRoot) {
  const r = (booksApiRoot || "").trim().replace(/\/+$/, "");
  const root = r || "https://www.zohoapis.com";
  return `${root}${BOOKS_V3_SUFFIX}`;
}

/** Same path the browser uses for Zoho redirect: `{VITE_APP_API_BASE_URL}/Zoho/oauth/callback`. */
function oauthCallbackFromViteApiBase(apiBase) {
  const b =
    typeof apiBase === "string" ? apiBase.trim().replace(/\/+$/, "") : "";
  return b ? `${b}/Zoho/oauth/callback` : "";
}

function resolveOAuthCallbackUrl({ apiBase, formRedirect, record }) {
  const fromForm = (formRedirect || "").trim();
  if (fromForm) return fromForm;

  const saved = (record?.redirectUrl || "").trim();
  if (saved) return saved;

  const fromServer = (record?.defaultRedirectSuggestion || "").trim();
  if (fromServer) return fromServer;

  return oauthCallbackFromViteApiBase(apiBase);
}

/**
 * Zoho Books Settings body (mounted from `ZohoBooksSettingsPage`).
 */
export function ZohoBooksIntegrationPanel() {
  const { t } = useTranslation();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const location = useLocation();
  const history = useHistory();

  const [businesses, setBusinesses] = useState([]);
  const [bid, setBid] = useState("");
  const [bizLoad, setBizLoad] = useState(false);
  const [rowBusy, setRowBusy] = useState(false);
  const [ready, setReady] = useState(false);

  const [record, setRecord] = useState(null);
  const [form, setForm] = useState({
    organizationId: "",
    clientId: "",
    clientSecret: "",
    baseUrl: "https://www.zohoapis.com/books/v3",
    redirectUrl: "",
  });

  const [orgs, setOrgs] = useState([]);
  const [orgPick, setOrgPick] = useState("");
  const [orgBusy, setOrgBusy] = useState(false);

  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [tokBusy, setTokBusy] = useState(false);
  const [discBusy, setDiscBusy] = useState(false);

  const [syncing, setSyncing] = useState({
    customers: false,
    items: false,
    invoices: false,
    salesOrders: false,
    recurringInvoices: false,
    quotations: false,
    payments: false,
    vendors: false,
    chartAccounts: false,
    bankAccounts: false,
  });
  const [savedOrgAccessible, setSavedOrgAccessible] = useState(true);
  const [dateTarget, setDateTarget] = useState(null);
  const [dateVal, setDateVal] = useState(todayForPicker());
  const dateFormatLabel = getConfig().date_format || "DD-MM-YYYY";

  const syncEntityLabels = useMemo(() => getSyncEntityLabels(t), [t]);
  const zohoSyncCards = useMemo(() => getZohoSyncCards(t), [t]);
  const syncFromDateHints = useMemo(() => getSyncFromDateHints(t), [t]);

  const dateModalCopy = useMemo(
    () =>
      dateTarget
        ? getSyncFromDateModalCopy(t, dateTarget, syncEntityLabels, syncFromDateHints)
        : null,
    [t, dateTarget, syncEntityLabels, syncFromDateHints],
  );

  useEffect(() => {
    if (!dateTarget) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [dateTarget]);
  const [setupGuideOpen, setSetupGuideOpen] = useState(false);
  const [justConnected, setJustConnected] = useState(false);
  const { canAdd, canUpdate, canDelete } = useSettingsCrudPermissions();

  const roleModules = adminInfo?.role?.modules;
  const isSuperAdmin = adminInfo?.role?.isSuperAdmin === true;

  const visibleSyncCards = useMemo(
    () =>
      zohoSyncCards
        .filter((card) => canSyncZohoEntity(isSuperAdmin, roleModules, card.permissionPaths))
        .map((card) => ({
          ...card,
          last: record?.[card.lastKey],
        })),
    [zohoSyncCards, isSuperAdmin, roleModules, record],
  );

  const canSyncKind = useCallback(
    (kind) => {
      const card = zohoSyncCards.find((c) => c.k === kind);
      if (!card) return false;
      return canSyncZohoEntity(isSuperAdmin, roleModules, card.permissionPaths);
    },
    [zohoSyncCards, isSuperAdmin, roleModules],
  );

  useEffect(() => {
    if (!adminInfo?.id) return;
    setBizLoad(true);
    axios
      .get(`${API}/admin/assigned/${adminInfo.id}`, {
        headers: { authorization: `Bearer ${adminInfo.token}` },
      })
      .then((r) =>
        setBusinesses(
          Array.isArray(r.data?.businesses) ? r.data.businesses : [],
        ),
      )
      .catch(() => setBusinesses([]))
      .finally(() => setBizLoad(false));
  }, [adminInfo?.id, adminInfo?.token]);

  useEffect(() => {
    if (!businesses.length) return;
    const sp = new URLSearchParams(location.search);
    const sel = sp.get("selectedOrg");
    let id =
      sel && businesses.some((b) => String(b._id) === sel)
        ? sel
        : sessionStorage.getItem("settingsSelectedOrg");
    if (!id || !businesses.some((b) => String(b._id) === id)) {
      id = String(businesses[0]._id);
    }
    setBid(id);
    sessionStorage.setItem("settingsSelectedOrg", id);
    const next = new URLSearchParams(location.search);
    next.set("selectedOrg", id);
    const qs = next.toString();
    if (`?${qs}` !== location.search)
      history.replace(`${location.pathname}?${qs}`);
  }, [businesses, location.search, location.pathname, history]);

  const loadRow = useCallback(async () => {
    if (!bid) return;
    setRowBusy(true);
    setReady(false);
    try {
      const res = await ZohoBooksServices.getByBusinessId(bid);
      const rows = Array.isArray(res?.data) ? res.data : [];
      const r = rows[0] || null;
      setRecord(r);
      setForm((f) => ({
        ...f,
        organizationId: r?.organizationId || "",
        clientId: r?.clientId || "",
        clientSecret: "",
        baseUrl: booksRootToInvoisplsStyleDisplay(r?.booksApiBaseUrl),
        redirectUrl: (r?.redirectUrl || "").trim(),
      }));
      setOrgPick(r?.organizationId || "");
    } catch (e) {
      setRecord(null);
    } finally {
      setRowBusy(false);
      setReady(true);
    }
  }, [bid]);

  useEffect(() => {
    loadRow();
  }, [loadRow]);

  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const z = sp.get("zoho");
    if (!z || !bid) return;
    if (z === "connected") {
      notifySuccess(
        t(
          "accountsSettings.zohoBooks.connectSuccess",
          "Zoho Books connected successfully! Refreshing status…",
        ),
      );
      setJustConnected(true);
    }
    if (z === "error")
      notifyError(
        decodeURIComponent(
          sp.get("detail") ||
            sp.get("reason") ||
            t("accountsSettings.zohoBooks.oauthErrorDefault", "OAuth error"),
        ),
      );
    ["zoho", "reason", "detail", "needOrg", "org"].forEach((k) => sp.delete(k));
    const qs = sp.toString();
    history.replace(qs ? `${location.pathname}?${qs}` : location.pathname);
    loadRow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, location.pathname, bid, history, loadRow]);

  useEffect(() => {
    if (!justConnected) return undefined;
    const timer = setTimeout(() => setJustConnected(false), 6000);
    return () => clearTimeout(timer);
  }, [justConnected]);

  const loadOrgs = async () => {
    if (!bid || !record?.oauthConfigured) return;
    setOrgBusy(true);
    try {
      const r = await ZohoBooksServices.listOrganizations(bid);
      const rawList = Array.isArray(r?.data) ? r.data : [];
      const savedId =
        (r?.savedOrganizationId || record?.organizationId || "").trim();
      const savedName =
        r?.savedOrganizationName || record?.organizationName || "";
      const list = mergeSavedOrganization(rawList, savedId, savedName);
      setOrgs(list);
      setSavedOrgAccessible(
        r?.savedOrganizationAccessible !== false ||
          !savedId ||
          rawList.some((o) => String(o.organization_id) === savedId),
      );
      if (savedId) {
        setOrgPick(savedId);
      } else {
        const d = list.find((o) => o.is_default_org) || list[0];
        if (d) setOrgPick(String(d.organization_id));
      }
    } catch {
      notifyError(
        t("accountsSettings.zohoBooks.cantLoadOrganizations", "Can't load Zoho organizations."),
      );
    } finally {
      setOrgBusy(false);
    }
  };

  useEffect(() => {
    if (record?.oauthConfigured) loadOrgs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record?.oauthConfigured, bid]);

  const oauthCallbackUrl = useMemo(
    () =>
      resolveOAuthCallbackUrl({
        apiBase: API,
        formRedirect: form.redirectUrl,
        record,
      }),
    [form.redirectUrl, record],
  );

  useEffect(() => {
    if (!oauthCallbackUrl) return;
    console.info(
      "[PCI Zoho Books] OAuth callback URL (register this in Zoho API Console):",
      oauthCallbackUrl,
    );
  }, [oauthCallbackUrl]);

  const oauthOk = !!record?.oauthConfigured;
  const orgOk = !!(record?.organizationId || "").trim();
  const importsOk = oauthOk && orgOk;

  const initialLoading = bizLoad || (!!bid && !ready);
  const [panelVisible, setPanelVisible] = useState(false);
  useEffect(() => {
    if (initialLoading) {
      setPanelVisible(false);
      return undefined;
    }
    const frame = requestAnimationFrame(() => setPanelVisible(true));
    return () => cancelAnimationFrame(frame);
  }, [initialLoading]);

  const onSave = async (e) => {
    e.preventDefault();
    const allowSave = record?.clientId ? canUpdate : canAdd;
    if (!allowSave) {
      notifyError(
        record?.clientId
          ? t(
              "accountsSettings.zohoBooks.noPermissionUpdate",
              "You do not have permission to update Zoho Books settings.",
            )
          : t(
              "accountsSettings.zohoBooks.noPermissionConfigure",
              "You do not have permission to configure Zoho Books.",
            ),
      );
      return;
    }
    setSaving(true);
    try {
      const booksRoot =
        normalizeBooksApiRoot(form.baseUrl) || "https://www.zohoapis.com";
      const body = {
        business_id: bid,
        organizationId: form.organizationId.trim(),
        clientId: form.clientId.trim(),
        accountsBaseUrl: deriveAccountsHost(booksRoot),
        booksApiBaseUrl: booksRoot,
        redirectUrl:
          (form.redirectUrl || "").trim() ||
          oauthCallbackUrl ||
          oauthCallbackFromViteApiBase(API),
      };
      if (form.clientSecret.trim())
        body.clientSecret = form.clientSecret.trim();
      else if (!record?.hasClientSecret) {
        notifyError(
          t("accountsSettings.zohoBooks.clientSecretRequired", "Client secret required once."),
        );
        setSaving(false);
        return;
      }
      await ZohoBooksServices.saveDetails(body);
      notifySuccess(t("accountsSettings.zohoBooks.saved", "Saved."));
      await loadRow();
    } catch (err) {
      notifyError(err?.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  const onConnect = async () => {
    if (!canAdd) {
      notifyError(
        t(
          "accountsSettings.zohoBooks.noPermissionConnect",
          "You do not have permission to connect Zoho Books.",
        ),
      );
      return;
    }
    if (!record) {
      notifyError(
        t("accountsSettings.zohoBooks.saveCredentialsFirst", "Save credentials first."),
      );
      return;
    }
    setConnecting(true);
    try {
      const r = await ZohoBooksServices.authorizationUrl(bid);
      const url = r?.data?.url;
      if (!url)
        throw new Error(
          t("accountsSettings.zohoBooks.noAuthUrlReturned", "No auth URL returned"),
        );
      window.location.href = url;
    } catch (e) {
      notifyError(e?.response?.data?.message || e.message);
      setConnecting(false);
    }
  };

  const onPickOrg = async () => {
    if (!canUpdate) {
      notifyError(
        t(
          "accountsSettings.zohoBooks.noPermissionUpdate",
          "You do not have permission to update Zoho Books settings.",
        ),
      );
      return;
    }
    if (!orgPick.trim())
      return notifyError(
        t("accountsSettings.zohoBooks.pickAnOrganization", "Pick an organization."),
      );
    setOrgBusy(true);
    try {
      const meta = orgs.find((o) => String(o.organization_id) === orgPick);
      await ZohoBooksServices.selectOrganization(
        bid,
        orgPick.trim(),
        meta?.name || "",
      );
      notifySuccess(
        t("accountsSettings.zohoBooks.organizationSaved", "Organization saved."),
      );
      await loadRow();
    } catch (e) {
      notifyError(e?.response?.data?.message || e.message);
    } finally {
      setOrgBusy(false);
    }
  };

  const onTest = async () => {
    if (!canUpdate) {
      notifyError(
        t(
          "accountsSettings.zohoBooks.noPermissionUpdate",
          "You do not have permission to update Zoho Books settings.",
        ),
      );
      return;
    }
    setTesting(true);
    try {
      const r = await ZohoBooksServices.testConnection(bid);
      if (r?.status) notifySuccess(r.message || t("accountsSettings.zohoBooks.ok", "OK"));
      else
        notifyError(
          r?.message || t("accountsSettings.zohoBooks.checkFailed", "Check failed"),
        );
      await loadRow();
    } catch (e) {
      notifyError(e?.response?.data?.message || e.message);
    } finally {
      setTesting(false);
    }
  };

  const onRefreshTok = async () => {
    if (!canUpdate) {
      notifyError(
        t(
          "accountsSettings.zohoBooks.noPermissionUpdate",
          "You do not have permission to update Zoho Books settings.",
        ),
      );
      return;
    }
    setTokBusy(true);
    try {
      await ZohoBooksServices.refreshToken(bid);
      notifySuccess(t("accountsSettings.zohoBooks.tokenRefreshed", "Token refreshed."));
      await loadRow();
    } catch (e) {
      notifyError(e?.response?.data?.message || e.message);
    } finally {
      setTokBusy(false);
    }
  };

  const onDisc = async () => {
    if (!canDelete) {
      notifyError(
        t(
          "accountsSettings.zohoBooks.noPermissionDisconnect",
          "You do not have permission to disconnect Zoho Books.",
        ),
      );
      return;
    }
    setDiscBusy(true);
    try {
      await ZohoBooksServices.disconnect(bid);
      notifySuccess(t("accountsSettings.zohoBooks.disconnected", "Disconnected."));
      setOrgs([]);
      await loadRow();
    } catch (e) {
      notifyError(e?.response?.data?.message || e.message);
    } finally {
      setDiscBusy(false);
    }
  };

  const runSync = async (kind, d) => {
    if (!canUpdate) {
      notifyError(
        t(
          "accountsSettings.zohoBooks.noPermissionSync",
          "You do not have permission to sync Zoho Books data.",
        ),
      );
      return;
    }
    if (!canSyncKind(kind)) {
      const labels = syncEntityLabels[kind] || { plural: kind };
      notifyError(
        t(
          "accountsSettings.zohoBooks.noPermissionSyncEntity",
          "You do not have permission to sync {{plural}}.",
          { plural: labels.plural },
        ),
      );
      return;
    }
    setSyncing((s) => ({ ...s, [kind]: true }));
    try {
      const fnMap = {
        customers: ZohoBooksServices.syncCustomers,
        items: ZohoBooksServices.syncItems,
        invoices: ZohoBooksServices.syncInvoices,
        salesOrders: ZohoBooksServices.syncSalesOrders,
        recurringInvoices: ZohoBooksServices.syncRecurringInvoices,
        quotations: ZohoBooksServices.syncEstimates,
        payments: ZohoBooksServices.syncPayments,
        vendors: ZohoBooksServices.syncVendors,
        chartAccounts: ZohoBooksServices.syncChartAccounts,
        bankAccounts: ZohoBooksServices.syncBankAccounts,
      };
      const fn = fnMap[kind] || ZohoBooksServices.syncInvoices;
      const r = await fn(bid, d);
      if (r?.status === false) {
        if (r?.requiresStartDate) {
          notifyError(
            r.message ||
              t("accountsSettings.zohoBooks.startDateRequired", "Start date required."),
          );
          setDateTarget(kind);
          setDateVal(todayForPicker());
        } else
          notifyError(
            r?.message ||
              t("accountsSettings.zohoBooks.syncFailedGeneric", "Sync failed"),
          );
      } else {
        const summary = r?.data || {};
        notifySuccess(formatSyncSummaryMessage(t, kind, summary, syncEntityLabels));
        await loadRow();
      }
    } catch (e) {
      const p = e?.response?.data;
      if (p?.requiresStartDate) {
        setDateTarget(kind);
        setDateVal(todayForPicker());
      }
      notifyError(p?.message || e.message);
    } finally {
      setSyncing((s) => ({ ...s, [kind]: false }));
    }
  };

  const inputCls =
    "mt-1 w-full border border-gray-200 rounded-lg p-2 text-sm shadow-sm focus:ring-1 focus:ring-blue-400 focus:border-blue-400";

  const connectionLabel = importsOk
    ? record?.organizationName
      ? t("accountsSettings.zohoBooks.connectedWithOrgName", "Connected — {{name}}", {
          name: record.organizationName,
        })
      : record?.organizationId
        ? t("accountsSettings.zohoBooks.connectedWithOrgId", "Connected — org {{id}}", {
            id: record.organizationId,
          })
        : t("accountsSettings.zohoBooks.connectedReadyToSync", "Connected — ready to sync")
    : oauthOk
      ? t("accountsSettings.zohoBooks.oauthOkSelectOrg", "OAuth OK — select Books organization")
      : record?.clientId
        ? t(
            "accountsSettings.zohoBooks.credentialsSavedConnect",
            "Credentials saved — connect Zoho",
          )
        : t("accountsSettings.zohoBooks.notConfigured", "Not configured");

  if (initialLoading) {
    return <ZohoBooksPanelSkeleton />;
  }

  return (
    <div
      className={`space-y-6 transition-all duration-300 ease-out ${
        panelVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1.5"
      }`}
    >
      {justConnected ? (
        <div
          role="status"
          className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 shadow-sm flex items-start gap-3"
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-emerald-900">
              {t(
                "accountsSettings.zohoBooks.connectSuccessBanner",
                "Zoho Books connected successfully!",
              )}
            </p>
            <p className="text-xs text-emerald-800 mt-0.5">
              {t(
                "accountsSettings.zohoBooks.authCompletedRefreshing",
                "Authorization completed. Refreshing connection status",
              )}
              {oauthOk && !orgOk
                ? ` ${t(
                    "accountsSettings.zohoBooks.pickOrgToFinishSetup",
                    "— pick a Books organization below to finish setup.",
                  )}`
                : t("accountsSettings.zohoBooks.refreshingEllipsis", "…")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setJustConnected(false)}
            className="text-xs font-medium text-emerald-700 hover:text-emerald-900 shrink-0"
          >
            {t("accountsSettings.zohoBooks.dismiss", "Dismiss")}
          </button>
        </div>
      ) : null}

      {/* Connection status */}
      <div
        className={`rounded-xl border p-4 shadow-sm ${
          importsOk
            ? "border-emerald-200 bg-emerald-50/60"
            : oauthOk
              ? "border-amber-200 bg-amber-50/60"
              : "border-gray-200 bg-white"
        }`}
      >
        <div className="flex flex-wrap items-start gap-3">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
              importsOk
                ? "bg-emerald-100"
                : oauthOk
                  ? "bg-amber-100"
                  : "bg-gray-100"
            }`}
          >
            {importsOk ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : (
              <Link2 className="w-5 h-5 text-gray-600" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">
              {connectionLabel}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {t(
                "accountsSettings.zohoBooks.connectDescription",
                "Connect Zoho Books to sync customers, vendors, items, invoices, payments, chart of accounts, and bank accounts into PCI for the selected business.",
              )}
              {importsOk && record?.organizationId ? (
                <span className="block mt-1 font-medium text-emerald-800">
                  {t("accountsSettings.zohoBooks.activeOrganization", "Active organization:")}{" "}
                  {record.organizationName ||
                    t("accountsSettings.zohoBooks.unnamed", "Unnamed")}{" "}
                  <span className="font-mono text-emerald-700">
                    {t("accountsSettings.zohoBooks.idLabel", "(ID: {{id}})", {
                      id: record.organizationId,
                    })}
                  </span>
                </span>
              ) : null}
            </p>
          </div>
          {!importsOk ? (
            <button
              type="button"
              onClick={() => setSetupGuideOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-blue-200 text-blue-800 bg-white rounded-lg hover:bg-blue-50 shrink-0"
            >
              <BookOpen className="w-4 h-4" />
              {t("accountsSettings.zohoBooks.setupGuide", "Setup guide")}
            </button>
          ) : null}
        </div>
      </div>

      <section className="rounded-xl border border-gray-200 p-6 bg-white shadow-sm space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {t("accountsSettings.zohoBooks.credentialsTitle", "Zoho API Credentials")}
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              {t(
                "accountsSettings.zohoBooks.credentialsSubtitle",
                "From Zoho API Console — use the setup guide if this is your first connection.",
              )}
            </p>
          </div>
          {/* <button
            type="button"
            onClick={() => setSetupGuideOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100"
          >
            <BookOpen className="w-4 h-4" />
            Need help?
          </button> */}
        </div>

        <form onSubmit={onSave} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <label className="text-sm font-medium text-gray-800 block md:col-span-2">
              {t("accountsSettings.zohoBooks.baseUrlLabel", "Base URL")}
              <input
                className={inputCls}
                value={form.baseUrl}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    baseUrl: e.target.value,
                  }))
                }
                placeholder={t(
                  "accountsSettings.zohoBooks.baseUrlPlaceholder",
                  "e.g. https://www.zohoapis.com/books/v3",
                )}
              />
              <p className="text-xs text-gray-500 mt-1 font-normal">
                {t("accountsSettings.zohoBooks.regionLabel", "Region:")}{" "}
                <code className="bg-gray-100 px-1 rounded">zohoapis.com</code>{" "}
                {t("accountsSettings.zohoBooks.regionUs", "(US)")} ·{" "}
                <code className="bg-gray-100 px-1 rounded">zohoapis.eu</code> ·{" "}
                <code className="bg-gray-100 px-1 rounded">zohoapis.in</code> ·{" "}
                <code className="bg-gray-100 px-1 rounded">
                  zohoapis.com.au
                </code>
              </p>
            </label>

            <label className="text-sm font-medium text-gray-800 block">
              {t("accountsSettings.zohoBooks.orgIdLabel", "Organization ID")}
              <input
                className={inputCls}
                value={form.organizationId}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    organizationId: e.target.value,
                  }))
                }
                placeholder={t(
                  "accountsSettings.zohoBooks.orgIdPlaceholder",
                  "From Zoho Books → Settings → Organization",
                )}
              />
            </label>

            <label className="text-sm font-medium text-gray-800 block">
              {t("accountsSettings.zohoBooks.clientIdLabel", "Client ID")}{" "}
              <span className="text-rose-600">*</span>
              <input
                required
                className={inputCls}
                value={form.clientId}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    clientId: e.target.value,
                  }))
                }
                placeholder={t(
                  "accountsSettings.zohoBooks.clientIdPlaceholder",
                  "From Zoho API Console (not your email)",
                )}
              />
            </label>

            <label className="text-sm font-medium text-gray-800 block md:col-span-2">
              {t("accountsSettings.zohoBooks.clientSecretLabel", "Client Secret")}{" "}
              {record?.hasClientSecret ? (
                <span className="text-gray-500 font-normal text-xs">
                  {t("accountsSettings.zohoBooks.clientSecretKeepHint", "(leave blank to keep)")}
                </span>
              ) : (
                <span className="text-rose-600">*</span>
              )}
              <input
                type="password"
                autoComplete="new-password"
                className={inputCls}
                value={form.clientSecret}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    clientSecret: e.target.value,
                  }))
                }
                placeholder={
                  record?.hasClientSecret
                    ? t(
                        "accountsSettings.zohoBooks.clientSecretPlaceholderKeep",
                        "Leave blank to keep existing",
                      )
                    : t(
                        "accountsSettings.zohoBooks.clientSecretPlaceholderNew",
                        "From Zoho API Console",
                      )
                }
              />
            </label>

            <label className="text-sm font-medium text-gray-800 block md:col-span-2">
              {t("accountsSettings.zohoBooks.redirectUrlLabel", "Redirect URL")}
              <input
                className={inputCls}
                value={form.redirectUrl}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    redirectUrl: e.target.value,
                  }))
                }
                placeholder={
                  oauthCallbackUrl ||
                  t(
                    "accountsSettings.zohoBooks.redirectUrlPlaceholderAuto",
                    "Auto-resolved from this server's API URL",
                  )
                }
              />
              {oauthCallbackUrl ? (
                <p className="text-xs text-gray-500 mt-1 font-normal">
                  {t("accountsSettings.zohoBooks.currentlyUsing", "Currently using:")}{" "}
                  <span className="font-mono text-gray-700 break-all">
                    {oauthCallbackUrl}
                  </span>
                  <span className="block text-[11px] text-gray-400 mt-0.5">
                    {t(
                      "accountsSettings.zohoBooks.redirectMustMatchHint",
                      "This exact URL must be registered as an Authorized Redirect URI in Zoho API Console.",
                    )}
                  </span>
                </p>
              ) : (
                <p className="text-xs text-gray-500 mt-1 font-normal">
                  {t(
                    "accountsSettings.zohoBooks.enterRedirectHint",
                    "Enter the Authorized Redirect URI you registered in Zoho API Console.",
                  )}
                </p>
              )}
            </label>
          </div>

          <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
            {(record?.clientId ? canUpdate : canAdd) && (
            <button
              disabled={rowBusy || saving}
              type="submit"
              className="px-4 py-2.5 bg-[var(--p-blue)] text-white rounded-lg disabled:opacity-50 text-sm font-medium"
            >
              {saving
                ? t("accountsSettings.zohoBooks.saving", "Saving…")
                : t("accountsSettings.zohoBooks.saveCredentials", "Save credentials")}
            </button>
            )}
            {canAdd && (
            <button
              type="button"
              disabled={!record || connecting}
              className="px-4 py-2.5 bg-emerald-600 text-white rounded-lg disabled:opacity-50 text-sm font-medium"
              onClick={onConnect}
            >
              {connecting
                ? t("accountsSettings.zohoBooks.redirecting", "Redirecting…")
                : t("accountsSettings.zohoBooks.connectToZoho", "Connect to Zoho Books")}
            </button>
            )}
            {canDelete && (
            <button
              type="button"
              disabled={discBusy || !record}
              className="px-4 py-2.5 border border-rose-200 bg-rose-50 text-rose-800 text-sm rounded-lg"
              onClick={onDisc}
            >
              {t("accountsSettings.zohoBooks.disconnect", "Disconnect")}
            </button>
            )}
            {canUpdate && (
            <>
            <button
              type="button"
              disabled={tokBusy || !oauthOk}
              className="inline-flex items-center gap-1 px-4 py-2.5 border rounded-lg text-sm"
              onClick={onRefreshTok}
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${tokBusy ? "animate-spin" : ""}`}
              />
              {t("accountsSettings.zohoBooks.refreshToken", "Refresh token")}
            </button>
            <button
              type="button"
              disabled={testing || !oauthOk}
              className="px-4 py-2.5 border rounded-lg text-sm"
              onClick={onTest}
            >
              {testing
                ? t("accountsSettings.zohoBooks.testing", "Testing…")
                : t("accountsSettings.zohoBooks.testConnection", "Test connection")}
            </button>
            </>
            )}
          </div>
        </form>
      </section>

      <ZohoBooksSetupGuideModal
        open={setupGuideOpen}
        onClose={() => setSetupGuideOpen(false)}
        oauthCallbackUrl={oauthCallbackUrl}
        homepageUrl={getPublicAppUrl()}
      />

      {oauthOk ? (
        <section className="rounded-xl border border-gray-200 p-6 bg-white shadow-sm space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">
            {t("accountsSettings.zohoBooks.orgSectionTitle", "Zoho Books organization")}
          </h3>
          <p className="text-xs text-gray-500">
            {t(
              "accountsSettings.zohoBooks.orgSectionDesc",
              "After OAuth, choose which Zoho Books organization maps to this PCI business. The saved Organization ID above is used for sync — pick the matching org below and click Save organization.",
            )}
          </p>

          {record?.organizationId ? (
            <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 text-xs text-blue-900">
              <span className="font-medium">
                {t("accountsSettings.zohoBooks.savedForBusiness", "Saved for this business:")}
              </span>{" "}
              {record.organizationName ||
                t("accountsSettings.zohoBooks.organizationFallback", "Organization")}{" "}
              <span className="font-mono">({record.organizationId})</span>
              {!savedOrgAccessible ? (
                <span className="block mt-1 text-amber-800">
                  {t(
                    "accountsSettings.zohoBooks.notInOrgList",
                    "This ID is not in your connected Zoho account's org list. Reconnect with the Zoho account that owns this organization, or pick the correct org below.",
                  )}
                </span>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-col md:flex-row gap-2 md:items-end">
            <label className="text-sm flex-1">
              {t("accountsSettings.zohoBooks.orgSelectLabel", "Zoho Books org")}
              <select
                className="mt-1 w-full border rounded p-2"
                disabled={orgBusy}
                value={orgPick}
                onChange={(e) => setOrgPick(e.target.value)}
              >
                <option value="">
                  {t("accountsSettings.zohoBooks.selectPlaceholder", "Select…")}
                </option>
                {orgs.map((o) => (
                  <option
                    key={o.organization_id}
                    value={String(o.organization_id)}
                  >
                    {o.name || o.organization_id}
                    {String(o.organization_id) === String(record?.organizationId || "")
                      ? ` ${t("accountsSettings.zohoBooks.savedSuffix", "(saved)")}`
                      : o.is_saved_only
                        ? ` ${t(
                            "accountsSettings.zohoBooks.savedVerifySuffix",
                            "(saved ID — verify access)",
                          )}`
                        : ""}
                  </option>
                ))}
              </select>
            </label>
            {canUpdate && (
            <>
            <button
              type="button"
              className="px-3 py-2 border rounded-lg text-sm"
              disabled={orgBusy}
              onClick={loadOrgs}
            >
              {t("accountsSettings.zohoBooks.reloadList", "Reload list")}
            </button>

            <button
              type="button"
              className="px-4 py-2 bg-[var(--p-blue)] text-white rounded-lg text-sm disabled:opacity-50"
              disabled={orgBusy || !orgPick}
              onClick={onPickOrg}
            >
              {t("accountsSettings.zohoBooks.saveOrganization", "Save organization")}
            </button>
            </>
            )}
          </div>
        </section>
      ) : null}

      {importsOk ? (
        <section className="rounded-xl border border-gray-200 p-6 bg-white shadow-sm space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">
            {t("accountsSettings.zohoBooks.syncSectionTitle", "Sync from Zoho Books")}
          </h3>
          <p className="text-xs text-gray-500">
            {t(
              "accountsSettings.zohoBooks.syncSectionDesc",
              "First run may need a start date ({{dateFormat}}). Later runs are incremental.",
              { dateFormat: dateFormatLabel },
            )}
          </p>
          <div className="grid md:grid-cols-3 gap-3">
            {visibleSyncCards.map((tCard) => (
              <div key={tCard.k} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 font-medium text-sm">
                  <tCard.icon className="w-4 h-4 text-blue-600" />
                  {tCard.label}
                </div>
                <div className="text-xs text-gray-500">
                  {t("accountsSettings.zohoBooks.lastLabel", "Last:")}{" "}
                  {tCard.last ? formatDateTime(tCard.last) : "—"}
                </div>
                {tCard.hint ? (
                  <div className="text-[11px] text-gray-500 leading-snug">
                    {tCard.hint}
                  </div>
                ) : null}
                {canUpdate && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={syncing[tCard.k]}
                    className="text-xs px-2 py-1 bg-[var(--p-blue)] text-white rounded"
                    onClick={() => runSync(tCard.k, null)}
                  >
                    {syncing[tCard.k]
                      ? t("accountsSettings.zohoBooks.syncingEllipsis", "…")
                      : t("accountsSettings.zohoBooks.syncBtn", "Sync")}
                  </button>
                  <button
                    type="button"
                    disabled={syncing[tCard.k]}
                    className="text-xs px-2 py-1 border rounded"
                    onClick={() => {
                      setDateTarget(tCard.k);
                      setDateVal(todayForPicker());
                    }}
                  >
                    {t("accountsSettings.zohoBooks.fromDateBtn", "From date…")}
                  </button>
                </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {dateTarget && dateModalCopy ? (
        <ModalPortal>
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4 sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="zoho-sync-date-title"
            onClick={() => setDateTarget(null)}
          >
            <div
              className="relative w-full max-w-sm rounded-xl border border-gray-200 bg-white p-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h4 id="zoho-sync-date-title" className="font-semibold text-gray-900 mb-2">
                {dateModalCopy.title}
              </h4>
              <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                {dateModalCopy.description}
              </p>
              <CustomDatePicker
                value={dateVal}
                onChange={(date) => setDateVal(date || todayForPicker())}
                maxDate={todayForPicker()}
                clearable={false}
                theme="default"
              />
              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  className="px-3 py-1.5 border rounded text-sm"
                  onClick={() => setDateTarget(null)}
                >
                  {t("accountsSettings.zohoBooks.cancel", "Cancel")}
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 bg-[var(--p-blue)] text-white rounded text-sm"
                  onClick={async () => {
                    const apiDate = toApiStartDate(dateVal);
                    if (!apiDate) {
                      notifyError(
                        t(
                          "accountsSettings.zohoBooks.pickValidStartDate",
                          "Pick a valid start date ({{dateFormat}}).",
                          { dateFormat: dateFormatLabel },
                        ),
                      );
                      return;
                    }
                    const target = dateTarget;
                    setDateTarget(null);
                    await runSync(target, apiDate);
                  }}
                >
                  {t("accountsSettings.zohoBooks.run", "Run")}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      ) : null}
    </div>
  );
}
