import React, { useState, useEffect, useContext } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { AdminContext } from "@/context/AdminContext";
import { notifyError, notifySuccess } from "@/utils/toast";
import { Button } from "@/page-layouts";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const DeliveryTab = ({ businessId }) => {
  const { t } = useTranslation();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;

  const [loading, setLoading] = useState(false);
  const [deliveryData, setDeliveryData] = useState({
    tipOption: "",
    tax: "",
    taxName: "",
    deliveryVia: "",
    hostName: "",
    apiKey: "",
    apiSecret: "",
    isBusinessClosed: "",
    openTime: "",
    closeTime: "",
    address: "",
    latitude: "",
    longitude: "",
    apiTiedUser: "",
    delayGraceTime: "",
    preparationTime: "",
    distanceForFreeDelivery: "",
    orderAmountForFreeDelivery: "",
    additionalDeliveryFee: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const headers = adminInfo
        ? {
            "Content-Type": "application/json",
            authorization: `Bearer ${adminInfo.token}`,
          }
        : {};

      const response = await axios.get(
        `${Base_URL}/Delivery/get_by_business_id/${businessId}`,
        { headers }
      );
      if (response.data.data.length) {
        setDeliveryData(response.data.data[0]);
      }
    } catch (error) {
      console.error("Error fetching delivery data:", error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setDeliveryData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const headers = {
        "Content-Type": "application/json",
        authorization: adminInfo ? `Bearer ${adminInfo.token}` : null,
      };

      const response = await axios.post(
        `${Base_URL}/Delivery/add`,
        { ...deliveryData, business_id: businessId },
        { headers }
      );

      if (response.status === 200) {
        notifySuccess(t("business.dataSavedSuccessfully"));
      }
    } catch (error) {
      notifyError(t("business.errorOccurredWhileSaving"));
      console.error("API Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const fieldsToShow = [
    "tipOption",
    "tax",
    "taxName",
    "deliveryVia",
    "hostName",
    "apiKey",
    "apiSecret",
    "isBusinessClosed",
    "openTime",
    "closeTime",
    "address",
    "latitude",
    "longitude",
    "apiTiedUser",
    "delayGraceTime",
    "preparationTime",
    "distanceForFreeDelivery",
    "orderAmountForFreeDelivery",
    "additionalDeliveryFee",
  ];

  return (
    <div className="sm:container mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg">
      <h2 className="text-xl font-semibold mb-6">{t("business.deliverySettings")}</h2>
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {fieldsToShow.map((key) => {
            // Map field names to translation keys
            const fieldLabelMap = {
              tipOption: "business.tipOption",
              tax: "business.tax",
              taxName: "business.taxName",
              deliveryVia: "business.deliveryVia",
              hostName: "business.hostName",
              apiKey: "business.apiKey",
              apiSecret: "business.apiSecret",
              isBusinessClosed: "business.isBusinessClosed",
              openTime: "business.openTime",
              closeTime: "business.closeTime",
              address: "business.address",
              latitude: "business.latitude",
              longitude: "business.longitude",
              apiTiedUser: "business.apiTiedUser",
              delayGraceTime: "business.delayGraceTime",
              preparationTime: "business.preparationTime",
              distanceForFreeDelivery: "business.distanceForFreeDelivery",
              orderAmountForFreeDelivery: "business.orderAmountForFreeDelivery",
              additionalDeliveryFee: "business.additionalDeliveryFee",
            };
            
            const fieldPlaceholderMap = {
              tipOption: "business.enterTipOption",
              tax: "business.enterTax",
              taxName: "business.enterTaxName",
              deliveryVia: "business.enterDeliveryVia",
              hostName: "business.enterHostName",
              apiKey: "business.enterApiKey",
              apiSecret: "business.enterApiSecret",
              isBusinessClosed: "business.enterIsBusinessClosed",
              openTime: "business.enterOpenTime",
              closeTime: "business.enterCloseTime",
              address: "business.enterAddress",
              latitude: "business.enterLatitude",
              longitude: "business.enterLongitude",
              apiTiedUser: "business.enterApiTiedUser",
              delayGraceTime: "business.enterDelayGraceTime",
              preparationTime: "business.enterPreparationTime",
              distanceForFreeDelivery: "business.enterDistanceForFreeDelivery",
              orderAmountForFreeDelivery: "business.enterOrderAmountForFreeDelivery",
              additionalDeliveryFee: "business.enterAdditionalDeliveryFee",
            };
            
            return (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t(fieldLabelMap[key] || key)}
                </label>
                <input
                  type={key.toLowerCase().includes("time") ? "time" : "text"}
                  name={key}
                  value={deliveryData[key]}
                  onChange={handleChange}
                  placeholder={t(fieldPlaceholderMap[key] || `Enter ${key}`)}
                  className="border border-gray-300 rounded-lg p-2 w-full"
                />
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex gap-4">
          <Button
            className="bg-p-blue hover:bg-p-blue-dark mt-6"
            type="submit"
            disabled={loading}
            color="primary"
          >
            {loading ? t("Saving...") : t("Save")}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default DeliveryTab;
