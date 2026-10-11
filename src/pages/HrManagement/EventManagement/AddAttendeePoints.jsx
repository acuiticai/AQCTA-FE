"use client";

import { useState, useEffect, useRef } from "react";
import AddAttendeePointsHeader from "../components/AddAttendeePointsHeader";
import axios from "axios";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
import { useLocation } from "react-router-dom";
import AddAttendeePointsList from "../components/AddAttendeePointsList";

const AddAttendeePoints = () => {
  const [tasks, setTasks] = useState([]);
  const [totalResults, setTotalResults] = useState(0);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
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

  const handlefetchTasks = async (page = 1, limit = 10) => {
    try {
      setLoading(true);
      const params = {
        page,
        limit,
        ...searchParams,
      };

      const eventId = Location.get("event");
      const staffId = Location.get("attendee");
      console.log("URL: ----" + `${Base_URL}/event/${eventId}/staff`);

      const response = await axios.get(
        `${Base_URL}/task/staff-task-update/?staff=${staffId}&event=${eventId}`,
        { params }
      );

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
      console.log("Datais: ", data);
      await axios.patch(`${Base_URL}/task/add-points/${id}`, {
        pointsObtained: data.taskPoints,
      });
      handlefetchTasks(currentPage, recordsPerPage);
    } catch (err) {
      console.error("Error updating points:", err);
      throw err; // Let the calling component handle the error
    }
  };

  return (
    <div className="w-full container py-8 px-8">
      <AddAttendeePointsHeader
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

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--p-blue)]"></div>
        </div>
      ) : (
        <div className="bg-[#F9F9FA] rounded-2xl mt-8">
          <AddAttendeePointsList
            attendanceRecords={tasks}
            updateAttendanceStatus={handleUpdateTasks}
            currentPage={currentPage}
            recordsPerPage={recordsPerPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            loading={loading}
            onRecordsPerPageChange={handleRecordsPerPageChange}
            updateTask={updateEvent}
            totalWeightage={totalWeightage}
          />
        </div>
      )}
    </div>
  );
};

export default AddAttendeePoints;
