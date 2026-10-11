import React, { useState, useEffect, useContext, useRef } from "react";
import { useTranslation } from "react-i18next";
import { notifySuccess, notifyError } from "@/utils/toast";
import request from "@/services/httpService";
import SignatureTab from "./SignatureTab";
import { AdminContext } from "@/context/AdminContext";
import axios from "axios";
import useButtonColor from "@/hooks/useButtonColor";
import {
  formatAmount,
  formatDate,
  formatTime,
  formatQuantity,
} from "@/components/formatAmount";
import { usePurchaseContext } from "./context/PurchaseContractContext";
import usePurchaseContract from "./hooks/usePurchaseContract";
import { useHistory } from "react-router-dom";
import DocumentTemplateModal from "../../pages/Purchase_Contract/actions/DocumentTemplateModal.jsx";
import DocumentGenerator from "../../pages/Accounts/CustomerInvoice/purchase-document-generator.jsx";
import DocumentViewer from "../../pages/Accounts/CustomerInvoice/document-viewer.jsx";
// import DocumentComparisonViewer from "../../pages/Accounts/CustomerInvoice/document-comparison-viewer.jsx";
import ContractHistoryModal from "@/components/ContractHistoryModal";
import ChangeStatusModal from "./ChangeStatusModal";
import SendVendorEmailModal from "./SendVendorEmailModal";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";
import { CustomModal } from "@/page-layouts";
import { contractNumberGenerate } from "./hooks/useBasicInfo";

// Components
import {
  PageHeader,
  SummaryCards,
  DataTable,
  ActionButtons,
  TableRow,
  TableData,
} from "@/page-layouts";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

export const headerSales = [
  "Supplier Contract No",
  "Supplier",
  "QTY MTS",
  "Price USD/MT",
  "Total Price",
  "Contract Date",
  "Business",
  "contract No.",
  "Supplier contract Date",
  "Item Name",
  "Agent Name",
  "Vendor Name",
  "Grade",
  "Quantity (MTS)",
  "Container Type",
  "Packing",
  "Total Price",
  "Status",
  "Action",
];

export const headersToHide = [
  "Item Name",
  "Agent Name",
  "Vendor Name",
  "contract Date",
  "contract No.",
  "Quantity (MTS)",
  "Container Type",
  "Packing",
  "Total Price",
];

