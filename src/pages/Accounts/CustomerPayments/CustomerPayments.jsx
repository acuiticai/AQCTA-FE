import React, { useState, useEffect, useContext } from "react";
import { useHistory } from "react-router-dom";
import axios from "axios";
import { AdminContext } from "@/context/AdminContext";
import { useRouteModulePermissions } from "@/utils/permissionUtils";
import {
  DataTable,
  SummaryCards,
  DateRangeComponent,
} from "@/page-layouts/index";
import { formatDate, formatAmount, formatCurrencyAmount } from "@/components/formatAmount";
import { useTranslation } from "react-i18next";
import {
  Eye,
  Download,
  Search,
  Calendar,
  ChevronDown,
  Building,
  User,
  CreditCard,
  DollarSign,
  TrendingUp,
  FileSpreadsheet as ExcelIcon,
  Loader2,
  Trash2,
} from "lucide-react";
import * as XLSX from "xlsx";
import { notifyError, notifySuccess } from "@/utils/toast";
import { getCurrencyConversionDisplayLine } from "@/utils/currencyConversionDisplay";
import { isSingleAssignedBusiness } from "@/utils/sessionAssignedBusinesses";
import { downloadPaymentReceiptSlip } from "@/utils/paymentReceiptFromTemplate";
import PaymentDetailsModal from "./components/PaymentDetailsModal";
import CustomerInvoiceServices from "@/services/CustomerInvoiceServices";
import CompletedSvg from "@/assets/img/completed.svg";
import InProgressSvg from "@/assets/img/in-progress.svg";
import PendingApprovalSvg from "@/assets/img/pending-approval.svg";
import DelayedSvg from "@/assets/img/delayed.svg";
import SummarySvg from "@/assets/img/summary.svg";
import DollarSvg from "../../../assets/img/icons/stats-1.png";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const CustomerPayments = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;

  const routePerms = useRouteModulePermissions();
  const { canView, canViewDetails, canDelete } = routePerms;
  const canViewPayment = canView || canViewDetails;

  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo?.token}`,
  };

  const [payments, setPayments] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [showPaymentDetails, setShowPaymentDetails] = useState(false);
  const [businesses, setBusinesses] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedBusinessFilter, setSelectedBusinessFilter] = useState("");
  const [selectedCustomerFilter, setSelectedCustomerFilter] = useState("");
  const [selectedPaymentTypeFilter, setSelectedPaymentTypeFilter] =
    useState("All");
  const [selectedDateFilter, setSelectedDateFilter] = useState("");
  const [dateRangeStart, setDateRangeStart] = useState("");
  const [dateRangeEnd, setDateRangeEnd] = useState("");
  const [loading, setLoading] = useState(true);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [pendingDeletePayment, setPendingDeletePayment] = useState(null);
  const [businessesLoading, setBusinessesLoading] = useState(true);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [downloadingReceiptId, setDownloadingReceiptId] = useState(null);
  const [overallStats, setOverallStats] = useState({
    totalPayments: 0,
    totalAmount: 0,
    bankTransferPayments: 0,
    moneyChangerPayments: 0,
    moneyChangerOverpaymentAmount: 0,
  });

  // Clear all filters function
  const clearAllFilters = () => {
    setSelectedBusinessFilter("");
    setSelectedCustomerFilter("");
    setSelectedPaymentTypeFilter("All");
    setSelectedDateFilter("");
    setDateRangeStart("");
    setDateRangeEnd("");
    setSearchTerm("");
    setCurrentPage(1);
  };

  const filters = [
    {
      isClearButton: true,
      buttonProps: {
        onClick: () => {
          clearAllFilters();
          setCurrentPage(1);
        },
      },
    },
    ...(!isSingleAssignedBusiness()
      ? [
          {
            label: t("accounts.customerPayments.business"),
            value: selectedBusinessFilter,
            onChange: (val) => {
              setSelectedBusinessFilter(val);
              setCurrentPage(1);
            },
            options: businesses.map((b) => ({
              value: b._id,
              label: b.name,
            })),
            placeholder: t("accounts.customerPayments.selectBusiness"),
            icon: Building,
          },
        ]
      : []),
    {
      label: t("accounts.customerPayments.customer"),
      value: selectedCustomerFilter,
      onChange: (val) => {
        setSelectedCustomerFilter(val);
        setCurrentPage(1);
      },
      options: customers.map((c) => ({
        value: c._id,
        label:
          c.basicInformation?.customerDisplayName ??
          c.basicInformation?.companyName ??
          "—",
      })),
      placeholder: t("accounts.customerPayments.selectCustomer"),
      icon: User,
    },
    {
      label: t("accounts.customerPayments.paymentType"),
      value: selectedPaymentTypeFilter,
      onChange: (val) => {
        setSelectedPaymentTypeFilter(val);
        setCurrentPage(1);
      },
      options: [
        { value: "All", label: t("accounts.customerPayments.allTypes") },
        {
          value: "Bank Transfer",
          label: t("accounts.customerPayments.bankTransfer"),
        },
        {
          value: "Money Changer",
          label: t("accounts.customerPayments.moneyChanger"),
        },
        { value: "Cash", label: t("accounts.customerPayments.cash") },
        { value: "Check", label: t("accounts.customerPayments.check") },
        {
          value: "Customer Credit",
          label: t("accounts.customerPayments.customerCredit"),
        },
      ],
      placeholder: `${t("accounts.customerPayments.paymentType")}: ${t("accounts.customerPayments.allTypes")}`,
      icon: CreditCard,
    },
    {
      label: t("accounts.customerPayments.paymentDate"),
      value: selectedDateFilter,
      onChange: (val) => {
        setSelectedDateFilter(val);
        setCurrentPage(1);
      },
      isDatePicker: true,
      placeholder: t("accounts.customerPayments.paymentDate"),
      icon: Calendar,
    },
  ];

  const fetchPayments = async () => {
    if (businesses.length === 0) {
      setLoading(false);
      setPayments([]);
      setTotalPages(1);
      setOverallStats({
        totalPayments: 0,
        totalAmount: 0,
        bankTransferPayments: 0,
        moneyChangerPayments: 0,
        moneyChangerOverpaymentAmount: 0,
      });
      return;
    }

    setLoading(true);
    try {
      const assignedIds = (businesses || []).map((b) => b._id).filter(Boolean);
      const params = {
        ...(selectedBusinessFilter
          ? { businessId: selectedBusinessFilter }
          : assignedIds.length > 0
            ? { businessIds: assignedIds.join(",") }
            : {}),
        customerId: selectedCustomerFilter || undefined,
        paymentType:
          selectedPaymentTypeFilter !== "All"
            ? selectedPaymentTypeFilter
            : undefined,
        paymentDate: selectedDateFilter,
        search: searchTerm,
        page: currentPage,
        limit: entriesPerPage,
        // Add date range parameters
        ...(dateRangeStart && { dateFrom: dateRangeStart }),
        ...(dateRangeEnd && { dateTo: dateRangeEnd }),
      };

      // Remove undefined values
      Object.keys(params).forEach(
        (key) => params[key] === undefined && delete params[key],
      );

      const response = await axios.get(
        `${Base_URL}/proforma-invoice/payments`,
        { params, headers },
      );

      if (response.data.success) {
        let list = response.data.data || [];
        const assignedIds = (businesses || []).map((b) => String(b._id));
        if (assignedIds.length > 0) {
          list = list.filter((p) => {
            const bid =
              p.business_id?._id ??
              p.business_id ??
              p.business?._id ??
              p.business;
            if (!bid) return false;
            return assignedIds.includes(
              typeof bid === "string" ? bid : String(bid),
            );
          });
        } else {
          list = [];
        }
        setPayments(list);
        setTotalPages(response.data.totalPages || 1);
        setOverallStats(
          response.data.overallStats || {
            totalPayments: 0,
            totalAmount: 0,
            bankTransferPayments: 0,
            moneyChangerPayments: 0,
            moneyChangerOverpaymentAmount: 0,
          },
        );
      }
    } catch (error) {
      console.error("Error fetching payments:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchBusinesses = async () => {
      if (!adminInfo?.id) return;
      try {
        const response = await axios.get(
          `${Base_URL}/admin/assigned/${adminInfo.id}`,
          { headers },
        );
        const list = response.data?.businesses || [];
        setBusinesses(list);
        setBusinessesLoading(false);
      } catch (error) {
        console.error("Failed to fetch assigned businesses:", error);
      }
    };
    fetchBusinesses();
  }, [adminInfo?.id]);

  useEffect(() => {
    if (businessesLoading) return;
    if (businesses.length !== 1) return;
    const onlyId = businesses[0]?._id;
    if (!onlyId) return;
    if (selectedBusinessFilter) return;
    setSelectedBusinessFilter(String(onlyId));
  }, [businessesLoading, businesses, selectedBusinessFilter]);

  useEffect(() => {
    const fetchCustomers = async () => {
      if (!selectedBusinessFilter) {
        setCustomers([]);
        setSelectedCustomerFilter("");
        return;
      }
      try {
        const response = await axios.get(
          `${Base_URL}/customers_by_business/${selectedBusinessFilter}`,
          { headers },
        );
        const list = Array.isArray(response?.data)
          ? response.data.filter((c) => !c.status || c.status === "Active")
          : [];
        setCustomers(list);
        setSelectedCustomerFilter("");
        setCustomersLoading(false);
      } catch (error) {
        console.error("Error fetching customers for business:", error);
        setCustomers([]);
      }
    };
    fetchCustomers();
  }, [selectedBusinessFilter, adminInfo?.id]);

  useEffect(() => {
    setCurrentPage(1);
    fetchPayments();
  }, [
    selectedBusinessFilter,
    selectedCustomerFilter,
    selectedPaymentTypeFilter,
    selectedDateFilter,
    dateRangeStart,
    dateRangeEnd,
    searchTerm,
    businesses.length,
  ]);

  useEffect(() => {
    fetchPayments();
  }, [currentPage, entriesPerPage, selectedBusinessFilter]);

  const handleDateRangeApply = (startDate, endDate) => {
    setDateRangeStart(startDate);
    setDateRangeEnd(endDate);
    setCurrentPage(1); // Reset to first page when filter changes
  };

  const handleDateRangeClear = () => {
    setDateRangeStart("");
    setDateRangeEnd("");
    setCurrentPage(1);
  };

  const handleExportExcel = async () => {
    const assignedIds = (businesses || [])
      .map((b) => (b && b._id != null ? String(b._id) : null))
      .filter(Boolean);
    if (!selectedBusinessFilter && assignedIds.length === 0) {
      notifyError("Please select a business to export");
      return;
    }
    try {
      setLoading(true);

      const params = {
        ...(selectedBusinessFilter
          ? { businessId: selectedBusinessFilter }
          : assignedIds.length > 0
            ? { businessIds: assignedIds.join(",") }
            : {}),
        customerId: selectedCustomerFilter || undefined,
        paymentType:
          selectedPaymentTypeFilter !== "All"
            ? selectedPaymentTypeFilter
            : undefined,
        paymentDate: selectedDateFilter,
        search: searchTerm,
        page: 1,
        limit: 999999, // Get all records
        ...(dateRangeStart && { dateFrom: dateRangeStart }),
        ...(dateRangeEnd && { dateTo: dateRangeEnd }),
      };

      // Remove undefined values
      Object.keys(params).forEach(
        (key) => params[key] === undefined && delete params[key],
      );

      const response = await axios.get(
        `${Base_URL}/proforma-invoice/payments`,
        { params, headers },
      );

      let allPayments = response?.data?.data ?? response?.data ?? [];
      if (!Array.isArray(allPayments)) allPayments = [];
      if (assignedIds.length > 0) {
        allPayments = allPayments.filter((p) => {
          const bid =
            p.business_id?._id ??
            p.business_id ??
            p.business?._id ??
            p.business;
          if (!bid) return false;
          return assignedIds.includes(
            typeof bid === "string" ? bid : String(bid),
          );
        });
      }

      if (allPayments.length === 0) {
        notifyError("No payments found to export");
        setLoading(false);
        return;
      }

      // Prepare Excel data
      const exportData = allPayments.map((payment) => ({
        "Payment Number":
          payment.paymentNumber || payment.customerPaymentNumber || "",
        "Invoice Number": payment.invoice_number || "",
        "Customer Name":
          payment.customer_id?.basicInformation?.customerDisplayName || "",
        "Payment Date": payment.paymentDate
          ? formatDate(payment.paymentDate)
          : "",
        "Payment Mode": payment.paymentMode || "",
        Amount: payment.amount || 0,
        Currency: payment.currency || "USD",
        Reference: payment.reference || "",
        "Bank Charges": payment.bankCharges || 0,
        "Collection Date": payment.collectionDate
          ? formatDate(payment.collectionDate)
          : "",
        "Collection Time": payment.collectionTime || "",
        "Collection Address": payment.collectionAddress || "",
        "Created At": payment.createdAt ? formatDate(payment.createdAt) : "",
      }));

      // Create summary rows
      const summaryRows = [
        {
          "Payment Number": "Customer Payments Report",
          "Invoice Number": "",
          "Customer Name": "",
          "Payment Date": "",
          "Payment Mode": "",
          Amount: "",
          Currency: "",
          Reference: "",
          "Bank Charges": "",
          "Collection Date": "",
          "Collection Time": "",
          "Collection Address": "",
          "Created At": "",
        },
        {
          "Payment Number": `Generated on: ${formatDate(new Date())}`,
          "Invoice Number": "",
          "Customer Name": "",
          "Payment Date": "",
          "Payment Mode": "",
          Amount: "",
          Currency: "",
          Reference: "",
          "Bank Charges": "",
          "Collection Date": "",
          "Collection Time": "",
          "Collection Address": "",
          "Created At": "",
        },
        {
          "Payment Number": `Total Payments: ${allPayments.length}`,
          "Invoice Number": "",
          "Customer Name": "",
          "Payment Date": "",
          "Payment Mode": "",
          Amount: "",
          Currency: "",
          Reference: "",
          "Bank Charges": "",
          "Collection Date": "",
          "Collection Time": "",
          "Collection Address": "",
          "Created At": "",
        },
        {
          "Payment Number": `Total Amount: ${formatAmount(
            allPayments.reduce(
              (sum, payment) => sum + (payment.amount || 0),
              0,
            ),
          )}`,
          "Invoice Number": "",
          "Customer Name": "",
          "Payment Date": "",
          "Payment Mode": "",
          Amount: "",
          Currency: "",
          Reference: "",
          "Bank Charges": "",
          "Collection Date": "",
          "Collection Time": "",
          "Collection Address": "",
          "Created At": "",
        },
        {
          "Payment Number": "",
          "Invoice Number": "",
          "Customer Name": "",
          "Payment Date": "",
          "Payment Mode": "",
          Amount: "",
          Currency: "",
          Reference: "",
          "Bank Charges": "",
          "Collection Date": "",
          "Collection Time": "",
          "Collection Address": "",
          "Created At": "",
        },
      ];

      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet([]);

      // Add summary rows
      XLSX.utils.sheet_add_json(worksheet, summaryRows, {
        skipHeader: true,
        origin: "A1",
      });

      // Add data rows
      XLSX.utils.sheet_add_json(worksheet, exportData, {
        skipHeader: false,
        origin: "A6", // Start after summary rows
      });

      // Create workbook
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Customer Payments");

      // Generate filename
      const filename = `Customer_Payments_${
        new Date().toISOString().split("T")[0]
      }.xlsx`;

      // Download file
      XLSX.writeFile(workbook, filename);

      notifySuccess("Customer payments exported to Excel successfully!");
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      notifyError("Failed to export payments to Excel. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleViewPaymentDetails = (payment) => {
    setSelectedPayment(payment);
    setShowPaymentDetails(true);
  };

  const handleDownloadReceipt = async (payment, rowIndex) => {
    const receiptKey = payment?._id || `${rowIndex ?? 0}`;
    try {
      setDownloadingReceiptId(receiptKey);
      const bid =
        payment?.business_id?._id ??
        payment?.business_id ??
        payment?.business?._id ??
        payment?.business;
      await downloadPaymentReceiptSlip({
        token: adminInfo?.token,
        businessId: bid ? String(bid) : selectedBusinessFilter || "",
        invoice: null,
        payment,
        kind: "customer",
        paymentIndex: rowIndex ?? 0,
      });
      notifySuccess("Receipt downloaded");
    } catch (e) {
      console.error(e);
      notifyError("Failed to download receipt");
    } finally {
      setDownloadingReceiptId(null);
    }
  };

  const handleDeletePayment = async (payment) => {
    if (!canDelete) return;
    if (payment?.source && payment.source !== "proforma") {
      notifyError("Only invoice payments can be deleted from this screen.");
      return;
    }
    const invoiceId =
      payment?.invoice_id?._id ||
      payment?.invoice_id ||
      payment?.invoiceId ||
      payment?.invoice?._id ||
      payment?.invoice ||
      payment?.proformaInvoiceId ||
      payment?.proforma_invoice_id ||
      payment?.invoiceRef?._id ||
      payment?.invoice_ref?._id;
    const paymentId = payment?._id || payment?.paymentId;
    if (!invoiceId || !paymentId) {
      notifyError("Unable to delete payment: missing identifiers");
      return;
    }
    setPendingDeletePayment({
      invoiceId,
      paymentId,
      reference:
        payment?.customerPaymentNumber ||
        payment?.paymentNumber ||
        payment?._id ||
        "this payment",
    });
    setConfirmDeleteOpen(true);
  };

  const confirmDeletePayment = async () => {
    if (!pendingDeletePayment?.invoiceId || !pendingDeletePayment?.paymentId)
      return;
    try {
      setLoading(true);
      await CustomerInvoiceServices.deleteInvoicePayment(
        pendingDeletePayment.invoiceId,
        pendingDeletePayment.paymentId,
      );
      notifySuccess("Payment deleted successfully");
      if (selectedPayment?._id === pendingDeletePayment.paymentId) {
        setShowPaymentDetails(false);
        setSelectedPayment(null);
      }
      fetchPayments();
    } catch (error) {
      console.error("Error deleting customer payment:", error);
      notifyError(error?.response?.data?.message || "Failed to delete payment");
    } finally {
      setConfirmDeleteOpen(false);
      setPendingDeletePayment(null);
      setLoading(false);
    }
  };

  const getPaymentTypeColor = (type) => {
    const colors = {
      "Bank Transfer": "bg-blue-100 text-blue-800",
      "Money Changer": "bg-green-100 text-green-800",
      Cash: "bg-yellow-100 text-yellow-800",
      Check: "bg-purple-100 text-purple-800",
      "Customer Credit": "bg-indigo-100 text-indigo-800",
    };
    return colors[type] || "bg-gray-100 text-gray-800";
  };

  const summaryCardsData = [
    {
      title: t("accounts.customerPayments.totalPayments"),
      value: overallStats.totalPayments || 0,
      backgroundColor: "summary-light",
      iconColor: "summary-dark",
      Icon: SummarySvg,
    },
    {
      title: t("accounts.customerPayments.bankTransferPayments"),
      value: overallStats.bankTransferPayments || 0,
      backgroundColor: "completed-light",
      iconColor: "completed-dark",
      Icon: CompletedSvg,
    },
    {
      title: t("accounts.customerPayments.moneyChangerPayments"),
      value: (
        <div>
          <div className="text-2xl font-bold">
            {overallStats.moneyChangerPayments || 0}
          </div>
          {overallStats.moneyChangerOverpaymentAmount > 0 && (
            <div className="text-sm font-semibold text-green-600 mt-1">
              Overpayment:{" "}
              {formatAmount(overallStats.moneyChangerOverpaymentAmount)}
            </div>
          )}
        </div>
      ),
      backgroundColor: "processing-light",
      iconColor: "processing-dark",
      Icon: InProgressSvg,
    },
    {
      title: "Total Amount",
      value: `${formatAmount(overallStats.totalAmount || 0)}`,
      backgroundColor: "completed-light",
      iconColor: "overdue-dark",
      Icon: DollarSvg,
    },
  ];

  return (
    <div className="bg-gray-50 min-h-screen w-full max-w-full overflow-x-hidden">
      <div className="w-full max-w-full mx-auto px-6 py-8 min-w-0 overflow-x-hidden">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {t("accounts.customerPayments.title")}
              </h1>
              <p className="text-gray-600 mt-2">
                {t("accounts.customerPayments.title")}
              </p>
            </div>
            <div className="flex items-center gap-4 relative z-10">
              <DateRangeComponent
                startDate={dateRangeStart}
                endDate={dateRangeEnd}
                onApply={handleDateRangeApply}
                onClear={handleDateRangeClear}
                placeholder="Filter by date range"
                // className="flex-shrink-0"
              />
              <button
                onClick={handleExportExcel}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ExcelIcon size={18} />
                {loading
                  ? t("Loading") + "..."
                  : t("accounts.customerPayments.exportToExcel")}
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="mb-8">
          <SummaryCards cards={summaryCardsData} columnsCount={4} />
        </div>

        {/* Table Container */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 relative min-w-0 max-w-full overflow-hidden">
          <DataTable
            filters={filters}
            headersWithoutCellTooltip={["Amount"]}
            colWidths={{
              "Payment #": "150px",
              "Invoice No": "160px",
              [t("accounts.customerPayments.customer")]: "240px",
              [t("accounts.customerPayments.viewDetails")]: "220px",
              Amount: "240px",
              [t("Actions")]: "140px",
            }}
            currentPage={currentPage}
            totalPages={totalPages}
            totalRecords={overallStats.totalPayments}
            onPageChange={(page) => setCurrentPage(page)}
            recordsPerPage={entriesPerPage}
            onRecordsPerPageChange={(num) => {
              setEntriesPerPage(num);
              setCurrentPage(1);
            }}
            searchValue={searchTerm}
            onSearch={(val) => {
              setSearchTerm(val);
              setCurrentPage(1);
            }}
            searchPlaceholder={t("accounts.customerPayments.searchPlaceholder")}
            headers={[
              "Payment #",
              "Invoice No",
              t("accounts.customerPayments.customer"),
              t("accounts.customerPayments.viewDetails"),
              "Amount",
              t("Actions"),
            ]}
            data={payments}
            loading={loading}
            renderRow={(payment, rowIndex) => {
              const conversionDisplayLine = getCurrencyConversionDisplayLine(
                payment.conversionDetails,
              );
              const invoiceRecordId =
                payment?.invoice_id?._id ||
                payment?.invoice_id ||
                payment?.invoiceId ||
                payment?.invoice?._id ||
                payment?.invoice ||
                payment?.proformaInvoiceId ||
                payment?.proforma_invoice_id ||
                payment?.invoiceRef?._id ||
                payment?.invoice_ref?._id;
              return (
                <tr
                  key={payment._id}
                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  {/* Payment # */}
                  <td className="py-4 px-4">
                    {payment.paymentNumber ? (
                      <button
                        type="button"
                        onClick={() => handleViewPaymentDetails(payment)}
                        className="inline-block font-mono text-sm font-semibold text-[var(--p-blue)] bg-gray-100 hover:bg-gray-200 px-2 py-0.5 rounded"
                      >
                        {payment.paymentNumber}
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>

                  {/* Invoice No */}
                  <td className="py-4 px-4">
                    <div>
                      {invoiceRecordId && canViewPayment ? (
                        <button
                          type="button"
                          onClick={() =>
                            history.push(
                              `/view-customer-invoice/${invoiceRecordId}`,
                            )
                          }
                          className="font-semibold text-[var(--p-blue)] hover:underline"
                        >
                          #{payment.invoice_number}
                        </button>
                      ) : (
                        <p className="font-semibold text-gray-900">
                          #{payment.invoice_number}
                        </p>
                      )}
                      {payment.contract_no && (
                        <p className="text-sm text-gray-500">
                          Contract: {payment.contract_no}
                        </p>
                      )}
                    </div>
                  </td>

                  {/* Customer */}
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-100 rounded-lg">
                        <User size={16} className="text-gray-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 truncate">
                          {payment.customer_id?.basicInformation?.companyName ||
                            payment.customer_id?.basicInformation
                              ?.customerDisplayName}
                        </p>
                        <p className="text-sm text-gray-500">Customer</p>
                      </div>
                    </div>
                  </td>

                  {/* Payment Details */}
                  <td className="py-4 px-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-gray-400" />
                        <span className="text-sm text-gray-600">
                          {formatDate(payment.paymentDate)}
                        </span>
                      </div>
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPaymentTypeColor(
                          payment.paymentMode,
                        )}`}
                      >
                        {payment.paymentMode}
                      </span>
                      {payment.moneyChangerName && (
                        <p className="text-xs text-gray-500">
                          MC: {payment.moneyChangerName}
                        </p>
                      )}
                    </div>
                  </td>

                  {/* Amount */}
                  <td className="py-4 px-4">
                    <div>
                      <p className="text-lg font-bold text-gray-900 whitespace-nowrap">
                        {formatCurrencyAmount(payment.currency, payment.amount)}
                      </p>
                      {payment.overpaymentAmount > 0 ? (
                        <div>
                          <p className="text-xs text-gray-500">Payment</p>
                          <p className="text-sm font-semibold text-green-600 mt-1">
                            Overpayment:{" "}
                            {formatCurrencyAmount(
                              payment.overpaymentCurrency ||
                                payment.invoiceCurrency ||
                                payment.currency,
                              payment.overpaymentAmount,
                            )}
                          </p>
                          {payment.overpaymentDetails &&
                            payment.overpaymentDetails.paymentCurrency !==
                              payment.overpaymentDetails.invoiceCurrency && (
                              <p className="text-xs text-gray-500 mt-1">
                                (from{" "}
                                {payment.overpaymentDetails.paymentCurrency}{" "}
                                {formatAmount(
                                  payment.overpaymentDetails
                                    .paymentCurrencyAmount,
                                )}
                                )
                              </p>
                            )}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500">Payment</p>
                      )}
                      {payment.underpaymentAmount > 0 && (
                        <p className="text-xs text-orange-600">
                          Underpayment:{" "}
                          {formatCurrencyAmount(
                            payment.underpaymentCurrency ||
                              payment.invoiceCurrency ||
                              payment.currency,
                            payment.underpaymentAmount,
                          )}
                        </p>
                      )}
                      {conversionDisplayLine && (
                        <p className="text-xs text-blue-600">
                          {conversionDisplayLine}
                        </p>
                      )}
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      {canViewPayment && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              handleDownloadReceipt(
                                payment,
                                typeof rowIndex === "number"
                                  ? rowIndex
                                  : undefined,
                              )
                            }
                            disabled={
                              downloadingReceiptId ===
                              (payment?._id || `${rowIndex ?? 0}`)
                            }
                            className="p-2 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                            title={
                              downloadingReceiptId ===
                              (payment?._id || `${rowIndex ?? 0}`)
                                ? "Preparing receipt..."
                                : "Download receipt (PDF)"
                            }
                            aria-label="Download receipt (PDF)"
                          >
                            {downloadingReceiptId ===
                            (payment?._id || `${rowIndex ?? 0}`) ? (
                              <Loader2 size={18} className="animate-spin" />
                            ) : (
                              <Download size={18} />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleViewPaymentDetails(payment)}
                            className="p-2 text-gray-500 hover:text-[var(--p-blue)] hover:bg-[var(--p-blue)]/10 rounded-lg transition-colors"
                            title="View Payment Details"
                          >
                            <Eye size={16} />
                          </button>
                          {canDelete &&
                            (payment?.source === "proforma" && payment?._id ? (
                              <button
                                type="button"
                                onClick={() => handleDeletePayment(payment)}
                                className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete Payment"
                              >
                                <Trash2 size={16} />
                              </button>
                            ) : null)}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            }}
          />
        </div>
      </div>

      {showPaymentDetails && selectedPayment && (
        <PaymentDetailsModal
          payment={selectedPayment}
          invoice={
            selectedPayment?.invoice_id &&
            typeof selectedPayment.invoice_id === "object"
              ? selectedPayment.invoice_id
              : null
          }
          onClose={() => {
            setShowPaymentDetails(false);
            setSelectedPayment(null);
          }}
        />
      )}
      {confirmDeleteOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-[420px] max-w-[90%]">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Delete Payment
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete{" "}
              <span className="font-medium">
                {pendingDeletePayment?.reference || "this payment"}
              </span>
              ? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  if (loading) return;
                  setConfirmDeleteOpen(false);
                  setPendingDeletePayment(null);
                }}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={confirmDeletePayment}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60"
              >
                {loading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerPayments;
