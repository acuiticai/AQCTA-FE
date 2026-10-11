import React, { useState, useEffect, useContext } from "react";
import { FiPlus, FiEye, FiFile } from "react-icons/fi";
import { Link } from "react-router-dom";
import { Pencil } from "lucide-react";
import { MdCheckCircle, MdReply } from "react-icons/md"; // Represents approval
import { notifySuccess, notifyError } from "@/utils/toast";
import request from "@/services/httpService";
import addMoreButton from "../../assets/img/icons/moreIcon.svg";
import SignatureTab from "./SignatureTab";
import axios from "axios";
import { AdminContext } from "@/context/AdminContext";
import { MdPictureAsPdf } from "react-icons/md";
import useButtonColor from "@/hooks/useButtonColor";
import {
  formatAmount,
  formatDate,
  formatTime,
} from "@/components/formatAmount";
import SearchBar from "@/components/SearchBar";
import Table from "@/components/Table";
import StyledLabel2 from "@/components/StyledLabel2";
import DocumentTemplateModal from "./actions/DocumentTemplateModal";
import DropDownMenu from "./reusablecomponents/CustomDropdown";
import useSalesContract from "./hooks/Purchase_ContractContext";
import moment from "moment";
import BusinessDropdown from "@/components/BusinessDropdown";
import { useHistory } from "react-router-dom";

