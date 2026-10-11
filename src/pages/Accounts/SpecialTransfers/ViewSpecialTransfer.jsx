import React, { useState, useEffect, useContext } from "react";
import {
  ArrowLeft,
  Building,
  User,
  CreditCard,
  DollarSign,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  ArrowRight,
  Edit,
  Save,
  X,
  Download,
} from "lucide-react";
import { useParams, useHistory } from "react-router-dom";
import axios from "axios";
import { notifyError, notifySuccess } from "@/utils/toast";
import { AdminContext } from "@/context/AdminContext";
import BackButton from "@/components/BackButton";
import { formatAmount, formatDate } from "@/components/formatAmount";
import SearchableDropdown from "@/components/SearchableDropdown";

// Format date for input fields
function formatDateForInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const ViewSpecialTransfer = () => {
  const { id } = useParams();
  const history = useHistory();
  const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isRecordingPayBack, setIsRecordingPayBack] = useState(false);
  const [showPayBackModal, setShowPayBackModal] = useState(false);
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;

  const [transfer, setTransfer] = useState(null);
  const [currencies, setCurrencies] = useState([]);
  const [destinationCurrencies, setDestinationCurrencies] = useState([]);
  const [sourceCurrencies, setSourceCurrencies] = useState([]);
  const [convertedBankCharges, setConvertedBankCharges] = useState(null);
  const [updateData, setUpdateData] = useState({
    status: "",
    bankCharges: "",
    bankChargesCurrency: "USD",
    bankChargesAppliedTo: "sender",
    senderCharges: "",
    senderChargesCurrency: "USD",
    notes: "",
  });

  const [payBackData, setPayBackData] = useState({
    amount: "",
    currency: "",
    payBackDate: formatDateForInput(new Date()),
    notes: "",
  });

  // Function to convert bank charges to destination currency (same as ViewVendorInvoice)
  const convertBankCharges = async (fromCurrency, toCurrency, amount) => {
    if (fromCurrency === toCurrency) {
      return amount;
    }

    try {
      const response = await axios.get(`${Base_URL}/currency/convert`, {
        params: {
          from: fromCurrency,
          to: toCurrency,
          amount: amount,
          businessId: transfer?.business?._id || transfer?.business,
        },
        headers: {
          authorization: `Bearer ${adminInfo.token}`,
        },
      });

      if (response.data.success) {
        return response.data.convertedAmount;
      }
    } catch (error) {
      console.error("Error converting bank charges:", error);
    }

    return amount; // Fallback to original amount if conversion fails
  };
  const [totalPaidBackData, setTotalPaidBackData] = useState(null);

  useEffect(() => {
    fetchTransfer();
  }, [id]);

  useEffect(() => {
    if (transfer && transfer.isPayBackTransfer) {
      fetchTotalPaidBackData();
    }
  }, [transfer]);

  const fetchTransfer = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${Base_URL}/special-transfers/${id}`, {
        headers: {
          authorization: `Bearer ${adminInfo.token}`,
        },
      });

      if (response.data.success) {
        const transferData = response.data.data;
        setTransfer(transferData);
        // Auto-populate currencies based on bank accounts
        const destinationBankCurrency =
          transferData.destinationBankAccount?.currencyType || "USD";
        const sourceBankCurrency =
          transferData.sourceBankAccount?.currencyType || "USD";

        setUpdateData({
          status: transferData.status,
          bankCharges: transferData.conversionDetails?.bankCharges || 0,
          bankChargesCurrency: destinationBankCurrency, // Auto-populate with destination bank currency
          bankChargesAppliedTo:
            transferData.conversionDetails?.bankChargesAppliedTo || "sender",
          senderCharges: transferData.conversionDetails?.senderCharges || 0,
          senderChargesCurrency: sourceBankCurrency, // Auto-populate with source bank currency
          notes: transferData.notes || "",
        });

        // Fetch currencies for the source business
        if (transferData.sourceBusiness) {
          try {
            const currencyResponse = await axios.get(
              `${Base_URL}/finance/currencies?business_id=${transferData.sourceBusiness._id}`,
              {
                headers: {
                  authorization: `Bearer ${adminInfo.token}`,
                },
              }
            );
            setCurrencies(currencyResponse.data.data || []);
            setSourceCurrencies(currencyResponse.data.data || []);
          } catch (error) {
            console.error("Error fetching source currencies:", error);
          }
        }

        // Fetch currencies for the destination business (for payback modal)
        if (transferData.destinationBusiness) {
          try {
            const destCurrencyResponse = await axios.get(
              `${Base_URL}/finance/currencies?business_id=${transferData.destinationBusiness._id}`,
              {
                headers: {
                  authorization: `Bearer ${adminInfo.token}`,
                },
              }
            );
            setDestinationCurrencies(destCurrencyResponse.data.data || []);

            // Set initial payback currency to destination bank currency
            setPayBackData((prev) => ({
              ...prev,
              currency:
                transferData.destinationBankAccount?.currencyType || "USD",
            }));
          } catch (error) {
            console.error("Error fetching destination currencies:", error);
          }
        }

        // Convert bank charges to destination currency if needed (same as ViewVendorInvoice)
        if (transferData.conversionDetails?.bankCharges > 0) {
          const bankChargesCurrency =
            transferData.conversionDetails.bankChargesCurrency;
          const destinationCurrency =
            transferData.conversionDetails.exchangeRate !== 1
              ? transferData.conversionDetails.toCurrency
              : transferData.sourceCurrency;

          if (bankChargesCurrency !== destinationCurrency) {
            const convertedAmount = await convertBankCharges(
              bankChargesCurrency,
              destinationCurrency,
              transferData.conversionDetails.bankCharges
            );
            setConvertedBankCharges(convertedAmount);
          } else {
            setConvertedBankCharges(transferData.conversionDetails.bankCharges);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching transfer:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTotalPaidBackData = async () => {
    try {
      const response = await axios.get(
        `${Base_URL}/special-transfers/${id}/total-paid-back`,
        {
          headers: {
            authorization: `Bearer ${adminInfo.token}`,
          },
        }
      );

      if (response.data.success) {
        setTotalPaidBackData(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching total paid back data:", error);
    }
  };

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      const payload = {
        status: updateData.status,
        bankCharges: parseFloat(updateData.bankCharges) || 0,
        bankChargesCurrency: updateData.bankChargesCurrency,
        bankChargesAppliedTo: updateData.bankChargesAppliedTo,
        senderCharges: parseFloat(updateData.senderCharges) || 0,
        senderChargesCurrency: updateData.senderChargesCurrency,
        notes: updateData.notes,
      };

      const response = await axios.put(
        `${Base_URL}/special-transfers/${id}`,
        payload,
        {
          headers: {
            authorization: `Bearer ${adminInfo.token}`,
          },
        }
      );

      if (response.data.success) {
        notifySuccess("Transfer updated successfully");
        setTransfer(response.data.data);
        setIsEditing(false);
        fetchTransfer(); // Refresh data
      } else {
        notifyError(response.data.error || "Failed to update transfer");
      }
    } catch (error) {
      console.error("Error updating transfer:", error);
      notifyError(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Failed to update transfer"
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRecordPayBack = async () => {
    if (!payBackData.amount || parseFloat(payBackData.amount) <= 0) {
      notifyError("Please enter a valid pay back amount");
      return;
    }

    setIsRecordingPayBack(true);
    try {
      const payload = {
        amount: parseFloat(payBackData.amount),
        currency: payBackData.currency,
        payBackDate: payBackData.payBackDate,
        notes: payBackData.notes,
      };

      const response = await axios.post(
        `${Base_URL}/special-transfers/${id}/payback`,
        payload,
        {
          headers: {
            authorization: `Bearer ${adminInfo.token}`,
          },
        }
      );

      if (response.data.success) {
        notifySuccess("Pay back recorded successfully");
        setTransfer(response.data.data);
        setShowPayBackModal(false);
        setPayBackData({
          amount: "",
          currency: transfer?.destinationBankAccount?.currencyType || "USD",
          payBackDate: formatDateForInput(new Date()),
          notes: "",
        });
        fetchTransfer(); // Refresh data
        fetchTotalPaidBackData(); // Refresh total paid back data
      } else {
        notifyError(response.data.error || "Failed to record pay back");
      }
    } catch (error) {
      console.error("Error recording pay back:", error);
      notifyError(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Failed to record pay back"
      );
    } finally {
      setIsRecordingPayBack(false);
    }
  };

  const handleOpenFile = async (documentId) => {
    if (!documentId) return;

    try {
      const response = await axios.get(
        `${Base_URL}/documents/getFileWithAllData/${documentId}`
      );
      window.open(response.data.data.url, "_blank");
    } catch (error) {
      notifyError("Error getting file");
      console.log("Error: ", error);
    }
  };

  const handleDownloadFile = async (documentId) => {
    if (!documentId) return;

    try {
      let response = await axios.get(
        `${Base_URL}/documents/getFileWithAllData/${documentId}`
      );
      console.log("response", response.data);

      const fileData = response.data.data;
      const fileUrl = fileData.url;
      const fileName = fileData.name;

      await downloadFileFromUrl(fileUrl, fileName);
    } catch (error) {
      console.error("Error getting file:", error);
      alert("Failed to download file. Please try again.");
    }
  };

  const downloadFileFromUrl = async (url, filename) => {
    try {
      const response = await fetch(url, { credentials: "include" });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();

      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;

      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      console.log(`File downloaded: ${filename}`);
    } catch (error) {
      console.error("Error downloading file:", error);
      throw error;
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      Floating: "bg-yellow-100 text-yellow-800 border-yellow-300",
      Completed: "bg-green-100 text-green-800 border-green-300",
      Cancelled: "bg-red-100 text-red-800 border-red-300",
      Failed: "bg-gray-100 text-gray-800 border-gray-300",
      PaidBack: "bg-blue-100 text-blue-800 border-blue-300",
    };
    return colors[status] || "bg-gray-100 text-gray-800 border-gray-300";
  };

  const getTransferTypeColor = (type) => {
    const colors = {
      inter_company: "bg-blue-50 text-blue-700",
      third_party_payment: "bg-purple-50 text-purple-700",
      third_party_received: "bg-orange-50 text-orange-700",
      invoice_payment: "bg-green-50 text-green-700",
    };
    return colors[type] || "bg-gray-50 text-gray-700";
  };

  const getTransferTypeLabel = (type) => {
    const labels = {
      inter_company: "Inter Company",
      third_party_payment: "Third Party Payment",
      third_party_received: "Third Party Received",
      invoice_payment: "Invoice Payment",
    };
    return labels[type] || type;
  };

  if (isLoading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--p-blue)]"></div>
          <span className="ml-2 text-gray-600">
            Loading transfer details...
          </span>
        </div>
      </div>
    );
  }

  if (!transfer) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="text-center">
          <AlertCircle size={48} className="mx-auto text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-600">
            Transfer not found
          </h2>
          <p className="text-gray-500 mt-2">
            The transfer you're looking for doesn't exist.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <BackButton />
      </div>

      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800 mb-2">
              Transfer #{transfer.transferNumber}
            </h1>
            <p className="text-gray-600">
              {getTransferTypeLabel(transfer.transferType)} •{" "}
              {transfer.transactionType}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(
                transfer.status
              )}`}
            >
              {transfer.status === "Floating" && (
                <Clock size={14} className="mr-1" />
              )}
              {transfer.status === "Completed" && (
                <CheckCircle size={14} className="mr-1" />
              )}
              {transfer.status === "Cancelled" && (
                <XCircle size={14} className="mr-1" />
              )}
              {transfer.status}
            </span>
            {(transfer.status === "Floating" ||
              transfer.status === "Completed") && (
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="flex items-center gap-2 px-3 py-2 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[#9CBA33] transition-colors"
              >
                {isEditing ? <X size={16} /> : <Edit size={16} />}
                {isEditing ? "Cancel" : "Edit Charges"}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Transfer Details */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
            <FileText size={20} className="mr-2" />
            Transfer Details
          </h2>

          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-gray-600">Transfer Number:</span>
              <span className="font-medium">#{transfer.transferNumber}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600">Transfer Type:</span>
              <span
                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getTransferTypeColor(
                  transfer.transferType
                )}`}
              >
                {getTransferTypeLabel(transfer.transferType)}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600">Transaction Type:</span>
              <span className="font-medium">{transfer.transactionType}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600">Transfer Date:</span>
              <span className="font-medium">
                {formatDate(transfer.transferDate)}
              </span>
            </div>

            {transfer.completionDate && (
              <div className="flex justify-between">
                <span className="text-gray-600">Completion Date:</span>
                <span className="font-medium">
                  {formatDate(transfer.completionDate)}
                </span>
              </div>
            )}

            {transfer.reference && (
              <div className="flex justify-between">
                <span className="text-gray-600">Reference:</span>
                <span className="font-medium">{transfer.reference}</span>
              </div>
            )}
          </div>
        </div>

        {/* Source Information */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
            <Building size={20} className="mr-2" />
            Source Information
          </h2>

          <div className="space-y-4">
            <div>
              <span className="text-gray-600 text-sm">Business:</span>
              <p className="font-medium">{transfer.sourceBusiness?.name}</p>
            </div>

            <div>
              <span className="text-gray-600 text-sm">Bank Account:</span>
              <p className="font-medium">
                {transfer.sourceBankAccount?.accountName} -{" "}
                {transfer.sourceBankAccount?.bankName}
              </p>
              <p className="text-sm text-gray-500">
                Account: {transfer.sourceBankAccount?.accountNumber}
              </p>
            </div>

            <div>
              <span className="text-gray-600 text-sm">Amount:</span>
              <p className="font-bold text-lg text-gray-800">
                {transfer.sourceCurrency} {formatAmount(transfer.sourceAmount)}
              </p>
            </div>

            <div>
              <span className="text-gray-600 text-sm">Account Code:</span>
              {transfer.accountCode ? (
                <>
                  <p className="font-medium">
                    {transfer.accountCode.code} -{" "}
                    {transfer.accountCode.accountName}
                  </p>
                  {transfer.accountCode.accountType && (
                    <p className="text-sm text-gray-500">
                      Type:{" "}
                      {transfer.accountCode.accountType.name ||
                        transfer.accountCode.accountType.accountHeader}
                    </p>
                  )}
                </>
              ) : (
                <p className="font-medium text-gray-400">Not specified</p>
              )}
            </div>
          </div>
        </div>

        {/* Destination Information */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
            {transfer.transferType === "inter_company" ? (
              <Building size={20} className="mr-2" />
            ) : transfer.transferType === "payback_transfer" ? (
              <Building size={20} className="mr-2" />
            ) : (
              <User size={20} className="mr-2" />
            )}
            Destination Information
          </h2>

          <div className="space-y-4">
            {transfer.transferType === "inter_company" ? (
              <>
                <div>
                  <span className="text-gray-600 text-sm">Business:</span>
                  <p className="font-medium">
                    {transfer.destinationBusiness?.name}
                  </p>
                </div>

                <div>
                  <span className="text-gray-600 text-sm">Bank Account:</span>
                  <p className="font-medium">
                    {transfer.destinationBankAccount?.accountName} -{" "}
                    {transfer.destinationBankAccount?.bankName}
                  </p>
                  <p className="text-sm text-gray-500">
                    Account: {transfer.destinationBankAccount?.accountNumber}
                  </p>
                </div>

                <div>
                  <span className="text-gray-600 text-sm">Amount:</span>
                  <p className="font-bold text-lg text-gray-800">
                    {transfer.destinationCurrency}{" "}
                    {formatAmount(
                      transfer.conversionDetails?.convertedAmount ||
                        transfer.sourceAmount
                    )}
                  </p>
                </div>
              </>
            ) : transfer.transferType === "payback_transfer" ? (
              <>
                <div>
                  <span className="text-gray-600 text-sm">Business:</span>
                  <p className="font-medium">
                    {transfer.destinationDetails?.businessName ||
                      transfer.destinationBusiness?.name}
                  </p>
                </div>

                <div>
                  <span className="text-gray-600 text-sm">Bank Account:</span>
                  <p className="font-medium">
                    {transfer.destinationDetails?.accountName ||
                      transfer.destinationBankAccount?.accountName}{" "}
                    -{" "}
                    {transfer.destinationDetails?.bankName ||
                      transfer.destinationBankAccount?.bankName}
                  </p>
                  <p className="text-sm text-gray-500">
                    Account:{" "}
                    {transfer.destinationDetails?.accountNumber ||
                      transfer.destinationBankAccount?.accountNumber}
                  </p>
                </div>

                <div>
                  <span className="text-gray-600 text-sm">Amount:</span>
                  <p className="font-bold text-lg text-gray-800">
                    {transfer.sourceCurrency}{" "}
                    {formatAmount(transfer.sourceAmount)}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <span className="text-gray-600 text-sm">Name:</span>
                  <p className="font-medium">{transfer.thirdPartyInfo?.name}</p>
                </div>

                <div>
                  <span className="text-gray-600 text-sm">Bank:</span>
                  <p className="font-medium">
                    {transfer.thirdPartyInfo?.bankName}
                  </p>
                </div>

                <div>
                  <span className="text-gray-600 text-sm">Account Number:</span>
                  <p className="font-medium">
                    {transfer.thirdPartyInfo?.accountNumber}
                  </p>
                </div>

                <div>
                  <span className="text-gray-600 text-sm">Reason:</span>
                  <p className="font-medium">
                    {transfer.thirdPartyInfo?.reason}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Currency Conversion Details */}
        {transfer.conversionDetails && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
              <DollarSign size={20} className="mr-2" />
              {transfer.conversionDetails.exchangeRate !== 1
                ? "Currency Conversion"
                : "Transfer Details"}
            </h2>

            <div className="space-y-4">
              {/* Total Sent */}
              <div className="flex justify-between">
                <span className="text-gray-600">Total Sent:</span>
                <span className="font-bold text-lg text-gray-800">
                  {transfer.sourceCurrency}{" "}
                  {formatAmount(transfer.sourceAmount)}
                </span>
              </div>

              {/* Total Out - Only show if sender charges exist */}
              {transfer.conversionDetails?.senderCharges &&
                transfer.conversionDetails.senderCharges > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Out:</span>
                    <span className="font-bold text-lg text-orange-800">
                      {transfer.sourceCurrency}{" "}
                      {formatAmount(
                        transfer.sourceAmount +
                          (transfer.conversionDetails.senderCharges || 0)
                      )}
                    </span>
                  </div>
                )}

              {transfer.conversionDetails.exchangeRate !== 1 && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-600">From Currency:</span>
                    <span className="font-medium">
                      {transfer.conversionDetails.fromCurrency}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-600">To Currency:</span>
                    <span className="font-medium">
                      {transfer.conversionDetails.toCurrency}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-600">Exchange Rate:</span>
                    <span className="font-medium">
                      {transfer.conversionDetails.exchangeRate}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-600">Converted Amount:</span>
                    <span className="font-medium">
                      {transfer.conversionDetails.toCurrency}{" "}
                      {formatAmount(transfer.conversionDetails.convertedAmount)}
                    </span>
                  </div>
                </>
              )}

              {transfer.conversionDetails.bankCharges &&
                transfer.conversionDetails.bankCharges > 0 && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600">
                        Bank Charges (Receiver):
                      </span>
                      <span className="font-medium text-red-600">
                        {transfer.conversionDetails.bankChargesCurrency ||
                          (transfer.conversionDetails.exchangeRate !== 1
                            ? transfer.conversionDetails.toCurrency
                            : transfer.sourceCurrency)}{" "}
                        {formatAmount(transfer.conversionDetails.bankCharges)}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Received:</span>
                      <span className="font-bold text-lg text-green-800">
                        {transfer.conversionDetails.exchangeRate !== 1
                          ? transfer.conversionDetails.toCurrency
                          : transfer.sourceCurrency}{" "}
                        {formatAmount(
                          transfer.conversionDetails.netAmount -
                            (transfer.conversionDetails.bankCharges || 0)
                        )}
                      </span>
                    </div>

                    {/* Show calculation breakdown */}
                    <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600">
                      {transfer.conversionDetails.exchangeRate !== 1 ? (
                        <>
                          {transfer.conversionDetails.toCurrency}{" "}
                          {formatAmount(
                            transfer.conversionDetails.convertedAmount
                          )}
                          - {transfer.conversionDetails.toCurrency}{" "}
                          {formatAmount(convertedBankCharges || 0)}={" "}
                          {transfer.conversionDetails.toCurrency}{" "}
                          {formatAmount(transfer.conversionDetails.netAmount)}
                          <br />
                          {convertedBankCharges && (
                            <span className="text-gray-500">
                              (Bank charges:{" "}
                              {transfer.conversionDetails.bankChargesCurrency}{" "}
                              {formatAmount(
                                transfer.conversionDetails.bankCharges
                              )}{" "}
                              converted to{" "}
                              {transfer.conversionDetails.toCurrency}{" "}
                              {formatAmount(convertedBankCharges)})
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          {transfer.sourceCurrency}{" "}
                          {formatAmount(transfer.sourceAmount)}-{" "}
                          {transfer.conversionDetails.bankChargesCurrency}{" "}
                          {formatAmount(transfer.conversionDetails.bankCharges)}
                          = {transfer.sourceCurrency}{" "}
                          {formatAmount(transfer.conversionDetails.netAmount)}
                          <br />
                          <span className="text-gray-500">
                            (Bank charges in{" "}
                            {transfer.conversionDetails.bankChargesCurrency})
                          </span>
                        </>
                      )}
                    </div>

                    {/* Show conversion details for bank charges (similar to ViewVendorInvoice) */}
                    {convertedBankCharges &&
                      transfer.conversionDetails.bankChargesCurrency !==
                        (transfer.conversionDetails.exchangeRate !== 1
                          ? transfer.conversionDetails.toCurrency
                          : transfer.sourceCurrency) && (
                        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                          <div className="font-medium mb-1">
                            Bank Charges Conversion:
                          </div>
                          <div>
                            From:{" "}
                            <b>
                              {transfer.conversionDetails.bankChargesCurrency}
                            </b>{" "}
                            To:{" "}
                            <b>
                              {transfer.conversionDetails.exchangeRate !== 1
                                ? transfer.conversionDetails.toCurrency
                                : transfer.sourceCurrency}
                            </b>
                          </div>
                          <div>
                            Amount:{" "}
                            {transfer.conversionDetails.bankChargesCurrency}{" "}
                            {formatAmount(
                              transfer.conversionDetails.bankCharges
                            )}{" "}
                            ={" "}
                            {transfer.conversionDetails.exchangeRate !== 1
                              ? transfer.conversionDetails.toCurrency
                              : transfer.sourceCurrency}{" "}
                            {formatAmount(convertedBankCharges)}
                          </div>
                        </div>
                      )}
                  </>
                )}

              {/* Display Sender Charges if they exist */}
              {transfer.conversionDetails.senderCharges &&
                transfer.conversionDetails.senderCharges > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Sender Charges:</span>
                    <span className="font-medium text-orange-600">
                      {transfer.conversionDetails.senderChargesCurrency ||
                        transfer.sourceCurrency}{" "}
                      {formatAmount(transfer.conversionDetails.senderCharges)}
                    </span>
                  </div>
                )}

              {/* Show net payment in both currencies for currency conversion transfers */}
              {transfer.conversionDetails.exchangeRate !== 1 && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-medium text-blue-800 mb-2">
                    Net Payment
                  </h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-blue-600">
                        In {transfer.conversionDetails.toCurrency}:
                      </span>
                      <span className="font-medium">
                        {transfer.conversionDetails.toCurrency}{" "}
                        {formatAmount(transfer.conversionDetails.netAmount)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-600">
                        In {transfer.conversionDetails.fromCurrency}:
                      </span>
                      <span className="font-medium">
                        {transfer.conversionDetails.fromCurrency}{" "}
                        {formatAmount(
                          transfer.conversionDetails.netAmount /
                            transfer.conversionDetails.exchangeRate
                        )}
                      </span>
                    </div>
                    {transfer.conversionDetails.bankCharges > 0 && (
                      <div className="mt-2 pt-2 border-t border-blue-200">
                        <div className="text-xs text-blue-600">
                          Total Amount: {transfer.conversionDetails.toCurrency}{" "}
                          {formatAmount(
                            transfer.conversionDetails.convertedAmount
                          )}
                          - Bank Charges:{" "}
                          {transfer.conversionDetails.toCurrency}{" "}
                          {formatAmount(convertedBankCharges || 0)}= Net
                          Received: {transfer.conversionDetails.toCurrency}{" "}
                          {formatAmount(transfer.conversionDetails.netAmount)}
                          <br />
                          <span className="text-gray-500">
                            (Original:{" "}
                            {transfer.conversionDetails.bankChargesCurrency}{" "}
                            {formatAmount(
                              transfer.conversionDetails.bankCharges
                            )}{" "}
                            converted to {transfer.conversionDetails.toCurrency}{" "}
                            {formatAmount(convertedBankCharges || 0)})
                          </span>
                        </div>
                      </div>
                    )}

                    {transfer.conversionDetails.senderCharges > 0 && (
                      <div className="mt-1 text-xs text-orange-600">
                        + Sender Charges:{" "}
                        {transfer.conversionDetails.senderChargesCurrency}{" "}
                        {formatAmount(transfer.conversionDetails.senderCharges)}
                        (deducted from source account)
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pay Back Transfer Details */}
        {transfer.isPayBackTransfer && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
              <DollarSign size={20} className="mr-2" />
              Pay Back Transfer Details
            </h2>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="font-semibold">Pay Back Status:</span>
                  <span
                    className={`ml-2 px-2 py-1 rounded text-xs ${
                      transfer.payBackStatus === "Completed"
                        ? "bg-green-100 text-green-800"
                        : transfer.payBackStatus === "Partial"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {transfer.payBackStatus}
                  </span>
                </div>
                <div>
                  <span className="font-semibold">Expected Pay Back Date:</span>
                  <span className="ml-2">
                    {transfer.expectedPayBackDate
                      ? new Date(
                          transfer.expectedPayBackDate
                        ).toLocaleDateString()
                      : "Not specified"}
                  </span>
                </div>
                <div>
                  <span className="font-semibold">Total Paid Back:</span>
                  <span className="ml-2">
                    {totalPaidBackData ? (
                      <>
                        {totalPaidBackData.totalPaidBackInSourceCurrency.toFixed(
                          2
                        )}{" "}
                        {totalPaidBackData.sourceCurrency}
                        {totalPaidBackData.totalPaidBackInSourceCurrency >=
                          totalPaidBackData.sourceAmount && (
                          <span className="ml-2 text-green-600 font-medium">
                            ✓ Fully Paid Back
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        {transfer.payBackHistory
                          .reduce((total, record) => total + record.amount, 0)
                          .toFixed(2)}{" "}
                        {transfer.sourceCurrency}
                      </>
                    )}
                  </span>
                </div>

                {/* Remaining Amount */}
                {transfer.payBackStatus !== "Completed" &&
                  totalPaidBackData && (
                    <div>
                      <span className="font-semibold">Remaining Amount:</span>
                      <span className="ml-2 text-red-600 font-medium">
                        {(
                          totalPaidBackData.sourceAmount -
                          totalPaidBackData.totalPaidBackInSourceCurrency
                        ).toFixed(2)}{" "}
                        {totalPaidBackData.sourceCurrency}
                      </span>
                    </div>
                  )}
              </div>

              {/* Pay Back History */}
              {transfer.payBackHistory &&
                transfer.payBackHistory.length > 0 && (
                  <div className="mt-4">
                    <h3 className="font-medium text-gray-700 mb-2">
                      Pay Back History
                    </h3>
                    <div className="space-y-2">
                      {transfer.payBackHistory.map((record, index) => (
                        <div
                          key={index}
                          className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex-1">
                            <p className="font-medium">
                              {record.currency} {formatAmount(record.amount)}
                            </p>
                            <p className="text-sm text-gray-500">
                              {formatDate(record.payBackDate)}
                            </p>
                            {record.notes && (
                              <p className="text-sm text-gray-600">
                                {record.notes}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                              ✓ Ledger Entry Created
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Payback Ledger Transactions */}
              {/* {transfer.paybackTransactions &&
                transfer.paybackTransactions.length > 0 && (
                  <div className="mt-4">
                    <h3 className="font-medium text-gray-700 mb-2">
                      Payback Ledger Transactions
                    </h3>
                    <div className="space-y-2">
                      {transfer.paybackTransactions.map((paybackTx, index) => (
                        <div
                          key={index}
                          className="p-3 bg-blue-50 border border-blue-200 rounded-lg"
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="font-medium text-blue-800">
                                {paybackTx.transactionId?.reference}
                              </p>
                              <p className="text-sm text-blue-600">
                                {paybackTx.transactionId?.description}
                              </p>
                              <p className="text-xs text-blue-500">
                                {formatDate(paybackTx.transactionId?.date)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium text-blue-800">
                                {paybackTx.transactionId?.currency}{" "}
                                {formatAmount(paybackTx.transactionId?.amount)}
                              </p>
                              <span
                                className={`text-xs px-2 py-1 rounded ${
                                  paybackTx.type === "source"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {paybackTx.type === "source"
                                  ? "Income"
                                  : "Expense"}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )} */}

              {/* Record Pay Back Button */}
              {transfer.payBackStatus !== "Completed" && (
                <div className="mt-4">
                  <button
                    onClick={() => setShowPayBackModal(true)}
                    className="px-4 py-2 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[#9CBA33] transition-colors flex items-center"
                  >
                    <DollarSign size={16} className="mr-2" />
                    Record Pay Back
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
            <FileText size={20} className="mr-2" />
            Notes
          </h2>

          {isEditing ? (
            <textarea
              value={updateData.notes}
              onChange={(e) =>
                setUpdateData((prev) => ({ ...prev, notes: e.target.value }))
              }
              rows="4"
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] resize-none"
              placeholder="Enter notes..."
            />
          ) : (
            <p className="text-gray-700">
              {transfer.notes || "No notes available"}
            </p>
          )}
        </div>

        {/* Supporting Documents */}
        {transfer.documents && transfer.documents.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
              <FileText size={20} className="mr-2" />
              Supporting Documents
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {transfer.documents.map((doc, idx) => (
                <div
                  key={idx}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-3">
                    <FileText className="h-8 w-8 text-[var(--p-blue)] flex-shrink-0 mt-1" />
                    <div className="flex-1 min-w-0">
                      <h3
                        className="font-medium text-gray-900 truncate"
                        title={doc.name}
                      >
                        {doc.name}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {doc.description}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                        <span>Uploaded: {formatDate(doc.uploadedAt)}</span>
                        {doc.size && (
                          <span>
                            Size: {(doc.size / 1024 / 1024).toFixed(2)} MB
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => handleOpenFile(doc.fileId)}
                          className="text-sm text-[var(--p-blue)] hover:underline flex items-center gap-1"
                        >
                          <FileText size={14} />
                          View
                        </button>
                        <button
                          onClick={() => handleDownloadFile(doc.fileId)}
                          className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                        >
                          <Download size={14} />
                          Download
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Update Form - For Floating and Completed Transfers */}
      {isEditing &&
        (transfer.status === "Floating" || transfer.status === "Completed") && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-6">
            <h2 className="text-lg font-medium text-gray-800 mb-4">
              Update Transfer
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Status - Only for floating transfers */}
              {transfer.status === "Floating" && (
                <div>
                  <label className="block text-gray-700 mb-2">Status</label>
                  <SearchableDropdown
                    value={updateData.status}
                    onChange={(e) =>
                      setUpdateData((prev) => ({
                        ...prev,
                        status: e.target.value,
                      }))
                    }
                    placeholder="Select Status"
                    searchPlaceholder="Search status..."
                    options={[
                      { value: "Floating", label: "Floating" },
                      { value: "Completed", label: "Completed" },
                      { value: "Cancelled", label: "Cancelled" },
                      { value: "Failed", label: "Failed" },
                    ]}
                    searchKeys={["label"]}
                    renderOption={(option) => (
                      <div>
                        <div className="font-medium">{option.label}</div>
                      </div>
                    )}
                  />
                </div>
              )}

              {/* Bank Charges - Only for floating transfers */}
              {transfer.status === "Floating" && (
                <div>
                  <label className="block text-gray-700 mb-2">
                    Bank Charges
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={updateData.bankCharges}
                      onChange={(e) =>
                        setUpdateData((prev) => ({
                          ...prev,
                          bankCharges: e.target.value,
                        }))
                      }
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      className="w-full p-3 pr-16 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <span className="text-gray-500 text-sm">
                        {updateData.bankChargesCurrency}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Currency:{" "}
                    {transfer?.destinationBankAccount?.currencyType ||
                      transfer?.sourceBankAccount?.currencyType}{" "}
                    (auto)
                  </p>
                </div>
              )}

              {/* Sender Charges - Available for all transfer types and can be updated anytime */}
              <div>
                <label className="block text-gray-700 mb-2">
                  Sender Charges
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={updateData.senderCharges}
                    onChange={(e) =>
                      setUpdateData((prev) => ({
                        ...prev,
                        senderCharges: e.target.value,
                      }))
                    }
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className="w-full p-3 pr-16 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <span className="text-gray-500 text-sm">
                      {updateData.senderChargesCurrency}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Currency: {transfer?.sourceBankAccount?.currencyType} (auto) -
                  Can be updated anytime
                </p>
              </div>

              {/* Bank Charges Applied To - Only for floating transfers and non-invoice payments */}
              {transfer.status === "Floating" &&
                transfer?.transferType !== "invoice_payment" && (
                  <div>
                    <label className="block text-gray-700 mb-2">
                      Bank Charges Applied To
                    </label>
                    <SearchableDropdown
                      value={updateData.bankChargesAppliedTo}
                      onChange={(e) =>
                        setUpdateData((prev) => ({
                          ...prev,
                          bankChargesAppliedTo: e.target.value,
                        }))
                      }
                      placeholder="Select Applied To"
                      searchPlaceholder="Search options..."
                      options={[
                        { value: "sender", label: "Sender" },
                        { value: "payee", label: "Payee" },
                      ]}
                      searchKeys={["label"]}
                      renderOption={(option) => (
                        <div>
                          <div className="font-medium">{option.label}</div>
                        </div>
                      )}
                    />
                  </div>
                )}
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                disabled={isUpdating}
                className="px-4 py-2 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[#9CBA33] transition-colors flex items-center"
              >
                {isUpdating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Updating...
                  </>
                ) : (
                  <>
                    <Save size={16} className="mr-2" />
                    Update Transfer
                  </>
                )}
              </button>
            </div>
          </div>
        )}

      {/* Action Buttons */}
      <div className="flex justify-end gap-4 mt-6">
        <button
          onClick={() => history.goBack()}
          className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
        >
          Back
        </button>
        {transfer.status === "Floating" && !isEditing && (
          <button
            onClick={() =>
              history.push(`/update-special-transfer/${transfer._id}`)
            }
            className="px-6 py-3 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[#9CBA33] transition-colors flex items-center"
          >
            <Edit size={16} className="mr-2" />
            Edit Transfer
          </button>
        )}
      </div>

      {/* Pay Back Modal */}
      {showPayBackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative">
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-2xl focus:outline-none"
              onClick={() => setShowPayBackModal(false)}
            >
              &times;
            </button>
            <h2 className="text-xl font-bold mb-4 text-gray-800">
              Record Pay Back
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleRecordPayBack();
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pay Back Amount *
                </label>
                <input
                  type="number"
                  value={payBackData.amount}
                  onChange={(e) =>
                    setPayBackData((prev) => ({
                      ...prev,
                      amount: e.target.value,
                    }))
                  }
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Currency
                </label>
                <SearchableDropdown
                  value={payBackData.currency}
                  onChange={(e) =>
                    setPayBackData((prev) => ({
                      ...prev,
                      currency: e.target.value,
                    }))
                  }
                  placeholder="Select Currency"
                  searchPlaceholder="Search currencies..."
                  options={
                    destinationCurrencies.length > 0
                      ? destinationCurrencies.map((currency) => ({
                          value: currency.symbol,
                          label: `${currency.symbol} (${currency.prefix})`,
                          symbol: currency.symbol,
                          prefix: currency.prefix,
                        }))
                      : [
                          {
                            value:
                              transfer?.destinationBankAccount?.currencyType ||
                              "USD",
                            label: `${
                              transfer?.destinationBankAccount?.currencyType ||
                              "USD"
                            } (Destination Bank)`,
                            symbol:
                              transfer?.destinationBankAccount?.currencyType ||
                              "USD",
                            prefix: "Destination Bank",
                          },
                        ]
                  }
                  searchKeys={["symbol", "prefix"]}
                  renderOption={(option) => (
                    <div>
                      <div className="font-medium">{option.symbol}</div>
                      <div className="text-xs text-gray-500">
                        {option.prefix}
                      </div>
                    </div>
                  )}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pay Back Date
                </label>
                <input
                  type="date"
                  value={payBackData.payBackDate}
                  onChange={(e) =>
                    setPayBackData((prev) => ({
                      ...prev,
                      payBackDate: e.target.value,
                    }))
                  }
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={payBackData.notes}
                  onChange={(e) =>
                    setPayBackData((prev) => ({
                      ...prev,
                      notes: e.target.value,
                    }))
                  }
                  rows="3"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] resize-none"
                  placeholder="Enter notes about this pay back..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowPayBackModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRecordingPayBack}
                  className="px-4 py-2 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[#9CBA33] transition-colors flex items-center"
                >
                  {isRecordingPayBack ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Recording...
                    </>
                  ) : (
                    <>
                      <DollarSign size={16} className="mr-2" />
                      Record Pay Back
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ViewSpecialTransfer;
