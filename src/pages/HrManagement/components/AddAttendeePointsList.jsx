"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { useLocation, useHistory } from "react-router-dom";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
import { formatDate, formatTime } from "@/components/formatAmount";

import { notifyError, notifySuccess } from "@/utils/toast";
import {
  ActionButtons,
  DataTable,
  InputField,
  TextAreaField,
} from "@/page-layouts/index";
import { Link } from "react-router-dom";
import axios from "axios";
import { Eye, SquarePen } from "lucide-react";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";

const AddAttendeePointsList = ({
  attendanceRecords,
  updateAttendanceStatus,
  updateTask,
  updateStaffTask,
  currentPage,
  recordsPerPage,
  totalPages,
  onPageChange,
  onRecordsPerPageChange,
  loading,
}) => {
  const eventId = new URLSearchParams(useLocation().search).get("event");
  const history = useHistory();
  const [adminInfo, setAdminInfo] = useState(null);
  const [businesses, setBusinesses] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [showDocumentsModel, setShowDocumentsModel] = useState(false);
  const [documents, setDocuments] = useState({});
  const [currentTaskId, setCurrentTaskId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showEditModal, setShowEditModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editData, setEditData] = useState({
    taskPoints: "",
  });

  console.log("attendanceRecords", attendanceRecords);
  const [editErrors, setEditErrors] = useState({});
  const [staffUpdateError, setStaffUpdateError] = useState({});

  // Function to format date to DD-MM-YYYY
  // const formatDate = (dateString) => {
  //   const date = new Date(dateString)
  //   return format(date, "dd-MM-yyyy")
  // }

  const fetchStaffList = async () => {
    try {
      const response = await axios.get(`${Base_URL}/staff-management`);
      console.log("staff!", response);
      setStaffList(response.data.staffList || []);
    } catch (err) {
      console.log("err", err);
    }
  };

  // Fetch admin info and businesses from localStorage on component mount
  useEffect(() => {
    fetchStaffList();
    const storedBusinesses = localStorage.getItem("businesses");
    if (storedBusinesses) {
      const data = JSON.parse(storedBusinesses).map((business) => ({
        value: business._id,
        label: business.name,
      }));
      setBusinesses(data);
    }
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

  // const handleApproveClick = (attendanceId) => {
  //   setCurrentTaskId(attendanceId)
  //   setShowAttendeesModel(true)
  // }

  // const handleRejectClick = (attendanceId) => {
  //   setCurrentTaskId(attendanceId)
  //   setRejectReason("")
  //   setShowRejectModal(true)
  // }

  const handleViewAttendeeEventTask = (attendee) => {
    console.log("Task -------", eventId);
    console.log("Hello");
    console.log("Task -------", attendee);
    console.log(attendee);
    setCurrentTaskId(attendee._id);

    // setEditData({
    //   points: attendee.weightage || [],
    // });

    setShowEditModal(true);

    // history.push(`/add-attendee-points?event=${eventId}&attendee=${attendee._id}`)
  };

  const HandleOpenFile = async (documentId) => {
    console.log("document_id", documentId);
    try {
      let Response = await axios.get(
        `${Base_URL}/documents/getFileWithAllData/${documentId}`
      );
      console.log("document_id Response", Response);
      window.open(Response.data.data.url, "_blank");
    } catch (error) {
      notifyError("Error getting file");
      console.log("Error : ", error);
    }
  };

  const handleCloseEditModel = () => {
    setShowEditModal(false);
    setEditErrors({});
  };

  const handleEditConfirm = async (type) => {
    const errors = {};

    if (!editData.taskPoints || editData.taskPoints.trim() === "") {
      errors.taskPoints = "Task Points are required";
    }

    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      console.log("Validation errors:", errors);
      return;
    }

    setEditErrors({});
    setIsSubmitting(true);

    try {
      console.log("editData:", editData);
      await updateTask(currentTaskId, editData);
      notifySuccess("Event updated successfully!");

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

  return (
    <div>
      <div className="overflow-x-auto">
        <DataTable
          // actionButtons={[
          //   {
          //     label: "New Attendance Request",
          //     onClick: () => history.push("/apply-attendance"),
          //   },
          // ]}
          searchValue={searchQuery}
          onSearch={(value) => setSearchQuery(value)}
          searchPlaceholder="Search"
          headers={[
            "Task Name",
            "Details",
            "Documents",
            "Points Obtained",
            "Action",
          ]}
          data={attendanceRecords}
          colWidths={{
            Name: "200px",
            Location: "150px",
            Action: "120px",
          }}
          totalPages={totalPages}
          currentPage={currentPage}
          onPageChange={onPageChange}
          recordsPerPage={recordsPerPage}
          onRecordsPerPageChange={onRecordsPerPageChange}
          loading={loading}
          renderRow={(attendees) => {
            return (
              attendees && (
                <tr key={attendees._id} className="border-b border-gray-100">
                  {/* task name */}
                  <td className="py-4 px-4">
                    {attendees.eventTask.taskName || "-"}
                  </td>

                  {/* weightage */}
                  <td className="py-4 px-4">{attendees.details || "-"}</td>

                  <td className="py-4 px-4">
                    <span
                      onClick={() => {
                        setShowDocumentsModel(true);
                        setDocuments(attendees.documents);
                      }}
                      className="hover:underline cursor-pointer"
                    >
                      View All
                    </span>
                  </td>

                  <td className="py-4 px-4">
                    {attendees.pointsObtained || 0}/
                    {attendees.eventTask.weightage || 0}
                  </td>
                  {/* Action Buttons (Placeholder) */}
                  {/* If you need actions like "View Details", "Edit", "Delete", you can uncomment and adjust this */}
                  {
                    <td className="py-4 px-4 flex gap-2 items-center w-full justify-center">
                      <ActionButtons
                        items={[
                          // Conditionally show Edit
                          {
                            action: ACTION_BUTTON_TYPES.ASSIGN,
                            title: "Add Points",
                            onClick: () =>
                              handleViewAttendeeEventTask(attendees),
                          },
                        ].filter(Boolean)}
                      />
                    </td>
                  }
                </tr>
              )
            );
          }}
        />
      </div>
      {showDocumentsModel && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl min-h-[40vh] max-h-[70vh] p-6">
            <h2 className="text-xl font-semibold">Documents</h2>
            <div className="flex justify-between items-center mb-4 w-full">
              <div className="w-full min-h-72 py-2 max-h-[45vh] overflow-auto grid grid-cols-2 gap-4">
                {documents.map((document) => {
                  return (
                    <>
                      <div className="h-[80px] w-full border border-gray-200 p-4 rounded-md flex justify-between items-center space-y-0">
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
                    </>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col space-y-3 mt-auto">
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

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Add Task Points</h2>
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

            {/* <p className="text-gray-700 mb-4">Assign Task Points</p> */}

            <div className="space-y-4 h-[50vh] max-h-max">
              <div>
                {/* <label className="block text-gray-700 mb-2">Points</label> */}
                <InputField
                  name="taskPoints"
                  type="number"
                  value={editData.taskPoints}
                  onChange={(e) =>
                    setEditData({ ...editData, taskPoints: e.target.value })
                  }
                  placeholder="Add Task Point"
                />
                {editErrors.taskPoints && (
                  <p className="text-red-500 text-sm mt-1">
                    {editErrors.taskPoints}
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
    </div>
  );
};

export default AddAttendeePointsList;
