import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useTranslation } from "react-i18next";
import WFHRequestsHeader from "../components/WFHRequestHeader";
import WFHList from "../components/WFHList";
import HrListStatsSummaryCards from "../components/HrListStatsSummaryCards";
import {
  HR_PAGE_INNER,
  HR_PAGE_SHELL,
  HR_TABLE_CARD,
} from "../components/hrPageHeaderStyles";
import axios from "axios";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const WFHRequestsPage = () => {
  const { t } = useTranslation();
  const [wfhRequests, setWFHRequests] = useState([]);
  const [totalResults, setTotalResults] = useState(0);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const currentPageRef = useRef(1);
  const skipWfhFilterEffect = useRef(true);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useState({
    name: "",
    departmentName: "",
    positionName: "",
    status: "",
    date: "",
  });
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);

  const [stats, setStats] = useState({
    total: 0,
    approved: 0,
    pending: 0,
    rejected: 0,
  });

  const uniqueDepartmentsByName = useMemo(
    () =>
      departments?.filter(
        (dept, index, self) =>
          index === self.findIndex((d) => d.name === dept.name)
      ) || [],
    [departments]
  );

  const uniquePositionsByName = useMemo(
    () =>
      positions?.filter(
        (pos, index, self) =>
          index === self.findIndex((p) => p.name === pos.name)
      ) || [],
    [positions]
  );

  const fetchWFHRequests = useCallback(
    async (page = 1, limit = recordsPerPage) => {
      try {
        setLoading(true);
        const params = { page, limit };
        Object.entries(searchParams).forEach(([key, value]) => {
          if (value) params[key] = value;
        });

        const response = await axios.get(`${Base_URL}/WFH`, { params });

        setWFHRequests(response.data.data || []);
        setTotalResults(response.data.total || 0);
        setStats({
          total: response.data.total ?? 0,
          approved: response.data.approvedCount ?? 0,
          pending: response.data.appliedCount ?? 0,
          rejected: response.data.rejectedCount ?? 0,
        });
        setTotalPages(response.data.totalPages || 1);
      } catch (err) {
        console.error("Error fetching WFH requests:", err);
      } finally {
        setLoading(false);
      }
    },
    [searchParams, recordsPerPage]
  );

  useEffect(() => {
    fetchDepartments();
    fetchPositions();
  }, []);

  useEffect(() => {
    fetchWFHRequests(currentPage, recordsPerPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- page/size only
  }, [currentPage, recordsPerPage]);

  const handleSearchParamChange = useCallback((key, value) => {
    setSearchParams((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetWfhFilters = useCallback(() => {
    setSearchParams({
      name: "",
      departmentName: "",
      positionName: "",
      status: "",
      date: "",
    });
    setCurrentPage(1);
    currentPageRef.current = 1;
  }, []);

  useEffect(() => {
    if (skipWfhFilterEffect.current) {
      skipWfhFilterEffect.current = false;
      return;
    }

    const id = setTimeout(() => {
      if (currentPageRef.current !== 1) {
        setCurrentPage(1);
        currentPageRef.current = 1;
      } else {
        fetchWFHRequests(1, recordsPerPage);
      }
    }, 350);

    return () => clearTimeout(id);
  }, [
    searchParams.name,
    searchParams.departmentName,
    searchParams.positionName,
    searchParams.status,
    searchParams.date,
    fetchWFHRequests,
    recordsPerPage,
  ]);

  const wfhTableFilters = useMemo(
    () => [
      {
        isClearButton: true,
        buttonProps: {
          onClick: resetWfhFilters,
        },
      },
      {
        isTextInput: true,
        name: "wfhNameFilter",
        value: searchParams.name,
        onChange: (v) => handleSearchParamChange("name", v),
        placeholder: t("wfhRequests.searchByNameIc"),
      },
      {
        options: uniqueDepartmentsByName.map((dept) => ({
          value: dept.name,
          label: dept.name,
        })),
        value: searchParams.departmentName,
        onChange: (value) => handleSearchParamChange("departmentName", value),
        placeholder: t("wfhRequests.searchByDepartment"),
        isClearable: true,
      },
      {
        options: uniquePositionsByName.map((pos) => ({
          value: pos.name,
          label: pos.name,
        })),
        value: searchParams.positionName,
        onChange: (value) => handleSearchParamChange("positionName", value),
        placeholder: t("wfhRequests.searchByPosition"),
        isClearable: true,
      },
      {
        options: [
          { value: "Applied", label: "Applied" },
          { value: "Approved", label: "Approved" },
          { value: "Rejected", label: "Rejected" },
        ],
        value: searchParams.status,
        onChange: (value) => handleSearchParamChange("status", value),
        placeholder: t("wfhRequests.searchByStatus"),
        isClearable: true,
      },
      {
        isDatePicker: true,
        value: searchParams.date,
        onChange: (val) => handleSearchParamChange("date", val),
        clearable: true,
      },
    ],
    [
      searchParams,
      uniqueDepartmentsByName,
      uniquePositionsByName,
      handleSearchParamChange,
      resetWfhFilters,
      t,
    ]
  );

  const fetchDepartments = async () => {
    try {
      const response = await axios.get(`${Base_URL}/Departments/get`);
      setDepartments(response.data.data);
    } catch (err) {
      console.log("Failed to fetch departments");
    }
  };

  const fetchPositions = async () => {
    try {
      const response = await axios.get(`${Base_URL}/Positions/get`);
      setPositions(response.data.data);
    } catch (err) {
      console.log("Failed to fetch positions");
    }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    currentPageRef.current = page;
    fetchWFHRequests(page, recordsPerPage);
  };

  const handleRecordsPerPageChange = (perPage) => {
    setRecordsPerPage(perPage);
    setCurrentPage(1);
    currentPageRef.current = 1;
    fetchWFHRequests(1, perPage);
  };

  const updateWFHStatus = async (id, status, rejectReason) => {
    try {
      await axios.put(`${Base_URL}/WFH/${id}/status`, {
        status,
        rejectReason,
      });
      fetchWFHRequests(currentPage, recordsPerPage);
    } catch (err) {
      console.error("Error updating WFH status:", err);
      throw err;
    }
  };

  const parentUpdateWFHDates = async (id, date_from, date_to) => {
    try {
      await axios.put(`${Base_URL}/WFH/${id}/dates`, {
        date_from,
        date_to,
      });
      fetchWFHRequests(currentPage, recordsPerPage);
    } catch (err) {
      console.error("Error updating WFH dates:", err);
      throw err;
    }
  };

  return (
    <div className={HR_PAGE_SHELL}>
      <div className={HR_PAGE_INNER}>
      <WFHRequestsHeader />

      <HrListStatsSummaryCards
        variant="wfh"
        stats={stats}
        labels={{
          total: t("wfhRequests.wfhRequests"),
          approved: t("wfhRequests.approvedRequests"),
          pending: t("wfhRequests.pendingRequests"),
          rejected: t("wfhRequests.rejectedRequests"),
        }}
      />

      <div className={HR_TABLE_CARD}>
        <WFHList
          wfhRequests={wfhRequests}
          updateWFHStatus={updateWFHStatus}
          currentPage={currentPage}
          recordsPerPage={recordsPerPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          loading={loading}
          onRecordsPerPageChange={handleRecordsPerPageChange}
          parentUpdateWFHDates={parentUpdateWFHDates}
          tableFilters={wfhTableFilters}
        />
      </div>
      </div>
    </div>
  );
};

export default WFHRequestsPage;
