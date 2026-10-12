import React, { useMemo, useState } from "react";

/**
 * Column-driven table shared by every list panel in the portal.
 *
 * columns: [{ key, header, width?, align?, render?(row) }]
 * rows:    any[] — `rowKey` picks the identity field (defaults to `id`)
 *
 * Selection is optional and uncontrolled by default; pass `selected` +
 * `onSelectionChange` to lift it. Keeping it here means a new module gets
 * header-checkbox, indeterminate state and row toggling for free.
 */
export default function DataTable({
  columns,
  rows,
  rowKey = "id",
  selectable = false,
  selected,
  onSelectionChange,
  emptyMessage = "Nothing to show yet.",
}) {
  const [internal, setInternal] = useState([]);
  const isControlled = Array.isArray(selected);
  const selection = isControlled ? selected : internal;

  const resolveKey = (row, index) => {
    if (typeof rowKey === "function") return rowKey(row, index);
    return row?.[rowKey] ?? index;
  };

  const setSelection = (next) => {
    if (!isControlled) setInternal(next);
    onSelectionChange?.(next);
  };

  const keys = useMemo(
    () => rows.map((row, index) => resolveKey(row, index)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, rowKey],
  );
  const allSelected = keys.length > 0 && keys.every((k) => selection.includes(k));
  const someSelected = selection.length > 0 && !allSelected;

  const toggleRow = (key) =>
    setSelection(
      selection.includes(key)
        ? selection.filter((k) => k !== key)
        : [...selection, key],
    );

  if (!rows.length) {
    return <p className="epc-table-empty">{emptyMessage}</p>;
  }

  return (
    <div className="epc-table-wrap">
      <table className="epc-table">
        <thead>
          <tr>
            {selectable && (
              <th className="epc-table__check">
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={() => setSelection(allSelected ? [] : keys)}
                  label="Select all rows"
                />
              </th>
            )}
            {columns.map((column) => (
              <th
                key={column.key}
                style={{
                  width: column.width,
                  textAlign: column.align || "left",
                }}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const key = resolveKey(row, index);
            const isSelected = selection.includes(key);
            return (
              <tr key={key} className={isSelected ? "is-selected" : undefined}>
                {selectable && (
                  <td className="epc-table__check">
                    <Checkbox
                      checked={isSelected}
                      onChange={() => toggleRow(key)}
                      label={`Select ${key}`}
                    />
                  </td>
                )}
                {columns.map((column) => (
                  <td
                    key={column.key}
                    style={{ textAlign: column.align || "left" }}
                  >
                    {column.render ? column.render(row) : row[column.key]}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function Checkbox({ checked, indeterminate = false, onChange, label }) {
  return (
    <label className="epc-checkbox">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        ref={(node) => {
          if (node) node.indeterminate = indeterminate;
        }}
      />
      <span className="epc-checkbox__box" aria-hidden="true" />
      <span className="epc-visually-hidden">{label}</span>
    </label>
  );
}
