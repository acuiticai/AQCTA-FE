import { useState, useEffect, useRef, useContext } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";
import ejs from "ejs";
import { AdminContext } from "@/context/AdminContext";
import { processCommercialInvoiceTemplate, numberToWords } from "@/utils/invoiceTemplateProcessor";
import {
  formatInvoiceLineTaxColumnDisplay,
  calculateOrderDiscountPercentage,
  formatSummaryDiscountDisplay,
  rewriteInvoiceTemplateForDisplayLabels,
  mapInvoiceToUnifiedInvoiceContract,
  isSaleOrderDocumentTemplateType,
  isQuotationDocumentTemplateType,
  normalizeDocumentTemplateType,
  mapToSaleOrderTemplateData,
  mapToQuotationTemplateData,
  resolveTemplateLineItemDisplayCells,
  buildOrderDocumentItemsRowsHtml,
  scopeTemplateHtmlForEmbed,
} from "@/utils/invoiceContractMapper";
import {
  applyFullPdfCustomFieldsToHtml,
  replaceLineItemsTbodyRowsHtml,
} from "@/utils/customFieldsPdf";
import { getModuleLabel } from "@/utils/moduleLabels";
import { customerInvoiceText as ciText } from "@/utils/customerInvoiceI18n";
import { resolveFlexaLineBillingBreakdown } from "@/utils/itemDiscountUtils";
import { resolveContractPlaceholders } from "@/utils/invoicePlaceholderResolver";
import { resolveDocumentCompanyBranding } from "@/config/aqctaIdentity";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const InvoiceRenderer = ({
  invoice,
  template,
  previewMode = false,
  accountTypeName: propAccountTypeName,
  /** Optional: merged custom-field PDF rows from GET /custom-fields/pdf-payload (on-screen + download). */
  pdfPayload = null,
}) => {
  const { state } = useContext(AdminContext);
  const adminInfo = state?.adminInfo;
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [accountTypeName, setAccountTypeName] = useState("");
  const [profileSignature, setProfileSignature] = useState("");
  const invoiceRef = useRef(null);
  useEffect(() => {
    if (invoice && template) {
      setIsLoading(false);
    } else {
      setError(ciText("Missing required invoice or template data"));
    }
  }, [invoice, template]);

  useEffect(() => {
    // Fetch account type name if needed
    const fetchAccountTypeName = async () => {
      let typeId = invoice?.contract_id?.Account_Info?.accountType;
      if (typeId && typeof typeId === "string" && typeId.length === 24) {
        try {
          const res = await axios.get(`/api/bank-account-types/${typeId}`);
          setAccountTypeName(res.data?.name || "");
        } catch (e) {
          setAccountTypeName("");
        }
      } else if (typeof typeId === "string") {
        setAccountTypeName(typeId); // fallback if already a name
      } else {
        setAccountTypeName("");
      }
    };
    if (propAccountTypeName) {
      setAccountTypeName(propAccountTypeName);
    } else {
      fetchAccountTypeName();
    }
  }, [invoice, propAccountTypeName]);

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

  useEffect(() => {
    const signatureFromInvoice = normalizeSignatureUrl(
      invoice?.signature ||
        invoice?.approver_signature ||
        invoice?.adminSignature ||
        invoice?.admin_signature ||
        ""
    );

    if (signatureFromInvoice || !adminInfo?.id) {
      return;
    }

    const fetchProfileSignature = async () => {
      try {
        const response = await axios.get(`${Base_URL}/admin/profile/${adminInfo.id}`, {
          headers: adminInfo?.token
            ? { authorization: `Bearer ${adminInfo.token}` }
            : undefined,
        });
        const resolved = normalizeSignatureUrl(response?.data?.signature || "");
        if (resolved) {
          setProfileSignature(resolved);
        }
      } catch (e) {
        // Signature is optional; keep rendering without it.
      }
    };

    fetchProfileSignature();
  }, [
    adminInfo?.id,
    adminInfo?.token,
    invoice?.signature,
    invoice?.approver_signature,
    invoice?.adminSignature,
    invoice?.admin_signature,
  ]);

  // Add print-specific styles
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @media print {
        body * {
          visibility: hidden;
        }
        .invoice-container, .invoice-container * {
          visibility: visible;
        }
        .invoice-container {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
        }
        .no-print {
          display: none !important;
        }
        /* Print-specific styles */
        .invoice-container {
          background: white !important;
          color: black !important;

        }
        .invoice-container * {
          color: black !important;
          background: white !important;
        }
        table {
          border-collapse: collapse !important;
        }
        table, th, td {
          border: 1px solid black !important;
        }
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);


  if (isLoading) {
    return <div className="p-8 text-center">{ciText("Loading invoice data...")}</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-red-600">{error}</div>;
  }

  const renderInvoice = () => {
    const rawType = template?.type || template?.data?.type || "";
    const normalizedType = normalizeDocumentTemplateType(rawType);
    const resolvedSignature = normalizeSignatureUrl(
      invoice?.signature ||
        invoice?.approver_signature ||
        invoice?.adminSignature ||
        invoice?.admin_signature ||
        profileSignature ||
        ""
    );

    // Sale Order templates use a dedicated EJS `saleorder.*` data shape
    if (isSaleOrderDocumentTemplateType(rawType, rawType)) {
      return (
        <SaleOrderTemplateRenderer
          invoice={invoice}
          template={template}
        />
      );
    }

    // Unified invoice templates (template builder) — EJS `contract` shape
    if (normalizedType === "invoice") {
      return (
        <UnifiedInvoice
          invoice={invoice}
          template={template}
          fallbackSignature={resolvedSignature}
          pdfPayload={pdfPayload}
        />
      );
    }

    // Commercial Invoice templates (legacy) - type "commercial invoice"
    if (normalizedType === "commercialinvoice") {
      return (
        <LegacyCommercialInvoice
          invoice={invoice}
          template={template}
          fallbackSignature={resolvedSignature}
        />
      );
    }

    // Fallback: try unified path if template has htmlContent (e.g. Proforma with same structure)
    const htmlContent = template?.htmlContent || template?.data?.htmlContent;
    if (htmlContent && normalizedType !== "invoice") {
      return (
        <UnifiedInvoice
          invoice={invoice}
          template={template}
          fallbackSignature={resolvedSignature}
          pdfPayload={pdfPayload}
        />
      );
    }

    return (
      <div className="p-8 text-center text-amber-600">
        {ciText("Template type \"{{type}}\" is not supported for preview.", {
          type:
            template?.type ||
            template?.data?.type ||
            ciText("unknown"),
        })}
      </div>
    );
  };

  return (
    <div
      className={`invoice-container ${previewMode ? "preview-mode" : ""}`}
      ref={invoiceRef}
      style={{
        width: '100%',
        minHeight: 'auto',
        overflow: 'visible',
        position: 'relative',
      }}
    >
      {renderInvoice()}
    </div>
  );
};

/**
 * Renders Commercial Invoice templates (type: "Commercial Invoice").
 * Uses prepareUnifiedInvoiceContractData + extensions for processCommercialInvoiceTemplate compatibility.
 */
const LegacyCommercialInvoice = ({ invoice, template, fallbackSignature = "" }) => {
  if (!invoice || !template) {
    return <div className="p-8 text-center">{ciText("Missing invoice or template data")}</div>;
  }

  const htmlContent = template.htmlContent || template.data?.htmlContent;
  if (!htmlContent) {
    return <div className="p-8 text-center">{ciText("Template HTML content is missing")}</div>;
  }

  const baseContract = prepareUnifiedInvoiceContractData(invoice, fallbackSignature);
  const currency = baseContract.currency || "MYR";

  // Extend contract for Commercial Invoice template expectations
  const rawContract = {
    ...baseContract,
    totalValue: baseContract.total,
    totalInWords: numberToWords(baseContract.total, currency),
    contract_no: baseContract.invoice_number || baseContract.ref,
    payment: invoice.terms || invoice.termsAndConditions || baseContract.termsAndConditions || "Due on Receipt",
    poNumber: invoice.poNumber || invoice.po_number || invoice.po_no || "",
    po_no: invoice.poNumber || invoice.po_number || invoice.po_no || "",
    items: (baseContract.items || []).map((it) => ({
      ...it,
      unitPrice: it.price ?? it.rate ?? 0,
    })),
  };
  /**
   * Same placeholder resolution as the unified path so legacy Commercial
   * Invoice templates also render real dates instead of `%(d)%/%(m)%/%(y)%`.
   */
  const contract = resolveContractPlaceholders(rawContract, { invoice });

  try {
    const processedHtml = processCommercialInvoiceTemplate(htmlContent, contract);

    const extractBodyAndHeadStyles = (html) => {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        const headStyles = Array.from(doc.head?.querySelectorAll("style") || [])
          .map((s) => s.textContent || "")
          .filter(Boolean)
          .join("\n");
        const bodyHtml = doc.body?.innerHTML || "";
        return { headStyles, bodyHtml };
      } catch (e) {
        return { headStyles: "", bodyHtml: html };
      }
    };

    const { headStyles, bodyHtml } = extractBodyAndHeadStyles(processedHtml);
    const safetyStyles = `
      .invoice-container { overflow: visible !important; height: auto !important; max-height: none !important; }
      .invoice-container table { width: 100%; border-collapse: collapse; }
      .invoice-container thead { display: table-header-group; }
      .invoice-container tbody { display: table-row-group; }
      .invoice-container tr { display: table-row; }
      .invoice-container th, .invoice-container td {
        display: table-cell;
        padding-left: 8px !important;
        padding-right: 8px !important;
      }
    `;

    const styledHtml = `
      <style>${headStyles}${safetyStyles}</style>
      ${bodyHtml || processedHtml}
    `;

    return (
      <div className="invoice-container" style={{ width: "100%", padding: "20px" }}>
        <div dangerouslySetInnerHTML={{ __html: styledHtml }} />
      </div>
    );
  } catch (error) {
    console.error("Error rendering Commercial Invoice template:", error);
    return (
      <div className="p-8 bg-red-100 text-red-700 border border-red-300 rounded">
        <h2 className="text-lg font-bold">
          {ciText("Error rendering Commercial Invoice")}
        </h2>
        <p>{error.message}</p>
      </div>
    );
  }
};

