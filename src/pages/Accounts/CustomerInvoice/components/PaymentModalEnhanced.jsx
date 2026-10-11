import { useTranslation } from "react-i18next";
import { customerInvoiceText as ciText } from "@/utils/customerInvoiceI18n";
import React, { useState, useEffect, useCallback, useContext } from "react";
import { formatCurrencyAmount } from "@/components/formatAmount";
import DropdownBasic from "@/components/DropdownBasic";
import CustomDatePicker from "@/components/CustomDatePicker";
import InputField from "../reusablecomponents/InputField";
import axios from "axios";
import BankManagementServices from "@/services/BankManagementServices";
import CustomerPaymentHistoryServices from "@/services/CustomerPaymentHistoryServices";
import useAsync from "@/hooks/useAsync";
import FinancialService from "@/services/financialService";
import { AdminContext } from "@/context/AdminContext";
import {
  CheckCircle,
  AlertTriangle,
  Info,
  DollarSign,
  ArrowRightLeft,
  X,
  CreditCard,
  Building,
  Calendar,
  FileText,
  Wallet,
  Plus,
  Minus,
  ArrowRight,
  Receipt,
  AlertCircle,
  Loader,
} from "lucide-react";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

// Enhanced UI Components
const Card = ({ children, className = "", hover = false }) => (
  <div
    className={`bg-white rounded-lg border border-gray-200 shadow-sm ${
      hover ? "hover:shadow-md transition-all duration-300" : ""
    } ${className}`}
  >
    {children}
  </div>
);

const Button = ({
  variant = "primary",
  size = "md",
  onClick,
  disabled,
  children,
  className = "",
  type = "button",
  loading = false,
}) => {
  const baseClasses =
    "inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    primary:
      "bg-[var(--p-blue)] hover:bg-[#9CBA33] text-white focus:ring-[var(--p-blue)] shadow-md hover:shadow-lg",
    secondary:
      "bg-gray-200 hover:bg-gray-300 text-gray-700 focus:ring-gray-500",
    success: "bg-green-600 hover:bg-green-700 text-white focus:ring-green-500",
    danger: "bg-red-600 hover:bg-red-700 text-white focus:ring-red-500",
    warning:
      "bg-yellow-600 hover:bg-yellow-700 text-white focus:ring-yellow-500",
    outline:
      "border border-gray-300 hover:border-gray-400 text-gray-700 focus:ring-gray-500 bg-white hover:bg-gray-50",
  };

  const sizes = {
    sm: "px-3 py-2 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {loading && <Loader size={16} className="animate-spin mr-2" />}
      {children}
    </button>
  );
};

