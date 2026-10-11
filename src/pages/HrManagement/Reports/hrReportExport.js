import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import axios from "axios";
import { formatDate } from "@/components/formatAmount";
import {
  getAttendanceInOutDisplay,
  getAttendanceIpDisplay,
  staffDeptPositionShift,
} from "./hrReportHelpers";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

export const HR_REPORT_EXPORT_LIMIT = 99999;

/** PDF table header background — brand orange #0C2E5A */
const PDF_HEADER_FILL = [242, 144, 16];

let assignedBusinessesCache = null;
let assignedBusinessesAdminId = null;

export const formatGeneratedAt = (date = new Date()) =>
  date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export async function resolveBusinessLabel(businessId, adminId) {
  if (!businessId) return "All";
  if (
    adminId &&
    (assignedBusinessesAdminId !== adminId || !assignedBusinessesCache)
  ) {
    try {
      const res = await axios.get(`${Base_URL}/admin/assigned/${adminId}`);
      assignedBusinessesCache = res.data.businesses || [];
      assignedBusinessesAdminId = adminId;
    } catch {
      assignedBusinessesCache = [];
    }
  }
  const match = assignedBusinessesCache?.find((b) => b._id === businessId);
  return match?.name || businessId;
}

const buildMetaAoA = (reportTitle, businessLabel, filterRows = []) => {
  const rows = [[reportTitle.toUpperCase()], [], ["Generated at", formatGeneratedAt()]];
  if (businessLabel) {
    rows.push(["Business", businessLabel]);
  }
  filterRows.forEach(([label, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      rows.push([label, String(value)]);
    }
  });
  return rows;
};

const downloadExcel = (fileBaseName, metaRows, headers, dataRows) => {
  // Single sheet: metadata on top, then table (matches PDF layout; avoids hidden 2nd tab)
  const sheetAoA = [...metaRows, [], headers, ...dataRows];
  const sheet = XLSX.utils.aoa_to_sheet(sheetAoA);

  const colCount = Math.max(
    2,
    headers.length,
    ...sheetAoA.map((row) => (Array.isArray(row) ? row.length : 0))
  );
  const colWidths = Array.from({ length: colCount }, (_, i) => {
    const lengths = sheetAoA.map((row) =>
      Array.isArray(row) ? String(row[i] ?? "").length : 0
    );
    const maxLen = lengths.length ? Math.max(...lengths) : 10;
    return { wch: Math.min(40, maxLen + 2) };
  });
  sheet["!cols"] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Report");
  XLSX.writeFile(workbook, `${fileBaseName}.xlsx`);
};

const downloadPdf = (
  fileBaseName,
  reportTitle,
  metaRows,
  headers,
  dataRows,
  orientation = "landscape"
) => {
  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
  let y = 14;
  doc.setFontSize(16);
  doc.setFont(undefined, "bold");
  doc.text(reportTitle, 14, y);
  y += 8;
  doc.setFontSize(9);
  doc.setFont(undefined, "normal");
  metaRows.slice(2).forEach((row) => {
    if (!row.length) {
      y += 3;
      return;
    }
    const line =
      row.length >= 2 ? `${row[0]}: ${row[1]}` : String(row[0] || "");
    doc.text(line, 14, y);
    y += 5;
  });
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [headers],
    body: dataRows,
    theme: "striped",
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: {
      fillColor: PDF_HEADER_FILL,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { left: 14, right: 14 },
  });

  doc.save(`${fileBaseName}.pdf`);
};

export async function runHrReportExport({
  format,
  url,
  params = {},
  extractRows,
  headers,
  mapRecord,
  reportTitle,
  fileBaseName,
  filterRows = [],
  adminId,
  selectedBusiness,
  orientation = "landscape",
}) {
  const businessLabel = await resolveBusinessLabel(selectedBusiness, adminId);
  const exportParams = { ...params, page: 1, limit: HR_REPORT_EXPORT_LIMIT };

  const res = await axios.get(url, { params: exportParams });
  const records = extractRows(res.data) || [];
  const dataRows = records.map(mapRecord);
  const metaRows = buildMetaAoA(reportTitle, businessLabel, filterRows);

  if (format === "excel") {
    downloadExcel(fileBaseName, metaRows, headers, dataRows);
  } else if (format === "pdf") {
    downloadPdf(fileBaseName, reportTitle, metaRows, headers, dataRows, orientation);
  } else {
    throw new Error("Invalid export format");
  }

  return records.length;
}

