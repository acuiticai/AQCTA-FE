import { useTranslation } from "react-i18next";
import { customerInvoiceText as ciText } from "@/utils/customerInvoiceI18n";
import React, { useState, useEffect, useContext } from "react";
import {
  Trash2,
  Eye,
  FileText,
  X,
  Download,
  Calendar,
  DollarSign,
  AlertCircle,
  Building,
  ChevronsUp,
  ArrowRightLeft,
  Wallet,
  Info,
  CheckCircle,
  ArrowUp,
  ArrowDown,
  Loader2,
} from "lucide-react";
import { formatDate, formatCurrencyAmount } from "@/components/formatAmount";
import { notifyError, notifySuccess } from "@/utils/toast";
import { downloadPaymentReceiptSlip } from "@/utils/paymentReceiptFromTemplate";
import { AdminContext } from "@/context/AdminContext";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
import axios from "axios";

const MONEY_EPS = 0.005;

/** Ignore float dust so "Includes overpayment" / Overpay line never show MYR 0.00 */
function paymentHasOverpayment(payment) {
  const raw =
    payment?.overpaymentAmountInPaymentCurrency ??
    payment?.overpaymentAmount ??
    0;
  const n = Number(raw);
  return Number.isFinite(n) && n > MONEY_EPS;
}

