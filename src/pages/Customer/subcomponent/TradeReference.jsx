import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { FiPlus, FiTrash } from "react-icons/fi";
import ConfirmationModal from "../reusablecomponents/ConfirmationModal ";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const TraderReference = ({
  initialData = [],
  onChange,
  customerId,
  setValidationErrors,
}) => {
  const { t } = useTranslation();

  console.log(
    "🔍 Debug: Customer ID received in TraderReference:!!",
    customerId
  );

  const fieldLabels = {
    company: t("customer.tradeReference.company"),
    address: t("customer.tradeReference.address"),
    personToContact: t("customer.tradeReference.personToContact"),
    typeOfCommodity: t("customer.tradeReference.typeOfCommodity"),
  };

  const [references, setReferences] = useState(
    Array.isArray(initialData) && initialData.length > 0
      ? initialData.map((ref) => ({ ...ref, _id: ref._id || undefined }))
      : [{ company: "", address: "", personToContact: "", typeOfCommodity: "" }]
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedReferenceIndex, setSelectedReferenceIndex] = useState(null);
  const [selectedReferenceId, setSelectedReferenceId] = useState(null);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  useEffect(() => {
    if (Array.isArray(initialData) && initialData.length > 0) {
      setReferences(
        initialData.map((ref) => ({ ...ref, _id: ref._id || undefined }))
      );
      // Initialize touched state as false for all fields
      const initialTouched = {};
      initialData.forEach((_, index) => {
        initialTouched[`${index}_company`] = false;
        initialTouched[`${index}_address`] = false;
        initialTouched[`${index}_personToContact`] = false;
        initialTouched[`${index}_typeOfCommodity`] = false;
      });
      setTouched(initialTouched);
    }
    // Run silent validation initially
    validateFormSilently();
  }, [initialData]);

  // Validate a field without showing errors
  const validateField = (index, field, value) => {
    // Required field check
    if (!value || value.trim() === "") {
      return t("customer.validation.fieldRequired", {
        field: fieldLabels[field] || field,
      });
    }

    return "";
  };

  const validateFormSilently = () => {
    const newErrors = {};
    let isValid = true;

    references.forEach((reference, index) => {
      ["company", "address", "personToContact", "typeOfCommodity"].forEach(
        (field) => {
          const error = validateField(index, field, reference[field]);
          if (error) {
            newErrors[`${index}_${field}`] = error;
            isValid = false;
          }
        }
      );
    });

    setErrors(newErrors);

    // Update parent validation state without showing errors
    if (setValidationErrors) {
      setValidationErrors({
        tradeReferences: !isValid,
      });
    }

    return isValid;
  };

  // Validate only touched fields
  const validateForm = () => {
    const newErrors = {};
    let isValid = true;

    // Check all fields for form validity
    references.forEach((reference, index) => {
      ["company", "address", "personToContact", "typeOfCommodity"].forEach(
        (field) => {
          const fieldId = `${index}_${field}`;
          const error = validateField(index, field, reference[field]);

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
    if (setValidationErrors) {
      setValidationErrors({
        traderReferences: !isValid,
      });
    }

    return isValid;
  };

  const updateParent = (updatedReferences) => {
    const cleanedReferences = updatedReferences.map(({ _id, ...ref }) =>
      _id ? { _id, ...ref } : ref
    ); // ✅ Remove empty _id
    setReferences(cleanedReferences);
    if (onChange) {
      onChange(cleanedReferences);
    }
  };

  useEffect(() => {
    validateForm();
  }, [references, touched]);

  const addReference = () => {
    const newReference = {
      company: "",
      address: "",
      personToContact: "",
      typeOfCommodity: "",
    };
    const newReferences = [...references, newReference];

    // Initialize touched state for new reference
    const newIndex = references.length;
    setTouched((prev) => ({
      ...prev,
      [`${newIndex}_company`]: false,
      [`${newIndex}_address`]: false,
      [`${newIndex}_personToContact`]: false,
      [`${newIndex}_typeOfCommodity`]: false,
    }));

    updateParent(newReferences);
  };

  const handleChange = (index, field, value) => {
    const updatedReferences = references.map((reference, i) =>
      i === index ? { ...reference, [field]: value } : reference
    );

    // Mark field as touched
    setTouched((prev) => ({
      ...prev,
      [`${index}_${field}`]: true,
    }));

    updateParent(updatedReferences);
  };

  const handleBlur = (index, field) => {
    setTouched((prev) => ({
      ...prev,
      [`${index}_${field}`]: true,
    }));
    validateForm();
  };

  const confirmDelete = (index, referenceId) => {
    const reference = references[index];

    // **Delete immediately if all fields are empty**
    if (
      !reference.company &&
      !reference.address &&
      !reference.personToContact &&
      !reference.typeOfCommodity
    ) {
      removeReference(index, referenceId, false);
    } else {
      setSelectedReferenceIndex(index);
      setSelectedReferenceId(referenceId);
      setIsModalOpen(true);
    }
  };

  const removeReference = async (index, referenceId, showMessage = true) => {
    if (!customerId) {
      console.error("❌ Error: Customer ID is missing");
      return;
    }

    // **If reference is newly added and not saved, just remove from UI**
    if (!referenceId) {
      const updatedReferences = references.filter((_, i) => i !== index);
      updateParent(updatedReferences);
      return;
    }

    try {
      const response = await fetch(
        `${Base_URL}/customers/${customerId}/tradeReferences/${referenceId}`,
        { method: "DELETE", credentials: "include" }
      );

      if (response.ok) {
        console.log("✅ Trade Reference deleted successfully");
        const updatedReferences = references.filter((_, i) => i !== index);
        updateParent(updatedReferences);
      } else {
        console.error("❌ Failed to delete reference", await response.json());
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
              {t("customer.tradeReference.company")}*
            </th>
            <th className="py-2 px-4 border border-gray-200 font-normal">
              {t("customer.tradeReference.address")}*
            </th>
            <th className="py-2 px-4 border border-gray-200 font-normal">
              {t("customer.tradeReference.personToContact")}*
            </th>
            <th className="py-2 px-4 border border-gray-200 font-normal">
              {t("customer.tradeReference.typeOfCommodity")}*
            </th>
            <th className="py-2 px-4 border border-gray-200 font-normal">
              {t("common.action")}
            </th>
          </tr>
        </thead>
        <tbody>
          {references.map((reference, index) => (
            <tr key={reference._id || index} className="border-t">
              <td className="py-2 px-4 border border-gray-200">
                <input
                  type="text"
                  value={reference.company}
                  onChange={(e) =>
                    handleChange(index, "company", e.target.value)
                  }
                  onBlur={() => handleBlur(index, "company")}
                  placeholder={t("customer.tradeReference.enterCompanyName")}
                  className={`w-full border-gray-300 rounded p-2 ${
                    errors[`${index}_company`] && touched[`${index}_company`]
                      ? "border-red-500"
                      : ""
                  }`}
                />
                {errors[`${index}_company`] && touched[`${index}_company`] && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors[`${index}_company`]}
                  </p>
                )}
              </td>
              <td className="py-2 px-4 border border-gray-200">
                <input
                  type="text"
                  value={reference.address}
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
                  type="text"
                  value={reference.personToContact}
                  onChange={(e) =>
                    handleChange(index, "personToContact", e.target.value)
                  }
                  onBlur={() => handleBlur(index, "personToContact")}
                  placeholder={t("customer.tradeReference.enterPersonToContact")}
                  className={`w-full border-gray-300 rounded p-2 ${
                    errors[`${index}_personToContact`] &&
                    touched[`${index}_personToContact`]
                      ? "border-red-500"
                      : ""
                  }`}
                />
                {errors[`${index}_personToContact`] &&
                  touched[`${index}_personToContact`] && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors[`${index}_personToContact`]}
                    </p>
                  )}
              </td>
              <td className="py-2 px-4 border border-gray-200">
                <input
                  type="text"
                  value={reference.typeOfCommodity}
                  onChange={(e) =>
                    handleChange(index, "typeOfCommodity", e.target.value)
                  }
                  onBlur={() => handleBlur(index, "typeOfCommodity")}
                  placeholder={t("customer.tradeReference.enterTypeOfCommodity")}
                  className={`w-full border-gray-300 rounded p-2 ${
                    errors[`${index}_typeOfCommodity`] &&
                    touched[`${index}_typeOfCommodity`]
                      ? "border-red-500"
                      : ""
                  }`}
                />
                {errors[`${index}_typeOfCommodity`] &&
                  touched[`${index}_typeOfCommodity`] && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors[`${index}_typeOfCommodity`]}
                    </p>
                  )}
              </td>
              <td className="py-2 px-4 border border-gray-200 text-center">
                <button
                  onClick={() => confirmDelete(index, reference._id)}
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
              onClick={addReference}
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
          removeReference(selectedReferenceIndex, selectedReferenceId)
        }
      />
    </div>
  );
};

export default TraderReference;
