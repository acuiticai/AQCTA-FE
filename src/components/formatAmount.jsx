// configuration.js
import React, { useState, useEffect, useContext } from "react";
import moment from "moment-timezone";
import { EmptyCellContainer } from "@/page-layouts/index";
import {
  getCachedConfigurationResponse,
  applyThemeColorVars,
} from "@/utils/sessionApiCache";

// ✅ Central Config Object to hold dynamic settings
export const config = {
  decimal_places: 2, // Default decimal places
  date_format: "DD-MM-YYYY", // Default date format
  time_format: "hh:mm A", // Default time format
};

// ✅ Fetch Configuration Settings from API (no hook here)
export const fetchConfiguration = async (token) => {
  try {
    if (!token) return;

    const response = await getCachedConfigurationResponse(token);
    if (!response) return;

    if (response.status === 200 && response.data && response.data[0]) {
      const data = response.data[0];

      config.decimal_places = data.amount_format || config.decimal_places;
      config.date_format = data.date_format || config.date_format;
      config.time_format = data.time_format || config.time_format;

      applyThemeColorVars({
        buttons_color: data.buttons_color,
        topbar_color: data.topbar_color,
        leftbar_color: data.leftbar_color,
        buttons_text_color: data.buttons_text_color,
      });

      // Save config to localStorage
      localStorage.setItem(
        "configurations",
        JSON.stringify({
          // Used for dynamic page title + other UI places
          name: data.name || "",
          decimal_places: config.decimal_places,
          date_format: config.date_format,
          time_format: config.time_format,
          buttons_color: data.buttons_color,
          topbar_color: data.topbar_color,
          leftbar_color: data.leftbar_color,
          buttons_text_color: data.buttons_text_color,
        })
      );

      console.log("✅ Configuration Updated:", config);
    } else {
      console.warn("⚠️ No configuration data received from server.");
    }
  } catch (error) {
    console.error("❌ Error fetching configuration:", error);
  }
};

// Helper to get config from localStorage or fallback to default
export const getConfig = () => {
  try {
    const stored = localStorage.getItem("configurations");
    if (stored) {
      return { ...config, ...JSON.parse(stored) };
    }
  } catch {}
  return config;
};

/**
 * Resolve currency for display - handles ObjectId, populated object, or symbol string.
 * @param {string|object} currency - Currency (ObjectId string, {symbol, name, prefix}, or "MYR")
 * @param {Array} currenciesList - Optional list of currency objects from API to resolve ObjectId
 * @returns {string} Display string e.g. "MYR"
 */
export const getCurrencyDisplay = (currency, currenciesList = []) => {
  if (currency == null) return "—";
  if (typeof currency === "object") {
    return (
      currency.symbol ||
      currency.code ||
      currency.currencyCode ||
      currency.name ||
      currency.prefix ||
      "—"
    );
  }
  if (typeof currency === "string") {
    // ObjectId pattern (24 hex chars) - resolve from list if available
    if (/^[a-f0-9]{24}$/i.test(currency)) {
      if (currenciesList?.length) {
        const found = currenciesList.find(
          (c) => String(c._id) === currency || c.symbol === currency,
        );
        return (
          found?.symbol ||
          found?.code ||
          found?.currencyCode ||
          found?.name ||
          found?.prefix ||
          ""
        );
      }
      return "";
    }
    return currency;
  }
  return "—";
};

/** Format currency + amount without a space, e.g. RM100.00 */
export const formatCurrencyAmount = (
  currency,
  amount,
  showValueInCommas = true,
  currenciesList = [],
) => {
  const code = getCurrencyDisplay(currency, currenciesList);
  const formatted = formatAmount(amount, showValueInCommas);
  if (!code || code === "—") return formatted;
  return `${code}${formatted}`;
};

// ✅ Format Amount based on dynamic decimal places
export const formatAmount = (amount, showValueInCommas = true) => {
  const cfg = getConfig();
  if (isNaN(amount) || amount === null || amount === undefined) return "N/A";

  const formatted = parseFloat(amount).toFixed(cfg.decimal_places);
  if (showValueInCommas) {
    return formatted.replace(/\B(?=(\d{3})+(?!\d))/g, ","); // Adds commas
  }
  return formatted;
};

