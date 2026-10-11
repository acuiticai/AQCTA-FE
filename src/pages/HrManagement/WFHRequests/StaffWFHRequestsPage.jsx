import { useState, useEffect, useRef, useContext } from "react";
import { useTranslation } from "react-i18next";
import WFHList from "../components/WFHList";
import axios from "axios";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

import { Card, CardContent } from "@/pages/SettingScreen/components/ui/card";
import { PageHeader, TextAreaField } from "@/page-layouts/index";
import { AdminContext } from "@/context/AdminContext";
import { DropdownBasic } from "@/page-layouts";
import {
  HR_PAGE_INNER,
  HR_PAGE_SHELL,
  HR_TABLE_CARD,
} from "../components/hrPageHeaderStyles";
import { formatDate } from "@/components/formatAmount";
import { notifyError, notifySuccess } from "@/utils/toast";

const getCardStyle = ({
  isPublicHoliday,
  status,
  canCreateWFH,
  isWeeklyOff,
}) => {
  if (isPublicHoliday || isWeeklyOff) {
    return "!bg-gray-100 border border-gray-300"; // public holiday
  }

  if (status === "Approved") {
    return "!bg-emerald-100 border border-emerald-200"; // approved
  }

  if (status === "Rejected") {
    return "!bg-rose-100 border border-rose-200"; // rejected
  }

  if (status === "Applied") {
    return "!bg-yellow-100 border border-yellow-200"; // applied
  }

  if (!canCreateWFH) {
    return "!bg-red-100 border border-red-200"; // unavailable
  }

  return "!bg-green-100 border border-green-200"; // available to apply
};

