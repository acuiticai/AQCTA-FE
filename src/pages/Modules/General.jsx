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
            {t("Distance for Free Delivery")}
          </label>
          <input
            {...register("Distance_for_Free_Delivery", {
              required: t("Distance for Free Delivery is required"),
            })}
            placeholder={t("Enter Distance for Free Delivery")}
            className="border border-gray-300 rounded-lg p-2 w-full"
          />
          {errors.Distance_for_Free_Delivery && (
            <p className="text-red-500 text-sm">
              {errors.Distance_for_Free_Delivery.message}
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t("Order Amount for Free Delivery")}
          </label>
          <input
            {...register("Order_Amount_for_Free_Delivery", {
              required: t("Order Amount for Free Delivery is required"),
            })}
            placeholder={t("Enter Order Amount for Free Delivery")}
            className="border border-gray-300 rounded-lg p-2 w-full"
          />
          {errors.Order_Amount_for_Free_Delivery && (
            <p className="text-red-500 text-sm">
              {errors.Order_Amount_for_Free_Delivery.message}
            </p>
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
