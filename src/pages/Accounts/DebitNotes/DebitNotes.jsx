import React, { useState, useEffect, useContext, useMemo, useCallback } from "react";
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
  User,
  Info,
  X,
  FileSpreadsheet as ExcelIcon,
  Send,
} from "lucide-react";
import * as XLSX from "xlsx";
import { useHistory } from "react-router-dom";
import axios from "axios";
import { AdminContext } from "@/context/AdminContext";
import { notifyError, notifySuccess } from "@/utils/toast";
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
import CustomerEInvoiceCreditDebitList from "@/pages/Accounts/CustomerInvoice/CustomerEInvoiceCreditDebitList";
import {
  LhdnStatusBadge,
  useCreditDebitNoteLhdnActions,
} from "@/pages/Accounts/CustomerInvoice/useCreditDebitNoteLhdnActions";
import { useRouteModulePermissions } from "@/utils/permissionUtils";
import { useEInvoiceEnabledMap } from "@/hooks/useBusinessEInvoiceEnabled";
import { useTranslation } from "react-i18next";
import {
  makeDebitNoteT,
  translateDebitNoteStatus,
  translateLhdnStatus,
} from "@/utils/creditDebitNoteI18n";
import { isSingleAssignedBusiness } from "@/utils/sessionAssignedBusinesses";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

