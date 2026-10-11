import React from "react";
import { DollarSign } from "lucide-react";
import SummaryCards from "@/page-layouts/components/SummaryCards";
import FormInput from "@/page-layouts/components/FormInput";
import OpenClaims from "./OpenClaims";

const ClaimsAnalytics = ({
  claimsStats,
  summary,
  chartType,
  yAxisKey,
  xAxisKey,
  selectedMetrics,
  pieMetric,
  maxDataPoints,
  currentPage,
  setChartType,
  setYAxisKey,
  setXAxisKey,
  setSelectedMetrics,
  setPieMetric,
  setMaxDataPoints,
  setCurrentPage,
  processedData,
  paginatedData,
  totalPages,
  availableMetrics,
  renderChart,
}) => {
  return (
    <div className="data-table-layout bg-p-gray-light p-4 rounded-[20px] pb-4">
      <div className="bg-p-gray-light rounded-xl p-0 mb-[16px]">
        <div className="p-4">
          <h2 className="text-xl font-semibold mb-6">Claims Analytics</h2>

          {/* Summary Section */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-800 border-b border-gray-200 pb-2">
              Summary
            </h3>
            <SummaryCards
              cards={[
                {
                  title: "Total Claims",
                  value: summary.total || 0,
                },
                {
                  title: "Approved",
                  value: summary.approved || 0,
                  isHighlighted: true,
                },
                {
                  title: "Pending",
                  value: summary.pending || 0,
                  isHighlighted: summary.pending > 0,
                },
                {
                  title: "Rejected",
                  value: summary.rejected || 0,
                  isHighlighted: summary.rejected > 0,
                },
                {
                  title: "Total Amount (USD)",
                  value: `$${summary.totalAmount || 0}`,
                },
                {
                  title: "Avg Amount per Claim (USD)",
                  value: `$${
                    claimsStats?.claimAmountStats?.avgAmountUSD?.toFixed(2) ||
                    claimsStats?.claimAmountStats?.avgAmount?.toFixed(2) ||
                    0
                  }`,
                },
              ]}
              columnsCount={6}
              size="md"
            />
          </div>

          {/* Additional Analytics for Claims */}
          {claimsStats?.claimAmountStats && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-800 border-b border-gray-200 pb-2">
                Claim Amount Analysis
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">
                        Average Amount (USD)
                      </p>
                      <p className="text-2xl font-bold text-gray-900">
                        $
                        {claimsStats.claimAmountStats.avgAmountUSD?.toFixed(
                          2
                        ) ||
                          claimsStats.claimAmountStats.avgAmount?.toFixed(2) ||
                          0}
                      </p>
                    </div>
                    <DollarSign className="w-8 h-8 text-blue-500" />
                  </div>
                </div>
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">
                        Small Claims (&le;$100 USD)
                      </p>
                      <p className="text-2xl font-bold text-gray-900">
                        {claimsStats.claimAmountStats.smallClaims || 0}
                      </p>
                    </div>
                    <DollarSign className="w-8 h-8 text-green-500" />
                  </div>
                </div>
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">
                        Medium Claims ($101-$500 USD)
                      </p>
                      <p className="text-2xl font-bold text-gray-900">
                        {claimsStats.claimAmountStats.mediumClaims || 0}
                      </p>
                    </div>
                    <DollarSign className="w-8 h-8 text-yellow-500" />
                  </div>
                </div>
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">
                        Large Claims (&gt;$500 USD)
                      </p>
                      <p className="text-2xl font-bold text-gray-900">
                        {claimsStats.claimAmountStats.largeClaims || 0}
                      </p>
                    </div>
                    <DollarSign className="w-8 h-8 text-red-500" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Chart and Configuration */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Left Column - Chart (2/3 width) */}
            <div className="xl:col-span-2 bg-white rounded-lg p-4 shadow-sm">
              <div className="bg-white h-full flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2 w-full">
                    Claims Analytics
                  </h3>
                </div>
                {/* Pagination Controls */}
                {processedData.length > maxDataPoints &&
                  maxDataPoints !== "all" && (
                    <div className="flex items-center justify-center gap-3 mb-4 flex-wrap">
                      <button
                        onClick={() =>
                          setCurrentPage(Math.max(1, currentPage - 1))
                        }
                        disabled={currentPage === 1}
                        className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 transition-colors"
                      >
                        Previous
                      </button>
                      <span className="text-xs text-gray-600 px-2">
                        Page {currentPage} of {totalPages} (
                        {processedData.length} total items)
                      </span>
                      <button
                        onClick={() =>
                          setCurrentPage(Math.min(totalPages, currentPage + 1))
                        }
                        disabled={currentPage === totalPages}
                        className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 transition-colors"
                      >
                        Next
                      </button>
                    </div>
                  )}
                {/* Chart Display */}
                <div className="w-full h-full">
                  <div className="min-h-[400px] flex items-center justify-center">
                    {processedData.length > 0 ? (
                      renderChart()
                    ) : (
                      <div className="flex justify-center items-center h-96 bg-gray-50 rounded-lg">
                        <p className="text-gray-500">
                          No data available to display
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Chart Configuration (1/3 width) */}
            <div className="xl:col-span-1">
              <div className="bg-white rounded-lg p-4 shadow-sm h-full">
                <h3 className="text-lg font-semibold mb-4 text-gray-800 border-b border-gray-200 pb-2">
                  Chart Configuration
                </h3>
                <div className="space-y-3">
                  {/* Chart Type Selector */}
                  <div>
                    <FormInput
                      type="select"
                      label="Chart Type"
                      direction="column"
                      options={[
                        { label: "Bar Chart", value: "bar" },
                        { label: "Line Chart", value: "line" },
                        { label: "Pie Chart", value: "pie" },
                      ]}
                      placeholder="Select"
                      isClearable={false}
                      value={chartType}
                      onChange={(value) => {
                        setChartType(value);
                        setCurrentPage(1);
                      }}
                      width="100%"
                    />
                  </div>
                  {/* Max Data Points Selector */}
                  <div>
                    <FormInput
                      type="select"
                      label="Items per page"
                      direction="column"
                      options={[
                        { label: "2", value: 2 },
                        { label: "25", value: 25 },
                        { label: "50", value: 50 },
                        { label: "100", value: 100 },
                        { label: "All", value: "all" },
                      ]}
                      placeholder="Select"
                      value={maxDataPoints}
                      onChange={(value) => {
                        setMaxDataPoints(value);
                        setCurrentPage(1);
                      }}
                      isClearable={false}
                      width="100%"
                    />
                  </div>
                  {/* Conditional inputs based on chart type */}
                  {chartType === "bar" && (
                    <>
                      <div>
                        <FormInput
                          type="select"
                          label="X-Axis"
                          direction="column"
                          options={[
                            { label: "Status", value: "status" },
                            { label: "Count", value: "count" },
                            {
                              label: "Ocean Freight/FCL (USD)",
                              value: "amount",
                            },
                          ]}
                          placeholder="Select"
                          value={xAxisKey}
                          onChange={setXAxisKey}
                          isClearable
                          width="100%"
                        />
                      </div>
                      <div>
                        <FormInput
                          type="select"
                          label="Y-Axis"
                          direction="column"
                          options={[
                            { label: "Department", value: "department" },
                            { label: "Employee", value: "employee" },
                            { label: "Type", value: "type" },
                            { label: "Trend", value: "trend" },
                            { label: "Monthly Distribution", value: "monthly" },
                          ]}
                          placeholder="Select"
                          value={yAxisKey}
                          onChange={setYAxisKey}
                          isClearable
                          width="100%"
                        />
                      </div>
                    </>
                  )}
                  {chartType === "line" && (
                    <>
                      <div>
                        <FormInput
                          type="select"
                          label="Group By"
                          direction="column"
                          options={[
                            { label: "Department", value: "department" },
                            { label: "Employee", value: "employee" },
                            { label: "Type", value: "type" },
                            { label: "Trend", value: "trend" },
                            { label: "Monthly Distribution", value: "monthly" },
                          ]}
                          placeholder="Select"
                          value={yAxisKey}
                          onChange={setYAxisKey}
                          isClearable
                          width="100%"
                        />
                      </div>
                      <div>
                        <FormInput
                          type="select"
                          label="Metrics"
                          direction="column"
                          options={availableMetrics}
                          placeholder="Select metrics"
                          value={selectedMetrics}
                          onChange={setSelectedMetrics}
                          isMulti
                          width="100%"
                        />
                      </div>
                    </>
                  )}
                  {chartType === "pie" && (
                    <>
                      <div>
                        <FormInput
                          type="select"
                          label="Group By"
                          direction="column"
                          options={[
                            { label: "Department", value: "department" },
                            { label: "Employee", value: "employee" },
                            { label: "Type", value: "type" },
                            { label: "Monthly Distribution", value: "monthly" },
                          ]}
                          placeholder="Select"
                          value={yAxisKey}
                          onChange={setYAxisKey}
                          isClearable
                          width="100%"
                        />
                      </div>
                      <div>
                        <FormInput
                          type="select"
                          label="Metric"
                          direction="column"
                          options={availableMetrics}
                          placeholder="Select metric"
                          value={pieMetric}
                          onChange={(value) => {
                            setPieMetric(value);
                          }}
                          width="100%"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <OpenClaims />
    </div>
  );
};

export default ClaimsAnalytics;