const dateRangeLabel = (start, end, toLabel = "to") => {
  if (start && end) return `${formatDate(start)} ${toLabel} ${formatDate(end)}`;
  if (start) return formatDate(start);
  if (end) return formatDate(end);
  return "";
};

const commonFilterRows = (t, searchParams, extra = []) => {
  const rows = [
    [t("hrReports.common.searchByNameIc"), searchParams.name],
    [t("hrReports.common.searchByDepartment"), searchParams.department],
    [t("hrReports.common.searchByPosition"), searchParams.position],
    [
      "Date range",
      dateRangeLabel(searchParams.startDate, searchParams.endDate, t("hrReports.common.to")),
    ],
  ];
  if (searchParams.shift) {
    rows.push([t("hrReports.common.shift"), searchParams.shift]);
  }
  if (searchParams.status) {
    rows.push([t("hrReports.common.status"), searchParams.status]);
  }
  return [...rows, ...extra];
};

export async function exportAttendanceReport(opts) {
  const { format, searchParams, selectedBusiness, adminId, t } = opts;
  const headers = [
    t("hrReports.common.name"),
    t("hrReports.common.department"),
    t("hrReports.common.position"),
    t("hrReports.common.shift"),
    t("hrReports.common.date"),
    t("hrReports.common.in"),
    t("hrReports.common.out"),
    t("hrReports.common.checkInIp"),
    t("hrReports.common.checkOutIp"),
    t("hrReports.common.totalHours"),
    t("hrReports.common.overtime"),
    t("hrReports.common.status"),
  ];

  return runHrReportExport({
    format,
    url: `${Base_URL}/attendance/report`,
    params: {
      name: searchParams.name,
      department: searchParams.department,
      position: searchParams.position,
      startDate: searchParams.startDate,
      endDate: searchParams.endDate,
      status: searchParams.status,
      business: selectedBusiness,
    },
    extractRows: (data) => data.data,
    headers,
    mapRecord: (rec) => {
      const { department, position, shift } = staffDeptPositionShift(rec.staff);
      const { inValue, outValue } = getAttendanceInOutDisplay(rec);
      const { checkInIp, checkOutIp } = getAttendanceIpDisplay(rec);
      return [
        rec.staff?.displayName || "-",
        department,
        position,
        shift,
        rec.date ? formatDate(rec.date) : "-",
        inValue,
        outValue,
        checkInIp,
        checkOutIp,
        rec.totalHours || "-",
        rec.overTime || "-",
        rec.status || t("hrReports.common.noRecord"),
      ];
    },
    reportTitle: t("hrReports.attendanceReport.title"),
    fileBaseName: "attendance-report",
    filterRows: commonFilterRows(t, searchParams),
    adminId,
    selectedBusiness,
  });
}

export async function exportAttendancePercentageReport(opts) {
  const { format, searchParams, selectedBusiness, adminId, t } = opts;
  const headers = [
    t("hrReports.common.name"),
    t("hrReports.common.department"),
    t("hrReports.common.position"),
    t("hrReports.common.shift"),
    t("hrReports.common.daysWorked"),
    t("hrReports.common.absentees"),
    t("hrReports.common.totalPercentage"),
  ];

  return runHrReportExport({
    format,
    url: `${Base_URL}/attendance/percentage-report`,
    params: {
      name: searchParams.name,
      department: searchParams.department,
      position: searchParams.position,
      startDate: searchParams.startDate,
      endDate: searchParams.endDate,
      shift: searchParams.shift,
      business: selectedBusiness,
    },
    extractRows: (data) => data.data,
    headers,
    mapRecord: (rec) => [
      rec.name || "-",
      rec.department || "-",
      rec.position || "-",
      rec.shift || "-",
      rec.daysWorked ? `${rec.daysWorked} day(s)` : "-",
      rec.absentees ? `${rec.absentees} day(s)` : "-",
      rec.totalPercentage ? `${rec.totalPercentage}%` : "-",
    ],
    reportTitle: t("hrReports.attendancePercentageReport.title"),
    fileBaseName: "attendance-percentage-report",
    filterRows: commonFilterRows(t, searchParams),
    adminId,
    selectedBusiness,
  });
}

