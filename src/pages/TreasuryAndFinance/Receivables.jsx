import React, { useState, useEffect, useRef } from "react";
import { useHistory } from "react-router-dom";
import axios from "axios";
import { formatDate, formatAmount } from "@/components/formatAmount";
import { ActionButtons } from "@/page-layouts";
import EpcListPage from "@/components/Epc/EpcListPage";
import StatusPill from "@/customer/components/ui/StatusPill";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";
import {
  isSingleAssignedBusiness,
  syncAssignedBusinessesFromApi,
} from "@/utils/sessionAssignedBusinesses";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const Receivables = () => {
  const history = useHistory();
  const [selectedBusiness, setSelectedBusiness] = useState("");
  const [businesses, setBusinesses] = useState([]);
  const [receivables, setReceivables] = useState([]);
  const [totalResults, setTotalResults] = useState(0);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const currentPageRef = useRef(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchReceivables = async (
    businessId = "",
    page = 1,
    limit = recordsPerPage,
    search = "",
    status = ""
  ) => {
    const params = {
      businessId,
      page,
      limit,
      search,
      status: "Collection Scheduled", // We only want receivables with this status
    };
    try {
      setLoading(true);
      const response = await axios.get(`${Base_URL}/auth-requests`, { params });
      console.log("receivables!", response.data.data);
      setReceivables(response.data.data);
      setTotalResults(response.data.count);
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await syncAssignedBusinessesFromApi(Base_URL);
      if (cancelled) return;
      setBusinesses(list);
      const preselected = list.length === 1 ? list[0]._id : "";
      setSelectedBusiness(preselected);
      fetchReceivables(preselected, 1, recordsPerPage, "", "");
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    currentPageRef.current = page;
    fetchReceivables(
      selectedBusiness,
      page,
      recordsPerPage,
      searchTerm,
      statusFilter
    );
  };

  const onChange = async (value) => {
    console.log("value", value);
    setSelectedBusiness(value);
    setCurrentPage(1);
    currentPageRef.current = 1;
    fetchReceivables(value, 1, recordsPerPage, searchTerm, statusFilter);
  };

  const handleSearch = (value) => {
    setSearchTerm(value);
    setCurrentPage(1);
    currentPageRef.current = 1;
    fetchReceivables(selectedBusiness, 1, recordsPerPage, value, statusFilter);
  };

  const handleStatusChange = (value) => {
    setStatusFilter(value);
    setCurrentPage(1);
    currentPageRef.current = 1;
    fetchReceivables(selectedBusiness, 1, recordsPerPage, searchTerm, value);
  };

  const handleCategoryChange = (value) => {
    setCategoryFilter(value);
    // Add category filtering logic when backend support is available
  };

  const handleRecordPayment = (receivable) => {
    // Navigate to invoice viewer with state to auto-open payment modal
    history.push({
      pathname: `/view-customer-invoice/${receivable._id}`,
      state: {
        fromReceivables: true,
        autoOpenPaymentModal: true,
      },
    });
  };

  const clearAllFilters = () => {
    const preselected = businesses.length === 1 ? businesses[0]._id : "";
    setSelectedBusiness(preselected);
    setStatusFilter("");
    setCategoryFilter("");
    setSearchTerm("");
    setCurrentPage(1);
    currentPageRef.current = 1;
    fetchReceivables(preselected, 1, recordsPerPage, "", "");
  };

  const columns = [
    {
      key: "invoice",
      header: "Invoice No",
      render: (row) => (
        <span className="epc-cell__primary">{row.invoice_number || "—"}</span>
      ),
    },
    {
      key: "contract",
      header: "Sales Contract No",
      render: (row) => (
        <span className="epc-cell__secondary">
          {row.contract_id?.contractNo || "—"}
        </span>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      render: (row) => (
        <span className="epc-cell__primary">{row.customer_name || "—"}</span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      render: (row) => formatAmount(row.subTotal),
    },
    {
      key: "dueDate",
      header: "Due Date",
      render: (row) => formatDate(row.due_date),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusPill status={row.status || "—"} />,
    },
    {
      key: "actions",
      header: "Action",
      align: "right",
      render: (row) => (
        <ActionButtons
          maxVisibleActions={2}
          items={[
            {
              action: ACTION_BUTTON_TYPES.VIEW,
              title: "Record Payment",
              onClick: () => handleRecordPayment(row),
            },
          ]}
        />
      ),
    },
  ];

  const portalFilters = [
    {
      key: "status",
      placeholder: "Transaction Type",
      options: [
        { value: "", label: "All" },
        { value: "Collection Scheduled", label: "Collection Scheduled" },
        { value: "Paid", label: "Paid" },
      ],
    },
    {
      key: "category",
      placeholder: "Category",
      options: [
        { value: "", label: "All" },
        { value: "invoice", label: "Invoice" },
        { value: "contract", label: "Contract" },
      ],
    },
    ...(!isSingleAssignedBusiness()
      ? [
          {
            key: "business",
            placeholder: "All Businesses",
            options: [
              { value: "", label: "All Businesses" },
              ...businesses.map((b) => ({ value: b._id, label: b.name })),
            ],
          },
        ]
      : []),
  ];

  return (
    <EpcListPage
      title="Receivables"
      subtitle="Track collection-scheduled invoices and record payments."
      searchValue={searchTerm}
      searchPlaceholder="Search receivables"
      onSearchChange={handleSearch}
      filterSubtitle="Narrow by transaction type, category or business."
      filters={portalFilters}
      filterValues={{
        status: statusFilter,
        category: categoryFilter,
        business: selectedBusiness || "",
      }}
      onFilterChange={(key, value) => {
        if (key === "status") handleStatusChange(value || "");
        else if (key === "category") handleCategoryChange(value || "");
        else if (key === "business") onChange(value || "");
      }}
      onFilterReset={clearAllFilters}
      tableTitle="Receivables"
      tableSubtitle={
        loading ? "Loading…" : `${totalResults} total receivables`
      }
      columns={columns}
      rows={receivables}
      rowKey="_id"
      loading={loading}
      emptyMessage="No receivables found"
      page={currentPage}
      pageSize={recordsPerPage}
      total={totalResults}
      itemLabel="receivables"
      onPageChange={handlePageChange}
      onPageSizeChange={(value) => {
        setRecordsPerPage(value);
        currentPageRef.current = 1;
        setCurrentPage(1);
        fetchReceivables(selectedBusiness, 1, value, searchTerm, statusFilter);
      }}
    />
  );
};

export default Receivables;
