import React, { useState, useEffect, useContext } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button, CustomModal } from "@/page-layouts";
import { AdminContext } from "@/context/AdminContext";
import { notifyError, notifySuccess } from "@/utils/toast";
import EInvoiceServices from "@/services/EInvoiceServices";
import BusinessDetailsService from "@/services/BusinessDetailsService";
import ItemsServices from "@/services/ItemsServices";
import { getTaxes } from "@/services/taxServices";
import { MY_STATE_CODES } from "@/utils/malaysiaLhdnConstants";
import { EInvoicePanelSkeleton } from "@/pages/Accounts/EInvoiceSettings/EInvoicePanelSkeleton";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

/**
 * Business Details & E-Invoice Configuration
 * ──────────────────────────────────────────────────────────────
 * Mirrors InvoisPls's business details screen, extended for PCI.
 *
 * Sections:
 *   1) Business Details — LHDN supplier identity + address
 *      (TIN, ID Type/Value with "Fetch TIN" from MyInvois, SST / MSIC /
 *      Business Activity, address, state, contact)
 *   2) E-Invoice API Configuration — OAuth credentials + environment
 *      (client_id, client_secret, on behalf of, useTestingEnvironment)
 *   3) E-Invoice Auto Approval Settings — master toggle and the
 *      defaults that are applied when consolidated / zero-line invoices
 *      are auto-submitted (default item, tax class, invoice for).
 */

const ID_TYPES = ["BRN", "NRIC", "PASSPORT", "ARMY"];

const INVOICE_FOR_OPTIONS = [
  "Services",
  "Goods",
  "Retail",
  "Consolidated",
  "General",
];

const initialState = {
  tin: "",
  idType: "BRN",
  idValue: "",
  registrationNumber: "",
  sstRegistrationNumber: "",
  msicCode: "",
  BusinessActivityDescription: "",
  cityName: "",
  postalZone: "",
  /** InvoisPls defaults business state to "14" when loading. */
  countrySubentityCode: "14",
  addressLine1: "",
  addressLine2: "",
  identificationCodeCountry: "MYS",
  contactNumber: "",
  // LHDN API
  client_id: "",
  client_secret: "",
  onbehalfof: "",
  useTestingEnvironment: true,
  // Auto-approval
  eInvoiceAutoApproval: false,
  defaultEInvoiceItem: "",
  defaultEInvoiceTaxClass: "",
  defaultEInvoiceInvoiceFor: "",
  // Optional IPOPS / third-party webhook (same as InvoisPls)
  externalApiUrl: "",
  externalApiKey: "",
};

const Section = ({ title, description, children, settingsVariant = false }) => (
  <div
    className={
      settingsVariant
        ? "w-full bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-4"
        : "mt-8 pt-6 border-t border-gray-200"
    }
  >
    {settingsVariant ? (
      <>
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-600 pb-2">
          {title}
        </h3>
        {description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 max-w-3xl">
            {description}
          </p>
        )}
      </>
    ) : (
      <>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">{title}</h3>
        {description && (
          <p className="text-sm text-gray-600 mb-4 max-w-3xl">{description}</p>
        )}
      </>
    )}
    {children}
  </div>
);

/**
 * @param {string} businessId
 * @param {"embedded"|"settings"} [variant] — `settings` uses Accounts-style section cards; `embedded` is the legacy Edit Business / View tab look.
 * @param {boolean} [showDelete] — show clear / delete (CustomModal) for Accounts E-Invoice Settings.
 * @param {boolean} [canUpdate] — settings RBAC: save / edit fields.
 * @param {boolean} [canDelete] — settings RBAC: clear e-invoice settings.
 */
