import React from "react";
import {
  InventoryReportShell,
  SummaryCardRow,
  formatMoney,
  formatQty,
  useInventoryReport,
} from "./reportShared";

const CurrentStockReport = () => {
  const r = useInventoryReport("current-stock");

  return (
    <InventoryReportShell
      title="Current Stock Report"
      description="On-hand quantity by warehouse, location, and lot."
      searchPlaceholder="Search product, lot, warehouse…"
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
        "Location",
        "Lot",
        "Qty",
        "Unit cost",
        "Value",
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
      summaryCards={
        <SummaryCardRow
          cards={[
            { label: "Lines", value: r.totals?.lineCount ?? "—" },
            { label: "Total qty", value: formatQty(r.totals?.quantity) },
            { label: "Total value", value: formatMoney(r.totals?.value) },
          ]}
        />
      }
      renderRow={(row) => (
        <tr key={row._id} className="border-b" style={{ fontSize: "14px" }}>
          <td className="py-2 px-4">{row.item?.name || "—"}</td>
          <td className="py-2 px-4 font-mono text-xs">{row.item?.itemCode || "—"}</td>
          <td className="py-2 px-4">{row.warehouse?.name || "—"}</td>
          <td className="py-2 px-4">{row.location?.name || "—"}</td>
          <td className="py-2 px-4 font-mono text-xs">{row.lotNumber || "—"}</td>
          <td className="py-2 px-4 text-right">{formatQty(row.quantity)}</td>
          <td className="py-2 px-4 text-right">{formatMoney(row.unitCost)}</td>
          <td className="py-2 px-4 text-right">{formatMoney(row.value)}</td>
        </tr>
      )}
    />
  );
};

export default CurrentStockReport;
