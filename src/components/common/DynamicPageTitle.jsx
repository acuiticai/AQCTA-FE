import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { getConfig } from "@/components/formatAmount";

const DEFAULT_SYSTEM_NAME = "AQCTA";

function toTitleCaseFromUrl(pathname) {
  const last =
    pathname
      .split("?")[0]
      .split("#")[0]
      .split("/")
      .filter(Boolean)
      .pop() || "dashboard";

  return last
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ");
}

export default function DynamicPageTitle() {
  const { pathname } = useLocation();

  useEffect(() => {
    const cfg = getConfig();
    const systemName = (cfg?.name || DEFAULT_SYSTEM_NAME).trim() || DEFAULT_SYSTEM_NAME;
    const pageName = toTitleCaseFromUrl(pathname);
    document.title = `${pageName} - ${systemName}`;
  }, [pathname]);

  return null;
}

