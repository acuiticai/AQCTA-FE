import React, {
  useState,
  useEffect,
  useCallback,
  useContext,
  useMemo,
} from "react";
import { FiRotateCcw, FiAlertTriangle } from "react-icons/fi";
import {
  PageHeader,
  BackButton,
  Checkbox,
  CustomDatePicker,
  CustomModal,
} from "@/page-layouts/index";
import { formatAmount, formatDate } from "@/components/formatAmount";
import { notifyError, notifySuccess } from "@/utils/toast";
import { AdminContext } from "@/context/AdminContext";
import SettlementServices from "@/services/SettlementServices";
import BankManagementServices from "@/services/BankManagementServices";

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Provider settlement workspace.
 *
 * Card / QR sales sit in a clearing account until the provider pays out a net
 * batch. Here the user picks the clearing account, ticks the sales the payout
 * covers, enters the net the bank actually received, and posts — which books the
 * net into the bank, the fee as an expense, and empties the batch out of
 * clearing. The fee is shown live as gross − net, so it always matches reality.
 */
const ProviderSettlements = () => {
  const {
    state: { adminInfo },
  } = useContext(AdminContext);

  const businesses = useMemo(
    () => adminInfo?.businesses || [],
    [adminInfo?.businesses]
  );
  const [businessId, setBusinessId] = useState("");

  const [clearingAccounts, setClearingAccounts] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [selectedClearing, setSelectedClearing] = useState("");

  const [outstanding, setOutstanding] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [settlements, setSettlements] = useState([]);

  const [date, setDate] = useState(new Date());
  const [bankAccountId, setBankAccountId] = useState("");
  const [netInput, setNetInput] = useState("");
  const [description, setDescription] = useState("");
  const [providerReference, setProviderReference] = useState("");

  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [reverseTarget, setReverseTarget] = useState(null);
  const [reversing, setReversing] = useState(false);

  const clearingAccount = clearingAccounts.find((a) => a._id === selectedClearing);
  const currency = clearingAccount?.currencyType || "";

  // Pick a business once they load.
  useEffect(() => {
    if (!businesses.length) return;
    const valid = new Set(businesses.map((b) => b._id));
    if (!businessId || !valid.has(businessId)) {
      setBusinessId(businesses[0]._id);
    }
  }, [businesses, businessId]);

  const loadAccounts = useCallback(async (biz) => {
    if (!biz) return;
    try {
      const [clearingRes, accountsRes] = await Promise.all([
        SettlementServices.getClearingAccounts(biz),
        BankManagementServices.getAccountsByBusiness(biz),
      ]);
      const clearing = clearingRes?.data || [];
      setClearingAccounts(clearing);
      setBankAccounts(
        (accountsRes?.accounts || []).filter(
          (a) => (a.accountCategory || "bank") === "bank"
        )
      );
      // Default to the first clearing account with something outstanding.
      const firstWithMoney =
        clearing.find((a) => (a.outstandingGross || 0) > 0) || clearing[0];
      setSelectedClearing((prev) => prev || firstWithMoney?._id || "");
    } catch (error) {
      notifyError(
        error?.response?.data?.message || "Unable to load clearing accounts"
      );
    }
  }, []);

  useEffect(() => {
    if (businessId) loadAccounts(businessId);
  }, [businessId, loadAccounts]);

  const loadOutstanding = useCallback(async (account) => {
    if (!account) {
      setOutstanding(null);
      setSettlements([]);
      return;
    }
    try {
      setLoading(true);
      const [out, hist] = await Promise.all([
        SettlementServices.getOutstanding(account),
        SettlementServices.list({ account }),
      ]);
      const data = out?.data || null;
      setOutstanding(data);
      setSettlements(hist?.data?.settlements || []);
      // Tick everything by default — a payout usually covers the whole batch.
      setSelectedIds(new Set((data?.transactions || []).map((t) => t._id)));
      setNetInput(data?.suggestedNet != null ? String(data.suggestedNet) : "");
      setDate(new Date());
    } catch (error) {
      notifyError(
        error?.response?.data?.message || "Unable to load outstanding entries"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOutstanding(selectedClearing);
  }, [selectedClearing, loadOutstanding]);

  const rows = outstanding?.transactions || [];
  const selectedRows = rows.filter((r) => selectedIds.has(r._id));
  const gross = round2(
    selectedRows.reduce((acc, r) => acc + (Number(r.amount) || 0), 0)
  );
  const net = netInput === "" ? null : round2(netInput);
  const fee = net == null ? null : round2(gross - net);
  const netExceedsGross = net != null && net > gross;

  const toggleRow = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    setSelectedIds((prev) =>
      prev.size === rows.length ? new Set() : new Set(rows.map((r) => r._id))
    );
  };

  const canSettle =
    !posting &&
    selectedRows.length > 0 &&
    gross > 0 &&
    net != null &&
    net >= 0 &&
    !netExceedsGross &&
    bankAccountId &&
    date;

  const settle = async () => {
    if (!canSettle) return;
    try {
      setPosting(true);
      await SettlementServices.create({
        business: businessId,
        clearingAccount: selectedClearing,
        bankAccount: bankAccountId,
        netAmount: net,
        date,
        sourceTransactions: selectedRows.map((r) => r._id),
        paymentMethod: outstanding?.method?._id || undefined,
        description: description.trim() || undefined,
        providerReference: providerReference.trim() || undefined,
      });
      notifySuccess("Settlement recorded");
      setDescription("");
      setProviderReference("");
      await Promise.all([loadOutstanding(selectedClearing), loadAccounts(businessId)]);
    } catch (error) {
      notifyError(
        error?.response?.data?.message || "Unable to record settlement"
      );
    } finally {
      setPosting(false);
    }
  };

  const doReverse = async () => {
    if (!reverseTarget) return;
    try {
      setReversing(true);
      await SettlementServices.reverse(reverseTarget._id);
      notifySuccess("Settlement reversed");
      setReverseTarget(null);
      await Promise.all([loadOutstanding(selectedClearing), loadAccounts(businessId)]);
    } catch (error) {
      notifyError(
        error?.response?.data?.message || "Unable to reverse settlement"
      );
    } finally {
      setReversing(false);
    }
  };

  return (
    <div className="p-6">
      <BackButton />
      <PageHeader
        title="Provider Settlements"
        description="Bank the net card / QR batch and capture the merchant fee"
      />

      {/* Selectors */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
        {businesses.length > 1 && (
          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-600 mb-1">Business</label>
            <select
              value={businessId}
              onChange={(e) => {
                setBusinessId(e.target.value);
                setSelectedClearing("");
              }}
              className="p-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
            >
              {businesses.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name || b.companyName || b._id}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1">Clearing account</label>
          <select
            value={selectedClearing}
            onChange={(e) => setSelectedClearing(e.target.value)}
            className="p-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
          >
            <option value="">Select a clearing account</option>
            {clearingAccounts.map((a) => (
              <option key={a._id} value={a._id}>
                {a.accountName}
                {a.currencyType ? ` (${a.currencyType})` : ""} —{" "}
                {formatAmount(a.outstandingGross || 0)} outstanding
              </option>
            ))}
          </select>
          {clearingAccounts.length === 0 && (
            <p className="text-xs text-amber-600 mt-1">
              No clearing accounts. Create a bank account with category “Clearing”
              and point a card/QR payment method at it.
            </p>
          )}
        </div>
      </div>

      {selectedClearing && (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Outstanding batch */}
          <div className="lg:col-span-2">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              In clearing — awaiting settlement
            </h3>
            <div className="overflow-x-auto border border-gray-100 rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-left">
                    <th className="py-2 px-3 w-10">
                      <Checkbox
                        value={rows.length > 0 && selectedIds.size === rows.length}
                        onChange={toggleAll}
                        disabled={rows.length === 0}
                      />
                    </th>
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Details</th>
                    <th className="py-2 px-3 text-center">Age</th>
                    <th className="py-2 px-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r._id}
                      onClick={() => toggleRow(r._id)}
                      className={`border-t border-gray-100 cursor-pointer hover:bg-gray-50 ${
                        selectedIds.has(r._id) ? "bg-[var(--p-highlight)]" : ""
                      }`}
                    >
                      <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          value={selectedIds.has(r._id)}
                          onChange={() => toggleRow(r._id)}
                        />
                      </td>
                      <td className="py-2 px-3">{formatDate(r.date)}</td>
                      <td className="py-2 px-3">
                        <span className="block text-gray-800">{r.description}</span>
                        <span className="block text-xs text-gray-400">{r.reference}</span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        {r.ageDays != null && (
                          <span
                            className={
                              r.ageDays > 7
                                ? "text-amber-600 font-medium"
                                : "text-gray-400"
                            }
                          >
                            {r.ageDays}d
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {currency} {formatAmount(r.amount)}
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-gray-400">
                        {loading
                          ? "Loading…"
                          : "Nothing awaiting settlement in this account."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Settlement form */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Record settlement</h3>
            <div className="border border-gray-100 rounded-lg p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Batch gross ({selectedRows.length})</span>
                <span className="font-medium">
                  {currency} {formatAmount(gross)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Settlement date
                </label>
                <CustomDatePicker value={date} onChange={setDate} placeholder="Date" />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Banked into
                </label>
                <select
                  value={bankAccountId}
                  onChange={(e) => setBankAccountId(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
                >
                  <option value="">Select bank account</option>
                  {bankAccounts.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.accountName}
                      {a.currencyType ? ` (${a.currencyType})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Net actually banked
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={netInput}
                  onChange={(e) => setNetInput(e.target.value)}
                  placeholder="From the bank line"
                  className={`w-full p-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] ${
                    netExceedsGross ? "border-red-500" : "border-gray-300"
                  }`}
                />
                {outstanding?.predictedFee > 0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    Provider fee schedule suggests ≈ {currency}{" "}
                    {formatAmount(outstanding.predictedFee)}.
                  </p>
                )}
              </div>

              <div className="flex justify-between text-sm border-t border-gray-100 pt-2">
                <span className="text-gray-500">Fee (gross − net)</span>
                <span
                  className={`font-medium ${
                    netExceedsGross ? "text-red-500" : "text-gray-800"
                  }`}
                >
                  {fee == null ? "—" : `${currency} ${formatAmount(fee)}`}
                </span>
              </div>
              {netExceedsGross && (
                <p className="text-xs text-red-500">
                  The net banked can’t exceed the batch gross.
                </p>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Provider reference (optional)
                </label>
                <input
                  type="text"
                  value={providerReference}
                  onChange={(e) => setProviderReference(e.target.value)}
                  placeholder="Payout / batch ref from the provider statement"
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Note (optional)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
                />
              </div>

              <button
                type="button"
                onClick={settle}
                disabled={!canSettle}
                className="w-full py-2 rounded-lg text-white text-sm font-medium bg-[var(--p-blue)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {posting ? "Posting…" : "Record settlement"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History */}
      {selectedClearing && settlements.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Settlement history</h3>
          <div className="overflow-x-auto border border-gray-100 rounded-lg">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-left">
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Banked into</th>
                  <th className="py-2 px-3">Provider ref</th>
                  <th className="py-2 px-3 text-right">Gross</th>
                  <th className="py-2 px-3 text-right">Fee</th>
                  <th className="py-2 px-3 text-right">Variance</th>
                  <th className="py-2 px-3 text-right">Net</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {settlements.map((s) => (
                  <tr key={s._id} className="border-t border-gray-100">
                    <td className="py-2 px-3">{formatDate(s.date)}</td>
                    <td className="py-2 px-3">{s.bankAccount?.accountName || "—"}</td>
                    <td className="py-2 px-3 text-gray-500">{s.providerReference || "—"}</td>
                    <td className="py-2 px-3 text-right">{formatAmount(s.grossAmount)}</td>
                    <td className="py-2 px-3 text-right">{formatAmount(s.feeAmount)}</td>
                    <td className="py-2 px-3 text-right">
                      {s.feeVariance == null ? (
                        "—"
                      ) : (
                        <span
                          className={
                            Math.abs(s.feeVariance) >= 0.01
                              ? "text-amber-600"
                              : "text-gray-400"
                          }
                        >
                          {s.feeVariance > 0 ? "+" : ""}
                          {formatAmount(s.feeVariance)}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right">{formatAmount(s.netAmount)}</td>
                    <td className="py-2 px-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          s.status === "reversed"
                            ? "bg-gray-100 text-gray-500 line-through"
                            : "bg-green-50 text-green-700"
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right">
                      {s.status === "posted" && (
                        <button
                          type="button"
                          onClick={() => setReverseTarget(s)}
                          className="inline-flex items-center gap-1 text-xs text-[var(--p-blue)] hover:underline"
                        >
                          <FiRotateCcw size={13} /> Reverse
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {reverseTarget && (
        <CustomModal
          open
          title="Reverse this settlement?"
          width="min(460px, 92vw)"
          style={{ maxWidth: "92vw", padding: "24px" }}
          onClose={() => {
            if (!reversing) setReverseTarget(null);
          }}
          onConfirm={doReverse}
          confirmText="Reverse settlement"
          savingText="Reversing…"
          loading={reversing}
        >
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2 text-sm">
            <FiAlertTriangle className="mt-0.5 shrink-0" />
            <span>
              This removes the three ledger entries this settlement posted, puts
              both balances back, and returns the sales to the clearing account so
              they can be settled again. The bank line must not already be
              reconciled.
            </span>
          </div>
        </CustomModal>
      )}
    </div>
  );
};

export default ProviderSettlements;
