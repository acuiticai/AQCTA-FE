import React, { useState, useEffect, useRef } from "react";
import { formatDate, formatAmount } from "@/components/formatAmount";
import EpcListPage from "@/components/Epc/EpcListPage";
import Button from "@/customer/components/ui/Button";
import StatusPill from "@/customer/components/ui/StatusPill";
import {
  CheckCircleIcon,
  ClockIcon,
  InvoiceIcon,
  PlusIcon,
} from "@/customer/components/ui/icons";
import CustomerInvoiceServices from "@/services/CustomerInvoiceServices";
import RecordPaymentModal from "./components/RecordPaymentModal";
import {
  isSingleAssignedBusiness,
  syncAssignedBusinessesFromApi,
} from "@/utils/sessionAssignedBusinesses";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const Payments = () => {
  const [selectedBusiness, setSelectedBusiness] = useState("");
  const [businesses, setBusinesses] = useState([]);
  const [businessesReady, setBusinessesReady] = useState(false);
  const [payments, setPayments] = useState([]);
  const [allPayments, setAllPayments] = useState([]); // Store all fetched payments for client-side filtering
  const [totalResults, setTotalResults] = useState(0);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const currentPageRef = useRef(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);

  // Modal State
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);

  // Stats State
  const [stats, setStats] = useState({
    total: 0,
    paid: 0,
    pending: 0,
  });

  // Fetch invoices and extract payments
  const fetchPayments = async (businessId = selectedBusiness) => {
    setLoading(true);
    try {
      // Fetch invoices
      const params = {
        limit: 1000,
        business_id: businessId || "",
      };

      const response = await CustomerInvoiceServices.getAllInvoices(params);
      const invoices = response.data.data || [];

      // Calculate Stats based on INVOICES (as per requirement: "Total Invoices", "Paid Invoices", "Pending Invoices")
      const totalInvoicesCount = invoices.length;
      const paidInvoicesCount = invoices.filter(
        (inv) => inv.status === "Paid"
      ).length;
      const pendingInvoicesCount = invoices.filter(
        (inv) => inv.status !== "Paid" && inv.status !== "Cancelled"
      ).length;

      setStats({
        total: totalInvoicesCount,
        paid: paidInvoicesCount,
        pending: pendingInvoicesCount,
      });

      // Extract payments
      const extractedPayments = invoices.reduce((acc, invoice) => {
        if (invoice.payments && invoice.payments.length > 0) {
          const invPayments = invoice.payments.map((payment) => ({
            ...payment,
            _id: payment._id || `${invoice._id}-${payment.date || Date.now()}`,
            invoice_number: invoice.invoice_number,
            customer_name:
              invoice.customer_name ||
              invoice.customer_id?.basicInformation?.customerDisplayName,
            invoice_id: invoice._id,
            payment_date: payment.date,
            payment_method: payment.mode || payment.paymentMode || "Unknown",
            amount_paid: payment.amount,
            currency: invoice.currency || "USD", // Include currency
            status: invoice.status || "", // Show invoice status as requested (e.g. Partially Paid)
          }));
          return [...acc, ...invPayments];
        }
        return acc;
      }, []);

      // Sort by date descending
      extractedPayments.sort(
        (a, b) => new Date(b.payment_date) - new Date(a.payment_date)
      );

      setAllPayments(extractedPayments);
      filterAndPaginate(
        extractedPayments,
        currentPage,
        recordsPerPage,
        searchTerm,
        statusFilter
      );
    } catch (error) {
      console.error("Error fetching payments:", error);
      setPayments([]);
      setTotalResults(0);
    } finally {
      setLoading(false);
    }
  };

  const filterAndPaginate = (data, page, limit, search, status) => {
    let filteredData = data;

    if (search) {
      const lowerSearch = search.toLowerCase();
      filteredData = filteredData.filter(
        (item) =>
          (item.invoice_number &&
            item.invoice_number.toLowerCase().includes(lowerSearch)) ||
          (item.customer_name &&
            item.customer_name.toLowerCase().includes(lowerSearch))
      );
    }

    if (status) {
      filteredData = filteredData.filter((item) => item.status === status);
    }

    setTotalResults(filteredData.length);

    // Client-side pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedData = filteredData.slice(startIndex, endIndex);

    setPayments(paginatedData);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await syncAssignedBusinessesFromApi(Base_URL);
      if (cancelled) return;
      setBusinesses(list);
      const preselected = list.length === 1 ? list[0]._id : "";
      setSelectedBusiness(preselected);
      setBusinessesReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!businessesReady) return;
    fetchPayments(selectedBusiness);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBusiness, businessesReady]);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    currentPageRef.current = page;
    filterAndPaginate(
      allPayments,
      page,
      recordsPerPage,
      searchTerm,
      statusFilter
    );
  };

  const onChange = async (value) => {
    setSelectedBusiness(value);
    setCurrentPage(1);
    currentPageRef.current = 1;
  };

  const handleSearch = (value) => {
    setSearchTerm(value);
    setCurrentPage(1);
    currentPageRef.current = 1;
    filterAndPaginate(allPayments, 1, recordsPerPage, value, statusFilter);
  };

  const clearAllFilters = () => {
    const preselected = businesses.length === 1 ? businesses[0]._id : "";
    setSelectedBusiness(preselected);
    setSearchTerm("");
    setStatusFilter("");
    setCurrentPage(1);
    currentPageRef.current = 1;
    filterAndPaginate(allPayments, 1, recordsPerPage, "", "");
  };

  const portalStats = [
    {
      icon: InvoiceIcon,
      label: "Total Invoices",
      value: String(stats.total),
      note: "All time",
      tone: "brand",
    },
    {
      icon: CheckCircleIcon,
      label: "Paid Invoices",
      value: String(stats.paid),
      note: "Fully Paid",
      noteTone: "success",
      tone: "success",
    },
    {
      icon: ClockIcon,
      label: "Pending Invoices",
      value: String(stats.pending),
      note: "Unpaid / Partial",
      noteTone: "warning",
      tone: "warning",
    },
  ];

  const columns = [
    {
      key: "invoice",
      header: "Invoice No",
      render: (row) => (
        <span className="epc-cell__primary">{row.invoice_number || "—"}</span>
      ),
    },
    {
      key: "customer",
      header: "Customer Name",
      render: (row) => (
        <span className="epc-cell__primary">{row.customer_name || "—"}</span>
      ),
    },
    {
      key: "paymentDate",
      header: "Payment Date",
      render: (row) => formatDate(row.paymentDate),
    },
    {
      key: "method",
      header: "Payment Method",
      render: (row) => row.payment_method || "—",
    },
    {
      key: "amount",
      header: "Amount Paid",
      render: (row) => (
        <span className="epc-cell__primary">
          {row.currency} {formatAmount(row.amount_paid)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusPill status={row.status || "—"} />,
    },
  ];

  const portalFilters = [
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
      title="Payment Received"
      subtitle="Payments recorded against customer invoices."
      action={
        <Button onClick={() => setShowRecordPaymentModal(true)}>
          <PlusIcon size={15} />
          Record Payment
        </Button>
      }
      stats={portalStats}
      searchValue={searchTerm}
      searchPlaceholder="Search Invoice or Customer"
      onSearchChange={handleSearch}
      filterSubtitle="Filter by business or search invoice and customer."
      filters={portalFilters}
      filterValues={{ business: selectedBusiness || "" }}
      onFilterChange={(key, value) => {
        if (key === "business") onChange(value || "");
      }}
      onFilterReset={clearAllFilters}
      tableTitle="Payments"
      tableSubtitle={loading ? "Loading…" : `${totalResults} total payments`}
      columns={columns}
      rows={payments}
      rowKey="_id"
      loading={loading}
      emptyMessage="No payments found"
      page={currentPage}
      pageSize={recordsPerPage}
      total={totalResults}
      itemLabel="payments"
      onPageChange={handlePageChange}
      onPageSizeChange={(value) => {
        setRecordsPerPage(value);
        setCurrentPage(1);
        currentPageRef.current = 1;
        filterAndPaginate(allPayments, 1, value, searchTerm, statusFilter);
      }}
    >
      <RecordPaymentModal
        isOpen={showRecordPaymentModal}
        onClose={() => setShowRecordPaymentModal(false)}
        onPaymentComplete={fetchPayments}
      />
    </EpcListPage>
  );
};

export default Payments;
