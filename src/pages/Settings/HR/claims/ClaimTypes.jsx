import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AiOutlineEdit, AiOutlineDelete, AiOutlinePlus } from "react-icons/ai";
import axios from "axios";
import AddClaimType from "./AddClaimType";
import EditClaimType from "./EditClaimType";
import { useLocation } from "react-router-dom";
import { useSettingsCrudPermissions } from "@/hooks/useSettingsCrudPermissions";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const ClaimTypes = ({ selectedOrg }) => {
  const { t } = useTranslation();
  const thr = (key, fallback, options) =>
    t(`settingsPage.hr.${key}`, { defaultValue: fallback, ...options });

  const { canAdd, canUpdate, canDelete } = useSettingsCrudPermissions();
  const [claimTypes, setClaimTypes] = useState([]);
  const [claimGroups, setClaimGroups] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentClaimType, setCurrentClaimType] = useState(null);
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
      fetchData(organization);
    }
  }, [organization, isOrgLoaded]);

  const fetchData = async () => {
    setIsLoading(true);
    let payload = {
      bid: selectedOrg,
      FilterStatus: "",
      FilterName: "",
    };

    console.log("SELECTED BUSINESS ID IS:", selectedOrg);
    try {
      const [typesResponse, groupsResponse] = await Promise.all([
        axios.get(`${Base_URL}/claim-types`, { params: payload }),
        axios.get(`${Base_URL}/claim-groups`, { params: payload }),
      ]);
      setClaimTypes(typesResponse.data);
      setClaimGroups(groupsResponse.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (id, currentStatus) => {
    if (!canUpdate) return;
    try {
      await axios.patch(`${Base_URL}/claim-types/${id}`, {
        status: !currentStatus,
      });
      fetchData();
    } catch (error) {
      console.error("Error updating claim type status:", error);
    }
  };

  const handleEdit = (claimType) => {
    if (!canUpdate) return;
    setCurrentClaimType(claimType);
    setShowEditModal(true);
  };

  const handleDelete = async (id) => {
    if (!canDelete) return;
    if (
      window.confirm(
        thr("claimTypes.deleteConfirm", "Are you sure you want to delete this claim type?")
      )
    ) {
      try {
        await axios.delete(`${Base_URL}/claim-types/${id}`);
        fetchData();
      } catch (error) {
        console.error("Error deleting claim type:", error);
      }
    }
  };

  // Helper function to get claim group name from ID
  const getClaimGroupName = (groupIds) => {
    const groups = claimGroups
      .filter((g) => groupIds?.includes(g._id))
      .map((g) => g.name);
    return groups.length ? groups.join(", ") : thr("unknown", "Unknown");
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
            <div className="p-4 text-center">{thr("claimTypes.loading", "Loading claim types...")}</div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {thr("claimTypes.claimType", "Claim Type")}
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {thr("claimTypes.claimGroups", "Claim Groups")}
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {thr("claimTypes.defaultLimit", "Default Limit")}
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {thr("claimTypes.claimLimits", "Claim Limits")}
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
                {claimTypes.length === 0 ? (
                  <tr>
                    <td
                      colSpan="5"
                      className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500"
                    >
                      {thr("claimTypes.empty", "No claim types found")}
                    </td>
                  </tr>
                ) : (
                  claimTypes.map((claimType) => (
                    <tr key={claimType._id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {claimType.type}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {getClaimGroupName(claimType.claimGroupIds)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {claimType.defaultLimit}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {claimType.claimLimits &&
                        claimType.claimLimits.length > 0 ? (
                          <ul className="list-disc list-inside">
                            {claimType.claimLimits.map((limit, index) => (
                              <li key={index}>
                                {limit.fromYear} - {limit.toYear}:{" "}
                                {limit.maxAmount.toFixed(2)}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          thr("claimTypes.noCustomLimit", "No custom limit")
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <label className={`relative inline-flex items-center ${canUpdate ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}>
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={claimType.status}
                            disabled={!canUpdate}
                            onChange={() =>
                              handleStatusChange(
                                claimType._id,
                                claimType.status
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
                              onClick={() => handleEdit(claimType)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              <AiOutlineEdit size={20} />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(claimType._id)}
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
        <AddClaimType
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            fetchData();
          }}
          selectedOrg={selectedOrg}
          claimGroups={claimGroups}
        />
      )}

      {showEditModal && currentClaimType && (
        <EditClaimType
          claimType={currentClaimType}
          onClose={() => {
            setShowEditModal(false);
            setCurrentClaimType(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setCurrentClaimType(null);
            fetchData();
          }}
          claimGroups={claimGroups}
        />
      )}
    </div>
  );
};

export default ClaimTypes;
