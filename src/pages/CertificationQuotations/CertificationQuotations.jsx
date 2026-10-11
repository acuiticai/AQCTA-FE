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

const FORM_KEY = "FOR-01-06";

const DECISION_OPTIONS = [
  { value: "Pending", label: "Awaiting customer" },
  { value: "Accepted", label: "Accepted" },
  { value: "Rejected", label: "Declined" },
];

const DECISION_STYLES = {
  "Awaiting customer": "bg-amber-100 text-amber-800",
  Accepted: "bg-emerald-100 text-emerald-800",
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

const money = (value) =>
  `RM ${Number(value || 0).toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/**
 * PARKED — AQCTA certification quotations (FOR-01-07).
 *
 * Finance → Quotations now uses the Flexa Accounts Quotations module at
 * `/quotations` (shared DocumentTemplate PDF). This page remains at
 * `/certification-quotations` only as a fallback; do not wire it into the
 * sidebar until product asks to revive the AQCTA quotation UI/PDF.
 *
 * Every quotation issued off an approved costing sheet. The figures are fixed
 * at approval and the customer's own accept or decline is the only state that
 * moves, so this screen reads rather than edits — which is why it does not
 * reuse the sales module's quotation editor.
 */
const CertificationQuotations = () => {
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
  const [decisionFilter, setDecisionFilter] = useState("all");
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
    "Quotation",
    "Customer / Product",
    "Application",
    "Amount",
    "Decision",
    "Project",
    "Issued",
    "Actions",
  ];

  const colWidths = {
    Quotation: "160px",
    "Customer / Product": "220px",
    Application: "150px",
    Amount: "140px",
    Decision: "150px",
    Project: "140px",
    Issued: "120px",
    Actions: "100px",
  };

  const fetchQuotations = async () => {
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
          hasQuotation: "true",
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
        error?.response?.data?.message || "Failed to load quotations",
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
    fetchQuotations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminInfo?.token, currentPage, recordsPerPage]);

  useEffect(() => {
    if (!adminInfo?.token) return;
    const timeoutId = setTimeout(() => {
      setCurrentPage(1);
      fetchQuotations();
    }, 400);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  /* The decision is a property of the submission rather than a query the API
     supports, so this filter is applied to the page in hand. */
  const visibleRows = useMemo(() => {
    if (decisionFilter === "all") return rows;
    if (decisionFilter === "Pending") {
      return rows.filter((r) => !r.quotationDecision);
    }
    return rows.filter((r) => r.quotationDecision === decisionFilter);
  }, [rows, decisionFilter]);

  const getDecisionBadge = (decision) => {
    const label = decision || "Awaiting customer";
    return (
      <span
        className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
          DECISION_STYLES[label] || "bg-gray-100 text-gray-800"
        }`}
      >
        {label === "Rejected" ? "Declined" : label}
      </span>
    );
  };

  const clearAllFilters = () => {
    setSearchTerm("");
    setDecisionFilter("all");
    setCurrentPage(1);
  };

  const filters = [
    {
      isClearButton: true,
      buttonProps: { onClick: clearAllFilters },
    },
    {
      label: "Decision",
      value: decisionFilter,
      onChange: (value) => {
        setDecisionFilter(value);
      },
      options: [
        { value: "all", label: "All Quotations" },
        ...DECISION_OPTIONS,
      ],
      placeholder: "Select Decision",
      icon: FileText,
    },
  ];

  const decided = (d) => rows.filter((r) => r.quotationDecision === d).length;

  const summaryCardsData = [
    {
      title: "Total Quotations",
      value: total || 0,
      backgroundColor: "summary-light",
      iconColor: "summary-dark",
      Icon: SummarySvg,
    },
    {
      title: "Awaiting Customer",
      value: rows.filter((r) => !r.quotationDecision).length,
      backgroundColor: "processing-light",
      iconColor: "processing-dark",
      Icon: PendingApprovalSvg,
    },
    {
      title: "Accepted",
      value: decided("Accepted"),
      backgroundColor: "completed-light",
      iconColor: "completed-dark",
      Icon: CompletedSvg,
    },
    {
      title: "Declined",
      value: decided("Rejected"),
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
              <h1 className="text-3xl font-bold text-gray-900">Quotations</h1>
              <p className="text-gray-600 mt-2">
                AQCTA-FOR-01-07, issued to the customer when a costing sheet
                is approved. Accepting one opens the certification project.
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
          data={visibleRows}
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
            <tr key={row._id || row.quotationRef} className="border-b">
              <td className="py-2 px-4 whitespace-nowrap">
                <button
                  type="button"
                  className="text-[var(--p-blue)] hover:underline font-medium text-left whitespace-nowrap"
                  onClick={() => setDetailRow(row)}
                >
                  {row.quotationRef || "—"}
                </button>
              </td>
              <td className="py-2 px-4">
                <div className="font-medium text-gray-900">
                  {row.companyName || "—"}
                </div>
                <div className="text-xs text-gray-500">
                  {row.productName || ""}
                </div>
              </td>
              <td className="py-2 px-4 whitespace-nowrap">
                {row.application ? (
                  <button
                    type="button"
                    className="text-[var(--p-blue)] hover:underline text-sm text-left"
                    onClick={() =>
                      history.push(`/applications/actions/${row.application}`)
                    }
                  >
                    {row.applicationNumber || "—"}
                  </button>
                ) : (
                  <span className="text-sm">{row.applicationNumber || "—"}</span>
                )}
              </td>
              <td className="py-2 px-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">
                  {money(row.grandTotal)}
                </div>
                {row.discount ? (
                  <div className="text-xs text-gray-500">
                    after {money(row.discount)} discount
                  </div>
                ) : null}
              </td>
              <td className="py-2 px-4 whitespace-nowrap">
                {getDecisionBadge(row.quotationDecision)}
              </td>
              <td className="py-2 px-4 whitespace-nowrap text-sm">
                {row.projectId ? (
                  <button
                    type="button"
                    className="text-[var(--p-blue)] hover:underline text-left"
                    onClick={() => history.push(`/projects/${row.projectId}`)}
                  >
                    {row.projectNumber || "—"}
                  </button>
                ) : (
                  row.projectNumber || "—"
                )}
              </td>
              <td className="py-2 px-4 whitespace-nowrap text-sm">
                {formatDate(row.issuedAt)}
              </td>
              <td className="py-2 px-4">
                <ActionButtons
                  maxVisibleActions={1}
                  items={[
                    {
                      action: ACTION_BUTTON_TYPES.VIEW,
                      title: "View quotation",
                      onClick: () => setDetailRow(row),
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

export default CertificationQuotations;
