import React from "react";

import Combobox from "./Combobox";
import { SearchIcon } from "./icons";

/**
 * Search box + dropdown filters + reset, in one row above a list.
 *
 * `filters` is `[{ key, placeholder, options }]`, so a module declares what it
 * filters on and gets the layout, the reset behaviour and the empty-state
 * wiring for free.
 */
export default function FilterBar({
  title = "Filters",
  subtitle,
  searchValue = "",
  searchPlaceholder = "Search…",
  onSearchChange,
  filters = [],
  values = {},
  onChange,
  onReset,
}) {
  const isDirty =
    Boolean(searchValue) || filters.some((filter) => values[filter.key]);

  return (
    <section className="epc-card-panel epc-filters">
      <header className="epc-card-head">
        <div className="epc-card-head__text">
          <h2 className="epc-card-head__title">{title}</h2>
          {subtitle && <p className="epc-card-head__subtitle">{subtitle}</p>}
        </div>
      </header>

      <div className="epc-filters__row">
        <label className="epc-search">
          <SearchIcon size={16} aria-hidden="true" />
          <input
            type="search"
            className="epc-search__input"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(event) => onSearchChange?.(event.target.value)}
          />
          <span className="epc-visually-hidden">{searchPlaceholder}</span>
        </label>

        {filters.map((filter) => (
          <div className="epc-filters__control" key={filter.key}>
            <Combobox
              placeholder={filter.placeholder}
              options={filter.options}
              value={values[filter.key] || ""}
              clearable={false}
              onChange={(next) => onChange?.(filter.key, next)}
            />
          </div>
        ))}

        <button
          type="button"
          className="epc-filters__reset"
          onClick={onReset}
          disabled={!isDirty}
        >
          Reset
        </button>
      </div>
    </section>
  );
}
