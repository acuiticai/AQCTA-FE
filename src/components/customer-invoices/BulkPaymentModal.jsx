import { useTranslation } from "react-i18next";
import { customerInvoiceText as ciText } from "@/utils/customerInvoiceI18n";
import React, { useState, useEffect, useCallback, useContext } from "react";
import { useHistory } from "react-router-dom";
import axios from "axios";
import {
  X,
  Upload,
  AlertTriangle,
  CheckCircle,
  FileText,
  CreditCard,
  Loader,
  DollarSign,
  Calendar,
  Clock,
  User,
  Building,
  Mail,
  Phone,
  MapPin,
  Globe,
  ChevronRight,
  ChevronLeft,
  Plus,
  Minus,
  Trash2,
  Eye,
  Download,
  Send,
  Users,
  Check,
  AlertCircle,
  Info,
  ArrowRight,
  Building2,
  ArrowRightLeft,
  DollarSign as DollarSignIcon,
} from "lucide-react";
import CustomerInvoiceServices from "@/services/CustomerInvoiceServices";
import CustomerPaymentHistoryServices from "@/services/CustomerPaymentHistoryServices";
import BankManagementServices from "@/services/BankManagementServices";
import FinancialService from "@/services/financialService";
import useAsync from "@/hooks/useAsync";
import { AdminContext } from "@/context/AdminContext";

