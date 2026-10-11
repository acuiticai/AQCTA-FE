import React, { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search, X } from "lucide-react";
import { sortAlphabetically } from "@/utils/sortAlphabetically";

const SearchableDropdown = ({
  options = [],
  value = "",
  onChange,
  placeholder = "Select an option",
  searchPlaceholder = "Search...",
  disabled = false,
  loading = false,
  loadingText = "Loading...",
  className = "",
  name = "",
  displayKey = "label",
  valueKey = "value",
  searchKeys = ["label"], // Array of keys to search in
  renderOption = null, // Custom render function for options
  renderSelected = null, // Custom render function for selected value
  clearable = false,
  onClear = null,
  dropdownFooter = null, // Optional content below options (e.g. "Add term" button)
  /** When true, options are ordered A→Z by `sortKey` (case-insensitive). Set false to preserve caller order. */
  alphabeticalSort = true,
  /** Primary field for alphabetical order; defaults to `name` with fallback to `label` in sortAlphabetically. */
  sortKey = "name",
  /** Optional controlled open state (e.g. close menu before opening a sibling modal). */
  isOpen: controlledIsOpen,
  onOpenChange,
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen;
  const setIsOpen = (next) => {
    const value = typeof next === "function" ? next(isOpen) : next;
    if (!isControlled) setInternalIsOpen(value);
    onOpenChange?.(value);
  };
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isPanelHiddenByScroll, setIsPanelHiddenByScroll] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
  });
  const [dropdownMaxHeight, setDropdownMaxHeight] = useState(320);
  const dropdownRef = useRef(null);
  const dropdownMenuRef = useRef(null);
  const buttonRef = useRef(null);
  const searchInputRef = useRef(null);

  const processedOptions = useMemo(() => {
    if (!alphabeticalSort) return options;
    return sortAlphabetically(options, sortKey);
  }, [options, alphabeticalSort, sortKey]);

  // Filter options based on search term
  const filteredOptions = processedOptions.filter((option) => {
    if (!searchTerm) return true;

    const searchLower = searchTerm.toLowerCase();
    return searchKeys.some((key) => {
      const value = option[key];
      return value && value.toString().toLowerCase().includes(searchLower);
    });
  });

  // Find selected option
  const selectedOption = processedOptions.find((option) => option[valueKey] === value);

  // Handle option selection
  const handleSelect = (option) => {
    const selectedValue = option[valueKey];
    onChange({
      target: {
        name,
        value: selectedValue,
      },
    });
    setIsOpen(false);
    setSearchTerm("");
    setHighlightedIndex(-1);
  };

  // Some pages/layouts can prevent `click` from firing (due to mousedown capture / overlays).
  // Selecting on mouse down makes option selection reliable.
  const handleOptionMouseDown = (e, option) => {
    e.preventDefault();
    e.stopPropagation();
    handleSelect(option);
  };

  // Prevent scroll chaining to the page when the options list
  // reaches its top/bottom. This makes long dropdowns scrollable
  // inside drawers/modals/containers with their own scroll handlers.
  const handleOptionsWheel = (e) => {
    const el = e.currentTarget;
    if (!el) return;

    const { scrollTop, scrollHeight, clientHeight } = el;
    const deltaY = e.deltaY;
    const isScrollable = scrollHeight > clientHeight + 1;

    if (!isScrollable) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    const atTop = scrollTop <= 0;
    const atBottom = scrollTop + clientHeight >= scrollHeight - 1;

    // If user tries to scroll past the edges, block the parent/page scroll.
    if ((atTop && deltaY < 0) || (atBottom && deltaY > 0)) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 0);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredOptions.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setSearchTerm("");
        setHighlightedIndex(-1);
        break;
    }
  };

  // Handle clear
  const handleClear = (e) => {
    e.stopPropagation();
    if (onClear) {
      onClear();
    } else {
      onChange({
        target: {
          name,
          value: "",
        },
      });
    }
    setSearchTerm("");
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event) => {
      const target = event.target;
      // Portaled modals (e.g. Add Payment Term) live outside this subtree; don't treat as "outside"
      if (target && typeof target.closest === "function" && target.closest("[data-modal-root]")) {
        return;
      }
      // Check if click is inside the dropdown menu
      const isDropdownMenuClick =
        dropdownMenuRef.current &&
        dropdownMenuRef.current.contains(target);

      // Check if click is inside the button
      const isButtonClick =
        buttonRef.current && buttonRef.current.contains(target);

      // Only close if clicking outside both button and dropdown menu
      if (!isDropdownMenuClick && !isButtonClick) {
        setIsOpen(false);
        setSearchTerm("");
        setHighlightedIndex(-1);
      }
    };

    // Use a small delay to ensure the dropdown menu is rendered
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside, true);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside, true);
    };
  }, [isOpen]);

  // App bar / header height so dropdown never overlaps it when scrolling
  const getAppBarHeight = () => {
    const header = document.querySelector("header[class*='z-30'], .layout-header, [data-app-bar]");
    if (header) return header.getBoundingClientRect().bottom;
    return 80; // fallback: h-20 = 80px
  };

  // Update dropdown position when it opens (viewport coords for position: fixed)
  const updateDropdownPosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const appBarBottom = getAppBarHeight();
      const padding = 8;

      const viewportTop = appBarBottom + padding;
      const viewportBottom = window.innerHeight - padding;

      // Always open BELOW. If there isn't enough space, shrink the menu and
      // make the options list scrollable rather than flipping above.
      const spaceBelow = viewportBottom - Math.max(rect.bottom, viewportTop);

      // Preferred max height, but clamp based on available space below.
      const preferredMax = 320; // ~ max-h-80
      const minUsable = 160; // ~ min-h-40

      const usableSpace = Math.max(
        minUsable,
        Math.min(preferredMax, spaceBelow)
      );

      setDropdownMaxHeight(usableSpace);

      // Position menu below the trigger (but never above the app bar).
      const top = Math.max(rect.bottom, viewportTop);

      setDropdownPosition({
        top,
        left: rect.left,
        width: rect.width,
      });
    }
  };

  // Calculate dropdown position when it opens
  useEffect(() => {
    if (isOpen) updateDropdownPosition();
  }, [isOpen]);

  // On scroll: hide dropdown panel when trigger is off-screen (stay open, just not visible); reposition when in view
  useEffect(() => {
    if (!isOpen || !buttonRef.current) return;

    const isTriggerInView = () => {
      if (!buttonRef.current) return false;
      const rect = buttonRef.current.getBoundingClientRect();
      const padding = 8;
      return rect.bottom >= padding && rect.top <= window.innerHeight - padding;
    };

    const handleScrollOrResize = (event) => {
      if (
        event.type === "scroll" &&
        dropdownMenuRef.current &&
        dropdownMenuRef.current.contains(event.target)
      ) {
        return;
      }
      if (!isTriggerInView()) {
        setIsPanelHiddenByScroll(true);
      } else {
        setIsPanelHiddenByScroll(false);
        updateDropdownPosition();
      }
    };

    const scrollableParents = [];
    let el = buttonRef.current.parentElement;
    while (el && el !== document.body) {
      const style = getComputedStyle(el);
      const overflowY = style.overflowY || style.overflow;
      if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") {
        scrollableParents.push(el);
      }
      el = el.parentElement;
    }

    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    scrollableParents.forEach((parent) =>
      parent.addEventListener("scroll", handleScrollOrResize, true)
    );

    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
      scrollableParents.forEach((parent) =>
        parent.removeEventListener("scroll", handleScrollOrResize, true)
      );
    };
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Clear search/highlight when closed (including controlled close from parent)
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm("");
      setHighlightedIndex(-1);
      setIsPanelHiddenByScroll(false);
    }
  }, [isOpen]);

  // Reset highlighted index when search term changes
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [searchTerm]);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Main dropdown button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (disabled || loading) return;
          if (!isOpen) setIsPanelHiddenByScroll(false);
          setIsOpen(!isOpen);
        }}
        onKeyDown={handleKeyDown}
        disabled={disabled || loading}
        className={`w-full p-3 border border-gray-300 rounded-lg appearance-none pr-10 focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] bg-white text-left ${
          disabled || loading
            ? "bg-gray-100 cursor-not-allowed text-gray-500"
            : "hover:border-gray-400"
        }`}
      >
        <div className="flex items-center justify-between">
            <div className="flex-1 truncate">
              {loading ? (
                <span className="text-gray-500">{loadingText}</span>
              ) : selectedOption ? (
                renderSelected ? (
                  renderSelected(selectedOption)
                ) : (
                  <span className="text-gray-900">
                    {selectedOption[displayKey]}
                  </span>
                )
              ) : (
                <span className="text-gray-500">{placeholder}</span>
              )}
            </div>
          <div className="flex items-center space-x-2 ml-4 ">
            {clearable && value && !disabled && !loading && (
              <button
                type="button"
                onClick={handleClear}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            )}
            <ChevronDown
              className={`h-5 w-5 text-gray-400 transition-transform ${
                isOpen ? "rotate-180" : ""
              }`}
            />
          </div>
        </div>
      </button>

      {/* Dropdown menu portaled to body so `position: fixed` is not skewed by
          ancestor `transform` / `filter` (e.g. modal shells with `transform transition-all`). */}
      {isOpen &&
        !disabled &&
        !loading &&
        createPortal(
          <div
            className="fixed flex min-h-40 flex-col overflow-hidden rounded-lg border border-gray-300 bg-white shadow-lg"
            ref={dropdownMenuRef}
            data-searchable-dropdown-menu="true"
            style={{
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`,
              width: `${dropdownPosition.width}px`,
              maxHeight: `${dropdownMaxHeight}px`,
              zIndex: 9999999,
              position: "fixed",
              pointerEvents: isPanelHiddenByScroll ? "none" : "auto",
              visibility: isPanelHiddenByScroll ? "hidden" : "visible",
              opacity: isPanelHiddenByScroll ? 0 : 1,
            }}
          >
            {/* Search input - fixed at top */}
            <div className="shrink-0 border-b border-gray-200 p-2">
              <div className="relative">
                <Search className="absolute left-1 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full rounded-md border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-[var(--p-blue)] focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)]"
                />
              </div>
            </div>

            {/* Options list - scrollable middle section */}
            <div
              className="min-h-0 flex-1 overflow-y-auto py-1"
              onWheel={handleOptionsWheel}
              style={{ overscrollBehavior: "contain" }}
            >
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option, index) => (
                  <button
                    key={option[valueKey]}
                    type="button"
                    onMouseDown={(e) => handleOptionMouseDown(e, option)}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSelect(option);
                    }}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none ${
                      index === highlightedIndex ? "bg-gray-100" : ""
                    } ${
                      option[valueKey] === value
                        ? "bg-[#f0fbf7] text-[var(--p-blue)]"
                        : ""
                    }`}
                  >
                    {renderOption ? (
                      renderOption(option)
                    ) : (
                      <span className="truncate">{option[displayKey]}</span>
                    )}
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-center text-sm text-gray-500">
                  No options found
                </div>
              )}
            </div>

            {/* Optional footer - always visible at bottom (e.g. "Add term" button) */}
            {dropdownFooter && (
              <div
                className="shrink-0 border-t border-gray-200 bg-gray-50 p-2"
                onMouseDown={(e) => {
                  // Do not close the panel here — closing would unmount footer children
                  // (e.g. Add Payment Term modal) before they can open. The global outside-click
                  // handler closes the menu when the user finishes with the modal / clicks away.
                  e.stopPropagation();
                }}
              >
                {dropdownFooter}
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
};

export default SearchableDropdown;
