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
} from "lucide-react";
import axios from "axios";
import { useHistory, useLocation } from "react-router-dom";
import { notifyError, notifySuccess } from "@/utils/toast";
import { AdminContext } from "@/context/AdminContext";
import CustomDatePicker from "@/components/CustomDatePicker";
import SearchableDropdown from "@/components/SearchableDropdown";
import useAsync from "@/hooks/useAsync";
import CurrencyServices from "@/services/CurrencyServices";
import { param } from "jquery";
import { formatAmount } from "@/components/formatAmount";

const CreateExpense = () => {
  const history = useHistory();
  const location = useLocation();
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
  // const {
  //   data: currencies,
  //   loading,
  //   error,
  // } = useAsync(CurrencyServices.getAllCurrency);

  const [currencies, setCurrencies] = useState([]);

  const [businesses, setBusinesses] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [expenseAccounts, setExpenseAccounts] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [salesContracts, setSalesContracts] = useState([]);
  const [purchaseContracts, setPurchaseContracts] = useState([]);

  // Modal states
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [addItemData, setAddItemData] = useState({
    item_name: "",
    amount: 0,
    currency: "USD",
    discount: 0,
    notes: "",
    attachment: "",
    expenseAccount: "",
    contractType: "", // "sales" or "purchase"
    contractId: "",
    contractNumber: "", // Store contract number for display
  });

  // Form data state
  const [expenseData, setExpenseData] = useState({
    business: "",
    vendor: "",
    employee: "",
    expenseType: "bills",
    expenseDate: formatDateForInput(new Date()),
    dueDate: formatDateForInput(new Date()),
    expenseAccount: "",
    paidFromBankAccount: "",
    items: [],
    subtotal: 0,
    taxAmount: "0",
    total: 0,
    currency: "USD",
    terms: "Due on Receipt",
    notes: "",
    reference: "",
    supportingDocuments: [],
    status: "Draft",
  });

  const [formErrors, setFormErrors] = useState({});
  const [itemModalErrors, setItemModalErrors] = useState({});

  // Add state for claim loading and messages
  const [isCheckingClaims, setIsCheckingClaims] = useState(false);
  const [claimCheckMessage, setClaimCheckMessage] = useState("");
  const [availableClaims, setAvailableClaims] = useState([]);
  const [selectedClaims, setSelectedClaims] = useState([]);

  // Parse URL parameters
  const urlParams = new URLSearchParams(location.search);
  const urlBusiness = urlParams.get("business");
  const urlStaff = urlParams.get("staff");
  const urlClaimId = urlParams.get("claimId");

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
  }, [expenseData.business]);

  // Handle URL parameters on component mount
  useEffect(() => {
    if (urlBusiness && urlStaff && urlClaimId) {
      // Set the expense type to staff_claims
      setExpenseData((prev) => ({
        ...prev,
        expenseType: "staff_claims",
        business: urlBusiness,
        employee: urlStaff,
      }));

      // Pre-select the specific claim from URL
      setSelectedClaims([urlClaimId]);

      console.log("URL parameters detected:", {
        business: urlBusiness,
        staff: urlStaff,
        claimId: urlClaimId,
      });
    }
  }, [urlBusiness, urlStaff, urlClaimId]);

  useEffect(() => {
    const fetchCurrencies = async () => {
      const response = await axios.get(
        `${Base_URL}/finance/currencies?business_id=${expenseData?.business}`
      );
      setCurrencies(response.data.data || []);
    };
    fetchCurrencies();
  }, [expenseData?.business]);

  const currencyOptions = currencies.map((currency) => ({
    value: currency.symbol,
    label: `${currency.symbol} (${currency.prefix})`,
    conversionRate: currency.conversion_rate_to_base,
  }));

  // Handle claim selection when selectedClaims changes (including from URL)
  useEffect(() => {
    console.log("🔄 Claim selection useEffect triggered:", {
      selectedClaims,
      availableClaimsLength: availableClaims.length,
      expenseDataCurrency: expenseData.currency,
    });

    if (selectedClaims.length > 0 && availableClaims.length > 0) {
      // Generate expense items from selected claims
      const selectedClaimObjects = availableClaims.filter((claim) =>
        selectedClaims.includes(claim._id)
      );

      console.log("📋 Selected claim objects:", selectedClaimObjects);

      if (selectedClaimObjects.length > 0) {
        // Flatten all claim items from selected claims
        const allClaimItems = selectedClaimObjects.flatMap(
          (c) => c.items || []
        );
        console.log("📦 All claim items:", allClaimItems);

        if (allClaimItems.length > 0) {
          // Map claim items to expense items
          const mappedItems = mapClaimItemsToExpenseItems(allClaimItems);
          console.log("🗂️ Mapped expense items:", mappedItems);

          // Convert currencies and calculate totals
          Promise.all(
            mappedItems.map(async (item) => {
              let convertedAmount = item.amount;
              let exchangeRate = 1;
              if (item.currency !== expenseData.currency) {
                try {
                  const { convertedAmount: conv, rate } = await convertCurrency(
                    item.currency,
                    expenseData.currency,
                    item.amount
                  );
                  convertedAmount = conv;
                  exchangeRate = rate;
                } catch (error) {
                  convertedAmount = item.amount;
                }
              }
              return { ...item, convertedAmount, exchangeRate };
            })
          ).then((processedItems) => {
            console.log("✅ Final processed items:", processedItems);
            setExpenseData((prev) => ({
              ...prev,
              items: processedItems,
              associatedClaims: selectedClaims,
            }));
          });
        } else {
          console.log("⚠️ No claim items found");
          setExpenseData((prev) => ({
            ...prev,
            items: [],
            associatedClaims: selectedClaims,
          }));
        }
      } else {
        console.log("⚠️ No selected claim objects found");
        setExpenseData((prev) => ({
          ...prev,
          items: [],
          associatedClaims: selectedClaims,
        }));
      }
    } else if (selectedClaims.length === 0) {
      console.log("🔄 Clearing items - no claims selected");
      setExpenseData((prev) => ({
        ...prev,
        items: [],
        associatedClaims: [],
      }));
    }
  }, [selectedClaims, availableClaims, expenseData.currency]);

  // Currency conversion function using real API with custom rates support
  const convertCurrency = async (fromCurrency, toCurrency, amount) => {
    if (fromCurrency === toCurrency || amount === 0) {
      return { convertedAmount: amount, rate: 1 };
    }
    try {
      console.log("fromCurrency", fromCurrency);
      console.log("toCurrency", toCurrency);
      console.log("amount", amount);
      console.log("businessId", expenseData.business);
      console.log(
        `Converting ${amount} from ${fromCurrency} to ${toCurrency} (Business: ${expenseData.business})`
      );
      const response = await axios.get(`${Base_URL}/currency/convert`, {
        params: {
          from: fromCurrency,
          to: toCurrency,
          amount,
          businessId: expenseData.business,
        },
        headers,
      });
      console.log("response", response.data);
      if (response.data.success) {
        console.log("Conversion result:", response.data);
        return {
          convertedAmount: response.data.convertedAmount,
          rate: response.data.rate || response.data.convertedAmount / amount,
        };
      }
    } catch (error) {
      console.error("Currency conversion failed:", error);
      notifyError(
        `Failed to convert currency: ${
          error.response?.data?.error || error.message
        }`
      );
    }
    return { convertedAmount: amount, rate: 1 };
  };

  const fetchData = async () => {
    // Only set loading when we have a business selected (not on initial load)
    if (expenseData.business) {
      setIsLoadingData(true);
    }

    try {
      // Fetch businesses
      const storedBusinesses = localStorage.getItem("businesses");
      if (storedBusinesses) {
        setBusinesses(JSON.parse(storedBusinesses));
      }

      // Only fetch business-specific data if business is selected
      if (expenseData.business) {
        // Fetch vendors, employees, accounts, bank accounts, and contracts
        const [
          vendorsRes,
          employeesRes,
          chartAccountsRes,
          bankAccountsRes,
          salesContractsRes,
          purchaseContractsRes,
        ] = await Promise.all([
          axios.get(`${Base_URL}/vendors/all/${expenseData.business}`, {
            headers,
          }),
          axios.get(`${Base_URL}/staff-management`, {
            params: { business: expenseData.business, limit: 1000 },
            headers,
          }),
          axios.get(`${Base_URL}/accounts`, {
            params: { business: expenseData.business },
            headers,
          }),
          axios.get(`${Base_URL}/bank-management/accounts`, {
            params: { business: expenseData.business },
            headers,
          }),
          axios.get(`${Base_URL}/sales-contracts`, {
            params: { businessId: expenseData.business },
            headers,
          }),
          axios.get(`${Base_URL}/purchase-contracts`, {
            headers,
          }),
        ]);

        setVendors(vendorsRes.data.data || []);
        setEmployees(employeesRes.data.staffList || []);
        setExpenseAccounts(chartAccountsRes.data.accounts || []);
        setBankAccounts(bankAccountsRes.data.accounts || []);
        setSalesContracts(salesContractsRes.data.contracts || []);
        setPurchaseContracts(purchaseContractsRes.data.contracts || []);
      } else {
        // Clear data when no business is selected
        setVendors([]);
        setEmployees([]);
        setExpenseAccounts([]);
        setBankAccounts([]);
        setSalesContracts([]);
        setPurchaseContracts([]);
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
      setExpenseData((prev) => ({
        ...prev,
        [name]: value,
        vendor: "",
        employee: "",
        expenseAccount: "",
        paidFromBankAccount: "",
      }));
    } else {
      setExpenseData((prev) => ({ ...prev, [name]: value }));
    }

    // Clear form errors when user starts typing
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleAddItem = async () => {
    const errors = {};

    if (!addItemData.item_name.trim()) {
      errors.item_name = "Item name is required";
    }

    if (addItemData.amount <= 0) {
      errors.amount = "Amount must be greater than 0";
    }

    if (
      !addItemData.expenseAccount ||
      addItemData.expenseAccount.trim() === ""
    ) {
      errors.expenseAccount = "Expense account is required";
    }

    setItemModalErrors(errors);

    if (Object.keys(errors).length > 0) {
      notifyError("Please fix the errors before adding item");
      return;
    }

    const discountAmount = (addItemData.amount * addItemData.discount) / 100;
    const itemAmountAfterDiscount = addItemData.amount - discountAmount;

    let convertedAmount = itemAmountAfterDiscount;
    let exchangeRate = 1;

    // Convert to main currency if different
    if (addItemData.currency !== expenseData.currency) {
      try {
        const { convertedAmount: conv, rate } = await convertCurrency(
          addItemData.currency,
          expenseData.currency,
          itemAmountAfterDiscount
        );
        convertedAmount = conv;
        exchangeRate = rate;
      } catch (error) {
        convertedAmount = itemAmountAfterDiscount;
      }
    }

    const newItem = {
      id: expenseData.items.length + 1,
      item_name: addItemData.item_name,
      amount: parseFloat(addItemData.amount),
      currency: addItemData.currency,
      discount: addItemData.discount,
      discountAmount: discountAmount,
      convertedAmount: convertedAmount,
      exchangeRate: exchangeRate,
      notes: addItemData.notes,
      attachment: addItemData.attachment,
      expenseAccount:
        addItemData.expenseAccount &&
        typeof addItemData.expenseAccount === "string" &&
        addItemData.expenseAccount.trim() !== ""
          ? addItemData.expenseAccount.trim()
          : null, // Send null explicitly (JSON will include it, backend will handle)
      contractType: addItemData.contractType,
      contractId: addItemData.contractId,
      contractNumber: addItemData.contractNumber,
    };

    console.log("➕ Adding new item:", {
      item_name: newItem.item_name,
      expenseAccount: newItem.expenseAccount,
      expenseAccountType: typeof newItem.expenseAccount,
      addItemDataExpenseAccount: addItemData.expenseAccount,
    });

    const updatedItems = [...expenseData.items, newItem];
    const subtotal = updatedItems.reduce(
      (sum, item) => sum + (item.convertedAmount || item.amount),
      0
    );
    const total = subtotal + (parseFloat(expenseData.taxAmount) || 0);

    setExpenseData((prev) => ({
      ...prev,
      items: updatedItems,
      subtotal,
      total,
    }));

    // Reset modal data
    setAddItemData({
      item_name: "",
      amount: 0,
      currency: "USD",
      discount: 0,
      notes: "",
      attachment: "",
      expenseAccount: "",
      contractType: "",
      contractId: "",
      contractNumber: "",
    });
    setItemModalErrors({});
    setShowAddItemModal(false);
    notifySuccess("Item added successfully");
  };

  const handleRemoveItem = (index) => {
    const updatedItems = expenseData.items.filter((_, i) => i !== index);
    const subtotal = updatedItems.reduce(
      (sum, item) => sum + (item.convertedAmount || item.amount),
      0
    );
    const total = subtotal + (parseFloat(expenseData.taxAmount) || 0);

    setExpenseData((prev) => ({
      ...prev,
      items: updatedItems,
      subtotal,
      total,
    }));
  };

  const validateForm = () => {
    const errors = {};

    if (!expenseData.business) errors.business = "Business is required";
    if (expenseData.expenseType === "staff_claims" && !expenseData.employee) {
      errors.employee = "Employee is required for staff claims";
    }
    if (expenseData.expenseType !== "staff_claims" && !expenseData.vendor) {
      errors.vendor = "Vendor is required";
    }
    if (!expenseData.expenseAccount)
      errors.expenseAccount = "Expense account is required";
    if (!expenseData.paidFromBankAccount)
      errors.paidFromBankAccount = "Pay from bank account is required";
    if (!expenseData.reference || expenseData.reference.trim() === "")
      errors.reference = "Reference number is required";
    if (!expenseData.items || expenseData.items.length === 0) {
      errors.items = "At least one expense item is required";
    }

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
      const expenseDataToSubmit = {
        business: expenseData.business,
        vendor:
          expenseData.expenseType !== "staff_claims"
            ? expenseData.vendor
            : undefined,
        employee:
          expenseData.expenseType === "staff_claims"
            ? expenseData.employee
            : undefined,
        expenseType: expenseData.expenseType,
        expenseDate: new Date(expenseData.expenseDate),
        dueDate: new Date(expenseData.dueDate),
        expenseAccount: expenseData.expenseAccount,
        paidFromBankAccount: expenseData.paidFromBankAccount || undefined,
        items: expenseData.items,
        subtotal: expenseData.subtotal,
        taxAmount: parseFloat(expenseData.taxAmount) || 0,
        total: expenseData.total,
        currency: expenseData.currency,
        terms: expenseData.terms,
        notes: expenseData.notes,
        reference: expenseData.reference,
        supportingDocuments: expenseData.supportingDocuments,
        status: status,
        // CRITICAL FIX: Include associatedClaims for staff claim expenses
        associatedClaims:
          expenseData.expenseType === "staff_claims"
            ? selectedClaims.filter((claimId) => claimId && claimId !== null)
            : [],
      };

      console.log("💾 Submitting expense data:", expenseDataToSubmit);
      console.log("📋 Selected claim IDs:", selectedClaims);
      console.log(
        "🔗 Associated claim IDs being sent:",
        expenseDataToSubmit.associatedClaims
      );
      console.log("📦 Items being sent:", expenseDataToSubmit.items);
      console.log(
        "📦 Items expenseAccount details:",
        expenseDataToSubmit.items.map((item, idx) => ({
          index: idx,
          item_name: item.item_name,
          expenseAccount: item.expenseAccount,
          expenseAccountType: typeof item.expenseAccount,
        }))
      );

      const response = await axios.post(
        `${Base_URL}/expenses`,
        expenseDataToSubmit,
        { headers }
      );

      console.log("response", response);

      if (response.data.success) {
        notifySuccess("Expense created successfully!");
        history.push("/expenses");
      } else notifyError("Failed to create expense");
    } catch (error) {
      console.error("Error creating expense:", error);
      notifyError(error.response?.data?.message || "Failed to create expense");
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
      // Use the same document upload API as VendorInvoices
      const formDataForUpload = new FormData();
      formDataForUpload.append(
        "file_path",
        `Expenses/${expenseData.expenseNumber || Date.now()}`
      );
      formDataForUpload.append("business_id", expenseData?.business);
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
        };

        setExpenseData((prev) => ({
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
    setExpenseData((prev) => ({
      ...prev,
      supportingDocuments: prev.supportingDocuments.filter(
        (_, i) => i !== index
      ),
    }));
    notifySuccess("Document removed successfully");
  };

  const handleTaxChange = (e) => {
    const value = e.target.value;
    // Allow empty string while typing
    if (value === "") {
      setExpenseData((prev) => ({
        ...prev,
        taxAmount: "",
        total: prev.subtotal,
      }));
      return;
    }

    // Prevent negative values
    const parsedValue = parseFloat(value);
    if (isNaN(parsedValue) || parsedValue < 0) {
      // If negative or invalid, don't update the state
      return;
    }

    const taxAmount = parsedValue;

    setExpenseData((prev) => ({
      ...prev,
      taxAmount: value, // Store as string to allow clearing
      total: prev.subtotal + taxAmount,
    }));
  };

  const handleTaxBlur = (e) => {
    const value = e.target.value;
    const taxAmount = value === "" ? 0 : Math.max(0, parseFloat(value) || 0);

    setExpenseData((prev) => ({
      ...prev,
      taxAmount: taxAmount.toString(), // Convert to string for display
      total: prev.subtotal + taxAmount,
    }));
  };

  const handleTaxKeyDown = (e) => {
    // Prevent minus sign, 'e', 'E', '+', and '.' if already present
    if (e.key === "-" || e.key === "e" || e.key === "E" || e.key === "+") {
      e.preventDefault();
    }
    // Prevent multiple decimal points
    if (e.key === "." && e.target.value.includes(".")) {
      e.preventDefault();
    }
  };

  // Helper: Map claim items to expense items
  const mapClaimItemsToExpenseItems = (claimItems) => {
    return claimItems.map((item, idx) => ({
      id: idx + 1,
      item_name: item.claimType?.name || item.purpose || "Claim Item",
      amount: parseFloat(item.claimableAmount) || 0,
      currency: item.currency?.name || "USD",
      discount: 0,
      discountAmount: 0,
      convertedAmount: parseFloat(item.claimableAmount) || 0,
      exchangeRate: 1,
      notes: item.remarks || item.purpose || "",
      attachment: "",
      expenseAccount: "", // Will use the expense-level account if not specified
    }));
  };

  // Fetch approved claims for employee
  const fetchAvailableClaimsForEmployee = async (employeeId) => {
    setIsCheckingClaims(true);
    setClaimCheckMessage("Checking for available claims...");
    try {
      const response = await axios.get(
        `${Base_URL}/claims/employee/${employeeId}/available-for-expense`,
        { headers }
      );
      const claimsFromBackend = response.data.data || [];
      console.log("claims from backend", claimsFromBackend);

      // Additional frontend filtering to ensure claims already used for expenses are excluded
      // Since backend already filters by All invoice types have already been created for this contract.: false, this extra filter is for safety
      const availableClaimsFiltered = claimsFromBackend.filter(
        (claim) => claim.status === "Approved" && !claim.isExpenseCreated
      );

      console.log("Claims from backend:", claimsFromBackend);
      console.log("Filtered available claims:", availableClaimsFiltered);

      setAvailableClaims(availableClaimsFiltered);

      if (availableClaimsFiltered.length > 0) {
        setClaimCheckMessage(
          `Found ${availableClaimsFiltered.length} available claims. Please select claims to include in expense.`
        );
      } else {
        setClaimCheckMessage(
          "No available claims found. You can create items manually."
        );
      }

      // Clear previous selections
      setSelectedClaims([]);
      setExpenseData((prev) => ({ ...prev, items: [], associatedClaims: [] }));

      // If we have a URL claimId and this is the first load, pre-select it
      if (urlClaimId && availableClaimsFiltered.length > 0) {
        const claimExists = availableClaimsFiltered.some(
          (claim) => claim._id === urlClaimId
        );
        if (claimExists) {
          setSelectedClaims([urlClaimId]);
          console.log("Pre-selecting claim from URL:", urlClaimId);
        }
      }
    } catch (error) {
      console.error("Error fetching claims:", error);
      setClaimCheckMessage(
        "Error checking claims. You can create items manually."
      );
      setAvailableClaims([]);
      setSelectedClaims([]);
    } finally {
      setIsCheckingClaims(false);
    }
  };

  const handleClaimSelection = async (claimId, isSelected) => {
    let newSelectedClaims;
    if (isSelected) {
      newSelectedClaims = [...selectedClaims, claimId];
    } else {
      newSelectedClaims = selectedClaims.filter((id) => id !== claimId);
    }
    setSelectedClaims(newSelectedClaims);
    // The useEffect will handle processing the selected claims and updating expense items
  };

  // Watch for employee selection when type is staff_claims
  useEffect(() => {
    if (
      expenseData.expenseType === "staff_claims" &&
      expenseData.employee &&
      expenseData.employee !== ""
    ) {
      fetchAvailableClaimsForEmployee(expenseData.employee);
    } else if (expenseData.expenseType === "staff_claims") {
      setExpenseData((prev) => ({ ...prev, items: [], associatedClaims: [] }));
      setAvailableClaims([]);
      setSelectedClaims([]);
      setClaimCheckMessage("");
    }
    // eslint-disable-next-line
  }, [expenseData.expenseType, expenseData.employee]);

  // Recalculate totals whenever items change
  useEffect(() => {
    const subtotal = expenseData.items.reduce(
      (sum, item) => sum + (item.convertedAmount || item.amount),
      0
    );
    const total = subtotal + (parseFloat(expenseData.taxAmount) || 0);

    setExpenseData((prev) => ({
      ...prev,
      subtotal,
      total,
    }));
  }, [expenseData.items, expenseData.taxAmount]);

  // Add a useEffect to reconvert all items when expenseData.currency changes
  useEffect(() => {
    const reconvertItems = async () => {
      const newItems = await Promise.all(
        expenseData.items.map(async (item) => {
          let convertedAmount = item.amount;
          let exchangeRate = 1;
          if (item.currency !== expenseData.currency) {
            try {
              const { convertedAmount: conv, rate } = await convertCurrency(
                item.currency,
                expenseData.currency,
                item.amount
              );
              convertedAmount = conv;
              exchangeRate = rate;
            } catch (error) {
              convertedAmount = item.amount;
            }
          }
          return { ...item, convertedAmount, exchangeRate };
        })
      );
      setExpenseData((prev) => ({
        ...prev,
        items: newItems,
      }));
    };
    if (expenseData.items.length > 0) {
      reconvertItems();
    }
    // eslint-disable-next-line
  }, [expenseData.currency]);

  const renderAddItemModal = () => {
    if (!showAddItemModal) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">
              Add Expense Item
            </h3>
            <button
              onClick={() => setShowAddItemModal(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-gray-700 mb-2">Item Name *</label>
              <input
                type="text"
                value={addItemData.item_name}
                onChange={(e) => {
                  setAddItemData((prev) => ({
                    ...prev,
                    item_name: e.target.value,
                  }));
                  if (itemModalErrors.item_name) {
                    setItemModalErrors((prev) => ({
                      ...prev,
                      item_name: "",
                    }));
                  }
                }}
                placeholder="e.g., Taxi fare, Lunch, Office rent"
                className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] ${
                  itemModalErrors.item_name
                    ? "border-red-500"
                    : "border-gray-300"
                }`}
              />
              {itemModalErrors.item_name && (
                <div className="text-red-500 text-xs mt-1">
                  {itemModalErrors.item_name}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-gray-700 mb-2">Amount *</label>
                <input
                  type="number"
                  value={addItemData.amount}
                  onChange={(e) => {
                    setAddItemData((prev) => ({
                      ...prev,
                      amount: e.target.value,
                    }));
                    if (itemModalErrors.amount) {
                      setItemModalErrors((prev) => ({
                        ...prev,
                        amount: "",
                      }));
                    }
                  }}
                  placeholder="0.00"
                  className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] ${
                    itemModalErrors.amount
                      ? "border-red-500"
                      : "border-gray-300"
                  }`}
                  step="0.01"
                  min="0"
                />
                {itemModalErrors.amount && (
                  <div className="text-red-500 text-xs mt-1">
                    {itemModalErrors.amount}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-gray-700 mb-2">Currency *</label>
                <SearchableDropdown
                  value={addItemData.currency}
                  onChange={(e) =>
                    setAddItemData((prev) => ({
                      ...prev,
                      currency: e.target.value,
                    }))
                  }
                  placeholder="Select Currency"
                  searchPlaceholder="Search currencies..."
                  options={currencyOptions.map((currency) => ({
                    value: currency.value,
                    label: currency.label,
                    symbol: currency.value,
                    prefix:
                      currency.label.split("(")[1]?.replace(")", "") || "",
                    rate: currency.conversionRate,
                  }))}
                  searchKeys={["symbol", "prefix"]}
                  renderOption={(option) => (
                    <div>
                      <div className="font-medium">{option.symbol}</div>
                      <div className="text-xs text-gray-500">
                        {option.prefix}
                      </div>
                    </div>
                  )}
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-700 mb-2">Discount (%)</label>
              <input
                type="number"
                value={addItemData.discount}
                onChange={(e) =>
                  setAddItemData((prev) => ({
                    ...prev,
                    discount: e.target.value,
                  }))
                }
                placeholder="0"
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
                step="0.01"
                min="0"
                max="100"
              />
            </div>

            <div>
              <label className="block text-gray-700 mb-2">
                Expense Account *
              </label>
              <SearchableDropdown
                value={addItemData.expenseAccount}
                onChange={(e) => {
                  const selectedValue = e.target.value;
                  setAddItemData((prev) => ({
                    ...prev,
                    expenseAccount: selectedValue,
                  }));
                  if (itemModalErrors.expenseAccount) {
                    setItemModalErrors((prev) => ({
                      ...prev,
                      expenseAccount: "",
                    }));
                  }
                }}
                placeholder="Select expense account"
                searchPlaceholder="Search expense accounts..."
                clearable={true}
                className={
                  itemModalErrors.expenseAccount ? "border-red-500" : ""
                }
                options={[
                  ...(expenseAccounts?.map((account) => ({
                    value: account._id,
                    label: `${account.code || "N/A"} - ${
                      account.accountName
                    } (${
                      account.accountType?.name ||
                      account.accountType?.accountHeader ||
                      "Unknown Type"
                    })`,
                    name: account.accountName,
                    type:
                      account.accountType?.name ||
                      account.accountType?.accountHeader ||
                      "Unknown Type",
                    code: account.code || "N/A",
                  })) || []),
                ]}
                searchKeys={["name", "type", "code"]}
                renderOption={(option) => (
                  <div>
                    <div className="font-medium">
                      {option.code && option.code !== "N/A"
                        ? `${option.code} - `
                        : ""}
                      {option.name || option.label}
                    </div>
                    {option.type && (
                      <div className="text-xs text-gray-500">{option.type}</div>
                    )}
                  </div>
                )}
              />
              {itemModalErrors.expenseAccount && (
                <div className="text-red-500 text-xs mt-1">
                  {itemModalErrors.expenseAccount}
                </div>
              )}
            </div>

            <div>
              <label className="block text-gray-700 mb-2">
                Contract (Optional)
              </label>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setAddItemData((prev) => ({
                        ...prev,
                        contractType: "sales",
                        contractId: "",
                      }))
                    }
                    className={`p-2 text-sm rounded border ${
                      addItemData.contractType === "sales"
                        ? "border-[var(--p-blue)] bg-[#f0fbf7] text-[var(--p-blue)]"
                        : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                    }`}
                  >
                    Sales Contract
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setAddItemData((prev) => ({
                        ...prev,
                        contractType: "purchase",
                        contractId: "",
                      }))
                    }
                    className={`p-2 text-sm rounded border ${
                      addItemData.contractType === "purchase"
                        ? "border-[var(--p-blue)] bg-[#f0fbf7] text-[var(--p-blue)]"
                        : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                    }`}
                  >
                    Purchase Contract
                  </button>
                </div>

                {addItemData.contractType && (
                  <SearchableDropdown
                    value={addItemData.contractId}
                    onChange={(e) => {
                      const selectedContract = (
                        addItemData.contractType === "sales"
                          ? salesContracts
                          : purchaseContracts
                      )?.find((contract) => contract._id === e.target.value);

                      setAddItemData((prev) => ({
                        ...prev,
                        contractId: e.target.value,
                        contractNumber: selectedContract?.contractNo || "",
                      }));
                    }}
                    placeholder={`Select ${
                      addItemData.contractType === "sales"
                        ? "Sales"
                        : "Purchase"
                    } Contract`}
                    searchPlaceholder={`Search ${
                      addItemData.contractType === "sales"
                        ? "sales"
                        : "purchase"
                    } contracts...`}
                    clearable={true}
                    options={
                      (addItemData.contractType === "sales"
                        ? salesContracts
                        : purchaseContracts
                      )?.map((contract) => ({
                        value: contract._id,
                        label: `${contract.contractNo} - ${
                          addItemData.contractType === "sales"
                            ? contract.basicInfo?.buyerCompanyName ||
                              "Unknown Buyer"
                            : contract.basicInfo?.selectedVendorId
                                ?.basicInformation?.vendorDisplayName ||
                              "Unknown Vendor"
                        }`,
                        contractNo: contract.contractNo,
                        company:
                          addItemData.contractType === "sales"
                            ? contract.basicInfo?.buyerCompanyName ||
                              "Unknown Buyer"
                            : contract.basicInfo?.selectedVendorId
                                ?.basicInformation?.vendorDisplayName ||
                              "Unknown Vendor",
                        status: contract.status,
                      })) || []
                    }
                    searchKeys={["contractNo", "company", "status"]}
                    renderOption={(option) => (
                      <div>
                        <div className="font-medium">{option.contractNo}</div>
                        <div className="text-xs text-gray-500">
                          {option.company}
                        </div>
                        {option.status && (
                          <div className="text-xs text-gray-400">
                            {option.status}
                          </div>
                        )}
                      </div>
                    )}
                  />
                )}
              </div>
            </div>

            <div>
              <label className="block text-gray-700 mb-2">Notes</label>
              <textarea
                value={addItemData.notes}
                onChange={(e) =>
                  setAddItemData((prev) => ({ ...prev, notes: e.target.value }))
                }
                placeholder="Additional details about this expense"
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] resize-none"
                rows="3"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setShowAddItemModal(false)}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleAddItem}
              className="flex-1 px-4 py-2 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[#9CBA33]"
            >
              Add Item
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 bg-gray-50 h-full max-h-[90vh] overflow-y-auto pb-[120px] ">
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
        Create New Expense
      </h1>

      {/* Expense Type Selection */}
      <div className="bg-white p-6 rounded-lg mb-6 shadow-sm">
        <h2 className="text-lg font-medium mb-4 text-gray-800">Expense Type</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { value: "bills", label: "Bills", icon: FileText, color: "blue" },
            {
              value: "staff_claims",
              label: "Staff Claims",
              icon: Users,
              color: "purple",
            },
            { value: "rents", label: "Rents", icon: Building, color: "green" },
            // {
            //   value: "non_trading_invoices",
            //   label: "Non-trading Invoices",
            //   icon: Receipt,
            //   color: "orange",
            // },
          ].map((type) => {
            const IconComponent = type.icon;
            return (
              <button
                key={type.value}
                type="button"
                onClick={() =>
                  setExpenseData((prev) => ({
                    ...prev,
                    expenseType: type.value,
                  }))
                }
                className={`p-6 rounded-lg border-2 transition-all text-left ${
                  expenseData.expenseType === type.value
                    ? "border-[var(--p-blue)] bg-[#f0fbf7]"
                    : "border-gray-300 bg-white hover:border-gray-400"
                }`}
              >
                <div className="flex items-center mb-3">
                  <IconComponent
                    size={24}
                    className={
                      expenseData.expenseType === type.value
                        ? "text-[var(--p-blue)]"
                        : "text-gray-600"
                    }
                  />
                  <span
                    className={`ml-3 text-lg font-medium ${
                      expenseData.expenseType === type.value
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

      {/* Vendor/Employee Section */}
      <div className="bg-[#f0fbf7] p-6 rounded-lg mb-6">
        <h2 className="text-lg font-medium mb-4 text-gray-800 flex items-center gap-2">
          {expenseData.expenseType === "staff_claims"
            ? "Employee Information"
            : "Vendor Information"}
          {isLoadingData && (
            <div className="flex items-center gap-2 text-sm text-[var(--p-blue)]">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--p-blue)]"></div>
              Loading data...
            </div>
          )}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-gray-700 mb-2">Business *</label>
            <SearchableDropdown
              name="business"
              value={expenseData.business}
              onChange={handleInputChange}
              placeholder="Select Business"
              searchPlaceholder="Search businesses..."
              options={
                businesses?.map((business) => ({
                  value: business._id,
                  label: business.name,
                  name: business.name,
                  email: business.email,
                })) || []
              }
              searchKeys={["name", "email"]}
              renderOption={(option) => (
                <div>
                  <div className="font-medium">{option.name}</div>
                  {option.email && (
                    <div className="text-xs text-gray-500">{option.email}</div>
                  )}
                </div>
              )}
            />
            {formErrors.business && (
              <div className="text-red-500 text-xs mt-1">
                {formErrors.business}
              </div>
            )}
          </div>

          {expenseData.expenseType === "staff_claims" ? (
            <div>
              <label className="block text-gray-700 mb-2">Employee *</label>
              <SearchableDropdown
                name="employee"
                value={expenseData.employee}
                onChange={handleInputChange}
                placeholder={
                  isLoadingData
                    ? "Loading employees..."
                    : !expenseData.business
                    ? "Select business first"
                    : "Select Employee"
                }
                searchPlaceholder="Search employees..."
                disabled={isLoadingData || !expenseData.business}
                loading={isLoadingData}
                loadingText="Loading employees..."
                options={
                  employees?.map((employee) => ({
                    value: employee._id,
                    label: employee.displayName,
                    name: employee.displayName,
                    email: employee.email,
                    department:
                      typeof employee.department === "object" &&
                      employee.department !== null
                        ? employee.department.name || employee.department
                        : employee.department,
                  })) || []
                }
                searchKeys={["name", "email", "department"]}
                renderOption={(option) => (
                  <div>
                    <div className="font-medium">{option.name}</div>
                    {option.email && (
                      <div className="text-xs text-gray-500">
                        {option.email}
                      </div>
                    )}
                    {option.department && (
                      <div className="text-xs text-gray-400">
                        {typeof option.department === "object" &&
                        option.department !== null
                          ? option.department.name || String(option.department)
                          : option.department}
                      </div>
                    )}
                  </div>
                )}
              />
              {formErrors.employee && (
                <div className="text-red-500 text-xs mt-1">
                  {formErrors.employee}
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-gray-700 mb-2">Vendor *</label>
              <SearchableDropdown
                name="vendor"
                value={expenseData.vendor}
                onChange={handleInputChange}
                placeholder={
                  isLoadingData
                    ? "Loading vendors..."
                    : !expenseData.business
                    ? "Select business first"
                    : "Select Vendor"
                }
                searchPlaceholder="Search vendors..."
                disabled={isLoadingData || !expenseData.business}
                loading={isLoadingData}
                loadingText="Loading vendors..."
                options={
                  vendors?.map((vendor) => ({
                    value: vendor._id,
                    label:
                      vendor.basicInformation?.vendorDisplayName || vendor.name,
                    name:
                      vendor.basicInformation?.vendorDisplayName || vendor.name,
                    email: vendor.basicInformation?.email,
                    company: vendor.basicInformation?.companyName,
                  })) || []
                }
                searchKeys={["name", "email", "company"]}
                renderOption={(option) => (
                  <div>
                    <div className="font-medium">{option.name}</div>
                    {option.email && (
                      <div className="text-xs text-gray-500">
                        {option.email}
                      </div>
                    )}
                    {option.company && (
                      <div className="text-xs text-gray-400">
                        {option.company}
                      </div>
                    )}
                  </div>
                )}
              />
              {formErrors.vendor && (
                <div className="text-red-500 text-xs mt-1">
                  {formErrors.vendor}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Claims Selection for Staff Claims */}
        {expenseData.expenseType === "staff_claims" && expenseData.employee && (
          <div className="mt-6">
            <label className="block text-gray-700 mb-2">Available Claims</label>
            {isCheckingClaims ? (
              <div className="flex items-center gap-2 text-sm text-[var(--p-blue)] p-4 bg-blue-50 rounded-lg">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--p-blue)]"></div>
                {claimCheckMessage}
              </div>
            ) : claimCheckMessage ? (
              <div className="text-sm text-gray-600 p-4 bg-gray-50 rounded-lg mb-3">
                {claimCheckMessage}
              </div>
            ) : null}

            {availableClaims.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-300 rounded-lg p-3">
                {availableClaims.map((claim) => (
                  <div
                    key={claim._id}
                    className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      id={`claim-${claim._id}`}
                      checked={selectedClaims.includes(claim._id)}
                      onChange={(e) =>
                        handleClaimSelection(claim._id, e.target.checked)
                      }
                      className="mt-1 h-4 w-4 text-[var(--p-blue)] focus:ring-[var(--p-blue)] border-gray-300 rounded"
                    />
                    <label
                      htmlFor={`claim-${claim._id}`}
                      className="flex-1 cursor-pointer"
                    >
                      <div className="font-medium text-gray-800">
                        Claim #{claim.claimReference}
                      </div>
                      <div className="text-sm text-gray-600">
                        Total:{" "}
                        {claim.totalClaimableAmount?.toFixed(2) || "0.00"} (
                        {claim.itemCount} items)
                      </div>
                      <div className="text-xs text-gray-500">
                        Created:{" "}
                        {new Date(claim.createdAt).toLocaleDateString()}
                      </div>
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-700 mb-2">
              Expense Account *
            </label>
            <SearchableDropdown
              name="expenseAccount"
              value={expenseData.expenseAccount}
              onChange={handleInputChange}
              placeholder={
                isLoadingData
                  ? "Loading accounts..."
                  : !expenseData.business
                  ? "Select business first"
                  : "Select Expense Account"
              }
              searchPlaceholder="Search expense accounts..."
              disabled={isLoadingData || !expenseData.business}
              loading={isLoadingData}
              loadingText="Loading accounts..."
              options={
                expenseAccounts?.map((account) => ({
                  value: account._id,
                  label: `${account.code || "N/A"} - ${account.accountName} (${
                    account.accountType.name
                  } (${account.accountType.accountHeader}))`,
                  name: account.accountName,
                  type: account.accountType.name,
                  header: account.accountType.accountHeader,
                  code: account.code || "N/A",
                })) || []
              }
              searchKeys={["name", "type", "header", "code"]}
              renderOption={(option) => (
                <div>
                  <div className="font-medium">
                    {option.code} - {option.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {option.type} ({option.header})
                  </div>
                </div>
              )}
            />
            {formErrors.expenseAccount && (
              <div className="text-red-500 text-xs mt-1">
                {formErrors.expenseAccount}
              </div>
            )}
          </div>

          <div>
            <label className="block text-gray-700 mb-2">
              Pay From Bank Account *
            </label>
            <SearchableDropdown
              name="paidFromBankAccount"
              value={expenseData.paidFromBankAccount}
              onChange={handleInputChange}
              placeholder={
                isLoadingData
                  ? "Loading bank accounts..."
                  : !expenseData.business
                  ? "Select business first"
                  : "Select Bank Account"
              }
              searchPlaceholder="Search bank accounts..."
              disabled={isLoadingData || !expenseData.business}
              loading={isLoadingData}
              loadingText="Loading bank accounts..."
              clearable={true}
              className={formErrors.paidFromBankAccount ? "border-red-500" : ""}
              options={
                bankAccounts?.map((account) => ({
                  value: account._id,
                  label: `${account.accountName} - ${account.bankName} (${
                    account.currencyType
                  } ${(account.openingBalance || 0).toFixed(2)})`,
                  name: account.accountName,
                  bank: account.bankName,
                  currency: account.currencyType,
                  balance: account.openingBalance || 0,
                })) || []
              }
              searchKeys={["name", "bank", "currency"]}
              renderOption={(option) => (
                <div>
                  <div className="font-medium">{option.name}</div>
                  <div className="text-xs text-gray-500">
                    {option.bank} - {option.currency}{" "}
                    {option.balance.toFixed(2)}
                  </div>
                </div>
              )}
            />
            {formErrors.paidFromBankAccount && (
              <div className="text-red-500 text-xs mt-1">
                {formErrors.paidFromBankAccount}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expense Details */}
      <div className="bg-white p-6 rounded-lg mb-6 shadow-sm">
        <h2 className="text-lg font-medium mb-4 text-gray-800">
          Expense Details
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-gray-700 mb-2">Expense Date</label>
            <div className="relative">
              <CustomDatePicker
                value={expenseData.expenseDate}
                onChange={(date) =>
                  setExpenseData({ ...expenseData, expenseDate: date })
                }
                bgColor="#FFFFFF"
              />
              <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                <Calendar className="h-5 w-5 text-gray-400" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-gray-700 mb-2">Due Date</label>
            <div className="relative">
              <CustomDatePicker
                value={expenseData.dueDate}
                onChange={(date) =>
                  setExpenseData({ ...expenseData, dueDate: date })
                }
                bgColor="#FFFFFF"
              />
              <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                <Calendar className="h-5 w-5 text-gray-400" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-gray-700 mb-2">Currency</label>
            <SearchableDropdown
              name="currency"
              value={expenseData.currency}
              onChange={handleInputChange}
              placeholder="Select Currency"
              searchPlaceholder="Search currencies..."
              options={currencyOptions.map((currency) => ({
                value: currency.value,
                label: currency.label,
                symbol: currency.value,
                prefix: currency.label.split("(")[1]?.replace(")", "") || "",
                rate: currency.conversionRate,
              }))}
              searchKeys={["symbol", "prefix"]}
              renderOption={(option) => (
                <div>
                  <div className="font-medium">{option.symbol}</div>
                  <div className="text-xs text-gray-500">{option.prefix}</div>
                </div>
              )}
            />
          </div>

          <div>
            <label className="block text-gray-700 mb-2">Reference *</label>
            <input
              type="text"
              name="reference"
              value={expenseData.reference}
              onChange={handleInputChange}
              placeholder="Reference number"
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
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-700 mb-2">Payment Terms</label>
            <input
              type="text"
              name="terms"
              value={expenseData.terms}
              onChange={handleInputChange}
              placeholder="Enter payment terms"
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
            />
          </div>

          <div>
            <label className="block text-gray-700 mb-2">Notes</label>
            <textarea
              name="notes"
              value={expenseData.notes}
              onChange={handleInputChange}
              placeholder="Additional notes"
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] resize-none"
              rows="3"
            />
          </div>
        </div>
      </div>

      {/* Items Section */}
      <div className="bg-white p-6 rounded-lg mb-6 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium text-gray-800">Expense Items</h2>
          <button
            type="button"
            onClick={() => setShowAddItemModal(true)}
            className="flex items-center px-4 py-2 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[#9CBA33] transition-colors"
            disabled={isCheckingClaims}
          >
            <Plus size={16} className="mr-2" />
            Add Item
          </button>
        </div>
        {isCheckingClaims && (
          <div className="text-center py-4 text-[var(--p-blue)] font-medium">
            Checking for approved claims...
          </div>
        )}
        {!isCheckingClaims && claimCheckMessage && (
          <div className="text-center py-4 text-gray-500 font-medium">
            {claimCheckMessage}
          </div>
        )}
        {expenseData.items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Item Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount & Currency
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Discount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Converted Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Expense Account
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contract
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Notes
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {expenseData.items.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.item_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        <div className="font-medium">
                          {item.currency} {item.amount.toFixed(2)}
                        </div>
                        {item.currency !== expenseData.currency && (
                          <div className="text-xs text-gray-500">
                            Original currency
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.discount > 0 ? (
                        <div>
                          <div className="text-orange-600">
                            {item.discount}%
                          </div>
                          <div className="text-xs text-gray-500">
                            -{item.currency}{" "}
                            {item.discountAmount?.toFixed(2) || 0}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">No discount</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        <div className="font-medium text-green-600">
                          {expenseData.currency}{" "}
                          {(item.convertedAmount || item.amount).toFixed(2)}
                        </div>
                        {item.currency !== expenseData.currency && (
                          <div className="text-xs text-gray-500">
                            Rate: {item.exchangeRate?.toFixed(4) || 1}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {item.expenseAccount ? (
                        <div>
                          <div className="font-medium text-blue-600">
                            {(() => {
                              const account = expenseAccounts.find(
                                (acc) => acc._id === item.expenseAccount
                              );
                              return account
                                ? `${account.code || "N/A"} - ${
                                    account.accountName
                                  }`
                                : "Unknown Account";
                            })()}
                          </div>
                          <div className="text-xs text-gray-500">
                            {expenseAccounts.find(
                              (acc) => acc._id === item.expenseAccount
                            )?.accountType?.name || ""}
                          </div>
                        </div>
                      ) : (
                        <div className="text-gray-500 italic">
                          Uses main account
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {item.contractType && item.contractId ? (
                        <div>
                          <div className="font-medium text-purple-600">
                            {item.contractType === "sales"
                              ? "Sales"
                              : "Purchase"}{" "}
                            Contract
                          </div>
                          <div className="text-xs text-gray-500">
                            {item.contractNumber ||
                              (item.contractId &&
                              typeof item.contractId === "object"
                                ? item.contractId.contractNo
                                : `ID: ${item.contractId}`)}
                          </div>
                        </div>
                      ) : (
                        <div className="text-gray-500 italic">
                          No contract linked
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {item.notes || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <button
                        onClick={() => handleRemoveItem(index)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <Package className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No items</h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by adding your first expense item.
            </p>
          </div>
        )}

        {formErrors.items && (
          <div className="text-red-500 text-sm mt-2">{formErrors.items}</div>
        )}
      </div>

      {/* Expense Summary */}
      <div className="bg-white p-6 rounded-lg mb-6 shadow-sm">
        <h2 className="text-lg font-medium mb-4 text-gray-800">
          Expense Summary
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-gray-700 mb-2">Tax Amount</label>
              <input
                type="text"
                name="taxAmount"
                value={expenseData.taxAmount}
                onChange={handleTaxChange}
                onBlur={handleTaxBlur}
                onKeyDown={handleTaxKeyDown}
                placeholder="0.00"
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
                step="0.01"
              />
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-medium">
                  {expenseData.currency} {formatAmount(expenseData.subtotal)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Tax:</span>
                <span className="font-medium">
                  {expenseData.currency} {formatAmount(expenseData.taxAmount)}
                </span>
              </div>
              <div className="border-t pt-2">
                <div className="flex justify-between text-lg font-semibold">
                  <span>Total:</span>
                  <span className="text-[var(--p-blue)]">
                    {expenseData.currency} {formatAmount(expenseData.total)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Supporting Documents */}
      <div className="bg-white p-6 rounded-lg mb-6 shadow-sm">
        <h2 className="text-lg font-medium mb-4 text-gray-800">
          Supporting Documents
        </h2>

        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
          {expenseData.supportingDocuments.length > 0 ? (
            <div className="space-y-3">
              {expenseData.supportingDocuments.map((doc, index) => (
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

          {expenseData.supportingDocuments.length > 0 && (
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
          onClick={() => handleSubmit("Draft")}
          disabled={isLoading}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          Save as Draft
        </button>
        <button
          type="button"
          onClick={() => handleSubmit("Created")}
          disabled={isLoading}
          className="px-6 py-2 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[#9CBA33] disabled:opacity-50"
        >
          {isLoading ? "Creating..." : "Create Expense"}
        </button>
      </div>

      {/* Add Item Modal */}
      {renderAddItemModal()}
    </div>
  );
};

export default CreateExpense;
