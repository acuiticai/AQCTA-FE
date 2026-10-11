import React, { useState, useEffect, useContext, useRef } from "react";
import {
  ChevronDown,
  Calendar,
  X,
  ArrowLeft,
  Building,
  User,
  CreditCard,
  DollarSign,
  FileText,
  ArrowRight,
  AlertTriangle,
  CheckCircle,
  Upload,
  Eye,
  Trash2,
} from "lucide-react";
import axios from "axios";
import { useHistory } from "react-router-dom";
import { notifyError, notifySuccess } from "@/utils/toast";
import { AdminContext } from "@/context/AdminContext";
import CustomDatePicker from "@/components/CustomDatePicker";
import BackButton from "@/components/BackButton";
import { formatAmount, formatDate } from "@/components/formatAmount";
import SearchableDropdown from "@/components/SearchableDropdown";

const CreateSpecialTransfer = () => {
  const history = useHistory();
  const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
  const [isLoading, setIsLoading] = useState(false);
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // State management
  const [businesses, setBusinesses] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [destinationBankAccounts, setDestinationBankAccounts] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [conversionRates, setConversionRates] = useState({});
  const [isLoadingConversion, setIsLoadingConversion] = useState(false);
  const [transferTypes, setTransferTypes] = useState([]);
  const [purchaseContracts, setPurchaseContracts] = useState([]);
  const [selectedContract, setSelectedContract] = useState(null);
  const [expenseAccounts, setExpenseAccounts] = useState([]);

  // Form data
  const [formData, setFormData] = useState({
    transferType: "inter_company", // "inter_company", "third_party_payment", "third_party_received", "invoice_payment"
    transactionType: "", // Will be set dynamically from transfer types
    sourceBusiness: "",
    sourceBankAccount: "",
    sourceAmount: "",
    sourceCurrency: "USD", // Will be populated from bank account
    destinationBusiness: "",
    destinationBankAccount: "",
    thirdPartyInfo: {
      name: "",
      accountNumber: "",
      bankName: "",
      reason: "",
    },
    notes: "",
    reference: "",
    transferDate: formatDateForInput(new Date()),
    supportingDocument: null, // New field for supporting document
    supportingDocuments: [], // New field for supporting documents array
    isPayBackTransfer: false,
    expectedPayBackDate: "",
    purchaseContract: "", // For invoice payments
    accountCode: "", // Account code reference
  });

  const [formErrors, setFormErrors] = useState({});

  // Format date for input fields
  function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch businesses
        const storedBusinesses = localStorage.getItem("businesses");
        if (storedBusinesses) {
          const parsedData = JSON.parse(storedBusinesses);
          setBusinesses(parsedData);
        }
      } catch (error) {
        console.error("Error fetching initial data:", error);
        notifyError("Failed to load initial data");
      }
    };

    fetchData();
  }, []);

  // Fetch transfer types for a business
  const fetchTransferTypes = async (businessId) => {
    try {
      const response = await axios.get(
        `${Base_URL}/special-transfer-types/business/${businessId}/active`,
        {
          headers: {
            authorization: `Bearer ${adminInfo.token}`,
          },
        }
      );

      if (response.data.success) {
        setTransferTypes(response.data.data);
        // Set the first transfer type as default if available
        if (response.data.data.length > 0 && !formData.transactionType) {
          setFormData((prev) => ({
            ...prev,
            transactionType: response.data.data[0].name,
          }));
        }
      }
    } catch (error) {
      console.error("Error fetching transfer types:", error);
      // Don't show error notification as this might be expected for new businesses
    }
  };

  // Fetch currencies when source business changes (same as vendor invoice)
  useEffect(() => {
    const fetchCurrencies = async () => {
      if (formData.sourceBusiness) {
        try {
          const response = await axios.get(
            `${Base_URL}/finance/currencies?business_id=${formData.sourceBusiness}`
          );
          setCurrencies(response.data.data || []);
        } catch (error) {
          console.error("Error fetching currencies:", error);
          notifyError("Failed to load currencies");
        }
      } else {
        setCurrencies([]);
      }
    };
    fetchCurrencies();
  }, [formData.sourceBusiness]);

  // Fetch expense accounts when source business changes
  useEffect(() => {
    const fetchExpenseAccounts = async () => {
      if (formData.sourceBusiness) {
        try {
          const response = await axios.get(`${Base_URL}/accounts`, {
            params: { business: formData.sourceBusiness },
            headers: {
              authorization: `Bearer ${adminInfo.token}`,
            },
          });
          setExpenseAccounts(response.data.accounts || []);
        } catch (error) {
          console.error("Error fetching expense accounts:", error);
          notifyError("Failed to load expense accounts");
        }
      } else {
        setExpenseAccounts([]);
      }
    };
    fetchExpenseAccounts();
  }, [formData.sourceBusiness]);

  // Fetch bank accounts when source business changes (same as vendor invoice)
  useEffect(() => {
    const fetchBankAccounts = async () => {
      if (formData.sourceBusiness) {
        try {
          const response = await axios.get(
            `${Base_URL}/bank-management/accounts`,
            {
              params: { business: formData.sourceBusiness },
              headers: {
                authorization: `Bearer ${adminInfo.token}`,
              },
            }
          );

          console.log("response.data.accounts", response.data.accounts);
          setBankAccounts(response.data.accounts || []);
        } catch (error) {
          console.error("Error fetching bank accounts:", error);
          notifyError("Failed to fetch bank accounts");
        }
      } else {
        setBankAccounts([]);
      }
    };

    fetchBankAccounts();
  }, [formData.sourceBusiness]);

  // Fetch destination bank accounts for invoice payments
  const fetchDestinationBankAccounts = async (businessId) => {
    if (businessId) {
      try {
        const response = await axios.get(
          `${Base_URL}/bank-management/accounts`,
          {
            params: { business: businessId },
            headers: {
              authorization: `Bearer ${adminInfo.token}`,
            },
          }
        );

        setDestinationBankAccounts(response.data.accounts || []);
      } catch (error) {
        console.error("Error fetching destination bank accounts:", error);
        notifyError("Failed to fetch destination bank accounts");
      }
    } else {
      setDestinationBankAccounts([]);
    }
  };

  // Fetch conversion rate for currency conversion
  const fetchConversionRate = async (fromCurrency, toCurrency, amount) => {
    setIsLoadingConversion(true);
    try {
      const response = await axios.get(`${Base_URL}/currency/convert`, {
        params: {
          from: fromCurrency,
          to: toCurrency,
          amount: amount,
          businessId: formData.business,
        },
        headers: {
          authorization: `Bearer ${adminInfo.token}`,
        },
      });

      if (response.data.success) {
        const conversionKey = `${fromCurrency}_${toCurrency}`;
        setConversionRates((prev) => ({
          ...prev,
          [conversionKey]: response.data.rate,
        }));

        // Update the form with converted amount
        setFormData((prev) => ({
          ...prev,
          sourceAmount: response.data.convertedAmount.toString(),
        }));
      }
    } catch (error) {
      console.error("Error fetching conversion rate:", error);
      // Fallback to original amount if conversion fails
      notifyError("Currency conversion failed, using original amount");
    } finally {
      setIsLoadingConversion(false);
    }
  };

  // Fetch purchase contracts when source business changes
  useEffect(() => {
    const fetchPurchaseContracts = async () => {
      if (
        formData.sourceBusiness &&
        formData.transferType === "invoice_payment"
      ) {
        try {
          const response = await axios.get(
            `${Base_URL}/special-transfers/purchase-contracts`,
            {
              params: { business: formData.sourceBusiness },
              headers: {
                authorization: `Bearer ${adminInfo.token}`,
              },
            }
          );

          setPurchaseContracts(response.data.data || []);
        } catch (error) {
          console.error("Error fetching purchase contracts:", error);
          notifyError("Failed to fetch purchase contracts");
        }
      } else {
        setPurchaseContracts([]);
        setSelectedContract(null);
      }
    };

    fetchPurchaseContracts();
  }, [formData.sourceBusiness, formData.transferType]);

  // Fetch destination bank accounts when destination business changes
  useEffect(() => {
    const fetchDestinationBankAccounts = async () => {
      if (
        formData.destinationBusiness &&
        formData.transferType === "inter_company"
      ) {
        try {
          const response = await axios.get(
            `${Base_URL}/bank-management/accounts`,
            {
              params: { business: formData.destinationBusiness },
              headers: {
                authorization: `Bearer ${adminInfo.token}`,
              },
            }
          );
          // Update destination bank accounts in the existing bankAccounts state
          // For simplicity, we'll use the same state but filter based on business
          setBankAccounts((prev) => [
            ...prev,
            ...(response.data.accounts || []),
          ]);
        } catch (error) {
          console.error("Error fetching destination bank accounts:", error);
        }
      }
    };

    fetchDestinationBankAccounts();
  }, [formData.destinationBusiness, formData.transferType]);

  const handleInputChange = async (e) => {
    const { name, value } = e.target;

    if (name.startsWith("thirdPartyInfo.")) {
      const field = name.split(".")[1];
      setFormData((prev) => ({
        ...prev,
        thirdPartyInfo: {
          ...prev.thirdPartyInfo,
          [field]: value,
        },
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));

      // Clear dependent fields when business changes
      if (name === "sourceBusiness") {
        setFormData((prev) => ({
          ...prev,
          sourceBankAccount: "",
          sourceAmount: "",
          sourceCurrency: "USD",
          transactionType: "", // Clear transaction type when source business changes
          purchaseContract: "", // Clear purchase contract
          accountCode: "", // Clear account code
        }));
        // Fetch transfer types for the selected source business
        if (value) {
          await fetchTransferTypes(value);
        } else {
          setTransferTypes([]); // Clear transfer types if no business selected
        }
      }

      // Populate currency when source bank account changes
      if (name === "sourceBankAccount" && value) {
        const selectedAccount = bankAccounts.find((acc) => acc._id === value);
        if (selectedAccount) {
          setFormData((prev) => ({
            ...prev,
            sourceCurrency: selectedAccount.currencyType || "USD",
          }));
        }
      }

      // Handle purchase contract selection
      if (name === "purchaseContract" && value) {
        const contract = purchaseContracts.find((c) => c._id === value);
        if (contract) {
          setSelectedContract(contract);

          // Get the current source bank account to check its currency
          const sourceBankAccount = bankAccounts.find(
            (acc) => acc._id === formData.sourceBankAccount
          );
          const sourceCurrency = sourceBankAccount?.currencyType || "USD";

          let finalAmount = contract.totalValue;

          // If contract currency is different from source bank account currency, convert it
          if (contract.currency !== sourceCurrency) {
            // Check if conversion rate is cached
            const conversionKey = `${contract.currency}_${sourceCurrency}`;
            if (conversionRates[conversionKey]) {
              finalAmount =
                contract.totalValue * conversionRates[conversionKey];
            } else {
              // Fetch conversion rate
              fetchConversionRate(
                contract.currency,
                sourceCurrency,
                contract.totalValue
              );
              // For now, use original amount until conversion completes
              finalAmount = contract.totalValue;
            }
          }

          setFormData((prev) => ({
            ...prev,
            sourceAmount: finalAmount.toString(),
            sourceCurrency: sourceCurrency,
            destinationBusiness: contract.destinationBusiness._id,
            transactionType: "Invoice Payment", // Set default transaction type for invoice payments
          }));

          // Fetch destination bank accounts for the selected contract's business
          fetchDestinationBankAccounts(contract.destinationBusiness._id);
        }
      }

      // Handle transfer type change
      if (name === "transferType") {
        if (value === "invoice_payment") {
          setFormData((prev) => ({
            ...prev,
            transactionType: "Invoice Payment",
            purchaseContract: "",
            destinationBusiness: "",
            destinationBankAccount: "",
          }));
        } else {
          setFormData((prev) => ({
            ...prev,
            transactionType: "",
            purchaseContract: "",
          }));
        }
      }
    }

    // Clear errors when user starts typing
    if (formErrors[name]) {
      setFormErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  // Currency conversion function
  const convertCurrency = async (fromCurrency, toCurrency, amount) => {
    if (fromCurrency === toCurrency) {
      return { convertedAmount: amount, exchangeRate: 1 };
    }

    const cacheKey = `${fromCurrency}_${toCurrency}`;
    if (conversionRates[cacheKey]) {
      return {
        convertedAmount: amount * conversionRates[cacheKey],
        exchangeRate: conversionRates[cacheKey],
      };
    }

    try {
      setIsLoadingConversion(true);
      const response = await axios.get(`${Base_URL}/currency/convert`, {
        params: {
          from: fromCurrency,
          to: toCurrency,
          amount: amount,
          businessId: formData.business,
        },
        headers: {
          authorization: `Bearer ${adminInfo.token}`,
        },
      });

      const rate = response.data.rate;
      setConversionRates((prev) => ({
        ...prev,
        [cacheKey]: rate,
      }));

      return {
        convertedAmount: response.data.convertedAmount,
        exchangeRate: rate,
      };
    } catch (error) {
      console.error("Currency conversion failed:", error);
      notifyError("Currency conversion failed. Using original amount.");
      return { convertedAmount: amount, exchangeRate: 1 };
    } finally {
      setIsLoadingConversion(false);
    }
  };

  // Handle amount change and currency conversion
  const handleAmountChange = async (e) => {
    const { value } = e.target;
    setFormData((prev) => ({ ...prev, sourceAmount: value }));

    // Auto-convert for inter-company transfers
    if (
      formData.transferType === "inter_company" &&
      formData.sourceBankAccount &&
      formData.destinationBankAccount &&
      value > 0
    ) {
      const sourceAccount = bankAccounts.find(
        (acc) => acc._id === formData.sourceBankAccount
      );
      const destinationAccount = bankAccounts.find(
        (acc) => acc._id === formData.destinationBankAccount
      );

      if (
        sourceAccount &&
        destinationAccount &&
        formData.sourceCurrency !== destinationAccount.currencyType
      ) {
        try {
          const conversion = await convertCurrency(
            formData.sourceCurrency,
            destinationAccount.currencyType,
            parseFloat(value)
          );

          notifySuccess(
            `Amount converted: ${formData.sourceCurrency} ${value} = ${
              destinationAccount.currencyType
            } ${conversion.convertedAmount.toFixed(2)} (Rate: ${
              conversion.exchangeRate
            })`
          );
        } catch (error) {
          console.error("Conversion error:", error);
        }
      }
    }
  };

  // Handle file upload
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate that business and reference are filled before upload
    if (!formData.sourceBusiness) {
      notifyError("Please select a source business before uploading documents");
      e.target.value = ""; // Clear the file input
      return;
    }

    if (!formData.reference || formData.reference.trim() === "") {
      notifyError("Please enter a reference number before uploading documents");
      e.target.value = ""; // Clear the file input
      return;
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      notifyError("Please upload only JPEG, PNG, or PDF files");
      e.target.value = ""; // Clear the file input
      return;
    }

    // Validate file size (5MB limit)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      notifyError("File size must be less than 5MB");
      e.target.value = ""; // Clear the file input
      return;
    }

    // Start upload process
    setUploading(true);
    setUploadSuccess(false);

    // Prepare form data for upload
    const formDataForUpload = new FormData();
    formDataForUpload.append(
      "file_path",
      `SpecialTransfers/${formData.sourceBusiness}/${formData.reference}`
    );
    formDataForUpload.append("customer_id", adminInfo?.id);
    formDataForUpload.append("file_type", file.type);
    formDataForUpload.append("file_size", file.size);
    formDataForUpload.append("file", file);

    try {
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
        };

        // Update the form data with the uploaded document information
        setFormData({
          ...formData,
          supportingDocument: newDocument,
          supportingDocuments: [...formData.supportingDocuments, newDocument],
        });

        // Show success message in UI
        setSuccessMessage(
          response.data.message || "File uploaded successfully!"
        );
        setUploadSuccess(true);

        // Auto-hide success message after 3 seconds
        setTimeout(() => {
          setUploadSuccess(false);
          setSuccessMessage("");
        }, 3000);
      }
    } catch (error) {
      console.error("File upload error:", error);
      notifyError(
        error.response?.data?.message || "File upload failed. Please try again."
      );
    } finally {
      setUploading(false);
      setUploadProgress(0);
      e.target.value = ""; // Clear the file input after upload
    }
  };

  const handleOpenFile = async (documentId) => {
    if (!documentId) return;

    try {
      let response = await axios.get(
        `${Base_URL}/documents/getFileWithAllData/${documentId}`
      );
      window.open(response.data.data.url, "_blank");
    } catch (error) {
      notifyError("Error getting file");
      console.log("Error: ", error);
    }
  };

  const handleRemoveDocument = () => {
    setFormData({
      ...formData,
      supportingDocument: null,
      supportingDocuments: [],
    });
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.transferType)
      errors.transferType = "Transfer type is required";
    if (
      !formData.transactionType &&
      formData.transferType !== "invoice_payment"
    )
      errors.transactionType = "Transaction type is required";
    if (!formData.sourceBusiness)
      errors.sourceBusiness = "Source business is required";
    if (!formData.sourceBankAccount)
      errors.sourceBankAccount = "Source bank account is required";
    if (!formData.sourceAmount || formData.sourceAmount <= 0)
      errors.sourceAmount = "Valid source amount is required";
    if (!formData.sourceCurrency)
      errors.sourceCurrency = "Source currency is required";
    if (!formData.accountCode) errors.accountCode = "Account code is required";
    if (!formData.reference || formData.reference.trim() === "")
      errors.reference = "Reference number is required";

    if (formData.transferType === "inter_company") {
      if (!formData.destinationBusiness)
        errors.destinationBusiness = "Destination business is required";
      if (!formData.destinationBankAccount)
        errors.destinationBankAccount = "Destination bank account is required";
    } else if (
      formData.transferType === "third_party_payment" ||
      formData.transferType === "third_party_received"
    ) {
      if (!formData.thirdPartyInfo.name)
        errors.thirdPartyName = "Third party name is required";
      if (!formData.thirdPartyInfo.accountNumber)
        errors.thirdPartyAccount = "Account number is required";
      if (!formData.thirdPartyInfo.bankName)
        errors.thirdPartyBank = "Bank name is required";
      if (!formData.thirdPartyInfo.reason)
        errors.thirdPartyReason = "Reason is required";
    } else if (formData.transferType === "invoice_payment") {
      if (!formData.purchaseContract)
        errors.purchaseContract = "Purchase contract is required";
      if (!formData.destinationBankAccount)
        errors.destinationBankAccount = "Destination bank account is required";
    }

    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const errors = validateForm();
    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      notifyError("Please fix the errors before submitting");
      return;
    }

    setIsLoading(true);

    try {
      // Prepare supporting documents array
      let supportingDocuments = [];
      if (
        formData.supportingDocuments &&
        formData.supportingDocuments.length > 0
      ) {
        supportingDocuments = formData.supportingDocuments;
      } else if (formData.supportingDocument) {
        supportingDocuments = [formData.supportingDocument];
      }

      // Build payload based on transfer type
      const payload = {
        business: formData.sourceBusiness, // Use source business as the main business
        transferType: formData.transferType,
        transactionType: formData.transactionType,
        sourceBusiness: formData.sourceBusiness,
        sourceBankAccount: formData.sourceBankAccount,
        sourceAmount: parseFloat(formData.sourceAmount),
        sourceCurrency: formData.sourceCurrency,
        notes: formData.notes,
        reference: formData.reference,
        transferDate: new Date(formData.transferDate),
        supportingDocuments: supportingDocuments,
        isPayBackTransfer: formData.isPayBackTransfer,
        expectedPayBackDate: formData.expectedPayBackDate
          ? new Date(formData.expectedPayBackDate)
          : undefined,
        accountCode: formData.accountCode,
      };

      // Add fields based on transfer type
      if (formData.transferType === "inter_company") {
        // For inter-company transfers, destination business and bank account are required
        payload.destinationBusiness = formData.destinationBusiness;
        payload.destinationBankAccount = formData.destinationBankAccount;
      } else if (
        formData.transferType === "third_party_payment" ||
        formData.transferType === "third_party_received"
      ) {
        // For third party transfers, only third party info is needed
        payload.thirdPartyInfo = formData.thirdPartyInfo;
        // Don't send destinationBusiness or destinationBankAccount (or send undefined)
        payload.destinationBusiness = undefined;
        payload.destinationBankAccount = undefined;
      } else if (formData.transferType === "invoice_payment") {
        // For invoice payments, destination bank account is required
        payload.destinationBankAccount = formData.destinationBankAccount;
        payload.purchaseContract = formData.purchaseContract;
        // Don't send destinationBusiness (or send undefined)
        payload.destinationBusiness = undefined;
      }

      console.log("payload", payload);

      const response = await axios.post(
        `${Base_URL}/special-transfers`,
        payload,
        {
          headers: {
            authorization: `Bearer ${adminInfo.token}`,
          },
        }
      );

      if (response.data.success) {
        notifySuccess("Special transfer created successfully");
        history.push("/special-transfers");
      } else {
        notifyError(response.data.error || "Failed to create transfer");
      }
    } catch (error) {
      console.error("Error creating special transfer:", error);
      notifyError(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Failed to create special transfer"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const getSourceBankAccountCurrency = () => {
    const account = bankAccounts.find(
      (acc) => acc._id === formData.sourceBankAccount
    );
    return account?.currencyType || "USD";
  };

  const getDestinationBankAccountCurrency = () => {
    const account = bankAccounts.find(
      (acc) => acc._id === formData.destinationBankAccount
    );
    return account?.currencyType || "USD";
  };

  const currencyOptions =
    currencies.length > 0
      ? currencies.map((currency) => ({
          value: currency.symbol,
          label: `${currency.symbol} (${currency.prefix})`,
          conversionRate: currency.conversion_rate_to_base,
        }))
      : [{ value: "USD", label: "USD (US Dollar)", conversionRate: 1 }];

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <BackButton />
      </div>

      <h1 className="text-2xl font-semibold mb-6 text-gray-800">
        Create Special Transfer
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Transfer Type Selection */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h2 className="text-lg font-medium mb-4 text-gray-800">
            Transfer Type
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              type="button"
              onClick={() =>
                setFormData((prev) => ({
                  ...prev,
                  transferType: "inter_company",
                }))
              }
              className={`p-6 rounded-lg border-2 transition-all text-left ${
                formData.transferType === "inter_company"
                  ? "border-[var(--p-blue)] bg-[#f0fbf7]"
                  : "border-gray-300 bg-white hover:border-gray-400"
              }`}
            >
              <div className="flex items-center mb-3">
                <Building
                  size={24}
                  className={
                    formData.transferType === "inter_company"
                      ? "text-[var(--p-blue)]"
                      : "text-gray-600"
                  }
                />
                <span
                  className={`ml-3 text-lg font-medium ${
                    formData.transferType === "inter_company"
                      ? "text-[var(--p-blue)]"
                      : "text-gray-800"
                  }`}
                >
                  Inter Company
                </span>
              </div>
              <p className="text-sm text-gray-600">
                Transfer between company bank accounts
              </p>
            </button>

            <button
              type="button"
              onClick={() =>
                setFormData((prev) => ({
                  ...prev,
                  transferType: "third_party_payment",
                }))
              }
              className={`p-6 rounded-lg border-2 transition-all text-left ${
                formData.transferType === "third_party_payment"
                  ? "border-[var(--p-blue)] bg-[#f0fbf7]"
                  : "border-gray-300 bg-white hover:border-gray-400"
              }`}
            >
              <div className="flex items-center mb-3">
                <ArrowRight
                  size={24}
                  className={
                    formData.transferType === "third_party_payment"
                      ? "text-[var(--p-blue)]"
                      : "text-gray-600"
                  }
                />
                <span
                  className={`ml-3 text-lg font-medium ${
                    formData.transferType === "third_party_payment"
                      ? "text-[var(--p-blue)]"
                      : "text-gray-800"
                  }`}
                >
                  Third Party Payment
                </span>
              </div>
              <p className="text-sm text-gray-600">
                Pay money to external party
              </p>
            </button>

            <button
              type="button"
              onClick={() =>
                setFormData((prev) => ({
                  ...prev,
                  transferType: "third_party_received",
                }))
              }
              className={`p-6 rounded-lg border-2 transition-all text-left ${
                formData.transferType === "third_party_received"
                  ? "border-[var(--p-blue)] bg-[#f0fbf7]"
                  : "border-gray-300 bg-white hover:border-gray-400"
              }`}
            >
              <div className="flex items-center mb-3">
                <User
                  size={24}
                  className={
                    formData.transferType === "third_party_received"
                      ? "text-[var(--p-blue)]"
                      : "text-gray-600"
                  }
                />
                <span
                  className={`ml-3 text-lg font-medium ${
                    formData.transferType === "third_party_received"
                      ? "text-[var(--p-blue)]"
                      : "text-gray-800"
                  }`}
                >
                  Third Party Received
                </span>
              </div>
              <p className="text-sm text-gray-600">
                Receive money from external party
              </p>
            </button>

            <button
              type="button"
              onClick={() =>
                setFormData((prev) => ({
                  ...prev,
                  transferType: "invoice_payment",
                }))
              }
              className={`p-6 rounded-lg border-2 transition-all text-left ${
                formData.transferType === "invoice_payment"
                  ? "border-[var(--p-blue)] bg-[#f0fbf7]"
                  : "border-gray-300 bg-white hover:border-gray-400"
              }`}
            >
              <div className="flex items-center mb-3">
                <FileText
                  size={24}
                  className={
                    formData.transferType === "invoice_payment"
                      ? "text-[var(--p-blue)]"
                      : "text-gray-600"
                  }
                />
                <span
                  className={`ml-3 text-lg font-medium ${
                    formData.transferType === "invoice_payment"
                      ? "text-[var(--p-blue)]"
                      : "text-gray-800"
                  }`}
                >
                  Invoice Payment
                </span>
              </div>
              <p className="text-sm text-gray-600">
                Payment for purchase contract invoice
              </p>
            </button>
          </div>
        </div>

        {/* Source Information */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h2 className="text-lg font-medium mb-4 text-gray-800">
            Source Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 mb-2">
                Source Business *
              </label>
              <SearchableDropdown
                name="sourceBusiness"
                value={formData.sourceBusiness}
                onChange={handleInputChange}
                placeholder="Select Source Business"
                searchPlaceholder="Search businesses..."
                options={businesses.map((business) => ({
                  value: business._id,
                  label: business.name,
                  name: business.name,
                  type: business.type || "Business",
                }))}
                searchKeys={["name", "type"]}
                renderOption={(option) => (
                  <div>
                    <div className="font-medium">{option.name}</div>
                    {option.type && (
                      <div className="text-xs text-gray-500">{option.type}</div>
                    )}
                  </div>
                )}
              />
              {formErrors.sourceBusiness && (
                <p className="text-red-500 text-sm mt-1">
                  {formErrors.sourceBusiness}
                </p>
              )}
            </div>

            <div>
              <label className="block text-gray-700 mb-2">
                Source Bank Account *
              </label>
              <SearchableDropdown
                name="sourceBankAccount"
                value={formData.sourceBankAccount}
                onChange={handleInputChange}
                placeholder="Select Source Bank Account"
                searchPlaceholder="Search bank accounts..."
                disabled={!formData.sourceBusiness}
                options={bankAccounts
                  .filter((acc) => acc.business._id === formData.sourceBusiness)
                  .map((account) => ({
                    value: account._id,
                    label: `${account.accountName} - ${account.bankName} (${account.currencyType})`,
                    name: account.accountName,
                    bank: account.bankName,
                    currency: account.currencyType,
                  }))}
                searchKeys={["name", "bank", "currency"]}
                renderOption={(option) => (
                  <div>
                    <div className="font-medium">{option.name}</div>
                    <div className="text-xs text-gray-500">
                      {option.bank} ({option.currency})
                    </div>
                  </div>
                )}
              />
              {formErrors.sourceBankAccount && (
                <p className="text-red-500 text-sm mt-1">
                  {formErrors.sourceBankAccount}
                </p>
              )}
            </div>

            <div>
              <label className="block text-gray-700 mb-2">Amount *</label>
              <div className="relative">
                <input
                  type="number"
                  name="sourceAmount"
                  value={formData.sourceAmount}
                  onChange={handleAmountChange}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  // readOnly={formData.transferType === "invoice_payment"}
                  className={`w-full p-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]`}
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <span className="text-gray-500">
                    {formData.sourceCurrency}
                  </span>
                </div>
              </div>
              {formData.transferType === "invoice_payment" && (
                <p className="text-blue-500 text-sm mt-1">
                  Amount will be populated from selected purchase contract
                </p>
              )}
              {formErrors.sourceAmount && (
                <p className="text-red-500 text-sm mt-1">
                  {formErrors.sourceAmount}
                </p>
              )}
            </div>

            <div>
              <label className="block text-gray-700 mb-2">Currency *</label>
              <input
                type="text"
                value={formData.sourceCurrency}
                readOnly
                className="w-full p-3 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
              />
              <p className="text-blue-500 text-sm mt-1">
                Currency is automatically set from selected bank account
              </p>
              {formErrors.sourceCurrency && (
                <p className="text-red-500 text-sm mt-1">
                  {formErrors.sourceCurrency}
                </p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-gray-700 mb-2">Account Code *</label>
              <SearchableDropdown
                name="accountCode"
                value={formData.accountCode}
                onChange={handleInputChange}
                placeholder={
                  formData.sourceBusiness
                    ? "Select Account Code"
                    : "Please select source business first"
                }
                searchPlaceholder="Search account codes..."
                disabled={!formData.sourceBusiness}
                options={expenseAccounts.map((account) => ({
                  value: account._id,
                  label: `${account.code || "N/A"} - ${account.accountName} (${
                    account.accountType?.name ||
                    account.accountType?.accountHeader ||
                    "N/A"
                  })`,
                  code: account.code,
                  name: account.accountName,
                  type:
                    account.accountType?.name ||
                    account.accountType?.accountHeader,
                }))}
                searchKeys={["code", "name", "type"]}
                renderOption={(option) => (
                  <div>
                    <div className="font-medium">{option.code}</div>
                    <div className="text-sm text-gray-600">{option.name}</div>
                    {option.type && (
                      <div className="text-xs text-gray-500">{option.type}</div>
                    )}
                  </div>
                )}
              />
              <p className="text-blue-500 text-sm mt-1">
                Select an account code for this transfer
              </p>
              {formErrors.accountCode && (
                <p className="text-red-500 text-sm mt-1">
                  {formErrors.accountCode}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Purchase Contract Selection - Only for Invoice Payment */}
        {formData.transferType === "invoice_payment" && (
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-lg font-medium mb-4 text-gray-800">
              Purchase Contract Selection
            </h2>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-gray-700 mb-2">
                  Purchase Contract *
                </label>
                <SearchableDropdown
                  name="purchaseContract"
                  value={formData.purchaseContract}
                  onChange={handleInputChange}
                  placeholder={
                    formData.sourceBusiness
                      ? "Select Purchase Contract"
                      : "Please select source business first"
                  }
                  searchPlaceholder="Search purchase contracts..."
                  disabled={!formData.sourceBusiness}
                  options={purchaseContracts.map((contract) => ({
                    value: contract._id,
                    label: `${contract.contractNo} - ${contract.vendorName} (${
                      contract.currency
                    } ${formatAmount(contract.totalValue)})`,
                    contractNo: contract.contractNo,
                    vendor: contract.vendorName,
                    amount: `${contract.currency} ${formatAmount(
                      contract.totalValue
                    )}`,
                  }))}
                  searchKeys={["contractNo", "vendor"]}
                  renderOption={(option) => (
                    <div>
                      <div className="font-medium">{option.contractNo}</div>
                      <div className="text-xs text-gray-500">
                        {option.vendor}
                      </div>
                      <div className="text-xs text-gray-400">
                        {option.amount}
                      </div>
                    </div>
                  )}
                />
                {formErrors.purchaseContract && (
                  <p className="text-red-500 text-sm mt-1">
                    {formErrors.purchaseContract}
                  </p>
                )}
              </div>

              {selectedContract && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-medium text-blue-800 mb-3">
                    Selected Contract Details
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
                    <div>
                      <span className="text-blue-600">Contract No:</span>
                      <p className="font-medium">
                        {selectedContract.contractNo}
                      </p>
                    </div>
                    <div>
                      <span className="text-blue-600">Vendor:</span>
                      <p className="font-medium">
                        {selectedContract.vendorName}
                      </p>
                    </div>
                    <div>
                      <span className="text-blue-600">Total Value:</span>
                      <p className="font-medium">
                        {selectedContract.currency}{" "}
                        {formatAmount(selectedContract.totalValue)}
                      </p>
                    </div>
                    <div>
                      <span className="text-blue-600">
                        Destination Business:
                      </span>
                      <p className="font-medium">
                        {selectedContract.destinationBusiness?.name}
                      </p>
                    </div>
                  </div>

                  {/* Destination Bank Account Selection */}
                  <div className="mt-4">
                    <label className="block text-gray-700 mb-2">
                      Destination Bank Account *
                    </label>
                    <SearchableDropdown
                      name="destinationBankAccount"
                      value={formData.destinationBankAccount}
                      onChange={handleInputChange}
                      placeholder="Select destination bank account"
                      searchPlaceholder="Search bank accounts..."
                      options={destinationBankAccounts.map((account) => ({
                        value: account._id,
                        label: `${account.accountName} - ${account.bankName} (${account.currencyType})`,
                        name: account.accountName,
                        bank: account.bankName,
                        currency: account.currencyType,
                      }))}
                      searchKeys={["name", "bank", "currency"]}
                      renderOption={(option) => (
                        <div>
                          <div className="font-medium">{option.name}</div>
                          <div className="text-xs text-gray-500">
                            {option.bank} ({option.currency})
                          </div>
                        </div>
                      )}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Transaction Type */}
        {formData.transferType !== "invoice_payment" && (
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-lg font-medium mb-4 text-gray-800">
              Transaction Type
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-700 mb-2">
                  Transaction Type *
                </label>
                <SearchableDropdown
                  name="transactionType"
                  value={formData.transactionType}
                  onChange={handleInputChange}
                  placeholder={
                    formData.sourceBusiness
                      ? "Select Transaction Type"
                      : "Please select source business first"
                  }
                  searchPlaceholder="Search transaction types..."
                  disabled={!formData.sourceBusiness}
                  options={transferTypes.map((type) => ({
                    value: type.name,
                    label: type.name,
                    name: type.name,
                    description: type.description || "",
                  }))}
                  searchKeys={["name", "description"]}
                  renderOption={(option) => (
                    <div>
                      <div className="font-medium">{option.name}</div>
                      {option.description && (
                        <div className="text-xs text-gray-500">
                          {option.description}
                        </div>
                      )}
                    </div>
                  )}
                />
                {formErrors.transactionType && (
                  <p className="text-red-500 text-sm mt-1">
                    {formErrors.transactionType}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Destination Information - Only for Inter Company */}
        {formData.transferType === "inter_company" && (
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-lg font-medium mb-4 text-gray-800">
              Destination Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-700 mb-2">
                  Destination Business *
                </label>
                <SearchableDropdown
                  name="destinationBusiness"
                  value={formData.destinationBusiness}
                  onChange={handleInputChange}
                  placeholder="Select Destination Business"
                  searchPlaceholder="Search businesses..."
                  options={businesses
                    .filter(
                      (business) => business._id !== formData.sourceBusiness
                    )
                    .map((business) => ({
                      value: business._id,
                      label: business.name,
                      name: business.name,
                      type: business.type || "Business",
                    }))}
                  searchKeys={["name", "type"]}
                  renderOption={(option) => (
                    <div>
                      <div className="font-medium">{option.name}</div>
                      {option.type && (
                        <div className="text-xs text-gray-500">
                          {option.type}
                        </div>
                      )}
                    </div>
                  )}
                />
                {formErrors.destinationBusiness && (
                  <p className="text-red-500 text-sm mt-1">
                    {formErrors.destinationBusiness}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-gray-700 mb-2">
                  Destination Bank Account *
                </label>
                <SearchableDropdown
                  name="destinationBankAccount"
                  value={formData.destinationBankAccount}
                  onChange={handleInputChange}
                  placeholder="Select Destination Bank Account"
                  searchPlaceholder="Search bank accounts..."
                  options={bankAccounts
                    .filter(
                      (acc) => acc.business._id === formData.destinationBusiness
                    )
                    .map((account) => ({
                      value: account._id,
                      label: `${account.accountName} - ${account.bankName} (${account.currencyType})`,
                      name: account.accountName,
                      bank: account.bankName,
                      currency: account.currencyType,
                    }))}
                  searchKeys={["name", "bank", "currency"]}
                  renderOption={(option) => (
                    <div>
                      <div className="font-medium">{option.name}</div>
                      <div className="text-xs text-gray-500">
                        {option.bank} ({option.currency})
                      </div>
                    </div>
                  )}
                />
                {formErrors.destinationBankAccount && (
                  <p className="text-red-500 text-sm mt-1">
                    {formErrors.destinationBankAccount}
                  </p>
                )}
              </div>
            </div>

            {/* Currency Conversion Info */}
            {formData.sourceBankAccount &&
              formData.destinationBankAccount &&
              formData.sourceCurrency !==
                getDestinationBankAccountCurrency() && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center">
                    <AlertTriangle size={16} className="text-blue-600 mr-2" />
                    <span className="text-blue-800 text-sm">
                      Currency conversion will be applied:{" "}
                      {formData.sourceCurrency} →{" "}
                      {getDestinationBankAccountCurrency()}
                    </span>
                  </div>
                </div>
              )}
          </div>
        )}

        {/* Third Party Information */}
        {(formData.transferType === "third_party_payment" ||
          formData.transferType === "third_party_received") && (
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-lg font-medium mb-4 text-gray-800">
              Third Party Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-700 mb-2">Name *</label>
                <input
                  type="text"
                  name="thirdPartyInfo.name"
                  value={formData.thirdPartyInfo.name}
                  onChange={handleInputChange}
                  placeholder="Enter third party name"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
                />
                {formErrors.thirdPartyName && (
                  <p className="text-red-500 text-sm mt-1">
                    {formErrors.thirdPartyName}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-gray-700 mb-2">
                  Account Number *
                </label>
                <input
                  type="text"
                  name="thirdPartyInfo.accountNumber"
                  value={formData.thirdPartyInfo.accountNumber}
                  onChange={handleInputChange}
                  placeholder="Enter account number"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
                />
                {formErrors.thirdPartyAccount && (
                  <p className="text-red-500 text-sm mt-1">
                    {formErrors.thirdPartyAccount}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-gray-700 mb-2">Bank Name *</label>
                <input
                  type="text"
                  name="thirdPartyInfo.bankName"
                  value={formData.thirdPartyInfo.bankName}
                  onChange={handleInputChange}
                  placeholder="Enter bank name"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
                />
                {formErrors.thirdPartyBank && (
                  <p className="text-red-500 text-sm mt-1">
                    {formErrors.thirdPartyBank}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-gray-700 mb-2">Reason *</label>
                <input
                  type="text"
                  name="thirdPartyInfo.reason"
                  value={formData.thirdPartyInfo.reason}
                  onChange={handleInputChange}
                  placeholder="Enter reason for transfer"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
                />
                {formErrors.thirdPartyReason && (
                  <p className="text-red-500 text-sm mt-1">
                    {formErrors.thirdPartyReason}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Additional Information */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h2 className="text-lg font-medium mb-4 text-gray-800">
            Additional Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 mb-2">Transfer Date</label>
              <CustomDatePicker
                value={formData.transferDate}
                onChange={(date) =>
                  setFormData((prev) => ({ ...prev, transferDate: date }))
                }
                bgColor="#FFFFFF"
                style={{
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #EEEEEE",
                  borderRadius: "4px",
                }}
              />
            </div>

            <div>
              <label className="block text-gray-700 mb-2">Reference *</label>
              <input
                type="text"
                name="reference"
                value={formData.reference}
                onChange={handleInputChange}
                placeholder="Enter reference number"
                className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] ${
                  formErrors.reference ? "border-red-500" : "border-gray-300"
                }`}
              />
              {formErrors.reference && (
                <div className="text-red-500 text-xs mt-1">
                  {formErrors.reference}
                </div>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-gray-700 mb-2">Notes</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                placeholder="Enter additional notes"
                rows="3"
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] resize-none"
              />
            </div>
          </div>
        </div>

        {/* Pay Back Transfer Section */}
        {formData.transferType !== "invoice_payment" && (
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-lg font-medium mb-4 text-gray-800">
              Pay Back Transfer Details
            </h2>
            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isPayBackTransfer"
                  checked={formData.isPayBackTransfer}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      isPayBackTransfer: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 text-[var(--p-blue)] focus:ring-[var(--p-blue)] border-gray-300 rounded"
                />
                <label
                  htmlFor="isPayBackTransfer"
                  className="ml-2 block text-sm font-medium text-gray-700"
                >
                  This is a pay back transfer (expected to be paid back in
                  future)
                </label>
              </div>

              {formData.isPayBackTransfer && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Expected Pay Back Date
                    </label>
                    <input
                      type="date"
                      name="expectedPayBackDate"
                      value={formData.expectedPayBackDate}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Supporting Documents Section */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h2 className="text-lg font-medium mb-4 text-gray-800">
            Supporting Documents
          </h2>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
            {formData.supportingDocument ? (
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <FileText className="h-8 w-8 text-[var(--p-blue)] mr-3" />
                    <div>
                      <p className="font-medium text-gray-800">
                        {formData.supportingDocument.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {(
                          formData.supportingDocument.size /
                          1024 /
                          1024
                        ).toFixed(2)}{" "}
                        MB
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        handleOpenFile(formData.supportingDocument.fileId)
                      }
                      className="p-2 text-[var(--p-blue)] hover:text-[#9CBA33] rounded-lg transition-colors"
                      title="View Document"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveDocument}
                      className="p-2 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-colors"
                      title="Remove Document"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <div className="space-y-2">
                  <p className="text-gray-600">
                    Upload supporting documents for this transfer
                  </p>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="inline-flex items-center px-4 py-2 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[#9CBA33] transition-colors disabled:opacity-50"
                  >
                    <Upload size={16} className="mr-2" />
                    {uploading ? "Uploading..." : "Choose File"}
                  </button>
                </div>
                {uploading && (
                  <div className="mt-4">
                    <div className="bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-[var(--p-blue)] h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {uploadProgress}% uploaded
                    </p>
                  </div>
                )}
                {uploadSuccess && (
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-green-700 text-sm">{successMessage}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => history.goBack()}
            className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading || isLoadingConversion}
            className="px-6 py-3 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[#9CBA33] transition-colors flex items-center"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Creating...
              </>
            ) : (
              "Create Transfer"
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateSpecialTransfer;
