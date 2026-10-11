import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { FiPlus, FiTrash } from "react-icons/fi";
import { LoadScript, Autocomplete } from "@react-google-maps/api";
import ConfirmationModal from "../reusablecomponents/ConfirmationModal ";
import { notifyError, notifySuccess } from "@/utils/toast";
import requests from "@/services/httpService";
import useGoogleMapsApiKey from "@/hooks/useGoogleMapsApiKey";
import {
  GOOGLE_MAPS_LIBRARIES,
  GOOGLE_MAPS_SCRIPT_ID,
} from "@/components/GooglePlacesAddressInput";

const cellInputClass =
  "w-full min-w-0 max-w-full border-0 rounded-none p-2 bg-transparent text-gray-900 placeholder:text-gray-400 shadow-none outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:bg-gray-50 appearance-none break-words";

const EMPTY_ADDRESS = {
  addressType: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  zipCode: "",
  country: "",
  phone: "",
};

const ADDRESS_FIELDS = [
  "addressType",
  "addressLine1",
  "addressLine2",
  "city",
  "state",
  "zipCode",
  "country",
  "phone",
];

const REQUIRED_FIELDS = ["addressType", "addressLine1"];

const isAddressEmpty = (address) =>
  !ADDRESS_FIELDS.some(
    (field) => address?.[field] && String(address[field]).trim() !== ""
  );

