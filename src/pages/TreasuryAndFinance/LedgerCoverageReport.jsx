import React, { useState, useEffect, useCallback } from "react";
import { useHistory } from "react-router-dom";
import { FiCheckCircle, FiAlertTriangle, FiRefreshCw } from "react-icons/fi";
import { PageHeader, BackButton } from "@/page-layouts/index";
import { formatAmount, formatDate } from "@/components/formatAmount";
import { notifyError } from "@/utils/toast";
import LedgerCoverageServices from "@/services/LedgerCoverageServices";

/**
 * Ledger coverage report — the standing guardrail from Phase 5. It shows how much
 * of the cash-movement ledger carries a bank account (and is therefore
 * reconcilable), and lists any entries that do not, grouped by source, so a new
 * gap surfaces before it reaches a reconciliation.
 */
const LedgerCoverageReport = () => {
  const history = useHistory();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await LedgerCoverageServices.getReport();
      setData(res?.data || null);
    } catch (error) {
      notifyError(
        error?.response?.data?.message || "Unable to load the coverage report"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const healthy = data?.healthy;
  const coverage = data?.coverage ?? 0;

  return (
    <div className="py-6 px-4 sm:px-6 min-h-screen">
      <BackButton onClick={() => history.push("/bank-management")} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Ledger Coverage"
          description="How much of the cash-movement ledger is reconcilable, and where the gaps are."
        />
        <button
          type="button"
          onClick={load}
          className="flex items-center gap-2 h-[40px] px-4 py-2 mt-2 bg-[#F5F5F5] text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
        >
          <FiRefreshCw size={16} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="py-10 text-center text-gray-400">Loading…</div>
      ) : !data ? (
        <div className="py-10 text-center text-gray-500">
          The report could not be built.
        </div>
      ) : (
        <div className="mt-6 space-y-6 max-w-4xl">
          {/* Summary */}
          <div
            className={`rounded-xl p-5 border ${
              healthy
                ? "bg-green-50 border-green-200"
                : "bg-amber-50 border-amber-200"
            }`}
          >
            <div className="flex items-start gap-3">
              {healthy ? (
                <FiCheckCircle className="text-green-600 mt-0.5 shrink-0" size={22} />
              ) : (
                <FiAlertTriangle className="text-amber-600 mt-0.5 shrink-0" size={22} />
              )}
              <div>
                <p className="text-sm font-semibold text-gray-800">
                  {coverage}% of cash-movement entries carry a bank account
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  {data.withAccount} of {data.total} reconcilable ·{" "}
                  {data.missing} without an account.{" "}
                  {healthy
                    ? "Every cash-movement entry is reconcilable."
                    : "The entries below post to the ledger without a bank account. Credit-only receipts and internal adjustments legitimately have none — anything else is a source that should be wired up."}
                </p>
              </div>
            </div>
          </div>

          {/* Gaps by source */}
          {data.gaps?.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
              <p className="px-4 pt-4 pb-2 text-sm font-semibold text-gray-800">
                Gaps by source
              </p>
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr
                    className="bg-gray-100 text-gray-600"
                    style={{ backgroundColor: "#F2F2F2" }}
                  >
                    {["Category", "Type", "Count", "Amount"].map((h) => (
                      <th
                        key={h}
                        className="py-2 px-4 font-medium text-left"
                        style={{ fontSize: "12px", fontWeight: 400 }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody style={{ fontSize: "12px" }}>
                  {data.gaps.map((g, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="py-3 px-4 text-gray-800">{g.category}</td>
                      <td className="py-3 px-4 text-gray-600">{g.type}</td>
                      <td className="py-3 px-4 tabular-nums">{g.count}</td>
                      <td className="py-3 px-4 tabular-nums">
                        {formatAmount(g.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Recent examples */}
          {data.recentGaps?.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
              <p className="px-4 pt-4 pb-2 text-sm font-semibold text-gray-800">
                Recent entries without a bank account
              </p>
              <table className="w-full min-w-[600px] text-sm">
                <thead>
                  <tr
                    className="bg-gray-100 text-gray-600"
                    style={{ backgroundColor: "#F2F2F2" }}
                  >
                    {["Date", "Description", "Type", "Amount"].map((h) => (
                      <th
                        key={h}
                        className="py-2 px-4 font-medium text-left"
                        style={{ fontSize: "12px", fontWeight: 400 }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody style={{ fontSize: "12px" }}>
                  {data.recentGaps.map((t) => (
                    <tr key={t._id} className="border-t border-gray-100">
                      <td className="py-3 px-4">{formatDate(t.date)}</td>
                      <td className="py-3 px-4 text-gray-800">{t.description}</td>
                      <td className="py-3 px-4 text-gray-600">{t.type}</td>
                      <td className="py-3 px-4 tabular-nums">
                        {t.currency} {formatAmount(t.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LedgerCoverageReport;
