import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  Cell,
} from "recharts";

const COLOR_PALETTE = {
  Malaysia: "#6CC24A",
  Thailand: "#3B82F6",
  Indonesia: "#F59E0B",
  "Vendor A": "#2563EB",
  "Vendor C": "#10B981",
  "In Transit": "#65A30D",
  Default: "#8884d8",
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div
        style={{
          background: "#fff",
          border: "1px solid #eee",
          padding: 10,
          fontSize: "13px",
        }}
      >
        <strong>{label}</strong>
        {payload.map((entry, i) => (
          <div key={i}>
            <span
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                backgroundColor: entry.color,
                marginRight: 6,
              }}
            ></span>
            {entry.name}: {entry.value} MT
          </div>
        ))}
      </div>
    );
  }

  return null;
};

const GraphView = ({
  data = [],
  headers = [],
  chartType = "horizontalBar",
  xKey,
  yKey,
}) => {
  if (!data || data.length === 0 || headers.length < 2 || !xKey || !yKey) {
    return <p>No data to display graphically</p>;
  }

  const isStackedHorizontalBar = chartType === "horizontalBar";

  const barKeys = Object.keys(data[0] || {}).filter((key) => key !== yKey);

  return (
    <div className="w-full h-[400px] bg-white border p-6 rounded-xl">
      <ResponsiveContainer width="100%" height="100%">
        {isStackedHorizontalBar ? (
          <BarChart
            layout="vertical"
            data={data}
            margin={{ top: 10, right: 30, left: 100, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis type="category" dataKey={yKey} />
            <RechartsTooltip content={<CustomTooltip />} />
            <Legend />
            {barKeys.map((key) => (
              <Bar
                key={key}
                dataKey={key}
                stackId="a"
                fill={COLOR_PALETTE[key] || COLOR_PALETTE.Default}
              />
            ))}
          </BarChart>
        ) : (
          <p>Chart type '{chartType}' is not yet supported in this view.</p>
        )}
      </ResponsiveContainer>
    </div>
  );
};

export default GraphView;
