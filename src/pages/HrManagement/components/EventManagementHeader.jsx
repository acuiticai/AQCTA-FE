import React from "react";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/page-layouts/index";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import csv from "../../../assets/img/icons/csv.png";
import pdf from "../../../assets/img/icons/pdf.png";
import userIcon from "../../../assets/img/icons/profile-add.png";
import { CalendarPlus } from "lucide-react";
import { usePermissions } from "@/utils/permissionUtils";
import { HR_HEADER_BTN_PRIMARY } from "./hrPageHeaderStyles";

const EventManagementHeader = ({ isStaff = false }) => {
  const { t } = useTranslation();
  const { hasPermission } = usePermissions();

  const fetchAllWFHRequests = async () => {
    const res = await fetch("/api/wfh?limit=99999", { credentials: "include" });
    const data = await res.json();
    return data?.data || [];
  };

  // const downloadExcel = async () => {
  //     const allWFHs = await fetchAllWFHRequests();
  //     const baseUrl = window.location.origin;

  //     const exportData = allWFHs.map((req) => ({
  //         "Employee Name": {
  //             t: "s",
  //             v: req.employee?.displayName || "",
  //             l: { Target: `${baseUrl}/staff/${req.employee?._id}` },
  //         },
  //         "Employee ID": req.employee?.employeeId || "",
  //         "WFH Start Date": req.date_from ? format(new Date(req.date_from), "dd-MM-yyyy") : "",
  //         "WFH End Date": req.date_to ? format(new Date(req.date_to), "dd-MM-yyyy") : "",
  //         "Reason": req.reason || "",
  //         "Status": req.status || "",
  //         // "Created At": format(new Date(req.createdAt), "dd-MM-yyyy"),
  //     }));

  //     const generatedOnRow = {
  //         "Employee Name": `Generated on: ${format(new Date(), "dd-MM-yyyy HH:mm")}`,
  //     };

  //     const totalCountRow = {
  //         "Employee Name": `Total WFH Requests: ${allWFHs.length}`,
  //     };

  //     const worksheet = XLSX.utils.json_to_sheet([]);

  //     // Add header rows
  //     XLSX.utils.sheet_add_json(worksheet, [generatedOnRow, totalCountRow], {
  //         skipHeader: true,
  //         origin: "A1",
  //     });

  //     // Add data rows
  //     XLSX.utils.sheet_add_json(worksheet, exportData, {
  //         skipHeader: false,
  //         origin: "A4", // Leaves space for 2 header rows + header row of data
  //     });

  //     const workbook = XLSX.utils.book_new();
  //     XLSX.utils.book_append_sheet(workbook, worksheet, "WFH Requests");
  //     XLSX.writeFile(workbook, "WFH_Requests.xlsx");
  // };

  const downloadPDF = async () => {
    try {
      const allWFHs = await fetchAllWFHRequests();
      const doc = new jsPDF();

      doc.setFontSize(16);
      doc.text("WFH Requests Report", 14, 15);
      doc.setFontSize(10);
      doc.text(
        `Generated on: ${format(new Date(), "dd-MM-yyyy HH:mm")}`,
        14,
        22
      );
      doc.setFontSize(12);
      doc.text(`Total WFH Requests: ${allWFHs.length}`, 14, 30);

      const headers = [
        "Employee",
        "Emp ID",
        "Start Date",
        "End Date",
        "Reason",
        "Status",
      ];
      const rows = allWFHs.map((req) => [
        req.employee?.displayName || "",
        req.employee?.employeeId || "",
        req.date_from ? format(new Date(req.date_from), "dd-MM-yyyy") : "",
        req.date_to ? format(new Date(req.date_to), "dd-MM-yyyy") : "",
        req.reason || "",
        req.status || "",
      ]);

      autoTable(doc, {
        startY: 40,
        head: [headers],
        body: rows,
        theme: "grid",
        styles: { fontSize: 8 },
        headStyles: { fillColor: [173, 208, 57] },
      });

      doc.save("WFH_Requests.pdf");
    } catch (err) {
      console.error("Error generating PDF:", err);
    }
  };

  return (
    <PageHeader
      variant="large"
      title={t("eventManagement.title")}
      description={t("eventManagement.pageDescription")}
      showBackButton={isStaff}
      backFallbackPath="/staff-event-management"
      showAddButton={false}
      renderActions={
        !isStaff && hasPermission("Add")
          ? [
              <Link
                key="add"
                to="/add-event"
                className={HR_HEADER_BTN_PRIMARY}
              >
                <CalendarPlus className="w-4 h-4" />
                {t("eventManagement.addNew")}
              </Link>,
            ]
          : null
      }
    />
  );
};

export default EventManagementHeader;
