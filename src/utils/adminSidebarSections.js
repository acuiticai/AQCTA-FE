/** Admin sidebar groups — same rhythm as customer portal nav sections. */
export const ADMIN_SIDEBAR_SECTIONS = [
  {
    id: "main",
    label: "Main Menu",
    keys: ["dashboard", "items", "customers", "operations", "hr"],
  },
  {
    id: "finance",
    label: "Finance",
    keys: ["finance"],
  },
  {
    id: "settings",
    label: "Settings",
    keys: ["system-settings"],
  },
];

export function groupAdminSidebarRoutes(routes = []) {
  const assigned = new Set();
  const sections = ADMIN_SIDEBAR_SECTIONS.map((section) => {
    const sectionRoutes = [];
    for (const key of section.keys) {
      const route = routes.find((r) => r.productKey === key);
      if (route) {
        sectionRoutes.push(route);
        assigned.add(route.productKey || route._id || route.name);
      }
    }
    return { ...section, routes: sectionRoutes };
  }).filter((section) => section.routes.length > 0);

  const extra = routes.filter(
    (route) => !assigned.has(route.productKey || route._id || route.name),
  );
  if (extra.length) {
    const main = sections.find((section) => section.id === "main");
    if (main) {
      main.routes.push(...extra);
    } else {
      sections.unshift({ id: "main", label: "Main Menu", routes: extra });
    }
  }

  return sections;
}

export function adminDisplayInitials(name = "", email = "") {
  const source = String(name || email || "A").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}
