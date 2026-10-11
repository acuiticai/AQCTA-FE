import React, { useState, useEffect } from "react";
import FormRow from "../reusablecomponents/FormRow";
import InputField from "../reusablecomponents/InputField";
import SelectField from "../reusablecomponents/SelectField";
import axios from "axios";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL; // Base API URL

const SalePerson = ({ onChange, initialData = {}, businessId, setValidationErrors }) => {
  const [formData, setFormData] = useState({
    name: "",
    position: "",
    officeNumber: "",
    contact: { phone: "", email: "" },
  });

  const [errors, setErrors] = useState({}); // ✅ Validation Errors
  const [positions, setPositions] = useState([]); // ✅ Position list
  const [isLoading, setIsLoading] = useState(false); // ✅ Loading state

  // ✅ Fetch positions when `businessId` changes
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

  // ✅ Load initial data when it changes
  useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) {
      setFormData({
        ...initialData,
        contact: {
          ...(initialData.contact || { phone: "", email: "" }),
        },
      });
    }
  }, [initialData]);

  // ✅ Validation function for Email & Malay Phone Number
  const validateForm = () => {
    let errorsFound = {};

    // ✅ Validate Phone
    const phoneRegex = /^(?:\+60|0)[0-9]{9,10}$/;
    if (!phoneRegex.test(formData.contact.phone) && formData.contact.phone) {
      errorsFound.phone = "Invalid phone number";
    }

    // ✅ Validate Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.contact.email) && formData.contact.email) {
      errorsFound.email = "Invalid email address";
    }

    setErrors(errorsFound);

    // ✅ If there are errors, disable the Save button in parent component
    setValidationErrors((prevErrors) => ({
      ...prevErrors,
      salePerson: Object.keys(errorsFound).length > 0, // ✅ True if there are errors
    }));
  };

  // ✅ Run validation whenever formData changes
  useEffect(() => {
    validateForm();
  }, [formData]);

  // ✅ Handle Input Changes & Update Parent
  const handleChange = (field, value) => {
    setFormData((prev) => {
      const updatedData = { ...prev, [field]: value };
      onChange && onChange(updatedData);
      return updatedData;
    });
  };

  // ✅ Handle Nested Contact Changes
  const handleNestedChange = (parentField, childField, value) => {
    setFormData((prev) => {
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

  return (
    <div className="space-y-6">
      {/* Name */}
      <FormRow label="Name">
        <InputField
          placeholder="Name"
          value={formData.name}
          onChange={(e) => handleChange("name", e.target.value)}
        />
      </FormRow>

      {/* Position (Fetched from API) */}
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

      {/* Office Number */}
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

      {/* Contact */}
      <FormRow label="Contact">
        <div className="flex space-x-4">
          {/* ✅ Phone Input with Malay Validation */}
          <div>
            <InputField
              placeholder="Phone"
              value={formData.contact?.phone || ""}
              onChange={(e) =>
                handleNestedChange("contact", "phone", e.target.value)
              }
            />
            {errors.phone && <p className="text-xs text-red-500">{errors.phone}</p>}
          </div>

          {/* ✅ Email Input with Validation */}
          <div>
            <InputField
              placeholder="Email"
              value={formData.contact?.email || ""}
              onChange={(e) =>
                handleNestedChange("contact", "email", e.target.value)
              }
            />
            {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
          </div>
        </div>
      </FormRow>
    </div>
  );
};

export default SalePerson;
