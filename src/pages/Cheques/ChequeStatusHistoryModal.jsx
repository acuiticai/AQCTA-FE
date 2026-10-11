import React, { useEffect, useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { FiClock, FiUser } from "react-icons/fi";
import { CustomModal, Loader } from "@/page-layouts";
import ChequeNumberLink from "@/components/cheques/ChequeNumberLink";
import { formatDate } from "@/components/formatAmount";
import { notifyError } from "@/utils/toast";
import { makeChequeT, translateChequeStatus } from "@/utils/chequeI18n";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const STATUS_COLORS = {
  Draft: "bg-slate-100 text-slate-800 border-slate-200",
  Issued: "bg-blue-50 text-blue-900 border-blue-200",
  "Due Soon": "bg-amber-50 text-amber-900 border-amber-200",
  Cleared: "bg-emerald-50 text-emerald-900 border-emerald-200",
  Bounced: "bg-red-50 text-red-900 border-red-200",
  Cancelled: "bg-gray-100 text-gray-800 border-gray-200",
  Replaced: "bg-violet-50 text-violet-900 border-violet-200",
};

function statusBadgeClass(s) {
  return STATUS_COLORS[s] || "bg-gray-100 text-gray-800 border-gray-200";
}

const ChequeStatusHistoryModal = ({
  open,
  onClose,
  cheque,
  adminToken,
  checkTokenExpired,
}) => {
  const { t } = useTranslation();
  const cq = makeChequeT(t);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [chequeNumber, setChequeNumber] = useState("");
  const [currentStatus, setCurrentStatus] = useState("");

  useEffect(() => {
    if (!open || !cheque?._id || !adminToken) return;

    const fetchHistory = async () => {
      setLoading(true);
      try {
        const res = await axios.get(
          `${Base_URL}/cheques/${cheque._id}/status-history`,
          {
            headers: {
              "Content-Type": "application/json",
              authorization: `Bearer ${adminToken}`,
            },
            withCredentials: true,
          },
        );
        if (checkTokenExpired?.(res)) return;
        setHistory(res.data?.data || []);
        setChequeNumber(res.data?.chequeNumber || cheque.chequeNumber || "");
        setCurrentStatus(res.data?.currentStatus || cheque.status || "");
      } catch (e) {
        notifyError(
          e.response?.data?.error ||
            cq(
              "modals.statusHistory.errors.loadFailed",
              "Failed to load status history",
            ),
        );
        setHistory([]);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [open, cheque?._id, cheque?.chequeNumber, cheque?.status, adminToken, checkTokenExpired]);

  const title = chequeNumber ? (
    <span className="inline-flex flex-wrap items-center gap-1">
      {cq("modals.statusHistory.title", "Status history")} —
      <ChequeNumberLink chequeId={cheque?._id} chequeNumber={chequeNumber} />
    </span>
  ) : (
    cq("modals.statusHistory.title", "Status history")
  );

  return (
    <CustomModal
      open={open}
      onClose={onClose}
      title={title}
      width="560px"
      showActions
      actions={[
        {
          label: cq("modals.statusHistory.close", "Close"),
          primary: true,
          onClick: onClose,
        },
      ]}
    >
      <div className="space-y-4">
        {currentStatus && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {cq("modals.statusHistory.currentStatus", "Current status:")}{" "}
            <span
              className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${statusBadgeClass(currentStatus)}`}
            >
              {translateChequeStatus(t, currentStatus)}
            </span>
          </p>
        )}

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader color="var(--p-blue)" />
          </div>
        ) : history.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center">
            {cq(
              "modals.statusHistory.empty",
              "No status changes recorded yet.",
            )}
          </p>
        ) : (
          <ul className="space-y-0 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden divide-y divide-gray-100 dark:divide-gray-700">
            {history.map((entry) => (
              <li
                key={entry._id || `${entry.changedAt}-${entry.newStatus}`}
                className="px-4 py-3 bg-white dark:bg-gray-900"
              >
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  {entry.previousStatus ? (
                    <>
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${statusBadgeClass(entry.previousStatus)}`}
                      >
                        {translateChequeStatus(t, entry.previousStatus)}
                      </span>
                      <span className="text-gray-400 text-xs">→</span>
                    </>
                  ) : null}
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${statusBadgeClass(entry.newStatus)}`}
                  >
                    {translateChequeStatus(t, entry.newStatus)}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                  <span className="inline-flex items-center gap-1">
                    <FiClock className="w-3.5 h-3.5" />
                    {formatDate(entry.changedAt, false, true) || "—"}
                  </span>
                  {(entry.changedByName || entry.changedBy) && (
                    <span className="inline-flex items-center gap-1">
                      <FiUser className="w-3.5 h-3.5" />
                      {entry.changedByName ||
                        cq("modals.statusHistory.userFallback", "User")}
                    </span>
                  )}
                </div>

                {entry.reason ? (
                  <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                    <span className="font-medium">
                      {cq("modals.statusHistory.reason", "Reason:")}{" "}
                    </span>
                    {entry.reason}
                  </p>
                ) : null}
                {entry.note ? (
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 italic">
                    {entry.note}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </CustomModal>
  );
};

export default ChequeStatusHistoryModal;
