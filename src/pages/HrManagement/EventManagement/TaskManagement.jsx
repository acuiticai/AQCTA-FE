"use client";

import { useState, useEffect, useRef } from "react";
import TaskManagementHeader from "../components/TaskManagementHeader";
import axios from "axios";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
import TaskManagementList from "../components/TaskManagementList";
import { useLocation } from "react-router-dom";
import ViewEventAttendees from "./ViewEventAttendees";

const EventManagementPage = () => {
  const [tasks, setTasks] = useState([]);
  const [totalResults, setTotalResults] = useState(0);
  const [recordsPerPage, setRecordsPerPage] = useState(99999);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const currentPageRef = useRef(1);
  const [loading, setLoading] = useState(true);
  const [totalWeightage, setTotalWeightage] = useState(0);
  const [searchParams, setSearchParams] = useState({
    name: "",
    department: "",
    position: "",
    status: "",
    date: "",
  });

  const Location = new URLSearchParams(useLocation().search);
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  const [attendees, setAttendees] = useState([]);

  const [stats, setStats] = useState({
    total: 0,
    approved: 0,
    rejected: 0,
  });

  useEffect(() => {
    handlefetchTasks();
    fetchDepartments();
    fetchPositions();
  }, []);

  const handlefetchTasks = async (page = 1, limit = 99999) => {
    try {
      setLoading(true);
      const params = {
        page,
        limit,
        ...searchParams,
      };

      const eventId = Location.get("event");
      console.log("URL: ----" + `${Base_URL}/task/${eventId}`);

      const response = await axios.get(`${Base_URL}/task/${eventId}`, {
        params,
      });

      console.log("task response -----", response.data.data);
      setTasks(response.data.data || []);
      setTotalWeightage(response.data.totalWeightage);
      setTotalResults(response.data.total || 0);
      setStats({
        total: response.data.total,
        approved: response.data.approvedCount,
        rejected: response.data.rejectedCount,
      });
      // setappliedCount(12),
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

      // Reset to first page when searching
      setCurrentPage(1);
      currentPageRef.current = 1;

      // Fetch with search params
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

      // Refresh the list after status update
      handlefetchTasks(currentPage, recordsPerPage);
    } catch (err) {
      console.error("Error updating task status:", err);
      throw err; // Propagate error to be handled by the component that called this function
    }
  };

  const updateEvent = async (id, data) => {
    try {
      await axios.put(`${Base_URL}/task/update-task/${id}`, data);
      handlefetchTasks(currentPage, recordsPerPage);
    } catch (err) {
      console.error("Error updating event:", err);
      throw err; // Let the calling component handle the error
    }
  };

  const updateStaffTask = async (taskId, data) => {
    console.log("data", data);
    try {
      const Location = new URLSearchParams(window.location.search);
      const eventId = Location.get("event");

      // Use the attendee email from the data instead of current user's email
      const attendeeEmail = data.attendeeEmail;

      await axios.post(`${Base_URL}/task/staff-task-update`, {
        ...data,
        eventTask: taskId,
        email: attendeeEmail,
        event: eventId,
      });

      handlefetchTasks(currentPage, recordsPerPage);
    } catch (err) {
      console.error("Error updating staff task:", err);
      throw err; // Let the calling component handle the error
    }
  };

  const getAttendees = async (attendee) => {
    setAttendees(attendee);
    console.log("attendees parent", attendee);
  };

  return (
    <div className="w-full container py-8 px-8">
      <TaskManagementHeader
        attendees={attendees}
        searchParams={searchParams}
        setSearchParams={setSearchParams}
        handleSearch={handleSearch}
        departments={departments}
        positions={positions}
      />

      {/* Stats */}
      {/* <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-[#EDFCF9] p-4 rounded-xl">
          <h3 className="text-gray-700 font-medium">Missing Punch</h3>
          <p className="text-3xl font-bold mt-2">{stats.total}</p>
        </div>

        <div className="bg-[#F9F9FA] p-4 rounded-xl">
          <h3 className="text-gray-700 font-medium">Leave Requests</h3>
          <p className="text-3xl font-bold mt-2">{stats.approved}</p>
        </div>

        <div className="bg-[#F9F9FA] p-4 rounded-xl">
          <h3 className="text-gray-700 font-medium">Overtime Requests</h3>
          <p className="text-3xl font-bold mt-2">{stats.rejected}</p>
        </div>
      </div> */}
      <div className="bg-[#F9F9FA] p-4 py-2 rounded-xl">
        <div>
          <h3 className="text-gray-700 font-medium">Total Weightage</h3>
          <p className="text-3xl font-bold mt-2">{totalWeightage}/100</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--p-blue)]"></div>
        </div>
      ) : (
        <div className="bg-[#F9F9FA] rounded-2xl mt-4">
          <TaskManagementList
            attendanceRecords={tasks}
            updateAttendanceStatus={handleUpdateTasks}
            currentPage={currentPage}
            recordsPerPage={recordsPerPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            loading={loading}
            onRecordsPerPageChange={handleRecordsPerPageChange}
            updateTask={updateEvent}
            updateStaffTask={updateStaffTask}
            totalWeightage={totalWeightage}
            getAttendees={getAttendees}
          />
        </div>
      )}
      {/* <ViewEventAttendees totalTasks={totalResults} /> */}
    </div>
  );
};

export default EventManagementPage;
