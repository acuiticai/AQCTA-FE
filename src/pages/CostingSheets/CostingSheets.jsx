import React, { useContext, useEffect, useMemo, useState } from "react";
import { useHistory } from "react-router-dom";
import { FileText } from "lucide-react";
import {
  DataTable,
  ActionButtons,
  SummaryCards,
} from "@/page-layouts";
import QuotationDetail from "@/components/Certification/QuotationDetail";
import { notifyError } from "@/utils/toast";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";
import { AdminContext } from "@/context/AdminContext";
import useCheckTokenExpired from "@/hooks/useCheckTokenExpired";
import ApplicationServices from "@/services/ApplicationServices";
import SummarySvg from "@/assets/img/summary.svg";
import CompletedSvg from "@/assets/img/completed.svg";
import InProgressSvg from "@/assets/img/in-progress.svg";
import PendingApprovalSvg from "@/assets/img/pending-approval.svg";

const FORM_KEY = "costing";

const STATUS_OPTIONS = ["Draft", "Pending Approval", "Approved", "Rejected"];

const STATUS_STYLES = {
  Draft: "bg-gray-100 text-gray-800",
  "Pending Approval": "bg-amber-100 text-amber-800",
  Approved: "bg-emerald-100 text-emerald-800",
  Rejected: "bg-rose-100 text-rose-800",
};

const formatDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
};

