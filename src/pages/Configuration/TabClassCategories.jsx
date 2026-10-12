import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  ActionButtons,
  SummaryCards,
  CustomModal,
  ToggleSwitch,
} from "@/page-layouts";
import { EpcPage } from "@/components/Epc/EpcSurface";
import FilterBar from "@/customer/components/ui/FilterBar";
import { Card, CardHeader } from "@/customer/components/ui/Card";
import PortalDataTable from "@/customer/components/ui/DataTable";
import Pagination from "@/customer/components/ui/Pagination";
import Button from "@/customer/components/ui/Button";
import StatusPill from "@/customer/components/ui/StatusPill";
import { PlusIcon } from "@/customer/components/ui/icons";
import { notifyError, notifySuccess } from "@/utils/toast";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";
import {
  isSingleAssignedBusiness,
  syncAssignedBusinessesFromApi,
} from "@/utils/sessionAssignedBusinesses";
import { useSettingsCrudPermissions } from "@/hooks/useSettingsCrudPermissions";
import useButtonColor from "@/hooks/useButtonColor";
import SummarySvg from "@/assets/img/summary.svg";
import CompletedSvg from "@/assets/img/completed.svg";
import InProgressSvg from "@/assets/img/in-progress.svg";
import CategoryProductFieldsEditor from "@/pages/Categories/CategoryProductFieldsEditor";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const EMPTY_FORM = {
  name: "",
  description: "",
  status: "Active",
  business: "",
};

/**
 * Settings → Applications → Class/Category
 * Application wizard class/categories and per-category product fields.
 */
