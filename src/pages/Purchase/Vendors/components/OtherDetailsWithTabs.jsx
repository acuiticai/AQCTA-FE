import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import KeyContact from "../subcomponent/KeyContact";
import DocumentUpload from "../subcomponent/DocumentUpload";
import Addresses from "../subcomponent/Addresses";
import { useHistory } from "react-router-dom";
import BankInfo from "../subcomponent/BankInfo";
import { FiClock, FiCreditCard, FiFileText, FiLayers, FiMapPin, FiUser } from "react-icons/fi";
import ActivityTimeline from "@/components/timeline/ActivityTimeline";

const OtherDetailsWithTabs = ({
  initialData = {},
  onTabSave,
  businessId,
  customerId,
  vendorId,
  vendorFirstName,
}) => {
  const { t } = useTranslation();
  const history = useHistory();
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [formData, setFormData] = useState({
    keyContacts: initialData.keyContacts || [],
    bankInfo: initialData.bankInfo || {},
    addresses: initialData.addresses || [],
    documents: initialData.documents || [],
  });

  // Initialize validation state for each tab
  const [validationErrors, setValidationErrors] = useState({
    keyContacts: false,
    bankInfo: false,
    addresses: false,
    DocumentUpload: false,
  });

  // Track saving state to prevent double submissions
  const [isSaving, setIsSaving] = useState(false);
  // Track when the save button has been clicked to force validation
  const [saveAttempted, setSaveAttempted] = useState(false);
  const [isBankFormVisible, setIsBankFormVisible] = useState(false);

  const timelineVendorId = vendorId || customerId;

  // Tab configuration
  const tabs = useMemo(() => {
    const base = [
      { nameKey: "vendor.tabs.contacts", component: KeyContact, key: "keyContacts" },
      { nameKey: "vendor.tabs.addresses", component: Addresses, key: "addresses" },
      { nameKey: "vendor.tabs.bankInfo", component: BankInfo, key: "bankInfo" },
      { nameKey: "vendor.tabs.documents", component: DocumentUpload, key: "DocumentUpload" },
    ];
    if (timelineVendorId) {
      base.push({ nameKey: "vendor.tabs.activityLog", component: null, key: "activityLog" });
    }
    return base;
  }, [timelineVendorId]);

  const tabIcons = {
    keyContacts: FiUser,
    DocumentUpload: FiLayers,
    bankInfo: FiCreditCard,
    addresses: FiMapPin,
    activityLog: FiClock,
  };

  // Initialize form data from props
  useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) {
      setFormData({
        keyContacts: initialData.keyContacts || [],
        bankInfo: initialData.bankInfo || {},
        addresses: initialData.addresses || [],
        documents: initialData.documents || [],
      });
      const bd = initialData?.bankInfo?.bankDetails || {};
      const bad = initialData?.bankInfo?.bankAccountDetails || {};
      setIsBankFormVisible(
        Boolean(
          (bd.bankName && bd.bankName.trim()) ||
            (bad.accountName && bad.accountName.trim()) ||
            (bad.accountNumber && bad.accountNumber.trim()) ||
            (bad.swiftCode && bad.swiftCode.trim())
        )
      );
    }
  }, [initialData]);

  // Handle tab data changes
  const handleTabChange = (key, data) => {
    setFormData((prev) => ({
      ...prev,
      [key]: data,
    }));
  };

  // Reset save attempted state when changing tabs
  useEffect(() => {
    setSaveAttempted(false);
  }, [activeTabIndex]);

  useEffect(() => {
    if (activeTabIndex >= tabs.length) setActiveTabIndex(0);
  }, [tabs.length, activeTabIndex]);

  // Get current active tab key
  const activeTabKey = tabs[activeTabIndex].key;
  const bankDetails = formData?.bankInfo?.bankDetails || {};
  const bankAccountDetails = formData?.bankInfo?.bankAccountDetails || {};
  const hasBankData = Boolean(
    (bankDetails.bankName && bankDetails.bankName.trim()) ||
      (bankAccountDetails.accountName && bankAccountDetails.accountName.trim()) ||
      (bankAccountDetails.accountNumber && bankAccountDetails.accountNumber.trim()) ||
      (bankAccountDetails.swiftCode && bankAccountDetails.swiftCode.trim())
  );

  // Check if the save button should be disabled
  const isSaveDisabled = isSaving || validationErrors[activeTabKey];

  // Handle save button click
  const handleSave = async () => {
    // Set save attempted to true to trigger validation in child components
    setSaveAttempted(true);

    if (isSaveDisabled) return;

    setIsSaving(true);

    try {
      await onTabSave(activeTabKey, formData[activeTabKey]);
      // Reset save attempted state after successful save
      setSaveAttempted(false);
    } catch (error) {
      console.error("❌ Save failed:", error);
    }

    // Re-enable button after 2 seconds
    setTimeout(() => {
      setIsSaving(false);
    }, 2000);
  };

  const ActiveComponent = tabs[activeTabIndex].component;
  const isActivityTab = activeTabKey === "activityLog";

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="px-2 sm:px-4 py-3 bg-gray-50/80 dark:bg-gray-900/30 border-b border-gray-100 dark:border-gray-600">
        <nav className="flex flex-wrap gap-1.5" role="tablist" aria-label={t("vendor.tabs.navAriaLabel")}>
          {tabs.map((tab, index) => {
            const Icon = tabIcons[tab.key] || FiFileText;
            const isActive = activeTabIndex === index;
            const tabLabel = t(tab.nameKey);
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTabIndex(index)}
                className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-all border ${
                  isActive
                    ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-600 shadow-sm"
                    : "text-gray-500 dark:text-gray-400 border-transparent hover:bg-white/70 dark:hover:bg-gray-800/60 hover:text-gray-800"
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    isActive ? "text-[var(--p-blue)]" : "opacity-70"
                  }`}
                />
                {tabLabel}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="p-4 sm:p-6 min-w-0 max-w-full bg-gradient-to-b from-white to-gray-50/30 dark:from-gray-800 dark:to-gray-900/20">
        {isActivityTab ? (
          <ActivityTimeline
            query={{ vendorId: timelineVendorId }}
            title=""
            pageSize={20}
            embedded
          />
        ) : (
          <ActiveComponent
            initialData={formData[tabs[activeTabIndex].key]}
            documentSeedData={formData.documents || []}
            onChange={(data) => handleTabChange(tabs[activeTabIndex].key, data)}
            businessId={businessId}
            customerId={customerId}
            vendorFirstName={vendorFirstName}
            saveAttempted={saveAttempted}
            onTabSave={onTabSave}
            onFormVisibilityChange={(visible) => {
              if (activeTabKey === "bankInfo") {
                setIsBankFormVisible(Boolean(visible));
              }
            }}
            setValidationErrors={(validationState) => {
              setValidationErrors((prev) => ({
                ...prev,
                ...(validationState || {}),
              }));
            }}
          />
        )}

        {!isActivityTab &&
          tabs[activeTabIndex].key !== "DocumentUpload" &&
          (activeTabKey !== "bankInfo" || isBankFormVisible || hasBankData) && (
          <div className="mt-8 pt-4 border-t border-gray-100 dark:border-gray-600 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={() => history.goBack()}
              className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              {t("common.cancel", { defaultValue: "Cancel" })}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaveDisabled}
              className={`px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-colors ${
                isSaveDisabled
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-[var(--p-blue)] hover:opacity-95"
              }`}
            >
              {isSaving
                ? t("vendor.tabs.saving")
                : activeTabIndex === tabs.length - 1
                ? t("vendor.tabs.submit")
                : t("vendor.tabs.saveTab", { tab: t(tabs[activeTabIndex].nameKey) })}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OtherDetailsWithTabs;
