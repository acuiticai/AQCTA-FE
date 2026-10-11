import { useTranslation } from "react-i18next";
import { customerInvoiceText as ciText } from "@/utils/customerInvoiceI18n";
import { useState, useEffect, useContext, useMemo, useCallback } from "react";
import { useHistory } from "react-router-dom";
import axios from "axios";
import {
  Eye,
  FileText,
  FileWarning,
  Send,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RotateCcw,
  Download,
  Copy,
  X,
  RefreshCw,
  Building,
  User,
  Calendar,
} from "lucide-react";
import { AdminContext } from "@/context/AdminContext";
import { formatDate, formatAmount, formatCurrencyAmount } from "@/components/formatAmount";
import { notifyError, notifySuccess } from "@/utils/toast";
import { useRouteModulePermissions } from "@/utils/permissionUtils";
import EInvoiceServices from "@/services/EInvoiceServices";
import { redactPasswordsForDisplay } from "@/utils/sanitizeEInvoiceApiDisplay";
import { downloadFlexaCreditDebitEInvoicePdf } from "@/utils/eInvoiceCustomerInvoicePdf";
import { formatLhdnValidationErrorsNotifyBody } from "@/utils/formatLhdnValidationErrors";
import { DataTable } from "@/page-layouts/index";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const ENDPOINTS = {
  credit: "/credit-notes",
  debit: "/debit-notes",
  refund: "/credit-notes",
};

const PATHS = {
  credit: (id) => `/view-credit-note/${id}`,
  debit: (id) => `/view-debit-note/${id}`,
  refund: (id) => `/view-credit-note/${id}`,
};

const LHDN_BADGE_STYLES = {
  Pending: { icon: Clock, cls: "bg-gray-100 text-gray-700 border-gray-300" },
  Submitted: { icon: Send, cls: "bg-blue-50 text-blue-700 border-blue-300" },
  Valid: {
    icon: CheckCircle2,
    cls: "bg-green-50 text-green-700 border-green-300",
  },
  Invalid: {
    icon: FileWarning,
    cls: "bg-amber-50 text-amber-700 border-amber-300",
  },
  Rejected: {
    icon: AlertTriangle,
    cls: "bg-red-50 text-red-700 border-red-300",
  },
  Cancelled: {
    icon: AlertTriangle,
    cls: "bg-red-50 text-red-700 border-red-300",
  },
};

