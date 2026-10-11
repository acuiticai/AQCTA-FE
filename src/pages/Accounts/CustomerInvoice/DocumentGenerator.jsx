"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
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
import { formatDate } from "@/components/formatAmount";

const formatDisplayDate = (value) =>
  value ? formatDate(value) : formatDate(new Date());
import moment from "moment";
import ejs from "ejs";
import {
  numberToWords,
  processCommercialInvoiceTemplate,
  formatInvoiceDateYMD,
} from "@/utils/invoiceTemplateProcessor";
import {
  rewriteInvoiceTemplateForDisplayLabels,
  calculateOrderDiscountPercentage,
  resolveOrderLineItemAndDescription,
  isSaleOrderDocumentTemplateType,
  isWorkOrderDocumentTemplateType,
  normalizeDocumentTemplateType,
  mapToSaleOrderTemplateData,
  buildOrderDocumentItemsRowsHtml,
} from "@/utils/invoiceContractMapper";
import { WORK_ORDER_TEMPLATE_HTML } from "@/utils/workOrderTemplate";
import { fetchPdfPayload } from "@/services/customFieldServices";
import {
  applyFullPdfCustomFieldsToHtml,
  buildInlinePdfCustomFieldsPayload,
  replaceLineItemsTbodyRowsHtml,
} from "@/utils/customFieldsPdf";
import { getModuleLabel } from "@/utils/moduleLabels";
import { applyContractPlaceholdersInPlace } from "@/utils/invoicePlaceholderResolver";
import { customerInvoiceText as ciText } from "@/utils/customerInvoiceI18n";
import { resolveDocumentCompanyBranding } from "@/config/aqctaIdentity";
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
  accountTypeName,
  contractDetails,
  onSuccess,
  /** Persisted document id — loads custom field PDF payload from API (header + line items). */
  savedRecordIdForPdf = null,
  pdfModule = "sales",
  pdfScreen = "invoice",
  /** When no saved id yet, pass definitions + values from the form (see buildInlinePdfCustomFieldsPayload). */
  inlinePdfCustomFieldsPayload = null,
  documentCustomFieldDefinitions = [],
  documentCustomFieldValues = {},
  lineItemCustomFieldDefinitions = [],
}) => {
  useTranslation();
  console.log("document generator invoiceData", invoiceData);
  console.log("document generator");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [businessDetails, setBusinessDetails] = useState(null);
  const [fullTemplateData, setFullTemplateData] = useState(null);
  const [renderedHtml, setRenderedHtml] = useState("");
  const [signatureFileURL, setSignatureFileURL] = useState("");

  const normalizeSignatureUrl = (value) => {
    if (!value || typeof value !== "string") return "";
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (trimmed.startsWith("//")) return `https:${trimmed}`;
    const base = (Base_URL || "").replace(/\/$/, "");
    const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    return `${base}${path}`;
  };

  console.log("template data", templateData);
  console.log("contract", contract);
  console.log("invoiceData", invoiceData);
  console.log("businessData", businessData);
  console.log("templateId!", templateId);
  console.log("accountTypeName", accountTypeName);

  // Fetch template and business data when dialog opens or when accountTypeName changes
  useEffect(() => {
    if (open && templateId) {
      fetchData();
    }
  }, [open, templateId, accountTypeName]);

  // Only fetch and set data, do not render template here
  const fetchData = async () => {
    setIsLoading(true);
    try {
      if (!templateData) throw new Error(ciText("No template selected"));
      if (!business_id && !businessData)
        throw new Error(ciText("No business selected"));

      // Check if template has htmlContent, if not fetch full template
      let fullTemplateData = templateData;
      if (!templateData.htmlContent && templateId) {
        console.log("Template missing htmlContent, fetching full template...");
        try {
          const templateResponse = await axios.get(
            `${Base_URL}/document-templates/${templateId}`
          );
          if (templateResponse.data?.data?.htmlContent) {
            fullTemplateData = {
              ...templateData,
              htmlContent: templateResponse.data.data.htmlContent,
            };
            console.log("Full template fetched with htmlContent");
          }
        } catch (templateError) {
          console.warn("Failed to fetch full template:", templateError);
          // Continue with existing templateData
        }
      }

      let businessDetailsObj = businessData;
      if (!businessDetailsObj && business_id) {
        const businessDataRes = await axios.get(
          `${Base_URL}/business/${business_id}`
        );
        businessDetailsObj = businessDataRes.data.data;
        setBusinessDetails(businessDetailsObj);
      } else {
        setBusinessDetails(businessDetailsObj);
      }
      if (!businessDetailsObj)
        throw new Error(ciText("Business data not found"));

      // Fetch admin signature
      const profileResponse = await axios.get(
        `${Base_URL}/admin/profile/${adminInfo.id}`,
        {
          headers: adminInfo?.token
            ? { authorization: `Bearer ${adminInfo.token}` }
            : undefined,
        }
      );
      const resolvedSignature = normalizeSignatureUrl(
        profileResponse?.data?.signature ||
          invoiceData?.signature ||
          invoiceData?.approver_signature ||
          invoiceData?.authorizedSignature ||
          ""
      );
      setSignatureFileURL(resolvedSignature);

      // Update fullTemplateData state if we fetched it
      if (fullTemplateData !== templateData) {
        setFullTemplateData(fullTemplateData);
        console.log("Full template data stored:", {
          hasHtmlContent: !!fullTemplateData.htmlContent,
          htmlContentLength: fullTemplateData.htmlContent?.length,
        });
      } else {
        // If templateData already has htmlContent, use it
        setFullTemplateData(templateData);
      }

      // Do NOT render template here
    } catch (error) {
      console.error("Error fetching data:", error);
      notifyError(
        error.message || ciText("Failed to load template or business data"),
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Render the template when all required data is available
  useEffect(() => {
    // Use fullTemplateData if available, otherwise fall back to templateData prop
    const templateToUse = fullTemplateData || templateData;

    console.log("Rendering check:", {
      hasTemplateData: !!templateData,
      hasFullTemplateData: !!fullTemplateData,
      hasHtmlContent: !!templateToUse?.htmlContent,
      htmlContentLength: templateToUse?.htmlContent?.length,
      hasInvoiceData: !!invoiceData,
      hasBusinessDetails: !!businessDetails,
      accountTypeName: accountTypeName,
      signatureFileURL: signatureFileURL,
    });

    if (
      templateToUse &&
      templateToUse?.htmlContent &&
      invoiceData &&
      businessDetails &&
      signatureFileURL !== undefined // allow empty string (accountTypeName is optional)
    ) {
      console.log("All conditions met, rendering template...");
      const html = renderTemplateWithInvoiceData(
        templateToUse.htmlContent,
        invoiceData,
        businessDetails,
        signatureFileURL
      );
      console.log("Rendered HTML length:", html?.length);

      let cancelled = false;
      (async () => {
        let next = html;
        const bid =
          business_id ||
          businessDetails?._id ||
          invoiceData?.business ||
          businessData?._id;
        const authHeaders = adminInfo?.token
          ? { authorization: `Bearer ${adminInfo.token}` }
          : undefined;
        try {
          let headerRows = [];
          let line_items = null;

          if (bid && savedRecordIdForPdf) {
            try {
              const payload = await fetchPdfPayload(
                {
                  businessId: bid,
                  module: pdfModule,
                  screen: pdfScreen,
                  recordId: String(savedRecordIdForPdf),
                },
                authHeaders
              );
              headerRows = payload.rows || [];
              line_items = payload.line_items || null;
            } catch (fetchErr) {
              console.warn("Custom fields PDF fetch (DocumentGenerator):", fetchErr);
            }
          }

          const builtFromForm = buildInlinePdfCustomFieldsPayload({
            documentFieldDefinitions: documentCustomFieldDefinitions || [],
            documentFieldValues: documentCustomFieldValues || {},
            lineItemDefinitions: lineItemCustomFieldDefinitions || [],
            items: invoiceData?.items || [],
          });
          if (builtFromForm) {
            if (builtFromForm.headerRows?.length) headerRows = builtFromForm.headerRows;
            if (builtFromForm.line_items?.rows?.length) line_items = builtFromForm.line_items;
          }

          if (inlinePdfCustomFieldsPayload) {
            const i = inlinePdfCustomFieldsPayload;
            if (i.headerRows?.length) headerRows = i.headerRows;
            if (i.line_items?.rows?.length) line_items = i.line_items;
          }

          if (
            headerRows.length ||
            (line_items?.columns?.length && line_items?.rows?.length)
          ) {
            next = applyFullPdfCustomFieldsToHtml(next, {
              headerRows,
              line_items,
            });
          }
        } catch (e) {
          console.warn("Custom fields PDF enrichment skipped:", e);
        }
        if (!cancelled) setRenderedHtml(next);
      })();

      return () => {
        cancelled = true;
      };
    } else {
      console.log("Rendering conditions not met, missing:", {
        templateToUse: !templateToUse,
        htmlContent: !templateToUse?.htmlContent,
        invoiceData: !invoiceData,
        businessDetails: !businessDetails,
        signatureFileURL: signatureFileURL === undefined,
      });
    }
  }, [
    templateData,
    fullTemplateData,
    invoiceData,
    businessDetails,
    accountTypeName,
    signatureFileURL,
    savedRecordIdForPdf,
    pdfModule,
    pdfScreen,
    inlinePdfCustomFieldsPayload,
    documentCustomFieldDefinitions,
    documentCustomFieldValues,
    lineItemCustomFieldDefinitions,
    business_id,
    businessData,
    adminInfo?.token,
  ]);

  console.log("accountTypeName", accountTypeName);

  // Define safe contract and contractDetails at component level (can be null/undefined for invoices without contracts)
  const safeContract = contract || null;
  const safeContractDetails = contractDetails || {};

  const mapInvoiceToContract = (invoiceData, business) => {
    console.log("mapInvoiceToContract invoiceData", invoiceData);
    console.log("mapInvoiceToContract contract", contract);
    console.log("invoiceData items", invoiceData.items);
    console.log("Invoice Number Mapping:", {
      invoiceNumber: invoiceData.invoiceNumber,
      invoice_number: invoiceData.invoice_number,
      willUse:
        invoiceData.invoiceNumber ||
        invoiceData.invoice_number ||
        contract?.contractNo ||
        "",
    });

    // Calculate totals from all items
    const items = invoiceData.items || [];
    console.log("items!!", items);
    const totalQuantity = items.reduce(
      (sum, item) => sum + (parseFloat(item.quantity) || 0),
      0
    );

    console.log("totalQuantity!!", totalQuantity);
    const totalAmount = items.reduce(
      (sum, item) => sum + (parseFloat(item.total) || 0),
      0
    );

    const productInfo = safeContract?.productInfo?.[0] || {};

    // Get deposit information from contract (if available)
    const depositPercentage =
      safeContractDetails?.depositPercentage ||
      safeContract?.productInfo?.[0]?.deposit ||
      0;
    const contractTotal = safeContractDetails?.totalAmount || totalAmount;
    const depositAmount =
      safeContractDetails?.depositAmount ||
      (contractTotal * depositPercentage) / 100;

    // Flexible logic for both invoice types based on SOPs
    if (invoiceData.invoiceType === "Commercial") {
      console.log("Processing Commercial invoice in mapInvoiceToContract");
      // Commercial invoices: Use invoiceData.items directly as they already contain both
      // contract items and advance payment entries from ItemTable (include tax)
      const allItems = (items || []).map((item, idx) => {
        const quantity = parseFloat(item.quantity || 0);
        const unitPrice = parseFloat(item.unitPrice || item.rate || 0);
        const discount = parseFloat(item.discountAmount ?? item.discount ?? 0);
        const lineSubtotal = quantity * unitPrice - discount;
        const taxRate = parseFloat(item.taxRate || 0);
        const taxAmount = parseFloat(item.taxAmount ?? item.tax ?? 0) || (taxRate ? (lineSubtotal * taxRate) / 100 : 0);
        const total = parseFloat(item.total || item.totalValue || 0) || Math.max(0, lineSubtotal + taxAmount);
        return {
          item: idx + 1,
          description: item.description || item.title || "",
          quantity,
          unitPrice,
          total,
          tax: taxAmount,
          discount,
          isAdvancePayment: item.isAdvancePayment || false,
        };
      });

      console.log(
        "Commercial invoice - using items directly from ItemTable:",
        allItems
      );

      // Calculate final total from the items as they are
      const finalTotal = allItems.reduce(
        (sum, item) => sum + (item.total || 0),
        0
      );
      const commercialLineItemTax = allItems.reduce(
        (sum, item) => sum + (item.tax || 0),
        0
      );
      const commercialDiscount = Number(
        invoiceData.discountAmount || invoiceData.discount || 0
      );
      const commercialShipping = Number(
        invoiceData.shippingCharges || invoiceData.freight_charges || 0
      );
      const commercialAdjustment = Number(
        invoiceData.adjustment || invoiceData.other_expenditures || 0
      );
      const commercialExpectedTotal = Math.max(
        0,
        finalTotal - commercialDiscount + commercialShipping + commercialAdjustment
      );
      const commercialProvidedTotal = Number(
        invoiceData.total || invoiceData.grandTotal || 0
      );
      const commercialLooksDoubleTaxed =
        commercialLineItemTax > 0 &&
        Math.abs(
          commercialProvidedTotal -
            (commercialExpectedTotal + commercialLineItemTax)
        ) < 0.01;
      const commercialResolvedTotal =
        commercialProvidedTotal > 0
          ? commercialLooksDoubleTaxed
            ? commercialExpectedTotal
            : commercialProvidedTotal
          : commercialExpectedTotal;
      const commercialTaxTotal =
        Number(invoiceData.taxTotal ?? invoiceData.tax ?? 0) || commercialLineItemTax;

      console.log("Commercial invoice final total:", finalTotal);
      console.log("All items for commercial invoice:", allItems);

      return {
        ref:
          invoiceData.invoiceNumber ||
          invoiceData.invoice_number ||
          contract?.contractNo ||
          "",
        contract_no:
          contract?.contractNo ||
          invoiceData.salesContractNumber ||
          invoiceData.contract_no ||
          "",
        buyerName: invoiceData.customer || invoiceData.customer_name || "",
        buyerAddress: invoiceData.billingAddress || "",
        date:
          invoiceData.invoiceDate || invoiceData.invoice_date
            ? formatDisplayDate(invoiceData.invoiceDate || invoiceData.invoice_date)
            : formatDisplayDate(new Date()),
        dueDate:
          invoiceData.dueDate || invoiceData.due_date
            ? formatDisplayDate(invoiceData.dueDate || invoiceData.due_date)
            : formatDisplayDate(new Date()),
        payment: invoiceData.terms || "",
        poNumber: invoiceData.poNumber || invoiceData.po_number || invoiceData.po_no || "",
        po_no: invoiceData.poNumber || invoiceData.po_number || invoiceData.po_no || "",
        quantity: totalQuantity.toString(),
        goods_description: items.map((item) => item.description).join(", "),
        price: items[0]?.unitPrice || 0,
        totalValue: finalTotal,
        totalInWords: numberToWords(finalTotal, invoiceData.currency || "MYR"),
        currency: invoiceData.currency || "MYR",
        Account_Info: {
          accountName: contract?.Account_Info?.accountName || "",
          accountNumber: contract?.Account_Info?.accountNumber || "",
          accountType: accountTypeName || "",
          bankName: contract?.Account_Info?.bankName || "",
          bankAddress: contract?.Account_Info?.bankAddress || "",
          swiftCode: contract?.Account_Info?.swiftCode || "",
        },
        sellerName: business?.name || "",
        terms: invoiceData?.terms || "",
        remarks: contract?.basicInfo?.remarks || contract?.remarks || "",
        ETD_Port: formatDate(contract?.basicInfo?.ETD_Port, true) || "",
        port_of_discharge:
          contract?.basicInfo?.port_of_discharge ||
          contract?.port_of_discharge ||
          "",
        port_of_loading:
          contract?.basicInfo?.port_of_loading ||
          contract?.port_of_loading ||
          "",
        origin_country:
          contract?.basicInfo?.origin_country || contract?.origin_country || "",
        business: {
          tel: business?.tel || "",
          fax: business?.fax || "",
          name: business?.name || "",
          address: business?.address || "",
        },
        validity_date_pi: formatDisplayDate(
          invoiceData.dueDate || invoiceData.due_date || new Date(),
        ),
        buyer_ref: safeContract?.contractNo || "",
        seller_ref: invoiceData.invoiceNumber || invoiceData.invoice_number || "",
        consigneeName: invoiceData.customer || invoiceData.customer_name || "",
        consigneeAddress: invoiceData.billingAddress || invoiceData.shippingAddress || "",
        consignee_tel: invoiceData.phoneNumber || "",
        consignee_fax: invoiceData.faxNumber || "",
        consignee_commercial_id: "",
        buyer_tel: invoiceData.phoneNumber || "",
        buyer_fax: invoiceData.faxNumber || "",
        buyer_commercial_id: "",
        country_of_Beneficiary: safeContract?.basicInfo?.origin_country || "",
        country_of_origin: safeContract?.basicInfo?.origin_country || "",
        country_of_destination: safeContract?.basicInfo?.port_of_discharge || "",
        transaction_currency: invoiceData.currency || "MYR",
        shipping_description_of_goods: productInfo?.packing || "",
        Total_Net_KGS: totalQuantity.toString(),
        Commodity: productInfo?.productType || "",
        kind_of_standard: productInfo?.productType || "",
        origin: safeContract?.basicInfo?.origin_country || "",
        new_wt: totalQuantity.toString(),
        discount: invoiceData.discountAmount || 0,
        freight_charges: invoiceData.shippingCharges || 0,
        other_expenditures: invoiceData.adjustment || 0,
        total_amount_due: finalTotal,
        issuance_place_and_date: `${business?.address || ""
          }, ${formatDisplayDate(new Date())}`,
        otherTerms: productInfo?.shippingTerms || "",
        businessLogo: business?.image || business?.logo || "",
        ntn_no: safeContract?.ntn_no || "",
        import_contact_no: safeContract?.import_contact_no || "",
        date_of_issue: safeContract?.date_of_issue || "",
        shippingTerms:
          safeContract?.productInfo?.[0]?.shippingTerms ||
          safeContract?.shippingTerms ||
          "",
        items: allItems,
        proformaDepositPaid: invoiceData.proformaDepositPaid || false,
        // Add contract totals for reference
        contractTotal: contractTotal,
        depositPercentage: 0, // Commercial invoices don't show deposit info
        depositAmount: 0,
        // Add invoice summary fields for template
        subtotal: invoiceData.subTotal || invoiceData.subtotal || finalTotal,
        subTotal: invoiceData.subTotal || invoiceData.subtotal || finalTotal,
        // Single discount field to avoid duplicate keys in object literal
        discountAmount: invoiceData.discountAmount || invoiceData.discount || 0,
        shippingCharges: commercialShipping,
        adjustment: commercialAdjustment,
        total: commercialResolvedTotal,
        tax: commercialTaxTotal,
        taxTotal: commercialTaxTotal,
        // subject removed
        notes: invoiceData.customerNotes || invoiceData.notes || "", // Notes field
        termsAndConditions: invoiceData.termsAndConditions || "",
      };
    } else if (invoiceData.invoiceType === "Proforma") {
      console.log("Processing Proforma invoice in mapInvoiceToContract");
      // Proforma invoices: Use contract items and handle deposit logic (if contract exists)
      const product = safeContract?.productInfo?.[0] || {};
      const proformaItems = (invoiceData.items || []).map((item, idx) => {
        const quantity = parseFloat(item.quantity || 0);
        const unitPrice = parseFloat(item.unitPrice || item.rate || 0);
        const discount = parseFloat(item.discountAmount ?? item.discount ?? 0);
        const lineSubtotal = quantity * unitPrice - discount;
        const taxRate = parseFloat(item.taxRate || 0);
        const taxAmount = parseFloat(item.taxAmount ?? item.tax ?? 0) || (taxRate ? (lineSubtotal * taxRate) / 100 : 0);
        const total = parseFloat(item.total || item.totalValue || 0) || Math.max(0, lineSubtotal + taxAmount);
        return {
          item: idx + 1,
          description: item.description || item.title || "",
          quantity,
          unitPrice,
          total,
          tax: taxAmount,
          discount,
          isAdvancePayment: item.isAdvancePayment || false,
        };
      });
      const proformaTotal = proformaItems.reduce(
        (sum, item) => sum + (item.total || 0),
        0
      );
      const proformaLineItemTax = proformaItems.reduce(
        (sum, item) => sum + (item.tax || 0),
        0
      );
      const proformaDiscount = Number(
        invoiceData.discountAmount || invoiceData.discount || 0
      );
      const proformaShipping = Number(
        invoiceData.shippingCharges || invoiceData.freight_charges || 0
      );
      const proformaAdjustment = Number(
        invoiceData.adjustment || invoiceData.other_expenditures || 0
      );
      const proformaExpectedTotal = Math.max(
        0,
        proformaTotal - proformaDiscount + proformaShipping + proformaAdjustment
      );
      const proformaProvidedTotal = Number(
        invoiceData.total || invoiceData.grandTotal || 0
      );
      const proformaLooksDoubleTaxed =
        proformaLineItemTax > 0 &&
        Math.abs(
          proformaProvidedTotal - (proformaExpectedTotal + proformaLineItemTax)
        ) < 0.01;
      const proformaResolvedTotal =
        proformaProvidedTotal > 0
          ? proformaLooksDoubleTaxed
            ? proformaExpectedTotal
            : proformaProvidedTotal
          : proformaExpectedTotal;
      const proformaTaxTotal =
        Number(invoiceData.taxTotal ?? invoiceData.tax ?? 0) || proformaLineItemTax;
      const depositPercentage = product.deposit || 0;
      const contractTotal = safeContractDetails?.totalAmount || proformaTotal;
      const depositAmount = depositPercentage
        ? (contractTotal * depositPercentage) / 100
        : 0;
      let paymentTerms = invoiceData.terms || "";
      if (depositPercentage > 0 && depositPercentage < 100) {
        paymentTerms = `${depositPercentage}% PREPAYMENT`;
      } else if (depositPercentage === 100) {
        paymentTerms = "100% PREPAYMENT";
      } else {
        paymentTerms = invoiceData.terms || "FULL PAYMENT";
      }
      return {
        ref:
          invoiceData.invoiceNumber ||
          invoiceData.invoice_number ||
          contract?.contractNo ||
          "",
        contract_no:
          contract?.contractNo ||
          invoiceData.salesContractNumber ||
          invoiceData.contract_no ||
          "",
        buyerName: invoiceData.customer || invoiceData.customer_name || "",
        buyerAddress: invoiceData.billingAddress || "",
        date:
          invoiceData.invoiceDate || invoiceData.invoice_date
            ? formatDisplayDate(invoiceData.invoiceDate || invoiceData.invoice_date)
            : formatDisplayDate(new Date()),
        dueDate:
          invoiceData.dueDate || invoiceData.due_date
            ? formatDisplayDate(invoiceData.dueDate || invoiceData.due_date)
            : formatDisplayDate(new Date()),
        payment: paymentTerms,
        poNumber: invoiceData.poNumber || invoiceData.po_number || invoiceData.po_no || "",
        po_no: invoiceData.poNumber || invoiceData.po_number || invoiceData.po_no || "",
        quantity: totalQuantity.toString(),
        goods_description: items.map((item) => item.description).join(", "),
        price: items[0]?.unitPrice || 0,
        totalValue:
          depositPercentage > 0 && depositPercentage < 100
            ? depositAmount
            : proformaTotal, // Use deposit amount if percentage exists
        totalInWords: numberToWords(
          depositPercentage > 0 && depositPercentage < 100
            ? depositAmount
            : proformaTotal,
          invoiceData.currency || "MYR"
        ),
        currency: invoiceData.currency || "MYR",
        Account_Info: {
          accountName: safeContract?.Account_Info?.accountName || invoiceData?.bankAccount || "",
          accountNumber: safeContract?.Account_Info?.accountNumber || "",
          accountType: accountTypeName || "",
          bankName: safeContract?.Account_Info?.bankName || "",
          bankAddress: safeContract?.Account_Info?.bankAddress || "",
          swiftCode: safeContract?.Account_Info?.swiftCode || "",
        },
        pre_payment: product.deposit ? `${product.deposit}% PREPAYMENT` : "",
        terms: product.paymentTerms || paymentTerms,
        deposit: product.deposit || "",
        //         remarks: product?.remarks || contract?.basicInfo?.remarks || contract?.remarks || "",
        remarks:
          product?.remarks ||
          safeContract?.basicInfo?.remarks ||
          safeContract?.remarks ||
          "",
        ETD_Port: formatDate(safeContract?.basicInfo?.ETD_Port, true) || "",
        port_of_discharge:
          contract?.basicInfo?.port_of_discharge ||
          contract?.port_of_discharge ||
          "",
        port_of_loading:
          safeContract?.basicInfo?.port_of_loading ||
          safeContract?.port_of_loading ||
          "",
        origin_country:
          safeContract?.basicInfo?.origin_country || safeContract?.origin_country || "",
        business: {
          tel: business?.tel || "",
          fax: business?.fax || "",
          name: business?.name || "",
          address: business?.address || "",
        },
        validity_date_pi: formatDisplayDate(
          invoiceData.dueDate || invoiceData.due_date || new Date(),
        ),
        buyer_ref: safeContract?.contractNo || "",
        seller_ref: invoiceData.invoiceNumber || invoiceData.invoice_number || "",
        consigneeName: invoiceData.customer || invoiceData.customer_name || "",
        consigneeAddress: invoiceData.billingAddress || invoiceData.shippingAddress || "",
        consignee_tel: invoiceData.phoneNumber || "",
        consignee_fax: invoiceData.faxNumber || "",
        consignee_commercial_id: "",
        buyer_tel: invoiceData.phoneNumber || "",
        buyer_fax: invoiceData.faxNumber || "",
        buyer_commercial_id: "",
        country_of_Beneficiary: safeContract?.basicInfo?.origin_country || "",
        country_of_origin: safeContract?.basicInfo?.origin_country || "",
        country_of_destination: safeContract?.basicInfo?.port_of_discharge || "",
        transaction_currency: invoiceData.currency || "MYR",
        shipping_description_of_goods: product.packing || "",
        Total_Net_KGS: totalQuantity.toString(),
        Commodity: product.productType || "",
        kind_of_standard: product.productType || "",
        origin: safeContract?.basicInfo?.origin_country || "",
        new_wt: totalQuantity.toString(),
        discount: invoiceData.discountAmount || 0,
        freight_charges: invoiceData.shippingCharges || 0,
        other_expenditures: invoiceData.adjustment || 0,
        total_amount_due:
          depositPercentage > 0 && depositPercentage < 100
            ? depositAmount
            : proformaTotal,
        issuance_place_and_date: `${business?.address || ""
          }, ${formatDisplayDate(new Date())}`,
        otherTerms: product.shippingTerms || "",
        businessLogo: business?.image || business?.logo || "",
        ntn_no: safeContract?.ntn_no || "",
        import_contact_no: safeContract?.import_contact_no || "",
        date_of_issue: safeContract?.date_of_issue || "",
        shippingTerms:
          safeContract?.productInfo?.[0]?.shippingTerms ||
          safeContract?.shippingTerms ||
          "",
        items: proformaItems,
        contractTotal: contractTotal,
        depositPercentage: depositPercentage,
        depositAmount: depositAmount,
        depositPaymentAmount:
          depositPercentage > 0 ? depositAmount : proformaTotal,
        // Add invoice summary fields for template
        subtotal: invoiceData.subTotal || invoiceData.subtotal || proformaTotal,
        subTotal: invoiceData.subTotal || invoiceData.subtotal || proformaTotal,
        // Single discount field to avoid duplicate keys in object literal
        discountAmount: invoiceData.discountAmount || invoiceData.discount || 0,
        shippingCharges: proformaShipping,
        adjustment: proformaAdjustment,
        total: proformaResolvedTotal,
        tax: proformaTaxTotal,
        taxTotal: proformaTaxTotal,
        // subject removed
        notes: invoiceData.customerNotes || invoiceData.notes || "", // Notes field
        termsAndConditions: invoiceData.termsAndConditions || "",
      };
    }

    // If this is an advance payment invoice, show only the advance line
    if (invoiceData.isAdvancePayment) {
      const advAmount = invoiceData.advanceAmount || 0;
      return {
        ref:
          invoiceData.invoiceNumber ||
          invoiceData.invoice_number ||
          contract?.contractNo ||
          "",
        contract_no:
          contract?.contractNo ||
          invoiceData.salesContractNumber ||
          invoiceData.contract_no ||
          "",
        buyerName: invoiceData.customer || invoiceData.customer_name || "",
        buyerAddress: invoiceData.billingAddress || "",
        date:
          invoiceData.invoiceDate || invoiceData.invoice_date
            ? formatDisplayDate(invoiceData.invoiceDate || invoiceData.invoice_date)
            : formatDisplayDate(new Date()),
        payment: invoiceData.terms || "",
        quantity: totalQuantity.toString(),
        goods_description: items.map((item) => item.description).join(", "),
        price: items[0]?.unitPrice || 0, // Using first item's price as reference
        totalValue: advAmount,
        totalInWords: numberToWords(advAmount, invoiceData.currency || "MYR"),
        currency: invoiceData.currency || "MYR",
        Account_Info: {
          accountName: contract?.Account_Info?.accountName || "",
          accountNumber: contract?.Account_Info?.accountNumber || "",
          accountType: accountTypeName || "",
          bankName: contract?.Account_Info?.bankName || "",
          bankAddress: contract?.Account_Info?.bankAddress || "",
          swiftCode: contract?.Account_Info?.swiftCode || "",
        },
        sellerName: business?.name || "",
        terms: invoiceData?.terms || "",
        remarks: contract?.basicInfo?.remarks || contract?.remarks || "",
        ETD_Port: formatDate(contract?.basicInfo?.ETD_Port, true) || "",
        port_of_discharge:
          contract?.basicInfo?.port_of_discharge ||
          contract?.port_of_discharge ||
          "",
        port_of_loading:
          contract?.basicInfo?.port_of_loading ||
          contract?.port_of_loading ||
          "",
        origin_country:
          contract?.basicInfo?.origin_country || contract?.origin_country || "",
        business: {
          tel: business?.tel || "",
          fax: business?.fax || "",
          name: business?.name || "",
          address: business?.address || "",
        },
        // Additional fields required by the template
        validity_date_pi: formatDisplayDate(invoiceData.dueDate),
        buyer_ref: contract?.contractNo || "",
        seller_ref: invoiceData.invoiceNumber || "",
        consigneeName: invoiceData.customer || "",
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
        transaction_currency: invoiceData.currency || "MYR",
        shipping_description_of_goods: productInfo?.packing || "",
        Total_Net_KGS: totalQuantity.toString(),
        Commodity: productInfo?.productType || "",
        kind_of_standard: productInfo?.productType || "",
        origin: contract?.basicInfo?.origin_country || "",
        new_wt: totalQuantity.toString(),
        discount: invoiceData.discountAmount || 0,
        freight_charges: invoiceData.shippingCharges || 0,
        other_expenditures: invoiceData.adjustment || 0,
        total_amount_due: advAmount,
        issuance_place_and_date: `${business?.address || ""
          }, ${formatDisplayDate(new Date())}`,
        otherTerms: productInfo?.shippingTerms || "",
        businessLogo: business?.image || business?.logo || "",
        ntn_no: contract?.ntn_no || "",
        import_contact_no: contract?.import_contact_no || "",
        date_of_issue: contract?.date_of_issue || "",
        shippingTerms:
          contract?.productInfo?.[0]?.shippingTerms ||
          contract?.shippingTerms ||
          "",
        items: [
          {
            item: 1,
            description: "Advance Payment",
            quantity: 1,
            unitPrice: advAmount,
            total: advAmount,
          },
        ],
        depositAmount: invoiceData.depositAmount || false,
        // subject removed
        notes: invoiceData.customerNotes || invoiceData.notes || "", // Notes field
        termsAndConditions: invoiceData.termsAndConditions || "",
      };
    }

    console.log("Using fallback path in mapInvoiceToContract");
    return {
      ref:
        invoiceData.invoiceNumber ||
        invoiceData.invoice_number ||
        contract?.contractNo ||
        "",
      contract_no:
        contract?.contractNo ||
        invoiceData.salesContractNumber ||
        invoiceData.contract_no ||
        "",
      buyerName: invoiceData.customer || invoiceData.customer_name || "",
      buyerAddress: invoiceData.billingAddress || "",
      date:
        invoiceData.invoiceDate || invoiceData.invoice_date
          ? formatDisplayDate(invoiceData.invoiceDate || invoiceData.invoice_date)
          : formatDisplayDate(new Date()),
      dueDate:
        invoiceData.dueDate || invoiceData.due_date
          ? formatDisplayDate(invoiceData.dueDate || invoiceData.due_date)
          : formatDisplayDate(new Date()),
      payment: invoiceData.terms || "",
      poNumber: invoiceData.poNumber || invoiceData.po_number || invoiceData.po_no || "",
      po_no: invoiceData.poNumber || invoiceData.po_number || invoiceData.po_no || "",
      quantity: totalQuantity.toString(),
      goods_description: items.map((item) => item.description).join(", "),
      price: items[0]?.unitPrice || 0, // Using first item's price as reference
      totalValue: invoiceData.total || totalAmount,
      totalInWords: numberToWords(
        invoiceData.total || totalAmount,
        invoiceData.currency || "MYR"
      ),
      currency: invoiceData.currency || "MYR",
      Account_Info: {
        accountName: contract?.Account_Info?.accountName || "",
        accountNumber: contract?.Account_Info?.accountNumber || "",
        accountType: accountTypeName || "",
        bankName: contract?.Account_Info?.bankName || "",
        bankAddress: contract?.Account_Info?.bankAddress || "",
        swiftCode: contract?.Account_Info?.swiftCode || "",
      },
      sellerName: business?.name || "",
      terms: invoiceData?.terms || "",
      remarks: contract?.basicInfo?.remarks || contract?.remarks || "",
      ETD_Port: moment(contract?.basicInfo?.ETD_Port).format("MMM YYYY") || "",
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
      // Additional fields required by the template
      validity_date_pi: formatDisplayDate(invoiceData.dueDate),
      buyer_ref: contract?.contractNo || "",
      seller_ref: invoiceData.invoiceNumber || "",
      consigneeName: invoiceData.customer || "",
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
      transaction_currency: invoiceData.currency || "MYR",
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
      issuance_place_and_date: `${business?.address || ""
        }, ${formatDisplayDate(new Date())}`,
      otherTerms: productInfo?.shippingTerms || "",
      businessLogo: business?.image || business?.logo || "",
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
      depositAmount: invoiceData.depositAmount || false,
      // subject removed
      notes: invoiceData.customerNotes || invoiceData.notes || "", // Notes field
      termsAndConditions: invoiceData.termsAndConditions || "",
    };
  };

  /**
   * Map invoiceData (from Create/Update Customer Invoice screens) into the `contract` shape
   * expected by the new template-builder invoice templates (type: "invoice").
   */
  const mapInvoiceToUnifiedInvoiceContract = (invoiceData, business) => {
    const safeStr = (v) => (v === undefined || v === null ? "" : String(v));
    const toNum = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };

    const currency = safeStr(invoiceData?.currency || invoiceData?.baseCurrency || "RM");

    const branding = resolveDocumentCompanyBranding(business);
    const businessLogo = safeStr(branding.businessLogo);
    const businessName = safeStr(branding.businessName);
    const businessAddress = safeStr(branding.businessAddress);
    const businessPhone = safeStr(branding.businessPhone);
    const businessEmail = safeStr(branding.businessEmail);

    const invoice_number = safeStr(
      invoiceData?.invoiceNumber || invoiceData?.invoice_number || ""
    );
    const date = formatDate(
      formatInvoiceDateYMD(
        invoiceData?.invoiceDate || invoiceData?.invoice_date || "",
      ) || invoiceData?.invoiceDate || invoiceData?.invoice_date,
    );
    const dueDate = formatDate(
      formatInvoiceDateYMD(
        invoiceData?.dueDate || invoiceData?.due_date || "",
      ) || invoiceData?.dueDate || invoiceData?.due_date,
    );
    const salesType = safeStr(invoiceData?.salesType || "CREDIT");
    const salesPerson = safeStr(invoiceData?.salesPerson || "");

    // Customer fields (invoiceData can have customer as name or id; for generator we prefer display fields)
    // Extract customer name - handle both object and string cases
    let buyerName = "";
    if (invoiceData?.customer_name) {
      buyerName = safeStr(invoiceData.customer_name);
    } else if (invoiceData?.customer) {
      // If customer is an object, extract name from it
      if (typeof invoiceData.customer === "object") {
        buyerName = safeStr(
          invoiceData.customer.basicInformation?.customerDisplayName ||
          invoiceData.customer.basicInformation?.customerName ||
          invoiceData.customer.basicInformation?.companyName ||
          invoiceData.customer.name ||
          ""
        );
      } else {
        buyerName = safeStr(invoiceData.customer);
      }
    }
    buyerName = buyerName || "Customer";
    
    const customerObj =
      invoiceData?.customer_id && typeof invoiceData.customer_id === "object"
        ? invoiceData.customer_id
        : invoiceData?.customer && typeof invoiceData.customer === "object"
        ? invoiceData.customer
        : null;
    const customerBasic = customerObj?.basicInformation || {};
    const customerCompanyInfo = customerObj?.companyInfo || {};
    const customerPhoneObj = customerBasic?.customerPhone || {};
    const customerAddresses = Array.isArray(customerObj?.addresses) ? customerObj.addresses : [];
    const billingAddr = customerAddresses.find(
      (a) => (a.addressType || "").toLowerCase() === "billing"
    );
    const shippingAddr =
      customerAddresses.find((a) => (a.addressType || "").toLowerCase() === "shipping") ||
      customerAddresses[0];

    const buyerCompany = safeStr(
      invoiceData?.customerCompany ||
      invoiceData?.companyName ||
      customerBasic?.companyName ||
      customerCompanyInfo?.companyName ||
      customerBasic?.customerDisplayName ||
      buyerName
    );
    const buyerAddress = safeStr(invoiceData?.billingAddress || "");
    const buyerPhone = safeStr(
      invoiceData?.phoneNumber ||
      invoiceData?.customerPhone ||
      invoiceData?.customer_phone ||
      invoiceData?.phone ||
      customerPhoneObj?.mobile ||
      customerPhoneObj?.workPhone ||
      customerBasic?.phone ||
      customerCompanyInfo?.phone ||
      billingAddr?.phone ||
      shippingAddr?.phone ||
      customerAddresses[0]?.phone ||
      customerObj?.keyContacts?.[0]?.contactNumber ||
      ""
    );
    const buyerEmail = safeStr(
      invoiceData?.customerEmail ||
      invoiceData?.customer_email ||
      invoiceData?.email?.to ||
      customerBasic?.customerEmail ||
      customerBasic?.email ||
      customerObj?.keyContacts?.[0]?.email ||
      customerCompanyInfo?.email ||
      ""
    );

    const shipToName = safeStr(invoiceData?.shipToName || buyerName);
    const shipToCompany = safeStr(invoiceData?.shipToCompany || buyerCompany);
    const shipToAddress = safeStr(invoiceData?.shippingAddress || buyerAddress);
    const shipToPhone = safeStr(
      invoiceData?.shipToPhone ||
      invoiceData?.ship_to_phone ||
      shippingAddr?.phone ||
      buyerPhone
    );
    const shipToEmail = safeStr(
      invoiceData?.shipToEmail || invoiceData?.ship_to_email || buyerEmail
    );

    const items = Array.isArray(invoiceData?.items)
      ? invoiceData.items.map((it, idx) => {
          const quantity = toNum(it.quantity || it.qty);
          const price = toNum(it.rate || it.unitPrice || it.price);
          const discountPercent = toNum(it.discount ?? it.discountPercent ?? 0);
          const lineSubtotal = Math.max(
            0,
            quantity * price * (1 - Math.min(100, Math.max(0, discountPercent)) / 100),
          );
          const taxRate = toNum(it.taxRate ?? 0);
          const taxAmountFromApi = toNum(it.taxAmount ?? it.tax ?? 0);
          const tax =
            taxAmountFromApi ||
            (taxRate ? (lineSubtotal * taxRate) / 100 : 0);
          const computedLineTotal = Math.max(0, lineSubtotal + tax);
          const providedTotal = toNum(it.amount ?? it.total ?? it.totalValue ?? 0);
          const tol = 0.01;
          const total =
            providedTotal > 0
              ? Math.abs(providedTotal - computedLineTotal) < tol
                ? providedTotal
                : Math.abs(providedTotal - lineSubtotal) < tol && tax > 0
                  ? providedTotal + tax
                  : computedLineTotal
              : computedLineTotal;
          const { itemName: linePrimary, description: lineSecondary } =
            resolveOrderLineItemAndDescription(it, idx);
          const mainName = safeStr(linePrimary);
          const subDesc = safeStr(lineSecondary);
          const taxName = safeStr(it.taxName || it.tax_label || it.taxLabel || "");
          return {
            item: mainName,
            name: mainName,
            description: subDesc,
            subDescription: safeStr(subDesc || it.subDescription || it.sub_description || ""),
            servicePeriod: safeStr(it.servicePeriod || it.service_period || ""),
            quantity,
            price,
            unitPrice: price,
            rate: price,
            discount: discountPercent,
            discountPercent,
            tax,
            taxRate,
            taxName,
            total,
          };
        })
      : [];

    const subtotal =
      toNum(invoiceData?.subTotal) ||
      toNum(invoiceData?.subtotal) ||
      items.reduce((s, it) => s + toNum(it.total), 0);
    const discountTotal = toNum(invoiceData?.discountAmount ?? invoiceData?.discount ?? 0);
    const summaryDiscountPercentage =
      toNum(invoiceData?.discountPercentage ?? invoiceData?.summaryDiscountPercentage) ||
      calculateOrderDiscountPercentage(subtotal, discountTotal);
    const shippingCharges = toNum(invoiceData?.shippingCharges ?? 0);
    const calculatedItemTax = items.reduce((s, it) => s + toNum(it.tax), 0);
    const taxTotal = toNum(invoiceData?.taxTotal ?? invoiceData?.tax ?? 0) || calculatedItemTax;
    const adjustment = toNum(invoiceData?.adjustment ?? 0);
    const providedTotal = toNum(invoiceData?.total) || toNum(invoiceData?.grandTotal);
    const itemTotals = items.reduce((s, it) => s + toNum(it.total), 0);
    const fallbackTotal = Math.max(0, itemTotals - discountTotal + shippingCharges + adjustment);
    const providedLooksUntaxed =
      calculatedItemTax > 0 &&
      Math.abs(providedTotal - (subtotal + shippingCharges + adjustment - discountTotal)) < 0.01;
    const total =
      providedTotal > 0
        ? (providedLooksUntaxed ? fallbackTotal : providedTotal)
        : fallbackTotal;
    const deposit = toNum(invoiceData?.deposit ?? invoiceData?.depositAmount ?? 0);

    return {
      businessLogo,
      businessName,
      businessAddress,
      businessPhone,
      businessEmail,
      invoice_number,
      date,
      invoice_date: date,
      invoiceDate: date,
      dueDate,
      due_date: dueDate,
      salesPerson,
      buyerName,
      buyerCompany,
      buyerAddress,
      buyerPhone,
      buyerEmail,
      customerPhone: buyerPhone,
      phoneNumber: buyerPhone,
      customerEmail: buyerEmail,
      shipToName,
      shipToCompany,
      shipToAddress,
      shipToPhone,
      shipToEmail,
      currency,
      items,
      subtotal,
      discount: discountTotal,
      discountAmount: discountTotal,
      discountPercentage: summaryDiscountPercentage,
      summaryDiscountPercentage,
      summaryDiscountDisplay: `${summaryDiscountPercentage.toFixed(2)}%`,
      shippingCharges,
      tax: taxTotal,
      taxTotal,
      adjustment,
      total,
      deposit,
      // Kept for compatibility with existing template code paths:
      ref: invoice_number,
      notes: invoiceData?.customerNotes || invoiceData?.notes || "",
      termsAndConditions: invoiceData?.termsAndConditions || "",
      terms: invoiceData?.terms || invoiceData?.paymentTerms || "Due on Receipt",
      paymentTerms: invoiceData?.terms || invoiceData?.paymentTerms || "Due on Receipt",
      paymentInfo: invoiceData?.paymentInfo || invoiceData?.bankDetails || "",
      billingAddress: buyerAddress,
    };
  };

  // Lightweight EJS-like processor (same behavior used in CustomerInvoiceViewer InvoiceRenderer)
  // Supports: <%= %>, <% if (...) { %> ... <% } %>, forEach loops.
  const processTemplate = (template, data, context = null) => {
    if (!template) throw new Error(ciText("Template is undefined"));
    let result = template;
    const ctx = context || data;

    // Process if blocks
    let maxIterations = 10;
    let iteration = 0;
    while (result.includes("<% if") && iteration < maxIterations) {
      result = result.replace(
        /<% if\s*\(([^)]+)\)\s*{ %>([\s\S]*?)(?:<% } else { %>([\s\S]*?))?<% } %>/g,
        (match, condition, ifContent, elseContent = "") => {
          try {
            const conditionFn = new Function(
              ...Object.keys(ctx),
              `return (${condition.trim()});`
            );
            const conditionResult = conditionFn(...Object.values(ctx));
            return conditionResult
              ? processTemplate(ifContent, data, ctx)
              : processTemplate(elseContent, data, ctx);
          } catch (e) {
            console.error("Error processing if:", e);
            return "";
          }
        }
      );
      iteration++;
    }

    // Process forEach blocks
    let forEachIteration = 0;
    while (result.includes(".forEach") && forEachIteration < maxIterations) {
      result = result.replace(
        /<%\s*([^%]+?)\.forEach\s*\(\s*\(\s*([^,]+)\s*,?\s*([^)]*)\s*\)\s*=>\s*{([\s\S]*?)<%\s*}\s*\)\s*;?\s*%>/g,
        (match, arrayExpr, itemVar, indexVar, content) => {
          try {
            const arrayEval = new Function(
              ...Object.keys(ctx),
              `return (${arrayExpr.trim()}) || [];`
            );
            const arr = arrayEval(...Object.values(ctx));
            if (!Array.isArray(arr)) return "";
            let out = "";
            arr.forEach((item, index) => {
              const loopContext = {
                ...ctx,
                [itemVar.trim()]: item,
              };
              if (indexVar && indexVar.trim()) {
                loopContext[indexVar.trim()] = index;
              }
              out += processTemplate(content, data, loopContext);
            });
            return out;
          } catch (e) {
            console.error("Error processing forEach:", e);
            return "";
          }
        }
      );
      forEachIteration++;
    }

    // Replace <%= ... %>
    result = result.replace(/<%=\s*([\s\S]*?)\s*%>/g, (match, expr) => {
      try {
        const fn = new Function(...Object.keys(ctx), `return (${expr});`);
        const val = fn(...Object.values(ctx));
        return val === undefined || val === null ? "" : String(val);
      } catch (e) {
        console.error("Error evaluating expression:", e, expr);
        return "";
      }
    });

    // Remove remaining <% %>
    result = result.replace(/<%[\s\S]*?%>/g, "");
    return result;
  };

  // Process proforma invoice template similar to commercial invoice
  function processProformaInvoiceTemplate(templateContent, contract) {
    let processedTemplate = templateContent;
    
    // Declare currency once at the top
    const currency = contract.currency || "MYR";

    // 1. Render items table with proper totals
    const tbodyRegex = /<tbody>([\s\S]*?)<\/tbody>/;
    const tbodyMatch = processedTemplate.match(tbodyRegex);
    if (tbodyMatch) {
      const itemRows = (contract.items || [])
        .map(
          (item, idx) => `
        <tr style="border-bottom: 0">
          <td style="text-align: center;">${idx + 1}</td>
          <td style="text-align: center;">${item.quantity}</td>
          <td>${item.description || ""}</td>
          <td style="text-align: center;">${Math.abs(
            item.unitPrice || 0
          ).toFixed(2)}</td>
          <td style="text-align: center;">${item.isAdvancePayment
              ? `(${Math.abs(item.total || 0).toFixed(2)})`
              : Math.abs(item.total || 0).toFixed(2)
            }</td>
        </tr>
      `
        )
        .join("");
      processedTemplate = processedTemplate.replace(
        tbodyRegex,
        `<tbody>${itemRows}</tbody>`
      );
    }

    // 2. Replace total amount with properly calculated total
    // For commercial invoices, use the totalValue that was already calculated with advance payment deductions
    // For proforma invoices, calculate from contract items
    const totalAmount =
      contract.totalValue !== undefined
        ? contract.totalValue
        : (contract.items || []).reduce(
          (sum, item) => sum + (item.total || 0),
          0
        );

    // Handle deposit amount vs total amount for proforma invoices
    const displayTotal =
      contract.depositPercentage > 0 && contract.depositPercentage < 100
        ? contract.depositAmount
        : totalAmount;

    // Replace USD amount displays with dynamic currency
    // Currency already declared at function start
    processedTemplate = processedTemplate.replace(
      /<div>USD\s*<%= contract\.totalValue %><\/div>/g,
      `<div>${currency}${displayTotal.toFixed(2)}</div>`
    );

    // Replace any standalone totalValue expressions
    processedTemplate = processedTemplate.replace(
      /<%= contract\.totalValue %>/g,
      displayTotal.toFixed(2)
    );

    // Replace hardcoded USD headers with dynamic currency
    processedTemplate = processedTemplate.replace(
      /UNIT PRICE \(USD\/MT\)/g,
      `UNIT PRICE (${currency}/MT)`
    );
    processedTemplate = processedTemplate.replace(
      /Total \(USD\)/g,
      `Total (${currency})`
    );

    // Replace "US DOLLAR" with dynamic currency in amount in words
    processedTemplate = processedTemplate.replace(
      /US DOLLAR\s*:/g,
      `${currency} :`
    );

    // For proforma invoices, wrap deposit amounts in parentheses
    if (contract.depositPercentage > 0 && contract.depositPercentage < 100) {
      // Handle the specific pattern in proforma templates where deposit amount is shown
      processedTemplate = processedTemplate.replace(
        /<div>USD <%= contract\.totalValue %><\/div>/g,
        `<div>${currency} (${displayTotal.toFixed(2)})</div>`
      );

      // Also handle the case where the amount appears in the total row
      processedTemplate = processedTemplate.replace(
        /<div>(\d+\.\d+)<\/div>/g,
        (match, amount) => {
          // Only wrap in parentheses if this is the deposit amount
          if (Math.abs(parseFloat(amount) - displayTotal) < 0.01) {
            return `<div>(${amount})</div>`;
          }
          return match;
        }
      );

      // Handle the specific case in proforma templates where the deposit amount is shown after the term
      processedTemplate = processedTemplate.replace(
        /<div>USD (\d+\.\d+)<\/div>/g,
        `<div>${currency} ($1)</div>`
      );
    }

    // 3. Replace totalInWords expressions
    processedTemplate = processedTemplate.replace(
      /<%= contract\.totalInWords %>/g,
      contract.totalInWords || ""
    );

    // 4. Fix Contract No field to use contract_no instead of ref
    // The template incorrectly uses contract.ref for Contract No field, but it should use contract.contract_no
    // We need to replace only the one in the Contract No field, not the one at the top
    // Match the pattern: Contract No label followed by contract.ref in detail-value div
    processedTemplate = processedTemplate.replace(
      /(detail-label[^>]*>Contract No<\/div>[\s\S]*?detail-value[^>]*>[\s\S]*?)<%= contract\.ref %>/gi,
      "$1<%= contract.contract_no %>"
    );

    // 5. Replace contract placeholders (ref for top field, contract_no for Contract No field)
    processedTemplate = processedTemplate.replace(
      /<%= contract\.ref %>/g,
      contract.ref || contract.contract_no || ""
    );
    processedTemplate = processedTemplate.replace(
      /<%= contract\.contract_no %>/g,
      contract.contract_no || contract.ref || ""
    );

    // 6. Replace all other contract-level placeholders
    processedTemplate = processedTemplate.replace(
      /<%[-=] ?contract\.([\w.]+) ?%>/g,
      (match, variable) => {
        const props = variable.split(".");
        let value = contract;
        for (const prop of props) {
          value = value?.[prop];
          if (value === undefined) return "";
        }
        return value;
      }
    );

    // 7. Remove all remaining EJS syntax
    processedTemplate = processedTemplate.replace(/<%[\s\S]*?%>/g, "");

    return processedTemplate;
  }

  const renderTemplateWithInvoiceData = useCallback(
    (templateContent, invoiceData, business, adminSignature) => {
      console.log("templateContent in", templateContent);
      console.log("invoiceData in", invoiceData);
      console.log("business in", business);
      console.log("adminSignature in", adminSignature);

      if (!templateContent) {
        return `<!DOCTYPE html><html><head><title>${ciText("Invoice")}</title></head><body><h1>${ciText("Error")}</h1><p>${ciText("Template content is missing")}</p></body></html>`;
      }

      if (!invoiceData) {
        return `<!DOCTYPE html><html><head><title>${ciText("Invoice")}</title></head><body><h1>${ciText("Error")}</h1><p>${ciText("Invoice data is missing")}</p></body></html>`;
      }

      // Use fullTemplateData if available, otherwise templateData prop
      const templateToUse = fullTemplateData || templateData;

      // Map invoiceData to contract structure (depends on template type)
      const rawType = templateToUse?.type || templateToUse?.data?.type || "";
      const templateTypeNorm = normalizeDocumentTemplateType(rawType);
      const isSaleOrderTemplate = isSaleOrderDocumentTemplateType(rawType, rawType);

      // Sale Order templates have their own EJS variable shape (`saleorder.*`).
      if (isSaleOrderTemplate) {
        try {
          const saleorder = mapToSaleOrderTemplateData(invoiceData, business);
          const contractAlias = {
            ...saleorder,
            invoice_number: saleorder.orderNumber,
            invoiceNumber: saleorder.orderNumber,
          };
          let html;
          try {
            html = ejs.render(templateContent, { saleorder, contract: contractAlias }, { strict: false });
            html = replaceLineItemsTbodyRowsHtml(
              html,
              saleorder.items?.length || 0,
              buildOrderDocumentItemsRowsHtml(saleorder.items),
            );
          } catch (ejsErr) {
            console.warn("EJS render failed for sale order template:", ejsErr.message);
            html = `<div>Failed to render sale order template: ${ejsErr.message}</div>`;
          }
          return html;
        } catch (e) {
          console.error("Sale order template render error:", e);
          return `<div>Sale order render error: ${e.message}</div>`;
        }
      }

      const isUnifiedInvoiceTemplate =
        templateTypeNorm === "invoice" ||
        /jomsmart|saas\s*invoice/i.test(
          templateToUse?.name || templateToUse?.data?.name || ""
        );

      const isWorkOrderTemplate = isWorkOrderDocumentTemplateType(rawType, rawType);

      const contract = isUnifiedInvoiceTemplate
        ? mapInvoiceToUnifiedInvoiceContract(invoiceData, business)
        : mapInvoiceToContract(invoiceData, business);
      console.log("Contract object for template processing:", contract);
      console.log("Contract totalValue:", contract.totalValue);
      console.log("Contract totalInWords:", contract.totalInWords);

      /**
       * Resolve dynamic placeholders (e.g. %(d)(m)(y)%, %(m+1)%/%(y)%) inside
       * line items, notes, terms, addresses and subject before EJS render so
       * the PDF / PDF preview shows actual dates, while the editor form keeps
       * the raw expressions visible above. Mirrors the customer-invoice viewer
       * and recurring preview via the shared invoicePlaceholderResolver helper.
       */
      try {
        applyContractPlaceholdersInPlace(contract, {
          invoice: invoiceData,
          business,
        });
      } catch (phErr) {
        console.warn("placeholder resolution skipped:", phErr?.message || phErr);
      }

      contract.signature =
        contract.signature ||
        contract.authorizedSignature ||
        contract.approver_signature ||
        adminSignature ||
        "";
      contract.authorizedSignature = contract.signature;
      contract.approver_signature = contract.signature;

      // For new template-builder invoice templates (type: "invoice") including JomSmart SaaS,
      // use EJS for reliable items loop rendering, then apply post-processing.
      if (isUnifiedInvoiceTemplate) {
          try {
            const templateHtmlForRender = rewriteInvoiceTemplateForDisplayLabels(templateContent);
          // Use EJS for type "invoice" templates - it handles contract.items.forEach correctly
          let invoiceHtml;
          try {
            invoiceHtml = ejs.render(templateHtmlForRender, { contract }, { strict: false });
          } catch (ejsErr) {
            console.warn("EJS render failed for unified invoice, trying processTemplate:", ejsErr.message);
            invoiceHtml = processTemplate(templateHtmlForRender, { contract });
          }
          // Fallback: if items exist but output shows "No items", manually replace tbody (JomSmart column order)
          if (contract.items && contract.items.length > 0 && invoiceHtml.includes("No items")) {
            const currency = contract.currency || "MYR";
            const itemRows = contract.items
              .map((item, idx) => {
                const itemName = item.name || item.item || item.title || item.description || "";
                const subDesc = item.subDescription || (item.servicePeriod ? `(${item.servicePeriod})` : "") || (item.description && String(item.description).trim() !== String(itemName || "").trim() ? item.description : "");
                const quantity = parseFloat(item.quantity || 0);
                const price = parseFloat(item.unitPrice || item.price || item.rate || 0);
                const discountPct = parseFloat(item.discount ?? item.discountPercent ?? 0);
                const taxRate = parseFloat(item.taxRate || 0);
                const taxName = String(item.taxName || "").trim();
                const taxDisplay =
                  taxName
                    ? `${taxName}${taxRate > 0 ? ` (${taxRate.toFixed(2)}%)` : ""}`
                    : String(parseFloat(item.tax || 0).toFixed(2));
                const total = parseFloat(item.total || quantity * price || 0);
                const descCell = subDesc
                  ? `<div class="item-desc-main">${itemName || ""}</div><div class="item-desc-sub">${subDesc}</div>`
                  : `<div class="item-desc-main">${itemName || ""}</div>`;
                return `<tr><td>${idx + 1}</td><td>${descCell}</td><td>${quantity.toFixed(2)}</td><td>${price.toFixed(2)}</td><td>${discountPct.toFixed(2)}%</td><td>${taxDisplay}</td><td>${currency}${total.toFixed(2)}</td></tr>`;
              })
              .join("");
            const tbodyRegex = /<tbody>[\s\S]*?<\/tbody>/;
            invoiceHtml = invoiceHtml.replace(tbodyRegex, `<tbody>${itemRows}</tbody>`);
          }
          // Replace hardcoded payment-info / Terms with contract.termsAndConditions (no hardcoded bank details)
          const termsForUnified = (contract.termsAndConditions || "").replace(/\$/g, "$$$$");
          invoiceHtml = invoiceHtml.replace(
            /<div class="payment-info">\s*<div>1\. Method Of Payment[\s\S]*?21400015058\s*<\/div>\s*<\/div>\s*<div class="financial-summary">/g,
            `<div class="payment-info">${termsForUnified}</div>\n      <div class="financial-summary">`
          );
          invoiceHtml = invoiceHtml.replace(
            /<div class="payment-info">\s*(?:<div>[\s\S]*?<\/div>\s*){3}\s*<\/div>\s*<div class="financial-summary">/g,
            `<div class="payment-info">${termsForUnified}</div>\n      <div class="financial-summary">`
          );
          invoiceHtml = invoiceHtml.replace(
            /<div class="payment-info">[\s\S]*?ABDUL HAMEED[\s\S]*?21400015058[\s\S]*?<\/div>\s*<div class="financial-summary">/gi,
            `<div class="payment-info">${termsForUnified}</div>\n      <div class="financial-summary">`
          );
          const parser = new DOMParser();
          const doc = parser.parseFromString(invoiceHtml, "text/html");
          const signatureUrl = contract.signature || adminSignature || "";
          if (signatureUrl) {
            const signatureSections = Array.from(
              doc.querySelectorAll(".signature-section")
            );
            signatureSections.forEach((section) => {
              const existingImages = Array.from(section.querySelectorAll("img"));
              const mainImage = existingImages[0] || doc.createElement("img");
              if (!existingImages.length) {
                section.insertBefore(mainImage, section.firstChild);
              }
              existingImages.slice(1).forEach((img) => img.remove());
              mainImage.setAttribute("src", signatureUrl);
              mainImage.setAttribute("alt", "Authorized Signature");
              mainImage.style.maxHeight = "80px";
              mainImage.style.display = "block";
              mainImage.style.marginBottom = "6px";
              const signatureLine = section.querySelector(".signature-line");
              if (signatureLine) {
                section.insertBefore(mainImage, signatureLine);
              }
            });
          }
          return doc.documentElement.outerHTML;
        } catch (err) {
          console.error("Unified invoice template processing failed:", err);
        }
      }

      // Work Order template processing
      if (isWorkOrderTemplate) {
        try {
          const contract = mapInvoiceToUnifiedInvoiceContract(invoiceData, business);
          // Use the hardcoded template if the DB one is empty or explicitly requested
          const contentToUse = templateContent && templateContent.trim() !== "" ? templateContent : WORK_ORDER_TEMPLATE_HTML;
          let html;
          try {
            html = ejs.render(contentToUse, { contract }, { strict: false });
          } catch (ejsErr) {
            console.warn("EJS render failed for work order template:", ejsErr.message);
            html = processTemplate(contentToUse, { contract });
          }
          return html;
        } catch (e) {
          console.error("Work order template render error:", e);
          return `<div>Work order render error: ${e.message}</div>`;
        }
      }

      // Try EJS rendering for non-invoice templates first
      if (templateToUse?.type !== "Commercial Invoice") {
        // Try EJS rendering first for other templates
        try {
          console.log("Attempting EJS rendering...");
          const rendered = ejs.render(templateContent, { contract }, { strict: false });
          console.log("EJS rendering successful, length:", rendered.length);
          return rendered;
        } catch (ejsError) {
          console.log("EJS rendering failed, falling back to manual replacement:", ejsError.message);
        }
      }

      // Fallback to manual template replacement if EJS fails
      let processedTemplate = templateContent;
      console.log("processedTemplate in", processedTemplate);
      console.log("contract in", contract);
      console.log("templateToUse type:", templateToUse?.type);
      console.log("contract.items:", contract.items);

      // Handle Commercial Invoice and invoice type with dedicated function
      if (templateToUse?.type === "Commercial Invoice" || templateToUse?.type === "invoice" || templateContent.includes('items-table')) {
        console.log("Processing Invoice template (Commercial Invoice or invoice type)");
        processedTemplate = processCommercialInvoiceTemplate(
          templateContent,
          contract
        );
      } else if (templateToUse?.type === "Proforma Invoice") {
        // Handle Proforma Invoice with dedicated function
        console.log("Processing Proforma Invoice template");
        processedTemplate = processProformaInvoiceTemplate(
          templateContent,
          contract
        );
      } else {
        console.log(
          "Using fallback template processing, template type:",
          templateToUse?.type
        );
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

        // Replace totalInWords expressions specifically
        processedTemplate = processedTemplate.replace(
          /<%= contract\.totalInWords %>/g,
          contract.totalInWords || ""
        );

        // Special handling for proforma invoice deposit display
        // templateToUse is already defined above, reuse it
        if (templateToUse?.type === "Proforma Invoice") {
          // Update the deposit payment term display
          if (
            contract.depositPercentage > 0 &&
            contract.depositPercentage < 100
          ) {
            // Replace the hardcoded "20% PREPAYMENT" with actual percentage
            processedTemplate = processedTemplate.replace(
              /20% PREPAYMENT/g,
              `${contract.depositPercentage}% PREPAYMENT`
            );

            // Update the currency amount to show deposit amount instead of total
            // Currency already declared at function start
            processedTemplate = processedTemplate.replace(
              /<div>USD <%= contract\.totalValue %><\/div>/g,
              `<div>${currency}${contract.depositPaymentAmount.toFixed(
                2
              )}</div>`
            );

            // Replace the term row total amount with deposit amount
            processedTemplate = processedTemplate.replace(
              /<div>USD <%= contract\.totalValue %><\/div>/g,
              `<div>${currency}${contract.depositPaymentAmount.toFixed(
                2
              )}</div>`
            );

            // Handle the specific pattern in the template for the term row
            processedTemplate = processedTemplate.replace(
              /(<div.*?>USD <%= contract\.totalValue %><\/div>)/g,
              `<div>${currency}${contract.depositPaymentAmount.toFixed(
                2
              )}</div>`
            );

            // Replace any remaining total value references in deposit context with deposit amount
            const depositAmountRegex =
              /(<div[^>]*class="total-row"[^>]*>[\s\S]*?)<div>USD <%= contract\.totalValue %><\/div>/g;
            processedTemplate = processedTemplate.replace(
              depositAmountRegex,
              `$1<div>${currency}${contract.depositPaymentAmount.toFixed(
                2
              )}</div>`
            );

            // Also handle the case where totalValue appears after the percentage term
            processedTemplate = processedTemplate.replace(
              /(Term.*?:.*?\d+%\s*PREPAYMENT.*?<\/div>\s*<div>USD\s*)<%= contract\.totalValue %>/g,
              `$1${contract.depositPaymentAmount.toFixed(2)}`
            );
          } else if (contract.depositPercentage === 100) {
            processedTemplate = processedTemplate.replace(
              /20% PREPAYMENT/g,
              "100% PREPAYMENT"
            );
            // For 100% prepayment, show full amount
          } else {
            // No deposit - show full payment
            processedTemplate = processedTemplate.replace(
              /20% PREPAYMENT/g,
              "FULL PAYMENT"
            );
          }
        }

        // --- REWRITE ITEMS TABLE RENDERING FOR UNIQUE ROWS ---
        if (contract.items && contract.items.length > 0) {
          // Find the items table in the template
          const tableRegex =
            /(<table[^>]*class="items-table"[^>]*>[\s\S]*?<\/table>)/;
          const tableMatch = processedTemplate.match(tableRegex);
          if (tableMatch) {
            const tableHtml = tableMatch[1];
            // Split table into header, body row template, and footer
            const rowRegex = /(<tr>\s*<td[^>]*>1<\/td>[\s\S]*?<\/tr>)/;
            const rowMatch = tableHtml.match(rowRegex);
            if (rowMatch) {
              const rowTemplate = rowMatch[1];
              // Everything before the first row is header
              const header = tableHtml.split(rowTemplate)[0];
              // Everything after the first row is footer
              const footer = tableHtml.split(rowTemplate)[1];
              // Build all item rows
              const itemRows = contract.items
                .map((item, idx) => {
                  return `
                  <tr>
                    <td style="text-align:center; font-weight: bold;">${idx + 1
                    }</td>
                    <td>
                      <div style="display: flex;">
                        <div style="width: 45%; font-weight: bold;">${item.description || ""
                    }</div>
                        <div style="width: 27.5%; font-weight: bold;">${item.origin || contract.origin || ""
                    }</div>
                        <div style="width: 27.5%; font-weight: bold;">${item.grade || contract.grade || ""
                    }</div>
                      </div>
                    </td>
                    <td style="font-weight: bold;">${item.quantity || ""}</td>
                    <td style="text-align:center; font-weight: bold;">${item.quantity || ""
                    }</td>
                    <td style="text-align:center; font-weight: bold;">${contract.transaction_currency
                    } ${(item.unitPrice || 0).toFixed(2)}</td>
                    <td style="text-align:center; font-weight: bold;">${contract.transaction_currency
                    } ${(item.total || 0).toFixed(2)}</td>
                  </tr>
                `;
                })
                .join("");
              // Rebuild the table
              const newTable = header + itemRows + footer;
              processedTemplate = processedTemplate.replace(
                tableRegex,
                newTable
              );
            }
          }
        }
        // --- END REWRITE ---
      }

      console.log("business in", business);
      // Replace logo URL in the template (use all possible logo fields; never output "undefined")
      const letterhead = resolveDocumentCompanyBranding(business);
      const businessLogo = letterhead.businessLogo || "";
      const businessName = letterhead.businessName || "";
      const logoImgTag = businessLogo
        ? `<img src="${businessLogo}" alt="${businessName} Logo">`
        : `<img src="" alt="${businessName} Logo" style="display:none;">`;
      // Match common logo img patterns: PCI Group Logo, Company Logo, or generic logo alt/class
      processedTemplate = processedTemplate.replace(
        /<img src="[^"]*" alt="PCI Group Logo">/g,
        logoImgTag
      );
      processedTemplate = processedTemplate.replace(
        /<img src="[^"]*" alt="Company Logo">/g,
        logoImgTag
      );
      processedTemplate = processedTemplate.replace(
        /<img src="[^"]*" alt="Business Logo">/g,
        logoImgTag
      );
      // Replace EJS placeholder in src so logo URL is injected
      const safeLogoUrl = (businessLogo || "").replace(/"/g, "&quot;");
      processedTemplate = processedTemplate.replace(
        /<img([^>]*)src=["']<%- ?contract\.businessLogo ?%>["']/g,
        `<img$1src="${safeLogoUrl}"`
      );
      processedTemplate = processedTemplate.replace(
        /<img([^>]*)src=["']<%= ?contract\.businessLogo ?%>["']/g,
        `<img$1src="${safeLogoUrl}"`
      );

      // Replace <%= variable %> patterns (escaped HTML)
      processedTemplate = processedTemplate.replace(
        /<%= ?([\w.]+) ?%>/g,
        (match, variable) => {
          const props = variable.split(".");
          let value = contract;

          for (const prop of props) {
            value = value?.[prop];
            if (value === undefined) return "[" + variable + "]";
          }

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
          const props = variable.split(".");
          let value = contract;

          for (const prop of props) {
            value = value?.[prop];
            if (value === undefined) return "[" + variable + "]";
          }

          return value || "";
        }
      );

      // Final pass: Replace deposit amounts in proforma invoices after all EJS processing
      if (
        templateData?.type === "Proforma Invoice" &&
        contract.depositPercentage > 0 &&
        contract.depositPercentage < 100
      ) {
        // Look for the specific pattern in the template where we show the term and amount
        // This pattern matches: Term: XX% PREPAYMENT ... USD AMOUNT
        const termPattern =
          /(Term\s*:\s*\d+%\s*PREPAYMENT[\s\S]*?USD\s*)([\d,.]+)/g;
        processedTemplate = processedTemplate.replace(
          termPattern,
          `$1${contract.depositPaymentAmount.toFixed(2)}`
        );

        // Also handle the total-row class pattern
        const totalRowPattern =
          /(<div[^>]*class="total-row"[^>]*>[\s\S]*?USD\s*)([\d,.]+)/g;
        processedTemplate = processedTemplate.replace(
          totalRowPattern,
          `$1${contract.depositPaymentAmount.toFixed(2)}`
        );

        // Handle any remaining USD amount that appears after the term
        const usdAfterTermPattern =
          /(Term\s*:\s*\d+%\s*PREPAYMENT[\s\S]*?<div>USD\s*)([\d,.]+)/g;
        processedTemplate = processedTemplate.replace(
          usdAfterTermPattern,
          `$1${contract.depositPaymentAmount.toFixed(2)}`
        );
      }

      // Handle signature display
      const parser = new DOMParser();
      const doc = parser.parseFromString(processedTemplate, "text/html");
      const signatureUrl = adminSignature || contract.signature || "";
      if (signatureUrl) {
        const signatureSections = Array.from(
          doc.querySelectorAll(".signature-section")
        );
        signatureSections.forEach((section) => {
          const existingImages = Array.from(section.querySelectorAll("img"));
          const mainImage = existingImages[0] || doc.createElement("img");
          if (!existingImages.length) {
            section.insertBefore(mainImage, section.firstChild);
          }
          existingImages.slice(1).forEach((img) => img.remove());
          mainImage.setAttribute("src", signatureUrl);
          mainImage.setAttribute("alt", "Authorized Signature");
          mainImage.style.maxHeight = "80px";
          mainImage.style.display = "block";
          mainImage.style.marginBottom = "6px";
          const signatureLine = section.querySelector(".signature-line");
          const signatureLabel = section.querySelector(".signature-label");
          if (signatureLine) {
            section.insertBefore(mainImage, signatureLine);
          } else if (signatureLabel) {
            section.insertBefore(mainImage, signatureLabel);
          }
        });

        const signatureImg = doc.querySelector(".signature-box .logo img");
        if (signatureImg) {
          signatureImg.setAttribute("src", signatureUrl);
          signatureImg.style.height = "80px";
        }
      }

      return doc.documentElement.outerHTML;
    },
    []
  );

  const generatePDF = async () => {
    setIsGenerating(true);
    try {
      // Use backend Puppeteer-based HTML->PDF to avoid browser CORS/canvas issues (S3 signed logo).
      if (!renderedHtml) {
        throw new Error(
          ciText("Document HTML is not ready yet. Please try again."),
        );
      }

      // Use template-specific filename for new templates (e.g. JomSmart SaaS) so it doesn't conflict with existing
      const templateName = templateData?.name || templateData?.data?.name || "";
      const isSaaSTemplate = /jomsmart|saas/i.test(templateName);
      const fileNameBase =
        invoiceData?.invoiceNumber ||
        invoiceData?.invoice_number ||
        "document";
      const fileNameWithSuffix = isSaaSTemplate
        ? `${fileNameBase}-SaaS`
        : fileNameBase;

      const fullFileName = fileNameWithSuffix.toLowerCase().endsWith(".pdf")
        ? fileNameWithSuffix
        : `${fileNameWithSuffix}.pdf`;

      // Embed business logo and signature as base64 so they show in PDF when server renders (avoids S3/CORS issues)
      let htmlToSend = renderedHtml;
      
      // Helper function to convert image URL to base64 and replace in HTML
      const convertImageToBase64 = async (imageUrl, imageName) => {
        if (!imageUrl || (!imageUrl.startsWith("http") && !imageUrl.startsWith("//"))) {
          return;
        }
        
        try {
          // Normalize URL
          const normalizedUrl = imageUrl.startsWith("//") ? `https:${imageUrl}` : imageUrl;
          
          const imageResponse = await fetch(normalizedUrl, {
            mode: "cors",
            credentials: "omit",
          });
          
          if (imageResponse.ok) {
            const imageBlob = await imageResponse.blob();
            const imageBase64 = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result);
              reader.onerror = reject;
              reader.readAsDataURL(imageBlob);
            });
            
            // Replace all variations of the image URL in HTML (double quotes, single quotes, HTML-escaped)
            const escapedUrl = normalizedUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const escapedForHtml = normalizedUrl.replace(/&/g, "&amp;");
            const escapedForHtmlQuotes = normalizedUrl.replace(/&/g, "&amp;").replace(/'/g, "&#39;");
            
            // Replace double quotes
            htmlToSend = htmlToSend.replace(
              new RegExp(`(<img[^>]+src=["'])(${escapedUrl})(["'])`, "gi"),
              `$1${imageBase64}$3`
            );
            // Replace HTML-escaped double quotes
            htmlToSend = htmlToSend.replace(
              new RegExp(`(<img[^>]+src=["'])(${escapedForHtml})(["'])`, "gi"),
              `$1${imageBase64}$3`
            );
            // Replace single quotes
            htmlToSend = htmlToSend.replace(
              new RegExp(`(<img[^>]+src=['])(${escapedUrl})(['])`, "gi"),
              `$1${imageBase64}$3`
            );
            // Replace HTML-escaped single quotes
            htmlToSend = htmlToSend.replace(
              new RegExp(`(<img[^>]+src=['])(${escapedForHtmlQuotes})(['])`, "gi"),
              `$1${imageBase64}$3`
            );
            
            console.log(`Successfully converted ${imageName} to base64`);
          }
        } catch (err) {
          console.warn(`Could not embed ${imageName} as base64, using original URL:`, err);
        }
      };
      
      // Convert logo to base64 (AQCTA letterhead when Business still has PCI leftovers)
      const businessLogoUrl =
        resolveDocumentCompanyBranding(businessDetails).businessLogo || "";
      if (businessLogoUrl) {
        await convertImageToBase64(businessLogoUrl, "logo");
      }

      // Convert signature to base64
      const signatureUrl = signatureFileURL || "";
      if (signatureUrl) {
        await convertImageToBase64(signatureUrl, "signature");
      }

      const pdfRes = await axios.post(
        `${Base_URL}/html-to-pdf`,
        {
          html: htmlToSend,
          filename: fileNameWithSuffix,
          format: "A4",
          margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
          documentType: "INV",
        },
        { responseType: "blob" }
      );

      const pdfBlob = pdfRes.data;
      const pdfFile = new File([pdfBlob], fullFileName, {
        type: "application/pdf",
        lastModified: new Date().getTime(),
      });

      // Upload to server - uses template-specific path so new PDF does NOT overwrite existing
      await uploadPDFToServer(pdfFile, isSaaSTemplate);
    } catch (error) {
      console.error("Error generating PDF:", error);
      notifyError(
        ciText("Failed to generate PDF: {{message}}", {
          message: error.message,
        }),
      );
      setIsGenerating(false);
    }
  };
  const uploadPDFToServer = async (pdfFile, isSaaSTemplate = false) => {
    try {
      const formData = new FormData();
      formData.append("file", pdfFile);
      formData.append("uploadedBy", adminInfo.id);
      // Pass file_name so backend stores readable name; S3 key is always unique (timestamp+uuid) - never overwrites existing
      formData.append("file_name", pdfFile.name);
      const basePath = invoiceData?.title || invoiceData?.businessName || "Invoices";
      const currentYear = new Date().getFullYear();
      const customerName = invoiceData?.customer_name || invoiceData?.customerName || "Customer";
      const invNum = invoiceData?.invoice_number || invoiceData?.invoiceNumber || "Draft";
      // Use template-specific subfolder so new PDF goes to separate path - existing document stays unchanged
      const templateFolder = isSaaSTemplate
        ? "SaaS Invoice"
        : invoiceData?.location === "sales-orders"
          ? getModuleLabel("saleOrder", "Sale Order")
          : proformaInvoice
            ? "Proforma Invoice"
            : "Sales Contracts";
      formData.append(
        "file_path",
        `${basePath}/${currentYear}/Customers/${customerName}/${invNum}/${templateFolder}`
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

      // PDF generated successfully - no contract status updates
      // Invoice PDF generation is independent of contracts
      if (response.status === 200 && (response.data?.file || response.data?.data)) {
        notifySuccess(ciText("Document generated and saved successfully!"));
        if (onSuccess) onSuccess(response.data);
        onClose();
      }
    } catch (error) {
      console.error("Error uploading PDF:", error);
      notifyError(
        ciText("PDF generated but failed to upload: {{message}}", {
          message: error.message,
        }),
      );
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

  // Contract and contractDetails are optional for invoices
  // Only show error if we're missing essential data (templateData, invoiceData, businessDetails)
  if (!templateData || !invoiceData || !businessDetails) {
    return (
      <div style={{ padding: 40, color: "red" }}>
        {ciText(
          "Missing required data. Please ensure template, invoice data, and business details are available.",
        )}
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
          {templateData?.name || ciText("Document Preview")}
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
                {ciText("Invoice")}:{" "}
                {invoiceData?.invoice_number ||
                  invoiceData?.invoiceNumber ||
                  ciText("N/A")}
              </Typography>
              <Typography variant="caption" className="text-gray-500">
                {ciText("Template")}:{" "}
                {(fullTemplateData || templateData)?.name || ciText("N/A")}
              </Typography>
            </Box>
            <div className="border-0 overflow-hidden">
              <div className="bg-white p-0">
                <iframe
                  id="document-preview"
                  srcDoc={renderedHtml}
                  className="w-full min-h-[700px] border-0"
                  title={ciText("Document Preview")}
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
                {ciText("Add Signature")}
              </Button>
            )}
            {customer_signature && (
              <Button
                onClick={generatePDF}
                variant="outlined"
                startIcon={<Print />}
                disabled={isLoading || isGenerating}
              >
                {ciText("Save Upload")}
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
              {ciText("Print")}
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
              {isGenerating
                ? ciText("Generating...")
                : ciText("Generate & Save PDF")}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default DocumentGenerator;