const Input = React.memo(
  ({
    type = "text",
    value,
    onChange,
    placeholder,
    className = "",
    disabled = false,
    min,
    max,
    step,
    error,
    ...props
  }) => (
    <div className="w-full">
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        className={`block w-full rounded-lg border ${
          error ? "border-red-300" : "border-gray-300"
        } px-3 py-2.5 text-sm placeholder-gray-400 focus:border-[var(--p-blue)] focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] disabled:bg-gray-100 disabled:cursor-not-allowed ${className}`}
        {...props}
      />
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
);

const Select = React.memo(
  ({
    value,
    onChange,
    children,
    className = "",
    disabled = false,
    error,
    ...props
  }) => (
    <div className="w-full">
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`block w-full rounded-lg border ${
          error ? "border-red-300" : "border-gray-300"
        } px-3 py-2.5 text-sm focus:border-[var(--p-blue)] focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] disabled:bg-gray-100 disabled:cursor-not-allowed ${className}`}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
);

const Badge = ({ variant = "primary", children, className = "" }) => {
  const variants = {
    primary: "bg-blue-100 text-blue-800",
    success: "bg-green-100 text-green-800",
    warning: "bg-yellow-100 text-yellow-800",
    danger: "bg-red-100 text-red-800",
    secondary: "bg-gray-100 text-gray-800",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
};

// Payment Type Selector Component
const PaymentTypeSelector = ({
  selectedType,
  onTypeChange,
  availableCredits,
  remainingAmount,
  currency,
}) => {
  const types = [
    {
      id: "cash_only",
      name: "Cash Payment Only",
      description: "Pay with new funds only",
      icon: <DollarSign size={20} />,
      available: true,
    },
    {
      id: "credit_only",
      name: "Apply Credits Only",
      description: "Use available customer credits",
      icon: <Wallet size={20} />,
      available: Object.keys(availableCredits).length > 0,
    },
    {
      id: "mixed",
      name: "Mixed Payment",
      description: "Combine credits and new payment",
      icon: <ArrowRightLeft size={20} />,
      available: Object.keys(availableCredits).length > 0,
    },
  ];

  return (
    <div className="mb-6">
      <h3 className="text-sm font-medium text-gray-700 mb-3">{ciText("Payment Method")}</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {types.map((type) => (
          <div
            key={type.id}
            className={`relative cursor-pointer rounded-lg border-2 p-4 ${
              selectedType === type.id
                ? "border-[var(--p-blue)] bg-green-50"
                : type.available
                ? "border-gray-200 hover:border-gray-300"
                : "border-gray-100 bg-gray-50 cursor-not-allowed"
            } ${type.available ? "" : "opacity-50"}`}
            onClick={() => type.available && onTypeChange(type.id)}
          >
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div
                  className={`${
                    selectedType === type.id
                      ? "text-[var(--p-blue)]"
                      : "text-gray-400"
                  }`}
                >
                  {type.icon}
                </div>
              </div>
              <div className="ml-3 flex-1">
                <div className="flex items-center">
                  <h4
                    className={`text-sm font-medium ${
                      selectedType === type.id
                        ? "text-green-900"
                        : "text-gray-900"
                    }`}
                  >
                    {type.name}
                  </h4>
                  {selectedType === type.id && (
                    <CheckCircle
                      size={16}
                      className="ml-2 text-[var(--p-blue)]"
                    />
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">{type.description}</p>
                {!type.available && (
                  <p className="text-xs text-red-500 mt-1">
                    {type.id === "credit_only" || type.id === "mixed"
                      ? "No credits available"
                      : "Not available"}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Credit Management Component
const CreditManagement = ({
  availableCredits,
  appliedCredits,
  onApplyCredit,
  onRemoveCredit,
  targetCurrency,
  remainingAmount,
}) => {
  const [expandedCurrency, setExpandedCurrency] = useState(null);

  if (Object.keys(availableCredits).length === 0) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg text-center">
        <Wallet size={24} className="mx-auto text-gray-400 mb-2" />
        <p className="text-sm text-gray-500">{ciText("No customer credits available")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">
          {ciText("Available Customer Credits")}
        </h3>
        <Badge variant="success">
          {Object.keys(availableCredits).length} currencies
        </Badge>
      </div>

      {/* Applied Credits Summary */}
      {appliedCredits.length > 0 && (
        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
          <h4 className="text-sm font-medium text-green-700 mb-2">
            {ciText("Applied Credits")}
          </h4>
          <div className="space-y-2">
            {appliedCredits.map((credit, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2 bg-white rounded border"
              >
                <div className="flex-1">
                  <span className="text-sm font-medium">
                    {formatCurrencyAmount(credit.currency, credit.amount)}
                  </span>
                  {credit.conversionDetails && (
                    <div className="text-xs text-gray-500">
                      <ArrowRightLeft size={10} className="inline mr-1" />
                      Converted to {targetCurrency}{" "}
                      {credit.conversionDetails.convertedAmount.toFixed(2)}
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onRemoveCredit(index)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Minus size={12} />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available Credits by Currency */}
      <div className="space-y-3">
        {Object.entries(availableCredits).map(([currency, creditData]) => {
          if (!creditData?.total || creditData.total <= 0) return null;

          const isExpanded = expandedCurrency === currency;
          const hasMultipleCredits = creditData.credits?.length > 1;

          return (
            <div
              key={currency}
              className="border border-gray-200 rounded-lg overflow-hidden"
            >
              <div className="p-3 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center">
                      <span className="font-medium text-gray-900">
                        {formatCurrencyAmount(currency, creditData.total)}
                      </span>
                      <Badge variant="secondary" className="ml-2">
                        {creditData.credits?.length || 1} credits
                      </Badge>
                    </div>
                    {currency !== targetCurrency && (
                      <div className="text-xs text-blue-600 flex items-center mt-1">
                        <ArrowRightLeft size={10} className="mr-1" />
                        Will convert to {targetCurrency}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onApplyCredit(creditData.total, currency)}
                      disabled={creditData.total <= 0}
                      className="text-green-600 hover:text-green-700"
                    >
                      <Plus size={12} className="mr-1" />
                      {ciText("Apply All")}
                    </Button>
                    {hasMultipleCredits && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setExpandedCurrency(isExpanded ? null : currency)
                        }
                      >
                        {isExpanded ? ciText("Hide") : "Details"}
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Individual Credits Details */}
              {isExpanded && hasMultipleCredits && (
                <div className="border-t border-gray-200">
                  <div className="p-3 space-y-2">
                    {creditData.credits.map((credit, index) => (
                      <div
                        key={credit.id || index}
                        className="flex items-center justify-between p-2 bg-white rounded border"
                      >
                        <div className="flex-1">
                          <div className="text-sm">
                            <span className="font-medium">
                              {formatCurrencyAmount(currency, credit.amount)}
                            </span>
                            {credit.reference && (
                              <span className="text-gray-500 ml-2">
                                ({credit.reference})
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            Payment Date:{" "}
                            {new Date(credit.paymentDate).toLocaleDateString()}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onApplyCredit(credit.amount, currency)}
                          className="text-green-600 hover:text-green-700"
                        >
                          <Plus size={12} className="mr-1" />
                          {ciText("Apply")}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Payment Summary Component
const PaymentSummary = ({ summary, invoice, appliedCredits }) => {
  if (!summary) return null;

  const getSummaryColor = () => {
    switch (summary.type) {
      case "exact":
        return "bg-green-50 border-green-200 text-green-700";
      case "overpayment":
        return "bg-blue-50 border-blue-200 text-blue-700";
      case "underpayment":
        return "bg-yellow-50 border-yellow-200 text-yellow-700";
      default:
        return "bg-gray-50 border-gray-200 text-gray-700";
    }
  };

  const getSummaryIcon = () => {
    switch (summary.type) {
      case "exact":
        return <CheckCircle size={16} className="text-green-600" />;
      case "overpayment":
        return <ArrowRightLeft size={16} className="text-blue-600" />;
      case "underpayment":
        return <AlertTriangle size={16} className="text-yellow-600" />;
      default:
        return <Info size={16} className="text-gray-600" />;
    }
  };

  return (
    <div className={`p-4 rounded-lg border ${getSummaryColor()}`}>
      <div className="flex items-start space-x-3">
        {getSummaryIcon()}
        <div className="flex-1">
          <h4 className="font-medium mb-1">{ciText("Payment Summary")}</h4>
          <p className="text-sm mb-3">{summary.message}</p>

          {/* Applied Credits Breakdown */}
          {appliedCredits.length > 0 && (
            <div className="mb-3">
              <h5 className="text-xs font-medium mb-2">{ciText("Applied Credits:")}</h5>
              <div className="space-y-1">
                {appliedCredits.map((credit, index) => (
                  <div key={index} className="text-xs">
                    • {formatCurrencyAmount(credit.currency, credit.amount)}
                    {credit.conversionDetails && (
                      <span className="text-gray-600">
                        {" "}
                        → {credit.conversionDetails.targetCurrency}{" "}
                        {credit.conversionDetails.convertedAmount.toFixed(2)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payment Details */}
          {summary.cashPaymentAmount > 0 && (
            <div className="text-xs">
              Cash Payment: {summary.paymentCurrency}{" "}
              {summary.cashPaymentAmount.toFixed(2)}
            </div>
          )}

          {summary.type === "overpayment" && summary.overpaymentAmount > 0 && (
            <div className="text-xs font-medium">
              <DollarSign size={12} className="inline mr-1" />
              Overpayment: {summary.paymentCurrency}{" "}
              {summary.overpaymentAmount.toFixed(2)} will be added to customer
              credits
            </div>
          )}

          {summary.type === "underpayment" &&
            summary.remainingAfterPayment > 0 && (
              <div className="text-xs font-medium">
                <AlertTriangle size={12} className="inline mr-1" />
                Remaining:{" "}
                {formatCurrencyAmount(
                  invoice?.currency,
                  summary.remainingAfterPayment,
                )}{" "}
                will stay outstanding
              </div>
            )}
        </div>
      </div>
    </div>
  );
};

// Main Enhanced Payment Modal Component
const PaymentModalEnhanced = ({
  isOpen,
  onClose,
  onSubmit,
  invoice,
  businessId,
}) => {
  useTranslation();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;

  // Core state
  const [form, setForm] = useState({
    paymentDate: new Date().toISOString().split("T")[0],
    paymentMode: "Bank Transfer",
    depositTo: "",
    amount: "",
    currency: "",
    reference: "",
    bankCharges: "",
    taxDeducted: false,
    tdsType: "",
    notes: "",
    attachment: null,
    emailThankYou: true,
    email: invoice?.customer_id?.basicInformation?.customerEmail || "",
  });

  // UI state
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Bank and currency data
  const [bankAccounts, setBankAccounts] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [loadingBankData, setLoadingBankData] = useState(false);

  // Credit management state
  const [availableCredits, setAvailableCredits] = useState({});
  const [appliedCredits, setAppliedCredits] = useState([]);
  const [loadingCredits, setLoadingCredits] = useState(false);

  // Payment type and summary
  const [paymentType, setPaymentType] = useState("cash_only");
  const [paymentSummary, setPaymentSummary] = useState(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-fade-in">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-gray-200 relative">
          <button
            className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-2xl focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
            onClick={onClose}
            aria-label={ciText("Close")}
          >
            <X size={24} />
          </button>
          <h2 className="text-xl md:text-2xl font-bold text-gray-800 pr-8">
            {ciText("Enhanced Payment Modal")}
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {ciText("This is a placeholder - Full implementation coming next")}
          </p>
        </div>

        <div className="flex-1 p-6">
          <p className="text-gray-600">
            Enhanced payment modal with credit management, currency conversion,
            and comprehensive validation.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PaymentModalEnhanced;
