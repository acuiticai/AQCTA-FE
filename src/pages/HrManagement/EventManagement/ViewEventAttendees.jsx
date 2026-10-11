import { useState, useEffect, useRef } from "react";
import ViewAttendeesHeader from "../components/ViewAttendeesHeader";
import axios from "axios";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
import { useLocation } from "react-router-dom";
import ViewAttendeesList from "../components/ViewAttendeesList";

import { useHistory } from "react-router-dom";
import { formatDate } from "@/components/formatAmount";

import { notifyError, notifyWarning, notifySuccess } from "@/utils/toast";
import { InputField } from "@/page-layouts/index";
import {
  Eye,
  ChevronDown,
  ChevronUp,
  FileText,
  Calendar,
  User,
  Building2,
  Clock,
  Trophy,
  Target,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Save,
  X,
} from "lucide-react";

// import EventAttendeesList from "../components/EventAttendeesList" // Updated import

const ViewEventAttendees = ({ totalTasks }) => {
  const [attendeesData, setAttendeesData] = useState([]);
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
    handlefetchAttendees();
    fetchDepartments();
    fetchPositions();
  }, []);

  const handlefetchAttendees = async (page = 1, limit = 10) => {
    try {
      setLoading(true);
      const params = {
        page,
        limit,
        ...searchParams,
      };

      const eventId = Location.get("event");
      console.log("URL: ----" + `${Base_URL}/event/${eventId}/staff`);

      const response = await axios.get(
        `${Base_URL}/event/${eventId}/staff?includeTaskUpdates=true`,
        { params }
      );

      console.log("attendees response -----", response.data);

      // Handle the response structure based on your JSON format
      if (response.data.success) {
        setAttendeesData(response.data.data || []);
        setTotalResults(response.data.total || 0);
        setTotalPages(response.data.totalPages || 1);
      } else {
        // Fallback for different response structure
        setAttendeesData(response.data.data || []);
        setTotalWeightage(response.data.totalWeightage || 0);
        setTotalResults(response.data.total || 0);
        setTotalPages(response.data.totalPages || 1);
      }

      setStats({
        total: response.data.total || 0,
        approved: response.data.approvedCount || 0,
        rejected: response.data.rejectedCount || 0,
      });

      setLoading(false);
    } catch (err) {
      console.error("Error fetching attendees records:", err);
      notifyError("Failed to fetch attendees data");
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await axios.get(`${Base_URL}/Departments/get`);
      console.log("departments res", response);
      setDepartments(response.data.data || []);
    } catch (err) {
      console.log("Failed to fetch departments");
      notifyError("Failed to fetch departments");
    }
  };

  const fetchPositions = async () => {
    try {
      const response = await axios.get(`${Base_URL}/Positions/get`);
      console.log("positions response", response);
      setPositions(response.data.data || []);
    } catch (err) {
      console.log("Failed to fetch positions");
      notifyError("Failed to fetch positions");
    }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    currentPageRef.current = page;
    handlefetchAttendees(page, recordsPerPage);
  };

  const handleRecordsPerPageChange = (perPage) => {
    setRecordsPerPage(perPage);
    setCurrentPage(1);
    currentPageRef.current = 1;
    handlefetchAttendees(1, perPage);
  };

  const handleSearch = async () => {
    try {
      setLoading(true);

      // Reset to first page when searching
      setCurrentPage(1);
      currentPageRef.current = 1;

      // Fetch with search params
      await handlefetchAttendees(1, recordsPerPage);
      setLoading(false);
    } catch (err) {
      console.error("Error searching attendees records:", err);
      notifyError("Error searching attendees");
      setLoading(false);
    }
  };

  // Update task points function - this is what our EventAttendeesList component expects
  const updateTaskPoints = async (taskUpdateId, newPoints) => {
    try {
      const response = await axios.patch(
        `${Base_URL}/task/add-points/${taskUpdateId}`,
        {
          pointsObtained: newPoints,
        }
      );

      if (response.data.success) {
        // Refresh the attendees list after points update
        await handlefetchAttendees(currentPage, recordsPerPage);
        return response.data;
      } else {
        throw new Error(response.data.message || "Failed to update points");
      }
    } catch (err) {
      console.error("Error updating task points:", err);
      throw err; // Propagate error to be handled by the component
    }
  };

  return (
    <div className="w-full">
      {/* <ViewAttendeesHeader
        searchParams={searchParams}
        setSearchParams={setSearchParams}
        handleSearch={handleSearch}
        departments={departments}
        positions={positions}
      /> */}

      {/* Stats Cards - Optional, uncomment if needed */}
      {/* <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
          <h3 className="text-blue-700 font-medium">Total Attendees</h3>
          <p className="text-2xl font-bold mt-2 text-blue-900">{stats.total}</p>
        </div>

        <div className="bg-green-50 p-4 rounded-xl border border-green-100">
          <h3 className="text-green-700 font-medium">Active Participants</h3>
          <p className="text-2xl font-bold mt-2 text-green-900">
            {attendeesData.filter((attendee) => attendee.taskUpdates && attendee.taskUpdates.length > 0).length}
          </p>
        </div>

        <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
          <h3 className="text-purple-700 font-medium">Total Points Awarded</h3>
          <p className="text-2xl font-bold mt-2 text-purple-900">
            {attendeesData.reduce((total, attendee) => {
              return total + (attendee.taskUpdates?.reduce((sum, task) => sum + (task.pointsObtained || 0), 0) || 0)
            }, 0)}
          </p>
        </div>
      </div> */}

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--p-blue)]"></div>
        </div>
      ) : (
        <div className="bg-gray-50 rounded-2xl mt-4 p-6">
          <EventAttendeesList
            totalTasks={totalTasks}
            attendeesData={attendeesData}
            updateTaskPoints={updateTaskPoints}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            loading={loading}
          />
        </div>
      )}
    </div>
  );
};

