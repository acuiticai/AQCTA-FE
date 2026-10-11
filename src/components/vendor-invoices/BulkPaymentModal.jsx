import React, {
  useState,
  useEffect,
  useContext,
  useCallback,
  useRef,
} from "react";
import { notifyError, notifySuccess } from "@/utils/toast";
import axios from "axios";
import VendorInvoiceServices from "../../services/VendorInvoiceServices";
import { AdminContext } from "../../context/AdminContext";
import {
  CheckCircle,
  AlertCircle,
  DollarSign,
  Users,
  FileText,
  CreditCard,
  ArrowRight,
  Loader,
  AlertTriangle,
  Check,
  X,
} from "lucide-react";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

/** Continuous payment workflow — one modal, resume from current invoice status */
const PAYMENT_WORKFLOW = [
  {
    id: "bulk-approve",
    title: "Preparing Invoice",
    shortTitle: "Preparing",
    fromStatus: "Created",
    toStatus: "Approved by Management",
    icon: FileText,
  },
  {
    id: "make-transaction",
    title: "Make Transaction",
    shortTitle: "Transaction",
    fromStatus: "Approved by Management",
    toStatus: "Make Transaction",
    icon: CreditCard,
  },
  {
    id: "approve-transaction",
    title: "Approval Management",
    shortTitle: "Approval",
    fromStatus: "Make Transaction",
    toStatus: "Approve Transaction",
    icon: CheckCircle,
  },
];

const COMPLETE_STEP = {
  id: "complete",
  title: "Complete",
  shortTitle: "Complete",
  icon: Check,
};

const getWorkflowIndexByMode = (mode) =>
  PAYMENT_WORKFLOW.findIndex((step) => step.id === mode);

const getModeFromInvoiceStatus = (status) => {
  const step = PAYMENT_WORKFLOW.find((s) => s.fromStatus === status);
  return step?.id || null;
};

const getNextWorkflowMode = (mode) => {
  const idx = getWorkflowIndexByMode(mode);
  if (idx < 0 || idx >= PAYMENT_WORKFLOW.length - 1) return null;
  return PAYMENT_WORKFLOW[idx + 1].id;
};

