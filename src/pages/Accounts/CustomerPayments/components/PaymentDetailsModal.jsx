import React, { useContext, useEffect, useState } from "react";
import { X, FileText, Eye, Download, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  formatDate,
  formatAmount,
  formatCurrencyAmount,
} from "@/components/formatAmount";
import axios from "axios";
import { notifyError, notifySuccess } from "@/utils/toast";
import { getCurrencyConversionDisplayLine } from "@/utils/currencyConversionDisplay";
import { AdminContext } from "@/context/AdminContext";
import { downloadPaymentReceiptSlip } from "@/utils/paymentReceiptFromTemplate";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

/** Modal footer downloads use same slip helper + spinner flush as list/action downloads. */
const PaymentDetailsModal = ({
  payment,
  onClose,
  isVendorPayment = false,
  invoice = null,
}) => {
  const { t } = useTranslation();
  const ns = isVendorPayment
    ? "accounts.vendorPayments"
    : "accounts.customerPayments";
  const tp = (key, defaultValue, options = {}) =>
    t(`${ns}.${key}`, { defaultValue, ...options });

  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const [accountTypeLabel, setAccountTypeLabel] = useState("");
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const partyEmail = isVendorPayment
    ? payment.email ||
      payment.vendor_id?.basicInformation?.email ||
      payment.vendor_id?.basicInformation?.vendorEmail
    : payment.email || payment.customer_id?.basicInformation?.customerEmail;

  const HandleOpenFile = async (documentId) => {
    try {
      let Response = await axios.get(
        `${Base_URL}/documents/getFileWithAllData/${documentId}`,
      );
      window.open(Response.data.data.url, "_blank");
    } catch (error) {
      notifyError(tp("errorGettingFile", "Error getting file"));
      console.log("Error : ", error);
    }
  };

  const handleDownloadPdfReceipt = async () => {
    try {
      setDownloadingPdf(true);
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
      const bid =
        payment?.business_id?._id ??
        payment?.business_id ??
        payment?.business?._id ??
        payment?.business;
      await downloadPaymentReceiptSlip({
        token: adminInfo?.token,
        businessId: bid ? String(bid) : "",
        invoice: invoice || null,
        payment,
        kind: isVendorPayment ? "vendor" : "customer",
        paymentIndex: 0,
      });
      notifySuccess(
        isVendorPayment
          ? tp("paymentSlipDownloaded", "Payment slip downloaded")
          : tp("receiptDownloaded", "Receipt downloaded"),
      );
    } catch (e) {
      console.error(e);
      notifyError(
        isVendorPayment
          ? tp("failedToDownloadPaymentSlip", "Failed to download payment slip")
          : tp("failedToDownloadReceipt", "Failed to download receipt"),
      );
    } finally {
      setDownloadingPdf(false);
    }
  };

  useEffect(() => {
    const loadAccountTypeLabel = async () => {
      const rawAccountType = payment?.depositTo?.accountType;

      if (!rawAccountType) {
        setAccountTypeLabel("");
        return;
      }

      // If it's already an object, try common name fields
      if (typeof rawAccountType === "object") {
        const name =
          rawAccountType.name ||
          rawAccountType.accountHeader ||
          rawAccountType.label ||
          "";
        setAccountTypeLabel(name);
        return;
      }

      // If it's a non-object value and doesn't look like a Mongo ID, use as-is
      if (typeof rawAccountType === "string" && rawAccountType.length !== 24) {
        setAccountTypeLabel(rawAccountType);
        return;
      }

      // Treat 24-char string as ID and resolve via API
      if (typeof rawAccountType === "string" && rawAccountType.length === 24) {
        try {
          const res = await axios.get(
            `${Base_URL}/bank-account-types/${rawAccountType}`,
          );
          setAccountTypeLabel(res.data?.name || rawAccountType);
        } catch (e) {
          console.error("Failed to load bank account type", e);
          setAccountTypeLabel(rawAccountType);
        }
        return;
      }

      setAccountTypeLabel(String(rawAccountType));
    };

    loadAccountTypeLabel();
  }, [payment?.depositTo?.accountType]);

  const currencyConversionLine = getCurrencyConversionDisplayLine(
    payment?.conversionDetails,
  );

  const renderBankDetails = () => {
    if (payment.paymentMode === "Bank Transfer") {
      return (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800">
            {tp("bankDetails", "Bank Details")}
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">
                {tp("bankName", "Bank Name")}
              </p>
              <p className="font-medium">{payment.depositTo?.bankName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">
                {tp("accountName", "Account Name")}
              </p>
              <p className="font-medium">{payment.depositTo?.accountName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">
                {tp("accountNumber", "Account Number")}
              </p>
              <p className="font-medium">{payment.depositTo?.accountNumber}</p>
            </div>
            {payment.reference && (
              <div>
                <p className="text-sm text-gray-600">
                  {tp("referenceNumber", "Reference Number")}
                </p>
                <p className="font-medium">{payment.reference}</p>
              </div>
            )}
            {accountTypeLabel && (
              <div>
                <p className="text-sm text-gray-600">
                  {tp("accountType", "Account Type")}
                </p>
                <p className="font-medium">{accountTypeLabel}</p>
              </div>
            )}
            {payment.depositTo?.swiftCode && (
              <div>
                <p className="text-sm text-gray-600">
                  {tp("swiftCode", "Swift Code")}
                </p>
                <p className="font-medium">{payment.depositTo.swiftCode}</p>
              </div>
            )}
            {payment.depositTo?.iban && (
              <div>
                <p className="text-sm text-gray-600">{tp("iban", "IBAN")}</p>
                <p className="font-medium">{payment.depositTo.iban}</p>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  const renderMoneyChangerDetails = () => {
    if (payment.paymentMode === "Money Changer") {
      return (
        <div className="space-y-4">
          {/* collection metadata intentionally omitted */}
        </div>
      );
    }
    return null;
  };

  const renderAttachment = () => {
    if (payment.attachment) {
      return (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800">
            {tp("attachment", "Attachment")}
          </h3>
          <div className="bg-gray-50 p-4 rounded-lg flex items-center justify-between">
            <div className="flex items-center">
              <div className="bg-blue-100 p-2 rounded-lg mr-3">
                <FileText size={20} className="text-[var(--p-blue)]" />
              </div>
              <div>
                <p className="font-medium text-gray-800 text-sm">
                  {payment.attachment.name}
                </p>
                <p className="text-xs text-gray-500">
                  {Math.round(payment.attachment.size / 1024)} KB
                </p>
              </div>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => HandleOpenFile(payment.attachment.fileId)}
                className="px-3 py-1.5 bg-[var(--p-blue)] text-white rounded-md flex items-center transition-colors"
              >
                <Eye size={14} className="mr-1.5" />
                {tp("view", "View")}
              </button>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] relative animate-fade-in flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Fixed Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-2xl font-bold text-gray-800">
            {tp("paymentDetails", "Payment Details")}
          </h2>
          <button
            className="text-gray-400 hover:text-gray-700 text-2xl focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] rounded-full p-1"
            onClick={onClose}
            aria-label={tp("close", "Close")}
          >
            <X size={24} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
          <div className="space-y-6">
            {/* Basic Payment Information */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">
                  {tp("invoiceNumber", "Invoice Number")}
                </p>
                <p className="font-medium">{payment.invoice_number}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">
                  {isVendorPayment
                    ? tp("vendorName", "Vendor Name")
                    : tp("customerName", "Customer Name")}
                </p>
                <p className="font-medium">
                  {isVendorPayment
                    ? payment.vendor_id?.basicInformation?.vendorDisplayName ||
                      payment.vendor_id?.basicInformation?.companyName ||
                      tp("notAvailable", "N/A")
                    : payment.customer_id?.basicInformation
                        ?.customerDisplayName}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">
                  {tp("paymentDate", "Payment Date")}
                </p>
                <p className="font-medium">{formatDate(payment.paymentDate)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">
                  {tp("paymentType", "Payment Type")}
                </p>
                <p className="font-medium">{payment.paymentMode}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">
                  {tp("amount", "Amount")}
                </p>
                <p className="font-medium">
                  {formatCurrencyAmount(payment.currency, payment.amount)}
                </p>
              </div>
            </div>

            {/* Bank Details or Money Changer Details */}
            {renderBankDetails()}
            {renderMoneyChangerDetails()}

            {/* Additional Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800">
                {tp("additionalInformation", "Additional Information")}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">
                    {tp("bankCharges", "Bank Charges")}
                  </p>
                  <p className="font-medium">
                    {payment.bankCharges
                      ? formatCurrencyAmount(
                          payment.currency,
                          payment.bankCharges,
                        )
                      : "0"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">
                    {tp("taxDeducted", "Tax Deducted")}
                  </p>
                  <p className="font-medium">
                    {payment.taxDeducted ? tp("yes", "Yes") : tp("no", "No")}
                  </p>
                </div>
                {payment.taxDeducted && (
                  <div>
                    <p className="text-sm text-gray-600">
                      {tp("tdsType", "TDS Type")}
                    </p>
                    <p className="font-medium">
                      {payment.tdsType || tp("notAvailable", "N/A")}
                    </p>
                  </div>
                )}
                {payment.overpaymentAmount > 0 && (
                  <div>
                    <p className="text-sm text-gray-600">
                      {tp("overpayment", "Overpayment")}
                    </p>
                    <div className="font-medium text-green-600">
                      <p>
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
                          <p className="text-sm text-gray-500 mt-1">
                            {tp(
                              "originalPayment",
                              "Original payment: {{currency}} {{amount}}",
                              {
                                currency:
                                  payment.overpaymentDetails.paymentCurrency,
                                amount: formatAmount(
                                  payment.overpaymentDetails
                                    .paymentCurrencyAmount,
                                ),
                              },
                            )}
                            <br />
                            {tp(
                              "conversionRate",
                              "Conversion rate: 1 {{paymentCurrency}} = {{rate}} {{invoiceCurrency}}",
                              {
                                paymentCurrency:
                                  payment.overpaymentDetails.paymentCurrency,
                                rate: payment.overpaymentDetails.conversionRate?.toFixed(
                                  4,
                                ),
                                invoiceCurrency:
                                  payment.overpaymentDetails.invoiceCurrency,
                              },
                            )}
                          </p>
                        )}
                    </div>
                  </div>
                )}
                {payment.underpaymentAmount > 0 && (
                  <div>
                    <p className="text-sm text-gray-600">
                      {tp("underpayment", "Underpayment")}
                    </p>
                    <p className="font-medium text-orange-600">
                      {formatCurrencyAmount(
                        payment.underpaymentCurrency ||
                          payment.invoiceCurrency ||
                          payment.currency,
                        payment.underpaymentAmount,
                      )}
                    </p>
                  </div>
                )}
                {currencyConversionLine && (
                  <div>
                    <p className="text-sm text-gray-600">
                      {tp("currencyConversion", "Currency Conversion")}
                    </p>
                    <p className="font-medium text-blue-600">
                      {currencyConversionLine}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            {payment.notes && (
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-gray-800">
                  {tp("notes", "Notes")}
                </h3>
                <p className="text-gray-600">{payment.notes}</p>
              </div>
            )}

            {/* Attachment */}
            {renderAttachment()}

            {/* Payment Info */}
            <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-700 mb-6 flex items-start">
              <div>
                <p className="font-medium mb-1">
                  {tp("paymentInfo", "Payment Info")}
                </p>
                <p>
                  {tp(
                    "paymentRecordedOn",
                    "This payment was recorded on {{date}}",
                    { date: formatDate(payment.createdAt) },
                  )}
                  {partyEmail
                    ? tp("andSentTo", " and sent to {{email}}.", {
                        email: partyEmail,
                      })
                    : tp("period", ".")}
                </p>
                {payment.emailThankYou && (
                  <p className="mt-1">
                    {tp(
                      "thankYouEmailSent",
                      "A thank you email was sent to the {{party}}.",
                      {
                        party: isVendorPayment
                          ? tp("vendor", "vendor")
                          : tp("customer", "customer"),
                      },
                    )}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Fixed Footer */}
        <div className="flex justify-end gap-3 flex-wrap p-6 pt-4 border-t border-gray-200 flex-shrink-0">
          <button
            type="button"
            disabled={downloadingPdf || !adminInfo?.token}
            onClick={handleDownloadPdfReceipt}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:pointer-events-none"
          >
            {downloadingPdf ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Download size={18} />
            )}
            {downloadingPdf
              ? isVendorPayment
                ? tp("preparingSlip", "Preparing slip…")
                : tp("preparingPdf", "Preparing PDF…")
              : isVendorPayment
                ? tp("downloadPaymentSlipPdf", "Download payment slip (PDF)")
                : tp("downloadReceiptPdf", "Download receipt (PDF)")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
          >
            {tp("close", "Close")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentDetailsModal;
