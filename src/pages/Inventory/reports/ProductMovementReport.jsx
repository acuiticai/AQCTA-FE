import React, { useState } from "react";
import { DateRangeComponent } from "@/page-layouts/index";
import {
  InventoryReportShell,
  SummaryCardRow,
  formatDate,
  formatQty,
  useInventoryReport,
} from "./reportShared";

const TYPE_OPTIONS = [
  { value: "", label: "All types" },
  { value: "purchase_received", label: "Purchase received" },
  { value: "sale_delivery", label: "Sale delivery" },
  { value: "sale_consumption", label: "Sale consumption" },
  { value: "adjustment", label: "Adjustment" },
  { value: "internal_transfer", label: "Internal transfer" },
];

const ProductMovementReport = () => {
  const [type, setType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const r = useInventoryReport("movements", {
    type: type || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const clearAllFilters = () => {
    setType("");
    setDateFrom("");
    setDateTo("");
    r.clearFilters();
  };

  const filters = [
    ...r.filters.map((f) =>
      f.isClearButton
        ? { ...f, buttonProps: { ...f.buttonProps, onClick: clearAllFilters } }
        : f,
    ),
    {
      value: type,
      onChange: (value) => setType(value || ""),
      placeholder: "Type",
      options: TYPE_OPTIONS,
    },
  ];

  return (
    <InventoryReportShell
      title="Product Movement History"
      description="Inbound and outbound stock movements across locations."
      filters={filters}
      searchTerm={r.searchTerm}
      searchPlaceholder="Search item, lot, warehouse…"
      onSearch={(val) => {
        r.setSearchTerm(val);
        r.fetchRows(r.selectedBusinesses, 1, r.recordsPerPage, val);
        r.setCurrentPage(1);
        r.currentPageRef.current = 1;
      }}
      loading={r.loading}
      headers={["Date", "Item", "Type", "Qty", "Warehouse", "Location", "Lot", "Ref"]}
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
      actions={
        <DateRangeComponent
          startDate={dateFrom}
          endDate={dateTo}
          onApply={(start, end) => {
            setDateFrom(start || "");
            setDateTo(end || "");
          }}
          onClear={() => {
            setDateFrom("");
            setDateTo("");
          }}
        />
      }
      summaryCards={
        <SummaryCardRow
          cards={[
            { label: "Movements", value: r.totals?.movementCount ?? "—" },
            { label: "Inbound", value: formatQty(r.totals?.inboundQty) },
            { label: "Outbound", value: formatQty(r.totals?.outboundQty) },
          ]}
        />
      }
      renderRow={(row) => (
        <tr key={row._id} className="border-b" style={{ fontSize: "14px" }}>
          <td className="py-2 px-4 whitespace-nowrap">
            {row.createdAt ? formatDate(row.createdAt, false, true) || "—" : "—"}
          </td>
          <td className="py-2 px-4">{row.item?.name || "—"}</td>
          <td className="py-2 px-4 text-xs">{row.type}</td>
          <td
            className={`py-2 px-4 text-right ${
              (row.quantity || 0) < 0 ? "text-red-600" : "text-green-700"
            }`}
          >
            {formatQty(row.quantity)}
          </td>
          <td className="py-2 px-4">{row.warehouse?.name || "—"}</td>
          <td className="py-2 px-4">{row.location?.name || "—"}</td>
          <td className="py-2 px-4 font-mono text-xs">{row.lotNumber || "—"}</td>
          <td className="py-2 px-4 text-xs">
            {row.referenceType || "—"}
          </td>
        </tr>
      )}
    />
  );
};

export default ProductMovementReport;
