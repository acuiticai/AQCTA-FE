import { useTranslation } from "react-i18next";
import { customerInvoiceText as ciText } from "@/utils/customerInvoiceI18n";
import {
  useEffect,
  useState,
  useContext,
  useMemo,
  useCallback,
  useRef,
} from "react";
import {
  X,
  Calendar,
  ChevronDown,
  FileText,
  DollarSign,
  Clock,
  CheckSquare,
  Square,
  Download,
  FileSpreadsheet,
  FileSpreadsheet as ExcelIcon,
  Send,
  AlertTriangle,
  CheckCircle2,
  FileWarning,
  Copy,
} from "lucide-react";
import EInvoiceServices from "@/services/EInvoiceServices";
import { redactPasswordsForDisplay } from "@/utils/sanitizeEInvoiceApiDisplay";
import { downloadFlexaCustomerInvoiceEInvoicePdf } from "@/utils/eInvoiceCustomerInvoicePdf";
import * as XLSX from "xlsx";
import { useHistory, useLocation } from "react-router-dom";
import axios from "axios";
import {
  SummaryCards,
  DateRangeComponent,
  CustomDatePicker,
  ActionButtons,
} from "@/page-layouts/index";
import { EpcPage } from "@/components/Epc/EpcSurface";
import FilterBar from "@/customer/components/ui/FilterBar";
import { Card, CardHeader } from "@/customer/components/ui/Card";
import PortalDataTable from "@/customer/components/ui/DataTable";
import Pagination from "@/customer/components/ui/Pagination";
import Button from "@/customer/components/ui/Button";
import StatusPill from "@/customer/components/ui/StatusPill";
import { PlusIcon } from "@/customer/components/ui/icons";
import {
  formatDate,
  formatAmount,
  formatDateToYMD,
  formatCurrencyAmount,
} from "@/components/formatAmount";
import { notifyError, notifySuccess } from "@/utils/toast";
import BulkPaymentRecordModal from "@/components/customer-invoices/BulkPaymentModal";
import ProfessionalBulkPaymentModal from "@/components/customer-invoices/ProfessionalBulkPaymentModal";
import CustomerInvoiceServices from "@/services/CustomerInvoiceServices";
import { AdminContext } from "@/context/AdminContext";
import { useRouteModulePermissions } from "@/utils/permissionUtils";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";
import CompletedSvg from "@/assets/img/completed.svg";
import InProgressSvg from "@/assets/img/in-progress.svg";
import DelayedSvg from "@/assets/img/delayed.svg";
import SummarySvg from "@/assets/img/summary.svg";
import DollarSvg from "../../../assets/img/icons/stats-1.png";
import { isEInvoiceEnabledValue } from "@/hooks/useBusinessEInvoiceEnabled";
import ConsolidatedEInvoiceFromInvoicesPanel from "@/pages/Accounts/CustomerInvoice/ConsolidatedEInvoiceFromInvoicesPanel";
import { formatLhdnValidationErrorsNotifyBody } from "@/utils/formatLhdnValidationErrors";
import { isSingleAssignedBusiness } from "@/utils/sessionAssignedBusinesses";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const E_INVOICE_HUB_TAB_IDS = ["invoices", "consolidated"];

function getInvoiceCustomerDisplayName(invoice) {
  if (!invoice) return "";
  if (invoice.isConsolidated) return ciText("General Public");
  const name =
    invoice.customer_id?.basicInformation?.customerDisplayName ||
    invoice.customer_id?.basicInformation?.companyName ||
    invoice.customer_name ||
    "";
  return String(name).trim();
}

/**
 * Small badge used by the Customer Invoices list to show the current
 * LHDN (MyInvois) e-invoice status for each row. Matches the palette of
 * `EInvoicePanel` on the invoice viewer so both screens feel consistent.
 */
const LHDN_BADGE_STYLES = {
  Pending: { icon: Clock, cls: "bg-gray-100 text-gray-800" },
  Submitted: { icon: Send, cls: "bg-blue-100 text-blue-800" },
  Valid: {
    icon: CheckCircle2,
    cls: "bg-green-100 text-green-800",
  },
  Invalid: {
    icon: FileWarning,
    cls: "bg-amber-100 text-amber-800",
  },
  Rejected: {
    icon: AlertTriangle,
    cls: "bg-red-100 text-red-800",
  },
  Cancelled: {
    icon: X,
    cls: "bg-red-100 text-red-800",
  },
  /**
   * Source invoices that have been rolled up into a B2C consolidated
   * e-invoice. Their line items are submitted to LHDN through the parent
   * consolidated document, so individual submit/retry are intentionally
   * disabled for these rows. Same status string used by Invoispls.
   */
  "Consolidated Submit": {
    icon: Copy,
    cls: "bg-violet-100 text-violet-800",
  },
};

