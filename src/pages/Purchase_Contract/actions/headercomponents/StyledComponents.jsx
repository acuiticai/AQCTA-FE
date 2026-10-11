import { FiPlus } from "react-icons/fi";
// components/PageHeader.jsx
export const PageHeader = ({ title, children }) => (
  <div className="flex justify-between items-center mb-4">
    <h2 className="text-lg font-semibold">{title}</h2>
    <div className="flex space-x-3">{children}</div>
  </div>
);

// components/FilterDropdown.jsx
export const FilterDropdown = ({
  options = [],
  value,
  onChange,
  placeholder = "Filter By",
}) => (
  <select
    className="border px-4 py-2 rounded-xl text-sm bg-gray-100"
    value={value}
    onChange={onChange}
  >
    <option value="">{`${placeholder}: All`}</option>
    {options.map((option) => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
);

// components/AddButton.jsx
export const AddButton = ({ onClick, label = "Add New" }) => (
  <button
    onClick={onClick}
    className="flex items-center bg-[#F2F2F2] text-black text-sm font-medium px-4 py-2 rounded-xl shadow-sm hover:bg-gray-200 transition"
  >
    {label}
    <span className="ml-2 flex items-center justify-center w-6 h-6 bg-[var(--p-blue)] text-white rounded-full">
      <FiPlus size={14} />
    </span>
  </button>
);

// components/DataTable.jsx
export const DataTable = ({ columns, data, getRowKey = (row) => row.id }) => (
  <div className="overflow-x-auto">
    <table className="w-full border rounded-lg text-sm">
      <thead>
        <tr className="bg-[#F2F2F2] text-left">
          {columns.map((column) => (
            <th key={column.key} className="p-3 font-normal">
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row) => (
          <tr key={getRowKey(row)} className="border-t hover:bg-gray-50">
            {columns.map((column) => (
              <td key={column.key} className="p-3">
                {column.render ? column.render(row) : row[column.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// components/StatusBadge.jsx
export const StatusBadge = ({ status }) => {
  const getStatusColor = (status) => {
    const colors = {
      Draft: "text-gray-500",
      "Partially Paid": "text-green-500",
      Void: "text-gray-400",
      Open: "text-gray-700",
      Overdue: "text-yellow-600",
      "Pending Approval": "text-orange-500",
    };
    return colors[status] || "text-gray-600";
  };

  return (
    <span className={`font-medium ${getStatusColor(status)}`}>{status}</span>
  );
};

// components/DataCard.jsx
export const DataCard = ({ children, className = "" }) => (
  <div
    className={`bg-[#F9F9FA] p-6 rounded-xl shadow-sm mt-6 border font-sans text-[#303030] font-normal ${className}`}
  >
    {children}
  </div>
);
