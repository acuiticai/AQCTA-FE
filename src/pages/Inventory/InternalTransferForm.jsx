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
import { Plus, Trash2 } from "lucide-react";
import { AdminContext } from "@/context/AdminContext";
import { PageHeader, useFormScreenExit } from "@/page-layouts/index";
import { DropdownBasic, InputFieldWithLabel } from "@/page-layouts/index";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@windmill/react-ui";
import { notifyError, notifySuccess } from "@/utils/toast";
import { syncAssignedBusinessesFromApi, isSingleAssignedBusiness, getSoleAssignedBusinessId } from "@/utils/sessionAssignedBusinesses";
import { useRouteModulePermissions } from "@/utils/permissionUtils";
import RoutePermissionGate from "@/components/RoutePermissionGate";
import { formatDate, formatQuantity } from "@/components/formatAmount";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const STATUS_STYLES = {
  draft: "bg-gray-100 text-gray-700",
  done: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-700",
};

const STATUS_LABELS = {
  draft: "Draft",
  done: "Validated",
  cancelled: "Cancelled",
};

const emptyLine = () => ({
  key: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  item: "",
  lotNumber: "",
  availableQty: null,
  quantity: "",
  notes: "",
});

const InternalTransferForm = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const location = useLocation();
  const { id } = useParams();
  const isCreate = !id || location.pathname.endsWith("/create");
  const exitScreen = useFormScreenExit("/internal-transfers");
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

  const tWithFallback = (key, fallback) => {
    const translated = t(key, { defaultValue: fallback });
    return translated && translated !== key ? translated : fallback;
  };

  const [businesses, setBusinesses] = useState([]);
  const [sourceWarehouses, setSourceWarehouses] = useState([]);
  const [destWarehouses, setDestWarehouses] = useState([]);
  const [sourceLocations, setSourceLocations] = useState([]);
  const [destLocations, setDestLocations] = useState([]);
  const [sourceStock, setSourceStock] = useState([]);
  const [loading, setLoading] = useState(!isCreate);
  const [loadingBusinesses, setLoadingBusinesses] = useState(true);
  const [loadingSourceWarehouses, setLoadingSourceWarehouses] = useState(false);
  const [loadingDestWarehouses, setLoadingDestWarehouses] = useState(false);
  const [loadingSourceLocations, setLoadingSourceLocations] = useState(false);
  const [loadingDestLocations, setLoadingDestLocations] = useState(false);
  const [loadingSourceStock, setLoadingSourceStock] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validateModalOpen, setValidateModalOpen] = useState(false);
  const [doc, setDoc] = useState(null);

  const FieldLoader = ({ label = "Loading…" }) => (
    <div className="flex items-center gap-2 h-10 px-3 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-500">
      <span
        className="inline-block w-4 h-4 border-2 border-gray-300 border-t-[var(--p-blue)] rounded-full animate-spin"
        aria-hidden
      />
      {label}
    </div>
  );

  const [form, setForm] = useState({
    business: "",
    sourceWarehouse: "",
    sourceLocation: "",
    destWarehouse: "",
    destLocation: "",
    name: "",
    notes: "",
  });
  const [lines, setLines] = useState([emptyLine()]);

  const editable =
    isCreate
      ? canAdd
      : doc?.status === "draft" && canUpdate;

  const loadWarehouses = useCallback(
    async (businessId, setter, setLoadingFlag) => {
      if (!businessId) {
        setter([]);
        setLoadingFlag?.(false);
        return;
      }
      setLoadingFlag?.(true);
      try {
        const res = await axios.get(`${Base_URL}/warehouses`, {
          headers,
          params: { businessId, status: "Active", limit: 100 },
        });
        setter(res.data?.data || []);
      } catch (_) {
        setter([]);
      } finally {
        setLoadingFlag?.(false);
      }
    },
    [headers],
  );

  const loadLocations = useCallback(
    async (warehouseId, setter, setLoadingFlag) => {
      if (!warehouseId) {
        setter([]);
        setLoadingFlag?.(false);
        return;
      }
      setLoadingFlag?.(true);
      try {
        const res = await axios.get(`${Base_URL}/locations`, {
          headers,
          params: { warehouseId, storeableOnly: "true" },
        });
        setter(res.data?.data || []);
      } catch (_) {
        setter([]);
      } finally {
        setLoadingFlag?.(false);
      }
    },
    [headers],
  );

  const loadSourceStock = useCallback(
    async (businessId, locationId) => {
      if (!businessId || !locationId) {
        setSourceStock([]);
        return;
      }
      setLoadingSourceStock(true);
      try {
        const res = await axios.get(`${Base_URL}/stock-levels`, {
          headers,
          params: {
            businessId,
            locationId,
            limit: 100,
          },
        });
        const rows = (res.data?.data || []).filter(
          (q) => (parseFloat(q.quantity) || 0) > 0 && q.item?._id,
        );
        setSourceStock(rows);
      } catch (_) {
        setSourceStock([]);
      } finally {
        setLoadingSourceStock(false);
      }
    },
    [headers],
  );

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

  useEffect(() => {
    if (!form.business) {
      setSourceWarehouses([]);
      setDestWarehouses([]);
      setLoadingSourceWarehouses(false);
      setLoadingDestWarehouses(false);
      return;
    }
    loadWarehouses(
      form.business,
      setSourceWarehouses,
      setLoadingSourceWarehouses,
    );
    loadWarehouses(
      form.business,
      setDestWarehouses,
      setLoadingDestWarehouses,
    );
  }, [form.business, loadWarehouses]);

  useEffect(() => {
    loadLocations(
      form.sourceWarehouse,
      setSourceLocations,
      setLoadingSourceLocations,
    );
  }, [form.sourceWarehouse, loadLocations]);

  useEffect(() => {
    loadLocations(
      form.destWarehouse,
      setDestLocations,
      setLoadingDestLocations,
    );
  }, [form.destWarehouse, loadLocations]);

  useEffect(() => {
    if (editable) {
      loadSourceStock(form.business, form.sourceLocation);
    }
  }, [form.business, form.sourceLocation, editable, loadSourceStock]);

  const hydrateFromDoc = (data) => {
    setDoc(data);
    setForm({
      business: data.business?._id || data.business || "",
      sourceWarehouse:
        data.sourceWarehouse?._id || data.sourceWarehouse || "",
      sourceLocation: data.sourceLocation?._id || data.sourceLocation || "",
      destWarehouse: data.destWarehouse?._id || data.destWarehouse || "",
      destLocation: data.destLocation?._id || data.destLocation || "",
      name: data.name || "",
      notes: data.notes || "",
    });
    setLines(
      (data.lines || []).map((l) => ({
        key: l._id || emptyLine().key,
        _id: l._id,
        item: l.item?._id || l.item || "",
        itemLabel: l.item
          ? `${l.item.name}${l.item.itemCode ? ` (${l.item.itemCode})` : ""}`
          : "",
        lotNumber: l.lotNumber || "",
        availableQty: l.availableQty,
        quantity: l.quantity ?? "",
        notes: l.notes || "",
        unit: l.item?.unit || l.item?.uom || "",
      })),
    );
  };

  useEffect(() => {
    if (isCreate) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${Base_URL}/internal-transfers/${id}`, {
          headers,
        });
        if (!cancelled) hydrateFromDoc(res.data?.data);
      } catch (err) {
        notifyError(
          err?.response?.data?.message || "Failed to load transfer",
        );
        history.push("/internal-transfers");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, isCreate, headers, history]);

  const businessOptions = useMemo(
    () => businesses.map((b) => ({ value: b._id, label: b.name })),
    [businesses],
  );

  const warehouseOptions = (list) =>
    list.map((w) => ({
      value: w._id,
      label: `${w.name} (${w.code})`,
    }));

  const locationOptions = (list) =>
    list.map((l) => ({
      value: l._id,
      label: `${l.code} — ${l.name}${
        l.storageKind ? ` (${l.storageKind})` : ""
      }`,
    }));

  const stockOptions = useMemo(() => {
    return sourceStock.map((q) => {
      const lot = q.lotNumber || "";
      const label = `${q.item?.name || "Item"}${
        q.item?.itemCode ? ` (${q.item.itemCode})` : ""
      }${lot ? ` · Lot ${lot}` : ""} — ${formatQuantity(q.quantity)} ${
        q.item?.unit || q.item?.uom || ""
      }`.trim();
      return {
        value: `${q.item._id}::${lot}`,
        label,
        itemId: q.item._id,
        lotNumber: lot,
        availableQty: q.quantity,
        unit: q.item?.unit || q.item?.uom || "",
        itemName: q.item?.name,
      };
    });
  }, [sourceStock]);

  const updateLine = (key, patch) => {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, ...patch } : l)),
    );
  };

  const onPickStock = (lineKey, optionValue) => {
    const opt = stockOptions.find((o) => o.value === optionValue);
    if (!opt) {
      updateLine(lineKey, {
        item: "",
        lotNumber: "",
        availableQty: null,
        itemLabel: "",
        unit: "",
        quantity: "",
      });
      return;
    }
    updateLine(lineKey, {
      item: opt.itemId,
      lotNumber: opt.lotNumber,
      availableQty: opt.availableQty,
      itemLabel: opt.label,
      unit: opt.unit,
      quantity: String(opt.availableQty ?? ""),
    });
  };

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);

  const removeLine = (key) => {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.key !== key)));
  };

  const buildPayload = () => {
    const payloadLines = lines
      .filter((l) => l.item)
      .map((l) => ({
        item: l.item,
        lotNumber: l.lotNumber || "",
        availableQty: l.availableQty,
        quantity: parseFloat(l.quantity) || 0,
        notes: l.notes || "",
      }));

    return {
      business: form.business,
      sourceWarehouse: form.sourceWarehouse,
      sourceLocation: form.sourceLocation,
      destWarehouse: form.destWarehouse,
      destLocation: form.destLocation,
      name: form.name,
      notes: form.notes,
      lines: payloadLines,
    };
  };

  const validateClient = () => {
    if (!form.business) return "Select a business";
    if (!form.name?.trim()) return "Enter a transfer name";
    if (!form.sourceWarehouse || !form.sourceLocation) {
      return "Select source warehouse and location";
    }
    if (!form.destWarehouse || !form.destLocation) {
      return "Select destination warehouse and location";
    }
    if (form.sourceLocation === form.destLocation) {
      return "Source and destination must be different";
    }
    const payloadLines = lines.filter((l) => l.item);
    if (!payloadLines.length) return "Add at least one product";
    for (const l of payloadLines) {
      const qty = parseFloat(l.quantity);
      if (!qty || qty <= 0) return "Each line needs a quantity greater than zero";
      if (
        l.availableQty != null &&
        qty > parseFloat(l.availableQty) + 1e-9
      ) {
        return `Quantity exceeds available stock for ${l.itemLabel || "a product"}`;
      }
    }
    return null;
  };

  const saveDraft = async () => {
    const errMsg = validateClient();
    if (errMsg) {
      notifyError(errMsg);
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload();
      if (isCreate || !doc?._id) {
        const res = await axios.post(`${Base_URL}/internal-transfers`, payload, {
          headers,
        });
        notifySuccess(
          res.data?.message || "Internal transfer saved as draft",
        );
        history.push("/internal-transfers");
      } else {
        const res = await axios.put(
          `${Base_URL}/internal-transfers/${doc._id}`,
          payload,
          { headers },
        );
        notifySuccess(res.data?.message || "Internal transfer updated");
        history.push("/internal-transfers");
      }
    } catch (err) {
      notifyError(err?.response?.data?.message || "Failed to save transfer");
    } finally {
      setSaving(false);
    }
  };

  const confirmValidate = async () => {
    const errMsg = validateClient();
    if (errMsg) {
      notifyError(errMsg);
      setValidateModalOpen(false);
      return;
    }
    setSaving(true);
    try {
      const payload = { ...buildPayload(), validateImmediately: true };
      const transferId = doc?._id;

      if (isCreate || !transferId) {
        await axios.post(`${Base_URL}/internal-transfers`, payload, {
          headers,
        });
        notifySuccess(
          "Internal transfer validated — stock moved",
        );
      } else {
        await axios.put(
          `${Base_URL}/internal-transfers/${transferId}`,
          buildPayload(),
          { headers },
        );
        await axios.post(
          `${Base_URL}/internal-transfers/${transferId}/validate`,
          {},
          { headers },
        );
        notifySuccess(
          "Internal transfer validated — stock moved",
        );
      }
      setValidateModalOpen(false);
      history.push("/internal-transfers");
    } catch (err) {
      notifyError(
        err?.response?.data?.message || "Failed to validate transfer",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
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
        <div className="px-6 py-6 max-w-6xl mx-auto">
          <PageHeader
            title={
              isCreate
                ? tWithFallback(
                    "internalTransfer.new",
                    "New Internal Transfer",
                  )
                : doc?.reference ||
                  tWithFallback("internalTransfer.title", "Internal Transfer")
            }
            description={tWithFallback(
              "internalTransfer.formHint",
              "Move products from one internal location to another. Company total stock stays the same — only the location changes.",
            )}
            showBackButton
            onBackClick={exitScreen}
            renderActions={
              doc?.status ? (
                <span
                  className={`inline-flex px-3 py-1 rounded text-sm font-medium ${
                    STATUS_STYLES[doc.status] || STATUS_STYLES.draft
                  }`}
                >
                  {STATUS_LABELS[doc.status] || doc.status}
                </span>
              ) : null
            }
          />

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {!isSingleAssignedBusiness() && <InputFieldWithLabel
                label={t("Business") || "Business"}
                required
                direction="column"
                Input={
                  loadingBusinesses ? (
                    <FieldLoader label="Loading businesses…" />
                  ) : (
                    <DropdownBasic
                      value={form.business}
                      onChange={(v) =>
                        setForm((f) => ({
                          ...f,
                          business: v || "",
                          sourceWarehouse: "",
                          sourceLocation: "",
                          destWarehouse: "",
                          destLocation: "",
                        }))
                      }
                      options={businessOptions}
                      isDisabled={!editable || !isCreate}
                      placeholder="Select business"
                    />
                  )
                }
              />}
              <InputFieldWithLabel
                label={tWithFallback("internalTransfer.name", "Name")}
                required
                direction="column"
                name="name"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                disabled={!editable}
                placeholder="e.g. Move to packing area"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 rounded-lg bg-orange-50 border border-orange-100 space-y-3">
                <p className="text-sm font-semibold text-gray-800">
                  {tWithFallback("internalTransfer.source", "Source")}
                </p>
                <InputFieldWithLabel
                  label={tWithFallback("warehouse.title", "Warehouse")}
                  required
                  direction="column"
                  Input={
                    !form.business ? (
                      <div className="h-10 px-3 flex items-center text-sm text-gray-400 border border-gray-200 rounded-lg bg-gray-50">
                        Select business first
                      </div>
                    ) : loadingSourceWarehouses ? (
                      <FieldLoader label="Loading warehouses…" />
                    ) : (
                      <DropdownBasic
                        value={form.sourceWarehouse}
                        onChange={(v) =>
                          setForm((f) => ({
                            ...f,
                            sourceWarehouse: v || "",
                            sourceLocation: "",
                          }))
                        }
                        options={warehouseOptions(sourceWarehouses)}
                        isDisabled={!editable}
                        placeholder="Select warehouse"
                      />
                    )
                  }
                />
                <InputFieldWithLabel
                  label={tWithFallback("location.title", "Location")}
                  required
                  direction="column"
                  Input={
                    !form.sourceWarehouse ? (
                      <div className="h-10 px-3 flex items-center text-sm text-gray-400 border border-gray-200 rounded-lg bg-gray-50">
                        Select warehouse first
                      </div>
                    ) : loadingSourceLocations ? (
                      <FieldLoader label="Loading locations…" />
                    ) : (
                      <DropdownBasic
                        value={form.sourceLocation}
                        onChange={(v) => {
                          setForm((f) => ({ ...f, sourceLocation: v || "" }));
                          if (editable) setLines([emptyLine()]);
                        }}
                        options={locationOptions(sourceLocations)}
                        isDisabled={!editable}
                        placeholder="Select location"
                      />
                    )
                  }
                />
              </div>

              <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-100 space-y-3">
                <p className="text-sm font-semibold text-gray-800">
                  {tWithFallback("internalTransfer.destination", "Destination")}
                </p>
                <InputFieldWithLabel
                  label={tWithFallback("warehouse.title", "Warehouse")}
                  required
                  direction="column"
                  Input={
                    !form.business ? (
                      <div className="h-10 px-3 flex items-center text-sm text-gray-400 border border-gray-200 rounded-lg bg-gray-50">
                        Select business first
                      </div>
                    ) : loadingDestWarehouses ? (
                      <FieldLoader label="Loading warehouses…" />
                    ) : (
                      <DropdownBasic
                        value={form.destWarehouse}
                        onChange={(v) =>
                          setForm((f) => ({
                            ...f,
                            destWarehouse: v || "",
                            destLocation: "",
                          }))
                        }
                        options={warehouseOptions(destWarehouses)}
                        isDisabled={!editable}
                        placeholder="Select warehouse"
                      />
                    )
                  }
                />
                <InputFieldWithLabel
                  label={tWithFallback("location.title", "Location")}
                  required
                  direction="column"
                  Input={
                    !form.destWarehouse ? (
                      <div className="h-10 px-3 flex items-center text-sm text-gray-400 border border-gray-200 rounded-lg bg-gray-50">
                        Select warehouse first
                      </div>
                    ) : loadingDestLocations ? (
                      <FieldLoader label="Loading locations…" />
                    ) : (
                      <DropdownBasic
                        value={form.destLocation}
                        onChange={(v) =>
                          setForm((f) => ({ ...f, destLocation: v || "" }))
                        }
                        options={locationOptions(destLocations)}
                        isDisabled={!editable}
                        placeholder="Select location"
                      />
                    )
                  }
                />
              </div>
            </div>

            <InputFieldWithLabel
              label={t("Notes") || "Notes"}
              direction="column"
              name="notes"
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              disabled={!editable}
              placeholder="Optional notes"
            />

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900">
                  {tWithFallback("internalTransfer.products", "Products to move")}
                </h3>
                {editable && (
                  <button
                    type="button"
                    onClick={addLine}
                    className="inline-flex items-center gap-1 text-sm text-[var(--p-blue)] hover:underline"
                  >
                    <Plus size={16} />
                    Add line
                  </button>
                )}
              </div>

              {!form.sourceLocation && editable && (
                <p className="text-sm text-amber-700 mb-3">
                  Select a source location to load available stock.
                </p>
              )}
              {form.sourceLocation &&
                editable &&
                !loadingSourceStock &&
                !sourceStock.length && (
                  <p className="text-sm text-amber-700 mb-3">
                    No on-hand stock at this source location.
                  </p>
                )}

              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-left">
                    <tr>
                      <th className="px-3 py-2 font-medium">Product</th>
                      <th className="px-3 py-2 font-medium w-28">Available</th>
                      <th className="px-3 py-2 font-medium w-32">Qty to move</th>
                      <th className="px-3 py-2 font-medium">Notes</th>
                      {editable && (
                        <th className="px-3 py-2 font-medium w-12" />
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => (
                      <tr key={line.key} className="border-t">
                        <td className="px-3 py-2 min-w-[220px]">
                          {editable ? (
                            !form.sourceLocation ? (
                              <div className="h-10 px-3 flex items-center text-sm text-gray-400 border border-gray-200 rounded-lg bg-gray-50">
                                Select source location first
                              </div>
                            ) : loadingSourceStock ? (
                              <FieldLoader label="Loading products…" />
                            ) : (
                              <DropdownBasic
                                value={
                                  line.item
                                    ? `${line.item}::${line.lotNumber || ""}`
                                    : ""
                                }
                                onChange={(v) => onPickStock(line.key, v)}
                                options={stockOptions}
                                placeholder="Select product"
                              />
                            )
                          ) : (
                            <span>
                              {line.itemLabel ||
                                line.item?.name ||
                                "—"}
                              {line.lotNumber
                                ? ` · ${line.lotNumber}`
                                : ""}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {formatQuantity(line.availableQty)}
                          {line.unit ? ` ${line.unit}` : ""}
                        </td>
                        <td className="px-3 py-2">
                          {editable ? (
                            <input
                              type="number"
                              min="0"
                              step="any"
                              className="w-full border border-gray-300 rounded-md px-2 py-1.5"
                              value={line.quantity}
                              onChange={(e) =>
                                updateLine(line.key, {
                                  quantity: e.target.value,
                                })
                              }
                            />
                          ) : (
                            formatQuantity(line.quantity)
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {editable ? (
                            <input
                              type="text"
                              className="w-full border border-gray-300 rounded-md px-2 py-1.5"
                              value={line.notes}
                              onChange={(e) =>
                                updateLine(line.key, {
                                  notes: e.target.value,
                                })
                              }
                              placeholder="Optional"
                            />
                          ) : (
                            line.notes || "—"
                          )}
                        </td>
                        {editable && (
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              className="text-red-500 hover:text-red-700 p-1"
                              onClick={() => removeLine(line.key)}
                              disabled={lines.length <= 1}
                              title="Remove line"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {editable && (
              <div className="flex flex-wrap gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={exitScreen}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveDraft}
                  className="px-4 py-2 border border-[var(--p-blue)] text-[var(--p-blue)] rounded-lg hover:bg-orange-50 disabled:opacity-50"
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save Draft"}
                </button>
                <button
                  type="button"
                  onClick={() => setValidateModalOpen(true)}
                  className="px-4 py-2 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[var(--p-blue-dark)] disabled:opacity-50"
                  disabled={saving}
                >
                  Validate Transfer
                </button>
              </div>
            )}

            {!editable && doc?.status === "done" && (
              <div className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-4 py-3">
                Validated
                {doc.validatedAt
                  ? ` on ${formatDate(doc.validatedAt, false, true)}`
                  : ""}
                . Source stock decreased and destination stock increased.
              </div>
            )}
          </div>
        </div>

        <Modal
          isOpen={validateModalOpen}
          onClose={() => {
            if (saving) return;
            setValidateModalOpen(false);
          }}
        >
          <ModalHeader>Validate Internal Transfer</ModalHeader>
          <ModalBody>
            <p className="mb-2">
              This will move the quantities from the source location to the
              destination. Company total inventory stays the same.
            </p>
            <p className="text-sm text-gray-600">
              This cannot be undone from this screen — create a reverse transfer
              if you need to move stock back.
            </p>
          </ModalBody>
          <ModalFooter>
            <button
              type="button"
              className="px-4 py-2 border rounded-lg disabled:opacity-50"
              disabled={saving}
              onClick={() => setValidateModalOpen(false)}
            >
              Back
            </button>
            <button
              type="button"
              className="px-4 py-2 bg-[var(--p-blue)] text-white rounded-lg disabled:opacity-50 inline-flex items-center gap-2"
              disabled={saving}
              onClick={confirmValidate}
            >
              {saving && (
                <span
                  className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"
                  aria-hidden
                />
              )}
              {saving ? "Validating…" : "Confirm & Move Stock"}
            </button>
          </ModalFooter>
        </Modal>
      </div>
    </RoutePermissionGate>
  );
};

export default InternalTransferForm;
