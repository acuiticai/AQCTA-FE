"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { LoadScript, Autocomplete } from "@react-google-maps/api";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";

import { format } from "date-fns";
import { useHistory } from "react-router-dom";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
import { formatDate, formatTime } from "@/components/formatAmount";

import { notifyError, notifySuccess } from "@/utils/toast";
import {
  CustomDatePicker,
  DataTable,
  DropdownBasic,
  InputField,
} from "@/page-layouts/index";
import { Link } from "react-router-dom";
import axios from "axios";
import { Eye, SquarePen } from "lucide-react";
import ActionButtons from "@/page-layouts/components/ActionButtons";
import useSingleBusinessMode from "@/hooks/useSingleBusinessMode";

const AttendanceList = ({
  isStaff,
  attendanceRecords,
  updateAttendanceStatus,
  updateEvent,
  currentPage,
  recordsPerPage,
  totalPages,
  onPageChange,
  onRecordsPerPageChange,
  loading,
  checkInStatus,
  handleCheckIn,
  tableFilters = [],
}) => {
  const { t } = useTranslation();
  const { isSingleBusiness, singleBusinessId } = useSingleBusinessMode();
  const history = useHistory();
  const eventActionHeader = t("eventManagement.action");
  const eventTableColWidths = useMemo(
    () => ({
      [t("eventManagement.name")]: "148px",
      [t("eventManagement.date")]: "88px",
      [t("eventManagement.time")]: "118px",
      [t("eventManagement.location")]: "112px",
      [t("eventManagement.attendees")]: "96px",
      [t("eventManagement.documents")]: "96px",
      [t("eventManagement.currentWeightage")]: "108px",
      [t("eventManagement.createdAt")]: "96px",
      [eventActionHeader]: "120px",
      Attendance: "140px",
    }),
    [t, eventActionHeader]
  );
  const [adminInfo, setAdminInfo] = useState(null);
  const [businesses, setBusinesses] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [showAttendeesModel, setShowAttendeesModel] = useState(false);
  const [showDocumentsModel, setShowDocumentsModel] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [currentEventId, setCurrentEventId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [attendees, setAttendees] = useState({});
  const [documents, setDocuments] = useState({});
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [editData, setEditData] = useState({
    eventName: "",
    eventDate: "",
    attendees: [], // array of IDs or objects depending on how you're storing
    location: "",
    locationDetails: {
      // NEW: To store structured address details
      formattedAddress: "",
      streetAddress: "",
      unitHouseInfo: "",
      suburb: "",
      city: "",
      state: "",
      zipCode: "",
      country: "",
      latitude: null,
      longitude: null,
      googlePlaceId: "",
    },

    documents: [], // array of document info (e.g., URLs or file metadata)
  });
  const autocompleteRef = useRef(null);

  console.log("attendanceRecords", attendanceRecords);
  const [editErrors, setEditErrors] = useState({});

  // Function to format date to DD-MM-YYYY
  // const formatDate = (dateString) => {
  //   const date = new Date(dateString)
  //   return format(date, "dd-MM-yyyy")
  // }

  const fetchStaffList = async () => {
    try {
      const response = await axios.get(
        `${Base_URL}/staff-management/staff-names?business=${editData.business}`
      );
      console.log("staff!", response);
      setStaffList(response.data.data || []);
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
  }, [editData.business]);

  const handleCloseEditModel = () => {
    setShowEditModal(false);
    setEditErrors({});
  };

  // Check if attendance date has passed
  const isAttendanceDatePassed = (startDate) => {
    const currentDate = new Date();
    const attendanceStartDate = new Date(startDate);

    // Reset time components to compare dates only
    currentDate.setHours(0, 0, 0, 0);
    attendanceStartDate.setHours(0, 0, 0, 0);

    return attendanceStartDate < currentDate;
  };

  const removeEditDocument = (documentId) => {
    console.log(documentId, editData.documents);
    setEditData((prev) => ({
      ...prev,
      documents: prev.documents.filter((doc) => doc._id !== documentId),
    }));
    // notifySuccess("Document removed");
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
      const eventNameForPath = editData.eventName || "Event"; // fallback if name is missing

      formDataForUpload.append("file_path", `Events/${eventNameForPath}`);
      formDataForUpload.append("business_id", editData.business); // ensure business is set
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

    // Add uploaded files to editData
    setEditData((prev) => ({
      ...prev,
      documents: [...prev.documents, ...uploadedDocumentsInfo],
    }));

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

  const handleDocumentUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    setUploadSuccess(false);
    setSuccessMessage("");

    const uploadedDocumentsInfo = [];
    let allUploadsSuccessful = true;

    for (const file of files) {
      const formDataForUpload = new FormData();
      // You might want to derive a more specific path, e.g., using event name or business ID
      const eventNameForPath = formData.eventName || "Event";
      formDataForUpload.append("file_path", `Events/${eventNameForPath}`);
      formDataForUpload.append("business_id", formData.business); // Ensure business is selected before uploading
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

    setFormData((prev) => ({
      ...prev,
      documents: [...prev.documents, ...uploadedDocumentsInfo], // Add new documents to existing ones
    }));

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

    // Auto-hide success message after 3 seconds
    setTimeout(() => {
      setUploadSuccess(false);
      setSuccessMessage("");
    }, 3000);

    setUploading(false);
    e.target.value = null; // Clear the file input
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

  const handleDownload = async (documentId) => {
    console.log("Downloading document_id", documentId);
    try {
      let response = await axios.get(
        `${Base_URL}/documents/getFileWithAllData/${documentId}`
      );

      if (response.data && response.data.data && response.data.data.url) {
        // Create a temporary anchor element for download
        const link = document.createElement("a");
        link.href = response.data.data.url;

        // Set download attribute with filename from the response or use a default name
        const fileName = response.data.data.name || "document";
        link.setAttribute("download", fileName);

        // Append to body, trigger click and remove
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

  const getStatusColor = (status) => {
    switch (status) {
      case "Present":
        return "text-green-500 bg-green-50";
      case "Absent":
        return "text-red-500 bg-red-50";
      case "Leave":
        return "text-yellow-500 bg-yellow-50";
      default:
        return "text-yellow-500 bg-yellow-50";
    }
  };

  // const handleApproveClick = (attendanceId) => {
  //   setCurrentEventId(attendanceId)
  //   setShowAttendeesModel(true)
  // }

  // const handleRejectClick = (attendanceId) => {
  //   setCurrentEventId(attendanceId)
  //   setRejectReason("")
  //   setShowRejectModal(true)
  // }

  const handleEditClick = (event) => {
    setCurrentEventId(event._id);

    setEditData({
      business:
        event.business?._id ||
        event.business ||
        (isSingleBusiness ? singleBusinessId : "") ||
        "",
      eventName: event.eventName || "",
      eventDate: new Date(event.eventDate) || "", // convert to Date object if needed
      attendees: event?.attendees?.map((e) => e._id) || [],
      location: event.location || "",
      documents: event.documents || [],
    });
    setShowEditModal(true);
  };

  const handleApproveConfirm = async () => {
    setIsSubmitting(true);
    try {
      await updateAttendanceStatus(currentEventId, "Approved");
      setShowAttendeesModel(false);
      notifySuccess("Attendance request successfully approved!"); // Success toast
    } catch (error) {
      console.error("Error approving attendance request:", error);
      notifyError(
        error?.response?.data?.message ||
          "Failed to approve attendance request. Please try again."
      ); // Error toast with server message
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectReason.trim()) {
      return; // Don't submit if reason is empty
    }

    setIsSubmitting(true);
    try {
      await updateAttendanceStatus(currentEventId, "Rejected", rejectReason);
      setShowRejectModal(false);
      setRejectReason("");
      notifySuccess("Attendance request successfully rejected!"); // Success toast
    } catch (error) {
      console.error(
        "Error rejecting attendance request:",
        error?.response?.data?.message
      );
      notifyError(
        error?.response?.data?.message ||
          "Failed to reject attendance request. Please try again."
      ); // Error toast with server message
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditConfirm = async () => {
    const errors = {};
    const resolvedBusinessId =
      editData.business || (isSingleBusiness ? singleBusinessId : "") || "";

    if (!resolvedBusinessId) {
      errors.business = "Business is required";
    }

    if (!editData.eventName || editData.eventName.trim() === "") {
      errors.eventName = "Event name is required";
    }

    if (!editData.eventDate) {
      errors.eventDate = "Event date is required";
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const eventDate = new Date(editData.eventDate);

      if (eventDate < today) {
        errors.eventDate = "Event date cannot be in the past";
      }
    }

    if (!editData.location || editData.location.trim() === "") {
      errors.location = "Location is required";
    }

    if (!editData.attendees || editData.attendees.length === 0) {
      errors.attendees = "At least one attendee is required";
    }

    // if (!editData.documents || editData.documents.length === 0) {
    //   errors.attendees = "At least one document is required";
    // }

    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      console.log("errors ", errors);
      return;
    }

    setEditErrors({});
    setIsSubmitting(true);

    try {
      console.log("Submitting edit data:", editData);
      // console.log("Event updated successfully", editData);
      await updateEvent(currentEventId, {
        ...editData,
        business: resolvedBusinessId,
      }); // Send full data
      setShowEditModal(false);
      notifySuccess("Event updated successfully!");
    } catch (error) {
      console.error("Error updating event:", error);
      notifyError(
        error?.response?.data?.message ||
          "Failed to update event. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePlaceSelect = () => {
    const place = autocompleteRef.current.getPlace();

    if (!place || !place.address_components) {
      console.warn(
        "No place details available from Google Autocomplete. Clearing location."
      );
      // Clear location if user selects nothing valid or types and doesn't select
      setEditData((prev) => ({
        ...prev,
        location: "", // Clear the main location string
        locationDetails: {
          // Clear structured details
          formattedAddress: "",
          streetAddress: "",
          unitHouseInfo: "",
          suburb: "",
          city: "",
          state: "",
          zipCode: "",
          country: "",
          latitude: null,
          longitude: null,
          googlePlaceId: "",
        },
      }));
      // Also clear validation error if it exists
      if (showErrors) {
        setEditErrors((prev) => ({
          ...prev,
          location: "Please enter event location",
        }));
      }
      return;
    }

    console.log("Place selected:", place);

    // 1. Update the main 'location' field with the full formatted address string
    const formattedAddress = place.formatted_address || "";
    // 2. Extract detailed components for structured storage in 'locationDetails'
    const extractedAddressComponents = {
      street_number: "",
      route: "",
      sublocality: "",
      locality: "",
      administrative_area_level_1: "",
      postal_code: "",
      country: "",
      unitHouseInfo: "",
      latitude: place.geometry?.location?.lat() || null,
      longitude: place.geometry?.location?.lng() || null,
      place_id: place.place_id || "",
    };

    place.address_components.forEach((component) => {
      const types = component.types;
      if (types.includes("street_number"))
        extractedAddressComponents.street_number = component.long_name;
      if (types.includes("route"))
        extractedAddressComponents.route = component.long_name;
      if (types.includes("subpremise") || types.includes("premise"))
        extractedAddressComponents.unitHouseInfo = component.long_name;
      if (
        types.includes("sublocality") ||
        types.includes("sublocality_level_1") ||
        types.includes("neighborhood")
      )
        extractedAddressComponents.sublocality = component.long_name;
      if (types.includes("locality"))
        extractedAddressComponents.locality = component.long_name;
      if (types.includes("administrative_area_level_1"))
        extractedAddressComponents.administrative_area_level_1 =
          component.long_name;
      if (types.includes("postal_code"))
        extractedAddressComponents.postal_code = component.long_name;
      if (types.includes("country"))
        extractedAddressComponents.country = component.long_name;
    });

    const structuredLocationDetails = {
      formattedAddress: formattedAddress,
      streetAddress: [
        extractedAddressComponents.street_number,
        extractedAddressComponents.route,
      ]
        .filter(Boolean)
        .join(" ")
        .trim(),
      unitHouseInfo: extractedAddressComponents.unitHouseInfo,
      suburb: extractedAddressComponents.sublocality,
      city: extractedAddressComponents.locality,
      state: extractedAddressComponents.administrative_area_level_1,
      zipCode: extractedAddressComponents.postal_code,
      country: extractedAddressComponents.country,
      latitude: extractedAddressComponents.latitude,
      longitude: extractedAddressComponents.longitude,
      googlePlaceId: extractedAddressComponents.place_id,
    };

    console.log("Structured Location Details:", structuredLocationDetails);
    setEditData((prev) => ({
      ...prev,
      location: formattedAddress,
      locationDetails: structuredLocationDetails,
    }));

    // Clear location validation error if it was present
    if (showErrors) {
      setEditErrors((prev) => ({ ...prev, location: "" }));
    }
  };

  return (
    <LoadScript
      googleMapsApiKey={"AIzaSyDlKtLygdyr4XpjVE1WcyR7yHuigyq_agw"}
      libraries={["places"]}
    >
      <div>
          <DataTable
            wideTable
            skipDynamicColumnWidths
            actionColumnHeaderLabel={eventActionHeader}
            filters={tableFilters}
            colWidths={eventTableColWidths}
            headers={[
              t("eventManagement.name"),
              t("eventManagement.date"),
              t("eventManagement.time"),
              t("eventManagement.location"),
              t("eventManagement.attendees"),
              t("eventManagement.documents"),
              t("eventManagement.currentWeightage"),
              t("eventManagement.createdAt"),
              ...(isStaff ? ["Attendance"] : [eventActionHeader]),
            ]}
            data={attendanceRecords}
            totalPages={totalPages}
            currentPage={currentPage}
            onPageChange={onPageChange}
            recordsPerPage={recordsPerPage}
            onRecordsPerPageChange={onRecordsPerPageChange}
            loading={loading}
            renderRow={(event) => {
              return (
                event && (
                  <tr key={event._id} className="border-b border-gray-100">
                    {/* Event Name & Business Name */}
                    <td className="py-4 px-4 max-w-0">
                      <div className="flex flex-col min-w-0">
                        <Link
                          to={`${
                            isStaff
                              ? "/staff-task-management"
                              : "/task-management"
                          }?event=${event._id}&eventName=${event.eventName}`}
                          className="font-semibold hover:underline truncate block"
                          title={event.eventName}
                        >
                          {event.eventName}
                        </Link>
                        {event.business && !isSingleBusiness && (
                          <span
                            className="text-sm text-gray-500 truncate block"
                            title={event.business.name}
                          >
                            {event.business.name}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-4 px-4 whitespace-nowrap">
                      {event.eventDate ? formatDate(event.eventDate) : "-"}
                    </td>
                    <td className="py-4 px-4">
                      {event.startTime && event.endTime
                        ? `${event.startTime} - ${event.endTime}`
                        : event.startTime
                        ? `Starts at ${event.startTime}`
                        : event.endTime
                        ? `Ends at ${event.endTime}`
                        : "-"}
                    </td>

                    <td className="py-4 px-4 max-w-0 truncate" title={event.location || undefined}>
                      {event.location || "-"}
                    </td>

                    {/* Number of Attendees */}
                    <td className="py-4 px-4">
                      {/* <span>
                      Count: {event.attendees ? event.attendees.length : 0}
                    </span>
                    <br /> */}
                      {/* <Link className="bg-[#cfcfcf4b] m-1 px- py-1 rounded-sm" to={`/staff/${e._id}`}>{e.displayName}</Link> */}
                      <span
                        onClick={() => {
                          setShowAttendeesModel(true);
                          setAttendees(event.attendees);
                        }}
                        className="hover:underline cursor-pointer"
                      >
                        View All
                      </span>
                    </td>

                    {/* Number of Documents */}
                    <td className="py-4 px-4">
                      {/* <span>
                      Count: {event.documents ? event.documents.length : 0}
                    </span>
                    <br /> */}
                      <span
                        onClick={() => {
                          setShowDocumentsModel(true);
                          setDocuments(event.documents);
                        }}
                        className="hover:underline cursor-pointer"
                      >
                        View All
                      </span>
                      {/* <button
                      onClick={() =>
                        HandleOpenFile(claim.supportingDocuments.fileId)
                      }
                      className="hover:underline"
                    >
                      {claim.supportingDocuments.name}
                    </button> */}
                    </td>

                    <td className="py-4 px-4">{event.currentWeightage}</td>
                    <td className="py-4 px-4">
                      {event.createdAt ? formatDate(event.createdAt) : "-"}
                    </td>
                    {isStaff && (
                      <td className="py-4 px-4">
                        {checkInStatus && checkInStatus[event._id] ? (
                          <div className="flex flex-col items-start">
                            {checkInStatus[event._id].alreadyCheckedIn ? (
                              <span className="text-green-600 text-xs font-medium">
                                Checked in at:{" "}
                                {checkInStatus[event._id].attendanceDetails &&
                                checkInStatus[event._id].attendanceDetails
                                  .checkedInAt
                                  ? formatTime(
                                      checkInStatus[event._id].attendanceDetails
                                        .checkedInAt
                                    )
                                  : "-"}
                              </span>
                            ) : (
                              <button
                                className="bg-[var(--p-blue)] hover:bg-[#9FBF29] text-white px-3 py-1 rounded text-xs font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                                disabled={
                                  checkInStatus[event._id].checkInLoading ||
                                  !checkInStatus[event._id].canCheckIn
                                }
                                onClick={() => handleCheckIn(event._id)}
                              >
                                {checkInStatus[event._id].checkInLoading
                                  ? "Marking..."
                                  : "Mark Attendance"}
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                    )}

                    {/* Event Status */}
                    {/* <td className="py-4 px-4"> */}
                    {/* You'll need a getStatusColor function similar to your attendance example */}
                    {/* <span */}
                    {/* className={`px-3 py-1 rounded-full ${getStatusColor( */}
                    {/* event.status */}
                    {/* )}`} */}
                    {/* > */}
                    {/* {event.status || "N/A"} */}
                    {/* </span> */}
                    {/* </td> */}

                    {/* Action Buttons (Placeholder) */}
                    {/* If you need actions like "View Details", "Edit", "Delete", you can uncomment and adjust this */}
                    {!isStaff && (
                      <td className="py-4 px-2 text-center whitespace-nowrap">
                        <div className="flex gap-2 items-center justify-center">
                        <ActionButtons
                          items={[
                            // Conditionally show Edit
                            {
                              action: ACTION_BUTTON_TYPES.EDIT,
                              title: "Edit Event Request",
                              onClick: () => handleEditClick(event),
                            },
                            // Always show View
                            {
                              action: ACTION_BUTTON_TYPES.VIEW,
                              title: "View Event Request",
                              onClick: () =>
                                history.push(
                                  `${
                                    isStaff
                                      ? "/staff-task-management"
                                      : "/task-management"
                                  }?event=${event._id}&eventName=${
                                    event.eventName
                                  }${
                                    !isSingleBusiness && event.business?.name
                                      ? `&business=${encodeURIComponent(
                                          event.business.name,
                                        )}`
                                      : ""
                                  }`
                                ),
                            },
                          ].filter(Boolean)}
                        />
                        {/* {!isStaff && <button
                          className="cursor-pointer"
                          onClick={() => {
                            handleEditClick(event);
                          }}
                          title="Edit Event Request"
                        >
                          <SquarePen />
                        </button>} */}
                        {/* <Link
                          to={`${isStaff ? "/staff-task-management" : "/task-management"}?event=${event._id}`}
                          className="font-semibold hover:underline"
                        >
                          <button className="text-gray-500 p-2 rounded-lg border">
                            <Eye size={18} />
                          </button>
                        </Link> */}
                        </div>
                      </td>
                    )}
                  </tr>
                )
              );
            }}
          />

        {/* Approval Modal */}
        {showAttendeesModel && (
          <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl min-h-[40vh] max-h-[70vh] p-6">
              <h2 className="text-xl font-semibold">Attendees</h2>
              <div className="flex justify-between items-center mb-4 w-full">
                <div className="w-full min-h-72 py-2 max-h-[45vh] overflow-auto grid grid-cols-2 gap-4">
                  {attendees.map((attendee) => {
                    return (
                      <>
                        <div className="h-[80px] w-full border border-gray-200 p-4 rounded-md flex flex-col justify-center items-start space-y-0">
                          <span>
                            Name: {attendee.displayName}
                            <br />
                          </span>
                          <span>
                            Email: {attendee.email}
                            <br />
                          </span>
                          <a
                            href={`/staff/${attendee._id}`}
                            target="_blank"
                            className="cursor-pointer hover:underline"
                          >
                            View Member
                          </a>
                        </div>
                      </>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col space-y-3 mt-auto">
                <button
                  onClick={() => setShowAttendeesModel(false)}
                  disabled={isSubmitting}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-4 rounded-md transition duration-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {showDocumentsModel && (
          <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl min-h-[40vh] max-h-[70vh] p-6">
              <h2 className="text-xl font-semibold">Attendees</h2>
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
                            <span
                              onClick={() => HandleOpenFile(document.fileId)}
                            >
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
                  disabled={isSubmitting}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-4 rounded-md transition duration-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rejection Modal */}
        {showRejectModal && (
          <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">
                  Attendance Request Rejection
                </h2>
                <button
                  onClick={() => setShowRejectModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    ></path>
                  </svg>
                </button>
              </div>

              <p className="text-gray-700 mb-4">
                Please add the reason below to reject the attendance request.
              </p>

              <div className="mb-6">
                <label className="block text-gray-700 mb-2">Reason</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Enter your reason"
                  className="w-full border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
                  rows="4"
                ></textarea>
              </div>

              <div className="flex flex-col space-y-3">
                <button
                  onClick={handleRejectConfirm}
                  disabled={isSubmitting || !rejectReason.trim()}
                  className={`w-full bg-red-500 hover:bg-red-600 text-white py-3 px-4 rounded-md transition duration-200 ${
                    !rejectReason.trim() || isSubmitting
                      ? "opacity-60 cursor-not-allowed"
                      : ""
                  }`}
                >
                  {isSubmitting ? "Processing..." : "Reject"}
                </button>

                <button
                  onClick={() => setShowRejectModal(false)}
                  disabled={isSubmitting}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-4 rounded-md transition duration-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Edit Event</h2>
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

              <p className="text-gray-700 mb-4">
                Update the event details below.
              </p>

              <div className="space-y-4 h-[60vh] max-h-max overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {!isSingleBusiness && (
                  <div>
                    <label className="block text-gray-700 mb-2">Business</label>
                    <DropdownBasic
                      isDisabled={true}
                      name="business"
                      value={editData.business}
                      onChange={(val) =>
                        setEditData({ ...editData, business: val })
                      }
                      options={businesses}
                    />
                    {editErrors.business && (
                      <p className="text-red-500 text-sm mt-1">
                        {editErrors.business}
                      </p>
                    )}
                  </div>
                  )}

                  <div>
                    <label className="block text-gray-700 mb-2">
                      Event Date
                    </label>
                    <CustomDatePicker
                      name="eventDate"
                      disabled={true}
                      value={editData.eventDate}
                      onChange={(val) =>
                        setEditData({ ...editData, eventDate: val })
                      }
                    />
                    {editErrors.eventDate && (
                      <p className="text-red-500 text-sm mt-1">
                        {editErrors.eventDate}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-gray-700 mb-2">
                      Event Name
                    </label>
                    <InputField
                      name="eventName"
                      value={editData.eventName}
                      onChange={(e) =>
                        setEditData({ ...editData, eventName: e.target.value })
                      }
                      placeholder="Enter event name"
                    />
                    {editErrors.eventName && (
                      <p className="text-red-500 text-sm mt-1">
                        {editErrors.eventName}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-gray-700 mb-2">Location</label>
                    <Autocomplete
                      onLoad={(autocomplete) => {
                        autocompleteRef.current = autocomplete;
                      }}
                      onPlaceChanged={handlePlaceSelect}
                      options={{
                        types: ["address"],
                        componentRestrictions: { country: [] }, // Customize as needed
                        fields: [
                          "address_components",
                          "formatted_address",
                          "geometry.location",
                          "place_id",
                        ],
                      }}
                    >
                      <InputField
                        name="location"
                        value={editData.location}
                        onChange={(e) =>
                          setEditData({ ...editData, location: e.target.value })
                        }
                        placeholder="Enter location"
                      />
                    </Autocomplete>
                    {editErrors.location && (
                      <p className="text-red-500 text-sm mt-1">
                        {editErrors.location}
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-gray-700 mb-2">Attendees</label>
                  <DropdownBasic
                    isMulti
                    name="attendees"
                    value={editData.attendees}
                    onChange={(val) =>
                      setEditData({ ...editData, attendees: val })
                    }
                    options={staffList.map((staff) => ({
                      label: staff.displayName,
                      value: staff._id,
                    }))}
                  />
                  {editErrors.attendees && (
                    <p className="text-red-500 text-sm mt-1">
                      {editErrors.attendees}
                    </p>
                  )}
                </div>

                <div className="space-y-8">
                  {/* <label className="block text-gray-700 mb-2">Documents</label> */}
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

              <div className="flex gap-4 flex-row-reverse">
                <button
                  onClick={handleEditConfirm}
                  disabled={isSubmitting}
                  className={`w-full bg-[var(--p-blue)] hover:bg-[#9FBF29] text-white py-3 px-4 rounded-md transition duration-200 ${
                    isSubmitting ? "opacity-60 cursor-not-allowed" : ""
                  }`}
                >
                  {isSubmitting ? "Processing..." : "Update Event"}
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
    </LoadScript>
  );
};

export default AttendanceList;
