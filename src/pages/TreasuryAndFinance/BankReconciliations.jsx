import React, { useState, useEffect, useCallback } from "react";
import { useParams, useHistory } from "react-router-dom";
import { FiPaperclip, FiRotateCcw, FiFileText, FiDownload } from "react-icons/fi";
import { AiOutlineDelete, AiOutlineEdit, AiOutlineEye } from "react-icons/ai";
import { PageHeader, BackButton, DataTable } from "@/page-layouts/index";
import { formatAmount, formatDate } from "@/components/formatAmount";
import { notifyError } from "@/utils/toast";
import BankReconciliationServices from "@/services/BankReconciliationServices";
import BankManagementServices from "@/services/BankManagementServices";
import UnreconcileModal from "@/components/TreasuryAndFinance/UnreconcileModal";
import DeleteDraftModal from "@/components/TreasuryAndFinance/DeleteDraftModal";
import RecordDepositModal from "@/components/TreasuryAndFinance/RecordDepositModal";

const STATUS_LABEL = {
  draft: "Draft",
  reconciled: "Reconciled",
  unreconciled: "Un-reconciled",
};

// Matches the colours StatusBadge uses elsewhere in the product.
const STATUS_CLASS = {
  draft: "text-lime-500",
  reconciled: "text-green-500",
  unreconciled: "text-red-500",
};

