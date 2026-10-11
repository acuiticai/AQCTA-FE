import * as XLSX from "xlsx"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import axios from "axios"
import { formatDate, resolveStaffTimezone } from "@/components/formatAmount"
import {
  getAttendanceInOutDisplay,
  getAttendanceIpDisplay,
} from "../Reports/hrReportHelpers"

// Constants
const EXCEL_LIMIT = 999999
const PDF_PAGE_WIDTH = 297 // A4 landscape width in mm
const PDF_MARGIN = 14
/** Brand orange #0C2E5A — matches HR report PDF exports */
const PDF_HEADER_FILL = [242, 144, 16]

// Professional styling configurations
const PDF_STYLES = {
  header: {
    fontSize: 20,
    fontWeight: "bold",
  },
  subHeader: {
    fontSize: 14,
    fontWeight: "bold",
  },
  normal: {
    fontSize: 11,
  },
  small: {
    fontSize: 9,
  },
  table: {
    theme: "striped",
    styles: {
      fontSize: 8,
      halign: "center",
      cellPadding: 3,
    },
    headStyles: {
      fillColor: PDF_HEADER_FILL,
      textColor: [255, 255, 255],
      halign: "center",
      fontStyle: "bold",
      fontSize: 9,
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
  },
}

/**
 * Month picker values (YYYY-MM) → API date range (first/last calendar day).
 * Must match AttendanceDetail.jsx fetchAttendanceDetails range logic.
 */
export const monthRangeToApiRange = (rangeFilter) => {
  if (!rangeFilter?.from) return null
  const fromDate = `${rangeFilter.from}-01`
  const toMonth = rangeFilter.to || rangeFilter.from
  const [toYear, toMon] = toMonth.split("-").map(Number)
  const lastDay = new Date(toYear, toMon, 0).getDate()
  const toDate = `${toMonth}-${String(lastDay).padStart(2, "0")}`
  return { from: fromDate, to: toDate }
}

// Helper Functions
const fetchAllAttendanceData = async (employeeId, rangeFilter = null) => {
  try {
    const Base_URL = import.meta.env.VITE_APP_API_BASE_URL
    const params = new URLSearchParams({
      page: "1",
      limit: EXCEL_LIMIT.toString(),
    })

    const apiRange = monthRangeToApiRange(rangeFilter)
    if (apiRange) {
      params.append("range", JSON.stringify(apiRange))
    }

    const url = `${Base_URL}/attendance/details/${employeeId}?${params.toString()}`
    console.log("Fetching data from:", url)

    const response = await axios.get(url)
    console.log("API Response:", response.data)

    if (!response.data.success) {
      throw new Error("Failed to fetch attendance data")
    }

    return response.data.data
  } catch (error) {
    console.error("Error fetching attendance data:", error)
    throw error
  }
}

const mapDailySummaryRow = (record, staffTz) => {
  const { inValue, outValue } = getAttendanceInOutDisplay(record, staffTz)
  const { checkInIp, checkOutIp } = getAttendanceIpDisplay(record)
  return [
    record.formattedDate || formatDate(record.date),
    record.status || "Absent",
    inValue,
    outValue,
    checkInIp,
    checkOutIp,
    record.formattedTotalHours || "0:00",
    record.lateIn || "00:00",
    record.earlyOut || "00:00",
    record.overTime || "00:00",
  ]
}

const DAILY_SUMMARY_HEADERS = [
  "Date",
  "Status",
  "First In",
  "Last Out",
  "Check-in IP",
  "Check-out IP",
  "Total Hrs",
  "Late",
  "Early",
  "OT",
]

// Excel Export Function - Matching PDF Fields Exactly
const downloadExcel = async (employeeId, _month, _year, rangeFilter = null) => {
  try {
    console.log("Starting Excel export for:", { employeeId, rangeFilter });

    const attendanceData = await fetchAllAttendanceData(employeeId, rangeFilter);
    console.log("Fetched attendance data:", attendanceData);

    const { staff, month: monthYear, stats, records, staffTimezone } =
      attendanceData;

    if (!staff) throw new Error("Staff information not found");
    const staffTz = staffTimezone || resolveStaffTimezone(staff.shift);
    if (!records || records.length === 0) console.warn("No attendance records found");

    const workbook = XLSX.utils.book_new();

    // 1. Employee Info Sheet
    const employeeInfo = [
      ["ATTENDANCE REPORT"],
      [""],
      ["Employee Information"],
      ["Employee", staff.displayName || staff.fullName || "N/A"],
      ["Position", staff.position?.name || "N/A"],
      ["Department", staff.department?.name || "N/A"],
      ["Month", monthYear || "N/A"],
      ["Timezone", staffTz],
      ["Generated on", formatDate(new Date())],
    ];
    const infoSheet = XLSX.utils.aoa_to_sheet(employeeInfo);
    infoSheet["!cols"] = [{ wch: 20 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(workbook, infoSheet, "Employee Info");

    // 2. Monthly Statistics Sheet
    if (stats) {
      const statisticsData = [
        ["MONTHLY STATISTICS"],
        [""],
        ["Metric", "Value", "Metric", "Value"],
        ["Total Days", stats.monthTotalDays || "0", "Total Hours", stats.monthTotalHours || "0:00"],
        ["Regular %", stats.regular || "0%", "Punctual %", stats.punctual || "0%"],
        ["Daily Avg", stats.dailyAverageHours || "0:00", "Longest Day", stats.longestDayHours || "0:00"],
        ["Expected Daily", stats.expectedDailyHours || "0:00", "Holidays", stats.publicHolidays || "0"],
      ];
      const statsSheet = XLSX.utils.aoa_to_sheet(statisticsData);
      statsSheet["!cols"] = [{ wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(workbook, statsSheet, "Monthly Statistics");
    }

    // 3. Daily Attendance Summary Sheet
    let dailySummaryData = [];
    if (records && records.length > 0) {
      dailySummaryData = records.map((record) =>
        mapDailySummaryRow(record, staffTz)
      );
      const dailyData = [
        ["DAILY ATTENDANCE SUMMARY"],
        [""],
        DAILY_SUMMARY_HEADERS,
        ...dailySummaryData,
      ];
      const dailySheet = XLSX.utils.aoa_to_sheet(dailyData);
      dailySheet["!cols"] = [
        { wch: 12 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 },
        { wch: 18 },
        { wch: 18 },
        { wch: 10 },
        { wch: 8 },
        { wch: 8 },
        { wch: 8 },
      ];
      XLSX.utils.book_append_sheet(workbook, dailySheet, "Daily Attendance Summary");
    }

    // 4. Complete Summary
    const summaryReport = [
      ["ATTENDANCE REPORT SUMMARY"],
      [""],
      ["Employee Information"],
      ["Employee", staff.displayName || staff.fullName || "N/A"],
      ["Position", `${staff.position?.name || "N/A"} | ${staff.department?.name || "N/A"}`],
      ["Month", monthYear || "N/A"],
      ["Generated on", formatDate(new Date())],
      [""],
      ["Report Contents"],
      ["Total Records", records ? records.length : 0],
      ["Working Days", records?.filter((r) => r.status === "Present").length || 0],
      ["Absent Days", records?.filter((r) => r.status === "Absent").length || 0],
      ["Late Days", records?.filter((r) => r.lateIn && r.lateIn !== "00:00").length || 0],
      [""],
      ["Monthly Statistics Summary"],
      ["Total Days", stats?.monthTotalDays || "0"],
      ["Total Hours", stats?.monthTotalHours || "0:00"],
      ["Regular %", stats?.regular || "0%"],
      ["Punctual %", stats?.punctual || "0%"],
      ["Daily Average Hours", stats?.dailyAverageHours || "0:00"],
      ["Longest Day Hours", stats?.longestDayHours || "0:00"],
      ["Expected Daily Hours", stats?.expectedDailyHours || "0:00"],
      ["Public Holidays", stats?.publicHolidays || "0"],
      [""],
      ["Sheets in this Workbook"],
      ["1. Employee Info", "Basic employee information"],
      ["2. Monthly Statistics", "Statistical analysis (same as PDF)"],
      ["3. Daily Attendance Summary", "Day-wise summary with first/last check-in IPs"],
      ["4. Complete Summary", "This overview sheet"],
      [""],
      ["Daily Attendance Summary"],
      DAILY_SUMMARY_HEADERS,
      ...dailySummaryData,
    ];

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryReport);
    summarySheet["!cols"] = [{ wch: 25 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Complete Summary");

    // Make summary the first sheet
    const sheetNames = workbook.SheetNames;
    const summaryIndex = sheetNames.indexOf("Complete Summary");
    if (summaryIndex > 0) {
      sheetNames.splice(summaryIndex, 1);
      sheetNames.unshift("Complete Summary");
      workbook.SheetNames = sheetNames;
    }

    // Save file
    const employeeName = (staff.displayName || staff.fullName || "Employee").replace(/[^a-zA-Z0-9]/g, "_");
    const monthName = (monthYear || "Report").replace(/[^a-zA-Z0-9]/g, "_");
    const fileName = `Attendance_${employeeName}_${monthName}.xlsx`;

    XLSX.writeFile(workbook, fileName);

    console.log("Excel file generated successfully:", fileName);
    console.log("Sheets created:", workbook.SheetNames);
  } catch (error) {
    console.error("Error generating Excel:", error);
    alert(`Error generating Excel file: ${error.message}\n\nPlease check the console for more details.`);
  }
};

// PDF Helper Functions (keeping the same as before)
const addCenteredText = (doc, text, y, fontSize = 12) => {
  doc.setFontSize(fontSize)
  const textWidth = doc.getTextWidth(text)
  const x = (PDF_PAGE_WIDTH - textWidth) / 2
  doc.text(text, x, y)
  return y + fontSize * 0.6 + 2
}

const addEmployeeInfoLine = (doc, staff, monthYear, y, staffTz) => {
  doc.setFontSize(10)

  const employeeName = staff.displayName || staff.fullName || "N/A"
  const position = staff.position?.name || "N/A"
  const department = staff.department?.name || "N/A"
  const month = monthYear || "N/A"
  const timezone = staffTz || "N/A"
  const generatedDate = formatDate(new Date())

  const infoLine = `Employee: ${employeeName} | Position: ${position} | Department: ${department} | Month: ${month} | Timezone: ${timezone} | Generated on: ${generatedDate}`

  const textWidth = doc.getTextWidth(infoLine)
  const maxWidth = PDF_PAGE_WIDTH - PDF_MARGIN * 2

  if (textWidth <= maxWidth) {
    const x = (PDF_PAGE_WIDTH - textWidth) / 2
    doc.text(infoLine, x, y)
    return y + 15
  } else {
    const line1 = `Employee: ${employeeName} | Position: ${position} | Department: ${department}`
    const line2 = `Month: ${month} | Timezone: ${timezone} | Generated on: ${generatedDate}`

    const x1 = (PDF_PAGE_WIDTH - doc.getTextWidth(line1)) / 2
    const x2 = (PDF_PAGE_WIDTH - doc.getTextWidth(line2)) / 2

    doc.text(line1, x1, y)
    doc.text(line2, x2, y + 12)
    return y + 25
  }
}

const addProfessionalTable = (doc, startY, title, headers, rows, columnWidths) => {
  doc.setFontSize(14)
  doc.setFont(undefined, "bold")
  const currentY = addCenteredText(doc, title, startY, 14)
  doc.setFont(undefined, "normal")

  const tableWidth = columnWidths.reduce((sum, width) => sum + width, 0)
  const startX = Math.max(PDF_MARGIN, (PDF_PAGE_WIDTH - tableWidth) / 2)

  autoTable(doc, {
    startY: currentY,
    head: [headers],
    body: rows,
    ...PDF_STYLES.table,
    margin: { left: startX, right: PDF_MARGIN },
    columnStyles: columnWidths.reduce((styles, width, index) => {
      styles[index] = {
        cellWidth: width,
        halign: "center",
        valign: "middle",
      }
      return styles
    }, {}),
    didDrawPage: (data) => {
      doc.setFontSize(8)
      doc.text(`Page ${data.pageNumber}`, PDF_PAGE_WIDTH - 20, doc.internal.pageSize.height - 10)
    },
  })

  return doc.lastAutoTable.finalY
}

// PDF Export Function (keeping the same as before)
const downloadPDF = async (employeeId, _month, _year, rangeFilter = null) => {
  try {
    const attendanceData = await fetchAllAttendanceData(employeeId, rangeFilter)
    const { staff, month: monthYear, stats, records, staffTimezone } =
      attendanceData
    const staffTz = staffTimezone || resolveStaffTimezone(staff?.shift)

    const doc = new jsPDF("landscape")

    doc.setFillColor(...PDF_HEADER_FILL)
    doc.rect(0, 0, PDF_PAGE_WIDTH, 25, "F")

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(18)
    doc.setFont(undefined, "bold")
    let currentY = addCenteredText(doc, "ATTENDANCE REPORT", 15, 18)

    doc.setTextColor(0, 0, 0)
    doc.setFont(undefined, "normal")

    currentY = addEmployeeInfoLine(doc, staff, monthYear, currentY + 10, staffTz)

    const statsData = [
      ["Total Days", "Total Hours", "Regular %", "Punctual %"],
      [stats.monthTotalDays || "0", stats.monthTotalHours || "0:00", stats.regular || "0%", stats.punctual || "0%"],
      ["Daily Avg", "Longest Day", "Expected Daily", "Holidays"],
      [
        stats.dailyAverageHours || "0:00",
        stats.longestDayHours || "0:00",
        stats.expectedDailyHours || "0:00",
        stats.publicHolidays || "0",
      ],
    ]

    currentY = addProfessionalTable(
      doc,
      currentY,
      "MONTHLY STATISTICS",
      statsData[0],
      [statsData[1]],
      [40, 40, 40, 40],
    )
    // currentY += 15
    
    currentY = addProfessionalTable(
      doc,
      currentY,
      "",
      statsData[2],
      [statsData[3]],
      [40, 40, 40, 40],
    )
    currentY += 15

    const summaryRows = (records || []).map((record) =>
      mapDailySummaryRow(record, staffTz)
    )

    currentY = addProfessionalTable(
      doc,
      currentY,
      "DAILY ATTENDANCE SUMMARY",
      DAILY_SUMMARY_HEADERS,
      summaryRows,
      [24, 20, 20, 20, 28, 28, 22, 18, 18, 18],
    )

    const employeeName = (staff.displayName || staff.fullName || "Employee").replace(/[^a-zA-Z0-9]/g, "_")
    const monthName = (monthYear || "Report").replace(/[^a-zA-Z0-9]/g, "_")
    const fileName = `Attendance_${employeeName}_${monthName}.pdf`

    doc.save(fileName)
    console.log("PDF file generated successfully:", fileName)
  } catch (error) {
    console.error("Error generating PDF:", error)
    alert(`Error generating PDF file: ${error.message}. Please try again.`)
  }
}

export { downloadExcel, downloadPDF }
