import React, { useState, forwardRef } from "react";
import axios from "axios";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { getConfig, isValidDate } from "../../components/formatAmount";
import moment from "moment";
import InputField from "./InputField";

const formatMap = {
  "YYYY-MM-DD": "yyyy-MM-dd",
  "DD-MM-YYYY": "dd-MM-yyyy",
  "MM-DD-YYYY": "MM-dd-yyyy",
  "MM/DD/YYYY": "MM/dd/yyyy",
  "DD/MM/YYYY": "dd/MM/yyyy",
  "YYYY/MM/DD": "yyyy/MM/dd",
  "YYYY.MM.DD": "yyyy.MM.dd",
  "DD.MM.YYYY": "dd.MM.yyyy",
  "MM.DD.YYYY": "MM.dd.yyyy",
  "DD MMMM YYYY": "dd MMMM yyyy", // 28 May 2026
  "MMMM DD, YYYY": "MMMM dd, yyyy", // May 28, 2026
  "YYYY MMMM DD": "yyyy MMMM dd", // 2026 May 28
  "DD MMM YYYY": "dd MMM yyyy", // 28 May 2026 (short month)
  "MMM DD, YYYY": "MMM dd, yyyy", // May 28, 2026 (short month)
  "DD/MM/YY": "dd/MM/yy",
  "MM/DD/YY": "MM/dd/yy",
  "YY-MM-DD": "yy-MM-dd",
  "DD-MM-YY": "dd-MM-yy",
};

const CustomInput = forwardRef(
  (
    { value, onClick, placeholder, className, shouldShowError, error, inputTheme = "gray" },
    ref,
  ) => (
    <InputField
      value={value}
      onClick={onClick}
      placeholder={placeholder}
      ref={ref}
      readOnly
      theme={inputTheme}
      className={`${inputTheme === "invoice" ? "text-sm" : "text-base"} w-full ${
        error && shouldShowError ? "error" : ""
      } ${className}`}
      shouldShowError={shouldShowError}
      error={error}
      showErrorText={false} // Error text is handled by the parent
    />
  )
);

