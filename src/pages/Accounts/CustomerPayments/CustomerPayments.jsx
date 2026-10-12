import React, { useState, useEffect, useContext, useMemo, useCallback } from "react";
import { useHistory } from "react-router-dom";
import axios from "axios";
import { AdminContext } from "@/context/AdminContext";
import { useRouteModulePermissions } from "@/utils/permissionUtils";
import {
  SummaryCards,
  DateRangeComponent,
  CustomDatePicker,
} from "@/page-layouts/index";
import { EpcPage } from "@/components/Epc/EpcSurface";
import FilterBar from "@/customer/components/ui/FilterBar";
import { Card, CardHeader } from "@/customer/components/ui/Card";
import PortalDataTable from "@/customer/components/ui/DataTable";
import Pagination from "@/customer/components/ui/Pagination";
import Button from "@/customer/components/ui/Button";
import StatusPill from "@/customer/components/ui/StatusPill";
import { formatDate, formatAmount, formatCurrencyAmount } from "@/components/formatAmount";
import { useTranslation } from "react-i18next";
import {
  Eye,
  Download,
  Loader2,
  Trash2,
  FileSpreadsheet as ExcelIcon,
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
import SummarySvg from "@/assets/img/summary.svg";
import DollarSvg from "../../../assets/img/icons/stats-1.png";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const PAYMENT_TYPE_TONES = {
  "Bank Transfer": "info",
  "Money Changer": "success",
  Cash: "warning",
  Check: "danger-soft",
  "Customer Credit": "info",
};

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
  const [downloadingReceiptId, setDownloadingReceiptId] = useState(null);
  const [overallStats, setOverallStats] = useState({
    totalPayments: 0,
    totalAmount: 0,
    bankTransferPayments: 0,
    moneyChangerPayments: 0,
    moneyChangerOverpaymentAmount: 0,
  });

  const clearAllFilters = useCallback(() => {
    setSelectedBusinessFilter(businesses.length === 1 ? businesses[0]._id : "");
    setSelectedCustomerFilter("");
    setSelectedPaymentTypeFilter("All");
    setSelectedDateFilter("");
    setDateRangeStart("");
    setDateRangeEnd("");
    setSearchTerm("");
    setCurrentPage(1);
  }, [businesses]);

  const fetchPayments = async () => {
    if (businesses.length === 0) {
      setLoading(false);
      setPayments([]);
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
        ...(dateRangeStart && { dateFrom: dateRangeStart }),
        ...(dateRangeEnd && { dateTo: dateRangeEnd }),
      };

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
    setCurrentPage(1);
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
        limit: 999999,
        ...(dateRangeStart && { dateFrom: dateRangeStart }),
        ...(dateRangeEnd && { dateTo: dateRangeEnd }),
      };

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

      const worksheet = XLSX.utils.json_to_sheet([]);
      XLSX.utils.sheet_add_json(worksheet, summaryRows, {
        skipHeader: true,
        origin: "A1",
      });
      XLSX.utils.sheet_add_json(worksheet, exportData, {
        skipHeader: false,
        origin: "A6",
      });

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Customer Payments");

      const filename = `Customer_Payments_${
        new Date().toISOString().split("T")[0]
      }.xlsx`;

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

  const portalFilterValues = {
    business: selectedBusinessFilter || "",
    customer: selectedCustomerFilter || "",
    paymentType:
      selectedPaymentTypeFilter === "All" ? "" : selectedPaymentTypeFilter,
  };

  const portalFilters = useMemo(
    () => [
      ...(!isSingleAssignedBusiness()
        ? [
            {
              key: "business",
              placeholder: t("accounts.customerPayments.selectBusiness"),
              options: [
                { value: "", label: t("accounts.customerPayments.selectBusiness") },
                ...businesses.map((b) => ({
                  value: b._id,
                  label: b.name,
                })),
              ],
            },
          ]
        : []),
      {
        key: "customer",
        placeholder: t("accounts.customerPayments.selectCustomer"),
        options: [
          { value: "", label: t("accounts.customerPayments.selectCustomer") },
          ...customers.map((c) => ({
            value: c._id,
            label:
              c.basicInformation?.customerDisplayName ??
              c.basicInformation?.companyName ??
              "—",
          })),
        ],
      },
      {
        key: "paymentType",
        placeholder: `${t("accounts.customerPayments.paymentType")}: ${t("accounts.customerPayments.allTypes")}`,
        options: [
          { value: "", label: t("accounts.customerPayments.allTypes") },
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
      },
    ],
    [businesses, customers, t],
  );

  const handlePortalFilterChange = (key, value) => {
    if (key === "business") {
      setSelectedBusinessFilter(value || "");
      setCurrentPage(1);
      return;
    }
    if (key === "customer") {
      setSelectedCustomerFilter(value || "");
      setCurrentPage(1);
      return;
    }
    if (key === "paymentType") {
      setSelectedPaymentTypeFilter(value || "All");
      setCurrentPage(1);
    }
  };

  const columns = useMemo(
    () => [
      {
        key: "paymentNumber",
        header: "Payment #",
        width: "12%",
        render: (payment) =>
          payment.paymentNumber ? (
            <button
              type="button"
              className="epc-cell__link"
              onClick={() => handleViewPaymentDetails(payment)}
            >
              {payment.paymentNumber}
            </button>
          ) : (
            <span className="epc-cell__secondary">—</span>
          ),
      },
      {
        key: "invoice",
        header: "Invoice No",
        width: "14%",
        render: (payment) => {
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
            <>
              {invoiceRecordId && canViewPayment ? (
                <button
                  type="button"
                  className="epc-cell__link"
                  onClick={() =>
                    history.push(`/view-customer-invoice/${invoiceRecordId}`)
                  }
                >
                  #{payment.invoice_number}
                </button>
              ) : (
                <div className="epc-cell__primary">
                  #{payment.invoice_number}
                </div>
              )}
              {payment.contract_no ? (
                <div className="epc-cell__secondary">
                  Contract: {payment.contract_no}
                </div>
              ) : null}
            </>
          );
        },
      },
      {
        key: "customer",
        header: t("accounts.customerPayments.customer"),
        width: "18%",
        render: (payment) => (
          <>
            <div className="epc-cell__primary">
              {payment.customer_id?.basicInformation?.companyName ||
                payment.customer_id?.basicInformation?.customerDisplayName ||
                "—"}
            </div>
            <div className="epc-cell__secondary">Customer</div>
          </>
        ),
      },
      {
        key: "details",
        header: t("accounts.customerPayments.viewDetails"),
        width: "16%",
        render: (payment) => (
          <>
            <div className="epc-cell__secondary">
              {formatDate(payment.paymentDate)}
            </div>
            {payment.paymentMode ? (
              <div className="mt-1">
                <StatusPill
                  status={payment.paymentMode}
                  tone={PAYMENT_TYPE_TONES[payment.paymentMode] || "neutral"}
                />
              </div>
            ) : null}
            {payment.moneyChangerName ? (
              <div className="epc-cell__secondary">
                MC: {payment.moneyChangerName}
              </div>
            ) : null}
          </>
        ),
      },
      {
        key: "amount",
        header: "Amount",
        width: "18%",
        render: (payment) => {
          const conversionDisplayLine = getCurrencyConversionDisplayLine(
            payment.conversionDetails,
          );
          return (
            <>
              <div className="epc-cell__primary whitespace-nowrap">
                {formatCurrencyAmount(payment.currency, payment.amount)}
              </div>
              {payment.overpaymentAmount > 0 ? (
                <>
                  <div className="epc-cell__secondary">Payment</div>
                  <div className="text-sm font-semibold text-green-600 mt-1">
                    Overpayment:{" "}
                    {formatCurrencyAmount(
                      payment.overpaymentCurrency ||
                        payment.invoiceCurrency ||
                        payment.currency,
                      payment.overpaymentAmount,
                    )}
                  </div>
                  {payment.overpaymentDetails &&
                    payment.overpaymentDetails.paymentCurrency !==
                      payment.overpaymentDetails.invoiceCurrency && (
                      <div className="epc-cell__secondary">
                        (from {payment.overpaymentDetails.paymentCurrency}{" "}
                        {formatAmount(
                          payment.overpaymentDetails.paymentCurrencyAmount,
                        )}
                        )
                      </div>
                    )}
                </>
              ) : (
                <div className="epc-cell__secondary">Payment</div>
              )}
              {payment.underpaymentAmount > 0 && (
                <div className="text-xs text-orange-600">
                  Underpayment:{" "}
                  {formatCurrencyAmount(
                    payment.underpaymentCurrency ||
                      payment.invoiceCurrency ||
                      payment.currency,
                    payment.underpaymentAmount,
                  )}
                </div>
              )}
              {conversionDisplayLine ? (
                <div className="text-xs text-blue-600">{conversionDisplayLine}</div>
              ) : null}
            </>
          );
        },
      },
      {
        key: "actions",
        header: t("Actions"),
        width: "12%",
        align: "right",
        render: (payment) => {
          if (!canViewPayment) return null;
          const rowIndex = payments.findIndex((p) => p._id === payment._id);
          const receiptKey = payment?._id || `${rowIndex >= 0 ? rowIndex : 0}`;
          return (
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() =>
                  handleDownloadReceipt(
                    payment,
                    rowIndex >= 0 ? rowIndex : undefined,
                  )
                }
                disabled={downloadingReceiptId === receiptKey}
                className="p-2 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                title={
                  downloadingReceiptId === receiptKey
                    ? "Preparing receipt..."
                    : "Download receipt (PDF)"
                }
                aria-label="Download receipt (PDF)"
              >
                {downloadingReceiptId === receiptKey ? (
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
              {canDelete && payment?.source === "proforma" && payment?._id ? (
                <button
                  type="button"
                  onClick={() => handleDeletePayment(payment)}
                  className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete Payment"
                >
                  <Trash2 size={16} />
                </button>
              ) : null}
            </div>
          );
        },
      },
    ],
    [
      canDelete,
      canViewPayment,
      downloadingReceiptId,
      history,
      payments,
      t,
    ],
  );

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

  const totalPayments = overallStats.totalPayments || 0;

  return (
    <EpcPage
      title={t("accounts.customerPayments.title")}
      subtitle={t("accounts.customerPayments.title")}
      action={
        <div className="flex flex-wrap items-center gap-3">
          <DateRangeComponent
            startDate={dateRangeStart}
            endDate={dateRangeEnd}
            onApply={handleDateRangeApply}
            onClear={handleDateRangeClear}
            placeholder="Filter by date range"
          />
          <Button
            variant="secondary"
            onClick={handleExportExcel}
            disabled={loading}
          >
            <ExcelIcon size={15} />
            {loading
              ? t("Loading") + "..."
              : t("accounts.customerPayments.exportToExcel")}
          </Button>
        </div>
      }
    >
      <SummaryCards
        cards={summaryCardsData}
        columnsCount={4}
        loading={loading && payments.length === 0}
      />

      <FilterBar
        subtitle="Narrow by business, customer or payment type."
        searchPlaceholder={t("accounts.customerPayments.searchPlaceholder")}
        searchValue={searchTerm}
        onSearchChange={(value) => {
          setSearchTerm(value);
          setCurrentPage(1);
        }}
        values={portalFilterValues}
        onChange={handlePortalFilterChange}
        onReset={clearAllFilters}
        filters={portalFilters}
      />

      <div className="flex flex-wrap items-end gap-3 mb-1">
        <div className="min-w-[180px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            {t("accounts.customerPayments.paymentDate")}
          </label>
          <CustomDatePicker
            value={selectedDateFilter}
            onChange={(val) => {
              setSelectedDateFilter(val || "");
              setCurrentPage(1);
            }}
            placeholder={t("accounts.customerPayments.paymentDate")}
            clearable
          />
        </div>
      </div>

      <Card>
        <CardHeader
          title={t("accounts.customerPayments.title")}
          subtitle={
            loading ? "Loading…" : `${totalPayments} total payments`
          }
        />
        <PortalDataTable
          columns={columns}
          rows={loading ? [] : payments}
          rowKey="_id"
          emptyMessage={
            loading ? "Loading payments…" : "No payments found."
          }
        />
        {!loading && totalPayments > 0 ? (
          <Pagination
            page={currentPage}
            pageSize={entriesPerPage}
            total={totalPayments}
            itemLabel="payments"
            onPageChange={setCurrentPage}
            onPageSizeChange={(perPage) => {
              setEntriesPerPage(perPage);
              setCurrentPage(1);
            }}
          />
        ) : null}
      </Card>

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
    </EpcPage>
  );
};

export default CustomerPayments;
