import React, { useState, useEffect, useContext } from "react";
import { useHistory } from "react-router-dom";
import axios from "axios";
import { BackButton, PageHeader } from "@/page-layouts/index";
import SearchableDropdown from "@/components/SearchableDropdown";
import SingleBusinessField from "@/components/SingleBusinessField";
import { isSingleAssignedBusiness } from "@/utils/sessionAssignedBusinesses";
import { notifySuccess, notifyError } from "@/utils/toast";
import { AdminContext } from "@/context/AdminContext";
import RouteActionGate from "@/components/RouteActionGate";
import { PERMISSION_ACTION } from "@/utils/permissionUtils";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const AddAccount = () => {
  const history = useHistory();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const authHeaders = { authorization: `Bearer ${adminInfo?.token}` };
  const requiredPermission = PERMISSION_ACTION.ADD;

  const [accountTypes, setAccountTypes] = useState([]);
  const [formData, setFormData] = useState({
    business: "",
    accountType: "",
    accountName: "",
    accountCode: "",
    description: "",
    isSubAccount: false,
    parentAccount: "",
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [businesses, setBusinesses] = useState([]);
  const [parentAccounts, setParentAccounts] = useState([]);
  const isSingleBusiness = isSingleAssignedBusiness();
  const awaitingBusinessPlaceholder = isSingleBusiness
    ? "Loading…"
    : "Select a business first";

  // Filter account types by selected business and group by header
  const filteredAccountTypes = accountTypes.filter((account) => {
    // If no business selected, show all
    if (!formData.business) return true;
    // Filter by business ID (bid)
    return account.bid === formData.business;
  });

  // Get unique account headers dynamically from the data
  const uniqueHeaders = [
    ...new Set(filteredAccountTypes.map((account) => account.accountHeader)),
  ].sort();

  const groupedAccountTypes = filteredAccountTypes.reduce((acc, account) => {
    if (!acc[account.accountHeader]) {
      acc[account.accountHeader] = [];
    }
    acc[account.accountHeader].push(account);
    return acc;
  }, {});
  Object.keys(groupedAccountTypes).forEach((header) => {
    groupedAccountTypes[header].sort((a, b) => a.name.localeCompare(b.name));
  });

  // Fetch assigned businesses on mount
  useEffect(() => {
    if (!adminInfo?.id) return;
    axios
      .get(`${Base_URL}/admin/assigned/${adminInfo.id}`, { headers: authHeaders })
      .then((res) => {
        const list = res.data?.businesses || [];
        setBusinesses(list);
        if (list.length === 1) {
          handleInputChange("business", list[0]._id);
        }
      })
      .catch((err) => console.error("Failed to fetch assigned businesses:", err));
  }, [adminInfo?.id]);

  // Fetch parent accounts filtered by selected business
  useEffect(() => {
    if (!formData.business) {
      setParentAccounts([]);
      return;
    }
    const fetchParentAccounts = async () => {
      try {
        const accountsRes = await axios.get(`${Base_URL}/accounts`, {
          params: { business: formData.business, limit: 1000 },
        });
        setParentAccounts(accountsRes.data.accounts || []);
      } catch (error) {
        console.error("Error fetching parent accounts:", error);
        setParentAccounts([]);
      }
    };
    fetchParentAccounts();
  }, [formData.business]);

  // Fetch account types when business is selected
  useEffect(() => {
    const fetchAccountTypes = async () => {
      if (!formData.business) {
        setAccountTypes([]);
        return;
      }

      try {
        const response = await axios.get(`${Base_URL}/account-types`, {
          params: { bid: formData.business },
        });
        setAccountTypes(response.data);
      } catch (error) {
        console.error("Error fetching account types:", error);
        setAccountTypes([]);
      }
    };

    fetchAccountTypes();
  }, [formData.business]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.business) newErrors.business = "Business is required";
    if (!formData.accountType) newErrors.accountType = "Account Type is required";
    if (!formData.accountName || formData.accountName.trim() === "") {
      newErrors.accountName = "Account Name is required";
    } else if (formData.accountName.trim().length < 2) {
      newErrors.accountName = "Account Name must be at least 2 characters";
    }
    if (!formData.accountCode || formData.accountCode.trim() === "") {
      newErrors.accountCode = "Account Code is required";
    }
    if (formData.isSubAccount && !formData.parentAccount) {
      newErrors.parentAccount = "Parent Account is required for sub-accounts";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!validateForm()) {
      notifyError("Please fill in all required fields correctly");
      return;
    }

    setIsSubmitting(true);

    const newAccount = {
      business: formData.business,
      accountType: formData.accountType,
      accountName: formData.accountName.trim(),
      code: formData.accountCode.trim(),
      description: formData.description?.trim() || "",
      isSubAccount: formData.isSubAccount,
      parentAccount: formData.isSubAccount ? formData.parentAccount : null,
    };

    try {
      await axios.post(`${Base_URL}/accounts`, newAccount);
      notifySuccess("Account created successfully!", () => {
        history.push("/chart-of-accounts");
      });
    } catch (error) {
      console.error("Error creating account:", error);
      const errorMessage =
        error.response?.data?.message ||
        (error.response?.status === 500
          ? "Server error. The account code may already be in use."
          : "Failed to create account. Please try again.");
      notifyError(errorMessage);
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      // Clear account type and parent account if business changes
      if (field === "business" && value !== prev.business) {
        updated.accountType = "";
        updated.parentAccount = "";
      }
      return updated;
    });
    // Clear error when field is edited
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const fieldLabel = (text, required) => (
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {text} {required && <span className="text-red-500">*</span>}
    </label>
  );

  const errorMsg = (msg) =>
    msg ? <p className="text-red-500 text-xs mt-1">{msg}</p> : null;

  const inputClass = (field) =>
    `w-full px-4 py-2 border-2 ${
      errors[field]
        ? "border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500"
        : "border-transparent bg-gray-100 focus:border-[var(--p-blue)]"
    } rounded-xl focus:outline-none focus:shadow-sm hover:border-[var(--p-blue)] transition-all min-h-[37px]`;

  return (
    <RouteActionGate
      title="Chart of Accounts"
      requiredPermission={requiredPermission}
    >
      <div className="py-6 px-6 min-h-screen">
      <BackButton onClick={() => history.push("/chart-of-accounts")} />
      <PageHeader title="Add Account" />

      <form onSubmit={handleSubmit} className="space-y-6 mt-4" noValidate>

        {/* Row 1: Business + Account Name */}
        <div className="grid grid-cols-2 gap-6">
          <SingleBusinessField
            selectedValue={formData.business}
            onAutoSelect={(id) => handleInputChange("business", id)}
          >
          <div className="flex flex-col">
            {fieldLabel("Business", true)}
            <div className={errors.business ? "border-2 border-red-500 rounded-lg" : ""}>
              <SearchableDropdown
                value={formData.business}
                onChange={(e) => handleInputChange("business", e.target.value)}
                placeholder="Select Business"
                searchPlaceholder="Search businesses..."
                options={businesses.map((b) => ({ value: b._id, label: b.name }))}
              />
            </div>
            {errorMsg(errors.business)}
          </div>
          </SingleBusinessField>

          {/* Account Type Selection */}
          <div className="flex flex-col">
            {fieldLabel("Account Type", true)}
            <div
              className={
                errors.accountType ? "border-2 border-red-500 rounded-lg" : ""
              }
            >
              <SearchableDropdown
                value={formData.accountType}
                onChange={(e) => {
                  console.log("Account type changed:", e.target.value);
                  handleInputChange("accountType", e.target.value);
                }}
                placeholder={
                  formData.business
                    ? "Select Account Type"
                    : awaitingBusinessPlaceholder
                }
                searchPlaceholder="Search account types..."
                options={uniqueHeaders.flatMap((header) => {
                  if (groupedAccountTypes[header]?.length > 0) {
                    return groupedAccountTypes[header].map((account) => ({
                      value: account._id,
                      label: `${account.code} - ${account.name} (${header})`,
                    }));
                  }
                  return [];
                })}
                disabled={!formData.business}
              />
            </div>
            {errors.accountType && (
              <p className="mt-1 text-sm text-red-500">
                {errors.accountType}
              </p>
            )}
          </div>

          <div className="flex flex-col">
            {fieldLabel("Account Code", true)}
            <input
              type="text"
              value={formData.accountCode}
              onChange={(e) => handleInputChange("accountCode", e.target.value)}
              placeholder="Enter account code"
              className={inputClass("accountCode")}
            />
            {errorMsg(errors.accountCode)}
          </div>

          <div className="flex flex-col">
            {fieldLabel("Account Name", true)}
            <input
              type="text"
              value={formData.accountName}
              onChange={(e) => handleInputChange("accountName", e.target.value)}
              placeholder="Enter account name"
              className={inputClass("accountName")}
            />
            {errorMsg(errors.accountName)}
          </div>
        </div>

        {/* Row 3: Sub-account toggle + Parent Account (conditional) */}
        <div className="grid grid-cols-2 gap-6">
          <div className="flex flex-col justify-center">
            {fieldLabel("Sub-account")}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isSubAccount}
                onChange={(e) => handleInputChange("isSubAccount", e.target.checked)}
                className="w-4 h-4 bg-gray-100 border-gray-300 rounded focus:ring-2 focus:ring-[var(--p-blue)]"
              />
              <span className="text-sm text-gray-700">Make this a sub-account</span>
            </label>
          </div>

          {formData.isSubAccount && (
            <div className="flex flex-col">
              {fieldLabel("Parent Account", true)}
              <div className={errors.parentAccount ? "border-2 border-red-500 rounded-lg" : ""}>
                <SearchableDropdown
                  value={formData.parentAccount}
                  onChange={(e) => handleInputChange("parentAccount", e.target.value)}
                  placeholder={!formData.business ? awaitingBusinessPlaceholder : "Select Parent Account"}
                  searchPlaceholder="Search parent accounts..."
                  disabled={!formData.business}
                  options={parentAccounts.map((account) => ({
                    value: account._id,
                    label: `${account.code || "N/A"} - ${account.accountName}${
                      account.accountType ? ` (${account.accountType.accountHeader})` : ""
                    }`,
                  }))}
                />
              </div>
              {errorMsg(errors.parentAccount)}
            </div>
          )}
        </div>

        {/* Description — full width */}
        <div className="flex flex-col">
          {fieldLabel("Description")}
          <textarea
            value={formData.description}
            onChange={(e) => handleInputChange("description", e.target.value)}
            placeholder="Enter account description"
            rows={3}
            className="w-full px-4 py-2 border-2 border-transparent bg-gray-100 rounded-xl focus:outline-none focus:border-[var(--p-blue)] focus:shadow-sm hover:border-[var(--p-blue)] transition-all resize-none"
          />
        </div>

        {/* Footer buttons */}
        <div className="flex justify-end gap-3 mt-8">
          <button
            type="button"
            onClick={() => history.push("/chart-of-accounts")}
            className="w-[133px] h-[40px] px-4 py-2 bg-[#F5F5F5] text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[var(--p-blue-dark)] transition-colors disabled:opacity-50"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                Saving...
              </span>
            ) : (
              "Save"
            )}
          </button>
        </div>
      </form>
      </div>
    </RouteActionGate>
  );
};

export default AddAccount;
