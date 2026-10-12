import { useState, useEffect, useContext, useMemo } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { useLocation } from "react-router-dom";
import { AdminContext } from "@/context/AdminContext";
import ToggleSwitch from "@/components/toggle/ToggleSwitch";
import { notifyError } from "@/utils/toast";
import { useTableSorting } from "@/utils/tableSorting.jsx";
import AddBranchLocationModal from "./AddBranchLocationModal";
import { useSettingsCrudPermissions } from "@/hooks/useSettingsCrudPermissions";
import { ActionButtons, Loader } from "@/page-layouts";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";
import EpcListPage from "@/components/Epc/EpcListPage";
import Button from "@/customer/components/ui/Button";
import { PlusIcon } from "@/customer/components/ui/icons";

const BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;

const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm }) => {
  const { t } = useTranslation();
  const thr = (key, fallback, options) =>
    t(`settingsPage.hr.${key}`, { defaultValue: fallback, ...options });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-[350px] max-w-[90%]">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {thr("areYouSure", "Are you sure?")}
        </h2>
        <p className="text-sm text-gray-600">
          {thr(
            "deleteConfirmItem",
            "Do you really want to delete this item? This action cannot be undone."
          )}
        </p>

        <div className="flex justify-end mt-6 space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-colors"
          >
            {thr("cancel", "Cancel")}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            {thr("delete", "Delete")}
          </button>
        </div>
      </div>
    </div>
  );
};

