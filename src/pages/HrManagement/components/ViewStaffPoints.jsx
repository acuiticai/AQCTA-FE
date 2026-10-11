"use client";

import {
  ChevronDown,
  ChevronRight,
  Calendar,
  Target,
  Trophy,
  User,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { formatDate } from "@/components/formatAmount";
import { getPublicAppUrl } from "@/utils/publicAppUrl";
// import DatePicker from "react-datepicker"
import csv from "../../../assets/img/icons/csv.png";
import pdf from "../../../assets/img/icons/pdf.png";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import autoTable from "jspdf-autotable";
import { FileSpreadsheet, FileText } from "lucide-react";

const Events = () => {
  const [openEvents, setOpenEvents] = useState([]);
  const [staffData, setStaffData] = useState(null); // Fixed typo: was setSetStaffData
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [yearFilter, setYearFilter] = useState(null);

  const { id } = useParams();
  const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

  const fetchDetailEventPoints = async (year) => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(
        `${Base_URL}/event/staff-points-detail/${id}?year=${year ? year : ""}` // Fixed double slash
      );

      console.log(
        "URL IS: ",
        `${Base_URL}/event/staff-points-detail/${id}?year=${year ? year : ""}`
      );
      console.log("staff-points are", response.data);

      setStaffData(response.data || null); // Fixed function name
    } catch (error) {
      console.error("Error fetching employment records:", error);
      setError("Failed to fetch staff data. Please try again.");
      setStaffData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log("staffId is", id);
    console.log("Year changed to:", yearFilter);
    if (id) {
      fetchDetailEventPoints();
    }
  }, [id]);

  useEffect(() => {
    if (yearFilter) {
      fetchDetailEventPoints(yearFilter);
    }
  }, [yearFilter]);

  const toggleEvent = (eventId) => {
    setOpenEvents((prev) =>
      prev.includes(eventId)
        ? prev.filter((id) => id !== eventId)
        : [...prev, eventId]
    );
  };

  const calculateOverallProgress = () => {
    if (!staffData) return 0;
    const maxPossiblePoints =
      staffData.totalEvents * staffData.maxPointsPerEvent;
    return maxPossiblePoints > 0
      ? (staffData.totalPointsObtained / maxPossiblePoints) * 100
      : 0;
  };

  const getPerformanceStatus = (pointsObtained, maxPoints) => {
    const percentage = maxPoints > 0 ? (pointsObtained / maxPoints) * 100 : 0;
    if (percentage >= 80) return { status: "Excellent", color: "bg-green-500" };
    if (percentage >= 60) return { status: "Good", color: "bg-[blue-500]" };
    if (percentage >= 40) return { status: "Average", color: "bg-yellow-500" };
    return { status: "Needs Improvement", color: "bg-red-500" };
  };

  const ProgressBar = ({ value, className = "" }) => (
    <div className={`w-full bg-gray-200 rounded-full h-2 ${className}`}>
      <div
        className="bg-[var(--p-blue)] h-2 rounded-full transition-all duration-300"
        style={{ width: `${Math.min(value || 0, 100)}%` }}
      ></div>
    </div>
  );

  const downloadExcel = async () => {
    const response = await axios.get(
      `${Base_URL}/event/staff-points-detail/${id}?year=${yearFilter || ""}`
    );
    const eventData = response.data;
    const baseUrl = getPublicAppUrl();

    const exportData = [];

    eventData.events.forEach((event) => {
      exportData.push({
        "Event/Task": {
          t: "s",
          v: event.eventName,
          l: { Target: `${baseUrl}/events/${event.eventId}` },
        },
        Description: event.description || "",
        Date: formatDate(event.eventDate),
        Type: "Event",
        "Max Points": event.maxPoints,
        "Points Obtained": event.pointsObtained,
        Weightage: "",
        Progress: `${event.pointsObtained}/${event.maxPoints}`,
      });

      event.tasks.forEach((task) => {
        exportData.push({
          "Event/Task": `  └─ ${task.taskName}`,
          Description: task.description || "",
          Date: "",
          Type: "Task",
          "Max Points": "",
          "Points Obtained": task.pointsObtained,
          Weightage: `${task.weightage}%`,
          Progress: `${task.pointsObtained} pts`,
        });
      });

      exportData.push({
        "Event/Task": "",
        Description: "",
        Date: "",
        Type: "",
        "Max Points": "",
        "Points Obtained": "",
        Weightage: "",
        Progress: "",
      });
    });

    const summaryRows = [
      {
        "Event/Task": `Event Activities Report - ${eventData.staff.displayName}`,
        Description: "",
        Date: "",
        Type: "",
        "Max Points": "",
        "Points Obtained": "",
        Weightage: "",
        Progress: "",
      },
      {
        "Event/Task": `Generated on: ${formatDate(new Date())}`,
        Description: "",
        Date: "",
        Type: "",
        "Max Points": "",
        "Points Obtained": "",
        Weightage: "",
        Progress: "",
      },
      {
        "Event/Task": `Year: ${eventData.year}`,
        Description: "",
        Date: "",
        Type: "",
        "Max Points": "",
        "Points Obtained": "",
        Weightage: "",
        Progress: "",
      },
      {
        "Event/Task": `Total Events: ${eventData.totalEvents}`,
        Description: "",
        Date: "",
        Type: "",
        "Max Points": "",
        "Points Obtained": "",
        Weightage: "",
        Progress: "",
      },
      {
        "Event/Task": `Total Points: ${eventData.totalPointsObtained}/${
          eventData.totalEvents * eventData.maxPointsPerEvent
        }`,
        Description: "",
        Date: "",
        Type: "",
        "Max Points": "",
        "Points Obtained": "",
        Weightage: "",
        Progress: "",
      },
      {
        "Event/Task": "",
        Description: "",
        Date: "",
        Type: "",
        "Max Points": "",
        "Points Obtained": "",
        Weightage: "",
        Progress: "",
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet([]);
    XLSX.utils.sheet_add_json(worksheet, summaryRows, {
      skipHeader: true,
      origin: "A1",
    });
    XLSX.utils.sheet_add_json(worksheet, exportData, {
      skipHeader: false,
      origin: "A8",
    });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Event Activities");
    XLSX.writeFile(
      workbook,
      `Event_Activities_${eventData.staff.displayName}_${eventData.year}.xlsx`
    );
  };

  const downloadPDF = async () => {
    try {
      const response = await axios.get(
        `${Base_URL}/event/staff-points-detail/${id}?year=${yearFilter || ""}`
      );
      const eventData = response.data;
      const doc = new jsPDF();

      doc.setFontSize(16);
      doc.text(
        `Event Activities Report - ${eventData.staff.displayName}`,
        14,
        15
      );
      doc.setFontSize(10);
      doc.text(`Generated on: ${formatDate(new Date())}`, 14, 22);
      doc.text(`Year: ${eventData.year}`, 14, 28);
      doc.setFontSize(12);
      doc.text(`Total Events: ${eventData.totalEvents}`, 14, 35);
      doc.text(
        `Total Points: ${eventData.totalPointsObtained}/${
          eventData.totalEvents * eventData.maxPointsPerEvent
        }`,
        14,
        42
      );

      let currentY = 55;

      eventData.events.forEach((event, index) => {
        if (currentY > 250) {
          doc.addPage();
          currentY = 20;
        }

        doc.setFontSize(14);
        doc.setFont(undefined, "bold");
        doc.text(`${index + 1}. ${event.eventName}`, 14, currentY);
        currentY += 7;

        if (event.description) {
          doc.setFontSize(10);
          doc.setFont(undefined, "italic");
          const wrappedDesc = doc.splitTextToSize(event.description, 170);
          doc.text(wrappedDesc, 20, currentY);
          currentY += wrappedDesc.length * 5;
        }

        doc.setFontSize(10);
        doc.setFont(undefined, "normal");
        doc.text(`Date: ${formatDate(event.eventDate)}`, 20, currentY);
        currentY += 5;
        doc.text(
          `Points: ${event.pointsObtained}/${event.maxPoints}`,
          20,
          currentY
        );
        currentY += 10;

        const taskHeaders = [
          "Task Name",
          "Description",
          "Weightage",
          "Points Obtained",
        ];
        const taskRows = event.tasks.map((task) => [
          task.taskName,
          task.description || "",
          `${task.weightage}%`,
          `${task.pointsObtained} pts`,
        ]);

        autoTable(doc, {
          startY: currentY,
          head: [taskHeaders],
          body: taskRows,
          theme: "grid",
          styles: { fontSize: 8 },
          headStyles: { fillColor: [173, 208, 57] },
          margin: { left: 20 },
          tableWidth: "auto",
          columnStyles: {
            0: { cellWidth: 50 }, // Task Name
            1: { cellWidth: 60 }, // Description
            2: { cellWidth: 25 }, // Weightage
            3: { cellWidth: 35 }, // Points Obtained
          },
        });

        currentY = doc.lastAutoTable.finalY + 15;
      });

      doc.save(
        `Event_Activities_${eventData.staff.displayName}_${eventData.year}.pdf`
      );
    } catch (err) {
      console.error("Error generating Event Activities PDF:", err);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--p-blue)]"></div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">⚠️ Error</div>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchDetailEventPoints}
            className="px-4 py-2 bg-[var(--p-blue)] text-white rounded hover:bg-[#9CBA33]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // No data state
  if (!staffData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-gray-400 text-xl mb-4">📊</div>
          <p className="text-gray-600 mb-4">No staff data found</p>
          <button
            onClick={fetchDetailEventPoints}
            className="px-4 py-2 bg-[var(--p-blue)] text-white rounded hover:bg-[#9CBA33]"
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  // Main content - only renders when staffData exists
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-[#f4ffcb] rounded-lg">
                <User className="h-6 w-6 text-[var(--p-blue)]" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Progress Summary for {staffData.staff.displayName}'s Events
                </h1>
              </div>
            </div>
            <div className="flex gap-3 items-center">
              {/* <button
                className="bg-[#17B26A] text-white px-4 py-3 rounded-xl flex items-center"
                onClick={downloadExcel}
              >
                <img src={csv} alt="csv-icon" className="mr-2 w-5 h-5 object-contain" />
                Download Excel
              </button>
              <button
                className="bg-[#F04438] text-white px-4 py-3 rounded-xl flex items-center"
                onClick={downloadPDF}
              >
                <img src={pdf} alt="pdf-icon" className="mr-2 w-5 h-5 object-contain" />
                Download PDF
              </button> */}
              <div>
                <button
                  onClick={downloadExcel}
                  title="Download Excel"
                  className="p-2 rounded-full bg-[#17B26A] hover:bg-[#158a57] transition-colors text-white"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                </button>

                <button
                  onClick={downloadPDF}
                  title="Download PDF"
                  className="p-2 rounded-full bg-[#F04438] hover:bg-[#c5372e] transition-colors text-white ml-2"
                >
                  <FileText className="w-4 h-4" />
                </button>
              </div>
              <div>
                <span className="inline-flex items-center rounded-full text-sm font-medium gap-2">
                  <div className="font-semibold">Year:</div>
                  <div className="w-24">
                    <DatePicker
                      selected={
                        staffData.year ? new Date(staffData.year, 0) : null
                      }
                      onChange={(date) => {
                        const year = date.getFullYear();
                        setYearFilter(year);
                      }}
                      showYearPicker
                      dateFormat="yyyy"
                      className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-gray-800 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholderText="Select Year"
                    />
                  </div>
                </span>
              </div>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white border rounded-lg shadow-sm p-4">
              <div className="flex items-center space-x-2">
                <Calendar className="h-5 w-5 text-[var(--p-blue)]" />
                <div>
                  <p className="text-sm text-gray-600">Total Events</p>
                  <p className="text-2xl font-bold">
                    {staffData.totalEvents || 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white border rounded-lg shadow-sm p-4">
              <div className="flex items-center space-x-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="text-sm text-gray-600">Points Obtained</p>
                  <p className="text-2xl font-bold">
                    {staffData.totalPointsObtained.toFixed(2) || 0}/
                    {(staffData.totalEvents || 0) *
                      (staffData.maxPointsPerEvent || 0)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white border rounded-lg shadow-sm p-4">
              <div className="flex items-center space-x-2">
                <Target className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm text-gray-600">Max Points/Event</p>
                  <p className="text-2xl font-bold">
                    {staffData.maxPointsPerEvent.toFixed(2) || 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white border rounded-lg shadow-sm p-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">Overall Progress</p>
                <ProgressBar
                  value={calculateOverallProgress()}
                  className="mb-2"
                />
                <p className="text-sm font-medium">
                  {calculateOverallProgress().toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Events Section */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Events Performance
          </h2>

          {staffData.events && staffData.events.length > 0 ? (
            staffData.events.map((event) => {
              const isOpen = openEvents.includes(event.eventId);
              const performance = getPerformanceStatus(
                event.pointsObtained || 0,
                event.maxPoints || 0
              );
              const progressPercentage =
                event.maxPoints > 0
                  ? (event.pointsObtained / event.maxPoints) * 100
                  : 0;

              return (
                <div
                  key={event.eventId}
                  className="bg-white border rounded-lg shadow-sm overflow-hidden"
                >
                  <button
                    className="w-full p-6 text-left hover:bg-gray-50 transition-colors"
                    onClick={() => toggleEvent(event.eventId)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {isOpen ? (
                          <ChevronDown className="h-5 w-5 text-gray-500" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-gray-500" />
                        )}
                        <div className="text-left">
                          <h3 className="text-lg font-semibold capitalize text-gray-900">
                            {event.eventName}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {formatDate(event.eventDate)} •{" "}
                            {event.tasks?.length || 0} tasks
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white ${performance.color}`}
                        >
                          {performance.status}
                        </span>
                        <div className="text-right">
                          <p className="font-semibold">
                            {event.pointsObtained.toFixed(2) || 0}/
                            {event.maxPoints.toFixed(2) || 0} pts
                          </p>
                          <p className="text-sm text-gray-500">
                            {progressPercentage.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    </div>
                    <ProgressBar value={progressPercentage} className="mt-3" />
                  </button>

                  {isOpen && (
                    <div className="px-6 pb-6">
                      {event.tasks && event.tasks.length > 0 ? (
                        <div className="space-y-3">
                          <h4 className="font-medium text-gray-900 mb-3">
                            Tasks
                          </h4>
                          {event.tasks.map((task) => (
                            <div
                              key={task.taskId}
                              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                            >
                              <div className="flex-1">
                                <p className="font-medium text-gray-900">
                                  {task.taskName}
                                </p>
                                <p className="text-sm text-gray-600">
                                  Weightage: {task.weightage || 0}%
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold text-lg">
                                  {task.pointsObtained || 0}
                                </p>
                                <p className="text-sm text-gray-500">points</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <p>No tasks assigned for this event</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="bg-white border rounded-lg shadow-sm p-8 text-center">
              <p className="text-gray-500">
                No events found for this staff member
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Events;
