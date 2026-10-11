import React, { useState, useEffect, useCallback, useContext } from "react";
import { X, Search, Eye } from "lucide-react";
import ejs from "ejs";
import numberToWords from "number-to-words";
import axios from "axios";
import { AdminContext } from "@/context/AdminContext";
import { useModuleLabels } from "@/context/ModuleLabelsContext";
import { useTranslation } from "react-i18next";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const DocumentTemplates = ({ isOpen, onClose, contractId, onSubmit, type, templates = [], onPreview, businessData, initialTemplateId = null }) => {
  const { state } = useContext(AdminContext);
  const { t } = useTranslation();
  const adminInfo = state?.adminInfo;
  const { getModuleLabel } = useModuleLabels();
  // Use local state for search when templates are passed as prop
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [profileSignature, setProfileSignature] = useState("");
  
  console.log("DocumentTemplates - templates prop:", templates);
  console.log("DocumentTemplates - selectedTemplate:", selectedTemplate);

  // Reset selected template when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedTemplate(null);
      setSearchQuery("");
      setLoadingProgress(0);
    }
  }, [isOpen]);

  // If an initial template id is provided and templates already loaded, pre-select it
  useEffect(() => {
    if (isOpen && initialTemplateId && Array.isArray(templates) && templates.length > 0) {
      const match = templates.find((t) => String(t._id || t.id) === String(initialTemplateId));
      if (match) {
        setSelectedTemplate(match);
      }
    }
  }, [isOpen, initialTemplateId, templates]);

  // Simulate loading progress when templates are loading
  useEffect(() => {
    if (isOpen && (!templates || templates.length === 0)) {
      setLoadingProgress(0);
      const interval = setInterval(() => {
        setLoadingProgress((prev) => {
          if (prev >= 90) {
            return prev; // Stop at 90% until templates load
          }
          // Increment by random amount between 5-15%
          return Math.min(prev + Math.random() * 10 + 5, 90);
        });
      }, 300); // Update every 300ms

      return () => clearInterval(interval);
    } else if (templates && templates.length > 0) {
      // When templates load, complete to 100%
      setLoadingProgress(100);
      setTimeout(() => setLoadingProgress(0), 500); // Reset after brief display
    }
  }, [isOpen, templates]);

  const normalizeSignatureUrl = useCallback((value) => {
    if (!value || typeof value !== "string") return "";
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (trimmed.startsWith("//")) return `https:${trimmed}`;
    const base = (Base_URL || "").replace(/\/$/, "");
    const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    return `${base}${path}`;
  }, []);

  const resolveBusinessLogo = useCallback(() => {
    const raw =
      businessData?.image ||
      businessData?.logo ||
      businessData?.businessLogo ||
      "";
    const normalized = normalizeSignatureUrl(
      typeof raw === "string" ? raw : String(raw || "")
    );
    return normalized || "";
  }, [businessData, normalizeSignatureUrl]);

  const resolveBusinessName = useCallback(() => {
    return (
      businessData?.name ||
      businessData?.businessName ||
      "Company Name"
    );
  }, [businessData]);

  useEffect(() => {
    const fetchProfileSignature = async () => {
      if (!adminInfo?.id) return;
      try {
        const response = await axios.get(`${Base_URL}/admin/profile/${adminInfo.id}`, {
          headers: adminInfo?.token
            ? { authorization: `Bearer ${adminInfo.token}` }
            : undefined,
        });
        const signature = normalizeSignatureUrl(response?.data?.signature || "");
        if (signature) setProfileSignature(signature);
      } catch (error) {
        // Signature is optional in preview cards.
      }
    };

    fetchProfileSignature();
  }, [adminInfo?.id, adminInfo?.token, normalizeSignatureUrl]);


  const handlePreview = (template) => {
    if (onPreview && template) {
      onPreview(template);
    }
  };

  // Render template with dummy data (similar to DocumentTemplate.jsx)
  const renderTemplateWithDummyData = useCallback(
    (templateContent, dummyData) => {
      if (!templateContent) {
        return `<!DOCTYPE html><html><head><title>${t("documents.document", {
          defaultValue: "Document",
        })}</title></head><body><h1>${t("documents.sampleDocument", {
          defaultValue: "Sample Document",
        })}</h1><p>${t("documents.placeholder", {
          defaultValue: "This is a placeholder",
        })}</p></body></html>`;
      }

      // Prepare additional variables with fallback values (match InvoiceRenderer + DocumentTemplate.jsx)
      const resolvedLogo = resolveBusinessLogo();
      const businessLogo = resolvedLogo || "default-logo.png";
      const businessName = resolveBusinessName();
      const businessAddress = businessData?.address
        ? String(businessData.address)
        : "";

      // Ensure necessary data exists before using it in the template
      dummyData = dummyData || {};
      dummyData.contract = dummyData.contract || {};
      dummyData.contract.beneficiary = dummyData.contract.beneficiary || {};
      dummyData.contract.beneficiary.accountHolder = businessName;
      dummyData.contract.sellerName = businessName;
      dummyData.contract.businessLogo = businessLogo;
      const resolvedSignature =
        normalizeSignatureUrl(
          dummyData?.contract?.signature ||
            dummyData?.contract?.authorizedSignature ||
            dummyData?.contract?.approver_signature ||
            profileSignature ||
            ""
        ) || "";
      dummyData.contract.signature = resolvedSignature;
      dummyData.contract.authorizedSignature = resolvedSignature;
      dummyData.contract.approver_signature = resolvedSignature;

      dummyData.payslip = dummyData.payslip || {};
      const ps = dummyData.payslip;
      ps.companyLogo = ps.companyLogo || businessLogo;
      ps.companyName = ps.companyName || businessName;
      if (businessAddress && !ps.companyAddress) {
        ps.companyAddress = businessAddress;
      }

      // Sale order / quotation / payment templates read companyLogo on these roots (see saleOrderTemplateDefaults.js)
      const hasBusinessIdentity =
        Boolean(businessData?.name || businessData?.businessName);
      dummyData.saleorder = dummyData.saleorder || {};
      dummyData.saleorder.companyLogo =
        resolvedLogo || dummyData.saleorder.companyLogo || businessLogo;
      dummyData.saleorder.companyName = hasBusinessIdentity
        ? businessName
        : dummyData.saleorder.companyName || businessName;
      if (businessAddress) {
        dummyData.saleorder.companyAddress =
          businessAddress || dummyData.saleorder.companyAddress;
      }
      dummyData.saleorder.moduleDisplayName =
        getModuleLabel("saleOrder", "Sale Order");

      dummyData.quotation = dummyData.quotation || {};
      dummyData.quotation.companyLogo =
        resolvedLogo || dummyData.quotation.companyLogo || businessLogo;
      dummyData.quotation.companyName = hasBusinessIdentity
        ? businessName
        : dummyData.quotation.companyName || businessName;
      if (businessAddress) {
        dummyData.quotation.companyAddress =
          businessAddress || dummyData.quotation.companyAddress;
      }

      dummyData.payment = dummyData.payment || {};
      dummyData.payment.companyLogo =
        resolvedLogo || dummyData.payment.companyLogo || businessLogo;
      dummyData.payment.companyName = hasBusinessIdentity
        ? businessName
        : dummyData.payment.companyName || businessName;
      if (businessAddress) {
        dummyData.payment.companyAddress =
          businessAddress || dummyData.payment.companyAddress;
      }

      // Calculate the total amount based on the available data
      let totalAmount = 0;

      // Check if items array exists and is an array
      if (Array.isArray(dummyData?.contract?.items)) {
        totalAmount = dummyData.contract.items.reduce((total, item) => {
          const price = parseFloat(item?.price || item?.unitPrice || item?.rate) || 0;
          const quantity = parseFloat(item?.quantity) || 0;
          return total + price * quantity;
        }, 0);
      } else {
        // Fallback: use single quantity and price if available
        const price = parseFloat(dummyData?.contract?.price) || 0;
        totalAmount = price;
      }

      // Round total to 3 decimals safely
      totalAmount = parseFloat(totalAmount.toFixed(3));

      // Always set total_amount in dummyData
      dummyData.contract.totalValue = totalAmount;
      dummyData.contract.total_amount = totalAmount;

      // Convert total amount to words
      if (totalAmount > 0) {
        const integerPart = Math.floor(totalAmount);
        const decimalPart = Math.round((totalAmount - integerPart) * 1000);

        let totalInWords = numberToWords
          .toWords(integerPart, { and: true })
          .toUpperCase();

        if (decimalPart > 0) {
          totalInWords +=
            " AND " +
            numberToWords.toWords(decimalPart, { and: true }).toUpperCase() +
            " CENTS";
        }

        totalInWords += " ONLY";
        dummyData.contract.total_in_words = totalInWords;
      } else {
        dummyData.contract.total_in_words = "ZERO ONLY";
      }

      try {
        const rendered = ejs.render(templateContent, dummyData, {
          strict: false,
        });
        return rendered;
      } catch (error) {
        console.error("EJS rendering error:", error);
        return `<p>${t("documents.errors.renderTemplate", {
          defaultValue: "Error rendering template. Please try again later.",
        })}</p>`;
      }
    },
    [
      businessData,
      normalizeSignatureUrl,
      profileSignature,
      resolveBusinessLogo,
      resolveBusinessName,
      getModuleLabel,
      t,
    ]
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("handleSubmit - selectedTemplate:", selectedTemplate);
    
    if (!selectedTemplate || !selectedTemplate._id) {
      console.error("No template selected");
      return;
    }
    
    const payload = {
      templateId: selectedTemplate._id,
      contractId: contractId,
      template: selectedTemplate, // Include full template data
    };
    
    onSubmit(payload);
    onClose();
  };

  if (!isOpen) return null;

  // Parent (Create/Update invoice screens) should already provide the correct templates.
  // Do NOT re-filter by type here, because assignments/templates can store type differently
  // (e.g. assignment.type vs template.type = "invoice"), which can hide everything.
  let filteredTemplates = Array.isArray(templates) ? [...templates] : [];
  
  // Apply search filter if searchQuery exists
  if (searchQuery && searchQuery.trim()) {
    const searchTerm = searchQuery.toLowerCase().trim();
    filteredTemplates = filteredTemplates.filter(template => {
      const name = (template.name || "").toLowerCase();
      const templateType = (template.type || "").toLowerCase();
      return name.includes(searchTerm) || templateType.includes(searchTerm);
    });
  }
  
  console.log("DocumentTemplates - Filtered templates:", filteredTemplates);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl transform transition-all max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-800">
            {t("documents.selectTemplate", {
              defaultValue: "Select Document Template",
            })}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="p-4">
          {/* Search and Filter Section */}
          <div className="flex gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute ml-2 top-2.5 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder={t("documents.searchTemplates", {
                  defaultValue: "Search templates...",
                })}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-lime-500"
              />
            </div>
          </div>
          {/* Templates Grid */}
          <div className="overflow-y-auto max-h-[50vh]">
            {!templates || templates.length === 0 ? (
              <div className="flex flex-col justify-center items-center py-8">
                <div className="w-full max-w-md mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">
                      {t("documents.loadingTemplates", {
                        defaultValue: "Loading templates...",
                      })}
                    </span>
                    <span className="text-sm font-semibold text-lime-600">{Math.round(loadingProgress)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-lime-500 h-2.5 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${loadingProgress}%` }}
                    ></div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <div className="border-t-4 border-lime-500 border-solid rounded-full animate-spin w-5 h-5"></div>
                  <span>
                    {t("documents.fetchingTemplates", {
                      defaultValue: "Fetching templates from server...",
                    })}
                  </span>
                </div>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="flex justify-center items-center py-8">
                <span className="text-gray-600">
                  {searchQuery
                    ? t("documents.noSearchResults", {
                        defaultValue: "No templates found matching your search.",
                      })
                    : t("documents.noneAvailableForType", {
                        defaultValue: "No templates available for this invoice type.",
                      })}
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredTemplates.map((template) => (
                  <div
                    key={template._id}
                    className={`border rounded-lg p-4 cursor-pointer transition-all duration-200 hover:shadow-md ${
                      selectedTemplate?._id === template._id
                        ? "border-lime-500 bg-lime-50 ring-2 ring-lime-500"
                        : "border-gray-200 hover:border-lime-400"
                    }`}
                    onClick={() => setSelectedTemplate(template)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 text-base">
                          {template.name}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">{template.type}</p>
                      </div>
                      {template.isDefault && (
                        <span className="text-xs bg-lime-100 text-lime-600 px-2 py-0.5 rounded-full font-medium">
                          {t("common.default", { defaultValue: "Default" })}
                        </span>
                      )}
                    </div>

                    {/* Template PDF Preview - Clickable to Select and Use */}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        // Directly submit the template when clicking preview
                        if (template && template._id) {
                          const payload = {
                            templateId: template._id,
                            contractId: contractId,
                            template: template, // Include full template data
                          };
                          onSubmit(payload);
                          onClose();
                        }
                      }}
                      className="mt-4 border border-gray-200 rounded-md overflow-hidden cursor-pointer hover:border-lime-500 transition-all group relative aspect-[3/4] bg-gray-50"
                    >
                      {template.htmlContent || template.content ? (
                        <div className="w-full h-full overflow-hidden relative">
                          <iframe
                            srcDoc={`<html><head><style>html,body{margin:0;padding:0;overflow:hidden;height:100%;width:100%; background:white}</style></head><body>${renderTemplateWithDummyData(
                              template.htmlContent || template.content,
                              template.dummyData || {}
                            )}</body></html>`}
                            className="w-full h-full border-0 pointer-events-none"
                            title={t("documents.previewOf", {
                              defaultValue: "Preview of {{name}}",
                              name: template.name,
                            })}
                            sandbox="allow-same-origin"
                            style={{
                              transform: "scale(0.35)",
                              transformOrigin: "top left",
                              width: "280%",
                              height: "285%",
                              overflow: "hidden",
                              scrolling: "no",
                              position: "absolute",
                              top: 0,
                              left: 0,
                            }}
                            scrolling="no"
                            frameBorder="0"
                          />
                        </div>
                      ) : template.previewImage ? (
                        <img
                          src={template.previewImage}
                          alt={template.name}
                          className="w-full h-full object-contain bg-gray-50 group-hover:opacity-90 transition-opacity"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            const fallback = e.target.parentElement.querySelector('.preview-fallback');
                            if (fallback) fallback.style.display = 'flex';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="text-center">
                            <Eye className="w-8 h-8 text-gray-400 mx-auto mb-2 group-hover:text-lime-500 transition-colors" />
                            <p className="text-sm text-gray-500 group-hover:text-lime-600 transition-colors">
                              {t("documents.clickToUseTemplate", {
                                defaultValue: "Click to Use Template",
                              })}
                            </p>
                          </div>
                        </div>
                      )}
                      {/* Fallback for image error */}
                      <div className="preview-fallback hidden items-center justify-center bg-gray-100 w-full h-full">
                        <div className="text-center">
                          <Eye className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-500">
                            {t("documents.previewUnavailable", {
                              defaultValue: "Preview not available",
                            })}
                          </p>
                        </div>
                      </div>
                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all flex items-center justify-center pointer-events-none">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-lime-500 text-white px-4 py-2 rounded-md text-sm font-medium">
                          {t("documents.clickToUse", { defaultValue: "Click to Use" })}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-lime-500"
          >
            {t("common.cancel", { defaultValue: "Cancel" })}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedTemplate || !selectedTemplate._id}
            className={`px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-lime-500 ${
              selectedTemplate && selectedTemplate._id
                ? "bg-lime-500 hover:bg-lime-600"
                : "bg-gray-300 cursor-not-allowed"
            }`}
          >
            {t("documents.useTemplate", { defaultValue: "Use Template" })}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DocumentTemplates;
