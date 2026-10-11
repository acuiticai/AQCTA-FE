import React, { useState, useEffect, useMemo, useCallback } from "react";
import { FiAlertTriangle } from "react-icons/fi";
import { CustomModal, FormInput, CustomDatePicker } from "@/page-layouts/index";
import { formatAmount, formatDate } from "@/components/formatAmount";
import { notifyError, notifySuccess } from "@/utils/toast";
import BankDepositServices from "@/services/BankDepositServices";
import BankManagementServices from "@/services/BankManagementServices";

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Records banking a batch of cash into a bank account. The user picks the holding
 * account the cash sits in, ticks the receipts being banked, and the deposit
 * posts as one movement into this bank account — the single line that matches
 * the deposit slip on the statement.
 */
const RecordDepositModal = ({ business, toAccount, currency, onClose, onDone }) => {
  const [sourceAccounts, setSourceAccounts] = useState([]);
  const [fromAccount, setFromAccount] = useState("");
  const [receipts, setReceipts] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [date, setDate] = useState(new Date());
  const [loadingReceipts, setLoadingReceipts] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Holding accounts to bank from: the business's other bank accounts.
  useEffect(() => {
    (async () => {
      try {
        const res = await BankManagementServices.getAllAccounts();
        const list = (res?.accounts || []).filter(
          (a) => String(a.business) === String(business) && a._id !== toAccount
        );
        setSourceAccounts(list);
      } catch (error) {
        console.error("Error loading accounts for deposit:", error);
      }
    })();
  }, [business, toAccount]);

  const loadReceipts = useCallback(async (accountId) => {
    if (!accountId) {
      setReceipts([]);
      setSelected(new Set());
      return;
    }
    try {
      setLoadingReceipts(true);
      const res = await BankDepositServices.getUndeposited(accountId);
      const rows = res?.data?.transactions || [];
      setReceipts(rows);
      // Default to banking everything sitting in the account.
      setSelected(new Set(rows.map((r) => r._id)));
    } catch (error) {
      notifyError(
        error?.response?.data?.message || "Unable to load undeposited receipts"
      );
    } finally {
      setLoadingReceipts(false);
    }
  }, []);

  useEffect(() => {
    loadReceipts(fromAccount);
  }, [fromAccount, loadReceipts]);

  const selectedTotal = useMemo(
    () =>
      round2(
        receipts
          .filter((r) => selected.has(r._id))
          .reduce((sum, r) => sum + (Number(r.amount) || 0), 0)
      ),
    [receipts, selected]
  );

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleConfirm = async () => {
    if (!fromAccount) {
      notifyError("Choose the account the cash is being banked from");
      return;
    }
    if (selectedTotal <= 0) {
      notifyError("Select at least one receipt to bank");
      return;
    }
    try {
      setSubmitting(true);
      await BankDepositServices.create({
        business,
        fromAccount,
        toAccount,
        amount: selectedTotal,
        date,
        sourceTransactions: [...selected],
      });
      notifySuccess("Deposit recorded");
      onDone?.();
    } catch (error) {
      notifyError(error?.response?.data?.message || "Unable to record the deposit");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CustomModal
      open
      title="Record Deposit"
      width="min(620px, 94vw)"
      style={{ maxWidth: "94vw", padding: "24px" }}
      onClose={onClose}
      onConfirm={handleConfirm}
      loading={submitting}
      confirmText="Record Deposit"
      savingText="Recording..."
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-2 bg-[#FEF6EC] border border-[var(--p-blue-light-2)] text-gray-700 rounded-lg px-3 py-2 text-sm">
          <FiAlertTriangle className="mt-0.5 shrink-0 text-[var(--p-blue)]" />
          <span>
            This banks cash sitting in a holding account into this account as one
            movement — the line that matches your deposit slip on the statement.
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bank from <span className="text-red-500">*</span>
            </label>
            <select
              value={fromAccount}
              onChange={(e) => setFromAccount(e.target.value)}
              className="w-full h-[40px] px-3 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[rgba(var(--p-blue-rgb),0.3)]"
            >
              <option value="">Select a holding account…</option>
              {sourceAccounts.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.accountName}
                  {a.currencyType ? ` (${a.currencyType})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Deposit date <span className="text-red-500">*</span>
            </label>
            <CustomDatePicker
              value={date}
              onChange={setDate}
              placeholder="Deposit date"
              showErrorText={false}
            />
          </div>
        </div>

        {fromAccount && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">
                Receipts to bank
              </label>
              {receipts.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setSelected((prev) =>
                      prev.size === receipts.length
                        ? new Set()
                        : new Set(receipts.map((r) => r._id))
                    )
                  }
                  className="text-xs text-[var(--p-blue)] hover:opacity-80"
                >
                  {selected.size === receipts.length ? "Clear all" : "Select all"}
                </button>
              )}
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
              {loadingReceipts ? (
                <p className="text-sm text-gray-400 text-center py-6">
                  Loading receipts…
                </p>
              ) : receipts.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">
                  Nothing waiting to be banked in this account.
                </p>
              ) : (
                receipts.map((r) => (
                  <label
                    key={r._id}
                    className="flex items-center gap-3 px-3 py-2 border-b border-gray-100 last:border-0 cursor-pointer hover:bg-gray-50 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(r._id)}
                      onChange={() => toggle(r._id)}
                      className="w-4 h-4 accent-[var(--p-blue)]"
                    />
                    <span className="text-gray-500 w-24 shrink-0">
                      {formatDate(r.date)}
                    </span>
                    <span className="text-gray-800 flex-1 truncate">
                      {r.description}
                    </span>
                    <span className="text-gray-800 font-medium tabular-nums">
                      {currency} {formatAmount(r.amount)}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between bg-[#F9F9FA] rounded-lg px-4 py-3">
          <span className="text-sm text-gray-700">Deposit total</span>
          <span className="text-base font-semibold text-[var(--p-blue)] tabular-nums">
            {currency} {formatAmount(selectedTotal)}
          </span>
        </div>
      </div>
    </CustomModal>
  );
};

export default RecordDepositModal;
