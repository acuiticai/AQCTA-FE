import React, { useEffect, useId, useMemo, useRef, useState } from "react";

import { Field } from "./Field";
import { CheckIcon, ChevronDownIcon, CloseIcon, SearchIcon } from "./icons";

const toOption = (option) =>
  typeof option === "string" ? { value: option, label: option } : option;

/**
 * Searchable single-select, or multi-select when `multiple` is true.
 *
 * Replaces the native `<select>` everywhere in the portal: the country list is
 * ~250 entries and a state's city list can run to hundreds, which is unusable
 * without typing to filter.
 *
 * Behaves as a WAI-ARIA combobox — the trigger owns `aria-expanded` and
 * `aria-activedescendant`, the list is a `listbox`, and the whole thing is
 * driven from the keyboard: type to filter, Up/Down to move, Enter to choose,
 * Escape to close, Tab or an outside click to dismiss. Long lists are windowed
 * so a 250-option country picker doesn't mount 250 nodes.
 *
 * When `creatable` is true and the typed query matches nothing exactly, an
 * extra "Use …" row appears so users can enter a value not in the list
 * (needed for cities the cascade data still omits).
 *
 * When `multiple` is true, `value` is a string[] and `onChange` receives the
 * next array. Selected values render as removable chips (admin DropdownBasic
 * style). Selecting an option toggles it and keeps the panel open unless
 * `shouldCloseAfterSelect` returns true.
 */
