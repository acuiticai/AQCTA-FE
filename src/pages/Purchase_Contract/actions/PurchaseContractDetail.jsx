import { useState, useEffect, useContext, useRef } from "react";
import ContractHeader from "./headercomponents/ContractHeader";
import Billing from "./headercomponents/BillingTable";
import ShipmentsTable from "./component/subcomponent/ShipmentsTable";
import ExpensesTable from "./component/ExpensesTable";
import DocumentsTable from "./component/DocumentsTable";
import GeneralInfo from "./headercomponents/GeneralInfo";
import PurchasesTabs from "./headercomponents/Purchases";
import BackButton from "../../../components/BackButton";
import SignatureTab from "../SignatureTab";
import DocumentTemplateModal from "./DocumentTemplateModal";
import DocumentGenerator from "../../Accounts/CustomerInvoice/purchase-document-generator.jsx";
import DocumentViewer from "../../Accounts/CustomerInvoice/document-viewer.jsx";
import ChangeStatusModal from "../ChangeStatusModal";
import ContractHistoryModal from "@/components/ContractHistoryModal";
import SendVendorEmailModal from "../SendVendorEmailModal";
import TwoLevelContractsModal from "@/components/TwoLevelContractsModal";
import { CustomModal } from "@/page-layouts";
import { useLocation, useHistory } from "react-router-dom";
import { AdminContext } from "@/context/AdminContext";
import { usePurchaseContext } from "../context/PurchaseContractContext";
import useButtonColor from "@/hooks/useButtonColor";
import axios from "axios";
import request from "@/services/httpService";
import { notifySuccess, notifyError } from "@/utils/toast";
import {
  MdCheckCircle,
  MdReply,
  MdInfo,
  MdReceipt,
  MdShoppingCart,
  MdLocalShipping,
  MdAttachMoney,
  MdDescription,
  MdApproval,
  MdSend,
  MdEdit,
} from "react-icons/md";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const ContractDetails = () => {
  const [activeTab, setActiveTab] = useState("General Info");
  const [Data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  const history = useHistory();
  const contractId =
    location.state?.contractId || location.pathname?.split("/").pop();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const buttonColor = useButtonColor();

  // Get setContractId from purchase context
  const { setContractId } = usePurchaseContext();

  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo.token}`,
  };

  // Local UI states mirrored from listing actions
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [isChangeStatusModalOpen, setIsChangeStatusModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [isVendorEmailModalOpen, setIsVendorEmailModalOpen] = useState(false);
  const [isTwoLevelModalOpen, setIsTwoLevelModalOpen] = useState(false);

  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [selectedContractNo, setSelectedContractNo] = useState("");
  const [changeStatusCurrent, setChangeStatusCurrent] = useState("");
  const [emailSendingId, setEmailSendingId] = useState(null);

  const [historyContract, setHistoryContract] = useState(null);
  const [contractToDuplicate, setContractToDuplicate] = useState(null);
  const [selectedContractForVendorEmail, setSelectedContractForVendorEmail] =
    useState(null);
  const [vendorEmailForContract, setVendorEmailForContract] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [sendEmailModal, setSendEmailModal] = useState({
    open: false,
    contract: null,
  });
  const [selectedEmails, setSelectedEmails] = useState([]);
  const [availableEmails, setAvailableEmails] = useState([]);
  const [emailInput, setEmailInput] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [ccEmailError, setCcEmailError] = useState("");
  const moreMenuRef = useRef(null);

  useEffect(() => {
    fetchGroups();
  }, [contractId]);

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
  const [pagePermissions, setPagePermissions] = useState([]);
  const checkPagePermissions = () => {
    if (!adminInfo || !adminInfo.role || !adminInfo.role.modules) {
      console.log("No admin info or modules found");
      return;
    }

    const currentPath = "/purchase_contracts";
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

  const fetchGroups = async () => {
    if (!contractId) return;
    setLoading(true);
    try {
      let response = await axios.get(
        `${Base_URL}/purchase-contracts/${contractId}`,
        { headers }
      );
      console.log("contract response", response.data);
      setData(response.data);
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  };

  const RequestApproval = async (_id) => {
    console.log("status", _id);
    setLoading(true);
    try {
      const data = {
        status: "Waiting Management Approval",
      };

      await request.put(`/purchase-contracts/status/${_id}`, data);
      notifySuccess("Purchase Contract Updated Successfully", () => {
        window.location.reload();
      });
    } catch (error) {
      notifyError(
        _id
          ? "Error updating contract"
          : "Error saving Purchase Contract Basic Info"
      );
      console.log("Error : ", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    try {
      setLoading(true);

      let signatureUrl = null;

      if (signatureFileURL) {
        signatureUrl = signatureFileURL;
      } else if (!signaturePad.current?.isEmpty()) {
        const signatureFile = await convertSignatureToFile();
        signatureUrl = await uploadSignature(signatureFile);
      } else {
        notifyError("Please Upload or Draw Signature");
        setLoading(false);
        return;
      }

      if (signatureUrl) {
        await finishSaveProcess(signatureUrl);
      }
    } catch (error) {
      console.error("Failed to save signature:", error);
      notifyError("Failed to save signature. Try again.");
    } finally {
      setLoading(false);
    }
  };

  // Actions mirrored from listing
  const handleGenerateDocument = async (payload) => {
    setSelectedTemplateId(payload.templateId);
    setIsGeneratorOpen(true);
  };

  const handleGenerationSuccess = () => {
    notifySuccess("Accounts Approve Contract, process further!", () => {
      window.location.reload();
      setLoading(false);
    });
  };

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

  const HandleOpenFile = async (item) => {
    try {
      let Response = await request.get(
        `${Base_URL}/documents/getFileWithAllData/${item.document_id}`
      );
      window.open(Response.data.url, "_blank");
    } catch (error) {
      notifyError("Error getting file");
      console.log("Error : ", error);
    }
  };

  const handleSendVendorEmailClick = async (contract) => {
    setSelectedContractForVendorEmail(contract);
    let vendorEmail = "";
    if (contract?.basicInfo?.selectedVendorId?.basicInformation?.email) {
      vendorEmail = contract.basicInfo.selectedVendorId.basicInformation.email;
    } else if (contract?.vendor_id?.basicInformation?.email) {
      vendorEmail = contract.vendor_id.basicInformation.email;
    } else if (contract?.basicInfo?.selectedVendorId) {
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
      const res = await axios.get(
        `${Base_URL}/purchase-contracts/${sendEmailModal.contract._id}`
      );
      const fresh = res.data;
      const templateId =
        fresh?.template_id || fresh?.templateId || fresh?.template?.id;
      const docUrl = fresh?.document_url;
      const documentId = fresh?.document_id;
      const signature = fresh?.accounts_signature || "";
      if (!templateId || !documentId || !docUrl) {
        notifyError("Contract document is not ready yet.");
        return;
      }
      await axios.put(
        `${Base_URL}/purchase-contracts/SendVendorEmail/${sendEmailModal.contract._id}`,
        {
          template_id: templateId,
          document_url: docUrl,
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
    history.push({
      pathname: "/add-two-level-purchase-contract",
      state: { basePurchaseData: contract, isFromExistingContract: true },
    });
  };

  const handleDuplicateClick = (contract) => {
    setContractToDuplicate(contract);
    setIsDuplicateModalOpen(true);
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
        const { _id, status, document_id, document_url, contractNo, ...rest } =
          contractToDuplicate;
        const payload = { ...rest, status: "Draft" };
        await request.post("/purchase-contracts", payload);
        notifySuccess("Purchase contract duplicated as draft!");
        setIsDuplicateModalOpen(false);
        setContractToDuplicate(null);
        window.location.reload();
        success = true;
      } catch (error) {
        lastError = error;
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

  // Build actions list from status/permissions
  const getActions = () => {
    const canApproveMgmt =
      hasPermission("Approve Purchase") &&
      Data?.status === "Waiting Management Approval";
    const canAccountsApprove =
      hasPermission("Accounts Approve Purchase") &&
      Data?.status === "Preparing Contract";
    const canEdit = Data?.status === "Draft";
    const canSendForApproval =
      hasPermission("Send For Approval") && Data?.status === "Draft";
    const canSendToAccounts =
      Data?.status === "Amendments Requested (Accounts)";
    const canSendVendorManual = Data?.status === "Waiting Vendor Approval";
    const canSendApprovalEmail = Data?.status === "Processing";
    const canTwoLevel =
      hasPermission("Add") &&
      (Data?.status === "Draft" || Data?.status === "Completed");
    const canDuplicate = hasPermission("Add");
    const canViewPdf = !!Data?.document_id;

    return [
      {
        key: "view_pdf",
        label: "View PDF",
        show: canViewPdf,
        onClick: () => HandleOpenFile(Data),
      },
      {
        key: "change_status",
        label: "Change Status",
        show: true,
        onClick: () => {
          setChangeStatusCurrent(Data?.status);
          setIsChangeStatusModalOpen(true);
        },
      },
      {
        key: "approve_mgmt",
        label: "Approve Contract",
        show: canApproveMgmt,
        onClick: () => setIsSignatureModalOpen(true),
      },
      {
        key: "edit",
        label: "Edit Contract",
        show: canEdit,
        onClick: () => {
          setContractId(contractId);
          history.push({
            pathname: "/update-purchase-contract",
            state: { contractId, isEditing: true, contractData: Data },
          });
        },
      },
      {
        key: "send_for_approval",
        label: "Send For Approval",
        show: canSendForApproval,
        onClick: () => RequestApproval(contractId),
      },
      {
        key: "send_to_accounts",
        label: "Send to Accounts",
        show: canSendToAccounts,
        onClick: () => RequestApprovalToAccounts(contractId),
      },
      {
        key: "generate_document",
        label: "Generate Document",
        show: canAccountsApprove,
        onClick: () => {
          setIsModalOpen(true);
          setSelectedContractNo(Data?.contractNo || "document");
        },
      },
      // { key: 'send_email_vendor', label: emailSendingId === Data?._id ? 'Sending…' : 'Send Email to Vendor', disabled: emailSendingId === Data?._id, show: canSendVendorManual, onClick: () => openManualSendEmailModal(Data) },
      {
        key: "send_approval_email",
        label: "Send Approval Email",
        show: canSendApprovalEmail,
        onClick: () => handleSendVendorEmailClick(Data),
      },
      {
        key: "duplicate",
        label: "Duplicate",
        show: canDuplicate,
        onClick: () => handleDuplicateClick(Data),
      },
      {
        key: "two_level",
        label: "Two-level Contract",
        show: canTwoLevel,
        onClick: () => handleCreateTwoLevelContract(Data),
      },
      {
        key: "view_two_level_chain",
        label: "View Contract Chain",
        show: Data?.is_two_level && Data?.related_contracts,
        onClick: () => setIsTwoLevelModalOpen(true),
      },
      {
        key: "history",
        label: "History",
        show: true,
        onClick: () => {
          setHistoryContract({ id: Data?._id, contractNo: Data?.contractNo });
          setIsHistoryOpen(true);
        },
      },
    ].filter((a) => a.show);
  };

  const actionsPrimary = getActions().slice(0, 2);
  const actionsMore = getActions().slice(2);

  useEffect(() => {
    function handleClickOutside(e) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
        setIsMoreOpen(false);
      }
    }
    if (isMoreOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMoreOpen]);

  // Tab configuration with icons
  const tabs = [
    { name: "General Info", icon: MdInfo, component: GeneralInfo },
    { name: "Sales", icon: MdShoppingCart, component: PurchasesTabs },
    { name: "Shipments", icon: MdLocalShipping, component: ShipmentsTable },
    { name: "Expenses", icon: MdAttachMoney, component: ExpensesTable },
    { name: "Documents", icon: MdDescription, component: DocumentsTable },
  ];

  return (
    <div className="p-6 bg-white min-h-screen">
      {loading && (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-100 bg-opacity-75 z-50">
          <div className="loader"></div>
        </div>
      )}
      <div className="flex justify-between items-center mb-4">
        <BackButton />
        <div className="flex items-center gap-2 flex-wrap">
          {actionsPrimary.map((btn) => (
            <button
              key={btn.key}
              onClick={btn.onClick}
              disabled={btn.disabled}
              style={{
                background: buttonColor,
                padding: "8px 16px",
                cursor: "pointer",
              }}
              className={`p-2 text-white rounded-md hover:scale-105 transition-transform duration-200 shadow-md hover:shadow-lg ${
                btn.disabled ? "opacity-70" : ""
              }`}
            >
              {btn.label}
            </button>
          ))}
          {actionsMore.length > 0 && (
            <div className="relative" ref={moreMenuRef}>
              <button
                onClick={() => setIsMoreOpen((p) => !p)}
                style={{
                  background: buttonColor,
                  padding: "8px 16px",
                  cursor: "pointer",
                }}
                className="p-2 text-white rounded-md hover:scale-105 transition-transform duration-200 shadow-md hover:shadow-lg"
              >
                More
              </button>
              {isMoreOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg border border-gray-100 z-20">
                  <div className="py-1">
                    {actionsMore.map((m) => (
                      <button
                        key={m.key}
                        className={`block w-full text-left px-4 py-2 text-sm ${
                          m.disabled
                            ? "text-gray-400"
                            : "text-gray-700 hover:bg-gray-100"
                        }`}
                        onClick={() => {
                          if (!m.disabled) {
                            setIsMoreOpen(false);
                            m.onClick();
                          }
                        }}
                        disabled={m.disabled}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <ContractHeader Data={Data} />

      <div className="mt-6">
        {/* Enhanced Tab Navigation */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex border-b border-gray-200 bg-gray-50">
            {tabs.map((tab) => {
              const IconComponent = tab.icon;
              const isActive = activeTab === tab.name;
              return (
                <button
                  key={tab.name}
                  onClick={() => setActiveTab(tab.name)}
                  className={`flex items-center space-x-2 px-6 py-4 text-sm font-medium transition-all duration-300 whitespace-nowrap border-b-2 relative group ${
                    isActive
                      ? "border-[var(--p-blue)] text-[var(--p-blue)] bg-white"
                      : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  }`}
                >
                  <IconComponent
                    className={`w-5 h-5 transition-all duration-300 ${
                      isActive
                        ? "text-[var(--p-blue)] scale-110"
                        : "text-gray-500 group-hover:text-gray-700 group-hover:scale-105"
                    }`}
                  />
                  <span className="transition-all duration-300">
                    {tab.name}
                  </span>

                  {/* Animated underline for active tab */}
                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--p-blue)] transform origin-left transition-transform duration-300 scale-x-100"></div>
                  )}

                  {/* Hover effect for inactive tabs */}
                  {!isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-300 transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab Content with Animation */}
          <div className="p-6">
            {tabs.map((tab) => {
              const TabComponent = tab.component;
              return (
                activeTab === tab.name && (
                  <div
                    key={tab.name}
                    className="animate-fadeInUp"
                    style={{
                      animation: "fadeInUp 0.4s ease-out",
                    }}
                  >
                    <TabComponent Data={Data} />
                  </div>
                )
              );
            })}
          </div>
        </div>

        {isSignatureModalOpen && (
          <SignatureTab
            contractId={contractId}
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
          contractId={contractId}
          onSubmit={handleGenerateDocument}
        />

        {/* Document Generator */}
        {isGeneratorOpen && (
          <DocumentGenerator
            open={isGeneratorOpen}
            onClose={() => setIsGeneratorOpen(false)}
            templateId={selectedTemplateId}
            contractId={contractId}
            business_id={Data?.business?._id}
            adminInfo={adminInfo}
            onSuccess={handleGenerationSuccess}
          />
        )}

        {/* Change Status Modal */}
        {isChangeStatusModalOpen && (
          <ChangeStatusModal
            onClose={() => setIsChangeStatusModalOpen(false)}
            contractId={contractId}
            currentStatus={changeStatusCurrent}
          />
        )}

        {/* History Modal */}
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

        {/* Document Viewer */}
        {isViewerOpen && (
          <DocumentViewer
            business_id={Data?.business?._id}
            open={isViewerOpen}
            onClose={() => setIsViewerOpen(false)}
            documentUrl={documentUrl}
            contractNo={selectedContractNo}
          />
        )}

        {/* Duplicate Confirmation */}
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

        {/* Two-Level Contracts Modal */}
        <TwoLevelContractsModal
          isOpen={isTwoLevelModalOpen}
          onClose={() => setIsTwoLevelModalOpen(false)}
          contractData={Data}
        />
      </div>

      {/* Custom CSS for animations */}
      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeInUp {
          animation: fadeInUp 0.4s ease-out;
        }

        /* Smooth transitions for all interactive elements */
        * {
          transition-property: all;
          transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* Enhanced button hover effects */
        button:hover {
          transform: translateY(-1px);
        }

        /* Tab content slide animation */
        .tab-content-enter {
          opacity: 0;
          transform: translateX(20px);
        }

        .tab-content-enter-active {
          opacity: 1;
          transform: translateX(0);
          transition: opacity 300ms, transform 300ms;
        }

        .tab-content-exit {
          opacity: 1;
          transform: translateX(0);
        }

        .tab-content-exit-active {
          opacity: 0;
          transform: translateX(-20px);
          transition: opacity 300ms, transform 300ms;
        }
      `}</style>
    </div>
  );
};

export default ContractDetails;
