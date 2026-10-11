/**
 * Product navigation blueprint + allowlist.
 *
 * Sidebar / Home / UserRoles / Modules only show this tree. Legacy ERP module
 * names (Sales, Global Settings, Customer Invoices, …) map in via aliases.
 */

/* Zero-width joiners/spaces survive a copy-paste into the Modules admin and are
   invisible in every UI, but they break name matching — strip them everywhere. */
const INVISIBLE_CHARS = /[\u200B-\u200D\u2060\uFEFF]/g;

const stripInvisible = (value = "") =>
  String(value || "").replace(INVISIBLE_CHARS, "");

const norm = (value = "") =>
  stripInvisible(value).trim().replace(/\s+/g, " ").toLowerCase();

const withSlash = (path = "") => {
  const raw = stripInvisible(path).trim();
  if (!raw) return "";
  return raw.startsWith("/") ? raw : `/${raw}`;
};

/**
 * Exact product IA. Order here = sidebar order.
 * `aliases` / `paths` hydrate real module records from the API.
 */
export const PRODUCT_NAV_BLUEPRINT = [
  {
    key: "dashboard",
    label: "Dashboard",
    aliases: ["dashboard"],
    paths: ["/dashboard", "/home"],
    icon: "FiGrid",
    children: [],
  },
  {
    key: "items",
    label: "Items",
    aliases: ["items"],
    paths: ["/items"],
    icon: "FiList",
    children: [
      {
        key: "product",
        label: "Product",
        aliases: ["product", "products", "items"],
        paths: ["/items", "/products"],
      },
      {
        key: "category",
        label: "Category",
        aliases: ["category", "categories"],
        paths: ["/categories", "/category"],
      },
    ],
  },
  {
    key: "customers",
    label: "Customers",
    aliases: ["customers", "customer"],
    paths: ["/customers"],
    icon: "FiUsers",
    children: [],
  },
  {
    key: "operations",
    label: "Operations",
    aliases: ["operations", "applications", "sales"],
    paths: ["/sales", "/applications", "/operations"],
    icon: "FiBriefcase",
    children: [
      {
        key: "enquiry",
        label: "Enquiries",
        aliases: ["enquiry", "enquiries"],
        paths: ["/enquiry", "/enquiries"],
      },
      {
        key: "applications",
        label: "Applications",
        aliases: ["applications", "application"],
        paths: ["/applications", "/my-applications"],
      },
      {
        key: "projects",
        label: "Projects",
        aliases: ["projects", "project", "auditors", "auditor"],
        paths: ["/projects", "/auditors"],
      },
    ],
  },
  {
    key: "finance",
    label: "Finance",
    aliases: ["finance", "accounts"],
    paths: ["/finance", "/accounts"],
    icon: "FiCreditCard",
    children: [
      {
        key: "costing-sheet",
        label: "Costing Sheet",
        aliases: ["costing sheet", "costing sheets", "costing-sheet", "costing-sheets"],
        paths: ["/costing-sheet", "/costing-sheets"],
      },
      {
        key: "quotations",
        label: "Quotations",
        aliases: ["quotations", "quotation"],
        /* Keep Flexa Accounts Quotations (DocumentTemplate PDF, convert, email, etc.).
           AQCTA FOR-01-07 certification quotations are parked at
           /certification-quotations — do not use that UI/PDF for now. */
        forcePath: "/quotations",
        paths: ["/quotations", "/certification-quotations"],
      },
      {
        key: "invoices",
        label: "Invoices",
        aliases: ["invoices", "invoice", "customer invoices", "customer invoice"],
        /* Keep Flexa Customer Invoices (partial paid, bulk pay, LHDN, etc.).
           Certification project invoices live at /certification-invoices if needed. */
        forcePath: "/customer-invoices",
        paths: ["/customer-invoices", "/invoices", "/certification-invoices"],
      },
      {
        key: "payments",
        label: "Payments",
        aliases: ["payments", "payment", "customer payments", "customer payment"],
        paths: ["/customer-payments", "/payments"],
      },
      {
        key: "statements",
        label: "Statements",
        aliases: [
          "statements",
          "statement",
          "customer statement",
          "customer statements",
        ],
        paths: ["/customer-statement", "/statements"],
      },
    ],
  },
  {
    key: "hr",
    label: "HR",
    aliases: ["hr", "hr management"],
    paths: ["/staff-management", "/hr"],
    icon: "FiUserCheck",
    children: [
      {
        key: "staff-management",
        label: "Staff Management",
        aliases: ["staff management"],
        forcePath: "/staff-management",
        paths: [
          "/staff-management",
          "/StaffListScreen",
          "/AddStaffPage",
          "/StaffProfilePage",
          "/staff",
        ],
      },
    ],
  },
  {
    key: "system-settings",
    label: "System Settings",
    aliases: ["system settings", "global settings", "settings", "all settings"],
    paths: ["/global-settings", "/settings"],
    icon: "FiSettings",
    children: [
      {
        key: "global-settings",
        label: "Global Settings",
        aliases: ["global settings", "configurations", "configuration"],
        paths: ["/configuration", "/global-settings"],
      },
      {
        key: "system-users",
        label: "System Users",
        aliases: ["system users", "system user"],
        paths: ["/system-users", "/SystemUsers"],
      },
      {
        key: "user-roles",
        label: "User Roles",
        aliases: ["user roles", "user role"],
        paths: ["/user-roles", "/UserRoles"],
      },
      {
        key: "activity-logs",
        label: "Activity Logs",
        aliases: ["activity logs", "activity log"],
        paths: ["/activity-logs", "/ActivityLogs"],
      },
      // Former top-gear "All Settings" hub — product-visible items only.
      {
        key: "application-documents",
        label: "Application Documents",
        aliases: ["application documents"],
        forcePath: "/settings/application-documents",
        paths: ["/settings/application-documents"],
        viaSettingsAccess: true,
      },
      {
        key: "application-fields",
        label: "Application Fields",
        aliases: ["application fields"],
        forcePath: "/settings/application-fields",
        paths: ["/settings/application-fields"],
        viaSettingsAccess: true,
      },
      {
        key: "dynamic-forms",
        label: "Dynamic Forms",
        aliases: ["dynamic forms"],
        forcePath: "/settings/dynamic-forms",
        paths: ["/settings/dynamic-forms"],
        viaSettingsAccess: true,
      },
      {
        key: "class-categories",
        label: "Class / Category",
        aliases: ["class / category", "class category", "class categories"],
        forcePath: "/settings/class-categories",
        paths: ["/settings/class-categories"],
        viaSettingsAccess: true,
      },
      {
        key: "departments-positions",
        label: "Departments & Positions",
        aliases: ["departments & positions", "departments and positions"],
        forcePath: "/Departments_Positions",
        paths: ["/Departments_Positions", "/departments_positions"],
        viaSettingsAccess: true,
      },
      {
        key: "branches-locations",
        label: "Branches & Locations",
        aliases: ["branches & locations", "branches and locations"],
        forcePath: "/Branch_locations",
        paths: ["/Branch_locations", "/Branch_Locations", "/branch_locations"],
        viaSettingsAccess: true,
      },
      {
        key: "notification-events",
        label: "Notification Events",
        aliases: ["notification events", "notification event"],
        forcePath: "/notification-events",
        paths: ["/notification-events"],
        viaSettingsAccess: true,
      },
      {
        key: "customer-data-types",
        label: "Customer Data Types",
        aliases: [
          "customer data types",
          "misc. data types",
          "misc data types",
          "miscellaneous data types",
        ],
        forcePath: "/Sales_Misc_Data_Types",
        paths: ["/Sales_Misc_Data_Types"],
        viaSettingsAccess: true,
      },
    ],
  },
];

