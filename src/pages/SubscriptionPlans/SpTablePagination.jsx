import React, { useMemo } from "react";

const navBtnStyle = {
  padding: "6px 12px",
  borderRadius: "6px",
  backgroundColor: "white",
  color: "#000",
  border: "1px solid #e5e7eb",
  cursor: "pointer",
};

/**
 * Same pagination chrome as customer invoice DataTable:
 * Show [N] entries of total · « ‹ 1 2 3 › »
 */
const SpTablePagination = ({
  currentPage = 1,
  totalRecords = 0,
  recordsPerPage = 10,
  onPageChange,
  onRecordsPerPageChange,
  pageSizeOptions = [5, 10, 25, 50],
}) => {
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(Number(totalRecords || 0) / recordsPerPage)),
    [totalRecords, recordsPerPage],
  );

  const pageNumbers = useMemo(() => {
    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    const endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
    if (endPage - startPage + 1 < maxPagesToShow) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }
    const pages = [];
    for (let i = startPage; i <= endPage; i += 1) pages.push(i);
    return { pages, startPage, endPage };
  }, [currentPage, totalPages]);

  if (!totalRecords) return null;

  return (
    <div className="sp-table-pagination">
      <div className="sp-table-pagination__meta">
        <span>Show</span>
        <div className="sp-table-pagination__select-wrap">
          <select
            value={recordsPerPage}
            onChange={(e) =>
              onRecordsPerPageChange?.(Number(e.target.value))
            }
            aria-label="Records per page"
          >
            {pageSizeOptions.map((num) => (
              <option key={num} value={num}>
                {num}
              </option>
            ))}
          </select>
        </div>
        <span>
          entries of {totalRecords}
        </span>
      </div>

      <div className="sp-table-pagination__pages">
        <button
          type="button"
          style={navBtnStyle}
          disabled={currentPage === 1}
          onClick={() => onPageChange?.(1)}
        >
          «
        </button>
        <button
          type="button"
          style={navBtnStyle}
          disabled={currentPage === 1}
          onClick={() => onPageChange?.(currentPage - 1)}
        >
          ‹
        </button>

        {pageNumbers.pages.map((number) => (
          <button
            key={number}
            type="button"
            onClick={() => onPageChange?.(number)}
            style={{
              padding: "6px 12px",
              borderRadius: "6px",
              backgroundColor:
                currentPage === number ? "var(--p-blue)" : "white",
              color: currentPage === number ? "white" : "#000",
              border: currentPage === number ? "none" : "1px solid #e5e7eb",
              cursor: "pointer",
            }}
          >
            {number}
          </button>
        ))}

        {totalPages > pageNumbers.endPage ? (
          <>
            <span style={{ padding: "0 4px" }}>…</span>
            <button
              type="button"
              style={navBtnStyle}
              onClick={() => onPageChange?.(totalPages)}
            >
              {totalPages}
            </button>
          </>
        ) : null}

        <button
          type="button"
          style={navBtnStyle}
          disabled={currentPage === totalPages || totalPages <= 1}
          onClick={() => onPageChange?.(currentPage + 1)}
        >
          ›
        </button>
        <button
          type="button"
          style={navBtnStyle}
          disabled={currentPage === totalPages || totalPages <= 1}
          onClick={() => onPageChange?.(totalPages)}
        >
          »
        </button>
      </div>
    </div>
  );
};

export default SpTablePagination;
