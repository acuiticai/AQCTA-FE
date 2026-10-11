import React from "react"
import SummaryCards from "@/page-layouts/components/SummaryCards"
import FormInput from "@/page-layouts/components/FormInput"

const LeavesAnalytics = ({
  leavesStats,
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
          <h2 className="text-xl font-semibold mb-6">Leave Analytics</h2>

          {/* Summary Section */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-800 border-b border-gray-200 pb-2">Summary</h3>
            <SummaryCards
              cards={[
                {
                  title: "Total Leaves",
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
                  title: "Total Days",
                  value: summary.totalDays || 0,
                },
              ]}
              columnsCount={5}
              size="md"
            />
          </div>

          {/* Additional Analytics for Leaves */}
          {leavesStats?.leaveDurationStats && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-800 border-b border-gray-200 pb-2">
                Leave Duration Analysis
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Short Leaves (1-3 days)</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {leavesStats.leaveDurationStats.shortLeaves || 0}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Medium Leaves (4-7 days)</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {leavesStats.leaveDurationStats.mediumLeaves || 0}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Long Leaves (8-14 days)</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {leavesStats.leaveDurationStats.longLeaves || 0}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Extended Leaves (&gt;14 days)</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {leavesStats.leaveDurationStats.extendedLeaves || 0}
                      </p>
                    </div>
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
                    Leave Analytics
                  </h3>
                </div>
                {/* Pagination Controls */}
                {processedData.length > maxDataPoints && maxDataPoints !== "all" && (
                  <div className="flex items-center justify-center gap-3 mb-4 flex-wrap">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 transition-colors"
                    >
                      Previous
                    </button>
                    <span className="text-xs text-gray-600 px-2">
                      Page {currentPage} of {totalPages} ({processedData.length} total items)
                    </span>
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
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
                        <p className="text-gray-500">No data available to display</p>
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
                <div className="space-y-4">
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
                      placeholder="Select chart type"
                      value={chartType}
                      onChange={setChartType}
                      width="100%"
                    />
                  </div>
                  <div>
                    <FormInput
                      type="select"
                      label="Max Data Points per Page"
                      direction="column"
                      options={[
                        { label: "Show All", value: "all" },
                        { label: "5", value: 5 },
                        { label: "10", value: 10 },
                        { label: "15", value: 15 },
                        { label: "20", value: 20 },
                      ]}
                      placeholder="Select max points"
                      value={maxDataPoints}
                      onChange={setMaxDataPoints}
                      width="100%"
                    />
                  </div>
                  {chartType !== "pie" && (
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
                          label="Display"
                          direction="column"
                          options={[
                            { label: "Status Breakdown", value: "status" },
                            { label: "Count", value: "count" },
                            { label: "Total Days", value: "amount" },
                          ]}
                          placeholder="Select"
                          value={xAxisKey}
                          onChange={setXAxisKey}
                          width="100%"
                        />
                      </div>
                      <div>
                        <FormInput
                          type="select"
                          label="Additional Metrics"
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
                            setPieMetric(value)
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
    </div>
  )
}

export default LeavesAnalytics 