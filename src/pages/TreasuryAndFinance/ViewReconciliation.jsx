import React, { useState, useEffect, useCallback } from "react";
import { useParams, useHistory } from "react-router-dom";
import { FiFileText, FiEdit2 } from "react-icons/fi";
import { PageHeader, BackButton } from "@/page-layouts/index";
import { formatAmount, formatDate } from "@/components/formatAmount";
import { notifyError } from "@/utils/toast";
import BankReconciliationServices from "@/services/BankReconciliationServices";
import ReconciliationAttachments from "@/components/TreasuryAndFinance/ReconciliationAttachments";
import ReconciliationActivity from "@/components/TreasuryAndFinance/ReconciliationActivity";

const STATUS_LABEL = {
  draft: "Draft",
  reconciled: "Reconciled",
  unreconciled: "Un-reconciled",
};

const STATUS_CLASS = {
  draft: "text-lime-500",
  reconciled: "text-green-500",
  unreconciled: "text-red-500",
};

/**
 * Read-only view of a reconciliation, laid out like the create form so the same
 * fields sit in the same places. Everything is rendered as text rather than
 * disabled inputs — a greyed-out input still reads as "something you could edit
 * if only it were enabled", which is the wrong signal for a closed period.
 */
const ViewReconciliation = () => {
  const { accountId, id } = useParams();
  const history = useHistory();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const listRoute = `/bank-management/${accountId}/reconciliations`;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await BankReconciliationServices.getDetail(id);
      setData(res);
    } catch (error) {
      notifyError(
        error?.response?.data?.message || "Unable to load this reconciliation"
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) load();
  }, [id, load]);

  const fieldLabel = (text) => (
    <label className="block text-sm font-medium text-gray-700 mb-1">{text}</label>
  );

  /** Matches the height and rhythm of a FormInput so the grid stays aligned. */
  const readOnlyValue = (value, muted = false) => (
    <div
      className={`w-full min-h-[40px] flex items-center px-4 py-2 bg-[#F9F9FA] border border-gray-200 rounded-[12px] text-sm ${
        muted ? "text-gray-400" : "text-gray-800"
      }`}
    >
      {value}
    </div>
  );

  if (loading) {
    return (
      <div className="py-6 px-4 sm:px-6 text-center text-gray-400">
        Loading reconciliation...
      </div>
    );
  }

  const reconciliation = data?.reconciliation;
  if (!reconciliation) {
    return (
      <div className="py-6 px-4 sm:px-6 text-center text-gray-500">
        This reconciliation could not be found.
      </div>
    );
  }

  const account = reconciliation.bankAccount;
  const currency = reconciliation.currency || "";
  const transactions = data?.transactions || [];
  const cleared = transactions.filter((t) => t.selected);
  const isDraft = reconciliation.status === "draft";
  const balanced = Math.abs(Number(reconciliation.difference) || 0) < 0.005;

  return (
    <div className="py-6 px-4 sm:px-6 min-h-screen">
      <BackButton onClick={() => history.push(listRoute)} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title={`${account?.accountName || "Bank Account"} - View Reconciliation`}
        />
        <div className="flex items-center gap-3 mt-2">
          {isDraft && (
            <button
              type="button"
              onClick={() => history.push(`${listRoute}/${id}/edit`)}
              className="flex items-center gap-2 h-[40px] px-4 py-2 bg-[#F5F5F5] text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
            >
              <FiEdit2 size={16} /> Edit
            </button>
          )}
          {reconciliation.status === "reconciled" && (
            <button
              type="button"
              onClick={() => history.push(`${listRoute}/${id}/status-report`)}
              className="flex items-center gap-2 h-[40px] px-4 py-2 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[var(--p-blue-dark)] transition-colors text-sm"
            >
              <FiFileText size={16} /> Status Report
            </button>
          )}
        </div>
      </div>

      <div className="space-y-6 mt-4 max-w-3xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col">
            {fieldLabel("Start Date")}
            {readOnlyValue(formatDate(reconciliation.startDate))}
          </div>
          <div className="flex flex-col">
            {fieldLabel("End Date")}
            {readOnlyValue(formatDate(reconciliation.endDate))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col">
            {fieldLabel(`Closing Balance ${currency ? `(${currency})` : ""}`)}
            {readOnlyValue(formatAmount(reconciliation.closingBalance))}
            <p className="text-xs text-gray-500 mt-1">
              As reported by the bank for the end date.
            </p>
          </div>
          <div className="flex flex-col">
            {fieldLabel(`Opening Balance ${currency ? `(${currency})` : ""}`)}
            {readOnlyValue(formatAmount(reconciliation.openingBalance))}
            <p className="text-xs text-gray-500 mt-1">
              Carried forward from the previous reconciled period.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col">
            {fieldLabel("Status")}
            <div className="w-full min-h-[40px] flex items-center px-4 py-2 bg-[#F9F9FA] border border-gray-200 rounded-[12px] text-sm">
              <span
                className={`font-medium ${STATUS_CLASS[reconciliation.status] || "text-gray-500"}`}
              >
                {STATUS_LABEL[reconciliation.status] || reconciliation.status}
              </span>
            </div>
            {reconciliation.status === "unreconciled" &&
              reconciliation.unreconcileReason && (
                <p className="text-xs text-gray-500 mt-1">
                  Reason: {reconciliation.unreconcileReason}
                </p>
              )}
          </div>
          <div className="flex flex-col">
            {fieldLabel("Reconciled On")}
            {readOnlyValue(
              reconciliation.reconciledAt
                ? formatDate(reconciliation.reconciledAt)
                : "Not yet reconciled",
              !reconciliation.reconciledAt
            )}
            {reconciliation.reconciledBy?.name && (
              <p className="text-xs text-gray-500 mt-1">
                By {reconciliation.reconciledBy.name}
              </p>
            )}
          </div>
        </div>

        <div className="bg-[#F9F9FA] rounded-lg p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-gray-200">
            <span className="text-sm text-gray-700">Cleared Amount</span>
            <span className="text-sm font-medium text-green-600">
              {currency} {formatAmount(reconciliation.clearedAmount)}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-gray-200">
            <span className="text-sm text-gray-700">Difference</span>
            <span
              className={`text-sm font-semibold ${
                balanced ? "text-green-600" : "text-red-500"
              }`}
            >
              {currency} {formatAmount(reconciliation.difference)}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span className="text-sm text-gray-700">Transactions Cleared</span>
            <span className="text-sm font-medium text-gray-800">
              {cleared.length}
            </span>
          </div>
        </div>

        <ReconciliationAttachments
          reconciliationId={id}
          businessId={reconciliation.business}
          attachments={reconciliation.attachments || []}
          readOnly
          onChange={() => load()}
        />
      </div>

      {cleared.length > 0 && (
        <div className="mt-8 max-w-3xl overflow-x-auto">
          <p className="mb-2 text-sm font-medium text-gray-700">
            Cleared Transactions
          </p>
          <table className="bg-white text-sm border-collapse table-auto w-full min-w-[640px]">
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
              </tr>
            </thead>
            <tbody style={{ fontSize: "12px" }}>
              {cleared.map((txn) => (
                <tr key={txn._id} className="border-t border-gray-100">
                  <td className="py-3 px-4">{formatDate(txn.date)}</td>
                  <td className="py-3 px-4">
                    <span className="block text-gray-800">{txn.description}</span>
                    <span className="block text-xs text-gray-400">
                      {txn.reference}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-600">{txn.type}</td>
                  <td className="py-3 px-4">
                    {txn.isDeposit ? `${currency} ${formatAmount(txn.amount)}` : ""}
                  </td>
                  <td className="py-3 px-4">
                    {!txn.isDeposit ? `${currency} ${formatAmount(txn.amount)}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ReconciliationActivity reconciliationId={id} />
    </div>
  );
};

export default ViewReconciliation;
