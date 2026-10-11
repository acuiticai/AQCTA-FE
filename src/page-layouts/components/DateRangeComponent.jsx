import "react-date-range/dist/styles.css"; // main css file
import "react-date-range/dist/theme/default.css"; // theme css file

import {
  DateRangePicker,
  defaultStaticRanges,
  defaultInputRanges,
} from "react-date-range";
import { endOfWeek, startOfWeek } from "date-fns";
import { useState, useEffect } from "react";
import Button from "@mui/material/Button";
import Popover from "@mui/material/Popover";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import { formatDate } from "@/components/formatAmount";
import { useTranslation } from "react-i18next";

const DateRangeComponent = ({
  initialStartDate,
  initialEndDate,
  onChange,
  onApply,
  onClear,
  startDate,
  endDate,
  width = "auto",
  ...props
}) => {
  const { t } = useTranslation();
  // Store Date objects in state
  const [anchorEl, setAnchorEl] = useState(null);
  // Use startDate/endDate props if provided, otherwise use initialStartDate/initialEndDate
  const [dateRange, setDateRange] = useState({
    startDate: startDate || initialStartDate,
    endDate: endDate || initialEndDate,
  });
  const [noStartDate, setNoStartDate] = useState(false);
  const [noEndDate, setNoEndDate] = useState(false);
  const [reset, setReset] = useState(true);

  // Sync state with props when they change
  useEffect(() => {
    // Handle empty strings as undefined
    const normalizedStartDate = startDate === "" ? undefined : startDate;
    const normalizedEndDate = endDate === "" ? undefined : endDate;

    // Convert string dates to Date objects if needed
    const startDateObj = normalizedStartDate
      ? typeof normalizedStartDate === "string"
        ? new Date(normalizedStartDate)
        : normalizedStartDate
      : null;
    const endDateObj = normalizedEndDate
      ? typeof normalizedEndDate === "string"
        ? new Date(normalizedEndDate)
        : normalizedEndDate
      : null;

    // Update state only if dates are valid or both are undefined/null
    const newStartDate =
      startDateObj && !isNaN(startDateObj.getTime()) ? startDateObj : undefined;
    const newEndDate =
      endDateObj && !isNaN(endDateObj.getTime()) ? endDateObj : undefined;

    // Only update if values actually changed
    setDateRange((prev) => {
      const toIsoDay = (v) => {
        if (!v) return null;
        const d = v instanceof Date ? v : new Date(v);
        return Number.isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
      };
      const prevStartStr = toIsoDay(prev.startDate);
      const prevEndStr = toIsoDay(prev.endDate);
      const newStartStr = newStartDate
        ? newStartDate.toISOString().split("T")[0]
        : null;
      const newEndStr = newEndDate
        ? newEndDate.toISOString().split("T")[0]
        : null;

      if (prevStartStr !== newStartStr || prevEndStr !== newEndStr) {
        return {
          startDate: newStartDate,
          endDate: newEndDate,
        };
      }
      return prev;
    });
  }, [startDate, endDate]);

  // Format dates as ISO strings for API (YYYY-MM-DD)
  const formatDateForAPI = (date) => {
    if (!date) return "";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const handleOpen = (event) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const handleApply = () => {
    // Format dates as YYYY-MM-DD strings before passing
    const formatDateForAPI = (date) => {
      if (!date) return "";
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    // When applying, if onApply is provided, use it; otherwise use onChange
    if (onApply) {
      onApply(
        noStartDate ? "" : formatDateForAPI(dateRange.startDate),
        noEndDate ? "" : formatDateForAPI(dateRange.endDate),
      );
    } else if (onChange) {
      onChange({
        startDate: noStartDate ? "" : formatDateForAPI(dateRange.startDate),
        endDate: noEndDate ? "" : formatDateForAPI(dateRange.endDate),
      });
    }
    handleClose();
  };

  const handleChange = (item) => {
    setReset(false);
    let startDate = item.selection.startDate;
    let endDate = item.selection.endDate;
    const range = {
      startDate,
      endDate,
    };
    setDateRange(range);
    if (onChange) {
      onChange({
        startDate: range.startDate,
        endDate: range.endDate,
      });
    }
  };
  const handleClear = () => {
    setReset(true);
    setDateRange({ startDate: undefined, endDate: undefined });
    setNoStartDate(false);
    setNoEndDate(false);
    // Call onClear if provided, otherwise call onChange with empty values
    if (onClear) {
      onClear();
    } else if (onChange) {
      onChange({ startDate: "", endDate: "" });
    }
    handleClose();
    setTimeout(() => {
      setReset(false);
    }, 100);
  };
  const handleNoStartDateToggle = (e) => {
    const checked = e.target.checked;
    setNoStartDate(checked);
    if (checked) {
      setNoEndDate(false);
      setDateRange((prev) => ({
        ...prev,
        endDate: dateRange.endDate || new Date(),
        startDate: null,
      }));
      // Don't call onChange immediately - wait for Apply button
    } else {
      setDateRange((prev) => ({
        ...prev,
        startDate: new Date(),
        endDate: dateRange.endDate || new Date(),
      }));
      // Don't call onChange immediately - wait for Apply button
    }
  };
  const handleNoEndDateToggle = (e) => {
    const checked = e.target.checked;
    setNoEndDate(checked);
    if (checked) {
      setNoStartDate(false);
      setDateRange((prev) => ({
        ...prev,
        endDate: null,
        startDate: dateRange.startDate || new Date(),
      }));
      // Don't call onChange immediately - wait for Apply button
    } else {
      setDateRange((prev) => ({
        ...prev,
        endDate: new Date(),
        startDate: dateRange.startDate || new Date(),
      }));
      // Don't call onChange immediately - wait for Apply button
    }
  };

  const open = Boolean(anchorEl);
  const id = open ? "date-range-popover" : undefined;
  const dateSelected =
    (dateRange.startDate || noStartDate) && (dateRange.endDate || noEndDate);

  const resolvedWidth = width === "auto" ? "auto" : width;

  // Tailwind-based className logic for the Button
  const buttonClassName = `min-w-[140px] text-sm text-left h-[40px] overflow-hidden whitespace-nowrap text-ellipsis ${
    props.error && props.shouldShowError
      ? "border-[2px] border-red-500 outline-none"
      : "border-gray-300 focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
  } rounded-[12px] shadow-sm px-[14px] py-[8px] ${
    props.theme === "light" ? "bg-transparent" : "bg-gray-100"
  } ${props.className || ""} ${
    props.inActive && "pointer-events-none text-p-blue-dark"
  }`;

  // For the picker, always pass a valid Date for the unchecked side
  const pickerStartDate = noStartDate
    ? null
    : dateRange.startDate || new Date();
  const pickerEndDate = noEndDate ? null : dateRange.endDate || new Date();
  const staticRangesWithMondayWeek = defaultStaticRanges.map((range) => {
    const label = String(range?.label || "").toLowerCase();
    if (label !== "this week" && label !== "current week") return range;
    return {
      ...range,
      range: () => {
        const now = new Date();
        return {
          startDate: startOfWeek(now, { weekStartsOn: 1 }),
          endDate: endOfWeek(now, { weekStartsOn: 1 }),
        };
      },
    };
  });

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={buttonClassName}
        style={{
          width: resolvedWidth,
          minWidth: resolvedWidth === "auto" ? "140px" : resolvedWidth,
          color: dateSelected ? "var(--p-black)" : "var(--placeholder-text)",
        }}
      >
        {dateSelected ? (
          `${noStartDate ? "" : formatDate(dateRange.startDate)} ${
            noEndDate
              ? "Onwards"
              : `${noStartDate ? "Till" : "To"} ${formatDate(
                  dateRange.endDate,
                )}`
          }`
        ) : (
          <div className="flex items-center">
            <CalendarTodayIcon sx={{ fontSize: 16, marginBottom: "1px" }} />
            <span className="ml-2">{t("common.selectDateRange")}</span>
          </div>
        )}
      </button>
      <Popover
        id={id}
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{
          sx: {
            mt: 0.5,
            p: 1,
            width: 520,
            maxWidth: "98vw",
            borderRadius: 2,
            boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
            border: "1px solid #f0f0f0",
            backgroundColor: "#fff",
          },
        }}
      >
        {/* Clear, Apply and Close buttons */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 0.5,
            gap: 1,
          }}
        >
          <Button
            size="small"
            onClick={handleClear}
            sx={{
              fontSize: 10,
              px: 1,
              py: 0.5,
              minWidth: 0,
              color: "#888",
              textTransform: "none",
            }}
          >
            Clear
          </Button>
          {onApply && (
            <Button
              size="small"
              onClick={handleApply}
              disabled={!dateRange.startDate || !dateRange.endDate}
              sx={{
                fontSize: 10,
                px: 1,
                py: 0.5,
                minWidth: 0,
                color: "#fff",
                backgroundColor: "var(--p-blue)",
                textTransform: "none",
                "&:hover": {
                  backgroundColor: "#9CBA33",
                },
                "&:disabled": {
                  backgroundColor: "#ccc",
                  color: "#888",
                },
              }}
            >
              Apply
            </Button>
          )}
          <IconButton
            size="small"
            onClick={handleClose}
            sx={{ fontSize: 14, p: 0.5 }}
          >
            <CloseIcon fontSize="inherit" sx={{ fontSize: 14 }} />
          </IconButton>
        </Box>
        {/* Checkboxes for No Start Date and No End Date */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            mb: 1,
            mr: 1,
            gap: 2,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <input
              type="checkbox"
              id="no-start-date"
              checked={noStartDate}
              onChange={handleNoStartDateToggle}
              style={{ marginRight: 0 }}
            />
            <label
              htmlFor="no-start-date"
              style={{
                fontSize: 10,
                color: "var(--p-gray)",
                cursor: "pointer",
              }}
            >
              No Start Date
            </label>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <input
              type="checkbox"
              id="no-end-date"
              checked={noEndDate}
              onChange={handleNoEndDateToggle}
              style={{ marginRight: 0 }}
            />
            <label
              htmlFor="no-end-date"
              style={{
                fontSize: 10,
                color: "var(--p-gray)",
                cursor: "pointer",
              }}
            >
              No End Date
            </label>
          </Box>
        </Box>
        {/* DateRangePicker remains unchanged */}
        <DateRangePicker
          onChange={handleChange}
          showSelectionPreview={true}
          moveRangeOnFirstSelection={false}
          months={1}
          ranges={[
            {
              startDate: pickerStartDate || null,
              endDate: pickerEndDate || null,
              key: "selection",
            },
          ]}
          direction="horizontal"
          staticRanges={staticRangesWithMondayWeek}
          inputRanges={defaultInputRanges}
          showMonthAndYearPickers={true}
          disabled={noStartDate || noEndDate}
        />
        <style>{`
          .rdrCalendarWrapper {
              min-width: 0 !important;
              width: 50% !important;
              font-size: 11px !important;
              margin-left: 8px !important;
          }
          .rdrMonth {
              padding-left: 10px !important;
          }
        `}</style>
      </Popover>
    </>
  );
};

export default DateRangeComponent;
