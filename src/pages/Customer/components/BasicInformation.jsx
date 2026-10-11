import React, { useState, useEffect, useMemo, useContext, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Form, useFormScreenExit } from "@/page-layouts";
import { notifyError } from "@/utils/toast";
import { AdminContext } from "@/context/AdminContext";
import DynamicCustomFieldsForm from "@/components/custom-fields/DynamicCustomFieldsForm";
import { fetchDefinitions } from "@/services/customFieldServices";
import { validateCustomFieldValues } from "@/utils/customFieldValidation";
import { injectCustomFieldsInFormFields } from "@/utils/customFieldPlacement";
import {
  findCountry,
  findState,
  getCityOptions,
  getCountryOptions,
  getStateOptions,
} from "@/utils/locationCascade";
import { parseGoogleAddressComponents } from "@/utils/parseGoogleAddress";
import GooglePlacesAddressInput from "@/components/GooglePlacesAddressInput";

/** Normalize business selection to a stable list of string IDs. */
const getSelectedBusinessIds = (business) => {
  if (!business) return [];
  if (Array.isArray(business)) {
    return business
      .map((b) => (typeof b === "object" && b !== null ? b._id ?? b.value : b))
      .filter(Boolean)
      .map(String);
  }
  if (typeof business === "object" && business !== null) {
    const id = business._id ?? business.value;
    return id ? [String(id)] : [];
  }
  return [String(business)].filter((id) => id && id !== "undefined");
};

const ADDRESS_LABEL_OPTIONS = [
  { value: "HQ", label: "HQ" },
  { value: "Inspection", label: "Inspection" },
  { value: "Certification", label: "Certification" },
];

const STATUS_OPTIONS = [
  { value: "Active", label: "Active" },
  { value: "Inactive", label: "Inactive" },
];

const emptyForm = () => ({
  business: [],
  companyName: "",
  companyRegistrationNumber: "",
  customerEmail: "",
  website: "",
  addressLabel: "HQ",
  companyAddress: "",
  street: "",
  block: "",
  postCode: "",
  country: "",
  countryCode: "",
  stateProvince: "",
  stateCode: "",
  city: "",
  gpsCoordinates: "",
  password: "",
  status: "Active",
  customerDisplayName: "",
  client_type: "Company",
  regionCoordinates: { lat: null, lng: null },
});

/** Map API / parent basicInformation → form state (edit hydrate). */
const mapInitialToForm = (initialData = {}, prevBusiness = []) => {
  let businessValue = prevBusiness;
  if (initialData.business) {
    if (Array.isArray(initialData.business)) {
      businessValue = initialData.business;
    } else if (
      typeof initialData.business === "string" ||
      initialData.business?._id
    ) {
      const id =
        typeof initialData.business === "object"
          ? initialData.business._id
          : initialData.business;
      businessValue = [id];
    }
  }

  const coords = initialData.regionCoordinates || { lat: null, lng: null };
  const gpsFromCoords =
    coords?.lat != null && coords?.lng != null
      ? `${coords.lat}, ${coords.lng}`
      : "";

  const matchedCountry = findCountry(
    initialData.countryCode || initialData.country,
  );
  const countryCode = matchedCountry?.isoCode || "";
  const matchedState = findState(
    countryCode,
    initialData.stateCode || initialData.stateProvince,
  );

  return {
    ...emptyForm(),
    business: businessValue || [],
    companyName: initialData.companyName || "",
    companyRegistrationNumber: initialData.companyRegistrationNumber || "",
    customerEmail: initialData.customerEmail || "",
    website: initialData.website || "",
    addressLabel: initialData.addressLabel || "HQ",
    companyAddress: initialData.companyAddress || "",
    street:
      initialData.street ||
      initialData.addressLine1 ||
      initialData.streetAddress ||
      "",
    block: initialData.block || initialData.addressLine2 || "",
    postCode: initialData.postCode || "",
    country: matchedCountry?.name || initialData.country || "",
    countryCode,
    stateProvince: matchedState?.name || initialData.stateProvince || "",
    stateCode: matchedState?.isoCode || "",
    city: initialData.city || "",
    gpsCoordinates: initialData.gpsCoordinates || gpsFromCoords || "",
    password: "",
    status: initialData.status || "Active",
    customerDisplayName:
      initialData.customerDisplayName || initialData.companyName || "",
    client_type: "Company",
    regionCoordinates: coords,
  };
};

