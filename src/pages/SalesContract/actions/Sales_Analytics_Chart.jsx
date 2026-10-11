"use client"

import { useMemo, useState } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import { useDebounce } from "use-debounce"
import { Loader } from "@/page-layouts/index"
import SummaryCards from "@/page-layouts/components/SummaryCards"
import { formatAmount } from "@/components/formatAmount"
import { FormInput } from "@/page-layouts/index"
import _ from "lodash"

// Custom Card component
const Card = ({ className = "", children }) => (
  <div className={`rounded-2xl shadow-md bg-white ${className}`}>{children}</div>
)

// Custom CardContent component
const CardContent = ({ children }) => <div className="p-6">{children}</div>

// Custom Badge component
const Badge = ({ children, className = "" }) => (
  <span className={`inline-block bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded ${className}`}>
    {children}
  </span>
)

const colorMap = [
  "#E53E3E", // Medium Dark Red
  "#38A169", // Medium Dark Green
  "#3182CE", // Medium Dark Blue
  "#D69E2E", // Medium Dark Yellow
  "#805AD5", // Medium Dark Purple
  "#C8102E", // Medium Dark Orange
  "#319795", // Medium Dark Teal
  "#B7791F", // Medium Dark Gold
  "#97266D", // Medium Dark Pink
  "#2C7A7B", // Medium Dark Cyan
]

const customLabel = (label) => {
  switch (label) {
    case "contracts":
      return "Contracts"
    case "revenue":
      return "Revenue"
    case "customerName":
      return "Customer Name"
    case "itemName":
      return "Item Name"
    case "statusCount":
      return "Status Count"
    default:
      return _.capitalize(label)
  }
}

// Custom Tooltip
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-white p-3 rounded-xl shadow-lg border text-sm text-gray-800">
        <p className="font-semibold mb-2">{label}</p>
        {Object.keys(data).map((key) => {
          const value = data[key]
          // Skip non-primitive values and internal keys
          if (typeof value === "object" || key === "fill" || key === "name") return null
          return (
            <p key={key} className="mb-1">
              <span className="font-medium">{customLabel(key)}:</span>{" "}
              <span className="text-gray-600">
                {key === "revenue" ? `$${formatAmount(value)}` : formatAmount(value)}
              </span>
            </p>
          )
        })}
      </div>
    )
  }
  return null
}

// Custom Pie Chart Tooltip
const PieTooltip = ({ active, payload, label, selectedMetric }) => {
  if (active && payload && payload.length) {
    const data = payload[0]
    return (
      <div className="bg-white p-3 rounded-xl shadow-lg border text-sm text-gray-800">
        <p className="font-semibold mb-1">{data.name}</p>
        <p className="text-gray-600">
          {customLabel(selectedMetric)}:{" "}
          <span className="font-medium">
            {selectedMetric === "revenue" ? `$${formatAmount(data.value)}` : formatAmount(data.value)}
          </span>
        </p>
      </div>
    )
  }
  return null
}

// Helper to estimate text width
function getTextWidth(text, font = "12px Arial") {
  const canvas = getTextWidth.canvas || (getTextWidth.canvas = document.createElement("canvas"))
  const context = canvas.getContext("2d")
  context.font = font
  return context.measureText(text).width
}

