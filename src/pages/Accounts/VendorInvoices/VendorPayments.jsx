import React, { useState, useEffect, useContext } from "react";
import { useHistory } from "react-router-dom";
import axios from "axios";
import { AdminContext } from "@/context/AdminContext";
import {
  DataTable,
  SummaryCards,
  DateRangeComponent,
} from "@/page-layouts/index";
import { formatDate, formatAmount, formatCurrencyAmount } from "@/components/formatAmount";
import {
  Eye,
  Download,
  Calendar,
  Building,
  User,
  CreditCard,
  FileSpreadsheet as ExcelIcon,
  Loader2,
  Trash2,
} from "lucide-react";
import * as XLSX from "xlsx";
import { notifyError, notifySuccess } from "@/utils/toast";
import { getCurrencyConversionDisplayLine } from "@/utils/currencyConversionDisplay";
import { downloadPaymentReceiptSlip } from "@/utils/paymentReceiptFromTemplate";
import PaymentDetailsModal from "../CustomerPayments/components/PaymentDetailsModal";
import CompletedSvg from "@/assets/img/completed.svg";
import InProgressSvg from "@/assets/img/in-progress.svg";
import PendingApprovalSvg from "@/assets/img/pending-approval.svg";
import DelayedSvg from "@/assets/img/delayed.svg";
import SummarySvg from "@/assets/img/summary.svg";
import DollarSvg from "../../../assets/img/icons/stats-1.png";
import { useRouteModulePermissions } from "@/utils/permissionUtils";
import { useTranslation } from "react-i18next";
import { isSingleAssignedBusiness } from "@/utils/sessionAssignedBusinesses";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const VendorPayments = () => {
  const routePerms = useRouteModulePermissions();
  const { canView, canViewDetails, canDelete } = routePerms;
  const canSeeDetails = canView || canViewDetails;
  const { t } = useTranslation();
  const vp = (key, defaultValue, options = {}) =>
    t(`accounts.vendorPayments.${key}`, { defaultValue, ...options });
  const history = useHistory();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
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
  const [vendors, setVendors] = useState([]);
  const [selectedBusinessFilter, setSelectedBusinessFilter] = useState("");
  const [selectedVendorFilter, setSelectedVendorFilter] = useState("");
  const [selectedPaymentTypeFilter, setSelectedPaymentTypeFilter] =
    useState("All");
  const [selectedDateFilter, setSelectedDateFilter] = useState("");
  const [dateRangeStart, setDateRangeStart] = useState("");
  const [dateRangeEnd, setDateRangeEnd] = useState("");
  const [loading, setLoading] = useState(true);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [pendingDeletePayment, setPendingDeletePayment] = useState(null);
  const [businessesLoading, setBusinessesLoading] = useState(true);
  const [downloadingReceiptId, setDownloadingReceiptId] = useState(null);
  const [overallStats, setOverallStats] = useState({
    totalPayments: 0,
    totalAmount: 0,
    bankTransferPayments: 0,
    moneyChangerPayments: 0,
  });

  // Clear all filters function
  const clearAllFilters = () => {
    setSelectedBusinessFilter("");
    setSelectedVendorFilter("");
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
            label: vp("business", "Business"),
            value: selectedBusinessFilter,
            onChange: (val) => {
              setSelectedBusinessFilter(val);
              setCurrentPage(1);
            },
            options: businesses.map((b) => ({
              value: b._id,
              label: b.name,
            })),
            placeholder: vp("selectBusiness", "Select Business"),
            icon: Building,
          },
        ]
      : []),
    {
      label: vp("vendor", "Vendor"),
      value: selectedVendorFilter,
      onChange: (val) => {
        setSelectedVendorFilter(val);
        setCurrentPage(1);
      },
      options: vendors
        .filter((v) => String(v?.status ?? "Active").toLowerCase() === "active")
        .map((v) => ({
          value: v._id,
          label:
            v.basicInformation?.vendorDisplayName ??
            v.basicInformation?.companyName ??
            "—",
        })),
      placeholder: vp("selectVendor", "Select Vendor"),
      icon: User,
    },
    {
      label: vp("paymentType", "Payment Type"),
      value: selectedPaymentTypeFilter,
      onChange: (val) => {
        setSelectedPaymentTypeFilter(val);
        setCurrentPage(1);
      },
      options: [
        { value: "All", label: vp("allTypes", "All Types") },
        { value: "Bank Transfer", label: vp("bankTransfer", "Bank Transfer") },
      ],
      placeholder: vp("paymentTypeAll", "Payment Type: All"),
      icon: CreditCard,
    },
    {
      label: vp("paymentDate", "Payment Date"),
      value: selectedDateFilter,
      onChange: (val) => {
        setSelectedDateFilter(val);
        setCurrentPage(1);
      },
      isDatePicker: true,
      placeholder: vp("paymentDate", "Payment Date"),
      icon: Calendar,
    },
  ];

  const fetchPayments = async () => {
    if (businesses.length === 0) {
      if (!businessesLoading) setLoading(false);
      setPayments([]);
      setTotalPages(1);
      setOverallStats({
        totalPayments: 0,
        totalAmount: 0,
        bankTransferPayments: 0,
        moneyChangerPayments: 0,
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
        vendorId: selectedVendorFilter || undefined,
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
        (key) => params[key] === undefined && delete params[key]
      );

      const response = await axios.get(`${Base_URL}/vendor-invoices/payments`, {
        params,
        headers,
      });

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
              typeof bid === "string" ? bid : String(bid)
            );
          });
        } else {
          list = [];
        }

        const safeOverallStats =
          response.data.overallStats || {
            totalPayments: 0,
            totalAmount: 0,
            bankTransferPayments: 0,
            moneyChangerPayments: 0,
          };

        const bankTransferPaymentsCount = list.filter(
          (payment) => payment.paymentMode === "Bank Transfer"
        ).length;

        setPayments(list);
        setTotalPages(response.data.totalPages || 1);
        setOverallStats({
          ...safeOverallStats,
          bankTransferPayments: bankTransferPaymentsCount,
        });
      }
    } catch (error) {
      console.error("Error fetching payments:", error);
      notifyError(vp("fetchFailed", "Failed to fetch vendor payments"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchBusinesses = async () => {
      if (!adminInfo?.id) {
        setBusinessesLoading(false);
        return;
      }
      try {
        const response = await axios.get(
          `${Base_URL}/admin/assigned/${adminInfo.id}`,
          { headers }
        );
        const list = response.data?.businesses || [];
        setBusinesses(list);
      } catch (error) {
        console.error("Failed to fetch assigned businesses:", error);
      } finally {
        setBusinessesLoading(false);
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
    const fetchVendors = async () => {
      if (!selectedBusinessFilter) {
        setVendors([]);
        setSelectedVendorFilter("");
        return;
      }
      try {
        const response = await axios.get(
          `${Base_URL}/vendors/all/${selectedBusinessFilter}`,
          { headers, params: { status: "Active" } }
        );
        const list = response.data?.data || response.data?.vendors || [];
        setVendors(
          Array.isArray(list)
            ? list.filter(
                (v) => String(v?.status ?? "Active").toLowerCase() === "active"
              )
            : []
        );
        setSelectedVendorFilter("");
      } catch (error) {
        console.error("Error fetching vendors for business:", error);
        setVendors([]);
      }
    };
    fetchVendors();
  }, [selectedBusinessFilter, adminInfo?.id]);

  useEffect(() => {
    setCurrentPage(1);
    fetchPayments();
  }, [
    selectedBusinessFilter,
    selectedVendorFilter,
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
    setCurrentPage(1);
  };

  const handleDateRangeClear = () => {
    setDateRangeStart("");
    setDateRangeEnd("");
    setCurrentPage(1);
  };

  const handleExportExcel = async () => {
    const assignedIds = (businesses || []).map((b) => b._id).filter(Boolean);
    if (assignedIds.length === 0 && !selectedBusinessFilter) {
      notifyError(
        vp(
          "noAssignedBusinesses",
          "No assigned businesses found. Please select a business or ensure you have business access."
        )
      );
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
        vendorId: selectedVendorFilter || undefined,
        paymentType:
          selectedPaymentTypeFilter !== "All"
            ? selectedPaymentTypeFilter
            : undefined,
        paymentDate: selectedDateFilter,
        search: searchTerm,
        page: 1,
        limit: 999999,
        ...(dateRangeStart && { dateFrom: dateRangeStart }),
        ...(dateRangeEnd && { dateTo: dateRangeEnd }),
      };

      // Remove undefined and empty values
      Object.keys(params).forEach(
        (key) =>
          (params[key] === undefined || params[key] === "") && delete params[key]
      );

      const response = await axios.get(`${Base_URL}/vendor-invoices/payments`, {
        params,
        headers,
      });

      if (!response.data?.success) {
        notifyError(
          response.data?.message ||
            vp("exportFetchFailed", "Failed to fetch payments for export")
        );
        return;
      }
      // Support both array and wrapped payload shapes from backend.
      let allPayments = [];
      if (Array.isArray(response?.data?.data)) {
        allPayments = response.data.data;
      } else if (Array.isArray(response?.data?.payments)) {
        allPayments = response.data.payments;
      }

      if (allPayments.length === 0) {
        const hasDateRange = dateRangeStart || dateRangeEnd;
        notifyError(
          hasDateRange
            ? vp(
                "exportDateRangeNoData",
                "Selected date range has no data. Please try a different date range."
              )
            : vp("exportNoData", "No payments found to export")
        );
        return;
      }

      const colPaymentNumber = vp("exportPaymentNumber", "Payment Number");
      const colInvoiceNumber = vp("exportInvoiceNumber", "Invoice Number");
      const colVendorName = vp("exportVendorName", "Vendor Name");
      const colPaymentDate = vp("exportPaymentDate", "Payment Date");
      const colPaymentMode = vp("exportPaymentMode", "Payment Mode");
      const colAmount = vp("amount", "Amount");
      const colCurrency = vp("exportCurrency", "Currency");
      const colBankAccount = vp("exportBankAccount", "Bank Account");
      const colStatus = vp("exportStatus", "Status");
      const colCreatedAt = vp("exportCreatedAt", "Created At");

      const emptyExportCols = {
        [colInvoiceNumber]: "",
        [colVendorName]: "",
        [colPaymentDate]: "",
        [colPaymentMode]: "",
        [colAmount]: "",
        [colCurrency]: "",
        [colBankAccount]: "",
        [colStatus]: "",
        [colCreatedAt]: "",
      };

      // Prepare Excel data
      const exportData = allPayments.map((payment) => ({
        [colPaymentNumber]:
          payment.vendorPaymentNumber || payment.paymentNumber || "",
        [colInvoiceNumber]: payment.invoice_number || "",
        [colVendorName]:
          payment.vendor_id?.basicInformation?.vendorDisplayName ||
          payment.vendor_id?.basicInformation?.companyName ||
          "",
        [colPaymentDate]: payment.paymentDate
          ? formatDate(payment.paymentDate)
          : "",
        [colPaymentMode]:
          payment.paymentMode || vp("bankTransfer", "Bank Transfer"),
        [colAmount]: payment.amount || 0,
        [colCurrency]: payment.currency || "USD",
        [colBankAccount]: payment.bankAccount?.accountName || "",
        [colStatus]: payment.status || "",
        [colCreatedAt]: payment.createdAt ? formatDate(payment.createdAt) : "",
      }));

      // Create summary rows
      const summaryRows = [
        {
          [colPaymentNumber]: vp(
            "vendorPaymentsReport",
            "Vendor Payments Report"
          ),
          ...emptyExportCols,
        },
        {
          [colPaymentNumber]: vp("generatedOn", "Generated on: {{date}}", {
            date: formatDate(new Date()),
          }),
          ...emptyExportCols,
        },
        {
          [colPaymentNumber]: vp(
            "totalPaymentsCount",
            "Total Payments: {{count}}",
            { count: allPayments.length }
          ),
          ...emptyExportCols,
        },
        {
          [colPaymentNumber]: vp(
            "totalAmountSummary",
            "Total Amount: {{amount}}",
            {
              amount: formatAmount(
                allPayments.reduce(
                  (sum, payment) => sum + (payment.amount || 0),
                  0
                )
              ),
            }
          ),
          ...emptyExportCols,
        },
        {
          [colPaymentNumber]: "",
          ...emptyExportCols,
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
        origin: "A6",
      });

      // Auto-fit column widths based on header + content length (use columnHeaders to avoid shadowing auth headers)
      const columnHeaders = Object.keys(exportData[0] || {});
      worksheet["!cols"] = columnHeaders.map((header) => {
        const maxDataLength = exportData.reduce((max, row) => {
          const value = row?.[header];
          const text = value === undefined || value === null ? "" : String(value);
          return Math.max(max, text.length);
        }, 0);
        const width = Math.max(header.length, maxDataLength) + 2;
        return { wch: Math.min(45, width) };
      });

      // Create workbook
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        vp("title", "Vendor Payments")
      );

      // Generate filename
      const filename = `Vendor_Payments_${
        new Date().toISOString().split("T")[0]
      }.xlsx`;

      // Download file
      XLSX.writeFile(workbook, filename);

      notifySuccess(
        vp(
          "exportSuccess",
          "Vendor payments exported to Excel successfully!"
        )
      );
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      const errMsg =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message;
      notifyError(
        errMsg ||
          vp(
            "exportFailed",
            "Failed to export payments to Excel. Please try again."
          )
      );
    } finally {
      setLoading(false);
    }
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
        kind: "vendor",
        paymentIndex: typeof rowIndex === "number" ? rowIndex : 0,
      });
      notifySuccess(vp("paymentSlipDownloaded", "Payment slip downloaded"));
    } catch (e) {
      console.error(e);
      notifyError(vp("downloadSlipFailed", "Failed to download slip"));
    } finally {
      setDownloadingReceiptId(null);
    }
  };

  const handleViewPaymentDetails = (payment) => {
    // Adapt payment object to match PaymentDetailsModal expected format
    const adaptedPayment = {
      ...payment,
      depositTo: payment.bankAccount, // Map bankAccount to depositTo for the modal
    };
    setSelectedPayment(adaptedPayment);
    setShowPaymentDetails(true);
  };

  const handleDeletePayment = async (payment) => {
    if (!canDelete) return;

    // Unallocated daily-report payments are not tied to a vendor invoice
    if (payment?.source === "daily_report") {
      notifyError(
        vp(
          "dailyReportDeleteBlocked",
          "Daily report payments cannot be deleted here. Remove them from the Daily Report instead."
        )
      );
      return;
    }

    const rawInvoiceId =
      payment?.invoice_id?._id ||
      payment?.invoice_id ||
      payment?.invoiceId ||
      payment?.vendorInvoiceId ||
      payment?.vendor_invoice_id ||
      payment?.invoice?._id ||
      payment?.invoice;
    const rawPaymentId = payment?._id || payment?.paymentId;

    const invoiceId =
      rawInvoiceId != null && rawInvoiceId !== ""
        ? String(rawInvoiceId).trim()
        : "";
    const paymentId =
      rawPaymentId != null && rawPaymentId !== ""
        ? String(rawPaymentId).trim()
        : "";

    if (
      !invoiceId ||
      !paymentId ||
      invoiceId === "undefined" ||
      paymentId === "undefined" ||
      invoiceId.startsWith("shift-") ||
      invoiceId.startsWith("late-")
    ) {
      notifyError(
        vp("deleteMissingIdentifiers", "Unable to delete payment: missing identifiers")
      );
      return;
    }

    setPendingDeletePayment({
      invoiceId,
      paymentId,
      reference:
        payment?.vendorPaymentNumber ||
        payment?.paymentNumber ||
        payment?._id ||
        vp("thisPayment", "this payment"),
    });
    setConfirmDeleteOpen(true);
  };

  const confirmDeletePayment = async () => {
    if (!pendingDeletePayment?.invoiceId || !pendingDeletePayment?.paymentId) return;
    try {
      setLoading(true);
      const response = await axios.delete(
        `${Base_URL}/vendor-invoices/${pendingDeletePayment.invoiceId}/payments/${pendingDeletePayment.paymentId}`,
        { headers },
      );
      if (!response?.data?.success) {
        notifyError(response?.data?.error || vp("deleteFailed", "Failed to delete payment"));
        return;
      }
      notifySuccess(vp("deleteSuccess", "Payment deleted successfully"));
      if (selectedPayment?._id === pendingDeletePayment.paymentId) {
        setShowPaymentDetails(false);
        setSelectedPayment(null);
      }
      fetchPayments();
    } catch (error) {
      console.error("Error deleting vendor payment:", error);
      notifyError(
        error?.response?.data?.error ||
          vp("deleteFailed", "Failed to delete payment")
      );
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
    };
    return colors[type] || "bg-gray-100 text-gray-800";
  };

  const summaryCardsData = [
    {
      title: vp("totalPayments", "Total Payments"),
      value: overallStats.totalPayments || 0,
      backgroundColor: "summary-light",
      iconColor: "summary-dark",
      Icon: SummarySvg,
    },
    {
      title: vp("bankTransfers", "Bank Transfers"),
      value: overallStats.bankTransferPayments || 0,
      backgroundColor: "completed-light",
      iconColor: "completed-dark",
      Icon: CompletedSvg,
    },
    {
      title: vp("approvedPayments", "Approved Payments"),
      value: overallStats.totalPayments || 0,
      backgroundColor: "processing-light",
      iconColor: "processing-dark",
      Icon: InProgressSvg,
    },
    {
      title: vp("totalAmount", "Total Amount"),
      value: `${formatAmount(overallStats.totalAmount || 0)}`,
      backgroundColor: "completed-light",
      iconColor: "overdue-dark",
      Icon: DollarSvg,
    },
  ];

  const paymentNumberHeader = vp("paymentNumberShort", "Payment #");
  const invoiceNoHeader = vp("invoiceNo", "Invoice No");
  const vendorHeader = vp("vendor", "Vendor");
  const paymentDetailsHeader = vp("paymentDetails", "Payment Details");
  const amountHeader = vp("amount", "Amount");
  const actionsHeader = vp("actions", "Actions");
  const tableHeaders = [
    paymentNumberHeader,
    invoiceNoHeader,
    vendorHeader,
    paymentDetailsHeader,
    amountHeader,
    actionsHeader,
  ];

  return (
    <div className="bg-gray-50 min-h-screen w-full max-w-full overflow-x-hidden">
      <div className="w-full max-w-full mx-auto px-6 py-8 min-w-0 overflow-x-hidden">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {vp("title", "Vendor Payments")}
              </h1>
              <p className="text-gray-600 mt-2">
                {vp("subtitle", "Track and manage all vendor payments")}
              </p>
            </div>
            <div className="flex items-center gap-4 relative z-10">
              <DateRangeComponent
                startDate={dateRangeStart}
                endDate={dateRangeEnd}
                onApply={handleDateRangeApply}
                onClear={handleDateRangeClear}
                placeholder={vp("filterByDateRange", "Filter by date range")}
              />
              <button
                onClick={handleExportExcel}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ExcelIcon size={18} />
                {loading ? vp("exporting", "Exporting...") : vp("export", "Export")}
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
            headersWithoutCellTooltip={[amountHeader]}
            colWidths={{
              [paymentNumberHeader]: "150px",
              [invoiceNoHeader]: "160px",
              [vendorHeader]: "240px",
              [paymentDetailsHeader]: "220px",
              [amountHeader]: "220px",
              [actionsHeader]: "120px",
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
            searchPlaceholder={vp("searchPlaceholder", "Search payments...")}
            headers={tableHeaders}
            data={payments}
            loading={loading}
            renderRow={(payment, rowIndex) => {
              const conversionDisplayLine = getCurrencyConversionDisplayLine(
                payment.conversionDetails
              );
              const invoiceRecordId =
                payment?.invoice_id?._id ||
                payment?.invoice_id ||
                payment?.invoiceId ||
                payment?.vendorInvoiceId ||
                payment?.vendor_invoice_id ||
                payment?.invoice?._id ||
                payment?.invoice;
              return (
              <tr
                key={payment._id || payment.invoice_id}
                className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
              >
                {/* Vendor Payment # */}
                <td className="py-4 px-4">
                  {payment.vendorPaymentNumber || payment.paymentNumber ? (
                    <button
                      type="button"
                      onClick={() => canSeeDetails && handleViewPaymentDetails(payment)}
                      className="inline-block font-mono text-sm font-semibold text-[var(--p-blue)] bg-gray-100 hover:bg-gray-200 px-2 py-0.5 rounded"
                      disabled={!canSeeDetails}
                    >
                      {payment.vendorPaymentNumber || payment.paymentNumber}
                    </button>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>

                {/* Invoice No */}
                <td className="py-4 px-4">
                  <div>
                    {invoiceRecordId && canSeeDetails ? (
                      <button
                        type="button"
                        onClick={() =>
                          history.push(`/view-vendor-invoice/${invoiceRecordId}`)
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
                        {vp("contractLabel", "Contract:")} {payment.contract_no}
                      </p>
                    )}
                  </div>
                </td>

                {/* Vendor */}
                <td className="py-4 px-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <User size={16} className="text-gray-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 truncate">
                        {payment.vendor_id?.basicInformation
                          ?.vendorDisplayName ||
                          payment.vendor_id?.basicInformation?.companyName ||
                          vp("na", "N/A")}
                      </p>
                      <p className="text-sm text-gray-500">{vendorHeader}</p>
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
                        payment.paymentMode
                      )}`}
                    >
                      {payment.paymentMode || vp("bankTransfer", "Bank Transfer")}
                    </span>
                    {payment.channelName && (
                      <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-700">
                        {payment.channelName}
                      </span>
                    )}
                    {payment.bankAccount && (
                      <p className="text-xs text-gray-500">
                        {vp("bankLabel", "Bank:")} {payment.bankAccount.accountName}
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
                    <p className="text-xs text-gray-500">{vp("paymentLabel", "Payment")}</p>
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
                    <button
                      type="button"
                      onClick={() =>
                        handleDownloadReceipt(payment, rowIndex)
                      }
                      disabled={
                        downloadingReceiptId ===
                        (payment?._id || `${rowIndex ?? 0}`)
                      }
                      className="p-2 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                      title={
                        downloadingReceiptId ===
                        (payment?._id || `${rowIndex ?? 0}`)
                          ? vp("preparingSlip", "Preparing slip...")
                          : vp(
                              "downloadPaymentSlipPdf",
                              "Download payment slip (PDF)"
                            )
                      }
                      aria-label={vp(
                        "downloadPaymentSlipPdf",
                        "Download payment slip (PDF)"
                      )}
                    >
                      {downloadingReceiptId ===
                      (payment?._id || `${rowIndex ?? 0}`) ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <Download size={18} />
                      )}
                    </button>
                    <button
                      onClick={() =>
                        canSeeDetails && handleViewPaymentDetails(payment)
                      }
                      className="p-2 text-gray-500 hover:text-[var(--p-blue)] hover:bg-[var(--p-blue)]/10 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      title={vp("viewPaymentDetails", "View Payment Details")}
                      disabled={!canSeeDetails}
                    >
                      <Eye size={16} />
                    </button>
                    {canDelete && payment?.source !== "daily_report" && (
                      <button
                        type="button"
                        onClick={() => handleDeletePayment(payment)}
                        className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                        title={vp("deletePayment", "Delete Payment")}
                      >
                        <Trash2 size={16} />
                      </button>
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
          isVendorPayment={true}
        />
      )}
      {confirmDeleteOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-[420px] max-w-[90%]">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              {vp("deletePayment", "Delete Payment")}
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              {vp("confirmDeletePrompt", "Are you sure you want to delete")}{" "}
              <span className="font-medium">
                {pendingDeletePayment?.reference ||
                  vp("thisPayment", "this payment")}
              </span>
              ? {vp("actionCannotBeUndone", "This action cannot be undone.")}
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
                {vp("cancel", "Cancel")}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={confirmDeletePayment}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60"
              >
                {loading
                  ? vp("deleting", "Deleting...")
                  : vp("delete", "Delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorPayments;
