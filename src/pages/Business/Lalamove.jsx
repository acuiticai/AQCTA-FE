import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

import axios from "axios";
import { Button } from "@/page-layouts/index";

const Lalamove = ({ businessId }) => {
  console.log("businessId:", businessId);
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm();

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [apiResponse, setApiResponse] = useState(null);
  const [formData, setFormData] = useState({
    Host_Name: "",
    API_Key: "",
    API_Secret: "",
  });
  useEffect(() => {
    if (businessId) {
      fetchExistingData();
    }
  }, [businessId]);

  const fetchExistingData = async () => {
    try {
      console.log("Fetching Lalamove data for businessId:", businessId);
      const response = await axios.get(
        `${Base_URL}/lalamove/get/${businessId}`
      );
      console.log("response:", response);

      if (response.data.status && response.data.data.length > 0) {
        const matchedData = response.data.data.find(
          (item) => item.business_id === businessId
        );

        if (matchedData) {
          console.log("Matched Lalamove Data:", matchedData);

          setApiResponse(matchedData);
          const updatedFormData = {
            Host_Name: matchedData.hostName || "",
            API_Key: matchedData.apiKey || "",
            API_Secret: matchedData.apiSecret || "",
          };

          setFormData(updatedFormData);
          setValue("Host_Name", updatedFormData.Host_Name);
          setValue("API_Key", updatedFormData.API_Key);
          setValue("API_Secret", updatedFormData.API_Secret);

          // Save to localStorage (Optional)
          localStorage.setItem("lalamoveData", JSON.stringify(updatedFormData));
        } else {
          console.warn("No matching Lalamove data found for this business ID.");
          setApiResponse(null);
        }
      } else {
        console.warn("No Lalamove configurations found.");
      }
    } catch (error) {
      console.error("Error fetching Lalamove data:", error);
    }
  };

  // **Handle form submission**
  const onSubmit = async (data) => {
    setLoading(true);
    setMessage("");

    const payload = {
      hostName: data.Host_Name,
      apiKey: data.API_Key,
      business_id: businessId,
      apiSecret: data.API_Secret,
    };

    console.log("Payload:", payload);

    try {
      let response;
      if (apiResponse && apiResponse._id) {
        response = await axios.post(`${Base_URL}/lalamove/add`, payload);
      } else {
      }

      if (response.status === 200) {
        setMessage(
          apiResponse
            ? t("business.lalamoveConfigurationUpdatedSuccessfully")
            : t("business.lalamoveConfigurationAddedSuccessfully")
        );
        fetchExistingData(); // Refresh data
      }
    } catch (error) {
      console.error("Request Failed:", error.response || error);
      setMessage(error.response?.data?.message || t("business.failedToProcessRequest"));
    } finally {
      setLoading(false);
    }
  };

  // **Save data to localStorage when user types**
  const handleInputChange = (field, value) => {
    const updatedData = { ...formData, [field]: value };
    setFormData(updatedData);
    setValue(field, value);
    localStorage.setItem(
      `lalamoveForm_${businessId}`,
      JSON.stringify(updatedData)
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Host Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t("business.hostName")}
          </label>
          <input
            {...register("Host_Name", { required: t("business.hostNameIsRequired") })}
            placeholder={t("business.enterHostName")}
            className="border border-gray-300 rounded-lg p-2 w-full"
            value={formData.Host_Name}
            onChange={(e) => handleInputChange("Host_Name", e.target.value)}
          />
          {errors.Host_Name && (
            <p className="text-red-500 text-sm">{errors.Host_Name.message}</p>
          )}
        </div>

        {/* API Key */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t("business.apiKey")}
          </label>
          <input
            {...register("API_Key", { required: t("business.apiKeyIsRequired") })}
            placeholder={t("business.enterApiKey")}
            className="border border-gray-300 rounded-lg p-2 w-full"
            value={formData.API_Key}
            onChange={(e) => handleInputChange("API_Key", e.target.value)}
          />
          {errors.API_Key && (
            <p className="text-red-500 text-sm">{errors.API_Key.message}</p>
          )}
        </div>

        {/* API Secret */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t("business.apiSecret")}
          </label>
          <input
            {...register("API_Secret", {
              required: t("business.apiSecretIsRequired"),
            })}
            placeholder={t("business.enterApiSecret")}
            className="border border-gray-300 rounded-lg p-2 w-full"
            value={formData.API_Secret}
            onChange={(e) => handleInputChange("API_Secret", e.target.value)}
          />
          {errors.API_Secret && (
            <p className="text-red-500 text-sm">{errors.API_Secret.message}</p>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex gap-4 ">
        <Button
          className="bg-p-blue hover:bg-p-blue-dark"
          type="submit"
          disabled={loading}
        >
          {loading
            ? t("Updating...")
            : apiResponse && apiResponse._id
            ? t("Update")
            : t("Save")}
        </Button>
      </div>

      {/* Display Status Message */}
      {message && (
        <p className="mt-4 text-sm font-medium text-green-600">{message}</p>
      )}
    </form>
  );
};

export default Lalamove;
