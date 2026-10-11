import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  FiChevronLeft,
  FiChevronRight,
  FiCalendar,
  FiEye,
  FiX,
  FiUpload,
  FiSearch,
} from "react-icons/fi";
import { useHistory, useLocation } from "react-router-dom";
import useAsync from "@/hooks/useAsync";
import CustomDatePicker from "@/components/CustomDatePicker";
import BankManagementServices from "@/services/BankManagementServices";
import AdminServices from "@/services/AdminServices";
import { PageHeader } from "@/page-layouts/index";
import SearchableDropdown from "@/components/SearchableDropdown";
import SingleBusinessField from "@/components/SingleBusinessField";
import {
  isSingleAssignedBusiness,
  readAssignedBusinessesFallback,
} from "@/utils/sessionAssignedBusinesses";
import { notifyError, notifySuccess } from "@/utils/toast";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const AddLedger = () => {
  const location = useLocation();
  // Extract type from URL
  const queryParams = new URLSearchParams(location.search);
  const urlTypeParam = queryParams.get("type")?.toLowerCase();

  // Map URL parameter to transaction type
  const getTransactionType = (param) => {
    switch (param) {
      case "expense":
        return "Expense";
      case "inflow":
        return "Inflow";
      case "outflow":
        return "Outflow";
      case "income":
      default:
        return "Income";
    }
  };

  const urlType = getTransactionType(urlTypeParam);
  const {
    data: { accounts: bankAccounts, loading, error },
  } = useAsync(BankManagementServices.getAllAccounts);
  const { data: staff } = useAsync(AdminServices.getAllStaff);
  const [customers, setCustomers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [salesContracts, setSalesContracts] = useState([]);
  const [purchaseContracts, setPurchaseContracts] = useState([]);
  const [currencies, setCurrencies] = useState([]);

  console.log("customers", customers);
  console.log("vendors", vendors);
  console.log("bank accounts", bankAccounts);
  console.log("staff", staff);
  console.log("sales contracts", salesContracts);
  console.log("purchase contracts", purchaseContracts);

  const [formData, setFormData] = useState({
    business: "",
    reference: "",
    type: urlType,
    bankAccountId: "",
    amount: "",
    currency: "USD",
    date: "",
    description: "",
    category: "",
    customerId: "",
    vendorId: "",
    staffId: "",
    salesContractId: "",
    purchaseContractId: "",
    status: "Pending",
    documents: [],
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const history = useHistory();
  const isSingleBusiness = isSingleAssignedBusiness();
  const awaitingBusinessPlaceholder = isSingleBusiness
    ? "Loading…"
    : "Select business first";

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Clear error when field is edited
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  // Handle blur validation for real-time feedback
  const handleBlur = (name, value) => {
    const tempErrors = { ...errors };

    switch (name) {
      case "business":
        if (!value || !value.trim()) {
          tempErrors.business = "Business is required";
        } else {
          delete tempErrors.business;
        }
        break;
      case "reference":
        if (!value || !value.trim()) {
          tempErrors.reference = "Transaction Reference # is required";
        } else {
          delete tempErrors.reference;
        }
        break;
      case "bankAccountId":
        if (!value || !value.trim()) {
          tempErrors.bankAccountId = "Bank Account ID is required";
        } else {
          delete tempErrors.bankAccountId;
        }
        break;
      case "amount":
        if (!value || !value.toString().trim()) {
          tempErrors.amount = "Amount is required";
        } else if (isNaN(parseFloat(value))) {
          tempErrors.amount = "Amount must be a valid number";
        } else if (parseFloat(value) <= 0) {
          tempErrors.amount = "Amount must be greater than 0";
        } else {
          delete tempErrors.amount;
        }
        break;
      case "currency":
        if (!value || !value.trim()) {
          tempErrors.currency = "Currency is required";
        } else {
          delete tempErrors.currency;
        }
        break;
      case "date":
        if (!value || !value.toString().trim()) {
          tempErrors.date = "Date is required";
        } else {
          delete tempErrors.date;
        }
        break;
      case "description":
        if (!value || !value.trim()) {
          tempErrors.description = "Description is required";
        } else {
          delete tempErrors.description;
        }
        break;
      case "category":
        if (!value || !value.trim()) {
          tempErrors.category = "Category is required";
        } else {
          delete tempErrors.category;
        }
        break;
      case "status":
        if (!value || !value.trim()) {
          tempErrors.status = "Transaction Status is required";
        } else {
          delete tempErrors.status;
        }
        break;
      default:
        break;
    }

    setErrors(tempErrors);
  };

  const handleDateChange = useCallback(
    (key, value) => {
      setFormData((prevState) => ({
        ...prevState,
        [key]: value,
      }));

      // Clear error when field is edited
      if (errors[key]) {
        setErrors((prev) => ({
          ...prev,
          [key]: "",
        }));
      }
    },
    [errors]
  );

  const handleRadioChange = (value) => {
    setFormData((prev) => ({ ...prev, type: value }));
    // Clear error when transaction type is changed
    if (errors.type) {
      setErrors((prev) => ({
        ...prev,
        type: "",
      }));
    }
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    setFormData((prev) => ({
      ...prev,
      documents: [
        ...prev.documents,
        ...files.map((file) => ({
          name: file.name,
          file,
        })),
      ],
    }));
  };

  const validateForm = () => {
    let tempErrors = {};
    let isValid = true;

    if (
      !formData.business ||
      formData.business === "" ||
      (typeof formData.business === "string" && !formData.business.trim())
    ) {
      tempErrors.business = "Business is required";
      isValid = false;
    }

    if (!formData.reference || !formData.reference.trim()) {
      tempErrors.reference = "Transaction Reference # is required";
      isValid = false;
    }

    if (!formData.type || !formData.type.trim()) {
      tempErrors.type = "Transaction Type is required";
      isValid = false;
    }

    if (!formData.bankAccountId || !formData.bankAccountId.trim()) {
      tempErrors.bankAccountId = "Bank Account ID is required";
      isValid = false;
    }

    if (!formData.amount || !formData.amount.toString().trim()) {
      tempErrors.amount = "Amount is required";
      isValid = false;
    } else if (isNaN(parseFloat(formData.amount))) {
      tempErrors.amount = "Amount must be a valid number";
      isValid = false;
    } else if (parseFloat(formData.amount) <= 0) {
      tempErrors.amount = "Amount must be greater than 0";
      isValid = false;
    }

    if (!formData.currency || !formData.currency.trim()) {
      tempErrors.currency = "Currency is required";
      isValid = false;
    } else if (
      currencies.length > 0 &&
      !currencies.some((c) => c.symbol === formData.currency)
    ) {
      // Validate that selected currency exists in the business's currency list
      tempErrors.currency = "Please select a valid currency for this business";
      isValid = false;
    }

    if (!formData.date || !formData.date.toString().trim()) {
      tempErrors.date = "Date is required";
      isValid = false;
    }

    if (!formData.description || !formData.description.trim()) {
      tempErrors.description = "Description is required";
      isValid = false;
    }

    if (!formData.category || !formData.category.trim()) {
      tempErrors.category = "Category is required";
      isValid = false;
    }

    if (!formData.status || !formData.status.trim()) {
      tempErrors.status = "Transaction Status is required";
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

    const formDataToSend = new FormData();

    // Append all text fields
    Object.keys(formData).forEach((key) => {
      if (key !== "documents") {
        formDataToSend.append(key, formData[key]);
      }
    });

    // Append documents
    formData.documents.forEach((doc) => {
      formDataToSend.append("documents", doc.file);
    });

    try {
      await axios.post(`${Base_URL}/ledger-management/add`, formDataToSend, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      notifySuccess("Ledger entry added successfully");
      history.push("/ledger-management");
    } catch (error) {
      console.error("Failed to add ledger entry:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to add ledger entry";
      notifyError(errorMessage);
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    history.push("/ledger-management");
  };

  const removeDocument = (index) => {
    setFormData((prev) => ({
      ...prev,
      documents: prev.documents.filter((_, i) => i !== index),
    }));
  };

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const response = await axios.get(`${Base_URL}/customers`);
        setCustomers(response.data.customers);
      } catch (error) {
        console.error("Failed to fetch customers:", error);
      }
    };

    const fetchVendors = async () => {
      try {
        const response = await axios.get(`${Base_URL}/vendors`);
        setVendors(response.data.data);
      } catch (error) {
        console.error("Failed to fetch vendors:", error);
      }
    };

    const list = readAssignedBusinessesFallback();
    setBusinesses(list);

    const fetchSalesContract = async () => {
      try {
        const response = await axios.get(`${Base_URL}/sales-contracts`);
        setSalesContracts(response.data.contracts);
      } catch (error) {
        console.error("Failed to fetch vendors:", error);
      }
    };

    const fetchPurchaseContract = async () => {
      try {
        const response = await axios.get(`${Base_URL}/contracts/contracts`);
        setPurchaseContracts(response.data);
      } catch (error) {
        console.error("Failed to fetch vendors:", error);
      }
    };

    fetchCustomers();
    fetchVendors();
    fetchSalesContract();
    fetchPurchaseContract();
  }, []);

  // Fetch currencies dynamically when business is selected (like AddBankAccount)
  useEffect(() => {
    const fetchCurrencies = async () => {
      if (formData?.business) {
        try {
          console.log("Fetching currencies for business:", formData.business);
          const response = await axios.get(
            `${Base_URL}/finance/currencies?business_id=${formData?.business}`
          );
          console.log("Currency response:", response.data);
          setCurrencies(response.data.data || []);

          // Reset currency if current currency is not in the new list
          if (formData.currency && formData.currency !== "USD") {
            const currencySymbols = (response.data.data || []).map(
              (c) => c.symbol
            );
            if (!currencySymbols.includes(formData.currency)) {
              setFormData((prev) => ({ ...prev, currency: "USD" }));
            }
          }
        } catch (error) {
          console.error("Error fetching currencies:", error);
          setCurrencies([]);
        }
      } else {
        setCurrencies([]);
        // Reset currency to USD when business is cleared
        if (formData.currency && formData.currency !== "USD") {
          setFormData((prev) => ({ ...prev, currency: "USD" }));
        }
      }
    };
    fetchCurrencies();
  }, [formData?.business]);

  // Prepare currency dropdown options from fetched currencies (like AddBankAccount)
  const currencyOptions =
    currencies.length > 0
      ? currencies.map((currency) => ({
          value: currency.symbol,
          label: `${currency.symbol} (${currency.prefix})`,
          conversionRate: currency.conversion_rate_to_base,
        }))
      : [
          // Default fallback if no currencies are loaded
          { value: "USD", label: "USD" },
        ];

  return (
    <div className="container px-6 py-8">
      <PageHeader
        title="Add Ledger"
        showBackButton={true}
        onBackClick={() => history.push("ledger-management")}
      />

      <form onSubmit={handleSubmit} className="mt-6">
        {/* Business Selection - Added from AddAccount component */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <SingleBusinessField
            selectedValue={formData.business}
            onAutoSelect={(id) => {
              setFormData((prev) => ({
                ...prev,
                business: id,
                currency: "USD",
                bankAccountId: "",
              }));
            }}
          >
          <div>
            <label className="block text-sm text-gray-600 mb-2">
              Business <span className="text-red-500">*</span>
            </label>
            <div
              className={
                errors.business ? "border-2 border-red-500 rounded-lg" : ""
              }
            >
              <SearchableDropdown
                name="business"
                value={formData.business}
                onChange={(e) => {
                  handleChange(e);
                  // Clear currency and bank account when business changes
                  if (e.target.value !== formData.business) {
                    setFormData((prev) => ({
                      ...prev,
                      business: e.target.value,
                      currency: "USD",
                      bankAccountId: "",
                    }));
                    // Clear related errors
                    setErrors((prev) => {
                      const newErrors = { ...prev };
                      delete newErrors.currency;
                      delete newErrors.bankAccountId;
                      return newErrors;
                    });
                  }
                }}
                onBlur={() => handleBlur("business", formData.business)}
                placeholder="Select Business"
                searchPlaceholder="Search businesses..."
                options={
                  businesses?.map((business) => ({
                    value: business._id,
                    label: business.name,
                  })) || []
                }
              />
            </div>
            {errors.business && (
              <p className="text-red-500 text-sm mt-1">{errors.business}</p>
            )}
          </div>
          </SingleBusinessField>

          <div>
            <label className="block text-sm text-gray-600 mb-2">
              Transaction Reference # <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="reference"
              placeholder="Transaction Reference #"
              className={`w-full bg-gray-100 rounded-md py-3 px-4 focus:outline-none ${
                errors.reference ? "border-2 border-red-500" : ""
              }`}
              value={formData.reference}
              onChange={handleChange}
              onBlur={(e) => handleBlur("reference", e.target.value)}
            />
            {errors.reference && (
              <p className="text-red-500 text-sm mt-1">{errors.reference}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm text-gray-600 mb-2">
              Transaction Type <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  className="hidden"
                  name="type"
                  checked={formData.type === "Income"}
                  onChange={() => handleRadioChange("Income")}
                />
                <span
                  className={`flex items-center justify-center w-5 h-5 rounded-full border ${
                    formData.type === "Income"
                      ? "bg-[var(--p-blue)] border-[var(--p-blue)]"
                      : "border-gray-300"
                  } mr-2`}
                >
                  {formData.type === "Income" && (
                    <span className="w-2 h-2 bg-white rounded-full"></span>
                  )}
                </span>
                Income
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  className="hidden"
                  name="type"
                  checked={formData.type === "Expense"}
                  onChange={() => handleRadioChange("Expense")}
                />
                <span
                  className={`flex items-center justify-center w-5 h-5 rounded-full border ${
                    formData.type === "Expense"
                      ? "bg-[var(--p-blue)] border-[var(--p-blue)]"
                      : "border-gray-300"
                  } mr-2`}
                >
                  {formData.type === "Expense" && (
                    <span className="w-2 h-2 bg-white rounded-full"></span>
                  )}
                </span>
                Expense
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  className="hidden"
                  name="type"
                  checked={formData.type === "Inflow"}
                  onChange={() => handleRadioChange("Inflow")}
                />
                <span
                  className={`flex items-center justify-center w-5 h-5 rounded-full border ${
                    formData.type === "Inflow"
                      ? "bg-[var(--p-blue)] border-[var(--p-blue)]"
                      : "border-gray-300"
                  } mr-2`}
                >
                  {formData.type === "Inflow" && (
                    <span className="w-2 h-2 bg-white rounded-full"></span>
                  )}
                </span>
                Inflow
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  className="hidden"
                  name="type"
                  checked={formData.type === "Outflow"}
                  onChange={() => handleRadioChange("Outflow")}
                />
                <span
                  className={`flex items-center justify-center w-5 h-5 rounded-full border ${
                    formData.type === "Outflow"
                      ? "bg-[var(--p-blue)] border-[var(--p-blue)]"
                      : "border-gray-300"
                  } mr-2`}
                >
                  {formData.type === "Outflow" && (
                    <span className="w-2 h-2 bg-white rounded-full"></span>
                  )}
                </span>
                Outflow
              </label>
            </div>
            {errors.type && (
              <p className="text-red-500 text-sm mt-1">{errors.type}</p>
            )}
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-2">
              Bank Account ID <span className="text-red-500">*</span>
            </label>
            <div
              className={
                errors.bankAccountId ? "border-2 border-red-500 rounded-lg" : ""
              }
            >
              <SearchableDropdown
                name="bankAccountId"
                value={formData.bankAccountId}
                onChange={handleChange}
                onBlur={() =>
                  handleBlur("bankAccountId", formData.bankAccountId)
                }
                placeholder="Bank Account ID"
                searchPlaceholder="Search bank accounts..."
                options={
                  bankAccounts?.length > 0
                    ? bankAccounts?.map((account) => ({
                        value: account._id,
                        label: account.accountName,
                      }))
                    : []
                }
              />
            </div>
            {errors.bankAccountId && (
              <p className="text-red-500 text-sm mt-1">
                {errors.bankAccountId}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm text-gray-600 mb-2">
              Amount <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="amount"
              placeholder="Amount"
              className={`w-full bg-gray-100 rounded-md py-3 px-4 focus:outline-none ${
                errors.amount ? "border-2 border-red-500" : ""
              }`}
              value={formData.amount}
              onChange={handleChange}
              onBlur={(e) => handleBlur("amount", e.target.value)}
            />
            {errors.amount && (
              <p className="text-red-500 text-sm mt-1">{errors.amount}</p>
            )}
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-2">
              Currency <span className="text-red-500">*</span>
            </label>
            <div
              className={
                errors.currency ? "border-2 border-red-500 rounded-lg" : ""
              }
            >
              <SearchableDropdown
                name="currency"
                value={formData.currency}
                onChange={handleChange}
                onBlur={() => handleBlur("currency", formData.currency)}
                placeholder={
                  !formData.business
                    ? awaitingBusinessPlaceholder
                    : currencyOptions.length > 0
                    ? "Select Currency"
                    : "No currencies available"
                }
                searchPlaceholder="Search currencies..."
                disabled={!formData.business || currencyOptions.length === 0}
                options={currencyOptions}
              />
            </div>
            {errors.currency && (
              <p className="text-red-500 text-sm mt-1">{errors.currency}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm text-gray-600 mb-2">
              Date <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div
                className={
                  errors.date ? "border-2 border-red-500 rounded-lg" : ""
                }
              >
                <CustomDatePicker
                  value={formData.date}
                  onChange={(date) => {
                    handleDateChange("date", date);
                    // Validate date on change
                    if (date && date.toString().trim()) {
                      setErrors((prev) => {
                        const newErrors = { ...prev };
                        delete newErrors.date;
                        return newErrors;
                      });
                    }
                  }}
                  bgColor="#F3F4F6"
                />
              </div>
            </div>
            {errors.date && (
              <p className="text-red-500 text-sm mt-1">{errors.date}</p>
            )}
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-2">
              Description <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="description"
              placeholder="Description"
              className={`w-full bg-gray-100 rounded-md py-3 px-4 focus:outline-none ${
                errors.description ? "border-2 border-red-500" : ""
              }`}
              value={formData.description}
              onChange={handleChange}
              onBlur={(e) => handleBlur("description", e.target.value)}
            />
            {errors.description && (
              <p className="text-red-500 text-sm mt-1">{errors.description}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm text-gray-600 mb-2">
              {formData.type === "Income"
                ? "Associated Income Category"
                : formData.type === "Expense"
                ? "Associated Expense Category"
                : formData.type === "Inflow"
                ? "Associated Inflow Category"
                : "Associated Outflow Category"}{" "}
              <span className="text-red-500">*</span>
            </label>
            <div
              className={
                errors.category ? "border-2 border-red-500 rounded-lg" : ""
              }
            >
              <SearchableDropdown
                name="category"
                value={formData.category}
                onChange={handleChange}
                onBlur={() => handleBlur("category", formData.category)}
                placeholder={`Select ${
                  formData.type === "Income"
                    ? "Income"
                    : formData.type === "Expense"
                    ? "Expense"
                    : formData.type === "Inflow"
                    ? "Inflow"
                    : "Outflow"
                } Category`}
                searchPlaceholder="Search categories..."
                options={[
                  { value: "Sales", label: "Sales" },
                  { value: "Services", label: "Services" },
                  { value: "Supplies", label: "Supplies" },
                  { value: "Utilities", label: "Utilities" },
                  { value: "Rent", label: "Rent" },
                ]}
              />
            </div>
            {errors.category && (
              <p className="text-red-500 text-sm mt-1">{errors.category}</p>
            )}
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-2">
              Customer ID (optional)
            </label>
            <SearchableDropdown
              name="customerId"
              value={formData.customerId}
              onChange={handleChange}
              placeholder="Customer ID"
              searchPlaceholder="Search customers..."
              options={
                customers?.length > 0
                  ? customers?.map((customer) => ({
                      value: customer._id,
                      label: customer?.basicInformation?.companyName,
                    }))
                  : []
              }
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm text-gray-600 mb-2">
              Vendor ID (optional)
            </label>
            <SearchableDropdown
              name="vendorId"
              value={formData.vendorId}
              onChange={handleChange}
              placeholder="Vendor ID"
              searchPlaceholder="Search vendors..."
              options={vendors.map((vendor) => ({
                value: vendor._id,
                label: vendor.basicInformation?.companyName,
              }))}
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-2">
              Staff ID (optional)
            </label>
            <SearchableDropdown
              name="staffId"
              value={formData.staffId}
              onChange={handleChange}
              placeholder="Staff ID"
              searchPlaceholder="Search staff..."
              options={staff.map((staffMember) => ({
                value: staffMember._id,
                label: staffMember?.name,
              }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm text-gray-600 mb-2">
              Sales Contract ID (optional)
            </label>
            <SearchableDropdown
              name="salesContractId"
              value={formData.salesContractId}
              onChange={handleChange}
              placeholder="Sales Contract ID"
              searchPlaceholder="Search sales contracts..."
              options={salesContracts.map((salesContract) => ({
                value: salesContract._id,
                label: salesContract?.basicInfo?.buyerCompanyName,
              }))}
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-2">
              Purchase Contract ID (optional)
            </label>
            <SearchableDropdown
              name="purchaseContractId"
              value={formData.purchaseContractId}
              onChange={handleChange}
              placeholder="Purchase Contract ID"
              searchPlaceholder="Search purchase contracts..."
              options={purchaseContracts.map((purchaseContract) => ({
                value: purchaseContract._id,
                label: purchaseContract?.basicInfo?.purchasingCompany,
              }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm text-gray-600 mb-2">
              Transaction Status <span className="text-red-500">*</span>
            </label>
            <div
              className={
                errors.status ? "border-2 border-red-500 rounded-lg" : ""
              }
            >
              <SearchableDropdown
                name="status"
                value={formData.status}
                onChange={handleChange}
                onBlur={() => handleBlur("status", formData.status)}
                placeholder="Select Status"
                searchPlaceholder="Search status..."
                options={[
                  { value: "Pending", label: "Pending" },
                  { value: "Paid", label: "Paid" },
                  { value: "Cancelled", label: "Cancelled" },
                ]}
              />
            </div>
            {errors.status && (
              <p className="text-red-500 text-sm mt-1">{errors.status}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm text-gray-600 mb-2">
              Support Documents
            </label>
            <div className="mt-2">
              <button
                type="button"
                onClick={() =>
                  document.getElementById("documentUpload").click()
                }
                className="border border-[var(--p-blue)] border-dashed rounded-md p-4 w-full flex flex-col items-center justify-center"
              >
                <FiUpload className="text-[var(--p-blue)] text-xl mb-2" />
                <span className="text-gray-500">Upload Support Documents</span>
              </button>
              <input
                id="documentUpload"
                type="file"
                multiple
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>

            {formData.documents.length > 0 && (
              <div className="mt-4">
                <div className="flex flex-wrap gap-3">
                  {formData.documents.map((doc, index) => (
                    <div
                      key={index}
                      className="bg-gray-100 rounded-md p-2 flex items-center justify-between"
                    >
                      <div className="flex items-center">
                        <div className="h-8 w-8 bg-red-500 rounded flex items-center justify-center text-white text-xs mr-2">
                          PDF
                        </div>
                        <span className="text-sm">{doc.name}</span>
                      </div>
                      <button
                        type="button"
                        className="text-gray-600 hover:text-gray-900 ml-2"
                        onClick={() => removeDocument(index)}
                      >
                        <FiX size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-4 mt-8">
          <button
            type="button"
            onClick={handleCancel}
            className="px-6 py-3 bg-gray-200 hover:bg-gray-300 rounded-md text-gray-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-6 py-3 bg-[var(--p-blue)] hover:bg-[#9BBE29] rounded-md text-white disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddLedger;
