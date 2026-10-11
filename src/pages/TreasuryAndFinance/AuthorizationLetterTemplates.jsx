import React, { useEffect, useState } from "react";
import { useHistory, useLocation } from "react-router-dom";
import axios from "axios";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
/*************  ✨ Windsurf Command ⭐  *************/
/**
 * AuthorizationLetterTemplates component
 *
 * This component renders the authorization letter templates selection interface.
 * It fetches the templates from the API and renders them in a grid view.
 * When a template is selected, it generates the HTML content for the
 * selected template and displays it in an iframe.
 * The user can then choose to use the selected template or go back to
 * the previous step.
 * @param {string} requestId - The ID of the request
 * @param {string} businessId - The ID of the business
 * @param {string} authLetterId - The ID of the authorization letter
 */
/*******  bd1d9b2d-5d21-4467-ae37-a4f1cd22b1f1  *******/

const AuthorizationLetterTemplates = () => {
  const history = useHistory();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const requestId = queryParams.get("requestId");
  const businessId = queryParams.get("businessId");
  const authLetterId = queryParams.get("authLetterId");
  console.log(
    "requestId",
    requestId,
    "businessId",
    businessId,
    "authLetterId",
    authLetterId
  );
  const [loading, setLoading] = useState(true);
  const [invoiceData, setInvoiceData] = useState(null);
  const [businessData, setBusinessData] = useState(null);
  const [authLetterData, setAuthLetterData] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [tempSelectedTemplate, setTempSelectedTemplate] = useState(null);
  const [htmlContent, setHtmlContent] = useState("");
  const [supplierSign, setSupplierSign] = useState("");
  const [buyerSign, setBuyerSign] = useState("");
  const [pdfBlob, setPdfBlob] = useState(null);
  const [pdfFileName, setPdfFileName] = useState("");
  const [viewMode, setViewMode] = useState("preview"); // "preview" or "select"
  const [templatePreviews, setTemplatePreviews] = useState({});

  console.log("auth letter data", authLetterData);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch invoice data
        const invoiceResponse = await axios.get(
          `${Base_URL}/auth-requests/${requestId}`
        );

        console.log("invoiceResponse", invoiceResponse);
        if (invoiceResponse.data.status || invoiceResponse.data.data) {
          const invoice = invoiceResponse.data.data || invoiceResponse.data;
          setInvoiceData(invoice);
        }

        // Fetch business data
        const businessResponse = await axios.get(
          `${Base_URL}/Business/${businessId}`
        );
        if (businessResponse.data.data) {
          const business = businessResponse.data.data;
          setBusinessData(business);

          // Set supplier signature if available
          if (business.signature) {
            setSupplierSign(business.signature);
          }
        }

        const authLetterResponse = await axios.get(
          `${Base_URL}/authorization-letter/${authLetterId}`
        );
        setAuthLetterData(authLetterResponse.data);

        // Fetch sales contract templates
        const templatesResponse = await axios.get(
          `${Base_URL}/document-templates`
        );
        const authLetterTemplates = templatesResponse.data.data.filter(
          (tmp) => tmp.type === "Authorization Letter"
        );
        setTemplates(authLetterTemplates);
        console.log("templatesResponse", authLetterTemplates);

        // Set the first template as default and generate HTML immediately
        if (authLetterTemplates.length > 0) {
          setSelectedTemplate(authLetterTemplates[0]._id);
          setTempSelectedTemplate(authLetterTemplates[0]._id);
        }

        setLoading(false);
      } catch (error) {
        console.error("Error fetching data:", error);
        setLoading(false);
      }
    };

    fetchData();
  }, [requestId, businessId]);

  // This effect runs when invoiceData and businessData are both available
  useEffect(() => {
    const generateInitialTemplate = async () => {
      if (
        invoiceData &&
        businessData &&
        templates.length > 0 &&
        selectedTemplate
      ) {
        // Generate HTML for all templates to show previews
        const previews = {};
        for (const template of templates) {
          const previewHtml = await generateTemplateHtml(template, true);
          previews[template._id] = previewHtml;
        }
        setTemplatePreviews(previews);

        // Generate main preview for selected template
        const template = templates.find((t) => t._id === selectedTemplate);
        if (template) {
          await generateTemplateHtml(template);
        }
      }
    };

    generateInitialTemplate();
  }, [invoiceData, businessData, templates, selectedTemplate]);

  // Enhanced generateTemplateHtml function
  const generateTemplateHtml = async (templateData, forPreview = false) => {
    try {
      // Get the HTML content from the template
      console.log("templateData", templateData);
      let html = templateData.htmlContent;

      if (!invoiceData || !businessData) {
        console.error("Missing invoice or business data");
        return "";
      }

      // Format date properly
      const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toISOString().split("T")[0];
      };

      console.log("authLetterData", authLetterData);
      console.log("invoiceData", invoiceData);

      // Extract customer phone
      const customerPhone =
        // authLetterData?.phone ||
        invoiceData.customer_id?.basicInformation?.customerPhone?.mobile ||
        invoiceData.customer_id?.basicInformation?.customerPhone?.workPhone ||
        "Not Available";

      console.log("customerPhone", customerPhone);

      // Create contract data from invoiceData and businessData
      const contractData = {
        // Basic information
        ref: invoiceData.phone || invoiceData.invoice_number || "",
        buyerName:
          invoiceData?.customer_id?.basicInformation?.customerDisplayName || "",
        buyerAddress: invoiceData.billingAddress || "",
        date: formatDate(invoiceData.invoice_date),
        businessAdress: invoiceData?.business_id?.address || "",

        // Contract details
        no: authLetterData?.contract_id?.contractNo || "S2510-K1729",
        price: `${invoiceData.grandTotal?.toFixed(2) || "0.00"} AED`,
        contact: customerPhone,

        // Business information
        sellerName: businessData.name || "",
        businessLogo: businessData.image || "",

        // Other details to ensure template completeness
        level: "Authorized Representative",
        id: authLetterData?.idNumber || "",
        ETD_Port: invoiceData.contract_id?.basicInfo?.ETD_Port || "",
        supplierSign: supplierSign || "",
        BuyerSign: buyerSign || "",
        cnic_img: authLetterData.IDCardImage,
        contract_no: invoiceData.contract_id?.contractNo,
        fax: invoiceData?.business_id?.fax || "",
        stampImage: templateData?.dummyData?.contract?.stampImg,
      };

      console.log("contractData", contractData);
      console.log("customerPhone", customerPhone);
      console.log("logo url", `${contractData.businessLogo}`);
      console.log("stamp_url", contractData.stampImage);
      console.log("contractData.cnic_img", contractData.cnic_img);

      // Replace template variables with actual data
      // Handle simple variables
      html = html
        .replace(/<%=\s*contract\.ref\s*%>/g, contractData.ref)
        .replace(/<%=\s*contract\.business\.tel\s*%>/g, customerPhone)
        .replace(/<%=\s*contract\.business\.fax\s*%>/g, contractData.fax)
        .replace(
          /<%=\s*contract\.business\.address\s*%>/g,
          contractData.businessAdress
        )
        .replace(/<%=\s*contract\.customerName\s*%>/g, authLetterData.authorizedPersonName)
        .replace(
          /<%=\s*contract\.companyAddress\s*%>/g,
          contractData.buyerAddress
        )
        .replace(/<%=\s*contract\.date\s*%>/g, formatDate(contractData.date))
        .replace(/<%=\s*contract\.no\s*%>/g, contractData.no)
        .replace(/<%=\s*contract\.amount\s*%>/g, contractData.price)
        .replace(/<%=\s*contract\.contact\s*%>/g, contractData.contact)
        .replace(/<%=\s*contract\.companyName\s*%>/g, contractData.sellerName)
        .replace(
          /<%=\s*contract\.businessLogo\s*%>/g,
          `${contractData.businessLogo}` || ""
        )
        .replace(/<%=\s*contract\.level\s*%>/g, contractData.level)
        .replace(/<%=\s*contract\.customerIdNumber\s*%>/g, contractData.id)
        .replace(/<%=\s*contract\.cnicImg\s*%>/g, `${contractData.cnic_img}`)
        .replace(
          /<%=\s*contract\.stampImg\s*%>/g,
          "https://thumbs.dreamstime.com/b/stamp-text-yours-sincerely-inside-illustration-yours-sincerely-109907060.jpg"
        ) //contractData.stampImage
        .replace(/<%=\s*contract\.pi\s*%>/g, contractData.contract_no)
        .replace(
          /<%=\s*contract\.supplierSign\s*%>/g,
          contractData.supplierSign || ""
        )
        .replace(
          /<%=\s*contract\.BuyerSign\s*%>/g,
          contractData.BuyerSign || ""
        );

      // Handle any remaining template variables not specifically defined above
      const remainingVariables = html.match(
        /<%=\s*contract\.[a-zA-Z_.]+\s*%>/g
      );
      if (remainingVariables) {
        remainingVariables.forEach((variable) => {
          const varName = variable.match(
            /<%=\s*contract\.([a-zA-Z_.]+)\s*%>/
          )[1];
          console.log(`Handling unspecified template variable: ${varName}`);
          html = html.replace(
            new RegExp(variable.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
            ""
          );
        });
      }

      // Add base tag to handle relative URLs in the iframe
      html = html.replace(
        /<head>/,
        `<head><base href="${window.location.origin}/">`
      );

      // Handle image error cases more gracefully
      html = html.replace(
        /onerror="this\.onerror=null; this\.src='[^']*';"/g,
        `onerror="this.onerror=null; this.src='/api/placeholder/142/100'; this.style.opacity=0.7;"`
      );

      // Fix image src attributes for cross-origin resources
      html = html.replace(
        //g,
        ""
      );

      // Add CSS to disable scrollbars for previews
      if (forPreview) {
        html = html.replace(
          /<head>/,
          `<head><style>body { overflow: hidden !important; margin: 0; padding: 0; transform: scale(0.25); transform-origin: top left; width: 400%; height: 400%; }</style>`
        );
      }

      // Only update main state and generate PDF if not a preview
      if (!forPreview) {
        setHtmlContent(html);
        // Generate PDF after setting HTML content
        generatePDF(
          html,
          `AuthorizationLetter_${
            invoiceData?.contract_no || templateData.name || "Letter"
          }.pdf`
        );
      }

      return html;
    } catch (error) {
      console.error("Error generating template HTML:", error);
      return "";
    }
  };

  const handleTempTemplateSelect = (templateId) => {
    setTempSelectedTemplate(templateId);
  };

  const handleConfirmTemplateSelection = () => {
    // Apply the temporary selection when clicking the select button
    setSelectedTemplate(tempSelectedTemplate);
    setViewMode("preview");

    const template = templates.find((t) => t._id === tempSelectedTemplate);
    if (template) {
      generateTemplateHtml(template);
    }
  };

  const handleBack = () => {
    const savedPath = sessionStorage.getItem("fromPath");

    if (savedPath) {
      // Navigate to saved path and clear storage
      history.push(savedPath);
      sessionStorage.removeItem("fromPath");
    } else {
      // Navigate to create authorization letter page
      history.push({
        pathname: "/treasury/create-authorization",
        search: `?requestId=${requestId}&selectedBusiness=${businessId}&authLetterId=${authLetterId}`,
      });
    }
  };

  const handleChangeTemplate = () => {
    setViewMode("select");
    // Set temporary selection to match current selection when entering selection mode
    setTempSelectedTemplate(selectedTemplate);
  };

  // Generate PDF but don't download it immediately, store it for later use
  const generatePDF = async (html, filename) => {
    try {
      // Post to API endpoint to generate PDF
      const response = await axios.post(
        `${Base_URL}/generate-pdf`,
        {
          html: html,
          filename: filename,
        },
        { responseType: "blob" }
      );

      // Store the blob and filename for later use
      setPdfBlob(response.data);
      setPdfFileName(filename);
    } catch (error) {
      console.error("Error generating PDF:", error);
    }
  };

  // Navigate to the SendEmail page with the necessary data
  const handleNext = () => {
    const selectedTemplateData = templates.find(
      (t) => t._id === selectedTemplate
    );

    // Navigate to SendEmail with state data
    history.push({
      pathname: "/treasury/send-email",
      state: {
        authLetterData,
        invoiceData,
        businessData,
        templateId: selectedTemplate,
        templateName: selectedTemplateData?.name || "Authorization Letter",
        htmlContent,
        pdfBlob,
        pdfFileName,
      },
    });
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--p-blue)]"></div>
        </div>
      </div>
    );
  }

  // Template selection grid view
  if (viewMode === "select") {
    return (
      <div className="p-6">
        <div className="mb-6">
          <button
            className="flex items-center text-gray-600 hover:text-gray-800"
            onClick={() => setViewMode("preview")}
          >
            <svg
              className="w-5 h-5 mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              ></path>
            </svg>
            Back
          </button>
        </div>

        <h1 className="text-lg font-bold mb-8">
          Change Authorization Letter Templates
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {templates.map((template) => (
            <div
              key={template._id}
              className={`relative bg-white rounded-lg border ${
                tempSelectedTemplate === template._id
                  ? "border-[var(--p-blue)] ring-2 ring-[var(--p-blue)]"
                  : "border-gray-200"
              } shadow-sm overflow-hidden hover:shadow-md transition-shadow cursor-pointer`}
              onClick={() => handleTempTemplateSelect(template._id)}
            >
              {/* Template Preview */}
              <div className="h-64 p-2 bg-gray-50 overflow-hidden">
                {template.previewImage ? (
                  <img
                    src={template.previewImage}
                    alt={template.name || "Template preview"}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = "/api/placeholder/280/200";
                    }}
                  />
                ) : templatePreviews[template._id] ? (
                  <div className="w-full h-full overflow-hidden">
                    <iframe
                      srcDoc={templatePreviews[template._id]}
                      title={`Preview of ${template.name}`}
                      className="w-full h-full border-none"
                      scrolling="no"
                      style={{ pointerEvents: "none" }}
                      sandbox="allow-same-origin"
                    />
                  </div>
                ) : (
                  <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400">
                    <span>Loading preview...</span>
                  </div>
                )}
              </div>

              {/* Template Name */}
              <div className="p-3 flex justify-between items-center">
                <span className="font-medium">
                  {template.name || "Template Name"}
                </span>
                <div className="flex">
                  <button
                    className="p-1 rounded-full bg-[var(--p-blue)] text-white"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                      />
                    </svg>
                  </button>
                  <button
                    className="p-1 ml-1 rounded-full text-gray-500"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Selection Indicator */}
              {tempSelectedTemplate === template._id && (
                <div className="absolute top-2 right-2 bg-[var(--p-blue)] text-white rounded-full p-1">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            className="px-6 py-2 bg-gray-200 text-gray-800 rounded-md mr-4"
            onClick={() => setViewMode("preview")}
          >
            Cancel
          </button>
          <button
            className="px-6 py-2 bg-[var(--p-blue)] text-white rounded-md"
            onClick={handleConfirmTemplateSelection}
          >
            Select Template
          </button>
        </div>
      </div>
    );
  }

  // Default preview mode
  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          className="flex items-center text-gray-600 hover:text-gray-800"
          onClick={handleBack}
        >
          <svg
            className="w-5 h-5 mr-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            ></path>
          </svg>
          Back
        </button>
      </div>

      <h1 className="text-lg font-bold mb-8">Authorization Letter Templates</h1>

      <div className="bg-white rounded-lg border border-gray-200 shadow-md">
        {htmlContent ? (
          <div className="p-4">
            {/* Preview of the contract template */}
            <div
              className="contract-preview"
              style={{ height: "800px", overflow: "auto" }}
            >
              <iframe
                srcDoc={htmlContent}
                title="Contract Preview"
                width="100%"
                height="100%"
                style={{ border: "none" }}
                sandbox="allow-same-origin allow-scripts"
              />
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            No template selected or no templates available.
          </div>
        )}
      </div>

      {/* Template selection info at the bottom */}
      <div className="mt-4 flex items-center text-gray-700">
        <span className="mr-2">Template:</span>
        <span className="font-medium">
          {templates.find((t) => t._id === selectedTemplate)?.name ||
            "Selected Template Name"}
        </span>
        <button
          className="ml-2 text-[var(--p-blue)] hover:text-lime-600"
          onClick={handleChangeTemplate}
        >
          Change Template
        </button>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          className="px-6 py-2 bg-gray-200 text-gray-800 rounded-md mr-4"
          onClick={handleBack}
        >
          Cancel
        </button>
        <button
          className="px-6 py-2 bg-[var(--p-blue)] text-white rounded-md"
          onClick={handleNext}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default AuthorizationLetterTemplates;