const BusinessDetailsTab = ({
  businessId,
  variant = "embedded",
  showDelete = false,
  canUpdate = true,
  canDelete = true,
}) => {
  const { t } = useTranslation();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [fetchingTin, setFetchingTin] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [showExternalApiKey, setShowExternalApiKey] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [businessData, setBusinessData] = useState(initialState);
  const [recordId, setRecordId] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const settingsVariant = variant === "settings";

  // Dropdown sources
  const [inventoryItems, setInventoryItems] = useState([]);
  const [taxClasses, setTaxClasses] = useState([]);
  const [bizStreetAndPhone, setBizStreetAndPhone] = useState({
    address: "",
    tel: "",
  });

  useEffect(() => {
    if (businessId) {
      setInitialLoading(true);
      Promise.all([
        fetchBusinessData(),
        fetchInventoryItems(),
        fetchTaxClasses(),
        fetchBusinessProfileForAddress(),
      ]).finally(() => setInitialLoading(false));
    } else {
      setInitialLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const fetchBusinessProfileForAddress = async () => {
    if (!businessId) return;
    try {
      const headers = adminInfo
        ? { authorization: `Bearer ${adminInfo.token}` }
        : {};
      const res = await axios.get(`${Base_URL}/Business/${businessId}`, {
        headers,
      });
      const row = res.data?.data || res.data;
      if (row) {
        setBizStreetAndPhone({
          address: row.address || "",
          tel: row.tel || "",
        });
      }
    } catch {
      setBizStreetAndPhone({ address: "", tel: "" });
    }
  };

  const authHeaders = adminInfo
    ? {
        "Content-Type": "application/json",
        authorization: `Bearer ${adminInfo.token}`,
      }
    : {};

  const fetchBusinessData = async () => {
    try {
      const response = await BusinessDetailsService.getByBusinessId(
        businessId,
        authHeaders
      );
      if (response.data?.data?.length) {
        const row = response.data.data[0];
        setRecordId(row._id || null);
        setBusinessData((prev) => ({
          ...prev,
          ...row,
          idType: row.idType || "BRN",
          identificationCodeCountry: row.identificationCodeCountry || "MYS",
          useTestingEnvironment: row.useTestingEnvironment !== false,
          eInvoiceAutoApproval: !!row.eInvoiceAutoApproval,
          defaultEInvoiceItem: row.defaultEInvoiceItem || "",
          defaultEInvoiceTaxClass: row.defaultEInvoiceTaxClass || "",
          defaultEInvoiceInvoiceFor: row.defaultEInvoiceInvoiceFor || "",
          externalApiUrl: row.externalApiUrl || "",
          externalApiKey: row.externalApiKey || "",
          countrySubentityCode: row.countrySubentityCode || "14",
        }));
      } else {
        setRecordId(null);
      }
    } catch (error) {
      console.error("Error fetching business data:", error);
    }
  };

  const fetchInventoryItems = async () => {
    try {
      const res = await ItemsServices.getItemsByBusiness(businessId);
      const items = res?.data || res?.items || res || [];
      setInventoryItems(Array.isArray(items) ? items : []);
    } catch (err) {
      console.warn("Could not load inventory items:", err?.message || err);
      setInventoryItems([]);
    }
  };

  const fetchTaxClasses = async () => {
    try {
      const res = await getTaxes(businessId);
      const taxes = res?.data?.data || res?.data || [];
      setTaxClasses(Array.isArray(taxes) ? taxes : []);
    } catch (err) {
      console.warn("Could not load tax classes:", err?.message || err);
      setTaxClasses([]);
    }
  };

  const clearFieldError = (name) => {
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const v = type === "checkbox" ? checked : value;
    setBusinessData((prev) => ({ ...prev, [name]: v }));
    clearFieldError(name);
  };

  const handleFetchTin = async () => {
    const errors = {};
    if (!businessData.idType) errors.idType = t("eInvoiceForm.errors.idTypeRequired", "ID Type is required");
    if (!businessData.idValue) errors.idValue = t("eInvoiceForm.errors.idValueRequired", "ID Value is required");
    if (Object.keys(errors).length) {
      setFieldErrors((prev) => ({ ...prev, ...errors }));
      notifyError(t("eInvoiceForm.errors.enterIdTypeAndValue", "Please enter ID Type and ID Value first"));
      return;
    }
    if (!businessId) {
      notifyError(t("eInvoiceForm.errors.businessIdMissing", "Business ID is missing. Save the business first."));
      return;
    }
    setFetchingTin(true);
    try {
      const res = await EInvoiceServices.searchTinForBusiness({
        idType: businessData.idType,
        idValue: businessData.idValue,
        businessId,
      });
      const body = res?.data || {};
      if (body.status && body.data?.tin) {
        setBusinessData((prev) => ({ ...prev, tin: body.data.tin }));
        notifySuccess(t("eInvoiceForm.errors.tinFetchedSuccess", "TIN fetched successfully from MyInvois"));
      } else {
        notifyError(body.message || t("eInvoiceForm.errors.tinNotFound", "TIN not found for the provided ID"));
      }
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        t("eInvoiceForm.errors.tinFetchFailed", "Failed to fetch TIN from MyInvois");
      notifyError(msg);
    } finally {
      setFetchingTin(false);
    }
  };

  const validate = () => {
    const errors = {};
    if (!businessData.tin?.trim()) {
      errors.tin = t("eInvoiceForm.errors.tinRequired", "TIN is required");
    }
    if (!businessData.idType?.trim()) {
      errors.idType = t("eInvoiceForm.errors.idTypeRequired", "ID Type is required");
    }
    if (!businessData.idValue?.trim()) {
      errors.idValue = t("eInvoiceForm.errors.idValueRequired", "ID Value is required");
    }
    if (!businessData.client_id?.trim()) {
      errors.client_id = t(
        "eInvoiceForm.errors.clientIdRequired",
        "Client ID is required"
      );
    }
    if (!businessData.client_secret?.trim()) {
      errors.client_secret = t(
        "eInvoiceForm.errors.clientSecretRequired",
        "Client Secret is required"
      );
    }
    if (businessData.eInvoiceAutoApproval) {
      if (!businessData.defaultEInvoiceItem) {
        errors.defaultEInvoiceItem = t(
          "eInvoiceForm.errors.defaultItemRequired",
          "Default Item is required when auto-approval is enabled"
        );
      }
      if (!businessData.defaultEInvoiceTaxClass) {
        errors.defaultEInvoiceTaxClass = t(
          "eInvoiceForm.errors.defaultTaxRequired",
          "Default Tax Class is required when auto-approval is enabled"
        );
      }
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (settingsVariant && !canUpdate) {
      notifyError(t("eInvoiceForm.errors.noUpdatePermission", "You do not have permission to update e-invoice settings."));
      return;
    }
    if (!validate()) {
      notifyError(t("eInvoiceForm.errors.fixHighlightedFields", "Please fix the highlighted fields"));
      return;
    }
    setLoading(true);
    try {
      const { addressLine1: _a1, contactNumber: _c, ...restBusinessData } =
        businessData;
      const payload = {
        ...restBusinessData,
        business_id: businessId,
        // normalise empty ObjectIds to null so Mongoose casts cleanly
        defaultEInvoiceItem: businessData.defaultEInvoiceItem || null,
        defaultEInvoiceTaxClass: businessData.defaultEInvoiceTaxClass || null,
      };
      if (recordId) payload._id = recordId;
      const response = await BusinessDetailsService.add(
        payload,
        authHeaders
      );
      if (response.status === 200 || response.status === 201) {
        if (response.data?.data?._id) setRecordId(response.data.data._id);
        else if (response.data?.data?.[0]?._id) setRecordId(response.data.data[0]._id);
        else await fetchBusinessData();
        notifySuccess(
          t("business.businessDetailsSavedSuccessfully") ||
            "Business details saved successfully"
        );
      }
    } catch (error) {
      const msg =
        error?.response?.data?.message ||
        t("business.errorOccurredWhileSavingBusinessDetails") ||
        "Failed to save business details";
      notifyError(msg);
      console.error("API Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!businessId) return;
    if (!canDelete) {
      notifyError(t("eInvoiceForm.errors.noDeletePermission", "You do not have permission to clear e-invoice settings."));
      return;
    }
    setDeleteLoading(true);
    try {
      const removed = await BusinessDetailsService.remove(
        recordId,
        businessId,
        authHeaders
      );
      if (removed) {
        setBusinessData({ ...initialState });
        setRecordId(null);
        setFieldErrors({});
        setDeleteModalOpen(false);
        notifySuccess(t("eInvoiceForm.errors.settingsRemoved", "E-invoice settings removed"));
        return;
      }
      notifyError(
        t(
          "eInvoiceForm.errors.clearFailed",
          "Could not clear e-invoice settings"
        )
      );
    } catch (error) {
      const msg =
        error?.response?.data?.message ||
        error?.message ||
        t("eInvoiceForm.errors.clearFailed", "Could not clear e-invoice settings");
      notifyError(msg);
    } finally {
      setDeleteLoading(false);
    }
  };

  const shellClass = settingsVariant
    ? "space-y-6"
    : "sm:container mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg";
  /** `contents` = no extra layout box; keeps one DOM tree for embedded (Edit Business) vs card for Accounts settings. */
  const firstBlockClass = settingsVariant
    ? "w-full bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-4"
    : "contents";

  if (settingsVariant && initialLoading) {
    return <EInvoicePanelSkeleton />;
  }

  return (
    <div className={shellClass}>
      {!settingsVariant && (
        <>
          <h2 className="text-xl font-semibold mb-1">
            Business Details & E-Invoice Configuration
          </h2>
          <p className="text-sm text-gray-500 mb-6 max-w-3xl">
            These settings identify your business to the Malaysian MyInvois
            (LHDN) system. You must configure the TIN, ID and API credentials
            below before PCI can submit customer invoices as e-invoices.
          </p>
        </>
      )}

      <form onSubmit={handleSubmit}>
        <fieldset
          disabled={settingsVariant && !canUpdate}
          className={settingsVariant && !canUpdate ? "opacity-90" : undefined}
        >
        <div className={firstBlockClass}>
          {settingsVariant && (
            <>
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-600 pb-2">
                {t("eInvoiceForm.supplierTitle", "Supplier identity & address (LHDN)")}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 max-w-3xl -mt-1">
                {t("eInvoiceForm.supplierDesc", "TIN, registration, and MSIC. Street address and main phone come from the business profile; city, postcode, and state here are the LHDN fields for MyInvois.")}
              </p>
            </>
          )}
          <div
            className={
              settingsVariant
                ? "grid grid-cols-1 md:grid-cols-2 gap-6 pt-1"
                : "grid grid-cols-1 md:grid-cols-2 gap-6"
            }
          >
          {/* TIN + Fetch */}
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("eInvoiceForm.tin", "TIN")} <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                name="tin"
                value={businessData.tin}
                onChange={handleChange}
                placeholder={t("eInvoiceForm.tinPlaceholder", "e.g. C1234567890")}
                className={`border rounded-lg p-2 flex-1 ${
                  fieldErrors.tin ? "border-red-400" : "border-gray-300"
                }`}
              />
              <button
                type="button"
                onClick={handleFetchTin}
                disabled={fetchingTin}
                className="px-3 py-2 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[var(--p-blue-dark)] disabled:opacity-50 whitespace-nowrap"
                title={t("eInvoiceForm.fetchTinTooltip", "Fetch TIN from LHDN API using ID Type and ID Value")}
              >
                {fetchingTin ? t("eInvoiceForm.fetching", "Fetching...") : t("eInvoiceForm.fetchTin", "Fetch TIN")}
              </button>
            </div>
            {fieldErrors.tin && (
              <p className="mt-1 text-xs text-red-500">{fieldErrors.tin}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              {t("eInvoiceForm.tinHint", "Enter ID Value and click \"Fetch TIN\" to auto-populate from LHDN.")}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("eInvoiceForm.idType", "ID Type")} <span className="text-red-500">*</span>
            </label>
            <select
              name="idType"
              value={businessData.idType}
              onChange={handleChange}
              className={`border rounded-lg p-2 w-full ${
                fieldErrors.idType ? "border-red-400" : "border-gray-300"
              }`}
            >
              {ID_TYPES.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            {fieldErrors.idType && (
              <p className="mt-1 text-xs text-red-500">{fieldErrors.idType}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("eInvoiceForm.idValue", "ID Value")} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="idValue"
              value={businessData.idValue}
              onChange={handleChange}
              placeholder={t("eInvoiceForm.idValuePlaceholder", "Business Registration / NRIC / Passport No.")}
              className={`border rounded-lg p-2 w-full ${
                fieldErrors.idValue ? "border-red-400" : "border-gray-300"
              }`}
            />
            {fieldErrors.idValue && (
              <p className="mt-1 text-xs text-red-500">{fieldErrors.idValue}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("eInvoiceForm.registrationNumber", "Registration number (optional)")}
            </label>
            <input
              type="text"
              name="registrationNumber"
              value={businessData.registrationNumber}
              onChange={handleChange}
              placeholder={t("eInvoiceForm.registrationNumberPlaceholder", "SSM / company no. if different from ID Value")}
              className="border border-gray-300 rounded-lg p-2 w-full"
            />
            <p className="mt-1 text-xs text-gray-500">
              {t("eInvoiceForm.registrationNumberHint", "Often the same as BRN in ID Value — leave blank if identical.")}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("eInvoiceForm.sstRegistrationNumber", "SST Registration Number")}
            </label>
            <input
              type="text"
              name="sstRegistrationNumber"
              value={businessData.sstRegistrationNumber}
              onChange={handleChange}
              placeholder={t("eInvoiceForm.sstRegistrationNumberPlaceholder", "SST Registration Number")}
              className="border border-gray-300 rounded-lg p-2 w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("eInvoiceForm.msicCode", "MSIC Code")}
            </label>
            <input
              type="text"
              name="msicCode"
              value={businessData.msicCode}
              onChange={handleChange}
              placeholder={t("eInvoiceForm.msicCodePlaceholder", "MSIC 2008 code")}
              className="border border-gray-300 rounded-lg p-2 w-full"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("eInvoiceForm.businessActivityDescription", "Business Activity Description")}
            </label>
            <input
              type="text"
              name="BusinessActivityDescription"
              value={businessData.BusinessActivityDescription}
              onChange={handleChange}
              placeholder={t("eInvoiceForm.businessActivityDescriptionPlaceholder", "Describe the main activity of the business")}
              className="border border-gray-300 rounded-lg p-2 w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("eInvoiceForm.cityName", "City Name")}
            </label>
            <input
              type="text"
              name="cityName"
              value={businessData.cityName || ""}
              onChange={handleChange}
              placeholder={t("eInvoiceForm.cityNamePlaceholder", "e.g. Kuala Lumpur")}
              className="border border-gray-300 rounded-lg p-2 w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("eInvoiceForm.postalZone", "Postal Zone")}
            </label>
            <input
              type="text"
              name="postalZone"
              value={businessData.postalZone}
              onChange={handleChange}
              placeholder={t("eInvoiceForm.postalZonePlaceholder", "e.g. 50088")}
              className="border border-gray-300 rounded-lg p-2 w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("eInvoiceForm.state", "State (Country Subentity Code)")}
            </label>
            <select
              name="countrySubentityCode"
              value={businessData.countrySubentityCode || "14"}
              onChange={handleChange}
              className="border border-gray-300 rounded-lg p-2 w-full"
            >
              {MY_STATE_CODES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.code} — {s.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              {t("eInvoiceForm.stateHint", "Defaults to 14 (Kuala Lumpur) like InvoisPls. Adjust if the supplier address is in another state.")}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("eInvoiceForm.country", "Country")}
            </label>
            <input
              type="text"
              name="identificationCodeCountry"
              value={businessData.identificationCodeCountry}
              onChange={handleChange}
              placeholder={t("eInvoiceForm.countryPlaceholder", "MYS")}
              className="border border-gray-300 rounded-lg p-2 w-full"
            />
          </div>

          <div className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50/80 dark:bg-slate-900/30 dark:border-slate-600 p-4 space-y-2">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
              {t("eInvoiceForm.streetAddressTitle", "Street address & phone (from Business profile)")}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {t("eInvoiceForm.streetAddressDesc", "LHDN uses the same address and phone as Add / Edit Business — single source, no duplicate fields here. Edit the business record to change them.")}
            </p>
            {bizStreetAndPhone.address || bizStreetAndPhone.tel ? (
              <ul className="text-sm text-gray-800 dark:text-gray-200 space-y-1 list-none">
                {bizStreetAndPhone.address ? (
                  <li>
                    <span className="text-gray-500">{t("eInvoiceForm.address", "Address")}: </span>
                    {bizStreetAndPhone.address}
                  </li>
                ) : null}
                {bizStreetAndPhone.tel ? (
                  <li>
                    <span className="text-gray-500">{t("eInvoiceForm.phone", "Phone")}: </span>
                    {bizStreetAndPhone.tel}
                  </li>
                ) : null}
              </ul>
            ) : (
              <p className="text-sm text-amber-800 dark:text-amber-200">
                {t("eInvoiceForm.setAddressWarning", "Set address and phone on the business before submitting e-invoices.")}
              </p>
            )}
            <Link
              to={`/Edit Business/${businessId}`}
              className="inline-block text-sm font-medium text-[var(--p-blue)] hover:underline"
            >
              {t("eInvoiceForm.openEditBusiness", "Open Edit Business")}
            </Link>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("eInvoiceForm.addressLine2", "Address line 2 (optional)")}
            </label>
            <input
              type="text"
              name="addressLine2"
              value={businessData.addressLine2}
              onChange={handleChange}
              placeholder={t("eInvoiceForm.addressLine2Placeholder", "Unit, suite, floor (LHDN optional second line)")}
              className="border border-gray-300 rounded-lg p-2 w-full"
            />
            <p className="mt-1 text-xs text-gray-500">
              {t("eInvoiceForm.addressLine2Hint", "Main street address comes from the business profile; use this only for an extra line (e.g. unit number).")}
            </p>
          </div>
        </div>
        </div>

        {/* ── E-Invoice API Configuration ─────────────────────────────── */}
        <Section
          title={t("eInvoiceForm.apiConfigTitle", "E-Invoice API Configuration")}
          description={t("eInvoiceForm.apiConfigDesc", "OAuth credentials issued by LHDN MyInvois for this business. Use the testing (preprod) environment while you validate your setup.")}
          settingsVariant={settingsVariant}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t("eInvoiceForm.clientId", "Client ID")}{" "}
                <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="client_id"
                value={businessData.client_id}
                onChange={handleChange}
                placeholder={t("eInvoiceForm.clientIdPlaceholder", "MyInvois Client ID")}
                className={`border rounded-lg p-2 w-full ${
                  fieldErrors.client_id ? "border-red-400" : "border-gray-300"
                }`}
              />
              {fieldErrors.client_id && (
                <p className="mt-1 text-xs text-red-500">
                  {fieldErrors.client_id}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t("eInvoiceForm.clientSecret", "Client Secret")}{" "}
                <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type={showSecret ? "text" : "password"}
                  name="client_secret"
                  value={businessData.client_secret}
                  onChange={handleChange}
                  placeholder={t("eInvoiceForm.clientSecretPlaceholder", "MyInvois Client Secret")}
                  className={`border rounded-lg p-2 flex-1 ${
                    fieldErrors.client_secret
                      ? "border-red-400"
                      : "border-gray-300"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowSecret((v) => !v)}
                  className="px-3 py-2 text-sm bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200"
                >
                  {showSecret ? t("eInvoiceForm.hide", "Hide") : t("eInvoiceForm.show", "Show")}
                </button>
              </div>
              {fieldErrors.client_secret && (
                <p className="mt-1 text-xs text-red-500">
                  {fieldErrors.client_secret}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t("eInvoiceForm.onBehalfOf", "On Behalf Of (TIN)")}
              </label>
              <input
                type="text"
                name="onbehalfof"
                value={businessData.onbehalfof}
                onChange={handleChange}
                placeholder={t("eInvoiceForm.onBehalfOfPlaceholder", "Defaults to the business TIN if blank")}
                className="border border-gray-300 rounded-lg p-2 w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t("eInvoiceForm.useTestingEnvironment", "Use Testing Environment")}
              </label>
              <label className="inline-flex items-center gap-3 cursor-pointer bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
                <input
                  type="checkbox"
                  name="useTestingEnvironment"
                  checked={!!businessData.useTestingEnvironment}
                  onChange={handleChange}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-800">
                  {businessData.useTestingEnvironment
                    ? t("eInvoiceForm.testingYes", "Yes — preprod-api.myinvois.hasil.gov.my")
                    : t("eInvoiceForm.testingNo", "No — api.myinvois.hasil.gov.my (production)")}
                </span>
              </label>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t("eInvoiceForm.externalApiUrl", "External API URL")}
              </label>
              <input
                type="url"
                name="externalApiUrl"
                value={businessData.externalApiUrl}
                onChange={handleChange}
                placeholder={t("eInvoiceForm.externalApiUrlPlaceholder", "https://staging.example.com/.../update_invoice_status")}
                className="border border-gray-300 rounded-lg p-2 w-full"
              />
              <p className="mt-1 text-xs text-gray-500">
                {t("eInvoiceForm.externalApiUrlHint", "Optional. When set, PCI POSTs LHDN status updates (Valid / Invalid / Rejected / Cancelled) to this URL — same payload as InvoisPls IPOPS integration. Leave blank to disable.")}
              </p>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t("eInvoiceForm.externalApiKey", "External API Key")}
              </label>
              <div className="flex gap-2">
                <input
                  type={showExternalApiKey ? "text" : "password"}
                  name="externalApiKey"
                  value={businessData.externalApiKey}
                  onChange={handleChange}
                  placeholder={t("eInvoiceForm.externalApiKeyPlaceholder", "Sent as x-api-key (optional)")}
                  className="border border-gray-300 rounded-lg p-2 flex-1"
                />
                <button
                  type="button"
                  onClick={() => setShowExternalApiKey((v) => !v)}
                  className="px-3 py-2 text-sm bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200"
                >
                  {showExternalApiKey ? t("eInvoiceForm.hide", "Hide") : t("eInvoiceForm.show", "Show")}
                </button>
              </div>
            </div>
          </div>
        </Section>

        {/* ── E-Invoice Auto Approval Settings ────────────────────────── */}
        <Section
          title={t("eInvoiceForm.autoApprovalTitle", "E-Invoice Auto Approval Settings")}
          description={t("eInvoiceForm.autoApprovalDesc", "When enabled, customer invoices you save are automatically submitted to LHDN as soon as supplier + buyer data is valid. Disable this to keep invoices in Pending state and submit them manually from the Customer Invoices list.")}
          settingsVariant={settingsVariant}
        >
          <label className="flex items-start gap-3 cursor-pointer mb-5">
            <input
              type="checkbox"
              name="eInvoiceAutoApproval"
              checked={!!businessData.eInvoiceAutoApproval}
              onChange={handleChange}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-800">
              {t("eInvoiceForm.autoSubmitLabel", "Automatically submit eligible customer invoices to LHDN after save/send")}
            </span>
          </label>

          {businessData.eInvoiceAutoApproval && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t("eInvoiceForm.defaultItem", "Default Item")}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <select
                  name="defaultEInvoiceItem"
                  value={businessData.defaultEInvoiceItem}
                  onChange={handleChange}
                  className={`border rounded-lg p-2 w-full bg-white ${
                    fieldErrors.defaultEInvoiceItem
                      ? "border-red-400"
                      : "border-gray-300"
                  }`}
                >
                  <option value="">{t("eInvoiceForm.none", "-- None --")}</option>
                  {inventoryItems.map((it) => (
                    <option key={it._id} value={it._id}>
                      {it.title || it.name || it.itemName || it._id}
                    </option>
                  ))}
                </select>
                {fieldErrors.defaultEInvoiceItem && (
                  <p className="mt-1 text-xs text-red-500">
                    {fieldErrors.defaultEInvoiceItem}
                  </p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  {t("eInvoiceForm.defaultItemHint", "Used for auto-approved invoices with no line items.")}
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t("eInvoiceForm.defaultTaxClass", "Default Tax Class")}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <select
                  name="defaultEInvoiceTaxClass"
                  value={businessData.defaultEInvoiceTaxClass}
                  onChange={handleChange}
                  className={`border rounded-lg p-2 w-full bg-white ${
                    fieldErrors.defaultEInvoiceTaxClass
                      ? "border-red-400"
                      : "border-gray-300"
                  }`}
                >
                  <option value="">{t("eInvoiceForm.none", "-- None --")}</option>
                  {taxClasses.map((tx) => (
                    <option key={tx._id} value={tx._id}>
                      {tx.name || tx.code || tx._id}
                      {typeof tx.rate === "number" ? ` (${tx.rate}%)` : ""}
                    </option>
                  ))}
                </select>
                {fieldErrors.defaultEInvoiceTaxClass && (
                  <p className="mt-1 text-xs text-red-500">
                    {fieldErrors.defaultEInvoiceTaxClass}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t("eInvoiceForm.defaultInvoiceFor", "Default Invoice For")}
                </label>
                <select
                  name="defaultEInvoiceInvoiceFor"
                  value={businessData.defaultEInvoiceInvoiceFor}
                  onChange={handleChange}
                  className="border border-gray-300 rounded-lg p-2 w-full bg-white"
                >
                  <option value="">{t("eInvoiceForm.select", "-- Select --")}</option>
                  {INVOICE_FOR_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </Section>
        </fieldset>

        <div
          className={`mt-8 flex flex-wrap items-center gap-4 ${
            showDelete && settingsVariant ? "justify-between" : "justify-end"
          }`}
        >
          {showDelete && settingsVariant && canDelete && (
            <button
              type="button"
              onClick={() => setDeleteModalOpen(true)}
              className="px-4 py-2 rounded-lg border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 text-sm font-medium transition-colors"
            >
              {t("eInvoiceForm.clearSettings", "Clear e-invoice settings")}
            </button>
          )}
          {(!settingsVariant || canUpdate) && (
          <Button type="submit" disabled={loading} color="primary">
            {loading ? t("Saving...") : t("Save")}
          </Button>
          )}
        </div>
      </form>

      {showDelete && settingsVariant && (
        <CustomModal
          open={deleteModalOpen}
          onClose={() => !deleteLoading && setDeleteModalOpen(false)}
          title={t("eInvoiceForm.clearSettingsTitle", "Clear e-invoice settings?")}
          showActions
          actions={[
            {
              label: t("eInvoiceForm.cancel", "Cancel"),
              secondary: true,
              onClick: () => setDeleteModalOpen(false),
              disabled: deleteLoading,
            },
            {
              label: deleteLoading ? t("eInvoiceForm.clearing", "Clearing…") : t("eInvoiceForm.clearSettingsBtn", "Clear settings"),
              primary: true,
              failure: true,
              onClick: handleConfirmDelete,
              disabled: deleteLoading,
            },
          ]}
        >
          <p className="text-gray-700 text-sm">
            {t("eInvoiceForm.clearSettingsConfirm", "This removes or resets MyInvois API credentials, TIN, and auto-approval defaults for this business. You can reconfigure them at any time.")}
          </p>
        </CustomModal>
      )}
    </div>
  );
};

export default BusinessDetailsTab;
