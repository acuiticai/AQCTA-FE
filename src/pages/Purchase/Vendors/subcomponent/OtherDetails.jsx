import React, { useState, useEffect } from "react";
import FormRow from "../reusablecomponents/FormRow";
import InputField from "../reusablecomponents/InputField";
import axios from "axios";
import DropdownAddNewForm from "@/components/DropdownAddNewForm";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL; // Base API URL

const OtherDetails = ({ onChange, initialData = {}, businessId, setValidationErrors, saveAttempted = false }) => {
  // Define required fields
  const requiredFields = ["name", "contact.phone", "contact.email"];

  // Validation functions
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

  // Track which fields have been touched by user interaction
  const [touched, setTouched] = useState({});
  
  // Error messages state
  const [errors, setErrors] = useState({});

  const [formData, setFormData] = useState({
    name: "",
    position: "",
    officeNumber: "",
    contact: { phone: "", email: "" },
  });

  const [positions, setPositions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize form data from props
  useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) {
      setFormData({
        ...initialData,
        contact: { ...(initialData.contact || { phone: "", email: "" }) },
      });
      
      // Run validation silently to update parent validation state
      validateFormSilently();
    }
  }, [initialData]);

  // When saveAttempted changes to true, mark all fields as touched
  useEffect(() => {
    if (saveAttempted) {
      const allTouched = {};
      requiredFields.forEach(field => {
        allTouched[field] = true;
      });
      setTouched(prev => ({
        ...prev,
        ...allTouched
      }));
      
      // Re-validate with all fields touched
      validateFieldsWithTouched(formData);
    }
  }, [saveAttempted, formData]);

  // Fetch positions from API
  useEffect(() => {
    if (!businessId) return; 

    const fetchPositions = async () => {
      setIsLoading(true);
      try {
        const response = await axios.post(`${Base_URL}/items/Position/get_all`, {
          business_id: businessId,
          FilterStatus: "active",
          FilterName: "",
        });

        if (response.data.success) {
          setPositions(response.data.data);
        } else {
          throw new Error("Invalid response format");
        }
      } catch (error) {
        console.error("❌ Error fetching positions:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPositions();
  }, [businessId]);

  // Validate a specific field
  const validateField = (name, value, data = formData) => {
    // Use dot notation to handle nested fields
    const fieldPath = name.split('.');
    let fieldValue = value;
    
    // If value is not provided, extract it from formData
    if (value === undefined) {
      fieldValue = fieldPath.length > 1 
        ? data[fieldPath[0]]?.[fieldPath[1]] 
        : data[name];
    }
    
    // Check required fields
    if (requiredFields.includes(name) && (!fieldValue || fieldValue.trim() === "")) {
      const fieldName = name.includes('.') ? name.split('.')[1] : name;
      return `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} is required`;
    }
    
    // Specific validation rules
    if (name === "contact.email" && fieldValue) {
      if (!validateEmail(fieldValue)) {
        return "Invalid email format";
      }
    }
    
    if (name === "contact.phone" && fieldValue) {
      if (!validatePhoneNumber(fieldValue)) {
        return "Invalid phone number. Use 7–15 digits; +, spaces, dashes, () allowed";
      }
    }
    
    return "";
  };

  // Run validation without showing errors to user (for parent component state)
  const validateFormSilently = (data = formData) => {
    const newErrors = {};
    let isValid = true;
    
    // Validate required fields
    requiredFields.forEach(field => {
      const fieldPath = field.split('.');
      const fieldValue = fieldPath.length > 1 
        ? data[fieldPath[0]]?.[fieldPath[1]] 
        : data[field];
      
      const error = validateField(field, fieldValue, data);
      if (error) {
        if (field.includes('.')) {
          const [parent, child] = field.split('.');
          newErrors[parent] = newErrors[parent] || {};
          newErrors[parent][child] = error;
        } else {
          newErrors[field] = error;
        }
        isValid = false;
      }
    });
    
    // Update parent component validation state
    if (setValidationErrors) {
      setValidationErrors({
        otherDetails: !isValid
      });
    }
    
    // Store errors but don't display them yet
    setErrors(newErrors);
    
    return isValid;
  };
  
  // Run validation when form data changes
  useEffect(() => {
    if (Object.keys(touched).length > 0) {
      validateFieldsWithTouched(formData);
    } else {
      validateFormSilently(formData);
    }
  }, [formData]);

  // Handle input changes for top-level fields
  const handleChange = (field, value) => {
    setFormData(prev => {
      const updatedData = { ...prev, [field]: value };
      onChange && onChange(updatedData);
      return updatedData;
    });
  };

  // Handle input changes for nested fields
  const handleNestedChange = (parentField, childField, value) => {
    setFormData(prev => {
      const updatedData = {
        ...prev,
        [parentField]: {
          ...(prev[parentField] || {}),
          [childField]: value,
        },
      };

      onChange && onChange(updatedData);
      return updatedData;
    });
  };

  // Mark field as touched on blur
 // Mark field as touched on blur
// Mark field as touched and validate immediately
const handleBlur = (field) => {
  const updatedTouched = { ...touched, [field]: true };
  setTouched(updatedTouched); // set immediately
  validateFieldsWithTouched(formData, updatedTouched); // pass latest touched
};

// Mark nested field as touched and validate immediately
const handleNestedBlur = (parentField, childField) => {
  const fieldPath = `${parentField}.${childField}`;
  const updatedTouched = { ...touched, [fieldPath]: true };
  setTouched(updatedTouched); // set immediately
  validateFieldsWithTouched(formData, updatedTouched); // pass latest touched
};


// Updated validateFieldsWithTouched
const validateFieldsWithTouched = (data = formData, customTouched = touched) => {
  const newErrors = {};
  let isValid = true;

  requiredFields.forEach((field) => {
    const fieldPath = field.split('.');
    const fieldValue = fieldPath.length > 1
      ? data[fieldPath[0]]?.[fieldPath[1]]
      : data[field];

    const error = validateField(field, fieldValue, data);

    // Only show error if field is touched
    if (customTouched[field] && error) {
      if (field.includes('.')) {
        const [parent, child] = field.split('.');
        newErrors[parent] = newErrors[parent] || {};
        newErrors[parent][child] = error;
      } else {
        newErrors[field] = error;
      }
    }

    if (error) {
      isValid = false;
    }
  });

  setErrors(newErrors);

  if (setValidationErrors) {
    setValidationErrors({
      otherDetails: !isValid,
    });
  }

  return isValid;
};


  // Helper to determine if a field has an error and should show it
  const shouldShowError = (field) => {
    return touched[field] && errors[field];
  };

  // Helper for nested fields
  const shouldShowNestedError = (parent, child) => {
    const fieldPath = `${parent}.${child}`;
    return touched[fieldPath] && errors[parent]?.[child];
  };

  return (
    <div className="space-y-4">
      <FormRow label="Name">
        <InputField
          placeholder="Name"
          value={formData.name}
          onChange={(e) => handleChange("name", e.target.value)}
          onBlur={() => handleBlur("name")}
          className={shouldShowError("name") ? "border-red-500" : ""}
        />
        {shouldShowError("name") && (
          <p className="text-red-500 text-xs mt-1 font-medium">{errors.name}</p>
        )}
      </FormRow>

      <FormRow label="Position">
        {isLoading ? (
          <p>Loading positions...</p>
        ) : (
          <DropdownAddNewForm
            placeholder="Select Position"
            fetchUrl={`${Base_URL}/items/Position/get_all`}
            addUrl={`${Base_URL}/items/Position/add`}
            businessId={businessId}
            selectedValue={formData.position}
            onChange={(selected) => handleChange("position", selected)}
            onBlur={() => handleBlur("position")}
            className={shouldShowError("position") ? "border-red-500" : ""}
          />
        )}
        {shouldShowError("position") && (
          <p className="text-red-500 text-xs mt-1 font-medium">{errors.position}</p>
        )}
      </FormRow>

      <FormRow label="Office Number">
        <InputField
          placeholder="Office Number"
          value={formData.officeNumber}
          onChange={(e) => handleChange("officeNumber", e.target.value)}
          onBlur={() => handleBlur("officeNumber")}
          className={shouldShowError("officeNumber") ? "border-red-500" : ""}
        />
        {shouldShowError("officeNumber") && (
          <p className="text-red-500 text-xs mt-1 font-medium">{errors.officeNumber}</p>
        )}
      </FormRow>

      <FormRow label="Contact">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <InputField
              type="tel"
              placeholder="Phone"
              value={formData.contact?.phone}
              onChange={(e) => {
                // Allow numbers, +, spaces, dashes, and parentheses
                const phoneValue = e.target.value.replace(/[^0-9+\s\-()]/g, "");
                handleNestedChange("contact", "phone", phoneValue);
              }}
              onBlur={() => handleNestedBlur("contact", "phone")}
              className={shouldShowNestedError("contact", "phone") ? "border-red-500" : ""}
            />
            {shouldShowNestedError("contact", "phone") && (
              <p className="text-red-500 text-xs mt-1 font-medium">{errors.contact.phone}</p>
            )}
          </div>

          <div>
            <InputField
              placeholder="Email"
              value={formData.contact?.email}
              onChange={(e) =>
                handleNestedChange("contact", "email", e.target.value)
              }
              onBlur={() => handleNestedBlur("contact", "email")}
              className={shouldShowNestedError("contact", "email") ? "border-red-500" : ""}
            />
            {shouldShowNestedError("contact", "email") && (
              <p className="text-red-500 text-xs mt-1 font-medium">{errors.contact.email}</p>
            )}
          </div>
        </div>
      </FormRow>
    </div>
  );
};

export default OtherDetails;