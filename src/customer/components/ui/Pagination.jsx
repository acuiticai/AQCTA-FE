import React from "react";

import Combobox from "./Combobox";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";

const PAGE_SIZES = [7, 10, 25, 50];

/**
 * Range summary on the left, page size + page buttons on the right.
 *
 * Windows the page numbers so a long list shows at most `window` buttons around
 * the current page rather than one per page.
 */
export default function Pagination({
  page = 1,
  pageSize = 7,
  total = 0,
  itemLabel = "items",
  onPageChange,
  onPageSizeChange,
  window: windowSize = 3,
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);

  const start = Math.max(1, Math.min(page - Math.floor(windowSize / 2), pageCount - windowSize + 1));
  const pages = Array.from(
    { length: Math.min(windowSize, pageCount) },
    (_, index) => start + index,
  );

  return (
    <div className="epc-pagination">
      <p className="epc-pagination__summary">
        Showing {first}–{last} of {total} {itemLabel}
      </p>

      <div className="epc-pagination__controls">
        <div className="epc-pagination__size">
          <Combobox
            options={PAGE_SIZES.map((size) => ({
              value: String(size),
              label: `${size} per page`,
            }))}
            value={String(pageSize)}
            clearable={false}
            onChange={(next) => onPageSizeChange?.(Number(next))}
          />
        </div>

        <nav className="epc-pager" aria-label="Pagination">
          <button
            type="button"
            className="epc-pager__step"
            disabled={page <= 1}
            aria-label="Previous page"
            onClick={() => onPageChange?.(page - 1)}
          >
            <ChevronLeftIcon size={15} />
          </button>

          {pages.map((entry) => (
            <button
              key={entry}
              type="button"
              className={`epc-pager__page${entry === page ? " is-active" : ""}`}
              aria-current={entry === page ? "page" : undefined}
              onClick={() => onPageChange?.(entry)}
            >
              {entry}
            </button>
          ))}

          <button
            type="button"
            className="epc-pager__step"
            disabled={page >= pageCount}
            aria-label="Next page"
            onClick={() => onPageChange?.(page + 1)}
          >
            <ChevronRightIcon size={15} />
          </button>
        </nav>
      </div>
    </div>
  );
}

/** Slices rows for the current page — kept next to the control that pages them. */
export const paginate = (rows, page, pageSize) =>
  rows.slice((page - 1) * pageSize, page * pageSize);
