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
import jsPDF from "jspdf";
import moment from "moment";
import SearchBar from "@/components/SearchBar";
import Table from "@/components/Table";
import BusinessDropdown from "@/components/BusinessDropdown";
import SignatureTab from "../../components/document-template/SignatureCustomer";
import DocumentTemplateModal from "../SalesContract/actions/DocumentTemplateModal.jsx";
import DocumentGenerator from "@/pages/Accounts/CustomerInvoice/document-generator.jsx";
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
  const [zoom, setZoom] = useState(100);
  const [isGenerating, setIsGenerating] = useState(false);
  const componentRef = useRef();
  const location = useLocation();
  const pathParts = location.pathname.split("/sign-contract/")[1];
  const [templateIdFromUrl, contractIdFromUrl] = pathParts?.split(":") || [];

  // New states for document generation and viewing
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
    if (!adminInfo || !adminInfo.role || !adminInfo.role.modules) {
      console.log("No admin info or modules found");
      return;
    }

    const currentPath = location.pathname;

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
    // Close the tab when user confirms the single success popup
    // window.close();
  };

  useEffect(() => {
    fetchContracts();
  }, []);

  const fetchContracts = async () => {
    try {
      const response = await axios.get(
        `${Base_URL}/sales-contracts/${selectedContractId}`
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

  const generatePDF = async (url) => {
    setIsGenerating(true);
    try {
      const originalZoom = zoom;
      setZoom(100); // Ensure proper scaling
      await new Promise((resolve) => setTimeout(resolve, 300));
      console.log("Generate pdf 1");
      const element = componentRef.current;
      // if (!element) throw new Error("Component not found");

      // Wait for all images to load
      const images = Array.from(element.querySelectorAll("img"));
      await Promise.all(
        images.map((img) => {
          if (img.complete) return Promise.resolve();
          return new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
          });
        })
      );
      console.log("Generate pdf 2");
      // Capture content as canvas
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        allowTaint: true,
        scrollY: -window.scrollY,
      });

      const imgData = canvas.toDataURL("image/png");

      // Create PDF
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = 210;
      const pageHeight = 297;
      console.log("Generate pdf 3");
      const imgProps = pdf.getImageProperties(imgData);
      const imgWidth = pageWidth;
      const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

      // Auto-scale image to fit page
      if (imgHeight > pageHeight) {
        const scaledHeight = pageHeight;
        const scaledWidth = (imgProps.width * scaledHeight) / imgProps.height;
        pdf.addImage(
          imgData,
          "PNG",
          (pageWidth - scaledWidth) / 2,
          0,
          scaledWidth,
          scaledHeight
        );
      } else {
        pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
      }
      console.log("Generate pdf 4");

      // Create file
      let fileName = contracts?.contractNo || "document";
      // This is a signing page, so always use 'signed' suffix
      const fileNameWithSuffix = `${fileName}_signed`;
      if (!fileNameWithSuffix.toLowerCase().endsWith(".pdf")) {
        fileName = fileNameWithSuffix + ".pdf";
      } else {
        fileName = fileNameWithSuffix;
      }
      console.log("Generate pdf 5");
      try {
        const pdfBlob = pdf.output("blob");
        const pdfFile = new File([pdfBlob], fileName, {
          type: "application/pdf",
          lastModified: new Date().getTime(),
        });

        const formData = new FormData();
        formData.append("file", pdfFile);
        // if (proformaInvoice) {
        //   const currentYear = new Date().getFullYear()
        //   formData.append("file_path", `${contractDetails?.productInfo?.[0]?.title}/${currentYear}/Customers/${contractDetails.basicInfo?.finalCustomerName}/${contractDetails.contractNo}/Proforma Invoice`)
        // } else {
        //   const currentYear = new Date().getFullYear()
        //   formData.append("file_path", `${contractDetails?.productInfo?.[0]?.title}/${currentYear}/Customers/${contractDetails.basicInfo?.finalCustomerName}/${contractDetails.contractNo}/purchase Contracts`)
        // }
        formData.append("file_path", `Sales Contracts/${contracts.contractNo}`);
        formData.append("business_id", contracts.business);
        formData.append("file_type", "application/pdf");
        formData.append("file_size", pdfFile.size.toString());
        console.log("Generate pdf 6");

        const response = await axios.post(UPLOAD_API_URL, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        if (response.data.message === "File uploaded successfully") {
          notifySuccess(response.data.message || "File uploaded successfully!");
          pdf.save(fileName);

          if (response.data.file.s3Key && contractDetails._id) {
            await axios.put(
              `${Base_URL}/sales-contracts/update-document-customer/${contractDetails._id}`,
              {
                template_id: selectedTemplateId,
                document_url: response.data.file.s3Key,
                document_id: response.data.file._id,
                signature: url,
              }
            );
          }
        }
      } catch (error) {
        console.error("File upload error:", error);
        notifyError("Contract Save Action Failed");
      } finally {
        setZoom(originalZoom);
        setIsGenerating(false);
        setTimeout(() => window.close(), 1000);
      }
    } catch (error) {
      console.error("Error generating PDF:", error);
      notifyError("Failed to generate PDF");
      setZoom(zoom);
      setIsGenerating(false);
    }
  };

  // const generatePDF = async (url) => {
  //   setIsGenerating(true)
  //   try {
  //     const originalZoom = zoom
  //     setZoom(100) // Ensure proper scaling
  //     await new Promise((resolve) => setTimeout(resolve, 300))

  //     const element = componentRef.current

  //     // Wait for all images to load
  //     const images = Array.from(element.querySelectorAll("img"))
  //     await Promise.all(
  //       images.map((img) => {
  //         if (img.complete) return Promise.resolve()
  //         return new Promise((resolve) => {
  //           img.onload = resolve
  //           img.onerror = resolve
  //         })
  //       }),
  //     )

  //     // Capture the content with better settings
  //     const canvas = await html2canvas(element, {
  //       scale: 2,
  //       useCORS: true,
  //       logging: false,
  //       allowTaint: true,
  //       scrollY: -window.scrollY,
  //     })

  //     // Create PDF with A4 format
  //     const pdf = new jsPDF({
  //       orientation: "portrait",
  //       unit: "mm",
  //       format: "a4",
  //     })

  //     // Calculate dimensions while preserving aspect ratio
  //     const imgWidth = 210 // A4 width
  //     const imgHeight = (canvas.height * imgWidth) / canvas.width

  //     // Add image to PDF
  //     pdf.addImage(
  //       canvas.toDataURL("image/png"),
  //       "PNG",
  //       0, // no margin
  //       0, // no margin
  //       imgWidth,
  //       imgHeight,
  //     )

  //     // Handle multi-page if needed
  //     if (imgHeight > 297) {
  //       // A4 height
  //       let remainingHeight = imgHeight
  //       let position = 0

  //       while (remainingHeight > 0) {
  //         position -= 297
  //         remainingHeight -= 297

  //         if (remainingHeight > 0) {
  //           pdf.addPage()
  //           pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, position, imgWidth, imgHeight)
  //         }
  //       }
  //     }

  //     // Generate filename
  //     let fileName = contracts?.contractNo || "document"
  //     if (!fileName.toLowerCase().endsWith(".pdf")) {
  //       fileName += ".pdf"
  //     }

  //     try {
  //       const pdfBlob = pdf.output("blob")
  //       const pdfFile = new File([pdfBlob], fileName, {
  //         type: "application/pdf",
  //         lastModified: new Date().getTime(),
  //       })

  //       const formData = new FormData()
  //       formData.append("file", pdfFile)
  //       // formData.append("uploadedBy", adminInfo.id);
  //       formData.append("file_path", `Sales Contracts/${contracts.contractNo}`)
  //       formData.append("business_id", contracts.business)
  //       formData.append("file_type", "application/pdf")
  //       formData.append("file_size", pdfFile.size.toString())

  //       const response = await axios.post(UPLOAD_API_URL, formData, {
  //         headers: { "Content-Type": "multipart/form-data" },
  //       })

  //       if (response.data.message === "File uploaded successfully") {
  //         notifySuccess(response.data.message || "File uploaded successfully!")
  //         pdf.save(fileName)

  // if (response.data.file.s3Key && contractDetails._id) {
  //   await axios.put(`${Base_URL}/sales-contracts/update-document-customer/${contractDetails._id}`, {
  //     template_id: selectedTemplateId,
  //     document_url: response.data.file.s3Key,
  //     document_id: response.data.file._id,
  //     signature: url,
  //   })
  // }
  //       }
  //     } catch (error) {
  //       console.error("File upload error:", error)
  //       notifyError("Contract Save Action Failed")
  //     } finally {
  //       setZoom(originalZoom)
  //       setIsGenerating(false)
  //       setTimeout(() => {
  //         window.close()
  //       }, 1000)
  //     }
  //   } catch (error) {
  //     console.error("Error generating PDF:", error)
  //     setIsGenerating(false)
  //   }
  // }

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
