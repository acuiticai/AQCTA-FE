import React from "react";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/page-layouts/index";
import {
  HR_HEADER_BTN_EXCEL,
  HR_HEADER_BTN_PDF,
} from "./hrPageHeaderStyles";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import autoTable from "jspdf-autotable";
import csv from "../../../assets/img/icons/csv.png";
import pdf from "../../../assets/img/icons/pdf.png";
import axios from "axios";
import {
  formatAttendanceTime,
  formatDate,
  formatShiftScheduleDisplay,
  resolveStaffTimezone,
} from "@/components/formatAmount";
import { getPublicAppUrl } from "@/utils/publicAppUrl";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const SKIP_IN_STATUSES = ["Absent", "Leave", "Public Holiday", "Weekly Off"];

/** PDF table header — brand orange #0C2E5A */
const PDF_HEADER_FILL = [242, 144, 16];

const AttendanceHeader = ({ searchParams, selectedBusiness }) => {
  const { t } = useTranslation();

  const fetchAllAttendanceRecords = async () => {
    try {
      const params = {
        limit: 99999,
        ...(selectedBusiness && { business: selectedBusiness }),
      };
      if (searchParams.name?.trim()) params.name = searchParams.name.trim();
      if (searchParams.departmentName)
        params.departmentName = searchParams.departmentName;
      if (searchParams.positionName)
        params.positionName = searchParams.positionName;
      if (searchParams.date) params.date = searchParams.date;

      const response = await axios.get(`${Base_URL}/attendance`, { params });
      return response.data.data || [];
    } catch (error) {
      console.error("Error fetching attendance records:", error);
      return [];
    }
  };

  const getStaffTz = (attendance) =>
    attendance?.staffTimezone || resolveStaffTimezone(attendance?.shift);

  const getCheckInTime = (attendance) => {
    const latestAttendance = attendance?.attendance?.at(-1);
    if (!latestAttendance) return "-";

    const status = latestAttendance?.status;
    if (["Absent", "Leave", "Public Holiday", "Weekly Off"].includes(status)) {
      return "-";
    }

    if (!latestAttendance?.firstCheckIn?.timestamp) return "-";
    const tz = getStaffTz(attendance);
    return formatAttendanceTime({
      formattedTime: latestAttendance.firstCheckIn.formattedTime,
      timestamp: latestAttendance.firstCheckIn.timestamp,
      timezone: tz,
    });
  };

  const getShiftTime = (attendance) =>
    formatShiftScheduleDisplay(attendance?.shift) || "-";

  const getCheckOutTime = (attendance) => {
    const latestAttendance = attendance?.attendance?.at(-1);
    if (!latestAttendance) return "-";

    const status = latestAttendance?.status;
    if (status === "Absent") {
      return "-";
    }

    if (!latestAttendance?.lastCheckOut?.timestamp) return "-";
    const tz = getStaffTz(attendance);
    return formatAttendanceTime({
      formattedTime: latestAttendance.lastCheckOut.formattedTime,
      timestamp: latestAttendance.lastCheckOut.timestamp,
      timezone: tz,
    });
  };

  const getLatestDayRecord = (attendance) => attendance?.attendance?.at(-1);

  const getCheckInIp = (attendance) => {
    const latestAttendance = getLatestDayRecord(attendance);
    if (!latestAttendance) return "-";
    if (SKIP_IN_STATUSES.includes(latestAttendance.status)) return "-";
    return latestAttendance.firstCheckIn?.ipAddress?.trim() || "-";
  };

  const getCheckOutIp = (attendance) => {
    const latestAttendance = getLatestDayRecord(attendance);
    if (!latestAttendance) return "-";
    if (latestAttendance.status === "Absent") return "-";
    return latestAttendance.lastCheckOut?.ipAddress?.trim() || "-";
  };

  const downloadExcel = async () => {
    const allAttendance = await fetchAllAttendanceRecords();
    const baseUrl = getPublicAppUrl();

    const exportData = allAttendance.map((attendance) => {
      const latestAttendance = attendance.attendance?.at(-1);
      return {
        "Employee Name": {
          t: "s",
          v: attendance.displayName || "",
          l: { Target: `${baseUrl}/staff/${attendance._id}` },
        },
        Date: latestAttendance?.date ? formatDate(latestAttendance.date) : "-",
        "Shift Time": getShiftTime(attendance),
        "Check In": getCheckInTime(attendance),
        "Check Out": getCheckOutTime(attendance),
        "Check-in IP": getCheckInIp(attendance),
        "Check-out IP": getCheckOutIp(attendance),
        Status: latestAttendance?.status || "No Record",
      };
    });

    const generatedOnRow = {
      "Employee Name": `Generated on: ${format(
        new Date(),
        "dd-MM-yyyy HH:mm"
      )}`,
    };

    const totalCountRow = {
      "Employee Name": `Total Attendance Records: ${allAttendance.length}`,
    };

    const worksheet = XLSX.utils.json_to_sheet([]);

    XLSX.utils.sheet_add_json(worksheet, [generatedOnRow, totalCountRow], {
      skipHeader: true,
      origin: "A1",
    });

    XLSX.utils.sheet_add_json(worksheet, exportData, {
      skipHeader: false,
      origin: "A4",
    });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance Records");
    XLSX.writeFile(workbook, "Attendance_Records.xlsx");
  };

  const downloadPDF = async () => {
    try {
      const allAttendance = await fetchAllAttendanceRecords();
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

      doc.setFontSize(16);
      doc.text("Attendance Records Report", 14, 15);
      doc.setFontSize(10);
      doc.text(`Generated on: ${formatDate(new Date())}`, 14, 22);
      doc.setFontSize(12);
      doc.text(`Total Attendance Records: ${allAttendance.length}`, 14, 30);

      const headers = [
        "Employee",
        "Date",
        "Shift Time",
        "Check In",
        "Check Out",
        "Check-in IP",
        "Check-out IP",
        "Status",
      ];
      const rows = allAttendance.map((attendance) => {
        const latestAttendance = attendance.attendance?.at(-1);
        return [
          attendance.displayName || "",
          latestAttendance?.date ? formatDate(latestAttendance.date) : "-",
          getShiftTime(attendance),
          getCheckInTime(attendance),
          getCheckOutTime(attendance),
          getCheckInIp(attendance),
          getCheckOutIp(attendance),
          latestAttendance?.status || "No Record",
        ];
      });

      autoTable(doc, {
        startY: 40,
        head: [headers],
        body: rows,
        theme: "grid",
        styles: { fontSize: 7 },
        headStyles: { fillColor: PDF_HEADER_FILL },
      });

      doc.save("Attendance_Records.pdf");
    } catch (err) {
      console.error("Error generating PDF:", err);
    }
  };

  return (
    <PageHeader
      variant="large"
      title={t("attendance.title")}
      description={t("attendance.pageDescription")}
      showAddButton={false}
      renderActions={[
        <button
          key="excel"
          type="button"
          className={HR_HEADER_BTN_EXCEL}
          onClick={downloadExcel}
        >
          <img
            src={csv || "/placeholder.svg"}
            alt="csv-icon"
            className="w-5 h-5 object-contain"
          />
          {t("attendance.downloadExcel")}
        </button>,
        <button
          key="pdf"
          type="button"
          className={HR_HEADER_BTN_PDF}
          onClick={downloadPDF}
        >
          <img
            src={pdf || "/placeholder.svg"}
            alt="pdf-icon"
            className="w-5 h-5 object-contain"
          />
          {t("attendance.downloadPDF")}
        </button>,
      ]}
    />
  );
};

export default AttendanceHeader;
