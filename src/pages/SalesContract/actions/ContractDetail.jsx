import { useState, useEffect, useContext } from "react";
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
import ContractDocumentGenerator from "./ContractDocumentGenerator";
import ReplyToAmendmentModal from "../components/ReplyToAmendmentModal";
import { useLocation, useHistory } from "react-router-dom";
import { AdminContext } from "@/context/AdminContext";
import { useSalesContext } from "../context/SalesContractContext";
import useButtonColor from "@/hooks/useButtonColor";
import axios from "axios";
import request from "@/services/httpService";
import { notifySuccess, notifyError } from "@/utils/toast";
import ContractHistoryModal from "@/components/ContractHistoryModal";
import ChangeStatusModal from "../ChangeStatusModal";
import SendEmailModal from "../SendEmailModal";
import TwoLevelContractsModal from "@/components/TwoLevelContractsModal";
import { contractNumberGenerate } from "../hooks/useBasicInfo";
import { CustomModal } from "@/page-layouts";
import {
  MdCheckCircle,
  MdReply,
  MdDownload,
  MdInfo,
  MdReceipt,
  MdShoppingCart,
  MdLocalShipping,
  MdAttachMoney,
  MdDescription,
  MdApproval,
  MdSend,
  MdEdit,
  MdMoreVert,
} from "react-icons/md";
import { useTranslation } from "react-i18next";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const ContractDetails = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("General Info");
  const [Data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  const history = useHistory();
  const contractId =
    location.state?.contractId ||
    location.pathname?.split("/").pop() ||
    location.params?.id;
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [isReplyModalOpen, setIsReplyModalOpen] = useState(false);
  const buttonColor = useButtonColor();
  const [pagePermissions, setPagePermissions] = useState([]);
  const [isChangeStatusModalOpen, setIsChangeStatusModalOpen] = useState(false);
  const [changeStatusCurrent, setChangeStatusCurrent] = useState("");
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [customerEmailForContract, setCustomerEmailForContract] = useState("");
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [isTwoLevelModalOpen, setIsTwoLevelModalOpen] = useState(false);

  // Get setContractId from sales context
  const { setContractId } = useSalesContext();

  // Document generation states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [selectedContractNo, setSelectedContractNo] = useState("");
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo.token}`,
  };

  useEffect(() => {
    if (contractId) {
      fetchGroups();
    }
  }, [contractId, location.pathname]);

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

  const fetchGroups = async () => {
    if (!contractId) return;
    setLoading(true);
    try {
      let response = await axios.get(
        `${Base_URL}/sales-contracts/${contractId}`,
        { headers }
      );
      console.log("contract response", response.data);
      console.log("contract business field:", response.data?.business);
      console.log(
        "contract basicInfo business field:",
        response.data?.basicInfo?.business
      );
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

      await request.put(`/sales-contracts/status/${_id}`, data);
      notifySuccess("Sales Contract Updated Successfully", () => {
        window.location.reload();
      });
    } catch (error) {
      notifyError(
        _id
          ? "Error updating contract"
          : "Error saving Sales Contract Basic Info"
      );
      console.log("Error : ", error);
    } finally {
      setLoading(false);
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

  const handleDuplicateClick = () => {
    setIsDuplicateModalOpen(true);
  };

  const handleConfirmDuplicate = async () => {
    if (!Data) return;
    setLoading(true);
    let attempts = 0;
    let maxAttempts = 5;
    let success = false;
    let lastError = null;
    while (attempts < maxAttempts && !success) {
      try {
        const contractCopy = JSON.parse(JSON.stringify(Data));

        delete contractCopy._id;
        delete contractCopy.status;
        delete contractCopy.document_id;
        delete contractCopy.document_url;
        delete contractCopy.contractNo;
        delete contractCopy.createdAt;
        delete contractCopy.updatedAt;
        delete contractCopy.__v;

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
            contractCopy.basicInfo.selectedBankId =
              contractCopy.basicInfo.bankAccount._id;
          }

          if (
            contractCopy.basicInfo.bankAccount &&
            typeof contractCopy.basicInfo.bankAccount === "object" &&
            contractCopy.basicInfo.bankAccount._id
          ) {
            contractCopy.basicInfo.bankAccount =
              contractCopy.basicInfo.bankAccount._id;
          }
        }

        if (
          contractCopy.business &&
          typeof contractCopy.business === "object" &&
          contractCopy.business._id
        ) {
          contractCopy.business = contractCopy.business._id;
        }

        contractCopy.status = "Draft";
        contractCopy.contractNo = contractNumberGenerate(10, "K");

        await request.post("/sales-contracts", contractCopy);
        notifySuccess("Contract duplicated as draft!");
        setIsDuplicateModalOpen(false);
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
          notifyError("Failed to duplicate contract");
          setIsDuplicateModalOpen(false);
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
      setLoading(false);
    }
  };

  const handleSendEmailClick = async () => {
    let customerEmail = "";
    if (Data?.basicInfo?.customer_id?.basicInformation?.email) {
      customerEmail = Data.basicInfo.customer_id.basicInformation.email;
    } else if (Data?.customer_id?.basicInformation?.email) {
      customerEmail = Data.customer_id.basicInformation.email;
    } else if (Data?.basicInfo?.selectedCustomerId) {
      try {
        const response = await axios.get(
          `${Base_URL}/customers/${Data.basicInfo.selectedCustomerId}`
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

  // Document generation handlers
  const handleGenerateDocument = ({ templateId, contractId }) => {
    console.log("Generating document:", { templateId, contractId });
    setSelectedTemplateId(templateId);
    setIsGeneratorOpen(true);
  };

  const handleGenerationSuccess = async (response) => {
    console.log("Document generation success:", response);
    if (response?.file?.s3Key) {
      try {
        // Get the file data using the correct endpoint
        const fileResponse = await axios.get(
          `${Base_URL}/documents/getFileWithAllData/${response.file._id}`,
          {
            headers: {
              authorization: `Bearer ${adminInfo.token}`,
            },
          }
        );

        if (fileResponse.data?.data?.url) {
          const fileUrl = fileResponse.data.data.url;
          const fileName = `contract-${Data?.contractNo || "document"}.pdf`;

          // Create download link
          const link = document.createElement("a");
          link.href = fileUrl;
          link.download = fileName;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      } catch (error) {
        console.error("Error downloading file:", error);
        notifyError("Failed to download file");
      }
    }
    notifySuccess("Document generated and downloaded successfully!");
  };

  const handleDownloadContract = () => {
    setIsModalOpen(true);
  };

  // Build actions based on status/availability
  const getAvailableActions = () => {
    const actions = [];

    // Send For Approval (status based only)
    if (
      Data?.status === "Draft" ||
      Data?.status === "Amendments Requested (Management)"
    ) {
      actions.push({
        key: "sendForApproval",
        label: t("salesContract.actions.sendForApproval", { defaultValue: "Send For Approval" }),
        onClick: () => RequestApproval(contractId),
        icon: MdReply,
      });
    }

    // Change Status (always)
    actions.push({
      key: "changeStatus",
      label: t("salesContract.actions.changeStatus", { defaultValue: "Change Status" }),
      onClick: () => {
        setChangeStatusCurrent(Data?.status);
        setIsChangeStatusModalOpen(true);
      },
      icon: MdCheckCircle,
    });

    // History (always)
    actions.push({
      key: "history",
      label: t("salesContract.actions.history", { defaultValue: "History" }),
      onClick: () => setIsHistoryModalOpen(true),
      icon: MdInfo,
    });

    // Edit (status only)
    if (
      Data?.status === "Draft" ||
      Data?.status === "Amendments Requested (Management)" ||
      Data?.status === "Amendments Requested (Accounts)"
    ) {
      actions.push({
        key: "edit",
        label: t("salesContract.actions.editContract", { defaultValue: "Edit Contract" }),
        onClick: () => {
          setContractId(contractId);
          history.push({
            pathname: "/update-sales-contract",
            state: {
              contractId: contractId,
              isEditing: true,
              contractData: Data,
            },
          });
        },
        icon: MdEdit,
      });
    }

    // Duplicate (always for now)
    actions.push({
      key: "duplicate",
      label: t("salesContract.actions.duplicate", { defaultValue: "Duplicate" }),
      onClick: handleDuplicateClick,
      icon: MdEdit,
    });

    // Send to Accounts
    if (Data?.status === "Amendments Requested (Accounts)") {
      actions.push({
        key: "sendToAccounts",
        label: t("salesContract.actions.sendToAccounts", { defaultValue: "Send to Accounts" }),
        onClick: () => RequestApprovalToAccounts(contractId),
        icon: MdSend,
      });
    }

    // Download (existing document)
    if (!!Data?.document_id) {
      actions.push({
        key: "download",
        label: t("salesContract.actions.downloadContract", { defaultValue: "Download Contract" }),
        onClick: () => HandleOpenFile(Data),
        icon: MdDownload,
      });
    }

    // Approve (Management)
    if (
      hasPermission("Approve Sales") &&
      Data?.status === "Waiting Management Approval"
    ) {
      actions.push({
        key: "approve",
        label: t("salesContract.actions.approveContract", { defaultValue: "Approve Contract" }),
        onClick: () => setIsSignatureModalOpen(true),
        icon: MdReply,
      });
    }

    // Generate Contract Document (Accounts)
    if (
      hasPermission("Accounts Approve Sales") &&
      Data?.status === "Preparing Contract"
    ) {
      actions.push({
        key: "generateDocument",
        label: t("salesContract.actions.generateDocument", {
          defaultValue: "Generate Contract Document",
        }),
        onClick: () => {
          setSelectedContractNo(Data?.contractNo || "document");
          setIsModalOpen(true);
        },
        icon: MdApproval,
      });
    }

    // Send Email when Processing
    if (Data?.status === "Processing") {
      actions.push({
        key: "sendEmail",
        label: t("common.sendEmail", { defaultValue: "Send Email" }),
        onClick: handleSendEmailClick,
        icon: MdSend,
      });
    }

    // Profit Sharing custom download trigger
    if (Data?.basicInfo?.typeOfSaleContract === "Profit Sharing") {
      actions.push({
        key: "profitSharingDownload",
        label: t("salesContract.actions.downloadProfitSharingContract", {
          defaultValue: "Download Profit Sharing Contract",
        }),
        onClick: handleDownloadContract,
        icon: MdDownload,
      });
    }

    // Two-Level Contract Chain - show if this is part of two-level system
    if (Data?.is_two_level && Data?.related_contracts) {
      actions.push({
        key: "viewTwoLevelChain",
        label: t("salesContract.actions.viewTwoLevelChain", {
          defaultValue: "View Two-Level Chain",
        }),
        onClick: () => setIsTwoLevelModalOpen(true),
        icon: MdShoppingCart,
      });
    }

    return actions;
  };

  // Tab configuration with icons
  const tabs = [
    { name: "General Info", label: t("salesContract.tabs.generalInfo", { defaultValue: "General Info" }), icon: MdInfo, component: GeneralInfo },
    { name: "Billing", label: t("salesContract.tabs.billing", { defaultValue: "Billing" }), icon: MdReceipt, component: Billing },
    { name: "Purchases", label: t("salesContract.tabs.purchases", { defaultValue: "Purchases" }), icon: MdShoppingCart, component: PurchasesTabs },
    { name: "Shipments", label: t("salesContract.tabs.shipments", { defaultValue: "Shipments" }), icon: MdLocalShipping, component: ShipmentsTable },
    { name: "Expenses", label: t("salesContract.tabs.expenses", { defaultValue: "Expenses" }), icon: MdAttachMoney, component: ExpensesTable },
    { name: "Documents", label: t("documents.title", { defaultValue: "Documents" }), icon: MdDescription, component: DocumentsTable },
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
        <div className="flex gap-2 relative">
          {getAvailableActions()
            .slice(0, 2)
            .map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.key}
                  onClick={action.onClick}
                  style={{
                    background: buttonColor,
                    padding: "8px 16px",
                    cursor: "pointer",
                  }}
                  className="p-2 text-white rounded-md flex items-center gap-2 hover:scale-105 transition-transform duration-200 shadow-md hover:shadow-lg"
                >
                  <Icon className="text-white hover:text-gray-400" />
                  {action.label}
                </button>
              );
            })}

          {getAvailableActions().length > 2 && (
            <div className="relative">
              <button
                onClick={() => setShowMoreOptions(!showMoreOptions)}
                style={{
                  background: buttonColor,
                  padding: "8px 16px",
                  cursor: "pointer",
                }}
                className="p-2 text-white rounded-md flex items-center gap-2 hover:scale-105 transition-transform duration-200 shadow-md hover:shadow-lg"
              >
                <MdMoreVert className="text-white hover:text-gray-400" />
                {t("common.more", { defaultValue: "More" })}
              </button>

              {showMoreOptions && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg z-50 border border-gray-200">
                  <div className="py-2">
                    {getAvailableActions()
                      .slice(2)
                      .map((action) => {
                        const Icon = action.icon;
                        return (
                          <button
                            key={action.key}
                            onClick={() => {
                              setShowMoreOptions(false);
                              action.onClick();
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                          >
                            <Icon className="text-gray-500" />
                            {action.label}
                          </button>
                        );
                      })}
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
                    {tab.label}
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
          type="sales_contract"
          onClose={() => {
            setIsModalOpen(false);
          }}
          contractId={contractId}
          onSubmit={handleGenerateDocument}
        />

        {/* Document Generator Dialog */}
        {isGeneratorOpen && (
          <ContractDocumentGenerator
            open={isGeneratorOpen}
            onClose={() => setIsGeneratorOpen(false)}
            templateId={selectedTemplateId}
            contractId={contractId}
            business_id={Data?.business || Data?.basicInfo?.business}
            adminInfo={adminInfo}
            onSuccess={handleGenerationSuccess}
          />
        )}

        {/* Reply to Amendment Modal */}
        <ReplyToAmendmentModal
          isOpen={isReplyModalOpen}
          onClose={() => setIsReplyModalOpen(false)}
          contractId={contractId}
          contractNo={Data?.contractNo}
          onSuccess={() => {
            // Refresh the contract data after successful reply
            fetchGroups();
          }}
        />

        {/* Change Status Modal */}
        {isChangeStatusModalOpen && (
          <ChangeStatusModal
            onClose={() => setIsChangeStatusModalOpen(false)}
            contractId={contractId}
            currentStatus={changeStatusCurrent}
          />
        )}

        {/* Contract History Modal */}
        <ContractHistoryModal
          isOpen={isHistoryModalOpen}
          onClose={() => {
            setIsHistoryModalOpen(false);
          }}
          contractId={contractId}
          contractNo={Data?.contractNo}
          contractType="sales"
        />

        {/* Send Email Modal */}
        <SendEmailModal
          isOpen={isEmailModalOpen}
          onClose={() => {
            setIsEmailModalOpen(false);
            setCustomerEmailForContract("");
          }}
          contract={Data}
          customerEmail={customerEmailForContract}
        />

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
