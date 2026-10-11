"use client";
import { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  Eye,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link,
  ImageIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Code,
} from "lucide-react";
import { useLocation, useHistory } from "react-router-dom";
import axios from "axios";
import { useEmailDefaults } from "@/hooks/useEmailDefaults";

// Assuming these are defined elsewhere in your application
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
const headers = {
  "Content-Type": "application/json",
  authorization: `Bearer ${localStorage.getItem("token")}`,
};

export default function EmailPreview() {
  const location = useLocation();
  const history = useHistory();
  const { invoiceData } = location.state || {};
  const editorRef = useRef(null);

  const emailDefaults = useEmailDefaults();

  const [emailData, setEmailData] = useState({
    from: "",
    to: invoiceData?.customer_email || "",
    cc: "",
    subject: "Proforma Invoice",
  });

  useEffect(() => {
    if (emailDefaults.loading) return;
    setEmailData((prev) => ({
      ...prev,
      from: emailDefaults.from,
      cc: emailDefaults.cc,
    }));
  }, [emailDefaults.loading, emailDefaults.from, emailDefaults.cc]);

  const [loading, setLoading] = useState(false);
  const [attachInvoice, setAttachInvoice] = useState(true);
  const [attachStatement, setAttachStatement] = useState(true);
  const [isEditingHtml, setIsEditingHtml] = useState(false);

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "2-digit",
    });
  };

  // Default email template
  const defaultEmailHtml = `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <div style="text-align: center; background-color: #e8f5f1; padding: 16px; margin-bottom: 16px;">
        <h2 style="font-weight: 500; margin: 0;">Invoice #${
          invoiceData?.invoice_number || "INV-000021"
        }</h2>
      </div>

      <p style="margin-bottom: 16px;">Dear ${
        invoiceData?.customer_name?.split(" ")[0] || "Customer"
      },</p>

      <p style="margin-bottom: 24px;">
        Thank you for your business. Your invoice can be viewed, printed and downloaded as PDF from the link below.
      </p>

      <div style="background-color: #fffef0; padding: 24px; margin-bottom: 24px; text-align: center;">
        <h3 style="color: #666; margin-bottom: 8px; font-weight: normal;">Invoice Amount</h3>
        <p style="color: #ff5a5a; font-size: 24px; font-weight: bold; margin-bottom: 16px;">
          USD ${
            invoiceData?.grandTotal?.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }) || "10000.00"
          }
        </p>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; max-width: 400px; margin: 0 auto 16px auto;">
          <div style="text-align: right; color: #666;">Invoice No:</div>
          <div style="text-align: left;">${
            invoiceData?.invoice_number || "INV-000021"
          }</div>

          <div style="text-align: right; color: #666;">Invoice Date:</div>
          <div style="text-align: left;">
            ${
              invoiceData?.invoice_date
                ? formatDate(invoiceData.invoice_date)
                : "11-Mar-25"
            }
          </div>

          <div style="text-align: right; color: #666;">Due Date:</div>
          <div style="text-align: left;">
            ${
              invoiceData?.due_date
                ? formatDate(invoiceData.due_date)
                : "11-Mar-25"
            }
          </div>
        </div>
<a
  href="{{VIEW_INVOICE_URL}}"
  target="_blank"
  style="background-color:#bcd351;color:white;padding:8px 24px;border-radius:4px;text-decoration:none;display:inline-block;">
  View Invoice
</a>


   </div>

      <div style="margin-bottom: 24px;">
        <p style="margin-bottom: 4px;">Regard</p>
        <p style="margin-bottom: 4px;">Finance Department</p>
        <p style="margin-bottom: 0;">AQCTA</p>
      </div>
    </div>
  `;

  const [emailHtml, setEmailHtml] = useState(defaultEmailHtml);
  const [rawHtmlMode, setRawHtmlMode] = useState(false);

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEmailData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Strip HTML tags from text
  const stripHtml = (html) => {
    if (!html) return "";
    const doc = new DOMParser().parseFromString(html, "text/html");
    return doc.body.textContent || "";
  };

  // Handle final submission
  const handleSendEmail = async () => {
    setLoading(true);
    try {
      const payload = {
        invoice_number: invoiceData.invoice_number,
        customer_id: invoiceData.customer_id,
        customer_name: invoiceData.customer_name,
        customer_email: invoiceData.customer_email,
        email: {
          from: emailData.from,
          to: emailData.to,
          cc: emailData.cc,
          subject: emailData.subject,
        },
        email_html: emailHtml,
        AttachInvoice: attachInvoice,
        AttachStatement: attachStatement,
        contract_id: invoiceData.contract_id,
        contract_no: invoiceData.contract_no,
        invoice_date: invoiceData.invoice_date,
        due_date: invoiceData.due_date,
        items: invoiceData.items,
        business_id: invoiceData.business_id,
        subTotal: invoiceData.subTotal,
        discount: Number.parseFloat(invoiceData.discount),
        discountAmount: invoiceData.discountAmount,
        documentUrl: invoiceData.documentUrl,
        shippingCharges: Number.parseFloat(invoiceData.shippingCharges),
        adjustment: Number.parseFloat(invoiceData.adjustment),
        grandTotal: invoiceData.grandTotal,
        status: invoiceData.status,
        billingAddress: invoiceData.billingAddress,
        shippingAddress: invoiceData.shippingAddress || "",
        sameAsBilling: invoiceData.sameAsBilling === true,
        terms: stripHtml(invoiceData.terms),
      };

      const response = await axios.post(
        `${Base_URL}/proforma-invoice`,
        payload,
        { headers }
      );
      if (response.data) {
        history.push({
          pathname: "/view-purchase-contract",
          state: { contractId: invoiceData.contract_id },
        });
      }
    } catch (error) {
      console.error("Error sending email:", error);
    } finally {
      setLoading(false);
    }
  };

  // Editor commands
  const execCommand = (command, value = null) => {
    if (!isEditingHtml) return;
    document.execCommand(command, false, value);
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      setEmailHtml(html);
    }
  };

  // Toggle between WYSIWYG and raw HTML mode
  const toggleHtmlMode = () => {
    setRawHtmlMode(!rawHtmlMode);
  };

  // Update HTML content when editing raw HTML
  const handleRawHtmlChange = (e) => {
    setEmailHtml(e.target.value);
  };

  useEffect(() => {
    if (isEditingHtml && editorRef.current && !rawHtmlMode) {
      editorRef.current.innerHTML = emailHtml;
    }
  }, [isEditingHtml, rawHtmlMode]); // Only set on mode switch

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Back button */}
      <div className="mb-8">
        <button
          className="flex items-center text-gray-700 text-sm"
          onClick={() => history.goBack()}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </button>
      </div>

      {/* Email Title */}
      <h1 className="text-2xl font-medium mb-8">
        Email to {invoiceData?.customer_name || "AF Juta Trading"}
      </h1>

      {/* Email Form */}
      <div className="border border-gray-200 rounded-lg p-6 mb-8">
        <div className="grid grid-cols-[100px_1fr] items-center mb-4 border-b border-gray-100 pb-4">
          <label className="text-gray-600">From</label>
          <input
            type="email"
            name="from"
            value={emailData.from}
            onChange={handleInputChange}
            className="border-none outline-none w-full"
          />
        </div>

        <div className="grid grid-cols-[100px_1fr] items-center mb-4 border-b border-gray-100 pb-4">
          <label className="text-gray-600">Send To</label>
          <input
            type="email"
            name="to"
            value={emailData.to}
            onChange={handleInputChange}
            className="border-none outline-none w-full"
          />
        </div>

        <div className="grid grid-cols-[100px_1fr] items-center mb-4 border-b border-gray-100 pb-4">
          <label className="text-gray-600">CC</label>
          <input
            type="email"
            name="cc"
            value={emailData.cc}
            onChange={handleInputChange}
            className="border-none outline-none w-full"
          />
        </div>

        <div className="grid grid-cols-[100px_1fr] items-center mb-4">
          <label className="text-gray-600">Subject</label>
          <input
            type="text"
            name="subject"
            value={emailData.subject}
            onChange={handleInputChange}
            className="border-none outline-none w-full"
          />
        </div>
      </div>

      {/* Email Content Editor */}
      <div className="mb-8">
        <div className="bg-gray-100 p-2 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                className={`px-3 py-1 rounded ${
                  !isEditingHtml ? "bg-white font-bold" : "bg-gray-200"
                }`}
                onClick={() => setIsEditingHtml(false)}
              >
                Preview
              </button>
              <button
                className={`px-3 py-1 rounded ${
                  isEditingHtml ? "bg-white font-bold" : "bg-gray-200"
                }`}
                onClick={() => setIsEditingHtml(true)}
              >
                HTML
              </button>
            </div>

            {isEditingHtml && (
              <div className="flex items-center gap-1">
                <button
                  className={`p-1 rounded ${
                    rawHtmlMode ? "bg-white" : "bg-gray-200"
                  }`}
                  onClick={toggleHtmlMode}
                  title={rawHtmlMode ? "WYSIWYG Editor" : "Raw HTML"}
                >
                  <Code className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {isEditingHtml && !rawHtmlMode && (
            <div className="flex items-center gap-1 mt-2 flex-wrap border-t border-gray-200 pt-2">
              <button
                className="p-1 rounded hover:bg-white"
                onClick={() => execCommand("bold")}
                title="Bold"
              >
                <Bold className="h-4 w-4" />
              </button>
              <button
                className="p-1 rounded hover:bg-white"
                onClick={() => execCommand("italic")}
                title="Italic"
              >
                <Italic className="h-4 w-4" />
              </button>
              <button
                className="p-1 rounded hover:bg-white"
                onClick={() => execCommand("underline")}
                title="Underline"
              >
                <Underline className="h-4 w-4" />
              </button>
              <div className="w-px h-5 bg-gray-300 mx-1"></div>
              <button
                className="p-1 rounded hover:bg-white"
                onClick={() => execCommand("insertUnorderedList")}
                title="Bullet List"
              >
                <List className="h-4 w-4" />
              </button>
              <button
                className="p-1 rounded hover:bg-white"
                onClick={() => execCommand("insertOrderedList")}
                title="Numbered List"
              >
                <ListOrdered className="h-4 w-4" />
              </button>
              <div className="w-px h-5 bg-gray-300 mx-1"></div>
              <button
                className="p-1 rounded hover:bg-white"
                onClick={() => execCommand("justifyLeft")}
                title="Align Left"
              >
                <AlignLeft className="h-4 w-4" />
              </button>
              <button
                className="p-1 rounded hover:bg-white"
                onClick={() => execCommand("justifyCenter")}
                title="Align Center"
              >
                <AlignCenter className="h-4 w-4" />
              </button>
              <button
                className="p-1 rounded hover:bg-white"
                onClick={() => execCommand("justifyRight")}
                title="Align Right"
              >
                <AlignRight className="h-4 w-4" />
              </button>
              <button
                className="p-1 rounded hover:bg-white"
                onClick={() => execCommand("justifyFull")}
                title="Justify"
              >
                <AlignJustify className="h-4 w-4" />
              </button>
              <div className="w-px h-5 bg-gray-300 mx-1"></div>
              <button
                className="p-1 rounded hover:bg-white"
                onClick={() => {
                  const url = prompt("Enter link URL:");
                  if (url) execCommand("createLink", url);
                }}
                title="Insert Link"
              >
                <Link className="h-4 w-4" />
              </button>
              <button
                className="p-1 rounded hover:bg-white"
                onClick={() => {
                  const url = prompt("Enter image URL:");
                  if (url) execCommand("insertImage", url);
                }}
                title="Insert Image"
              >
                <ImageIcon className="h-4 w-4" />
              </button>
              <div className="w-px h-5 bg-gray-300 mx-1"></div>
              <select
                className="p-1 rounded text-xs bg-white border border-gray-200"
                onChange={(e) => execCommand("formatBlock", e.target.value)}
                defaultValue=""
              >
                <option value="" disabled>
                  Format
                </option>
                <option value="h1">Heading 1</option>
                <option value="h2">Heading 2</option>
                <option value="h3">Heading 3</option>
                <option value="p">Paragraph</option>
                <option value="pre">Preformatted</option>
              </select>
              <select
                className="p-1 rounded text-xs bg-white border border-gray-200"
                onChange={(e) => execCommand("fontName", e.target.value)}
                defaultValue=""
              >
                <option value="" disabled>
                  Font
                </option>
                <option value="Arial">Arial</option>
                <option value="Helvetica">Helvetica</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Courier New">Courier New</option>
                <option value="Verdana">Verdana</option>
              </select>
              <select
                className="p-1 rounded text-xs bg-white border border-gray-200"
                onChange={(e) => execCommand("fontSize", e.target.value)}
                defaultValue=""
              >
                <option value="" disabled>
                  Size
                </option>
                <option value="1">Small</option>
                <option value="3">Normal</option>
                <option value="5">Large</option>
                <option value="7">X-Large</option>
              </select>
              <input
                type="color"
                className="w-6 h-6 p-0 border-0 rounded"
                onChange={(e) => execCommand("foreColor", e.target.value)}
                title="Text Color"
              />
              <input
                type="color"
                className="w-6 h-6 p-0 border-0 rounded"
                onChange={(e) => execCommand("hiliteColor", e.target.value)}
                title="Background Color"
              />
            </div>
          )}
        </div>

        {isEditingHtml ? (
          rawHtmlMode ? (
            <textarea
              className="w-full h-96 p-4 border border-gray-200 rounded-lg font-mono text-sm"
              value={emailHtml}
              onChange={handleRawHtmlChange}
            ></textarea>
          ) : (
            <div
              ref={editorRef}
              className="w-full min-h-96 p-4 border border-gray-200 rounded-lg overflow-auto"
              contentEditable={true}
              onInput={(e) => setEmailHtml(e.currentTarget.innerHTML)}
              suppressContentEditableWarning={true}
            ></div>
          )
        ) : (
          <div className="bg-white border border-gray-200 p-6 rounded-lg">
            <div dangerouslySetInnerHTML={{ __html: emailHtml }}></div>
          </div>
        )}
      </div>

      {/* Attachments */}
      <div className="mb-8">
        <div className="bg-[#f9f9f9] p-4 rounded-lg mb-4 flex items-center">
          <input
            type="checkbox"
            id="invoices"
            className="mr-3"
            checked={attachInvoice}
            onChange={(e) => setAttachInvoice(e.target.checked)}
          />
          <div className="flex-1">
            <label htmlFor="invoices" className="font-medium block">
              Attach invoice PDF
            </label>
            <p className="text-sm text-gray-500">
              Include proforma invoice and attach to this email.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">invoice.pdf</span>
            <Eye className="h-5 w-5 text-gray-500" />
          </div>
        </div>

        {/* <div className="bg-[#f9f9f9] p-4 rounded-lg flex items-center">
          <input
            type="checkbox"
            id="statement"
            className="mr-3"
            checked={attachStatement}
            onChange={(e) => setAttachStatement(e.target.checked)}
          />
          <div className="flex-1">
            <label htmlFor="statement" className="font-medium block">
              Attach Customer Statement
            </label>
            <p className="text-sm text-gray-500">Date Range: 01 Dec 2024 - 03 Dec 2024</p>
            <p className="text-sm text-gray-500">Filter By: All</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">INV-1</span>
            <Eye className="h-5 w-5 text-gray-500" />
          </div>
        </div> */}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-4">
        <button
          className="px-8 py-3 bg-[#f5f5f5] rounded-md text-sm"
          onClick={() => history.goBack()}
        >
          Cancel
        </button>
        <button
          className="px-8 py-3 bg-[#bcd351] text-white rounded-md text-sm"
          onClick={handleSendEmail}
          disabled={loading}
        >
          {loading ? "Sending..." : "Send"}
        </button>
      </div>
    </div>
  );
}
