import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { FiPlus, FiTrash } from "react-icons/fi";
import ConfirmationModal from "../reusablecomponents/ConfirmationModal ";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

/**
 * A component to manage principal bankers for a customer.
 * Each banker consists of bank name, address, bank account, account holder name, account type, and SWIFT code.
 * The component provides the ability to add, edit, and delete principal bankers.
 *
 * @param {object} props - The props object
 * @param {array} props.initialData - The initial principal bankers data
 * @param {function} props.onChange - The callback function to call when the principal bankers data changes
 * @param {string} props.customerId - The customer ID
 * @param {function} props.setValidationErrors - The callback function to call when there are validation errors
 * @returns {ReactElement} The PrincipleBanker component
 */
const PrincipleBanker = ({
  initialData = [],
  onChange,
  customerId,
  setValidationErrors,
}) => {
  const { t } = useTranslation();

  console.log("🔍 Debug: Customer ID received in PrincipleBanker:", customerId);
  console.log("initialData", initialData);

  const fieldLabels = {
    bankName: t("customer.principalBanker.bankName"),
    address: t("customer.principalBanker.address"),
    bankAccount: t("customer.principalBanker.bankAccount"),
    accountHolderName: t("customer.principalBanker.accountHolderName"),
    accountType: t("customer.principalBanker.accountType"),
    swiftCode: t("customer.principalBanker.swiftCode"),
  };

  const [bankers, setBankers] = useState(
    Array.isArray(initialData) && initialData.length > 0
      ? initialData
      : [
          {
            bankName: "",
            address: "",
            bankAccount: "",
            accountHolderName: "",
            accountType: "",
            swiftCode: "",
          },
        ]
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBankerIndex, setSelectedBankerIndex] = useState(null);
  const [selectedBankerId, setSelectedBankerId] = useState(null);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  useEffect(() => {
    if (Array.isArray(initialData) && initialData.length > 0) {
      setBankers(initialData);
      // Initialize touched state as false for all fields
      const initialTouched = {};
      initialData.forEach((_, index) => {
        initialTouched[`${index}_bankName`] = false;
        initialTouched[`${index}_address`] = false;
        initialTouched[`${index}_bankAccount`] = false;
        initialTouched[`${index}_accountHolderName`] = false;
        initialTouched[`${index}_accountType`] = false;
        initialTouched[`${index}_swiftCode`] = false;
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

    // Add more specific validations if needed (similar to KeyContact)
    // For example, if there were specific format requirements for SWIFT codes or bank accounts

    return "";
  };

  // Silent validation (doesn't show errors to user)
  const validateFormSilently = () => {
    const newErrors = {};
    let isValid = true;

    bankers.forEach((banker, index) => {
      [
        "bankName",
        "address",
        "bankAccount",
        "accountHolderName",
        "accountType",
        "swiftCode",
      ].forEach((field) => {
        const error = validateField(index, field, banker[field]);
        if (error) {
          newErrors[`${index}_${field}`] = error;
          isValid = false;
        }
      });
    });

    setErrors(newErrors);

    // Update parent validation state without showing errors
    setValidationErrors({
      principleBankers: !isValid,
    });

    return isValid;
  };

  // Validate only touched fields
  const validateForm = () => {
    const newErrors = {};
    let isValid = true;

    // Check all fields for form validity
    bankers.forEach((banker, index) => {
      [
        "bankName",
        "address",
        "bankAccount",
        "accountHolderName",
        "accountType",
        "swiftCode",
      ].forEach((field) => {
        const fieldId = `${index}_${field}`;
        const error = validateField(index, field, banker[field]);

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

    // Update parent validation state
    setValidationErrors({
      principleBankers: !isValid,
    });

    return isValid;
  };

  const updateParent = (updatedBankers) => {
    setBankers(updatedBankers);
    onChange && onChange(updatedBankers);
    validateForm();
  };

  useEffect(() => {
    validateForm();
  }, [bankers, touched]);

  const handleChange = (index, field, value) => {
    const updatedBankers = bankers.map((banker, i) =>
      i === index ? { ...banker, [field]: value } : banker
    );

    // Mark field as touched
    setTouched((prev) => ({
      ...prev,
      [`${index}_${field}`]: true,
    }));

    updateParent(updatedBankers);
  };

  const handleBlur = (index, field) => {
    setTouched((prev) => ({
      ...prev,
      [`${index}_${field}`]: true,
    }));
    validateForm();
  };

  const addBanker = () => {
    const newBanker = {
      bankName: "",
      address: "",
      bankAccount: "",
      accountHolderName: "",
      accountType: "",
      swiftCode: "",
    };
    const newBankers = [...bankers, newBanker];

    // Initialize touched state for new banker
    const newIndex = bankers.length;
    setTouched((prev) => ({
      ...prev,
      [`${newIndex}_bankName`]: false,
      [`${newIndex}_address`]: false,
      [`${newIndex}_bankAccount`]: false,
      [`${newIndex}_accountHolderName`]: false,
      [`${newIndex}_accountType`]: false,
      [`${newIndex}_swiftCode`]: false,
    }));

    updateParent(newBankers);
  };

  const confirmDelete = (index, bankerId) => {
    const banker = bankers[index];

    if (
      !banker.bankName &&
      !banker.address &&
      !banker.bankAccount &&
      !banker.accountHolderName &&
      !banker.accountType &&
      !banker.swiftCode
    ) {
      removeBanker(index, bankerId, false);
    } else {
      setSelectedBankerIndex(index);
      setSelectedBankerId(bankerId);
      setIsModalOpen(true);
    }
  };

  const removeBanker = async (index, bankerId, showMessage = true) => {
    if (!customerId) {
      console.error("❌ Error: Customer ID is missing");
      return;
    }

    if (!bankerId) {
      const updatedBankers = bankers.filter((_, i) => i !== index);
      updateParent(updatedBankers);
      return;
    }

    try {
      const response = await fetch(
        `${Base_URL}/customers/${customerId}/principalBankers/${bankerId}`,
        { method: "DELETE", credentials: "include" }
      );

      if (response.ok) {
        const updatedBankers = bankers.filter((_, i) => i !== index);
        updateParent(updatedBankers);
      } else {
        console.error("❌ Failed to delete banker", await response.json());
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
              {t("customer.principalBanker.bankName")}*
            </th>
            <th className="py-2 px-4 border border-gray-200 font-normal">
              {t("customer.principalBanker.address")}*
            </th>
            <th className="py-2 px-4 border border-gray-200 font-normal">
              {t("customer.principalBanker.bankAccount")}*
            </th>
            <th className="py-2 px-4 border border-gray-200 font-normal">
              {t("customer.principalBanker.accountHolderName")}*
            </th>
            <th className="py-2 px-4 border border-gray-200 font-normal">
              {t("customer.principalBanker.accountType")}*
            </th>
            <th className="py-2 px-4 border border-gray-200 font-normal">
              {t("customer.principalBanker.swiftCode")}*
            </th>
            <th className="py-2 px-4 border border-gray-200 font-normal">
              {t("common.action")}
            </th>
          </tr>
        </thead>
        <tbody>
          {bankers.map((banker, index) => (
            <tr key={banker._id || index} className="border-t">
              <td className="py-2 px-4 border border-gray-200">
                <input
                  type="text"
                  value={banker.bankName}
                  onChange={(e) =>
                    handleChange(index, "bankName", e.target.value)
                  }
                  onBlur={() => handleBlur(index, "bankName")}
                  placeholder={t("customer.principalBanker.enterBankName")}
                  className={`w-full border-gray-300 rounded p-2 ${
                    errors[`${index}_bankName`] && touched[`${index}_bankName`]
                      ? "border-red-500"
                      : ""
                  }`}
                />
                {errors[`${index}_bankName`] &&
                  touched[`${index}_bankName`] && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors[`${index}_bankName`]}
                    </p>
                  )}
              </td>
              <td className="py-2 px-4 border border-gray-200">
                <input
                  type="text"
                  value={banker.address}
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
                  value={banker.bankAccount}
                  onChange={(e) =>
                    handleChange(index, "bankAccount", e.target.value)
                  }
                  onBlur={() => handleBlur(index, "bankAccount")}
                  placeholder={t("customer.principalBanker.enterBankAccount")}
                  className={`w-full border-gray-300 rounded p-2 ${
                    errors[`${index}_bankAccount`] &&
                    touched[`${index}_bankAccount`]
                      ? "border-red-500"
                      : ""
                  }`}
                />
                {errors[`${index}_bankAccount`] &&
                  touched[`${index}_bankAccount`] && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors[`${index}_bankAccount`]}
                    </p>
                  )}
              </td>
              <td className="py-2 px-4 border border-gray-200">
                <input
                  type="text"
                  value={banker.accountHolderName}
                  onChange={(e) =>
                    handleChange(index, "accountHolderName", e.target.value)
                  }
                  onBlur={() => handleBlur(index, "accountHolderName")}
                  placeholder={t("customer.principalBanker.enterAccountHolderName")}
                  className={`w-full border-gray-300 rounded p-2 ${
                    errors[`${index}_accountHolderName`] &&
                    touched[`${index}_accountHolderName`]
                      ? "border-red-500"
                      : ""
                  }`}
                />
                {errors[`${index}_accountHolderName`] &&
                  touched[`${index}_accountHolderName`] && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors[`${index}_accountHolderName`]}
                    </p>
                  )}
              </td>
              <td className="py-2 px-4 border border-gray-200">
                <input
                  type="text"
                  value={banker.accountType}
                  onChange={(e) =>
                    handleChange(index, "accountType", e.target.value)
                  }
                  onBlur={() => handleBlur(index, "accountType")}
                  placeholder={t("customer.principalBanker.enterAccountType")}
                  className={`w-full border-gray-300 rounded p-2 ${
                    errors[`${index}_accountType`] &&
                    touched[`${index}_accountType`]
                      ? "border-red-500"
                      : ""
                  }`}
                />
                {errors[`${index}_accountType`] &&
                  touched[`${index}_accountType`] && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors[`${index}_accountType`]}
                    </p>
                  )}
              </td>
              <td className="py-2 px-4 border border-gray-200">
                <input
                  type="text"
                  value={banker.swiftCode}
                  onChange={(e) =>
                    handleChange(index, "swiftCode", e.target.value)
                  }
                  onBlur={() => handleBlur(index, "swiftCode")}
                  placeholder={t("customer.principalBanker.enterSwiftCode")}
                  className={`w-full border-gray-300 rounded p-2 ${
                    errors[`${index}_swiftCode`] &&
                    touched[`${index}_swiftCode`]
                      ? "border-red-500"
                      : ""
                  }`}
                />
                {errors[`${index}_swiftCode`] &&
                  touched[`${index}_swiftCode`] && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors[`${index}_swiftCode`]}
                    </p>
                  )}
              </td>
              <td className="py-2 px-4 border border-gray-200 text-center">
                <button
                  onClick={() => confirmDelete(index, banker._id)}
                  className="text-red-500 hover:text-red-700"
                >
                  <FiTrash />
                </button>
              </td>
            </tr>
          ))}
          <tr>
            <td
              colSpan="7"
              className="py-2 px-4 text-green-500 hover:text-green-700 cursor-pointer text-left"
              onClick={addBanker}
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
        onConfirm={() => removeBanker(selectedBankerIndex, selectedBankerId)}
      />
    </div>
  );
};

export default PrincipleBanker;
