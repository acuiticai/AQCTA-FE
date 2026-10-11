import React, { useState, useEffect } from "react";
import FormRow from "../reusablecomponents/FormRow";
import InputField from "../reusablecomponents/InputField";
import SelectField from "../reusablecomponents/SelectField";
import DropdownBasic from "@/components/DropdownBasic";
import { CustomDatePicker } from "@/page-layouts/index";
import { countries } from "countries-list";
import Select from "react-select";
import axios from "axios";
import moment from "moment";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const CompanyInfo = ({ onChange, initialData = {}, businessId }) => {
  const [formData, setFormData] = useState({
    businessName: "",
    companyAddress: "",
    townCityState: "",
    zipPostalCode: "",
    country: "",
    contact: { phone: "", email: "" }, // ✅ Removed Fax
    companyWebsite: "",
    typeOfBusiness: "",
    natureOfBusiness: "",
    presenceOfBusiness: "",
    companyRegistrationNumber: "",
    dateOfIncorporation: "",
    annualSalesVolume: "",
    contactPerson: "",
  });

  const [natureOfBusinessOptions, setNatureOfBusinessOptions] = useState([]);
  const [isLoading, setIsLoading] = useState({ natureOfBusiness: false });
  const [errors, setErrors] = useState({}); // ✅ Validation errors

  // Country options for dropdown
  const sortedCountryOptions = Object.entries(countries)
    .map(([code, country]) => ({
      label: country.name,
      value: code,
    }))
    .sort((a, b) => a.label.localeCompare(b.label)); // sort alphabetically

  // ✅ Fetch "Nature of Business" from API based on businessId
  useEffect(() => {
    if (!businessId) return;

    const fetchNatureOfBusiness = async () => {
      setIsLoading((prev) => ({ ...prev, natureOfBusiness: true }));

      try {
        console.log("🔍 Fetching Nature of Business for:", businessId);
        const response = await axios.post(
          `${Base_URL}/items/Business%20Nature/get_all`,
          {
            business_id: businessId,
            FilterStatus: "active",
          }
        );

        if (response.data.success) {
          setNatureOfBusinessOptions(response.data.data);
        } else {
          throw new Error("Failed to fetch nature of business");
        }
      } catch (err) {
        console.error("❌ Error fetching nature of business:", err);
      } finally {
        setIsLoading((prev) => ({ ...prev, natureOfBusiness: false }));
      }
    };

    fetchNatureOfBusiness();
  }, [businessId]);

  // ✅ Populate initial data when it changes
  useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) {
      console.log("📌 Setting initial Company Info:", initialData);

      // Handle dateOfIncorporation properly for DatePicker
      let formattedDate = "";
      if (initialData.dateOfIncorporation) {
        // If it's already a valid date string, use it directly
        // If it needs formatting, format it properly
        const date = new Date(initialData.dateOfIncorporation);
        if (!isNaN(date.getTime())) {
          formattedDate = date;
        } else {
          // Try to parse it with moment if it's in a different format
          const momentDate = moment(initialData.dateOfIncorporation);
          if (momentDate.isValid()) {
            formattedDate = momentDate.toDate();
          }
        }
      }

      setFormData((prev) => ({
        ...prev,
        ...initialData,
        contact: {
          ...prev.contact,
          ...initialData.contact,
        },
        dateOfIncorporation: formattedDate,
      }));
    }
  }, [initialData]);

  // ✅ Validation function for Email & Malay Phone Number
  const validateField = (field, value) => {
    let errorMessage = "";

    if (field === "phone") {
      // ✅ Malaysia phone number validation (+60 or 0 followed by 9-10 digits)
      const phoneRegex = /^(?:\+60|0)[0-9]{9,10}$/;
      errorMessage =
        phoneRegex.test(value) || value === "" ? "" : "Invalid phone number";
    }

    if (field === "email") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      errorMessage =
        emailRegex.test(value) || value === "" ? "" : "Invalid email address";
    }

    setErrors((prevErrors) => ({ ...prevErrors, [field]: errorMessage }));
  };

  // ✅ Handle top-level field changes
  const handleChange = (field, value) => {
    // Handle dateOfIncorporation specially to ensure proper date handling
    let processedValue = value;
    if (field === "dateOfIncorporation") {
      // If it's a Date object, keep it as is
      // If it's a string, try to convert it to a Date object
      if (typeof value === "string" && value) {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          processedValue = date;
        }
      } else if (value instanceof Date) {
        processedValue = value;
      } else if (!value) {
        processedValue = "";
      }
    }

    setFormData((prev) => {
      const updatedData = { ...prev, [field]: processedValue };
      onChange && onChange(updatedData);
      return updatedData;
    });
  };

  // ✅ Handle nested object changes (for contact fields)
  const handleNestedChange = (parentField, childField, value) => {
    setFormData((prev) => {
      const updatedParent = { ...prev[parentField], [childField]: value };
      const updatedData = { ...prev, [parentField]: updatedParent };
      onChange && onChange(updatedData);
      return updatedData;
    });

    // Validate phone & email
    if (childField === "phone" || childField === "email") {
      validateField(childField, value);
    }
  };

  return (
    <div className="space-y-4">
      {/* ✅ Company Name */}
      <FormRow label="Company Name *">
        <InputField
          placeholder="Business Name"
          value={formData.businessName}
          onChange={(e) => handleChange("businessName", e.target.value)}
        />
      </FormRow>

      {/* ✅ Company Address */}
      <FormRow label="Company Address *">
        <InputField
          placeholder="Company Address"
          value={formData.companyAddress}
          onChange={(e) => handleChange("companyAddress", e.target.value)}
        />
      </FormRow>

      {/* ✅ Country Dropdown */}
      <FormRow label="Country">
        <Select
          className="w-full border-gray-300 rounded-lg shadow-sm p-2 bg-gray-100 focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
          options={sortedCountryOptions}
          value={
            sortedCountryOptions.find(
              (opt) => opt.value === formData.country
            ) || null
          }
          onChange={(selectedOption) =>
            handleChange("country", selectedOption?.value || "")
          }
          placeholder="Select a country"
          isClearable
          classNamePrefix="react-select"
        />
      </FormRow>

      {/* ✅ Nature of Business - API Dropdown */}
      <FormRow label="Nature of Business">
        {isLoading.natureOfBusiness ? (
          <p>Loading...</p>
        ) : (
          <DropdownBasic
            value={formData.natureOfBusiness}
            onChange={(selectedValue) =>
              handleChange("natureOfBusiness", selectedValue)
            }
            options={natureOfBusinessOptions.map((nature) => ({
              value: nature.name,
              label: nature.name,
            }))}
            placeholder="Select Nature of Business"
            disabled={!businessId}
          />
        )}
      </FormRow>

      {/* ✅ Contact Section */}
      <FormRow label="Contact *">
        <div className="flex space-x-4">
          {/* ✅ Phone Input with Malay Validation */}
          <div>
            <InputField
              placeholder="Phone (Malaysia) *"
              value={formData.contact.phone}
              onChange={(e) =>
                handleNestedChange("contact", "phone", e.target.value)
              }
            />
            {errors["phone"] && (
              <p className="text-xs text-red-500">{errors["phone"]}</p>
            )}
          </div>

          {/* ✅ Email Input with Validation */}
          <div>
            <InputField
              placeholder="Email *"
              value={formData.contact.email}
              onChange={(e) =>
                handleNestedChange("contact", "email", e.target.value)
              }
            />
            {errors["email"] && (
              <p className="text-xs text-red-500">{errors["email"]}</p>
            )}
          </div>
        </div>
      </FormRow>

      {/* ✅ Other Fields (Kept as they were) */}
      <FormRow label="Company Website">
        <InputField
          placeholder="Enter Company Website"
          value={formData.companyWebsite}
          onChange={(e) => handleChange("companyWebsite", e.target.value)}
        />
      </FormRow>

      <FormRow label="Company Registration Number">
        <InputField
          placeholder="Company Registration Number"
          value={formData.companyRegistrationNumber}
          onChange={(e) =>
            handleChange("companyRegistrationNumber", e.target.value)
          }
        />
      </FormRow>

      <FormRow label="Date of Incorporation">
        <CustomDatePicker
          type="date"
          value={formData.dateOfIncorporation}
          onChange={(date) => {
            console.log("📅 DatePicker onChange:", date, typeof date);
            handleChange("dateOfIncorporation", date);
          }}
        />
      </FormRow>

      <FormRow label="Annual Sales Volume (USD)">
        <InputField
          type="number"
          placeholder="Enter Sales Volume"
          value={formData.annualSalesVolume}
          onChange={(e) => handleChange("annualSalesVolume", e.target.value)}
        />
      </FormRow>

      <FormRow label="Contact Person">
        <InputField
          placeholder="Contact Person"
          value={formData.contactPerson}
          onChange={(e) => handleChange("contactPerson", e.target.value)}
        />
      </FormRow>
    </div>
  );
};

export default CompanyInfo;
