import React, { useState, useContext, useEffect, useRef } from "react";
import { AdminContext } from "@/context/AdminContext";
import { formatDate, formatAmount } from "@/components/formatAmount";
import { PageHeader, DataTable } from "@/page-layouts/index";
import CustomerInvoiceServices from "@/services/CustomerInvoiceServices";
import RecordPaymentModal from "./components/RecordPaymentModal";
import { FileText, CheckCircle, Clock } from "lucide-react";
import SummarySvg from "@/assets/img/summary.svg";
import CompletedSvg from "@/assets/img/completed.svg";
import PendingApprovalSvg from "@/assets/img/pending-approval.svg";

const Payments = () => {
    const { state } = useContext(AdminContext);
    const { adminInfo } = state;
    const [selectedBusiness, setSelectedBusiness] = useState();
    const [payments, setPayments] = useState([]);
    const [allPayments, setAllPayments] = useState([]); // Store all fetched payments for client-side filtering
    const [totalResults, setTotalResults] = useState(0);
    const [recordsPerPage, setRecordsPerPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const currentPageRef = useRef(1);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [loading, setLoading] = useState(false);

    // Modal State
    const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);

    // Stats State
    const [stats, setStats] = useState({
        total: 0,
        paid: 0,
        pending: 0
    });

    // Fetch invoices and extract payments
    const fetchPayments = async () => {
        setLoading(true);
        try {
            // Fetch invoices
            const params = {
                limit: 1000,
                business_id: selectedBusiness || "",
            };

            const response = await CustomerInvoiceServices.getAllInvoices(params);
            const invoices = response.data.data || [];

            // Calculate Stats based on INVOICES (as per requirement: "Total Invoices", "Paid Invoices", "Pending Invoices")
            // Requirement says "Total invoices related to payments", but usually user wants overview of Invoices on this screen or Payments?
            // "Total number of invoices related to payments" -> This implies count of invoices that HAVE payments? 
            // OR just general invoice stats? The request says "Total Invoices", "Paid Invoices", "Pending Invoices"
            // Let's calculate based on ALL invoices fetched, as that gives the financial insight.

            const totalInvoicesCount = invoices.length;
            const paidInvoicesCount = invoices.filter(inv => inv.status === 'Paid').length;
            const pendingInvoicesCount = invoices.filter(inv => inv.status !== 'Paid' && inv.status !== 'Cancelled').length;

            setStats({
                total: totalInvoicesCount,
                paid: paidInvoicesCount,
                pending: pendingInvoicesCount
            });

            // Extract payments
            const extractedPayments = invoices.reduce((acc, invoice) => {
                if (invoice.payments && invoice.payments.length > 0) {
                    const invPayments = invoice.payments.map(payment => ({
                        ...payment,
                        _id: payment._id || `${invoice._id}-${payment.date || Date.now()}`,
                        invoice_number: invoice.invoice_number,
                        customer_name: invoice.customer_name || invoice.customer_id?.basicInformation?.customerDisplayName,
                        invoice_id: invoice._id,
                        payment_date: payment.date,
                        payment_method: payment.mode || payment.paymentMode || "Unknown",
                        amount_paid: payment.amount,
                        currency: invoice.currency || 'USD', // Include currency
                        status: invoice.status || "" // Show invoice status as requested (e.g. Partially Paid)
                    }));
                    return [...acc, ...invPayments];
                }
                return acc;
            }, []);

            // Sort by date descending
            extractedPayments.sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date));

            setAllPayments(extractedPayments);
            filterAndPaginate(extractedPayments, currentPage, recordsPerPage, searchTerm, statusFilter);
        } catch (error) {
            console.error("Error fetching payments:", error);
            setPayments([]);
            setTotalResults(0);
        } finally {
            setLoading(false);
        }
    };

    const filterAndPaginate = (data, page, limit, search, status) => {
        let filteredData = data;

        if (search) {
            const lowerSearch = search.toLowerCase();
            filteredData = filteredData.filter(
                (item) =>
                    (item.invoice_number && item.invoice_number.toLowerCase().includes(lowerSearch)) ||
                    (item.customer_name && item.customer_name.toLowerCase().includes(lowerSearch))
            );
        }

        if (status) {
            filteredData = filteredData.filter((item) => item.status === status);
        }

        setTotalResults(filteredData.length);

        // Client-side pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedData = filteredData.slice(startIndex, endIndex);

        setPayments(paginatedData);
    };

    useEffect(() => {
        fetchPayments();
    }, [selectedBusiness]);

    const handlePageChange = (page) => {
        setCurrentPage(page);
        currentPageRef.current = page;
        filterAndPaginate(allPayments, page, recordsPerPage, searchTerm, statusFilter);
    };

    const onChange = async (value) => {
        setSelectedBusiness(value);
    };

    const handleSearch = (e) => {
        const value = e.target.value;
        setSearchTerm(value);
        setCurrentPage(1);
        currentPageRef.current = 1;
        filterAndPaginate(allPayments, 1, recordsPerPage, value, statusFilter);
    };

    return (
        <div className="p-6">
            <PageHeader
                title="Payment Received"
                showAddButton={true}
                addButtonText="Record Payment"
                onAddNew={() => setShowRecordPaymentModal(true)}
            />

            {/* Premium Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 mt-6">
                {/* Total Invoices Card */}
                <div className="relative overflow-hidden bg-white rounded-2xl shadow-sm border border-gray-100 p-6 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 group">
                    <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-blue-50 to-transparent opacity-50"></div>
                    <div className="relative z-10 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">Total Invoices</p>
                            <h3 className="text-3xl font-bold text-gray-800 tracking-tight">{stats.total}</h3>
                            <p className="text-xs text-blue-500 font-medium mt-2 flex items-center bg-blue-50 w-fit px-2 py-1 rounded-full">
                                <FileText size={12} className="mr-1" /> All time
                            </p>
                        </div>
                        <div className="p-4 bg-blue-100 text-blue-600 rounded-2xl shadow-inner group-hover:scale-110 transition-transform duration-300">
                            <FileText size={32} strokeWidth={1.5} />
                        </div>
                    </div>
                    {/* Decorative background icon */}
                    <FileText className="absolute -bottom-4 -right-4 text-blue-50 w-32 h-32 -rotate-12 transition-transform duration-500 group-hover:rotate-0" strokeWidth={0.5} />
                </div>

                {/* Paid Invoices Card */}
                <div className="relative overflow-hidden bg-white rounded-2xl shadow-sm border border-gray-100 p-6 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 group">
                    <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-green-50 to-transparent opacity-50"></div>
                    <div className="relative z-10 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">Paid Invoices</p>
                            <h3 className="text-3xl font-bold text-gray-800 tracking-tight">{stats.paid}</h3>
                            <p className="text-xs text-green-500 font-medium mt-2 flex items-center bg-green-50 w-fit px-2 py-1 rounded-full">
                                <CheckCircle size={12} className="mr-1" /> Fully Paid
                            </p>
                        </div>
                        <div className="p-4 bg-green-100 text-green-600 rounded-2xl shadow-inner group-hover:scale-110 transition-transform duration-300">
                            <CheckCircle size={32} strokeWidth={1.5} />
                        </div>
                    </div>
                    {/* Decorative background icon */}
                    <CheckCircle className="absolute -bottom-4 -right-4 text-green-50 w-32 h-32 -rotate-12 transition-transform duration-500 group-hover:rotate-0" strokeWidth={0.5} />
                </div>

                {/* Pending Invoices Card */}
                <div className="relative overflow-hidden bg-white rounded-2xl shadow-sm border border-gray-100 p-6 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 group">
                    <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-orange-50 to-transparent opacity-50"></div>
                    <div className="relative z-10 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">Pending Invoices</p>
                            <h3 className="text-3xl font-bold text-gray-800 tracking-tight">{stats.pending}</h3>
                            <p className="text-xs text-orange-500 font-medium mt-2 flex items-center bg-orange-50 w-fit px-2 py-1 rounded-full">
                                <Clock size={12} className="mr-1" /> Unpaid / Partial
                            </p>
                        </div>
                        <div className="p-4 bg-orange-100 text-orange-600 rounded-2xl shadow-inner group-hover:scale-110 transition-transform duration-300">
                            <Clock size={32} strokeWidth={1.5} />
                        </div>
                    </div>
                    {/* Decorative background icon */}
                    <Clock className="absolute -bottom-4 -right-4 text-orange-50 w-32 h-32 -rotate-12 transition-transform duration-500 group-hover:rotate-0" strokeWidth={0.5} />
                </div>
            </div>

            <div className="bg-gray-50 rounded-lg">
                <DataTable
                    headers={[
                        "Invoice No",
                        "Customer Name",
                        "Payment Date",
                        "Payment Method",
                        "Amount Paid",
                        "Status",
                    ]}
                    data={payments}
                    loading={loading}
                    currentPage={currentPage}
                    totalPages={Math.ceil(totalResults / recordsPerPage)}
                    recordsPerPage={recordsPerPage}
                    onPageChange={handlePageChange}
                    onRecordsPerPageChange={(value) => {
                        setRecordsPerPage(value);
                        setCurrentPage(1);
                        currentPageRef.current = 1;
                        filterAndPaginate(allPayments, 1, value, searchTerm, statusFilter);
                    }}
                    renderRow={(payment) => (
                        <tr className="border-b border-gray-200" key={payment._id}>
                            <td className="py-4 font-medium text-gray-900">{payment.invoice_number}</td>
                            <td className="py-4">{payment.customer_name}</td>
                            <td className="py-4">{formatDate(payment.paymentDate)}</td>
                            <td className="py-4">{payment.payment_method}</td>
                            <td className="py-4 font-medium">
                                {payment.currency} {formatAmount(payment.amount_paid)}
                            </td>
                            <td className="py-4">
                                <span
                                    className={`px-2 py-1 text-xs font-semibold leading-tight rounded-full ${payment.status === "Paid" ? "text-green-700 bg-green-100" :
                                        payment.status === "Partially Paid" ? "text-yellow-700 bg-yellow-100" :
                                            payment.status === "Draft" ? "text-gray-700 bg-gray-100" :
                                                "text-blue-700 bg-blue-100"
                                        }`}
                                >
                                    {payment.status}
                                </span>
                            </td>
                        </tr>
                    )}
                    emptyMessage="No payments found"
                    filters={[
                        {
                            isBusinessDropdown: true,
                            businessDropdownProps: {
                                adminId: adminInfo?.id,
                                selectedBusiness: selectedBusiness,
                                onChange: onChange,
                            },
                        },
                    ]}
                    searchValue={searchTerm}
                    onSearch={handleSearch}
                    searchPlaceholder="Search Invoice or Customer"
                />
            </div>

            {/* Record Payment Modal */}
            <RecordPaymentModal
                isOpen={showRecordPaymentModal}
                onClose={() => setShowRecordPaymentModal(false)}
                onPaymentComplete={fetchPayments}
            />
        </div>
    );
};

export default Payments;