/**
 * Explicit PCI basicInformation payload — only these fields are saved/read.
 * Do not rely on spreading leftover ERP fields.
 */
export const buildPciBasicInformationPayload = (form = {}) => {
  const companyName = String(form.companyName || "").trim();
  const gps = String(form.gpsCoordinates || "").trim();
  let regionCoordinates = form.regionCoordinates || { lat: null, lng: null };
  if (gps) {
    const parts = gps.split(/[,;\s]+/).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const lat = parseFloat(parts[0]);
      const lng = parseFloat(parts[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        regionCoordinates = { lat, lng };
      }
    }
  }

  return {
    companyName,
    companyRegistrationNumber: String(
      form.companyRegistrationNumber || "",
    ).trim(),
    customerEmail: String(form.customerEmail || "").trim(),
    website: String(form.website || "").trim(),
    addressLabel: String(form.addressLabel || "HQ").trim() || "HQ",
    companyAddress: String(form.companyAddress || "").trim(),
    street: String(form.street || "").trim(),
    block: String(form.block || "").trim(),
    postCode: String(form.postCode || "").trim(),
    country: String(form.country || "").trim(),
    stateProvince: String(form.stateProvince || "").trim(),
    city: String(form.city || "").trim(),
    gpsCoordinates: gps,
    customerDisplayName: String(
      form.customerDisplayName || companyName || "",
    ).trim(),
    client_type: "Company",
    regionCoordinates,
  };
};