const WFHRequestsPage = () => {
  const { t } = useTranslation();
  const [wfhRequests, setWFHRequests] = useState([]);
  const [totalResults, setTotalResults] = useState(0);
  const [stats, setStats] = useState([]);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const currentPageRef = useRef(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedDates, setSelectedDates] = useState([]);
  const [showReasonPopup, setShowReasonPopup] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [searchParams, setSearchParams] = useState({
    week: 1,
  });
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;

  const toggleDateSelection = (date, canCreateWFH) => {
    if (!canCreateWFH) return;
    setSelectedDates((prevSelected) =>
      prevSelected.includes(date)
        ? prevSelected.filter((d) => d !== date)
        : [...prevSelected, date]
    );
  };

  const isSelected = (date) => selectedDates.includes(date);

  const handleApplyWFH = () => {
    if (selectedDates.length === 0) return;
    setShowReasonPopup(true);
  };

  const handleSubmit = async () => {
    // if (!reason.trim()) {
    //     // You can add your notification function here
    //     notifyError("Please enter a reason for WFH request")
    //     return
    // }

    try {
      setSubmitting(true);

      const staffEmail = adminInfo.email;

      // Create array of WFH requests for each selected date
      const wfhDataArray = selectedDates.map((date) => ({
        date_from: date,
        date_to: date, // Same as date_from for single day requests
        reason: reason.trim(),
      }));

      const requestData = {
        wfhRequests: wfhDataArray,
        email: staffEmail,
      };

      console.log("Submitting WFH request:", requestData);

      const res = await axios.post(
        `${Base_URL}/WFH/createWFHByStaff`,
        requestData
      );

      console.log("response", res);

      // Replace with your notification function
      notifySuccess("Work From Home request submitted successfully!");

      // Reset form
      setSelectedDates([]);
      setReason("");
      setShowReasonPopup(false);

      // Refresh data
      await fetchWFHRequests();
      await fetchWFHStats();
    } catch (err) {
      console.error("Error submitting WFH request:", err);

      const errorMessage =
        err?.response?.data?.msg ||
        err?.response?.data?.message ||
        "Failed to submit WFH request.";

      // Replace with your notification function
      notifyError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setReason("");
    setShowReasonPopup(false);
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await fetchWFHRequests();
      await fetchWFHStats();
      setLoading(false);
    };

    fetchData();
  }, [searchParams]);

  const fetchWFHStats = async (page = 1, limit = 10) => {
    try {
      const params = {
        page,
        limit,
        ...searchParams,
      };

      console.log(
        "req url: ---- ",
        `${Base_URL}/WFH/getStaffWFHStatus`,
        params
      );

      const response = await axios.get(
        `${Base_URL}/WFH/getStaffWFHStatus?email=${adminInfo.email}`,
        { params }
      );

      console.log("WFH - getStaffWFHStatus requests response -----", response);
      setStats(response.data.data || []);
    } catch (err) {
      console.error("Error fetching WFH requests:", err);
    }
  };

  const fetchWFHRequests = async (page = 1, limit = 10) => {
    try {
      const params = {
        page,
        limit,
        ...searchParams,
      };

      console.log("req url: ---- ", `${Base_URL}/WFH/getStaffWFH`, params);

      const response = await axios.get(
        `${Base_URL}/WFH/getStaffWFH?email=${adminInfo.email}`,
        { params }
      );

      console.log("WFH - getStaffWFH requests response -----", response);

      setWFHRequests(response.data.data || []);
      setTotalResults(response.data.total || 0);
      setTotalPages(response.data.totalPages || 1);
    } catch (err) {
      console.error("Error fetching WFH requests:", err);
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

  return (
    <div className={HR_PAGE_SHELL}>
      <div className={HR_PAGE_INNER}>
        <PageHeader
          variant="large"
          title={t("wfhRequests.title")}
          description={t("wfhRequests.staffPageDescription")}
          showBackButton
          backFallbackPath="/My-Hr"
          showAddButton={false}
          renderActions={[
            <div key="week" className="w-full max-w-[12.5rem] sm:w-[12.5rem]">
              <DropdownBasic
                width="100%"
                placeholder={t("wfhRequests.selectWeek")}
                name="week"
                value={searchParams.week || ""}
                onChange={(val) =>
                  setSearchParams({
                    ...searchParams,
                    week: val,
                  })
                }
                options={[
                  { value: 1, label: t("wfhRequests.week1") },
                  { value: 2, label: t("wfhRequests.week2") },
                ]}
              />
            </div>,
          ]}
        />

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--p-blue)]"></div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">
              Select Work From Home Dates
            </h2>
            <span className="text-sm text-gray-500">
              {selectedDates.length > 0
                ? `${selectedDates.length} date${
                    selectedDates.length > 1 ? "s" : ""
                  } selected`
                : "No dates selected"}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 justify-center mb-8">
            {stats.map((item, index) => (
              <Card
                onClick={() =>
                  toggleDateSelection(item.date, item.canCreateWFH)
                }
                key={index}
                className={`w-full cursor-pointer transition-all duration-200 ${getCardStyle(
                  item
                )} ${
                  isSelected(item.date) ? "!ring-2 !ring-[var(--p-blue)]" : ""
                } border-0 ${
                  item.canCreateWFH ? "hover:shadow-md" : "cursor-not-allowed"
                }`}
              >
                <CardContent className=" relative">
                  {item.canCreateWFH && (
                    <input
                      type="checkbox"
                      checked={isSelected(item.date)}
                      style={{ accentColor: "green" }}
                      className="absolute right-0 top-0"
                    />
                  )}
                  <div className="text-xs font-medium mb-1">
                    {formatDate(item.date)}
                  </div>
                  <div className="text-md font-bold mb-1">{item.day}</div>

                  {/* Show department WFH status if not a holiday */}
                  {!item.isPublicHoliday &&
                    !item.isWeeklyOff &&
                    item.departmentWFHStatus && (
                      <div className="text-xs text-gray-600 font-medium mb-2">
                        ({item.departmentWFHStatus})
                      </div>
                    )}

                  {/* Show Public Holiday or Weekly Off */}
                  {item.isPublicHoliday ? (
                    <div className="text-sm font-semibold">
                      <span className="text-xs">
                        PH - {item.publicHolidayName}
                      </span>
                    </div>
                  ) : item.isWeeklyOff ? (
                    <div className="text-sm font-semibold ">Weekly Off</div>
                  ) : item.status ? (
                    <div className="text-sm font-medium">
                      {" "}
                      <span
                        className={
                          item.status === "Approved"
                            ? "text-green-600"
                            : item.status === "Rejected"
                            ? "text-red-600"
                            : "text-yellow-600"
                        }
                      >
                        {item.status}
                      </span>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">
                      {item.canCreateWFH
                        ? "You can apply for WFH"
                        : "WFH not allowed"}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Submit Button - Shows when dates are selected */}
          {selectedDates.length > 0 && (
            <div className="flex justify-end mb-8">
              <button
                onClick={handleApplyWFH}
                className="bg-[var(--p-blue)] hover:bg-[#9BC234] text-white px-8 py-3 rounded-xl font-medium transition duration-200"
              >
                Apply WFH for {selectedDates.length} day
                {selectedDates.length > 1 ? "s" : ""}
              </button>
            </div>
          )}

          {/* Reason Popup Modal */}
          {showReasonPopup && (
            <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">
                    Work From Home Request
                  </h2>
                  <button
                    onClick={handleCancel}
                    className="text-gray-500 hover:text-gray-700"
                    disabled={submitting}
                  >
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  {/* <div>
                    <label className="block text-gray-700 mb-2 font-medium">Selected Dates:</label>
                    <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                      {selectedDates.map((date, index) => (
                        <span key={date}>
                          {formatDate(date)}
                          {index < selectedDates.length - 1 && ", "}
                        </span>
                      ))}
                    </div>
                  </div> */}
                  <div>
                    <label className="block text-gray-700 mb-2 font-medium">
                      Reason for WFH Request (Optional)
                    </label>
                    <TextAreaField
                      name="reason"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Please enter your reason for working from home..."
                      disabled={submitting}
                      rows={4}
                    />
                    {/* {!reason.trim() && <p className="text-gray-500 text-xs mt-1">This field is required</p>} */}
                  </div>
                </div>

                <div className="flex gap-4 flex-row-reverse mt-6">
                  {/* <button
                                        onClick={handleSubmit}
                                        disabled={submitting || !reason.trim()}
                                        className={`w-full bg-[var(--p-blue)] hover:bg-[#9BC234] text-white py-3 px-4 rounded-md transition duration-200 ${submitting || !reason.trim() ? "opacity-60 cursor-not-allowed" : ""
                                            }`}
                                    > */}
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className={`w-full bg-[var(--p-blue)] hover:bg-[#9BC234] text-white py-3 px-4 rounded-md transition duration-200 ${
                      submitting ? "opacity-60 cursor-not-allowed" : ""
                    }`}
                  >
                    {submitting ? "Submitting..." : "Submit Request"}
                  </button>

                  <button
                    onClick={handleCancel}
                    disabled={submitting}
                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-4 rounded-md transition duration-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className={`${HR_TABLE_CARD} mt-8`}>
            <WFHList
              isStaff={true}
              wfhRequests={wfhRequests}
              currentPage={currentPage}
              recordsPerPage={recordsPerPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              loading={loading}
              onRecordsPerPageChange={handleRecordsPerPageChange}
            />
          </div>
        </>
      )}
      </div>
    </div>
  );
};

export default WFHRequestsPage;
