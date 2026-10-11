const CustomPieChart = ({ data = [], currency = "USD" }) => {
  // Enhanced data validation
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className="relative w-40 h-40 flex items-center justify-center bg-gray-50 rounded-full border border-gray-200">
        <div className="text-center">
          <div className="text-gray-500 text-xs mb-1">No data</div>
          <div className="text-gray-400 text-[10px]">to display</div>
        </div>
      </div>
    );
  }

  // Validate and sanitize data
  const sanitizedData = data
    .map((item, index) => ({
      name: item?.name || `Category ${index + 1}`,
      value: Math.max(0, Number(item?.value) || 0), // Ensure non-negative values
      color: item?.color || `hsl(${(index * 360) / data.length}, 70%, 50%)`, // Fallback colors
    }))
    .filter((item) => item.value > 0); // Remove zero or negative values

  if (sanitizedData.length === 0) {
    return (
      <div className="relative w-40 h-40 flex items-center justify-center bg-gray-50 rounded-full border border-gray-200">
        <div className="text-center">
          <div className="text-gray-500 text-xs mb-1">Invalid data</div>
          <div className="text-gray-400 text-[10px]">or all zero values</div>
        </div>
      </div>
    );
  }

  const total = sanitizedData.reduce((sum, item) => sum + item.value, 0);

  // If total is still 0 after sanitization, show empty state
  if (total === 0) {
    return (
      <div className="relative w-40 h-40 flex items-center justify-center bg-gray-50 rounded-full border border-gray-200">
        <div className="text-center">
          <div className="text-gray-500 text-xs mb-1">No data</div>
          <div className="text-gray-400 text-[10px]">to display</div>
        </div>
      </div>
    );
  }

  let currentAngle = 0;

  const createPath = (
    centerX,
    centerY,
    radius,
    startAngle,
    endAngle,
    innerRadius = 30
  ) => {
    const startAngleRad = (startAngle * Math.PI) / 180;
    const endAngleRad = (endAngle * Math.PI) / 180;

    const x1 = centerX + radius * Math.cos(startAngleRad);
    const y1 = centerY + radius * Math.sin(startAngleRad);
    const x2 = centerX + radius * Math.cos(endAngleRad);
    const y2 = centerY + radius * Math.sin(endAngleRad);

    const x3 = centerX + innerRadius * Math.cos(endAngleRad);
    const y3 = centerY + innerRadius * Math.sin(endAngleRad);
    const x4 = centerX + innerRadius * Math.cos(startAngleRad);
    const y4 = centerY + innerRadius * Math.sin(startAngleRad);

    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

    return [
      "M",
      x1,
      y1,
      "A",
      radius,
      radius,
      0,
      largeArcFlag,
      1,
      x2,
      y2,
      "L",
      x3,
      y3,
      "A",
      innerRadius,
      innerRadius,
      0,
      largeArcFlag,
      0,
      x4,
      y4,
      "Z",
    ].join(" ");
  };

  // Format value for display with currency
  const formatValue = (value) => {
    const symbol = currency === "USD" ? "$" : currency + " ";
    if (value >= 1000000) return `${symbol}${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${symbol}${(value / 1000).toFixed(1)}K`;
    if (value >= 1) return `${symbol}${value.toFixed(0)}`;
    return `${symbol}${value.toFixed(2)}`;
  };

  return (
    <div
      className="relative w-40 h-40"
      role="img"
      aria-label="Financial Analytics Pie Chart"
    >
      <svg
        width="160"
        height="160"
        className="transform -rotate-90"
        aria-describedby="pie-chart-desc"
      >
        {/* Background circle for better visual definition */}
        <circle
          cx="80"
          cy="80"
          r="70"
          fill="none"
          stroke="#f3f4f6"
          strokeWidth="1"
        />

        {sanitizedData.map((item, index) => {
          const angle = (item.value / total) * 360;
          const percentage = ((item.value / total) * 100).toFixed(1);

          // Skip very small segments (less than 1 degree)
          if (angle < 1) {
            return null;
          }

          const path = createPath(
            80,
            80,
            70,
            currentAngle,
            currentAngle + angle,
            40
          );

          const segment = (
            <g key={`${item.name}-${index}`}>
              <path
                d={path}
                fill={item.color}
                stroke="white"
                strokeWidth="2"
                className="transition-all duration-300 hover:opacity-80 cursor-pointer"
                role="graphics-symbol"
                aria-label={`${item.name}: ${formatValue(
                  item.value
                )} (${percentage}%)`}
              >
                <title>{`${item.name}: ${formatValue(
                  item.value
                )} (${percentage}%)`}</title>
              </path>
            </g>
          );

          currentAngle += angle;
          return segment;
        })}

        {/* Center circle for donut effect */}
        <circle
          cx="80"
          cy="80"
          r="38"
          fill="white"
          stroke="#e5e7eb"
          strokeWidth="1"
        />
      </svg>

      {/* Center content showing total */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className="text-xs font-semibold text-gray-700">Total</div>
          <div className="text-sm font-bold text-gray-900">
            {formatValue(total)}
          </div>
        </div>
      </div>

      {/* Enhanced tooltip functionality would go here in a real implementation */}
      <div className="sr-only" id="pie-chart-desc">
        Pie chart showing financial breakdown across {sanitizedData.length}{" "}
        categories. Total value: {formatValue(total)}.
        {sanitizedData
          .map((item, index) => {
            const percentage = ((item.value / total) * 100).toFixed(1);
            return `${item.name}: ${formatValue(item.value)} (${percentage}%)${
              index < sanitizedData.length - 1 ? ". " : ""
            }`;
          })
          .join("")}
      </div>
    </div>
  );
};

export { CustomPieChart };
