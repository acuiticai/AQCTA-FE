import React, { useState, useEffect, useContext } from "react";
import {
  TrendingUp,
  Building,
  Users,
  FileText,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import axios from "axios";
import { AdminContext } from "@/context/AdminContext";
import { notifyError } from "@/utils/toast";
import SearchableDropdown from "@/components/SearchableDropdown";
import ProfitabilityAnalysis from "./ProfitabilityAnalysis";
import FinancialService from "@/services/financialService";
import {
  PageHeader,
  SummaryCards,
  DataTable,
  ActionButtons,
} from "@/page-layouts";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";
import {
  formatAmount,
  formatDate,
  formatTime,
} from "@/components/formatAmount";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const ProfitabilityReport = ({ onBack }) => {
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;

  // State management
  const [businesses, setBusinesses] = useState([]);
  const [selectedBusiness, setSelectedBusiness] = useState("");
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [salesContracts, setSalesContracts] = useState([]);
  const [selectedSalesContract, setSelectedSalesContract] = useState(null);
  const [profitabilityData, setProfitabilityData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);

  // Data states
  const [customerInvoices, setCustomerInvoices] = useState([]);
  const [vendorInvoices, setVendorInvoices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [purchaseContracts, setPurchaseContracts] = useState([]);

  // Currency selection state
  const [availableCurrencies, setAvailableCurrencies] = useState([]);
  const [selectedCurrency, setSelectedCurrency] = useState("");
  const [baseCurrency, setBaseCurrency] = useState("");

  // Table states
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Summary stats
  const [summaryStats, setSummaryStats] = useState({
    totalContracts: 0,
    totalValue: 0,
    totalProfit: 0,
    averageMargin: 0,
  });

  useEffect(() => {
    fetchBusinesses();
    fetchCustomers();
  }, []);

  useEffect(() => {
    fetchSalesContracts();
  }, [
    selectedBusiness,
    selectedCustomer,
    searchTerm,
    currentPage,
    recordsPerPage,
  ]);

  useEffect(() => {
    calculateSummaryStats();
  }, [salesContracts]);

  const fetchBusinesses = async () => {
    try {
      setLoading(true);
      const storedBusinesses = localStorage.getItem("businesses");
      if (storedBusinesses) {
        const parsedBusinesses = JSON.parse(storedBusinesses);
        setBusinesses(parsedBusinesses);
      } else {
        const response = await axios.get(`${Base_URL}/business`, {
          headers: {
            authorization: `Bearer ${adminInfo.token}`,
          },
        });
        const businessData = response.data.data || [];
        setBusinesses(businessData);
        localStorage.setItem("businesses", JSON.stringify(businessData));
      }
    } catch (error) {
      console.error("Error fetching businesses:", error);
      notifyError("Failed to fetch businesses");
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await axios.get(`${Base_URL}/customers`, {
        headers: {
          authorization: `Bearer ${adminInfo.token}`,
        },
      });
      if (response.status === 200 && response.data) {
        setCustomers(response.data.customers || []);
      }
    } catch (error) {
      console.error("❌ Error fetching customers:", error);
    }
  };

  const fetchBusinessCurrencies = async (businessId) => {
    try {
      if (!businessId) return;

      const response = await axios.get(
        `${Base_URL}/finance/currencies?business_id=${businessId}`,
        {
          headers: {
            authorization: `Bearer ${adminInfo.token}`,
          },
        }
      );

      if (response.status === 200 && response.data) {
        const currencies = response.data.data || [];
        setAvailableCurrencies(currencies);

        // Find base currency (isBase: true)
        const base = currencies.find((currency) => currency.isBase);
        if (base) {
          setBaseCurrency(base.symbol);
          setSelectedCurrency(base.symbol); // Set base currency as default
        }

        console.log("✅ Business currencies loaded:", {
          total: currencies.length,
          base: base?.symbol,
          currencies: currencies.map((c) => ({
            symbol: c.symbol,
            isBase: c.isBase,
          })),
        });
      }
    } catch (error) {
      console.error("❌ Error fetching business currencies:", error);
      setAvailableCurrencies([]);
    }
  };

  const fetchCustomersForBusiness = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${Base_URL}/customers`, {
        params: { businessId: selectedBusiness },
        headers: {
          authorization: `Bearer ${adminInfo.token}`,
        },
      });
      if (response.status === 200 && response.data) {
        setCustomers(response.data.customers || []);
      }
    } catch (error) {
      console.error("❌ Error fetching customers for business:", error);
      notifyError("Failed to fetch customers");
    } finally {
      setLoading(false);
    }
  };

  const fetchSalesContracts = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();

      if (selectedBusiness) {
        queryParams.append("businessId", selectedBusiness);
      }
      if (selectedCustomer) {
        queryParams.append("customerId", selectedCustomer);
      }
      if (searchTerm) {
        queryParams.append("search", searchTerm);
      }
      queryParams.append("page", currentPage);
      queryParams.append("limit", recordsPerPage);

      const response = await axios.get(
        `${Base_URL}/sales-contracts?${queryParams.toString()}`,
        {
          headers: {
            authorization: `Bearer ${adminInfo.token}`,
          },
        }
      );

      const contracts = response.data.contracts || response.data.data || [];
      setSalesContracts(contracts);
      setTotalCount(response.data.totalCount || contracts.length);
      setTotalPages(
        response.data.totalPages || Math.ceil(contracts.length / recordsPerPage)
      );
    } catch (error) {
      console.error("Error fetching sales contracts:", error);
      notifyError("Failed to fetch sales contracts");
    } finally {
      setLoading(false);
    }
  };

  const calculateSummaryStats = () => {
    if (salesContracts.length === 0) {
      setSummaryStats({
        totalContracts: 0,
        totalValue: 0,
        totalProfit: 0,
        averageMargin: 0,
      });
      return;
    }

    let totalValue = 0;
    let totalProfit = 0;
    let contractsWithValue = 0;

    salesContracts.forEach((contract) => {
      if (contract.productInfo && contract.productInfo.length > 0) {
        const contractValue = contract.productInfo.reduce(
          (sum, product) => sum + (product.totalValue || 0),
          0
        );
        totalValue += contractValue;
        contractsWithValue++;

        // Simple profit calculation (this could be enhanced with actual cost data)
        const estimatedProfit = contractValue * 0.1; // 10% estimated margin
        totalProfit += estimatedProfit;
      }
    });

    const averageMargin =
      contractsWithValue > 0 ? (totalProfit / totalValue) * 100 : 0;

    setSummaryStats({
      totalContracts: salesContracts.length,
      totalValue,
      totalProfit,
      averageMargin,
    });
  };

  const fetchProfitabilityData = async (contract = selectedSalesContract) => {
    try {
      setLoading(true);

      // Fetch business currencies first
      const businessId =
        contract?.business || contract?.business_id || selectedBusiness;
      await fetchBusinessCurrencies(businessId);

      // Fetch all data in parallel
      const [
        invoicesRes,
        salesVendorInvoicesRes,
        salesExpensesRes,
        purchaseContractsRes,
      ] = await Promise.all([
        // Customer invoices for this sales contract
        axios.get(`${Base_URL}/proforma-invoice`, {
          params: { contractId: contract._id },
          headers: { authorization: `Bearer ${adminInfo.token}` },
        }),
        // Vendor invoices for this sales contract (commission agents)
        axios.get(`${Base_URL}/vendor-invoices`, {
          params: {
            contract: contract.contractNo, // Search by contract number in items (like ExpensesTable.jsx)
            business:
              contract.business || contract.business_id || selectedBusiness,
            type: "commission", // Only fetch commission invoices
          },
          headers: { authorization: `Bearer ${adminInfo.token}` },
        }),
        // Expenses for this sales contract
        axios.get(`${Base_URL}/expenses`, {
          params: {
            contractId: contract._id,
            contractNumber: contract.contractNo,
            contractType: "sales",
            business:
              contract.business || contract.business_id || selectedBusiness,
          },
          headers: { authorization: `Bearer ${adminInfo.token}` },
        }),
        // Purchase contracts linked to this sales contract
        axios.get(
          `${Base_URL}/purchase-contracts/get_assigned_to_sales/${contract._id}`,
          {
            headers: { authorization: `Bearer ${adminInfo.token}` },
          }
        ),
      ]);

      const allCustomerInvoices = invoicesRes.data.data || [];
      const salesVendorInvoices = salesVendorInvoicesRes.data.data || [];
      const salesExpenses = salesExpensesRes.data.data || [];
      const linkedPurchaseContracts = purchaseContractsRes.data.contracts || [];

      // Debug API responses
      console.log("=== API RESPONSES DEBUG ===");
      console.log("Vendor Invoices API Response:", salesVendorInvoicesRes.data);
      console.log(
        "Vendor Invoices Count:",
        salesVendorInvoicesRes.data.data?.length || 0
      );
      console.log("Expenses API Response:", salesExpensesRes.data);
      console.log("Expenses Count:", salesExpensesRes.data.data?.length || 0);

      // Debug logging
      console.log("=== PROFITABILITY DATA DEBUG ===");
      console.log("Sales Contract ID:", contract._id);
      console.log("Sales Contract Number:", contract.contractNo);
      console.log(
        "Sales Contract Business:",
        contract.business,
        contract.business_id
      );
      console.log("Selected Business:", selectedBusiness);
      console.log("Vendor Invoice API Parameters:", {
        contract: contract.contractNo,
        business: contract.business || contract.business_id || selectedBusiness,
        type: "commission",
      });
      console.log("Customer Invoices:", allCustomerInvoices.length);
      console.log(
        "Sales Vendor Invoices:",
        salesVendorInvoices.length,
        salesVendorInvoices
      );
      console.log("Sales Expenses:", salesExpenses.length, salesExpenses);
      console.log("Linked Purchase Contracts:", linkedPurchaseContracts.length);

      // Now fetch costs from linked purchase contracts
      let purchaseContractCosts = {
        vendorInvoices: [],
        expenses: [],
      };

      if (linkedPurchaseContracts.length > 0) {
        const purchaseContractIds = linkedPurchaseContracts.map((pc) => pc._id);

        // Fetch vendor invoices for each purchase contract separately
        const vendorInvoicePromises = linkedPurchaseContracts.map(
          (purchaseContract) =>
            axios.get(`${Base_URL}/vendor-invoices`, {
              params: {
                contract: purchaseContract.contractNo, // Use contract number like ExpensesTable.jsx
                // Remove business filter to get all invoices for this contract regardless of business
              },
              headers: { authorization: `Bearer ${adminInfo.token}` },
            })
        );

        // Fetch expenses for each purchase contract separately
        const expensePromises = linkedPurchaseContracts.map(
          (purchaseContract) =>
            axios.get(`${Base_URL}/expenses`, {
              params: {
                contractNumber: purchaseContract.contractNo, // Use contract number like ExpensesTable.jsx
                contractId: purchaseContract._id,
                contractType: "purchase",
                // Remove business filter to get all expenses for this contract regardless of business
              },
              headers: { authorization: `Bearer ${adminInfo.token}` },
            })
        );

        const [purchaseVendorInvoicesRes, purchaseExpensesRes] =
          await Promise.all([
            // Combine all vendor invoice responses
            Promise.all(vendorInvoicePromises).then((responses) => ({
              data: {
                data: responses.flatMap((response) => response.data.data || []),
              },
            })),
            // Combine all expense responses
            Promise.all(expensePromises).then((responses) => ({
              data: {
                data: responses.flatMap((response) => response.data.data || []),
              },
            })),
          ]);

        purchaseContractCosts.vendorInvoices =
          purchaseVendorInvoicesRes.data.data || [];
        purchaseContractCosts.expenses = purchaseExpensesRes.data.data || [];

        console.log("=== PURCHASE CONTRACT COSTS DEBUG ===");
        console.log("Linked Purchase Contracts:", linkedPurchaseContracts);
        console.log(
          "Purchase Contract Vendor Invoices:",
          purchaseContractCosts.vendorInvoices.length,
          purchaseContractCosts.vendorInvoices
        );
        console.log(
          "Purchase Contract Expenses:",
          purchaseContractCosts.expenses.length,
          purchaseContractCosts.expenses
        );
      }

      setCustomerInvoices(allCustomerInvoices);
      setVendorInvoices([
        ...salesVendorInvoices,
        ...purchaseContractCosts.vendorInvoices,
      ]);
      setExpenses([...salesExpenses, ...purchaseContractCosts.expenses]);
      setPurchaseContracts(linkedPurchaseContracts);

      await calculateProfitability(
        allCustomerInvoices,
        salesVendorInvoices,
        salesExpenses,
        purchaseContractCosts,
        linkedPurchaseContracts,
        contract
      );
    } catch (error) {
      console.error("Error fetching profitability data:", error);
      notifyError("Failed to fetch profitability data");
    } finally {
      setLoading(false);
    }
  };

  const calculateProfitability = async (
    invoices,
    salesVendorInvoices,
    salesExpenses,
    purchaseContractCosts,
    purchaseContracts,
    contract = selectedSalesContract
  ) => {
    try {
      // Get business ID for custom currency conversion
      const businessId =
        contract?.business || contract?.business_id || selectedBusiness;
      const targetCurrency = selectedCurrency || baseCurrency || "USD";

      // Helper function to convert currency to target currency using custom rates
      const convertToTargetCurrency = async (amount, currency) => {
        if (!amount || amount === 0) return 0;
        if (currency === targetCurrency) return amount;

        try {
          const conversion = await FinancialService.convertCurrency(
            currency,
            targetCurrency,
            amount,
            businessId
          );
          return conversion.success ? conversion.convertedAmount : amount;
        } catch (error) {
          console.warn(
            `Currency conversion failed for ${currency} to ${targetCurrency}:`,
            error
          );
          return amount; // Fallback to original amount
        }
      };

      // Calculate Revenue
      let totalRevenue = 0;
      const revenueBreakdown = {};

      // Process invoices with async currency conversion
      for (const invoice of invoices) {
        const currency = invoice.currency || "USD";
        const amountInTargetCurrency = await convertToTargetCurrency(
          invoice.grandTotal || 0,
          currency
        );
        totalRevenue += amountInTargetCurrency;

        if (!revenueBreakdown[currency]) {
          revenueBreakdown[currency] = { amount: 0, count: 0 };
        }
        revenueBreakdown[currency].amount += invoice.grandTotal || 0;
        revenueBreakdown[currency].count++;
      }

      // Calculate comprehensive costs
      let totalCosts = 0;
      const detailedCostBreakdown = {
        salesContractCosts: {
          commissionAgentInvoices: { amount: 0, count: 0, items: [] },
          directExpenses: { amount: 0, count: 0, items: [] },
          subtotal: 0,
        },
        purchaseContractCosts: {
          supplierInvoices: { amount: 0, count: 0, items: [] },
          logisticsInvoices: { amount: 0, count: 0, items: [] },
          commissionAgentInvoices: { amount: 0, count: 0, items: [] },
          otherExpenses: { amount: 0, count: 0, items: [] },
          subtotal: 0,
        },
        total: 0,
      };

      // Sales Contract Costs
      // 1. Commission Agent Invoices for Sales Contract
      console.log("Processing Sales Vendor Invoices:", salesVendorInvoices);
      for (const invoice of salesVendorInvoices) {
        console.log(
          "Processing invoice:",
          invoice.invoiceNumber,
          "Type:",
          invoice.invoiceType,
          "Total:",
          invoice.total,
          "Currency:",
          invoice.currency
        );
        const currency = invoice.currency || "USD";
        const amountInTargetCurrency = await convertToTargetCurrency(
          invoice.total || 0,
          currency
        );
        console.log(
          "Amount in Target Currency:",
          amountInTargetCurrency,
          "Currency:",
          currency
        );
        totalCosts += amountInTargetCurrency;
        detailedCostBreakdown.salesContractCosts.commissionAgentInvoices.amount +=
          amountInTargetCurrency;
        detailedCostBreakdown.salesContractCosts.commissionAgentInvoices
          .count++;
        detailedCostBreakdown.salesContractCosts.commissionAgentInvoices.items.push(
          {
            ...invoice,
            amountInTargetCurrency,
            currency,
            source: "Sales Contract Commission Agent",
          }
        );
      }

      // 2. Direct Expenses for Sales Contract
      console.log("Processing Sales Expenses:", salesExpenses);
      for (const expense of salesExpenses) {
        console.log(
          "Processing expense:",
          expense.expenseNumber,
          "Amount:",
          expense.total
        );
        const currency = expense.currency || "USD";
        const amountInTargetCurrency = await convertToTargetCurrency(
          expense.total || 0,
          currency
        );
        totalCosts += amountInTargetCurrency;
        detailedCostBreakdown.salesContractCosts.directExpenses.amount +=
          amountInTargetCurrency;
        detailedCostBreakdown.salesContractCosts.directExpenses.count++;
        detailedCostBreakdown.salesContractCosts.directExpenses.items.push({
          ...expense,
          amountInTargetCurrency,
          currency,
          source: "Sales Contract Direct Expense",
        });
      }

      // Purchase Contract Costs
      // 1. Vendor Invoices from Purchase Contracts
      console.log(
        "Processing Purchase Contract Vendor Invoices:",
        purchaseContractCosts.vendorInvoices
      );
      for (const invoice of purchaseContractCosts.vendorInvoices) {
        console.log(
          "Processing purchase contract invoice:",
          invoice.invoiceNumber,
          "Type:",
          invoice.invoiceType,
          "Vendor Type:",
          invoice.vendor?.basicInformation?.vendorType,
          "Total:",
          invoice.total
        );
        const currency = invoice.currency || "USD";
        const amountInTargetCurrency = await convertToTargetCurrency(
          invoice.total || 0,
          currency
        );
        console.log(
          "Purchase contract invoice amount in Target Currency:",
          amountInTargetCurrency,
          "Currency:",
          currency
        );
        totalCosts += amountInTargetCurrency;

        // Categorize by invoice type
        const invoiceType = invoice.invoiceType?.toLowerCase();
        if (invoiceType === "supplier") {
          detailedCostBreakdown.purchaseContractCosts.supplierInvoices.amount +=
            amountInTargetCurrency;
          detailedCostBreakdown.purchaseContractCosts.supplierInvoices.count++;
          detailedCostBreakdown.purchaseContractCosts.supplierInvoices.items.push(
            {
              ...invoice,
              amountInTargetCurrency,
              currency,
              source: "Purchase Contract Supplier",
            }
          );
        } else if (
          invoiceType === "logistics" ||
          invoiceType === "logistic" ||
          invoiceType === "logistic service provider"
        ) {
          detailedCostBreakdown.purchaseContractCosts.logisticsInvoices.amount +=
            amountInTargetCurrency;
          detailedCostBreakdown.purchaseContractCosts.logisticsInvoices.count++;
          detailedCostBreakdown.purchaseContractCosts.logisticsInvoices.items.push(
            {
              ...invoice,
              amountInTargetCurrency,
              currency,
              source: "Purchase Contract Logistics",
            }
          );
        } else if (
          invoiceType === "commission" ||
          invoice.vendor?.basicInformation?.vendorType === "Agent"
        ) {
          detailedCostBreakdown.purchaseContractCosts.commissionAgentInvoices.amount +=
            amountInTargetCurrency;
          detailedCostBreakdown.purchaseContractCosts.commissionAgentInvoices
            .count++;
          detailedCostBreakdown.purchaseContractCosts.commissionAgentInvoices.items.push(
            {
              ...invoice,
              amountInTargetCurrency,
              currency,
              source: "Purchase Contract Commission Agent",
            }
          );
        }
      }

      // 2. Expenses from Purchase Contracts
      console.log(
        "Processing Purchase Contract Expenses:",
        purchaseContractCosts.expenses
      );
      for (const expense of purchaseContractCosts.expenses) {
        console.log(
          "Processing purchase contract expense:",
          expense.expenseNumber,
          "Amount:",
          expense.total
        );
        const currency = expense.currency || "USD";
        const amountInTargetCurrency = await convertToTargetCurrency(
          expense.total || 0,
          currency
        );
        console.log(
          "Purchase contract expense amount in Target Currency:",
          amountInTargetCurrency,
          "Currency:",
          currency
        );
        totalCosts += amountInTargetCurrency;
        detailedCostBreakdown.purchaseContractCosts.otherExpenses.amount +=
          amountInTargetCurrency;
        detailedCostBreakdown.purchaseContractCosts.otherExpenses.count++;
        detailedCostBreakdown.purchaseContractCosts.otherExpenses.items.push({
          ...expense,
          amountInTargetCurrency,
          currency,
          source: "Purchase Contract Expense",
        });
      }

      // Calculate subtotals
      detailedCostBreakdown.salesContractCosts.subtotal =
        detailedCostBreakdown.salesContractCosts.commissionAgentInvoices
          .amount +
        detailedCostBreakdown.salesContractCosts.directExpenses.amount;

      detailedCostBreakdown.purchaseContractCosts.subtotal =
        detailedCostBreakdown.purchaseContractCosts.supplierInvoices.amount +
        detailedCostBreakdown.purchaseContractCosts.logisticsInvoices.amount +
        detailedCostBreakdown.purchaseContractCosts.commissionAgentInvoices
          .amount +
        detailedCostBreakdown.purchaseContractCosts.otherExpenses.amount;

      detailedCostBreakdown.total = totalCosts;

      console.log("=== FINAL COST BREAKDOWN ===");
      console.log("Final Cost Breakdown:", detailedCostBreakdown);
      console.log("Total Revenue:", totalRevenue);
      console.log("Total Costs:", totalCosts);
      console.log(
        "Sales Contract Costs Subtotal:",
        detailedCostBreakdown.salesContractCosts.subtotal
      );
      console.log(
        "Purchase Contract Costs Subtotal:",
        detailedCostBreakdown.purchaseContractCosts.subtotal
      );

      const grossProfit = totalRevenue - totalCosts;
      const profitMargin =
        totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
      const roi = totalCosts > 0 ? (grossProfit / totalCosts) * 100 : 0;

      setProfitabilityData({
        totalRevenue,
        totalCosts,
        grossProfit,
        profitMargin,
        roi,
        revenueBreakdown,
        detailedCostBreakdown,
        summary: {
          totalInvoices: invoices.length,
          totalSalesVendorInvoices: salesVendorInvoices.length,
          totalSalesExpenses: salesExpenses.length,
          totalPurchaseVendorInvoices:
            purchaseContractCosts.vendorInvoices.length,
          totalPurchaseExpenses: purchaseContractCosts.expenses.length,
          totalPurchaseContracts: purchaseContracts.length,
          contractValue:
            contract.productInfo?.reduce(
              (sum, product) => sum + (product.totalValue || 0),
              0
            ) || 0,
        },
      });
    } catch (error) {
      console.error("Error calculating profitability:", error);
      notifyError("Error calculating profitability");
    }
  };

  // Handler functions
  const handleViewAnalysis = async (contract) => {
    setSelectedSalesContract(contract);
    await fetchProfitabilityData(contract);
    setShowAnalysis(true);
  };

  const handleBackToTable = () => {
    setShowAnalysis(false);
    setSelectedSalesContract(null);
    setProfitabilityData(null);
  };

  const handleCurrencyChange = async (newCurrency) => {
    console.log("🔄 Currency changed to:", newCurrency);
    setSelectedCurrency(newCurrency);
    // Recalculate profitability with new currency
    if (selectedSalesContract) {
      await fetchProfitabilityData(selectedSalesContract);
    }
  };

  const clearAllFilters = () => {
    setSelectedBusiness("");
    setSelectedCustomer("");
    setSearchTerm("");
    setCurrentPage(1);
  };

  // Transform data for dropdowns
  const businessOptions = businesses.map((business) => ({
    value: business._id,
    label: business.name,
  }));

  const customerOptions = customers.map((customer) => ({
    value: customer._id,
    label:
      customer?.basicInfo?.buyerCompanyName ||
      customer.basicInformation?.customerDisplayName ||
      customer.companyName ||
      "Unknown Customer",
  }));

  // Table configuration
  const headers = [
    "Contract No",
    "Customer",
    "Total Value",
    "Status",
    "Created Date",
    "Business",
    "Agent",
    "Actions",
  ];

  const summaryCardsData = [
    {
      title: "Total Contracts",
      value: summaryStats.totalContracts,
      isHighlighted: true,
    },
    {
      title: "Total Value",
      value: formatAmount(summaryStats.totalValue),
    },
    {
      title: "Estimated Profit",
      value: formatAmount(summaryStats.totalProfit),
    },
    {
      title: "Average Margin",
      value: `${summaryStats.averageMargin.toFixed(1)}%`,
    },
  ];

  const filters = [
    {
      isClearButton: true,
      buttonProps: {
        onClick: clearAllFilters,
      },
    },
    {
      value: selectedBusiness,
      onChange: (value) => {
        setSelectedBusiness(value);
        setCurrentPage(1);
      },
      placeholder: "Filter by Business",
      options: [{ value: "", label: "All Businesses" }, ...businessOptions],
    },
    {
      value: selectedCustomer,
      onChange: (value) => {
        setSelectedCustomer(value);
        setCurrentPage(1);
      },
      placeholder: "Filter by Customer",
      options: [{ value: "", label: "All Customers" }, ...customerOptions],
    },
  ];

  if (showAnalysis && selectedSalesContract && profitabilityData) {
    console.log("📊 Rendering ProfitabilityAnalysis with props:", {
      availableCurrencies: availableCurrencies?.length || 0,
      selectedCurrency,
      baseCurrency,
      currencies: availableCurrencies?.map((c) => ({
        symbol: c.symbol,
        isBase: c.isBase,
      })),
    });

    return (
      <ProfitabilityAnalysis
        profitabilityData={profitabilityData}
        selectedSalesContract={selectedSalesContract}
        customerInvoices={customerInvoices}
        vendorInvoices={vendorInvoices}
        expenses={expenses}
        purchaseContracts={purchaseContracts}
        availableCurrencies={availableCurrencies}
        selectedCurrency={selectedCurrency}
        baseCurrency={baseCurrency}
        onCurrencyChange={handleCurrencyChange}
        onBack={handleBackToTable}
      />
    );
  }

  return (
    <div className="p-6 bg-white min-h-screen">
      {/* Table with Filters */}
      <DataTable
        onSearch={setSearchTerm}
        searchValue={searchTerm}
        searchPlaceholder="Search contracts..."
        filters={filters}
        headers={headers}
        totalRecords={totalCount}
        data={salesContracts}
        loading={loading}
        currentPage={currentPage}
        totalPages={totalPages}
        recordsPerPage={recordsPerPage}
        isDynamicActionColumn={true}
        onPageChange={(page) => setCurrentPage(page)}
        onRecordsPerPageChange={(perPage) => {
          setRecordsPerPage(perPage);
          setCurrentPage(1);
        }}
        renderRow={(contract, index) => {
          const isProfitSharing =
            contract?.basicInfo?.typeOfSaleContract === "Profit Sharing";

          return (
            <tr
              key={contract._id || index}
              className={`border-b ${
                isProfitSharing
                  ? "bg-gradient-to-r from-yellow-50 to-orange-50 border-l-4 border-red-500 shadow-sm"
                  : ""
              }`}
            >
              <td className="py-2 px-4">
                <div className="flex items-center gap-2">
                  <span
                    className={
                      isProfitSharing ? "font-semibold text-red-600" : ""
                    }
                  >
                    {contract.contractNo}
                  </span>
                </div>
              </td>
              <td className="py-2 px-4">
                <span
                  className={
                    isProfitSharing ? "font-semibold text-red-600" : ""
                  }
                >
                  {contract?.basicInfo?.buyerCompanyName}
                </span>
              </td>
              <td className="py-2 px-4">
                <span
                  className={
                    isProfitSharing ? "font-semibold text-red-600" : ""
                  }
                >
                  {formatAmount(contract?.productInfo?.[0]?.totalValue)}
                </span>
              </td>
              <td className="py-2 px-4">
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full ${
                    contract.status === "Completed"
                      ? "bg-green-100 text-green-800"
                      : contract.status === "Processing"
                      ? "bg-blue-100 text-blue-800"
                      : contract.status === "Draft"
                      ? "bg-gray-100 text-gray-800"
                      : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  {contract.status}
                </span>
              </td>
              <td className="py-2 px-4">
                <span
                  className={
                    isProfitSharing ? "font-semibold text-red-600" : ""
                  }
                >
                  {`${formatDate(contract?.createdAt)} ${formatTime(
                    contract?.createdAt
                  )}`}
                </span>
              </td>
              <td className="py-2 px-4">
                <span
                  className={
                    isProfitSharing ? "font-semibold text-red-600" : ""
                  }
                >
                  {`${contract?.business?.name}`}
                </span>
              </td>
              <td className="py-2 px-4">
                {contract?.basicInfo?.agentName || contract?.agentName || "N/A"}
              </td>
              <td className="py-2 px-4">
                <ActionButtons
                  isCell={true}
                  items={[
                    {
                      action: ACTION_BUTTON_TYPES.VIEW,
                      tooltip: "View Profitability Analysis",
                      onClick: () => handleViewAnalysis(contract),
                    },
                  ]}
                />
              </td>
            </tr>
          );
        }}
      />

      {/* Show message when no contracts found */}
      {!loading && salesContracts.length === 0 && (
        <div className="mt-8 text-center">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-8">
            <div className="text-gray-500 text-lg mb-2">No contracts found</div>
            <div className="text-gray-400 text-sm">
              Try adjusting your search criteria or filters
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfitabilityReport;
