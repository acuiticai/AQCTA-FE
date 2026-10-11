import React, { useState, useEffect, useContext } from "react";
import {
  ArrowLeft,
  FileText,
  Download,
  Edit,
  Eye,
  DollarSign,
  Calendar,
  Building,
  User,
  PiggyBank,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  Upload,
  CreditCard,
  Calculator,
  Percent,
  Target,
  Banknote,
  ChevronDown,
} from "lucide-react";
import { useHistory, useParams } from "react-router-dom";
import axios from "axios";
import { AdminContext } from "@/context/AdminContext";
import { notifyError, notifySuccess } from "@/utils/toast";
import { formatDate, formatAmount } from "@/components/formatAmount";
import CustomDatePicker from "@/components/CustomDatePicker";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const ViewBorrowingInvoice = () => {
  const history = useHistory();
  const { id } = useParams();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;

  const [borrowing, setBorrowing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusUpdateLoading, setStatusUpdateLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);

  // Status update state
  const [selectedStatus, setSelectedStatus] = useState("");
  const [disbursementBankAccount, setDisbursementBankAccount] = useState("");
  const [bankAccounts, setBankAccounts] = useState([]);
  const [conversionDetails, setConversionDetails] = useState(null);
  const [isLoadingConversion, setIsLoadingConversion] = useState(false);

  // Payment state
  const [paymentData, setPaymentData] = useState({
    amount: 0,
    currency: "USD",
    paymentType: "combined",
    bankAccount: "",
    notes: "",
  });
  const [paymentConversionDetails, setPaymentConversionDetails] =
    useState(null);

  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo.token}`,
  };

  useEffect(() => {
    fetchBorrowing();
  }, [id]);

  const fetchBorrowing = async () => {
    try {
      const response = await axios.get(`${Base_URL}/borrowing-invoices/${id}`, {
        headers,
      });

      if (response.data.success) {
        const borrowingData = response.data.data;
        setBorrowing(borrowingData);
        setSelectedStatus(borrowingData.status);
        setPaymentData((prev) => ({
          ...prev,
          currency: borrowingData.currency,
        }));

        // Fetch bank accounts if needed
        if (
          ["Approved", "Disbursed", "Active"].includes(borrowingData.status)
        ) {
          fetchBankAccounts(borrowingData.business);
        }
      }
    } catch (error) {
      console.error("Error fetching borrowing:", error);
      notifyError("Failed to load borrowing invoice");
    } finally {
      setLoading(false);
    }
  };

  const fetchBankAccounts = async (businessId) => {
    try {
      const response = await axios.get(`${Base_URL}/bank-management/accounts`, {
        params: { business: businessId },
        headers,
      });
      setBankAccounts(response.data.accounts || []);
    } catch (error) {
      console.error("Error fetching bank accounts:", error);
    }
  };

  const getCurrencyConversion = async (fromCurrency, toCurrency, amount) => {
    if (fromCurrency === toCurrency || amount <= 0) {
      return {
        convertedAmount: amount,
        rate: 1,
        displayText: `${amount} ${fromCurrency} = ${amount} ${toCurrency} (Same Currency)`,
      };
    }

    try {
      const response = await axios.get(`${Base_URL}/currency/convert`, {
        params: { from: fromCurrency, to: toCurrency, amount },
        headers,
      });

      if (response.data.success) {
        return {
          convertedAmount: response.data.convertedAmount,
          rate: response.data.rate || response.data.exchangeRate,
          displayText:
            response.data.displayText ||
            `${amount} ${fromCurrency} = ${response.data.convertedAmount} ${toCurrency}`,
        };
      }
    } catch (error) {
      console.error("Currency conversion error:", error);
      throw error;
    }
  };

  const calculateConversionForAccount = async (account) => {
    if (!account || !borrowing) return;

    const accountCurrency = account.currencyType || account.currency;
    const borrowingCurrency = borrowing.currency;

    if (accountCurrency === borrowingCurrency) {
      setConversionDetails({
        requiredAmount: borrowing.principalAmount,
        exchangeRate: 1,
        displayText: `${borrowing.principalAmount} ${borrowingCurrency} = ${borrowing.principalAmount} ${accountCurrency} (Same Currency)`,
      });
      return;
    }

    setIsLoadingConversion(true);
    try {
      const conversion = await getCurrencyConversion(
        borrowingCurrency,
        accountCurrency,
        borrowing.principalAmount
      );

      setConversionDetails({
        requiredAmount: conversion.convertedAmount,
        exchangeRate: conversion.rate,
        displayText: conversion.displayText,
      });
    } catch (error) {
      notifyError("Failed to get currency conversion");
      setConversionDetails(null);
    } finally {
      setIsLoadingConversion(false);
    }
  };

  const calculatePaymentConversion = async (account, amount) => {
    if (!account || !borrowing || amount <= 0) return;

    const accountCurrency = account.currencyType || account.currency;
    const borrowingCurrency = borrowing.currency;

    if (accountCurrency === borrowingCurrency) {
      setPaymentConversionDetails({
        requiredAmount: amount,
        exchangeRate: 1,
        displayText: `${amount} ${borrowingCurrency} = ${amount} ${accountCurrency} (Same Currency)`,
      });
      return;
    }

    try {
      const conversion = await getCurrencyConversion(
        borrowingCurrency,
        accountCurrency,
        amount
      );

      setPaymentConversionDetails({
        requiredAmount: conversion.convertedAmount,
        exchangeRate: conversion.rate,
        displayText: conversion.displayText,
      });
    } catch (error) {
      console.error("Payment conversion error:", error);
      setPaymentConversionDetails(null);
    }
  };

  const handleBankAccountChange = async (accountId) => {
    setDisbursementBankAccount(accountId);
    const selectedAccount = bankAccounts.find((acc) => acc._id === accountId);
    if (selectedAccount) {
      await calculateConversionForAccount(selectedAccount);
    }
  };

  const handlePaymentBankAccountChange = async (accountId) => {
    setPaymentData((prev) => ({ ...prev, bankAccount: accountId }));
    const selectedAccount = bankAccounts.find((acc) => acc._id === accountId);
    if (selectedAccount && paymentData.amount > 0) {
      await calculatePaymentConversion(selectedAccount, paymentData.amount);
    }
  };

  const handlePaymentAmountChange = async (amount) => {
    setPaymentData((prev) => ({ ...prev, amount: parseFloat(amount) || 0 }));
    const selectedAccount = bankAccounts.find(
      (acc) => acc._id === paymentData.bankAccount
    );
    if (selectedAccount && amount > 0) {
      await calculatePaymentConversion(selectedAccount, parseFloat(amount));
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      Applied: "bg-blue-100 text-blue-800 border-blue-300",
      "Under Review": "bg-yellow-100 text-yellow-800 border-yellow-300",
      Approved: "bg-green-100 text-green-800 border-green-300",
      Disbursed: "bg-purple-100 text-purple-800 border-purple-300",
      Active: "bg-emerald-100 text-emerald-800 border-emerald-300",
      "Paid Off": "bg-gray-100 text-gray-800 border-gray-300",
      Defaulted: "bg-red-100 text-red-800 border-red-300",
      Cancelled: "bg-gray-100 text-gray-800 border-gray-300",
    };
    return colors[status] || "bg-gray-100 text-gray-800 border-gray-300";
  };

  const getBorrowingTypeLabel = (type) => {
    const labels = {
      bank_loan: "Bank Loan",
      line_of_credit: "Line of Credit",
      equipment_financing: "Equipment Financing",
      working_capital: "Working Capital",
      invoice_factoring: "Invoice Factoring",
      merchant_cash_advance: "Merchant Cash Advance",
      personal_guarantee: "Personal Guarantee",
      trade_credit: "Trade Credit",
      others: "Others",
    };
    return labels[type] || type;
  };

  const getValidStatusTransitions = (currentStatus) => {
    const transitions = {
      Applied: ["Under Review", "Cancelled"],
      "Under Review": ["Approved", "Cancelled"],
      Approved: ["Disbursed", "Cancelled"],
      Disbursed: ["Active"],
      Active: ["Paid Off", "Defaulted"],
      "Paid Off": [],
      Defaulted: ["Active"],
      Cancelled: [],
    };
    return transitions[currentStatus] || [];
  };

  const handleStatusUpdate = async () => {
    if (!selectedStatus || selectedStatus === borrowing.status) {
      notifyError("Please select a different status");
      return;
    }

    if (selectedStatus === "Disbursed" && !disbursementBankAccount) {
      notifyError("Please select a bank account for disbursement");
      return;
    }

    setStatusUpdateLoading(true);

    try {
      const updateData = {
        status: selectedStatus,
        ...(selectedStatus === "Disbursed" && {
          disbursementBankAccount,
          conversionDetails,
        }),
      };

      const response = await axios.put(
        `${Base_URL}/borrowing-invoices/${id}/status`,
        updateData,
        { headers }
      );

      if (response.data.success) {
        notifySuccess(`Status updated to ${selectedStatus}`);
        fetchBorrowing(); // Refresh data
      }
    } catch (error) {
      console.error("Status update error:", error);
      notifyError(error.response?.data?.error || "Failed to update status");
    } finally {
      setStatusUpdateLoading(false);
    }
  };

  const handleProcessPayment = async () => {
    if (!paymentData.amount || paymentData.amount <= 0) {
      notifyError("Please enter a valid payment amount");
      return;
    }

    if (!paymentData.bankAccount) {
      notifyError("Please select a bank account");
      return;
    }

    setPaymentLoading(true);

    try {
      const paymentPayload = {
        ...paymentData,
        conversionDetails: paymentConversionDetails,
      };

      const response = await axios.post(
        `${Base_URL}/borrowing-invoices/${id}/payment`,
        paymentPayload,
        { headers }
      );

      if (response.data.success) {
        notifySuccess("Payment processed successfully");
        setPaymentData({
          amount: 0,
          currency: borrowing.currency,
          paymentType: "combined",
          bankAccount: "",
          notes: "",
        });
        setPaymentConversionDetails(null);
        fetchBorrowing(); // Refresh data
      }
    } catch (error) {
      console.error("Payment processing error:", error);
      notifyError(error.response?.data?.error || "Failed to process payment");
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleOpenFile = async (documentId) => {
    try {
      const response = await axios.get(
        `${Base_URL}/documents/getFileWithAllData/${documentId}`
      );
      window.open(response.data.data.url, "_blank");
    } catch (error) {
      notifyError("Error opening file");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-[var(--p-blue)]"></div>
      </div>
    );
  }

  if (!borrowing) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Borrowing invoice not found</p>
      </div>
    );
  }

  const validTransitions = getValidStatusTransitions(borrowing.status);

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-full mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                className="flex items-center text-gray-600 hover:text-gray-800 mr-4"
                onClick={() => history.goBack()}
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Borrowing Invoice #{borrowing.borrowingNumber}
                </h1>
                <p className="text-gray-600 mt-1">
                  {getBorrowingTypeLabel(borrowing.borrowingType)} •{" "}
                  {borrowing.lender?.basicInformation?.vendorDisplayName}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(
                  borrowing.status
                )}`}
              >
                {borrowing.status}
              </span>
              <button
                onClick={() => history.push(`/update-borrowing-invoice/${id}`)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Edit size={16} />
                Edit
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Borrowing Details */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">
                Borrowing Details
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center">
                    <PiggyBank className="h-5 w-5 text-gray-400 mr-3" />
                    <div>
                      <p className="text-sm text-gray-600">Principal Amount</p>
                      <p className="font-semibold text-lg">
                        {borrowing.currency}{" "}
                        {formatAmount(borrowing.principalAmount)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <Percent className="h-5 w-5 text-gray-400 mr-3" />
                    <div>
                      <p className="text-sm text-gray-600">Interest Rate</p>
                      <p className="font-semibold">
                        {borrowing.interestRate}% annually
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <Clock className="h-5 w-5 text-gray-400 mr-3" />
                    <div>
                      <p className="text-sm text-gray-600">Term</p>
                      <p className="font-semibold">
                        {borrowing.termMonths} months
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <Target className="h-5 w-5 text-gray-400 mr-3" />
                    <div>
                      <p className="text-sm text-gray-600">Payment Frequency</p>
                      <p className="font-semibold capitalize">
                        {borrowing.paymentFrequency?.replace("_", " ")}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center">
                    <Calendar className="h-5 w-5 text-gray-400 mr-3" />
                    <div>
                      <p className="text-sm text-gray-600">Applied Date</p>
                      <p className="font-semibold">
                        {formatDate(borrowing.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <Calendar className="h-5 w-5 text-gray-400 mr-3" />
                    <div>
                      <p className="text-sm text-gray-600">Maturity Date</p>
                      <p className="font-semibold">
                        {formatDate(borrowing.maturityDate)}
                      </p>
                    </div>
                  </div>

                  {borrowing.disbursementDate && (
                    <div className="flex items-center">
                      <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
                      <div>
                        <p className="text-sm text-gray-600">
                          Disbursement Date
                        </p>
                        <p className="font-semibold">
                          {formatDate(borrowing.disbursementDate)}
                        </p>
                      </div>
                    </div>
                  )}

                  {borrowing.monthlyPaymentAmount && (
                    <div className="flex items-center">
                      <Calculator className="h-5 w-5 text-gray-400 mr-3" />
                      <div>
                        <p className="text-sm text-gray-600">Monthly Payment</p>
                        <p className="font-semibold">
                          {borrowing.currency}{" "}
                          {formatAmount(borrowing.monthlyPaymentAmount)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {borrowing.purpose && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h3 className="text-sm font-medium text-gray-900 mb-2">
                    Purpose
                  </h3>
                  <p className="text-gray-600">{borrowing.purpose}</p>
                </div>
              )}

              {borrowing.collateral && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-2">
                    Collateral
                  </h3>
                  <p className="text-gray-600">{borrowing.collateral}</p>
                </div>
              )}

              {borrowing.terms && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-2">
                    Terms & Conditions
                  </h3>
                  <p className="text-gray-600">{borrowing.terms}</p>
                </div>
              )}
            </div>

            {/* Payment History */}
            {borrowing.payments && borrowing.payments.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">
                  Payment History
                </h2>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Amount
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Notes
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {borrowing.payments.map((payment, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatDate(payment.paymentDate)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {payment.currency} {formatAmount(payment.amount)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
                            {payment.paymentType}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                payment.status === "Approved"
                                  ? "bg-green-100 text-green-800"
                                  : payment.status === "Pending"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {payment.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {payment.notes || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Documents */}
            {borrowing.documents && borrowing.documents.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">
                  Documents
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {borrowing.documents.map((doc, index) => (
                    <div
                      key={index}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center mb-2">
                        <FileText className="h-5 w-5 text-[var(--p-blue)] mr-2" />
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {doc.name}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mb-2">
                        {doc.documentType} •{" "}
                        {(doc.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-400">
                          {formatDate(doc.uploadedAt)}
                        </span>
                        <button
                          onClick={() => handleOpenFile(doc.fileId)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <Eye size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Lender Information */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Lender Information
              </h3>

              <div className="space-y-3">
                <div className="flex items-center">
                  <Building className="h-5 w-5 text-gray-400 mr-3" />
                  <div>
                    <p className="text-sm text-gray-600">Lender</p>
                    <p className="font-medium">
                      {borrowing.lender?.basicInformation?.vendorDisplayName ||
                        "N/A"}
                    </p>
                  </div>
                </div>

                {borrowing.lender?.basicInformation?.primaryContact && (
                  <div className="flex items-center">
                    <User className="h-5 w-5 text-gray-400 mr-3" />
                    <div>
                      <p className="text-sm text-gray-600">Contact Person</p>
                      <p className="font-medium">
                        {
                          borrowing.lender.basicInformation.primaryContact
                            .firstName
                        }{" "}
                        {
                          borrowing.lender.basicInformation.primaryContact
                            .lastName
                        }
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Financial Summary */}
            {(borrowing.status === "Disbursed" ||
              borrowing.status === "Active" ||
              borrowing.status === "Paid Off") && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Financial Summary
                </h3>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">
                      Principal Borrowed
                    </span>
                    <span className="font-medium">
                      {borrowing.currency}{" "}
                      {formatAmount(borrowing.principalAmount)}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">
                      Principal Paid
                    </span>
                    <span className="font-medium">
                      {borrowing.currency}{" "}
                      {formatAmount(borrowing.totalPrincipalPaid || 0)}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Interest Paid</span>
                    <span className="font-medium">
                      {borrowing.currency}{" "}
                      {formatAmount(borrowing.totalInterestPaid || 0)}
                    </span>
                  </div>

                  <div className="border-t pt-3">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-900">
                        Outstanding Balance
                      </span>
                      <span className="font-bold text-lg">
                        {borrowing.currency}{" "}
                        {formatAmount(
                          borrowing.remainingBalance ||
                            borrowing.principalAmount
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Status Management */}
            {validTransitions.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Status Management
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Update Status
                    </label>
                    <select
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
                    >
                      <option value={borrowing.status}>
                        {borrowing.status}
                      </option>
                      {validTransitions.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedStatus === "Disbursed" && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Disbursement Bank Account *
                        </label>
                        <select
                          value={disbursementBankAccount}
                          onChange={(e) =>
                            handleBankAccountChange(e.target.value)
                          }
                          className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
                        >
                          <option value="">Select Bank Account</option>
                          {bankAccounts.map((account) => (
                            <option key={account._id} value={account._id}>
                              {account.accountName} - {account.bankName} (
                              {account.currencyType})
                            </option>
                          ))}
                        </select>
                      </div>

                      {conversionDetails && (
                        <div className="bg-blue-50 p-3 rounded-lg">
                          <h4 className="text-sm font-medium text-blue-900 mb-2">
                            Currency Conversion
                          </h4>
                          <p className="text-sm text-blue-700">
                            {conversionDetails.displayText}
                          </p>
                          {conversionDetails.exchangeRate !== 1 && (
                            <p className="text-xs text-blue-600 mt-1">
                              Exchange Rate: {conversionDetails.exchangeRate}
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  <button
                    onClick={handleStatusUpdate}
                    disabled={
                      statusUpdateLoading || selectedStatus === borrowing.status
                    }
                    className="w-full px-4 py-2 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[#9CBA33] disabled:opacity-50 transition-colors"
                  >
                    {statusUpdateLoading ? "Updating..." : "Update Status"}
                  </button>
                </div>
              </div>
            )}

            {/* Payment Processing */}
            {borrowing.status === "Active" && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Make Payment
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Payment Amount *
                    </label>
                    <input
                      type="number"
                      value={paymentData.amount}
                      onChange={(e) =>
                        handlePaymentAmountChange(e.target.value)
                      }
                      placeholder="0.00"
                      className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
                      step="0.01"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Payment Type
                    </label>
                    <select
                      value={paymentData.paymentType}
                      onChange={(e) =>
                        setPaymentData((prev) => ({
                          ...prev,
                          paymentType: e.target.value,
                        }))
                      }
                      className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
                    >
                      <option value="combined">Principal + Interest</option>
                      <option value="principal">Principal Only</option>
                      <option value="interest">Interest Only</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Payment Bank Account *
                    </label>
                    <select
                      value={paymentData.bankAccount}
                      onChange={(e) =>
                        handlePaymentBankAccountChange(e.target.value)
                      }
                      className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
                    >
                      <option value="">Select Bank Account</option>
                      {bankAccounts.map((account) => (
                        <option key={account._id} value={account._id}>
                          {account.accountName} - {account.bankName} (
                          {account.currencyType})
                          {account.openingBalance !== undefined &&
                            ` - Balance: ${formatAmount(
                              account.openingBalance
                            )}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {paymentConversionDetails && (
                    <div className="bg-green-50 p-3 rounded-lg">
                      <h4 className="text-sm font-medium text-green-900 mb-2">
                        Payment Conversion
                      </h4>
                      <p className="text-sm text-green-700">
                        {paymentConversionDetails.displayText}
                      </p>
                      {paymentConversionDetails.exchangeRate !== 1 && (
                        <p className="text-xs text-green-600 mt-1">
                          Exchange Rate: {paymentConversionDetails.exchangeRate}
                        </p>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notes
                    </label>
                    <textarea
                      value={paymentData.notes}
                      onChange={(e) =>
                        setPaymentData((prev) => ({
                          ...prev,
                          notes: e.target.value,
                        }))
                      }
                      placeholder="Optional payment notes"
                      className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] resize-none"
                      rows="3"
                    />
                  </div>

                  <button
                    onClick={handleProcessPayment}
                    disabled={
                      paymentLoading ||
                      !paymentData.amount ||
                      !paymentData.bankAccount
                    }
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {paymentLoading ? "Processing..." : "Process Payment"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewBorrowingInvoice;
