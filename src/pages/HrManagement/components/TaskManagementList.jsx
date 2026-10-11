"use client";

import { useState, useEffect } from "react";
import { useHistory } from "react-router-dom";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
import { formatDate } from "@/components/formatAmount";

import { notifyError, notifySuccess } from "@/utils/toast";
import { InputField, TextAreaField } from "@/page-layouts/index";
import axios from "axios";
import {
  Eye,
  ChevronDown,
  ChevronUp,
  FileText,
  Calendar,
  Weight,
  Edit3,
  Upload,
  CheckCircle2,
  AlertCircle,
  Trophy,
  User,
  Save,
  X,
} from "lucide-react";

const TaskManagementList = ({
  isStaff,
  attendanceRecords,
  updateTask,
  updateStaffTask,
  currentPage,
  totalPages,
  onPageChange,
  loading,
  getAttendees,
}) => {
  const history = useHistory();
  const [adminInfo, setAdminInfo] = useState(null);
  const [showDocumentsModel, setShowDocumentsModel] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showEditModal, setShowEditModal] = useState(false);
  const [showEditStaffUpdate, setShowEditStaffUpdate] = useState(false);
  const [staffUpdateData, setStaffUpdateData] = useState({
    eventTask: "",
    details: "",
    documents: [],
    attendeeId: null,
    attendeeEmail: null,
    staffName: "",
  });
  const [documents, setDocuments] = useState({});
  const [uploading, setUploading] = useState(false);
  const [editData, setEditData] = useState({
    event: "",
    taskName: "",
    weightage: 0,
    description: "",
    documents: [],
  });

  console.log("attendanceRecords", attendanceRecords);
  const [editErrors, setEditErrors] = useState({});

  // Enhanced state for integrated task management and point assignment
  const [expandedTasks, setExpandedTasks] = useState({});
  const [expandedAttendees, setExpandedAttendees] = useState({});
  const [editingPoints, setEditingPoints] = useState({});
  const [pointsValues, setPointsValues] = useState({});
  const [attendeesData, setAttendeesData] = useState([]);
  const [loadingAttendees, setLoadingAttendees] = useState(false);

  // Get weightage color based on value
  const getWeightageColor = (weightage) => {
    if (weightage >= 60) return "text-green-600 bg-green-50";
    if (weightage >= 40) return "text-blue-600 bg-blue-50";
    if (weightage >= 20) return "text-yellow-600 bg-yellow-50";
    return "text-red-600 bg-red-50";
  };

  // Enhanced point assignment and task management functions
  const fetchAttendeesData = async () => {
    try {
      setLoadingAttendees(true);
      const Location = new URLSearchParams(window.location.search);
      const eventId = Location.get("event");

      if (!eventId) {
        console.log("No event ID found in URL");
        return;
      }

      console.log(
        "Making API call to:",
        `${Base_URL}/event/${eventId}/staff?includeTaskUpdates=true`
      );
      const response = await axios.get(
        `${Base_URL}/event/${eventId}/staff?includeTaskUpdates=true`
      );
      console.log("Attendees API response:", response.data);

      setAttendeesData(response.data.data || []);
      getAttendees(response.data.data);
      console.log(
        "Set attendees data, length:",
        (response.data.data || []).length
      );
    } catch (err) {
      console.error("Error fetching attendees:", err);
      setAttendeesData([]);
    } finally {
      setLoadingAttendees(false);
    }
  };

  // Toggle task expansion to show attendees
  const toggleTaskExpansion = (taskId) => {
    setExpandedTasks((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  // Toggle attendee expansion to show detailed update information
  const toggleAttendeeExpansion = (attendeeId) => {
    setExpandedAttendees((prev) => ({
      ...prev,
      [attendeeId]: !prev[attendeeId],
    }));
  };

  // Toggle points editing mode
  const togglePointsEditing = (taskUpdateId, currentPoints) => {
    setEditingPoints((prev) => ({
      ...prev,
      [taskUpdateId]: !prev[taskUpdateId],
    }));
    setPointsValues((prev) => ({
      ...prev,
      [taskUpdateId]: currentPoints || 0,
    }));
  };

  // Handle points value change
  const handlePointsChange = (taskUpdateId, value) => {
    setPointsValues((prev) => ({
      ...prev,
      [taskUpdateId]: value,
    }));
  };

  // Save points for a task update
  const savePoints = async (taskUpdateId, maxPoints) => {
    try {
      const newPoints = parseInt(pointsValues[taskUpdateId]);
      if (newPoints < 0 || newPoints > maxPoints) {
        notifyError(`Points must be between 0 and ${maxPoints}`);
        return;
      }

      await axios.patch(`${Base_URL}/task/add-points/${taskUpdateId}`, {
        pointsObtained: newPoints,
      });

      notifySuccess("Points updated successfully!");
      setEditingPoints((prev) => ({ ...prev, [taskUpdateId]: false }));

      // Refresh attendees data
      fetchAttendeesData();
    } catch (err) {
      console.error("Error updating points:", err);
      notifyError(err?.response?.data?.message || "Failed to update points");
    }
  };

  // Get points color based on performance
  const getPointsColor = (points, maxPoints = 100) => {
    const percentage = (points / maxPoints) * 100;
    if (percentage >= 80) return "text-green-600 bg-green-50";
    if (percentage >= 60) return "text-blue-600 bg-blue-50";
    if (percentage >= 40) return "text-yellow-600 bg-yellow-50";
    return "text-red-600 bg-red-50";
  };

  // Calculate total points for an attendee
  const calculateTotalPoints = (taskUpdates) => {
    return taskUpdates.reduce(
      (total, update) => total + (update.pointsObtained || 0),
      0
    );
  };

  // Get attendees for a specific task - now returns ALL attendees for the event
  const getAttendeesForTask = (taskId) => {
    if (!attendeesData || attendeesData.length === 0) {
      console.log("No attendees data available");
      return [];
    }

    console.log(
      "Getting attendees for task:",
      taskId,
      "Total attendees:",
      attendeesData.length
    );

    // Return all attendees for the event, regardless of whether they have task updates
    return attendeesData.map((attendee) => {
      // Find if this attendee has a task update for this specific task
      const taskUpdate = attendee.taskUpdates?.find((update) => {
        const updateTaskId =
          update.taskId ||
          update.task ||
          update.task_id ||
          update.eventTask?._id;
        return updateTaskId === taskId;
      });

      return {
        ...attendee,
        taskUpdate: taskUpdate || null, // null if no update for this task
      };
    });
  };

  // Fetch admin info from localStorage on component mount
  useEffect(() => {
    const storedAdminInfo = localStorage.getItem("adminInfo");
    if (storedAdminInfo) {
      try {
        const parsedAdminInfo = JSON.parse(storedAdminInfo);
        setAdminInfo(parsedAdminInfo);
        console.log("Admin info loaded:", parsedAdminInfo);
      } catch (error) {
        console.error("Error parsing admin info from localStorage:", error);
      }
    } else {
      console.log("No admin info found in localStorage");
    }
  }, []);

  // Fetch attendees data when component mounts or tasks change
  useEffect(() => {
    if (attendanceRecords && attendanceRecords.length > 0) {
      console.log("Tasks loaded, fetching attendees data");
      fetchAttendeesData();
    }
  }, [attendanceRecords]);

  const handleCloseEditModel = () => {
    setShowEditModal(false);
    setEditErrors({});
  };

  const handleCloseStaffUpdateModel = () => {
    setShowEditStaffUpdate(false);
    setStaffUpdateData({
      eventTask: "",
      details: "",
      documents: [],
      attendeeId: null,
      attendeeEmail: null,
      staffName: "",
    });
  };

  const removeEditDocument = (documentId) => {
    console.log(documentId, editData.documents);
    // Remove from the appropriate state based on which modal is open
    if (showEditStaffUpdate) {
      setStaffUpdateData((prev) => ({
        ...prev,
        documents: prev.documents.filter((doc) => doc._id !== documentId),
      }));
    } else {
      setEditData((prev) => ({
        ...prev,
        documents: prev.documents.filter((doc) => doc._id !== documentId),
      }));
    }
  };

  const handleEditDocumentUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    setUploadSuccess(false);
    setSuccessMessage("");

    const uploadedDocumentsInfo = [];
    let allUploadsSuccessful = true;

    for (const file of files) {
      const formDataForUpload = new FormData();
      const eventNameForPath = editData.eventName || "Event";

      formDataForUpload.append("file_path", `Events/${eventNameForPath}`);
      formDataForUpload.append("customer_id", adminInfo?.id);
      formDataForUpload.append("file_type", file.type);
      formDataForUpload.append("file_size", file.size);
      formDataForUpload.append("file", file);

      try {
        const response = await axios.post(
          `${Base_URL}/documents/uploadDocument`,
          formDataForUpload,
          {
            headers: { "Content-Type": "multipart/form-data" },
          }
        );

        if (response.data.message === "File uploaded successfully") {
          const uploadedFile = response.data.file;
          uploadedDocumentsInfo.push({
            fileId: uploadedFile._id,
            name: uploadedFile.name,
            url: uploadedFile.url || "#",
            downloadUrl: uploadedFile.downloadUrl || "#",
            uploadedAt: new Date().toISOString(),
            size: file.size,
            type: file.type,
          });
        } else {
          allUploadsSuccessful = false;
          notifyError(`Failed to upload ${file.name}`);
        }
      } catch (error) {
        allUploadsSuccessful = false;
        console.error(`Error uploading ${file.name}:`, error);
        notifyError(`Error uploading ${file.name}. Please try again.`);
      }
    }

    // Update the appropriate state based on which modal is open
    if (showEditStaffUpdate) {
      setStaffUpdateData((prev) => ({
        ...prev,
        documents: [...prev.documents, ...uploadedDocumentsInfo],
      }));
    } else {
      setEditData((prev) => ({
        ...prev,
        documents: [...prev.documents, ...uploadedDocumentsInfo],
      }));
    }

    if (allUploadsSuccessful && uploadedDocumentsInfo.length > 0) {
      setSuccessMessage("All selected documents uploaded successfully!");
      setUploadSuccess(true);
    } else if (uploadedDocumentsInfo.length > 0) {
      setSuccessMessage("Some documents uploaded successfully.");
      setUploadSuccess(true);
    } else {
      setSuccessMessage("No documents were uploaded.");
      setUploadSuccess(false);
    }

    setTimeout(() => {
      setUploadSuccess(false);
      setSuccessMessage("");
    }, 3000);

    setUploading(false);
    e.target.value = null;
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

  const handleDownload = async (documentId) => {
    console.log("Downloading document_id", documentId);
    try {
      const response = await axios.get(
        `${Base_URL}/documents/getFileWithAllData/${documentId}`
      );

      if (response.data && response.data.data && response.data.data.url) {
        const link = document.createElement("a");
        link.href = response.data.data.url;
        const fileName = response.data.data.name || "document";
        link.setAttribute("download", fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        notifySuccess("Download started");
      } else {
        notifyError("Error: File URL not found");
      }
    } catch (error) {
      notifyError("Error downloading file");
      console.error("Download error:", error);
    }
  };

  const handleEditClick = (task) => {
    console.log("Task -------", task);
    setCurrentTaskId(task._id);

    setEditData({
      event: task.event?._id || "",
      taskName: task.taskName || "",
      weightage: task.weightage || 0,
      description: task.description || "",
      documents: task.documents || [],
    });

    setShowEditModal(true);
  };

  const handleEditStaffUpdateClick = (task, attendee = null) => {
    console.log("staff update -------", task, attendee);
    setCurrentTaskId(task._id);

    // Check if attendee already has a task update for this task
    const existingTaskUpdate = attendee?.taskUpdate;

    setStaffUpdateData({
      eventTask: task._id || "",
      details: existingTaskUpdate?.details || "",
      documents: existingTaskUpdate?.documents || [],
      attendeeId: attendee?._id || null,
      attendeeEmail: attendee?.email || null,
      taskUpdateId: existingTaskUpdate?._id || null, // Add taskUpdateId for updates
      staffName: attendee?.displayName || attendee?.fullName || "Staff Member",
    });

    setShowEditStaffUpdate(true);
  };

  const handleEditConfirm = async (type) => {
    const errors = {};

    if (type === "task") {
      if (!editData.taskName || editData.taskName.trim() === "") {
        errors.taskName = "Task name is required";
      }

      if (
        editData.weightage === undefined ||
        editData.weightage === null ||
        editData.weightage === ""
      ) {
        errors.weightage = "Weightage is required";
      } else if (
        isNaN(editData.weightage) ||
        Number(editData.weightage) < 0 ||
        Number(editData.weightage) > 100
      ) {
        errors.weightage = "Weightage must be a number between 0 and 100";
      }
    }

    if (type === "staffTask") {
      if (!staffUpdateData.details || staffUpdateData.details.trim() === "") {
        errors.details = "Details are required";
      }
    }

    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      console.log("Validation errors:", errors);
      return;
    }

    setEditErrors({});
    setIsSubmitting(true);
    try {
      if (type === "task") {
        await updateTask(currentTaskId, editData);
        notifySuccess("Event updated successfully!");
      } else if (type === "staffTask") {
        const staffUpdatePayload = {
          ...staffUpdateData,
          eventTask: currentTaskId,
          attendeeId: staffUpdateData.attendeeId,
          attendeeEmail: staffUpdateData.attendeeEmail,
          taskUpdateId: staffUpdateData.taskUpdateId, // Include taskUpdateId for updates
        };
        await updateStaffTask(currentTaskId, staffUpdatePayload);
        notifySuccess(
          staffUpdateData.taskUpdateId
            ? "Task update modified successfully!"
            : "Staff task updated successfully!"
        );
      }

      setShowEditModal(false);
    } catch (error) {
      console.error("Error updating:", error);
      notifyError(
        error?.response?.data?.message || "Failed to update. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter tasks based on search query
  const filteredTasks = attendanceRecords.filter((task) =>
    task.taskName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 p-6">
      {/* Search Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search tasks..."
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
          {filteredTasks.length} task{filteredTasks.length !== 1 ? "s" : ""}{" "}
          found
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* Task Cards Grid - Only for non-staff users */}
      {!isStaff && (
        <div className="grid gap-4 md:gap-6 grid-cols-1">
          {filteredTasks.map((task) => {
            const taskAttendees = getAttendeesForTask(task._id);
            const isExpanded = expandedTasks[task._id];

            return (
              <div
                key={task._id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200 overflow-hidden"
              >
                {/* Card Header - Always Visible */}
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      {/* Task Name */}
                      <h3 className="text-lg font-semibold text-gray-900 mb-2 truncate">
                        {task.taskName || "Untitled Task"}
                      </h3>

                      {/* Weightage Badge */}
                      <div className="flex items-center gap-3 mb-3">
                        <div
                          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getWeightageColor(
                            task.weightage || 0
                          )}`}
                        >
                          <Weight className="w-4 h-4 mr-1" />
                          {task.weightage || 0}% Weight
                        </div>

                        {/* Document Count */}
                        <div
                          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium text-gray-600 bg-gray-100 ${
                            task.documents.length > 0 ? "cursor-pointer" : ""
                          } `}
                          onClick={() => {
                            if (task.documents.length > 0) {
                              setShowDocumentsModel(true);
                              setDocuments(task.documents);
                            }
                          }}
                        >
                          <FileText className="w-4 h-4 mr-1" />
                          {task.documents?.length || 0} docs
                        </div>
                      </div>

                      <div className="line-clamp-2 leading-snug min-h-[calc(1em*2*1.2)] mb-3">
                        {task.description ? task.description : ""}
                      </div>

                      {/* Quick Info Row */}
                      <div className="flex items-center text-sm text-gray-500 space-x-4">
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          {task.createdAt
                            ? formatDate(task.createdAt)
                            : "No date"}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 ml-4">
                      {/* For non-staff users: Show expand/collapse and edit buttons */}
                      {!isStaff && (
                        <>
                          {/* Expand/Collapse Button */}
                          <button
                            onClick={() => toggleTaskExpansion(task._id)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title={
                              isExpanded ? "Hide Attendees" : "Show Attendees"
                            }
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>

                          {/* Edit Task Button - Only for non-staff (admins/managers) */}
                          <button
                            onClick={() => handleEditClick(task)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit Task"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Attendees Section - Only for non-staff users */}
                {!isStaff && isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-gray-900 flex items-center">
                        <User className="w-4 h-4 mr-2" />
                        Task Updates & Points
                      </h4>
                      {loadingAttendees && (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      )}
                    </div>

                    {taskAttendees.length > 0 ? (
                      <div className="space-y-3">
                        {taskAttendees.map((attendee) => {
                          const taskUpdate = attendee.taskUpdate; // Using the new structure
                          const hasUpdate = taskUpdate !== null;
                          const isEditing = editingPoints[taskUpdate?._id];
                          const isAttendeeExpanded =
                            expandedAttendees[attendee._id];

                          return (
                            <div
                              key={attendee._id}
                              className="bg-white rounded-lg border border-gray-200 overflow-hidden"
                            >
                              {/* Attendee Header - Always Visible */}
                              <div className="p-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-3">
                                    {attendee.image && (
                                      <img
                                        src={attendee.image}
                                        alt={attendee.displayName}
                                        className="w-8 h-8 rounded-full object-cover"
                                      />
                                    )}
                                    <div>
                                      <p className="font-medium text-gray-900 text-sm">
                                        {attendee.displayName ||
                                          attendee.fullName}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        {attendee.department?.name} •{" "}
                                        {attendee.position?.name}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center space-x-3">
                                    {/* Status and Points */}
                                    <div className="text-right">
                                      {hasUpdate ? (
                                        <div className="flex items-center space-x-2">
                                          {isEditing ? (
                                            <div className="flex items-center space-x-2">
                                              <input
                                                type="number"
                                                min="0"
                                                max={
                                                  taskUpdate?.eventTask
                                                    ?.weightage ||
                                                  task.weightage ||
                                                  100
                                                }
                                                value={
                                                  pointsValues[
                                                    taskUpdate?._id
                                                  ] || 0
                                                }
                                                onChange={(e) =>
                                                  handlePointsChange(
                                                    taskUpdate?._id,
                                                    e.target.value
                                                  )
                                                }
                                                className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                              />
                                              <button
                                                onClick={() =>
                                                  savePoints(
                                                    taskUpdate?._id,
                                                    taskUpdate?.eventTask
                                                      ?.weightage ||
                                                      task.weightage ||
                                                      100
                                                  )
                                                }
                                                className="p-1 text-green-600 hover:text-green-700"
                                                title="Save Points"
                                              >
                                                <Save className="w-4 h-4" />
                                              </button>
                                              <button
                                                onClick={() =>
                                                  setEditingPoints((prev) => ({
                                                    ...prev,
                                                    [taskUpdate?._id]: false,
                                                  }))
                                                }
                                                className="p-1 text-gray-500 hover:text-gray-700"
                                                title="Cancel"
                                              >
                                                <X className="w-4 h-4" />
                                              </button>
                                            </div>
                                          ) : (
                                            <div className="flex items-center space-x-2">
                                              <div
                                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPointsColor(
                                                  taskUpdate?.pointsObtained ||
                                                    0,
                                                  taskUpdate?.eventTask
                                                    ?.weightage ||
                                                    task.weightage ||
                                                    100
                                                )}`}
                                              >
                                                <Trophy className="w-3 h-3 mr-1" />
                                                {taskUpdate?.pointsObtained ||
                                                  0}
                                                /
                                                {taskUpdate?.eventTask
                                                  ?.weightage ||
                                                  task.weightage ||
                                                  100}{" "}
                                                pts
                                              </div>
                                              {!isStaff && (
                                                <button
                                                  onClick={() =>
                                                    togglePointsEditing(
                                                      taskUpdate?._id,
                                                      taskUpdate?.pointsObtained
                                                    )
                                                  }
                                                  className="p-1 text-gray-400 hover:text-blue-600"
                                                  title="Edit Points"
                                                >
                                                  <Edit3 className="w-3 h-3" />
                                                </button>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <div className="flex items-center space-x-2">
                                          <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-gray-500 bg-gray-100">
                                            <AlertCircle className="w-3 h-3 mr-1" />
                                            Update not added
                                          </div>
                                          {/* Update Task Button - Always visible for non-staff users */}
                                          {!isStaff && (
                                            <button
                                              onClick={() =>
                                                handleEditStaffUpdateClick(
                                                  task,
                                                  attendee
                                                )
                                              }
                                              className="p-1 text-gray-400 hover:text-green-600"
                                              title={
                                                hasUpdate
                                                  ? "Edit Task Update"
                                                  : "Submit Task Update"
                                              }
                                            >
                                              <Upload className="w-3 h-3" />
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </div>

                                    {/* Status Indicator */}
                                    <div className="flex items-center">
                                      {hasUpdate ? (
                                        taskUpdate?.status === "completed" ? (
                                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                                        ) : taskUpdate?.status === "pending" ? (
                                          <AlertCircle className="w-4 h-4 text-yellow-600" />
                                        ) : (
                                          <>
                                            {/* <Target className="w-4 h-4 text-gray-400" /> */}
                                          </>
                                        )
                                      ) : (
                                        <>
                                          {/* <Target className="w-4 h-4 text-gray-400" /> */}
                                        </>
                                      )}
                                    </div>

                                    {/* Expand/Collapse Button for Attendee Details */}
                                    {hasUpdate && (
                                      <button
                                        onClick={() =>
                                          toggleAttendeeExpansion(attendee._id)
                                        }
                                        className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                        title={
                                          isAttendeeExpanded
                                            ? "Hide Details"
                                            : "Show Details"
                                        }
                                      >
                                        {isAttendeeExpanded ? (
                                          <ChevronUp className="w-4 h-4" />
                                        ) : (
                                          <ChevronDown className="w-4 h-4" />
                                        )}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Expanded Attendee Details */}
                              {hasUpdate && isAttendeeExpanded && (
                                <div className="border-t border-gray-100 bg-gray-50 p-3">
                                  <div className="space-y-3">
                                    {/* Task Update Description */}
                                    {taskUpdate?.details && (
                                      <div>
                                        <h5 className="text-xs font-medium text-gray-700 mb-1">
                                          Update Description:
                                        </h5>
                                        <p className="text-xs text-gray-600 bg-white p-2 rounded border">
                                          {taskUpdate.details}
                                        </p>
                                      </div>
                                    )}

                                    {/* Task Update Documents */}
                                    {taskUpdate?.documents &&
                                      taskUpdate.documents.length > 0 && (
                                        <div>
                                          <h5 className="text-xs font-medium text-gray-700 mb-1">
                                            Documents:
                                          </h5>
                                          <div className="space-y-1">
                                            {taskUpdate.documents.map(
                                              (doc, index) => (
                                                <div
                                                  key={index}
                                                  className="flex items-center justify-between bg-white p-2 rounded border"
                                                >
                                                  <div className="flex items-center space-x-2">
                                                    <FileText className="w-3 h-3 text-gray-500" />
                                                    <span className="text-xs text-gray-600">
                                                      {doc.name ||
                                                        `Document ${index + 1}`}
                                                    </span>
                                                  </div>
                                                  <div className="flex items-center space-x-1">
                                                    <button
                                                      onClick={() =>
                                                        HandleOpenFile(
                                                          doc.fileId
                                                        )
                                                      }
                                                      className="p-1 text-blue-600 hover:text-blue-700"
                                                      title="View Document"
                                                    >
                                                      <Eye className="w-3 h-3" />
                                                    </button>
                                                    {/* <button
                                                onClick={() => handleDownload(doc.fileId)}
                                                className="p-1 text-green-600 hover:text-green-700"
                                                title="Download Document"
                                              >
                                                <Upload className="w-3 h-3" />
                                              </button> */}
                                                  </div>
                                                </div>
                                              )
                                            )}
                                          </div>
                                        </div>
                                      )}

                                    {/* Task Update Metadata */}
                                    <div className="text-xs text-gray-500">
                                      <p>
                                        Submitted:{" "}
                                        {taskUpdate?.createdAt
                                          ? formatDate(taskUpdate.createdAt)
                                          : "Unknown"}
                                      </p>
                                      {/* {taskUpdate?.updatedAt && taskUpdate.updatedAt !== taskUpdate.createdAt && (
                                      <p>Last Updated: {formatDate(taskUpdate.updatedAt)}</p>
                                    )} */}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-500">
                        <p className="text-sm">
                          No attendees found for this event
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State - Only for non-staff users */}
      {!isStaff && !loading && filteredTasks.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 text-gray-300">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No tasks found
          </h3>
          <p className="text-gray-500">
            {searchQuery
              ? "Try adjusting your search terms"
              : "No tasks have been created yet"}
          </p>
        </div>
      )}

      {/* Pagination - Only for non-staff users */}
      {!isStaff && totalPages > 1 && (
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
                          ? "z-10 bg-[var(--p-blue)] text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
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

      {/* Modals */}

      {showDocumentsModel && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl min-h-[40vh] max-h-[70vh] p-6">
            <h2 className="text-xl font-semibold">Documents</h2>
            <div className="flex justify-between items-center mb-4 w-full">
              <div className="w-full min-h-72 py-2 max-h-[45vh] overflow-auto grid grid-cols-2 gap-4">
                {documents.map((document, index) => {
                  return (
                    <div
                      key={index}
                      className="h-[80px] w-full border border-gray-200 p-4 rounded-md flex justify-between items-center space-y-0"
                    >
                      <div className="flex-1">
                        Name: {document.name}
                        <br />
                      </div>
                      <div className="cursor-pointer hover:underline flex justify-end">
                        <span onClick={() => HandleOpenFile(document.fileId)}>
                          <Eye />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col space-y-3 mt-auto">
              <button
                onClick={() => setShowDocumentsModel(false)}
                disabled={isSubmitting}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-4 rounded-md transition duration-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Edit Task</h2>
              <button
                onClick={handleCloseEditModel}
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

            <p className="text-gray-700 mb-4">Update the task details below.</p>

            <div className="space-y-4 h-[50vh] max-h-max">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 mb-2">Task Name</label>
                  <InputField
                    name="taskName"
                    value={editData.taskName}
                    onChange={(e) =>
                      setEditData({ ...editData, taskName: e.target.value })
                    }
                    placeholder="Enter task name"
                  />
                  {editErrors.taskName && (
                    <p className="text-red-500 text-sm mt-1">
                      {editErrors.taskName}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-gray-700 mb-2">
                    Weightage (%)
                  </label>
                  <InputField
                    name="weightage"
                    type="number"
                    min={0}
                    max={100}
                    value={editData.weightage}
                    onChange={(e) =>
                      setEditData({ ...editData, weightage: e.target.value })
                    }
                    placeholder="Enter weightage"
                  />
                  {editErrors.weightage && (
                    <p className="text-red-500 text-sm mt-1">
                      {editErrors.weightage}
                    </p>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-gray-700 mb-2">Description</label>
                <TextAreaField
                  name="description"
                  value={editData.description}
                  onChange={(e) =>
                    setEditData({ ...editData, description: e.target.value })
                  }
                  placeholder="Enter task name"
                />
                {editErrors.description && (
                  <p className="text-red-500 text-sm mt-1">
                    {editErrors.description}
                  </p>
                )}
              </div>

              {/* Document Upload Section */}
              <div className="space-y-8">
                <input
                  type="file"
                  id="document-upload"
                  multiple
                  onChange={handleEditDocumentUpload}
                  accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                  disabled={uploading}
                />
                <label
                  htmlFor="document-upload"
                  className={`cursor-pointer flex flex-col items-center justify-center border py-6 border-gray-200 ${
                    uploading ? "opacity-60 cursor-not-allowed" : ""
                  }`}
                >
                  <div className="text-gray-400 mb-2">
                    <svg
                      className="w-8 h-8"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                  </div>
                  <p className="text-gray-500 text-sm">
                    {uploading
                      ? "Uploading..."
                      : "Click to upload documents (Optional)"}
                  </p>
                  <p className="text-gray-400 text-xs">
                    PDF, DOC, DOCX, TXT, JPG, PNG
                  </p>
                </label>
                {editData.documents?.length > 0 && (
                  <ul className="mt-2 space-y-1 text-sm text-gray-700">
                    {editData.documents.map((doc) => (
                      <li
                        key={doc.fileId}
                        className="flex items-center justify-between bg-gray-50 px-2 py-1 rounded"
                      >
                        <span className="truncate">{doc.name}</span>
                        <div className="flex gap-2 text-xs">
                          <button
                            className="text-blue-500 hover:underline"
                            onClick={() => HandleOpenFile(doc.fileId)}
                          >
                            View
                          </button>
                          <button
                            className="text-green-500 hover:underline"
                            onClick={() => handleDownload(doc.fileId)}
                          >
                            Download
                          </button>
                          <button
                            className="text-red-500 hover:underline"
                            onClick={() => removeEditDocument(doc._id)}
                          >
                            Remove
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {editErrors.documents && (
                  <p className="text-red-500 text-sm mt-1">
                    {editErrors.documents}
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-4 flex-row-reverse mt-6">
              <button
                onClick={() => handleEditConfirm("task")}
                disabled={isSubmitting}
                className={`w-full bg-[var(--p-blue)] hover:bg-[#9FBF29] text-white py-3 px-4 rounded-md transition duration-200 ${
                  isSubmitting ? "opacity-60 cursor-not-allowed" : ""
                }`}
              >
                {isSubmitting ? "Processing..." : "Update Task"}
              </button>

              <button
                onClick={handleCloseEditModel}
                disabled={isSubmitting}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-4 rounded-md transition duration-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditStaffUpdate && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h2
                onClick={() => {
                  console.log(staffUpdateData);
                }}
                className="text-xl font-semibold"
              >
                {staffUpdateData.taskUpdateId
                  ? "Edit Task Update"
                  : "Submit Task Updates for " + staffUpdateData.staffName}
              </h2>
              <button
                onClick={handleCloseStaffUpdateModel}
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

            <p className="text-gray-700 mb-4">
              {staffUpdateData.taskUpdateId
                ? "Modify your existing task update details below."
                : "Provide your task update details below."}
            </p>

            <div className="space-y-4 h-[50vh] max-h-max">
              <div>
                <label className="block text-gray-700 mb-2">Details</label>
                <TextAreaField
                  name="details"
                  value={staffUpdateData.details || ""}
                  onChange={(e) =>
                    setStaffUpdateData({
                      ...staffUpdateData,
                      details: e.target.value,
                    })
                  }
                  placeholder="Enter update details"
                />
                {editErrors.details && (
                  <p className="text-red-500 text-sm mt-1">
                    {editErrors.details}
                  </p>
                )}
              </div>

              <div className="space-y-4">
                <input
                  type="file"
                  id="document-upload"
                  multiple
                  onChange={handleEditDocumentUpload}
                  accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                  disabled={uploading}
                />
                <label
                  htmlFor="document-upload"
                  className={`cursor-pointer flex flex-col items-center justify-center border py-6 border-gray-200 ${
                    uploading ? "opacity-60 cursor-not-allowed" : ""
                  }`}
                >
                  <div className="text-gray-400 mb-2">
                    <svg
                      className="w-8 h-8"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                  </div>
                  <p className="text-gray-500 text-sm">
                    {uploading ? "Uploading..." : "Click to upload documents"}
                  </p>
                  <p className="text-gray-400 text-xs">
                    PDF, DOC, DOCX, TXT, JPG, PNG
                  </p>
                </label>
                {staffUpdateData.documents?.length > 0 && (
                  <ul className="mt-2 space-y-1 text-sm text-gray-700">
                    {staffUpdateData.documents.map((doc) => (
                      <li
                        key={doc.fileId}
                        className="flex items-center justify-between bg-gray-50 px-2 py-1 rounded"
                      >
                        <span className="truncate">{doc.name}</span>
                        <div className="flex gap-2 text-xs">
                          <button
                            className="text-blue-500 hover:underline"
                            onClick={() => HandleOpenFile(doc.fileId)}
                          >
                            View
                          </button>
                          <button
                            className="text-green-500 hover:underline"
                            onClick={() => handleDownload(doc.fileId)}
                          >
                            Download
                          </button>
                          <button
                            className="text-red-500 hover:underline"
                            onClick={() => removeEditDocument(doc._id)}
                          >
                            Remove
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {editErrors.documents && (
                  <p className="text-red-500 text-sm mt-1">
                    {editErrors.documents}
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-4 flex-row-reverse mt-6">
              <button
                onClick={() => handleEditConfirm("staffTask")}
                disabled={isSubmitting}
                className={`w-full bg-[var(--p-blue)] hover:bg-[#9FBF29] text-white py-3 px-4 rounded-md transition duration-200 ${
                  isSubmitting ? "opacity-60 cursor-not-allowed" : ""
                }`}
              >
                {isSubmitting
                  ? "Processing..."
                  : staffUpdateData.taskUpdateId
                  ? "Update Task Update"
                  : "Submit Staff Update"}
              </button>

              <button
                onClick={handleCloseStaffUpdateModel}
                disabled={isSubmitting}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-4 rounded-md transition duration-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskManagementList;
