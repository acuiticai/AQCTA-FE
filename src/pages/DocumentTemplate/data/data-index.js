// export const initialValues = [
//   { id: 1, name: "Product Name", type: "text", width: 40 },
//   { id: 2, name: "Quantity", type: "number", width: 20 },
//   { id: 3, name: "Price", type: "currency", width: 20 },
// ];

export const initialValues = [
  { id: 1, name: "ITEM", type: "text", width: 20 },
  { id: 2, name: "QTY (MT)", type: "number", width: 20 },
  { id: 3, name: "DESCRIPTION OF GOODS", type: "currency", width: 30 },
  { id: 4, name: "UNIT PRICE (USD/MT)", type: "currency", width: 30 },
  { id: 5, name: "Total (USD)", type: "currency", width: 20 },
];

export const fieldTypes = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "currency", label: "Currency" },
  { value: "percentage", label: "Percentage" },
  { value: "dropdown", label: "Dropdown" },
];

export const terms = [
  "SUBJECT TO THE TERMS & CONDITIONS OF THE INTERNATIONAL CONTRACTS FOR TECHNICALLY SPECIFIED RUBBER",
  "ALL BANK CHARGES OUTSIDE OF BENEFICIARY'S BANK ARE FOR ACCOUNT OF BUYER (APPLICANT)",
  "DRAFT BANK CONTRACT (BC) MUST BE SENT TO BARENA FOR AGREEMENT BEFORE BC ISSUANCE, OTHERWISE BARENA HAS THE RIGHT TO REQUEST FOR AMENDMENT WITHOUT ACCEPTING ANY AMENDMENT COST",
  "A TOLERANCE NOT EXCEED 5% MORE OR 5% LESS THAN THE QUANTITY AND AMOUNT OF THE GOODS IS ALLOWED",
];

export const remarks = [
  "ETD POL: DECEMBER 2024 - SUBJECT TO LC RECEIVE AND VESSEL SPACE AVAILABILITY",
  "KINDLY ENSURE FIRST RECEIVING BANK WILL BE EITHER ONE OF THE BELOW UPON OPEN",
  "OF LC: - ALLIANCE BANK MALAYSIA BERHAD (MFBBMYKL)",
  "STANDARD CHARTERED MALAYSIA (SCBLMYKXXXX)",
  "CITIBANK MALAYSIA (CITIMYKL)",
  "THE LATEST SHIPMENT DATE SHOULD AT LEAST 45 DAYS FROM LC ISSUANCE DATE",
];

export const columns = [
  "ITEM",
  "QTY (MT)",
  "DESCRIPTION OF GOODS",
  "UNIT PRICE (USD/MT)",
  "Total (USD)",
];

export const tableData = [
  [
    1,
    "201.600",
    "NATURAL RUBBER SMR 20 CFR KARACHI, PAKISTAN",
    "1,585.00",
    "319,536.00",
  ],
  [
    1,
    "201.600",
    "NATURAL RUBBER SMR 20 CFR KARACHI, PAKISTAN",
    "1,585.00",
    "319,536.00",
  ],
  [
    1,
    "201.600",
    "NATURAL RUBBER SMR 20 CFR KARACHI, PAKISTAN",
    "1,585.00",
    "319,536.00",
  ],

  // Add more rows as needed...
];

export const tableFooter = {
  term: "Term :100% DP AT SIGHT",
  total: "USD 319,536.00",
  totalInWords:
    "US DOLLAR : THREE HUNDRED NINETEEN THOUSAND FIVE HUNDRED AND THIRTY SIX ONLY",
};

export const shippingDetails = [
  { label: "Country of Origin", value: "MALAYSIA" },
  { label: "Port of Loading", value: "ANY PORT IN MALAYSIA" },
  { label: "Port of Discharge", value: "KARACHI SEAPORT, PAKISTAN" },
  { label: "ETD Port of Loading", value: "FEBRUARY 2024" },
];

export const inputFieldsProforma = [
  {
    id: "tagline",
    label: "Tagline",
    type: "text",
    placeholder: "From the Managing Director Office",
    registerOptions: { required: "Tagline is required" },
  },
  {
    id: "invoiceNumber",
    label: "Invoice Number",
    type: "text",
    placeholder: "PI-S2410-N1014",
    registerOptions: { required: "Invoice number is required" },
  },
  {
    id: "buyerInfo",
    label: "Buyer Information",
    type: "textarea",
    placeholder: "Enter buyer company name and address",
    registerOptions: { required: "Buyer information is required" },
  },
  {
    id: "contractNo",
    label: "Contract Number",
    type: "text",
    placeholder: "S2410-N1014",
    registerOptions: { required: "Contract number is required" },
  },
  {
    id: "poNo",
    label: "PO Number",
    type: "text",
    placeholder: "PO-12345",
  },
  {
    id: "intermediate",
    label: "Intermediate",
    type: "text",
    placeholder: "Enter intermediate value",
  },
  {
    id: "date",
    label: "Date",
    type: "date",
    registerOptions: { required: "Date is required" },
  },
  {
    id: "terms",
    label: "Terms",
    type: "text",
    placeholder: "Enter terms",
    registerOptions: { required: "Terms are required" },
  },
];

export const initialValuesFormHeader = {
  tagline: "",
  invoiceNumber: "",
  buyerInfo: "",
  contractNo: "",
  poNo: "",
  intermediate: "",
  date: "",
  terms: "",
};

const inputFieldsSales = [
  {
    id: "buyerInfo",
    label: "Buyer Information",
    type: "textarea",
    placeholder: "Enter buyer company name and address",
    registerOptions: { required: "Buyer information is required" },
  },
  {
    id: "tagline",
    label: "Tagline",
    type: "text",
    placeholder: "From the Managing Director Office",
    registerOptions: { required: "Tagline is required" },
  },
  {
    id: "date",
    label: "Date",
    type: "date",
    registerOptions: { required: "Date is required" },
  },
];
export const customInputsData = {
  "Work order": inputFieldsSales,
  "Proforma Invoice": inputFieldsProforma,
};