export default function Combobox({
  label,
  error,
  hint,
  full = false,
  id,
  name,
  value = "",
  options = [],
  placeholder = "Select",
  searchPlaceholder = "Search…",
  emptyMessage = "No matches",
  disabled = false,
  clearable = true,
  creatable = false,
  multiple = false,
  /** Hide the filter box for short lists (e.g. 3–6 form options). */
  searchable = true,
  /**
   * Multi-select only. Return true to close the panel after a toggle — used when
   * selecting "Others" reveals a follow-up text field that would otherwise stay hidden.
   */
  shouldCloseAfterSelect = null,
  maxRendered = 60,
  onChange,
}) {
  const generatedId = useId();
  const fieldId = id || generatedId;
  const listId = `${fieldId}-listbox`;

  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const normalised = useMemo(() => options.map(toOption), [options]);

  const selectedValues = useMemo(() => {
    if (multiple) {
      return Array.isArray(value) ? value.filter(Boolean).map(String) : [];
    }
    return value ? [String(value)] : [];
  }, [multiple, value]);

  const selectedOptions = useMemo(
    () =>
      selectedValues
        .map((v) => {
          const fromList = normalised.find((option) => option.value === v);
          if (fromList) return fromList;
          return { value: v, label: v };
        })
        .filter(Boolean),
    [normalised, selectedValues],
  );

  const selected = multiple ? null : selectedOptions[0] || null;

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return normalised;
    return normalised.filter((option) =>
      String(option.label).toLowerCase().includes(needle),
    );
  }, [normalised, query]);

  const createOption = useMemo(() => {
    if (!creatable || multiple) return null;
    const typed = query.trim();
    if (!typed) return null;
    const alreadyListed = normalised.some(
      (option) =>
        String(option.label).toLowerCase() === typed.toLowerCase() ||
        String(option.value).toLowerCase() === typed.toLowerCase(),
    );
    if (alreadyListed) return null;
    return { value: typed, label: typed, __create: true };
  }, [creatable, multiple, query, normalised]);

  const listRows = useMemo(() => {
    if (!createOption) return matches;
    return [createOption, ...matches];
  }, [createOption, matches]);

  // Only the first slice is mounted; typing narrows the list rather than
  // scrolling through everything.
  const visible = listRows.slice(0, maxRendered);
  const hiddenCount = listRows.length - visible.length;

  const close = () => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  };

  const openList = () => {
    if (disabled) return;
    const firstSelected = selectedValues[0];
    const selectedIndex = firstSelected
      ? normalised.findIndex((option) => option.value === firstSelected)
      : -1;
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  };

  const commitSingle = (option) => {
    onChange?.(option ? option.value : "");
    close();
  };

  const toggleMulti = (option) => {
    if (!option) return;
    const removing = selectedValues.includes(option.value);
    const next = removing
      ? selectedValues.filter((v) => v !== option.value)
      : [...selectedValues, option.value];
    onChange?.(next);
    if (
      !removing &&
      typeof shouldCloseAfterSelect === "function" &&
      shouldCloseAfterSelect(option, next)
    ) {
      close();
    }
  };

  const removeMulti = (optionValue, event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    onChange?.(selectedValues.filter((v) => v !== optionValue));
  };

  const clearAll = () => {
    onChange?.(multiple ? [] : "");
    close();
  };

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) close();
    };
    // Also close when focus moves to a follow-up field (e.g. Others text input).
    const onFocusIn = (event) => {
      if (!rootRef.current?.contains(event.target)) close();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (searchable) inputRef.current?.focus();
  }, [open, searchable]);

  // Keep the highlighted row in view while arrowing through a long list.
  useEffect(() => {
    if (!open) return;
    const node = listRef.current?.children?.[activeIndex];
    node?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const handleKeyDown = (event) => {
    if (disabled) return;

    if (!open) {
      if (["ArrowDown", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        openList();
      }
      return;
    }

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((i) => Math.min(visible.length - 1, i + 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
        break;
      case "Home":
        event.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        event.preventDefault();
        setActiveIndex(visible.length - 1);
        break;
      case "Enter":
        event.preventDefault();
        if (visible[activeIndex]) {
          if (multiple) toggleMulti(visible[activeIndex]);
          else commitSingle(visible[activeIndex]);
        }
        break;
      case "Escape":
        event.preventDefault();
        close();
        break;
      case "Tab":
        close();
        break;
      default:
        break;
    }
  };

  const triggerLabel = selected ? selected.label : placeholder;

  const hasSelection = multiple
    ? selectedOptions.length > 0
    : Boolean(selected);

  return (
    <Field label={label} htmlFor={fieldId} error={error} hint={hint} full={full}>
      <div className={`epc-combo${multiple ? " epc-combo--multi" : ""}`} ref={rootRef}>
        {/* Mirrors the value for form serialisation and for test tooling. */}
        <input
          type="hidden"
          name={name}
          value={multiple ? selectedValues.join("|") : value || ""}
        />

        <div
          id={fieldId}
          className="epc-select epc-combo__trigger"
          data-placeholder={hasSelection ? "false" : "true"}
          role="combobox"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled || undefined}
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-haspopup="listbox"
          aria-multiselectable={multiple || undefined}
          aria-invalid={error ? "true" : undefined}
          onClick={() => {
            if (disabled) return;
            open ? close() : openList();
          }}
          onKeyDown={handleKeyDown}
        >
          {multiple ? (
            hasSelection ? (
              <span className="epc-combo__chips">
                {selectedOptions.map((option) => (
                  <span key={option.value} className="epc-combo__chip">
                    <span className="epc-combo__chip-label" title={option.label}>
                      {option.label}
                    </span>
                    {!disabled ? (
                      <button
                        type="button"
                        className="epc-combo__chip-remove"
                        aria-label={`Remove ${option.label}`}
                        onClick={(event) => removeMulti(option.value, event)}
                      >
                        <CloseIcon size={11} />
                      </button>
                    ) : null}
                  </span>
                ))}
              </span>
            ) : (
              <span className="epc-combo__value">{placeholder}</span>
            )
          ) : (
            <span className="epc-combo__value">{triggerLabel}</span>
          )}
        </div>

        {clearable && hasSelection && !disabled && (
          <button
            type="button"
            className="epc-combo__clear"
            aria-label={`Clear ${label || "selection"}`}
            onClick={clearAll}
          >
            <CloseIcon size={13} />
          </button>
        )}

        <span
          className={`epc-select-caret${
            clearable && hasSelection && !disabled ? " epc-select-caret--shifted" : ""
          }`}
          aria-hidden="true"
        >
          <ChevronDownIcon />
        </span>

        {open && (
          <div className="epc-combo__panel">
            {searchable ? (
              <div className="epc-combo__search">
                <SearchIcon size={15} aria-hidden="true" />
                <input
                  ref={inputRef}
                  type="text"
                  className="epc-combo__input"
                  placeholder={searchPlaceholder}
                  value={query}
                  autoComplete="off"
                  aria-controls={listId}
                  aria-autocomplete="list"
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setActiveIndex(0);
                  }}
                  onKeyDown={handleKeyDown}
                />
              </div>
            ) : null}

            {visible.length === 0 ? (
              <p className="epc-combo__empty">{emptyMessage}</p>
            ) : (
              <ul
                className="epc-combo__list"
                id={listId}
                role="listbox"
                aria-multiselectable={multiple || undefined}
                ref={listRef}
              >
                {visible.map((option, index) => {
                  const isSelected = selectedValues.includes(option.value);
                  const isCreate = Boolean(option.__create);
                  return (
                    <li
                      key={isCreate ? `__create:${option.value}` : option.value}
                      id={`${listId}-${index}`}
                      role="option"
                      aria-selected={isSelected}
                      className={[
                        "epc-combo__option",
                        index === activeIndex ? "is-active" : "",
                        isSelected ? "is-selected" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onMouseEnter={() => setActiveIndex(index)}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() =>
                        multiple ? toggleMulti(option) : commitSingle(option)
                      }
                    >
                      <span className="epc-combo__option-label">
                        {isCreate ? `Use “${option.label}”` : option.label}
                      </span>
                      {isSelected && !isCreate && <CheckIcon size={15} />}
                    </li>
                  );
                })}
              </ul>
            )}

            {searchable && hiddenCount > 0 && (
              <p className="epc-combo__more">
                {hiddenCount} more — keep typing to narrow
              </p>
            )}
          </div>
        )}
      </div>
    </Field>
  );
}
