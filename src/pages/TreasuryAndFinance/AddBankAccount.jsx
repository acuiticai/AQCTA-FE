import React, { useEffect, useState, useContext } from "react";
import { useHistory } from "react-router-dom";
import axios from "axios";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { FormInput, PageHeader, BackButton } from "@/page-layouts/index";
import SearchableDropdown from "@/components/SearchableDropdown";
import SingleBusinessField from "@/components/SingleBusinessField";
import { isSingleAssignedBusiness } from "@/utils/sessionAssignedBusinesses";
import { notifyError, notifySuccess } from "@/utils/toast";
import { AdminContext } from "@/context/AdminContext";
import RouteActionGate from "@/components/RouteActionGate";
import { PERMISSION_ACTION } from "@/utils/permissionUtils";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const AddBankAccount = () => {
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const authHeaders = { authorization: `Bearer ${adminInfo?.token}` };

  const [currencies, setCurrencies] = useState([]);
  const history = useHistory();
  const isSingleBusiness = isSingleAssignedBusiness();
  const awaitingBusinessPlaceholder = isSingleBusiness
    ? "Loading…"
    : "Select business first";

  const [formData, setFormData] = useState({
    business: "",
    accountName: "",
    accountType: "",
    accountNumber: "",
    bankName: "",
    currencyType: "",
    openingBalance: "",
    iban: "",
    swiftCode: "",
    bankAddress: "",
    isActive: true,
    bankType: "Bank Account",
    accountCategory: "bank",
    accountCode: "",
  });

  const [businesses, setBusinesses] = useState([]);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accountTypes, setAccountTypes] = useState([]);
  const [chartAccounts, setChartAccounts] = useState([]);

  const handleChange = (value, name) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      // Reset account type when business changes
      ...(name === "business" ? { accountType: "" } : {}),
    }));

    // Clear error when field is edited
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: "",
      });
    }
  };

  const handleAddressChange = (content) => {
    setFormData({
      ...formData,
      bankAddress: content,
    });

    if (errors.bankAddress) {
      setErrors({
        ...errors,
        bankAddress: "",
      });
    }
  };

  // One "Account Type" question drives both stored fields: bankType (Bank vs
  // Money Changer, used by stats & the money-changer payment mode) and
  // accountCategory (how it's reconciled). Keeping them in sync here means the
  // form asks once instead of twice.
  const ACCOUNT_TYPES = [
    { value: "bank", label: "Bank", bankType: "Bank Account", category: "bank", hint: "reconciled against a bank statement" },
    { value: "cash", label: "Cash", bankType: "Bank Account", category: "cash", hint: "physical cash, verified by counting" },
    { value: "clearing", label: "Clearing", bankType: "Bank Account", category: "clearing", hint: "card / QR held by a provider" },
    { value: "moneychanger", label: "Money Changer", bankType: "Money Changer", category: "moneychanger", hint: "an FX dealer account" },
  ];

  const accountTypeValue =
    formData.bankType === "Money Changer"
      ? "moneychanger"
      : formData.accountCategory || "bank";

  const selectAccountType = (value) => {
    const opt = ACCOUNT_TYPES.find((o) => o.value === value) || ACCOUNT_TYPES[0];
    setFormData((prev) => ({
      ...prev,
      bankType: opt.bankType,
      accountCategory: opt.category,
    }));
  };

  const validateForm = () => {
    let tempErrors = {};
    let isValid = true;

    if (!formData.business) {
      tempErrors.business = "Business is required";
      isValid = false;
    }

    if (
      !formData.accountType ||
      formData.accountType === "" ||
      (typeof formData.accountType === "string" && !formData.accountType.trim())
    ) {
      tempErrors.accountType = "Account type is required";
      isValid = false;
    }

    if (!formData.accountName || !formData.accountName.trim()) {
      tempErrors.accountName = "Account name is required";
      isValid = false;
    }

    if (!formData.accountNumber || !formData.accountNumber.trim()) {
      tempErrors.accountNumber = "Account number is required";
      isValid = false;
    }

    if (!formData.bankName || !formData.bankName.trim()) {
      tempErrors.bankName = "Bank name is required";
      isValid = false;
    }

    if (!formData.currencyType || !formData.currencyType.trim()) {
      tempErrors.currencyType = "Currency type is required";
      isValid = false;
    }

    if (
      !formData.accountCode ||
      formData.accountCode === "" ||
      (typeof formData.accountCode === "string" && !formData.accountCode.trim())
    ) {
      tempErrors.accountCode = "Account code is required";
      isValid = false;
    }

    if (
      !formData.openingBalance ||
      !formData.openingBalance.toString().trim()
    ) {
      tempErrors.openingBalance = "Opening balance is required";
      isValid = false;
    } else if (isNaN(parseFloat(formData.openingBalance))) {
      tempErrors.openingBalance = "Opening balance must be a valid number";
      isValid = false;
    } else if (parseFloat(formData.openingBalance) < 0) {
      tempErrors.openingBalance = "Opening balance cannot be negative";
      isValid = false;
    }

    if (!formData.swiftCode || !formData.swiftCode.trim()) {
      tempErrors.swiftCode = "Swift code is required";
      isValid = false;
    }

    if (
      !formData.bankAddress ||
      !formData.bankAddress.trim() ||
      formData.bankAddress === "<p><br></p>"
    ) {
      tempErrors.bankAddress = "Bank address is required";
      isValid = false;
    }

    setErrors(tempErrors);
    return isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      notifyError("Please fill in all required fields correctly");
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare data for submission - handle empty accountType
      const submitData = { ...formData };
      if (submitData.accountType === "") {
        submitData.accountType = null;
      }

      await axios.post(`${Base_URL}/bank-management/accounts`, submitData);
      notifySuccess("Bank account created successfully");
      history.push("/bank-management");
    } catch (error) {
      console.error("Failed to add bank account:", error);
      if (error.response && error.response.data.errors) {
        setErrors(error.response.data.errors);
        // Show error popup for duplicate account
        if (error.response.data.message) {
          notifyError(error.response.data.message);
        }
      } else if (error.response && error.response.data.message) {
        notifyError(error.response.data.message);
        setErrors({});
      } else {
        notifyError("Failed to create bank account. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    // Fetch only businesses assigned to the logged-in user
    const fetchAssignedBusinesses = async () => {
      if (!adminInfo?.id) return;
      try {
        const response = await axios.get(
          `${Base_URL}/admin/assigned/${adminInfo.id}`,
          { headers: authHeaders }
        );
        const list = response.data?.businesses || [];
        setBusinesses(list);
        // Auto-preselect if exactly one assigned business
        if (list.length === 1) {
          setFormData((prev) => ({ ...prev, business: list[0]._id }));
        }
      } catch (error) {
        console.error("Failed to fetch assigned businesses:", error);
      }
    };
    fetchAssignedBusinesses();
  }, [adminInfo?.id]);

  useEffect(() => {
    const fetchAccountTypes = async () => {
      if (!formData.business) {
        setAccountTypes([]);
        return;
      }
      try {
        const response = await axios.get(
          `${Base_URL}/bank-account-types?business=${formData.business}`
        );
        setAccountTypes(response.data);
      } catch (error) {
        console.error("Error fetching bank account types:", error);
      }
    };
    fetchAccountTypes();
  }, [formData.business]);

  useEffect(() => {
    const fetchCurrencies = async () => {
      if (formData?.business) {
        try {
          const response = await axios.get(
            `${Base_URL}/finance/currencies?business_id=${formData?.business}`
          );
          setCurrencies(response.data.data || []);
        } catch (error) {
          console.error("Error fetching currencies:", error);
          setCurrencies([]);
        }
      } else {
        setCurrencies([]);
      }
    };
    fetchCurrencies();
  }, [formData?.business]);

  // Fetch chart accounts when business is selected
  useEffect(() => {
    const fetchChartAccounts = async () => {
      if (formData?.business) {
        try {
          const response = await axios.get(`${Base_URL}/accounts`, {
            params: { business: formData.business },
          });
          setChartAccounts(response.data.accounts || []);
        } catch (error) {
          console.error("Error fetching chart accounts:", error);
          setChartAccounts([]);
        }
      } else {
        setChartAccounts([]);
      }
    };
    fetchChartAccounts();
  }, [formData?.business]);

  // Prepare currency dropdown options from fetched currencies
  const currencyOptions = currencies.map((currency) => ({
    value: currency.symbol,
    label: `${currency.symbol} (${currency.prefix})`,
    conversionRate: currency.conversion_rate_to_base,
  }));

  const fieldLabel = (text, required) => (
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {text} {required && <span className="text-red-500">*</span>}
    </label>
  );

  const errorMsg = (msg) =>
    msg ? <p className="text-red-500 text-xs mt-1">{msg}</p> : null;

  return (
    <RouteActionGate
      title="Bank Accounts"
      requiredPermission={PERMISSION_ACTION.ADD}
    >
      <div className="py-6 px-6 min-h-screen">
      <BackButton onClick={() => history.push("/bank-management")} />
      <PageHeader title="Add Bank Account" />

      <form onSubmit={handleSubmit} className="space-y-6 mt-4">

        {/* Account Type — one question that sets bankType + accountCategory */}
        <div className="flex flex-col gap-1">
          {fieldLabel("Account Type")}
          <div className="flex flex-wrap items-center gap-6">
            {ACCOUNT_TYPES.map((opt) => (
              <label
                key={opt.value}
                className="inline-flex items-center gap-2 cursor-pointer"
                title={opt.hint}
              >
                <input
                  type="radio"
                  name="accountType"
                  checked={accountTypeValue === opt.value}
                  onChange={() => selectAccountType(opt.value)}
                  className="h-4 w-4 text-lime-500 border-gray-300"
                />
                <span className="text-sm text-gray-700">{opt.label}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Only bank accounts are reconciled against a bank statement. Cash is
            counted; clearing accounts settle against a provider report; a money
            changer is an FX dealer account.
          </p>
        </div>

        {/* Row 1: Business + Account Name */}
        <div className="grid grid-cols-2 gap-6">
          <SingleBusinessField
            selectedValue={formData.business}
            onAutoSelect={(id) => handleChange(id, "business")}
          >
          <div className="flex flex-col">
            {fieldLabel("Business", true)}
            <div className={errors.business ? "border-2 border-red-500 rounded-lg" : ""}>
              <SearchableDropdown
                name="business"
                value={formData.business}
                onChange={(e) => handleChange(e.target.value, "business")}
                placeholder="Select Business"
                searchPlaceholder="Search businesses..."
                options={businesses?.map((b) => ({ value: b._id, label: b.name })) || []}
              />
            </div>
            {errorMsg(errors.business)}
          </div>
          </SingleBusinessField>

          <div className="flex flex-col">
            {fieldLabel("Account Name", true)}
            <FormInput
              type="text"
              name="accountName"
              value={formData.accountName}
              onChange={(e) => handleChange(e.target.value, "accountName")}
              placeholder="Account Name"
              error={errors.accountName}
              shouldShowError={!!errors.accountName}
              noLabel
            />
          </div>
        </div>

        {/* Row 2: Account Type + Account Code */}
        <div className="grid grid-cols-2 gap-6">
          <div className="flex flex-col">
            {fieldLabel("Bank Account Type", true)}
            <div className={errors.accountType ? "border-2 border-red-500 rounded-lg" : ""}>
              <SearchableDropdown
                name="accountType"
                value={formData.accountType}
                onChange={(e) => handleChange(e.target.value, "accountType")}
                placeholder={!formData.business ? awaitingBusinessPlaceholder : "Select Account Type"}
                searchPlaceholder="Search account types..."
                disabled={!formData.business}
                options={accountTypes?.map((t) => ({ value: t._id, label: t.name })) || []}
              />
            </div>
            {errorMsg(errors.accountType)}
          </div>

          <div className="flex flex-col">
            {fieldLabel("Account Code", true)}
            <div className={errors.accountCode ? "border-2 border-red-500 rounded-lg" : ""}>
              <SearchableDropdown
                name="accountCode"
                value={formData.accountCode}
                onChange={(e) => handleChange(e.target.value, "accountCode")}
                placeholder={!formData.business ? awaitingBusinessPlaceholder : "Select Account Code"}
                searchPlaceholder="Search account codes..."
                disabled={!formData.business}
                options={
                  chartAccounts?.map((account) => ({
                    value: account._id,
                    label: `${account.code || "N/A"} - ${account.accountName}`,
                    name: account.accountName,
                    code: account.code || "N/A",
                    type: account.accountType?.name || "Unknown Type",
                  })) || []
                }
                searchKeys={["name", "code", "type"]}
                renderOption={(option) => (
                  <div>
                    <div className="font-medium">{option.code} - {option.name}</div>
                    <div className="text-xs text-gray-500">{option.type}</div>
                  </div>
                )}
              />
            </div>
            {errorMsg(errors.accountCode)}
          </div>
        </div>

        {/* Row 3: Account Number + Bank Name */}
        <div className="grid grid-cols-2 gap-6">
          <div className="flex flex-col">
            {fieldLabel("Account Number", true)}
            <FormInput
              type="text"
              name="accountNumber"
              value={formData.accountNumber}
              onChange={(e) => handleChange(e.target.value, "accountNumber")}
              placeholder="Account Number"
              error={errors.accountNumber}
              shouldShowError={!!errors.accountNumber}
              noLabel
            />
          </div>

          <div className="flex flex-col">
            {fieldLabel("Bank Name", true)}
            <FormInput
              type="text"
              name="bankName"
              value={formData.bankName}
              onChange={(e) => handleChange(e.target.value, "bankName")}
              placeholder="Bank Name"
              error={errors.bankName}
              shouldShowError={!!errors.bankName}
              noLabel
            />
          </div>
        </div>

        {/* Row 4: Currency Type + Opening Balance */}
        <div className="grid grid-cols-2 gap-6">
          <div className="flex flex-col">
            {fieldLabel("Currency Type", true)}
            <div className={errors.currencyType ? "border-2 border-red-500 rounded-lg" : ""}>
              <SearchableDropdown
                name="currencyType"
                value={formData.currencyType}
                onChange={(e) => handleChange(e.target.value, "currencyType")}
                placeholder="Select Currency"
                searchPlaceholder="Search currencies..."
                options={currencyOptions || []}
              />
            </div>
            {errorMsg(errors.currencyType)}
          </div>

          <div className="flex flex-col">
            {fieldLabel("Opening Balance", true)}
            <FormInput
              type="text"
              name="openingBalance"
              value={formData.openingBalance}
              onChange={(e) => handleChange(e.target.value, "openingBalance")}
              placeholder="Opening Balance"
              error={errors.openingBalance}
              shouldShowError={!!errors.openingBalance}
              noLabel
            />
          </div>
        </div>

        {/* Row 5: IBAN + Swift Code */}
        <div className="grid grid-cols-2 gap-6">
          <div className="flex flex-col">
            {fieldLabel("IBAN")}
            <FormInput
              type="text"
              name="iban"
              value={formData.iban}
              onChange={(e) => handleChange(e.target.value, "iban")}
              placeholder="IBAN"
              error={errors.iban}
              shouldShowError={!!errors.iban}
              noLabel
            />
          </div>

          <div className="flex flex-col">
            {fieldLabel("Swift Code", true)}
            <FormInput
              type="text"
              name="swiftCode"
              value={formData.swiftCode}
              onChange={(e) => handleChange(e.target.value, "swiftCode")}
              placeholder="Swift Code"
              error={errors.swiftCode}
              shouldShowError={!!errors.swiftCode}
              noLabel
            />
          </div>
        </div>

        {/* Bank Address — full width */}
        <div className="flex flex-col">
          {fieldLabel("Bank Address", true)}
          <div className={`border rounded-xl ${errors.bankAddress ? "border-2 border-red-500" : "border-gray-200"}`}>
            <ReactQuill
              value={formData.bankAddress}
              onChange={handleAddressChange}
              theme="snow"
              modules={{
                toolbar: [
                  [{ header: "1" }, { header: "2" }, { font: [] }],
                  [{ size: [] }],
                  ["bold", "italic", "underline", "strike", "blockquote"],
                  [{ list: "ordered" }, { list: "bullet" }, { indent: "-1" }, { indent: "+1" }],
                  ["link"],
                  ["clean"],
                ],
              }}
              formats={["header", "font", "size", "bold", "italic", "underline", "strike", "blockquote", "list", "bullet", "indent", "link"]}
              placeholder="Enter bank address"
            />
          </div>
          {errorMsg(errors.bankAddress)}
        </div>

        {/* Footer buttons */}
        <div className="flex justify-end gap-3 mt-8">
          <button
            type="button"
            onClick={() => history.push("/bank-management")}
            className="w-[133px] h-[40px] px-4 py-2 bg-[#F5F5F5] text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[var(--p-blue-dark)] transition-colors"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                Saving...
              </span>
            ) : "Save"}
          </button>
        </div>
      </form>
      </div>
    </RouteActionGate>
  );
};

export default AddBankAccount;
