"use client";

import { useRef, useState, useContext, useEffect } from "react";
import {
  Box,
  Card,
  CardContent,
  Button,
  Paper,
  Slider,
  Stack,
  IconButton,
  Typography,
  Container,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
} from "@mui/material";
import { useHistory } from "react-router-dom";
import { Printer, ZoomIn, ZoomOut, Lock } from "lucide-react";
import { notifyError, notifySuccess } from "@/utils/toast";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useDocumentConext } from "@/pages/DocumentTemplate/DocumentContext";
import TemplateHeader from "./sections/HeaderSection";
import DocumentContent from "./sections/DocumentContent";
import SignatureTab from "./SignatureCustomer";
import DynamicTable from "@/pages/DocumentTemplate/components/templates-subcomponents/TableDynamic";
import PaymentAccountInfo, {
  ItemListDocumentSection,
} from "@/pages/DocumentTemplate/components/templates-subcomponents/PaymentSectionProforma";
import TermsAndConditions from "@/pages/DocumentTemplate/components/templates-subcomponents/TermsAndCondition";
import {
  shippingDetails,
  tableFooter,
  terms,
  remarks,
} from "@/pages/DocumentTemplate/data/data-index";
import axios from "axios";
import { useParams } from "react-router-dom/cjs/react-router-dom.min";
import { AdminContext } from "@/context/AdminContext";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const SalesContractPage = () => {
  const componentRef = useRef();
  const [zoom, setZoom] = useState(100);
  const [isGenerating, setIsGenerating] = useState(false);
  const history = useHistory();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("draw");
  const [signatureFile, setSignatureFile] = useState(null);
  const [signatureFileURL, setSignatureFileURL] = useState("");
  const signaturePadRef = useRef(null);

  // Password protection states
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(true);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [alreadySignedDialogOpen, setAlreadySignedDialogOpen] = useState(false);

  const UPLOAD_API_URL = `${Base_URL}/documents/uploadDocument`;
  const {
    documentType,
    requireTable,
    requireContent,
    tableValues,
    FooterText,
    FooterText2,
    signees,
    tableFields,
    contractDetails,
    selectedTemplateId,
  } = useDocumentConext();
  const { id: neededIds } = useParams();

  const tableColumns = tableFields?.map((field) => field.name) || [];
  const tableData =
    tableValues?.map((row) =>
      tableFields?.map((field) => row.values[field.id])
    ) || [];

  const [documents, setDocuments] = useState();

  // Check if contract is already signed when component mounts
  useEffect(() => {
    if (contractDetails?.customer_signature && isAuthenticated) {
      setAlreadySignedDialogOpen(true);
    }
  }, [contractDetails, isAuthenticated]);

  const handlePasswordSubmit = () => {
    // Check if the entered password matches the one in contractDetails
    if (
      contractDetails?.contract_password &&
      password === contractDetails.contract_password
    ) {
      setIsAuthenticated(true);
      setPasswordDialogOpen(false);
      setPasswordError(false);

      // Check if contract is already signed
      if (contractDetails?.customer_signature) {
        setAlreadySignedDialogOpen(true);
      }
    } else {
      setPasswordError(true);
    }
  };

  const handleCloseAlreadySignedDialog = () => {
    setAlreadySignedDialogOpen(false);
    // Close the page after showing the dialog
    setTimeout(() => {
      window.close();
    }, 500);
  };

  const handleZoomChange = (event, newValue) => {
    setZoom(newValue);
  };

  const handleSignatureSave = (url) => {
    setSignatureFileURL(url); // Store updated signature URL
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 10, 200));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 10, 50));
  };

  const handleSignatureDialogOpen = () => {
    setSignatureDialogOpen(true);
  };

  const handleSignatureDialogClose = () => {
    setSignatureDialogOpen(false);
  };

  const handleClearSignature = () => {
    if (activeTab === "draw") {
      signaturePadRef.current?.clear();
    } else {
      setSignatureFile(null);
      setSignatureFileURL("");
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setSignatureFile(file);
    const formData = new FormData();
    formData.append("image", file);

    try {
      const response = await axios.post(`${Base_URL}/upload`, formData);
      setSignatureFileURL(response.data.url);
    } catch (error) {
      console.error("Failed to upload signature:", error);
      notifyError("Failed to upload signature");
    }
  };

  const convertSignatureToPng = async () => {
    return new Promise((resolve) => {
      if (signaturePadRef.current?.isEmpty()) {
        resolve(null);
        return;
      }

      const canvas = signaturePadRef.current.getCanvas();
      canvas.toBlob((blob) => {
        const signatureFile = new File([blob], "signature.png", {
          type: "image/png",
        });
        resolve(signatureFile);
      }, "image/png");
    });
  };

  const uploadSignature = async (file) => {
    if (!file) return null;

    const formData = new FormData();
    formData.append("image", file);

    try {
      const response = await axios.post(`${Base_URL}/upload`, formData);
      return response.data.url;
    } catch (error) {
      console.error("Failed to upload signature:", error);
      notifyError("Failed to upload signature");
      return null;
    }
  };

  const generatePDF = async () => {
    setIsGenerating(true);
    try {
      const originalZoom = zoom;
      setZoom(100); // Ensure proper scaling
      await new Promise((resolve) => setTimeout(resolve, 300));

      const element = componentRef.current;

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

      // Capture the content with better settings
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        allowTaint: true,
        scrollY: -window.scrollY,
      });

      // Create PDF with A4 format
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      // Calculate dimensions while preserving aspect ratio
      const imgWidth = 210; // A4 width
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // Add image to PDF
      pdf.addImage(
        canvas.toDataURL("image/png"),
        "PNG",
        0, // no margin
        0, // no margin
        imgWidth,
        imgHeight
      );

      // Handle multi-page if needed
      if (imgHeight > 297) {
        // A4 height
        let remainingHeight = imgHeight;
        let position = 0;

        while (remainingHeight > 0) {
          position -= 297;
          remainingHeight -= 297;

          if (remainingHeight > 0) {
            pdf.addPage();
            pdf.addImage(
              canvas.toDataURL("image/png"),
              "PNG",
              0,
              position,
              imgWidth,
              imgHeight
            );
          }
        }
      }

      // Generate filename
      let fileName = contractDetails?.contractNo || "document";
      // This is a signing page, so always use 'signed' suffix
      const fileNameWithSuffix = `${fileName}_signed`;
      if (!fileNameWithSuffix.toLowerCase().endsWith(".pdf")) {
        fileName = fileNameWithSuffix + ".pdf";
      } else {
        fileName = fileNameWithSuffix;
      }

      try {
        const pdfBlob = pdf.output("blob");
        const pdfFile = new File([pdfBlob], fileName, {
          type: "application/pdf",
          lastModified: new Date().getTime(),
        });

        const formData = new FormData();
        formData.append("file", pdfFile);
        // formData.append("uploadedBy", adminInfo.id);
        formData.append(
          "file_path",
          `Sales Contracts/${contractDetails.contractNo}`
        );
        formData.append("business_id", contractDetails.business);
        formData.append("file_type", "application/pdf");
        formData.append("file_size", pdfFile.size.toString());

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
                signature: signatureFileURL,
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
        setTimeout(() => {
          window.close();
        }, 1000);
      }
    } catch (error) {
      console.error("Error generating PDF:", error);
      setIsGenerating(false);
    }
  };

  const handleSignatureConfirm = async () => {
    let signatureUrl = null;

    if (signatureFileURL) {
      // Use the already uploaded file URL
      signatureUrl = signatureFileURL;
    } else if (activeTab === "draw" && !signaturePadRef.current?.isEmpty()) {
      // Convert signature pad to blob and upload
      const signatureFile = await convertSignatureToPng();
      signatureUrl = await uploadSignature(signatureFile);
    } else {
      notifyError("Please upload or draw a signature");
      return;
    }

    if (signatureUrl) {
      setSignatureFileURL(signatureUrl);
      setSignatureDialogOpen(false);
      // Call generatePDF after getting the signature
      setTimeout(() => {
        generatePDF();
      }, 500);
    }
  };

  const RenderSignatureBlocks = () => (
    <div className="w-full px-4 sm:px-6 lg:px-8 mt-1 mb-1">
      <div className="grid grid-cols-2 gap-8 text-left">
        {signees.map((signee, index) => (
          <div key={index} className="flex flex-col items-start">
            <span className="text-sm text-gray-700">{signee.title}</span>
            {signee.name && (
              <span className="text-sm font-bold text-gray-900">
                {signee.name}
              </span>
            )}

            {contractDetails &&
              signee.title.toLowerCase().includes("seller") &&
              (contractDetails?.approver_signature ? (
                <img
                  src={`${contractDetails?.accounts_signature}`}
                  alt="Signature"
                  className="max-h-24"
                />
              ) : (
                <div className="h-20" />
              ))}
            {contractDetails &&
              signee.title.toLowerCase().includes("buyer") &&
              (signatureFileURL ? (
                <img
                  src={`${signatureFileURL}`}
                  alt="Signature"
                  className="max-h-20"
                />
              ) : (
                <div className="h-20" />
              ))}

            <div className="w-full border-t border-black my-2" />
            {signee.title.toLowerCase().includes("seller") ? (
              <span className="text-sm italic text-gray-700">
                Authorized Signatory
              </span>
            ) : (
              <span className="text-sm text-gray-700">(sign & stamp)</span>
            )}
          </div>
        ))}
      </div>

      {/* Ensure FooterText is part of the captured content */}
      {FooterText && (
        <div className="text-center text-sm text-gray-900 mt-1">
          <strong>{FooterText}</strong>
        </div>
      )}
      {FooterText2 && (
        <div className="text-center text-sm text-gray-900 mt-1">
          <strong>{FooterText2}</strong>
        </div>
      )}
    </div>
  );

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
    <Container
      maxWidth="lg"
      className="py-4 max-h-[100vh] overflow-y-auto pb-[120px]"
    >
      {/* Already Signed Dialog */}
      <Dialog
        open={alreadySignedDialogOpen}
        onClose={handleCloseAlreadySignedDialog}
        aria-labelledby="already-signed-dialog-title"
      >
        <DialogTitle id="already-signed-dialog-title">
          Contract Already Approved
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            This contract has already been signed and approved. No further
            action is required.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleCloseAlreadySignedDialog}
            variant="contained"
            className="bg-lime-500 hover:bg-lime-600"
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Box className="bg-slate-50 rounded-lg p-4 shadow-sm ">
        <Card className="mb-4 bg-white shadow-sm">
          <CardContent className="py-2">
            <Stack direction="row" spacing={2} alignItems="center">
              <IconButton
                onClick={handleZoomOut}
                className="hover:bg-slate-100"
                disabled={isGenerating}
                size="small"
              >
                <ZoomOut className="w-4 h-4" />
              </IconButton>

              <Slider
                value={zoom}
                onChange={handleZoomChange}
                min={50}
                max={200}
                step={10}
                disabled={isGenerating}
                className="max-w-40"
                size="small"
                sx={{
                  "& .MuiSlider-thumb": { bgcolor: "#84cc16" },
                  "& .MuiSlider-track": { bgcolor: "#84cc16" },
                }}
              />

              <IconButton
                onClick={handleZoomIn}
                className="hover:bg-slate-100"
                disabled={isGenerating}
                size="small"
              >
                <ZoomIn className="w-4 h-4" />
              </IconButton>

              <Typography className="min-w-10 text-slate-600 text-[10px]">
                {zoom}%
              </Typography>

              <Box sx={{ flexGrow: 1 }} />

              {contractDetails &&
                !signatureFileURL &&
                !contractDetails?.customer_signature && (
                  <>
                    <Button
                      onClick={handleSignatureDialogOpen}
                      variant="contained"
                      disabled={isGenerating}
                      className="bg-lime-500 hover:bg-lime-600 shadow-lime-200 text-[10px] py-1"
                      size="small"
                      startIcon={<Printer className="w-3 h-3" />}
                    >
                      {isGenerating ? "Adding..." : "Add Signature"}
                    </Button>
                  </>
                )}
              {signatureFileURL && (
                <>
                  <Button
                    onClick={generatePDF}
                    variant="contained"
                    disabled={isGenerating}
                    className="bg-lime-500 hover:bg-lime-600 shadow-lime-200 text-[10px] py-1"
                    size="small"
                    startIcon={<Printer className="w-3 h-3" />}
                  >
                    {isGenerating
                      ? "Uploading..."
                      : "Upload Sign & Verify Contract"}
                  </Button>
                </>
              )}
            </Stack>
          </CardContent>
        </Card>
        <Box className="bg-slate-200 rounded-lg p-4 overflow-auto min-h-[700px] flex justify-center">
          <div
            className="relative w-[24cm] h-[29.7cm]"
            style={{
              transform: `scale(${zoom / 100})`,
              transformOrigin: "top center",
            }}
          >
            <Paper
              elevation={3}
              className="absolute inset-0 bg-white shadow-lg overflow-hidden"
            >
              <div
                ref={componentRef}
                className="p-4 text-[12px] leading-snug max-w-[95%] mx-auto"
              >
                {documentType && (
                  <>
                    <TemplateHeader />
                    {requireTable &&
                      tableColumns.length > 0 &&
                      tableData.length > 0 && (
                        <div className="text-[12px] leading-tight">
                          <DynamicTable
                            columns={tableColumns}
                            tableData={tableData}
                            {...tableFooter}
                          />
                          <PaymentAccountInfo title="PLEASE MAKE THE PAYMENT TO BELOW ACCOUNT INFO" />
                        </div>
                      )}

                    {requireContent && (
                      <div className="text-[12px] leading-tight">
                        <DocumentContent />
                      </div>
                    )}

                    <div className="text-[12px] leading-tight">
                      <TermsAndConditions
                        terms={
                          contractDetails
                            ? [
                                `${contractDetails?.productInfo[0]?.paymentTerms}`,
                                `${contractDetails?.productInfo[0]?.shippingTerms}`,
                              ]
                            : terms
                        }
                      />
                      <TermsAndConditions
                        sectionTitle="Remarks"
                        terms={contractDetails?.basicInfo?.remarks}
                      />
                    </div>

                    <div className="mx-4 mb-1 text-[12px] leading-tight">
                      <ItemListDocumentSection details={shippingDetails} />
                    </div>
                  </>
                )}
                <RenderSignatureBlocks />
              </div>
            </Paper>
          </div>
        </Box>
      </Box>
      {signatureDialogOpen && (
        <SignatureTab
          contractId={contractDetails._id}
          onSignatureSave={handleSignatureSave}
          onClose={() => {
            handleSignatureDialogClose();
          }}
        />
      )}
    </Container>
  );
};

export default SalesContractPage;
