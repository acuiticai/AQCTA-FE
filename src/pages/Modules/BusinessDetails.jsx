import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { Button } from "@windmill/react-ui";
import axios from "axios";

const DeliveryTab = () => {
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
        "https://your-api-endpoint.com/delivery",
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
      <h2 className="text-xl font-semibold mb-6">
        {t("Business Information")}
      </h2>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* First Row */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("TIN")}
            </label>
            <input
              {...register("tin", { required: t("TIN is required") })}
              placeholder={t("Enter TIN")}
              defaultValue=""
              className="border border-gray-300 rounded-lg p-2 w-full"
            />
            {errors.tin && (
              <p className="text-red-500 text-sm">{errors.tin.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("ID Type")}
            </label>
            <input
              {...register("idType", { required: t("ID Type is required") })}
              placeholder={t("Enter ID Type")}
              defaultValue=""
              className="border border-gray-300 rounded-lg p-2 w-full"
            />
            {errors.idType && (
              <p className="text-red-500 text-sm">{errors.idType.message}</p>
            )}
          </div>

          {/* Second Row */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("ID Value")}
            </label>
            <input
              {...register("idValue", { required: t("ID Value is required") })}
              placeholder={t("Enter ID Value")}
              defaultValue=""
              className="border border-gray-300 rounded-lg p-2 w-full"
            />
            {errors.idValue && (
              <p className="text-red-500 text-sm">{errors.idValue.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("Registration Number")}
            </label>
            <input
              {...register("registrationNumber", {
                required: t("Registration Number is required"),
              })}
              placeholder={t("Enter Registration Number")}
              defaultValue=""
              className="border border-gray-300 rounded-lg p-2 w-full"
            />
            {errors.registrationNumber && (
              <p className="text-red-500 text-sm">
                {errors.registrationNumber.message}
              </p>
            )}
          </div>

          {/* Third Row */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("SST Registration Number")}
            </label>
            <input
              {...register("sstRegistrationNumber", {
                required: t("SST Registration Number is required"),
              })}
              placeholder={t("Enter SST Registration Number")}
              defaultValue=""
              className="border border-gray-300 rounded-lg p-2 w-full"
            />
            {errors.sstRegistrationNumber && (
              <p className="text-red-500 text-sm">
                {errors.sstRegistrationNumber.message}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("MSIC Code")}
            </label>
            <input
              {...register("msicCode", {
                required: t("MSIC Code is required"),
              })}
              placeholder={t("Enter MSIC Code")}
              defaultValue=""
              className="border border-gray-300 rounded-lg p-2 w-full"
            />
            {errors.msicCode && (
              <p className="text-red-500 text-sm">{errors.msicCode.message}</p>
            )}
          </div>

          {/* Fourth Row */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("Postal Zone")}
            </label>
            <input
              {...register("postalZone", {
                required: t("Postal Zone is required"),
              })}
              placeholder={t("Enter Postal Zone")}
              defaultValue=""
              className="border border-gray-300 rounded-lg p-2 w-full"
            />
            {errors.postalZone && (
              <p className="text-red-500 text-sm">
                {errors.postalZone.message}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("Country Subentity Code")}
            </label>
            <input
              {...register("countrySubentityCode", {
                required: t("Country Subentity Code is required"),
              })}
              placeholder={t("Enter Country Subentity Code")}
              defaultValue=""
              className="border border-gray-300 rounded-lg p-2 w-full"
            />
            {errors.countrySubentityCode && (
              <p className="text-red-500 text-sm">
                {errors.countrySubentityCode.message}
              </p>
            )}
          </div>

          {/* Fifth Row */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("Address Line 1")}
            </label>
            <input
              {...register("addressLine1", {
                required: t("Address Line 1 is required"),
              })}
              placeholder={t("Enter Address Line 1")}
              defaultValue=""
              className="border border-gray-300 rounded-lg p-2 w-full"
            />
            {errors.addressLine1 && (
              <p className="text-red-500 text-sm">
                {errors.addressLine1.message}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("Address Line 2")}
            </label>
            <input
              {...register("addressLine2", {
                required: t("Address Line 2 is required"),
              })}
              placeholder={t("Enter Address Line 2")}
              defaultValue=""
              className="border border-gray-300 rounded-lg p-2 w-full"
            />
            {errors.addressLine2 && (
              <p className="text-red-500 text-sm">
                {errors.addressLine2.message}
              </p>
            )}
          </div>

          {/* Sixth Row */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("Identification Code Country")}
            </label>
            <input
              {...register("identificationCodeCountry", {
                required: t("Identification Code Country is required"),
              })}
              placeholder={t("Enter Identification Code Country")}
              defaultValue=""
              className="border border-gray-300 rounded-lg p-2 w-full"
            />
            {errors.identificationCodeCountry && (
              <p className="text-red-500 text-sm">
                {errors.identificationCodeCountry.message}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("Contact Number")}
            </label>
            <input
              {...register("contactNumber", {
                required: t("Contact Number is required"),
              })}
              placeholder={t("Enter Contact Number")}
              defaultValue=""
              className="border border-gray-300 rounded-lg p-2 w-full"
            />
            {errors.contactNumber && (
              <p className="text-red-500 text-sm">
                {errors.contactNumber.message}
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

export default DeliveryTab;
