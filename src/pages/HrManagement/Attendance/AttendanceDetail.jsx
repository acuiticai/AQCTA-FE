"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { DataTable, PageHeader, CustomDatePicker } from "@/page-layouts/index";
import { useLocation } from "react-router-dom";
import { Link } from "react-router-dom";
import axios from "axios";
import moment from "moment-timezone";
import { notifyError, notifySuccess } from "@/utils/toast";
import {
  formatDate,
  formatAttendanceTime,
  formatDateToYMDInTimezone,
  formatShiftScheduleDisplay,
  resolveStaffTimezone,
  toTimeInputValueInTimezone,
} from "@/components/formatAmount";
import {
  downloadExcel,
  downloadPDF,
  monthRangeToApiRange,
} from "./attendance-export-functions";
import csv from "../../../assets/img/icons/csv.png";
import pdf from "../../../assets/img/icons/pdf.png";

const useQuery = () => {
  return new URLSearchParams(useLocation().search);
};

// Base URL for API calls
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const readConfiguredPageSize = () => {
  try {
    const raw = localStorage.getItem("configurations");
    if (!raw) return 10;
    const cfg = JSON.parse(raw);
    const stored = cfg?.table_entries_per_page;
    if (Number.isFinite(stored) && stored > 0) return stored;
  } catch {
    // ignore
  }
  return 10;
};

const getStatusColor = (status) => {
  switch (status) {
    case "Present":
      return "text-green-500 bg-green-50";
    case "Absent":
      return "text-red-500 bg-red-50";
    case "Leave":
      return "text-yellow-500 bg-yellow-50";
    default:
      return "text-yellow-500 bg-yellow-50";
  }
};

const formatAdminActionLabel = (action) => {
  switch (action) {
    case "added":
      return "Record added";
    case "edited":
      return "Record edited";
    case "marked_absent":
      return "Marked absent";
    default:
      return action || "Activity";
  }
};