const CustomDatePicker = ({
  value,
  onChange,
  width = "100%",
  style = {},
  bgColor,
  error,
  placeholder,
  shouldShowError,
  showErrorText = true,
  required = true,
  theme = "default",
  /** Match invoice Phone/Fax: white field, rounded-lg, compact padding */
  documentFieldStyle = false,
  disabled = false,
  yearOnly = false,
  className = "",
  minDate = null,
  maxDate = null,
  filterDate = null,
  excludeDates = null,
  dayClassName = null,
  clearable = true,
  showTimeSelect = false,
  showTimeSelectOnly = false,
  timeIntervals = 15,
  timeCaption = "Time",
  timeFormat,
  dateFormat: customDateFormat,
}) => {
  const configDateFormat = getConfig().date_format;
  const baseFormat = yearOnly
    ? "yyyy"
    : formatMap[configDateFormat] || "yyyy-MM-dd";
  const timeOnly = Boolean(showTimeSelectOnly);
  const format =
    customDateFormat ||
    (timeOnly
      ? timeFormat || "h:mm aa"
      : showTimeSelect
        ? `${baseFormat} hh:mm aa`
        : baseFormat);
  const defaultPlaceholder = timeOnly
    ? "Select time"
    : configDateFormat || "Select Date";

  console.debug("CustomDatePicker - value:", value, "type:", typeof value);
  console.debug("CustomDatePicker - configDateFormat:", configDateFormat);
  console.debug("CustomDatePicker - format:", format);

  return (
    <>
      <div style={{ width, ...style }} className="relative w-full">
        <DatePicker
          selected={value && isValidDate(value) ? new Date(value) : null}
          onChange={(date) => {
            console.debug(
              "CustomDatePicker - onChange called with:",
              date,
              "type:",
              typeof date
            );
            onChange(date || null);
          }}
          showYearDropdown={!yearOnly && !timeOnly}
          scrollableYearDropdown={!yearOnly && !timeOnly}
          showMonthDropdown={!yearOnly && !timeOnly}
          dropdownMode="select"
          dateFormat={format}
          showTimeSelect={showTimeSelect || timeOnly}
          showTimeSelectOnly={timeOnly}
          timeIntervals={timeIntervals}
          timeCaption={timeCaption}
          {...(timeFormat ? { timeFormat } : {})}
          required={required}
          readOnly={false}
          disabled={disabled}
          minDate={
            !timeOnly && minDate && isValidDate(minDate)
              ? new Date(minDate)
              : undefined
          }
          maxDate={
            !timeOnly && maxDate && isValidDate(maxDate)
              ? new Date(maxDate)
              : undefined
          }
          filterDate={
            !timeOnly && typeof filterDate === "function"
              ? filterDate
              : undefined
          }
          excludeDates={
            !timeOnly && Array.isArray(excludeDates) && excludeDates.length > 0
              ? excludeDates
              : undefined
          }
          dayClassName={
            typeof dayClassName === "function" ? dayClassName : undefined
          }
          placeholderText={placeholder || defaultPlaceholder}
          wrapperClassName="custom-datepicker-wrapper"
          isClearable={clearable && !disabled}
          popperPlacement="auto"
          popperModifiers={[
            {
              name: "offset",
              options: {
                offset: [0, 8],
              },
            },
            {
              name: "flip",
              options: {
                fallbackPlacements: ["top"],
                padding: 8,
              },
            },
            {
              name: "preventOverflow",
              options: {
                boundary: "viewport",
                padding: 8,
              },
            },
          ]}
          popperProps={{
            strategy: "fixed",
          }}
          popperClassName="datepicker-on-top"
          portalId="datepicker-portal"
          {...(yearOnly && {
            showYearPicker: true,
          })}
          customInput={
            <CustomInput
              placeholder={placeholder || defaultPlaceholder}
              error={error}
              shouldShowError={shouldShowError}
              inputTheme={documentFieldStyle ? "invoice" : "gray"}
              className={`custom-datepicker ${className}`}
            />
          }
        />

        <style>
          {`
          .custom-datepicker-wrapper {
            width: ${width} !important;
            border-radius: ${documentFieldStyle ? "8px" : "12px"} !important;
            position: relative !important;
          }
          .custom-datepicker {
            width: 100% !important;
            border-radius: ${documentFieldStyle ? "8px" : "12px"} !important;
            background: ${
              documentFieldStyle
                ? "#ffffff"
                : theme !== "light"
                  ? "var(--input-background-gray)"
                  : "transparent"
            } !important;
          }
          .react-datepicker__input-container input {
            border-radius: ${documentFieldStyle ? "8px" : "12px"} !important;
            background: ${documentFieldStyle ? "#ffffff" : bgColor};
            width: 100% !important;
            padding: ${documentFieldStyle ? "10px 12px" : "8px 16px"} !important;
            font-size: ${documentFieldStyle ? "14px" : "inherit"} !important;
            color: inherit;
            ${
              documentFieldStyle
                ? `
            border: 1px solid #D1D5DB !important;
            box-shadow: none !important;
            `
                : ""
            }
          }
          /* Make Contract Date input text black wherever contract-date-field class is used */
          .react-datepicker__input-container input.contract-date-field {
            color: #000000 !important;
            -webkit-text-fill-color: #000000 !important;
            opacity: 1 !important;
          }
          /* Make Supplier Contract Date input text black wherever supplier-contract-date-field class is used */
          .react-datepicker__input-container input.supplier-contract-date-field {
            color: #000000 !important;
            -webkit-text-fill-color: #000000 !important;
            opacity: 1 !important;
          }
          .react-datepicker__input-container input:focus {
            outline: none !important;
            border-width: ${documentFieldStyle ? "1px" : "2px"} !important;
            border-color: ${documentFieldStyle ? "var(--p-blue)" : "var(--p-blue-light)"} !important;
            outline: none !important;
            box-shadow: ${
              documentFieldStyle ? "0 0 0 1px var(--p-blue)" : "none"
            } !important;
          }
          .react-datepicker__input-container input.error {
            border-width: 2px !important;
            border-color: var(--p-red) !important;
            outline: none !important;
            box-shadow: none !important;
          }
          .react-datepicker__year-select,
          .react-datepicker__month-select {
            background: white;
            padding: 8px 12px;
            border-right: 8px solid white !important;
          }
          .react-datepicker__triangle {
            display: none;
          }
          .react-datepicker__header__dropdown {
            margin: 12px !important;
            display: flex !important;
          }
          .datepicker-on-top {
            z-index: 99999 !important;
          }
          .react-datepicker {
            border-radius: 12px !important;
            padding: 12px 0px;
            background-color: #f9fafb !important;
            font-size: 12px !important;
            margin-bottom: 10px;
          }
          .react-datepicker__navigation--next,
          .react-datepicker__navigation--previous {
            top: 19px !important;
          }
          .react-datepicker__header {
            background-color: #f9fafb !important;
            border-bottom-width: 1px !important;
            border-bottom-color: var(--p-gray-dark) !important;
            border-radius: 12px 12px 0 0 !important;
          }
          .react-datepicker__current-month,
          .react-datepicker-time__header {
            font-weight: 600;
            color: #374151;
          }
          .react-datepicker__day-name,
          .react-datepicker__day:not(.react-datepicker__day--disabled):not(
              .react-datepicker__day--selected
            ):not(.react-datepicker__day--keyboard-selected),
          .react-datepicker__time-name {
            color: #1f2937 !important;
          }
          .react-datepicker__day--disabled,
          .react-datepicker__day--disabled:hover,
          .react-datepicker__month-text--disabled,
          .react-datepicker__month-text--disabled:hover,
          .react-datepicker__year-text--disabled,
          .react-datepicker__year-text--disabled:hover,
          .react-datepicker__day--today.react-datepicker__day--disabled,
          .react-datepicker__day--today.react-datepicker__day--disabled:hover {
            color: #d1d5db !important;
            background-color: transparent !important;
            cursor: not-allowed !important;
            opacity: 0.5 !important;
            pointer-events: none !important;
            font-weight: 400 !important;
          }
          .react-datepicker__day--selected,
          .react-datepicker__day--keyboard-selected,
          .react-datepicker__day--selected.react-datepicker__day--today,
          .react-datepicker__day--keyboard-selected.react-datepicker__day--today {
            background-color: var(--p-blue-light) !important;
            color: #ffffff !important;
            -webkit-text-fill-color: #ffffff !important;
            border-radius: 8px !important;
            opacity: 1 !important;
            text-decoration: none !important;
            pointer-events: auto !important;
            font-weight: 600 !important;
          }
          .react-datepicker__day--selected:hover,
          .react-datepicker__day--keyboard-selected:hover,
          .react-datepicker__day--selected.react-datepicker__day--today:hover,
          .react-datepicker__day--keyboard-selected.react-datepicker__day--today:hover {
            background-color: var(--p-blue-light) !important;
            color: #ffffff !important;
            -webkit-text-fill-color: #ffffff !important;
          }
          .react-datepicker__day:not(.react-datepicker__day--selected):not(
              .react-datepicker__day--disabled
            ):hover {
            background-color: var(--p-blue-light) !important;
            color: white !important;
            border-radius: 8px !important;
          }
          .react-datepicker__year-dropdown,
          .react-datepicker__month-dropdown {
            border-radius: 8px !important;
            background: white;
            padding: 5px;
          }
          .react-datepicker__year-option,
          .react-datepicker__month-option {
            padding: 5px 10px;
            border-radius: 4px;
          }
          .react-datepicker__year-option:hover,
          .react-datepicker__month-option:hover {
            background-color: #eff6ff !important;
          }
          .react-datepicker__close-icon {
            padding: 0 !important;
            right: 2px !important;
            top: 50% !important;
            transform: translateY(-50%) !important;
            width: 20px !important;
            height: 20px !important;
            font-size: 0 !important;
            z-index: 2;
            background: transparent !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
          }
          .react-datepicker__close-icon::after {
            content: "×" !important;
            background-color: transparent !important;
            background: transparent !important;
            font-size: 20px !important;
            line-height: 1 !important;
            padding: 0 !important;
            margin: 0 !important;
            height: 20px !important;
            width: 20px !important;
            color: #9ca3af !important;
            font-weight: 400 !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            border-radius: 0 !important;
          }
          .react-datepicker__close-icon:hover::after {
            background-color: transparent !important;
            color: #6b7280 !important;
          }
        `}
        </style>
      </div>

      {error && shouldShowError && showErrorText && (
        <p className="text-red-500 text-base p-2">{error}</p>
      )}
    </>
  );
};

export default CustomDatePicker;
