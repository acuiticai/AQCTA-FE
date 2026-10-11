import React, { useState, useRef, useEffect } from "react";
import { FiChevronDown } from "react-icons/fi";
import { useHistory } from "react-router-dom";

const AddTransactionButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedType, setSelectedType] = useState(null);
  const dropdownRef = useRef(null);
  const history = useHistory();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleAddTransaction = (type) => {
    setSelectedType(type);
    // Navigate to add ledger page with transaction type as query parameter
    history.push(`/add-ledger?type=${type.toLowerCase()}`);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex">
        <button
          className="bg-[var(--p-blue)] text-white rounded-l-md px-4 py-2 flex items-center"
          onClick={() => handleAddTransaction(selectedType || "Income")}
        >
          <span className="mr-2">+</span> Add Transaction
        </button>
        <button
          className="ml-2 bg-[var(--p-blue)] text-white rounded-r-md px-2 py-2 flex items-center border-l border-[#9eba33]"
          onClick={() => setIsOpen(!isOpen)}
        >
          <FiChevronDown />
        </button>
      </div>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-40 bg-white rounded-md shadow-lg z-10 overflow-hidden">
          <button
            className="w-full px-4 py-2 text-left hover:bg-gray-100 focus:outline-none"
            onClick={() => handleAddTransaction("Income")}
          >
            Income
          </button>
          <button
            className="w-full px-4 py-2 text-left hover:bg-gray-100 focus:outline-none"
            onClick={() => handleAddTransaction("Expense")}
          >
            Expense
          </button>
          <button
            className="w-full px-4 py-2 text-left hover:bg-gray-100 focus:outline-none"
            onClick={() => handleAddTransaction("Inflow")}
          >
            Inflow
          </button>
          <button
            className="w-full px-4 py-2 text-left hover:bg-gray-100 focus:outline-none"
            onClick={() => handleAddTransaction("Outflow")}
          >
            Outflow
          </button>
        </div>
      )}
    </div>
  );
};

export default AddTransactionButton;
