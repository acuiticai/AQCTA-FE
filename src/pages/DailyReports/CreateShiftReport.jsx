import { useState, useEffect, useContext, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useHistory, useLocation, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Save,
  Send,
  Plus,
  Trash2,
  X,
  DollarSign,
  Users,
  Clock,
  Wallet,
  FileText,
  AlertTriangle,
  CheckCircle,
  Building,
  Calendar,
  Package,
  Upload,
  Edit,
  Eye,
  ChevronDown,
  ChevronUp,
  Receipt,
} from "lucide-react";
import axios from "axios";
import { AdminContext } from "@/context/AdminContext";
import { useDailyReportsPermissions } from "@/hooks/useDailyReportsPermissions";
import { Page, Form, FormInput } from "@/page-layouts/index";
import { notifySuccess, notifyError } from "@/utils/toast";
import { formatAmount } from "@/components/formatAmount";
import DailyReportsService, {
  resolveDailyReportsScopeFromPath,
  setDailyReportsApiScope,
} from "@/services/dailyReportsService";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

/** Prefer API validation message over generic axios "Request failed with status code 400". */
const getApiErrorMessage = (error, fallback) => {
  const data = error?.response?.data;
  if (typeof data === "string" && data.trim()) return data.trim();
  if (data?.message) return data.message;
  if (typeof data?.error === "string" && data.error.trim()) return data.error.trim();
  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    return data.errors.map((e) => (typeof e === "string" ? e : e?.message)).filter(Boolean).join(", ");
  }
  const msg = error?.message;
  if (msg && !/^Request failed with status code \d+$/i.test(msg)) return msg;
  return fallback;
};

