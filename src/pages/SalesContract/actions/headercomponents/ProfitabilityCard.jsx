import React, { useState, useEffect, useContext, useCallback } from "react";
import { formatAmount } from "@/components/formatAmount";
import { AdminContext } from "@/context/AdminContext";
import axios from "axios";
import { FiInfo, FiX } from "react-icons/fi";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

// Expense Breakdown Modal Component
const ExpenseBreakdownModal = ({
  isOpen,
  onClose,
  expenseBreakdown,
  loading,
  baseCurrency,
}) => {
  if (!isOpen) return null;

  const displayCurrency = (baseCurrency || "USD").toUpperCase();
  const normalizeCurrency = (currency) => {
    if (!currency) return displayCurrency;
    if (typeof currency === "string") return currency.toUpperCase();
    if (typeof currency === "object") {
      const value =
        currency.symbol || currency.code || currency.currency || "";
      if (value) return value.toUpperCase();
    }
    return displayCurrency;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Other Expenses Breakdown</h3>
          <button onClick={onClose} className="text-white hover:text-gray-300 transition-colors">
            <FiX size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading expenses...</span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Shipment Costs */}
              {expenseBreakdown.shipments.length > 0 && (
                <div className="border-b pb-4">
                  <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                    Shipment Costs
                  </h4>
                  <div className="space-y-2 ml-4">
                    {expenseBreakdown.shipments.map((shipment, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-gray-600">
                          {shipment.label}
                        </span>
                        <div className="text-right">
                          <div className="font-medium text-gray-900">
                            {formatAmount(shipment.amount)} {normalizeCurrency(shipment.currency)}
                          </div>
                          {shipment.baseAmount !== undefined &&
                            normalizeCurrency(shipment.currency) !== normalizeCurrency(displayCurrency) && (
                              <div className="text-xs text-gray-500">
                                ≈ {formatAmount(shipment.baseAmount)} {displayCurrency}
                              </div>
                            )}
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm font-semibold pt-2 border-t">
                      <span>Subtotal:</span>
                      <span className="text-blue-600">
                        {formatAmount(expenseBreakdown.shipmentTotal)} {displayCurrency}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Vendor Invoices */}
              {expenseBreakdown.vendorInvoices.length > 0 && (
                <div className="border-b pb-4">
                  <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                    Vendor Invoices & Commissions
                  </h4>
                  <div className="space-y-2 ml-4">
                    {expenseBreakdown.vendorInvoices.map((invoice, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-gray-600">
                          {invoice.label}
                        </span>
                        <div className="text-right">
                          <div className="font-medium text-gray-900">
                            {formatAmount(invoice.amount)} {normalizeCurrency(invoice.currency)}
                          </div>
                          {invoice.baseAmount !== undefined &&
                            normalizeCurrency(invoice.currency) !== normalizeCurrency(displayCurrency) && (
                              <div className="text-xs text-gray-500">
                                ≈ {formatAmount(invoice.baseAmount)} {displayCurrency}
                              </div>
                            )}
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm font-semibold pt-2 border-t">
                      <span>Subtotal:</span>
                      <span className="text-purple-600">
                        {formatAmount(expenseBreakdown.vendorInvoiceTotal)} {displayCurrency}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* General Expenses */}
              {expenseBreakdown.generalExpenses.length > 0 && (
                <div className="border-b pb-4">
                  <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                    General Expenses
                  </h4>
                  <div className="space-y-2 ml-4">
                    {expenseBreakdown.generalExpenses.map((expense, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-gray-600">
                          {expense.label}
                        </span>
                        <div className="text-right">
                          <div className="font-medium text-gray-900">
                            {formatAmount(expense.amount)} {normalizeCurrency(expense.currency)}
                          </div>
                          {expense.baseAmount !== undefined &&
                            normalizeCurrency(expense.currency) !== normalizeCurrency(displayCurrency) && (
                              <div className="text-xs text-gray-500">
                                ≈ {formatAmount(expense.baseAmount)} {displayCurrency}
                              </div>
                            )}
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm font-semibold pt-2 border-t">
                      <span>Subtotal:</span>
                      <span className="text-orange-600">
                        {formatAmount(expenseBreakdown.generalExpenseTotal)} {displayCurrency}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Total */}
              <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-slate-800">Total Other Expenses:</span>
                  <span className="text-2xl font-bold text-slate-900">
                    {formatAmount(expenseBreakdown.total)} {displayCurrency}
                  </span>
                </div>
              </div>

              {/* Empty State */}
              {expenseBreakdown.total === 0 && (
                <div className="text-center py-8">
                  <div className="text-gray-500 mb-4">
                    <p className="text-lg font-semibold mb-2">No Other Expenses Found</p>
                    <p className="text-sm">Other expenses include:</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto text-left">
                    <p className="text-sm text-gray-700 mb-2"><strong>• Shipment Costs:</strong> Freight, Insurance, Warehousing, etc.</p>
                    <p className="text-sm text-gray-700 mb-2"><strong>• Vendor Invoices:</strong> Commission Agent, LSP Invoices</p>
                    <p className="text-sm text-gray-700 mb-2"><strong>• General Expenses:</strong> Staff Claims, Bills, Rents</p>
                    <p className="text-sm text-blue-600 font-medium mt-3">
                      💡 Create these from Expenses tab → "Add Invoice" button
                    </p>
                  </div>
                  <div className="mt-4 text-xs text-gray-400">
                    Note: Customer Invoices (Proforma/Commercial) are not expenses - they are income shown in Billing tab.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ProfitabilityCard = ({ Data }) => {
  const [purchaseContracts, setPurchaseContracts] = useState([]);
  const [loadingPurchases, setLoadingPurchases] = useState(false);
  const [loadingExpenses, setLoadingExpenses] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseBreakdown, setExpenseBreakdown] = useState({
    shipments: [],
    vendorInvoices: [],
    generalExpenses: [],
    shipmentTotal: 0,
    vendorInvoiceTotal: 0,
    generalExpenseTotal: 0,
    total: 0,
  });
  const [baseCurrency, setBaseCurrency] = useState("USD");
  const [currencyRates, setCurrencyRates] = useState({ USD: 1 });
  const [currencyReady, setCurrencyReady] = useState(false);
  
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;

  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo?.token}`,
  };

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
        setBaseCurrency("USD");
        setCurrencyRates({ USD: 1 });
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
          setBaseCurrency("USD");
          setCurrencyRates({ USD: 1 });
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
            currency.isBase ?? currency.is_base ?? currency.baseCurrency ?? false;
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

  const convertToBase = useCallback(
    (amount, currencySymbol) => {
      if (!amount) return 0;
      const symbol = normalizeCurrencySymbol(currencySymbol);
      const rate = currencyRates[symbol];
      const numericAmount = Number(amount);
      if (!Number.isFinite(numericAmount)) {
        return 0;
      }
      if (rate === undefined || rate === null) {
        return numericAmount;
      }
      return numericAmount * rate;
    },
    [currencyRates, normalizeCurrencySymbol]
  );

  // Fetch linked purchase contracts for profitability calculation
  useEffect(() => {
    const fetchPurchaseContracts = async () => {
      if (!Data?._id) return;
      setLoadingPurchases(true);
      try {
        const response = await axios.get(
          `${Base_URL}/purchase-contracts/get_assigned_to_sales/${Data._id}`,
          { headers }
        );
        console.log("Linked purchase contracts:", response.data.contracts);
        setPurchaseContracts(response.data.contracts || []);
      } catch (err) {
        console.error("❌ Error fetching purchase contracts", err);
        setPurchaseContracts([]);
      } finally {
        setLoadingPurchases(false);
      }
    };

    if (Data?._id && adminInfo?.token) {
      fetchPurchaseContracts();
    }
  }, [Data?._id, adminInfo?.token]);

  // Fetch all expenses (shipments, vendor invoices, general expenses)
  useEffect(() => {
    if (!currencyReady) return;

    const fetchAllExpenses = async () => {
      if (!Data?._id || !Data?.contractNo) return;
      setLoadingExpenses(true);
      
      try {
        console.log("🔍 Fetching expenses for Sales Contract:", Data.contractNo);
        
        // First fetch purchase contracts to get their IDs for shipments
        const purchaseContractsResponse = await axios.get(
          `${Base_URL}/purchase-contracts/get_assigned_to_sales/${Data._id}`,
          { headers }
        );
        
        const purchaseContracts = purchaseContractsResponse.data.contracts || [];
        console.log("📦 Sales Contract ID:", Data._id);
        console.log("📦 Found linked purchase contracts:", purchaseContracts.length);
        
        // Get all purchase contract IDs
        const purchaseContractIds = purchaseContracts.map(pc => pc._id);
        console.log("📦 Purchase Contract IDs:", purchaseContractIds);
        
        // Fetch all expenses in parallel:
        // 1. Sales contract vendor invoices
        // 2. Sales contract expenses
        // 3. Purchase contract vendor invoices (for each purchase)
        // 4. Purchase contract expenses (for each purchase)
        // 5. Shipments (for each purchase)
        
        const businessId =
          Data?.business?._id ||
          (typeof Data?.business === "string" ? Data.business : null) ||
          Data?.basicInfo?.business?._id ||
          (typeof Data?.basicInfo?.business === "string"
            ? Data.basicInfo.business
            : null);

        // Sales Contract Vendor Invoices (fetch all, we'll filter in processing)
        const salesInvoiceParams = {
          contract: Data.contractNo,
          type: "commission",
        };
        if (businessId) {
          salesInvoiceParams.business = businessId;
        }

        const salesVendorInvoicePromise = axios.get(`${Base_URL}/vendor-invoices`, {
          params: salesInvoiceParams,
          headers,
        });
        
        const salesExpenseParams = {
          contractNumber: Data.contractNo,
          contractId: Data._id,
          contractType: "sales",
        };
        if (businessId) {
          salesExpenseParams.business = businessId;
        }

        const salesExpensesPromise = axios.get(`${Base_URL}/expenses`, {
          params: salesExpenseParams,
          headers,
        });
        
        // Purchase Contracts: fetch all vendor invoices per contract (filter later)
        const purchaseVendorInvoicePromises = purchaseContracts.map((pc, idx) => {
          console.log(`🔍 Fetching vendor invoices for Purchase Contract ${idx + 1} (${pc.contractNo}, ID: ${pc._id})`);
          return axios.get(`${Base_URL}/vendor-invoices`, {
            params: {
              contract: pc.contractNo,
            },
            headers,
          });
        });
        
        // Fetch expenses for each purchase contract
        const purchaseExpensesPromises = purchaseContracts.map((pc, idx) => {
          console.log(`🔍 Fetching expenses for Purchase Contract ${idx + 1} (${pc.contractNo})`);
          return axios.get(`${Base_URL}/expenses`, {
            params: {
              contractNumber: pc.contractNo,
              contractId: pc._id,
              contractType: "purchase",
            },
            headers,
          });
        });
        
        const [
          salesVendorInvoiceResponse,
          salesExpensesResponse,
          ...allPurchaseResponses
        ] = await Promise.allSettled([
          salesVendorInvoicePromise,
          salesExpensesPromise,
          ...purchaseVendorInvoicePromises,
          ...purchaseExpensesPromises,
        ]);
        
        // Separate purchase responses
        const purchaseVendorInvoiceResponses = allPurchaseResponses.slice(0, purchaseVendorInvoicePromises.length);
        const purchaseExpensesResponses = allPurchaseResponses.slice(
          purchaseVendorInvoicePromises.length,
          purchaseVendorInvoicePromises.length + purchaseExpensesPromises.length
        );

        const breakdown = {
          shipments: [],
          vendorInvoices: [],
          generalExpenses: [],
          shipmentTotal: 0,
          vendorInvoiceTotal: 0,
          generalExpenseTotal: 0,
          total: 0,
        };

        // Process Sales Contract Vendor Invoices (filter commission)
        if (salesVendorInvoiceResponse.status === "fulfilled" && salesVendorInvoiceResponse.value?.data?.data) {
          const invoices = salesVendorInvoiceResponse.value.data.data;
          console.log("📄 Found sales contract vendor invoices:", invoices.length);
          
          invoices
            .filter((invoice) => {
              const invoiceType = (invoice.invoiceType || "").toLowerCase();
              const vendorType = (invoice.vendor?.basicInformation?.vendorType || "").toLowerCase();
              return invoiceType === "commission" || vendorType === "agent";
            })
            .forEach((invoice) => {
            const amount = invoice.total || 0;
            const vendorName = invoice.vendor?.basicInformation?.vendorDisplayName || "Vendor";
              const currencySymbol = normalizeCurrencySymbol(invoice.currency);
              const baseAmount = convertToBase(amount, currencySymbol);

            if (amount > 0) {
              breakdown.vendorInvoices.push({
                  label: `Commission Agent Invoice (Sales) - ${vendorName} (${invoice.invoiceNumber})`,
                amount: amount,
                  currency: currencySymbol,
                  baseAmount,
                });
                breakdown.vendorInvoiceTotal += baseAmount;
                console.log(
                  `   ✅ Added: Commission Agent Invoice (Sales) - ${vendorName} - ${amount} ${currencySymbol} (≈ ${baseAmount.toFixed(2)} ${baseCurrency})`
                );
              }
            });
        } else {
          console.log("⚠️ Sales vendor invoices response failed:", salesVendorInvoiceResponse.status);
        }
        
        // Process Purchase Contract Vendor Invoices
        purchaseContracts.forEach((purchaseContract, pcIdx) => {
          const invoicesResponse = purchaseVendorInvoiceResponses[pcIdx];

          if (invoicesResponse?.status === "fulfilled" && invoicesResponse.value?.data?.data) {
            const invoices = invoicesResponse.value.data.data || [];
            console.log(
              `📄 Purchase Contract ${pcIdx + 1} (${purchaseContract.contractNo}): Found ${invoices.length} vendor invoices`
            );

            invoices.forEach((invoice) => {
              const amount = invoice.total || 0;
              const vendorName =
                invoice.vendor?.basicInformation?.vendorDisplayName || "Vendor";
              const invoiceType = (invoice.invoiceType || "").toLowerCase();
              const currencySymbol = normalizeCurrencySymbol(invoice.currency);
              const baseAmount = convertToBase(amount, currencySymbol);

              if (amount <= 0) return;

              if (invoiceType === "supplier") {
                breakdown.vendorInvoices.push({
                  label: `Supplier Invoice (Purchase) - ${vendorName} (${invoice.invoiceNumber})`,
                  amount: amount,
                  currency: currencySymbol,
                  baseAmount,
                });
                breakdown.vendorInvoiceTotal += baseAmount;
                console.log(
                  `   ✅ Added: Supplier Invoice (Purchase) - ${vendorName} - ${amount} ${currencySymbol} (≈ ${baseAmount.toFixed(2)} ${baseCurrency})`
                );
              } else if (
                invoiceType === "logistic" ||
                invoiceType === "logistics" ||
                invoiceType === "logistic service provider"
              ) {
                breakdown.vendorInvoices.push({
                  label: `Logistics Invoice (Purchase) - ${vendorName} (${invoice.invoiceNumber})`,
                  amount: amount,
                  currency: currencySymbol,
                  baseAmount,
                });
                breakdown.vendorInvoiceTotal += baseAmount;
                console.log(
                  `   ✅ Added: Logistics Invoice (Purchase) - ${vendorName} - ${amount} ${currencySymbol} (≈ ${baseAmount.toFixed(2)} ${baseCurrency})`
                );
              } else if (
                invoiceType === "commission" ||
                invoice.vendor?.basicInformation?.vendorType === "Agent"
              ) {
                breakdown.vendorInvoices.push({
                  label: `Commission Agent Invoice (Purchase) - ${vendorName} (${invoice.invoiceNumber})`,
                  amount: amount,
                  currency: currencySymbol,
                  baseAmount,
                });
                breakdown.vendorInvoiceTotal += baseAmount;
                console.log(
                  `   ✅ Added: Commission Agent Invoice (Purchase) - ${vendorName} - ${amount} ${currencySymbol} (≈ ${baseAmount.toFixed(2)} ${baseCurrency})`
                );
              }
            });
          } else {
            console.log(
              `⚠️ Purchase Contract ${pcIdx + 1}: Failed to fetch vendor invoices`,
              invoicesResponse?.reason
            );
          }
        });
        console.log(
          "💰 Total vendor invoices:",
          `${breakdown.vendorInvoiceTotal.toFixed(2)} ${baseCurrency}`
        );
        console.log("📊 VENDOR INVOICES BREAKDOWN:");
        console.log("   Total items in array:", breakdown.vendorInvoices.length);
        breakdown.vendorInvoices.forEach((inv, idx) => {
          console.log(`   ${idx + 1}. ${inv.label} - $${inv.amount}`);
        });

        // Process Sales Contract General Expenses
        if (salesExpensesResponse.status === "fulfilled" && salesExpensesResponse.value?.data?.data) {
          const expenses = salesExpensesResponse.value.data.data;
          console.log("📋 Found sales contract expenses:", expenses.length);
          
          expenses.forEach((expense) => {
            const amount = expense.total || 0;
            const expenseType = 
              expense.expenseType === "staff_claims" ? "Staff Claims" :
              expense.expenseType === "bills" ? "Bills" :
              expense.expenseType === "rents" ? "Rents" : "Other";
            const vendorName = expense.vendor?.basicInformation?.vendorDisplayName || 
                              expense.employee?.displayName || 
                              expense.employee?.fullName || 
                              "N/A";
            const currencySymbol = normalizeCurrencySymbol(expense.currency);
            const baseAmount = convertToBase(amount, currencySymbol);
            if (amount > 0) {
              breakdown.generalExpenses.push({
                label: `${expenseType} (Sales) - ${vendorName} (${expense.expenseNumber})`,
                amount: amount,
                currency: currencySymbol,
                baseAmount,
              });
              breakdown.generalExpenseTotal += baseAmount;
            }
          });
        }
        
        // Process Purchase Contract General Expenses
        purchaseExpensesResponses.forEach((response, idx) => {
          const purchaseContract = purchaseContracts[idx];
          if (response.status === "fulfilled" && response.value?.data?.data) {
            const expenses = response.value.data.data;
            console.log(`📋 Purchase Contract ${idx + 1} (${purchaseContract.contractNo}): Found ${expenses.length} expenses`);
            
            expenses.forEach((expense) => {
              const amount = expense.total || 0;
              const expenseType = 
                expense.expenseType === "staff_claims" ? "Staff Claims" :
                expense.expenseType === "bills" ? "Bills" :
                expense.expenseType === "rents" ? "Rents" : "Other";
              const vendorName = expense.vendor?.basicInformation?.vendorDisplayName || 
                                expense.employee?.displayName || 
                                expense.employee?.fullName || 
                                "N/A";
              const currencySymbol = normalizeCurrencySymbol(expense.currency);
              const baseAmount = convertToBase(amount, currencySymbol);
              if (amount > 0) {
                breakdown.generalExpenses.push({
                  label: `${expenseType} (Purchase) - ${vendorName} (${expense.expenseNumber})`,
                  amount: amount,
                  currency: currencySymbol,
                  baseAmount,
                });
                breakdown.generalExpenseTotal += baseAmount;
              }
            });
          } else {
            console.log(`⚠️ Purchase Contract ${idx + 1}: Failed to fetch expenses`);
          }
        });
        console.log(
          "💰 Total general expenses:",
          `${breakdown.generalExpenseTotal.toFixed(2)} ${baseCurrency}`
        );

        breakdown.total =
          breakdown.shipmentTotal +
          breakdown.vendorInvoiceTotal +
          breakdown.generalExpenseTotal;
        console.log(
          "💰💰 TOTAL OTHER EXPENSES:",
          `${breakdown.total.toFixed(2)} ${baseCurrency}`
        );
        
        console.log("🔍 FINAL BREAKDOWN BEFORE SET STATE:");
        console.log("   Shipments:", breakdown.shipments.length, "items");
        console.log("   Vendor Invoices:", breakdown.vendorInvoices.length, "items");
        console.log("   General Expenses:", breakdown.generalExpenses.length, "items");
        console.log("   Breakdown object:", JSON.stringify({
          shipmentCount: breakdown.shipments.length,
          vendorInvoiceCount: breakdown.vendorInvoices.length,
          generalExpenseCount: breakdown.generalExpenses.length,
          totals: {
            shipment: breakdown.shipmentTotal,
            vendorInvoice: breakdown.vendorInvoiceTotal,
            generalExpense: breakdown.generalExpenseTotal,
            total: breakdown.total
          }
        }, null, 2));
        
        setExpenseBreakdown(breakdown);
      } catch (err) {
        console.error("❌ Error fetching expenses", err);
      } finally {
        setLoadingExpenses(false);
      }
    };

    if (Data?._id && adminInfo?.token && currencyReady) {
      fetchAllExpenses();
    }
  }, [Data?._id, Data?.contractNo, adminInfo?.token, currencyReady]);

  // Calculate Contract Value (in sale currency and base currency)
  const product = Data?.productInfo?.[0] || {};
  const saleCurrencySymbol = normalizeCurrencySymbol(
    product?.selectedCurrency
  );
  const baseCurrencyDisplay = baseCurrency.toUpperCase();
  const contractValueLocal =
    Number(product?.amountInSelectedCurrency) ||
    ((Number(product?.price) || 0) *
      (Number(product?.quantityMTS) || 0) *
      (Number(product?.quantityFCL) || 0));
  const contractValueBase = convertToBase(
    contractValueLocal,
    saleCurrencySymbol
  );
  const saleCurrencyDisplay = saleCurrencySymbol || baseCurrencyDisplay;
  const showContractBaseHint =
    saleCurrencyDisplay !== baseCurrencyDisplay && contractValueBase > 0;
  
  // Calculate Total Purchases from linked purchase contracts
  const purchaseTotalsByCurrency = purchaseContracts.reduce(
    (acc, contract) => {
      const purchaseProduct = contract?.productInfo?.[0] || {};
      const currency = normalizeCurrencySymbol(
        purchaseProduct?.selectedCurrency
      );
      const localAmount =
        Number(purchaseProduct?.amountInSelectedCurrency) ||
        (Number(purchaseProduct?.price) || 0) *
          (Number(purchaseProduct?.quantityMTS) || 0) *
          (Number(purchaseProduct?.quantityFCL) || 0);
      if (!localAmount || !currency) return acc;
      acc.localByCurrency[currency] =
        (acc.localByCurrency[currency] || 0) + localAmount;
      acc.baseTotal += convertToBase(localAmount, currency);
      return acc;
    },
    { localByCurrency: {}, baseTotal: 0 }
  );

  const totalPurchasesBase = purchaseTotalsByCurrency.baseTotal;

  const otherExpensesBase = expenseBreakdown.total;

  // Aggregate other expenses by currency for display (while keeping total in base currency)
  const otherExpenseTotalsByCurrency = [
    ...expenseBreakdown.shipments,
    ...expenseBreakdown.vendorInvoices,
    ...expenseBreakdown.generalExpenses,
  ].reduce((acc, expense) => {
    const currency = normalizeCurrencySymbol(expense.currency);
    const amount = Number(expense.amount) || 0;
    if (!amount || !currency) return acc;
    acc[currency] = (acc[currency] || 0) + amount;
    return acc;
  }, {});

  const profitability = contractValueBase - totalPurchasesBase - otherExpensesBase;

  return (
    <>
      <div className="space-y-3">
        {/* Contract Value: show sale currency + base currency */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-600 font-medium">Contract Value:</span>
          <div className="text-right">
            <div className="text-base font-bold text-green-600">
              {formatAmount(contractValueLocal)} {saleCurrencyDisplay}
            </div>
            {showContractBaseHint && (
              <div className="text-xs text-slate-500">
                ≈ {formatAmount(contractValueBase)} {baseCurrencyDisplay}
              </div>
            )}
          </div>
        </div>
        
        {/* Purchases: show per-currency totals + base currency total */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-600 font-medium">Purchases:</span>
          {loadingPurchases ? (
            <span className="text-sm text-slate-400">Loading...</span>
          ) : (
            <div className="text-right">
              <div className="text-base font-bold text-red-600">
                {Object.keys(purchaseTotalsByCurrency.localByCurrency).length > 0
                  ? `- ${Object.entries(purchaseTotalsByCurrency.localByCurrency)
                      .map(
                        ([curr, amt]) => `${formatAmount(amt)} ${curr}`
                      )
                      .join(" + ") || "0"}`
                  : `- ${formatAmount(totalPurchasesBase)} ${baseCurrencyDisplay}`}
              </div>
              {totalPurchasesBase > 0 && (
                <div className="text-xs text-slate-500">
                  ≈ - {formatAmount(totalPurchasesBase)} {baseCurrencyDisplay}
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Other Expenses: show per-currency totals + base currency total */}
        <div 
          className="flex justify-between items-center group cursor-pointer hover:bg-slate-50 rounded-lg p-2 -mx-2 transition-all duration-200"
          onClick={() => setShowExpenseModal(true)}
          title="Click to view expense breakdown"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600 font-medium">Other Expenses:</span>
            <FiInfo 
              size={14} 
              className="text-slate-400 group-hover:text-blue-500 transition-colors" 
            />
          </div>
          {loadingExpenses ? (
            <span className="text-sm text-slate-400">Loading...</span>
          ) : (
            <div className="text-right">
              <div className="text-base font-bold text-orange-600 group-hover:text-orange-700 transition-colors">
                {Object.keys(otherExpenseTotalsByCurrency).length > 0
                  ? `- ${Object.entries(otherExpenseTotalsByCurrency)
                      .map(
                        ([curr, amt]) => `${formatAmount(amt)} ${curr}`
                      )
                      .join(" + ") || "0"}`
                  : `- ${formatAmount(otherExpensesBase)} ${baseCurrencyDisplay}`}
              </div>
              {otherExpensesBase > 0 && (
                <div className="text-xs text-slate-500">
                  ≈ - {formatAmount(otherExpensesBase)} {baseCurrencyDisplay}
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="pt-3 mt-3 border-t border-slate-200">
          <div className="flex justify-between items-center">
            <span className="text-base text-slate-800 font-bold">Profitability:</span>
            {loadingPurchases || loadingExpenses ? (
              <span className="text-sm text-slate-400">Calculating...</span>
            ) : (
              <span className={`text-xl font-bold ${profitability >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                {formatAmount(profitability)} {baseCurrencyDisplay}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Expense Breakdown Modal */}
      <ExpenseBreakdownModal
        isOpen={showExpenseModal}
        onClose={() => setShowExpenseModal(false)}
        expenseBreakdown={expenseBreakdown}
        loading={loadingExpenses}
        baseCurrency={baseCurrencyDisplay}
      />
    </>
  );
};

export default ProfitabilityCard;
