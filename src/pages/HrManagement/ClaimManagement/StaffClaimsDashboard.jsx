import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { formatAmount } from "@/components/formatAmount";
import { useHistory } from "react-router-dom";
import CurrencyServices from "@/services/CurrencyServices";
import useAsync from "@/hooks/useAsync";
import { useDebounce } from "use-debounce";
import { DataTable, PageHeader, ActionButtons } from "@/page-layouts/index";
import { FilePlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import request from "@/services/httpService";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";
import HrListStatsSummaryCards from "../components/HrListStatsSummaryCards";

// Import the enhanced currency helpers
import {
  calculateTotalClaimableAmount,
  getUniqueCurrencies,
  getCurrencyWiseTotals,
  hasSingleCurrency,
} from "./currency-helpers";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const ClaimsDashboard = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const [claims, setClaims] = useState([]);
  const [filteredClaims, setFilteredClaims] = useState([]);
  const [totalResults, setTotalResults] = useState(0);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const currentPageRef = useRef(1);
  const skipStaffClaimFilterEffect = useRef(true);
  const [stats, setStats] = useState({
    total: 0,
    approved: 0,
    pending: 0, // Updated from underReview to pending
    rejected: 0,
    totalAmount: 0, // Added total amount
  });

  // Modal states
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [currentClaimId, setCurrentClaimId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter states
  const [nameIdFilter, setNameIdFilter] = useState("");
  const [amountFilter, setAmountFilter] = useState("");
  const [currencyFilter, setCurrencyFilter] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [claimReference, setClaimReference] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateRangeFilter, setDateRangeFilter] = useState("");
  const [businesses, setBusinesses] = useState([]);
  const [claimsLoading, setClaimsLoading] = useState(false);
  const { data, loading, error } = useAsync(CurrencyServices.getAllCurrency);
  const [searchInput, setSearchInput] = useState("");
  const [tableSearchFilter] = useDebounce(searchInput, 500);

  // Component for rendering claim amount with currency awareness
  const ClaimAmountCell = ({ items }) => {
    if (!items || !Array.isArray(items) || items.length === 0) {
      return <span className="text-gray-500">-</span>;
    }

    const currencies = getUniqueCurrencies(items);

    // Single currency or no currency - show simple total
    if (currencies.length <= 1) {
      const total = calculateTotalClaimableAmount(items);
      return <span className="font-medium">{formatAmount(total)}</span>;
    }

    // Multiple currencies - show breakdown
    const currencyTotals = getCurrencyWiseTotals(items);

    return (
      <div className="space-y-1">
        {Object.entries(currencyTotals).map(([currency, amount], index) => (
          <div key={currency} className="text-xs">
            <span className="font-medium">{formatAmount(amount)}</span>
            <span className="text-gray-500 ml-1">{currency}</span>
          </div>
        ))}
      </div>
    );
  };

  // Helper function to get all supporting documents from items
  const getAllSupportingDocuments = (items) => {
    if (!items || !Array.isArray(items)) return [];
    return items
      .map((item) => item.supportingDocuments)
      .filter((doc) => doc && (doc.fileId || doc.file_id || doc._id));
  };

  useEffect(() => {
    // Fetch claims data
    fetchClaims();
    const storedBusinesses = localStorage.getItem("businesses");
    if (storedBusinesses) {
      setBusinesses(JSON.parse(storedBusinesses));
    }
  }, []);

  useEffect(() => {
    fetchClaims(currentPage, recordsPerPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounced table search only
  }, [tableSearchFilter]);

  useEffect(() => {
    if (skipStaffClaimFilterEffect.current) {
      skipStaffClaimFilterEffect.current = false;
      return;
    }
    const id = setTimeout(() => {
      setCurrentPage(1);
      currentPageRef.current = 1;
      fetchClaims(1, recordsPerPage);
    }, 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- structural filters only
  }, [
    amountFilter,
    currencyFilter,
    claimReference,
    statusFilter,
    dateRangeFilter,
  ]);

  const fetchClaims = async (page = 1, limit = recordsPerPage) => {
    try {
      setClaimsLoading(true);
      console.log("date range filter", dateRangeFilter);
      const res = await request.get("/claims/getClaimsByStaff", {
        params: {
          page,
          limit,
          empName: nameIdFilter || undefined,
          empCode: nameIdFilter || undefined,
          claimAmount: amountFilter || undefined,
          currency: currencyFilter || undefined,
          company: companyFilter || undefined,
          claimReference: claimReference || undefined,
          status: statusFilter || undefined,
          ...(dateRangeFilter && {
            createdAt: dateRangeFilter,
          }),
          search: tableSearchFilter || undefined,
        },
      });

      setClaims(res.data);
      setFilteredClaims(res.data);
      setTotalResults(res.total);
      setTotalPages(res.pagination.totalPages);
      setStats(res.stats);
      setClaimsLoading(false);
    } catch (error) {
      console.error("Error fetching claims", error);
      setClaimsLoading(false);
    }
  };

  const fetchAllClaimsForExport = async () => {
    try {
      const res = await axios.get(`${Base_URL}/claims`, {
        params: {
          // Don't send pagination parameters
          limit: 10000, // arbitrary large number if backend doesn't support "no limit"
        },
      });
      return res.data.data;
    } catch (error) {
      console.error("Error fetching all claims for export:", error);
      return [];
    }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    currentPageRef.current = page;
    fetchClaims(page, recordsPerPage); // Make sure all filters are used inside fetchClaims
  };

  const handleRecordsPerPageChange = (perPage) => {
    setRecordsPerPage(perPage);
    setCurrentPage(1);
    currentPageRef.current = 1;
    fetchClaims(1, perPage);
  };

  const resetStaffClaimFilters = useCallback(() => {
    setAmountFilter("");
    setCurrencyFilter("");
    setClaimReference("");
    setStatusFilter("");
    setDateRangeFilter("");
    setSearchInput("");
    setCurrentPage(1);
    currentPageRef.current = 1;
  }, []);

  const staffClaimTableFilters = useMemo(
    () => [
      {
        isClearButton: true,
        buttonProps: {
          onClick: resetStaffClaimFilters,
        },
      },
      {
        isTextInput: true,
        name: "claimAmountFilter",
        value: amountFilter,
        onChange: (v) => setAmountFilter(v),
        placeholder: "Claim Amount",
      },
      {
        options: (data || []).map((currency) => ({
          label: currency.name,
          value: currency._id,
        })),
        value: currencyFilter,
        onChange: (value) => setCurrencyFilter(value),
        placeholder: "Search By Currency",
        isClearable: true,
      },
      {
        options: [
          { label: "Approved", value: "approved" },
          { label: "Rejected", value: "rejected" },
          { label: "Pending", value: "pending" },
        ],
        value: statusFilter,
        onChange: (value) => setStatusFilter(value),
        placeholder: "Search By Claim Status",
        isClearable: true,
      },
      {
        isTextInput: true,
        name: "claimReferenceFilter",
        value: claimReference,
        onChange: (v) => setClaimReference(v),
        placeholder: "Search By Claim Reference",
      },
      {
        isDatePicker: true,
        value: dateRangeFilter,
        onChange: (val) => setDateRangeFilter(val),
        clearable: true,
      },
    ],
    [
      amountFilter,
      currencyFilter,
      claimReference,
      statusFilter,
      dateRangeFilter,
      data,
      resetStaffClaimFilters,
    ]
  );

  const HandleOpenFile = async (documentId) => {
    console.log("document_id", documentId);
    try {
      let Response = await axios.get(
        `${Base_URL}/documents/getFileWithAllData/${documentId}`
      );
      console.log("document_id Response", Response);
      window.open(Response.data.data.url, "_blank");
    } catch (error) {
      console.error("Error getting file", error);
    }
  };

  // Approval and Rejection handlers
  const handleApproveClick = (claimId) => {
    console.log("claim id", claimId);
    setCurrentClaimId(claimId);
    setShowApproveModal(true);
  };

  const handleRejectClick = (claimId) => {
    console.log("claim id", claimId);
    setCurrentClaimId(claimId);
    setRejectReason("");
    setShowRejectModal(true);
  };

  const handleApproveConfirm = async () => {
    setIsSubmitting(true);
    try {
      await updateClaimStatus(currentClaimId, "Approved");
      setShowApproveModal(false);
      await fetchClaims(); // Refresh claims data
    } catch (error) {
      console.error("Error approving claim:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectConfirm = async () => {
    setIsSubmitting(true);
    try {
      await updateClaimStatus(currentClaimId, "Rejected", rejectReason);
      setShowRejectModal(false);
      setRejectReason("");
      await fetchClaims(); // Refresh claims data
    } catch (error) {
      console.error("Error rejecting claim:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateClaimStatus = async (claimId, status, remarks = "") => {
    try {
      const response = await axios.put(
        `${Base_URL}/claims/${claimId}/status`,
        { status, remarks },
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

      console.log("Claim status updated:", response.data);
      return response.data;
    } catch (error) {
      console.error("Error updating claim status:", error);
      throw error;
    }
  };

  return (
    <div className="p-6 bg-white">
      <PageHeader
        showBackButton={true}
        title="Claim"
        showAddButton={true}
        addNewButtonClassName="!h-auto"
        AddNewButtonIcon={<FilePlus size={16} className="mr-2" />}
        onAddNew={() => history.push("/staff-new-claim")}
      />

      <HrListStatsSummaryCards
        stats={stats}
        labels={{
          total: t("claimManagement.totalClaims"),
          approved: t("claimManagement.approvedClaims"),
          pending: t("claimManagement.pendingClaims"),
          rejected: t("claimManagement.rejectedClaims"),
        }}
      />

      {/* Claims table - Updated for new schema */}
      <div className="mb-6 bg-[#F9F9FA] rounded-xl">
        <div className="overflow-x-auto">
          <DataTable
            filters={staffClaimTableFilters}
            searchValue={searchInput}
            onSearch={(value) => setSearchInput(value)}
            searchPlaceholder="Search"
            headers={[
              "Items Count",
              "Claim Amount", // Updated header to be more descriptive
              "Currencies",
              "Status",
              "Documents",
              "Action",
            ]}
            colWidths={{
              Action: "130px",
            }}
            data={filteredClaims}
            total={totalResults}
            currentPage={currentPage}
            onPageChange={handlePageChange}
            onRecordsPerPageChange={handleRecordsPerPageChange}
            recordsPerPage={recordsPerPage}
            totalPages={totalPages}
            loading={claimsLoading}
            renderRow={(claim) => (
              <tr key={claim._id} className="border-b hover:bg-gray-50">
                <td className="py-3 px-4">
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                    {claim.items?.length || 0} items
                  </span>
                </td>
                <td className="py-3 px-4">
                  <ClaimAmountCell items={claim.items} />
                </td>
                <td className="py-3 px-4">
                  <div className="flex flex-wrap gap-1">
                    {getUniqueCurrencies(claim.items).map((currency, index) => (
                      <span
                        key={index}
                        className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs font-medium"
                      >
                        {currency}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="py-3 px-4">
                  {claim.status === "Pending" && claim.hasActed ? (
                    <span>{claim.nextActionMessage}</span>
                  ) : (
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        claim.status === "Approved"
                          ? "bg-green-100 text-green-800"
                          : claim.status === "Rejected"
                          ? "bg-red-100 text-red-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {claim.status}
                    </span>
                  )}
                </td>
                <td className="py-3 px-4">
                  {(() => {
                    const documents = getAllSupportingDocuments(claim.items);
                    if (documents.length === 0) return "-";
                    if (documents.length === 1) {
                      const d0 = documents[0];
                      const fid = d0.fileId || d0.file_id || d0._id;
                      return (
                        <button
                          onClick={() => HandleOpenFile(fid)}
                          className="text-blue-600 hover:underline text-sm"
                        >
                          {d0.name || "Document"}
                        </button>
                      );
                    }
                    return (
                      <div className="flex flex-col gap-1">
                        {documents.slice(0, 2).map((doc, index) => {
                          const fid = doc.fileId || doc.file_id || doc._id;
                          return (
                            <button
                              key={index}
                              onClick={() => HandleOpenFile(fid)}
                              className="text-blue-600 hover:underline text-xs text-left"
                            >
                              {doc.name || "Document"}
                            </button>
                          );
                        })}
                        {documents.length > 2 && (
                          <span className="text-xs text-gray-500">
                            +{documents.length - 2} more
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </td>
                <td className="py-3 px-4 align-top overflow-visible whitespace-normal">
                  <div className="flex justify-center w-full min-w-[100px]">
                    <ActionButtons
                      isCell
                      justifyCenter
                      items={[
                        {
                          action: ACTION_BUTTON_TYPES.VIEW,
                          tooltip: t("claimManagement.viewClaim"),
                          permission: true,
                          onClick: () =>
                            history.push(`/staff-claim-details/${claim._id}`),
                        },
                      ]}
                    />
                  </div>
                </td>
              </tr>
            )}
          />
        </div>
      </div>

      {/* Approval Modal */}
      {showApproveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Claim Approved!</h2>
              <button
                onClick={() => setShowApproveModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  ></path>
                </svg>
              </button>
            </div>

            <p className="text-gray-700 mb-6">
              Are you sure you want to approve this claim?
            </p>

            <div className="flex justify-center mb-6">
              <div className="bg-[var(--p-blue)] bg-opacity-20 p-4 rounded-full">
                <svg
                  className="w-12 h-12 text-[var(--p-blue)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M5 13l4 4L19 7"
                  ></path>
                </svg>
              </div>
            </div>

            <button
              onClick={handleApproveConfirm}
              disabled={isSubmitting}
              className="w-full bg-[var(--p-blue)] hover:bg-[#9FBF29] text-white py-3 px-4 rounded-md transition duration-200"
            >
              {isSubmitting ? "Processing..." : "Approve"}
            </button>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Claim Rejected!</h2>
              <button
                onClick={() => setShowRejectModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  ></path>
                </svg>
              </button>
            </div>

            <p className="text-gray-700 mb-4">
              Please add the reason below to reject the claim.
            </p>

            <div className="mb-6">
              <label className="block text-gray-700 mb-2">
                Reason (Optional)
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter your reason"
                className="w-full border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
                rows="4"
              ></textarea>
            </div>

            <div className="flex flex-col space-y-3">
              <button
                onClick={handleRejectConfirm}
                disabled={isSubmitting}
                className={`w-full bg-red-500 hover:bg-red-600 text-white py-3 px-4 rounded-md transition duration-200 ${
                  isSubmitting ? "opacity-60 cursor-not-allowed" : ""
                }`}
              >
                {isSubmitting ? "Processing..." : "Reject Claim Request"}
              </button>

              <button
                onClick={() => setShowRejectModal(false)}
                disabled={isSubmitting}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-4 rounded-md transition duration-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClaimsDashboard;
