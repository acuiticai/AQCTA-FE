import { useState } from "react";

// Sorting utility functions
export const sortData = (data, sortKey, sortDirection) => {
  if (!data || !Array.isArray(data)) return data;

  return [...data].sort((a, b) => {
    let aValue = a[sortKey];
    let bValue = b[sortKey];

    // Handle null/undefined values
    if (aValue == null && bValue == null) return 0;
    if (aValue == null) return sortDirection === "asc" ? 1 : -1;
    if (bValue == null) return sortDirection === "asc" ? -1 : 1;

    // Convert to string for comparison if not already
    if (typeof aValue !== "string") aValue = String(aValue);
    if (typeof bValue !== "string") bValue = String(bValue);

    // Case-insensitive comparison
    aValue = aValue.toLowerCase();
    bValue = bValue.toLowerCase();

    if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });
};

// Custom hook for table sorting
export const useTableSorting = (initialData = []) => {
  const [sortKey, setSortKey] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc");

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const sortedData = sortData(initialData, sortKey, sortDirection);

  return {
    sortedData,
    sortKey,
    sortDirection,
    handleSort,
  };
};

// Sort icon component
export const SortIcon = ({ sortKey, currentSortKey, sortDirection }) => {
  if (sortKey !== currentSortKey) {
    return (
      <svg
        className="w-4 h-4 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
        />
      </svg>
    );
  }

  return sortDirection === "asc" ? (
    <svg
      className="w-4 h-4 text-gray-600"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 15l7-7 7 7"
      />
    </svg>
  ) : (
    <svg
      className="w-4 h-4 text-gray-600"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 9l-7 7-7-7"
      />
    </svg>
  );
};
