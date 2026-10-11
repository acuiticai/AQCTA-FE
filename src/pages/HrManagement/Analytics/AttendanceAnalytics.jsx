import React from "react"
import SummaryCards from "@/page-layouts/components/SummaryCards"
import FormInput from "@/page-layouts/components/FormInput"

const AttendanceAnalytics = ({
  attendanceStats,
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
  processedAttendanceData,
  paginatedAttendanceData,
  attendanceTotalPages,
  attendanceAvailableMetrics,
  renderAttendanceChart,
}) => {
  return (
    <div className="data-table-layout bg-p-gray-light p-4 rounded-[20px] pb-4">
      <div className="bg-p-gray-light rounded-xl p-0 mb-[16px]">
        <div className="p-4">
          <h2 className="text-xl font-semibold mb-6">Attendance Analytics</h2>

          {/* Summary Section */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-800 border-b border-gray-200 pb-2">Summary</h3>
            <SummaryCards
              cards={[
                { title: "Total Staff", value: summary.totalStaff },
                { title: "Total Working Days", value: summary.totalWorkingDays },
                { title: "Total Present Days", value: summary.totalPresentDays },
                { title: "Total Absent Days", value: summary.totalAbsentDays },
                { title: "Total Late Days", value: summary.totalLateDays },
                { title: "Total Punctual Days", value: summary.totalPunctualDays },
                { title: "Total Hours", value: summary.totalHours },
                { title: "Average Attendance Rate", value: summary.averageAttendanceRate },
                { title: "Average Punctuality Rate", value: summary.averagePunctualityRate },
              ]}
              columnsCount={6}
              size="md"
            />
          </div>

          {/* Chart and Configuration */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Left Column - Chart (2/3 width) */}
            <div className="xl:col-span-2 bg-white rounded-lg p-4 shadow-sm">
              <div className="bg-white h-full flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2 w-full">
                    Attendance Analytics
                  </h3>
                </div>
                {/* Pagination Controls */}
                {processedAttendanceData.length > maxDataPoints && maxDataPoints !== "all" && (
                  <div className="flex items-center justify-center gap-3 mb-4 flex-wrap">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 transition-colors"
                    >
                      Previous
                    </button>
                    <span className="text-xs text-gray-600 px-2">
                      Page {currentPage} of {attendanceTotalPages} ({processedAttendanceData.length} total items)
                    </span>
                    <button
                      onClick={() => setCurrentPage(Math.min(attendanceTotalPages, currentPage + 1))}
                      disabled={currentPage === attendanceTotalPages}
                      className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 transition-colors"
                    >
                      Next
                    </button>
                  </div>
                )}
                {/* Chart Display */}
                <div className="w-full h-full">
                  <div className="min-h-[400px] flex items-center justify-center">
                    {processedAttendanceData.length > 0 ? (
                      renderAttendanceChart()
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
                        setChartType(value)
                        setCurrentPage(1)
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
                        setMaxDataPoints(value)
                        setCurrentPage(1)
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
                            { label: "Count", value: "count" },
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
                            { label: "Staff", value: "staff" },
                            { label: "Department", value: "department" },
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
                            { label: "Staff", value: "staff" },
                            { label: "Department", value: "department" },
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
                          options={attendanceAvailableMetrics}
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
                            { label: "Staff", value: "staff" },
                            { label: "Department", value: "department" },
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
                          options={attendanceAvailableMetrics}
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

export default AttendanceAnalytics 