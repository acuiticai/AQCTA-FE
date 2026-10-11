"use client";
import { useState, useEffect, useContext, useRef } from "react";
import { ChevronDown, Upload } from "lucide-react";
import { useHistory, useLocation } from "react-router-dom";
import axios from "axios";
import { formatAmount } from "@/components/formatAmount";
import { AdminContext } from "@/context/AdminContext";
import CustomDatePicker from "@/components/CustomDatePicker";
import DocumentTemplateModal from "../actions/DocumentTemplateModal";
import DocumentGenerator from "../../Accounts/CustomerInvoice/document-generator";
import { notifyError, notifySuccess } from "@/utils/toast";
import DocumentViewer from "../../Accounts/CustomerInvoice/document-viewer";
import { useTranslation } from "react-i18next";
// import DocumentTemplateModal from "./PerformaTemplateModal.jsx";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

// Move stripHtml function to the top, before any usage
const stripHtml = (html) => {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.body.textContent || "";
};

export default function InvoicePage({}) {
  const { t } = useTranslation();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const history = useHistory();
  const { state } = useContext(AdminContext);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { adminInfo } = state;
  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo.token}`,
  };
  const [Data, setData] = useState([]);
  const [discount, setDiscount] = useState("0");
  const [shippingCharges, setShippingCharges] = useState("0");
  const [adjustment, setAdjustment] = useState("0");
  const [CustomerData, setCustomerData] = useState([]);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date());
  const [dueDate, setDueDate] = useState(new Date());
  const [selectedContractId, setSelectedContractId] = useState(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [selectedContractNo, setSelectedContractNo] = useState("");
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [business_id, setBusinesss_id] = useState(null);
  const [DocumentData, setDocumentData] = useState({});
  const [supportingDocument, setSupportingDocument] = useState(null);
  console.log("location.state?.contractId", location.state?.contractId);
  console.log("DocumentData", DocumentData);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [isAdvance, setIsAdvance] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState(0);

  useEffect(() => {
    fetchData();
    generateInvoiceNumber();
  }, [location.state?.contractId]);

  const fetchData = async () => {
    if (!location.state?.contractId) return;
    setLoading(true);
    try {
      const response = await axios.get(
        `${Base_URL}/sales-contracts/${location.state?.contractId}`,
        { headers }
      );
      setData(response.data);
      setBusinesss_id(response.data?.business);
      // setError(null);
      fetchCustomerData(response?.data?.basicInfo?.customer_id);
    } catch (err) {
      // setError('Failed to fetch items');
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomerData = async (customer_id) => {
    if (!customer_id) return;
    setLoading(true);
    try {
      const response = await axios.get(`${Base_URL}/customers/${customer_id}`, {
        headers,
      });
      setCustomerData(response.data);
      // setError(null);
    } catch (err) {
      // setError('Failed to fetch items');
    } finally {
      setLoading(false);
    }
  };

  const generateInvoiceNumber = async () => {
    try {
      const response = await axios.get(`${Base_URL}/invoices/latest`, {
        headers,
      });
      const lastInvoiceNumber =
        response.data?.latestInvoiceNumber || "INV-0006540";
      const lastNumber = Number.parseInt(lastInvoiceNumber.split("-")[1], 10);
      const newInvoiceNumber = `INV-${(lastNumber + 1)
        .toString()
        .padStart(7, "0")}`;
      setInvoiceNumber(newInvoiceNumber);
    } catch (err) {
      console.error("Failed to fetch latest invoice number", err);
      // Fallback to random number if fetching fails
      const randomInvoice = `INV-000${Math.floor(Math.random() * 10000)}`;
      setInvoiceNumber(randomInvoice);
    }
  };

  // Calculate totals
  const calculateSubTotal = () => {
    if (!Data?.productInfo?.length) return 0;
    return Data.productInfo.reduce((total, item) => total + item.totalValue, 0);
  };

  // Function to render advance payment section (same as CreateCustomerInvoice)
  const renderAdvancePaymentSection = () => (
    <div className="mb-6 p-4 bg-gray-50 rounded-lg">
      <h3 className="text-lg font-semibold mb-4">
        {t("salesContract.invoice.advancePaymentDetails", {
          defaultValue: "Advance Payment Details",
        })}
      </h3>
      <div className="flex items-center mb-2">
        <input
          type="checkbox"
          checked={isAdvance}
          onChange={(e) => {
            setIsAdvance(e.target.checked);
            if (!e.target.checked) setAdvanceAmount(0);
            else setAdvanceAmount(calculateSubTotal());
          }}
          className="mr-2"
        />
        <span>
          {t("salesContract.invoice.isAdvancePayment", {
            defaultValue: "Is this an advance payment?",
          })}
        </span>
      </div>
      {isAdvance && (
        <div>
          <label className="block text-gray-700 mb-2">
            {t("salesContract.invoice.advanceAmount", { defaultValue: "Advance Amount" })}
          </label>
          <input
            type="number"
            value={advanceAmount}
            onChange={(e) => setAdvanceAmount(Number(e.target.value) || 0)}
            className="w-full p-3 border border-gray-300 rounded-lg"
            min={0}
            max={calculateSubTotal()}
          />
        </div>
      )}
    </div>
  );

  // Calculate items and totals based on advance payment
  const items = isAdvance
    ? [
        {
          description: "Advance Payment",
          quantity: 1,
          unitPrice: advanceAmount,
          total: advanceAmount,
        },
      ]
    : Data?.productInfo?.map((product) => ({
        title: product.title,
        quantity: product.quantityMTS,
        description: stripHtml(product.shippingTerms) || "",
        unitPrice: product.price,
        total: product.totalValue,
      })) || [];
  const subtotal = items.reduce((sum, item) => sum + (item.total || 0), 0);
  const discountAmount = (Number.parseFloat(discount) / 100) * subtotal;
  const totalWithDiscount = subtotal - discountAmount;
  const shippingAmount = Number.parseFloat(shippingCharges) || 0;
  const adjustmentAmount = Number.parseFloat(adjustment) || 0;
  const grandTotal = totalWithDiscount + shippingAmount + adjustmentAmount;

  // Submit invoice function
  const submitInvoice = async (status) => {
    setLoading(true);
    try {
      console.log("invoiceDate", invoiceDate);
      const invoiceData = {
        invoiceType: "Proforma",
        invoice_number: invoiceNumber,
        customer_id: CustomerData?._id,
        customer_name: CustomerData?.basicInformation?.customerDisplayName,
        customer_email: CustomerData?.basicInformation?.customerEmail,
        contract_id: location.state?.contractId,
        contract_no: Data?.contractNo,
        contract_password: Data?.contract_password, // Add contract password
        business_id: business_id,
        invoice_date: new Date(invoiceDate),
        due_date: new Date(dueDate),
        items,
        subTotal: subtotal,
        discount: Number.parseFloat(discount),
        discountAmount,
        documentUrl: DocumentData?.s3Key,
        shippingCharges: Number.parseFloat(shippingCharges),
        adjustment: Number.parseFloat(adjustment),
        grandTotal,
        status: status, // "draft" or "generated"
        billingAddress: CustomerData?.companyInfo?.billingAddress,
        terms: stripHtml(Data?.productInfo?.[0]?.shippingTerms),
        supportingDocument: supportingDocument,
        templateId: selectedTemplateId, // Invoice template ID (NOT contract template)
        module: "customer-invoices",
        isAdvancePayment: isAdvance,
        advanceAmount: isAdvance ? advanceAmount : 0,
        originalContractAmount: subtotal,
        remainingAmount: isAdvance ? subtotal - advanceAmount : subtotal,
      };

      if (status === "draft") {
        // For draft, proceed with the API call as before
        const response = await axios.post(
          `${Base_URL}/proforma-invoice`,
          invoiceData,
          { headers }
        );

        // Redirect to invoice list after successful creation
        if (response.data) {
          history.push({
            pathname: "/view-sales-contract",
            state: { contractId: location.state?.contractId },
          });
        }
      } else if (status === "generated") {
        // For "generated" status, navigate to the email preview page
        // with the invoice data instead of submitting directly
        setLoading(false);
        history.push({
          pathname: "/email-preview",
          state: { invoiceData },
        });
        return;
      }
    } catch (err) {
      console.error("Failed to create invoice", err);
      // You might want to add error handling/notification here
    } finally {
      setLoading(false);
    }
  };

  const handleGenerationSuccess = (data) => {
    console.log("Document generated and saved successfully!", data);
    setIsGeneratorOpen(false);
    setDocumentData(data.file);
    notifySuccess("Document generated Now Create Invoice!");
  };
  const handleGenerateDocument = ({ templateId, contractId }) => {
    // console.log("Generating document:", {
    //   templateId,
    //   contractId,
    //   // selectedBusiness,
    // });
    // if (contractId)
    //   history.push(`/edit-document-template/${templateId}:${contractId}`);
    // // Add your document generation logic here
    setSelectedTemplateId(templateId);
    setSelectedContractId(contractId);
    setIsGeneratorOpen(true);
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Get current date
  const getCurrentDate = () => {
    const date = new Date();
    return date.toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };
  console.log("CustomerData", CustomerData);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      // Start upload process
      setUploading(true);
      setUploadSuccess(false);

      // Prepare form data for upload
      const formDataForUpload = new FormData();
      formDataForUpload.append("file_path", `Invoices/${invoiceNumber}`);
      formDataForUpload.append("business_id", business_id);
      formDataForUpload.append("customer_id", adminInfo?.id);
      formDataForUpload.append("file_type", file.type);
      formDataForUpload.append("file_size", file.size);
      formDataForUpload.append("file", file);

      try {
        const response = await axios.post(
          `${Base_URL}/documents/uploadDocument`,
          formDataForUpload,
          {
            headers: { "Content-Type": "multipart/form-data" },
            onUploadProgress: (progressEvent) => {
              const percentCompleted = Math.round(
                (progressEvent.loaded * 100) / progressEvent.total
              );
              setUploadProgress(percentCompleted);
            },
          }
        );

        if (response.data.message === "File uploaded successfully") {
          const uploadedFile = response.data.file;

          // Update the form data with the uploaded document information
          setSupportingDocument({
            fileId: uploadedFile._id,
            name: uploadedFile.name,
            url: uploadedFile.url || "#",
            downloadUrl: uploadedFile.downloadUrl || "#",
            uploadedAt: new Date().toISOString(),
            size: file.size,
            type: file.type,
          });

          // Show success message in UI
          setSuccessMessage(
            response.data.message || "File uploaded successfully!"
          );
          setUploadSuccess(true);

          // Auto-hide success message after 3 seconds
          setTimeout(() => {
            setUploadSuccess(false);
            setSuccessMessage("");
          }, 3000);
        }
      } catch (error) {
        console.error("File upload error:", error);
        notifyError("File upload failed. Please try again.");
      } finally {
        setUploading(false);
        setUploadProgress(0);
      }
    }
  };

  const handleOpenFile = async (documentId) => {
    if (!documentId) return;

    try {
      let response = await axios.get(
        `${Base_URL}/documents/getFileWithAllData/${documentId}`
      );
      window.open(response.data.data.url, "_blank");
    } catch (error) {
      alert("Error getting file");
      console.log("Error: ", error);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Back button */}
      <div
        onClick={() => {
          history.push({
            pathname: "/view-sales-contract",
            state: { contractId: location.state?.contractId },
          });
        }}
        className="mb-8"
      >
        <button className="flex items-center text-gray-700 text-sm">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mr-2"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          {t("common.back", { defaultValue: "Back" })}
        </button>
      </div>

      {/* Invoice Title */}
      <h1 className="text-2xl font-medium mb-8">
        {t("salesContract.invoice.newInvoice", { defaultValue: "New Invoice" })}
      </h1>

      {/* Customer Information */}
      <div className="bg-[#f0f9f6] p-8 rounded-lg mb-8">
        <div className="mb-6">
          <div className="mb-2 text-base">
            {t("common.customerName", { defaultValue: "Customer Name" })}
          </div>
          <div className="relative">
            <div className="flex justify-between items-center bg-white border border-gray-200 rounded-md p-4">
              <span>{CustomerData?.basicInformation?.customerDisplayName}</span>
              <ChevronDown className="h-5 w-5 text-gray-400" />
            </div>
          </div>
        </div>

        <div>
          <div className="text-gray-500 text-sm mb-2">
            {t("salesContract.invoice.billingAddress", { defaultValue: "Billing Address" })}
          </div>
          <div className="text-gray-800 text-sm">
            {CustomerData?.companyInfo?.billingAddress}
          </div>
          <div className="text-gray-800 text-sm mt-1">
            {t("common.phone", { defaultValue: "Phone" })}:{" "}
            {CustomerData?.basicInformation?.customerPhone?.workPhone}
          </div>
          <div className="text-gray-800 text-sm mt-1">
            {t("common.faxNumber", { defaultValue: "Fax Number" })}:{" "}
            {CustomerData?.basicInformation?.customerPhone?.mobile}
          </div>
        </div>
      </div>

      {/* Invoice Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <div className="text-gray-500 text-sm mb-2">
            {t("salesContract.invoice.invoiceNumber", { defaultValue: "Invoice Number" })}
          </div>
          <div className="bg-[#3c3c3c] text-white p-4 rounded-md w-full">
            {invoiceNumber}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div>
          <div className="text-gray-500 text-sm mb-2">
            {t("salesContract.invoice.invoiceDate", { defaultValue: "Invoice Date" })}
          </div>
          <CustomDatePicker
            value={invoiceDate}
            onChange={(date) => setInvoiceDate(date)}
            bgColor="#F5F5F5"
          />
        </div>

        <div>
          <div className="text-gray-500 text-sm mb-2">
            {t("common.terms", { defaultValue: "Terms" })}
          </div>
          <div className="flex justify-between items-center bg-[#f5f5f5] p-2 rounded-md relative group">
            <div className="max-h-12 overflow-hidden group-hover:overflow-y-auto p-2 w-full pr-6 scrollbar-hide">
              <span className="text-sm text-gray-500">
                {stripHtml(Data?.productInfo?.[0]?.paymentTerms)}
              </span>
            </div>
            <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          </div>
        </div>

        <div>
          <div className="text-gray-500 text-sm mb-2">
            {t("salesContract.invoice.dueDate", { defaultValue: "Due Date" })}
          </div>
          <CustomDatePicker
            value={dueDate}
            onChange={(date) => setDueDate(date)}
            bgColor="#F5F5F5"
          />
        </div>
      </div>

      {renderAdvancePaymentSection()}

      {/* Item Table */}
      <div className="mb-10">
        <h2 className="text-lg font-medium mb-4">
          {t("salesContract.invoice.itemTable", { defaultValue: "Item Table" })}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#f5f5f5]">
                <th className="text-left p-4 font-normal text-sm text-gray-600 border-b border-gray-200">
                  {t("common.item", { defaultValue: "Item" })}
                </th>
                <th className="text-left p-4 font-normal text-sm text-gray-600 border-b border-gray-200">
                  {t("common.quantityMetricTons", { defaultValue: "QTY(MT)" })}
                </th>
                <th className="text-left p-4 font-normal text-sm text-gray-600 border-b border-gray-200">
                  {t("salesContract.invoice.goodsDescription", {
                    defaultValue: "Description of Goods",
                  })}
                </th>
                <th className="text-left p-4 font-normal text-sm text-gray-600 border-b border-gray-200">
                  {t("salesContract.invoice.unitPriceUsdMt", {
                    defaultValue: "Unit Price (USD/MT)",
                  })}
                </th>
                <th className="text-left p-4 font-normal text-sm text-gray-600 border-b border-gray-200">
                  {t("salesContract.invoice.totalUsd", { defaultValue: "Total (USD)" })}
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index} className="border-b border-gray-100">
                  <td className="p-4 text-sm">{index + 1}</td>
                  <td className="p-4 text-sm">{item.quantity.toFixed(2)}</td>
                  <td className="p-4 text-sm">
                    <div>{item.title}</div>
                    <div className="text-gray-500">{item.description}</div>
                  </td>
                  <td className="p-4 text-sm">
                    {formatAmount(item.unitPrice)}
                  </td>
                  <td className="p-4 text-sm">{formatAmount(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Document and Summary */}
      <div className="flex flex-col space-y-8">
        {/* Supporting Documents and Financial Summary in a better layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Supporting Documents Section */}
          <div className="mb-6">
            <h3 className="text-gray-600 mb-2">
              {t("documents.supportingDocument", {
                defaultValue: "Supporting Document (File)",
              })}
            </h3>
            <div className="border border-dashed border-[var(--p-blue)] rounded-lg p-8 text-center">
              <input
                type="file"
                name="supportingDocument"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
                ref={fileInputRef}
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center justify-center"
              >
                <div className="w-12 h-12 rounded-full bg-[#f0fbf7] flex items-center justify-center mb-2">
                  <Upload className="text-[var(--p-blue)]" size={20} />
                </div>
                <span className="text-[var(--p-blue)]">
                  {uploading
                    ? t("documents.uploading", { defaultValue: "Uploading..." })
                    : t("documents.uploadDocument", { defaultValue: "Upload Document" })}
                </span>
              </label>
            </div>

            {uploadSuccess && (
              <div className="mt-2 text-sm text-green-600">
                {successMessage}
              </div>
            )}

            {supportingDocument && (
              <div className="mt-3 p-3 bg-gray-50 rounded-md">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">
                    {supportingDocument.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleOpenFile(supportingDocument.fileId)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    {t("common.view", { defaultValue: "View" })}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Financial Summary Section */}
          <div className="bg-[#f9f9f9] p-6 rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <div className="text-gray-600 text-sm">
                {t("common.subTotal", { defaultValue: "Sub Total" })}
              </div>
              <div className="font-semibold">${formatAmount(subtotal)}</div>
            </div>

            <div className="flex justify-between items-center mb-4">
              <div className="text-gray-600 text-sm">
                {t("common.discount", { defaultValue: "Discount" })}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="w-16 bg-[#f1f1f1] border border-gray-200 rounded-md p-2 text-right text-sm"
                />
                <span className="text-sm">%</span>
                <span className="w-24 text-right font-semibold">
                  ${formatAmount(discountAmount)}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center mb-4">
              <div className="text-gray-600 text-sm">
                {t("salesContract.invoice.shippingCharges", {
                  defaultValue: "Shipping Charges",
                })}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={shippingCharges}
                  onChange={(e) => setShippingCharges(e.target.value)}
                  className="w-24 bg-[#f1f1f1] border border-gray-200 rounded-md p-2 text-right text-sm"
                />
                <span className="w-24 text-right font-semibold">
                  ${formatAmount(shippingAmount)}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center mb-4">
              <div className="text-gray-600 text-sm">
                {t("salesContract.invoice.adjustment", { defaultValue: "Adjustment" })}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={adjustment}
                  onChange={(e) => setAdjustment(e.target.value)}
                  className="w-24 bg-[#f1f1f1] border border-gray-200 rounded-md p-2 text-right text-sm"
                />
                <span className="w-24 text-right font-semibold">
                  ${formatAmount(adjustmentAmount)}
                </span>
              </div>
            </div>

            <div className="border-t border-gray-300 pt-4 mt-4">
              <div className="flex justify-between items-center">
                <div className="font-semibold">
                  {t("salesContract.invoice.totalMyr", { defaultValue: "Total (MYR)" })}
                </div>
                <div className="font-semibold text-xl">
                  {formatAmount(grandTotal)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Template */}
      <div className="flex items-center mb-8 text-sm">
        <div className="text-gray-600 mr-2">
          {t("documents.template", { defaultValue: "Template" })}:
        </div>
        <a
          style={{ cursor: "pointer" }}
          onClick={() => {
            setIsModalOpen(true);
          }}
          className="text-[#bcd351]"
        >
          {t("documents.chooseTemplate", { defaultValue: "Choose Template" })}
        </a>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-4">
        <button
          className="px-8 py-3 bg-[#f5f5f5] rounded-md text-sm"
          onClick={() => history.goBack()}
        >
          {t("common.cancel", { defaultValue: "Cancel" })}
        </button>
        <div className="relative">
          <button
            className="px-8 py-3 bg-[#f5f5f5] rounded-md flex items-center text-sm"
            onClick={() => submitInvoice("draft")}
            disabled={loading}
          >
            {loading
              ? t("common.saving", { defaultValue: "Saving..." })
              : t("salesContract.invoice.saveAsDraft", { defaultValue: "Save as Draft" })}
            <ChevronDown className="ml-2 h-5 w-5" />
          </button>
        </div>
        <div className="relative">
          <button
            className="px-8 py-3 bg-[#bcd351] text-white rounded-md flex items-center text-sm"
            onClick={() => submitInvoice("generated")}
            disabled={loading}
          >
            {loading
              ? t("common.processing", { defaultValue: "Processing..." })
              : t("salesContract.invoice.saveAndSend", { defaultValue: "Save and Send" })}
            <ChevronDown className="ml-2 h-5 w-5" />
          </button>
        </div>
      </div>
      {/* <DocumentTemplateModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
        }}
        contractId={location.state?.contractId}
        onSubmit={handleGenerateDocument}
      /> */}
      <DocumentTemplateModal
        isOpen={isModalOpen}
        type="Proforma Invoice"
        onClose={() => {
          setIsModalOpen(false);
          // setSelectedContractId(null)
        }}
        contractId={location.state?.contractId}
        // contractId={selectedContractId}

        onSubmit={handleGenerateDocument}
      />
      {isGeneratorOpen && (
        <DocumentGenerator
          open={isGeneratorOpen}
          onClose={() => setIsGeneratorOpen(false)}
          templateId={selectedTemplateId}
          contractId={selectedContractId}
          business_id={business_id}
          adminInfo={adminInfo}
          proformaInvoice={true}
          onSuccess={handleGenerationSuccess}
          isAdvance={isAdvance}
          advanceAmount={advanceAmount}
        />
      )}
      {isViewerOpen && (
        <DocumentViewer
          business_id={business_id}
          open={isViewerOpen}
          onClose={() => setIsViewerOpen(false)}
          documentUrl={documentUrl}
          contractNo={selectedContractNo}
        />
      )}
    </div>
  );
}
