import React from "react";
import {
  InventoryReportShell,
  SummaryCardRow,
  formatMoney,
  formatQty,
  useInventoryReport,
} from "./reportShared";

const StockAgingReport = () => {
  const r = useInventoryReport("aging");
  const s = r.summary || {};

  return (
    <InventoryReportShell
      title="Stock Aging"
      description="Age of on-hand stock since quant creation (receipt / layer)."
      searchPlaceholder="Search item, lot, warehouse…"
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
        "Warehouse",
        "Location",
        "Lot",
        "Qty",
        "Value",
        "Age (days)",
        "Bucket",
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
          cards={["0-30", "31-60", "61-90", "90+"].map((b) => ({
            label: `${b} days`,
            value: `${formatQty(s[b]?.qty)} / ${formatMoney(s[b]?.value)}`,
          }))}
        />
      }
      renderRow={(row) => (
        <tr key={row._id} className="border-b" style={{ fontSize: "14px" }}>
          <td className="py-2 px-4">{row.item?.name || "—"}</td>
          <td className="py-2 px-4">{row.warehouse?.name || "—"}</td>
          <td className="py-2 px-4">{row.location?.name || "—"}</td>
          <td className="py-2 px-4 font-mono text-xs">{row.lotNumber || "—"}</td>
          <td className="py-2 px-4 text-right">{formatQty(row.quantity)}</td>
          <td className="py-2 px-4 text-right">{formatMoney(row.value)}</td>
          <td className="py-2 px-4 text-right">{row.ageDays}</td>
          <td className="py-2 px-4">
            <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100">
              {row.bucket}
            </span>
          </td>
        </tr>
      )}
    />
  );
};

export default StockAgingReport;
