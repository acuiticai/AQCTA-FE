import React, { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import EInvoiceServices from "@/services/EInvoiceServices";
import { notifyError, notifySuccess } from "@/utils/toast";
import {
  MY_STATE_CODES,
  findLhdnCountrySubentityCode,
  normalizeCountryForLhdn,
} from "@/utils/malaysiaLhdnConstants";

/**
 * CustomerEInvoiceInfo
 * ────────────────────────────────────────────────────────────
 * Renders the "E-Invoice Data" card on the customer form. Maps
 * 1:1 to `NCustomer.eInvoiceInfo` on the backend and matches the
 * fields InvoisPls collects in its CustomerDetailsForm.jsx:
 *
 *   - Customer Type (Individual / Business)
 *   - TIN + "Fetch TIN" button (uses the selected business's
 *     MyInvois credentials)
 *   - ID Type + ID Value
 *   - SST Registration Number
 *   - City / Postal Zone / State (Country Subentity Code)
 *   - Country code
 *   - Address lines
 *   - Contact number
 *
 * Props:
 *   value          – current eInvoiceInfo object (may be undefined)
 *   onChange(next) – fires whenever any field changes
 *   businessId     – the business to use for TIN lookup (required
 *                    for "Fetch TIN"); when empty the button is
 *                    disabled with a helper message
 *   addresses      – optional customer address rows; enables
 *                    "Fill location from address" to avoid retyping
 *                    the same lines as the Address tab
 *   customerPhone  – optional `{ mobile, workPhone }` from Basic Information;
 *                    used for MyInvois contact (preferred over address phone)
 */

const ID_TYPES_INDIVIDUAL = ["NRIC", "PASSPORT", "ARMY"];
const ID_TYPES_BUSINESS = ["BRN"];

const BUYER_TYPES = ["Individual", "Business"];

const defaultValue = {
  buyerType: "Individual",
  tin: "",
  idType: "NRIC",
  idValue: "",
  registrationNumber: "",
  sstRegistrationNumber: "",
  cityName: "",
  postalZone: "",
  /** InvoisPls hardcodes "14" (WP Kuala Lumpur) on save; we default the same. */
  countrySubentityCode: "14",
  addressLine1: "",
  addressLine2: "",
  identificationCodeCountry: "MYS",
  contactNumber: "",
};

const inputClass =
  "w-full border border-gray-300 rounded-md p-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]";

/** MyInvois CF405: buyer PostalZone max 5 characters when country is Malaysia. */
export function clampMalaysiaPostalZone(zip, countryInput) {
  const z = zip != null ? String(zip).trim() : "";
  if (!z) return z;
  const c = normalizeCountryForLhdn(countryInput || "MYS");
  if (c === "MYS" && z.length > 5) return z.slice(0, 5);
  return z;
}

export function pickFirstMeaningfulAddress(addresses) {
  if (!Array.isArray(addresses) || !addresses.length) return null;
  const withLine = addresses.find(
    (a) => a && String(a.addressLine1 || "").trim() !== "",
  );
  return withLine || addresses[0];
}

/**
 * Phone for MyInvois: prefer Basic Information (mobile, then work phone),
 * then optional address-level phone, then existing e-invoice value.
 */
export function pickEInvoiceContactNumber(customerPhone, addressPhone, fallback = "") {
  const mobile =
    customerPhone && typeof customerPhone.mobile === "string"
      ? customerPhone.mobile.trim()
      : "";
  const work =
    customerPhone && typeof customerPhone.workPhone === "string"
      ? customerPhone.workPhone.trim()
      : "";
  const addr = addressPhone != null ? String(addressPhone).trim() : "";
  const fb = fallback != null ? String(fallback).trim() : "";
  if (mobile) return mobile;
  if (work) return work;
  if (addr) return addr;
  return fb;
}

/**
 * Overlay LHDN location from the Address tab; contact number from Basic Info Customer Phone first.
 * @param {object} [customerPhone] – `{ mobile, workPhone }` from `basicInformation.customerPhone`
 */
export function mergeEInvoiceLocationFromAddresses(
  eInvoiceInfo,
  addresses,
  customerPhone,
) {
  const base = { ...(eInvoiceInfo || {}) };
  const a = pickFirstMeaningfulAddress(addresses);
  const contactNumber = pickEInvoiceContactNumber(
    customerPhone,
    a?.phone,
    base.contactNumber || "",
  );

  if (!a) {
    return { ...base, contactNumber };
  }

  const sub =
    findLhdnCountrySubentityCode(a.state) ||
    eInvoiceInfo?.countrySubentityCode ||
    "14";
  const countryLhdn = normalizeCountryForLhdn(a.country);
  return {
    ...base,
    addressLine1: a.addressLine1 || "",
    addressLine2: a.addressLine2 || "",
    cityName: a.city || "",
    postalZone: clampMalaysiaPostalZone(
      a.zipCode != null ? String(a.zipCode) : "",
      countryLhdn,
    ),
    countrySubentityCode: sub,
    identificationCodeCountry: countryLhdn,
    contactNumber,
  };
}

/** Sync `buyerType` / default `idType` with Basic Information `client_type`. */
export function alignEInvoiceBuyerTypeWithClientType(eInvoiceInfo, clientType) {
  const base = { ...(eInvoiceInfo || {}) };
  if (clientType === "Company") {
    base.buyerType = "Business";
    if (!ID_TYPES_BUSINESS.includes(base.idType)) base.idType = "BRN";
  } else if (clientType === "Individual") {
    base.buyerType = "Individual";
    if (!ID_TYPES_INDIVIDUAL.includes(base.idType)) base.idType = "NRIC";
  }
  return base;
}

const CustomerEInvoiceInfo = ({
  value,
  onChange,
  businessId,
  addresses = [],
  /** From Basic Information — preferred source for e-invoice contact number. */
  customerPhone = null,
  className = "",
  /** When set ('Individual' | 'Company' from Basic Info), buyer type follows this — no duplicate "Customer Type" control. */
  clientType,
  /** Hide address / location / phone fields (use Address tab + merge on save). */
  hideLocationFields = false,
}) => {
  const { t } = useTranslation();
  const [data, setData] = useState(() => {
    const merged = { ...defaultValue, ...(value || {}) };
    if (!merged.countrySubentityCode || String(merged.countrySubentityCode).trim() === "") {
      merged.countrySubentityCode = "14";
    }
    merged.postalZone = clampMalaysiaPostalZone(
      merged.postalZone,
      merged.identificationCodeCountry,
    );
    return merged;
  });
  const [fetchingTin, setFetchingTin] = useState(false);

  // Keep local state in sync when parent's `value` changes (e.g. edit mode load)
  useEffect(() => {
    if (!value) return;
    const mergedForNotify = { ...defaultValue, ...value };
    const clamped = clampMalaysiaPostalZone(
      mergedForNotify.postalZone,
      mergedForNotify.identificationCodeCountry,
    );
    const raw =
      value.postalZone != null ? String(value.postalZone).trim() : "";
    if (raw !== clamped && typeof onChange === "function") {
      queueMicrotask(() =>
        onChange({
          ...mergedForNotify,
          postalZone: clamped,
        }),
      );
    }
    setData((prev) => {
      const merged = { ...prev, ...value };
      if (!merged.countrySubentityCode || String(merged.countrySubentityCode).trim() === "") {
        merged.countrySubentityCode = "14";
      }
      merged.postalZone = clamped;
      if (clientType === "Company") {
        merged.buyerType = "Business";
        if (!ID_TYPES_BUSINESS.includes(merged.idType)) merged.idType = "BRN";
      } else if (clientType === "Individual") {
        merged.buyerType = "Individual";
        if (!ID_TYPES_INDIVIDUAL.includes(merged.idType)) merged.idType = "NRIC";
      }
      return merged;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(value || {}), clientType]);

  const idTypeOptions = useMemo(() => {
    return data.buyerType === "Business"
      ? ID_TYPES_BUSINESS
      : ID_TYPES_INDIVIDUAL;
  }, [data.buyerType]);

  const emit = (next) => {
    setData(next);
    if (typeof onChange === "function") onChange(next);
  };

  const handleChange = (e) => {
    const { name, value: v } = e.target;
    let val = v;
    if (name === "postalZone") {
      val = clampMalaysiaPostalZone(v, data.identificationCodeCountry);
    }
    let next = { ...data, [name]: val };
    if (name === "identificationCodeCountry") {
      next.postalZone = clampMalaysiaPostalZone(next.postalZone, val);
    }
    // When buyerType switches, snap idType to a valid option
    if (name === "buyerType") {
      next.idType = v === "Business" ? "BRN" : "NRIC";
    }
    emit(next);
  };

  const canFillFromAddress =
    !hideLocationFields && Boolean(pickFirstMeaningfulAddress(addresses));

  const handleFillFromAddress = () => {
    const a = pickFirstMeaningfulAddress(addresses);
    if (!a) {
      notifyError(t("customer.eInvoice.addAddressFirst"));
      return;
    }
    const sub =
      findLhdnCountrySubentityCode(a.state) ||
      data.countrySubentityCode ||
      "14";
    const countryLhdn = normalizeCountryForLhdn(a.country);
    emit({
      ...data,
      addressLine1: a.addressLine1 || "",
      addressLine2: a.addressLine2 || "",
      cityName: a.city || "",
      postalZone: clampMalaysiaPostalZone(
        a.zipCode != null ? String(a.zipCode) : "",
        countryLhdn,
      ),
      countrySubentityCode: sub,
      identificationCodeCountry: countryLhdn,
      contactNumber: pickEInvoiceContactNumber(
        customerPhone,
        a.phone,
        data.contactNumber,
      ),
    });
    notifySuccess(t("customer.eInvoice.locationUpdated"));
  };

  const handleFetchTin = async () => {
    if (!data.idType || !data.idValue) {
      notifyError(t("customer.eInvoice.idTypeAndValueRequired"));
      return;
    }
    if (!businessId) {
      notifyError(t("customer.eInvoice.selectBusinessForLhdn"));
      return;
    }
    setFetchingTin(true);
    try {
      const res = await EInvoiceServices.searchTinForCustomer({
        idType: data.idType,
        idValue: data.idValue,
        businessId,
      });
      const body = res?.data || {};
      if (body.status && body.data?.tin) {
        emit({ ...data, tin: body.data.tin });
        notifySuccess(t("customer.eInvoice.tinFetched"));
      } else {
        notifyError(body.message || t("customer.eInvoice.tinNotFound"));
      }
    } catch (err) {
      notifyError(
        err?.response?.data?.message ||
          err?.message ||
          t("customer.eInvoice.tinFetchFailed")
      );
    } finally {
      setFetchingTin(false);
    }
  };

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-600  ${className}`}
    >
      <div className="mb-5 pb-4 border-b border-gray-100 dark:border-gray-600">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
          {t("customer.eInvoice.title")}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-3xl mt-1">
          {t("customer.eInvoice.description")}
        </p>
      </div>

      {/* {hideLocationFields && (
        <div className="mb-4 rounded-lg bg-amber-50 border border-amber-100 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">Location & contact for MyInvois</p>
          <p className="mt-1 text-amber-800/90">
            <span className="font-medium text-amber-900">Address fields</span> (lines, city,
            postcode, state, country) are copied from your saved addresses when you save this tab
            — the first address with line 1. Edit them under the{" "}
            <span className="font-medium">Addresses</span> tab.
          </p>
          <p className="mt-2 text-amber-800/90">
            <span className="font-medium text-amber-900">Phone</span> for the e-invoice uses{" "}
            <span className="font-medium">Customer Phone</span> from Basic Information (mobile
            first, then work phone). If those are empty, we use the phone on that address row.
          </p>
          {!pickFirstMeaningfulAddress(addresses) && (
            <p className="mt-2 text-amber-900 font-medium">
              Add an address with line 1 before submitting e-invoices for this customer.
            </p>
          )}
        </div>
      )} */}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Customer Type — hidden when synced from Basic Info "Client Type" to avoid duplicate fields */}
        {clientType !== "Company" && clientType !== "Individual" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("customer.eInvoice.customerType")} <span className="text-red-500">*</span>
            </label>
            <select
              name="buyerType"
              value={data.buyerType}
              onChange={handleChange}
              className={inputClass}
            >
              {BUYER_TYPES.map((buyerType) => (
                <option key={buyerType} value={buyerType}>
                  {buyerType === "Business"
                    ? t("customer.eInvoice.businessBuyerType")
                    : t("customer.individual")}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* TIN + Fetch */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("customer.eInvoice.tin")} <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              name="tin"
              value={data.tin}
              onChange={handleChange}
              placeholder={t("customer.eInvoice.tinPlaceholder")}
              className={inputClass}
            />
            <button
              type="button"
              onClick={handleFetchTin}
              disabled={fetchingTin}
              className="px-3 py-2 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[var(--p-blue-dark)] disabled:opacity-50 whitespace-nowrap"
              title={t("customer.eInvoice.fetchTinTitle")}
            >
              {fetchingTin ? t("customer.eInvoice.fetching") : t("customer.eInvoice.fetchTin")}
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {clientType === "Company"
              ? t("customer.eInvoice.tinHintCompany")
              : t("customer.eInvoice.tinHintIndividual")}
          </p>
        </div>

        {/* ID Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("customer.eInvoice.idType")} <span className="text-red-500">*</span>
          </label>
          <select
            name="idType"
            value={data.idType}
            onChange={handleChange}
            className={inputClass}
          >
            {idTypeOptions.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>

        {/* ID Value */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("customer.eInvoice.idValue")} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="idValue"
            value={data.idValue}
            onChange={handleChange}
            placeholder={t("customer.eInvoice.idValuePlaceholder")}
            className={inputClass}
          />
        </div>

        {/* SSM / company reg — LHDN field; use when it differs from BRN in ID Value */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("customer.eInvoice.registrationNumberOptional")}
          </label>
          <input
            type="text"
            name="registrationNumber"
            value={data.registrationNumber}
            onChange={handleChange}
            placeholder={t("customer.eInvoice.regNumberPlaceholder")}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-gray-500">
            {t("customer.eInvoice.regNumberSkipHint")}
          </p>
        </div>

        {/* SST */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("customer.eInvoice.sstRegistrationNumber")}
          </label>
          <input
            type="text"
            name="sstRegistrationNumber"
            value={data.sstRegistrationNumber}
            onChange={handleChange}
            placeholder={t("customer.eInvoice.sstRegistrationNumber")}
            className={inputClass}
          />
        </div>

        {!hideLocationFields && (
          <>
            <div className="md:col-span-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-gray-100">
              <p className="text-sm text-gray-700">
                <span className="font-medium">{t("customer.eInvoice.locationLhdn")}</span>
                <span className="text-gray-500 font-normal">
                  {" "}
                  {t("customer.eInvoice.locationSectionDescription")}
                </span>
              </p>
              <button
                type="button"
                onClick={handleFillFromAddress}
                disabled={!canFillFromAddress}
                className="px-3 py-2 text-sm bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                title={t("customer.eInvoice.fillFromAddressTitle")}
              >
                {t("customer.eInvoice.fillFromAddress")}
              </button>
            </div>

            {/* City */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("customer.eInvoice.cityName")} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="cityName"
                value={data.cityName}
                onChange={handleChange}
                placeholder="Kuala Lumpur"
                className={inputClass}
              />
            </div>

            {/* Postal */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("customer.eInvoice.postalZone")} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="postalZone"
                value={data.postalZone}
                onChange={handleChange}
                placeholder="45002"
                maxLength={
                  normalizeCountryForLhdn(data.identificationCodeCountry) === "MYS"
                    ? 5
                    : 32
                }
                className={inputClass}
              />
              {normalizeCountryForLhdn(data.identificationCodeCountry) === "MYS" && (
                <p className="mt-1 text-xs text-gray-500">
                  {t("customer.eInvoice.myInvoisPostcodeHint")}
                </p>
              )}
            </div>

            {/* State — InvoisPls does not show this; they hardcode "14". Optional override. */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("customer.eInvoice.stateCode")}
              </label>
              <select
                name="countrySubentityCode"
                value={data.countrySubentityCode || "14"}
                onChange={handleChange}
                className={inputClass}
              >
                {MY_STATE_CODES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                {t("customer.eInvoice.stateDefaultHint")}
              </p>
            </div>

            {/* Country */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("customer.eInvoice.country")}
              </label>
              <input
                type="text"
                name="identificationCodeCountry"
                value={data.identificationCodeCountry}
                onChange={handleChange}
                placeholder="MYS"
                className={inputClass}
              />
            </div>

            {/* Address Line 1 */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("customer.eInvoice.address")} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="addressLine1"
                value={data.addressLine1}
                onChange={handleChange}
                placeholder="Jalan Segambut, The Era Residence Service Area"
                className={inputClass}
              />
            </div>

            {/* Address Line 2 */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("customer.eInvoice.addressLine2")}
              </label>
              <input
                type="text"
                name="addressLine2"
                value={data.addressLine2}
                onChange={handleChange}
                placeholder=""
                className={inputClass}
              />
            </div>

            {/* Contact */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("customer.eInvoice.contactNumber")}
              </label>
              <input
                type="text"
                name="contactNumber"
                value={data.contactNumber}
                onChange={handleChange}
                placeholder="+60"
                className={inputClass}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CustomerEInvoiceInfo;
