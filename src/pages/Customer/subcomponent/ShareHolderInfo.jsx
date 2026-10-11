import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { FiPlus, FiTrash } from "react-icons/fi";
import ConfirmationModal from "../reusablecomponents/ConfirmationModal ";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const ShareHolderInfo = ({
  initialData = [],
  onChange,
  customerId,
  setValidationErrors,
}) => {
  const { t } = useTranslation();

  console.log("🔍 Debug: Customer ID received in ShareHolderInfo:", customerId);

  const fieldLabels = {
    name: t("customer.shareholder.name"),
    address: t("customer.shareholder.address"),
    partnershipPercentage: t("customer.shareholder.partnershipPercentage"),
    identificationNumber: t("customer.shareholder.identificationNumber"),
    contact: t("customer.shareholder.contact"),
  };

  const [shareholders, setShareholders] = useState(
    Array.isArray(initialData) && initialData.length > 0
      ? initialData
      : [
          {
            name: "",
            address: "",
            partnershipPercentage: 0,
            identificationNumber: "",
            contact: "",
          },
        ]
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedShareholderIndex, setSelectedShareholderIndex] =
    useState(null);
  const [selectedShareholderId, setSelectedShareholderId] = useState(null);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  useEffect(() => {
    if (Array.isArray(initialData) && initialData.length > 0) {
      setShareholders(initialData);
      // Initialize touched state as false for all fields
      const initialTouched = {};
      initialData.forEach((_, index) => {
        initialTouched[`${index}_name`] = false;
        initialTouched[`${index}_address`] = false;
        initialTouched[`${index}_partnershipPercentage`] = false;
        initialTouched[`${index}_identificationNumber`] = false;
        initialTouched[`${index}_contact`] = false;
      });
      setTouched(initialTouched);
    }
    // Run silent validation initially
    validateFormSilently();
  }, [initialData]);

  // Validate a field without showing errors
  const validateField = (index, field, value) => {
    // Required field check for all fields - handle both string and number types
    if (
      value === undefined ||
      value === null ||
      (typeof value === "string" && value.trim() === "") ||
      (typeof value === "number" && value === 0)
    ) {
      if (field === "contact") {
        return t("customer.shareholder.contactRequired");
      }
      return t("customer.validation.fieldRequired", {
        field: fieldLabels[field] || field,
      });
    }

    // Partnership percentage validation
    if (field === "partnershipPercentage") {
      const percentage = Number(value);
      if (isNaN(percentage) || percentage < 0 || percentage > 100) {
        return t("customer.shared.partnershipPercentageRange");
      }
    }

    // Phone number validation (international format)
    if (field === "contact") {
      // Validate international phone numbers (E.164-ish). Allows leading "+", spaces, dashes, and parentheses.
      // Valid if it contains 7–15 digits total and at most one leading "+".
      if (!value || typeof value !== "string") {
        return t("customer.shareholder.contactRequired");
      }
      const trimmed = value.trim();
      const plusOccurrences = (trimmed.match(/\+/g) || []).length;
      if (plusOccurrences > 1) {
        return t("customer.validation.invalidPhone");
      }
      if (plusOccurrences === 1 && trimmed[0] !== "+") {
        return t("customer.validation.invalidPhone");
      }
      const digitsOnly = trimmed.replace(/\D/g, "");
      if (digitsOnly.length < 7 || digitsOnly.length > 15) {
        return t("customer.validation.invalidPhone");
      }
    }

    return "";
  };

  // Silent validation (doesn't show errors to user)
  const validateFormSilently = () => {
    const newErrors = {};
    let isValid = true;

    shareholders.forEach((shareholder, index) => {
      [
        "name",
        "address",
        "partnershipPercentage",
        "identificationNumber",
        "contact",
      ].forEach((field) => {
        const error = validateField(index, field, shareholder[field]);
        if (error) {
          newErrors[`${index}_${field}`] = error;
          isValid = false;
        }
      });
    });

    setErrors(newErrors);

    // Update parent validation state without showing errors
    if (typeof setValidationErrors === "function") {
      setValidationErrors((prevErrors) => ({
        ...prevErrors,
        shareHolders: !isValid,
      }));
    }

    return isValid;
  };

  // Validate only touched fields
  const validateForm = () => {
    const newErrors = {};
    let isValid = true;

    // Check all fields for form validity
    shareholders.forEach((shareholder, index) => {
      [
        "name",
        "address",
        "partnershipPercentage",
        "identificationNumber",
        "contact",
      ].forEach((field) => {
        const fieldId = `${index}_${field}`;
        const error = validateField(index, field, shareholder[field]);

        // Add error to display only if field was touched
        if (touched[fieldId] && error) {
          newErrors[fieldId] = error;
        }

        // Track overall validity regardless of touched state
        if (error) {
          isValid = false;
        }
      });
    });

    setErrors(newErrors);

    // Update parent validation state exactly as in KeyContact
    if (typeof setValidationErrors === "function") {
      setValidationErrors({
        shareHolders: !isValid,
      });
    }

    return isValid;
  };

  const updateParent = (updatedShareholders) => {
    setShareholders(updatedShareholders);
    if (onChange) {
      console.log(
        "🔄 Updating ShareHolders in Parent Component:",
        updatedShareholders
      );
      onChange(updatedShareholders);
    }
    validateForm();
  };

  useEffect(() => {
    validateForm();
  }, [shareholders, touched]);

  const handleChange = (index, field, value) => {
    const updatedShareholders = shareholders.map((shareholder, i) =>
      i === index
        ? {
            ...shareholder,
            [field]: field === "partnershipPercentage" ? Number(value) : value,
          }
        : shareholder
    );

    // Mark field as touched
    setTouched((prev) => ({
      ...prev,
      [`${index}_${field}`]: true,
    }));

    updateParent(updatedShareholders);
  };

  const handleBlur = (index, field) => {
    setTouched((prev) => ({
      ...prev,
      [`${index}_${field}`]: true,
    }));
    validateForm();
  };

  const addShareholder = () => {
    const newShareholder = {
      name: "",
      address: "",
      partnershipPercentage: 0,
      identificationNumber: "",
      contact: "",
    };
    const newShareholders = [...shareholders, newShareholder];

    // Initialize touched state for new shareholder
    const newIndex = shareholders.length;
    setTouched((prev) => ({
      ...prev,
      [`${newIndex}_name`]: false,
      [`${newIndex}_address`]: false,
      [`${newIndex}_partnershipPercentage`]: false,
      [`${newIndex}_identificationNumber`]: false,
      [`${newIndex}_contact`]: false,
    }));

    updateParent(newShareholders);
  };

  const confirmDelete = (index, shareholderId) => {
    const shareholder = shareholders[index];

    if (
      !shareholder.name &&
      !shareholder.address &&
      !shareholder.partnershipPercentage &&
      !shareholder.identificationNumber &&
      !shareholder.contact
    ) {
      removeShareholder(index, shareholderId, false);
    } else {
      setSelectedShareholderIndex(index);
      setSelectedShareholderId(shareholderId);
      setIsModalOpen(true);
    }
  };

  const removeShareholder = async (
    index,
    shareholderId,
    showMessage = true
  ) => {
    if (!customerId) {
      console.error("❌ Error: Customer ID is missing");
      return;
    }

    if (!shareholderId) {
      const updatedShareholders = shareholders.filter((_, i) => i !== index);
      updateParent(updatedShareholders);
      return;
    }

    try {
      const response = await fetch(
        `${Base_URL}/customers/${customerId}/shareholderInfo/${shareholderId}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (response.ok) {
        console.log("✅ Shareholder deleted successfully");
        const updatedShareholders = shareholders.filter((_, i) => i !== index);
        updateParent(updatedShareholders);
      } else {
        console.error("❌ Failed to delete shareholder", await response.json());
      }
    } catch (error) {
      console.error("❌ Error in delete request:", error);
    } finally {
      setIsModalOpen(false);
    }
  };

  return (
    <div>
      <table className="w-full border-collapse border border-gray-200">
        <thead>
          <tr className="bg-gray-100 text-left">
            <th className="py-2 px-4 border border-gray-200 font-normal">
              {t("customer.shareholder.name")}*
            </th>
            <th className="py-2 px-4 border border-gray-200 font-normal">
              {t("customer.shareholder.address")}*
            </th>
            <th className="py-2 px-4 border border-gray-200 font-normal">
              {t("customer.shareholder.partnershipPercentage")}*
            </th>
            <th className="py-2 px-4 border border-gray-200 font-normal">
              {t("customer.shareholder.identificationNumber")}*
            </th>
            <th className="py-2 px-4 border border-gray-200 font-normal">
              {t("customer.shareholder.contact")}*
            </th>
            <th className="py-2 px-4 border border-gray-200 font-normal">
              {t("common.action")}
            </th>
          </tr>
        </thead>
        <tbody>
          {shareholders.map((shareholder, index) => (
            <tr key={shareholder._id || index} className="border-t">
              <td className="py-2 px-4 border border-gray-200">
                <input
                  type="text"
                  value={shareholder.name}
                  onChange={(e) => handleChange(index, "name", e.target.value)}
                  onBlur={() => handleBlur(index, "name")}
                  placeholder={t("customer.contacts.enterName")}
                  className={`w-full border-gray-300 rounded p-2 ${
                    errors[`${index}_name`] && touched[`${index}_name`]
                      ? "border-red-500"
                      : ""
                  }`}
                />
                {errors[`${index}_name`] && touched[`${index}_name`] && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors[`${index}_name`]}
                  </p>
                )}
              </td>
              <td className="py-2 px-4 border border-gray-200">
                <input
                  type="text"
                  value={shareholder.address}
                  onChange={(e) =>
                    handleChange(index, "address", e.target.value)
                  }
                  onBlur={() => handleBlur(index, "address")}
                  placeholder={t("customer.addresses.enterAddress")}
                  className={`w-full border-gray-300 rounded p-2 ${
                    errors[`${index}_address`] && touched[`${index}_address`]
                      ? "border-red-500"
                      : ""
                  }`}
                />
                {errors[`${index}_address`] && touched[`${index}_address`] && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors[`${index}_address`]}
                  </p>
                )}
              </td>
              <td className="py-2 px-4 border border-gray-200">
                <input
                  type="number"
                  value={shareholder.partnershipPercentage}
                  onChange={(e) =>
                    handleChange(index, "partnershipPercentage", e.target.value)
                  }
                  onBlur={() => handleBlur(index, "partnershipPercentage")}
                  placeholder={t("customer.shareholder.enterPartnershipPercentage")}
                  className={`w-full border-gray-300 rounded p-2 ${
                    errors[`${index}_partnershipPercentage`] &&
                    touched[`${index}_partnershipPercentage`]
                      ? "border-red-500"
                      : ""
                  }`}
                />
                {errors[`${index}_partnershipPercentage`] &&
                  touched[`${index}_partnershipPercentage`] && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors[`${index}_partnershipPercentage`]}
                    </p>
                  )}
              </td>
              <td className="py-2 px-4 border border-gray-200">
                <input
                  type="text"
                  value={shareholder.identificationNumber}
                  onChange={(e) =>
                    handleChange(index, "identificationNumber", e.target.value)
                  }
                  onBlur={() => handleBlur(index, "identificationNumber")}
                  placeholder={t("customer.shareholder.enterIdentificationNumber")}
                  className={`w-full border-gray-300 rounded p-2 ${
                    errors[`${index}_identificationNumber`] &&
                    touched[`${index}_identificationNumber`]
                      ? "border-red-500"
                      : ""
                  }`}
                />
                {errors[`${index}_identificationNumber`] &&
                  touched[`${index}_identificationNumber`] && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors[`${index}_identificationNumber`]}
                    </p>
                  )}
              </td>
              <td className="py-2 px-4 border border-gray-200">
                <input
                  type="tel"
                  value={shareholder.contact}
                  onChange={(e) => {
                    // Allow numbers, +, spaces, dashes, and parentheses
                    const phoneValue = e.target.value.replace(/[^0-9+\s\-()]/g, "");
                    handleChange(index, "contact", phoneValue);
                  }}
                  onBlur={() => handleBlur(index, "contact")}
                  placeholder={t("customer.shareholder.enterContact")}
                  className={`w-full border-gray-300 rounded p-2 ${
                    errors[`${index}_contact`] && touched[`${index}_contact`]
                      ? "border-red-500"
                      : ""
                  }`}
                />
                {errors[`${index}_contact`] && touched[`${index}_contact`] && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors[`${index}_contact`]}
                  </p>
                )}
              </td>
              <td className="py-2 px-4 border border-gray-200 text-center">
                <button
                  onClick={() => confirmDelete(index, shareholder._id)}
                  className="text-red-500 hover:text-red-700"
                >
                  <FiTrash />
                </button>
              </td>
            </tr>
          ))}
          <tr>
            <td
              colSpan="6"
              className="py-2 px-4 text-green-500 hover:text-green-700 cursor-pointer text-left"
              onClick={addShareholder}
            >
              <div className="flex items-center space-x-2">
                <FiPlus />
                <span>{t("customer.shared.addMore")}</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <ConfirmationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={() =>
          removeShareholder(selectedShareholderIndex, selectedShareholderId)
        }
        message={t("customer.shared.removeShareholderConfirm")}
      />
    </div>
  );
};

export default ShareHolderInfo;
