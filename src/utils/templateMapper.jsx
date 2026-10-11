// Utility functions to map between frontend state and backend model

// Update the mapDocumentToState function to properly handle HTML content
export const mapDocumentToState = (document) => {
  if (!document) return null;

  const state = {
    id: document._id,
    templateName: document.templateName || document.name || "",
    documentType: document.documentType || document.type || "invoice",
    version: document.version || 1,

    // Map header data
    headerData: document.headerData || {
      tagline: "",
      invoiceNumber: "",
      buyerInfo: "",
      contractNo: "",
      poNo: "",
      intermediate: "",
      date: "",
      terms: "",
    },

    // Map logo
    logo: document.logo?.file?.path || null,

    // Map logo settings
    logoSettings: document.logoSettings || {
      position: "top-center",
      size: 100,
      visible: true,
    },

    // Map table configuration
    tableFields: document.tableFields || [],
    tableValues: document.tableValues || [],

    // Map content entries
    contentEntries: document.contentEntriesGradeAndQuantiy || {
      intermediate: "",
      description: "",
      grade: "",
      quantity: "",
      price: "",
    },

    // Map shipping entries
    shippingEntries: document.shippingEntries || {
      totalValue: "",
      shippingTerms: "",
      packing: "",
      etdPortLoading: "",
    },

    // Map payment entries
    paymentEntries: document.paymentEntries || {
      payment: "",
      beneficiary: "",
      accountHolder: "",
      accountNumber: "",
      accountType: "",
      bankName: "",
      swiftCode: "",
      bankAddress: "",
    },

    // Map field labels
    fieldLabels: document.fieldLabels || {
      headerData: {},
      gradeQuantity: {},
      payment: {},
      shipping: {},
    },

    // Map footer text
    footerText: document.FooterText || "",
    footerText2: document.FooterText2 || "",

    // Map terms and payment
    terms: document.terms || "",
    payment: document.payment || "",

    // Map HTML content
    termsHtml: document.termsHtml || "",
    remarksHtml: document.remarksHtml || "",

    // Map signees
    signees: document.signees || [],

    // Map sections
    sections: document.sections || [
      {
        id: "section-header",
        title: "Header",
        content: "From the Managing Director Office",
        type: "header",
        isVisible: true,
        order: 0,
      },
      {
        id: "section-content",
        title: "Main Content",
        content: "",
        type: "content",
        isVisible: true,
        order: 1,
      },
      {
        id: "section-table",
        title: "Table",
        content: "",
        type: "table",
        isVisible: false,
        order: 2,
      },
      {
        id: "section-shipping",
        title: "Shipping Details",
        content: "",
        type: "shipping",
        isVisible: true,
        order: 3,
      },
      {
        id: "section-payment",
        title: "Payment Details",
        content: "",
        type: "payment",
        isVisible: true,
        order: 4,
      },
      {
        id: "section-terms",
        title: "Terms & Conditions",
        content: "",
        type: "terms",
        isVisible: true,
        order: 5,
      },
      {
        id: "section-remarks",
        title: "Remarks",
        content: "",
        type: "remarks",
        isVisible: true,
        order: 6,
      },
      {
        id: "section-footer",
        title: "Footer",
        content: "",
        type: "footer",
        isVisible: true,
        order: 7,
      },
      {
        id: "section-signees",
        title: "Signatures",
        content: "",
        type: "signees",
        isVisible: true,
        order: 8,
      },
    ],

    // Additional frontend state properties
    font: document.font || {
      family: "Arial",
      labelColor: "#000000",
      fontColor: "#000000",
      fontSize: 12,
    },
    background: document.background || {
      color: "#FFFFFF",
      image: null,
      position: "Center Centre",
    },
    customer: {
      name: document.headerData?.buyerInfo || "Company Name",
      address:
        document.customerAddress ||
        "Company address\nCity, Country - 00000\n+0 (000) 123-4567",
      fontColor: "#000000",
      fontSize: 12,
      label: "Buyer",
    },
    invoice: {
      number: document.headerData?.invoiceNumber || "#AB2324-01",
      reference: document.headerData?.contractNo || "INV-057",
      date: document.headerData?.date || "01 Aug, 2023",
      dueDate: "",
      subject: document.headerData?.tagline || "Design System",
      amount: 4950.0,
      subjectLabel: "Rubber Contract No",
      numberLabel: "Contract Number",
      referenceLabel: "REF",
      dateLabel: "Date",
    },
    company: document.company || {
      name: "AQCTA",
      website: "www.website.com",
      email: "hello@email.com",
      phone: "+91 00000 00000",
      address:
        "Business address\nCity, State, IN - 000 000\nTAX ID 00XXXXX1234X0XX",
    },
    items: document.items || [
      {
        name: "Item Name",
        description: "Item description",
        quantity: 1,
        rate: 3000.0,
        amount: 3000.0,
      },
    ],
    totals: document.totals || {
      subtotal: 4500.0,
      tax: 450.0,
      total: 4950.0,
      taxRate: 10,
      fontSize: 14,
      fontColor: "#000000",
      backgroundColor: "#FFFFFF",
      subtotalLabel: "Subtotal",
      taxLabel: "Tax",
      totalLabel: "Total",
    },
    tableConfig: document.tableConfig || {
      lineItemNumber: {
        show: true,
        width: 5,
        label: "#",
      },
      item: {
        show: true,
        width: 30,
        label: "Grade",
      },
      description: {
        show: true,
        width: 0,
        label: "Description",
      },
      quantity: {
        show: true,
        width: 11,
        label: "Qty",
      },
      rate: {
        show: true,
        width: 11,
        label: "Rate",
      },
      amount: {
        show: true,
        width: 11,
        label: "Amount",
      },
    },
    showTaxSummary: document.showTaxSummary || false,
    includePaymentStub: document.includePaymentStub || false,
    paperSize: document.paperSize || "A4",
    orientation: document.orientation || "Portrait",
    margins: document.margins || {
      top: 0.7,
      bottom: 0.7,
      left: 0.7,
      right: 0.7,
    },
    pageBreaks: document.pageBreaks || [],
    dynamicFields: document.dynamicFields || [],
    remarks: document.remarks || [],
    htmlContent: document.htmlContent,
    dummyData: document.dummyData,
  };

  return state;
};

