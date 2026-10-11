import React, { useState, useMemo } from "react";
import { FiCheck, FiPlus, FiX, FiLink, FiZap, FiRotateCcw } from "react-icons/fi";
import { formatAmount, formatDate } from "@/components/formatAmount";
import { notifyError, notifySuccess } from "@/utils/toast";
import BankReconciliationServices from "@/services/BankReconciliationServices";

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * The statement-driven half of reconciliation: work down the imported bank lines,
 * confirm what the system suggests, match the rest by hand (including several
 * receipts to one deposit), or create a line the books are missing.
 *
 * Matching a line clears its transactions in the ledger — the panel is a richer
 * way to build the same cleared set the tick-list builds, while recording which
 * bank line each entry accounts for.
 */
const StatementMatchPanel = ({
  reconciliationId,
  statementLines = [],
  transactions = [],
  currency,
  readOnly = false,
  onChanged,
  onCreateFromLine,
}) => {
  const [expandedLine, setExpandedLine] = useState(null);
  const [picked, setPicked] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [noteFor, setNoteFor] = useState(null); // { lineId, status }
  const [noteText, setNoteText] = useState("");

  const matched = statementLines.filter((l) => l.matchStatus === "matched");
  const unmatched = statementLines.filter((l) => l.matchStatus !== "matched");

  // Transactions available to match: candidates not already ticked or matched.
  const available = useMemo(
    () => transactions.filter((t) => !t.selected),
    [transactions]
  );

  const txnById = useMemo(() => {
    const m = new Map();
    transactions.forEach((t) => m.set(String(t._id), t));
    return m;
  }, [transactions]);

  const openPicker = (line) => {
    setExpandedLine(String(line._id));
    setPicked(new Set());
  };

  const closePicker = () => {
    setExpandedLine(null);
    setPicked(new Set());
  };

  const togglePick = (txnId) =>
    setPicked((prev) => {
      const next = new Set(prev);
      next.has(txnId) ? next.delete(txnId) : next.add(txnId);
      return next;
    });

  const confirmMatch = async (line, transactionIds, matchType = "manual") => {
    if (!transactionIds.length) {
      notifyError("Select at least one transaction to match.");
      return;
    }
    try {
      setBusy(true);
      const res = await BankReconciliationServices.createMatch(reconciliationId, {
        statementLineIds: [line._id],
        transactionIds,
        matchType,
      });
      notifySuccess("Matched");
      closePicker();
      onChanged?.(res?.totals);
    } catch (error) {
      notifyError(error?.response?.data?.message || "Unable to match");
    } finally {
      setBusy(false);
    }
  };

  const unmatch = async (line) => {
    if (!line.matchId) return;
    try {
      setBusy(true);
      const res = await BankReconciliationServices.removeMatch(
        reconciliationId,
        line.matchId
      );
      notifySuccess("Match removed");
      onChanged?.(res?.totals);
    } catch (error) {
      notifyError(error?.response?.data?.message || "Unable to remove match");
    } finally {
      setBusy(false);
    }
  };

  const setLineStatus = async (line, status, note) => {
    try {
      setBusy(true);
      await BankReconciliationServices.setLineStatus(
        reconciliationId,
        line._id,
        status,
        note
      );
      notifySuccess(
        status === "unmatched" ? "Line cleared" : `Marked ${status}`
      );
      setNoteFor(null);
      setNoteText("");
      onChanged?.();
    } catch (error) {
      notifyError(error?.response?.data?.message || "Unable to update the line");
    } finally {
      setBusy(false);
    }
  };

  const StateChip = ({ status, isSuggested }) => {
    const map = {
      matched: ["Matched", "text-green-600 bg-[var(--good-soft,#2f7d4f1a)]"],
      suggested: ["Suggested", "text-[var(--p-blue)] bg-[#FEF6EC]"],
      unmatched: ["Unmatched", "text-gray-500 bg-gray-100"],
      unidentified: ["Unidentified", "text-amber-700 bg-amber-100"],
      ignored: ["Ignored", "text-gray-500 bg-gray-100 line-through"],
    };
    const key =
      status === "matched"
        ? "matched"
        : status === "unidentified"
        ? "unidentified"
        : status === "ignored"
        ? "ignored"
        : isSuggested
        ? "suggested"
        : "unmatched";
    const [label, cls] = map[key];
    return (
      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${cls}`}>
        {label}
      </span>
    );
  };

  // A render helper, NOT a nested component. Defining a component inside the
  // render remounts every row on each keystroke/click (React sees a new type),
  // which destroys the button you just clicked and throws focus — and the page —
  // to the top. Returning JSX from a plain function lets React reconcile the
  // rows by key instead, so they stay put.
  const renderLine = (line) => {
    const isExpanded = expandedLine === String(line._id);
    const suggestion = line.suggestion;
    const dir = line.isDeposit ? "Deposit" : "Withdrawal";

    const pickedTotal = round2(
      [...picked].reduce(
        (sum, tid) => sum + (Number(txnById.get(tid)?.amount) || 0),
        0
      )
    );
    const balances = Math.abs(pickedTotal - (Number(line.amount) || 0)) < 0.005;

    // For the picker, only show transactions of the same direction as the line.
    const pickable = available.filter((t) => t.isDeposit === line.isDeposit);

    return (
      <div key={line._id} className="border-b border-gray-100 last:border-0">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <span className="text-gray-500 text-xs w-24 shrink-0">
            {formatDate(line.date)}
          </span>
          <span className="flex-1 min-w-[140px]">
            <span className="block text-sm text-gray-800 truncate">
              {line.description}
            </span>
            <span className="block text-[11px] text-gray-400 truncate">
              {line.reference}
            </span>
          </span>
          <span
            className={`hidden sm:inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0 ${
              line.isDeposit
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}
            title={line.isDeposit ? "Money into the account" : "Money out of the account"}
          >
            {dir}
          </span>
          <span
            className={`text-sm font-semibold tabular-nums whitespace-nowrap text-right w-32 shrink-0 ${
              line.isDeposit ? "text-green-600" : "text-red-600"
            }`}
          >
            {line.isDeposit ? "+" : "−"} {currency} {formatAmount(line.amount)}
          </span>
          <StateChip status={line.matchStatus} isSuggested={!!suggestion} />

          {!readOnly && (
            <span className="flex flex-wrap items-center gap-2">
              {line.matchStatus === "matched" ? (
                <button
                  type="button"
                  onClick={() => unmatch(line)}
                  disabled={busy}
                  className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                >
                  <FiX size={14} /> Unmatch
                </button>
              ) : line.matchStatus === "unidentified" || line.matchStatus === "ignored" ? (
                <button
                  type="button"
                  onClick={() => setLineStatus(line, "unmatched")}
                  disabled={busy}
                  className="text-xs text-gray-600 hover:text-[var(--p-blue)] flex items-center gap-1"
                  title="Return this line to unmatched"
                >
                  <FiRotateCcw size={13} /> Reopen
                </button>
              ) : (
                <>
                  {suggestion && (
                    <button
                      type="button"
                      onClick={() =>
                        confirmMatch(line, suggestion.transactionIds, "auto")
                      }
                      disabled={busy}
                      className="text-xs px-2.5 py-1 bg-[var(--p-blue)] text-white rounded-md hover:bg-[var(--p-blue-dark)] flex items-center gap-1"
                      title={
                        suggestion.matchType === "combination"
                          ? `Confirm ${suggestion.transactionIds.length} transactions summing to this line`
                          : "Confirm the suggested match"
                      }
                    >
                      <FiZap size={12} />
                      Confirm{suggestion.matchType === "combination"
                        ? ` (${suggestion.transactionIds.length})`
                        : ""}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => (isExpanded ? closePicker() : openPicker(line))}
                    disabled={busy}
                    className="text-xs px-2.5 py-1 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 flex items-center gap-1"
                  >
                    <FiLink size={12} /> Match
                  </button>
                  <button
                    type="button"
                    onClick={() => onCreateFromLine?.(line)}
                    disabled={busy}
                    className="text-xs px-2.5 py-1 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 flex items-center gap-1"
                    title="Create the ledger entry this bank line is missing"
                  >
                    <FiPlus size={12} /> Create
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNoteFor({ lineId: String(line._id), status: "unidentified" });
                      setNoteText("");
                    }}
                    disabled={busy}
                    className="text-xs text-gray-500 hover:text-amber-700"
                    title="Park this line for investigation"
                  >
                    Unidentified
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNoteFor({ lineId: String(line._id), status: "ignored" });
                      setNoteText("");
                    }}
                    disabled={busy}
                    className="text-xs text-gray-500 hover:text-gray-700"
                    title="Already recorded elsewhere — set aside with a reason"
                  >
                    Ignore
                  </button>
                </>
              )}
            </span>
          )}
        </div>

        {line.statusNote &&
          (line.matchStatus === "unidentified" || line.matchStatus === "ignored") && (
            <p className="px-4 pb-2 -mt-1 text-[11px] text-gray-400">
              Note: {line.statusNote}
            </p>
          )}

        {noteFor?.lineId === String(line._id) && (
          <div className="px-4 pb-3 bg-gray-50/60 flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              autoFocus
              placeholder={
                noteFor.status === "ignored"
                  ? "Why is this being ignored? (e.g. recorded as a journal)"
                  : "What is this? A note for whoever investigates"
              }
              className="flex-1 min-w-[200px] border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[rgba(var(--p-blue-rgb),0.3)]"
            />
            <button
              type="button"
              onClick={() => setLineStatus(line, noteFor.status, noteText)}
              disabled={busy || !noteText.trim()}
              className="text-xs px-3 py-1.5 bg-[var(--p-blue)] text-white rounded-md hover:bg-[var(--p-blue-dark)] disabled:opacity-40"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setNoteFor(null);
                setNoteText("");
              }}
              className="text-xs px-2 py-1.5 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
          </div>
        )}

        {isExpanded && (
          <div className="px-4 pb-3 bg-gray-50/60">
            <p className="text-[11px] text-gray-500 mb-2">
              Select the ledger {dir.toLowerCase()}(s) that make up this line.
              Several can be picked for one line (e.g. receipts banked together).
            </p>
            {pickable.length === 0 ? (
              <p className="text-xs text-gray-400 py-2">
                No unmatched {dir.toLowerCase()}s available. Use Create to add one.
              </p>
            ) : (
              <div className="max-h-52 overflow-y-auto border border-gray-200 rounded-lg bg-white">
                {pickable.map((t) => (
                  <label
                    key={t._id}
                    className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 last:border-0 text-sm cursor-pointer hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={picked.has(String(t._id))}
                      onChange={() => togglePick(String(t._id))}
                      className="w-4 h-4 accent-[var(--p-blue)]"
                    />
                    <span className="text-gray-500 w-20 shrink-0 text-xs">
                      {formatDate(t.date)}
                    </span>
                    <span className="flex-1 truncate text-gray-800">
                      {t.description}
                    </span>
                    <span className="tabular-nums text-gray-800">
                      {currency} {formatAmount(t.amount)}
                    </span>
                  </label>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
              <span className="text-xs text-gray-600">
                Selected: {currency} {formatAmount(pickedTotal)}{" "}
                <span className={balances ? "text-green-600" : "text-gray-400"}>
                  {balances ? "· matches the line" : `· needs ${currency} ${formatAmount(line.amount)}`}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closePicker}
                  className="text-xs px-3 py-1 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => confirmMatch(line, [...picked])}
                  disabled={busy || picked.size === 0 || !balances}
                  className="text-xs px-3 py-1 bg-[var(--p-blue)] text-white rounded-md hover:bg-[var(--p-blue-dark)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <FiCheck size={12} /> Confirm match
                </button>
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (statementLines.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-5 text-sm text-gray-500">
        No bank statement lines were imported for this period. Import the statement
        under Bank Statements to match line by line, or reconcile by ticking
        transactions below.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-800">Statement lines</h3>
        <span className="text-xs text-gray-500">
          {matched.length} matched · {unmatched.length} to review
        </span>
      </div>

      {unmatched.length > 0 && (
        <div>{unmatched.map((line) => renderLine(line))}</div>
      )}

      {matched.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer list-none px-4 py-2 text-xs text-gray-500 bg-gray-50/60 hover:bg-gray-50">
            {matched.length} matched line(s) — click to review
          </summary>
          <div>{matched.map((line) => renderLine(line))}</div>
        </details>
      )}
    </div>
  );
};

export default StatementMatchPanel;
