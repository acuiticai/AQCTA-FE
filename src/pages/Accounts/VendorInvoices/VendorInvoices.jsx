// src/pages/Accounts/VendorInvoices/VendorInvoices.jsx
import { useEffect, useState, useContext, useMemo } from "react";
import { AdminContext } from "@/context/AdminContext";
import {
  X,
  Search,
  Calendar,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  PenSquare,
  FileText,
  Download,
  File,
  Plus,
  Filter,
  Building,
  User,
  Package,
  DollarSign,
  Clock,
  Info,
  CreditCard,
  CheckSquare,
  Square,
  CheckCircle,
  FileSpreadsheet as ExcelIcon,
  Trash2,
} from "lucide-react";
import * as XLSX from "xlsx";
import { useHistory } from "react-router-dom";
import axios from "axios";
import { DataTable, SummaryCards } from "@/page-layouts/index";
import StandardPageHeader from "@/components/StandardPageHeader";
import { formatDate, formatAmount, formatCurrencyAmount } from "@/components/formatAmount";
import DateRangePicker from "@/components/common/DateRangePicker";
import BulkPaymentModal from "@/components/vendor-invoices/BulkPaymentModal";
import VendorInvoiceServices from "@/services/VendorInvoiceServices";
import CompletedSvg from "@/assets/img/completed.svg";
import InProgressSvg from "@/assets/img/in-progress.svg";
import PendingApprovalSvg from "@/assets/img/pending-approval.svg";
import DelayedSvg from "@/assets/img/delayed.svg";
import SummarySvg from "@/assets/img/summary.svg";
import DollarSvg from "../../../assets/img/icons/stats-1.png";
import { notifyError, notifySuccess } from "@/utils/toast";
import SearchableDropdown from "@/components/SearchableDropdown";
import { useRouteModulePermissions } from "@/utils/permissionUtils";
import { fetchDefinitions } from "@/services/customFieldServices";
import { useTranslation } from "react-i18next";
import { isSingleAssignedBusiness } from "@/utils/sessionAssignedBusinesses";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

function formatVendorInvoiceCfCell(def, raw, labels = {}) {
  if (raw === null || raw === undefined || raw === "") return "—";
  switch (def.data_type) {
    case "checkbox":
      return raw ? (labels.yes || "Yes") : (labels.no || "No");
    case "date":
    case "datetime":
      try {
        const d = new Date(raw);
        return Number.isNaN(d.getTime()) ? String(raw) : formatDate(raw);
      } catch {
        return String(raw);
      }
    case "multi_select":
      return Array.isArray(raw) ? raw.join(", ") : String(raw);
    default:
      return Array.isArray(raw) ? raw.join(", ") : String(raw);
  }
}

