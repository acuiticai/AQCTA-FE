"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import EventManagementHeader from "../components/EventManagementHeader";
import axios from "axios";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
import EventManagementList from "../components/EventManagementList";
import {
  HR_PAGE_INNER,
  HR_PAGE_SHELL,
  HR_TABLE_CARD,
} from "../components/hrPageHeaderStyles";

const EventManagementPage = () => {
  const { t } = useTranslation();
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const currentPageRef = useRef(1);
  const skipEventFilterEffect = useRef(true);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useState({
    name: "",
    date: "",
  });

  const fetchAttendanceRecords = useCallback(
    async (page = 1, limit = recordsPerPage) => {
      try {
        setLoading(true);
        const params = { page, limit };
        Object.entries(searchParams).forEach(([key, value]) => {
          if (value) params[key] = value;
        });

        const response = await axios.get(`${Base_URL}/event`, { params });

        setAttendanceRecords(response.data.data || []);
        setTotalPages(response.data.totalPages || 1);
      } catch (err) {
        console.error("Error fetching attendance records:", err);
      } finally {
        setLoading(false);
      }
    },
    [searchParams, recordsPerPage]
  );

  useEffect(() => {
    fetchAttendanceRecords(currentPage, recordsPerPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- page/size only
  }, [currentPage, recordsPerPage]);

  const handleSearchParamChange = useCallback((key, value) => {
    setSearchParams((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetEventFilters = useCallback(() => {
    setSearchParams({ name: "", date: "" });
    setCurrentPage(1);
    currentPageRef.current = 1;
  }, []);

  useEffect(() => {
    if (skipEventFilterEffect.current) {
      skipEventFilterEffect.current = false;
      return;
    }

    const id = setTimeout(() => {
      if (currentPageRef.current !== 1) {
        setCurrentPage(1);
        currentPageRef.current = 1;
      } else {
        fetchAttendanceRecords(1, recordsPerPage);
      }
    }, 350);

    return () => clearTimeout(id);
  }, [searchParams.name, searchParams.date, fetchAttendanceRecords, recordsPerPage]);

  const eventTableFilters = useMemo(
    () => [
      {
        isClearButton: true,
        buttonProps: {
          onClick: resetEventFilters,
        },
      },
      {
        isTextInput: true,
        name: "eventNameFilter",
        value: searchParams.name,
        onChange: (v) => handleSearchParamChange("name", v),
        placeholder: t("eventManagement.searchByNameIc"),
      },
      {
        isDatePicker: true,
        value: searchParams.date,
        onChange: (val) => handleSearchParamChange("date", val),
        clearable: true,
      },
    ],
    [searchParams, handleSearchParamChange, resetEventFilters, t]
  );

  const handlePageChange = (page) => {
    setCurrentPage(page);
    currentPageRef.current = page;
    fetchAttendanceRecords(page, recordsPerPage);
  };

  const handleRecordsPerPageChange = (perPage) => {
    setRecordsPerPage(perPage);
    setCurrentPage(1);
    currentPageRef.current = 1;
    fetchAttendanceRecords(1, perPage);
  };

  const updateAttendanceStatus = async (id, status, rejectReason) => {
    try {
      await axios.put(`${Base_URL}/attendance/${id}/status`, {
        status,
        rejectReason,
      });
      fetchAttendanceRecords(currentPage, recordsPerPage);
    } catch (err) {
      console.error("Error updating attendance status:", err);
      throw err;
    }
  };

  const updateEvent = async (id, data) => {
    try {
      await axios.put(`${Base_URL}/event/update-event/${id}`, data);
      fetchAttendanceRecords(currentPage, recordsPerPage);
    } catch (err) {
      console.error("Error updating event:", err);
      throw err;
    }
  };

  return (
    <div className={HR_PAGE_SHELL}>
      <div className={HR_PAGE_INNER}>
      <EventManagementHeader />

      <div className={HR_TABLE_CARD}>
        <EventManagementList
          attendanceRecords={attendanceRecords}
          updateAttendanceStatus={updateAttendanceStatus}
          currentPage={currentPage}
          recordsPerPage={recordsPerPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          loading={loading}
          onRecordsPerPageChange={handleRecordsPerPageChange}
          updateEvent={updateEvent}
          tableFilters={eventTableFilters}
        />
      </div>
      </div>
    </div>
  );
};

export default EventManagementPage;
