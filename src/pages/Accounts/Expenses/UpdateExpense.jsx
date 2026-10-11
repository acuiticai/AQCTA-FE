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
  AlertTriangle,
} from "lucide-react";
import axios from "axios";
import { useHistory, useParams } from "react-router-dom";
import { notifyError, notifySuccess } from "@/utils/toast";
import { AdminContext } from "@/context/AdminContext";
import CustomDatePicker from "@/components/CustomDatePicker";
import SearchableDropdown from "@/components/SearchableDropdown";
import useAsync from "@/hooks/useAsync";
import CurrencyServices from "@/services/CurrencyServices";
import { formatAmount } from "@/components/formatAmount";

const UpdateExpense = () => {
  const { id } = useParams();
  const history = useHistory();
  const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingExpense, setIsLoadingExpense] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
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
  const [selectedBankAccount, setSelectedBankAccount] = useState(null);
  const [conversionDetails, setConversionDetails] = useState(null);
  const [isLoadingConversion, setIsLoadingConversion] = useState(false);

  // Claims related state
  const [claims, setClaims] = useState([]);
  const [selectedClaims, setSelectedClaims] = useState([]);
  const [isLoadingClaims, setIsLoadingClaims] = useState(false);
  const [originalAssociatedClaims, setOriginalAssociatedClaims] = useState([]);

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
    associatedClaims: [],
  });
  console.log("expenseData", expenseData);

  const [formErrors, setFormErrors] = useState({});
  const [itemModalErrors, setItemModalErrors] = useState({});

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
    // Initialize businesses first
    const initializeData = async () => {
      try {
        const storedBusinesses = localStorage.getItem("businesses");
        if (storedBusinesses) {
          setBusinesses(JSON.parse(storedBusinesses));
        }

        // Fetch expense data
        await fetchExpense();
      } catch (error) {
        console.error("Failed to initialize data:", error);
        notifyError("Failed to load initial data");
      }
    };

    initializeData();
  }, [id]);

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

  // Fetch additional data when business is available
  useEffect(() => {
    if (expenseData.business && !isLoadingExpense) {
      fetchData();
    }
  }, [expenseData.business, isLoadingExpense]);

  // Debug useEffect to track expense data changes
  useEffect(() => {
    console.log("Expense data changed:", expenseData);
    console.log("Employee in state:", expenseData.employee);
    console.log("Expense type in state:", expenseData.expenseType);
  }, [expenseData]);

  // Debug useEffect to track selectedClaims changes
  useEffect(() => {
    console.log("🔄 SELECTED CLAIMS CHANGED:");
    console.log("📋 New selectedClaims:", selectedClaims);
    console.log("📋 Count:", selectedClaims.length);
    if (selectedClaims.length > 0) {
      console.log(
        "📋 Selected claim IDs:",
        selectedClaims.map((c) => c._id)
      );
      console.log(
        "📋 Selected claim references:",
        selectedClaims.map((c) => c.claimReference)
      );
    }
  }, [selectedClaims]);

  // Debug useEffect to track originalAssociatedClaims changes
  useEffect(() => {
    console.log("🔄 ORIGINAL ASSOCIATED CLAIMS CHANGED:");
    console.log("📋 New originalAssociatedClaims:", originalAssociatedClaims);
    console.log("📋 Count:", originalAssociatedClaims.length);
  }, [originalAssociatedClaims]);

  // Recalculate totals whenever items or taxAmount change
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

  // Currency conversion function for items with custom rates support
  const convertCurrency = async (fromCurrency, toCurrency, amount) => {
    if (fromCurrency === toCurrency || amount === 0) {
      return amount;
    }

    try {
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

      if (response.data.success) {
        console.log("Conversion result:", response.data);
        return response.data.convertedAmount;
      }
    } catch (error) {
      console.error("Currency conversion failed:", error);
      notifyError(
        `Failed to convert currency: ${
          error.response?.data?.error || error.message
        }`
      );
    }

    return amount; // Fallback to original amount
  };

  // Currency conversion function - same as ViewVendorInvoice
  const getCurrencyConversion = async (fromCurrency, toCurrency, amount) => {
    // Validate input parameters
    if (!fromCurrency || !toCurrency || !amount || amount <= 0) {
      const error = `Invalid conversion parameters: from=${fromCurrency}, to=${toCurrency}, amount=${amount}`;
      console.error(`[Frontend] ${error}`);
      throw new Error("Invalid currency conversion parameters");
    }

    if (fromCurrency === toCurrency) {
      return {
        rate: 1,
        convertedAmount: amount,
        displayText: `${amount} ${fromCurrency} = ${amount} ${toCurrency}`,
        isRealTime: true,
        source: "same_currency",
      };
    }

    setIsLoadingConversion(true);
    try {
      console.log(
        `[Frontend] Converting: ${amount} ${fromCurrency} to ${toCurrency}`
      );

      const response = await axios.get(`${Base_URL}/currency/convert`, {
        params: {
          from: fromCurrency,
          to: toCurrency,
          amount,
          businessId: expenseData.business,
        },
        headers: {
          authorization: `Bearer ${adminInfo.token}`,
        },
      });

      if (response.data.success) {
        const result = response.data;

        console.log(`[Frontend] Conversion successful:`, result);

        // Show success notification for real-time rates
        if (result.isRealTime && result.source !== "same_currency") {
          notifySuccess(`✅ Live exchange rates from ${result.source}`);
        }

        return {
          rate: result.rate,
          convertedAmount: result.convertedAmount,
          displayText: result.displayText,
          rateDisplayText: result.rateDisplayText,
          isRealTime: result.isRealTime,
          source: result.source,
          timestamp: result.timestamp,
          lastUpdated: result.lastUpdated,
          conversionDetails: result.conversionDetails,
        };
      } else {
        throw new Error(response.data.error || "Conversion failed");
      }
    } catch (error) {
      console.error("[Frontend] Currency conversion failed:", error);

      // Show the actual error to the user
      const errorMessage =
        error.response?.data?.error ||
        error.message ||
        "Currency conversion failed";
      notifyError(`❌ ${errorMessage}`);

      // Don't return fallback, let the user know conversion failed
      throw new Error(errorMessage);
    } finally {
      setIsLoadingConversion(false);
    }
  };

  const fetchExpense = async () => {
    setIsLoadingExpense(true);
    try {
      const response = await axios.get(`${Base_URL}/expenses/${id}`, {
        headers,
      });
      if (response.data.success) {
        const expense = response.data.data;
        console.log("Fetched expense:", expense);

        const expenseDataToSet = {
          business: expense.business?._id || expense.business,
          vendor: expense.vendor?._id || expense.vendor || "",
          employee: expense.employee?._id || expense.employee || "",
          expenseType: expense.expenseType,
          expenseDate: formatDateForInput(new Date(expense.expenseDate)),
          dueDate: formatDateForInput(new Date(expense.dueDate)),
          expenseAccount: expense.expenseAccount?._id || expense.expenseAccount,
          paidFromBankAccount:
            expense.paidFromBankAccount?._id ||
            expense.paidFromBankAccount ||
            "",
          items: (expense.items || []).map((item) => ({
            ...item,
            expenseAccount:
              item.expenseAccount?._id || item.expenseAccount || null,
          })),
          subtotal: expense.subtotal || 0,
          discount: expense.discount || 0,
          discountAmount: expense.discountAmount || 0,
          taxAmount: (expense.taxAmount || 0).toString(),
          total: expense.total || 0,
          currency: expense.currency || "USD",
          terms: expense.terms || "Due on Receipt",
          notes: expense.notes || "",
          reference: expense.reference || "",
          supportingDocuments:
            expense.documents?.filter(
              (doc) => doc.documentType === "Supporting"
            ) || [],
          status: expense.status || "Draft",
          associatedClaims: expense.associatedClaims || [],
        };

        console.log("About to set expense data:", expenseDataToSet);
        console.log("Employee ID:", expenseDataToSet.employee);
        console.log("Expense Type:", expenseDataToSet.expenseType);
        console.log("Original expense employee object:", expense.employee);
        console.log(
          "Converted employee ID:",
          expense.employee?._id || expense.employee
        );

        setExpenseData(expenseDataToSet);

        console.log("Expense data has been set");

        // Set up original associated claims for tracking changes
        const originalClaims = expense.associatedClaims || [];
        console.log("🔍 SETTING ORIGINAL ASSOCIATED CLAIMS:");
        console.log(
          "📋 Raw expense.associatedClaims:",
          expense.associatedClaims
        );
        console.log("📋 Processed originalClaims:", originalClaims);
        console.log("📋 Type of originalClaims:", typeof originalClaims);
        console.log("📋 Is array:", Array.isArray(originalClaims));
        console.log("📋 Length:", originalClaims.length);
        if (originalClaims.length > 0) {
          console.log("📋 First claim ID:", originalClaims[0]);
          console.log("📋 Type of first claim ID:", typeof originalClaims[0]);
        }

        setOriginalAssociatedClaims(originalClaims);
        console.log("🔍 DEBUGGING CLAIM PRE-SELECTION:");
        console.log("📋 Original associated claims:", originalClaims);
        console.log("📋 Expense type:", expense.expenseType);
        console.log(
          "📋 Employee ID:",
          expense.employee?._id || expense.employee
        );

        // Try to extract claim IDs from expense items if associatedClaims is empty
        // This is a fallback for expenses created before the associatedClaims fix
        let claimIdsFromItems = [];
        if (originalClaims.length === 0 && expense.items) {
          claimIdsFromItems = expense.items
            .filter((item) => item.claimId)
            .map((item) => item.claimId)
            .filter((id, index, arr) => arr.indexOf(id) === index); // Remove duplicates

          console.log(
            "🔍 Found claim IDs from expense items:",
            claimIdsFromItems
          );

          if (claimIdsFromItems.length > 0) {
            console.log(
              "✅ Using claim IDs from items as fallback for pre-selection"
            );
            setOriginalAssociatedClaims(claimIdsFromItems);
          }
        }

        // DEBUG: Alert if this expense has no claims
        if (
          expense.expenseType === "staff_claims" &&
          originalClaims.length === 0 &&
          claimIdsFromItems.length === 0
        ) {
          console.warn(
            "⚠️ This staff claim expense has NO associated claims and no claim items!"
          );
          console.warn(
            "This might be an expense created before the associatedClaims fix."
          );
          console.warn("Expense ID:", expense._id);
        }

        // If employee is selected and expense type is staff claim, fetch claims first
        if (
          expense.expenseType === "staff_claims" &&
          expenseDataToSet.employee
        ) {
          console.log(
            "Fetching claims for employee:",
            expenseDataToSet.employee
          );
          await fetchClaims(expenseDataToSet.employee);
        } else if (expense.expenseType === "staff_claims") {
          // If this is a staff claim expense but no employee, don't set selected claims yet
          // Wait for fetchClaims to handle the pre-selection properly
          console.log(
            "Staff claim expense without employee - will handle pre-selection in fetchClaims"
          );
        }

        console.log("Set expense data:", expenseDataToSet);
      } else {
        notifyError("Failed to fetch expense details");
        history.push("/expenses");
      }
    } catch (error) {
      console.error("Error fetching expense:", error);
      notifyError("Failed to fetch expense details");
      history.push("/expenses");
    } finally {
      setIsLoadingExpense(false);
    }
  };

  const fetchData = async () => {
    if (!expenseData.business) {
      console.log("No business ID available for fetching data");
      return;
    }

    setIsLoadingData(true);
    try {
      console.log("Fetching data for business:", expenseData.business);

      // Fetch vendors, employees, accounts, bank accounts, and contracts - using same endpoints as CreateExpense
      const [
        vendorsRes,
        employeesRes,
        chartAccountsRes,
        bankAccountsRes,
        salesContractsRes,
        purchaseContractsRes,
      ] = await Promise.all([
        axios.get(
          `${Base_URL}/vendors${
            expenseData.business ? `/all/${expenseData.business}` : ""
          }`,
          { headers }
        ),
        axios.get(`${Base_URL}/staff-management`, {
          params: { business: expenseData.business, limit: 1000 },
          headers,
        }),
        axios.get(`${Base_URL}/accounts`, { headers }),
        axios.get(`${Base_URL}/bank-management/accounts`, {
          headers,
          params: expenseData.business
            ? { business: expenseData.business }
            : {},
        }),
        axios.get(`${Base_URL}/sales-contracts`, {
          params: { businessId: expenseData.business },
          headers,
        }),
        axios.get(`${Base_URL}/purchase-contracts`, {
          headers,
        }),
      ]);

      console.log("Fetched data:", {
        vendors: vendorsRes.data.data?.length,
        employees: employeesRes.data.staffList?.length,
        accounts: chartAccountsRes.data.accounts?.length,
        bankAccounts: bankAccountsRes.data.accounts?.length,
      });

      setVendors(vendorsRes.data.data || []);
      const employeeData = employeesRes.data.staffList || []; // Use staffList like CreateExpense
      setEmployees(employeeData);
      console.log("Loaded employees:", employeeData);
      console.log("Current expense employee ID:", expenseData.employee);
      console.log("Looking for employee with ID:", expenseData.employee);
      const foundEmployee = employeeData.find(
        (emp) => emp._id === expenseData.employee
      );
      console.log("Found matching employee:", foundEmployee);

      setExpenseAccounts(chartAccountsRes.data.accounts || []); // Use accounts like CreateExpense
      setBankAccounts(bankAccountsRes.data.accounts || []);
      setSalesContracts(salesContractsRes.data.contracts || []);
      setPurchaseContracts(purchaseContractsRes.data.contracts || []);

      // Set selected bank account if already chosen during creation
      if (expenseData.paidFromBankAccount) {
        console.log(
          "Looking for bank account with ID:",
          expenseData.paidFromBankAccount
        );
        console.log(
          "Available bank accounts:",
          bankAccountsRes.data.accounts?.map((acc) => ({
            id: acc._id,
            name: acc.accountName,
          }))
        );

        const selectedAccount = (bankAccountsRes.data.accounts || []).find(
          (acc) => acc._id === expenseData.paidFromBankAccount
        );

        if (selectedAccount) {
          setSelectedBankAccount(selectedAccount);
          console.log(
            "Found and set selected bank account:",
            selectedAccount.accountName
          );
        } else {
          console.log(
            "Bank account not found in business-filtered list! Trying to fetch all bank accounts..."
          );

          try {
            // Try fetching all bank accounts if business-filtered list doesn't contain the account
            const allBankAccountsRes = await axios.get(
              `${Base_URL}/bank-management/accounts`,
              { headers }
            );

            const selectedAccountFromAll = (
              allBankAccountsRes.data.accounts || []
            ).find((acc) => acc._id === expenseData.paidFromBankAccount);

            if (selectedAccountFromAll) {
              console.log(
                "Found bank account in global list:",
                selectedAccountFromAll.accountName
              );
              setSelectedBankAccount(selectedAccountFromAll);

              // Add the account to the bankAccounts list so it appears in dropdown
              setBankAccounts((prev) => {
                const accountExists = prev.some(
                  (acc) => acc._id === selectedAccountFromAll._id
                );
                if (!accountExists) {
                  return [...prev, selectedAccountFromAll];
                }
                return prev;
              });
            } else {
              console.log("Bank account not found even in global list!");
            }
          } catch (error) {
            console.error("Failed to fetch all bank accounts:", error);
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
      notifyError("Failed to load data");
    } finally {
      setIsLoadingData(false);
    }
  };

  // Fetch claims for selected employee
  const fetchClaims = async (employeeId) => {
    if (!employeeId) {
      setClaims([]);
      setSelectedClaims([]);
      return;
    }

    setIsLoadingClaims(true);
    try {
      console.log("🔍 Fetching claims for employee:", employeeId);
      console.log(
        "🔍 Original associated claims (IDs):",
        originalAssociatedClaims
      );

      // Use the same endpoint as CreateExpense for available claims
      const response = await axios.get(
        `${Base_URL}/claims/employee/${employeeId}/available-for-expense`,
        { headers }
      );

      const availableClaims = response.data.data || [];
      console.log(
        "🔍 Available claims from backend:",
        availableClaims.map((c) => ({
          id: c._id,
          status: c.status,
          ref: c.claimReference,
          totalAmount: c.totalClaimableAmount,
        }))
      );

      // DEBUG: Log each claim in detail to see what we're getting
      availableClaims.forEach((claim, index) => {
        console.log(`📋 Claim ${index + 1}:`, {
          id: claim._id,
          reference: claim.claimReference,
          status: claim.status,
          totalAmount: claim.totalClaimableAmount,
          itemCount: claim.items?.length || 0,
        });
      });

      // If we have original associated claims, fetch them separately to include them in the list
      let originalClaimsData = [];
      if (originalAssociatedClaims.length > 0) {
        try {
          console.log(
            "🔍 Fetching original claims by IDs:",
            originalAssociatedClaims
          );
          const originalClaimsResponse = await axios.get(`${Base_URL}/claims`, {
            params: {
              ids: originalAssociatedClaims.join(","),
              employee: employeeId,
            },
            headers,
          });
          originalClaimsData = originalClaimsResponse.data.data || [];
          console.log(
            "🔍 Original claims data:",
            originalClaimsData.map((c) => ({
              id: c._id,
              status: c.status,
              ref: c.claimReference,
            }))
          );
        } catch (error) {
          console.error("❌ Error fetching original claims:", error);
        }
      }

      // Combine available claims with original claims (avoid duplicates)
      const allClaims = [...availableClaims];
      originalClaimsData.forEach((originalClaim) => {
        const exists = allClaims.some(
          (claim) => claim._id === originalClaim._id
        );
        if (!exists) {
          console.log(
            "➕ Adding original claim to list:",
            originalClaim.claimReference,
            originalClaim.status
          );
          allClaims.push(originalClaim);
        }
      });

      console.log(
        "🔍 All claims for display:",
        allClaims.map((c) => ({
          id: c._id,
          status: c.status,
          ref: c.claimReference,
        }))
      );
      setClaims(allClaims);

      // Pre-select the originally associated claims
      if (originalAssociatedClaims.length > 0) {
        console.log("🔍 ATTEMPTING CLAIM PRE-SELECTION:");
        console.log(
          "📋 Original associated claims to match:",
          originalAssociatedClaims
        );
        console.log(
          "📋 All available claims:",
          allClaims.map((c) => ({
            id: c._id,
            ref: c.claimReference,
            status: c.status,
          }))
        );

        // Debug: Check each claim individually
        originalAssociatedClaims.forEach((claimId, index) => {
          console.log(`🔍 Looking for claim ${index + 1}: ${claimId}`);
          const foundClaim = allClaims.find((c) => c._id === claimId);
          if (foundClaim) {
            console.log(
              `✅ Found claim: ${foundClaim.claimReference} (${foundClaim.status})`
            );
          } else {
            console.log(`❌ Claim not found: ${claimId}`);
          }
        });

        const claimsToSelect = allClaims.filter((claim) =>
          originalAssociatedClaims.includes(claim._id)
        );

        console.log(
          "✅ Claims found for pre-selection:",
          claimsToSelect.map((c) => ({
            id: c._id,
            ref: c.claimReference,
            status: c.status,
          }))
        );

        if (claimsToSelect.length > 0) {
          console.log("🔄 Setting selected claims:", claimsToSelect.length);
          setSelectedClaims(claimsToSelect);
          console.log(
            "✅ Successfully pre-selected",
            claimsToSelect.length,
            "claims"
          );
        } else {
          console.warn("⚠️ No claims matched for pre-selection!");
          console.warn("This could mean:");
          console.warn("1. The claims are not available (status changed)");
          console.warn("2. The claim IDs don't match");
          console.warn("3. The claims belong to a different employee");

          // Additional debugging: Check if any claims exist at all
          console.warn("🔍 Debug info:");
          console.warn("- originalAssociatedClaims:", originalAssociatedClaims);
          console.warn("- allClaims count:", allClaims.length);
          console.warn(
            "- allClaims IDs:",
            allClaims.map((c) => c._id)
          );
        }

        // Also update the expense items to include items from pre-selected claims
        const existingNonClaimItems = expenseData.items.filter(
          (item) => !item.claimId
        );
        const claimItems = [];

        for (const claim of claimsToSelect) {
          const items = claim.items || [];
          for (const [index, item] of items.entries()) {
            claimItems.push({
              id: `claim_${claim._id}_${index}`,
              item_name:
                item.claimType?.name || item.description || "Claim Item",
              amount: parseFloat(item.claimableAmount || item.amount || 0),
              currency: item.currency?.code || expenseData.currency,
              discount: 0,
              discountAmount: 0,
              convertedAmount: parseFloat(
                item.claimableAmount || item.amount || 0
              ),
              exchangeRate: 1,
              notes: item.description || item.notes || "",
              attachment: "",
              expenseAccount: "", // Will use the expense-level account if not specified
              claimItemId: item._id,
              claimId: claim._id,
            });
          }
        }

        if (claimItems.length > 0) {
          const allItems = [...existingNonClaimItems, ...claimItems];
          const subtotal = allItems.reduce(
            (sum, item) => sum + (item.convertedAmount || item.amount),
            0
          );
          const total = subtotal + (parseFloat(expenseData.taxAmount) || 0);

          setExpenseData((prev) => ({
            ...prev,
            items: allItems,
            subtotal,
            total,
          }));

          console.log(
            "✅ Updated expense items with claim items:",
            claimItems.length,
            "items added"
          );
        }
      } else {
        setSelectedClaims([]);
      }
    } catch (error) {
      console.error("❌ Error fetching claims:", error);
      notifyError("Failed to load employee claims");
      setClaims([]);
      setSelectedClaims([]);
    } finally {
      setIsLoadingClaims(false);
    }
  };

  // Handle claim selection/deselection
  const handleClaimSelection = async (claimId, isSelected) => {
    if (isSelected) {
      // Add claim to selected list
      const claimToAdd = claims.find((claim) => claim._id === claimId);
      if (claimToAdd) {
        setSelectedClaims((prev) => [...prev, claimToAdd]);

        // Map claim items to expense items format (using the correct claim structure)
        const claimItems = claimToAdd.items || [];

        const newItems = claimItems.map((item, index) => ({
          id: `claim_${claimId}_${index}`, // Use consistent ID format
          item_name: item.claimType?.name || item.description || "Claim Item",
          amount: parseFloat(item.claimableAmount || item.amount || 0),
          currency: item.currency?.code || expenseData.currency,
          discount: 0,
          discountAmount: 0,
          convertedAmount: parseFloat(item.claimableAmount || item.amount || 0),
          exchangeRate: 1,
          notes: item.description || item.notes || "",
          attachment: "",
          expenseAccount: "", // Will use the expense-level account if not specified
          claimItemId: item._id,
          claimId: claimId,
        }));

        if (newItems.length > 0) {
          // Convert to main currency if needed
          const processedItems = await Promise.all(
            newItems.map(async (item) => {
              let convertedAmount = item.amount;
              let exchangeRate = 1;

              if (item.currency !== expenseData.currency) {
                try {
                  const conversion = await getCurrencyConversion(
                    item.currency,
                    expenseData.currency,
                    item.amount
                  );
                  convertedAmount = conversion.convertedAmount;
                  exchangeRate = conversion.rate;
                } catch (error) {
                  console.error("Currency conversion failed:", error);
                  convertedAmount = item.amount;
                }
              }

              return {
                ...item,
                convertedAmount,
                exchangeRate,
              };
            })
          );

          const updatedItems = [...expenseData.items, ...processedItems];
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
        }
      }
    } else {
      // Remove claim from selected list
      setSelectedClaims((prev) =>
        prev.filter((claim) => claim._id !== claimId)
      );

      // Remove all items belonging to this claim
      const filteredItems = expenseData.items.filter(
        (item) => item.claimId !== claimId
      );

      const subtotal = filteredItems.reduce(
        (sum, item) => sum + (item.convertedAmount || item.amount),
        0
      );
      const total = subtotal + (parseFloat(expenseData.taxAmount) || 0);

      setExpenseData((prev) => ({
        ...prev,
        items: filteredItems,
        subtotal,
        total,
      }));
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setExpenseData((prev) => ({ ...prev, [name]: value }));

    // Clear form errors when user starts typing
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: "" }));
    }

    // Handle employee change for staff claim expenses
    if (name === "employee" && expenseData.expenseType === "staff_claims") {
      if (value) {
        fetchClaims(value);
      } else {
        setClaims([]);
        setSelectedClaims([]);
      }
    }

    // Handle expense type change
    if (name === "expenseType") {
      if (value === "staff_claims" && expenseData.employee) {
        fetchClaims(expenseData.employee);
      } else {
        setClaims([]);
        setSelectedClaims([]);
      }
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
        const conversion = await getCurrencyConversion(
          addItemData.currency,
          expenseData.currency,
          itemAmountAfterDiscount
        );
        convertedAmount = conversion.convertedAmount;
        exchangeRate = conversion.rate;
      } catch (error) {
        console.error("Currency conversion failed:", error);
        // Use the simple conversion as fallback
        convertedAmount = await convertCurrency(
          addItemData.currency,
          expenseData.currency,
          itemAmountAfterDiscount
        );
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

    console.log("➕ Adding new item in UpdateExpense:", {
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

    // Validate status-specific requirements
    if (status === "Make Transaction" && !expenseData.paidFromBankAccount) {
      notifyError(
        "Please select a payment bank account for Make Transaction status"
      );
      return;
    }

    if (
      status === "Approve Transaction" &&
      conversionDetails &&
      !conversionDetails.hasSufficientFunds
    ) {
      notifyError("Insufficient funds in the selected bank account");
      return;
    }

    setIsLoading(true);

    try {
      // The backend will handle claim status updates automatically based on associatedClaims

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
        expenseType:
          expenseData.expenseType === "staff_claims"
            ? "staff_claims"
            : expenseData.expenseType,
        expenseDate: new Date(expenseData.expenseDate),
        dueDate: new Date(expenseData.dueDate),
        expenseAccount: expenseData.expenseAccount,
        paidFromBankAccount: expenseData.paidFromBankAccount || undefined,
        items: expenseData.items,
        subtotal: expenseData.subtotal,
        taxAmount: expenseData.taxAmount,
        total: expenseData.total,
        currency: expenseData.currency,
        terms: expenseData.terms,
        notes: expenseData.notes,
        reference: expenseData.reference,
        supportingDocuments: expenseData.supportingDocuments,
        status: status,
        // Include selected claims for staff claim expenses
        ...(expenseData.expenseType === "staff_claims" && {
          associatedClaims: selectedClaims.map((claim) => claim._id),
        }),
        // Include conversion details for transaction statuses
        ...(status === "Approve Transaction" &&
          conversionDetails && {
            conversionDetails: conversionDetails,
            paymentBankAccount: selectedBankAccount?._id,
          }),
      };

      console.log("💾 Submitting expense data:", expenseDataToSubmit);
      console.log(
        "📋 Original associated claims (IDs):",
        originalAssociatedClaims
      );
      console.log(
        "📋 Currently selected claims (IDs):",
        selectedClaims.map((c) => c._id)
      );
      console.log(
        "➕ Claims being added:",
        selectedClaims
          .filter((sc) => !originalAssociatedClaims.includes(sc._id))
          .map((c) => c._id)
      );
      console.log(
        "➖ Claims being removed:",
        originalAssociatedClaims.filter(
          (oc) => !selectedClaims.some((sc) => sc._id === oc)
        )
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

      const response = await axios.put(
        `${Base_URL}/expenses/${id}`,
        expenseDataToSubmit,
        { headers }
      );

      console.log("response", response);

      if (response.data.success) {
        const message =
          response.data.message || "Expense updated successfully!";

        // Show different messages based on status
        if (status === "Make Transaction") {
          notifySuccess(`${message} - Payment details prepared`);
        } else if (status === "Approve Transaction") {
          notifySuccess(`${message} - Payment completed and funds deducted`);
        } else {
          notifySuccess(message);
        }

        history.push("/expenses");
      } else {
        notifyError("Failed to update expense");
      }
    } catch (error) {
      console.error("Error updating expense:", error);
      notifyError(error.response?.data?.message || "Failed to update expense");
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

    try {
      // Use the same API as CreateExpense
      const formDataForUpload = new FormData();
      formDataForUpload.append(
        "file_path",
        `Expenses/${expenseData.reference || "UPDATE"}`
      );
      formDataForUpload.append("business_id", expenseData.business);
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
        console.log("Upload response file:", uploadedFile);

        const newDocument = {
          fileId: uploadedFile._id,
          name: uploadedFile.name,
          url: uploadedFile.url || uploadedFile.downloadUrl || "#",
          downloadUrl: uploadedFile.downloadUrl || uploadedFile.url || "#",
          uploadedAt: new Date().toISOString(),
          size: file.size,
          type: file.type,
          documentType: "Supporting",
          description: "Supporting Document",
        };

        setExpenseData((prev) => ({
          ...prev,
          supportingDocuments: [...prev.supportingDocuments, newDocument],
        }));

        setUploadSuccess(true);
        setSuccessMessage("Document uploaded successfully!");
        setTimeout(() => {
          setUploadSuccess(false);
          setSuccessMessage("");
        }, 3000);
      } else {
        notifyError("Upload failed. Please try again.");
      }
    } catch (error) {
      console.error("Upload error:", error);
      notifyError("Upload failed. Please try again.");
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

  const handleBankAccountChange = async (accountId) => {
    if (!accountId) {
      setSelectedBankAccount(null);
      setConversionDetails(null);
      setExpenseData((prev) => ({ ...prev, paidFromBankAccount: "" }));
      return;
    }

    const account = bankAccounts.find((acc) => acc._id === accountId);
    if (!account) {
      notifyError("Bank account not found");
      return;
    }

    setSelectedBankAccount(account);
    setExpenseData((prev) => ({ ...prev, paidFromBankAccount: accountId }));

    // Calculate conversion if currencies differ and status requires transaction
    if (
      (expenseData.status === "Make Transaction" ||
        expenseData.status === "Approve Transaction") &&
      account.currencyType !== expenseData.currency
    ) {
      console.log(
        `[Frontend] Starting conversion: ${expenseData.total} ${expenseData.currency} from ${account.currencyType}`
      );

      // Validate parameters before calling conversion
      if (
        !account.currencyType ||
        !expenseData.currency ||
        !expenseData.total ||
        expenseData.total <= 0
      ) {
        console.error("[Frontend] Missing or invalid conversion parameters:", {
          accountCurrency: account.currencyType,
          expenseCurrency: expenseData.currency,
          expenseTotal: expenseData.total,
        });

        let missingParams = [];
        if (!account.currencyType) missingParams.push("account currency");
        if (!expenseData.currency) missingParams.push("expense currency");
        if (!expenseData.total || expenseData.total <= 0)
          missingParams.push("valid expense amount");

        notifyError(
          `Cannot convert currency - missing: ${missingParams.join(", ")}`
        );
        return;
      }

      try {
        const conversion = await getCurrencyConversion(
          account.currencyType,
          expenseData.currency,
          expenseData.total
        );

        setConversionDetails({
          fromCurrency: account.currencyType,
          toCurrency: expenseData.currency,
          expenseAmount: expenseData.total,
          accountCurrency: account.currencyType,
          requiredAmount: conversion.convertedAmount,
          exchangeRate: conversion.rate,
          accountBalance: account.openingBalance || account.balance,
          hasSufficientFunds:
            (account.openingBalance || account.balance) >=
            conversion.convertedAmount,
          displayText: conversion.displayText,
          rateDisplayText: conversion.rateDisplayText,
          isRealTime: conversion.isRealTime,
          source: conversion.source,
          isConversion: true,
        });
      } catch (error) {
        console.error("[Frontend] Currency conversion failed:", error);
        notifyError(`Failed to get exchange rate: ${error.message}`);
      }
    } else if (
      expenseData.status === "Make Transaction" ||
      expenseData.status === "Approve Transaction"
    ) {
      // Same currency or no transaction status
      const accountBalance = account.openingBalance || account.balance;
      setConversionDetails({
        fromCurrency: account.currencyType,
        toCurrency: expenseData.currency,
        expenseAmount: expenseData.total,
        accountCurrency: account.currencyType,
        requiredAmount: expenseData.total,
        exchangeRate: 1,
        accountBalance: accountBalance,
        hasSufficientFunds: accountBalance >= expenseData.total,
        displayText: `${expenseData.total} ${expenseData.currency} = ${expenseData.total} ${account.currencyType} (Same Currency)`,
        isConversion: false,
      });
    }
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

            <div className="grid grid-cols-2 gap-4">
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
                <label className="block text-gray-700 mb-2">Currency</label>
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
                    discount: Math.max(
                      0,
                      Math.min(100, parseFloat(e.target.value) || 0)
                    ),
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

  if (isLoadingExpense || isLoadingData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--p-blue)] mx-auto"></div>
          <p className="mt-4 text-gray-600">
            {isLoadingExpense
              ? "Loading expense data..."
              : "Loading form data..."}
          </p>
        </div>
      </div>
    );
  }

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
        Update Expense
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
            const isSelected = expenseData.expenseType === type.value;
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
                disabled={expenseData.status !== "Draft"}
                className={`p-6 rounded-xl border-3 transition-all duration-200 text-left transform hover:scale-105 ${
                  isSelected
                    ? "border-[var(--p-blue)] bg-[#f0fbf7] shadow-lg ring-2 ring-[var(--p-blue)]/20"
                    : "border-gray-200 bg-white hover:border-[var(--p-blue)]/50 hover:bg-gray-50 shadow-sm"
                } ${
                  expenseData.status !== "Draft"
                    ? "opacity-50 cursor-not-allowed hover:scale-100"
                    : "hover:shadow-md"
                }`}
              >
                <div className="flex items-center mb-3">
                  <div
                    className={`p-2 rounded-lg ${
                      isSelected ? "bg-[var(--p-blue)]/10" : "bg-gray-100"
                    }`}
                  >
                    <IconComponent
                      size={24}
                      className={
                        isSelected ? "text-[var(--p-blue)]" : "text-gray-600"
                      }
                    />
                  </div>
                  <span
                    className={`ml-3 text-lg font-semibold ${
                      isSelected ? "text-[var(--p-blue)]" : "text-gray-800"
                    }`}
                  >
                    {type.label}
                  </span>
                  {isSelected && (
                    <div className="ml-auto">
                      <div className="w-6 h-6 bg-[var(--p-blue)] rounded-full flex items-center justify-center">
                        <svg
                          className="w-4 h-4 text-white"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        {expenseData.status !== "Draft" && (
          <p className="text-sm text-gray-500 mt-2">
            Expense type cannot be changed once submitted.
          </p>
        )}
      </div>

      {/* Vendor/Employee Section */}
      <div className="bg-[#f0fbf7] p-6 rounded-lg mb-6">
        <h2 className="text-lg font-medium mb-4 text-gray-800">
          {expenseData.expenseType === "staff_claims"
            ? "Employee Information"
            : "Vendor Information"}
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
              disabled={expenseData.status !== "Draft"}
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
                placeholder="Select Employee"
                searchPlaceholder="Search employees..."
                disabled={expenseData.status !== "Draft"}
                options={
                  employees?.map((employee) => ({
                    value: employee._id,
                    label:
                      employee.displayName ||
                      `${employee.personalInfo?.firstName} ${employee.personalInfo?.lastName}` ||
                      `${employee.firstName} ${employee.lastName}` ||
                      employee.name ||
                      "Unknown Employee",
                    name:
                      employee.displayName ||
                      `${employee.personalInfo?.firstName} ${employee.personalInfo?.lastName}` ||
                      `${employee.firstName} ${employee.lastName}` ||
                      employee.name ||
                      "Unknown Employee",
                    email: employee.email,
                    department: employee.department,
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
                        {option.department}
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

              {/* Claims Selection - Updated to match CreateExpense design */}
              {expenseData.employee && (
                <div className="mt-6">
                  <label className="block text-gray-700 mb-2">
                    Available Claims
                  </label>
                  {isLoadingClaims ? (
                    <div className="flex items-center gap-2 text-sm text-[var(--p-blue)] p-4 bg-blue-50 rounded-lg">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--p-blue)]"></div>
                      Checking for available claims...
                    </div>
                  ) : (
                    <div className="text-sm text-gray-600 p-4 bg-gray-50 rounded-lg mb-3">
                      {claims.length > 0
                        ? `Found ${claims.length} available claims. Please select claims to include in expense.`
                        : "No available claims found. You can create items manually."}
                    </div>
                  )}

                  {claims.length > 0 && (
                    <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-300 rounded-lg p-3">
                      {claims.map((claim) => {
                        const isSelected = selectedClaims.some(
                          (selectedClaim) => selectedClaim._id === claim._id
                        );

                        // Check if this claim is already used for an expense (but not the current one)
                        const isUsedInCurrentExpense =
                          originalAssociatedClaims.includes(claim._id);
                        const isDisabled =
                          claim.isExpenseCreated && !isUsedInCurrentExpense;

                        console.log(
                          `🔍 CLAIM CHECKBOX DEBUG - ${claim.claimReference}:`,
                          {
                            claimId: claim._id,
                            isSelected: isSelected,
                            isUsedInCurrentExpense: isUsedInCurrentExpense,
                            isDisabled: isDisabled,
                            claimStatus: claim.status,
                            isExpenseCreated: claim.isExpenseCreated,
                            originalAssociatedClaims: originalAssociatedClaims,
                            selectedClaimsCount: selectedClaims.length,
                            selectedClaimsIds: selectedClaims.map(
                              (sc) => sc._id
                            ),
                          }
                        );

                        return (
                          <div
                            key={claim._id}
                            className={`flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 ${
                              isDisabled ? "opacity-60 cursor-not-allowed" : ""
                            }`}
                          >
                            <input
                              type="checkbox"
                              id={`claim-${claim._id}`}
                              checked={isSelected}
                              disabled={isDisabled}
                              onChange={(e) =>
                                !isDisabled &&
                                handleClaimSelection(
                                  claim._id,
                                  e.target.checked
                                )
                              }
                              className="mt-1 h-4 w-4 text-[var(--p-blue)] focus:ring-[var(--p-blue)] border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                            <label
                              htmlFor={`claim-${claim._id}`}
                              className={`flex-1 cursor-pointer ${
                                isDisabled ? "cursor-not-allowed" : ""
                              }`}
                            >
                              <div
                                className={`font-medium ${
                                  isDisabled ? "text-gray-500" : "text-gray-800"
                                }`}
                              >
                                Claim #
                                {claim.claimReference || claim.claimNumber}
                                {claim.isExpenseCreated && (
                                  <span className="ml-2 px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">
                                    {isUsedInCurrentExpense
                                      ? "Used in this expense"
                                      : "Used in other expense"}
                                  </span>
                                )}
                              </div>
                              <div
                                className={`text-sm ${
                                  isDisabled ? "text-gray-400" : "text-gray-600"
                                }`}
                              >
                                Total:{" "}
                                {claim.totalClaimableAmount?.toFixed(2) ||
                                  "0.00"}{" "}
                                ({claim.itemCount || 0} items)
                              </div>
                              <div
                                className={`text-xs ${
                                  isDisabled ? "text-gray-400" : "text-gray-500"
                                }`}
                              >
                                Created:{" "}
                                {new Date(claim.createdAt).toLocaleDateString()}
                              </div>
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {selectedClaims.length > 0 && (
                    <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm text-green-800">
                        {selectedClaims.length} claim(s) selected. Items from
                        these claims will be automatically added to the expense.
                      </p>
                    </div>
                  )}
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
                placeholder="Select Vendor"
                searchPlaceholder="Search vendors..."
                disabled={expenseData.status !== "Draft"}
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-700 mb-2">
              Expense Account *
            </label>
            <SearchableDropdown
              name="expenseAccount"
              value={expenseData.expenseAccount}
              onChange={handleInputChange}
              placeholder="Select Expense Account"
              searchPlaceholder="Search expense accounts..."
              options={
                expenseAccounts?.map((account) => ({
                  value: account._id,
                  label: `${account.code || "N/A"} - ${account.accountName} (${
                    account.accountType?.name ||
                    account.accountType?.accountHeader ||
                    "Unknown Type"
                  })`,
                  name: account.accountName,
                  type:
                    account.accountType?.name ||
                    account.accountType?.accountHeader ||
                    account.accountCode,
                  code: account.accountCode,
                })) || []
              }
              searchKeys={["name", "type", "code"]}
              renderOption={(option) => (
                <div>
                  <div className="font-medium">
                    {option.code} - {option.name}
                  </div>
                  <div className="text-xs text-gray-500">{option.type}</div>
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
              value={expenseData.paidFromBankAccount}
              onChange={(e) => handleBankAccountChange(e.target.value)}
              placeholder="Select Bank Account"
              searchPlaceholder="Search bank accounts..."
              clearable={true}
              className={formErrors.paidFromBankAccount ? "border-red-500" : ""}
              options={
                bankAccounts?.map((account) => ({
                  value: account._id,
                  label: `${account.accountName} - ${account.bankName} (${
                    account.currencyType
                  } ${(account.balance || account.openingBalance)?.toFixed(
                    2
                  )})`,
                  name: account.accountName,
                  bank: account.bankName,
                  currency: account.currencyType,
                  balance: account.balance || account.openingBalance || 0,
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
            {expenseData.paidFromBankAccount && (
              <div className="mt-1">
                {!isLoadingData && bankAccounts.length > 0 ? (
                  <p className="text-xs text-green-600">
                    ✓ Pre-selected:{" "}
                    {bankAccounts.find(
                      (acc) => acc._id === expenseData.paidFromBankAccount
                    )?.accountName || "Loading account details..."}
                  </p>
                ) : (
                  <p className="text-xs text-gray-500">
                    Loading pre-selected bank account...
                  </p>
                )}
              </div>
            )}

            {/* Currency Conversion Display */}
            {conversionDetails && selectedBankAccount && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="text-sm font-medium text-blue-900 mb-3 flex items-center">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Currency Conversion Details
                  {conversionDetails.isRealTime && (
                    <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                      Live Rate
                    </span>
                  )}
                </h4>

                {isLoadingConversion ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <span className="ml-2 text-blue-700">Converting...</span>
                  </div>
                ) : (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-blue-700">Expense Amount:</span>
                      <span className="font-medium">
                        {conversionDetails.expenseAmount?.toFixed(2) || 0}{" "}
                        {conversionDetails.toCurrency}
                      </span>
                    </div>

                    {conversionDetails.isConversion && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-blue-700">Exchange Rate:</span>
                          <span className="font-medium">
                            {conversionDetails.rateDisplayText ||
                              `1 ${conversionDetails.fromCurrency} = ${conversionDetails.exchangeRate} ${conversionDetails.toCurrency}`}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-blue-700">
                            Converted Amount:
                          </span>
                          <span className="font-medium">
                            {conversionDetails.requiredAmount?.toFixed(2) || 0}{" "}
                            {conversionDetails.fromCurrency}
                          </span>
                        </div>
                      </>
                    )}

                    <div className="flex justify-between">
                      <span className="text-blue-700">Account Balance:</span>
                      <span
                        className={`font-medium ${
                          conversionDetails.hasSufficientFunds
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {conversionDetails.accountBalance?.toFixed(2) || 0}{" "}
                        {conversionDetails.fromCurrency}
                      </span>
                    </div>

                    <div className="border-t pt-2 mt-3">
                      <div className="flex justify-between font-medium">
                        <span className="text-blue-700">Status:</span>
                        <span
                          className={
                            conversionDetails.hasSufficientFunds
                              ? "text-green-600"
                              : "text-red-600"
                          }
                        >
                          {conversionDetails.hasSufficientFunds
                            ? "✅ Sufficient Funds"
                            : "❌ Insufficient Funds"}
                        </span>
                      </div>
                    </div>

                    {conversionDetails.displayText && (
                      <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded text-gray-700 text-xs">
                        {conversionDetails.displayText}
                      </div>
                    )}

                    {!conversionDetails.hasSufficientFunds && (
                      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
                        <AlertTriangle size={14} className="inline mr-1" />
                        Insufficient funds in selected account. Cannot proceed
                        with "Approve Transaction".
                      </div>
                    )}

                    {conversionDetails.source &&
                      conversionDetails.source !== "same_currency" && (
                        <div className="mt-2 text-xs text-gray-500">
                          Rate source: {conversionDetails.source}
                          {conversionDetails.timestamp &&
                            ` • Updated: ${new Date(
                              conversionDetails.timestamp
                            ).toLocaleTimeString()}`}
                        </div>
                      )}
                  </div>
                )}
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
          >
            <Plus size={16} className="mr-2" />
            Add Item
          </button>
        </div>

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
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="font-medium">
                        {item.currency || expenseData.currency}{" "}
                        {item.amount?.toFixed(2)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {item.discount > 0 ? (
                        <div>
                          <div className="text-orange-600 font-medium">
                            {item.discount}%
                          </div>
                          <div className="text-xs text-gray-500">
                            -{item.currency || expenseData.currency}{" "}
                            {item.discountAmount?.toFixed(2) || 0}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">No discount</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="font-medium text-green-600">
                        {expenseData.currency}{" "}
                        {(item.convertedAmount || item.amount)?.toFixed(2)}
                      </div>
                      {item.currency &&
                        item.currency !== expenseData.currency &&
                        item.exchangeRate && (
                          <div className="text-xs text-gray-500">
                            Rate: {item.exchangeRate?.toFixed(4)}
                          </div>
                        )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {item.expenseAccount ? (
                        <div>
                          <div className="font-medium text-blue-600">
                            {(() => {
                              // Handle both populated object and string ID
                              const accountId =
                                typeof item.expenseAccount === "object" &&
                                item.expenseAccount !== null
                                  ? item.expenseAccount._id
                                  : item.expenseAccount;
                              const account = expenseAccounts.find(
                                (acc) => acc._id === accountId
                              );
                              // If account not found in list but we have populated object, use it
                              if (
                                !account &&
                                typeof item.expenseAccount === "object" &&
                                item.expenseAccount !== null
                              ) {
                                return `${
                                  item.expenseAccount.code || "N/A"
                                } - ${
                                  item.expenseAccount.accountName || "Unknown"
                                }`;
                              }
                              return account
                                ? `${account.code || "N/A"} - ${
                                    account.accountName
                                  }`
                                : "Unknown Account";
                            })()}
                          </div>
                          <div className="text-xs text-gray-500">
                            {(() => {
                              const accountId =
                                typeof item.expenseAccount === "object" &&
                                item.expenseAccount !== null
                                  ? item.expenseAccount._id
                                  : item.expenseAccount;
                              const account = expenseAccounts.find(
                                (acc) => acc._id === accountId
                              );
                              if (
                                !account &&
                                typeof item.expenseAccount === "object" &&
                                item.expenseAccount !== null
                              ) {
                                return (
                                  item.expenseAccount.accountType?.name ||
                                  item.expenseAccount.accountType
                                    ?.accountHeader ||
                                  ""
                                );
                              }
                              return (
                                account?.accountType?.name ||
                                account?.accountType?.accountHeader ||
                                ""
                              );
                            })()}
                          </div>
                        </div>
                      ) : (
                        <div className="text-gray-500 italic">
                          Uses main account
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {item.contractType && item.contractNumber ? (
                        <div>
                          <div className="font-medium text-purple-600">
                            {item.contractType === "sales"
                              ? "Sales"
                              : "Purchase"}{" "}
                            Contract
                          </div>
                          <div className="text-xs text-gray-500">
                            {item.contractNumber}
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
                      title="View Document"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => handleRemoveDocument(index)}
                      className="text-red-600 hover:text-red-800"
                      title="Remove Document"
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
          onClick={() => handleSubmit(expenseData.status)}
          disabled={isLoading}
          className="px-6 py-2 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[#9CBA33] disabled:opacity-50"
        >
          {isLoading ? "Updating..." : "Update Expense"}
        </button>
      </div>

      {/* Add Item Modal */}
      {renderAddItemModal()}
    </div>
  );
};

export default UpdateExpense;
