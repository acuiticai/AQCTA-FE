import { useContext, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Building } from "lucide-react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { AdminContext } from "@/context/AdminContext";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

/**
 * Shows "Editing settings for: <Business Name>" below the page heading.
 * Drop it immediately after the h1 header container on any settings page.
 */
const SettingsOrgBanner = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const [businessName, setBusinessName] = useState(null);

  const selectedOrgId = new URLSearchParams(location.search).get("selectedOrg");

  useEffect(() => {
    if (!selectedOrgId || !adminInfo?.id) {
      setBusinessName(null);
      return;
    }
    axios
      .get(`${Base_URL}/admin/assigned/${adminInfo.id}`, {
        headers: { authorization: `Bearer ${adminInfo?.token}` },
      })
      .then((res) => {
        const match = (res.data?.businesses || []).find((b) => b._id === selectedOrgId);
        setBusinessName(match?.name || null);
      })
      .catch(() => setBusinessName(null));
  }, [selectedOrgId, adminInfo?.id]);

  if (!businessName) return null;

  return (
    <div
      className="flex items-center gap-2 mb-4 text-sm font-medium"
      style={{ color: "var(--p-blue)" }}
    >
      <Building className="w-5 h-5 flex-shrink-0" />
      <span className="text-[14px]">
        {t("settingsPage.editingSettingsForLabel", {
          defaultValue: "Editing settings for:",
        })}{" "}
        <span className="font-semibold text-base">{businessName}</span>
      </span>
    </div>
  );
};

export default SettingsOrgBanner;
