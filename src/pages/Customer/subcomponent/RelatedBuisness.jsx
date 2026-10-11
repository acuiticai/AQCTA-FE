import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { FiPlus, FiTrash } from "react-icons/fi";
import ConfirmationModal from "../reusablecomponents/ConfirmationModal ";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const RelatedBusinesses = ({
  initialData = [],
  onChange,
  customerId,
  setValidationErrors,
}) => {
  const { t } = useTranslation();

  console.log(
    "🔍 Debug: Customer ID received in RelatedBusinesses:",
    customerId
  );

  const fieldLabels = {
    name: t("customer.relatedBusiness.name"),
    natureOfBusiness: t("customer.relatedBusiness.natureOfBusiness"),
    address: t("customer.relatedBusiness.address"),
    paidUpCapital: t("customer.relatedBusiness.paidUpCapital"),
  };

  const [businesses, setBusinesses] = useState(
    Array.isArray(initialData) && initialData.length > 0
      ? initialData
      : [{ name: "", natureOfBusiness: "", address: "", paidUpCapital: "" }]
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBusinessIndex, setSelectedBusinessIndex] = useState(null);
  const [selectedBusinessId, setSelectedBusinessId] = useState(null);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  useEffect(() => {
    if (Array.isArray(initialData) && initialData.length > 0) {
      setBusinesses(initialData);
      // Initialize touched state as false for all fields
      const initialTouched = {};
      initialData.forEach((_, index) => {
        initialTouched[`${index}_name`] = false;
        initialTouched[`${index}_natureOfBusiness`] = false;
        initialTouched[`${index}_address`] = false;
        initialTouched[`${index}_paidUpCapital`] = false;
      });
      setTouched(initialTouched);
    }
    // Run silent validation initially
    validateFormSilently();
  }, [initialData]);

  // Validate a field without showing errors
  const validateField = (index, field, value) => {
    // Required field check
    if (!value || (typeof value === "string" && value.trim() === "")) {
      return t("customer.validation.fieldRequired", {
        field: fieldLabels[field] || field,
      });
    }

    // Paid up capital validation - must be a positive number
    if (field === "paidUpCapital") {
      const capital = Number(value);
      if (isNaN(capital) || capital <= 0) {
        return t("customer.shared.paidUpCapitalPositive");
      }
    }

    return "";
  };

  // Silent validation (doesn't show errors to user)
  const validateFormSilently = () => {
    const newErrors = {};
    let isValid = true;

    businesses.forEach((business, index) => {
      ["name", "natureOfBusiness", "address", "paidUpCapital"].forEach(
        (field) => {
          const error = validateField(index, field, business[field]);
          if (error) {
            newErrors[`${index}_${field}`] = error;
            isValid = false;
          }
        }
      );
    });

    setErrors(newErrors);

    // Update parent validation state without showing errors
    setValidationErrors({
      relatedBusinesses: !isValid,
    });

    return isValid;
  };

  // Validate only touched fields
  const validateForm = () => {
    const newErrors = {};
    let isValid = true;

    // Check all fields for form validity
    businesses.forEach((business, index) => {
      ["name", "natureOfBusiness", "address", "paidUpCapital"].forEach(
        (field) => {
          const fieldId = `${index}_${field}`;
          const error = validateField(index, field, business[field]);

          // Add error to display only if field was touched
          if (touched[fieldId] && error) {
            newErrors[fieldId] = error;
          }

          // Track overall validity regardless of touched state
          if (error) {
            isValid = false;
          }
        }
      );
    });

    setErrors(newErrors);

    // Update parent validation state
    setValidationErrors({
      relatedBusinesses: !isValid,
    });

    return isValid;
  };

  const updateParent = (updatedBusinesses) => {
    setBusinesses(updatedBusinesses);
    if (onChange) {
      console.log(
        "🔄 Updating Related Businesses in Parent Component:",
        updatedBusinesses
      );
      onChange(updatedBusinesses);
    }
    validateForm();
  };

  useEffect(() => {
    validateForm();
  }, [businesses, touched]);

  const handleChange = (index, field, value) => {
    const updatedBusinesses = businesses.map((business, i) =>
      i === index ? { ...business, [field]: value } : business
    );

    // Mark field as touched
    setTouched((prev) => ({
      ...prev,
      [`${index}_${field}`]: true,
    }));

    updateParent(updatedBusinesses);
  };

  const handleBlur = (index, field) => {
    setTouched((prev) => ({
      ...prev,
      [`${index}_${field}`]: true,
    }));
    validateForm();
  };

  const addBusiness = () => {
    const newBusiness = {
      name: "",
      natureOfBusiness: "",
      address: "",
      paidUpCapital: "",
    };
    const updatedBusinesses = [...businesses, newBusiness];

    // Initialize touched state for new business
    const newIndex = businesses.length;
    setTouched((prev) => ({
      ...prev,
      [`${newIndex}_name`]: false,
      [`${newIndex}_natureOfBusiness`]: false,
      [`${newIndex}_address`]: false,
      [`${newIndex}_paidUpCapital`]: false,
    }));

    updateParent(updatedBusinesses);
  };

  const confirmDelete = (index, businessId) => {
    const business = businesses[index];

    if (
      !business.name &&
      !business.natureOfBusiness &&
      !business.address &&
      !business.paidUpCapital
    ) {
      removeBusiness(index, businessId, false);
    } else {
      setSelectedBusinessIndex(index);
      setSelectedBusinessId(businessId);
      setIsModalOpen(true);
    }
  };

  const removeBusiness = async (index, businessId, showMessage = true) => {
    if (!customerId) {
      console.error("❌ Error: Customer ID is missing");
      return;
    }

    if (!businessId) {
      const updatedBusinesses = businesses.filter((_, i) => i !== index);
      updateParent(updatedBusinesses);
      return;
    }

    try {
      const response = await fetch(
        `${Base_URL}/customers/${customerId}/relatedBusinesses/${businessId}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (response.ok) {
        console.log("✅ Related Business deleted successfully");
        const updatedBusinesses = businesses.filter((_, i) => i !== index);
        updateParent(updatedBusinesses);
      } else {
        console.error("❌ Failed to delete business", await response.json());
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
              {t("customer.relatedBusiness.name")}*
            </th>
            <th className="py-2 px-4 border border-gray-200 font-normal">
              {t("customer.relatedBusiness.natureOfBusiness")}*
            </th>
            <th className="py-2 px-4 border border-gray-200 font-normal">
              {t("customer.relatedBusiness.address")}*
            </th>
            <th className="py-2 px-4 border border-gray-200 font-normal">
              {t("customer.relatedBusiness.paidUpCapital")}*
            </th>
            <th className="py-2 px-4 border border-gray-200 font-normal">
              {t("common.action")}
            </th>
          </tr>
        </thead>
        <tbody>
          {businesses.map((business, index) => (
            <tr key={business._id || index} className="border-t">
              <td className="py-2 px-4 border border-gray-200">
                <input
                  type="text"
                  value={business.name}
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
                  value={business.natureOfBusiness}
                  onChange={(e) =>
                    handleChange(index, "natureOfBusiness", e.target.value)
                  }
                  onBlur={() => handleBlur(index, "natureOfBusiness")}
                  placeholder={t("customer.relatedBusiness.enterNatureOfBusiness")}
                  className={`w-full border-gray-300 rounded p-2 ${
                    errors[`${index}_natureOfBusiness`] &&
                    touched[`${index}_natureOfBusiness`]
                      ? "border-red-500"
                      : ""
                  }`}
                />
                {errors[`${index}_natureOfBusiness`] &&
                  touched[`${index}_natureOfBusiness`] && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors[`${index}_natureOfBusiness`]}
                    </p>
                  )}
              </td>
              <td className="py-2 px-4 border border-gray-200">
                <input
                  type="text"
                  value={business.address}
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
                  value={business.paidUpCapital}
                  onChange={(e) =>
                    handleChange(index, "paidUpCapital", e.target.value)
                  }
                  onBlur={() => handleBlur(index, "paidUpCapital")}
                  placeholder={t("customer.relatedBusiness.enterPaidUpCapital")}
                  className={`w-full border-gray-300 rounded p-2 ${
                    errors[`${index}_paidUpCapital`] &&
                    touched[`${index}_paidUpCapital`]
                      ? "border-red-500"
                      : ""
                  }`}
                />
                {errors[`${index}_paidUpCapital`] &&
                  touched[`${index}_paidUpCapital`] && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors[`${index}_paidUpCapital`]}
                    </p>
                  )}
              </td>
              <td className="py-2 px-4 border border-gray-200 text-center">
                <button
                  onClick={() => confirmDelete(index, business._id)}
                  className="text-red-500 hover:text-red-700"
                >
                  <FiTrash />
                </button>
              </td>
            </tr>
          ))}
          <tr>
            <td
              colSpan="5"
              className="py-2 px-4 text-green-500 hover:text-green-700 cursor-pointer text-left"
              onClick={addBusiness}
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
          removeBusiness(selectedBusinessIndex, selectedBusinessId)
        }
        message={t("customer.shared.removeRelatedBusinessConfirm")}
      />
    </div>
  );
};

export default RelatedBusinesses;
