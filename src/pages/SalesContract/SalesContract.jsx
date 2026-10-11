import React, { useState, useEffect, useContext } from "react";
import { useTranslation } from "react-i18next";
import { notifySuccess, notifyError } from "@/utils/toast";
import request from "@/services/httpService";
import { AdminContext } from "@/context/AdminContext";
import useButtonColor from "@/hooks/useButtonColor";
import axios from "axios";
import {
  formatAmount,
  formatDate,
  formatTime,
  formatQuantity,
} from "@/components/formatAmount";
import { headerSales, headersToHide } from "@/data/data-sales-contract";
import { useSalesContext } from "./context/SalesContractContext";
import useSalesContract from "./hooks/useSalesContract";
import { useHistory } from "react-router-dom";

import SignatureTab from "../../pages/SalesContract/SignatureTab.jsx";
import DocumentTemplateModal from "../../pages/SalesContract/actions/DocumentTemplateModal.jsx";
import DocumentGenerator from "../../pages/Accounts/CustomerInvoice/document-generator";
import DocumentViewer from "../../pages/Accounts/CustomerInvoice/document-viewer";
import ContractHistoryModal from "@/components/ContractHistoryModal";
import SendEmailModal from "./SendEmailModal";

//Components
import {
  PageHeader,
  SummaryCards,
  DataTable,
  ActionButtons,
  CustomModal,
  Button,
} from "@/page-layouts";
import ChangeStatusModal from "./ChangeStatusModal";

import { ACTION_BUTTON_TYPES } from "@/utils/constants";
import { contractNumberGenerate } from "./hooks/useBasicInfo";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

