import React, { useState } from "react";
import {
  InventoryReportShell,
  SummaryCardRow,
  formatDate,
  formatQty,
  useInventoryReport,
} from "./reportShared";

const LotSerialReport = () => {
  const [trackingType, setTrackingType] = useState("");
  const [status, setStatus] = useState("");
  const r = useInventoryReport("lots", {
    trackingType: trackingType || undefined,
    status: status || undefined,
  });

  const clearAllFilters = () => {
    setTrackingType("");
    setStatus("");
    r.clearFilters();
  };

  const filters = [
    ...r.filters
      .filter((f) => f.isClearButton || f.placeholder === "Business")
      .map((f) =>
        f.isClearButton
          ? { ...f, buttonProps: { ...f.buttonProps, onClick: clearAllFilters } }
          : f,
      ),
    {
      value: trackingType,
      onChange: (value) => setTrackingType(value || ""),
      placeholder: "Tracking",
      options: [
        { value: "", label: "All tracking" },
        { value: "lot", label: "Lot / batch" },
        { value: "serial", label: "Serial" },
      ],
    },
    {
      value: status,
      onChange: (value) => setStatus(value || ""),
      placeholder: "Status",
      options: [
        { value: "", label: "All statuses" },
        { value: "available", label: "Available" },
        { value: "reserved", label: "Reserved" },
        { value: "delivered", label: "Delivered" },
        { value: "scrapped", label: "Scrapped" },
        { value: "returned", label: "Returned" },
      ],
    },
  ];

  return (
    <InventoryReportShell
      title="Lot / Serial Tracking"
      description="Registry of lots and serials with on-hand quantity and status."
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
        "Lot / Serial",
        "Type",
        "Item",
        "Status",
        "On hand",
        "Warehouse",
        "Location",
        "Expiry",
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
          cards={[{ label: "Lots / serials", value: r.totals?.lotCount ?? "—" }]}
        />
      }
      searchPlaceholder="Search lot, serial, item…"
      renderRow={(row) => (
        <tr key={row._id} className="border-b" style={{ fontSize: "14px" }}>
          <td className="py-2 px-4 font-mono text-xs">{row.name}</td>
          <td className="py-2 px-4 text-xs">{row.trackingType}</td>
          <td className="py-2 px-4">{row.item?.name || "—"}</td>
          <td className="py-2 px-4 text-xs">{row.status}</td>
          <td className="py-2 px-4 text-right">{formatQty(row.onHandQty)}</td>
          <td className="py-2 px-4">{row.currentWarehouse?.name || "—"}</td>
          <td className="py-2 px-4">{row.currentLocation?.name || "—"}</td>
          <td className="py-2 px-4 text-xs">
            {row.expiryDate ? formatDate(row.expiryDate) || "—" : "—"}
          </td>
        </tr>
      )}
    />
  );
};

export default LotSerialReport;
