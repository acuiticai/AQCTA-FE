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

const ViewAttendeesList = ({
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
    const eventId = (new URLSearchParams(useLocation().search)).get("event")
    const history = useHistory();
    const [adminInfo, setAdminInfo] = useState(null);
    const [businesses, setBusinesses] = useState([]);
    const [staffList, setStaffList] = useState([]);
    const [currentTaskId, setCurrentTaskId] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [showEditModal, setShowEditModal] = useState(false);
    const [editData, setEditData] = useState({
        eventName: "",
        eventDate: "",
        attendees: [], // array of IDs or objects depending on how you're storing
        location: "",
        documents: [], // array of document info (e.g., URLs or file metadata)
        details: ""
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
        history.push(`/add-attendee-points?event=${eventId}&attendee=${attendee._id}`)
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
                        "Attendee Name",
                        "Department",
                        "Attendance Time",
                        "Action"
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
                                    <td className="py-4 px-4">{attendees.displayName || "-"}</td>

                                    {/* weightage */}
                                    <td className="py-4 px-4">{attendees.department.name || "-"}</td>

                                    <td className="py-4 px-4">
                                        {attendees.checkedInAt ? formatTime(attendees.checkedInAt) + " ( " + formatDate(attendees.checkedInAt) + " ) " : "-"}
                                    </td>

                                    {/* Action Buttons (Placeholder) */}
                                    {/* If you need actions like "View Details", "Edit", "Delete", you can uncomment and adjust this */}
                                    {<td className="py-4 px-4 min-h-[60px] flex gap-2 items-center w-full justify-center">
                                        <ActionButtons
                                            items={[
                                                // Conditionally show Edit
                                                {
                                                    action: ACTION_BUTTON_TYPES.VIEW,
                                                    title: "View Task",
                                                    onClick: () => handleViewAttendeeEventTask(attendees),
                                                }
                                            ].filter(Boolean)}
                                        />
                                    </td>}
                                </tr>
                            )
                        );
                    }}
                />
            </div>
        </div>
    );
};

export default ViewAttendeesList;
