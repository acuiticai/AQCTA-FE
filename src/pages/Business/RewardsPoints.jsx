import React, { useState, useEffect, useContext } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/page-layouts";
import axios from "axios";
import { AdminContext } from "@/context/AdminContext";
import { notifyError, notifySuccess } from "@/utils/toast";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const RewardsTab = ({ businessId }) => {
  const { t } = useTranslation();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;

  const [loading, setLoading] = useState(false);
  const [rewardData, setRewardData] = useState({
    pointsPerUnit: "",
    minimumPointsToRedeem: "",
    redemptionRate: "",
  });

  // Fetch data on load
  useEffect(() => {
    fetchData();
  }, []);

  // Fetch reward data
  const fetchData = async () => {
    try {
      const headers = adminInfo
        ? {
            "Content-Type": "application/json",
            authorization: `Bearer ${adminInfo.token}`,
          }
        : {};

      const response = await axios.get(
        `${Base_URL}/Reward/get_by_business_id/${businessId}`,
        { headers }
      );
      if (response.data.data.length) {
        const reward = response.data.data[0];
        setRewardData({
          pointsPerUnit: reward.pointsPerUnit || "",
          minimumPointsToRedeem: reward.minimumPointsToRedeem || "",
          redemptionRate: reward.redemptionRate || "",
        });
      }
    } catch (error) {
      console.error("Error fetching reward data:", error);
      setRewardData({
        pointsPerUnit: "",
        minimumPointsToRedeem: "",
        redemptionRate: "",
      });
    }
  };

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setRewardData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  // Submit form data
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      business_id: businessId,
      pointsPerUnit: rewardData.pointsPerUnit,
      minimumPointsToRedeem: rewardData.minimumPointsToRedeem,
      redemptionRate: rewardData.redemptionRate,
    };

    try {
      const headers = {
        "Content-Type": "application/json",
        authorization: adminInfo ? `Bearer ${adminInfo.token}` : null,
      };

      const response = await axios.post(`${Base_URL}/Reward/add`, payload, {
        headers,
      });

      if (response.status === 200) {
        notifySuccess(t("business.dataSavedSuccessfully"));
      }
    } catch (error) {
      notifyError(error);
      console.error("API Error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sm:container mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg">
      <h2 className="text-xl font-semibold mb-6">{t("business.rewardsPoints")}</h2>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Points per Unit */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("business.pointsPerUnit")}
            </label>
            <input
              type="number"
              name="pointsPerUnit"
              value={rewardData.pointsPerUnit}
              onChange={handleChange}
              placeholder={t("business.enterPointsPerUnit")}
              className="border border-gray-300 rounded-lg p-2 w-full"
              required
            />
          </div>

          {/* Minimum Points to Redeem */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("business.minimumPointsToRedeem")}
            </label>
            <input
              type="number"
              name="minimumPointsToRedeem"
              value={rewardData.minimumPointsToRedeem}
              onChange={handleChange}
              placeholder={t("business.enterMinimumPointsToRedeem")}
              className="border border-gray-300 rounded-lg p-2 w-full"
              required
            />
          </div>

          {/* Redemption Rate */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("business.redemptionRate")}
            </label>
            <input
              type="number"
              name="redemptionRate"
              value={rewardData.redemptionRate}
              onChange={handleChange}
              placeholder={t("business.enterRedemptionRate")}
              className="border border-gray-300 rounded-lg p-2 w-full"
              required
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex gap-4 ">
          <Button
            type="submit"
            className="mt-6"
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

export default RewardsTab;
