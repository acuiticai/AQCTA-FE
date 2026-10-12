import { useState, useEffect, useContext, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import axios from "axios";
import { useLocation } from "react-router-dom";
import { AdminContext } from "@/context/AdminContext";
import ToggleSwitch from "@/components/toggle/ToggleSwitch";
import ReactSelect from "react-select";
import reactSelectConfig from "@/utils/react-select-style-config";
import { ActionButtons, Loader } from "@/page-layouts";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";
import { useSettingsCrudPermissions } from "@/hooks/useSettingsCrudPermissions";
import EpcListPage from "@/components/Epc/EpcListPage";
import Button from "@/customer/components/ui/Button";
import { PlusIcon } from "@/customer/components/ui/icons";

const BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;

const AddEditModal = ({ isOpen, onClose, type, item, staffList, onSubmit, canSubmit }) => {
  const { t } = useTranslation();
  const thr = (key, fallback, options) =>
    t(`settingsPage.hr.${key}`, { defaultValue: fallback, ...options });

  const [formData, setFormData] = useState({
    _id: "",
    name: "",
    manager: { _id: "", displayName: "" },
    code: "",
    status: "Active",
  });

  useEffect(() => {
    if (item) {
      setFormData({
        _id: item._id || "",
        name: item.name || "",
        manager: item?.manager,
        code: item.code || "",
        status: item.status || "Active",
      });
    } else {
      setFormData({
        _id: "",
        name: "",
        manager: { name: "", _id: "" },
        code: "",
        status: "Active",
      });
    }
  }, [item, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({ ...prevData, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  if (!isOpen) return null;

  const departmentNameLabel = thr("departments.departmentName", "Department Name");
  const departmentCodeLabel = thr("departments.departmentCode", "Department Code");

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-[400px] max-w-[90%]">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">
            {item
              ? thr("modalEditTitle", "Edit {{type}}", { type })
              : thr("modalAddTitle", "Add New {{type}}", { type })}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {departmentNameLabel} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              placeholder={departmentNameLabel}
              value={formData.name}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#A6C437] focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {departmentCodeLabel} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="code"
              placeholder={departmentCodeLabel}
              value={formData.code}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#A6C437] focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {thr("departments.departmentManager", "Department Manager")}
            </label>
            <ReactSelect
              value={
                formData.manager
                  ? staffList.find(
                      (option) => option._id === formData.manager._id
                    )
                  : null
              }
              onChange={(selectedOption) =>
                setFormData((prev) => ({
                  ...prev,
                  manager: selectedOption
                    ? {
                        _id: selectedOption._id,
                        displayName: selectedOption.displayName,
                      }
                    : "",
                }))
              }
              placeholder={thr(
                "departments.selectDepartmentManager",
                "Select Department Manager",
              )}
              options={staffList}
              getOptionLabel={(e) => e.displayName}
              getOptionValue={(e) => e._id}
              className="react-select-container"
              classNamePrefix="react-select"
              isSearchable
              menuPlacement="auto"
              styles={{
                ...reactSelectConfig,
                control: (base, state) => ({
                  ...(reactSelectConfig.control?.(base, state) || base),
                  backgroundColor: "#ffffff",
                  borderColor: "#d1d5db",
                  borderWidth: "1px",
                }),
              }}
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 bg-[#A6C437] text-white rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!canSubmit}
            >
              {item
                ? thr("modalUpdateBtn", "Update {{type}}", { type })
                : thr("modalAddBtn", "Add {{type}}", { type })}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

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
            "Do you really want to delete this item? This action cannot be undone.",
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

  const [activeTab, setActiveTab] = useState("Department");
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
  const [staffOptions, setStaffOptions] = useState([]);
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
          manager: item?.manager,
          code: item.code,
          status: item.status,
          business_id: organization,
        };

        await axios.put(
          `${BASE_URL}/Departments/update/${editItem._id}`,
          payload,
          { headers }
        );
        fetchItems(activeTab, organization);
      } else {
        let payload = {
          name: item.name,
          code: item.code,
          manager: item?.manager,
          status: item.status,
          business_id: organization,
        };
        await axios.post(
          `${BASE_URL}/Departments/add`,
          payload,
          { headers }
        );
        fetchItems(activeTab, organization);
      }
      setModalOpen(false);
      setActiveTab((prevTab) => prevTab);
    } catch (err) {
      console.error("Failed to save item", err);
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
      let response = await axios.post(
        `${BASE_URL}/Departments/get_all`,
        payload,
        { headers }
      );
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
      await axios.delete(`${BASE_URL}/Departments/delete/${deleteItemId}`, {
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
        code: item.code,
        status: item.status === "Active" ? "Inactive" : "Active",
        business_id: organization,
      };
      await axios.put(
        `${BASE_URL}/Departments/update/${item._id}`,
        payload,
        { headers }
      );
      fetchItems(activeTab, organization);
    } catch (err) {
      setError(thr("statusUpdateFailed", "Failed to update item status"));
    }
  };

  const fetchStaffByFields = useCallback(
    async (fields = ["_id", "displayName"], filter = {}) => {
      try {
        const response = await axios.post(
          `${BASE_URL}/staff-management/selected-fields`,
          {
            fields,
            filter,
          },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${adminInfo?.token}`,
            },
          }
        );

        return response.data.staff || [];
      } catch (error) {
        console.error("Error fetching staff by selected fields:", error);
        return [];
      }
    },
    [adminInfo?.token]
  );

  useEffect(() => {
    const loadStaffNames = async () => {
      const response = await fetchStaffByFields(["_id", "displayName"], {
        business: organization,
      });

      setStaffOptions(response);
    };

    loadStaffNames();
  }, [fetchStaffByFields, organization]);

  const filteredItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return (items || []).filter((item) => {
      if (statusFilter && item.status !== statusFilter) return false;
      if (!q) return true;
      return (
        String(item.name || "").toLowerCase().includes(q) ||
        String(item.code || "").toLowerCase().includes(q) ||
        String(item.manager?.displayName || "").toLowerCase().includes(q)
      );
    });
  }, [items, searchTerm, statusFilter]);

  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * recordsPerPage,
    currentPage * recordsPerPage
  );

  const columns = useMemo(
    () => [
      {
        key: "name",
        header: thr("departments.departmentName", "Department Name"),
        render: (item) => (
          <span className="epc-cell__primary">{item.name}</span>
        ),
      },
      {
        key: "code",
        header: thr("departments.departmentCode", "Department Code"),
        render: (item) => item.code || "—",
      },
      {
        key: "manager",
        header: thr(
          "departments.directManagerSupervisor",
          "Direct Manager / Supervisor"
        ),
        render: (item) =>
          item.manager?.displayName ? (
            item.manager.displayName
          ) : (
            <span className="epc-cell__secondary">—</span>
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
      title={thr("departmentsPositions.departments", "Departments")}
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
        "departments.searchPlaceholder",
        "Search departments..."
      )}
      onSearchChange={(value) => {
        setSearchTerm(value || "");
        setCurrentPage(1);
      }}
      filterSubtitle={thr(
        "departments.filterSubtitle",
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
      tableTitle={thr("departmentsPositions.departments", "Departments")}
      columns={columns}
      rows={paginatedItems}
      loading={loading}
      emptyMessage={thr("noData", "No data available")}
      page={currentPage}
      pageSize={recordsPerPage}
      total={filteredItems.length}
      itemLabel="departments"
      onPageChange={setCurrentPage}
      onPageSizeChange={(perPage) => {
        setRecordsPerPage(perPage);
        setCurrentPage(1);
      }}
    >
      <AddEditModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        type={activeTab}
        organization={organization}
        staffList={staffOptions}
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