export default function PurchaseContract() {
  const { t } = useTranslation();
  const buttonColor = useButtonColor();
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { state } = useContext(AdminContext);
  const [selectedItem, setSelectedItem] = useState("");
  const { adminInfo } = state;
  const [selectedContractId, setSelectedContractId] = useState(null);
  const [business_id, setBusinesss_id] = useState(null);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [isComparisonViewerOpen, setIsComparisonViewerOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [documentUrl, setDocumentUrl] = useState("");
  const [selectedContractNo, setSelectedContractNo] = useState("");
  const [isChangeStatusModalOpen, setIsChangeStatusModalOpen] = useState(false);
  const [changeStatusContractId, setChangeStatusContractId] = useState(null);
  const [changeStatusCurrent, setChangeStatusCurrent] = useState("");
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState([]);
  const [requestingApprovalId, setRequestingApprovalId] = useState(null);
  const [isAddNewMenuOpen, setIsAddNewMenuOpen] = useState(false);
  const addNewMenuRef = useRef(null);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyContract, setHistoryContract] = useState(null);
  const [contractToDuplicate, setContractToDuplicate] = useState(null);
  const [isVendorEmailModalOpen, setIsVendorEmailModalOpen] = useState(false);
  const [selectedContractForVendorEmail, setSelectedContractForVendorEmail] =
    useState(null);
  const [vendorEmailForContract, setVendorEmailForContract] = useState("");
  const { businesses, setSelectedBusiness, selectedBusiness, setContractId } =
    usePurchaseContext();

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

  // Fetch vendors for filter dropdown
  useEffect(() => {
    const fetchVendors = async () => {
      setLoading(true);
      try {
        let params = {
          page: 1,
          limit: 9999, // Get all vendors for filter dropdown
        };
        if (selectedBusiness) {
          params.businessId = JSON.stringify([selectedBusiness]);
        } else if (businesses.length > 0) {
          params.businessId = JSON.stringify(
            businesses.map((business) => business._id)
          );
        }
        const response = await axios.get(`${Base_URL}/vendors/paginated`, {
          params,
        });
        console.log("Vendors fetched successfully:", response.data);
        if (response.status === 200 && response.data) {
          setVendors(response?.data.vendors || []);
        } else {
          console.error("Failed to fetch vendors");
        }
      } catch (error) {
        console.error("❌ Error fetching vendors:", error);
      } finally {
        setLoading(false);
      }
    };

    if (businesses.length > 0 || selectedBusiness) {
      fetchVendors();
    }
  }, [selectedBusiness, businesses]);

  const [businessesLoading, setBusinessesLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  // Additional filter states - matching sales contract pattern
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedVendor, setSelectedVendor] = useState("");
  const [selectedContractDate, setSelectedContractDate] = useState("");
  const [selectedSalesFilter, setSelectedSalesFilter] = useState("");
  const [selectedInternalPurchaseFilter, setSelectedInternalPurchaseFilter] =
    useState("");

  // Filter states - simplified to match sales pattern
  const [filters, setFilters] = useState({
    status: selectedStatus,
    vendorId: selectedVendor,
    startDate: "",
    endDate: "",
    search: searchTerm,
    contractDate: "",
    itemId: selectedItem,
    salesFilter: selectedSalesFilter,
    internalPurchaseFilter: selectedInternalPurchaseFilter,
  });

  const {
    contracts,
    salesContractStats,
    totalPages,
    filterOptions,
    Vendors,
    loading: purchaseContractLoading,
  } = usePurchaseContract(
    selectedBusiness,
    currentPage,
    recordsPerPage,
    filters
  );
  const history = useHistory();

  const statusColors = {
    Draft: "text-lime-500",
    "Waiting Management Approval": "text-blue-500",
    "Pending Management Review": "text-blue-600",
    "Pending Accounts Review": "text-purple-600",
    "Amendments Requested (Management)": "text-yellow-600",
    "Rejected (Management)": "text-red-600",
    "Preparing Contract": "text-orange-500",
    "Waiting Vendor Approval": "text-yellow-500",
    Pending: "text-purple-500",
    Processing: "text-indigo-500",
    "On-hold": "text-gray-500",
    Cancelled: "text-red-500",
    Completed: "text-green-500",
  };

  // Status options for filter - matching sales contract pattern
  const statusOptions = [
    { value: "", label: t("common.allStatuses") },
    { value: "Draft", label: "Draft" },
    {
      value: "Waiting Management Approval",
      label: "Waiting Management Approval",
    },
    { value: "Pending Management Review", label: "Pending Management Review" },
    { value: "Pending Accounts Review", label: "Pending Accounts Review" },
    {
      value: "Amendments Requested (Management)",
      label: "Amendments Requested (Management)",
    },
    { value: "Rejected (Management)", label: "Rejected (Management)" },
    { value: "Preparing Contract", label: "Preparing Contract" },
    { value: "Waiting Vendor Approval", label: "Waiting Vendor Approval" },
    { value: "Pending", label: "Pending" },
    { value: "Processing", label: "Processing" },
    { value: "On-hold", label: "On-hold" },
    { value: "Cancelled", label: "Cancelled" },
    { value: "Completed", label: "Completed" },
  ];

  const [pagePermissions, setPagePermissions] = useState([]);

  // Handle date change with proper formatting
  const handleDateChange = (date) => {
    console.log("Contract Date selected:", date);
    setSelectedContractDate(date);

    // If you want to filter by the entire day
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      setFilters((prev) => ({
        ...prev,
        startDate: startOfDay.toISOString(),
        endDate: endOfDay.toISOString(),
        contractDate: date,
      }));
    } else {
      setFilters((prev) => ({
        ...prev,
        startDate: "",
        endDate: "",
        contractDate: "",
      }));
    }
  };

  // Update filters when individual filter states change
  useEffect(() => {
    // Handle date filtering - convert single date to start/end range
    let startDate = "";
    let endDate = "";

    if (selectedContractDate) {
      // If it's a single date, use it as both start and end
      const dateObj = new Date(selectedContractDate);
      const startOfDay = new Date(dateObj);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(dateObj);
      endOfDay.setHours(23, 59, 59, 999);

      startDate = startOfDay.toISOString();
      endDate = endOfDay.toISOString();
    }

    setFilters((prev) => ({
      ...prev,
      status: selectedStatus,
      vendorId: selectedVendor,
      search: searchTerm,
      startDate: startDate,
      endDate: endDate,
      contractDate: selectedContractDate,
      itemId: selectedItem,
      salesFilter: selectedSalesFilter,
      internalPurchaseFilter: selectedInternalPurchaseFilter,
    }));
  }, [
    selectedStatus,
    selectedVendor,
    searchTerm,
    selectedContractDate,
    selectedItem,
    selectedSalesFilter,
    selectedInternalPurchaseFilter,
  ]);

  // Add debugging to see what filters are being sent
  useEffect(() => {
    console.log("Filters updated:", filters);
  }, [filters]);

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

  const handleGenerateDocument = async (payload) => {
    console.log("Generating document:", payload);
    setSelectedTemplateId(payload.templateId);
    setSelectedTemplate(payload.template);
    setSelectedContractId(payload.contractId);
    // Open unified generator dialog
    setIsGeneratorOpen(true);
  };

  const handleProceedToGenerate = () => {
    setIsComparisonViewerOpen(false);
    setIsGeneratorOpen(true);
  };

  const handleGenerationSuccess = () => {
    notifySuccess("Accounts Approve Contract, process further!", () => {
      window.location.reload();
      setLoading(false);
    });
  };

  // Send updated contract back to Accounts after Accounts requested amendments
  const RequestApprovalToAccounts = async (_id) => {
    try {
      await request.put(`/purchase-contracts/status/${_id}`, {
        is_accounts: true,
        status: "Preparing Contract",
      });
      notifySuccess("Sent to Accounts for review", () => {
        window.location.reload();
      });
    } catch (error) {
      notifyError("Failed to send to Accounts");
      console.log("Error : ", error);
    }
  };

  const RequestApproval = async (_id) => {
    console.log("status", _id);
    setRequestingApprovalId(_id);
    try {
      const data = {
        status: "Waiting Management Approval",
      };

      await request.put(`/purchase-contracts/status/${_id}`, data);
      notifySuccess(
        "Purchase Contract Sends to Management Successfully",
        () => {
          setRequestingApprovalId(null);
          window.location.reload();
        }
      );
    } catch (error) {
      setRequestingApprovalId(null);
      notifyError(
        _id
          ? "Error updating contract"
          : "Error saving Purchase Contract Basic Info"
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

  // Translate table headers
  const headerSalesTranslated = headerSales.map((header) => {
    const headerMap = {
      "Supplier Contract No": t("purchase.supplierContractNo"),
      "Supplier": t("purchase.supplier"),
      "QTY MTS": t("purchase.qtyMTS"),
      "Price USD/MT": t("purchase.priceUSDMT"),
      "Total Price": t("purchase.totalPrice"),
      "Contract Date": t("purchase.contractDate"),
      "Business": t("Business"),
      "contract No.": t("purchase.contractNo"),
      "Supplier contract Date": t("purchase.supplierContractDate"),
      "Item Name": t("purchase.itemName"),
      "Agent Name": t("purchase.agentName"),
      "Vendor Name": t("purchase.vendorName"),
      "Grade": t("purchase.grade"),
      "Quantity (MTS)": t("purchase.quantityMTS"),
      "Container Type": t("purchase.containerType"),
      "Packing": t("purchase.packing"),
      "Status": t("Status"),
      "Action": t("common.action"),
    };
    return headerMap[header] || header;
  });
  
  const headersToHideTranslated = headersToHide.map((header) => {
    const headerMap = {
      "Item Name": t("purchase.itemName"),
      "Agent Name": t("purchase.agentName"),
      "Vendor Name": t("purchase.vendorName"),
      "contract Date": t("purchase.contractDate"),
      "contract No.": t("purchase.contractNo"),
      "Quantity (MTS)": t("purchase.quantityMTS"),
      "Container Type": t("purchase.containerType"),
      "Packing": t("purchase.packing"),
      "Total Price": t("purchase.totalPrice"),
    };
    return headerMap[header] || header;
  });

  // Prepare summary cards data
  const summaryCardsData = [
    {
      title: t("purchase.totalContracts"),
      value: salesContractStats.totalContracts,
      isHighlighted: true,
    },
    { title: t("purchase.openContracts"), value: salesContractStats.totalOpenContracts },
    {
      title: t("purchase.cancelledContracts"),
      value: salesContractStats.totalCancelledContracts,
    },
    {
      title: t("purchase.completedContracts"),
      value: salesContractStats.totalCompletedContracts,
    },
  ];

  // Prepare filters for the filter bar
  const transformedBusinesses = businesses.map((business) => ({
    value: business._id,
    label: business.name,
  }));

  const transformedVendors =
    vendors?.map((vendor) => ({
      value: vendor._id,
      label: vendor?.basicInformation?.vendorDisplayName,
    })) || [];
  const clearAllFilters = () => {
    setSelectedStatus("");
    setSelectedVendor("");
    handleDateChange("");
    setSelectedContractDate("");
    setSelectedBusiness("");
    setSearchTerm("");
    setSelectedVendor("");
    setSelectedItem("");
    setSelectedSalesFilter("");
    setSelectedInternalPurchaseFilter("");
    setCurrentPage(1);
  };
  const transformedItems = items.map((item) => ({
    value: item._id,
    label: `${item.name} (${item.grade}) ${item.packing} ${item.remarks} `, // adapt field name to your item schema
  }));

  // Sales filter options
  const salesFilterOptions = [
    { value: "", label: t("purchase.allContracts") },
    { value: "without_sales", label: t("purchase.withoutSales") },
    { value: "with_sales", label: t("purchase.withSales") },
  ];

  // Internal Purchase filter options
  const internalPurchaseFilterOptions = [
    { value: "", label: t("purchase.externalPurchase") },
    { value: "internal", label: t("purchase.internalPurchase") },
  ];

  const filtersList = [
    {
      isClearButton: true,
      buttonProps: {
        onClick: clearAllFilters,
      },
    },
    {
      isBusinessDropdown: true,
      businessDropdownProps: {
        adminId: adminInfo.id,
        selectedBusiness,
        onChange: (value) => {
          setSelectedBusiness(value);
          setCurrentPage(1); // ✅ Reset page
        },
      },
    },
    {
      value: selectedStatus,
      onChange: (value) => {
        setSelectedStatus(value);
        setCurrentPage(1); // ✅ Reset page
      },
      placeholder: t("purchase.filterByStatus"),
      options: statusOptions,
    },
    {
      value: selectedVendor,
      onChange: (value) => {
        setSelectedVendor(value);
        setCurrentPage(1); // ✅ Reset page
      },
      placeholder: t("purchase.filterBySupplier"),
      options: [{ value: "", label: t("purchase.allVendors") }, ...transformedVendors],
    },
    {
      isDatePicker: true,
      value: selectedContractDate,
      onChange: (value) => {
        handleDateChange(value);
        setCurrentPage(1); // ✅ Reset page
      },
      placeholder: t("purchase.filterByContractDate"),
    },
    {
      value: selectedItem,
      onChange: (value) => {
        setSelectedItem(value);
        setCurrentPage(1); // ✅ Reset page
      },
      placeholder: t("purchase.filterByItem"),
      options: [{ value: "", label: t("purchase.allItems") }, ...transformedItems],
    },
    {
      value: selectedSalesFilter,
      onChange: (value) => {
        setSelectedSalesFilter(value);
        setCurrentPage(1); // ✅ Reset page
      },
      placeholder: t("purchase.filterBySalesStatus"),
      options: salesFilterOptions,
    },
    {
      value: selectedInternalPurchaseFilter,
      onChange: (value) => {
        setSelectedInternalPurchaseFilter(value);
        setCurrentPage(1); // ✅ Reset page
      },
      placeholder: t("purchase.purchaseType"),
      options: internalPurchaseFilterOptions,
    },
  ];

  // Handle click outside for Add New menu
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        addNewMenuRef.current &&
        !addNewMenuRef.current.contains(event.target)
      ) {
        setIsAddNewMenuOpen(false);
      }
    }
    if (isAddNewMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isAddNewMenuOpen]);

  const [emailSendingId, setEmailSendingId] = useState(null);
  const [sendEmailModal, setSendEmailModal] = useState({
    open: false,
    contract: null,
  });
  const [selectedEmails, setSelectedEmails] = useState([]);
  const [availableEmails, setAvailableEmails] = useState([]);
  const [emailInput, setEmailInput] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [ccEmailError, setCcEmailError] = useState("");

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showDropdown && !e.target.closest(".email-dropdown-container")) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showDropdown]);

  const handleDuplicateClick = (contract) => {
    setContractToDuplicate(contract);
    setIsDuplicateModalOpen(true);
  };

  const handleSendVendorEmailClick = async (contract) => {
    console.log("📧 Opening vendor email modal for contract:", contract);
    setSelectedContractForVendorEmail(contract);

    // Try to get vendor email from contract
    let vendorEmail = "";

    // Try different paths to find vendor email
    if (contract?.basicInfo?.selectedVendorId?.basicInformation?.email) {
      vendorEmail = contract.basicInfo.selectedVendorId.basicInformation.email;
    } else if (contract?.vendor_id?.basicInformation?.email) {
      vendorEmail = contract.vendor_id.basicInformation.email;
    } else if (contract?.basicInfo?.selectedVendorId) {
      // If we have vendor ID but not populated, we might need to fetch it
      try {
        const response = await axios.get(
          `${Base_URL}/vendors/${contract.basicInfo.selectedVendorId}`
        );
        if (response.data?.basicInformation?.email) {
          vendorEmail = response.data.basicInformation.email;
        }
      } catch (error) {
        console.log("Could not fetch vendor email:", error);
      }
    }

    setVendorEmailForContract(vendorEmail);
    setIsVendorEmailModalOpen(true);
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
        // Prepare payload: copy contract, set status to Draft, remove _id and document fields
        const { _id, status, document_id, document_url, contractNo, ...rest } =
          contractToDuplicate;
        const payload = {
          ...rest,
          status: "Draft",
          contractNo: contractNumberGenerate(10, "K"),
        };
        // API: POST /purchase-contracts
        await request.post("/purchase-contracts", payload);
        notifySuccess("Purchase contract duplicated as draft!");
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
          notifyError("Failed to duplicate purchase contract");
          setIsDuplicateModalOpen(false);
          setContractToDuplicate(null);
          setLoading(false);
          return;
        }
      }
    }
    if (!success) {
      notifyError(
        "Failed to duplicate purchase contract after multiple attempts. Please try again."
      );
      setIsDuplicateModalOpen(false);
      setContractToDuplicate(null);
      setLoading(false);
    }
  };

  const openManualSendEmailModal = (contract) => {
    // Get vendor email and key contact emails
    const vendor = contract?.basicInfo?.selectedVendorId;
    const vendorEmail = vendor?.basicInformation?.vendorEmail;
    const keyContacts = vendor?.keyContacts || [];

    // Build available emails list with labels
    const available = [];
    if (vendorEmail && vendorEmail.trim() !== "") {
      available.push({
        email: vendorEmail,
        label: `${
          vendor?.basicInformation?.vendorDisplayName || "Vendor"
        } (Primary)`,
        type: "vendor",
      });
    }

    keyContacts.forEach((contact, idx) => {
      if (contact.email && contact.email.trim() !== "") {
        available.push({
          email: contact.email,
          label: `${contact.name || `Contact ${idx + 1}`} - ${
            contact.designation || ""
          }`,
          type: "contact",
        });
      }
    });

    setAvailableEmails(available);
    // Don't pre-select emails - let user select manually
    setSelectedEmails([]);
    setEmailInput("");
    setCcEmailError("");
    setSendEmailModal({ open: true, contract });
  };

  const closeManualSendEmailModal = () => {
    setSendEmailModal({ open: false, contract: null });
    setSelectedEmails([]);
    setEmailInput("");
    setShowDropdown(false);
    setCcEmailError("");
  };

  const handleRemoveEmail = (emailToRemove) => {
    setSelectedEmails((emails) => emails.filter((e) => e !== emailToRemove));
  };

  const handleSelectEmail = (email) => {
    if (!selectedEmails.includes(email)) {
      setSelectedEmails([...selectedEmails, email]);
    }
    setEmailInput("");
    setShowDropdown(false);
  };

  const handleAddCustomEmail = () => {
    const trimmedEmail = emailInput.trim();
    if (!trimmedEmail) return;

    // Validate email format
    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setCcEmailError("Invalid email format");
      return;
    }

    // Check if already selected
    if (selectedEmails.includes(trimmedEmail)) {
      setCcEmailError("Email already added");
      return;
    }

    setSelectedEmails([...selectedEmails, trimmedEmail]);
    setEmailInput("");
    setCcEmailError("");
    setShowDropdown(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddCustomEmail();
    }
  };

  const handleManualSendVendorEmail = async () => {
    if (!sendEmailModal.contract) return;

    if (selectedEmails.length === 0) {
      setCcEmailError("Please select at least one email");
      return;
    }

    // Validate all selected emails
    const invalid = selectedEmails.find((e) => !/^\S+@\S+\.\S+$/.test(e));
    if (invalid) {
      setCcEmailError(`Invalid email: ${invalid}`);
      return;
    }

    try {
      setEmailSendingId(sendEmailModal.contract._id);
      // Fetch freshest contract details to ensure we have document info
      const res = await axios.get(
        `${Base_URL}/purchase-contracts/${sendEmailModal.contract._id}`
      );
      const fresh = res.data;

      const templateId =
        fresh?.template_id || fresh?.templateId || fresh?.template?.id;
      const documentUrl = fresh?.document_url;
      const documentId = fresh?.document_id;
      const signature = fresh?.accounts_signature || "";

      if (!templateId || !documentId || !documentUrl) {
        notifyError("Contract document is not ready yet.");
        return;
      }

      await axios.put(
        `${Base_URL}/purchase-contracts/SendVendorEmail/${sendEmailModal.contract._id}`,
        {
          template_id: templateId,
          document_url: documentUrl,
          document_id: documentId,
          signature: signature,
          ccEmails: selectedEmails,
        }
      );

      notifySuccess("Email sent to vendor for approval.");
      closeManualSendEmailModal();
    } catch (err) {
      console.error(err);
      notifyError("Failed to send email to vendor.");
    } finally {
      setEmailSendingId(null);
    }
  };

  const handleCreateTwoLevelContract = (contract) => {
    // Navigate to two-level contract form with base purchase data
    history.push({
      pathname: "/add-two-level-purchase-contract",
      state: {
        basePurchaseData: contract,
        isFromExistingContract: true,
      },
    });
  };

  return (
    <div className="p-6 bg-white min-h-screen">
      {/* Page Header */}
      <div className="relative">
        <PageHeader
          title={t("purchase.title")}
          subtitle={
            !selectedBusiness ? t("purchase.showingContractsFromAllBusinesses") : ""
          }
          onAddNew={() => setIsAddNewMenuOpen((prev) => !prev)}
          showAddButton={hasPermission("Add")}
          onMoreOptionsClick={handleMoreOptionsClick}
        />
        {/* Add New Dropdown Popup */}
        {isAddNewMenuOpen && (
          <div
            ref={addNewMenuRef}
            className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg z-20 border border-gray-100 animate-fade-in"
            style={{ top: 56 }}
          >
            <button
              className="block w-full text-left px-5 py-3 text-base text-gray-800 hover:bg-gray-100 rounded-t-xl font-medium"
              onClick={() => {
                setIsAddNewMenuOpen(false);
                history.push({
                  pathname: "/add-purchase-contract",
                  state: { clearState: true },
                });
              }}
            >
              {t("purchase.newPurchaseContract")}
            </button>
            <button
              className="block w-full text-left px-5 py-3 text-base text-gray-800 hover:bg-gray-100 rounded-b-xl font-medium border-t border-gray-200"
              onClick={() => {
                setIsAddNewMenuOpen(false);
                history.push({
                  pathname: "/add-two-level-purchase-contract",
                  state: { clearState: true },
                });
              }}
            >
              {t("purchase.twoLevelPurchaseSaleContract")}
            </button>
          </div>
        )}
        {renderMoreOptionsMenu()}
      </div>

      {/* Summary Cards */}
      <SummaryCards cards={summaryCardsData} />

      {/* Filters & Search */}
      <div className="bg-[#F9F9FA] rounded-xl">
        {/* Table */}
        <DataTable
          //for filters
          title={t("purchase.allContracts")}
          onSearch={setSearchTerm}
          searchValue={searchTerm}
          searchPlaceholder={t("purchase.searchContracts")}
          filters={filtersList}
          //for table
          headers={headerSalesTranslated}
          headersToHide={headersToHideTranslated}
          data={contracts}
          loading={purchaseContractLoading}
          currentPage={currentPage}
          totalRecords={salesContractStats.totalContracts}
          totalPages={totalPages}
          recordsPerPage={recordsPerPage}
          isDynamicActionColumn={true}
          onPageChange={(page) => setCurrentPage(page)}
          onRecordsPerPageChange={(perPage) => {
            setRecordsPerPage(perPage);
            setCurrentPage(1);
          }}
          renderRow={(contract, index) => {
            const requiresManagementSignature =
              contract.status === "Waiting Management Approval";
            return (
              <TableRow key={contract._id || index} className="border-b">
                {/* 1 Contract No */}
                {contract.basicInfo.supplierContractNo ? (
                  <TableData className="py-2 px-4">
                    {contract.basicInfo.supplierContractNo}
                  </TableData>
                ) : (
                  <TableData className="py-2 px-4 text-red-600">
                    {contract.contractNo}
                  </TableData>
                )}
                {/* 2 Seller Name */}
                <TableData className="py-2 px-4">
                  {contract?.basicInfo?.selectedVendorId?.basicInformation
                    ?.vendorDisplayName ||
                    contract?.basicInformation?.vendorDisplayName ||
                    contract?.basicInformation?.companyName ||
                    "N/A"}
                </TableData>
                {/* 3 Quantity */}
                <TableData className="py-2 px-4">
                  {formatQuantity(
                    contract?.productInfo?.[0]?.quantityMTS *
                      contract?.productInfo?.[0]?.quantityFCL
                  ) ||
                    formatQuantity(contract?.quantityMTS) ||
                    "N/A"}
                </TableData>
                {/* 4 Per Metric Ton */}
                <TableData className="py-2 px-4">
                  {formatAmount(contract?.productInfo?.[0]?.price) ||
                    formatAmount(contract?.price) ||
                    "N/A"}
                </TableData>
                {/* 5 Price */}
                <TableData className="py-2 px-4">
                  {formatAmount(contract?.productInfo?.[0]?.totalValue) ||
                    formatAmount(contract?.totalValue) ||
                    "N/A"}
                </TableData>
                {/* 6 Contract Date */}
                <TableData className="py-2 px-4">
                  {contract?.basicInfo?.contractDate ? (
                    <span>{formatDate(contract.basicInfo.contractDate)}</span>
                  ) : contract?.basicInfo?.supplierContractDate ? (
                    <span>
                      {formatDate(contract.basicInfo.supplierContractDate)}
                    </span>
                  ) : contract?.createdAt ? (
                    <span className="text-red-600">
                      {formatDate(contract.createdAt)}
                    </span>
                  ) : (
                    ""
                  )}
                </TableData>
                {/* 7 Business */}
                <TableData className="py-2 px-4">
                  {contract?.business?.name || "N/A"}
                </TableData>

                {/* 8 Supplier contract No. */}
                <TableData className="py-2 px-4">
                  {contract?.contractNo || "N/A"}
                </TableData>
                {/* 9 Supplier contract Date */}
                <TableData className="py-2 px-4">
                  {formatDate(contract?.basicInfo?.supplierContractDate)}
                </TableData>

                {/* 8 Item Name */}
                <TableData className="py-2 px-4">
                  {`${contract?.productInfo?.[0]?.item?.name} (${contract?.productInfo?.[0]?.item?.grade}) ${contract?.productInfo?.[0]?.item?.packing} ${contract?.productInfo?.[0]?.item?.remarks} ` ||
                    "N/A"}
                </TableData>
                {/* 9 Agent Name */}
                <TableData className="py-2 px-4">
                  {contract?.basicInfo?.agentName ||
                    contract?.agentName ||
                    "N/A"}
                </TableData>
                {/* 10 = Vendor Name */}
                <TableData className="py-2 px-4">
                  {contract?.basicInformation?.vendorDisplayName ||
                    contract?.basicInformation?.companyName ||
                    contract?.basicInfo?.selectedVendorId?.basicInformation
                      ?.vendorDisplayName ||
                    "N/A"}
                </TableData>
                {/* 11 Grade */}
                <TableData className="py-2 px-4">
                  {contract?.productInfo?.[0]?.grade ||
                    contract?.grade ||
                    "N/A"}
                </TableData>
                {/* 12 Quantity (MTS) */}
                <TableData className="py-2 px-4">
                  {formatQuantity(
                    contract?.productInfo?.[0]?.quantityMTS *
                      contract?.productInfo?.[0]?.quantityFCL
                  ) ||
                    formatQuantity(contract?.quantityMTS) ||
                    "N/A"}
                </TableData>
                {/* 13 Container Type */}

                <TableData className="py-2 px-4">
                  {contract?.productInfo?.[0]?.container_type ||
                    contract?.containerType ||
                    "N/A"}
                </TableData>
                {/* 14 Packing */}
                <TableData className="py-2 px-4">
                  {contract?.productInfo?.[0]?.packing ||
                    contract?.packing ||
                    "N/A"}
                </TableData>
                {/* 15 Total Value */}
                <TableData className="py-2 px-4">
                  {formatAmount(contract?.productInfo?.[0]?.totalValue) ||
                    formatAmount(contract?.totalValue) ||
                    "N/A"}
                </TableData>
                {/* 16 Status */}
                <TableData className="py-2 px-4">{contract.status}</TableData>
                {/* 17 Action */}
                <ActionButtons
                  isCell={true}
                  items={[
                    {
                      action: ACTION_BUTTON_TYPES.VIEW,
                      tooltip: "View Contract Details",
                      permission: hasPermission("View"),
                      onClick: () =>
                        history.push({
                          pathname: "/view-purchase-contract",
                          state: { contractId: contract._id },
                        }),
                    },
                    {
                      action: ACTION_BUTTON_TYPES.DUPLICATE,
                      tooltip: "Duplicate Contract",
                      permission: hasPermission("Add"),
                      onClick: () => handleDuplicateClick(contract),
                    },
                    {
                      action: ACTION_BUTTON_TYPES.EDIT,
                      tooltip: "Update Contract Details",
                      permission:
                        hasPermission("Update") &&
                        (contract.status === "Draft" ||
                          contract.status ===
                            "Amendments Requested (Management)" ||
                          contract.status ===
                            "Amendments Requested (Accounts)"),
                      onClick: () => {
                        setContractId(contract._id);
                        history.push({
                          pathname: "/update-purchase-contract",
                          state: { contractId: contract._id },
                        });
                      },
                    },
                    // Send to Management (normal flow)
                    {
                      action: ACTION_BUTTON_TYPES.REQUEST_APPROVAL,
                      permission:
                        contract.status === "Draft" ||
                        contract.status === "Amendments Requested (Management)",
                      tooltip:
                        requestingApprovalId === contract._id
                          ? "Sending..."
                          : "Request Management Approval",
                      onClick: () => RequestApproval(contract._id),
                      disabled:
                        requestingApprovalId === contract._id ||
                        requestingApprovalId !== null,
                      loading: requestingApprovalId === contract._id,
                    },
                    // Send to Accounts after Accounts requested amendments
                    {
                      action: ACTION_BUTTON_TYPES.REQUEST_APPROVAL,
                      permission:
                        contract.status === "Amendments Requested (Accounts)",
                      tooltip: "Send to Accounts",
                      onClick: () => RequestApprovalToAccounts(contract._id),
                    },
                    {
                      action: ACTION_BUTTON_TYPES.CHANGE_STATUS,
                      tooltip: "Change Status",
                      permission:
                        hasPermission("Change Status") &&
                        !requiresManagementSignature,
                      onClick: () => {
                        setChangeStatusContractId(contract._id);
                        setChangeStatusCurrent(contract.status);
                        setIsChangeStatusModalOpen(true);
                      },
                    },
                    {
                      action: ACTION_BUTTON_TYPES.APPROVE,
                      tooltip: "Approve Contract",
                      permission:
                        hasPermission("Approve Purchase") &&
                        contract.status === "Waiting Management Approval",
                      onClick: () => {
                        setSelectedContractId(contract._id);
                        setIsSignatureModalOpen(true);
                      },
                    },
                    {
                      action: ACTION_BUTTON_TYPES.VIEW_PDF,
                      tooltip: "Download Contract",
                      permission: !!contract.document_id,
                      onClick: () => HandleOpenFile(contract),
                    },
                    {
                      action: ACTION_BUTTON_TYPES.APPROVE_ACCOUNTS,
                      tooltip: "Generate Contract Document",
                      permission:
                        hasPermission("Accounts Approve Purchase") &&
                        contract.status === "Preparing Contract",
                      onClick: () => {
                        setSelectedContractId(contract._id);
                        setBusinesss_id(contract.business._id);
                        setSelectedContractNo(
                          contract.contractNo || "document"
                        );
                        setIsModalOpen(true);
                      },
                    },
                    {
                      action: ACTION_BUTTON_TYPES.HISTORY,
                      tooltip: "View Contract History",
                      permission: true,
                      onClick: () => {
                        setHistoryContract({
                          id: contract._id,
                          contractNo: contract.contractNo,
                        });
                        setIsHistoryOpen(true);
                      },
                    },

                    // {
                    //   action:
                    //     ACTION_BUTTON_TYPES.SEND_EMAIL ||
                    //     ACTION_BUTTON_TYPES.REQUEST_APPROVAL,
                    //   tooltip:
                    //     emailSendingId === contract._id
                    //       ? "Sending..."
                    //       : "Send Email to Vendor",
                    //   permission: contract.status === "Waiting Vendor Approval",
                    //   loading: emailSendingId === contract._id,
                    //   onClick: () => openManualSendEmailModal(contract),
                    // },
                    {
                      action: ACTION_BUTTON_TYPES.TWO_LEVEL,
                      tooltip: "Create Two-Level Contract",
                      permission:
                        hasPermission("Add") &&
                        (contract.status === "Draft" ||
                          contract.status === "Completed"),
                      onClick: () => handleCreateTwoLevelContract(contract),
                    },
                    {
                      action: ACTION_BUTTON_TYPES.SEND_EMAIL,
                      tooltip: "Send Contract Approval Email to Vendor",
                      permission: contract.status === "Processing",
                      onClick: () => handleSendVendorEmailClick(contract),
                    },
                  ]}
                />
              </TableRow>
            );
          }}
        />

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
          type="Purchase Contract"
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

        {isChangeStatusModalOpen && (
          <ChangeStatusModal
            onClose={() => setIsChangeStatusModalOpen(false)}
            contractId={changeStatusContractId}
            currentStatus={changeStatusCurrent}
          />
        )}

        {/* Purchase History Modal */}
        <ContractHistoryModal
          isOpen={isHistoryOpen}
          onClose={() => {
            setIsHistoryOpen(false);
            setHistoryContract(null);
          }}
          contractId={historyContract?.id}
          contractNo={historyContract?.contractNo}
          contractType="purchase"
        />

        {/* Document Comparison Viewer removed - handled inside DocumentGenerator */}

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
          title="Duplicate Purchase Contract"
          actions={[
            {
              label: "Cancel",
              secondary: true,
              onClick: () => setIsDuplicateModalOpen(false),
            },
            {
              label: loading ? "Duplicating..." : "Yes, Duplicate",
              primary: true,
              onClick: handleConfirmDuplicate,
              disabled: loading,
            },
          ]}
        >
          Are you sure you want to duplicate this purchase contract? This will
          create a new contract in Draft status.
        </CustomModal>

        {/* Send Vendor Email Modal */}
        <SendVendorEmailModal
          isOpen={isVendorEmailModalOpen}
          onClose={() => {
            setIsVendorEmailModalOpen(false);
            setSelectedContractForVendorEmail(null);
            setVendorEmailForContract("");
          }}
          contract={selectedContractForVendorEmail}
          vendorEmail={vendorEmailForContract}
        />

        {/* Manual Send Email Modal with CC */}
        {sendEmailModal.open && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50 transition-opacity duration-300">
            <div className="bg-white rounded-lg shadow-lg p-6 w-[500px] animate-fadeIn">
              <h2 className="text-lg font-semibold text-gray-800">
                Send Email to Vendor
              </h2>
              <p className="text-sm text-gray-600 mt-2">
                This will send the contract to the vendor for approval.
              </p>
              <div className="mt-4 text-sm">
                <div className="text-gray-700">
                  <strong>Contract:</strong>{" "}
                  {sendEmailModal.contract?.contractNo}
                </div>
                <div className="text-gray-700">
                  <strong>Vendor:</strong>{" "}
                  {
                    sendEmailModal.contract?.basicInfo?.selectedVendorId
                      ?.basicInformation?.vendorDisplayName
                  }
                </div>
              </div>

              {/* Email Selection with Tags */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Recipients
                </label>

                {/* Selected Emails as Tags */}
                <div className="border rounded-md p-2 min-h-[60px] mb-2 bg-gray-50">
                  <div className="flex flex-wrap gap-2">
                    {selectedEmails.map((email, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-[var(--p-blue)] text-white"
                      >
                        {email}
                        <button
                          type="button"
                          onClick={() => handleRemoveEmail(email)}
                          className="ml-2 hover:text-red-200 focus:outline-none"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    {selectedEmails.length === 0 && (
                      <span className="text-gray-400 text-sm py-1">
                        No recipients selected
                      </span>
                    )}
                  </div>
                </div>

                {/* Input with Dropdown */}
                <div className="relative email-dropdown-container">
                  <input
                    type="text"
                    value={emailInput}
                    onChange={(e) => {
                      setEmailInput(e.target.value);
                      setShowDropdown(true);
                      setCcEmailError("");
                    }}
                    onFocus={() => setShowDropdown(true)}
                    onKeyDown={handleKeyDown}
                    autoComplete="off"
                    className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                    placeholder="Type email or select from dropdown..."
                  />

                  {/* Dropdown */}
                  {showDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {(() => {
                        // Filter available emails based on search input
                        const searchTerm = emailInput.toLowerCase().trim();
                        const filteredEmails = availableEmails.filter(
                          (item) => {
                            if (selectedEmails.includes(item.email))
                              return false;
                            if (!searchTerm) return true;
                            return (
                              item.email.toLowerCase().includes(searchTerm) ||
                              item.label.toLowerCase().includes(searchTerm)
                            );
                          }
                        );

                        return (
                          <>
                            {/* Available Emails */}
                            {filteredEmails.length > 0 ? (
                              <>
                                <div className="px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50">
                                  Available Contacts
                                </div>
                                {filteredEmails.map((item, idx) => (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() =>
                                      handleSelectEmail(item.email)
                                    }
                                    className="w-full text-left px-3 py-2 hover:bg-gray-100 flex flex-col"
                                  >
                                    <span className="text-sm font-medium text-gray-800">
                                      {item.email}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      {item.label}
                                    </span>
                                  </button>
                                ))}
                              </>
                            ) : null}

                            {/* Add Custom Email Option */}
                            {emailInput.trim() &&
                              !selectedEmails.includes(emailInput.trim()) && (
                                <>
                                  {filteredEmails.length > 0 && (
                                    <div className="border-t"></div>
                                  )}
                                  <div className="px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50">
                                    Custom Email
                                  </div>
                                  <button
                                    type="button"
                                    onClick={handleAddCustomEmail}
                                    className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm text-[var(--p-blue)] font-medium"
                                  >
                                    + Add "{emailInput.trim()}"
                                  </button>
                                </>
                              )}

                            {/* No results message */}
                            {filteredEmails.length === 0 &&
                              !emailInput.trim() && (
                                <div className="px-3 py-2 text-sm text-gray-500 text-center">
                                  All contacts selected
                                </div>
                              )}
                            {filteredEmails.length === 0 &&
                              emailInput.trim() &&
                              !/^\S+@\S+\.\S+$/.test(emailInput.trim()) && (
                                <div className="px-3 py-2 text-sm text-gray-500 text-center">
                                  No matching contacts found
                                </div>
                              )}
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {ccEmailError && (
                  <div className="text-red-500 text-xs mt-1">
                    {ccEmailError}
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                  onClick={closeManualSendEmailModal}
                  disabled={emailSendingId === sendEmailModal.contract?._id}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={`px-4 py-2 rounded-md text-white ${
                    emailSendingId === sendEmailModal.contract?._id
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-[var(--p-blue)] hover:bg-[#7db535]"
                  }`}
                  onClick={handleManualSendVendorEmail}
                  disabled={emailSendingId === sendEmailModal.contract?._id}
                >
                  {emailSendingId === sendEmailModal.contract?._id
                    ? "Sending..."
                    : "Send"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
