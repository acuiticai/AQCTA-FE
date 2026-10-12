"use client";

import {
  useState,
  useEffect,
  useRef,
  useContext,
  useCallback,
} from "react";
import AttendanceHeader from "../components/AttendanceHeader";
import axios from "axios";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
import AttendanceList from "../components/AttendanceList";
import { AdminContext } from "@/context/AdminContext";
import { HR_PAGE_INNER, HR_PAGE_SHELL } from "../components/hrPageHeaderStyles";

const EMPTY_ATTENDANCE_FILTERS = {
  name: "",
  departmentName: "",
  positionName: "",
  date: "",
};

const AttendancePage = () => {
  const { state } = useContext(AdminContext);
  const { adminInfo } = state || {};

  const [selectedBusiness, setSelectedBusiness] = useState("");
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [totalResults, setTotalResults] = useState(0);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const currentPageRef = useRef(1);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useState({
    ...EMPTY_ATTENDANCE_FILTERS,
  });
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  const isFirstAttendanceFilterRun = useRef(true);

  const handleClearAttendanceFilters = useCallback(() => {
    setSearchParams({ ...EMPTY_ATTENDANCE_FILTERS });
    setSelectedBusiness("");
  }, []);

  const fetchAttendanceRecords = async (page = 1, limit = 10) => {
    try {
      setLoading(true);
      const params = {
        page,
        limit,
        ...(selectedBusiness && { business: selectedBusiness }),
      };
      if (searchParams.name?.trim()) params.name = searchParams.name.trim();
      if (searchParams.departmentName)
        params.departmentName = searchParams.departmentName;
      if (searchParams.positionName)
        params.positionName = searchParams.positionName;
      if (searchParams.date) params.date = searchParams.date;

      const response = await axios.get(`${Base_URL}/attendance`, { params });

      setAttendanceRecords(response.data.data || []);
      setTotalResults(response.data.total || 0);
      setTotalPages(response.data.totalPages || 1);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching attendance records:", err);
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await fetchDepartments();
      await fetchPositions();
    })();
  }, []);

  useEffect(() => {
    const delay = isFirstAttendanceFilterRun.current ? 0 : 400;
    isFirstAttendanceFilterRun.current = false;
    const id = setTimeout(() => {
      setCurrentPage(1);
      currentPageRef.current = 1;
      fetchAttendanceRecords(1, recordsPerPage);
    }, delay);
    return () => clearTimeout(id);
  }, [searchParams, selectedBusiness]);

  const fetchDepartments = async () => {
    try {
      const response = await axios.get(`${Base_URL}/Departments/get`);
      setDepartments(response.data.data);
    } catch (err) {
      console.log("Failed to fetch departments");
    }
  };

  const fetchPositions = async () => {
    try {
      const response = await axios.get(`${Base_URL}/Positions/get`);
      setPositions(response.data.data);
    } catch (err) {
      console.log("Failed to fetch positions");
    }
  };

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

  const updateAttendanceDates = async (id, date_from, date_to) => {
    try {
      await axios.put(`${Base_URL}/attendance/${id}/dates`, {
        date_from,
        date_to,
      });

      fetchAttendanceRecords(currentPage, recordsPerPage);
    } catch (err) {
      console.error("Error updating attendance dates:", err);
      throw err;
    }
  };

  return (
    <div className={HR_PAGE_SHELL}>
      <div className={HR_PAGE_INNER}>
        <AttendanceHeader
          searchParams={searchParams}
          selectedBusiness={selectedBusiness}
        />

        <div className="mt-6">
          <AttendanceList
            attendanceRecords={attendanceRecords}
            updateAttendanceStatus={updateAttendanceStatus}
            currentPage={currentPage}
            recordsPerPage={recordsPerPage}
            totalResults={totalResults}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            loading={loading}
            onRecordsPerPageChange={handleRecordsPerPageChange}
            updateAttendanceDates={updateAttendanceDates}
            searchParams={searchParams}
            setSearchParams={setSearchParams}
            departments={departments}
            positions={positions}
            selectedBusiness={selectedBusiness}
            setSelectedBusiness={setSelectedBusiness}
            onClearFilters={handleClearAttendanceFilters}
            adminInfo={adminInfo}
          />
        </div>
      </div>
    </div>
  );
};

export default AttendancePage;
