const CustomAreaChart = ({ data = [] }) => {
  // Enhanced data validation
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className="relative h-64 w-full flex items-center justify-center bg-gray-50 rounded-lg border border-gray-200">
        <div className="text-center">
          <div className="text-gray-500 text-sm mb-2">
            No analytics data available
          </div>
          <div className="text-gray-400 text-xs">
            Data will appear here when transactions are processed
          </div>
        </div>
      </div>
    );
  }

  // Validate and sanitize data
  const sanitizedData = data
    .map((item, index) => ({
      name: item?.name || `Period ${index + 1}`,
      totalProfit: Number(item?.totalProfit) || 0,
      income: Math.max(0, Number(item?.income) || 0), // Ensure non-negative
      expenses: Math.max(0, Number(item?.expenses) || 0),
      losses: Math.max(0, Number(item?.losses) || 0),
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

  // Calculate the maximum value for scaling with safety checks
  const allValues = sanitizedData.flatMap((item) => [
    Math.abs(item.totalProfit),
    item.income,
    item.expenses,
    item.losses,
  ]);

  const maxValue = Math.max(...allValues) || 100; // Fallback to 100 if all values are 0
  const minValue =
    Math.min(...sanitizedData.map((item) => item.totalProfit)) || 0;

  // Chart dimensions
  const width = 800;
  const height = 250;
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Enhanced scale functions with safety checks
  const xScale = (index) => {
    if (sanitizedData.length <= 1) return chartWidth / 2 + padding.left;
    return (index / (sanitizedData.length - 1)) * chartWidth + padding.left;
  };

  const yScale = (value) => {
    const range = maxValue - minValue;
    if (range === 0) return chartHeight / 2 + padding.top;
    const normalizedValue = (value - minValue) / range;
    return chartHeight - normalizedValue * chartHeight + padding.top;
  };

  // Generate path strings for lines with error handling
  const generateLinePath = (dataKey) => {
    if (sanitizedData.length === 0) return "";

    return sanitizedData
      .map((item, index) => {
        const x = xScale(index);
        const y = yScale(item[dataKey]);

        // Validate coordinates
        if (isNaN(x) || isNaN(y)) return "";

        return index === 0 ? `M ${x},${y}` : `L ${x},${y}`;
      })
      .filter(Boolean)
      .join(" ");
  };

  // Generate path strings for areas with error handling
  const generateAreaPath = (dataKey) => {
    if (sanitizedData.length === 0) return "";

    const linePath = generateLinePath(dataKey);
    if (!linePath) return "";

    const firstX = xScale(0);
    const lastX = xScale(sanitizedData.length - 1);
    const baseline = chartHeight + padding.top;

    return `${linePath} L ${lastX},${baseline} L ${firstX},${baseline} Z`;
  };

  // Format value for display
  const formatValue = (value) => {
    if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toFixed(0);
  };

  // Generate Y-axis labels
  const generateYAxisLabels = () => {
    const labels = [];
    const step = (maxValue - minValue) / 4;
    for (let i = 4; i >= 0; i--) {
      const value = minValue + step * i;
      labels.push(formatValue(value));
    }
    return labels;
  };

  const yAxisLabels = generateYAxisLabels();

  return (
    <div
      className="relative h-64 w-full"
      role="img"
      aria-label="Financial Analytics Area Chart"
    >
      <style jsx>{`
        .area-chart-area {
          opacity: 0.3;
        }
        .area-chart-losses-area {
          fill: #ec4899;
        }
        .area-chart-expenses-area {
          fill: #374151;
        }
        .area-chart-income-area {
          fill: #a855f7;
        }
        .area-chart-profit-area {
          fill: var(--p-blue);
        }
        .area-chart-line {
          fill: none;
          stroke-width: 2;
          transition: stroke-width 0.2s ease;
        }
        .area-chart-line:hover {
          stroke-width: 3;
        }
        .area-chart-losses {
          stroke: #ec4899;
        }
        .area-chart-expenses {
          stroke: #374151;
        }
        .area-chart-income {
          stroke: #a855f7;
        }
        .area-chart-profit {
          stroke: var(--p-blue);
        }
        .data-point {
          transition: r 0.2s ease;
        }
        .data-point:hover {
          r: 5;
        }
      `}</style>

      {/* Y-axis labels */}
      <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-400 pr-4">
        {yAxisLabels.map((label, index) => (
          <span key={index} className="select-none">
            {label}
          </span>
        ))}
      </div>

      {/* SVG Chart */}
      <div className="ml-8 h-full relative">
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          aria-describedby="area-chart-desc"
        >
          {/* Grid lines for better readability */}
          <defs>
            <pattern
              id="grid"
              width="40"
              height="40"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="#f3f4f6"
                strokeWidth="1"
                opacity="0.5"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Areas (filled regions under lines) */}
          {sanitizedData.length > 1 && (
            <>
              <path
                className="area-chart-area area-chart-losses-area"
                d={generateAreaPath("losses")}
              />
              <path
                className="area-chart-area area-chart-expenses-area"
                d={generateAreaPath("expenses")}
              />
              <path
                className="area-chart-area area-chart-income-area"
                d={generateAreaPath("income")}
              />
              <path
                className="area-chart-area area-chart-profit-area"
                d={generateAreaPath("totalProfit")}
              />
            </>
          )}

          {/* Lines */}
          {sanitizedData.length > 1 && (
            <>
              <path
                className="area-chart-line area-chart-losses"
                d={generateLinePath("losses")}
              />
              <path
                className="area-chart-line area-chart-expenses"
                d={generateLinePath("expenses")}
              />
              <path
                className="area-chart-line area-chart-income"
                d={generateLinePath("income")}
              />
              <path
                className="area-chart-line area-chart-profit"
                d={generateLinePath("totalProfit")}
              />
            </>
          )}

          {/* Data points with enhanced interactivity */}
          {sanitizedData.map((item, index) => {
            const x = xScale(index);
            const profitY = yScale(item.totalProfit);
            const incomeY = yScale(item.income);
            const expensesY = yScale(item.expenses);
            const lossesY = yScale(item.losses);

            return (
              <g key={`${item.name}-${index}`}>
                <circle
                  cx={x}
                  cy={profitY}
                  r="3"
                  className="fill-[var(--p-blue)] data-point cursor-pointer"
                  role="graphics-symbol"
                  aria-label={`${item.name} Total Profit: ${formatValue(
                    item.totalProfit
                  )}`}
                >
                  <title>{`${item.name} - Total Profit: ${formatValue(
                    item.totalProfit
                  )}`}</title>
                </circle>
                <circle
                  cx={x}
                  cy={incomeY}
                  r="3"
                  className="fill-purple-400 data-point cursor-pointer"
                  role="graphics-symbol"
                  aria-label={`${item.name} Income: ${formatValue(
                    item.income
                  )}`}
                >
                  <title>{`${item.name} - Income: ${formatValue(
                    item.income
                  )}`}</title>
                </circle>
                <circle
                  cx={x}
                  cy={expensesY}
                  r="3"
                  className="fill-gray-800 data-point cursor-pointer"
                  role="graphics-symbol"
                  aria-label={`${item.name} Expenses: ${formatValue(
                    item.expenses
                  )}`}
                >
                  <title>{`${item.name} - Expenses: ${formatValue(
                    item.expenses
                  )}`}</title>
                </circle>
                <circle
                  cx={x}
                  cy={lossesY}
                  r="3"
                  className="fill-pink-500 data-point cursor-pointer"
                  role="graphics-symbol"
                  aria-label={`${item.name} Losses: ${formatValue(
                    item.losses
                  )}`}
                >
                  <title>{`${item.name} - Losses: ${formatValue(
                    item.losses
                  )}`}</title>
                </circle>
              </g>
            );
          })}

          {/* Zero line if data crosses zero */}
          {minValue < 0 && maxValue > 0 && (
            <line
              x1={padding.left}
              y1={yScale(0)}
              x2={width - padding.right}
              y2={yScale(0)}
              stroke="#6b7280"
              strokeWidth="1"
              strokeDasharray="4,4"
              opacity="0.5"
            />
          )}
        </svg>

        {/* X-axis labels */}
        <div className="absolute bottom-0 w-full flex justify-between text-xs text-gray-500 pb-2 px-4">
          {sanitizedData.map((item, index) => (
            <span
              key={`label-${index}`}
              className="truncate max-w-16 text-center"
              title={item.name}
            >
              {item.name}
            </span>
          ))}
        </div>
      </div>

      {/* Screen reader description */}
      <div className="sr-only" id="area-chart-desc">
        Area chart showing financial analytics across {sanitizedData.length}{" "}
        periods. Data ranges from {formatValue(minValue)} to{" "}
        {formatValue(maxValue)}.
        {sanitizedData
          .map(
            (item, index) =>
              `${item.name}: Profit ${formatValue(
                item.totalProfit
              )}, Income ${formatValue(item.income)}, Expenses ${formatValue(
                item.expenses
              )}, Losses ${formatValue(item.losses)}${
                index < sanitizedData.length - 1 ? ". " : ""
              }`
          )
          .join("")}
      </div>
    </div>
  );
};

export { CustomAreaChart };
