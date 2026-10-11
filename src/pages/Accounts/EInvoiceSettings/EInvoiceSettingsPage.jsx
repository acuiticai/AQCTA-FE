import React, { useState, useEffect, useContext } from "react";
import { Link, useLocation, useHistory } from "react-router-dom";
import axios from "axios";
import { useTranslation } from "react-i18next";
import Header from "@/components/header/Header";
import AppLayout from "@/pages/Settings/app-layout";
import SettingsOrgBanner from "@/pages/Settings/SettingsOrgBanner";
import BusinessDetailsTab from "@/pages/Business/BusinessDetails";
import { AdminContext } from "@/context/AdminContext";
import { useBusinessEInvoiceEnabled } from "@/hooks/useBusinessEInvoiceEnabled";
import { useSettingsCrudPermissions } from "@/hooks/useSettingsCrudPermissions";
import { EInvoicePanelSkeleton } from "./EInvoicePanelSkeleton";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const EInvoiceSettingsContent = () => {
  const { t } = useTranslation();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const location = useLocation();
  const history = useHistory();
  const [businesses, setBusinesses] = useState([]);
  const [businessesLoading, setBusinessesLoading] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const { enabled: eInvoiceModuleEnabled, loading: eInvoiceFlagLoading } =
    useBusinessEInvoiceEnabled(selectedId);
  const { canUpdate, canDelete } = useSettingsCrudPermissions();

  useEffect(() => {
    if (!adminInfo?.id) {
      setBusinessesLoading(false);
      return;
    }
    setBusinessesLoading(true);
    axios
      .get(`${Base_URL}/admin/assigned/${adminInfo.id}`, {
        headers: { authorization: `Bearer ${adminInfo?.token}` },
      })
      .then((res) => {
        setBusinesses(Array.isArray(res.data?.businesses) ? res.data.businesses : []);
      })
      .catch(() => setBusinesses([]))
      .finally(() => setBusinessesLoading(false));
  }, [adminInfo?.id, adminInfo?.token]);

  useEffect(() => {
    if (!businesses.length) return;
    const fromUrl = new URLSearchParams(location.search).get("selectedOrg");
    if (fromUrl && businesses.some((b) => String(b._id) === fromUrl)) {
      setSelectedId(fromUrl);
      sessionStorage.setItem("settingsSelectedOrg", fromUrl);
      return;
    }
    const sessionId = sessionStorage.getItem("settingsSelectedOrg");
    const id =
      sessionId && businesses.some((b) => String(b._id) === sessionId)
        ? sessionId
        : String(businesses[0]._id);
    setSelectedId(id);
    sessionStorage.setItem("settingsSelectedOrg", id);
    const next = new URLSearchParams({ selectedOrg: id });
    const want = `?${next.toString()}`;
    if (location.search !== want) {
      history.replace({ pathname: location.pathname, search: want });
    }
  }, [businesses, location.search, location.pathname, history]);

  const settingsQuery = selectedId ? `?selectedOrg=${encodeURIComponent(selectedId)}` : "";
  const pageLoading =
    businessesLoading || (!!selectedId && eInvoiceFlagLoading);

  return (
    <div className="p-6 bg-white h-full max-h-[90vh] overflow-y-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
        <h1 className="text-xl font-semibold text-gray-900">{t("accountsSettings.eInvoice.title", "E-Invoice Settings")}</h1>
        <Link
          to={`/settings${settingsQuery}`}
          className="text-sm text-[var(--p-blue)] font-medium hover:underline"
        >
          {t("accountsSettings.eInvoice.backToSettings", "← Back to All Settings")}
        </Link>
      </div>
      <SettingsOrgBanner />

      {pageLoading ? <EInvoicePanelSkeleton /> : null}

      {!pageLoading && businesses.length === 0 && adminInfo?.id ? (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-6">
          {t("accountsSettings.eInvoice.noBusinesses", "No businesses assigned to your account, or the list could not be loaded.")}
        </p>
      ) : null}

      {!pageLoading && selectedId && !eInvoiceModuleEnabled ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-900 px-4 py-3 text-sm max-w-2xl">
          {t("accountsSettings.eInvoice.turnedOff", "E-invoice is turned off for this business. Turn it on under")}{" "}
          <span className="font-medium">{t("accountsSettings.eInvoice.business", "Business")}</span> →{" "}
          <span className="font-medium">{t("accountsSettings.eInvoice.editBusiness", "Edit Business")}</span> {t("accountsSettings.eInvoice.enableEInvoice", "(Enable e-invoice) to configure LHDN / MyInvois here.")}
        </div>
      ) : null}

      {!pageLoading && selectedId && eInvoiceModuleEnabled ? (
        <BusinessDetailsTab
          key={selectedId}
          businessId={selectedId}
          variant="settings"
          showDelete
          canUpdate={canUpdate}
          canDelete={canDelete}
        />
      ) : null}
    </div>
  );
};

/**
 * All Settings → Accounts → E-Invoice Settings. Same AppLayout/Header/banner
 * pattern as Payment Reminders, Taxes, Sales Channels, etc.
 */
const EInvoiceSettingsPage = () => (
  <AppLayout>
    <Header />
    <EInvoiceSettingsContent />
  </AppLayout>
);

export default EInvoiceSettingsPage;