// ✅ Format Quantity - Always uses 2 decimal places for sales and purchase quantities
export const formatQuantity = (quantity, showValueInCommas = true) => {
  if (isNaN(quantity) || quantity === null || quantity === undefined)
    return "N/A";

  const formatted = parseFloat(quantity).toFixed(2); // Always 2 decimal places for quantities
  if (showValueInCommas) {
    return formatted.replace(/\B(?=(\d{3})+(?!\d))/g, ","); // Adds commas
  }
  return formatted;
};

export const formatDateTime = (dateTime) => {
  const cfg = getConfig();
  if (!dateTime) return <EmptyCellContainer />;
  return moment(dateTime).isValid()
    ? moment(dateTime).format(cfg.date_format + " " + cfg.time_format)
    : dateTime;
};

// ✅ Format Date based on dynamic date format
export const formatDate = (
  date,
  showMonthAndYear = false,
  showTime = false
) => {
  try {
    const cfg = getConfig();
    if (!date || !isValidDate(date)) return date;

    const supportedFormats = [
      moment.ISO_8601,
      "YYYY-MM-DD",
      "DD-MM-YYYY",
      "MM-DD-YYYY",
      "MM/DD/YYYY",
      "DD/MM/YYYY",
      "YYYY/MM/DD",
      "YYYY.MM.DD",
      "DD.MM.YYYY",
      "MM.DD.YYYY",
      "DD MMMM YYYY", // 28 May 2026
      "MMMM DD, YYYY", // May 28, 2026
      "YYYY MMMM DD", // 2026 May 28
      "DD MMM YYYY", // 28 May 2026 (short month)
      "MMM DD, YYYY", // May 28, 2026 (short month)
      "DD/MM/YY",
      "MM/DD/YY",
      "YY-MM-DD",
      "DD-MM-YY",
      // With time
      "YYYY-MM-DDTHH:mm:ss.SSSZ",
      "YYYY-MM-DDTHH:mm:ssZ",
      "YYYY-MM-DD HH:mm:ss",
      "DD/MM/YYYY, HH:mm:ss",
      "DD-MM-YYYY, HH:mm:ss",
      "MM-DD-YYYY, HH:mm:ss",
      "YYYY/MM/DD, HH:mm:ss",
      "YYYY.MM.DD, HH:mm:ss",
      "DD.MM.YYYY, HH:mm:ss",
      "MM.DD.YYYY, HH:mm:ss",
      "DD MMMM YYYY, HH:mm:ss",
      "MMMM DD, YYYY, HH:mm:ss",
      "YYYY MMMM DD, HH:mm:ss",
      "DD MMM YYYY, HH:mm:ss",
      "MMM DD, YYYY, HH:mm:ss",
      "DD/MM/YY, HH:mm:ss",
      "MM/DD/YY, HH:mm:ss",
      "YY-MM-DD, HH:mm:ss",
      "DD-MM-YY, HH:mm:ss",
      "HH:mm:ss",
      "hh:mm A",
      "HH:mm",
      "hh:mm a",
    ];

    let m = moment(date, supportedFormats, true);

    if (!m.isValid()) {
      // Try parsing as a Date object (for edge cases)
      m = moment(new Date(date));
    }

    if (!m.isValid()) {
      return date; // fallback: show raw value
    }

    // If only time is provided (no date part)
    if (
      moment(
        date,
        ["HH:mm:ss", "hh:mm A", "HH:mm", "hh:mm a"],
        true
      ).isValid() &&
      !/\d{4}/.test(date) // no year in string
    ) {
      // Return in user's preferred time format
      return m.format(cfg.time_format);
    }

    // If only month and year are requested
    if (showMonthAndYear) {
      return m.format("MMM YYYY");
    }

    // If time is present and not 00:00:00, show date + time
    const hasTime =
      m.hour() !== 0 ||
      m.minute() !== 0 ||
      m.second() !== 0 ||
      /T\d{2}:\d{2}/.test(date) ||
      /\d{2}:\d{2}/.test(date);

    if (hasTime && showTime) {
      return `${m.format(cfg.date_format)}, ${m.format(cfg.time_format)}`;
    }
    return m.format(cfg.date_format);
  } catch (error) {
    console.error("❌ Error formatting date:", error);
    return date;
  }
};

export const isValidDate = (date) => {
  try {
    return new Date(date).toString() !== "Invalid Date";
  } catch (error) {
    return false;
  }
};