export default ViewEventAttendees;

const EventAttendeesList = ({
  totalTasks,
  attendeesData,
  updateTaskPoints, // Function to update points
  currentPage,
  totalPages,
  onPageChange,
  loading,
}) => {
  const history = useHistory();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCards, setExpandedCards] = useState(new Set());
  const [showDocumentsModel, setShowDocumentsModel] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [editingPoints, setEditingPoints] = useState(new Set());
  const [tempPoints, setTempPoints] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  console.log("attendeesData", attendeesData);

  // Toggle card expansion
  const toggleCardExpansion = (attendeeId) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(attendeeId)) {
      newExpanded.delete(attendeeId);
    } else {
      newExpanded.add(attendeeId);
    }
    setExpandedCards(newExpanded);
  };

  // Toggle points editing
  const togglePointsEditing = (taskUpdateId, currentPoints) => {
    const newEditing = new Set(editingPoints);
    if (newEditing.has(taskUpdateId)) {
      newEditing.delete(taskUpdateId);
      // Remove temp points when canceling edit
      const newTempPoints = { ...tempPoints };
      delete newTempPoints[taskUpdateId];
      setTempPoints(newTempPoints);
    } else {
      newEditing.add(taskUpdateId);
      // Set current points as temp points when starting edit
      setTempPoints({ ...tempPoints, [taskUpdateId]: currentPoints });
    }
    setEditingPoints(newEditing);
  };

  // Handle points change
  const handlePointsChange = (taskUpdateId, value) => {
    setTempPoints({ ...tempPoints, [taskUpdateId]: value });
  };

  // Save points
  const savePoints = async (taskUpdateId, maxPoints) => {
    const newPoints = tempPoints[taskUpdateId];

    // Validation
    if (newPoints === undefined || newPoints === null || newPoints === "") {
      notifyWarning("Points value is required");
      return;
    }

    const pointsNum = Number(newPoints);
    if (isNaN(pointsNum) || pointsNum < 0 || pointsNum > maxPoints) {
      notifyWarning(`Points must be between 0 and ${maxPoints}`);
      return;
    }

    setIsSubmitting(true);
    try {
      await updateTaskPoints(taskUpdateId, pointsNum);

      // Remove from editing state
      const newEditing = new Set(editingPoints);
      newEditing.delete(taskUpdateId);
      setEditingPoints(newEditing);

      // Remove temp points
      const newTempPoints = { ...tempPoints };
      delete newTempPoints[taskUpdateId];
      setTempPoints(newTempPoints);

      notifySuccess("Points updated successfully!");
    } catch (error) {
      console.error("Error updating points:", error);
      notifyError(error?.response?.data?.message || "Failed to update points");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get points color based on value
  const getPointsColor = (points, maxPoints = 100) => {
    const percentage = (points / maxPoints) * 100;
    if (percentage >= 80) return "text-green-600 bg-green-50";
    if (percentage >= 60) return "text-blue-600 bg-blue-50";
    if (percentage >= 40) return "text-yellow-600 bg-yellow-50";
    return "text-red-600 bg-red-50";
  };

  // Get task completion status
  const getTaskCompletionStatus = (taskUpdates) => {
    // if (!taskUpdates || taskUpdates.length === 0) {
    //   return { status: "No Tasks", color: "text-gray-500 bg-gray-100", icon: AlertCircle }
    // }

    const completedTasks = taskUpdates.length;

    if (completedTasks === totalTasks) {
      return {
        status: "All Complete",
        color: "text-green-600 bg-green-50",
        icon: CheckCircle2,
      };
    } else {
      return {
        status: `${completedTasks}/${totalTasks} Complete`,
        color: "text-blue-600 bg-blue-50",
        icon: Target,
      };
    }
    // } else if (completedTasks > 0) {
    //   return { status: `${completedTasks}/${totalTasks} Complete`, color: "text-blue-600 bg-blue-50", icon: Target }
    // }
    // else {
    //   return { status: "Pending", color: "text-yellow-600 bg-yellow-50", icon: Clock }
    // }
  };

  // Calculate total points for an attendee
  const calculateTotalPoints = (taskUpdates) => {
    if (!taskUpdates || taskUpdates.length === 0) return 0;
    return taskUpdates.reduce(
      (total, task) => total + (task.pointsObtained || 0),
      0
    );
  };

  // Format check-in time
  const formatCheckInTime = (dateStr) => {
    if (!dateStr) return "Not checked in";
    return new Date(dateStr).toLocaleString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const HandleOpenFile = async (documentId) => {
    console.log("document_id", documentId);
    try {
      const Response = await axios.get(
        `${Base_URL}/documents/getFileWithAllData/${documentId}`
      );
      console.log("document_id Response", Response);
      window.open(Response.data.data.url, "_blank");
    } catch (error) {
      notifyError("Error getting file");
      console.log("Error : ", error);
    }
  };

  // Filter attendees based on search query
  const filteredAttendees = attendeesData.filter(
    (attendee) =>
      attendee.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      attendee.department?.name
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search attendees..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg
              className="h-5 w-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>

        <div className="text-sm text-gray-500">
          {filteredAttendees.length} attendee
          {filteredAttendees.length !== 1 ? "s" : ""} found
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* Attendee Cards Grid */}
      <div className="grid gap-4 md:gap-6">
        {filteredAttendees.map((attendee) => {
          const isExpanded = expandedCards.has(attendee._id);
          const totalPoints = calculateTotalPoints(attendee.taskUpdates);
          const taskStatus = getTaskCompletionStatus(attendee.taskUpdates);
          const StatusIcon = taskStatus.icon;

          return (
            <div
              key={attendee._id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200 overflow-hidden"
            >
              {/* Card Header - Always Visible */}
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    {/* Attendee Name */}
                    <h3 className="text-lg font-semibold text-gray-900 mb-2 truncate">
                      {attendee.displayName || "Unknown Attendee"}
                    </h3>

                    {/* Key Metrics Row */}
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                      {/* Total Points Badge */}
                      <div
                        className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getPointsColor(
                          totalPoints
                        )}`}
                      >
                        <Trophy className="w-4 h-4 mr-1" />
                        {totalPoints} pts
                      </div>

                      {/* Task Status Badge */}
                      <div
                        className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${taskStatus.color}`}
                      >
                        <StatusIcon className="w-4 h-4 mr-1" />
                        {taskStatus.status}
                      </div>
                    </div>

                    {/* Quick Info Row */}
                    <div className="flex items-center text-sm text-gray-500 space-x-4">
                      <div className="flex items-center">
                        <Building2 className="w-4 h-4 mr-1" />
                        {attendee.department?.name || "No Department"}
                      </div>
                      {attendee.taskUpdates && (
                        <div className="flex items-center">
                          <Target className="w-4 h-4 mr-1" />
                          {attendee.taskUpdates.length} task
                          {attendee.taskUpdates.length !== 1 ? "s" : ""}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 ml-4">
                    {/* Expand/Collapse Button */}
                    <button
                      onClick={() => toggleCardExpansion(attendee._id)}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                      title={isExpanded ? "Collapse" : "Expand"}
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Expandable Content */}
              {isExpanded && (
                <div className="border-t border-gray-100 bg-gray-50">
                  <div className="p-6 space-y-6">
                    {/* Attendee Details Section */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-4 flex items-center">
                        <User className="w-4 h-4 mr-2" />
                        Attendee Information
                      </h4>
                      <div className="bg-white rounded-lg border border-gray-200 p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <span className="text-sm font-medium text-gray-500">
                              Full Name
                            </span>
                            <p className="text-sm text-gray-900 font-medium">
                              {attendee.displayName || "N/A"}
                            </p>
                          </div>

                          <div>
                            <span className="text-sm font-medium text-gray-500">
                              Department
                            </span>
                            <p className="text-sm text-gray-900">
                              {attendee.department?.name || "Not Assigned"}
                            </p>
                          </div>

                          <div>
                            <span className="text-sm font-medium text-gray-500">
                              Check-in Time
                            </span>
                            <p className="text-sm text-gray-900 flex items-center">
                              <Clock className="w-3 h-3 mr-1" />
                              {formatCheckInTime(attendee.checkedInAt)}
                            </p>
                          </div>

                          {/* <div>
                            <span className="text-sm font-medium text-gray-500">Attendee ID</span>
                            <p className="text-sm text-gray-900 font-mono">{attendee._id}</p>
                          </div> */}

                          <div>
                            <span className="text-sm font-medium text-gray-500">
                              Total Points Earned
                            </span>
                            <p className="text-sm font-semibold text-[var(--p-blue)]">
                              {totalPoints} points
                            </p>
                          </div>

                          {/* <div>
                            <span className="text-sm font-medium text-gray-500">Tasks Completed</span>
                            <p className="text-sm font-semibold text-blue-600">
                              {attendee.taskUpdates?.filter((task) => task.pointsObtained > 0).length || 0} /{" "}
                              {attendee.taskUpdates?.length || 0}
                            </p>
                          </div> */}
                        </div>

                        {/* Quick Actions */}
                        <div className="mt-4 pt-4 border-t border-gray-100">
                          <button
                            onClick={() =>
                              history.push(`/staff/${attendee._id}`)
                            }
                            className="inline-flex items-center px-3 py-1.5 text-sm bg-[var(--p-blue)] text-white rounded-md hover:bg-[#9BC234] transition-colors"
                          >
                            <User className="w-3 h-3 mr-1" />
                            View Full Profile
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Task Updates Section */}
                    {attendee.taskUpdates &&
                      attendee.taskUpdates.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 mb-4 flex items-center">
                            <Target className="w-4 h-4 mr-2" />
                            Task Updates & Points ({attendee.taskUpdates.length}
                            )
                          </h4>
                          <div className="space-y-3">
                            {attendee.taskUpdates.map((taskUpdate, index) => {
                              const isEditingThisTask = editingPoints.has(
                                taskUpdate._id
                              );
                              const maxPoints =
                                taskUpdate.eventTask?.weightage || 100;

                              return (
                                <div
                                  key={taskUpdate._id || index}
                                  className="bg-white rounded-lg border border-gray-200 p-4"
                                >
                                  <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1">
                                      <h5 className="font-medium text-gray-900 mb-1">
                                        {taskUpdate.eventTask?.taskName ||
                                          "Unnamed Task"}
                                      </h5>
                                      <div className="flex items-center gap-4 text-sm text-gray-500">
                                        <span className="flex items-center">
                                          <Calendar className="w-3 h-3 mr-1" />
                                          {taskUpdate.createdAt
                                            ? formatDate(taskUpdate.createdAt)
                                            : "No date"}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Points Section with Edit Functionality */}
                                    <div className="ml-4 text-right">
                                      <div className="flex items-center gap-2 mb-2">
                                        {isEditingThisTask ? (
                                          <div className="flex items-center gap-2">
                                            <InputField
                                              type="number"
                                              min={0}
                                              max={maxPoints}
                                              value={
                                                tempPoints[taskUpdate._id] || 0
                                              }
                                              onChange={(e) =>
                                                handlePointsChange(
                                                  taskUpdate._id,
                                                  e.target.value
                                                )
                                              }
                                              className="w-16 text-sm"
                                              disabled={isSubmitting}
                                            />
                                            <span className="text-sm text-gray-500">
                                              / {maxPoints}
                                            </span>
                                            <button
                                              onClick={() =>
                                                savePoints(
                                                  taskUpdate._id,
                                                  maxPoints
                                                )
                                              }
                                              disabled={isSubmitting}
                                              className="p-1 text-green-600 hover:text-green-800 hover:bg-green-50 rounded transition-colors"
                                              title="Save Points"
                                            >
                                              <Save className="w-4 h-4" />
                                            </button>
                                            <button
                                              onClick={() =>
                                                togglePointsEditing(
                                                  taskUpdate._id,
                                                  taskUpdate.pointsObtained
                                                )
                                              }
                                              disabled={isSubmitting}
                                              className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                                              title="Cancel Edit"
                                            >
                                              <X className="w-4 h-4" />
                                            </button>
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-gray-900">
                                              <Trophy className="w-3 h-3 inline mr-1" />
                                              {taskUpdate.pointsObtained || 0} /{" "}
                                              {maxPoints} pts
                                            </span>
                                            <button
                                              onClick={() =>
                                                togglePointsEditing(
                                                  taskUpdate._id,
                                                  taskUpdate.pointsObtained
                                                )
                                              }
                                              className="p-1 text-gray-400 hover:text-white hover:bg-[var(--p-blue)] rounded transition-colors"
                                              title="Edit Points"
                                            >
                                              <Edit3 className="w-3 h-3" />
                                            </button>
                                          </div>
                                        )}
                                      </div>

                                      {/* Progress Bar */}
                                      <div className="text-right mb-1">
                                        <div className="text-xs font-medium text-gray-600">
                                          {Math.round(
                                            ((taskUpdate.pointsObtained || 0) /
                                              maxPoints) *
                                              100
                                          )}
                                          %
                                        </div>
                                      </div>
                                      <div className="w-20 bg-gray-200 rounded-full h-2">
                                        <div
                                          className="bg-[var(--p-blue)] h-2 rounded-full transition-all duration-300"
                                          style={{
                                            width: `${Math.min(
                                              100,
                                              ((taskUpdate.pointsObtained ||
                                                0) /
                                                maxPoints) *
                                                100
                                            )}%`,
                                          }}
                                        ></div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Task Details */}
                                  {taskUpdate.details && (
                                    <div className="mb-3">
                                      <p className="text-sm font-medium text-gray-500 mb-1">
                                        Task Details:
                                      </p>
                                      <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md">
                                        {taskUpdate.details}
                                      </p>
                                    </div>
                                  )}

                                  {/* Task Documents */}
                                  {taskUpdate.documents &&
                                    taskUpdate.documents.length > 0 && (
                                      <div>
                                        <p className="text-xs font-medium text-gray-500 mb-2">
                                          Submitted Documents (
                                          {taskUpdate.documents.length})
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                          {taskUpdate.documents.map(
                                            (doc, docIndex) => (
                                              <button
                                                key={docIndex}
                                                onClick={() =>
                                                  HandleOpenFile(doc.fileId)
                                                }
                                                className="inline-flex items-center px-2 py-1 text-xs bg-[var(--p-blue)] text-white rounded-md hover:bg-[var(--p-blue)] transition-colors"
                                              >
                                                <FileText className="w-3 h-3 mr-1" />
                                                {doc.name ||
                                                  `Doc ${docIndex + 1}`}
                                              </button>
                                            )
                                          )}
                                        </div>
                                      </div>
                                    )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {!loading && filteredAttendees.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 text-gray-300">
            <User className="w-full h-full" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No attendees found
          </h3>
          <p className="text-gray-500">
            {searchQuery
              ? "Try adjusting your search terms"
              : "No attendees have been registered yet"}
          </p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 rounded-lg">
          <div className="flex flex-1 justify-between sm:hidden">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing page <span className="font-medium">{currentPage}</span>{" "}
                of <span className="font-medium">{totalPages}</span>
              </p>
            </div>
            <div>
              <nav
                className="isolate inline-flex -space-x-px rounded-md shadow-sm"
                aria-label="Pagination"
              >
                <button
                  onClick={() => onPageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronUp className="h-5 w-5 rotate-[-90deg]" />
                </button>

                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNum = i + 1;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => onPageChange(pageNum)}
                      className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                        currentPage === pageNum
                          ? "z-10 bg-[var(--p-blue)] text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p-blue)]"
                          : "text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button
                  onClick={() => onPageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronUp className="h-5 w-5 rotate-90" />
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* Documents Modal */}
      {showDocumentsModel && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl min-h-[40vh] max-h-[70vh] p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Documents</h2>
              <button
                onClick={() => setShowDocumentsModel(false)}
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

            <div className="w-full min-h-72 py-2 max-h-[45vh] overflow-auto grid grid-cols-2 gap-4">
              {documents.map((document, index) => (
                <div
                  key={index}
                  className="h-[80px] w-full border border-gray-200 p-4 rounded-md flex justify-between items-center"
                >
                  <div className="flex-1">
                    <p className="font-medium">{document.name}</p>
                    <p className="text-sm text-gray-500">
                      Document {index + 1}
                    </p>
                  </div>
                  <div className="cursor-pointer hover:underline flex justify-end">
                    <button onClick={() => HandleOpenFile(document.fileId)}>
                      <Eye className="w-5 h-5 text-[var(--p-blue)]" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col space-y-3 mt-6">
              <button
                onClick={() => setShowDocumentsModel(false)}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-4 rounded-md transition duration-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
