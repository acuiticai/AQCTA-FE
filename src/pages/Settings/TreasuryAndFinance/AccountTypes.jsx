import React, { useState, useEffect } from "react";
import { AiOutlineEdit, AiOutlineDelete, AiOutlinePlus } from "react-icons/ai";
import axios from "axios";
import AddAccountType from "./AddAccountType";
import EditAccountType from "./EditAccountType";
import { useLocation } from "react-router-dom";
import Header from "@/components/header/Header";
import AppLayout from "../app-layout";
import CustomPagination from "@/components/CustomPagination";
import SettingsOrgBanner from "../SettingsOrgBanner";
import { useSettingsCrudPermissions } from "@/hooks/useSettingsCrudPermissions";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const AccountTypes = () => {
  const { canAdd, canUpdate, canDelete } = useSettingsCrudPermissions();
  const [accountTypes, setAccountTypes] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentAccountType, setCurrentAccountType] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const selectedOrg = queryParams.get("selectedOrg");

  useEffect(() => {
    if (selectedOrg) {
      fetchAccountTypes();
    } else {
      setAccountTypes([]);
      setIsLoading(false);
    }
  }, [selectedOrg]);

  const fetchAccountTypes = async () => {
    if (!selectedOrg) return;
    setIsLoading(true);
    try {
      const response = await axios.get(`${Base_URL}/account-types`, {
        params: { bid: selectedOrg },
      });
      setAccountTypes(response.data);
    } catch (error) {
      console.error("Error fetching account types:", error);
      setAccountTypes([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (id, currentStatus) => {
    if (!canUpdate) return;
    try {
      const params = selectedOrg ? { bid: selectedOrg } : {};
      await axios.patch(`${Base_URL}/account-types/${id}/status`, {
        status: !currentStatus,
      }, { params });
      fetchAccountTypes();
    } catch (error) {
      console.error("Error updating account type status:", error);
    }
  };

  const handleEdit = (accountType) => {
    if (!canUpdate) return;
    setCurrentAccountType(accountType);
    setShowEditModal(true);
  };

  const handleDelete = async (id) => {
    if (!canDelete) return;
    if (window.confirm("Are you sure you want to delete this account type?")) {
      try {
        const params = selectedOrg ? { bid: selectedOrg } : {};
        await axios.delete(`${Base_URL}/account-types/${id}`, { params });
        fetchAccountTypes();
      } catch (error) {
        console.error("Error deleting account type:", error);
      }
    }
  };

  // Pagination logic
  const totalResults = accountTypes.length;
  const totalPages = Math.ceil(totalResults / recordsPerPage);
  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = accountTypes.slice(
    indexOfFirstRecord,
    indexOfLastRecord,
  );

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Reset to page 1 when data changes
  useEffect(() => {
    setCurrentPage(1);
  }, [accountTypes.length]);

  return (
    <AppLayout>
      <Header title="Account Types" />
      <div className="w-full max-w-7xl mx-auto py-6 px-4 max-h-[90vh] overflow-y-auto pb-[120px]">
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Treasury & Finance</h1>
          {canAdd && (
            <button
              onClick={() => setShowAddModal(true)}
              disabled={!selectedOrg}
              className="bg-lime-500 hover:bg-lime-600 text-white px-4 py-2 rounded flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <AiOutlinePlus className="mr-2" />
              Add New
            </button>
          )}
        </div>
        <SettingsOrgBanner />

        {!selectedOrg && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded mb-4">
            Select a business (organization) to view and manage account types.
          </div>
        )}

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex">
                <a
                  href="#"
                  className="border-b-2 border-lime-500 py-4 px-6 text-lime-600 font-medium"
                >
                  Account Types
                </a>
              </nav>
            </div>

            {!selectedOrg ? (
              <div className="p-4 text-center text-gray-500">
                No business selected.
              </div>
            ) : isLoading ? (
              <div className="p-4 text-center">Loading account types...</div>
            ) : (
              <>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Account Header
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Name
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Code
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Description
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Status
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {accountTypes.length === 0 ? (
                      <tr>
                        <td
                          colSpan="7"
                          className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500"
                        >
                          No account types found
                        </td>
                      </tr>
                    ) : (
                      currentRecords.map((accountType) => (
                        <tr key={accountType._id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {accountType.accountHeader}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {accountType.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {accountType.code}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {accountType.description}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <label className={`relative inline-flex items-center ${canUpdate ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}>
                              <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={accountType.status}
                                disabled={!canUpdate}
                                onChange={() =>
                                  handleStatusChange(
                                    accountType._id,
                                    accountType.status,
                                  )
                                }
                              />
                              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                            </label>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex space-x-2">
                              {canUpdate && (
                                <button
                                  onClick={() => handleEdit(accountType)}
                                  className="text-blue-600 hover:text-blue-900"
                                >
                                  <AiOutlineEdit size={20} />
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  onClick={() => handleDelete(accountType._id)}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  <AiOutlineDelete size={20} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                {/* Pagination and Records Per Page */}
                {accountTypes.length > 0 && (
                  <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-700">Show</span>
                      <select
                        value={recordsPerPage}
                        onChange={(e) => {
                          setRecordsPerPage(Number(e.target.value));
                          setCurrentPage(1);
                        }}
                        className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-lime-500"
                      >
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                      <span className="text-sm text-gray-700">
                        entries (showing {indexOfFirstRecord + 1}-
                        {Math.min(indexOfLastRecord, totalResults)} of{" "}
                        {totalResults})
                      </span>
                    </div>

                    <CustomPagination
                      totalResults={totalResults}
                      resultsPerPage={recordsPerPage}
                      currentPage={currentPage}
                      onChange={handlePageChange}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {showAddModal && (
          <AddAccountType
            onClose={() => setShowAddModal(false)}
            onSuccess={() => {
              setShowAddModal(false);
              fetchAccountTypes();
            }}
            selectedOrg={selectedOrg}
          />
        )}

        {showEditModal && currentAccountType && (
          <EditAccountType
            accountType={currentAccountType}
            selectedOrg={selectedOrg}
            onClose={() => {
              setShowEditModal(false);
              setCurrentAccountType(null);
            }}
            onSuccess={() => {
              setShowEditModal(false);
              setCurrentAccountType(null);
              fetchAccountTypes();
            }}
          />
        )}
      </div>
    </AppLayout>
  );
};

export default AccountTypes;