const isStaffCheckInOutEntry = (entry) => {
  const ip = (entry?.ipAddress || "").toLowerCase();
  return !ip.includes("manual") && !ip.includes("admin");
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const MonthRangePicker = ({ from, to, onChange, onClear, fullWidth = false }) => {
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(from || "");
  const [draftTo, setDraftTo] = useState(to || "");
  const [year, setYear] = useState(() => {
    if (from) return parseInt(from.split("-")[0], 10);
    return new Date().getFullYear();
  });
  const [hovered, setHovered] = useState(null); // "YYYY-MM"
  const ref = useRef(null);

  useEffect(() => {
    if (!open) {
      setDraftFrom(from || "");
      setDraftTo(to || "");
    }
  }, [from, to, open]);

  const closePicker = useCallback(() => {
    setOpen(false);
    setDraftFrom(from || "");
    setDraftTo(to || "");
    setHovered(null);
  }, [from, to]);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        closePicker();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [closePicker]);

  const toMonthNum = (ym) => {
    if (!ym) return null;
    const [y, m] = ym.split("-").map(Number);
    return y * 12 + (m - 1);
  };

  const formatMonth = (ym) => {
    const [y, m] = ym.split("-").map(Number);
    return `${MONTHS[m - 1]} ${y}`;
  };

  const handleMonthClick = (ym) => {
    if (!draftFrom || (draftFrom && draftTo)) {
      setDraftFrom(ym);
      setDraftTo("");
      setYear(parseInt(ym.split("-")[0], 10));
      return;
    }

    let nextFrom = draftFrom;
    let nextTo = ym;
    if (toMonthNum(ym) < toMonthNum(draftFrom)) {
      nextFrom = ym;
      nextTo = draftFrom;
    }

    setDraftFrom(nextFrom);
    setDraftTo(nextTo);
    onChange({ from: nextFrom, to: nextTo });
    setOpen(false);
    setHovered(null);
  };

  const getLabel = () => {
    if (open && draftFrom && !draftTo) {
      return `${formatMonth(draftFrom)} – pick end month`;
    }
    if (!from) return "Select month range";
    if (!to || to === from) return formatMonth(from);
    return `${formatMonth(from)} – ${formatMonth(to)}`;
  };

  const isSelecting = open && draftFrom && !draftTo;

  const getMonthState = (ym) => {
    const activeFrom = open ? draftFrom : from;
    const activeTo = open ? draftTo : to;
    const n = toMonthNum(ym);
    const fromN = toMonthNum(activeFrom);
    const toN = toMonthNum(
      activeTo || (isSelecting ? hovered : null)
    );
    const [lo, hi] =
      fromN <= (toN ?? fromN) ? [fromN, toN ?? fromN] : [toN ?? fromN, fromN];

    if (n === fromN && (!activeTo || activeTo === activeFrom)) return "single";
    if (n === lo) return "start";
    if (n === hi) return "end";
    if (lo != null && hi != null && n > lo && n < hi) return "in-range";
    return "none";
  };

  const toggleOpen = () => {
    if (open) {
      closePicker();
      return;
    }
    setDraftFrom(from || "");
    setDraftTo(to || "");
    if (from) {
      setYear(parseInt(from.split("-")[0], 10));
    }
    setOpen(true);
  };

  return (
    <div className={`relative ${fullWidth ? "w-full" : ""}`} ref={ref}>
      <button
        type="button"
        onClick={toggleOpen}
        className={`flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl shadow-sm text-sm text-gray-700 hover:bg-gray-50 transition ${
          fullWidth ? "w-full justify-between" : ""
        }`}
      >
        <div className={`flex items-center gap-2 ${fullWidth ? "min-w-0 flex-1" : ""}`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
            <line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/>
            <line x1="3" x2="21" y1="10" y2="10"/>
          </svg>
          <span className={`${from ? "text-gray-800 font-medium" : "text-gray-400"} ${fullWidth ? "truncate" : ""}`}>
            {getLabel()}
          </span>
        </div>
        {from && (
          <span
            className="ml-1 shrink-0 text-gray-400 hover:text-gray-600"
            onClick={(e) => { e.stopPropagation(); onClear(); }}
          >✕</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl z-20 border border-gray-100 p-4">
          {/* Year navigation */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => setYear((y) => y - 1)}
              className="p-1 rounded-lg hover:bg-gray-100 text-gray-500"
            >‹</button>
            <span className="text-sm font-semibold text-gray-700">{year}</span>
            <button
              type="button"
              onClick={() => setYear((y) => y + 1)}
              className="p-1 rounded-lg hover:bg-gray-100 text-gray-500"
            >›</button>
          </div>

          {/* Hint */}
          <p className="text-xs text-center text-gray-400 mb-3">
            {isSelecting
              ? `Start: ${formatMonth(draftFrom)} — now pick the end month`
              : "Click a month to start the range"}
          </p>

          {/* Month grid */}
          <div className="grid grid-cols-4 gap-1">
            {MONTHS.map((name, i) => {
              const ym = `${year}-${String(i + 1).padStart(2, "0")}`;
              const state = getMonthState(ym);
              const isStart = state === "start" || state === "single";
              const isEnd = state === "end" || state === "single";
              const inRange = state === "in-range";

              return (
                <button
                  key={ym}
                  type="button"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => handleMonthClick(ym)}
                  onMouseEnter={() => isSelecting && setHovered(ym)}
                  onMouseLeave={() => setHovered(null)}
                  className={`
                    relative py-2 text-xs font-medium rounded-lg transition select-none
                    ${isStart || isEnd ? "bg-[var(--p-blue)] text-white z-10" : ""}
                    ${inRange ? "bg-blue-100 text-blue-700 rounded-none" : ""}
                    ${!isStart && !isEnd && !inRange ? "text-gray-700 hover:bg-gray-100" : ""}
                  `}
                >
                  {name}
                </button>
              );
            })}
          </div>

          {/* Clear */}
          {(from || to || draftFrom) && (
            <button
              type="button"
              onClick={() => {
                onClear();
                setDraftFrom("");
                setDraftTo("");
                setOpen(false);
                setHovered(null);
              }}
              className="mt-3 w-full py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition"
            >
              Clear selection
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default function AttendanceRecord() {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(readConfiguredPageSize);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [attendanceData, setAttendanceData] = useState([]);
  const [statsData, setStatsData] = useState({});
  const [userProfile, setUserProfile] = useState({});
  const [displayPeriod, setDisplayPeriod] = useState("");
  const [totalPages, setTotalPages] = useState(1);
  const [displayCheckInOuts, setDisplayCheckInOuts] = useState(false);
  const [viewAllEntries, setViewAllEntries] = useState(false);
  const [rangeFilter, setRangeFilter] = useState({ from: "", to: "" });
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [editFirstTime, setEditFirstTime] = useState("");
  const [editLastTime, setEditLastTime] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addDate, setAddDate] = useState(null);
  const [addFirstTime, setAddFirstTime] = useState("");
  const [addLastTime, setAddLastTime] = useState("");
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState(null);
  const [addMarkAsAbsent, setAddMarkAsAbsent] = useState(false);
  const [editMarkAsAbsent, setEditMarkAsAbsent] = useState(false);
  const [adminActivityLogEntries, setAdminActivityLogEntries] = useState([]);
  const [recentActivityModalOpen, setRecentActivityModalOpen] = useState(false);
  const [recentActivityPage, setRecentActivityPage] = useState(1);
  const [recentActivityPerPage, setRecentActivityPerPage] = useState(
    readConfiguredPageSize
  );
  const [staffTimezone, setStaffTimezone] = useState(
    () => resolveStaffTimezone(null)
  );
  const attendanceFetchIdRef = useRef(0);
  const mountFetchKeyRef = useRef("");

  const getStaffTz = () =>
    staffTimezone || resolveStaffTimezone(userProfile?.shift);

  const maxAddAttendanceDate = useMemo(() => {
    const tz = staffTimezone || resolveStaffTimezone(userProfile?.shift);
    const today = moment.tz(tz);
    // End of calendar day — react-datepicker compares time; midnight maxDate disables today.
    return new Date(
      today.year(),
      today.month(),
      today.date(),
      23,
      59,
      59,
      999
    );
  }, [staffTimezone, userProfile?.shift]);

  const isAddAttendanceDateSelectable = (date) => {
    if (!date) return false;
    const tz = staffTimezone || resolveStaffTimezone(userProfile?.shift);
    const selectedKey = moment
      .tz([date.getFullYear(), date.getMonth(), date.getDate()], tz)
      .format("YYYY-MM-DD");
    const todayKey = moment.tz(tz).format("YYYY-MM-DD");
    return selectedKey <= todayKey;
  };

  const formatAdminLogTime = (performedAt) => {
    if (!performedAt) return "-";
    return moment(performedAt)
      .tz(getStaffTz())
      .format("YYYY.MM.DD hh:mm A");
  };

  const renderAdminLogDetails = (log) => (
    <>
      {log.details || "-"}
      {log.previousStatus && log.newStatus && (
        <span className="text-gray-400 ml-1">
          ({log.previousStatus} → {log.newStatus})
        </span>
      )}
    </>
  );

  const sortAdminLogsLatestFirst = (logs = []) =>
    [...logs].sort(
      (a, b) => new Date(b.performedAt || 0) - new Date(a.performedAt || 0)
    );

  const recentActivityTotalPages = Math.max(
    1,
    Math.ceil(adminActivityLogEntries.length / recentActivityPerPage)
  );

  const paginatedRecentActivityLogs = useMemo(() => {
    const start = (recentActivityPage - 1) * recentActivityPerPage;
    return adminActivityLogEntries.slice(start, start + recentActivityPerPage);
  }, [adminActivityLogEntries, recentActivityPage, recentActivityPerPage]);

  const selectedRecordAdminLogs = useMemo(
    () => sortAdminLogsLatestFirst(viewAllEntries?.adminActivityLogs),
    [viewAllEntries]
  );

  useEffect(() => {
    if (recentActivityPage > recentActivityTotalPages) {
      setRecentActivityPage(recentActivityTotalPages);
    }
  }, [recentActivityPage, recentActivityTotalPages]);

  const formatStaffTime = (checkInOrOut) => {
    if (!checkInOrOut) return "N/A";
    return formatAttendanceTime({
      formattedTime: checkInOrOut.formattedTime,
      timestamp: checkInOrOut.timestamp,
      timezone: getStaffTz(),
    });
  };

  useEffect(() => {
    console.log("new entries: ", viewAllEntries);
  }, [viewAllEntries]);
  const query = useQuery();
  const employee_id = query.get("id");

  const timeToMinutes = (timeStr) => {
    if (!timeStr || !timeStr.includes(":")) return null;
    const [h, m] = timeStr.split(":").map((n) => Number(n));
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  };

  const parseRunEODAfterToMinutes = (value) => {
    if (value == null) return 0;
    if (typeof value === "number" && !Number.isNaN(value)) {
      return Math.round(value * 60);
    }
    if (typeof value === "string") {
      if (value.includes(":")) {
        const [h, m] = value.split(":").map((n) => Number(n) || 0);
        return h * 60 + m;
      }
      const asNumber = Number(value);
      if (!Number.isNaN(asNumber)) {
        return Math.round(asNumber * 60);
      }
    }
    return 0;
  };

  const openEditModal = (record) => {
    setEditRecord(record);
    const tz = getStaffTz();
    const isAbsent = record?.status === "Absent";
    setEditMarkAsAbsent(isAbsent);
    setEditFirstTime(
      isAbsent
        ? ""
        : toTimeInputValueInTimezone(record?.firstCheckIn?.timestamp, tz)
    );
    setEditLastTime(
      isAbsent
        ? ""
        : toTimeInputValueInTimezone(record?.lastCheckOut?.timestamp, tz)
    );
    setEditError(null);
    setEditModalOpen(true);
  };

  const openAddModal = () => {
    const shift = userProfile?.shift;
    setAddDate(null);
    setAddMarkAsAbsent(false);
    setAddFirstTime(shift?.startTime || "09:00");
    setAddLastTime(shift?.endTime || "17:00");
    setAddError(null);
    setAddModalOpen(true);
  };

  const handleSaveAdd = async () => {
    if (!employee_id) {
      setAddError("Missing staff ID");
      return;
    }
    if (!addDate) {
      setAddError("Please select a date");
      return;
    }
    if (!addMarkAsAbsent && !addFirstTime) {
      setAddError("Please provide a first check-in time");
      return;
    }

    const tz = getStaffTz();
    const dateString = formatDateToYMDInTimezone(addDate, tz);
    const selected = moment.tz(dateString, "YYYY-MM-DD", tz).startOf("day");
    const todayStart = moment.tz(tz).startOf("day");
    if (selected.isAfter(todayStart)) {
      setAddError("Future dates are not allowed (staff shift timezone)");
      return;
    }

    const shift = userProfile?.shift;
    if (!addMarkAsAbsent && shift?.startTime && shift?.endTime) {
      const startMin = timeToMinutes(shift.startTime);
      const endMinRaw = timeToMinutes(shift.endTime);
      const firstMin = timeToMinutes(addFirstTime);
      const lastMinRaw = addLastTime ? timeToMinutes(addLastTime) : null;
      if (
        startMin == null ||
        endMinRaw == null ||
        firstMin == null
      ) {
        setAddError("Invalid time format. Please use HH:mm.");
        return;
      }
      let endMin = endMinRaw;
      const crossesMidnight = endMin <= startMin;
      if (crossesMidnight) endMin += 24 * 60;
      const earlyArrivalMinutes = shift.earlyArrivalGracePeriod || 0;
      const overtimeMinutes = parseRunEODAfterToMinutes(shift.runEODAfter);
      const earliestAllowed = Math.max(0, startMin - earlyArrivalMinutes);
      const latestAllowed = endMin + overtimeMinutes;
      let firstMinAdjusted = firstMin;
      if (crossesMidnight) {
        if (firstMinAdjusted < startMin) firstMinAdjusted += 24 * 60;
      }
      if (
        !(
          firstMinAdjusted >= earliestAllowed &&
          firstMinAdjusted <= latestAllowed
        )
      ) {
        setAddError("First check-in must be within the allowed shift window.");
        return;
      }
      if (addLastTime) {
        if (lastMinRaw == null) {
          setAddError("Invalid time format. Please use HH:mm.");
          return;
        }
        let lastMin = lastMinRaw;
        if (crossesMidnight) {
          if (lastMin < startMin) lastMin += 24 * 60;
        } else if (lastMin < firstMinAdjusted) {
          lastMin += 24 * 60;
        }
        if (!(lastMin >= earliestAllowed && lastMin <= latestAllowed)) {
          setAddError("Last check-out must be within the allowed shift window.");
          return;
        }
        if (lastMin <= firstMinAdjusted) {
          setAddError("Last check-out must be after first check-in.");
          return;
        }
      }
    }

    try {
      setAddSaving(true);
      setAddError(null);
      const payload = {
        staffId: employee_id,
        date: dateString,
        timezone: tz,
        markAsAbsent: addMarkAsAbsent,
      };
      if (!addMarkAsAbsent) {
        payload.firstCheckInTime = addFirstTime;
        if (addLastTime) {
          payload.lastCheckOutTime = addLastTime;
        }
      }
      await axios.post(`${Base_URL}/attendance/record`, payload);
      notifySuccess(
        addMarkAsAbsent
          ? "Attendance record added as absent"
          : "Attendance record added successfully"
      );
      setAddModalOpen(false);
      fetchAttendanceDetails(employee_id, currentPage, recordsPerPage);
    } catch (err) {
      setAddError(
        err?.response?.data?.message ||
          "Failed to add attendance record. Please try again."
      );
    } finally {
      setAddSaving(false);
    }
  };

  // Function to fetch attendance details
  const fetchAttendanceDetails = async (employeeId, page = 1, limit = 10, rangeOverride = null) => {
    const fetchId = ++attendanceFetchIdRef.current;
    try {
      setLoading(true);
      setError(null);

      // Build the URL with pagination parameters
      let url = `${Base_URL}/attendance/details/${employeeId}`;
      const params = new URLSearchParams();

      const activeRange = rangeOverride ?? rangeFilter;
      const apiRange = monthRangeToApiRange(activeRange);
      if (apiRange) {
        params.append("range", JSON.stringify(apiRange));
      }

      params.append("page", page);
      params.append("limit", limit);

      url += `?${params.toString()}`;

      // Make API call to get attendance details
      const response = await axios.get(url);

      if (fetchId !== attendanceFetchIdRef.current) {
        return;
      }

      console.log("Attendance details response:", response.data);

      if (response.data.success) {
        const { staff, month, stats, records } = response.data.data;

        // Set display period
        setDisplayPeriod(month);

        // Set stats data
        setStatsData(stats);

        const tz =
          response.data.data.staffTimezone ||
          resolveStaffTimezone(staff.shift);
        setStaffTimezone(tz);

        // Set user profile
        setUserProfile({
          name: staff.displayName || staff.fullName,
          position: `${staff.position.name} | ${staff.department.name}`,
          avatar: staff.image.startsWith("http")
            ? staff.image
            : `${staff.image}`,
          id: staff._id,
          shift: staff.shift,
        });

        // Format records for the data table (times in staff shift timezone)
        const formattedRecords = records.map((record, index) => ({
          ...record,
          id: index + 1,
          date: record.formattedDate || "-",
          in:
            record.firstCheckIn?.timestamp &&
            record.status !== "Absent" &&
            record.status !== "Leave" &&
            record.status !== "Public Holiday" &&
            record.status !== "Weekly Off"
              ? formatAttendanceTime({
                  formattedTime: record.firstCheckIn.formattedTime,
                  timestamp: record.firstCheckIn.timestamp,
                  timezone: tz,
                })
              : "-",
          out: record.lastCheckOut?.timestamp
            ? formatAttendanceTime({
                formattedTime: record.lastCheckOut.formattedTime,
                timestamp: record.lastCheckOut.timestamp,
                timezone: tz,
              })
            : "-",
          totalHours: record.formattedTotalHours,
          lateIn: record.lateIn || "00:00",
          earlyOut: record.earlyOut || "00:00",
          overTime: record.overTime || "00:00",
          status: record.status,
        }));

        setAttendanceData(formattedRecords);
        setAdminActivityLogEntries(response.data.data.adminActivityLogs || []);

        // Set pagination from API response (only for this request)
        if (response.data.pagination) {
          setCurrentPage(response.data.pagination.currentPage);
          setTotalPages(response.data.pagination.totalPages);
          if (response.data.pagination.limit === limit) {
            setRecordsPerPage(response.data.pagination.limit);
          }
        }
      } else {
        setError("Failed to fetch attendance details");
      }

      if (fetchId === attendanceFetchIdRef.current) {
        setLoading(false);
      }
    } catch (err) {
      if (fetchId !== attendanceFetchIdRef.current) {
        return;
      }
      console.error("Error fetching attendance details:", err);
      setError("An error occurred while fetching attendance details");
      setLoading(false);
    }
  };

  // Initial load only when employee id changes (pagination handled by handlers)
  useEffect(() => {
    const staffId =
      employee_id ||
      (() => {
        const urlParts = window.location.pathname.split("/");
        const idFromUrl = urlParts[urlParts.length - 1];
        return idFromUrl && idFromUrl !== "attendance" ? idFromUrl : "";
      })();

    if (!staffId) {
      setError("No employee ID provided");
      setLoading(false);
      return;
    }

    const fetchKey = `${staffId}`;
    if (mountFetchKeyRef.current === fetchKey) {
      return;
    }
    mountFetchKeyRef.current = fetchKey;

    const pageSize = readConfiguredPageSize();
    setRecordsPerPage(pageSize);
    setCurrentPage(1);
    fetchAttendanceDetails(staffId, 1, pageSize);
  }, [employee_id]);


  // Handle page change
  const onPageChange = (page) => {
    // Fetch data for the new page
    fetchAttendanceDetails(employee_id, page, recordsPerPage);
  };

  // Handle records per page change
  const onRecordsPerPageChange = (value) => {
    const newRecordsPerPage = Number.parseInt(value, 10);
    if (!Number.isFinite(newRecordsPerPage) || newRecordsPerPage <= 0) {
      return;
    }

    setRecordsPerPage(newRecordsPerPage);
    setCurrentPage(1);
    fetchAttendanceDetails(employee_id, 1, newRecordsPerPage);
  };

  const handleMonthRangeChange = useCallback(
    (val) => {
      setRangeFilter(val);
      if (val.from && val.to && employee_id) {
        fetchAttendanceDetails(employee_id, 1, recordsPerPage, val);
      }
    },
    [employee_id, recordsPerPage]
  );

  const handleMonthRangeClear = useCallback(() => {
    const empty = { from: "", to: "" };
    setRangeFilter(empty);
    if (employee_id) {
      fetchAttendanceDetails(employee_id, 1, recordsPerPage, empty);
    }
  }, [employee_id, recordsPerPage]);

  const attendanceTableFilters = useMemo(() => {
    const filters = [];
    if (rangeFilter.from && rangeFilter.to) {
      filters.push({
        isClearButton: true,
        tooltip: "Clear month range",
        buttonProps: {
          onClick: handleMonthRangeClear,
        },
      });
    }
    filters.push({
      containerStyle: {
        width: "300px",
        maxWidth: "300px",
        minWidth: "300px",
        flex: "0 0 300px",
      },
      customComponent: (
        <div className="w-full min-w-0">
          <MonthRangePicker
            key="attendance-month-range"
            fullWidth
            from={rangeFilter.from}
            to={rangeFilter.to}
            onChange={handleMonthRangeChange}
            onClear={handleMonthRangeClear}
          />
        </div>
      ),
    });
    return filters;
  }, [
    rangeFilter.from,
    rangeFilter.to,
    handleMonthRangeChange,
    handleMonthRangeClear,
  ]);

  const handleSaveEdit = async () => {
    if (!editRecord?._id) {
      setEditError("Missing attendance record ID");
      return;
    }
    if (!editMarkAsAbsent && (!editFirstTime || !editLastTime)) {
      setEditError("Please provide both first check-in and last check-out times.");
      return;
    }

    const shift = userProfile.shift;
    if (!editMarkAsAbsent && shift?.startTime && shift?.endTime) {
      const startMin = timeToMinutes(shift.startTime);
      const endMinRaw = timeToMinutes(shift.endTime);
      const firstMin = timeToMinutes(editFirstTime);
      const lastMinRaw = timeToMinutes(editLastTime);

      if (
        startMin == null ||
        endMinRaw == null ||
        firstMin == null ||
        lastMinRaw == null
      ) {
        setEditError("Invalid time format. Please use HH:mm.");
        return;
      }

      let endMin = endMinRaw;
      const crossesMidnight = endMin <= startMin;
      if (crossesMidnight) endMin += 24 * 60;

      const earlyArrivalMinutes = shift.earlyArrivalGracePeriod || 0;
      const overtimeMinutes = parseRunEODAfterToMinutes(shift.runEODAfter);
      const earliestAllowed = Math.max(0, startMin - earlyArrivalMinutes);
      const latestAllowed = endMin + overtimeMinutes;

      let firstMinAdjusted = firstMin;
      let lastMin = lastMinRaw;
      if (crossesMidnight) {
        if (firstMinAdjusted < startMin) firstMinAdjusted += 24 * 60;
        if (lastMin < startMin) lastMin += 24 * 60;
      } else if (lastMin < firstMinAdjusted) {
        lastMin += 24 * 60;
      }

      if (
        !(
          firstMinAdjusted >= earliestAllowed &&
          firstMinAdjusted <= latestAllowed
        )
      ) {
        setEditError(
          "First check-in must be within the allowed shift window."
        );
        return;
      }

      if (!(lastMin >= earliestAllowed && lastMin <= latestAllowed)) {
        setEditError(
          "Last check-out must be within the allowed shift window."
        );
        return;
      }

      if (lastMin <= firstMinAdjusted) {
        setEditError("Last check-out must be after first check-in.");
        return;
      }
    }

    try {
      setEditSaving(true);
      setEditError(null);

      const dateString = formatDateToYMDInTimezone(
        editRecord.date,
        getStaffTz()
      );
      const payload = {
        date: dateString,
        timezone: getStaffTz(),
        markAsAbsent: editMarkAsAbsent,
      };
      if (!editMarkAsAbsent) {
        payload.firstCheckInTime = editFirstTime;
        payload.lastCheckOutTime = editLastTime;
      }
      await axios.put(`${Base_URL}/attendance/record/${editRecord._id}`, payload);

      notifySuccess(
        editMarkAsAbsent
          ? "Attendance record marked as absent"
          : "Attendance record updated successfully"
      );
      setEditModalOpen(false);
      setEditRecord(null);
      fetchAttendanceDetails(employee_id, currentPage, recordsPerPage);
    } catch (err) {
      console.error("Error updating attendance record:", err);
      setEditError(
        err?.response?.data?.message ||
          "Failed to update attendance record. Please try again."
      );
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <PageHeader
        title={`Attendance Record ${displayPeriod ? `for ${displayPeriod}` : ""}`}
        showBackButton
        backFallbackPath="/attendance"
        renderActions={
          <>
            <button
              key="excel"
              className="flex items-center px-4 py-2 text-white text-sm rounded-xl shadow-sm"
              style={{ backgroundColor: "#17B26A" }}
              onClick={() => {
                downloadExcel(employee_id, null, null, rangeFilter);
              }}
            >
              <img
                src={csv || "/placeholder.svg"}
                alt="csv-icon"
                className="mr-2 w-5 h-5 object-contain"
              />
              Download Excel
            </button>
            <button
              key="pdf"
              style={{ backgroundColor: "#F04438" }}
              className="flex items-center px-4 py-2 text-white text-sm rounded-xl shadow-sm"
              onClick={() => {
                downloadPDF(employee_id, null, null, rangeFilter);
              }}
            >
              <img
                src={pdf || "/placeholder.svg"}
                alt="pdf-icon"
                className="mr-2 w-5 h-5 object-contain"
              />
              Download PDF
            </button>
          </>
        }
      />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
          <p>{error}</p>
          <button
            type="button"
            onClick={() =>
              employee_id &&
              fetchAttendanceDetails(
                employee_id,
                currentPage,
                recordsPerPage
              )
            }
            className="mt-2 px-4 py-2 bg-red-100 hover:bg-red-200 rounded-md text-red-700 text-sm"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Profile Section */}
      <div className="bg-gray-50 rounded-xl p-6 mb-6 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-gray-200 overflow-hidden">
            <img
              src={
                userProfile.avatar ||
                "https://tse2.mm.bing.net/th?id=OIP.w9y1NF8ehHIJNCHZtsBM1gHaHa&pid=Api&P=0&h=220"
              }
              alt={userProfile.name}
              className="h-full w-full object-cover"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">
                <Link to={`/staff/${userProfile.id || employee_id}`}>
                  {userProfile.name}
                </Link>
              </h2>
            </div>
            <p className="text-sm text-gray-600">{userProfile.position}</p>
            {formatShiftScheduleDisplay(userProfile.shift) && (
              <p className="text-sm text-gray-600 mt-1">
                {formatShiftScheduleDisplay(userProfile.shift)}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            title="Admin recent activity logs"
            aria-label="Admin recent activity logs"
            onClick={() => {
              setRecentActivityPage(1);
              setRecentActivityModalOpen(true);
            }}
            className="p-2.5 text-gray-700 bg-white border border-gray-200 rounded-xl shadow-sm hover:bg-gray-50 transition"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 3v18h18" />
              <path d="M18 17V9" />
              <path d="M13 17V5" />
              <path d="M8 17v-3" />
            </svg>
          </button>
          <button
            type="button"
            className="flex items-center px-4 py-2 text-white text-sm rounded-xl shadow-sm"
            style={{ backgroundColor: "var(--p-blue)" }}
            onClick={openAddModal}
          >
            + Add Attendance
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <div className="bg-[#EDFCF9] p-4 rounded-xl">
          <h3 className="text-gray-700 text-sm font-medium">Total Days </h3>
          <p className="text-2xl font-bold mt-2">{statsData.monthTotalDays}</p>
        </div>

        <div className="bg-[#F9F9FA] p-4 rounded-xl">
          <h3 className="text-gray-700 text-sm font-medium">Total Hours </h3>
          <p className="text-2xl font-bold mt-2">{statsData.monthTotalHours}</p>
        </div>

        <div className="bg-[#F9F9FA] p-4 rounded-xl">
          <h3 className="text-gray-700 text-sm font-medium">Regular </h3>
          <p className="text-2xl font-bold mt-2">{statsData.regular}</p>
        </div>

        <div className="bg-[#F9F9FA] p-4 rounded-xl">
          <h3 className="text-gray-700 text-sm font-medium">Punctual </h3>
          <p className="text-2xl font-bold mt-2">{statsData.punctual}</p>
        </div>

        <div className="bg-[#F9F9FA] p-4 rounded-xl">
          <h3 className="text-gray-700 text-sm font-medium">
            Daily Average Hours{" "}
          </h3>
          <p className="text-2xl font-bold mt-2">
            {statsData.dailyAverageHours}
          </p>
        </div>

        <div className="bg-[#F9F9FA] p-4 rounded-xl">
          <h3 className="text-gray-700 text-sm font-medium">
            Longest Day Hours{" "}
          </h3>
          <p className="text-2xl font-bold mt-2">{statsData.longestDayHours}</p>
        </div>
      </div>

      {/* Records Section */}
      <div className="mb-6">
          <DataTable
            skipAutoPageSizeFromConfig
            title="Records"
            filters={attendanceTableFilters}
            emptyMessage="No attendance records found for this period."
            searchValue={searchQuery}
            onSearch={(value) => setSearchQuery(value)}
            searchPlaceholder="Search"
            headers={[
              "Date",
              "IN",
              "OUT",
              "Total Hours",
              "Late IN",
              "Early OUT",
              "Over Time",
              "Status",
              "Action",
            ]}
            data={attendanceData}
            colWidths={{
              Date: "120px",
              Status: "180px",
            }}
            totalPages={totalPages}
            currentPage={currentPage}
            onPageChange={onPageChange}
            recordsPerPage={recordsPerPage}
            onRecordsPerPageChange={onRecordsPerPageChange}
            loading={loading}
            renderRow={(record) => (
              <tr key={record.id} className="border-b border-gray-100">
                <td className="py-4 px-4">{record.date}</td>
                <td className="py-4 px-4">{record.in}</td>
                <td className="py-4 px-4">{record.out}</td>
                <td className="py-4 px-4">{record.totalHours}</td>
                <td className="py-4 px-4">
                  <div className="flex items-center">
                    {record.lateIn}
                    <button className="p-1 ml-1 rounded-md hover:bg-gray-100">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 16v-4" />
                        <path d="M12 8h.01" />
                      </svg>
                    </button>
                  </div>
                </td>
                <td className="py-4 px-4">
                  <div className="flex items-center">
                    {record.earlyOut}
                    <button className="p-1 ml-1 rounded-md hover:bg-gray-100">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 16v-4" />
                        <path d="M12 8h.01" />
                      </svg>
                    </button>
                  </div>
                </td>
                <td className="py-4 px-4">{record.overTime}</td>
                <td className="py-4 px-4">
                  <span
                    className={`px-3 py-1 rounded-full ${getStatusColor(
                      record.status
                    )}`}
                  >
                    {record.status}
                  </span>
                </td>
                <td className="py-4 px-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditModal(record)}
                      className="p-2 rounded-md hover:bg-gray-100"
                      title="Edit first check-in / last check-out"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4"
                      >
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => {
                        setViewAllEntries(record);
                        setDisplayCheckInOuts(true);
                      }}
                      className="p-2 rounded-md hover:bg-gray-100"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 16v-4" />
                        <path d="M12 8h.01" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            )}
          />
        {displayCheckInOuts && (
          <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">
                  User Detailed Daily Report
                </h2>
                <button
                  onClick={() => setDisplayCheckInOuts(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    ></path>
                  </svg>
                </button>
              </div>

              {/* Top Info Cards */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-green-50 p-4 rounded-md">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">Date</span>
                    <svg
                      className="w-5 h-5 text-gray-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      ></path>
                    </svg>
                  </div>
                  <div className="text-lg font-semibold">
                    {viewAllEntries?.date || "-"}
                  </div>
                  {userProfile.shift.name}
                </div>

                <div className="bg-white border border-gray-200 p-4 rounded-md">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">First Time In</span>
                    <svg
                      className="w-5 h-5 text-gray-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      ></path>
                    </svg>
                  </div>
                  <div className="text-lg font-semibold">
                    {viewAllEntries?.in || "-"}
                  </div>
                </div>

                <div className="bg-white border border-gray-200 p-4 rounded-md">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">Last Time Out</span>
                    <svg
                      className="w-5 h-5 text-gray-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      ></path>
                    </svg>
                  </div>
                  <div className="text-lg font-semibold">
                    {viewAllEntries?.lastCheckOut?.formattedTime !== "NaN:NaN"
                      ? viewAllEntries?.out || "-"
                      : "-"}
                  </div>
                </div>
              </div>

              {/* Staff check-in/out entries */}
              <div className="overflow-y-auto max-h-[40vh] mb-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  Staff Check-in / Check-out
                </h3>
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="py-3 px-4 text-left text-sm font-medium text-gray-500 w-1/6">
                        Time
                      </th>
                      <th className="py-3 px-4 text-left text-sm font-medium text-gray-500">
                        In & Out Detail
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {(viewAllEntries?.entries || [])
                      .filter(isStaffCheckInOutEntry)
                      .map((entry, index) => (
                      <tr
                        key={index}
                        className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                      >
                        <td className="py-3 px-4 text-sm text-gray-500">
                          {formatStaffTime(entry)}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={
                              entry.type === "in"
                                ? "text-green-500"
                                : "text-red-500"
                            }
                          >
                            {entry.type === "in" ? "Entered in" : "Exited from"}
                          </span>
                          <span className="text-sm"> Office Location </span>
                          <span className="text-gray-500 text-sm">via</span>
                          <span className="text-blue-500 text-sm">
                            {" "}
                            Remote Server{" "}
                          </span>
                          <span className="text-gray-500 text-sm">
                            (Remote Access - {entry.ipAddress})
                          </span>
                          <span className="px-4">
                            {entry.photo ? (
                              <a href={entry.photo} target="_blank" rel="noreferrer">
                                View Photo
                              </a>
                            ) : (
                              <span className="text-gray-400">View Photo</span>
                            )}
                          </span>
                        </td>
                      </tr>
                    ))}

                    {!(viewAllEntries?.entries || []).filter(
                      isStaffCheckInOutEntry
                    ).length && (
                      <tr>
                        <td
                          colSpan="2"
                          className="py-4 text-center text-gray-500"
                        >
                          No staff check-in/out entries for this day
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Admin activity for this record */}
              <div className="overflow-y-auto max-h-[30vh] border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  Admin Activity
                </h3>
                <table className="min-w-full">
                  <thead className="bg-amber-50">
                    <tr>
                      <th className="py-2 px-4 text-left text-sm font-medium text-gray-500 w-1/4">
                        Updated At
                      </th>
                      <th className="py-2 px-4 text-left text-sm font-medium text-gray-500 w-1/5">
                        Action
                      </th>
                      <th className="py-2 px-4 text-left text-sm font-medium text-gray-500 w-1/5">
                        By
                      </th>
                      <th className="py-2 px-4 text-left text-sm font-medium text-gray-500">
                        Details
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {selectedRecordAdminLogs.map((log, index) => (
                      <tr
                        key={`admin-log-${index}`}
                        className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                      >
                        <td className="py-2 px-4 text-sm text-gray-500">
                          {formatAdminLogTime(log.performedAt)}
                        </td>
                        <td className="py-2 px-4 text-sm">
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                            {formatAdminActionLabel(log.action)}
                          </span>
                        </td>
                        <td className="py-2 px-4 text-sm text-gray-700">
                          {log.performedByName || "Administrator"}
                        </td>
                        <td className="py-2 px-4 text-sm text-gray-600">
                          {renderAdminLogDetails(log)}
                        </td>
                      </tr>
                    ))}
                    {!selectedRecordAdminLogs.length && (
                      <tr>
                        <td
                          colSpan="4"
                          className="py-4 text-center text-gray-500 text-sm"
                        >
                          No admin activity for this record
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {addModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg p-6">
            <div className="flex justify-between items-center mb-0">
              <h2 className="text-xl font-semibold">Add Attendance</h2>
              <button
                onClick={() => setAddModalOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <p className="text-sm text-gray-500 mb-4">
              {/* general message to add attendance */}
              Select the date and time for the attendance record.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <CustomDatePicker
                  value={addDate}
                  onChange={(date) => {
                    setAddDate(date);
                    setAddError(null);
                  }}
                  maxDate={maxAddAttendanceDate}
                  filterDate={isAddAttendanceDateSelectable}
                  placeholder="Select date"
                  clearable
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-[var(--p-blue)] focus:ring-[var(--p-blue)]"
                  checked={addMarkAsAbsent}
                  onChange={(e) => setAddMarkAsAbsent(e.target.checked)}
                />
                <span className="text-sm font-medium text-gray-700">
                  Mark as absent
                </span>
              </label>

              {!addMarkAsAbsent && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      First Check-in
                    </label>
                    <input
                      type="time"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] outline-none"
                      value={addFirstTime}
                      onChange={(e) => setAddFirstTime(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Last Check-out{" "}
                      <span className="font-normal text-gray-400">(optional)</span>
                    </label>
                    <input
                      type="time"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] outline-none"
                      value={addLastTime}
                      onChange={(e) => setAddLastTime(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {addMarkAsAbsent && (
                <p className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  No check-in or check-out times will be recorded. The day will
                  be saved as absent.
                </p>
              )}

              {/* {!addMarkAsAbsent && userProfile?.shift && (
                <p className="text-xs text-gray-500">
                  Times are in staff shift timezone.{" "}
                  {formatShiftScheduleDisplay(userProfile.shift)}
                </p>
              )} */}

              {addError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded">
                  {addError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  className="flex-1 py-2 rounded-lg bg-gray-200 text-gray-700 font-semibold hover:bg-gray-300 transition"
                  onClick={() => setAddModalOpen(false)}
                  disabled={addSaving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="flex-1 py-2 rounded-lg bg-[var(--p-blue)] text-white font-semibold hover:opacity-90 transition disabled:opacity-60"
                  onClick={handleSaveAdd}
                  disabled={addSaving}
                >
                  {addSaving ? "Saving..." : "Add Attendance"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                Edit Attendance Punches
              </h2>
              <button
                onClick={() => setEditModalOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  ></path>
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <div className="w-full border px-3 py-2 rounded bg-gray-50 text-sm text-gray-700">
                  {editRecord?.formattedDate || formatDate(editRecord?.date)}
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-[var(--p-blue)] focus:ring-[var(--p-blue)]"
                  checked={editMarkAsAbsent}
                  onChange={(e) => setEditMarkAsAbsent(e.target.checked)}
                />
                <span className="text-sm font-medium text-gray-700">
                  Mark as absent
                </span>
              </label>

              {!editMarkAsAbsent && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      First Check-in Time
                    </label>
                    <input
                      type="time"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition outline-none"
                      value={editFirstTime}
                      onChange={(e) => setEditFirstTime(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Last Check-out Time
                    </label>
                    <input
                      type="time"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition outline-none"
                      value={editLastTime}
                      onChange={(e) => setEditLastTime(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {editMarkAsAbsent && (
                <p className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  Existing punches will be cleared and the day will be marked
                  absent.
                </p>
              )}

              {editError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded">
                  {editError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  className="flex-1 py-2 rounded-lg bg-gray-200 text-gray-700 font-semibold hover:bg-gray-300 transition"
                  onClick={() => setEditModalOpen(false)}
                  disabled={editSaving}
                >
                  Cancel
                </button>
                <button
                  className="flex-1 py-2 rounded-lg bg-[var(--p-blue)] text-white font-semibold hover:bg-[#8bb02e] transition disabled:opacity-60"
                  onClick={handleSaveEdit}
                  disabled={editSaving}
                >
                  {editSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {recentActivityModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl p-6 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Admin recent activity logs</h2>
              <button
                type="button"
                onClick={() => setRecentActivityModalOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="overflow-auto flex-1 border border-gray-200 rounded-xl">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
                  <tr>
                    <th className="py-2.5 px-4 text-left font-medium text-gray-500">
                      Attendance Date
                    </th>
                    <th className="py-2.5 px-4 text-left font-medium text-gray-500">
                      Action
                    </th>
                    <th className="py-2.5 px-4 text-left font-medium text-gray-500">
                      Performed By
                    </th>
                    <th className="py-2.5 px-4 text-left font-medium text-gray-500">
                      Updated At
                    </th>
                    <th className="py-2.5 px-4 text-left font-medium text-gray-500">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedRecentActivityLogs.map((log, index) => (
                    <tr key={`recent-log-${log.performedAt}-${index}`}>
                      <td className="py-2.5 px-4 text-gray-700">
                        {log.recordDate || "-"}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                          {formatAdminActionLabel(log.action)}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-gray-700">
                        {log.performedByName || "Administrator"}
                      </td>
                      <td className="py-2.5 px-4 text-gray-500">
                        {formatAdminLogTime(log.performedAt)}
                      </td>
                      <td className="py-2.5 px-4 text-gray-600">
                        {renderAdminLogDetails(log)}
                      </td>
                    </tr>
                  ))}
                  {adminActivityLogEntries.length === 0 && (
                    <tr>
                      <td
                        colSpan="5"
                        className="py-8 text-center text-gray-500"
                      >
                        No admin activity logs for this period
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {adminActivityLogEntries.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-gray-100">
                <p className="text-sm text-gray-500">
                  Showing{" "}
                  {(recentActivityPage - 1) * recentActivityPerPage + 1}–
                  {Math.min(
                    recentActivityPage * recentActivityPerPage,
                    adminActivityLogEntries.length
                  )}{" "}
                  of {adminActivityLogEntries.length}
                </p>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    Per page
                    <select
                      value={recentActivityPerPage}
                      onChange={(e) => {
                        setRecentActivityPerPage(Number(e.target.value));
                        setRecentActivityPage(1);
                      }}
                      className="border border-gray-200 rounded-lg px-2 py-1 text-sm"
                    >
                      {[5, 10, 20, 50].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={recentActivityPage <= 1}
                    onClick={() =>
                      setRecentActivityPage((p) => Math.max(1, p - 1))
                    }
                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-600">
                    Page {recentActivityPage} of {recentActivityTotalPages}
                  </span>
                  <button
                    type="button"
                    disabled={recentActivityPage >= recentActivityTotalPages}
                    onClick={() =>
                      setRecentActivityPage((p) =>
                        Math.min(recentActivityTotalPages, p + 1)
                      )
                    }
                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