// Helper function to generate HTML content from document state
const generateHtmlContent = (state) => {
  // Use the ABM MYDIN invoice template structure (matches the provided image exactly)
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; font-size: 12px; color: #000; padding: 36px 48px; background: #fff; }
        .invoice-container { max-width: 210mm; margin: 0 auto; background: #fff; }
        .header { text-align: center; margin-top: 10px; }
        .logo { margin-bottom: 8px; }
        .logo img { width: 120px; height: auto; max-height: 70px; object-fit: contain; margin: 0 auto 8px; }
        .company-name { font-size: 14px; font-weight: 700; letter-spacing: 0.3px; margin-bottom: 3px; }
        .company-address { font-size: 10px; line-height: 1.35; margin-top: 3px; white-space: pre-line; }
        .company-contact { font-size: 10px; line-height: 1.35; margin-top: 3px; }
        .invoice-title { text-align: center; font-size: 16px; font-weight: 700; letter-spacing: 0.6px; margin: 10px 0 14px; text-decoration: underline; }
        .header-separator { border-top: 1px solid #777; margin: 12px 0 10px; }
        .invoice-details { display: flex; justify-content: space-between; gap: 18px; margin-bottom: 14px; font-size: 10px; flex-wrap: wrap; }
        .detail-row { display: flex; gap: 6px; margin-bottom: 0; }
        .detail-label { font-weight: 700; }
        .detail-value { }
        .billing-shipping { display: grid; grid-template-columns: 1fr 1fr; gap: 70px; margin-bottom: 18px; font-size: 10px; }
        .bill-to, .ship-to { }
        .section-title { font-weight: 700; font-size: 12px; margin-bottom: 6px; }
        .address-grid { display: grid; grid-template-columns: 70px 1fr; row-gap: 3px; }
        .address-label { font-weight: normal; }
        .address-value { white-space: pre-line; }
        /* Items: match preview (no vertical borders, only horizontal separators) */
        .items-table { width: 100%; border-collapse: collapse; margin: 16px 0 14px; font-size: 11px; }
        .items-table thead tr { border-bottom: 2px solid #777; }
        .items-table th { border: none; padding: 8px 6px; text-align: left; font-weight: bold; background: transparent; }
        .items-table td { border: none; padding: 10px 6px; }
        .items-table tbody tr { border-bottom: 1px solid #e5e5e5; }
        /* numeric columns align right */
        .items-table th:nth-child(3), .items-table th:nth-child(4), .items-table th:nth-child(5), .items-table th:nth-child(6), .items-table th:nth-child(7) { text-align: right; }
        .items-table td:nth-child(3), .items-table td:nth-child(4), .items-table td:nth-child(5), .items-table td:nth-child(6), .items-table td:nth-child(7) { text-align: right; }
        .item-desc-main { font-weight: 400; }
        .item-desc-sub { font-size: 10px; color: #555; margin-top: 2px; font-weight: 400; }
        .summary-section { display: grid; grid-template-columns: 1fr 320px; gap: 30px; margin-top: 18px; margin-bottom: 20px; font-size: 9.5px; line-height: 1.5; }
        .payment-info { font-style: italic; }
        .payment-info h3 { font-size: 12px; margin-bottom: 8px; font-weight: bold; }
        .payment-info p { margin-bottom: 5px; line-height: 1.4; }
        .payment-info > div { margin-top: 10px; }
        .payment-info > div:last-child { margin-top: 6px; }
        .financial-summary { font-size: 10px; }
        .summary-row { display: flex; justify-content: space-between; padding: 4px 0; }
        .summary-label { color: #222; }
        .summary-value { text-align: right; min-width: 130px; }
        .total-row { border-top: 2px solid #777; padding-top: 8px; margin-top: 8px; font-weight: 700; }
        .total-row .summary-label { font-weight: 700; }
        .total-row .summary-value { font-weight: 700; text-decoration: underline; }
        .signature-section { margin-top: 70px; font-size: 10px; }
        .signature-line { border-top: 1px dotted #999; width: 220px; }
        .signature-label { margin-top: 6px; }
    </style>
</head>
<body>
    <div class="invoice-container">
        <div class="header">
            <div class="logo">
                <% if (contract.businessLogo) { %>
                    <img src="<%= contract.businessLogo %>" alt="Company Logo">
                <% } else { %>
                    <div style="height: 60px; display: flex; align-items: center; justify-content: center;">
                        <span style="font-size: 14px; font-weight: bold;">LOGO</span>
                    </div>
                <% } %>
            </div>
            <div class="company-name"><%= contract.businessName || 'COMPANY NAME' %></div>
            <div class="company-address"><%= contract.businessAddress || 'Company Address' %></div>
            <div class="company-contact"><% if (contract.businessPhone) { %><%= contract.businessPhone %><% } %></div>
            <div class="company-contact"><% if (contract.businessEmail) { %><%= contract.businessEmail %><% } %></div>
        </div>
        <div class="header-separator"></div>
        <div class="invoice-title">INVOICE</div>
        <div class="invoice-details">
            <div class="detail-row">
                <span class="detail-label">DATE:</span>
                <span class="detail-value"><%= contract.date || contract.invoice_date || new Date().toLocaleDateString() %></span>
            </div>
            <div class="detail-row">
                <span class="detail-label">DUE DATE:</span>
                <span class="detail-value"><%= contract.dueDate || contract.due_date || '' %></span>
            </div>
            <div class="detail-row">
                <span class="detail-label">INVOICE NO.:</span>
                <span class="detail-value"><%= contract.invoice_number || contract.contract_no || 'INV-000001' %></span>
            </div>
            <div class="detail-row">
                <span class="detail-label">SALES TYPE:</span>
                <span class="detail-value"><%= contract.salesType || 'CREDIT' %></span>
            </div>
            <div class="detail-row">
                <span class="detail-label">SALES PERSON:</span>
                <span class="detail-value"><%= contract.salesPerson || '' %></span>
            </div>
        </div>
        <div class="billing-shipping">
            <div class="bill-to">
                <div class="section-title">BILL TO:</div>
                <div class="address-grid">
                    <div>Attn</div>
                    <div>: <%= contract.buyerName || contract.customerName || 'Customer Name' %></div>
                    <div>Company</div>
                    <div>: <%= contract.buyerCompany || contract.customerName || 'Company Name' %></div>
                    <div>Address</div>
                    <div class="address-value">: <%= contract.buyerAddress || contract.billingAddress || 'Customer Address' %></div>
                    <div>Phone</div>
                    <div>: <%= contract.buyerPhone || contract.phoneNumber || '' %></div>
                    <div>Email</div>
                    <div>: <%= contract.buyerEmail || contract.customerEmail || '' %></div>
                </div>
            </div>
            <div class="ship-to">
                <div class="section-title">SHIP TO:</div>
                <div class="address-grid">
                    <div>Attn</div>
                    <div>: <%= contract.shipToName || contract.buyerName || contract.customerName || 'Customer Name' %></div>
                    <div>Company</div>
                    <div>: <%= contract.shipToCompany || contract.buyerCompany || contract.customerName || 'Company Name' %></div>
                    <div>Address</div>
                    <div class="address-value">: <%= contract.shipToAddress || contract.shippingAddress || contract.buyerAddress || 'Shipping Address' %></div>
                    <div>Phone</div>
                    <div>: <%= contract.shipToPhone || contract.buyerPhone || contract.phoneNumber || '' %></div>
                    <div>Email</div>
                    <div>: <%= contract.shipToEmail || contract.buyerEmail || contract.customerEmail || '' %></div>
                </div>
            </div>
        </div>
        <table class="items-table">
            <thead>
                <tr>
                    <th>No</th>
                    <th>Item & Description</th>
                    <th>Quantity</th>
                    <th>Price</th>
                    <th>Discount</th>
                    <th>Tax</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
                <% if (contract.items && contract.items.length > 0) { %>
                    <% contract.items.forEach((item, index) => { %>
                        <tr>
                            <td><%= index + 1 %></td>
                            <td>
                                <div class="item-desc-main"><%= item.item || item.itemCode || item.name || item.date || '' %></div>
                                <% if (item.description && String(item.description).trim() !== String(item.item || item.itemCode || item.name || '').trim()) { %>
                                    <div class="item-desc-sub"><%= item.description %></div>
                                <% } %>
                            </td>
                            <td><%= item.quantity || 0 %></td>
                            <td><%= contract.currency || 'RM' %> <%= parseFloat(item.price || item.unitPrice || 0).toFixed(2) %></td>
                            <td><%= contract.currency || 'RM' %> <%= parseFloat(item.discount || item.discountAmount || 0).toFixed(2) %></td>
                            <td><%= contract.currency || 'RM' %> <%= parseFloat(item.tax || item.taxAmount || 0).toFixed(2) %></td>
                            <td><%= contract.currency || 'RM' %> <%= parseFloat(item.total || (item.quantity || 0) * (item.price || item.unitPrice || 0)).toFixed(2) %></td>
                        </tr>
                    <% }); %>
                <% } else { %>
                    <tr>
                        <td colspan="7" style="text-align: center; padding: 20px;">No items</td>
                    </tr>
                <% } %>
            </tbody>
        </table>
        <div class="summary-section">
            <div class="payment-info">
                <%- (contract.termsAndConditions || '').replace(/\n/g, '<br/>') %>
            </div>
            <div class="financial-summary">
                <div class="summary-row">
                    <span class="summary-label">Subtotal:</span>
                    <span class="summary-value"><%= contract.currency || 'RM' %> <%= parseFloat(contract.subtotal || contract.subTotal || 0).toFixed(2) %></span>
                </div>
                <div class="summary-row">
                    <span class="summary-label">Discount:</span>
                    <span class="summary-value"><%= contract.currency || 'RM' %> <%= parseFloat(contract.discount || contract.discountAmount || 0).toFixed(2) %></span>
                </div>
                <div class="summary-row">
                    <span class="summary-label">Shipping/Handling:</span>
                    <span class="summary-value"><%= contract.currency || 'RM' %> <%= parseFloat(contract.shippingCharges || contract.shipping || 0).toFixed(2) %></span>
                </div>
                <div class="summary-row">
                    <span class="summary-label">Tax:</span>
                    <span class="summary-value"><%= contract.currency || 'RM' %> <%= parseFloat(contract.tax || contract.taxTotal || 0).toFixed(2) %></span>
                </div>
                <div class="summary-row">
                    <span class="summary-label">Other Charges:</span>
                    <span class="summary-value"><%= contract.currency || 'RM' %> <%= parseFloat(contract.adjustment || contract.otherCharges || 0).toFixed(2) %></span>
                </div>
                <div class="summary-row total-row">
                    <span class="summary-label">Total (<%= contract.currency || 'RM' %>):</span>
                    <span class="summary-value"><%= contract.currency || 'RM' %> <%= parseFloat(contract.total || contract.grandTotal || contract.totalValue || 0).toFixed(2) %></span>
                </div>
                <div class="summary-row">
                    <span class="summary-label">Deposit:</span>
                    <span class="summary-value"><%= contract.currency || 'RM' %> <%= parseFloat(contract.deposit || contract.depositAmount || 0).toFixed(2) %></span>
                </div>
                <div class="summary-row">
                    <span class="summary-label">Balance:</span>
                    <span class="summary-value"><%= contract.currency || 'RM' %> <%= parseFloat((contract.total || contract.grandTotal || contract.totalValue || 0) - (contract.deposit || contract.depositAmount || 0)).toFixed(2) %></span>
                </div>
            </div>
        </div>
        <div class="signature-section">
            <div class="signature-line"></div>
            <div class="signature-label">Authorized Signature</div>
        </div>
    </div>
</body>
</html>`;
};

// Helper function to generate dummy data from document state (no hardcoded payment/bank details)
const generateDummyData = (state) => {
  return {
    contract: {
      // For logo rendering in saved template previews
      businessLogo: state.logo || "",
      businessName: state.company?.name || 'COMPANY NAME',
      businessAddress: state.company?.address || 'Company Address',
      businessPhone: state.company?.phone || '',
      businessEmail: state.company?.email || '',
      invoice_number: state.invoice?.number || 'INV-000001',
      date: state.invoice?.date || new Date().toLocaleDateString(),
      dueDate: state.invoice?.dueDate || "",
      salesType: state.invoice?.salesType || "CREDIT",
      salesPerson: state.invoice?.salesPerson || "",
      buyerName: state.customer?.name || 'Customer Name',
      buyerCompany: state.customer?.company || state.customer?.name || 'Company Name',
      buyerAddress: state.customer?.address || 'Customer Address',
      buyerPhone: state.customer?.phone || "",
      buyerEmail: state.customer?.email || "",
      shipToName: state.customer?.name || 'Customer Name',
      shipToCompany: state.customer?.company || state.customer?.name || 'Company Name',
      shipToAddress: state.customer?.address || 'Shipping Address',
      shipToPhone: state.customer?.phone || "",
      shipToEmail: state.customer?.email || "",
      shippingAddress: state.customer?.address || 'Shipping Address',
      currency: 'RM',
      items: state.items?.map(item => ({
        item: item.name || '',
        description: item.description || '',
        quantity: item.quantity || 0,
        price: item.rate || 0,
        discount: item.discount || item.discountAmount || 0,
        tax: item.tax || item.taxAmount || 0,
        total: item.amount || (item.quantity || 0) * (item.rate || 0)
      })) || [],
      subtotal: state.totals?.subtotal || 0,
      discount: state.totals?.discount || 0,
      tax: state.totals?.tax || 0,
      shippingCharges: state.totals?.shippingCharges || state.totals?.shipping || 0,
      adjustment: state.totals?.adjustment || 0,
      total: state.totals?.total || 0,
      deposit: state.totals?.deposit || 0,

      // Dynamic terms and conditions (empty in dummy data; real data from invoice/order)
      termsAndConditions: state.termsAndConditions || "",
      paymentMethod: state.paymentMethod || "",
      bankAccount: state.bankAccount || {},
    }
  };
};

// Update the mapStateToDocument function to include HTML content
export const mapStateToDocument = (state) => {
  const docType = state.documentType || "invoice";
  const resolvedType =
    docType === "contract"
      ? "Sales Contract"
      : docType === "quote"
        ? "quotation"
        : docType;
  const templateName = state.templateName || "CUSTOMER INVOICE";

  return {
    _id: state.id,
    name: templateName,
    type: resolvedType,
    templateName,
    documentType: docType,
    // Add htmlContent and dummyData for new template format
    htmlContent: state.htmlContent || generateHtmlContent(state),
    dummyData: state.dummyData || generateDummyData(state),

    // Map font settings
    font: state.font || {
      family: "Arial",
      labelColor: "#000000",
      fontColor: "#000000",
      fontSize: 12,
    },

    // Map background settings
    background: state.background || {
      color: "#FFFFFF",
      image: null,
      position: "Center Centre",
    },

    // Map logo settings
    logoSettings: state.logoSettings || {
      position: "top-center",
      size: 100,
      visible: true,
    },

    // Map header data
    headerData: {
      tagline: state.invoice?.subject || "",
      invoiceNumber: state.invoice?.number || "",
      buyerInfo: state.customer?.name || "",
      contractNo: state.invoice?.reference || "",
      poNo: "",
      intermediate: state.contentEntries?.intermediate || "",
      date: state.invoice?.date || "",
      terms: state.terms || "",
    },

    // Map logo
    logo: state.logo
      ? {
          file: {
            path: state.logo,
          },
        }
      : null,

    // Map table fields from tableConfig
    tableFields: [
      {
        id: "lineItemNumber",
        name: "Line Item Number",
        type: "number",
        width: state.tableConfig?.lineItemNumber?.width || 5,
      },
      {
        id: "item",
        name: "Item",
        type: "text",
        width: state.tableConfig?.item?.width || 30,
      },
      {
        id: "description",
        name: "Description",
        type: "text",
        width: state.tableConfig?.description?.width || 0,
      },
      {
        id: "quantity",
        name: "Quantity",
        type: "number",
        width: state.tableConfig?.quantity?.width || 11,
      },
      {
        id: "rate",
        name: "Rate",
        type: "number",
        width: state.tableConfig?.rate?.width || 11,
      },
      {
        id: "amount",
        name: "Amount",
        type: "number",
        width: state.tableConfig?.amount?.width || 11,
      },
    ],

    // Map table values from items
    tableValues:
      state.items?.map((item, index) => ({
        id: `row-${index}`,
        values: {
          lineItemNumber: index + 1,
          item: item.name,
          description: item.description,
          quantity: item.quantity,
          rate: item.rate,
          amount: item.amount,
        },
      })) || [],

    // Map content entries
    contentEntriesGradeAndQuantiy: state.contentEntries || {
      intermediate: "",
      description: "",
      grade: "",
      quantity: "",
      price: "",
    },

    // Map shipping entries
    shippingEntries: state.shippingEntries || {
      totalValue: state.totals?.total?.toString() || "",
      shippingTerms: "",
      packing: "",
      etdPortLoading: "",
    },

    // Map payment entries
    paymentEntries: state.paymentEntries || {
      payment: state.payment || "",
      beneficiary: "",
      accountHolder: "",
      accountNumber: "",
      accountType: "",
      bankName: "",
      swiftCode: "",
      bankAddress: "",
    },

    // Map field labels
    fieldLabels: state.fieldLabels || {
      headerData: {},
      gradeQuantity: {},
      payment: {},
      shipping: {},
    },

    // Map footer text
    FooterText: state.footerText || "",
    FooterText2: state.footerText2 || "",

    // Map terms and payment
    terms: state.terms || "",
    payment: state.payment || "",

    // Map HTML content
    termsHtml: state.termsHtml || "",
    remarksHtml: state.remarksHtml || "",

    // Map signees
    signees: state.signees || [],

    // Map sections
    sections: state.sections || [],

    // Map page breaks
    pageBreaks: state.pageBreaks || [],

    // Map dynamic fields
    dynamicFields: state.dynamicFields || [],

    // Map remarks
    remarks: state.remarks || [],

    // Map company
    company: state.company || {},

    // Map totals
    totals: state.totals || {},

    // Map table config
    tableConfig: state.tableConfig || {},

    // Map items
    items: state.items || [],

    // Include version
    version: state.version || 1,
  };
};
