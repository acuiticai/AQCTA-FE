import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Landmark, ChevronDown } from "lucide-react";
import { notifyError, notifySuccess } from "@/utils/toast";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

/**
 * Self-contained settings section: which bank account payroll disbursements are
 * paid from. When a run is marked paid, the net pay posts to this account so it
 * can be reconciled against the salary debit on the bank statement.
 *
 * Kept standalone so it manages its own load/save without threading state through
 * the large PayrollSettings page.
 */
const PayrollBankAccountSection = ({ business }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [postingEnabled, setPostingEnabled] = useState(false);
  const [payingAccount, setPayingAccount] = useState("");

  const load = useCallback(async () => {
    if (!business) return;
    setLoading(true);
    try {
      const { data } = await axios.get(`${Base_URL}/payroll/ledger-settings`, {
        params: { business },
      });
      if (data?.success && data?.data) {
        const { settings, bankAccounts: accts } = data.data;
        setBankAccounts(accts || []);
        setPostingEnabled(!!settings?.postingEnabled);
        setPayingAccount(settings?.payingAccount || "");
      }
    } catch (err) {
      notifyError(
        err?.response?.data?.message || "Failed to load payroll bank settings"
      );
    } finally {
      setLoading(false);
    }
  }, [business]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    if (postingEnabled && !payingAccount) {
      notifyError("Choose the account salaries are paid from before turning posting on.");
      return;
    }
    setSaving(true);
    try {
      const { data } = await axios.put(`${Base_URL}/payroll/ledger-settings`, {
        business,
        postingEnabled,
        payingAccount: payingAccount || null,
      });
      if (data?.success) {
        notifySuccess("Payroll bank settings saved");
        load();
      }
    } catch (err) {
      notifyError(
        err?.response?.data?.message || "Failed to save payroll bank settings"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4"
      >
        <span className="flex items-center gap-2.5">
          <Landmark className="w-4 h-4 text-[var(--p-blue)]" />
          <span className="text-sm font-semibold text-gray-800">
            Bank Account &amp; Reconciliation
          </span>
        </span>
        <ChevronDown
          className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          open ? "max-h-[900px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-5 pb-5 pt-1">
          <p className="text-[12px] text-gray-500 mb-4 max-w-prose">
            When a payroll run is marked paid, the net pay leaves this bank account.
            Recording it here posts the disbursement to the ledger so it can be
            reconciled against the salary debit on your bank statement. Salaries
            post as one entry per run, matching a single batch payment.
          </p>

          {bankAccounts.length === 0 ? (
            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 text-xs text-amber-800">
              This business has no bank accounts yet. Add them under{" "}
              <strong>Treasury &amp; Finance &gt; Banking Accounts</strong> first.
            </div>
          ) : (
            <div className="space-y-4">
              <label className="flex items-center gap-2.5 p-3 rounded-lg border border-gray-200 bg-gray-50/60 cursor-pointer">
                <input
                  type="checkbox"
                  checked={postingEnabled}
                  onChange={(e) => setPostingEnabled(e.target.checked)}
                  className="w-4 h-4 accent-[var(--p-blue)]"
                />
                <span className="text-xs font-semibold text-gray-700">
                  Post payroll disbursements to the accounting ledger
                </span>
              </label>

              <div className="max-w-sm">
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Salaries paid from
                </label>
                <select
                  value={payingAccount}
                  onChange={(e) => setPayingAccount(e.target.value)}
                  className="w-full h-9 px-2.5 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[rgba(var(--p-blue-rgb),0.3)]"
                >
                  <option value="">Select a bank account…</option>
                  {bankAccounts.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.accountName}
                      {a.currencyType ? ` (${a.currencyType})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleSave}
                disabled={loading || saving}
                className="h-8 px-4 text-[11px] font-semibold rounded-lg bg-[var(--p-blue)] text-white hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PayrollBankAccountSection;
