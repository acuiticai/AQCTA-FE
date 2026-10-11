/**
 * Permission path for each link on /settings (maps via settings paths in permissionUtils).
 * Extract pathname from href for checks.
 */
import {
  findModuleByName,
  findSubModuleByNameGlobally,
  hasPermission,
  PERMISSION_ACTION,
} from "./permissionUtils";
import {
  isHiddenSettingsItem,
  isHiddenSettingsSection,
} from "./hiddenSidebarPaths";

export function pathFromSettingsHref(href) {
  if (!href || typeof href !== "string") return "";
  const q = href.indexOf("?");
  const path = q >= 0 ? href.slice(0, q) : href;
  return path.startsWith("/") ? path : `/${path}`;
}

/** All settings sub-modules: display name, route path, section title */
export const SETTINGS_MODULE_REGISTRY = [
  // Accounts
  {
    section: "Accounts",
    name: "E-Invoice Settings",
    path: "/accounts/e-invoice-settings",
  },
  { section: "Accounts", name: "Payment Reminders", path: "/reminders" },
  { section: "Accounts", name: "Cheque Reminders", path: "/cheque-reminders" },
  { section: "Accounts", name: "Taxes", path: "/taxes" },
  {
    section: "Accounts",
    name: "Vendor Invoice Approval",
    path: "/vendor-invoice-approval",
  },
  {
    section: "Accounts",
    name: "Credit Notes Approval",
    path: "/credit-notes-approval",
  },
  {
    section: "Accounts",
    name: "Special Transfers Types",
    path: "/special-transfers-types",
  },
  { section: "Accounts", name: "Payment Methods", path: "/PaymentMethods" },
  { section: "Accounts", name: "Transaction Types", path: "/TransactionTypes" },
  { section: "Accounts", name: "Advance Types", path: "/AdvanceTypes" },
  { section: "Accounts", name: "Sales Channels", path: "/Channels" },
  // Integrations
  {
    section: "Integrations",
    name: "Service Monster Config",
    path: "/accounts/service-monster",
  },
  { section: "Integrations", name: "Zoho Books", path: "/accounts/zoho-books" },
  {
    section: "Integrations",
    name: "WhatsApp Integration",
    path: "/accounts/whatsapp-integration",
  },
  {
    section: "Integrations",
    name: "Cliniko",
    path: "/settings/integrations/cliniko",
  },
  // Operations
  {
    section: "Operations",
    name: "Application Documents",
    path: "/settings/application-documents",
  },
  {
    section: "Operations",
    name: "Application Fields",
    path: "/settings/application-fields",
  },
  {
    section: "Operations",
    name: "Class / Category",
    path: "/settings/class-categories",
  },
  // Fleet
  {
    section: "Fleet management",
    name: "Vehicle types",
    path: "/fleet-job-scheduling-settings",
  },
  // Document Manager
  {
    section: "Document Manager",
    name: "Misc. Data Types",
    path: "/Documents_Misc_Data_Types",
  },
  {
    section: "Document Manager",
    name: "Document Types",
    path: "/document-types",
  },
  // Finance
  {
    section: "Finance",
    name: "Misc. Data Types",
    path: "/Finance_Misc_Data_Types",
  },
  { section: "Finance", name: "Currency", path: "/Currency" },
  // HR
  {
    section: "HR Management",
    name: "Departments & Positions",
    path: "/Departments_Positions",
  },
  {
    section: "HR Management",
    name: "Foreign Worker Management",
    path: "/Foreign_Worker_Management",
  },
  { section: "HR Management", name: "Leaves", path: "/Leaves" },
  { section: "HR Management", name: "Claims", path: "/claims" },
  {
    section: "HR Management",
    name: "Branches & Locations",
    path: "/Branch_Locations",
  },
  { section: "HR Management", name: "Shifts", path: "/Shifts" },
  {
    section: "HR Management",
    name: "Public Holidays",
    path: "/PublicHolidays",
  },
  { section: "HR Management", name: "WFH Allowance", path: "/WFHSettings" },
  // Payroll
  { section: "Payroll", name: "Pay Elements", path: "/payroll-pay-elements" },
  { section: "Payroll", name: "Settings", path: "/payroll-company-settings" },
  {
    section: "Payroll",
    name: "Statutory Config",
    path: "/payroll-statutory-settings",
  },
  { section: "Payroll", name: "Pay Groups", path: "/payroll-pay-groups" },
  // Items — hidden (not in use)
  // { section: "Items", name: "Misc. Data Types", path: "/Item_Misc_Data_Types" },
  // { section: "Items", name: "Tax Classes", path: "/tax-classes" },
  // Miscellaneous — hidden (not in use)
  // { section: "Miscellaneous", name: "Misc. Data Types", path: "/Miscellanious_Misc_Data_Types" },
  // Notification
  {
    section: "Notification",
    name: "Notification Events",
    path: "/notification-events",
  },
  // POS
  { section: "POS", name: "POS Settings", path: "/pos/settings" },
  // Operations — hidden (not in use)
  // { section: "Operations", name: "Misc. Data Types", path: "/Operations_Misc_Data_Types" },
  // Purchase
  {
    section: "Purchase",
    name: "Misc. Data Types",
    path: "/Purchase_Misc_Data_Types",
  },
  // Customer (formerly Sales) — Address Types via Misc. Data Types
  {
    section: "Customer",
    name: "Dynamic Module Labels",
    path: "/settings/module-labels",
  },
  {
    section: "Customer",
    name: "Misc. Data Types",
    path: "/Sales_Misc_Data_Types",
  },
  // Templates
  {
    section: "Templates",
    name: "Document Templates",
    path: "/document_templates",
  },
  // Treasury
  {
    section: "Treasury & Finance",
    name: "Account Types",
    path: "/account-types",
  },
  {
    section: "Treasury & Finance",
    name: "Bank Account Types",
    path: "/bank-account-types",
  },
  {
    section: "Treasury & Finance",
    name: "Bank Account Mapping",
    path: "/bank-account-mapping",
  },
  // Clone (uses parent /settings)
  { section: "Clone Settings", name: "Clone Settings", path: "/settings" },
  // Custom fields (not on main grid but linked from elsewhere)
  { section: "Customer", name: "Custom Fields", path: "/settings/custom-fields" },
];