/**
 * Page styling shared by saleorder/quotation template renderers. Wraps rendered
 * content in an A4-sized white "page" so on-screen preview matches the PDF layout.
 *
 * Width is set in pixels because html2canvas captures pixel-based DOM. 794px @ 96dpi ≈ A4 width (210mm).
 */
const TEMPLATE_PAGE_STYLES = `
.tpl-doc-page-wrap {
  display: flex;
  justify-content: center;
  background: #f3f4f6;
  padding: 24px 12px;
  width: 100%;
}
.tpl-doc-page {
  width: 794px;
  min-height: 1123px;
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.06);
  border: 1px solid #e5e7eb;
  overflow: hidden;
  position: relative;
}
@media print {
  .tpl-doc-page-wrap { background: #fff; padding: 0; }
  .tpl-doc-page { box-shadow: none; border: 0; width: 100%; }
}
`;

/**
 * Renders an HTML document template inside an A4-sized page container.
 * Scopes the template's `body` styles to the wrapper so template padding
 * and fonts are preserved without leaking into the host app.
 */
const TemplateDocumentRenderer = ({ html, label = "Document", onRefReady }) => {
  const wrapClass = "tpl-doc-body";
  const { styles, body } = scopeTemplateHtmlForEmbed(html, wrapClass);
  const ref = useRef(null);
  useEffect(() => {
    if (typeof onRefReady === "function") onRefReady(ref.current);
  }, [onRefReady]);
  return (
    <div className="tpl-doc-page-wrap">
      <style>{TEMPLATE_PAGE_STYLES}</style>
      <div
        className="tpl-doc-page invoice-container"
        ref={ref}
        aria-label={label}
      >
        {styles ? <style dangerouslySetInnerHTML={{ __html: styles }} /> : null}
        <div className={wrapClass} dangerouslySetInnerHTML={{ __html: body }} />
      </div>
    </div>
  );
};

/**
 * Renders Sale Order document templates (type: "saleorder"). Templates use the
 * `saleorder.*` EJS shape (companyName, customerName, items, etc.).
 */
const SaleOrderTemplateRenderer = ({ invoice, template }) => {
  const saleOrderLabel = getModuleLabel("saleOrder", "Sale Order");
  if (!invoice || !template) {
    return (
      <div className="p-8 text-center">{`Missing ${saleOrderLabel.toLowerCase()} or template data`}</div>
    );
  }
  const htmlContent = template.htmlContent || template.data?.htmlContent;
  if (!htmlContent) {
    return <div className="p-8 text-center">{ciText("Template HTML content is missing")}</div>;
  }
  try {
    const business = invoice.business_id || invoice.business || {};
    const saleorder = mapToSaleOrderTemplateData(invoice, business);
    const contract = {
      ...saleorder,
      invoice_number: saleorder.orderNumber,
      invoiceNumber: saleorder.orderNumber,
    };
    let rendered;
    try {
      rendered = ejs.render(htmlContent, { saleorder, contract }, { strict: false });
      rendered = replaceLineItemsTbodyRowsHtml(
        rendered,
        saleorder.items?.length || 0,
        buildOrderDocumentItemsRowsHtml(saleorder.items),
      );
    } catch (ejsErr) {
      console.error("EJS render failed for sale order template:", ejsErr);
      rendered = `<div style="padding:24px;color:#b91c1c;text-align:center;">Failed to render sale order template: ${ejsErr.message}</div>`;
    }
    return <TemplateDocumentRenderer html={rendered} label={saleOrderLabel} />;
  } catch (error) {
    console.error("Error rendering Sale Order template:", error);
    return (
      <div className="p-8 bg-red-100 text-red-700 border border-red-300 rounded">
        <h2 className="text-lg font-bold">
          {ciText("Error rendering {{document}}", {
            document: saleOrderLabel,
          })}
        </h2>
        <p>{error.message}</p>
      </div>
    );
  }
};

/**
 * Renders Quotation document templates (type: "quotation"). Templates use the
 * `quotation.*` EJS shape.
 */
export const QuotationTemplateRenderer = ({ quotation, template }) => {
  const { t } = useTranslation();
  if (!quotation || !template) {
    return (
      <div className="p-8 text-center">
        {t("accounts.quotations.renderer.missingData", {
          defaultValue: "Missing quotation or template data",
        })}
      </div>
    );
  }
  const htmlContent = template.htmlContent || template.data?.htmlContent;
  if (!htmlContent) {
    return (
      <div className="p-8 text-center">
        {t("accounts.quotations.renderer.missingHtml", {
          defaultValue: "Template HTML content is missing",
        })}
      </div>
    );
  }
  try {
    const business = quotation.business_id || quotation.business || {};
    const data = mapToQuotationTemplateData(quotation, business);
    const contract = {
      ...data,
      invoice_number: data.quoteNumber,
      invoiceNumber: data.quoteNumber,
    };
    let rendered;
    try {
      rendered = ejs.render(htmlContent, { quotation: data, contract }, { strict: false });
      rendered = replaceLineItemsTbodyRowsHtml(
        rendered,
        data.items?.length || 0,
        buildOrderDocumentItemsRowsHtml(data.items),
      );
    } catch (ejsErr) {
      console.error("EJS render failed for quotation template:", ejsErr);
      rendered = `<div style="padding:24px;color:#b91c1c;text-align:center;">${t(
        "accounts.quotations.renderer.renderFailed",
        {
          defaultValue: "Failed to render quotation template: {{message}}",
          message: ejsErr.message,
        },
      )}</div>`;
    }
    return (
      <TemplateDocumentRenderer
        html={rendered}
        label={t("accounts.quotations.singular", { defaultValue: "Quotation" })}
      />
    );
  } catch (error) {
    console.error("Error rendering Quotation template:", error);
    return (
      <div className="p-8 bg-red-100 text-red-700 border border-red-300 rounded">
        <h2 className="text-lg font-bold">
          {t("accounts.quotations.renderer.errorTitle", {
            defaultValue: "Error rendering Quotation",
          })}
        </h2>
        <p>{error.message}</p>
      </div>
    );
  }
};

/**
 * Component to render unified invoice templates (type: "invoice") created from template builder.
 * This path intentionally avoids the legacy CommercialInvoice string-munging, and instead
 * renders EJS-style HTML content using `processTemplate` with a contract object that matches
 * the template's expected fields.
 */
