import React, { useContext, useEffect, useMemo, useState } from "react";

import EpcListPage from "@/components/Epc/EpcListPage";
import InvoiceDetail from "@/components/Certification/InvoiceDetail";
import Button from "@/customer/components/ui/Button";
import StatusPill from "@/customer/components/ui/StatusPill";
import {
  CheckCircleIcon,
  ClockIcon,
  EyeIcon,
  InvoiceIcon,
  WalletIcon,
} from "@/customer/components/ui/icons";
import { notifyError } from "@/utils/toast";
import { AdminContext } from "@/context/AdminContext";
import useCheckTokenExpired from "@/hooks/useCheckTokenExpired";
import ProjectServices from "@/services/ProjectServices";

const formatDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
};

const money = (value, currency = "MYR") =>
  `${currency === "MYR" ? "RM" : currency} ${Number(value || 0).toLocaleString(
    "en-MY",
    { minimumFractionDigits: 2, maximumFractionDigits: 2 },
  )}`;

/**
 * Finance → Invoices (certification)
 *
 * Every invoice raised against a certification project. Kept separate from the
 * platform's general ledger: those post into the sales chain, while these are
 * raised against a project and fixed once issued.
 */
const Invoices = () => {
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const checkTokenExpired = useCheckTokenExpired();

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ status: "" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [detailRow, setDetailRow] = useState(null);

  const request = useMemo(
    () => ({
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${adminInfo?.token}`,
      },
      withCredentials: true,
    }),
    [adminInfo?.token],
  );

  const load = async () => {
    if (!adminInfo?.token) return;
    setLoading(true);
    try {
      const res = await ProjectServices.getAllInvoices(
        { page, limit: pageSize, search, status: filters.status },
        request,
      );
      if (checkTokenExpired(res)) return;
      setRows(Array.isArray(res.data?.data) ? res.data.data : []);
      setTotal(res.data?.meta?.total || 0);
    } catch (error) {
      notifyError(error?.response?.data?.message || "Failed to load invoices");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, search, filters.status, adminInfo?.token]);

  const countOf = (status) => rows.filter((r) => r.invoiceStatus === status).length;
  const billed = rows.reduce((sum, r) => sum + Number(r.contractValue || 0), 0);

  const stats = [
    { icon: InvoiceIcon, label: "Invoices", value: String(total), tone: "brand" },
    {
      icon: ClockIcon,
      label: "Raised",
      value: String(countOf("Raised")),
      tone: "warning",
    },
    {
      icon: CheckCircleIcon,
      label: "Paid",
      value: String(countOf("Paid")),
      tone: "success",
    },
    {
      icon: WalletIcon,
      label: "Value on this page",
      value: money(billed),
      tone: "info",
    },
  ];

  const columns = [
    {
      key: "invoiceNumber",
      header: "Invoice",
      render: (row) => (
        <button
          type="button"
          className="epc-cell__link"
          onClick={() => setDetailRow(row)}
        >
          {row.invoiceNumber}
        </button>
      ),
    },
    {
      key: "companyName",
      header: "Customer",
      render: (row) => (
        <>
          <div className="epc-cell__primary">{row.companyName || "—"}</div>
          <div className="epc-cell__secondary">
            {row.projectNumber} · {row.applicationNumber}
          </div>
        </>
      ),
    },
    {
      key: "quotationRef",
      header: "Quotation",
      render: (row) => row.quotationRef || "—",
    },
    {
      key: "contractValue",
      header: "Amount",
      render: (row) => money(row.contractValue, row.currency),
    },
    {
      key: "invoiceStatus",
      header: "Status",
      render: (row) => <StatusPill status={row.invoiceStatus} />,
    },
    {
      key: "invoiceRaisedAt",
      header: "Raised",
      render: (row) => formatDate(row.invoiceRaisedAt),
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button variant="secondary" onClick={() => setDetailRow(row)}>
            <EyeIcon size={15} /> View
          </Button>
        </div>
      ),
    },
  ];

  return (
    <EpcListPage
      title="Invoices"
      subtitle="Raised against certification projects when a quotation is accepted."
      stats={stats}
      searchValue={search}
      searchPlaceholder="Search by invoice, project, customer or product…"
      onSearchChange={(value) => {
        setSearch(value);
        setPage(1);
      }}
      filters={[
        {
          key: "status",
          placeholder: "All statuses",
          options: ["Raised", "Paid", "Cancelled"],
        },
      ]}
      filterValues={filters}
      onFilterChange={(key, value) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
        setPage(1);
      }}
      onFilterReset={() => {
        setFilters({ status: "" });
        setSearch("");
        setPage(1);
      }}
      tableTitle="Invoices"
      columns={columns}
      rows={rows}
      loading={loading}
      emptyMessage="No invoices match this search."
      page={page}
      pageSize={pageSize}
      total={total}
      itemLabel="invoices"
      onPageChange={setPage}
      onPageSizeChange={(size) => {
        setPageSize(size);
        setPage(1);
      }}
    >
      <InvoiceDetail
        row={detailRow}
        open={Boolean(detailRow)}
        onClose={() => setDetailRow(null)}
      />
    </EpcListPage>
  );
};

export default Invoices;
