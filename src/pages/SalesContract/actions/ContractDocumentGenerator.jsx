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
import { notifySuccess, notifyError } from "@/utils/toast";
import html2canvas from "html2canvas";
import moment from "moment";
import { formatAmount, formatDate } from "@/components/formatAmount";
import { useTranslation } from "react-i18next";
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
  isAdvance,
  advanceAmount,
}) => {
  const { t } = useTranslation();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [contractDetails, setContractDetails] = useState(null);
  const [businessDetails, setBusinessDetails] = useState(null);
  const [templateData, setTemplateData] = useState(null);
  const [renderedHtml, setRenderedHtml] = useState("");
  const [signatureFileURL, setSignatureFileURL] = useState("");
  console.log("contractId", contractId);
  console.log("templateId", templateId);
  console.log("template data", templateData);

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
        console.log("profileResponse", profileResponse);
        setSignatureFileURL(profileResponse.data.signature);
      }

      // Fetch customer details by customer_id
      let customerData = null;
      if (contractResponse.data?.basicInfo?.customer_id) {
        try {
          console.log(
            "customer_id : ",
            contractResponse.data?.basicInfo.customer_id
          );
          const customerResponse = await axios.get(
            `${Base_URL}/customers/${contractResponse.data.basicInfo.customer_id}`
          );
          customerData = customerResponse.data;
          console.log("First Customer data fetched:", customerData);
        } catch (error) {
          console.log("Error fetching customer data:", error);
        }
      }

      let accountTypeName = "";
      if (contractResponse.data?.Account_Info?.accountType) {
        try {
          const accountTypeRes = await axios.get(
            `${Base_URL}/bank-account-types/${contractResponse.data.Account_Info.accountType}`
          );
          accountTypeName = accountTypeRes.data?.name || "";
        } catch (err) {
          console.log("Failed to fetch account type name:", err);
        }
      }
      const BuyerResponse = await axios.get(
        `${Base_URL}/customers/address/${contractResponse.data.basicInfo.finalCustomerId}`
      );

      // Fetch final customer details if it's a Profit Sharing contract
      let finalCustomerData = null;
      if (contractResponse.data?.basicInfo?.finalCustomerId) {
        try {
          const finalCustomerResponse = await axios.get(
            `${Base_URL}/customers/${contractResponse.data.basicInfo.finalCustomerId}`
          );
          finalCustomerData = finalCustomerResponse.data;
          console.log("Final customer data fetched:", finalCustomerData);
        } catch (error) {
          console.log("Error fetching final customer data:", error);
        }
      }

      // Once we have both contract and template data, render the HTML
      if (contractResponse?.data && templateResponse?.data) {
        console.log(
          "businessDataRes.data.data?.image",
          businessDataRes.data.data?.image
        );
        console.log("customerData ", customerData.companyInfo.companyLogo);
        const businessLogo = customerData?.companyInfo?.companyLogo;
        const businessName = customerData?.basicInformation?.companyName || "";
        contractResponse.data.sellerName = businessName;
        contractResponse.data.businessLogo = businessLogo;
        contractResponse.data.businessName = businessName;
        contractResponse.data.supplierSign =
          contractResponse?.data?.approver_signature; //profileResponse.data.signature
        contractResponse.data.BuyerSign = contractResponse.data.signature || "";

        const html = renderTemplateWithContractData(
          templateResponse?.data?.data?.htmlContent,
          contractResponse.data,
          businessDataRes.data.data,
          customerData,
          finalCustomerData,
          accountTypeName,
          BuyerResponse?.data
        );
        setRenderedHtml(html);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      notifyError(
        t("documents.errors.loadTemplateOrContract", {
          defaultValue: "Failed to load template or contract data",
        })
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Update the renderTemplateWithContractData function to properly handle HTML content
  const renderTemplateWithContractData = useCallback(
    (
      templateContent,
      contractData,
      Business,
      customerData,
      finalCustomerData,
      accountTypeName,
      BuyerResponse
    ) => {
      if (!templateContent) {
        return `<!DOCTYPE html><html><head><title>${t("salesContract.contract", {
          defaultValue: "Contract",
        })}</title></head><body><h1>${t("common.error", {
          defaultValue: "Error",
        })}</h1><p>${t("documents.errors.templateContentMissing", {
          defaultValue: "Template content is missing",
        })}</p></body></html>`;
      }

      if (!contractData) {
        return `<!DOCTYPE html><html><head><title>${t("salesContract.contract", {
          defaultValue: "Contract",
        })}</title></head><body><h1>${t("common.error", {
          defaultValue: "Error",
        })}</h1><p>${t("documents.errors.contractDataMissing", {
          defaultValue: "Contract data is missing",
        })}</p></body></html>`;
      }
      console.log("contractData", contractData);
      const businessLogo = contractData?.businessLogo;
      const businessName = contractData?.businessName || "";
      const supplierSign = contractData?.supplierSign;
      const buyerSign = contractData?.customer_signature || "";
      console.log("businessLogo businessLogo", businessLogo);

      function convertTotalInWords(amount) {
        const a = [
          "",
          "One",
          "Two",
          "Three",
          "Four",
          "Five",
          "Six",
          "Seven",
          "Eight",
          "Nine",
          "Ten",
          "Eleven",
          "Twelve",
          "Thirteen",
          "Fourteen",
          "Fifteen",
          "Sixteen",
          "Seventeen",
          "Eighteen",
          "Nineteen",
        ];
        const b = [
          "",
          "",
          "Twenty",
          "Thirty",
          "Forty",
          "Fifty",
          "Sixty",
          "Seventy",
          "Eighty",
          "Ninety",
        ];

        const num = parseFloat(amount);
        if (isNaN(num)) return "Invalid amount";

        if (num === 0) return "Zero";

        function toWords(n) {
          if (n < 20) return a[n];
          if (n < 100)
            return b[Math.floor(n / 10)] + (n % 10 ? " " + a[n % 10] : "");
          if (n < 1000)
            return (
              a[Math.floor(n / 100)] +
              " Hundred" +
              (n % 100 ? " and " + toWords(n % 100) : "")
            );
          if (n < 100000)
            return (
              toWords(Math.floor(n / 1000)) +
              " Thousand" +
              (n % 1000 ? " " + toWords(n % 1000) : "")
            );
          if (n < 10000000)
            return (
              toWords(Math.floor(n / 100000)) +
              " Lakh" +
              (n % 100000 ? " " + toWords(n % 100000) : "")
            );
          return (
            toWords(Math.floor(n / 10000000)) +
            " Crore" +
            (n % 10000000 ? " " + toWords(n % 10000000) : "")
          );
        }

        const [rupees, paise] = num.toFixed(2).split(".");

        let words = `${toWords(parseInt(rupees))} Rupees`;
        if (parseInt(paise) > 0) {
          words += ` and ${toWords(parseInt(paise))} Paise`;
        }

        return words + " Only";
      }

      // Create data object from contract data
      const final_price = formatAmount(
        contractData.productInfo?.[0]?.priceForFinalCustomer *
          contractData.productInfo?.[0]?.quantityMTS *
          contractData.productInfo?.[0]?.quantityFCL
      );
      const data = {
        contract: {
          contractNo:
            contractData?.basicInfo?.salesContractNumberByFirstCustomer || "",
          ref: contractData?.basicInfo?.ref || "",
          date: formatDate(contractData?.basicInfo?.contractCreationDate) || "",
          buyerName:
            finalCustomerData?.basicInformation?.customerDisplayName || "",
          buyerAddress: BuyerResponse || "",
          buyerAddress2:
            contractData.basicInfo?.customerAddress
              ?.split("\n")
              .slice(1)
              .join(", ") || "",
          grade:
            contractData.productInfo?.[0]?.title +
              " " +
              contractData.productInfo?.[0]?.grade || "",
          goods_description: contractData.productInfo?.[0]?.title || "",
          totalInWords: convertTotalInWords(
            isAdvance
              ? advanceAmount
              : contractData.productInfo?.[0]?.totalValue || ""
          ),
          quantity: isAdvance
            ? 1
            : contractData.productInfo?.[0]?.quantityMTS +
                "MTS (At " +
                contractData.productInfo?.[0]?.quantityMTS +
                "MTS x " +
                contractData.productInfo?.[0]?.containerType +
                " of " +
                contractData.productInfo?.[0]?.quantityFCL +
                " FCL)" || "",
          price:
            formatAmount(
              contractData.productInfo?.[0]?.priceForFinalCustomer
            ) || "",
          totalValue: final_price || "",
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
            accountName:
              customerData?.principleBankers?.[0]?.accountHolderName || "",
            accountNumber:
              customerData?.principleBankers?.[0]?.bankAccount || "",
            accountType: customerData?.principleBankers?.[0]?.accountType || "",
            bankName: customerData?.principleBankers?.[0]?.bankName || "",
            bankAddress: customerData?.principleBankers?.[0]?.address || "",
            swiftCode: customerData?.principleBankers?.[0]?.swiftCode || "",
          },
          remarks: contractData.productInfo?.[0]?.remarks || "",
          sellerName: businessName,
          business: {
            address: customerData?.companyInfo?.registeredAddress || "",
            tel: customerData?.companyInfo?.phone || "",
            fax: customerData?.companyInfo?.fax || "",
          },
          businessLogo: businessLogo,
          supplierSign: buyerSign,
          BuyerSign: "",
        },
      };
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
    [t]
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

      notifySuccess(
        t("documents.savedSuccessfully", {
          defaultValue: "Document saved successfully!",
        })
      );
      onClose();
    } catch (error) {
      console.error("Error generating PDF:", error);
      notifyError(
        t("documents.errors.generatePdf", {
          defaultValue: "Failed to generate PDF: {{message}}",
          message: error.message,
        })
      );
      setIsGenerating(false);
    }
  };
  console.log("contractDetails generator", contractDetails);

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
          {templateData?.name ||
            t("documents.contractPreview", {
              defaultValue: "Contract Preview",
            })}
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
                {t("salesContract.contract", { defaultValue: "Contract" })}:{" "}
                {contractDetails?.contractNo || t("common.notAvailable", { defaultValue: "N/A" })}
              </Typography>
              <Typography variant="caption" className="text-gray-500">
                {t("documents.template", { defaultValue: "Template" })}:{" "}
                {templateData?.name || t("common.notAvailable", { defaultValue: "N/A" })}
              </Typography>
            </Box>
            <div className="border-0 overflow-hidden">
              <div className="bg-white p-0">
                <iframe
                  id="document-preview"
                  srcDoc={renderedHtml}
                  className="w-full min-h-[700px] border-0"
                  title={t("documents.preview", { defaultValue: "Document Preview" })}
                />
              </div>
            </div>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        {uploadSign ? (
          <>
            {!customer_signature && (
              <Button
                onClick={onUpload}
                variant="outlined"
                startIcon={<Print />}
                disabled={isLoading || isGenerating}
              >
                {t("documents.addSignature", { defaultValue: "Add Signature" })}
              </Button>
            )}
            {customer_signature && (
              <Button
                onClick={generatePDF}
                variant="outlined"
                startIcon={<Print />}
                disabled={isLoading || isGenerating}
              >
                {t("documents.saveUpload", { defaultValue: "Save Upload" })}
              </Button>
            )}
          </>
        ) : (
          <>
            <Button
              onClick={generatePDF}
              variant="contained"
              color="primary"
              disabled={isLoading || isGenerating}
              startIcon={
                isGenerating ? <CircularProgress size={16} /> : <Download />
              }
            >
              {isGenerating
                ? t("documents.downloading", { defaultValue: "Downloading..." })
                : t("salesContract.actions.downloadProfitSharingContract", {
                    defaultValue: "Download Profit Sharing Contract",
                  })}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default DocumentGenerator;