function expandAliasMap(entries, getAliases) {
  const out = new Map();
  entries.forEach((entry) => {
    const canonical = entry.key;
    const aliases = [entry.label, ...(getAliases(entry) || [])]
      .map(norm)
      .filter(Boolean);
    aliases.forEach((alias) => out.set(alias, canonical));
  });
  return out;
}

const PARENT_ALIAS_TO_CANONICAL = expandAliasMap(
  PRODUCT_NAV_BLUEPRINT,
  (e) => e.aliases
);
const CHILD_ALIAS_TO_CANONICAL = expandAliasMap(
  PRODUCT_NAV_BLUEPRINT.flatMap((p) =>
    (p.children || []).map((c) => ({ ...c, parentKey: p.key }))
  ),
  (e) => e.aliases
);

const FINANCE_CHILD_KEYS = new Set([
  "quotations",
  "costing-sheet",
  "invoices",
  "payments",
  "statements",
]);

export function normalizeSidebarPath(path) {
  if (path == null || path === "") return "";
  const normalized = withSlash(path);
  if (normalized.length > 1) {
    return normalized.replace(/\/+$/, "").toLowerCase();
  }
  return normalized.toLowerCase();
}

export function getProductNavParentCanonical(name = "") {
  return PARENT_ALIAS_TO_CANONICAL.get(norm(name)) || null;
}

