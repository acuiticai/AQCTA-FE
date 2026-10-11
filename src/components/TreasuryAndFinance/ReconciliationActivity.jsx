import React, { useState, useEffect, useCallback } from "react";
import { FiActivity, FiChevronDown, FiChevronRight } from "react-icons/fi";
import { formatDate } from "@/components/formatAmount";
import BankReconciliationServices from "@/services/BankReconciliationServices";

// Human labels for the actions the reconciliation records.
const LABELS = {
  createMatch: "Matched statement line(s) to ledger entries",
  removeMatch: "Removed a match",
  reconcile: "Reconciled the period",
  unreconcile: "Reopened the period (un-reconciled)",
  setStatementLineStatus: "Set a statement line's status",
  reverseTransaction: "Reversed a ledger entry",
};

const labelFor = (entry) =>
  LABELS[entry.Function] ||
  `${entry.Action || "Action"}${entry.Function ? ` · ${entry.Function}` : ""}`;

// One short line of the most useful detail for an entry, from its before/after.
const detailFor = (entry) => {
  const nd = entry.newData || {};
  const pd = entry.previousData || {};
  const bits = [];
  if (nd.matchType) bits.push(`${nd.matchType} match`);
  if (Array.isArray(nd.transactions)) bits.push(`${nd.transactions.length} entrie(s)`);
  if (nd.status) bits.push(`marked "${nd.status}"`);
  if (nd.reason) bits.push(`reason: ${nd.reason}`);
  if (nd.reversalReference) bits.push(`reversal ${nd.reversalReference}`);
  if (pd.transaction) bits.push(`on ${pd.transaction}`);
  if (nd.closingBalance != null) bits.push(`closing ${nd.closingBalance}`);
  if (nd.difference != null) bits.push(`difference ${nd.difference}`);
  return bits.join(" · ");
};

const dateTime = (d) => {
  if (!d) return "";
  try {
    return `${formatDate(d)} · ${new Date(d).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  } catch (_) {
    return formatDate(d);
  }
};

/**
 * Read-only audit trail for one reconciliation — every match, unmatch, treatment,
 * reversal, reconcile and reopen, with who and when. Collapsed by default so it
 * doesn't crowd the page; expands on click.
 */
const ReconciliationActivity = ({ reconciliationId }) => {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState([]);

  const load = useCallback(async () => {
    if (!reconciliationId) return;
    try {
      setLoading(true);
      const res = await BankReconciliationServices.getActivity(reconciliationId);
      setEntries(res?.activity || []);
      setLoaded(true);
    } catch (error) {
      setEntries([]);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [reconciliationId]);

  // Fetch the first time it is expanded.
  useEffect(() => {
    if (open && !loaded) load();
  }, [open, loaded, load]);

  return (
    <div className="mt-8 max-w-3xl">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-[var(--p-blue)]"
      >
        {open ? <FiChevronDown size={16} /> : <FiChevronRight size={16} />}
        <FiActivity size={15} />
        Activity log
        {loaded && entries.length > 0 && (
          <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
            {entries.length}
          </span>
        )}
      </button>

      {open && (
        <div className="mt-3 rounded-lg border border-gray-100 bg-white">
          {loading ? (
            <p className="px-4 py-6 text-center text-sm text-gray-400">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-400">
              No activity recorded for this reconciliation yet.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {entries.map((e, i) => {
                const who = e.user_id?.name || e.user_id?.email || "A user";
                const detail = detailFor(e);
                return (
                  <li key={e._id || i} className="flex gap-3 px-4 py-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--p-blue)]" />
                    <div className="min-w-0">
                      <p className="text-sm text-gray-800">{labelFor(e)}</p>
                      {detail && (
                        <p className="mt-0.5 text-xs text-gray-500 break-words">{detail}</p>
                      )}
                      <p className="mt-0.5 text-[11px] text-gray-400">
                        {who} · {dateTime(e.Date)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default ReconciliationActivity;
