import React, { Fragment, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { Button } from "@windmill/react-ui";
import axios from "axios";
import General from "./General";
import OwnShipment from "./OwnShipment";
import Lalamove from "./Lalamove";

const ZohoTab = () => {
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
      const response = await axios.post("https://your-api-endpoint.com/zoho", data);
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
      <div
       
      >

        {/* Tabs */}
        <div
          style={{
            padding: "6px",
            display: "flex",
            gap: "6px",
          }}
        >
          <button
            onClick={() => setActiveTab("1")}
            style={{
              padding: "12px 32px",
              fontSize: "14px",
              fontWeight: "600",
              borderRadius: "5px",
              transition: "all 0.3s",
              backgroundColor: activeTab === "1" ? "#0592B3" : "#E6E7EB",
              color: activeTab === "1" ? "white" : "#333",
              boxShadow:
                activeTab === "1" ? "0 4px 8px rgba(0, 0, 0, 0.1)" : "none",
              cursor: "pointer",
              border: "none",
            }}
            aria-selected={activeTab === "1"}
            role="tab"
          >
            {t("General Settings")}
          </button>
          <button
            onClick={() => setActiveTab("2")}
            style={{
              padding: "12px 32px", fontSize: "14px", fontWeight: "600", borderRadius: "5px",
              transition: "all 0.3s", backgroundColor: activeTab === "2" ? "#0592B3" : "#E6E7EB",
              color: activeTab === "2" ? "white" : "#333",
              boxShadow: activeTab === "2" ? "0 4px 8px rgba(0, 0, 0, 0.1)" : "none",
              cursor: "pointer", border: "none",
            }}
            aria-selected={activeTab === "2"} role="tab"  >
            {t("Own Shipment")}
          </button>
          <button
            onClick={() => setActiveTab("3")}
            style={{
              padding: "12px 32px", fontSize: "14px", fontWeight: "600", borderRadius: "5px",
              transition: "all 0.3s", backgroundColor: activeTab === "3" ? "#0592B3" : "#E6E7EB",
              color: activeTab === "3" ? "white" : "#333",
              boxShadow: activeTab === "3" ? "0 4px 8px rgba(0, 0, 0, 0.1)" : "none",
              cursor: "pointer", border: "none",
            }}
            aria-selected={activeTab === "3"} role="tab"  >
            {t("Lalamove")}
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
          {activeTab === "1" && <General />}
          {activeTab === "2" && <OwnShipment />}
          {activeTab === "3" && <Lalamove />}
        </div>
      </div>
  );
};

export default ZohoTab;
