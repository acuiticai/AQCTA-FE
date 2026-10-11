import axios from "axios";
import {
  CUSTOM_FIELD_MODULES,
  CUSTOM_FIELD_MODULE_LABELS,
  CUSTOM_FIELD_SCREENS_BY_MODULE,
} from "@/utils/customFieldConstants";
import { getModuleSlug } from "@/utils/moduleLabels";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

function normPath(p) {
  if (!p || typeof p !== "string") return "";
  const t = p.trim().toLowerCase();
  if (!t) return "";
  const withSlash = t.startsWith("/") ? t : `/${t}`;
  return withSlash.replace(/\s+/g, " ").replace(/\/+$/, "");
}

function normName(n) {
  return String(n || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function hasAny(value, needles) {
  return needles.some((n) => value.includes(n));
}

function isAllowedCustomFieldParent(parent) {
  const pn = normName(parent?.name);
  const pp = normPath(parent?.path);

  return (
    pn === "items" ||
    pn.includes("sales") ||
    pn.includes("purchase") ||
    pn.includes("operations") ||
    pp.includes("/items") ||
    pp.includes("/sales") ||
    pp.includes("/purchase") ||
    pp.includes("/operations")
  );
}

/**
 * Map a navigation submodule (from Module master / dynamic role) to custom-field module + screen.
 * Uses path and name hints; extend rules as new routes are added.
 */
export function mapDynamicSubModuleToCustomField(parent, sub) {
  const pp = normPath(parent.path);
  const pn = normName(parent.name);
  const sp = normPath(sub.path);
  const sn = normName(sub.name);
  const spFlat = sp.replace(/[-_\s/]+/g, "");
  const snFlat = sn.replace(/[-_\s/]+/g, "");
  const dynamicSaleOrderSlug = getModuleSlug("saleOrder", {
    plural: false,
    fallback: "sale-order",
  });
  const dynamicSaleOrderSlugPlural = getModuleSlug("saleOrder", {
    plural: true,
    fallback: "sales-orders",
  });
  const dynamicSaleOrderNeedles = [
    dynamicSaleOrderSlug,
    dynamicSaleOrderSlugPlural,
    dynamicSaleOrderSlug.replace(/-/g, "_"),
    dynamicSaleOrderSlugPlural.replace(/-/g, "_"),
    dynamicSaleOrderSlug.replace(/-/g, " "),
    dynamicSaleOrderSlugPlural.replace(/-/g, " "),
  ];

  if (sp.includes("categor") || sn.includes("categor")) {
    return { module: "inventory", screen: "category" };
  }
  if (sp.includes("stock") || sn.includes("stock")) {
    return { module: "inventory", screen: "stock_group" };
  }
  if (sp === "/items" || (sp.includes("/items") && !sp.includes("categor"))) {
    return { module: "inventory", screen: "item" };
  }

  if (
    hasAny(sp, [
      "sales-order",
      "sales_order",
      "sales order",
      "sales-orders",
      "sale-order",
      "sale_order",
      "sale order",
      "sale-orders",
      ...dynamicSaleOrderNeedles,
    ]) ||
    hasAny(sn, [
      "sales order",
      "sales-order",
      "sales_order",
      "sale order",
      "sale-order",
      "sale_order",
      ...dynamicSaleOrderNeedles,
    ]) ||
    hasAny(spFlat, [
      "salesorder",
      "saleorder",
      ...dynamicSaleOrderNeedles.map((n) => String(n || "").replace(/[-_\s/]+/g, "")),
    ]) ||
    hasAny(snFlat, [
      "salesorder",
      "saleorder",
      ...dynamicSaleOrderNeedles.map((n) => String(n || "").replace(/[-_\s/]+/g, "")),
    ])
  ) {
    return { module: "sales", screen: "sales_order" };
  }
  if (sp.includes("customer-invoice") || sp.includes("proforma")) {
    return { module: "sales", screen: "invoice" };
  }
  // Recurring schedules use the same header definitions as customer invoice (CreateRecurringInvoice.jsx)
  if (
    sp.includes("recurring-invoice") ||
    sp.includes("recurring_invoice") ||
    hasAny(sn, ["recurring invoice", "recurring invoices"]) ||
    (sn.includes("recurring") && sn.includes("invoice"))
  ) {
    return { module: "sales", screen: "invoice" };
  }
  if (sp === "/customers" || sp.endsWith("/customers")) {
    return { module: "sales", screen: "customer" };
  }

  if (sp.includes("purchase-order")) {
    return { module: "purchase", screen: "purchase_order" };
  }
  // Vendor bills (AP) — must run before generic "vendor" → vendor master (customer screen)
  if (
    sp.includes("vendor-invoice") ||
    hasAny(sn, ["vendor invoice", "vendor bills", "vendor bill"]) ||
    (sn.includes("vendor") && sn.includes("invoice"))
  ) {
    return { module: "purchase", screen: "vendor_invoice" };
  }
  if (sp.includes("vendor")) {
    return { module: "purchase", screen: "customer" };
  }

  const itemsParent =
    pp.includes("/items") || pn === "items" || pn.startsWith("items ");
  if (itemsParent) {
    if (sn.includes("categor")) return { module: "inventory", screen: "category" };
    if (sn.includes("stock")) return { module: "inventory", screen: "stock_group" };
    return { module: "inventory", screen: "item" };
  }

  const salesParent =
    pn.includes("sales") || pp === "/sales" || pp.startsWith("/sales/");
  if (salesParent) {
    if (sn.includes("sales") && sn.includes("order"))
      return { module: "sales", screen: "sales_order" };
    if (
      (sn.includes("recurring") && sn.includes("invoice")) ||
      hasAny(sn, ["recurring invoice", "recurring invoices"])
    ) {
      return { module: "sales", screen: "invoice" };
    }
    if (sn.includes("invoice")) return { module: "sales", screen: "invoice" };
    if (sn.includes("customer")) return { module: "sales", screen: "customer" };
    return null;
  }

  const purchaseParent =
    pn.includes("purchase") ||
    pp.includes("/purchases") ||
    pp.includes("/purchase");
  if (purchaseParent) {
    if (sn.includes("purchase") && sn.includes("order"))
      return { module: "purchase", screen: "purchase_order" };
    if (
      (sn.includes("vendor") && sn.includes("invoice")) ||
      hasAny(sn, ["vendor invoice", "vendor invoices"])
    ) {
      return { module: "purchase", screen: "vendor_invoice" };
    }
    if (sn.includes("vendor")) return { module: "purchase", screen: "customer" };
    return null;
  }

  return null;
}

/** Submodules under this parent that map to a custom-field scope (keeps each row — no dedupe). */
export function getMappableSubsForParent(parent) {
  return (parent.subModules || [])
    .map((sub) => {
      const mapped = mapDynamicSubModuleToCustomField(parent, sub);
      if (!mapped) return null;
      return {
        _id: sub._id,
        name: String(sub.name || "").trim() || "Submodule",
        path: sub.path,
        module: mapped.module,
        screen: mapped.screen,
      };
    })
    .filter(Boolean);
}

/** Parent modules that have at least one mappable submodule. */
export function listParentsWithCustomFieldSubs(groupedModules) {
  return (groupedModules || []).filter(
    (p) => isAllowedCustomFieldParent(p) && getMappableSubsForParent(p).length > 0,
  );
}

/**
 * Same sources as UserRoles: super admin → get_all_modules; others → get_Dynamic_Modules.
 */
export async function fetchGroupedModulesForUser(adminInfo, requestHeaders) {
  const h = requestHeaders || {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo?.token}`,
  };
  const isSuperAdmin = adminInfo?.role?.isSuperAdmin === true;

  if (isSuperAdmin) {
    const res = await axios.post(`${Base_URL}/Module/get_all_modules`, {}, { headers: h });
    const fetched = res.data?.data || [];
    return fetched
      .filter((item) => !item.parent_id && item.status)
      .map((parent) => ({
        _id: parent._id,
        name: parent.name,
        path: parent.path,
        subModules: fetched
          .filter((child) => child.parent_id === parent._id && child.status)
          .map((child) => ({
            _id: child._id,
            name: child.name,
            path: child.path,
          })),
      }));
  }

  const res = await axios.get(
    `${Base_URL}/Module/get_Dynamic_Modules/${adminInfo.id}`,
    { headers: h },
  );
  const mods = res.data?.role?.modules || [];
  return mods.map((m) => ({
    _id: m._id,
    name: m.name,
    path: m.path,
    subModules: (m.subModules || []).map((s) => ({
      _id: s._id,
      name: s.name,
      path: s.path,
    })),
  }));
}
