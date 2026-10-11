import React, { useEffect, useState, useContext } from "react";
import ContractProgress from "./ContractProgress";
import ProfitabilityCard from "./ProfitabilityCard";
import ItemDetailsPopup from "@/pages/Purchase_Contract/actions/headercomponents/ItemDetailsPopup";
import moment from "moment";
import {
  formatAmount,
  formatDate,
  formatQuantity,
} from "@/components/formatAmount";
import DOMPurify from "dompurify";
import { AdminContext } from "@/context/AdminContext";
import axios from "axios";
import {
  MdDescription,
  MdDateRange,
  MdLocalShipping,
  MdAttachMoney,
  MdBusiness,
  MdInfo,
  MdAssignment,
  MdInventory,
  MdSchedule,
  MdTrendingUp,
  MdAccountBalance,
  MdLocationOn,
} from "react-icons/md";

const ContractHeader = ({ Data }) => {
  const [pagePermissions, setPagePermissions] = useState([]);
  const [isItemPopupOpen, setIsItemPopupOpen] = useState(false);
  const [fetchedItemDetails, setFetchedItemDetails] = useState(null);
  const [isLoadingItem, setIsLoadingItem] = useState(false);
  const { state } = useContext(AdminContext);

  const { adminInfo } = state;
  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo.token}`,
  };

  const checkPagePermissions = () => {
    if (!adminInfo || !adminInfo.role || !adminInfo.role.modules) {
      console.log("No admin info or modules found");
      return;
    }

    const currentPath = "/sales";
    console.log("Current Path:", currentPath);

    let permissions = [];

    adminInfo.role.modules.forEach((module) => {
      if (!module.path) {
        console.log(`⚠️ Missing path for module: ${module.name}`);
        return;
      }

      console.log("Checking module:", module.name, "Path:", module.path);

      if (currentPath === module.path) {
        console.log("✅ Matched Module:", module.name);
        permissions = [...permissions, ...module.permissions];
      }

      module.subModules?.forEach((subModule) => {
        if (!subModule.path) {
          console.log(`⚠️ Missing path for subModule: ${subModule.name}`);
          return;
        }

        console.log(
          "Checking subModule:",
          subModule.name,
          "Path:",
          subModule.path
        );

        if (currentPath === subModule.path) {
          console.log("✅ Matched SubModule:", subModule.name);
          permissions = [...permissions, ...subModule.permissions];
        }
      });
    });

    if (permissions.length > 0) {
      console.log("✅ Final Permissions:", permissions);
      setPagePermissions([...new Set(permissions)]);
    } else {
      console.log("🚨 No permissions found for this page.");
      setPagePermissions([]);
    }
  };

  useEffect(() => {
    if (adminInfo) {
      checkPagePermissions();
    }
  }, [location.pathname, adminInfo]);

  console.log("pagePermissions", pagePermissions);

  const hasPermission = (permission) => {
    return pagePermissions.includes(permission);
  };

  // Function to fetch item details by ID
  const fetchItemDetails = async (itemId) => {
    if (!itemId) return;

    setIsLoadingItem(true);
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_APP_API_BASE_URL}/items/${itemId}`,
        {
          headers: {
            "Content-Type": "application/json",
            authorization: `Bearer ${adminInfo.token}`,
          },
        }
      );

      if (response.data) {
        setFetchedItemDetails(response.data);
      }
    } catch (error) {
      console.error("❌ Error fetching item details:", error);
      setFetchedItemDetails(null);
    } finally {
      setIsLoadingItem(false);
    }
  };

  // Handle item popup open
  const handleItemPopupOpen = () => {
    const itemId = Data.productInfo?.[0]?.item;
    if (itemId) {
      fetchItemDetails(itemId);
    }
    setIsItemPopupOpen(true);
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      Draft: { color: "bg-gray-100 text-gray-800 border-gray-300", icon: "📝" },
      "Waiting Management Approval": {
        color: "bg-amber-100 text-amber-800 border-amber-300",
        icon: "⏳",
      },
      Approved: {
        color: "bg-emerald-100 text-emerald-800 border-emerald-300",
        icon: "✅",
      },
      Rejected: { color: "bg-red-100 text-red-800 border-red-300", icon: "❌" },
      default: {
        color: "bg-slate-100 text-slate-800 border-slate-300",
        icon: "📋",
      },
    };

    return statusConfig[status] || statusConfig.default;
  };

  const statusConfig = getStatusBadge(Data?.status);

  return (
    <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
      {/* Header Section with Gradient */}
      <div className="bg-gradient-to-r from-slate-700 via-slate-800 to-slate-900 px-8 py-6 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-700/20 to-slate-800/20"></div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-16 translate-x-16"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12"></div>

        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          {/* Left: Contract Info */}
          <div className="flex items-center space-x-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
              <MdDescription className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">
                Contract #{Data?.contractNo || "N/A"}
              </h1>
              <p className="text-slate-200 text-sm">
                Created on {formatDate(Data?.createdAt)}
              </p>
            </div>
          </div>

          {/* Right: Status Badge */}
          <div className="flex items-center space-x-3">
            <span
              className={`px-4 py-2 rounded-full text-sm font-medium border ${statusConfig.color} backdrop-blur-sm`}
            >
              <span className="mr-2">{statusConfig.icon}</span>
              {Data?.status || "N/A"}
            </span>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Contract Details */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
              <div className="flex items-center mb-6">
                <div className="bg-gradient-to-r from-slate-600 to-slate-700 rounded-lg p-2 mr-4">
                  <MdInfo className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">
                  Contract Details
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-4">
                  {/* left-0: Customer */}
                  <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg p-4 hover:shadow-md transition-all duration-300 cursor-pointer group">
                    <div className="flex items-center space-x-3">
                      <div className="bg-slate-100 rounded-lg p-2">
                        <MdInventory className="w-5 h-5 text-[#A6C833]" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-600 font-medium">
                          Customer
                        </p>
                        <p className="text-slate-900 font-semibold">
                          {Data.basicInfo?.buyerCompanyName || "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* left-1: Contract Date */}
                  {Data.basicInfo?.contractDate ? (
                    <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg p-4 hover:shadow-md transition-all duration-300 cursor-pointer group">
                      <div className="flex items-center space-x-3">
                        <div className="bg-slate-100 rounded-lg p-2">
                          <MdDateRange className="w-5 h-5 text-[#A6C833]" />
                        </div>
                        <div>
                          <p className="text-sm text-slate-600 font-medium">
                            Contract Date
                          </p>
                          <p className="text-slate-900 font-semibold">
                            {formatDate(Data.basicInfo?.contractDate)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ height: "1px", visibility: "hidden" }}></div>
                  )}

                  {/* left-2: Item */}
                  <div
                    className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg p-4 hover:shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer group hover:from-slate-100 hover:to-slate-200 hover:-translate-y-1"
                    onClick={handleItemPopupOpen}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="bg-slate-100 rounded-lg p-2 group-hover:bg-slate-200 transition-colors duration-200">
                        <MdInventory className="w-5 h-5 text-[#A6C833]" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-600 font-medium">
                          Item
                        </p>
                        <p className="text-slate-900 font-semibold group-hover:text-slate-700 transition-colors duration-200">
                          {Data.productInfo?.[0]?.title || "N/A"}
                        </p>
                        <div className="flex items-center space-x-1 mt-1">
                          <p className="text-xs text-slate-500">
                            Click to view details
                          </p>
                          <span className="text-xs text-slate-400">→</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* left-3: Packages */}
                  <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg p-4 hover:shadow-md transition-all duration-300 cursor-pointer group">
                    <div className="flex items-center space-x-3">
                      <div className="bg-slate-100 rounded-lg p-2">
                        <MdLocalShipping className="w-5 h-5 text-[#A6C833]" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-600 font-medium">
                          Packages
                        </p>
                        <p className="text-slate-900 font-semibold">
                          {Data.productInfo?.[0]?.No_of_Packages || "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* left-4: Total Quantity (MTS) */}
                  <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg p-4 hover:shadow-md transition-all duration-300 cursor-pointer group">
                    <div className="flex items-center space-x-3">
                      <div className="bg-slate-100 rounded-lg p-2">
                        <MdTrendingUp className="w-5 h-5 text-[#A6C833]" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-600 font-medium">
                          Total Quantity (MTS)
                        </p>
                        <p className="text-slate-900 font-semibold">
                          {Data.productInfo?.[0]?.quantityMTS &&
                          Data.productInfo?.[0]?.quantityFCL
                            ? (
                                Number(Data.productInfo[0].quantityMTS) *
                                Number(Data.productInfo[0].quantityFCL)
                              ).toFixed(2)
                            : "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* left-5: Price per Unit */}
                  <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg p-4 hover:shadow-md transition-all duration-300 cursor-pointer group">
                    <div className="flex items-center space-x-3">
                      <div className="bg-slate-100 rounded-lg p-2">
                        <MdAttachMoney className="w-5 h-5 text-[#A6C833]" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-600 font-medium">
                          Price per Unit
                        </p>
                        <p className="text-slate-900 font-semibold">
                          ${formatAmount(Data.productInfo?.[0]?.price) || "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                  {/* right-0: Created Date */}
                  <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg p-4 hover:shadow-md transition-all duration-300 cursor-pointer group">
                    <div className="flex items-center space-x-3">
                      <div className="bg-slate-100 rounded-lg p-2">
                        <MdDateRange className="w-5 h-5 text-[#A6C833]" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-600 font-medium">
                          Created Date
                        </p>
                        <p className="text-slate-900 font-semibold">
                          {formatDate(Data?.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* right-1: ETD Port */}
                  <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg p-4 hover:shadow-md transition-all duration-300 cursor-pointer group">
                    <div className="flex items-center space-x-3">
                      <div className="bg-slate-100 rounded-lg p-2">
                        <MdSchedule className="w-5 h-5 text-[#A6C833]" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-600 font-medium">
                          ETD Port
                        </p>
                        <p className="text-slate-900 font-semibold">
                          {Data.basicInfo?.ETD_Port
                            ? moment(Data.basicInfo.ETD_Port).format("MMM YYYY")
                            : "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* right-2: Contract Type */}
                  <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg p-4 hover:shadow-md transition-all duration-300 cursor-pointer group">
                    <div className="flex items-center space-x-3">
                      <div className="bg-slate-100 rounded-lg p-2">
                        <MdBusiness className="w-5 h-5 text-[#A6C833]" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-600 font-medium">
                          Contract Type
                        </p>
                        <p className="text-slate-900 font-semibold">
                          {Data.basicInfo?.typeOfSaleContract || "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* right-3: Business */}
                  <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg p-4 hover:shadow-md transition-all duration-300 cursor-pointer group">
                    <div className="flex items-center space-x-3">
                      <div className="bg-slate-100 rounded-lg p-2">
                        <MdLocalShipping className="w-5 h-5 text-[#A6C833]" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-600 font-medium">
                          Business
                        </p>
                        <p className="text-slate-900 font-semibold">
                          {Data.businessName || "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* right-4: Total FCL / Special Contract */}
                  {Data.basicInfo?.typeOfSaleContract === "Profit Sharing" ? (
                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg p-4 border-l-4 border-amber-400 hover:shadow-md transition-all duration-300 cursor-pointer group">
                      <div className="flex items-center space-x-3">
                        <div className="bg-amber-100 rounded-lg p-2">
                          <MdAssignment className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-sm text-amber-700 font-medium">
                            Special Contract
                          </p>
                          <p className="text-amber-800 font-bold">
                            {Data.basicInfo?.typeOfSaleContract}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg p-4 hover:shadow-md transition-all duration-300 cursor-pointer group">
                      <div className="flex items-center space-x-3">
                        <div className="bg-slate-100 rounded-lg p-2">
                          <MdLocalShipping className="w-5 h-5 text-[#A6C833]" />
                        </div>
                        <div>
                          <p className="text-sm text-slate-600 font-medium">
                            Total FCL
                          </p>
                          <p className="text-slate-900 font-semibold">
                            {Data.productInfo?.[0]?.quantityFCL || "N/A"}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* right-5: Empty placeholder to balance */}
                  <div style={{ height: "1px", visibility: "hidden" }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar: Progress & Profitability */}
          <div className="space-y-6">
            {/* Progress Card */}
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
              <div className="flex items-center mb-4">
                <div className="bg-gradient-to-r from-slate-600 to-slate-700 rounded-lg p-2 mr-3">
                  <MdTrendingUp className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Progress
                </h3>
              </div>
              <ContractProgress currentStep={0} />
            </div>

            {/* Profitability Card */}
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
              <div className="flex items-center mb-4">
                <div className="bg-gradient-to-r from-slate-600 to-slate-700 rounded-lg p-2 mr-3">
                  <MdAccountBalance className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Profitability
                </h3>
              </div>
              <ProfitabilityCard Data={Data} />
            </div>
          </div>
        </div>
      </div>

      {/* Item Details Popup */}
      <ItemDetailsPopup
        isOpen={isItemPopupOpen}
        onClose={() => {
          setIsItemPopupOpen(false);
          setFetchedItemDetails(null); // Clear fetched data when closing
        }}
        itemData={fetchedItemDetails || Data.productInfo?.[0]}
        contractData={Data}
        isLoading={isLoadingItem}
      />
    </div>
  );
};

export default ContractHeader;