/**
 * Maps settings hub section titles to subscription catalog keys (self-registered tenants).
 * Sections listed in SETTINGS_SECTION_ROLE_ACCESS are gated by ERP module permission instead.
 */
export const SETTINGS_SECTION_MODULE_KEYS = {
  Accounts: "Accounts",
  "HR Management": "HR",
  Payroll: "Payroll",
  Items: "Items",
  Notification: "Broadcast",
  POS: "POS",
  Purchase: "Purchase",
  Sales: "Sales",
  Customer: "Sales",
  "Treasury & Finance": "Treasury",
};

/**
 * Section visible when the tenant subscribes to any one of these modules.
 */
export const SETTINGS_SECTION_MODULE_KEYS_ANY = {
  Finance: ["Accounts", "Sales", "Items"],
};

/**
 * ERP module access required to show a settings section (all tenants).
 * Checked via role module View + list-screen paths on assigned modules.
 */
export const SETTINGS_SECTION_ROLE_ACCESS = {
  "Fleet management": {
    moduleNames: [
      "Fleet & Job Scheduling",
      "Fleet and Job Scheduling",
      "Jobs and Scheduling",
      "Jobs & Scheduling",
      "Job Scheduling",
      "Scheduling",
      "Jobs",
    ],
    gatePaths: ["/jobs", "/scheduling", "/fleet-jobs"],
  },
  "Document Manager": {
    moduleNames: ["Document Manager", "Docs Management", "Docs"],
    gatePaths: ["/docs-management"],
  },
  Templates: {
    moduleNames: ["Document Manager", "Docs Management", "Docs", "Templates"],
    gatePaths: ["/document_templates", "/docs-management"],
  },
  "Clone Settings": {
    moduleNames: ["Business Group"],
    gatePaths: ["/business-group", "/business", "/Business"],
  },
};

/**
 * Per integration link: which subscription / ERP module is required.
 * Integrations section is shown when at least one item passes all filters.
 */
/**
 * Taxes (Accounts > Taxes) are shared across modules that attach taxId / taxOnItem:
 * Items, Sales (orders, quotations, invoices), Purchase (POs, vendor invoices),
 * Accounts (customer/vendor invoices, credit/debit notes, tax reports), POS.
 */
export const TAXES_MODULE_SUBSCRIPTION_KEYS_ANY = [
  "Accounts",
  "Sales",
  "Purchase",
  "Items",
  "POS",
];

