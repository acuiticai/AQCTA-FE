import React, {
  useEffect,
  useState,
  useContext,
  useMemo,
  useRef,
} from "react";
import axios from "axios";
import { DataTable } from "@/page-layouts/index";
import { AdminContext } from "@/context/AdminContext";
import DropdownBasic from "@/page-layouts/components/DropdownBasic";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const Leaves = ({ filters = {}, company = "" }) => {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit, setLimit] = useState(10);
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const [selectedWeek, setSelectedWeek] = useState("this");

  const filtersKey = useMemo(() => JSON.stringify(filters ?? {}), [filters]);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!adminInfo?.token) return;

    const myId = ++requestIdRef.current;
    const ac = new AbortController();

    const run = async () => {
      try {
        setLoading(true);
        let filterValues = {};
        try {
          filterValues = JSON.parse(filtersKey);
        } catch {
          filterValues = {};
        }
        const params = {
          page: currentPage,
          limit,
          ...filterValues,
          week: selectedWeek,
        };
        if (company) params.company = company;

        const res = await axios.get(`${Base_URL}/Leaves/weekly-leaves`, {
          params,
          signal: ac.signal,
          headers: {
            Authorization: `Bearer ${adminInfo.token}`,
          },
        });

        if (myId !== requestIdRef.current) return;

        setLeaves(res.data?.data || res.data.data || []);
        setTotalPages(res.data?.totalPages || 1);
        // Do not sync currentPage/limit from the API — that creates a loop with
        // useEffect deps and DataTable's global page-size bootstrap.
      } catch (error) {
        if (axios.isCancel?.(error) || error?.name === "CanceledError") return;
        console.error("Error fetching leaves", error);
      } finally {
        if (myId === requestIdRef.current) setLoading(false);
      }
    };

    run();
    return () => ac.abort();
  }, [
    adminInfo?.token,
    filtersKey,
    company,
    selectedWeek,
    currentPage,
    limit,
  ]);

  const renderDuration = (duration) => (
    <div className="flex gap-1">
      {["M", "T", "W", "T", "F", "S", "S"].map((day, idx) => {
        const dayObj = duration?.[idx];
        let color = "bg-gray-100 text-gray-500 border border-gray-300";
        if (dayObj?.onLeave)
          color = "bg-red-50 text-red-500 border border-red-300";
        return (
          <span
            key={idx}
            className={`w-6 h-6 flex items-center justify-center rounded border text-xs font-bold ${color}`}
          >
            {day}
          </span>
        );
      })}
    </div>
  );

  return (
    <div className="mt-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-4">
        <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-0 md:mb-0">
          On Leaves Employees
        </h3>
        <div className="flex flex-wrap gap-3 items-center">
          <DropdownBasic
            options={[
              { value: "this", label: "This Week" },
              { value: "previous", label: "Last Week" },
            ]}
            value={selectedWeek}
            onChange={setSelectedWeek}
            placeholder="Select Week"
            isClearable={false}
            className="rounded-xl border border-gray-200 min-w-[120px]"
          />
        </div>
      </div>
      <div className="mb-6 bg-[#F9F9FA] rounded-xl">
        <div className="overflow-x-auto">
          <DataTable
            headers={["Name", "Duration", "Reason", "Position"]}
            noPadding={true}
            containerClassName="p-0"
            data={leaves}
            loading={loading}
            totalPages={totalPages}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            recordsPerPage={limit}
            onRecordsPerPageChange={setLimit}
            renderRow={(leave) => (
              <tr key={leave._id || leave.name} className="border-b hover:bg-gray-50">
                <td className="py-3 px-4">{leave.name}</td>
                <td className="py-3 px-4">{renderDuration(leave.duration)}</td>
                <td className="py-3 px-4">{leave.reason}</td>
                <td className="py-3 px-4">{leave.position}</td>
              </tr>
            )}
          />
        </div>
      </div>
    </div>
  );
};

export default Leaves;