const BasicInformation = ({
  onChange,
  businesses = [],
  initialData = {},
  isEditMode = false,
  onSave,
  customerId,
}) => {
  const { t } = useTranslation();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const requestHeaders = useMemo(
    () => ({
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo?.token}`,
    }),
    [adminInfo?.token],
  );

  const [isOpen] = useState(true);
  const exitCustomersScreen = useFormScreenExit("/customers");
  const [formData, setFormData] = useState(emptyForm);
  const [isSaveDisabled, setIsSaveDisabled] = useState(true);
  const [showErrors, setShowErrors] = useState(false);
  const [customFieldValuesByBusiness, setCustomFieldValuesByBusiness] =
    useState({});
  const [touchedFields, setTouchedFields] = useState({});
  const [errors, setErrors] = useState({});
  const hydratedCustomerRef = useRef("");
  const placeJustSelectedRef = useRef(false);

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const countryOptions = useMemo(() => getCountryOptions(), []);
  const stateOptions = useMemo(
    () => getStateOptions(formData.countryCode),
    [formData.countryCode],
  );
  const cityOptions = useMemo(
    () => getCityOptions(formData.countryCode, formData.stateCode),
    [formData.countryCode, formData.stateCode],
  );
  const countryHasStates = stateOptions.length > 0;

  const emitChange = (next) => {
    onChange?.(next);
  };

  // Reset hydrate lock when switching customers / create mode
  useEffect(() => {
    hydratedCustomerRef.current = "";
    if (!isEditMode) {
      setFormData(emptyForm());
    }
  }, [customerId, isEditMode]);

  // Hydrate edit form ONCE from API data (not on every parent re-render)
  useEffect(() => {
    if (!isEditMode || !customerId) return;

    const hasLoadedData = Boolean(
      initialData?.customerEmail ||
        initialData?.companyName ||
        initialData?.companyRegistrationNumber,
    );
    if (!hasLoadedData) return;
    if (hydratedCustomerRef.current === customerId) return;

    hydratedCustomerRef.current = customerId;
    const mapped = mapInitialToForm(initialData, initialData.business || []);
    setFormData(mapped);
    emitChange(mapped);
  }, [
    isEditMode,
    customerId,
    initialData?.customerEmail,
    initialData?.companyName,
    initialData?.companyRegistrationNumber,
    initialData?.website,
    initialData?.country,
    initialData?.stateProvince,
    initialData?.city,
    initialData?.postCode,
    initialData?.companyAddress,
    initialData?.street,
    initialData?.block,
    initialData?.gpsCoordinates,
    initialData?.addressLabel,
    initialData?.status,
  ]);

  useEffect(() => {
    const businessIsValid = Array.isArray(formData.business)
      ? formData.business.length > 0
      : formData.business && formData.business.toString().trim() !== "";

    const address = String(formData.companyAddress || "").trim();
    const gps = String(formData.gpsCoordinates || "").trim();
    const street = String(formData.street || "").trim();

    const newErrors = {
      business:
        !isEditMode && !businessIsValid
          ? t("customer.selectAtLeastOneBusiness")
          : "",
      companyName: !formData.companyName?.trim()
        ? t("customer.validation.companyNameRequired")
        : "",
      companyRegistrationNumber: !formData.companyRegistrationNumber?.trim()
        ? t("customer.validation.companyRegistrationRequired")
        : "",
      customerEmail: !formData.customerEmail?.trim()
        ? t("customer.validation.customerEmailRequired")
        : !validateEmail(formData.customerEmail)
          ? t("customer.validation.invalidEmail")
          : "",
      website: "",
      addressLabel: !formData.addressLabel
        ? t("customer.validation.addressLabelRequired")
        : "",
      companyAddress: !address
        ? t("customer.validation.companyAddressRequired", {
            defaultValue: "Company address is required",
          })
        : !gps
          ? t("customer.validation.selectGoogleAddress", {
              defaultValue:
                "Select an address from the Google suggestions",
            })
          : "",
      street: !street
        ? t("customer.validation.streetRequired", {
            defaultValue: "Street is required",
          })
        : "",
      postCode: !formData.postCode?.trim()
        ? t("customer.validation.postCodeRequired")
        : "",
      country: !formData.country?.trim()
        ? t("customer.validation.countryRequired")
        : "",
      stateProvince:
        countryHasStates && !formData.stateProvince?.trim()
          ? t("customer.validation.stateProvinceRequired")
          : "",
      city: !formData.city?.trim()
        ? t("customer.validation.cityRequired")
        : "",
      // GPS captured from Google Places — hidden from the form UI
      gpsCoordinates: "",
      password:
        formData.password?.trim() && formData.password.trim().length < 6
          ? t("customer.validation.passwordMin")
          : "",
      status: !formData.status
        ? t("customer.validation.statusRequired")
        : "",
    };

    setErrors(newErrors);

    const hasErrors = Object.values(newErrors).some((v) => v !== "");
    const requiredFilled =
      formData.companyName?.trim() &&
      formData.companyRegistrationNumber?.trim() &&
      formData.customerEmail?.trim() &&
      validateEmail(formData.customerEmail) &&
      formData.addressLabel &&
      address &&
      gps &&
      street &&
      formData.postCode?.trim() &&
      formData.country?.trim() &&
      (!countryHasStates || formData.stateProvince?.trim()) &&
      formData.city?.trim() &&
      formData.status &&
      (isEditMode || businessIsValid);

    setIsSaveDisabled(hasErrors || !requiredFilled);
  }, [formData, isEditMode, t, countryHasStates]);

  // Auto-select when only one business is available
  useEffect(() => {
    if (businesses.length !== 1) return;
    setFormData((prev) => {
      const businessIsEmpty = Array.isArray(prev.business)
        ? prev.business.length === 0
        : !prev.business;
      if (!businessIsEmpty) return prev;
      const updated = { ...prev, business: [businesses[0]._id] };
      emitChange(updated);
      return updated;
    });
  }, [businesses, isEditMode]);

  useEffect(() => {
    const ids = new Set(getSelectedBusinessIds(formData.business));
    setCustomFieldValuesByBusiness((prev) => {
      let changed = false;
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        if (!ids.has(k)) {
          delete next[k];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [formData.business]);

  const applyFieldChange = (prev, field, value) => {
    const updated = { ...prev, [field]: value };
    const hasCompanyAddress = Boolean(
      String(
        field === "companyAddress" ? value : prev.companyAddress || "",
      ).trim(),
    );

    if (field === "companyName") {
      updated.customerDisplayName = value;
    }

    if (field === "country" || field === "countryCode") {
      const country = findCountry(value);
      updated.country = country?.name || value || "";
      updated.countryCode = country?.isoCode || "";
      updated.stateProvince = "";
      updated.stateCode = "";
      updated.city = "";
      // Keep GPS when company address was picked from Google
      if (!hasCompanyAddress) {
        updated.gpsCoordinates = "";
        updated.regionCoordinates = { lat: null, lng: null };
      }
    }

    if (field === "stateProvince" || field === "stateCode") {
      const st = findState(prev.countryCode, value);
      updated.stateProvince = st?.name || value || "";
      updated.stateCode = st?.isoCode || "";
      updated.city = "";
      if (!hasCompanyAddress) {
        updated.gpsCoordinates = "";
        updated.regionCoordinates = { lat: null, lng: null };
      }
    }

    if (field === "city") {
      updated.city = value || "";
      // City centroid must not replace Google Places GPS
    }

    // Manual typing — clear Google-derived GPS / street so save stays blocked
    // until a Places suggestion is selected again.
    if (field === "companyAddress") {
      updated.gpsCoordinates = "";
      updated.regionCoordinates = { lat: null, lng: null };
      updated.street = "";
      updated.block = "";
    }

    return updated;
  };

  const handleChange = (field, value) => {
    setTouchedFields((prev) =>
      prev[field] ? prev : { ...prev, [field]: true },
    );
    setFormData((prev) => {
      const updated = applyFieldChange(prev, field, value);
      emitChange(updated);
      return updated;
    });
  };

  /** Google Places pick — fill address/GPS/street/block; location dropdowns only if empty. */
  const handleCompanyAddressPlaceSelected = ({
    formattedAddress,
    gpsCoordinates,
    lat,
    lng,
    components,
  }) => {
    placeJustSelectedRef.current = true;
    setFormData((prev) => {
      const parsed = parseGoogleAddressComponents(components);
      const country = findCountry(parsed.country);
      const nextCountryCode =
        prev.countryCode || country?.isoCode || "";
      const state = findState(
        nextCountryCode || country?.isoCode || "",
        parsed.state,
      );

      const updated = {
        ...prev,
        companyAddress: formattedAddress || prev.companyAddress,
        street: parsed.street || formattedAddress || prev.street || "",
        block: parsed.block || "",
        postCode: parsed.postCode || prev.postCode,
      };

      // Prefill blank location fields only — user can still change dropdowns manually
      if (!prev.countryCode && (country || parsed.country)) {
        updated.country = country?.name || parsed.country || "";
        updated.countryCode = country?.isoCode || "";
      }
      if (!prev.stateCode && !prev.stateProvince && (state || parsed.state)) {
        updated.stateProvince = state?.name || parsed.state || "";
        updated.stateCode = state?.isoCode || "";
      }
      if (!prev.city && parsed.city) {
        updated.city = parsed.city;
      }

      if (gpsCoordinates) {
        updated.gpsCoordinates = gpsCoordinates;
        updated.regionCoordinates = {
          lat: lat ?? null,
          lng: lng ?? null,
        };
      }

      emitChange(updated);
      return updated;
    });
  };

  const handleBlur = (field) => {
    setTouchedFields((prev) => ({ ...prev, [field]: true }));
  };

  // Stable field renderer so Google Places Autocomplete is not remounted on every form keystroke
  const CompanyAddressField = useCallback(
    () => (
      <div className="w-full space-y-1">
        <GooglePlacesAddressInput
          name="companyAddress"
          placeholder={t("customer.companyAddressPlaceholder", {
            defaultValue: "Start typing and select from Google",
          })}
          value={formData.companyAddress}
          onChange={(next) => {
            // Place pick may also fire input change — don't clear GPS in that case.
            if (placeJustSelectedRef.current) {
              placeJustSelectedRef.current = false;
              return;
            }
            handleChange("companyAddress", next);
          }}
          onBlur={() => handleBlur("companyAddress")}
          onPlaceSelected={handleCompanyAddressPlaceSelected}
        />
        <p className="text-xs text-gray-500">
          {t("customer.companyAddressGoogleHint", {
            defaultValue:
              "Select an address from the Google suggestions — typed-only addresses cannot be saved.",
          })}
        </p>
      </div>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handlers are stable enough; remount only when address value/i18n changes
    [formData.companyAddress, t],
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setShowErrors(true);

    if (isSaveDisabled) {
      notifyError(t("common.formValidationErrors"));
      return;
    }

    const selectedBusinessIds = getSelectedBusinessIds(formData.business);
    for (const bid of selectedBusinessIds) {
      try {
        const defs = await fetchDefinitions(
          { businessId: bid, module: "sales", screen: "customer" },
          requestHeaders,
        );
        if (!defs.length) continue;
        const cfErr = validateCustomFieldValues(
          defs,
          customFieldValuesByBusiness[bid] || {},
        );
        if (cfErr) {
          notifyError(cfErr);
          return;
        }
      } catch (err) {
        notifyError(
          err?.response?.data?.message ||
            t("customer.validation.couldNotValidateCustomFields"),
        );
        return;
      }
    }

    // Explicit PCI payload — parent/API must persist these under basicInformation
    const payload = {
      ...buildPciBasicInformationPayload(formData),
      business: formData.business,
      password: formData.password || "",
      status: formData.status || "Active",
    };
    await onSave(payload, { customFieldValuesByBusiness });
  };

  const shouldShowError = (field) => showErrors || touchedFields[field];

  const selectedIds = getSelectedBusinessIds(formData.business);
  const cityEnabled =
    Boolean(formData.countryCode) &&
    (!countryHasStates ||
      Boolean(formData.stateCode || formData.stateProvince));

  const formFields = useMemo(
    () => [
      {
        label: t("Business"),
        name: "business",
        type: "select",
        required: true,
        value:
          businesses.length === 1
            ? Array.isArray(formData.business)
              ? formData.business?.[0] ?? ""
              : formData.business ?? ""
            : formData.business,
        onChange: (selectedValue = "") => {
          if (businesses.length === 1) {
            handleChange("business", selectedValue ? [selectedValue] : []);
            return;
          }
          handleChange("business", selectedValue);
        },
        options: businesses.map((business) => ({
          value: business._id,
          label: business.name,
        })),
        placeholder: t("Select Business"),
        sortOptions: false,
        error:
          errors.business && shouldShowError("business")
            ? errors.business
            : null,
        shouldShowError: shouldShowError("business"),
        disabled: false,
        isMulti: businesses.length > 1,
      },
      {
        label: t("customer.companyName"),
        name: "companyName",
        type: "text",
        required: true,
        placeholder: t("customer.companyName"),
        value: formData.companyName,
        onChange: (e) => handleChange("companyName", e.target.value),
        onBlur: () => handleBlur("companyName"),
        error:
          errors.companyName && shouldShowError("companyName")
            ? errors.companyName
            : null,
        shouldShowError: shouldShowError("companyName"),
      },
      {
        label: t("customer.companyRegistrationNumber"),
        name: "companyRegistrationNumber",
        type: "text",
        required: true,
        placeholder: t("customer.companyRegistrationNumber"),
        value: formData.companyRegistrationNumber,
        onChange: (e) =>
          handleChange("companyRegistrationNumber", e.target.value),
        onBlur: () => handleBlur("companyRegistrationNumber"),
        error:
          errors.companyRegistrationNumber &&
          shouldShowError("companyRegistrationNumber")
            ? errors.companyRegistrationNumber
            : null,
        shouldShowError: shouldShowError("companyRegistrationNumber"),
      },
      {
        label: t("customer.email"),
        name: "customerEmail",
        type: "email",
        required: true,
        placeholder: t("customer.email"),
        value: formData.customerEmail,
        onChange: (e) => handleChange("customerEmail", e.target.value),
        onBlur: () => handleBlur("customerEmail"),
        error:
          errors.customerEmail && shouldShowError("customerEmail")
            ? errors.customerEmail
            : null,
        shouldShowError: shouldShowError("customerEmail"),
      },
      {
        label: t("customer.website"),
        name: "website",
        type: "text",
        required: false,
        placeholder: t("customer.websitePlaceholder"),
        value: formData.website,
        onChange: (e) => handleChange("website", e.target.value),
        onBlur: () => handleBlur("website"),
        error:
          errors.website && shouldShowError("website")
            ? errors.website
            : null,
        shouldShowError: shouldShowError("website"),
      },
      {
        label: t("customer.addressLabel"),
        name: "addressLabel",
        type: "select",
        required: true,
        value: formData.addressLabel,
        onChange: (selectedValue = "") =>
          handleChange("addressLabel", selectedValue),
        options: ADDRESS_LABEL_OPTIONS,
        placeholder: t("customer.selectAddressLabel"),
        sortOptions: false,
        isClearable: false,
        error:
          errors.addressLabel && shouldShowError("addressLabel")
            ? errors.addressLabel
            : null,
        shouldShowError: shouldShowError("addressLabel"),
      },
      {
        label: t("customer.companyAddress"),
        name: "companyAddress",
        type: "custom",
        required: true,
        fullWidth: true,
        component: CompanyAddressField,
        error:
          errors.companyAddress && shouldShowError("companyAddress")
            ? errors.companyAddress
            : null,
        shouldShowError: shouldShowError("companyAddress"),
      },
      {
        label: t("customer.street", { defaultValue: "Street" }),
        name: "street",
        type: "text",
        required: true,
        placeholder: t("customer.streetPlaceholder", {
          defaultValue: "Street",
        }),
        value: formData.street,
        onChange: (e) => handleChange("street", e.target.value),
        onBlur: () => handleBlur("street"),
        error:
          errors.street && shouldShowError("street") ? errors.street : null,
        shouldShowError: shouldShowError("street"),
      },
      {
        label: t("customer.block", { defaultValue: "Block / Unit" }),
        name: "block",
        type: "text",
        required: false,
        placeholder: t("customer.blockPlaceholder", {
          defaultValue: "Block / Unit",
        }),
        value: formData.block,
        onChange: (e) => handleChange("block", e.target.value),
        onBlur: () => handleBlur("block"),
        error: null,
        shouldShowError: false,
      },
      {
        label: t("customer.country"),
        name: "country",
        type: "select",
        required: true,
        value: formData.countryCode,
        onChange: (selectedValue = "") =>
          handleChange("countryCode", selectedValue),
        options: countryOptions,
        placeholder: t("customer.selectCountry"),
        sortOptions: false,
        error:
          errors.country && shouldShowError("country")
            ? errors.country
            : null,
        shouldShowError: shouldShowError("country"),
      },
      {
        label: t("customer.stateProvince"),
        name: "stateProvince",
        type: "select",
        required: countryHasStates,
        isCreatable: true,
        disabled: !formData.countryCode,
        value: formData.stateCode || formData.stateProvince,
        onChange: (selectedValue = "") =>
          handleChange("stateCode", selectedValue),
        options: stateOptions,
        placeholder: formData.countryCode
          ? t("customer.selectState")
          : t("customer.selectCountryFirst"),
        sortOptions: false,
        error:
          errors.stateProvince && shouldShowError("stateProvince")
            ? errors.stateProvince
            : null,
        shouldShowError: shouldShowError("stateProvince"),
      },
      {
        label: t("customer.city"),
        name: "city",
        type: "select",
        required: true,
        isCreatable: true,
        disabled: !cityEnabled,
        value: formData.city,
        onChange: (selectedValue = "") => handleChange("city", selectedValue),
        options: cityOptions,
        placeholder: cityEnabled
          ? t("customer.selectCity")
          : t("customer.selectStateFirst"),
        sortOptions: false,
        error:
          errors.city && shouldShowError("city") ? errors.city : null,
        shouldShowError: shouldShowError("city"),
      },
      {
        label: t("customer.postCode"),
        name: "postCode",
        type: "text",
        required: true,
        placeholder: t("customer.postCode"),
        value: formData.postCode,
        onChange: (e) => handleChange("postCode", e.target.value),
        onBlur: () => handleBlur("postCode"),
        error:
          errors.postCode && shouldShowError("postCode")
            ? errors.postCode
            : null,
        shouldShowError: shouldShowError("postCode"),
      },
      // GPS is captured from Google Places but not shown on Add/Update Customer
      // Password is auto-generated on create and emailed to the customer (hidden from form)
      {
        label: t("customer.status"),
        name: "status",
        type: "select",
        required: true,
        value: formData.status,
        onChange: (selectedValue = "") =>
          handleChange("status", selectedValue),
        options: STATUS_OPTIONS.map((o) => ({
          ...o,
          label: t(`customer.status${o.value}`, o.label),
        })),
        placeholder: t("customer.selectStatus"),
        sortOptions: false,
        isClearable: false,
        error:
          errors.status && shouldShowError("status")
            ? errors.status
            : null,
        shouldShowError: shouldShowError("status"),
      },
    ],
    [
      t,
      formData.business,
      formData.companyName,
      formData.companyRegistrationNumber,
      formData.customerEmail,
      formData.website,
      formData.addressLabel,
      formData.companyAddress,
      formData.street,
      formData.block,
      formData.countryCode,
      formData.stateCode,
      formData.stateProvince,
      formData.city,
      formData.postCode,
      formData.status,
      businesses,
      errors,
      countryOptions,
      stateOptions,
      cityOptions,
      countryHasStates,
      cityEnabled,
      showErrors,
      touchedFields,
      CompanyAddressField,
    ],
  );

  const renderCustomerCustomFields = ({ rowHeadroom = 0 } = {}) =>
    isOpen && selectedIds.length > 0 ? (
      selectedIds.length === 1 && rowHeadroom > 0 ? (
        <DynamicCustomFieldsForm
          key={`${selectedIds[0]}-${customerId || "new"}`}
          businessId={selectedIds[0]}
          module="sales"
          screen="customer"
          recordId={customerId || undefined}
          values={customFieldValuesByBusiness[selectedIds[0]] || {}}
          onValuesChange={(v) =>
            setCustomFieldValuesByBusiness((prev) => ({
              ...prev,
              [selectedIds[0]]: v,
            }))
          }
          headers={requestHeaders}
          rowHeadroom={rowHeadroom}
        />
      ) : (
        <div className="space-y-4 pt-2">
          {selectedIds.map((bid) => {
            const bname =
              businesses.find((x) => String(x._id) === String(bid))?.name ||
              t("Business");
            return (
              <DynamicCustomFieldsForm
                key={`${bid}-${customerId || "new"}`}
                businessId={bid}
                module="sales"
                screen="customer"
                recordId={customerId || undefined}
                values={customFieldValuesByBusiness[bid] || {}}
                onValuesChange={(v) =>
                  setCustomFieldValuesByBusiness((prev) => ({
                    ...prev,
                    [bid]: v,
                  }))
                }
                headers={requestHeaders}
                caption={
                  selectedIds.length > 1
                    ? t("customer.fieldsForBusiness", { name: bname })
                    : undefined
                }
              />
            );
          })}
        </div>
      )
    ) : null;

  const { formFieldsWithCustomFields, renderInFooter } =
    injectCustomFieldsInFormFields({
      formFields,
      module: "sales",
      screen: "customer",
      customFieldComponent: renderCustomerCustomFields,
    });

  return (
    <div className="space-y-4">
      <Form
        title=""
        saveButtonText={t("customer.saveBasicInfo")}
        formFields={formFieldsWithCustomFields}
        handleSubmit={handleSubmit}
        handleCancel={exitCustomersScreen}
        isOpen={isOpen}
        labelAndFieldDirection="column"
        tightLabelInputSpacing={true}
        customLabelWidth="w-full"
        fieldsPerRow={2}
        formOuterSpacingClassName="space-y-4 mt-3"
        fieldsStackSpacingClassName="space-y-4"
        fieldsRowGapClassName="gap-4"
        beforeFooter={
          renderInFooter ? renderCustomerCustomFields() : null
        }
      />
    </div>
  );
};

export default BasicInformation;
