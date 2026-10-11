import React, { Fragment, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";

import BasicInfo from "./NewCustomerScreen";

const ConfigTab = () => {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState("1");
  const location = useLocation();
  const Customer_id = location.state ? location.state.Customer_id : null;
  console.log("Customer_id", Customer_id);
  useEffect(() => {
    i18n.changeLanguage(localStorage.getItem("language") || "en");
  }, [i18n]);

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
              <h1 style={{ fontSize: "24px", fontWeight: "bold", margin: 0 }}>
                {t("customer.customerDetails")}
              </h1>
              <p style={{ fontSize: "14px", opacity: 0.9, margin: 0 }}>
                {t("customer.viewDetailedInfo")}
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
              {t("customer.basicInfo")}
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
            {activeTab === "1" && <BasicInfo Customer_id={Customer_id} />}
          </div>
        </div>
      </div>
    </Fragment>
  );
};

export default ConfigTab;
