import React, { useState, useEffect } from "react";
import { AiOutlineEdit, AiOutlineDelete, AiOutlinePlus } from "react-icons/ai";
import axios from "axios";
import AddBankAccountType from "./AddBankAccountType";
import EditBankAccountType from "./EditBankAccountType";
import { useLocation } from "react-router-dom";
import Header from "@/components/header/Header";
import AppLayout from "../app-layout";
import SettingsOrgBanner from "../SettingsOrgBanner";
import { useSettingsCrudPermissions } from "@/hooks/useSettingsCrudPermissions";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const BankAccountTypes = () => {
  const { canAdd, canUpdate, canDelete } = useSettingsCrudPermissions();
  const [accountTypes, setAccountTypes] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentAccountType, setCurrentAccountType] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const selectedOrg = queryParams.get("selectedOrg");

  useEffect(() => {
    fetchAccountTypes();
  }, [selectedOrg]);

  const fetchAccountTypes = async () => {
    setIsLoading(true);
    try {
      const url = selectedOrg
        ? `${Base_URL}/bank-account-types?business=${selectedOrg}`
        : `${Base_URL}/bank-account-types`;
      const response = await axios.get(url);
      setAccountTypes(response.data);
    } catch (error) {
      console.log("error", error);
      console.error("Error fetching bank account types:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (id, currentStatus) => {
    if (!canUpdate) return;
    try {
      await axios.patch(`${Base_URL}/bank-account-types/${id}`, {
        status: !currentStatus,
      });
      fetchAccountTypes();
    } catch (error) {
      console.error("Error updating bank account type status:", error);
    }
  };

  const handleEdit = (accountType) => {
    if (!canUpdate) return;
    setCurrentAccountType(accountType);
    setShowEditModal(true);
  };

  const handleDelete = async (id) => {
    if (!canDelete) return;
    if (
      window.confirm("Are you sure you want to delete this bank account type?")
    ) {
      try {
        await axios.delete(`${Base_URL}/bank-account-types/${id}`);
        fetchAccountTypes();
      } catch (error) {
        console.error("Error deleting bank account type:", error);
      }
    }
  };

  return (
    <AppLayout>
      <Header title="Bank Account Types" />
      <div className="w-full max-w-7xl mx-auto py-6 px-4 max-h-[90vh] overflow-y-auto pb-[120px]">
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Treasury & Finance</h1>
          {canAdd && (
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-lime-500 hover:bg-lime-600 text-white px-4 py-2 rounded flex items-center"
            >
              <AiOutlinePlus className="mr-2" />
              Add New
            </button>
          )}
        </div>
        <SettingsOrgBanner />

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex">
                <a
                  href="#"
                  className="border-b-2 border-lime-500 py-4 px-6 text-lime-600 font-medium"
                >
                  Bank Account Types
                </a>
              </nav>
            </div>

            {isLoading ? (
              <div className="p-4 text-center">
                Loading bank account types...
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
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
                        colSpan="3"
                        className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500"
                      >
                        No bank account types found
                      </td>
                    </tr>
                  ) : (
                    accountTypes.map((accountType) => (
                      <tr key={accountType._id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {accountType.name}
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
                                  accountType.status
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
            )}
          </div>
        </div>

        {showAddModal && (
          <AddBankAccountType
            onClose={() => setShowAddModal(false)}
            onSuccess={() => {
              setShowAddModal(false);
              fetchAccountTypes();
            }}
            selectedOrg={selectedOrg}
          />
        )}

        {showEditModal && currentAccountType && (
          <EditBankAccountType
            accountType={currentAccountType}
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

export default BankAccountTypes;
