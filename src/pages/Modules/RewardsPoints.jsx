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
    <div className="sm:container mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg">
      <h2 className="text-xl font-semibold mb-6">{t("Rewards Points")}</h2>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Row 1 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("Points per Unit")}
            </label>
            <input
              {...register("Points_per_Unit", {
                required: t("Points per Unit is required"),
              })}
              placeholder={t("Enter Points per Unit")}
              className="border border-gray-300 rounded-lg p-2 w-full"
            />
            {errors.Points_per_Unit && (
              <p className="text-red-500 text-sm">
                {errors.Points_per_Unit.message}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("Minimum Points to Redeem")}
            </label>
            <input
              {...register("Minimum_Points_to_Redeem", {
                required: t("Minimum Points to Redeem is required"),
              })}
              placeholder={t("Enter Minimum Points to Redeem")}
              className="border border-gray-300 rounded-lg p-2 w-full"
            />
            {errors.Minimum_Points_to_Redeem && (
              <p className="text-red-500 text-sm">
                {errors.Minimum_Points_to_Redeem.message}
              </p>
            )}
          </div>

          {/* Row 2 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("Redemption Rate")}
            </label>
            <input
              {...register("Redemption_Rate", {
                required: t("Redemption Rate is required"),
              })}
              placeholder={t("Enter Redemption Rate")}
              className="border border-gray-300 rounded-lg p-2 w-full"
            />
            {errors.Redemption_Rate && (
              <p className="text-red-500 text-sm">
                {errors.Redemption_Rate.message}
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex justify-end gap-4">
          <Button type="button" layout="outline">
            {t("Cancel")}
          </Button>
          <Button
            className="bg-p-blue hover:bg-p-blue-dark"
            type="submit"
            disabled={loading}
          >
            {loading ? t("Saving...") : t("Save")}
          </Button>
        </div>
        {message && (
          <p className="mt-4 text-sm font-medium text-green-600">{message}</p>
        )}
      </form>
    </div>
  );
};

export default ZohoTab;
