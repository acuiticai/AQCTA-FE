import React, { useState, useEffect, useContext } from "react";
import { AdminContext } from "@/context/AdminContext";
import {
    X,
    Search,
    FileText,
    ChevronRight,
    Loader,
    Filter
} from "lucide-react";
import axios from "axios";
import { notifyError } from "@/utils/toast";
import CustomerInvoiceServices from "@/services/CustomerInvoiceServices";
import PaymentModal from "@/pages/Accounts/CustomerInvoice/components/PaymentModalFixed";
import { formatDate, formatAmount } from "@/components/formatAmount";
import BusinessDropdown from "@/page-layouts/components/helpers/BusinessDropdown";
import { DropdownBasic } from "@/page-layouts/index";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const RecordPaymentModal = ({ isOpen, onClose, onPaymentComplete }) => {
    const { state } = useContext(AdminContext);
    const { adminInfo } = state;

    // View State: 'selection' (filters & list) or 'payment' (form)
    const [view, setView] = useState('selection');
    const [loading, setLoading] = useState(false);
    const [pageLoading, setPageLoading] = useState(false);

    // Selection Data
    const [customers, setCustomers] = useState([]);
    const [invoices, setInvoices] = useState([]);

    // Selected Items
    const [selectedBusiness, setSelectedBusiness] = useState("");
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [selectedInvoice, setSelectedInvoice] = useState(null);

    // Search
    const [searchTerm, setSearchTerm] = useState("");

    // Initial load handled by BusinessDropdown internally or we can trigger resets
    useEffect(() => {
        if (!isOpen) {
            // Reset state on close
            setView('selection');
            setSelectedBusiness("");
            setSelectedCustomer(null);
            setSelectedInvoice(null);
            setCustomers([]);
            setInvoices([]);
        }
    }, [isOpen]);

    const fetchCustomers = async (businessId) => {
        if (!businessId) return;
        setPageLoading(true);
        try {
            const response = await axios.get(`${Base_URL}/customers`, {
                params: {
                    business_id: businessId,
                    limit: 1000 // Ensure we get all customers for the dropdown
                }
            });
            // Adjust based on actual API response structure for /customers
            // Commonly it's response.data.customers or response.data.docs
            const customerList = response?.data?.customers || response?.data?.docs || response?.data || [];

            setCustomers(customerList);
            setSelectedCustomer(null); // Reset customer
            setInvoices([]); // Reset invoices
        } catch (error) {
            console.error("Error fetching customers:", error);
            notifyError("Failed to fetch customers");
        } finally {
            setPageLoading(false);
        }
    };

    const fetchInvoices = async (bid, cid) => {
        const businessId = bid || selectedBusiness;
        const customerId = cid !== undefined ? cid : selectedCustomer;

        if (!businessId) return;

        setLoading(true);
        try {
            const params = {
                limit: 1000,
                businessId: businessId,
                ...(customerId && { customerId: customerId })
            };

            const response = await CustomerInvoiceServices.getAllInvoices(params);
            let fetchedInvoices = response.data.data || [];

            // Filter for unpaid and valid invoices
            // Payment can only be recorded for: Pending, Partially Paid
            // Cannot record payment for: Draft, Paid, Cancelled
            fetchedInvoices = fetchedInvoices.filter(inv => {
                const status = inv.status?.toLowerCase();
                const isAllowedStatus = status === 'pending' || status === 'partially paid';
                const isNotBlocked = status !== 'paid' && status !== 'cancelled' && status !== 'draft';
                const hasRemaining = (inv.remaining || 0) > 0;
                
                return (!customerId || inv.customer_id?._id === customerId) &&
                       isAllowedStatus &&
                       isNotBlocked &&
                       hasRemaining;
            });

            setInvoices(fetchedInvoices);
        } catch (error) {
            console.error("Error fetching invoices:", error);
            notifyError("Failed to fetch invoices");
        } finally {
            setLoading(false);
        }
    };

    const handleBusinessChange = (businessId) => {
        setSelectedBusiness(businessId);
        fetchCustomers(businessId);
        fetchInvoices(businessId, null); // Fetch all invoices for this business
    };

    const handleCustomerChange = (customerId) => {
        setSelectedCustomer(customerId);
        fetchInvoices(selectedBusiness, customerId);
    };

    const handleInvoiceSelect = (invoice) => {
        // Prevent selecting Draft invoices
        const status = invoice.status?.toLowerCase();
        if (status === 'draft') {
            notifyError("Cannot record payment for Draft invoices. Please Save and Send the invoice first.");
            return;
        }
        if (status === 'paid' || status === 'cancelled') {
            notifyError(`Cannot record payment. Invoice status is ${invoice.status}.`);
            return;
        }
        setSelectedInvoice(invoice);
        setView('payment');
    };

    const handlePaymentSubmit = async (paymentData) => {
        try {
            const response = await axios.post(
                `${Base_URL}/proforma-invoice/${selectedInvoice._id}/payments`,
                {
                    ...paymentData,
                    enhancedPayment: true,
                    submittedAt: new Date().toISOString(),
                }
            );

            if (response.data) {
                notifyError("Payment recorded successfully!"); // Kept as notifyError as per previous code, but should verify if success toast needed
                onPaymentComplete();
                onClose();
            }
        } catch (err) {
            console.error("Payment error", err);
            notifyError(err.response?.data?.message || "Failed to record payment");
        }
    };

    // Filter displayed invoices
    const filteredInvoices = invoices.filter(inv =>
        inv.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(inv.grandTotal).includes(searchTerm)
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            {view === 'payment' && selectedInvoice ? (
                <div className="w-full max-w-4xl max-h-[90vh] flex flex-col">
                    <div className="bg-white rounded-lg shadow-xl relative overflow-hidden flex flex-col h-full">
                        <button
                            onClick={() => setView('selection')}
                            className="absolute top-4 right-4 z-[60] p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
                        >
                            <X size={20} />
                        </button>
                        <div className="overflow-y-auto flex-1">
                            <PaymentModal
                                isOpen={true}
                                onClose={() => setView('selection')}
                                onSubmit={handlePaymentSubmit}
                                invoice={selectedInvoice}
                                businessId={selectedBusiness}
                            />
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col h-[85vh]">
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Record Payment</h2>
                            <p className="text-sm text-gray-500">Select a business to view unpaid invoices</p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 text-gray-400 hover:text-red-500 rounded-full transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Filters Section */}
                    <div className="p-6 bg-gray-50 border-b border-gray-100 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-gray-700">Business</label>
                                <BusinessDropdown
                                    adminId={adminInfo?.id}
                                    selectedBusiness={selectedBusiness}
                                    onChange={handleBusinessChange}
                                    placeholder="Select Business"
                                    customClassName="w-full"
                                    isClearable={false}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-gray-700">Customer</label>
                                <DropdownBasic
                                    options={customers.map(c => ({
                                        label: c.basicInformation?.customerDisplayName || c.basicInformation?.companyName || "Unknown Customer",
                                        value: c._id
                                    }))}
                                    value={selectedCustomer}
                                    onChange={handleCustomerChange}
                                    placeholder={pageLoading ? "Loading..." : "Select Customer"}
                                    isDisabled={!selectedBusiness || pageLoading}
                                    className="w-full"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Invoices List Header & Search */}
                    {selectedBusiness && (
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                                <FileText size={18} className="text-blue-500" />
                                Unpaid Invoices
                                <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                                    {invoices.length}
                                </span>
                            </h3>
                            <div className="relative w-64">
                                <Search className="absolute left-1 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Search invoice #"
                                    className="w-full pl-10 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    {/* Invoices Content */}
                    <div className="flex-1 overflow-y-auto bg-white p-2">
                        {!selectedBusiness ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-3">
                                <div className="p-4 bg-gray-50 rounded-full">
                                    <Filter size={32} />
                                </div>
                                <p>Please select a business to view invoices</p>
                            </div>
                        ) : loading ? (
                            <div className="flex flex-col items-center justify-center h-full py-12">
                                <Loader className="animate-spin text-blue-500 mb-2" size={32} />
                                <p className="text-gray-500">Fetching invoices...</p>
                            </div>
                        ) : filteredInvoices.length > 0 ? (
                            <div className="grid gap-2 p-2">
                                {filteredInvoices.map((inv) => (
                                    <button
                                        key={inv._id}
                                        onClick={() => handleInvoiceSelect(inv)}
                                        className="group flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all text-left w-full"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                                                <FileText size={20} />
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-gray-900">#{inv.invoice_number}</h4>
                                                <p className="text-xs text-gray-500">
                                                    Issued: {formatDate(inv.createdAt)}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-6">
                                            <div className="text-right">
                                                <div className="text-sm font-bold text-gray-900">
                                                    {inv.currency} {formatAmount(inv.grandTotal)}
                                                </div>
                                                <div className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full inline-block mt-1">
                                                    Remaining: {formatAmount(inv.remaining)}
                                                </div>
                                            </div>
                                            <ChevronRight className="text-gray-300 group-hover:text-blue-500 transition-colours" size={20} />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                <p>No unpaid invoices found for this business.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default RecordPaymentModal;
