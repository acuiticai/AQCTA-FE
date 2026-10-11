import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useHistory } from "react-router-dom";
import {
  FiEdit2,
  FiPlus,
  FiCheck,
  FiFileText,
  FiAlertTriangle,
} from "react-icons/fi";
import { PageHeader, BackButton, Checkbox, CustomModal } from "@/page-layouts/index";
import { formatAmount, formatDate } from "@/components/formatAmount";
import { notifyError, notifySuccess } from "@/utils/toast";
import BankReconciliationServices from "@/services/BankReconciliationServices";
import AddReconciliationTransactionModal from "@/components/TreasuryAndFinance/AddReconciliationTransactionModal";
import StatementMatchPanel from "@/components/TreasuryAndFinance/StatementMatchPanel";
import ReconciliationAttachments from "@/components/TreasuryAndFinance/ReconciliationAttachments";
import ReconciliationActivity from "@/components/TreasuryAndFinance/ReconciliationActivity";

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Mirrors reconciliationService.calculateTotals so the figures move as the user
 * ticks, without a round trip per checkbox. The server recomputes on save and
 * refuses to reconcile unless its own difference is zero, so it stays the
 * authority — this is only for responsiveness.
 */
const calculateTotals = (rows, openingBalance, closingBalance) => {
  let deposits = 0;
  let withdrawals = 0;
  rows.forEach((t) => {
    if (!t.selected) return;
    const amount = Number(t.amount) || 0;
    if (t.isDeposit) deposits += amount;
    else withdrawals += amount;
  });
  const clearedAmount = round2(deposits - withdrawals);
  const difference = round2(
    (Number(closingBalance) || 0) - ((Number(openingBalance) || 0) + clearedAmount)
  );
  return {
    clearedAmount,
    difference,
    balanced: Math.abs(difference) < 0.005,
  };
};

