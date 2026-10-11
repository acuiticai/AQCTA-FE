import React, {
  useState,
  useEffect,
  useContext,
  useMemo,
  useCallback,
} from "react";
import {
  Search,
  Filter,
  Download,
  Eye,
  Edit,
  Trash2,
  Plus,
  Calendar,
  ChevronDown,
  DollarSign,
  Package,
  Users,
  FileText,
  Building,
  Receipt,
  Clock,
  CreditCard,
  Info,
  X,
  FileSpreadsheet as ExcelIcon,
  Send,
} from "lucide-react";
import * as XLSX from "xlsx";
import { useHistory, useLocation } from "react-router-dom";
import axios from "axios";
import { AdminContext } from "@/context/AdminContext";
import { notifyError, notifySuccess } from "@/utils/toast";
import SearchableDropdown from "@/components/SearchableDropdown";
import { DataTable, SummaryCards } from "@/page-layouts/index";
import {
  formatDate,
  formatAmount,
  formatCurrencyAmount,
} from "@/components/formatAmount";
import DateRangePicker from "@/components/common/DateRangePicker";
import CompletedSvg from "@/assets/img/completed.svg";
import InProgressSvg from "@/assets/img/in-progress.svg";
import PendingApprovalSvg from "@/assets/img/pending-approval.svg";
import DelayedSvg from "@/assets/img/delayed.svg";
import SummarySvg from "@/assets/img/summary.svg";
import DollarSvg from "../../../assets/img/icons/stats-1.png";
import {
  useCreditDebitNoteLhdnActions,
  LhdnStatusBadge,
} from "@/pages/Accounts/CustomerInvoice/useCreditDebitNoteLhdnActions";
import { useRouteModulePermissions } from "@/utils/permissionUtils";
import { useEInvoiceEnabledMap } from "@/hooks/useBusinessEInvoiceEnabled";
import { useTranslation } from "react-i18next";
import {
  makeCreditNoteT,
  translateCreditNoteStatus,
  translateLhdnStatus,
} from "@/utils/creditDebitNoteI18n";
import { isSingleAssignedBusiness } from "@/utils/sessionAssignedBusinesses";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

