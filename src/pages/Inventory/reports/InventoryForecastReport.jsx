import React, { useState } from "react";
import {
  InventoryReportShell,
  SummaryCardRow,
  formatQty,
  useInventoryReport,
} from "./reportShared";

const RISK_STYLES = {
  high: "bg-red-100 text-red-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-green-100 text-green-800",
  unknown: "bg-gray-100 text-gray-700",
};

const DAY_OPTIONS = [
  { value: "7", label: "7 days" },
  { value: "14", label: "14 days" },
  { value: "30", label: "30 days" },
  { value: "60", label: "60 days" },
  { value: "90", label: "90 days" },
];

const InventoryForecastReport = () => {
  const [lookbackDays, setLookbackDays] = useState("30");
  const [forecastDays, setForecastDays] = useState("30");
  const r = useInventoryReport("forecast", {
    lookbackDays,
    forecastDays,
  });

  const clearAllFilters = () => {
    setLookbackDays("30");
    setForecastDays("30");
    r.clearFilters();
  };

  const filters = [
    ...r.filters.map((f) =>
      f.isClearButton
        ? { ...f, buttonProps: { ...f.buttonProps, onClick: clearAllFilters } }
        : f,
    ),
    {
      value: lookbackDays,
      onChange: (value) => setLookbackDays(value || "30"),
      placeholder: "Lookback",
      options: DAY_OPTIONS,
    },
    {
      value: forecastDays,
      onChange: (value) => setForecastDays(value || "30"),
      placeholder: "Forecast",
      options: DAY_OPTIONS,
    },
  ];

  return (
    <InventoryReportShell
      title="Inventory Forecast"
      description="Projected need from recent sales/consumption velocity."
      filters={filters}
      searchTerm={r.searchTerm}
      onSearch={(val) => {
        r.setSearchTerm(val);
        r.fetchRows(r.selectedBusinesses, 1, r.recordsPerPage, val);
        r.setCurrentPage(1);
        r.currentPageRef.current = 1;
      }}
      loading={r.loading}
      headers={[
        "Item",
        "Consumed",
        "Avg / day",
        "On hand",
        "Forecast need",
        "Days cover",
        "Suggested buy",
        "Risk",
      ]}
      rows={r.rows}
      totalResults={r.totalResults}
      recordsPerPage={r.recordsPerPage}
      currentPage={r.currentPage}
      onPageChange={(page) => {
        r.setCurrentPage(page);
        r.currentPageRef.current = page;
        r.fetchRows(r.selectedBusinesses, page, r.recordsPerPage, r.searchTerm);
      }}
      onRecordsPerPageChange={(n) => {
        r.setRecordsPerPage(n);
        r.setCurrentPage(1);
        r.currentPageRef.current = 1;
        r.fetchRows(r.selectedBusinesses, 1, n, r.searchTerm);
      }}
      emptyMessage="No consumption history in the lookback window."
      searchPlaceholder="Search item…"
      summaryCards={
        <SummaryCardRow
          cards={[
            { label: "Items", value: r.totals?.itemCount ?? "—" },
            { label: "High risk", value: r.totals?.highRiskCount ?? "—" },
            {
              label: "Suggested buy",
              value: formatQty(r.totals?.suggestedBuyQty),
            },
          ]}
        />
      }
      renderRow={(row) => (
        <tr key={`${row.businessId}-${row.itemId}`} className="border-b" style={{ fontSize: "14px" }}>
          <td className="py-2 px-4">
            <div>{row.itemName}</div>
            <div className="text-xs text-gray-500 font-mono">{row.itemCode || ""}</div>
          </td>
          <td className="py-2 px-4 text-right">{formatQty(row.consumedQty)}</td>
          <td className="py-2 px-4 text-right">{formatQty(row.avgDailyQty)}</td>
          <td className="py-2 px-4 text-right">{formatQty(row.onHandQty)}</td>
          <td className="py-2 px-4 text-right">{formatQty(row.forecastNeedQty)}</td>
          <td className="py-2 px-4 text-right">
            {row.daysOfCover == null ? "—" : row.daysOfCover}
          </td>
          <td className="py-2 px-4 text-right">{formatQty(row.suggestedBuyQty)}</td>
          <td className="py-2 px-4">
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-semibold ${RISK_STYLES[row.risk] || RISK_STYLES.unknown}`}
            >
              {row.risk}
            </span>
          </td>
        </tr>
      )}
    />
  );
};

export default InventoryForecastReport;
