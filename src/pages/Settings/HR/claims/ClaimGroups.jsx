import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AiOutlineEdit, AiOutlineDelete, AiOutlinePlus } from "react-icons/ai";
import AddClaimGroup from "./AddClaimGroup";
import EditClaimGroup from "./EditClaimGroup";
import axios from "axios";
import { useLocation } from "react-router-dom";
import { useSettingsCrudPermissions } from "@/hooks/useSettingsCrudPermissions";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const ClaimGroups = ({ selectedOrg }) => {
  const { t } = useTranslation();
  const thr = (key, fallback, options) =>
    t(`settingsPage.hr.${key}`, { defaultValue: fallback, ...options });

  const { canAdd, canUpdate, canDelete } = useSettingsCrudPermissions();
  const [claimGroups, setClaimGroups] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentClaimGroup, setCurrentClaimGroup] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [organization, setOrganization] = useState(null);
  const [isOrgLoaded, setIsOrgLoaded] = useState(false);
  const location = useLocation();
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const selectedOrg = searchParams.get("selectedOrg");

    if (selectedOrg) {
      setOrganization(selectedOrg);
    }

    setIsOrgLoaded(true); // Organization has been fetched
  }, [location]);

  useEffect(() => {
    if (isOrgLoaded && organization) {
      // Ensure organization is loaded before fetching items
      fetchClaimGroups(organization);
    }
  }, [organization, isOrgLoaded]);

  const fetchClaimGroups = async (selectedOrg) => {
    setIsLoading(true);
    try {
      let payload = {
        bid: selectedOrg,
        FilterStatus: "",
        FilterName: "",
      };
      const response = await axios.get(`${Base_URL}/claim-groups`, {
        params: payload,
      });
      setClaimGroups(response.data);
    } catch (error) {
      console.error("Error fetching claim groups:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (id, currentStatus) => {
    if (!canUpdate) return;
    try {
      await axios.patch(`${Base_URL}/claim-groups/${id}`, {
        status: !currentStatus,
      });
      fetchClaimGroups(organization);
    } catch (error) {
      console.error("Error updating claim group status:", error);
    }
  };

  const handleEdit = (claimGroup) => {
    if (!canUpdate) return;
    setCurrentClaimGroup(claimGroup);
    setShowEditModal(true);
  };

  const handleDelete = async (id) => {
    if (!canDelete) return;
    if (
      window.confirm(
        thr("claimGroups.deleteConfirm", "Are you sure you want to delete this claim group?")
      )
    ) {
      try {
        await axios.delete(`${Base_URL}/claim-groups/${id}`);
        fetchClaimGroups(organization);
      } catch (error) {
        console.error("Error deleting claim group:", error);
      }
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto py-6 px-4 max-h-[90vh] overflow-y-auto pb-[120px]">
      <div className="mb-6 flex justify-end items-center">
        {canAdd && (
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-[#A6C437] hover:bg-[#A6C437] text-white px-4 py-2 rounded flex items-center"
          >
            <AiOutlinePlus className="mr-2" />
            {thr("addNew", "Add New")}
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-4 text-center">{thr("claimGroups.loading", "Loading claim groups...")}</div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {thr("claimGroups.claimGroupName", "Claim Group Name")}
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {thr("claimGroups.claimGroupCode", "Claim Group Code")}
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {thr("status", "Status")}
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {thr("actions", "Actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {claimGroups.length === 0 ? (
                  <tr>
                    <td
                      colSpan="4"
                      className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500"
                    >
                      {thr("claimGroups.empty", "No claim groups found")}
                    </td>
                  </tr>
                ) : (
                  claimGroups.map((claimGroup) => (
                    <tr key={claimGroup._id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {claimGroup.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {claimGroup.code}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <label className={`relative inline-flex items-center ${canUpdate ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}>
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={claimGroup.status}
                            disabled={!canUpdate}
                            onChange={() =>
                              handleStatusChange(
                                claimGroup._id,
                                claimGroup.status
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
                              onClick={() => handleEdit(claimGroup)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              <AiOutlineEdit size={20} />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(claimGroup._id)}
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
        <AddClaimGroup
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            fetchClaimGroups(organization);
          }}
          selectedOrg={selectedOrg}
        />
      )}

      {showEditModal && currentClaimGroup && (
        <EditClaimGroup
          claimGroup={currentClaimGroup}
          onClose={() => {
            setShowEditModal(false);
            setCurrentClaimGroup(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setCurrentClaimGroup(null);
            fetchClaimGroups(organization);
          }}
        />
      )}
    </div>
  );
};

export default ClaimGroups;