const UnifiedInvoice = ({ invoice, template, fallbackSignature = "", pdfPayload = null }) => {
  if (!invoice || !template) {
    return <div className="p-8 text-center">{ciText("Missing invoice or template data")}</div>;
  }

  const htmlContent = template.htmlContent || template.data?.htmlContent;
  if (!htmlContent) {
    return <div className="p-8 text-center">{ciText("Template HTML content is missing")}</div>;
  }

  // Match DocumentGenerator / email preview + PDF: same `contract` as `mapInvoiceToUnifiedInvoiceContract`
  // (summary discount %, line `invoiceTaxColumnDisplay`, etc.), with prepareUnified for extra aliases + tax totals.
  const loc = (invoice?.location || "").toLowerCase();
  const isSalesOrderPreview = loc === "sales-orders" || loc === "purchase-orders";
  const business = invoice.business_id || invoice.business || {};
  const prepared = prepareUnifiedInvoiceContractData(invoice, fallbackSignature);
  const mapped = mapInvoiceToUnifiedInvoiceContract(invoice, business);
  const rawItems = Array.isArray(invoice.items) ? invoice.items : [];

  const rawContract = {
    ...prepared,
    ...mapped,
    // Restore viewer/API header enrichment when mapped has empty strings
    invoice_number: prepared.invoice_number || mapped.invoice_number,
    businessLogo: prepared.businessLogo || mapped.businessLogo,
    businessName: prepared.businessName || mapped.businessName,
    businessAddress: prepared.businessAddress || mapped.businessAddress,
    businessPhone: prepared.businessPhone || mapped.businessPhone,
    businessEmail: prepared.businessEmail || mapped.businessEmail,
    items: isSalesOrderPreview ? rawItems : mapped.items,
    // Same discount contract as DocumentGenerator / email PDF (summary %)
    discount: mapped.discount,
    discountAmount: mapped.discountAmount,
    discountPercentage: mapped.discountPercentage,
    summaryDiscountPercentage: mapped.summaryDiscountPercentage,
    summaryDiscountDisplay: mapped.summaryDiscountDisplay,
    subtotal: mapped.subtotal,
    total: mapped.total,
    // Keep viewer summary tax from prepareUnified
    tax: prepared.tax,
    taxTotal: prepared.taxTotal ?? prepared.tax,
    signature:
      mapped.signature ||
      prepared.signature ||
      fallbackSignature ||
      "",
  };
  /**
   * Resolve %(d)/%(m)/%(y+1)% style tokens against the invoice's own date +
   * Configuration date format so the on-screen viewer matches the PDF /
   * email output instead of leaking raw template text.
   */
  const contract = resolveContractPlaceholders(rawContract, {
    invoice,
    business,
  });
  contract.authorizedSignature = contract.signature;
  contract.approver_signature = contract.signature;

  // Add calculatedTotal for template compatibility
  const calculatedTotal = contract.total || 0;
  const contractWithCalculatedTotal = {
    ...contract,
    calculatedTotal: calculatedTotal.toFixed(2),
  };

  // Debug logging intentionally removed (was used for troubleshooting Sales Order templates)

  try {
    // Pre-process known critical fields (business + bill/ship to) to avoid them
    // being lost if EJS evaluation fails for complex expressions.
    const c = contractWithCalculatedTotal;
    let safeHtml = rewriteInvoiceTemplateForDisplayLabels(htmlContent);

    const safeReplace = (pattern, value, fallback) => {
      const finalValue = value || fallback || "";
      if (!finalValue) return;
      safeHtml = safeHtml.replace(pattern, String(finalValue));
    };
    // Force replace - always replaces even when value is empty (for date, terms, dueDate)
    const forceReplace = (pattern, value) => {
      safeHtml = safeHtml.replace(pattern, String(value ?? ""));
    };

    // Business name
    safeReplace(
      /<%= contract\.businessName[\s\S]*?%>/g,
      c.businessName,
      "COMPANY NAME"
    );

    // BILL TO
    safeReplace(
      /<%= contract\.buyerName[\s\S]*?%>/g,
      c.buyerName,
      "Customer Name"
    );
    // Company name (customer's company). Do NOT fall back to buyerName so we can
    // reliably detect "no company" cases in templates.
    safeReplace(
      /<%= contract\.buyerCompany[\s\S]*?%>/g,
      c.buyerCompany,
      ""
    );
    safeReplace(
      /<%= contract\.buyerAddress[\s\S]*?%>/g,
      c.buyerAddress || c.billingAddress,
      "Customer Address"
    );
    // Customer phone (support multiple legacy field names)
    safeReplace(
      /<%= contract\.(?:buyerPhone|customerPhone|customer_phone|phoneNumber|phone)[\s\S]*?%>/g,
      c.buyerPhone || c.customerPhone || c.customer_phone || c.phoneNumber || c.phone,
      ""
    );
    // Customer email (support multiple legacy field names)
    safeReplace(
      /<%= contract\.(?:buyerEmail|customerEmail|customer_email|email)[\s\S]*?%>/g,
      c.buyerEmail || c.customerEmail || c.customer_email || c.email,
      ""
    );

    // SHIP TO
    safeReplace(
      /<%= contract\.shipToName[\s\S]*?%>/g,
      c.shipToName || c.buyerName,
      "Customer Name"
    );
    safeReplace(
      /<%= contract\.shipToCompany[\s\S]*?%>/g,
      c.shipToCompany || c.buyerCompany,
      "Company Name"
    );
    safeReplace(
      /<%= contract\.shipToAddress[\s\S]*?%>/g,
      c.shipToAddress || c.shippingAddress || c.buyerAddress,
      "Shipping Address"
    );
    safeReplace(
      /<%= contract\.shipToPhone[\s\S]*?%>/g,
      c.shipToPhone || c.buyerPhone || c.customerPhone || c.phoneNumber,
      ""
    );
    safeReplace(
      /<%= contract\.shipToEmail[\s\S]*?%>/g,
      c.shipToEmail || c.buyerEmail || c.customerEmail,
      ""
    );

    // Invoice reference/date aliases (templates use different keys)
    safeReplace(
      /<%= contract\.(?:invoice_number|invoiceNumber|invoiceNo|invoice_no|ref|number)[\s\S]*?%>/g,
      c.invoice_number || c.invoiceNumber || c.invoiceNo || c.ref || c.number,
      ""
    );
    safeReplace(
      /<%= contract\.(?:dueDate|due_date|dueDateValue|due_date_value)[\s\S]*?%>/g,
      c.dueDate || c.due_date || c.dueDateValue || c.due_date_value,
      ""
    );
    safeReplace(
      /<%= contract\.(?:salesPerson|sales_person|salesperson|salesPersonName)[\s\S]*?%>/g,
      c.salesPerson || c.sales_person || c.salesperson || c.salesPersonName,
      ""
    );

    // Force replace for date, terms, dueDate (Template 2 / JomSmart invoice-meta) - always replace even when empty
    forceReplace(
      /<%= contract\.(?:date|invoice_date|invoiceDate|invoice_date_value)[\s\S]*?%>/g,
      c.date || c.invoice_date || c.invoiceDate || ""
    );
    forceReplace(
      /<%= contract\.(?:terms|paymentTerms)[\s\S]*?%>/g,
      c.terms || c.paymentTerms || "Due on Receipt"
    );

    let finalHtml;
    try {
      finalHtml = ejs.render(
        safeHtml,
        { contract: contractWithCalculatedTotal },
        { strict: false },
      );
    } catch (ejsErr) {
      console.warn(
        "Unified invoice EJS render failed, falling back to processTemplate:",
        ejsErr?.message,
      );
      finalHtml = processTemplate(
        safeHtml,
        { contract: contractWithCalculatedTotal },
        { contract: contractWithCalculatedTotal, ...contractWithCalculatedTotal },
      );
    }

    // Fix "Total ()" in template - replace with currency
    const invoiceCurrency = invoice.currency || "MYR";
    finalHtml = finalHtml.replace(
      /Total\s*\(\s*\)/g,
      `Total (${invoiceCurrency})`
    );
    // Also fix variations like "Total ( )" or "Total( )"
    finalHtml = finalHtml.replace(
      /Total\s*\(\s*\s*\)/g,
      `Total (${invoiceCurrency})`
    );
    // Fix if template has "Total (<%= contract.currency %>)" but currency is empty
    finalHtml = finalHtml.replace(
      /Total\s*\(\s*<%=.*?contract\.currency.*?%>\s*\)/g,
      `Total (${invoiceCurrency})`
    );

    // Replace any hardcoded payment-info (Method Of Payment / bank account) with dynamic terms and conditions
    const termsForDisplay = (contractWithCalculatedTotal.termsAndConditions || "")
      .replace(/\$/g, "$$$$")
      .replace(/\n/g, "<br/>");
    finalHtml = finalHtml.replace(
      /<div class="payment-info">\s*<div>1\. Method Of Payment[\s\S]*?21400015058\s*<\/div>\s*<\/div>\s*<div class="financial-summary">/g,
      `<div class="payment-info">${termsForDisplay}</div>\n      <div class="financial-summary">`
    );
    finalHtml = finalHtml.replace(
      /<div class="payment-info">\s*(?:<div>[\s\S]*?<\/div>\s*){2,}\s*<\/div>\s*<div class="financial-summary">/g,
      `<div class="payment-info">${termsForDisplay}</div>\n      <div class="financial-summary">`
    );
    // Catch any payment-info block containing the hardcoded bank/account text
    finalHtml = finalHtml.replace(
      /<div class="payment-info">[\s\S]*?ABDUL HAMEED[\s\S]*?21400015058[\s\S]*?<\/div>\s*<div class="financial-summary">/gi,
      `<div class="payment-info">${termsForDisplay}</div>\n      <div class="financial-summary">`
    );

    // Ensure terms and conditions show in 2nd template (JomSmart etc.): inject into .terms-section .terms-content
    // when empty or still containing EJS placeholders, and into any remaining .payment-info
    if (termsForDisplay !== "" || contractWithCalculatedTotal.termsAndConditions) {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(finalHtml, "text/html");
        const termsContentDivs = doc.querySelectorAll(".terms-section .terms-content, .terms-content");
        termsContentDivs.forEach((el) => {
          const raw = (el.innerHTML || "").trim();
          const hasUnresolvedEJS = /<%=|<%-|<%[\s]/.test(raw);
          if (hasUnresolvedEJS || (raw === "" && termsForDisplay)) {
            el.innerHTML = termsForDisplay;
          }
        });
        const paymentInfoDivs = doc.querySelectorAll(".payment-info");
        paymentInfoDivs.forEach((el) => {
          const raw = (el.innerHTML || "").trim();
          const hasUnresolvedEJS = /<%=|<%-|<%[\s]/.test(raw);
          if (hasUnresolvedEJS && termsForDisplay) {
            el.innerHTML = termsForDisplay;
          }
        });
        finalHtml = doc.documentElement.outerHTML;
      } catch (e) {
        // non-fatal: keep finalHtml as is
      }
    }

    // Ensure business address shows below business name (company-name) - single line for customer invoice template
    const businessAddr = String(contractWithCalculatedTotal.businessAddress || "").trim();
    if (businessAddr) {
      const addrOneLine = businessAddr.replace(/\s+/g, " ").replace(/\n/g, " ").trim();
      const businessBlock = `<div class="company-address" style="font-size: 11px; font-weight: 400; line-height: 1.4; color: #000; margin-bottom: 8px;">${addrOneLine}</div>`;
      finalHtml = finalHtml.replace(
        /(<div class="company-name">[\s\S]*?<\/div>)\s*(<div class="company-address">[\s\S]*?<\/div>)/,
        `$1\n                ${businessBlock}`
      );
    }

    // Inject signature image into common "Authorized Signature" placeholders.
    if (contractWithCalculatedTotal.signature) {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(finalHtml, "text/html");
        const signatureUrl = contractWithCalculatedTotal.signature;

        const isInvalidSrc = (src) =>
          !src ||
          src === "#" ||
          src.includes("<%") ||
          src.includes("{{") ||
          src.includes("undefined") ||
          src.includes("null");

        const signatureImgSelectors = [
          ".signature-box .logo img",
          ".authorized-signature img",
          "img[alt*='signature' i]",
        ];

        signatureImgSelectors.forEach((selector) => {
          doc.querySelectorAll(selector).forEach((img) => {
            const currentSrc = (img.getAttribute("src") || "").trim();
            if (isInvalidSrc(currentSrc)) {
              img.setAttribute("src", signatureUrl);
            }
            img.setAttribute("alt", "Authorized Signature");
            img.style.maxHeight = img.style.maxHeight || "80px";
          });
        });

        // Primary target: template "signature-section" block.
        // Keep only one signature image and place it above dotted line + label.
        const signatureSections = Array.from(
          doc.querySelectorAll(".signature-section")
        );

        signatureSections.forEach((section) => {
          let allImages = Array.from(section.querySelectorAll("img"));
          let mainImage = allImages[0] || null;

          if (!mainImage) {
            mainImage = doc.createElement("img");
            mainImage.setAttribute("src", signatureUrl);
            section.insertBefore(mainImage, section.firstChild);
            allImages = [mainImage];
          }

          // Remove duplicates if any.
          allImages.slice(1).forEach((img) => img.remove());

          mainImage.setAttribute("src", signatureUrl);
          mainImage.setAttribute("alt", "Authorized Signature");
          mainImage.style.maxHeight = "80px";
          mainImage.style.display = "block";
          mainImage.style.marginBottom = "6px";

          const signatureLine = section.querySelector(".signature-line");
          const signatureLabel = section.querySelector(".signature-label");

          if (signatureLine && mainImage.nextSibling !== signatureLine) {
            section.insertBefore(mainImage, signatureLine);
          } else if (
            !signatureLine &&
            signatureLabel &&
            mainImage.nextSibling !== signatureLabel
          ) {
            section.insertBefore(mainImage, signatureLabel);
          }
        });

        // Fallback for older templates without signature-section.
        if (signatureSections.length === 0) {
          const signatureContainers = [
            ".signature-placeholder",
            ".signature-box .logo",
            ".authorized-signature",
          ];

          signatureContainers.forEach((selector) => {
            doc.querySelectorAll(selector).forEach((container) => {
              const existingImages = Array.from(container.querySelectorAll("img"));
              const mainImage = existingImages[0] || doc.createElement("img");

              if (!existingImages.length) {
                container.insertBefore(mainImage, container.firstChild);
              }
              existingImages.slice(1).forEach((img) => img.remove());

              mainImage.setAttribute("src", signatureUrl);
              mainImage.setAttribute("alt", "Authorized Signature");
              mainImage.style.maxHeight = "80px";
              mainImage.style.display = "block";
              mainImage.style.marginBottom = "6px";
            });
          });
        }

        finalHtml = doc.documentElement.outerHTML;
      } catch (e) {
        // Keep template render path resilient even if DOM signature injection fails.
      }
    }
    
    // Ensure items table renders correctly (unified for both Sales Order preview and regular invoices)
    // Templates with separate Description column: Item col = name only, Description col = description only
    // Templates with "Item & Description" combined: show description under item name when present
    if (contractWithCalculatedTotal.items && contractWithCalculatedTotal.items.length > 0) {
      const itemsArray = contractWithCalculatedTotal.items;
      // Detect if template has separate Description column (not "Item & Description")
      const hasSeparateDescCol = /<th[^>]*>\s*Description\s*<\/th>/i.test(finalHtml) &&
        !/<th[^>]*>.*Item\s*&\s*Description.*<\/th>/i.test(finalHtml);

      const rowsHtml = itemsArray
        .map((item, idx) => {
          const {
            combinedPrimary,
            combinedSubtitle,
            separateNameCell,
            separateDescriptionCell,
          } = resolveTemplateLineItemDisplayCells(item);
          const quantity = Number(item.quantity || item.qty || 0);
          const price = Number(item.price || item.unitPrice || item.rate || 0);
          const discountPercent = Number(item.discount ?? 0);
          const lineSubtotal = Math.max(0, quantity * price * (1 - discountPercent / 100));
          const taxRate = Number(item.taxRate ?? 0);
          const taxName = String(item.taxName || item.tax_label || item.taxLabel || "").trim();
          const taxAmountFromApi = Number(item.taxAmount ?? item.tax ?? 0);
          const tax =
            taxAmountFromApi ||
            (taxRate ? (lineSubtotal * taxRate) / 100 : 0);
          const computedLineTotal = Math.max(0, lineSubtotal + tax);
          const providedTotal = Number(item.total ?? item.totalValue ?? item.amount ?? 0);
          const tolerance = 0.01;
          const total =
            providedTotal > 0
              ? Math.abs(providedTotal - computedLineTotal) < tolerance
                ? providedTotal
                : Math.abs(providedTotal - lineSubtotal) < tolerance && tax > 0
                  ? providedTotal + tax
                  : computedLineTotal
              : computedLineTotal;
          const taxDisplay = formatInvoiceLineTaxColumnDisplay({
            tax,
            taxRate,
            taxName,
            taxAmount: tax,
          });

          if (hasSeparateDescCol) {
            // Template has Description column: Item = name only, Description = description only
            const nameHtml = separateNameCell || "&nbsp;";
            const itemCell = `<div class="item-desc-main">${nameHtml}</div>`;
            const descCell = separateDescriptionCell
              ? `<div class="item-desc-sub">${separateDescriptionCell}</div>`
              : "";
            return `
              <tr>
                <td>${idx + 1}</td>
                <td>${itemCell}</td>
                <td>${descCell}</td>
                <td>${quantity}</td>
                <td>${price.toFixed(2)}</td>
                <td>${discountPercent.toFixed(2)}%</td>
                <td>${taxDisplay}</td>
                <td>${total.toFixed(2)}</td>
              </tr>
            `;
          }
          // Template has "Item & Description" combined: subtitle only when name and description both exist and differ
          const itemDescCell = combinedSubtitle
            ? `<div class="item-desc-main">${combinedPrimary}</div><div class="item-desc-sub" style="font-size: 0.9em; color: #666; margin-top: 2px;">${combinedSubtitle}</div>`
            : `<div class="item-desc-main">${combinedPrimary}</div>`;
          return `
              <tr>
                <td>${idx + 1}</td>
                <td>${itemDescCell}</td>
                <td>${quantity}</td>
                <td>${price.toFixed(2)}</td>
                <td>${discountPercent.toFixed(2)}%</td>
                <td>${taxDisplay}</td>
                <td>${total.toFixed(2)}</td>
              </tr>
            `;
        })
        .join("");

      const afterRows = replaceLineItemsTbodyRowsHtml(
        finalHtml,
        itemsArray.length,
        rowsHtml,
      );
      if (afterRows !== finalHtml) {
        finalHtml = afterRows;
      } else {
        const headerIndex =
          finalHtml.indexOf("Item</th>") !== -1
            ? finalHtml.indexOf("Item</th>")
            : finalHtml.indexOf("Item & Description</th>");
        const tbodyStart =
          headerIndex !== -1
            ? finalHtml.indexOf("<tbody", headerIndex)
            : finalHtml.indexOf("<tbody");

        if (tbodyStart !== -1) {
          const openTagEnd = finalHtml.indexOf(">", tbodyStart);
          const tbodyEnd = finalHtml.indexOf("</tbody>", openTagEnd);
          if (openTagEnd !== -1 && tbodyEnd !== -1) {
            const before = finalHtml.slice(0, openTagEnd + 1);
            const after = finalHtml.slice(tbodyEnd);
            finalHtml = `${before}${rowsHtml}${after}`;
          }
        }
      }
    }
    
    // The template often includes a full HTML document (<!doctype><html><head>...<body>...).
    // Rendering that whole document inside a div is unreliable; extract <style> from <head>
    // and only render the <body> content.
    const extractBodyAndHeadStyles = (html) => {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        const headStyles = Array.from(doc.head?.querySelectorAll("style") || [])
          .map((s) => s.textContent || "")
          .filter(Boolean)
          .join("\n");
        const bodyHtml = doc.body?.innerHTML || "";
        return { headStyles, bodyHtml };
      } catch (e) {
        return { headStyles: "", bodyHtml: html };
      }
    };

    const { headStyles, bodyHtml } = extractBodyAndHeadStyles(finalHtml);

    const bodyForDisplay =
      pdfPayload &&
      (pdfPayload.rows?.length || pdfPayload.line_items?.columns?.length)
        ? applyFullPdfCustomFieldsToHtml(bodyHtml || finalHtml, {
            headerRows: pdfPayload.rows,
            line_items: pdfPayload.line_items,
          })
        : bodyHtml || finalHtml;

    // Minimal safety styles to avoid clipping and preserve table layout (do NOT override template layout)
    const safetyStyles = `
      .invoice-container { overflow: visible !important; height: auto !important; max-height: none !important; box-sizing: border-box; }
      .invoice-container > div { margin: 0; padding: 0; max-width: 100%; box-sizing: border-box; }
      .invoice-container,
      .invoice-container * {
        font-size: inherit;
      }
      .invoice-container {
        font-size: 13px !important;
        line-height: 1.45 !important;
      }
      .invoice-container table { width: 100% !important; max-width: 100% !important; border-collapse: collapse; margin: 0 !important; box-sizing: border-box; table-layout: auto; }
      .invoice-container .items-table,
      .invoice-container table.items-table { width: 100% !important; max-width: 100% !important; margin-left: 0 !important; margin-right: 0 !important; }
      .invoice-container .company-name { font-size: 16px !important; }
      .invoice-container .company-address,
      .invoice-container .company-contact,
      .invoice-container .invoice-details,
      .invoice-container .invoice-meta,
      .invoice-container .document-meta,
      .invoice-container .billing-shipping,
      .invoice-container .financial-summary,
      .invoice-container .summary-box,
      .invoice-container .payment-info {
        font-size: 11.5px !important;
      }
      .invoice-container .invoice-title { font-size: 19px !important; }
      .invoice-container .items-table,
      .invoice-container table.items-table {
        font-size: 12px !important;
      }
      .invoice-container .invoice-details,
      .invoice-container .invoice-meta,
      .invoice-container .document-meta {
        display: flex !important;
        flex-wrap: wrap !important;
        justify-content: space-between !important;
        align-items: flex-start !important;
        gap: 10px 14px !important;
        margin-bottom: 18px !important;
      }
      .invoice-container .detail-row {
        display: inline-flex !important;
        align-items: baseline !important;
        gap: 6px !important;
        margin: 0 !important;
        flex: 0 1 auto;
        min-width: max-content;
        max-width: 100%;
      }
      .invoice-container .detail-label {
        white-space: nowrap !important;
        flex: 0 0 auto;
      }
      .invoice-container .detail-value {
        overflow-wrap: anywhere;
        word-break: break-word;
      }
      .invoice-container .invoice-details > [data-flexa-cf-header="1"],
      .invoice-container .invoice-meta > [data-flexa-cf-header="1"],
      .invoice-container .document-meta > [data-flexa-cf-header="1"] {
        flex: 1 1 240px !important;
        width: auto !important;
        max-width: 340px !important;
        margin-top: 0 !important;
      }
      .invoice-container .header-separator {
        margin: 14px 0 12px !important;
      }
      .invoice-container .invoice-title {
        margin: 12px 0 18px !important;
      }
      .invoice-container .billing-shipping {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
        gap: 32px !important;
        align-items: start !important;
        margin-bottom: 22px !important;
      }
      .invoice-container .address-grid {
        column-gap: 8px !important;
      }
      .invoice-container .items-table,
      .invoice-container table.items-table {
        margin-top: 20px !important;
      }
      .invoice-container .items-table th,
      .invoice-container .items-table td,
      .invoice-container table.items-table th,
      .invoice-container table.items-table td {
        vertical-align: top !important;
        padding-left: 10px !important;
        padding-right: 10px !important;
      }
      .invoice-container .items-table thead th,
      .invoice-container table.items-table thead th {
        white-space: nowrap !important;
        font-weight: 700 !important;
        padding-top: 8px !important;
        padding-bottom: 8px !important;
      }
      .invoice-container .items-table tbody td,
      .invoice-container table.items-table tbody td {
        padding-top: 10px !important;
        padding-bottom: 10px !important;
      }
      .invoice-container .items-table th:first-child,
      .invoice-container .items-table td:first-child,
      .invoice-container table.items-table th:first-child,
      .invoice-container table.items-table td:first-child {
        width: 36px !important;
        text-align: left !important;
        padding-left: 8px !important;
      }
      .invoice-container .items-table th:last-child,
      .invoice-container .items-table td:last-child,
      .invoice-container table.items-table th:last-child,
      .invoice-container table.items-table td:last-child {
        padding-right: 10px !important;
      }
      .invoice-container .items-table th:nth-child(2),
      .invoice-container .items-table td:nth-child(2),
      .invoice-container .items-table th:nth-child(3),
      .invoice-container .items-table td:nth-child(3),
      .invoice-container table.items-table th:nth-child(2),
      .invoice-container table.items-table td:nth-child(2),
      .invoice-container table.items-table th:nth-child(3),
      .invoice-container table.items-table td:nth-child(3) {
        text-align: left !important;
      }
      .invoice-container .items-table th:nth-last-child(-n+5),
      .invoice-container .items-table td:nth-last-child(-n+5),
      .invoice-container table.items-table th:nth-last-child(-n+5),
      .invoice-container table.items-table td:nth-last-child(-n+5) {
        text-align: right !important;
      }
      .invoice-container .summary-section,
      .invoice-container .financial-summary,
      .invoice-container .summary-box {
        margin-top: 16px !important;
      }
      .invoice-container thead { display: table-header-group; }
      .invoice-container tbody { display: table-row-group; }
      .invoice-container tr { display: table-row; }
      .invoice-container th, .invoice-container td { display: table-cell; box-sizing: border-box; }
      .invoice-container th,
      .invoice-container td {
        padding-left: 8px !important;
        padding-right: 8px !important;
      }
      /* Preserve template's row separators for items table */
      .invoice-container .items-table thead tr { border-bottom: 2px solid #777 !important; }
      .invoice-container .items-table tbody tr { border-bottom: 1px solid #e5e5e5 !important; }
    `;

    const styledHtml = `
      <style>
        ${headStyles}
        ${safetyStyles}
      </style>
      ${bodyForDisplay}
    `;
    
    return (
      <div
        className="invoice-container"
        style={{
          width: "100%",
          maxWidth: "100%",
          padding: "16px 0",
          margin: 0,
          boxSizing: "border-box",
        }}
      >
        <div dangerouslySetInnerHTML={{ __html: styledHtml }} />
      </div>
    );
  } catch (error) {
    console.error("Error rendering unified invoice template:", error);
    console.error("Error stack:", error.stack);
    console.error("Template HTML (first 1000 chars):", htmlContent?.substring(0, 1000));
    console.error("Contract data:", contractWithCalculatedTotal);
    return (
      <div className="p-8 bg-red-100 text-red-700 border border-red-300 rounded">
        <h2 className="text-lg font-bold">
          {ciText("Error rendering invoice template")}
        </h2>
        <p>{error.message}</p>
        <pre className="mt-2 p-2 bg-gray-100 text-xs overflow-auto">
          {error.stack || ciText("No stack trace available")}
        </pre>
      </div>
    );
  }
};






