import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";
import FormRow from "../reusablecomponents/FormRow";
import InputField from "../reusablecomponents/InputField";
import SelectField from "../reusablecomponents/SelectField";
import { notifyError } from "@/utils/toast";
import DropdownAddNewForm from "@/components/DropdownAddNewForm";
import { countries } from "countries-list";
import { FiUpload } from "react-icons/fi";
import { formatDate } from "@/components/formatAmount";
import { CustomDatePicker, DropdownBasic } from "@/page-layouts/index";
import moment from "moment";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const CompanyInfo = ({
  initialData = {},
  onChange,
  businessId,
  config,
  setValidationErrors,
}) => {
  const { t } = useTranslation();

  const fieldLabels = {
    registrationNumber: t("customer.companyInfo.registrationNumber"),
    dateOfIncorporation: t("customer.companyInfo.dateOfIncorporation"),
    authorizedCapital: t("customer.companyInfo.authorizedCapital"),
    yearsInBusiness: t("customer.companyInfo.yearsInBusiness"),
    countryOfIncorporation: t("customer.companyInfo.countryOfIncorporation"),
    registeredAddress: t("customer.companyInfo.registeredAddress"),
    billingAddress: t("customer.companyInfo.billingAddress"),
    shippingAddress: t("customer.companyInfo.shippingAddress"),
    phone: t("customer.companyInfo.phone"),
    fax: t("customer.companyInfo.fax"),
    typeOfBusiness: t("customer.companyInfo.typeOfBusiness"),
    natureOfBusiness: t("customer.companyInfo.natureOfBusiness"),
    companyWebsite: t("customer.companyInfo.companyWebsite"),
    annualSalesVolume: t("customer.companyInfo.annualSalesVolume"),
    companyLogo: t("customer.companyInfo.companyLogo"),
  };

  console.log("company,,,");
  const [formData, setFormData] = useState({
    registrationNumber: "",
    dateOfIncorporation: "",
    authorizedCapital: "",
    yearsInBusiness: "",
    countryOfIncorporation: "",
    paidUpCapital: "",
    registeredAddress: "",
    billingAddress: "",
    shippingAddress: "",
    phone: "",
    fax: "",
    typeOfBusiness: "",
    natureOfBusiness: "",
    companyWebsite: "",
    annualSalesVolume: "",
    companyLogo: "",
  });

  console.log("company info!", formData);

  // ...

  const sortedCountryOptions = Object.entries(countries)
    .map(([code, country]) => ({
      label: country.name,
      value: code,
    }))
    .sort((a, b) => a.label.localeCompare(b.label)); // sort alphabetically

  // Define required fields
  const requiredFields = [
    "registrationNumber",
    "dateOfIncorporation",
    "authorizedCapital",
    "countryOfIncorporation",
    "registeredAddress",
    "billingAddress",
    "typeOfBusiness",
  ];

  // Validation errors state
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [businessTypes, setBusinessTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);

  // Modified CompanyInfo.jsx to only show errors after user interaction

  useEffect(() => {
    if (initialData) {
      // Handle dateOfIncorporation properly for DatePicker
      let formattedDate = "";
      if (initialData.dateOfIncorporation) {
        // If it's already a valid date string, use it directly
        // If it needs formatting, format it properly
        const date = new Date(initialData.dateOfIncorporation);
        console.log("📅 Parsed date:", date, "Valid:", !isNaN(date.getTime()));
        if (!isNaN(date.getTime())) {
          formattedDate = date;
        } else {
          // Try to parse it with moment if it's in a different format
          const momentDate = moment(initialData.dateOfIncorporation);
          console.log(
            "📅 Moment date:",
            momentDate,
            "Valid:",
            momentDate.isValid()
          );
          if (momentDate.isValid()) {
            formattedDate = momentDate.toDate();
          }
        }
      }
      console.log(
        "📅 Final formatted date:",
        formattedDate,
        typeof formattedDate
      );

      setFormData({
        registrationNumber: initialData.registrationNumber || "",
        dateOfIncorporation: formattedDate,
        authorizedCapital: initialData.authorizedCapital || "",
        yearsInBusiness: initialData.yearsInBusiness || "",
        countryOfIncorporation: initialData.countryOfIncorporation || "",
        paidUpCapital: initialData.paidUpCapital || "",
        registeredAddress: initialData.registeredAddress || "",
        billingAddress: initialData.billingAddress || "",
        shippingAddress: initialData.shippingAddress || "",
        phone: initialData.phone || "",
        fax: initialData.fax || "",
        typeOfBusiness: initialData.typeOfBusiness || "",
        natureOfBusiness: initialData.natureOfBusiness || "",
        companyWebsite: initialData.companyWebsite || "",
        annualSalesVolume: initialData.annualSalesVolume || "",
        companyLogo: initialData.companyLogo || "",
      });

      // Set logo preview if logo exists
      if (initialData.companyLogo) {
        setLogoPreview(initialData.companyLogo);
      }

      // Run validation without showing errors to user
      // This still updates parent validation state but doesn't show errors
      setTimeout(() => {
        validateFormSilently();
      }, 0);
    }
  }, [initialData]);

  // Run validation silently (without showing errors) and update parent
  const validateFormSilently = () => {
    const newErrors = {};
    let isValid = true;

    // Validate all required fields
    requiredFields.forEach((field) => {
      const error = validateField(field, formData[field]);
      if (error) {
        newErrors[field] = error;
        isValid = false;
      }
    });

    // Also validate optional fields that have values
    Object.keys(formData).forEach((field) => {
      if (!requiredFields.includes(field) && formData[field]) {
        const error = validateField(field, formData[field]);
        if (error) {
          newErrors[field] = error;
          isValid = false;
        }
      }
    });

    // Store errors in state but don't mark fields as touched
    setErrors(newErrors);

    // Update parent component validation state
    if (setValidationErrors) {
      setValidationErrors({
        companyInfo: !isValid,
      });
    }

    return isValid;
  };

  // Update the useEffect that runs on formData changes
  useEffect(() => {
    // Only validate fields that have been touched
    validateFieldsWithTouched();
    checkAllRequiredFieldsFilled();
  }, [formData]);

  // Validate only touched fields
  const validateFieldsWithTouched = () => {
    const newErrors = {};
    let isValid = true;

    Object.keys(touched).forEach((field) => {
      if (touched[field]) {
        const error = validateField(field, formData[field]);
        if (error) {
          newErrors[field] = error;
          isValid = false;
        }
      }
    });

    // Also check untouched required fields for parent validation state
    requiredFields.forEach((field) => {
      if (!touched[field]) {
        const error = validateField(field, formData[field]);
        if (error) {
          isValid = false;
          // Don't add to newErrors since we don't want to display it yet
        }
      }
    });

    setErrors(newErrors);

    // Update parent component validation state
    if (setValidationErrors) {
      setValidationErrors({
        companyInfo: !isValid,
      });
    }

    return isValid;
  };

  // No longer need to mark all fields as touched in validateForm
  const validateForm = () => {
    const newErrors = {};
    let isValid = true;

    // Only validate touched fields to show errors
    Object.keys(touched).forEach((field) => {
      if (touched[field]) {
        const error = validateField(field, formData[field]);
        if (error) {
          newErrors[field] = error;
          isValid = false;
        }
      }
    });

    // Still check untouched fields for form validity
    Object.keys(formData).forEach((field) => {
      if (!touched[field]) {
        const error = validateField(field, formData[field]);
        if (error) {
          isValid = false;
          // Don't add to newErrors since we don't want to display it
        }
      }
    });

    setErrors(newErrors);

    // Update parent component validation state
    if (setValidationErrors) {
      setValidationErrors({
        companyInfo: !isValid,
      });
    }

    return isValid;
  };

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

  const validateField = (name, value) => {
    if (requiredFields.includes(name) && (!value || value?.trim?.() === "")) {
      return t("customer.validation.fieldRequired", {
        field: fieldLabels[name] || name,
      });
    }

    // Additional validation rules
    if (name === "companyWebsite" && value) {
      const trimmedValue = typeof value === "string" ? value.trim() : "";
      if (trimmedValue && !validateURL(trimmedValue)) {
        return t("customer.companyInfo.invalidWebsiteUrl");
      }
    }

    if (name === "phone" && value) {
      // Validate international phone numbers (E.164-ish). Allows leading "+", spaces, dashes, and parentheses.
      // Valid if it contains 7–15 digits total and at most one leading "+".
      const trimmed = value.trim();
      const plusOccurrences = (trimmed.match(/\+/g) || []).length;
      if (plusOccurrences > 1) {
        return t("customer.validation.invalidPhone");
      }
      if (plusOccurrences === 1 && trimmed[0] !== "+") {
        return t("customer.validation.invalidPhone");
      }
      const digitsOnly = trimmed.replace(/\D/g, "");
      if (digitsOnly.length < 7 || digitsOnly.length > 15) {
        return t("customer.validation.invalidPhone");
      }
    }

    return "";
  };

  // Check if all required fields are filled
  const checkAllRequiredFieldsFilled = () => {
    let allFilled = true;

    for (const field of requiredFields) {
      if (!formData[field] || formData[field]?.trim?.() === "") {
        allFilled = false;
        break;
      }
    }

    // Also check if all values are valid
    for (const field in errors) {
      if (errors[field]) {
        allFilled = false;
        break;
      }
    }

    // Update parent component's state - FIXED: Pass boolean directly instead of update function
    if (setValidationErrors) {
      setValidationErrors({
        companyInfo: !allFilled, // This is now a direct value, not an update function
      });
    }

    return allFilled;
  };

  const handleLogoUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      notifyError(t("customer.companyInfo.logoFileTypeError"));
      return;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      notifyError(t("customer.companyInfo.logoFileSizeError"));
      return;
    }

    try {
      const formData = new FormData();
      formData.append("image", file);

      // Replace with your real upload endpoint
      const response = await axios.post(`${Base_URL}/upload`, formData);
      const imageUrl = response.data.url;
      setLogoPreview(imageUrl);
      handleChange("companyLogo", imageUrl);
    } catch (error) {
      notifyError(t("customer.companyInfo.logoUploadFailed"));
      console.error("Upload error:", error);
    }
  };

  const handleAuthorizedCapitalChange = (value, isBlur = false) => {
    if (!value) return ""; // Allow empty input

    // Get decimal places from API config, default to 2
    let decimalPlaces = config?.amount_format ?? 2;

    // Remove non-numeric characters except `.`
    let cleanedValue = value.replace(/[^0-9.]/g, "");

    // Prevent multiple decimals
    if ((cleanedValue.match(/\./g) || []).length > 1) {
      cleanedValue = cleanedValue.slice(0, -1);
    }

    // Split into integer and decimal parts
    let [integerPart, decimalPart] = cleanedValue.split(".");

    // Format integer part with commas
    integerPart = integerPart.replace(/\D/g, "") || "0";
    integerPart = Number(integerPart).toLocaleString("en-US");

    // If no decimal is provided, add `.00` or required decimal places **only on blur**
    if (!decimalPart && isBlur) {
      decimalPart = "0".repeat(decimalPlaces);
    }

    // Restrict decimal part to allowed decimal places from API config
    if (decimalPart && decimalPart.length > decimalPlaces) {
      decimalPart = decimalPart.slice(0, decimalPlaces);
    }

    // If user is typing, allow free input (no forced formatting)
    if (!isBlur) {
      return decimalPart !== undefined
        ? `${integerPart}.${decimalPart}`
        : `${integerPart}`;
    }

    // On blur, ensure the correct number of decimal places
    let finalNumber = parseFloat(
      `${integerPart.replace(/,/g, "")}.${decimalPart || "0"}`
    ).toFixed(decimalPlaces);

    return Number(finalNumber).toLocaleString("en-US", {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    });
  };

  const handleAnnualSalesVolumeChange = (value, isBlur = false) => {
    if (!value) return ""; // Allow empty input

    // Get decimal places from API config, default to 2
    let decimalPlaces = config?.amount_format ?? 2;

    // Remove non-numeric characters except `.`
    let cleanedValue = value.replace(/[^0-9.]/g, "");

    // Prevent multiple decimals
    if ((cleanedValue.match(/\./g) || []).length > 1) {
      cleanedValue = cleanedValue.slice(0, -1);
    }

    // Split into integer and decimal parts
    let [integerPart, decimalPart] = cleanedValue.split(".");

    // Format integer part with commas
    integerPart = integerPart.replace(/\D/g, "") || "0";
    integerPart = Number(integerPart).toLocaleString("en-US");

    // If user enters a whole number and leaves the field, add the required decimals
    if (isBlur && !decimalPart) {
      decimalPart = "0".repeat(decimalPlaces);
    }

    // Restrict decimal part to allowed decimal places from API config
    if (decimalPart && decimalPart.length > decimalPlaces) {
      decimalPart = decimalPart.slice(0, decimalPlaces);
    }

    // Allow free input when typing
    if (!isBlur) {
      return decimalPart !== undefined
        ? `${integerPart}.${decimalPart}`
        : `${integerPart}`;
    }

    // On blur, ensure correct decimal places
    let finalNumber = parseFloat(
      `${integerPart.replace(/,/g, "")}.${decimalPart || "0"}`
    ).toFixed(decimalPlaces);

    return Number(finalNumber).toLocaleString("en-US", {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    });
  };

  // This useEffect is now redundant since we have the main one above
  // Keeping it for now but it should be removed to avoid conflicts

  // Run validation and check all required fields when form data changes
  useEffect(() => {
    validateForm();
    checkAllRequiredFieldsFilled();
  }, [formData]);

  const handleChange = (field, value) => {
    console.log(`📝 Updating field: ${field} -> ${value}`);

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

    const updatedData = { ...formData, [field]: processedValue };
    setFormData(updatedData);

    // Mark field as touched
    setTouched((prev) => ({
      ...prev,
      [field]: true,
    }));

    onChange && onChange(updatedData);
    console.log("📌 Updated Company Info State:", updatedData);
  };

  const handleBlur = (field) => {
    setTouched((prev) => ({
      ...prev,
      [field]: true,
    }));
    validateForm();
  };

  return (
    <div className="space-y-4">
      <FormRow
        label={
          <span>
            {t("customer.companyInfo.registrationNumber")}{" "}
            <span className="text-red-500">*</span>
          </span>
        }
      >
        <InputField
          placeholder={t("customer.companyInfo.registrationNumber")}
          value={formData.registrationNumber}
          onChange={(e) => handleChange("registrationNumber", e.target.value)}
          onBlur={() => handleBlur("registrationNumber")}
          className={
            errors.registrationNumber && touched.registrationNumber
              ? "border-red-500"
              : ""
          }
        />
        {errors.registrationNumber && touched.registrationNumber && (
          <p className="text-red-500 text-xs mt-1">
            {errors.registrationNumber}
          </p>
        )}
      </FormRow>

      <FormRow
        label={
          <span>
            {t("customer.companyInfo.dateOfIncorporation")}{" "}
            <span className="text-red-500">*</span>
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
            errors.dateOfIncorporation && touched.dateOfIncorporation
              ? "border-red-500"
              : ""
          }
        />
        {errors.dateOfIncorporation && touched.dateOfIncorporation && (
          <p className="text-red-500 text-xs mt-1">
            {errors.dateOfIncorporation}
          </p>
        )}
      </FormRow>

      <FormRow
        label={
          <span>
            {t("customer.companyInfo.authorizedCapital")}{" "}
            <span className="text-red-500">*</span>
          </span>
        }
      >
        <InputField
          placeholder={t("customer.companyInfo.authorizedCapital")}
          type="text"
          value={formData.authorizedCapital}
          onChange={(e) =>
            handleChange(
              "authorizedCapital",
              handleAuthorizedCapitalChange(e.target.value)
            )
          }
          onBlur={(e) => {
            handleChange(
              "authorizedCapital",
              handleAuthorizedCapitalChange(e.target.value, true)
            );
            handleBlur("authorizedCapital");
          }}
          className={
            errors.authorizedCapital && touched.authorizedCapital
              ? "border-red-500"
              : ""
          }
        />
        {errors.authorizedCapital && touched.authorizedCapital && (
          <p className="text-red-500 text-xs mt-1">
            {errors.authorizedCapital}
          </p>
        )}
      </FormRow>

      <FormRow label={t("customer.companyInfo.yearsInBusiness")}>
        <InputField
          placeholder={t("customer.companyInfo.yearsInBusiness")}
          type="text"
          value={formData.yearsInBusiness}
          onChange={(e) => {
            // Only allow positive numbers
            const value = e.target.value.replace(/[^0-9]/g, "");
            handleChange("yearsInBusiness", value);
          }}
          onBlur={() => handleBlur("yearsInBusiness")}
          className={
            errors.yearsInBusiness && touched.yearsInBusiness
              ? "border-red-500"
              : ""
          }
        />
        {errors.yearsInBusiness && touched.yearsInBusiness && (
          <p className="text-red-500 text-xs mt-1">{errors.yearsInBusiness}</p>
        )}
      </FormRow>

      {/* <FormRow label="Country of Incorporation">
        <SelectField
          options={Object.entries(countries).map(([code, country]) => ({
            label: country.name,
            value: code,
            key: code,
          }))}
          value={formData.countryOfIncorporation}
          onChange={(e) =>
            handleChange("countryOfIncorporation", e.target.value)
          }
          onBlur={() => handleBlur("countryOfIncorporation")}
          className={errors.countryOfIncorporation && touched.countryOfIncorporation ? "border-red-500" : ""}
        />
        {errors.countryOfIncorporation && touched.countryOfIncorporation && (
          <p className="text-red-500 text-xs mt-1">{errors.countryOfIncorporation}</p>
        )}
      </FormRow> */}
      <FormRow
        label={
          <span>
            {t("customer.companyInfo.countryOfIncorporation")}{" "}
            <span className="text-red-500">*</span>
          </span>
        }
      >
        <DropdownBasic
          options={sortedCountryOptions}
          value={formData.countryOfIncorporation || ""}
          onChange={(selectedValue = "") =>
            handleChange("countryOfIncorporation", selectedValue)
          }
          onBlur={() => handleBlur("countryOfIncorporation")}
          placeholder={t("customer.companyInfo.selectCountry")}
          isClearable
          sortOptions={false}
          error={
            errors.countryOfIncorporation && touched.countryOfIncorporation
              ? errors.countryOfIncorporation
              : ""
          }
          shouldShowError={
            Boolean(errors.countryOfIncorporation) &&
            Boolean(touched.countryOfIncorporation)
          }
          showErrorText={false}
        />
        {errors.countryOfIncorporation && touched.countryOfIncorporation && (
          <p className="text-red-500 text-xs mt-1">
            {errors.countryOfIncorporation}
          </p>
        )}
      </FormRow>

      <FormRow
        label={
          <span>
            {t("customer.companyInfo.registeredAddress")}{" "}
            <span className="text-red-500">*</span>
          </span>
        }
      >
        <InputField
          placeholder={t("customer.companyInfo.registeredAddress")}
          value={formData.registeredAddress}
          onChange={(e) => handleChange("registeredAddress", e.target.value)}
          onBlur={() => handleBlur("registeredAddress")}
          className={
            errors.registeredAddress && touched.registeredAddress
              ? "border-red-500"
              : ""
          }
        />
        {errors.registeredAddress && touched.registeredAddress && (
          <p className="text-red-500 text-xs mt-1">
            {errors.registeredAddress}
          </p>
        )}
      </FormRow>

      <FormRow
        label={
          <span>
            {t("customer.companyInfo.billingAddress")}{" "}
            <span className="text-red-500">*</span>
          </span>
        }
      >
        <InputField
          placeholder={t("customer.companyInfo.billingAddress")}
          value={formData.billingAddress}
          onChange={(e) => handleChange("billingAddress", e.target.value)}
          onBlur={() => handleBlur("billingAddress")}
          className={
            errors.billingAddress && touched.billingAddress
              ? "border-red-500"
              : ""
          }
        />
        {errors.billingAddress && touched.billingAddress && (
          <p className="text-red-500 text-xs mt-1">{errors.billingAddress}</p>
        )}
      </FormRow>

      <FormRow label={t("customer.companyInfo.shippingAddress")}>
        <InputField
          placeholder={t("customer.companyInfo.shippingAddress")}
          value={formData.shippingAddress}
          onChange={(e) => handleChange("shippingAddress", e.target.value)}
          onBlur={() => handleBlur("shippingAddress")}
          className={
            errors.shippingAddress && touched.shippingAddress
              ? "border-red-500"
              : ""
          }
        />
        {errors.shippingAddress && touched.shippingAddress && (
          <p className="text-red-500 text-xs mt-1">{errors.shippingAddress}</p>
        )}
      </FormRow>

      <FormRow label={t("customer.companyInfo.phone")}>
        <InputField
          type="tel"
          placeholder={t("customer.companyInfo.phone")}
          value={formData.phone}
          onChange={(e) => {
            // Allow numbers, +, spaces, dashes, and parentheses
            const phoneValue = e.target.value.replace(/[^0-9+\s\-()]/g, "");
            handleChange("phone", phoneValue);
          }}
          onBlur={() => handleBlur("phone")}
          className={errors.phone && touched.phone ? "border-red-500" : ""}
        />
        {errors.phone && touched.phone && (
          <p className="text-red-500 text-xs mt-1">{errors.phone}</p>
        )}
      </FormRow>

      <FormRow label={t("customer.companyInfo.fax")}>
        <InputField
          placeholder={t("customer.companyInfo.fax")}
          value={formData.fax}
          onChange={(e) => handleChange("fax", e.target.value)}
          onBlur={() => handleBlur("fax")}
          className={errors.fax && touched.fax ? "border-red-500" : ""}
        />
        {errors.fax && touched.fax && (
          <p className="text-red-500 text-xs mt-1">{errors.fax}</p>
        )}
      </FormRow>

      <FormRow
        label={
          <span>
            {t("customer.companyInfo.typeOfBusiness")}{" "}
            <span className="text-red-500">*</span>
          </span>
        }
      >
        {loading ? (
          <p>{t("customer.companyInfo.loadingBusinessTypes")}</p>
        ) : (
          <DropdownAddNewForm
            fetchUrl={`${Base_URL}/items/Business Type/get_all`}
            addUrl={`${Base_URL}/items/Business Type/add`}
            businessId={businessId}
            selectedValue={formData.typeOfBusiness}
            onChange={(selected) => handleChange("typeOfBusiness", selected)}
            onBlur={() => handleBlur("typeOfBusiness")}
            className={
              errors.typeOfBusiness && touched.typeOfBusiness
                ? "border-red-500"
                : ""
            }
          />
        )}
        {errors.typeOfBusiness && touched.typeOfBusiness && (
          <p className="text-red-500 text-xs mt-1">{errors.typeOfBusiness}</p>
        )}
      </FormRow>

      <FormRow label={t("customer.companyInfo.natureOfBusiness")}>
        <InputField
          placeholder={t("customer.companyInfo.natureOfBusiness")}
          value={formData.natureOfBusiness}
          onChange={(e) => handleChange("natureOfBusiness", e.target.value)}
          onBlur={() => handleBlur("natureOfBusiness")}
          className={
            errors.natureOfBusiness && touched.natureOfBusiness
              ? "border-red-500"
              : ""
          }
        />
        {errors.natureOfBusiness && touched.natureOfBusiness && (
          <p className="text-red-500 text-xs mt-1">{errors.natureOfBusiness}</p>
        )}
      </FormRow>

      <FormRow label={t("customer.companyInfo.companyWebsite")}>
        <InputField
          placeholder={t("customer.companyInfo.companyWebsite")}
          value={formData.companyWebsite}
          onChange={(e) => handleChange("companyWebsite", e.target.value)}
          onBlur={() => handleBlur("companyWebsite")}
          className={
            errors.companyWebsite && touched.companyWebsite
              ? "border-red-500"
              : ""
          }
        />
        {errors.companyWebsite && touched.companyWebsite && (
          <p className="text-red-500 text-xs mt-1">{errors.companyWebsite}</p>
        )}
      </FormRow>
      <FormRow label={t("customer.companyInfo.annualSalesVolume")}>
        <InputField
          placeholder={t("customer.companyInfo.annualSalesVolume")}
          type="text"
          value={formData.annualSalesVolume}
          onChange={(e) =>
            handleChange(
              "annualSalesVolume",
              handleAnnualSalesVolumeChange(e.target.value)
            )
          }
          onBlur={(e) => {
            handleChange(
              "annualSalesVolume",
              handleAnnualSalesVolumeChange(e.target.value, true)
            );
            handleBlur("annualSalesVolume");
          }}
          className={
            errors.annualSalesVolume && touched.annualSalesVolume
              ? "border-red-500"
              : ""
          }
        />
        {errors.annualSalesVolume && touched.annualSalesVolume && (
          <p className="text-red-500 text-xs mt-1">
            {errors.annualSalesVolume}
          </p>
        )}
      </FormRow>
      <FormRow label={t("customer.companyInfo.companyLogo")}>
        <div className="space-y-2">
          <div className="relative">
            <input
              type="file"
              id="logo-upload"
              className="hidden"
              accept="image/jpeg,image/png"
              onChange={handleLogoUpload}
            />
            <label
              htmlFor="logo-upload"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white bg-[var(--p-blue)] cursor-pointer hover:bg-[#7db535]"
            >
              <FiUpload className="text-lg" />
              {t("customer.companyInfo.uploadLogo")}
            </label>
          </div>

          {logoPreview && (
            <div className="mt-2">
              <p className="text-sm text-gray-600 mb-1">
                {t("customer.companyInfo.logoPreview")}
              </p>
              <img
                src={logoPreview}
                alt={t("customer.companyInfo.companyLogo")}
                className="h-20 w-auto object-contain border rounded-md"
              />
            </div>
          )}
          {logoPreview && (
            <button
              onClick={() => {
                setLogoPreview(null);
                handleChange("companyLogo", "");
              }}
              className="mt-2 text-sm text-red-600 underline"
            >
              {t("customer.companyInfo.removeLogo")}
            </button>
          )}

          {errors.companyLogo && touched.companyLogo && (
            <p className="text-red-500 text-xs mt-1">{errors.companyLogo}</p>
          )}
          <p className="text-xs text-gray-500">
            {t("customer.companyInfo.acceptedFormats")}
          </p>
        </div>
      </FormRow>
    </div>
  );
};

export default CompanyInfo;
