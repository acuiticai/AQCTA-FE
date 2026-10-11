import React, { useState, useEffect } from "react";
import FormRow from "../reusablecomponents/FormRow";
import InputField from "../reusablecomponents/InputField";
import SelectField from "../reusablecomponents/SelectField";
import DropdownWithAddNewForm from "@/components/DropdownAddNewForm";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const SalePerson = ({ onChange, initialData = {}, businessId, setValidationErrors, saveAttempted = false }) => {
  const requiredFields = ["name", "contact.phone", "contact.email"];

  const [formData, setFormData] = useState({
    name: "",
    position: "",
    officeNumber: "",
    contact: { phone: "", email: "" },
  });

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  // Load initial data
  useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) {
      setFormData({
        ...initialData,
        contact: { ...(initialData.contact || { phone: "", email: "" }) },
      });
      validateFormSilently(initialData);
    }
  }, [initialData]);

  useEffect(() => {
    if (saveAttempted) {
      const allTouched = {};
      requiredFields.forEach((field) => {
        allTouched[field] = true;
      });
      setTouched((prev) => ({ ...prev, ...allTouched }));
      validateFieldsWithTouched(formData);
    }
  }, [saveAttempted]);

  useEffect(() => {
    if (Object.keys(touched).length > 0) {
      validateFieldsWithTouched(formData);
    } else {
      validateFormSilently(formData);
    }
  }, [formData]);

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  // Validate international phone numbers (E.164-ish). Allows leading "+", spaces, dashes, and parentheses.
  // Valid if it contains 7–15 digits total and at most one leading "+".
  const validatePhoneNumber = (phone) => {
    if (!phone || typeof phone !== "string") return false;
    const trimmed = phone.trim();
    const plusOccurrences = (trimmed.match(/\+/g) || []).length;
    if (plusOccurrences > 1) return false;
    if (plusOccurrences === 1 && trimmed[0] !== "+") return false;
    const digitsOnly = trimmed.replace(/\D/g, "");
    return digitsOnly.length >= 7 && digitsOnly.length <= 15;
  };

  const validateField = (name, value, data = formData) => {
    const parts = name.split(".");
    let fieldValue = value;
    if (value === undefined) {
      fieldValue = parts.length > 1 ? data[parts[0]]?.[parts[1]] : data[name];
    }

    if (requiredFields.includes(name) && (!fieldValue || fieldValue.trim() === "")) {
      const label = parts[parts.length - 1];
      return `${label.charAt(0).toUpperCase() + label.slice(1)} is required`;
    }

    if (name === "contact.email" && fieldValue && !validateEmail(fieldValue)) {
      return "Invalid email format";
    }

    if (name === "contact.phone" && fieldValue && !validatePhoneNumber(fieldValue)) {
      return "Invalid phone number. Use 7–15 digits; +, spaces, dashes, () allowed";
    }

    return "";
  };

  const validateFormSilently = (data) => {
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
    setValidationErrors?.({ salePerson: !isValid });
  };

  const validateFieldsWithTouched = (data) => {
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
    setValidationErrors?.({ salePerson: !isValid });
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

  const shouldShowError = (field) => touched[field] && !!validateField(field, formData[field]);
  const shouldShowNestedError = (parent, child) => {
    const key = `${parent}.${child}`;
    return touched[key] && !!validateField(key, formData[parent]?.[child]);
  };

  const handleChange = (field, value) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      onChange?.(updated);
      return updated;
    });
  };

  const handleNestedChange = (parent, child, value) => {
    setFormData((prev) => {
      const updated = {
        ...prev,
        [parent]: { ...(prev[parent] || {}), [child]: value },
      };
      onChange?.(updated);
      return updated;
    });
  };

  return (
    <div className="space-y-6">
      <FormRow label="Name">
        <InputField
          placeholder="Name"
          value={formData.name}
          onChange={(e) => handleChange("name", e.target.value)}
          onBlur={() => handleBlur("name")}
          className={shouldShowError("name") ? "border-red-500" : ""}
        />
        {shouldShowError("name") && (
          <p className="text-red-500 text-xs mt-1 font-medium">
            {validateField("name", formData.name)}
          </p>
        )}
      </FormRow>

      <FormRow label="Position">
        <DropdownWithAddNewForm
          placeholder="Select Position"
          fetchUrl={`${Base_URL}/items/Position/get_all`}
          addUrl={`${Base_URL}/items/Position/add`}
          businessId={businessId}
          selectedValue={formData.position}
          onChange={(selected) => handleChange("position", selected)}
        />
      </FormRow>

      <FormRow label="Office Number">
        <SelectField
          options={[
            { label: "Main Office", value: "main_office" },
            { label: "Branch Office", value: "branch_office" },
            { label: "Headquarters", value: "headquarters" },
          ]}
          value={formData.officeNumber}
          onChange={(e) => handleChange("officeNumber", e.target.value)}
          defaultValue="Select Office Number"
        />
      </FormRow>

      <FormRow label="Contact">
        <div className="flex space-x-4">
          <div>
            <InputField
              type="tel"
              placeholder="Phone"
              value={formData.contact?.phone || ""}
              onChange={(e) => {
                // Allow numbers, +, spaces, dashes, and parentheses
                const phoneValue = e.target.value.replace(/[^0-9+\s\-()]/g, "");
                handleNestedChange("contact", "phone", phoneValue);
              }}
              onBlur={() => handleNestedBlur("contact", "phone")}
              className={shouldShowNestedError("contact", "phone") ? "border-red-500" : ""}
            />
            {shouldShowNestedError("contact", "phone") && (
              <p className="text-red-500 text-xs mt-1 font-medium">
                {validateField("contact.phone", formData.contact?.phone)}
              </p>
            )}
          </div>

          <div>
            <InputField
              placeholder="Email"
              value={formData.contact?.email || ""}
              onChange={(e) => handleNestedChange("contact", "email", e.target.value)}
              onBlur={() => handleNestedBlur("contact", "email")}
              className={shouldShowNestedError("contact", "email") ? "border-red-500" : ""}
            />
            {shouldShowNestedError("contact", "email") && (
              <p className="text-red-500 text-xs mt-1 font-medium">
                {validateField("contact.email", formData.contact?.email)}
              </p>
            )}
          </div>
        </div>
      </FormRow>
    </div>
  );
};

export default SalePerson;
