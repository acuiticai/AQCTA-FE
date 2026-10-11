import React, { useState, useEffect } from "react";
import axios from "axios";
import { FiX, FiExternalLink, FiPackage, FiShoppingCart } from "react-icons/fi";
import { formatAmount, formatDate } from "@/components/formatAmount";
import { useHistory } from "react-router-dom";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

// Helper function to strip HTML tags and decode HTML entities
const stripHtml = (html) => {
  if (!html) return "";

  // Create a temporary div to parse HTML
  const tmp = document.createElement("DIV");
  tmp.innerHTML = html;

  // Get text content (strips all HTML tags)
  const text = tmp.textContent || tmp.innerText || "";

  // Remove extra whitespace and newlines
  return text.replace(/\s+/g, " ").trim();
};

const TwoLevelContractsModal = ({ isOpen, onClose, contractData }) => {
  const [relatedContracts, setRelatedContracts] = useState({
    basePurchase: null,
    sale1: null,
    purchase2: null,
    sale2: null,
  });
  const [loading, setLoading] = useState(false);
  const history = useHistory();

  useEffect(() => {
    if (isOpen && contractData) {
      fetchRelatedContracts();
    }
  }, [isOpen, contractData]);

  const fetchRelatedContracts = async () => {
    setLoading(true);
    try {
      const related = contractData.related_contracts || {};
      const contracts = {
        basePurchase: null,
        sale1: null,
        purchase2: null,
        sale2: null,
      };

      // Check if current contract is one of the four
      if (contractData.contract_level === "base_purchase") {
        contracts.basePurchase = contractData;
      } else if (contractData.contract_level === "sale_1") {
        contracts.sale1 = contractData;
      } else if (contractData.contract_level === "purchase_2") {
        contracts.purchase2 = contractData;
      } else if (contractData.contract_level === "sale_2") {
        contracts.sale2 = contractData;
      }

      // Fetch all related contracts
      const promises = [];

      if (
        related.base_purchase &&
        contractData.contract_level !== "base_purchase"
      ) {
        promises.push(
          axios
            .get(`${Base_URL}/purchase-contracts/${related.base_purchase}`)
            .then(async (res) => {
              // Fetch business name if not populated
              if (res.data.business && typeof res.data.business === "string") {
                try {
                  const businessRes = await axios.get(
                    `${Base_URL}/businesses/${res.data.business}`
                  );
                  res.data.business = {
                    _id: res.data.business,
                    name:
                      businessRes.data?.data?.name || businessRes.data?.name,
                  };
                } catch (err) {
                  console.error(
                    "Error fetching business for base purchase:",
                    err
                  );
                }
              }
              return { type: "basePurchase", data: res.data };
            })
            .catch((err) => {
              console.error("Error fetching base purchase:", err);
              return { type: "basePurchase", data: null };
            })
        );
      }

      if (related.sale_1 && contractData.contract_level !== "sale_1") {
        promises.push(
          axios
            .get(`${Base_URL}/sales-contracts/${related.sale_1}`)
            .then(async (res) => {
              // Fetch business name if not populated
              if (res.data.business && typeof res.data.business === "string") {
                try {
                  const businessRes = await axios.get(
                    `${Base_URL}/businesses/${res.data.business}`
                  );
                  res.data.business = {
                    _id: res.data.business,
                    name:
                      businessRes.data?.data?.name || businessRes.data?.name,
                  };
                } catch (err) {
                  console.error("Error fetching business for sale 1:", err);
                }
              }
              return { type: "sale1", data: res.data };
            })
            .catch((err) => {
              console.error("Error fetching sale 1:", err);
              return { type: "sale1", data: null };
            })
        );
      }

      if (related.purchase_2 && contractData.contract_level !== "purchase_2") {
        promises.push(
          axios
            .get(`${Base_URL}/purchase-contracts/${related.purchase_2}`)
            .then(async (res) => {
              // Fetch business name if not populated
              if (res.data.business && typeof res.data.business === "string") {
                try {
                  const businessRes = await axios.get(
                    `${Base_URL}/businesses/${res.data.business}`
                  );
                  res.data.business = {
                    _id: res.data.business,
                    name:
                      businessRes.data?.data?.name || businessRes.data?.name,
                  };
                } catch (err) {
                  console.error("Error fetching business for purchase 2:", err);
                }
              }
              return { type: "purchase2", data: res.data };
            })
            .catch((err) => {
              console.error("Error fetching purchase 2:", err);
              return { type: "purchase2", data: null };
            })
        );
      }

      if (related.sale_2 && contractData.contract_level !== "sale_2") {
        promises.push(
          axios
            .get(`${Base_URL}/sales-contracts/${related.sale_2}`)
            .then(async (res) => {
              // Fetch business name if not populated
              if (res.data.business && typeof res.data.business === "string") {
                try {
                  const businessRes = await axios.get(
                    `${Base_URL}/businesses/${res.data.business}`
                  );
                  res.data.business = {
                    _id: res.data.business,
                    name:
                      businessRes.data?.data?.name || businessRes.data?.name,
                  };
                } catch (err) {
                  console.error("Error fetching business for sale 2:", err);
                }
              }
              return { type: "sale2", data: res.data };
            })
            .catch((err) => {
              console.error("Error fetching sale 2:", err);
              return { type: "sale2", data: null };
            })
        );
      }

      const results = await Promise.all(promises);

      results.forEach((result) => {
        if (result.data) {
          contracts[result.type] = result.data;
        }
      });

      console.log("🔍 Fetched related contracts:", contracts);
      setRelatedContracts(contracts);
    } catch (error) {
      console.error("Error fetching related contracts:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewContract = (contractId, type) => {
    onClose();

    // Open in new tab with contractId in the URL path (same as from contract list)
    const baseUrl = window.location.origin;
    const url =
      type === "purchase"
        ? `${baseUrl}/view-purchase-contract/${contractId}`
        : `${baseUrl}/view-sales-contract/${contractId}`;
    window.open(url, "_blank");
  };

  const renderContractCard = (
    contract,
    title,
    icon,
    color,
    type,
    contractLevel
  ) => {
    const isPurchase = type === "purchase";

    // Determine if business, customer, and supplier are internal or external
    const isBusinessInternal =
      contractLevel === "sale_1" || contractLevel === "purchase_2";
    const isPartyInternal =
      contractLevel === "sale_1" || contractLevel === "purchase_2";

    // If contract not loaded, show placeholder
    if (!contract) {
      return (
        <div
          style={{
            backgroundColor: "#f9fafb",
            borderRadius: "12px",
            padding: "16px",
            border: `2px dashed ${color}40`,
            boxShadow: "0 2px 4px rgba(0, 0, 0, 0.05)",
            position: "relative",
            overflow: "hidden",
            opacity: 0.6,
            minHeight: "500px",
          }}
        >
          {/* Color accent bar */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "4px",
              backgroundColor: `${color}40`,
            }}
          />

          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "14px",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                backgroundColor: `${color}10`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: `${color}60`,
                flexShrink: 0,
              }}
            >
              {icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3
                style={{
                  fontSize: "13px",
                  fontWeight: "700",
                  color: "#9ca3af",
                  marginBottom: "3px",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {title}
              </h3>
              <p
                style={{
                  fontSize: "12px",
                  color: "#9ca3af",
                  fontWeight: "600",
                }}
              >
                Not Available
              </p>
            </div>
          </div>

          {/* Placeholder text */}
          <div
            style={{
              textAlign: "center",
              padding: "40px 10px",
              color: "#9ca3af",
              fontSize: "12px",
            }}
          >
            Contract not linked or data unavailable
          </div>
        </div>
      );
    }

    const contractNo = contract.contractNo;
    const business =
      contract.business?.name || contract.businessName || "Loading...";
    const party = isPurchase
      ? contract.basicInfo?.selectedVendorId?.basicInformation
          ?.vendorDisplayName || "N/A"
      : contract.basicInfo?.buyerCompanyName || "N/A";
    const price = contract.productInfo?.[0]?.price || 0;
    const totalValue = contract.productInfo?.[0]?.totalValue || 0;
    const status = contract.status;
    const item =
      contract.productInfo?.[0]?.title ||
      contract.productInfo?.[0]?.item?.name ||
      "N/A";
    const grade =
      contract.productInfo?.[0]?.grade ||
      contract.productInfo?.[0]?.item?.grade ||
      "N/A";
    const quantityMTS = contract.productInfo?.[0]?.quantityMTS || 0;
    const quantityFCL = contract.productInfo?.[0]?.quantityFCL || 0;
    const totalQty = quantityMTS * quantityFCL;
    const containerType = contract.productInfo?.[0]?.containerType || "N/A";
    const packing = contract.productInfo?.[0]?.packing || "N/A";

    // Strip HTML from payment and shipping terms
    const paymentTermsRaw = contract.productInfo?.[0]?.paymentTerms || "";
    const shippingTermsRaw = contract.productInfo?.[0]?.shippingTerms || "";
    const paymentTerms = paymentTermsRaw ? stripHtml(paymentTermsRaw) : "N/A";
    const shippingTerms = shippingTermsRaw
      ? stripHtml(shippingTermsRaw)
      : "N/A";

    const currency = contract.productInfo?.[0]?.selectedCurrency || "USD";
    const amountInCurrency =
      contract.productInfo?.[0]?.amountInSelectedCurrency || 0;
    const etd =
      contract.basicInfo?.ETD_Port ||
      contract.productInfo?.[0]?.estimatedDeparture ||
      "";

    const statusColors = {
      Draft: "#f59e0b",
      Completed: "#10b981",
      Processing: "#3b82f6",
      Cancelled: "#ef4444",
      "Waiting Management Approval": "#3b82f6",
      "Preparing Contract": "#f59e0b",
    };

    return (
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "12px",
          padding: "16px",
          border: `2px solid ${color}`,
          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
          transition: "all 0.3s ease",
          cursor: "pointer",
          position: "relative",
          overflow: "auto",
          maxHeight: "650px",
          minHeight: "500px",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-4px)";
          e.currentTarget.style.boxShadow = "0 8px 12px rgba(0, 0, 0, 0.15)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "0 4px 6px rgba(0, 0, 0, 0.1)";
        }}
        onClick={() =>
          handleViewContract(contract._id, isPurchase ? "purchase" : "sale")
        }
      >
        {/* Color accent bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "4px",
            backgroundColor: color,
          }}
        />

        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "14px",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              backgroundColor: `${color}20`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: color,
              flexShrink: 0,
            }}
          >
            {icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3
              style={{
                fontSize: "13px",
                fontWeight: "700",
                color: "#1f2937",
                marginBottom: "3px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {title}
            </h3>
            <p
              style={{
                fontSize: "12px",
                color: "#6b7280",
                fontWeight: "600",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {contractNo}
            </p>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "3px 10px",
              borderRadius: "10px",
              backgroundColor: statusColors[status] || "#6b7280",
              color: "#ffffff",
              fontSize: "10px",
              fontWeight: "600",
              flexShrink: 0,
            }}
          >
            {status}
          </div>
        </div>

        {/* Details */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {/* Business & Party */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: "12px", color: "#6b7280" }}>
              Business:
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "#1f2937",
                }}
              >
                {business}
              </span>
              <span
                style={{
                  fontSize: "9px",
                  fontWeight: "600",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  backgroundColor: isBusinessInternal ? "#dbeafe" : "#fef3c7",
                  color: isBusinessInternal ? "#1e40af" : "#92400e",
                }}
              >
                {isBusinessInternal ? "Internal" : "External"}
              </span>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: "12px", color: "#6b7280" }}>
              {isPurchase ? "Supplier:" : "Customer:"}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "#1f2937",
                  textAlign: "right",
                }}
              >
                {party}
              </span>
              <span
                style={{
                  fontSize: "9px",
                  fontWeight: "600",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  backgroundColor: isPartyInternal ? "#dbeafe" : "#fef3c7",
                  color: isPartyInternal ? "#1e40af" : "#92400e",
                }}
              >
                {isPartyInternal ? "Internal" : "External"}
              </span>
            </div>
          </div>

          {/* Product Details */}
          <div
            style={{
              paddingTop: "8px",
              marginTop: "8px",
              borderTop: "1px solid #e5e7eb",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              <span style={{ fontSize: "12px", color: "#6b7280" }}>Item:</span>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "#1f2937",
                  textAlign: "right",
                }}
              >
                {item}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              <span style={{ fontSize: "12px", color: "#6b7280" }}>Grade:</span>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "#1f2937",
                }}
              >
                {grade}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              <span style={{ fontSize: "12px", color: "#6b7280" }}>
                Container:
              </span>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "#1f2937",
                }}
              >
                {containerType}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              <span style={{ fontSize: "12px", color: "#6b7280" }}>
                Packing:
              </span>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "#1f2937",
                }}
              >
                {packing}
              </span>
            </div>
          </div>

          {/* Quantity */}
          <div
            style={{
              paddingTop: "8px",
              marginTop: "8px",
              borderTop: "1px solid #e5e7eb",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              <span style={{ fontSize: "12px", color: "#6b7280" }}>
                Qty (FCL):
              </span>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "#1f2937",
                }}
              >
                {quantityFCL} FCL
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              <span style={{ fontSize: "12px", color: "#6b7280" }}>
                Qty/FCL (MTS):
              </span>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "#1f2937",
                }}
              >
                {quantityMTS} MTS
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: "12px",
                  color: "#6b7280",
                  fontWeight: "600",
                }}
              >
                Total Qty:
              </span>
              <span
                style={{ fontSize: "13px", fontWeight: "700", color: color }}
              >
                {totalQty.toFixed(2)} MTS
              </span>
            </div>
          </div>

          {/* Pricing */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              paddingTop: "12px",
              marginTop: "8px",
              borderTop: "2px solid #e5e7eb",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: "12px", color: "#6b7280" }}>
                Price/MT:
              </span>
              <span
                style={{ fontSize: "14px", fontWeight: "700", color: color }}
              >
                {formatAmount(price)}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: "12px", color: "#6b7280" }}>
                Total (USD):
              </span>
              <span
                style={{ fontSize: "14px", fontWeight: "700", color: color }}
              >
                {formatAmount(totalValue)}
              </span>
            </div>
            {currency !== "USD" && amountInCurrency > 0 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: "12px", color: "#6b7280" }}>
                  Total ({currency}):
                </span>
                <span
                  style={{ fontSize: "13px", fontWeight: "600", color: color }}
                >
                  {currency} {formatAmount(amountInCurrency)}
                </span>
              </div>
            )}
          </div>

          {/* Terms & Dates */}
          <div
            style={{
              paddingTop: "8px",
              marginTop: "8px",
              borderTop: "1px solid #e5e7eb",
            }}
          >
            {paymentTerms && paymentTerms !== "N/A" && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: "6px",
                }}
              >
                <span style={{ fontSize: "11px", color: "#6b7280" }}>
                  Payment:
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: "600",
                    color: "#1f2937",
                    textAlign: "right",
                    maxWidth: "60%",
                  }}
                >
                  {paymentTerms.length > 30
                    ? paymentTerms.substring(0, 30) + "..."
                    : paymentTerms}
                </span>
              </div>
            )}
            {shippingTerms && shippingTerms !== "N/A" && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: "6px",
                }}
              >
                <span style={{ fontSize: "11px", color: "#6b7280" }}>
                  Shipping:
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: "600",
                    color: "#1f2937",
                    textAlign: "right",
                    maxWidth: "60%",
                  }}
                >
                  {shippingTerms.length > 30
                    ? shippingTerms.substring(0, 30) + "..."
                    : shippingTerms}
                </span>
              </div>
            )}
            {etd && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: "11px", color: "#6b7280" }}>ETD:</span>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: "600",
                    color: "#1f2937",
                  }}
                >
                  {etd}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* View button */}
        <div
          style={{
            marginTop: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            padding: "8px",
            borderRadius: "8px",
            backgroundColor: `${color}10`,
            color: color,
            fontSize: "13px",
            fontWeight: "600",
          }}
        >
          <FiExternalLink size={14} />
          View Details
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "20px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "24px",
          maxWidth: "1400px",
          width: "100%",
          maxHeight: "90vh",
          overflow: "auto",
          boxShadow:
            "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "24px 32px",
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
            borderTopLeftRadius: "24px",
            borderTopRightRadius: "24px",
          }}
        >
          <div>
            <h2
              style={{
                fontSize: "24px",
                fontWeight: "800",
                color: "#1f2937",
                marginBottom: "4px",
              }}
            >
              Two-Level Contract Chain
            </h2>
            <p style={{ fontSize: "14px", color: "#6b7280" }}>
              View all related contracts in this two-level structure
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "12px",
              backgroundColor: "#ffffff",
              border: "1px solid #e5e7eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "all 0.2s",
              color: "#6b7280",
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = "#fef2f2";
              e.target.style.color = "#ef4444";
              e.target.style.borderColor = "#ef4444";
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = "#ffffff";
              e.target.style.color = "#6b7280";
              e.target.style.borderColor = "#e5e7eb";
            }}
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "32px" }}>
          {loading ? (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                minHeight: "400px",
              }}
            >
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  border: "4px solid #f3f4f6",
                  borderTopColor: "var(--p-blue)",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                }}
              />
            </div>
          ) : (
            <>
              {/* Flow Diagram */}
              <div
                style={{
                  marginBottom: "32px",
                  padding: "24px",
                  backgroundColor: "#f9fafb",
                  borderRadius: "16px",
                  border: "1px solid #e5e7eb",
                }}
              >
                <h3
                  style={{
                    fontSize: "16px",
                    fontWeight: "700",
                    color: "#1f2937",
                    marginBottom: "16px",
                  }}
                >
                  Contract Flow
                </h3>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "16px",
                    flexWrap: "wrap",
                  }}
                >
                  <div
                    style={{
                      padding: "8px 16px",
                      backgroundColor: "#dbeafe",
                      borderRadius: "8px",
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "#1e40af",
                    }}
                  >
                    Base Purchase
                  </div>
                  <span style={{ fontSize: "20px", color: "var(--p-blue)" }}>
                    →
                  </span>
                  <div
                    style={{
                      padding: "8px 16px",
                      backgroundColor: "#d1fae5",
                      borderRadius: "8px",
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "#065f46",
                    }}
                  >
                    Sale 1 (Internal)
                  </div>
                  <span style={{ fontSize: "20px", color: "var(--p-blue)" }}>
                    →
                  </span>
                  <div
                    style={{
                      padding: "8px 16px",
                      backgroundColor: "#fef3c7",
                      borderRadius: "8px",
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "#92400e",
                    }}
                  >
                    Purchase 2 (Internal)
                  </div>
                  <span style={{ fontSize: "20px", color: "var(--p-blue)" }}>
                    →
                  </span>
                  <div
                    style={{
                      padding: "8px 16px",
                      backgroundColor: "#fce7f3",
                      borderRadius: "8px",
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "#9f1239",
                    }}
                  >
                    Sale 2 (External)
                  </div>
                </div>
              </div>

              {/* Contracts Grid - Always show all 4 in one line */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: "16px",
                }}
              >
                {/* Base Purchase */}
                {renderContractCard(
                  relatedContracts.basePurchase,
                  "Base Purchase (External)",
                  <FiPackage size={20} />,
                  "#3b82f6",
                  "purchase",
                  "base_purchase"
                )}

                {/* Sale 1 (Internal) */}
                {renderContractCard(
                  relatedContracts.sale1,
                  "Sale 1 (Internal)",
                  <FiShoppingCart size={20} />,
                  "#10b981",
                  "sale",
                  "sale_1"
                )}

                {/* Purchase 2 (Internal) */}
                {renderContractCard(
                  relatedContracts.purchase2,
                  "Purchase 2 (Internal)",
                  <FiPackage size={20} />,
                  "#f59e0b",
                  "purchase",
                  "purchase_2"
                )}

                {/* Sale 2 (External) */}
                {renderContractCard(
                  relatedContracts.sale2,
                  "Sale 2 (External)",
                  <FiShoppingCart size={20} />,
                  "#ec4899",
                  "sale",
                  "sale_2"
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default TwoLevelContractsModal;
