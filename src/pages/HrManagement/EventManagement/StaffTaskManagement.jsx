"use client";

import { useState, useEffect, useRef, useCallback } from "react"; // Added useCallback
import TaskManagementHeader from "../components/TaskManagementHeader";
import axios from "axios";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
import TaskManagementList from "../components/TaskManagementList";
import { useLocation } from "react-router-dom";
import moment from "moment";
import { formatDate, formatTime } from "@/components/formatAmount";

const StaffTaskManagement = () => {
  const [tasks, setTasks] = useState([]);
  const [totalResults, setTotalResults] = useState(0);
  const [recordsPerPage, setRecordsPerPage] = useState(99999);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const currentPageRef = useRef(1);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useState({
    name: "",
    department: "",
    position: "",
    status: "",
    date: "",
  });

  const Location = new URLSearchParams(useLocation().search);
  const eventId = Location.get("event");
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);

  const [stats, setStats] = useState({
    total: 0,
    approved: 0,
    rejected: 0,
  });

  // ✅ Attendance check-in states
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [checkInSuccess, setCheckInSuccess] = useState(false); // This can be used for a temporary success message
  const [canCheckIn, setCanCheckIn] = useState(false); // New state for check-in eligibility
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false); // New state for already checked in
  const [attendanceDetails, setAttendanceDetails] = useState(null); // New state for attendance details
  const [eventDate, setEventDate] = useState(null); // New state for attendance details

  // Function to fetch check-in status for the current staff and event
  const fetchCheckInStatus = useCallback(async () => {
    if (!eventId) return;

    const email = JSON.parse(localStorage.getItem("adminInfo"))?.email;
    if (!email) {
      console.error("Email not found in localStorage for check-in status.");
      // Optionally, set an error state or message for the user
      return;
    }

    try {
      // Call the new dedicated endpoint for check-in status
      const response = await axios.get(`${Base_URL}/event/check-in-status`, {
        params: {
          email,
          eventId,
        },
      });

      const {
        canCheckIn,
        alreadyCheckedIn,
        attendanceDetails,
        eventDate,
        formattedEventDate,
      } = response.data.data;
      setEventDate(formattedEventDate);
      setCanCheckIn(canCheckIn);
      setAlreadyCheckedIn(alreadyCheckedIn);
      setAttendanceDetails(attendanceDetails);
      console.log("Check-in status fetched:", response.data.data);
    } catch (error) {
      console.error("Error fetching check-in status:", error);
      // Reset states on error to prevent incorrect UI display
      setCanCheckIn(false);
      setAlreadyCheckedIn(false);
      setAttendanceDetails(null);
      // Optionally, show an error message to the user
    }
  }, [eventId]); // Re-run if eventId changes

  useEffect(() => {
    handlefetchTasks();
    fetchDepartments();
    fetchPositions();
  }, []);

  // New useEffect to fetch check-in status when eventId is available
  useEffect(() => {
    fetchCheckInStatus();
  }, [eventId, fetchCheckInStatus]); // Depend on eventId and the memoized fetchCheckInStatus

  const handlefetchTasks = async (page = 1, limit = 99999) => {
    try {
      setLoading(true);

      const params = {
        page,
        limit,
        ...searchParams,
        isStaff: true,
        email: JSON.parse(localStorage.getItem("adminInfo"))?.email,
      };

      console.log("URL: ----" + `${Base_URL}/task/${eventId}`);
      // This API call no longer returns check-in status
      const response = await axios.get(`${Base_URL}/task/${eventId}`, {
        params,
      });

      console.log("task response -----", response.data.data);
      setTasks(response.data.data || []);
      setTotalResults(response.data.total || 0);
      setStats({
        total: response.data.total,
        approved: response.data.approvedCount,
        rejected: response.data.rejectedCount,
      });
      setTotalPages(response.data.totalPages || 1);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching tasks records:", err);
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await axios.get(`${Base_URL}/Departments/get`);
      console.log("departments res", response);
      setDepartments(response.data.data);
    } catch (err) {
      console.log("Failed to fetch departments");
    }
  };

  const fetchPositions = async () => {
    try {
      const response = await axios.get(`${Base_URL}/Positions/get`);
      console.log("positions response", response);
      setPositions(response.data.data);
    } catch (err) {
      console.log("Failed to fetch positions");
    }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    currentPageRef.current = page;
    handlefetchTasks(page, recordsPerPage);
  };

  const handleRecordsPerPageChange = (perPage) => {
    setRecordsPerPage(perPage);
    setCurrentPage(1);
    currentPageRef.current = 1;
    handlefetchTasks(1, perPage);
  };

  const handleSearch = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      Object.keys(searchParams).forEach((key) => {
        if (searchParams[key]) {
          params.append(key, searchParams[key]);
        }
      });

      setCurrentPage(1);
      currentPageRef.current = 1;

      await handlefetchTasks(1, recordsPerPage);
      setLoading(false);
    } catch (err) {
      console.error("Error searching tasks records:", err);
      setLoading(false);
    }
  };

  const handleUpdateTasks = async (id, status, rejectReason) => {
    try {
      await axios.put(`${Base_URL}/tasks/${id}/status`, {
        status,
        rejectReason,
      });

      handlefetchTasks(currentPage, recordsPerPage);
    } catch (err) {
      console.error("Error updating task status:", err);
      throw err;
    }
  };

  const updateEvent = async (id, data) => {
    // staff cannot edit event tasks
  };

  const updateStaffTask = async (eventTask, data) => {
    try {
      const email = JSON.parse(localStorage.getItem("adminInfo"))?.email;
      console.log("data is -------:", eventId);
      await axios.post(`${Base_URL}/task/staff-task-update`, {
        ...data,
        eventTask,
        email,
        event: eventId,
      });
      handlefetchTasks(currentPage, recordsPerPage);
    } catch (err) {
      console.error("Error updating staff task:", err);
      throw err; // Let the calling component handle the error
    }
  };

  // ✅ Handle attendance check-in
  const handleCheckIn = async () => {
    try {
      setCheckInLoading(true);
      const email = JSON.parse(localStorage.getItem("adminInfo"))?.email;
      if (!email) {
        console.error("Email not found");
        setCheckInLoading(false);
        return;
      }

      const response = await axios.post(`${Base_URL}/event/check-in`, {
        eventId,
        email,
      });

      console.log("Check-in response:", response.data);
      setCheckInSuccess(true); // Indicate temporary success
      // After successful check-in, re-fetch the status to update UI
      await fetchCheckInStatus();
    } catch (err) {
      console.error("Error during check-in:", err);
      // Optionally, provide user feedback about the error
    } finally {
      setCheckInLoading(false);
    }
  };

  return (
    <div className="w-full container py-8 px-8">
      <TaskManagementHeader
        isStaff={true}
        searchParams={searchParams}
        setSearchParams={setSearchParams}
        handleSearch={handleSearch}
        departments={departments}
        positions={positions}
      />

      {/* ✅ Attendance Check-in Button */}
      <div className="flex flex-col items-end mb-4">
        {eventDate && (
          <p className="text-sm text-gray-500 mb-2">Event Date: {eventDate}</p>
        )}

        {alreadyCheckedIn ? (
          <button
            disabled={true}
            className="text-green-600 py-2 px-6 rounded-lg font-semibold bg-gray-400"
          >
            {attendanceDetails &&
              ` Checked in at: ${formatTime(attendanceDetails.checkedInAt)}`}
          </button>
        ) : (
          <button
            onClick={handleCheckIn}
            // Disable if loading, or if staff cannot check in, or if already checked in
            disabled={checkInLoading || !canCheckIn}
            className={`py-2 px-6 rounded-lg font-semibold ${
              checkInLoading || !canCheckIn
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-[var(--p-blue)] text-white"
            }`}
          >
            {checkInLoading ? "Marking Attendance..." : "Mark Attendance"}
          </button>
        )}
      </div>

      {/* {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--p-blue)]"></div>
        </div>
      ) : (
        <div className="bg-[#F9F9FA] rounded-2xl mt-4">
          <TaskManagementList
            isStaff={true}
            attendanceRecords={tasks} // Renamed from 'tasks' for clarity if it's showing attendance
            updateAttendanceStatus={handleUpdateTasks}
            currentPage={currentPage}
            recordsPerPage={recordsPerPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            loading={loading}
            onRecordsPerPageChange={handleRecordsPerPageChange}
            updateTask={updateEvent}
            updateStaffTask={updateStaffTask}
          />
        </div>
      )} */}
    </div>
  );
};

export default StaffTaskManagement;