export default function DebitNotes() {
  const { t } = useTranslation();
  const dn = useMemo(() => makeDebitNoteT(t), [t]);
  const history = useHistory();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const routePerms = useRouteModulePermissions();
  const { canView, canViewDetails, canUpdate } = routePerms;
  const canViewNote = canView || canViewDetails;

  // State management
  const [selectedBusinessFilter, setSelectedBusinessFilter] = useState("");
  const [selectedEntityTypeFilter, setSelectedEntityTypeFilter] =
    useState("");
  const [selectedVendorFilter, setSelectedVendorFilter] = useState("");
  const [selectedCustomerFilter, setSelectedCustomerFilter] = useState("");
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
  const [debitNotes, setDebitNotes] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [overallStats, setOverallStats] = useState({
    totalDebitNotes: 0,
    approvedByManagement: 0,
    pendingApproval: 0,
    settled: 0,
    cancelled: 0,
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
  }, [customers, assignedBusinessIds, selectedBusinessFilter, getEntityBusinessId]);
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
  }, [vendors, assignedBusinessIds, selectedBusinessFilter, getEntityBusinessId]);
  const shouldShowAllCustomersOption = scopedCustomers.length > 1;
  const shouldShowAllVendorsOption = scopedVendors.length > 1;

  const { eInvoiceByBusiness } = useEInvoiceEnabledMap(assignedBusinessIds);
  const anyAssignedBusinessHasEInvoice = useMemo(
    () =>
      assignedBusinessIds.some(
        (id) => eInvoiceByBusiness[String(id)] !== false,
      ),
    [assignedBusinessIds, eInvoiceByBusiness],
  );

  const rowShowsLhdnForNote = useCallback(
    (note) => {
      const bid = note?.business?._id || note?.business;
      if (!bid) return anyAssignedBusinessHasEInvoice;
      const v = eInvoiceByBusiness[String(bid)];
      if (v === false) return false;
      if (v === true) return true;
      return anyAssignedBusinessHasEInvoice;
    },
    [anyAssignedBusinessHasEInvoice, eInvoiceByBusiness],
  );

  // Keep a single consistent filter/table experience for debit notes.
  // Customer selection should filter results, not switch to a reduced filter set.
  const showCustomerMyInvoisTable = false;

  const myInvoisListKey = `debit-${selectedBusinessFilter}`;

  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo.token}`,
  };

  useEffect(() => {
    fetchBusinesses();
    fetchVendors();
    fetchCustomers();
  }, []);

  useEffect(() => {
    fetchDebitNotes();
  }, [
    currentPage,
    entriesPerPage,
    selectedBusinessFilter,
    selectedEntityTypeFilter,
    selectedVendorFilter,
    selectedCustomerFilter,
    selectedStatusFilter,
    selectedDateCreatedFilter,
    selectedDueDateFilter,
    dateRangeStart,
    dateRangeEnd,
    searchTerm,
    businesses.length,
  ]);

  const fetchDebitNotes = async () => {
    setLoading(true);
    try {
      if (assignedBusinessIds.length === 0) {
        setDebitNotes([]);
        setTotalPages(1);
        setOverallStats({
          totalDebitNotes: 0,
          approvedByManagement: 0,
          pendingApproval: 0,
          settled: 0,
          cancelled: 0,
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
        ...(selectedVendorFilter && {
          vendor: selectedVendorFilter,
        }),
        ...(selectedCustomerFilter && {
          customer: selectedCustomerFilter,
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
      };

      console.log("🔍 Debit Notes API Request params:", params);

      const response = await axios.get(`${Base_URL}/debit-notes`, {
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
        setDebitNotes(scopedRows);
        setTotalPages(response.data.pagination.pages);
        console.log("🔍 Debit Notes search results:", {
          totalFound: response.data.data.length,
          stats: response.data.stats,
        });
        setOverallStats(response.data.stats || {});
      }
    } catch (error) {
      console.error("Error fetching debit notes:", error);
      notifyError(dn("toasts.loadFailed", "Failed to load debit notes"));
    } finally {
      setLoading(false);
    }
  };
  const patchNoteInList = useCallback((id, patch) => {
    if (!id || !patch || typeof patch !== "object") return;
    setDebitNotes((prev) =>
      (prev || []).map((note) =>
        String(note?._id) === String(id) ? { ...note, ...patch } : note,
      ),
    );
  }, []);
  const { renderLhdnActionButtons, LhdnModals } = useCreditDebitNoteLhdnActions({
    variant: "debit",
    headers,
    canSubmitLhdn: canUpdate,
    patchNoteInList,
    refreshList: fetchDebitNotes,
  });

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
      !scopedCustomers.some((c) => String(c?._id) === String(selectedCustomerFilter))
    ) {
      setSelectedCustomerFilter("");
    }
  }, [scopedCustomers, selectedCustomerFilter]);

  useEffect(() => {
    if (
      selectedVendorFilter &&
      !scopedVendors.some((v) => String(v?._id) === String(selectedVendorFilter))
    ) {
      setSelectedVendorFilter("");
    }
  }, [scopedVendors, selectedVendorFilter]);

  const fetchVendors = async () => {
    try {
      const response = await axios.get(`${Base_URL}/vendors`, { headers });
      setVendors(response.data.vendors || response.data.data || []);
    } catch (error) {
      console.error("Error fetching vendors:", error);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await axios.get(`${Base_URL}/customers`, { headers });
      setCustomers(response.data.customers || response.data.data || []);
    } catch (error) {
      console.error("Error fetching customers:", error);
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
      Settled: "bg-purple-100 text-purple-800",
      Cancelled: "bg-red-100 text-red-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const handleOpenFile = async (documentId) => {
    if (!documentId) return;
    try {
      const response = await axios.get(
        `${Base_URL}/documents/getFileWithAllData/${documentId}`
      );
      window.open(response.data.data.url, "_blank");
    } catch (error) {
      notifyError(dn("toasts.openFileFailed", "Error opening file"));
      console.error("Error: ", error);
    }
  };

  const handleEdit = (id) => {
    history.push(`/update-debit-note/${id}`);
  };

  const handleView = (id) => {
    history.push(`/view-debit-note/${id}`);
  };

  const handleDelete = async (id) => {
    if (
      !window.confirm(
        dn("list.confirmDelete", "Are you sure you want to delete this debit note?"),
      )
    ) {
      return;
    }

    try {
      const response = await axios.delete(`${Base_URL}/debit-notes/${id}`, {
        headers,
      });

      if (response.data.success) {
        notifySuccess(
          dn("toasts.deleteSuccess", "Debit note deleted successfully"),
        );
        fetchDebitNotes();
      }
    } catch (error) {
      console.error("Error deleting debit note:", error);
      notifyError(
        error.response?.data?.error ||
          dn("toasts.deleteFailed", "Failed to delete debit note"),
      );
    }
  };

  const handleExportExcel = async () => {
    try {
      setLoading(true);

      // Fetch all debit notes with current filters
      const params = {
        businessId:
          selectedBusinessFilter || undefined,
        entityType: selectedEntityTypeFilter || undefined,
        customerId: selectedCustomerFilter || undefined,
        vendorId: selectedVendorFilter || undefined,
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
        (key) => params[key] === undefined && delete params[key]
      );

      const response = await axios.get(`${Base_URL}/debit-notes`, {
        params,
        headers,
      });

      const allDebitNotes = response.data.data || [];

      if (allDebitNotes.length === 0) {
        notifyError(
          dn("toasts.exportNoData", "No debit notes found to export"),
        );
        return;
      }

      const colDebitNoteNumber = dn(
        "export.debitNoteNumber",
        "Debit Note Number",
      );
      const colEntityType = dn("export.entityType", "Entity Type");
      const colCustomerName = dn("export.customerName", "Customer Name");
      const colVendorName = dn("export.vendorName", "Vendor Name");
      const colDebitNoteDate = dn("export.debitNoteDate", "Debit Note Date");
      const colDueDate = dn("export.dueDate", "Due Date");
      const colStatus = dn("export.status", "Status");
      const colDiscount = dn("export.discount", "Discount");
      const colTotal = dn("export.total", "Total");
      const colCurrency = dn("export.currency", "Currency");
      const colExpenseAccount = dn("export.expenseAccount", "Expense Account");
      const colNotes = dn("export.notes", "Notes");
      const colCreatedAt = dn("export.createdAt", "Created At");
      const colUpdatedAt = dn("export.updatedAt", "Updated At");

      // Prepare Excel data
      const exportData = allDebitNotes.map((debitNote) => ({
        [colDebitNoteNumber]: debitNote.debitNoteNumber || "",
        [colEntityType]: debitNote.entityType || "",
        [colCustomerName]:
          debitNote.customer?.basicInformation?.customerDisplayName || "",
        [colVendorName]:
          debitNote.vendor?.basicInformation?.vendorDisplayName || "",
        [colDebitNoteDate]: debitNote.debitNoteDate
          ? formatDate(debitNote.debitNoteDate)
          : "",
        [colDueDate]: debitNote.dueDate ? formatDate(debitNote.dueDate) : "",
        [colStatus]: debitNote.status || "",
        [colDiscount]: debitNote.discountAmount || 0,
        [colTotal]: debitNote.total || 0,
        [colCurrency]: debitNote.currency || "USD",
        [colExpenseAccount]: debitNote.expenseAccount?.code
          ? `${debitNote.expenseAccount.code} - ${debitNote.expenseAccount.accountName}`
          : debitNote.expenseAccount?.accountName || "",
        [colNotes]: debitNote.notes || "",
        [colCreatedAt]: debitNote.createdAt
          ? formatDate(debitNote.createdAt)
          : "",
        [colUpdatedAt]: debitNote.updatedAt
          ? formatDate(debitNote.updatedAt)
          : "",
      }));

      const emptySummary = {
        [colDebitNoteNumber]: "",
        [colEntityType]: "",
        [colCustomerName]: "",
        [colVendorName]: "",
        [colDebitNoteDate]: "",
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

      // Create summary rows
      const summaryRows = [
        {
          ...emptySummary,
          [colDebitNoteNumber]: dn(
            "export.reportTitle",
            "Debit Notes Report",
          ),
        },
        {
          ...emptySummary,
          [colDebitNoteNumber]: dn("export.generatedOn", "Generated on: {{date}}", {
            date: formatDate(new Date()),
          }),
        },
        {
          ...emptySummary,
          [colDebitNoteNumber]: dn(
            "export.totalDebitNotesCount",
            "Total Debit Notes: {{count}}",
            { count: allDebitNotes.length },
          ),
        },
        {
          ...emptySummary,
          [colDebitNoteNumber]: dn(
            "export.totalValueAmount",
            "Total Value: {{amount}}",
            {
              amount: formatAmount(
                allDebitNotes.reduce(
                  (sum, note) => sum + (note.grandTotal || 0),
                  0,
                ),
              ),
            },
          ),
        },
        { ...emptySummary },
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
        dn("export.sheetName", "Debit Notes"),
      );

      // Generate filename
      const filename = `Debit_Notes_${
        new Date().toISOString().split("T")[0]
      }.xlsx`;

      // Download file
      XLSX.writeFile(workbook, filename);

      notifySuccess(
        dn(
          "toasts.exportSuccess",
          "Debit notes exported to Excel successfully!",
        ),
      );
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      notifyError(
        dn(
          "toasts.exportFailed",
          "Failed to export debit notes to Excel. Please try again.",
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
    setSelectedVendorFilter("");
    setSelectedCustomerFilter("");
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
            label: dn("business", "Business"),
            value: selectedBusinessFilter,
            onChange: setSelectedBusinessFilter,
            options: [
              ...businesses.map((b) => ({
                value: b._id,
                label: b.name,
              })),
            ],
            placeholder: dn("selectBusiness", "Select Business"),
            icon: Building,
          },
        ]
      : []),
    {
      label: dn("entityType", "Entity Type"),
      value: selectedEntityTypeFilter,
      onChange: setSelectedEntityTypeFilter,
      options: [
        { value: "vendor", label: dn("vendor", "Vendor") },
        { value: "customer", label: dn("customer", "Customer") },
      ],
      placeholder: dn("entityType", "Entity Type"),
      icon: Users,
    },
    {
      label: dn("vendor", "Vendor"),
      value: selectedVendorFilter,
      onChange: setSelectedVendorFilter,
      options: [
        ...(shouldShowAllVendorsOption
          ? [{ value: "", label: dn("allVendors", "All Vendors") }]
          : []),
        ...scopedVendors.map((v) => ({
          value: v._id,
          label: v.basicInformation?.vendorDisplayName || v.name,
        })),
      ],
      placeholder: dn("vendor", "Vendor"),
      icon: Building,
      show:
        !selectedEntityTypeFilter ||
        selectedEntityTypeFilter === "vendor",
    },
    {
      label: dn("customer", "Customer"),
      value: selectedCustomerFilter,
      onChange: setSelectedCustomerFilter,
      options: [
        ...(shouldShowAllCustomersOption
          ? [{ value: "", label: dn("allCustomers", "All Customers") }]
          : []),
        ...scopedCustomers.map((c) => ({
          value: c._id,
          label: `${c.basicInformation?.primaryContact?.firstName} ${c.basicInformation?.primaryContact?.lastName}`,
        })),
      ],
      placeholder: dn("customer", "Customer"),
      icon: Users,
      show:
        !selectedEntityTypeFilter ||
        selectedEntityTypeFilter === "customer",
    },
    {
      label: dn("status", "Status"),
      value: selectedStatusFilter,
      onChange: setSelectedStatusFilter,
      options: [
        { value: "All", label: dn("allStatus", "All Status") },
        { value: "Draft", label: translateDebitNoteStatus(t, "Draft") },
        { value: "Created", label: translateDebitNoteStatus(t, "Created") },
        {
          value: "Approved by Management",
          label: translateDebitNoteStatus(t, "Approved by Management"),
        },
        { value: "Settled", label: translateDebitNoteStatus(t, "Settled") },
        {
          value: "Cancelled",
          label: translateDebitNoteStatus(t, "Cancelled"),
        },
      ],
      placeholder: dn("statusAll", "Status: All"),
      icon: FileText,
    },
    {
      label: dn("dateCreated", "Date Created"),
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
      placeholder: dn("dateCreated", "Date Created"),
      icon: Calendar,
    },
  ];

  useEffect(() => {
    if (!anyAssignedBusinessHasEInvoice) setSelectedLhdnStatusFilter("All");
  }, [anyAssignedBusinessHasEInvoice]);

  const myInvoisTableFilters = useMemo(() => {
    const debitStatusOptions = [
      { value: "All", label: dn("allStatus", "All Status") },
      { value: "Draft", label: translateDebitNoteStatus(t, "Draft") },
      { value: "Created", label: translateDebitNoteStatus(t, "Created") },
      {
        value: "Approved by Management",
        label: translateDebitNoteStatus(t, "Approved by Management"),
      },
      { value: "Settled", label: translateDebitNoteStatus(t, "Settled") },
      { value: "Cancelled", label: translateDebitNoteStatus(t, "Cancelled") },
    ];
    const base = [
      {
        isClearButton: true,
        buttonProps: {
          onClick: () => {
            clearAllFilters();
            setSelectedLhdnStatusFilter("All");
          },
        },
      },
      ...(!isSingleAssignedBusiness()
        ? [
            {
              label: dn("business", "Business"),
              value: selectedBusinessFilter,
              onChange: (value) => {
                setSelectedBusinessFilter(value);
                setCurrentPage(1);
              },
              options: businesses.map((b) => ({
                value: b._id,
                label: b.name,
              })),
              placeholder: dn("selectBusiness", "Select Business"),
              icon: Building,
            },
          ]
        : []),
      {
        label: dn("customer", "Customer"),
        value: selectedCustomerFilter,
        onChange: (value) => {
          setSelectedCustomerFilter(value || "");
          setCurrentPage(1);
        },
        options: [
          ...(shouldShowAllCustomersOption
            ? [{ value: "", label: dn("allCustomers", "All Customers") }]
            : []),
          ...scopedCustomers.map((c) => ({
            value: c._id,
            label: `${c.basicInformation?.primaryContact?.firstName} ${c.basicInformation?.primaryContact?.lastName}`,
          })),
        ],
        placeholder: dn("customerAll", "Customer: All"),
        icon: User,
      },
      {
        label: dn("status", "Status"),
        value: selectedStatusFilter,
        onChange: (value) => {
          setSelectedStatusFilter(
            value == null || value === "" ? "All" : value,
          );
          setCurrentPage(1);
        },
        options: debitStatusOptions,
        placeholder: dn("statusAll", "Status: All"),
        icon: FileText,
      },
    ];
    if (anyAssignedBusinessHasEInvoice) {
      base.push({
        label: dn("lhdnStatus", "LHDN Status"),
        value: selectedLhdnStatusFilter,
        onChange: (value) => {
          setSelectedLhdnStatusFilter(
            value == null || value === "" ? "All" : value,
          );
          setCurrentPage(1);
        },
        options: [
          { value: "All", label: dn("allLhdnStatuses", "All LHDN Statuses") },
          {
            value: "Pending",
            label: translateLhdnStatus(t, "Pending", "debitNotes"),
          },
          {
            value: "Submitted",
            label: translateLhdnStatus(t, "Submitted", "debitNotes"),
          },
          {
            value: "Valid",
            label: translateLhdnStatus(t, "Valid", "debitNotes"),
          },
          {
            value: "Invalid",
            label: translateLhdnStatus(t, "Invalid", "debitNotes"),
          },
          {
            value: "Rejected",
            label: translateLhdnStatus(t, "Rejected", "debitNotes"),
          },
          {
            value: "Cancelled",
            label: translateLhdnStatus(t, "Cancelled", "debitNotes"),
          },
        ],
        placeholder: dn("lhdnStatusAll", "LHDN Status: All"),
        icon: Send,
      });
    }
    base.push({
      label: dn("dateCreated", "Date Created"),
      value: selectedDateCreatedFilter,
      onChange: (val) => {
        setSelectedDateCreatedFilter(val);
        if (val) {
          setDateRangeStart("");
          setDateRangeEnd("");
        }
        setCurrentPage(1);
      },
      isDatePicker: true,
      placeholder: dn("dateCreated", "Date Created"),
      icon: Calendar,
    });
    return base;
  }, [
    t,
    dn,
    selectedBusinessFilter,
    selectedCustomerFilter,
    selectedStatusFilter,
    selectedLhdnStatusFilter,
    selectedDateCreatedFilter,
    anyAssignedBusinessHasEInvoice,
    businesses,
    scopedCustomers,
    shouldShowAllCustomersOption,
  ]);

  // Summary cards data
  const summaryCardsData = [
    {
      title: dn("totalDebitNotes", "Total Debit Notes"),
      value: overallStats.totalDebitNotes,
      backgroundColor: "summary-light",
      iconColor: "summary-dark",
      Icon: SummarySvg,
    },
    {
      title: dn("approvedByManagement", "Approved by Management"),
      value: overallStats.approvedByManagement,
      backgroundColor: "completed-light",
      iconColor: "completed-dark",
      Icon: CompletedSvg,
    },
    {
      title: dn("pendingApproval", "Pending Approval"),
      value: overallStats.pendingApproval,
      backgroundColor: "processing-light",
      iconColor: "processing-dark",
      Icon: InProgressSvg,
    },
    {
      title: dn("totalValue", "Total Value"),
      value: `$${formatAmount(overallStats.totalValue)}`,
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
                {dn("title", "Debit Notes")}
              </h1>
              <p className="text-gray-600 mt-2">
                {dn(
                  "subtitle",
                  "Manage and track all vendor debit notes",
                )}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <DateRangePicker
                startDate={dateRangeStart}
                endDate={dateRangeEnd}
                onApply={handleDateRangeApply}
                onClear={handleDateRangeClear}
                placeholder={dn(
                  "filterByDateRange",
                  "Filter by date range",
                )}
                className="flex-shrink-0"
              />
              <button
                onClick={handleExportExcel}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ExcelIcon size={18} />
                {loading
                  ? dn("exporting", "Exporting...")
                  : dn("exportToExcel", "Export to Excel")}
              </button>
              <button
                className="flex items-center gap-2 px-6 py-3 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[#9CBA33] transition-colors shadow-sm"
                onClick={() => history.push("/create-debit-note")}
              >
                <Plus size={20} />
                {dn("createDebitNote", "Create Debit Note")}
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <SummaryCards cards={summaryCardsData} columnsCount={4} />

        {/* Main Table */}
        {showCustomerMyInvoisTable ? (
          <div className="space-y-3 mb-8 w-full min-w-0 max-w-full">
            <div className="rounded-lg border border-blue-100 bg-blue-50/80 px-4 py-3 text-sm text-blue-900">
              {dn(
                "myInvoisBanner",
                "MyInvois (LHDN) — Submit, view details, retry, and download PDFs for customer debit notes.",
              )}
            </div>
            <CustomerEInvoiceCreditDebitList
              kind="debit"
              listKey={myInvoisListKey}
              filters={myInvoisTableFilters}
              searchTerm={searchTerm}
              onSearch={(val) => {
                setSearchTerm(val);
                setCurrentPage(1);
              }}
              entriesPerPage={entriesPerPage}
              onRecordsPerPageChange={(num) => {
                setEntriesPerPage(num);
                setCurrentPage(1);
              }}
              selectedCustomerFilter={
                selectedCustomerFilter
              }
              selectedInvoiceStatusFilter={selectedStatusFilter}
              selectedLhdnStatusFilter={selectedLhdnStatusFilter}
              selectedDateCreatedFilter={selectedDateCreatedFilter}
              dateRangeStart={dateRangeStart}
              dateRangeEnd={dateRangeEnd}
              selectedBusinessId={selectedBusinessFilter}
              assignedBusinessIds={assignedBusinessIds}
              showEInvoiceHubLhdn={anyAssignedBusinessHasEInvoice}
              rowShowsLhdn={rowShowsLhdnForNote}
              canViewNote={canViewNote}
              canSubmitLhdn={canUpdate}
            />
          </div>
        ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-w-0 max-w-full">
          <DataTable
            filters={filters}
            headersWithoutCellTooltip={[
              dn("headers.amount", "Amount"),
              dn("headers.actions", "Actions"),
            ]}
            actionColumnHeaderLabel={dn("headers.actions", "Actions")}
            colWidths={{
              [dn("headers.debitNoteNo", "Debit Note No")]: "180px",
              [dn("headers.entity", "Entity")]: "260px",
              [dn("headers.status", "Status")]: "150px",
              [dn("headers.lhdnStatus", "LHDN Status")]: "140px",
              [dn("headers.dates", "Dates")]: "220px",
              [dn("headers.amount", "Amount")]: "10%",
              [dn("headers.expenseAccount", "Expense Account")]: "240px",
              [dn("headers.documents", "Documents")]: "180px",
              [dn("headers.actions", "Actions")]: "200px",
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
            searchPlaceholder={dn("search", "Search")}
            headers={[
              dn("headers.debitNoteNo", "Debit Note No"),
              dn("headers.entity", "Entity"),
              dn("headers.status", "Status"),
              dn("headers.dates", "Dates"),
              dn("headers.amount", "Amount"),
              dn("headers.expenseAccount", "Expense Account"),
              dn("headers.documents", "Documents"),
              ...(anyAssignedBusinessHasEInvoice
                ? [dn("headers.lhdnStatus", "LHDN Status")]
                : []),
              dn("headers.actions", "Actions"),
            ]}
            data={debitNotes}
            loading={loading}
            renderRow={(debitNote) => (
              <tr
                key={debitNote._id}
                className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
              >
                {/* Debit Note Details */}
                <td className="py-4 px-4">
                  <div>
                    <p className="font-semibold text-gray-900">
                      #{debitNote.debitNoteNumber}
                    </p>
                    {(debitNote.vendorInvoice?.invoiceNumber ||
                      debitNote.customerInvoice?.invoice_number) && (
                      <p className="text-sm text-gray-500">
                        {dn("list.invoice", "Invoice: {{number}}", {
                          number:
                            debitNote.vendorInvoice?.invoiceNumber ||
                            debitNote.customerInvoice?.invoice_number,
                        })}
                      </p>
                    )}
                    {debitNote.reference && (
                      <p className="text-sm text-gray-500">
                        {dn("list.ref", "Ref: {{reference}}", {
                          reference: debitNote.reference,
                        })}
                      </p>
                    )}
                  </div>
                </td>
                {/* Entity */}
                <td className="py-4 px-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      {debitNote.entityType === "vendor" ? (
                        <Building size={16} className="text-gray-600" />
                      ) : (
                        <Users size={16} className="text-gray-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 truncate">
                        {debitNote.entityType === "vendor"
                          ? debitNote.vendor?.basicInformation?.companyName ||
                            debitNote.vendor?.basicInformation
                              ?.vendorDisplayName ||
                            dn("list.na", "N/A")
                          : debitNote.customer?.basicInformation?.companyName ||
                            `${debitNote.customer?.basicInformation?.primaryContact?.firstName} ${debitNote.customer?.basicInformation?.primaryContact?.lastName}` ||
                            dn("list.na", "N/A")}
                      </p>
                      <p className="text-sm text-gray-500">
                        {debitNote.entityType === "vendor"
                          ? dn("vendor", "Vendor")
                          : dn("customer", "Customer")}
                      </p>
                    </div>
                  </div>
                </td>
                {/* Status */}
                <td className="py-4 px-4">
                  <div className="space-y-2">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                        debitNote.status
                      )}`}
                    >
                      {translateDebitNoteStatus(t, debitNote.status)}
                    </span>
                  </div>
                </td>
                {/* Dates */}
                <td className="py-4 px-4">
                  <div className="space-y-1">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {formatDate(debitNote.debitNoteDate)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {dn("list.debitNoteDate", "Debit Note Date")}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">
                        {formatDate(debitNote.createdAt)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {dn("list.createdAt", "Created At")}
                      </p>
                    </div>
                  </div>
                </td>
                {/* Amount */}
                <td className="py-4 px-2 text-left">
                  <div className="text-left">
                    <p className="text-base font-bold text-gray-900 whitespace-nowrap">
                      {formatCurrencyAmount(
                        debitNote.currency,
                        debitNote.total,
                      )}
                    </p>
                    {debitNote.items?.length > 0 && (
                      <p className="text-xs text-gray-500">
                        {dn("list.itemCount", "{{count}} item", {
                          count: debitNote.items.length,
                        })}
                      </p>
                    )}
                  </div>
                </td>
                {/* Expense Account */}
                <td className="py-4 px-4">
                  <div>
                    {debitNote.expenseAccount ? (
                      <div>
                        <p className="font-medium text-gray-900">
                          {debitNote.expenseAccount.code ||
                            dn("list.na", "N/A")}{" "}
                          -{" "}
                          {debitNote.expenseAccount.accountName ||
                            dn("list.unknownAccount", "Unknown Account")}
                        </p>
                        <p className="text-xs text-gray-500">
                          {debitNote.expenseAccount.accountType?.name ||
                            debitNote.expenseAccount.accountType
                              ?.accountHeader ||
                            ""}
                        </p>
                      </div>
                    ) : (
                      <span className="text-gray-400 italic">
                        {dn(
                          "list.noAccountSpecified",
                          "No account specified",
                        )}
                      </span>
                    )}
                  </div>
                </td>
                {/* Documents */}
                <td className="py-4 px-4">
                  <div className="flex items-center gap-2">
                    {debitNote.documents?.length > 0 ? (
                      <>
                        <div className="flex items-center gap-1">
                          <FileText
                            size={16}
                            className="text-[var(--p-blue)]"
                          />
                          <span className="text-sm text-gray-600">
                            {dn("list.fileCount", "{{count}} file", {
                              count: debitNote.documents.length,
                            })}
                          </span>
                        </div>
                        <button
                          onClick={() =>
                            handleViewDocuments(debitNote.documents)
                          }
                          className="text-[var(--p-blue)] hover:text-[#9CBA33] p-1"
                          title={dn(
                            "actions.viewDocuments",
                            "View Documents",
                          )}
                        >
                          <Eye size={16} />
                        </button>
                      </>
                    ) : (
                      <span className="text-sm text-gray-400">
                        {dn("list.noDocuments", "No documents")}
                      </span>
                    )}
                  </div>
                </td>
                {anyAssignedBusinessHasEInvoice && (
                  <td className="py-4 px-4 align-middle">
                    {debitNote.entityType === "customer" &&
                    rowShowsLhdnForNote(debitNote) ? (
                      <LhdnStatusBadge status={debitNote.lhdn_status} />
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </td>
                )}
                {/* Actions */}
                <td className="py-4 px-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    {debitNote.entityType === "customer" &&
                      selectedEntityTypeFilter !== "vendor" &&
                      renderLhdnActionButtons(
                        debitNote,
                        rowShowsLhdnForNote(debitNote),
                      )}
                    <button
                      onClick={() => handleView(debitNote._id)}
                      className="text-blue-600 hover:text-blue-800 p-1"
                      title={dn("actions.view", "View")}
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => handleEdit(debitNote._id)}
                      className="text-green-600 hover:text-green-800 p-1"
                      title={dn("actions.edit", "Edit")}
                    >
                      <Edit size={16} />
                    </button>
                    {(debitNote.status === "Draft" ||
                      debitNote.status === "Cancelled") && (
                      <button
                        onClick={() => handleDelete(debitNote._id)}
                        className="text-red-600 hover:text-red-800 p-1"
                        title={dn("actions.delete", "Delete")}
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
        )}
      </div>

      {showDocumentsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-900">
                {dn(
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
                              {dn("list.uploaded", "Uploaded: {{date}}", {
                                date: formatDate(doc.uploadedAt),
                              })}
                            </span>
                          )}
                          {doc.size && (
                            <span>
                              {dn("list.sizeMb", "Size: {{size}} MB", {
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
                            {dn("actions.view", "View")}
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
      <LhdnModals />
    </div>
  );
}