export default function SalesContract() {
  const { t } = useTranslation();
  const buttonColor = useButtonColor();
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const [selectedContractId, setSelectedContractId] = useState(null);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [pagePermissions, setPagePermissions] = useState([]);
  const { businesses, setSelectedBusiness, selectedBusiness, setContractId } =
    useSalesContext();
  const [businessesLoading, setBusinessesLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  // Additional filter states
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [selectedContractDate, setSelectedContractDate] = useState("");
  const [selectedPurchaseFilter, setSelectedPurchaseFilter] = useState("");
  const [selectedInternalSalesFilter, setSelectedInternalSalesFilter] = useState("");
  const [customers, setCustomers] = useState([]);
  const [items, setItems] = useState([]);

  // Handle business loading
  useEffect(() => {
    if (businesses.length > 0) {
      setBusinessesLoading(false);
    }
  }, [businesses]);

  useEffect(() => {
    const fetchItems = async () => {
      setLoading(true);
      try {
        let query = {};
        if (selectedBusiness) {
          query.businessId = selectedBusiness;
        } else if (businesses.length > 0) {
          query.businessIds = businesses.map((business) => business._id);
        }
        const response = await axios.get(`${Base_URL}/items`, {
          params: query,
        });
        console.log("set Items", response);
        if (response.status === 200 && response.data) {
          setItems(response.data);
        } else {
          console.error("Failed to fetch items");
        }
      } catch (error) {
        console.error("❌ Error fetching items:", error);
      } finally {
        setLoading(false);
      }
    };

    if (businesses.length > 0 || selectedBusiness) {
      fetchItems();
    }
  }, [selectedBusiness, businesses]);

  const {
    contracts,
    salesContractStats,
    totalPages,
    totalCount,
    loading: salesContractLoading,
  } = useSalesContract(
    selectedBusiness,
    currentPage,
    recordsPerPage,
    selectedStatus,
    selectedCustomer,
    selectedContractDate,
    searchTerm,
    selectedItem,
    selectedPurchaseFilter,
    selectedInternalSalesFilter
  );

  // Debug logging
  console.log(
    "🔍 Sales Contract Component - selectedPurchaseFilter:",
    selectedPurchaseFilter
  );
  console.log(
    "🔍 Sales Contract Component - contracts count:",
    contracts.length
  );

  const clearAllFilters = () => {
    setSelectedStatus("");
    setSelectedCustomer("");
    setSelectedContractDate("");
    setSelectedPurchaseFilter("");
    setSelectedInternalSalesFilter("");
    setSelectedBusiness("");
    setSearchTerm("");
    setSelectedItem("");
    setSelectedType("");
    setCurrentPage(1);
  };

  const history = useHistory();
  const [business_id, setBusinesss_id] = useState(null);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [documentUrl, setDocumentUrl] = useState("");
  const [selectedContractNo, setSelectedContractNo] = useState("");
  const [isChangeStatusModalOpen, setIsChangeStatusModalOpen] = useState(false);
  const [changeStatusContractId, setChangeStatusContractId] = useState(null);
  const [changeStatusCurrent, setChangeStatusCurrent] = useState("");
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [contractToDuplicate, setContractToDuplicate] = useState(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedContractForHistory, setSelectedContractForHistory] =
    useState(null);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [selectedContractForEmail, setSelectedContractForEmail] =
    useState(null);
  const [customerEmailForContract, setCustomerEmailForContract] = useState("");

  const statusColors = {
    Draft: "text-lime-500",
    "Waiting Management Approval": "text-blue-500",
    "Amendments Requested (Management)": "text-yellow-600",
    "Rejected (Management)": "text-red-600",
    "Preparing Contract": "text-orange-500",
    "Waiting Customer Approval": "text-yellow-500",
    Pending: "text-purple-500",
    Processing: "text-indigo-500",
    "On-hold": "text-gray-500",
    Cancelled: "text-red-500",
    Completed: "text-green-500",
  };

  // Status options for filter
  const statusOptions = [
    { value: "", label: t("salesContract.status.all", { defaultValue: "All Statuses" }) },
    { value: "Draft", label: t("salesContract.status.draft", { defaultValue: "Draft" }) },
    {
      value: "Waiting Management Approval",
      label: t("salesContract.status.waitingManagementApproval", {
        defaultValue: "Waiting Management Approval",
      }),
    },
    {
      value: "Amendments Requested (Management)",
      label: t("salesContract.status.amendmentsRequestedManagement", {
        defaultValue: "Amendments Requested (Management)",
      }),
    },
    { value: "Rejected (Management)", label: t("salesContract.status.rejectedManagement", { defaultValue: "Rejected (Management)" }) },
    { value: "Preparing Contract", label: t("salesContract.status.preparingContract", { defaultValue: "Preparing Contract" }) },
    { value: "Waiting Customer Approval", label: t("salesContract.status.waitingCustomerApproval", { defaultValue: "Waiting Customer Approval" }) },
    { value: "Pending", label: t("salesContract.status.pending", { defaultValue: "Pending" }) },
    { value: "Processing", label: t("salesContract.status.processing", { defaultValue: "Processing" }) },
    { value: "On-hold", label: t("salesContract.status.onHold", { defaultValue: "On-hold" }) },
    { value: "Cancelled", label: t("salesContract.status.cancelled", { defaultValue: "Cancelled" }) },
    { value: "Completed", label: t("salesContract.status.completed", { defaultValue: "Completed" }) },
  ];
  // Fetch customers for filter dropdown
  useEffect(() => {
    const fetchCustomers = async () => {
      setLoading(true);
      try {
        let params = {};
        if (selectedBusiness) {
          params.businessId = selectedBusiness;
        } else if (businesses.length > 0) {
          params.businessIds = JSON.stringify(businesses.map((business) => business._id));
        }
        const response = await axios.get(`${Base_URL}/customers`, { params });
        console.log("Customers fetched successfully:", response.data);
        if (response.status) {
          setCustomers(response?.data.customers || []);
        } else {
          console.error("Failed to fetch customers");
        }
      } catch (error) {
        console.error("❌ Error fetching customers:", error);
      } finally {
        setLoading(false);
      }
    };
    
    if (businesses.length > 0 || selectedBusiness) {
      fetchCustomers();
    }
  }, [selectedBusiness, businesses]);

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

  console.log("pagePermissions", pagePermissions);

  const hasPermission = (permission) => {
    return pagePermissions.includes(permission);
  };

  const handleGenerateDocument = (payload) => {
    console.log("Generating document:", payload);
    setSelectedTemplateId(payload.templateId);
    setSelectedContractId(payload.contractId);
    setIsGeneratorOpen(true);
  };

  const handleGenerationSuccess = () => {
    notifySuccess("Accounts Approve Contract, Wait for Customer Now!", () => {
      window.location.reload();
      setLoading(false);
    });
  };

  const RequestApproval = async (_id) => {
    console.log("status", _id);
    try {
      setLoading(true);
      const data = {
        status: "Waiting Management Approval",
      };

      await request.put(`/sales-contracts/status/${_id}`, data);
      notifySuccess("Wait for Management Approval Now!", () => {
        window.location.reload();
        setLoading(false);
      });
    } catch (error) {
      notifyError(
        _id
          ? "Error updating contract"
          : "Error saving Sales Contract Basic Info"
      );
      setLoading(false);
      console.log("Error : ", error);
    }
  };

  // After Accounts requested amendments, Sales sends back to Accounts (Preparing Contract)
  const RequestApprovalToAccounts = async (_id) => {
    try {
      await request.put(`/sales-contracts/status/${_id}`, {
        status: "Preparing Contract",
        is_accounts: true,
      });
      notifySuccess("Sent to Accounts for review", () =>
        window.location.reload()
      );
    } catch (error) {
      notifyError("Failed to send to Accounts");
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

  const handleMoreOptionsClick = () => {
    setShowMoreOptions(!showMoreOptions);
  };

  const renderMoreOptionsMenu = () => {
    if (!showMoreOptions) return null;

    return (
      <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10">
        <div className="py-1">
          <button
            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            onClick={() => {
              setShowMoreOptions(false);
            }}
          >
            Export Modules
          </button>
          <button
            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            onClick={() => {
              setShowMoreOptions(false);
            }}
          >
            Import Modules
          </button>
          <button
            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            onClick={() => {
              setShowMoreOptions(false);
            }}
          >
            Bulk Actions
          </button>
        </div>
      </div>
    );
  };

  const handleDuplicateClick = (contract) => {
    setContractToDuplicate(contract);
    setIsDuplicateModalOpen(true);
  };

  const handleSendEmailClick = async (contract) => {
    console.log("📧 Opening email modal for contract:", contract);
    setSelectedContractForEmail(contract);

    // Try to get customer email from contract
    let customerEmail = "";

    // Try different paths to find customer email
    if (contract?.basicInfo?.customer_id?.basicInformation?.email) {
      customerEmail = contract.basicInfo.customer_id.basicInformation.email;
    } else if (contract?.customer_id?.basicInformation?.email) {
      customerEmail = contract.customer_id.basicInformation.email;
    } else if (contract?.basicInfo?.selectedCustomerId) {
      // If we have customer ID but not populated, we might need to fetch it
      try {
        const response = await axios.get(
          `${Base_URL}/customers/${contract.basicInfo.selectedCustomerId}`
        );
        if (response.data?.basicInformation?.email) {
          customerEmail = response.data.basicInformation.email;
        }
      } catch (error) {
        console.log("Could not fetch customer email:", error);
      }
    }

    setCustomerEmailForContract(customerEmail);
    setIsEmailModalOpen(true);
  };

  const handleConfirmDuplicate = async () => {
    if (!contractToDuplicate) return;
    setLoading(true);
    let attempts = 0;
    let maxAttempts = 5;
    let success = false;
    let lastError = null;
    while (attempts < maxAttempts && !success) {
      try {
        // Create a deep copy of the contract and remove only the fields that shouldn't be duplicated
        const contractCopy = JSON.parse(JSON.stringify(contractToDuplicate));

        // Remove fields that should not be duplicated
        delete contractCopy._id;
        delete contractCopy.status;
        delete contractCopy.document_id;
        delete contractCopy.document_url;
        delete contractCopy.contractNo;
        delete contractCopy.createdAt;
        delete contractCopy.updatedAt;
        delete contractCopy.__v;

        // Ensure ObjectId references are preserved as strings
        if (
          contractCopy.customer_id &&
          typeof contractCopy.customer_id === "object" &&
          contractCopy.customer_id._id
        ) {
          contractCopy.customer_id = contractCopy.customer_id._id;
        }
        if (
          contractCopy.agent_id &&
          typeof contractCopy.agent_id === "object" &&
          contractCopy.agent_id._id
        ) {
          contractCopy.agent_id = contractCopy.agent_id._id;
        }
        if (
          contractCopy.business_id &&
          typeof contractCopy.business_id === "object" &&
          contractCopy.business_id._id
        ) {
          contractCopy.business_id = contractCopy.business_id._id;
        }
        if (
          contractCopy.vendor_id &&
          typeof contractCopy.vendor_id === "object" &&
          contractCopy.vendor_id._id
        ) {
          contractCopy.vendor_id = contractCopy.vendor_id._id;
        }

        // Handle nested ObjectId references in basicInfo
        if (contractCopy.basicInfo) {
          if (
            contractCopy.basicInfo.customer_id &&
            typeof contractCopy.basicInfo.customer_id === "object" &&
            contractCopy.basicInfo.customer_id._id
          ) {
            contractCopy.basicInfo.customer_id =
              contractCopy.basicInfo.customer_id._id;
          }
          if (
            contractCopy.basicInfo.agent_id &&
            typeof contractCopy.basicInfo.agent_id === "object" &&
            contractCopy.basicInfo.agent_id._id
          ) {
            contractCopy.basicInfo.agent_id =
              contractCopy.basicInfo.agent_id._id;
          }
          if (
            contractCopy.basicInfo.vendor_id &&
            typeof contractCopy.basicInfo.vendor_id === "object" &&
            contractCopy.basicInfo.vendor_id._id
          ) {
            contractCopy.basicInfo.vendor_id =
              contractCopy.basicInfo.vendor_id._id;
          }
          if (
            contractCopy.basicInfo.business_id &&
            typeof contractCopy.basicInfo.business_id === "object" &&
            contractCopy.basicInfo.business_id._id
          ) {
            contractCopy.basicInfo.business_id =
              contractCopy.basicInfo.business_id._id;
          }

          // Add the required fields that the backend expects for proper population
          if (contractCopy.basicInfo.customer_id) {
            contractCopy.basicInfo.selectedCustomerId =
              contractCopy.basicInfo.customer_id;
          }
          if (contractCopy.basicInfo.agent_id) {
            contractCopy.basicInfo.selectedAgentId =
              contractCopy.basicInfo.agent_id;
          }
          if (
            contractCopy.basicInfo.selectedVendorId &&
            typeof contractCopy.basicInfo.selectedVendorId === "object" &&
            contractCopy.basicInfo.selectedVendorId._id
          ) {
            contractCopy.basicInfo.selectedVendorId =
              contractCopy.basicInfo.selectedVendorId._id;
          }

          // Handle bank account ID - this is crucial for Account_Info
          if (
            contractCopy.basicInfo.selectedBankId &&
            typeof contractCopy.basicInfo.selectedBankId === "object" &&
            contractCopy.basicInfo.selectedBankId._id
          ) {
            contractCopy.basicInfo.selectedBankId =
              contractCopy.basicInfo.selectedBankId._id;
          } else if (
            contractCopy.basicInfo.bankAccount &&
            typeof contractCopy.basicInfo.bankAccount === "object" &&
            contractCopy.basicInfo.bankAccount._id
          ) {
            // Fallback: if selectedBankId doesn't exist, try bankAccount
            contractCopy.basicInfo.selectedBankId =
              contractCopy.basicInfo.bankAccount._id;
          }

          // Also preserve the bank account information if it exists
          if (
            contractCopy.basicInfo.bankAccount &&
            typeof contractCopy.basicInfo.bankAccount === "object" &&
            contractCopy.basicInfo.bankAccount._id
          ) {
            contractCopy.basicInfo.bankAccount =
              contractCopy.basicInfo.bankAccount._id;
          }
        }

        // Ensure business field is properly set
        if (
          contractCopy.business &&
          typeof contractCopy.business === "object" &&
          contractCopy.business._id
        ) {
          contractCopy.business = contractCopy.business._id;
        }

        // Set new status and contract number
        contractCopy.status = "Draft";
        contractCopy.contractNo = contractNumberGenerate(10, "K");
        
        // Set Contract Creation Date to current date (new contract is being created now)
        const getCurrentDate = () => {
          const today = new Date();
          const year = today.getFullYear();
          const month = String(today.getMonth() + 1).padStart(2, "0");
          const day = String(today.getDate()).padStart(2, "0");
          return `${year}-${month}-${day}`;
        };
        
        // Update contractCreationDate in basicInfo to current date
        if (contractCopy.basicInfo) {
          contractCopy.basicInfo.contractCreationDate = getCurrentDate();
        }

        // Debug: Log the payload being sent
        console.log(
          "🔍 Duplicating contract with payload:",
          JSON.stringify(contractCopy, null, 2)
        );

        // API: POST /sales-contracts
        await request.post("/sales-contracts", contractCopy);
        notifySuccess("Contract duplicated as draft!");
        setIsDuplicateModalOpen(false);
        setContractToDuplicate(null);
        window.location.reload();
        success = true;
      } catch (error) {
        lastError = error;
        // Check for duplicate key error
        if (
          error?.response?.data?.error?.includes("duplicate key") ||
          (error?.response?.data &&
            typeof error.response.data === "string" &&
            error.response.data.includes("duplicate key"))
        ) {
          attempts++;
          continue;
        } else {
          notifyError("Failed to duplicate contract");
          setIsDuplicateModalOpen(false);
          setContractToDuplicate(null);
          setLoading(false);
          return;
        }
      }
    }
    if (!success) {
      notifyError(
        "Failed to duplicate contract after multiple attempts. Please try again."
      );
      setIsDuplicateModalOpen(false);
      setContractToDuplicate(null);
      setLoading(false);
    }
  };

  // Prepare summary cards data
  const summaryCardsData = [
    {
      title: t("sales.totalContracts"),
      value: salesContractStats.totalContracts,
      isHighlighted: true,
    },
    { title: t("sales.openContracts"), value: salesContractStats.totalOpenContracts },
    {
      title: t("sales.cancelledContracts"),
      value: salesContractStats.totalCancelledContracts,
    },
    {
      title: t("sales.completedContracts"),
      value: salesContractStats.totalCompletedContracts,
    },
  ];

  // Translate table headers
  const headerSalesTranslated = headerSales.map((header) => {
    const headerMap = {
      "Contract No": t("common.contractNo"),
      "Customer": t("common.customer"),
      "Quantity": t("common.quantity"),
      "Price Per Metric Ton": t("sales.pricePerMetricTon"),
      "Total Price": t("sales.totalPrice"),
      "Contract Date (Agreed)": t("sales.contractDateAgreed"),
      "Created Date": t("sales.createdDate"),
      "Business": t("Business"),
      "Item Name": t("sales.itemName"),
      "Agent Name": t("sales.agentName"),
      "Vendor Name": t("sales.vendorName"),
      "Grade": t("item.grade"),
      "Quantity (MTS)": t("sales.quantityMTS"),
      "Container Type": t("item.containerType"),
      "Packing": t("item.packing"),
      "Total Value": t("sales.totalValue"),
      "Status": t("Status"),
      "Action": t("common.action"),
    };
    return headerMap[header] || header;
  });
  
  const headersToHideTranslated = headersToHide.map((header) => {
    const headerMap = {
      "Created Date": t("sales.createdDate"),
      "Item Name": t("sales.itemName"),
      "Agent Name": t("sales.agentName"),
      "Vendor Name": t("sales.vendorName"),
      "Quantity (MTS)": t("sales.quantityMTS"),
      "Container Type": t("item.containerType"),
      "Packing": t("item.packing"),
      "Total Value": t("sales.totalValue"),
    };
    return headerMap[header] || header;
  });

  // Prepare filters for the filter bar
  const transformedBusinesses = businesses.map((business) => ({
    value: business._id,
    label: business.name,
  }));

  const transformedCustomers = customers.map((customer) => ({
    value: customer._id,
    label:
      customer?.basicInformation?.companyName ||
      customer?.basicInformation?.buyerCompanyName ||
      customer.basicInformation?.customerDisplayName ||
      customer.companyName ||
      "Unknown Customer",
  }));
  const transformedItems = items.map((item) => ({
    value: item._id,
    label: `${item.name} (${item.grade}) ${item.packing} ${item.remarks} `, // adapt field name to your item schema
  }));

  // Purchase filter options
  const purchaseFilterOptions = [
    { value: "", label: t("sales.allContracts") },
    { value: "without_purchase", label: t("sales.withoutPurchase") },
    { value: "with_purchase", label: t("sales.withPurchase") },
  ];

  // Internal Sales filter options
  const internalSalesFilterOptions = [
    { value: "", label: t("sales.externalSales") },
    { value: "internal", label: t("sales.internalSales") },
  ];

  const filters = [
    {
      isClearButton: true,
      buttonProps: {
        onClick: () => {
          clearAllFilters();
          setCurrentPage(1); // ✅ reset on clear
        },
      },
    },
    {
      isBusinessDropdown: true,
      businessDropdownProps: {
        adminId: adminInfo.id,
        selectedBusiness,
        onChange: (value) => {
          setSelectedBusiness(value);
          setCurrentPage(1); // ✅ reset on business change
        },
      },
    },
    {
      value: selectedStatus,
      onChange: (value) => {
        setSelectedStatus(value);
        setCurrentPage(1); // ✅ reset
      },
      placeholder: t("sales.filterByStatus"),
      options: statusOptions,
    },
    {
      value: selectedCustomer,
      onChange: (value) => {
        setSelectedCustomer(value);
        setCurrentPage(1); // ✅ reset
      },
      placeholder: t("sales.filterByCustomer"),
      options: [{ value: "", label: t("sales.allCustomers") }, ...transformedCustomers],
    },
    {
      isDatePicker: true,
      value: selectedContractDate,
      onChange: (value) => {
        setSelectedContractDate(value);
        setCurrentPage(1); // ✅ reset
      },
      placeholder: t("sales.filterByContractCreationDate"),
    },
    // {
    //   value: selectedType,
    //   onChange: (value) => {
    //     setSelectedType(value);
    //     setCurrentPage(1); // ✅ reset on item change
    //   },
    //   placeholder: "Filter by Type",
    //   options: [
    //     { value: "", label: "All Types" },
    //     { value: "Nominal", label: "Nominal" },
    //     { value: "Confirmed", label: "Confirmed" },
    //     { value: "Profit Sharing", label: "Profit Sharing" }
    //   ],
    // },
    {
      value: selectedItem,
      onChange: (value) => {
        setSelectedItem(value);
        setCurrentPage(1); // ✅ reset on item change
      },
      placeholder: t("sales.filterByItem"),
      options: [{ value: "", label: t("sales.allItems") }, ...transformedItems],
    },
    {
      value: selectedPurchaseFilter,
      onChange: (value) => {
        setSelectedPurchaseFilter(value);
        setCurrentPage(1); // ✅ reset on filter change
      },
      placeholder: t("sales.filterByPurchaseStatus"),
      options: purchaseFilterOptions,
    },
    {
      value: selectedInternalSalesFilter,
      onChange: (value) => {
        setSelectedInternalSalesFilter(value);
        setCurrentPage(1); // ✅ reset on filter change
      },
      placeholder: t("sales.salesType"),
      options: internalSalesFilterOptions,
    },
  ];

  return (
    <div className="p-6 bg-white min-h-screen">
      {/* Page Header */}
      <div className="relative">
        <PageHeader
          title={t("sales.contracts")}
          subtitle={
            !selectedBusiness ? t("sales.showingContractsFromAllBusinesses") : ""
          }
          onAddNew={() =>
            history.push({
              pathname: "/add-sales-contract",
              state: { clearState: true },
            })
          }
          showAddButton={hasPermission("Add")}
          addButtonText={t("sales.addSalesContract")}
          onMoreOptionsClick={handleMoreOptionsClick}
        />
        {renderMoreOptionsMenu()}
      </div>

      {/* Summary Cards */}
      <SummaryCards cards={summaryCardsData} />
      {console.log("summaryCardsData", summaryCardsData)}
      {/* Table with Filters */}
      <DataTable
        // For filters
        onSearch={setSearchTerm}
        searchValue={searchTerm}
        searchPlaceholder={t("sales.searchContracts")}
        filters={filters}
        // For table
        headers={headerSalesTranslated}
        headersToHide={headersToHideTranslated}
        totalRecords={totalCount}
        data={contracts}
        loading={loading || businessesLoading || salesContractLoading}
        currentPage={currentPage}
        totalPages={totalPages}
        recordsPerPage={recordsPerPage}
        isDynamicActionColumn={true}
        onPageChange={(page) => setCurrentPage(page)}
        onRecordsPerPageChange={(perPage) => {
          setRecordsPerPage(perPage);
          setCurrentPage(1);
        }}
        renderRow={(contract, index) => {
          const isProfitSharing =
            contract?.basicInfo?.typeOfSaleContract === "Profit Sharing";
          const requiresManagementSignature =
            contract.status === "Waiting Management Approval";

          return (
            <tr
              key={contract._id || index}
              className={`border-b ${
                isProfitSharing
                  ? "bg-gradient-to-r from-yellow-50 to-orange-50 border-l-4 border-red-500 shadow-sm"
                  : ""
              }`}
            >
              <td className="py-2 px-4">
                <div className="flex items-center gap-2">
                  <span
                    className={
                      isProfitSharing ? "font-semibold text-red-600" : ""
                    }
                  >
                    {contract.contractNo}
                  </span>
                </div>
              </td>
              <td className="py-2 px-4">
                <span
                  className={
                    isProfitSharing ? "font-semibold text-red-600" : ""
                  }
                >
                  {contract?.basicInfo?.buyerCompanyName}
                </span>
              </td>
              <td className="py-2 px-4">
                <span
                  className={
                    isProfitSharing ? "font-semibold text-red-600" : ""
                  }
                >
                  {formatQuantity(
                    contract?.productInfo?.[0]?.quantityMTS *
                      contract?.productInfo?.[0]?.quantityFCL
                  ) || "N/A"}
                </span>
              </td>
              <td className="py-2 px-4">
                <span
                  className={
                    isProfitSharing ? "font-semibold text-red-600" : ""
                  }
                >
                  {formatAmount(contract?.productInfo?.[0]?.price)}
                </span>
              </td>
              <td className="py-2 px-4">
                <span
                  className={
                    isProfitSharing ? "font-semibold text-red-600" : ""
                  }
                >
                  {formatAmount(contract?.productInfo?.[0]?.totalValue)}
                </span>
              </td>
              <td className="py-2 px-4">
                {contract?.basicInfo?.contractDate ? (
                  <span
                    className={
                      isProfitSharing ? "font-semibold text-red-600" : ""
                    }
                  >
                    {`${formatDate(contract.basicInfo.contractDate)}`}
                  </span>
                ) : (
                  <span className="text-red-600">
                    {`${formatDate(contract?.createdAt)} ${formatTime(
                      contract?.createdAt
                    )}`}
                  </span>
                )}
              </td>
              <td className="py-2 px-4">
                {contract?.basicInfo?.contractCreationDate ? (
                  <span
                    className={
                      isProfitSharing ? "font-semibold text-red-600" : ""
                    }
                  >
                    {`${formatDate(contract.basicInfo.contractCreationDate)}`}
                  </span>
                ) : (
                  <span className="text-red-600">
                    {`${formatDate(contract?.createdAt)} ${formatTime(
                      contract?.createdAt
                    )}`}
                  </span>
                )}
              </td>
              <td className="py-2 px-4">
                <span
                  className={
                    isProfitSharing ? "font-semibold text-red-600" : ""
                  }
                >
                  {`${contract?.business?.name}`}
                </span>
              </td>

              {/* 8 Item Name */}
              <td className="py-2 px-4">
                {`${contract?.productInfo?.[0]?.title} (${contract?.productInfo?.[0]?.grade}) ${contract?.productInfo?.[0]?.packing} ${contract?.productInfo?.[0]?.remarks} ` ||
                  "N/A"}
              </td>
              {/* 9 Agent Name */}
              <td className="py-2 px-4">
                {contract?.basicInfo?.agentName || contract?.agentName || "N/A"}
              </td>
              {/* 10 = Vendor Name */}
              <td className="py-2 px-4">
                {contract?.basicInformation?.vendorDisplayName ||
                  contract?.basicInformation?.companyName ||
                  contract?.basicInfo?.selectedVendorId?.basicInformation
                    ?.vendorDisplayName ||
                  "N/A"}
              </td>
              {/* 11 Grade */}
              <td className="py-2 px-4">
                <span
                  className={
                    isProfitSharing ? "font-semibold text-red-600" : ""
                  }
                >
                  {contract?.productInfo?.[0]?.grade ||
                    contract?.grade ||
                    "N/A"}
                </span>
              </td>
              {/* Quantity (MTS) */}
              <td className="py-2 px-4">
                {formatQuantity(contract?.productInfo?.[0]?.quantityMTS) ||
                  formatQuantity(contract?.quantityMTS) ||
                  "N/A"}
              </td>
              {/* 13 Container Type */}
              <td className="py-2 px-4">
                {contract?.productInfo?.[0]?.container_type ||
                  contract?.containerType ||
                  "N/A"}
              </td>
              {/* 14 Packing */}
              <td className="py-2 px-4">
                {contract?.productInfo?.[0]?.packing ||
                  contract?.packing ||
                  "N/A"}
              </td>
              {/* 15 Total Value */}
              <td className="py-2 px-4">
                {formatAmount(contract?.productInfo?.[0]?.totalValue) ||
                  formatAmount(contract?.totalValue) ||
                  "N/A"}
              </td>

              <td
                className={`py-2 px-4 font-medium capitalize ${
                  isProfitSharing
                    ? "text-orange-700 font-bold"
                    : statusColors[contract.status] || ""
                }`}
              >
                {contract.status}
              </td>
              <ActionButtons
                isCell={true}
                items={[
                  {
                    action: ACTION_BUTTON_TYPES.VIEW,
                    tooltip: t("salesContract.actions.viewDetails", { defaultValue: "View Contract Details" }),
                    permission: hasPermission("View"),
                    onClick: () =>
                      history.push({
                        pathname: "/view-sales-contract",
                        state: { contractId: contract._id },
                      }),
                  },
                  {
                    action: ACTION_BUTTON_TYPES.DUPLICATE,
                    tooltip: t("salesContract.actions.duplicateContract", { defaultValue: "Duplicate Contract" }),
                    permission: hasPermission("Add"),
                    onClick: () => handleDuplicateClick(contract),
                  },
                  {
                    action: ACTION_BUTTON_TYPES.EDIT,
                    tooltip: t("salesContract.actions.updateDetails", { defaultValue: "Update Contract Details" }),
                    permission:
                      hasPermission("Update") &&
                      (contract.status === "Draft" ||
                        contract.status ===
                          "Amendments Requested (Management)" ||
                        contract.status === "Amendments Requested (Accounts)"),
                    onClick: () => {
                      setContractId(contract._id);
                      history.push({
                        pathname: "/update-sales-contract",
                        state: { contractId: contract._id },
                      });
                    },
                  },
                  {
                    action: ACTION_BUTTON_TYPES.REQUEST_APPROVAL,
                    permission:
                      contract.status === "Draft" ||
                      contract.status === "Amendments Requested (Management)",
                    tooltip: t("salesContract.actions.requestManagementApproval", { defaultValue: "Request Management Approval" }),
                    onClick: () => RequestApproval(contract._id),
                  },
                  {
                    action: ACTION_BUTTON_TYPES.REQUEST_APPROVAL,
                    permission:
                      contract.status === "Amendments Requested (Accounts)",
                    tooltip: t("salesContract.actions.sendToAccounts", { defaultValue: "Send to Accounts" }),
                    onClick: () => RequestApprovalToAccounts(contract._id),
                  },
                  {
                    action: ACTION_BUTTON_TYPES.CHANGE_STATUS,
                    tooltip: t("salesContract.actions.changeStatus", { defaultValue: "Change Status" }),
                    permission:
                      hasPermission("Change Status") && !requiresManagementSignature,
                    onClick: () => {
                      setChangeStatusContractId(contract._id);
                      setChangeStatusCurrent(contract.status);
                      setIsChangeStatusModalOpen(true);
                    },
                  },
                  {
                    action: ACTION_BUTTON_TYPES.APPROVE,
                    tooltip: t("salesContract.actions.approveContract", { defaultValue: "Approve Contract" }),
                    permission:
                      hasPermission("Approve Sales") &&
                      contract.status === "Waiting Management Approval",
                    onClick: () => {
                      setSelectedContractId(contract._id);
                      setIsSignatureModalOpen(true);
                    },
                  },
                  {
                    action: ACTION_BUTTON_TYPES.VIEW_PDF,
                    tooltip: t("salesContract.actions.downloadContract", { defaultValue: "Download Contract" }),
                    permission: !!contract.document_id,
                    onClick: () => HandleOpenFile(contract),
                  },
                  {
                    action: ACTION_BUTTON_TYPES.APPROVE_ACCOUNTS,
                    tooltip: t("salesContract.actions.generateDocument", { defaultValue: "Generate Contract Document" }),
                    permission:
                      hasPermission("Accounts Approve Sales") &&
                      contract.status === "Preparing Contract",
                    onClick: () => {
                      setSelectedContractId(contract._id);
                      setBusinesss_id(contract.business._id);
                      setSelectedContractNo(contract.contractNo || "document");
                      setIsModalOpen(true);
                    },
                  },
                  {
                    action: ACTION_BUTTON_TYPES.HISTORY,
                    tooltip: t("salesContract.actions.viewHistory", { defaultValue: "View Contract History" }),
                    permission: true, // Everyone can view history
                    onClick: () => {
                      setSelectedContractForHistory({
                        id: contract._id,
                        contractNo: contract.contractNo,
                      });
                      setIsHistoryModalOpen(true);
                    },
                  },
                  {
                    action: ACTION_BUTTON_TYPES.SEND_EMAIL,
                    tooltip: t("salesContract.actions.sendApprovalEmail", { defaultValue: "Send Contract Approval Email" }),
                    permission: contract.status === "Processing",
                    onClick: () => handleSendEmailClick(contract),
                  },
                ]}
              />
            </tr>
          );
        }}
      />

      {/* Show message when no business is selected and no contracts found */}
      {!selectedBusiness &&
        !loading &&
        !businessesLoading &&
        contracts.length === 0 && (
          <div className="mt-8 text-center">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-8">
              <div className="text-gray-500 text-lg mb-2">
                No contracts found
              </div>
              <div className="text-gray-400 text-sm">
                Try selecting a specific business or adjusting your search
                criteria
              </div>
            </div>
          </div>
        )}

      {isChangeStatusModalOpen && (
        <ChangeStatusModal
          onClose={() => setIsChangeStatusModalOpen(false)}
          contractId={changeStatusContractId}
          currentStatus={changeStatusCurrent}
        />
      )}

      {/* Signature Modal */}
      {isSignatureModalOpen && (
        <SignatureTab
          contractId={selectedContractId}
          onClose={() => {
            setIsSignatureModalOpen(false);
          }}
        />
      )}

      {/* Document Template Modal */}
      <DocumentTemplateModal
        isOpen={isModalOpen}
        type="sales_contract"
        onClose={() => {
          setIsModalOpen(false);
        }}
        contractId={selectedContractId}
        onSubmit={handleGenerateDocument}
      />

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

      {/* Duplicate Confirmation Modal */}
      <CustomModal
        open={isDuplicateModalOpen}
        onClose={() => setIsDuplicateModalOpen(false)}
        title={t("salesContract.duplicate.title", { defaultValue: "Duplicate Contract" })}
        actions={[
          {
            label: t("common.cancel", { defaultValue: "Cancel" }),
            secondary: true,
            onClick: () => setIsDuplicateModalOpen(false),
          },
          {
            label: loading
              ? t("salesContract.duplicate.duplicating", { defaultValue: "Duplicating..." })
              : t("salesContract.duplicate.confirm", { defaultValue: "Yes, Duplicate" }),
            primary: true,
            onClick: handleConfirmDuplicate,
            disabled: loading,
          },
        ]}
      >
        {t("salesContract.duplicate.confirmation", {
          defaultValue:
            "Are you sure you want to duplicate this contract? This will create a new contract in Draft status.",
        })}
      </CustomModal>

      {/* Contract History Modal */}
      <ContractHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => {
          setIsHistoryModalOpen(false);
          setSelectedContractForHistory(null);
        }}
        contractId={selectedContractForHistory?.id}
        contractNo={selectedContractForHistory?.contractNo}
        contractType="sales"
      />

      {/* Send Email Modal */}
      <SendEmailModal
        isOpen={isEmailModalOpen}
        onClose={() => {
          setIsEmailModalOpen(false);
          setSelectedContractForEmail(null);
          setCustomerEmailForContract("");
        }}
        contract={selectedContractForEmail}
        customerEmail={customerEmailForContract}
      />
    </div>
  );
}