export default function CreditNotes() {
  const { t } = useTranslation();
  const cn = makeCreditNoteT(t);
  const history = useHistory();
  const location = useLocation();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const routePerms = useRouteModulePermissions();
  const { canView, canViewDetails, canUpdate } = routePerms;
  const canViewNote = canView || canViewDetails;

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo?.token}`,
    }),
    [adminInfo?.token],
  );

  // State management
  const [selectedBusinessFilter, setSelectedBusinessFilter] = useState("");
  const [selectedEntityTypeFilter, setSelectedEntityTypeFilter] = useState("");
  const [selectedCustomerFilter, setSelectedCustomerFilter] = useState("");
  const [selectedVendorFilter, setSelectedVendorFilter] = useState("");
  const [selectedCreditNoteTypeFilter, setSelectedCreditNoteTypeFilter] =
    useState("All");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("All");
  const [selectedDateCreatedFilter, setSelectedDateCreatedFilter] =
    useState("");
  const [selectedDueDateFilter, setSelectedDueDateFilter] = useState("");
  const [dateRangeStart, setDateRangeStart] = useState("");
  const [dateRangeEnd, setDateRangeEnd] = useState("");
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLhdnStatusFilter, setSelectedLhdnStatusFilter] =
    useState("All");
  const [loading, setLoading] = useState(false);

  // Data states
  const [creditNotes, setCreditNotes] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [overallStats, setOverallStats] = useState({
    totalCreditNotes: 0,
    approveTransaction: 0,
    pendingApproval: 0,
    appliedToInvoice: 0,
    refundToClient: 0,
    totalValue: 0,
  });
  const assignedBusinessIds = useMemo(
    () => (businesses || []).map((b) => b?._id).filter(Boolean),
    [businesses],
  );
  const getEntityBusinessId = useCallback((entity) => {
    if (!entity || typeof entity !== "object") return "";
    return (
      entity.business?._id ||
      entity.business ||
      entity.businessId ||
      entity.business_id ||
      entity?.basicInformation?.business ||
      entity?.basicInformation?.businessId ||
      entity?.basicInformation?.business_id ||
      ""
    );
  }, []);
  const scopedCustomers = useMemo(() => {
    const allowed = new Set(
      (selectedBusinessFilter
        ? [selectedBusinessFilter]
        : assignedBusinessIds
      ).map((id) => String(id)),
    );
    if (allowed.size === 0) return [];
    return (customers || []).filter((c) =>
      allowed.has(String(getEntityBusinessId(c))),
    );
  }, [
    customers,
    assignedBusinessIds,
    selectedBusinessFilter,
    getEntityBusinessId,
  ]);
  const scopedVendors = useMemo(() => {
    const allowed = new Set(
      (selectedBusinessFilter
        ? [selectedBusinessFilter]
        : assignedBusinessIds
      ).map((id) => String(id)),
    );
    if (allowed.size === 0) return [];
    return (vendors || []).filter((v) =>
      allowed.has(String(getEntityBusinessId(v))),
    );
  }, [
    vendors,
    assignedBusinessIds,
    selectedBusinessFilter,
    getEntityBusinessId,
  ]);
  const shouldShowAllCustomersOption = scopedCustomers.length > 1;
  const shouldShowAllVendorsOption = scopedVendors.length > 1;

  const { eInvoiceByBusiness, loading: eInvoiceMapLoading } =
    useEInvoiceEnabledMap(assignedBusinessIds);
  const rowShowsLhdnForNote = useCallback(
    (note) => {
      if (note?.entityType !== "customer") return false;
      if (eInvoiceMapLoading) return false;
      const bid = note?.business?._id || note?.business;
      if (!bid) return false;
      return eInvoiceByBusiness[String(bid)] !== false;
    },
    [eInvoiceByBusiness, eInvoiceMapLoading],
  );

  const showLhdnColumn = useMemo(
    () =>
      assignedBusinessIds.length > 0 &&
      !eInvoiceMapLoading &&
      Object.values(eInvoiceByBusiness).some((v) => v !== false),
    [assignedBusinessIds.length, eInvoiceMapLoading, eInvoiceByBusiness],
  );

  const patchCreditNoteInList = useCallback((id, patch) => {
    setCreditNotes((prev) =>
      prev.map((c) => (c._id === id ? { ...c, ...patch } : c)),
    );
  }, []);

  const { renderLhdnActionButtons, LhdnModals } = useCreditDebitNoteLhdnActions(
    {
      variant: "credit",
      headers,
      canSubmitLhdn: canUpdate,
      patchNoteInList: patchCreditNoteInList,
    },
  );

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (q.get("einvRefund") !== "1") return;
    setSelectedEntityTypeFilter("customer");
    setSelectedCreditNoteTypeFilter("refund_to_client");
    history.replace("/credit-notes");
  }, [location.search, history]);

  useEffect(() => {
    fetchBusinesses();
    fetchCustomers();
    fetchVendors();
  }, []);

  useEffect(() => {
    fetchCreditNotes();
  }, [
    currentPage,
    entriesPerPage,
    selectedBusinessFilter,
    selectedEntityTypeFilter,
    selectedCustomerFilter,
    selectedVendorFilter,
    selectedCreditNoteTypeFilter,
    selectedStatusFilter,
    selectedLhdnStatusFilter,
    selectedDateCreatedFilter,
    selectedDueDateFilter,
    dateRangeStart,
    dateRangeEnd,
    searchTerm,
    businesses.length,
  ]);

  const fetchCreditNotes = async () => {
    setLoading(true);
    try {
      if (assignedBusinessIds.length === 0) {
        setCreditNotes([]);
        setTotalPages(1);
        setOverallStats({
          totalCreditNotes: 0,
          approveTransaction: 0,
          pendingApproval: 0,
          appliedToInvoice: 0,
          refundToClient: 0,
          totalValue: 0,
        });
        return;
      }
      const params = {
        page: currentPage,
        limit: entriesPerPage,
        ...(selectedBusinessFilter
          ? { business: selectedBusinessFilter }
          : { businessIds: assignedBusinessIds.join(",") }),
        ...(selectedEntityTypeFilter && {
          entityType: selectedEntityTypeFilter,
        }),
        ...(selectedCustomerFilter && {
          customer: selectedCustomerFilter,
        }),
        ...(selectedVendorFilter && {
          vendor: selectedVendorFilter,
        }),
        ...(selectedCreditNoteTypeFilter !== "All" && {
          creditNoteType: selectedCreditNoteTypeFilter,
        }),
        ...(selectedStatusFilter !== "All" && {
          status: selectedStatusFilter,
        }),
        // Prioritize date range picker over individual date filters
        ...(dateRangeStart && { dateFrom: dateRangeStart }),
        ...(dateRangeEnd && { dateTo: dateRangeEnd }),
        // Date Created filter - filters by createdAt
        ...(!dateRangeStart &&
          selectedDateCreatedFilter && {
            createdDateFrom: selectedDateCreatedFilter,
            createdDateTo: selectedDateCreatedFilter, // Same date for both start and end
          }),
        ...(selectedDueDateFilter && { dateTo: selectedDueDateFilter }),
        ...(searchTerm && { search: searchTerm }),
        ...(selectedLhdnStatusFilter !== "All" && {
          lhdnStatus: selectedLhdnStatusFilter,
        }),
      };

      const response = await axios.get(`${Base_URL}/credit-notes`, {
        params,
        headers,
      });

      if (response.data.success) {
        const visibleBusinessIds = new Set(
          (selectedBusinessFilter
            ? [selectedBusinessFilter]
            : assignedBusinessIds
          ).map((id) => String(id)),
        );
        const scopedRows = (response.data.data || []).filter((row) => {
          const bid = row?.business?._id || row?.business;
          if (!bid) return false;
          return visibleBusinessIds.has(String(bid));
        });
        setCreditNotes(scopedRows);
        setTotalPages(response.data.pagination.pages);
        setOverallStats(response.data.stats || {});
      }
    } catch (error) {
      console.error("Error fetching credit notes:", error);
      notifyError(cn("toasts.loadFailed", "Failed to load credit notes"));
    } finally {
      setLoading(false);
    }
  };

  const fetchBusinesses = async () => {
    try {
      const storedBusinesses = localStorage.getItem("businesses");
      if (storedBusinesses) {
        setBusinesses(JSON.parse(storedBusinesses));
      }
    } catch (error) {
      console.error("Error fetching businesses:", error);
    }
  };

  useEffect(() => {
    if (businesses.length === 1) {
      const onlyBusinessId = businesses[0]?._id;
      if (onlyBusinessId && selectedBusinessFilter !== onlyBusinessId) {
        setSelectedBusinessFilter(onlyBusinessId);
        setCurrentPage(1);
      }
    }
  }, [businesses, selectedBusinessFilter]);

  useEffect(() => {
    if (
      selectedCustomerFilter &&
      !scopedCustomers.some(
        (c) => String(c?._id) === String(selectedCustomerFilter),
      )
    ) {
      setSelectedCustomerFilter("");
    }
  }, [scopedCustomers, selectedCustomerFilter]);

  useEffect(() => {
    if (
      selectedVendorFilter &&
      !scopedVendors.some(
        (v) => String(v?._id) === String(selectedVendorFilter),
      )
    ) {
      setSelectedVendorFilter("");
    }
  }, [scopedVendors, selectedVendorFilter]);

  const fetchCustomers = async () => {
    try {
      const response = await axios.get(`${Base_URL}/customers`, { headers });
      setCustomers(response.data.customers || response.data.data || []);
    } catch (error) {
      console.error("Error fetching customers:", error);
    }
  };

  const fetchVendors = async () => {
    try {
      const response = await axios.get(`${Base_URL}/vendors`, { headers });
      setVendors(response.data.vendors || response.data.data || []);
    } catch (error) {
      console.error("Error fetching vendors:", error);
    }
  };

  const handleDateRangeApply = (startDate, endDate) => {
    setDateRangeStart(startDate);
    setDateRangeEnd(endDate);
    // Clear individual date filters when date range is applied
    setSelectedDateCreatedFilter("");
    setSelectedDueDateFilter("");
    setCurrentPage(1); // Reset to first page when filter changes
  };

  const handleDateRangeClear = () => {
    setDateRangeStart("");
    setDateRangeEnd("");
    setCurrentPage(1);
  };

  const getStatusColor = (status) => {
    const colors = {
      Draft: "bg-gray-100 text-gray-800",
      Created: "bg-blue-100 text-blue-800",
      "Approved by Management": "bg-green-100 text-green-800",
      "Make Transaction": "bg-yellow-100 text-yellow-800",
      "Approve Transaction": "bg-purple-100 text-purple-800",
      "Applied to Invoice": "bg-indigo-100 text-indigo-800",
      Cancelled: "bg-red-100 text-red-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const getCreditNoteTypeColor = (type) => {
    const colors = {
      apply_to_invoice: "bg-blue-100 text-blue-800",
      refund_to_client: "bg-green-100 text-green-800",
    };
    return colors[type] || "bg-gray-100 text-gray-800";
  };

  const getCreditNoteTypeLabel = (type, entityType) => {
    if (type === "apply_to_invoice") {
      return cn("types.applyToInvoice", "Apply to Invoice");
    }
    if (type === "refund_to_client") {
      return entityType === "customer"
        ? cn("types.refundToClient", "Refund to Client")
        : cn("types.refundToVendor", "Refund to Vendor");
    }
    return type;
  };

  const handleOpenFile = async (documentId) => {
    if (!documentId) return;
    try {
      const response = await axios.get(
        `${Base_URL}/documents/getFileWithAllData/${documentId}`,
      );
      window.open(response.data.data.url, "_blank");
    } catch (error) {
      notifyError(cn("toasts.openFileFailed", "Error opening file"));
      console.error("Error: ", error);
    }
  };

  const handleEdit = (id) => {
    history.push(`/update-credit-note/${id}`);
  };

  const handleView = (id) => {
    history.push(`/view-credit-note/${id}`);
  };

  const handleDelete = async (id) => {
    if (
      !window.confirm(
        cn(
          "list.confirmDelete",
          "Are you sure you want to delete this credit note?",
        ),
      )
    ) {
      return;
    }

    try {
      const response = await axios.delete(`${Base_URL}/credit-notes/${id}`, {
        headers,
      });

      if (response.data.success) {
        notifySuccess(
          cn("toasts.deleteSuccess", "Credit note deleted successfully"),
        );
        fetchCreditNotes();
      }
    } catch (error) {
      console.error("Error deleting credit note:", error);
      notifyError(
        error.response?.data?.error ||
          cn("toasts.deleteFailed", "Failed to delete credit note"),
      );
    }
  };

  const handleExportExcel = async () => {
    try {
      setLoading(true);

      // Fetch all credit notes with current filters
      const params = {
        businessId: selectedBusinessFilter || undefined,
        entityType: selectedEntityTypeFilter || undefined,
        customerId: selectedCustomerFilter || undefined,
        vendorId: selectedVendorFilter || undefined,
        creditNoteType:
          selectedCreditNoteTypeFilter !== "All"
            ? selectedCreditNoteTypeFilter
            : undefined,
        status:
          selectedStatusFilter !== "All" ? selectedStatusFilter : undefined,
        search: searchTerm,
        page: 1,
        limit: 999999, // Get all records
        // Prioritize date range picker over individual date filters
        ...(dateRangeStart && { dateFrom: dateRangeStart }),
        ...(dateRangeEnd && { dateTo: dateRangeEnd }),
        // Date Created filter - filters by createdAt
        ...(!dateRangeStart &&
          selectedDateCreatedFilter && {
            createdDateFrom: selectedDateCreatedFilter,
            createdDateTo: selectedDateCreatedFilter,
          }),
        ...(selectedDueDateFilter && { dateTo: selectedDueDateFilter }),
      };

      // Remove undefined values
      Object.keys(params).forEach(
        (key) => params[key] === undefined && delete params[key],
      );

      const response = await axios.get(`${Base_URL}/credit-notes`, {
        params,
        headers,
      });

      const allCreditNotes = response.data.data || [];

      if (allCreditNotes.length === 0) {
        notifyError(
          cn("toasts.exportNoData", "No credit notes found to export"),
        );
        return;
      }

      const colCreditNoteNumber = cn(
        "export.creditNoteNumber",
        "Credit Note Number",
      );
      const colEntityType = cn("export.entityType", "Entity Type");
      const colCustomerName = cn("export.customerName", "Customer Name");
      const colVendorName = cn("export.vendorName", "Vendor Name");
      const colCreditNoteType = cn("export.creditNoteType", "Credit Note Type");
      const colCreditNoteDate = cn("export.creditNoteDate", "Credit Note Date");
      const colDueDate = cn("export.dueDate", "Due Date");
      const colStatus = cn("export.status", "Status");
      const colDiscount = cn("export.discount", "Discount");
      const colTotal = cn("export.total", "Total");
      const colCurrency = cn("export.currency", "Currency");
      const colExpenseAccount = cn("export.expenseAccount", "Expense Account");
      const colNotes = cn("export.notes", "Notes");
      const colCreatedAt = cn("export.createdAt", "Created At");
      const colUpdatedAt = cn("export.updatedAt", "Updated At");

      const emptyExportCols = {
        [colEntityType]: "",
        [colCustomerName]: "",
        [colVendorName]: "",
        [colCreditNoteType]: "",
        [colCreditNoteDate]: "",
        [colDueDate]: "",
        [colStatus]: "",
        [colDiscount]: "",
        [colTotal]: "",
        [colCurrency]: "",
        [colExpenseAccount]: "",
        [colNotes]: "",
        [colCreatedAt]: "",
        [colUpdatedAt]: "",
      };

      // Prepare Excel data
      const exportData = allCreditNotes.map((creditNote) => ({
        [colCreditNoteNumber]: creditNote.creditNoteNumber || "",
        [colEntityType]: creditNote.entityType || "",
        [colCustomerName]:
          creditNote.customer?.basicInformation?.customerDisplayName || "",
        [colVendorName]:
          creditNote.vendor?.basicInformation?.vendorDisplayName || "",
        [colCreditNoteType]:
          getCreditNoteTypeLabel(
            creditNote.creditNoteType,
            creditNote.entityType,
          ) || "",
        [colCreditNoteDate]: creditNote.creditNoteDate
          ? formatDate(creditNote.creditNoteDate)
          : "",
        [colDueDate]: creditNote.dueDate ? formatDate(creditNote.dueDate) : "",
        [colStatus]: translateCreditNoteStatus(t, creditNote.status) || "",
        [colDiscount]: creditNote.discountAmount || 0,
        [colTotal]: creditNote.total || 0,
        [colCurrency]: creditNote.currency || "USD",
        [colExpenseAccount]: creditNote.expenseAccount?.code
          ? `${creditNote.expenseAccount.code} - ${creditNote.expenseAccount.accountName}`
          : creditNote.expenseAccount?.accountName || "",
        [colNotes]: creditNote.notes || "",
        [colCreatedAt]: creditNote.createdAt
          ? formatDate(creditNote.createdAt)
          : "",
        [colUpdatedAt]: creditNote.updatedAt
          ? formatDate(creditNote.updatedAt)
          : "",
      }));

      // Create summary rows
      const summaryRows = [
        {
          [colCreditNoteNumber]: cn(
            "export.reportTitle",
            "Credit Notes Report",
          ),
          ...emptyExportCols,
        },
        {
          [colCreditNoteNumber]: cn(
            "export.generatedOn",
            "Generated on: {{date}}",
            { date: formatDate(new Date()) },
          ),
          ...emptyExportCols,
        },
        {
          [colCreditNoteNumber]: cn(
            "export.totalCreditNotesCount",
            "Total Credit Notes: {{count}}",
            { count: allCreditNotes.length },
          ),
          ...emptyExportCols,
        },
        {
          [colCreditNoteNumber]: cn(
            "export.totalValueAmount",
            "Total Value: {{amount}}",
            {
              amount: formatAmount(
                allCreditNotes.reduce(
                  (sum, note) => sum + (note.grandTotal || 0),
                  0,
                ),
              ),
            },
          ),
          ...emptyExportCols,
        },
        {
          [colCreditNoteNumber]: "",
          ...emptyExportCols,
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
      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        cn("export.sheetName", "Credit Notes"),
      );

      // Generate filename
      const filename = `Credit_Notes_${
        new Date().toISOString().split("T")[0]
      }.xlsx`;

      // Download file
      XLSX.writeFile(workbook, filename);

      notifySuccess(
        cn(
          "toasts.exportSuccess",
          "Credit notes exported to Excel successfully!",
        ),
      );
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      notifyError(
        cn(
          "toasts.exportFailed",
          "Failed to export credit notes to Excel. Please try again.",
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  // Clear all filters
  const clearAllFilters = () => {
    setSelectedBusinessFilter("");
    setSelectedEntityTypeFilter("");
    setSelectedCustomerFilter("");
    setSelectedVendorFilter("");
    setSelectedCreditNoteTypeFilter("All");
    setSelectedStatusFilter("All");
    setSelectedDateCreatedFilter("");
    setSelectedDueDateFilter("");
    setDateRangeStart("");
    setDateRangeEnd("");
    setSearchTerm("");
    setSelectedLhdnStatusFilter("All");
    setCurrentPage(1);
  };

  // State for documents modal
  const [showDocumentsModal, setShowDocumentsModal] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState([]);

  const handleViewDocuments = (documents) => {
    if (documents && documents.length > 0) {
      setSelectedDocuments(documents);
      setShowDocumentsModal(true);
    }
  };

  // Filter configuration
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
            label: cn("business", "Business"),
            value: selectedBusinessFilter,
            onChange: setSelectedBusinessFilter,
            options: [
              ...businesses.map((b) => ({
                value: b._id,
                label: b.name,
              })),
            ],
            placeholder: cn("selectBusiness", "Select Business"),
            icon: Building,
          },
        ]
      : []),
    {
      label: cn("entityType", "Entity Type"),
      value: selectedEntityTypeFilter,
      onChange: setSelectedEntityTypeFilter,
      options: [
        { value: "customer", label: cn("customer", "Customer") },
        { value: "vendor", label: cn("vendor", "Vendor") },
      ],
      placeholder: cn("entityType", "Entity Type"),
      icon: Users,
    },
    {
      label: cn("customer", "Customer"),
      value: selectedCustomerFilter,
      onChange: setSelectedCustomerFilter,
      options: [
        ...(shouldShowAllCustomersOption
          ? [{ value: "", label: cn("allCustomers", "All Customers") }]
          : []),
        ...scopedCustomers.map((c) => ({
          value: c._id,
          label: `${c.basicInformation?.primaryContact?.firstName} ${c.basicInformation?.primaryContact?.lastName}`,
        })),
      ],
      placeholder: cn("customer", "Customer"),
      icon: Users,
      show:
        !selectedEntityTypeFilter || selectedEntityTypeFilter === "customer",
    },
    {
      label: cn("vendor", "Vendor"),
      value: selectedVendorFilter,
      onChange: setSelectedVendorFilter,
      options: [
        ...(shouldShowAllVendorsOption
          ? [{ value: "", label: cn("allVendors", "All Vendors") }]
          : []),
        ...scopedVendors.map((v) => ({
          value: v._id,
          label:
            v.basicInformation?.vendorDisplayName ||
            v.basicInformation?.companyName,
        })),
      ],
      placeholder: cn("vendor", "Vendor"),
      icon: Building,
      show: !selectedEntityTypeFilter || selectedEntityTypeFilter === "vendor",
    },
    {
      label: cn("creditNoteType", "Credit Note Type"),
      value: selectedCreditNoteTypeFilter,
      onChange: (value) =>
        setSelectedCreditNoteTypeFilter(
          value == null || value === "" ? "All" : value,
        ),
      options: [
        { value: "All", label: cn("allTypes", "All Types") },
        {
          value: "apply_to_invoice",
          label: cn("types.applyToInvoice", "Apply to Invoice"),
        },
        {
          value: "refund_to_client",
          label: cn("types.refundToClient", "Refund to Client"),
        },
      ],
      placeholder: cn("typeAll", "Type: All"),
      icon: CreditCard,
    },
    {
      label: cn("status", "Status"),
      value: selectedStatusFilter,
      onChange: (value) =>
        setSelectedStatusFilter(value == null || value === "" ? "All" : value),
      options: [
        { value: "All", label: cn("allStatus", "All Status") },
        { value: "Draft", label: translateCreditNoteStatus(t, "Draft") },
        { value: "Created", label: translateCreditNoteStatus(t, "Created") },
        {
          value: "Approved by Management",
          label: translateCreditNoteStatus(t, "Approved by Management"),
        },
        {
          value: "Make Transaction",
          label: translateCreditNoteStatus(t, "Make Transaction"),
        },
        {
          value: "Approve Transaction",
          label: translateCreditNoteStatus(t, "Approve Transaction"),
        },
        {
          value: "Applied to Invoice",
          label: translateCreditNoteStatus(t, "Applied to Invoice"),
        },
        {
          value: "Cancelled",
          label: translateCreditNoteStatus(t, "Cancelled"),
        },
      ],
      placeholder: cn("statusAll", "Status: All"),
      icon: FileText,
    },
    ...(showLhdnColumn
      ? [
          {
            label: cn("lhdnStatus", "LHDN Status"),
            value: selectedLhdnStatusFilter,
            onChange: (value) => {
              setSelectedLhdnStatusFilter(
                value == null || value === "" ? "All" : value,
              );
              setCurrentPage(1);
            },
            options: [
              {
                value: "All",
                label: cn("allLhdnStatuses", "All LHDN Statuses"),
              },
              {
                value: "Pending",
                label: translateLhdnStatus(t, "Pending"),
              },
              {
                value: "Submitted",
                label: translateLhdnStatus(t, "Submitted"),
              },
              { value: "Valid", label: translateLhdnStatus(t, "Valid") },
              { value: "Invalid", label: translateLhdnStatus(t, "Invalid") },
              {
                value: "Rejected",
                label: translateLhdnStatus(t, "Rejected"),
              },
              {
                value: "Cancelled",
                label: translateLhdnStatus(t, "Cancelled"),
              },
            ],
            placeholder: cn("lhdnStatusAll", "LHDN Status: All"),
            icon: Send,
          },
        ]
      : []),
    {
      label: cn("dateCreated", "Date Created"),
      value: selectedDateCreatedFilter,
      onChange: (val) => {
        setSelectedDateCreatedFilter(val);
        // Clear date range picker when individual date filter is set
        if (val) {
          setDateRangeStart("");
          setDateRangeEnd("");
        }
        setCurrentPage(1); // Reset to first page when date filter changes
      },
      isDatePicker: true,
      placeholder: cn("dateCreated", "Date Created"),
      icon: Calendar,
    },
  ];

  useEffect(() => {
    if (!showLhdnColumn) setSelectedLhdnStatusFilter("All");
  }, [showLhdnColumn]);

  const creditNoteNoHeader = cn("headers.creditNoteNo", "Credit Note No");
  const entityHeader = cn("headers.entity", "Entity");
  const typeAndStatusHeader = cn("headers.typeAndStatus", "Type & Status");
  const datesHeader = cn("headers.dates", "Dates");
  const amountHeader = cn("headers.amount", "Amount");
  const expenseAccountHeader = cn("headers.expenseAccount", "Expense Account");
  const documentsHeader = cn("headers.documents", "Documents");
  const lhdnHeader = cn("headers.lhdn", "LHDN");
  const actionsHeader = cn("headers.actions", "Actions");

  const creditNotesTableHeaders = useMemo(() => {
    const base = [
      creditNoteNoHeader,
      entityHeader,
      typeAndStatusHeader,
      datesHeader,
      amountHeader,
      expenseAccountHeader,
      documentsHeader,
    ];
    if (showLhdnColumn) base.push(lhdnHeader);
    base.push(actionsHeader);
    return base;
  }, [
    showLhdnColumn,
    creditNoteNoHeader,
    entityHeader,
    typeAndStatusHeader,
    datesHeader,
    amountHeader,
    expenseAccountHeader,
    documentsHeader,
    lhdnHeader,
    actionsHeader,
  ]);

  // Summary cards data
  const summaryCardsData = [
    {
      title: cn("totalCreditNotes", "Total Credit Notes"),
      value: overallStats.totalCreditNotes || 0,
      backgroundColor: "summary-light",
      iconColor: "summary-dark",
      Icon: SummarySvg,
    },
    {
      title: cn("approveTransaction", "Approve Transaction"),
      value: overallStats.approveTransaction || 0,
      backgroundColor: "completed-light",
      iconColor: "completed-dark",
      Icon: CompletedSvg,
    },
    {
      title: cn("pendingApproval", "Pending Approval"),
      value: overallStats.pendingApproval || 0,
      backgroundColor: "processing-light",
      iconColor: "processing-dark",
      Icon: InProgressSvg,
    },
    {
      title: cn("appliedToInvoice", "Applied to Invoice"),
      value: overallStats.appliedToInvoice || 0,
      backgroundColor: "completed-light",
      iconColor: "completed-dark",
      Icon: PendingApprovalSvg,
    },
    {
      title: cn("refundToClient", "Refund to Client"),
      value: overallStats.refundToClient || 0,
      backgroundColor: "processing-light",
      iconColor: "processing-dark",
      Icon: DelayedSvg,
    },
    {
      title: cn("totalValue", "Total Value"),
      value: `$${formatAmount(overallStats.totalValue || 0)}`,
      backgroundColor: "completed-light",
      iconColor: "overdue-dark",
      Icon: DollarSvg,
    },
  ];

  return (
    <div className="bg-gray-50 min-h-screen w-full max-w-full overflow-x-hidden">
      <div className="w-full max-w-full mx-auto px-6 py-8 min-w-0 overflow-x-hidden">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {cn("title", "Credit Notes")}
              </h1>
              <p className="text-gray-600 mt-2">
                {cn("subtitle", "Manage and track all credit notes")}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <DateRangePicker
                startDate={dateRangeStart}
                endDate={dateRangeEnd}
                onApply={handleDateRangeApply}
                onClear={handleDateRangeClear}
                placeholder={cn("filterByDateRange", "Filter by date range")}
                className="flex-shrink-0"
              />
              <button
                onClick={handleExportExcel}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ExcelIcon size={18} />
                {loading
                  ? cn("exporting", "Exporting...")
                  : cn("exportToExcel", "Export to Excel")}
              </button>
              <button
                className="flex items-center gap-2 px-6 py-3 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[#9CBA33] transition-colors shadow-sm"
                onClick={() => history.push("/create-credit-note")}
              >
                <Plus size={20} />
                {cn("createCreditNote", "Create Credit Note")}
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <SummaryCards cards={summaryCardsData} columnsCount={6} />

        {/* Main Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8 min-w-0 max-w-full">
          <DataTable
            filters={filters}
            headersWithoutCellTooltip={[amountHeader]}
            colWidths={{
              [creditNoteNoHeader]: "180px",
              [entityHeader]: "260px",
              [typeAndStatusHeader]: "190px",
              [datesHeader]: "220px",
              [amountHeader]: "20%",
              [expenseAccountHeader]: "240px",
              [documentsHeader]: "180px",
              [lhdnHeader]: "140px",
              [actionsHeader]: "200px",
            }}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(page) => setCurrentPage(page)}
            recordsPerPage={entriesPerPage}
            onRecordsPerPageChange={(num) => {
              setEntriesPerPage(num);
              setCurrentPage(1);
            }}
            searchValue={searchTerm}
            onSearch={(val) => {
              setSearchTerm(val);
              setCurrentPage(1);
            }}
            searchPlaceholder={cn("search", "Search")}
            headers={creditNotesTableHeaders}
            data={creditNotes}
            loading={loading}
            renderRow={(creditNote) => (
              <tr
                key={creditNote._id}
                className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
              >
                {/* Credit Note Details */}
                <td className="py-4 px-4">
                  <div>
                    <p className="font-semibold text-gray-900">
                      #{creditNote.creditNoteNumber}
                    </p>
                    {creditNote.reference && (
                      <p className="text-sm text-gray-500">
                        {cn("list.ref", "Ref: {{reference}}", {
                          reference: creditNote.reference,
                        })}
                      </p>
                    )}
                  </div>
                </td>
                {/* Entity */}
                <td className="py-4 px-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      {creditNote.entityType === "customer" ? (
                        <Users size={16} className="text-gray-600" />
                      ) : (
                        <Building size={16} className="text-gray-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 truncate">
                        {creditNote.entityType === "customer" ? (
                          <>
                            {creditNote.customer?.basicInformation?.companyName}{" "}
                            (
                            {
                              creditNote.customer?.basicInformation
                                ?.primaryContact?.firstName
                            }{" "}
                            {
                              creditNote.customer?.basicInformation
                                ?.primaryContact?.lastName
                            }
                            )
                          </>
                        ) : (
                          creditNote.vendor?.basicInformation?.companyName ||
                          creditNote.vendor?.basicInformation
                            ?.vendorDisplayName ||
                          creditNote.vendor?.basicInformation?.companyName
                        )}
                      </p>
                      <p className="text-sm text-gray-500">
                        {creditNote.entityType === "customer"
                          ? cn("customer", "Customer")
                          : cn("vendor", "Vendor")}
                      </p>
                    </div>
                  </div>
                </td>
                {/* Type & Status */}
                <td className="py-4 px-4">
                  <div className="space-y-2">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getCreditNoteTypeColor(
                        creditNote.creditNoteType,
                      )}`}
                    >
                      {getCreditNoteTypeLabel(
                        creditNote.creditNoteType,
                        creditNote.entityType,
                      )}
                    </span>
                    <br />
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                        creditNote.status,
                      )}`}
                    >
                      {translateCreditNoteStatus(t, creditNote.status)}
                    </span>
                  </div>
                </td>
                {/* Dates */}
                <td className="py-4 px-4">
                  <div className="space-y-1">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {formatDate(creditNote.creditNoteDate)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {cn("list.creditNoteDate", "Credit Note Date")}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">
                        {formatDate(creditNote.dueDate)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {cn("list.dueDate", "Due Date")}
                      </p>
                    </div>
                  </div>
                </td>
                {/* Amount */}
                <td className="py-4 px-2 text-left">
                  <div className="text-left">
                    <p className="text-base font-bold text-gray-900 whitespace-nowrap">
                      {formatCurrencyAmount(
                        creditNote.currency,
                        creditNote.total,
                      )}
                    </p>
                    {creditNote.items?.length > 0 && (
                      <p className="text-xs text-gray-500">
                        {cn("list.itemCount", "{{count}} item", {
                          count: creditNote.items.length,
                        })}
                      </p>
                    )}
                  </div>
                </td>
                {/* Expense Account */}
                <td className="py-4 px-4">
                  <div>
                    {creditNote.expenseAccount ? (
                      <div>
                        <p className="font-medium text-gray-900">
                          {creditNote.expenseAccount.code ||
                            cn("list.na", "N/A")}{" "}
                          -{" "}
                          {creditNote.expenseAccount.accountName ||
                            cn("list.unknownAccount", "Unknown Account")}
                        </p>
                        <p className="text-xs text-gray-500">
                          {creditNote.expenseAccount.accountType?.name ||
                            creditNote.expenseAccount.accountType
                              ?.accountHeader ||
                            ""}
                        </p>
                      </div>
                    ) : (
                      <span className="text-gray-400 italic">
                        {cn("list.noAccountSpecified", "No account specified")}
                      </span>
                    )}
                  </div>
                </td>
                {/* Documents */}
                <td className="py-4 px-4">
                  <div className="flex items-center gap-2">
                    {creditNote.documents?.length > 0 ? (
                      <>
                        <div className="flex items-center gap-1">
                          <FileText
                            size={16}
                            className="text-[var(--p-blue)]"
                          />
                          <span className="text-sm text-gray-600">
                            {cn("list.fileCount", "{{count}} file", {
                              count: creditNote.documents.length,
                            })}
                          </span>
                        </div>
                        <button
                          onClick={() =>
                            handleViewDocuments(creditNote.documents)
                          }
                          className="text-[var(--p-blue)] hover:text-[#9CBA33] p-1"
                          title={cn("actions.viewDocuments", "View Documents")}
                        >
                          <Eye size={16} />
                        </button>
                      </>
                    ) : (
                      <span className="text-sm text-gray-400">
                        {cn("list.noDocuments", "No documents")}
                      </span>
                    )}
                  </div>
                </td>
                {showLhdnColumn && (
                  <td className="py-4 px-4 align-middle">
                    {rowShowsLhdnForNote(creditNote) ? (
                      <LhdnStatusBadge status={creditNote.lhdn_status} />
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </td>
                )}
                {/* Actions */}
                <td className="py-4 px-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    {renderLhdnActionButtons(
                      creditNote,
                      rowShowsLhdnForNote(creditNote),
                    )}
                    <button
                      onClick={() => handleView(creditNote._id)}
                      className="text-blue-600 hover:text-blue-800 p-1"
                      title={cn("actions.view", "View")}
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => handleEdit(creditNote._id)}
                      className="text-green-600 hover:text-green-800 p-1"
                      title={cn("actions.edit", "Edit")}
                    >
                      <Edit size={16} />
                    </button>
                    {(creditNote.status === "Draft" ||
                      creditNote.status === "Cancelled") && (
                      <button
                        onClick={() => handleDelete(creditNote._id)}
                        className="text-red-600 hover:text-red-800 p-1"
                        title={cn("actions.delete", "Delete")}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          />
        </div>
      </div>

      <LhdnModals />

      {showDocumentsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-900">
                {cn(
                  "list.supportingDocuments",
                  "Supporting Documents ({{count}})",
                  { count: selectedDocuments.length },
                )}
              </h2>
              <button
                onClick={() => {
                  setShowDocumentsModal(false);
                  setSelectedDocuments([]);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>
            <div className="overflow-y-auto p-6 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedDocuments.map((doc, idx) => (
                  <div
                    key={idx}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start gap-3">
                      <FileText className="h-8 w-8 text-[var(--p-blue)] flex-shrink-0 mt-1" />
                      <div className="flex-1 min-w-0">
                        <h3
                          className="font-medium text-gray-900 truncate"
                          title={doc.name}
                        >
                          {doc.name}
                        </h3>
                        {doc.description && (
                          <p className="text-sm text-gray-500 mt-1">
                            {doc.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                          {doc.uploadedAt && (
                            <span>
                              {cn("list.uploaded", "Uploaded: {{date}}", {
                                date: formatDate(doc.uploadedAt),
                              })}
                            </span>
                          )}
                          {doc.size && (
                            <span>
                              {cn("list.sizeMb", "Size: {{size}} MB", {
                                size: (doc.size / 1024 / 1024).toFixed(2),
                              })}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => handleOpenFile(doc.fileId)}
                            className="px-3 py-1.5 bg-[var(--p-blue)] text-white rounded-md text-sm hover:bg-[#9CBA33] transition-colors flex items-center gap-1"
                          >
                            <Eye size={14} />
                            {cn("actions.view", "View")}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