export const SETTINGS_ITEM_MODULE_DEPS = {
  "/taxes": {
    subscriptionKeysAny: TAXES_MODULE_SUBSCRIPTION_KEYS_ANY,
  },
  "/accounts/whatsapp-integration": {
    subscriptionKey: "Broadcast",
    roleAccess: {
      moduleNames: ["Broadcast", "Broadcasts"],
      gatePaths: ["/broadcasts"],
    },
  },
  "/accounts/service-monster": {
    subscriptionKey: "Sales",
    roleAccess: {
      moduleNames: ["Sales"],
      gatePaths: ["/customers", "/sales-orders", "/items"],
    },
  },
  "/accounts/zoho-books": {
    subscriptionKey: "Sales",
    roleAccess: {
      moduleNames: ["Sales"],
      gatePaths: ["/customers", "/sales-orders", "/items"],
    },
  },
};

const ROLE_MODULE_NAME_TO_SUBSCRIPTION_KEY = {
  sales: "SALES",
  purchase: "PURCHASE",
  accounts: "ACCOUNTS",
  "treasury & finance": "TREASURY",
  treasury: "TREASURY",
  "hr management": "HR",
  hr: "HR",
  payroll: "PAYROLL",
  broadcast: "BROADCAST",
  pos: "POS",
  items: "ITEMS",
};

