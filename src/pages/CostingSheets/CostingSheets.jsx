import React, { useContext, useEffect, useMemo, useState } from "react";
import { useHistory } from "react-router-dom";
import { ActionButtons } from "@/page-layouts";
import EpcListPage from "@/components/Epc/EpcListPage";
import QuotationDetail from "@/components/Certification/QuotationDetail";
import StatusPill from "@/customer/components/ui/StatusPill";
import {
  CheckCircleIcon,
  ClockIcon,
  DocumentIcon,
  FileIcon,
} from "@/customer/components/ui/icons";
import { notifyError } from "@/utils/toast";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";
import { AdminContext } from "@/context/AdminContext";
import useCheckTokenExpired from "@/hooks/useCheckTokenExpired";
import ApplicationServices from "@/services/ApplicationServices";

const FORM_KEY = "costing";

const STATUS_OPTIONS = ["Draft", "Pending Approval", "Approved", "Rejected"];

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
  const [statusFilter, setStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [detailRow, setDetailRow] = useState(null);

  const authHeaders = useMemo(
    () => ({
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo?.token}`,
    }),
    [adminInfo?.token],
  );

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
          status: statusFilter || undefined,
        },
        {
          headers: authHeaders,
          withCredentials: true,
        },
      );
      if (checkTokenExpired(response)) return;

      setRows(Array.isArray(response.data?.data) ? response.data.data : []);
      setTotal(response.data?.meta?.total || 0);
    } catch (error) {
      notifyError(
        error?.response?.data?.message || "Failed to load costing sheets",
      );
      setRows([]);
      setTotal(0);
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

  const countOf = (status) => rows.filter((r) => r.status === status).length;

  const stats = [
    {
      icon: DocumentIcon,
      label: "Costing sheets",
      value: String(total || 0),
      tone: "brand",
    },
    {
      icon: ClockIcon,
      label: "Pending approval",
      value: String(countOf("Pending Approval")),
      tone: "warning",
    },
    {
      icon: CheckCircleIcon,
      label: "Approved",
      value: String(countOf("Approved")),
      tone: "success",
    },
    {
      icon: FileIcon,
      label: "Returned",
      value: String(countOf("Rejected")),
      tone: "info",
    },
  ];

  const columns = [
    {
      key: "application",
      header: "Application",
      width: "16%",
      render: (row) => (
        <>
          {row.application ? (
            <button
              type="button"
              className="epc-cell__link"
              title={row.applicationNumber || ""}
              onClick={() =>
                history.push(`/applications/actions/${row.application}`)
              }
            >
              {row.applicationNumber || "—"}
            </button>
          ) : (
            <span className="epc-cell__primary">
              {row.applicationNumber || "—"}
            </span>
          )}
          {row.quotationRef ? (
            <button
              type="button"
              className="epc-cell__link"
              style={{ display: "block", fontSize: 12, marginTop: 2 }}
              onClick={() => setDetailRow(row)}
            >
              {row.quotationRef}
            </button>
          ) : null}
        </>
      ),
    },
    {
      key: "customer",
      header: "Customer / Product",
      width: "18%",
      render: (row) => (
        <>
          <div className="epc-cell__primary">{row.companyName || "—"}</div>
          {row.productName ? (
            <div className="epc-cell__secondary">{row.productName}</div>
          ) : null}
        </>
      ),
    },
    {
      key: "preparedBy",
      header: "Prepared by",
      width: "12%",
      render: (row) => row.preparedByName || "—",
    },
    {
      key: "approvedBy",
      header: "Approved by",
      width: "12%",
      render: (row) => row.approvedByName || "—",
    },
    {
      key: "grandTotal",
      header: "Grand total",
      width: "12%",
      render: (row) => (
        <>
          <div className="epc-cell__primary">
            {money(
              row.grandTotalValue != null ? row.grandTotalValue : row.grandTotal,
            )}
          </div>
          {row.discountValue ? (
            <div className="epc-cell__secondary">
              after {money(row.discountValue)} discount
            </div>
          ) : null}
        </>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "12%",
      render: (row) => <StatusPill status={row.status || "—"} />,
    },
    {
      key: "updated",
      header: "Updated",
      width: "10%",
      render: (row) => formatDate(row.updatedAt),
    },
    {
      key: "actions",
      header: "Actions",
      width: "10%",
      align: "right",
      render: (row) => (
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
                history.push(`/applications/actions/${row.application}`),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <EpcListPage
      title="Costing Sheet"
      subtitle="Certification (AQCTA-FOR-01-06) and inspection (AQCTA-FOR-06-02) costing sheets. One system user prices the work, another approves it, which issues the quotation."
      stats={stats}
      searchValue={searchTerm}
      searchPlaceholder="Search by application, customer or product…"
      onSearchChange={(value) => {
        setSearchTerm(value);
        setCurrentPage(1);
      }}
      filterSubtitle="Narrow by status or search reference."
      filters={[
        {
          key: "status",
          placeholder: "All Statuses",
          options: STATUS_OPTIONS,
        },
      ]}
      filterValues={{ status: statusFilter }}
      onFilterChange={(key, value) => {
        if (key === "status") {
          setStatusFilter(value || "");
          setCurrentPage(1);
        }
      }}
      onFilterReset={() => {
        setSearchTerm("");
        setStatusFilter("");
        setCurrentPage(1);
      }}
      tableTitle="Costing sheets"
      tableSubtitle={
        loading ? "Loading…" : `${total} total costing sheets`
      }
      columns={columns}
      rows={rows}
      rowKey={(row) => row._id || row.application}
      loading={loading}
      emptyMessage="No costing sheets match these filters."
      page={currentPage}
      pageSize={recordsPerPage}
      total={total}
      itemLabel="costing sheets"
      onPageChange={setCurrentPage}
      onPageSizeChange={(perPage) => {
        setRecordsPerPage(perPage);
        setCurrentPage(1);
      }}
    >
      <QuotationDetail
        row={detailRow}
        open={Boolean(detailRow)}
        onClose={() => setDetailRow(null)}
      />
    </EpcListPage>
  );
};

export default CostingSheets;
