import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  CustomModal,
  FormInput,
  CustomDatePicker,
  DropdownBasic,
} from "@/page-layouts/index";
import { notifyError, notifySuccess } from "@/utils/toast";
import BankReconciliationServices from "@/services/BankReconciliationServices";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

/**
 * Records something the bank shows that the books do not — a charge, a fee,
 * interest credited. Lives inside the workspace so a half-finished
 * reconciliation does not have to be abandoned to go and post a journal.
 */
const AddReconciliationTransactionModal = ({
  reconciliationId,
  periodStart,
  periodEnd,
  currency,
  seed,
  onClose,
  onAdded,
}) => {
  // When created from an unmatched statement line, pre-fill direction, amount,
  // date and description so the user only confirms the account. The bank line
  // already tells us the direction, so it is locked — you can't record a
  // withdrawal against a deposit line.
  const directionLocked = Boolean(seed?.fromLine);
  const [applyTo, setApplyTo] = useState(seed?.applyTo || "deposit");
  const [date, setDate] = useState(seed?.date ? new Date(seed.date) : new Date(periodEnd));
  const [accountCode, setAccountCode] = useState("");
  const [amount, setAmount] = useState(seed?.amount != null ? String(seed.amount) : "");
  const [reference, setReference] = useState(seed?.reference || "");
  const [description, setDescription] = useState(seed?.description || "");
  const [accounts, setAccounts] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const fieldLabel = (text, required) => (
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {text} {required && <span className="text-red-500">*</span>}
    </label>
  );

  const errorMsg = (msg) =>
    msg ? <p className="text-red-500 text-xs mt-1">{msg}</p> : null;

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const res = await axios.get(`${Base_URL}/accounts`, {
          params: { page: 1, limit: 9999 },
        });
        setAccounts(res.data?.accounts || []);
      } catch (error) {
        console.error("Error fetching chart of accounts:", error);
      }
    };
    fetchAccounts();
  }, []);

  const validate = () => {
    const next = {};
    if (!date) {
      next.date = "Date is required";
    } else {
      const start = new Date(periodStart);
      const end = new Date(periodEnd);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      if (date < start || date > end) {
        next.date = "The date must fall inside the reconciliation period";
      }
    }
    if (!accountCode) next.accountCode = "Select an account";
    if (amount === "" || isNaN(Number(amount)) || Number(amount) <= 0) {
      next.amount = "Amount must be a positive number";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleConfirm = async () => {
    if (!validate()) return;

    try {
      setSubmitting(true);
      const selected = accounts.find((a) => a._id === accountCode);
      const res = await BankReconciliationServices.addTransaction(
        reconciliationId,
        {
          applyTo,
          date,
          accountCode,
          amount: Number(amount),
          reference: reference.trim(),
          description: description.trim() || selected?.accountName || "",
          category: selected?.accountName || "Bank Charges",
        }
      );
      notifySuccess("Transaction added");
      // Hand the id back so the workspace can tick it without losing the
      // selection the user has built up but not yet saved.
      onAdded?.(res?.transaction?._id);
    } catch (error) {
      notifyError(
        error?.response?.data?.message || "Unable to add this transaction"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CustomModal
      open
      title="Add Transaction"
      width="min(560px, 92vw)"
      style={{ maxWidth: "92vw", padding: "24px" }}
      onClose={onClose}
      onConfirm={handleConfirm}
      loading={submitting}
      confirmText="Save"
      savingText="Saving..."
      focusTrapped={false}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col">
          {fieldLabel("Apply To")}
          {directionLocked ? (
            <span
              className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                applyTo === "deposit"
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {applyTo === "deposit" ? "Deposit" : "Withdrawal"}
              <span className="text-gray-400 font-normal">· from this bank line</span>
            </span>
          ) : (
            <div className="flex items-center gap-6">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="applyTo"
                  checked={applyTo === "deposit"}
                  onChange={() => setApplyTo("deposit")}
                  className="h-4 w-4 text-[var(--p-blue)] border-gray-300"
                />
                <span className="text-sm text-gray-700">Deposits</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="applyTo"
                  checked={applyTo === "withdrawal"}
                  onChange={() => setApplyTo("withdrawal")}
                  className="h-4 w-4 text-[var(--p-blue)] border-gray-300"
                />
                <span className="text-sm text-gray-700">Withdrawals</span>
              </label>
            </div>
          )}
        </div>

        <div className="flex flex-col">
          {fieldLabel("Date", true)}
          <div
            className={errors.date ? "border-2 border-red-500 rounded-lg" : ""}
          >
            <CustomDatePicker
              value={date}
              onChange={setDate}
              placeholder="Date"
              minDate={new Date(periodStart)}
              maxDate={new Date(periodEnd)}
              error={errors.date}
              shouldShowError={!!errors.date}
              showErrorText={false}
            />
          </div>
          {errorMsg(errors.date)}
          <button
            type="button"
            onClick={() => setDate(new Date())}
            className="mt-1 text-xs text-[var(--p-blue)] hover:opacity-80 self-start"
          >
            Use Today&apos;s date
          </button>
        </div>

        <div className="flex flex-col">
          {fieldLabel("Account", true)}
          <div
            className={
              errors.accountCode ? "border-2 border-red-500 rounded-lg" : ""
            }
          >
            <DropdownBasic
              options={accounts.map((acct) => ({
                value: acct._id,
                label: acct.accountCode
                  ? `${acct.accountName} (${acct.accountCode})`
                  : acct.accountName,
              }))}
              value={accountCode}
              onChange={(value) => setAccountCode(value)}
              placeholder="Select an account"
            />
          </div>
          {errorMsg(errors.accountCode)}
        </div>

        <div className="flex flex-col">
          {fieldLabel(`Amount ${currency ? `(${currency})` : ""}`, true)}
          <FormInput
            type="number"
            step="0.01"
            min="0"
            name="amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            error={errors.amount}
            shouldShowError={!!errors.amount}
            noLabel
          />
        </div>

        <div className="flex flex-col">
          {fieldLabel("Reference #")}
          <FormInput
            type="text"
            name="reference"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Optional - the bank's own reference"
            noLabel
          />
        </div>

        <div className="flex flex-col">
          {fieldLabel("Description")}
          <FormInput
            type="text"
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional"
            noLabel
          />
        </div>

        <p className="text-xs text-gray-500">
          This is recorded as a normal transaction against the bank account and is
          selected automatically, since you are adding it having seen it on the
          statement.
        </p>
      </div>
    </CustomModal>
  );
};

export default AddReconciliationTransactionModal;
