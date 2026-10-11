import { useState, useEffect, useContext, useRef } from "react";
import { FiEye } from "react-icons/fi";
import { MdEmail } from "react-icons/md";
import { useHistory } from "react-router-dom";
import { IoArrowBack } from "react-icons/io5";
import axios from "axios";
import {
  Button,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
} from "@mui/material";
import SearchBar from "@/components/SearchBar";
import Table from "@/components/Table";
import BusinessDropdown from "@/components/BusinessDropdown";
import SignatureTab from "../../components/document-template/SignaturePurchaseCustomer.jsx";
import DocumentTemplateModal from "../Purchase_Contract/actions/DocumentTemplateModal.jsx";
import DocumentGenerator from "@/pages/Accounts/CustomerInvoice/purchase-document-generator.jsx";
import DocumentViewer from "@/pages/Accounts/CustomerInvoice/document-viewer";
import { AdminContext } from "@/context/AdminContext";
import { formatAmount } from "@/components/formatAmount";
import { notifySuccess, notifyError } from "@/utils/toast";
import { Printer, ZoomIn, ZoomOut, Lock } from "lucide-react";
import { useLocation } from "react-router-dom";

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
  const [business_id, setBusiness_id] = useState("");
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [pagePermissions, setPagePermissions] = useState([]);
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(true);
  const [signatureFileURL, setSignatureFileURL] = useState("");
  const location = useLocation();
  const pathParts = location.pathname.split("/sign-purchase-contract/")[1];
  const [templateIdFromUrl, contractIdFromUrl] = pathParts?.split(":") || [];
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [selectedContractId, setSelectedContractId] =
    useState(contractIdFromUrl);
  const [selectedTemplateId, setSelectedTemplateId] =
    useState(templateIdFromUrl);
  const [documentUrl, setDocumentUrl] = useState("");
  const [selectedContractNo, setSelectedContractNo] = useState("");

  const [passwordDialogOpen, setPasswordDialogOpen] = useState(true);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [alreadySignedDialogOpen, setAlreadySignedDialogOpen] = useState(false);

  const handleSignatureDialogOpen = () => {
    setSignatureDialogOpen(true);
  };

  const handleSignatureDialogClose = () => {
    setSignatureDialogOpen(false);
  };

  const checkPagePermissions = () => {
    if (!adminInfo || !adminInfo?.role || !adminInfo?.role?.modules) {
      console.log("No admin info or modules found");
      return;
    }

    const currentPath = location.pathname;

    let permissions = [];

    adminInfo?.role.modules.forEach((module) => {
      if (!module.path) {
        console.log(`⚠️ Missing path for module: ${module.name}`);
        return;
      }

      console.log("Checking module:", module.name, "Path:", module.path);

      if (currentPath === module.path) {
        console.log("✅ Matched Module:", module.name);
        permissions = [...permissions, ...module.permissions];
      }

      module?.subModules?.forEach((subModule) => {
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

  // Check if contract is already signed when component mounts
  useEffect(() => {
    if (contracts?.customer_signature && isAuthenticated) {
      setAlreadySignedDialogOpen(true);
    }
  }, [contracts, isAuthenticated]);

  const handlePasswordSubmit = () => {
    // Check if the entered password matches the one in contracts
    if (
      contracts?.contract_password &&
      password === contracts.contract_password
    ) {
      setIsAuthenticated(true);
      setPasswordDialogOpen(false);
      setPasswordError(false);
      setIsGeneratorOpen(true);
      // Check if contract is already signed
      if (contracts?.customer_signature) {
        setAlreadySignedDialogOpen(true);
      }
    } else {
      setPasswordError(true);
    }
  };

  // Updated handleGenerateDocument function
  const handleGenerateDocument = (payload) => {
    console.log("Generating document:", payload);

    // Check if the contract already has a document generated
    // const contract = contracts.find((c) => c._id === payload.contractId)
    // if (contract && contract.documentDetails && contract.documentDetails.document_url) {
    //   // If document exists, open the viewer
    //   setDocumentUrl(payload.contractId)
    //   // setSelectedContractId(contractId)
    //   setSelectedContractNo(contract.contractNo || "document")
    //   setIsViewerOpen(true)
    // } else {
    // If no document exists, open the generator
    setSelectedTemplateId(payload.templateId);
    setSelectedContractId(payload.contractId);
    setIsGeneratorOpen(true);
    // }
  };

  // Handle document generation success
  const handleGenerationSuccess = () => {
    // Removed duplicate success message - final message will come from PDF generation
    window.close();
  };

  useEffect(() => {
    fetchContracts();
  }, []);

  const fetchContracts = async () => {
    try {
      const response = await axios.get(
        `${Base_URL}/purchase-contracts/${selectedContractId}`
      );
      console.log("response.data setContracts", response.data);
      setBusiness_id(response.data.business);
      setContracts(response.data);
      setFilteredContracts(response.data);
    } catch (error) {
      console.error("Error fetching contracts:", error);
    }
  };
  const handleSignatureSave = (url) => {
    setSignatureFileURL(url); // Store updated signature URL
    setIsGeneratorOpen(true);
  };

  // Removed the old generatePDF function as it's no longer needed

  // If not authenticated, only show password dialog
  if (!isAuthenticated) {
    return (
      <Dialog
        open={passwordDialogOpen}
        onClose={() => {}}
        aria-labelledby="password-dialog-title"
      >
        <DialogTitle id="password-dialog-title" className="flex items-center">
          <Lock className="w-5 h-5 mr-2" />
          Contract Access
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" className="mb-4">
            Please enter the password that was sent to you via email to access
            this contract.
          </Typography>
          {passwordError && (
            <Alert severity="error" className="mb-3">
              Incorrect password. Please try again.
            </Alert>
          )}
          <TextField
            autoFocus
            margin="dense"
            id="password"
            label="Password"
            type="password"
            fullWidth
            variant="outlined"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter") {
                handlePasswordSubmit();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => window.close()} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handlePasswordSubmit}
            variant="contained"
            className="bg-lime-500 hover:bg-lime-600"
          >
            Submit
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <div
      className="p-6 bg-white min-h-screen max-h-[100vh] overflow-y-auto pb-[120px]"
      style={{ backgroundColor: "#FFFF" }}
    >
      {/* Signature Modal */}
      {/* {isSignatureModalOpen && (
        <SignatureTab
          contractId={contracts._id}
          onClose={() => {
            setIsSignatureModalOpen(false)
            // setSelectedContractId(null)
          }}
        />
      )} */}

      {/* Document Template Modal */}
      <DocumentTemplateModal
        isOpen={isModalOpen}
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
          onUpload={() => {
            setIsSignatureModalOpen(true);
            setIsGeneratorOpen(false);
          }}
          onClose={() => setIsGeneratorOpen(false)}
          uploadSign={true}
          customer_signature={signatureFileURL}
          templateId={selectedTemplateId}
          contractId={selectedContractId}
          business_id={business_id}
          adminInfo={adminInfo}
          onSuccess={handleGenerationSuccess}
          autoGeneratePDF={true}
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

      {signatureDialogOpen && (
        <SignatureTab
          contractId={contracts._id}
          onSignatureSave={handleSignatureSave}
          onClose={() => {
            handleSignatureDialogClose();
          }}
        />
      )}
    </div>
  );
};

export default PContractListScreen;
