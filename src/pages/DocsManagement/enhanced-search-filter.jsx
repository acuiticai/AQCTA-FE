import { useState, useEffect, useRef } from "react";
import { FiX, FiFilter, FiCheck, FiSearch, FiCalendar, FiFolder, FiFile, FiUser, FiStar, FiLock, FiClock, FiCheckSquare, FiShare2 } from "react-icons/fi";
import axios from "axios";
import { useTranslation } from "react-i18next";

const EnhancedSearchFilter = ({ isOpen, onClose, onApplyFilters, initialFilters, adminInfo, selectedBusiness }) => {
  const { t } = useTranslation();
  const dm = (key, defaultValue, options = {}) =>
    t(`docsManagement.${key}`, { defaultValue, ...options });
  const [filters, setFilters] = useState({
    searchType: "any",
    searchQuery: "",
    type: "Any",
    owner: "Anyone",
    includesWords: "",
    itemName: "",
    location: "Anywhere",
    inBin: false,
    starred: false,
    encrypted: false,
    dateModified: "Any time",
    awaitingApproval: false,
    requestedByMe: false,
    sharedTo: "",
  });
  
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const modalRef = useRef(null);

  // Initialize filters with passed values when component mounts or initialFilters changes
  useEffect(() => {
    if (initialFilters) {
      setFilters((prev) => ({
        ...prev,
        ...initialFilters,
      }));
    }
    
    // Load recent searches from localStorage
    const savedSearches = localStorage.getItem('recentSearches');
    if (savedSearches) {
      setRecentSearches(JSON.parse(savedSearches));
    }
    
    // Fetch users for the dropdown
    fetchUsers();
  }, [initialFilters, isOpen]);
  
  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
      const response = await axios.get(`${Base_URL}/users/business/${selectedBusiness}`, {
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${adminInfo.token}`,
        }
      });
      setUsers(response.data || []);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching users:", error);
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFilters({
      searchType: "any",
      searchQuery: "",
      type: "Any",
      owner: "Anyone",
      includesWords: "",
      itemName: "",
      location: "Anywhere",
      inBin: false,
      starred: false,
      encrypted: false,
      dateModified: "Any time",
      awaitingApproval: false,
      requestedByMe: false,
      sharedTo: "",
    });
  };

  const handleSearch = () => {
    // Save current search to recent searches
    if (filters.searchQuery || filters.includesWords || filters.itemName) {
      const searchTerm = filters.searchQuery || filters.includesWords || filters.itemName;
      const newRecentSearches = [
        { term: searchTerm, filters: { ...filters } },
        ...recentSearches.filter(s => s.term !== searchTerm).slice(0, 4)
      ];
      setRecentSearches(newRecentSearches);
      localStorage.setItem('recentSearches', JSON.stringify(newRecentSearches));
    }
    
    onApplyFilters(filters);
    onClose();
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFilters({
      ...filters,
      [name]: type === "checkbox" ? checked : value,
    });
  };
  
  const applyRecentSearch = (savedSearch) => {
    setFilters(savedSearch.filters);
    onApplyFilters(savedSearch.filters);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center pt-10 z-50 overflow-auto">
      <div ref={modalRef} className="bg-white rounded-lg shadow-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <h2 className="text-xl font-semibold flex items-center text-gray-800">
            <FiFilter className="mr-2 text-blue-600" /> {dm("advancedSearch", "Advanced Search")}
          </h2>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-gray-100 rounded-full transition-colors" 
            aria-label={dm("close", "Close")}
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Main search input */}
        <div className="mb-6 relative">
          <div className="relative">
            <FiSearch className="absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              name="searchQuery"
              className="w-full border rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              placeholder={dm("searchForDocuments", "Search for documents, folders, or content...")}
              value={filters.searchQuery}
              onChange={handleInputChange}
            />
          </div>
          
          {/* Recent searches */}
          {recentSearches.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-gray-500 mb-1">{dm("recentSearches", "Recent searches:")}</p>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((search, index) => (
                  <button
                    key={index}
                    onClick={() => applyRecentSearch(search)}
                    className="text-xs bg-gray-100 hover:bg-gray-200 rounded-full px-3 py-1 flex items-center"
                  >
                    <FiClock className="mr-1" size={12} />
                    {search.term}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block font-medium text-gray-700 flex items-center">
                <FiSearch className="mr-2 text-blue-600" /> {dm("searchBy", "Search by")}
              </label>
              <select
                name="searchType"
                className="w-full border rounded-md p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                value={filters.searchType}
                onChange={handleInputChange}
              >
                <option value="any">{dm("any", "Any")}</option>
                <option value="documentTitle">{dm("documentTitle", "Document Title")}</option>
                <option value="customer">{dm("customer", "Customer")}</option>
                <option value="hr">{dm("hr", "HR")}</option>
                <option value="salesContract">{dm("salesContract", "Sales Contract")}</option>
                <option value="purchaseContract">{dm("purchaseContract", "Purchase Contract")}</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="block font-medium text-gray-700 flex items-center">
                <FiFile className="mr-2 text-blue-600" /> {dm("type", "Type")}
              </label>
              <select
                name="type"
                className="w-full border rounded-md p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                value={filters.type}
                onChange={handleInputChange}
              >
                <option value="Any">{dm("any", "Any")}</option>
                <option value="Document">{dm("document", "Document")}</option>
                <option value="Folder">{dm("folder", "Folder")}</option>
                <option value="Image">{dm("image", "Image")}</option>
                <option value="PDF">{dm("pdf", "PDF")}</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="block font-medium text-gray-700 flex items-center">
                <FiUser className="mr-2 text-blue-600" /> {dm("owner", "Owner")}
              </label>
              <select
                name="owner"
                className="w-full border rounded-md p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                value={filters.owner}
                onChange={handleInputChange}
              >
                <option value="Anyone">{dm("anyone", "Anyone")}</option>
                <option value="Me">{dm("me", "Me")}</option>
                <option value="Not me">{dm("notMe", "Not me")}</option>
                {users.map(user => (
                  <option key={user._id} value={user._id}>{user.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block font-medium text-gray-700 flex items-center">
                <FiFolder className="mr-2 text-blue-600" /> {dm("location", "Location")}
              </label>
              <select
                name="location"
                className="w-full border rounded-md p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                value={filters.location}
                onChange={handleInputChange}
              >
                <option value="Anywhere">{dm("anywhere", "Anywhere")}</option>
                <option value="My Drive">{dm("myDrive", "My Drive")}</option>
                <option value="Shared with me">{dm("sharedWithMe", "Shared with me")}</option>
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block font-medium text-gray-700 flex items-center">
                <FiCalendar className="mr-2 text-blue-600" /> {dm("dateModified", "Date modified")}
              </label>
              <select
                name="dateModified"
                className="w-full border rounded-md p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                value={filters.dateModified}
                onChange={handleInputChange}
              >
                <option value="Any time">{dm("anyTime", "Any time")}</option>
                <option value="Today">{dm("today", "Today")}</option>
                <option value="Yesterday">{dm("yesterday", "Yesterday")}</option>
                <option value="Last 7 days">{dm("last7Days", "Last 7 days")}</option>
                <option value="Last 30 days">{dm("last30Days", "Last 30 days")}</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="block font-medium text-gray-700 flex items-center">
                <FiShare2 className="mr-2 text-blue-600" /> {dm("sharedTo", "Shared to")}
              </label>
              <input
                type="text"
                name="sharedTo"
                className="w-full border rounded-md p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder={dm("enterNameOrEmail", "Enter a name or email address...")}
                value={filters.sharedTo}
                onChange={handleInputChange}
              />
            </div>

            <div className="space-y-2">
              <label className="block font-medium text-gray-700 flex items-center">
                <FiCheckSquare className="mr-2 text-blue-600" /> {dm("contentIncludes", "Content includes")}
              </label>
              <input
                type="text"
                name="includesWords"
                className="w-full border rounded-md p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder={dm("enterWordsInFile", "Enter words found in the file")}
                value={filters.includesWords}
                onChange={handleInputChange}
              />
            </div>

            <div className="space-y-2">
              <label className="block font-medium text-gray-700">{dm("additionalFilters", "Additional filters")}</label>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 p-2 border rounded hover:bg-gray-50 transition-colors cursor-pointer">
                  <input
                    type="checkbox"
                    name="inBin"
                    checked={filters.inBin}
                    onChange={handleInputChange}
                    className="rounded text-blue-500 focus:ring-blue-500"
                  />
                  <span>{dm("inBin", "In bin")}</span>
                </label>
                <label className="flex items-center gap-2 p-2 border rounded hover:bg-gray-50 transition-colors cursor-pointer">
                  <input
                    type="checkbox"
                    name="starred"
                    checked={filters.starred}
                    onChange={handleInputChange}
                    className="rounded text-blue-500 focus:ring-blue-500"
                  />
                  <span>{dm("starred", "Starred")}</span>
                </label>
                <label className="flex items-center gap-2 p-2 border rounded hover:bg-gray-50 transition-colors cursor-pointer">
                  <input
                    type="checkbox"
                    name="encrypted"
                    checked={filters.encrypted}
                    onChange={handleInputChange}
                    className="rounded text-blue-500 focus:ring-blue-500"
                  />
                  <span>{dm("encrypted", "Encrypted")}</span>
                </label>
                <label className="flex items-center gap-2 p-2 border rounded hover:bg-gray-50 transition-colors cursor-pointer">
                  <input
                    type="checkbox"
                    name="awaitingApproval"
                    checked={filters.awaitingApproval}
                    onChange={handleInputChange}
                    className="rounded text-blue-500 focus:ring-blue-500"
                  />
                  <span>{dm("awaitingApproval", "Awaiting approval")}</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-between mt-8 pt-4 border-t">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded transition-colors flex items-center"
          >
            <FiX className="mr-1" /> {dm("reset", "Reset")}
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            >
              {dm("cancel", "Cancel")}
            </button>
            <button
              onClick={handleSearch}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center"
            >
              <FiCheck className="mr-1" /> {dm("applyFilters", "Apply Filters")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedSearchFilter;
