import { useState, useEffect, useContext } from "react";
import { Plus, Search, ShoppingCart } from "lucide-react";
import axios from "axios";
import { AdminContext } from "@/context/AdminContext";
import { formatAmount, formatDate } from "@/components/formatAmount";
import { useHistory } from "react-router-dom";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

export default function SupplierPaymentsList() {
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const history = useHistory();

  const [selectedBusiness, setSelectedBusiness] = useState("");
  const [businesses, setBusinesses] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo?.token}`,
  };

  useEffect(() => {
    const storedBusinesses = localStorage.getItem("businesses");
    if (storedBusinesses) {
      const parsed = JSON.parse(storedBusinesses);
      setBusinesses(parsed);

      // Multi-tenant rule: auto-select only when exactly one business
      if (parsed.length === 1) {
        setSelectedBusiness(parsed[0]._id);
      }
    }
  }, []);

  useEffect(() => {
    if (businesses.length > 0) {
      fetchPayments();
    }
  }, [selectedBusiness, dateFilter, businesses.length]);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      // TODO: Replace with actual API endpoint
      setPayments([]);
    } catch (error) {
      console.error("Error fetching payments:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPayments = payments.filter((payment) => {
    const matchesSearch = !searchTerm || 
      payment.supplierNameSnapshot?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Supplier Payments</h1>
          <button
            onClick={() => history.push("/daily-reports")}
            className="flex items-center gap-2 bg-[#A6C437] text-white px-4 py-2 rounded-lg hover:bg-[#8FA82F]"
          >
            <Plus className="w-4 h-4" />
            New Daily Report
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Business</label>
            <select
              value={selectedBusiness}
              onChange={(e) => setSelectedBusiness(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">Select Business</option>
              {businesses.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by supplier..."
                className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6">
        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : filteredPayments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No payments found. Create a daily report to add supplier payments.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Supplier
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Method
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Reference
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPayments.map((payment) => (
                  <tr key={payment._id}>
                    <td className="px-4 py-3">{formatDate(payment.paidAt)}</td>
                    <td className="px-4 py-3">{payment.supplierNameSnapshot}</td>
                    <td className="px-4 py-3 font-medium">{formatAmount(payment.amountPaid)}</td>
                    <td className="px-4 py-3">{payment.paymentMethod}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {payment.referenceNo || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