const BankReconciliations = () => {
  const { accountId } = useParams();
  const history = useHistory();

  const [reconciliations, setReconciliations] = useState([]);
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [totalResults, setTotalResults] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [unreconcileTarget, setUnreconcileTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showDeposit, setShowDeposit] = useState(false);

  const fetchAccount = useCallback(async () => {
    try {
      const res = await BankManagementServices.getAllAccounts();
      const found = (res?.accounts || []).find((a) => a._id === accountId);
      if (found) setAccount(found);
    } catch (error) {
      console.error("Error fetching bank account:", error);
    }
  }, [accountId]);

  const fetchReconciliations = useCallback(
    async (page, limit) => {
      try {
        setLoading(true);
        const res = await BankReconciliationServices.getReconciliations(
          accountId,
          { page, limit: limit || recordsPerPage }
        );
        setReconciliations(res?.reconciliations || []);
        setTotalResults(res?.total || 0);
      } catch (error) {
        notifyError(
          error?.response?.data?.message || "Unable to load reconciliations"
        );
      } finally {
        setLoading(false);
      }
    },
    [accountId, recordsPerPage]
  );

  useEffect(() => {
    if (accountId) {
      fetchAccount();
      fetchReconciliations(currentPage, recordsPerPage);
    }
  }, [accountId, currentPage, recordsPerPage, fetchAccount, fetchReconciliations]);

  const currency = account?.currencyType || "";
  const totalPages = Math.ceil(totalResults / recordsPerPage) || 1;

  return (
    <div className="py-6 px-4 sm:px-6 min-h-screen">
      <BackButton onClick={() => history.push("/bank-management")} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title={`${account?.accountName || "Bank Account"} - Reconciliations`}
          showAddButton
          addButtonText="Initiate Reconciliation"
          onAddNew={() =>
            history.push(`/bank-management/${accountId}/reconciliations/new`)
          }
        />
        <button
          type="button"
          onClick={() => setShowDeposit(true)}
          className="flex items-center gap-2 h-[40px] px-4 py-2 mt-2 bg-[#F5F5F5] text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm whitespace-nowrap"
          title="Bank cash held in a clearing account into this account"
        >
          <FiDownload size={16} /> Record Deposit
        </button>
      </div>

      <div className="mt-8">
        <div className="overflow-x-auto">
          <DataTable
            headers={[
              "Reconciled Date",
              "Reconciliation Period",
              "Closing Balance",
              "Status",
              "Attachments",
              "Action",
            ]}
            loading={loading}
            data={reconciliations}
            title=""
            totalRecords={totalResults}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            recordsPerPage={recordsPerPage}
            onRecordsPerPageChange={(value) => {
              setRecordsPerPage(value);
              setCurrentPage(1);
            }}
            emptyMessage="This account has not been reconciled yet. Use Initiate Reconciliation to start."
            renderRow={(row) => (
              <tr
                key={row._id}
                className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer"
                onClick={() =>
                  // A draft opens in the matching workspace; anything closed has
                  // nothing left to match, so it opens read-only.
                  history.push(
                    `/bank-management/${accountId}/reconciliations/${row._id}${
                      row.status === "draft" ? "" : "/view"
                    }`
                  )
                }
              >
                <td className="py-3 px-4">
                  {row.reconciledAt ? formatDate(row.reconciledAt) : "-"}
                </td>
                <td className="py-3 px-4">
                  {formatDate(row.startDate)} to {formatDate(row.endDate)}
                </td>
                <td className="py-3 px-4">
                  {currency} {formatAmount(row.closingBalance)}
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`font-medium ${STATUS_CLASS[row.status] || "text-gray-500"}`}
                  >
                    {STATUS_LABEL[row.status] || row.status}
                  </span>
                  {row.status === "unreconciled" && row.unreconcileReason && (
                    <span
                      className="block text-xs text-gray-400 truncate max-w-[200px]"
                      title={row.unreconcileReason}
                    >
                      {row.unreconcileReason}
                    </span>
                  )}
                </td>
                <td className="py-3 px-4">
                  {row.attachments?.length > 0 ? (
                    <span
                      className="inline-flex items-center gap-1 text-[var(--p-blue)]"
                      title={`${row.attachments.length} attachment(s)`}
                    >
                      <FiPaperclip size={16} />
                      {row.attachments.length}
                    </span>
                  ) : (
                    <span className="text-gray-300">-</span>
                  )}
                </td>
                <td className="py-3 px-4">
                  <div className="flex gap-3" onClick={(e) => e.stopPropagation()}>
                    {/* Available whatever the status — a closed period still needs reading. */}
                    <button
                      onClick={() =>
                        history.push(
                          `/bank-management/${accountId}/reconciliations/${row._id}/view`
                        )
                      }
                      className="text-gray-600 hover:text-[var(--p-blue)]"
                      title="View details"
                    >
                      <AiOutlineEye size={20} />
                    </button>
                    {row.status === "reconciled" && (
                      <>
                        <button
                          onClick={() =>
                            history.push(
                              `/bank-management/${accountId}/reconciliations/${row._id}/status-report`
                            )
                          }
                          className="text-gray-600 hover:text-[var(--p-blue)]"
                          title="Reconciliation status report"
                        >
                          <FiFileText size={20} />
                        </button>
                        <button
                          onClick={() => setUnreconcileTarget(row)}
                          className="text-gray-600 hover:text-red-700"
                          title="Un-reconcile this period"
                        >
                          <FiRotateCcw size={20} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(row)}
                          className="text-red-500 hover:text-red-700"
                          title="Delete this reconciliation"
                        >
                          <AiOutlineDelete size={20} />
                        </button>
                      </>
                    )}
                    {row.status === "draft" && (
                      <>
                        <button
                          onClick={() =>
                            history.push(
                              `/bank-management/${accountId}/reconciliations/${row._id}/edit`
                            )
                          }
                          className="text-[var(--p-blue)] hover:opacity-80"
                          title="Edit period or closing balance"
                        >
                          <AiOutlineEdit size={20} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(row)}
                          className="text-red-500 hover:text-red-700"
                          title="Delete draft"
                        >
                          <AiOutlineDelete size={20} />
                        </button>
                      </>
                    )}
                    {row.status === "unreconciled" && (
                      <button
                        onClick={() => setDeleteTarget(row)}
                        className="text-red-500 hover:text-red-700"
                        title="Delete this un-reconciled period"
                      >
                        <AiOutlineDelete size={20} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          />
        </div>
      </div>

      {unreconcileTarget && (
        <UnreconcileModal
          reconciliation={unreconcileTarget}
          onClose={() => setUnreconcileTarget(null)}
          onDone={() => {
            setUnreconcileTarget(null);
            fetchReconciliations(currentPage, recordsPerPage);
          }}
        />
      )}

      {deleteTarget && (
        <DeleteDraftModal
          reconciliation={deleteTarget}
          currency={currency}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setDeleteTarget(null);
            fetchReconciliations(currentPage, recordsPerPage);
          }}
        />
      )}

      {showDeposit && account && (
        <RecordDepositModal
          business={account.business}
          toAccount={accountId}
          currency={currency}
          onClose={() => setShowDeposit(false)}
          onDone={() => {
            setShowDeposit(false);
            fetchReconciliations(currentPage, recordsPerPage);
          }}
        />
      )}
    </div>
  );
};

export default BankReconciliations;
