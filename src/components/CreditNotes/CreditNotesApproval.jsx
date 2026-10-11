import React, { useState, useEffect, useContext } from "react";
import {
  Save,
  DollarSign,
  Settings,
  ChevronDown,
  CheckCircle,
  XCircle,
  AlertCircle,
  Edit3,
} from "lucide-react";
import axios from "axios";
import Header from "@/components/header/Header";
import AppLayout from "../../pages/Settings/app-layout";
import SettingsOrgBanner from "@/pages/Settings/SettingsOrgBanner";
import { AdminContext } from "@/context/AdminContext";
import { notifyError, notifySuccess } from "@/utils/toast";
import useAsync from "@/hooks/useAsync";
import CurrencyServices from "@/services/CurrencyServices";
import { useRouteModulePermissions } from "@/utils/permissionUtils";
import { useTranslation } from "react-i18next";

const CreditNotesApproval = () => {
  const { t } = useTranslation();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const { canAdd, canUpdate } = useRouteModulePermissions();
  const canSave = canAdd || canUpdate;
  const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

  // Get organization from URL parameters
  const searchParams = new URLSearchParams(location.search);
  const organization = searchParams.get("selectedOrg");

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [businesses, setBusinesses] = useState([]);
  const [approvalSettings, setApprovalSettings] = useState({
    business: organization,
    autoApprovalEnabled: false,
    maxAmount: 0,
    currency: "USD",
    applicableCreditNoteTypes: ["apply_to_invoice", "refund_to_client"],
    createdBy: "",
    updatedBy: "",
  });

  // Fetch currencies
  const { data: currencies, loading: currencyLoading } = useAsync(
    CurrencyServices.getAllCurrency
  );

  useEffect(() => {
    if (organization) {
      fetchBusinesses();
      fetchApprovalSettings(organization);
    }
  }, [organization]);

  const fetchBusinesses = async () => {
    try {
      const storedBusinesses = localStorage.getItem("businesses");
      if (storedBusinesses) {
        const parsedData = JSON.parse(storedBusinesses);
        setBusinesses(parsedData);
      }
    } catch (error) {
      console.error("Error fetching businesses:", error);
      notifyError(t("accountsSettings.creditNotesApproval.loadBusinessesFailed", "Failed to load businesses"));
    }
  };

  const fetchApprovalSettings = async (businessId) => {
    setIsLoading(true);
    try {
      const response = await axios.get(
        `${Base_URL}/credit-note-approval/business/${businessId}`,
        {
          headers: {
            authorization: `Bearer ${adminInfo.token}`,
          },
        }
      );

      if (response.data.success && response.data.data) {
        setApprovalSettings(response.data.data);
      } else {
        setApprovalSettings({
          business: organization,
          autoApprovalEnabled: false,
          maxAmount: 0,
          currency: "USD",
          applicableCreditNoteTypes: ["apply_to_invoice", "refund_to_client"],
          createdBy: adminInfo._id,
          updatedBy: adminInfo._id,
        });
      }
    } catch (error) {
      if (error.response?.status === 404) {
        setApprovalSettings({
          business: organization,
          autoApprovalEnabled: false,
          maxAmount: 0,
          currency: "USD",
          applicableCreditNoteTypes: ["apply_to_invoice", "refund_to_client"],
          createdBy: adminInfo._id,
          updatedBy: adminInfo._id,
        });
      } else {
        console.error("Error fetching approval settings:", error);
        notifyError(t("accountsSettings.creditNotesApproval.loadSettingsFailed", "Failed to load approval settings"));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setApprovalSettings((prev) => ({
      ...prev,
      [name]: value,
      updatedBy: adminInfo._id,
    }));
  };

  const handleToggleAutoApproval = () => {
    setApprovalSettings((prev) => ({
      ...prev,
      autoApprovalEnabled: !prev.autoApprovalEnabled,
      updatedBy: adminInfo._id,
    }));
  };

  const handleCreditNoteTypeChange = (type) => {
    setApprovalSettings((prev) => {
      const currentTypes = prev.applicableCreditNoteTypes || [];
      const newTypes = currentTypes.includes(type)
        ? currentTypes.filter((t) => t !== type)
        : [...currentTypes, type];

      return {
        ...prev,
        applicableCreditNoteTypes: newTypes,
        updatedBy: adminInfo._id,
      };
    });
  };

  const handleSaveSettings = async () => {
    if (!organization) {
      notifyError(t("accountsSettings.creditNotesApproval.orgRequired", "Organization is required"));
      return;
    }

    if (
      approvalSettings.autoApprovalEnabled &&
      approvalSettings.maxAmount <= 0
    ) {
      notifyError(t("accountsSettings.creditNotesApproval.invalidAmount", "Please enter a valid maximum amount for auto-approval"));
      return;
    }

    if (
      approvalSettings.autoApprovalEnabled &&
      (!approvalSettings.applicableCreditNoteTypes ||
        approvalSettings.applicableCreditNoteTypes.length === 0)
    ) {
      notifyError(
        t("accountsSettings.creditNotesApproval.selectType", "Please select at least one credit note type for auto-approval")
      );
      return;
    }

    setIsSaving(true);
    try {
      const settingsToSave = {
        ...approvalSettings,
        business: organization,
        updatedBy: adminInfo._id,
      };

      const response = await axios.post(
        `${Base_URL}/credit-note-approval`,
        settingsToSave,
        {
          headers: {
            authorization: `Bearer ${adminInfo.token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.success) {
        notifySuccess(t("accountsSettings.creditNotesApproval.saveSuccess", "Credit note approval settings saved successfully"));
        await fetchApprovalSettings(organization);
      } else {
        notifyError(response.data.message || t("accountsSettings.creditNotesApproval.saveFailed", "Failed to save settings"));
      }
    } catch (error) {
      console.error("Error saving approval settings:", error);
      notifyError(
        error.response?.data?.message ||
          error.response?.data?.error ||
          t("accountsSettings.creditNotesApproval.saveError", "Failed to save approval settings")
      );
    } finally {
      setIsSaving(false);
    }
  };

  const getSelectedBusinessName = () => {
    const business = businesses.find((b) => b._id === organization);
    return business?.name || t("Loading", "Loading...");
  };

  return (
    <AppLayout>
      <Header title={t("accountsSettings.creditNotesApproval.headerTitle", "Credit Note Approval Settings")} />

      <div className="p-6 bg-gray-50 h-full max-h-[90vh] overflow-y-auto pb-[120px]">
        <div className="max-w-4xl mx-auto">
          {/* Header Section */}
          <div className="mb-6">
            <div className="flex items-center mb-2">
              <Settings className="h-6 w-6 text-[var(--p-blue)] mr-3" />
              <h1 className="text-2xl font-semibold text-gray-800">
                {t("accountsSettings.creditNotesApproval.title", "Credit Note Auto-Approval Configuration")}
              </h1>
            </div>
            <p className="text-gray-600">
              {t("accountsSettings.creditNotesApproval.description", "Configure automatic approval settings for credit notes based on amount thresholds and credit note types.")}
            </p>
          </div>
          <SettingsOrgBanner />

          {/* Main Settings Card */}
          {organization && (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              {/* Settings Header */}
              <div className="bg-gradient-to-r from-[var(--p-blue)] to-[#9CBA33] p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-white">
                      {t("accountsSettings.creditNotesApproval.settingsTitle", "Credit Note Auto-Approval Settings")}
                    </h3>
                    <p className="text-green-100 mt-1">
                      for {getSelectedBusinessName()}
                    </p>
                  </div>
                  <div className="flex items-center">
                    <span className="text-green-100 mr-3">{t("accountsSettings.creditNotesApproval.autoApproval", "Auto-Approval")}</span>
                    <button
                      onClick={handleToggleAutoApproval}
                      className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 ${
                        approvalSettings.autoApprovalEnabled
                          ? "bg-green-600"
                          : "bg-gray-400"
                      }`}
                      disabled={!canSave}
                    >
                      <span
                        className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform duration-200 ${
                          approvalSettings.autoApprovalEnabled
                            ? "translate-x-7"
                            : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Settings Content */}
              <div className="p-6">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--p-blue)]"></div>
                    <span className="ml-3 text-gray-600">
                      {t("accountsSettings.creditNotesApproval.loading", "Loading settings...")}
                    </span>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Status Indicator */}
                    <div
                      className={`p-4 rounded-lg border-2 ${
                        approvalSettings.autoApprovalEnabled
                          ? "border-green-200 bg-green-50"
                          : "border-gray-200 bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center">
                        {approvalSettings.autoApprovalEnabled ? (
                          <>
                            <CheckCircle className="h-5 w-5 text-green-600 mr-3" />
                            <div>
                              <h4 className="font-medium text-green-800">
                                {t("accountsSettings.creditNotesApproval.enabled", "Auto-Approval Enabled")}
                              </h4>
                              <p className="text-sm text-green-600">
                                {t("accountsSettings.creditNotesApproval.enabledDesc", "Credit notes up to {{currency}} {{amount}} will be automatically approved for {{types}}", { currency: approvalSettings.currency, amount: approvalSettings.maxAmount.toLocaleString(), types: approvalSettings.applicableCreditNoteTypes?.join(", ") || "selected types" })}
                              </p>
                            </div>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-5 w-5 text-gray-500 mr-3" />
                            <div>
                              <h4 className="font-medium text-gray-700">
                                {t("accountsSettings.creditNotesApproval.disabled", "Auto-Approval Disabled")}
                              </h4>
                              <p className="text-sm text-gray-500">
                                {t("accountsSettings.creditNotesApproval.disabledDesc", "All credit notes will require manual management approval")}
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Amount and Currency Settings */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-gray-700 mb-2 font-medium">
                          {t("accountsSettings.creditNotesApproval.maxAmount", "Maximum Auto-Approval Amount *")}
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            name="maxAmount"
                            value={approvalSettings.maxAmount}
                            onChange={handleInputChange}
                            className={`w-full p-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] transition-colors ${
                              !approvalSettings.autoApprovalEnabled
                                ? "bg-gray-100 border-gray-200 text-gray-500"
                                : "bg-white border-gray-300"
                            }`}
                            placeholder="0.00"
                            min="0"
                            step="0.01"
                            disabled={!approvalSettings.autoApprovalEnabled || !canSave}
                          />
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          {t("accountsSettings.creditNotesApproval.maxAmountHelp", "Credit notes with totals up to this amount will be auto-approved")}
                        </p>
                      </div>

                      <div>
                        <label className="block text-gray-700 mb-2 font-medium">
                          {t("accountsSettings.creditNotesApproval.currency", "Currency *")}
                        </label>
                        <div className="relative">
                          <select
                            name="currency"
                            value={approvalSettings.currency}
                            onChange={handleInputChange}
                            className={`w-full p-3 border rounded-lg appearance-none pr-10 focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] transition-colors ${
                              !approvalSettings.autoApprovalEnabled
                                ? "bg-gray-100 border-gray-200 text-gray-500"
                                : "bg-white border-gray-300"
                            }`}
                            disabled={
                              !approvalSettings.autoApprovalEnabled ||
                              currencyLoading ||
                              !canSave
                            }
                          >
                            {currencies?.map((currency) => (
                              <option key={currency._id} value={currency.name}>
                                {currency.name}
                              </option>
                            ))}
                          </select>
                          <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                            <ChevronDown className="h-5 w-5 text-gray-400" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Credit Note Types */}
                    <div>
                      <label className="block text-gray-700 mb-3 font-medium">
                        {t("accountsSettings.creditNotesApproval.applicableTypes", "Applicable Credit Note Types *")}
                      </label>
                      <div className="space-y-3">
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id="apply_to_invoice"
                            checked={
                              approvalSettings.applicableCreditNoteTypes?.includes(
                                "apply_to_invoice"
                              ) || false
                            }
                            onChange={() =>
                              handleCreditNoteTypeChange("apply_to_invoice")
                            }
                            disabled={!approvalSettings.autoApprovalEnabled || !canSave}
                            className="h-4 w-4 text-[var(--p-blue)] focus:ring-[var(--p-blue)] border-gray-300 rounded disabled:opacity-50"
                          />
                          <label
                            htmlFor="apply_to_invoice"
                            className="ml-3 text-sm font-medium text-gray-700"
                          >
                            {t("accountsSettings.creditNotesApproval.applyToInvoice", "Apply to Invoice")}
                          </label>
                        </div>
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id="refund_to_client"
                            checked={
                              approvalSettings.applicableCreditNoteTypes?.includes(
                                "refund_to_client"
                              ) || false
                            }
                            onChange={() =>
                              handleCreditNoteTypeChange("refund_to_client")
                            }
                            disabled={!approvalSettings.autoApprovalEnabled || !canSave}
                            className="h-4 w-4 text-[var(--p-blue)] focus:ring-[var(--p-blue)] border-gray-300 rounded disabled:opacity-50"
                          />
                          <label
                            htmlFor="refund_to_client"
                            className="ml-3 text-sm font-medium text-gray-700"
                          >
                            {t("accountsSettings.creditNotesApproval.refundToClient", "Refund to Client")}
                          </label>
                        </div>
                      </div>
                      <p className="text-sm text-gray-500 mt-2">
                        {t("accountsSettings.creditNotesApproval.typesHelp", "Select which credit note types should be eligible for auto-approval")}
                      </p>
                    </div>

                    {/* Information Box */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-start">
                        <AlertCircle className="h-5 w-5 text-blue-600 mr-3 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-blue-800 mb-1">
                            {t("accountsSettings.creditNotesApproval.howItWorks", "How Credit Note Auto-Approval Works")}
                          </h4>
                          <ul className="text-sm text-blue-700 space-y-1">
                            <li>
                              • {t("accountsSettings.creditNotesApproval.howItWorks1", "When auto-approval is enabled, credit notes will be checked against the maximum amount and applicable types")}
                            </li>
                            <li>
                              • {t("accountsSettings.creditNotesApproval.howItWorks2", "If the credit note total is less than or equal to the set amount and matches selected types, it will be automatically approved")}
                            </li>
                            <li>
                              • {t("accountsSettings.creditNotesApproval.howItWorks3", "Credit notes exceeding the limit or not matching selected types will still require manual management approval")}
                            </li>
                            <li>
                              • {t("accountsSettings.creditNotesApproval.howItWorks4", "This setting only applies to new credit notes created after configuration")}
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* Save Button */}
                    <div className="flex justify-end pt-4 border-t">
                      <button
                        onClick={handleSaveSettings}
                        disabled={isSaving || !organization || !canSave}
                        className="flex items-center px-6 py-3 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[#9CBA33] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSaving ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            {t("accountsSettings.creditNotesApproval.saving", "Saving...")}
                          </>
                        ) : (
                          <>
                            <Save size={16} className="mr-2" />
                            {t("accountsSettings.creditNotesApproval.saveSettings", "Save Settings")}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {!organization && (
            <div className="bg-white p-8 rounded-lg shadow-sm text-center">
              <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-700 mb-2">
                {t("accountsSettings.creditNotesApproval.noOrg", "No Organization Selected")}
              </h3>
              <p className="text-gray-500">
                {t("accountsSettings.creditNotesApproval.noOrgDesc", "Please select an organization to configure auto-approval settings for credit notes.")}
              </p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default CreditNotesApproval;
