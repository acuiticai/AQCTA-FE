import React, { useState, useEffect, useCallback, useContext } from "react";
import { useHistory } from "react-router-dom";
import axios from "axios";
import { DataTable } from "@/page-layouts/index";
import { formatDate, formatAmount } from "@/components/formatAmount";
import { Eye, PenSquare, Plus, ChevronDown, DollarSign } from "lucide-react";
import {
  AddButton,
  DataCard,
  PageHeader,
} from "../headercomponents/StyledComponents";
import { notifyError } from "@/utils/toast";
import { AdminContext } from "@/context/AdminContext";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const ExpensesTable = ({ Data }) => {
  const [allData, setAllData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [showDropdown, setShowDropdown] = useState(false);
  const [existingInvoiceTypes, setExistingInvoiceTypes] = useState([]);
  const [baseCurrency, setBaseCurrency] = useState("USD");
  const [currencyRates, setCurrencyRates] = useState({ USD: 1 });
  const [currencyReady, setCurrencyReady] = useState(false);
  const history = useHistory();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;

  const headers = {
    authorization: `Bearer ${adminInfo?.token}`,
  };

  console.log("Sales Contract Data", Data);

  useEffect(() => {
    const resolveBusinessId = () => {
      if (Data?.business?._id) return Data.business._id;
      if (typeof Data?.business === "string") return Data.business;
      if (Data?.basicInfo?.business?._id) return Data.basicInfo.business._id;
      if (typeof Data?.basicInfo?.business === "string")
        return Data.basicInfo.business;
      return null;
    };

    const fetchCurrencies = async () => {
      const businessId = resolveBusinessId();
      if (!businessId || !adminInfo?.token) {
        setCurrencyRates({ USD: 1 });
        setBaseCurrency("USD");
        setCurrencyReady(true);
        return;
      }

      setCurrencyReady(false);
      try {
        const response = await axios.get(`${Base_URL}/finance/currencies`, {
          params: { business_id: businessId },
          headers,
        });

        const currencyData = response.data?.data || [];
        if (!Array.isArray(currencyData) || currencyData.length === 0) {
          setCurrencyRates({ USD: 1 });
          setBaseCurrency("USD");
          setCurrencyReady(true);
          return;
        }

        const rateMap = {};
        let detectedBase = "USD";

        currencyData.forEach((currency) => {
          const symbol = (currency.symbol || currency.code || "").toUpperCase();
          if (!symbol) return;
          const rawRate =
            currency.conversion_rate_to_base ?? currency.conversionRate ?? 1;
          const rate = Number(rawRate);
          rateMap[symbol] = Number.isFinite(rate) ? rate : 1;
          const isBaseFlag =
            currency.isBase ??
            currency.is_base ??
            currency.baseCurrency ??
            false;
          if (isBaseFlag) {
            detectedBase = symbol;
          }
        });

        if (!rateMap[detectedBase]) {
          rateMap[detectedBase] = 1;
        }

        setCurrencyRates(rateMap);
        setBaseCurrency(detectedBase.toUpperCase());
      } catch (error) {
        console.error("❌ Error fetching currency rates:", error);
        setCurrencyRates({ USD: 1 });
        setBaseCurrency("USD");
      } finally {
        setCurrencyReady(true);
      }
    };

    fetchCurrencies();
  }, [Data?.business, Data?.basicInfo?.business, adminInfo?.token]);

  const normalizeCurrencySymbol = useCallback(
    (currency) => {
      const fallback = (baseCurrency || "USD").toUpperCase();
      if (!currency) return fallback;
      if (typeof currency === "string") return currency.toUpperCase();
      if (typeof currency === "object") {
        const value =
          currency.symbol ||
          currency.code ||
          currency.currency ||
          currency.abbreviation ||
          "";
        if (value) return value.toUpperCase();
      }
      return fallback;
    },
    [baseCurrency]
  );

  const convertToBase = useCallback(
    (amount, currencySymbol) => {
      if (!amount) return 0;
      const symbol = normalizeCurrencySymbol(currencySymbol);
      const rate = currencyRates[symbol];
      const numericAmount = Number(amount);
      if (!Number.isFinite(numericAmount)) return 0;
      if (rate === undefined || rate === null) return numericAmount;
      return numericAmount * rate;
    },
    [currencyRates, normalizeCurrencySymbol]
  );

  // Fetch all data for this sales contract
  useEffect(() => {
    if (Data?._id && currencyReady) {
      fetchAllData();
    }
  }, [Data?._id, currentPage, entriesPerPage, searchTerm, currencyReady]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showDropdown && !event.target.closest(".relative")) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDropdown]);

  const fetchAllData = async () => {
    console.log("Data contractNo", Data?.contractNo);
    if (!currencyReady) return;
    setLoading(true);
    try {
      // First fetch purchase contracts
      const purchaseContractsResponse = await axios.get(
        `${Base_URL}/purchase-contracts/get_assigned_to_sales/${Data._id}`
      );
      const purchaseContracts = purchaseContractsResponse.data.contracts || [];
      const purchaseContractIds = purchaseContracts.map((pc) => pc._id);

      console.log("📦 Found purchase contracts:", purchaseContracts.length);

      const businessId =
        Data?.business?._id ||
        (typeof Data?.business === "string" ? Data.business : null) ||
        Data?.basicInfo?.business?._id ||
        (typeof Data?.basicInfo?.business === "string"
          ? Data.basicInfo.business
          : null);

      // Fetch all expense-related data in parallel:
      // 1. Sales contract vendor invoices
      // 2. Sales contract expenses
      // 3. Purchase contract vendor invoices (for each purchase)
      // 4. Purchase contract expenses (for each purchase)
      // 5. Shipments (for each purchase)

      // Sales Contract Vendor Invoices (fetch all, filter later)
      const salesInvoiceParams = {
        contract: Data?.contractNo,
        type: "commission",
        page: currentPage,
        limit: entriesPerPage,
        search: searchTerm,
      };
      if (businessId) {
        salesInvoiceParams.business = businessId;
      }

      const salesInvoicesPromise = axios.get(`${Base_URL}/vendor-invoices`, {
        params: salesInvoiceParams,
      });

      const salesExpenseParams = {
        contractNumber: Data?.contractNo,
        contractId: Data?._id,
        contractType: "sales",
        page: currentPage,
        limit: entriesPerPage,
        search: searchTerm,
      };
      if (businessId) {
        salesExpenseParams.business = businessId;
      }

      const salesExpensesPromise = axios.get(`${Base_URL}/expenses`, {
        params: salesExpenseParams,
      });

      // Fetch vendor invoices for each purchase contract (fetch all types)
      const purchaseInvoicesPromises = purchaseContracts.map((pc) =>
        axios.get(`${Base_URL}/vendor-invoices`, {
          params: {
            contract: pc.contractNo,
            page: currentPage,
            limit: entriesPerPage,
            search: searchTerm,
          },
        })
      );

      // Fetch expenses for each purchase contract
      const purchaseExpensesPromises = purchaseContracts.map((pc) =>
        axios.get(`${Base_URL}/expenses`, {
          params: {
            contractNumber: pc.contractNo,
            contractId: pc._id,
            contractType: "purchase",
            page: currentPage,
            limit: entriesPerPage,
            search: searchTerm,
          },
        })
      );

      const [
        salesInvoicesResponse,
        salesExpensesResponse,
        ...allPurchaseResponses
      ] = await Promise.allSettled([
        salesInvoicesPromise,
        salesExpensesPromise,
        ...purchaseInvoicesPromises,
        ...purchaseExpensesPromises,
      ]);

      // Separate purchase responses
      const purchaseInvoicesResponses = allPurchaseResponses.slice(
        0,
        purchaseInvoicesPromises.length
      );
      const purchaseExpensesResponses = allPurchaseResponses.slice(
        purchaseInvoicesPromises.length,
        purchaseInvoicesPromises.length + purchaseExpensesPromises.length
      );

      // Combine all invoices (sales + purchase)
      const salesInvoices =
        salesInvoicesResponse.status === "fulfilled"
          ? salesInvoicesResponse.value.data.data || []
          : [];

      const purchaseInvoices = purchaseInvoicesResponses
        .filter((response) => response.status === "fulfilled")
        .flatMap((response) => response.value.data.data || []);

      const allInvoices = [...salesInvoices, ...purchaseInvoices];

      // Combine all expenses
      const allExpenses = [
        ...(salesExpensesResponse.status === "fulfilled"
          ? salesExpensesResponse.value.data.data || []
          : []),
        ...purchaseExpensesResponses
          .filter((response) => response.status === "fulfilled")
          .flatMap((response) => response.value.data.data || []),
      ];

      // Combine all data with type information
      const combinedData = [
        // Add purchase contracts
        ...purchaseContracts.map((contract) => {
          const purchaseProduct = contract?.productInfo?.[0] || {};
          const totalValue =
            (Number(purchaseProduct?.price) || 0) *
            (Number(purchaseProduct?.quantityMTS) || 0) *
            (Number(purchaseProduct?.quantityFCL) || 0);
          const purchaseCurrency = normalizeCurrencySymbol(
            purchaseProduct?.selectedCurrency
          );
          const baseAmount = convertToBase(totalValue, purchaseCurrency);
          return {
            ...contract,
            recordType: "purchase",
            type: "Purchase Contract",
            total: totalValue,
            currency: purchaseCurrency,
            baseAmount,
            sortDate: new Date(contract.createdAt),
            contractNumber: contract.contractNo,
          };
        }),
        // Add vendor invoices with type information
        ...allInvoices.map((invoice) => {
          let invoiceType = "Vendor Invoice";
          const rawType = (invoice.invoiceType || "").toLowerCase();
          const vendorType = (
            invoice.vendor?.basicInformation?.vendorType || ""
          ).toLowerCase();
          if (rawType === "commission" || vendorType === "agent") {
            invoiceType = "Commission Agent Invoice";
          } else if (rawType === "supplier") {
            invoiceType = "Supplier Invoice";
          } else if (rawType === "logistic" || rawType === "logistics") {
            invoiceType = "Logistics Invoice";
          }
          const currencySymbol = normalizeCurrencySymbol(invoice.currency);
          const baseAmount = convertToBase(invoice.total || 0, currencySymbol);

          return {
            ...invoice,
            recordType: "invoice",
            type: invoiceType,
            currency: currencySymbol,
            baseAmount,
            sortDate: new Date(invoice.createdAt),
          };
        }),
        // Add general expenses with type information
        ...allExpenses.map((expense) => {
          const currencySymbol = normalizeCurrencySymbol(expense.currency);
          const baseAmount = convertToBase(expense.total || 0, currencySymbol);
          return {
            ...expense,
            recordType: "expense",
            type:
              expense.expenseType === "staff_claims"
                ? "Staff Claims"
                : expense.expenseType === "bills"
                ? "Bills"
                : expense.expenseType === "rents"
                ? "Rents"
                : "Other Expense",
            currency: currencySymbol,
            baseAmount,
            sortDate: new Date(expense.createdAt),
          };
        }),
      ];

      // Sort by date (latest first)
      combinedData.sort((a, b) => b.sortDate - a.sortDate);

      setAllData(combinedData);
      setTotalPages(
        salesInvoicesResponse.status === "fulfilled"
          ? salesInvoicesResponse.value.data.totalPages || 1
          : 1
      );

      // Track existing invoice types to prevent duplicates
      const existingTypes = allInvoices.map((invoice) => invoice.invoiceType);
      setExistingInvoiceTypes([...new Set(existingTypes)]);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Draft":
        return "text-gray-500 bg-gray-100 border-gray-200";
      case "Created":
        return "text-blue-500 bg-blue-100 border-blue-200";
      case "Approved by Management":
        return "text-yellow-600 bg-yellow-100 border-yellow-200";
      case "Make Transaction":
        return "text-orange-500 bg-orange-100 border-orange-200";
      case "Approve Transaction":
        return "text-green-500 bg-green-100 border-green-200";
      default:
        return "text-gray-500 bg-gray-100 border-gray-200";
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case "Purchase Contract":
        return "bg-blue-100 text-blue-800";
      case "Freight Cost":
        return "bg-cyan-100 text-cyan-800";
      case "Insurance Fee":
        return "bg-teal-100 text-teal-800";
      case "Warehousing Fee":
        return "bg-emerald-100 text-emerald-800";
      case "Documentation Charges":
        return "bg-lime-100 text-lime-800";
      case "Terminal Handling":
        return "bg-green-100 text-green-800";
      case "Bank Charges":
        return "bg-sky-100 text-sky-800";
      case "Commission Agent Invoice":
        return "bg-purple-100 text-purple-800";
      case "Supplier Invoice":
        return "bg-pink-100 text-pink-800";
      case "Logistics Invoice":
        return "bg-rose-100 text-rose-800";
      case "Vendor Invoice":
        return "bg-violet-100 text-violet-800";
      case "Staff Claims":
        return "bg-orange-100 text-orange-800";
      case "Bills":
        return "bg-yellow-100 text-yellow-800";
      case "Rents":
        return "bg-indigo-100 text-indigo-800";
      case "Other Expense":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Determine contract type based on data structure
  const getContractType = () => {
    return Data.basicInfo?.typeOfSaleContract ? "sales" : "purchase";
  };

  // Get available invoice types based on contract type
  const getAvailableInvoiceTypes = () => {
    const contractType = getContractType();
    const baseTypes = [];

    if (contractType === "purchase") {
      baseTypes.push(
        {
          value: "supplier",
          label: "Supplier Invoice",
          disabled: existingInvoiceTypes.includes("supplier"),
        },
        {
          value: "commission",
          label: "Commission Agent Invoice",
          disabled: existingInvoiceTypes.includes("commission"),
        }
      );
    } else {
      // Sales contract can only create commission invoices
      baseTypes.push({
        value: "commission",
        label: "Commission Agent Invoice",
        disabled: existingInvoiceTypes.includes("commission"),
      });
    }

    return baseTypes;
  };

  const handleInvoiceTypeSelection = (invoiceType) => {
    const contractType = getContractType();
    const queryParams = new URLSearchParams({
      contractId: Data._id,
      contractType: contractType,
      businessId: Data.business,
      vendorId:
        invoiceType === "commission"
          ? Data.basicInfo?.agent_id || ""
          : Data.basicInfo?.selectedVendorId?._id || "",
      invoiceType: invoiceType,
    }).toString();

    history.push(`/create-vendor-invoice?${queryParams}`);
    setShowDropdown(false);
  };

  const handleAddNew = () => {
    const availableTypes = getAvailableInvoiceTypes();
    const enabledTypes = availableTypes.filter((type) => !type.disabled);

    if (enabledTypes.length === 1) {
      // If only one type is available, go directly
      handleInvoiceTypeSelection(enabledTypes[0].value);
    } else if (enabledTypes.length > 1) {
      // Show dropdown if multiple types are available
      setShowDropdown(!showDropdown);
    } else {
      // No types available
      notifyError(
        "All invoice types have already been created for this contract."
      );
    }
  };

  const handleViewInvoice = (invoiceId) => {
    history.push(`/view-vendor-invoice/${invoiceId}`);
  };

  const handleEditInvoice = (invoiceId) => {
    history.push(`/update-vendor-invoice/${invoiceId}`);
  };

  const handleViewExpense = (expenseId) => {
    history.push(`/view-expense/${expenseId}`);
  };

  const handleEditExpense = (expenseId) => {
    history.push(`/update-expense/${expenseId}`);
  };

  // Helper function to render unified table
  const renderUnifiedTable = () => (
    <DataCard className="mb-6">
      <PageHeader title="All Expenses (Purchases, Shipments, Invoices & More)">
        <div className="flex items-center gap-4">
          <div className="relative">
            <button
              onClick={handleAddNew}
              className="flex items-center bg-[#F2F2F2] text-black text-sm font-medium px-4 py-2 rounded-xl shadow-sm hover:bg-gray-200 transition"
            >
              Add Invoice
              <span className="ml-2 flex items-center justify-center w-6 h-6 bg-[var(--p-blue)] text-white rounded-full">
                {getAvailableInvoiceTypes().filter((type) => !type.disabled)
                  .length > 1 ? (
                  <ChevronDown size={14} />
                ) : (
                  <Plus size={14} />
                )}
              </span>
            </button>

            {showDropdown && (
              <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                <div className="py-1">
                  {getAvailableInvoiceTypes().map((type) => (
                    <button
                      key={type.value}
                      onClick={() =>
                        !type.disabled && handleInvoiceTypeSelection(type.value)
                      }
                      disabled={type.disabled}
                      className={`block w-full text-left px-4 py-2 text-sm transition-colors ${
                        type.disabled
                          ? "text-gray-400 cursor-not-allowed bg-gray-50"
                          : "text-gray-700 hover:bg-gray-100 hover:text-gray-900 cursor-pointer"
                      }`}
                    >
                      {type.label}
                      {type.disabled && (
                        <span className="text-xs text-gray-400 block">
                          Already created
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </PageHeader>

      <div className="overflow-x-auto">
        <DataTable
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={(page) => setCurrentPage(page)}
          recordsPerPage={entriesPerPage}
          onRecordsPerPageChange={(num) => {
            setEntriesPerPage(num);
            setCurrentPage(1);
          }}
          searchValue={searchTerm}
          onSearch={(val) => {
            setSearchTerm(val);
            setCurrentPage(1);
          }}
          searchPlaceholder="Search all records..."
          headers={[
            "Number",
            "Vendor/Employee",
            "Type",
            "Amount",
            "Date Created",
            "Status",
            "Actions",
          ]}
          data={allData}
          loading={loading}
          colWidths={{
            Number: "minmax(120px, 1fr)",
            "Vendor/Employee": "minmax(150px, 2fr)",
            Type: "minmax(140px, 1fr)",
            Amount: "minmax(100px, 1fr)",
            "Date Created": "minmax(120px, 1fr)",
            Status: "minmax(100px, 1fr)",
            Actions: "minmax(80px, 0.5fr)",
          }}
          renderRow={(record) => {
            // Determine the display number based on record type
            const displayNumber =
              record.recordType === "invoice"
                ? record.invoiceNumber
                : record.recordType === "expense"
                ? record.expenseNumber
                : record.recordType === "purchase"
                ? record.contractNumber
                : record.recordType === "shipment"
                ? record.shipmentNumber
                : "N/A";

            // Determine vendor/supplier name
            const vendorName =
              record.recordType === "purchase"
                ? record.basicInfo?.selectedVendorId?.basicInformation
                    ?.vendorDisplayName || "Supplier"
                : record.vendor?.basicInformation?.vendorDisplayName ||
                  record.employee?.displayName ||
                  record.employee?.fullName ||
                  "N/A";

            // Determine vendor type
            const vendorType =
              record.recordType === "purchase"
                ? "Supplier"
                : record.recordType === "shipment"
                ? "Service Provider"
                : record.recordType === "invoice"
                ? record.vendor?.basicInformation?.vendorType || "Vendor"
                : record.expenseType === "staff_claims"
                ? "Employee"
                : "Vendor";

            // Determine if actions are available
            const hasActions =
              record.recordType === "invoice" ||
              record.recordType === "expense";
            const baseCurrencyUpper = baseCurrency.toUpperCase();
            const recordCurrency = (
              record.currency || baseCurrency
            ).toUpperCase();

            return (
              <tr
                key={record._id}
                className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <td className="py-4 px-4 font-medium text-gray-900">
                  {displayNumber}
                </td>
                <td className="py-4 px-4">
                  <div className="text-sm">
                    <p className="font-medium text-gray-900">{vendorName}</p>
                    <p className="text-gray-500">{vendorType}</p>
                  </div>
                </td>
                <td className="py-4 px-4">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(
                      record.type
                    )}`}
                  >
                    {record.type}
                  </span>
                </td>
                <td className="py-4 px-4 font-medium text-gray-900">
                  <div className="text-sm font-medium text-gray-900">
                    {formatAmount(record.total)} {recordCurrency}
                  </div>
                  {record.baseAmount !== undefined &&
                    record.currency &&
                    recordCurrency !== baseCurrencyUpper && (
                      <div className="text-xs text-gray-500">
                        ≈ {formatAmount(record.baseAmount)} {baseCurrencyUpper}
                      </div>
                    )}
                </td>
                <td className="py-4 px-4 text-gray-600">
                  {formatDate(record.createdAt)}
                </td>
                <td className="py-4 px-4">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                      record.status
                    )}`}
                  >
                    {record.status}
                  </span>
                </td>
                <td className="py-4 px-4">
                  {hasActions ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          record.recordType === "invoice"
                            ? handleViewInvoice(record._id)
                            : handleViewExpense(record._id)
                        }
                        className="p-1 text-gray-500 hover:text-[var(--p-blue)] transition-colors"
                        title={
                          record.recordType === "invoice"
                            ? "View Invoice"
                            : "View Expense"
                        }
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() =>
                          record.recordType === "invoice"
                            ? handleEditInvoice(record._id)
                            : handleEditExpense(record._id)
                        }
                        className="p-1 text-gray-500 hover:text-[var(--p-blue)] transition-colors"
                        title={
                          record.recordType === "invoice"
                            ? "Edit Invoice"
                            : "Edit Expense"
                        }
                      >
                        <PenSquare size={16} />
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">View only</span>
                  )}
                </td>
              </tr>
            );
          }}
          emptyMessage={
            <div className="text-center py-8">
              <p className="text-gray-600 text-lg mb-4">
                📋 No expenses found for this contract
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-lg mx-auto text-left">
                <p className="text-sm text-gray-700 font-semibold mb-3">
                  What shows here:
                </p>
                <ul className="text-sm text-gray-700 space-y-2">
                  <li>
                    ✓ <strong>Purchase Contracts</strong> - Linked supplier
                    contracts
                  </li>
                  <li>
                    ✓ <strong>Shipment Costs</strong> - Freight, Insurance,
                    Warehousing
                  </li>
                  <li>
                    ✓ <strong>Vendor Invoices</strong> - Commission Agent, LSP
                    Invoices
                  </li>
                  <li>
                    ✓ <strong>General Expenses</strong> - Staff Claims, Bills,
                    Rents
                  </li>
                </ul>
                <div className="mt-4 pt-3 border-t border-blue-300">
                  <p className="text-sm text-blue-600 font-medium">
                    💡 Tip: Use "Add Invoice" button above to create vendor
                    invoices
                  </p>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-4">
                Note: Customer Invoices (Proforma/Commercial) are shown in
                Billing tab, not here.
              </p>
            </div>
          }
        />
      </div>
    </DataCard>
  );

  return (
    <div className="space-y-6 w-full max-w-full overflow-hidden">
      {/* Unified Table */}
      {renderUnifiedTable()}
    </div>
  );
};

export default ExpensesTable;
