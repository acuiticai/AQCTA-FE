import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { Button } from "@/page-layouts/";
import axios from "axios";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const ApiForm = ({ businessId }) => {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm();

  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [existingData, setExistingData] = useState(null);
  const [formData, setFormData] = useState({
    distance: "",
    orderAmount: "",
  });

  // Fetch data when businessId changes
  useEffect(() => {
    if (businessId) {
      fetchExistingData();
    }
  }, [businessId]);

  const fetchExistingData = async () => {
    try {
      console.log("Fetching data for businessId:", businessId);
      const response = await axios.get(`${Base_URL}/general/get/${businessId}`);
      console.log("response.data api:", response);

      if (response.data.status && response.data.data.length > 0) {
        const matchedData = response.data.data.find(
          (item) => item.business_id === businessId
        );

        if (matchedData) {
          console.log("Matched Data:", matchedData);
          setExistingData(matchedData);
          setFormData({
            distance: matchedData.distance,
            orderAmount: matchedData.orderAmount,
          });
          updateFormValues(matchedData);
        } else {
          console.warn("No existing data found for this business ID.");
          setExistingData(null);
        }
      } else {
        console.warn("No delivery configurations found.");
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const updateFormValues = (data) => {
    const updatedData = {
      distance: data.distanceToFreeDelivery.toString(),
      orderAmount: data.orderAmountForFreeDelivery.toString(),
    };

    setFormData(updatedData);
    setValue("distance", updatedData.distance);
    setValue("orderAmount", updatedData.orderAmount);
  };

  const handleInputChange = (field, value) => {
    setFormData((prevState) => ({
      ...prevState,
      [field]: value,
    }));
    setValue(field, value);
  };

  const onSubmit = async (data) => {
    setLoading(true);
    setStatusMessage("");

    const payload = {
      distanceToFreeDelivery: parseInt(data.distance, 10),
      business_id: businessId,
      orderAmountForFreeDelivery: parseFloat(data.orderAmount),
    };

    try {
      let response;
      if (existingData && existingData._id) {
        console.log("Performing PUT request with ID:", existingData._id);
        response = await axios.post(`${Base_URL}/general/add`, payload);
      } else {
        console.log("Performing POST request");
        response = await axios.post(`${Base_URL}/general/add`, payload);
      }

      if (response.status === 200) {
        setStatusMessage(t("business.dataUpdatedSuccessfully"));
        fetchExistingData();
      }
    } catch (error) {
      console.error("API Error:", error.response || error);
      setStatusMessage(
        error.response?.data?.message ||
          t("business.errorOccurredWhileUpdatingData")
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t("business.distanceForFreeDeliveryLabel")}
          </label>
          <input
            {...register("distance", { required: t("business.distanceIsRequired") })}
            placeholder={t("business.enterDistance")}
            className="border border-gray-300 rounded-lg p-2 w-full"
            type="number"
            value={formData.distance}
            onChange={(e) => handleInputChange("distance", e.target.value)}
          />
          {errors.distance && (
            <p className="text-red-500 text-sm">{errors.distance.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t("business.orderAmountForFreeDeliveryLabel")}
          </label>
          <input
            {...register("orderAmount", {
              required: t("business.orderAmountIsRequired"),
            })}
            placeholder={t("business.enterOrderAmount")}
            className="border border-gray-300 rounded-lg p-2 w-full"
            type="number"
            value={formData.orderAmount}
            onChange={(e) => handleInputChange("orderAmount", e.target.value)}
          />
          {errors.orderAmount && (
            <p className="text-red-500 text-sm">{errors.orderAmount.message}</p>
          )}
        </div>
      </div>

      <div className="mt-6 flex gap-4">
        <Button
          className="bg-p-blue hover:bg-p-blue-dark"
          type="submit"
          disabled={loading}
        >
          {loading ? t("Updating...") : existingData ? t("Update") : t("Save")}
        </Button>
      </div>

      {statusMessage && (
        <p className="mt-4 text-sm font-medium text-green-600">
          {statusMessage}
        </p>
      )}
    </form>
  );
};

export default ApiForm;
