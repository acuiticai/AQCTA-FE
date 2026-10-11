import React, { useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useHistory } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { DataTable, PageHeader, ActionButtons } from "@/page-layouts";
import { notifyError, notifySuccess } from "@/utils/toast";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";
import useCheckTokenExpired from "@/hooks/useCheckTokenExpired";
import { AdminContext } from "@/context/AdminContext";
import { Building, FileText } from "lucide-react";
import { formatAmount, formatDate } from "@/components/formatAmount";
import ChequeNumberLink from "@/components/cheques/ChequeNumberLink";
import ChequeDashboardQuickInfo from "@/components/cheques/ChequeDashboardQuickInfo";
import ChequeStatusModal, {
  issueDateAllowsBankOutcome,
} from "./ChequeStatusModal";
import ChequeReplaceModal from "./ChequeReplaceModal";
import ChequeStatusHistoryModal from "./ChequeStatusHistoryModal";
import { downloadChequePaymentVoucherPdf } from "@/utils/downloadChequePaymentVoucherPdf";
import { makeChequeT, translateChequeStatus } from "@/utils/chequeI18n";
import { isSingleAssignedBusiness } from "@/utils/sessionAssignedBusinesses";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const OUTSTANDING_STATUSES = new Set(["Draft", "Issued", "Due Soon"]);
const TERMINAL_STATUSES = new Set([
  "Cleared",
  "Bounced",
  "Cancelled",
  "Replaced",
]);

function normalizeChequeStatus(status) {
  return status === "Pending" ? "Draft" : status || "";
}

