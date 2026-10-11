import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useHistory } from "react-router-dom";
import { Plus } from "lucide-react";
import {
  DataTable,
  ActionButtons,
  CustomModal,
} from "@/page-layouts";
import { notifyError, notifySuccess } from "@/utils/toast";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";
import useCheckTokenExpired from "@/hooks/useCheckTokenExpired";
import RouteActionGate from "@/components/RouteActionGate";
import {
  PERMISSION_ACTION,
  useRouteModulePermissions,
} from "@/utils/permissionUtils";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const BusinessGroupListScreen = () => {
  const checkTokenExpired = useCheckTokenExpired();
  const routePerms = useRouteModulePermissions();
  const [filteredBusinessGroups, setFilteredBusinessGroups] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalResults, setTotalResults] = useState(0);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState({
    companyName: "",
    registrationNumber: "",
    city: "",
    state: "",
  });
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [businessGroupToDelete, setBusinessGroupToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const currentPageRef = useRef(1);
  const history = useHistory();

  const headers = [
    "Company Name",
    "Subdomain",
    "Registration Number",
    "Email",
    "Phone",
    "City",
    "State",
    "Website",
    "Actions",
  ];

  useEffect(() => {
    fetchBusinessGroups(1, recordsPerPage, "", filters);
  }, []);

  const fetchBusinessGroups = async (
    page = 1,
    limit,
    search = "",
    filterParams = {}
  ) => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        page: page,
        limit: limit || recordsPerPage,
      };

      if (search) params.search = search;
      if (filterParams.companyName) params.companyName = filterParams.companyName;
      if (filterParams.registrationNumber) params.registrationNumber = filterParams.registrationNumber;
      if (filterParams.city) params.city = filterParams.city;
      if (filterParams.state) params.state = filterParams.state;

      const response = await axios.get(`${Base_URL}/business-groups`, { params });
      if (checkTokenExpired(response)) return;

      const businessGroupsData = Array.isArray(response.data.businessGroups)
        ? response.data.businessGroups
        : Array.isArray(response.data)
        ? response.data
        : [];
      setFilteredBusinessGroups(businessGroupsData);
      setTotalResults(response.data.total || businessGroupsData.length);
    } catch (err) {
      console.error("Error fetching business groups:", err);
      notifyError("Failed to load business groups");
      setError("Failed to load business groups");
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    currentPageRef.current = page;
    fetchBusinessGroups(page, recordsPerPage, searchTerm, filters);
  };

  const handleEditBusinessGroup = (businessGroupId) => {
    history.push(`/Edit Business Group/${businessGroupId}`);
  };

  const handleViewBusinessGroup = (businessGroupId) => {
    history.push(`/View Business Group/${businessGroupId}`);
  };

  const openDeleteBusinessGroup = (businessGroup) => {
    if (!routePerms.canDelete) return;
    setBusinessGroupToDelete(businessGroup);
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setDeleteModalOpen(false);
    setBusinessGroupToDelete(null);
  };

  const confirmDeleteBusinessGroup = async () => {
    if (!businessGroupToDelete?._id || !routePerms.canDelete) return;
    try {
      setDeleteLoading(true);
      await axios.delete(
        `${Base_URL}/business-groups/${businessGroupToDelete._id}`,
      );
      notifySuccess("Business group deleted successfully.");
      closeDeleteModal();
      fetchBusinessGroups(
        currentPageRef.current,
        recordsPerPage,
        searchTerm,
        filters,
      );
    } catch (err) {
      console.error("Error deleting business group:", err);
      notifyError(
        err?.response?.data?.message || "Failed to delete business group.",
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleSearch = (searchValue) => {
    setSearchTerm(searchValue);
    setCurrentPage(1);
    currentPageRef.current = 1;
    fetchBusinessGroups(1, recordsPerPage, searchValue, filters);
  };

  const handleFilterChange = (filterName, value) => {
    const newFilters = { ...filters, [filterName]: value };
    setFilters(newFilters);
    setCurrentPage(1);
    currentPageRef.current = 1;
    fetchBusinessGroups(1, recordsPerPage, searchTerm, newFilters);
  };

  const clearAllFilters = () => {
    setSearchTerm("");
    setFilters({
      companyName: "",
      registrationNumber: "",
      city: "",
      state: "",
    });
    setCurrentPage(1);
    currentPageRef.current = 1;
    fetchBusinessGroups(1, recordsPerPage, "", {
      companyName: "",
      registrationNumber: "",
      city: "",
      state: "",
    });
  };

  const totalPages = Math.ceil(totalResults / recordsPerPage) || 1;

  const filterOptions = [
    {
      isClearButton: true,
      buttonProps: {
        onClick: () => {
          clearAllFilters();
          setCurrentPage(1);
        },
      },
    },
    {
      value: filters.companyName,
      onChange: (value) => handleFilterChange("companyName", value),
      placeholder: "Company Name",
      name: "companyName",
      isTextInput: true,
    },
    {
      value: filters.registrationNumber,
      onChange: (value) => handleFilterChange("registrationNumber", value),
      placeholder: "Registration Number",
      name: "registrationNumber",
      isTextInput: true,
    },
    {
      value: filters.city,
      onChange: (value) => handleFilterChange("city", value),
      placeholder: "City",
      name: "city",
      isTextInput: true,
    },
    {
      value: filters.state,
      onChange: (value) => handleFilterChange("state", value),
      placeholder: "State",
      name: "state",
      isTextInput: true,
    },
  ];

  return (
    <RouteActionGate
      title="Business Group"
      requiredPermission={PERMISSION_ACTION.VIEW}
    >
      <div className="w-full container py-8 px-8">
      {/* Header - same style as Banking Management */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Business Group</h1>
            <p className="text-gray-600 mt-2">Manage business groups</p>
          </div>
          <div className="flex items-center gap-4">
            {routePerms.canAdd && (
              <button
                onClick={() => history.push("/Add New Business Group")}
                className="flex items-center gap-2 px-6 py-3 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[var(--p-blue-dark)] transition-colors shadow-sm"
              >
                <Plus size={20} />
                Add New Business Group
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <DataTable
          title=""
          headers={headers}
          data={filteredBusinessGroups}
          loading={loading}
          totalRecords={totalResults}
          recordsPerPage={recordsPerPage}
          currentPage={currentPage}
          totalPages={totalPages}
          filters={filterOptions}
          onPageChange={handlePageChange}
          onRecordsPerPageChange={(perPage) => {
            setRecordsPerPage(perPage);
            setCurrentPage(1);
            currentPageRef.current = 1;
            fetchBusinessGroups(1, perPage, searchTerm, filters);
          }}
          onSearch={handleSearch}
          searchValue={searchTerm}
          searchPlaceholder="Search"
          renderRow={(businessGroup) => (
            <tr key={businessGroup._id} className="border-t border-gray-100">
              <td className="py-3 px-4">{businessGroup.companyName || "-"}</td>
              <td className="py-3 px-4">{businessGroup.subdomain || "-"}</td>
              <td className="py-3 px-4">
                {businessGroup.registrationNumber || "-"}
              </td>
              <td className="py-3 px-4">{businessGroup.email || "-"}</td>
              <td className="py-3 px-4">{businessGroup.phone || "-"}</td>
              <td className="py-3 px-4">{businessGroup.city || "-"}</td>
              <td className="py-3 px-4">{businessGroup.state || "-"}</td>
              <td className="py-3 px-4">
                {businessGroup.website ? (
                  <a
                    href={businessGroup.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {businessGroup.website}
                  </a>
                ) : (
                  "-"
                )}
              </td>
              <td className="py-3 px-4">
                <div className="flex gap-3">
                  <ActionButtons
                    items={[
                      ...(routePerms.canViewDetails
                        ? [
                            {
                              action: ACTION_BUTTON_TYPES.VIEW,
                              title: "View",
                              onClick: () =>
                                handleViewBusinessGroup(businessGroup._id),
                            },
                          ]
                        : []),
                      ...(routePerms.canUpdate
                        ? [
                            {
                              action: ACTION_BUTTON_TYPES.EDIT,
                              title: "Edit",
                              onClick: () =>
                                handleEditBusinessGroup(businessGroup._id),
                            },
                          ]
                        : []),
                      ...(routePerms.canDelete
                        ? [
                            {
                              action: ACTION_BUTTON_TYPES.DELETE,
                              title: "Delete",
                              onClick: () =>
                                openDeleteBusinessGroup(businessGroup),
                            },
                          ]
                        : []),
                    ]}
                  />
                </div>
              </td>
            </tr>
          )}
        />
      </div>

      <CustomModal
        open={deleteModalOpen}
        onClose={closeDeleteModal}
        title="Delete business group"
        width="440px"
        showActions
        actions={[
          { label: "Cancel", secondary: true, onClick: closeDeleteModal },
          {
            label: deleteLoading ? "Deleting…" : "Delete",
            failure: true,
            disabled: deleteLoading,
            onClick: confirmDeleteBusinessGroup,
          },
        ]}
      >
        {businessGroupToDelete && (
          <p className="text-sm text-gray-700">
            Are you sure you want to delete{" "}
            <span className="font-semibold">
              {businessGroupToDelete.companyName || "this business group"}
            </span>
            ? This cannot be undone.
          </p>
        )}
      </CustomModal>
      </div>
    </RouteActionGate>
  );
};

export default BusinessGroupListScreen;