// Custom components with Tailwind CSS (matching the vendor invoice style) - Moved outside to prevent focus loss
const CustomButton = ({
  variant = "primary",
  size = "md",
  onClick,
  disabled,
  children,
  className = "",
}) => {
  const baseClasses =
    "inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2";

  const variants = {
    primary: disabled
      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
      : "bg-[var(--p-blue)] hover:bg-[#9CBA33] text-white focus:ring-[var(--p-blue)] shadow-md hover:shadow-lg transition-colors",
    secondary: disabled
      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
      : "bg-gray-200 hover:bg-gray-300 text-gray-700 focus:ring-gray-500",
    success: disabled
      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
      : "bg-[var(--p-blue)] hover:bg-[#9CBA33] text-white focus:ring-[var(--p-blue)] shadow-md hover:shadow-lg transition-colors",
    light: disabled
      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
      : "bg-gray-100 hover:bg-gray-200 text-gray-600 focus:ring-gray-400",
  };

  const sizes = {
    sm: "px-3 py-2 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
};

const CustomCard = ({ children, className = "", hover = false }) => (
  <div
    className={`bg-white rounded-xl shadow-sm border border-gray-200 ${
      hover
        ? "hover:shadow-md hover:-translate-y-1 transition-all duration-300"
        : ""
    } ${className}`}
  >
    {children}
  </div>
);

const CustomCardBody = ({ children, className = "" }) => (
  <div className={`p-6 ${className}`}>{children}</div>
);

const CustomAlert = ({ variant = "info", children, className = "" }) => {
  const variants = {
    success: "bg-green-50 border-green-200 text-green-800",
    danger: "bg-red-50 border-red-200 text-red-800",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
    info: "bg-blue-50 border-blue-200 text-blue-800",
  };

  return (
    <div className={`rounded-lg border p-4 ${variants[variant]} ${className}`}>
      {children}
    </div>
  );
};

const CustomInput = React.memo(
  ({
    type = "text",
    value,
    onChange,
    placeholder,
    className = "",
    disabled = false,
    ...props
  }) => (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      className={`block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-[var(--p-blue)] focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] disabled:bg-gray-100 disabled:cursor-not-allowed ${className}`}
      {...props}
    />
  )
);

CustomInput.displayName = "CustomInput";

const CustomSelect = React.memo(
  ({
    value,
    onChange,
    children,
    className = "",
    disabled = false,
    ...props
  }) => (
    <select
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={`block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--p-blue)] focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] disabled:bg-gray-100 disabled:cursor-not-allowed ${className}`}
      {...props}
    >
      {children}
    </select>
  )
);

CustomSelect.displayName = "CustomSelect";

const CustomProgress = ({ value = 0, className = "" }) => (
  <div className={`w-full bg-gray-200 rounded-full h-2 ${className}`}>
    <div
      className="bg-[var(--p-blue)] h-2 rounded-full transition-all duration-300"
      style={{ width: `${value}%` }}
    />
  </div>
);

const BulkPaymentRecordModal = ({
  isOpen,
  toggle,
  selectedInvoices = [],
  onPaymentComplete,
}) => {
  useTranslation();
  // Use the same bank account fetching approach as PaymentModal
  const {
    data: { accounts: bankAccounts = [] },
  } = useAsync(BankManagementServices.getAllAccounts);

  // Debug bank accounts
  useEffect(() => {
    console.log("Bank accounts loaded:", bankAccounts);
  }, [bankAccounts]);
  const [currentStep, setCurrentStep] = useState(1);
  const [paymentAllocations, setPaymentAllocations] = useState({});
  const [selectedBankAccount, setSelectedBankAccount] = useState("");
  const [loading, setLoading] = useState(false);
  const [processingResults, setProcessingResults] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);
  const [paymentSummary, setPaymentSummary] = useState(null);
  const [conversionDetails, setConversionDetails] = useState({});
  const [isLoadingConversion, setIsLoadingConversion] = useState(false);
  const [currencies, setCurrencies] = useState([]);
  const [calculatedTotalInBankCurrency, setCalculatedTotalInBankCurrency] =
    useState(0);
  const [invoiceConversionDetails, setInvoiceConversionDetails] = useState({});
  const [customerPaymentHistory, setCustomerPaymentHistory] = useState(null);
  const [customerBalanceSummary, setCustomerBalanceSummary] = useState(null);
  const [customerCreditBalance, setCustomerCreditBalance] = useState(null);
  const [overpaymentAnalysis, setOverpaymentAnalysis] = useState(null);
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

  // Function to fetch customer balance summary
  const fetchCustomerBalanceSummary = useCallback(
    async (customerId, businessId) => {
      if (customerId && businessId) {
        try {
          const response =
            await CustomerPaymentHistoryServices.getCustomerBalanceSummary(
              customerId,
              businessId
            );
          console.log(
            "Bulk payment - Customer balance summary response:",
            response.data
          );
          setCustomerBalanceSummary(response.data);
        } catch (error) {
          console.error("Error fetching customer balance summary:", error);
          // Don't show error to user as this is optional
        }
      }
    },
    []
  );

  // Create currency options like PaymentModal
  const currencyOptions = currencies.map((currency) => ({
    value: currency.symbol,
    label: `${currency.symbol} (${currency.prefix})`,
    conversionRate: currency.conversion_rate_to_base,
  }));

  // Payment form data
  const [paymentData, setPaymentData] = useState({
    paymentDate: new Date().toISOString().split("T")[0],
    paymentMode: "Bank Transfer",
    reference: "",
    bankCharges: 0,
    taxDeducted: false,
    tdsType: "",
    notes: "",
    emailThankYou: false,
    customerEmail: "",
    attachment: null,
    totalPaymentAmount: "", // Single amount for all invoices
    paymentCurrency: "USD", // Payment currency
  });

  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  // Helper function to check for multiple customers
  const hasMultipleCustomers = () => {
    const customerIds = [
      ...new Set(
        selectedInvoices.map((inv) => inv.customer_id?._id).filter(Boolean)
      ),
    ];
    return customerIds.length > 1;
  };

  // Status workflow configuration
  const statusConfig = {
    Draft: {
      icon: FileText,
      color: "bg-gray-100 text-gray-800 border-gray-300",
      bgColor: "bg-gray-50",
      textColor: "text-gray-700",
      description: "Invoice is in draft",
    },
    Generated: {
      icon: FileText,
      color: "bg-blue-100 text-blue-800 border-blue-300",
      bgColor: "bg-blue-50",
      textColor: "text-blue-700",
      description: "Invoice has been generated",
    },
    "Request Sent": {
      icon: CheckCircle,
      color: "bg-yellow-100 text-yellow-800 border-yellow-300",
      bgColor: "bg-yellow-50",
      textColor: "text-yellow-700",
      description: "Payment request sent to customer",
    },
    "Collection Scheduled": {
      icon: CreditCard,
      color: "bg-orange-100 text-orange-800 border-orange-300",
      bgColor: "bg-orange-50",
      textColor: "text-orange-700",
      description: "Payment collection scheduled",
    },
    Paid: {
      icon: CheckCircle,
      color: "bg-green-100 text-green-800 border-green-300",
      bgColor: "bg-green-50",
      textColor: "text-green-700",
      description: "Invoice has been paid",
    },
  };

  // Custom components are now defined outside the component to prevent focus loss

  // Fetch currencies for the business - using same approach as PaymentModal
  useEffect(() => {
    const fetchCurrencies = async () => {
      if (selectedInvoices && selectedInvoices.length > 0) {
        const businessId = selectedInvoices[0]?.business_id;
        if (businessId?._id || businessId) {
          try {
            const response = await axios.get(
              `${Base_URL}/finance/currencies?business_id=${
                businessId?._id || businessId
              }`
            );
            setCurrencies(response.data.data || []);
          } catch (error) {
            console.error("Error fetching currencies:", error);
            setCurrencies([]);
          }
        } else {
          setCurrencies([]);
        }
      }
    };

    fetchCurrencies();
  }, [selectedInvoices]);

  // Currency conversion function - following ViewVendorInvoice pattern
  const convertCurrency = useCallback(
    async (fromCurrency, toCurrency, amount) => {
      if (fromCurrency === toCurrency) {
        return {
          success: true,
          rate: 1,
          convertedAmount: amount,
          displayText: `${amount.toFixed(2)} ${fromCurrency} = ${amount.toFixed(
            2
          )} ${toCurrency} (Same Currency)`,
          originalAmount: amount,
          originalCurrency: fromCurrency,
        };
      }

      try {
        const response = await axios.get(`${Base_URL}/currency/convert`, {
          params: { from: fromCurrency, to: toCurrency, amount },
          headers: {
            authorization: `Bearer ${adminInfo?.token}`,
          },
        });

        if (response.data.success) {
          return {
            success: true,
            rate: response.data.rate,
            convertedAmount: response.data.convertedAmount,
            displayText: `${amount.toFixed(
              2
            )} ${fromCurrency} = ${response.data.convertedAmount.toFixed(
              2
            )} ${toCurrency}`,
            originalAmount: amount,
            originalCurrency: fromCurrency,
          };
        } else {
          throw new Error(response.data.error || "Currency conversion failed");
        }
      } catch (error) {
        console.warn(`Currency conversion failed: ${error.message}`);
        return {
          success: false,
          rate: 1,
          convertedAmount: amount,
          displayText: `${amount.toFixed(
            2
          )} ${fromCurrency} (conversion failed)`,
          originalAmount: amount,
          originalCurrency: fromCurrency,
        };
      }
    },
    [adminInfo?.token]
  );

  // Initialize payment summary
  useEffect(() => {
    if (selectedInvoices && selectedInvoices.length > 0) {
      console.log("Selected invoices:", selectedInvoices);

      // Calculate payment summary
      try {
        const summary =
          CustomerInvoiceServices.calculateBulkPaymentSummary(selectedInvoices);
        setPaymentSummary(summary);
        console.log("Payment summary calculated:", summary);

        // Set default customer email if all invoices are from same customer
        if (summary.customers.length === 1) {
          const firstInvoice = selectedInvoices[0];
          setPaymentData((prev) => ({
            ...prev,
            customerEmail: firstInvoice.email || "",
            paymentCurrency: firstInvoice.currency || prev.paymentCurrency || "USD",
            totalPaymentAmount: "", // Don't set default amount - let user enter it
          }));
        } else {
          // Don't set default currency or amount for multiple invoices
          setPaymentData((prev) => ({
            ...prev,
            totalPaymentAmount: "", // Don't set default amount - let user enter it
          }));
        }
      } catch (error) {
        console.error("Error calculating payment summary:", error);
        setPaymentSummary(null);
      }
    } else {
      // Reset state when no invoices selected
      setPaymentSummary(null);
      setConversionDetails({});
    }
  }, [selectedInvoices]);

  // File upload handler
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type and size
    const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      notifyError(ciText("Please upload only JPG, PNG, or PDF files"));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      // 5MB limit
      notifyError(ciText("File size must be less than 5MB"));
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const businessId =
        selectedInvoices[0]?.business_id?._id ||
        selectedInvoices[0]?.business_id ||
        "";

      console.log("File upload debug:", {
        invoice: selectedInvoices[0],
        businessIdRaw: selectedInvoices[0]?.business_id,
        businessIdExtracted: businessId,
        filePath: `Payments/${selectedInvoices[0]?._id}`,
      });

      const formData = new FormData();
      formData.append("file_path", `Payments/${selectedInvoices[0]?._id}`);
      formData.append("business_id", businessId);
      formData.append("file_type", file.type);
      formData.append("file_size", file.size);
      formData.append("file", file);

      const response = await axios.post(
        `${Base_URL}/documents/uploadDocument`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setUploadProgress(percentCompleted);
          },
        }
      );

      if (response.data.file) {
        const uploadedFile = response.data.file;
        setPaymentData((prev) => ({
          ...prev,
          attachment: {
            fileId: uploadedFile._id,
            name: uploadedFile.name,
            url: uploadedFile.url || "#",
            downloadUrl: uploadedFile.downloadUrl || "#",
            uploadedAt: new Date().toISOString(),
            size: file.size,
            type: file.type,
          },
        }));
        notifySuccess(ciText("Receipt uploaded successfully!"));
      }
    } catch (error) {
      console.error("File upload error:", error);
      console.error("Error response:", error.response?.data);

      let errorMessage = "File upload failed. Please try again.";
      if (error.response?.data?.message) {
        errorMessage = `File upload failed: ${error.response.data.message}`;
      } else if (error.response?.status === 500) {
        errorMessage =
          "Server error during file upload. Please check the file and try again.";
      }

      notifyError(errorMessage);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Handle payment data changes
  const handlePaymentDataChange = useCallback((field, value) => {
    setPaymentData((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  // Calculate customer credit balance for overpayments
  const calculateCustomerCredit = useCallback(() => {
    if (!paymentData.totalPaymentAmount || !selectedInvoices.length)
      return null;

    const paymentAmount = parseFloat(paymentData.totalPaymentAmount);
    const totalDue = selectedBankAccount
      ? calculatedTotalInBankCurrency
      : paymentSummary?.totalRemaining;

    if (paymentAmount > totalDue) {
      const excessAmount = paymentAmount - totalDue;
      const customerId = selectedInvoices[0]?.customer_id?._id;

      return {
        customerId,
        customerName:
          selectedInvoices[0]?.customer_name ||
          selectedInvoices[0]?.customer_id?.basicInformation
            ?.customerDisplayName,
        creditAmount: excessAmount,
        creditCurrency: paymentData.paymentCurrency,
        appliedToInvoices: selectedInvoices.map((inv) => inv.invoice_number),
        paymentDate: paymentData.paymentDate,
        reference: paymentData.reference,
      };
    }

    return null;
  }, [
    paymentData.totalPaymentAmount,
    paymentData.paymentDate,
    paymentData.reference,
    selectedInvoices,
    selectedBankAccount,
    calculatedTotalInBankCurrency,
    paymentSummary?.totalRemaining,
    paymentData.paymentCurrency,
  ]);

  // Real-time payment allocation calculation when payment amount changes
  useEffect(() => {
    if (
      paymentData.totalPaymentAmount &&
      parseFloat(paymentData.totalPaymentAmount) > 0
    ) {
      const paymentAmount = parseFloat(paymentData.totalPaymentAmount);
      const totalDue = selectedBankAccount
        ? calculatedTotalInBankCurrency
        : paymentSummary?.totalRemaining;

      if (totalDue && totalDue > 0) {
        // Sort invoices by due date (oldest first) for sequential allocation
        const sortedInvoices = [...selectedInvoices].sort(
          (a, b) => new Date(a.due_date) - new Date(b.due_date)
        );

        let remainingPaymentAmount = paymentAmount;
        const newAllocations = {};
        let totalAllocated = 0;

        sortedInvoices.forEach((invoice) => {
          const remaining =
            CustomerInvoiceServices.calculateRemainingAmount(invoice);
          const conversionDetail = invoiceConversionDetails[invoice._id];

          // Convert remaining amount to payment currency for comparison
          const remainingInPaymentCurrency =
            remaining * (conversionDetail?.rate || 1);

          // Calculate allocation for this invoice
          let finalAllocationInInvoiceCurrency;
          let finalAllocationInPaymentCurrency;
          let remainingAfterPayment;

          if (remainingPaymentAmount >= remainingInPaymentCurrency - 0.01) {
            // Can fully pay this invoice (with small tolerance for floating point)
            finalAllocationInInvoiceCurrency = remaining;
            finalAllocationInPaymentCurrency = remainingInPaymentCurrency;
            remainingAfterPayment = 0;
            remainingPaymentAmount -= remainingInPaymentCurrency;
          } else if (remainingPaymentAmount > 0) {
            // Can partially pay this invoice
            // Convert payment amount back to invoice currency
            finalAllocationInInvoiceCurrency =
              remainingPaymentAmount / (conversionDetail?.rate || 1);
            finalAllocationInPaymentCurrency = remainingPaymentAmount;
            remainingAfterPayment =
              remaining - finalAllocationInInvoiceCurrency;
            remainingPaymentAmount = 0;
          } else {
            // No payment amount left
            finalAllocationInInvoiceCurrency = 0;
            finalAllocationInPaymentCurrency = 0;
            remainingAfterPayment = remaining;
          }

          // Ensure we don't allocate more than the remaining amount
          finalAllocationInInvoiceCurrency = Math.min(
            finalAllocationInInvoiceCurrency,
            remaining
          );

          // Calculate remaining after payment
          remainingAfterPayment = Math.max(
            0,
            remaining - finalAllocationInInvoiceCurrency
          );

          // If we're allocating the full remaining amount, ensure remainingAfterPayment is 0
          if (Math.abs(finalAllocationInInvoiceCurrency - remaining) < 0.01) {
            remainingAfterPayment = 0;
          }

          // Calculate the proportional amount in bank currency for display purposes
          const invoiceProportionalAmount =
            (remaining / totalDue) * paymentAmount;

          // Track total allocated for exact payment detection
          totalAllocated += finalAllocationInInvoiceCurrency;

          newAllocations[invoice._id] = {
            amount: finalAllocationInPaymentCurrency, // Store amount in payment currency (USD)
            amountInInvoiceCurrency: finalAllocationInInvoiceCurrency, // Store amount in invoice currency (MYR)
            remainingAfterPayment: remainingAfterPayment,
            isFullyPaid:
              finalAllocationInInvoiceCurrency > 0 &&
              remainingAfterPayment <= 0.01, // Allow for small rounding differences
            isPartiallyPaid:
              finalAllocationInInvoiceCurrency > 0 &&
              remainingAfterPayment > 0.01,
            isUnpaid: finalAllocationInInvoiceCurrency === 0,
            originalRemaining: remaining,
            currency: invoice.currency,
            convertedAmount: invoiceProportionalAmount,
            conversionRate: conversionDetail?.rate || 1,
          };
        });

        setPaymentAllocations(newAllocations);
      }
    } else {
      setPaymentAllocations({});
    }

    // Fetch customer payment history when invoices are selected
    if (selectedInvoices && selectedInvoices.length > 0) {
      const customerId = selectedInvoices[0]?.customer_id?._id;
      const businessId = selectedInvoices[0]?.business;

      if (customerId && businessId) {
        fetchCustomerBalanceSummary(customerId, businessId);
      }
    }
  }, [
    paymentData.totalPaymentAmount,
    selectedBankAccount,
    calculatedTotalInBankCurrency,
    paymentSummary?.totalRemaining,
    selectedInvoices,
    invoiceConversionDetails,
    paymentData.paymentCurrency,
  ]);

  // Handle currency change with conversion details cleanup
  const handleCurrencyChange = useCallback(
    (value) => {
      handlePaymentDataChange("paymentCurrency", value);
      // Clear conversion details when currency changes
      setConversionDetails({});
    },
    [handlePaymentDataChange]
  );

  // Handle bank charges change
  const handleBankChargesChange = useCallback(
    (value) => {
      handlePaymentDataChange("bankCharges", parseFloat(value) || 0);
    },
    [handlePaymentDataChange]
  );

  // Handle attachment removal
  const handleRemoveAttachment = useCallback(() => {
    handlePaymentDataChange("attachment", null);
  }, [handlePaymentDataChange]);

  // Handle checkbox changes
  const handleTaxDeductedChange = useCallback(
    (checked) => {
      handlePaymentDataChange("taxDeducted", checked);
    },
    [handlePaymentDataChange]
  );

  const handleEmailThankYouChange = useCallback(
    (checked) => {
      handlePaymentDataChange("emailThankYou", checked);
    },
    [handlePaymentDataChange]
  );

  // Handle notes change
  const handleNotesChange = useCallback(
    (value) => {
      handlePaymentDataChange("notes", value);
    },
    [handlePaymentDataChange]
  );

  // Handle customer email change
  const handleCustomerEmailChange = useCallback(
    (value) => {
      handlePaymentDataChange("customerEmail", value);
    },
    [handlePaymentDataChange]
  );

  // Handle apply credits from customer payment history
  const handleApplyCredits = useCallback(async () => {
    console.log("Bulk payment - Applying credits:", {
      customerBalanceSummary,
      overpayments: customerBalanceSummary?.overpayments,
      availableCredits: customerBalanceSummary?.availableCredits,
    });

    // Use available credits if available, otherwise fall back to overpayments
    const credits =
      customerBalanceSummary?.availableCredits ||
      customerBalanceSummary?.overpayments ||
      [];
    if (credits.length === 0) {
      console.log("No credits available");
      return;
    }

    try {
      // Calculate total available credit in payment currency
      let totalAvailableCredit = 0;
      const creditBreakdown = [];

      for (const credit of credits) {
        if (credit.currency === paymentData.paymentCurrency) {
          totalAvailableCredit += credit.amount;
          creditBreakdown.push({
            currency: credit.currency,
            amount: credit.amount,
            originalAmount: credit.amount,
          });
        } else {
          // Convert to payment currency
          try {
            const response = await axios.get(`${Base_URL}/currency/convert`, {
              params: {
                from: credit.currency,
                to: paymentData.paymentCurrency,
                amount: credit.amount,
              },
              headers: {
                authorization: `Bearer ${adminInfo?.token}`,
              },
            });

            if (response.data.success) {
              const convertedAmount = response.data.convertedAmount;
              totalAvailableCredit += convertedAmount;
              creditBreakdown.push({
                currency: credit.currency,
                amount: credit.amount,
                convertedAmount: convertedAmount,
                convertedCurrency: paymentData.paymentCurrency,
                rate: response.data.rate,
              });
            }
          } catch (error) {
            console.error(
              `Error converting ${credit.currency} to ${paymentData.paymentCurrency}:`,
              error
            );
          }
        }
      }

      // Set payment amount to the FULL credit amount (user requirement)
      // The full credit amount will be populated, and overpayments will be handled naturally
      const currentPaymentAmount =
        parseFloat(paymentData.totalPaymentAmount) || 0;

      // Use the full available credit amount as the payment amount
      const newPaymentAmount = totalAvailableCredit;

      // Update payment amount to the full credit amount
      handlePaymentDataChange(
        "totalPaymentAmount",
        newPaymentAmount.toString()
      );

      // Show success message
      alert(
        `Applied full credit amount: ${totalAvailableCredit.toFixed(2)} ${
          paymentData.paymentCurrency
        }. Any overpayment will be available for future invoices.`
      );
    } catch (error) {
      console.error("Error applying credits:", error);
      alert("Error applying credits. Please try again.");
    }
  }, [
    customerBalanceSummary,
    paymentData.paymentCurrency,
    paymentData.totalPaymentAmount,
    handlePaymentDataChange,
    adminInfo?.token,
  ]);

  // Handle direct credit application to invoices
  const handleDirectCreditApplication = useCallback(async () => {
    try {
      const customerId =
        selectedInvoices[0]?.customer_id?._id ||
        selectedInvoices[0]?.customer_id;
      const businessId =
        selectedInvoices[0]?.business_id?._id ||
        selectedInvoices[0]?.business_id;

      if (!customerId || !businessId) {
        console.error("Missing customer or business ID");
        return;
      }

      // Prepare credit applications for each invoice
      const creditApplications = [];

      for (const invoice of selectedInvoices) {
        const remaining =
          CustomerInvoiceServices.calculateRemainingAmount(invoice);
        if (remaining > 0) {
          // Calculate available credit for this invoice's currency
          const availableCredits =
            customerBalanceSummary?.availableCredits ||
            customerBalanceSummary?.overpayments ||
            [];
          let availableInCurrency = 0;

          for (const credit of availableCredits) {
            if (credit.currency === invoice.currency) {
              availableInCurrency += credit.amount;
            } else {
              // Convert to invoice currency
              try {
                const response = await axios.get(
                  `${Base_URL}/currency/convert`,
                  {
                    params: {
                      from: credit.currency,
                      to: invoice.currency,
                      amount: credit.amount,
                    },
                    headers: {
                      authorization: `Bearer ${adminInfo?.token}`,
                    },
                  }
                );

                if (response.data.success) {
                  availableInCurrency += response.data.convertedAmount;
                }
              } catch (error) {
                console.warn(
                  `Failed to convert ${credit.currency} to ${invoice.currency}:`,
                  error
                );
              }
            }
          }

          const amountToApply = Math.min(availableInCurrency, remaining);
          if (amountToApply > 0) {
            creditApplications.push({
              invoiceId: invoice._id,
              amount: amountToApply,
              currency: invoice.currency,
            });
          }
        }
      }

      if (creditApplications.length === 0) {
        alert("No credits to apply to selected invoices");
        return;
      }

      // Apply credits using the new API
      const response =
        await CustomerPaymentHistoryServices.applyCreditsToInvoices(
          customerId,
          businessId,
          creditApplications
        );

      if (response.success) {
        console.log("Credits applied successfully:", response.data);
        alert(
          `Successfully applied credits to ${response.data.successful.length} invoices`
        );

        // Refresh customer balance summary
        if (customerId && businessId) {
          CustomerPaymentHistoryServices.getCustomerBalanceSummary(
            customerId,
            businessId
          )
            .then((balanceResponse) => {
              setCustomerBalanceSummary(balanceResponse.data);
            })
            .catch((error) => {
              console.error(
                "Error refreshing customer balance summary:",
                error
              );
            });
        }
      } else {
        alert("Failed to apply credits. Please try again.");
      }
    } catch (error) {
      console.error("Error applying credits directly:", error);
      alert("Error applying credits. Please try again.");
    }
  }, [selectedInvoices, customerBalanceSummary, adminInfo?.token]);

  // Calculate total amount in bank account currency with conversion details
  const calculateTotalInBankCurrency = useCallback(
    async (accountId = null) => {
      const targetAccountId = accountId || selectedBankAccount;

      console.log("calculateTotalInBankCurrency called with:", {
        targetAccountId,
        selectedBankAccount,
        selectedInvoices: selectedInvoices?.length,
        bankAccounts: bankAccounts?.length,
      });

      if (
        !targetAccountId ||
        !selectedInvoices ||
        selectedInvoices.length === 0
      ) {
        console.log("Early return - missing required data");
        return { total: 0, conversionDetails: {} };
      }

      const selectedAccount = bankAccounts.find(
        (account) => account._id === targetAccountId
      );
      console.log("Selected account:", selectedAccount);

      if (!selectedAccount || !selectedAccount.currencyType) {
        console.log("Early return - no account or currency type");
        return { total: 0, conversionDetails: {} };
      }

      const bankCurrency = selectedAccount.currencyType;
      let totalInBankCurrency = 0;
      const conversionDetails = {};

      console.log("Calculating total in bank currency:", bankCurrency);

      for (const invoice of selectedInvoices) {
        console.log("Processing invoice:", {
          id: invoice._id,
          number: invoice.invoice_number,
          currency: invoice.currency,
          grandTotal: invoice.grandTotal,
          payments: invoice.payments?.length || 0,
        });

        const remaining =
          CustomerInvoiceServices.calculateRemainingAmount(invoice);
        console.log(
          `Invoice ${invoice.invoice_number}: ${remaining} ${invoice.currency}`
        );

        if (remaining > 0) {
          if (invoice.currency === bankCurrency) {
            totalInBankCurrency += remaining;
            conversionDetails[invoice._id] = {
              originalAmount: remaining,
              originalCurrency: invoice.currency,
              convertedAmount: remaining,
              convertedCurrency: bankCurrency,
              rate: 1,
              success: true,
              displayText: `${remaining.toFixed(2)} ${
                invoice.currency
              } = ${remaining.toFixed(2)} ${bankCurrency} (Same Currency)`,
            };
            console.log(`Same currency, adding ${remaining} ${bankCurrency}`);
          } else {
            try {
              console.log(
                `Converting ${remaining} ${invoice.currency} to ${bankCurrency}`
              );

              // Use the same pattern as ViewVendorInvoice
              const response = await axios.get(`${Base_URL}/currency/convert`, {
                params: {
                  from: invoice.currency,
                  to: bankCurrency,
                  amount: remaining,
                },
                headers: {
                  authorization: `Bearer ${adminInfo?.token}`,
                },
              });

              if (response.data.success) {
                const convertedAmount = response.data.convertedAmount;
                const rate = response.data.rate;

                totalInBankCurrency += convertedAmount;
                conversionDetails[invoice._id] = {
                  originalAmount: remaining,
                  originalCurrency: invoice.currency,
                  convertedAmount: convertedAmount,
                  convertedCurrency: bankCurrency,
                  rate: rate,
                  success: true,
                  displayText: `${remaining.toFixed(2)} ${
                    invoice.currency
                  } = ${convertedAmount.toFixed(2)} ${bankCurrency}`,
                };
                console.log(
                  `Conversion successful: ${remaining} ${invoice.currency} = ${convertedAmount} ${bankCurrency}`
                );
              } else {
                // If conversion failed, use original amount
                console.log(
                  `Conversion failed, using original amount: ${remaining} ${invoice.currency}`
                );
                totalInBankCurrency += remaining;
                conversionDetails[invoice._id] = {
                  originalAmount: remaining,
                  originalCurrency: invoice.currency,
                  convertedAmount: remaining,
                  convertedCurrency: bankCurrency,
                  rate: 1,
                  success: false,
                  displayText: `${remaining.toFixed(2)} ${
                    invoice.currency
                  } (conversion failed)`,
                };
              }
            } catch (error) {
              console.error(
                `Currency conversion failed for invoice ${invoice._id}:`,
                error
              );
              totalInBankCurrency += remaining;
              conversionDetails[invoice._id] = {
                originalAmount: remaining,
                originalCurrency: invoice.currency,
                convertedAmount: remaining,
                convertedCurrency: bankCurrency,
                rate: 1,
                success: false,
                displayText: `${remaining.toFixed(2)} ${
                  invoice.currency
                } (conversion error)`,
              };
            }
          }
        }
      }

      console.log(`Total in ${bankCurrency}: ${totalInBankCurrency}`);
      return { total: totalInBankCurrency, conversionDetails };
    },
    [selectedBankAccount, selectedInvoices, bankAccounts, adminInfo?.token]
  );

  // Handle bank account selection
  const handleBankAccountChange = useCallback(
    async (accountId) => {
      console.log("Bank account changed to:", accountId);

      // Set payment currency from selected bank account
      if (accountId) {
        const selectedAccount = bankAccounts.find(
          (account) => account._id === accountId
        );
        console.log("Selected bank account:", selectedAccount);

        if (selectedAccount && selectedAccount.currencyType) {
          const bankCurrency = selectedAccount.currencyType;
          console.log("Bank currency:", bankCurrency);

          // Update state first
          setSelectedBankAccount(accountId);
          setPaymentData((prev) => ({
            ...prev,
            paymentCurrency: bankCurrency,
          }));

          // Show loading state for currency conversion
          setIsLoadingConversion(true);
          try {
            // Calculate and set the total amount in bank currency - pass accountId directly
            const result = await calculateTotalInBankCurrency(accountId);
            console.log("Currency conversion result:", result);
            setCalculatedTotalInBankCurrency(result.total);
            setInvoiceConversionDetails(result.conversionDetails);
            if (result.total > 0) {
              setPaymentData((prev) => ({
                ...prev,
                totalPaymentAmount: result.total.toFixed(2),
              }));
            }
          } catch (error) {
            console.error("Error calculating currency conversions:", error);
            notifyError(ciText("Failed to calculate currency conversions"));
          } finally {
            setIsLoadingConversion(false);
          }
        } else {
          setSelectedBankAccount(accountId);
        }
      } else {
        // Reset when no bank account is selected
        setSelectedBankAccount(accountId);
        setCalculatedTotalInBankCurrency(0);
        setConversionDetails({});
        setInvoiceConversionDetails({});
      }
    },
    [bankAccounts, calculateTotalInBankCurrency]
  );

  // Handle payment allocation changes with currency conversion
  const handleAllocationChange = useCallback(
    async (invoiceId, amount) => {
      if (!invoiceId) return;

      const invoice = selectedInvoices.find((inv) => inv._id === invoiceId);
      if (!invoice) return;

      const parsedAmount = parseFloat(amount) || 0;

      // Update allocation
      setPaymentAllocations((prev) => ({
        ...prev,
        [invoiceId]: {
          ...prev[invoiceId],
          amount: parsedAmount,
        },
      }));

      // Handle currency conversion if needed
      if (
        parsedAmount > 0 &&
        paymentData.paymentCurrency &&
        invoice.currency !== paymentData.paymentCurrency
      ) {
        setIsLoadingConversion(true);
        try {
          const conversion = await convertCurrency(
            paymentData.paymentCurrency,
            invoice.currency,
            parsedAmount
          );

          setConversionDetails((prev) => ({
            ...prev,
            [invoiceId]: conversion,
          }));
        } catch (error) {
          console.error("Currency conversion error:", error);
        } finally {
          setIsLoadingConversion(false);
        }
      } else {
        // Remove conversion details if same currency or amount is 0
        setConversionDetails((prev) => {
          const newDetails = { ...prev };
          delete newDetails[invoiceId];
          return newDetails;
        });
      }
    },
    [selectedInvoices, paymentData.paymentCurrency, convertCurrency]
  );

  // Create a memoized allocation change handler for specific invoice
  const createAllocationChangeHandler = useCallback(
    (invoiceId) => {
      return (value) => handleAllocationChange(invoiceId, value);
    },
    [handleAllocationChange]
  );

  // Process bulk payment recording using new bulk payment endpoint
  const handleProcessPayment = async () => {
    // Check for multiple customers
    const customerIds = [
      ...new Set(
        selectedInvoices.map((inv) => inv.customer_id?._id).filter(Boolean)
      ),
    ];
    if (customerIds.length > 1) {
      notifyError(
        "Cannot process bulk operations for invoices from different customers. Please select invoices from the same customer only."
      );
      return;
    }

    setLoading(true);
    setCurrentStep(3); // Processing step

    try {
      // Validate payment data
      if (
        !paymentData.totalPaymentAmount ||
        parseFloat(paymentData.totalPaymentAmount) <= 0
      ) {
        setValidationErrors(["Please enter a valid payment amount"]);
        setCurrentStep(2);
        setLoading(false);
        return;
      }

      // Prepare allocation details for backend
      const allocationDetails = selectedInvoices.map((invoice) => {
        const allocation = paymentAllocations[invoice._id] || { amount: 0 };
        const remaining =
          CustomerInvoiceServices.calculateRemainingAmount(invoice);
        const conversion = conversionDetails[invoice._id];

        // Send the original payment amount in payment currency, not the converted amount
        // The backend will handle the conversion to invoice currency
        const originalPaymentAmount = allocation.amount || 0;

        return {
          invoiceId: invoice._id,
          allocatedAmount: originalPaymentAmount, // Original payment amount in payment currency (e.g., 10 USD)
          originalRemaining: remaining,
          originalCurrency: invoice.currency,
          conversionDetails: conversion,
        };
      });

      const paymentPayload = {
        invoiceIds: selectedInvoices.map((inv) => inv._id),
        totalPaymentAmount: parseFloat(paymentData.totalPaymentAmount),
        paymentCurrency: paymentData.paymentCurrency,
        paymentMode: paymentData.paymentMode,
        depositTo: selectedBankAccount || null,
        paymentDate: paymentData.paymentDate,
        reference: paymentData.reference,
        notes: paymentData.notes,
        attachment: paymentData.attachment,
        emailThankYou: paymentData.emailThankYou,
        customerEmail: paymentData.customerEmail,
        allocationDetails: allocationDetails, // Send frontend allocation details
      };

      console.log("Processing bulk payment:", paymentPayload);

      // Use the new bulk payment endpoint
      const response = await axios.post(
        `${Base_URL}/proforma-invoice/bulk/record-payment`,
        paymentPayload
      );

      if (response.data.success) {
        const results = response.data.data;

        // Calculate payment type and amounts for history
        const paymentAmount = parseFloat(paymentData.totalPaymentAmount);
        const totalDue = selectedBankAccount
          ? calculatedTotalInBankCurrency
          : paymentSummary?.totalRemaining;
        const difference = paymentAmount - totalDue;
        const paymentType = CustomerPaymentHistoryServices.getPaymentType(
          paymentAmount,
          totalDue
        );

        // Create payment history record
        try {
          const paymentHistoryData = {
            customer: selectedInvoices[0]?.customer_id?._id,
            business: selectedInvoices[0]?.business,
            paymentType: paymentType,
            amount: Math.abs(difference),
            currency: paymentData.paymentCurrency,
            paymentDate: paymentData.paymentDate,
            reference: paymentData.reference,
            notes: paymentData.notes,
            appliedToInvoices: results.successful.map((result) => ({
              invoiceId: result.invoiceId,
              invoiceNumber: result.invoiceNumber,
              amountApplied: result.amountApplied || 0,
              currency: result.currency,
              remainingAfterPayment: result.remainingAfterPayment || 0,
            })),
            remainingBalance:
              paymentType === "overpayment" ? Math.abs(difference) : 0,
          };

          await CustomerPaymentHistoryServices.createPaymentHistory(
            paymentHistoryData
          );
        } catch (historyError) {
          console.error("Error creating payment history:", historyError);
          // Don't fail the payment if history creation fails
        }

        setProcessingResults({
          data: {
            success: results.successful.length > 0,
            successful: results.successful,
            failed: results.failed,
            allocationDetails: results.allocationDetails,
            overpaymentAmount: results.overpaymentAmount,
            underpaymentAmount: results.underpaymentAmount,
          },
        });
        setCurrentStep(4); // Results step

        if (results.successful.length > 0) {
          notifySuccess(
            ciText(
              "Successfully recorded bulk payment for {{count}} invoice(s)!",
              { count: results.successful.length },
            ),
          );

          // Refresh customer balance summary after successful payment
          if (selectedInvoices && selectedInvoices.length > 0) {
            const customerId = selectedInvoices[0]?.customer_id?._id;
            const businessId = selectedInvoices[0]?.business;
            if (customerId && businessId) {
              await fetchCustomerBalanceSummary(customerId, businessId);
            }
          }

          if (onPaymentComplete) onPaymentComplete();
        }

        if (results.failed.length > 0) {
          notifyError(
            ciText("{{count}} payment(s) failed", {
              count: results.failed.length,
            }),
          );
        }

        // Show overpayment/underpayment information
        if (results.overpaymentAmount > 0) {
          notifySuccess(
            ciText(
              "Overpayment of {{currency}} {{amount}} will be applied to future invoices",
              {
                currency: paymentData.paymentCurrency,
                amount: results.overpaymentAmount.toFixed(2),
              },
            ),
          );
        }

        if (results.underpaymentAmount > 0) {
          notifyError(
            ciText(
              "Underpayment of {{currency}} {{amount}} - remaining balance will be tracked",
              {
                currency: paymentData.paymentCurrency,
                amount: results.underpaymentAmount.toFixed(2),
              },
            ),
          );
        }
      } else {
        throw new Error(
          response.data.message || ciText("Bulk payment failed"),
        );
      }
    } catch (error) {
      console.error("Bulk payment processing error:", error);
      notifyError(
        error.response?.data?.message ||
          ciText("Failed to record bulk payment"),
      );
      setCurrentStep(2);
    } finally {
      setLoading(false);
    }
  };

  // Validation
  const validateConfiguration = () => {
    const errors = [];

    if (!paymentData.paymentMode) {
      errors.push(ciText("Please select a payment mode"));
    }

    if (!paymentData.paymentDate) {
      errors.push(ciText("Please select a payment date"));
    }

    if (!paymentData.paymentCurrency) {
      errors.push(ciText("Please select a payment currency"));
    }

    const totalAllocation = Object.values(paymentAllocations).reduce(
      (sum, alloc) => sum + (alloc.amount || 0),
      0
    );
    if (totalAllocation <= 0) {
      errors.push(ciText("Total payment amount must be greater than 0"));
    }

    // Validate individual allocations
    selectedInvoices.forEach((invoice) => {
      if (!invoice || !invoice._id) return;

      const allocation = paymentAllocations[invoice._id];
      // Allow zero allocation for invoices that don't need payment
      // Only validate if allocation exists and is negative (invalid)
      if (allocation && allocation.amount < 0) {
        errors.push(
          `Please enter a valid amount for invoice ${invoice.invoice_number}`
        );
      }

      const remaining =
        CustomerInvoiceServices.calculateRemainingAmount(invoice);

      // For currency conversion validation, we check against the remaining in invoice currency
      let effectiveAmount = allocation.amount;
      const conversion = conversionDetails[invoice._id];
      if (conversion && conversion.success) {
        effectiveAmount = conversion.convertedAmount;
      }

      // Allow overpayments as they will be handled by customer payment history
      // Remove validation that prevents overpayments
    });

    setValidationErrors(errors);
    return errors.length === 0;
  };

  // Handle close
  const handleClose = () => {
    setCurrentStep(1);
    setSelectedBankAccount("");
    setPaymentAllocations({});
    setPaymentData({
      paymentDate: new Date().toISOString().split("T")[0],
      paymentMode: "Bank Transfer",
      reference: "",
      bankCharges: 0,
      taxDeducted: false,
      tdsType: "",
      notes: "",
      emailThankYou: false,
      customerEmail: "",
      attachment: null,
      totalPaymentAmount: "",
      paymentCurrency: "USD",
    });
    setProcessingResults(null);
    setValidationErrors([]);
    setConversionDetails({});
    setInvoiceConversionDetails({});
    setIsLoadingConversion(false);
    setCalculatedTotalInBankCurrency(0);
    toggle();
  };

  // Step indicator
  const renderStepIndicator = () => {
    const steps = [
      { step: 1, title: "Review Invoices", icon: FileText },
      { step: 2, title: "Payment Details", icon: CreditCard },
      { step: 3, title: "Processing", icon: Loader },
      { step: 4, title: "Results", icon: CheckCircle },
    ];

    return (
      <div className="mb-8">
        <div className="flex justify-between items-center relative">
          <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-200 z-10" />
          <div
            className="absolute top-4 left-4 h-0.5 bg-[var(--p-blue)] z-20 transition-all duration-300"
            style={{
              width: `${((currentStep - 1) / (steps.length - 1)) * 100}%`,
            }}
          />

          {steps.map(({ step, title, icon: Icon }) => (
            <div key={step} className="text-center relative z-30">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 shadow-sm border-2 transition-all duration-300 hover:scale-110 ${
                  currentStep >= step
                    ? "bg-[var(--p-blue)] text-white border-[var(--p-blue)]"
                    : currentStep === step - 1
                    ? "bg-white text-[var(--p-blue)] border-[var(--p-blue)]"
                    : "bg-white text-gray-400 border-gray-200"
                }`}
              >
                {currentStep > step ? (
                  <Check size={18} />
                ) : currentStep === step && step === 3 ? (
                  <Icon size={18} className="animate-spin" />
                ) : (
                  <Icon size={18} />
                )}
              </div>
              <div
                className={`text-xs font-medium ${
                  currentStep >= step ? "text-[var(--p-blue)]" : "text-gray-500"
                }`}
              >
                {title}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Review step - shows selected invoices
  const renderReviewStep = () => (
    <div>
      <div className="flex items-center mb-6">
        <FileText className="text-[var(--p-blue)] mr-3" size={24} />
        <h4 className="text-xl font-semibold text-[var(--p-blue)] mb-0">
          {ciText("Review Selected Invoices")}
        </h4>
      </div>

      {/* Customer Validation Alert */}
      {(() => {
        const customerIds = [
          ...new Set(
            selectedInvoices.map((inv) => inv.customer_id?._id).filter(Boolean)
          ),
        ];
        if (customerIds.length > 1) {
          return (
            <div className="mb-6">
              <CustomAlert variant="danger">
                <div className="flex items-center">
                  <AlertTriangle className="mr-3" size={20} />
                  <div>
                    <strong>{ciText("Multiple Customers Detected:")}</strong>
                    <br />
                    <span className="text-sm">
                      You have selected invoices from {customerIds.length}{" "}
                      different customers. Bulk payment operations can only be
                      performed on invoices from the same customer. Please
                      deselect invoices from other customers to continue.
                    </span>
                  </div>
                </div>
              </CustomAlert>
            </div>
          );
        }
        return null;
      })()}

      {/* Customer Information Summary */}
      {selectedInvoices.length > 0 && (
        <div className="mb-6">
          <CustomCard className="bg-blue-50 border-blue-200">
            <CustomCardBody>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg mr-3">
                    <Users className="text-blue-600" size={20} />
                  </div>
                  <div>
                    <h6 className="font-semibold text-blue-900">
                      {ciText("Customer Information")}
                    </h6>
                    <p className="text-sm text-blue-700">
                      {selectedInvoices[0]?.customer_id?.basicInformation
                        ?.companyName ||
                        selectedInvoices[0]?.customer_id?.name ||
                        selectedInvoices[0]?.customer_name ||
                        ciText("Unknown Customer")}
                    </p>
                    <p className="text-xs text-blue-600">
                      {selectedInvoices.length} invoice
                      {selectedInvoices.length !== 1 ? "s" : ""} selected
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-blue-900">
                    {ciText("Total Amount")}
                  </div>
                  <div className="text-lg font-bold text-blue-800">
                    {paymentSummary?.currencies.length > 1 ? (
                      <span className="text-orange-600">
                        {ciText("Multiple currencies")}
                      </span>
                    ) : (
                      CustomerInvoiceServices.formatCurrency(
                        selectedInvoices.reduce(
                          (sum, inv) =>
                            sum +
                            (CustomerInvoiceServices.calculateRemainingAmount(
                              inv
                            ) || 0),
                          0
                        ),
                        paymentSummary?.currencies[0] || "USD"
                      )
                    )}
                  </div>
                </div>
              </div>
            </CustomCardBody>
          </CustomCard>
        </div>
      )}

      {/* Customer Payment History Summary */}
      {customerBalanceSummary && (
        <div className="mb-6">
          <CustomCard className="bg-gray-50 border-gray-200">
            <CustomCardBody>
              <h6 className="text-md font-semibold text-gray-900 mb-3">
                {ciText("Customer Payment History")}
              </h6>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Existing Credits */}
                {customerCreditBalance &&
                  customerCreditBalance.data.creditBalance > 0 && (
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <h6 className="text-sm font-semibold text-green-900 mb-2">
                        {ciText("Available Credit")}
                      </h6>
                      <p className="text-lg font-bold text-green-800">
                        {customerCreditBalance.data.creditBalance.toFixed(2)}{" "}
                        {customerCreditBalance.data.currency}
                      </p>
                      <p className="text-xs text-green-600 mt-1">
                        From {customerCreditBalance.data.overpayments} previous
                        overpayment(s)
                      </p>
                    </div>
                  )}

                {/* Balance by Currency */}
                {customerBalanceSummary.data.balanceByCurrency &&
                  Object.keys(customerBalanceSummary.data.balanceByCurrency)
                    .length > 0 && (
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <h6 className="text-sm font-semibold text-blue-900 mb-2">
                        {ciText("Customer Balance Summary")}
                      </h6>
                      <div className="space-y-1">
                        {Object.values(
                          customerBalanceSummary.data.balanceByCurrency
                        ).map((balance, index) => (
                          <div key={index} className="text-xs">
                            <span className="text-blue-700">
                              {balance.currency}:
                            </span>
                            <span
                              className={`ml-2 font-medium ${
                                balance.netBalance > 0
                                  ? "text-green-700"
                                  : balance.netBalance < 0
                                  ? "text-red-700"
                                  : "text-blue-700"
                              }`}
                            >
                              {balance.netBalance > 0 ? "+" : ""}
                              {balance.netBalance.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            </CustomCardBody>
          </CustomCard>
        </div>
      )}

      <CustomAlert variant="info" className="mb-6">
        <div className="flex items-start">
          <AlertCircle className="mr-3 mt-0.5" size={20} />
          <div>
            <strong className="font-semibold">{ciText("Payment Recording:")}</strong>
            <div className="mt-2 text-sm">
              You are about to record payments for {selectedInvoices.length}{" "}
              customer invoices. Review the invoices and proceed to enter
              payment details.
            </div>
          </div>
        </div>
      </CustomAlert>

      {/* Invoice Cards */}
      <div className="space-y-6">
        {selectedInvoices.map((invoice) => {
          const StatusIcon = statusConfig[invoice.status]?.icon || FileText;
          const remaining =
            CustomerInvoiceServices.calculateRemainingAmount(invoice);

          return (
            <CustomCard
              key={invoice._id}
              className="border-l-4 border-l-[var(--p-blue)]"
            >
              <CustomCardBody>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Invoice Details */}
                  <div>
                    <div className="flex items-center mb-3">
                      <div
                        className={`p-1 rounded mr-2 ${
                          statusConfig[invoice.status]?.bgColor
                        }`}
                      >
                        <StatusIcon
                          size={16}
                          className={statusConfig[invoice.status]?.textColor}
                        />
                      </div>
                      <h5 className="font-bold text-gray-900">
                        {invoice.invoice_number}
                      </h5>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">
                      <strong>{invoice.customer_name}</strong>
                    </p>
                    <div className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full border border-gray-300 text-gray-700 mb-2">
                      {invoice.status}
                    </div>

                    <div className="space-y-2 mt-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">{ciText("Total:")}</span>
                        <span className="font-semibold">
                          {CustomerInvoiceServices.formatCurrency(
                            invoice.grandTotal,
                            invoice.currency
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">{ciText("Remaining:")}</span>
                        <span className="font-semibold text-yellow-600">
                          {CustomerInvoiceServices.formatCurrency(
                            remaining,
                            invoice.currency
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Customer Details */}
                  <div>
                    <h6 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                      <Users className="mr-2" size={16} />
                      {ciText("Customer Information")}
                    </h6>
                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="text-gray-500">{ciText("Customer:")}</span>
                        <p className="font-medium text-gray-900">
                          {invoice.customer_name || "Not provided"}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">{ciText("Invoice Date:")}</span>
                        <p className="font-medium text-gray-900">
                          {invoice.invoice_date
                            ? new Date(
                                invoice.invoice_date
                              ).toLocaleDateString()
                            : "Not provided"}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">{ciText("Due Date:")}</span>
                        <p className="font-medium text-gray-900">
                          {invoice.due_date
                            ? new Date(invoice.due_date).toLocaleDateString()
                            : "Not provided"}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">{ciText("Contract:")}</span>
                        <p className="font-medium text-gray-900">
                          {invoice.contract_no || "Not provided"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Payment History */}
                  <div>
                    <h6 className="text-sm font-semibold text-gray-700 mb-3">
                      {ciText("Payment History")}
                    </h6>
                    <div className="text-sm text-gray-600">
                      {invoice.payments && invoice.payments.length > 0 ? (
                        <div className="space-y-1">
                          <p className="font-medium">
                            {invoice.payments.length} payment(s) received
                          </p>
                          <p className="text-xs">
                            Total Paid:{" "}
                            {CustomerInvoiceServices.formatCurrency(
                              invoice.payments.reduce(
                                (sum, p) => sum + p.amount,
                                0
                              ),
                              invoice.currency
                            )}
                          </p>
                        </div>
                      ) : (
                        <p className="text-gray-500">
                          {ciText("No payments received yet")}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </CustomCardBody>
            </CustomCard>
          );
        })}
      </div>

      {/* Summary */}
      {paymentSummary && (
        <CustomCard className="mt-6 bg-gradient-to-r from-blue-50 to-cyan-50">
          <CustomCardBody>
            <h6 className="text-lg font-semibold text-gray-900 mb-4">
              {ciText("Payment Summary")}
            </h6>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600">{ciText("Total Invoices")}</p>
                <p className="text-xl font-bold text-gray-900">
                  {paymentSummary.totalInvoices}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">{ciText("Total Amount Due")}</p>
                <p className="text-xl font-bold text-gray-900">
                  {paymentSummary.currencies.length > 1 ? (
                    <span className="text-orange-600">
                      {ciText("Multiple currencies - see breakdown below")}
                    </span>
                  ) : (
                    CustomerInvoiceServices.formatCurrency(
                      paymentSummary.totalRemaining,
                      paymentSummary.currencies[0] || "USD"
                    )
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">{ciText("Customers")}</p>
                <p className="text-xl font-bold text-gray-900">
                  {paymentSummary.customers.length}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">{ciText("Currencies")}</p>
                <p className="text-xl font-bold text-gray-900">
                  {paymentSummary.currencies.join(", ")}
                </p>
              </div>
            </div>
          </CustomCardBody>
        </CustomCard>
      )}
    </div>
  );

  // Payment details step
  const renderPaymentDetailsStep = () => (
    <div>
      <div className="flex items-center mb-6">
        <CreditCard className="text-[var(--p-blue)] mr-3" size={24} />
        <h4 className="text-xl font-semibold text-[var(--p-blue)] mb-0">
          {ciText("Enter Payment Details")}
        </h4>
      </div>

      <CustomAlert variant="info" className="mb-6">
        <div className="flex items-start">
          <AlertCircle className="mr-3 mt-0.5" size={20} />
          <div>
            <strong className="font-semibold">{ciText("Payment Information:")}</strong>
            <div className="mt-2 text-sm">
              Enter the payment details and allocate amounts to each invoice.
              Ensure the total allocation matches the payment received.
            </div>
          </div>
        </div>
      </CustomAlert>

      {/* Payment Form */}
      <CustomCard className="mb-6">
        <CustomCardBody>
          <h6 className="text-lg font-semibold text-gray-900 mb-4">
            {ciText("Payment Information")}
          </h6>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="flex items-center text-sm font-semibold text-gray-700 mb-2">
                <Calendar size={16} className="mr-2" />
                {ciText("Payment Date *")}
              </label>
              <CustomInput
                type="date"
                value={paymentData.paymentDate}
                onChange={(e) =>
                  handlePaymentDataChange("paymentDate", e.target.value)
                }
              />
            </div>

            <div>
              <label className="flex items-center text-sm font-semibold text-gray-700 mb-2">
                <CreditCard size={16} className="mr-2" />
                {ciText("Payment Mode *")}
              </label>
              <CustomSelect
                value={paymentData.paymentMode}
                onChange={(e) =>
                  handlePaymentDataChange("paymentMode", e.target.value)
                }
              >
                <option value="Bank Transfer">{ciText("Bank Transfer")}</option>
                <option value="Cash">{ciText("Cash")}</option>
                <option value="Check">{ciText("Check")}</option>
                <option value="Online">{ciText("Online Payment")}</option>
                <option value="Wire Transfer">{ciText("Wire Transfer")}</option>
                <option value="Credit Card">{ciText("Credit Card")}</option>
              </CustomSelect>
            </div>

            <div>
              <label className="flex items-center text-sm font-semibold text-gray-700 mb-2">
                <Building2 size={16} className="mr-2" />
                {ciText("Deposit To Bank Account")} ({ciText("Optional")})
              </label>
              <CustomSelect
                value={selectedBankAccount}
                onChange={(e) => handleBankAccountChange(e.target.value)}
              >
                <option value="">{ciText("Select Bank Account")}</option>
                {!bankAccounts || bankAccounts.length === 0 ? (
                  <option disabled>{ciText("Loading bank accounts...")}</option>
                ) : (
                  bankAccounts.map((account) => (
                    <option key={account._id} value={account._id}>
                      {account.accountName} ({account.bankName})
                    </option>
                  ))
                )}
              </CustomSelect>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">
                {ciText("Reference Number")}
              </label>
              <CustomInput
                value={paymentData.reference}
                onChange={(e) =>
                  handlePaymentDataChange("reference", e.target.value)
                }
                placeholder={ciText("Payment reference or transaction ID")}
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">
                {ciText("Payment Currency *")}
              </label>
              <CustomSelect
                value={paymentData.paymentCurrency}
                onChange={(e) =>
                  handlePaymentDataChange("paymentCurrency", e.target.value)
                }
                disabled={!!selectedBankAccount}
              >
                <option value="">{ciText("Select Currency")}</option>
                {currencyOptions.length === 0 ? (
                  <option disabled>{ciText("Loading currencies...")}</option>
                ) : (
                  currencyOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))
                )}
              </CustomSelect>
              {selectedBankAccount && (
                <p className="text-xs text-blue-600 mt-1">
                  {ciText("Currency automatically set from selected bank account")}
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">
                {ciText("Total Payment Amount *")}
              </label>
              <CustomInput
                type="number"
                value={paymentData.totalPaymentAmount}
                onChange={(e) =>
                  handlePaymentDataChange("totalPaymentAmount", e.target.value)
                }
                placeholder={ciText("Enter total amount to be paid")}
                min="0"
                step="0.01"
              />
              <p className="text-xs text-gray-500 mt-1">
                {selectedBankAccount ? (
                  isLoadingConversion ? (
                    <span className="text-blue-600">
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-1"></div>
                        {ciText("Calculating currency conversions...")}
                      </div>
                    </span>
                  ) : (
                    <>
                      Calculated total in {paymentData.paymentCurrency}:{" "}
                      {calculatedTotalInBankCurrency.toFixed(2)}{" "}
                      {paymentData.paymentCurrency}
                      {selectedInvoices.some(
                        (inv) => inv.currency !== paymentData.paymentCurrency
                      ) && (
                        <span className="text-blue-600 ml-2">
                          (converted from multiple currencies)
                        </span>
                      )}
                    </>
                  )
                ) : (
                  "Select a bank account to see converted total"
                )}
              </p>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">
                {ciText("Bank Charges")}
              </label>
              <CustomInput
                type="number"
                value={paymentData.bankCharges}
                onChange={(e) => handleBankChargesChange(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-gray-700 mb-2 block">
                {ciText("Notes")}
              </label>
              <textarea
                value={paymentData.notes}
                onChange={(e) => handleNotesChange(e.target.value)}
                placeholder={ciText("Additional notes about this payment...")}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-[var(--p-blue)] focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)]"
                rows={3}
              />
            </div>

            <div className="md:col-span-2">
              <div className="flex items-center space-x-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={paymentData.taxDeducted}
                    onChange={(e) => handleTaxDeductedChange(e.target.checked)}
                    className="rounded border-gray-300 text-[var(--p-blue)] focus:ring-[var(--p-blue)]"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    {ciText("Tax Deducted at Source")}
                  </span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={paymentData.emailThankYou}
                    onChange={(e) =>
                      handleEmailThankYouChange(e.target.checked)
                    }
                    className="rounded border-gray-300 text-[var(--p-blue)] focus:ring-[var(--p-blue)]"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    {ciText("Send Thank You Email")}
                  </span>
                </label>
              </div>
            </div>

            {paymentData.emailThankYou && (
              <div className="md:col-span-2">
                <label className="text-sm font-semibold text-gray-700 mb-2 block">
                  {ciText("Customer Email")}
                </label>
                <CustomInput
                  type="email"
                  value={paymentData.customerEmail}
                  onChange={(e) => handleCustomerEmailChange(e.target.value)}
                  placeholder={ciText("customer@example.com")}
                />
              </div>
            )}
          </div>
        </CustomCardBody>
      </CustomCard>

      {/* File Upload */}
      <CustomCard className="mb-6">
        <CustomCardBody>
          <h6 className="text-lg font-semibold text-gray-900 mb-4">
            {ciText("Payment Receipt")}
          </h6>

          {!paymentData.attachment ? (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <div className="mt-4">
                <label htmlFor="payment-receipt" className="cursor-pointer">
                  <span className="mt-2 block text-sm font-medium text-gray-900">
                    {ciText("Upload payment receipt or proof")}
                  </span>
                  <span className="text-sm text-gray-500">
                    {ciText("PDF, PNG, JPG up to 5MB")}
                  </span>
                </label>
                <input
                  id="payment-receipt"
                  name="payment-receipt"
                  type="file"
                  className="sr-only"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleFileUpload}
                />
              </div>
              {uploading && (
                <div className="mt-4">
                  <CustomProgress value={uploadProgress} />
                  <p className="text-sm text-gray-500 mt-2">
                    Uploading... {uploadProgress}%
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center">
                <FileText className="h-10 w-10 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-green-900">
                    {paymentData.attachment.name}
                  </p>
                  <p className="text-sm text-green-700">
                    {(paymentData.attachment.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <button
                onClick={handleRemoveAttachment}
                className="text-red-600 hover:text-red-800"
              >
                <X size={20} />
              </button>
            </div>
          )}
        </CustomCardBody>
      </CustomCard>

      {/* Payment Summary */}
      <CustomCard className="mb-6">
        <CustomCardBody>
          <h6 className="text-lg font-semibold text-gray-900 mb-4">
            {ciText("Payment Summary")}
          </h6>

          {/* Enhanced Payment Summary with Comprehensive Details */}
          {paymentData.totalPaymentAmount &&
            parseFloat(paymentData.totalPaymentAmount) > 0 && (
              <div className="mb-6">
                {/* Payment Amount vs Total Due Comparison */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h6 className="text-sm font-semibold text-blue-900 mb-2">
                      {ciText("Total Due")}
                    </h6>
                    <p className="text-lg font-bold text-blue-800">
                      {selectedBankAccount
                        ? `${calculatedTotalInBankCurrency.toFixed(2)} ${
                            paymentData.paymentCurrency
                          }`
                        : `${
                            paymentSummary?.totalRemaining?.toFixed(2) || "0.00"
                          } (raw total)`}
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      {selectedInvoices.length} invoice
                      {selectedInvoices.length !== 1 ? "s" : ""}
                    </p>
                  </div>

                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <h6 className="text-sm font-semibold text-green-900 mb-2">
                      {ciText("Payment Amount")}
                    </h6>
                    <p className="text-lg font-bold text-green-800">
                      {paymentData.totalPaymentAmount}{" "}
                      {paymentData.paymentCurrency}
                    </p>
                    <p className="text-xs text-green-600 mt-1">
                      {ciText("Customer payment")}
                    </p>
                  </div>

                  <div
                    className={`p-4 rounded-lg border ${
                      Math.abs(
                        parseFloat(paymentData.totalPaymentAmount) -
                          (selectedBankAccount
                            ? calculatedTotalInBankCurrency
                            : paymentSummary?.totalRemaining)
                      ) < 0.01
                        ? "bg-green-50 border-green-200"
                        : parseFloat(paymentData.totalPaymentAmount) >
                          (selectedBankAccount
                            ? calculatedTotalInBankCurrency
                            : paymentSummary?.totalRemaining)
                        ? "bg-orange-50 border-orange-200"
                        : "bg-yellow-50 border-yellow-200"
                    }`}
                  >
                    <h6
                      className={`text-sm font-semibold mb-2 ${
                        Math.abs(
                          parseFloat(paymentData.totalPaymentAmount) -
                            (selectedBankAccount
                              ? calculatedTotalInBankCurrency
                              : paymentSummary?.totalRemaining)
                        ) < 0.01
                          ? "text-green-900"
                          : parseFloat(paymentData.totalPaymentAmount) >
                            (selectedBankAccount
                              ? calculatedTotalInBankCurrency
                              : paymentSummary?.totalRemaining)
                          ? "text-orange-900"
                          : "text-yellow-900"
                      }`}
                    >
                      {Math.abs(
                        parseFloat(paymentData.totalPaymentAmount) -
                          (selectedBankAccount
                            ? calculatedTotalInBankCurrency
                            : paymentSummary?.totalRemaining)
                      ) < 0.01
                        ? "Exact Payment"
                        : parseFloat(paymentData.totalPaymentAmount) >
                          (selectedBankAccount
                            ? calculatedTotalInBankCurrency
                            : paymentSummary?.totalRemaining)
                        ? "Overpayment"
                        : "Underpayment"}
                    </h6>
                    <p
                      className={`text-lg font-bold ${
                        Math.abs(
                          parseFloat(paymentData.totalPaymentAmount) -
                            (selectedBankAccount
                              ? calculatedTotalInBankCurrency
                              : paymentSummary?.totalRemaining)
                        ) < 0.01
                          ? "text-green-800"
                          : parseFloat(paymentData.totalPaymentAmount) >
                            (selectedBankAccount
                              ? calculatedTotalInBankCurrency
                              : paymentSummary?.totalRemaining)
                          ? "text-orange-800"
                          : "text-yellow-800"
                      }`}
                    >
                      {Math.abs(
                        parseFloat(paymentData.totalPaymentAmount) -
                          (selectedBankAccount
                            ? calculatedTotalInBankCurrency
                            : paymentSummary?.totalRemaining)
                      ).toFixed(2)}{" "}
                      {paymentData.paymentCurrency}
                    </p>
                    <p
                      className={`text-xs mt-1 ${
                        Math.abs(
                          parseFloat(paymentData.totalPaymentAmount) -
                            (selectedBankAccount
                              ? calculatedTotalInBankCurrency
                              : paymentSummary?.totalRemaining)
                        ) < 0.01
                          ? "text-green-600"
                          : parseFloat(paymentData.totalPaymentAmount) >
                            (selectedBankAccount
                              ? calculatedTotalInBankCurrency
                              : paymentSummary?.totalRemaining)
                          ? "text-orange-600"
                          : "text-yellow-600"
                      }`}
                    >
                      {Math.abs(
                        parseFloat(paymentData.totalPaymentAmount) -
                          (selectedBankAccount
                            ? calculatedTotalInBankCurrency
                            : paymentSummary?.totalRemaining)
                      ) < 0.01
                        ? "Perfect match"
                        : parseFloat(paymentData.totalPaymentAmount) >
                          (selectedBankAccount
                            ? calculatedTotalInBankCurrency
                            : paymentSummary?.totalRemaining)
                        ? "Excess amount"
                        : "Remaining due"}
                    </p>
                  </div>
                </div>

                {/* Customer Payment History Summary */}
                {customerBalanceSummary && (
                  <div className="mb-6">
                    <h6 className="text-md font-semibold text-gray-900 mb-3">
                      {ciText("Customer Payment History")}
                    </h6>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      {/* Available Credits */}
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            <CheckCircle className="h-5 w-5 text-green-400" />
                          </div>
                          <div className="ml-3 flex-1">
                            <h3 className="text-sm font-medium text-green-800">
                              {ciText("Available Credits")}
                            </h3>
                            <div className="mt-1">
                              {/* Show available credits first */}
                              {customerBalanceSummary?.availableCredits
                                ?.length > 0 ? (
                                customerBalanceSummary.availableCredits.map(
                                  (credit, index) => (
                                    <div
                                      key={`credit-${index}`}
                                      className="text-sm text-green-700"
                                    >
                                      {credit.amount.toFixed(2)}{" "}
                                      {credit.currency}
                                    </div>
                                  )
                                )
                              ) : customerBalanceSummary?.overpayments?.length >
                                0 ? (
                                customerBalanceSummary.overpayments.map(
                                  (overpayment, index) => (
                                    <div
                                      key={`overpayment-${index}`}
                                      className="text-sm text-green-700"
                                    >
                                      {overpayment.amount.toFixed(2)}{" "}
                                      {overpayment.currency}
                                    </div>
                                  )
                                )
                              ) : (
                                <div className="text-sm text-green-700">
                                  {ciText("No available credits")}
                                </div>
                              )}
                            </div>
                          </div>
                          {/* Credit application buttons */}
                          {(customerBalanceSummary?.availableCredits?.length >
                            0 ||
                            customerBalanceSummary?.overpayments?.length >
                              0) && (
                            <div className="flex flex-col gap-2">
                              <button
                                type="button"
                                onClick={handleApplyCredits}
                                className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                              >
                                {ciText("Apply to Payment")}
                              </button>
                              <button
                                type="button"
                                onClick={handleDirectCreditApplication}
                                className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                              >
                                {ciText("Apply to Invoices")}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Underpayments */}
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            <AlertTriangle className="h-5 w-5 text-yellow-400" />
                          </div>
                          <div className="ml-3">
                            <h3 className="text-sm font-medium text-yellow-800">
                              {ciText("Outstanding Balances")}
                            </h3>
                            <div className="mt-1">
                              {customerBalanceSummary?.underpayments?.length >
                              0 ? (
                                customerBalanceSummary.underpayments.map(
                                  (underpayment, index) => (
                                    <div
                                      key={index}
                                      className="text-sm text-yellow-700"
                                    >
                                      {underpayment.amount.toFixed(2)}{" "}
                                      {underpayment.currency}
                                    </div>
                                  )
                                )
                              ) : (
                                <div className="text-sm text-yellow-700">
                                  {ciText("No underpayments")}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Total Summary */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            <Info className="h-5 w-5 text-blue-400" />
                          </div>
                          <div className="ml-3">
                            <h3 className="text-sm font-medium text-blue-800">
                              {ciText("Net Position")}
                            </h3>
                            <div className="mt-1 text-sm text-blue-700">
                              {(customerBalanceSummary?.netPosition || 0) >
                              0 ? (
                                <span className="text-green-600">
                                  +
                                  {(
                                    customerBalanceSummary?.netPosition || 0
                                  ).toFixed(2)}{" "}
                                  {customerBalanceSummary?.netPositionCurrency ||
                                    "USD"}
                                </span>
                              ) : (customerBalanceSummary?.netPosition || 0) <
                                0 ? (
                                <span className="text-red-600">
                                  {(
                                    customerBalanceSummary?.netPosition || 0
                                  ).toFixed(2)}{" "}
                                  {customerBalanceSummary?.netPositionCurrency ||
                                    "USD"}
                                </span>
                              ) : (
                                <span className="text-gray-600">{ciText("Balanced")}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Apply Credits Option */}
                    {customerBalanceSummary?.overpayments?.length > 0 && (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-sm font-medium text-gray-900">
                              {ciText("Apply Available Credits")}
                            </h4>
                            <p className="text-xs text-gray-600 mt-1">
                              Use customer overpayments to reduce current
                              payment amount
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleApplyCredits()}
                            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-[var(--p-blue)] hover:bg-[#9BC02E] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--p-blue)]"
                          >
                            <ArrowRightLeft className="h-4 w-4 mr-2" />
                            {ciText("Apply Credits")}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Detailed Invoice Allocation Summary */}
                <div className="mb-6">
                  <h6 className="text-md font-semibold text-gray-900 mb-3">
                    {ciText("Invoice Allocation Details")}
                  </h6>
                  <div className="space-y-3">
                    {selectedInvoices.map((invoice) => {
                      const remaining =
                        CustomerInvoiceServices.calculateRemainingAmount(
                          invoice
                        );
                      const conversionDetail =
                        invoiceConversionDetails[invoice._id];
                      const allocation = paymentAllocations[invoice._id];

                      // Use the allocation from state if available, otherwise calculate
                      const finalAllocation = allocation?.amount || 0;
                      const remainingAfterPayment =
                        allocation?.remainingAfterPayment || remaining;
                      const isFullyPaid = allocation?.isFullyPaid || false;
                      const isPartiallyPaid =
                        allocation?.isPartiallyPaid || false;
                      const isUnpaid =
                        allocation?.isUnpaid || finalAllocation === 0;

                      return (
                        <div
                          key={invoice._id}
                          className="p-4 border border-gray-200 rounded-lg bg-gray-50"
                        >
                          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                            {/* Invoice Info */}
                            <div>
                              <h6 className="font-semibold text-gray-900 text-sm">
                                {invoice.invoice_number}
                              </h6>
                              <p className="text-xs text-gray-600">
                                {invoice.customer_name}
                              </p>
                              <p className="text-xs text-gray-500">
                                Due:{" "}
                                {new Date(
                                  invoice.due_date
                                ).toLocaleDateString()}
                              </p>
                              {/* Payment Status Badge */}
                              <div className="mt-2">
                                {finalAllocation === 0 ? (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                    ✗ Unpaid
                                  </span>
                                ) : isFullyPaid ? (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    ✓ Fully Paid
                                  </span>
                                ) : isPartiallyPaid ? (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                    ⚠ Partially Paid
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                    ✗ Unpaid
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Original Remaining */}
                            <div>
                              <p className="text-xs text-gray-600 mb-1">
                                {ciText("Original Remaining")}
                              </p>
                              <p className="text-sm font-semibold text-gray-900">
                                {CustomerInvoiceServices.formatCurrency(
                                  remaining,
                                  invoice.currency
                                )}
                              </p>
                              {conversionDetail && (
                                <p className="text-xs text-blue-600">
                                  ={" "}
                                  {conversionDetail.convertedAmount.toFixed(2)}{" "}
                                  {paymentData.paymentCurrency}
                                </p>
                              )}
                            </div>

                            {/* Allocated Amount */}
                            <div>
                              <p className="text-xs text-gray-600 mb-1">
                                {ciText("Allocated Payment")}
                              </p>
                              <p className="text-sm font-semibold text-green-700">
                                {CustomerInvoiceServices.formatCurrency(
                                  finalAllocation,
                                  invoice.currency
                                )}
                              </p>
                              {conversionDetail && (
                                <p className="text-xs text-green-600">
                                  ={" "}
                                  {(
                                    finalAllocation *
                                    (conversionDetail.rate || 1)
                                  ).toFixed(2)}{" "}
                                  {paymentData.paymentCurrency}
                                </p>
                              )}
                            </div>

                            {/* Remaining After Payment */}
                            <div>
                              <p className="text-xs text-gray-600 mb-1">
                                {ciText("Remaining After Payment")}
                              </p>
                              <p
                                className={`text-sm font-semibold ${
                                  remainingAfterPayment > 0.01
                                    ? "text-yellow-700"
                                    : "text-green-700"
                                }`}
                              >
                                {CustomerInvoiceServices.formatCurrency(
                                  remainingAfterPayment,
                                  invoice.currency
                                )}
                              </p>
                              {conversionDetail && (
                                <p className="text-xs text-gray-500">
                                  ={" "}
                                  {(
                                    remainingAfterPayment *
                                    (conversionDetail.rate || 1)
                                  ).toFixed(2)}{" "}
                                  {paymentData.paymentCurrency}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Currency Conversion Details */}
                          {conversionDetail && conversionDetail.rate !== 1 && (
                            <div className="mt-3 p-2 bg-blue-50 rounded border border-blue-200">
                              <p className="text-xs text-blue-700">
                                <strong>{ciText("Currency Conversion:")}</strong>{" "}
                                {conversionDetail.displayText}
                              </p>
                            </div>
                          )}

                          {/* Underpayment Details for this specific invoice */}
                          {isPartiallyPaid && remainingAfterPayment > 0.01 && (
                            <div className="mt-3 p-3 bg-yellow-50 rounded border border-yellow-200">
                              <div className="flex items-start">
                                <div className="p-1 bg-yellow-100 rounded mr-2">
                                  <svg
                                    className="w-4 h-4 text-yellow-600"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth="2"
                                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                                    />
                                  </svg>
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-yellow-800 mb-1">
                                    Partial Payment for {invoice.invoice_number}
                                  </p>
                                  <p className="text-xs text-yellow-700">
                                    <strong>{ciText("Underpayment:")}</strong>{" "}
                                    {CustomerInvoiceServices.formatCurrency(
                                      remainingAfterPayment,
                                      invoice.currency
                                    )}{" "}
                                    in {invoice.currency}
                                  </p>
                                  {conversionDetail && (
                                    <p className="text-xs text-yellow-600">
                                      ={" "}
                                      {(
                                        remainingAfterPayment *
                                        (conversionDetail.rate || 1)
                                      ).toFixed(2)}{" "}
                                      {paymentData.paymentCurrency} (converted)
                                    </p>
                                  )}
                                  <p className="text-xs text-yellow-600 mt-1">
                                    This amount will remain due for future
                                    payments.
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Payment Scenario Analysis */}
                <div className="mb-6">
                  <h6 className="text-md font-semibold text-gray-900 mb-3">
                    {ciText("Payment Analysis")}
                  </h6>
                  {(() => {
                    const paymentAmount = parseFloat(
                      paymentData.totalPaymentAmount
                    );
                    const totalDue = selectedBankAccount
                      ? calculatedTotalInBankCurrency
                      : paymentSummary?.totalRemaining;

                    // Convert total due to payment currency for proper comparison
                    let totalDueInPaymentCurrency = totalDue;
                    if (
                      paymentData.paymentCurrency !==
                      selectedBankAccount?.currency
                    ) {
                      // Use conversion rates from currency objects for comparison
                      const bankCurrency = currencies.find(
                        (c) => c.symbol === selectedBankAccount?.currency
                      );
                      const paymentCurrency = currencies.find(
                        (c) => c.symbol === paymentData.paymentCurrency
                      );

                      if (bankCurrency && paymentCurrency) {
                        const conversionRate =
                          paymentCurrency.conversion_rate_to_base /
                          bankCurrency.conversion_rate_to_base;
                        totalDueInPaymentCurrency = totalDue * conversionRate;
                      }
                    }

                    const difference =
                      paymentAmount - totalDueInPaymentCurrency;
                    const customerCredit = calculateCustomerCredit();

                    if (difference > 0) {
                      // Overpayment scenario
                      return (
                        <div className="space-y-4">
                          <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                            <div className="flex items-start">
                              <div className="p-2 bg-orange-100 rounded-lg mr-3">
                                <svg
                                  className="w-5 h-5 text-orange-600"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                                  />
                                </svg>
                              </div>
                              <div>
                                <h6 className="font-semibold text-orange-900 mb-2">
                                  {ciText("Overpayment Detected")}
                                </h6>
                                <p className="text-sm text-orange-800 mb-3">
                                  {ciText(
                                    "The customer is paying {{amount}} {{currency}} more than the total due amount.",
                                    {
                                      amount: difference.toFixed(2),
                                      currency: paymentData.paymentCurrency,
                                    },
                                  )}
                                </p>
                                <div className="space-y-2">
                                  <p className="text-xs text-orange-700">
                                    • <strong>{ciText("Excess Amount:")}</strong>{" "}
                                    {difference.toFixed(2)}{" "}
                                    {paymentData.paymentCurrency}
                                  </p>
                                  <p className="text-xs text-orange-700">
                                    • <strong>{ciText("Action:")}</strong>{" "}
                                    {ciText(
                                      "The excess amount will be applied to future invoices for this customer",
                                    )}
                                  </p>
                                  <p className="text-xs text-orange-700">
                                    • <strong>{ciText("Customer Credit:")}</strong>{" "}
                                    {difference.toFixed(2)}{" "}
                                    {paymentData.paymentCurrency}{" "}
                                    {ciText(
                                      "will be available for future payments",
                                    )}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Customer Credit Details */}
                          {customerCredit && (
                            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                              <h6 className="font-semibold text-blue-900 mb-3">
                                {ciText("Customer Credit Details")}
                              </h6>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <p className="text-sm text-blue-800 mb-2">
                                    <strong>{ciText("Customer:")}</strong>{" "}
                                    {customerCredit.customerName}
                                  </p>
                                  <p className="text-sm text-blue-800 mb-2">
                                    <strong>{ciText("Credit Amount:")}</strong>{" "}
                                    {customerCredit.creditAmount.toFixed(2)}{" "}
                                    {customerCredit.creditCurrency}
                                  </p>
                                  <p className="text-sm text-blue-800 mb-2">
                                    <strong>{ciText("Payment Date:")}</strong>{" "}
                                    {new Date(
                                      customerCredit.paymentDate
                                    ).toLocaleDateString()}
                                  </p>
                                  {customerCredit.reference && (
                                    <p className="text-sm text-blue-800 mb-2">
                                      <strong>{ciText("Reference:")}</strong>{" "}
                                      {customerCredit.reference}
                                    </p>
                                  )}
                                </div>
                                <div>
                                  <p className="text-sm text-blue-800 mb-2">
                                    <strong>{ciText("Applied to Invoices:")}</strong>
                                  </p>
                                  <div className="text-xs text-blue-700 space-y-1">
                                    {customerCredit.appliedToInvoices.map(
                                      (invoiceNo, index) => (
                                        <div
                                          key={index}
                                          className="flex items-center"
                                        >
                                          <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
                                          {invoiceNo}
                                        </div>
                                      )
                                    )}
                                  </div>
                                  <p className="text-xs text-blue-600 mt-3">
                                    This credit will be automatically applied to
                                    future invoices for this customer.
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    } else if (difference < 0) {
                      // Underpayment scenario
                      return (
                        <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                          <div className="flex items-start">
                            <div className="p-2 bg-yellow-100 rounded-lg mr-3">
                              <svg
                                className="w-5 h-5 text-yellow-600"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                                />
                              </svg>
                            </div>
                            <div>
                              <h6 className="font-semibold text-yellow-900 mb-2">
                                {ciText("Partial Payment")}
                              </h6>
                              <p className="text-sm text-yellow-800 mb-3">
                                {ciText(
                                  "The customer is paying {{amount}} {{currency}} less than the total due amount.",
                                  {
                                    amount: Math.abs(difference).toFixed(2),
                                    currency: paymentData.paymentCurrency,
                                  },
                                )}
                              </p>
                              <div className="space-y-2">
                                <p className="text-xs text-yellow-700">
                                  • <strong>{ciText("Remaining Due:")}</strong>{" "}
                                  {Math.abs(difference).toFixed(2)}{" "}
                                  {paymentData.paymentCurrency}
                                </p>
                                <p className="text-xs text-yellow-700">
                                  • <strong>{ciText("Action:")}</strong>{" "}
                                  {ciText(
                                    "The remaining amount will be tracked for future payments",
                                  )}
                                </p>
                                <p className="text-xs text-yellow-700">
                                  • <strong>{ciText("Payment Status:")}</strong>{" "}
                                  {ciText(
                                    "Invoices will remain partially paid until full payment is received",
                                  )}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    } else {
                      // Exact payment scenario
                      return (
                        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                          <div className="flex items-start">
                            <div className="p-2 bg-green-100 rounded-lg mr-3">
                              <svg
                                className="w-5 h-5 text-green-600"
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
                            <div>
                              <h6 className="font-semibold text-green-900 mb-2">
                                {ciText("Exact Payment")}
                              </h6>
                              <p className="text-sm text-green-800 mb-3">
                                {ciText(
                                  "The payment amount exactly matches the total due amount.",
                                )}
                              </p>
                              <div className="space-y-2">
                                <p className="text-xs text-green-700">
                                  • <strong>{ciText("Payment Status:")}</strong>{" "}
                                  {ciText(
                                    "All selected invoices will be marked as fully paid",
                                  )}
                                </p>
                                <p className="text-xs text-green-700">
                                  • <strong>{ciText("Action:")}</strong>{" "}
                                  {ciText(
                                    "No additional tracking or credit needed",
                                  )}
                                </p>
                                <p className="text-xs text-green-700">
                                  • <strong>{ciText("Result:")}</strong>{" "}
                                  {ciText(
                                    "Clean payment settlement for all invoices",
                                  )}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }
                  })()}
                </div>

                {/* Currency Summary */}
                {selectedInvoices.some(
                  (inv) => inv.currency !== paymentData.paymentCurrency
                ) && (
                  <div className="mb-6">
                    <h6 className="text-md font-semibold text-gray-900 mb-3">
                      {ciText("Currency Conversion Summary")}
                    </h6>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <h6 className="text-sm font-semibold text-gray-700 mb-2">
                          {ciText("Original Currencies")}
                        </h6>
                        <div className="space-y-1">
                          {[
                            ...new Set(
                              selectedInvoices.map((inv) => inv.currency)
                            ),
                          ].map((currency) => {
                            const totalInCurrency = selectedInvoices
                              .filter((inv) => inv.currency === currency)
                              .reduce(
                                (sum, inv) =>
                                  sum +
                                  CustomerInvoiceServices.calculateRemainingAmount(
                                    inv
                                  ),
                                0
                              );
                            return (
                              <div
                                key={currency}
                                className="flex justify-between text-xs"
                              >
                                <span className="text-gray-600">
                                  {currency}:
                                </span>
                                <span className="font-medium">
                                  {totalInCurrency.toFixed(2)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <h6 className="text-sm font-semibold text-blue-700 mb-2">
                          Converted to {paymentData.paymentCurrency}
                        </h6>
                        <div className="space-y-1">
                          {Object.entries(invoiceConversionDetails).map(
                            ([invoiceId, detail]) => {
                              const invoice = selectedInvoices.find(
                                (inv) => inv._id === invoiceId
                              );
                              return (
                                <div
                                  key={invoiceId}
                                  className="flex justify-between text-xs"
                                >
                                  <span className="text-blue-600">
                                    {invoice?.invoice_number}:
                                  </span>
                                  <span className="font-medium">
                                    {detail.convertedAmount.toFixed(2)}{" "}
                                    {paymentData.paymentCurrency}
                                  </span>
                                </div>
                              );
                            }
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

          {/* Original Invoice Summary (simplified when payment amount is entered) */}
          {(!paymentData.totalPaymentAmount ||
            parseFloat(paymentData.totalPaymentAmount) === 0) && (
            <div className="space-y-4">
              {selectedInvoices.map((invoice) => {
                const remaining =
                  CustomerInvoiceServices.calculateRemainingAmount(invoice);
                const conversionDetail = invoiceConversionDetails[invoice._id];

                return (
                  <div
                    key={invoice._id}
                    className="p-4 border border-gray-200 rounded-lg bg-gray-50"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h6 className="font-semibold text-gray-900">
                          {invoice.invoice_number}
                        </h6>
                        <p className="text-sm text-gray-600">
                          {invoice.customer_name}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">
                          Remaining:{" "}
                          {CustomerInvoiceServices.formatCurrency(
                            remaining,
                            invoice.currency
                          )}
                        </p>
                        <p className="text-xs text-gray-500">
                          Currency: {invoice.currency}
                        </p>
                        {selectedBankAccount &&
                          (isLoadingConversion ? (
                            <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
                              <div className="flex items-center justify-center">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                                <p className="text-xs text-blue-700">
                                  {ciText("Converting...")}
                                </p>
                              </div>
                            </div>
                          ) : conversionDetail ? (
                            <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
                              <p className="text-xs text-blue-700 font-medium">
                                In {paymentData.paymentCurrency}:
                              </p>
                              <p className="text-sm text-blue-800 font-semibold">
                                {conversionDetail.convertedAmount.toFixed(2)}{" "}
                                {paymentData.paymentCurrency}
                              </p>
                              <p className="text-xs text-blue-600">
                                Rate: {conversionDetail.rate}
                              </p>
                            </div>
                          ) : null)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Payment Information */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">{ciText("Total Remaining:")}</p>
                <p className="text-lg font-semibold text-gray-900">
                  {selectedBankAccount
                    ? `${calculatedTotalInBankCurrency.toFixed(2)} ${
                        paymentData.paymentCurrency
                      }`
                    : `${
                        paymentSummary?.totalRemaining?.toFixed(2) || "0.00"
                      } (raw total)`}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">{ciText("Payment Amount:")}</p>
                <p className="text-lg font-bold text-[var(--p-blue)]">
                  {paymentData.totalPaymentAmount || "0.00"}{" "}
                  {paymentData.paymentCurrency}
                </p>
              </div>
            </div>

            {paymentData.totalPaymentAmount &&
              (selectedBankAccount
                ? calculatedTotalInBankCurrency
                : paymentSummary?.totalRemaining) && (
                <div
                  className={`mt-4 p-3 rounded-lg ${
                    Math.abs(
                      parseFloat(paymentData.totalPaymentAmount) -
                        (selectedBankAccount
                          ? calculatedTotalInBankCurrency
                          : paymentSummary?.totalRemaining)
                    ) < 0.01
                      ? "bg-green-50 border border-green-200"
                      : parseFloat(paymentData.totalPaymentAmount) >
                        (selectedBankAccount
                          ? calculatedTotalInBankCurrency
                          : paymentSummary?.totalRemaining)
                      ? "bg-orange-50 border border-orange-200"
                      : "bg-yellow-50 border border-yellow-200"
                  }`}
                >
                  <p
                    className={`text-sm ${
                      Math.abs(
                        parseFloat(paymentData.totalPaymentAmount) -
                          (selectedBankAccount
                            ? calculatedTotalInBankCurrency
                            : paymentSummary?.totalRemaining)
                      ) < 0.01
                        ? "text-green-700"
                        : parseFloat(paymentData.totalPaymentAmount) >
                          (selectedBankAccount
                            ? calculatedTotalInBankCurrency
                            : paymentSummary?.totalRemaining)
                        ? "text-orange-700"
                        : "text-yellow-700"
                    }`}
                  >
                    {Math.abs(
                      parseFloat(paymentData.totalPaymentAmount) -
                        (selectedBankAccount
                          ? calculatedTotalInBankCurrency
                          : paymentSummary?.totalRemaining)
                    ) < 0.01 ? (
                      <>
                        <span className="font-semibold">{ciText("Exact Payment:")}</span>{" "}
                        {ciText(
                          "The payment amount exactly matches the total remaining balance. All selected invoices will be fully settled.",
                        )}
                      </>
                    ) : parseFloat(paymentData.totalPaymentAmount) >
                      (selectedBankAccount
                        ? calculatedTotalInBankCurrency
                        : paymentSummary?.totalRemaining) ? (
                      <>
                        <span className="font-semibold">{ciText("Overpayment:")}</span>{" "}
                        {ciText(
                          "The payment amount exceeds the total remaining balance by {{amount}} {{currency}}. The excess amount will be applied to future invoices for this customer.",
                          {
                            amount: (
                              parseFloat(paymentData.totalPaymentAmount) -
                              (selectedBankAccount
                                ? calculatedTotalInBankCurrency
                                : paymentSummary?.totalRemaining)
                            ).toFixed(2),
                            currency: paymentData.paymentCurrency,
                          },
                        )}
                      </>
                    ) : (
                      <>
                        <span className="font-semibold">{ciText("Partial Payment:")}</span>{" "}
                        {ciText(
                          "The payment amount is {{amount}} {{currency}} less than the total remaining balance. The remaining amount will be tracked for future payments.",
                          {
                            amount: (
                              (selectedBankAccount
                                ? calculatedTotalInBankCurrency
                                : paymentSummary?.totalRemaining) -
                              parseFloat(paymentData.totalPaymentAmount)
                            ).toFixed(2),
                            currency: paymentData.paymentCurrency,
                          },
                        )}
                      </>
                    )}
                  </p>
                </div>
              )}
          </div>
        </CustomCardBody>
      </CustomCard>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <CustomAlert variant="danger" className="mb-6">
          <div className="flex items-start">
            <AlertTriangle size={20} className="mr-3 mt-0.5 text-red-600" />
            <div>
              <strong className="font-semibold">
                {ciText("Please fix the following issues:")}
              </strong>
              <ul className="mt-2 space-y-1">
                {validationErrors.map((error, index) => (
                  <li key={index} className="text-sm">
                    {error}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CustomAlert>
      )}
    </div>
  );

  // Processing step
  const renderProcessingStep = () => (
    <div className="text-center py-12">
      <div className="mb-6">
        <Loader
          className="animate-spin text-[var(--p-blue)] mx-auto"
          size={48}
        />
      </div>
      <h4 className="text-xl font-semibold text-[var(--p-blue)] mb-4">
        {ciText("Recording Payment")}
      </h4>
      <p className="text-gray-600 mb-8">
        {ciText("Please wait while we record the payment for selected invoices...")}
      </p>

      <CustomCard>
        <CustomCardBody>
          <div className="flex items-center justify-center space-x-4">
            <div className="flex items-center px-3 py-2 bg-gray-100 rounded-lg">
              <FileText size={16} className="mr-2 text-gray-600" />
              <span className="text-sm">
                {selectedInvoices.length} Invoices
              </span>
            </div>
            <ArrowRight className="text-gray-400" size={20} />
            <div className="flex items-center px-3 py-2 bg-yellow-100 rounded-lg">
              <Loader size={16} className="mr-2 animate-spin text-yellow-600" />
              <span className="text-sm">{ciText("Processing")}</span>
            </div>
            <ArrowRight className="text-gray-400" size={20} />
            <div className="flex items-center px-3 py-2 bg-gray-100 rounded-lg">
              <CheckCircle size={16} className="mr-2 text-gray-600" />
              <span className="text-sm">{ciText("Completion")}</span>
            </div>
          </div>

          <div className="mt-6">
            <CustomProgress value={75} className="mb-3 h-3" />
            <p className="text-sm text-gray-500">
              {ciText("Recording payments and updating invoice statuses...")}
            </p>
          </div>
        </CustomCardBody>
      </CustomCard>
    </div>
  );

  // Results step
  const renderResultsStep = () => {
    const successful = processingResults?.data?.successful || [];
    const failed = processingResults?.data?.failed || [];

    return (
      <div>
        <div className="flex items-center mb-6">
          {failed.length > 0 && successful.length === 0 ? (
            <>
              <AlertCircle className="text-red-500 mr-3" size={24} />
              <h4 className="text-xl font-semibold text-red-500 mb-0">
                {ciText("Payment Recording Failed")}
              </h4>
            </>
          ) : failed.length > 0 && successful.length > 0 ? (
            <>
              <AlertTriangle className="text-orange-500 mr-3" size={24} />
              <h4 className="text-xl font-semibold text-orange-500 mb-0">
                {ciText("Payment Recording Partially Complete")}
              </h4>
            </>
          ) : (
            <>
              <CheckCircle className="text-[var(--p-blue)] mr-3" size={24} />
              <h4 className="text-xl font-semibold text-[var(--p-blue)] mb-0">
                {ciText("Payment Recording Complete")}
              </h4>
            </>
          )}
        </div>

        {successful.length > 0 && (
          <CustomAlert variant="success" className="mb-6">
            <div className="flex items-center">
              <CheckCircle size={24} className="mr-4 text-[var(--p-blue)]" />
              <div>
                <h5 className="text-lg font-semibold mb-2">
                  {ciText("Bulk Payment Processed Successfully!")}
                </h5>
                <p className="mb-0">
                  Payment of {paymentData.paymentCurrency}{" "}
                  {paymentData.totalPaymentAmount} has been allocated across{" "}
                  {successful.length} invoice(s). Invoice statuses and bank
                  account balances have been updated accordingly.
                </p>
              </div>
            </div>
          </CustomAlert>
        )}

        {/* Allocation Details */}
        {processingResults?.data?.allocationDetails &&
          processingResults.data.allocationDetails.length > 0 && (
            <CustomCard className="mb-6">
              <CustomCardBody>
                <h6 className="text-lg font-semibold text-gray-900 mb-4">
                  {ciText("Payment Allocation Details")}
                </h6>
                <div className="space-y-3">
                  {processingResults.data.allocationDetails.map(
                    (detail, index) => (
                      <div
                        key={index}
                        className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-gray-900">
                            {detail.invoiceNumber}
                          </p>
                          <p className="text-sm text-gray-600">
                            Allocated:{" "}
                            {detail.originalPaymentAmount?.toFixed(2)}{" "}
                            {detail.paymentCurrency}
                            {detail.allocatedAmountInInvoiceCurrency &&
                              detail.paymentCurrency !==
                                detail.invoiceCurrency && (
                                <span className="text-gray-500">
                                  {" "}
                                  (={" "}
                                  {detail.allocatedAmountInInvoiceCurrency?.toFixed(
                                    2
                                  )}{" "}
                                  {detail.invoiceCurrency})
                                </span>
                              )}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600">
                            Remaining:{" "}
                            {detail.remainingAfterPayment?.toFixed(2)}{" "}
                            {detail.invoiceCurrency}
                          </p>
                          {detail.overpaymentAmount > 0 && (
                            <p className="text-sm text-green-600">
                              Overpayment:{" "}
                              {detail.overpaymentAmount?.toFixed(2)}{" "}
                              {detail.paymentCurrency}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  )}
                </div>
              </CustomCardBody>
            </CustomCard>
          )}

        {failed.length > 0 && (
          <CustomAlert variant="danger" className="mb-6">
            <div className="flex items-center">
              <AlertCircle size={24} className="mr-4 text-red-500" />
              <div>
                <h5 className="text-lg font-semibold mb-2">
                  {failed.length} Payment(s) Failed
                </h5>
                <div className="space-y-2">
                  {failed.map((failure, index) => (
                    <p key={index} className="text-sm mb-1">
                      <strong>Invoice {failure.invoiceNumber}:</strong>{" "}
                      {failure.error}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </CustomAlert>
        )}

        {successful.length === 0 && failed.length === 0 && (
          <CustomAlert variant="info" className="mb-6">
            <div className="text-sm">{ciText("No payments were processed.")}</div>
          </CustomAlert>
        )}
      </div>
    );
  };

  // Current step renderer
  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return renderReviewStep();
      case 2:
        return renderPaymentDetailsStep();
      case 3:
        return renderProcessingStep();
      case 4:
        return renderResultsStep();
      default:
        return renderReviewStep();
    }
  };

  // Footer buttons
  const renderFooterButtons = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="flex justify-between w-full">
            <CustomButton variant="light" onClick={handleClose}>
              <X size={16} className="mr-2" />
              {ciText("Cancel")}
            </CustomButton>
            <CustomButton
              variant="primary"
              onClick={() => setCurrentStep(2)}
              disabled={hasMultipleCustomers()}
            >
              {hasMultipleCustomers()
                ? "Multiple Customers Selected"
                : "Continue to Payment Details"}
              <ArrowRight size={16} className="ml-2" />
            </CustomButton>
          </div>
        );
      case 2:
        return (
          <div className="flex justify-between w-full">
            <CustomButton variant="light" onClick={() => setCurrentStep(1)}>
              <ArrowRight size={16} className="mr-2 rotate-180" />
              {ciText("Back")}
            </CustomButton>
            <CustomButton
              variant="success"
              onClick={() => {
                if (validateConfiguration()) {
                  handleProcessPayment();
                }
              }}
              disabled={
                loading || validationErrors.length > 0 || hasMultipleCustomers()
              }
            >
              <CheckCircle size={16} className="mr-2" />
              {loading
                ? "Processing..."
                : hasMultipleCustomers()
                ? "Multiple Customers Selected"
                : "Record Payment"}
            </CustomButton>
          </div>
        );
      case 3:
        return null;
      case 4:
        return (
          <div className="w-full text-center">
            <CustomButton variant="primary" size="lg" onClick={handleClose}>
              <CheckCircle size={16} className="mr-2" />
              {ciText("Close")}
            </CustomButton>
          </div>
        );
      default:
        return null;
    }
  };

  // Fetch customer payment history data
  const fetchCustomerPaymentHistory = useCallback(async () => {
    if (!selectedInvoices.length) return;

    try {
      const customerId = selectedInvoices[0]?.customer_id?._id;
      const businessId = selectedInvoices[0]?.business;

      if (!customerId || !businessId) return;

      // Fetch customer payment history
      const historyResponse =
        await CustomerPaymentHistoryServices.getCustomerPaymentHistory(
          customerId,
          businessId
        );
      setCustomerPaymentHistory(historyResponse.data);

      // Fetch customer balance summary
      const balanceResponse =
        await CustomerPaymentHistoryServices.getCustomerBalanceSummary(
          customerId,
          businessId
        );
      setCustomerBalanceSummary(balanceResponse.data);

      // Fetch customer credit balance
      const creditResponse =
        await CustomerPaymentHistoryServices.getCustomerCreditBalance(
          customerId,
          businessId,
          paymentData.paymentCurrency
        );
      setCustomerCreditBalance(creditResponse.data);
    } catch (error) {
      console.error("Error fetching customer payment history:", error);
      // Don't show error to user as this is optional data
    }
  }, [selectedInvoices, paymentData.paymentCurrency]);

  // Fetch customer payment history when invoices are selected
  useEffect(() => {
    if (selectedInvoices.length > 0) {
      fetchCustomerPaymentHistory();
    }
  }, [selectedInvoices, fetchCustomerPaymentHistory]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleClose}
      />

      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-6xl bg-white rounded-2xl shadow-2xl transform transition-all">
          {/* Header */}
          <div className="bg-gradient-to-r from-[var(--p-blue)] to-[#9CBA33] px-8 py-6 rounded-t-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <DollarSign size={24} className="text-white mr-3" />
                <h2 className="text-xl font-bold text-white">
                  {ciText("Record Customer Payments")}
                </h2>
                <div className="ml-4 px-2 py-1 bg-white bg-opacity-20 rounded-full text-sm font-medium text-white">
                  {selectedInvoices.length} Invoices
                </div>
              </div>
              <button
                onClick={handleClose}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="px-8 py-6 bg-gray-50 min-h-96">
            {renderStepIndicator()}
            {renderCurrentStep()}
          </div>

          {/* Footer */}
          {currentStep !== 3 && (
            <div className="px-8 py-6 bg-gray-50 rounded-b-2xl border-t border-gray-200">
              {renderFooterButtons()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BulkPaymentRecordModal;