const ChequeListScreen = () => {
  const { t } = useTranslation();
  const cq = makeChequeT(t);
  const checkTokenExpired = useCheckTokenExpired();
  const history = useHistory();
  const { state } = useContext(AdminContext);
  const adminInfoFromContext = state?.adminInfo;
  const adminInfoFromStorage =
    typeof localStorage !== "undefined" && localStorage.getItem("adminInfo")
      ? JSON.parse(localStorage.getItem("adminInfo"))
      : null;
  const adminInfo = adminInfoFromContext || adminInfoFromStorage;

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [businessFilter, setBusinessFilter] = useState("");
  const [businesses, setBusinesses] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [chequeForStatus, setChequeForStatus] = useState(null);
  const [statusModalPreset, setStatusModalPreset] = useState(null);
  const [replaceModalOpen, setReplaceModalOpen] = useState(false);
  const [chequeForReplace, setChequeForReplace] = useState(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [chequeForHistory, setChequeForHistory] = useState(null);

  const businessIds = useMemo(() => businesses.map((b) => b._id), [businesses]);

  const STATUS_OPTIONS = useMemo(
    () => [
      { value: "all", label: cq("statuses.all", "All statuses") },
      { value: "Draft", label: cq("statuses.draft", "Draft") },
      { value: "Issued", label: cq("statuses.issued", "Issued") },
      { value: "Due Soon", label: cq("statuses.dueSoon", "Due Soon") },
      { value: "Cleared", label: cq("statuses.cleared", "Cleared") },
      { value: "Bounced", label: cq("statuses.bounced", "Bounced") },
      { value: "Cancelled", label: cq("statuses.cancelled", "Cancelled") },
      { value: "Replaced", label: cq("statuses.replaced", "Replaced") },
      {
        value: "Pending",
        label: cq("statuses.pendingLegacy", "Pending (legacy)"),
      },
    ],
    [cq, t],
  );

  const headers = useMemo(
    () => [
      cq("list.headers.chequeNumber", "Cheque #"),
      cq("list.headers.vendor", "Vendor"),
      cq("list.headers.bank", "Bank"),
      cq("list.headers.amount", "Amount"),
      cq("list.headers.status", "Status"),
      cq("list.headers.reminder", "Reminder"),
      cq("list.headers.issueDate", "Issue date"),
      cq("list.headers.dueDate", "Due date"),
      cq("list.headers.actions", "Actions"),
    ],
    [cq, t],
  );

  useEffect(() => {
    const fetchBusinesses = async () => {
      if (!adminInfo?.id) return;
      try {
        const response = await axios.get(
          `${Base_URL}/admin/assigned/${adminInfo.id}`,
          {
            headers: {
              "Content-Type": "application/json",
              authorization: `Bearer ${adminInfo.token}`,
            },
          },
        );
        const list = response.data?.businesses || [];
        setBusinesses(list);
        if (list.length === 1) setBusinessFilter(list[0]._id);
      } catch (e) {
        console.error(e);
      }
    };
    fetchBusinesses();
  }, [adminInfo?.id, adminInfo?.token]);

  const fetchList = async () => {
    if (!adminInfo?.token) {
      setLoading(false);
      return;
    }
    if (businesses.length === 0) {
      setLoading(false);
      setRows([]);
      setTotal(0);
      return;
    }
    try {
      setLoading(true);
      const params = {
        page: currentPage,
        limit: recordsPerPage,
        status: statusFilter !== "all" ? statusFilter : undefined,
        search: searchTerm || undefined,
      };
      if (businessFilter) {
        params.business_id = businessFilter;
      } else {
        params.business_ids = businesses.map((b) => b._id).join(",");
      }
      const response = await axios.get(`${Base_URL}/cheques`, {
        params,
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${adminInfo.token}`,
        },
        withCredentials: true,
      });
      if (checkTokenExpired(response)) return;
      setRows(response.data?.data || []);
      setTotal(response.data?.total || 0);
      setTotalPages(response.data?.pages || 1);
    } catch (e) {
      console.error(e);
      notifyError(
        e.response?.data?.error ||
          cq("list.errors.loadFailed", "Failed to load cheques"),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!adminInfo?.token || businesses.length === 0) return;
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    businessFilter,
    adminInfo?.token,
    currentPage,
    statusFilter,
    recordsPerPage,
    businesses.length,
  ]);

  useEffect(() => {
    if (!adminInfo?.token) return;
    const timer = setTimeout(() => {
      fetchList();
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  const formatAmountWithCurrency = (row) => {
    if (row.amount == null || row.amount === "") return "—";
    const n = parseFloat(String(row.amount).replace(/,/g, ""));
    if (!Number.isFinite(n)) return "—";
    const amt = formatAmount(n);
    return row.currency ? `${amt} ${row.currency}` : amt;
  };

  const startOfDayMs = (d) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x.getTime();
  };

  const issueDateCellClass =
    "text-sm font-medium text-sky-700 dark:text-sky-300";

  const dueDateCellClass = (row) => {
    const status = normalizeChequeStatus(row.status);
    if (["Cleared", "Cancelled", "Bounced", "Replaced"].includes(status)) {
      return "text-sm text-slate-500 dark:text-slate-400";
    }
    if (!row.dueDate) return "text-sm text-slate-400";
    const today = startOfDayMs(new Date());
    const due = startOfDayMs(row.dueDate);
    if (due < today) {
      return "text-sm font-semibold text-red-600 dark:text-red-400";
    }
    if (due === today) {
      return "text-sm font-semibold text-amber-700 dark:text-amber-300";
    }
    const soonEnd = today + 7 * 24 * 60 * 60 * 1000;
    if (due <= soonEnd) {
      return "text-sm font-medium text-amber-600 dark:text-amber-400";
    }
    return "text-sm font-medium text-violet-700 dark:text-violet-300";
  };

  const statusBadge = (s) => {
    const map = {
      Draft: "bg-slate-100 text-slate-800",
      Issued: "bg-blue-100 text-blue-900",
      "Due Soon": "bg-amber-100 text-amber-900",
      Pending: "bg-slate-100 text-slate-700",
      Cleared: "bg-emerald-100 text-emerald-900",
      Bounced: "bg-red-100 text-red-900",
      Cancelled: "bg-gray-200 text-gray-800",
      Replaced: "bg-violet-100 text-violet-900",
    };
    const cls = map[s] || "bg-gray-100 text-gray-800";
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${cls}`}>
        {s ? translateChequeStatus(t, s) : "-"}
      </span>
    );
  };

  const openStatusModal = (row, presetStatus = null) => {
    setChequeForStatus(row);
    setStatusModalPreset(presetStatus);
    setStatusModalOpen(true);
  };

  const closeStatusModal = () => {
    setStatusModalOpen(false);
    setChequeForStatus(null);
    setStatusModalPreset(null);
  };

  const handlePrintVoucher = async (row) => {
    try {
      await downloadChequePaymentVoucherPdf(row, { token: adminInfo?.token });
    } catch (e) {
      console.error(e);
      notifyError(
        cq("list.errors.voucherPdfFailed", "Could not generate voucher PDF"),
      );
    }
  };

  const getRowActionItems = (row) => {
    const status = normalizeChequeStatus(row.status);
    const isOutstanding = OUTSTANDING_STATUSES.has(status);
    const isTerminal = TERMINAL_STATUSES.has(status);
    const bankOutcomeAllowed = issueDateAllowsBankOutcome(row.issueDate);

    const items = [
      {
        action: ACTION_BUTTON_TYPES.VIEW,
        title: cq("list.actions.view", "View"),
        onClick: () => history.push(`/Cheques/${row._id}`),
      },
    ];

    if (!isTerminal) {
      items.push({
        action: ACTION_BUTTON_TYPES.EDIT,
        title: cq("list.actions.edit", "Edit"),
        onClick: () => history.push(`/Cheques/${row._id}/edit`),
      });
      items.push({
        action: ACTION_BUTTON_TYPES.CHANGE_STATUS,
        title: cq("list.actions.editStatus", "Edit status"),
        onClick: () => openStatusModal(row, null),
      });
    }

    if (isOutstanding && bankOutcomeAllowed) {
      items.push({
        action: ACTION_BUTTON_TYPES.APPROVE,
        title: cq("list.actions.markAsCleared", "Mark as Cleared"),
        onClick: () => openStatusModal(row, "Cleared"),
      });
    }

    if (isOutstanding && bankOutcomeAllowed) {
      items.push({
        action: ACTION_BUTTON_TYPES.REJECT,
        title: cq("list.actions.markAsBounced", "Mark as Bounced"),
        onClick: () => openStatusModal(row, "Bounced"),
      });
    }

    if (isOutstanding) {
      items.push({
        action: ACTION_BUTTON_TYPES.CHANGE_STATUS,
        title: cq("list.actions.cancel", "Cancel"),
        onClick: () => openStatusModal(row, "Cancelled"),
      });
    }

    if (isOutstanding) {
      items.push({
        action: ACTION_BUTTON_TYPES.DUPLICATE,
        title: cq("list.actions.replace", "Replace"),
        onClick: () => {
          setChequeForReplace(row);
          setReplaceModalOpen(true);
        },
      });
    }

    items.push({
      action: ACTION_BUTTON_TYPES.HISTORY,
      title: cq("list.actions.statusHistory", "Status history"),
      onClick: () => {
        setChequeForHistory(row);
        setHistoryModalOpen(true);
      },
    });

    items.push({
      action: ACTION_BUTTON_TYPES.VIEW_PDF,
      title: cq("list.actions.printVoucher", "Print Voucher"),
      onClick: () => handlePrintVoucher(row),
    });

    return items;
  };

  const clearAllFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setBusinessFilter(businesses.length === 1 ? businesses[0]._id : "");
    setCurrentPage(1);
  };

  const filters = [
    {
      isClearButton: true,
      buttonProps: {
        onClick: clearAllFilters,
      },
    },
    ...(!isSingleAssignedBusiness()
      ? [
          {
            label: cq("fields.business", "Business"),
            value: businessFilter,
            onChange: (value) => {
              setBusinessFilter(value);
              setCurrentPage(1);
            },
            options: [
              ...(businesses.length > 1
                ? [
                    {
                      value: "",
                      label: cq("list.allBusinesses", "All businesses"),
                    },
                  ]
                : []),
              ...businesses.map((b) => ({ value: b._id, label: b.name })),
            ],
            placeholder:
              businesses.length > 1
                ? cq("list.allBusinesses", "All businesses")
                : cq("fields.business", "Business"),
            icon: Building,
          },
        ]
      : []),
    {
      label: cq("fields.status", "Status"),
      value: statusFilter,
      onChange: (value) => {
        setStatusFilter(value);
        setCurrentPage(1);
      },
      options: STATUS_OPTIONS,
      placeholder: cq("fields.status", "Status"),
      icon: FileText,
    },
  ];

  return (
    <div className="p-6 min-h-screen bg-white dark:bg-gray-900">
      <PageHeader
        variant="large"
        title={cq("list.title", "Cheque Management")}
        description={cq(
          "list.description",
          "Manage and track all cheques across businesses",
        )}
        showAddButton
        onAddNew={() => history.push("/Cheques/new")}
        addButtonText={cq("list.newCheque", "New cheque")}
      />

      <ChequeDashboardQuickInfo
        token={adminInfo?.token}
        businessFilter={businessFilter}
        businessIds={businessIds}
        hideViewChequesLink
      />

      <DataTable
        onSearch={(v) => {
          setSearchTerm(v);
          setCurrentPage(1);
        }}
        searchValue={searchTerm}
        searchPlaceholder={cq(
          "list.searchPlaceholder",
          "Search by cheque #, invoice, purpose…",
        )}
        filters={filters}
        headers={headers}
        headersToHide={[]}
        data={rows}
        totalRecords={total}
        loading={loading}
        currentPage={currentPage}
        totalPages={totalPages}
        recordsPerPage={recordsPerPage}
        onPageChange={setCurrentPage}
        onRecordsPerPageChange={(n) => {
          setRecordsPerPage(n);
          setCurrentPage(1);
        }}
        colWidths={{
          [cq("list.headers.chequeNumber", "Cheque #")]: "132px",
        }}
        renderRow={(row) => (
          <tr key={row._id} className="border-b dark:border-gray-700">
            <td
              className="py-2 px-4 font-medium align-top w-[132px] max-w-[132px] min-w-[132px] whitespace-normal break-all leading-snug"
              style={{
                whiteSpace: "normal",
                wordBreak: "break-all",
                overflowWrap: "anywhere",
                verticalAlign: "top",
              }}
            >
              <ChequeNumberLink
                chequeId={row._id}
                chequeNumber={row.chequeNumber}
                fallback="-"
                wrap
              />
            </td>
            <td className="py-2 px-4 align-top min-w-[100px]">
              {row.vendorDisplay || "-"}
            </td>
            <td className="py-2 px-4 text-sm text-gray-700 dark:text-gray-300 max-w-[180px] truncate">
              {row.bankAccountLabel || "—"}
            </td>
            <td className="py-2 px-4 text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap tabular-nums">
              {formatAmountWithCurrency(row)}
            </td>
            <td className="py-2 px-4">{statusBadge(row.status)}</td>
            <td className="py-2 px-4 text-xs text-gray-600 dark:text-gray-400">
              {row.reminderStatus || "—"}
            </td>
            <td className={`py-2 px-4 align-top ${issueDateCellClass}`}>
              {formatDate(row.issueDate) || "—"}
            </td>
            <td className={`py-2 px-4 align-top ${dueDateCellClass(row)}`}>
              {formatDate(row.dueDate) || "—"}
            </td>
            <td
              className="py-2 px-4 overflow-visible"
              style={{ width: "fit-content", minWidth: "5.5rem" }}
            >
              <ActionButtons
                maxVisibleActions={2}
                isCell
                items={getRowActionItems(row)}
              />
            </td>
          </tr>
        )}
      />

      <ChequeStatusModal
        open={statusModalOpen}
        onClose={closeStatusModal}
        cheque={chequeForStatus}
        presetStatus={statusModalPreset}
        adminToken={adminInfo?.token}
        checkTokenExpired={checkTokenExpired}
        onSuccess={fetchList}
      />

      <ChequeReplaceModal
        open={replaceModalOpen}
        onClose={() => {
          setReplaceModalOpen(false);
          setChequeForReplace(null);
        }}
        cheque={chequeForReplace}
        onConfirm={(reason) => {
          if (!chequeForReplace?._id) return;
          history.push({
            pathname: "/Cheques/new",
            search: `?replaces=${chequeForReplace._id}`,
            state: { replaceReason: reason },
          });
        }}
      />

      <ChequeStatusHistoryModal
        open={historyModalOpen}
        onClose={() => {
          setHistoryModalOpen(false);
          setChequeForHistory(null);
        }}
        cheque={chequeForHistory}
        adminToken={adminInfo?.token}
        checkTokenExpired={checkTokenExpired}
      />
    </div>
  );
};

export default ChequeListScreen;
