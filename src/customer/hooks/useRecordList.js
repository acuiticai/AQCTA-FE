import { useMemo, useState } from "react";

/**
 * Search + filter + paginate for a portal list screen.
 *
 * `searchFields` names the row keys the search box matches against, and
 * `filterFields` maps a filter key to the row key it narrows. Both list modules
 * use this, so paging and reset behave identically without either owning the
 * logic.
 */
export default function useRecordList({
  rows,
  searchFields = [],
  filterFields = {},
  initialPageSize = 7,
}) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesSearch =
        !needle ||
        searchFields.some((field) =>
          String(row[field] || "").toLowerCase().includes(needle),
        );
      if (!matchesSearch) return false;

      return Object.entries(filters).every(([key, value]) => {
        if (!value) return true;
        const rowKey = filterFields[key];
        // A filter with no mapped row key (e.g. a date range) is handled by the
        // caller and ignored here rather than silently dropping every row.
        if (!rowKey) return true;
        return String(row[rowKey] || "") === value;
      });
    });
  }, [rows, search, filters, searchFields, filterFields]);

  // Deleting or filtering can strand the viewer past the last page.
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const setFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const reset = () => {
    setSearch("");
    setFilters({});
    setPage(1);
  };

  return {
    search,
    setSearch: (value) => {
      setSearch(value);
      setPage(1);
    },
    filters,
    setFilter,
    reset,
    page: safePage,
    setPage,
    pageSize,
    setPageSize: (value) => {
      setPageSize(value);
      setPage(1);
    },
    total: filtered.length,
    rows: visible,
  };
}
