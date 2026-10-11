import React, { Fragment, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { useBusinessEInvoiceEnabled } from "@/hooks/useBusinessEInvoiceEnabled";

import BasicInfo from "./BasicInfo";
import EInvoice from "./EInvoice";
import Shipment from "./Shipment";
import Delivery from "./Delivery";
import Zoho from "./Zoho";
import RewardsPoints from "./RewardsPoints";
import BusinessDetails from "./BusinessDetails";

const ConfigTab = () => {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState("1");
  const location = useLocation();
  const businessId = location.state ? location.state.business_id : null;
  const { enabled: eInvoiceModuleEnabled } = useBusinessEInvoiceEnabled(businessId);
  useEffect(() => {
    i18n.changeLanguage(localStorage.getItem("language") || "en");
  }, [i18n]);
  useEffect(() => {
    if (!eInvoiceModuleEnabled && (activeTab === "2" || activeTab === "7")) {
      setActiveTab("1");
    }
  }, [eInvoiceModuleEnabled, activeTab]);

  return (
    <Fragment>
      <div
        style={{
          minHeight: "100vh",
          // background: "linear-gradient(to bottom right, #e3f2fd, #bbdefb)",
          display: "flex",
          // alignItems: "center",
          justifyContent: "center",
          padding: "16px",
        }}
      >
        {/* Fixed height card */}
        <div
          style={{
            width: "100%",
            maxWidth: "1200px",
            height: "700px",
            backgroundColor: "white",
            borderRadius: "20px",
            boxShadow: "0 8px 16px rgba(0, 0, 0, 0.1)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "24px",
              backgroundColor: "#0592B3",
              color: "white",
              borderTopLeftRadius: "20px",
              borderTopRightRadius: "20px",
              display: "flex",
              alignItems: "center",
              gap: "16px",
            }}
          >
            <div
              style={{
                backgroundColor: "white",
                padding: "16px",
                borderRadius: "50%",
                boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
              }}
            >
              <i
                style={{
                  color: "#0592B3",
                  fontSize: "24px",
                }}
                className="pe-7s-settings"
              />
            </div>
            <div>
              <h1 style={{ fontSize: "24px", fontWeight: "500", margin: 0 }}>
                {t("Business Details")}
              </h1>
              <p style={{ fontSize: "14px", opacity: 0.9, margin: 0 }}>
                {t("View Detailed Info of Business.")}
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div
            style={{
              padding: "16px",
              display: "flex",
              gap: "16px",
              backgroundColor: "#f5f5f5",
            }}
          >
            <button
              onClick={() => setActiveTab("1")}
              style={{
                padding: "12px 32px",
                fontSize: "14px",
                fontWeight: "600",
                borderRadius: "9999px",
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
              {t("Basic Info")}
            </button>
            {eInvoiceModuleEnabled && (
            <button
              onClick={() => setActiveTab("2")}
              style={{
                padding: "12px 32px",
                fontSize: "14px",
                fontWeight: "600",
                borderRadius: "9999px",
                transition: "all 0.3s",
                backgroundColor: activeTab === "2" ? "#0592B3" : "#E6E7EB",
                color: activeTab === "2" ? "white" : "#333",
                boxShadow:
                  activeTab === "2" ? "0 4px 8px rgba(0, 0, 0, 0.1)" : "none",
                cursor: "pointer",
                border: "none",
              }}
              aria-selected={activeTab === "2"}
              role="tab"
            >
              {t("E-Invoice")}
            </button>
            )}
            <button
              onClick={() => setActiveTab("3")}
              style={{
                padding: "12px 32px",
                fontSize: "14px",
                fontWeight: "600",
                borderRadius: "9999px",
                transition: "all 0.3s",
                backgroundColor: activeTab === "3" ? "#0592B3" : "#E6E7EB",
                color: activeTab === "3" ? "white" : "#333",
                boxShadow:
                  activeTab === "3" ? "0 4px 8px rgba(0, 0, 0, 0.1)" : "none",
                cursor: "pointer",
                border: "none",
              }}
              aria-selected={activeTab === "3"}
              role="tab"
            >
              {t("Shipment")}
            </button>
            <button
              onClick={() => setActiveTab("4")}
              style={{
                padding: "12px 32px",
                fontSize: "14px",
                fontWeight: "600",
                borderRadius: "9999px",
                transition: "all 0.3s",
                backgroundColor: activeTab === "4" ? "#0592B3" : "#E6E7EB",
                color: activeTab === "4" ? "white" : "#333",
                boxShadow:
                  activeTab === "4" ? "0 4px 8px rgba(0, 0, 0, 0.1)" : "none",
                cursor: "pointer",
                border: "none",
              }}
              aria-selected={activeTab === "4"}
              role="tab"
            >
              {t("Delivery")}
            </button>
            <button
              onClick={() => setActiveTab("5")}
              style={{
                padding: "12px 32px",
                fontSize: "14px",
                fontWeight: "600",
                borderRadius: "9999px",
                transition: "all 0.3s",
                backgroundColor: activeTab === "5" ? "#0592B3" : "#E6E7EB",
                color: activeTab === "5" ? "white" : "#333",
                boxShadow:
                  activeTab === "5" ? "0 4px 8px rgba(0, 0, 0, 0.1)" : "none",
                cursor: "pointer",
                border: "none",
              }}
              aria-selected={activeTab === "5"}
              role="tab"
            >
              {t("Zoho")}
            </button>
            <button
              onClick={() => setActiveTab("6")}
              style={{
                padding: "12px 32px",
                fontSize: "14px",
                fontWeight: "600",
                borderRadius: "9999px",
                transition: "all 0.3s",
                backgroundColor: activeTab === "6" ? "#0592B3" : "#E6E7EB",
                color: activeTab === "6" ? "white" : "#333",
                boxShadow:
                  activeTab === "6" ? "0 4px 8px rgba(0, 0, 0, 0.1)" : "none",
                cursor: "pointer",
                border: "none",
              }}
              aria-selected={activeTab === "6"}
              role="tab"
            >
              {t("Rewards Points")}
            </button>
            {eInvoiceModuleEnabled && (
            <button
              onClick={() => setActiveTab("7")}
              style={{
                padding: "12px 32px",
                fontSize: "14px",
                fontWeight: "600",
                borderRadius: "9999px",
                transition: "all 0.3s",
                backgroundColor: activeTab === "7" ? "#0592B3" : "#E6E7EB",
                color: activeTab === "7" ? "white" : "#333",
                boxShadow:
                  activeTab === "7" ? "0 4px 8px rgba(0, 0, 0, 0.1)" : "none",
                cursor: "pointer",
                border: "none",
              }}
              aria-selected={activeTab === "7"}
              role="tab"
            >
              {t("Business Details")}
            </button>
            )}
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
            {activeTab === "1" && <BasicInfo businessId={businessId} />}
            {eInvoiceModuleEnabled && activeTab === "2" && <EInvoice />}
            {activeTab === "3" && <Shipment />}
            {activeTab === "4" && <Delivery />}
            {activeTab === "5" && <Zoho />}
            {activeTab === "6" && <RewardsPoints />}
            {eInvoiceModuleEnabled && activeTab === "7" && <BusinessDetails />}
          </div>
        </div>
      </div>
    </Fragment>
  );
};

export default ConfigTab;