const money = (value) => {
  const n =
    typeof value === "number"
      ? value
      : Number(String(value ?? "").replace(/,/g, ""));
  if (!Number.isFinite(n)) return "RM —";
  return `RM ${n.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

/**
 * Finance → Costing Sheet
 *
 * Every PC&I costing sheet (certification FOR-01-06 and inspection FOR-06-02)
 * across every application. One system user prices the work, a second
 * approves it, and the approved figures drive the quotation. Read-mostly —
 * the form itself lives on the application's own Actions page.
 */
const CostingSheets = () => {
  const history = useHistory();
  const { state } = useContext(AdminContext);
  const adminInfo =
    state?.adminInfo ||
    (localStorage.getItem("adminInfo")
      ? JSON.parse(localStorage.getItem("adminInfo"))
      : null);
  const checkTokenExpired = useCheckTokenExpired();

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [detailRow, setDetailRow] = useState(null);

  const authHeaders = useMemo(
    () => ({
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo?.token}`,
    }),
    [adminInfo?.token],
  );

  const headers = [
    "Application",
    "Customer / Product",
    "Prepared by",
    "Approved by",
    "Grand total",
    "Status",
    "Updated",
    "Actions",
  ];

  const colWidths = {
    Application: "180px",
    "Customer / Product": "220px",
    "Prepared by": "140px",
    "Approved by": "140px",
    "Grand total": "140px",
    Status: "140px",
    Updated: "120px",
    Actions: "140px",
  };

  const fetchCostingSheets = async () => {
    if (!adminInfo?.token) {
      setLoading(false);
      setRows([]);
      setTotal(0);
      return;
    }

    try {
      setLoading(true);
      const response = await ApplicationServices.getFormSubmissions(
        FORM_KEY,
        {
          page: currentPage,
          limit: recordsPerPage,
          search: searchTerm || undefined,
          status: statusFilter !== "all" ? statusFilter : undefined,
        },
        {
          headers: authHeaders,
          withCredentials: true,
        },
      );
      if (checkTokenExpired(response)) return;

      setRows(Array.isArray(response.data?.data) ? response.data.data : []);
      const metaTotal = response.data?.meta?.total || 0;
      setTotal(metaTotal);
      setTotalPages(
        Math.max(1, Math.ceil(metaTotal / (Number(recordsPerPage) || 10))),
      );
    } catch (error) {
      notifyError(
        error?.response?.data?.message || "Failed to load costing sheets",
      );
      setRows([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!adminInfo?.token) return;
    fetchCostingSheets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminInfo?.token, currentPage, statusFilter, recordsPerPage]);

  useEffect(() => {
    if (!adminInfo?.token) return;
    const timeoutId = setTimeout(() => {
      setCurrentPage(1);
      fetchCostingSheets();
    }, 400);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  const getStatusBadge = (status) => (
    <span
      className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
        STATUS_STYLES[status] || "bg-gray-100 text-gray-800"
      }`}
    >
      {status || "—"}
    </span>
  );

  const clearAllFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setCurrentPage(1);
  };

  const filters = [
    {
      isClearButton: true,
      buttonProps: { onClick: clearAllFilters },
    },
    {
      label: "Status",
      value: statusFilter,
      onChange: (value) => {
        setStatusFilter(value);
        setCurrentPage(1);
      },
      options: [
        { value: "all", label: "All Statuses" },
        ...STATUS_OPTIONS.map((s) => ({ value: s, label: s })),
      ],
      placeholder: "Select Status",
      icon: FileText,
    },
  ];

  const countOf = (status) => rows.filter((r) => r.status === status).length;

  const summaryCardsData = [
    {
      title: "Total Costing Sheets",
      value: total || 0,
      backgroundColor: "summary-light",
      iconColor: "summary-dark",
      Icon: SummarySvg,
    },
    {
      title: "Pending Approval",
      value: countOf("Pending Approval"),
      backgroundColor: "processing-light",
      iconColor: "processing-dark",
      Icon: PendingApprovalSvg,
    },
    {
      title: "Approved",
      value: countOf("Approved"),
      backgroundColor: "completed-light",
      iconColor: "completed-dark",
      Icon: CompletedSvg,
    },
    {
      title: "Returned",
      value: countOf("Rejected"),
      backgroundColor: "processing-light",
      iconColor: "processing-dark",
      Icon: InProgressSvg,
    },
  ];

  return (
    <div className="bg-gray-50 min-h-screen w-full max-w-full overflow-x-hidden">
      <div className="w-full max-w-full mx-auto px-6 py-8 min-w-0 overflow-x-hidden">
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Costing Sheet
              </h1>
              <p className="text-gray-600 mt-2">
                Certification (AQCTA-FOR-01-06) and inspection
                (AQCTA-FOR-06-02) costing sheets. One system user prices
                the work, another approves it, which issues the quotation.
              </p>
            </div>
          </div>
        </div>

        <SummaryCards cards={summaryCardsData} columnsCount={4} />

        <DataTable
          onSearch={(value) => {
            setSearchTerm(value);
            setCurrentPage(1);
          }}
          searchValue={searchTerm}
          searchPlaceholder="Search by application, customer or product…"
          filters={filters}
          headers={headers}
          headersToHide={[]}
          colWidths={colWidths}
          wideTable
          skipDynamicColumnWidths
          data={rows}
          totalRecords={total}
          loading={loading}
          currentPage={currentPage}
          totalPages={totalPages}
          recordsPerPage={recordsPerPage}
          onPageChange={setCurrentPage}
          onRecordsPerPageChange={(perPage) => {
            setRecordsPerPage(perPage);
            setCurrentPage(1);
          }}
          renderRow={(row) => (
            <tr key={row._id || row.application} className="border-b">
              <td className="py-2 px-4 whitespace-nowrap">
                {row.application ? (
                  <button
                    type="button"
                    className="text-[var(--p-blue)] hover:underline font-medium text-left whitespace-nowrap"
                    title={row.applicationNumber || ""}
                    onClick={() =>
                      history.push(`/applications/actions/${row.application}`)
                    }
                  >
                    {row.applicationNumber || "—"}
                  </button>
                ) : (
                  <span className="whitespace-nowrap">
                    {row.applicationNumber || "—"}
                  </span>
                )}
                {row.quotationRef ? (
                  <button
                    type="button"
                    className="block text-xs text-[var(--p-blue)] hover:underline mt-0.5"
                    onClick={() => setDetailRow(row)}
                  >
                    {row.quotationRef}
                  </button>
                ) : null}
              </td>
              <td className="py-2 px-4">
                <div className="font-medium text-gray-900">
                  {row.companyName || "—"}
                </div>
                <div className="text-xs text-gray-500">
                  {row.productName || ""}
                </div>
              </td>
              <td className="py-2 px-4 whitespace-nowrap text-sm">
                {row.preparedByName || "—"}
              </td>
              <td className="py-2 px-4 whitespace-nowrap text-sm">
                {row.approvedByName || "—"}
              </td>
              <td className="py-2 px-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">
                  {money(
                    row.grandTotalValue != null
                      ? row.grandTotalValue
                      : row.grandTotal,
                  )}
                </div>
                {row.discountValue ? (
                  <div className="text-xs text-gray-500">
                    after {money(row.discountValue)} discount
                  </div>
                ) : null}
              </td>
              <td className="py-2 px-4 whitespace-nowrap">
                {getStatusBadge(row.status)}
              </td>
              <td className="py-2 px-4 whitespace-nowrap text-sm">
                {formatDate(row.updatedAt)}
              </td>
              <td className="py-2 px-4">
                <ActionButtons
                  maxVisibleActions={2}
                  items={[
                    ...(row.quotationRef
                      ? [
                          {
                            action: ACTION_BUTTON_TYPES.VIEW,
                            title: "View quotation",
                            onClick: () => setDetailRow(row),
                          },
                        ]
                      : []),
                    {
                      action: ACTION_BUTTON_TYPES.WORKFLOW,
                      title: "Open actions",
                      onClick: () =>
                        history.push(
                          `/applications/actions/${row.application}`,
                        ),
                    },
                  ]}
                />
              </td>
            </tr>
          )}
        />
      </div>

      <QuotationDetail
        row={detailRow}
        open={Boolean(detailRow)}
        onClose={() => setDetailRow(null)}
      />
    </div>
  );
};

export default CostingSheets;