// Default when staff shift has no timezone (matches backend TIMEZONE)
export const DEFAULT_STAFF_TIMEZONE = "Asia/Kuala_Lumpur";

export const resolveStaffTimezone = (shiftOrTz) => {
  const tz =
    typeof shiftOrTz === "string"
      ? shiftOrTz
      : shiftOrTz?.timezone;
  if (typeof tz === "string" && tz.trim() && moment.tz.zone(tz.trim())) {
    return tz.trim();
  }
  return DEFAULT_STAFF_TIMEZONE;
};

/** Parse instant the same way as attendance API (UTC ISO → staff TZ). */
export const momentInStaffTimezone = (time, timezone) => {
  const tz = resolveStaffTimezone(timezone);
  if (!time) return moment.invalid();
  if (time instanceof Date) {
    return moment(time).tz(tz);
  }
  const asUtc = moment.utc(time);
  return asUtc.isValid() ? asUtc.tz(tz) : moment(time).tz(tz);
};

/** Format a timestamp in staff shift timezone (matches backend attendance). */
export const formatTimeInTimezone = (time, timezone) => {
  const cfg = getConfig();
  if (!time) return "N/A";
  const m = momentInStaffTimezone(time, timezone);
  return m.isValid() ? m.format(cfg.time_format) : String(time);
};

/**
 * Prefer API formattedTime (HH:mm, already in staff TZ); fallback to timestamp.
 */
export const formatAttendanceTime = ({
  formattedTime,
  timestamp,
  timezone,
}) => {
  const tz = resolveStaffTimezone(timezone);
  if (
    formattedTime &&
    formattedTime !== "NaN:NaN" &&
    /^\d{1,2}:\d{2}$/.test(String(formattedTime).trim())
  ) {
    const cfg = getConfig();
    const m = moment.tz(
      `1970-01-01 ${formattedTime}`,
      "YYYY-MM-DD HH:mm",
      tz
    );
    if (m.isValid()) return m.format(cfg.time_format);
  }
  return formatTimeInTimezone(timestamp, tz);
};

/** HH:mm in staff timezone (for time inputs on attendance edit). */
export const toTimeInputValueInTimezone = (timestamp, timezone) => {
  const m = momentInStaffTimezone(timestamp, timezone);
  return m.isValid() ? m.format("HH:mm") : "";
};

/** IANA timezone code only, e.g. Asia/Karachi */
export const getShiftTimezoneCode = (tzCode) => {
  if (typeof tzCode === "string" && tzCode.trim()) return tzCode.trim();
  return resolveStaffTimezone(tzCode);
};

/** Compact 12h for shift line, e.g. 10am or 3:31pm */
export const formatShiftTimeCompact = (timeStr) => {
  if (!timeStr || !String(timeStr).includes(":")) return "";
  const m = moment(String(timeStr).trim(), ["HH:mm", "H:mm"], true);
  if (!m.isValid()) return String(timeStr);
  return m.minutes() === 0
    ? m.format("ha").toLowerCase()
    : m.format("h:mma").toLowerCase();
};

/** Single shift summary line, e.g. Morning Shift: 10am to 6pm (Asia/Karachi) */
export const formatShiftScheduleDisplay = (shift) => {
  if (!shift?.startTime && !shift?.endTime) return null;
  const start = formatShiftTimeCompact(shift.startTime);
  const end = formatShiftTimeCompact(shift.endTime);
  const tz = getShiftTimezoneCode(shift?.timezone);
  const shiftName = shift?.name?.trim() || "Shift";
  return `${shiftName}: ${start} to ${end} (${tz})`;
};

/** Calendar date YYYY-MM-DD in staff timezone (matches backend attendance date). */
export const formatDateToYMDInTimezone = (date, timezone) => {
  const tz = resolveStaffTimezone(timezone);
  const m = moment(date).tz(tz);
  return m.isValid() ? m.format("YYYY-MM-DD") : null;
};

// ✅ Format Time based on dynamic time format (browser local timezone)
export const formatTime = (time) => {
  const cfg = getConfig();
  if (!time) return "N/A";
  return moment(time).isValid() ? moment(time).format(cfg.time_format) : time;
};

export const formatDateToYMD = (date) => {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return null; // handle invalid dates
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0"); // months are 0-based
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};
