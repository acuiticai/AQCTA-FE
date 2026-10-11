"use client";

import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import { useTranslation } from "react-i18next";
import { FiSearch } from "react-icons/fi";
import { Button, DropdownBasic, Checkbox, ActionButtons } from "../index";
import FilterDropdown from "./helpers/FilterDropdown";
import { Tooltip } from "react-tooltip";
import {
  Tooltip as LayoutTooltip,
  CustomDatePicker,
  FormInput,
} from "@/page-layouts/index";
import { readAssignedBusinessesFallback } from "@/utils/sessionAssignedBusinesses";
import "react-tooltip/dist/react-tooltip.css";
import { IoClose } from "react-icons/io5";
import { ChevronDown, ChevronRight } from "lucide-react";

const DataTable = ({
  title = "",
  headers = [],
  data = [],
  loading = false,
  tooltip,
  // UPDATED PROP NAME: Array of field names to hide
  headersToHide = [],
  // pagination
  totalRecords,
  noPagination = false,
  currentPage = 1,
  totalPages = 1,
  onPageChange = () => {},
  recordsPerPage = 10,
  onRecordsPerPageChange = () => {},
  // rendering
  renderRow = () => <></>,
  emptyMessage = "No data available",
  colWidths = {},
  // search
  searchValue = "",
  onSearch,
  searchPlaceholder = "Search",
  actionButtons = [],
  filters = [],
  noPadding = false,
  noBackground = false,
  containerClassName = "rounded-xl p-0 mb-[16px]",
  wideTable = false,
  /** When set (e.g. css length), table area scrolls inside this max height; header stays sticky. */
  tableMaxHeight = "",
  // Selection props
  selectable = false,
  onSelectionChange = () => {},
  selectionActions = [],
  /** When set with canBulkDelete: false, hides actions with bulkDelete: true */
  selectionRbac = null,
  rowKey = "_id",
  tableError = "",
  show = true,
  isDynamicActionColumn = false,
  // Collapsible props
  isCollapsible = true,
  onRowExpand = () => {},
  defaultExpandedRows = [],
  /** Optional custom expanded panel; when set, replaces default header-cell dump */
  renderExpandedContent = null,
  // highlight row
  highlightedRowCriteria = {
    highlightColor: {},
    matchingKey: "",
    matchingValue: "",
  },
  /** Header labels that should not get hover tooltip / ellipsis treatment on cells */
  headersWithoutCellTooltip = [],
  /**
   * When true, skips auto column-width detection (fit-content / 200px caps) so `colWidths`
   * alone controls layout. Use with `table-fixed` + explicit %/px widths.
   */
  skipDynamicColumnWidths = false,
  /** When the action column uses a translated label (e.g. t("claimManagement.action")), pass it so width/tooltip rules match "Action"/"Actions". */
  actionColumnHeaderLabel = null,
  /** Parent controls page size (e.g. attendance details); do not fetch /configuration and re-trigger pagination. */
  skipAutoPageSizeFromConfig = false,
  hideBusinessFieldWhenSingleBusiness = true,
}) => {
  const { t } = useTranslation();
  const [assignedBusinessesCount, setAssignedBusinessesCount] = useState(0);

  const isActionHeaderName = useCallback(
    (name) =>
      name === "Action" ||
      name === "Actions" ||
      (!!actionColumnHeaderLabel && name === actionColumnHeaderLabel),
    [actionColumnHeaderLabel]
  );

  // console.debug({ highlightedRowCriteria });
  const timeoutRef = useRef(null);
  const [expandedRows, setExpandedRows] = useState(
    new Set(defaultExpandedRows)
  );
  const [actionColumnWidth, setActionColumnWidth] = useState("auto");
  const [hasCalculatedWidth, setHasCalculatedWidth] = useState(false);
  const [selectedRows, setSelectedRows] = useState([]);
  const [allSelected, setAllSelected] = useState(false);
  const [localSearchValue, setLocalSearchValue] = useState(searchValue);
  const [dynamicColumnWidths, setDynamicColumnWidths] = useState({});
  const [isDetectingOverflow, setIsDetectingOverflow] = useState(false);
  const hasAppliedStoredDefaultRef = React.useRef(false);
  const userChangedPageSizeRef = React.useRef(false);
  const tableRef = useRef(null);
  const detectionTimeoutRef = useRef(null);

  useEffect(() => {
    const assigned = readAssignedBusinessesFallback();
    setAssignedBusinessesCount(Array.isArray(assigned) ? assigned.length : 0);
  }, []);

  const businessHeaderKeywords = useMemo(() => {
    const normalize = (value) =>
      String(value || "")
        .toLowerCase()
        .replace(/\s+/g, "");
    return new Set(
      [
        "business",
        "businesses",
        "company",
        "companies",
        t("Business"),
        t("Businesses"),
        t("Company"),
        t("Companies"),
        t("claimManagement.company"),
        t("hrAnalytics.business"),
      ]
        .map(normalize)
        .filter(Boolean)
    );
  }, [t]);

  const effectiveHeadersToHide = useMemo(() => {
    const normalize = (value) =>
      String(value || "")
        .toLowerCase()
        .replace(/\s+/g, "");
    const shouldHideBusinessField =
      hideBusinessFieldWhenSingleBusiness && assignedBusinessesCount === 1;
    if (!shouldHideBusinessField) return headersToHide;
    const next = new Set(headersToHide);
    headers.forEach((header) => {
      const normalized = normalize(header);
      if (businessHeaderKeywords.has(normalized)) {
        next.add(header);
      }
    });
    return Array.from(next);
  }, [
    headers,
    headersToHide,
    hideBusinessFieldWhenSingleBusiness,
    assignedBusinessesCount,
    businessHeaderKeywords,
  ]);

  // Filter headers based on headersToHide
  const filteredHeaders = headers.filter(
    (header) => !effectiveHeadersToHide.includes(header)
  );

  const hasActionColumn = useMemo(
    () => filteredHeaders.some((h) => isActionHeaderName(h)),
    [filteredHeaders, isActionHeaderName]
  );

  const useDebounce = (callback, delay) => {
    const localTimeoutRef = useRef(null);
    return useCallback(
      (...args) => {
        if (localTimeoutRef.current) {
          clearTimeout(localTimeoutRef.current);
        }
        localTimeoutRef.current = setTimeout(() => {
          callback(...args);
        }, delay);
      },
      [callback, delay]
    );
  };

  const debouncedSearch = useDebounce((value) => {
    onSearch(value);
  }, 500);

  // Expanded panel shows full row details, including columns hidden from the
  // main listing via headersToHide (Select is only a checkbox helper column).
  const expandedDetailsHeaders = useMemo(() => {
    return headers.filter((header) => header !== "Select");
  }, [headers]);

  const handleRecordsPerPageChange = useCallback(
    (value) => {
      userChangedPageSizeRef.current = true;
      onRecordsPerPageChange(value);
    },
    [onRecordsPerPageChange]
  );

  useEffect(() => {
    if (skipAutoPageSizeFromConfig) {
      hasAppliedStoredDefaultRef.current = true;
      return;
    }
    // On first mount, fetch configuration from API and adopt
    // `table_entries_per_page` as the global default across screens.
    let cancelled = false;
    (async () => {
      try {
        if (hasAppliedStoredDefaultRef.current) return;
        const API_BASE = import.meta.env.VITE_APP_API_BASE_URL;
        const res = await fetch(`${API_BASE}/configuration`);
        if (!res.ok) {
          return;
        }
        const data = await res.json();
        if (cancelled || userChangedPageSizeRef.current) return;
        // `getLatestConfiguration` returns an array sorted by updatedAt desc
        const cfg = Array.isArray(data) && data.length > 0 ? data[0] : data;
        const stored = cfg && cfg.table_entries_per_page;
        if (
          Number.isFinite(stored) &&
          stored > 0 &&
          stored !== recordsPerPage
        ) {
          onRecordsPerPageChange(Number(stored));
        }
        // Optionally cache to localStorage for faster subsequent loads
        try {
          localStorage.setItem("configurations", JSON.stringify(cfg || {}));
        } catch (e) {
          // ignore
        }
      } catch (err) {
        // ignore fetch errors
      } finally {
        if (!cancelled) {
          hasAppliedStoredDefaultRef.current = true;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []); // run once on mount

  useEffect(() => {
    setLocalSearchValue(searchValue);
  }, [searchValue]);

  // Debounced column detection to prevent excessive calls
  const debouncedDetectOverflow = useDebounce(() => {
    if (
      !skipDynamicColumnWidths &&
      !isDetectingOverflow &&
      data.length > 0 &&
      !loading
    ) {
      detectOverflowingColumns();
    }
  }, 300);

  useEffect(() => {
    if (skipDynamicColumnWidths) {
      setDynamicColumnWidths({});
    }
  }, [skipDynamicColumnWidths]);

  // Detect overflowing columns when data changes
  useEffect(() => {
    if (skipDynamicColumnWidths) {
      if (detectionTimeoutRef.current) {
        clearTimeout(detectionTimeoutRef.current);
      }
      return;
    }
    if (data.length > 0 && !loading) {
      // Clear any existing timeout
      if (detectionTimeoutRef.current) {
        clearTimeout(detectionTimeoutRef.current);
      }

      // Use a longer delay to ensure DOM is fully ready
      detectionTimeoutRef.current = setTimeout(() => {
        debouncedDetectOverflow();
      }, 150);
    }

    return () => {
      if (detectionTimeoutRef.current) {
        clearTimeout(detectionTimeoutRef.current);
      }
    };
  }, [
    data,
    loading,
    filteredHeaders,
    debouncedDetectOverflow,
    skipDynamicColumnWidths,
  ]);

  useEffect(() => {
    if (
      data.length > 0 &&
      hasActionColumn &&
      isDynamicActionColumn
    ) {
      // Use setTimeout to ensure DOM is ready
      const calculateWidth = () => {
        let maxWidth = 0;

        // Find the current table element within this DataTable component
        const currentTable = document.querySelector(".data-table-layout table");

        if (currentTable) {
          // Find action button containers only within this specific table
          const actionContainers = currentTable.querySelectorAll(
            ".action-buttons-container"
          );

          if (actionContainers.length) {
            const containerWidths = Array.from(actionContainers)
              .map((container) => {
                const rect = container.getBoundingClientRect();
                return rect.width;
              })
              .filter((width) => width > 0);

            if (containerWidths.length > 0) {
              maxWidth = Math.max(...containerWidths);
            }
          }
        }

        // Only update if we have a valid width and it's not shrinking
        if (maxWidth > 0) {
          const currentWidth = actionColumnWidth;
          const currentWidthValue =
            currentWidth === "fit-content" ? 0 : parseInt(currentWidth);

          // Only update if new width is greater or we haven't calculated yet
          if (maxWidth > currentWidthValue || currentWidthValue === 0) {
            const finalWidth = `${maxWidth}px`;
            setActionColumnWidth(finalWidth);
            setHasCalculatedWidth(true);
            // console.debug({ finalWidth, previousWidth: currentWidth });
          }
        } else {
          // Fallback to fit-content only if we haven't calculated anything yet
          if (!hasCalculatedWidth) {
            setActionColumnWidth("80px");
            setHasCalculatedWidth(true);
            // console.debug({ finalWidth: "fit-content" });
          }
        }
      };

      // Try immediate calculation first
      calculateWidth();

      // If no containers found, try again after a short delay
      const currentTable = document.querySelector(".data-table-layout table");
      if (
        !currentTable ||
        currentTable.querySelectorAll(".action-buttons-container").length === 0
      ) {
        setTimeout(calculateWidth, 200);

        // Try again after 500ms as a fallback
        setTimeout(() => {
          calculateWidth();
        }, 500);
      }
    }
  }, [
    data,
    filteredHeaders,
    currentPage,
    recordsPerPage,
    actionColumnWidth,
    hasCalculatedWidth,
    hasActionColumn,
    isDynamicActionColumn,
  ]);

  // Keep loading state until Action column width is properly calculated
  useEffect(() => {
    if (
      data.length > 0 &&
      hasActionColumn &&
      !hasCalculatedWidth &&
      isDynamicActionColumn
    ) {
      // Set loading to true until width is calculated
      const checkWidthCalculation = () => {
        if (!hasCalculatedWidth) {
          setTimeout(checkWidthCalculation, 100);
        }
      };
      checkWidthCalculation();
    }
  }, [data, filteredHeaders, hasCalculatedWidth, hasActionColumn, isDynamicActionColumn]);

  useEffect(() => {
    if (loading) {
      setHasCalculatedWidth(false);
      setActionColumnWidth("fit-content");
    }
  }, [loading]);

  // Determine if we should show loading state
  const shouldShowLoading =
    loading ||
    (data.length > 0 &&
      hasActionColumn &&
      !hasCalculatedWidth &&
      isDynamicActionColumn);

  useEffect(() => {
    setSelectedRows([]);
    setAllSelected(false);
  }, [currentPage, data]);

  useEffect(() => {
    onSelectionChange(selectedRows);
  }, [selectedRows, onSelectionChange]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (detectionTimeoutRef.current) {
        clearTimeout(detectionTimeoutRef.current);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleRowExpand = (rowData) => {
    const rowId = rowData[rowKey];
    const newExpandedRows = new Set(expandedRows);

    if (expandedRows.has(rowId)) {
      newExpandedRows.delete(rowId);
    } else {
      newExpandedRows.add(rowId);
    }

    setExpandedRows(newExpandedRows);
    onRowExpand(rowId, !expandedRows.has(rowId), rowData);
  };

  const isRowExpanded = (rowData) => {
    return expandedRows.has(rowData[rowKey]);
  };

  const getMaxWidthOfColumn = (columnText) => {
    if (!isActionHeaderName(columnText)) {
      if (dynamicColumnWidths[columnText]) {
        return dynamicColumnWidths[columnText];
      }
      // When parent passes explicit colWidths + skipDynamicColumnWidths, use them
      // as header width (width: auto ignores maxWidth and columns stay bloated).
      if (skipDynamicColumnWidths && colWidths[columnText]) {
        return colWidths[columnText];
      }
      return "auto";
    }
    if (colWidths[columnText]) {
      return colWidths[columnText];
    }
    // Ensure minimum width for Action column
    if (actionColumnWidth === "fit-content" || actionColumnWidth === "auto") {
      return "120px";
    }
    return actionColumnWidth;
  };

  // Function to detect columns that need width adjustment
  const detectOverflowingColumns = useCallback(() => {
    if (skipDynamicColumnWidths) return;
    if (isDetectingOverflow) return;

    setIsDetectingOverflow(true);

    // Use requestAnimationFrame to ensure DOM is ready and avoid blocking
    requestAnimationFrame(() => {
      try {
        const table =
          tableRef.current ||
          document.querySelector(".data-table-layout table");
        if (!table || data.length === 0) {
          setIsDetectingOverflow(false);
          return;
        }

        const newDynamicWidths = {};

        // Create a single temp div for all measurements to reduce DOM operations
        const tempDiv = document.createElement("div");
        tempDiv.style.position = "absolute";
        tempDiv.style.visibility = "hidden";
        tempDiv.style.whiteSpace = "nowrap";
        tempDiv.style.fontSize = "12px";
        tempDiv.style.fontFamily = "Inter";
        tempDiv.style.top = "-9999px";
        tempDiv.style.left = "-9999px";
        document.body.appendChild(tempDiv);

        // Process headers in batches to avoid blocking the main thread
        const processHeaders = (startIndex = 0) => {
          const batchSize = 3; // Process 3 headers at a time
          const endIndex = Math.min(
            startIndex + batchSize,
            filteredHeaders.length
          );

          for (let i = startIndex; i < endIndex; i++) {
            const header = filteredHeaders[i];
            if (isActionHeaderName(header)) continue;

            const rawColW = colWidths[header];
            let currentMaxWidthValue = 200;
            if (rawColW && typeof rawColW === "string") {
              if (rawColW.trim().endsWith("%")) {
                currentMaxWidthValue = Number.POSITIVE_INFINITY;
              } else {
                const parsed = parseInt(
                  String(rawColW).replace(/px/gi, ""),
                  10
                );
                if (!Number.isNaN(parsed)) currentMaxWidthValue = parsed;
              }
            }

            let maxContentWidth = 0;

            // Check header text width
            tempDiv.textContent = header;
            const headerWidth = tempDiv.offsetWidth;
            maxContentWidth = Math.max(maxContentWidth, headerWidth);

            // Sample only first 5 rows to reduce computation
            const sampleSize = Math.min(5, data.length);
            for (let rowIndex = 0; rowIndex < sampleSize; rowIndex++) {
              const rowData = data[rowIndex];
              const row = createCustomRow(rowData, rowIndex);
              const cells = React.Children.toArray(row?.props?.children);
              const cell = cells[i];
              if (cell && cell.props && cell.props.children) {
                const content = cell.props.children.toString();
                if (content.length > 0) {
                  tempDiv.textContent = content;
                  const cellWidth = tempDiv.offsetWidth;
                  maxContentWidth = Math.max(maxContentWidth, cellWidth);
                }
              }
            }

            // If content is wider than current max width, use fit-content
            if (maxContentWidth > currentMaxWidthValue) {
              newDynamicWidths[header] = "fit-content";
            }
          }

          // Continue with next batch if there are more headers
          if (endIndex < filteredHeaders.length) {
            setTimeout(() => processHeaders(endIndex), 0);
          } else {
            // All headers processed, update state
            document.body.removeChild(tempDiv);
            setDynamicColumnWidths(newDynamicWidths);
            setIsDetectingOverflow(false);
          }
        };

        processHeaders();
      } catch (error) {
        console.warn("Error in detectOverflowingColumns:", error);
        setIsDetectingOverflow(false);
      }
    });
  }, [
    data,
    filteredHeaders,
    colWidths,
    selectable,
    isCollapsible,
    isDetectingOverflow,
    skipDynamicColumnWidths,
  ]);

  const handleRowSelection = (rowData) => {
    const rowId = rowData[rowKey];

    setSelectedRows((prevRows) => {
      const isSelected = prevRows.some((row) => row[rowKey] === rowId);

      let newSelection;
      if (isSelected) {
        newSelection = prevRows.filter((row) => row[rowKey] !== rowId);
      } else {
        newSelection = [...prevRows, rowData];
      }

      setAllSelected(newSelection.length === data.length);

      return newSelection;
    });
  };

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedRows([]);
      setAllSelected(false);
    } else {
      setSelectedRows([...data]);
      setAllSelected(true);
    }
  };

  const isRowSelected = (rowData) => {
    const rowId = rowData[rowKey];
    return selectedRows.some((row) => row[rowKey] === rowId);
  };

  const renderPagination = () => {
    const pageNumbers = [];
    const maxPagesToShow = 5;

    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    const endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

    if (endPage - startPage + 1 < maxPagesToShow) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }

    return (
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          width: "100%",
          padding: "16px 16px 0px 16px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "8px",
            fontWeight: "600",
            fontSize: "14px",
          }}
        >
          <span>{t("common.show")}</span>
          <div style={{ position: "relative" }}>
            <select
              value={recordsPerPage}
              onChange={(e) =>
                handleRecordsPerPageChange(Number(e.target.value))
              }
              style={{
                appearance: "none",
                backgroundColor: "white",
                border: "1px solid #e5e7eb",
                borderRadius: "6px",
                padding: "4px 12px 4px 8px",
                paddingRight: "32px",
                outline: "none",
              }}
            >
              {[5, 10, 25, 50].map((num) => (
                <option key={num} value={num}>
                  {num}
                </option>
              ))}
            </select>
            <div
              style={{
                pointerEvents: "none",
                position: "absolute",
                top: 0,
                bottom: 0,
                right: "8px",
                display: "flex",
                alignItems: "center",
                color: "#4B5563",
              }}
            >
              ▼
            </div>
          </div>
          <span>{t("common.entries")} {totalRecords && `${t("common.of")} ${totalRecords}`}</span>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "4px",
            fontWeight: "600",
            fontSize: "14px",
            padding: 0,
          }}
        >
          <button
            style={navBtnStyle}
            type="button"
            disabled={currentPage === 1}
            onClick={() => onPageChange(1)}
          >
            «
          </button>
          <button
            style={navBtnStyle}
            type="button"
            disabled={currentPage === 1}
            onClick={() => onPageChange(currentPage - 1)}
          >
            ‹
          </button>

          {pageNumbers.length > 0 ? (
            pageNumbers.map((number) => (
              <button
                key={number}
                type="button"
                onClick={() => onPageChange(number)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  backgroundColor:
                    currentPage === number ? "var(--p-blue)" : "white",
                  color: currentPage === number ? "white" : "#000",
                  border: currentPage === number ? "none" : "1px solid #e5e7eb",
                }}
              >
                {number}
              </button>
            ))
          ) : (
            <button
              type="button"
              disabled
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                backgroundColor: "white",
                color: "white",
                border: "none",
              }}
            >
              1
            </button>
          )}

          {totalPages > endPage && (
            <>
              <span style={{ padding: "0 4px" }}>...</span>
              <button
                type="button"
                style={navBtnStyle}
                onClick={() => onPageChange(totalPages)}
              >
                {totalPages}
              </button>
            </>
          )}

          <button
            type="button"
            style={navBtnStyle}
            disabled={currentPage === totalPages || totalPages <= 1}
            onClick={() => onPageChange(currentPage + 1)}
          >
            ›
          </button>
          <button
            type="button"
            style={navBtnStyle}
            disabled={currentPage === totalPages || totalPages <= 1}
            onClick={() => onPageChange(totalPages)}
          >
            »
          </button>
        </div>
      </div>
    );
  };

  function extractContent(children, headers) {
    if (isActionHeaderName(headers)) {
      return "";
    }

    if (typeof children === "string" || typeof children === "number") {
      return String(children);
    }

    if (Array.isArray(children)) {
      return children.map(extractContent).join(" ");
    }

    if (React.isValidElement(children)) {
      return extractContent(children.props?.children);
    }

    return "";
  }

  const navBtnStyle = {
    padding: "6px 12px",
    borderRadius: "6px",
    border: "1px solid #e5e7eb",
    opacity: 1,
    backgroundColor: "white",
    cursor: "pointer",
    disabled: {
      opacity: 0.5,
    },
  };

  const createCustomRow = (rowData, index) => {
    const originalRow = renderRow(rowData, index);

    if (!originalRow || !React.isValidElement(originalRow)) {
      return originalRow;
    }

    return React.cloneElement(originalRow, {
      ...originalRow.props,
      onClick: selectable ? () => handleRowSelection(rowData) : undefined,
      style: {
        ...originalRow.props.style,
        cursor: selectable ? "pointer" : "default",
      },
      children: React.Children.map(
        originalRow.props.children,
        (cell, cellIndex) => {
          if (!cell || !React.isValidElement(cell)) {
            return cell;
          }

          // Skip cells for hidden fields
          const headerName = headers[cellIndex];
            if (effectiveHeadersToHide.includes(headerName)) {
            return null;
          }

          const content = extractContent(
            cell.props.children,
            headers[cellIndex]
          );

          const skipCellTooltip =
            headersWithoutCellTooltip.includes(headers[cellIndex]) ||
            isActionHeaderName(headers[cellIndex]);

          const tooltipId =
            content && !skipCellTooltip
              ? `tooltip-${index}-${cellIndex}`
              : undefined;

          const cellProps = {
            ...cell.props,
            ...(tooltipId && {
              "data-tooltip-id": tooltipId,
              "data-tooltip-content": content,
            }),
            className: `${tooltipId ? "custom-text-ellipsis" : ""} ${
              cell.props.className || ""
            }`,
            style: {
              ...cell?.props?.style,
              minWidth:
                dynamicColumnWidths[headers[cellIndex]] ||
                colWidths[headers[cellIndex]] ||
                "150px",
              ...(tooltipId && {
                // maxWidth: colWidths[headers[cellIndex]] || "200px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                position: "relative",
              }),
            },
          };

          return React.cloneElement(cell, cellProps);
        }
      )?.filter(Boolean), // Remove null values
    });
  };

  // Helper function to get cell content by header name
  const getCellContentByHeader = (originalRow, headerName) => {
    if (!originalRow || !React.isValidElement(originalRow)) {
      return "-";
    }

    const headerIndex = headers.indexOf(headerName);
    if (headerIndex === -1) return "-";

    const cells = React.Children.toArray(originalRow.props.children);
    const cell = cells[headerIndex];

    if (!cell || !React.isValidElement(cell)) {
      return "-";
    }

    if (
      (headerName === "Action" || headerName === "Actions") &&
      isActionHeaderName(headerName) &&
      !cell.props.children &&
      cell.props?.items?.length
    ) {
      return <ActionButtons items={cell.props.items} displayOnly={true} />;
    }

    if (
      (headerName === "Action" || headerName === "Actions") &&
      cell.props.children
    ) {
      return cell.props.children;
    }

    return cell.props.children;
  };

  const resolvedSelectionActions = useMemo(() => {
    if (!selectionRbac || selectionRbac.canBulkDelete !== false) {
      return selectionActions;
    }
    return selectionActions.filter((action) => !action.bulkDelete);
  }, [selectionActions, selectionRbac]);

  const renderSelectionActions = () => {
    if (!selectable || selectedRows.length === 0) return null;

    return (
      <div className="flex items-center gap-2 shadow-sm rounded-md py-3 px-5 mt-6 justify-between bg-white">
        <span className="text-sm font-medium">
          {selectedRows.length} selected
        </span>
        <div className="flex items-center gap-2">
          {resolvedSelectionActions.map((action, index) => (
            <Button
              {...action}
              key={`selection-action-${index}`}
              onClick={() => action.onClick(selectedRows)}
              label={action.label}
            />
          ))}
        </div>
      </div>
    );
  };

  if (!show) return null;

  return (
    <div
      className={`data-table-layout min-w-0 max-w-full ${
        wideTable || tableMaxHeight ? "w-full overflow-hidden" : ""
      } ${!noPadding && "p-5 sm:p-6"} pb-6`}
    >
      <div
        className={`min-w-0 max-w-full ${
          wideTable || tableMaxHeight ? "w-full overflow-hidden" : ""
        } ${containerClassName}`}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: title ? "space-between" : "flex-end",
            alignItems: "center",
            gap: "0px",
          }}
        >
          {title && <div className="text-base font-medium mb-2">{title}</div>}
          <div
            className="flex flex-wrap gap-x-4 gap-y-3 items-start mt-3 justify-end"
            style={{
              rowGap: "20px",
              columnGap: "12px",
              alignItems: "flex-start",
              padding: "0px 4px",
            }}
          >
            {filters
              .filter((filter) => {
                if (
                  hideBusinessFieldWhenSingleBusiness &&
                  assignedBusinessesCount === 1 &&
                  filter?.isBusinessDropdown
                ) {
                  return false;
                }
                return true;
              })
              .map((filter, index) => (
              <div
                key={index}
                style={{
                  width: "310px",
                  flex: "1 1 310px",
                  maxWidth: "310px",
                  minWidth: "310px",
                  ...(filter.isClearButton && {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    width: "10px",
                    minWidth: "10px",
                    maxWidth: "10px",
                    flex: "1 1 10px",
                  }),
                  ...(filter.containerStyle || {}),
                }}
              >
                {filter.isClearButton ? (
                  <LayoutTooltip
                    id={`clear-filters-tooltip-${index}`}
                    tooltipContent={filter.tooltip || "Clear Filters"}
                    children={
                      <IoClose
                        className="w-5 h-5 cursor-pointer mt-[12px] mr-3 bg-transparent rounded-full p-[2px] text-red-500 border border-red-500 font-bold hover:bg-red-500 hover:border-none hover:text-white"
                        {...filter.buttonProps}
                      />
                    }
                  />
                ) : filter.isBusinessDropdown ? (
                  <div className="w-full min-w-0">
                    <DropdownBasic
                      isBusinessDropdown={true}
                      businessDropdownProps={{
                        ...filter.businessDropdownProps,
                        appearance: "filterPill",
                      }}
                    />
                  </div>
                ) : filter.isDatePicker ? (
                  <CustomDatePicker
                    value={filter.value}
                    onChange={(val) => filter.onChange(val)}
                    className="filter-select"
                    clearable={Boolean(filter.clearable)}
                  />
                ) : filter.isCheckbox ? (
                  <div className="flex items-center gap-2 mt-2">
                    <Checkbox
                      value={filter.checked || false}
                      onChange={filter.onChange}
                    />
                    <label
                      className="text-sm text-gray-700 cursor-pointer"
                      onClick={() => filter.onChange(!filter.checked)}
                    >
                      {filter.label}
                    </label>
                  </div>
                ) : filter.customComponent ? (
                  filter.customComponent
                ) : filter.isTextInput || filter.type === "text" ? (
                  <FormInput
                    name={filter.name}
                    value={filter.value || ""}
                    onChange={(e) => filter.onChange(e.target.value)}
                    placeholder={filter.placeholder || "Filter..."}
                  />
                ) : (
                  <FilterDropdown
                    options={filter.options || []}
                    value={filter.value ?? ""}
                    onChange={filter.onChange}
                    placeholder={filter.placeholder || "All Data"}
                    isClearable={
                      filter.isClearable !== undefined ? filter.isClearable : true
                    }
                    isMulti={filter.isMulti}
                    {...filter.filterDropdownProps}
                    {...filter?.dropdownProps}
                  />
                )}
              </div>
            ))}

            {onSearch !== undefined && (
              <div
                style={{
                  paddingLeft: "36px",
                  paddingRight: "0px",
                  paddingTop: "8px",
                  paddingBottom: "8px",
                  border: "1px solid #E6EEF6",
                  outline: "none",
                  fontSize: "14px",
                  borderRadius: "14px",
                  background: "#F4F7FB",
                  width: "300px",
                  position: "relative",
                }}
              >
                <div style={{}}>
                  <input
                    type="text"
                    value={localSearchValue}
                    onChange={(e) => {
                      const value = e.target.value;
                      setLocalSearchValue(value);
                      debouncedSearch(value);
                    }}
                    placeholder={searchPlaceholder}
                    style={{
                      backgroundColor: "transparent",
                      border: "none",
                      outline: "none",
                      width: "100%",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      left: "10px",
                      top: "50%",
                      transform: "translateY(-50%)",
                    }}
                  >
                    <FiSearch style={{ color: "#9CA3AF" }} />
                  </div>
                  <div
                    style={{
                      position: "absolute",
                      right: "10px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "#9CA3AF",
                      fontSize: "12px",
                    }}
                  >
                    ⌘/
                  </div>
                </div>
              </div>
            )}

            {actionButtons.map((button, index) => (
              <div
                key={index}
                style={{
                  minWidth: "120px",
                  flex: "1 1 120px",
                }}
              >
                <Button {...button} />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div
        className={`mt-5 w-full min-w-0 max-w-full ${
          wideTable || tableMaxHeight ? "" : "overflow-hidden"
        }`}
      >
        <div
          className={`min-w-0 max-w-full ${
            tableMaxHeight
              ? "w-full overflow-auto overscroll-contain touch-pan-x [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              : wideTable
                ? "w-full overflow-x-auto overscroll-x-contain touch-pan-x [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                : "overflow-x-hidden"
          }`}
          style={{
            ...(tableMaxHeight
              ? {
                  maxHeight:
                    typeof tableMaxHeight === "number"
                      ? `${tableMaxHeight}px`
                      : tableMaxHeight,
                }
              : null),
            ...((wideTable || tableMaxHeight) && {
              WebkitOverflowScrolling: "touch",
              scrollBehavior: "smooth",
            }),
          }}
        >
          <table
            ref={tableRef}
            className={`bg-white text-sm border-collapse ${
              wideTable || tableMaxHeight
                ? "table-auto w-max min-w-full"
                : "table-fixed w-full"
            }`}
          >
          <thead
            className={tableMaxHeight ? "sticky top-0 z-20 shadow-sm" : ""}
          >
            <tr className="text-gray-600">
              {selectable && (
                <th
                  className="py-2 w-10"
                  style={{ width: "40px", minWidth: "40px" }}
                >
                  <Checkbox
                    style={{ width: "20px", minWidth: "20px" }}
                    value={allSelected}
                    onChange={handleSelectAll}
                  />
                </th>
              )}

              {isCollapsible && (
                <th
                  className="py-2 w-10"
                  style={{ width: "40px", minWidth: "40px" }}
                >
                  <span className="sr-only">{t("common.expand")}</span>
                </th>
              )}

              {filteredHeaders.map((header, index) => {
                const isActionHeader = isActionHeaderName(header);
                const headerWidth = getMaxWidthOfColumn(header);

                return (
                  <th
                    key={index}
                    className="py-2 px-4 font-medium"
                    style={{
                      fontFamily: '"Plus Jakarta Sans", "Outfit", sans-serif',
                      fontWeight: "700",
                      textAlign: "left",
                      fontSize: "12px",
                      width: headerWidth,
                      minWidth:
                        colWidths[header] ||
                        (isActionHeader ? "120px" : "150px"),
                      maxWidth:
                        dynamicColumnWidths[header] ||
                        colWidths[header] ||
                        (isActionHeader ? "fit-content" : "200px"),
                      overflow: isActionHeader ? "visible" : "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      position: "relative",
                      ...(isActionHeader ? { paddingRight: "16px" } : {}),
                    }}
                    data-tooltip-id={`header-tooltip-${index}`}
                    data-tooltip-content={header}
                  >
                    {header}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody style={{ fontSize: "12px" }}>
            {data?.length > 0 && !shouldShowLoading ? (
              data?.map((rowData, index) => {
                const row = createCustomRow(rowData, index);
                const originalRow = renderRow(rowData, index); // Keep original row for expanded view
                if (!row) return null;

                return (
                  <React.Fragment key={rowData[rowKey] || index}>
                    <tr
                      style={{
                        backgroundColor: isRowSelected(rowData)
                          ? "#F2F5F9"
                          : highlightedRowCriteria.matchingKey &&
                            rowData[highlightedRowCriteria.matchingKey] ===
                              highlightedRowCriteria.matchingValue
                          ? highlightedRowCriteria.highlightColor
                          : "transparent",
                      }}
                    >
                      {selectable && (
                        <td
                          className="py-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Checkbox
                            style={{ width: "20px", minWidth: "20px" }}
                            value={isRowSelected(rowData)}
                            onChange={() => handleRowSelection(rowData)}
                          />
                        </td>
                      )}
                      {isCollapsible && (
                        <td
                          className="py-2 px-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => handleRowExpand(rowData)}
                            className="p-1 hover:bg-gray-100 rounded transition-colors duration-200 flex items-center justify-center"
                            style={{ width: "24px", height: "24px" }}
                          >
                            {isRowExpanded(rowData) ? (
                              <ChevronDown className="w-4 h-4 text-gray-600" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-gray-600" />
                            )}
                          </button>
                        </td>
                      )}

                      {React.Children.map(
                        row.props.children,
                        (cell, cellIndex) => {
                          if (!cell) return null;
                          const headerName = filteredHeaders[cellIndex];
                          const cw = colWidths[headerName];
                          const hasExplicitWidth =
                            cw !== undefined && cw !== "";
                          const minW =
                            dynamicColumnWidths[headerName] ||
                            cw ||
                            (isActionHeaderName(headerName)
                              ? "120px"
                              : "150px");
                          const isActionCol = isActionHeaderName(headerName);
                          return React.cloneElement(cell, {
                            ...cell.props,
                            style: {
                              ...cell?.props?.style,
                              ...(isActionCol
                                ? { overflow: "visible", paddingRight: "16px" }
                                : {}),
                              ...(hasExplicitWidth
                                ? {
                                    width: cw,
                                    minWidth:
                                      dynamicColumnWidths[headerName] || cw,
                                    ...(!isActionCol ? { maxWidth: cw } : {}),
                                  }
                                : {
                                    width: "100%",
                                    minWidth: minW,
                                  }),
                            },
                          });
                        }
                      )}
                    </tr>

                    {isCollapsible && isRowExpanded(rowData) && (
                      <tr>
                        <td
                          colSpan={
                            (isCollapsible ? 1 : 0) +
                            (selectable ? 1 : 0) +
                            filteredHeaders.length
                          }
                          className="p-0 min-w-0 align-top"
                        >
                          <div className="bg-white border border-gray-200 rounded-lg shadow-sm mx-0 mb-1">
                            <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-3 border-b border-gray-200">
                              <h3 className="text-sm font-semibold text-gray-800">
                                Row Details
                              </h3>
                            </div>
                            <div className="p-6 min-w-0 overflow-x-auto">
                              {typeof renderExpandedContent === "function" ? (
                                renderExpandedContent(rowData)
                              ) : (
                                <>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 min-w-0">
                                    {expandedDetailsHeaders.map(
                                      (header, headerIndex) => {
                                        if (isActionHeaderName(header))
                                          return null;

                                        const content = getCellContentByHeader(
                                          originalRow,
                                          header
                                        );

                                        return (
                                          <div
                                            key={headerIndex}
                                            className="space-y-2"
                                          >
                                            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                              {header}
                                            </div>
                                            <div className="text-sm text-gray-900 break-words">
                                              {typeof content === "string" ? (
                                                <span className="leading-relaxed">
                                                  {content}
                                                </span>
                                              ) : (
                                                content
                                              )}
                                            </div>
                                          </div>
                                        );
                                      }
                                    )}
                                  </div>

                                  {headers.some((h) =>
                                    isActionHeaderName(h)
                                  ) && (
                                    <div className="mt-6 pt-4 border-t border-gray-200">
                                      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
                                        {t("Actions")}
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        {getCellContentByHeader(
                                          originalRow,
                                          headers.find((h) =>
                                            isActionHeaderName(h)
                                          ) || "Action"
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={
                    (isCollapsible ? 1 : 0) +
                    (selectable ? 1 : 0) +
                    filteredHeaders.length
                  }
                  className="py-4 text-center text-gray-500"
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      padding: "20px",
                      width: "100%",
                    }}
                  >
                    {shouldShowLoading ? (
                      <div
                        style={{
                          borderTop: "2px solid rgb(242, 144, 16)",
                          borderLeft: "2px solid rgb(242, 144, 16)",
                          borderRadius: "50%",
                          width: "16px",
                          height: "16px",
                          animation: "spin 1s linear infinite",
                        }}
                      ></div>
                    ) : (
                      emptyMessage
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
          </table>
        </div>

        {filteredHeaders.map((header, index) => (
          <Tooltip
            key={`header-tooltip-${index}`}
            opacity={1}
            id={`header-tooltip-${index}`}
            style={{
              backgroundColor: "var(--p-gray-light)",
              color: "#333333",
              borderRadius: "4px",
              padding: "8px 12px",
              fontSize: "12px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              zIndex: 1000,
            }}
          />
        ))}

        {data?.length > 0 &&
          data.map((rowData, index) => {
            const row = renderRow(rowData, index);
            if (!row || !React.isValidElement(row)) return null;

            return React.Children.map(row.props.children, (cell, cellIndex) => {
              if (!cell || !React.isValidElement(cell)) return null;

              // Skip tooltips for hidden fields
              if (effectiveHeadersToHide.includes(headers[cellIndex])) return null;

              let content = "";
              if (
                typeof cell.props.children === "string" ||
                typeof cell.props.children === "number"
              ) {
                content = cell.props.children;
              } else if (React.isValidElement(cell.props.children)) {
                content = cell.props.children.props?.children || "";
              } else if (Array.isArray(cell.props.children)) {
                content = cell.props.children
                  .filter((c) => typeof c === "string" || typeof c === "number")
                  .join(" ");
              }

              if (!content || headers[cellIndex]?.toLowerCase() === "action")
                return null;

              const tooltipId = `tooltip-${index}-${cellIndex}`;
              return (
                <Tooltip
                  key={tooltipId}
                  id={tooltipId}
                  opacity={1}
                  style={{
                    backgroundColor: "var(--p-gray-light)",
                    color: "#333333",
                    borderRadius: "4px",
                    padding: "8px 12px",
                    fontSize: "12px",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                    zIndex: 1000,
                  }}
                />
              );
            });
          })}

        {renderSelectionActions()}
        {tableError && (
          <span
            className="text-red-500 text-sm"
            style={{
              display: "flex",
              paddingTop: "16px",
            }}
          >
            {tableError}
          </span>
        )}

        {!noPagination && (!loading || totalRecords > 0) && renderPagination()}
      </div>
    </div>
  );
};

export default DataTable;
