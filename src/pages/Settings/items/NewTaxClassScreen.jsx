import React, { useState, useEffect, useMemo } from "react";
import { useHistory, useLocation } from "react-router-dom";
import axios from "axios";
import { notifySuccess, notifyError } from "@/utils/toast";
import useButtonColor from "@/hooks/useButtonColor";
import {
  BackButton,
  PageHeader,
} from "@/page-layouts/";
import { Form } from "@/page-layouts/index";
import AppLayout from "../app-layout";
import Header from "@/components/header/Header";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const NewTaxClassScreen = () => {
  const history = useHistory();
  const location = useLocation();
  const buttonColor = useButtonColor();

  const [formData, setFormData] = useState({
    business: "",
    name: "",
    percentage: "",
    type: "exclusive",
    isActive: true,
    description: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState({
    form: false,
  });

  useEffect(() => {
    // Get selectedOrg from URL query params
    const searchParams = new URLSearchParams(location.search);
    const selectedOrg = searchParams.get("selectedOrg");
    if (selectedOrg) {
      setFormData((prev) => ({
        ...prev,
        business: selectedOrg,
      }));
    }
    setIsLoading((prev) => ({ ...prev, form: false }));
  }, [location.search]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const validateForm = () => {
    // Business validation
    if (!formData.business) {
      notifyError("Business is required");
      return false;
    }
    
    // Name validation
    if (!formData.name || formData.name.trim() === "") {
      notifyError("Please enter tax class name");
      return false;
    }
    
    // Percentage validation
    if (!formData.percentage || formData.percentage === "") {
      notifyError("Please enter percentage");
      return false;
    }
    
    const percentage = parseFloat(formData.percentage);
    if (isNaN(percentage) || percentage < 0 || percentage > 100) {
      notifyError("Percentage must be between 0 and 100");
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      const submitData = {
        business: formData.business,
        name: formData.name.trim(),
        percentage: parseFloat(formData.percentage),
        type: formData.type || "exclusive",
        isActive: formData.isActive !== false,
        description: formData.description?.trim() || "",
      };

      await axios.post(`${Base_URL}/tax-classes`, submitData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      notifySuccess("Tax class created successfully!");
      const searchParams = new URLSearchParams(location.search);
      const selectedOrg = searchParams.get("selectedOrg");
      history.push(`/tax-classes?selectedOrg=${selectedOrg}`);
    } catch (err) {
      if (err.response?.status === 400) {
        notifyError(err.response?.data?.message || "All required fields must be filled!");
      } else if (err.response?.status === 409) {
        notifyError(err.response?.data?.message || "Tax class already exists!");
      } else {
        notifyError(err.response?.data?.message || "Failed to save tax class.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Build form fields array
  const formFields = useMemo(() => {
    const fields = [
      {
        label: "Name",
        name: "name",
        type: "text",
        required: true,
        placeholder: "Enter Tax Class Name (e.g., SST 6%)",
        value: formData.name,
        onChange: handleInputChange,
      },
      {
        label: "Rate (%)",
        name: "percentage",
        type: "number",
        required: true,
        placeholder: "Enter Rate (0-100)",
        value: formData.percentage,
        onChange: handleInputChange,
        min: "0",
        max: "100",
        step: "0.01",
      },
      {
        label: "Tax Type",
        name: "type",
        type: "select",
        required: true,
        value: formData.type,
        onChange: handleInputChange,
        options: [
          { value: "exclusive", label: "Exclusive (tax added on top of price)" },
          { value: "inclusive", label: "Inclusive (tax included in price)" },
          { value: "zero_rated", label: "Zero-Rated (0% taxable)" },
          { value: "exempt", label: "Exempt (not subject to tax)" },
        ],
      },
      {
        label: "Description",
        name: "description",
        type: "text",
        required: false,
        placeholder: "Optional notes (e.g., Royal Malaysian Customs SST)",
        value: formData.description,
        onChange: handleInputChange,
      },
    ];

    return fields;
  }, [formData]);

  if (isLoading.form) {
    return (
      <AppLayout>
        <Header title="New Tax Class" />
        <div className="p-6 bg-white min-h-screen flex items-center justify-center">
          <div className="w-16 h-16 border-4 border-t-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Header title="New Tax Class" />
      <div className="py-6 px-6 min-h-screen">
        <BackButton />
        <PageHeader title="New Tax Class" />
        <Form
          formFields={formFields}
          handleSubmit={handleSubmit}
          handleCancel={() => {
            const searchParams = new URLSearchParams(location.search);
            const selectedOrg = searchParams.get("selectedOrg");
            history.push(`/tax-classes?selectedOrg=${selectedOrg}`);
          }}
          loading={loading}
          buttonColor={buttonColor}
          isOpen={true}
          submitText="Save"
          cancelText="Cancel"
          fieldsPerRow={1}
        />
      </div>
    </AppLayout>
  );
};

export default NewTaxClassScreen;
