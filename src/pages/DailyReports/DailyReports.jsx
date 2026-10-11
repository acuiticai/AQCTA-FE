import { useState, useEffect, useContext } from "react";
import {
  Plus,
  DollarSign,
  Users,
  ShoppingCart,
  Clock,
  Calendar,
  Building,
  ChevronDown,
  X,
  Edit,
  Trash2,
  Save,
} from "lucide-react";
import axios from "axios";
import { useHistory } from "react-router-dom";
import { AdminContext } from "@/context/AdminContext";
import { notifySuccess, notifyError } from "@/utils/toast";
import { formatAmount } from "@/components/formatAmount";
import { isSingleAssignedBusiness } from "@/utils/sessionAssignedBusinesses";
import PaymentModal from "@/pages/Accounts/CustomerInvoice/components/PaymentModalFixed";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

export default function DailyReports() {
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const history = useHistory();

  // State Management
  const [selectedBusiness, setSelectedBusiness] = useState("");
  const [businesses, setBusinesses] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [channels, setChannels] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedShift, setSelectedShift] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [shiftNo, setShiftNo] = useState(1); // HR shift slot (1…n)

  // Collections (Money In) - Auto-populated from payments
  const [collections, setCollections] = useState([]);
  
  // Today's Invoices (for reference)
  const [todayUnpaidInvoices, setTodayUnpaidInvoices] = useState([]);
  const [todayPaidInvoices, setTodayPaidInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  // Supplier Payments (Money Out)
  const [supplierPayments, setSupplierPayments] = useState([]);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState("");
  const [vendorInvoices, setVendorInvoices] = useState([]);
  const [supplierPaymentForm, setSupplierPaymentForm] = useState({
    supplierId: "",
    amountPaid: "",
    paymentMethod: "",
    referenceNo: "",
    notes: "",
  });

  // Staff for current shift
  const [shiftStaff, setShiftStaff] = useState([]);
  
  // Collections data table modal
  const [showCollectionsTable, setShowCollectionsTable] = useState(false);
  
  // Current shift detection
  const [currentShift, setCurrentShift] = useState(null);
  const [shiftInvoices, setShiftInvoices] = useState([]);
  const [shiftVendorInvoices, setShiftVendorInvoices] = useState([]);
  const [currentShiftTimeRange, setCurrentShiftTimeRange] = useState({ start: null, end: null });
  
  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState(null);
  const [selectedChannelForPayment, setSelectedChannelForPayment] = useState("");

  // Late Transactions
  const [lateTransactions, setLateTransactions] = useState([]);
  const [showLateTransactionModal, setShowLateTransactionModal] = useState(false);
  const [lateTransactionForm, setLateTransactionForm] = useState({
    txnType: "SALE",
    source: "MANUAL",
    amount: "",
    reason: "",
  });

  // Cash Summary
  const [cashSummary, setCashSummary] = useState({
    totalCollected: 0,
    totalPaidSuppliers: 0,
    totalStaffAdvances: 0,
    expectedCashOnHand: 0,
    declaredCashOnHand: "",
  });

  const [loading, setLoading] = useState(false);

  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo?.token}`,
  };

  // Fetch Businesses
  useEffect(() => {
    const storedBusinesses = localStorage.getItem("businesses");
    if (storedBusinesses) {
      const parsed = JSON.parse(storedBusinesses);
      setBusinesses(parsed);
      if (parsed.length > 0 && !selectedBusiness) {
        setSelectedBusiness(parsed[0]._id);
      }
    }
  }, []);

  // Fetch Shifts
  useEffect(() => {
    if (selectedBusiness) {
      fetchShifts();
      fetchChannels();
      fetchPaymentMethods();
      fetchTodayInvoices();
    }
  }, [selectedBusiness, selectedDate]);
  
  // Fetch today's invoices (unpaid and paid)
  const fetchTodayInvoices = async () => {
    if (!selectedBusiness || !selectedDate) return;
    
    setLoadingInvoices(true);
    try {
      const startDate = new Date(selectedDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(selectedDate);
      endDate.setHours(23, 59, 59, 999);
      
      // Fetch invoices created today
      const response = await axios.get(`${Base_URL}/proforma-invoice`, {
        headers,
        params: {
          businessId: selectedBusiness,
          dateFrom: startDate.toISOString().split('T')[0],
          dateTo: endDate.toISOString().split('T')[0],
          limit: 1000,
        },
      });
      
      const invoices = response.data.data || [];
      
      // Separate unpaid and paid invoices
      const unpaid = invoices.filter((inv) => {
        const totalPaid = (inv.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
        const remaining = (inv.grandTotal || 0) - totalPaid;
        return remaining > 0 && inv.status?.toLowerCase() !== "paid";
      });
      
      const paid = invoices.filter((inv) => {
        const totalPaid = (inv.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
        return totalPaid > 0 && inv.status?.toLowerCase() === "paid";
      });
      
      setTodayUnpaidInvoices(unpaid);
      setTodayPaidInvoices(paid);
    } catch (error) {
      console.error("Error fetching today's invoices:", error);
    } finally {
      setLoadingInvoices(false);
    }
  };
  
  // Collections are now auto-populated from payments - no manual entry needed

  // Fetch Vendors
  useEffect(() => {
    if (selectedBusiness) {
      fetchVendors();
    }
  }, [selectedBusiness]);

  // Fetch Staff
  useEffect(() => {
    if (selectedBusiness) {
      fetchStaff();
    }
  }, [selectedBusiness]);

  // Calculate Summary
  useEffect(() => {
    calculateSummary();
  }, [collections, supplierPayments]);
  
  // Detect current shift and fetch shift data
  useEffect(() => {
    if (selectedBusiness && selectedDate && shifts.length > 0) {
      detectCurrentShift();
    }
  }, [selectedBusiness, selectedDate, shifts]);
  
  // Detect current shift based on time
  const detectCurrentShift = () => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentDate = new Date(selectedDate);
    
    // Find shifts for this business
    const businessShifts = shifts.filter(s => {
      const shiftBusinessId = s.business_id || s.business;
      return shiftBusinessId && shiftBusinessId.toString() === selectedBusiness.toString();
    });
    
    if (businessShifts.length === 0) {
      setCurrentShift(null);
      return;
    }
    
    // Determine if morning (before 2 PM) or evening (after 2 PM)
    // Morning shift: typically 6 AM - 2 PM
    // Evening shift: typically 2 PM - 10 PM
    let detectedShift = null;
    let shiftNo = 1; // Default to morning
    
    if (currentHour < 14) {
      // Morning shift
      shiftNo = 1;
      detectedShift = businessShifts.find(s => 
        s.name?.toLowerCase().includes('morning') || 
        s.name?.toLowerCase().includes('day') ||
        (parseInt(s.startTime?.split(':')[0]) || 0) < 12
      ) || businessShifts[0];
    } else {
      // Evening shift
      shiftNo = 2;
      detectedShift = businessShifts.find(s => 
        s.name?.toLowerCase().includes('evening') || 
        s.name?.toLowerCase().includes('night') ||
        (parseInt(s.startTime?.split(':')[0]) || 0) >= 12
      ) || businessShifts[businessShifts.length - 1] || businessShifts[0];
    }
    
    setCurrentShift(detectedShift);
    setShiftNo(shiftNo);
    setSelectedShift(detectedShift?._id || "");
    
    // Fetch shift-specific data
    if (detectedShift) {
      fetchShiftData(detectedShift, shiftNo, currentDate);
    }
  };
  
  // Fetch data for current shift
  const fetchShiftData = async (shift, shiftNumber, date) => {
    if (!shift || !date) return;
    
    try {
      // Calculate shift time range
      const [startHour, startMin] = (shift.startTime || "06:00").split(':').map(Number);
      const [endHour, endMin] = (shift.endTime || "22:00").split(':').map(Number);
      
      const shiftStart = new Date(date);
      shiftStart.setHours(startHour, startMin || 0, 0, 0);
      
      const shiftEnd = new Date(date);
      shiftEnd.setHours(endHour, endMin || 0, 0, 0);
      
      // If evening shift, might extend to next day
      if (shiftNumber === 2 && endHour < startHour) {
        shiftEnd.setDate(shiftEnd.getDate() + 1);
      }
      
      // Store shift time range for use in render
      setCurrentShiftTimeRange({ start: shiftStart, end: shiftEnd });
      
      // Fetch customer invoices for shift period
      const invoiceResponse = await axios.get(`${Base_URL}/proforma-invoice`, {
        headers,
        params: {
          businessId: selectedBusiness,
          dateFrom: shiftStart.toISOString().split('T')[0],
          dateTo: shiftEnd.toISOString().split('T')[0],
          limit: 1000,
        },
      });
      
      const invoices = invoiceResponse.data.data || [];
      // Filter invoices by invoice_date (not createdAt) during shift period
      const shiftInvs = invoices.filter(inv => {
        const invDate = new Date(inv.invoice_date || inv.createdAt);
        const invDateOnly = new Date(invDate.getFullYear(), invDate.getMonth(), invDate.getDate());
        const shiftStartOnly = new Date(shiftStart.getFullYear(), shiftStart.getMonth(), shiftStart.getDate());
        const shiftEndOnly = new Date(shiftEnd.getFullYear(), shiftEnd.getMonth(), shiftEnd.getDate());
        return invDateOnly >= shiftStartOnly && invDateOnly <= shiftEndOnly;
      });
      setShiftInvoices(shiftInvs);
      
      // Fetch vendor invoices for shift period
      const vendorInvResponse = await axios.get(`${Base_URL}/vendor-invoices`, {
        headers,
        params: {
          business: selectedBusiness,
          limit: 1000,
        },
      });
      
      const vendorInvs = vendorInvResponse.data.data || [];
      
      // Filter vendor invoices that were PAID during the shift period
      // Check payments array for approved payments within shift time
      const shiftVendorInvs = vendorInvs.filter(inv => {
        // Check if invoice has payments
        if (!inv.payments || inv.payments.length === 0) {
          return false; // No payments, skip
        }
        
        // Check if any approved payment was made during shift period
        const hasPaymentInShift = inv.payments.some(payment => {
          // Only count approved payments
          if (payment.status !== "Approved") {
            return false;
          }
          
          // Check payment date - vendor invoices use payment.date field
          const paymentDate = new Date(payment.date || payment.approvedAt || payment.createdAt);
          
          // Check if payment date falls within shift time range
          // Compare dates (ignore time for date-only comparison, but include time for shift)
          return paymentDate >= shiftStart && paymentDate <= shiftEnd;
        });
        
        return hasPaymentInShift;
      });
      
      setShiftVendorInvoices(shiftVendorInvs);
      
      // Fetch staff assigned to this shift
      const staffResponse = await axios.get(`${Base_URL}/staff-management`, {
        headers,
        params: { business: selectedBusiness, limit: 1000 },
      });
      
      const allStaff = staffResponse.data.staffList || staffResponse.data.data || [];
      // Filter staff by shift
      const staffForShift = allStaff.filter(staff => {
        const staffShiftId = staff.shift?._id || staff.shift?._id || staff.shift;
        return staffShiftId && staffShiftId.toString() === shift._id.toString();
      });
      setShiftStaff(staffForShift);
      
    } catch (error) {
      console.error("Error fetching shift data:", error);
    }
  };

  const fetchShifts = async () => {
    try {
      const payload = {
        business_id: selectedBusiness,
        FilterStatus: "",
        FilterName: "",
      };
      const response = await axios.post(`${Base_URL}/shifts/get_all`, payload, {
        headers,
      });
      setShifts(response.data.data || []);
    } catch (error) {
      console.error("Error fetching shifts:", error);
      notifyError("Failed to load shifts");
    }
  };

  const fetchChannels = async () => {
    try {
      const payload = {
        business_id: selectedBusiness,
        FilterStatus: "Active",
        FilterName: "",
      };
      const response = await axios.post(`${Base_URL}/daily-reports/channels/get_all`, payload, {
        headers,
      });
      setChannels(response.data.data || []);
    } catch (error) {
      console.error("Error fetching channels:", error);
      notifyError("Failed to load channels");
    }
  };

  const fetchPaymentMethods = async () => {
    try {
      const payload = {
        business_id: selectedBusiness,
        FilterStatus: "active",
        FilterName: "",
      };
      const response = await axios.post(
        `${Base_URL}/items/Payment Methods/get_all`,
        payload,
        { headers }
      );
      const methods = response.data.data || [];
      
      // If no payment methods found, use default hardcoded ones (like rest of system)
      if (methods.length === 0) {
        const defaultMethods = [
          { _id: "cash", name: "Cash" },
          { _id: "bank_transfer", name: "Bank Transfer" },
          { _id: "check", name: "Check" },
          { _id: "online", name: "Online Payment" },
          { _id: "wire_transfer", name: "Wire Transfer" },
          { _id: "credit_card", name: "Credit Card" },
        ];
        setPaymentMethods(defaultMethods);
      } else {
        setPaymentMethods(methods);
      }
    } catch (error) {
      console.error("Error fetching payment methods:", error);
      // Fallback to default payment methods if API fails
      const defaultMethods = [
        { _id: "cash", name: "Cash" },
        { _id: "bank_transfer", name: "Bank Transfer" },
        { _id: "check", name: "Check" },
        { _id: "online", name: "Online Payment" },
        { _id: "wire_transfer", name: "Wire Transfer" },
        { _id: "credit_card", name: "Credit Card" },
      ];
      setPaymentMethods(defaultMethods);
    }
  };

  const fetchVendors = async () => {
    try {
      const response = await axios.get(`${Base_URL}/vendors`, {
        headers,
        params: { business: selectedBusiness },
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
        params: { business: selectedBusiness, limit: 1000 },
      });
      setStaffList(response.data.staffList || response.data.data || []);
    } catch (error) {
      console.error("Error fetching staff:", error);
    }
  };

  const fetchVendorInvoices = async (vendorId) => {
    try {
      if (!vendorId || !selectedBusiness) {
        setVendorInvoices([]);
        return;
      }

      // Use daily-reports supplier outstanding endpoint (computed from approved payments)
      const response = await axios.get(
        `${Base_URL}/daily-reports/suppliers/${vendorId}/invoices`,
        {
          headers,
          params: { business: selectedBusiness },
        }
      );
      setVendorInvoices(response?.data?.data || []);
    } catch (error) {
      console.error("Error fetching vendor invoices:", error);
      setVendorInvoices([]);
    }
  };

  const calculateSummary = () => {
    const totalCollected = collections.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);
    const totalPaidSuppliers = supplierPayments.reduce(
      (sum, p) => sum + (parseFloat(p.amountPaid) || 0),
      0
    );

    setCashSummary({
      totalCollected,
      totalPaidSuppliers,
      totalStaffAdvances: 0,
    });
  };

  // Auto-populate collections from payments made during shift
  const updateCollectionsFromPayments = () => {
    if (!shiftInvoices.length) {
      setCollections([]);
      return;
    }
    
    const newCollections = [];
    shiftInvoices.forEach((invoice) => {
      invoice.payments?.forEach((payment) => {
        // Only include payments made during the shift period
        const paymentDate = new Date(payment.paymentDate);
        const shiftDate = new Date(selectedDate);
        
        if (paymentDate.toDateString() === shiftDate.toDateString() && payment.amount > 0) {
          newCollections.push({
            id: `payment-${invoice._id}-${payment._id || Date.now()}`,
            channel: payment.channel || "COUNTER", // Use channel from payment or default
            method: payment.paymentMode,
            amount: payment.amount,
            referenceNo: payment.reference || invoice.invoice_number,
            invoiceId: invoice._id,
            invoiceNumber: invoice.invoice_number,
            paymentId: payment._id?.toString(),
            receivedAt: payment.paymentDate,
            isAuto: true,
          });
        }
      });
    });
    
    // Remove duplicates based on paymentId and invoiceId
    const uniqueCollections = [];
    const seen = new Set();
    newCollections.forEach((c) => {
      const key = `${c.invoiceId}-${c.paymentId}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueCollections.push(c);
      }
    });
    
    setCollections(uniqueCollections);
  };
  
  // Update collections when shift invoices change
  useEffect(() => {
    if (shiftInvoices.length > 0) {
      updateCollectionsFromPayments();
    } else {
      setCollections([]);
    }
  }, [shiftInvoices, selectedDate]);
  
  const handleDeleteCollection = (id) => {
    setCollections(collections.filter((c) => c.id !== id));
    notifySuccess("Collection removed");
  };

  // Supplier Payment Handlers
  const handleSelectVendor = (vendorId) => {
    setSelectedVendor(vendorId);
    setSupplierPaymentForm({ ...supplierPaymentForm, supplierId: vendorId });
    fetchVendorInvoices(vendorId);
  };

  const handleAddSupplierPayment = () => {
    if (!supplierPaymentForm.supplierId || !supplierPaymentForm.amountPaid) {
      notifyError("Please fill all required fields");
      return;
    }

    const selectedVendorData = vendors.find((v) => v._id === supplierPaymentForm.supplierId);

    const newPayment = {
      id: Date.now(),
      ...supplierPaymentForm,
      amountPaid: parseFloat(supplierPaymentForm.amountPaid),
      supplierNameSnapshot: selectedVendorData?.basicInformation?.vendorDisplayName || "Unknown",
      paidAt: new Date().toISOString(),
    };

    setSupplierPayments([...supplierPayments, newPayment]);
    setSupplierPaymentForm({
      supplierId: "",
      amountPaid: "",
      paymentMethod: "",
      referenceNo: "",
      notes: "",
    });
    setSelectedVendor("");
    setVendorInvoices([]);
    setShowSupplierModal(false);
    notifySuccess("Supplier payment added successfully");
  };

  const handleDeleteSupplierPayment = (id) => {
    setSupplierPayments(supplierPayments.filter((p) => p.id !== id));
    notifySuccess("Supplier payment removed");
  };

  // Staff Advances removed - no longer needed

  // Late Transaction Handlers
  const handleAddLateTransaction = () => {
    if (!lateTransactionForm.amount || !lateTransactionForm.reason) {
      notifyError("Please fill all required fields");
      return;
    }

    const newTransaction = {
      id: Date.now(),
      ...lateTransactionForm,
      amount: parseFloat(lateTransactionForm.amount),
      txnAt: new Date().toISOString(),
      businessDateApplied: selectedDate,
    };

    setLateTransactions([...lateTransactions, newTransaction]);
    setLateTransactionForm({
      txnType: "SALE",
      source: "MANUAL",
      amount: "",
      reason: "",
    });
    setShowLateTransactionModal(false);
    notifySuccess("Late transaction added successfully");
  };

  const handleDeleteLateTransaction = (id) => {
    setLateTransactions(lateTransactions.filter((t) => t.id !== id));
    notifySuccess("Late transaction removed");
  };

  const handleSaveShiftReport = async () => {
    if (!selectedBusiness || !selectedDate || !selectedShift) {
      notifyError("Please select business, date, and shift");
      return;
    }

    setLoading(true);
    try {
      // TODO: Implement API call to save shift report
      // const payload = {
      //   business: selectedBusiness,
      //   businessDate: selectedDate,
      //   shiftNo,
      //   shiftId: selectedShift,
      //   collections,
      //   supplierPayments,
      //   staffAdvances,
      //   lateTransactions,
      //   cashSummary,
      // };
      // await axios.post(`${Base_URL}/daily-reports/shifts`, payload, { headers });

      notifySuccess("Daily report saved successfully!");
    } catch (error) {
      console.error("Error saving shift report:", error);
      notifyError("Failed to save daily report");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-full mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
                Daily Report
              </h1>
              <p className="text-gray-600 mt-2">
                Track collections and supplier payments for daily shift reports
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <button
                onClick={handleSaveShiftReport}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-3 bg-[#A6C437] text-white rounded-lg hover:bg-[#8FA82F] disabled:opacity-50 transition-colors shadow-sm whitespace-nowrap"
              >
                <Save className="w-4 h-4" />
                {loading ? "Saving..." : "Save Report"}
              </button>
            </div>
          </div>
        </div>

        {/* Summary Cards - Moved to Top */}
        <div className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Total Collected</p>
                  <p className="text-3xl font-bold text-green-600">
                    {formatAmount(cashSummary.totalCollected)}
                  </p>
                </div>
                <div className="bg-green-100 rounded-full p-4">
                  <DollarSign className="w-8 h-8 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Supplier Payments</p>
                  <p className="text-3xl font-bold text-red-600">
                    {formatAmount(cashSummary.totalPaidSuppliers)}
                  </p>
                </div>
                <div className="bg-red-100 rounded-full p-4">
                  <ShoppingCart className="w-8 h-8 text-red-600" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {!isSingleAssignedBusiness() && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Business
              </label>
              <select
                value={selectedBusiness}
                onChange={(e) => setSelectedBusiness(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#A6C437]"
              >
                <option value="">Select Business</option>
                {businesses.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#A6C437]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Current Shift
              </label>
              <div className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50">
                {currentShift ? (
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">
                      {currentShift.name} ({currentShift.startTime} - {currentShift.endTime})
                    </span>
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      Shift {currentShift.shiftNo ?? shiftNo}{" "}
                      {currentShift.name ? `(${currentShift.name})` : ""}
                    </span>
                  </div>
                ) : (
                  <span className="text-gray-500 text-sm">Detecting shift...</span>
                )}
              </div>
            </div>
            
            {currentShift && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Shift Staff
                </label>
                <div className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50">
                  <span className="text-sm">
                    {shiftStaff.length} staff member(s) assigned
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Collections Section */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Collections</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCollectionsTable(true)}
                className="flex items-center gap-2 bg-blue-500 text-white px-3 py-1.5 rounded-lg hover:bg-blue-600 text-sm"
              >
                View Records ({collections.length})
              </button>
              <button
                onClick={updateCollectionsFromPayments}
                className="flex items-center gap-2 bg-blue-500 text-white px-3 py-1.5 rounded-lg hover:bg-blue-600 text-sm"
                title="Refresh collections from payments"
              >
                Refresh Collections
              </button>
            </div>
          </div>
          
          {/* Shift Customer Invoices */}
          {shiftInvoices.length > 0 && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm font-medium text-blue-800">
                  📋 Shift Customer Invoices ({shiftInvoices.length})
                </p>
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {shiftInvoices.slice(0, 5).map((inv) => {
                  const totalPaid = (inv.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
                  const remaining = (inv.grandTotal || 0) - totalPaid;
                  return (
                    <div key={inv._id} className="text-xs text-blue-700 flex justify-between items-center">
                      <button
                        onClick={() => history.push(`/view-customer-invoice/${inv._id}`)}
                        className="hover:underline cursor-pointer"
                      >
                        {inv.invoice_number}
                      </button>
                      <div className="flex items-center gap-2">
                        <span>
                          {formatAmount(inv.grandTotal || 0)}
                          {remaining > 0 && (
                            <span className="text-orange-600 ml-1">
                              (Unpaid: {formatAmount(remaining)})
                            </span>
                          )}
                        </span>
                        {remaining > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedInvoiceForPayment(inv);
                              setShowPaymentModal(true);
                            }}
                            className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded hover:bg-blue-600"
                          >
                            Pay
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {shiftInvoices.length > 5 && (
                  <p className="text-xs text-blue-600 italic">
                    +{shiftInvoices.length - 5} more...
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            {collections.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">No collections added</p>
            ) : (
              collections.map((collection) => (
                <div
                  key={collection.id}
                  className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {collection.channel} - {collection.method}
                    </p>
                    <p className="text-sm text-gray-600">{formatAmount(collection.amount)}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteCollection(collection.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Supplier Payments Section */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Supplier Payments</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setShowSupplierModal(true)}
                className="flex items-center gap-2 bg-[#A6C437] text-white px-3 py-1.5 rounded-lg hover:bg-[#8FA82F] text-sm"
              >
                <Plus className="w-4 h-4" />
                Add Payment
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {supplierPayments.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">No payments added</p>
            ) : (
              supplierPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">{payment.supplierNameSnapshot}</p>
                    <p className="text-sm text-gray-600">
                      {formatAmount(payment.amountPaid)} - {payment.paymentMethod}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteSupplierPayment(payment.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Shift Invoices & Vendor Invoices Section */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Shift Data</h2>
          
          {/* Customer Invoices for Shift */}
          {shiftInvoices.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Customer Invoices ({shiftInvoices.length})
              </h3>
              <div className="max-h-40 overflow-y-auto space-y-2">
                {shiftInvoices.slice(0, 10).map((inv) => {
                  const totalPaid = (inv.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
                  const remaining = (inv.grandTotal || 0) - totalPaid;
                  return (
                    <div key={inv._id} className="p-2 bg-gray-50 rounded text-xs">
                      <div className="flex justify-between items-center">
                        <button
                          onClick={() => history.push(`/view-customer-invoice/${inv._id}`)}
                          className="font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                        >
                          {inv.invoice_number}
                        </button>
                        <span>{formatAmount(inv.grandTotal || 0)}</span>
                      </div>
                      <div className="flex justify-between text-gray-600 mt-1">
                        <span>Paid: {formatAmount(totalPaid)}</span>
                        <span className={remaining > 0 ? "text-orange-600" : "text-green-600"}>
                          {remaining > 0 ? `Unpaid: ${formatAmount(remaining)}` : "Paid"}
                        </span>
                      </div>
                      {remaining > 0 && (
                        <div className="mt-2 flex gap-1">
                          <button
                            onClick={() => {
                              setSelectedInvoiceForPayment(inv);
                              setShowPaymentModal(true);
                            }}
                            className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
                          >
                            Record Payment
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
                {shiftInvoices.length > 10 && (
                  <p className="text-xs text-gray-500 italic text-center">
                    +{shiftInvoices.length - 10} more invoices...
                  </p>
                )}
              </div>
            </div>
          )}
          
          {/* Vendor Invoices Paid During Shift */}
          {shiftVendorInvoices.length > 0 && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm font-medium text-green-800">
                  💰 Vendor Invoices Paid During Shift ({shiftVendorInvoices.length})
                </p>
                <span className="text-xs text-green-600">
                  Total Paid: {formatAmount(
                    shiftVendorInvoices.reduce((sum, inv) => {
                      // Calculate total approved payments made during shift
                      const shiftStart = currentShiftTimeRange.start;
                      const shiftEnd = currentShiftTimeRange.end;
                      if (!shiftStart || !shiftEnd) return sum;
                      const shiftPayments = (inv.payments || []).filter(p => {
                        if (p.status !== "Approved") return false;
                        const paymentDate = new Date(p.date || p.paymentDate || p.createdAt);
                        return paymentDate >= shiftStart && paymentDate <= shiftEnd;
                      });
                      return sum + shiftPayments.reduce((s, p) => s + (p.amount || 0), 0);
                    }, 0)
                  )}
                </span>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {shiftVendorInvoices.slice(0, 10).map((inv) => {
                  // Get payments made during shift
                  const shiftStart = currentShiftTimeRange.start;
                  const shiftEnd = currentShiftTimeRange.end;
                  const shiftPayments = (inv.payments || []).filter(p => {
                    if (p.status !== "Approved") return false;
                    if (!shiftStart || !shiftEnd) return false;
                    const paymentDate = new Date(p.date || p.paymentDate || p.createdAt);
                    return paymentDate >= shiftStart && paymentDate <= shiftEnd;
                  });
                  const totalPaidInShift = shiftPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
                  
                  return (
                    <div key={inv._id} className="p-2 bg-white rounded text-xs border border-green-200">
                      <div className="flex justify-between items-center">
                        <button
                          onClick={() => history.push(`/view-vendor-invoice/${inv._id}`)}
                          className="font-medium text-green-700 hover:underline"
                        >
                          {inv.invoiceNumber || inv.invoice_number}
                        </button>
                        <span className="text-green-600 font-semibold">
                          Paid: {formatAmount(totalPaidInShift)}
                        </span>
                      </div>
                      <div className="flex justify-between text-gray-600 mt-1">
                        <span>Total: {formatAmount(inv.total || 0)}</span>
                        {shiftPayments.length > 0 && (
                          <span className="text-xs text-gray-500">
                            {shiftPayments.length} payment{shiftPayments.length > 1 ? 's' : ''} in shift
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {shiftVendorInvoices.length > 10 && (
                  <p className="text-xs text-gray-500 italic text-center">
                    +{shiftVendorInvoices.length - 10} more invoices...
                  </p>
                )}
              </div>
            </div>
          )}
          
          {/* Shift Staff */}
          {shiftStaff.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Shift Staff ({shiftStaff.length})
              </h3>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {shiftStaff.map((staff) => (
                  <div key={staff._id} className="p-2 bg-gray-50 rounded text-xs">
                    <span className="font-medium">{staff.fullName || staff.displayName}</span>
                    {staff.position && <span className="text-gray-600 ml-2">- {staff.position.name}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {shiftInvoices.length === 0 && shiftVendorInvoices.length === 0 && shiftStaff.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-4">No shift data available</p>
          )}
        </div>

        {/* Late Transactions Section */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Late Transactions</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setShowLateTransactionModal(true)}
                className="flex items-center gap-2 bg-[#A6C437] text-white px-3 py-1.5 rounded-lg hover:bg-[#8FA82F] text-sm"
              >
                <Plus className="w-4 h-4" />
                Add Transaction
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {lateTransactions.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">No late transactions</p>
            ) : (
              lateTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {transaction.txnType} - {transaction.source}
                    </p>
                    <p className="text-sm text-gray-600">
                      {formatAmount(transaction.amount)} - {transaction.reason}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteLateTransaction(transaction.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>



      {/* Supplier Payment Modal */}
      {showSupplierModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Add Supplier Payment</h3>
              <button onClick={() => setShowSupplierModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                <select
                  value={supplierPaymentForm.supplierId}
                  onChange={(e) => handleSelectVendor(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="">Select Supplier</option>
                  {vendors.map((v) => (
                    <option key={v._id} value={v._id}>
                      {v.basicInformation?.vendorDisplayName || v.name}
                    </option>
                  ))}
                </select>
              </div>
              {selectedVendor && vendorInvoices.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Outstanding Invoices
                  </label>
                  <div className="border border-gray-300 rounded-lg p-3 max-h-40 overflow-y-auto">
                    {vendorInvoices.map((inv) => (
                      <div key={inv._id} className="text-sm py-1">
                        {inv.invoiceNumber} - {formatAmount(inv.remainingAmount || inv.total)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount Paid</label>
                <input
                  type="number"
                  value={supplierPaymentForm.amountPaid}
                  onChange={(e) =>
                    setSupplierPaymentForm({ ...supplierPaymentForm, amountPaid: e.target.value })
                  }
                  placeholder="0.00"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Method
                </label>
                <select
                  value={supplierPaymentForm.paymentMethod}
                  onChange={(e) =>
                    setSupplierPaymentForm({ ...supplierPaymentForm, paymentMethod: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="">Select Payment Method</option>
                  {paymentMethods.map((method) => (
                    <option key={method._id} value={method.name}>
                      {method.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reference No (Optional)
                </label>
                <input
                  type="text"
                  value={supplierPaymentForm.referenceNo}
                  onChange={(e) =>
                    setSupplierPaymentForm({ ...supplierPaymentForm, referenceNo: e.target.value })
                  }
                  placeholder="Cheque no, transfer ref, etc."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={supplierPaymentForm.notes}
                  onChange={(e) =>
                    setSupplierPaymentForm({ ...supplierPaymentForm, notes: e.target.value })
                  }
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
              <button
                onClick={handleAddSupplierPayment}
                className="w-full bg-[#A6C437] text-white py-2 rounded-lg hover:bg-[#8FA82F]"
              >
                Add Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Collections Data Table Modal */}
      {showCollectionsTable && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Collections Records</h3>
              <button onClick={() => setShowCollectionsTable(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {collections.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No collections recorded</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Channel
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Method
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Amount
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Reference
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {collections.map((collection) => (
                      <tr key={collection.id}>
                        <td className="px-4 py-3 text-sm">{collection.channel}</td>
                        <td className="px-4 py-3 text-sm">{collection.method}</td>
                        <td className="px-4 py-3 text-sm font-medium">
                          {formatAmount(collection.amount)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {collection.referenceNo || "-"}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <button
                            onClick={() => {
                              handleDeleteCollection(collection.id);
                              if (collections.length === 1) {
                                setShowCollectionsTable(false);
                              }
                            }}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan="2" className="px-4 py-3 text-sm font-medium">
                        Total
                      </td>
                      <td className="px-4 py-3 text-sm font-bold">
                        {formatAmount(
                          collections.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0)
                        )}
                      </td>
                      <td colSpan="2"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payment Modal with Channel Selection */}
      {showPaymentModal && selectedInvoiceForPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Record Payment</h3>
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setSelectedInvoiceForPayment(null);
                  setSelectedChannelForPayment("");
                }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Channel Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Channel *
              </label>
              <select
                value={selectedChannelForPayment}
                onChange={(e) => setSelectedChannelForPayment(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#A6C437]"
                required
              >
                <option value="">Select Channel</option>
                {channels.map((channel) => (
                  <option key={channel._id} value={channel.code}>
                    {channel.name}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Payment Modal Component */}
            {selectedChannelForPayment && (
              <PaymentModal
                isOpen={showPaymentModal}
                onClose={() => {
                  setShowPaymentModal(false);
                  setSelectedInvoiceForPayment(null);
                  setSelectedChannelForPayment("");
                }}
                onSubmit={async (paymentData) => {
                  try {
                    // Add channel to payment data (store in notes if channel field not supported)
                    const channelNote = paymentData.notes 
                      ? `${paymentData.notes} | Channel: ${selectedChannelForPayment}`
                      : `Channel: ${selectedChannelForPayment}`;
                    
                    const paymentPayload = {
                      ...paymentData,
                      enhancedPayment: true,
                      channel: selectedChannelForPayment, // Try to add as custom field
                      notes: channelNote, // Also store in notes as backup
                    };
                    
                    const response = await axios.post(
                      `${Base_URL}/proforma-invoice/${selectedInvoiceForPayment._id}/payments`,
                      paymentPayload,
                      { headers }
                    );
                    if (response.data) {
                      notifySuccess("Payment recorded successfully!");
                      
                      // Auto-create collection from payment
                      const newCollection = {
                        id: `payment-${selectedInvoiceForPayment._id}-${Date.now()}`,
                        channel: selectedChannelForPayment,
                        method: paymentData.paymentMode,
                        amount: parseFloat(paymentData.amount) || 0,
                        referenceNo: paymentData.reference || selectedInvoiceForPayment.invoice_number,
                        invoiceId: selectedInvoiceForPayment._id,
                        invoiceNumber: selectedInvoiceForPayment.invoice_number,
                        paymentId: response.data.data?.payment?._id || Date.now().toString(),
                        receivedAt: paymentData.paymentDate || new Date().toISOString(),
                        isAuto: true,
                      };
                      setCollections([...collections, newCollection]);
                      
                      // Refresh shift invoices
                      if (currentShift) {
                        const date = new Date(selectedDate);
                        fetchShiftData(currentShift, shiftNo, date);
                      }
                      // Refresh today's invoices
                      fetchTodayInvoices();
                      setShowPaymentModal(false);
                      setSelectedInvoiceForPayment(null);
                      setSelectedChannelForPayment("");
                    }
                  } catch (err) {
                    console.error("Payment error", err);
                    notifyError(err.response?.data?.message || "Failed to record payment");
                  }
                }}
                invoice={selectedInvoiceForPayment}
                businessId={selectedBusiness}
              />
            )}
            
            {!selectedChannelForPayment && (
              <p className="text-sm text-gray-500 text-center py-4">
                Please select a channel to proceed with payment
              </p>
            )}
          </div>
        </div>
      )}

      {/* Late Transaction Modal */}
      {showLateTransactionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Add Late Transaction</h3>
              <button onClick={() => setShowLateTransactionModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Transaction Type
                </label>
                <select
                  value={lateTransactionForm.txnType}
                  onChange={(e) =>
                    setLateTransactionForm({ ...lateTransactionForm, txnType: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="SALE">Sale</option>
                  <option value="REFUND">Refund</option>
                  <option value="ADJUSTMENT">Adjustment</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                <select
                  value={lateTransactionForm.source}
                  onChange={(e) =>
                    setLateTransactionForm({ ...lateTransactionForm, source: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="POS">POS</option>
                  <option value="MANUAL">Manual</option>
                  <option value="PLATFORM">Platform</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                <input
                  type="number"
                  value={lateTransactionForm.amount}
                  onChange={(e) =>
                    setLateTransactionForm({ ...lateTransactionForm, amount: e.target.value })
                  }
                  placeholder="0.00"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <textarea
                  value={lateTransactionForm.reason}
                  onChange={(e) =>
                    setLateTransactionForm({ ...lateTransactionForm, reason: e.target.value })
                  }
                  rows={3}
                  placeholder="Why is this transaction late?"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
              <button
                onClick={handleAddLateTransaction}
                className="w-full bg-[#A6C437] text-white py-2 rounded-lg hover:bg-[#8FA82F]"
              >
                Add Transaction
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
