import React, { useState, useEffect } from "react";
import FormRow from "../reusablecomponents/FormRow";
import InputField from "../reusablecomponents/InputField";
import axios from "axios";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL; // Base API URL

const OtherDetails = ({ onChange, initialData = {}, businessId, setValidationErrors }) => {
  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const validatePhoneNumber = (phone) =>
    /^(?:\+?6?01)[0-46-9]-?[0-9]{7,8}$/.test(phone);

  const [errors, setErrors] = useState({
    contact: { phone: "", email: "" },
  });

  const [formData, setFormData] = useState({
    name: "",
    position: "",
    officeNumber: "",
    contact: { phone: "", email: "" },
  });

  const [positions, setPositions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasErrors, setHasErrors] = useState(false); // ✅ Track validation errors

  useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) {
      setFormData({
        ...initialData,
        contact: { ...(initialData.contact || { phone: "", email: "" }) },
      });
    }
  }, [initialData]);

  // ✅ Fetch positions from API (POST request)
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

  // ✅ Update errors & prevent saving if invalid
  const validateForm = () => {
    const hasPhoneError = !validatePhoneNumber(formData.contact.phone);
    const hasEmailError = !validateEmail(formData.contact.email);

    setErrors({
      contact: {
        phone: hasPhoneError ? "Invalid Malaysian phone number" : "",
        email: hasEmailError ? "Invalid email format" : "",
      },
    });

    // ✅ Update validation state & send to parent
    const hasErrors = hasPhoneError || hasEmailError;
    setHasErrors(hasErrors);
    setValidationErrors((prev) => ({
      ...prev,
      otherDetails: hasErrors,
    }));

    return !hasErrors;
  };

  // ✅ Handle Input Changes
  const handleChange = (field, value) => {
    setFormData((prev) => {
      const updatedData = { ...prev, [field]: value };
      onChange(updatedData);
      return updatedData;
    });

    validateForm();
  };

  const handleNestedChange = (parentField, childField, value) => {
    setFormData((prev) => {
      const updatedData = {
        ...prev,
        [parentField]: {
          ...(prev[parentField] || {}),
          [childField]: value,
        },
      };

      onChange(updatedData);
      return updatedData;
    });

    validateForm();
  };

  return (
    <div className="space-y-4">
      <FormRow label="Name">
        <InputField
          placeholder="Name"
          value={formData.name}
          onChange={(e) => handleChange("name", e.target.value)}
        />
      </FormRow>

      <FormRow label="Position">
        {isLoading ? (
          <p>Loading positions...</p>
        ) : (
          <select
            value={formData.position}
            onChange={(e) => handleChange("position", e.target.value)}
            className="w-full border border-gray-300 rounded-lg p-2 bg-gray-50 focus:outline-none"
            disabled={!businessId}
          >
            <option value="">Select Position</option>
            {positions.map((pos) => (
              <option key={pos._id} value={pos.name}>
                {pos.name}
              </option>
            ))}
          </select>
        )}
      </FormRow>

      <FormRow label="Office Number">
        <InputField
          placeholder="Office Number"
          value={formData.officeNumber}
          onChange={(e) => handleChange("officeNumber", e.target.value)}
        />
      </FormRow>

      <FormRow label="Contact">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <InputField
              placeholder="Phone"
              value={formData.contact?.phone}
              onChange={(e) =>
                handleNestedChange("contact", "phone", e.target.value)
              }
              className={errors.contact.phone ? "border-red-500" : ""}
            />
            {errors.contact.phone && (
              <p className="text-red-500 text-sm">{errors.contact.phone}</p>
            )}
          </div>

          <div>
            <InputField
              placeholder="Email"
              value={formData.contact?.email}
              onChange={(e) =>
                handleNestedChange("contact", "email", e.target.value)
              }
              className={errors.contact.email ? "border-red-500" : ""}
            />
            {errors.contact.email && (
              <p className="text-red-500 text-sm">{errors.contact.email}</p>
            )}
          </div>
        </div>
      </FormRow>
    </div>
  );
};

export default OtherDetails;
