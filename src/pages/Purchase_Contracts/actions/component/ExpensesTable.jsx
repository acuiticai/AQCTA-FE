import React from "react";
import { FiEdit2, FiTrash2 } from "react-icons/fi";

const ExpensesTable = () => {
  const expenses = [
    { type: "Agent Commission", amount: "$ 2165.10", invoiceNo: "234651154", datePaid: "22-11-2024", status: "Unpaid" },
    { type: "Bank Charges", amount: "$1652.10", invoiceNo: "234651154", datePaid: "22-11-2024", status: "Paid" },
    { type: "Insurance", amount: "$4851.13", invoiceNo: "234651154", datePaid: "22-11-2024", status: "Partial Paid" },
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case "Unpaid":
        return "text-gray-500";
      case "Paid":
        return "text-green-500";
      case "Partial Paid":
        return "text-yellow-500";
      default:
        return "text-gray-600";
    }
  };

  return (
    <div className="bg-[#F9F9FA] p-6 rounded-xl shadow-sm mt-6 border font-sans text-[#303030] font-normal">
      {/* ✅ Header Section */}
      <h2 className="text-lg font-semibold mb-4">Expenses</h2>

      {/* ✅ Expenses Table */}
      <div className="overflow-x-auto">
        <table className="w-full border rounded-lg text-sm">
          {/* ✅ Table Header */}
          <thead>
            <tr className="bg-[#F2F2F2] text-left">
              <th className="p-3 font-normal">Expense Type</th>
              <th className="p-3 font-normal">Amount</th>
              <th className="p-3 font-normal">Invoice No.</th>
              <th className="p-3 font-normal">Date Paid</th>
              <th className="p-3 font-normal">Status</th>
              <th className="p-3 text-center font-normal">Action</th>
            </tr>
          </thead>

          {/* ✅ Table Body */}
          <tbody>
            {expenses.map((expense, index) => (
              <tr key={index} className="border-t hover:bg-gray-50">
                <td className="p-3">{expense.type}</td>
                <td className="p-3">{expense.amount}</td>
                <td className="p-3">{expense.invoiceNo}</td>
                <td className="p-3">{expense.datePaid}</td>
                <td className={`p-3 font-medium ${getStatusColor(expense.status)}`}>
                  {expense.status}
                </td>
                <td className="p-3 text-center flex justify-center space-x-2">
                  <button className="p-2 hover:bg-gray-100 rounded-md">
                    <FiEdit2 className="text-gray-600" />
                  </button>
                  <button className="p-2 hover:bg-gray-100 rounded-md">
                    <FiTrash2 className="text-red-500" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ExpensesTable;
