import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import LeaveRequestsHeader from "../components/LeaveRequestHeader";
import LeavesList from "../components/LeavesList";
import HrListStatsSummaryCards from "../components/HrListStatsSummaryCards";
import axios from "axios";
import { Select } from "@windmill/react-ui";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
import CustomPagination from "@/components/CustomPagination";
import request from "@/services/httpService";

const EMPTY_LEAVE_FILTERS = {
  name: "",
  department: "",
  position: "",
  status: "",
  date: "",
  startDate: "",
  endDate: "",
};

const DEFAULT_LEAVE_STATS = {
  total: 0,
  approved: 0,
  pending: 0,
  rejected: 0,
};

const LeaveRequestsPage = () => {
  const { t } = useTranslation();
  const [leaves, setLeaves] = useState([]);
  const [totalResults, setTotalResults] = useState(0);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const currentPageRef = useRef(1);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useState({ ...EMPTY_LEAVE_FILTERS });
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  const isFirstLeaveFilterRun = useRef(true);
  const [leaveStats, setLeaveStats] = useState({ ...DEFAULT_LEAVE_STATS });

  const fetchLeaves = async (page = 1, limit = 10) => {
    try {
      setLoading(true);
      const params = {
        page,
        limit,
        ...searchParams,
      };
      // Remove empty startDate/endDate
      if (!params.startDate) delete params.startDate;
      if (!params.endDate) delete params.endDate;

      const response = await request.get(`/leaves/getLeavesByStaff`, {
        params,
      });
      setLeaves(response.data);
      setTotalResults(response.total);
      setTotalPages(response.pagination.totalPages);
      setLeaveStats(response.stats || { ...DEFAULT_LEAVE_STATS });
      setLoading(false);
    } catch (err) {
      console.error("Error fetching leaves:", err);
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await fetchDepartments();
      await fetchPositions();
    })();
  }, []);

  useEffect(() => {
    const delay = isFirstLeaveFilterRun.current ? 0 : 400;
    isFirstLeaveFilterRun.current = false;
    const id = setTimeout(() => {
      setCurrentPage(1);
      currentPageRef.current = 1;
      fetchLeaves(1, recordsPerPage);
    }, delay);
    return () => clearTimeout(id);
  }, [searchParams]);

  const fetchDepartments = async () => {
    try {
      let response = await axios.get(`${Base_URL}/Departments/get`);
      console.log("departments res", response);
      setDepartments(response.data.data);
    } catch (err) {
      console.log("Failed to fetch items");
    }
  };

  const fetchPositions = async () => {
    try {
      let response = await axios.get(`${Base_URL}/Positions/get`);
      console.log("positions response", response);
      setPositions(response.data.data);
    } catch (err) {
      console.log("Failed to fetch items");
    }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    currentPageRef.current = page;
    fetchLeaves(page, recordsPerPage);
  };

  const handleRecordsPerPageChange = (perPage) => {
    setRecordsPerPage(perPage);
    setCurrentPage(1);
    currentPageRef.current = 1;
    fetchLeaves(1, perPage);
  };

  const handleClearLeaveFilters = () => {
    setSearchParams({ ...EMPTY_LEAVE_FILTERS });
  };

  const updateLeaveStatus = async (id, status, rejectReason) => {
    try {
      // Staff members typically can't approve/reject, but keeping the function structure
      // in case it's needed for future functionality
      await axios.put(
        `${Base_URL}/leaves/${id}/status`,
        {
          status,
          rejectReason,
        },
        {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${
              JSON.parse(localStorage.getItem("adminInfo")).token
            }`,
          },
        }
      );

      // Refresh the list with current page to get updated data
      await fetchLeaves(currentPage, recordsPerPage);
    } catch (err) {
      console.error("Error updating leave status:", err);
      throw err; // Re-throw to let child component handle error
    }
  };

  return (
    <div className="w-full container py-8 px-8">
      <LeaveRequestsHeader searchParams={searchParams} isStaff={true} />

      <HrListStatsSummaryCards
        stats={leaveStats}
        labels={{
          total: t("leaveManagement.totalLeaves"),
          approved: t("leaveManagement.approvedLeaves"),
          pending: t("leaveManagement.pendingLeaves"),
          rejected: t("leaveManagement.rejectedLeaves"),
        }}
      />

      <div className="mt-8">
        <LeavesList
          leaves={leaves}
          updateLeaveStatus={updateLeaveStatus}
          currentPage={currentPage}
          recordsPerPage={recordsPerPage}
          totalPages={totalPages}
          totalResults={totalResults}
          onPageChange={handlePageChange}
          loading={loading}
          onRecordsPerPageChange={handleRecordsPerPageChange}
          isStaff={true}
          searchParams={searchParams}
          setSearchParams={setSearchParams}
          departments={departments}
          positions={positions}
          onClearLeaveFilters={handleClearLeaveFilters}
        />
      </div>
    </div>
  );
};

export default LeaveRequestsPage;
