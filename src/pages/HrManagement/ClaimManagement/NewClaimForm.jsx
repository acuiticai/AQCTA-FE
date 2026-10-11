"use client";

// NewClaimForm.jsx - Form for creating a new claim with multiple items
import { useEffect, useState, useContext, useRef } from "react";
import { PlusIcon, TrashIcon } from "@heroicons/react/outline";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

import axios from "axios";
import { useHistory } from "react-router-dom";
import { AdminContext } from "@/context/AdminContext";
import {
  CustomDatePicker,
  DropdownBasic,
  InputField,
  CurrencyDropdown,
} from "@/page-layouts/index";
import { notifyError, notifyWarning, notifySuccess } from "@/utils/toast";
import moment from "moment";
import SingleBusinessField from "@/components/SingleBusinessField";

const NewClaimForm = () => {
  const history = useHistory();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state || {};

  // Updated form structure for new schema
  const [formData, setFormData] = useState({
    claimReference: "",
    employee: "",
    employeeCode: "",
    claimGroup: "",
    company: "",
    items: [
      {
        claimType: "",
        receiptNo: "",
        receiptDate: "",
        receiptAmount: "",
        claimableAmount: "",
        currency: "",
        purpose: "",
        remarks: "",
        supportingDocuments: null,
      },
    ],
  });

  const formDataRef = useRef(formData);
  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  const [uploading, setUploading] = useState({});
  const [uploadSuccess, setUploadSuccess] = useState({});
  const [successMessages, setSuccessMessages] = useState({});
  const [employeeName, setEmployeeName] = useState("");
  const [errors, setErrors] = useState({});

  console.log("form data", formData);
  const [businesses, setBusinesses] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [claimTypes, setClaimTypes] = useState([]);

  // Total claimable amount state
  const [selectedTotalCurrency, setSelectedTotalCurrency] = useState("");
  const [currencies, setCurrencies] = useState([]);
  const [conversionSummary, setConversionSummary] = useState(null);
  const [isCalculatingConversion, setIsCalculatingConversion] = useState(false);

  // Fetch currencies when company changes
  useEffect(() => {
    const fetchCurrencies = async () => {
      if (!formData.company) {
        setCurrencies([]);
        return;
      }

      try {
        const response = await axios.get(
          `${Base_URL}/finance/currencies?business_id=${formData.company}`
        );
        setCurrencies(response.data.data || []);
      } catch (error) {
        console.error("Error fetching currencies:", error);
        setCurrencies([]);
      }
    };

    fetchCurrencies();
  }, [formData.company]);

  // Calculate total claimable amount using conversion rates from currencies API
  const calculateTotalClaimableAmount = () => {
    if (
      !selectedTotalCurrency ||
      !formData.items ||
      formData.items.length === 0 ||
      !currencies.length
    ) {
      setConversionSummary(null);
      return;
    }

    setIsCalculatingConversion(true);
    try {
      // Find the selected currency's conversion rate
      const selectedCurrencyData = currencies.find(
        (c) => c._id === selectedTotalCurrency
      );
      if (!selectedCurrencyData) {
        setConversionSummary(null);
        return;
      }

      // Group items by currency and sum amounts
      const currencyGroups = {};
      formData.items.forEach((item) => {
        if (item.currency && item.claimableAmount) {
          const currency = item.currency;
          if (!currencyGroups[currency]) {
            currencyGroups[currency] = 0;
          }
          currencyGroups[currency] += parseFloat(item.claimableAmount) || 0;
        }
      });

      // Calculate conversions using the conversion rates from the API
      const conversions = [];
      let totalConvertedAmount = 0;

      Object.entries(currencyGroups).forEach(([fromCurrency, amount]) => {
        const fromCurrencyData = currencies.find((c) => c._id === fromCurrency);
        if (fromCurrencyData) {
          // Calculate conversion using the rates from the API
          const fromRate = fromCurrencyData.conversion_rate_to_base;
          const toRate = selectedCurrencyData.conversion_rate_to_base;
          const convertedAmount = (amount * fromRate) / toRate;

          conversions.push({
            from: fromCurrencyData.symbol,
            to: selectedCurrencyData.symbol,
            originalAmount: amount,
            convertedAmount: convertedAmount,
            rate: fromRate / toRate,
          });

          totalConvertedAmount += convertedAmount;
        }
      });

      setConversionSummary({
        totalConvertedAmount: totalConvertedAmount,
        conversions: conversions,
        isRealTime: false,
        source: "Local conversion rates",
      });
    } catch (error) {
      console.error("Error calculating conversion:", error);
      setConversionSummary(null);
    } finally {
      setIsCalculatingConversion(false);
    }
  };

  // Calculate conversion when items or selected currency changes
  useEffect(() => {
    calculateTotalClaimableAmount();
  }, [formData.items, selectedTotalCurrency]);

  const validateForm = () => {
    const newErrors = {};
    const data = formDataRef.current;

    // Validate main form fields
    if (!data.employee) newErrors.employee = "Employee name is required";
    if (!data.employeeCode)
      newErrors.employeeCode = "Employee code is required";
    // if (!data.claimGroup) newErrors.claimGroup = "Claim Group is required"
    if (!data.company) newErrors.company = "Company is required";
    if (!data.items || data.items.length === 0) {
      newErrors.items = "At least one claim item is required";
    }

    // Validate each item
    data.items.forEach((item, index) => {
      const itemErrors = {};
      if (!item.claimType) itemErrors.claimType = "Claim type is required";
      if (!item.currency) itemErrors.currency = "Currency is required";
      if (!item.receiptNo) itemErrors.receiptNo = "Receipt No is required";
      if (!item.receiptDate)
        itemErrors.receiptDate = "Receipt date is required";
      if (!item.receiptAmount)
        itemErrors.receiptAmount = "Receipt amount is required";
      if (!item.claimableAmount)
        itemErrors.claimableAmount = "Claimable amount is required";
      if (!item.purpose) itemErrors.purpose = "Purpose/Description is required";
      // Supporting document is currently not required
      // if (!item.supportingDocuments) itemErrors.supportingDocuments = "Supporting document is required"

      if (Object.keys(itemErrors).length > 0) {
        newErrors[`item_${index}`] = itemErrors;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const fetchStaffList = async () => {
    try {
      const response = await axios.get(
        `${Base_URL}/staff-management/staff-names?page=1&limit=5000`,
        {
          params: {
            business: formData.company,
            status: "Active",
          },
        }
      );
      console.log("staff!", response);
      setStaffList(response.data.data || []);
    } catch (err) {
      console.log("err", err);
    }
  };

  useEffect(() => {
    setFormData((prev) => {
      const next = { ...prev, employee: "", employeeCode: "" };
      formDataRef.current = next;
      return next;
    });
    setStaffList([]); // Reset staff list when company changes
    if (formData.company) fetchStaffList();
  }, [formData.company]);

  useEffect(() => {
    setFormData((prev) => {
      const next = { ...prev, claimType: "" };
      formDataRef.current = next;
      return next;
    });
    setClaimTypes([]);

    if (formData.employee && formData.company) fetchClaimTypes();
  }, [formData.employee, formData.company]);

  // const fetchClaimGroups = async () => {
  //   try {
  //     const res = await axios.get(`${Base_URL}/claim-groups`, {params: { bid: formData.company }})
  //     setClaimGroups(res.data)
  //   } catch (error) {
  //     console.error("Error fetching data:", error)
  //   }
  // }

  const fetchClaimTypes = async () => {
    try {
      const claimGroupId =
        staffList.find((e) => e._id === formData.employee)?.claimGroup || "";
      const res = await axios.get(`${Base_URL}/claim-types`, {
        params: { bid: formData.company, claimGroup: claimGroupId },
      });
      setClaimTypes(res.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  useEffect(() => {
    const storedBusinesses = localStorage.getItem("businesses");
    if (storedBusinesses) {
      setBusinesses(JSON.parse(storedBusinesses));
    }
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      formDataRef.current = next;
      return next;
    });
  };

  // Handle changes for individual items
  const handleItemChange = (index, field, value) => {
    setFormData((prev) => {
      const updatedItems = [...prev.items];
      updatedItems[index] = {
        ...updatedItems[index],
        [field]: value,
      };
      const next = { ...prev, items: updatedItems };
      formDataRef.current = next;
      return next;
    });
  };

  // Add new item
  const addNewItem = () => {
    const newItem = {
      claimType: "",
      receiptNo: "",
      receiptDate: "",
      receiptAmount: "",
      claimableAmount: "",
      currency: "",
      purpose: "",
      remarks: "",
      supportingDocuments: null,
    };
    setFormData((prev) => {
      const next = {
        ...prev,
        items: [...prev.items, newItem],
      };
      formDataRef.current = next;
      return next;
    });
  };

  // Remove item
  const removeItem = (index) => {
    setFormData((prev) => {
      if (prev.items.length <= 1) return prev;
      const next = {
        ...prev,
        items: prev.items.filter((_, i) => i !== index),
      };
      formDataRef.current = next;
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      console.log("Form validation failed", errors);
      return;
    }

    const latest = formDataRef.current;
    console.log("formData -----", latest);
    const formattedData = {
      ...latest,
      adminId: adminInfo?.id,
      items: latest.items.map((item) => ({
        ...item,
        receiptDate: item.receiptDate
          ? moment(item.receiptDate).format("YYYY-MM-DD")
          : null,
      })),
    };

    try {
      const res = await axios.post(`${Base_URL}/claims`, {
        ...formattedData,
        adminId: adminInfo?.id,
      });
      notifySuccess("Claim created successfully.");
      setTimeout(() => {
        history.push("/claim-management");
      }, 1000);
    } catch (err) {
      const errorMsg =
        err.response?.data?.message ||
        "Something went wrong. Please try again.";
      notifyWarning(errorMsg);
    }
  };

  const handleCancel = () => {
    history.goBack();
  };

  const handleFileChange = async (e, itemIndex) => {
    const file = e.target.files[0];
    if (file) {
      // Start upload process
      setUploading((prev) => ({ ...prev, [itemIndex]: true }));
      setUploadSuccess((prev) => ({ ...prev, [itemIndex]: false }));

      // Prepare form data for upload
      const formDataForUpload = new FormData();
      const companyId = formDataRef.current.company;
      const businessIdStr = String(companyId?._id ?? companyId ?? "");
      formDataForUpload.append("file_path", `Claims/${employeeName}`);
      formDataForUpload.append("business_id", businessIdStr);
      formDataForUpload.append("customer_id", String(adminInfo?.id || ""));
      formDataForUpload.append("file_type", file.type);
      formDataForUpload.append("file_size", file.size);
      formDataForUpload.append("file", file);

      try {
        const response = await axios.post(
          `${Base_URL}/documents/uploadDocument`,
          formDataForUpload,
          {
            headers: { "Content-Type": "multipart/form-data" },
          }
        );

        const uploadedFile = response.data.file;
        const ok =
          response.data?.message === "File uploaded successfully" ||
          (uploadedFile &&
            (uploadedFile._id != null || uploadedFile.id != null));

        if (ok && uploadedFile) {
          const fileId = uploadedFile._id ?? uploadedFile.id;
          console.log(response.data.message || "File uploaded successfully!");

          // Update the specific item with the uploaded document information
          handleItemChange(itemIndex, "supportingDocuments", {
            fileId,
            name: uploadedFile.name,
            url: uploadedFile.url || "#",
            downloadUrl: uploadedFile.downloadUrl || "#",
            uploadedAt: new Date().toISOString(),
            size: file.size,
            type: file.type,
          });

          // Show success message in UI
          setSuccessMessages((prev) => ({
            ...prev,
            [itemIndex]:
              response.data.message || "File uploaded successfully!",
          }));
          setUploadSuccess((prev) => ({ ...prev, [itemIndex]: true }));

          // Auto-hide success message after 3 seconds
          setTimeout(() => {
            setUploadSuccess((prev) => ({ ...prev, [itemIndex]: false }));
            setSuccessMessages((prev) => ({ ...prev, [itemIndex]: "" }));
          }, 3000);
        } else {
          notifyError(
            response.data?.error ||
              "Upload did not return a file. Check business selection and try again."
          );
        }
      } catch (error) {
        console.error("File upload error:", error);
        notifyError(
          error.response?.data?.error ||
            "File upload failed. Please try again."
        );
      } finally {
        setUploading((prev) => ({ ...prev, [itemIndex]: false }));
      }
    }
  };

  const HandleOpenFile = async (documentId) => {
    console.log("document_id", documentId);
    try {
      const Response = await axios.get(
        `${Base_URL}/documents/getFileWithAllData/${documentId}`
      );
      console.log("document_id Response", Response);
      window.open(Response.data.data.url, "_blank");
    } catch (error) {
      notifyError("Error getting file");
      console.log("Error : ", error);
    }
  };

  const handleEmployeeChange = (e) => {
    const employee = staffList.find((staff) => staff._id === e.target.value);
    setFormData((prev) => {
      const next = {
        ...prev,
        employee: e.target.value,
        employeeCode: employee.employeeId,
      };
      formDataRef.current = next;
      return next;
    });

    setEmployeeName(employee.displayName);
  };

  return (
    <div className="p-6 bg-white">
      <h1 className="text-2xl font-semibold text-gray-800 mb-6">New Claim</h1>

      <form onSubmit={handleSubmit}>
        {/* Main Claim Information */}
        <div className="mb-8 p-4 bg-gray-50 rounded-lg">
          <h2 className="text-lg font-medium text-gray-800 mb-4">
            Claim Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Business Dropdown */}
            <SingleBusinessField
              selectedValue={formData.company}
              onAutoSelect={(id) =>
                handleChange({ target: { name: "company", value: id } })
              }
            >
              <label className="block text-gray-500 mb-1">Business</label>
              <div className="relative">
                <DropdownBasic
                  name="company"
                  type="select"
                  isBusinessDropdown={true}
                  businessDropdownProps={{
                    selectedBusiness: formData.company,
                    onChange: (val) =>
                      handleChange({ target: { name: "company", value: val } }),
                    placeholder: "Select Business",
                  }}
                />
              </div>
              <div className="min-h-6">
                {errors.company && (
                  <p className="text-red-500 text-sm mt-1 pb-2">
                    {errors.company}
                  </p>
                )}
              </div>
            </SingleBusinessField>

            {/* Employee Dropdown */}
            <div>
              <label className="block text-gray-500 mb-1">Employee Name</label>
              <div className="relative">
                <DropdownBasic
                  name="employee"
                  type="select"
                  options={staffList?.map((staff) => ({
                    value: staff._id,
                    label: staff.displayName,
                  }))}
                  value={formData.employee}
                  onChange={(selectedValue) => {
                    const employee = staffList.find(
                      (staff) => staff._id === selectedValue
                    );
                    if (employee) {
                      setFormData((prev) => {
                        const next = {
                          ...prev,
                          employee: selectedValue,
                          employeeCode: employee.employeeId,
                        };
                        formDataRef.current = next;
                        return next;
                      });

                      setEmployeeName(employee.displayName);
                    }
                  }}
                  placeholder="Select Employee"
                />
              </div>
              <div className="min-h-6">
                {errors.employee && (
                  <p className="text-red-500 text-sm mt-1 pb-2">
                    {errors.employee}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Employee Code */}
            <div>
              <label className="block text-gray-500 mb-1">Employee Code</label>
              <InputField
                type="text"
                name="employeeCode"
                placeholder="Employee Code"
                value={formData.employeeCode}
                onChange={handleChange}
                readOnly
              />
              <div className="min-h-6">
                {errors.employeeCode && (
                  <p className="text-red-500 text-sm mt-1 pb-2">
                    {errors.employeeCode}
                  </p>
                )}
              </div>
            </div>

            {/* Claim Group Dropdown */}
            {/* <div>
              <label className="block text-gray-500 mb-1">Claim Group</label>
              <div className="relative">
                <DropdownBasic
                  name="claimGroup"
                  type="select"
                  options={claimGroups?.map((group) => ({
                    value: group._id,
                    label: group.name,
                  }))}
                  value={formData.claimGroup}
                  onChange={(val) => handleChange({ target: { name: "claimGroup", value: val } })}
                  placeholder="Select Claim Group"
                />
              <div className="min-h-6">
                {errors.claimGroup && (
                  <p className="text-red-500 text-sm mt-1 pb-2">{errors.claimGroup}</p>
                )}
              </div>
              </div>
            </div> */}
          </div>
        </div>

        {/* Claim Items */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-gray-800">Claim Items</h2>
            {/* <button
              type="button"
              onClick={addNewItem}
              className="flex items-center px-4 py-2 bg-[var(--p-blue)] text-white rounded-md hover:bg-[#9BC635] transition-colors"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Item
            </button> */}
          </div>

          {formData.items.map((item, index) => (
            <div
              key={index}
              className="mb-6 p-4 border border-gray-200 rounded-lg bg-white"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-md font-medium text-gray-700">
                  Item {index + 1}
                </h3>
                {formData.items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="flex items-center px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
                  >
                    <TrashIcon className="h-4 w-4 mr-1" />
                    Remove
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-gray-500 mb-1">Claim Type</label>
                  <div className="relative">
                    <select
                      name={`claimType_${index}`}
                      className={`bg-gray-100 rounded-md px-4 py-2 w-full appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] ${
                        errors[`item_${index}`]?.claimType
                          ? "border-red-500"
                          : ""
                      }`}
                      value={item.claimType}
                      onChange={(e) =>
                        handleItemChange(index, "claimType", e.target.value)
                      }
                    >
                      <option value="">Select Claim Type</option>
                      {claimTypes?.map((type) => (
                        <option key={type._id} value={type._id}>
                          {type.type}
                        </option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <svg
                        className="h-5 w-5 text-gray-400"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  </div>
                  <div className="min-h-6">
                    {errors[`item_${index}`]?.claimType && (
                      <p className="text-red-500 text-sm mt-1 pb-2">
                        {errors[`item_${index}`].claimType}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-gray-500 mb-1">Currency</label>
                  <CurrencyDropdown
                    businessId={formData.company}
                    value={item.currency}
                    onChange={(currencyData) => {
                      handleItemChange(index, "currency", currencyData.value);
                      // Clear error when field is edited
                      if (errors[`item_${index}`]?.currency) {
                        const newErrors = { ...errors };
                        if (newErrors[`item_${index}`]) {
                          newErrors[`item_${index}`] = {
                            ...newErrors[`item_${index}`],
                            currency: "",
                          };
                        }
                        setErrors(newErrors);
                      }
                    }}
                    placeholder="Select Currency"
                    isDisabled={!formData.company}
                    shouldShowError={!!errors[`item_${index}`]?.currency}
                    error={errors[`item_${index}`]?.currency}
                  />
                  {/* <div className="min-h-6">
                    {errors[`item_${index}`]?.currency && (
                      <p className="text-red-500 text-sm mt-1 pb-2">
                        {errors[`item_${index}`].currency}
                      </p>
                    )}
                  </div> */}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-gray-500 mb-1">
                    Receipt No.
                  </label>
                  <input
                    type="text"
                    name={`receiptNo_${index}`}
                    className={`bg-gray-100 rounded-md px-4 py-2 w-full focus:outline-none ${
                      errors[`item_${index}`]?.receiptNo
                        ? "border border-red-500"
                        : ""
                    }`}
                    placeholder="Receipt No."
                    value={item.receiptNo}
                    onChange={(e) =>
                      handleItemChange(index, "receiptNo", e.target.value)
                    }
                  />
                  <div className="min-h-6">
                    {errors[`item_${index}`]?.receiptNo && (
                      <p className="text-red-500 text-sm mt-1 pb-2">
                        {errors[`item_${index}`].receiptNo}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-gray-500 mb-1">
                    Receipt Date
                  </label>
                  <div className="relative">
                    <CustomDatePicker
                      name={`receiptDate_${index}`}
                      className={`bg-gray-100 rounded-md px-4 py-2 w-full focus:outline-none ${
                        errors[`item_${index}`]?.receiptDate
                          ? "border border-red-500"
                          : ""
                      }`}
                      placeholder="mm/dd/yyyy"
                      value={item.receiptDate}
                      bgColor="#F3F4F6"
                      onChange={(date) =>
                        handleItemChange(index, "receiptDate", date)
                      }
                    />
                  </div>
                  <div className="min-h-6">
                    {errors[`item_${index}`]?.receiptDate && (
                      <p className="text-red-500 text-sm mt-1 pb-2">
                        {errors[`item_${index}`].receiptDate}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-gray-500 mb-1">
                    Receipt Amount
                  </label>
                  <input
                    type="number"
                    min={1}
                    name={`receiptAmount_${index}`}
                    className={`bg-gray-100 rounded-md px-4 py-2 w-full focus:outline-none ${
                      errors[`item_${index}`]?.receiptAmount
                        ? "border border-red-500"
                        : ""
                    }`}
                    placeholder="Receipt Amount"
                    value={item.receiptAmount}
                    onChange={(e) =>
                      handleItemChange(index, "receiptAmount", e.target.value)
                    }
                  />
                  <div className="min-h-6">
                    {errors[`item_${index}`]?.receiptAmount && (
                      <p className="text-red-500 text-sm mt-1 pb-2">
                        {errors[`item_${index}`].receiptAmount}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-gray-500 mb-1">
                    Claimable Amount
                  </label>
                  <input
                    type="number"
                    min={1}
                    name={`claimableAmount_${index}`}
                    className={`bg-gray-100 rounded-md px-4 py-2 w-full focus:outline-none ${
                      errors[`item_${index}`]?.claimableAmount
                        ? "border border-red-500"
                        : ""
                    }`}
                    placeholder="Claimable Amount"
                    value={item.claimableAmount}
                    onChange={(e) =>
                      handleItemChange(index, "claimableAmount", e.target.value)
                    }
                  />
                  <div className="min-h-6">
                    {errors[`item_${index}`]?.claimableAmount && (
                      <p className="text-red-500 text-sm mt-1 pb-2">
                        {errors[`item_${index}`].claimableAmount}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-gray-500 mb-1">
                    Purpose/Description <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name={`purpose_${index}`}
                    className={`bg-gray-100 rounded-md px-4 py-2 w-full focus:outline-none ${
                      errors[`item_${index}`]?.purpose
                        ? "border border-red-500"
                        : ""
                    }`}
                    placeholder="Purpose/Description"
                    value={item.purpose}
                    onChange={(e) =>
                      handleItemChange(index, "purpose", e.target.value)
                    }
                  />
                  <div className="min-h-6">
                    {errors[`item_${index}`]?.purpose && (
                      <p className="text-red-500 text-sm mt-1 pb-2">
                        {errors[`item_${index}`].purpose}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-gray-500 mb-1">
                    Remarks (Optional)
                  </label>
                  <input
                    type="text"
                    name={`remarks_${index}`}
                    className="bg-gray-100 rounded-md px-4 py-3 w-full focus:outline-none"
                    placeholder="Additional remarks"
                    value={item.remarks}
                    onChange={(e) =>
                      handleItemChange(index, "remarks", e.target.value)
                    }
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-gray-500 mb-1">
                  Supporting Documents
                </label>
                <div
                  className={`border border-dashed rounded-md p-6 flex flex-col items-center justify-center ${
                    errors[`item_${index}`]?.supportingDocuments
                      ? "border-red-500"
                      : "border-[var(--p-blue)]"
                  }`}
                >
                  <button
                    type="button"
                    className="flex items-center text-[var(--p-blue)]"
                    onClick={() =>
                      document.getElementById(`fileUpload_${index}`).click()
                    }
                  >
                    <svg
                      className="h-6 w-6 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                      />
                    </svg>
                    <span className="text-[var(--p-blue)]">
                      {uploading[index]
                        ? "Uploading..."
                        : "Upload Supporting Documents (Optional)"}
                    </span>
                  </button>
                  <input
                    id={`fileUpload_${index}`}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFileChange(e, index)}
                  />

                  {/* Display upload status */}
                  {uploadSuccess[index] && (
                    <div className="mt-2 text-sm text-green-600">
                      {successMessages[index]}
                    </div>
                  )}

                  {/* Display uploaded document info if available */}
                  {item.supportingDocuments && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-md w-full">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">
                          {item.supportingDocuments.name}
                        </span>
                        <div className="flex space-x-2">
                          <button
                            type="button"
                            onClick={() =>
                              HandleOpenFile(item.supportingDocuments.fileId)
                            }
                            className="text-xs text-blue-600 hover:underline"
                          >
                            View
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="min-h-6">
                  {errors[`item_${index}`]?.supportingDocuments && (
                    <p className="text-red-500 text-sm mt-1 pb-2">
                      {errors[`item_${index}`].supportingDocuments}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}

          {errors.items && (
            <p className="text-red-500 text-sm mt-1 pb-2">{errors.items}</p>
          )}
        </div>

        <button
          type="button"
          onClick={addNewItem}
          className="mb-6 w-full h-24 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-[var(--p-blue)] text-[var(--p-blue)] rounded-md hover:bg-[#fafafa6b] transition-all duration-200"
        >
          <PlusIcon className="h-8 w-8" />
          <span className="text-sm font-medium">Add Item</span>
        </button>

        {/* Professional Total Claimable Amount Section */}
        <div className="mb-6 bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">
              Total Claimable Amount
            </h2>
            <p className="text-sm text-gray-600">
              View the total claimable amount converted to your selected
              currency
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {/* Currency Selection */}
            <div className="lg:col-span-1">
              {/* <label className="block text-sm font-medium text-gray-700 mb-2">
                 Display Currency
               </label> */}
              <CurrencyDropdown
                businessId={formData.company}
                value={selectedTotalCurrency}
                onChange={(currencyData) =>
                  setSelectedTotalCurrency(currencyData.value)
                }
                placeholder="Select Currency"
                isDisabled={!formData.company}
                shouldShowError={false}
                error=""
                showConversionRate={true}
              />
              {/* Information Note */}
              <div className="mt-4 p-4 min-h-[144px] bg-[var(--p-blue)]/5 border border-[var(--p-blue)]/20 rounded-lg">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-[var(--p-blue)]"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-gray-700">
                      <strong>Note:</strong> This is a read-only section for
                      viewing the total claimable amount in different
                      currencies. This information is for display purposes only
                      and does not modify the original claim data.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Conversion Summary */}
            <div className="lg:col-span-2">
              {isCalculatingConversion ? (
                <div className="flex items-center justify-center h-20">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--p-blue)]"></div>
                  <span className="ml-3 text-gray-600">
                    Calculating conversion...
                  </span>
                </div>
              ) : conversionSummary ? (
                <div className="space-y-4">
                  {/* Total Amount */}
                  <div className="bg-gray-50 rounded-lg px-4 py-1 border border-gray-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-600">
                        Total Amount
                      </span>
                      <span className="text-xl font-bold text-gray-900">
                        {conversionSummary.totalConvertedAmount?.toFixed(2) ||
                          "0.00"}{" "}
                        {currencies.find((c) => c._id === selectedTotalCurrency)
                          ?.symbol || selectedTotalCurrency}
                      </span>
                    </div>
                  </div>

                  {/* Conversion Breakdown */}
                  <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">
                      Conversion Breakdown
                    </h4>
                    <div className="space-y-3">
                      {conversionSummary.conversions?.map(
                        (conversion, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between text-sm px-4 py-1 bg-white rounded border border-gray-100"
                          >
                            <div className="flex items-center space-x-2">
                              <span className="font-medium text-gray-700">
                                {conversion.from}
                              </span>
                              <span className="text-gray-400">→</span>
                              <span className="font-medium text-gray-700">
                                {conversion.to}
                              </span>
                            </div>
                            <div className="text-right">
                              <div className="font-medium text-gray-900">
                                {conversion.originalAmount?.toFixed(2)} →{" "}
                                {conversion.convertedAmount?.toFixed(2)}
                              </div>
                              <div className="text-xs text-gray-500">
                                Rate: {conversion.rate?.toFixed(4)}
                              </div>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>
              ) : selectedTotalCurrency ? (
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="text-center text-gray-500">
                    <div className="text-2xl font-bold text-gray-400 mb-2">
                      0.00
                    </div>
                    <div className="text-sm">
                      No claimable amounts to convert
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
                  <div className="text-center text-gray-500">
                    <div className="text-sm">
                      Select a currency to view conversion
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-4">
          <button
            type="button"
            className="bg-gray-200 text-gray-800 px-6 py-2 rounded-md hover:bg-gray-300 transition-colors"
            onClick={handleCancel}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="bg-[var(--p-blue)] text-white px-6 py-2 rounded-md hover:bg-[#9BC635] transition-colors"
          >
            Save Claim
          </button>
        </div>
      </form>
    </div>
  );
};

export default NewClaimForm;