export default function TabClassCategories() {
  const buttonColor = useButtonColor();
  const { canAdd, canUpdate, canDelete } = useSettingsCrudPermissions();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [businesses, setBusinesses] = useState([]);
  const [businessId, setBusinessId] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    withFields: 0,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [productFields, setProductFields] = useState([]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [rowToDelete, setRowToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

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

  const load = async () => {
    if (!businessId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(recordsPerPage),
        businessId,
        purpose: "application_class",
      });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (searchTerm.trim()) params.set("search", searchTerm.trim());

      const res = await axios.get(`${Base_URL}/categories?${params.toString()}`);
      const categories = res.data?.categories || res.data || [];
      const totalCount = res.data?.total ?? categories.length;
      setRows(categories);
      setTotal(totalCount);
    } catch (err) {
      notifyError(err?.response?.data?.message || "Failed to load class/categories");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    if (!businessId) {
      setStats({ total: 0, active: 0, inactive: 0, withFields: 0 });
      return;
    }
    try {
      const res = await axios.get(
        `${Base_URL}/categories?businessId=${businessId}&purpose=application_class`,
      );
      const list = res.data?.categories || res.data || [];
      const active = list.filter((r) => r.status === "Active").length;
      const withFields = list.filter(
        (r) => Array.isArray(r.productFields) && r.productFields.length > 0,
      ).length;
      setStats({
        total: list.length,
        active,
        inactive: list.length - active,
        withFields,
      });
    } catch {
      setStats({ total: 0, active: 0, inactive: 0, withFields: 0 });
    }
  };

  useEffect(() => {
    if (!businessId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, statusFilter, currentPage, recordsPerPage]);

  useEffect(() => {
    if (!businessId) return;
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  useEffect(() => {
    if (!businessId) return;
    const timeoutId = setTimeout(() => {
      setCurrentPage(1);
      load();
    }, 400);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  const openCreate = () => {
    setEditing(null);
    setErrors({});
    setProductFields([]);
    setForm({ ...EMPTY_FORM, business: businessId });
    setModalOpen(true);
  };

  const openEdit = async (row) => {
    if (!canUpdate) return;
    setErrors({});
    setEditing(row);
    setForm({
      name: row.name || "",
      description: row.description || "",
      status: row.status || "Active",
      business: String(row.business?._id || row.business || businessId),
    });
    setProductFields(
      Array.isArray(row.productFields) ? row.productFields : [],
    );
    setModalOpen(true);

    if (row._id && !Array.isArray(row.productFields)) {
      try {
        const res = await axios.get(`${Base_URL}/categories/${row._id}`);
        const data = res.data;
        setProductFields(
          Array.isArray(data?.productFields) ? data.productFields : [],
        );
      } catch {
        /* keep list payload */
      }
    }
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditing(null);
    setErrors({});
    setProductFields([]);
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
      setErrors({ name: "Class / Category name is required" });
      return;
    }
    if (!form.business) {
      setErrors({ form: "Business is required" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        business: form.business,
        name: form.name.trim(),
        description: String(form.description || "").trim(),
        status: form.status || "Active",
        purpose: "application_class",
        productFields,
      };

      if (editing?._id) {
        await axios.put(`${Base_URL}/categories/${editing._id}`, payload);
        notifySuccess("Class / Category updated");
      } else {
        await axios.post(`${Base_URL}/categories`, payload);
        notifySuccess("Class / Category created");
      }
      setModalOpen(false);
      setEditing(null);
      setProductFields([]);
      await Promise.all([load(), loadStats()]);
    } catch (err) {
      setErrors({
        form:
          err?.response?.data?.message || "Failed to save class / category",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (row) => {
    if (!canUpdate) return;
    const next = row.status === "Active" ? "Inactive" : "Active";
    try {
      await axios.patch(`${Base_URL}/categories/${row._id}/status`, {
        status: next,
      });
      notifySuccess(`Marked ${next}`);
      await Promise.all([load(), loadStats()]);
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
      await axios.delete(`${Base_URL}/categories/${rowToDelete._id}`);
      notifySuccess("Class / Category deleted");
      setDeleteModalOpen(false);
      setRowToDelete(null);
      await Promise.all([load(), loadStats()]);
    } catch (err) {
      notifyError(err?.response?.data?.message || "Failed to delete");
    } finally {
      setDeleteLoading(false);
    }
  };

  const clearAllFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setBusinessId(
      businesses.length === 1
        ? String(businesses[0]._id || businesses[0].id || "")
        : businessId,
    );
    setCurrentPage(1);
  };

  const portalFilters = useMemo(
    () => [
      ...(!isSingleAssignedBusiness()
        ? [
            {
              key: "business",
              placeholder: "Select Business",
              options: businesses.map((b) => ({
                value: String(b._id || b.id || ""),
                label: b.name || b.businessName || "Business",
              })),
            },
          ]
        : []),
      {
        key: "status",
        placeholder: "All Statuses",
        options: ["Active", "Inactive"],
      },
    ],
    [businesses],
  );

  const summaryCardsData = [
    {
      title: "Total",
      value: stats.total,
      backgroundColor: "summary-light",
      iconColor: "summary-dark",
      Icon: SummarySvg,
    },
    {
      title: "Active",
      value: stats.active,
      backgroundColor: "completed-light",
      iconColor: "completed-dark",
      Icon: CompletedSvg,
    },
    {
      title: "Inactive",
      value: stats.inactive,
      backgroundColor: "processing-light",
      iconColor: "processing-dark",
      Icon: InProgressSvg,
    },
    {
      title: "With product fields",
      value: stats.withFields,
      backgroundColor: "summary-light",
      iconColor: "summary-dark",
      Icon: SummarySvg,
    },
  ];

  const columns = useMemo(
    () => [
      {
        key: "name",
        header: "Name",
        render: (row) => (
          <>
            <div className="epc-cell__primary">{row.name || "—"}</div>
            {row.description ? (
              <div className="epc-cell__secondary">{row.description}</div>
            ) : null}
          </>
        ),
      },
      {
        key: "productFields",
        header: "Product fields",
        render: (row) =>
          Array.isArray(row.productFields) ? row.productFields.length : 0,
      },
      {
        key: "status",
        header: "Status",
        render: (row) =>
          canUpdate ? (
            <div className="flex items-center gap-2">
              <ToggleSwitch
                isOn={row.status === "Active"}
                handleToggle={() => handleToggleStatus(row)}
                disabled={loading}
              />
              <StatusPill status={row.status || "—"} />
            </div>
          ) : (
            <StatusPill status={row.status || "—"} />
          ),
      },
      {
        key: "actions",
        header: "Actions",
        align: "right",
        render: (row) => (
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
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canUpdate, canDelete, loading],
  );

  return (
    <EpcPage
      flush
      title="Class / Category"
      subtitle="Manage application class/categories and their product fields shown on the Product Details step in certification and inspection applications (admin and customer portal)."
      action={
        canAdd ? (
          <Button size="sm" onClick={openCreate}>
            <PlusIcon size={15} />
            Add Class / Category
          </Button>
        ) : null
      }
    >
      <SummaryCards cards={summaryCardsData} columnsCount={4} />

      <FilterBar
        subtitle="Narrow by business, status or name."
        searchPlaceholder="Search by name…"
        searchValue={searchTerm}
        onSearchChange={(value) => {
          setSearchTerm(value);
          setCurrentPage(1);
        }}
        values={{
          business: businessId || "",
          status: statusFilter === "all" ? "" : statusFilter,
        }}
        onChange={(key, value) => {
          if (key === "business") {
            setBusinessId(value || "");
            setCurrentPage(1);
            return;
          }
          if (key === "status") {
            setStatusFilter(value || "all");
            setCurrentPage(1);
          }
        }}
        onReset={clearAllFilters}
        filters={portalFilters}
      />

      <Card>
        <CardHeader
          title="Class / Category"
          subtitle={loading ? "Loading…" : `${total} total`}
          action={
            <span className="epc-chip">
              {stats.active} active · {stats.withFields} with fields
            </span>
          }
        />
        <PortalDataTable
          columns={columns}
          rows={loading ? [] : rows}
          rowKey="_id"
          emptyMessage={
            loading ? "Loading…" : "No class/categories found"
          }
        />
        {!loading && total > 0 ? (
          <Pagination
            page={currentPage}
            pageSize={recordsPerPage}
            total={total}
            itemLabel="categories"
            onPageChange={setCurrentPage}
            onPageSizeChange={(perPage) => {
              setRecordsPerPage(perPage);
              setCurrentPage(1);
            }}
          />
        ) : null}
      </Card>

      <CustomModal
        open={modalOpen}
        onClose={closeModal}
        title={
          editing ? "Edit Class / Category" : "Add Class / Category"
        }
        width="720px"
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
        <div className="space-y-4 text-sm max-h-[70vh] overflow-y-auto pr-1">
          {errors.form ? (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded">
              {errors.form}
            </div>
          ) : null}

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
              placeholder="e.g. Electrical equipment, Pressure vessel"
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
              value={form.description}
              onChange={handleChange}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[rgba(var(--p-blue-rgb),0.3)]"
              placeholder="Optional description"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              name="status"
              value={form.status}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[rgba(var(--p-blue-rgb),0.3)]"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          <CategoryProductFieldsEditor
            fields={productFields}
            onChange={setProductFields}
            disabled={saving}
          />
        </div>
      </CustomModal>

      <CustomModal
        open={deleteModalOpen}
        onClose={closeDeleteModal}
        title="Delete Class / Category"
        width="480px"
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
            primary: true,
            onClick: confirmDelete,
            disabled: deleteLoading,
            style: { backgroundColor: "#dc2626" },
          },
        ]}
      >
        <p className="text-sm text-gray-600">
          Delete &quot;{rowToDelete?.name || "this class/category"}&quot;?
          Applications using this class may need to be updated.
        </p>
      </CustomModal>
    </EpcPage>
  );
}
