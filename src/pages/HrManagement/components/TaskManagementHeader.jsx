import React from "react";
import { BackButton, CustomDatePicker } from "@/page-layouts/index";
import { Search, RefreshCw } from "lucide-react";
import { InputField, DropdownBasic } from "@/page-layouts";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import csv from "../../../assets/img/icons/csv.png";
import pdf from "../../../assets/img/icons/pdf.png";
import userIcon from "../../../assets/img/icons/profile-add.png";
import { useLocation } from "react-router-dom";
import { ClipboardPlus } from "lucide-react";
import { User } from "lucide-react";
import { isSingleAssignedBusiness } from "@/utils/sessionAssignedBusinesses";
import { getPublicAppUrl } from "@/utils/publicAppUrl";

const EventManagementHeader = ({
  isStaff,
  setSearchParams,
  attendees,
  searchParams,
  handleSearch,
  // departments,
  // positions,
}) => {
  const Location = new URLSearchParams(useLocation().search);
  const eventId = Location.get("event");
  const eventName = Location.get("eventName");
  const business = Location.get("business");
  const showBusinessInTitle = Boolean(business) && !isSingleAssignedBusiness();

  const handleInputChange = (e) => {
    setSearchParams({
      ...searchParams,
      [e.target.name]: e.target.value,
    });
  };

  // const uniquePositionsByName = positions?.filter(
  //     (pos, index, self) =>
  //         index === self.findIndex(p => p.name === pos.name)
  // ) || [];

  const fetchAllWFHRequests = async () => {
    const res = await fetch("/api/wfh?limit=99999", { credentials: "include" });
    const data = await res.json();
    return data?.data || [];
  };

  const downloadExcel = async () => {
    const allWFHs = await fetchAllWFHRequests();
    const baseUrl = getPublicAppUrl();

    const exportData = allWFHs.map((req) => ({
      "Employee Name": {
        t: "s",
        v: req.employee?.displayName || "",
        l: { Target: `${baseUrl}/staff/${req.employee?._id}` },
      },
      "Employee ID": req.employee?.employeeId || "",
      "WFH Start Date": req.date_from
        ? format(new Date(req.date_from), "dd-MM-yyyy")
        : "",
      "WFH End Date": req.date_to
        ? format(new Date(req.date_to), "dd-MM-yyyy")
        : "",
      Reason: req.reason || "",
      Status: req.status || "",
      // "Created At": format(new Date(req.createdAt), "dd-MM-yyyy"),
    }));

    const generatedOnRow = {
      "Employee Name": `Generated on: ${format(
        new Date(),
        "dd-MM-yyyy HH:mm"
      )}`,
    };

    const totalCountRow = {
      "Employee Name": `Total WFH Requests: ${allWFHs.length}`,
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
    XLSX.utils.book_append_sheet(workbook, worksheet, "WFH Requests");
    XLSX.writeFile(workbook, "WFH_Requests.xlsx");
  };

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
    <div className="mb-4">
      {<BackButton />}
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold text-gray-800">
          {eventName}
          {showBusinessInTitle ? ` - ${business}` : ""}
        </h1>
        <div className="flex space-x-4">
          {/* <button
                        className="bg-[#17B26A] text-white px-4 py-3 rounded-xl flex items-center"
                        onClick={downloadExcel}
                    >
                        <img src={csv} alt="csv-icon" className="mr-2 w-6 h-6 object-contain" />
                        Download Excel
                    </button>
                    <button
                        className="bg-[#F04438] text-white px-4 py-3 rounded-xl flex items-center"
                        onClick={downloadPDF}
                    >
                        <img src={pdf} alt="pdf-icon" className="mr-2 w-6 h-6 object-contain" />
                        Download PDF
                    </button> */}
          {/* show attendees count */}
          {!isStaff && (
            <div className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium text-purple-600 bg-purple-50 border border-purple-200">
              <User className="w-4 h-4 mr-2" />
              {attendees.length} Attendees
            </div>
          )}
          {!isStaff && (
            <Link
              to={`/add-task?event=${eventId}&eventName=${eventName}`}
              className="bg-[var(--p-blue)] text-white px-4 py-2 rounded-xl flex items-center gap-2"
            >
              <ClipboardPlus className="w-5 h-5" />
              Add Task
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* <div className="relative">
                    <InputField
                        type="text"
                        name="taskName"
                        value={searchParams.taskName || ""}
                        placeholder="Search By Name, IC"
                        className="pl-10"
                        onChange={handleInputChange}
                    />
                    <svg
                        className="w-5 h-5 absolute left-[0.8rem] top-[0.675rem] text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        ></path>
                    </svg>
                </div> */}

        {/* <DropdownBasic
                    placeholder="Search By Department"
                    name="departmentName"
                    value={searchParams.departmentName || ""}
                    onChange={(val) => handleInputChange({ target: { name: "departmentName", value: val } })}
                    options={[
                        { value: "", label: "Search By Department" },
                        ...(departments?.filter(
                            (dept, index, self) =>
                                index === self.findIndex((d) => d.name === dept.name)
                        ).map((dept) => ({
                            value: dept.name,
                            label: dept.name,
                        })) || []),
                    ]}
                /> */}

        {/* <DropdownBasic
                    placeholder="Search By Position"
                    name="positionName"
                    value={searchParams.positionName || ""}
                    onChange={(val) => handleInputChange({ target: { name: "positionName", value: val } })}
                    options={[
                        { value: "", label: "Search By Position" },
                        ...uniquePositionsByName.map(pos => ({
                            value: pos.name,
                            label: pos.name,
                        }))
                    ]}
                /> */}

        {/* <DropdownBasic
                    placeholder="Search By Status"
                    name="status"
                    value={searchParams.status || ""}
                    onChange={(val) => handleInputChange({ target: { name: "status", value: val } })}
                    options={[
                        { value: "", label: "Search By Status" },
                        { value: "Applied", label: "Applied" },
                        { value: "Approved", label: "Approved" },
                        { value: "Rejected", label: "Rejected" },
                    ]}
                />*/}

        {/* <CustomDatePicker
                        name="date"
                        value={searchParams.date || ""}
                        className="w-full rounded-xl bg-gray-100 px-4 py-3"
                        bgColor="#F3F4F6"
                        onChange={(date) => setSearchParams((prev) => ({ ...prev, date }))}
                        onFocus={(e) => (e.target.type = "date")}
                    /> 


                <div className="flex gap-4">
                    <button
                        onClick={handleSearch}
                        className="bg-[var(--p-blue)] text-white flex items-center justify-center px-6 py-3 rounded-lg"
                    >
                        <Search className="mr-2" size={18} />
                        Search
                    </button>
                    <button
                        onClick={() => window.location.reload()}
                        className="bg-gray-800 text-white p-3 rounded-lg w-full flex items-center justify-center"
                    >
                        <RefreshCw size={18} />
                    </button>
                </div> */}
      </div>
    </div>
  );
};

export default EventManagementHeader;
