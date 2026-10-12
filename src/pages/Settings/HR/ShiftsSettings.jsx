"use client";

import { useState, useEffect, useContext, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import axios from "axios";
import { useLocation } from "react-router-dom";
import { AdminContext } from "@/context/AdminContext";
import ToggleSwitch from "@/components/toggle/ToggleSwitch";
import { notifyError } from "@/utils/toast";
import { useSettingsCrudPermissions } from "@/hooks/useSettingsCrudPermissions";
import ReactSelect from "react-select";
import reactSelectConfig from "@/utils/react-select-style-config";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { timeZones } from "@/utils/timezones";
import { ActionButtons } from "@/page-layouts";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";
import EpcListPage from "@/components/Epc/EpcListPage";
import Button from "@/customer/components/ui/Button";
import { PlusIcon } from "@/customer/components/ui/icons";

const BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;

const WEEKDAY_VALUES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function formatTime(timeStr) {
  const [hours, minutes] = timeStr.split(":");
  const date = new Date();
  date.setHours(Number(hours), Number(minutes));

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

const AddEditModal = ({ isOpen, onClose, item, onSubmit, canSubmit }) => {
  const { t } = useTranslation();
  const thr = (key, fallback, options) =>
    t(`settingsPage.hr.${key}`, { defaultValue: fallback, ...options });

  const [formData, setFormData] = useState({
    _id: "",
    name: "",
    startTime: "",
    endTime: "",
    breakMinutesAllowed: null,
    lateArrivalGracePeriod: "",
    earlyDepartureGracePeriod: "",
    weeklyOffDay: [],
    runEODAfter: "",
    timezone: "",
  });

  const [validationErrors, setValidationErrors] = useState({});

  useEffect(() => {
    if (item) {
      setFormData({
        _id: item._id || "",
        name: item.name || "",
        startTime: item.startTime || "",
        endTime: item.endTime || "",
        breakMinutesAllowed: item.breakMinutesAllowed || null,
        lateArrivalGracePeriod: item.lateArrivalGracePeriod || "",
        earlyDepartureGracePeriod: item.earlyDepartureGracePeriod || "",
        weeklyOffDay: item.weeklyOffDay || [],
        runEODAfter: item.runEODAfter || "",
        timezone: item.timezone || "",
      });
    } else {
      setFormData({
        _id: "",
        name: "",
        startTime: "",
        endTime: "",
        breakMinutesAllowed: null,
        lateArrivalGracePeriod: "",
        earlyDepartureGracePeriod: "",
        weeklyOffDay: [],
        runEODAfter: "",
        timezone: "",
      });
    }
    setValidationErrors({});
  }, [item, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setValidationErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const isTimeAfter = (start, end) => {
    // Support overnight shifts (e.g., 7PM to 6:59AM)
    // If end time is before start time, it's an overnight shift (valid)
    if (start >= end) {
      return true; // Overnight shift is valid
    }
    return start < end;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const errors = {};
    if (!formData.name) errors.name = thr("nameIsRequired", "Name is required.");
    if (!formData.startTime)
      errors.startTime = thr(
        "shifts.startTimeRequired",
        "Start time is required."
      );
    if (!formData.endTime)
      errors.endTime = thr("shifts.endTimeRequired", "End time is required.");
    if (!formData.breakMinutesAllowed)
      errors.breakMinutesAllowed = thr(
        "shifts.breakMinutesRequired",
        "Break minutes allowed is required."
      );
    if (!formData.runEODAfter)
      errors.runEODAfter = thr(
        "shifts.runEodAfterRequired",
        "Run EOD After time is required."
      );
    if (!formData.timezone)
      errors.timezone = thr(
        "shifts.timezoneRequired",
        "Timezone is required."
      );
    // Removed the validation that prevents overnight shifts
    // Overnight shifts (where end time is before start time) are now allowed

    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;

    onSubmit(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 m-6 max-w-3xl w-full">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">
            {item
              ? thr("shifts.editShift", "Edit Shift")
              : thr("shifts.addNewShift", "Add New Shift")}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div
            className="space-y-4 max-h-[70vh] overflow-y-auto"
            style={{ padding: "4px 4px" }}
          >
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {thr("name", "Name")}
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={`w-full p-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#A6C437] ${
                  validationErrors.name ? "border-red-500" : "border-gray-300"
                }`}
              />
              {validationErrors.name && (
                <p className="text-red-500 text-sm mt-1">
                  {validationErrors.name}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Start Time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {thr("shifts.startTime", "Start Time")}
                </label>
                <input
                  type="time"
                  name="startTime"
                  value={formData.startTime}
                  onChange={handleChange}
                  className={`w-full p-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#A6C437] ${
                    validationErrors.startTime
                      ? "border-red-500"
                      : "border-gray-300"
                  }`}
                />
                {validationErrors.startTime && (
                  <p className="text-red-500 text-sm mt-1">
                    {validationErrors.startTime}
                  </p>
                )}
              </div>

              {/* End Time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {thr("shifts.endTime", "End Time")}
                </label>
                <input
                  type="time"
                  name="endTime"
                  value={formData.endTime}
                  onChange={handleChange}
                  className={`w-full p-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#A6C437] ${
                    validationErrors.endTime
                      ? "border-red-500"
                      : "border-gray-300"
                  }`}
                />
                {validationErrors.endTime && (
                  <p className="text-red-500 text-sm mt-1">
                    {validationErrors.endTime}
                  </p>
                )}
              </div>
            </div>

            {/* Break Minutes Allowed */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {thr("shifts.breakMinutesAllowed", "Break Minutes Allowed")}
              </label>
              <DatePicker
                selected={
                  formData.breakMinutesAllowed
                    ? new Date(`1970-01-01T${formData.breakMinutesAllowed}`)
                    : null
                }
                onChange={(date) => {
                  if (date) {
                    const hours = date.getHours().toString().padStart(2, "0");
                    const minutes = date
                      .getMinutes()
                      .toString()
                      .padStart(2, "0");
                    const formattedTime = `${hours}:${minutes}`;
                    setFormData((prev) => ({
                      ...prev,
                      breakMinutesAllowed: formattedTime,
                    }));
                    setValidationErrors((prev) => ({
                      ...prev,
                      breakMinutesAllowed: "",
                    }));
                  } else {
                    setFormData((prev) => ({
                      ...prev,
                      breakMinutesAllowed: null,
                    }));
                  }
                }}
                showTimeSelect
                showTimeSelectOnly
                timeIntervals={5}
                timeCaption={thr("timeCaption", "Time")}
                dateFormat="HH:mm"
                timeFormat="HH:mm"
                className={`w-full p-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#A6C437] ${
                  validationErrors.breakMinutesAllowed
                    ? "border-red-500"
                    : "border-gray-300"
                }`}
                placeholderText={thr("selectTime", "Select time")}
              />
              {validationErrors.breakMinutesAllowed && (
                <p className="text-red-500 text-sm mt-1">
                  {validationErrors.breakMinutesAllowed}
                </p>
              )}
            </div>

            {/* Grace Periods */}
            <div className="grid grid-cols-2 gap-4">
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {thr(
                    "shifts.latenessGracePeriodMin",
                    "Lateness Grace Period (min)"
                  )}
                </label>
                <input
                  type="number"
                  name="lateArrivalGracePeriod"
                  value={formData.lateArrivalGracePeriod}
                  onChange={handleChange}
                  min="0"
                  className="w-full p-2 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#A6C437]"
                />
                <span className="absolute right-1 top-[40px] -translate-y-1/2 text-sm text-gray-500">
                  {thr("min", "min")}
                </span>
              </div>
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {thr(
                    "shifts.earlyOutGracePeriodMin",
                    "Early Out Grace Period (min)"
                  )}
                </label>
                <input
                  type="number"
                  name="earlyDepartureGracePeriod"
                  value={formData.earlyDepartureGracePeriod}
                  onChange={handleChange}
                  min="0"
                  className="w-full p-2 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#A6C437]"
                />
                <span className="absolute right-1 top-[40px] -translate-y-1/2 text-sm text-gray-500">
                  {thr("min", "min")}
                </span>
              </div>
            </div>

            {/* Weekly Off Days */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {thr("shifts.weeklyOffDays", "Weekly Off Days")}
              </label>
              <ReactSelect
                value={
                  formData.weeklyOffDay?.map((day) => ({
                    value: day,
                    label: thr(`shifts.${String(day).toLowerCase()}`, day),
                  })) || []
                }
                onChange={(selectedOptions) =>
                  setFormData((prev) => ({
                    ...prev,
                    weeklyOffDay: selectedOptions
                      ? selectedOptions.map((opt) => opt.value)
                      : [],
                  }))
                }
                placeholder={thr(
                  "shifts.selectWeeklyOffDays",
                  "Select Weekly Off Days"
                )}
                options={WEEKDAY_VALUES.map((day) => ({
                  value: day,
                  label: thr(`shifts.${day.toLowerCase()}`, day),
                }))}
                isMulti
                isSearchable
                menuPlacement="top"
                classNamePrefix="react-select"
                styles={{
                  ...reactSelectConfig,
                  control: (base, state) => ({
                    ...reactSelectConfig.control?.(base, state),
                    background: "white",
                    borderWidth: 1,

                    borderColor: state.isFocused ? "var(--p-blue)" : "#d1d5db",
                    "&:hover": {
                      borderColor: "none",
                    },
                  }),
                }}
              />
            </div>

            {/* Timezone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {thr("shifts.timezone", "Timezone")}
              </label>
              <ReactSelect
                value={
                  formData.timezone
                    ? {
                        value: formData.timezone,
                        label:
                          timeZones.find((tz) => tz.tzCode === formData.timezone)
                            ?.label || formData.timezone,
                      }
                    : null
                }
                onChange={(selectedOption) => {
                  setFormData((prev) => ({
                    ...prev,
                    timezone: selectedOption ? selectedOption.value : "",
                  }));
                  setValidationErrors((prev) => ({ ...prev, timezone: "" }));
                }}
                placeholder={thr("shifts.selectTimezone", "Select Timezone")}
                options={timeZones.map((timeZone) => ({
                  value: timeZone.tzCode,
                  label: timeZone.label,
                }))}
                isSearchable
                menuPlacement="top"
                classNamePrefix="react-select"
                styles={{
                  ...reactSelectConfig,
                  control: (base, state) => ({
                    ...reactSelectConfig.control?.(base, state),
                    background: "white",
                    borderWidth: 1,
                    borderColor: validationErrors.timezone
                      ? "#ef4444"
                      : state.isFocused
                      ? "var(--p-blue)"
                      : "#d1d5db",
                  }),
                }}
              />
              {validationErrors.timezone && (
                <p className="text-red-500 text-sm mt-1">
                  {validationErrors.timezone}
                </p>
              )}
            </div>

            {/* Run EOD Cron After */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {thr(
                  "shifts.runEodCronAfterHours",
                  "Run EOD Cron After (Hours)"
                )}
              </label>
              <input
                type="number"
                name="runEODAfter"
                min="0"
                value={formData.runEODAfter}
                onChange={handleChange}
                className={`w-full p-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#A6C437] ${
                  validationErrors.runEODAfter
                    ? "border-red-500"
                    : "border-gray-300"
                }`}
              />
              {validationErrors.runEODAfter && (
                <p className="text-red-500 text-sm mt-1">
                  {validationErrors.runEODAfter}
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <button
              type="submit"
              className="px-4 py-2 bg-[#A6C437] text-white rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!canSubmit}
            >
              {item
                ? thr("shifts.updateShifts", "Update Shifts")
                : thr("shifts.addShifts", "Add Shifts")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm }) => {
  const { t } = useTranslation();
  const thr = (key, fallback, options) =>
    t(`settingsPage.hr.${key}`, { defaultValue: fallback, ...options });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-lg w-full">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {thr("areYouSure", "Are you sure?")}
        </h2>
        <p className="text-sm text-gray-600">
          {thr(
            "deleteConfirmItem",
            "Do you really want to delete this item? This action cannot be undone."
          )}
        </p>

        <div className="flex justify-end mt-6 space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-colors"
          >
            {thr("cancel", "Cancel")}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            {thr("delete", "Delete")}
          </button>
        </div>
      </div>
    </div>
  );
};

const EstimatesPage = () => {
  const { t } = useTranslation();
  const thr = (key, fallback, options) =>
    t(`settingsPage.hr.${key}`, { defaultValue: fallback, ...options });

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(() => {
    try {
      const c = localStorage.getItem("configurations");
      if (c) {
        const parsed = JSON.parse(c);
        const p = parsed && parsed.table_entries_per_page;
        if (Number.isFinite(p) && p > 0) return Number(p);
      }
    } catch (_) {}
    return 10;
  });

  const [organization, setOrganization] = useState(null);
  const [isOrgLoaded, setIsOrgLoaded] = useState(false);
  const location = useLocation();
  const { canAdd, canUpdate, canDelete } = useSettingsCrudPermissions();

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const selectedOrg = searchParams.get("selectedOrg");

    if (selectedOrg) {
      setOrganization(selectedOrg);
    }

    setIsOrgLoaded(true);
  }, [location]);

  useEffect(() => {
    if (isOrgLoaded && organization) {
      fetchItems(organization, searchTerm, statusFilter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization, isOrgLoaded, searchTerm, statusFilter]);

  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo.token}`,
  };

  const handleAddNew = () => {
    if (!canAdd) return;
    setEditItem(null);
    setModalOpen(true);
  };

  const handleEdit = (item) => {
    if (!canUpdate) return;
    setEditItem(item);
    setModalOpen(true);
  };

  const handleSubmit = async (item) => {
    if ((editItem && !canUpdate) || (!editItem && !canAdd)) return;
    try {
      const payload = {
        name: item.name,
        business_id: organization,
        startTime: item.startTime,
        endTime: item.endTime,
        breakMinutesAllowed: item.breakMinutesAllowed,
        lateArrivalGracePeriod: item.lateArrivalGracePeriod,
        earlyDepartureGracePeriod: item.earlyDepartureGracePeriod,
        weeklyOffDay: item.weeklyOffDay,
        runEODAfter: item.runEODAfter,
        timezone: item.timezone,
        status: item.status,
      };

      if (editItem) {
        await axios.put(`${BASE_URL}/shifts/update/${editItem._id}`, payload, {
          headers,
        });
      } else {
        await axios.post(`${BASE_URL}/shifts/add`, payload, { headers });
      }

      fetchItems(organization, searchTerm, statusFilter);
      setModalOpen(false);
    } catch (err) {
      console.error("Failed to save item", err?.response?.data?.message);
      notifyError(
        err?.response?.data?.message ||
          thr("anErrorOccurred", "An error occurred")
      );
    }
  };

  const fetchItems = async (selectedOrg, search = "", status = "") => {
    if (!selectedOrg) return;
    setLoading(true);
    try {
      const payload = {
        business_id: selectedOrg,
        FilterStatus: status,
        FilterName: search,
      };
      const response = await axios.post(`${BASE_URL}/shifts/get_all`, payload, {
        headers,
      });
      setItems(response.data.data || []);
      setError(null);
    } catch (err) {
      setError(thr("fetchFailed", "Failed to fetch items"));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (_id) => {
    if (!canDelete) return;
    setDeleteItemId(_id);
    setDeleteModalOpen(true);
  };

  const handleDeleteClick = async () => {
    if (!deleteItemId) return;
    if (!canDelete) return;

    try {
      await axios.delete(`${BASE_URL}/shifts/delete/${deleteItemId}`, {
        headers,
      });
      fetchItems(organization, searchTerm, statusFilter);
    } catch (err) {
      setError(thr("deleteFailed", "Failed to delete item"));
    } finally {
      setDeleteModalOpen(false);
      setDeleteItemId(null);
    }
  };

  const handleToggleStatus = async (item) => {
    if (!canUpdate) return;
    try {
      const payload = {
        name: item.name,
        status: item.status === "Active" ? "Inactive" : "Active",
        business_id: organization,
      };
      await axios.put(`${BASE_URL}/shifts/update/${item._id}`, payload, {
        headers,
      });
      fetchItems(organization, searchTerm, statusFilter);
    } catch (err) {
      setError(thr("statusUpdateFailed", "Failed to update item status"));
    }
  };

  const translateDay = (day) =>
    thr(`shifts.${String(day).toLowerCase()}`, day);

  const paginatedItems = items.slice(
    (currentPage - 1) * recordsPerPage,
    currentPage * recordsPerPage
  );

  const columns = useMemo(
    () => [
      {
        key: "name",
        header: thr("shifts.shiftName", "Shift Name"),
        render: (item) => (
          <span className="epc-cell__primary">{item.name}</span>
        ),
      },
      {
        key: "startTime",
        header: thr("shifts.startTime", "Start Time"),
        render: (item) =>
          item.startTime ? formatTime(item.startTime) : "—",
      },
      {
        key: "endTime",
        header: thr("shifts.endTime", "End Time"),
        render: (item) => (item.endTime ? formatTime(item.endTime) : "—"),
      },
      {
        key: "break",
        header: thr("shifts.break", "Break"),
        render: (item) => item.breakMinutesAllowed || "—",
      },
      {
        key: "lateGrace",
        header: thr("shifts.lateGrace", "Late Grace"),
        render: (item) =>
          item.lateArrivalGracePeriod
            ? thr("shifts.minutesSuffix", "{{count}} min", {
                count: item.lateArrivalGracePeriod,
              })
            : "—",
      },
      {
        key: "earlyGrace",
        header: thr("shifts.earlyGrace", "Early Grace"),
        render: (item) =>
          item.earlyDepartureGracePeriod
            ? thr("shifts.minutesSuffix", "{{count}} min", {
                count: item.earlyDepartureGracePeriod,
              })
            : "—",
      },
      {
        key: "weeklyOff",
        header: thr("shifts.weeklyOff", "Weekly Off"),
        render: (item) =>
          Array.isArray(item.weeklyOffDay)
            ? item.weeklyOffDay.map(translateDay).join(", ") || "—"
            : item.weeklyOffDay
              ? translateDay(item.weeklyOffDay)
              : "—",
      },
      {
        key: "eodAfter",
        header: thr("shifts.eodAfter", "EOD After"),
        render: (item) => item.runEODAfter ?? "—",
      },
      {
        key: "timezone",
        header: thr("shifts.timezone", "Timezone"),
        render: (item) => item.timezone || "—",
      },
      {
        key: "status",
        header: thr("status", "Status"),
        render: (item) => (
          <ToggleSwitch
            isOn={item.status === "Active"}
            handleToggle={() => handleToggleStatus(item)}
            disabled={!canUpdate}
          />
        ),
      },
      {
        key: "actions",
        header: thr("actions", "Actions"),
        align: "right",
        render: (item) => (
          <ActionButtons
            rbac={{ canUpdate, canDelete }}
            items={[
              {
                tooltip: thr("edit", "Edit"),
                action: ACTION_BUTTON_TYPES.EDIT,
                onClick: () => handleEdit(item),
              },
              {
                tooltip: thr("delete", "Delete"),
                action: ACTION_BUTTON_TYPES.DELETE,
                onClick: () => handleDelete(item._id),
              },
            ]}
          />
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, canUpdate, canDelete]
  );

  if (!isOrgLoaded && !organization) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white">
        <p className="text-gray-600">
          {thr("loadingOrganization", "Loading organization...")}
        </p>
      </div>
    );
  }

  if (error) {
    return <div>{thr("errorPrefix", "Error: {{error}}", { error })}</div>;
  }

  return (
    <EpcListPage
      flush
      title={thr("shifts.shiftName", "Shifts")}
      action={
        canAdd ? (
          <Button size="sm" onClick={handleAddNew}>
            <PlusIcon size={15} />
            {thr("addNew", "Add New")}
          </Button>
        ) : null
      }
      searchValue={searchTerm}
      searchPlaceholder={thr("shifts.searchPlaceholder", "Search shifts...")}
      onSearchChange={(value) => {
        setSearchTerm(value ? value.trim() : "");
        setCurrentPage(1);
      }}
      filterSubtitle={thr(
        "shifts.filterSubtitle",
        "Filter by status or search by name."
      )}
      filters={[
        {
          key: "status",
          placeholder: thr("selectStatus", "Select Status"),
          options: [
            { value: "Active", label: thr("active", "Active") },
            { value: "Inactive", label: thr("inactive", "Inactive") },
          ],
        },
      ]}
      filterValues={{ status: statusFilter }}
      onFilterChange={(key, value) => {
        if (key === "status") {
          setStatusFilter(value || "");
          setCurrentPage(1);
        }
      }}
      onFilterReset={() => {
        setSearchTerm("");
        setStatusFilter("");
        setCurrentPage(1);
      }}
      tableTitle={thr("shifts.shiftName", "Shifts")}
      columns={columns}
      rows={paginatedItems}
      loading={loading}
      emptyMessage={thr("noData", "No data available")}
      page={currentPage}
      pageSize={recordsPerPage}
      total={items.length}
      itemLabel="shifts"
      onPageChange={setCurrentPage}
      onPageSizeChange={(perPage) => {
        setRecordsPerPage(perPage);
        setCurrentPage(1);
      }}
    >
      <AddEditModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        item={editItem}
        onSubmit={handleSubmit}
        canSubmit={editItem ? canUpdate : canAdd}
      />
      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteClick}
      />
    </EpcListPage>
  );
};

export default EstimatesPage;