function LhdnStatusBadge({ status }) {
  const resolved = status || "Pending";
  const style = LHDN_BADGE_STYLES[resolved] || LHDN_BADGE_STYLES.Pending;
  const Icon = style.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${style.cls}`}
    >
      <Icon size={12} />
      {ciText(resolved)}
    </span>
  );
}

function lhdnPatchFromApiData(d) {
  const patch = {};
  if (!d || typeof d !== "object") return patch;
  if (d.lhdn_status != null) patch.lhdn_status = d.lhdn_status;
  if (d.uuid != null) patch.uuid = d.uuid;
  if (d.submissionUid != null) patch.submissionUid = d.submissionUid;
  if (d.longID != null) patch.longID = d.longID;
  if (d.invoiceLink != null) patch.invoiceLink = d.invoiceLink;
  if (d.reason != null) patch.lhdnReason = d.reason;
  return patch;
}

/** Same case / label rules as the customer invoice list status filter. */
function noteMatchesInvoiceStatusFilter(noteStatusRaw, selectedFilter) {
  if (!selectedFilter || selectedFilter === "All") return true;
  if (!noteStatusRaw) return false;
  const normalizedFilterStatus = selectedFilter.toLowerCase();
  const invoiceStatus = noteStatusRaw.toLowerCase().trim();

  if (
    normalizedFilterStatus === "request sent" ||
    normalizedFilterStatus === "sent"
  ) {
    return invoiceStatus === "request sent" || invoiceStatus === "sent";
  }
  if (normalizedFilterStatus === "partially paid") {
    return invoiceStatus === "partially paid";
  }
  if (normalizedFilterStatus === "paid") {
    return invoiceStatus === "paid";
  }
  return invoiceStatus === normalizedFilterStatus;
}

function sameCalendarDayAsDateCreated(createdAt, dateCreatedFilter) {
  if (!dateCreatedFilter) return true;
  const start = new Date(dateCreatedFilter);
  if (Number.isNaN(start.getTime())) return true;
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  const t = new Date(createdAt);
  if (Number.isNaN(t.getTime())) return false;
  return t >= start && t < end;
}

function rowInDateRange(r, dateRangeStart, dateRangeEnd) {
  if (!dateRangeStart && !dateRangeEnd) return true;
  const rowDate = new Date(
    r.creditNoteDate || r.debitNoteDate || r.createdAt,
  );
  if (Number.isNaN(rowDate.getTime())) return false;
  if (dateRangeStart) {
    const from = new Date(`${dateRangeStart}T00:00:00`);
    if (rowDate < from) return false;
  }
  if (dateRangeEnd) {
    const to = new Date(`${dateRangeEnd}T23:59:59`);
    if (rowDate > to) return false;
  }
  return true;
}

/**
 * Customer-scoped list for the E-Invoice hub tab: LHDN submit / refresh / retry,
 * view details, and PDF download (when Valid), aligned with customer invoices.
 *
 * @param {"credit"|"debit"|"refund"} props.kind
 * @param {"apply"|"all"} [props.customerCreditNoteTypeMode] — when `kind` is `credit`,
 *   `apply` loads apply_to_invoice only (default); `all` loads all customer credit note types.
 * @param {boolean} [props.showEInvoiceHubLhdn] — business has e-invoice enabled
 * @param {(row: object) => boolean} [props.rowShowsLhdn] — per-row LHDN visibility
 * @param {boolean} [props.canViewNote] — PCI document view (Eye)
 * @param {boolean} [props.canSubmitLhdn] — submit / retry to LHDN
 * @param {object[]} [props.filters] — same `filters` array as the invoice `DataTable`
 * @param {string} [props.searchTerm] — shared search from parent
 * @param {function} [props.onSearch] — updates parent search
 * @param {number} [props.entriesPerPage]
 * @param {function} [props.onRecordsPerPageChange]
 */
export default function CustomerEInvoiceCreditDebitList({
  kind,
  customerCreditNoteTypeMode = "apply",
  listKey = 0,
  selectedBusinessId,
  assignedBusinessIds = [],
  showEInvoiceHubLhdn = false,
  rowShowsLhdn: rowShowsLhdnProp,
  canViewNote: canViewNoteProp,
  canSubmitLhdn: canSubmitLhdnProp,
  filters = [],
  searchTerm = "",
  onSearch,
  entriesPerPage = 10,
  onRecordsPerPageChange,
  selectedCustomerFilter = "",
  selectedInvoiceStatusFilter = "All",
  selectedLhdnStatusFilter = "All",
  selectedDateCreatedFilter = "",
  dateRangeStart = "",
  dateRangeEnd = "",
}) {
  useTranslation();
  useTranslation();
  useTranslation();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const history = useHistory();
  const routePerms = useRouteModulePermissions();
  const { canView, canViewDetails, canUpdate } = routePerms;
  const canViewNote =
    canViewNoteProp !== undefined ? canViewNoteProp : canView || canViewDetails;
  const canSubmitLhdn =
    canSubmitLhdnProp !== undefined ? canSubmitLhdnProp : canUpdate;

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [eInvoiceBusyId, setEInvoiceBusyId] = useState(null);
  const [eInvoiceDownloadId, setEInvoiceDownloadId] = useState(null);
  const [lhdnResponseModal, setLhdnResponseModal] = useState(null);
  const [lhdnActionConfirm, setLhdnActionConfirm] = useState(null);
  const [notesCurrentPage, setNotesCurrentPage] = useState(1);

  const endpoint = ENDPOINTS[kind] || "/credit-notes";
  const viewPath = PATHS[kind] || PATHS.credit;
  const isCreditBacked = kind !== "debit";

  const rowShowsLhdn = rowShowsLhdnProp || (() => showEInvoiceHubLhdn);

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo?.token}`,
    }),
    [adminInfo?.token],
  );

  const load = useCallback(async () => {
    if (!adminInfo?.token) return;
    setLoading(true);
    try {
      const params = { page: 1, limit: 500, entityType: "customer" };
      if (kind === "credit") {
        if (customerCreditNoteTypeMode === "all") {
          /* omit creditNoteType — all customer credit / refund types */
        } else {
          params.creditNoteType = "apply_to_invoice";
        }
      }
      if (kind === "refund") params.creditNoteType = "refund_to_client";
      if (selectedBusinessId) {
        params.business = selectedBusinessId;
      } else if (assignedBusinessIds.length > 0) {
        params.businessIds = assignedBusinessIds.join(",");
      } else {
        setRows([]);
        return;
      }
      const { data } = await axios.get(`${Base_URL}${endpoint}`, {
        params,
        headers,
      });
      const list = Array.isArray(data?.data) ? data.data : [];
      const visibleBusinessIds = new Set(
        (selectedBusinessId ? [selectedBusinessId] : assignedBusinessIds).map(
          (id) => String(id),
        ),
      );
      const scopedRows = list.filter((row) => {
        const bid = row?.business?._id || row?.business;
        if (!bid) return false;
        return visibleBusinessIds.has(String(bid));
      });
      setRows(scopedRows);
    } catch (e) {
      console.error(e);
      notifyError(`Could not load ${kind} notes`);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [
    adminInfo?.token,
    endpoint,
    kind,
    customerCreditNoteTypeMode,
    headers,
    selectedBusinessId,
    assignedBusinessIds,
  ]);

  useEffect(() => {
    load();
  }, [load, listKey]);

  useEffect(() => {
    setNotesCurrentPage(1);
  }, [
    searchTerm,
    selectedCustomerFilter,
    selectedInvoiceStatusFilter,
    selectedLhdnStatusFilter,
    selectedDateCreatedFilter,
    dateRangeStart,
    dateRangeEnd,
    kind,
    listKey,
    selectedBusinessId,
  ]);

  const patchRow = (id, patch) => {
    setRows((prev) =>
      prev.map((r) => (r._id === id ? { ...r, ...patch } : r)),
    );
  };

  const docNo = (r) => r.creditNoteNumber || r.debitNoteNumber || "";

  const lhdnSubmitValidationIntro =
    kind === "debit"
      ? "Couldn’t submit this debit note to MyInvois (LHDN)"
      : kind === "refund"
        ? "Couldn’t submit this refund note to MyInvois (LHDN)"
        : "Couldn’t submit this credit note to MyInvois (LHDN)";
  const lhdnRetryValidationIntro =
    kind === "debit"
      ? "Couldn’t resubmit this debit note to MyInvois (LHDN)"
      : kind === "refund"
        ? "Couldn’t resubmit this refund note to MyInvois (LHDN)"
        : "Couldn’t resubmit this credit note to MyInvois (LHDN)";

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const customerId = r.customer?._id || r.customer;
      if (
        selectedCustomerFilter &&
        String(customerId || "") !== String(selectedCustomerFilter)
      ) {
        return false;
      }
      if (
        !noteMatchesInvoiceStatusFilter(r?.status, selectedInvoiceStatusFilter)
      ) {
        return false;
      }
      const rowLhdn = (r?.lhdn_status || "Pending").toString();
      if (
        selectedLhdnStatusFilter &&
        selectedLhdnStatusFilter !== "All"
      ) {
        if (
          rowLhdn.toLowerCase() !==
          String(selectedLhdnStatusFilter).toLowerCase()
        ) {
          return false;
        }
      }
      if (
        !sameCalendarDayAsDateCreated(
          r.createdAt,
          selectedDateCreatedFilter,
        )
      ) {
        return false;
      }
      if (!rowInDateRange(r, dateRangeStart, dateRangeEnd)) {
        return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        const number = (r.creditNoteNumber || r.debitNoteNumber || "")
          .toString()
          .toLowerCase();
        const type = (r.creditNoteType || r.entityType || "")
          .toString()
          .toLowerCase();
        const status = (r.status || "").toString().toLowerCase();
        const cust = (
          r.customer?.basicInformation?.customerDisplayName ||
          r.customer?.basicInformation?.companyName ||
          ""
        )
          .toString()
          .toLowerCase();
        const bus = (r.business?.name || "").toString().toLowerCase();
        if (
          !number.includes(q) &&
          !type.includes(q) &&
          !status.includes(q) &&
          !cust.includes(q) &&
          !bus.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [
    rows,
    searchTerm,
    selectedCustomerFilter,
    selectedInvoiceStatusFilter,
    selectedLhdnStatusFilter,
    selectedDateCreatedFilter,
    dateRangeStart,
    dateRangeEnd,
  ]);

  const totalFiltered = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / entriesPerPage));
  const safePage = Math.min(notesCurrentPage, totalPages);
  const paginatedData = useMemo(() => {
    const page = Math.min(notesCurrentPage, totalPages);
    const start = (page - 1) * entriesPerPage;
    return filteredRows.slice(start, start + entriesPerPage);
  }, [filteredRows, notesCurrentPage, entriesPerPage, totalPages]);

  useEffect(() => {
    if (notesCurrentPage !== safePage) {
      setNotesCurrentPage(safePage);
    }
  }, [notesCurrentPage, safePage]);

  const noteLabelLower =
    kind === "credit"
      ? "credit note"
      : kind === "refund"
        ? "refund note"
        : "debit note";
  const noteLabelTitle =
    kind === "credit"
      ? "Credit note"
      : kind === "refund"
        ? "Refund note"
        : "Debit note";

  const docHeaderLabel =
    kind === "credit"
      ? "Credit note no"
      : kind === "refund"
        ? "Refund note no"
        : "Debit note no";

  const searchPlaceholder =
    kind === "credit"
      ? "Search credit notes..."
      : kind === "refund"
        ? "Search refund notes..."
        : "Search debit notes...";

  const tableHeaders = useMemo(() => {
    const h = [
      docHeaderLabel,
      "Customer",
      "Business",
      "Status",
      "Type",
    ];
    if (showEInvoiceHubLhdn) h.push("LHDN");
    h.push("Dates", "Amount", "Actions");
    return h;
  }, [docHeaderLabel, showEInvoiceHubLhdn]);

  /** Base column widths; wide tables scroll inside the table container only. */
  const noteTableColWidths = useMemo(() => {
    const docKey = docHeaderLabel;
    if (showEInvoiceHubLhdn) {
      return {
        [docKey]: "180px",
        Customer: "240px",
        Business: "240px",
        Status: "140px",
        Type: "160px",
        LHDN: "140px",
        Dates: "180px",
        Amount: "190px",
        Actions: "220px",
      };
    }
    return {
      [docKey]: "180px",
      Customer: "240px",
      Business: "240px",
      Status: "140px",
      Type: "160px",
      Dates: "180px",
      Amount: "190px",
      Actions: "220px",
    };
  }, [docHeaderLabel, showEInvoiceHubLhdn]);

  const performSubmitToLhdn = async (row) => {
    if (!row?._id) return;
    try {
      setEInvoiceBusyId(row._id);
      const { data } = isCreditBacked
        ? await EInvoiceServices.submitCreditNote(row._id)
        : await EInvoiceServices.submitDebitNote(row._id);
      notifySuccess(data?.message || ciText("Submitted to LHDN"));
      const patch = lhdnPatchFromApiData(data?.data);
      if (data?.status === true && patch.lhdn_status === "Submitted") {
        patch.lhdnReason = null;
        patch.validationResults = [];
      }
      patchRow(row._id, patch);
      if (!data?.data) load();
    } catch (err) {
      const resp = err?.response?.data;
      if (resp?.validationErrors?.length) {
        notifyError(
          formatLhdnValidationErrorsNotifyBody(
            resp.validationErrors,
            lhdnSubmitValidationIntro,
            { maxLines: 6 },
          ),
        );
      } else {
        notifyError(resp?.message || err.message || ciText("Submission failed"));
      }
    } finally {
      setEInvoiceBusyId(null);
    }
  };

  const handleSubmitToLhdn = (row) => {
    if (!row?._id) return;
    setLhdnActionConfirm({ action: "submit", row });
  };

  const performRetryLhdn = async (row) => {
    if (!row?._id) return;
    try {
      setEInvoiceBusyId(row._id);
      const { data } = isCreditBacked
        ? await EInvoiceServices.retryCreditNote(row._id)
        : await EInvoiceServices.retryDebitNote(row._id);
      notifySuccess(data?.message || ciText("Resubmitted to LHDN"));
      /**
       * Only show the raw LHDN API response modal on non-success — clean
       * retries shouldn't pop a JSON dump over the row. Mirrors customer
       * invoices and the credit/debit notes list hook.
       */
      if (data && typeof data === "object" && data.status !== true) {
        setLhdnResponseModal({
          title: "LHDN — retry",
          docNo: docNo(row),
          body: data,
        });
      }
      const patch = lhdnPatchFromApiData(data?.data);
      if (data?.status === true && patch.lhdn_status === "Submitted") {
        patch.lhdnReason = null;
        patch.validationResults = [];
      }
      patchRow(row._id, patch);
      if (!data?.data) load();
    } catch (err) {
      const resp = err?.response?.data;
      if (resp?.validationErrors?.length) {
        notifyError(
          formatLhdnValidationErrorsNotifyBody(
            resp.validationErrors,
            lhdnRetryValidationIntro,
            { maxLines: 6 },
          ),
        );
      } else {
        notifyError(resp?.message || err.message || ciText("Retry failed"));
      }
    } finally {
      setEInvoiceBusyId(null);
    }
  };

  const handleRetryLhdn = (row) => {
    if (!row?._id) return;
    setLhdnActionConfirm({ action: "retry", row });
  };

  const handleConfirmLhdnAction = async () => {
    const pending = lhdnActionConfirm;
    if (!pending?.row?._id) {
      setLhdnActionConfirm(null);
      return;
    }
    const { action, row } = pending;
    setLhdnActionConfirm(null);
    if (action === "submit") await performSubmitToLhdn(row);
    else if (action === "retry") await performRetryLhdn(row);
  };

  const handleRefreshLhdn = async (row) => {
    if (!row?._id) return;
    try {
      setEInvoiceBusyId(row._id);
      const { data } = isCreditBacked
        ? await EInvoiceServices.getCreditNoteStatus(row._id)
        : await EInvoiceServices.getDebitNoteStatus(row._id);
      notifySuccess(ciText("Status refreshed from LHDN"));
      /** Skip the JSON dump on a clean refresh; the row badge already
       *  reflects the latest LHDN status via `patchRow`. Modal only on a
       *  non-success response (so users can debug). */
      if (data && typeof data === "object" && data.status !== true) {
        setLhdnResponseModal({
          title: "LHDN — status refresh",
          docNo: docNo(row),
          body: data,
        });
      }
      patchRow(row._id, lhdnPatchFromApiData(data?.data));
    } catch (err) {
      notifyError(err?.response?.data?.message || err.message);
    } finally {
      setEInvoiceBusyId(null);
    }
  };

  const handleViewLhdn = (row) => {
    if (!row?._id) return;
    const code = isCreditBacked ? `cn-${row._id}` : `dn-${row._id}`;
    history.push(`/invoices/e-invoice/${encodeURIComponent(code)}`);
  };

  const handleDownloadPdf = async (row) => {
    if ((row.lhdn_status || "").toString() !== "Valid") {
      notifyError(ciText("Only valid LHDN documents can be downloaded as PDF"));
      return;
    }
    if (!row?._id) return;
    setEInvoiceDownloadId(row._id);
    try {
      await downloadFlexaCreditDebitEInvoicePdf(
        row,
        isCreditBacked ? "credit" : "debit",
        {
          getCreditNoteById: (id) =>
            axios.get(`${Base_URL}/credit-notes/${id}`, { headers }),
          getDebitNoteById: (id) =>
            axios.get(`${Base_URL}/debit-notes/${id}`, { headers }),
          getEInvoiceDetails: async (code) => {
            const { data } = await EInvoiceServices.getDetails(code);
            return data;
          },
          getBusinessById: (businessId) =>
            axios.get(`${Base_URL}/business/${businessId}`, { headers }),
          getBusinessLhdnByBusinessId: async (businessId) => {
            if (!businessId) return null;
            try {
              const { data: res } = await axios.get(
                `${Base_URL}/BusinessDetails/get_by_business_id/${businessId}`,
                { headers },
              );
              const d = res?.data;
              if (Array.isArray(d) && d[0]) return d[0];
              return d && typeof d === "object" ? d : null;
            } catch {
              return null;
            }
          },
        },
      );
      notifySuccess(ciText("E-invoice PDF downloaded"));
    } catch (err) {
      notifyError(err?.message || ciText("Failed to download PDF"));
    } finally {
      setEInvoiceDownloadId(null);
    }
  };

  const showLhdnCol = Boolean(showEInvoiceHubLhdn);
  const showActions = canViewNote || showLhdnCol;

  const getCustomerLabel = (r) => {
    if (r.customer?.basicInformation?.customerDisplayName)
      return r.customer.basicInformation.customerDisplayName;
    if (r.customer?.basicInformation?.companyName)
      return r.customer.basicInformation.companyName;
    return "—";
  };

  const onSearchWrapped =
    typeof onSearch === "function"
      ? (val) => {
          onSearch(val);
          setNotesCurrentPage(1);
        }
      : undefined;

  const onRecordsWrapped =
    typeof onRecordsPerPageChange === "function"
      ? (num) => {
          onRecordsPerPageChange(num);
          setNotesCurrentPage(1);
        }
      : undefined;

  return (
    <div className="space-y-4 w-full min-w-0 max-w-full overflow-x-hidden">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 w-full min-w-0 max-w-full overflow-hidden">
        <DataTable
          filters={filters}
          colWidths={noteTableColWidths}
          headersWithoutCellTooltip={["Amount"]}
          containerClassName="rounded-xl p-0 mb-[16px] max-w-full min-w-0"
          isCollapsible={false}
          emptyMessage={`No ${kind === "credit" ? "credit" : kind === "refund" ? "refund" : "debit"} notes match your filters`}
          loading={loading}
          headers={tableHeaders}
          data={paginatedData}
          searchValue={searchTerm}
          onSearch={onSearchWrapped}
          searchPlaceholder={searchPlaceholder}
          currentPage={safePage}
          totalPages={totalPages}
          totalRecords={totalFiltered}
          onPageChange={(page) => setNotesCurrentPage(page)}
          recordsPerPage={entriesPerPage}
          onRecordsPerPageChange={onRecordsWrapped}
          renderRow={(r) => {
            const id = r._id;
            const num = r.creditNoteNumber || r.debitNoteNumber || "—";
            const typ =
              kind === "debit"
                ? r.entityType || "—"
                : r.creditNoteType || r.entityType || "—";
            const dt = r.creditNoteDate || r.debitNoteDate;
            const lhdn = (r.lhdn_status || "Pending").toString();
            const showRowLhdn = showLhdnCol && rowShowsLhdn(r);
            const busy = eInvoiceBusyId === id;
            const downloading = eInvoiceDownloadId === id;
            const canRetry = lhdn === "Rejected" || lhdn === "Invalid";
            const isSubmitted = lhdn === "Submitted";
            const isValid = lhdn === "Valid";
            const canSubmit = lhdn === "Pending" && canSubmitLhdn;

            const cells = [
              <td key="n" className="py-4 px-4">
                <p className="font-semibold text-gray-900">{num}</p>
              </td>,
              <td key="cust" className="py-4 px-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <User size={16} className="text-gray-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 truncate max-w-[200px]">
                      {getCustomerLabel(r)}
                    </p>
                    <p className="text-sm text-gray-500">{ciText("Customer")}</p>
                  </div>
                </div>
              </td>,
              <td key="bus" className="py-4 px-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Building size={16} className="text-gray-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 truncate max-w-[200px]">
                      {r.business?.name || "—"}
                    </p>
                    <p className="text-sm text-gray-500">{ciText("Business")}</p>
                  </div>
                </div>
              </td>,
              <td key="st" className="py-4 px-4">
                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800 border border-gray-200">
                  {r.status || "—"}
                </span>
              </td>,
              <td key="ty" className="py-4 px-4">
                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                  {String(typ).replace(/_/g, " ")}
                </span>
              </td>,
            ];
            if (showLhdnCol) {
              cells.push(
                <td key="lhdn" className="py-4 px-4">
                  {showRowLhdn ? (
                    <LhdnStatusBadge status={r.lhdn_status} />
                  ) : (
                    <span className="text-sm text-gray-400">—</span>
                  )}
                </td>,
              );
            }
            cells.push(
              <td key="dates" className="py-4 px-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-gray-400" />
                    <span className="text-sm text-gray-600">{formatDate(dt)}</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {ciText("Doc date")}
                  </span>
                </div>
              </td>,
              <td key="amt" className="py-4 px-4">
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-900 whitespace-nowrap">
                    {formatCurrencyAmount(r.currency || "MYR", r.total || 0)}
                  </p>
                  <p className="text-xs text-gray-500">{ciText("Total")}</p>
                </div>
              </td>,
              <td key="act" className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                {showActions ? (
                  <div className="flex items-center flex-wrap gap-1 justify-start">
                    {canViewNote && (
                      <button
                        type="button"
                        onClick={() => history.push(viewPath(id))}
                        className="rounded p-1 text-blue-600 hover:bg-gray-50 hover:text-blue-900"
                        title={ciText("View in PCI")}
                      >
                        <Eye className="h-5 w-5" />
                      </button>
                    )}
                    {showRowLhdn && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleViewLhdn(r)}
                          className="rounded p-1 text-[var(--p-blue)] hover:bg-blue-50"
                          title={ciText("View LHDN details")}
                        >
                          <FileText className="h-5 w-5" />
                        </button>
                        {canSubmit && (
                          <button
                            type="button"
                            onClick={() => handleSubmitToLhdn(r)}
                            disabled={busy}
                            className="rounded p-1 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
                            title={ciText("Submit to LHDN")}
                          >
                            <Send className="h-5 w-5" />
                          </button>
                        )}
                        {canRetry && canSubmitLhdn && (
                          <button
                            type="button"
                            onClick={() => handleRetryLhdn(r)}
                            disabled={busy}
                            className="rounded p-1 text-amber-600 hover:bg-transparent hover:text-amber-600 disabled:opacity-50"
                            title={ciText("Retry LHDN")}
                          >
                            <RotateCcw className="h-5 w-5" />
                          </button>
                        )}
                        {isSubmitted && (
                          <button
                            type="button"
                            onClick={() => handleRefreshLhdn(r)}
                            disabled={busy}
                            className="rounded p-1 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                            title={ciText("Refresh LHDN status")}
                          >
                            <RefreshCw className="h-5 w-5" />
                          </button>
                        )}
                        {isValid && (
                          <button
                            type="button"
                            onClick={() => handleDownloadPdf(r)}
                            disabled={downloading}
                            className="rounded p-1 text-indigo-600 hover:bg-indigo-50 disabled:opacity-50"
                            title={ciText("Download e-invoice PDF")}
                          >
                            <Download className="h-5 w-5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  ""
                )}
              </td>,
            );

            return <tr key={id}>{cells}</tr>;
          }}
        />
      </div>

      {lhdnActionConfirm && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 backdrop-blur-[2px] p-4 sm:p-6"
          onClick={() => setLhdnActionConfirm(null)}
          role="presentation"
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col border border-gray-200/90 ring-1 ring-black/[0.06]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="lhdn-note-confirm-title"
          >
            <div
              className="h-1 w-full bg-[var(--p-blue)] shrink-0"
              aria-hidden
            />
            <div className="px-6 pt-5 pb-1">
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--p-blue)] text-white shadow-md shadow-[#0C2E5A]/30">
                  <Send className="h-5 w-5" strokeWidth={2} />
                </span>
                <div className="min-w-0 pt-0.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--p-blue-dark)] mb-1">
                    {ciText("MyInvois · LHDN")}
                  </p>
                  <h3
                    id="lhdn-note-confirm-title"
                    className="text-lg font-semibold text-p-black leading-snug"
                  >
                    {lhdnActionConfirm.action === "retry"
                      ? "Resubmit this document?"
                      : "Submit to LHDN?"}
                  </h3>
                  <p className="text-sm text-p-gray mt-2.5 leading-relaxed">
                    {lhdnActionConfirm.action === "retry" ? (
                      <>
                        {noteLabelTitle}{" "}
                        <span className="font-semibold text-p-black">
                          {docNo(lhdnActionConfirm.row) || "—"}
                        </span>{" "}
                        is{" "}
                        <span className="font-semibold text-p-black">
                          {lhdnActionConfirm.row.lhdn_status || "unknown"}
                        </span>
                        . We will send this{" "}
                        <span className="font-semibold text-p-black">
                          {noteLabelLower}
                        </span>{" "}
                        to LHDN (MyInvois) again.
                      </>
                    ) : (
                      <>
                        Send{" "}
                        <span className="font-semibold text-p-black">
                          {noteLabelLower}
                        </span>{" "}
                        <span className="font-semibold text-p-black">
                          {docNo(lhdnActionConfirm.row) || "—"}
                        </span>{" "}
                        to LHDN (MyInvois).
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 bg-p-gray-light/40 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setLhdnActionConfirm(null)}
                className="w-full sm:w-auto px-4 py-2.5 text-sm font-medium text-p-black bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:ring-offset-2 transition-colors"
              >
                {ciText("Cancel")}
              </button>
              <button
                type="button"
                onClick={handleConfirmLhdnAction}
                className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-[var(--p-blue)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:ring-offset-2 shadow-sm border border-transparent ${
                  lhdnActionConfirm.action === "retry"
                    ? "hover:bg-[var(--p-blue)] hover:border-transparent active:bg-[var(--p-blue)]"
                    : "hover:bg-[#9CBA33] transition-colors"
                }`}
              >
                <Send className="h-4 w-4" strokeWidth={2} />
                {lhdnActionConfirm.action === "retry"
                  ? "Resubmit to LHDN"
                  : "Submit to LHDN"}
              </button>
            </div>
          </div>
        </div>
      )}

      {lhdnResponseModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {ciText("LHDN API response")}
                </h3>
                <p className="text-xs text-gray-700 font-medium mt-0.5">
                  {lhdnResponseModal.title}
                  {lhdnResponseModal.docNo
                    ? ` · ${lhdnResponseModal.docNo}`
                    : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(
                        JSON.stringify(
                          redactPasswordsForDisplay(lhdnResponseModal.body),
                          null,
                          2,
                        ),
                      );
                      notifySuccess(ciText("JSON copied to clipboard"));
                    } catch {
                      notifyError(ciText("Could not copy"));
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <Copy size={16} />
                  {ciText("Copy")}
                </button>
                <button
                  type="button"
                  onClick={() => setLhdnResponseModal(null)}
                  className="p-1.5 text-gray-800 hover:bg-gray-100 rounded-lg"
                  title={ciText("Close")}
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto">
              <pre className="text-xs font-mono bg-gray-50 border border-gray-200 rounded-lg p-3 whitespace-pre-wrap break-words text-gray-800">
                {JSON.stringify(
                  redactPasswordsForDisplay(lhdnResponseModal.body),
                  null,
                  2,
                )}
              </pre>
            </div>
            <div className="px-4 py-3 border-t bg-gray-50 flex justify-end">
              <button
                type="button"
                onClick={() => setLhdnResponseModal(null)}
                className="px-4 py-2 text-sm font-medium text-p-black bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                {ciText("Close")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