const SalesAnalyticsChart = ({
  data,
  filters = [],
  onSearch,
  searchPlaceholder = "Search",
  actionButtons = [],
  noBackground = false,
  noPadding = false,
  containerClassName = "rounded-xl p-0 mb-[16px]",
  title = "",
  filtersData = {},
  loading = false,
  searchValue = "",
}) => {
  const [localSearchValue, setLocalSearchValue] = useState(searchValue)
  const debouncedSearch = useDebounce(onSearch, 500)
  const [groupBy, setGroupBy] = useState("customer")
  const [chartType, setChartType] = useState("pie")
  const [maxDataPoints, setMaxDataPoints] = useState(25)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedMetrics, setSelectedMetrics] = useState(["contracts"])
  const [pieMetric, setPieMetric] = useState("contracts")
  const [customFilters, setCustomFilters] = useState({})

  // Available metrics for charts
  const availableMetrics = [
    { label: "Contracts", value: "contracts" },
    { label: "Revenue", value: "revenue" },
  ]

  // Process the data based on the new structure
  const processed = useMemo(() => {
    console.log("Processing data:", data)
    console.log("Group by:", groupBy)

    if (!data || typeof data !== "object") {
      console.warn("No data or invalid data type:", data)
      return []
    }

    let processedData = []

    if (groupBy === "customer" && data.byCustomer && Array.isArray(data.byCustomer)) {
      console.log("Processing customer data:", data.byCustomer)
      processedData = data.byCustomer.map((item) => ({
        name: item.customerName || "Unknown Customer",
        contracts: Number(item.contracts || 0),
        revenue: Number(item.revenue || 0),
        type: "customer",
      }))
    } else if (groupBy === "item" && data.byItem && Array.isArray(data.byItem)) {
      console.log("Processing item data:", data.byItem)
      processedData = data.byItem.map((item) => ({
        name: item.itemName || "Unknown Item",
        contracts: Number(item.contracts || 0),
        revenue: Number(item.revenue || 0),
        type: "item",
      }))
    } else if (groupBy === "status" && data.statusCounts && typeof data.statusCounts === "object") {
      console.log("Processing status data:", data.statusCounts)
      processedData = Object.entries(data.statusCounts).map(([status, count]) => ({
        name: status,
        contracts: Number(count || 0),
        revenue: 0, // Status data doesn't have revenue
        type: "status",
      }))
    }

    console.log("Processed data:", processedData)

    // Sort by the primary metric (contracts by default)
    const sortedData = processedData.sort((a, b) => b.contracts - a.contracts)
    console.log("Sorted data:", sortedData)

    return sortedData
  }, [data, groupBy])

  // Pagination for large datasets
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * maxDataPoints
    const endIndex = maxDataPoints === "all" ? processed.length : startIndex + maxDataPoints
    return processed.slice(startIndex, endIndex)
  }, [processed, currentPage, maxDataPoints])

  const totalPages = Math.ceil(processed.length / (maxDataPoints === "all" ? processed.length : maxDataPoints))

  // Summary calculations
  const summary = useMemo(() => {
    console.log("Calculating summary for data:", data)

    if (!data || typeof data !== "object") {
      console.warn("No data for summary calculation")
      return {
        totalContracts: "0",
        totalRevenue: "0.00",
        avgRevenuePerContract: "0.00",
        topCustomerContracts: "0",
        topItemContracts: "0",
      }
    }

    const totalContracts = Number(data.totalContracts || 0)
    const totalRevenue = Number(data.totalRevenue || 0)
    const avgRevenuePerContract = totalContracts > 0 ? totalRevenue / totalContracts : 0

    const topCustomer =
      data.byCustomer && Array.isArray(data.byCustomer) && data.byCustomer.length > 0
        ? Math.max(...data.byCustomer.map((c) => Number(c.contracts || 0)))
        : 0

    const topItem =
      data.byItem && Array.isArray(data.byItem) && data.byItem.length > 0
        ? Math.max(...data.byItem.map((i) => Number(i.contracts || 0)))
        : 0

    const summaryResult = {
      totalContracts: formatAmount(totalContracts),
      totalRevenue: formatAmount(totalRevenue),
      avgRevenuePerContract: formatAmount(avgRevenuePerContract),
      topCustomerContracts: formatAmount(topCustomer),
      topItemContracts: formatAmount(topItem),
    }

    console.log("Summary result:", summaryResult)
    return summaryResult
  }, [data])

  const renderBarLabel = (props) => {
    const { value, x, y, width, height } = props
    const label = value.toLocaleString()
    const labelWidth = getTextWidth(label, "12px Arial")
    const padding = 8

    if (width < labelWidth + padding) return null

    return (
      <text
        x={x + width - 5}
        y={y + height / 2}
        fill="#fff"
        fontSize={10}
        textAnchor="end"
        className="text-xs font-semibold"
        alignmentBaseline="middle"
      >
        {label}
      </text>
    )
  }

  const renderChart = () => {
    const baseHeight = Math.min(Math.max(paginatedData.length * 25 + 100, 300), 500)

    if (chartType === "bar") {
      return (
        <ResponsiveContainer width="100%" height={baseHeight}>
          <BarChart
            layout="vertical"
            data={paginatedData}
            className="w-full"
            margin={{ top: 20, right: 80, left: 0, bottom: 40 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: "#6B7280" }}
              axisLine={{ stroke: "#D1D5DB" }}
              tickLine={false}
              tickFormatter={(value) => formatAmount(value)}
            />
            <YAxis
              dataKey="name"
              type="category"
              tick={{ fontSize: 11 }}
              width={120}
              tickFormatter={(value) => {
                if (value && value.length > 12) {
                  return value.substring(0, 12) + "..."
                }
                return value
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{
                paddingTop: "15px",
                fontSize: "11px",
                paddingBottom: "5px",
                width: "100%",
              }}
              verticalAlign="bottom"
            />
            <Bar dataKey="contracts" fill={colorMap[0]} name="Contracts">
              <LabelList dataKey="contracts" content={renderBarLabel} />
            </Bar>
            {groupBy !== "status" && (
              <Bar dataKey="revenue" fill={colorMap[1]} name="Revenue">
                <LabelList dataKey="revenue" content={renderBarLabel} />
              </Bar>
            )}
          </BarChart>
        </ResponsiveContainer>
      )
    }

    if (chartType === "line") {
      return (
        <ResponsiveContainer width="100%" height={Math.min(baseHeight, 400)}>
          <LineChart data={paginatedData} margin={{ top: 15, right: 20, left: 15, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: "#6B7280" }}
              axisLine={{ stroke: "#D1D5DB" }}
              tickLine={false}
              angle={-45}
              textAnchor="end"
              height={60}
              interval={0}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#6B7280" }}
              axisLine={{ stroke: "#D1D5DB" }}
              tickLine={false}
              tickFormatter={(value) => formatAmount(value)}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{
                paddingTop: "15px",
                fontSize: "11px",
                paddingBottom: "5px",
              }}
            />
            {selectedMetrics.map((metric, index) => (
              <Line
                key={metric}
                type="monotone"
                dataKey={metric}
                stroke={colorMap[index % colorMap.length]}
                strokeWidth={2}
                dot={{ r: 3, fill: colorMap[index % colorMap.length] }}
                activeDot={{ r: 5, fill: colorMap[index % colorMap.length] }}
                name={availableMetrics.find((m) => m.value === metric)?.label || _.capitalize(metric)}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )
    }

    if (chartType === "pie") {
      const pieData = paginatedData
        .filter((item) => Number(item[pieMetric]) > 0)
        .map((item, index) => ({
          name: item.name,
          value: Number(item[pieMetric]),
          fill: colorMap[index % colorMap.length],
        }))

      const renderPieLabel = ({ name, percent, value, cx, cy, midAngle, outerRadius }) => {
        const percentage = (percent * 100).toFixed(1)
        if (percentage <= 5) return null

        const label = `${name}\n${percentage}%`
        const font = "12px Arial"
        const labelWidth = getTextWidth(label.replace(/\n/g, " "), font)
        const arcLength = 2 * Math.PI * outerRadius * percent
        const padding = 8

        if (arcLength < labelWidth + padding) return null
        return label
      }

      return (
        <ResponsiveContainer width="100%" height={400} className="mb-8">
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderPieLabel}
              outerRadius={120}
              fill="#8884d8"
              dataKey="value"
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip content={<PieTooltip selectedMetric={pieMetric} />} />
            <Legend
              wrapperStyle={{
                paddingTop: "15px",
                fontSize: "11px",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      )
    }

    return null
  }

  // Add this right before the return statement
  console.log("Render - Data:", data)
  console.log("Render - Processed:", processed)
  console.log("Render - Loading:", loading)

  return (
    <div
      className={`data-table-layout ${!noBackground && "bg-p-gray-light"} ${!noPadding && "p-4"} rounded-[20px] pb-4`}
    >
      <div className={`${!noBackground && "bg-p-gray-light"} ${containerClassName}`}>
        <div className="p-4">
          {title && <h2 className="text-md font-semibold mb-6">{title}</h2>}

          {/* Filters Section */}
          {filters.length > 0 && (
            <div className="mb-6">
              <h3 className="text-base font-semibold mb-4 text-gray-800 border-b border-gray-200 pb-2">Filters</h3>
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                  {filters.map((filter, index) => (
                    <div key={index} className="w-full">
                      {filter.label && <div className="text-sm font-medium mb-2">{filter.label}</div>}
                      {filter.component}
                    </div>
                  ))}
                  {onSearch && (
                    <div className="w-full">
                      <FormInput
                        type="text"
                        label="Search"
                        direction="column"
                        placeholder={searchPlaceholder}
                        value={localSearchValue}
                        onChange={(e) => {
                          const value = e.target.value
                          setLocalSearchValue(value)
                          debouncedSearch(value)
                        }}
                        width="100%"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Summary Section */}
          <div className="mb-6">
            <h3 className="text-base font-semibold mb-4 text-gray-800 border-b border-gray-200 pb-2">Summary</h3>
            <SummaryCards
              cards={[
                {
                  title: "Total Contracts",
                  value: summary.totalContracts,
                },
                {
                  title: "Total Revenue",
                  value: `$${summary.totalRevenue}`,
                },
                {
                  title: "Avg Revenue/Contract",
                  value: `$${summary.avgRevenuePerContract}`,
                },
                {
                  title: "Top Customer Contracts",
                  value: summary.topCustomerContracts,
                },
                {
                  title: "Top Item Contracts",
                  value: summary.topItemContracts,
                },
              ]}
              columnsCount={5}
              size="md"
            />
          </div>

          {/* Chart and Configuration */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Chart Display */}
            <div className="xl:col-span-2 bg-white rounded-lg p-4 shadow-sm">
              <div className="bg-white h-full flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-base font-semibold text-gray-800 border-b border-gray-200 pb-2 w-full">
                    Sales Analytics
                  </h3>
                </div>

                {/* Pagination Controls */}
                {processed.length > maxDataPoints && maxDataPoints !== "all" && (
                  <div className="flex items-center justify-center gap-3 mb-4 flex-wrap">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 transition-colors"
                    >
                      Previous
                    </button>
                    <span className="text-xs text-gray-600 px-2">
                      Page {currentPage} of {totalPages} ({processed.length} total items)
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
                {loading ? (
                  <div className="flex justify-center items-center h-96">
                    <Loader />
                  </div>
                ) : processed.length === 0 ? (
                  <div className="flex justify-center items-center h-96 bg-gray-50 rounded-lg">
                    <p className="text-gray-500">No data available to display</p>
                  </div>
                ) : (
                  <div className="w-full h-full">
                    <div className="min-h-[400px] flex items-center justify-center">{renderChart()}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Chart Configuration */}
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

                  {/* Group By Selector */}
                  <div>
                    <FormInput
                      type="select"
                      label="Group By"
                      direction="column"
                      options={[
                        { label: "Customer", value: "customer" },
                        { label: "Item", value: "item" },
                        { label: "Status", value: "status" },
                      ]}
                      placeholder="Select"
                      value={groupBy}
                      onChange={(value) => {
                        setGroupBy(value)
                        setCurrentPage(1)
                      }}
                      isClearable={false}
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
                        { label: "10", value: 10 },
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
                  {chartType === "line" && (
                    <div>
                      <FormInput
                        type="select"
                        label="Metrics"
                        direction="column"
                        options={groupBy === "status" ? [{ label: "Contracts", value: "contracts" }] : availableMetrics}
                        placeholder="Select metrics"
                        value={selectedMetrics}
                        onChange={setSelectedMetrics}
                        isMulti
                        width="100%"
                      />
                    </div>
                  )}

                  {chartType === "pie" && (
                    <div>
                      <FormInput
                        type="select"
                        label="Metric"
                        direction="column"
                        options={groupBy === "status" ? [{ label: "Contracts", value: "contracts" }] : availableMetrics}
                        placeholder="Select metric"
                        value={pieMetric}
                        onChange={setPieMetric}
                        width="100%"
                      />
                    </div>
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

export default SalesAnalyticsChart