const EstimatesPage = () => {
  const { t } = useTranslation();
  const thr = (key, fallback, options) =>
    t(`settingsPage.hr.${key}`, { defaultValue: fallback, ...options });

  const [activeTab, setActiveTab] = useState("Branches");
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState(null);

  const [organization, setOrganization] = useState(null);
  const [isOrgLoaded, setIsOrgLoaded] = useState(false);
  const location = useLocation();
  const { canAdd, canUpdate, canDelete } = useSettingsCrudPermissions();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(() => {
    try {
      const c = localStorage.getItem("configurations");
      if (c) {
        const parsed = JSON.parse(c);
        const p = parsed && parsed.table_entries_per_page;
        if (Number.isFinite(p) && p > 0) return Number(p);
      }
    } catch (_) {}
    return 10;
  });

  const { sortedData } = useTableSorting(items);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const selectedOrg = searchParams.get("selectedOrg");

    if (selectedOrg) {
      setOrganization(selectedOrg);
    }

    setIsOrgLoaded(true);
  }, [location]);

  useEffect(() => {
    if (isOrgLoaded && organization) {
      fetchItems(activeTab, organization);
    }
  }, [activeTab, organization, isOrgLoaded]);

  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo.token}`,
  };

  const handleAddNew = () => {
    if (!canAdd) return;
    setEditItem(null);
    setModalOpen(true);
  };

  const handleEdit = (item) => {
    if (!canUpdate) return;
    setEditItem(item);
    setModalOpen(true);
  };

  const handleSubmit = async (item) => {
    if ((editItem && !canUpdate) || (!editItem && !canAdd)) return;
    try {
      if (editItem) {
        let payload = {
          name: item.name,
          status: item.status,
          areaName: item.areaName || "",
          attendanceRadiusMeters:
            item.attendanceRadiusMeters === "" ||
            item.attendanceRadiusMeters == null
              ? 200
              : Number(item.attendanceRadiusMeters),
          googleLocation: {
            lat: item.googleLocation?.lat ?? "",
            lng: item.googleLocation?.lng ?? "",
            placeId: item.googleLocation?.placeId || "",
            formattedAddress: item.googleLocation?.formattedAddress || "",
            city: item.googleLocation?.city || "",
            state: item.googleLocation?.state || "",
            country: item.googleLocation?.country || "",
            postalCode: item.googleLocation?.postalCode || "",
          },
          business_id: organization,
        };
        await axios.put(
          `${BASE_URL}/branches/update/${editItem._id}`,
          payload,
          { headers }
        );
        fetchItems(activeTab, organization);
      } else {
        let payload = {
          name: item.name,
          status: item.status,
          areaName: item.areaName || "",
          attendanceRadiusMeters:
            item.attendanceRadiusMeters === "" ||
            item.attendanceRadiusMeters == null
              ? 200
              : Number(item.attendanceRadiusMeters),
          googleLocation: {
            lat: item.googleLocation?.lat ?? "",
            lng: item.googleLocation?.lng ?? "",
            placeId: item.googleLocation?.placeId || "",
            formattedAddress: item.googleLocation?.formattedAddress || "",
            city: item.googleLocation?.city || "",
            state: item.googleLocation?.state || "",
            country: item.googleLocation?.country || "",
            postalCode: item.googleLocation?.postalCode || "",
          },
          business_id: organization,
        };
        await axios.post(`${BASE_URL}/branches/add`, payload, {
          headers,
        });
        fetchItems(activeTab, organization);
      }
      setModalOpen(false);
      setActiveTab((prevTab) => prevTab);
    } catch (err) {
      console.error("Failed to save item", err);
      notifyError(err.response.data.error);
    }
  };

  const fetchItems = async (ActiveTab, selectedOrg) => {
    if (!selectedOrg) return;
    setLoading(true);
    try {
      let payload = {
        business_id: selectedOrg,
        FilterStatus: "",
        FilterName: "",
      };
      let response = await axios.post(`${BASE_URL}/branches/get_all`, payload, {
        headers,
      });
      setItems(response.data.data);
      setError(null);
    } catch (err) {
      setError(thr("fetchFailed", "Failed to fetch items"));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (_id) => {
    if (!canDelete) return;
    setDeleteItemId(_id);
    setDeleteModalOpen(true);
  };

  const handleDeleteClick = async () => {
    if (!deleteItemId) return;
    if (!canDelete) return;

    try {
      await axios.delete(`${BASE_URL}/branches/delete/${deleteItemId}`, {
        headers,
      });
      fetchItems(activeTab, organization);
    } catch (err) {
      setError(thr("deleteFailed", "Failed to delete item"));
    } finally {
      setDeleteModalOpen(false);
      setDeleteItemId(null);
    }
  };

  const handleToggleStatus = async (item) => {
    if (!canUpdate) return;
    try {
      let payload = {
        name: item.name,
        status: item.status === "Active" ? "Inactive" : "Active",
        areaName: item.areaName || "",
        attendanceRadiusMeters:
          item.attendanceRadiusMeters === "" ||
          item.attendanceRadiusMeters == null
            ? 200
            : Number(item.attendanceRadiusMeters),
        googleLocation: {
          lat: item.googleLocation?.lat ?? "",
          lng: item.googleLocation?.lng ?? "",
          placeId: item.googleLocation?.placeId || "",
          formattedAddress: item.googleLocation?.formattedAddress || "",
          city: item.googleLocation?.city || "",
          state: item.googleLocation?.state || "",
          country: item.googleLocation?.country || "",
          postalCode: item.googleLocation?.postalCode || "",
        },
        business_id: organization,
      };
      await axios.put(
        `${BASE_URL}/branches/update/${item._id}`,
        payload,
        { headers }
      );
      fetchItems(activeTab, organization);
    } catch (err) {
      setError(thr("statusUpdateFailed", "Failed to update item status"));
    }
  };

  const filteredItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return (sortedData || []).filter((item) => {
      if (statusFilter && item.status !== statusFilter) return false;
      if (!q) return true;
      const address =
        item.googleLocation?.formattedAddress || item.areaName || "";
      return (
        String(item.name || "").toLowerCase().includes(q) ||
        String(address).toLowerCase().includes(q)
      );
    });
  }, [sortedData, searchTerm, statusFilter]);

  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * recordsPerPage,
    currentPage * recordsPerPage
  );

  const columns = useMemo(
    () => [
      {
        key: "name",
        header: thr("branches.branchLocation", "Branch / Location"),
        render: (item) => (
          <>
            <div className="epc-cell__primary">{item.name}</div>
            {item.googleLocation?.formattedAddress || item.areaName ? (
              <div className="epc-cell__secondary">
                {item.googleLocation?.formattedAddress || item.areaName}
              </div>
            ) : null}
          </>
        ),
      },
      {
        key: "status",
        header: thr("status", "Status"),
        render: (item) => (
          <ToggleSwitch
            isOn={item.status === "Active"}
            handleToggle={() => handleToggleStatus(item)}
            disabled={!canUpdate}
          />
        ),
      },
      {
        key: "actions",
        header: thr("actions", "Actions"),
        align: "right",
        render: (item) => (
          <ActionButtons
            rbac={{ canUpdate, canDelete }}
            items={[
              {
                tooltip: thr("edit", "Edit"),
                action: ACTION_BUTTON_TYPES.EDIT,
                onClick: () => handleEdit(item),
              },
              {
                tooltip: thr("delete", "Delete"),
                action: ACTION_BUTTON_TYPES.DELETE,
                onClick: () => handleDelete(item._id),
              },
            ]}
          />
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, canUpdate, canDelete]
  );

  if (!isOrgLoaded && !organization) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white">
        <Loader fullContainer={true} />
      </div>
    );
  }

  if (error) {
    return <div>{thr("errorPrefix", "Error: {{error}}", { error })}</div>;
  }

  return (
    <EpcListPage
      flush
      title={thr("branches.branches", "Branches")}
      action={
        canAdd ? (
          <Button size="sm" onClick={handleAddNew}>
            <PlusIcon size={15} />
            {thr("addNew", "Add New")}
          </Button>
        ) : null
      }
      searchValue={searchTerm}
      searchPlaceholder={thr(
        "branches.searchPlaceholder",
        "Search branches..."
      )}
      onSearchChange={(value) => {
        setSearchTerm(value || "");
        setCurrentPage(1);
      }}
      filterSubtitle={thr(
        "branches.filterSubtitle",
        "Filter by status or search by name."
      )}
      filters={[
        {
          key: "status",
          placeholder: thr("selectStatus", "Select Status"),
          options: [
            { value: "Active", label: thr("active", "Active") },
            { value: "Inactive", label: thr("inactive", "Inactive") },
          ],
        },
      ]}
      filterValues={{ status: statusFilter }}
      onFilterChange={(key, value) => {
        if (key === "status") {
          setStatusFilter(value || "");
          setCurrentPage(1);
        }
      }}
      onFilterReset={() => {
        setSearchTerm("");
        setStatusFilter("");
        setCurrentPage(1);
      }}
      tableTitle={thr("branches.branches", "Branches")}
      columns={columns}
      rows={paginatedItems}
      loading={loading}
      emptyMessage={thr("noData", "No data available")}
      page={currentPage}
      pageSize={recordsPerPage}
      total={filteredItems.length}
      itemLabel="branches"
      onPageChange={setCurrentPage}
      onPageSizeChange={(perPage) => {
        setRecordsPerPage(perPage);
        setCurrentPage(1);
      }}
    >
      <AddBranchLocationModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        type={activeTab}
        item={editItem}
        onSubmit={handleSubmit}
        canSubmit={editItem ? canUpdate : canAdd}
      />
      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteClick}
      />
    </EpcListPage>
  );
};

export default EstimatesPage;
