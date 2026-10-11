import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Award,
  Building,
  ClipboardList,
  FileText,
  Layers,
  Search,
} from "lucide-react";
import {
  DataTable,
  ActionButtons,
  CustomModal,
  ToggleSwitch,
} from "@/page-layouts";
import { notifyError, notifySuccess } from "@/utils/toast";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";
import {
  isSingleAssignedBusiness,
  syncAssignedBusinessesFromApi,
} from "@/utils/sessionAssignedBusinesses";
import { useSettingsCrudPermissions } from "@/hooks/useSettingsCrudPermissions";
import useButtonColor from "@/hooks/useButtonColor";
import {
  FIELD_GROUP_META,
  FIELD_GROUP_SECTIONS,
  countByGroup,
} from "@/customer/utils/applicationFieldOptions";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const GROUP_ICONS = {
  application_purpose: ClipboardList,
  certification_type: Award,
  inspection_service: Search,
  inspection_category: Layers,
};

const EMPTY_FORM = {
  name: "",
  description: "",
  groupKey: "application_purpose",
  status: "Active",
  sortOrder: 0,
  business: "",
};

/**
 * Global Settings → Application Field Options
 * Each dropdown field gets its own panel (certification vs inspection).
 */
export default function TabApplicationFieldOptions() {
  const buttonColor = useButtonColor();
  const { canAdd, canUpdate, canDelete } = useSettingsCrudPermissions();
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [businesses, setBusinesses] = useState([]);
  const [businessId, setBusinessId] = useState("");
  const [activeGroup, setActiveGroup] = useState("application_purpose");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [rowToDelete, setRowToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const activeMeta = FIELD_GROUP_META[activeGroup] || {};
  const ActiveIcon = GROUP_ICONS[activeGroup] || ClipboardList;
  const groupCounts = useMemo(() => countByGroup(allRows), [allRows]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await syncAssignedBusinessesFromApi(Base_URL);
      if (cancelled) return;
      setBusinesses(list || []);
      if (list?.length) {
        setBusinessId(String(list[0]._id || list[0].id || ""));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadAll = async () => {
    if (!businessId) {
      setAllRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await axios.get(`${Base_URL}/application-field-options`, {
        params: {
          businessIds: JSON.stringify([businessId]),
          limit: 200,
        },
      });
      setAllRows(Array.isArray(res?.data?.data) ? res.data.data : []);
    } catch (err) {
      setAllRows([]);
      notifyError(
        err?.response?.data?.message || "Failed to load field options"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!businessId) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const filteredRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return allRows
      .filter((row) => row.groupKey === activeGroup)
      .filter((row) =>
        statusFilter === "all" ? true : row.status === statusFilter
      )
      .filter((row) =>
        q ? String(row.name || "").toLowerCase().includes(q) : true
      )
      .sort(
        (a, b) =>
          (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
          String(a.name || "").localeCompare(String(b.name || ""))
      );
  }, [allRows, activeGroup, statusFilter, searchTerm]);

  const openCreate = () => {
    setEditing(null);
    setErrors({});
    setForm({
      ...EMPTY_FORM,
      business: businessId,
      groupKey: activeGroup,
      sortOrder: (groupCounts[activeGroup]?.total || 0) + 1,
    });
    setModalOpen(true);
  };

  const openEdit = (row) => {
    if (!canUpdate) return;
    setEditing(row);
    setErrors({});
    setForm({
      name: row.name || "",
      description: row.description || "",
      groupKey: row.groupKey || activeGroup,
      status: row.status || "Active",
      sortOrder: row.sortOrder ?? 0,
      business: String(row.business || businessId),
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditing(null);
    setErrors({});
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name] || errors.form) {
      setErrors((prev) => ({ ...prev, [name]: "", form: "" }));
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setErrors({ name: "Option name is required" });
      return;
    }
    if (!form.business) {
      setErrors({ form: "Business is required" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        description: String(form.description || "").trim(),
        sortOrder: Number(form.sortOrder) || 0,
      };
      if (editing?._id) {
        await axios.put(
          `${Base_URL}/application-field-options/${editing._id}`,
          payload
        );
        notifySuccess("Option updated");
      } else {
        await axios.post(`${Base_URL}/application-field-options`, payload);
        notifySuccess("Option created");
      }
      setModalOpen(false);
      setEditing(null);
      await loadAll();
    } catch (err) {
      setErrors({
        form: err?.response?.data?.message || "Failed to save option",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (row) => {
    if (!canUpdate) return;
    const next = row.status === "Active" ? "Inactive" : "Active";
    try {
      await axios.patch(
        `${Base_URL}/application-field-options/${row._id}/status`,
        { status: next }
      );
      notifySuccess(`Marked ${next}`);
      await loadAll();
    } catch (err) {
      notifyError(err?.response?.data?.message || "Failed to update status");
    }
  };

  const openDeleteModal = (row) => {
    if (!canDelete) return;
    setRowToDelete(row);
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    if (deleteLoading) return;
    setDeleteModalOpen(false);
    setRowToDelete(null);
  };

  const confirmDelete = async () => {
    if (!rowToDelete?._id) return;
    try {
      setDeleteLoading(true);
      await axios.delete(
        `${Base_URL}/application-field-options/${rowToDelete._id}`
      );
      notifySuccess("Option deleted");
      setDeleteModalOpen(false);
      setRowToDelete(null);
      await loadAll();
    } catch (err) {
      notifyError(err?.response?.data?.message || "Failed to delete");
    } finally {
      setDeleteLoading(false);
    }
  };

  const selectGroup = (groupKey) => {
    setActiveGroup(groupKey);
    setSearchTerm("");
    setStatusFilter("all");
  };

  const filters = useMemo(
    () => [
      ...(!isSingleAssignedBusiness()
        ? [
            {
              label: "Business",
              value: businessId,
              onChange: setBusinessId,
              options: businesses.map((b) => ({
                value: String(b._id || b.id || ""),
                label: b.name || b.businessName || "Business",
              })),
              placeholder: "Select Business",
              icon: Building,
            },
          ]
        : []),
      {
        label: "Status",
        value: statusFilter,
        onChange: setStatusFilter,
        options: [
          { value: "all", label: "All Status" },
          { value: "Active", label: "Active" },
          { value: "Inactive", label: "Inactive" },
        ],
        placeholder: "Select Status",
        icon: FileText,
      },
    ],
    [businessId, businesses, statusFilter]
  );

  const modalTitle = editing
    ? `Edit ${activeMeta.label || "Option"}`
    : `Add ${activeMeta.label || "Option"}`;

  return (
    <div className="w-full max-w-full min-w-0 overflow-x-hidden">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          Application Field Options
        </h2>
        <p className="text-gray-600 mt-2">
          Manage dropdown values separately for each certification and
          inspection form field.
        </p>
      </div>

      {!isSingleAssignedBusiness() && businesses.length > 1 ? (
        <div className="mb-6 max-w-xs">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Business
          </label>
          <select
            value={businessId}
            onChange={(e) => setBusinessId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
          >
            {businesses.map((b) => (
              <option key={b._id || b.id} value={String(b._id || b.id || "")}>
                {b.name || b.businessName || "Business"}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="flex flex-col xl:flex-row gap-6 min-h-[520px]">
        {/* Left — field type navigation */}
        <aside className="xl:w-72 shrink-0 space-y-5">
          {FIELD_GROUP_SECTIONS.map((section) => (
            <div
              key={section.title}
              className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm"
            >
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {section.title}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{section.subtitle}</p>
              </div>
              <nav className="p-2 space-y-1">
                {section.groupKeys.map((groupKey) => {
                  const meta = FIELD_GROUP_META[groupKey];
                  const Icon = GROUP_ICONS[groupKey] || ClipboardList;
                  const counts = groupCounts[groupKey] || { total: 0, active: 0 };
                  const isActive = activeGroup === groupKey;

                  return (
                    <button
                      key={groupKey}
                      type="button"
                      onClick={() => selectGroup(groupKey)}
                      className={`w-full text-left rounded-lg px-3 py-3 transition-all border ${
                        isActive
                          ? "border-[var(--p-blue)] bg-[rgba(var(--p-blue-rgb),0.1)] shadow-sm"
                          : "border-transparent hover:bg-gray-50 hover:border-gray-200"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                            isActive ? "text-white" : "bg-gray-100 text-gray-600"
                          }`}
                          style={
                            isActive ? { backgroundColor: buttonColor } : undefined
                          }
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span
                              className={`text-sm font-semibold truncate ${
                                isActive ? "" : "text-gray-900"
                              }`}
                              style={isActive ? { color: buttonColor } : undefined}
                            >
                              {meta?.label || groupKey}
                            </span>
                            <span className="shrink-0 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                              {counts.active}/{counts.total}
                            </span>
                          </span>
                          <span className="block text-xs text-gray-500 mt-1 line-clamp-2">
                            {meta?.wizardStep}
                          </span>
                        </span>
                      </div>
                    </button>
                  );
                })}
              </nav>
            </div>
          ))}
        </aside>

        {/* Right — selected field panel */}
        <section className="flex-1 min-w-0 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex items-start gap-4">
                <span
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
                  style={{ backgroundColor: buttonColor }}
                >
                  <ActiveIcon className="h-6 w-6" />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-bold text-gray-900">
                      {activeMeta.label}
                    </h3>
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">
                      {activeMeta.service}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {activeMeta.description}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Wizard step:{" "}
                    <span className="font-medium">{activeMeta.wizardStep}</span>
                  </p>
                </div>
              </div>
              {canAdd ? (
                <button
                  type="button"
                  onClick={openCreate}
                  className="shrink-0 flex items-center gap-2 px-5 py-2.5 text-white rounded-lg hover:opacity-90 transition-opacity shadow-sm text-sm font-medium"
                  style={{ backgroundColor: buttonColor }}
                >
                  Add {activeMeta.label}
                </button>
              ) : null}
            </div>
          </div>

          <div className="p-4 sm:p-6">
            <DataTable
              onSearch={setSearchTerm}
              searchValue={searchTerm}
              searchPlaceholder={`Search ${activeMeta.label?.toLowerCase() || "options"}…`}
              filters={filters}
              headers={["Name", "Order", "Status", "Actions"]}
              headersToHide={[]}
              data={filteredRows}
              totalRecords={filteredRows.length}
              loading={loading}
              currentPage={1}
              totalPages={1}
              recordsPerPage={filteredRows.length || 10}
              onPageChange={() => {}}
              onRecordsPerPageChange={() => {}}
              emptyMessage={`No ${activeMeta.label?.toLowerCase() || "options"} configured yet`}
              isCollapsible={false}
              renderRow={(row) => (
                <tr key={row._id} className="border-b">
                  <td className="py-2 px-4">
                    <div className="font-medium text-gray-900">
                      {row.name || "-"}
                    </div>
                    {row.description ? (
                      <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                        {row.description}
                      </div>
                    ) : null}
                  </td>
                  <td className="py-2 px-4 whitespace-nowrap">
                    {row.sortOrder ?? 0}
                  </td>
                  <td className="py-2 px-4 whitespace-nowrap">
                    {canUpdate ? (
                      <div className="flex items-center gap-2">
                        <ToggleSwitch
                          isOn={row.status === "Active"}
                          handleToggle={() => handleToggleStatus(row)}
                          disabled={loading}
                        />
                        <span className="text-sm text-gray-600">
                          {row.status || "-"}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-600">
                        {row.status || "-"}
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-4" style={{ width: "fit-content" }}>
                    <ActionButtons
                      items={[
                        ...(canUpdate
                          ? [
                              {
                                action: ACTION_BUTTON_TYPES.EDIT,
                                title: "Edit",
                                onClick: () => openEdit(row),
                              },
                            ]
                          : []),
                        ...(canDelete
                          ? [
                              {
                                action: ACTION_BUTTON_TYPES.DELETE,
                                title: "Delete",
                                onClick: () => openDeleteModal(row),
                              },
                            ]
                          : []),
                      ]}
                    />
                  </td>
                </tr>
              )}
            />
          </div>
        </section>
      </div>

      <CustomModal
        open={modalOpen}
        onClose={closeModal}
        title={modalTitle}
        width="520px"
        showActions
        actions={[
          {
            label: "Cancel",
            secondary: true,
            onClick: closeModal,
            disabled: saving,
          },
          {
            label: saving ? "Saving…" : "Save",
            primary: true,
            onClick: handleSave,
            disabled: saving,
            style: { backgroundColor: buttonColor },
          },
        ]}
      >
        <div className="space-y-4 text-sm">
          {errors.form ? (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded">
              {errors.form}
            </div>
          ) : null}

          <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Field
            </p>
            <p className="text-sm font-semibold text-gray-900 mt-0.5">
              {FIELD_GROUP_META[form.groupKey]?.label || form.groupKey}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {FIELD_GROUP_META[form.groupKey]?.service} ·{" "}
              {FIELD_GROUP_META[form.groupKey]?.wizardStep}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[rgba(var(--p-blue-rgb),0.3)] ${
                errors.name ? "border-red-500" : "border-gray-300"
              }`}
              placeholder={`e.g. ${activeMeta.label} option`}
            />
            {errors.name ? (
              <p className="text-red-500 text-xs mt-1">{errors.name}</p>
            ) : null}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              name="description"
              rows={2}
              value={form.description}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[rgba(var(--p-blue-rgb),0.3)]"
              placeholder="Optional help text for the customer portal"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sort order
              </label>
              <input
                type="number"
                name="sortOrder"
                value={form.sortOrder}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <div className="flex items-center gap-2 mt-2">
                <ToggleSwitch
                  isOn={form.status === "Active"}
                  handleToggle={() =>
                    setForm((prev) => ({
                      ...prev,
                      status: prev.status === "Active" ? "Inactive" : "Active",
                    }))
                  }
                />
                <span className="text-sm text-gray-700">
                  {form.status === "Active" ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CustomModal>

      <CustomModal
        open={deleteModalOpen}
        onClose={closeDeleteModal}
        title={`Delete ${activeMeta.label || "Option"}`}
        width="440px"
        showActions
        actions={[
          {
            label: "Cancel",
            secondary: true,
            onClick: closeDeleteModal,
            disabled: deleteLoading,
          },
          {
            label: deleteLoading ? "Deleting…" : "Delete",
            failure: true,
            disabled: deleteLoading,
            onClick: confirmDelete,
          },
        ]}
      >
        {rowToDelete ? (
          <p className="text-sm text-gray-700">
            Are you sure you want to delete{" "}
            <span className="font-semibold">{rowToDelete.name || "-"}</span> from{" "}
            <span className="font-semibold">{activeMeta.label}</span>? This action
            cannot be undone.
          </p>
        ) : null}
      </CustomModal>
    </div>
  );
}