export async function exportLatenessReport(opts) {
  const { format, searchParams, selectedBusiness, adminId, t } = opts;
  const headers = [
    t("hrReports.common.name"),
    t("hrReports.common.department"),
    t("hrReports.common.position"),
    t("hrReports.common.shift"),
    t("hrReports.common.date"),
    t("hrReports.common.in"),
    t("hrReports.common.status"),
    t("hrReports.common.lateBy"),
  ];

  return runHrReportExport({
    format,
    url: `${Base_URL}/attendance/report`,
    params: {
      name: searchParams.name,
      department: searchParams.department,
      position: searchParams.position,
      startDate: searchParams.startDate,
      endDate: searchParams.endDate,
      shift: searchParams.shift,
      business: selectedBusiness,
    },
    extractRows: (data) => data.data,
    headers,
    mapRecord: (rec) => {
      const { department, position, shift } = staffDeptPositionShift(rec.staff);
      const skipIn = ["Absent", "Leave", "Public Holiday", "Weekly Off"].includes(
        rec.status
      );
      const inValue = skipIn
        ? "-"
        : rec.firstCheckIn?.timestamp
          ? new Date(rec.firstCheckIn.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "-";
      const isPresent = rec.status === "Present";
      const lateByValue =
        rec.lateIn && rec.lateIn !== "00:00" ? rec.lateIn : null;
      const lateCol = !isPresent
        ? t("hrReports.common.na")
        : lateByValue
          ? lateByValue
          : t("hrReports.common.onTime");

      return [
        rec.staff?.displayName || "-",
        department,
        position,
        shift,
        rec.date ? formatDate(rec.date) : "-",
        inValue,
        rec.status || t("hrReports.common.noRecord"),
        lateCol,
      ];
    },
    reportTitle: t("hrReports.latenessReport.title"),
    fileBaseName: "lateness-report",
    filterRows: commonFilterRows(t, searchParams),
    adminId,
    selectedBusiness,
  });
}

export async function exportWorkingHoursReport(opts) {
  const { format, searchParams, selectedBusiness, adminId, t } = opts;
  const headers = [
    t("hrReports.common.name"),
    t("hrReports.common.department"),
    t("hrReports.common.position"),
    t("hrReports.common.shift"),
    t("hrReports.common.hoursWorked"),
    t("hrReports.common.actualHours"),
  ];

  return runHrReportExport({
    format,
    url: `${Base_URL}/attendance/working-hours-report`,
    params: {
      name: searchParams.name,
      department: searchParams.department,
      position: searchParams.position,
      startDate: searchParams.startDate,
      endDate: searchParams.endDate,
      shift: searchParams.shift,
      business: selectedBusiness,
    },
    extractRows: (data) => data.data,
    headers,
    mapRecord: (rec) => [
      rec.name || "-",
      rec.department || "-",
      rec.position || "-",
      rec.shift || "-",
      rec.hoursWorked || "0:00",
      rec.actualHours || "0:00",
    ],
    reportTitle: t("hrReports.workingHoursReport.title"),
    fileBaseName: "working-hours-report",
    filterRows: commonFilterRows(t, searchParams),
    adminId,
    selectedBusiness,
  });
}

export async function exportOvertimeReport(opts) {
  const { format, searchParams, selectedBusiness, adminId, t } = opts;
  const headers = [
    t("hrReports.common.name"),
    t("hrReports.common.department"),
    t("hrReports.common.position"),
    t("hrReports.common.shift"),
    t("hrReports.common.date"),
    t("hrReports.common.in"),
    t("hrReports.common.out"),
    t("hrReports.common.overtime"),
  ];

  return runHrReportExport({
    format,
    url: `${Base_URL}/attendance/report`,
    params: {
      name: searchParams.name,
      department: searchParams.department,
      position: searchParams.position,
      startDate: searchParams.startDate,
      endDate: searchParams.endDate,
      shift: searchParams.shift,
      business: selectedBusiness,
    },
    extractRows: (data) => data.data,
    headers,
    mapRecord: (rec) => {
      const { department, position, shift } = staffDeptPositionShift(rec.staff);
      const inValue = rec.firstCheckIn?.timestamp
        ? formatDate(rec.firstCheckIn.timestamp)
        : "-";
      const outValue = rec.lastCheckOut?.timestamp
        ? formatDate(rec.lastCheckOut.timestamp)
        : "-";
      return [
        rec.staff?.displayName || "-",
        department,
        position,
        shift,
        rec.date ? formatDate(rec.date) : "-",
        inValue,
        outValue,
        rec.overTime || "-",
      ];
    },
    reportTitle: t("hrReports.overtimeReport.title"),
    fileBaseName: "overtime-report",
    filterRows: commonFilterRows(t, searchParams),
    adminId,
    selectedBusiness,
  });
}

export async function exportLeaveTakenReport(opts) {
  const { format, searchParams, selectedBusiness, adminId, t } = opts;
  const headers = [
    t("hrReports.common.name"),
    t("hrReports.common.department"),
    t("hrReports.common.position"),
    t("hrReports.common.date"),
    t("hrReports.common.leaveType"),
    t("hrReports.common.status"),
  ];

  return runHrReportExport({
    format,
    url: `${Base_URL}/leaves`,
    params: {
      name: searchParams.name,
      department: searchParams.department,
      position: searchParams.position,
      startDate: searchParams.startDate,
      endDate: searchParams.endDate,
      status: searchParams.status,
      business: selectedBusiness,
    },
    extractRows: (data) => data.leaves,
    headers,
    mapRecord: (rec) => [
      rec.employee?.displayName || "-",
      rec.employee?.department?.name || "-",
      rec.employee?.position?.name || "-",
      `${formatDate(rec.startDate)} ${t("hrReports.common.to")} ${formatDate(rec.endDate)}`,
      rec.leaveType?.name || "-",
      rec.status || t("hrReports.common.noRecord"),
    ],
    reportTitle: t("hrReports.leaveTakenReport.title"),
    fileBaseName: "leave-taken-report",
    filterRows: commonFilterRows(t, searchParams),
    adminId,
    selectedBusiness,
  });
}

export async function exportLeaveUtilizationReport(opts) {
  const {
    format,
    searchParams,
    selectedBusiness,
    adminId,
    t,
    leaveGroupLabel,
  } = opts;

  if (!selectedBusiness || !searchParams.leaveGroup) {
    throw new Error(t("hrReports.common.pleaseSelectBusinessAndLeaveGroup"));
  }

  const res = await axios.get(`${Base_URL}/leaves/utilization-report`, {
    params: {
      page: 1,
      limit: HR_REPORT_EXPORT_LIMIT,
      name: searchParams.name,
      department: searchParams.department,
      position: searchParams.position,
      leaveGroup: searchParams.leaveGroup,
      business: selectedBusiness,
    },
  });

  const records = res.data.data || [];
  const leaveTypes = res.data.leaveTypes || [];
  const headers = [
    t("hrReports.common.name"),
    t("hrReports.common.department"),
    t("hrReports.common.position"),
    ...leaveTypes.map((lt) => lt.name),
  ];
  const dataRows = records.map((rec) => [
    rec.name || "-",
    rec.department || "-",
    rec.position || "-",
    ...leaveTypes.map((lt) => rec[lt.name] || "0/0"),
  ]);

  const businessLabel = await resolveBusinessLabel(selectedBusiness, adminId);
  const filterRows = [
    [t("hrReports.common.leaveGroup"), leaveGroupLabel || searchParams.leaveGroup],
    [t("hrReports.common.searchByNameIc"), searchParams.name],
    [t("hrReports.common.searchByDepartment"), searchParams.department],
    [t("hrReports.common.searchByPosition"), searchParams.position],
  ];
  const metaRows = buildMetaAoA(
    t("hrReports.leaveUtilizationReport.title"),
    businessLabel,
    filterRows
  );

  if (format === "excel") {
    downloadExcel("leave-utilization-report", metaRows, headers, dataRows);
  } else {
    downloadPdf(
      "leave-utilization-report",
      t("hrReports.leaveUtilizationReport.title"),
      metaRows,
      headers,
      dataRows,
      "landscape"
    );
  }
  return records.length;
}

export async function exportWorkPassExpiryReport(opts) {
  const { format, searchParams, selectedBusiness, adminId, t } = opts;
  const headers = [
    t("hrReports.common.name"),
    t("hrReports.common.nationality"),
    t("hrReports.common.department"),
    t("hrReports.common.position"),
    t("hrReports.common.workPassType"),
    t("hrReports.common.visaExpiryDate"),
  ];

  const extra = searchParams.workPassType
    ? [[t("hrReports.common.workPassType"), searchParams.workPassType]]
    : [];

  return runHrReportExport({
    format,
    url: `${Base_URL}/attendance/work-pass-report`,
    params: {
      name: searchParams.name,
      department: searchParams.department,
      position: searchParams.position,
      workPassType: searchParams.workPassType,
      startDate: searchParams.startDate,
      endDate: searchParams.endDate,
      business: selectedBusiness,
    },
    extractRows: (data) => data.data,
    headers,
    mapRecord: (rec) => [
      rec.name || "-",
      rec.nationality || "-",
      rec.department || "-",
      rec.position || "-",
      rec.workPassType || "-",
      rec.visaExpiryDate ? formatDate(rec.visaExpiryDate) : "-",
    ],
    reportTitle: t("hrReports.workPassExpiryReport.title"),
    fileBaseName: "work-pass-expiry-report",
    filterRows: [...commonFilterRows(t, searchParams), ...extra],
    adminId,
    selectedBusiness,
  });
}

const buildEventParams = (searchParams, selectedBusiness) => {
  const params = {
    name: searchParams.name,
    department: searchParams.department,
    position: searchParams.position,
    departmentName: searchParams.departmentName,
    positionName: searchParams.positionName,
    startDate: searchParams.startDate,
    endDate: searchParams.endDate,
    eventName: searchParams.eventName,
    businessId: searchParams.business || selectedBusiness,
    year: searchParams.year,
  };
  Object.keys(params).forEach((key) => {
    if (!params[key]) delete params[key];
  });
  return params;
};

export async function exportEventPerformanceReport(opts) {
  const { format, activeTab, searchParams, selectedBusiness, adminId, t } = opts;

  if (activeTab === "staff") {
    const headers = [
      t("hrReports.common.staff"),
      t("hrReports.common.department"),
      t("hrReports.common.position"),
      t("hrAnalytics.business").replace(":", ""),
      t("hrReports.common.eventsAttended"),
      t("hrReports.common.pointsObtained"),
      t("hrReports.common.performancePercent"),
    ];

    return runHrReportExport({
      format,
      url: `${Base_URL}/event/event-performance-report`,
      params: buildEventParams(searchParams, selectedBusiness),
      extractRows: (data) => data.data,
      headers,
      mapRecord: (rec) => [
        rec.name ? `${rec.name}${rec.email ? ` (${rec.email})` : ""}` : "-",
        rec.department || "-",
        rec.position || "-",
        rec.business || "-",
        `${rec.eventsAttended || 0}/${rec.totalEvents || 0}`,
        `${rec.totalPointsObtained?.toFixed(1) || "0.0"}/${rec.totalPossiblePoints?.toFixed(1) || "0.0"}`,
        `${rec.performancePercentage?.toFixed(1) || "0.0"}%`,
      ],
      reportTitle: `${t("hrReports.eventPerformanceReport.title")} - ${t("hrReports.common.staffPerformance")}`,
      fileBaseName: "event-performance-staff",
      filterRows: [
        [t("hrReports.common.searchByNameEmail"), searchParams.name],
        [t("hrReports.common.searchByDepartment"), searchParams.department],
        [t("hrReports.common.searchByPosition"), searchParams.position],
        [t("hrReports.common.searchByEventName"), searchParams.eventName],
        [t("hrReports.common.filterByYear"), searchParams.year],
        [
          "Date range",
          dateRangeLabel(
            searchParams.startDate,
            searchParams.endDate,
            t("hrReports.common.to")
          ),
        ],
      ],
      adminId,
      selectedBusiness,
    });
  }

  const headers = [
    t("hrReports.common.eventName"),
    t("hrReports.common.date"),
    t("hrReports.common.location"),
    t("hrAnalytics.business").replace(":", ""),
    t("hrReports.common.status"),
    t("hrReports.common.attendance"),
    t("hrReports.common.weightage"),
  ];

  return runHrReportExport({
    format,
    url: `${Base_URL}/event/get-event-attendance-report`,
    params: buildEventParams(searchParams, selectedBusiness),
    extractRows: (data) => data.data,
    headers,
    mapRecord: (rec) => [
      rec.eventName || "-",
      rec.eventDate ? new Date(rec.eventDate).toLocaleDateString() : "-",
      rec.location || "-",
      rec.business || "-",
      rec.status || "-",
      `${rec.totalAttended || 0}/${rec.totalInvited || 0}`,
      `${rec.totalWeightage || 0}/100`,
    ],
    reportTitle: `${t("hrReports.eventPerformanceReport.title")} - ${t("hrReports.common.eventAttendance")}`,
    fileBaseName: "event-attendance",
    filterRows: [
      [t("hrReports.common.searchByEventName"), searchParams.eventName],
      [t("hrReports.common.filterByYear"), searchParams.year],
      [
        "Date range",
        dateRangeLabel(
          searchParams.startDate,
          searchParams.endDate,
          t("hrReports.common.to")
        ),
      ],
    ],
    adminId,
    selectedBusiness,
  });
}