function normalizeSubscriptionKey(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

/**
 * Subscription module keys the tenant has access to (from subscription or role.modules).
 */
export function getSubscribedModuleKeys(adminInfo, roleModules) {
  const fromSubscription = adminInfo?.subscription?.subscribedModules || [];
  const keys = new Set();

  if (fromSubscription.length) {
    for (const key of fromSubscription) {
      keys.add(normalizeSubscriptionKey(key));
    }
  } else {
    for (const mod of roleModules || []) {
      const name = String(mod?.name || mod?.parentName || "")
        .trim()
        .toLowerCase();
      if (!name) continue;

      const direct = ROLE_MODULE_NAME_TO_SUBSCRIPTION_KEY[name];
      if (direct) keys.add(direct);

      for (const [alias, subKey] of Object.entries(
        ROLE_MODULE_NAME_TO_SUBSCRIPTION_KEY,
      )) {
        if (name.includes(alias) || alias.includes(name)) {
          keys.add(subKey);
        }
      }
    }
  }

  if (keys.has("SALES")) keys.add("ITEMS");
  return keys;
}

function moduleEntryHasView(entry) {
  const perms = Array.isArray(entry?.permissions) ? entry.permissions : [];
  return hasPermission(perms, PERMISSION_ACTION.VIEW);
}

/** True when the role grants View on the ERP module tied to this settings section. */
export function roleHasSettingsSectionAccess(
  roleModules,
  sectionTitle,
  canAccessPath,
  isSuperAdmin = false,
) {
  if (isSuperAdmin) return true;

  const rule = SETTINGS_SECTION_ROLE_ACCESS[sectionTitle];
  if (!rule) return true;

  return roleMatchesAccessRule(roleModules, canAccessPath, rule);
}

function roleMatchesAccessRule(roleModules, canAccessPath, rule) {
  if (!rule) return true;

  if (
    Array.isArray(rule.gatePaths) &&
    rule.gatePaths.some((path) => canAccessPath(path))
  ) {
    return true;
  }

  for (const name of rule.moduleNames || []) {
    const parent = findModuleByName(roleModules, name);
    if (parent && moduleEntryHasView(parent)) return true;

    const sub = findSubModuleByNameGlobally(roleModules, name);
    if (sub && moduleEntryHasView(sub)) return true;
  }

  return false;
}

function itemMatchesSubscriptionKeys(rule, subscribedKeys) {
  if (rule.subscriptionKeysAny?.length) {
    return rule.subscriptionKeysAny.some((key) =>
      subscribedKeys?.has(normalizeSubscriptionKey(key)),
    );
  }
  if (rule.subscriptionKey) {
    return subscribedKeys?.has(normalizeSubscriptionKey(rule.subscriptionKey));
  }
  return false;
}

/** Item-level module dependency (integrations, taxes, etc.). */
export function itemPassesModuleDeps(
  itemPath,
  {
    roleModules,
    canAccessPath,
    isSuperAdmin = false,
    subscribedKeys,
    applyModuleFilter = false,
    sectionSubscriptionKey = null,
  },
) {
  if (isSuperAdmin) return true;

  const normalized = pathFromSettingsHref(itemPath).toLowerCase();
  const rule = SETTINGS_ITEM_MODULE_DEPS[normalized];

  if (
    rule?.roleAccess &&
    !roleMatchesAccessRule(roleModules, canAccessPath, rule.roleAccess)
  ) {
    return false;
  }

  if (!applyModuleFilter) return true;

  if (rule) {
    return itemMatchesSubscriptionKeys(rule, subscribedKeys);
  }

  if (sectionSubscriptionKey) {
    return subscribedKeys?.has(normalizeSubscriptionKey(sectionSubscriptionKey));
  }

  return true;
}

export function filterSettingsSectionsByRoleAccess(
  sections,
  { roleModules, canAccessPath, isSuperAdmin },
) {
  return sections.filter((section) =>
    roleHasSettingsSectionAccess(
      roleModules,
      section.title,
      canAccessPath,
      isSuperAdmin,
    ),
  );
}

export function isSettingsSectionVisibleForModules(
  sectionTitle,
  subscribedKeys,
) {
  const anyOf = SETTINGS_SECTION_MODULE_KEYS_ANY[sectionTitle];
  if (Array.isArray(anyOf) && anyOf.length) {
    return anyOf.some((key) =>
      subscribedKeys.has(normalizeSubscriptionKey(key)),
    );
  }

  const required = SETTINGS_SECTION_MODULE_KEYS[sectionTitle];
  if (required == null) return true;
  return subscribedKeys.has(normalizeSubscriptionKey(required));
}

/**
 * Hide settings sections that do not match subscribed modules (self-registered tenants).
 * Sections with cross-module items (e.g. Taxes under Accounts) may remain after item-level filtering.
 */
export function filterSettingsSectionsBySubscribedModules(
  sections,
  subscribedKeys,
) {
  if (!subscribedKeys?.size) return sections;
  return sections.filter((section) => {
    if ((section.items || []).length === 0) return false;
    if (isSettingsSectionVisibleForModules(section.title, subscribedKeys)) {
      return true;
    }
    return (section.items || []).some((item) => {
      if (!item?.href) return false;
      const rule =
        SETTINGS_ITEM_MODULE_DEPS[pathFromSettingsHref(item.href).toLowerCase()];
      return rule ? itemMatchesSubscriptionKeys(rule, subscribedKeys) : false;
    });
  });
}

/**
 * RBAC filter + optional module-based filter for self-registered tenants.
 */
export function filterVisibleSettingsSections(
  sections,
  {
    canAccessPath,
    subscribedKeys,
    applyModuleFilter,
    roleModules,
    isSuperAdmin = false,
  },
) {
  const productFiltered = (sections || []).filter(
    (section) => !isHiddenSettingsSection(section?.title),
  )
        .map((section) => ({
          ...section,
          items: (section.items || []).filter(
            (item) =>
              !isHiddenSettingsItem({
                name: item?.name,
                href: item?.href,
                sectionTitle: section?.title,
              }),
          ),
        }))
        .filter((section) => (section.items || []).length > 0);

  const rbacFiltered = filterSettingsSections(productFiltered, canAccessPath, {
    roleModules,
    canAccessPath,
    isSuperAdmin,
    subscribedKeys,
    applyModuleFilter,
  });
  const roleFiltered = filterSettingsSectionsByRoleAccess(rbacFiltered, {
    roleModules,
    canAccessPath,
    isSuperAdmin,
  });
  if (!applyModuleFilter || isSuperAdmin) return roleFiltered;
  return filterSettingsSectionsBySubscribedModules(
    roleFiltered,
    subscribedKeys,
  );
}

/**
 * Filter settings section items by RBAC View on each item's route path.
 */
export function filterSettingsSections(
  sections,
  canAccessPath,
  moduleContext = null,
) {
  if (typeof canAccessPath !== "function") return sections;

  return sections
    .map((section) => ({
      ...section,
      items: (section.items || []).filter((item) => {
        if (!item?.name) return false;
        if (item.isAction) {
          if (!canAccessPath(item.requiredPath || "/settings")) return false;
        } else if (!item.href) {
          return false;
        } else if (!canAccessPath(pathFromSettingsHref(item.href))) {
          return false;
        }

        if (moduleContext && item.href) {
          return itemPassesModuleDeps(item.href, {
            ...moduleContext,
            sectionSubscriptionKey: moduleContext.applyModuleFilter
              ? (SETTINGS_SECTION_MODULE_KEYS[section.title] ?? null)
              : null,
          });
        }
        return true;
      }),
    }))
    .filter((section) => (section.items || []).length > 0);
}
