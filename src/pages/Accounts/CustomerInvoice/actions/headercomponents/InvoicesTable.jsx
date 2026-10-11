import React from "react";
import { FiPlus } from "react-icons/fi";

const invoices = [
  {
    date: "03-12-2024",
    invoiceNumber: "2611321",
    contracts: "2611321",
    creditNotes: "2316514",
    amount: "USD 1651.00",
    balanceDue: "USD 1000.00",
    status: "Draft",
  },
  {
    date: "03-12-2024",
    invoiceNumber: "2611321",
    contracts: "2611321",
    creditNotes: "2316514",
    amount: "USD 1651.00",
    balanceDue: "USD 1000.00",
    status: "Partially Paid",
  },
  {
    date: "03-12-2024",
    invoiceNumber: "2611321",
    contracts: "2611321",
    creditNotes: "2316514",
    amount: "USD 1651.00",
    balanceDue: "USD 1000.00",
    status: "Void",
  },
  {
    date: "03-12-2024",
    invoiceNumber: "2611321",
    contracts: "2611321",
    creditNotes: "2316514",
    amount: "USD 1651.00",
    balanceDue: "USD 1000.00",
    status: "Open",
  },
  {
    date: "03-12-2024",
    invoiceNumber: "2611321",
    contracts: "2611321",
    creditNotes: "2316514",
    amount: "USD 1651.00",
    balanceDue: "USD 1000.00",
    status: "Overdue",
  },
  {
    date: "03-12-2024",
    invoiceNumber: "2611321",
    contracts: "2611321",
    creditNotes: "2316514",
    amount: "USD 1651.00",
    balanceDue: "USD 1000.00",
    status: "Pending Approval",
  },
];

const getStatusColor = (status) => {
  switch (status) {
    case "Draft":
      return "text-gray-500";
    case "Partially Paid":
      return "text-green-500";
    case "Void":
      return "text-gray-400";
    case "Open":
      return "text-gray-700";
    case "Overdue":
      return "text-yellow-600";
    case "Pending Approval":
      return "text-orange-500";
    default:
      return "text-gray-600";
  }
};

const InvoicesTable = () => {
  return (
    <div className="bg-[#F9F9FA] p-6 rounded-xl shadow-sm mt-6 border font-sans text-[#303030] font-normal">
      {/* ✅ Top Section */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Invoices</h2>
        <div className="flex space-x-3">
          {/* ✅ Filter Dropdown */}
          <select className="border px-4 py-2 rounded-xl text-sm bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]">
            <option>Filter By: All</option>
          </select>

          {/* ✅ Add New Button */}
          <button className="flex items-center bg-[#F2F2F2] text-black text-sm font-medium px-4 py-2 rounded-xl shadow-sm hover:bg-gray-200 transition">
            Add New
            <span className="ml-2 flex items-center justify-center w-6 h-6 bg-[var(--p-blue)] text-white rounded-full">
              <FiPlus size={14} />
            </span>
          </button>
        </div>
      </div>

      {/* ✅ Table */}
      <div className="overflow-x-auto">
        <table className="w-full border rounded-lg text-sm">
          {/* ✅ Table Header */}
          <thead>
            <tr className="bg-[#F2F2F2] text-left">
              <th className="p-3 font-normal">Date</th>
              <th className="p-3 font-normal">Invoice Number</th>
              <th className="p-3 font-normal">Contracts</th>
              <th className="p-3 font-normal">Credit Notes</th>
              <th className="p-3 font-normal">Amount</th>
              <th className="p-3 font-normal">Balance Due</th>
              <th className="p-3 font-normal">Status</th>
            </tr>
          </thead>

          {/* ✅ Table Body */}
          <tbody>
            {invoices.map((invoice, index) => (
              <tr key={index} className="border-t hover:bg-gray-50">
                <td className="p-3">{invoice.date}</td>
                <td className="p-3">{invoice.invoiceNumber}</td>
                <td className="p-3">{invoice.contracts}</td>
                <td className="p-3">{invoice.creditNotes}</td>
                <td className="p-3">{invoice.amount}</td>
                <td className="p-3">{invoice.balanceDue}</td>
                <td
                  className={`p-3 font-medium ${getStatusColor(
                    invoice.status
                  )}`}
                >
                  {invoice.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default InvoicesTable;