/**
 * Prepares data for unified invoice templates (type: "invoice") with ABM/BARENA style fields.
 * The template expects everything under `contract`, including:
 * - businessLogo, businessName, businessAddress, businessPhone, businessEmail
 * - date, dueDate, invoice_number, salesType, salesPerson
 * - buyerName, buyerCompany, buyerAddress, buyerPhone, buyerEmail
 * - shipToName, shipToCompany, shipToAddress, shipToPhone, shipToEmail
 * - currency, items[], subtotal/discount/shippingCharges/tax/adjustment/total/deposit
 */
function prepareUnifiedInvoiceContractData(invoice, fallbackSignature = "") {
  // Enhanced safeStr function to handle objects, dates, and arrays
  const safeStr = (v) => {
    if (v === undefined || v === null) return "";
    
    // Handle Date objects
    if (v instanceof Date) {
      const year = v.getFullYear();
      const month = String(v.getMonth() + 1).padStart(2, "0");
      const day = String(v.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
    
    // Handle objects - try to extract meaningful values
    if (typeof v === "object" && !Array.isArray(v)) {
      // If it's a customer object, try to get name
      if (v.basicInformation?.customerDisplayName) {
        return String(v.basicInformation.customerDisplayName);
      }
      if (v.basicInformation?.customerName) {
        return String(v.basicInformation.customerName);
      }
      if (v.basicInformation?.companyName) {
        return String(v.basicInformation.companyName);
      }
      if (v.companyInfo?.companyName) {
        return String(v.companyInfo.companyName);
      }
      // If it's an address object, format with line breaks (multi-line like template)
      if (v.street || v.city || v.state || v.country || v.postalCode) {
        const parts = [
          v.street,
          v.addressLine2 || v.line2,
          v.city,
          v.state,
          v.country,
          v.postalCode
        ].filter(Boolean);
        return parts.join("\n");
      }
      // For business objects, try business-specific properties
      if (v.image || v.logo) return String(v.image || v.logo);
      if (v.name || v.businessName) return String(v.name || v.businessName);
      if (v.address || v.businessAddress) return String(v.address || v.businessAddress);
      if (v.tel || v.phone || v.businessPhone) return String(v.tel || v.phone || v.businessPhone);
      if (v.email || v.businessEmail) return String(v.email || v.businessEmail);
      
      // For other objects, try common properties
      if (v.name) return String(v.name);
      if (v.title) return String(v.title);
      if (v.value) return String(v.value);
      // Last resort: return empty string to avoid [object Object]
      console.warn("Object converted to string, but no recognizable properties found:", v);
      return "";
    }
    
    // Handle arrays - join with comma
    if (Array.isArray(v)) {
      return v.map(item => safeStr(item)).filter(Boolean).join(", ");
    }
    
    // For primitives, convert to string
    return String(v);
  };
  
  // Format date helper
  const formatDate = (dateValue) => {
    if (!dateValue) return "";
    if (dateValue instanceof Date) {
      const year = dateValue.getFullYear();
      const month = String(dateValue.getMonth() + 1).padStart(2, "0");
      const day = String(dateValue.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
    if (typeof dateValue === "string") {
      // If it's already a formatted date string, return as is
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
        return dateValue;
      }
      // Try to parse and format
      const date = new Date(dateValue);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      }
    }
    return safeStr(dateValue);
  };

  // Format addresses for multi-line display per template design.
  // Preserves newlines when present. For comma-separated, splits sensibly.
  // For Malaysian-style addresses, puts postcode + city + state (e.g. "47100 PUCHONG SELANGOR") on next line.
  const formatAddressForTemplate = (raw) => {
    const addrStr = (raw || "").toString().trim();
    if (!addrStr) return "";

    // If the source already uses explicit newlines, preserve as-is
    if (addrStr.includes("\n")) return addrStr;

    const parts = addrStr
      .split(/\s*,\s*/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (!parts.length) return "";

    // Find postcode part (5 digits) - put it and following parts on next line
    const postcodeIdx = parts.findIndex((p) => /^\d{5}/.test(p));
    if (postcodeIdx > 0) {
      const firstLine = parts.slice(0, postcodeIdx).join(", ");
      const secondLine = parts.slice(postcodeIdx).join(" ");
      return `${firstLine}\n${secondLine}`;
    }

    // For single-part addresses (no commas), split before Malaysian postcode if present
    if (parts.length === 1) {
      const postcodeMatch = addrStr.match(/\s+(\d{5}\s+[\w\s]+)$/);
      if (postcodeMatch) {
        return (addrStr.slice(0, -postcodeMatch[0].length).trim() + "\n" + postcodeMatch[1].trim());
      }
    }

    // Short addresses: keep one component per line
    if (parts.length <= 4) {
      return parts.join("\n");
    }

    // Longer addresses: group everything except the last 3 parts on the first line,
    // and put the last 3 (typically postcode, city, country) on the second line.
    const firstLine = parts.slice(0, parts.length - 3).join(" ");
    const secondLine = parts.slice(parts.length - 3).join(" ");
    return `${firstLine}\n${secondLine}`;
  };

  const currency = safeStr(invoice.currency || invoice.currencySymbol || invoice.currency_code || "RM");

  // Business fields - enhanced extraction to handle various data structures
  const business = invoice.business_id || invoice.business || {};
  const branding = resolveDocumentCompanyBranding(business);

  const businessLogo = safeStr(
    branding.businessLogo ||
    invoice.businessLogo ||
    ""
  );
  
  const businessName = safeStr(
    branding.businessName ||
    invoice.businessName ||
    ""
  );
  
  const rawBusinessAddress = safeStr(
    branding.businessAddress ||
    invoice.businessAddress ||
    ""
  );
  const businessAddress = formatAddressForTemplate(rawBusinessAddress);
  
  const businessPhone = safeStr(
    branding.businessPhone ||
    invoice.businessPhone ||
    ""
  );
  
  const businessEmail = safeStr(
    branding.businessEmail ||
    invoice.businessEmail ||
    ""
  );

  // Invoice header fields
  const invoice_number = safeStr(invoice.invoice_number || invoice.invoiceNumber || invoice.ref || invoice.number || "");
  const date = formatDate(
    invoice.invoice_date || invoice.invoice_date_value || invoice.date || invoice.invoiceDate || ""
  );
  const dueDate = formatDate(
    invoice.dueDate || invoice.due_date || invoice.due_date_value || ""
  );
  const salesType = safeStr(invoice.salesType || invoice.sales_type || "CREDIT");
  const salesPerson = safeStr(
    invoice.salesPerson ||
      invoice.sales_person ||
      invoice.salesperson ||
      invoice.salesPersonName ||
      invoice?.salesperson?.name ||
      invoice?.salesPerson?.name ||
      ""
  );

  const signature = safeStr(
    invoice.signature ||
      invoice.approver_signature ||
      invoice.adminSignature ||
      invoice.admin_signature ||
      fallbackSignature ||
      ""
  );

  // Customer fields
  const customer = invoice.customer_id || invoice.customer || {};
  const customerBasic = customer.basicInformation || {};
  const customerCompanyInfo = customer.companyInfo || {};

  const buyerName =
    safeStr(invoice.customer_name) ||
    safeStr(customerBasic.customerDisplayName) ||
    safeStr(customerBasic.customerName) ||
    safeStr(invoice.customer) ||
    "Customer";

  // Customer company name: stored in basicInformation.companyName (customer creation).
  // Also check companyInfo, invoice-level. Fallback to customerDisplayName when no company.
  const buyerCompany =
    safeStr(customerBasic.companyName) ||
    safeStr(customerCompanyInfo.companyName) ||
    safeStr(invoice.customer_company) ||
    safeStr(invoice.customerCompany) ||
    safeStr(customerBasic.customerDisplayName) ||
    "";

  const rawBuyerAddress =
    safeStr(invoice.billingAddress) ||
    safeStr(customerCompanyInfo.billingAddress) ||
    safeStr(customerCompanyInfo.address) ||
    safeStr(invoice.customer_address) ||
    "";
  // Format for multi-line display (template style)
  const buyerAddress = formatAddressForTemplate(rawBuyerAddress);

  const customerPhoneObj = customerBasic.customerPhone || {};
  const customerAddresses = Array.isArray(customer.addresses) ? customer.addresses : [];
  const billingAddr = customerAddresses.find(
    (a) => (a.addressType || "").toLowerCase() === "billing"
  );
  const shippingAddr =
    customerAddresses.find((a) => (a.addressType || "").toLowerCase() === "shipping") ||
    customerAddresses[0];
  const keyContacts = Array.isArray(customer?.keyContacts) ? customer.keyContacts : [];
  const firstContactWithPhone = keyContacts.find((k) => k?.contactNumber);
  const firstContactWithEmail = keyContacts.find((k) => k?.email);
  const buyerPhone =
    safeStr(invoice.phoneNumber) ||
    safeStr(invoice.customerPhone) ||
    safeStr(invoice.customer_phone) ||
    safeStr(invoice.phone) ||
    safeStr(customerPhoneObj.mobile) ||
    safeStr(customerPhoneObj.workPhone) ||
    safeStr(customerBasic.phone) ||
    safeStr(customerCompanyInfo.phone) ||
    safeStr(billingAddr?.phone) ||
    safeStr(shippingAddr?.phone) ||
    safeStr(customerAddresses[0]?.phone) ||
    safeStr(firstContactWithPhone?.contactNumber) ||
    safeStr(customer?.keyContacts?.[0]?.contactNumber) ||
    "";

  const buyerEmail =
    safeStr(invoice.customerEmail) ||
    safeStr(invoice.customer_email) ||
    safeStr(invoice?.email?.to) ||
    safeStr(customerBasic.customerEmail) ||
    safeStr(customerBasic.email) ||
    safeStr(firstContactWithEmail?.email) ||
    safeStr(customer?.keyContacts?.[0]?.email) ||
    safeStr(customer?.companyInfo?.email) ||
    "";

  // Ship-to fields (fallback to buyer)
  const shipToName = safeStr(invoice.shipToName) || buyerName;
  const shipToCompany = safeStr(invoice.shipToCompany) || buyerCompany;
  const rawShipToAddress =
    safeStr(invoice.shippingAddress) ||
    safeStr(invoice.shipToAddress) ||
    buyerAddress;
  const shipToAddress = formatAddressForTemplate(rawShipToAddress);
  const shipToPhone =
    safeStr(invoice.shipToPhone) ||
    safeStr(invoice.ship_to_phone) ||
    safeStr(shippingAddr?.phone) ||
    buyerPhone;
  const shipToEmail =
    safeStr(invoice.shipToEmail) ||
    safeStr(invoice.ship_to_email) ||
    buyerEmail;

  // Items mapping for template columns: item, description, quantity, price, discount, tax, total
  // Backend stores taxRate per item; taxAmount may be missing, so compute from taxRate when needed
  const items = Array.isArray(invoice.items)
    ? invoice.items.map((it) => {
        const {
          quantity,
          unitPrice: price,
          discountPercent,
          taxRate,
          tax,
          total,
        } = resolveFlexaLineBillingBreakdown(it);

        const mainName = it.itemName || it.item || it.name || it.title || "";
        const itemDesc = it.description || it.goods_description || "";
        const displayName = mainName || itemDesc;
        const subDesc = (mainName && itemDesc && String(itemDesc).trim() !== String(mainName).trim())
          ? itemDesc
          : "";

        return {
          item: displayName,
          name: displayName,
          description: subDesc,
          subDescription: subDesc,
          quantity,
          price,
          discount: discountPercent,
          discountPercent,
          tax,
          taxRate,
          taxName: safeStr(it.taxName || it.tax_label || it.taxLabel || ""),
          total,
        };
      })
    : [];

  // Totals: use API taxTotal when present, otherwise sum of item taxes (backend often only stores taxRate per item)
  // Σ line totals (after line discount + line tax); matches PCI-BE/invoice-summary.md when lines exist.
  const itemTotals = items.reduce((s, i) => s + (i.total || 0), 0);
  const computedSubtotal = itemTotals;
  const providedSubtotal = Number(invoice.subTotal ?? invoice.subtotal ?? 0);
  const subtotal =
    items.length > 0 ? computedSubtotal : providedSubtotal;
  const tolerance = 0.01;
  // Order-level discount: prefer discountAmount; if missing, derive from % (invoice.discount is often % per API).
  // Using only discountAmount left contract.discount at 0 when amount was omitted—templates then hid the value.
  let discountTotal = Number(invoice.discountAmount);
  if (!Number.isFinite(discountTotal) || discountTotal < 0) discountTotal = 0;

  const pctFromForm = Number(invoice.discountPercentage);
  const pctFromDiscField = Number(invoice.discount);
  const pctCandidate =
    Number.isFinite(pctFromForm) && pctFromForm > 0 ? pctFromForm : pctFromDiscField;
  const isLikelyPercent =
    Number.isFinite(pctCandidate) && pctCandidate > 0 && pctCandidate <= 100;

  if (subtotal > tolerance && isLikelyPercent) {
    const derived = (subtotal * pctCandidate) / 100;
    if (discountTotal <= tolerance) discountTotal = derived;
  } else if (discountTotal <= tolerance) {
    const legacy = Number(invoice.discount ?? 0);
    if (Number.isFinite(legacy) && legacy > 0) discountTotal = legacy;
  }

  const explicitDiscountPct = isLikelyPercent
    ? Math.min(100, Math.max(0, pctCandidate))
    : 0;
  const summaryDiscountPercentage =
    explicitDiscountPct > 0
      ? explicitDiscountPct
      : calculateOrderDiscountPercentage(subtotal, discountTotal);
  const summaryDiscountDisplay = formatSummaryDiscountDisplay(summaryDiscountPercentage);
  const shippingCharges = Number(invoice.shippingCharges ?? invoice.shipping ?? 0);
  const calculatedItemTax = items.reduce((s, i) => s + (i.tax || 0), 0);
  const taxTotal =
    items.length > 0
      ? calculatedItemTax
      : Number(invoice.taxTotal ?? invoice.tax ?? 0) || 0;
  const adjustment = Number(invoice.adjustment ?? 0);
  const providedTotal = Number(invoice.total ?? invoice.grandTotal ?? 0);
  const computedTotal = Math.max(
    0,
    computedSubtotal - discountTotal + shippingCharges + adjustment,
  );
  const total =
    providedTotal > 0 && Math.abs(providedTotal - computedTotal) < tolerance
      ? providedTotal
      : computedTotal;
  const deposit = Number(invoice.deposit ?? invoice.depositAmount ?? 0);

  // Dynamic terms and conditions from invoice; empty string when none
  const termsAndConditions =
    typeof (invoice.termsAndConditions ?? invoice.terms_and_conditions) === "string"
      ? (invoice.termsAndConditions ?? invoice.terms_and_conditions ?? "")
      : "";

  // Payment terms (short) for "Terms" field in templates - e.g. "Due on Receipt", "Net 30"
  const paymentTermsShort =
    safeStr(invoice.terms) ||
    safeStr(invoice.paymentTerms) ||
    safeStr(invoice.payment_terms) ||
    "Due on Receipt";

  return {
    businessLogo,
    businessName,
    businessAddress,
    businessPhone,
    businessEmail,

    invoice_number,
    invoiceNumber: invoice_number,
    invoiceNo: invoice_number,
    invoice_no: invoice_number,
    ref: invoice_number,
    number: invoice_number,
    date,
    invoice_date: date,
    invoiceDate: date,
    invoiceDateValue: date,
    invoice_date_value: date,
    dueDate,
    due_date: dueDate,
    dueDateValue: dueDate,
    due_date_value: dueDate,
    salesType,
    salesPerson,
    sales_person: salesPerson,
    salesperson: salesPerson,
    salesPersonName: salesPerson,
    signature,
    authorizedSignature: signature,
    approver_signature: signature,

    buyerName,
    buyerCompany,
    buyerAddress,
    // Also expose explicit billing/shipping keys so templates like yours can use them
    billingAddress: buyerAddress,
    shippingAddress: shipToAddress,
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
    summaryDiscountDisplay,
    shippingCharges,
    tax: taxTotal,
    taxTotal,
    adjustment,
    total,
    deposit,

    termsAndConditions,
    // Payment terms (short) for "Terms" field in invoice-meta - e.g. "Due on Receipt", "Net 30"
    terms: paymentTermsShort,
    paymentTerms: paymentTermsShort,
    // Aliases for long terms-and-conditions text block
    terms_and_conditions: termsAndConditions,
    payment: termsAndConditions,
    payment_info: termsAndConditions,
  };
}


/**
 * Process HTML template with EJS-like syntax
 * Enhanced with better error handling and performance
 */
function processTemplate(template, data, context = null) {
  if (!template) {
    throw new Error(ciText("Template is undefined"));
  }

  let result = template;
  // Use the provided context or fallback to data
  const ctx = context || data;

  try {
    // STEP 0: Remove ALL standalone EJS code blocks that contain variable declarations
    // These are JavaScript code blocks that shouldn't appear in the final HTML
    // Pattern: <% const/let/var ... %>
    result = result.replace(/<%[\s]*const[\s\S]*?%>/g, "");
    result = result.replace(/<%[\s]*let[\s\S]*?%>/g, "");
    result = result.replace(/<%[\s]*var[\s\S]*?%>/g, "");

    // IMPORTANT:
    // Do NOT try to strip blocks based on keywords like parseFloat/toFixed.
    // Those words appear inside legitimate output tags like `<%= parseFloat(...) %>` and
    // a regex here can accidentally delete huge spans of HTML (e.g., from `<% if ... %>`
    // up to the first `toFixed()`), leaving only the summary visible.
    
    // Pre-process problematic expressions
    // This specifically targets the issue with the table total calculation
    result = result.replace(
      /<%= contract\.items\.reduce\(\(total, item\) => total \+ \(item\.price \* item\.quantity\), 0\)\.toFixed\(2\) %>/g,
      "<%= contract.calculatedTotal %>"
    );

    // Replace problematic expression with another pattern for total amount calculation
    result = result.replace(
      /<%= contract\.items\.reduce\(\(total, item\) => total \+ \(item\.price \* item\.quantity\), 0\) %>/g,
      "<%= contract.calculatedTotal %>"
    );

    // Handle another common pattern for item total calculations
    result = result.replace(
      /<%= contract\.items\.reduce\(\(total, item\) => total \+ parseFloat\(item\.totalValue\.replace\(\/,\/g, ''\)\), 0\)\.toFixed\(2\) %>/g,
      "<%= contract.calculatedTotal %>"
    );

    // Normalize common template formulas that double-count tax.
    // In this app, subtotal is already tax-inclusive at line level.
    result = result.replace(
      /<%=\s*\(?\s*contract\.(?:subTotal|subtotal)\s*\+\s*contract\.(?:taxTotal|tax)\s*\)?(?:\.toFixed\(2\))?\s*%>/g,
      "<%= contract.total %>"
    );
    result = result.replace(
      /<%=\s*\(?\s*parseFloat\(\s*contract\.(?:subTotal|subtotal)\s*\)\s*\+\s*parseFloat\(\s*contract\.(?:taxTotal|tax)\s*\)\s*\)?(?:\.toFixed\(2\))?\s*%>/g,
      "<%= contract.total %>"
    );

    // Process if statements FIRST (before forEach) to handle nested structures
    // Handle if statements - support both if(condition) and if (condition) { patterns
    let maxIterations = 10; // Prevent infinite loops
    let iteration = 0;
    while (result.includes('<% if') && iteration < maxIterations) {
      result = result.replace(
        /<% if\s*\(([^)]+)\)\s*{ %>([\s\S]*?)(?:<% } else { %>([\s\S]*?))?<% } %>/g,
        (match, condition, ifContent, elseContent = "") => {
          try {
            const conditionFn = new Function(
              ...Object.keys(ctx),
              `try { 
              return ${condition.trim()}; 
            } catch(e) { 
              console.error('Condition evaluation error:', e, '${condition.trim()}'); 
              return false; 
            }`
            );
            const conditionResult = conditionFn(...Object.values(ctx));

            if (conditionResult) {
              return processTemplate(ifContent, data, ctx);
            } else if (elseContent) {
              return processTemplate(elseContent, data, ctx);
            }
            return "";
          } catch (e) {
            console.error("Error processing if statement:", e);
            return "";
          }
        }
      );
      iteration++;
    }

    // Process forEach loops AFTER if statements
    // Pattern 1: EJS split-tag forEach blocks:
    //   <% contract.items.forEach((item, index) => { %>
    //      ... html with <%= item.* %> ...
    //   <% }); %>
    // This is the most common form produced by the template builder.
    let splitForEachIteration = 0;
    while (result.includes(".forEach") && splitForEachIteration < maxIterations) {
      const splitForEachRegex =
        /<%\s*([^%]+?)\.forEach\s*\(\s*\(\s*([^,\s)]+)\s*(?:,\s*([^\s)]+))?\s*\)\s*=>\s*{\s*%>([\s\S]*?)<%\s*}\s*\)\s*;?\s*%>/g;

      const prev = result;
      result = result.replace(
        splitForEachRegex,
        (match, arrayExpr, itemVar, indexVar, content) => {
          try {
            let output = "";
            const arrayEval = new Function(
              ...Object.keys(ctx),
              `try { return ${arrayExpr.trim()}; } catch(e) { return []; }`
            );
            const arrayData = arrayEval(...Object.values(ctx));
            if (Array.isArray(arrayData)) {
              arrayData.forEach((item, idx) => {
                const loopContext = {
                  ...ctx,
                  [String(itemVar).trim()]: item,
                  [String(indexVar || "index").trim()]: idx,
                };
                output += processTemplate(content, data, loopContext);
              });
            }
            return output;
          } catch (e) {
            console.error("Error processing split-tag forEach:", e);
            return "";
          }
        }
      );

      // If no replacements happened, stop iterating to avoid spinning.
      if (result === prev) break;
      splitForEachIteration++;
    }

    // Pattern 2: single-tag forEach blocks (legacy in this codebase)
    let forEachIteration = 0;
    while (result.includes('.forEach') && forEachIteration < maxIterations) {
      result = result.replace(
        /<%\s*([^%]+?)\.forEach\s*\(\s*\(\s*([^,]+)\s*,?\s*([^)]*)\s*\)\s*=>\s*{([\s\S]*?)<%\s*}\s*\)\s*;?\s*%>/g,
        (match, arrayExpr, itemVar, indexVar, content) => {
          try {
            let output = "";
            const arrayEval = new Function(
              ...Object.keys(ctx),
              `try { return ${arrayExpr.trim()}; } catch(e) { return []; }`
            );
            const arrayData = arrayEval(...Object.values(ctx));
            if (Array.isArray(arrayData)) {
              arrayData.forEach((item, idx) => {
                const loopContext = {
                  ...ctx,
                  [itemVar.trim()]: item,
                  [indexVar.trim() || "index"]: idx,
                };
                output += processTemplate(content, data, loopContext);
              });
            }
            return output;
          } catch (e) {
            console.error("Error processing forEach:", e);
            return "";
          }
        }
      );
      forEachIteration++;
    }

    // Replace EJS-like <%= variable %> syntax with safer evaluation
    result = result.replace(/<%=\s*([^%>]+)\s*%>/g, (match, p1) => {
      try {
        const keys = Object.keys(ctx);
        const values = Object.values(ctx);
        const fn = new Function(
          ...keys,
          `try { 
          const value = ${p1};
          if (value === undefined || value === null) return '';
          
          // Handle Date objects
          if (value instanceof Date) {
            const year = value.getFullYear();
            const month = String(value.getMonth() + 1).padStart(2, '0');
            const day = String(value.getDate()).padStart(2, '0');
            return year + '-' + month + '-' + day;
          }
          
          // Handle objects - avoid [object Object]
          if (typeof value === 'object' && !Array.isArray(value)) {
            if (value.basicInformation?.customerDisplayName) return String(value.basicInformation.customerDisplayName);
            if (value.basicInformation?.customerName) return String(value.basicInformation.customerName);
            if (value.basicInformation?.companyName) return String(value.basicInformation.companyName);
            if (value.companyInfo?.companyName) return String(value.companyInfo.companyName);
            if (value.name) return String(value.name);
            if (value.title) return String(value.title);
            if (value.value) return String(value.value);
            // For address objects
            if (value.street || value.city || value.state || value.country || value.postalCode) {
              const parts = [value.street, value.city, value.state, value.country, value.postalCode].filter(Boolean);
              return parts.join(', ');
            }
            return '';
          }
          
          // Handle arrays
          if (Array.isArray(value)) {
            return value.map(item => {
              if (item instanceof Date) {
                const year = item.getFullYear();
                const month = String(item.getMonth() + 1).padStart(2, '0');
                const day = String(item.getDate()).padStart(2, '0');
                return year + '-' + month + '-' + day;
              }
              return String(item);
            }).filter(Boolean).join(', ');
          }
          
          return String(value);
        } catch(e) { 
          console.error('Expression evaluation error:', e, '${p1}'); 
          return ''; 
        }`
        );
        return fn(...values);
      } catch (e) {
        console.error("Error evaluating template expression:", p1, e);
        return "";
      }
    });

    // Replace EJS-like <%- variable %> syntax (for HTML content)
    result = result.replace(/<%-\s*(.*?)\s*%>/g, (match, p1) => {
      try {
        const keys = Object.keys(ctx);
        const values = Object.values(ctx);
        const fn = new Function(
          ...keys,
          `try { 
          const value = ${p1.trim()};
          return value !== undefined && value !== null ? value : '';
        } catch(e) { 
          console.error('HTML expression evaluation error:', e, '${p1.trim()}'); 
          return ''; 
        }`
        );
        return fn(...values);
      } catch (e) {
        console.error("Error evaluating template HTML expression:", p1, e);
        return "";
      }
    });

    // FINAL STEP: Remove any remaining EJS syntax that wasn't processed
    // This catches any leftover <% ... %> blocks that don't match the patterns above
    result = result.replace(/<%[\s\S]*?%>/g, "");

    return result;
  } catch (error) {
    console.error("Template processing error:", error);
    throw new Error(`Failed to process template: ${error.message}`);
  }
}

export default InvoiceRenderer;
