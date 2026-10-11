import { useState, useEffect } from "react"
import { useParams } from "react-router-dom";
import DocumentPreview from "@/components/document_template/document-preview"
import LeftSidebar from "@/components/document_template/left-sidebar"
import RightSidebar from "@/components/document_template/right-sidebar"
import TopNavigation from "@/components/document_template/top-navigation"
import TemplatesList from "@/components/document_template/templates-list"
import { fetchAllTemplates, fetchTemplateById, createTemplate, updateTemplate, deleteTemplate } from "@/services/Document_TemplateServices"
import { mapDocumentToState, mapStateToDocument } from "@/utils/templateMapper"


export default function DocumentEditor() {
  const [activeTab, setActiveTab] = useState("general")
  const [activeSidebarItem, setActiveSidebarItem] = useState("template-properties")
  const [rightSidebarContent, setRightSidebarContent] = useState("font")
  const [showTemplatesList, setShowTemplatesList] = useState(false)
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(false)
  const [currentTemplateId, setCurrentTemplateId] = useState(null)
  const [saveStatus, setSaveStatus] = useState("idle") // idle, saving, saved, error
  const { templateId, recordId } = useParams();
  console.log("templateId", templateId);
  console.log("recordId", recordId);

  // Document state
  const [documentState, setDocumentState] = useState({
    templateName: "CUSTOMER INVOICE",
    documentType: "invoice",
    version: 1,
    font: {
      family: "Arial",
      labelColor: "#000000",
      fontColor: "#000000",
      fontSize: 12,
    },
    background: {
      color: "#FFFFFF",
      image: null,
      position: "Center Centre",
    },
    logoSettings: {
      position: "top-center",
      size: 100,
      visible: true,
    },
    customer: {
      name: "MS SUFIE",
      company: "TRENDCELL SDN BHD",
      address: "LOT 41730-A, BATU 14",
      phone: "0182905393",
      email: "",
      fontColor: "#000000",
      fontSize: 12,
      label: "Company",
    },
    invoice: {
      number: "1972",
      reference: "REF",
      date: "28-01-2026",
      dueDate: "",
      subject: "Rubber Contract No:",
      amount: 3712.0,
      subjectLabel: "Rubber Contract No",
      numberLabel: "Contract Number",
      referenceLabel: "REF",
      dateLabel: "Date",
    },
    company: {
      name: "ABM MYDIN CORNER",
      website: "",
      email: "restoranabmmydin@gmail.com",
      phone: "60167107806",
      address:
        "no 27, JALAN PU 5/1, TAMAN PUCHONG UTAMA, 47100 PUCHONG, SELANGOR",
    },
    items: [
      {
        name: "19/01/2026",
        description: "DINNER",
        quantity: 72,
        rate: 8.0,
        amount: 576.0,
        discount: 0,
        tax: 0,
      },
      {
        name: "20/01/2026",
        description: "DINNER",
        quantity: 77,
        rate: 8.0,
        amount: 616.0,
        discount: 0,
        tax: 0,
      },
      {
        name: "21/01/2026",
        description: "DINNER",
        quantity: 67,
        rate: 8.0,
        amount: 536.0,
        discount: 0,
        tax: 0,
      },
      {
        name: "22/01/2026",
        description: "DINNER",
        quantity: 75,
        rate: 8.0,
        amount: 600.0,
        discount: 0,
        tax: 0,
      },
      {
        name: "23/01/2026",
        description: "DINNER",
        quantity: 73,
        rate: 8.0,
        amount: 584.0,
        discount: 0,
        tax: 0,
      },
      {
        name: "24/01/2026",
        description: "DINNER",
        quantity: 58,
        rate: 8.0,
        amount: 464.0,
        discount: 0,
        tax: 0,
      },
      {
        name: "25/01/2026",
        description: "DINNER",
        quantity: 42,
        rate: 8.0,
        amount: 336.0,
        discount: 0,
        tax: 0,
      },
    ],
    totals: {
      subtotal: 3712.0,
      tax: 0.0,
      total: 3712.0,
      discount: 0.0,
      shippingCharges: 0.0,
      adjustment: 0.0,
      deposit: 0.0,
      taxRate: 0,
      fontSize: 14,
      fontColor: "#000000",
      backgroundColor: "#FFFFFF",
      subtotalLabel: "Subtotal",
      taxLabel: "Tax",
      totalLabel: "Total",
    },

    tableConfig: {
      lineItemNumber: {
        show: false,
        width: 5,
        label: "#",
      },
      item: {
        show: true,
        width: 30,
        label: "Grade",
      },
      description: {
        show: false,
        width: 0,
        label: "Description",
      },
      quantity: {
        show: true,
        width: 20,
        label: "Quantity",
      },
      rate: {
        show: true,
        width: 20,
        label: "Price",
      },
      amount: {
        show: false,
        width: 0,
        label: "Amount",
      },
    },
    showTaxSummary: false,
    includePaymentStub: false,
    paperSize: "A4",
    orientation: "Portrait",
    margins: {
      top: 0.7,
      bottom: 0.7,
      left: 0.7,
      right: 0.7,
    },
    fieldLabels: {
      headerData: {
        tagline: "Rubber Contract No",
        invoiceNumber: "Contract Number",
        buyerInfo: "Buyer",
        contractNo: "REF",
        date: "Date",
      },
      gradeQuantity: {
        grade: "Grade",
        quantity: "Quantity",
        price: "Price",
      },
      payment: {
        payment: "Payment",
        beneficiary: "Beneficiary",
        accountHolder: "Account Holder",
        accountNumber: "Account Number",
        accountType: "Account Type",
        bankName: "Bank Name",
        swiftCode: "SWIFT CODE",
        bankAddress: "Bank Address",
      },
      shipping: {
        totalValue: "Total Value",
        shippingTerms: "Shipping Terms",
        packing: "Packing",
        etdPortLoading: "ETD Port of Loading",
      },
    },
    contentEntries: {
      intermediate: "Intermediate",
      description: "We have this day sold to you the under mentioned rubber -",
      grade: "NATURAL RUBBER SMR 10",
      quantity: "100.8MT(AT 20.16MTS x 5 UNITS OF 20' FCL)",
      price: "USD 2,015.00",
    },
    shippingEntries: {
      totalValue: "203,112.00USD",
      shippingTerms: "CFR KARACHI, PAKISTAN",
      packing: "1.26MT SHRINKWRAPPED PER UNIT",
      etdPortLoading: "DECEMBER 2024",
    },
    paymentEntries: {
      payment: "100% LC AT SIGHT",
      beneficiary: "BARENA GROUP SDN BHD",
      accountHolder: "BARENA GROUP SDN BHD",
      accountNumber: "1221 1101 0000 605",
      accountType: "TRADE FCA ACCOUNT (USD)",
      bankName: "ALLIANCE BANK MALAYSIA BERHAD",
      swiftCode: "MFBBMYKL",
      bankAddress: "UNIT SR3-G, GROUND FLOOR, WISMA STAR, NO. 1, JALAN YAP KWAN SENG, 50450 KUALA LUMPUR.",
    },
    footerText: "Kindly fax a copy of this contract and return the original to us duly countersigned.",
    footerText2: "",
    termsHtml: `
      <ol>
        <li>SUBJECT TO THE TERMS & CONDITIONS OF THE INTERNATIONAL CONTRACTS FOR TECHNICALLY SPECIFIED RUBBER</li>
        <li>ALL BANK CHARGES OUTSIDE OF BENEFICIARY'S BANK ARE FOR ACCOUNT OF BUYER (APPLICANT)</li>
        <li>DRAFT LETTER OF CREDIT (LC) MUST BE SENT TO BARENA FOR AGREEMENT BEFORE LC ISSUANCE, OTHERWISE BARENA HAS THE RIGHT TO REQUEST FOR AMENDMENT WITHOUT ACCEPTING ANY AMENDMENT COST</li>
        <li>A TOLERANCE NOT EXCEED 5% MORE OR 5% LESS THAN THE QUANTITY AND AMOUNT OF THE GOODS IS ALLOWED</li>
        <li>ACCEPTANCE OF BILL MUST BE WITHIN 3 WORKING DAYS UPON RECEIVE BY APPLICANT'S BANK</li>
        <li>IN THE LC, TO MENTION SUBMISSION OF FOLLOWING SHIPPING DOCUMENTS ONLY:
          <br>(1)COMMERCIAL INVOICE, (2)PACKING LIST AND (3) BILL OF LADING.ANDACCEPTANCE OF THIRD PARTY DOCUMENTS TO BE MENTION IN LC.
          <br>OTHER RELEVANT DOCUMENTS IF IS REQUIRED WILL BE SENT VIA EMAIL.</li>
        <li>PHYTOSANITARY AND HEAT TREATMENT FEES IF ANY TO BE AT BUYER ACCOUNT</li>
      </ol>
    `,
    remarksHtml: `
      <ol>
        <li>ETD POL: DECEMBER 2024 - SUBJECT TO LC RECEIVE AND VESSEL SPACE AVAILABILITY</li>
        <li>KINDLY ENSURE FIRST RECEIVING BANK WILL BE EITHER ONE OF THE BELOW UPON OPEN OF LC:
          <br>- ALLIANCE BANK MALAYSIA BERHAD (MFBBMYKL)
          <br>- STANDARD CHARTERED MALAYSIA (SCBLMYKXXXX)
          <br>- CITIBANK MALAYSIA (CITIMYKL)</li>
        <li>THE LATEST SHIPMENT DATE SHOULD AT LEAST 45 DAYS FROM LC ISSUANCE DATE</li>
      </ol>
    `,
    signees: [
      {
        title: "Buyer's Confirmation",
        name: "GHANDHARA TYRE & RUBBER COMPANY LIMITED",
        company: "",
        showSignature: true,
        showStamp: true,
      },
      {
        title: "Seller's Confirmation",
        name: "BARENA GROUP SDN BHD",
        company: "",
        showSignature: true,
        showStamp: true,
      },
    ],
    sections: [
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
        isVisible: false, // Default to hidden since we're using a different table display
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
  })

  useEffect(() => {
    if (!templateId && !recordId) {
      console.log("Creating new template");
      // Initialize empty template
    } else if (templateId && !recordId) {
      console.log("Editing existing template:", templateId);
      loadTemplate(templateId);
      // Fetch and load template data for editing
    } else if (templateId && recordId) {
      console.log(`Creating document for record ${recordId} using template ${templateId}`);
      // Fetch template and load data for the specific record
    }
  }, [templateId, recordId]);


  // Load templates on initial render
  useEffect(() => {
    loadTemplates()
  }, [])

  // Load all templates
  const loadTemplates = async () => {
    try {
      setLoading(true)
      const response = await fetchAllTemplates()
      if (response.success) {
        setTemplates(response.data.documents)
      }
    } catch (error) {
      console.error("Failed to load templates:", error)
    } finally {
      setLoading(false)
    }
  }

  // Load a specific template
  const loadTemplate = async (id) => {
    try {
      setLoading(true)
      const response = await fetchTemplateById(id)
      if (response.success) {
        const mappedState = mapDocumentToState(response.data)

        // Make sure we preserve HTML content if it exists in the response
        if (response.data.termsHtml) {
          mappedState.termsHtml = response.data.termsHtml
        } else if (response.data.terms && Array.isArray(response.data.terms)) {
          // Convert array terms to HTML if needed
          mappedState.termsHtml = `<ol>${response.data.terms.map((term) => `<li>${term}</li>`).join("")}</ol>`
        }

        if (response.data.remarksHtml) {
          mappedState.remarksHtml = response.data.remarksHtml
        } else if (response.data.remarks && Array.isArray(response.data.remarks)) {
          // Convert array remarks to HTML if needed
          mappedState.remarksHtml = `<ol>${response.data.remarks.map((remark) => `<li>${remark}</li>`).join("")}</ol>`
        }

        // Make sure logo settings are preserved
        if (response.data.logoSettings) {
          mappedState.logoSettings = response.data.logoSettings
        }

        // Ensure we keep the template name
        mappedState.templateName =
          response.data.templateName || response.data.name || "CUSTOMER INVOICE"

        setDocumentState(mappedState)
        setCurrentTemplateId(id)
        setShowTemplatesList(false)
      }
    } catch (error) {
      console.error("Failed to load template:", error)
    } finally {
      setLoading(false)
    }
  }

  // Save current template
  const saveTemplate = async () => {
    try {
      setSaveStatus("saving")
      const templateData = mapStateToDocument(documentState)

      let response
      if (currentTemplateId) {
        // Update existing template
        response = await updateTemplate(currentTemplateId, templateData)
      } else {
        // Create new template
        response = await createTemplate(templateData)
        if (response.success) {
          setCurrentTemplateId(response.data._id)
        }
      }

      if (response.success) {
        setSaveStatus("saved")
        // Refresh templates list
        loadTemplates()

        // Reset save status after 3 seconds
        setTimeout(() => {
          setSaveStatus("idle")
        }, 3000)
      } else {
        setSaveStatus("error")
      }
    } catch (error) {
      console.error("Failed to save template:", error)
      setSaveStatus("error")
    }
  }

  // Create new template
  const createNewTemplate = () => {
    setDocumentState({
      templateName: "CUSTOMER INVOICE",
      documentType: "invoice",
      version: 1,
      font: {
        family: "Arial",
        labelColor: "#000000",
        fontColor: "#000000",
        fontSize: 12,
      },
      background: {
        color: "#FFFFFF",
        image: null,
        position: "Center Centre",
      },
      logoSettings: {
        position: "top-center",
        size: 100,
        visible: true,
      },
      customer: {
        name: "MS SUFIE",
        company: "TRENDCELL SDN BHD",
        address: "LOT 41730-A, BATU 14",
        phone: "0182905393",
        email: "",
        fontColor: "#000000",
        fontSize: 12,
        label: "Company",
      },
      invoice: {
        number: "1972",
        reference: "REF",
        date: "28-01-2026",
        dueDate: "",
        subject: "INVOICE",
        amount: 3712.0,
        subjectLabel: "INVOICE",
        referenceLabel: "REF",
        dateLabel: "Date",
      },
      company: {
        name: "ABM MYDIN CORNER",
        website: "",
        email: "restoranabmmydin@gmail.com",
        phone: "60167107806",
        address: "no 27, JALAN PU 5/1, TAMAN PUCHONG UTAMA, 47100 PUCHONG, SELANGOR",
      },
      items: [
        {
          name: "19/01/2026",
          description: "DINNER",
          quantity: 72,
          rate: 8.0,
          amount: 576.0,
          discount: 0,
          tax: 0,
        },
        {
          name: "20/01/2026",
          description: "DINNER",
          quantity: 77,
          rate: 8.0,
          amount: 616.0,
          discount: 0,
          tax: 0,
        },
        {
          name: "21/01/2026",
          description: "DINNER",
          quantity: 67,
          rate: 8.0,
          amount: 536.0,
          discount: 0,
          tax: 0,
        },
        {
          name: "22/01/2026",
          description: "DINNER",
          quantity: 75,
          rate: 8.0,
          amount: 600.0,
          discount: 0,
          tax: 0,
        },
        {
          name: "23/01/2026",
          description: "DINNER",
          quantity: 73,
          rate: 8.0,
          amount: 584.0,
          discount: 0,
          tax: 0,
        },
        {
          name: "24/01/2026",
          description: "DINNER",
          quantity: 58,
          rate: 8.0,
          amount: 464.0,
          discount: 0,
          tax: 0,
        },
        {
          name: "25/01/2026",
          description: "DINNER",
          quantity: 42,
          rate: 8.0,
          amount: 336.0,
          discount: 0,
          tax: 0,
        },
      ],
      totals: {
        subtotal: 3712.0,
        tax: 0.0,
        total: 3712.0,
        discount: 0.0,
        shippingCharges: 0.0,
        adjustment: 0.0,
        deposit: 0.0,
        taxRate: 0,
        fontSize: 14,
        fontColor: "#000000",
        backgroundColor: "#FFFFFF",
        subtotalLabel: "Subtotal",
        taxLabel: "Tax",
        totalLabel: "Total",
      },
      tableConfig: {
        lineItemNumber: {
          show: false,
          width: 5,
          label: "#",
        },
        item: {
          show: true,
          width: 30,
          label: "Grade",
        },
        description: {
          show: false,
          width: 0,
          label: "Description",
        },
        quantity: {
          show: true,
          width: 20,
          label: "Quantity",
        },
        rate: {
          show: true,
          width: 20,
          label: "Price",
        },
        amount: {
          show: false,
          width: 0,
          label: "Amount",
        },
      },
      showTaxSummary: false,
      includePaymentStub: false,
      paperSize: "A4",
      orientation: "Portrait",
      margins: {
        top: 0.7,
        bottom: 0.7,
        left: 0.7,
        right: 0.7,
      },
      fieldLabels: {
        headerData: {
          tagline: "Contract No",
          invoiceNumber: "Contract Number",
          buyerInfo: "Buyer",
          contractNo: "REF",
          date: "Date",
        },
        gradeQuantity: {
          grade: "Grade",
          quantity: "Quantity",
          price: "Price",
        },
        payment: {
          payment: "Payment",
          beneficiary: "Beneficiary",
          accountHolder: "Account Holder",
          accountNumber: "Account Number",
          accountType: "Account Type",
          bankName: "Bank Name",
          swiftCode: "SWIFT CODE",
          bankAddress: "Bank Address",
        },
        shipping: {
          totalValue: "Total Value",
          shippingTerms: "Shipping Terms",
          packing: "Packing",
          etdPortLoading: "ETD Port of Loading",
        },
      },
      contentEntries: {
        intermediate: "Intermediate",
        description: "We have this day sold to you the under mentioned items -",
        grade: "Item Name",
        quantity: "1 Unit",
        price: "USD 3,000.00",
      },
      shippingEntries: {
        totalValue: "3,000.00USD",
        shippingTerms: "FOB",
        packing: "Standard Packing",
        etdPortLoading: "TBD",
      },
      paymentEntries: {
        payment: "Cash / Debit & Credit Card / Cheque / Bank In / Online Transfer.",
        beneficiary: "ABDUL HAMEED BIN VM MOHD MYDIN",
        accountHolder: "ABDUL HAMEED BIN VM MOHD MYDIN",
        accountNumber: "21400015058",
        accountType: "",
        bankName: "HONG LEONG BANK",
        swiftCode: "",
        bankAddress: "",
      },
      footerText: "Thank you for your business.",
      footerText2: "",
      termsHtml: `
        <ol>
          <li>Standard terms and conditions apply</li>
          <li>Payment due within 30 days of invoice date</li>
          <li>Late payments subject to 2% monthly interest</li>
        </ol>
      `,
      remarksHtml: "",
      signees: [
        {
          title: "Buyer's Confirmation",
          name: "Customer Name",
          company: "",
          showSignature: true,
          showStamp: true,
        },
        {
          title: "Seller's Confirmation",
          name: "Your Company Name",
          company: "",
          showSignature: true,
          showStamp: true,
        },
      ],
      sections: [
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
    })
    setCurrentTemplateId(null)
    setShowTemplatesList(false)
    setSaveStatus("idle")
  }

  // Delete current template
  const deleteCurrentTemplate = async () => {
    if (!currentTemplateId) return

    if (window.confirm("Are you sure you want to delete this template?")) {
      try {
        setLoading(true)
        const response = await deleteTemplate(currentTemplateId)
        if (response.success) {
          createNewTemplate()
          loadTemplates()
        }
      } catch (error) {
        console.error("Failed to delete template:", error)
      } finally {
        setLoading(false)
      }
    }
  }

  const handleTabChange = (tab) => {
    setActiveTab(tab)

    // Set default sidebar item based on active tab
    switch (tab) {
      case "general":
        setActiveSidebarItem("template-properties")
        setRightSidebarContent("template-properties")
        break
      case "header-footer":
        setActiveSidebarItem("header")
        setRightSidebarContent("background-image")
        break
      case "transaction":
        setActiveSidebarItem("organization-detail")
        setRightSidebarContent("organization-detail")
        break
      case "table":
        setActiveSidebarItem("table-manager")
        setRightSidebarContent("table-manager")
        break
      case "total":
        setActiveSidebarItem("layout")
        setRightSidebarContent("total-section")
        break
      case "more":
        setActiveSidebarItem("signees-manager")
        setRightSidebarContent("signees-manager")
        break
      default:
        setActiveSidebarItem("template-properties")
    }
  }

  const handleSidebarItemSelect = (item) => {
    setActiveSidebarItem(item)

    // Set corresponding right sidebar content based on left sidebar selection
    switch (item) {
      case "template-properties":
        setRightSidebarContent("template-properties")
        break
      case "font":
        setRightSidebarContent("font")
        break
      case "background":
        setRightSidebarContent("background-image")
        break
      case "header":
        setRightSidebarContent("background-image")
        break
      case "footer":
        setRightSidebarContent("background-image")
        break
      case "organization-detail":
        setRightSidebarContent("organization-detail")
        break
      case "customer-detail":
        setRightSidebarContent("customer-name")
        break
      case "document-detail":
        setRightSidebarContent("document-title")
        break
      case "labels":
        setRightSidebarContent("field-config")
        break
      case "layout":
        setRightSidebarContent("total-section")
        break
      case "table-manager":
        setRightSidebarContent("table-manager")
        break
      case "signees-manager":
        setRightSidebarContent("signees-manager")
        break
      case "sections-manager":
        setRightSidebarContent("sections-manager")
        break
      case "terms-editor":
        setRightSidebarContent("terms-editor")
        break
      case "remarks-editor":
        setRightSidebarContent("remarks-editor")
        break
      case "label-editor":
        setRightSidebarContent("label-editor")
        break
      case "logo-position":
        setRightSidebarContent("logo-position")
        break
      default:
        setRightSidebarContent("font")
    }
  }

  const updateDocumentState = (section, field, value) => {
    setDocumentState((prevState) => {
      // Create a deep copy of the nested state
      const newState = JSON.parse(JSON.stringify(prevState))

      if (section === "") {
        // Update top-level field
        newState[field] = value
      } else if (field.includes(".")) {
        // Handle nested fields like 'totals.fontSize'
        const [parentField, childField] = field.split(".")
        newState[section][parentField][childField] = value
      } else {
        // Handle direct fields like 'fontSize'
        newState[section][field] = value
      }

      return newState
    })
  }

  // Update template name
  const updateTemplateName = (name) => {
    setDocumentState((prevState) => ({
      ...prevState,
      templateName: name,
    }))
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Top Navigation */}
      <TopNavigation
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onSave={saveTemplate}
        onNew={createNewTemplate}
        onDelete={deleteCurrentTemplate}
        onToggleTemplates={() => setShowTemplatesList(!showTemplatesList)}
        saveStatus={saveStatus}
        templateName={documentState.templateName}
        onTemplateNameChange={updateTemplateName}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Templates List Sidebar (conditionally rendered) */}
        {showTemplatesList && (
          <TemplatesList
            templates={templates}
            loading={loading}
            onSelect={loadTemplate}
            onClose={() => setShowTemplatesList(false)}
            currentTemplateId={currentTemplateId}
          />
        )}

        {/* Left Sidebar */}
        <LeftSidebar activeTab={activeTab} activeItem={activeSidebarItem} onItemSelect={handleSidebarItemSelect} />

        {/* Document Preview */}
        <div className="flex-1 overflow-auto p-4 bg-white border-l border-r border-gray-200">
          <DocumentPreview documentState={documentState} />
        </div>

        {/* Right Sidebar */}
        <RightSidebar
          activeTab={activeTab}
          contentType={rightSidebarContent}
          documentState={documentState}
          updateDocumentState={updateDocumentState}
        />
      </div>
    </div>
  )
}

