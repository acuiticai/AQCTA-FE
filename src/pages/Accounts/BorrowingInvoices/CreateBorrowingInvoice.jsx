import React, { useState, useEffect, useRef, useContext } from "react";
import {
  ChevronDown,
  Calendar,
  X,
  Upload,
  Plus,
  ArrowLeft,
  DollarSign,
  Package,
  FileText,
  Eye,
  Trash2,
  Users,
  Receipt,
  Building,
  PiggyBank,
  Calculator,
  Percent,
  Clock,
  MoreHorizontal,
  Target,
} from "lucide-react";
import axios from "axios";
import { useHistory } from "react-router-dom";
import { notifyError, notifySuccess } from "@/utils/toast";
import { AdminContext } from "@/context/AdminContext";
import CustomDatePicker from "@/components/CustomDatePicker";
import { formatAmount } from "@/components/formatAmount";

const CreateBorrowingInvoice = () => {
  const history = useHistory();
  const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);

  const [currencies, setCurrencies] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [lenders, setLenders] = useState([]);

  // Form data state
  const [borrowingData, setBorrowingData] = useState({
    business: "",
    lender: "",
    borrowingType: "bank_loan",
    principalAmount: 0,
    currency: "USD",
    interestRate: 0,
    termMonths: 12,
    paymentFrequency: "monthly",
    maturityDate: formatDateForInput(
      new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    ), // Default to 1 year from now
    purpose: "",
    collateral: "",
    terms: "",
    notes: "",
    supportingDocuments: [],
    status: "Applied",
  });

  const [formErrors, setFormErrors] = useState({});
  const [calculatedPayment, setCalculatedPayment] = useState(0);

  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo.token}`,
  };

  // Format date for input fields
  function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  useEffect(() => {
    fetchData();
  }, [borrowingData.business]);

  useEffect(() => {
    const fetchCurrencies = async () => {
      if (!borrowingData.business || !adminInfo?.token) return;

      // Extract business ID properly (handle both string ID and populated object)
      const businessId =
        typeof borrowingData.business === "object"
          ? borrowingData.business._id || borrowingData.business.id
          : borrowingData.business;

      if (!businessId || businessId === "") return;

      try {
        const response = await axios.get(
          `${Base_URL}/finance/currencies?business_id=${businessId}`,
          {
            headers: {
              authorization: `Bearer ${adminInfo.token}`,
            },
          }
        );
        setCurrencies(response.data.data || []);
      } catch (error) {
        console.error("Error fetching currencies:", error);
      }
    };

    // Only fetch currencies if we have a valid business ID and it's not the initial empty state
    if (borrowingData.business && borrowingData.business !== "") {
      fetchCurrencies();
    }
  }, [borrowingData.business, adminInfo?.token]);

  const currencyOptions = currencies.map((currency) => ({
    value: currency.symbol,
    label: `${currency.symbol} (${currency.prefix})`,
    conversionRate: currency.conversion_rate_to_base,
  }));

  // Calculate monthly payment when key fields change
  useEffect(() => {
    if (
      borrowingData.principalAmount > 0 &&
      borrowingData.interestRate >= 0 &&
      borrowingData.termMonths > 0
    ) {
      const principal = parseFloat(borrowingData.principalAmount);
      const annualRate = parseFloat(borrowingData.interestRate) / 100;
      const monthlyRate = annualRate / 12;
      const numPayments = parseInt(borrowingData.termMonths);

      let monthlyPayment;
      if (monthlyRate > 0) {
        monthlyPayment =
          (principal * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
          (Math.pow(1 + monthlyRate, numPayments) - 1);
      } else {
        monthlyPayment = principal / numPayments;
      }

      setCalculatedPayment(monthlyPayment);
    } else {
      setCalculatedPayment(0);
    }
  }, [
    borrowingData.principalAmount,
    borrowingData.interestRate,
    borrowingData.termMonths,
  ]);

  const fetchData = async () => {
    if (borrowingData.business) {
      setIsLoadingData(true);
    }

    try {
      // Fetch businesses
      const storedBusinesses = localStorage.getItem("businesses");
      if (storedBusinesses) {
        setBusinesses(JSON.parse(storedBusinesses));
      }

      // Only fetch business-specific data if business is selected
      if (borrowingData.business) {
        // Extract business ID properly (handle both string ID and populated object)
        const businessId =
          typeof borrowingData.business === "object"
            ? borrowingData.business._id || borrowingData.business.id
            : borrowingData.business;

        if (!businessId || businessId === "") return;

        // Fetch lenders (using vendor endpoint)
        const lendersRes = await axios.get(
          `${Base_URL}/vendors/all/${businessId}`,
          { headers }
        );
        setLenders(lendersRes.data.data || []);
      } else {
        // Clear data when no business is selected
        setLenders([]);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
      notifyError("Failed to load data");
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    // If business is changing, clear dependent fields
    if (name === "business") {
      setBorrowingData((prev) => ({
        ...prev,
        [name]: value,
        lender: "",
      }));
    } else {
      setBorrowingData((prev) => ({ ...prev, [name]: value }));
    }

    // Clear form errors when user starts typing
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validateForm = () => {
    const errors = {};

    if (!borrowingData.business) errors.business = "Business is required";
    if (!borrowingData.lender) errors.lender = "Lender is required";
    if (!borrowingData.borrowingType)
      errors.borrowingType = "Borrowing type is required";
    if (!borrowingData.principalAmount || borrowingData.principalAmount <= 0)
      errors.principalAmount = "Principal amount must be greater than 0";
    if (!borrowingData.currency) errors.currency = "Currency is required";
    if (
      borrowingData.interestRate === undefined ||
      borrowingData.interestRate < 0
    )
      errors.interestRate = "Interest rate must be 0 or greater";
    if (!borrowingData.termMonths || borrowingData.termMonths <= 0)
      errors.termMonths = "Term must be greater than 0 months";
    if (!borrowingData.maturityDate)
      errors.maturityDate = "Maturity date is required";
    if (!borrowingData.purpose.trim()) errors.purpose = "Purpose is required";

    return errors;
  };

  const handleSubmit = async (status) => {
    const errors = validateForm();
    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      notifyError("Please fix the errors before submitting");
      return;
    }

    setIsLoading(true);

    try {
      const borrowingDataToSubmit = {
        ...borrowingData,
        status: status,
        maturityDate: new Date(borrowingData.maturityDate),
        principalAmount: parseFloat(borrowingData.principalAmount),
        interestRate: parseFloat(borrowingData.interestRate),
        termMonths: parseInt(borrowingData.termMonths),
      };

      console.log("💾 Submitting borrowing data:", borrowingDataToSubmit);

      const response = await axios.post(
        `${Base_URL}/borrowing-invoices`,
        borrowingDataToSubmit,
        { headers }
      );

      console.log("response", response);

      if (response.data.success) {
        notifySuccess("Borrowing invoice created successfully!");
        history.push("/borrowing-invoices");
      } else notifyError("Failed to create borrowing invoice");
    } catch (error) {
      console.error("Error creating borrowing invoice:", error);
      notifyError(
        error.response?.data?.error || "Failed to create borrowing invoice"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      notifyError("Please upload only JPEG, PNG, or PDF files");
      return;
    }

    // Validate file size (5MB limit)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      notifyError("File size must be less than 5MB");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadSuccess(false);

    try {
      const formDataForUpload = new FormData();
      formDataForUpload.append(
        "file_path",
        `BorrowingInvoices/${borrowingData.borrowingNumber || Date.now()}`
      );
      formDataForUpload.append("business_id", borrowingData?.business);
      formDataForUpload.append("customer_id", adminInfo?.id);
      formDataForUpload.append("file_type", file.type);
      formDataForUpload.append("file_size", file.size);
      formDataForUpload.append("file", file);

      const response = await axios.post(
        `${Base_URL}/documents/uploadDocument`,
        formDataForUpload,
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

      if (response.data.message === "File uploaded successfully") {
        const uploadedFile = response.data.file;

        const newDocument = {
          fileId: uploadedFile._id,
          name: uploadedFile.name,
          url: uploadedFile.url || "#",
          downloadUrl: uploadedFile.downloadUrl || "#",
          uploadedAt: new Date().toISOString(),
          size: file.size,
          type: file.type,
          documentType: "Application",
        };

        setBorrowingData((prev) => ({
          ...prev,
          supportingDocuments: [...prev.supportingDocuments, newDocument],
        }));

        setSuccessMessage(
          response.data.message || "File uploaded successfully!"
        );
        setUploadSuccess(true);

        setTimeout(() => {
          setUploadSuccess(false);
          setSuccessMessage("");
        }, 3000);
      }
    } catch (error) {
      console.error("File upload error:", error);
      notifyError("File upload failed. Please try again.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleOpenFile = async (documentId) => {
    if (!documentId) return;

    try {
      const response = await axios.get(
        `${Base_URL}/documents/getFileWithAllData/${documentId}`
      );
      window.open(response.data.data.url, "_blank");
    } catch (error) {
      notifyError("Error opening file");
      console.error("Error: ", error);
    }
  };

  const handleRemoveDocument = (index) => {
    setBorrowingData((prev) => ({
      ...prev,
      supportingDocuments: prev.supportingDocuments.filter(
        (_, i) => i !== index
      ),
    }));
    notifySuccess("Document removed successfully");
  };

  return (
    <div className="p-6 bg-gray-50 h-full max-h-[90vh] overflow-y-auto pb-[120px]">
      {/* Header */}
      <div className="mb-6">
        <button
          className="flex items-center text-gray-600 hover:text-gray-800"
          onClick={() => history.goBack()}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </button>
      </div>

      <h1 className="text-2xl font-semibold mb-6 text-gray-800">
        Create New Borrowing Invoice
      </h1>

      {/* Borrowing Type Selection */}
      <div className="bg-white p-6 rounded-lg mb-6 shadow-sm">
        <h2 className="text-lg font-medium mb-4 text-gray-800">
          Borrowing Type
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            {
              value: "bank_loan",
              label: "Bank Loan",
              icon: PiggyBank,
              color: "blue",
            },
            {
              value: "line_of_credit",
              label: "Line of Credit",
              icon: Receipt,
              color: "green",
            },
            {
              value: "equipment_financing",
              label: "Equipment Financing",
              icon: Package,
              color: "purple",
            },
            {
              value: "working_capital",
              label: "Working Capital",
              icon: DollarSign,
              color: "orange",
            },
          ].map((type) => {
            const IconComponent = type.icon;
            return (
              <button
                key={type.value}
                type="button"
                onClick={() =>
                  setBorrowingData((prev) => ({
                    ...prev,
                    borrowingType: type.value,
                  }))
                }
                className={`p-6 rounded-lg border-2 transition-all text-left ${
                  borrowingData.borrowingType === type.value
                    ? "border-[var(--p-blue)] bg-[#f0fbf7]"
                    : "border-gray-300 bg-white hover:border-gray-400"
                }`}
              >
                <div className="flex items-center mb-3">
                  <IconComponent
                    size={24}
                    className={
                      borrowingData.borrowingType === type.value
                        ? "text-[var(--p-blue)]"
                        : "text-gray-600"
                    }
                  />
                  <span
                    className={`ml-3 text-lg font-medium ${
                      borrowingData.borrowingType === type.value
                        ? "text-[var(--p-blue)]"
                        : "text-gray-800"
                    }`}
                  >
                    {type.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Additional types row */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-4">
          {[
            {
              value: "invoice_factoring",
              label: "Invoice Factoring",
              icon: FileText,
              color: "cyan",
            },
            {
              value: "merchant_cash_advance",
              label: "Merchant Cash Advance",
              icon: Calculator,
              color: "pink",
            },
            {
              value: "personal_guarantee",
              label: "Personal Guarantee",
              icon: Users,
              color: "indigo",
            },
            {
              value: "trade_credit",
              label: "Trade Credit",
              icon: Building,
              color: "teal",
            },
            {
              value: "others",
              label: "Others",
              icon: MoreHorizontal,
              color: "gray",
            },
          ].map((type) => {
            const IconComponent = type.icon;
            return (
              <button
                key={type.value}
                type="button"
                onClick={() =>
                  setBorrowingData((prev) => ({
                    ...prev,
                    borrowingType: type.value,
                  }))
                }
                className={`p-6 rounded-lg border-2 transition-all text-left ${
                  borrowingData.borrowingType === type.value
                    ? "border-[var(--p-blue)] bg-[#f0fbf7]"
                    : "border-gray-300 bg-white hover:border-gray-400"
                }`}
              >
                <div className="flex items-center mb-3">
                  <IconComponent
                    size={24}
                    className={
                      borrowingData.borrowingType === type.value
                        ? "text-[var(--p-blue)]"
                        : "text-gray-600"
                    }
                  />
                  <span
                    className={`ml-3 text-lg font-medium ${
                      borrowingData.borrowingType === type.value
                        ? "text-[var(--p-blue)]"
                        : "text-gray-800"
                    }`}
                  >
                    {type.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Business & Lender Section */}
      <div className="bg-[#f0fbf7] p-6 rounded-lg mb-6">
        <h2 className="text-lg font-medium mb-4 text-gray-800 flex items-center gap-2">
          Business & Lender Information
          {isLoadingData && (
            <div className="flex items-center gap-2 text-sm text-[var(--p-blue)]">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--p-blue)]"></div>
              Loading data...
            </div>
          )}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-700 mb-2">Business *</label>
            <div className="relative">
              <select
                name="business"
                value={borrowingData.business}
                onChange={handleInputChange}
                className="w-full p-3 border border-gray-300 rounded-lg appearance-none pr-10 focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] bg-white"
              >
                <option value="">Select Business</option>
                {businesses?.map((business) => (
                  <option key={business._id} value={business._id}>
                    {business.name}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                <ChevronDown className="h-5 w-5 text-gray-400" />
              </div>
            </div>
            {formErrors.business && (
              <div className="text-red-500 text-xs mt-1">
                {formErrors.business}
              </div>
            )}
          </div>

          <div>
            <label className="block text-gray-700 mb-2">
              Lender (Bank/Institution) *
            </label>
            <div className="relative">
              <select
                name="lender"
                value={borrowingData.lender}
                onChange={handleInputChange}
                disabled={isLoadingData || !borrowingData.business}
                className="w-full p-3 border border-gray-300 rounded-lg appearance-none pr-10 focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">
                  {isLoadingData
                    ? "Loading lenders..."
                    : !borrowingData.business
                    ? "Select business first"
                    : "Select Lender"}
                </option>
                {!isLoadingData &&
                  lenders?.map((lender) => (
                    <option key={lender._id} value={lender._id}>
                      {lender.basicInformation?.vendorDisplayName ||
                        lender.name}
                    </option>
                  ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                {isLoadingData ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--p-blue)]"></div>
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                )}
              </div>
            </div>
            {formErrors.lender && (
              <div className="text-red-500 text-xs mt-1">
                {formErrors.lender}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Loan Details */}
      <div className="bg-white p-6 rounded-lg mb-6 shadow-sm">
        <h2 className="text-lg font-medium mb-4 text-gray-800">Loan Details</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-gray-700 mb-2">
              Principal Amount *
            </label>
            <input
              type="number"
              name="principalAmount"
              value={borrowingData.principalAmount}
              onChange={handleInputChange}
              placeholder="0.00"
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
              step="0.01"
              min="0"
            />
            {formErrors.principalAmount && (
              <div className="text-red-500 text-xs mt-1">
                {formErrors.principalAmount}
              </div>
            )}
          </div>

          <div>
            <label className="block text-gray-700 mb-2">Currency *</label>
            <div className="relative">
              <select
                name="currency"
                value={borrowingData.currency}
                onChange={handleInputChange}
                className="w-full p-3 border border-gray-300 rounded-lg appearance-none pr-10 focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] bg-white"
              >
                {currencyOptions.length > 0 ? (
                  currencyOptions.map((currency, index) => (
                    <option key={index} value={currency.value}>
                      {currency.label}
                    </option>
                  ))
                ) : (
                  <option value="USD">USD ($)</option>
                )}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                <ChevronDown className="h-5 w-5 text-gray-400" />
              </div>
            </div>
            {formErrors.currency && (
              <div className="text-red-500 text-xs mt-1">
                {formErrors.currency}
              </div>
            )}
          </div>

          <div>
            <label className="block text-gray-700 mb-2">
              Interest Rate (% annually) *
            </label>
            <div className="relative">
              <input
                type="number"
                name="interestRate"
                value={borrowingData.interestRate}
                onChange={handleInputChange}
                placeholder="0.00"
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
                step="0.01"
                min="0"
                max="100"
              />
              <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                <Percent className="h-5 w-5 text-gray-400" />
              </div>
            </div>
            {formErrors.interestRate && (
              <div className="text-red-500 text-xs mt-1">
                {formErrors.interestRate}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-gray-700 mb-2">Term (Months) *</label>
            <div className="relative">
              <input
                type="number"
                name="termMonths"
                value={borrowingData.termMonths}
                onChange={handleInputChange}
                placeholder="12"
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
                min="1"
              />
              <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                <Clock className="h-5 w-5 text-gray-400" />
              </div>
            </div>
            {formErrors.termMonths && (
              <div className="text-red-500 text-xs mt-1">
                {formErrors.termMonths}
              </div>
            )}
          </div>

          <div>
            <label className="block text-gray-700 mb-2">
              Payment Frequency
            </label>
            <div className="relative">
              <select
                name="paymentFrequency"
                value={borrowingData.paymentFrequency}
                onChange={handleInputChange}
                className="w-full p-3 border border-gray-300 rounded-lg appearance-none pr-10 focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] bg-white"
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="semi_annually">Semi-Annually</option>
                <option value="annually">Annually</option>
                <option value="on_demand">On Demand</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                <ChevronDown className="h-5 w-5 text-gray-400" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-gray-700 mb-2">Maturity Date *</label>
            <div className="relative">
              <CustomDatePicker
                value={borrowingData.maturityDate}
                onChange={(date) =>
                  setBorrowingData({ ...borrowingData, maturityDate: date })
                }
                bgColor="#FFFFFF"
              />
              <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                <Calendar className="h-5 w-5 text-gray-400" />
              </div>
            </div>
            {formErrors.maturityDate && (
              <div className="text-red-500 text-xs mt-1">
                {formErrors.maturityDate}
              </div>
            )}
          </div>
        </div>

        {/* Payment Calculator */}
        {calculatedPayment > 0 && (
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="flex items-center mb-2">
              <Calculator className="h-5 w-5 text-blue-600 mr-2" />
              <h3 className="text-sm font-semibold text-blue-800">
                Estimated Monthly Payment
              </h3>
            </div>
            <p className="text-lg font-bold text-blue-900">
              {borrowingData.currency} {formatAmount(calculatedPayment)}
            </p>
            <p className="text-xs text-blue-600">
              Based on {borrowingData.interestRate}% annual interest over{" "}
              {borrowingData.termMonths} months
            </p>
          </div>
        )}
      </div>

      {/* Purpose & Additional Details */}
      <div className="bg-white p-6 rounded-lg mb-6 shadow-sm">
        <h2 className="text-lg font-medium mb-4 text-gray-800">
          Purpose & Additional Details
        </h2>

        <div className="grid grid-cols-1 gap-4 mb-4">
          <div>
            <label className="block text-gray-700 mb-2">
              Purpose of Borrowing *
            </label>
            <textarea
              name="purpose"
              value={borrowingData.purpose}
              onChange={handleInputChange}
              placeholder="Describe the purpose of this loan (e.g., business expansion, equipment purchase, working capital)"
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] resize-none"
              rows="3"
            />
            {formErrors.purpose && (
              <div className="text-red-500 text-xs mt-1">
                {formErrors.purpose}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-700 mb-2">
              Collateral (if any)
            </label>
            <textarea
              name="collateral"
              value={borrowingData.collateral}
              onChange={handleInputChange}
              placeholder="Describe any collateral securing this loan"
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] resize-none"
              rows="3"
            />
          </div>

          <div>
            <label className="block text-gray-700 mb-2">Notes</label>
            <textarea
              name="notes"
              value={borrowingData.notes}
              onChange={handleInputChange}
              placeholder="Additional notes or comments"
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] resize-none"
              rows="3"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-gray-700 mb-2">Terms & Conditions</label>
          <textarea
            name="terms"
            value={borrowingData.terms}
            onChange={handleInputChange}
            placeholder="Enter loan terms and conditions"
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] resize-none"
            rows="3"
          />
        </div>
      </div>

      {/* Supporting Documents */}
      <div className="bg-white p-6 rounded-lg mb-6 shadow-sm">
        <h2 className="text-lg font-medium mb-4 text-gray-800">
          Supporting Documents
        </h2>

        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
          {borrowingData.supportingDocuments.length > 0 ? (
            <div className="space-y-3">
              {borrowingData.supportingDocuments.map((doc, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between bg-gray-50 p-3 rounded-lg"
                >
                  <div className="flex items-center">
                    <FileText className="h-6 w-6 text-[var(--p-blue)] mr-3" />
                    <div>
                      <p className="font-medium text-gray-800">{doc.name}</p>
                      <p className="text-sm text-gray-500">
                        {(doc.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleOpenFile(doc.fileId)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => handleRemoveDocument(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center">
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <div className="mt-4">
                <label htmlFor="file-upload" className="cursor-pointer">
                  <span className="mt-2 block text-sm font-medium text-gray-900">
                    Upload supporting documents
                  </span>
                  <span className="text-sm text-gray-500">
                    PDF, PNG, JPG up to 5MB
                  </span>
                </label>
                <input
                  id="file-upload"
                  name="file-upload"
                  type="file"
                  className="sr-only"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleFileChange}
                  ref={fileInputRef}
                />
              </div>
            </div>
          )}

          {borrowingData.supportingDocuments.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <label
                htmlFor="additional-file-upload"
                className="cursor-pointer"
              >
                <span className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                  <Upload className="mr-2 h-4 w-4" />
                  Add More Documents
                </span>
              </label>
              <input
                id="additional-file-upload"
                name="additional-file-upload"
                type="file"
                className="sr-only"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleFileChange}
              />
            </div>
          )}

          {uploading && (
            <div className="mt-4">
              <div className="bg-gray-200 rounded-full h-2">
                <div
                  className="bg-[var(--p-blue)] h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Uploading... {uploadProgress}%
              </p>
            </div>
          )}

          {uploadSuccess && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-800">{successMessage}</p>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-4">
        <button
          type="button"
          onClick={() => handleSubmit("Applied")}
          disabled={isLoading}
          className="px-6 py-2 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[#9CBA33] disabled:opacity-50"
        >
          {isLoading ? "Creating..." : "Submit Application"}
        </button>
      </div>
    </div>
  );
};

export default CreateBorrowingInvoice;
