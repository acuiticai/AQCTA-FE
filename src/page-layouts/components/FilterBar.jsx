import React from "react";
import { FiSearch } from "react-icons/fi";

const FilterBar = ({
  title = "All Contracts",
  filters = [],
  searchValue = "",
  onSearch,
  searchPlaceholder = "Search",
  containerClassName = "bg-[#F9F9FA] rounded-xl p-4 mb-4"
}) => {
  return (
    <div className={containerClassName}>
      <div className="text-base font-medium mb-4">{title}</div>
      
      <div className="flex flex-row-reverse items-center mb-4 gap-4">
        {/* Search Input */}
        <div className="relative">
          <input
            type="text"
            value={searchValue}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent"
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FiSearch className="text-gray-400" />
          </div>
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <span className="text-gray-400">⌘/</span>
          </div>
        </div>
        
        {/* Filters */}
        {filters.map((filter, index) => (
          <div key={index} className="relative">
            <select
              value={filter.value || ""}
              onChange={(e) => filter.onChange(e.target.value)}
              className="appearance-none bg-white border border-gray-200 rounded-lg py-2 pl-4 pr-10 focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent"
            >
              <option value="" disabled hidden>
                {filter.placeholder}
              </option>
              {filter.options.map((option, idx) => (
                <option key={idx} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
              </svg>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FilterBar;