export default function CreateShiftReport() {
  const { t } = useTranslation();
  const { id } = useParams();
  const isEdit = !!id;
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const history = useHistory();
  const location = useLocation();
  const { isCreateOnly } = useDailyReportsPermissions();
  const backTarget =
    location.state?.returnTo || (isCreateOnly ? "/home" : "/daily-reports/");

  useEffect(() => {
    setDailyReportsApiScope(
      resolveDailyReportsScopeFromPath(backTarget || location.pathname)
    );
  }, [backTarget, location.pathname]);

  // State
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  // Master data
  const [businesses, setBusinesses] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [channels, setChannels] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [transactionTypes, setTransactionTypes] = useState([]);
  const [advanceTypes, setAdvanceTypes] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [staff, setStaff] = useState([]);

  // Form data
  const [formData, setFormData] = useState({
    business: "",
    businessDate: new Date().toISOString().split("T")[0],
    shiftId: "",
    shiftNo: 1,
    openingCash: 0,
    declaredCashOnHand: 0,
    notes: "",
    remarks: "",
  });

  // Form validation errors
  const [errors, setErrors] = useState({});

  // Collections
  const [collections, setCollections] = useState([]);

  // Supplier Payments
  const [supplierPayments, setSupplierPayments] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState("");
  const [vendorInvoices, setVendorInvoices] = useState([]);
  const [showInvoicesSection, setShowInvoicesSection] = useState(true);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState([]);
  const [allocationPreview, setAllocationPreview] = useState(null);
  const [showAllocationPreview, setShowAllocationPreview] = useState(false);
  
  // Late Transaction Supplier Payment
  const [lateSelectedInvoiceIds, setLateSelectedInvoiceIds] = useState([]);
  const [lateAllocationPreview, setLateAllocationPreview] = useState(null);

  // Staff Advances
  const [staffAdvances, setStaffAdvances] = useState([]);

  // Late Transactions
  const [lateTransactions, setLateTransactions] = useState([]);

  // Unified Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState(null); // null, 'collection', 'supplier', 'advance', 'late'
  const [editingItem, setEditingItem] = useState(null); // Item being edited (id or _id)
  const [editingGroupIds, setEditingGroupIds] = useState([]); // When editing grouped row, ids to remove on save
  const [editingType, setEditingType] = useState(null); // Type of item being edited
  
  // Document Viewer Modal
  const [showDocumentsModal, setShowDocumentsModal] = useState(false);
  const [selectedTransactionDocuments, setSelectedTransactionDocuments] = useState([]);
  
  const [unifiedForm, setUnifiedForm] = useState({
    // Collection fields
    channelId: "",
    paymentMethodId: "",
    amount: "",
    referenceNo: "",
    // Supplier Payment fields
    supplierId: "",
    amountPaid: "",
    // Staff Advance fields
    employeeId: "",
    advanceType: "",
    // Late Transaction fields
    txnType: "",
    source: "MANUAL",
    reason: "",
    transactionType: "", // COLLECTION, SUPPLIER_PAYMENT, ADVANCE
    // Common fields
    notes: "",
    documents: [],
  });

  // Shift Report ID (for editing)
  const [shiftReportId, setShiftReportId] = useState(null);

  // DB ids loaded when editing — used to delete line items removed from the UI on save
  const initialLineItemIdsRef = useRef({
    collections: [],
    supplierPayments: [],
    staffAdvances: [],
    lateTransactions: [],
  });

  // Business base currency for payment display (dynamic, fallback MYR)
  const [baseCurrencySymbol, setBaseCurrencySymbol] = useState("MYR");

  // Document upload (same approach as Vendor Invoices)
  const [docUploadLoading, setDocUploadLoading] = useState(false);
  const [docUploadProgress, setDocUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const documentsInputRef = useRef(null);

  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo?.token}`,
  };

  // Format amount with business base currency for payment display (fallback MYR)
  const formatPayment = (amount) => `${formatAmount(amount)} ${baseCurrencySymbol}`;

  // Load assigned businesses only (same as Daily Reports list / dashboard)
  useEffect(() => {
    const adminId = adminInfo?.id || adminInfo?._id;
    if (!adminId) return;

    const fetchAssigned = async () => {
      try {
        const res = await axios.get(`${Base_URL}/admin/assigned/${adminId}`, { headers });
        const list = res.data?.businesses || [];
        setBusinesses(list);
        if (list.length === 1 && !formData.business && !isEdit) {
          setFormData((prev) => ({ ...prev, business: list[0]._id }));
        }
      } catch (err) {
        console.error("Failed to fetch assigned businesses:", err);
        setBusinesses([]);
      }
    };

    fetchAssigned();
  }, [adminInfo?.id, adminInfo?._id]);

  // Load master data when business changes
  useEffect(() => {
    if (formData.business) {
      fetchShifts();
      fetchChannels();
      fetchPaymentMethods();
      fetchTransactionTypes();
      fetchAdvanceTypes();
      fetchVendors();
      fetchStaff();
    }
  }, [formData.business]);

  // Fetch business base currency for payment display (dynamic, fallback MYR)
  useEffect(() => {
    if (!formData.business) {
      setBaseCurrencySymbol("MYR");
      return;
    }
    const fetchBaseCurrency = async () => {
      try {
        const res = await axios.get(
          `${Base_URL}/finance/currencies?business_id=${formData.business}`,
          { headers }
        );
        const currencies = res.data?.data || [];
        const base = currencies.find((c) => c.is_base === true);
        const symbol = base?.symbol || base?.name || "MYR";
        setBaseCurrencySymbol(symbol);
      } catch (err) {
        console.warn("Failed to fetch base currency, using MYR:", err);
        setBaseCurrencySymbol("MYR");
      }
    };
    fetchBaseCurrency();
  }, [formData.business]);

  // Load existing report if editing
  useEffect(() => {
    if (isEdit && id) {
      fetchExistingReport();
    }
  }, [id]);

  // Auto-detect shift based on time
  useEffect(() => {
    if (!isEdit && shifts.length > 0) {
      const hour = new Date().getHours();
      const isMorning = hour < 14;

      // Find matching shift
      const matchingShift = shifts.find((s) => {
        if (isMorning) {
          return (
            s.name?.toLowerCase().includes("morning") ||
            s.name?.toLowerCase().includes("day") ||
            parseInt(s.startTime?.split(":")[0]) < 12 ||
            s.shiftNo === 1
          );
        }
        return (
          s.name?.toLowerCase().includes("evening") ||
          s.name?.toLowerCase().includes("night") ||
          parseInt(s.startTime?.split(":")[0]) >= 12 ||
          s.shiftNo === 2
        );
      });

      if (matchingShift) {
        setFormData((prev) => ({ 
          ...prev, 
          shiftId: matchingShift._id,
          shiftNo: matchingShift.shiftNo || (isMorning ? 1 : 2) // Use shift's shiftNo if available
        }));
      } else {
        // Fallback: set shiftNo based on time if no matching shift found
        setFormData((prev) => ({ ...prev, shiftNo: isMorning ? 1 : 2 }));
      }
    }
  }, [shifts, isEdit]);

  // Update shiftNo when shiftId changes (for create mode)
  useEffect(() => {
    if (!isEdit && formData.shiftId && shifts.length > 0) {
      const selectedShift = shifts.find((s) => s._id === formData.shiftId);
      if (selectedShift && selectedShift.shiftNo) {
        setFormData((prev) => ({ ...prev, shiftNo: selectedShift.shiftNo }));
      }
    }
  }, [formData.shiftId, shifts, isEdit]);

  const fetchExistingReport = async () => {
    setLoading(true);
    try {
      const response = await DailyReportsService.getShiftReportById(id);
      if (response?.success && response.data) {
        const { report, collections: cols, supplierPayments: payments, staffAdvances: advances, lateTransactions: late } = response.data;

        setShiftReportId(report._id);
        setFormData({
          business: report.business?._id || report.business,
          businessDate: report.businessDate,
          shiftId: report.shiftId?._id || report.shiftId,
          shiftNo: report.shiftNo,
          openingCash: report.cashSummary?.openingCash || 0,
          declaredCashOnHand: report.cashSummary?.declaredCashOnHand || 0,
          notes: report.notes || "",
          remarks: report.remarks || "",
        });
        // Clear any validation errors when loading existing data
        setErrors({});

        // Map documents to frontend format for collections
        const mappedCollections = (cols || []).map((col) => ({
          ...col,
          documents: (col.documents || []).map((doc) => ({
            fileId: doc.fileId?._id || doc.fileId || doc._id,
            name: doc.name || t("dailyReports.common.document"),
            url: doc.url || "",
            downloadUrl: doc.downloadUrl || doc.url || "",
            size: doc.file_size || doc.size || 0,
            type: doc.file_type || doc.type || "",
            uploadedAt: doc.uploadedAt || new Date().toISOString(),
          })),
        }));

        // Map documents for supplier payments
        const mappedSupplierPayments = (payments || []).map((pay) => ({
          ...pay,
          documents: (pay.documents || []).map((doc) => ({
            fileId: doc.fileId?._id || doc.fileId || doc._id,
            name: doc.name || t("dailyReports.common.document"),
            url: doc.url || "",
            downloadUrl: doc.downloadUrl || doc.url || "",
            size: doc.file_size || doc.size || 0,
            type: doc.file_type || doc.type || "",
            uploadedAt: doc.uploadedAt || new Date().toISOString(),
          })),
        }));

        // Map documents for staff advances
        const mappedStaffAdvances = (advances || []).map((adv) => ({
          ...adv,
          documents: (adv.documents || []).map((doc) => ({
            fileId: doc.fileId?._id || doc.fileId || doc._id,
            name: doc.name || t("dailyReports.common.document"),
            url: doc.url || "",
            downloadUrl: doc.downloadUrl || doc.url || "",
            size: doc.file_size || doc.size || 0,
            type: doc.file_type || doc.type || "",
            uploadedAt: doc.uploadedAt || new Date().toISOString(),
          })),
        }));

        // Map documents for late transactions
        const mappedLateTransactions = (late || []).map((trans) => ({
          ...trans,
          documents: (trans.documents || []).map((doc) => ({
            fileId: doc.fileId?._id || doc.fileId || doc._id,
            name: doc.name || t("dailyReports.common.document"),
            url: doc.url || "",
            downloadUrl: doc.downloadUrl || doc.url || "",
            size: doc.file_size || doc.size || 0,
            type: doc.file_type || doc.type || "",
            uploadedAt: doc.uploadedAt || new Date().toISOString(),
          })),
        }));

        setCollections(mappedCollections);
        setSupplierPayments(mappedSupplierPayments);
        setStaffAdvances(mappedStaffAdvances);
        setLateTransactions(mappedLateTransactions);

        initialLineItemIdsRef.current = {
          collections: mappedCollections.map((c) => c._id).filter(Boolean).map(String),
          supplierPayments: mappedSupplierPayments.map((p) => p._id).filter(Boolean).map(String),
          staffAdvances: mappedStaffAdvances.map((a) => a._id).filter(Boolean).map(String),
          lateTransactions: mappedLateTransactions.map((t) => t._id).filter(Boolean).map(String),
        };
      }
    } catch (error) {
      console.error("Error fetching report:", error);
      notifyError(t("dailyReports.messages.error.loadReport"));
    } finally {
      setLoading(false);
    }
  };

  const fetchShifts = async () => {
    try {
      const response = await axios.post(
        `${Base_URL}/shifts/get_all`,
        { business_id: formData.business, FilterStatus: "", FilterName: "" },
        { headers }
      );
      setShifts(response.data.data || []);
    } catch (error) {
      console.error("Error fetching shifts:", error);
    }
  };

  const fetchChannels = async () => {
    try {
      const response = await DailyReportsService.getAllChannels(formData.business);
      setChannels(response?.data || []);
    } catch (error) {
      console.error("Error fetching channels:", error);
    }
  };

  const fetchPaymentMethods = async () => {
    try {
      const response = await DailyReportsService.getAllPaymentMethods(formData.business);
      const methods = response?.data || [];
      setPaymentMethods(methods);
    } catch (error) {
      console.error("Error fetching payment methods:", error);
      setPaymentMethods([]);
    }
  };

  // Get payment methods filtered by channel
  const getPaymentMethodsForChannel = (channelId) => {
    if (!channelId) return paymentMethods;
    const channel = channels.find(c => c._id === channelId);
    if (!channel || !channel.paymentMethods || channel.paymentMethods.length === 0) {
      // If channel has no payment methods assigned, show all (backward compatibility)
      return paymentMethods;
    }
    const channelPaymentMethodIds = channel.paymentMethods.map(pm => pm._id || pm);
    return paymentMethods.filter(pm => channelPaymentMethodIds.includes(pm._id));
  };

  // Calculate balances
  const calculateBalances = () => {
    let cashSales = 0;
    let cashPayouts = 0;
    let onlineSales = 0;
    let onlinePayouts = 0;

    // Helper to get payment method type - handles both populated objects and IDs
    const getPaymentMethodType = (paymentMethodId) => {
      if (!paymentMethodId) return "Cash"; // Default to Cash for backward compatibility
      
      // If it's already a populated object with type, use it
      if (typeof paymentMethodId === "object" && paymentMethodId.type) {
        return paymentMethodId.type;
      }
      
      // If it's a string ID or object with _id, look it up in paymentMethods array
      const pmId = typeof paymentMethodId === "object" ? paymentMethodId._id : paymentMethodId;
      const pm = paymentMethods.find(p => p._id === pmId || p._id?.toString() === pmId?.toString());
      return pm?.type || "Cash";
    };

    // Calculate from collections
    collections.forEach((c) => {
      const pmType = getPaymentMethodType(c.paymentMethodId);
      const amount = parseFloat(c.amount || 0) + (parseFloat(c.cents || 0) / 100);
      if (pmType === "Cash") {
        cashSales += amount;
      } else {
        onlineSales += amount;
      }
    });

    // Calculate from supplier payments
    supplierPayments.forEach((p) => {
      const pmType = getPaymentMethodType(p.paymentMethodId);
      const amount = parseFloat(p.amountPaid || 0) + (parseFloat(p.cents || 0) / 100);
      if (pmType === "Cash") {
        cashPayouts += amount;
      } else {
        onlinePayouts += amount;
      }
    });

    // Calculate from staff advances
    staffAdvances.forEach((a) => {
      const pmType = getPaymentMethodType(a.paymentMethodId);
      const amount = parseFloat(a.amount || 0) + (parseFloat(a.cents || 0) / 100);
      if (pmType === "Cash") {
        cashPayouts += amount;
      } else {
        onlinePayouts += amount;
      }
    });

    // Calculate from late transactions
    lateTransactions.forEach((lt) => {
      const pmType = getPaymentMethodType(lt.paymentMethodId);
      const amount = parseFloat(lt.amount || 0);
      
      if (lt.transactionType === "COLLECTION") {
        if (pmType === "Cash") {
          cashSales += amount;
        } else {
          onlineSales += amount;
        }
      } else if (lt.transactionType === "SUPPLIER_PAYMENT" || lt.transactionType === "ADVANCE") {
        if (pmType === "Cash") {
          cashPayouts += amount;
        } else {
          onlinePayouts += amount;
        }
      }
    });

    return {
      cashSales,
      cashPayouts,
      cashBalance: cashSales - cashPayouts,
      onlineSales,
      onlinePayouts,
      onlineBalance: onlineSales - onlinePayouts,
    };
  };

  const balances = calculateBalances();

  const fetchTransactionTypes = async () => {
    try {
      const response = await DailyReportsService.getAllTransactionTypes(formData.business);
      const types = response?.data || [];
      setTransactionTypes(types);
    } catch (error) {
      console.error("Error fetching transaction types:", error);
      setTransactionTypes([]);
    }
  };

  const fetchAdvanceTypes = async () => {
    try {
      const response = await DailyReportsService.getAllAdvanceTypes(formData.business);
      const types = response?.data || [];
      setAdvanceTypes(types);
    } catch (error) {
      console.error("Error fetching advance types:", error);
      setAdvanceTypes([]);
    }
  };

  const fetchVendors = async () => {
    try {
      const response = await axios.get(`${Base_URL}/vendors`, {
        headers,
        params: { business: formData.business },
      });
      setVendors(response.data.data || response.data || []);
    } catch (error) {
      console.error("Error fetching vendors:", error);
    }
  };

  const fetchStaff = async () => {
    try {
      const response = await axios.get(`${Base_URL}/staff-management`, {
        headers,
        params: { business: formData.business, limit: 1000 },
      });
      setStaff(response.data.staffList || response.data.data || []);
    } catch (error) {
      console.error("Error fetching staff:", error);
    }
  };

  const fetchVendorInvoices = async (vendorId) => {
    console.log("🔍 Fetching vendor invoices for vendorId:", vendorId);
    try {
      const response = await DailyReportsService.getSupplierOutstandingInvoices(
        vendorId,
        formData.business
      );
      console.log("🔍 Vendor Invoices response:", response?.data);
      let invoices = response?.data || [];
      
      // Apply pending allocations from payments in the list for this supplier
      const pendingPayments = supplierPayments.filter(p => p.supplierId === vendorId && p.allocations && p.allocations.length > 0);
      // Also include late transactions of type SUPPLIER_PAYMENT for this supplier
      const pendingLatePayments = lateTransactions.filter(t => t.transactionType === "SUPPLIER_PAYMENT" && t.supplierId === vendorId && t.allocations && t.allocations.length > 0);
      
      if (pendingPayments.length > 0 || pendingLatePayments.length > 0) {
        invoices = invoices.map(invoice => {
          let totalAllocated = 0;
          
          // Add allocations from regular supplier payments
          pendingPayments.forEach(payment => {
            const allocation = payment.allocations.find(alloc => alloc.invoiceId === invoice._id);
            if (allocation) {
              totalAllocated += allocation.allocatedAmount;
            }
          });
          
          // Add allocations from late transaction supplier payments
          pendingLatePayments.forEach(transaction => {
            const allocation = transaction.allocations.find(alloc => alloc.invoiceId === invoice._id);
            if (allocation) {
              totalAllocated += allocation.allocatedAmount;
            }
          });
          
          if (totalAllocated > 0) {
            const newRemainingAmount = Math.max(0, (invoice.remainingAmount || invoice.total || 0) - totalAllocated);
            const newAmountPaid = (invoice.amountPaid || 0) + totalAllocated;
            return {
              ...invoice,
              remainingAmount: newRemainingAmount,
              amountPaid: newAmountPaid,
              paymentStatus: newRemainingAmount <= 0 ? "Paid" : (newAmountPaid > 0 ? "Partially Paid" : invoice.paymentStatus),
            };
          }
          return invoice;
        }).filter(invoice => {
          // Keep invoices that are not fully paid
          return invoice.remainingAmount > 0 || invoice.paymentStatus !== "Paid";
        });
      }
      
      setVendorInvoices(invoices);
      setSelectedInvoiceIds([]); // Reset selection when supplier changes
      setAllocationPreview(null);
    } catch (error) {
      console.error("Error fetching vendor invoices:", error);
    }
  };

  // Auto-populate amount when invoices are selected or unselected (for supplier payments)
  useEffect(() => {
    if (modalType === "supplier" && vendorInvoices.length > 0) {
      if (selectedInvoiceIds.length > 0) {
        const selectedInvoices = vendorInvoices.filter(inv => selectedInvoiceIds.includes(inv._id));
        const totalOutstanding = selectedInvoices.reduce(
          (sum, inv) => sum + parseFloat(inv.remainingAmount || inv.total || 0),
          0
        );
        
        // Auto-populate amount field
        setUnifiedForm((prev) => ({
          ...prev,
          amountPaid: totalOutstanding.toFixed(2)
        }));
        
        // Fetch allocation preview
        if (totalOutstanding > 0 && unifiedForm.supplierId) {
          fetchAllocationPreview(unifiedForm.supplierId, totalOutstanding, selectedInvoiceIds);
        }
      } else {
        // No invoices selected - clear amount and allocation preview
        setUnifiedForm((prev) => ({
          ...prev,
          amountPaid: ""
        }));
        setAllocationPreview(null);
      }
    } else if (modalType === "supplier" && selectedInvoiceIds.length === 0) {
      setAllocationPreview(null);
    }
  }, [selectedInvoiceIds, vendorInvoices, modalType]);

  // Auto-populate amount when invoices are selected or unselected (for late transaction supplier payments)
  useEffect(() => {
    if (modalType === "late" && unifiedForm.transactionType === "SUPPLIER_PAYMENT" && vendorInvoices.length > 0) {
      if (lateSelectedInvoiceIds.length > 0) {
        const selectedInvoices = vendorInvoices.filter(inv => lateSelectedInvoiceIds.includes(inv._id));
        const totalOutstanding = selectedInvoices.reduce(
          (sum, inv) => sum + parseFloat(inv.remainingAmount || inv.total || 0),
          0
        );
        
        // Auto-populate amount field
        setUnifiedForm((prev) => ({
          ...prev,
          amount: totalOutstanding.toFixed(2)
        }));
        
        // Fetch allocation preview for late transactions
        if (totalOutstanding > 0 && unifiedForm.supplierId) {
          fetchLateAllocationPreview(unifiedForm.supplierId, totalOutstanding, lateSelectedInvoiceIds);
        }
      } else {
        // No invoices selected - clear amount and allocation preview
        setUnifiedForm((prev) => ({
          ...prev,
          amount: ""
        }));
        setLateAllocationPreview(null);
      }
    } else if (modalType === "late" && unifiedForm.transactionType === "SUPPLIER_PAYMENT" && lateSelectedInvoiceIds.length === 0) {
      setLateAllocationPreview(null);
    }
  }, [lateSelectedInvoiceIds, vendorInvoices, modalType, unifiedForm.transactionType, unifiedForm.supplierId]);

  // Fetch allocation preview
  const fetchAllocationPreview = async (supplierId, amount, invoiceIds) => {
    try {
      const response = await DailyReportsService.previewPaymentAllocation({
        supplierId,
        paymentAmount: amount,
        selectedInvoiceIds: invoiceIds,
        business: formData.business,
      });
      
      if (response?.success) {
        setAllocationPreview(response.data);
        setShowAllocationPreview(true);
      }
    } catch (error) {
      console.error("Error fetching allocation preview:", error);
    }
  };

  // Fetch allocation preview for late transactions
  const fetchLateAllocationPreview = async (supplierId, amount, invoiceIds) => {
    try {
      const response = await DailyReportsService.previewPaymentAllocation({
        supplierId,
        paymentAmount: amount,
        selectedInvoiceIds: invoiceIds,
        business: formData.business,
      });
      
      if (response?.success) {
        setLateAllocationPreview(response.data);
      }
    } catch (error) {
      console.error("Error fetching late allocation preview:", error);
    }
  };

  // Update allocation preview when amount changes
  useEffect(() => {
    if (modalType === "supplier" && selectedInvoiceIds.length > 0 && unifiedForm.amountPaid) {
      const amount = parseFloat(unifiedForm.amountPaid) || 0;
      if (amount > 0 && unifiedForm.supplierId) {
        fetchAllocationPreview(unifiedForm.supplierId, amount, selectedInvoiceIds);
      }
    }
  }, [unifiedForm.amountPaid]);

  // Update allocation preview when amount changes for late transactions
  useEffect(() => {
    if (modalType === "late" && unifiedForm.transactionType === "SUPPLIER_PAYMENT" && lateSelectedInvoiceIds.length > 0 && unifiedForm.amount) {
      const amount = parseFloat(unifiedForm.amount) || 0;
      if (amount > 0 && unifiedForm.supplierId) {
        fetchLateAllocationPreview(unifiedForm.supplierId, amount, lateSelectedInvoiceIds);
      }
    }
  }, [unifiedForm.amount]);

  // Calculate summary
  const totalCollected = collections.reduce(
    (sum, c) => sum + (parseFloat(c.amount) || 0),
    0
  );
  const totalSupplierPayments = supplierPayments.reduce(
    (sum, p) => sum + (parseFloat(p.amountPaid) || 0),
    0
  );
  const totalStaffAdvances = staffAdvances.reduce(
    (sum, a) => sum + (parseFloat(a.amount) || 0),
    0
  );
  
  // Calculate late transaction totals by type
  const lateTransactionCollections = lateTransactions
    .filter(lt => lt.transactionType === "COLLECTION")
    .reduce((sum, lt) => sum + (parseFloat(lt.amount) || 0), 0);
  const lateTransactionSupplierPayments = lateTransactions
    .filter(lt => lt.transactionType === "SUPPLIER_PAYMENT")
    .reduce((sum, lt) => sum + (parseFloat(lt.amount) || 0), 0);
  const lateTransactionAdvances = lateTransactions
    .filter(lt => lt.transactionType === "ADVANCE")
    .reduce((sum, lt) => sum + (parseFloat(lt.amount) || 0), 0);
  
  // Include late transactions in totals
  const totalCollectedWithLate = totalCollected + lateTransactionCollections;
  const totalSupplierPaymentsWithLate = totalSupplierPayments + lateTransactionSupplierPayments;
  const totalStaffAdvancesWithLate = totalStaffAdvances + lateTransactionAdvances;
  const totalPaidOut = totalSupplierPaymentsWithLate + totalStaffAdvancesWithLate;
  const expectedCash =
    (parseFloat(formData.openingCash) || 0) + totalCollectedWithLate - totalPaidOut;

  // Stable string id for grouping keys — populated refs were `${obj}` → "[object Object]" and merged all rows.
  const refIdKey = (ref) => {
    if (ref == null || ref === "") return "";
    if (typeof ref === "object" && ref._id != null) return String(ref._id);
    return String(ref);
  };

  /** Same list row (client id or Mongo _id). Do not use `(a.id === b.id)` alone — both undefined matches every row. */
  const lineItemSameRow = (a, b) => {
    if (a == null || b == null) return false;
    if (a.id != null && b.id != null && a.id === b.id) return true;
    if (a._id != null && b._id != null) {
      const ida = typeof a._id === "object" && typeof a._id.toString === "function" ? a._id.toString() : String(a._id);
      const idb = typeof b._id === "object" && typeof b._id.toString === "function" ? b._id.toString() : String(b._id);
      return ida === idb;
    }
    return false;
  };

  // Staff advances: only merge rows that share the same explicit paymentMethodId. Rows with no id
  // must not share one bucket (empty refIdKey) or every advance for that employee collapses into one line.
  const staffAdvanceMergeKeyForItem = (adv) => {
    const emp = refIdKey(adv.employeeId);
    const pm = refIdKey(adv.paymentMethodId);
    if (pm !== "") return `${emp}::pm:${pm}`;
    const snap =
      (adv.paymentMethodSnapshot &&
        String(adv.paymentMethodSnapshot.code || adv.paymentMethodSnapshot.name || "").trim()) ||
      "";
    if (snap !== "") return `${emp}::snap:${snap}`;
    return `${emp}::row:${adv.id || refIdKey(adv._id)}`;
  };

  // Group direct payments for display (same vendor/channel/employee - no allocations/reference)
  const groupForDisplay = (items, getKey, amountKey, isDirect) => {
    const map = new Map();
    for (const it of items) {
      const direct = isDirect(it);
      const key = direct ? getKey(it) : `single-${it.id || refIdKey(it._id)}`;
      if (!map.has(key)) map.set(key, { ...it, _sourceItems: [it] });
      else if (direct) {
        const g = map.get(key);
        g._sourceItems.push(it);
        g[amountKey] = (g[amountKey] || 0) + (it[amountKey] ?? 0);
      } else map.set(key, { ...it, _sourceItems: [it] });
    }
    return Array.from(map.values());
  };
  const displayCollections = groupForDisplay(
    collections,
    c => `c-${refIdKey(c.channelId)}-${refIdKey(c.paymentMethodId)}`,
    "amount",
    c => !c.referenceNo || !String(c.referenceNo).trim()
  );
  const displaySupplierPayments = groupForDisplay(
    supplierPayments,
    p => `p-${refIdKey(p.supplierId)}-${refIdKey(p.paymentMethodId)}`,
    "amountPaid",
    p => !p.allocations || p.allocations.length === 0
  );
  // Merge same employee + payment method into one row (amount includes cents from each line)
  const groupStaffAdvancesForDisplay = (items) => {
    const map = new Map();
    for (const it of items) {
      const key = staffAdvanceMergeKeyForItem(it);
      if (!map.has(key)) map.set(key, { representative: { ...it }, items: [it] });
      else map.get(key).items.push(it);
    }
    return Array.from(map.values()).map(({ representative, items: groupItems }) => {
      const total = groupItems.reduce(
        (s, x) => s + (parseFloat(x.amount) || 0) + (parseFloat(x.cents || 0) / 100),
        0
      );
      return {
        ...representative,
        amount: total,
        cents: 0,
        _sourceItems: groupItems,
      };
    });
  };
  const displayStaffAdvances = groupStaffAdvancesForDisplay(staffAdvances);

  const staffAdvancePaymentMethodLabel = (paymentMethodId) => {
    if (!paymentMethodId) return "Cash";
    if (typeof paymentMethodId === "object" && paymentMethodId.name) return paymentMethodId.name;
    const pmId = typeof paymentMethodId === "object" ? paymentMethodId._id : paymentMethodId;
    const pm = paymentMethods.find((p) => p._id === pmId || p._id?.toString() === pmId?.toString());
    return pm?.name || pm?.type || "-";
  };

  const staffAdvanceTypeLabel = (adv) => {
    if (!adv) return "-";
    const code =
      (adv.advanceTypeSnapshot && adv.advanceTypeSnapshot.code) || adv.advanceType || "";
    if (code && advanceTypes.length > 0) {
      const codeUp = String(code).toUpperCase();
      const match = advanceTypes.find(
        (at) =>
          at.code === code ||
          String(at._id) === String(code) ||
          (at.code && String(at.code).toUpperCase() === codeUp)
      );
      if (match?.name) return match.name;
    }
    if (adv.advanceTypeSnapshot?.name) return adv.advanceTypeSnapshot.name;
    return code || "-";
  };

  const toSelectValue = (v) => (v == null || v === "" ? "" : String(v));

  const resolvePaymentMethodSelectValue = (item) => {
    const direct = item?.paymentMethodId?._id || item?.paymentMethodId;
    if (direct) return toSelectValue(direct);
    const snap = item?.paymentMethodSnapshot;
    if (!snap || paymentMethods.length === 0) return "";
    const match = paymentMethods.find(
      (pm) =>
        (snap.code &&
          String(pm.code || "").toUpperCase() === String(snap.code).toUpperCase()) ||
        (snap.name && pm.name === snap.name),
    );
    return match?._id ? toSelectValue(match._id) : "";
  };

  const resolveAdvanceTypeSelectValue = (item) => {
    const snapCode = item?.advanceTypeSnapshot?.code;
    if (snapCode && advanceTypes.length > 0) {
      const codeUp = String(snapCode).toUpperCase();
      const match = advanceTypes.find(
        (at) =>
          String(at.code) === String(snapCode) ||
          String(at._id) === String(snapCode) ||
          (at.code && String(at.code).toUpperCase() === codeUp),
      );
      if (match) return toSelectValue(match.code || match._id);
      return toSelectValue(snapCode);
    }
    const atId = item?.advanceTypeId?._id || item?.advanceTypeId;
    if (atId && advanceTypes.length > 0) {
      const match = advanceTypes.find((at) => String(at._id) === String(atId));
      if (match) return toSelectValue(match.code || match._id);
    }
    const legacy = item?.advanceType;
    if (legacy && advanceTypes.length > 0) {
      const match = advanceTypes.find(
        (at) =>
          String(at.code) === String(legacy) ||
          String(at._id) === String(legacy) ||
          (at.code &&
            String(at.code).toUpperCase() === String(legacy).toUpperCase()),
      );
      if (match) return toSelectValue(match.code || match._id);
    }
    return legacy ? toSelectValue(legacy) : "";
  };

  // Re-bind advance edit dropdowns once payment methods / advance types finish loading
  useEffect(() => {
    if (!showModal || modalType !== "advance" || !editingItem) return;
    const adv = staffAdvances.find((a) => (a.id || a._id) === editingItem);
    if (!adv) return;
    const paymentMethodId = resolvePaymentMethodSelectValue(adv);
    const advanceType = resolveAdvanceTypeSelectValue(adv);
    const employeeId = toSelectValue(adv.employeeId?._id || adv.employeeId);
    setUnifiedForm((prev) => {
      if (
        toSelectValue(prev.paymentMethodId) === paymentMethodId &&
        toSelectValue(prev.advanceType) === advanceType &&
        toSelectValue(prev.employeeId) === employeeId
      ) {
        return prev;
      }
      return { ...prev, employeeId, paymentMethodId, advanceType };
    });
  }, [showModal, modalType, editingItem, paymentMethods, advanceTypes, staffAdvances]);

  // Handlers
  const resetUnifiedForm = () => {
    setUnifiedForm({
      channelId: "",
      paymentMethodId: "",
      amount: "",
      referenceNo: "",
      supplierId: "",
      amountPaid: "",
      employeeId: "",
      advanceType: "",
      txnType: "",
      source: "MANUAL",
      reason: "",
      notes: "",
      documents: [],
    });
  };

  const resetUnifiedFormAfterAdd = () => {
    // Keep dropdown selections to make rapid entry easier; clear values + uploaded docs.
    setUnifiedForm((prev) => ({
      ...prev,
      amount: "",
      amountPaid: "",
      referenceNo: "",
      notes: "",
      reason: "",
      documents: [],
    }));
    setDocUploadProgress(0);
  };

  const uploadDocuments = async (files) => {
    if (!files || files.length === 0) return [];
    if (!formData.business) {
      notifyError(t("dailyReports.validation.selectBusinessFirst"));
      return [];
    }

    const uploaded = [];
    setDocUploadLoading(true);
    setDocUploadProgress(0);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formDataForUpload = new FormData();

        // Build a simple folder path similar to VendorInvoices upload approach
        const typeFolder =
          modalType === "collection"
            ? "Collections"
            : modalType === "supplier"
            ? "SupplierPayments"
            : modalType === "advance"
            ? "StaffAdvances"
            : "LateTransactions";
        const filePath = `DailyReports/${formData.businessDate}/${typeFolder}`;

        formDataForUpload.append("file_path", filePath);
        formDataForUpload.append("business_id", formData.business);
        formDataForUpload.append("customer_id", adminInfo?.id); // matches vendor invoices approach
        formDataForUpload.append("file_type", file.type);
        formDataForUpload.append("file_size", file.size);
        formDataForUpload.append("file", file);

        const response = await axios.post(
          `${Base_URL}/documents/uploadDocument`,
          formDataForUpload,
          {
            headers: { "Content-Type": "multipart/form-data" },
            onUploadProgress: (progressEvent) => {
              if (!progressEvent.total) return;
              const percentCompleted = Math.round(
                (progressEvent.loaded * 100) / progressEvent.total
              );
              setDocUploadProgress(percentCompleted);
            },
          }
        );

        if (response?.data?.message === "File uploaded successfully") {
          const uploadedFile = response.data.file;
          uploaded.push({
            fileId: uploadedFile._id,
            name: uploadedFile.name,
            url: uploadedFile.url || uploadedFile.downloadUrl || "#",
            downloadUrl: uploadedFile.downloadUrl || uploadedFile.url || "#",
            uploadedAt: new Date().toISOString(),
            size: file.size,
            type: file.type,
          });
        } else {
          throw new Error(response?.data?.error || "Failed to upload file");
        }
      }
    } catch (error) {
      console.error("Document upload failed:", error);
      notifyError(error?.response?.data?.error || error.message || t("dailyReports.messages.error.uploadFailed"));
    } finally {
      setDocUploadLoading(false);
      setDocUploadProgress(0);
    }

    return uploaded;
  };

  const handleSelectDocuments = async (files) => {
    const fileArray = Array.from(files || []);
    if (fileArray.length === 0) return;
    const uploaded = await uploadDocuments(fileArray);
    if (uploaded.length > 0) {
      setUnifiedForm((prev) => ({
        ...prev,
        documents: [...(prev.documents || []), ...uploaded],
      }));
      notifySuccess(t("dailyReports.common.filesUploaded", { count: uploaded.length }));
    }
  };

  const handleFileInputChange = async (e) => {
    await handleSelectDocuments(e.target.files);
    // allow selecting same file again
    e.target.value = "";
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleSelectDocuments(files);
    }
  };

  const handleOpenUploadedDocument = async (fileId) => {
    if (!fileId) return;
    try {
      const res = await axios.get(`${Base_URL}/documents/getFileWithAllData/${fileId}`, {
        headers,
      });
      const fileData = res?.data?.data;
      const url = fileData?.url;
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        notifyError(t("dailyReports.messages.error.openDocument"));
      }
    } catch (error) {
      console.error("Failed to open document:", error);
      notifyError(error?.response?.data?.message || t("dailyReports.messages.error.failedOpenDocument"));
    }
  };

  const handleOpenModal = () => {
    setShowModal(true);
    setModalType(null);
    setEditingItem(null);
    setEditingType(null);
    setEditingGroupIds([]);
    resetUnifiedForm();
    setSelectedVendor("");
    setVendorInvoices([]);
  };

  const handleOpenModalWithType = (presetType) => {
    setShowModal(true);
    setEditingItem(null);
    setEditingType(null);
    setEditingGroupIds([]);
    resetUnifiedForm();
    setSelectedVendor("");
    setVendorInvoices([]);
    setModalType(presetType);
    if (presetType === "supplier" || presetType === "advance") {
      const cashPaymentMethod = paymentMethods.find((pm) => pm.type === "Cash");
      if (cashPaymentMethod) {
        setUnifiedForm((prev) => ({ ...prev, paymentMethodId: cashPaymentMethod._id }));
      }
    }
  };

  const getLateTransactionTypeLabel = (code) =>
    t(`dailyReports.transactionTypes.${code}`, {
      defaultValue: code || t("dailyReports.common.unknown"),
    });

  const handleCloseModal = () => {
    setShowModal(false);
    setModalType(null);
    setEditingItem(null);
    setEditingType(null);
    setEditingGroupIds([]);
    resetUnifiedForm();
    setSelectedVendor("");
    setVendorInvoices([]);
  };

  const handleSelectType = (type) => {
    setModalType(type);
    if (!editingItem) {
      resetUnifiedForm();
    }
    if (type === "supplier" || type === "advance") {
      if (!editingItem) {
        if (type === "supplier") {
          setSelectedVendor("");
          setVendorInvoices([]);
        }
        const cashPaymentMethod = paymentMethods.find(pm => pm.type === "Cash");
        if (cashPaymentMethod) {
          setUnifiedForm((prev) => ({ ...prev, paymentMethodId: cashPaymentMethod._id }));
        }
      }
    }
  };

  const handleEditTransaction = (item, type) => {
    const sourceItems = item._sourceItems;
    const effectiveItem = sourceItems?.length ? sourceItems[0] : item;
    const idsToRemove = sourceItems?.length > 1 ? sourceItems.slice(1).map(s => s.id || s._id) : [];
    setEditingItem(effectiveItem.id || effectiveItem._id);
    setEditingType(type);
    setEditingGroupIds(idsToRemove);
    setModalType(type);
    const formItem = { ...effectiveItem, ...(item.amount !== undefined && { amount: item.amount }), ...(item.amountPaid !== undefined && { amountPaid: item.amountPaid }) };
    
    // Pre-fill form with item data
    if (type === "collection") {
      const channelId = formItem.channelId?._id || formItem.channelId || "";
      const paymentMethodId = formItem.paymentMethodId?._id || formItem.paymentMethodId || "";
      setUnifiedForm({
        channelId,
        paymentMethodId,
        amount: formItem.amount?.toString() || "",
        referenceNo: formItem.referenceNo || "",
        notes: "",
        documents: formItem.documents || [],
      });
    } else if (type === "supplier") {
      const supplierId = formItem.supplierId?._id || formItem.supplierId || "";
      const paymentMethodId = formItem.paymentMethodId?._id || formItem.paymentMethodId || "";
      setSelectedVendor(supplierId);
      if (supplierId) fetchVendorInvoices(supplierId);
      // Pre-select invoices from existing allocations when editing
      const allocIds = (formItem.allocations || []).map((a) => a.invoiceId?._id || a.invoiceId).filter(Boolean);
      if (allocIds.length > 0) setSelectedInvoiceIds(allocIds);
      setUnifiedForm({
        supplierId,
        amountPaid: formItem.amountPaid?.toString() || "",
        paymentMethodId,
        referenceNo: formItem.referenceNo || "",
        notes: formItem.notes || "",
        documents: formItem.documents || [],
      });
    } else if (type === "advance") {
      const employeeId = toSelectValue(
        formItem.employeeId?._id || formItem.employeeId || "",
      );
      const paymentMethodId = resolvePaymentMethodSelectValue(formItem);
      const advanceType = resolveAdvanceTypeSelectValue(formItem);
      setUnifiedForm({
        employeeId,
        advanceType,
        paymentMethodId,
        amount: formItem.amount?.toString() || "",
        notes: formItem.notes || "",
        documents: formItem.documents || [],
      });
    } else if (type === "late") {
      const channelId = formItem.channelId?._id || formItem.channelId || "";
      const paymentMethodId = formItem.paymentMethodId?._id || formItem.paymentMethodId || "";
      const supplierId = formItem.supplierId?._id || formItem.supplierId || "";
      const employeeId = formItem.employeeId?._id || formItem.employeeId || "";
      // Fetch vendor invoices and pre-select from allocations when editing SUPPLIER_PAYMENT
      if (formItem.transactionType === "SUPPLIER_PAYMENT" && supplierId) {
        fetchVendorInvoices(supplierId);
        const allocIds = (formItem.allocations || []).map((a) => a.invoiceId?._id || a.invoiceId).filter(Boolean);
        if (allocIds.length > 0) setLateSelectedInvoiceIds(allocIds);
      }
      setUnifiedForm({
        txnType: formItem.txnType || "",
        source: formItem.source || "MANUAL",
        channelId,
        paymentMethodId,
        transactionType: formItem.transactionType || "",
        supplierId,
        employeeId,
        amount: formItem.amount?.toString() || "",
        reason: formItem.reason || "",
        documents: formItem.documents || [],
      });
    }
    
    setShowModal(true);
  };

  const handleViewDocuments = (documents) => {
    if (!documents || documents.length === 0) {
      notifyError(t("dailyReports.messages.error.noDocuments"));
      return;
    }
    setSelectedTransactionDocuments(documents);
    setShowDocumentsModal(true);
  };

  const handleAddItem = () => {
    if (modalType === "collection") {
      if (!unifiedForm.channelId || !unifiedForm.amount) {
        notifyError(t("dailyReports.validation.channelAndAmountRequired"));
        return;
      }

      const channel = channels.find((c) => c._id === unifiedForm.channelId);
      
      if (editingItem && editingType === "collection") {
        setCollections(prev =>
          prev
            .filter(c => !editingGroupIds.includes(c.id || c._id))
            .map((c) =>
              (c.id === editingItem || c._id === editingItem)
                ? {
                    ...c,
                    channelId: unifiedForm.channelId,
                    paymentMethodId: unifiedForm.paymentMethodId,
                    amount: parseFloat(unifiedForm.amount),
                    referenceNo: unifiedForm.referenceNo,
                    documents: unifiedForm.documents || [],
                    channelSnapshot: { code: channel?.code || "", name: channel?.name || "" },
                  }
                : c
            )
        );
        notifySuccess(t("dailyReports.messages.success.collectionUpdated"));
        handleCloseModal();
      } else {
        // Direct payment (no reference): merge into existing same channel+paymentMethod
        const isDirect = !unifiedForm.referenceNo || !String(unifiedForm.referenceNo).trim();
        const existingDirect = isDirect && collections.find(
          c => c.channelId === unifiedForm.channelId &&
            (c.paymentMethodId || null) === (unifiedForm.paymentMethodId || null) &&
            (!c.referenceNo || !String(c.referenceNo).trim())
        );
        if (existingDirect) {
          setCollections(collections.map(c =>
            lineItemSameRow(c, existingDirect)
              ? { ...c, amount: (c.amount || 0) + parseFloat(unifiedForm.amount) }
              : c
          ));
          resetUnifiedFormAfterAdd();
          notifySuccess(t("dailyReports.messages.success.amountAddedToCollection"));
        } else {
          const newCollection = {
            id: Date.now(),
            channelId: unifiedForm.channelId,
            paymentMethodId: unifiedForm.paymentMethodId,
            amount: parseFloat(unifiedForm.amount),
            referenceNo: unifiedForm.referenceNo,
            documents: unifiedForm.documents || [],
            channelSnapshot: { code: channel?.code || "", name: channel?.name || "" },
          };
          setCollections([...collections, newCollection]);
          resetUnifiedFormAfterAdd();
          notifySuccess(t("dailyReports.messages.success.addedToList"));
        }
      }
    } else if (modalType === "supplier") {
      if (!unifiedForm.supplierId || !unifiedForm.amountPaid) {
        notifyError(t("dailyReports.validation.supplierAndAmountRequired"));
        return;
      }

      const vendor = vendors.find((v) => v._id === unifiedForm.supplierId);
      
      if (editingItem && editingType === "supplier") {
        // Find the old payment to reverse its allocations
        const oldPayment = supplierPayments.find(p => (p.id === editingItem || p._id === editingItem));
        
        // Calculate new allocations if invoices are selected
        let calculatedAllocations = [];
        if (selectedInvoiceIds.length > 0 && allocationPreview?.allocations) {
          calculatedAllocations = allocationPreview.allocations.map(alloc => ({
            invoiceId: alloc.invoiceId,
            invoiceNumber: alloc.invoiceNumber,
            allocatedAmount: alloc.allocatedAmount,
          }));
        }
        
        // Update existing supplier payment (remove other grouped items if consolidating)
        setSupplierPayments(prev => {
          const updated = prev
            .filter(p => !editingGroupIds.includes(p.id || p._id))
            .map((p) =>
              (p.id === editingItem || p._id === editingItem)
                ? {
                    ...p,
                    supplierId: unifiedForm.supplierId,
                    amountPaid: parseFloat(unifiedForm.amountPaid),
                    paymentMethodId: unifiedForm.paymentMethodId,
                    referenceNo: unifiedForm.referenceNo,
                    notes: unifiedForm.notes,
                    documents: unifiedForm.documents || [],
                    allocations: calculatedAllocations,
                    selectedInvoiceIds: selectedInvoiceIds.length > 0 ? selectedInvoiceIds : undefined,
                    supplierNameSnapshot:
                      vendor?.basicInformation?.vendorDisplayName ||
                        vendor?.name ||
                        t("dailyReports.common.unknownSupplier"),
                  }
                : p
            );
          return updated;
        });
        
        // Update vendor invoices: reverse old allocations, apply new ones
        if (oldPayment?.allocations || calculatedAllocations.length > 0) {
          setVendorInvoices(prevInvoices => {
            let updatedInvoices = [...prevInvoices];
            
            // First, reverse old allocations if they exist
            if (oldPayment?.allocations) {
              updatedInvoices = updatedInvoices.map(invoice => {
                const oldAllocation = oldPayment.allocations.find(alloc => alloc.invoiceId === invoice._id);
                if (oldAllocation) {
                  const reversedRemainingAmount = (invoice.remainingAmount || 0) + oldAllocation.allocatedAmount;
                  const reversedAmountPaid = Math.max(0, (invoice.amountPaid || 0) - oldAllocation.allocatedAmount);
                  return {
                    ...invoice,
                    remainingAmount: reversedRemainingAmount,
                    amountPaid: reversedAmountPaid,
                    paymentStatus: reversedRemainingAmount >= (invoice.total || 0) ? "Unpaid" : (reversedAmountPaid > 0 ? "Partially Paid" : invoice.paymentStatus),
                  };
                }
                return invoice;
              });
            }
            
            // Then apply new allocations
            if (calculatedAllocations.length > 0) {
              updatedInvoices = updatedInvoices.map(invoice => {
                const allocation = calculatedAllocations.find(alloc => alloc.invoiceId === invoice._id);
                if (allocation) {
                  const newRemainingAmount = Math.max(0, (invoice.remainingAmount || invoice.total || 0) - allocation.allocatedAmount);
                  const newAmountPaid = (invoice.amountPaid || 0) + allocation.allocatedAmount;
                  return {
                    ...invoice,
                    remainingAmount: newRemainingAmount,
                    amountPaid: newAmountPaid,
                    paymentStatus: newRemainingAmount <= 0 ? "Paid" : (newAmountPaid > 0 ? "Partially Paid" : invoice.paymentStatus),
                  };
                }
                return invoice;
              }).filter(invoice => {
                // Keep invoices that are not fully paid
                return invoice.remainingAmount > 0 || invoice.paymentStatus !== "Paid";
              });
            }
            
            return updatedInvoices;
          });
        }
        
        setSelectedInvoiceIds([]);
        setAllocationPreview(null);
        notifySuccess(t("dailyReports.messages.success.supplierPaymentUpdated"));
        handleCloseModal();
      } else {
        // Calculate allocations if invoices are selected
        let calculatedAllocations = [];
        if (selectedInvoiceIds.length > 0 && allocationPreview?.allocations) {
          calculatedAllocations = allocationPreview.allocations.map(alloc => ({
            invoiceId: alloc.invoiceId,
            invoiceNumber: alloc.invoiceNumber,
            allocatedAmount: alloc.allocatedAmount,
          }));
        }

        // Direct payment (no allocations): merge into existing same supplier+paymentMethod
        const isDirect = calculatedAllocations.length === 0;
        const existingDirect = isDirect && supplierPayments.find(
          p => p.supplierId === unifiedForm.supplierId &&
            (p.paymentMethodId || null) === (unifiedForm.paymentMethodId || null) &&
            (!p.allocations || p.allocations.length === 0)
        );
        if (existingDirect) {
          setSupplierPayments(supplierPayments.map(p =>
            lineItemSameRow(p, existingDirect)
              ? { ...p, amountPaid: (p.amountPaid || 0) + parseFloat(unifiedForm.amountPaid) }
              : p
          ));
          resetUnifiedFormAfterAdd();
          notifySuccess(t("dailyReports.messages.success.amountAddedToSupplierPayment"));
          return;
        }

        // Add new supplier payment
        const newPayment = {
          id: Date.now(),
          supplierId: unifiedForm.supplierId,
          amountPaid: parseFloat(unifiedForm.amountPaid),
          paymentMethodId: unifiedForm.paymentMethodId,
          referenceNo: unifiedForm.referenceNo,
          notes: unifiedForm.notes,
          documents: unifiedForm.documents || [],
          allocations: calculatedAllocations,
          selectedInvoiceIds: selectedInvoiceIds.length > 0 ? selectedInvoiceIds : undefined,
          supplierNameSnapshot:
            vendor?.basicInformation?.vendorDisplayName ||
              vendor?.name ||
              t("dailyReports.common.unknownSupplier"),
        };

        setSupplierPayments([...supplierPayments, newPayment]);
        
        // Update vendor invoices to reflect pending allocations
        if (calculatedAllocations.length > 0) {
          setVendorInvoices(prevInvoices => {
            return prevInvoices.map(invoice => {
              const allocation = calculatedAllocations.find(alloc => alloc.invoiceId === invoice._id);
              if (allocation) {
                const newRemainingAmount = Math.max(0, (invoice.remainingAmount || invoice.total || 0) - allocation.allocatedAmount);
                const newAmountPaid = (invoice.amountPaid || 0) + allocation.allocatedAmount;
                return {
                  ...invoice,
                  remainingAmount: newRemainingAmount,
                  amountPaid: newAmountPaid,
                  paymentStatus: newRemainingAmount <= 0 ? "Paid" : (newAmountPaid > 0 ? "Partially Paid" : invoice.paymentStatus),
                };
              }
              return invoice;
            }).filter(invoice => {
              // Keep invoices that are not fully paid, or show all invoices (you can change this logic)
              return invoice.remainingAmount > 0 || invoice.paymentStatus !== "Paid";
            });
          });
        }
        
        setSelectedInvoiceIds([]);
        setAllocationPreview(null);
        resetUnifiedFormAfterAdd();
        notifySuccess(
          calculatedAllocations.length > 0
            ? t("dailyReports.messages.success.addedToListInvoicesAllocated", {
                count: calculatedAllocations.length,
              })
            : t("dailyReports.messages.success.addedToList")
        );
      }
    } else if (modalType === "advance") {
      if (!unifiedForm.employeeId || !unifiedForm.amount) {
        notifyError(t("dailyReports.validation.employeeAndAmountRequired"));
        return;
      }

      const employee = staff.find((s) => s._id === unifiedForm.employeeId);
      
      if (editingItem && editingType === "advance") {
        const paymentMethod = paymentMethods.find(
          (pm) => toSelectValue(pm._id) === toSelectValue(unifiedForm.paymentMethodId),
        );
        const advanceTypeRow = advanceTypes.find(
          (at) =>
            toSelectValue(at.code || at._id) === toSelectValue(unifiedForm.advanceType),
        );
        setStaffAdvances(prev =>
          prev
            .filter(a => !editingGroupIds.includes(a.id || a._id))
            .map((a) =>
              (a.id === editingItem || a._id === editingItem)
                ? {
                    ...a,
                    employeeId: unifiedForm.employeeId,
                    amount: parseFloat(unifiedForm.amount),
                    advanceType: unifiedForm.advanceType,
                    advanceTypeId: advanceTypeRow?._id || a.advanceTypeId || null,
                    advanceTypeSnapshot: advanceTypeRow
                      ? { code: advanceTypeRow.code, name: advanceTypeRow.name }
                      : a.advanceTypeSnapshot,
                    paymentMethodId: unifiedForm.paymentMethodId,
                    paymentMethodSnapshot: paymentMethod
                      ? {
                          code: paymentMethod.code || "",
                          name: paymentMethod.name || "",
                          type: paymentMethod.type || "Cash",
                        }
                      : a.paymentMethodSnapshot,
                    notes: unifiedForm.notes,
                    documents: unifiedForm.documents || [],
                    employeeNameSnapshot:
                      employee?.fullName ||
                      employee?.displayName ||
                      t("dailyReports.common.unknownEmployee"),
                  }
                : a
            )
        );
        notifySuccess(t("dailyReports.messages.success.staffAdvanceUpdated"));
        handleCloseModal();
      } else {
        const formPm = refIdKey(unifiedForm.paymentMethodId);
        const wantKey =
          formPm !== ""
            ? `${refIdKey(unifiedForm.employeeId)}::pm:${formPm}`
            : null;
        const existing =
          wantKey != null
            ? staffAdvances.find((a) => staffAdvanceMergeKeyForItem(a) === wantKey)
            : null;
        if (existing) {
          setStaffAdvances(
            staffAdvances.map((a) =>
              lineItemSameRow(a, existing)
                ? {
                    ...a,
                    amount: (parseFloat(a.amount) || 0) + parseFloat(unifiedForm.amount),
                    documents: [...(a.documents || []), ...(unifiedForm.documents || [])],
                  }
                : a
            )
          );
          resetUnifiedFormAfterAdd();
          notifySuccess(t("dailyReports.messages.success.amountAddedToStaffAdvance"));
        } else {
          const newAdvance = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            employeeId: unifiedForm.employeeId,
            amount: parseFloat(unifiedForm.amount),
            advanceType: unifiedForm.advanceType,
            paymentMethodId: unifiedForm.paymentMethodId,
            notes: unifiedForm.notes,
            documents: unifiedForm.documents || [],
            employeeNameSnapshot:
              employee?.fullName || employee?.displayName || t("dailyReports.common.unknownEmployee"),
          };
          setStaffAdvances([...staffAdvances, newAdvance]);
          resetUnifiedFormAfterAdd();
          notifySuccess(t("dailyReports.messages.success.addedToList"));
        }
      }
    } else if (modalType === "late") {
      if (!unifiedForm.amount || !unifiedForm.reason || !unifiedForm.transactionType) {
        notifyError(t("dailyReports.validation.amountReasonCategoryRequired"));
        return;
      }

      const channel = channels.find((c) => c._id === unifiedForm.channelId);
      const paymentMethod = paymentMethods.find((pm) => pm._id === unifiedForm.paymentMethodId);
      
      if (editingItem && editingType === "late") {
        // Find the old transaction to reverse its allocations
        const oldTransaction = lateTransactions.find(t => (t.id === editingItem || t._id === editingItem));
        
        // Update existing late transaction
        const supplier = unifiedForm.transactionType === "SUPPLIER_PAYMENT" && unifiedForm.supplierId
          ? vendors.find(v => v._id === unifiedForm.supplierId)
          : null;
        const employee = unifiedForm.transactionType === "ADVANCE" && unifiedForm.employeeId
          ? staff.find(s => s._id === unifiedForm.employeeId)
          : null;
        
        // Calculate new allocations if invoices are selected (for supplier payments)
        let calculatedAllocations = [];
        if (unifiedForm.transactionType === "SUPPLIER_PAYMENT" && lateSelectedInvoiceIds.length > 0 && lateAllocationPreview?.allocations) {
          calculatedAllocations = lateAllocationPreview.allocations.map(alloc => ({
            invoiceId: alloc.invoiceId,
            invoiceNumber: alloc.invoiceNumber,
            allocatedAmount: alloc.allocatedAmount,
          }));
        }
        
        setLateTransactions(prev =>
          prev
            .filter(t => !editingGroupIds.includes(t.id || t._id))
            .map((t) =>
              (t.id === editingItem || t._id === editingItem)
                ? {
                  ...t,
                  txnType: unifiedForm.txnType,
                  source: unifiedForm.source || "MANUAL",
                  channelId: unifiedForm.channelId,
                  paymentMethodId: unifiedForm.paymentMethodId,
                  transactionType: unifiedForm.transactionType,
                  supplierId: unifiedForm.supplierId || null,
                  supplierNameSnapshot: supplier 
                    ? (supplier.basicInformation?.vendorDisplayName ||
                        supplier.name ||
                        supplier.companyName ||
                        t("dailyReports.common.unknownSupplier"))
                    : null,
                  employeeId: unifiedForm.employeeId || null,
                  employeeNameSnapshot: employee ? (employee.fullName || employee.displayName) : null,
                  amount: parseFloat(unifiedForm.amount),
                  reason: unifiedForm.reason,
                  documents: unifiedForm.documents || [],
                  channelSnapshot: channel
                    ? { code: channel.code, name: channel.name }
                    : null,
                  paymentMethodSnapshot: paymentMethod
                    ? { _id: paymentMethod._id, name: paymentMethod.name, code: paymentMethod.code, type: paymentMethod.type }
                    : null,
                  allocations: calculatedAllocations,
                  selectedInvoiceIds: lateSelectedInvoiceIds.length > 0 ? lateSelectedInvoiceIds : undefined,
                }
              : t
          )
        );
        
        // Update vendor invoices: reverse old allocations, apply new ones (for supplier payments)
        if (unifiedForm.transactionType === "SUPPLIER_PAYMENT" && (oldTransaction?.allocations || calculatedAllocations.length > 0)) {
          setVendorInvoices(prevInvoices => {
            let updatedInvoices = [...prevInvoices];
            
            // First, reverse old allocations if they exist
            if (oldTransaction?.allocations && oldTransaction.transactionType === "SUPPLIER_PAYMENT") {
              updatedInvoices = updatedInvoices.map(invoice => {
                const oldAllocation = oldTransaction.allocations.find(alloc => alloc.invoiceId === invoice._id);
                if (oldAllocation) {
                  const reversedRemainingAmount = (invoice.remainingAmount || 0) + oldAllocation.allocatedAmount;
                  const reversedAmountPaid = Math.max(0, (invoice.amountPaid || 0) - oldAllocation.allocatedAmount);
                  return {
                    ...invoice,
                    remainingAmount: reversedRemainingAmount,
                    amountPaid: reversedAmountPaid,
                    paymentStatus: reversedRemainingAmount >= (invoice.total || 0) ? "Unpaid" : (reversedAmountPaid > 0 ? "Partially Paid" : invoice.paymentStatus),
                  };
                }
                return invoice;
              });
            }
            
            // Then apply new allocations
            if (calculatedAllocations.length > 0) {
              updatedInvoices = updatedInvoices.map(invoice => {
                const allocation = calculatedAllocations.find(alloc => alloc.invoiceId === invoice._id);
                if (allocation) {
                  const newRemainingAmount = Math.max(0, (invoice.remainingAmount || invoice.total || 0) - allocation.allocatedAmount);
                  const newAmountPaid = (invoice.amountPaid || 0) + allocation.allocatedAmount;
                  return {
                    ...invoice,
                    remainingAmount: newRemainingAmount,
                    amountPaid: newAmountPaid,
                    paymentStatus: newRemainingAmount <= 0 ? "Paid" : (newAmountPaid > 0 ? "Partially Paid" : invoice.paymentStatus),
                  };
                }
                return invoice;
              }).filter(invoice => {
                // Keep invoices that are not fully paid
                return invoice.remainingAmount > 0 || invoice.paymentStatus !== "Paid";
              });
            }
            
            return updatedInvoices;
          });
        }
        
        setLateSelectedInvoiceIds([]);
        setLateAllocationPreview(null);
        notifySuccess(t("dailyReports.messages.success.lateTransactionUpdated"));
        handleCloseModal();
      } else {
        // Calculate allocations if invoices are selected (for supplier payments)
        let calculatedAllocations = [];
        if (unifiedForm.transactionType === "SUPPLIER_PAYMENT" && lateSelectedInvoiceIds.length > 0 && lateAllocationPreview?.allocations) {
          calculatedAllocations = lateAllocationPreview.allocations.map(alloc => ({
            invoiceId: alloc.invoiceId,
            invoiceNumber: alloc.invoiceNumber,
            allocatedAmount: alloc.allocatedAmount,
          }));
        }

        // Direct payment (no allocations): merge into existing same type+entity+paymentMethod
        const isDirect = calculatedAllocations.length === 0;
        const existingDirect = isDirect && lateTransactions.find(t => {
          const sameType = t.transactionType === unifiedForm.transactionType;
          const sameEntity = (unifiedForm.transactionType === "SUPPLIER_PAYMENT" && t.supplierId === unifiedForm.supplierId) ||
            (unifiedForm.transactionType === "ADVANCE" && t.employeeId === unifiedForm.employeeId) ||
            (unifiedForm.transactionType === "COLLECTION" && t.channelId === unifiedForm.channelId);
          const samePayment = (t.paymentMethodId || null) === (unifiedForm.paymentMethodId || null);
          const noAllocs = !t.allocations || t.allocations.length === 0;
          return sameType && sameEntity && samePayment && noAllocs;
        });
        if (existingDirect) {
          setLateTransactions(lateTransactions.map(t =>
            lineItemSameRow(t, existingDirect)
              ? { ...t, amount: (t.amount || 0) + parseFloat(unifiedForm.amount) }
              : t
          ));
          resetUnifiedFormAfterAdd();
          setLateSelectedInvoiceIds([]);
          setLateAllocationPreview(null);
          notifySuccess(t("dailyReports.messages.success.amountAddedToLateTransaction"));
          return;
        }

        const supplier = unifiedForm.transactionType === "SUPPLIER_PAYMENT" && unifiedForm.supplierId
          ? vendors.find(v => v._id === unifiedForm.supplierId)
          : null;
        const employee = unifiedForm.transactionType === "ADVANCE" && unifiedForm.employeeId
          ? staff.find(s => s._id === unifiedForm.employeeId)
          : null;
        
        const newTransaction = {
          id: Date.now(),
          txnType: unifiedForm.txnType,
          source: unifiedForm.source || "MANUAL",
          channelId: unifiedForm.channelId,
          paymentMethodId: unifiedForm.paymentMethodId,
          transactionType: unifiedForm.transactionType,
          amount: parseFloat(unifiedForm.amount),
          reason: unifiedForm.reason,
          documents: unifiedForm.documents || [],
          supplierId: unifiedForm.supplierId || null,
          supplierNameSnapshot: supplier 
            ? (supplier.basicInformation?.vendorDisplayName ||
                supplier.name ||
                supplier.companyName ||
                t("dailyReports.common.unknownSupplier"))
            : null,
          employeeId: unifiedForm.employeeId || null,
          employeeNameSnapshot: employee ? (employee.fullName || employee.displayName) : null,
          channelSnapshot: channel
            ? { code: channel.code, name: channel.name }
            : null,
          paymentMethodSnapshot: paymentMethod
            ? { _id: paymentMethod._id, name: paymentMethod.name, code: paymentMethod.code, type: paymentMethod.type }
            : null,
          allocations: calculatedAllocations,
          selectedInvoiceIds: lateSelectedInvoiceIds.length > 0 ? lateSelectedInvoiceIds : undefined,
          actualTxnAt: new Date().toISOString(),
        };

        setLateTransactions([...lateTransactions, newTransaction]);
        
        // Update vendor invoices to reflect pending allocations for late supplier payments
        if (unifiedForm.transactionType === "SUPPLIER_PAYMENT" && calculatedAllocations.length > 0) {
          setVendorInvoices(prevInvoices => {
            return prevInvoices.map(invoice => {
              const allocation = calculatedAllocations.find(alloc => alloc.invoiceId === invoice._id);
              if (allocation) {
                const newRemainingAmount = Math.max(0, (invoice.remainingAmount || invoice.total || 0) - allocation.allocatedAmount);
                const newAmountPaid = (invoice.amountPaid || 0) + allocation.allocatedAmount;
                return {
                  ...invoice,
                  remainingAmount: newRemainingAmount,
                  amountPaid: newAmountPaid,
                  paymentStatus: newRemainingAmount <= 0 ? "Paid" : (newAmountPaid > 0 ? "Partially Paid" : invoice.paymentStatus),
                };
              }
              return invoice;
            }).filter(invoice => {
              // Keep invoices that are not fully paid
              return invoice.remainingAmount > 0 || invoice.paymentStatus !== "Paid";
            });
          });
        }
        
        setLateSelectedInvoiceIds([]);
        setLateAllocationPreview(null);
        resetUnifiedFormAfterAdd();
        notifySuccess(
          calculatedAllocations.length > 0
            ? t("dailyReports.messages.success.addedToListInvoicesAllocated", {
                count: calculatedAllocations.length,
              })
            : t("dailyReports.messages.success.addedToList")
        );
      }
    }
  };

  // Validate form fields
  const validateForm = () => {
    const newErrors = {};

    // Business validation
    if (!formData.business || formData.business === "" || formData.business === null || formData.business === undefined) {
      newErrors.business = t("dailyReports.validation.businessRequired");
    }
    
    // Date validation
    if (!formData.businessDate || formData.businessDate === "" || formData.businessDate === null || formData.businessDate === undefined) {
      newErrors.businessDate = t("dailyReports.validation.dateRequired");
    }
    
    // Shift validation
    if (!formData.shiftId || formData.shiftId === "" || formData.shiftId === null || formData.shiftId === undefined) {
      newErrors.shiftId = t("dailyReports.validation.shiftRequired");
    }
    
    // Shift No validation
    const sn = Number(formData.shiftNo);
    if (
      formData.shiftNo === undefined ||
      formData.shiftNo === null ||
      !Number.isFinite(sn) ||
      sn < 1 ||
      sn > 20
    ) {
      newErrors.shiftNo = t("dailyReports.validation.shiftNoRange");
    }
    
    // Opening Cash validation - allow 0 as valid value
    const openingCashValue = formData.openingCash;
    if (openingCashValue === undefined || openingCashValue === null || openingCashValue === "") {
      newErrors.openingCash = t("dailyReports.validation.openingCashRequired");
    } else {
      const parsed = parseFloat(openingCashValue);
      if (isNaN(parsed) || parsed < 0) {
        newErrors.openingCash = t("dailyReports.validation.openingCashInvalid");
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Validate form for submission (includes declaredCashOnHand)
  const validateFormForSubmit = () => {
    const newErrors = {};

    // Business validation
    if (!formData.business || formData.business === "" || formData.business === null || formData.business === undefined) {
      newErrors.business = t("dailyReports.validation.businessRequired");
    }
    
    // Date validation
    if (!formData.businessDate || formData.businessDate === "" || formData.businessDate === null || formData.businessDate === undefined) {
      newErrors.businessDate = t("dailyReports.validation.dateRequired");
    }
    
    // Shift validation
    if (!formData.shiftId || formData.shiftId === "" || formData.shiftId === null || formData.shiftId === undefined) {
      newErrors.shiftId = t("dailyReports.validation.shiftRequired");
    }
    
    // Shift No validation
    const snSubmit = Number(formData.shiftNo);
    if (
      formData.shiftNo === undefined ||
      formData.shiftNo === null ||
      !Number.isFinite(snSubmit) ||
      snSubmit < 1 ||
      snSubmit > 20
    ) {
      newErrors.shiftNo = t("dailyReports.validation.shiftNoRange");
    }
    
    // Opening Cash validation - allow 0 as valid value
    const openingCashValueSubmit = formData.openingCash;
    if (openingCashValueSubmit === undefined || openingCashValueSubmit === null || openingCashValueSubmit === "") {
      newErrors.openingCash = t("dailyReports.validation.openingCashRequired");
    } else {
      const parsed = parseFloat(openingCashValueSubmit);
      if (isNaN(parsed) || parsed < 0) {
        newErrors.openingCash = t("dailyReports.validation.openingCashInvalid");
      }
    }

    // Declared Cash validation - allow 0 as valid value
    const declaredCashValue = formData.declaredCashOnHand;
    if (declaredCashValue === undefined || declaredCashValue === null || declaredCashValue === "") {
      newErrors.declaredCashOnHand = t("dailyReports.validation.declaredCashRequired");
    } else {
      const parsed = parseFloat(declaredCashValue);
      if (isNaN(parsed) || parsed < 0) {
        newErrors.declaredCashOnHand = t("dailyReports.validation.declaredCashInvalid");
      }
    }

    setErrors(newErrors);
    
    // Log validation details for debugging
    if (Object.keys(newErrors).length > 0) {
      console.log("Validation errors:", newErrors);
      console.log("Form data:", formData);
    }
    
    return { isValid: Object.keys(newErrors).length === 0, errors: newErrors };
  };

  const syncDeletedLineItemsToServer = async () => {
    const snap = initialLineItemIdsRef.current;
    const hasLoadedIds =
      (snap.collections?.length || 0) +
        (snap.supplierPayments?.length || 0) +
        (snap.staffAdvances?.length || 0) +
        (snap.lateTransactions?.length || 0) >
      0;
    if (!hasLoadedIds) return;

    const currentIds = {
      collections: new Set(collections.map((c) => c._id).filter(Boolean).map(String)),
      supplierPayments: new Set(supplierPayments.map((p) => p._id).filter(Boolean).map(String)),
      staffAdvances: new Set(staffAdvances.map((a) => a._id).filter(Boolean).map(String)),
      lateTransactions: new Set(lateTransactions.map((t) => t._id).filter(Boolean).map(String)),
    };

    const deleteTasks = [];
    for (const id of snap.collections || []) {
      if (!currentIds.collections.has(String(id))) {
        deleteTasks.push(DailyReportsService.deleteCollection(String(id)));
      }
    }
    for (const id of snap.supplierPayments || []) {
      if (!currentIds.supplierPayments.has(String(id))) {
        deleteTasks.push(DailyReportsService.deleteSupplierPayment(String(id)));
      }
    }
    for (const id of snap.staffAdvances || []) {
      if (!currentIds.staffAdvances.has(String(id))) {
        deleteTasks.push(DailyReportsService.deleteStaffAdvance(String(id)));
      }
    }
    for (const id of snap.lateTransactions || []) {
      if (!currentIds.lateTransactions.has(String(id))) {
        deleteTasks.push(DailyReportsService.deleteLateTransaction(String(id)));
      }
    }

    if (deleteTasks.length > 0) {
      await Promise.all(deleteTasks);
    }

    initialLineItemIdsRef.current = {
      collections: [...currentIds.collections],
      supplierPayments: [...currentIds.supplierPayments],
      staffAdvances: [...currentIds.staffAdvances],
      lateTransactions: [...currentIds.lateTransactions],
    };
  };

  const handleSaveDraft = async () => {
    if (!validateForm()) {
      notifyError(t("dailyReports.validation.fillAllRequired"));
      return;
    }

    setSaveLoading(true);
    try {
      let reportId = shiftReportId;

      // Create or update shift report
      if (isEdit && reportId) {
        await DailyReportsService.updateShiftReport(reportId, {
          business: formData.business,
          businessDate: formData.businessDate,
          shiftId: formData.shiftId,
          shiftNo: formData.shiftNo,
          openingCash: parseFloat(formData.openingCash) || 0,
          declaredCashOnHand: parseFloat(formData.declaredCashOnHand) || 0,
          notes: formData.notes,
          remarks: formData.remarks,
        });
      } else {
        const response = await DailyReportsService.createShiftReport({
          business: formData.business,
          businessDate: formData.businessDate,
          shiftId: formData.shiftId,
          shiftNo: formData.shiftNo,
          openingCash: parseFloat(formData.openingCash) || 0,
          notes: formData.notes,
          remarks: formData.remarks,
        });

        if (response?.success) {
          reportId = response.data._id;
          setShiftReportId(reportId);
        } else {
          throw new Error(response?.message || "Failed to create report");
        }
      }

      await syncDeletedLineItemsToServer();

      // Save collections
      for (const collection of collections) {
        if (collection._id) {
          // Update existing collection
          await DailyReportsService.updateCollection(collection._id, {
            channelId: collection.channelId,
            paymentMethodId: collection.paymentMethodId,
            amount: collection.amount,
            referenceNo: collection.referenceNo,
            documents: (collection.documents || []).map(doc => ({
              fileId: doc.fileId,
              name: doc.name,
              type: doc.type || doc.file_type,
              size: doc.size || doc.file_size,
            })),
          });
        } else {
          const createResponse = await DailyReportsService.createCollection({
            shiftReportId: reportId,
            business: formData.business,
            channelId: collection.channelId,
            paymentMethodId: collection.paymentMethodId,
            amount: collection.amount,
            referenceNo: collection.referenceNo,
            businessDate: formData.businessDate,
            documents: (collection.documents || []).map(doc => ({
              fileId: doc.fileId,
              name: doc.name,
              type: doc.type || doc.file_type,
              size: doc.size || doc.file_size,
            })),
          });

          // Update local state - handle duplicate (backend may have updated existing)
          if (createResponse?.success && createResponse?.data?._id) {
            const returnedId = createResponse.data._id;
            const hadDuplicate = collections.some(c => c._id === returnedId && c.id !== collection.id);
            setCollections(prev => {
              if (hadDuplicate) {
                return prev.filter(c => c.id !== collection.id).map(c =>
                  c._id === returnedId ? { ...c, ...createResponse.data } : c
                );
              }
              return prev.map(c =>
                (c.id === collection.id || c._id === collection._id) ? { ...c, _id: returnedId } : c
              );
            });
          }
        }
      }

      // Save supplier payments
      for (const payment of supplierPayments) {
        if (payment._id) {
          // Update existing supplier payment
          await DailyReportsService.updateSupplierPayment(payment._id, {
            supplierId: payment.supplierId,
            amountPaid: payment.amountPaid,
            paymentMethodId: payment.paymentMethodId,
            referenceNo: payment.referenceNo,
            notes: payment.notes,
            allocations: payment.allocations,
            selectedInvoiceIds: payment.selectedInvoiceIds,
            documents: (payment.documents || []).map(doc => ({
              fileId: doc.fileId,
              name: doc.name,
              type: doc.type || doc.file_type,
              size: doc.size || doc.file_size,
            })),
          });
        } else {
          const createResponse = await DailyReportsService.createSupplierPayment({
            shiftReportId: reportId,
            business: formData.business,
            supplierId: payment.supplierId,
            amountPaid: payment.amountPaid,
            paymentMethodId: payment.paymentMethodId,
            referenceNo: payment.referenceNo,
            notes: payment.notes,
            allocations: payment.allocations,
            selectedInvoiceIds: payment.selectedInvoiceIds, // Include for smart allocation if allocations not provided
            documents: (payment.documents || []).map(doc => ({
              fileId: doc.fileId,
              name: doc.name,
              type: doc.type || doc.file_type,
              size: doc.size || doc.file_size,
            })),
          });

          // Update local state with _id to prevent duplicates on retry
          if (createResponse?.success && createResponse?.data?._id) {
            setSupplierPayments(prev =>
              prev.map(p =>
                (p.id === payment.id || p._id === payment._id)
                  ? { ...p, _id: createResponse.data._id }
                  : p
              )
            );
          }
        }
      }

      // Save staff advances
      for (const advance of staffAdvances) {
        if (advance._id) {
          // Update existing staff advance
          await DailyReportsService.updateStaffAdvance(advance._id, {
            employeeId: advance.employeeId,
            amount: advance.amount,
            advanceType: advance.advanceType, // Send as string for snapshot
            advanceTypeId: null, // Set to null since we use snapshot instead
            paymentMethodId: advance.paymentMethodId || null,
            notes: advance.notes,
            documents: (advance.documents || []).map(doc => ({
              fileId: doc.fileId,
              name: doc.name,
              type: doc.type || doc.file_type,
              size: doc.size || doc.file_size,
            })),
          });
        } else {
          const createResponse = await DailyReportsService.createStaffAdvance({
            shiftReportId: reportId,
            business: formData.business,
            employeeId: advance.employeeId,
            amount: advance.amount,
            advanceType: advance.advanceType, // Send as string for snapshot
            advanceTypeId: null, // Set to null since we use snapshot instead
            paymentMethodId: advance.paymentMethodId || null,
            notes: advance.notes,
            documents: (advance.documents || []).map(doc => ({
              fileId: doc.fileId,
              name: doc.name,
              type: doc.type || doc.file_type,
              size: doc.size || doc.file_size,
            })),
          });

          // Update local state - handle duplicate (backend may have updated existing)
          if (createResponse?.success && createResponse?.data?._id) {
            const returnedId = createResponse.data._id;
            const hadDuplicate = staffAdvances.some(a => a._id === returnedId && a.id !== advance.id);
            setStaffAdvances(prev => {
              if (hadDuplicate) {
                return prev.filter(a => a.id !== advance.id).map(a =>
                  a._id === returnedId ? { ...a, ...createResponse.data } : a
                );
              }
              return prev.map(a =>
                (a.id === advance.id || a._id === advance._id) ? { ...a, _id: returnedId } : a
              );
            });
          }
        }
      }

      // Save late transactions
      for (const transaction of lateTransactions) {
        if (transaction._id) {
          // Update existing transaction
          const updateResponse = await DailyReportsService.updateLateTransaction(transaction._id, {
            channelId: transaction.channelId,
            txnType: transaction.txnType,
            source: transaction.source,
            amount: transaction.amount,
            reason: transaction.reason,
            paymentMethodId: transaction.paymentMethodId || null,
            transactionType: transaction.transactionType || null,
            supplierId: transaction.supplierId || null,
            employeeId: transaction.employeeId || null,
            allocations: transaction.allocations, // Include allocations for supplier payments
            selectedInvoiceIds: transaction.selectedInvoiceIds, // Include for smart allocation
            documents: (transaction.documents || []).map(doc => ({
              fileId: doc.fileId,
              name: doc.name,
              type: doc.type,
              size: doc.size,
            })),
            attachmentIds: (transaction.documents || []).map(doc => doc.fileId).filter(Boolean),
          });
          
          // Notify user if excess debit (overpayment) was created or debit balance was applied
          if (updateResponse?.excessDebit > 0) {
            notifySuccess(
              t("dailyReports.messages.success.lateTransactionUpdatedOverpayment", {
                amount: formatPayment(updateResponse.excessDebit),
              })
            );
          }
          if (updateResponse?.debitBalanceApplied > 0) {
            notifySuccess(
              t("dailyReports.messages.success.previousOverpaymentAppliedTransaction", {
                amount: formatPayment(updateResponse.debitBalanceApplied),
              })
            );
          }
        } else {
          // Create new transaction and update local state with _id
          const createResponse = await DailyReportsService.createLateTransaction({
            shiftReportId: reportId,
            business: formData.business,
            channelId: transaction.channelId,
            txnType: transaction.txnType,
            source: transaction.source,
            amount: transaction.amount,
            reason: transaction.reason,
            paymentMethodId: transaction.paymentMethodId || null,
            transactionType: transaction.transactionType || null,
            supplierId: transaction.supplierId || null,
            employeeId: transaction.employeeId || null,
            appliedBusinessDate: formData.businessDate,
            allocations: transaction.allocations, // Include allocations for supplier payments
            selectedInvoiceIds: transaction.selectedInvoiceIds, // Include for smart allocation
            documents: (transaction.documents || []).map(doc => ({
              fileId: doc.fileId,
              name: doc.name,
              type: doc.type,
              size: doc.size,
            })),
            attachmentIds: (transaction.documents || []).map(doc => doc.fileId).filter(Boolean),
          });
          
          // Update local state - handle duplicate (backend may have updated existing)
          if (createResponse?.success && createResponse?.data?._id) {
            const returnedId = createResponse.data._id;
            const hadDuplicate = lateTransactions.some(t => t._id === returnedId && t.id !== transaction.id);
            setLateTransactions(prev => {
              if (hadDuplicate) {
                return prev.filter(t => t.id !== transaction.id).map(t =>
                  t._id === returnedId ? { ...t, ...createResponse.data } : t
                );
              }
              return prev.map(t =>
                (t.id === transaction.id || t._id === transaction._id) ? { ...t, _id: returnedId } : t
              );
            });
          }
        }
      }

      notifySuccess(t("dailyReports.messages.success.reportSaved"));
      history.push(backTarget);
    } catch (error) {
      console.error("Error saving report:", error);
      notifyError(getApiErrorMessage(error, t("dailyReports.messages.error.generic")));
    } finally {
      setSaveLoading(false);
    }
  };

  const handleSubmit = async () => {
    // Validate all required fields including declaredCashOnHand
    const validationResult = validateFormForSubmit();
    if (!validationResult.isValid) {
      const errorFields = Object.keys(validationResult.errors).filter(key => validationResult.errors[key]);
      if (errorFields.length > 0) {
        const fieldNames = {
          business: t("dailyReports.fields.business"),
          businessDate: t("dailyReports.fields.date"),
          shiftId: t("dailyReports.fields.shift"),
          shiftNo: t("dailyReports.fields.shiftNo"),
          openingCash: t("dailyReports.fields.openingCash"),
          declaredCashOnHand: t("dailyReports.fields.declaredCashOnHand"),
        };
        const missingFields = errorFields.map((field) => fieldNames[field] || field).join(", ");
        notifyError(t("dailyReports.validation.fillInFields", { fields: missingFields }));
      } else {
        notifyError(t("dailyReports.validation.fillAllRequired"));
      }
      return;
    }

    setSubmitLoading(true);
    try {
      let reportId = shiftReportId;

      // Create or update shift report if not already saved
      if (!reportId) {
        const requestData = {
          business: formData.business,
          businessDate: formData.businessDate,
          shiftId: formData.shiftId,
          shiftNo: formData.shiftNo,
          openingCash: parseFloat(formData.openingCash) || 0,
          declaredCashOnHand: parseFloat(formData.declaredCashOnHand) || 0,
          notes: formData.notes || "",
          remarks: formData.remarks || "",
        };

        console.log("Creating shift report with data:", requestData);

        // Validate required fields before sending
        if (!requestData.business || !requestData.businessDate || !requestData.shiftId || !requestData.shiftNo) {
          notifyError(t("dailyReports.validation.fillAllRequired"));
          setSubmitLoading(false);
          return;
        }

        const createResponse = await DailyReportsService.createShiftReport(requestData);

        if (createResponse?.success) {
          reportId = createResponse.data._id;
          setShiftReportId(reportId);
        } else {
          throw new Error(createResponse?.message || "Failed to create report");
        }
      } else {
        // Update existing report
        await DailyReportsService.updateShiftReport(reportId, {
          business: formData.business,
          businessDate: formData.businessDate,
          shiftId: formData.shiftId,
          shiftNo: formData.shiftNo,
          openingCash: parseFloat(formData.openingCash) || 0,
          declaredCashOnHand: parseFloat(formData.declaredCashOnHand) || 0,
          notes: formData.notes,
          remarks: formData.remarks,
        });
      }

      await syncDeletedLineItemsToServer();

      // Save collections
      for (const collection of collections) {
        if (collection._id) {
          // Update existing collection
          await DailyReportsService.updateCollection(collection._id, {
            channelId: collection.channelId,
            paymentMethodId: collection.paymentMethodId,
            amount: collection.amount,
            referenceNo: collection.referenceNo,
            documents: (collection.documents || []).map(doc => ({
              fileId: doc.fileId,
              name: doc.name,
              type: doc.type,
              size: doc.size,
            })),
            attachmentIds: (collection.documents || []).map(doc => doc.fileId).filter(Boolean),
          });
        } else {
          // Create new collection and update local state with _id
          const createResponse = await DailyReportsService.createCollection({
            shiftReportId: reportId,
            business: formData.business,
            channelId: collection.channelId,
            paymentMethodId: collection.paymentMethodId,
            amount: collection.amount,
            referenceNo: collection.referenceNo,
            businessDate: formData.businessDate,
            documents: (collection.documents || []).map(doc => ({
              fileId: doc.fileId,
              name: doc.name,
              type: doc.type,
              size: doc.size,
            })),
            attachmentIds: (collection.documents || []).map(doc => doc.fileId).filter(Boolean),
          });
          
          // Update local state - handle duplicate (backend may have updated existing)
          if (createResponse?.success && createResponse?.data?._id) {
            const returnedId = createResponse.data._id;
            const hadDuplicate = collections.some(c => c._id === returnedId && c.id !== collection.id);
            setCollections(prev => {
              if (hadDuplicate) {
                return prev.filter(c => c.id !== collection.id).map(c =>
                  c._id === returnedId ? { ...c, ...createResponse.data } : c
                );
              }
              return prev.map(c =>
                (c.id === collection.id || c._id === collection._id) ? { ...c, _id: returnedId } : c
              );
            });
          }
        }
      }

      // Save supplier payments
      for (const payment of supplierPayments) {
        if (payment._id) {
          // Update existing supplier payment
          const updateResponse = await DailyReportsService.updateSupplierPayment(payment._id, {
            supplierId: payment.supplierId,
            amountPaid: payment.amountPaid,
            paymentMethodId: payment.paymentMethodId,
            referenceNo: payment.referenceNo,
            notes: payment.notes,
            allocations: payment.allocations,
            selectedInvoiceIds: payment.selectedInvoiceIds, // Include for smart allocation if allocations not provided
            documents: (payment.documents || []).map(doc => ({
              fileId: doc.fileId,
              name: doc.name,
              type: doc.type,
              size: doc.size,
            })),
            attachmentIds: (payment.documents || []).map(doc => doc.fileId).filter(Boolean),
          });
          
          // Notify user if excess debit (overpayment) was created or debit balance was applied
          if (updateResponse?.excessDebit > 0) {
            notifySuccess(
              t("dailyReports.messages.success.paymentUpdatedOverpayment", {
                amount: formatPayment(updateResponse.excessDebit),
              })
            );
          }
          if (updateResponse?.debitBalanceApplied > 0) {
            notifySuccess(
              t("dailyReports.messages.success.previousOverpaymentAppliedPayment", {
                amount: formatPayment(updateResponse.debitBalanceApplied),
              })
            );
          }
        } else {
          // Create new supplier payment and update local state with _id
          const createResponse = await DailyReportsService.createSupplierPayment({
            shiftReportId: reportId,
            business: formData.business,
            supplierId: payment.supplierId,
            amountPaid: payment.amountPaid,
            paymentMethodId: payment.paymentMethodId,
            referenceNo: payment.referenceNo,
            notes: payment.notes,
            allocations: payment.allocations,
            selectedInvoiceIds: payment.selectedInvoiceIds,
            documents: (payment.documents || []).map(doc => ({
              fileId: doc.fileId,
              name: doc.name,
              type: doc.type,
              size: doc.size,
            })),
            attachmentIds: (payment.documents || []).map(doc => doc.fileId).filter(Boolean),
          });
          
          // Update local state - handle duplicate (backend may have updated existing)
          if (createResponse?.success && createResponse?.data?._id) {
            const returnedId = createResponse.data._id;
            const hadDuplicate = supplierPayments.some(p => p._id === returnedId && p.id !== payment.id);
            setSupplierPayments(prev => {
              if (hadDuplicate) {
                return prev.filter(p => p.id !== payment.id).map(p =>
                  p._id === returnedId ? { ...p, ...createResponse.data } : p
                );
              }
              return prev.map(p =>
                (p.id === payment.id || p._id === payment._id) ? { ...p, _id: returnedId } : p
              );
            });
            
            // Notify user if excess debit (overpayment) was created
            const excessAmount = createResponse?.excessDebit || createResponse?.excessCredit || 0;
            if (excessAmount > 0) {
              notifySuccess(
                t("dailyReports.messages.success.paymentSavedOverpayment", {
                  amount: formatPayment(excessAmount),
                })
              );
            }
            if (createResponse?.debitBalanceApplied > 0) {
              notifySuccess(
                t("dailyReports.messages.success.previousOverpaymentAppliedPayment", {
                  amount: formatPayment(createResponse.debitBalanceApplied),
                })
              );
            }
          }
        }
      }

      // Save staff advances
      for (const advance of staffAdvances) {
        if (advance._id) {
          // Update existing staff advance
          await DailyReportsService.updateStaffAdvance(advance._id, {
            employeeId: advance.employeeId,
            amount: advance.amount,
            advanceType: advance.advanceType, // Send as string for snapshot
            advanceTypeId: null, // Set to null since we use snapshot instead
            paymentMethodId: advance.paymentMethodId || null,
            notes: advance.notes,
            documents: (advance.documents || []).map(doc => ({
              fileId: doc.fileId,
              name: doc.name,
              type: doc.type,
              size: doc.size,
            })),
            attachmentIds: (advance.documents || []).map(doc => doc.fileId).filter(Boolean),
          });
        } else {
          // Create new staff advance and update local state with _id
          const createResponse = await DailyReportsService.createStaffAdvance({
            shiftReportId: reportId,
            business: formData.business,
            employeeId: advance.employeeId,
            amount: advance.amount,
            advanceType: advance.advanceType, // Send as string for snapshot
            advanceTypeId: null, // Set to null since we use snapshot instead
            paymentMethodId: advance.paymentMethodId || null,
            notes: advance.notes,
            documents: (advance.documents || []).map(doc => ({
              fileId: doc.fileId,
              name: doc.name,
              type: doc.type,
              size: doc.size,
            })),
            attachmentIds: (advance.documents || []).map(doc => doc.fileId).filter(Boolean),
          });
          
          // Update local state - handle duplicate (backend may have updated existing)
          if (createResponse?.success && createResponse?.data?._id) {
            const returnedId = createResponse.data._id;
            const hadDuplicate = staffAdvances.some(a => a._id === returnedId && a.id !== advance.id);
            setStaffAdvances(prev => {
              if (hadDuplicate) {
                return prev.filter(a => a.id !== advance.id).map(a =>
                  a._id === returnedId ? { ...a, ...createResponse.data } : a
                );
              }
              return prev.map(a =>
                (a.id === advance.id || a._id === advance._id) ? { ...a, _id: returnedId } : a
              );
            });
          }
        }
      }

      // Save late transactions
      for (const transaction of lateTransactions) {
        if (transaction._id) {
          // Update existing transaction
          const updateResponse = await DailyReportsService.updateLateTransaction(transaction._id, {
            channelId: transaction.channelId,
            txnType: transaction.txnType,
            source: transaction.source,
            amount: transaction.amount,
            reason: transaction.reason,
            paymentMethodId: transaction.paymentMethodId || null,
            transactionType: transaction.transactionType || null,
            supplierId: transaction.supplierId || null,
            employeeId: transaction.employeeId || null,
            allocations: transaction.allocations, // Include allocations for supplier payments
            selectedInvoiceIds: transaction.selectedInvoiceIds, // Include for smart allocation
            documents: (transaction.documents || []).map(doc => ({
              fileId: doc.fileId,
              name: doc.name,
              type: doc.type,
              size: doc.size,
            })),
            attachmentIds: (transaction.documents || []).map(doc => doc.fileId).filter(Boolean),
          });
          
          // Notify user if excess debit (overpayment) was created or debit balance was applied
          if (updateResponse?.excessDebit > 0) {
            notifySuccess(
              t("dailyReports.messages.success.lateTransactionUpdatedOverpayment", {
                amount: formatPayment(updateResponse.excessDebit),
              })
            );
          }
          if (updateResponse?.debitBalanceApplied > 0) {
            notifySuccess(
              t("dailyReports.messages.success.previousOverpaymentAppliedTransaction", {
                amount: formatPayment(updateResponse.debitBalanceApplied),
              })
            );
          }
        } else {
          // Create new transaction and update local state with _id
          const createResponse = await DailyReportsService.createLateTransaction({
            shiftReportId: reportId,
            business: formData.business,
            channelId: transaction.channelId,
            txnType: transaction.txnType,
            source: transaction.source,
            amount: transaction.amount,
            reason: transaction.reason,
            paymentMethodId: transaction.paymentMethodId || null,
            transactionType: transaction.transactionType || null,
            supplierId: transaction.supplierId || null,
            employeeId: transaction.employeeId || null,
            appliedBusinessDate: formData.businessDate,
            allocations: transaction.allocations, // Include allocations for supplier payments
            selectedInvoiceIds: transaction.selectedInvoiceIds, // Include for smart allocation
            documents: (transaction.documents || []).map(doc => ({
              fileId: doc.fileId,
              name: doc.name,
              type: doc.type,
              size: doc.size,
            })),
            attachmentIds: (transaction.documents || []).map(doc => doc.fileId).filter(Boolean),
          });
          
          // Update local state - handle duplicate (backend may have updated existing)
          if (createResponse?.success && createResponse?.data?._id) {
            const returnedId = createResponse.data._id;
            const hadDuplicate = lateTransactions.some(t => t._id === returnedId && t.id !== transaction.id);
            setLateTransactions(prev => {
              if (hadDuplicate) {
                return prev.filter(t => t.id !== transaction.id).map(t =>
                  t._id === returnedId ? { ...t, ...createResponse.data } : t
                );
              }
              return prev.map(t =>
                (t.id === transaction.id || t._id === transaction._id) ? { ...t, _id: returnedId } : t
              );
            });
          }
        }
      }

      // Submit for approval
      const response = await DailyReportsService.submitShiftReport(reportId);
        if (response?.success) {
        notifySuccess(t("dailyReports.messages.success.reportSubmitted"));
        history.push(backTarget);
      } else {
        throw new Error(response?.message || "Failed to submit report");
      }
    } catch (error) {
      console.error("Error submitting report:", error);
      const errorMessage = getApiErrorMessage(error, t("dailyReports.messages.error.generic"));
      console.error("Error details:", {
        message: errorMessage,
        response: error.response?.data,
        requestData: {
          business: formData.business,
          businessDate: formData.businessDate,
          shiftId: formData.shiftId,
          shiftNo: formData.shiftNo,
        },
      });
      notifyError(errorMessage);
    } finally {
      setSubmitLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--p-blue)]"></div>
      </div>
    );
  }

  return (
    <Page
      header={{
        title: isEdit ? t("dailyReports.form.titleEdit") : t("dailyReports.form.titleCreate"),
        showBackButton: true,
        onBackClick: () => history.push(backTarget),
      }}
    >
      {/* Header Information */}
      <div className="p-8 rounded-lg border shadow-sm font-sans text-[#303030] font-normal mb-6">
        <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Building className="w-5 h-5 text-[var(--p-blue)]" />
          {t("dailyReports.sections.basicInformation")}
        </h3>
        <Form
          fieldsPerRow={4}
          labelAndFieldDirection="column"
          showFooterButtons={false}
          formFields={[
            {
              label: t("dailyReports.fields.business"),
              required: true,
              name: "business",
              type: "select",
              options: businesses.map((b) => ({ label: b.name, value: b._id })),
              value: formData.business,
              onChange: (value) => {
                setFormData((prev) => ({
                  ...prev,
                  business: value || "",
                  shiftId: "",
                  shiftNo: 1,
                }));
                if (errors.business) {
                  setErrors((prev) => ({ ...prev, business: "" }));
                }
              },
              disabled: false,
              placeholder: t("dailyReports.placeholders.selectBusiness"),
              error: errors.business,
              shouldShowError: !!errors.business,
            },
            {
              label: t("dailyReports.fields.date"),
              required: true,
              name: "businessDate",
              type: "date",
              value: formData.businessDate,
              onChange: (date) => {
                // CustomDatePicker passes Date object directly, not event
                if (date instanceof Date) {
                  const formattedDate = date.toISOString().split("T")[0];
                  setFormData((prev) => ({ ...prev, businessDate: formattedDate }));
                  // Clear error when user changes value
                  if (errors.businessDate) {
                    setErrors((prev) => ({ ...prev, businessDate: "" }));
                  }
                } else if (typeof date === "string") {
                  setFormData((prev) => ({ ...prev, businessDate: date }));
                  if (errors.businessDate) {
                    setErrors((prev) => ({ ...prev, businessDate: "" }));
                  }
                }
              },
              disabled: false,
              error: errors.businessDate,
              shouldShowError: !!errors.businessDate,
            },
            {
              label: t("dailyReports.fields.shift"),
              required: true,
              name: "shiftId",
              type: "select",
              options: shifts.map((s) => ({
                label: `${s.name} (${s.startTime} - ${s.endTime})`,
                value: s._id,
              })),
              value: formData.shiftId,
              onChange: (value) => {
                setFormData((prev) => ({ ...prev, shiftId: value || "" }));
                if (errors.shiftId) {
                  setErrors((prev) => ({ ...prev, shiftId: "" }));
                }
                
                // Auto-populate shiftNo from selected shift
                if (value) {
                  const selectedShift = shifts.find((s) => s._id === value);
                  if (selectedShift && selectedShift.shiftNo) {
                    setFormData((prev) => ({ ...prev, shiftNo: selectedShift.shiftNo }));
                    if (errors.shiftNo) {
                      setErrors((prev) => ({ ...prev, shiftNo: "" }));
                    }
                  }
                }
              },
              disabled: false,
              placeholder: t("dailyReports.placeholders.selectShift"),
              error: errors.shiftId,
              shouldShowError: !!errors.shiftId,
            },
            {
              label: t("dailyReports.fields.shiftNo"),
              required: true,
              name: "shiftNo",
              type: "number",
              value: formData.shiftNo,
              onChange: (e) => {
                const rawValue =
                  e && typeof e === "object" && "target" in e
                    ? e.target.value
                    : e;
                const parsed = Number.parseInt(rawValue, 10);
                setFormData((prev) => ({
                  ...prev,
                  shiftNo: Number.isFinite(parsed) ? parsed : 1,
                }));
              },
              disabled: true,
              error: errors.shiftNo,
              shouldShowError: !!errors.shiftNo,
              placeholder: t("dailyReports.placeholders.shiftNoAuto"),
            },
          ]}
        />
      </div>

        {/* Cash Summary Card */}
        <div className="p-8 rounded-lg border shadow-sm font-sans text-[#303030] font-normal mb-6">
          <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-[var(--p-blue)]" />
            {t("dailyReports.sections.cashSummary")}
          </h3>
          <Form
            fieldsPerRow={6}
            labelAndFieldDirection="column"
            showFooterButtons={false}
            formFields={[
              {
                label: t("dailyReports.fields.openingCash"),
                required: true,
                name: "openingCash",
                type: "number",
                value: formData.openingCash,
                onChange: (e) => {
                  setFormData((prev) => ({
                    ...prev,
                    openingCash: e.target.value,
                  }));
                  if (errors.openingCash) {
                    setErrors((prev) => ({ ...prev, openingCash: "" }));
                  }
                },
                placeholder: "0.00",
                error: errors.openingCash,
                shouldShowError: !!errors.openingCash,
              },
              {
                label: t("dailyReports.fields.collected"),
                name: "collected",
                type: "label",
                value: formatPayment(totalCollectedWithLate),
                className:
                  "text-gray-600 font-medium !bg-gray-200 !border-gray-300 cursor-not-allowed select-none",
                theme: "light",
              },
              {
                label: t("dailyReports.fields.paidOut"),
                name: "paidOut",
                type: "label",
                value: formatPayment(totalPaidOut),
                className:
                  "text-gray-600 font-medium !bg-gray-200 !border-gray-300 cursor-not-allowed select-none",
                theme: "light",
              },
              {
                label: t("dailyReports.fields.expectedCash"),
                name: "expectedCash",
                type: "label",
                value: formatPayment(expectedCash),
                className:
                  "text-gray-600 font-medium !bg-gray-200 !border-gray-300 cursor-not-allowed select-none",
                theme: "light",
              },
              {
                label: t("dailyReports.fields.declaredCash"),
                required: true,
                name: "declaredCashOnHand",
                type: "number",
                value: formData.declaredCashOnHand,
                onChange: (e) => {
                  setFormData((prev) => ({
                    ...prev,
                    declaredCashOnHand: e.target.value,
                  }));
                  if (errors.declaredCashOnHand) {
                    setErrors((prev) => ({ ...prev, declaredCashOnHand: "" }));
                  }
                },
                placeholder: "0.00",
                error: errors.declaredCashOnHand,
                shouldShowError: !!errors.declaredCashOnHand,
              },
            ]}
          />
        </div>

        {/* Balance Summary Card */}
        <div className="p-8 rounded-lg border shadow-sm font-sans text-[#303030] font-normal mb-6 bg-gradient-to-r from-blue-50 to-green-50">
          <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-[var(--p-blue)]" />
            {t("dailyReports.sections.balanceSummary")}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Cash Balance */}
            <div className="bg-white rounded-lg p-6 border-2 border-green-200">
              <h4 className="text-sm font-medium text-gray-600 mb-3">{t("dailyReports.sections.cashBalance")}</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{t("dailyReports.sections.cashSales")}</span>
                  <span className="font-medium text-green-700">{formatPayment(balances.cashSales)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{t("dailyReports.sections.cashPayouts")}</span>
                  <span className="font-medium text-red-700">{formatPayment(balances.cashPayouts)}</span>
                </div>
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-800">{t("dailyReports.sections.cashBalance")}:</span>
                    <span className={`text-lg font-bold ${
                      balances.cashBalance >= 0 ? "text-green-700" : "text-red-700"
                    }`}>
                      {formatPayment(balances.cashBalance)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Online Balance */}
            <div className="bg-white rounded-lg p-6 border-2 border-blue-200">
              <h4 className="text-sm font-medium text-gray-600 mb-3">{t("dailyReports.sections.onlineBalance")}</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{t("dailyReports.sections.onlineSales")}</span>
                  <span className="font-medium text-blue-700">{formatPayment(balances.onlineSales)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{t("dailyReports.sections.onlinePayouts")}</span>
                  <span className="font-medium text-red-700">{formatPayment(balances.onlinePayouts)}</span>
                </div>
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-800">{t("dailyReports.sections.onlineBalance")}:</span>
                    <span className={`text-lg font-bold ${
                      balances.onlineBalance >= 0 ? "text-blue-700" : "text-red-700"
                    }`}>
                      {formatPayment(balances.onlineBalance)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Transactions — separate tables (headers aligned with view report) */}
        <div className="bg-white rounded-lg border shadow-sm p-6 space-y-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-[var(--p-blue)]" />
              {t("dailyReports.sections.transactions")}
            </h3>
            <button
              type="button"
              onClick={handleOpenModal}
              className="flex items-center justify-center px-4 py-2 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[#9CBA33] transition-colors w-full sm:w-auto"
            >
              <Plus size={16} className="mr-2" />
              {t("dailyReports.buttons.addTransaction")}
            </button>
          </div>

          {collections.length === 0 &&
          supplierPayments.length === 0 &&
          staffAdvances.length === 0 &&
          lateTransactions.length === 0 ? (
            <div className="text-center py-8">
              <Package className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">{t("dailyReports.form.emptyTransactions.title")}</h3>
              <p className="mt-1 text-sm text-gray-500">
                {t("dailyReports.form.emptyTransactions.description")}
              </p>
            </div>
          ) : (
            <>
              {/* Collections */}
              {(displayCollections.length > 0 || lateTransactionCollections > 0) && (
                <div className="rounded-lg border border-gray-200 overflow-hidden">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-green-600" />
                      {t("dailyReports.sections.collections")}
                    </h4>
                    <button
                      type="button"
                      onClick={() => handleOpenModalWithType("collection")}
                      className="text-xs sm:text-sm flex items-center gap-1 text-[var(--p-blue)] hover:underline"
                    >
                      <Plus size={14} />
                      {t("dailyReports.buttons.addCollection")}
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t("dailyReports.fields.channel")}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t("dailyReports.tables.referenceReason")}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t("dailyReports.fields.documents")}
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t("dailyReports.fields.amount")}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t("dailyReports.fields.actions")}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {displayCollections.map((c) => (
                          <tr key={`collection-${c.id || c._id}`} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {c.channelSnapshot?.name || t("dailyReports.common.unknownChannel")}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">{c.referenceNo || t("dailyReports.common.dash")}</td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {(c.documents || []).length > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => handleViewDocuments(c.documents)}
                                  className="text-[var(--p-blue)] hover:underline flex items-center gap-1"
                                >
                                  <Eye size={14} />
                                  {t("dailyReports.common.docsCount", { count: c.documents.length })}
                                </button>
                              ) : (
                                t("dailyReports.common.dash")
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                              <span className="font-medium text-green-600">{formatPayment(c.amount)}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleEditTransaction(c, "collection")}
                                  className="text-[var(--p-blue)] hover:text-blue-700"
                                  title={t("dailyReports.buttons.edit")}
                                >
                                  <Edit size={16} />
                                </button>
                                <button
                                  onClick={() => {
                                    const toRemove = c._sourceItems || [c];
                                    setCollections(
                                      collections.filter(
                                        (x) => !toRemove.some((r) => (r.id || r._id) === (x.id || x._id)),
                                      ),
                                    );
                                  }}
                                  className="text-red-600 hover:text-red-900"
                                  title={t("dailyReports.buttons.delete")}
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {lateTransactions
                          .filter((lt) => lt.transactionType === "COLLECTION")
                          .map((lt, idx) => (
                            <tr key={`late-collection-${lt.id || lt._id || idx}`} className="hover:bg-gray-50 bg-purple-50/30">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                <span className="inline-flex items-center gap-1">
                                  {lt.channelSnapshot?.name || t("dailyReports.common.unknownChannel")}
                                  <span className="text-xs text-purple-600 font-normal">{t("dailyReports.common.lateSuffix")}</span>
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-500">{lt.reason || t("dailyReports.common.dash")}</td>
                              <td className="px-6 py-4 text-sm text-gray-500">
                                {(lt.documents || []).length > 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => handleViewDocuments(lt.documents)}
                                    className="text-[var(--p-blue)] hover:underline flex items-center gap-1"
                                  >
                                    <Eye size={14} />
                                    {t("dailyReports.common.docsCount", { count: lt.documents.length })}
                                  </button>
                                ) : (
                                  t("dailyReports.common.dash")
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                                <span className="font-medium text-purple-600">{formatPayment(lt.amount)}</span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleEditTransaction(lt, "late")}
                                    className="text-[var(--p-blue)] hover:text-blue-700"
                                    title={t("dailyReports.buttons.edit")}
                                  >
                                    <Edit size={16} />
                                  </button>
                                  <button
                                    onClick={() =>
                                      setLateTransactions(
                                        lateTransactions.filter((x) => (x.id || x._id) !== (lt.id || lt._id)),
                                      )
                                    }
                                    className="text-red-600 hover:text-red-900"
                                    title={t("dailyReports.buttons.delete")}
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Supplier payments */}
              {(displaySupplierPayments.length > 0 || lateTransactionSupplierPayments > 0) && (
                <div className="rounded-lg border border-gray-200 overflow-hidden">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                      <Building className="w-4 h-4 text-red-600" />
                      {t("dailyReports.sections.supplierPayments")}
                    </h4>
                    <button
                      type="button"
                      onClick={() => handleOpenModalWithType("supplier")}
                      className="text-xs sm:text-sm flex items-center gap-1 text-[var(--p-blue)] hover:underline"
                    >
                      <Plus size={14} />
                      {t("dailyReports.buttons.addSupplierPayment")}
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t("dailyReports.fields.supplier")}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t("dailyReports.tables.referenceReason")}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t("dailyReports.fields.documents")}
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t("dailyReports.fields.amount")}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t("dailyReports.fields.actions")}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {displaySupplierPayments.map((p) => (
                          <tr key={`supplier-${p.id || p._id}`} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {p.supplierNameSnapshot || p.supplierId?.name || t("dailyReports.common.unknownSupplier")}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">{p.referenceNo || t("dailyReports.common.dash")}</td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {(p.documents || []).length > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => handleViewDocuments(p.documents)}
                                  className="text-[var(--p-blue)] hover:underline flex items-center gap-1"
                                >
                                  <Eye size={14} />
                                  {t("dailyReports.common.docsCount", { count: p.documents.length })}
                                </button>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                              <span className="font-medium text-red-600">{formatPayment(p.amountPaid)}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleEditTransaction(p, "supplier")}
                                  className="text-[var(--p-blue)] hover:text-blue-700"
                                  title={t("dailyReports.buttons.edit")}
                                >
                                  <Edit size={16} />
                                </button>
                                <button
                                  onClick={() => {
                                    const toRemove = p._sourceItems || [p];
                                    const allAllocations = toRemove.flatMap((pay) => pay.allocations || []);
                                    if (allAllocations.length > 0) {
                                      setVendorInvoices((prevInvoices) =>
                                        prevInvoices.map((invoice) => {
                                          const alloc = allAllocations.find((a) => a.invoiceId === invoice._id);
                                          if (!alloc) return invoice;
                                          const reversedRemainingAmount = (invoice.remainingAmount || 0) + alloc.allocatedAmount;
                                          const reversedAmountPaid = Math.max(0, (invoice.amountPaid || 0) - alloc.allocatedAmount);
                                          return {
                                            ...invoice,
                                            remainingAmount: reversedRemainingAmount,
                                            amountPaid: reversedAmountPaid,
                                            paymentStatus:
                                              reversedRemainingAmount >= (invoice.total || 0)
                                                ? "Unpaid"
                                                : reversedAmountPaid > 0
                                                  ? "Partially Paid"
                                                  : invoice.paymentStatus,
                                          };
                                        }),
                                      );
                                    }
                                    setSupplierPayments(
                                      supplierPayments.filter(
                                        (x) => !toRemove.some((r) => (r.id || r._id) === (x.id || x._id)),
                                      ),
                                    );
                                  }}
                                  className="text-red-600 hover:text-red-900"
                                  title={t("dailyReports.buttons.delete")}
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {lateTransactions
                          .filter((lt) => lt.transactionType === "SUPPLIER_PAYMENT")
                          .map((lt, idx) => (
                            <tr key={`late-supplier-${lt.id || lt._id || idx}`} className="hover:bg-gray-50 bg-purple-50/30">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                <span className="inline-flex items-center gap-1">
                                  {lt.supplierNameSnapshot || lt.supplierId?.name || t("dailyReports.common.unknownSupplier")}
                                  <span className="text-xs text-purple-600 font-normal">{t("dailyReports.common.lateSuffix")}</span>
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-500">{lt.reason || t("dailyReports.common.dash")}</td>
                              <td className="px-6 py-4 text-sm text-gray-500">
                                {(lt.documents || []).length > 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => handleViewDocuments(lt.documents)}
                                    className="text-[var(--p-blue)] hover:underline flex items-center gap-1"
                                  >
                                    <Eye size={14} />
                                    {t("dailyReports.common.docsCount", { count: lt.documents.length })}
                                  </button>
                                ) : (
                                  t("dailyReports.common.dash")
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                                <span className="font-medium text-purple-600">{formatPayment(lt.amount)}</span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleEditTransaction(lt, "late")}
                                    className="text-[var(--p-blue)] hover:text-blue-700"
                                    title={t("dailyReports.buttons.edit")}
                                  >
                                    <Edit size={16} />
                                  </button>
                                  <button
                                    onClick={() => {
                                      const allocs = lt.allocations || [];
                                      if (allocs.length > 0) {
                                        setVendorInvoices((prevInvoices) =>
                                          prevInvoices.map((invoice) => {
                                            const alloc = allocs.find((a) => a.invoiceId === invoice._id);
                                            if (!alloc) return invoice;
                                            const reversedRemainingAmount = (invoice.remainingAmount || 0) + alloc.allocatedAmount;
                                            const reversedAmountPaid = Math.max(0, (invoice.amountPaid || 0) - alloc.allocatedAmount);
                                            return {
                                              ...invoice,
                                              remainingAmount: reversedRemainingAmount,
                                              amountPaid: reversedAmountPaid,
                                              paymentStatus:
                                                reversedRemainingAmount >= (invoice.total || 0)
                                                  ? "Unpaid"
                                                  : reversedAmountPaid > 0
                                                    ? "Partially Paid"
                                                    : invoice.paymentStatus,
                                            };
                                          }),
                                        );
                                      }
                                      setLateTransactions(
                                        lateTransactions.filter((x) => (x.id || x._id) !== (lt.id || lt._id)),
                                      );
                                    }}
                                    className="text-red-600 hover:text-red-900"
                                    title={t("dailyReports.buttons.delete")}
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Staff advances */}
              {(displayStaffAdvances.length > 0 || lateTransactionAdvances > 0) && (
                <div className="rounded-lg border border-gray-200 overflow-hidden">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                      <Users className="w-4 h-4 text-amber-600" />
                      {t("dailyReports.sections.staffAdvances")}
                    </h4>
                    <button
                      type="button"
                      onClick={() => handleOpenModalWithType("advance")}
                      className="text-xs sm:text-sm flex items-center gap-1 text-[var(--p-blue)] hover:underline"
                    >
                      <Plus size={14} />
                      {t("dailyReports.buttons.addStaffAdvance")}
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t("dailyReports.fields.employee")}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t("dailyReports.fields.paymentMethod")}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t("dailyReports.fields.advanceType")}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t("dailyReports.fields.documents")}
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t("dailyReports.fields.amount")}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t("dailyReports.fields.actions")}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {displayStaffAdvances.map((a) => {
                          const advDocs = (a._sourceItems || [a]).flatMap((x) => x.documents || []);
                          const rowKey = (a._sourceItems || [a]).map((x) => x.id || x._id).join("-");
                          return (
                          <tr key={`advance-${rowKey}`} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {a.employeeNameSnapshot || a.employeeId?.fullName || a.employeeId?.displayName || t("dailyReports.common.unknownEmployee")}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {staffAdvancePaymentMethodLabel(a.paymentMethodId)}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">{staffAdvanceTypeLabel(a)}</td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {advDocs.length > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => handleViewDocuments(advDocs)}
                                  className="text-[var(--p-blue)] hover:underline flex items-center gap-1"
                                >
                                  <Eye size={14} />
                                  {t("dailyReports.common.docsCount", { count: advDocs.length })}
                                </button>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                              <span className="font-medium text-amber-600">{formatPayment(a.amount)}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleEditTransaction(a, "advance")}
                                  className="text-[var(--p-blue)] hover:text-blue-700"
                                  title={t("dailyReports.buttons.edit")}
                                >
                                  <Edit size={16} />
                                </button>
                                <button
                                  onClick={() => {
                                    const toRemove = a._sourceItems || [a];
                                    setStaffAdvances(
                                      staffAdvances.filter(
                                        (x) => !toRemove.some((r) => (r.id || r._id) === (x.id || x._id)),
                                      ),
                                    );
                                  }}
                                  className="text-red-600 hover:text-red-900"
                                  title={t("dailyReports.buttons.delete")}
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                        })}
                        {lateTransactions
                          .filter((lt) => lt.transactionType === "ADVANCE")
                          .map((lt, idx) => (
                            <tr key={`late-advance-${lt.id || lt._id || idx}`} className="hover:bg-gray-50 bg-purple-50/30">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                <span className="inline-flex items-center gap-1">
                                  {lt.employeeNameSnapshot || lt.employeeId?.fullName || lt.employeeId?.displayName || t("dailyReports.common.unknownEmployee")}
                                  <span className="text-xs text-purple-600 font-normal">{t("dailyReports.common.lateSuffix")}</span>
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-500">
                                {lt.paymentMethodSnapshot?.name ||
                                  staffAdvancePaymentMethodLabel(lt.paymentMethodId)}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-500">{lt.reason || t("dailyReports.common.dash")}</td>
                              <td className="px-6 py-4 text-sm text-gray-500">
                                {(lt.documents || []).length > 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => handleViewDocuments(lt.documents)}
                                    className="text-[var(--p-blue)] hover:underline flex items-center gap-1"
                                  >
                                    <Eye size={14} />
                                    {t("dailyReports.common.docsCount", { count: lt.documents.length })}
                                  </button>
                                ) : (
                                  t("dailyReports.common.dash")
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                                <span className="font-medium text-purple-600">{formatPayment(lt.amount)}</span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleEditTransaction(lt, "late")}
                                    className="text-[var(--p-blue)] hover:text-blue-700"
                                    title={t("dailyReports.buttons.edit")}
                                  >
                                    <Edit size={16} />
                                  </button>
                                  <button
                                    onClick={() =>
                                      setLateTransactions(
                                        lateTransactions.filter((x) => (x.id || x._id) !== (lt.id || lt._id)),
                                      )
                                    }
                                    className="text-red-600 hover:text-red-900"
                                    title={t("dailyReports.buttons.delete")}
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Late transactions (detail) */}
              {lateTransactions.length > 0 && (
                <div className="rounded-lg border border-gray-200 overflow-hidden">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-purple-600" />
                      {t("dailyReports.sections.lateTransactions")}
                    </h4>
                    <button
                      type="button"
                      onClick={() => handleOpenModalWithType("late")}
                      className="text-xs sm:text-sm flex items-center gap-1 text-[var(--p-blue)] hover:underline"
                    >
                      <Plus size={14} />
                      {t("dailyReports.buttons.addLateTransaction")}
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t("dailyReports.fields.transactionType")}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t("dailyReports.tables.supplierEmployeeChannel")}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t("dailyReports.fields.paymentMethod")}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t("dailyReports.fields.reason")}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t("dailyReports.fields.documents")}
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t("dailyReports.fields.amount")}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t("dailyReports.fields.actions")}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {lateTransactions.map((txn, index) => (
                          <tr key={txn.id || txn._id || `late-row-${index}`} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {getLateTransactionTypeLabel(txn.transactionType)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {txn.transactionType === "SUPPLIER_PAYMENT" &&
                                (txn.supplierNameSnapshot || txn.supplierId?.name || t("dailyReports.common.dash"))}
                              {txn.transactionType === "ADVANCE" &&
                                (txn.employeeNameSnapshot || txn.employeeId?.fullName || txn.employeeId?.displayName || t("dailyReports.common.dash"))}
                              {txn.transactionType === "COLLECTION" && (txn.channelSnapshot?.name || txn.channelId?.name || t("dailyReports.common.dash"))}
                              {!txn.transactionType && (txn.channelSnapshot?.name || txn.channelId?.name || t("dailyReports.common.dash"))}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              <span>
                                {txn.paymentMethodSnapshot?.name || txn.paymentMethodId?.name || t("dailyReports.common.dash")}
                              </span>
                              {(txn.paymentMethodSnapshot?.type || txn.paymentMethodId?.type) && (
                                <span
                                  className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
                                    (txn.paymentMethodSnapshot?.type || txn.paymentMethodId?.type) === "Cash"
                                      ? "bg-green-100 text-green-800"
                                      : "bg-blue-100 text-blue-800"
                                  }`}
                                >
                                  {(txn.paymentMethodSnapshot?.type || txn.paymentMethodId?.type) === "Cash"
                                    ? t("dailyReports.common.cash")
                                    : txn.paymentMethodSnapshot?.type || txn.paymentMethodId?.type}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">{txn.reason || t("dailyReports.common.dash")}</td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {(txn.documents || []).length > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => handleViewDocuments(txn.documents)}
                                  className="text-[var(--p-blue)] hover:underline flex items-center gap-1"
                                >
                                  <Eye size={14} />
                                  {t("dailyReports.common.docsCount", { count: txn.documents.length })}
                                </button>
                              ) : (
                                t("dailyReports.common.dash")
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                              <span className="font-semibold text-purple-600">{formatPayment(txn.amount)}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleEditTransaction(txn, "late")}
                                  className="text-[var(--p-blue)] hover:text-blue-700"
                                  title={t("dailyReports.buttons.edit")}
                                >
                                  <Edit size={16} />
                                </button>
                                <button
                                  onClick={() => {
                                    const allocs =
                                      txn.transactionType === "SUPPLIER_PAYMENT" && txn.allocations ? txn.allocations : [];
                                    if (allocs.length > 0) {
                                      setVendorInvoices((prevInvoices) =>
                                        prevInvoices.map((invoice) => {
                                          const alloc = allocs.find((a) => a.invoiceId === invoice._id);
                                          if (!alloc) return invoice;
                                          const reversedRemainingAmount = (invoice.remainingAmount || 0) + alloc.allocatedAmount;
                                          const reversedAmountPaid = Math.max(0, (invoice.amountPaid || 0) - alloc.allocatedAmount);
                                          return {
                                            ...invoice,
                                            remainingAmount: reversedRemainingAmount,
                                            amountPaid: reversedAmountPaid,
                                            paymentStatus:
                                              reversedRemainingAmount >= (invoice.total || 0)
                                                ? "Unpaid"
                                                : reversedAmountPaid > 0
                                                  ? "Partially Paid"
                                                  : invoice.paymentStatus,
                                          };
                                        }),
                                      );
                                    }
                                    setLateTransactions(
                                      lateTransactions.filter((x) => (x.id || x._id) !== (txn.id || txn._id)),
                                    );
                                  }}
                                  className="text-red-600 hover:text-red-900"
                                  title={t("dailyReports.buttons.delete")}
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Summary Totals */}
          {(collections.length > 0 ||
            supplierPayments.length > 0 ||
            staffAdvances.length > 0 ||
            lateTransactions.length > 0) && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <div className="flex justify-around">
                <div>
                  <div className="text-xs text-gray-500 mb-1">{t("dailyReports.tables.collectionsTotal")}</div>
                  <div className="text-lg font-semibold text-green-600">
                    {formatPayment(totalCollectedWithLate)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">{t("dailyReports.tables.supplierPaymentsTotal")}</div>
                  <div className="text-lg font-semibold text-red-600">
                    {formatPayment(totalSupplierPaymentsWithLate)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">{t("dailyReports.tables.staffAdvancesTotal")}</div>
                  <div className="text-lg font-semibold text-amber-600">
                    {formatPayment(totalStaffAdvancesWithLate)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">{t("dailyReports.tables.netTotal")}</div>
                  <div className="text-lg font-semibold text-[var(--p-blue)]">
                    {formatPayment(totalCollectedWithLate - totalPaidOut)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

      {/* Notes Section - At Bottom */}
      <div className="p-8 rounded-lg border shadow-sm font-sans text-[#303030] font-normal mt-6">
        <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-gray-500" />
          {t("dailyReports.sections.notes")}
        </h3>
        <Form
          fieldsPerRow={2}
          labelAndFieldDirection="column"
          showFooterButtons={false}
          formFields={[
            {
              label: t("dailyReports.fields.notes"),
              name: "notes",
              type: "textarea",
              value: formData.notes,
              onChange: (e) =>
                setFormData((prev) => ({ ...prev, notes: e.target.value })),
              placeholder: t("dailyReports.placeholders.addNotes"),
              rows: 5,
            },
            {
              label: t("dailyReports.fields.remarks"),
              name: "remarks",
              type: "textarea",
              value: formData.remarks,
              onChange: (e) =>
                setFormData((prev) => ({ ...prev, remarks: e.target.value })),
              placeholder: t("dailyReports.placeholders.addRemarks"),
              rows: 5,
            },
          ]}
        />
      </div>

      {/* Action Buttons at Bottom */}
      <div className="flex justify-end items-center mt-6 space-x-4">
        <button
          onClick={() => history.push(backTarget)}
          className="px-4 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50 transition-colors font-medium"
        >
          {t("dailyReports.buttons.cancel")}
        </button>
        <button
          onClick={handleSaveDraft}
          disabled={saveLoading}
          className="px-4 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
        >
          {saveLoading ? t("dailyReports.buttons.saving") : t("dailyReports.buttons.saveDraft")}
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitLoading}
          className="px-4 py-2 text-sm text-white rounded-lg font-medium disabled:opacity-50"
          style={{ backgroundColor: "var(--p-blue)" }}
        >
          {submitLoading ? t("dailyReports.buttons.submitting") : t("dailyReports.buttons.submit")}
        </button>
      </div>

      {/* Unified Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg border shadow-sm p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-800">
                {!modalType &&
                  (editingItem
                    ? t("dailyReports.form.modal.editTransaction")
                    : t("dailyReports.form.modal.addTransaction"))}
                {modalType === "collection" &&
                  (editingItem
                    ? t("dailyReports.form.modal.editCollection")
                    : t("dailyReports.form.modal.addCollection"))}
                {modalType === "supplier" &&
                  (editingItem
                    ? t("dailyReports.form.modal.editSupplierPayment")
                    : t("dailyReports.form.modal.addSupplierPayment"))}
                {modalType === "advance" &&
                  (editingItem
                    ? t("dailyReports.form.modal.editStaffAdvance")
                    : t("dailyReports.form.modal.addStaffAdvance"))}
                {modalType === "late" &&
                  (editingItem
                    ? t("dailyReports.form.modal.editLateTransaction")
                    : t("dailyReports.form.modal.addLateTransaction"))}
              </h3>
              <button onClick={handleCloseModal}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Type Selector */}
            {!modalType && !editingItem && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  {t("dailyReports.form.modal.selectTransactionType")}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleSelectType("collection")}
                    className="p-4 rounded-lg border-2 transition-all text-left hover:border-[var(--p-blue)]"
                    style={{
                      borderColor:
                        modalType === "collection"
                          ? "var(--p-blue)"
                          : "#e5e7eb",
                      backgroundColor:
                        modalType === "collection" ? "#f0fbf7" : "white",
                    }}
                  >
                    <div className="flex items-center">
                      <DollarSign
                        size={20}
                        className="mr-2"
                        style={{
                          color:
                            modalType === "collection"
                              ? "var(--p-blue)"
                              : "#6b7280",
                        }}
                      />
                      <span
                        className="font-medium"
                        style={{
                          color:
                            modalType === "collection"
                              ? "var(--p-blue)"
                              : "#1f2937",
                        }}
                      >
                        {t("dailyReports.transactionTypes.COLLECTION")}
                      </span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectType("supplier")}
                    className="p-4 rounded-lg border-2 transition-all text-left hover:border-[var(--p-blue)]"
                    style={{
                      borderColor:
                        modalType === "supplier"
                          ? "var(--p-blue)"
                          : "#e5e7eb",
                      backgroundColor:
                        modalType === "supplier" ? "#f0fbf7" : "white",
                    }}
                  >
                    <div className="flex items-center">
                      <Building
                        size={20}
                        className="mr-2"
                        style={{
                          color:
                            modalType === "supplier"
                              ? "var(--p-blue)"
                              : "#6b7280",
                        }}
                      />
                      <span
                        className="font-medium"
                        style={{
                          color:
                            modalType === "supplier"
                              ? "var(--p-blue)"
                              : "#1f2937",
                        }}
                      >
                        {t("dailyReports.transactionTypes.SUPPLIER_PAYMENT")}
                      </span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectType("advance")}
                    className="p-4 rounded-lg border-2 transition-all text-left hover:border-[var(--p-blue)]"
                    style={{
                      borderColor:
                        modalType === "advance"
                          ? "var(--p-blue)"
                          : "#e5e7eb",
                      backgroundColor:
                        modalType === "advance" ? "#f0fbf7" : "white",
                    }}
                  >
                    <div className="flex items-center">
                      <Users
                        size={20}
                        className="mr-2"
                        style={{
                          color:
                            modalType === "advance"
                              ? "var(--p-blue)"
                              : "#6b7280",
                        }}
                      />
                      <span
                        className="font-medium"
                        style={{
                          color:
                            modalType === "advance"
                              ? "var(--p-blue)"
                              : "#1f2937",
                        }}
                      >
                        {t("dailyReports.transactionTypes.ADVANCE")}
                      </span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectType("late")}
                    className="p-4 rounded-lg border-2 transition-all text-left hover:border-[var(--p-blue)]"
                    style={{
                      borderColor:
                        modalType === "late" ? "var(--p-blue)" : "#e5e7eb",
                      backgroundColor:
                        modalType === "late" ? "#f0fbf7" : "white",
                    }}
                  >
                    <div className="flex items-center">
                      <Clock
                        size={20}
                        className="mr-2"
                        style={{
                          color:
                            modalType === "late"
                              ? "var(--p-blue)"
                              : "#6b7280",
                        }}
                      />
                      <span
                        className="font-medium"
                        style={{
                          color:
                            modalType === "late" ? "var(--p-blue)" : "#1f2937",
                        }}
                      >
                        {t("dailyReports.transactionTypes.LATE_TRANSACTION")}
                      </span>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Form Fields - Only show when type is selected */}
            {modalType && (
              <Form
              fieldsPerRow={1}
              labelAndFieldDirection="column"
              showFooterButtons={false}
              formFields={[
                // Collection fields
                ...(modalType === "collection"
                  ? [
                      {
                        label: t("dailyReports.fields.channel"),
                        required: true,
                        name: "channelId",
                        type: "select",
                        options: channels.map((c) => ({ label: c.name, value: c._id })),
                        value: unifiedForm.channelId,
                        onChange: (value) => {
                          setUnifiedForm((prev) => ({ 
                            ...prev, 
                            channelId: value || "",
                            paymentMethodId: "", // Reset payment method when channel changes
                          }));
                        },
                        placeholder: t("dailyReports.placeholders.selectChannel"),
                      },
                      {
                        label: t("dailyReports.fields.paymentMethod"),
                        name: "paymentMethodId",
                        type: "select",
                        options: getPaymentMethodsForChannel(unifiedForm.channelId).map((pm) => ({ 
                          label: `${pm.name} (${pm.type || t("dailyReports.common.cash")})`, 
                          value: pm._id 
                        })),
                        value: unifiedForm.paymentMethodId,
                        onChange: (value) =>
                          setUnifiedForm((prev) => ({ ...prev, paymentMethodId: value || "" })),
                        placeholder: unifiedForm.channelId
                          ? t("dailyReports.placeholders.selectPaymentMethod")
                          : t("dailyReports.placeholders.selectChannelFirst"),
                        disabled: !unifiedForm.channelId,
                      },
                      {
                        label: t("dailyReports.fields.amount"),
                        required: true,
                        name: "amount",
                        type: "number",
                        value: unifiedForm.amount,
                        onChange: (e) =>
                          setUnifiedForm((prev) => ({ ...prev, amount: e.target.value })),
                        placeholder: "0.00",
                      },
                      {
                        label: t("dailyReports.fields.referenceNo"),
                        name: "referenceNo",
                        type: "text",
                        value: unifiedForm.referenceNo,
                        onChange: (e) =>
                          setUnifiedForm((prev) => ({ ...prev, referenceNo: e.target.value })),
                        placeholder: t("dailyReports.placeholders.transactionReference"),
                      },
                    ]
                  : []),
                // Supplier Payment fields
                ...(modalType === "supplier"
                  ? [
                      {
                        label: t("dailyReports.fields.supplier"),
                        required: true,
                        name: "supplierId",
                        type: "select",
                        options: vendors.map((v) => ({
                          label: v.basicInformation?.vendorDisplayName || v.name,
                          value: v._id,
                        })),
                        value: unifiedForm.supplierId,
                        onChange: (value) => {
                          setUnifiedForm((prev) => ({ ...prev, supplierId: value || "" }));
                          if (value) {
                            fetchVendorInvoices(value);
                            setShowInvoicesSection(true);
                          }
                          if (!value) {
                            setVendorInvoices([]);
                          }
                        },
                        placeholder: t("dailyReports.placeholders.selectSupplier"),
                      },
                      // Outstanding invoices (collapsible) - shown immediately after supplier selection
                      {
                        name: "supplierOutstandingInvoices",
                        type: "custom",
                        // keep layout simple and ensure this appears directly under Supplier
                        show: !!unifiedForm.supplierId,
                        component: () => {
                          const totalOutstanding = (vendorInvoices || []).reduce(
                            (sum, inv) =>
                              sum +
                              (parseFloat(inv.remainingAmount || inv.total || 0) ||
                                0),
                            0
                          );

                          return (
                            <div className="mt-2">
                              <button
                                type="button"
                                onClick={() => setShowInvoicesSection((v) => !v)}
                                className="w-full flex items-center justify-between p-4 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="p-2 bg-orange-200 rounded-lg">
                                    <Receipt className="w-4 h-4 text-orange-700" />
                                  </div>
                                  <div className="text-left">
                                    <div className="text-sm font-semibold text-gray-900">
                                      {t("dailyReports.sections.outstandingInvoices")}
                                    </div>
                                    <div className="text-xs text-gray-600 mt-0.5">
                                      {vendorInvoices.length > 0 ? (
                                        <>
                                          {vendorInvoices.length === 1
                                            ? t("dailyReports.form.invoices.unpaidInvoice", {
                                                count: vendorInvoices.length,
                                              })
                                            : t("dailyReports.form.invoices.unpaidInvoices", {
                                                count: vendorInvoices.length,
                                              })}{" "}
                                          • {t("dailyReports.form.invoices.totalLabel")}{" "}
                                          <span className="font-semibold text-orange-700">
                                            {formatPayment(totalOutstanding)}
                                          </span>
                                        </>
                                      ) : (
                                        t("dailyReports.form.invoices.noOutstanding")
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center">
                                  {showInvoicesSection ? (
                                    <ChevronUp className="w-4 h-4 text-gray-500" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4 text-gray-500" />
                                  )}
                                </div>
                              </button>

                              {showInvoicesSection && (
                                <>
                                  {vendorInvoices.length > 0 ? (
                                    <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden bg-white">
                                      <div className="max-h-64 overflow-y-auto">
                                        <div className="p-3 bg-blue-50 border-b border-gray-200 flex items-center justify-between">
                                          <div className="flex items-center gap-2">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                if (selectedInvoiceIds.length === vendorInvoices.length) {
                                                  setSelectedInvoiceIds([]);
                                                } else {
                                                  setSelectedInvoiceIds(vendorInvoices.map(inv => inv._id));
                                                }
                                              }}
                                              className="text-xs text-blue-700 hover:text-blue-900 font-medium"
                                            >
                                              {selectedInvoiceIds.length === vendorInvoices.length
                                                ? t("dailyReports.buttons.clearAll")
                                                : t("dailyReports.buttons.selectAll")}
                                            </button>
                                            {selectedInvoiceIds.length > 0 && (
                                              <span className="text-xs text-gray-600">
                                                {t(
                                                  "dailyReports.form.invoices.selectedWithCount",
                                                  { count: selectedInvoiceIds.length },
                                                )}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                        <table className="w-full">
                                          <thead className="bg-gray-50 border-b border-gray-200">
                                            <tr>
                                              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-12">
                                                <input
                                                  type="checkbox"
                                                  checked={selectedInvoiceIds.length === vendorInvoices.length && vendorInvoices.length > 0}
                                                  onChange={(e) => {
                                                    if (e.target.checked) {
                                                      setSelectedInvoiceIds(vendorInvoices.map(inv => inv._id));
                                                    } else {
                                                      setSelectedInvoiceIds([]);
                                                    }
                                                  }}
                                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                />
                                              </th>
                                              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                                {t("dailyReports.tables.invoiceNumber")}
                                              </th>
                                              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                                {t("dailyReports.tables.due")}
                                              </th>
                                              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                                {t("dailyReports.fields.status")}
                                              </th>
                                              <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                                                {t("dailyReports.fields.amount")}
                                              </th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-gray-100">
                                            {vendorInvoices.map((inv) => {
                                              const dueDate = inv.dueDate
                                                ? new Date(inv.dueDate).toLocaleDateString()
                                                : "-";
                                              const paymentStatus =
                                                inv.paymentStatus || "Unpaid";
                                              const remainingAmount = parseFloat(
                                                inv.remainingAmount || inv.total || 0
                                              );
                                              const isOverdue =
                                                inv.dueDate &&
                                                new Date(inv.dueDate) < new Date() &&
                                                paymentStatus !== "Paid";
                                              const isSelected = selectedInvoiceIds.includes(inv._id);
                                              return (
                                                <tr
                                                  key={inv._id || inv.invoiceNumber}
                                                  className={
                                                    isOverdue 
                                                      ? "bg-red-50/40" 
                                                      : isSelected 
                                                        ? "bg-blue-50 hover:bg-blue-100" 
                                                        : "hover:bg-gray-50"
                                                  }
                                                >
                                                  <td className="px-4 py-3">
                                                    <input
                                                      type="checkbox"
                                                      checked={isSelected}
                                                      onChange={(e) => {
                                                        if (e.target.checked) {
                                                          setSelectedInvoiceIds([...selectedInvoiceIds, inv._id]);
                                                        } else {
                                                          setSelectedInvoiceIds(selectedInvoiceIds.filter(id => id !== inv._id));
                                                        }
                                                      }}
                                                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                    />
                                                  </td>
                                                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                                    {inv.invoiceNumber || "-"}
                                                  </td>
                                                  <td className="px-4 py-3 text-sm text-gray-600">
                                                    <span
                                                      className={
                                                        isOverdue ? "text-red-600 font-medium" : ""
                                                      }
                                                    >
                                                      {dueDate}
                                                      {isOverdue && (
                                                        <AlertTriangle className="inline-block ml-1 w-3 h-3 text-red-600" />
                                                      )}
                                                    </span>
                                                  </td>
                                                  <td className="px-4 py-3 text-sm">
                                                    <span
                                                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                        paymentStatus === "Partially Paid"
                                                          ? "bg-yellow-100 text-yellow-800"
                                                          : "bg-red-100 text-red-800"
                                                      }`}
                                                    >
                                                      {paymentStatus === "Paid"
                                                        ? t("dailyReports.common.paymentStatuses.paid")
                                                        : paymentStatus ===
                                                            "Partially Paid"
                                                          ? t("dailyReports.common.paymentStatuses.partiallyPaid")
                                                          : t("dailyReports.common.paymentStatuses.unpaid")}
                                                    </span>
                                                  </td>
                                                  <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                                                    {formatPayment(remainingAmount)}
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                          <tfoot className="bg-gray-50 border-t border-gray-200">
                                            <tr>
                                              <td
                                                colSpan="4"
                                                className="px-4 py-3 text-sm font-medium text-gray-700 text-right"
                                              >
                                                {t("dailyReports.form.invoices.totalOutstanding")}
                                              </td>
                                              <td className="px-4 py-3 text-sm font-semibold text-orange-700 text-right">
                                                {formatPayment(totalOutstanding)}
                                              </td>
                                            </tr>
                                            {selectedInvoiceIds.length > 0 && (
                                              <tr>
                                                <td
                                                  colSpan="4"
                                                  className="px-4 py-3 text-sm font-medium text-blue-700 text-right"
                                                >
                                                {t("dailyReports.form.invoices.selectedWithCount", {
                                                  count: selectedInvoiceIds.length,
                                                })}
                                                </td>
                                                <td className="px-4 py-3 text-sm font-semibold text-blue-700 text-right">
                                                  {formatPayment(
                                                    vendorInvoices
                                                      .filter(inv => selectedInvoiceIds.includes(inv._id))
                                                      .reduce((sum, inv) => sum + parseFloat(inv.remainingAmount || inv.total || 0), 0)
                                                  )}
                                                </td>
                                              </tr>
                                            )}
                                          </tfoot>
                                        </table>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="mt-3 p-6 border border-gray-200 rounded-lg bg-gray-50 text-center">
                                      <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-3" />
                                      <p className="text-sm font-medium text-gray-700">
                                        {t("dailyReports.form.invoices.noOutstanding")}
                                      </p>
                                      <p className="text-xs text-gray-500 mt-1">
                                        {t("dailyReports.form.invoices.allPaid")}
                                      </p>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          );
                        },
                      },
                      {
                        label: t("dailyReports.fields.paymentMethod"),
                        name: "paymentMethodId",
                        type: "select",
                        options: paymentMethods.map((pm) => ({ 
                          label: `${pm.name} (${pm.type || t("dailyReports.common.cash")})`, 
                          value: pm._id 
                        })),
                        value: unifiedForm.paymentMethodId,
                        onChange: (value) =>
                          setUnifiedForm((prev) => ({ ...prev, paymentMethodId: value || "" })),
                        placeholder: t("dailyReports.placeholders.selectPaymentMethod"),
                      },
                      {
                        label: t("dailyReports.fields.amount"),
                        required: true,
                        name: "amountPaid",
                        type: "number",
                        value: unifiedForm.amountPaid,
                        onChange: (e) => {
                          setUnifiedForm((prev) => ({ ...prev, amountPaid: e.target.value }));
                        },
                        placeholder: "0.00",
                      },
                      // Allocation Preview
                      {
                        name: "allocationPreview",
                        type: "custom",
                        show: showAllocationPreview && allocationPreview && selectedInvoiceIds.length > 0,
                        component: () => (
                          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-sm font-semibold text-gray-900">
                                {t("dailyReports.sections.paymentAllocationPreview")}
                              </h4>
                              <button
                                type="button"
                                onClick={() => setShowAllocationPreview(false)}
                                className="text-gray-400 hover:text-gray-600"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {allocationPreview.allocations.map((alloc, idx) => (
                                <div key={idx} className="flex items-center justify-between p-2 bg-white rounded border border-gray-200">
                                  <div className="flex-1">
                                    <div className="text-sm font-medium text-gray-900">{alloc.invoiceNumber}</div>
                                    <div className="text-xs text-gray-500">
                                      {t("dailyReports.form.allocation.remaining", {
                                        from: formatPayment(alloc.remaining),
                                        to: formatPayment(
                                          alloc.remainingAfterPayment ||
                                            alloc.remaining - alloc.allocatedAmount,
                                        ),
                                      })}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-sm font-semibold text-blue-700">{formatPayment(alloc.allocatedAmount)}</div>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                                      alloc.allocationType === "full" 
                                        ? "bg-green-100 text-green-800" 
                                        : "bg-yellow-100 text-yellow-800"
                                    }`}>
                                      {alloc.allocationType === "full"
                                        ? t("dailyReports.form.allocation.full")
                                        : t("dailyReports.form.allocation.partial")}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="mt-3 pt-3 border-t border-blue-200 space-y-1">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-700">
                                  {t("dailyReports.form.allocation.totalSelected")}
                                </span>
                                <span className="font-semibold">{formatPayment(allocationPreview.totalSelected)}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-700">
                                  {t("dailyReports.form.allocation.totalAllocated")}
                                </span>
                                <span className="font-semibold text-blue-700">{formatPayment(allocationPreview.totalAllocated)}</span>
                              </div>
                              {(allocationPreview.excessDebit > 0 || allocationPreview.excessCredit > 0) && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-700">
                                    {t("dailyReports.form.allocation.overpaymentSupplierOwes")}
                                  </span>
                                  <span className="font-semibold text-orange-700">+{formatPayment(allocationPreview.excessDebit || allocationPreview.excessCredit)}</span>
                                </div>
                              )}
                              {allocationPreview.unallocatedAmount > 0 && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-700">
                                    {t("dailyReports.form.allocation.unallocated")}
                                  </span>
                                  <span className="font-semibold text-orange-700">{formatPayment(allocationPreview.unallocatedAmount)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ),
                      },
                      {
                        label: t("dailyReports.fields.referenceNo"),
                        name: "referenceNo",
                        type: "text",
                        value: unifiedForm.referenceNo,
                        onChange: (e) =>
                          setUnifiedForm((prev) => ({ ...prev, referenceNo: e.target.value })),
                        placeholder: t("dailyReports.placeholders.chequeOrTransferRef"),
                      },
                      {
                        label: t("dailyReports.fields.notes"),
                        name: "notes",
                        type: "textarea",
                        value: unifiedForm.notes,
                        onChange: (e) =>
                          setUnifiedForm((prev) => ({ ...prev, notes: e.target.value })),
                        rows: 2,
                      },
                    ]
                  : []),
                // Staff Advance fields
                ...(modalType === "advance"
                  ? [
                      {
                        label: t("dailyReports.fields.employee"),
                        required: true,
                        name: "employeeId",
                        type: "select",
                        options: staff.map((s) => ({
                          label: s.fullName || s.displayName,
                          value: toSelectValue(s._id),
                        })),
                        value: toSelectValue(unifiedForm.employeeId),
                        onChange: (value) =>
                          setUnifiedForm((prev) => ({ ...prev, employeeId: value || "" })),
                        placeholder: t("dailyReports.placeholders.selectEmployee"),
                      },
                      {
                        label: t("dailyReports.fields.advanceType"),
                        name: "advanceType",
                        type: "select",
                        options: advanceTypes.map((at) => ({
                          label: at.name,
                          value: toSelectValue(at.code || at._id),
                        })),
                        value: toSelectValue(unifiedForm.advanceType),
                        onChange: (value) =>
                          setUnifiedForm((prev) => ({ ...prev, advanceType: value || "" })),
                        placeholder: t("dailyReports.placeholders.selectAdvanceType"),
                      },
                      {
                        label: t("dailyReports.fields.paymentMethod"),
                        name: "paymentMethodId",
                        type: "select",
                        options: paymentMethods.map((pm) => ({
                          label: `${pm.name} (${pm.type || t("dailyReports.common.cash")})`,
                          value: toSelectValue(pm._id),
                        })),
                        value: toSelectValue(unifiedForm.paymentMethodId),
                        onChange: (value) =>
                          setUnifiedForm((prev) => ({
                            ...prev,
                            paymentMethodId: value || "",
                          })),
                        placeholder: t("dailyReports.placeholders.selectPaymentMethod"),
                      },
                      {
                        label: t("dailyReports.fields.amount"),
                        required: true,
                        name: "amount",
                        type: "number",
                        value: unifiedForm.amount,
                        onChange: (e) =>
                          setUnifiedForm((prev) => ({ ...prev, amount: e.target.value })),
                        placeholder: "0.00",
                      },
                      {
                        label: t("dailyReports.fields.notes"),
                        name: "notes",
                        type: "textarea",
                        value: unifiedForm.notes,
                        onChange: (e) =>
                          setUnifiedForm((prev) => ({ ...prev, notes: e.target.value })),
                        rows: 2,
                      },
                    ]
                  : []),
                // Late Transaction fields
                ...(modalType === "late"
                  ? [
                      {
                        label: t("dailyReports.fields.transactionType"),
                        name: "txnType",
                        type: "select",
                        options: transactionTypes.map((tt) => ({
                          label: t(`dailyReports.transactionTypes.${tt.code || tt._id}`, {
                            defaultValue: tt.name || tt.code || tt._id,
                          }),
                          value: tt.code || tt._id,
                        })),
                        value: unifiedForm.txnType,
                        onChange: (value) =>
                          setUnifiedForm((prev) => ({ ...prev, txnType: value || "" })),
                        placeholder: t("dailyReports.placeholders.selectTransactionType"),
                      },
                      {
                        label: t("dailyReports.fields.category"),
                        name: "transactionType",
                        type: "select",
                        required: true,
                        options: [
                          { label: t("dailyReports.transactionTypes.COLLECTION"), value: "COLLECTION" },
                          {
                            label: t("dailyReports.transactionTypes.SUPPLIER_PAYMENT"),
                            value: "SUPPLIER_PAYMENT",
                          },
                          { label: t("dailyReports.transactionTypes.ADVANCE"), value: "ADVANCE" },
                        ],
                        value: unifiedForm.transactionType,
                        onChange: (value) => {
                          setUnifiedForm((prev) => ({ 
                            ...prev, 
                            transactionType: value || "",
                            supplierId: "", // Reset supplier when category changes
                            employeeId: "", // Reset employee when category changes
                          }));
                          if (value === "SUPPLIER_PAYMENT") {
                            // Auto-populate payment method to Cash for supplier payments
                            const cashPaymentMethod = paymentMethods.find(pm => pm.type === "Cash");
                            if (cashPaymentMethod) {
                              setUnifiedForm((prev) => ({ ...prev, paymentMethodId: cashPaymentMethod._id }));
                            }
                          }
                          setLateSelectedInvoiceIds([]);
                          setLateAllocationPreview(null);
                        },
                        placeholder: t("dailyReports.placeholders.selectCategory"),
                      },
                      ...(unifiedForm.transactionType === "SUPPLIER_PAYMENT"
                        ? [
                            {
                              label: t("dailyReports.fields.supplier"),
                              name: "supplierId",
                              type: "select",
                              required: true,
                              options: vendors.map((v) => ({
                                label:
                                  v.basicInformation?.vendorDisplayName ||
                                  v.name ||
                                  v.companyName ||
                                  t("dailyReports.common.unknownSupplier"),
                                value: v._id,
                              })),
                              value: unifiedForm.supplierId,
                              onChange: (value) => {
                                setUnifiedForm((prev) => ({ ...prev, supplierId: value || "" }));
                                if (value) {
                                  fetchVendorInvoices(value);
                                  setShowInvoicesSection(true);
                                } else {
                                  setVendorInvoices([]);
                                }
                                setLateSelectedInvoiceIds([]);
                                setLateAllocationPreview(null);
                              },
                              placeholder: t("dailyReports.placeholders.selectSupplier"),
                            },
                            // Outstanding invoices for late transaction supplier payments
                            {
                              name: "lateSupplierOutstandingInvoices",
                              type: "custom",
                              show: !!unifiedForm.supplierId && unifiedForm.transactionType === "SUPPLIER_PAYMENT",
                              component: () => {
                                const totalOutstanding = (vendorInvoices || []).reduce(
                                  (sum, inv) =>
                                    sum +
                                    (parseFloat(inv.remainingAmount || inv.total || 0) ||
                                      0),
                                  0
                                );

                                return (
                                  <div className="mt-2">
                                    <button
                                      type="button"
                                      onClick={() => setShowInvoicesSection((v) => !v)}
                                      className="w-full flex items-center justify-between p-4 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors"
                                    >
                                      <div className="flex items-center gap-3">
                                        <div className="p-2 bg-orange-200 rounded-lg">
                                          <Receipt className="w-4 h-4 text-orange-700" />
                                        </div>
                                        <div className="text-left">
                                          <div className="text-sm font-semibold text-gray-900">
                                            {t("dailyReports.sections.outstandingInvoices")}
                                          </div>
                                          <div className="text-xs text-gray-600 mt-0.5">
                                            {vendorInvoices.length > 0 ? (
                                              <>
                                                {vendorInvoices.length === 1
                                                  ? t(
                                                      "dailyReports.form.invoices.unpaidInvoice",
                                                      {
                                                        count: vendorInvoices.length,
                                                      },
                                                    )
                                                  : t("dailyReports.form.invoices.unpaidInvoices", {
                                                      count: vendorInvoices.length,
                                                    })}{" "}
                                                • {t("dailyReports.form.invoices.totalLabel")}{" "}
                                                <span className="font-semibold text-orange-700">
                                                  {formatPayment(totalOutstanding)}
                                                </span>
                                              </>
                                            ) : (
                                              t("dailyReports.form.invoices.noOutstanding")
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex items-center">
                                        {showInvoicesSection ? (
                                          <ChevronUp className="w-4 h-4 text-gray-500" />
                                        ) : (
                                          <ChevronDown className="w-4 h-4 text-gray-500" />
                                        )}
                                      </div>
                                    </button>

                                    {showInvoicesSection && (
                                      <>
                                        {vendorInvoices.length > 0 ? (
                                          <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden bg-white">
                                            <div className="max-h-64 overflow-y-auto">
                                              <div className="p-3 bg-blue-50 border-b border-gray-200 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      if (lateSelectedInvoiceIds.length === vendorInvoices.length) {
                                                        setLateSelectedInvoiceIds([]);
                                                      } else {
                                                        setLateSelectedInvoiceIds(vendorInvoices.map(inv => inv._id));
                                                      }
                                                    }}
                                                    className="text-xs text-blue-700 hover:text-blue-900 font-medium"
                                                  >
                                                    {lateSelectedInvoiceIds.length === vendorInvoices.length
                                                      ? t("dailyReports.buttons.clearAll")
                                                      : t("dailyReports.buttons.selectAll")}
                                                  </button>
                                                  {lateSelectedInvoiceIds.length > 0 && (
                                                    <span className="text-xs text-gray-600">
                                                      {t(
                                                        "dailyReports.form.invoices.selectedWithCount",
                                                        { count: lateSelectedInvoiceIds.length },
                                                      )}
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                              <table className="w-full">
                                                <thead className="bg-gray-50 border-b border-gray-200">
                                                  <tr>
                                                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-12">
                                                      <input
                                                        type="checkbox"
                                                        checked={lateSelectedInvoiceIds.length === vendorInvoices.length && vendorInvoices.length > 0}
                                                        onChange={(e) => {
                                                          if (e.target.checked) {
                                                            setLateSelectedInvoiceIds(vendorInvoices.map(inv => inv._id));
                                                          } else {
                                                            setLateSelectedInvoiceIds([]);
                                                          }
                                                        }}
                                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                      />
                                                    </th>
                                                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                                      {t("dailyReports.tables.invoiceNumber")}
                                                    </th>
                                                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                                      {t("dailyReports.tables.due")}
                                                    </th>
                                                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                                      {t("dailyReports.fields.status")}
                                                    </th>
                                                    <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                                                      {t("dailyReports.fields.amount")}
                                                    </th>
                                                  </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                  {vendorInvoices.map((inv) => {
                                                    const dueDate = inv.dueDate
                                                      ? new Date(inv.dueDate).toLocaleDateString()
                                                      : "-";
                                                    const paymentStatus =
                                                      inv.paymentStatus || "Unpaid";
                                                    const remainingAmount = parseFloat(
                                                      inv.remainingAmount || inv.total || 0
                                                    );
                                                    const isOverdue =
                                                      inv.dueDate &&
                                                      new Date(inv.dueDate) < new Date() &&
                                                      paymentStatus !== "Paid";
                                                    const isSelected = lateSelectedInvoiceIds.includes(inv._id);
                                                    return (
                                                      <tr
                                                        key={inv._id || inv.invoiceNumber}
                                                        className={
                                                          isOverdue 
                                                            ? "bg-red-50/40" 
                                                            : isSelected 
                                                              ? "bg-blue-50 hover:bg-blue-100" 
                                                              : "hover:bg-gray-50"
                                                        }
                                                      >
                                                        <td className="px-4 py-3">
                                                          <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={(e) => {
                                                              if (e.target.checked) {
                                                                setLateSelectedInvoiceIds([...lateSelectedInvoiceIds, inv._id]);
                                                              } else {
                                                                setLateSelectedInvoiceIds(lateSelectedInvoiceIds.filter(id => id !== inv._id));
                                                              }
                                                            }}
                                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                          />
                                                        </td>
                                                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                                          {inv.invoiceNumber || "-"}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-gray-600">
                                                          <span
                                                            className={
                                                              isOverdue ? "text-red-600 font-medium" : ""
                                                            }
                                                          >
                                                            {dueDate}
                                                            {isOverdue && (
                                                              <AlertTriangle className="inline-block ml-1 w-3 h-3 text-red-600" />
                                                            )}
                                                          </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-sm">
                                                          <span
                                                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                              paymentStatus === "Partially Paid"
                                                                ? "bg-yellow-100 text-yellow-800"
                                                                : "bg-red-100 text-red-800"
                                                            }`}
                                                          >
                                                          {paymentStatus === "Paid"
                                                            ? t("dailyReports.common.paymentStatuses.paid")
                                                            : paymentStatus ===
                                                                "Partially Paid"
                                                              ? t(
                                                                  "dailyReports.common.paymentStatuses.partiallyPaid",
                                                                )
                                                              : t(
                                                                  "dailyReports.common.paymentStatuses.unpaid",
                                                                )}
                                                          </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                                                          {formatPayment(remainingAmount)}
                                                        </td>
                                                      </tr>
                                                    );
                                                  })}
                                                </tbody>
                                                <tfoot className="bg-gray-50 border-t border-gray-200">
                                                  <tr>
                                                    <td
                                                      colSpan="4"
                                                      className="px-4 py-3 text-sm font-medium text-gray-700 text-right"
                                                    >
                                                      {t("dailyReports.form.invoices.totalOutstanding")}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm font-semibold text-orange-700 text-right">
                                                      {formatPayment(totalOutstanding)}
                                                    </td>
                                                  </tr>
                                                  {lateSelectedInvoiceIds.length > 0 && (
                                                    <tr>
                                                      <td
                                                        colSpan="4"
                                                        className="px-4 py-3 text-sm font-medium text-blue-700 text-right"
                                                      >
                                                        {t(
                                                          "dailyReports.form.invoices.selectedWithCount",
                                                          { count: lateSelectedInvoiceIds.length },
                                                        )}
                                                      </td>
                                                      <td className="px-4 py-3 text-sm font-semibold text-blue-700 text-right">
                                                        {formatPayment(
                                                          vendorInvoices
                                                            .filter(inv => lateSelectedInvoiceIds.includes(inv._id))
                                                            .reduce((sum, inv) => sum + parseFloat(inv.remainingAmount || inv.total || 0), 0)
                                                        )}
                                                      </td>
                                                    </tr>
                                                  )}
                                                </tfoot>
                                              </table>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="mt-3 p-6 border border-gray-200 rounded-lg bg-gray-50 text-center">
                                            <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-3" />
                                            <p className="text-sm font-medium text-gray-700">
                                              {t("dailyReports.form.invoices.noOutstanding")}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-1">
                                              {t("dailyReports.form.invoices.allPaid")}
                                            </p>
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </div>
                                );
                              },
                            },
                          ]
                        : []),
                      ...(unifiedForm.transactionType === "ADVANCE"
                        ? [
                            {
                              label: t("dailyReports.fields.employee"),
                              name: "employeeId",
                              type: "select",
                              required: true,
                              options: staff.map((s) => ({
                                label:
                                  s.fullName || s.displayName || t("dailyReports.common.unknown"),
                                value: s._id,
                              })),
                              value: unifiedForm.employeeId,
                              onChange: (value) =>
                                setUnifiedForm((prev) => ({ ...prev, employeeId: value || "" })),
                              placeholder: t("dailyReports.placeholders.selectEmployee"),
                            },
                          ]
                        : []),
                      {
                        label: t("dailyReports.fields.channel"),
                        name: "channelId",
                        type: "select",
                        options: channels.map((c) => ({ label: c.name, value: c._id })),
                        value: unifiedForm.channelId,
                        onChange: (value) => {
                          setUnifiedForm((prev) => ({ 
                            ...prev, 
                            channelId: value || "",
                            paymentMethodId: "", // Reset payment method when channel changes
                          }));
                        },
                        placeholder: t("dailyReports.placeholders.selectChannel"),
                      },
                      {
                        label: t("dailyReports.fields.paymentMethod"),
                        name: "paymentMethodId",
                        type: "select",
                        options: getPaymentMethodsForChannel(unifiedForm.channelId).map((pm) => ({ 
                          label: `${pm.name} (${pm.type || t("dailyReports.common.cash")})`, 
                          value: pm._id 
                        })),
                        value: unifiedForm.paymentMethodId,
                        onChange: (value) =>
                          setUnifiedForm((prev) => ({ ...prev, paymentMethodId: value || "" })),
                        placeholder: unifiedForm.channelId
                          ? t("dailyReports.placeholders.selectPaymentMethod")
                          : t("dailyReports.placeholders.selectChannelFirst"),
                        disabled: !unifiedForm.channelId,
                      },
                      {
                        label: t("dailyReports.fields.amount"),
                        required: true,
                        name: "amount",
                        type: "number",
                        value: unifiedForm.amount,
                        onChange: (e) =>
                          setUnifiedForm((prev) => ({ ...prev, amount: e.target.value })),
                        placeholder: "0.00",
                      },
                      {
                        label: t("dailyReports.fields.reason"),
                        name: "reason",
                        type: "textarea",
                        value: unifiedForm.reason,
                        onChange: (e) =>
                          setUnifiedForm((prev) => ({ ...prev, reason: e.target.value })),
                        placeholder: t("dailyReports.placeholders.reasonForLateTransaction"),
                        rows: 2,
                      },
                    ]
                  : []),
              ]}
              />
            )}

            {/* Documents */}
            {modalType && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-800 mb-2">
                  {t("dailyReports.sections.documentsOptional")}
                </label>
                
                {/* Dropzone */}
                <div
                  className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${
                    dragOver
                      ? "border-[var(--p-blue)] bg-blue-50"
                      : "border-gray-300 hover:border-[var(--p-blue)] hover:bg-gray-50"
                  } ${docUploadLoading ? "opacity-50 pointer-events-none" : ""}`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => documentsInputRef.current?.click()}
                >
                  <input
                    ref={documentsInputRef}
                    type="file"
                    multiple
                    onChange={handleFileInputChange}
                    disabled={docUploadLoading}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  />
                  
                  <div className="flex flex-col items-center gap-2">
                    <Upload
                      className={`w-8 h-8 ${
                        dragOver ? "text-[var(--p-blue)]" : "text-gray-400"
                      }`}
                    />
                    {docUploadLoading ? (
                      <div className="text-gray-600">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[var(--p-blue)] mx-auto mb-2"></div>
                        <p className="text-sm">
                          {t("dailyReports.form.documents.uploading", {
                            progress: docUploadProgress,
                          })}
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="text-gray-600">
                          <p className="text-sm font-medium">
                            {dragOver
                              ? t("dailyReports.form.documents.dropHere")
                              : t("dailyReports.form.documents.clickOrDrag")}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {t("dailyReports.form.documents.acceptedFormats")}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Uploaded Documents List */}
                {(unifiedForm.documents || []).length > 0 && (
                  <div className="mt-3 border border-gray-200 rounded-lg p-3 bg-gray-50">
                    <div className="text-xs font-medium text-gray-700 mb-2">
                      {t("dailyReports.form.documents.uploaded", {
                        count: unifiedForm.documents.length,
                      })}
                    </div>
                    <div className="space-y-2">
                      {unifiedForm.documents.map((doc, docIndex) => {
                        const docFileId = doc.fileId?._id || doc.fileId || doc._id || docIndex;
                        const docName = doc.name || t("dailyReports.common.document");
                        const docSize = doc.size || doc.file_size || 0;
                        return (
                          <div
                            key={docFileId}
                            className="flex items-center justify-between gap-3 p-2 bg-white rounded border border-gray-200"
                          >
                            <div className="min-w-0 flex-1">
                              <button
                                type="button"
                                onClick={() => handleOpenUploadedDocument(docFileId)}
                                className="text-sm text-[var(--p-blue)] hover:underline truncate text-left"
                                title={t("dailyReports.buttons.open")}
                              >
                                {docName}
                              </button>
                              <div className="text-xs text-gray-500">
                                {docSize > 0 ? `${(docSize / 1024).toFixed(0)} KB` : ""}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setUnifiedForm((prev) => ({
                                  ...prev,
                                  documents: (prev.documents || []).filter(
                                    (d, idx) => {
                                      const dFileId = d.fileId?._id || d.fileId || d._id || idx;
                                      return dFileId !== docFileId;
                                    }
                                  ),
                                }))
                              }
                              className="text-red-600 hover:text-red-700 p-1"
                              title={t("dailyReports.buttons.remove")}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Outstanding invoices now render directly after Supplier selection */}

            {modalType && (
              <div className="mt-4 flex gap-3">
                {!editingItem && (
                  <button
                    onClick={() => setModalType(null)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    {t("dailyReports.buttons.backToList")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className={`${editingItem ? "flex-1" : "flex-1"} px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50`}
                >
                  {editingItem ? t("dailyReports.buttons.cancel") : t("dailyReports.buttons.done")}
                </button>
                <button
                  onClick={handleAddItem}
                  className="flex-1 px-4 py-2 text-white rounded-lg hover:opacity-90 transition-all font-medium"
                  style={{ backgroundColor: "var(--p-blue)" }}
                >
                  {editingItem ? t("dailyReports.buttons.update") : t("dailyReports.buttons.addToList")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Document Viewer Modal */}
      {showDocumentsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {t("dailyReports.form.documentsModal.title")}
              </h2>
              <button
                onClick={() => {
                  setShowDocumentsModal(false);
                  setSelectedTransactionDocuments([]);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {selectedTransactionDocuments.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-2 text-sm text-gray-500">
                    {t("dailyReports.form.documentsModal.empty")}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedTransactionDocuments.map((doc, index) => (
                    <div
                      key={doc.fileId || index}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <FileText className="h-5 w-5 text-gray-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {doc.name || t("dailyReports.form.documents.documentNumber", { number: index + 1 })}
                          </p>
                          {doc.size && (
                            <p className="text-xs text-gray-500">
                              {(doc.size / 1024).toFixed(2)} KB
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenUploadedDocument(doc.fileId)}
                          className="px-3 py-1.5 text-sm text-[var(--p-blue)] hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1"
                        >
                          <Eye size={16} />
                          {t("dailyReports.buttons.view")}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
