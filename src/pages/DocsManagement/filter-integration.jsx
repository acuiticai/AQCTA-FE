"use client"

import { useState } from "react"
import { FiSearch, FiFilter, FiX, FiClock, FiTag, FiCalendar, FiUser, FiFile } from "react-icons/fi"
import { useTranslation } from "react-i18next"

const FilterBar = ({ onSearch, onOpenFilters, activeFilters, recentSearches = [] }) => {
  const { t } = useTranslation()
  const dm = (key, defaultValue, options = {}) =>
    t(`docsManagement.${key}`, { defaultValue, ...options })
  const [searchTerm, setSearchTerm] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)
  const quickFilters = [
    { id: "pdf", label: dm("pdfs", "PDFs"), icon: <FiFile />, filter: { type: "PDF" } },
    { id: "recent", label: dm("recent", "Recent"), icon: <FiClock />, filter: { dateModified: "Last 7 days" } },
    { id: "images", label: dm("images", "Images"), icon: <FiFile />, filter: { type: "Image" } },
    { id: "mine", label: dm("myFiles", "My Files"), icon: <FiUser />, filter: { owner: "Me" } },
  ]

  const handleSearch = (e) => {
    e.preventDefault()
    onSearch(searchTerm)
    setShowSuggestions(false)
  }

  const handleInputChange = (e) => {
    setSearchTerm(e.target.value)
    if (e.target.value.length > 0) {
      setShowSuggestions(true)
    } else {
      setShowSuggestions(false)
    }
  }

  const handleQuickFilter = (filter) => {
    onSearch(searchTerm, filter.filter)
  }

  const clearSearch = () => {
    setSearchTerm("")
    onSearch("")
  }

  const clearFilters = () => {
    onSearch("", null)
  }

  return (
    <div className="w-full">
      <form onSubmit={handleSearch} className="relative mb-2">
        <div className="relative flex items-center">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={handleInputChange}
            placeholder={dm("searchDocumentsFolders", "Search documents, folders, files...")}
            className="w-full pl-10 pr-16 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-12 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <FiX />
            </button>
          )}
          <button
            type="button"
            onClick={onOpenFilters}
            className={`absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 ${
              activeFilters ? "text-blue-500" : ""
            }`}
          >
            <FiFilter />
          </button>
        </div>
      </form>

      {/* Quick filters */}
      <div className="flex flex-wrap gap-2 mb-3">
        {quickFilters.map((filter) => (
          <button
            key={filter.id}
            onClick={() => handleQuickFilter(filter)}
            className="flex items-center gap-1 px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-sm"
          >
            {filter.icon}
            <span>{filter.label}</span>
          </button>
        ))}
      </div>

      {/* Active filters */}
      {activeFilters &&
        Object.keys(activeFilters).some(
          (key) =>
            activeFilters[key] !== "" &&
            activeFilters[key] !== "Any" &&
            activeFilters[key] !== "Anyone" &&
            activeFilters[key] !== "Anywhere" &&
            activeFilters[key] !== "Any time" &&
            activeFilters[key] !== false &&
            !(Array.isArray(activeFilters[key]) && activeFilters[key].length === 0),
        ) && (
          <div className="bg-blue-50 p-2 rounded-md mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-blue-700">{dm("activeFilters", "Active filters:")}</span>
              <button onClick={clearFilters} className="text-xs text-blue-600 hover:text-blue-800">
                {dm("clearAll", "Clear all")}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {activeFilters.searchQuery && (
                <div className="bg-white text-blue-800 text-xs rounded-full px-3 py-1 flex items-center border border-blue-200">
                  <FiSearch className="mr-1" size={12} />
                  {dm("searchLabel", "Search: {{query}}", { query: activeFilters.searchQuery })}
                </div>
              )}
              {activeFilters.type && activeFilters.type !== "Any" && (
                <div className="bg-white text-blue-800 text-xs rounded-full px-3 py-1 flex items-center border border-blue-200">
                  <FiFile className="mr-1" size={12} />
                  {dm("typeLabel", "Type: {{type}}", { type: activeFilters.type })}
                </div>
              )}
              {activeFilters.dateModified && activeFilters.dateModified !== "Any time" && (
                <div className="bg-white text-blue-800 text-xs rounded-full px-3 py-1 flex items-center border border-blue-200">
                  <FiCalendar className="mr-1" size={12} />
                  {dm("modifiedLabel", "Modified: {{date}}", { date: activeFilters.dateModified })}
                </div>
              )}
              {activeFilters.owner && activeFilters.owner !== "Anyone" && (
                <div className="bg-white text-blue-800 text-xs rounded-full px-3 py-1 flex items-center border border-blue-200">
                  <FiUser className="mr-1" size={12} />
                  {dm("ownerLabel", "Owner: {{owner}}", { owner: activeFilters.owner })}
                </div>
              )}
              {activeFilters.tags && activeFilters.tags.length > 0 && (
                <div className="bg-white text-blue-800 text-xs rounded-full px-3 py-1 flex items-center border border-blue-200">
                  <FiTag className="mr-1" size={12} />
                  {dm("tagsLabel", "Tags: {{tags}}", { tags: activeFilters.tags.join(", ") })}
                </div>
              )}
              {/* Add more filter indicators as needed */}
            </div>
          </div>
        )}
    </div>
  )
}

export default FilterBar
