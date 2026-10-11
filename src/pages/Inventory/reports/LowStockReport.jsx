import React from "react";
import {
  InventoryReportShell,
  SummaryCardRow,
  formatQty,
  useInventoryReport,
} from "./reportShared";

const LowStockReport = () => {
  const r = useInventoryReport("low-stock");

  return (
    <InventoryReportShell
      title="Low Stock Report"
      description="Items at or below reorder level that need replenishment."
      searchPlaceholder="Search item…"
      filters={r.filters}
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
        "Code",
        "Warehouse",
        "On hand",
        "Reorder level",
        "Suggested qty",
        "Source",
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
      emptyMessage="No low-stock items. Configure reordering rules or item reorder levels."
      summaryCards={
        <SummaryCardRow
          cards={[
            { label: "Low stock items", value: r.totals?.lowStockCount ?? "—" },
            {
              label: "Suggested order qty",
              value: formatQty(r.totals?.suggestedOrderQty),
            },
          ]}
        />
      }
      renderRow={(row) => (
        <tr
          key={`${row.ruleId || row._id}-${row.warehouse?._id || "c"}`}
          className="border-b"
          style={{ fontSize: "14px" }}
        >
          <td className="py-2 px-4">{row.name || "—"}</td>
          <td className="py-2 px-4 font-mono text-xs">{row.itemCode || "—"}</td>
          <td className="py-2 px-4">{row.warehouse?.name || "Company-wide"}</td>
          <td className="py-2 px-4 text-right text-amber-700 font-medium">
            {formatQty(row.currentStock)}
          </td>
          <td className="py-2 px-4 text-right">{formatQty(row.reorderLevel)}</td>
          <td className="py-2 px-4 text-right">{formatQty(row.suggestedOrderQty)}</td>
          <td className="py-2 px-4 text-xs">{row.source || "—"}</td>
        </tr>
      )}
    />
  );
};

export default LowStockReport;
