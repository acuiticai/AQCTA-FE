import React, { useState, useEffect } from "react";
import { CKEditor } from "ckeditor4-react";
import axios from "axios";
import { useParams, useHistory, useLocation } from "react-router-dom";
import { notifySuccess, notifyError } from "@/utils/toast";
import { FiMail, FiArrowLeft, FiSave } from "react-icons/fi";
import Header from "@/components/header/Header";
import AppLayout from "@/pages/Settings/app-layout";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const AddEmailTemplate = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const business_id = searchParams.get("selectedOrg"); // ✅ Extract business_id from URL

  console.log("✅ Selected Organization ID:", business_id); // Debugging log

  const { id } = useParams();
  const history = useHistory();

  const [templateName, setTemplateName] = useState("");
  const [subject, setSubject] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    if (id) {
      setIsEditMode(true);
      fetchTemplateData();
    }
  }, [id]);

  const fetchTemplateData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${Base_URL}/email-template/template/${id}`
      );
      const data = response.data;

      if (data) {
        setTemplateName(data.template_name || "");
        setSubject(data.temp_subject || "");
        setHtmlContent(data.html_content || "<p>Start editing...</p>");
      }
      setLoading(false);
    } catch (error) {
      console.error("Error fetching template:", error);
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!templateName || !subject || !htmlContent) {
      notifyError("Please fill in all fields.");
      return;
    }

    const templateData = {
      template_name: templateName,
      temp_subject: subject,
      html_content: htmlContent,
    };

    try {
      setLoading(true);
      let response;
      let updatedBusinessId = business_id; // Default from URL

      if (isEditMode) {
        // ✅ PUT request (update existing template)
        response = await axios.put(
          `${Base_URL}/email-template/update-template/${id}`,
          templateData
        );
        notifySuccess("Template updated successfully!");
        updatedBusinessId = response.data?.data?.business_id || business_id; // ✅ Extract business_id from response
      } else {
        // ✅ POST request (new template) - send business_id
        templateData.business_id = business_id;
        response = await axios.post(
          `${Base_URL}/email-template/add-template`,
          templateData
        );
        notifySuccess("Template added successfully!");
      }

      setLoading(false);

      // ✅ Redirect back to EmailTemplatesUI with the correct business_id
      history.push(`/EmailTemplatesUI?selectedOrg=${updatedBusinessId}`);
    } catch (error) {
      setLoading(false);
      console.error("❌ Error submitting the template:", error);
      notifyError("Error submitting the template.");
    }
  };

  return (
    <AppLayout>
      <Header />
      <div className="min-h-screen bg-gray-100 py-10 px-4 max-h-[90vh] overflow-y-auto pb-[120px]">
        <div className="max-w-4xl mx-auto bg-white shadow-md rounded-lg p-6">
          <div className="flex items-center mb-6">
            <div className="bg-emerald-100 p-3 rounded-full">
              <FiMail className="text-emerald-600 text-2xl" />
            </div>
            <div className="ml-4">
              <h1 className="text-2xl font-semibold text-gray-700">
                {isEditMode ? "Update Email Template" : "Add New Template"}
              </h1>
              <p className="text-gray-500">
                {isEditMode
                  ? "Update the details of the email template."
                  : "Fill the form below to add a new Email Template."}
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            {/* Template Name */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Name
              </label>
              <input
                type="text"
                placeholder="Template Name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-400"
                required
              />
            </div>

            {/* Subject */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Subject
              </label>
              <input
                type="text"
                placeholder="Subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-400"
                required
              />
            </div>

            {/* HTML Content */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-600 mb-2">
                HTML
              </label>

              {loading ? (
                <p>Loading editor...</p>
              ) : (
                <CKEditor
                  initData={htmlContent}
                  onChange={(event) => {
                    const data = event.editor.getData();
                    setHtmlContent(data);
                  }}
                  config={{
                    height: 300,
                    // Preserve full email HTML; CKEditor ACF otherwise strips styles on edit.
                    allowedContent: true,
                    extraPlugins:
                      "colorbutton,font,justify,image2,table,print,pagebreak",
                  }}
                />
              )}
            </div>

            {/* Buttons */}
            <div className="flex justify-end space-x-4">
              {/* ✅ Hide Cancel button when in edit mode */}
              {!isEditMode && (
                <button
                  type="button"
                  onClick={() =>
                    history.push(`/EmailTemplatesUI?selectedOrg=${business_id}`)
                  }
                  className="flex items-center gap-2 px-6 py-2 border border-emerald-500 text-emerald-500 rounded-md hover:bg-emerald-100 transition-all"
                >
                  <FiArrowLeft />
                  Cancel
                </button>
              )}

              <button
                type="submit"
                disabled={loading}
                className={`flex items-center gap-2 px-6 py-2 ${
                  loading
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-emerald-500 hover:bg-emerald-600"
                } text-white rounded-md transition-all`}
              >
                <FiSave />
                {loading
                  ? isEditMode
                    ? "Updating..."
                    : "Saving..."
                  : isEditMode
                  ? "Update Template"
                  : "Save Template"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </AppLayout>
  );
};

export default AddEmailTemplate;