// Keep these outside the modal so inputs keep focus while typing
const CustomButton = ({
  variant = "primary",
  size = "md",
  onClick,
  disabled,
  children,
  className = "",
}) => {
  const baseClasses =
    "inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2";

  const variants = {
    primary: disabled
      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
      : "bg-[var(--p-blue)] hover:bg-[#9CBA33] text-white focus:ring-[var(--p-blue)] shadow-md hover:shadow-lg transition-colors",
    secondary: disabled
      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
      : "bg-gray-200 hover:bg-gray-300 text-gray-700 focus:ring-gray-500",
    success: disabled
      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
      : "bg-[var(--p-blue)] hover:bg-[#9CBA33] text-white focus:ring-[var(--p-blue)] shadow-md hover:shadow-lg transition-colors",
    light: disabled
      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
      : "bg-gray-100 hover:bg-gray-200 text-gray-600 focus:ring-gray-400",
  };

  const sizes = {
    sm: "px-3 py-2 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
};

const CustomCard = ({ children, className = "", hover = false }) => (
  <div
    className={`bg-white rounded-xl shadow-sm border border-gray-200 ${
      hover
        ? "hover:shadow-md hover:-translate-y-1 transition-all duration-300"
        : ""
    } ${className}`}
  >
    {children}
  </div>
);

const CustomCardBody = ({ children, className = "" }) => (
  <div className={`p-6 ${className}`}>{children}</div>
);

const CustomBadge = ({ variant = "light", children, className = "" }) => {
  const variants = {
    light: "bg-gray-100 text-gray-700",
    primary: "bg-[var(--p-blue)]/10 text-[var(--p-blue)]",
    success: "bg-green-100 text-green-700",
    danger: "bg-red-100 text-red-700",
    warning: "bg-yellow-100 text-yellow-700",
    info: "bg-cyan-100 text-cyan-700",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
};

const CustomAlert = ({ variant = "info", children, className = "" }) => {
  const variants = {
    success: "bg-green-50 border-green-200 text-green-800",
    danger: "bg-red-50 border-red-200 text-red-800",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
    info: "bg-blue-50 border-blue-200 text-blue-800",
  };

  return (
    <div className={`rounded-lg border p-4 ${variants[variant]} ${className}`}>
      {children}
    </div>
  );
};

const CustomInput = React.memo(
  ({
    type = "text",
    value,
    onChange,
    placeholder,
    className = "",
    disabled = false,
    ...props
  }) => (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      className={`block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-[var(--p-blue)] focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] disabled:bg-gray-100 disabled:cursor-not-allowed ${className}`}
      {...props}
    />
  ),
);
CustomInput.displayName = "CustomInput";

const CustomSelect = React.memo(
  ({
    value,
    onChange,
    children,
    className = "",
    disabled = false,
    ...props
  }) => (
    <select
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={`block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--p-blue)] focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] disabled:bg-gray-100 disabled:cursor-not-allowed ${className}`}
      {...props}
    >
      {children}
    </select>
  ),
);
CustomSelect.displayName = "CustomSelect";

const CustomProgress = ({ value = 0, className = "" }) => (
  <div className={`w-full bg-gray-200 rounded-full h-2 ${className}`}>
    <div
      className="bg-[var(--p-blue)] h-2 rounded-full transition-all duration-300"
      style={{ width: `${value}%` }}
    ></div>
  </div>
);

const BulkPaymentModal = ({
  isOpen,
  toggle,
  selectedInvoices = [],
  onPaymentComplete,
  onStepComplete,
  bankAccounts = [],
  mode = "review",
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [workingInvoices, setWorkingInvoices] = useState([]);
  const [paymentAmounts, setPaymentAmounts] = useState({});
  const [selectedBankAccount, setSelectedBankAccount] = useState("");
  const [loading, setLoading] = useState(false);
  const [processingResults, setProcessingResults] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);
  const [paymentSummary, setPaymentSummary] = useState(null);
  const [conversionDetails, setConversionDetails] = useState({});
  const [isLoadingConversion, setIsLoadingConversion] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [bulkMode, setBulkMode] = useState(mode);
  const [flowComplete, setFlowComplete] = useState(false);
  const [localBankAccounts, setLocalBankAccounts] = useState(bankAccounts);
  const conversionTimerRef = useRef(null);
  const paymentAmountsRef = useRef(paymentAmounts);
  paymentAmountsRef.current = paymentAmounts;
  const { state } = useContext(AdminContext);
  const adminInfo = state?.adminInfo;
  const invoices = workingInvoices.length > 0 ? workingInvoices : selectedInvoices;

  // Status workflow configuration (matching ViewVendorInvoice exactly)
  const statusConfig = {
    Created: {
      icon: FileText,
      color: "bg-blue-100 text-blue-800 border-blue-300",
      bgColor: "bg-blue-50",
      textColor: "text-blue-700",
      description: "Invoice created and awaiting approval",
    },
    "Approved by Management": {
      icon: CheckCircle,
      color: "bg-yellow-100 text-yellow-800 border-yellow-300",
      bgColor: "bg-yellow-50",
      textColor: "text-yellow-700",
      description: "Invoice approved and ready for payment processing",
    },
    "Make Transaction": {
      icon: CreditCard,
      color: "bg-orange-100 text-orange-800 border-orange-300",
      bgColor: "bg-orange-50",
      textColor: "text-orange-700",
      description: "Payment intent created, awaiting approval",
    },
    "Approve Transaction": {
      icon: CheckCircle,
      color: "bg-green-100 text-green-800 border-green-300",
      bgColor: "bg-green-50",
      textColor: "text-green-700",
      description: "Payment approved and processed",
    },
  };

  const validStatusTransitions = {
    Created: ["Approved by Management"],
    "Approved by Management": ["Make Transaction"],
    "Make Transaction": ["Approve Transaction"],
    "Approve Transaction": [],
  };

  // Initialize / resume workflow when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const initialInvoices = (selectedInvoices || []).filter(
      (inv) => inv && inv._id
    );
    setWorkingInvoices(initialInvoices);
    setFlowComplete(false);
    setProcessingResults(null);
    setValidationErrors([]);
    setSelectedBankAccount("");
    setConversionDetails({});
    setIsLoadingConversion(false);
    setLocalBankAccounts(bankAccounts || []);

    const statuses = [
      ...new Set(initialInvoices.map((inv) => inv.status).filter(Boolean)),
    ];
    const derivedMode =
      mode && mode !== "review"
        ? mode
        : statuses.length === 1
          ? getModeFromInvoiceStatus(statuses[0])
          : null;

    if (derivedMode) {
      setBulkMode(derivedMode);
      // Skip action picker when status already implies the next pending step
      setCurrentStep(2);
    } else {
      setBulkMode("review");
      setCurrentStep(1);
    }

    const initialAmounts = {};
    initialInvoices.forEach((invoice) => {
      initialAmounts[invoice._id] = invoice.remainingAmount || 0;
    });
    setPaymentAmounts(initialAmounts);

    try {
      const summary =
        VendorInvoiceServices.calculateBulkPaymentSummary(initialInvoices);
      setPaymentSummary(summary);
    } catch (error) {
      console.error("Error calculating payment summary:", error);
      setPaymentSummary(null);
    }
    // Only re-init when modal opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (bankAccounts?.length) {
      setLocalBankAccounts(bankAccounts);
    }
  }, [bankAccounts]);

  useEffect(() => {
    return () => {
      if (conversionTimerRef.current) {
        clearTimeout(conversionTimerRef.current);
      }
    };
  }, []);

  const ensureBankAccountsLoaded = useCallback(async () => {
    if (localBankAccounts?.length > 0) return localBankAccounts;
    if (!adminInfo?.token) return [];
    try {
      const businessIds = [
        ...new Set(
          invoices
            .map((inv) => inv.business?._id || inv.business)
            .filter(Boolean)
            .map(String)
        ),
      ];
      if (businessIds.length === 0) return [];
      const response = await axios.get(`${Base_URL}/bank-management/accounts`, {
        params: { business: businessIds[0] },
        headers: { authorization: `Bearer ${adminInfo.token}` },
      });
      const accounts = response.data.accounts || [];
      setLocalBankAccounts(accounts);
      return accounts;
    } catch (error) {
      console.error("Failed to load bank accounts:", error);
      return [];
    }
  }, [localBankAccounts, adminInfo?.token, invoices]);

  // Currency conversion handling
  const calculateConversions = useCallback(
    async (amounts, selectedAccount) => {
      if (!selectedAccount || !amounts) return;

      setIsLoadingConversion(true);
      const newConversionDetails = {};

      try {
        for (const invoice of invoices) {
          const payAmount = amounts[invoice._id] || invoice.remainingAmount;

          // Use currencyType (like ViewVendorInvoice) instead of currency
          const accountCurrency =
            selectedAccount.currencyType || selectedAccount.currency;

          if (accountCurrency !== invoice.currency && payAmount > 0) {
            try {
              const response = await axios.get(`${Base_URL}/currency/convert`, {
                params: {
                  from: invoice.currency,
                  to: accountCurrency,
                  amount: payAmount,
                },
                headers: {
                  authorization: `Bearer ${adminInfo.token}`,
                },
              });

              if (response.data.success) {
                newConversionDetails[invoice._id] = {
                  fromCurrency: accountCurrency,
                  toCurrency: invoice.currency,
                  paidAmount: payAmount,
                  requiredAmount: response.data.convertedAmount,
                  exchangeRate:
                    response.data.rate || response.data.exchangeRate,
                  accountBalance:
                    selectedAccount.openingBalance ||
                    selectedAccount.balance ||
                    0,
                  hasSufficientFunds:
                    (selectedAccount.openingBalance ||
                      selectedAccount.balance) >= response.data.convertedAmount,
                  displayText:
                    response.data.displayText ||
                    `${payAmount} ${invoice.currency} = ${response.data.convertedAmount} ${accountCurrency}`,
                };
              }
            } catch (error) {
              console.error(
                "Currency conversion error for invoice:",
                invoice.invoiceNumber,
                error
              );
            }
          } else if (payAmount > 0) {
            // Same currency or no conversion needed
            newConversionDetails[invoice._id] = {
              fromCurrency: accountCurrency,
              toCurrency: invoice.currency,
              paidAmount: payAmount,
              requiredAmount: payAmount,
              exchangeRate: 1,
              accountBalance:
                selectedAccount.openingBalance || selectedAccount.balance || 0,
              hasSufficientFunds:
                (selectedAccount.openingBalance || selectedAccount.balance) >=
                payAmount,
              displayText: `${payAmount} ${invoice.currency} = ${payAmount} ${accountCurrency} (Same Currency)`,
            };
          }
        }

        setConversionDetails(newConversionDetails);
      } catch (error) {
        console.error("Currency conversion error:", error);
        notifyError("Currency conversion failed");
      } finally {
        setIsLoadingConversion(false);
      }
    },
    [invoices, adminInfo]
  );

  // Handle bank account change
  const handleBankAccountChange = useCallback(
    (accountId) => {
      setSelectedBankAccount(accountId);
      if (!accountId) {
        setConversionDetails({});
        return;
      }
      const selectedAccount = localBankAccounts.find(
        (acc) => acc._id === accountId
      );
      if (selectedAccount && paymentAmounts) {
        calculateConversions(paymentAmounts, selectedAccount);
      }
    },
    [localBankAccounts, paymentAmounts, calculateConversions]
  );

  // Handle amount change — keep raw string while typing so focus/value stay stable
  const handleAmountChange = useCallback(
    (invoiceId, amount) => {
      if (!invoiceId) return;

      // Allow empty / intermediate decimal input while typing
      let raw = String(amount ?? "").replace(/[^0-9.]/g, "");
      const dot = raw.indexOf(".");
      if (dot !== -1) {
        raw =
          raw.slice(0, dot + 1) + raw.slice(dot + 1).replace(/\./g, "");
      }

      setPaymentAmounts((prev) => {
        const next = { ...prev, [invoiceId]: raw };
        paymentAmountsRef.current = next;
        return next;
      });

      const selectedAccount = localBankAccounts.find(
        (acc) => acc._id === selectedBankAccount
      );
      if (!selectedAccount) return;

      if (conversionTimerRef.current) {
        clearTimeout(conversionTimerRef.current);
      }
      conversionTimerRef.current = setTimeout(() => {
        const numericAmounts = Object.fromEntries(
          Object.entries(paymentAmountsRef.current).map(([id, val]) => [
            id,
            parseFloat(val) || 0,
          ]),
        );
        calculateConversions(numericAmounts, selectedAccount);
      }, 400);
    },
    [localBankAccounts, selectedBankAccount, calculateConversions]
  );

  // Process actions based on bulk mode — stay open and advance to next workflow step
  const handleProcessAction = async () => {
    // Validate single vendor constraint
    if (hasMultipleVendors()) {
      notifyError(
        "Cannot process bulk operations for invoices from different vendors. Please select invoices from the same vendor only."
      );
      return;
    }

    setLoading(true);
    setCurrentStep(3); // Processing step

    try {
      let response;

      switch (bulkMode) {
        case "bulk-approve":
          response = await handleBulkApprove();
          break;
        case "make-transaction":
          response = await handleMakeTransaction();
          break;
        case "approve-transaction":
          response = await handleApproveTransaction();
          break;
        default:
          throw new Error("Unknown bulk mode");
      }

      setProcessingResults(response);

      if (response.success) {
        const workflowStep = PAYMENT_WORKFLOW.find((s) => s.id === bulkMode);
        const nextMode = getNextWorkflowMode(bulkMode);

        // Keep local invoice state in sync so the next step can continue
        const updatedInvoices = invoices.map((inv) => {
          if (!workflowStep) return inv;
          if (bulkMode === "make-transaction") {
            const amount =
              parseFloat(paymentAmounts[inv._id]) || inv.remainingAmount || 0;
            return {
              ...inv,
              status: workflowStep.toStatus,
              payments: [
                ...(Array.isArray(inv.payments) ? inv.payments : []),
                {
                  amount,
                  currency: inv.currency,
                  status: "Pending",
                  bankAccount: selectedBankAccount || null,
                  conversionDetails: conversionDetails[inv._id] || null,
                },
              ],
            };
          }
          return { ...inv, status: workflowStep.toStatus };
        });
        setWorkingInvoices(updatedInvoices);

        if (typeof onStepComplete === "function") {
          onStepComplete({ mode: bulkMode, nextMode });
        }

        if (nextMode) {
          notifySuccess(
            `${workflowStep?.title || "Step"} completed. Continue to the next step.`
          );
          setSelectedBankAccount("");
          setConversionDetails({});
          setValidationErrors([]);
          setProcessingResults(null);

          if (nextMode === "make-transaction") {
            await ensureBankAccountsLoaded();
            const amounts = {};
            updatedInvoices.forEach((invoice) => {
              amounts[invoice._id] = invoice.remainingAmount || 0;
            });
            setPaymentAmounts(amounts);
          }

          setBulkMode(nextMode);
          setCurrentStep(2);
        } else {
          notifySuccess("Payment process completed successfully!");
          setFlowComplete(true);
          setCurrentStep(4);
          if (typeof onPaymentComplete === "function") {
            onPaymentComplete({ keepOpen: true });
          }
        }
      } else {
        notifyError("Bulk operation completed with some errors");
        setCurrentStep(2); // Go back to configuration step
      }
    } catch (error) {
      console.error("Processing error:", error);
      notifyError("Failed to process bulk operation");
      setCurrentStep(2); // Go back to configuration step
    } finally {
      setLoading(false);
    }
  };

  // Bulk approve invoices (Created → Approved by Management)
  const handleBulkApprove = async () => {
    const invoiceIds = invoices.map((inv) => inv._id);

    const response = await VendorInvoiceServices.bulkApprove(
      invoiceIds,
      "Approved by Management"
    );

    return response;
  };

  // Make transaction (Approved by Management → Make Transaction)
  const handleMakeTransaction = async () => {
    const payments = invoices.map((invoice) => ({
      invoiceId: invoice._id,
      amount: parseFloat(paymentAmounts[invoice._id]) || 0,
      currency: invoice.currency,
      conversionDetails: conversionDetails[invoice._id],
    }));

    const response = await VendorInvoiceServices.bulkMakeTransaction({
      invoiceIds: invoices.map((inv) => inv._id),
      paymentBankAccount: selectedBankAccount || null,
      payments,
      conversionDetails,
    });

    return response;
  };

  // Approve transaction (Make Transaction → Approve Transaction)
  const handleApproveTransaction = async () => {
    const invoiceIds = invoices.map((inv) => inv._id);

    const response = await VendorInvoiceServices.bulkApproveTransaction(
      invoiceIds
    );
    return response;
  };

  // Validation
  const validateConfiguration = () => {
    const errors = [];

    if (bulkMode === "make-transaction") {
      if (invoices && invoices.length > 0) {
        invoices.forEach((invoice) => {
          if (!invoice || !invoice._id) return;

          const amount =
            paymentAmounts && paymentAmounts[invoice._id] !== undefined
              ? parseFloat(paymentAmounts[invoice._id]) || 0
              : 0;
          if (!amount || amount <= 0) {
            errors.push(
              `Please enter a valid payment amount for ${
                invoice.invoiceNumber || "Unknown"
              }`
            );
          } else if (amount > (invoice.remainingAmount || 0)) {
            errors.push(
              `Payment amount for ${
                invoice.invoiceNumber || "Unknown"
              } exceeds remaining amount`
            );
          }
        });

        // Check for insufficient funds only when a bank account is selected
        if (
          selectedBankAccount &&
          conversionDetails &&
          Object.keys(conversionDetails).length > 0
        ) {
          invoices.forEach((invoice) => {
            if (!invoice || !invoice._id) return;

            const conversion = conversionDetails[invoice._id];
            if (conversion && !conversion.hasSufficientFunds) {
              errors.push(
                `Insufficient funds for ${invoice.invoiceNumber || "Unknown"}`
              );
            }
          });
        }
      }
    }

    setValidationErrors(errors);
    return errors.length === 0;
  };

  // Handle close — user can stop at any step; progress is saved via status
  const handleClose = () => {
    setCurrentStep(1);
    setBulkMode("review");
    setSelectedBankAccount("");
    setPaymentAmounts({});
    setProcessingResults(null);
    setValidationErrors([]);
    setConversionDetails({});
    setIsLoadingConversion(false);
    setFlowComplete(false);
    setWorkingInvoices([]);
    toggle();
  };

  const advanceToWorkflowStep = async (modeId) => {
    setBulkMode(modeId);
    setValidationErrors([]);
    if (modeId === "make-transaction") {
      await ensureBankAccountsLoaded();
    }
    setCurrentStep(2);
  };

  // Step indicator — full continuous payment pipeline
  const renderStepIndicator = () => {
    const activeMode = flowComplete ? "complete" : bulkMode;
    const activeIdx = flowComplete
      ? PAYMENT_WORKFLOW.length
      : Math.max(0, getWorkflowIndexByMode(activeMode));

    const steps = [
      ...PAYMENT_WORKFLOW.map((s, i) => ({
        ...s,
        step: i + 1,
        completed: i < activeIdx || (flowComplete && i <= activeIdx),
        active: !flowComplete && i === activeIdx,
      })),
      {
        ...COMPLETE_STEP,
        step: PAYMENT_WORKFLOW.length + 1,
        completed: flowComplete,
        active: flowComplete,
      },
    ];

    return (
      <div className="mb-8">
        <div className="flex justify-between items-center relative">
          <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-200 z-10" />
          <div
            className="absolute top-4 left-4 h-0.5 bg-[var(--p-blue)] z-20 transition-all duration-300"
            style={{
              width: `${(activeIdx / (steps.length - 1)) * 100}%`,
            }}
          />

          {steps.map(({ step, title, shortTitle, icon: Icon, completed, active }) => (
            <div key={step} className="text-center relative z-30 px-1">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 shadow-sm border-2 transition-all duration-300 ${
                  completed || active
                    ? "bg-[var(--p-blue)] text-white border-[var(--p-blue)]"
                    : "bg-white text-gray-400 border-gray-200"
                }`}
              >
                {completed && !active ? (
                  <Check size={18} />
                ) : currentStep === 3 && active ? (
                  <Loader size={18} className="animate-spin" />
                ) : (
                  <Icon size={18} />
                )}
              </div>
              <div
                className={`text-xs font-medium ${
                  completed || active ? "text-[var(--p-blue)]" : "text-gray-500"
                }`}
              >
                <span className="hidden sm:inline">{title}</span>
                <span className="sm:hidden">{shortTitle}</span>
              </div>
            </div>
          ))}
        </div>
        {!flowComplete && bulkMode !== "review" && (
          <p className="text-center text-sm text-gray-600 mt-4">
            Current action:{" "}
            <span className="font-semibold text-[var(--p-blue)]">
              {PAYMENT_WORKFLOW.find((s) => s.id === bulkMode)?.title ||
                "Select action"}
            </span>
            {" · "}
            You can close anytime and continue later from this step.
          </p>
        )}
      </div>
    );
  };

  // Review step - shows invoices and allows action selection
  const renderReviewStep = () => {
    const getAvailableActions = () => {
      const statuses = [...new Set(invoices.map((inv) => inv.status))];
      const actions = [];

      if (statuses.length === 1 && statuses[0] === "Created") {
        actions.push({
          value: "bulk-approve",
          label: "Preparing Invoice",
          description:
            "Approve invoices (Created → Approved by Management) so they are ready for payment",
          icon: FileText,
          color: "bg-blue-100 text-blue-800",
        });
      }

      if (statuses.length === 1 && statuses[0] === "Approved by Management") {
        actions.push({
          value: "make-transaction",
          label: "Make Transaction",
          description: "Create payment intents (Maker Role)",
          icon: CreditCard,
          color: "bg-yellow-100 text-yellow-800",
        });
      }

      if (statuses.length === 1 && statuses[0] === "Make Transaction") {
        actions.push({
          value: "approve-transaction",
          label: "Approval Management",
          description: "Approve and process payments (Checker Role)",
          icon: CheckCircle,
          color: "bg-emerald-100 text-emerald-800",
        });
      }

      return actions;
    };

    const availableActions = getAvailableActions();

    return (
      <div>
        <div className="flex items-center mb-6">
          <FileText className="text-[var(--p-blue)] mr-3" size={24} />
          <h4 className="text-xl font-semibold text-[var(--p-blue)] mb-0">
            Review Selected Invoices
          </h4>
        </div>

        {/* Action Selection */}
        {bulkMode === "review" && availableActions.length > 0 && (
          <div className="mb-8">
            <h5 className="text-lg font-semibold text-gray-900 mb-4">
              Select Action
            </h5>
            <div className="grid grid-cols-1 gap-4">
              {availableActions.map((action) => (
                <button
                  key={action.value}
                  onClick={() => advanceToWorkflowStep(action.value)}
                  disabled={hasMultipleVendors()}
                  className={`p-4 border-2 border-gray-200 rounded-xl transition-all text-left ${
                    hasMultipleVendors()
                      ? "opacity-50 cursor-not-allowed bg-gray-50"
                      : "hover:border-[var(--p-blue)]"
                  }`}
                >
                  <div className="flex items-center">
                    <div className={`p-2 rounded-lg mr-4 ${action.color}`}>
                      <action.icon size={20} />
                    </div>
                    <div>
                      <h6 className="font-semibold text-gray-900">
                        {action.label}
                      </h6>
                      <p className="text-sm text-gray-600">
                        {action.description}
                      </p>
                      {hasMultipleVendors() && (
                        <p className="text-xs text-red-600 mt-1">
                          ⚠️ Multiple vendors selected - not available
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {bulkMode !== "review" && (
          <div className="mb-6">
            <CustomAlert variant="info">
              <div className="flex items-center">
                <AlertCircle className="mr-3" size={20} />
                <div>
                  <strong>Selected Action:</strong>{" "}
                  {availableActions.find((a) => a.value === bulkMode)?.label ||
                    bulkMode}
                  <br />
                  <span className="text-sm">
                    {
                      availableActions.find((a) => a.value === bulkMode)
                        ?.description
                    }
                  </span>
                </div>
              </div>
            </CustomAlert>
          </div>
        )}

        {/* Summary Information */}
        {invoices.length > 0 && (
          <div className="mb-6">
            <CustomCard className="bg-blue-50 border-blue-200">
              <CustomCardBody>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="p-2 bg-blue-100 rounded-lg mr-3">
                      <Users className="text-blue-600" size={20} />
                    </div>
                    <div>
                      <h6 className="font-semibold text-blue-900">
                        Vendor Information
                      </h6>
                      <p className="text-sm text-blue-700">
                        {VendorInvoiceServices.getVendorDisplayName(
                          invoices[0],
                        )}
                      </p>
                      <p className="text-xs text-blue-600">
                        {invoices.length} invoice
                        {invoices.length !== 1 ? "s" : ""} selected
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-blue-900">
                      Total Amount
                    </div>
                    <div className="text-lg font-bold text-blue-800">
                      {VendorInvoiceServices.formatCurrency(
                        invoices.reduce(
                          (sum, inv) => sum + (inv.remainingAmount || 0),
                          0
                        ),
                        invoices[0]?.currency || "USD"
                      )}
                    </div>
                  </div>
                </div>
              </CustomCardBody>
            </CustomCard>
          </div>
        )}

        {/* Vendor Validation Alert */}
        {(() => {
          const vendorIds = [
            ...new Set(
              invoices.map((inv) => inv.vendor?._id).filter(Boolean)
            ),
          ];
          if (vendorIds.length > 1) {
            return (
              <div className="mb-6">
                <CustomAlert variant="danger">
                  <div className="flex items-center">
                    <AlertTriangle className="mr-3" size={20} />
                    <div>
                      <strong>Multiple Vendors Detected:</strong>
                      <br />
                      <span className="text-sm">
                        You have selected invoices from {vendorIds.length}{" "}
                        different vendors. Bulk payment operations can only be
                        performed on invoices from the same vendor. Please
                        deselect invoices from other vendors to continue.
                      </span>
                    </div>
                  </div>
                </CustomAlert>
              </div>
            );
          }
          return null;
        })()}

        {/* Invoice Cards with Vendor Bank Details */}
        <div className="space-y-6">
          {invoices.map((invoice) => {
            const StatusIcon = statusConfig[invoice.status]?.icon || FileText;

            return (
              <CustomCard
                key={invoice._id}
                className="border-l-4 border-l-[var(--p-blue)]"
              >
                <CustomCardBody>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Invoice Details */}
                    <div>
                      <div className="flex items-center mb-3">
                        <CustomBadge variant="primary" className="mr-2">
                          {invoice.currency}
                        </CustomBadge>
                        <div
                          className={`p-1 rounded mr-2 ${
                            statusConfig[invoice.status]?.bgColor
                          }`}
                        >
                          <StatusIcon
                            size={16}
                            className={statusConfig[invoice.status]?.textColor}
                          />
                        </div>
                        <h5 className="font-bold text-gray-900">
                          {invoice.invoiceNumber}
                        </h5>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">
                        <strong>
                          {VendorInvoiceServices.getVendorDisplayName(invoice)}
                        </strong>
                      </p>
                      <p className="text-xs text-gray-500 mb-2">
                        {
                          invoice.vendor?.basicInformation?.primaryContact
                            ?.firstName
                        }{" "}
                        {
                          invoice.vendor?.basicInformation?.primaryContact
                            ?.lastName
                        }
                      </p>
                      <CustomBadge
                        variant="light"
                        className={statusConfig[invoice.status]?.color}
                      >
                        {invoice.status}
                      </CustomBadge>

                      <div className="space-y-2 mt-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Total:</span>
                          <span className="font-semibold">
                            {VendorInvoiceServices.formatCurrency(
                              invoice.total,
                              invoice.currency
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Remaining:</span>
                          <span className="font-semibold text-yellow-600">
                            {VendorInvoiceServices.formatCurrency(
                              invoice.remainingAmount,
                              invoice.currency
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Vendor Bank Details */}
                    <div>
                      <h6 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                        <CreditCard className="mr-2" size={16} />
                        Vendor Bank Details
                      </h6>
                      <div className="space-y-2 text-xs">
                        <div>
                          <span className="text-gray-500">Bank Name:</span>
                          <p className="font-medium text-gray-900">
                            {invoice.vendor?.bankInfo?.bankDetails?.bankName ||
                              invoice.vendorBankAccount?.bankName ||
                              "Not provided"}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-500">Account Name:</span>
                          <p className="font-medium text-gray-900">
                            {invoice.vendor?.bankInfo?.bankAccountDetails
                              ?.accountName ||
                              invoice.vendorBankAccount?.accountName ||
                              "Not provided"}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-500">Account Number:</span>
                          <p className="font-medium text-gray-900">
                            {invoice.vendor?.bankInfo?.bankAccountDetails
                              ?.accountNumber ||
                              invoice.vendorBankAccount?.accountNumber ||
                              "Not provided"}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-500">SWIFT Code:</span>
                          <p className="font-medium text-gray-900">
                            {invoice.vendor?.bankInfo?.bankAccountDetails
                              ?.swiftCode ||
                              invoice.vendorBankAccount?.swiftCode ||
                              "Not provided"}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-500">Bank Address:</span>
                          <p className="font-medium text-gray-900">
                            {invoice.vendor?.bankInfo?.bankDetails
                              ?.bankAddress || "Not provided"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Status Information */}
                    <div>
                      <h6 className="text-sm font-semibold text-gray-700 mb-3">
                        Status Information
                      </h6>
                      <div className="text-sm text-gray-600">
                        <p className="mb-2">
                          {statusConfig[invoice.status]?.description}
                        </p>

                        {invoice.status === "Make Transaction" &&
                          invoice.payments?.length > 0 && (
                            <div className="mt-3 p-2 bg-yellow-50 rounded border">
                              <p className="text-xs font-medium text-yellow-800 mb-1">
                                Pending Payment:
                              </p>
                              <p className="text-xs text-yellow-700">
                                Amount:{" "}
                                {
                                  invoice.payments[invoice.payments.length - 1]
                                    ?.amount
                                }{" "}
                                {invoice.currency}
                              </p>
                            </div>
                          )}
                      </div>
                    </div>
                  </div>
                </CustomCardBody>
              </CustomCard>
            );
          })}
        </div>
      </div>
    );
  };

  // Configuration step based on bulk mode
  const renderConfigurationStep = () => {
    switch (bulkMode) {
      case "bulk-approve":
        return renderBulkApproveStep();
      case "make-transaction":
        return renderMakeTransactionStep();
      case "approve-transaction":
        return renderApproveTransactionStep();
      default:
        return null;
    }
  };

  // Bulk approve step
  const renderBulkApproveStep = () => (
    <div>
      <div className="flex items-center mb-6">
        <CheckCircle className="text-[var(--p-blue)] mr-3" size={24} />
        <h4 className="text-xl font-semibold text-[var(--p-blue)] mb-0">
          Preparing Invoice
        </h4>
      </div>

      <CustomAlert variant="info" className="mb-6">
        <div className="flex items-start">
          <AlertCircle className="mr-3 mt-0.5" size={20} />
          <div>
            <strong className="font-semibold">Confirmation Required:</strong>
            <div className="mt-2 text-sm">
              You are about to prepare {invoices.length} invoice
              {invoices.length !== 1 ? "s" : ""} for payment. This will change
              their status from "Created" to "Approved by Management". After
              this, you can continue to Make Transaction in the same form.
            </div>
          </div>
        </div>
      </CustomAlert>

      <div className="space-y-4">
        {invoices.map((invoice) => (
          <CustomCard
            key={invoice._id}
            className="border-l-4 border-l-[var(--p-blue)]"
          >
            <CustomCardBody>
              <div className="flex items-center justify-between">
                <div>
                  <h6 className="font-semibold text-gray-900">
                    {invoice.invoiceNumber}
                  </h6>
                  <p className="text-sm text-gray-600">
                    {VendorInvoiceServices.getVendorDisplayName(invoice)}
                  </p>
                  <p className="text-sm font-medium text-green-600">
                    {VendorInvoiceServices.formatCurrency(
                      invoice.total,
                      invoice.currency
                    )}
                  </p>
                </div>
                <div className="flex items-center">
                  <CustomBadge variant="light" className="mr-2">
                    Current: {invoice.status}
                  </CustomBadge>
                  <ArrowRight className="text-gray-400 mr-2" size={16} />
                  <CustomBadge variant="success">
                    Approved by Management
                  </CustomBadge>
                </div>
              </div>
            </CustomCardBody>
          </CustomCard>
        ))}
      </div>
    </div>
  );

  // Make transaction step
  const renderMakeTransactionStep = () => (
    <div>
      <div className="flex items-center mb-6">
        <CreditCard className="text-[var(--p-blue)] mr-3" size={24} />
        <h4 className="text-xl font-semibold text-[var(--p-blue)] mb-0">
          Make Transaction
        </h4>
      </div>

      <CustomAlert variant="info" className="mb-6">
        <div className="flex items-start">
          <AlertCircle className="mr-3 mt-0.5" size={20} />
          <div>
            <strong className="font-semibold">Payment Instructions:</strong>
            <div className="mt-2 text-sm">
              Optionally select a business bank account and specify payment
              amounts for each invoice. This will create payment intents that
              need to be approved by a checker.
            </div>
          </div>
        </div>
      </CustomAlert>

      {/* Bank Account Selection */}
      <CustomCard className="mb-6">
        <CustomCardBody>
          <div className="mb-4">
            <label className="flex items-center text-sm font-semibold text-gray-700 mb-2">
              <CreditCard size={16} className="mr-2" />
              Business Bank Account
            </label>
            <CustomSelect
              value={selectedBankAccount}
              onChange={(e) => handleBankAccountChange(e.target.value)}
            >
              <option value="">🏦 Select Bank Account</option>
              {localBankAccounts.length === 0 ? (
                <option disabled>Loading bank accounts...</option>
              ) : (
                localBankAccounts.map((account) => (
                  <option key={account._id} value={account._id}>
                    💳 {account.accountName} - {account.bankName} (
                    {account.currencyType || account.currency})
                    {account.openingBalance &&
                      ` - Balance: ${VendorInvoiceServices.formatCurrency(
                        account.openingBalance,
                        account.currencyType || account.currency
                      )}`}
                  </option>
                ))
              )}
            </CustomSelect>
          </div>

          {selectedBankAccount && (
            <CustomAlert variant="success">
              <div className="flex items-center">
                <Check size={16} className="mr-2" />
                <span className="text-sm">Bank account selected</span>
              </div>
            </CustomAlert>
          )}
        </CustomCardBody>
      </CustomCard>

      {/* Payment Configuration */}
      <div className="space-y-4">
        {invoices.map((invoice) => (
          <CustomCard
            key={invoice._id}
            className="border-l-4 border-l-[var(--p-blue)]"
          >
            <CustomCardBody>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h6 className="font-semibold text-gray-900 mb-2">
                    {invoice.invoiceNumber}
                  </h6>
                  <p className="text-sm text-gray-600 mb-2">
                    {VendorInvoiceServices.getVendorDisplayName(invoice)}
                  </p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Total:</span>
                      <span className="font-medium">
                        {VendorInvoiceServices.formatCurrency(
                          invoice.total,
                          invoice.currency
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Remaining:</span>
                      <span className="font-medium text-yellow-600">
                        {VendorInvoiceServices.formatCurrency(
                          invoice.remainingAmount,
                          invoice.currency
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Payment Amount:</span>
                      <CustomInput
                        type="text"
                        inputMode="decimal"
                        value={
                          paymentAmounts &&
                          invoice._id &&
                          paymentAmounts[invoice._id] !== undefined
                            ? paymentAmounts[invoice._id]
                            : ""
                        }
                        onChange={(e) =>
                          handleAmountChange(invoice._id, e.target.value)
                        }
                        className="w-32"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h6 className="text-sm font-semibold text-gray-700 mb-2">
                    Currency Conversion
                  </h6>
                  {isLoadingConversion ? (
                    <div className="flex items-center">
                      <Loader className="animate-spin mr-2" size={16} />
                      <span className="text-sm text-gray-500">
                        Calculating...
                      </span>
                    </div>
                  ) : conversionDetails &&
                    invoice._id &&
                    conversionDetails[invoice._id] ? (
                    <div className="space-y-2">
                      <CustomBadge
                        variant={
                          conversionDetails[invoice._id].hasSufficientFunds
                            ? "success"
                            : "danger"
                        }
                      >
                        {conversionDetails[invoice._id].hasSufficientFunds ? (
                          <>
                            <Check size={12} className="mr-1" />
                            Sufficient Funds
                          </>
                        ) : (
                          <>
                            <X size={12} className="mr-1" />
                            Insufficient Funds
                          </>
                        )}
                      </CustomBadge>
                      <div className="text-xs bg-cyan-50 p-2 rounded border">
                        <p className="text-cyan-700 font-medium">
                          {conversionDetails[invoice._id].displayText}
                        </p>
                        {conversionDetails[invoice._id].exchangeRate !== 1 && (
                          <p className="text-cyan-600 text-xs mt-1">
                            Exchange Rate:{" "}
                            {conversionDetails[invoice._id].exchangeRate}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : selectedBankAccount ? (
                    <div className="text-sm text-gray-500">
                      Enter payment amount to see conversion details
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">
                      Select a bank account to see conversion details
                      (optional)
                    </div>
                  )}
                </div>
              </div>
            </CustomCardBody>
          </CustomCard>
        ))}
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="mt-6">
          <CustomAlert variant="danger">
            <div className="flex items-start">
              <AlertTriangle size={20} className="mr-3 mt-0.5 text-red-600" />
              <div>
                <strong className="font-semibold">
                  Please fix the following issues:
                </strong>
                <ul className="mt-2 space-y-1">
                  {validationErrors.map((error, index) => (
                    <li key={index} className="text-sm">
                      {error}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CustomAlert>
        </div>
      )}
    </div>
  );

  // Approve transaction step
  const renderApproveTransactionStep = () => (
    <div>
      <div className="flex items-center mb-6">
        <CheckCircle className="text-[var(--p-blue)] mr-3" size={24} />
        <h4 className="text-xl font-semibold text-[var(--p-blue)] mb-0">
          Approval Management
        </h4>
      </div>

      <CustomAlert variant="warning" className="mb-6">
        <div className="flex items-start">
          <AlertTriangle className="mr-3 mt-0.5" size={20} />
          <div>
            <strong className="font-semibold">
              Checker Approval Required:
            </strong>
            <div className="mt-2 text-sm">
              Review the pending payment intents created by the maker. Approving
              will process the payments and create ledger entries.
            </div>
          </div>
        </div>
      </CustomAlert>

      <div className="space-y-4">
        {invoices.map((invoice) => {
          const pendingPayment = invoice.payments
            ?.filter((p) => p.status === "Pending")
            .pop();

          const selectedBankAccount = localBankAccounts.find(
            (b) => b._id === pendingPayment?.bankAccount
          );

          return (
            <CustomCard
              key={invoice._id}
              className="border-l-4 border-l-[var(--p-blue)]"
            >
              <CustomCardBody>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Invoice Details */}
                  <div>
                    <h6 className="font-semibold text-gray-900 mb-2">
                      {invoice.invoiceNumber}
                    </h6>
                    <p className="text-sm text-gray-600 mb-3">
                      {VendorInvoiceServices.getVendorDisplayName(invoice)}
                    </p>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Invoice Total:</span>
                        <span className="font-medium">
                          {VendorInvoiceServices.formatCurrency(
                            invoice.total,
                            invoice.currency
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Payment Amount:</span>
                        <span className="font-bold text-green-600">
                          {VendorInvoiceServices.formatCurrency(
                            pendingPayment?.amount || 0,
                            invoice.currency
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Approval Status */}
                    <div className="mt-4">
                      <CustomBadge variant="warning">
                        <AlertCircle size={12} className="mr-1" />
                        Pending Approval
                      </CustomBadge>
                    </div>
                  </div>

                  {/* Payment & Conversion Details */}
                  <div>
                    <h6 className="text-sm font-semibold text-gray-700 mb-3">
                      Payment & Currency Details
                    </h6>

                    {pendingPayment && selectedBankAccount && (
                      <div className="space-y-3">
                        {/* Bank Account Info */}
                        <div className="bg-gray-50 p-3 rounded-lg">
                          <div className="text-xs font-semibold text-gray-600 mb-2">
                            💳 Selected Bank Account
                          </div>
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Account:</span>
                              <span className="font-medium">
                                {selectedBankAccount.accountName}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Bank:</span>
                              <span className="font-medium">
                                {selectedBankAccount.bankName}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Currency:</span>
                              <span className="font-medium">
                                {selectedBankAccount.currencyType ||
                                  selectedBankAccount.currency}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Balance:</span>
                              <span className="font-medium">
                                {VendorInvoiceServices.formatCurrency(
                                  selectedBankAccount.openingBalance ||
                                    selectedBankAccount.balance ||
                                    0,
                                  selectedBankAccount.currencyType ||
                                    selectedBankAccount.currency
                                )}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Currency Conversion Details */}
                        {pendingPayment.conversionDetails ? (
                          <div className="bg-cyan-50 p-3 rounded-lg border border-cyan-200">
                            <div className="text-xs font-semibold text-cyan-700 mb-2">
                              💱 Currency Conversion Details
                            </div>
                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between">
                                <span className="text-cyan-600">
                                  Payment Amount:
                                </span>
                                <span className="font-medium text-cyan-800">
                                  {VendorInvoiceServices.formatCurrency(
                                    pendingPayment.amount,
                                    invoice.currency
                                  )}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-cyan-600">
                                  Exchange Rate:
                                </span>
                                <span className="font-medium text-cyan-800">
                                  {
                                    pendingPayment.conversionDetails
                                      .exchangeRate
                                  }
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-cyan-600">
                                  Required Amount:
                                </span>
                                <span className="font-bold text-cyan-900">
                                  {VendorInvoiceServices.formatCurrency(
                                    pendingPayment.conversionDetails
                                      .requiredAmount,
                                    selectedBankAccount.currencyType ||
                                      selectedBankAccount.currency
                                  )}
                                </span>
                              </div>
                              <div className="mt-2 p-2 bg-cyan-100 rounded border">
                                <p className="text-cyan-800 font-medium text-xs">
                                  {pendingPayment.conversionDetails.displayText}
                                </p>
                              </div>

                              {/* Fund Status */}
                              <div className="mt-2">
                                {(() => {
                                  const currentBalance =
                                    selectedBankAccount.openingBalance ||
                                    selectedBankAccount.balance ||
                                    0;
                                  const requiredAmount =
                                    pendingPayment.conversionDetails
                                      .requiredAmount;
                                  const hasSufficientFunds =
                                    currentBalance >= requiredAmount;

                                  return (
                                    <CustomBadge
                                      variant={
                                        hasSufficientFunds
                                          ? "success"
                                          : "danger"
                                      }
                                    >
                                      {hasSufficientFunds ? (
                                        <>
                                          <CheckCircle
                                            size={12}
                                            className="mr-1"
                                          />
                                          Sufficient Funds
                                        </>
                                      ) : (
                                        <>
                                          <X size={12} className="mr-1" />
                                          Insufficient Funds
                                        </>
                                      )}
                                    </CustomBadge>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                            <div className="text-xs font-semibold text-green-700 mb-2">
                              💰 Same Currency Payment
                            </div>
                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between">
                                <span className="text-green-600">
                                  Payment Amount:
                                </span>
                                <span className="font-bold text-green-800">
                                  {VendorInvoiceServices.formatCurrency(
                                    pendingPayment.amount,
                                    invoice.currency
                                  )}
                                </span>
                              </div>
                              <p className="text-green-700 text-xs mt-2">
                                No currency conversion required - same currency
                                as bank account.
                              </p>

                              {/* Fund Status for same currency */}
                              <div className="mt-2">
                                {(() => {
                                  const currentBalance =
                                    selectedBankAccount.openingBalance ||
                                    selectedBankAccount.balance ||
                                    0;
                                  const requiredAmount = pendingPayment.amount;
                                  const hasSufficientFunds =
                                    currentBalance >= requiredAmount;

                                  return (
                                    <CustomBadge
                                      variant={
                                        hasSufficientFunds
                                          ? "success"
                                          : "danger"
                                      }
                                    >
                                      {hasSufficientFunds ? (
                                        <>
                                          <CheckCircle
                                            size={12}
                                            className="mr-1"
                                          />
                                          Sufficient Funds
                                        </>
                                      ) : (
                                        <>
                                          <X size={12} className="mr-1" />
                                          Insufficient Funds
                                        </>
                                      )}
                                    </CustomBadge>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CustomCardBody>
            </CustomCard>
          );
        })}
      </div>
    </div>
  );

  // Processing step
  const renderProcessingStep = () => (
    <div className="text-center py-12">
      <div className="mb-6">
        <Loader
          className="animate-spin text-[var(--p-blue)] mx-auto"
          size={48}
        />
      </div>
      <h4 className="text-xl font-semibold text-[var(--p-blue)] mb-4">
        Processing{" "}
        {PAYMENT_WORKFLOW.find((s) => s.id === bulkMode)?.title || "Action"}
      </h4>
      <p className="text-gray-600 mb-8">
        Please wait while we process your request securely...
      </p>

      <CustomCard>
        <CustomCardBody>
          <div className="flex items-center justify-center space-x-4">
            <CustomBadge variant="light" className="px-3 py-2">
              <FileText size={16} className="mr-2" />
              {invoices.length} Invoices
            </CustomBadge>
            <ArrowRight className="text-gray-400" size={20} />
            <CustomBadge variant="light" className="px-3 py-2">
              <Loader size={16} className="mr-2 animate-spin" />
              Processing
            </CustomBadge>
            <ArrowRight className="text-gray-400" size={20} />
            <CustomBadge variant="light" className="px-3 py-2">
              <CheckCircle size={16} className="mr-2" />
              Next Step
            </CustomBadge>
          </div>

          <div className="mt-6">
            <CustomProgress value={75} className="mb-3 h-3" />
            <p className="text-sm text-gray-500">
              Processing invoices and updating records...
            </p>
          </div>
        </CustomCardBody>
      </CustomCard>
    </div>
  );

  const renderCompleteStep = () => (
    <div className="text-center py-12">
      <div className="mb-6">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
          <CheckCircle className="text-green-600" size={40} />
        </div>
      </div>
      <h4 className="text-2xl font-semibold text-green-700 mb-3">Complete</h4>
      <p className="text-gray-600 mb-8 max-w-lg mx-auto">
        All payment workflow steps are finished for the selected invoice
        {invoices.length !== 1 ? "s" : ""}. Payments have been approved and
        processed.
      </p>
      <CustomButton variant="success" size="lg" onClick={handleClose}>
        <Check size={18} className="mr-2" />
        Done
      </CustomButton>
    </div>
  );

  // Current step renderer
  const renderCurrentStep = () => {
    if (flowComplete || currentStep === 4) {
      return renderCompleteStep();
    }
    switch (currentStep) {
      case 1:
        return renderReviewStep();
      case 2:
        return renderConfigurationStep();
      case 3:
        return renderProcessingStep();
      default:
        return renderReviewStep();
    }
  };

  // Helper function to check for multiple vendors
  const hasMultipleVendors = () => {
    const vendorIds = [
      ...new Set(invoices.map((inv) => inv.vendor?._id).filter(Boolean)),
    ];
    return vendorIds.length > 1;
  };

  const getProcessButtonLabel = () => {
    const step = PAYMENT_WORKFLOW.find((s) => s.id === bulkMode);
    if (!step) return "Process";
    const hasNext = !!getNextWorkflowMode(bulkMode);
    return hasNext
      ? `Complete ${step.title} & Continue`
      : `Complete ${step.title}`;
  };

  // Footer buttons
  const renderFooterButtons = () => {
    if (flowComplete || currentStep === 4) {
      return (
        <div className="flex justify-end w-full">
          <CustomButton variant="success" onClick={handleClose}>
            <Check size={16} className="mr-2" />
            Done
          </CustomButton>
        </div>
      );
    }

    switch (currentStep) {
      case 1:
        return (
          <div className="flex justify-between w-full">
            <CustomButton variant="light" onClick={handleClose}>
              <X size={16} className="mr-2" />
              Close
            </CustomButton>
            <CustomButton
              variant="primary"
              onClick={() => setCurrentStep(2)}
              disabled={bulkMode === "review" || hasMultipleVendors()}
            >
              {bulkMode === "review"
                ? "Select Action First"
                : hasMultipleVendors()
                  ? "Multiple Vendors Selected"
                  : "Continue"}
              <ArrowRight size={16} className="ml-2" />
            </CustomButton>
          </div>
        );
      case 2:
        return (
          <div className="flex justify-between w-full gap-3">
            <CustomButton variant="light" onClick={handleClose}>
              <X size={16} className="mr-2" />
              Close for now
            </CustomButton>
            <div className="flex gap-3">
              <CustomButton
                variant="secondary"
                onClick={() => setCurrentStep(1)}
              >
                <ArrowRight size={16} className="mr-2 rotate-180" />
                Review
              </CustomButton>
              <CustomButton
                variant="success"
                onClick={() => {
                  if (
                    bulkMode === "make-transaction" &&
                    !validateConfiguration()
                  ) {
                    return;
                  }
                  handleProcessAction();
                }}
                disabled={
                  loading ||
                  (bulkMode === "make-transaction" &&
                    validationErrors.length > 0)
                }
              >
                <CheckCircle size={16} className="mr-2" />
                {loading ? "Processing..." : getProcessButtonLabel()}
              </CustomButton>
            </div>
          </div>
        );
      case 3:
        return null;
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={currentStep === 3 ? undefined : handleClose}
      />

      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-6xl bg-white rounded-2xl shadow-2xl transform transition-all">
          {/* Header */}
          <div className="bg-gradient-to-r from-[var(--p-blue)] to-[#9CBA33] px-8 py-6 rounded-t-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <CreditCard size={24} className="text-white mr-3" />
                <h2 className="text-xl font-bold text-white">
                  Vendor Invoice Payment Process
                </h2>
                <CustomBadge
                  variant="light"
                  className="ml-4 text-[var(--p-blue)] bg-white"
                >
                  {invoices.length} Invoice{invoices.length !== 1 ? "s" : ""}
                </CustomBadge>
              </div>
              <button
                onClick={handleClose}
                className="text-white hover:text-gray-200 transition-colors"
                disabled={currentStep === 3}
              >
                <X size={24} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="px-8 py-6 bg-gray-50 min-h-96 max-h-[70vh] overflow-y-auto">
            {renderStepIndicator()}
            {renderCurrentStep()}
          </div>

          {/* Footer */}
          {currentStep !== 3 && (
            <div className="px-8 py-6 bg-gray-50 rounded-b-2xl border-t border-gray-200">
              {renderFooterButtons()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BulkPaymentModal;
