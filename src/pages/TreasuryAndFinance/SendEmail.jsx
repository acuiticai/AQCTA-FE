import React, { useState, useEffect } from "react";
import { useHistory, useLocation } from "react-router-dom";
import axios from "axios";
import { Editor } from "react-draft-wysiwyg";
import { EditorState, ContentState, convertToRaw } from "draft-js";
import htmlToDraft from "html-to-draftjs";
import draftToHtml from "draftjs-to-html";
import html2pdf from "html2pdf.js";
import "react-draft-wysiwyg/dist/react-draft-wysiwyg.css";
import { notifyError, notifySuccess } from "@/utils/toast";
import { useEmailDefaults } from "@/hooks/useEmailDefaults";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const SendEmail = () => {
  const history = useHistory();
  const location = useLocation();
  const templateData = location.state || {};
  console.log("email templateData", templateData);

  const emailDefaults = useEmailDefaults();

  const [formData, setFormData] = useState({
    from: "",
    to:
      templateData?.invoiceData?.customer_id?.basicInformation?.customerEmail ||
      "username@domain.com",
    cc: templateData.authLetterData?.email || "",
    subject: `Authorization Letter - ${
      templateData.invoiceData?.invoice_number || "Invoice"
    }`,
    body: "", // Start with empty body for manual entry
  });

  const [showCc, setShowCc] = useState(true);
  const [showBcc, setShowBcc] = useState(false);
  const [errors, setErrors] = useState({});
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [editorState, setEditorState] = useState(EditorState.createEmpty());
  const [loading, setLoading] = useState(false);

  // Template-specific states
  const [htmlContent, setHtmlContent] = useState(
    templateData.htmlContent || ""
  );
  const [selectedTemplate, setSelectedTemplate] = useState(
    templateData.templateId || null
  );

  useEffect(() => {
    if (emailDefaults.loading) return;
    setFormData((prev) => ({
      ...prev,
      from: emailDefaults.from,
      cc: templateData.authLetterData?.email || emailDefaults.cc,
    }));
  }, [
    emailDefaults.loading,
    emailDefaults.from,
    emailDefaults.cc,
    templateData.authLetterData?.email,
  ]);

  // Generate static authorization letter content
  const generateAuthLetterContent = () => {
    if (!templateData) return "";

    const formatDate = (dateString) => {
      if (!dateString) return "N/A";
      return new Date(dateString).toLocaleDateString();
    };

    const formatAmount = (amount) => {
      if (!amount) return "0.00";
      return parseFloat(amount).toFixed(2);
    };

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #333; margin: 0;">🔔 Authorization Letter Notification</h2>
        </div>
        
        <div style="background-color: #ffffff; padding: 20px; border: 1px solid #e9ecef; border-radius: 8px;">
          <p>Hello ${
            templateData.authLetterData?.authorizedPersonName ||
            "Authorized Person"
          },</p>
          
          <p>An authorization letter has been generated for the following invoice:</p>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px; margin: 15px 0;">
            <h3 style="color: #495057; margin-top: 0;">Invoice Details:</h3>
            <p><strong>Invoice Number:</strong> ${
              templateData.invoiceData?.invoice_number || "N/A"
            }</p>
            <p><strong>Contract Number:</strong> ${
              templateData.invoiceData?.contract_id?.contractNo || "N/A"
            }</p>
            <p><strong>Customer:</strong> ${
              templateData.invoiceData?.customer_id?.basicInformation
                ?.customerDisplayName || "N/A"
            }</p>
            <p><strong>Amount:</strong> ${
              templateData.invoiceData?.currency || "USD"
            } ${formatAmount(templateData.invoiceData?.grandTotal)}</p>
            <p><strong>Due Date:</strong> ${formatDate(
              templateData.invoiceData?.due_date
            )}</p>
          </div>
          
          <div style="background-color: #e3f2fd; padding: 15px; border-radius: 6px; margin: 15px 0;">
            <h3 style="color: #1976d2; margin-top: 0;">Authorization Details:</h3>
            <p><strong>Authorized Person:</strong> ${
              templateData.authLetterData?.authorizedPersonName || "N/A"
            }</p>
            <p><strong>Email:</strong> ${
              templateData.authLetterData?.email || "N/A"
            }</p>
            <p><strong>Phone:</strong> ${
              templateData.authLetterData?.phone || "N/A"
            }</p>
            <p><strong>ID Number:</strong> ${
              templateData.authLetterData?.idNumber || "N/A"
            }</p>
          </div>
          
          <div style="background-color: #f3e5f5; padding: 15px; border-radius: 6px; margin: 15px 0;">
            <h3 style="color: #7b1fa2; margin-top: 0;">Business Information:</h3>
            <p><strong>Company:</strong> ${
              templateData.businessData?.name || "N/A"
            }</p>
            <p><strong>Address:</strong> ${
              templateData.businessData?.address || "N/A"
            }</p>
            <p><strong>Phone:</strong> ${
              templateData.businessData?.tel ||
              templateData.businessData?.phone ||
              templateData.businessData?.contactNumber ||
              "N/A"
            }</p>
            <p><strong>Email:</strong> ${
              templateData.businessData?.email || "N/A"
            }</p>
          </div>
          
          <p>Please review the attached authorization letter and take necessary action.</p>
          
          <p>Best Regards,<br>
          <strong>${templateData.businessData?.name || "Admin"}</strong></p>
        </div>
        
      </div>
    `;
  };

  // Populate email content with authorization letter data
  useEffect(() => {
    if (templateData) {
      const authLetterContent = generateAuthLetterContent();
      const contentState = ContentState.createFromBlockArray(
        htmlToDraft(authLetterContent).contentBlocks
      );
      setEditorState(EditorState.createWithContent(contentState));

      setFormData((prev) => ({
        ...prev,
        subject: `Authorization Letter - ${
          templateData.invoiceData?.invoice_number || "Invoice"
        }`,
        body: authLetterContent,
      }));
    }
  }, [templateData]);

  // Create attachments from template data
  useEffect(() => {
    console.log(
      "templateData",
      templateData,
      "templateData.pdfBlob",
      templateData.pdfBlob
    );
    let filesToAttach = [];

    // If HTML content exists, always create HTML attachment
    if (templateData && templateData.htmlContent) {
      // Create HTML file attachment
      const htmlBlob = new Blob([templateData.htmlContent], {
        type: "text/html",
      });
      const htmlFileName = templateData.templateName
        ? `${templateData.templateName}.html`
        : `Authorization-Letter-${
            templateData.invoiceData?.invoice_number || "Template"
          }.html`;

      filesToAttach.push({
        name: htmlFileName,
        type: "text/html",
        blob: htmlBlob,
        isTemplate: true,
      });

      // If PDF blob is null, generate one from HTML
      if (!templateData.pdfBlob) {
        // Option 1: Generate PDF client-side
        html2pdf()
          .set({
            margin: 0,
            filename: `Authorization-Letter-${
              templateData.invoiceData?.invoice_number || "Template"
            }.pdf`,
            image: { type: "jpeg", quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          })
          .from(templateData.htmlContent)
          .output("blob")
          .then((pdfBlob) => {
            const pdfFileName =
              templateData.pdfFileName ||
              `Authorization-Letter-${
                templateData.invoiceData?.invoice_number || "Template"
              }.pdf`;

            filesToAttach.push({
              name: pdfFileName,
              type: "application/pdf",
              blob: pdfBlob,
              isTemplate: true,
            });

            setAttachedFiles(filesToAttach);
          });
      } else {
        // If PDF blob exists, use it
        const pdfFileName =
          templateData.pdfFileName ||
          `Authorization-Letter-${
            templateData.invoiceData?.invoice_number || "Template"
          }.pdf`;

        filesToAttach.push({
          name: pdfFileName,
          type: "application/pdf",
          blob: templateData.pdfBlob,
          isTemplate: true,
        });

        setAttachedFiles(filesToAttach);
      }
    }
  }, [templateData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });

    // Clear error when user types
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: "",
      });
    }
  };

  const handleBack = () => {
    history.goBack();
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.from.trim()) {
      newErrors.from = "Sender email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.from)) {
      newErrors.from = "Sender email is invalid";
    }

    if (!formData.to.trim()) {
      newErrors.to = "Recipient email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.to)) {
      newErrors.to = "Recipient email is invalid";
    }

    if (formData.cc && !/\S+@\S+\.\S+/.test(formData.cc)) {
      newErrors.cc = "CC email is invalid";
    }

    if (formData.bcc && !/\S+@\S+\.\S+/.test(formData.bcc)) {
      newErrors.bcc = "BCC email is invalid";
    }

    if (!formData.subject.trim()) {
      newErrors.subject = "Subject is required";
    }

    return newErrors;
  };

  const handleSendEmail = async () => {
    const newErrors = validateForm();

    if (Object.keys(newErrors).length === 0) {
      setLoading(true);
      try {
        // Get the current HTML content from the editor for the email body
        const currentBody = draftToHtml(
          convertToRaw(editorState.getCurrentContent())
        );

        // Prepare form data for API
        const emailData = {
          from: formData.from,
          to: formData.to,
          cc: showCc ? formData.cc : "",
          bcc: showBcc ? formData.bcc : "",
          subject: formData.subject,
          body: currentBody, // Use the manually entered content from the editor
          requestId: templateData.invoiceData?._id,
          businessId: templateData.businessData?._id,
          templateId: selectedTemplate,
          templateData: templateData,
        };

        console.log("email data", emailData);

        // Create FormData for file upload
        const formDataWithFiles = new FormData();
        formDataWithFiles.append("emailData", JSON.stringify(emailData));

        // Append files if available
        attachedFiles.forEach((file, index) => {
          if (file.blob) {
            formDataWithFiles.append(`files`, file.blob, file.name);
          }
        });

        // Send email API request
        const response = await axios.post(
          `${Base_URL}/authorization-letter/send-email`,
          formDataWithFiles,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          }
        );

        if (response.data.status) {
          // Success notification with toast or alert
          notifySuccess("Email sent successfully!");
          history.push("/treasury/authorization-requests");
        } else {
          // Error notification
          notifyError(
            `Failed to send email: ${
              response.data.message || "Please try again"
            }`
          );
        }
      } catch (error) {
        console.error("Error sending email:", error);
        notifyError(
          `Failed to send email: ${
            error.response?.data?.message || error.message || "Please try again"
          }`
        );
      } finally {
        setLoading(false);
      }
    } else {
      // Form has errors, show them
      setErrors(newErrors);
    }
  };

  const handleEditorStateChange = (state) => {
    setEditorState(state);
    // Update the body field in formData with the current HTML content
    const htmlContent = draftToHtml(convertToRaw(state.getCurrentContent()));
    setFormData((prev) => ({
      ...prev,
      body: htmlContent,
    }));
  };

  const handleRemoveFile = (index) => {
    const updatedFiles = [...attachedFiles];
    updatedFiles.splice(index, 1);
    setAttachedFiles(updatedFiles);
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);

    const newFiles = files.map((file) => ({
      name: file.name,
      type: file.type,
      blob: file,
    }));

    setAttachedFiles([...attachedFiles, ...newFiles]);
  };

  // Download the attached file
  const handleDownloadAttachment = (file) => {
    if (file.blob) {
      const url = window.URL.createObjectURL(file.blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", file.name);
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
  };

  // Function to handle file dropdown actions
  const [openFileMenu, setOpenFileMenu] = useState(null);

  const toggleFileMenu = (index) => {
    if (openFileMenu === index) {
      setOpenFileMenu(null);
    } else {
      setOpenFileMenu(index);
    }
  };

  // Function to get file type for display
  const getFileTypeDisplay = (fileType) => {
    if (fileType === "application/pdf") return "PDF";
    if (fileType === "text/html") return "HTML";
    return fileType.split("/")[1]?.toUpperCase() || "FILE";
  };

  // Function to get background color for file type
  const getFileTypeBackgroundColor = (fileType) => {
    if (fileType === "application/pdf") return "bg-red-400";
    if (fileType === "text/html") return "bg-blue-400";
    return "bg-gray-400";
  };

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

      <h1 className="text-lg font-bold mb-8">Send Email with Template</h1>

      {/* Email Form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        {/* Email Header Fields */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center">
          <div className="w-16 text-gray-600 font-medium">From:</div>
          <div className="flex-1">
            <input
              type="text"
              name="from"
              className={`w-full p-1 border border-gray-200 rounded focus:outline-none  ${
                errors.from
                  ? "border-red-400"
                  : "focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
              }`}
              value={formData.from}
              onChange={handleChange}
              placeholder="sender@example.com"
            />
            {errors.from && (
              <p className="text-red-500 text-sm mt-1">{errors.from}</p>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-b border-gray-200 flex items-center">
          <div className="w-16 text-gray-600 font-medium">To:</div>
          <div className="flex-1">
            <input
              type="text"
              name="to"
              className={`w-full p-1 border border-gray-200 rounded focus:outline-none ${
                errors.to
                  ? "border-red-400"
                  : "focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
              }`}
              value={formData.to}
              onChange={handleChange}
              placeholder="recipient@example.com"
            />
            {errors.to && (
              <p className="text-red-500 text-sm mt-1">{errors.to}</p>
            )}
          </div>
        </div>

        {showCc && (
          <div className="px-6 py-4 border-b border-gray-200 flex items-center">
            <div className="w-16 text-gray-600 font-medium">Cc:</div>
            <div className="flex-1">
              <input
                type="text"
                name="cc"
                className={`w-full p-1 border border-gray-200 rounded focus:outline-none ${
                  errors.cc
                    ? "border-red-400"
                    : "focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                }`}
                value={formData.cc}
                onChange={handleChange}
                placeholder="cc@example.com"
              />
              {errors.cc && (
                <p className="text-red-500 text-sm mt-1">{errors.cc}</p>
              )}
            </div>
          </div>
        )}

        {showBcc && (
          <div className="px-6 py-4 border-b border-gray-200 flex items-center">
            <div className="w-16 text-gray-600 font-medium">Bcc:</div>
            <div className="flex-1">
              <input
                type="text"
                name="bcc"
                className={`w-full p-1 border border-gray-200 rounded focus:outline-none ${
                  errors.bcc
                    ? "border-red-400"
                    : "focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                }`}
                value={formData.bcc || ""}
                onChange={handleChange}
                placeholder="bcc@example.com"
              />
              {errors.bcc && (
                <p className="text-red-500 text-sm mt-1">{errors.bcc}</p>
              )}
            </div>
          </div>
        )}

        <div className="px-6 py-4 border-b border-gray-200 flex items-center">
          <div className="w-16 text-gray-600 font-medium">Subject:</div>
          <div className="flex-1">
            <input
              type="text"
              name="subject"
              className={`w-full p-1 border border-gray-200 rounded focus:outline-none ${
                errors.subject
                  ? "border-red-400"
                  : "focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
              }`}
              value={formData.subject}
              onChange={handleChange}
              placeholder="Email subject"
            />
            {errors.subject && (
              <p className="text-red-500 text-sm mt-1">{errors.subject}</p>
            )}
          </div>
        </div>

        {/* Email options */}
        <div className="px-6 py-2 flex items-center text-sm border-b border-gray-200">
          {!showCc && (
            <button
              className="text-gray-600 hover:text-blue-500 mr-4"
              onClick={() => setShowCc(true)}
            >
              Add Cc
            </button>
          )}

          {!showBcc && (
            <button
              className="text-gray-600 hover:text-blue-500 mr-4"
              onClick={() => setShowBcc(true)}
            >
              Add Bcc
            </button>
          )}
        </div>

        {/* Rich Text Editor - For manual message entry */}
        <div className="bg-white border-b border-gray-200">
          <div className="px-6 pt-4 pb-2">
            <h3 className="text-sm font-medium text-gray-600">Message</h3>
            <p className="text-xs text-gray-500 mt-1">
              Enter your message below. The template will be included as an
              attachment.
            </p>
          </div>
          <Editor
            editorState={editorState}
            onEditorStateChange={handleEditorStateChange}
            wrapperClassName="w-full"
            editorClassName="px-6 py-4 min-h-64"
            toolbar={{
              options: [
                "inline",
                "blockType",
                "fontSize",
                "list",
                "textAlign",
                "colorPicker",
                "link",
                "emoji",
                "image",
                "remove",
                "history",
              ],
              inline: {
                options: ["bold", "italic", "underline", "strikethrough"],
              },
              blockType: {
                options: [
                  "Normal",
                  "H1",
                  "H2",
                  "H3",
                  "H4",
                  "H5",
                  "H6",
                  "Blockquote",
                ],
              },
              list: {
                options: ["unordered", "ordered"],
              },
              textAlign: {
                options: ["left", "center", "right", "justify"],
              },
            }}
          />
        </div>

        {/* Attached Files */}
        <div className="flex flex-wrap gap-4 mb-4">
          {attachedFiles
            .filter((file) => file.blob && file.type === "application/pdf")
            .map((file, index) => (
              <div
                key={index}
                className="bg-gray-100 rounded-lg flex items-center py-2 px-4 relative"
                style={{ width: "240px" }}
              >
                <div
                  className={`${getFileTypeBackgroundColor(
                    file.type
                  )} text-white p-2 rounded mr-3`}
                >
                  <span className="text-xs font-bold">
                    {getFileTypeDisplay(file.type)}
                  </span>
                </div>
                <span
                  className="text-sm flex-1 truncate pr-2"
                  title={file.name}
                >
                  {file.name}
                </span>
                <button
                  className="text-gray-500 hover:text-gray-700"
                  onClick={() => toggleFileMenu(index)}
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                    ></path>
                  </svg>
                </button>

                {/* Dropdown menu */}
                {openFileMenu === index && (
                  <div className="absolute right-0 top-10 bg-white rounded-md shadow-lg z-10 border border-gray-200">
                    <button
                      className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm"
                      onClick={() => {
                        handleDownloadAttachment(file);
                        setOpenFileMenu(null);
                      }}
                    >
                      Download
                    </button>
                    <button
                      className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm"
                      onClick={() => {
                        handleRemoveFile(index);
                        setOpenFileMenu(null);
                      }}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            ))}

          {/* Upload Button */}
          <div>
            <input
              type="file"
              id="file-upload"
              className="hidden"
              multiple
              onChange={handleFileUpload}
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center p-2 w-40 h-10"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 4v16m8-8H4"
                ></path>
              </svg>
              Attach File
            </label>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end mt-6">
        <button
          className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-3 px-6 rounded-lg mr-4"
          onClick={() => history.push("/treasury/authorization-requests")}
        >
          Cancel
        </button>
        <button
          className={`bg-[var(--p-blue)] hover:bg-[var(--p-blue)] text-white font-medium py-3 px-6 rounded-lg flex items-center ${
            loading ? "opacity-70 cursor-not-allowed" : ""
          }`}
          onClick={handleSendEmail}
          disabled={loading}
        >
          {loading && (
            <svg
              className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          )}
          {loading ? "Sending..." : "Send Email"}
        </button>
      </div>
    </div>
  );
};

export default SendEmail;
