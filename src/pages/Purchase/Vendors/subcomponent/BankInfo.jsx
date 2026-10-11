import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { FiTrash } from "react-icons/fi";
import ConfirmationModal from "../reusablecomponents/ConfirmationModal ";
import InputField from "../reusablecomponents/InputField";
import SearchableDropdown from "@/components/SearchableDropdown";
import { notifySuccess, notifyError } from "@/utils/toast";
import {
  MALAYSIA_BANK_OPTIONS,
  findMalaysiaBankByName,
} from "@/utils/malaysiaBanks";

const BankInfo = ({
  onChange,
  initialData = {},
  setValidationErrors,
  saveAttempted = false,
  customerId,
  onTabSave,
  onFormVisibilityChange,
}) => {
  const { t } = useTranslation();
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";
  const inputClass =
    "w-full border border-gray-300 rounded-md p-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]";
  const cellInputClass =
    "w-full min-w-[150px] border-0 rounded-none p-2 bg-transparent text-gray-900 placeholder:text-gray-400 shadow-none outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:bg-gray-50";
  const requiredFields = [
    "bankDetails.bankName",
    "bankAccountDetails.accountName",
    "bankAccountDetails.accountNumber",
  ];

  const [formData, setFormData] = useState({
    bankDetails: {
      bankName: "",
      bankAddress: "",
      bankCode: "",
      branchCity: "",
      branchCode: "",
    },
    bankAccountDetails: {
      accountName: "",
      accountNumber: "",
      swiftCode: "",
    },
  });

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isFormVisible, setIsFormVisible] = useState(true);

  const hasBankDataFromData = (data) => {
    const bd = data?.bankDetails || {};
    const bad = data?.bankAccountDetails || {};
    return Boolean(
      (bd.bankName && bd.bankName.trim()) ||
      (bd.bankAddress && bd.bankAddress.trim()) ||
      (bd.bankCode && bd.bankCode.trim()) ||
      (bd.branchCity && bd.branchCity.trim()) ||
      (bd.branchCode && bd.branchCode.trim()) ||
      (bad.accountName && bad.accountName.trim()) ||
      (bad.accountNumber && bad.accountNumber.trim()) ||
      (bad.swiftCode && bad.swiftCode.trim())
    );
  };

  // Load initial data
  useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) {
      const mergedData = {
        ...formData,
        bankDetails: { ...(formData.bankDetails || {}), ...(initialData.bankDetails || {}) },
        bankAccountDetails: {
          ...(formData.bankAccountDetails || {}),
          ...(initialData.bankAccountDetails || {}),
        },
      };
      setFormData(mergedData);
      setIsFormVisible(true);
      validateFormSilently(mergedData);
    } else {
      setIsFormVisible(true);
      setValidationErrors?.({ bankInfo: true });
    }
  }, [initialData]);

  useEffect(() => {
    onFormVisibilityChange?.(isFormVisible);
  }, [isFormVisible, onFormVisibilityChange]);

  useEffect(() => {
    if (!isFormVisible) return;
    if (saveAttempted) {
      const allTouched = {};
      requiredFields.forEach((field) => {
        allTouched[field] = true;
      });
      setTouched((prev) => ({ ...prev, ...allTouched }));
      validateFieldsWithTouched(formData);
    }
  }, [saveAttempted, isFormVisible]);

  useEffect(() => {
    if (!isFormVisible) {
      setErrors({});
      setValidationErrors?.({ bankInfo: false });
      return;
    }
    if (Object.keys(touched).length > 0) {
      validateFieldsWithTouched(formData);
    } else {
      validateFormSilently(formData);
    }
  }, [formData, isFormVisible]);

  const validateField = (name, value, data = formData) => {
    const parts = name.split(".");
    let fieldValue = value;
    if (value === undefined) {
      fieldValue = parts.length > 1 ? data[parts[0]]?.[parts[1]] : data[name];
    }

    if (requiredFields.includes(name) && (!fieldValue || fieldValue.trim() === "")) {
      const labelMap = {
        "bankDetails.bankName": t("vendor.bankInfo.bankName"),
        "bankAccountDetails.accountName": t("vendor.bankInfo.accountHolderName"),
        "bankAccountDetails.accountNumber": t("vendor.bankInfo.accountNumber"),
      };
      return t("customer.validation.fieldRequired", {
        field: labelMap[name] || t("vendor.validation.fieldRequired", { field: name }),
      });
    }

    return "";
  };

  const validateFormSilently = (data) => {
    if (!isFormVisible) {
      setErrors({});
      setValidationErrors?.({ bankInfo: false });
      return;
    }
    const newErrors = {};
    let isValid = true;

    requiredFields.forEach((field) => {
      const parts = field.split(".");
      const value = parts.length > 1 ? data[parts[0]]?.[parts[1]] : data[field];
      const error = validateField(field, value, data);
      if (error) {
        if (parts.length > 1) {
          const [parent, child] = parts;
          newErrors[parent] = newErrors[parent] || {};
          newErrors[parent][child] = error;
        } else {
          newErrors[field] = error;
        }
        isValid = false;
      }
    });

    setErrors(newErrors);
    setValidationErrors?.({ bankInfo: !isValid });
  };

  const validateFieldsWithTouched = (data) => {
    if (!isFormVisible) {
      setErrors({});
      setValidationErrors?.({ bankInfo: false });
      return;
    }
    const newErrors = {};
    let isValid = true;

    requiredFields.forEach((field) => {
      const parts = field.split(".");
      const value = parts.length > 1 ? data[parts[0]]?.[parts[1]] : data[field];
      const error = validateField(field, value, data);

      if (touched[field] && error) {
        if (parts.length > 1) {
          const [parent, child] = parts;
          newErrors[parent] = newErrors[parent] || {};
          newErrors[parent][child] = error;
        } else {
          newErrors[field] = error;
        }
      }

      if (error) isValid = false;
    });

    setErrors(newErrors);
    setValidationErrors?.({ bankInfo: !isValid });
  };

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    validateFieldsWithTouched(formData);
  };

  const handleNestedBlur = (parent, child) => {
    const key = `${parent}.${child}`;
    setTouched((prev) => ({ ...prev, [key]: true }));
    validateFieldsWithTouched(formData);
  };

  const shouldShowNestedError = (parent, child) => {
    const key = `${parent}.${child}`;
    return touched[key] && !!validateField(key, formData[parent]?.[child]);
  };

  const handleNestedChange = (parentField, childField, value) => {
    setFormData((prev) => {
      const updatedData = {
        ...prev,
        [parentField]: {
          ...(prev[parentField] || {}),
          [childField]: value,
        },
      };
      onChange?.(updatedData);
      return updatedData;
    });
  };

  const hasBankData = () => {
    const bd = formData.bankDetails || {};
    const bad = formData.bankAccountDetails || {};
    return (
      (bd.bankName && bd.bankName.trim()) ||
      (bd.bankAddress && bd.bankAddress.trim()) ||
      (bd.bankCode && bd.bankCode.trim()) ||
      (bd.branchCity && bd.branchCity.trim()) ||
      (bd.branchCode && bd.branchCode.trim()) ||
      (bad.accountName && bad.accountName.trim()) ||
      (bad.accountNumber && bad.accountNumber.trim()) ||
      (bad.swiftCode && bad.swiftCode.trim())
    );
  };

  const handleClearBankInfo = async () => {
    const emptyData = {
      bankDetails: {
        bankName: "",
        bankAddress: "",
        bankCode: "",
        branchCity: "",
        branchCode: "",
      },
      bankAccountDetails: {
        accountName: "",
        accountNumber: "",
        swiftCode: "",
      },
    };
    setFormData(emptyData);
    setTouched({});
    setErrors({});
    onChange?.(emptyData);
    setIsClearModalOpen(false);
    setValidationErrors?.({ bankInfo: false });

    if (customerId && onTabSave) {
      try {
        await onTabSave("bankInfo", emptyData, { successMessage: t("vendor.bankInfo.deletedSuccess") });
      } catch (error) {
        notifyError(t("vendor.bankInfo.deleteFailed"));
      }
    } else {
      notifySuccess(t("vendor.bankInfo.deletedSuccess"));
    }
  };

  return (
    <div className="space-y-6">
      {/* Delete Bank Info icon */}
      {/* {hasBankData() && (
        <div className="flex justify-end mb-2">
          <button
            onClick={() => setIsClearModalOpen(true)}
            className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete bank info"
          >
            <FiTrash size={20} />
          </button>
        </div>
      )} */}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse border border-gray-200">
          <thead>
            <tr className="text-left">
              <th className="py-2 px-4 bg-gray-100 border-b-2 border-gray-200 font-normal text-sm text-gray-800">
                {t("vendor.bankInfo.accountHolderName")}<span className="text-red-500">*</span>
              </th>
              <th className="py-2 px-4 bg-gray-100 border-b-2 border-gray-200 font-normal text-sm text-gray-800">
                {t("vendor.bankInfo.bankName")}<span className="text-red-500">*</span>
              </th>
              <th className="py-2 px-4 bg-gray-100 border-b-2 border-gray-200 font-normal text-sm text-gray-800">
                {t("vendor.bankInfo.accountNumber")}<span className="text-red-500">*</span>
              </th>
              <th className="py-2 px-4 bg-gray-100 border-b-2 border-gray-200 font-normal text-sm text-gray-800">
                {t("vendor.bankInfo.swiftBicCode")}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-white">
              <td className="py-2 px-4 border-b border-gray-200 align-top">
            <InputField
              type="text"
              value={formData.bankAccountDetails.accountName}
              onChange={(e) =>
                handleNestedChange("bankAccountDetails", "accountName", e.target.value)
              }
              onBlur={() => handleNestedBlur("bankAccountDetails", "accountName")}
              placeholder={t("vendor.bankInfo.accountHolderPlaceholder")}
              className={`${cellInputClass} ${shouldShowNestedError("bankAccountDetails", "accountName") ? "border-red-500" : ""}`}
            />
            {shouldShowNestedError("bankAccountDetails", "accountName") && (
              <p className="text-red-500 text-xs mt-1">
                {validateField(
                  "bankAccountDetails.accountName",
                  formData.bankAccountDetails.accountName
                )}
              </p>
            )}
              </td>

              <td className="py-2 px-4 border-b border-gray-200 align-top">
            <SearchableDropdown
              options={MALAYSIA_BANK_OPTIONS}
              value={formData.bankDetails.bankName}
              name="bankName"
              displayKey="name"
              valueKey="value"
              searchKeys={["name", "swiftCode"]}
              placeholder={t("vendor.bankInfo.selectBank")}
              searchPlaceholder={t("vendor.bankInfo.searchBankPlaceholder")}
              onChange={(e) => {
                const selectedName = e?.target?.value || "";
                handleNestedChange("bankDetails", "bankName", selectedName);
                handleNestedBlur("bankDetails", "bankName");
                const selectedBank = findMalaysiaBankByName(selectedName);
                if (selectedBank?.swiftCode) {
                  handleNestedChange(
                    "bankAccountDetails",
                    "swiftCode",
                    selectedBank.swiftCode
                  );
                }
              }}
              className={`${shouldShowNestedError("bankDetails", "bankName") ? "[&>button]:border-red-500" : ""}`}
            />
            {shouldShowNestedError("bankDetails", "bankName") && (
              <p className="text-red-500 text-xs mt-1">
                {validateField("bankDetails.bankName", formData.bankDetails.bankName)}
              </p>
            )}
              </td>

              <td className="py-2 px-4 border-b border-gray-200 align-top">
            <InputField
              type="text"
              value={formData.bankAccountDetails.accountNumber}
              onChange={(e) =>
                handleNestedChange("bankAccountDetails", "accountNumber", e.target.value)
              }
              onBlur={() => handleNestedBlur("bankAccountDetails", "accountNumber")}
              placeholder={t("vendor.bankInfo.accountNumberPlaceholder")}
              className={`${cellInputClass} ${shouldShowNestedError("bankAccountDetails", "accountNumber") ? "border-red-500" : ""}`}
            />
            {shouldShowNestedError("bankAccountDetails", "accountNumber") && (
              <p className="text-red-500 text-xs mt-1">
                {validateField(
                  "bankAccountDetails.accountNumber",
                  formData.bankAccountDetails.accountNumber
                )}
              </p>
            )}
              </td>

              <td className="py-2 px-4 border-b border-gray-200 align-top">
            <InputField
              type="text"
              value={formData.bankAccountDetails.swiftCode}
              onChange={(e) =>
                handleNestedChange("bankAccountDetails", "swiftCode", e.target.value)
              }
              onBlur={() => handleNestedBlur("bankAccountDetails", "swiftCode")}
              placeholder={t("vendor.bankInfo.swiftBicPlaceholder")}
              className={`${cellInputClass} ${shouldShowNestedError("bankAccountDetails", "swiftCode") ? "border-red-500" : ""}`}
            />
            {shouldShowNestedError("bankAccountDetails", "swiftCode") && (
              <p className="text-red-500 text-xs mt-1">
                {validateField(
                  "bankAccountDetails.swiftCode",
                  formData.bankAccountDetails.swiftCode
                )}
              </p>
            )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <ConfirmationModal
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        onConfirm={handleClearBankInfo}
        message={t("vendor.bankInfo.confirmDelete")}
      />
    </div>
  );
};

export default BankInfo;
