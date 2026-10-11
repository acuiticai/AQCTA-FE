import React, { useState, useEffect } from "react";
import { Plus, Search, Filter, Download } from "lucide-react";
import { toast } from "react-hot-toast";
import axios from "axios";
import PaymentForm from "./components/PaymentForm";
import PaymentDetailsModal from "./components/PaymentDetailsModal";
import { formatDate, formatAmount, formatCurrencyAmount } from "@/components/formatAmount";

const CustomerPayments = () => {
  const [payments, setPayments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [filters, setFilters] = useState({
    business: "",
    customer: "",
    dateRange: {
      start: "",
      end: "",
    },
    paymentMode: "",
    currency: "",
  });

  useEffect(() => {
    fetchPayments();
    fetchCustomers();
    fetchBanks();
  }, []);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const response = await axios.get("/api/customer-payments");
      setPayments(response.data);
    } catch (error) {
      toast.error("Failed to fetch payments");
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await axios.get("/api/customers");
      setCustomers(response.data);
    } catch (error) {
      toast.error("Failed to fetch customers");
    }
  };

  const fetchBanks = async () => {
    try {
      const response = await axios.get("/api/banks");
      setBanks(response.data);
    } catch (error) {
      toast.error("Failed to fetch banks");
    }
  };

  const handleAddPayment = async (formData) => {
    try {
      await axios.post("/api/customer-payments", formData);
      toast.success("Payment added successfully");
      fetchPayments();
    } catch (error) {
      toast.error("Failed to add payment");
    }
  };

  const handleUpdatePayment = async (formData) => {
    try {
      await axios.put(
        `/api/customer-payments/${selectedPayment._id}`,
        formData
      );
      toast.success("Payment updated successfully");
      fetchPayments();
    } catch (error) {
      toast.error("Failed to update payment");
    }
  };

  const handleDeletePayment = async (paymentId) => {
    if (window.confirm("Are you sure you want to delete this payment?")) {
      try {
        await axios.delete(`/api/customer-payments/${paymentId}`);
        toast.success("Payment deleted successfully");
        fetchPayments();
      } catch (error) {
        toast.error("Failed to delete payment");
      }
    }
  };

  const handleExport = () => {
    // Implement export functionality
    toast.success("Export functionality coming soon");
  };

  const filteredPayments = payments.filter((payment) => {
    const matchesBusiness =
      !filters.business || payment.business_id === filters.business;
    const matchesCustomer =
      !filters.customer || payment.customer_id === filters.customer;
    const matchesPaymentMode =
      !filters.paymentMode || payment.paymentMode === filters.paymentMode;
    const matchesCurrency =
      !filters.currency || payment.currency === filters.currency;

    const paymentDate = new Date(payment.paymentDate);
    const startDate = filters.dateRange.start
      ? new Date(filters.dateRange.start)
      : null;
    const endDate = filters.dateRange.end
      ? new Date(filters.dateRange.end)
      : null;

    const matchesDateRange =
      (!startDate || paymentDate >= startDate) &&
      (!endDate || paymentDate <= endDate);

    return (
      matchesBusiness &&
      matchesCustomer &&
      matchesPaymentMode &&
      matchesCurrency &&
      matchesDateRange
    );
  });

  return (
    <div className="container mx-auto px-4 py-8 max-h-[90vh] overflow-y-auto pb-[120px]">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Customer Payments</h1>
        <div className="flex space-x-4">
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center px-4 py-2 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[#7fa02a] focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
          >
            <Plus size={20} className="mr-2" />
            Add Payment
          </button>
          <button
            onClick={handleExport}
            className="flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
          >
            <Download size={20} className="mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Business
            </label>
            <select
              value={filters.business}
              onChange={(e) =>
                setFilters({ ...filters, business: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
            >
              <option value="">All Businesses</option>
              {/* Add business options */}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Customer
            </label>
            <select
              value={filters.customer}
              onChange={(e) =>
                setFilters({ ...filters, customer: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
            >
              <option value="">All Customers</option>
              {customers.map((customer) => (
                <option key={customer._id} value={customer._id}>
                  {customer.basicInformation.customerDisplayName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Mode
            </label>
            <select
              value={filters.paymentMode}
              onChange={(e) =>
                setFilters({ ...filters, paymentMode: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
            >
              <option value="">All Modes</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Money Changer">Money Changer</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Currency
            </label>
            <select
              value={filters.currency}
              onChange={(e) =>
                setFilters({ ...filters, currency: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
            >
              <option value="">All Currencies</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="AED">AED</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={filters.dateRange.start}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  dateRange: { ...filters.dateRange, start: e.target.value },
                })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={filters.dateRange.end}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  dateRange: { ...filters.dateRange, end: e.target.value },
                })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
            />
          </div>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invoice Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment Mode
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td
                    colSpan="7"
                    className="px-6 py-4 text-center text-gray-500"
                  >
                    Loading...
                  </td>
                </tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td
                    colSpan="7"
                    className="px-6 py-4 text-center text-gray-500"
                  >
                    No payments found
                  </td>
                </tr>
              ) : (
                filteredPayments.map((payment) => (
                  <tr key={payment._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {payment.invoice_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {
                        payment.customer_id?.basicInformation
                          ?.customerDisplayName
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(payment.paymentDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrencyAmount(payment.currency, payment.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {payment.paymentMode}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          payment.status === "Completed"
                            ? "bg-green-100 text-green-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {payment.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => {
                          setSelectedPayment(payment);
                          setShowDetails(true);
                        }}
                        className="text-[var(--p-blue)] hover:text-[#7fa02a] mr-4"
                      >
                        View
                      </button>
                      <button
                        onClick={() => {
                          setSelectedPayment(payment);
                          setShowForm(true);
                        }}
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeletePayment(payment._id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {showForm && (
        <PaymentForm
          payment={selectedPayment}
          onClose={() => {
            setShowForm(false);
            setSelectedPayment(null);
          }}
          onSubmit={selectedPayment ? handleUpdatePayment : handleAddPayment}
          customers={customers}
          banks={banks}
        />
      )}

      {showDetails && selectedPayment && (
        <PaymentDetailsModal
          payment={selectedPayment}
          onClose={() => {
            setShowDetails(false);
            setSelectedPayment(null);
          }}
        />
      )}
    </div>
  );
};

export default CustomerPayments;