const PaymentsTable = ({
  invoice,
  payments,
  onDelete,
  currency,
  /** When false (e.g. view-customer-invoice), hide delete actions — receipts still use the payment HTML template. */
  allowDelete = true,
}) => {
  useTranslation();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [convertedPayments, setConvertedPayments] = useState([]);
  const [totalPaidConverted, setTotalPaidConverted] = useState(0);
  const [isLoadingConversions, setIsLoadingConversions] = useState(false);
  const [expandedPayments, setExpandedPayments] = useState(new Set());
  const [downloadingReceiptId, setDownloadingReceiptId] = useState(null);

  const { state } = useContext(AdminContext);
  const { adminInfo } = state;

  /** Receipt # from DB (PR-…). If missing, the row predates numbering or needs backfill — see PCI-BE/scripts/backfill-customer-invoice-payment-numbers.js */
  const displayPaymentNumber = (p) => {
    const n = p.paymentNumber != null ? String(p.paymentNumber).trim() : "";
    return n || ciText("Not assigned");
  };

  // Labels for amount column chips (not the Payment mode column).
  const getPaymentTypeInfo = (payment) => {
    const mode = String(payment.paymentMode || "").trim() || "Payment";

    if (
      payment.paymentMode === "Customer Credit" ||
      payment.appliedCredits?.length > 0 ||
      payment.creditApplications?.length > 0
    ) {
      return {
        type: "credit",
        icon: <Wallet size={14} className="text-emerald-600 shrink-0" />,
        label: ciText("Credit applied"),
        color: "text-emerald-700",
        bgColor: "bg-emerald-50 border-emerald-100",
      };
    }

    if (
      (payment.appliedCredits?.length > 0 ||
        payment.creditApplications?.length > 0) &&
      payment.amount > 0
    ) {
      return {
        type: "mixed",
        icon: <ArrowRightLeft size={14} className="text-blue-600 shrink-0" />,
        label: ciText("Mixed (cash + credit)"),
        color: "text-blue-700",
        bgColor: "bg-blue-50 border-blue-100",
      };
    }

    if (paymentHasOverpayment(payment)) {
      return {
        type: "overpayment",
        icon: <ArrowUp size={14} className="text-amber-600 shrink-0" />,
        label: ciText("Includes overpayment"),
        color: "text-amber-800",
        bgColor: "bg-amber-50 border-amber-100",
      };
    }

    return {
      type: "standard",
      icon: null,
      label: mode,
      color: "text-slate-600",
      bgColor: "bg-slate-50 border-slate-100",
    };
  };

  // Toggle payment details expansion
  const togglePaymentExpansion = (paymentId) => {
    setExpandedPayments((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(paymentId)) {
        newSet.delete(paymentId);
      } else {
        newSet.add(paymentId);
      }
      return newSet;
    });
  };

  // Format amount with proper styling
  const formatAmountWithCurrency = (amount, currencyCode, className = "") => {
    return (
      <span className={`font-medium ${className}`}>
        {formatCurrencyAmount(currencyCode, amount)}
      </span>
    );
  };

  // Currency conversion function
  const convertCurrency = async (fromCurrency, toCurrency, amount) => {
    if (fromCurrency === toCurrency) {
      return {
        success: true,
        rate: 1,
        convertedAmount: amount,
        displayText: `${amount.toFixed(2)} ${fromCurrency}`,
      };
    }

    try {
      // Get businessId from invoice
      const businessId =
        invoice?.business_id?._id || invoice?.business_id || invoice?.business;

      const response = await axios.get(`${Base_URL}/currency/convert`, {
        params: {
          from: fromCurrency,
          to: toCurrency,
          amount,
          businessId: businessId,
        },
        headers: {
          authorization: `Bearer ${adminInfo.token}`,
        },
      });

      if (response.data.success) {
        return {
          success: true,
          rate: response.data.rate,
          convertedAmount: response.data.convertedAmount,
          displayText: `${amount.toFixed(
            2
          )} ${fromCurrency} = ${response.data.convertedAmount.toFixed(
            2
          )} ${toCurrency}`,
        };
      } else {
        throw new Error(response.data.error);
      }
    } catch (error) {
      console.warn(`Currency conversion failed: ${error.message}`);
      return {
        success: false,
        rate: 1,
        convertedAmount: amount,
        displayText: `${amount.toFixed(2)} ${fromCurrency} (conversion failed)`,
      };
    }
  };

  // Convert all payments to invoice currency when component loads or payments change
  useEffect(() => {
    const convertAllPayments = async () => {
      if (!payments || payments.length === 0 || !currency) return;

      setIsLoadingConversions(true);

      try {
        const conversionsPromises = payments.map(async (payment) => {
          // CRITICAL FIX: Completely rewrite payment conversion logic
          // Priority: allocatedAmount > amountInInvoiceCurrency > conversionDetails > fallback conversion

          let convertedAmount = 0;
          let conversionInfo = null;

          // 1. HIGHEST PRIORITY: Use allocatedAmount if available (already in invoice currency)
          // Skip non-positive values — mixed-payment bug previously stored negative allocations
          // while keeping a positive `amount` for display; those must not zero out the total.
          const allocNum = Number(payment.allocatedAmount);
          if (
            payment.allocatedAmount !== undefined &&
            payment.allocatedAmount !== null &&
            !Number.isNaN(allocNum) &&
            allocNum > 0
          ) {
            convertedAmount = allocNum;
            conversionInfo = {
              success: true,
              rate:
                payment.amount > 0 ? allocNum / payment.amount : 1,
              convertedAmount: allocNum,
              displayText:
                payment.currency === currency
                  ? `${payment.amount.toFixed(2)} ${payment.currency}`
                  : `${payment.amount.toFixed(2)} ${
                      payment.currency
                    } = ${allocNum.toFixed(2)} ${currency}`,
            };
          }
          // 2. SECOND PRIORITY: Use amountInInvoiceCurrency if available (must be sensible)
          else if (
            payment.amountInInvoiceCurrency !== undefined &&
            payment.amountInInvoiceCurrency !== null &&
            !Number.isNaN(Number(payment.amountInInvoiceCurrency)) &&
            Number(payment.amountInInvoiceCurrency) > 0
          ) {
            convertedAmount = Number(payment.amountInInvoiceCurrency);
            conversionInfo = {
              success: true,
              rate:
                payment.amount > 0
                  ? payment.amountInInvoiceCurrency / payment.amount
                  : 1,
              convertedAmount: payment.amountInInvoiceCurrency,
              displayText:
                payment.currency === currency
                  ? `${payment.amount.toFixed(2)} ${payment.currency}`
                  : `${payment.amount.toFixed(2)} ${
                      payment.currency
                    } = ${payment.amountInInvoiceCurrency.toFixed(
                      2
                    )} ${currency}`,
            };
          }
          // 3. THIRD PRIORITY: Use stored conversion details
          else if (payment.conversionDetails) {
            convertedAmount = payment.conversionDetails.convertedAmount;
            conversionInfo = {
              success: true,
              rate:
                payment.conversionDetails.conversionRate ||
                payment.conversionDetails.convertedAmount /
                  payment.conversionDetails.originalAmount,
              convertedAmount: payment.conversionDetails.convertedAmount,
              displayText: `${payment.conversionDetails.originalAmount.toFixed(
                2
              )} ${
                payment.conversionDetails.originalCurrency
              } = ${payment.conversionDetails.convertedAmount.toFixed(2)} ${
                payment.conversionDetails.convertedCurrency
              }`,
            };
          }
          // 4. FALLBACK: Same currency or API conversion
          else {
            if (payment.currency === currency) {
              convertedAmount = payment.amount;
              conversionInfo = {
                success: true,
                rate: 1,
                convertedAmount: payment.amount,
                displayText: `${payment.amount.toFixed(2)} ${payment.currency}`,
              };
            } else {
              // Last resort: API conversion
              const conversion = await convertCurrency(
                payment.currency || currency,
                currency,
                payment.amount
              );
              convertedAmount = conversion.convertedAmount;
              conversionInfo = conversion;
            }
          }

          return {
            ...payment,
            conversion: conversionInfo,
            convertedAmount: convertedAmount,
          };
        });

        const convertedResults = await Promise.all(conversionsPromises);
        setConvertedPayments(convertedResults);

        // Calculate total paid in invoice currency
        const totalConverted = convertedResults.reduce(
          (sum, payment) => sum + payment.convertedAmount,
          0
        );
        setTotalPaidConverted(totalConverted);
      } catch (error) {
        console.error("Error converting payments:", error);
        // Fallback: use original amounts
        setConvertedPayments(
          payments.map((p) => ({ ...p, convertedAmount: p.amount }))
        );
        setTotalPaidConverted(payments.reduce((sum, p) => sum + p.amount, 0));
      } finally {
        setIsLoadingConversions(false);
      }
    };

    convertAllPayments();
  }, [payments, currency, adminInfo.token]);

  if (!payments || payments.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200/80 bg-white shadow-sm p-12 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
          <FileText className="h-8 w-8 text-slate-400" />
        </div>
        <p className="text-lg font-semibold text-slate-800 mb-2">
          {ciText("No payments recorded yet.")}
        </p>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          {ciText("Payments will appear here after you record them from this invoice.")}
        </p>
      </div>
    );
  }

  // Use database values for accurate calculations
  const totalReceived = totalPaidConverted;
  const remaining = invoice?.remaining || 0; // Use database remaining amount

  const handleDeleteClick = (payment) => {
    setSelectedPayment(payment);
    setDeleteModalOpen(true);
  };

  const handleViewClick = (payment) => {
    setSelectedPayment(payment);
    setViewModalOpen(true);
  };

  const confirmDelete = () => {
    if (typeof onDelete === "function") onDelete(selectedPayment._id);
    setDeleteModalOpen(false);
  };

  // Helper function to safely get bank account name
  const getBankAccountName = (depositTo) => {
    if (!depositTo) return "-";
    if (typeof depositTo === "string") return depositTo;
    return depositTo.accountName || "-";
  };

  const handleDownloadReceipt = async (p, idx) => {
    try {
      setDownloadingReceiptId(p._id);
      const businessId =
        invoice?.business_id?._id ??
        invoice?.business_id ??
        invoice?.business?._id ??
        invoice?.business;
      await downloadPaymentReceiptSlip({
        token: adminInfo?.token,
        businessId: businessId ? String(businessId) : "",
        invoice,
        payment: p,
        kind: "customer",
        paymentIndex: idx,
      });
      notifySuccess(ciText("Receipt downloaded"));
    } catch (e) {
      console.error(e);
      notifyError(ciText("Failed to download receipt"));
    } finally {
      setDownloadingReceiptId(null);
    }
  };

  const HandleOpenFile = async (documentId) => {
    console.log("document_id", documentId);
    try {
      let Response = await axios.get(
        `${Base_URL}/documents/getFileWithAllData/${documentId}`
      );
      console.log("document_id Response", Response);
      window.open(Response.data.data.url, "_blank");
    } catch (error) {
      notifyError(ciText("Error getting file"));
      console.log("Error : ", error);
    }
  };

  return (
    <>
      <div className="rounded-xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 tracking-tight">
              {ciText("Payments received")}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {ciText("All recorded allocations for this invoice, in document order.")}
            </p>
          </div>
          {isLoadingConversions && (
            <span className="text-xs font-medium text-slate-500 px-2.5 py-1 rounded-md bg-slate-100">
              {ciText("Converting amounts…")}
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90">
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  {ciText("Date")}
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  {ciText("Payment #")}
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  {ciText("Reference")}
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  {ciText("Payment mode")}
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide text-right">
                  {ciText("Amount")}
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide text-center w-[140px]">
                  {ciText("Actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
            {(convertedPayments.length > 0 ? convertedPayments : payments).map(
              (p, idx) => {
                const typeInfo = getPaymentTypeInfo(p);
                const showTypeChip = typeInfo.type !== "standard";
                const hasExpansion =
                  (p.appliedCredits?.length || 0) > 0 ||
                  (p.creditApplications?.length || 0) > 0 ||
                  !!p.conversionDetails;
                const payNum = displayPaymentNumber(p);
                const legacyNum = !p.paymentNumber?.trim();
                const primaryAmt =
                  p.amount != null && p.amount !== ""
                    ? Number(p.amount)
                    : Number(p.allocatedAmount || 0);

                return (
                <tr
                  key={p._id || idx}
                  className={`transition-colors ${
                    idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                  } hover:bg-slate-100/70`}
                >
                  <td className="px-4 py-3 whitespace-nowrap align-middle">
                    <span className="text-sm text-slate-800 font-medium tabular-nums">
                      {p.paymentDate ? formatDate(p.paymentDate) : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap align-middle">
                    <span
                      className={`inline-flex items-center font-mono text-xs font-semibold px-2 py-1 rounded-md border ${
                        legacyNum
                          ? "bg-amber-50 text-amber-900 border-amber-200"
                          : "bg-slate-100 text-slate-800 border-slate-200"
                      }`}
                      title={
                        legacyNum
                          ? "This line has no receipt number in the database. From PCI-BE run: node scripts/backfill-customer-invoice-payment-numbers.js <invoice ObjectId>"
                          : undefined
                      }
                    >
                      {payNum}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-middle max-w-[200px]">
                    <span
                      className="text-sm text-slate-700 truncate block"
                      title={p.reference || undefined}
                    >
                      {p.reference?.trim() ? p.reference : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <span className="text-sm font-medium text-slate-800">
                      {p.paymentMode || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top text-right">
                    <div className="flex flex-col items-end gap-1.5">
                      <span className="text-base font-semibold tabular-nums text-slate-900">
                        {formatAmountWithCurrency(
                          primaryAmt,
                          p.paymentCurrency || p.currency || currency
                        )}
                      </span>
                      {showTypeChip && (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${typeInfo.bgColor} ${typeInfo.color}`}
                        >
                          {typeInfo.icon}
                          {typeInfo.label}
                        </span>
                      )}
                      {p.amountInInvoiceCurrency != null &&
                        p.paymentCurrency !== p.invoiceCurrency &&
                        Number(p.amountInInvoiceCurrency) > 0 && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-600">
                            <ArrowRightLeft size={12} className="shrink-0" />
                            Invoice:{" "}
                            {formatAmountWithCurrency(
                              p.amountInInvoiceCurrency,
                              p.invoiceCurrency || currency
                            )}
                          </span>
                        )}
                      {paymentHasOverpayment(p) && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
                          <ArrowUp size={12} />
                          Overpay:{" "}
                          {formatAmountWithCurrency(
                            p.overpaymentAmountInPaymentCurrency ||
                              p.overpaymentAmount,
                            p.overpaymentCurrency ||
                              p.paymentCurrency ||
                              p.currency ||
                              currency
                          )}
                        </span>
                      )}
                      {p.remainingAfterPayment !== undefined && (
                        <span className="text-[11px] text-slate-500">
                          Balance after:{" "}
                          {formatAmountWithCurrency(
                            p.remainingAfterPayment,
                            p.invoiceCurrency || currency
                          )}
                        </span>
                      )}
                      {(p.appliedCredits?.length > 0 ||
                        p.creditApplications?.length > 0) && (
                        <span className="text-[11px] text-emerald-700">
                          + Credit lines:{" "}
                          {p.appliedCredits?.length ||
                            p.creditApplications?.length}
                        </span>
                      )}
                      <div className="flex items-center gap-1 mt-0.5">
                        {hasExpansion && (
                          <button
                            type="button"
                            onClick={() => togglePaymentExpansion(p._id)}
                            className="text-xs text-slate-500 hover:text-slate-800 underline underline-offset-2"
                          >
                            {expandedPayments.has(p._id)
                              ? "Hide details"
                              : "Details"}
                          </button>
                        )}
                        {isLoadingConversions && (
                          <span className="text-[10px] text-slate-400">
                            {ciText("Updating…")}
                          </span>
                        )}
                      </div>
                      {expandedPayments.has(p._id) && (
                        <div className="mt-2 w-full max-w-xs text-left p-3 rounded-lg border border-slate-200 bg-slate-50/80 space-y-3">
                          <h5 className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                            <Info size={14} />
                            {ciText("Breakdown")}
                          </h5>
                          {(p.appliedCredits?.length > 0 ||
                            p.creditApplications?.length > 0) && (
                            <div className="space-y-1">
                              {(p.appliedCredits ||
                                p.creditApplications ||
                                []
                              ).map((credit, cidx) => (
                                <div
                                  key={cidx}
                                  className="flex justify-between text-xs bg-white px-2 py-1.5 rounded border border-slate-100"
                                >
                                  <span className="text-emerald-800">
                                    {formatAmountWithCurrency(
                                      credit.originalAmount ||
                                        credit.amount ||
                                        0,
                                      credit.originalCurrency ||
                                        credit.currency
                                    )}
                                  </span>
                                  {credit.conversionDetails && (
                                    <span className="text-blue-600 flex items-center gap-0.5">
                                      <ArrowRightLeft size={10} />
                                      {formatAmountWithCurrency(
                                        credit.conversionDetails
                                          .convertedAmount,
                                        credit.conversionDetails.targetCurrency
                                      )}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          {p.conversionDetails && (
                            <div className="text-xs text-slate-600 space-y-1">
                              <div className="font-medium text-slate-700">
                                FX: 1 {p.conversionDetails.originalCurrency} ={" "}
                                {p.conversionDetails.conversionRate?.toFixed(6)}{" "}
                                {p.conversionDetails.convertedCurrency}
                              </div>
                              <div className="text-slate-500">
                                Source:{" "}
                                {p.conversionDetails.source || ciText("Exchange")}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center align-middle">
                    <div className="inline-flex items-center justify-center gap-0.5">
                      <button
                        type="button"
                        className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-[var(--p-blue)] transition-colors"
                        onClick={() => handleViewClick(p)}
                        title={ciText("View")}
                      >
                        <Eye size={17} />
                      </button>
                      <button
                        type="button"
                        className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-emerald-700 transition-colors disabled:opacity-40"
                        onClick={() => handleDownloadReceipt(p, idx)}
                        disabled={downloadingReceiptId === p._id}
                        title={
                          downloadingReceiptId === p._id
                            ? "Preparing receipt..."
                            : "Download receipt (template PDF)"
                        }
                      >
                        {downloadingReceiptId === p._id ? (
                          <Loader2 size={17} className="animate-spin" />
                        ) : (
                          <Download size={17} />
                        )}
                      </button>
                      {allowDelete && (
                        <button
                          type="button"
                          className="p-2 rounded-lg text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors"
                          onClick={() => handleDeleteClick(p)}
                          title={ciText("Delete")}
                        >
                          <Trash2 size={17} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
              }
            )}
            {/* Total Received Row */}
            <tr>
              <td colSpan="6" className="px-0 py-0 border-t border-slate-200">
                <div className="px-5 py-4 bg-slate-100/90">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white border border-slate-200 shadow-sm">
                        <CheckCircle size={20} className="text-emerald-600" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-800">
                          {ciText("Total received")}
                        </div>
                        {convertedPayments.some(
                          (p) => p.currency !== currency
                        ) && (
                          <div className="text-xs text-slate-500">
                            Converted to {currency}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {isLoadingConversions && (
                        <span className="text-xs font-medium text-slate-600 px-2 py-1 rounded-md bg-white border border-slate-200">
                          {ciText("Loading…")}
                        </span>
                      )}
                      <div className="px-4 py-2 rounded-lg bg-[#10468D] shadow-sm">
                        <span className="text-white font-bold text-lg tabular-nums">
                          {formatCurrencyAmount(currency, totalReceived)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </td>
            </tr>
            <tr>
              <td colSpan="6" className="px-0 py-0">
                <div className="px-5 py-4 bg-amber-50/90 border-t border-amber-100">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white border border-amber-100">
                        <AlertCircle size={20} className="text-amber-700" />
                      </div>
                      <span className="text-sm font-semibold text-amber-950">
                        {ciText("Remaining due")}
                      </span>
                    </div>
                    <div className="px-4 py-2 rounded-lg bg-[#0C2E5A] shadow-sm">
                      <span className="text-white font-bold text-lg tabular-nums">
                        {formatCurrencyAmount(currency, remaining)}
                      </span>
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {allowDelete && deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 relative animate-fade-in">
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
              onClick={() => setDeleteModalOpen(false)}
            >
              <X size={24} />
            </button>
            <div className="text-center mb-5">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <AlertCircle size={24} className="text-red-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {ciText("Delete Payment")}
              </h3>
              <p className="text-sm text-gray-500">
                Are you sure you want to delete this payment? This action cannot
                be undone.
              </p>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                type="button"
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                onClick={() => setDeleteModalOpen(false)}
              >
                {ciText("Cancel")}
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                onClick={confirmDelete}
              >
                {ciText("Delete")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Details Modal - Improved with wider width and better scrolling */}
      {viewModalOpen && selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 overflow-hidden">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl p-6 relative animate-fade-in mx-4">
            {/* Fixed header with close button that stays in place */}
            <div className="sticky top-0 z-10 bg-white pb-4 border-b border-gray-200 mb-5 flex justify-between items-center">
              <h3 className="text-xl font-semibold text-gray-900">
                {ciText("Payment Details")}
              </h3>
              <div className="flex items-center space-x-3">
                <span className="text-xs px-2 py-1 bg-slate-100 text-slate-700 rounded-md font-mono font-medium border border-slate-200">
                  {displayPaymentNumber(selectedPayment)}
                </span>
                <button
                  className="text-gray-400 hover:text-gray-700 ml-4"
                  onClick={() => setViewModalOpen(false)}
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Scrollable content area */}
            <div
              className="overflow-y-auto max-h-96 pr-2"
              style={{ scrollbarWidth: "thin" }}
            >
              <div className="mb-4">
                <div className="inline-flex items-center bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-medium mb-4">
                  {formatCurrencyAmount(
                    selectedPayment.currency || currency,
                    selectedPayment.amount,
                  )}
                </div>
                {/* Show conversion info if payment currency differs from invoice currency */}
                {selectedPayment.conversion &&
                  selectedPayment.currency !== currency &&
                  selectedPayment.conversion.success && (
                    <div className="inline-flex items-center bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs ml-2">
                      <ArrowRightLeft size={12} className="mr-1" />≈{" "}
                      {formatCurrencyAmount(
                        currency,
                        selectedPayment.convertedAmount,
                      )}
                    </div>
                  )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-500 mb-2 flex items-center">
                    <Calendar size={16} className="mr-2" />
                    {ciText("Payment Information")}
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-500">{ciText("Date")}</label>
                      <p className="font-medium text-gray-800">
                        {selectedPayment.paymentDate
                          ? formatDate(selectedPayment.paymentDate)
                          : "-"}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">
                        {ciText("Payment Mode")}
                      </label>
                      <p className="font-medium text-gray-800">
                        {selectedPayment.paymentMode}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">
                        {ciText("Reference Number")}
                      </label>
                      <p className="font-medium text-gray-800">
                        {selectedPayment.reference || "-"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-500 mb-2 flex items-center">
                    <DollarSign size={16} className="mr-2" />
                    {ciText("Financial Details")}
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-500">{ciText("Amount")}</label>
                      <p className="font-medium text-gray-800">
                        {formatCurrencyAmount(
                          selectedPayment.currency || currency,
                          selectedPayment.allocatedAmount ||
                            selectedPayment.amount,
                        )}
                      </p>
                      {paymentHasOverpayment(selectedPayment) && (
                        <p className="text-xs text-green-600 mt-1">
                          Overpayment:{" "}
                          {formatCurrencyAmount(
                            selectedPayment.overpaymentCurrency ||
                              selectedPayment.paymentCurrency ||
                              selectedPayment.currency ||
                              currency,
                            selectedPayment.overpaymentAmountInPaymentCurrency ||
                              selectedPayment.overpaymentAmount,
                          )}
                          {selectedPayment.overpaymentDetails &&
                            selectedPayment.overpaymentDetails
                              .paymentCurrency !==
                              selectedPayment.overpaymentDetails
                                .invoiceCurrency && (
                              <span className="text-gray-500 ml-1">
                                (=
                                {formatCurrencyAmount(
                                  selectedPayment.overpaymentDetails
                                    .invoiceCurrency,
                                  selectedPayment.overpaymentDetails
                                    .invoiceCurrencyAmount ||
                                    selectedPayment.overpaymentAmount,
                                )}
                                )
                              </span>
                            )}
                        </p>
                      )}
                      {selectedPayment.underpaymentAmount > 0 && (
                        <p className="text-xs text-orange-600 mt-1">
                          Underpayment:{" "}
                          {formatCurrencyAmount(
                            selectedPayment.currency || currency,
                            selectedPayment.underpaymentAmount,
                          )}
                        </p>
                      )}
                      {/* Show conversion details if different currency */}
                      {selectedPayment.conversion &&
                        selectedPayment.currency !== currency &&
                        selectedPayment.conversion.success && (
                          <p className="text-xs text-gray-500 mt-1">
                            <ArrowRightLeft size={12} className="inline mr-1" />
                            Converted:{" "}
                            {formatCurrencyAmount(
                              currency,
                              selectedPayment.convertedAmount,
                            )}
                            <br />
                            <span className="text-gray-400">
                              Rate: 1 {selectedPayment.currency} ={" "}
                              {selectedPayment.conversion.rate?.toFixed(6)}{" "}
                              {currency}
                            </span>
                          </p>
                        )}
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">
                        {ciText("Bank Charges")}
                      </label>
                      <p className="font-medium text-gray-800">
                        {selectedPayment.bankCharges
                          ? formatCurrencyAmount(
                              selectedPayment.currency || currency,
                              selectedPayment.bankCharges,
                            )
                          : "-"}
                      </p>
                    </div>
                    {selectedPayment.taxDeducted && (
                      <div>
                        <label className="text-xs text-gray-500">
                          {ciText("TDS Type")}
                        </label>
                        <p className="font-medium text-gray-800">
                          {selectedPayment.tdsType || "TDS"}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bank Account Details */}
                <div className="bg-gray-50 rounded-lg p-4 md:col-span-2">
                  <h4 className="text-sm font-medium text-gray-500 mb-2 flex items-center">
                    <Building size={16} className="mr-2" />
                    {ciText("Bank Account Details")}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs text-gray-500">
                        {ciText("Deposited To")}
                      </label>
                      <p className="font-medium text-gray-800">
                        {typeof selectedPayment.depositTo === "object" &&
                        selectedPayment.depositTo !== null
                          ? selectedPayment.depositTo.accountName || "-"
                          : typeof selectedPayment.depositTo === "string"
                          ? selectedPayment.depositTo
                          : "-"}
                      </p>
                    </div>

                    {typeof selectedPayment.depositTo === "object" &&
                      selectedPayment.depositTo !== null && (
                        <>
                          <div>
                            <label className="text-xs text-gray-500">
                              {ciText("Bank Name")}
                            </label>
                            <p className="font-medium text-gray-800">
                              {selectedPayment.depositTo.bankName || "-"}
                            </p>
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">
                              {ciText("Account Number")}
                            </label>
                            <p className="font-medium text-gray-800">
                              {selectedPayment.depositTo.accountNumber || "-"}
                            </p>
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">
                              {ciText("Account Type")}
                            </label>
                            <p className="font-medium text-gray-800">
                              {selectedPayment.depositTo.accountType || "-"}
                            </p>
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">
                              {ciText("Swift Code")}
                            </label>
                            <p className="font-medium text-gray-800">
                              {selectedPayment.depositTo.swiftCode || "-"}
                            </p>
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">
                              {ciText("IBAN")}
                            </label>
                            <p className="font-medium text-gray-800">
                              {selectedPayment.depositTo.iban || "-"}
                            </p>
                          </div>
                        </>
                      )}
                  </div>
                </div>
              </div>

              {/* Notes Section */}
              {selectedPayment.notes && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-500 mb-2 flex items-center">
                    <FileText size={16} className="mr-2" />
                    {ciText("Notes")}
                  </h4>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-gray-700">{selectedPayment.notes}</p>
                  </div>
                </div>
              )}

              {/* Attachment Section */}
              {selectedPayment.attachment && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-500 mb-2 flex items-center">
                    <FileText size={16} className="mr-2" />
                    {ciText("Attachment")}
                  </h4>
                  <div className="bg-gray-50 p-4 rounded-lg flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="bg-blue-100 p-2 rounded-lg mr-3">
                        <FileText size={20} className="text-[var(--p-blue)]" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-800 text-sm">
                          {selectedPayment.attachment.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {Math.round(selectedPayment.attachment.size / 1024)}{" "}
                          KB
                        </p>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() =>
                          HandleOpenFile(selectedPayment.attachment.fileId)
                        }
                        className="px-3 py-1.5 bg-[var(--p-blue)] text-white rounded-md flex items-center transition-colors"
                      >
                        <Eye size={14} className="mr-1.5" />
                        {ciText("View")}
                      </button>
                      {/* <a
                        href={selectedPayment.attachment.downloadUrl || selectedPayment.attachment.url || "#"}
                        download={selectedPayment.attachment.name}
                        className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-md flex items-center hover:bg-gray-300 transition-colors"
                      >
                        <Download size={14} className="mr-1.5" />
                        {ciText("Download")}
                      </a> */}
                    </div>
                  </div>
                </div>
              )}

              {/* Additional Info */}
              <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-700 mb-6 flex items-start">
                <AlertCircle size={16} className="mr-2 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium mb-1">{ciText("Payment Info")}</p>
                  <p>
                    This payment was recorded on{" "}
                    {formatDate(selectedPayment.createdAt)} and sent to{" "}
                    {selectedPayment.email || "N/A"}.
                  </p>
                  {selectedPayment.emailThankYou && (
                    <p className="mt-1">
                      A thank you email was sent to the customer.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Fixed footer with buttons */}
            <div className="border-t border-gray-200 pt-4 mt-4 flex justify-end flex-wrap gap-3">
              <button
                type="button"
                className="p-2.5 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 border border-emerald-200 flex items-center justify-center disabled:opacity-50"
                onClick={() => {
                  const i = payments.findIndex(
                    (x) => x._id === selectedPayment._id
                  );
                  handleDownloadReceipt(selectedPayment, i >= 0 ? i : 0);
                }}
                disabled={downloadingReceiptId === selectedPayment?._id}
                title={
                  downloadingReceiptId === selectedPayment?._id
                    ? "Preparing receipt..."
                    : "Download receipt (PDF)"
                }
                aria-label={ciText("Download receipt (PDF)")}
              >
                {downloadingReceiptId === selectedPayment?._id ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <Download size={20} />
                )}
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 flex items-center"
                onClick={() => setViewModalOpen(false)}
              >
                {ciText("Close")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PaymentsTable;
