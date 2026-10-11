import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FiFileText, FiMapPin, FiUser, FiLayers } from "react-icons/fi";
import { useHistory } from "react-router-dom";
import KeyContact from "../subcomponent/KeyContact";
import DocumentUpload from "../subcomponent/DocumentUpload";
import Addresses from "../subcomponent/Addresses";
import CustomerEInvoiceInfo from "./CustomerEInvoiceInfo";
import SectionTabsLayout from "@/components/form/SectionTabsLayout";
import CustomerActivityTimelineTab from "./CustomerActivityTimelineTab";

const tabIcons = {
  eInvoiceInfo: FiFileText,
  keyContacts: FiUser,
  addresses: FiMapPin,
  DocumentUpload: FiLayers,
  activityLog: FiLayers,
};

const OtherDetailsWithTabs = ({
  initialData = {},
  onTabSave,
  onEInvoiceInfoChange,
  clientType,
  customerPhone,
  customerId,
  businessId,
  customerFirstName,
  config,
  initialActiveTabIndex = 0,
  showEInvoiceTab = true,
}) => {
  const { t } = useTranslation();
  const history = useHistory();
  const [activeTabIndex, setActiveTabIndex] = useState(initialActiveTabIndex);
  const [validationErrors, setValidationErrors] = useState({
    eInvoiceInfo: false,
    keyContacts: false,
    addresses: false,
    DocumentUpload: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    eInvoiceInfo: initialData.eInvoiceInfo || {},
    keyContacts: initialData.keyContacts || [],
    addresses: initialData.addresses || [],
  });

  const tabs = useMemo(() => {
    const all = [
      {
        nameKey: "customer.tabs.eInvoiceData",
        component: CustomerEInvoiceInfo,
        key: "eInvoiceInfo",
      },
      {
        nameKey: "customer.tabs.contacts",
        component: KeyContact,
        key: "keyContacts",
      },
      {
        nameKey: "customer.tabs.addresses",
        component: Addresses,
        key: "addresses",
      },
      {
        nameKey: "customer.tabs.documents",
        component: DocumentUpload,
        key: "DocumentUpload",
      },
      {
        nameKey: "customer.tabs.activityLog",
        component: CustomerActivityTimelineTab,
        key: "activityLog",
      },
    ];
    if (!showEInvoiceTab) return all.filter((tab) => tab.key !== "eInvoiceInfo");
    return all;
  }, [showEInvoiceTab]);

  useEffect(() => {
    if (activeTabIndex >= tabs.length) setActiveTabIndex(0);
  }, [tabs.length, activeTabIndex]);

  useEffect(() => {
    if (!initialData || Object.keys(initialData).length === 0) return;
    setFormData({
      eInvoiceInfo:
        initialData.eInvoiceInfo && typeof initialData.eInvoiceInfo === "object"
          ? initialData.eInvoiceInfo
          : {},
      keyContacts: Array.isArray(initialData.keyContacts) ? initialData.keyContacts : [],
      addresses: Array.isArray(initialData.addresses) ? initialData.addresses : [],
    });
  }, [initialData]);

  const handleTabChange = (key, data) => {
    setFormData((prev) => {
      const next = { ...prev, [key]: data };
      if (key === "eInvoiceInfo" && typeof onEInvoiceInfoChange === "function") {
        onEInvoiceInfoChange(data);
      }
      return next;
    });
  };

  const activeTabKey = tabs[activeTabIndex].key;
  const isSaveDisabled = isSaving || validationErrors[activeTabKey];
  const activeKey = activeTabKey;
  const ActiveComponent = tabs[activeTabIndex].component;
  const activeTabLabel = t(tabs[activeTabIndex].nameKey);

  const handleSave = async () => {
    if (isSaveDisabled) return;
    setIsSaving(true);
    try {
      await onTabSave(
        tabs[activeTabIndex].key,
        formData[tabs[activeTabIndex].key]
      );
    } catch (error) {
      console.error("Save failed:", error);
    }
    setTimeout(() => setIsSaving(false), 2000);
  };

  const layoutTabs = useMemo(
    () =>
      tabs.map((tab) => ({
        key: tab.key,
        label: t(tab.nameKey),
        icon: tabIcons[tab.key] || FiLayers,
      })),
    [tabs, t]
  );

  return (
    <SectionTabsLayout
      tabs={layoutTabs}
      activeIndex={activeTabIndex}
      onTabChange={setActiveTabIndex}
      navAriaLabel={t("customer.tabs.navAriaLabel")}
      footer={
        !["DocumentUpload", "activityLog"].includes(tabs[activeTabIndex].key) ? (
          <div className="mt-8 pt-4 border-t border-gray-100 dark:border-gray-600 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={() => history.push("/customers")}
              className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              {t("Cancel")}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className={`px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-colors ${
                isSaveDisabled
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-[var(--p-blue)] hover:opacity-95"
              }`}
              disabled={isSaveDisabled}
            >
              {isSaving
                ? t("customer.tabs.saving")
                : activeTabIndex === tabs.length - 1
                  ? t("Submit")
                  : t("customer.tabs.saveTab", { tab: activeTabLabel })}
            </button>
          </div>
        ) : null
      }
    >
      {activeKey === "eInvoiceInfo" ? (
        <div>
          <CustomerEInvoiceInfo
            value={formData.eInvoiceInfo}
            onChange={(next) => handleTabChange("eInvoiceInfo", next)}
            businessId={businessId}
            addresses={formData.addresses}
            customerPhone={customerPhone}
            clientType={clientType}
            hideLocationFields
            className="shadow-none border-0 p-0"
          />
        </div>
      ) : (
        <div>
          <ActiveComponent
            initialData={formData[activeKey]}
            onChange={(data) => handleTabChange(activeKey, data)}
            customerId={customerId}
            businessId={businessId}
            customerFirstName={customerFirstName}
            setValidationErrors={(validationState) => {
              setValidationErrors((prev) => ({
                ...prev,
                ...(validationState || {}),
              }));
            }}
            config={config}
          />
        </div>
      )}
    </SectionTabsLayout>
  );
};

export default OtherDetailsWithTabs;