export default function VendorInvoices() {
  const { t } = useTranslation();
  const vi = (key, defaultValue, options = {}) =>
    t(`accounts.vendorInvoices.${key}`, { defaultValue, ...options });
  const routePerms = useRouteModulePermissions();
  const {
    canAdd,
    canUpdate,
    canDelete,
    canView,
    canViewDetails,
  } = routePerms;
  const canOpenInvoice = canView || canViewDetails;
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo?.token}`,
  };

  const [selectedBusinessFilter, setSelectedBusinessFilter] = useState("");
  const [selectedVendorFilter, setSelectedVendorFilter] = useState("");
  const [selectedInvoiceTypeFilter, setSelectedInvoiceTypeFilter] =
    useState("All");
  const [selectedInvoiceStatusFilter, setSelectedInvoiceStatusFilter] =
    useState("All");
  const [selectedDateCreatedFilter, setSelectedDateCreatedFilter] =
    useState("");
  const [selectedDueDateFilter, setSelectedDueDateFilter] = useState("");
  const [selectedPurchaseContractsFilter, setSelectedPurchaseContractsFilter] =
    useState("All");
  const [selectedSalesContractsFilter, setSelectedSalesContractsFilter] =
    useState("All");
  const [selectedPaymentStatusFilter, setSelectedPaymentStatusFilter] =
    useState("All");
  const [dateRangeStart, setDateRangeStart] = useState("");
  const [dateRangeEnd, setDateRangeEnd] = useState("");
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const history = useHistory();
  const [businesses, setBusinesses] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [purchaseContracts, setPurchaseContracts] = useState([]);
  const [salesContracts, setSalesContracts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [pendingDeleteInvoice, setPendingDeleteInvoice] = useState(null);
  const [businessesLoading, setBusinessesLoading] = useState(true);
  const [overallStats, setOverallStats] = useState({
    totalInvoices: 0,
    approvedTransactions: 0,
    pendingApproval: 0,
    totalValue: 0,
  });

  // Bulk payment state
  const [selectedInvoices, setSelectedInvoices] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [showBulkPaymentModal, setShowBulkPaymentModal] = useState(false);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [bulkPaymentLoading, setBulkPaymentLoading] = useState(false);
  const [bulkPaymentMode, setBulkPaymentMode] = useState("review");

  /** Vendor invoice custom fields flagged “Show in vendor invoice list” (purchase › vendor_invoice). */
  const [datatableCustomFields, setDatatableCustomFields] = useState([]);
  /** Avoid layout shift: table stays in loading state until column defs are resolved for current businesses. */
  const [columnDefsReady, setColumnDefsReady] = useState(false);

  // Clear all filters function
  const clearAllFilters = () => {
    setSelectedBusinessFilter("");
    setSelectedVendorFilter("");
    setSelectedInvoiceTypeFilter("All");
    setSelectedInvoiceStatusFilter("All");
    setSelectedPaymentStatusFilter("All");
    setSelectedPurchaseContractsFilter("All");
    setSelectedSalesContractsFilter("All");
    setSelectedDateCreatedFilter("");
    setSelectedDueDateFilter("");
    setDateRangeStart("");
    setDateRangeEnd("");
    setSearchTerm("");
    setCurrentPage(1);
  };

  const filters = [
    {
      isClearButton: true,
      buttonProps: {
        onClick: () => {
          clearAllFilters();
          setCurrentPage(1);
        },
      },
    },
    ...(!isSingleAssignedBusiness()
      ? [
          {
            label: vi("business", "Business"),
            value: selectedBusinessFilter,
            onChange: (val) => {
              setSelectedBusinessFilter(val);
              setCurrentPage(1);
            },
            options: businesses.map((b) => ({
              value: b._id,
              label: b.name,
            })),
            placeholder: vi("selectBusiness", "Select Business"),
            icon: Building,
          },
        ]
      : []),
    {
      label: vi("vendor", "Vendor"),
      value: selectedVendorFilter,
      onChange: (val) => {
        setSelectedVendorFilter(val);
        setCurrentPage(1);
      },
      options: vendors
        .filter((v) => String(v?.status ?? "Active").toLowerCase() === "active")
        .map((v) => ({
          value: v._id,
          label:
            v.basicInformation?.vendorDisplayName ??
            v.basicInformation?.companyName ??
            "—",
        })),
      placeholder: vi("selectVendor", "Select Vendor"),
      icon: User,
    },
    // {
    //   label: "Invoice Type",
    //   value: selectedInvoiceTypeFilter,
    //   onChange: (val) => {
    //     setSelectedInvoiceTypeFilter(val);
    //     setCurrentPage(1);
    //   },
    //   options: [
    //     { value: "All", label: "All Types" },
    //     { value: "supplier", label: "Supplier" },
    //     { value: "commission", label: "Commission" },
    //     { value: "logistic", label: "Logistic Service Provider" },
    //   ],
    //   placeholder: "Invoice Type: All",
    //   icon: Package,
    // },
    {
      label: vi("invoiceStatus", "Invoice Status"),
      value: selectedInvoiceStatusFilter,
      onChange: (val) => {
        setSelectedInvoiceStatusFilter(val);
        setCurrentPage(1);
      },
      options: [
        { value: "All", label: vi("status", "Status") },
        { value: "Draft", label: vi("draft", "Draft") },
        { value: "Created", label: vi("created", "Created") },
        { value: "Approved by Management", label: vi("approvedByManagement", "Approved by Management") },
        { value: "Make Transaction", label: vi("makeTransaction", "Make Transaction") },
        { value: "Approve Transaction", label: vi("approveTransaction", "Approve Transaction") },
        { value: "Cancelled", label: vi("cancelled", "Cancelled") },
        // Add payment status options for filtering
        { value: "Paid", label: vi("paid", "Paid") },
        { value: "Unpaid", label: vi("unpaid", "Unpaid") },
        { value: "Partial Paid", label: vi("partialPaid", "Partial Paid") },
      ],
      placeholder: vi("statusAll", "Status: All"),
      icon: FileText,
    },
    {
      label: vi("paymentStatus", "Payment Status"),
      value: selectedPaymentStatusFilter,
      onChange: (val) => {
        setSelectedPaymentStatusFilter(val);
        setCurrentPage(1);
      },
      options: [
        { value: "All", label: vi("allPayments", "All Payments") },
        { value: "unpaid", label: vi("unpaid", "Unpaid") },
        { value: "partial", label: vi("partialPaid", "Partial Paid") },
        { value: "paid", label: vi("paid", "Paid") },
        { value: "pendingclearance", label: vi("pendingClearance", "Pending Clearance") },
      ],
      placeholder: vi("paymentStatusAll", "Payment Status: All"),
      icon: DollarSign,
    },
    // {
    //   label: "Purchase Contracts",
    //   value: selectedPurchaseContractsFilter,
    //   onChange: (val) => {
    //     setSelectedPurchaseContractsFilter(val);
    //     setCurrentPage(1);
    //   },
    //   options: [
    //     { value: "All", label: "Contracts" },
    //     ...purchaseContracts.map((c) => ({
    //       value: c.contractNo, //_id
    //       label: c.contractNo,
    //     })),
    //   ],
    //   placeholder: "Purchase Contracts: All",
    //   icon: FileText,
    // },
    // {
    //   label: "Sales Contracts",
    //   value: selectedSalesContractsFilter,
    //   onChange: setSelectedSalesContractsFilter,
    //   options: [
    //     { value: "All", label: "All Sales Contracts" },
    //     ...salesContracts.map((c) => ({
    //       value: c.contractNo, //_id
    //       label: c.contractNo,
    //     })),
    //   ],
    //   placeholder: "Sales Contracts: All",
    //   icon: FileText,
    // },
    {
      label: vi("dateCreated", "Date Created"),
      value: selectedDateCreatedFilter,
      onChange: (val) => {
        setSelectedDateCreatedFilter(val);
        setCurrentPage(1);
      },
      isDatePicker: true,
      placeholder: vi("dateCreated", "Date Created"),
      icon: Calendar,
    },
  ];

  const fetchInvoices = async () => {
    if (businesses.length === 0) {
      if (!businessesLoading) setLoading(false);
      setInvoices([]);
      setTotalPages(1);
      setOverallStats({
        totalInvoices: 0,
        approvedTransactions: 0,
        pendingApproval: 0,
        totalValue: 0,
      });
      return;
    }

    setLoading(true);
    try {
      const assignedIds = (businesses || []).map((b) => b._id).filter(Boolean);
      const params = {
        ...(selectedBusinessFilter
          ? { business: selectedBusinessFilter }
          : assignedIds.length > 0
          ? { businessIds: assignedIds.join(",") }
          : {}),
        vendor: selectedVendorFilter || undefined,
        type:
          selectedInvoiceTypeFilter !== "All"
            ? selectedInvoiceTypeFilter
            : undefined,
        status:
          selectedInvoiceStatusFilter !== "All"
            ? selectedInvoiceStatusFilter
            : undefined,
        dateCreated: selectedDateCreatedFilter,
        dueDate: selectedDueDateFilter,
        contract:
          selectedPurchaseContractsFilter !== "All"
            ? selectedPurchaseContractsFilter
            : undefined,
        salesContract:
          selectedSalesContractsFilter !== "All"
            ? selectedSalesContractsFilter
            : undefined,
        paymentStatus:
          selectedPaymentStatusFilter !== "All"
            ? selectedPaymentStatusFilter
            : undefined,
        search: searchTerm,
        page: currentPage,
        limit: entriesPerPage,
        // Add date range parameters
        ...(dateRangeStart && { dateFrom: dateRangeStart }),
        ...(dateRangeEnd && { dateTo: dateRangeEnd }),
      };

      // Remove undefined values
      Object.keys(params).forEach(
        (key) => params[key] === undefined && delete params[key]
      );

      console.log("🔍 Vendor Invoices API Request params:", params);
      console.log(`${Base_URL}/vendor-invoices`);

      const res = await axios.get(`${Base_URL}/vendor-invoices`, { params, headers });

      if (res.data.success) {
        let list = res.data.data || [];
        const assignedIds = (businesses || []).map((b) => String(b._id));
        if (assignedIds.length > 0) {
          list = list.filter((inv) => {
            const bid = inv.business?._id ?? inv.business ?? inv.business_id?._id ?? inv.business_id;
            if (!bid) return false;
            return assignedIds.includes(typeof bid === "string" ? bid : String(bid));
          });
        } else {
          list = [];
        }
        setInvoices(list);
        setTotalPages(res.data.totalPages || 1);
        setOverallStats(
          res.data.overallStats || {
            totalInvoices: 0,
            approvedTransactions: 0,
            pendingApproval: 0,
            totalValue: 0,
          }
        );
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
          { headers }
        );
        const list = response.data?.businesses || [];
        setBusinesses(list);
      } catch (error) {
        console.error("Failed to fetch assigned businesses:", error);
      } finally {
        setBusinessesLoading(false);
      }
    };
    fetchBusinesses();
  }, [adminInfo?.id]);

  useEffect(() => {
    if (businessesLoading) return;
    if (businesses.length !== 1) return;
    const onlyId = businesses[0]?._id;
    if (!onlyId) return;
    if (selectedBusinessFilter) return;
    setSelectedBusinessFilter(String(onlyId));
  }, [businessesLoading, businesses, selectedBusinessFilter]);

  useEffect(() => {
    const fetchVendors = async () => {
      if (!selectedBusinessFilter) {
        setVendors([]);
        setSelectedVendorFilter("");
        return;
      }
      try {
        const response = await axios.get(
          `${Base_URL}/vendors/all/${selectedBusinessFilter}`,
          { headers, params: { status: "Active" } }
        );
        const list = response.data?.data || response.data?.vendors || [];
        setVendors(
          Array.isArray(list)
            ? list.filter(
                (v) => String(v?.status ?? "Active").toLowerCase() === "active"
              )
            : []
        );
        setSelectedVendorFilter("");
      } catch (error) {
        console.error("Error fetching vendors for business:", error);
        setVendors([]);
      }
    };
    fetchVendors();
  }, [selectedBusinessFilter, adminInfo?.id]);

  useEffect(() => {
    const fetchPurchaseContracts = async () => {
      try {
        const response = await axios.get(`${Base_URL}/purchase-contracts`);
        setPurchaseContracts(response.data.contracts || []);
      } catch (error) {
        console.error("Error fetching purchase contracts:", error);
      }
    };
    const fetchSalesContracts = async () => {
      try {
        const res = await axios.get(`${Base_URL}/sales-contracts`);
        setSalesContracts(res.data.contracts || []);
      } catch (error) {
        console.error("Error fetching sales contracts:", error);
      }
    };
    fetchPurchaseContracts();
    fetchSalesContracts();
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!adminInfo?.token) {
      setDatatableCustomFields([]);
      setColumnDefsReady(true);
      return undefined;
    }

    if (businessesLoading) {
      setColumnDefsReady(false);
      return undefined;
    }

    const bizIds = selectedBusinessFilter
      ? [selectedBusinessFilter]
      : (businesses || []).map((b) => b._id).filter(Boolean);

    if (!bizIds.length) {
      setDatatableCustomFields([]);
      setColumnDefsReady(true);
      return undefined;
    }

    setColumnDefsReady(false);
    (async () => {
      try {
        const merged = [];
        const seen = new Set();
        for (const bid of bizIds) {
          const defs = await fetchDefinitions(
            {
              businessId: bid,
              module: "purchase",
              screen: "vendor_invoice",
              includeInactive: false,
            },
            headers,
          );
          for (const d of defs || []) {
            if (!d.show_in_datatable || d.is_active === false) continue;
            if (seen.has(d.field_key)) continue;
            seen.add(d.field_key);
            merged.push(d);
          }
        }
        merged.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
        if (!cancelled) {
          setDatatableCustomFields(merged);
          setColumnDefsReady(true);
        }
      } catch (e) {
        console.warn("Vendor invoice list columns (custom fields):", e);
        if (!cancelled) {
          setDatatableCustomFields([]);
          setColumnDefsReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    businessesLoading,
    selectedBusinessFilter,
    businesses,
    adminInfo?.token,
  ]);

  useEffect(() => {
    setCurrentPage(1);
    fetchInvoices();
  }, [
    selectedBusinessFilter,
    selectedVendorFilter,
    selectedInvoiceTypeFilter,
    selectedInvoiceStatusFilter,
    selectedPaymentStatusFilter,
    selectedDateCreatedFilter,
    selectedDueDateFilter,
    selectedPurchaseContractsFilter,
    selectedSalesContractsFilter,
    dateRangeStart,
    dateRangeEnd,
    searchTerm,
    businesses.length,
  ]);

  useEffect(() => {
    fetchInvoices();
  }, [currentPage, entriesPerPage, selectedBusinessFilter]);

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
  const handleDeleteInvoice = async (invoice) => {
    if (!canDelete || !invoice?._id) return;
    const invoiceNo = invoice?.invoiceNumber
      ? `#${invoice.invoiceNumber}`
      : vi("thisInvoice", "this invoice");
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
      await VendorInvoiceServices.deleteVendorInvoice(pendingDeleteInvoice.invoiceId);
      notifySuccess(vi("deletedSuccess", "Vendor invoice deleted successfully"));
      setSelectedInvoices((prev) =>
        prev.filter((inv) => inv?._id !== pendingDeleteInvoice.invoiceId),
      );
      fetchInvoices();
    } catch (error) {
      console.error("Error deleting vendor invoice:", error);
      notifyError(
        error?.response?.data?.error || vi("deleteFailed", "Failed to delete vendor invoice"),
      );
    } finally {
      setConfirmDeleteOpen(false);
      setPendingDeleteInvoice(null);
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      Draft: "bg-gray-100 text-gray-800 border-gray-300",
      Created: "bg-blue-100 text-blue-800 border-blue-300",
      "Approved by Management":
        "bg-yellow-100 text-yellow-800 border-yellow-300",
      "Make Transaction": "bg-orange-100 text-orange-800 border-orange-300",
      "Approve Transaction": "bg-green-100 text-green-800 border-green-300",
      Cancelled: "bg-red-100 text-red-800 border-red-300",
    };
    return colors[status] || "bg-gray-100 text-gray-800 border-gray-300";
  };

  const getStatusDisplayLabel = (status) => {
    const map = {
      Draft: vi("draft", "Draft"),
      Created: vi("created", "Created"),
      "Approved by Management": vi(
        "approvedByManagement",
        "Approved by Management",
      ),
      "Make Transaction": vi("makeTransaction", "Make Transaction"),
      "Approve Transaction": vi("approveTransaction", "Approve Transaction"),
      Cancelled: vi("cancelled", "Cancelled"),
      Paid: vi("paid", "Paid"),
      Unpaid: vi("unpaid", "Unpaid"),
      "Partial Paid": vi("partialPaid", "Partial Paid"),
    };
    return map[status] || status;
  };

  const getInvoiceTypeColor = (type) => {
    const colors = {
      supplier: "bg-blue-50 text-blue-700",
      commission: "bg-purple-50 text-purple-700",
      logistic: "bg-indigo-50 text-indigo-700",
      Purchase: "bg-green-50 text-green-700",
      Expense: "bg-orange-50 text-orange-700",
    };
    return colors[type] || "bg-gray-50 text-gray-700";
  };

  const handleOpenFile = async (documentId) => {
    if (!documentId) return;

    try {
      const response = await axios.get(
        `${Base_URL}/documents/getFileWithAllData/${documentId}`,
        { headers }
      );
      const fileData = response.data?.data;
      const viewUrl = fileData?.url || fileData?.downloadUrl;

      if (!viewUrl) {
        notifyError(vi("viewLinkUnavailable", "View link not available for this document."));
        return;
      }

      window.open(viewUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("Error getting file:", error);
      notifyError(vi("openDocumentFailed", "Failed to open document. Please try again."));
    }
  };

  const handleDownloadFile = async (documentId) => {
    if (!documentId) return;

    try {
      const response = await axios.get(
        `${Base_URL}/documents/getFileWithAllData/${documentId}`,
        { headers }
      );
      console.log("response", response.data);

      const fileData = response.data?.data;
      const downloadUrl = fileData?.downloadUrl || fileData?.url;
      const fileName = fileData?.name || "document";

      if (!downloadUrl) {
        notifyError(vi("downloadLinkUnavailable", "Download link not available for this document."));
        return;
      }

      await downloadFileFromUrl(downloadUrl, fileName);
    } catch (error) {
      console.error("Error getting file:", error);
      notifyError(vi("downloadFailed", "Failed to download file. Please try again."));
    }
  };

  // Helper function to download file from URL
  const downloadFileFromUrl = async (url, filename) => {
    try {
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      link.style.display = "none";

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      console.log(`File download triggered: ${filename}`);
    } catch (error) {
      console.error("Error downloading file:", error);
      throw error;
    }
  };

  // Bulk payment functions
  const fetchBankAccounts = async () => {
    try {
      // Get business ID from selected invoices
      const businessId =
        selectedInvoices[0]?.business?._id || selectedInvoices[0]?.business;

      if (!businessId) {
        notifyError(vi("businessInfoMissing", "Business information not found in selected invoices"));
        return;
      }

      const response = await axios.get(`${Base_URL}/bank-management/accounts`, {
        params: { business: businessId },
        headers: {
          authorization: `Bearer ${
            JSON.parse(localStorage.getItem("adminInfo"))?.token
          }`,
        },
      });
      setBankAccounts(response.data.accounts || []);
    } catch (error) {
      console.error("Error fetching bank accounts:", error);
      notifyError(vi("fetchBankAccountsFailed", "Failed to fetch bank accounts"));
    }
  };

  const handleSelectInvoice = (invoice) => {
    if (!invoice || !invoice._id) {
      console.error("Invalid invoice passed to handleSelectInvoice:", invoice);
      return;
    }

    if (!VendorInvoiceServices.canInvoiceBeSelected(invoice)) {
      notifyError(vi("invoiceCannotBeSelected", "Invoice cannot be selected for payment"));
      return;
    }

    // Check if this invoice is being added (not removed)
    const isSelected = selectedInvoices.some(
      (inv) => inv && inv._id === invoice._id
    );

    if (!isSelected) {
      // Validate single vendor constraint when adding a new invoice
      if (selectedInvoices.length > 0) {
        const firstVendorId = selectedInvoices[0]?.vendor?._id;
        const newInvoiceVendorId = invoice?.vendor?._id;

        if (
          firstVendorId &&
          newInvoiceVendorId &&
          firstVendorId !== newInvoiceVendorId
        ) {
          notifyError(
            vi(
              "sameVendorOnly",
              "Cannot select invoices from different vendors. Please select invoices from the same vendor only.",
            )
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
      VendorInvoiceServices.getSelectableInvoices(invoices) || [];

    if (selectAll) {
      setSelectedInvoices([]);
    } else {
      // Filter out any undefined/null invoices
      const validInvoices = selectableInvoices.filter(
        (invoice) => invoice && invoice._id
      );

      // Check if there are multiple vendors in the selectable invoices
      const vendorIds = [
        ...new Set(validInvoices.map((inv) => inv.vendor?._id).filter(Boolean)),
      ];

      if (vendorIds.length > 1) {
        notifyError(
          vi(
            "selectAllSameVendorOnly",
            "Cannot select all invoices as they belong to different vendors. Please select invoices from the same vendor only.",
          )
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
      VendorInvoiceServices.getSelectableInvoices(invoices) || [];

    const counts = {
      created: selectableInvoices.filter((inv) => inv.status === "Created")
        .length,
      approvedByManagement: selectableInvoices.filter(
        (inv) => inv.status === "Approved by Management"
      ).length,
      makeTransaction: selectableInvoices.filter(
        (inv) => inv.status === "Make Transaction"
      ).length,
      total: selectableInvoices.length,
    };

    return counts;
  };

  // Select all invoices of a specific status
  const handleSelectAllByStatus = (targetStatus) => {
    const selectableInvoices =
      VendorInvoiceServices.getSelectableInvoices(invoices) || [];

    const statusInvoices = selectableInvoices.filter(
      (invoice) => invoice && invoice._id && invoice.status === targetStatus
    );

    // Check if all invoices of this status are already selected
    const allStatusSelected = statusInvoices.every((invoice) =>
      selectedInvoices.some((selected) => selected._id === invoice._id)
    );

    if (allStatusSelected && statusInvoices.length > 0) {
      // Deselect all invoices of this status
      setSelectedInvoices((prev) =>
        prev.filter(
          (selected) =>
            !statusInvoices.some((statusInv) => statusInv._id === selected._id)
        )
      );
    } else {
      // Validate single vendor constraint when adding new invoices
      if (selectedInvoices.length > 0) {
        const existingVendorId = selectedInvoices[0]?.vendor?._id;
        const statusVendorIds = [
          ...new Set(
            statusInvoices.map((inv) => inv.vendor?._id).filter(Boolean)
          ),
        ];

        if (existingVendorId && statusVendorIds.length > 0) {
          const hasDifferentVendor = statusVendorIds.some(
            (vendorId) => vendorId !== existingVendorId
          );
          if (hasDifferentVendor) {
            notifyError(
              vi(
                "sameVendorOnly",
                "Cannot select invoices from different vendors. Please select invoices from the same vendor only.",
              )
            );
            return;
          }
        }
      } else {
        // If no invoices are currently selected, check if the status invoices have multiple vendors
        const statusVendorIds = [
          ...new Set(
            statusInvoices.map((inv) => inv.vendor?._id).filter(Boolean)
          ),
        ];
        if (statusVendorIds.length > 1) {
          notifyError(
            vi(
              "selectStatusSameVendorOnly",
              "Cannot select all invoices of this status as they belong to different vendors. Please select invoices from the same vendor only.",
            )
          );
          return;
        }
      }

      // Select all invoices of this status (and add to existing selection)
      setSelectedInvoices((prev) => {
        const newSelections = statusInvoices.filter(
          (statusInv) =>
            !prev.some((selected) => selected._id === statusInv._id)
        );
        return [...prev, ...newSelections];
      });
    }

    // Update selectAll state based on whether all selectable invoices are now selected
    const allSelectableSelected = selectableInvoices.every(
      (invoice) =>
        selectedInvoices.some((selected) => selected._id === invoice._id) ||
        statusInvoices.some((statusInv) => statusInv._id === invoice._id)
    );
    setSelectAll(allSelectableSelected && statusInvoices.length > 0);
  };

  // Check if all invoices of a specific status are selected
  const areAllStatusSelected = (targetStatus) => {
    const selectableInvoices =
      VendorInvoiceServices.getSelectableInvoices(invoices) || [];

    const statusInvoices = selectableInvoices.filter(
      (invoice) => invoice && invoice._id && invoice.status === targetStatus
    );

    return (
      statusInvoices.length > 0 &&
      statusInvoices.every((invoice) =>
        selectedInvoices.some((selected) => selected._id === invoice._id)
      )
    );
  };

  const handleOpenBulkPayment = async (mode = "review") => {
    if (selectedInvoices.length === 0) {
      notifyError(vi("selectInvoicesForBulkPayment", "Please select invoices for bulk payment"));
      return;
    }

    // Validate that all selected invoices belong to the same vendor
    const vendorIds = [
      ...new Set(
        selectedInvoices.map((inv) => inv.vendor?._id).filter(Boolean)
      ),
    ];
    if (vendorIds.length > 1) {
      notifyError(
        vi(
          "bulkPaymentSameVendorOnly",
          "Cannot process bulk payment for invoices from different vendors. Please select invoices from the same vendor only.",
        )
      );
      return;
    }

    // Validate that all selected invoices have the same status for workflow operations
    const statuses = [...new Set(selectedInvoices.map((inv) => inv.status))];
    if (mode !== "review" && statuses.length > 1) {
      notifyError(
        vi("sameStatusRequired", "All selected invoices must have the same status for bulk operations")
      );
      return;
    }

    setBulkPaymentLoading(true);
    try {
      // Always load bank accounts so the continuous wizard can reach Make Transaction
      await fetchBankAccounts();
      setBulkPaymentMode(mode);
      setShowBulkPaymentModal(true);
    } catch (error) {
      console.error("Error preparing bulk payment:", error);
      notifyError(vi("prepareBulkPaymentFailed", "Failed to prepare bulk payment"));
    } finally {
      setBulkPaymentLoading(false);
    }
  };

  const handleBulkPaymentComplete = (options = {}) => {
    fetchInvoices(); // Refresh the invoice list so status stays in sync
    if (options?.keepOpen) {
      // Modal stays open on the Complete step
      return;
    }
    setSelectedInvoices([]);
    setSelectAll(false);
    setShowBulkPaymentModal(false);
    notifySuccess(
      vi("bulkPaymentCompleted", "Bulk payment completed successfully!"),
    );
  };

  const handleBulkPaymentStepComplete = () => {
    // Refresh list after each step without closing the continuous wizard
    fetchInvoices();
  };

  const handleCloseBulkPaymentModal = () => {
    setShowBulkPaymentModal(false);
    setSelectedInvoices([]);
    setSelectAll(false);
    fetchInvoices();
  };

  const handleExportExcel = async () => {
    const assignedIds = (businesses || []).map((b) => b._id).filter(Boolean);
    // No date range selected: export all vendor invoices for all assigned businesses
    // Business selected + date range selected: export filtered invoices according to selection
    if (assignedIds.length === 0 && !selectedBusinessFilter) {
      notifyError(
        vi(
          "noAssignedBusinesses",
          "No assigned businesses found. Please select a business or ensure you have business access.",
        ),
      );
      return;
    }
    try {
      setLoading(true);

      const params = {
        ...(selectedBusinessFilter
          ? { business: selectedBusinessFilter }
          : assignedIds.length > 0
          ? { businessIds: assignedIds.join(",") }
          : {}),
        vendor: selectedVendorFilter || undefined,
        type:
          selectedInvoiceTypeFilter !== "All"
            ? selectedInvoiceTypeFilter
            : undefined,
        status:
          selectedInvoiceStatusFilter !== "All"
            ? selectedInvoiceStatusFilter
            : undefined,
        dateCreated: selectedDateCreatedFilter,
        dueDate: selectedDueDateFilter,
        contract:
          selectedPurchaseContractsFilter !== "All"
            ? selectedPurchaseContractsFilter
            : undefined,
        salesContract:
          selectedSalesContractsFilter !== "All"
            ? selectedSalesContractsFilter
            : undefined,
        paymentStatus:
          selectedPaymentStatusFilter !== "All"
            ? selectedPaymentStatusFilter
            : undefined,
        search: searchTerm,
        page: 1,
        limit: 999999, // Get all records
        ...(dateRangeStart && { dateFrom: dateRangeStart }),
        ...(dateRangeEnd && { dateTo: dateRangeEnd }),
      };

      // Remove undefined and empty values
      Object.keys(params).forEach(
        (key) =>
          (params[key] === undefined || params[key] === "") && delete params[key]
      );

      const response = await axios.get(`${Base_URL}/vendor-invoices`, {
        params,
        headers,
      });

      if (!response.data?.success) {
        notifyError(response.data?.message || vi("exportFetchFailed", "Failed to fetch invoices for export"));
        return;
      }
      let allInvoices = response.data.data || [];
      const filterIds = selectedBusinessFilter
        ? [String(selectedBusinessFilter)]
        : (businesses || []).map((b) => String(b._id));
      if (filterIds.length > 0) {
        allInvoices = allInvoices.filter((inv) => {
          const bid = inv.business?._id ?? inv.business ?? inv.business_id?._id ?? inv.business_id;
          if (!bid) return false;
          return filterIds.includes(typeof bid === "string" ? bid : String(bid));
        });
      }

      if (allInvoices.length === 0) {
        const hasDateRange = dateRangeStart || dateRangeEnd;
        notifyError(
          hasDateRange
            ? vi("exportDateRangeNoData", "Selected date range has no data. Please try a different date range.")
            : vi("exportNoData", "No invoices found to export")
        );
        return;
      }

      // Prepare Excel data
      const colInvoiceNumber = vi("exportInvoiceNumber", "Invoice Number");
      const colVendorName = vi("exportVendorName", "Vendor Name");
      const colInvoiceType = vi("exportInvoiceType", "Invoice Type");
      const colContractNo = vi("exportContractNo", "Contract No");
      const colInvoiceDate = vi("exportInvoiceDate", "Invoice Date");
      const colDueDate = vi("exportDueDate", "Due Date");
      const colStatus = vi("exportStatus", "Status");
      const colTotal = vi("exportTotal", "Total");
      const colCurrency = vi("exportCurrency", "Currency");
      const colPaymentStatus = vi("exportPaymentStatus", "Payment Status");
      const colExpenseAccount = vi("exportExpenseAccount", "Expense Account");
      const colCreatedAt = vi("exportCreatedAt", "Created At");
      const colUpdatedAt = vi("exportUpdatedAt", "Updated At");
      const colGrandTotal = vi("exportGrandTotal", "Grand Total");
      const colSubTotal = vi("exportSubTotal", "Sub Total");
      const colDiscount = vi("exportDiscount", "Discount");
      const colShippingCharges = vi("exportShippingCharges", "Shipping Charges");
      const colAdjustment = vi("exportAdjustment", "Adjustment");

      const exportData = allInvoices.map((invoice) => ({
        [colInvoiceNumber]: invoice.invoiceNumber || "",
        [colVendorName]:
          invoice.vendor?.basicInformation?.vendorDisplayName || "",
        [colInvoiceType]: invoice.invoiceType || "",
        // [colContractNo]: invoice.purchaseContract?.contractNo || "",
        [colInvoiceDate]: invoice.invoiceDate
          ? formatDate(invoice.invoiceDate)
          : "",
        [colDueDate]: invoice.dueDate ? formatDate(invoice.dueDate) : "",
        [colStatus]: getStatusDisplayLabel(invoice.status) || "",
        [colTotal]: invoice.total || 0,
        [colCurrency]: invoice.currency || "USD",
        [colPaymentStatus]: (() => {
          const totalAmount = parseFloat(invoice.total) || 0;
          const approvedPayments = Array.isArray(invoice.payments)
            ? invoice.payments.filter((p) => p.status === "Approved")
            : [];
          const paidAmount = approvedPayments.reduce(
            (sum, p) => sum + (parseFloat(p.amount) || 0),
            0
          );
          if (paidAmount === 0) return vi("unpaid", "Unpaid");
          if (paidAmount < totalAmount) return vi("partialPaid", "Partial Paid");
          return vi("paid", "Paid");
        })(),
        [colExpenseAccount]: invoice.expenseAccount?.code
          ? `${invoice.expenseAccount.code} - ${invoice.expenseAccount.accountName}`
          : invoice.expenseAccount?.accountName || "",
        [colCreatedAt]: invoice.createdAt ? formatDate(invoice.createdAt) : "",
        [colUpdatedAt]: invoice.updatedAt ? formatDate(invoice.updatedAt) : "",
      }));

      // Create summary rows
      const emptyExportCols = {
        [colVendorName]: "",
        [colInvoiceType]: "",
        [colContractNo]: "",
        [colInvoiceDate]: "",
        [colDueDate]: "",
        [colStatus]: "",
        [colPaymentStatus]: "",
        [colExpenseAccount]: "",
        [colCreatedAt]: "",
        [colUpdatedAt]: "",
      };
      const summaryRows = [
        {
          [colInvoiceNumber]: vi("vendorInvoicesReport", "Vendor Invoices Report"),
          ...emptyExportCols,
          [colGrandTotal]: "",
          [colCurrency]: "",
        },
        {
          [colInvoiceNumber]: vi("generatedOn", "Generated on: {{date}}", {
            date: formatDate(new Date()),
          }),
          ...emptyExportCols,
          [colGrandTotal]: "",
          [colCurrency]: "",
        },
        {
          [colInvoiceNumber]: vi("totalInvoicesCount", "Total Invoices: {{count}}", {
            count: allInvoices.length,
          }),
          ...emptyExportCols,
          [colSubTotal]: "",
          [colDiscount]: "",
          [colShippingCharges]: "",
          [colAdjustment]: "",
          [colGrandTotal]: "",
          [colCurrency]: "",
        },
        {
          [colInvoiceNumber]: vi("totalValueAmount", "Total Value: {{amount}}", {
            amount: formatAmount(
              allInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0)
            ),
          }),
          ...emptyExportCols,
          [colSubTotal]: "",
          [colDiscount]: "",
          [colShippingCharges]: "",
          [colAdjustment]: "",
          [colGrandTotal]: "",
          [colCurrency]: "",
        },
        {
          [colInvoiceNumber]: "",
          ...emptyExportCols,
          [colSubTotal]: "",
          [colDiscount]: "",
          [colShippingCharges]: "",
          [colAdjustment]: "",
          [colGrandTotal]: "",
          [colCurrency]: "",
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
        vi("title", "Vendor Invoices"),
      );

      // Generate filename
      const filename = `Vendor_Invoices_${
        new Date().toISOString().split("T")[0]
      }.xlsx`;

      // Download file
      XLSX.writeFile(workbook, filename);

      notifySuccess(vi("exportSuccess", "Vendor invoices exported to Excel successfully!"));
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      const errMsg =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message;
      notifyError(errMsg || vi("exportFailed", "Failed to export invoices to Excel. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  // Clear selection when filters change
  useEffect(() => {
    setSelectedInvoices([]);
    setSelectAll(false);
  }, [
    selectedBusinessFilter,
    selectedVendorFilter,
    selectedInvoiceTypeFilter,
    selectedInvoiceStatusFilter,
    selectedPaymentStatusFilter,
    searchTerm,
  ]);

  const vendorInvoiceTableHeaders = useMemo(
    () => [
      "☐",
      vi("invoiceNo", "Invoice No"),
      vi("vendor", "Vendor"),
      ...datatableCustomFields.map((d) => d.label),
      vi("typeStatus", "Type & Status"),
      vi("dates", "Dates"),
      vi("amount", "Amount"),
      vi("expenseAccount", "Expense Account"),
      vi("documents", "Documents"),
      vi("actions", "Actions"),
    ],
    [datatableCustomFields],
  );

  const vendorInvoiceColWidths = useMemo(() => {
    const base = {
      "☐": "50px",
      [vi("invoiceNo", "Invoice No")]: "150px",
      [vi("vendor", "Vendor")]: "240px",
      [vi("typeStatus", "Type & Status")]: "170px",
      [vi("dates", "Dates")]: "180px",
      [vi("amount", "Amount")]: "180px",
      [vi("expenseAccount", "Expense Account")]: "220px",
      [vi("documents", "Documents")]: "220px",
      [vi("actions", "Actions")]: "140px",
    };
    datatableCustomFields.forEach((d) => {
      base[d.label] = "140px";
    });
    return base;
  }, [datatableCustomFields]);

  const summaryCardsData = [
    {
      title: vi("totalInvoices", "Total Invoices"),
      value: overallStats.totalInvoices || 0,
      backgroundColor: "summary-light",
      iconColor: "summary-dark",
      Icon: SummarySvg,
    },
    {
      title: vi("approveTransaction", "Approve Transaction"),
      value: overallStats.approvedTransactions || 0,
      backgroundColor: "completed-light",
      iconColor: "completed-dark",
      Icon: CompletedSvg,
    },
    {
      title: vi("pendingApproval", "Pending Approval"),
      value: overallStats.pendingApproval || 0,
      backgroundColor: "processing-light",
      iconColor: "processing-dark",
      Icon: InProgressSvg,
    },
    {
      title: vi("totalValue", "Total Value"),
      value: `${formatAmount(overallStats.totalValue || 0)}`,
      backgroundColor: "completed-light",
      iconColor: "overdue-dark",
      Icon: DollarSvg,
    },
  ];

  return (
    <div className="bg-gray-50 min-h-screen w-full max-w-full overflow-x-hidden">
      <div className="w-full max-w-full mx-auto px-4 sm:px-6 py-8 min-w-0 overflow-x-hidden">
        {/* Header */}
        <StandardPageHeader
          title={vi("title", "Vendor Invoices")}
          subtitle={vi("subtitle", "Manage and track all vendor invoices")}
          actions={
            <>
              <DateRangePicker
                startDate={dateRangeStart}
                endDate={dateRangeEnd}
                onApply={handleDateRangeApply}
                onClear={handleDateRangeClear}
                placeholder={vi("filterByDateRange", "Filter by date range")}
                className="flex-shrink-0"
              />
              {selectedInvoices.length > 0 && (
                <div className="flex items-center gap-2">
                  {(() => {
                    const statuses = [
                      ...new Set(selectedInvoices.map((inv) => inv.status)),
                    ];
                    const isSameStatus = statuses.length === 1;
                    const currentStatus = statuses[0];

                    // Determine available actions based on status
                    const getAvailableActions = () => {
                      if (!isSameStatus) {
                        return [
                          {
                            label: vi("mixedStatus", "Mixed Status"),
                            action: "review",
                            color: "bg-gray-600 hover:bg-gray-700",
                            icon: CreditCard,
                          },
                        ];
                      }

                      switch (currentStatus) {
                        case "Created":
                          return [
                            {
                              label: vi("preparingInvoice", "Preparing Invoice"),
                              action: "bulk-approve",
                              color: "bg-green-600 hover:bg-green-700",
                              icon: CheckCircle,
                            },
                            {
                              label: vi("review", "Review"),
                              action: "review",
                              color: "bg-[var(--p-blue)] hover:bg-[#9CBA33]",
                              icon: FileText,
                            },
                          ];
                        case "Approved by Management":
                          return [
                            {
                              label: vi("makeTransaction", "Make Transaction"),
                              action: "make-transaction",
                              color: "bg-yellow-600 hover:bg-yellow-700",
                              icon: CreditCard,
                            },
                            {
                              label: vi("review", "Review"),
                              action: "review",
                              color: "bg-[var(--p-blue)] hover:bg-[#9CBA33]",
                              icon: FileText,
                            },
                          ];
                        case "Make Transaction":
                          return [
                            {
                              label: vi(
                                "approvalManagement",
                                "Approval Management",
                              ),
                              action: "approve-transaction",
                              color: "bg-emerald-600 hover:bg-emerald-700",
                              icon: CheckCircle,
                            },
                            {
                              label: vi("review", "Review"),
                              action: "review",
                              color: "bg-[var(--p-blue)] hover:bg-[#9CBA33]",
                              icon: FileText,
                            },
                          ];
                        default:
                          return [
                            {
                              label: vi("reviewSelected", "Review Selected"),
                              action: "review",
                              color: "bg-[var(--p-blue)] hover:bg-[#9CBA33]",
                              icon: FileText,
                            },
                          ];
                      }
                    };

                    const actions = getAvailableActions();

                    return actions.map((actionItem, index) => (
                      <button
                        key={index}
                        className={`flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-3 ${actionItem.color} text-white rounded-lg transition-colors shadow-sm whitespace-nowrap text-sm`}
                        onClick={() => handleOpenBulkPayment(actionItem.action)}
                        disabled={bulkPaymentLoading}
                        title={vi("actionInvoicesTitle", "{{label}} ({{count}} invoices)", {
                          label: actionItem.label,
                          count: selectedInvoices.length,
                        })}
                      >
                        <actionItem.icon size={18} />
                        <span className="hidden sm:inline">
                          {actionItem.label} ({selectedInvoices.length})
                        </span>
                        <span className="sm:hidden">
                          {actionItem.label.split(" ")[0]} (
                          {selectedInvoices.length})
                        </span>
                      </button>
                    ));
                  })()}
                </div>
              )}
              <button
                onClick={handleExportExcel}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ExcelIcon size={18} />
                {loading ? vi("exporting", "Exporting...") : vi("export", "Export")}
              </button>
              <button
                className="flex items-center gap-2 px-4 sm:px-6 py-3 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[#9CBA33] transition-colors shadow-sm whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => canAdd && history.push("/create-vendor-invoice")}
                disabled={!canAdd}
              >
                <Plus size={20} />
                <span className="hidden sm:inline">{vi("createInvoice", "Create Invoice")}</span>
                <span className="sm:hidden">{vi("create", "Create")}</span>
              </button>
            </>
          }
        />

        {/* Stats Cards */}
        <SummaryCards cards={summaryCardsData} columnsCount={4} />

        {/* Selection Controls */}
        {VendorInvoiceServices.getSelectableInvoices(invoices).length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
            <div className="space-y-4">
              {/* Context-Aware Selection Buttons */}
              <div className="flex flex-wrap items-center gap-3">
                {(() => {
                  const counts = getStatusCounts();
                  const selectionButtons = [];

                  // Select All Created (for approval)
                  if (counts.created > 0) {
                    selectionButtons.push(
                      <button
                        key="created"
                        onClick={() => handleSelectAllByStatus("Created")}
                        className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-colors ${
                          areAllStatusSelected("Created")
                            ? "border-[var(--p-blue)] bg-[var(--p-blue)]/10 text-[var(--p-blue)]"
                            : "border-gray-300 hover:bg-gray-50"
                        }`}
                        title={
                          areAllStatusSelected("Created")
                            ? vi(
                                "deselectAllCreatedForApproval",
                                "Deselect all Created invoices for approval",
                              )
                            : vi(
                                "selectAllCreatedForApproval",
                                "Select all Created invoices for approval",
                              )
                        }
                      >
                        {areAllStatusSelected("Created") ? (
                          <CheckSquare
                            size={16}
                            className="text-[var(--p-blue)]"
                          />
                        ) : (
                          <Square size={16} className="text-gray-400" />
                        )}
                        <span className="flex items-center gap-1">
                          <FileText size={14} />
                          {vi(
                            "selectAllToApprove",
                            "Select All ({{count}}) to Approve",
                            { count: counts.created },
                          )}
                        </span>
                      </button>
                    );
                  }

                  // Select All Approved by Management (for transaction preparation)
                  if (counts.approvedByManagement > 0) {
                    selectionButtons.push(
                      <button
                        key="approved"
                        onClick={() =>
                          handleSelectAllByStatus("Approved by Management")
                        }
                        className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-colors ${
                          areAllStatusSelected("Approved by Management")
                            ? "border-yellow-500 bg-yellow-50 text-yellow-700"
                            : "border-gray-300 hover:bg-gray-50"
                        }`}
                        title={
                          areAllStatusSelected("Approved by Management")
                            ? vi(
                                "deselectAllApprovedForPrepare",
                                "Deselect all approved invoices for transaction preparation",
                              )
                            : vi(
                                "selectAllApprovedForPrepare",
                                "Select all approved invoices for transaction preparation",
                              )
                        }
                      >
                        {areAllStatusSelected("Approved by Management") ? (
                          <CheckSquare size={16} className="text-yellow-600" />
                        ) : (
                          <Square size={16} className="text-gray-400" />
                        )}
                        <span className="flex items-center gap-1">
                          <CreditCard size={14} />
                          {vi(
                            "selectAllToPrepare",
                            "Select All ({{count}}) to Prepare",
                            { count: counts.approvedByManagement },
                          )}
                        </span>
                      </button>
                    );
                  }

                  // Select All Make Transaction (for payment approval)
                  if (counts.makeTransaction > 0) {
                    selectionButtons.push(
                      <button
                        key="makeTransaction"
                        onClick={() =>
                          handleSelectAllByStatus("Make Transaction")
                        }
                        className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-colors ${
                          areAllStatusSelected("Make Transaction")
                            ? "border-orange-500 bg-orange-50 text-orange-700"
                            : "border-gray-300 hover:bg-gray-50"
                        }`}
                        title={
                          areAllStatusSelected("Make Transaction")
                            ? vi(
                                "deselectAllPreparedForPayment",
                                "Deselect all prepared transactions for payment approval",
                              )
                            : vi(
                                "selectAllPreparedForPayment",
                                "Select all prepared transactions for payment approval",
                              )
                        }
                      >
                        {areAllStatusSelected("Make Transaction") ? (
                          <CheckSquare size={16} className="text-orange-600" />
                        ) : (
                          <Square size={16} className="text-gray-400" />
                        )}
                        <span className="flex items-center gap-1">
                          <CheckCircle size={14} />
                          {vi(
                            "selectAllToApprovePayment",
                            "Select All ({{count}}) to Approve Payment",
                            { count: counts.makeTransaction },
                          )}
                        </span>
                      </button>
                    );
                  }

                  // Generic Select All (if multiple status types are available)
                  if (counts.total > 0) {
                    selectionButtons.push(
                      <button
                        key="all"
                        onClick={handleSelectAll}
                        className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-colors ${
                          selectAll
                            ? "border-gray-500 bg-gray-50 text-gray-700"
                            : "border-gray-300 hover:bg-gray-50"
                        }`}
                        title={
                          selectAll
                            ? vi(
                                "deselectAllEligible",
                                "Deselect all eligible invoices",
                              )
                            : vi(
                                "selectAllEligible",
                                "Select all eligible invoices",
                              )
                        }
                      >
                        {selectAll ? (
                          <CheckSquare size={16} className="text-gray-600" />
                        ) : (
                          <Square size={16} className="text-gray-400" />
                        )}
                        <span>
                          {selectAll
                            ? vi("deselectAll", "Deselect All")
                            : vi("selectAll", "Select All")}{" "}
                          (
                          {vi("eligibleCount", "{{count}} eligible", {
                            count: counts.total,
                          })}
                          )
                        </span>
                      </button>
                    );
                  }

                  return selectionButtons;
                })()}

                {selectedInvoices.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 ml-auto">
                    <span className="px-2 py-1 bg-[var(--p-blue)]/10 text-[var(--p-blue)] rounded-full font-medium">
                      {selectedInvoices.length === 1
                        ? vi("oneInvoiceSelected", "1 invoice selected")
                        : vi(
                            "nInvoicesSelected",
                            "{{count}} invoices selected",
                            { count: selectedInvoices.length },
                          )}
                    </span>
                    {selectedInvoices.length > 0 && (
                      <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full font-medium text-xs">
                        {vi("vendor", "Vendor")}:{" "}
                        {VendorInvoiceServices.getVendorDisplayName(
                          selectedInvoices[0],
                          vi("unknown", "Unknown"),
                        )}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Selection Summary */}
              {selectedInvoices.length > 0 && (
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">
                      {vi(
                        "selectedInvoicesByStatus",
                        "Selected invoices by status:",
                      )}
                    </span>
                    {(() => {
                      const selectedByStatus = selectedInvoices.reduce(
                        (acc, inv) => {
                          acc[inv.status] = (acc[inv.status] || 0) + 1;
                          return acc;
                        },
                        {}
                      );

                      const statusDisplayLabel = getStatusDisplayLabel;

                      return Object.entries(selectedByStatus).map(
                        ([status, count]) => (
                          <span
                            key={status}
                            className="ml-2 px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                          >
                            {statusDisplayLabel(status)}: {count}
                          </span>
                        )
                      );
                    })()}
                  </div>

                  <div className="text-sm text-[var(--p-blue)] font-medium">
                    {vi("totalSelected", "Total Selected")}:{" "}
                    {VendorInvoiceServices.formatCurrency(
                      selectedInvoices.reduce(
                        (sum, inv) => sum + (inv.remainingAmount || 0),
                        0
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <DataTable
            filters={filters}
            headersWithoutCellTooltip={[vi("amount", "Amount")]}
            currentPage={currentPage}
            totalPages={totalPages}
            totalRecords={overallStats.totalInvoices}
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
            searchPlaceholder={vi("search", "Search...")}
            headers={vendorInvoiceTableHeaders}
            data={invoices}
            loading={loading || !columnDefsReady}
            colWidths={vendorInvoiceColWidths}
            renderRow={(invoice) => (
              <tr
                key={invoice._id}
                className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
              >
                {/* Select Checkbox */}
                <td className="py-3 px-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectInvoice(invoice);
                    }}
                    className={`flex items-center justify-center w-5 h-5 rounded border-2 transition-colors ${
                      VendorInvoiceServices.canInvoiceBeSelected(invoice)
                        ? "border-gray-300 hover:border-blue-500"
                        : "border-gray-200 cursor-not-allowed opacity-50"
                    }`}
                    disabled={
                      !VendorInvoiceServices.canInvoiceBeSelected(invoice)
                    }
                  >
                    {selectedInvoices.some((inv) => inv._id === invoice._id) ? (
                      <CheckSquare size={16} className="text-blue-600" />
                    ) : (
                      <Square size={16} className="text-gray-400" />
                    )}
                  </button>
                </td>

                {/* Invoice Details */}
                <td className="py-3 px-3">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() =>
                        canOpenInvoice &&
                        history.push(`/view-vendor-invoice/${invoice._id}`)
                      }
                      className={`font-semibold text-sm truncate ${
                        canOpenInvoice
                          ? "text-[var(--p-blue)] hover:underline"
                          : "text-gray-900"
                      }`}
                      disabled={!canOpenInvoice}
                    >
                      #{invoice.invoiceNumber}
                    </button>
                    {invoice.purchaseContract?.contractNo && (
                      <p className="text-xs text-gray-500 truncate">
                        {vi("contract", "Contract")}: {invoice.purchaseContract.contractNo}
                      </p>
                    )}
                  </div>
                </td>

                {/* Vendor */}
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="p-1.5 bg-gray-100 rounded-lg flex-shrink-0">
                      <User size={14} className="text-gray-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 text-sm truncate">
                        {VendorInvoiceServices.getVendorDisplayName(
                          invoice,
                          "—",
                        )}
                      </p>
                      <p className="text-xs text-gray-500">{vi("vendor", "Vendor")}</p>
                    </div>
                  </div>
                </td>

                {datatableCustomFields.map((cfDef) => (
                  <td
                    key={cfDef.field_key}
                    className="py-3 px-3 text-sm text-gray-800 max-w-[200px]"
                  >
                    <span
                      className="line-clamp-2 break-words"
                      title={formatVendorInvoiceCfCell(
                        cfDef,
                        invoice.customFieldValues?.[cfDef.field_key],
                        { yes: vi("yes", "Yes"), no: vi("no", "No") },
                      )}
                    >
                      {formatVendorInvoiceCfCell(
                        cfDef,
                        invoice.customFieldValues?.[cfDef.field_key],
                        { yes: vi("yes", "Yes"), no: vi("no", "No") },
                      )}
                    </span>
                  </td>
                ))}

                {/* Type & Status */}
                <td className="py-3 px-3">
                  <div className="space-y-1">
                    <span
                      className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getInvoiceTypeColor(
                        invoice.invoiceType
                      )}`}
                    >
                      {invoice.invoiceType}
                    </span>
                    <br />
                    <span
                      className={`inline-block px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                        invoice.status
                      )}`}
                    >
                      {getStatusDisplayLabel(invoice.status)}
                    </span>

                    {/* Payment Status Badge */}
                    {(() => {
                      const totalAmount = parseFloat(invoice.total) || 0;
                      const hasPendingClearance =
                        invoice.paymentStatus === "Pending Clearance" ||
                        (Array.isArray(invoice.payments) &&
                          invoice.payments.some(
                            (p) => p.status === "Pending Clearance",
                          ));
                      if (hasPendingClearance) {
                        return (
                          <div className="mt-1">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-200">
                              <div className="w-1.5 h-1.5 bg-amber-500 rounded-full mr-1"></div>
                              {vi("pendingClearance", "Pending Clearance")}
                            </span>
                          </div>
                        );
                      }
                      // Calculate paid amount from approved payments only
                      const approvedPayments = Array.isArray(invoice.payments)
                        ? invoice.payments.filter(
                            (p) => p.status === "Approved"
                          )
                        : [];
                      const paidAmount = approvedPayments.reduce(
                        (sum, p) => sum + (parseFloat(p.amount) || 0),
                        0
                      );
                      const remainingAmount = totalAmount - paidAmount;

                      if (paidAmount === 0) {
                        return (
                          <div className="mt-1">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
                              <div className="w-1.5 h-1.5 bg-red-500 rounded-full mr-1"></div>
                              {vi("unpaid", "Unpaid")}
                            </span>
                          </div>
                        );
                      } else if (paidAmount < totalAmount) {
                        return (
                          <div className="mt-1">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 border border-yellow-200">
                              <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full mr-1"></div>
                              {vi("partial", "Partial")}
                            </span>
                            <div className="text-xs text-gray-500 mt-1 truncate">
                              {formatCurrencyAmount(invoice.currency, paidAmount)} /{" "}
                              {formatCurrencyAmount(invoice.currency, totalAmount)}
                            </div>
                          </div>
                        );
                      } else {
                        return (
                          <div className="mt-1">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200">
                              <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1"></div>
                              {vi("paid", "Paid")}
                            </span>
                          </div>
                        );
                      }
                    })()}
                  </div>
                </td>

                {/* Dates */}
                <td className="py-3 px-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <Calendar
                        size={12}
                        className="text-gray-400 flex-shrink-0"
                      />
                      <span className="text-xs text-gray-600 truncate">
                        {formatDate(invoice.invoiceDate)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock
                        size={12}
                        className="text-gray-400 flex-shrink-0"
                      />
                      <span className="text-xs text-gray-600 truncate">
                        {vi("due", "Due")}: {formatDate(invoice.dueDate)}
                      </span>
                    </div>
                  </div>
                </td>

                {/* Amount */}
                <td className="py-3 px-3">
                  <div className="text-center">
                    <p className="font-bold text-sm text-gray-900 whitespace-nowrap">
                      {formatCurrencyAmount(invoice.currency, invoice.total)}
                    </p>
                  </div>
                </td>

                {/* Expense Account */}
                <td className="py-4 px-4">
                  <div>
                    {invoice.expenseAccount ? (
                      <div>
                        <p className="font-medium text-gray-900">
                          {invoice.expenseAccount.code || vi("na", "N/A")} -{" "}
                          {invoice.expenseAccount.accountName ||
                            vi("unknownAccount", "Unknown Account")}
                        </p>
                        <p className="text-xs text-gray-500">
                          {invoice.expenseAccount.accountType?.name ||
                            invoice.expenseAccount.accountType?.accountHeader ||
                            ""}
                        </p>
                      </div>
                    ) : (
                      <span className="text-gray-400 italic">
                        {vi("noAccountSpecified", "No account specified")}
                      </span>
                    )}
                  </div>
                </td>

                {/* Documents */}
                <td className="py-3 px-3">
                  <div className="space-y-1 max-w-full">
                    {invoice.documents && invoice.documents.length > 0 ? (
                      <>
                        {invoice.documents.slice(0, 1).map((doc, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-lg text-xs hover:bg-gray-100 transition-colors"
                          >
                            <File
                              size={12}
                              className="text-gray-500 flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <span
                                className="text-xs font-medium truncate block"
                                title={doc.name}
                              >
                                {doc.name}
                              </span>
                              <div className="flex items-center gap-1">
                                <span
                                  className={`text-xs px-1 py-0.5 rounded ${
                                    doc.documentType === "Supporting"
                                      ? "bg-blue-100 text-blue-600"
                                      : "bg-green-100 text-green-600"
                                  }`}
                                >
                                  {doc.documentType}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={() => handleDownloadFile(doc.fileId)}
                                className="text-[var(--p-blue)] hover:text-[#9CBA33] p-0.5 rounded hover:bg-white transition-colors"
                                title={vi("downloadDoc", "Download {{name}}", {
                                  name: doc.name,
                                })}
                              >
                                <Download size={10} />
                              </button>
                              <button
                                onClick={() => handleOpenFile(doc.fileId)}
                                className="text-[var(--p-blue)] hover:text-[#9CBA33] p-0.5 rounded hover:bg-white transition-colors"
                                title={vi("viewDoc", "View {{name}}", {
                                  name: doc.name,
                                })}
                              >
                                <Eye size={10} />
                              </button>
                            </div>
                          </div>
                        ))}
                        {invoice.documents.length > 1 && (
                          <div className="text-xs text-gray-500 px-1 py-0.5">
                            +{invoice.documents.length - 1} {vi("more", "more")}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center gap-1 text-gray-400 text-xs p-1">
                        <File size={12} />
                        <span>{vi("noDocuments", "No documents")}</span>
                      </div>
                    )}
                  </div>
                </td>

                {/* Actions */}
                <td className="py-3 px-3">
                  <div className="flex items-center gap-1">
                    <button
                      className="p-1.5 text-gray-500 hover:text-[var(--p-blue)] hover:bg-[var(--p-blue)]/10 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      onClick={() =>
                        canOpenInvoice &&
                        history.push(`/view-vendor-invoice/${invoice._id}`)
                      }
                      title={vi("viewInvoice", "View Invoice")}
                      disabled={!canOpenInvoice}
                    >
                      <Eye size={14} />
                    </button>
                    {(() => {
                      const totalAmount = parseFloat(invoice.total) || 0;
                      const approvedPayments = Array.isArray(invoice.payments)
                        ? invoice.payments.filter((p) => p && p.status === "Approved")
                        : [];
                      const paidAmount = approvedPayments.reduce(
                        (sum, p) => sum + (parseFloat(p.amount) || 0),
                        0
                      );
                      const isPaidOrPartial = paidAmount > 0;
                      if (!isPaidOrPartial) {
                        return (
                          <button
                            className="p-1.5 text-gray-500 hover:text-[var(--p-blue)] hover:bg-[var(--p-blue)]/10 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            onClick={() =>
                              canUpdate &&
                              history.push(`/update-vendor-invoice/${invoice._id}`)
                            }
                            title={vi("editInvoice", "Edit Invoice")}
                            disabled={!canUpdate}
                          >
                            <PenSquare size={14} />
                          </button>
                        );
                      }
                      return null;
                    })()}
                    {canDelete && (
                      <button
                        className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                        onClick={() => handleDeleteInvoice(invoice)}
                        title={vi("deleteInvoice", "Delete Invoice")}
                        disabled={!canDelete}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          />
        </div>
      </div>

      {/* Bulk Payment Modal */}
      <BulkPaymentModal
        isOpen={showBulkPaymentModal}
        toggle={handleCloseBulkPaymentModal}
        selectedInvoices={selectedInvoices
          .filter((invoice) => invoice && invoice._id) // Filter out undefined/null invoices
          .map((invoice) => ({
            ...invoice,
            remainingAmount: (() => {
              const totalAmount = parseFloat(invoice.total) || 0;
              const approvedPayments = Array.isArray(invoice.payments)
                ? invoice.payments.filter((p) => p && p.status === "Approved")
                : [];
              const paidAmount = approvedPayments.reduce(
                (sum, p) => sum + (parseFloat(p.amount) || 0),
                0
              );
              return totalAmount - paidAmount;
            })(),
          }))}
        onPaymentComplete={handleBulkPaymentComplete}
        onStepComplete={handleBulkPaymentStepComplete}
        bankAccounts={bankAccounts}
        mode={bulkPaymentMode}
      />
      {confirmDeleteOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-[400px] max-w-[90%]">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              {vi("deleteVendorInvoice", "Delete Vendor Invoice")}
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              {vi("confirmDeletePrompt", "Are you sure you want to delete")}{" "}
              <span className="font-medium">
                {pendingDeleteInvoice?.invoiceNo || vi("thisInvoice", "this invoice")}
              </span>
              ? {vi("actionCannotBeUndone", "This action cannot be undone.")}
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
                {vi("cancel", "Cancel")}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={confirmDeleteInvoice}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60"
              >
                {loading ? vi("deleting", "Deleting...") : vi("delete", "Delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