const Addresses = ({
  initialData = [],
  onChange,
  customerId,
  businessId,
  setValidationErrors,
}) => {
  const { t } = useTranslation();
  const [addresses, setAddresses] = useState(
    Array.isArray(initialData) && initialData.length > 0
      ? initialData
      : [{ ...EMPTY_ADDRESS }]
  );
  const [addressTypeOptions, setAddressTypeOptions] = useState([
    { value: "", label: "" },
  ]);
  const [addressTypesLoaded, setAddressTypesLoaded] = useState(false);
  const [hasConfiguredAddressTypes, setHasConfiguredAddressTypes] =
    useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAddressIndex, setSelectedAddressIndex] = useState(null);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const { googleMapsApiKey } = useGoogleMapsApiKey();
  const line1AutocompleteRefs = useRef({});
  const mapsAlreadyLoaded =
    typeof window !== "undefined" && Boolean(window.google?.maps?.places);

  useEffect(() => {
    if (!Array.isArray(initialData)) return;
    if (initialData.length > 0) {
      setAddresses(initialData);
      const initialTouched = {};
      initialData.forEach((_, index) => {
        initialTouched[`${index}_addressType`] = false;
        initialTouched[`${index}_addressLine1`] = false;
        initialTouched[`${index}_city`] = false;
        initialTouched[`${index}_state`] = false;
        initialTouched[`${index}_zipCode`] = false;
        initialTouched[`${index}_country`] = false;
      });
      setTouched(initialTouched);
      validateFormSilently(initialData);
    } else {
      validateFormSilently(addresses);
    }
  }, [initialData]);

  const fieldLabels = {
    addressType: t("customer.addresses.addressType"),
    addressLine1: t("customer.addresses.addressLine1"),
  };

  const validateField = (field, value, address) => {
    // Completely blank rows are allowed (addresses tab is optional).
    if (isAddressEmpty(address)) return "";

    if (REQUIRED_FIELDS.includes(field)) {
      // Don't require Address Type when none are configured for this business
      // (empty dropdown would leave validation stuck).
      if (field === "addressType" && addressTypesLoaded && !hasConfiguredAddressTypes) {
        return "";
      }
      if (!value || String(value).trim() === "") {
        return t("customer.validation.fieldRequired", {
          field: fieldLabels[field] || field,
        });
      }
    }

    return "";
  };

  const reportValidation = (isValid) => {
    if (typeof setValidationErrors === "function") {
      setValidationErrors({
        addresses: !isValid,
      });
    }
  };

  // Silent validation (stores errors for required fields on non-empty rows)
  const validateFormSilently = (list = addresses) => {
    const newErrors = {};
    let isValid = true;

    list.forEach((address, index) => {
      REQUIRED_FIELDS.forEach((field) => {
        const error = validateField(field, address[field], address);
        if (error) {
          newErrors[`${index}_${field}`] = error;
          isValid = false;
        }
      });
    });

    setErrors(newErrors);
    reportValidation(isValid);
    return isValid;
  };

  // Validate; show errors for touched fields, and always for required fields on started rows
  const validateForm = (list = addresses, touchedState = touched) => {
    const newErrors = {};
    let isValid = true;

    list.forEach((address, index) => {
      REQUIRED_FIELDS.forEach((field) => {
        const fieldId = `${index}_${field}`;
        const error = validateField(field, address[field], address);

        if (error) {
          isValid = false;
          // Show required-field errors as soon as the row has any data
          if (touchedState[fieldId] || !isAddressEmpty(address)) {
            newErrors[fieldId] = error;
          }
        }
      });
    });

    setErrors(newErrors);
    reportValidation(isValid);
    return isValid;
  };

  const updateParent = (updatedAddresses) => {
    setAddresses(updatedAddresses);
    onChange && onChange(updatedAddresses);
    validateForm(updatedAddresses);
  };

  useEffect(() => {
    validateForm();
  }, [addresses, touched]);

  const handleChange = (index, field, value) => {
    if (
      field === "addressType" &&
      value &&
      addresses.some((address, i) => i !== index && address.addressType === value)
    ) {
      notifyError(t("customer.addresses.duplicateType"));
      return;
    }
    const updatedAddresses = addresses.map((address, i) =>
      i === index ? { ...address, [field]: value } : address
    );

    // Mark field as touched
    setTouched((prev) => ({
      ...prev,
      [`${index}_${field}`]: true,
    }));

    updateParent(updatedAddresses);
  };

  const handleBlur = (index, field) => {
    setTouched((prev) => ({
      ...prev,
      [`${index}_${field}`]: true,
    }));
    validateForm();
  };

  const handleLine1PlaceChanged = (index) => {
    const place = line1AutocompleteRefs.current[index]?.getPlace?.();
    if (!place) return;

    let streetNumber = "";
    let route = "";
    let subpremise = "";
    let neighborhood = "";
    let sublocality = "";

    const next = {
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      country: "",
      zipCode: "",
    };

    const components = place.address_components || [];
    components.forEach((component) => {
      const types = component.types || [];

      if (
        types.includes("locality") ||
        types.includes("postal_town") ||
        types.includes("administrative_area_level_2")
      ) {
        if (!next.city) next.city = component.long_name;
      } else if (types.includes("street_number")) {
        streetNumber = component.long_name;
      } else if (types.includes("route")) {
        route = component.long_name;
      } else if (types.includes("subpremise")) {
        subpremise = component.long_name;
      } else if (types.includes("neighborhood")) {
        neighborhood = component.long_name;
      } else if (
        types.includes("sublocality") ||
        types.includes("sublocality_level_1")
      ) {
        if (!sublocality) sublocality = component.long_name;
      } else if (types.includes("administrative_area_level_1")) {
        next.state = component.long_name;
      } else if (types.includes("country")) {
        next.country = component.long_name;
      } else if (types.includes("postal_code")) {
        next.zipCode = component.long_name;
      }
    });

    const line1 = [streetNumber, route].filter(Boolean).join(" ").trim();
    const line2 = subpremise || neighborhood || sublocality;
    next.addressLine1 =
      line1 || place.formatted_address || place.name || "";
    next.addressLine2 = line2 || addresses[index]?.addressLine2 || "";

    const updatedAddresses = addresses.map((address, i) =>
      i === index ? { ...address, ...next } : address
    );

    setTouched((prev) => ({
      ...prev,
      [`${index}_addressLine1`]: true,
      [`${index}_addressLine2`]: true,
      [`${index}_city`]: true,
      [`${index}_state`]: true,
      [`${index}_country`]: true,
      [`${index}_zipCode`]: true,
    }));

    updateParent(updatedAddresses);
  };

  const addAddress = () => {
    const newAddresses = [...addresses, { ...EMPTY_ADDRESS }];

    // Initialize touched state for new address
    const newIndex = addresses.length;
    setTouched((prev) => ({
      ...prev,
      [`${newIndex}_addressType`]: false,
      [`${newIndex}_addressLine1`]: false,
      [`${newIndex}_city`]: false,
      [`${newIndex}_state`]: false,
      [`${newIndex}_zipCode`]: false,
      [`${newIndex}_country`]: false,
    }));

    updateParent(newAddresses);
  };

  const addressRowIsDeletable = (address) => {
    if (address?._id || address?.id) return true;
    if (addresses.length > 1) return true;
    return Boolean(
      (address?.addressType && String(address.addressType).trim()) ||
        (address?.addressLine1 && address.addressLine1.trim()) ||
        (address?.addressLine2 && address.addressLine2.trim()) ||
        (address?.city && address.city.trim()) ||
        (address?.state && address.state.trim()) ||
        (address?.zipCode && address.zipCode.trim()) ||
        (address?.country && address.country.trim()) ||
        (address?.phone && address.phone.trim())
    );
  };

  const confirmDelete = (index, addressId) => {
    const address = addresses[index];

    if (
      !address.addressType &&
      !address.addressLine1 &&
      !address.addressLine2 &&
      !address.city &&
      !address.state &&
      !address.zipCode &&
      !address.country &&
      !address.phone
    ) {
      removeAddress(index, addressId, false);
    } else {
      setSelectedAddressIndex(index);
      setSelectedAddressId(addressId);
      setIsModalOpen(true);
    }
  };

  const removeAddress = async (index, addressId, showMessage = true) => {
    if (!addressId) {
      const updatedAddresses = addresses.filter((_, i) => i !== index);
      // Ensure at least one empty address row remains
      const finalAddresses =
        updatedAddresses.length === 0
          ? [{ ...EMPTY_ADDRESS }]
          : updatedAddresses;
      updateParent(finalAddresses);
      if (showMessage) {
        notifySuccess(t("customer.addresses.removedSuccess"));
      }
      return;
    }

    if (!customerId) {
      console.error("❌ Error: Customer ID is missing");
      return;
    }

    try {
      await requests.delete(`/customers/${customerId}/addresses/${addressId}`);
      const updatedAddresses = addresses.filter((_, i) => i !== index);
      // Ensure at least one empty address row remains
      const finalAddresses =
        updatedAddresses.length === 0
          ? [{ ...EMPTY_ADDRESS }]
          : updatedAddresses;
      updateParent(finalAddresses);
      if (showMessage) {
        notifySuccess(t("customer.addresses.deletedSuccess"));
      }
    } catch (error) {
      console.error("❌ Failed to delete address", error?.response?.data || error);
    } finally {
      setIsModalOpen(false);
    }
  };

  useEffect(() => {
    const fetchAddressTypes = async () => {
      if (!businessId) {
        setAddressTypesLoaded(true);
        setHasConfiguredAddressTypes(false);
        return;
      }
      try {
        const response = await requests.post("/items/Address Types/get_all", {
          business_id: businessId,
          FilterStatus: "active",
          FilterName: "",
        });
        // requests.post returns axios `data`; API body is usually `{ data: [...] }`
        const rows = Array.isArray(response?.data)
          ? response.data
          : Array.isArray(response)
            ? response
            : [];
        const dynamicOptions = rows
          .map((type) => ({
            value: type.name,
            label: type.name,
          }))
          .filter((opt) => opt.value);
        setHasConfiguredAddressTypes(dynamicOptions.length > 0);
        setAddressTypeOptions([
          { value: "", label: t("customer.addresses.selectAddressType") },
          ...dynamicOptions,
        ]);
      } catch (error) {
        console.error("Failed to fetch address types", error);
        setHasConfiguredAddressTypes(false);
        setAddressTypeOptions([
          { value: "", label: t("customer.addresses.selectAddressType") },
        ]);
      } finally {
        setAddressTypesLoaded(true);
      }
    };
    fetchAddressTypes();
  }, [businessId, t]);

  useEffect(() => {
    // Re-validate once we know whether address types exist
    if (addressTypesLoaded) {
      validateForm(addresses, touched);
    }
  }, [addressTypesLoaded, hasConfiguredAddressTypes]);

  const addressesTable = (
      <table className="w-full min-w-0 table-fixed border-collapse border border-gray-200 text-sm">
        <thead>
          <tr className="text-left">
            <th className="py-2 px-2 bg-gray-100 border-b-2 border-gray-200 font-normal text-gray-800 min-w-0 w-[11%]">
              <span className="block truncate" title={t("customer.addresses.type")}>
                {t("customer.addresses.type")}
                {hasConfiguredAddressTypes ? (
                  <span className="text-red-500">*</span>
                ) : null}
              </span>
            </th>
            <th className="py-2 px-2 bg-gray-100 border-b-2 border-gray-200 font-normal text-gray-800 min-w-0 w-[15%]">
              {t("customer.addresses.line1")}<span className="text-red-500">*</span>
            </th>
            <th className="py-2 px-2 bg-gray-100 border-b-2 border-gray-200 font-normal text-gray-800 min-w-0 w-[12%]">
              {t("customer.addresses.line2")}
            </th>
            <th className="py-2 px-2 bg-gray-100 border-b-2 border-gray-200 font-normal text-gray-800 min-w-0 w-[11%]">
              {t("customer.addresses.city")}
            </th>
            <th className="py-2 px-2 bg-gray-100 border-b-2 border-gray-200 font-normal text-gray-800 min-w-0 w-[11%]">
              {t("customer.addresses.state")}
            </th>
            <th className="py-2 px-2 bg-gray-100 border-b-2 border-gray-200 font-normal text-gray-800 min-w-0 w-[9%]">
              {t("customer.addresses.zip")}
            </th>
            <th className="py-2 px-2 bg-gray-100 border-b-2 border-gray-200 font-normal text-gray-800 min-w-0 w-[12%]">
              {t("customer.addresses.country")}
            </th>
            <th className="py-2 px-2 bg-gray-100 border-b-2 border-gray-200 font-normal text-gray-800 min-w-0 w-[12%]">
              {t("customer.addresses.phone")}
            </th>
            <th className="py-2 px-2 bg-gray-100 border-b-2 border-gray-200 font-normal text-gray-800 w-[7%] min-w-0 text-center">
              <span className="sr-only">{t("common.action")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {addresses.map((address, index) => (
            <tr key={address._id || address.id || `address-${index}`} className="bg-white">
              <td className="py-2 px-2 border-b border-gray-200 align-top min-w-0">
                <select
                  value={address.addressType}
                  onChange={(e) => handleChange(index, "addressType", e.target.value)}
                  onBlur={() => handleBlur(index, "addressType")}
                  className={`${cellInputClass}${
                    errors[`${index}_addressType`] ? " text-red-600" : ""
                  }`}
                  aria-invalid={Boolean(errors[`${index}_addressType`])}
                >
                  {addressTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {errors[`${index}_addressType`] && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors[`${index}_addressType`]}
                  </p>
                )}
              </td>
              <td className="py-2 px-2 border-b border-gray-200 align-top min-w-0">
                {googleMapsApiKey ? (
                  <Autocomplete
                    onLoad={(autocomplete) => {
                      line1AutocompleteRefs.current[index] = autocomplete;
                    }}
                    onPlaceChanged={() => handleLine1PlaceChanged(index)}
                    fields={[
                      "formatted_address",
                      "name",
                      "address_components",
                      "geometry.location",
                    ]}
                  >
                    <input
                      type="text"
                      value={address.addressLine1}
                      onChange={(e) =>
                        handleChange(index, "addressLine1", e.target.value)
                      }
                      onBlur={() => handleBlur(index, "addressLine1")}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.preventDefault();
                      }}
                      placeholder={t("customer.addresses.enterAddress")}
                      className={cellInputClass}
                      aria-invalid={Boolean(errors[`${index}_addressLine1`])}
                      autoComplete="off"
                    />
                  </Autocomplete>
                ) : (
                  <input
                    type="text"
                    value={address.addressLine1}
                    onChange={(e) =>
                      handleChange(index, "addressLine1", e.target.value)
                    }
                    onBlur={() => handleBlur(index, "addressLine1")}
                    placeholder={t("customer.addresses.enterAddress")}
                    className={cellInputClass}
                    aria-invalid={Boolean(errors[`${index}_addressLine1`])}
                    autoComplete="off"
                  />
                )}
                {errors[`${index}_addressLine1`] && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors[`${index}_addressLine1`]}
                  </p>
                )}
              </td>
              <td className="py-2 px-2 border-b border-gray-200 align-top min-w-0">
                <input
                  type="text"
                  value={address.addressLine2}
                  onChange={(e) => handleChange(index, "addressLine2", e.target.value)}
                  onBlur={() => handleBlur(index, "addressLine2")}
                  placeholder={t("customer.addresses.enterAddress")}
                  className={cellInputClass}
                />
              </td>
              <td className="py-2 px-2 border-b border-gray-200 align-top min-w-0">
                <input
                  type="text"
                  value={address.city}
                  onChange={(e) => handleChange(index, "city", e.target.value)}
                  onBlur={() => handleBlur(index, "city")}
                  placeholder={t("customer.addresses.enterCity")}
                  className={cellInputClass}
                />
              </td>
              <td className="py-2 px-2 border-b border-gray-200 align-top min-w-0">
                <input
                  type="text"
                  value={address.state}
                  onChange={(e) => handleChange(index, "state", e.target.value)}
                  onBlur={() => handleBlur(index, "state")}
                  placeholder={t("customer.addresses.enterState")}
                  className={cellInputClass}
                />
              </td>
              <td className="py-2 px-2 border-b border-gray-200 align-top min-w-0">
                <input
                  type="text"
                  value={address.zipCode}
                  onChange={(e) => handleChange(index, "zipCode", e.target.value)}
                  onBlur={() => handleBlur(index, "zipCode")}
                  placeholder={t("customer.addresses.enterZipCode")}
                  className={cellInputClass}
                />
              </td>
              <td className="py-2 px-2 border-b border-gray-200 align-top min-w-0">
                <input
                  type="text"
                  value={address.country}
                  onChange={(e) => handleChange(index, "country", e.target.value)}
                  onBlur={() => handleBlur(index, "country")}
                  placeholder={t("customer.addresses.enterCountry")}
                  className={cellInputClass}
                />
              </td>
              <td className="py-2 px-2 border-b border-gray-200 align-top min-w-0">
                <input
                  type="tel"
                  value={address.phone}
                  onChange={(e) =>
                    handleChange(index, "phone", e.target.value.replace(/[^0-9+\s\-()]/g, ""))
                  }
                  onBlur={() => handleBlur(index, "phone")}
                  placeholder={t("customer.addresses.enterPhone")}
                  className={cellInputClass}
                />
              </td>
              <td className="py-2 px-2 border-b border-gray-200 text-center align-middle min-w-0">
                {addressRowIsDeletable(address) ? (
                  <button
                    type="button"
                    onClick={() => confirmDelete(index, address._id ?? address.id)}
                    className="inline-flex text-red-500 hover:text-red-700"
                    aria-label={t("customer.addresses.removeAddress")}
                  >
                    <FiTrash />
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
          <tr>
            <td colSpan={9} className="py-2 px-2 border-b border-gray-200 text-left">
              <button
                type="button"
                onClick={addAddress}
                className="inline-flex items-center gap-2 text-green-600 hover:text-green-700 text-sm font-medium cursor-pointer bg-transparent border-0 p-0"
              >
                <FiPlus className="shrink-0" />
                <span>{t("customer.addresses.addMore")}</span>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
  );

  return (
    <div className="w-full max-w-full min-w-0 overflow-x-hidden">
      {!businessId && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {t("customer.addresses.selectBusinessFirst")}
        </div>
      )}
      {businessId && addressTypesLoaded && !hasConfiguredAddressTypes && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {t("customer.addresses.typesNotConfigured")}
        </div>
      )}
      {googleMapsApiKey && !mapsAlreadyLoaded ? (
        <LoadScript
          id={GOOGLE_MAPS_SCRIPT_ID}
          googleMapsApiKey={googleMapsApiKey}
          libraries={GOOGLE_MAPS_LIBRARIES}
          loadingElement={
            <div className="py-2 text-sm text-gray-500">Loading maps…</div>
          }
          preventGoogleFontsLoading
        >
          {addressesTable}
        </LoadScript>
      ) : (
        addressesTable
      )}

      <ConfirmationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={() => removeAddress(selectedAddressIndex, selectedAddressId)}
      />
    </div>
  );
};

export default Addresses;