export function getProductNavChildCanonical(name = "") {
  return CHILD_ALIAS_TO_CANONICAL.get(norm(name)) || null;
}

function pathMatches(candidatePath, allowedPaths = []) {
  const normalized = normalizeSidebarPath(candidatePath);
  if (!normalized) return false;
  return (allowedPaths || []).some((allowed) => {
    const target = normalizeSidebarPath(allowed);
    return (
      normalized === target ||
      normalized.startsWith(`${target}/`) ||
      normalized.replace(/-/g, "") === target.replace(/-/g, "")
    );
  });
}

function nameMatches(candidateName, aliases = [], label = "") {
  const labelNorm = norm(candidateName);
  if (!labelNorm) return false;
  const pool = [label, ...(aliases || [])].map(norm).filter(Boolean);
  return pool.includes(labelNorm);
}

function flattenAuthorizedModules(authorizedModules = []) {
  const parents = [];
  const children = [];
  (authorizedModules || []).forEach((parent) => {
    parents.push(parent);
    (parent.subModules || []).forEach((child) => {
      children.push({ ...child, parentName: parent?.name, parentId: parent?._id });
    });
  });
  return { parents, children };
}

/* Legacy parents are stored with path "/" (or blank). That is not a navigable
   route — the router redirects "/" to /home — so treat it as "no path" and let
   the blueprint supply the real one. */
function usablePath(path) {
  const normalized = withSlash(path);
  return normalized && normalized !== "/" ? normalized : "";
}

function pickBestMatch(records, { aliases, paths, label }) {
  if (!records?.length) return null;
  const byName = records.find((rec) =>
    nameMatches(rec?.name || rec?.module, aliases, label)
  );
  if (byName) return byName;
  const byPath = records.find((rec) => pathMatches(rec?.path, paths));
  return byPath || null;
}

/**
 * Build the product sidebar from role modules.
 * Only includes blueprint parents/children the role actually has (API matches).
 * Hydrates path/_id from those matches; never invents nav the user cannot open.
 */
