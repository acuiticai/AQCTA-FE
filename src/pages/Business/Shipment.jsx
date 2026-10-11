import React, { Fragment, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { Button } from "@windmill/react-ui";
import axios from "axios";
import General from "./General";
import OwnShipment from "./OwnShipment";
import Lalamove from "./Lalamove";

const ZohoTab = ({ businessId }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState("1");

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
    <div>
      {/* Tabs */}
      <div
        style={{
          padding: "6px",
          display: "flex",
          gap: "12px",
        }}
      >
        <button
          onClick={() => setActiveTab("1")}
          style={{
            padding: "12px 32px",
            fontSize: "14px",
            fontWeight: "600",
            borderRadius: "0px",
            transition: "all 0.3s",
            color: activeTab === "1" ? "var(--p-blue)" : "#333",
            borderBottom: `2px solid ${
              activeTab === "1" ? "var(--p-blue)" : "white"
            } `,
            cursor: "pointer",
            border: "none",
          }}
          aria-selected={activeTab === "1"}
          role="tab"
        >
          {t("business.generalSettings")}
        </button>
        <button
          onClick={() => setActiveTab("2")}
          style={{
            padding: "12px 32px",
            fontSize: "14px",
            fontWeight: "600",
            borderRadius: "0px",
            color: activeTab === "2" ? "var(--p-blue)" : "#333",
            borderBottom: `2px solid ${
              activeTab === "2" ? "var(--p-blue)" : "white"
            } `,
            cursor: "pointer",
            border: "none",
          }}
          aria-selected={activeTab === "2"}
          role="tab"
        >
          {t("business.ownShipment")}
        </button>
        <button
          onClick={() => setActiveTab("3")}
          style={{
            padding: "12px 32px",
            fontSize: "14px",
            fontWeight: "600",
            borderRadius: "0px",
            color: activeTab === "3" ? "var(--p-blue)" : "#333",
            borderBottom: `2px solid ${
              activeTab === "3" ? "var(--p-blue)" : "white"
            } `,
            cursor: "pointer",
            border: "none",
          }}
          aria-selected={activeTab === "3"}
          role="tab"
        >
          {t("business.lalamove")}
        </button>
      </div>

      {/* Tab Content */}
      <div
        style={{
          flex: 1,
          padding: "24px",
          backgroundColor: "#fff",
          overflow: "auto",
        }}
      >
        {activeTab === "1" && <General businessId={businessId} />}
        {activeTab === "2" && <OwnShipment businessId={businessId} />}
        {activeTab === "3" && <Lalamove businessId={businessId} />}
      </div>
    </div>
  );
};

export default ZohoTab;
