"use client";

import { useEffect, useState, useContext, useRef } from "react";
import { PlusIcon, TrashIcon } from "@heroicons/react/outline";
import { AdminContext } from "@/context/AdminContext";
import axios from "axios";
import { useHistory } from "react-router-dom";
import { CustomDatePicker, CurrencyDropdown } from "@/page-layouts/index";
import { notifyError, notifyWarning, notifySuccess } from "@/utils/toast";
import moment from "moment";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const StaffClaimForm = () => {
  const history = useHistory();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;

  // Simplified form structure - only items needed for staff
  const [formData, setFormData] = useState({
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
  const [errors, setErrors] = useState({});
  const [claimTypes, setClaimTypes] = useState([]);
  const [staffInfo, setStaffInfo] = useState(null);

  // Currency conversion states
  const [currencies, setCurrencies] = useState([]);
  const [conversionSummary, setConversionSummary] = useState(null);
  const [isCalculatingConversion, setIsCalculatingConversion] = useState(false);

  console.log("form data", formData);

  const validateForm = () => {
    const newErrors = {};
    const data = formDataRef.current;

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

  // Fetch currencies for conversion
  const fetchCurrencies = async (businessId) => {
    try {
      const response = await axios.get(`${Base_URL}/finance/currencies`, {
        params: { business_id: businessId },
      });
      setCurrencies(response.data.data || []);
    } catch (error) {
      console.error("Error fetching currencies:", error);
    }
  };

  // Calculate total claimable amount in staff's default currency
  const calculateTotalClaimableAmount = async () => {
    if (!currencies.length) return;

    setIsCalculatingConversion(true);

    try {
      console.log("=== DEBUGGING CONVERSION ===");
      console.log("Currencies:", currencies);
      console.log("Staff Info:", staffInfo);
      console.log("Form Data Items:", formData.items);

      // Group items by currency and sum amounts
      const currencyGroups = {};
      formData.items.forEach((item) => {
        if (item.currency && item.claimableAmount) {
          const currency = item.currency; // This is the currency ID
          if (!currencyGroups[currency]) {
            currencyGroups[currency] = 0;
          }
          currencyGroups[currency] += parseFloat(item.claimableAmount) || 0;
        }
      });

      console.log("Currency Groups:", currencyGroups);

      // Get staff's target currency info
      let targetCurrency = null;
      let targetCurrencySymbol = "";

      console.log(
        "Available currencies:",
        currencies.map((c) => ({ id: c._id, symbol: c.symbol, name: c.name }))
      );
      console.log("Staff bank currency ID:", staffInfo?.bankDetails?.currency);
      console.log(
        "Looking for currency with ID:",
        staffInfo?.bankDetails?.currency
      );
      console.log(
        "Available currency IDs:",
        currencies.map((c) => c._id)
      );

      // Check if staff has bank currency set
      if (staffInfo?.bankDetails?.currency) {
        console.log("Staff bank currency ID:", staffInfo.bankDetails.currency);
        // Find the currency by ID from staff's bank currency
        targetCurrency = currencies.find(
          (c) => c._id === staffInfo.bankDetails.currency
        );
        console.log("Found target currency:", targetCurrency);
        if (targetCurrency) {
          targetCurrencySymbol = targetCurrency.symbol;
        }
      }

      // If no bank currency or currency not found, use base currency
      if (!targetCurrency) {
        console.log("No bank currency found, using base currency");
        targetCurrency = currencies.find((c) => c.is_base === true);
        targetCurrencySymbol = targetCurrency?.symbol || "USD";
        console.log("Base currency found:", targetCurrency);
      }

      // Additional fallback: If staff has bank currency but it's not in the list,
      // we could try to find a currency with similar symbol or use base currency
      if (!targetCurrency && staffInfo?.bankDetails?.currency) {
        console.log(
          "Staff bank currency not found in business currencies, trying to find by symbol..."
        );

        // Try to find a currency with the same symbol (in case the ID is different)
        // First, we need to get the staff's bank currency details from a separate API call
        try {
          const staffCurrencyResponse = await axios.get(
            `${Base_URL}/finance/currencies/${staffInfo.bankDetails.currency}`
          );
          if (staffCurrencyResponse.data?.data) {
            const staffCurrencySymbol = staffCurrencyResponse.data.data.symbol;
            console.log("Staff currency symbol:", staffCurrencySymbol);

            // Find currency by symbol instead of ID
            targetCurrency = currencies.find(
              (c) => c.symbol === staffCurrencySymbol
            );
            if (targetCurrency) {
              targetCurrencySymbol = targetCurrency.symbol;
              console.log("Found currency by symbol:", targetCurrency);
            }
          }
        } catch (error) {
          console.log("Could not fetch staff currency details:", error);
        }

        // If still not found, use base currency
        if (!targetCurrency) {
          console.log(
            "Staff bank currency not found by symbol either, using base currency"
          );
          targetCurrency = currencies.find((c) => c.is_base === true);
          targetCurrencySymbol = targetCurrency?.symbol || "USD";
        }
      }

      if (!targetCurrency) {
        console.error("No target currency found");
        return;
      }

      console.log("Final target currency:", targetCurrency);
      console.log("Target currency symbol:", targetCurrencySymbol);

      // Convert all amounts to target currency
      let totalConvertedAmount = 0;
      const conversionDetails = [];

      Object.entries(currencyGroups).forEach(([fromCurrencyId, amount]) => {
        console.log(`Processing currency ID ${fromCurrencyId}: ${amount}`);
        const fromCurrencyInfo = currencies.find(
          (c) => c._id === fromCurrencyId
        );
        console.log("From currency info:", fromCurrencyInfo);
        if (fromCurrencyInfo) {
          // Convert using the formula: (amount * fromRate) / toRate
          const convertedAmount =
            (amount * fromCurrencyInfo.conversion_rate_to_base) /
            targetCurrency.conversion_rate_to_base;
          totalConvertedAmount += convertedAmount;

          console.log(
            `Converted ${amount} ${fromCurrencyInfo.symbol} to ${convertedAmount} ${targetCurrencySymbol}`
          );

          conversionDetails.push({
            fromCurrency: fromCurrencyInfo.symbol,
            originalAmount: amount,
            convertedAmount: convertedAmount,
            toCurrency: targetCurrencySymbol,
          });
        }
      });

      console.log("Total converted amount:", totalConvertedAmount);
      console.log("Conversion details:", conversionDetails);

      setConversionSummary({
        totalConvertedAmount: totalConvertedAmount,
        targetCurrency: targetCurrencySymbol,
        conversionDetails: conversionDetails,
      });
    } catch (error) {
      console.error("Error calculating conversion:", error);
    } finally {
      setIsCalculatingConversion(false);
    }
  };

  // Calculate conversion when form data or currencies change
  useEffect(() => {
    if (currencies.length > 0 && staffInfo && formData.items.length > 0) {
      // Check if there are any items with currency and claimable amount
      const hasValidItems = formData.items.some(
        (item) =>
          item.currency &&
          item.claimableAmount &&
          parseFloat(item.claimableAmount) > 0
      );

      if (hasValidItems) {
        calculateTotalClaimableAmount();
      } else {
        // Reset conversion summary if no valid items
        setConversionSummary(null);
      }
    }
  }, [formData.items, currencies, staffInfo]);

  // Fetch staff info and claim types on component mount
  const fetchStaffInfo = async () => {
    try {
      const response = await axios.get(`${Base_URL}/staff-management`, {
        params: { id: adminInfo.id },
      });

      console.log("Staff Info Response:", response.data.staffList[0]);
      //   http://localhost:5055/api/staff-management/685e36f956839b3dc4bd4edd
      setStaffInfo(response.data.staffList[0]);

      if (
        response.data.staffList[0].business &&
        response.data.staffList[0].claimGroup
      ) {
        fetchClaimTypes(
          response.data.staffList[0].business._id,
          response.data.staffList[0].claimGroup._id
        );
        // Fetch currencies for the business
        fetchCurrencies(response.data.staffList[0].business._id);
      }
    } catch (err) {
      console.error("Error fetching staff info:", err);
      notifyError("Failed to load staff information");
    }
  };

  const fetchClaimTypes = async (companyId, claimGroupId) => {
    try {
      console.log({ bid: companyId, claimGroup: claimGroupId });
      const res = await axios.get(`${Base_URL}/claim-types`, {
        params: { bid: companyId, claimGroup: claimGroupId },
      });
      setClaimTypes(res.data);
    } catch (error) {
      console.error("Error fetching claim types:", error);
    }
  };

  useEffect(() => {
    if (adminInfo?.token) {
      fetchStaffInfo();
    }
  }, [adminInfo]);

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
    console.log("formattedData", formattedData);

    try {
      const res = await axios.post(
        `${Base_URL}/claims/createClaimByStaff`,
        formattedData,
        {
          headers: {
            Authorization: `Bearer ${adminInfo.token}`,
          },
        }
      );
      notifySuccess("Claim created successfully.");
      setTimeout(() => {
        history.push("/staff-claim-management");
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
      const rawBid = staffInfo?.business?._id;
      const businessIdStr = rawBid != null ? String(rawBid) : "";
      formDataForUpload.append("file_path", `Claims/${staffInfo?.displayName}`);
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
            headers: {
              "Content-Type": "multipart/form-data",
              Authorization: `Bearer ${adminInfo.token}`,
            },
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
              "Upload did not return a file. Please try again."
          );
        }
      } catch (error) {
        console.error("File upload error:", error);
        notifyError("File upload failed. Please try again.");
      } finally {
        setUploading((prev) => ({ ...prev, [itemIndex]: false }));
      }
    }
  };

  const HandleOpenFile = async (documentId) => {
    console.log("document_id", documentId);
    try {
      const Response = await axios.get(
        `${Base_URL}/documents/getFileWithAllData/${documentId}`,
        {
          headers: {
            Authorization: `Bearer ${adminInfo.token}`,
          },
        }
      );
      console.log("document_id Response", Response);
      window.open(Response.data.data.url, "_blank");
    } catch (error) {
      notifyError("Error getting file");
      console.log("Error : ", error);
    }
  };

  return (
    <div className="p-6 bg-white">
      <h1 className="text-2xl font-semibold text-gray-800 mb-6">
        Create New Claim
      </h1>

      {/* Staff Info Display */}
      {staffInfo && (
        <div className="mb-8 p-4 bg-blue-50 rounded-lg">
          <h2 className="text-lg font-medium text-gray-800 mb-2">
            Your Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="text-gray-600">Name: </span>
              <span className="font-medium">{staffInfo.displayName}</span>
            </div>
            <div>
              <span className="text-gray-600">Employee Code: </span>
              <span className="font-medium">{staffInfo.employeeId}</span>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
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
                    businessId={staffInfo?.business?._id}
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
                    isDisabled={!staffInfo?.business?._id}
                    shouldShowError={!!errors[`item_${index}`]?.currency}
                    error={errors[`item_${index}`]?.currency}
                  />
                  <div className="min-h-6">
                    {errors[`item_${index}`]?.currency && (
                      <p className="text-red-500 text-sm mt-1 pb-2">
                        {errors[`item_${index}`].currency}
                      </p>
                    )}
                  </div>
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
                    Purpose/Description
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
                    className="bg-gray-100 rounded-md px-4 py-2 w-full focus:outline-none"
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

        {/* Total Claimable Amount Section */}
        {staffInfo && conversionSummary && (
          <div className="mb-6 bg-white border border-gray-200 rounded-lg shadow-sm">
            <div className="px-4 py-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Total Claimable Amount
              </h3>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                {/* Currency Display */}
                <div className="lg:col-span-1">
                  <div className="bg-gray-50 rounded-lg px-4 py-[5px] border border-gray-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-600">
                        Display Currency
                      </span>
                      <span className="text-sm font-semibold text-gray-800 bg-white px-3 py-1 rounded-md border">
                        {conversionSummary.targetCurrency}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Conversion Summary */}
                <div className="lg:col-span-2">
                  {/* <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">
                          Total Claimable Amount
                        </p>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold text-gray-900">
                            {isCalculatingConversion
                              ? "Calculating..."
                              : conversionSummary?.totalConvertedAmount?.toFixed(
                                  2
                                ) || "0.00"}
                          </span>
                          <span className="text-lg font-semibold text-gray-700">
                            {conversionSummary.targetCurrency}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-500">
                          {conversionSummary?.conversionDetails?.length > 0 && (
                            <div>
                              {conversionSummary.conversionDetails.map(
                                (detail, index) => (
                                  <div key={index} className="mb-1">
                                    {detail.originalAmount.toFixed(2)}{" "}
                                    {detail.fromCurrency} →{" "}
                                    {detail.convertedAmount.toFixed(2)}{" "}
                                    {detail.toCurrency}
                                  </div>
                                )
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div> */}
                  {/* Total Amount */}
                  <div className="bg-gray-50 rounded-lg px-4 py-1 border border-gray-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-600">
                        Total Amount
                      </span>
                      <span className="text-xl font-bold text-gray-900">
                        {isCalculatingConversion
                          ? "Calculating..."
                          : conversionSummary?.totalConvertedAmount?.toFixed(
                              2
                            ) || "0.00"}{" "}
                        {conversionSummary.targetCurrency}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Information Note */}
              {/* <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-700">
                  <strong>Note:</strong> This is a read-only section for
                  viewing the total claimable amount in your {staffInfo?.bankDetails?.currency ? 'bank currency' : 'base currency'} ({conversionSummary.targetCurrency}). 
                  This information is for display purposes only
                  and does not modify the original claim data.
                </p>
              </div> */}
            </div>
          </div>
        )}

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
            Submit Claim
          </button>
        </div>
      </form>
    </div>
  );
};

export default StaffClaimForm;
