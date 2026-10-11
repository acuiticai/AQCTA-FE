import React, { useState, useEffect } from "react";
import FormRow from "../reusablecomponents/FormRow";
import InputField from "../reusablecomponents/InputField";
import SelectField from "../reusablecomponents/SelectField";
import DropdownBasic from "@/components/DropdownBasic";
import DropdownWithAddNewForm from "@/components/DropdownAddNewForm";
import { CustomDatePicker } from "@/page-layouts/index";
import { countries } from "countries-list";
import Select from "react-select";
import axios from "axios";
import moment from "moment";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const CompanyInfo = ({
  onChange,
  initialData = {},
  businessId,
  setValidationErrors,
  saveAttempted = false,
}) => {
  // Define required fields
  const requiredFields = [
    "companyAddress",
    "natureOfBusiness",
    "dateOfIncorporation",
    "annualSalesVolume",
    "contactPerson",
  ];

  // Track which fields have been touched by user interaction
  const [touched, setTouched] = useState({});

  const [formData, setFormData] = useState({
    companyAddress: "",
    townCityState: "",
    zipPostalCode: "",
    country: "",
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
  const [errors, setErrors] = useState({}); // Validation errors

  // Country options for dropdown
  const sortedCountryOptions = Object.entries(countries)
    .map(([code, country]) => ({
      label: country.name,
      value: code,
    }))
    .sort((a, b) => a.label.localeCompare(b.label)); // sort alphabetically

  // Populate initial data when it changes
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

      setFormData((prev) => {
        const updatedData = {
          ...prev,
          ...initialData,
          dateOfIncorporation: formattedDate,
        };

        // Remove businessName and contact from updatedData if they exist
        delete updatedData.businessName;
        delete updatedData.contact;

        // Run validation silently to update parent validation state
        validateFormSilently(updatedData);

        return updatedData;
      });
    }
  }, [initialData]);

  // When saveAttempted changes to true, mark all fields as touched and validate
  useEffect(() => {
    if (saveAttempted) {
      // Mark all required fields as touched
      const allTouched = {};
      requiredFields.forEach((field) => {
        allTouched[field] = true;
      });
      // Also mark optional fields that have values
      Object.keys(formData).forEach((field) => {
        if (formData[field] && !requiredFields.includes(field)) {
          allTouched[field] = true;
        }
      });

      // Update touched state
      const updatedTouched = { ...touched, ...allTouched };
      setTouched(updatedTouched);

      // Validate immediately with updated touched state using the function
      validateFieldsWithTouched(formData, updatedTouched);
    }
  }, [saveAttempted, formData]);

  // Re-validate when formData changes (like Customer CompanyInfo)
  useEffect(() => {
    if (Object.keys(touched).length > 0) {
      validateFieldsWithTouched(formData);
    } else {
      validateFormSilently(formData);
    }
  }, [formData]);

  // Validate URL format
  const validateURL = (url) => {
    if (!url || typeof url !== "string") return false;
    const trimmed = url.trim();
    if (trimmed === "") return false;

    // More comprehensive URL validation
    // Allows: http://, https://, www., or just domain
    // Valid examples:
    // - https://www.example.com
    // - http://example.com
    // - www.example.com
    // - example.com
    // - example.com/path?query=value#fragment

    // Try to construct a valid URL
    let urlToTest = trimmed;

    // If it doesn't start with http:// or https://, add https:// for validation
    if (!/^https?:\/\//i.test(urlToTest)) {
      urlToTest = `https://${urlToTest}`;
    }

    try {
      const urlObj = new URL(urlToTest);
      // Check if it has a valid hostname (domain)
      const hostname = urlObj.hostname;

      // Basic domain validation: should have at least one dot (for TLD) or be localhost
      if (hostname === "localhost" || hostname.includes(".")) {
        // Check for valid domain pattern
        const domainPattern =
          /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
        const localhostPattern = /^localhost(:\d+)?$/;

        // Remove www. prefix for validation
        const domainToCheck = hostname.replace(/^www\./, "");

        if (
          domainToCheck === "localhost" ||
          localhostPattern.test(domainToCheck) ||
          domainPattern.test(domainToCheck)
        ) {
          return true;
        }
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  // Validate a specific field
  const validateField = (name, value, data = formData) => {
    // Use dot notation to handle nested fields
    const fieldPath = name.split(".");
    let fieldValue = value;

    // If value is not provided, extract it from formData
    if (value === undefined) {
      fieldValue =
        fieldPath.length > 1 ? data[fieldPath[0]]?.[fieldPath[1]] : data[name];
    }

    // Check required fields
    if (requiredFields.includes(name)) {
      // Special handling for dateOfIncorporation (Date object)
      if (name === "dateOfIncorporation") {
        if (
          !fieldValue ||
          !(fieldValue instanceof Date) ||
          isNaN(fieldValue.getTime())
        ) {
          return "Date of Incorporation is required";
        }
      } else {
        // For other fields, check if empty
        if (
          !fieldValue ||
          (typeof fieldValue === "string" && fieldValue.trim() === "")
        ) {
          const fieldName = name.includes(".") ? name.split(".")[1] : name;
          // Format field name for display (e.g., "companyWebsite" -> "Company Website")
          const formattedName = fieldName
            .replace(/([A-Z])/g, " $1")
            .replace(/^./, (str) => str.toUpperCase())
            .trim();
          return `${formattedName} is required`;
        }
      }
    }

    // Validate companyWebsite URL format (even if not required, validate format if provided)
    if (name === "companyWebsite" && fieldValue) {
      const trimmedValue =
        typeof fieldValue === "string" ? fieldValue.trim() : "";
      if (trimmedValue && !validateURL(trimmedValue)) {
        return "Please enter a valid website URL (e.g., https://www.example.com or example.com)";
      }
    }

    return "";
  };

  // Run validation without showing errors to user (for parent component state)
  const validateFormSilently = (data = formData) => {
    const newErrors = {};
    let isValid = true;

    // Validate required fields
    requiredFields.forEach((field) => {
      const fieldPath = field.split(".");
      let fieldValue =
        fieldPath.length > 1 ? data[fieldPath[0]]?.[fieldPath[1]] : data[field];

      // Special handling for dateOfIncorporation (Date object)
      if (field === "dateOfIncorporation") {
        // fieldValue is already a Date object or undefined
      } else if (fieldValue && typeof fieldValue === "string") {
        // Trim string values for validation
        fieldValue = fieldValue.trim();
      }

      const error = validateField(field, fieldValue, data);
      if (error) {
        if (field.includes(".")) {
          const [parent, child] = field.split(".");
          newErrors[parent] = newErrors[parent] || {};
          newErrors[parent][child] = error;
        } else {
          newErrors[field] = error;
        }
        isValid = false;
      }
    });

    // Also validate companyWebsite if it has a value (even if not in requiredFields but has value)
    if (
      data.companyWebsite &&
      typeof data.companyWebsite === "string" &&
      data.companyWebsite.trim()
    ) {
      const websiteError = validateField(
        "companyWebsite",
        data.companyWebsite.trim(),
        data
      );
      if (websiteError) {
        newErrors.companyWebsite = websiteError;
        isValid = false;
      }
    }

    // Update parent component validation state
    if (setValidationErrors) {
      setValidationErrors({
        companyInfo: !isValid,
      });
    }

    // Store errors but don't display them yet
    setErrors(newErrors);

    return isValid;
  };

  // Validate touched fields (to show errors) - accepts touchedState parameter
  const validateFieldsWithTouched = (
    data = formData,
    touchedState = touched
  ) => {
    const newErrors = {};
    let isValid = true;

    // Validate all touched fields (like Customer CompanyInfo)
    Object.keys(touchedState).forEach((field) => {
      if (touchedState[field]) {
        const fieldPath = field.split(".");
        let fieldValue =
          fieldPath.length > 1
            ? data[fieldPath[0]]?.[fieldPath[1]]
            : data[field];

        // Special handling for dateOfIncorporation (Date object)
        if (field === "dateOfIncorporation") {
          // fieldValue is already a Date object or undefined
        } else if (fieldValue && typeof fieldValue === "string") {
          // Trim string values for validation
          fieldValue = fieldValue.trim();
        }

        const error = validateField(field, fieldValue, data);
        if (error) {
          if (field.includes(".")) {
            const [parent, child] = field.split(".");
            newErrors[parent] = newErrors[parent] || {};
            newErrors[parent][child] = error;
          } else {
            newErrors[field] = error;
          }
          isValid = false;
        }
      }
    });

    // Also check untouched required fields for parent validation state
    requiredFields.forEach((field) => {
      if (!touchedState[field]) {
        const fieldPath = field.split(".");
        let fieldValue =
          fieldPath.length > 1
            ? data[fieldPath[0]]?.[fieldPath[1]]
            : data[field];

        // Special handling for dateOfIncorporation (Date object)
        if (field === "dateOfIncorporation") {
          // fieldValue is already a Date object or undefined
        } else if (fieldValue && typeof fieldValue === "string") {
          // Trim string values for validation
          fieldValue = fieldValue.trim();
        }

        const error = validateField(field, fieldValue, data);
        if (error) {
          isValid = false;
          // Don't add to newErrors since we don't want to display it yet
        }
      }
    });

    // Also validate optional fields that have values (like companyWebsite)
    Object.keys(data).forEach((field) => {
      if (!requiredFields.includes(field) && data[field]) {
        let fieldValue = data[field];
        if (typeof fieldValue === "string") {
          fieldValue = fieldValue.trim();
        }

        if (fieldValue) {
          const error = validateField(field, fieldValue, data);
          if (error) {
            if (touchedState[field]) {
              newErrors[field] = error;
            }
            isValid = false;
          }
        }
      }
    });

    // Set visible errors
    setErrors(newErrors);

    // Update parent component validation state
    if (setValidationErrors) {
      setValidationErrors({
        companyInfo: !isValid,
      });
    }

    return isValid;
  };

  // Mark field as touched on blur
  const handleBlur = (field) => {
    setTouched((prev) => ({
      ...prev,
      [field]: true,
    }));

    // Force validation immediately after marking field as touched
    validateFieldsWithTouched(formData);
  };

  // Helper to determine if a field has an error and should show it
  const shouldShowError = (field) => {
    return touched[field] && errors[field];
  };

  // Handle top-level field changes
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

    // Mark field as touched when value changes (like Customer CompanyInfo)
    setTouched((prev) => ({
      ...prev,
      [field]: true,
    }));
  };

  return (
    <div className="space-y-4">
      {/* Company Address */}
      <FormRow
        label={
          <span>
            Company Address <span className="text-red-500">*</span>
          </span>
        }
      >
        <InputField
          placeholder="Company Address"
          value={formData.companyAddress}
          onChange={(e) => handleChange("companyAddress", e.target.value)}
          onBlur={() => handleBlur("companyAddress")}
          className={shouldShowError("companyAddress") ? "border-red-500" : ""}
        />
        {shouldShowError("companyAddress") && (
          <p className="text-red-500 text-xs mt-1 font-medium">
            {errors.companyAddress}
          </p>
        )}
      </FormRow>

      <FormRow label="Town/City/State">
        <InputField
          placeholder="Town/City/State"
          value={formData.townCityState}
          onChange={(e) => handleChange("townCityState", e.target.value)}
          onBlur={() => handleBlur("townCityState")}
          className={shouldShowError("townCityState") ? "border-red-500" : ""}
        />
        {shouldShowError("townCityState") && (
          <p className="text-red-500 text-xs mt-1 font-medium">
            {errors.townCityState}
          </p>
        )}
      </FormRow>

      <FormRow label="Zip/Postal Code">
        <InputField
          placeholder="Zip/Postal Code"
          value={formData.zipPostalCode}
          onChange={(e) => handleChange("zipPostalCode", e.target.value)}
          onBlur={() => handleBlur("zipPostalCode")}
          className={shouldShowError("zipPostalCode") ? "border-red-500" : ""}
        />
        {shouldShowError("zipPostalCode") && (
          <p className="text-red-500 text-xs mt-1 font-medium">
            {errors.zipPostalCode}
          </p>
        )}
      </FormRow>

      <FormRow label="Country">
        <Select
          className={
            shouldShowError("country")
              ? "border-red-500 w-full border-gray-300 rounded-lg shadow-sm p-2 bg-gray-100 focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
              : "w-full border-gray-300 rounded-lg shadow-sm p-2 bg-gray-100 focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
          }
          options={sortedCountryOptions}
          value={
            sortedCountryOptions.find(
              (opt) => opt.value === formData.country
            ) || null
          }
          onChange={(selectedOption) =>
            handleChange("country", selectedOption?.value || "")
          }
          onBlur={() => handleBlur("country")}
          placeholder="Select a country"
          isClearable
          classNamePrefix="react-select"
        />
        {shouldShowError("country") && (
          <p className="text-red-500 text-xs mt-1 font-medium">
            {errors.country}
          </p>
        )}
      </FormRow>

      <FormRow
        label={
          <span>
            Nature of Business <span className="text-red-500">*</span>
          </span>
        }
      >
        <DropdownWithAddNewForm
          placeholder="Select Nature of Business"
          fetchUrl={`${Base_URL}/items/Business Nature/get_all`}
          addUrl={`${Base_URL}/items/Business Nature/add`}
          businessId={businessId}
          selectedValue={formData.natureOfBusiness}
          onChange={(selected) => handleChange("natureOfBusiness", selected)}
          onBlur={() => handleBlur("natureOfBusiness")}
          className={
            shouldShowError("natureOfBusiness") ? "border-red-500" : ""
          }
        />
        {shouldShowError("natureOfBusiness") && (
          <p className="text-red-500 text-xs mt-1 font-medium">
            {errors.natureOfBusiness}
          </p>
        )}
      </FormRow>

      <FormRow label="Company Website">
        <InputField
          placeholder="Enter Company Website"
          value={formData.companyWebsite}
          onChange={(e) => handleChange("companyWebsite", e.target.value)}
          onBlur={() => handleBlur("companyWebsite")}
          className={shouldShowError("companyWebsite") ? "border-red-500" : ""}
        />
        {shouldShowError("companyWebsite") && (
          <p className="text-red-500 text-xs mt-1 font-medium">
            {errors.companyWebsite}
          </p>
        )}
      </FormRow>

      <FormRow label="Type of Business">
        <InputField
          placeholder="Type of Business"
          value={formData.typeOfBusiness}
          onChange={(e) => handleChange("typeOfBusiness", e.target.value)}
          onBlur={() => handleBlur("typeOfBusiness")}
          className={shouldShowError("typeOfBusiness") ? "border-red-500" : ""}
        />
        {shouldShowError("typeOfBusiness") && (
          <p className="text-red-500 text-xs mt-1 font-medium">
            {errors.typeOfBusiness}
          </p>
        )}
      </FormRow>

      <FormRow label="Presence of Business">
        <InputField
          placeholder="Presence of Business"
          value={formData.presenceOfBusiness}
          onChange={(e) => handleChange("presenceOfBusiness", e.target.value)}
          onBlur={() => handleBlur("presenceOfBusiness")}
          className={
            shouldShowError("presenceOfBusiness") ? "border-red-500" : ""
          }
        />
        {shouldShowError("presenceOfBusiness") && (
          <p className="text-red-500 text-xs mt-1 font-medium">
            {errors.presenceOfBusiness}
          </p>
        )}
      </FormRow>

      <FormRow label="Company Registration Number">
        <InputField
          placeholder="Company Registration Number"
          value={formData.companyRegistrationNumber}
          onChange={(e) =>
            handleChange("companyRegistrationNumber", e.target.value)
          }
          onBlur={() => handleBlur("companyRegistrationNumber")}
          className={
            shouldShowError("companyRegistrationNumber") ? "border-red-500" : ""
          }
        />
        {shouldShowError("companyRegistrationNumber") && (
          <p className="text-red-500 text-xs mt-1 font-medium">
            {errors.companyRegistrationNumber}
          </p>
        )}
      </FormRow>

      <FormRow
        label={
          <span>
            Date of Incorporation <span className="text-red-500">*</span>
          </span>
        }
      >
        <CustomDatePicker
          type="date"
          value={formData.dateOfIncorporation}
          onChange={(date) => {
            console.log("📅 DatePicker onChange:", date, typeof date);
            handleChange("dateOfIncorporation", date);
          }}
          onBlur={() => handleBlur("dateOfIncorporation")}
          className={
            shouldShowError("dateOfIncorporation") ? "border-red-500" : ""
          }
        />
        {shouldShowError("dateOfIncorporation") && (
          <p className="text-red-500 text-xs mt-1 font-medium">
            {errors.dateOfIncorporation}
          </p>
        )}
      </FormRow>

      <FormRow
        label={
          <span>
            Annual Sales Volume (USD) <span className="text-red-500">*</span>
          </span>
        }
      >
        <InputField
          type="number"
          placeholder="Enter Sales Volume"
          value={formData.annualSalesVolume}
          onChange={(e) => handleChange("annualSalesVolume", e.target.value)}
          onBlur={() => handleBlur("annualSalesVolume")}
          className={
            shouldShowError("annualSalesVolume") ? "border-red-500" : ""
          }
        />
        {shouldShowError("annualSalesVolume") && (
          <p className="text-red-500 text-xs mt-1 font-medium">
            {errors.annualSalesVolume}
          </p>
        )}
      </FormRow>

      <FormRow
        label={
          <span>
            Contact Person <span className="text-red-500">*</span>
          </span>
        }
      >
        <InputField
          placeholder="Contact Person"
          value={formData.contactPerson}
          onChange={(e) => handleChange("contactPerson", e.target.value)}
          onBlur={() => handleBlur("contactPerson")}
          className={shouldShowError("contactPerson") ? "border-red-500" : ""}
        />
        {shouldShowError("contactPerson") && (
          <p className="text-red-500 text-xs mt-1 font-medium">
            {errors.contactPerson}
          </p>
        )}
      </FormRow>
    </div>
  );
};

export default CompanyInfo;
