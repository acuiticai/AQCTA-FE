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
  Save,
  X,
} from "lucide-react";
import { useParams, useHistory } from "react-router-dom";
import axios from "axios";
import { notifyError, notifySuccess } from "@/utils/toast";
import { AdminContext } from "@/context/AdminContext";
import BackButton from "@/components/BackButton";
import { formatAmount, formatDate } from "@/components/formatAmount";
import SearchableDropdown from "@/components/SearchableDropdown";

const UpdateSpecialTransfer = () => {
  const { id } = useParams();
  const history = useHistory();
  const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;

  const [transfer, setTransfer] = useState(null);
  const [currencies, setCurrencies] = useState([]);
  const [destinationCurrencies, setDestinationCurrencies] = useState([]);
  const [sourceCurrencies, setSourceCurrencies] = useState([]);
  const [formData, setFormData] = useState({
    status: "",
    bankCharges: "",
    bankChargesCurrency: "USD",
    bankChargesAppliedTo: "sender",
    senderCharges: "",
    senderChargesCurrency: "USD",
    notes: "",
  });

  useEffect(() => {
    fetchTransfer();
  }, [id]);

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

        // Only allow editing if transfer is floating
        if (transferData.status !== "Floating") {
          notifyError("Only floating transfers can be updated");
          history.push(`/view-special-transfer/${id}`);
          return;
        }

        setTransfer(transferData);
        // Auto-populate currencies based on bank accounts
        const destinationBankCurrency =
          transferData.destinationBankAccount?.currencyType || "USD";
        const sourceBankCurrency =
          transferData.sourceBankAccount?.currencyType || "USD";

        setFormData({
          status: transferData.status,
          bankCharges: transferData.conversionDetails?.bankCharges || 0,
          bankChargesCurrency: destinationBankCurrency, // Auto-populate with destination bank currency
          bankChargesAppliedTo:
            transferData.conversionDetails?.bankChargesAppliedTo || "sender",
          senderCharges: transferData.conversionDetails?.senderCharges || 0,
          senderChargesCurrency: sourceBankCurrency, // Auto-populate with source bank currency
          notes: transferData.notes || "",
        });

        // Fetch currencies for both businesses
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
            setSourceCurrencies(currencyResponse.data.data || []);
            setCurrencies(currencyResponse.data.data || []); // Keep for backward compatibility
          } catch (error) {
            console.error("Error fetching source currencies:", error);
          }
        }

        // Fetch destination business currencies for invoice payments
        if (
          transferData.destinationBusiness &&
          transferData.transferType === "invoice_payment"
        ) {
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
          } catch (error) {
            console.error("Error fetching destination currencies:", error);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching transfer:", error);
      notifyError("Failed to fetch transfer details");
      history.push("/special-transfers");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.status) {
      notifyError("Please select a status");
      return;
    }

    setIsUpdating(true);
    try {
      const payload = {
        status: formData.status,
        bankCharges: parseFloat(formData.bankCharges) || 0,
        bankChargesCurrency: formData.bankChargesCurrency,
        bankChargesAppliedTo: formData.bankChargesAppliedTo,
        senderCharges: parseFloat(formData.senderCharges) || 0,
        senderChargesCurrency: formData.senderChargesCurrency,
        notes: formData.notes,
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
        history.push(`/view-special-transfer/${id}`);
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
    };
    return colors[type] || "bg-gray-50 text-gray-700";
  };

  const getTransferTypeLabel = (type) => {
    const labels = {
      inter_company: "Inter Company",
      third_party_payment: "Third Party Payment",
      third_party_received: "Third Party Received",
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
              Update Transfer #{transfer.transferNumber}
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
              <Clock size={14} className="mr-1" />
              {transfer.status}
            </span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Transfer Summary */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
            <FileText size={20} className="mr-2" />
            Transfer Summary
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Source Information */}
            <div>
              <h3 className="font-medium text-gray-700 mb-3 flex items-center">
                <Building size={16} className="mr-2" />
                Source
              </h3>
              <div className="space-y-2">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Business:</span>{" "}
                  {transfer.sourceBusiness?.name}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Bank:</span>{" "}
                  {transfer.sourceBankAccount?.bankName}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Account:</span>{" "}
                  {transfer.sourceBankAccount?.accountName}
                </p>
                <p className="text-lg font-bold text-gray-800">
                  {transfer.sourceCurrency}{" "}
                  {formatAmount(transfer.sourceAmount)}
                </p>
              </div>
            </div>

            {/* Destination Information */}
            <div>
              <h3 className="font-medium text-gray-700 mb-3 flex items-center">
                {transfer.transferType === "inter_company" ? (
                  <Building size={16} className="mr-2" />
                ) : transfer.transferType === "payback_transfer" ? (
                  <Building size={16} className="mr-2" />
                ) : (
                  <User size={16} className="mr-2" />
                )}
                Destination
              </h3>
              <div className="space-y-2">
                {transfer.transferType === "inter_company" ? (
                  <>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Business:</span>{" "}
                      {transfer.destinationBusiness?.name}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Bank:</span>{" "}
                      {transfer.destinationBankAccount?.bankName}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Account:</span>{" "}
                      {transfer.destinationBankAccount?.accountName}
                    </p>
                    <p className="text-lg font-bold text-gray-800">
                      {transfer.destinationCurrency}{" "}
                      {formatAmount(
                        transfer.conversionDetails?.convertedAmount ||
                          transfer.sourceAmount
                      )}
                    </p>
                  </>
                ) : transfer.transferType === "payback_transfer" ? (
                  <>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Business:</span>{" "}
                      {transfer.destinationDetails?.businessName ||
                        transfer.destinationBusiness?.name}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Bank:</span>{" "}
                      {transfer.destinationDetails?.bankName ||
                        transfer.destinationBankAccount?.bankName}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Account:</span>{" "}
                      {transfer.destinationDetails?.accountName ||
                        transfer.destinationBankAccount?.accountName}
                    </p>
                    <p className="text-lg font-bold text-gray-800">
                      {transfer.destinationCurrency}{" "}
                      {formatAmount(
                        transfer.conversionDetails?.convertedAmount ||
                          transfer.sourceAmount
                      )}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Name:</span>{" "}
                      {transfer.thirdPartyInfo?.name}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Bank:</span>{" "}
                      {transfer.thirdPartyInfo?.bankName}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Account:</span>{" "}
                      {transfer.thirdPartyInfo?.accountNumber}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Reason:</span>{" "}
                      {transfer.thirdPartyInfo?.reason}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Currency Conversion Info */}
          {transfer.conversionDetails &&
            transfer.conversionDetails.exchangeRate !== 1 && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-2">
                  Currency Conversion
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-blue-600">Exchange Rate:</span>
                    <p className="font-medium">
                      {transfer.conversionDetails.exchangeRate}
                    </p>
                  </div>
                  <div>
                    <span className="text-blue-600">Converted Amount:</span>
                    <p className="font-medium">
                      {transfer.conversionDetails.toCurrency}{" "}
                      {formatAmount(transfer.conversionDetails.convertedAmount)}
                    </p>
                  </div>
                  <div>
                    <span className="text-blue-600">Current Bank Charges:</span>
                    <p className="font-medium">
                      {transfer.conversionDetails.toCurrency}{" "}
                      {formatAmount(
                        transfer.conversionDetails.bankCharges || 0
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}
        </div>

        {/* Update Form */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-medium text-gray-800 mb-4">
            Update Transfer
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label className="block text-gray-700 mb-2">Status *</label>
              <SearchableDropdown
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                placeholder="Select Status"
                searchPlaceholder="Search status..."
                options={[
                  { value: "Floating", label: "Floating" },
                  { value: "Completed", label: "Completed" },
                  { value: "Cancelled", label: "Cancelled" },
                  { value: "Failed", label: "Failed" },
                  { value: "PaidBack", label: "Paid Back" },
                ]}
                searchKeys={["label"]}
                renderOption={(option) => (
                  <div>
                    <div className="font-medium">{option.label}</div>
                  </div>
                )}
              />
              <p className="text-sm text-gray-500 mt-1">
                Changing status to "Completed" will create destination ledger
                entry
              </p>
            </div>

            {/* Bank Charges - Available for all transfer types */}
            <div>
              <label className="block text-gray-700 mb-2">Bank Charges</label>
              <div className="relative">
                <input
                  type="number"
                  name="bankCharges"
                  value={formData.bankCharges}
                  onChange={handleInputChange}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className="w-full p-3 pr-16 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <span className="text-gray-500 text-sm">
                    {formData.bankChargesCurrency}
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

            {/* Sender Charges - Available for all transfer types */}
            <div>
              <label className="block text-gray-700 mb-2">Sender Charges</label>
              <div className="relative">
                <input
                  type="number"
                  name="senderCharges"
                  value={formData.senderCharges}
                  onChange={handleInputChange}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className="w-full p-3 pr-16 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <span className="text-gray-500 text-sm">
                    {formData.senderChargesCurrency}
                  </span>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Currency: {transfer?.sourceBankAccount?.currencyType} (auto)
              </p>
            </div>
          </div>

          {/* Currency Selection - Available for all transfer types */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div>
              <label className="block text-gray-700 mb-2">
                Bank Charges Currency
              </label>
              <SearchableDropdown
                name="bankChargesCurrency"
                value={formData.bankChargesCurrency}
                onChange={handleInputChange}
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
                            transfer?.sourceBankAccount?.currencyType ||
                            "USD",
                          label: `${
                            transfer?.destinationBankAccount?.currencyType ||
                            transfer?.sourceBankAccount?.currencyType ||
                            "USD"
                          } (Bank)`,
                          symbol:
                            transfer?.destinationBankAccount?.currencyType ||
                            transfer?.sourceBankAccount?.currencyType ||
                            "USD",
                          prefix: "Bank",
                        },
                      ]
                }
                searchKeys={["symbol", "prefix"]}
                renderOption={(option) => (
                  <div>
                    <div className="font-medium">{option.symbol}</div>
                    <div className="text-xs text-gray-500">{option.prefix}</div>
                  </div>
                )}
              />
              <p className="text-xs text-gray-500 mt-1">
                Currencies available for{" "}
                {transfer?.transferType === "invoice_payment"
                  ? "destination"
                  : "bank"}{" "}
                business
              </p>
            </div>

            <div>
              <label className="block text-gray-700 mb-2">
                Sender Charges Currency
              </label>
              <SearchableDropdown
                name="senderChargesCurrency"
                value={formData.senderChargesCurrency}
                onChange={handleInputChange}
                placeholder="Select Currency"
                searchPlaceholder="Search currencies..."
                options={
                  sourceCurrencies.length > 0
                    ? sourceCurrencies.map((currency) => ({
                        value: currency.symbol,
                        label: `${currency.symbol} (${currency.prefix})`,
                        symbol: currency.symbol,
                        prefix: currency.prefix,
                      }))
                    : [
                        {
                          value:
                            transfer?.sourceBankAccount?.currencyType || "USD",
                          label: `${
                            transfer?.sourceBankAccount?.currencyType || "USD"
                          } (Source Bank)`,
                          symbol:
                            transfer?.sourceBankAccount?.currencyType || "USD",
                          prefix: "Source Bank",
                        },
                      ]
                }
                searchKeys={["symbol", "prefix"]}
                renderOption={(option) => (
                  <div>
                    <div className="font-medium">{option.symbol}</div>
                    <div className="text-xs text-gray-500">{option.prefix}</div>
                  </div>
                )}
              />
              <p className="text-xs text-gray-500 mt-1">
                Currencies available for source business
              </p>
            </div>
          </div>

          {/* Account Code Display (Read-only) */}
          <div className="mt-6">
            <label className="block text-gray-700 mb-2">Account Code</label>
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
              {transfer?.accountCode ? (
                <>
                  <p className="font-medium text-gray-800">
                    {transfer.accountCode.code} -{" "}
                    {transfer.accountCode.accountName}
                  </p>
                  {transfer.accountCode.accountType && (
                    <p className="text-sm text-gray-600">
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
            <p className="text-xs text-gray-500 mt-1">
              Account code cannot be changed after creation
            </p>
          </div>

          <div className="mt-6">
            <label className="block text-gray-700 mb-2">Notes</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows="4"
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] resize-none"
              placeholder="Enter additional notes..."
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => history.push(`/view-special-transfer/${id}`)}
            className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isUpdating}
            className="px-6 py-3 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[#9CBA33] transition-colors flex items-center"
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
      </form>
    </div>
  );
};

export default UpdateSpecialTransfer;
