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
import { formatDate } from "@/components/formatAmount";

const formatDisplayDate = (value) =>
  value ? formatDate(value) : formatDate(new Date());

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const DocumentGenerator = ({
  open,
  onClose,
  uploadSign,
  customer_signature,
  proformaInvoice,
  onUpload,
  templateId,
  templateData,
  invoiceData,
  businessData,
  adminInfo,
  business_id,
  contract,
  vendorAccount,
  contractDetails,
  onSuccess,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [businessDetails, setBusinessDetails] = useState(null);
  const [renderedHtml, setRenderedHtml] = useState("");
  const [signatureFileURL, setSignatureFileURL] = useState("");
  console.log("invoice data", invoiceData)
  console.log("contract", contract)
  console.log("template data", templateData)

  useEffect(() => {
    if (open && templateId) {
      fetchData();
    }
  }, [open, templateId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      if (!templateData) throw new Error("No template selected");
      if (!business_id && !businessData)
        throw new Error("No business selected");

      let businessDetailsObj = businessData;
      if (!businessDetailsObj && business_id) {
        const businessDataRes = await axios.get(
          `${Base_URL}/business/${business_id}`
        );
        businessDetailsObj = businessDataRes.data.data;
        setBusinessDetails(businessDetailsObj);
      }

      if (!businessDetailsObj) throw new Error("Business data not found");

      const profileResponse = await axios.get(
        `${Base_URL}/admin/profile/${adminInfo.id}`
      );
      if (profileResponse.data.signature) {
        setSignatureFileURL(profileResponse.data.signature);
      }

      const html = renderTemplateWithInvoiceData(
        templateData?.htmlContent,
        invoiceData,
        businessDetailsObj,
        profileResponse.data.signature
      );
      setRenderedHtml(html);
    } catch (error) {
      console.error("Error fetching data:", error);
      notifyError(error.message || "Failed to load template or business data");
    } finally {
      setIsLoading(false);
    }
  };

  const mapInvoiceToContract = (invoiceData, business) => {
    const items = invoiceData.items || [];
    const totalQuantity = items.reduce(
      (sum, item) => sum + (parseFloat(item.quantity) || 0),
      0
    );
    const totalAmount = items.reduce(
      (sum, item) => sum + (parseFloat(item.total) || 0),
      0
    );

    const productInfo = contract?.productInfo?.[0] || {};

    return {
      ref:
        invoiceData.invoiceNumber ||
        invoiceData.invoice_number ||
        contract?.contractNo ||
        "",
      contract_no:
        invoiceData.salesContractNumber ||
        invoiceData.contract_no ||
        contract?.contractNo ||
        contract?.ref ||
        "",
      buyerName: invoiceData.vendor || invoiceData.vendor_name || "",
      buyerAddress: invoiceData.billingAddress || "",
      date: formatDisplayDate(
        invoiceData.invoiceDate || invoiceData.invoice_date,
      ),
      payment: invoiceData.terms || "",
      quantity: totalQuantity.toString(),
      goods_description: items.map((item) => item.description).join(", "),
      price: items[0]?.unitPrice || 0,
      totalValue: totalAmount,
      totalInWords: "",
      Account_Info: {
        accountName: vendorAccount?.accountName || "",
        accountNumber: vendorAccount?.accountNumber || "",
        accountType: vendorAccount?.accountType?.name || "",
        bankName: vendorAccount?.bankName || "",
        bankAddress: vendorAccount?.bankAddress || "",
        swiftCode: vendorAccount?.swiftCode || "",
        iban: vendorAccount?.iban || "",
        currencyType: vendorAccount?.currencyType || "",
        bankType: vendorAccount?.bankType || "",
        openingBalance: vendorAccount?.openingBalance || 0,
      },
      sellerName: business?.name || "",
      terms: invoiceData?.terms || "",
      remarks: contract?.basicInfo?.remarks || contract?.remarks || "",
      ETD_Port:  moment(contract?.basicInfo?.ETD_Port).format("MMM YYYY") || "",
      port_of_discharge:
        contract?.basicInfo?.port_of_discharge ||
        contract?.port_of_discharge ||
        "",
      port_of_loading:
        contract?.basicInfo?.port_of_loading || contract?.port_of_loading || "",
      origin_country:
        contract?.basicInfo?.origin_country || contract?.origin_country || "",
      business: {
        tel: business?.tel || "",
        fax: business?.fax || "",
        name: business?.name || "",
        address: business?.address || "",
      },
      validity_date_pi: formatDisplayDate(invoiceData.dueDate),
      buyer_ref: contract?.contractNo || "",
      seller_ref: invoiceData.invoiceNumber || "",
      consigneeName: invoiceData.vendor || "",
      consigneeAddress: invoiceData.billingAddress || "",
      consignee_tel: invoiceData.phoneNumber || "",
      consignee_fax: invoiceData.faxNumber || "",
      consignee_commercial_id: "",
      buyer_tel: invoiceData.phoneNumber || "",
      buyer_fax: invoiceData.faxNumber || "",
      buyer_commercial_id: "",
      country_of_Beneficiary: contract?.basicInfo?.origin_country || "",
      country_of_origin: contract?.basicInfo?.origin_country || "",
      country_of_destination: contract?.basicInfo?.port_of_discharge || "",
      transaction_currency: invoiceData.currency || "USD",
      shipping_description_of_goods: productInfo?.packing || "",
      Total_Net_KGS: totalQuantity.toString(),
      Commodity: productInfo?.productType || "",
      kind_of_standard: productInfo?.productType || "",
      origin: contract?.basicInfo?.origin_country || "",
      new_wt: totalQuantity.toString(),
      discount: invoiceData.discountAmount || 0,
      freight_charges: invoiceData.shippingCharges || 0,
      other_expenditures: invoiceData.adjustment || 0,
      total_amount_due: invoiceData.total || totalAmount,
      issuance_place_and_date: `${
        business?.address || ""
      }, ${formatDisplayDate(new Date())}`,
      otherTerms: productInfo?.shippingTerms || "",
      businessLogo: business?.image || "",
      ntn_no: contract?.ntn_no || "",
      import_contact_no: contract?.import_contact_no || "",
      date_of_issue: contract?.date_of_issue || "",
      shippingTerms:
        contract?.productInfo?.[0]?.shippingTerms ||
        contract?.shippingTerms ||
        "",
      items: items.map((item, index) => ({
        item: index + 1,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
      })),
    };
  };

  const renderTemplateWithInvoiceData = useCallback(
    (templateContent, invoiceData, business, adminSignature) => {
      if (!templateContent || !invoiceData) {
        return "<!DOCTYPE html><html><head><title>Error</title></head><body><h1>Error</h1><p>Missing required data</p></body></html>";
      }

      const contract = mapInvoiceToContract(invoiceData, business);
      console.log("logo!!", contract.businessLogo);
      let processedTemplate = templateContent;

      // Replace <%= contract.xxx %> and <%- contract.xxx %>
      processedTemplate = processedTemplate.replace(
        /<%[-=] ?contract\.([\w.]+) ?%>/g,
        (match, variable) => {
          const props = variable.split(".");
          let value = contract;
          for (const prop of props) {
            value = value?.[prop];
            if (value === undefined) return `[contract.${variable}]`;
          }
          return value;
        }
      );

      // Replace logo URL
      const businessLogo = `${business?.image}`;
      const businessName = business?.name || "";
      processedTemplate = processedTemplate.replace(
        /<img src="[^"]*" alt="[^"]*">/g,
        `<img src="${businessLogo}" alt="${businessName} Logo">`
      );

      // Handle signature display
      const parser = new DOMParser();
      const doc = parser.parseFromString(processedTemplate, "text/html");
      const signatureImg = doc.querySelector(".signature-box .logo img");
      const signatureBox = signatureImg?.closest(".logo");

      if (signatureBox) {
        if (adminSignature) {
          if (signatureImg) {
            signatureImg.src = adminSignature;
            signatureImg.style.height = "80px";
          }
        } else {
          signatureBox.innerHTML = "";
          signatureBox.style.height = "80px";
          signatureBox.style.display = "block";
        }
      }

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

      await new Promise((resolve) => setTimeout(resolve, 500));
      const element = iframe.contentWindow.document.body;

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      const imgData = canvas.toDataURL("image/jpeg", 1.0);
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "a4",
      });

      const pageWidth = 595;
      const pageHeight = 842;
      pdf.addImage(imgData, "JPEG", 0, 0, pageWidth, pageHeight);

      const fileName = invoiceData?.invoice_number || "document";
      const fullFileName = fileName.toLowerCase().endsWith(".pdf")
        ? fileName
        : `${fileName}.pdf`;
      const pdfBlob = pdf.output("blob");
      const pdfFile = new File([pdfBlob], fullFileName, {
        type: "application/pdf",
        lastModified: new Date().getTime(),
      });

      const link = document.createElement("a");
      link.href = URL.createObjectURL(pdfBlob);
      link.download = fullFileName;
      link.click();

      await uploadPDFToServer(pdfFile);
    } catch (error) {
      console.error("Error generating PDF:", error);
      notifyError("Failed to generate PDF: " + error.message);
      setIsGenerating(false);
    }
  };

  const uploadPDFToServer = async (pdfFile) => {
    try {
      const formData = new FormData();
      formData.append("file", pdfFile);
      formData.append("uploadedBy", adminInfo.id);
      formData.append(
        "file_path",
        `${invoiceData?.title}/${new Date().getFullYear()}/Customers/${
          invoiceData.vendor
        }/${invoiceData.invoice_number}/Purchase Contract`
      );
      formData.append("business_id", invoiceData.business);
      formData.append("file_type", "application/pdf");
      formData.append("file_size", pdfFile.size.toString());

      const response = await axios.post(
        `${Base_URL}/documents/uploadDocument`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      if (response.data.message === "File uploaded successfully") {
        if (response.data.file.s3Key && invoiceData._id) {
          if (uploadSign) {
            await axios.put(
              `${Base_URL}/sales-contracts/update-document-customer/${invoiceData._id}`,
              {
                template_id: templateId,
                document_url: response.data.file.s3Key,
                document_id: response.data.file._id,
                signature: signatureFileURL,
              }
            );
          } else {
            await axios.put(
              `${Base_URL}/sales-contracts/add-document-details/${invoiceData._id}`,
              {
                template_id: templateId,
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
    } catch (error) {
      console.error("Error uploading PDF:", error);
      // notifyError("PDF generated but failed to upload: " + error.message);
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

  if (!contractDetails || !contract) {
    return (
      <div style={{ padding: 40, color: "red" }}>
        Missing contract or contract details. Please select a contract and try
        again.
      </div>
    );
  }

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
                Invoice: {invoiceData?.invoice_number || "N/A"}
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
            {!customer_signature && (
              <Button
                onClick={onUpload}
                variant="outlined"
                startIcon={<Print />}
                disabled={isLoading || isGenerating}
              >
                Add Signature
              </Button>
            )}
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