export function buildProductSidebar(authorizedModules = [], iconLibraries = {}) {
  const { parents, children } = flattenAuthorizedModules(authorizedModules);
  const allRecords = [...parents, ...children];
  const hasSettingsAccess = allRecords.some((rec) =>
    pathMatches(rec?.path, ["/settings"])
  );

  return PRODUCT_NAV_BLUEPRINT.map((parent) => {
    const matchedParent = pickBestMatch(parents, parent);
    const ParentIcon =
      iconLibraries[matchedParent?.icon] ||
      iconLibraries[parent.icon] ||
      iconLibraries.FiGrid;

    // Leaf modules (e.g. Dashboard, Customers) — also match legacy submodule records.
    if (!parent.children?.length) {
      const matchedLeaf =
        matchedParent ||
        pickBestMatch(children, parent) ||
        pickBestMatch(allRecords, parent);

      if (!matchedLeaf) return null;

      return {
        _id: matchedLeaf._id,
        name: parent.label,
        path:
          usablePath(matchedLeaf?.path) ||
          parent.paths?.[0] ||
          "/dashboard",
        icon: ParentIcon,
        routes: [],
        productKey: parent.key,
      };
    }

    const routes = (parent.children || [])
      .map((child) => {
        // Prefer children nested under the matched parent, then global search.
        const scopedChildren = matchedParent
          ? children.filter(
              (c) =>
                String(c.parentId) === String(matchedParent._id) ||
                norm(c.parentName) === norm(matchedParent.name)
            )
          : children;
        /* Last resort may look at top-level records (some tenants store a product
           child as its own module), but never at the record already matched as
           this group's parent — "Operations" also answers to the alias
           "applications", which would point the Applications item at the
           parent's own path. */
        const matchedChild =
          pickBestMatch(scopedChildren, child) ||
          pickBestMatch(children, child) ||
          pickBestMatch(
            allRecords.filter(
              (rec) =>
                !matchedParent ||
                String(rec?._id) !== String(matchedParent._id)
            ),
            child
          );

        // Hub settings items: show when role has /settings View (same as old gear).
        if (!matchedChild && child.viaSettingsAccess && hasSettingsAccess) {
          return {
            _id: `settings-hub-${child.key}`,
            name: child.label,
            path: child.forcePath || child.paths?.[0] || "#",
            icon: iconLibraries.FiGrid,
            productKey: child.key,
          };
        }

        // Role must actually include this submodule — do not show blueprint stubs.
        if (!matchedChild) return null;

        const ChildIcon =
          iconLibraries[matchedChild?.icon] ||
          iconLibraries.FiGrid;

        return {
          _id: matchedChild._id,
          name: child.label,
          /* `forcePath` wins over the matched module record. Certification has
             its own quotation and invoice screens; the like-named records in
             the shared modules list belong to the sales module and open a
             different object with a different lifecycle. */
          path:
            child.forcePath ||
            usablePath(matchedChild?.path) ||
            child.paths?.[0] ||
            "#",
          icon: ChildIcon,
          productKey: child.key,
        };
      })
      .filter(Boolean);

    // Parent group only when the role has at least one authorized child.
    if (!routes.length) return null;

    return {
      _id: matchedParent?._id,
      name: parent.label,
      path:
        usablePath(matchedParent?.path) ||
        routes.find((r) => r.path && r.path !== "#")?.path ||
        parent.paths?.[0] ||
        "#",
      icon: ParentIcon,
      routes,
      productKey: parent.key,
    };
  }).filter(Boolean);
}

function isBlueprintNameOrPath({ name = "", path = "" } = {}) {
  const label = norm(name);
  const normalizedPath = normalizeSidebarPath(path);

  if (
    label === "dashboard" ||
    normalizedPath === "/dashboard" ||
    normalizedPath === "/home"
  ) {
    return true;
  }

  if (getProductNavParentCanonical(label) || getProductNavChildCanonical(label)) {
    return true;
  }

  return PRODUCT_NAV_BLUEPRINT.some((parent) => {
    if (pathMatches(path, parent.paths)) return true;
    return (parent.children || []).some((child) => pathMatches(path, child.paths));
  });
}

/** True when this entry is part of the product nav allowlist. */
export function isProductNavAllowed({ name = "", path = "", parentName = "" } = {}) {
  const label = norm(name);
  const parent = norm(parentName);
  const normalizedPath = normalizeSidebarPath(path);

  if (!label && !normalizedPath) return false;

  if (
    label === "dashboard" ||
    normalizedPath === "/dashboard" ||
    normalizedPath === "/home"
  ) {
    return true;
  }

  // Top-level parent
  if (!parent && getProductNavParentCanonical(label)) return true;

  const childCanonical = getProductNavChildCanonical(label);
  if (childCanonical) {
    if (!parent) return true;
    const parentCanonical = getProductNavParentCanonical(parent);
    if (!parentCanonical) return false;

    // Finance children may still live under Sales in DB.
    if (
      parentCanonical === "operations" &&
      FINANCE_CHILD_KEYS.has(childCanonical)
    ) {
      return true;
    }

    const blueprintParent = PRODUCT_NAV_BLUEPRINT.find(
      (p) => p.key === parentCanonical
    );
    return (blueprintParent?.children || []).some((c) => c.key === childCanonical);
  }

  return isBlueprintNameOrPath({ name, path });
}

