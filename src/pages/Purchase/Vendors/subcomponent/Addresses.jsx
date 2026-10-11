import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { FiPlus, FiTrash } from "react-icons/fi";
import { LoadScript, Autocomplete } from "@react-google-maps/api";
import ConfirmationModal from "../reusablecomponents/ConfirmationModal ";
import { notifySuccess } from "@/utils/toast";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
const cellInputClass =
  "w-full min-w-0 max-w-full border-0 rounded-none p-2 bg-transparent text-gray-900 placeholder:text-gray-400 shadow-none outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:bg-gray-50 break-words";

const Addresses = ({
  initialData = [],
  onChange,
  customerId,
  setValidationErrors,
}) => {
  const { t } = useTranslation();
  const [addresses, setAddresses] = useState(
    Array.isArray(initialData) && initialData.length > 0
      ? initialData
      : [
          {
            addressType: "",
            googleLocation: "",
            lat: null,
            lng: null,
            addressLine1: "",
            addressLine2: "",
            city: "",
            state: "",
            zipCode: "",
            country: "",
            phone: "",
          },
        ]
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAddressIndex, setSelectedAddressIndex] = useState(null);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState("");
  const locationAutocompleteRefs = useRef({});
  /** Avoid resetting local rows when `initialData` is the echo of our own `onChange` (fixes focus/render glitches on Edit Vendor). */
  const suppressInitialDataSyncRef = useRef(false);

  useEffect(() => {
    if (suppressInitialDataSyncRef.current) {
      suppressInitialDataSyncRef.current = false;
      return;
    }
    if (Array.isArray(initialData) && initialData.length > 0) {
      setAddresses(
        initialData.map((address) => {
          const parsedLat = Number(address?.lat);
          const parsedLng = Number(address?.lng);
          return {
            ...address,
            lat:
              address?.lat === undefined ||
              address?.lat === null ||
              address?.lat === "" ||
              !Number.isFinite(parsedLat)
                ? null
                : parsedLat,
            lng:
              address?.lng === undefined ||
              address?.lng === null ||
              address?.lng === "" ||
              !Number.isFinite(parsedLng)
                ? null
                : parsedLng,
          };
        })
      );
      const initialTouched = {};
      initialData.forEach((_, index) => {
        initialTouched[`${index}_addressType`] = false;
        initialTouched[`${index}_googleLocation`] = false;
        initialTouched[`${index}_addressLine1`] = false;
        initialTouched[`${index}_city`] = false;
        initialTouched[`${index}_state`] = false;
        initialTouched[`${index}_zipCode`] = false;
        initialTouched[`${index}_country`] = false;
      });
      setTouched(initialTouched);
    }
    validateFormSilently();
  }, [initialData]);

  useEffect(() => {
    const fetchGoogleApiKey = async () => {
      try {
        const response = await fetch(`${Base_URL}/configuration`);
        if (!response.ok) {
          setGoogleMapsApiKey("");
          return;
        }

        const configurations = await response.json();
        const config =
          Array.isArray(configurations) && configurations.length > 0
            ? configurations[0]
            : null;

        setGoogleMapsApiKey(config?.google_api_key || "");
      } catch (error) {
        console.error("Failed to load Google API key from configuration:", error);
        setGoogleMapsApiKey("");
      }
    };

    fetchGoogleApiKey();
  }, []);

  const hasValidAddress = () => {
    if (!addresses || addresses.length === 0) {
      return true;
    }

    return addresses.some((address) => {
      return address.addressLine1 && address.addressLine1.trim() !== "";
    });
  };

  const validateFormSilently = () => {
    const newErrors = {};
    let isValid = true;

    isValid = true;

    setErrors(newErrors);

    setValidationErrors({
      addresses: !isValid,
    });

    return isValid;
  };

  const validateForm = () => {
    const newErrors = {};
    let isValid = true;

    isValid = true;

    setErrors(newErrors);

    setValidationErrors({
      addresses: !isValid,
    });

    return isValid;
  };

  const updateParent = (updatedAddresses) => {
    suppressInitialDataSyncRef.current = true;
    setAddresses(updatedAddresses);
    onChange && onChange(updatedAddresses);
    validateForm();
  };

  useEffect(() => {
    validateForm();
  }, [addresses, touched]);

  const handleChange = (index, field, value) => {
    const updatedAddresses = addresses.map((address, i) => {
      if (i !== index) return address;
      const next = { ...address, [field]: value };
      if (field === "googleLocation") {
        next.lat = null;
        next.lng = null;
      }
      return next;
    });

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

  const handleGoogleLocationPlaceChanged = (index) => {
    const place = locationAutocompleteRefs.current[index]?.getPlace?.();
    if (!place) return;

    let streetNumber = "";
    let route = "";
    let subpremise = "";
    let neighborhood = "";
    let sublocality = "";

    const next = {
      googleLocation: place.formatted_address || "",
      lat:
        typeof place.geometry?.location?.lat === "function"
          ? place.geometry.location.lat()
          : null,
      lng:
        typeof place.geometry?.location?.lng === "function"
          ? place.geometry.location.lng()
          : null,
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
      } else if (types.includes("sublocality") || types.includes("sublocality_level_1")) {
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
    next.addressLine1 = line1 || next.googleLocation;
    next.addressLine2 = line2 || "";

    const updatedAddresses = addresses.map((address, i) =>
      i === index ? { ...address, ...next } : address
    );

    setTouched((prev) => ({
      ...prev,
      [`${index}_googleLocation`]: true,
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
    const newAddress = {
      addressType: "",
      googleLocation: "",
      lat: null,
      lng: null,
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      zipCode: "",
      country: "",
      phone: "",
    };
    const newAddresses = [...addresses, newAddress];

    const newIndex = addresses.length;
    setTouched((prev) => ({
      ...prev,
      [`${newIndex}_addressType`]: false,
      [`${newIndex}_googleLocation`]: false,
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
      (address?.addressType && address.addressType.trim()) ||
        (address?.googleLocation && address.googleLocation.trim()) ||
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
      !address.googleLocation &&
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

  const emptyRow = () => ({
    addressType: "",
    googleLocation: "",
    lat: null,
    lng: null,
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    zipCode: "",
    country: "",
    phone: "",
  });

  const removeAddress = async (index, addressId, showMessage = true) => {
    if (!customerId) {
      console.error("❌ Error: Vendor ID is missing");
      setIsModalOpen(false);
      setSelectedAddressIndex(null);
      setSelectedAddressId(null);
      return;
    }

    if (!addressId) {
      const updatedAddresses = addresses.filter((_, i) => i !== index);
      const finalAddresses =
        updatedAddresses.length === 0 ? [emptyRow()] : updatedAddresses;
      updateParent(finalAddresses);
      setIsModalOpen(false);
      setSelectedAddressIndex(null);
      setSelectedAddressId(null);
      if (showMessage) {
        notifySuccess(t("vendor.addresses.removedSuccess"));
      }
      return;
    }

    try {
      const response = await fetch(
        `${Base_URL}/vendors/${customerId}/addresses/${addressId}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (response.ok) {
        const updatedAddresses = addresses.filter((_, i) => i !== index);
        const finalAddresses =
          updatedAddresses.length === 0 ? [emptyRow()] : updatedAddresses;
        updateParent(finalAddresses);
        if (showMessage) {
          notifySuccess(t("vendor.addresses.deletedSuccess"));
        }
      } else {
        console.error("❌ Failed to delete address", await response.json());
      }
    } catch (error) {
      console.error("❌ Error in delete request:", error);
    } finally {
      setIsModalOpen(false);
      setSelectedAddressIndex(null);
      setSelectedAddressId(null);
    }
  };

  const addressTypeOptions = [
    { value: "", label: t("vendor.addresses.selectAddressType") },
    { value: "Billing", label: t("common.billing") },
    { value: "Shipping", label: t("common.shipping") },
    { value: "Registered", label: t("vendor.addresses.registered", { defaultValue: "Registered" }) },
    { value: "Mailing", label: t("vendor.addresses.mailing", { defaultValue: "Mailing" }) },
    { value: "Other", label: t("vendor.addresses.other", { defaultValue: "Other" }) },
  ];

  const addressesTable = (
        <table className="w-full min-w-0 table-fixed border-collapse border border-gray-200 text-sm">
          <thead>
            <tr className="text-left">
              {[
                { label: t("vendor.addresses.type"), w: "w-[8%]" },
                { label: t("vendor.addresses.googleLocation"), w: "w-[14%]" },
                { label: t("vendor.addresses.line1"), w: "w-[14%]" },
                { label: t("vendor.addresses.line2"), w: "w-[10%]" },
                { label: t("vendor.addresses.city"), w: "w-[9%]" },
                { label: t("vendor.addresses.state"), w: "w-[9%]" },
                { label: t("vendor.addresses.zip"), w: "w-[8%]" },
                { label: t("vendor.addresses.country"), w: "w-[10%]" },
                { label: t("vendor.addresses.phone"), w: "w-[10%]" },
                { label: "", w: "w-[8%]" },
              ].map((col) => (
                <th
                  key={col.label || "action"}
                  className={`py-2 px-2 bg-gray-100 border-b-2 border-gray-200 font-normal text-gray-800 min-w-0 ${col.w}`}
                >
                  {col.label === "" ? (
                    <span className="sr-only">Action</span>
                  ) : (
                    <span className="block truncate" title={col.label}>
                      {col.label}
                    </span>
                  )}
                </th>
              ))}
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
                    className={cellInputClass}
                  >
                    {addressTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2 px-2 border-b border-gray-200 align-top min-w-0">
                  {googleMapsApiKey ? (
                    <Autocomplete
                      onLoad={(autocomplete) => {
                        locationAutocompleteRefs.current[index] = autocomplete;
                      }}
                      onPlaceChanged={() => handleGoogleLocationPlaceChanged(index)}
                    >
                      <input
                        type="text"
                        value={address.googleLocation || ""}
                        onChange={(e) =>
                          handleChange(index, "googleLocation", e.target.value)
                        }
                        onBlur={() => handleBlur(index, "googleLocation")}
                        placeholder={t("vendor.addresses.searchLocation")}
                        className={cellInputClass}
                      />
                    </Autocomplete>
                  ) : (
                    <input
                      type="text"
                      value={address.googleLocation || ""}
                      onChange={(e) =>
                        handleChange(index, "googleLocation", e.target.value)
                      }
                      onBlur={() => handleBlur(index, "googleLocation")}
                      placeholder={t("vendor.addresses.locationPlaceholder")}
                      className={cellInputClass}
                    />
                  )}
                </td>
                <td className="py-2 px-2 border-b border-gray-200 align-top min-w-0">
                  <input
                    type="text"
                    value={address.addressLine1}
                    onChange={(e) => handleChange(index, "addressLine1", e.target.value)}
                    onBlur={() => handleBlur(index, "addressLine1")}
                    placeholder={t("vendor.addresses.enterAddress")}
                    className={cellInputClass}
                  />
                </td>
                <td className="py-2 px-2 border-b border-gray-200 align-top min-w-0">
                  <input
                    type="text"
                    value={address.addressLine2}
                    onChange={(e) => handleChange(index, "addressLine2", e.target.value)}
                    onBlur={() => handleBlur(index, "addressLine2")}
                    placeholder={t("vendor.addresses.enterAddress")}
                    className={cellInputClass}
                  />
                </td>
                <td className="py-2 px-2 border-b border-gray-200 align-top min-w-0">
                  <input
                    type="text"
                    value={address.city}
                    onChange={(e) => handleChange(index, "city", e.target.value)}
                    onBlur={() => handleBlur(index, "city")}
                    placeholder={t("vendor.addresses.enterCity")}
                    className={cellInputClass}
                  />
                </td>
                <td className="py-2 px-2 border-b border-gray-200 align-top min-w-0">
                  <input
                    type="text"
                    value={address.state}
                    onChange={(e) => handleChange(index, "state", e.target.value)}
                    onBlur={() => handleBlur(index, "state")}
                    placeholder={t("vendor.addresses.enterState")}
                    className={cellInputClass}
                  />
                </td>
                <td className="py-2 px-2 border-b border-gray-200 align-top min-w-0">
                  <input
                    type="text"
                    value={address.zipCode}
                    onChange={(e) => handleChange(index, "zipCode", e.target.value)}
                    onBlur={() => handleBlur(index, "zipCode")}
                    placeholder={t("vendor.addresses.enterZipCode")}
                    className={cellInputClass}
                  />
                </td>
                <td className="py-2 px-2 border-b border-gray-200 align-top min-w-0">
                  <input
                    type="text"
                    value={address.country}
                    onChange={(e) => handleChange(index, "country", e.target.value)}
                    onBlur={() => handleBlur(index, "country")}
                    placeholder={t("vendor.addresses.enterCountry")}
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
                    placeholder={t("vendor.addresses.enterPhone")}
                    className={cellInputClass}
                  />
                </td>
                <td className="py-2 px-2 border-b border-gray-200 text-center align-middle min-w-0">
                  {addressRowIsDeletable(address) ? (
                    <button
                      type="button"
                      onClick={() => confirmDelete(index, address._id ?? address.id)}
                      className="inline-flex text-red-500 hover:text-red-700"
                      aria-label={t("vendor.addresses.removeAddress")}
                    >
                      <FiTrash />
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={10} className="py-2 px-2 border-b border-gray-200 text-left">
                <button
                  type="button"
                  onClick={addAddress}
                  className="inline-flex items-center gap-2 text-green-600 hover:text-green-700 text-sm font-medium cursor-pointer bg-transparent border-0 p-0"
                >
                  <FiPlus className="shrink-0" />
                  <span>{t("vendor.addresses.addMore")}</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
  );

  return (
    <div className="w-full max-w-full min-w-0 overflow-x-auto overflow-y-visible">
      {googleMapsApiKey ? (
        <LoadScript
          googleMapsApiKey={googleMapsApiKey}
          libraries={["places"]}
          loadingElement={<div className="py-2 text-sm text-gray-500">Loading maps…</div>}
          preventGoogleFontsLoading
        >
          {addressesTable}
        </LoadScript>
      ) : (
        addressesTable
      )}

      <ConfirmationModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedAddressIndex(null);
          setSelectedAddressId(null);
        }}
        onConfirm={() => removeAddress(selectedAddressIndex, selectedAddressId)}
        message={t("vendor.addresses.confirmDeleteAddress")}
      />
    </div>
  );
};

export default Addresses;
