"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import requests from "@/services/httpService";
import AppLayout from "@/pages/Settings/app-layout";
import Header from "@/components/header/Header";
import { notifySuccess } from "@/utils/toast";
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  FileCopy as CloneIcon,
  Close as CloseIcon,
  Settings as SettingsIcon,
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  Star as StarIcon,
  ArrowDropDown as ArrowDropDownIcon,
} from "@mui/icons-material";
import useButtonColor from "@/hooks/useButtonColor";
import ejs from "ejs";
import numberToWords from "number-to-words";
import { useModuleLabels } from "@/context/ModuleLabelsContext";
import { useSettingsCrudPermissions } from "@/hooks/useSettingsCrudPermissions";

/** Email shells are system-managed; hidden from Settings UI but still used when sending emails. */
const SETTINGS_HIDDEN_TEMPLATE_TYPES = new Set(["email"]);

const isSettingsVisibleTemplate = (template) =>
  !SETTINGS_HIDDEN_TEMPLATE_TYPES.has(String(template?.type || "").toLowerCase());

const DocumentTemplate = () => {
  const buttonColor = useButtonColor();
  const { canAdd, canUpdate, canDelete } = useSettingsCrudPermissions();
  const { getModuleLabel, moduleLabelsVersion } = useModuleLabels();
  const location = useLocation();
  const [organization, setOrganization] = useState(null);
  const [allTemplates, setAllTemplates] = useState([]);
  const [filterType, setFilterType] = useState("all");
  const [businessDetails, setBusinessDetails] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [previewHtml, setPreviewHtml] = useState("");
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [showAssignTooltip, setShowAssignTooltip] = useState(false);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const selectedOrg = searchParams.get("selectedOrg");
    setOrganization(selectedOrg);
  }, [location]);

  const normalizeTemplateList = (templateRes) => {
    if (!templateRes) return [];
    if (Array.isArray(templateRes)) return templateRes;
    const inner = templateRes.data;
    if (Array.isArray(inner)) return inner;
    if (inner && Array.isArray(inner.data)) return inner.data;
    if (inner && Array.isArray(inner.documents)) return inner.documents;
    return [];
  };

  const normalizeAssignmentList = (assignmentRes) => {
    if (!assignmentRes) return [];
    const inner = assignmentRes.data;
    if (Array.isArray(inner)) return inner;
    if (inner && Array.isArray(inner.data)) return inner.data;
    return [];
  };

  useEffect(() => {
    const fetchTemplates = async () => {
      if (!organization) return;
      try {
        setLoading(true);
        const [tOut, aOut, bOut] = await Promise.allSettled([
          requests.get("/document-templates"),
          requests.get(`/business-templates/${organization}`),
          requests.get(`/business/${organization}`),
        ]);

        const templateRes = tOut.status === "fulfilled" ? tOut.value : null;
        const assignmentRes = aOut.status === "fulfilled" ? aOut.value : null;
        const businessDataRes = bOut.status === "fulfilled" ? bOut.value : null;

        if (tOut.status === "rejected") {
          console.error("document-templates failed:", tOut.reason);
          setError("Failed to load templates");
        } else {
          setError(null);
        }

        const templates = normalizeTemplateList(templateRes);
        const assigned = normalizeAssignmentList(assignmentRes);
        console.log("assigned", assigned);
        console.log("templates", templates);

        const mappedTemplates = templates.map((template) => {
          const assignedItem = assigned.find(
            (a) => a?.templateId?._id === template._id
          );
          return {
            ...template,
            isActive: assignedItem?.isActive || false,
            isDefault: assignedItem?.isDefault || false,
            assignmentId: assignedItem?._id || null,
          };
        });

        setAllTemplates(mappedTemplates);
        setBusinessDetails(businessDataRes?.data || businessDataRes || null);
      } catch (err) {
        console.error(err);
        setError("Failed to load templates");
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, [organization]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (activeDropdown && !event.target.closest(".settings-dropdown")) {
        setActiveDropdown(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [activeDropdown]);

  const handleSetDefault = async (assignmentId) => {
    try {
      await requests.put(`/business-templates/${assignmentId}`, {
        isDefault: true,
      });
      setAllTemplates((prev) =>
        prev.map((t) => ({
          ...t,
          isDefault: t.assignmentId === assignmentId,
        }))
      );
      notifySuccess(
        `Template set as default for ${businessDetails?.name || "selected business"}.`
      );
    } catch (err) {
      setError("Failed to set default template");
    }
  };

  const handleToggleActive = async (assignmentId, isActive) => {
    if (!canUpdate) return;
    try {
      console.log("handleToggleActive", handleToggleActive);
      await requests.put(`/business-templates/${assignmentId}`, {
        isActive: !isActive,
      });
      setAllTemplates((prev) =>
        prev.map((t) =>
          t.assignmentId === assignmentId ? { ...t, isActive: !isActive } : t
        )
      );
      const actionText = !isActive ? "enabled" : "disabled";
      notifySuccess(
        `Template ${actionText} successfully for ${businessDetails?.name || "selected business"}.`
      );
    } catch (err) {
      setError("Failed to toggle status");
    }
  };

  const handleDeleteAssignment = async (assignmentId) => {
    if (!canDelete) return;
    try {
      await requests.delete(`/business-templates/${assignmentId}`);
      setAllTemplates((prev) =>
        prev.map((t) =>
          t.assignmentId === assignmentId
            ? { ...t, isActive: false, isDefault: false, assignmentId: null }
            : t
        )
      );
    } catch (err) {
      setError("Failed to remove assignment");
    }
  };

  const handleAssignTemplate = async (template) => {
    if (!canAdd && !canUpdate) return;
    try {
      const response = await requests.post(`/business-templates`, {
        businessId: organization,
        templateId: template._id,
        type: template.type,
      });
      const assigned = response?.data;

      setAllTemplates((prev) =>
        prev.map((t) =>
          t._id === template._id
            ? {
                ...t,
                assignmentId: assigned._id,
                isActive: assigned.isActive,
                isDefault: assigned.isDefault,
              }
            : t
        )
      );
      notifySuccess(
        `Template assigned successfully to ${businessDetails?.name || "selected business"}.`
      );
    } catch (err) {
      setError("Failed to assign template");
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    if (!canDelete) return;
    try {
      await requests.delete(`/document-templates/${templateId}`);
      setAllTemplates((prev) => prev.filter((t) => t._id !== templateId));
    } catch (err) {
      setError("Failed to delete template");
    }
  };

  const handleCloneTemplate = async (template) => {
    if (!canAdd) return;
    try {
      const response = await requests.post("/document-templates/clone", {
        templateId: template._id,
      });
      const newTemplate = response?.data?.data || response?.data;
      console.log("Templates ids are: ", response?.data);
      if (newTemplate) setAllTemplates((prev) => [...prev, newTemplate]);
    } catch (err) {
      setError("Failed to clone template");
    }
  };

  const renderTemplateWithDummyData = useCallback(
    (templateContent, dummyData) => {
      if (!templateContent) {
        return "<!DOCTYPE html><html><head><title>Rubber Contract</title></head><body><h1>Sample Contract</h1><p>This is a placeholder</p></body></html>";
      }

      // Prepare additional variables with fallback values
      const businessLogo = `${businessDetails?.image || "default-logo.png"}`; // Fallback logo
      const businessName = businessDetails?.name || "BARENA GROUP SDN BHD"; // Fallback business name

      // Ensure necessary data exists before using it in the template
      dummyData.contract = dummyData.contract || {}; // Ensure contract is defined
      dummyData.contract.beneficiary = dummyData.contract.beneficiary || {};
      dummyData.contract.beneficiary.accountHolder = businessName;
      dummyData.contract.sellerName = businessName;
      dummyData.contract.businessLogo = businessLogo;

      dummyData.payslip = dummyData.payslip || {};
      const ps = dummyData.payslip;
      ps.companyLogo = businessLogo;
      ps.companyName = businessName;
      ps.companyAddress = businessDetails?.address ? String(businessDetails.address) : ps.companyAddress;

      dummyData.saleorder = dummyData.saleorder || {};
      dummyData.saleorder.companyLogo = businessLogo;
      dummyData.saleorder.companyName = businessName;
      dummyData.saleorder.companyAddress = businessDetails?.address ? String(businessDetails.address) : dummyData.saleorder.companyAddress;
      dummyData.saleorder.moduleDisplayName =
        getModuleLabel("saleOrder", "Sale Order");

      dummyData.quotation = dummyData.quotation || {};
      dummyData.quotation.companyLogo = businessLogo;
      dummyData.quotation.companyName = businessName;
      dummyData.quotation.companyAddress = businessDetails?.address ? String(businessDetails.address) : dummyData.quotation.companyAddress;

      dummyData.payment = dummyData.payment || {};
      dummyData.payment.companyLogo = businessLogo;
      dummyData.payment.companyName = businessName;
      dummyData.payment.companyAddress = businessDetails?.address ? String(businessDetails.address) : dummyData.payment.companyAddress;
      const net =
        ps.netPay !== undefined && ps.netPay !== null
          ? parseFloat(ps.netPay)
          : NaN;
      if (!Number.isNaN(net) && net > 0 && !ps.amountInWords) {
        const integerPart = Math.floor(net);
        const decimalPart = Math.round((net - integerPart) * 100);
        let words = numberToWords
          .toWords(integerPart, { and: true })
          .replace(/^\w/, (c) => c.toUpperCase());
        if (decimalPart > 0) {
          words +=
            " And " +
            numberToWords
              .toWords(decimalPart, { and: true })
              .replace(/^\w/, (c) => c.toUpperCase()) +
            " Paise";
        }
        const cc = ps.currencyCode || "INR";
        ps.amountInWords = `${cc} ${words} Only`;
      }

      // Calculate the total amount based on the available data
      let totalAmount = 0;

      // Check if items array exists and is an array
      if (Array.isArray(dummyData?.contract?.items)) {
        totalAmount = dummyData.contract.items.reduce((total, item) => {
          const price = parseFloat(item?.price) || 0; // Safe parsing
          const quantity = parseFloat(item?.quantity) || 0; // Safe parsing
          return total + price * quantity;
        }, 0);
      } else {
        // Fallback: use single quantity and price if available
        const price = parseFloat(dummyData?.contract?.price) || 0;
        totalAmount = price;
      }

      // Round total to 3 decimals safely
      totalAmount = parseFloat(totalAmount.toFixed(3));
      console.log("Total Amount", totalAmount);

      // Always set total_amount in dummyData
      dummyData.contract.totalValue = totalAmount;
      dummyData.contract.total_amount = totalAmount;

      // Convert total amount to words with "AND" and "ONLY"
      if (totalAmount > 0) {
        const integerPart = Math.floor(totalAmount); // Integer part
        const decimalPart = Math.round((totalAmount - integerPart) * 1000); // Decimal part as whole number

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
        // If no total, still define it as "ZERO ONLY"
        dummyData.contract.total_in_words = "ZERO ONLY";
      }

      try {
        const rendered = ejs.render(templateContent, dummyData, {
          strict: false,
        });
        return rendered;
      } catch (error) {
        console.error("EJS rendering error:", error);
        console.error("Template content:", templateContent); // Log the template to check its structure
        console.error("Dummy data:", dummyData); // Log the dummy data to ensure it's structured correctly
        return "<p>Error rendering template. Please try again later.</p>";
      }
    },
    [businessDetails, getModuleLabel, moduleLabelsVersion]
  );

  const documentTypeFilterOptions = useMemo(
    () => [
      { label: "Invoice", value: "invoice" },
      { label: "Payslip", value: "payslip" },
      {
        label: getModuleLabel("saleOrder", "Sale order"),
        value: "saleorder",
      },
      { label: "Quotation", value: "quotation" },
      { label: "Payment", value: "payment" },
      { label: "Work order", value: "workorder" },
    ],
    [getModuleLabel, moduleLabelsVersion],
  );

  const handlePreview = (template) => {
    setPreviewTemplate(template);
    const renderedHtml = renderTemplateWithDummyData(
      template.htmlContent,
      template.dummyData
    );
    setPreviewHtml(renderedHtml);
  };

  const closePreview = () => {
    setPreviewTemplate(null);
    setPreviewHtml("");
  };

  const toggleDropdown = (templateId) => {
    setActiveDropdown(activeDropdown === templateId ? null : templateId);
  };

  const handleAction = (action, e) => {
    e.stopPropagation();

    switch (action) {
      case "preview":
        handlePreview(previewTemplate);
        break;
      case "default":
        if (previewTemplate.assignmentId) {
          handleSetDefault(previewTemplate.assignmentId);
        }
        break;
      case "toggle":
        if (previewTemplate.assignmentId) {
          handleToggleActive(
            previewTemplate.assignmentId,
            previewTemplate.isActive
          );
        }
        break;
      default:
        break;
    }

    setActiveDropdown(null);
  };

  const filteredTemplates = allTemplates.filter((t) => {
    if (!isSettingsVisibleTemplate(t)) return false;
    const matchesType = filterType === "all" || t.type === filterType;
    const matchesSearch =
      t.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.type?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  // Generate placeholder preview images for templates
  const getTemplatePreviewUrl = (template) => {
    // In a real implementation, you would generate or fetch actual previews
    return "/placeholder.svg?height=400&width=300";
  };

  return (
    <AppLayout>
      <Header />
      <div className="bg-gray-50 min-h-[90vh] overflow-y-scroll max-h-[90vh]">
        <div className="container mx-auto px-6 py-8">
          <div className="mb-8 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">
              Document Templates
            </h1>
            {/* <h1 className="text-2xl font-bold text-gray-900">Invoice Templates</h1> */}
            <div className="flex items-center gap-2">
              <button className="p-2 rounded-full hover:bg-gray-100">
                <MoreVertIcon className="h-6 w-6 text-gray-500" />
              </button>
            </div>
          </div>

          <div className="mb-6 flex flex-wrap gap-4">
            <div className="w-full md:w-64">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full p-3 border rounded-lg border-gray-200 focus:border-emerald-500 focus:ring-emerald-500"
              >
                <option value="all">All Document Types</option>
                {documentTypeFilterOptions.map(({ label, value }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg p-2.5 bg-white border border-gray-200 focus:border-emerald-500 focus:ring-emerald-500"
              />
            </div>
            {/* <button className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors">
              <AddIcon className="h-5 w-5" />
              <span>Add Template</span>
            </button> */}
          </div>

          {loading ? (
            <div className="text-center py-12">Loading templates...</div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl shadow-sm">
              <p className="text-gray-500">No templates found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
              {filteredTemplates.map((template) => (
                <div
                  key={template._id}
                  className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow duration-200 relative"
                >
                  <div
                    className="relative cursor-pointer"
                    onClick={() => handlePreview(template)}
                  >
                    <div className="aspect-[3/4] bg-gray-50 overflow-hidden relative">
                      {template.htmlContent || template.content ? (
                        <div className="w-full h-full overflow-hidden">
                          <iframe
                            srcDoc={`<html><head><style>html,body{margin:0;padding:0;overflow:hidden;height:100%;width:100%; background:white}</style></head><body>${renderTemplateWithDummyData(
                              template.htmlContent,
                              template.dummyData
                            )}</body></html>`}
                            className="w-full h-full border-0 pointer-events-none"
                            title={`Preview of ${template.name}`}
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
                      ) : (
                        <img
                          src={
                            getTemplatePreviewUrl(template) ||
                            "/placeholder.svg"
                          }
                          alt={`Preview of ${template.name}`}
                          className="w-full h-full object-cover"
                        />
                      )}

                      {!template.isActive && (
                        <div className="absolute inset-0 bg-white bg-opacity-70 flex items-center justify-center">
                          <span className="text-red-600 text-3xl font-medium">
                            Disabled
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 pb-2 px-2 flex justify-between ">
                    <div className="flex flex-col">
                      <h3 className="text-sm font-medium text-gray-900">
                        {template.name || "Template Name"}
                      </h3>
                      {!template.isActive && (
                        <div className="text-red-600 text-sm font-medium">
                          Disabled
                        </div>
                      )}
                    </div>

                    <div className="relative settings-dropdown flex flex-col items-center">
                      <button
                        className="p-1 rounded-full hover:bg-gray-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleDropdown(template._id);
                        }}
                      >
                        <div className="flex items-center relative">
                          <SettingsIcon className="p-0 mr-1 text-gray-400" />
                          <ArrowDropDownIcon className="p-0 m-0 text-gray-400 absolute -right-[12px]" />
                        </div>
                      </button>
                      {template.isDefault && (
                        <StarIcon className="h-5 w-5 text-amber-400 mx-auto inline-block" />
                      )}

                      {activeDropdown === template._id && (
                        <div
                          className="fixed right-auto mt-2 w-48 bg-white rounded-lg shadow-lg z-50 border border-gray-100 py-2"
                          style={{ top: "auto", left: "auto" }}
                        >
                          <button
                            className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 bg-lime-100 text-lime-600 font-medium"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePreview(template);
                              setActiveDropdown(null);
                            }}
                          >
                            Preview
                          </button>

                          <button
                            className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (template.assignmentId) {
                                handleSetDefault(template.assignmentId);
                              }
                              setActiveDropdown(null);
                            }}
                            disabled={template.isDefault}
                          >
                            Set as Default
                          </button>

                          <button
                            className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 ${template.isActive
                              ? "text-red-500"
                              : "text-green-500"
                              }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (template.assignmentId) {
                                handleToggleActive(
                                  template.assignmentId,
                                  template.isActive
                                );
                              }
                              setActiveDropdown(null);
                            }}
                          >
                            {template.isActive ? "Disable" : "Enable"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Template Preview Modal */}
          {previewTemplate && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl max-w-[69rem] w-full">
                <div className="sticky top-0 bg-white p-4 border-b flex justify-between items-center z-10">
                  <h2 className="text-xl font-bold">
                    {previewTemplate.name || "Template Preview"}
                  </h2>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      {canAdd && (
                        <button
                          onClick={() => handleCloneTemplate(previewTemplate)}
                          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full"
                          title="Clone template"
                        >
                          <CloneIcon className="h-5 w-5" />
                        </button>
                      )}
                      {canUpdate && (
                        <Link
                          to={`/edit-document-template/${previewTemplate._id}`}
                          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full"
                          title="Edit template"
                        >
                          <EditIcon className="h-5 w-5" />
                        </Link>
                      )}
                      {canDelete && (
                        <button
                          onClick={() =>
                            handleDeleteTemplate(previewTemplate._id)
                          }
                          className="p-2 text-gray-500 hover:text-red-500 hover:bg-gray-100 rounded-full"
                          title="Delete template"
                        >
                          <DeleteIcon className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                    <button
                      onClick={closePreview}
                      className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full"
                      title="Close preview"
                    >
                      <CloseIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div className="p-6">
                  <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg">
                    <div>
                      <span className="text-sm font-medium text-gray-500">
                        Type:
                      </span>
                      <span className="ml-2">
                        {previewTemplate.type || "No type specified"}
                      </span>
                    </div>

                    <div>
                      <span className="text-sm font-medium text-gray-500">
                        Status:
                      </span>
                      <span className="ml-2">
                        {previewTemplate.isActive ? (
                          <span className="text-green-500">Active</span>
                        ) : (
                          <span className="text-gray-500">Inactive</span>
                        )}
                      </span>
                    </div>

                    <div>
                      <span className="text-sm font-medium text-gray-500">
                        Default:
                      </span>
                      <span className="ml-2">
                        {previewTemplate.isDefault ? (
                          <span className="text-blue-500">Yes</span>
                        ) : (
                          <span className="text-gray-500">No</span>
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="border rounded-lg overflow-hidden shadow-sm">
                    <div className="bg-white p-0">
                      <iframe
                        srcDoc={previewHtml}
                        className="w-full min-h-[50vh] border-0"
                        title="Template Preview"
                      />
                    </div>
                  </div>
                </div>

                <div className="sticky bottom-0 bg-white p-4 border-t flex justify-between">
                  <div className="flex items-center gap-3">
                    {!previewTemplate.assignmentId && (
                      <button
                        onClick={async () => {
                          await handleAssignTemplate(previewTemplate);
                          closePreview();
                        }}
                        className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        Assign to Business
                      </button>
                    )}

                    <div
                      className="relative"
                      onMouseEnter={() => {
                        if (!previewTemplate.assignmentId) {
                          setShowAssignTooltip(true);
                        }
                      }}
                      onMouseLeave={() => setShowAssignTooltip(false)}
                    >
                      <button
                        onClick={async () => {
                          if (previewTemplate.assignmentId) {
                            await handleToggleActive(
                              previewTemplate.assignmentId,
                              previewTemplate.isActive
                            );
                            closePreview();
                          }
                        }}
                        disabled={!previewTemplate.assignmentId}
                        className={`px-4 py-2 rounded-lg transition-colors ${!previewTemplate.assignmentId
                          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                          : previewTemplate.isActive
                            ? "bg-red-50 text-red-600 hover:bg-red-100"
                            : "bg-green-50 text-green-600 hover:bg-green-100"
                          }`}
                      >
                        {previewTemplate.isActive
                          ? "Disable Template"
                          : "Enable Template"}
                      </button>

                      {showAssignTooltip && !previewTemplate.assignmentId && (
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-sm rounded-lg whitespace-nowrap z-50">
                          First assign business, then you can enable or disable this template
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                            <div className="border-4 border-transparent border-t-gray-800"></div>
                          </div>
                        </div>
                      )}
                    </div>

                    {previewTemplate.assignmentId && !previewTemplate.isDefault && (
                      <button
                        onClick={async () => {
                          await handleSetDefault(previewTemplate.assignmentId);
                          closePreview();
                        }}
                        className="px-4 py-2 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition-colors"
                      >
                        Set as Default
                      </button>
                    )}
                  </div>

                  <button
                    onClick={closePreview}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default DocumentTemplate;
