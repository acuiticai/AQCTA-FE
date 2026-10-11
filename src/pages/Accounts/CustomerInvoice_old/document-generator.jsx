"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  CircularProgress,
  Typography,
} from "@mui/material";
import { Close as CloseIcon, Download, Print } from "@mui/icons-material";
import jsPDF from "jspdf";
import axios from "axios";
import moment from "moment";
import { notifySuccess, notifyError } from "@/utils/toast";
import html2canvas from "html2canvas";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const DocumentGenerator = ({
  open,
  onClose,
  uploadSign,
  customer_signature,
  proformaInvoice,
  onUpload,
  templateId,
  contractId,
  adminInfo,
  business_id,
  onSuccess,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [contractDetails, setContractDetails] = useState(null);
  const [businessDetails, setBusinessDetails] = useState(null);
  const [templateData, setTemplateData] = useState(null);
  const [renderedHtml, setRenderedHtml] = useState("");
  const [signatureFileURL, setSignatureFileURL] = useState("");
  console.log("contractId", contractId);
  console.log("templateId", templateId);

  // Fetch contract and template data when dialog opens
  useEffect(() => {
    if (open && contractId && templateId) {
      fetchData();
    }
  }, [open, contractId, templateId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch contract details
      const contractResponse = await axios.get(
        `${Base_URL}/sales-contracts/${contractId}`
      );
      setContractDetails(contractResponse.data);

      // Fetch template details
      console.log("business_id", business_id);
      const businessDataRes = await axios.get(
        `${Base_URL}/business/${business_id}`
      );
      console.log("business Data Res", businessDataRes.data.data);
      setBusinessDetails(businessDataRes.data.data);

      const templateResponse = await axios.get(
        `${Base_URL}/document-templates/${templateId.split(":")[0]}`
      );
      setTemplateData(templateResponse.data);

      // Fetch admin signature
      const profileResponse = await axios.get(
        `${Base_URL}/admin/profile/${adminInfo.id}`
      );
      if (profileResponse.data.signature) {
        setSignatureFileURL(profileResponse.data.signature);
      }

      // Once we have both contract and template data, render the HTML
      if (contractResponse.data && templateResponse.data) {
        console.log(
          "businessDataRes.data.data?.image",
          businessDataRes.data.data?.image
        );
        const businessLogo = `${businessDataRes.data.data?.image}`;
        const businessName = businessDataRes.data.data?.name || "";
        contractResponse.data.sellerName = businessName;
        contractResponse.data.businessLogo = businessLogo;
        contractResponse.data.businessName = businessName;
        contractResponse.data.supplierSign = contractResponse?.data
          ?.approver_signature
          ? `${contractResponse?.data?.approver_signature}`
          : profileResponse.data.signature
          ? `${profileResponse.data.signature}`
          : "";
        contractResponse.data.BuyerSign =
          `${contractResponse.data.signature}` || "";
        const html = renderTemplateWithContractData(
          templateResponse?.data?.data?.htmlContent,
          contractResponse.data,
          businessDataRes.data.data
        );
        setRenderedHtml(html);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      notifyError("Failed to load template or contract data");
    } finally {
      setIsLoading(false);
    }
  };

  // Update the renderTemplateWithContractData function to properly handle HTML content
  const renderTemplateWithContractData = useCallback(
    (templateContent, contractData, Business) => {
      if (!templateContent) {
        return "<!DOCTYPE html><html><head><title>Contract</title></head><body><h1>Error</h1><p>Template content is missing</p></body></html>";
      }

      if (!contractData) {
        return "<!DOCTYPE html><html><head><title>Contract</title></head><body><h1>Error</h1><p>Contract data is missing</p></body></html>";
      }
      console.log("contractData", contractData);
      const businessLogo = `${contractData?.businessLogo}`;
      const businessName = contractData?.businessName || "";
      const supplierSign = contractData?.supplierSign || "";
      const buyerSign = `${contractData?.customer_signature}` || "";

      // Create data object from contract data
      const data = {
        contract: {
          ref: contractData.contractNo || "",
          date: new Date(contractData.createdAt).toLocaleDateString() || "",
          buyerName: contractData.basicInfo?.finalCustomerName || "",
          buyerAddress:
            contractData.basicInfo?.customerAddress?.split("\n")[0] || "",
          buyerAddress2:
            contractData.basicInfo?.customerAddress
              ?.split("\n")
              .slice(1)
              .join(", ") || "",
          grade: contractData.productInfo?.[0]?.title || "",
          quantity: contractData.productInfo?.[0]?.quantityMTS || "",
          price: contractData.productInfo?.[0]?.price || "",
          totalValue: contractData.productInfo?.[0]?.totalValue || "",
          shippingTerms: contractData.productInfo?.[0]?.shippingTerms || "",
          packing: contractData.productInfo?.[0]?.packing || "",
          etdPort: contractData.basicInfo?.etdPort || "",
          ETD_Port:
            moment(contractData.basicInfo?.ETD_Port).format("MMM YYYY") || "",
          origin_country: contractData.basicInfo?.origin_country || "",
          port_of_loading: contractData.basicInfo?.port_of_loading || "",
          port_of_discharge: contractData.basicInfo?.port_of_discharge || "",
          payment: contractData.productInfo?.[0]?.paymentTerms || "",
          terms: contractData.productInfo?.[0]?.shippingTerms || "",
          Account_Info: {
            accountName: contractData?.Account_Info?.accountName || "",
            accountNumber: contractData?.Account_Info?.accountNumber || "",
            accountType: contractData?.Account_Info?.accountType || "",
            bankName: contractData?.Account_Info?.bankName || "",
            bankAddress: contractData?.Account_Info?.bankAddress || "",
            swiftCode: contractData?.Account_Info?.swiftCode || "",
          },
          remarks: contractData.basicInfo?.remarks || "",
          sellerName: businessName,
          business: {
            address: Business?.address || "",
            tel: Business?.tel || "",
            fax: Business?.fax || "",
          },
          businessLogo: businessLogo,
          supplierSign: supplierSign,
          BuyerSign: buyerSign,
        },
      };
      console.log("EJS template data ", data);
      // Simple EJS template processing
      let processedTemplate = templateContent;

      // Replace logo URL in the template
      processedTemplate = processedTemplate.replace(
        /<img src="[^"]*" alt="PCI Group Logo">/g,
        `<img src="${businessLogo}" alt="${businessName} Logo">`
      );

      // Replace <%= variable %> patterns (escaped HTML)
      processedTemplate = processedTemplate.replace(
        /<%= ?([\w.]+) ?%>/g,
        (match, variable) => {
          // Handle nested properties like "contract.ref"
          const props = variable.split(".");
          let value = data;

          for (const prop of props) {
            value = value?.[prop];
            if (value === undefined) return "[" + variable + "]";
          }

          // Escape HTML for regular variables
          if (typeof value === "string") {
            return value
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#039;");
          }

          return value;
        }
      );

      // Replace <%- variable %> patterns (unescaped HTML)
      processedTemplate = processedTemplate.replace(
        /<%- ?([\w.]+) ?%>/g,
        (match, variable) => {
          // Handle nested properties like "contract.ref"
          const props = variable.split(".");
          let value = data;

          for (const prop of props) {
            value = value?.[prop];
            if (value === undefined) return "[" + variable + "]";
          }

          // Return raw HTML for these variables
          return value || "";
        }
      );

      // Modify the signature sections to hide them when no signatures are available
      const parser = new DOMParser();
      const doc = parser.parseFromString(processedTemplate, "text/html");

      // Get both signature containers
      const buyerSignImg = doc.querySelector(
        ".signature-box:first-child .logo img"
      );
      const sellerSignImg = doc.querySelector(
        ".signature-box:last-child .logo img"
      );
      const buyerSignBox = buyerSignImg?.closest(".logo");
      const sellerSignBox = sellerSignImg?.closest(".logo");

      // Set a consistent height for signatures
      const signatureHeight = "80px";

      // Case 1: Both signatures available - make them the same height
      if (buyerSign && supplierSign) {
        if (buyerSignImg) buyerSignImg.style.height = signatureHeight;
        if (sellerSignImg) sellerSignImg.style.height = signatureHeight;
      }
      // Case 2: Only buyer signature available
      else if (buyerSign && !supplierSign) {
        if (buyerSignImg) buyerSignImg.style.height = signatureHeight;
        if (sellerSignBox) {
          sellerSignBox.innerHTML = ""; // Clear the img
          sellerSignBox.style.height = signatureHeight;
          sellerSignBox.style.display = "block";
        }
      }
      // Case 3: Only seller signature available
      else if (!buyerSign && supplierSign) {
        if (sellerSignImg) sellerSignImg.style.height = signatureHeight;
        if (buyerSignBox) {
          buyerSignBox.innerHTML = ""; // Clear the img
          buyerSignBox.style.height = signatureHeight;
          buyerSignBox.style.display = "block";
        }
      }
      // Case 4: No signatures available - already handled by hiding both

      return doc.documentElement.outerHTML;
    },
    []
  );

  const generatePDF = async () => {
    setIsGenerating(true);
    try {
      const iframe = document.getElementById("document-preview");
      if (!iframe || !iframe.contentWindow)
        throw new Error("Preview iframe not found");

      // Give the iframe a moment to fully render
      await new Promise((resolve) => setTimeout(resolve, 500));

      const element = iframe.contentWindow.document.body;

      // Direct approach with optimized settings
      const canvas = await html2canvas(element, {
        scale: 2, // Good balance between quality and performance
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      const imgData = canvas.toDataURL("image/jpeg", 1.0);

      // Create PDF with A4 dimensions (in points)
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "a4",
      });

      // A4 dimensions in points (72 dpi)
      const pageWidth = 595;
      const pageHeight = 842;

      // Add image to fill the entire page with no margins
      pdf.addImage(imgData, "JPEG", 0, 0, pageWidth, pageHeight);

      // Create file
      const fileName = contractDetails?.contractNo || "document";
      // Add suffix to differentiate between initial and signed documents
      const fileNameWithSuffix = uploadSign
        ? `${fileName}_signed`
        : `${fileName}_initial`;
      const fullFileName = fileNameWithSuffix.toLowerCase().endsWith(".pdf")
        ? fileNameWithSuffix
        : `${fileNameWithSuffix}.pdf`;
      const pdfBlob = pdf.output("blob");
      const pdfFile = new File([pdfBlob], fullFileName, {
        type: "application/pdf",
        lastModified: new Date().getTime(),
      });

      // Save locally first for immediate feedback
      const link = document.createElement("a");
      link.href = URL.createObjectURL(pdfBlob);
      link.download = fullFileName;
      link.click();

      // Then upload to server
      await uploadPDFToServer(pdfFile);
    } catch (error) {
      console.error("Error generating PDF:", error);
      notifyError("Failed to generate PDF: " + error.message);
      setIsGenerating(false);
    }
  };
  console.log("contractDetails generator", contractDetails);
  const uploadPDFToServer = async (pdfFile) => {
    try {
      const formData = new FormData();
      formData.append("file", pdfFile);
      formData.append("uploadedBy", adminInfo.id);
      if (proformaInvoice) {
        const currentYear = new Date().getFullYear();
        formData.append(
          "file_path",
          `${contractDetails?.productInfo?.[0]?.title}/${currentYear}/Customers/${contractDetails.basicInfo?.finalCustomerName}/${contractDetails.contractNo}/Proforma Invoice`
        );
      } else {
        const currentYear = new Date().getFullYear();
        formData.append(
          "file_path",
          `${contractDetails?.productInfo?.[0]?.title}/${currentYear}/Customers/${contractDetails.basicInfo?.finalCustomerName}/${contractDetails.contractNo}/Sales Contracts`
        );
      }
      formData.append("business_id", contractDetails.business);
      formData.append("file_type", "application/pdf");
      formData.append("file_size", pdfFile.size.toString());

      const response = await axios.post(
        `${Base_URL}/documents/uploadDocument`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      if (!proformaInvoice) {
        if (response.data.message === "File uploaded successfully") {
          if (response.data.file.s3Key && contractDetails._id) {
            if (uploadSign) {
              await axios.put(
                `${Base_URL}/sales-contracts/update-document-customer/${contractDetails._id}`,
                {
                  template_id: templateId,
                  document_url: response.data.file.s3Key,
                  document_id: response.data.file._id,
                  signature: signatureFileURL,
                }
              );
            } else {
              await axios.put(
                `${Base_URL}/sales-contracts/add-document-details/${contractDetails._id}`,
                {
                  template_id: templateId.split(":")[0],
                  document_url: response.data.file.s3Key,
                  document_id: response.data.file._id,
                  signature: signatureFileURL,
                }
              );
            }
          }
          notifySuccess("Document generated and saved successfully!");
          if (onSuccess) onSuccess(response.data);
          onClose();
        }
      } else {
        if (onSuccess) onSuccess(response.data);
      }
    } catch (error) {
      console.error("Error uploading PDF:", error);
      notifyError("PDF generated but failed to upload: " + error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    const iframe = document.getElementById("document-preview");
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      PaperProps={{
        style: {
          maxHeight: "90vh",
          width: "90%",
          margin: "0 auto",
        },
      }}
    >
      <DialogTitle className="flex justify-between items-center">
        <Typography variant="h6">
          {templateData?.name || "Document Preview"}
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers style={{ padding: 0 }}>
        {isLoading ? (
          <Box className="flex justify-center items-center h-[600px]">
            <CircularProgress />
          </Box>
        ) : (
          <Box className="bg-white rounded-lg overflow-hidden">
            <Box className="p-4 bg-gray-100 border-b flex justify-between items-center">
              <Typography variant="subtitle1">
                Contract: {contractDetails?.contractNo || "N/A"}
              </Typography>
              <Typography variant="caption" className="text-gray-500">
                Template: {templateData?.name || "N/A"}
              </Typography>
            </Box>
            <div className="border-0 overflow-hidden">
              <div className="bg-white p-0">
                <iframe
                  id="document-preview"
                  srcDoc={renderedHtml}
                  className="w-full min-h-[700px] border-0"
                  title="Document Preview"
                />
              </div>
            </div>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        {uploadSign ? (
          <>
            <Button
              onClick={onUpload}
              variant="outlined"
              startIcon={<Print />}
              disabled={isLoading || isGenerating}
            >
              Add Signature
            </Button>
            {customer_signature && (
              <Button
                onClick={generatePDF}
                variant="outlined"
                startIcon={<Print />}
                disabled={isLoading || isGenerating}
              >
                Save Upload
              </Button>
            )}
          </>
        ) : (
          <>
            <Button
              onClick={handlePrint}
              variant="outlined"
              startIcon={<Print />}
              disabled={isLoading || isGenerating}
            >
              Print
            </Button>
            <Button
              onClick={generatePDF}
              variant="contained"
              color="primary"
              disabled={isLoading || isGenerating}
              startIcon={
                isGenerating ? <CircularProgress size={16} /> : <Download />
              }
            >
              {isGenerating ? "Generating..." : "Generate & Save PDF"}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default DocumentGenerator;
