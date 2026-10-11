import React from "react";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Building,
  FileText,
  Receipt,
  Package,
  Users,
  Target,
  ArrowUp,
  Activity,
  Truck,
} from "lucide-react";
import { formatAmount } from "@/components/formatAmount";

const ProfitabilityAnalysis = ({
  profitabilityData,
  selectedSalesContract,
  customerInvoices,
  vendorInvoices,
  expenses,
  purchaseContracts,
  availableCurrencies,
  selectedCurrency,
  baseCurrency,
  onCurrencyChange,
  onBack,
}) => {
  if (!profitabilityData) return null;

  const {
    totalRevenue,
    totalCosts,
    grossProfit,
    profitMargin,
    roi,
    revenueBreakdown,
    detailedCostBreakdown,
    summary,
  } = profitabilityData;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Profitability Analysis
            </h1>
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <span className="flex items-center">
                <FileText className="w-4 h-4 mr-1" />
                Contract: {selectedSalesContract.contractNo}
              </span>
              <span className="flex items-center">
                <Building className="w-4 h-4 mr-1" />
                {selectedSalesContract.basicInfo?.buyerCompanyName}
              </span>
              <span className="flex items-center">
                <Users className="w-4 h-4 mr-1" />
                {selectedSalesContract.basicInfo?.salesPerson}
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {/* Currency Selection Dropdown */}
            {availableCurrencies && availableCurrencies.length > 0 ? (
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">
                  Display Currency:
                </label>
                <select
                  value={selectedCurrency}
                  onChange={(e) => onCurrencyChange(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-transparent"
                >
                  {availableCurrencies.map((currency) => (
                    <option key={currency.symbol} value={currency.symbol}>
                      {currency.symbol} {currency.isBase ? "(Base)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="text-xs text-gray-500">
                No currencies available
              </div>
            )}
            <button
              onClick={onBack}
              className="flex items-center px-4 py-2 text-gray-600 hover:text-[var(--p-blue)] transition-colors"
            >
              <ArrowUp className="w-4 h-4 mr-2" />
              Change Contract
            </button>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-green-600">
                {(selectedCurrency || baseCurrency || "USD").toUpperCase()}{" "}
                {formatAmount(totalRevenue)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Costs</p>
              <p className="text-2xl font-bold text-red-600">
                {(selectedCurrency || baseCurrency || "USD").toUpperCase()}{" "}
                {formatAmount(totalCosts)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div
              className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                grossProfit >= 0 ? "bg-[var(--p-blue)]/10" : "bg-orange-100"
              }`}
            >
              <DollarSign
                className={`w-6 h-6 ${
                  grossProfit >= 0 ? "text-[var(--p-blue)]" : "text-orange-600"
                }`}
              />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Gross Profit</p>
              <p
                className={`text-2xl font-bold ${
                  grossProfit >= 0 ? "text-[var(--p-blue)]" : "text-orange-600"
                }`}
              >
                {(selectedCurrency || baseCurrency || "USD").toUpperCase()}{" "}
                {formatAmount(grossProfit)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Metrics */}
      {/* <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Profit Margin
          </h3>
          <div className="flex items-center">
            <Target className="w-8 h-8 text-blue-600 mr-3" />
            <div>
              <p className="text-3xl font-bold text-blue-600">
                {profitMargin.toFixed(2)}%
              </p>
              <p className="text-sm text-gray-600">Margin</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            ROI (Return on Investment)
          </h3>
          <div className="flex items-center">
            <Activity className="w-8 h-8 text-purple-600 mr-3" />
            <div>
              <p className="text-3xl font-bold text-purple-600">
                {roi.toFixed(2)}%
              </p>
              <p className="text-sm text-gray-600">Return</p>
            </div>
            </div>
            </div>
      </div> */}

      {/* Revenue and Cost Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Breakdown */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <TrendingUp className="w-5 h-5 text-green-600 mr-2" />
            Revenue Breakdown
          </h3>
          <div className="space-y-3">
            {Object.entries(revenueBreakdown).map(([currency, data]) => (
              <div
                key={currency}
                className="flex justify-between items-center p-3 bg-green-50 rounded-lg"
              >
                <div>
                  <p className="font-medium text-gray-900">{currency}</p>
                  <p className="text-sm text-gray-600">{data.count} invoices</p>
                </div>
                <p className="font-semibold text-green-600">
                  {formatAmount(data.amount)} {currency}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Cost Breakdown */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <TrendingDown className="w-5 h-5 text-red-600 mr-2" />
            Cost Breakdown Summary
          </h3>
          <div className="space-y-4">
            {/* Sales Contract Costs */}
            <div className="border-l-4 border-blue-500 pl-4">
              <h4 className="font-semibold text-blue-700 mb-2">
                Sales Contract Costs
              </h4>
              <div className="space-y-2 ml-4">
                <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
                  <span className="text-sm text-gray-700">
                    Commission Agent Invoices
                  </span>
                  <span className="font-semibold text-blue-600">
                    {selectedCurrency}{" "}
                    {formatAmount(
                      detailedCostBreakdown.salesContractCosts
                        .commissionAgentInvoices.amount
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
                  <span className="text-sm text-gray-700">Direct Expenses</span>
                  <span className="font-semibold text-blue-600">
                    {selectedCurrency}{" "}
                    {formatAmount(
                      detailedCostBreakdown.salesContractCosts.directExpenses
                        .amount
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center p-2 bg-blue-100 rounded border-t">
                  <span className="font-medium text-blue-800">
                    Sales Contract Subtotal
                  </span>
                  <span className="font-bold text-blue-800">
                    {selectedCurrency}{" "}
                    {formatAmount(
                      detailedCostBreakdown.salesContractCosts.subtotal
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Purchase Contract Costs */}
            <div className="border-l-4 border-orange-500 pl-4">
              <h4 className="font-semibold text-orange-700 mb-2">
                Associated Purchase Contract Costs
                {purchaseContracts && purchaseContracts.length > 0 && (
                  <div className="text-xs text-orange-600 mt-1">
                    Linked Contracts:{" "}
                    {purchaseContracts.map((pc) => pc.contractNo).join(", ")}
                  </div>
                )}
              </h4>
              <div className="space-y-2 ml-4">
                <div className="flex justify-between items-center p-2 bg-orange-50 rounded">
                  <span className="text-sm text-gray-700">
                    Supplier Invoices
                  </span>
                  <span className="font-semibold text-orange-600">
                    {selectedCurrency}{" "}
                    {formatAmount(
                      detailedCostBreakdown.purchaseContractCosts
                        .supplierInvoices.amount
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center p-2 bg-orange-50 rounded">
                  <span className="text-sm text-gray-700">
                    Logistics Invoices
                  </span>
                  <span className="font-semibold text-orange-600">
                    {selectedCurrency}{" "}
                    {formatAmount(
                      detailedCostBreakdown.purchaseContractCosts
                        .logisticsInvoices.amount
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center p-2 bg-orange-50 rounded">
                  <span className="text-sm text-gray-700">
                    Commission Agent Invoices
                  </span>
                  <span className="font-semibold text-orange-600">
                    {selectedCurrency}{" "}
                    {formatAmount(
                      detailedCostBreakdown.purchaseContractCosts
                        .commissionAgentInvoices.amount
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center p-2 bg-orange-50 rounded">
                  <span className="text-sm text-gray-700">Other Expenses</span>
                  <span className="font-semibold text-orange-600">
                    {selectedCurrency}{" "}
                    {formatAmount(
                      detailedCostBreakdown.purchaseContractCosts.otherExpenses
                        .amount
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center p-2 bg-orange-100 rounded border-t">
                  <span className="font-medium text-orange-800">
                    Purchase Contract Subtotal
                  </span>
                  <span className="font-bold text-orange-800">
                    {selectedCurrency}{" "}
                    {formatAmount(
                      detailedCostBreakdown.purchaseContractCosts.subtotal
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Total Costs */}
            <div className="border-l-4 border-red-500 pl-4">
              <div className="flex justify-between items-center p-3 bg-red-100 rounded border-t-2">
                <span className="font-bold text-red-800 text-lg">
                  Total Costs
                </span>
                <span className="font-bold text-red-800 text-lg">
                  ${formatAmount(detailedCostBreakdown.total)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contract Details */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <FileText className="w-5 h-5 text-[var(--p-blue)] mr-2" />
          Contract Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <h4 className="font-medium text-gray-900 mb-2">
              Basic Information
            </h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Contract No:</span>
                <span className="font-medium">
                  {selectedSalesContract.contractNo}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Status:</span>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full ${
                    selectedSalesContract.status === "Processing"
                      ? "bg-blue-100 text-blue-800"
                      : selectedSalesContract.status === "Completed"
                      ? "bg-green-100 text-green-800"
                      : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  {selectedSalesContract.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Creation Date:</span>
                <span className="font-medium">
                  {new Date(
                    selectedSalesContract.basicInfo?.contractCreationDate
                  ).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-medium text-gray-900 mb-2">Customer Details</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Company:</span>
                <span className="font-medium">
                  {selectedSalesContract.basicInfo?.buyerCompanyName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Final Customer:</span>
                <span className="font-medium">
                  {selectedSalesContract.basicInfo?.finalCustomerName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Reference:</span>
                <span className="font-medium">
                  {selectedSalesContract.basicInfo?.ref || "N/A"}
                </span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-medium text-gray-900 mb-2">Logistics</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">ETD Port:</span>
                <span className="font-medium">
                  {selectedSalesContract.basicInfo?.ETD_Port}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Loading Port:</span>
                <span className="font-medium">
                  {selectedSalesContract.basicInfo?.port_of_loading}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Discharge Port:</span>
                <span className="font-medium">
                  {selectedSalesContract.basicInfo?.port_of_discharge}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Product Information */}
      {selectedSalesContract.productInfo &&
        selectedSalesContract.productInfo.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Package className="w-5 h-5 text-purple-600 mr-2" />
              Products ({selectedSalesContract.productInfo.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Grade
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quantity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Price
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Value
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Commission
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {selectedSalesContract.productInfo.map((product, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {product.title}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {product.grade}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {product.quantityMTS} MTS / {product.quantityFCL} FCL
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatAmount(product.price)}{" "}
                          {product.selectedCurrency}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-green-600">
                          {formatAmount(product.totalValue)}{" "}
                          {product.selectedCurrency}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-yellow-600">
                          {formatAmount(product.totalAgentCommission || 0)}{" "}
                          {product.selectedCurrency}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      {/* Comprehensive Cost Analysis */}
      {/* <ComprehensiveCostAnalysis
        detailedCostBreakdown={detailedCostBreakdown}
        totalRevenue={totalRevenue}
        grossProfit={grossProfit}
        purchaseContracts={purchaseContracts}
      /> */}

      {/* Customer Invoices Table */}
      {customerInvoices.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Receipt className="w-5 h-5 text-[var(--p-blue)] mr-2" />
            Customer Invoices ({customerInvoices.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Invoice
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Remaining
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {customerInvoices.map((invoice) => (
                  <tr key={invoice._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {invoice.invoice_number}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {invoice.customer_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-green-600">
                        {formatAmount(invoice.grandTotal)} {invoice.currency}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {formatAmount(invoice.remaining || 0)}{" "}
                        {invoice.currency}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          invoice.status === "Paid"
                            ? "bg-green-100 text-green-800"
                            : invoice.status === "Partially Paid"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(invoice.invoice_date).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Purchase Contracts Table */}
      {purchaseContracts.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Building className="w-5 h-5 text-orange-600 mr-2" />
            Purchase Contracts ({purchaseContracts.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contract #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Vendor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Value
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {purchaseContracts.map((contract) => (
                  <tr key={contract._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {contract.contractNo}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {contract.basicInfo?.agentName || "N/A"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-orange-600">
                        {contract.productInfo && contract.productInfo.length > 0
                          ? `${formatAmount(
                              contract.productInfo.reduce(
                                (sum, product) =>
                                  sum +
                                  (product.amountInSelectedCurrency ||
                                    product.totalValue ||
                                    0),
                                0
                              )
                            )} ${
                              contract.productInfo[0]?.selectedCurrency
                                ?.currency || "USD"
                            }`
                          : "N/A"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(contract.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Unified Cost Table */}
      <UnifiedCostTable
        vendorInvoices={vendorInvoices}
        expenses={expenses}
        detailedCostBreakdown={detailedCostBreakdown}
      />
    </div>
  );
};

// Comprehensive Cost Analysis Component
const ComprehensiveCostAnalysis = ({
  detailedCostBreakdown,
  totalRevenue,
  grossProfit,
  purchaseContracts,
}) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
        <TrendingDown className="w-6 h-6 text-red-600 mr-3" />
        Comprehensive Cost Analysis
      </h3>

      {/* Visual Calculation Flow */}
      <div className="space-y-6">
        {/* Revenue Section */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="text-lg font-semibold text-green-800 mb-3">
            💰 Revenue
          </h4>
          <div className="flex justify-between items-center">
            <span className="text-green-700">Total Sales Revenue</span>
            <span className="text-2xl font-bold text-green-800">
              ${formatAmount(totalRevenue)}
            </span>
          </div>
        </div>

        {/* Sales Contract Costs */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-lg font-semibold text-blue-800 mb-3">
            📋 Sales Contract Costs
          </h4>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-blue-700">
                Commission Agent Invoices (
                {
                  detailedCostBreakdown.salesContractCosts
                    .commissionAgentInvoices.count
                }{" "}
                items)
              </span>
              <span className="font-semibold text-blue-600">
                $
                {formatAmount(
                  detailedCostBreakdown.salesContractCosts
                    .commissionAgentInvoices.amount
                )}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-blue-700">
                Other Expenses (
                {detailedCostBreakdown.salesContractCosts.directExpenses.count}{" "}
                items)
              </span>
              <span className="font-semibold text-blue-600">
                $
                {formatAmount(
                  detailedCostBreakdown.salesContractCosts.directExpenses.amount
                )}
              </span>
            </div>
            <div className="border-t border-blue-300 pt-2 mt-2">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-blue-800">
                  Sales Contract Subtotal
                </span>
                <span className="text-xl font-bold text-blue-800">
                  $
                  {formatAmount(
                    detailedCostBreakdown.salesContractCosts.subtotal
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Purchase Contract Costs */}
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <h4 className="text-lg font-semibold text-orange-800 mb-3">
            🏭 Purchase Contract Costs
            {purchaseContracts && purchaseContracts.length > 0 && (
              <div className="text-sm text-orange-700 mt-1 font-normal">
                Linked Contracts:{" "}
                {purchaseContracts.map((pc) => pc.contractNo).join(", ")}
              </div>
            )}
          </h4>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-orange-700">
                Supplier Invoices (
                {
                  detailedCostBreakdown.purchaseContractCosts.supplierInvoices
                    .count
                }{" "}
                items)
              </span>
              <span className="font-semibold text-orange-600">
                $
                {formatAmount(
                  detailedCostBreakdown.purchaseContractCosts.supplierInvoices
                    .amount
                )}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-orange-700">
                Logistics Invoices (
                {
                  detailedCostBreakdown.purchaseContractCosts.logisticsInvoices
                    .count
                }{" "}
                items)
              </span>
              <span className="font-semibold text-orange-600">
                $
                {formatAmount(
                  detailedCostBreakdown.purchaseContractCosts.logisticsInvoices
                    .amount
                )}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-orange-700">
                Commission Agent Invoices (
                {
                  detailedCostBreakdown.purchaseContractCosts
                    .commissionAgentInvoices.count
                }{" "}
                items)
              </span>
              <span className="font-semibold text-orange-600">
                $
                {formatAmount(
                  detailedCostBreakdown.purchaseContractCosts
                    .commissionAgentInvoices.amount
                )}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-orange-700">
                Other Expenses (
                {
                  detailedCostBreakdown.purchaseContractCosts.otherExpenses
                    .count
                }{" "}
                items)
              </span>
              <span className="font-semibold text-orange-600">
                $
                {formatAmount(
                  detailedCostBreakdown.purchaseContractCosts.otherExpenses
                    .amount
                )}
              </span>
            </div>
            <div className="border-t border-orange-300 pt-2 mt-2">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-orange-800">
                  Purchase Contract Subtotal
                </span>
                <span className="text-xl font-bold text-orange-800">
                  $
                  {formatAmount(
                    detailedCostBreakdown.purchaseContractCosts.subtotal
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Total Costs */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="text-lg font-semibold text-red-800 mb-3">
            💸 Total Costs
          </h4>
          <div className="flex justify-between items-center">
            <span className="text-red-700">All Costs Combined</span>
            <span className="text-2xl font-bold text-red-800">
              ${formatAmount(detailedCostBreakdown.total)}
            </span>
          </div>
        </div>

        {/* Profit Calculation */}
        <div
          className={`border-2 rounded-lg p-4 ${
            grossProfit >= 0
              ? "bg-green-50 border-green-300"
              : "bg-red-50 border-red-300"
          }`}
        >
          <h4
            className={`text-lg font-semibold mb-3 ${
              grossProfit >= 0 ? "text-green-800" : "text-red-800"
            }`}
          >
            {grossProfit >= 0 ? "🎉 Profit Calculation" : "⚠️ Loss Calculation"}
          </h4>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span
                className={grossProfit >= 0 ? "text-green-700" : "text-red-700"}
              >
                Total Revenue
              </span>
              <span
                className={`font-semibold ${
                  grossProfit >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                ${formatAmount(totalRevenue)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span
                className={grossProfit >= 0 ? "text-green-700" : "text-red-700"}
              >
                Total Costs
              </span>
              <span
                className={`font-semibold ${
                  grossProfit >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                -${formatAmount(detailedCostBreakdown.total)}
              </span>
            </div>
            <div className="border-t-2 pt-2 mt-2">
              <div className="flex justify-between items-center">
                <span
                  className={`text-lg font-bold ${
                    grossProfit >= 0 ? "text-green-800" : "text-red-800"
                  }`}
                >
                  {grossProfit >= 0 ? "Gross Profit" : "Gross Loss"}
                </span>
                <span
                  className={`text-3xl font-bold ${
                    grossProfit >= 0 ? "text-green-800" : "text-red-800"
                  }`}
                >
                  ${formatAmount(grossProfit)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Unified cost table component (only costs, no revenue or contracts)
const UnifiedCostTable = ({
  vendorInvoices,
  expenses,
  detailedCostBreakdown,
}) => {
  // Combine all cost data into a single array with type information
  const allCostData = [
    // Sales Contract Commission Agent Invoices
    ...detailedCostBreakdown.salesContractCosts.commissionAgentInvoices.items.map(
      (invoice) => ({
        ...invoice,
        recordType: "cost",
        type: "Sales Contract - Commission Agent Invoice",
        sortDate: new Date(invoice.invoiceDate),
        amount: invoice.total,
        currency: invoice.currency,
        status: invoice.status || "Unpaid",
        vendor: invoice.vendor?.basicInformation?.vendorDisplayName || "N/A",
        number: invoice.invoiceNumber,
      })
    ),

    // Purchase Contract Supplier Invoices
    ...detailedCostBreakdown.purchaseContractCosts.supplierInvoices.items.map(
      (invoice) => ({
        ...invoice,
        recordType: "cost",
        type: "Purchase Contract - Supplier Invoice",
        sortDate: new Date(invoice.invoiceDate),
        amount: invoice.total,
        currency: invoice.currency,
        status: invoice.status || "Unpaid",
        vendor: invoice.vendor?.basicInformation?.vendorDisplayName || "N/A",
        number: invoice.invoiceNumber,
      })
    ),

    // Purchase Contract Commission Agent Invoices
    ...detailedCostBreakdown.purchaseContractCosts.commissionAgentInvoices.items.map(
      (invoice) => ({
        ...invoice,
        recordType: "cost",
        type: "Purchase Contract - Commission Agent Invoice",
        sortDate: new Date(invoice.invoiceDate),
        amount: invoice.total,
        currency: invoice.currency,
        status: invoice.status || "Unpaid",
        vendor: invoice.vendor?.basicInformation?.vendorDisplayName || "N/A",
        number: invoice.invoiceNumber,
      })
    ),

    // Purchase Contract Logistics Invoices
    ...detailedCostBreakdown.purchaseContractCosts.logisticsInvoices.items.map(
      (invoice) => ({
        ...invoice,
        recordType: "cost",
        type: "Purchase Contract - Logistics Invoice",
        sortDate: new Date(invoice.invoiceDate),
        amount: invoice.total,
        currency: invoice.currency,
        status: invoice.status || "Unpaid",
        vendor: invoice.vendor?.basicInformation?.vendorDisplayName || "N/A",
        number: invoice.invoiceNumber,
      })
    ),

    // Sales Contract Other Expenses
    ...detailedCostBreakdown.salesContractCosts.directExpenses.items.map(
      (expense) => ({
        ...expense,
        recordType: "cost",
        type: "Sales Contract - Other Expense",
        sortDate: new Date(expense.createdAt),
        amount: expense.total,
        currency: expense.currency,
        status: expense.status || "Unpaid",
        vendor:
          expense.vendor?.basicInformation?.vendorDisplayName ||
          expense.employee?.displayName ||
          expense.employee?.fullName ||
          "N/A",
        number: expense.expenseNumber,
      })
    ),

    // Purchase Contract Other Expenses
    ...detailedCostBreakdown.purchaseContractCosts.otherExpenses.items.map(
      (expense) => ({
        ...expense,
        recordType: "cost",
        type: "Purchase Contract - Other Expense",
        sortDate: new Date(expense.createdAt),
        amount: expense.total,
        currency: expense.currency,
        status: expense.status || "Unpaid",
        vendor:
          expense.vendor?.basicInformation?.vendorDisplayName ||
          expense.employee?.displayName ||
          expense.employee?.fullName ||
          "N/A",
        number: expense.expenseNumber,
      })
    ),
  ];

  // Sort by date (latest first)
  allCostData.sort((a, b) => b.sortDate - a.sortDate);

  const getTypeColor = (type) => {
    switch (type) {
      case "Sales Contract - Commission Agent Invoice":
        return "bg-purple-100 text-purple-800";
      case "Purchase Contract - Supplier Invoice":
        return "bg-blue-100 text-blue-800";
      case "Purchase Contract - Commission Agent Invoice":
        return "bg-purple-100 text-purple-800";
      case "Purchase Contract - Logistics Invoice":
        return "bg-indigo-100 text-indigo-800";
      case "Sales Contract - Other Expense":
        return "bg-orange-100 text-orange-800";
      case "Purchase Contract - Other Expense":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Paid":
        return "bg-green-100 text-green-800";
      case "Partially Paid":
        return "bg-yellow-100 text-yellow-800";
      case "Completed":
        return "bg-green-100 text-green-800";
      case "Processing":
        return "bg-blue-100 text-blue-800";
      case "Draft":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-red-100 text-red-800";
    }
  };

  if (allCostData.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <DollarSign className="w-5 h-5 text-red-600 mr-2" />
          All Costs & Expenses
        </h3>
        <div className="text-center py-8 text-gray-500">
          No costs or expenses found for this contract.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
        <DollarSign className="w-5 h-5 text-red-600 mr-2" />
        All Costs & Expenses ({allCostData.length})
      </h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Number
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Vendor/Employee
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {allCostData.map((record, index) => (
              <tr
                key={`${record.recordType}-${record._id || index}`}
                className="hover:bg-gray-50"
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {record.number}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTypeColor(
                      record.type
                    )}`}
                  >
                    {record.type}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{record.vendor}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-red-600">
                    {formatAmount(record.amount)} {record.currency}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                      record.status
                    )}`}
                  >
                    {record.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {record.sortDate.toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProfitabilityAnalysis;
