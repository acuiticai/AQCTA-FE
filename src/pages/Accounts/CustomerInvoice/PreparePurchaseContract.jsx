import { useState, useEffect, useContext } from "react";
import { FiEye } from "react-icons/fi";
import { MdEmail } from "react-icons/md";
import { useHistory } from "react-router-dom";
import { IoArrowBack } from "react-icons/io5";
import axios from "axios";
import moment from "moment";
import SearchBar from "@/components/SearchBar";
import Table from "@/components/Table";
import BusinessDropdown from "@/components/BusinessDropdown";
import SignatureTab from "../../Purchase_Contract/SignatureTab.jsx";
import DocumentTemplateModal from "../../Purchase_Contract/actions/DocumentTemplateModal.jsx";
import DocumentGenerator from "./purchase-document-generator.jsx";
import DocumentViewer from "./document-viewer.jsx";
// import DocumentComparisonViewer from "./document-comparison-viewer.jsx";
import { AdminContext } from "@/context/AdminContext";
import {
  formatAmount,
  formatDate,
  formatTime,
} from "@/components/formatAmount";
import { notifySuccess } from "@/utils/toast";
import { DataTable, PageHeader } from "@/page-layouts/index.jsx";
import { Tooltip } from "react-tooltip";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const PContractListScreen = () => {
  const history = useHistory();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBusiness, setSelectedBusiness] = useState("all");
  const [contracts, setContracts] = useState([]);
  const [filteredContracts, setFilteredContracts] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [business_id, setBusinesss_id] = useState(null);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [pagePermissions, setPagePermissions] = useState([]);
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(false);

  // New states for document generation and viewing
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [isComparisonViewerOpen, setIsComparisonViewerOpen] = useState(false);
  const [selectedContractId, setSelectedContractId] = useState(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [documentUrl, setDocumentUrl] = useState("");
  const [selectedContractNo, setSelectedContractNo] = useState("");

  const headers = [
    "Contract No",
    "Customer Name",
    "Business",
    "Product",
    "Invoice Date",
    "Amount",
    "Action",
  ];

  const statusColors = {
    Open: "text-green-500",
    Completed: "text-blue-500",
    Cancelled: "text-red-500",
    Draft: "text-lime-500",
    "Waiting Management Approval": "text-blue-500",
    "Preparing Contract": "text-orange-500",
    "Waiting Vendor Approval": "text-yellow-500",
    Pending: "text-purple-500",
    Processing: "text-indigo-500",
    "On-hold": "text-gray-500",
  };

  useEffect(() => {
    const storedBusinesses = localStorage.getItem("businesses");
    if (storedBusinesses) {
      const parsedBusinesses = JSON.parse(storedBusinesses);
      setBusinesses(parsedBusinesses);
      if (parsedBusinesses.length === 1) {
        setSelectedBusiness(parsedBusinesses[0]._id);
        fetchContracts(parsedBusinesses[0]._id, 1, recordsPerPage);
      } else {
        fetchContracts("all", 1, recordsPerPage);
      }
    }
  }, []);

  useEffect(() => {
    if (adminInfo?._id && selectedBusiness) {
      fetchContracts(selectedBusiness, currentPage, recordsPerPage);
    }
  }, [adminInfo?._id, selectedBusiness, currentPage, recordsPerPage]);
  
  // Reset filtered contracts when contracts change or search is cleared
  useEffect(() => {
    if (!searchTerm) {
      setFilteredContracts(contracts);
    }
  }, [contracts, searchTerm]);

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

  const hasPermission = (permission) => {
    return pagePermissions.includes(permission);
  };

  // Updated handleGenerateDocument function
  const handleGenerateDocument = async (payload) => {
    console.log("Generating document:", payload);
    setSelectedTemplateId(payload.templateId);
    setSelectedTemplate(payload.template);
    setSelectedContractId(payload.contractId);
    // Open the unified DocumentGenerator dialog (includes comparison on the left)
    setIsGeneratorOpen(true);
  };

  const handleProceedToGenerate = () => {
    setIsComparisonViewerOpen(false);
    setIsGeneratorOpen(true);
  };

  // Handle document generation success
  const handleGenerationSuccess = () => {
    notifySuccess("Document generated and saved successfully!");
    fetchContracts(selectedBusiness, currentPage, recordsPerPage); // Refresh the contracts list
  };

  const onBack = () => {
    history.push(`/accounts`);
  };

  const fetchContracts = async (businessId, page = 1, limit = 10) => {
    try {
      setLoading(true);
      console.log("req.query.businessId", businessId);
      let business_id = businessId;
      // If businessId is empty, null, undefined, or "all", don't send businessId parameter
      // This will fetch data for all businesses
      if (!business_id || business_id === "all" || business_id === "") {
        business_id = "";
      }
      const response = await axios.get(
        `${Base_URL}/purchase-contracts/approved?businessId=${business_id}&page=${page}&limit=${limit}`
      );
      console.log("response.data", response.data);
      const contractsData = response.data.contracts || [];
      setContracts(contractsData);
      setFilteredContracts(contractsData);
      setTotalRecords(response.data.totalCount || 0);
      setTotalPages(response.data.totalPages || 1);
    } catch (error) {
      console.error("Error fetching contracts:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value) => {
    const searchValue = value.toLowerCase();
    setSearchTerm(searchValue);

    const filtered = contracts.filter(
      (contract) =>
        contract.basicInfo.contractNumber
          ?.toLowerCase()
          .includes(searchValue) ||
        contract.basicInfo.supplierName?.toLowerCase().includes(searchValue) ||
        contract.contractNo?.toLowerCase().includes(searchValue) ||
        contract.basicInfo.finalCustomerName
          ?.toLowerCase()
          .includes(searchValue)
    );
    setFilteredContracts(filtered);
  };

  const handleBusinessChange = (businessId) => {
    setSelectedBusiness(businessId || "all");
    setCurrentPage(1); // Reset to first page when business changes
    fetchContracts(businessId || "all", 1, recordsPerPage);
  };

  const clearAllFilters = () => {
    setSelectedBusiness("all");
    setSearchTerm("");
    setCurrentPage(1);
    // Refetch data for all businesses
    fetchContracts("all", 1, recordsPerPage);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    fetchContracts(selectedBusiness, page, recordsPerPage);
  };

  const handleRecordsPerPageChange = (value) => {
    setRecordsPerPage(value);
    setCurrentPage(1);
    fetchContracts(selectedBusiness, 1, value);
  };

  const handleViewContract = (contractId) => {
    history.push(`/Contract Details/${contractId}`);
  };

  const handleEditContract = (contractId) => {
    console.log("Navigating to edit screen with contractId:", contractId);
    history.push(`/Edit Contract/${contractId}`);
  };

  const filters = [
    {
      isClearButton: true,
      buttonProps: {
        onClick: clearAllFilters,
      },
      tooltip: "Clear Filters",
    },
    {
      placeholder: "Select a Business",
      value: selectedBusiness === "all" ? "" : selectedBusiness,
      onChange: (value) => {
        // When value is empty or null, treat as "all"
        handleBusinessChange(value || "all");
      },
      options: [
        { value: "", label: "All Businesses" },
        ...businesses.map((business) => ({
          value: business._id,
          label: `${business.name}`,
        })),
      ],
    },
  ];

  return (
    <div
      className="p-6 bg-white min-h-screen"
      style={{ backgroundColor: "#FFFF" }}
    >
      <PageHeader
        title="Prepare Purchase Contract"
        showBackButton={true}
        onBackClick={onBack}
      />

      <DataTable
        title="Approved Purchase Contract"
        headers={headers}
        data={filteredContracts}
        filters={filters}
        loading={loading}
        totalRecords={totalRecords}
        currentPage={currentPage}
        totalPages={totalPages}
        recordsPerPage={recordsPerPage}
        onPageChange={handlePageChange}
        onRecordsPerPageChange={handleRecordsPerPageChange}
        searchValue={searchTerm}
        onSearch={handleSearch}
        renderRow={(contract) => (
          <tr key={contract._id} className="border-b">
            <td className="py-2 px-4">{contract?.contractNo}</td>
            <td className="py-2 px-4">
              {
                contract?.basicInfo?.selectedVendorId?.basicInformation
                  ?.vendorDisplayName
              }
            </td>
            <td className="py-2 px-4">
              {contract?.business?.name || "N/A"}
            </td>
            <td className="py-2 px-4">{contract?.productInfo[0]?.title}</td>
            <td className="py-2 px-4">{`${formatDate(
              contract?.createdAt
            )} ${formatTime(contract?.createdAt)}`}</td>
            <td className="py-2 px-4">
              {formatAmount(contract?.productInfo[0]?.totalValue)}
            </td>
            <td className="py-2 px-4">
              {contract.status === "Preparing Contract" && (
                <div className="inline-block">
                  <button
                    data-tooltip-id={`create-doc-tooltip-${contract._id}`}
                    data-tooltip-content="Create Document"
                    className="p-2 hover:bg-gray-100 rounded-md"
                    onClick={() => {
                      setSelectedContractId(contract._id);
                      setBusinesss_id(contract.business);
                      setSelectedContractNo(contract.contractNo || "document");
                      setIsModalOpen(true);
                    }}
                  >
                    <MdEmail
                      className="text-gray-600 h-4 hover:text-lime-500"
                    />
                  </button>
                  <Tooltip
                    id={`create-doc-tooltip-${contract._id}`}
                    place="top"
                    effect="solid"
                    style={{
                      backgroundColor: "#374151",
                      color: "#fff",
                      borderRadius: "4px",
                      padding: "6px 10px",
                      fontSize: "12px",
                    }}
                  />
                </div>
              )}
              {contract.documentDetails &&
                contract.documentDetails.document_url && (
                  <div className="inline-block ml-2">
                    <button
                      data-tooltip-id={`view-doc-tooltip-${contract._id}`}
                      data-tooltip-content="View Document"
                      className="p-2 hover:bg-gray-100 rounded-md"
                      onClick={() => {
                        setDocumentUrl(contract.documentDetails.document_url);
                        setSelectedContractNo(contract.contractNo || "document");
                        setIsViewerOpen(true);
                      }}
                    >
                      <FiEye
                        className="text-gray-600 h-4 hover:text-lime-500"
                      />
                    </button>
                    <Tooltip
                      id={`view-doc-tooltip-${contract._id}`}
                      place="top"
                      effect="solid"
                      style={{
                        backgroundColor: "#374151",
                        color: "#fff",
                        borderRadius: "4px",
                        padding: "6px 10px",
                        fontSize: "12px",
                      }}
                    />
                  </div>
                )}
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
            // setSelectedContractId(null)
          }}
        />
      )}

      {/* Document Template Modal */}
      <DocumentTemplateModal
        isOpen={isModalOpen}
        type="Purchase Contract"
        onClose={() => {
          setIsModalOpen(false);
          // setSelectedContractId(null)
        }}
        contractId={selectedContractId}
        onSubmit={handleGenerateDocument}
      />
      {console.log("selectedContractId", selectedContractId)}
      {/* Document Generator Dialog */}
      {isGeneratorOpen && (
        <DocumentGenerator
          open={isGeneratorOpen}
          onClose={() => setIsGeneratorOpen(false)}
          templateId={selectedTemplateId}
          contractId={selectedContractId}
          business_id={business_id}
          adminInfo={adminInfo}
          onSuccess={handleGenerationSuccess}
        />
      )}

      {/* Document Comparison Viewer not needed - handled inside DocumentGenerator */}

      {/* Document Viewer Dialog */}
      {isViewerOpen && (
        <DocumentViewer
          business_id={business_id}
          open={isViewerOpen}
          onClose={() => setIsViewerOpen(false)}
          documentUrl={documentUrl}
          contractNo={selectedContractNo}
        />
      )}
    </div>
  );
};

export default PContractListScreen;