//Copmonents
import { PageHeader, SummaryCards, DataTable } from "@/page-layouts/index";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
export const headerSales = [
  "Purchase Contract No.",
  "Buyer Name",
  "Quantity",
  "Per Metric Ton",
  "Price",
  "Creation Date",
  "Status",
  "Action",
];
export default function SalesContract() {
  const buttonColor = useButtonColor();
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const [selectedContractId, setSelectedContractId] = useState(null);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [pagePermissions, setPagePermissions] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [businesses, setBusinesses] = useState([]);
  const [selectedBusiness, setSelectedBusiness] = useState("");
  const [contractId, setContractId] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [salesContractStats, setSalesContractStats] = useState({
    totalContracts: 0,
    totalOpenContracts: 0,
    totalCancelledContracts: 0,
    totalCompletedContracts: 0,
  });
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const fetchSalesContracts = async () => {
      // if (!selectedBusiness || !adminInfo?.token) return;

      setLoading(true);
      try {
        const response = await request.get(
          `${Base_URL}/contracts/?businessId=${selectedBusiness}&page=${currentPage}&limit=${recordsPerPage}`,
          {
            headers: {
              authorization: `Bearer ${adminInfo.token}`,
            },
          }
        );

        const data = response; // 👈 fix: extract `.data` from response
        console.log("data, data", data);
        // Update contracts
        setContracts(data.contracts || []);

        // Update summary stats
        setSalesContractStats({
          totalContracts: data.totalContracts || 0,
          totalOpenContracts: data.totalOpenContracts || 0,
          totalCancelledContracts: data.totalCancelledContracts || 0,
          totalCompletedContracts: data.totalCompletedContracts || 0,
        });

        // Update total pages for pagination
        setTotalPages(data.totalPages || 1);
      } catch (error) {
        notifyError("Error fetching sales contracts");
        console.error("Error fetching contracts:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSalesContracts();
  }, [selectedBusiness, currentPage, recordsPerPage, adminInfo]);

  const history = useHistory();
  useEffect(() => {
    const fetchBusinesses = async () => {
      try {
        const storedBusinesses = localStorage.getItem("businesses");
        if (storedBusinesses) {
          setBusinesses(JSON.parse(storedBusinesses));
        } else {
          const response = await request.get(`/businesses`, {
            headers: {
              authorization: `Bearer ${adminInfo.token}`,
            },
          });
          setBusinesses(response.data?.data || []);
        }
      } catch (error) {
        console.error("Failed to fetch businesses:", error);
      }
    };

    if (adminInfo?.token) {
      fetchBusinesses();
    }
  }, [adminInfo]);

  const statusColors = {
    Draft: "text-lime-500", // Light Green for draft
    "Waiting Management Approval": "text-blue-500", // Blue for pending approval
    "Preparing Contract": "text-orange-500", // Orange for in-progress contract
    "Waiting Vendor Approval": "text-yellow-500", // Yellow to indicate waiting status
    Pending: "text-purple-500", // Purple for general pending states
    Processing: "text-indigo-500", // Indigo for active processing
    "On-hold": "text-gray-500", // Gray for hold status
    Cancelled: "text-red-500", // Red for cancellations
    Completed: "text-green-500", // Green for completed contracts
  };

  console.log("businesses", businesses);

  const checkPagePermissions = () => {
    if (!adminInfo || !adminInfo.role || !adminInfo.role.modules) {
      console.log("No admin info or modules found");
      return;
    }

    const currentPath = location.pathname;
    console.log("Current Path:", currentPath);

    let permissions = [];

    adminInfo.role.modules.forEach((module) => {
      if (!module.path) {
        console.log(`⚠️ Missing path for module: ${module.name}`);
        return;
      }

      console.log("Checking module:", module.name, "Path:", module.path);

      // ✅ Match main module by `path`
      if (currentPath === module.path) {
        console.log("✅ Matched Module:", module.name);
        permissions = [...permissions, ...module.permissions];
      }

      // ✅ Check for submodules
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

    // ✅ Remove duplicates and ensure state updates correctly
    if (permissions.length > 0) {
      console.log("✅ Final Permissions:", permissions);
      setPagePermissions([...new Set(permissions)]);
    } else {
      console.log("🚨 No permissions found for this page.");
      setPagePermissions([]);
    }
  };

  // ✅ Ensure `useEffect` runs when `adminInfo` changes
  useEffect(() => {
    if (adminInfo) {
      checkPagePermissions();
    }
  }, [location.pathname, adminInfo]);

  console.log("pagePermissions", pagePermissions);

  // ✅ Check if the user has a specific permission
  const hasPermission = (permission) => {
    return pagePermissions.includes(permission);
  };
  console.log("hasPermission", hasPermission("Add"));

  const handleGenerateDocument = ({ templateId, contractId }) => {
    console.log("Generating document:", {
      templateId,
      contractId,
      selectedBusiness,
    });
    if (contractId)
      history.push(`/edit-document-template/${templateId}:${contractId}`);
    // Add your document generation logic here
  };

  const RequestApproval = async (_id) => {
    console.log("status", _id);
    try {
      const data = {
        status: "Waiting Management Approval",
      };

      await request.put(`/sales-contracts/status/${_id}`, data);
      notifySuccess("Sales Contract Updated Successfully", () => {
        // history.push("/sales");
        window.location.reload();
      });
    } catch (error) {
      notifyError(
        _id
          ? "Error updating contract"
          : "Error saving Sales Contract Basic Info"
      );
      console.log("Error : ", error);
    }
  };
  const HandleOpenFile = async (item) => {
    console.log("item.document_id", item.document_id);
    try {
      let Response = await request.get(
        `${Base_URL}/documents/getFileWithAllData/${item.document_id}`
      );
      console.log("item.document_id Response", Response);

      window.open(Response.data.url, "_blank");
    } catch (error) {
      notifyError("Error getting file");
      console.log("Error : ", error);
    }
  };

  // Handle more options click
  const handleMoreOptionsClick = () => {
    setShowMoreOptions(!showMoreOptions);
  };

  // More options menu
  const renderMoreOptionsMenu = () => {
    if (!showMoreOptions) return null;

    return (
      <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10">
        <div className="py-1">
          <button
            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            onClick={() => {
              setShowMoreOptions(false);
              // Handle option 1
            }}
          >
            Export Modules
          </button>
          <button
            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            onClick={() => {
              setShowMoreOptions(false);
              // Handle option 2
            }}
          >
            Import Modules
          </button>
          <button
            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            onClick={() => {
              setShowMoreOptions(false);
              // Handle option 3
            }}
          >
            Bulk Actions
          </button>
        </div>
      </div>
    );
  };

  // Prepare summary cards data
  const summaryCardsData = [
    {
      title: "Total Contracts",
      value: salesContractStats.totalContracts,
      isHighlighted: true,
    },
    { title: "Open Contracts", value: salesContractStats.totalOpenContracts },
    {
      title: "Cancelled Contracts",
      value: salesContractStats.totalCancelledContracts,
    },
    {
      title: "Completed Contracts",
      value: salesContractStats.totalCompletedContracts,
    },
  ];

  // Prepare filters for the filter bar
  const transformedBusinesses = businesses.map((business) => ({
    value: business._id,
    label: business.name,
  }));

  const filters = [
    {
      value: selectedBusiness,
      onChange: setSelectedBusiness,
      placeholder: "Select Business",
      options: transformedBusinesses,
    },
  ];

  return (
    <div className="p-6 bg-white min-h-screen">
      {/* Page Header */}
      <div className="relative">
        <PageHeader
          title="Purchase Contracts"
          onAddNew={() => history.push("/add-purchase-contract")}
          showAddButton={hasPermission("Add")}
          onMoreOptionsClick={handleMoreOptionsClick}
        />
        {renderMoreOptionsMenu()}
      </div>

      {/* Summary Cards */}
      <SummaryCards cards={summaryCardsData} />

      {/* Filters & Search */}
      <div className="bg-[#F9F9FA] rounded-xl p-4">
        {/* Table */}
        <DataTable
          //for filters
          title="All Contracts"
          onSearch={setSearchTerm}
          searchValue={searchTerm}
          searchPlaceholder="Search"
          filters={filters}
          //for table
          headers={headerSales}
          loading={loading}
          data={contracts}
          currentPage={currentPage}
          totalPages={totalPages}
          recordsPerPage={recordsPerPage}
          onPageChange={(page) => setCurrentPage(page)}
          onRecordsPerPageChange={(perPage) => {
            setRecordsPerPage(perPage);
            setCurrentPage(1);
          }}
          renderRow={(contract, index) => (
            <tr key={contract._id || index} className="border-b">
              <td className="py-2 px-4">{contract.contractNo}</td>
              <td className="py-2 px-4">
                {contract?.basicInfo?.buyerCompanyName}
              </td>
              <td className="py-2 px-4">
                {contract?.productInfo?.[0]?.quantityMTS || "N/A"}
              </td>
              <td className="py-2 px-4">
                ${formatAmount(contract?.productInfo?.[0]?.price)}
              </td>
              <td className="py-2 px-4">
                ${formatAmount(contract?.productInfo?.[0]?.totalValue)}
              </td>
              <td className="py-2 px-4">{`${formatDate(
                contract?.createdAt
              )} ${formatTime(contract?.createdAt)}`}</td>
              <td
                className={`py-2 px-4 font-medium capitalize ${
                  statusColors[contract.status] || ""
                }`}
              >
                {contract.status}
              </td>
              <td className="py-2 px-4 text-left">
                <div
                  className="flex items-center justify-start space-x-2 w-full"
                  style={{ width: "fit-content" }}
                >
                  {hasPermission("View") && (
                    <Link
                      to={{
                        pathname: "/view-sales-contract",
                        state: { contractId: contract._id },
                      }}
                    >
                      <button className="p-2 hover:bg-gray-100 rounded-md flex items-center">
                        <FiEye className="text-gray-600 hover:text-blue-400" />
                      </button>
                    </Link>
                  )}

                  {hasPermission("Update") && contract.status === "Draft" && (
                    <button
                      className="p-2 hover:bg-gray-100 rounded-md flex items-center"
                      onClick={() => {
                        setContractId(contract._id); // ← This now uses local state
                        history.push("/add-purchase-contract");
                      }}
                    >
                      <Pencil className="text-gray-600 h-4 hover:text-red-400" />
                    </button>
                  )}

                  {contract.status === "Draft" && (
                    <button
                      onClick={() => RequestApproval(contract._id)}
                      className="p-2 hover:bg-gray-100 rounded-md flex items-center"
                    >
                      <MdCheckCircle className="text-gray-600 hover:text-blue-400" />
                    </button>
                  )}

                  {hasPermission("Approve Sales") &&
                    contract.status === "Waiting Management Approval" && (
                      <button
                        onClick={() => {
                          setSelectedContractId(contract._id);
                          setIsSignatureModalOpen(true);
                        }}
                        className="p-2 hover:bg-gray-100 rounded-md flex items-center"
                      >
                        <MdReply className="text-gray-600 hover:text-blue-400" />
                      </button>
                    )}

                  {contract.document_id && (
                    <button
                      onClick={() => HandleOpenFile(contract)}
                      className="p-2 hover:bg-gray-100 rounded-md flex items-center"
                    >
                      <MdPictureAsPdf className="text-gray-600 hover:text-blue-400" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          )}
        />

        {/* Signature Modal */}
        {isSignatureModalOpen && (
          <SignatureTab
            contractId={selectedContractId}
            onClose={() => {
              setIsSignatureModalOpen(false);
              setSelectedContractId(null);
            }}
          />
        )}

        {/* Document Template Modal */}
        <DocumentTemplateModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedContractId(null);
          }}
          contractId={selectedContractId}
          onSubmit={handleGenerateDocument}
        />
      </div>
    </div>
  );
}
