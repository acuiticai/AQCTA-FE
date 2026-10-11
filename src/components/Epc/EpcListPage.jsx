import React from "react";

import { EpcPage } from "./EpcSurface";
import { Card, CardHeader } from "@/customer/components/ui/Card";
import DataTable from "@/customer/components/ui/DataTable";
import StatCard from "@/customer/components/ui/StatCard";
import FilterBar from "@/customer/components/ui/FilterBar";
import Pagination from "@/customer/components/ui/Pagination";

/**
 * The shape every certification list screen takes.
 *
 * Four of them exist — costing sheets, quotations, invoices, projects — and
 * they differ only in their columns and their figures. Keeping the frame in
 * one place is what makes them read as one product rather than four screens
 * that happen to sit near each other.
 *
 * @param {object[]} stats    tiles above the table
 * @param {object[]} filters  FilterBar definitions, keyed by `key`
 * @param {object[]} columns  DataTable columns
 */
export default function EpcListPage({
  title,
  subtitle,
  action,
  stats = [],
  searchValue,
  searchPlaceholder,
  onSearchChange,
  filters = [],
  filterValues = {},
  onFilterChange,
  onFilterReset,
  tableTitle,
  tableSubtitle,
  columns,
  rows,
  rowKey = "_id",
  loading = false,
  emptyMessage = "Nothing to show yet.",
  page = 1,
  pageSize = 20,
  total = 0,
  itemLabel = "records",
  onPageChange,
  onPageSizeChange,
  children,
}) {
  return (
    <EpcPage title={title} subtitle={subtitle} action={action}>
      <div className="epc-stack">
        {stats.length ? (
          <div className="epc-statgrid">
            {stats.map((stat) => (
              <StatCard key={stat.label} {...stat} />
            ))}
          </div>
        ) : null}

        {filters.length || onSearchChange ? (
          <FilterBar
            title="Find"
            searchValue={searchValue}
            searchPlaceholder={searchPlaceholder}
            onSearchChange={onSearchChange}
            filters={filters}
            values={filterValues}
            onChange={onFilterChange}
            onReset={onFilterReset}
          />
        ) : null}

        <Card>
          <CardHeader
            title={tableTitle || title}
            subtitle={
              loading
                ? "Loading…"
                : tableSubtitle ||
                  `${total} ${total === 1 ? itemLabel.replace(/s$/, "") : itemLabel}`
            }
          />

          {loading ? (
            <p className="epc-table-empty">Loading…</p>
          ) : (
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={rowKey}
              emptyMessage={emptyMessage}
            />
          )}

          {!loading && total > 0 ? (
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              itemLabel={itemLabel}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
            />
          ) : null}
        </Card>

        {children}
      </div>
    </EpcPage>
  );
}