const ReconciliationWorkspace = () => {
  const { accountId, id } = useParams();
  const history = useHistory();

  const [reconciliation, setReconciliation] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [suggestions, setSuggestions] = useState({});
  const [statementLines, setStatementLines] = useState([]);
  const [closingBalance, setClosingBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [createSeed, setCreateSeed] = useState(null);
  const [pendingExit, setPendingExit] = useState(null);
  const [editingBalance, setEditingBalance] = useState(false);
  const [balanceDraft, setBalanceDraft] = useState("");
  const [excludedForCurrency, setExcludedForCurrency] = useState(0);
  const [reverseTarget, setReverseTarget] = useState(null);
  const [reverseReason, setReverseReason] = useState("");
  const [reversing, setReversing] = useState(false);


  const isDraft = reconciliation?.status === "draft";
  const currency = reconciliation?.currency || "";
  const listRoute = `/bank-management/${accountId}/reconciliations`;

  const totals = useMemo(
    () =>
      reconciliation
        ? calculateTotals(transactions, reconciliation.openingBalance, closingBalance)
        : null,
    [transactions, reconciliation, closingBalance]
  );

  /** Selection to restore after a reload that must not discard unsaved ticks. */
  const selectedIdsRef = useRef([]);
  useEffect(() => {
    selectedIdsRef.current = transactions
      .filter((t) => t.selected)
      .map((t) => t._id);
  }, [transactions]);

  /**
   * The server's persisted selection (clearedTransactions) as of the last load.
   * Kept so a reload can tell the user's *unsaved* local ticks apart from what the
   * server itself changed — a statement-line match that just cleared a
   * transaction, or an unmatch that released one — and reconcile the two.
   */
  const serverSelectedRef = useRef(new Set());

  const load = useCallback(
    async ({ preserveSelection = false, alsoSelect = [] } = {}) => {
      try {
        setLoading(true);

        const res = await BankReconciliationServices.getDetail(id);
        setReconciliation(res.reconciliation);
        setClosingBalance(res.reconciliation?.closingBalance ?? 0);
        setBalanceDraft(String(res.reconciliation?.closingBalance ?? ""));
        setSuggestions(res.suggestions || {});
        setStatementLines(res.statementLines || []);
        setExcludedForCurrency(res.excludedForCurrency || 0);

        const rows = res.transactions || [];
        const serverSelected = new Set(
          rows.filter((t) => t.selected).map((t) => t._id)
        );

        if (preserveSelection) {
          // Start from the server's fresh selection (it already reflects matches
          // and unmatches), then re-apply only the user's UNSAVED local delta —
          // ticks they added and ticks they removed since the last load — plus any
          // ids the caller explicitly wants selected. This keeps a just-matched
          // transaction ticked without re-adding one the user just unmatched.
          const prevServer = serverSelectedRef.current || new Set();
          const localNow = new Set(selectedIdsRef.current);
          const finalSel = new Set(serverSelected);
          // Ticks the user added locally but hasn't saved.
          localNow.forEach((tid) => {
            if (!prevServer.has(tid)) finalSel.add(tid);
          });
          // Ticks the user removed locally but hasn't saved.
          prevServer.forEach((tid) => {
            if (!localNow.has(tid)) finalSel.delete(tid);
          });
          (alsoSelect || []).forEach((tid) => finalSel.add(tid));

          setTransactions(rows.map((t) => ({ ...t, selected: finalSel.has(t._id) })));
        } else {
          setTransactions(rows);
        }

        serverSelectedRef.current = serverSelected;
        if (!preserveSelection) setDirty(false);

        if (res.staleSelectionRemoved > 0) {
          notifyError(
            `${res.staleSelectionRemoved} previously selected transaction(s) are no longer in this period and have been deselected.`
          );
        }
      } catch (error) {
        notifyError(
          error?.response?.data?.message || "Unable to load this reconciliation"
        );
      } finally {
        setLoading(false);
      }
    },
    [id]
  );

  useEffect(() => {
    if (id) load();
  }, [id, load]);

  // Closing the tab or hitting refresh bypasses React Router, so the browser's
  // own prompt is the only thing that can catch it.
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const toggleRow = (txnId) => {
    if (!isDraft) return;
    setTransactions((prev) =>
      prev.map((t) => (t._id === txnId ? { ...t, selected: !t.selected } : t))
    );
    setDirty(true);
  };

  const toggleAll = () => {
    if (!isDraft) return;
    const everySelected =
      transactions.length > 0 && transactions.every((t) => t.selected);
    setTransactions((prev) =>
      prev.map((t) => ({ ...t, selected: !everySelected }))
    );
    setDirty(true);
  };

  const applySuggestions = () => {
    const suggested = new Set(Object.values(suggestions));
    if (suggested.size === 0) return;
    setTransactions((prev) =>
      prev.map((t) => (suggested.has(t._id) ? { ...t, selected: true } : t))
    );
    setDirty(true);
    notifySuccess(`${suggested.size} suggested match(es) selected`);
  };

  /**
   * Reversing a book entry that should never have posted (a failed or duplicate
   * payment). The server posts an opposite-signed entry rather than deleting, so
   * the audit trail survives. A reason is mandatory.
   */
  const submitReverse = async () => {
    if (!reverseTarget) return;
    const reason = reverseReason.trim();
    if (!reason) {
      notifyError("Please give a reason for the reversal.");
      return;
    }
    try {
      setReversing(true);
      await BankReconciliationServices.reverseTransaction(
        id,
        reverseTarget._id,
        reason
      );
      notifySuccess("Transaction reversed");
      setReverseTarget(null);
      setReverseReason("");
      await load({ preserveSelection: true });
    } catch (error) {
      notifyError(
        error?.response?.data?.message || "Unable to reverse transaction"
      );
    } finally {
      setReversing(false);
    }
  };

  const commitBalanceEdit = () => {
    if (balanceDraft === "" || isNaN(Number(balanceDraft))) {
      notifyError("Closing balance must be a number");
      return;
    }
    setClosingBalance(Number(balanceDraft));
    setEditingBalance(false);
    setDirty(true);
  };

  /**
   * Writes the matching work to the draft. Nothing is persisted while the user
   * is ticking, so this is the only path that touches the stored draft short of
   * reconciling.
   */
  const persist = async () => {
    if (closingBalance !== reconciliation.closingBalance) {
      await BankReconciliationServices.updateClosingBalance(id, closingBalance);
    }
    await BankReconciliationServices.updateSelection(
      id,
      transactions.filter((t) => t.selected).map((t) => t._id)
    );
  };

  const handleSaveDraft = async () => {
    try {
      setSaving(true);
      await persist();
      setDirty(false);
      notifySuccess("Draft saved. You can pick this up later.");
      history.push(listRoute);
    } catch (error) {
      notifyError(error?.response?.data?.message || "Unable to save this draft");
    } finally {
      setSaving(false);
    }
  };

  const handleReconcile = async () => {
    try {
      setSaving(true);
      // The server reconciles from its own stored selection, so the current
      // ticks have to land first.
      await persist();
      await BankReconciliationServices.reconcile(id);
      setDirty(false);
      notifySuccess("Period reconciled");
      history.push(listRoute);
    } catch (error) {
      notifyError(error?.response?.data?.message || "Unable to reconcile");
    } finally {
      setSaving(false);
    }
  };

  const leave = (to) => {
    if (dirty) setPendingExit(to);
    else history.push(to);
  };

  const balanced = totals?.balanced;
  const suggestionCount = Object.keys(suggestions || {}).length;
  const allSelected =
    transactions.length > 0 && transactions.every((t) => t.selected);

  if (loading) {
    return (
      <div className="py-6 px-6 text-center text-gray-400">
        Loading reconciliation...
      </div>
    );
  }

  if (!reconciliation) {
    return (
      <div className="py-6 px-6 text-center text-gray-500">
        This reconciliation could not be found.
      </div>
    );
  }

  return (
    <div className="py-6 px-4 sm:px-6 min-h-screen">
      <BackButton onClick={() => leave(listRoute)} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title={`${reconciliation.bankAccount?.accountName || "Bank Account"} - Reconciliation`}
          description={`Period: ${formatDate(reconciliation.startDate)} to ${formatDate(
            reconciliation.endDate
          )}`}
        />
        <button
          type="button"
          onClick={() => leave(`${listRoute}/${id}/status-report`)}
          className="flex items-center gap-2 text-sm text-[var(--p-blue)] hover:opacity-80 mt-2 whitespace-nowrap"
        >
          <FiFileText size={16} />
          View Reconciliation Status
        </button>
      </div>

      {!isDraft && (
        <div className="mt-4 bg-gray-50 border border-gray-200 text-gray-700 rounded-lg px-4 py-2 text-sm">
          This period is{" "}
          <strong>
            {reconciliation.status === "reconciled" ? "reconciled" : "un-reconciled"}
          </strong>{" "}
          and is shown read-only.
          {reconciliation.status === "unreconciled" &&
            reconciliation.unreconcileReason && (
              <span className="block text-xs text-gray-500 mt-1">
                Reason: {reconciliation.unreconcileReason}
              </span>
            )}
        </div>
      )}

      {excludedForCurrency > 0 && (
        <div className="mt-4 flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-2 text-sm">
          <FiAlertTriangle className="mt-0.5 shrink-0" />
          <span>
            {excludedForCurrency} transaction(s) in this period are recorded in a
            currency other than {currency} and are not shown. Reconciling them here
            would mix currencies in one total. Correct the currency on those
            transactions, then reopen this reconciliation.
          </span>
        </div>
      )}

      {isDraft && suggestionCount > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 bg-[#FEF6EC] border border-[var(--p-blue-light-2)] rounded-lg px-4 py-2 text-sm text-gray-700">
          <span>
            {suggestionCount} transaction(s) look like an unambiguous match against
            the imported statement.
          </span>
          <button
            type="button"
            onClick={applySuggestions}
            className="px-4 py-2 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[var(--p-blue-dark)] transition-colors text-xs whitespace-nowrap"
          >
            Select suggested
          </button>
        </div>
      )}

      {statementLines.length > 0 && (
        <div className="mt-6">
          <StatementMatchPanel
            reconciliationId={id}
            statementLines={statementLines}
            transactions={transactions}
            currency={currency}
            readOnly={!isDraft}
            onChanged={() => load({ preserveSelection: true })}
            onCreateFromLine={(line) => {
              setCreateSeed({
                fromLine: true,
                applyTo: line.isDeposit ? "deposit" : "withdrawal",
                amount: line.amount,
                date: line.date,
                reference: line.reference,
                description: line.description,
              });
              setShowAddModal(true);
            }}
          />
        </div>
      )}

      {/* No statement lines for this account + period. Say so, so it isn't
          mistaken for a bug — the most common cause is importing the statement
          against a different account. */}
      {isDraft && statementLines.length === 0 && (
        <div className="mt-6 flex items-start gap-2 bg-gray-50 border border-gray-200 text-gray-600 rounded-lg px-4 py-3 text-sm">
          <FiFileText className="mt-0.5 shrink-0 text-gray-400" size={16} />
          <span>
            No bank statement lines were found for{" "}
            <strong>{reconciliation.bankAccount?.accountName}</strong> in this
            period. If you imported a statement, check it was uploaded against
            this account (Bank Statements → select this account on import).
            Otherwise you can reconcile by ticking the transactions below.
          </span>
        </div>
      )}

      {statementLines.length > 0 && (
        <p className="mt-6 mb-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
          Ledger transactions
        </p>
      )}
      <div className="mt-3 overflow-x-auto">
        <table className="bg-white text-sm border-collapse table-auto w-full min-w-[880px]">
          <thead>
            <tr
              className="bg-gray-100 text-gray-600"
              style={{ backgroundColor: "#F2F2F2" }}
            >
              {["Date", "Transaction Details", "Type", "Deposits", "Withdrawals"].map(
                (header) => (
                  <th
                    key={header}
                    className="py-2 px-4 font-medium"
                    style={{
                      fontFamily: "Inter",
                      fontWeight: "400",
                      textAlign: "left",
                      fontSize: "12px",
                    }}
                  >
                    {header}
                  </th>
                )
              )}
              <th
                className="py-2 px-4 font-medium"
                style={{
                  fontFamily: "Inter",
                  fontWeight: "400",
                  textAlign: "left",
                  fontSize: "12px",
                }}
              >
                <span className="inline-flex items-center gap-2">
                  Select
                  <Checkbox
                    value={allSelected}
                    onChange={toggleAll}
                    disabled={!isDraft || transactions.length === 0}
                  />
                </span>
              </th>
            </tr>
          </thead>
          <tbody style={{ fontSize: "12px" }}>
            {/* Opening balance is context, not something that can be cleared. */}
            <tr className="border-t border-gray-100 bg-gray-50">
              <td className="py-3 px-4">{formatDate(reconciliation.startDate)}</td>
              <td className="py-3 px-4 font-semibold" colSpan={2}>
                *** Opening Balance ***
              </td>
              <td className="py-3 px-4 font-semibold">
                {currency} {formatAmount(reconciliation.openingBalance)}
              </td>
              <td className="py-3 px-4" />
              <td className="py-3 px-4" />
            </tr>

            {transactions.length === 0 && (
              <tr className="border-t border-gray-100">
                <td colSpan={6} className="py-10 px-4 text-center text-gray-500">
                  <p className="mb-2">
                    There are no transactions to reconcile in this period.
                  </p>
                  {isDraft && (
                    <button
                      type="button"
                      onClick={() => setShowAddModal(true)}
                      className="text-[var(--p-blue)] hover:opacity-80"
                    >
                      + Add Transaction
                    </button>
                  )}
                </td>
              </tr>
            )}

            {transactions.map((txn) => {
              const isSuggested = Object.values(suggestions).includes(txn._id);
              return (
                <tr
                  key={txn._id}
                  onClick={() => toggleRow(txn._id)}
                  className={`border-t border-gray-100 ${
                    isDraft ? "cursor-pointer hover:bg-gray-50" : ""
                  } ${txn.selected ? "bg-[var(--p-highlight)]" : ""}`}
                >
                  <td className="py-3 px-4">{formatDate(txn.date)}</td>
                  <td className="py-3 px-4">
                    <span className="block text-gray-800">
                      {txn.description}
                      {txn.reversed && (
                        <span className="ml-2 inline-block rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                          Reversed
                        </span>
                      )}
                    </span>
                    {txn.fx?.originalCurrency && txn.fx?.originalAmount != null && (
                      <span className="block text-xs text-gray-500">
                        {txn.fx.originalCurrency} {formatAmount(txn.fx.originalAmount)}
                        {txn.fx.rate ? ` @ ${txn.fx.rate}` : ""}
                      </span>
                    )}
                    <span className="block text-xs text-gray-400">
                      {txn.reference}
                      {isSuggested && !txn.selected && (
                        <span className="ml-2 text-[var(--p-blue)]">
                          · suggested match
                        </span>
                      )}
                      {isDraft &&
                        !txn.reversed &&
                        !txn.reversalOf &&
                        txn.category !== "Reversal" && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setReverseReason("");
                              setReverseTarget(txn);
                            }}
                            className="ml-2 text-[var(--p-blue)] hover:underline"
                          >
                            · reverse
                          </button>
                        )}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-600">{txn.type}</td>
                  <td className="py-3 px-4">
                    {txn.isDeposit ? `${currency} ${formatAmount(txn.amount)}` : ""}
                  </td>
                  <td className="py-3 px-4">
                    {!txn.isDeposit ? `${currency} ${formatAmount(txn.amount)}` : ""}
                  </td>
                  <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      value={!!txn.selected}
                      onChange={() => toggleRow(txn._id)}
                      disabled={!isDraft}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          {isDraft && (
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 text-sm text-[var(--p-blue)] hover:opacity-80 mb-4"
            >
              <FiPlus size={16} /> Add Transaction
            </button>
          )}

          <ReconciliationAttachments
            reconciliationId={id}
            businessId={reconciliation.business}
            attachments={reconciliation.attachments || []}
            readOnly={!isDraft}
            onChange={(attachments) =>
              setReconciliation((prev) => ({ ...prev, attachments }))
            }
          />
        </div>

        <div className="bg-[#F9F9FA] rounded-lg p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-gray-200">
            <div>
              <span className="text-sm text-gray-700">Closing Balance</span>
              <span className="block text-xs text-gray-500">
                As of {formatDate(reconciliation.endDate)}
              </span>
            </div>
            {editingBalance ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  value={balanceDraft}
                  onChange={(e) => setBalanceDraft(e.target.value)}
                  autoFocus
                  className="w-32 border border-gray-300 rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-[rgba(var(--p-blue-rgb),0.4)]"
                />
                <button
                  type="button"
                  onClick={commitBalanceEdit}
                  className="text-green-600 hover:text-green-700"
                  title="Apply"
                >
                  <FiCheck size={18} />
                </button>
              </div>
            ) : (
              <span className="flex items-center gap-2 text-sm font-medium text-[var(--p-blue)]">
                {currency} {formatAmount(closingBalance)}
                {isDraft && (
                  <button
                    type="button"
                    onClick={() => setEditingBalance(true)}
                    className="text-gray-400 hover:text-[var(--p-blue)]"
                    title="Correct the closing balance"
                  >
                    <FiEdit2 size={14} />
                  </button>
                )}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-gray-200">
            <span className="text-sm text-gray-700">Cleared Amount</span>
            <span className="text-sm font-medium text-green-600">
              {currency} {formatAmount(totals?.clearedAmount ?? 0)}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span className="text-sm text-gray-700">Difference</span>
            <span
              className={`text-sm font-semibold ${
                balanced ? "text-green-600" : "text-red-500"
              }`}
            >
              {currency} {formatAmount(totals?.difference ?? 0)}
            </span>
          </div>

          {isDraft && !balanced && (
            <p className="mt-2 text-xs text-gray-500">
              The difference must reach zero before this period can be reconciled.
              Tick the transactions the bank has confirmed, or add anything the bank
              shows that PCI does not have.
            </p>
          )}
        </div>
      </div>

      <ReconciliationActivity reconciliationId={id} />

      {isDraft && (
        <div className="sticky bottom-0 -mx-4 sm:-mx-6 mt-8 bg-white border-t border-gray-200 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] z-10">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={saving}
              className="px-4 py-2 h-[40px] bg-[#F5F5F5] text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm disabled:opacity-50 whitespace-nowrap"
            >
              {saving ? "Saving..." : "Save and Reconcile Later"}
            </button>
            <button
              type="button"
              onClick={handleReconcile}
              disabled={!balanced || saving}
              title={
                balanced
                  ? "Complete and lock this period"
                  : "The difference must be zero before reconciling"
              }
              className="px-6 py-2 h-[40px] bg-[var(--p-blue)] text-white rounded-lg hover:bg-[var(--p-blue-dark)] transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {saving ? "Working..." : "Reconcile"}
            </button>
            <button
              type="button"
              onClick={() => leave(listRoute)}
              className="px-4 py-2 text-gray-600 text-sm hover:text-gray-800"
            >
              Cancel
            </button>
            {dirty && (
              <span className="text-xs text-amber-700 whitespace-nowrap">
                Unsaved changes
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
            <span className="text-gray-600 whitespace-nowrap">
              Closing Balance:{" "}
              <span className="text-[var(--p-blue)] font-medium">
                {currency} {formatAmount(closingBalance)}
              </span>
            </span>
            <span className="text-gray-600 whitespace-nowrap">
              Difference:{" "}
              <span
                className={`font-semibold ${
                  balanced ? "text-green-600" : "text-red-500"
                }`}
              >
                {currency} {formatAmount(totals?.difference ?? 0)}
              </span>
            </span>
          </div>
        </div>
      )}

      {showAddModal && (
        <AddReconciliationTransactionModal
          reconciliationId={id}
          periodStart={reconciliation.startDate}
          periodEnd={reconciliation.endDate}
          currency={currency}
          seed={createSeed}
          onClose={() => {
            setShowAddModal(false);
            setCreateSeed(null);
          }}
          onAdded={(newTransactionId) => {
            setShowAddModal(false);
            setCreateSeed(null);
            // The new transaction is a real posting, so it is already saved. Reload
            // to pick it up, but keep whatever the user had ticked so far.
            load({
              preserveSelection: true,
              alsoSelect: newTransactionId ? [newTransactionId] : [],
            });
            setDirty(true);
          }}
        />
      )}

      {pendingExit && (
        <CustomModal
          open
          title="Leave without saving?"
          width="min(460px, 92vw)"
          style={{ maxWidth: "92vw", padding: "24px" }}
          onClose={() => setPendingExit(null)}
          onConfirm={() => {
            const to = pendingExit;
            setPendingExit(null);
            setDirty(false);
            history.push(to);
          }}
          confirmText="Discard changes"
        >
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2 text-sm">
            <FiAlertTriangle className="mt-0.5 shrink-0" />
            <span>
              Your matching on this period has not been saved. Leaving now discards
              it — the draft stays as it was when you last saved.
            </span>
          </div>
        </CustomModal>
      )}

      {reverseTarget && (
        <CustomModal
          open
          title="Reverse this entry?"
          width="min(480px, 92vw)"
          style={{ maxWidth: "92vw", padding: "24px" }}
          onClose={() => {
            if (reversing) return;
            setReverseTarget(null);
            setReverseReason("");
          }}
          onConfirm={submitReverse}
          confirmText="Reverse entry"
          savingText="Reversing..."
          loading={reversing}
          disabled={!reverseReason.trim()}
        >
          <div className="space-y-3 text-sm">
            <p className="text-gray-600">
              A reversing entry of{" "}
              <span className="font-medium text-gray-800">
                {currency} {formatAmount(reverseTarget.amount)}
              </span>{" "}
              will be posted against{" "}
              <span className="font-medium text-gray-800">
                {reverseTarget.reference}
              </span>
              . Nothing is deleted — both entries stay on record and cancel out.
            </p>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Reason for reversal
              </label>
              <textarea
                autoFocus
                rows={3}
                value={reverseReason}
                onChange={(e) => setReverseReason(e.target.value)}
                placeholder="e.g. Payment failed at the bank / duplicate posting"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[var(--p-blue)] focus:outline-none"
              />
            </div>
          </div>
        </CustomModal>
      )}
    </div>
  );
};

export default ReconciliationWorkspace;
