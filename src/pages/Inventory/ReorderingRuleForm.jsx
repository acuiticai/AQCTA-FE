import React, {
  useState,
  useEffect,
  useMemo,
  useContext,
  useCallback,
} from "react";
import axios from "axios";
import { useHistory, useParams, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AdminContext } from "@/context/AdminContext";
import {
  PageHeader,
  useFormScreenExit,
  DropdownBasic,
  InputFieldWithLabel,
} from "@/page-layouts/index";
import { notifyError, notifySuccess } from "@/utils/toast";
import { syncAssignedBusinessesFromApi, isSingleAssignedBusiness, getSoleAssignedBusinessId } from "@/utils/sessionAssignedBusinesses";
import { useRouteModulePermissions } from "@/utils/permissionUtils";
import RoutePermissionGate from "@/components/RoutePermissionGate";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const FieldLoader = ({ label = "Loading…" }) => (
  <div className="flex items-center gap-2 h-10 px-3 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-500">
    <span
      className="inline-block w-4 h-4 border-2 border-gray-300 border-t-[var(--p-blue)] rounded-full animate-spin"
      aria-hidden
    />
    {label}
  </div>
);

const ReorderingRuleForm = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const location = useLocation();
  const { id } = useParams();
  const isCreate = !id || location.pathname.endsWith("/create");
  const exitScreen = useFormScreenExit("/reordering-rules");
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo?.token}`,
    }),
    [adminInfo?.token],
  );

  const { canAdd, canUpdate } = useRouteModulePermissions();
  const editable = isCreate ? canAdd : canUpdate;

  const [businesses, setBusinesses] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [locations, setLocations] = useState([]);
  const [items, setItems] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(!isCreate);
  const [loadingBusinesses, setLoadingBusinesses] = useState(true);
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    business: "",
    item: "",
    warehouse: "",
    location: "",
    name: "",
    minQty: "",
    maxQty: "",
    reorderQty: "",
    preferredVendor: "",
    active: true,
    notes: "",
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingBusinesses(true);
      const list = await syncAssignedBusinessesFromApi(Base_URL);
      if (!cancelled) {
        setBusinesses(list || []);
        setLoadingBusinesses(false);
        if (isCreate && list?.length === 1) {
          setForm((f) => ({ ...f, business: list[0]._id }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isCreate]);

  const loadWarehouses = useCallback(
    async (businessId) => {
      if (!businessId) {
        setWarehouses([]);
        return;
      }
      setLoadingWarehouses(true);
      try {
        const res = await axios.get(`${Base_URL}/warehouses`, {
          headers,
          params: { businessId, status: "Active", limit: 100 },
        });
        setWarehouses(res.data?.data || []);
      } catch (_) {
        setWarehouses([]);
      } finally {
        setLoadingWarehouses(false);
      }
    },
    [headers],
  );

  const loadItems = useCallback(
    async (businessId) => {
      if (!businessId) {
        setItems([]);
        return;
      }
      setLoadingItems(true);
      try {
        const res = await axios.get(`${Base_URL}/items`, {
          headers,
          params: { businessId, limit: 300 },
        });
        setItems(res.data?.data || []);
      } catch (_) {
        setItems([]);
      } finally {
        setLoadingItems(false);
      }
    },
    [headers],
  );

  const loadVendors = useCallback(
    async (businessId) => {
      if (!businessId) {
        setVendors([]);
        return;
      }
      try {
        const res = await axios.get(
          `${Base_URL}/vendors/all/${businessId}`,
          { headers },
        );
        setVendors(res.data?.data || res.data || []);
      } catch (_) {
        setVendors([]);
      }
    },
    [headers],
  );

  const loadLocations = useCallback(
    async (warehouseId) => {
      if (!warehouseId) {
        setLocations([]);
        return;
      }
      setLoadingLocations(true);
      try {
        const res = await axios.get(`${Base_URL}/locations`, {
          headers,
          params: { warehouseId, storeableOnly: "true" },
        });
        setLocations(res.data?.data || []);
      } catch (_) {
        setLocations([]);
      } finally {
        setLoadingLocations(false);
      }
    },
    [headers],
  );

  useEffect(() => {
    loadWarehouses(form.business);
    loadItems(form.business);
    loadVendors(form.business);
  }, [form.business, loadWarehouses, loadItems, loadVendors]);

  useEffect(() => {
    loadLocations(form.warehouse);
  }, [form.warehouse, loadLocations]);

  useEffect(() => {
    if (isCreate) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${Base_URL}/reordering-rules/${id}`, {
          headers,
        });
        if (cancelled) return;
        const d = res.data?.data;
        setForm({
          business: d.business?._id || d.business || "",
          item: d.item?._id || d.item || "",
          warehouse: d.warehouse?._id || d.warehouse || "",
          location: d.location?._id || d.location || "",
          name: d.name || "",
          minQty: d.minQty ?? "",
          maxQty: d.maxQty ?? "",
          reorderQty: d.reorderQty ?? "",
          preferredVendor: d.preferredVendor?._id || d.preferredVendor || "",
          active: d.active !== false,
          notes: d.notes || "",
        });
      } catch (err) {
        notifyError(err?.response?.data?.message || "Failed to load rule");
        history.push("/reordering-rules");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, isCreate, headers, history]);

  const validate = () => {
    if (!form.business) return "Select a business";
    if (!form.item) return "Select a product";
    const min = parseFloat(form.minQty) || 0;
    const max = parseFloat(form.maxQty) || 0;
    const fixed = parseFloat(form.reorderQty) || 0;
    if (min <= 0 && max <= 0 && fixed <= 0) {
      return "Set at least minimum, maximum, or fixed reorder quantity";
    }
    if (max > 0 && min > 0 && max < min) {
      return "Maximum must be ≥ minimum";
    }
    return null;
  };

  const save = async () => {
    const errMsg = validate();
    if (errMsg) {
      notifyError(errMsg);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        business: form.business,
        item: form.item,
        warehouse: form.warehouse || null,
        location: form.location || null,
        name: form.name,
        minQty: parseFloat(form.minQty) || 0,
        maxQty: parseFloat(form.maxQty) || 0,
        reorderQty: parseFloat(form.reorderQty) || 0,
        preferredVendor: form.preferredVendor || null,
        active: form.active,
        notes: form.notes,
      };

      if (isCreate) {
        await axios.post(`${Base_URL}/reordering-rules`, payload, { headers });
        notifySuccess("Reordering rule created");
      } else {
        await axios.put(`${Base_URL}/reordering-rules/${id}`, payload, {
          headers,
        });
        notifySuccess("Reordering rule updated");
      }
      history.push("/reordering-rules");
    } catch (err) {
      notifyError(err?.response?.data?.message || "Failed to save rule");
    } finally {
      setSaving(false);
    }
  };

  if (loading || loadingBusinesses) {
    return (
      <RoutePermissionGate>
        <div className="p-8 flex items-center gap-2 text-gray-500">
          <span
            className="inline-block w-5 h-5 border-2 border-gray-300 border-t-[var(--p-blue)] rounded-full animate-spin"
            aria-hidden
          />
          Loading…
        </div>
      </RoutePermissionGate>
    );
  }

  return (
    <RoutePermissionGate>
      <div className="bg-gray-50 min-h-screen pb-16">
        <div className="px-6 py-6 max-w-3xl mx-auto">
          <PageHeader
            title={isCreate ? "New Reordering Rule" : "Edit Reordering Rule"}
            description="When on-hand ≤ minimum, suggest replenishment up to maximum (or a fixed quantity)."
            showBackButton
            onBackClick={exitScreen}
          />

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4 mt-6">
            {!isSingleAssignedBusiness() && <InputFieldWithLabel
              label={t("Business") || "Business"}
              required
              direction="column"
              Input={
                <DropdownBasic
                  value={form.business}
                  onChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      business: v || "",
                      item: "",
                      warehouse: "",
                      location: "",
                      preferredVendor: "",
                    }))
                  }
                  options={businesses.map((b) => ({
                    value: b._id,
                    label: b.name,
                  }))}
                  isDisabled={!editable || !isCreate}
                  placeholder="Select business"
                />
              }
            />}

            <InputFieldWithLabel
              label="Product"
              required
              direction="column"
              Input={
                !form.business ? (
                  <div className="h-10 px-3 flex items-center text-sm text-gray-400 border rounded-lg bg-gray-50">
                    Select business first
                  </div>
                ) : loadingItems ? (
                  <FieldLoader label="Loading products…" />
                ) : (
                  <DropdownBasic
                    value={form.item}
                    onChange={(v) => setForm((f) => ({ ...f, item: v || "" }))}
                    options={items.map((it) => ({
                      value: it._id,
                      label: `${it.name}${
                        it.itemCode ? ` (${it.itemCode})` : ""
                      }`,
                    }))}
                    isDisabled={!editable || !isCreate}
                    placeholder="Select product"
                  />
                )
              }
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputFieldWithLabel
                label="Warehouse (optional)"
                direction="column"
                Input={
                  !form.business ? (
                    <div className="h-10 px-3 flex items-center text-sm text-gray-400 border rounded-lg bg-gray-50">
                      Select business first
                    </div>
                  ) : loadingWarehouses ? (
                    <FieldLoader />
                  ) : (
                    <DropdownBasic
                      value={form.warehouse}
                      onChange={(v) =>
                        setForm((f) => ({
                          ...f,
                          warehouse: v || "",
                          location: "",
                        }))
                      }
                      options={[
                        { value: "", label: "Company-wide", first: true },
                        ...warehouses.map((w) => ({
                          value: w._id,
                          label: `${w.name}${w.code ? ` (${w.code})` : ""}`,
                        })),
                      ]}
                      isDisabled={!editable}
                      placeholder="Company-wide"
                    />
                  )
                }
              />
              <InputFieldWithLabel
                label="Location (optional)"
                direction="column"
                Input={
                  !form.warehouse ? (
                    <div className="h-10 px-3 flex items-center text-sm text-gray-400 border rounded-lg bg-gray-50">
                      Pick warehouse for location rule
                    </div>
                  ) : loadingLocations ? (
                    <FieldLoader />
                  ) : (
                    <DropdownBasic
                      value={form.location}
                      onChange={(v) =>
                        setForm((f) => ({ ...f, location: v || "" }))
                      }
                      options={[
                        { value: "", label: "Whole warehouse", first: true },
                        ...locations.map((l) => ({
                          value: l._id,
                          label: `${l.code || ""} — ${l.name}`.trim(),
                        })),
                      ]}
                      isDisabled={!editable}
                      placeholder="Whole warehouse"
                    />
                  )
                }
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <InputFieldWithLabel
                label="Minimum stock"
                required
                direction="column"
                name="minQty"
                type="number"
                value={form.minQty}
                onChange={(e) =>
                  setForm((f) => ({ ...f, minQty: e.target.value }))
                }
                disabled={!editable}
                placeholder="e.g. 20"
                description="Trigger when on-hand ≤ this"
              />
              <InputFieldWithLabel
                label="Maximum stock"
                direction="column"
                name="maxQty"
                type="number"
                value={form.maxQty}
                onChange={(e) =>
                  setForm((f) => ({ ...f, maxQty: e.target.value }))
                }
                disabled={!editable}
                placeholder="e.g. 100"
                description="Suggest order up to this (max − current)"
              />
              <InputFieldWithLabel
                label="Fixed reorder qty"
                direction="column"
                name="reorderQty"
                type="number"
                value={form.reorderQty}
                onChange={(e) =>
                  setForm((f) => ({ ...f, reorderQty: e.target.value }))
                }
                disabled={!editable}
                placeholder="Optional"
                description="If set, used instead of max − current"
              />
            </div>

            <InputFieldWithLabel
              label="Name"
              direction="column"
              name="name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              disabled={!editable}
              placeholder="Optional label"
            />

            <InputFieldWithLabel
              label="Preferred vendor"
              direction="column"
              Input={
                <DropdownBasic
                  value={form.preferredVendor}
                  onChange={(v) =>
                    setForm((f) => ({ ...f, preferredVendor: v || "" }))
                  }
                  options={[
                    { value: "", label: "None", first: true },
                    ...vendors.map((v) => ({
                      value: v._id,
                      label:
                        v.basicInformation?.vendorDisplayName ||
                        v.basicInformation?.companyName ||
                        "Vendor",
                    })),
                  ]}
                  isDisabled={!editable || !form.business}
                  placeholder="Optional"
                />
              }
            />

            <InputFieldWithLabel
              label="Notes"
              direction="column"
              name="notes"
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              disabled={!editable}
              placeholder="Optional"
            />

            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.active}
                disabled={!editable}
                onChange={(e) =>
                  setForm((f) => ({ ...f, active: e.target.checked }))
                }
              />
              Active
            </label>

            {editable && (
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  className="px-4 py-2 border rounded-lg"
                  disabled={saving}
                  onClick={exitScreen}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-4 py-2 bg-[var(--p-blue)] text-white rounded-lg"
                  disabled={saving}
                  onClick={save}
                >
                  {saving ? "Saving…" : "Save Rule"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </RoutePermissionGate>
  );
};

export default ReorderingRuleForm;
