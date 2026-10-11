import React, { useState, useEffect, useMemo, useContext, useCallback } from "react";
import axios from "axios";
import { useHistory } from "react-router-dom";
import { Plus, ChevronRight, ChevronDown, MapPin, Pencil, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@windmill/react-ui";
import { notifyError, notifySuccess } from "@/utils/toast";
import { useRouteModulePermissions } from "@/utils/permissionUtils";
import RoutePermissionGate from "@/components/RoutePermissionGate";
import { syncAssignedBusinessesFromApi, isSingleAssignedBusiness, getSoleAssignedBusinessId } from "@/utils/sessionAssignedBusinesses";
import { AdminContext } from "@/context/AdminContext";
import {
  DropdownBasic,
  InputFieldWithLabel,
  InputLabel,
} from "@/page-layouts/index";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const STORAGE_KIND_OPTIONS = [
  { value: "area", label: "Area" },
  { value: "zone", label: "Zone" },
  { value: "rack", label: "Rack" },
  { value: "shelf", label: "Shelf" },
  { value: "drawer", label: "Drawer" },
  { value: "bin", label: "Bin" },
  { value: "other", label: "Other" },
];

const LOCATION_TYPE_OPTIONS = [
  { value: "internal", label: "Storage (internal)" },
  { value: "receiving", label: "Receiving" },
  { value: "delivery", label: "Delivery" },
  { value: "inventory", label: "Inventory Adjustment" },
  { value: "scrap", label: "Scrap" },
  { value: "view", label: "Container (view only)" },
];

const emptyForm = () => ({
  name: "",
  code: "",
  parentLocation: "",
  storageKind: "rack",
  locationType: "internal",
  notes: "",
  canStoreStock: true,
});

const Locations = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo?.token}`,
    }),
    [adminInfo?.token],
  );

  const { canAdd, canUpdate, canDelete } = useRouteModulePermissions();

  const tWithFallback = (key, fallback) => {
    const translated = t(key, { defaultValue: fallback });
    return translated && translated !== key ? translated : fallback;
  };

  const [businesses, setBusinesses] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [selectedBusiness, setSelectedBusiness] = useState("");
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [tree, setTree] = useState([]);
  const [flatLocations, setFlatLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(emptyForm());
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await syncAssignedBusinessesFromApi(Base_URL);
      if (!cancelled) {
        setBusinesses(list || []);
        if (list?.length === 1) setSelectedBusiness(list[0]._id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchWarehouses = useCallback(async () => {
    if (!selectedBusiness) {
      setWarehouses([]);
      setSelectedWarehouse("");
      return;
    }
    try {
      const res = await axios.get(`${Base_URL}/warehouses`, {
        headers,
        params: { businessId: selectedBusiness, status: "Active", limit: 100 },
      });
      const list = res.data?.data || [];
      setWarehouses(list);
      if (list.length && !list.find((w) => w._id === selectedWarehouse)) {
        const def = list.find((w) => w.isDefault) || list[0];
        setSelectedWarehouse(def._id);
      }
      if (!list.length) setSelectedWarehouse("");
    } catch (err) {
      notifyError(err?.response?.data?.message || "Failed to load warehouses");
    }
  }, [selectedBusiness, headers, selectedWarehouse]);

  useEffect(() => {
    fetchWarehouses();
  }, [selectedBusiness]);

  const fetchTree = useCallback(async () => {
    if (!selectedWarehouse) {
      setTree([]);
      setFlatLocations([]);
      return;
    }
    try {
      setLoading(true);
      const [treeRes, flatRes] = await Promise.all([
        axios.get(`${Base_URL}/locations`, {
          headers,
          params: { warehouseId: selectedWarehouse, tree: "true" },
        }),
        axios.get(`${Base_URL}/locations`, {
          headers,
          params: { warehouseId: selectedWarehouse },
        }),
      ]);
      setTree(treeRes.data?.data || []);
      setFlatLocations(flatRes.data?.data || []);
      // Expand root nodes by default
      const roots = treeRes.data?.data || [];
      const next = {};
      roots.forEach((r) => {
        next[r._id] = true;
      });
      setExpanded((prev) => ({ ...next, ...prev }));
    } catch (err) {
      notifyError(err?.response?.data?.message || "Failed to load locations");
      setTree([]);
    } finally {
      setLoading(false);
    }
  }, [selectedWarehouse, headers]);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  const clearFieldError = (field) => {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const openAdd = (parentId = "") => {
    setEditingId(null);
    setErrors({});
    setFormData({
      ...emptyForm(),
      parentLocation: parentId || "",
      storageKind: parentId ? "shelf" : "rack",
    });
    setModalOpen(true);
  };

  const openEdit = (loc) => {
    setEditingId(loc._id);
    setErrors({});
    setFormData({
      name: loc.name || "",
      code: loc.code || "",
      parentLocation: loc.parentLocation?._id || loc.parentLocation || "",
      storageKind: loc.storageKind || "other",
      locationType: loc.locationType || "internal",
      notes: loc.notes || "",
      canStoreStock: loc.canStoreStock !== false,
    });
    setModalOpen(true);
  };

  const validate = () => {
    const next = {};
    if (!selectedBusiness) {
      notifyError(
        tWithFallback("location.businessRequired", "Business is required"),
      );
      return false;
    }
    if (!selectedWarehouse) {
      notifyError(
        tWithFallback("location.warehouseRequired", "Warehouse is required"),
      );
      return false;
    }
    if (!formData.name?.trim()) {
      next.name = tWithFallback(
        "location.nameRequired",
        "Location name is required",
      );
    }
    if (editingId && !formData.code?.trim()) {
      next.code = tWithFallback(
        "location.codeRequired",
        "Location code is required",
      );
    }
    if (!formData.storageKind) {
      next.storageKind = tWithFallback(
        "location.storageKindRequired",
        "Place type is required",
      );
    }
    if (!formData.locationType) {
      next.locationType = tWithFallback(
        "location.locationTypeRequired",
        "Operational type is required",
      );
    }
    if (editingId && formData.parentLocation) {
      if (String(formData.parentLocation) === String(editingId)) {
        next.parentLocation = tWithFallback(
          "location.parentSelfInvalid",
          "A location cannot be its own parent",
        );
      } else if (isDescendantOf(formData.parentLocation, editingId)) {
        next.parentLocation = tWithFallback(
          "location.parentCycleInvalid",
          "Cannot set a child location as parent",
        );
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const isDescendantOf = (candidateId, ancestorId) => {
    const byId = new Map(
      flatLocations.map((l) => [String(l._id), l]),
    );
    let walk = byId.get(String(candidateId));
    const seen = new Set();
    while (walk?.parentLocation) {
      const parentId = String(
        walk.parentLocation?._id || walk.parentLocation,
      );
      if (parentId === String(ancestorId)) return true;
      if (seen.has(parentId)) break;
      seen.add(parentId);
      walk = byId.get(parentId);
    }
    return false;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        business: selectedBusiness,
        warehouse: selectedWarehouse,
        name: formData.name.trim(),
        code: formData.code.trim() || undefined,
        parentLocation: formData.parentLocation || null,
        storageKind: formData.storageKind,
        locationType: formData.locationType,
        notes: formData.notes,
        canStoreStock: formData.canStoreStock,
      };
      if (editingId) {
        await axios.put(`${Base_URL}/locations/${editingId}`, payload, {
          headers,
        });
        notifySuccess("Location updated");
      } else {
        await axios.post(`${Base_URL}/locations`, payload, { headers });
        notifySuccess("Location created");
      }
      setModalOpen(false);
      setErrors({});
      fetchTree();
    } catch (err) {
      const message =
        err?.response?.data?.message || "Failed to save location";
      const lower = String(message).toLowerCase();
      if (lower.includes("code") && (lower.includes("already") || lower.includes("empty"))) {
        setErrors((prev) => ({ ...prev, code: message }));
      } else if (
        lower.includes("name") &&
        (lower.includes("required") || lower.includes("empty"))
      ) {
        setErrors((prev) => ({
          ...prev,
          name: message,
        }));
      } else if (
        lower.includes("parent") ||
        lower.includes("cycle") ||
        lower.includes("own parent")
      ) {
        setErrors((prev) => ({ ...prev, parentLocation: message }));
      } else {
        notifyError(message);
      }
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await axios.delete(`${Base_URL}/locations/${deleteTarget._id}`, {
        headers,
      });
      notifySuccess("Location deleted");
      setDeleteTarget(null);
      fetchTree();
    } catch (err) {
      notifyError(err?.response?.data?.message || "Failed to delete location");
    } finally {
      setDeleting(false);
    }
  };

  const toggleExpand = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const kindBadge = (kind) => {
    const colors = {
      area: "bg-blue-50 text-blue-700",
      zone: "bg-indigo-50 text-indigo-700",
      rack: "bg-amber-50 text-amber-800",
      shelf: "bg-orange-50 text-orange-800",
      drawer: "bg-emerald-50 text-emerald-800",
      bin: "bg-teal-50 text-teal-800",
      other: "bg-gray-100 text-gray-700",
    };
    return colors[kind] || colors.other;
  };

  const renderNode = (node, depth = 0) => {
    const hasChildren = node.children?.length > 0;
    const isOpen = expanded[node._id];
    return (
      <div key={node._id}>
        <div
          className="flex items-center gap-2 py-2.5 px-3 border-b hover:bg-gray-50"
          style={{ paddingLeft: `${12 + depth * 20}px` }}
        >
          <button
            type="button"
            className="w-5 h-5 flex items-center justify-center text-gray-400"
            onClick={() => hasChildren && toggleExpand(node._id)}
          >
            {hasChildren ? (
              isOpen ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight size={16} />
              )
            ) : (
              <MapPin size={14} className="opacity-40" />
            )}
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-gray-900">{node.name}</span>
              <span
                className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${kindBadge(
                  node.storageKind,
                )}`}
              >
                {node.storageKind || "other"}
              </span>
              {!node.canStoreStock || node.locationType === "view" ? (
                <span className="text-[10px] text-gray-400">no stock</span>
              ) : null}
            </div>
            <div className="text-xs text-gray-500 font-mono">{node.code}</div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {canAdd && node.locationType !== "scrap" && (
              <button
                type="button"
                title={tWithFallback("location.addChild", "Add child")}
                aria-label={tWithFallback("location.addChild", "Add child")}
                className="p-1.5 rounded-md text-[var(--p-blue)] hover:bg-[var(--p-blue)]/10 transition-colors"
                onClick={() => openAdd(node._id)}
              >
                <Plus size={16} />
              </button>
            )}
            {canUpdate && (
              <button
                type="button"
                title={tWithFallback("location.edit", "Edit")}
                aria-label={tWithFallback("location.edit", "Edit")}
                className="p-1.5 rounded-md text-gray-600 hover:bg-gray-100 transition-colors"
                onClick={() => openEdit(node)}
              >
                <Pencil size={15} />
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                title={tWithFallback("location.delete", "Delete")}
                aria-label={tWithFallback("location.delete", "Delete")}
                className="p-1.5 rounded-md text-red-600 hover:bg-red-50 transition-colors"
                onClick={() => setDeleteTarget(node)}
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        </div>
        {hasChildren && isOpen
          ? node.children.map((child) => renderNode(child, depth + 1))
          : null}
      </div>
    );
  };

  const parentOptions = [
    { value: "", label: "— Top level —" },
    ...flatLocations
      .filter((l) => {
        if (!editingId) return true;
        if (String(l._id) === String(editingId)) return false;
        return !isDescendantOf(l._id, editingId);
      })
      .map((l) => ({
        value: l._id,
        label: `${l.code} — ${l.name}`,
      })),
  ];

  return (
    <RoutePermissionGate>
      <div className="bg-gray-50 min-h-screen w-full">
        <div className="w-full mx-auto px-6 py-8">
          <div className="mb-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {tWithFallback("location.title", "Locations")}
              </h1>
              <p className="text-gray-600 mt-2">
                {tWithFallback(
                  "location.description",
                  "Define where stock sits inside a warehouse — area, rack, shelf, drawer, or bin.",
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => history.push("/warehouses")}
                className="px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
              >
                Warehouses
              </button>
              <button
                type="button"
                onClick={() => history.push("/stock-levels")}
                className="px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
              >
                Stock Levels
              </button>
              {canAdd && (
                <button
                  type="button"
                  disabled={!selectedWarehouse}
                  onClick={() => openAdd("")}
                  className="flex items-center gap-2 px-6 py-3 bg-[var(--p-blue)] text-white rounded-lg disabled:opacity-50"
                >
                  <Plus size={18} />
                  {tWithFallback("location.add", "Add Location")}
                </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-gray-700">Filters</p>
              {(selectedBusiness || selectedWarehouse) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBusiness("");
                    setSelectedWarehouse("");
                  }}
                  className="inline-flex items-center gap-1 text-sm text-red-600 hover:underline"
                >
                  <X size={14} />
                  Clear filters
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {!isSingleAssignedBusiness() && <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Business
                </label>
                <DropdownBasic
                  options={[
                    { value: "", label: "Select Business" },
                    ...businesses.map((b) => ({ value: b._id, label: b.name })),
                  ]}
                  value={selectedBusiness}
                  onChange={(v) => {
                    setSelectedBusiness(v || "");
                    setSelectedWarehouse("");
                  }}
                  isClearable={false}
                />
              </div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Warehouse
                </label>
                <DropdownBasic
                  options={[
                    { value: "", label: "Select Warehouse" },
                    ...warehouses.map((w) => ({
                      value: w._id,
                      label: `${w.name} (${w.code})`,
                    })),
                  ]}
                  value={selectedWarehouse}
                  onChange={(v) => setSelectedWarehouse(v || "")}
                  isClearable={false}
                  isDisabled={!isSingleAssignedBusiness() && !selectedBusiness}
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden min-h-[320px]">
            {!selectedWarehouse ? (
              <div className="p-10 text-center text-gray-500">
                Select a business and warehouse to manage storage places.
              </div>
            ) : loading ? (
              <div className="p-10 flex justify-center">
                <div className="w-10 h-10 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
              </div>
            ) : tree.length === 0 ? (
              <div className="p-10 text-center text-gray-500">
                No locations yet. Add a rack, shelf, or drawer under this warehouse.
              </div>
            ) : (
              tree.map((node) => renderNode(node))
            )}
          </div>
        </div>

        <Modal
          isOpen={modalOpen}
          onClose={() => {
            if (!saving) {
              setModalOpen(false);
              setErrors({});
            }
          }}
        >
          <ModalHeader>
            {editingId ? "Edit Location" : "Add Location"}
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <InputFieldWithLabel
                label={tWithFallback("location.name", "Name")}
                name="name"
                required
                direction="column"
                value={formData.name}
                onChange={(e) => {
                  clearFieldError("name");
                  setFormData((p) => ({ ...p, name: e.target.value }));
                }}
                placeholder="e.g. Rack A, Shelf 01, Drawer 3"
                error={errors.name}
                shouldShowError={!!errors.name}
              />
              <InputFieldWithLabel
                label={tWithFallback("location.code", "Code")}
                name="code"
                required={!!editingId}
                direction="column"
                value={formData.code}
                onChange={(e) => {
                  clearFieldError("code");
                  setFormData((p) => ({ ...p, code: e.target.value }));
                }}
                placeholder={
                  editingId
                    ? "e.g. WH-LHR/Stock/Rack-A"
                    : "Auto from parent if empty (e.g. WH-LHR/Stock/Rack-A)"
                }
                error={errors.code}
                shouldShowError={!!errors.code}
              />
              <div>
                <InputLabel
                  label={tWithFallback(
                    "location.parentLocation",
                    "Parent location",
                  )}
                  direction="column"
                  error={!!errors.parentLocation}
                />
                <DropdownBasic
                  options={parentOptions}
                  value={formData.parentLocation}
                  onChange={(v) => {
                    clearFieldError("parentLocation");
                    setFormData((p) => ({ ...p, parentLocation: v || "" }));
                  }}
                  isClearable
                  error={errors.parentLocation}
                  shouldShowError={!!errors.parentLocation}
                />
              </div>
              <div>
                <InputLabel
                  label={tWithFallback(
                    "location.storageKind",
                    "Place type (generic)",
                  )}
                  required
                  direction="column"
                  error={!!errors.storageKind}
                />
                <DropdownBasic
                  options={STORAGE_KIND_OPTIONS}
                  value={formData.storageKind}
                  onChange={(v) => {
                    clearFieldError("storageKind");
                    setFormData((p) => ({
                      ...p,
                      storageKind: v || "other",
                    }));
                  }}
                  isClearable={false}
                  error={errors.storageKind}
                  shouldShowError={!!errors.storageKind}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use Area / Zone / Rack / Shelf / Drawer / Bin so anyone knows
                  where stock is.
                </p>
              </div>
              <div>
                <InputLabel
                  label={tWithFallback(
                    "location.locationType",
                    "Operational type",
                  )}
                  required
                  direction="column"
                  error={!!errors.locationType}
                />
                <DropdownBasic
                  options={LOCATION_TYPE_OPTIONS}
                  value={formData.locationType}
                  onChange={(v) => {
                    clearFieldError("locationType");
                    setFormData((p) => ({
                      ...p,
                      locationType: v || "internal",
                      canStoreStock: v === "view" ? false : p.canStoreStock,
                    }));
                  }}
                  isClearable={false}
                  error={errors.locationType}
                  shouldShowError={!!errors.locationType}
                />
              </div>
              <InputFieldWithLabel
                label={tWithFallback("location.notes", "Notes")}
                name="notes"
                direction="column"
                value={formData.notes}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, notes: e.target.value }))
                }
                placeholder="Optional — e.g. Near cold room"
              />
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={
                    formData.canStoreStock && formData.locationType !== "view"
                  }
                  disabled={formData.locationType === "view"}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      canStoreStock: e.target.checked,
                    }))
                  }
                />
                Can hold stock at this place
              </label>
            </div>
          </ModalBody>
          <ModalFooter>
            <button
              type="button"
              className="px-4 py-2 border rounded-lg disabled:opacity-50"
              disabled={saving}
              onClick={() => {
                setModalOpen(false);
                setErrors({});
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[var(--p-blue)] text-white rounded-lg disabled:opacity-50"
              disabled={saving}
              onClick={handleSave}
            >
              {saving && (
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              )}
              {saving ? "Saving…" : "Save"}
            </button>
          </ModalFooter>
        </Modal>

        <Modal
          isOpen={!!deleteTarget}
          onClose={() => {
            if (!deleting) setDeleteTarget(null);
          }}
        >
          <ModalHeader>Delete Location</ModalHeader>
          <ModalBody>
            Delete <strong>{deleteTarget?.name}</strong>? Child places and stock
            must be cleared first.
          </ModalBody>
          <ModalFooter>
            <button
              type="button"
              className="px-4 py-2 border rounded-lg disabled:opacity-50"
              disabled={deleting}
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg disabled:opacity-50"
              disabled={deleting}
              onClick={confirmDelete}
            >
              {deleting && (
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              )}
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </ModalFooter>
        </Modal>
      </div>
    </RoutePermissionGate>
  );
};

export default Locations;
