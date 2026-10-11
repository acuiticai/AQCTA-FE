import React from "react";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/page-layouts/index";
import { Umbrella, Calendar } from "lucide-react";
import { useHistory } from "react-router-dom";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import autoTable from "jspdf-autotable";
import csv from "../../../assets/img/icons/csv.png";
import pdf from "../../../assets/img/icons/pdf.png";
import axios from "axios";
import { formatDate } from "@/components/formatAmount";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
import { Tooltip } from "@/page-layouts/components/Tooltip";
import {
  HR_HEADER_BTN_EXCEL,
  HR_HEADER_BTN_OUTLINE,
  HR_HEADER_BTN_PDF,
  HR_HEADER_BTN_PRIMARY,
} from "./hrPageHeaderStyles";
import { getPublicAppUrl } from "@/utils/publicAppUrl";

const LeaveRequestsHeader = ({ searchParams, isStaff = false }) => {
  const { t } = useTranslation();
  const history = useHistory();

  const fetchAllLeaves = async () => {
    try {
      const params = {
        limit: 99999,
        ...searchParams,
      };
      // Remove empty startDate/endDate
      if (!params.startDate) delete params.startDate;
      if (!params.endDate) delete params.endDate;

      const response = await axios.get(`${Base_URL}/leaves/role-base`, {
        params,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${
            JSON.parse(localStorage.getItem("adminInfo")).token
          }`,
        },
      });
      return response.data || [];
    } catch (error) {
      console.error("Error fetching leave records:", error);
      return [];
    }
  };

  const downloadExcel = async () => {
    const allLeaves = await fetchAllLeaves();
    // console.log("All Leaves: ", allLeaves)
    const baseUrl = getPublicAppUrl();
    const exportData = allLeaves.data.map((leave) => {
      return {
        "Employee Name": {
          t: "s",
          v: leave.employee?.displayName || "",
          l: { Target: `${baseUrl}/staff/${leave.employee?._id}` },
        },
        "Leave Type": leave.leaveType?.name || "-",
        "Start Date": leave.startDate ? formatDate(leave.startDate) : "-",
        "End Date": leave.endDate ? formatDate(leave.endDate) : "-",
        "Supporting Documents": leave.supportingDocuments?.name || "-",
        Status: leave.status || "No Record",
        Remarks: leave.remarks || "-",
      };
    });

    const generatedOnRow = {
      "Employee Name": `Generated on: ${formatDate(new Date())}`,
    };

    const totalCountRow = {
      "Employee Name": `Total Leave Records: ${allLeaves.data.length}`,
    };

    const worksheet = XLSX.utils.json_to_sheet([]);

    // Add header rows
    XLSX.utils.sheet_add_json(worksheet, [generatedOnRow, totalCountRow], {
      skipHeader: true,
      origin: "A1",
    });

    // Add data rows
    XLSX.utils.sheet_add_json(worksheet, exportData, {
      skipHeader: false,
      origin: "A4", // Leaves space for 2 header rows + header row of data
    });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Leave Records");
    XLSX.writeFile(workbook, "Leave_Records.xlsx");
  };

  const downloadPDF = async () => {
    try {
      const response = await fetchAllLeaves();
      const allLeaves = response.data;
      const doc = new jsPDF();

      doc.setFontSize(16);
      doc.text("Leave Records Report", 14, 15);
      doc.setFontSize(10);
      doc.text(`Generated on: ${formatDate(new Date())}`, 14, 22);
      doc.setFontSize(12);
      doc.text(`Total Leave Records: ${allLeaves.length}`, 14, 30);

      const headers = [
        "Employee",
        "Leave Type",
        "Start Date",
        "End Date",
        "Status",
        "Remarks",
      ];
      const rows = allLeaves.map((leave) => {
        return [
          leave.employee?.displayName || "",
          leave.leaveType?.name || "-",
          leave.startDate ? formatDate(leave.startDate) : "-",
          leave.endDate ? formatDate(leave.endDate) : "-",
          leave.status || "No Record",
          leave.remarks || "-",
        ];
      });

      autoTable(doc, {
        startY: 40,
        head: [headers],
        body: rows,
        theme: "grid",
        styles: { fontSize: 8 },
        headStyles: { fillColor: [173, 208, 57] },
      });

      doc.save("Leave_Records.pdf");
    } catch (err) {
      console.error("Error generating PDF:", err);
    }
  };

  return (
    <PageHeader
      variant="large"
      title={t("leaveManagement.title")}
      description={t("leaveManagement.pageDescription")}
      showBackButton={isStaff}
      backFallbackPath="/staff-leave-management"
      showAddButton={false}
      renderActions={[
        ...(!isStaff
          ? [
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
                {t("leaveManagement.downloadExcel")}
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
                {t("leaveManagement.downloadPDF")}
              </button>,
            ]
          : []),
        ...(isStaff
          ? [
              <Tooltip
                key="balance"
                tooltipContent="My Leave Balance"
                placement="top"
              >
                <button
                  type="button"
                  className={HR_HEADER_BTN_OUTLINE}
                  onClick={() => history.push("/my-leave-balance")}
                >
                  <Calendar className="w-4 h-4" />
                </button>
              </Tooltip>,
            ]
          : []),
        <button
          key="add"
          type="button"
          className={HR_HEADER_BTN_PRIMARY}
          onClick={() =>
            history.push(
              !isStaff ? "/apply-leave-on-behalf" : "/staff-apply-leave"
            )
          }
        >
          <Umbrella className="w-4 h-4" />
          {!isStaff
            ? t("leaveManagement.applyLeaveOnBehalf")
            : t("leaveManagement.applyLeave")}
        </button>,
      ]}
    />
  );
};

export default LeaveRequestsHeader;
