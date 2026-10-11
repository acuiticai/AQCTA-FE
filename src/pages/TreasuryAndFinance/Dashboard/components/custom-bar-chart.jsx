const CustomBarChart = ({ data = [], activeIndex = 5, currency = "USD" }) => {
  // Enhanced data validation
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className="relative h-64 w-full flex items-center justify-center bg-gray-50 rounded-lg border border-gray-200">
        <div className="text-center">
          <div className="text-gray-500 text-sm mb-2">
            No activity data available
          </div>
          <div className="text-gray-400 text-xs">
            Data will appear here when transactions are recorded
          </div>
        </div>
      </div>
    );
  }

  // Validate and sanitize data
  const sanitizedData = data
    .map((item, index) => ({
      name: item?.name || `Item ${index + 1}`,
      value: Math.max(0, Number(item?.value) || 0), // Ensure non-negative values
    }))
    .filter((item) => item.name); // Remove items without names

  if (sanitizedData.length === 0) {
    return (
      <div className="relative h-64 w-full flex items-center justify-center bg-gray-50 rounded-lg border border-gray-200">
        <div className="text-center">
          <div className="text-gray-500 text-sm mb-2">Invalid data format</div>
          <div className="text-gray-400 text-xs">
            Please check the data source
          </div>
        </div>
      </div>
    );
  }

  const maxValue = Math.max(...sanitizedData.map((item) => item.value)) || 1; // Prevent division by zero
  const safeActiveIndex = Math.min(
    Math.max(0, activeIndex),
    sanitizedData.length - 1
  );

  // Format Y-axis labels based on max value with better scaling
  const formatYAxisLabel = (value) => {
    const symbol = currency === "USD" ? "$" : currency + " ";
    if (value >= 1000000) return `${symbol}${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${symbol}${(value / 1000).toFixed(1)}K`;
    if (value >= 1) return `${symbol}${value.toFixed(0)}`;
    return `${symbol}${value.toFixed(2)}`;
  };

  // Generate more intelligent Y-axis labels
  const generateYAxisLabels = () => {
    const labels = [];
    const stepSize = maxValue / 5;
    for (let i = 5; i >= 0; i--) {
      labels.push(formatYAxisLabel(stepSize * i));
    }
    return labels;
  };

  const yAxisLabels = generateYAxisLabels();

  return (
    <div
      className="relative h-64 w-full overflow-hidden"
      role="img"
      aria-label="Financial Activity Bar Chart"
    >
      {/* Y-axis labels - Fixed positioning */}
      <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-400 w-10 pr-2">
        {yAxisLabels.map((label, index) => (
          <span key={index} className="select-none text-right">
            {label}
          </span>
        ))}
      </div>

      {/* Chart area - Properly constrained */}
      <div className="ml-12 mr-4 h-full flex items-end justify-between pb-8 overflow-hidden">
        <div className="flex items-end justify-between w-full h-full gap-1 min-w-0">
          {sanitizedData.map((item, index) => {
            const height = Math.max(2, (item.value / maxValue) * 200); // Minimum height of 2px
            const isActive = index === safeActiveIndex;
            const percentage =
              maxValue > 0 ? ((item.value / maxValue) * 100).toFixed(1) : 0;

            return (
              <div
                key={`${item.name}-${index}`}
                className="flex flex-col items-center group min-w-0 flex-1"
                style={{ maxWidth: `${100 / sanitizedData.length}%` }}
                role="graphics-symbol"
                aria-label={`${item.name}: ${formatYAxisLabel(
                  item.value
                )} (${percentage}% of maximum)`}
              >
                <div
                  className="w-full max-w-12 rounded-t-md relative transition-all duration-300 hover:opacity-80 cursor-pointer mx-auto"
                  style={{
                    height: `${height}px`,
                    minHeight: "2px",
                    maxWidth: "48px", // Ensure bars don't get too wide
                  }}
                  title={`${item.name}: ${formatYAxisLabel(item.value)}`}
                >
                  {isActive ? (
                    <div className="w-full h-full bg-[var(--p-blue)] rounded-t-md shadow-sm"></div>
                  ) : (
                    <div
                      className="w-full h-full rounded-t-md border border-green-300 shadow-sm"
                      style={{
                        background: `repeating-linear-gradient(
                            45deg,
                            #bbf7d0,
                            #bbf7d0 4px,
                            #dcfce7 4px,
                            #dcfce7 8px
                          )`,
                      }}
                    ></div>
                  )}
                  {/* Hover tooltip */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none z-10">
                    {formatYAxisLabel(item.value)}
                  </div>
                </div>
                {/* Label with overflow handling */}
                <span
                  className="text-xs text-gray-500 mt-2 truncate w-full text-center px-1"
                  title={item.name}
                  style={{
                    fontSize: sanitizedData.length > 10 ? "10px" : "12px",
                  }}
                >
                  {item.name.length > 3 ? item.name.substring(0, 3) : item.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Peak value label - Better positioning to avoid overflow */}
      {maxValue > 0 && (
        <div className="absolute top-4 left-12 right-4">
          <div className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-medium shadow-sm inline-block">
            Peak: {formatYAxisLabel(maxValue)}
          </div>
        </div>
      )}

      {/* Data summary for screen readers */}
      <div className="sr-only">
        Chart showing financial activity across {sanitizedData.length} periods.
        Maximum value: {formatYAxisLabel(maxValue)}. Active period:{" "}
        {sanitizedData[safeActiveIndex]?.name} with value{" "}
        {formatYAxisLabel(sanitizedData[safeActiveIndex]?.value)}.
      </div>
    </div>
  );
};

export { CustomBarChart };