function LhdnStatusBadge({ status }) {
  const resolved = status || "Pending";
  const style = LHDN_BADGE_STYLES[resolved] || LHDN_BADGE_STYLES.Pending;
  const Icon = style.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${style.cls}`}
    >
      <Icon size={12} />
      {ciText(resolved)}
    </span>
  );
}

const INVOICE_STATUS_TONES = {
  paid: "success",
  "partially paid": "info",
  pending: "warning",
  draft: "neutral",
  sent: "info",
  "request sent": "info",
  "collection scheduled": "info",
};

/** Payment / workflow status for the invoice (separate from LHDN e-invoice status). */
function InvoiceStatusBadge({ status }) {
  const raw = status != null ? String(status).trim() : "";
  const label = raw ? ciText(raw) : "—";
  if (!raw) return <span className="epc-cell__secondary">—</span>;
  return (
    <StatusPill
      status={label}
      tone={INVOICE_STATUS_TONES[raw.toLowerCase()] || "neutral"}
    />
  );
}

export default function CustomerInvoices() {
  const { i18n } = useTranslation();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo?.token}`,
  };

  // State management
  const [showStatementModal, setShowStatementModal] = useState(false);
  const [selectedBusinessFilter, setSelectedBusinessFilter] = useState("");
  const [selectedCustomerFilter, setSelectedCustomerFilter] = useState("");
  const [selectedInvoiceTypeFilter, setSelectedInvoiceTypeFilter] =
    useState("All");
  const [
    selectedEInvoiceDocumentTypeFilter,
    setSelectedEInvoiceDocumentTypeFilter,
  ] = useState("All");
  const [selectedInvoiceStatusFilter, setSelectedInvoiceStatusFilter] =
    useState("All");
  const [selectedLhdnStatusFilter, setSelectedLhdnStatusFilter] =
    useState("All");
  const [selectedDateCreatedFilter, setSelectedDateCreatedFilter] =
    useState("");
  const [selectedDueDateFilter, setSelectedDueDateFilter] = useState("");
  const [selectedSalesContractsFilter, setSelectedSalesContractsFilter] =
    useState("All");
  const [dateRangeStart, setDateRangeStart] = useState("");
  const [dateRangeEnd, setDateRangeEnd] = useState("");
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [pendingDeleteInvoice, setPendingDeleteInvoice] = useState(null);
  const [businessesLoading, setBusinessesLoading] = useState(true);
  const history = useHistory();
  const location = useLocation();

  const isEInvoiceHubRoute =
    location.pathname.replace(/\/$/, "") === "/e-invoices";

  const tabFromUrl = new URLSearchParams(location.search).get("tab");
  const initialHubTab =
    isEInvoiceHubRoute && E_INVOICE_HUB_TAB_IDS.includes(tabFromUrl)
      ? tabFromUrl
      : "invoices";
  const [eInvoiceHubTab, setEInvoiceHubTab] = useState(initialHubTab);

  const eInvoiceHubTabs = useMemo(
    () => [
      { id: "invoices", label: ciText("Invoices") },
      { id: "consolidated", label: ciText("Consolidated e-invoice") },
    ],
    // Recompute labels when language changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [i18n.language],
  );

  useEffect(() => {
    if (!isEInvoiceHubRoute) return;
    const t = new URLSearchParams(location.search).get("tab");
    if (t === "credit-notes") {
      history.replace("/credit-notes");
      return;
    }
    if (t === "debit-notes") {
      history.replace("/debit-notes");
      return;
    }
    if (t === "refund-notes") {
      history.replace("/credit-notes?einvRefund=1");
      return;
    }
  }, [isEInvoiceHubRoute, location.search, history]);

  useEffect(() => {
    const path = location.pathname.replace(/\/$/, "");
    if (path !== "/customer-invoices") return;
    const t = new URLSearchParams(location.search).get("tab");
    if (!t || t === "invoices") return;
    if (t === "consolidated") {
      history.replace("/e-invoices?tab=consolidated");
      return;
    }
    if (t === "credit-notes") {
      history.replace("/credit-notes");
      return;
    }
    if (t === "debit-notes") {
      history.replace("/debit-notes");
      return;
    }
    if (t === "refund-notes") {
      history.replace("/credit-notes?einvRefund=1");
      return;
    }
  }, [location.pathname, location.search, history]);

  useEffect(() => {
    if (!isEInvoiceHubRoute) {
      setEInvoiceHubTab("invoices");
      return;
    }
    const t = new URLSearchParams(location.search).get("tab");
    if (E_INVOICE_HUB_TAB_IDS.includes(t)) {
      setEInvoiceHubTab(t);
    } else {
      setEInvoiceHubTab("invoices");
    }
  }, [isEInvoiceHubRoute, location.search]);

  const setEInvoiceHubTabAndUrl = (id) => {
    setEInvoiceHubTab(id);
    if (!isEInvoiceHubRoute) return;
    if (id === "invoices") {
      history.replace({ pathname: "/e-invoices", search: "" });
    } else {
      history.replace({
        pathname: "/e-invoices",
        search: `?tab=${encodeURIComponent(id)}`,
      });
    }
  };

  const routePerms = useRouteModulePermissions();
  const { canAdd, canUpdate, canDelete, canView, canViewDetails } = routePerms;
  const canViewInvoice = canView || canViewDetails;
  const [businesses, setBusinesses] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [salesContracts, setSalesContracts] = useState([]);
  const [statementCurrencies, setStatementCurrencies] = useState([]);

  // Statement modal state
  const [statementBusiness, setStatementBusiness] = useState("");
  const [statementCustomer, setStatementCustomer] = useState("");
  const [statementCurrency, setStatementCurrency] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [invoices, setInvoices] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [overallStats, setOverallStats] = useState({
    totalInvoices: 0,
    generatedInvoices: 0,
    paidInvoices: 0,
    pendingInvoices: 0,
    totalValue: 0,
  });
  const [eInvoiceStats, setEInvoiceStats] = useState({
    submittedPipeline: 0,
    submitted: 0,
    valid: 0,
    needsAttention: 0,
  });

  // Bulk payment state
  const [selectedInvoices, setSelectedInvoices] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [showBulkPaymentModal, setShowBulkPaymentModal] = useState(false);
  const [
    showProfessionalBulkPaymentModal,
    setShowProfessionalBulkPaymentModal,
  ] = useState(false);

  const [bulkPaymentLoading, setBulkPaymentLoading] = useState(false);

  const anyAssignedBusinessHasEInvoice = useMemo(
    () => (businesses || []).some((b) => isEInvoiceEnabledValue(b)),
    [businesses],
  );
  const assignedBusinessIds = useMemo(
    () => (businesses || []).map((b) => b?._id).filter(Boolean),
    [businesses],
  );

  useEffect(() => {
    if (!anyAssignedBusinessHasEInvoice) setSelectedLhdnStatusFilter("All");
  }, [anyAssignedBusinessHasEInvoice]);

  const rowShowsLhdn = useCallback(
    (inv) => {
      const bid = inv?.business_id?._id || inv?.business_id;
      if (!bid) return anyAssignedBusinessHasEInvoice;
      const b = businesses.find((x) => String(x._id) === String(bid));
      if (b) return isEInvoiceEnabledValue(b);
      return anyAssignedBusinessHasEInvoice;
    },
    [businesses, anyAssignedBusinessHasEInvoice],
  );

  /**
   * FilterDropdown clear (X) passes undefined/null/"". Filters that default to
   * "All" must restore "All" so refetch + toLowerCase comparisons stay valid.
   */
  const toAllDefault = (value) =>
    value == null || value === "" ? "All" : value;

  // Clear all filters function
  const clearAllFilters = () => {
    setSelectedBusinessFilter(
      businesses.length === 1 ? businesses[0]._id : "",
    );
    setSelectedCustomerFilter("");
    setSelectedInvoiceTypeFilter("All");
    setSelectedEInvoiceDocumentTypeFilter("All");
    setSelectedInvoiceStatusFilter("All");
    setSelectedLhdnStatusFilter("All");
    setSelectedDateCreatedFilter("");
    setSelectedDueDateFilter("");
    setSelectedSalesContractsFilter("All");
    setDateRangeStart("");
    setDateRangeEnd("");
    setSearchTerm("");
    setCurrentPage(1);
  };

  const portalFilterValues = {
    business: selectedBusinessFilter || "",
    customer: selectedCustomerFilter || "",
    documentType:
      selectedEInvoiceDocumentTypeFilter === "All"
        ? ""
        : selectedEInvoiceDocumentTypeFilter,
    invoiceStatus:
      selectedInvoiceStatusFilter === "All" ? "" : selectedInvoiceStatusFilter,
    lhdnStatus:
      selectedLhdnStatusFilter === "All" ? "" : selectedLhdnStatusFilter,
  };

  const portalFilters = useMemo(() => {
    const list = [
      ...(!isSingleAssignedBusiness()
        ? [
            {
              key: "business",
              placeholder: ciText("Select Business"),
              options: [
                { value: "", label: ciText("Select Business") },
                ...businesses.map((b) => ({
                  value: b._id,
                  label: b.name,
                })),
              ],
            },
          ]
        : []),
      {
        key: "customer",
        placeholder: ciText("Select Customer"),
        options: [
          { value: "", label: ciText("Select Customer") },
          ...customers.map((c) => ({
            value: c._id,
            label:
              c.basicInformation?.customerDisplayName ??
              c.basicInformation?.companyName ??
              "—",
          })),
        ],
      },
      ...(isEInvoiceHubRoute && eInvoiceHubTab === "invoices"
        ? [
            {
              key: "documentType",
              placeholder: ciText("Document type: All"),
              options: [
                { value: "", label: ciText("All types") },
                { value: "e-invoice", label: ciText("E-Invoice") },
                { value: "consolidated", label: ciText("Consolidated") },
              ],
            },
          ]
        : [
            {
              key: "invoiceStatus",
              placeholder: ciText("Invoice Status: All"),
              options: [
                { value: "", label: ciText("All Statuses") },
                { value: "Draft", label: ciText("Draft") },
                { value: "Pending", label: ciText("Pending") },
                { value: "Request Sent", label: ciText("Request Sent") },
                { value: "Sent", label: ciText("Sent") },
                {
                  value: "Collection Scheduled",
                  label: ciText("Collection Scheduled"),
                },
                { value: "Partially Paid", label: ciText("Partially Paid") },
                { value: "Paid", label: ciText("Paid") },
              ],
            },
          ]),
    ];

    if (anyAssignedBusinessHasEInvoice) {
      list.push({
        key: "lhdnStatus",
        placeholder: ciText("LHDN Status: All"),
        options: [
          { value: "", label: ciText("All LHDN Statuses") },
          { value: "Pending", label: ciText("Pending") },
          { value: "Submitted", label: ciText("Submitted") },
          { value: "Valid", label: ciText("Valid") },
          { value: "Invalid", label: ciText("Invalid") },
          { value: "Rejected", label: ciText("Rejected") },
          { value: "Cancelled", label: ciText("Cancelled") },
          {
            value: "Consolidated Submit",
            label: ciText("Consolidated Submit"),
          },
        ],
      });
    }

    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    anyAssignedBusinessHasEInvoice,
    businesses,
    customers,
    eInvoiceHubTab,
    isEInvoiceHubRoute,
    i18n.language,
  ]);

  const handlePortalFilterChange = (key, value) => {
    if (key === "business") {
      setSelectedBusinessFilter(value ?? "");
      setCurrentPage(1);
      return;
    }
    if (key === "customer") {
      setSelectedCustomerFilter(value ?? "");
      setCurrentPage(1);
      return;
    }
    if (key === "documentType") {
      setSelectedEInvoiceDocumentTypeFilter(toAllDefault(value));
      setCurrentPage(1);
      return;
    }
    if (key === "invoiceStatus") {
      setSelectedInvoiceStatusFilter(toAllDefault(value));
      setCurrentPage(1);
      return;
    }
    if (key === "lhdnStatus") {
      setSelectedLhdnStatusFilter(toAllDefault(value));
      setCurrentPage(1);
    }
  };

  const fetchInvoices = async () => {
    const skipInvoiceFetch =
      isEInvoiceHubRoute && eInvoiceHubTab !== "invoices";
    if (skipInvoiceFetch) {
      if (!businessesLoading) setLoading(false);
      return;
    }
    // When no business selected: show invoices for all assigned businesses. When one selected: filter by that business.
    if (businesses.length === 0) {
      if (!businessesLoading) setLoading(false);
      setInvoices([]);
      setTotalPages(1);
      setOverallStats({
        totalInvoices: 0,
        generatedInvoices: 0,
        paidInvoices: 0,
        pendingInvoices: 0,
        totalValue: 0,
      });
      return;
    }

    setLoading(true);
    try {
      const applyInvoiceStatusFilter =
        !isEInvoiceHubRoute || eInvoiceHubTab !== "invoices";

      const invoiceStatusFilter = toAllDefault(selectedInvoiceStatusFilter);
      const lhdnStatusFilter = toAllDefault(selectedLhdnStatusFilter);

      // Statuses that may have case mismatches in database (Paid, Partially Paid)
      // For these, we'll filter client-side only to handle case variations
      const statusesWithCaseIssues = [
        "Paid",
        "Partially Paid",
        "paid",
        "partially paid",
      ];
      const shouldFilterClientSideOnly =
        applyInvoiceStatusFilter &&
        invoiceStatusFilter !== "All" &&
        statusesWithCaseIssues.some(
          (s) => s.toLowerCase() === invoiceStatusFilter.toLowerCase(),
        );

      // Normalize status to lowercase for backend (backend expects lowercase)
      // But skip sending status filter if it's one with case issues - we'll filter client-side
      const normalizedStatus =
        applyInvoiceStatusFilter &&
        invoiceStatusFilter !== "All" &&
        !shouldFilterClientSideOnly
          ? invoiceStatusFilter.toLowerCase()
          : undefined;

      const assignedIds = (businesses || []).map((b) => b._id).filter(Boolean);
      const params = {
        ...(selectedBusinessFilter
          ? { businessId: selectedBusinessFilter }
          : assignedIds.length > 0
            ? { businessIds: assignedIds.join(",") }
            : {}),
        customerId: selectedCustomerFilter || undefined,
        invoiceType:
          selectedInvoiceTypeFilter !== "All"
            ? selectedInvoiceTypeFilter
            : undefined,
        status: normalizedStatus,
        dateCreated: selectedDateCreatedFilter,
        dueDate: selectedDueDateFilter,
        contractId:
          selectedSalesContractsFilter !== "All"
            ? selectedSalesContractsFilter
            : undefined,
        search: searchTerm,
        // If filtering client-side only, fetch all records; otherwise use pagination
        page: shouldFilterClientSideOnly ? 1 : currentPage,
        limit: shouldFilterClientSideOnly ? 999999 : entriesPerPage,
        // Add date range parameters
        ...(dateRangeStart && { dateFrom: dateRangeStart }),
        ...(dateRangeEnd && { dateTo: dateRangeEnd }),
        ...(!isEInvoiceHubRoute ? { excludeConsolidated: true } : {}),
        ...(isEInvoiceHubRoute &&
        eInvoiceHubTab === "invoices" &&
        lhdnStatusFilter === "All"
          ? { submittedToLhdnOnly: true }
          : {}),
        ...(lhdnStatusFilter !== "All"
          ? { lhdnStatus: lhdnStatusFilter }
          : {}),
        ...(isEInvoiceHubRoute &&
        eInvoiceHubTab === "invoices" &&
        selectedEInvoiceDocumentTypeFilter !== "All"
          ? { eInvoiceDocumentType: selectedEInvoiceDocumentTypeFilter }
          : {}),
      };

      // Remove undefined values
      Object.keys(params).forEach(
        (key) => params[key] === undefined && delete params[key],
      );

      const res = await axios.get(`${Base_URL}/proforma-invoice`, {
        params,
        headers,
      });

      if (res.data) {
        let filteredInvoices = res.data.data || [];

        // Only show invoices for the selected business (same as Customer list: only business-related data)
        const assignedBusinessIds = (businesses || []).map((b) =>
          String(b._id),
        );
        if (assignedBusinessIds.length > 0) {
          filteredInvoices = filteredInvoices.filter((inv) => {
            const bid = inv.business_id?._id ?? inv.business_id;
            if (!bid) return false;
            const bidStr = typeof bid === "string" ? bid : String(bid);
            return assignedBusinessIds.includes(bidStr);
          });
        } else {
          // No assigned businesses loaded yet: show nothing (avoid showing all)
          filteredInvoices = [];
        }

        // Apply case-insensitive client-side filtering
        // This is especially important for statuses with case mismatches (Paid, Partially Paid)
        if (
          applyInvoiceStatusFilter &&
          invoiceStatusFilter &&
          invoiceStatusFilter !== "All"
        ) {
          const normalizedFilterStatus = invoiceStatusFilter.toLowerCase();
          filteredInvoices = filteredInvoices.filter((invoice) => {
            if (!invoice.status) return false;
            const invoiceStatus = invoice.status.toLowerCase().trim();

            // Handle special cases
            if (
              normalizedFilterStatus === "request sent" ||
              normalizedFilterStatus === "sent"
            ) {
              return (
                invoiceStatus === "request sent" || invoiceStatus === "sent"
              );
            }

            // Handle "Partially Paid" variations
            if (normalizedFilterStatus === "partially paid") {
              return invoiceStatus === "partially paid";
            }

            // Handle "Paid" variations
            if (normalizedFilterStatus === "paid") {
              return invoiceStatus === "paid";
            }

            return invoiceStatus === normalizedFilterStatus;
          });
        }

        // If we filtered client-side (fetched all records), handle pagination on frontend
        if (shouldFilterClientSideOnly) {
          const totalFilteredCount = filteredInvoices.length;
          const calculatedTotalPages = Math.ceil(
            totalFilteredCount / entriesPerPage,
          );

          // Slice the filtered results for current page
          const startIndex = (currentPage - 1) * entriesPerPage;
          const endIndex = startIndex + entriesPerPage;
          const paginatedInvoices = filteredInvoices.slice(
            startIndex,
            endIndex,
          );

          setInvoices(paginatedInvoices);
          setTotalPages(calculatedTotalPages || 1);

          // Calculate stats from all filtered invoices
          setOverallStats({
            totalInvoices: totalFilteredCount,
            generatedInvoices: filteredInvoices.filter(
              (inv) => inv.status && inv.status.toLowerCase() === "generated",
            ).length,
            paidInvoices: filteredInvoices.filter(
              (inv) => inv.status && inv.status.toLowerCase() === "paid",
            ).length,
            pendingInvoices: filteredInvoices.filter((inv) =>
              [
                "draft",
                "generated",
                "request sent",
                "sent",
                "collection scheduled",
                "pending",
              ].includes(inv.status?.toLowerCase()),
            ).length,
            totalValue: filteredInvoices.reduce(
              (sum, inv) => sum + (inv.grandTotal || inv.subTotal || 0),
              0,
            ),
          });
        } else {
          // Backend handled pagination
          setInvoices(filteredInvoices);
          setTotalPages(res.data.totalPages || 1);
          setOverallStats(
            res.data.overallStats || {
              totalInvoices: 0,
              generatedInvoices: 0,
              paidInvoices: 0,
              pendingInvoices: 0,
              totalValue: 0,
            },
          );
        }
        if (res.data?.eInvoiceStats) {
          setEInvoiceStats(res.data.eInvoiceStats);
        }
      }
    } catch (err) {
      console.error("Error fetching invoices", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchBusinesses = async () => {
      if (!adminInfo?.id) {
        setBusinessesLoading(false);
        return;
      }
      try {
        const response = await axios.get(
          `${Base_URL}/admin/assigned/${adminInfo.id}`,
          { headers },
        );
        const list = response.data?.businesses || [];
        setBusinesses(list);
        // By default no business is selected; user must choose one
      } catch (error) {
        console.error("Failed to fetch assigned businesses:", error);
      } finally {
        setBusinessesLoading(false);
      }
    };

    fetchBusinesses();

    const fetchSalesContracts = async () => {
      try {
        const response = await axios.get(`${Base_URL}/sales-contracts`);
        setSalesContracts(response?.data?.contracts || []);
      } catch (error) {
        console.error("Error fetching sales contracts:", error);
      }
    };

    fetchSalesContracts();
  }, [adminInfo?.id]);

  useEffect(() => {
    if (businessesLoading) return;
    if (businesses.length !== 1) return;
    const onlyId = businesses[0]?._id;
    if (!onlyId) return;
    if (selectedBusinessFilter) return;
    setSelectedBusinessFilter(String(onlyId));
  }, [businessesLoading, businesses, selectedBusinessFilter]);

  // Fetch customers for the selected business only (dropdown shows only these customers)
  useEffect(() => {
    const fetchCustomers = async () => {
      if (!selectedBusinessFilter) {
        setCustomers([]);
        setSelectedCustomerFilter("");
        return;
      }
      try {
        const response = await axios.get(
          `${Base_URL}/customers_by_business/${selectedBusinessFilter}`,
          { headers },
        );
        const list = Array.isArray(response?.data)
          ? response.data.filter((c) => !c.status || c.status === "Active")
          : [];
        setCustomers(list);
        setSelectedCustomerFilter(""); // Reset customer filter when business changes
      } catch (error) {
        console.error("Error fetching customers for business:", error);
        setCustomers([]);
      }
    };
    fetchCustomers();
  }, [selectedBusinessFilter, adminInfo?.id]);

  useEffect(() => {
    setCurrentPage(1);
    fetchInvoices();
  }, [
    isEInvoiceHubRoute,
    eInvoiceHubTab,
    selectedBusinessFilter,
    selectedCustomerFilter,
    selectedInvoiceTypeFilter,
    selectedInvoiceStatusFilter,
    selectedEInvoiceDocumentTypeFilter,
    selectedLhdnStatusFilter,
    selectedDateCreatedFilter,
    selectedDueDateFilter,
    selectedSalesContractsFilter,
    dateRangeStart,
    dateRangeEnd,
    searchTerm,
    businesses.length,
  ]);

  useEffect(() => {
    fetchInvoices();
  }, [
    currentPage,
    entriesPerPage,
    selectedBusinessFilter,
    isEInvoiceHubRoute,
    eInvoiceHubTab,
  ]);

  const handleDateRangeApply = (startDate, endDate) => {
    setDateRangeStart(startDate);
    setDateRangeEnd(endDate);
    setCurrentPage(1); // Reset to first page when filter changes
  };

  const handleDateRangeClear = () => {
    setDateRangeStart("");
    setDateRangeEnd("");
    setCurrentPage(1);
  };

  // Bulk payment functionality
  const handleSelectInvoice = (invoice) => {
    if (!invoice || !invoice._id) {
      console.error("Invalid invoice passed to handleSelectInvoice:", invoice);
      return;
    }
    if (!CustomerInvoiceServices.canInvoiceBeSelected(invoice)) {
      notifyError(ciText("Invoice cannot be selected for payment recording"));
      return;
    }
    const isSelected = selectedInvoices.some(
      (inv) => inv && inv._id === invoice._id,
    );
    if (!isSelected) {
      if (selectedInvoices.length > 0) {
        const firstCustomerId = selectedInvoices[0]?.customer_id?._id;
        const newInvoiceCustomerId = invoice?.customer_id?._id;
        if (
          firstCustomerId &&
          newInvoiceCustomerId &&
          firstCustomerId !== newInvoiceCustomerId
        ) {
          notifyError(
            "Cannot select invoices from different customers. Please select invoices from the same customer only.",
          );
          return;
        }
      }
    }
    setSelectedInvoices((prev) => {
      if (isSelected) {
        return prev.filter((inv) => inv && inv._id !== invoice._id);
      } else {
        return [...prev, invoice];
      }
    });
  };

  const handleSelectAll = () => {
    const selectableInvoices =
      CustomerInvoiceServices.getSelectableInvoices(invoices) || [];

    if (selectAll) {
      setSelectedInvoices([]);
    } else {
      // Filter out any undefined/null invoices
      const validInvoices = selectableInvoices.filter(
        (invoice) => invoice && invoice._id,
      );
      const customerIds = [
        ...new Set(
          validInvoices.map((inv) => inv.customer_id?._id).filter(Boolean),
        ),
      ];
      if (customerIds.length > 1) {
        notifyError(
          "Cannot select all invoices as they belong to different customers. Please select invoices from the same customer only.",
        );
        return;
      }
      setSelectedInvoices(validInvoices);
    }
    setSelectAll(!selectAll);
  };

  // Get counts for each status category
  const getStatusCounts = () => {
    const selectableInvoices =
      CustomerInvoiceServices.getSelectableInvoices(invoices) || [];

    const counts = {
      draft: selectableInvoices.filter(
        (inv) => inv.status && inv.status.toLowerCase() === "draft",
      ).length,
      generated: selectableInvoices.filter(
        (inv) => inv.status && inv.status.toLowerCase() === "generated",
      ).length,
      requestSent: selectableInvoices.filter(
        (inv) =>
          inv.status &&
          (inv.status.toLowerCase() === "request sent" ||
            inv.status.toLowerCase() === "sent"),
      ).length,
      collectionScheduled: selectableInvoices.filter(
        (inv) =>
          inv.status && inv.status.toLowerCase() === "collection scheduled",
      ).length,
      partiallyPaid: selectableInvoices.filter(
        (inv) => inv.status && inv.status.toLowerCase() === "partially paid",
      ).length,
      paid: selectableInvoices.filter(
        (inv) => inv.status && inv.status.toLowerCase() === "paid",
      ).length,
      total: selectableInvoices.length,
    };

    return counts;
  };

  // Select all invoices of a specific status
  const handleSelectAllByStatus = (targetStatus) => {
    const selectableInvoices =
      CustomerInvoiceServices.getSelectableInvoices(invoices) || [];

    // Normalize target status for comparison
    const normalizedTargetStatus = targetStatus.toLowerCase();

    // Handle both "Request Sent" and "Sent" statuses when target is "Request Sent"
    const statusInvoices = selectableInvoices.filter((invoice) => {
      if (!invoice || !invoice._id || !invoice.status) return false;

      const normalizedInvoiceStatus = invoice.status.toLowerCase();

      if (
        normalizedTargetStatus === "request sent" ||
        normalizedTargetStatus === "sent"
      ) {
        return (
          normalizedInvoiceStatus === "request sent" ||
          normalizedInvoiceStatus === "sent"
        );
      }

      return normalizedInvoiceStatus === normalizedTargetStatus;
    });

    // Check if all invoices of this status are already selected
    const allStatusSelected = statusInvoices.every((invoice) =>
      selectedInvoices.some((selected) => selected._id === invoice._id),
    );

    if (allStatusSelected && statusInvoices.length > 0) {
      // Deselect all invoices of this status
      setSelectedInvoices((prev) =>
        prev.filter(
          (selected) =>
            !statusInvoices.some((statusInv) => statusInv._id === selected._id),
        ),
      );
    } else {
      if (selectedInvoices.length > 0) {
        const existingCustomerId = selectedInvoices[0]?.customer_id?._id;
        const statusCustomerIds = [
          ...new Set(
            statusInvoices.map((inv) => inv.customer_id?._id).filter(Boolean),
          ),
        ];
        if (existingCustomerId && statusCustomerIds.length > 0) {
          const hasDifferentCustomer = statusCustomerIds.some(
            (customerId) => customerId !== existingCustomerId,
          );
          if (hasDifferentCustomer) {
            notifyError(
              "Cannot select invoices from different customers. Please select invoices from the same customer only.",
            );
            return;
          }
        }
      } else {
        const statusCustomerIds = [
          ...new Set(
            statusInvoices.map((inv) => inv.customer_id?._id).filter(Boolean),
          ),
        ];
        if (statusCustomerIds.length > 1) {
          notifyError(
            "Cannot select all invoices of this status as they belong to different customers. Please select invoices from the same customer only.",
          );
          return;
        }
      }
      // Select all invoices of this status (and add to existing selection)
      setSelectedInvoices((prev) => {
        const newSelections = statusInvoices.filter(
          (statusInv) =>
            !prev.some((selected) => selected._id === statusInv._id),
        );
        return [...prev, ...newSelections];
      });
    }

    // Update selectAll state based on whether all selectable invoices are now selected
    const allSelectableSelected = selectableInvoices.every(
      (invoice) =>
        selectedInvoices.some((selected) => selected._id === invoice._id) ||
        statusInvoices.some((statusInv) => statusInv._id === invoice._id),
    );
    setSelectAll(allSelectableSelected && statusInvoices.length > 0);
  };

  // Check if all invoices of a specific status are selected
  const areAllStatusSelected = (targetStatus) => {
    const selectableInvoices =
      CustomerInvoiceServices.getSelectableInvoices(invoices) || [];

    // Normalize target status for comparison
    const normalizedTargetStatus = targetStatus.toLowerCase();

    // Handle both "Request Sent" and "Sent" statuses when target is "Request Sent"
    const statusInvoices = selectableInvoices.filter((invoice) => {
      if (!invoice || !invoice._id || !invoice.status) return false;

      const normalizedInvoiceStatus = invoice.status.toLowerCase();

      if (
        normalizedTargetStatus === "request sent" ||
        normalizedTargetStatus === "sent"
      ) {
        return (
          normalizedInvoiceStatus === "request sent" ||
          normalizedInvoiceStatus === "sent"
        );
      }

      return normalizedInvoiceStatus === normalizedTargetStatus;
    });

    return (
      statusInvoices.length > 0 &&
      statusInvoices.every((invoice) =>
        selectedInvoices.some((selected) => selected._id === invoice._id),
      )
    );
  };

  // Fetch bank accounts for payment recording

  // Handle bulk payment modal
  const handleOpenBulkPayment = async () => {
    if (selectedInvoices.length === 0) {
      notifyError(ciText("Please select invoices for payment recording"));
      return;
    }
    const customerIds = [
      ...new Set(
        selectedInvoices.map((inv) => inv.customer_id?._id).filter(Boolean),
      ),
    ];
    if (customerIds.length > 1) {
      notifyError(
        "Cannot process bulk payment for invoices from different customers. Please select invoices from the same customer only.",
      );
      return;
    }
    // For bulk payments, we should allow invoices with different statuses
    // as long as they're not already fully paid
    const fullyPaidInvoices = selectedInvoices.filter(
      (inv) => inv.status === "Paid" && inv.remaining <= 0,
    );
    if (fullyPaidInvoices.length > 0) {
      notifyError(
        "Cannot process bulk payment for invoices that are already fully paid",
      );
      return;
    }

    // Check if there are any invoices with remaining amount
    const invoicesWithRemaining = selectedInvoices.filter(
      (inv) => inv.remaining > 0,
    );
    if (invoicesWithRemaining.length === 0) {
      notifyError(
        "All selected invoices are already fully paid. No payment needed.",
      );
      return;
    }

    setBulkPaymentLoading(true);
    try {
      // Bank accounts are now fetched directly in the BulkPaymentModal
      setShowBulkPaymentModal(true);
    } catch (error) {
      console.error("Error preparing bulk payment:", error);
      notifyError(ciText("Failed to prepare bulk payment"));
    } finally {
      setBulkPaymentLoading(false);
    }
  };

  const handleOpenProfessionalBulkPayment = async () => {
    if (selectedInvoices.length === 0) {
      notifyError(ciText("Please select invoices for payment recording"));
      return;
    }
    const customerIds = [
      ...new Set(
        selectedInvoices.map((inv) => inv.customer_id?._id).filter(Boolean),
      ),
    ];
    if (customerIds.length > 1) {
      notifyError(
        "Cannot process bulk payment for invoices from different customers. Please select invoices from the same customer only.",
      );
      return;
    }

    const fullyPaidInvoices = selectedInvoices.filter(
      (inv) => inv.status === "Paid" && inv.remaining <= 0,
    );
    if (fullyPaidInvoices.length > 0) {
      notifyError(
        "Cannot process bulk payment for invoices that are already fully paid",
      );
      return;
    }

    const invoicesWithRemaining = selectedInvoices.filter(
      (inv) => inv.remaining > 0,
    );
    if (invoicesWithRemaining.length === 0) {
      notifyError(
        "All selected invoices are already fully paid. No payment needed.",
      );
      return;
    }

    setBulkPaymentLoading(true);
    try {
      setShowProfessionalBulkPaymentModal(true);
    } catch (error) {
      console.error("Error preparing professional bulk payment:", error);
      notifyError(ciText("Failed to prepare professional bulk payment"));
    } finally {
      setBulkPaymentLoading(false);
    }
  };

  const handleBulkPaymentComplete = () => {
    setSelectedInvoices([]);
    setSelectAll(false);
    setShowBulkPaymentModal(false);
    setShowProfessionalBulkPaymentModal(false);
    // Refresh the invoice list to show updated balances and statuses
    fetchInvoices();
    // Note: Bank account balances are now updated in the backend,
    // similar to single payment processing
    notifySuccess(ciText("Bulk payment recorded successfully!"));
  };

  // Clear selection when filters change
  useEffect(() => {
    setSelectedInvoices([]);
    setSelectAll(false);
  }, [
    selectedBusinessFilter,
    selectedCustomerFilter,
    selectedInvoiceTypeFilter,
    selectedInvoiceStatusFilter,
    selectedDateCreatedFilter,
    selectedSalesContractsFilter,
    dateRangeStart,
    dateRangeEnd,
    searchTerm,
  ]);

  // Functions to handle modal
  const openStatementModal = () => {
    setShowStatementModal(true);
    if (isSingleAssignedBusiness() && businesses[0]?._id) {
      setStatementBusiness(String(businesses[0]._id));
    }
  };
  const closeStatementModal = () => {
    setShowStatementModal(false);
    // Reset form when closing
    setStatementBusiness("");
    setStatementCustomer("");
    setStatementCurrency("");
    setDateFrom("");
    setDateTo("");
  };

  /**
   * LHDN (MyInvois) e-invoice row actions for the list view.
   * Mirrors the Invoispls invoice list actions:
   *   Pending              → Submit to LHDN
   *   Submitted            → Refresh Status
   *   Rejected / Invalid   → Retry
   *   Valid                → Download e-invoice PDF (same flow as InvoisPls) + View details
   */
  const [eInvoiceBusyId, setEInvoiceBusyId] = useState(null);
  const [eInvoiceDownloadId, setEInvoiceDownloadId] = useState(null);
  /** After Submit / Retry / Refresh LHDN, show the full API body { status, message, data, link }. */
  const [eInvoiceApiResponseModal, setEInvoiceApiResponseModal] =
    useState(null);
  /** In-app confirm for LHDN submit / resubmit (replaces browser confirm / "localhost says"). */
  const [eInvoiceActionConfirm, setEInvoiceActionConfirm] = useState(null);
  const autoSyncedLhdnInvoiceIdsRef = useRef(new Set());

  const updateInvoiceRow = (invoiceId, patch) => {
    setInvoices((prev) =>
      prev.map((inv) => (inv._id === invoiceId ? { ...inv, ...patch } : inv)),
    );
  };

  const performSubmitToLHDN = async (invoice) => {
    if (!invoice?._id) return;
    try {
      setEInvoiceBusyId(invoice._id);
      const { data } = await EInvoiceServices.submit(invoice._id);
      notifySuccess(data?.message || ciText("Invoice submitted to LHDN"));
      if (data?.data) updateInvoiceRow(invoice._id, data.data);
      else fetchInvoices();
    } catch (err) {
      const resp = err?.response?.data;
      if (resp?.validationErrors?.length) {
        notifyError(
          formatLhdnValidationErrorsNotifyBody(
            resp.validationErrors,
            "Couldn’t submit this invoice to MyInvois (LHDN)",
            { maxLines: 5 },
          ),
        );
      } else if (resp?.message) {
        notifyError(
          formatLhdnValidationErrorsNotifyBody(
            [{ error: resp.message }],
            "Couldn’t submit this invoice to MyInvois (LHDN)",
          ),
        );
      } else {
        notifyError(err.message || ciText("Submission failed"));
      }
    } finally {
      setEInvoiceBusyId(null);
    }
  };

  const handleSubmitToLHDN = (invoice) => {
    if (!invoice?._id) return;
    setEInvoiceActionConfirm({ action: "submit-lhdn", invoice });
  };

  const performRetryLHDN = async (invoice) => {
    if (!invoice?._id) return;
    try {
      setEInvoiceBusyId(invoice._id);
      const { data } = await EInvoiceServices.retry(invoice._id);
      notifySuccess(data?.message || ciText("Invoice resubmitted to LHDN"));
      /**
       * Only surface the raw API response modal when the operation did NOT
       * succeed (status: false or LHDN validation rejected). On a clean
       * success the toast + row update is enough — no JSON dump.
       */
      if (data && typeof data === "object" && data.status !== true) {
        setEInvoiceApiResponseModal({
          title: "LHDN — retry",
          invoiceNo: invoice.invoice_number,
          body: data,
        });
      }
      if (data?.data) updateInvoiceRow(invoice._id, data.data);
      else fetchInvoices();
    } catch (err) {
      const resp = err?.response?.data;
      if (resp?.validationErrors?.length) {
        notifyError(
          formatLhdnValidationErrorsNotifyBody(
            resp.validationErrors,
            "Couldn’t resubmit this invoice to MyInvois (LHDN)",
            { maxLines: 5 },
          ),
        );
      } else if (resp?.message) {
        notifyError(
          formatLhdnValidationErrorsNotifyBody(
            [{ error: resp.message }],
            "Couldn’t resubmit this invoice to MyInvois (LHDN)",
          ),
        );
      } else {
        notifyError(err.message || ciText("Retry failed"));
      }
    } finally {
      setEInvoiceBusyId(null);
    }
  };

  const handleRetryLHDN = (invoice) => {
    if (!invoice?._id) return;
    setEInvoiceActionConfirm({ action: "retry-lhdn", invoice });
  };

  const handleConfirmEInvoiceAction = async () => {
    const pending = eInvoiceActionConfirm;
    if (!pending?.invoice?._id) {
      setEInvoiceActionConfirm(null);
      return;
    }
    const { action, invoice } = pending;
    setEInvoiceActionConfirm(null);
    if (action === "submit-lhdn") await performSubmitToLHDN(invoice);
    else if (action === "retry-lhdn") await performRetryLHDN(invoice);
  };

  const handleRefreshLHDN = async (invoice) => {
    if (!invoice?._id) return;
    try {
      setEInvoiceBusyId(invoice._id);
      const { data } = await EInvoiceServices.getStatus(invoice._id);
      notifySuccess(ciText("Status refreshed from LHDN"));
      /**
       * Don't pop the raw API response modal on a successful refresh —
       * the row is already patched with the new lhdn_status. Only show the
       * dump when the API itself reports a non-success (e.g. status: false).
       */
      if (data && typeof data === "object" && data.status !== true) {
        setEInvoiceApiResponseModal({
          title: "LHDN — status refresh",
          invoiceNo: invoice.invoice_number,
          body: data,
        });
      }
      if (data?.data) updateInvoiceRow(invoice._id, data.data);
    } catch (err) {
      notifyError(err?.response?.data?.message || err.message);
    } finally {
      setEInvoiceBusyId(null);
    }
  };

  const handleViewEInvoice = (invoice) => {
    if (!invoice?._id) return;
    history.push(`/invoices/e-invoice/${encodeURIComponent(String(invoice._id))}`);
  };

  useEffect(() => {
    const candidates = (invoices || [])
      .filter(
        (inv) =>
          inv?._id &&
          inv?.uuid &&
          ["Submitted", "Pending"].includes(
            (inv?.lhdn_status || "").toString(),
          ),
      )
      .filter((inv) => !autoSyncedLhdnInvoiceIdsRef.current.has(inv._id))
      .slice(0, 5);

    if (!candidates.length) return;

    let cancelled = false;
    (async () => {
      for (const inv of candidates) {
        if (cancelled) return;
        autoSyncedLhdnInvoiceIdsRef.current.add(inv._id);
        try {
          const { data } = await EInvoiceServices.getStatus(inv._id);
          if (cancelled) return;
          if (data?.data) updateInvoiceRow(inv._id, data.data);
        } catch {
          // Silent background sync on page load; manual refresh still available.
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [invoices]);

  const handleDownloadEInvoicePDF = async (invoice) => {
    if (invoice.lhdn_status !== "Valid") {
      notifyError(ciText("Only valid e-invoices can be downloaded as PDF"));
      return;
    }
    if (!invoice?._id) return;
    setEInvoiceDownloadId(invoice._id);
    try {
      await downloadFlexaCustomerInvoiceEInvoicePdf(invoice, {
        getInvoiceById: (id) => CustomerInvoiceServices.getInvoiceById(id),
        getEInvoiceDetails: async (code) => {
          const { data } = await EInvoiceServices.getDetails(code);
          return data;
        },
        getBusinessById: (businessId) =>
          axios.get(`${Base_URL}/business/${businessId}`),
        getBusinessLhdnByBusinessId: async (businessId) => {
          if (!businessId) return null;
          try {
            const { data: res } = await axios.get(
              `${Base_URL}/BusinessDetails/get_by_business_id/${businessId}`,
            );
            const d = res?.data;
            if (Array.isArray(d) && d[0]) return d[0];
            return d && typeof d === "object" ? d : null;
          } catch {
            return null;
          }
        },
      });
      notifySuccess(ciText("E-invoice PDF downloaded"));
    } catch (err) {
      notifyError(err?.message || ciText("Failed to download PDF. Please try again."));
    } finally {
      setEInvoiceDownloadId(null);
    }
  };

  const handleDeleteInvoice = async (invoice) => {
    if (!canDelete) return;
    if (!invoice?._id) return;

    const invoiceNo = invoice?.invoice_number
      ? `#${invoice.invoice_number}`
      : "this invoice";

    setPendingDeleteInvoice({
      invoiceId: invoice._id,
      invoiceNo,
    });
    setConfirmDeleteOpen(true);
  };

  const confirmDeleteInvoice = async () => {
    if (!pendingDeleteInvoice?.invoiceId) return;
    try {
      setLoading(true);
      await CustomerInvoiceServices.deleteInvoice(
        pendingDeleteInvoice.invoiceId,
      );
      notifySuccess(ciText("Invoice deleted successfully"));

      // Remove from selection if it was selected
      setSelectedInvoices((prev) =>
        prev.filter((inv) => inv && inv._id !== pendingDeleteInvoice.invoiceId),
      );

      // Refresh the invoice list
      fetchInvoices();
    } catch (error) {
      console.error("Error deleting invoice:", error);
      notifyError(ciText("Failed to delete invoice"));
    } finally {
      setConfirmDeleteOpen(false);
      setPendingDeleteInvoice(null);
      setLoading(false);
    }
  };

  // Fetch currencies when business changes in statement modal
  useEffect(() => {
    if (statementBusiness) {
      fetchStatementCurrencies(statementBusiness);
      setStatementCustomer(""); // Reset customer when business changes
    }
  }, [statementBusiness]);

  // Fetch currencies for statement modal
  const fetchStatementCurrencies = async (businessId) => {
    if (!businessId) return;
    try {
      const response = await axios.get(
        `${Base_URL}/finance/currencies?business_id=${businessId}`,
      );
      setStatementCurrencies(response?.data?.data || []);
      // Set default currency to base currency if available
      const baseCurrency = response?.data?.data?.find(
        (currency) => currency.is_base,
      );
      setStatementCurrency(baseCurrency?._id || "");
    } catch (error) {
      console.error("Error fetching currencies for statement:", error);
    }
  };

  const formatDateForApi = (d) => {
    if (!d) return undefined;
    if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d)) return d;
    const date = d instanceof Date ? d : new Date(d);
    return isNaN(date.getTime()) ? undefined : formatDateToYMD(date);
  };

  const handleRetrieveStatement = async () => {
    // Validate required fields
    if (!statementBusiness || !statementCustomer) {
      notifyError(ciText("Please select both business and customer"));
      return;
    }

    try {
      setLoading(true);

      // Prepare request data - use YYYY-MM-DD for inclusive date range
      const requestData = {
        businessId: statementBusiness,
        customerId: statementCustomer,
        dateFrom: formatDateForApi(dateFrom),
        dateTo: formatDateForApi(dateTo),
        currencyId: statementCurrency || null, // Make currency optional
      };

      console.log("Frontend sending request data:", {
        businessId: statementBusiness,
        customerId: statementCustomer,
        dateFrom: dateFrom,
        dateTo: dateTo,
        dateFromType: typeof dateFrom,
        dateToType: typeof dateTo,
      });

      // Make API call to generate customer statement
      const response = await axios.post(
        `${Base_URL}/proforma-invoice/customer-statement`,
        requestData,
        {
          responseType: "blob", // Important for PDF download
          headers,
        },
      );

      // Create blob URL and trigger download
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      // Get customer name for filename
      const selectedCustomer = customers.find(
        (c) => c._id === statementCustomer,
      );
      const customerName =
        selectedCustomer?.basicInformation?.customerDisplayName || "customer";
      const filename = `customer-statement-${customerName.replace(
        /\s+/g,
        "-",
      )}-${new Date().toISOString().split("T")[0]}.pdf`;

      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();

      // Clean up
      link.remove();
      window.URL.revokeObjectURL(url);

      notifySuccess(ciText("Customer statement generated successfully!"));
      closeStatementModal();

      // Reset form
      setStatementBusiness("");
      setStatementCustomer("");
      setDateFrom("");
      setDateTo("");
    } catch (error) {
      console.error("Error generating customer statement:", error);
      if (error.response?.status === 404) {
        notifyError(ciText("No invoices found for the selected criteria"));
      } else if (error.response?.status === 400) {
        notifyError(
          error.response.data.message || ciText("Invalid request parameters"),
        );
      } else {
        notifyError(ciText("Failed to generate customer statement. Please try again."));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRetrieveStatementCSV = async () => {
    // Validate required fields
    if (!statementBusiness || !statementCustomer) {
      notifyError(ciText("Please select both business and customer"));
      return;
    }

    try {
      setLoading(true);

      // Prepare request data - use YYYY-MM-DD for inclusive date range
      const requestData = {
        businessId: statementBusiness,
        customerId: statementCustomer,
        dateFrom: formatDateForApi(dateFrom),
        dateTo: formatDateForApi(dateTo),
        currencyId: statementCurrency || null, // Make currency optional
      };

      console.log("Frontend sending CSV request data:", {
        businessId: statementBusiness,
        customerId: statementCustomer,
        dateFrom: dateFrom,
        dateTo: dateTo,
        dateFromType: typeof dateFrom,
        dateToType: typeof dateTo,
      });

      // Make API call to generate customer statement CSV
      const response = await axios.post(
        `${Base_URL}/proforma-invoice/customer-statement-csv`,
        requestData,
        {
          responseType: "blob", // Important for CSV download
          headers,
        },
      );

      // Create blob URL and trigger download
      const blob = new Blob([response.data], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      // Get customer name for filename
      const selectedCustomer = customers.find(
        (c) => c._id === statementCustomer,
      );
      const customerName =
        selectedCustomer?.basicInformation?.customerDisplayName || "customer";
      const filename = `customer-statement-${customerName.replace(
        /\s+/g,
        "-",
      )}-${new Date().toISOString().split("T")[0]}.csv`;

      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();

      // Clean up
      link.remove();
      window.URL.revokeObjectURL(url);

      notifySuccess(ciText("Customer statement CSV exported successfully!"));
      closeStatementModal();

      // Reset form
      setStatementBusiness("");
      setStatementCustomer("");
      setDateFrom("");
      setDateTo("");
    } catch (error) {
      console.error("Error generating customer statement CSV:", error);
      if (error.response?.status === 404) {
        notifyError(ciText("No invoices found for the selected criteria"));
      } else if (error.response?.status === 400) {
        notifyError(
          error.response.data.message || ciText("Invalid request parameters"),
        );
      } else {
        notifyError(
          "Failed to generate customer statement CSV. Please try again.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      setLoading(true);

      // Statuses that may have case mismatches in database (Paid, Partially Paid)
      // For these, we'll filter client-side only to handle case variations
      const invoiceStatusFilter = toAllDefault(selectedInvoiceStatusFilter);
      const lhdnStatusFilter = toAllDefault(selectedLhdnStatusFilter);
      const statusesWithCaseIssues = [
        "Paid",
        "Partially Paid",
        "paid",
        "partially paid",
      ];
      const shouldFilterClientSideOnly =
        invoiceStatusFilter !== "All" &&
        statusesWithCaseIssues.some(
          (s) => s.toLowerCase() === invoiceStatusFilter.toLowerCase(),
        );

      // Normalize status to lowercase for backend (backend expects lowercase)
      // But skip sending status filter if it's one with case issues - we'll filter client-side
      const normalizedStatus =
        invoiceStatusFilter !== "All" && !shouldFilterClientSideOnly
          ? invoiceStatusFilter.toLowerCase()
          : undefined;

      // Fetch all invoices with current filters
      const params = {
        businessId: selectedBusinessFilter || undefined,
        customerId: selectedCustomerFilter || undefined,
        invoiceType:
          selectedInvoiceTypeFilter !== "All"
            ? selectedInvoiceTypeFilter
            : undefined,
        status: normalizedStatus,
        dateCreated: selectedDateCreatedFilter,
        dueDate: selectedDueDateFilter,
        contractId:
          selectedSalesContractsFilter !== "All"
            ? selectedSalesContractsFilter
            : undefined,
        search: searchTerm,
        page: 1,
        limit: 999999, // Get all records
        // Add date range parameters if they exist
        ...(dateRangeStart && { dateFrom: dateRangeStart }),
        ...(dateRangeEnd && { dateTo: dateRangeEnd }),
        ...(lhdnStatusFilter !== "All"
          ? { lhdnStatus: lhdnStatusFilter }
          : {}),
      };

      // Remove undefined values
      Object.keys(params).forEach(
        (key) => params[key] === undefined && delete params[key],
      );

      const response = await axios.get(`${Base_URL}/proforma-invoice`, {
        params,
        headers,
      });

      let allInvoices = response.data.data || [];

      // Export only invoices for businesses assigned to this user
      const assignedIds = (businesses || []).map((b) => String(b._id));
      if (assignedIds.length > 0) {
        allInvoices = allInvoices.filter((inv) => {
          const bid = inv.business_id?._id ?? inv.business_id;
          if (!bid) return false;
          return assignedIds.includes(
            typeof bid === "string" ? bid : String(bid),
          );
        });
      }

      // Apply case-insensitive client-side filtering
      // This is especially important for statuses with case mismatches (Paid, Partially Paid)
      if (invoiceStatusFilter && invoiceStatusFilter !== "All") {
        const normalizedFilterStatus = invoiceStatusFilter.toLowerCase();
        allInvoices = allInvoices.filter((invoice) => {
          if (!invoice.status) return false;
          const invoiceStatus = invoice.status.toLowerCase().trim();

          // Handle special cases
          if (
            normalizedFilterStatus === "request sent" ||
            normalizedFilterStatus === "sent"
          ) {
            return invoiceStatus === "request sent" || invoiceStatus === "sent";
          }

          // Handle "Partially Paid" variations
          if (normalizedFilterStatus === "partially paid") {
            return invoiceStatus === "partially paid";
          }

          // Handle "Paid" variations
          if (normalizedFilterStatus === "paid") {
            return invoiceStatus === "paid";
          }

          return invoiceStatus === normalizedFilterStatus;
        });
      }

      if (allInvoices.length === 0) {
        notifyError(ciText("No invoices found to export"));
        return;
      }

      // Prepare Excel data
      const exportData = allInvoices.map((invoice) => ({
        "Invoice Number": invoice.invoice_number || "",
        "Customer Name":
          invoice.customer_id?.basicInformation?.customerDisplayName || "",
        "Invoice Type": invoice.invoiceType || "",
        "Contract No": invoice.contract_no || "",
        "Invoice Date": invoice.invoice_date
          ? formatDate(invoice.invoice_date)
          : "",
        "Due Date": invoice.due_date ? formatDate(invoice.due_date) : "",
        Status: invoice.status || "",
        "Sub Total": invoice.subTotal || 0,
        Discount: invoice.discountAmount || 0,
        // "Shipping Charges": invoice.shippingCharges || 0,
        // "Adjustment": invoice.adjustment || 0,
        "Grand Total": invoice.grandTotal || invoice.subTotal || 0,
        Currency: invoice.currency || "USD",
        "Email Sent": invoice.emailSent ? "Yes" : "No",
        "Email Sent At": invoice.emailSentAt
          ? formatDate(invoice.emailSentAt)
          : "",
        "Created At": invoice.createdAt ? formatDate(invoice.createdAt) : "",
        "Updated At": invoice.updatedAt ? formatDate(invoice.updatedAt) : "",
      }));

      // Create summary rows
      const summaryRows = [
        {
          "Invoice Number": `Customer Invoices Report`,
          "Customer Name": "",
          "Invoice Type": "",
          "Contract No": "",
          "Invoice Date": "",
          "Due Date": "",
          Status: "",
          "Sub Total": "",
          Discount: "",
          // "Shipping Charges": "",
          // "Adjustment": "",
          "Grand Total": "",
          Currency: "",
          "Email Sent": "",
          "Email Sent At": "",
          "Created At": "",
          "Updated At": "",
        },
        {
          "Invoice Number": `Generated on: ${formatDate(new Date())}`,
          "Customer Name": "",
          "Invoice Type": "",
          "Contract No": "",
          "Invoice Date": "",
          "Due Date": "",
          Status: "",
          "Sub Total": "",
          Discount: "",
          // "Shipping Charges": "",
          // "Adjustment": "",
          "Grand Total": "",
          Currency: "",
          "Email Sent": "",
          "Email Sent At": "",
          "Created At": "",
          "Updated At": "",
        },
        {
          "Invoice Number": `Total Invoices: ${allInvoices.length}`,
          "Customer Name": "",
          "Invoice Type": "",
          "Contract No": "",
          "Invoice Date": "",
          "Due Date": "",
          Status: "",
          "Sub Total": "",
          Discount: "",
          // "Shipping Charges": "",
          // "Adjustment": "",
          "Grand Total": "",
          Currency: "",
          "Email Sent": "",
          "Email Sent At": "",
          "Created At": "",
          "Updated At": "",
        },
        {
          "Invoice Number": `Total Value: ${formatAmount(
            allInvoices.reduce(
              (sum, inv) => sum + (inv.grandTotal || inv.subTotal || 0),
              0,
            ),
          )}`,
          "Customer Name": "",
          "Invoice Type": "",
          "Contract No": "",
          "Invoice Date": "",
          "Due Date": "",
          Status: "",
          "Sub Total": "",
          Discount: "",
          // "Shipping Charges": "",
          // "Adjustment": "",
          "Grand Total": "",
          Currency: "",
          "Email Sent": "",
          "Email Sent At": "",
          "Created At": "",
          "Updated At": "",
        },
        {
          "Invoice Number": "",
          "Customer Name": "",
          "Invoice Type": "",
          "Contract No": "",
          "Invoice Date": "",
          "Due Date": "",
          Status: "",
          "Sub Total": "",
          Discount: "",
          // "Shipping Charges": "",
          // "Adjustment": "",
          "Grand Total": "",
          Currency: "",
          "Email Sent": "",
          "Email Sent At": "",
          "Created At": "",
          "Updated At": "",
        },
      ];

      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet([]);

      // Add summary rows
      XLSX.utils.sheet_add_json(worksheet, summaryRows, {
        skipHeader: true,
        origin: "A1",
      });

      // Add data rows
      XLSX.utils.sheet_add_json(worksheet, exportData, {
        skipHeader: false,
        origin: "A6", // Start after summary rows
      });

      // Create workbook
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Customer Invoices");

      // Generate filename
      const filename = `Customer_Invoices_${
        new Date().toISOString().split("T")[0]
      }.xlsx`;

      // Download file
      XLSX.writeFile(workbook, filename);

      notifySuccess(ciText("Customer invoices exported to Excel successfully!"));
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      notifyError(ciText("Failed to export invoices to Excel. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenFile = async (documentId) => {
    if (!documentId) return;

    try {
      let response = await axios.get(
        `${Base_URL}/documents/getFileWithAllData/${documentId}`,
      );
      window.open(response.data.data.url, "_blank");
    } catch (error) {
      alert("Error getting file");
      console.log("Error: ", error);
    }
  };

  const summaryCardsData = useMemo(() => {
    if (isEInvoiceHubRoute && eInvoiceHubTab === "invoices") {
      return [
        {
          title: ciText("LHDN e-invoices"),
          value: eInvoiceStats.submittedPipeline || 0,
          backgroundColor: "summary-light",
          iconColor: "summary-dark",
          Icon: SummarySvg,
        },
        {
          title: ciText("Submitted"),
          value: eInvoiceStats.submitted || 0,
          backgroundColor: "processing-light",
          iconColor: "processing-dark",
          Icon: InProgressSvg,
        },
        {
          title: ciText("Valid"),
          value: eInvoiceStats.valid || 0,
          backgroundColor: "completed-light",
          iconColor: "completed-dark",
          Icon: CompletedSvg,
        },
        {
          title: ciText("Needs attention"),
          value: eInvoiceStats.needsAttention || 0,
          backgroundColor: "completed-light",
          iconColor: "overdue-dark",
          Icon: DelayedSvg,
        },
      ];
    }
    return [
      {
        title: ciText("Total Invoices"),
        value: overallStats.totalInvoices || 0,
        backgroundColor: "summary-light",
        iconColor: "summary-dark",
        Icon: SummarySvg,
      },
      {
        title: ciText("Pending Invoices"),
        value: overallStats.pendingInvoices || 0,
        backgroundColor: "completed-light",
        iconColor: "completed-dark",
        Icon: CompletedSvg,
      },
      {
        title: ciText("Paid Invoices"),
        value: overallStats.paidInvoices || 0,
        backgroundColor: "processing-light",
        iconColor: "processing-dark",
        Icon: InProgressSvg,
      },
      {
        title: ciText("Total Value"),
        value: `${formatAmount(overallStats.totalValue || 0)}`,
        backgroundColor: "completed-light",
        iconColor: "overdue-dark",
        Icon: DollarSvg,
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEInvoiceHubRoute, eInvoiceHubTab, eInvoiceStats, overallStats, i18n.language]);

  const filteredInvoices = useMemo(() => {
    if (!selectedLhdnStatusFilter || selectedLhdnStatusFilter === "All") {
      return invoices;
    }
    return invoices.filter((inv) => {
      const s = (inv?.lhdn_status || "Pending").toString();
      return (
        s.toLowerCase() === String(selectedLhdnStatusFilter).toLowerCase()
      );
    });
  }, [invoices, selectedLhdnStatusFilter]);

  const buildInvoiceActionItems = useCallback(
    (invoice) => {
      const statusLower = (invoice?.status || "").toLowerCase();
      const lhdnForEdit = invoice?.lhdn_status || "Pending";
      const isPaidOrPartial =
        statusLower === "paid" || statusLower === "partially paid";
      const canEditRow =
        canUpdate && !isPaidOrPartial && lhdnForEdit !== "Valid";

      const actionItems = [];
      if (canViewInvoice) {
        actionItems.push({
          action: ACTION_BUTTON_TYPES.VIEW,
          title: ciText("View"),
          onClick: () =>
            history.push(`/view-customer-invoice/${invoice._id}`),
        });
      }
      if (canEditRow) {
        actionItems.push({
          action: ACTION_BUTTON_TYPES.EDIT,
          title: ciText("Edit"),
          onClick: () =>
            history.push(`/update-customer-invoice/${invoice._id}`),
        });
      }
      if (canDelete) {
        actionItems.push({
          action: ACTION_BUTTON_TYPES.DELETE,
          title: ciText("Delete"),
          onClick: () => handleDeleteInvoice(invoice),
        });
      }

      if (rowShowsLhdn(invoice)) {
        const lhdn = invoice?.lhdn_status || "Pending";
        const busy = eInvoiceBusyId === invoice._id;
        const inConsolidation = Boolean(invoice?.consolidatedInvoiceId);
        const canSubmit = lhdn === "Pending" && !inConsolidation;
        const canRetry =
          (lhdn === "Rejected" || lhdn === "Invalid") && !inConsolidation;
        const isSubmitted = lhdn === "Submitted" && !inConsolidation;
        const isValid = lhdn === "Valid" && !inConsolidation;
        const downloadingThis = eInvoiceDownloadId === invoice._id;

        actionItems.push({
          action: ACTION_BUTTON_TYPES.VIEW_PDF,
          title: ciText("View E-Invoice details"),
          onClick: () => handleViewEInvoice(invoice),
        });
        if (canSubmit && canUpdate) {
          actionItems.push({
            action: ACTION_BUTTON_TYPES.SEND_EMAIL,
            title: ciText("Submit to LHDN"),
            onClick: () => handleSubmitToLHDN(invoice),
            disabled: busy,
          });
        }
        if (canRetry && canUpdate) {
          actionItems.push({
            action: ACTION_BUTTON_TYPES.CHANGE_STATUS,
            title: ciText("Retry submission to LHDN"),
            onClick: () => handleRetryLHDN(invoice),
            disabled: busy,
          });
        }
        if (isSubmitted) {
          actionItems.push({
            action: ACTION_BUTTON_TYPES.HISTORY,
            title: ciText("Refresh LHDN status"),
            onClick: () => handleRefreshLHDN(invoice),
            disabled: busy,
          });
        }
        if (isValid) {
          actionItems.push({
            action: ACTION_BUTTON_TYPES.DOWNLOAD,
            title: ciText("Download e-invoice PDF"),
            onClick: () => handleDownloadEInvoicePDF(invoice),
            disabled: downloadingThis,
          });
        }
      }

      return actionItems;
    },
    [
      canDelete,
      canUpdate,
      canViewInvoice,
      eInvoiceBusyId,
      eInvoiceDownloadId,
      history,
      rowShowsLhdn,
    ],
  );

  const invoiceColumns = useMemo(() => {
    const cols = [
      {
        key: "select",
        header: ciText("Select"),
        width: "44px",
        render: (invoice) => {
          const isSelected = selectedInvoices.some(
            (selected) => selected._id === invoice._id,
          );
          const canBeSelected =
            CustomerInvoiceServices.canInvoiceBeSelected(invoice);
          return (
            <div className="flex items-center justify-center">
              {canBeSelected ? (
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleSelectInvoice(invoice)}
                  className="h-4 w-4 text-[var(--p-blue)] focus:ring-[var(--p-blue)] border-gray-300 rounded"
                />
              ) : (
                <div
                  className="h-4 w-4 bg-gray-100 border border-gray-300 rounded"
                  title={ciText("Cannot select this invoice")}
                />
              )}
            </div>
          );
        },
      },
      {
        key: "invoiceNo",
        header: ciText("Invoice No"),
        width: "10%",
        render: (invoice) =>
          canViewInvoice && invoice._id ? (
            <button
              type="button"
              className="epc-cell__link"
              title={`#${invoice.invoice_number}`}
              onClick={() =>
                history.push(`/view-customer-invoice/${invoice._id}`)
              }
            >
              #{invoice.invoice_number}
            </button>
          ) : (
            <span className="epc-cell__primary">
              #{invoice.invoice_number}
            </span>
          ),
      },
      {
        key: "customer",
        header: ciText("Customer"),
        width: "14%",
        render: (invoice) => (
          <>
            <div className="epc-cell__primary">
              {invoice?.isConsolidated
                ? ciText("General Public")
                : invoice?.customer_id?.basicInformation
                    ?.customerDisplayName ||
                  invoice?.customer_id?.basicInformation?.companyName ||
                  invoice?.customer_name ||
                  "—"}
            </div>
            {invoice?.business_id?.name ? (
              <div className="epc-cell__secondary">
                {invoice.business_id.name}
              </div>
            ) : null}
          </>
        ),
      },
      {
        key: "business",
        header: ciText("Business"),
        width: "12%",
        render: (invoice) => (
          <div className="epc-cell__primary">
            {invoice?.business_id?.name || "—"}
          </div>
        ),
      },
      {
        key: "typeStatus",
        header: ciText("Type / Status"),
        width: "12%",
        render: (invoice) => (
          <div className="flex flex-col items-start gap-1">
            <StatusPill
              status={
                invoice?.isConsolidated
                  ? ciText("Consolidated")
                  : ciText("E-Invoice")
              }
              tone={invoice?.isConsolidated ? "danger-soft" : "info"}
            />
            <InvoiceStatusBadge status={invoice?.status} />
          </div>
        ),
      },
    ];

    if (anyAssignedBusinessHasEInvoice) {
      cols.push({
        key: "lhdn",
        header: ciText("LHDN"),
        width: "10%",
        render: (invoice) =>
          rowShowsLhdn(invoice) ? (
            <LhdnStatusBadge status={invoice?.lhdn_status} />
          ) : (
            <span className="epc-cell__secondary">—</span>
          ),
      });
    }

    cols.push(
      {
        key: "dates",
        header: ciText("Dates"),
        width: "12%",
        render: (invoice) => (
          <>
            <div className="epc-cell__primary">
              {formatDate(invoice?.invoice_date)}
            </div>
            <div className="epc-cell__secondary">
              {ciText("Due:")} {formatDate(invoice?.due_date)}
            </div>
          </>
        ),
      },
      {
        key: "amount",
        header: ciText("Amount"),
        width: "12%",
        render: (invoice) => {
          const invoiceDisplayAmount =
            invoice?.grandTotal ?? invoice?.subTotal ?? 0;
          return (
            <>
              <div className="epc-cell__primary">
                {formatCurrencyAmount(
                  invoice.currency || "MYR",
                  invoiceDisplayAmount,
                )}
              </div>
              {invoice?.invoiceType === "Proforma" &&
              (invoice?.advanceDepositAmount > 0 ||
                invoice?.depositAmount > 0) ? (
                <div className="epc-cell__secondary text-blue-600">
                  {formatCurrencyAmount(
                    invoice.currency || "MYR",
                    invoice.advanceDepositAmount || invoice.depositAmount,
                  )}{" "}
                  {ciText("Advance")}
                </div>
              ) : null}
            </>
          );
        },
      },
      {
        key: "actions",
        header: ciText("Actions"),
        width: "10%",
        align: "right",
        render: (invoice) => (
          <ActionButtons
            maxVisibleActions={2}
            items={buildInvoiceActionItems(invoice)}
          />
        ),
      },
    );

    return cols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    anyAssignedBusinessHasEInvoice,
    buildInvoiceActionItems,
    canViewInvoice,
    history,
    i18n.language,
    rowShowsLhdn,
    selectedInvoices,
  ]);

  const pageTitle = isEInvoiceHubRoute
    ? ciText("E-Invoices")
    : ciText("Customer Invoices");
  const pageSubtitle = !isEInvoiceHubRoute
    ? ciText("Manage and track all customer invoices")
    : eInvoiceHubTab === "invoices"
      ? ciText("Submitted e-invoices and consolidated documents for LHDN.")
      : eInvoiceHubTab === "consolidated"
        ? ciText(
            "Combine eligible source invoices into one B2C consolidated e-invoice for LHDN.",
          )
        : "";

  const selectionToolbar =
    CustomerInvoiceServices.getSelectableInvoices(invoices).length > 0 ? (
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(() => {
          const counts = getStatusCounts();
          const selectionButtons = [];

          if (counts.draft > 0) {
            selectionButtons.push(
              <button
                key="draft"
                type="button"
                onClick={() => handleSelectAllByStatus("draft")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  areAllStatusSelected("draft")
                    ? "border-gray-400 bg-white text-gray-800"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {areAllStatusSelected("draft") ? (
                  <CheckSquare size={14} />
                ) : (
                  <Square size={14} />
                )}
                {ciText("Select All ({{count}}) Draft", {
                  count: counts.draft,
                })}
              </button>,
            );
          }

          if (counts.generated > 0) {
            selectionButtons.push(
              <button
                key="generated"
                type="button"
                onClick={() => handleSelectAllByStatus("Generated")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  areAllStatusSelected("Generated")
                    ? "border-blue-400 bg-blue-50 text-blue-800"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {areAllStatusSelected("Generated") ? (
                  <CheckSquare size={14} />
                ) : (
                  <Square size={14} />
                )}
                {ciText("Select All ({{count}}) Generated", {
                  count: counts.generated,
                })}
              </button>,
            );
          }

          if (counts.requestSent > 0) {
            selectionButtons.push(
              <button
                key="requestSent"
                type="button"
                onClick={() => handleSelectAllByStatus("Request Sent")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  areAllStatusSelected("Request Sent")
                    ? "border-amber-400 bg-amber-50 text-amber-800"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {areAllStatusSelected("Request Sent") ? (
                  <CheckSquare size={14} />
                ) : (
                  <Square size={14} />
                )}
                {ciText("Select All ({{count}}) Sent", {
                  count: counts.requestSent,
                })}
              </button>,
            );
          }

          if (counts.collectionScheduled > 0) {
            selectionButtons.push(
              <button
                key="collectionScheduled"
                type="button"
                onClick={() => handleSelectAllByStatus("Collection Scheduled")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  areAllStatusSelected("Collection Scheduled")
                    ? "border-orange-400 bg-orange-50 text-orange-800"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {areAllStatusSelected("Collection Scheduled") ? (
                  <CheckSquare size={14} />
                ) : (
                  <Square size={14} />
                )}
                {ciText("Select All ({{count}}) Scheduled", {
                  count: counts.collectionScheduled,
                })}
              </button>,
            );
          }

          if (counts.partiallyPaid > 0) {
            selectionButtons.push(
              <button
                key="partiallyPaid"
                type="button"
                onClick={() => handleSelectAllByStatus("Partially Paid")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  areAllStatusSelected("Partially Paid")
                    ? "border-sky-400 bg-sky-50 text-sky-800"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {areAllStatusSelected("Partially Paid") ? (
                  <CheckSquare size={14} />
                ) : (
                  <Square size={14} />
                )}
                {ciText("Select All ({{count}}) Partially Paid", {
                  count: counts.partiallyPaid,
                })}
              </button>,
            );
          }

          if (counts.paid > 0) {
            selectionButtons.push(
              <button
                key="paid"
                type="button"
                onClick={() => handleSelectAllByStatus("Paid")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  areAllStatusSelected("Paid")
                    ? "border-emerald-400 bg-emerald-50 text-emerald-800"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {areAllStatusSelected("Paid") ? (
                  <CheckSquare size={14} />
                ) : (
                  <Square size={14} />
                )}
                {ciText("Select All ({{count}}) Paid", {
                  count: counts.paid,
                })}
              </button>,
            );
          }

          if (counts.total > 0) {
            selectionButtons.push(
              <button
                key="all"
                type="button"
                onClick={handleSelectAll}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  selectAll
                    ? "border-gray-400 bg-white text-gray-800"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {selectAll ? <CheckSquare size={14} /> : <Square size={14} />}
                {selectAll ? ciText("Deselect All") : ciText("Select All")} (
                {ciText("{{count}} eligible", { count: counts.total })})
              </button>,
            );
          }

          return selectionButtons;
        })()}

        {selectedInvoices.length > 0 && (
          <>
            <span className="text-sm text-gray-600 ml-auto">
              {selectedInvoices.length === 1
                ? ciText("{{count}} invoice selected", {
                    count: selectedInvoices.length,
                  })
                : ciText("{{count}} invoices selected", {
                    count: selectedInvoices.length,
                  })}
            </span>
            <Button
              size="sm"
              onClick={handleOpenProfessionalBulkPayment}
              disabled={bulkPaymentLoading}
            >
              <DollarSign size={14} />
              {bulkPaymentLoading
                ? ciText("Loading...")
                : ciText("Bulk Payment ({{count}})", {
                    count: selectedInvoices.length,
                  })}
            </Button>
          </>
        )}
      </div>
    ) : null;

  return (
    <EpcPage
      title={pageTitle}
      subtitle={pageSubtitle}
      action={
        <div className="flex flex-wrap items-center gap-3">
          {(isEInvoiceHubRoute ? eInvoiceHubTab : "invoices") !==
            "consolidated" && (
            <>
              <DateRangeComponent
                startDate={dateRangeStart}
                endDate={dateRangeEnd}
                onApply={handleDateRangeApply}
                onClear={handleDateRangeClear}
                placeholder={ciText("Filter by date range")}
              />
              <Button
                variant="secondary"
                onClick={handleExportExcel}
                disabled={loading}
                title={ciText("Export to Excel")}
              >
                <ExcelIcon size={15} />
                {loading ? "..." : ciText("Export")}
              </Button>
            </>
          )}
          {!isEInvoiceHubRoute && (
            <Button
              variant="secondary"
              onClick={() =>
                history.push(
                  "/customer-statement",
                  selectedBusinessFilter
                    ? { businessId: selectedBusinessFilter }
                    : undefined,
                )
              }
            >
              <FileText size={15} />
              {ciText("Customer Statement")}
            </Button>
          )}
          {canAdd &&
            (!isEInvoiceHubRoute || eInvoiceHubTab === "invoices") && (
              <Button onClick={() => history.push("/create-customer-invoice")}>
                <PlusIcon size={15} />
                {ciText("Create Invoice")}
              </Button>
            )}
        </div>
      }
    >
      {isEInvoiceHubRoute && (
        <nav
          className="mb-4 flex flex-wrap gap-1 border-b border-gray-200"
          aria-label={ciText("E-invoice and documents")}
        >
          {eInvoiceHubTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setEInvoiceHubTabAndUrl(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                eInvoiceHubTab === tab.id
                  ? "border-[var(--p-blue)] text-[var(--p-blue)]"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      )}

      {(!isEInvoiceHubRoute || eInvoiceHubTab === "invoices") && (
        <>
          <SummaryCards
            cards={summaryCardsData}
            columnsCount={4}
            loading={loading && invoices.length === 0}
          />

          <FilterBar
            subtitle={ciText("Narrow by business, customer or status.")}
            searchPlaceholder={
              isEInvoiceHubRoute && eInvoiceHubTab === "invoices"
                ? ciText("Search submitted e-invoices...")
                : ciText("Search invoices...")
            }
            searchValue={searchTerm}
            onSearchChange={(value) => {
              setSearchTerm(value);
              setCurrentPage(1);
            }}
            values={portalFilterValues}
            onChange={handlePortalFilterChange}
            onReset={clearAllFilters}
            filters={portalFilters}
          />

          <div className="flex flex-wrap items-end gap-3 mb-1">
            <div className="min-w-[180px]">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {ciText("Date Created")}
              </label>
              <CustomDatePicker
                value={selectedDateCreatedFilter}
                onChange={(val) => {
                  setSelectedDateCreatedFilter(val || "");
                  setCurrentPage(1);
                }}
                placeholder={ciText("Date Created")}
                clearable
              />
            </div>
          </div>

          {selectionToolbar}

          <Card>
            <CardHeader
              title={pageTitle}
              subtitle={
                loading
                  ? "Loading…"
                  : `${overallStats.totalInvoices || 0} total invoices`
              }
            />
            <PortalDataTable
              columns={invoiceColumns}
              rows={loading ? [] : filteredInvoices}
              rowKey="_id"
              emptyMessage={
                loading
                  ? "Loading invoices…"
                  : ciText("No invoices found.")
              }
            />
            {!loading && (overallStats.totalInvoices || 0) > 0 ? (
              <Pagination
                page={currentPage}
                pageSize={entriesPerPage}
                total={overallStats.totalInvoices || 0}
                itemLabel="invoices"
                onPageChange={setCurrentPage}
                onPageSizeChange={(perPage) => {
                  setEntriesPerPage(perPage);
                  setCurrentPage(1);
                }}
              />
            ) : null}
          </Card>

          {showStatementModal && (
            <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold">
                      {ciText("Customer Statement")}
                    </h2>
                    <button
                      onClick={closeStatementModal}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  <p className="text-gray-600 mb-6">
                    {ciText("Enter the details below to retrieve statements.")}
                  </p>

                  <div className="space-y-4">
                    {!isSingleAssignedBusiness() && (
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">
                          {ciText("Business")}
                        </label>
                        <div className="relative">
                          <select
                            className="w-full appearance-none px-4 py-2 pr-10 bg-gray-100 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
                            value={statementBusiness}
                            onChange={(e) =>
                              setStatementBusiness(e.target.value)
                            }
                          >
                            <option value="">{ciText("Select Business")}</option>
                            {businesses?.map((business) => (
                              <option key={business._id} value={business._id}>
                                {business.name}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-1 top-2.5 h-4 w-4 pointer-events-none" />
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        {ciText("Customer")}
                      </label>
                      <div className="relative">
                        <select
                          className="w-full appearance-none px-4 py-2 pr-10 bg-gray-100 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
                          value={statementCustomer}
                          onChange={(e) =>
                            setStatementCustomer(e.target.value)
                          }
                        >
                          <option value="">{ciText("Select Customer")}</option>
                          {customers?.map((customer) => (
                            <option key={customer._id} value={customer._id}>
                              {customer.basicInformation.customerDisplayName}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-1 top-2.5 h-4 w-4 pointer-events-none" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        Currency{" "}
                        <span className="text-gray-500 text-xs">
                          (Optional)
                        </span>
                      </label>
                      <div className="relative">
                        <select
                          className="w-full appearance-none px-4 py-2 pr-10 bg-gray-100 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
                          value={statementCurrency}
                          onChange={(e) =>
                            setStatementCurrency(e.target.value)
                          }
                          disabled={
                            !statementBusiness && !isSingleAssignedBusiness()
                          }
                        >
                          <option value="">{ciText("Select Currency")}</option>
                          {statementCurrencies?.map((currency) => (
                            <option key={currency._id} value={currency._id}>
                              {currency.symbol} - {currency.name}
                              {currency.is_base ? " (Base)" : ""}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-1 top-2.5 h-4 w-4 pointer-events-none" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        {ciText("Date From")}
                      </label>
                      <div className="relative">
                        <CustomDatePicker
                          type="text"
                          placeholder={ciText("DD-MM-YYYY")}
                          className="w-full px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
                          value={dateFrom}
                          onChange={(value) => setDateFrom(value)}
                        />
                        <Calendar className="absolute right-1 top-2.5 h-4 w-4 text-gray-400" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        {ciText("Date To")}
                      </label>
                      <div className="relative">
                        <CustomDatePicker
                          type="text"
                          placeholder={ciText("DD-MM-YYYY")}
                          className="w-full px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
                          value={dateTo}
                          onChange={(value) => setDateTo(value)}
                        />
                        <Calendar className="absolute right-1 top-2.5 h-4 w-4 text-gray-400" />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={handleRetrieveStatement}
                      disabled={loading}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-[var(--p-blue)] text-white font-medium rounded-lg hover:bg-[#9CBA33] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Download size={18} />
                      {loading
                        ? ciText("Generating...")
                        : ciText("PDF Statement")}
                    </button>
                    <button
                      onClick={handleRetrieveStatementCSV}
                      disabled={loading}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <FileSpreadsheet size={18} />
                      {loading ? ciText("Exporting...") : ciText("CSV Export")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {isEInvoiceHubRoute && eInvoiceHubTab === "consolidated" && (
        <div className="mb-8 w-full min-w-0 max-w-full">
          <ConsolidatedEInvoiceFromInvoicesPanel
            businesses={businesses}
            selectedBusinessFilter={selectedBusinessFilter}
            onBusinessChange={(value) => {
              setSelectedBusinessFilter(value);
              setCurrentPage(1);
            }}
            onConsolidationCreated={fetchInvoices}
          />
        </div>
      )}

      {eInvoiceActionConfirm && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 backdrop-blur-[2px] p-4 sm:p-6"
            onClick={() => setEInvoiceActionConfirm(null)}
            role="presentation"
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col border border-gray-200/90 ring-1 ring-black/[0.06]"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="e-invoice-confirm-title"
            >
              <div
                className="h-1 w-full bg-[var(--p-blue)] shrink-0"
                aria-hidden
              />
              <div className="px-6 pt-5 pb-1">
                <div className="flex items-start gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--p-blue)] text-white shadow-md shadow-[#0C2E5A]/30">
                    <Send size={22} strokeWidth={2} />
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--p-blue-dark)] mb-1">
                      {ciText("LHDN")}
                    </p>
                    <h3
                      id="e-invoice-confirm-title"
                      className="text-lg font-semibold text-p-black leading-snug"
                    >
                      {eInvoiceActionConfirm.action === "retry-lhdn"
                        ? "Resubmit this e-invoice?"
                        : "Submit e-invoice to LHDN?"}
                    </h3>
                    <p className="text-sm text-p-gray mt-2.5 leading-relaxed">
                      {eInvoiceActionConfirm.action === "retry-lhdn" ? (
                        <>
                          Invoice{" "}
                          <span className="font-semibold text-p-black">
                            {eInvoiceActionConfirm.invoice.invoice_number ||
                              "—"}
                          </span>{" "}
                          is currently{" "}
                          <span className="font-semibold text-p-black">
                            {eInvoiceActionConfirm.invoice.lhdn_status ||
                              "unknown"}
                          </span>
                          . We will set status to{" "}
                          <span className="font-semibold text-p-black">
                            {ciText("Pending")}
                          </span>{" "}
                          and send again to LHDN.
                        </>
                      ) : (
                        <>
                          Send invoice{" "}
                          <span className="font-semibold text-p-black">
                            {eInvoiceActionConfirm.invoice.invoice_number ||
                              "—"}
                          </span>{" "}
                          to LHDN as an e-invoice.
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-100 bg-p-gray-light/40 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEInvoiceActionConfirm(null)}
                  className="w-full sm:w-auto px-4 py-2.5 text-sm font-medium text-p-black bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:ring-offset-2 transition-colors"
                >
                  {ciText("Cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmEInvoiceAction}
                  className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-[var(--p-blue)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:ring-offset-2 shadow-sm border border-transparent ${
                    eInvoiceActionConfirm.action === "retry-lhdn"
                      ? "hover:bg-[var(--p-blue)] hover:border-transparent active:bg-[var(--p-blue)]"
                      : "hover:bg-[#9CBA33] transition-colors"
                  }`}
                >
                  <Send size={16} strokeWidth={2} />
                  {eInvoiceActionConfirm.action === "retry-lhdn"
                    ? "Resubmit to LHDN"
                    : "Submit to LHDN"}
                </button>
              </div>
            </div>
          </div>
        )}

        {eInvoiceApiResponseModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-5 py-3 border-b">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    E-Invoice API response
                  </h3>
                  <p className="text-xs text-gray-700 font-medium mt-0.5">
                    {eInvoiceApiResponseModal.title}
                    {eInvoiceApiResponseModal.invoiceNo
                      ? ` · Invoice ${eInvoiceApiResponseModal.invoiceNo}`
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
                            redactPasswordsForDisplay(
                              eInvoiceApiResponseModal.body,
                            ),
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
                    onClick={() => setEInvoiceApiResponseModal(null)}
                    className="p-1.5 text-gray-800 hover:bg-gray-100 rounded-lg"
                    title={ciText("Close")}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
              <div className="p-4 overflow-y-auto">
                <p className="text-xs text-gray-800 mb-2">
                  Full body from the backend:{" "}
                  <code className="text-gray-900 font-semibold">status</code>,{" "}
                  <code className="text-gray-900 font-semibold">message</code>,{" "}
                  <code className="text-gray-900 font-semibold">data</code>,{" "}
                  <code className="text-gray-900 font-semibold">link</code>.
                  Passwords are redacted in this view.
                </p>
                <pre className="text-xs font-mono bg-gray-50 border border-gray-200 rounded-lg p-3 whitespace-pre-wrap break-words text-gray-800">
                  {JSON.stringify(
                    redactPasswordsForDisplay(eInvoiceApiResponseModal.body),
                    null,
                    2,
                  )}
                </pre>
              </div>
              <div className="px-4 py-3 border-t bg-gray-50 flex justify-end">
                <button
                  type="button"
                  onClick={() => setEInvoiceApiResponseModal(null)}
                  className="px-4 py-2 text-sm font-medium text-p-black bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  {ciText("Close")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Payment Modal */}
        {showBulkPaymentModal && (
          <BulkPaymentRecordModal
            isOpen={showBulkPaymentModal}
            toggle={() => setShowBulkPaymentModal(false)}
            selectedInvoices={selectedInvoices.filter((inv) => inv && inv._id)}
            onPaymentComplete={handleBulkPaymentComplete}
          />
        )}

        {showProfessionalBulkPaymentModal && (
          <ProfessionalBulkPaymentModal
            isOpen={showProfessionalBulkPaymentModal}
            onClose={() => setShowProfessionalBulkPaymentModal(false)}
            selectedInvoices={selectedInvoices.filter((inv) => inv && inv._id)}
            onPaymentComplete={handleBulkPaymentComplete}
          />
        )}
        {confirmDeleteOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-[400px] max-w-[90%]">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                {ciText("Delete Customer Invoice")}
              </h2>
              <p className="text-sm text-gray-600 mb-6">
                {ciText(
                  "Are you sure you want to delete {{invoice}}? This action cannot be undone.",
                  {
                    invoice:
                      pendingDeleteInvoice?.invoiceNo ||
                      ciText("this invoice"),
                  },
                )}
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    if (loading) return;
                    setConfirmDeleteOpen(false);
                    setPendingDeleteInvoice(null);
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  {ciText("Cancel")}
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={confirmDeleteInvoice}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60"
                >
                  {loading ? ciText("Deleting...") : ciText("Delete")}
                </button>
              </div>
            </div>
          </div>
        )}
    </EpcPage>
  );
}
