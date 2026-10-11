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
import { useLocation } from "react-router-dom";
import { AdminContext } from "@/context/AdminContext";
import useButtonColor from "@/hooks/useButtonColor";
import axios from "axios";
import request from "@/services/httpService";
import { notifySuccess, notifyError } from "@/utils/toast";
import { MdCheckCircle, MdReply } from "react-icons/md";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const ContractDetails = () => {
  const [activeTab, setActiveTab] = useState("General Info");
  const [Data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  const contractId = location.state?.contractId;
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const buttonColor = useButtonColor();
  const [pagePermissions, setPagePermissions] = useState([]);
  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo.token}`,
  };

  useEffect(() => {
    fetchGroups();
  }, [contractId]);

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

  const fetchGroups = async () => {
    if (!contractId) return;
    setLoading(true);
    try {
      let response = await axios.get(
        `${Base_URL}/sales-contracts/${contractId}`,
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

  return (
    <div className="p-6 bg-white min-h-screen">
      {loading && (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-100 bg-opacity-75 z-50">
          <div className="loader"></div>
        </div>
      )}
      <div className="flex justify-between items-center mb-4">
        <BackButton />
        {hasPermission("Approve Sales") &&
          Data?.status === "Waiting Management Approval" && (
            <button
              onClick={() => {
                setIsSignatureModalOpen(true);
              }}
              style={{
                background: buttonColor,
                padding: "8px 16px",
                cursor: "pointer",
              }}
              className="p-2 text-white rounded-md flex items-center gap-2"
            >
              <MdReply
                title="Respond to Approval"
                className="text-white hover:text-gray-400"
              />
              Approve Contract
            </button>
          )}
        {hasPermission("Send For Approval") && Data?.status === "Draft" && (
          <button
            onClick={() => RequestApproval(contractId)}
            style={{
              background: buttonColor,
              padding: "8px 16px",
              cursor: "pointer",
            }}
            className="p-2 text-white rounded-md flex items-center gap-2"
          >
            <MdReply
              title="Respond to Approval"
              className="text-white hover:text-gray-400"
            />
            Send For Approval
          </button>
        )}
      </div>

      <ContractHeader Data={Data} />

      <div className="mt-6">
        <div className="flex border-b border-gray-200">
          {[
            "General Info",
            "Billing",
            "Purchases",
            "Shipments",
            "Expenses",
            "Documents",
          ].map((tab) => (
            <button
              key={tab}
              className={`p-3 px-5 cursor-pointer border-b-4 border-transparent transition-all duration-200 ${
                activeTab === tab
                  ? "border-[var(--p-blue)] text-[var(--p-blue)] font-bold"
                  : "text-gray-600"
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {activeTab === "General Info" && <GeneralInfo Data={Data} />}
          {activeTab === "Billing" && <Billing Data={Data} />}
          {activeTab === "Purchases" && <PurchasesTabs Data={Data} />}
          {activeTab === "Shipments" && <ShipmentsTable Data={Data} />}
          {activeTab === "Expenses" && <ExpensesTable Data={Data} />}
          {activeTab === "Documents" && <DocumentsTable Data={Data} />}
        </div>
        {isSignatureModalOpen && (
          <SignatureTab
            contractId={contractId}
            onClose={() => {
              setIsSignatureModalOpen(false);
            }}
          />
        )}
      </div>
    </div>
  );
};

export default ContractDetails;
