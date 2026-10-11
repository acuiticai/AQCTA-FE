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
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("1");
  const location = useLocation();
  const businessId = location.state ? location.state.business_id : null;
  const { enabled: eInvoiceModuleEnabled } = useBusinessEInvoiceEnabled(businessId);

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
          height: "100%",
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
            // height: "700px",
            backgroundColor: "white",
            borderRadius: "20px",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "24px",
              borderTopLeftRadius: "20px",
              borderTopRightRadius: "20px",
              display: "flex",
              alignItems: "center",
              gap: "16px",
            }}
          >
            <div>
              <h1 style={{ fontSize: "24px", fontWeight: "bold", margin: 0 }}>
                {t("business.businessDetails")}
              </h1>
              <p style={{ fontSize: "14px", opacity: 0.9, margin: 0 }}>
                {t("business.viewDetailedInfoOfBusiness")}
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div
            style={{
              padding: "16px",
              display: "flex",
              gap: "16px",
              flexWrap: "wrap",
              borderBottom: "1px solid #e0e0e0",
            }}
          >
            <button
              onClick={() => setActiveTab("1")}
              style={{
                padding: "12px 32px",
                fontSize: "14px",
                fontWeight: "600",
                whiteSpace: "nowrap",
                transition: "all 0.3s",
                color: activeTab === "1" ? "var(--p-blue)" : "#333",
                borderBottom: `2px solid ${
                  activeTab === "1" ? "var(--p-blue)" : "white"
                }`,
                cursor: "pointer",
                border: "none",
              }}
              aria-selected={activeTab === "1"}
              role="tab"
            >
              {t("business.basicInfo")}
            </button>
            {eInvoiceModuleEnabled && (
            <button
              onClick={() => setActiveTab("2")}
              style={{
                padding: "12px 32px",
                fontSize: "14px",
                fontWeight: "600",
                whiteSpace: "nowrap",
                transition: "all 0.3s",
                color: activeTab === "2" ? "var(--p-blue)" : "#333",
                borderBottom: `2px solid ${
                  activeTab === "2" ? "var(--p-blue)" : "white"
                }`,
                cursor: "pointer",
                border: "none",
              }}
              aria-selected={activeTab === "2"}
              role="tab"
            >
              {t("business.eInvoice")}
            </button>
            )}
            <button
              onClick={() => setActiveTab("3")}
              style={{
                padding: "12px 32px",
                fontSize: "14px",
                fontWeight: "600",
                whiteSpace: "nowrap",
                transition: "all 0.3s",
                color: activeTab === "3" ? "var(--p-blue)" : "#333",
                borderBottom: `2px solid ${
                  activeTab === "3" ? "var(--p-blue)" : "white"
                }`,
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
                whiteSpace: "nowrap",
                transition: "all 0.3s",
                color: activeTab === "4" ? "var(--p-blue)" : "#333",
                borderBottom: `2px solid ${
                  activeTab === "4" ? "var(--p-blue)" : "white"
                }`,
                cursor: "pointer",
                border: "none",
              }}
              aria-selected={activeTab === "4"}
              role="tab"
            >
              {t("business.delivery")}
            </button>
            <button
              onClick={() => setActiveTab("5")}
              style={{
                padding: "12px 32px",
                fontSize: "14px",
                fontWeight: "600",
                whiteSpace: "nowrap",
                transition: "all 0.3s",
                color: activeTab === "5" ? "var(--p-blue)" : "#333",
                borderBottom: `2px solid ${
                  activeTab === "5" ? "var(--p-blue)" : "white"
                }`,
                cursor: "pointer",
                border: "none",
              }}
              aria-selected={activeTab === "5"}
              role="tab"
            >
              {t("business.zoho")}
            </button>
            <button
              onClick={() => setActiveTab("6")}
              style={{
                padding: "12px 32px",
                fontSize: "14px",
                fontWeight: "600",
                whiteSpace: "nowrap",
                transition: "all 0.3s",
                color: activeTab === "6" ? "var(--p-blue)" : "#333",
                borderBottom: `2px solid ${
                  activeTab === "6" ? "var(--p-blue)" : "white"
                }`,
                cursor: "pointer",
                border: "none",
              }}
              aria-selected={activeTab === "6"}
              role="tab"
            >
              {t("business.rewardsPoints")}
            </button>
            {eInvoiceModuleEnabled && (
            <button
              onClick={() => setActiveTab("7")}
              style={{
                padding: "12px 32px",
                fontSize: "14px",
                fontWeight: "600",
                whiteSpace: "nowrap",
                transition: "all 0.3s",
                color: activeTab === "7" ? "var(--p-blue)" : "#333",
                borderBottom: `2px solid ${
                  activeTab === "7" ? "var(--p-blue)" : "white"
                }`,
                cursor: "pointer",
                border: "none",
              }}
              aria-selected={activeTab === "7"}
              role="tab"
            >
              {t("business.businessDetails")}
            </button>
            )}
          </div>

          {/* Tab Content */}
          <div
            style={{
              padding: "24px",
              backgroundColor: "#fff",
              height: "100%",
            }}
          >
            {activeTab === "1" && <BasicInfo businessId={businessId} />}
            {eInvoiceModuleEnabled && activeTab === "2" && <EInvoice businessId={businessId} />}
            {activeTab === "3" && <Shipment businessId={businessId} />}
            {activeTab === "4" && <Delivery businessId={businessId} />}
            {activeTab === "5" && <Zoho businessId={businessId} />}
            {activeTab === "6" && <RewardsPoints businessId={businessId} />}
            {eInvoiceModuleEnabled && activeTab === "7" && <BusinessDetails businessId={businessId} />}
          </div>
        </div>
      </div>
    </Fragment>
  );
};

export default ConfigTab;
