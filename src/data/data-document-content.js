// Field configurations for dynamic rendering
export const fieldConfigsGradeAndQuantity = [
  {
    id: "intermediate",
    // label: "Intermediate",
    type: "text",
    registerOptions: {
      validate: (value) => {
        if (requiredFields.intermediate && value.trim() === "") {
          return "Intermediate is required";
        }
        return true;
      },
    },
  },
  {
    id: "description",
    // label: "Description",
    type: "textarea",
    registerOptions: {
      validate: (value) => {
        if (requiredFields.description && value.trim().length < 10) {
          return "Description must be at least 10 characters";
        }
        return true;
      },
    },
  },
  {
    id: "grade",
    // label: "Grade",
    type: "text",
    registerOptions: {
      validate: (value) => {
        if (requiredFields.grade && !value) {
          return "Grade is required";
        }
        return true;
      },
    },
  },
  {
    id: "quantity",
    // label: "Quantity",
    type: "text",
    registerOptions: {
      validate: (value) => {
        if (requiredFields.quantity && !value) {
          return "Quantity is required";
        }
        return true;
      },
    },
  },
  {
    id: "price",
    // label: "Price",
    type: "text",
    registerOptions: {
      validate: (value) => {
        if (requiredFields.price && !value) {
          return "Price is required";
        }
        return true;
      },
    },
  },
];

// Fields for the Payment Details
export const paymentInputFields = [
  {
    id: "payment",
    // label: "Payment",
    type: "text",
    registerOptions: {
      required: "Payment information is required",
    },
  },
  {
    id: "beneficiary",
    // label: "Beneficiary",
    type: "text",
    registerOptions: {
      required: "Beneficiary name is required",
    },
  },
  {
    id: "accountHolder",
    // label: "Account Holder",
    type: "text",
    registerOptions: {
      required: "Account holder name is required",
    },
  },
  {
    id: "accountNumber",
    // label: "Account Number",
    type: "text",
    registerOptions: {
      required: "Account number is required",
      pattern: {
        value: /^[0-9-]+$/,
        message: "Please enter a valid account number",
      },
    },
  },
  {
    id: "accountType",
    // label: "Account Type",
    type: "text",
    registerOptions: {
      required: "Account type is required",
    },
  },
  {
    id: "bankName",
    // label: "Bank Name",
    type: "text",
    registerOptions: {
      required: "Bank name is required",
    },
  },
  {
    id: "swiftCode",
    // label: "Swift Code",
    type: "text",
    registerOptions: {
      required: "Swift code is required",
      pattern: {
        value: /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/,
        message: "Please enter a valid SWIFT code",
      },
    },
  },
  {
    id: "bankAddress",
    // label: "Bank Address",
    type: "textarea",
    registerOptions: {
      required: "Bank address is required",
      minLength: {
        value: 10,
        message: "Bank address must be at least 10 characters",
      },
    },
  },
];

//  Fields for the Shipping Details Component
export const shippingInputFields = [
  {
    id: "totalValue",
    // label: "Total Value",
    type: "text",
    registerOptions: {
      required: "Total value is required",
      min: {
        value: 0,
        message: "Total value must be greater than 0",
      },
    },
  },
  {
    id: "shippingTerms",
    // label: "Shipping Terms",
    type: "text",
    registerOptions: {
      required: "Shipping terms are required",
    },
  },
  {
    id: "packing",
    // label: "Packing",
    type: "text",
    registerOptions: {
      required: "Packing information is required",
    },
  },
  {
    id: "etdPortLoading",
    // label: "ETD Port of Loading",
    type: "text",
    registerOptions: {
      required: "Port of loading is required",
    },
  },
];