/** Inverse of allowlist — used by UserRoles / Modules / Home filters. */
export function isHiddenSidebarModule({ name = "", path = "", parentName = "" } = {}) {
  return !isProductNavAllowed({ name, path, parentName });
}

export function isHiddenSidebarPath(path, name = "") {
  return isHiddenSidebarModule({ name, path });
}

export function isHiddenAccountsSidebarPath(path) {
  return isHiddenSidebarModule({ path });
}

/**
 * Preferred display label for product nav.
 * Parent context matters: child "Items" under Items → "Product".
 */
export function getProductNavDisplayName(name = "", { parentName = "" } = {}) {
  const label = norm(name);
  const parentCanonical = getProductNavParentCanonical(parentName);
  const childCanonical = getProductNavChildCanonical(name);

  // Top-level only (no parent context)
  if (!parentName) {
    const selfParentCanonical = getProductNavParentCanonical(name);
    if (selfParentCanonical) {
      const parent = PRODUCT_NAV_BLUEPRINT.find((p) => p.key === selfParentCanonical);
      return parent?.label || name;
    }
  }

  if (parentCanonical) {
    const parent = PRODUCT_NAV_BLUEPRINT.find((p) => p.key === parentCanonical);
    const child = (parent?.children || []).find((c) => c.key === childCanonical);
    if (child) return child.label;
    // Items → Product when child is literally named Items
    if (parentCanonical === "items" && label === "items") return "Product";
  }

  if (childCanonical) {
    for (const parent of PRODUCT_NAV_BLUEPRINT) {
      const child = (parent.children || []).find((c) => c.key === childCanonical);
      if (child) return child.label;
    }
  }

  return name;
}

export function isFinanceNavChild(name = "") {
  const canonical = getProductNavChildCanonical(name);
  return !!canonical && FINANCE_CHILD_KEYS.has(canonical);
}

/**
 * PCI product: settings sections aligned with product nav.
 * Customer is included only so Address Types can be managed
 * (All Settings → Customer → Misc. Data Types → Address Types).
 * HR Management is limited to staff-setup items (see below).
 */
const PRODUCT_SETTINGS_SECTIONS = new Set([
  "Operations",
  "Notification",
  "Customer",
  "HR Management",
]);

/** HR settings needed for Staff Management only (not Leaves/Claims/etc.). */
const HR_STAFF_SETTINGS_ITEMS = new Set([
  "departments & positions",
  "branches & locations",
]);

const HR_STAFF_SETTINGS_PATHS = [
  "/departments_positions",
  "/branch_locations",
];

/** True when an All Settings card/section should be product-hidden. */
export function isHiddenSettingsSection(sectionTitle = "") {
  const title = String(sectionTitle || "").trim();
  if (!title) return true;
  return !PRODUCT_SETTINGS_SECTIONS.has(title);
}

/**
 * True when a settings link/item should be product-hidden.
 * Under HR Management, keep only Departments & Positions and Branches & Locations.
 */
export function isHiddenSettingsItem({
  name = "",
  href = "",
  sectionTitle = "",
} = {}) {
  const itemName = String(name || "")
    .trim()
    .toLowerCase();
  const path = String(href || "")
    .split("?")[0]
    .toLowerCase();
  const section = String(sectionTitle || "").trim();

  if (
    itemName === "dynamic module labels" ||
    path.includes("/settings/module-labels")
  ) {
    return true;
  }

  if (section === "HR Management") {
    return !(
      HR_STAFF_SETTINGS_ITEMS.has(itemName) ||
      HR_STAFF_SETTINGS_PATHS.some(
        (allowed) => path === allowed || path.startsWith(`${allowed}/`)
      )
    );
  }

  return false;
}
