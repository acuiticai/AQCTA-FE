import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { Button } from "@windmill/react-ui";
import axios from "axios";

const ZohoTab = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  const onSubmit = async (data) => {
    setLoading(true);
    setMessage("");
    try {
      const response = await axios.post(
        "https://your-api-endpoint.com/zoho",
        data
      );
      if (response.status === 200) {
        setMessage("Data saved successfully!");
      }
    } catch (error) {
      setMessage("An error occurred while saving the data. Please try again.");
      console.error("API Error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Row 1 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t("Host Name")}
          </label>
          <input
            {...register("Host_Name", { required: t("Host Name is required") })}
            placeholder={t("Enter Host Name")}
            className="border border-gray-300 rounded-lg p-2 w-full"
          />
          {errors.Host_Name && (
            <p className="text-red-500 text-sm">{errors.Host_Name.message}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t("API Key")}
          </label>
          <input
            {...register("API_Key", {
              required: t("API Key is required"),
            })}
            placeholder={t("Enter API Key")}
            className="border border-gray-300 rounded-lg p-2 w-full"
          />
          {errors.API_Key && (
            <p className="text-red-500 text-sm">{errors.API_Key.message}</p>
          )}
        </div>

        {/* Row 2 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t("API Secret")}
          </label>
          <input
            {...register("API_Secret", {
              required: t("API Secret is required"),
            })}
            placeholder={t("Enter API Secret")}
            className="border border-gray-300 rounded-lg p-2 w-full"
          />
          {errors.API_Secret && (
            <p className="text-red-500 text-sm">{errors.API_Secret.message}</p>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex justify-center gap-4">
        <Button type="submit" disabled={loading}>
          {loading ? t("Updating...") : t("Update")}
        </Button>
      </div>
      {message && (
        <p className="mt-4 text-sm font-medium text-green-600">{message}</p>
      )}
    </form>
  );
};

export default ZohoTab;
