import React, { useState } from "react";
import {
  InventoryReportShell,
  SummaryCardRow,
  formatMoney,
  formatQty,
  useInventoryReport,
} from "./reportShared";

const DAY_OPTIONS = [
  { value: "7", label: "7 days" },
  { value: "14", label: "14 days" },
  { value: "30", label: "30 days" },
  { value: "60", label: "60 days" },
  { value: "90", label: "90 days" },
];

const WarehousePerformanceReport = () => {
  const [days, setDays] = useState("30");
  const r = useInventoryReport("warehouse-performance", { days });

  const clearAllFilters = () => {
    setDays("30");
    r.clearFilters();
  };

  const filters = [
    ...r.filters.map((f) =>
      f.isClearButton
        ? { ...f, buttonProps: { ...f.buttonProps, onClick: clearAllFilters } }
        : f,
    ),
    {
      value: days,
      onChange: (value) => setDays(value || "30"),
      placeholder: "Period",
      options: DAY_OPTIONS,
    },
  ];

  return (
    <InventoryReportShell
      title="Warehouse Performance"
      description="Throughput, turnover, receipts and sales by warehouse."
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
        "Warehouse",
        "Movements",
        "Inbound",
        "Outbound",
        "On hand",
        "Value",
        "SKUs",
        "Turnover",
        "Adj / Xfer",
      ]}
      rows={r.rows}
      totalResults={r.totalResults || r.rows.length}
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
      emptyMessage="No warehouse activity in this period."
      searchPlaceholder="Search warehouse…"
      summaryCards={
        <SummaryCardRow
          cards={[
            { label: "Warehouses", value: r.totals?.warehouseCount ?? "—" },
            { label: "Movements", value: r.totals?.movementCount ?? "—" },
            { label: "Inbound", value: formatQty(r.totals?.inboundQty) },
            { label: "Outbound", value: formatQty(r.totals?.outboundQty) },
          ]}
        />
      }
      renderRow={(row) => (
        <tr key={row.warehouseId || row.warehouseName} className="border-b" style={{ fontSize: "14px" }}>
          <td className="py-2 px-4">
            <div>{row.warehouseName}</div>
            <div className="text-xs text-gray-500">{row.warehouseCode}</div>
          </td>
          <td className="py-2 px-4 text-right">{row.movementCount}</td>
          <td className="py-2 px-4 text-right">{formatQty(row.inboundQty)}</td>
          <td className="py-2 px-4 text-right">{formatQty(row.outboundQty)}</td>
          <td className="py-2 px-4 text-right">{formatQty(row.onHandQty)}</td>
          <td className="py-2 px-4 text-right">{formatMoney(row.onHandValue)}</td>
          <td className="py-2 px-4 text-right">{row.skuCount}</td>
          <td className="py-2 px-4 text-right">
            {row.turnoverRatio == null ? "—" : row.turnoverRatio}
          </td>
          <td className="py-2 px-4 text-right text-xs">
            {row.adjustmentCount} / {row.transferCount}
          </td>
        </tr>
      )}
    />
  );
};

export default WarehousePerformanceReport;
