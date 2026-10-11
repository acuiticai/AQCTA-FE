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
import { PageHeader, useFormScreenExit } from "@/page-layouts/index";
import { DropdownBasic, InputFieldWithLabel, InputField } from "@/page-layouts/index";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@windmill/react-ui";
import { notifyError, notifySuccess } from "@/utils/toast";
import { syncAssignedBusinessesFromApi, isSingleAssignedBusiness, getSoleAssignedBusinessId } from "@/utils/sessionAssignedBusinesses";
import { useRouteModulePermissions } from "@/utils/permissionUtils";
import RoutePermissionGate from "@/components/RoutePermissionGate";
import { formatDate, formatQuantity } from "@/components/formatAmount";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const STATUS_STYLES = {
  draft: "bg-gray-100 text-gray-700",
  in_progress: "bg-amber-100 text-amber-800",
  done: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-700",
};

const STATUS_LABELS = {
  draft: "Draft",
  in_progress: "In Progress",
  done: "Validated",
  cancelled: "Cancelled",
};

const InventoryAdjustmentForm = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const location = useLocation();
  const { id } = useParams();
  const isCreate = !id || location.pathname.endsWith("/create");
  const exitScreen = useFormScreenExit("/inventory-adjustments");
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
  const [warehouses, setWarehouses] = useState([]);
  const [locations, setLocations] = useState([]);
  const [reasons, setReasons] = useState([]);
  const [loading, setLoading] = useState(!isCreate);
  const [loadingBusinesses, setLoadingBusinesses] = useState(true);
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validateModalOpen, setValidateModalOpen] = useState(false);
  const [doc, setDoc] = useState(null);
  const [lineEdits, setLineEdits] = useState({});

  const [form, setForm] = useState({
    business: "",
    warehouse: "",
    location: "",
    name: "",
    notes: "",
    includeZero: false,
  });

  const isSession = Boolean(doc?.isSession) || (Boolean(doc) && !doc._id);
  const editable =
    doc &&
    (isSession
      ? canAdd || canUpdate
      : ["draft", "in_progress"].includes(doc.status) && canUpdate);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingBusinesses(true);
      const list = await syncAssignedBusinessesFromApi(Base_URL);
      if (cancelled) return;
      setBusinesses(list || []);
      if (isCreate && list?.length) {
        setForm((prev) => ({
          ...prev,
          business: prev.business || list[0]._id,
          name:
            prev.name ||
            `Stock count ${formatDate(new Date())}`,
        }));
      }
      setLoadingBusinesses(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [isCreate]);

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(
          `${Base_URL}/inventory-adjustments/reasons`,
          { headers },
        );
        setReasons(res.data?.data || []);
      } catch (_) {
        setReasons([
          { value: "damaged", label: "Damaged products" },
          { value: "missing", label: "Missing stock" },
          { value: "counting_error", label: "Manual counting errors" },
          { value: "expired", label: "Expired products" },
          { value: "theft", label: "Theft" },
          { value: "other", label: "Other" },
        ]);
      }
    })();
  }, [headers]);

  useEffect(() => {
    if (!form.business && !doc?.business) {
      setWarehouses([]);
      setLoadingWarehouses(false);
      return;
    }
    const bizId = form.business || doc?.business?._id || doc?.business;
    let cancelled = false;
    (async () => {
      setLoadingWarehouses(true);
      setWarehouses([]);
      try {
        const res = await axios.get(`${Base_URL}/warehouses`, {
          headers,
          params: { businessId: bizId, status: "Active", limit: 100 },
        });
        if (!cancelled) setWarehouses(res.data?.data || []);
      } catch (_) {
        if (!cancelled) setWarehouses([]);
      } finally {
        if (!cancelled) setLoadingWarehouses(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [form.business, doc?.business, headers]);

  useEffect(() => {
    const whId = form.warehouse || doc?.warehouse?._id || doc?.warehouse;
    if (!whId) {
      setLocations([]);
      setLoadingLocations(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingLocations(true);
      setLocations([]);
      try {
        const res = await axios.get(`${Base_URL}/locations`, {
          headers,
          params: { warehouseId: whId, storeableOnly: "true" },
        });
        if (!cancelled) setLocations(res.data?.data || []);
      } catch (_) {
        if (!cancelled) setLocations([]);
      } finally {
        if (!cancelled) setLoadingLocations(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [form.warehouse, doc?.warehouse, headers]);

  const hydrateLines = useCallback((adjustment) => {
    const edits = {};
    (adjustment?.lines || []).forEach((line) => {
      edits[line._id] = {
        actualQty:
          line.actualQty === null || line.actualQty === undefined
            ? ""
            : String(line.actualQty),
        reason: line.reason || "",
        notes: line.notes || "",
      };
    });
    setLineEdits(edits);
  }, []);

  const loadDoc = useCallback(async () => {
    if (isCreate || !id) return;
    try {
      setLoading(true);
      const res = await axios.get(`${Base_URL}/inventory-adjustments/${id}`, {
        headers,
      });
      const data = res.data?.data;
      if (!data) {
        notifyError("Adjustment not found");
        history.push("/inventory-adjustments");
        return;
      }
      setDoc(data);
      hydrateLines(data);
    } catch (err) {
      notifyError(err?.response?.data?.message || "Failed to load adjustment");
      history.push("/inventory-adjustments");
    } finally {
      setLoading(false);
    }
  }, [isCreate, id, headers, history, hydrateLines]);

  useEffect(() => {
    loadDoc();
  }, [loadDoc]);

  const handleCreate = async () => {
    if (!canAdd) return;
    if (!form.business) {
      notifyError("Business is required");
      return;
    }
    if (!form.warehouse) {
      notifyError("Warehouse is required");
      return;
    }
    if (!form.name?.trim()) {
      notifyError("Name is required");
      return;
    }

    setSaving(true);
    try {
      // Preview only — no DB record until Save Counts / Validate
      const res = await axios.post(
        `${Base_URL}/inventory-adjustments/preview`,
        {
          business: form.business,
          warehouse: form.warehouse,
          location: form.location || null,
          name: form.name.trim(),
          notes: form.notes || "",
          includeZero: Boolean(form.includeZero),
        },
        { headers },
      );
      const data = res.data?.data;
      if (!data?.lines?.length) {
        notifyError(res.data?.message || "No stock to count");
        return;
      }
      setDoc(data);
      hydrateLines(data);
      notifySuccess(
        tWithFallback(
          "inventoryAdjustment.messages.previewReady",
          "Count ready — not saved until you Save Counts or Validate",
        ),
      );
    } catch (err) {
      notifyError(
        err?.response?.data?.message ||
          tWithFallback(
            "inventoryAdjustment.messages.createFailed",
            "Failed to start inventory count",
          ),
      );
    } finally {
      setSaving(false);
    }
  };

  const buildSessionCreatePayload = (validateImmediately = false) => {
    const meta = doc?._sessionMeta || {
      business: form.business || doc?.business?._id || doc?.business,
      warehouse: form.warehouse || doc?.warehouse?._id || doc?.warehouse,
      location:
        form.location ||
        doc?.location?._id ||
        doc?.location ||
        null,
    };
    const lines = (doc?.lines || []).map((line) => {
      const edit = lineEdits[line._id] || {};
      return {
        quantId: line.quantId || null,
        item: line.item?._id || line.item,
        location: line.location?._id || line.location,
        warehouse:
          line.warehouse?._id ||
          line.warehouse ||
          meta.warehouse,
        lotNumber: line.lotNumber || "",
        expectedQty: line.expectedQty,
        actualQty:
          edit.actualQty === "" || edit.actualQty == null
            ? null
            : edit.actualQty,
        reason: edit.reason || null,
        notes: edit.notes || "",
      };
    });
    return {
      business: meta.business,
      warehouse: meta.warehouse,
      location: meta.location || null,
      name: doc?.name || form.name,
      notes: doc?.notes || form.notes || "",
      lines,
      validateImmediately: Boolean(validateImmediately),
    };
  };

  const handleStart = async () => {
    if (!doc?._id) return;
    setSaving(true);
    try {
      const res = await axios.post(
        `${Base_URL}/inventory-adjustments/${doc._id}/start`,
        { includeZero: false },
        { headers },
      );
      notifySuccess(res.data?.message || "Inventory count started");
      setDoc(res.data?.data);
      hydrateLines(res.data?.data);
    } catch (err) {
      notifyError(err?.response?.data?.message || "Failed to start count");
    } finally {
      setSaving(false);
    }
  };

  const updateLineLocal = (lineId, field, value) => {
    setLineEdits((prev) => ({
      ...prev,
      [lineId]: {
        ...(prev[lineId] || {}),
        [field]: value,
      },
    }));
  };

  const getLineDiff = (line) => {
    const edit = lineEdits[line._id];
    const expected = Math.max(0, parseFloat(line.expectedQty) || 0);
    // Empty actual = no change (same as expected)
    if (!edit || edit.actualQty === "" || edit.actualQty === null) {
      return 0;
    }
    const actual = Math.max(0, parseFloat(edit.actualQty) || 0);
    return Number((actual - expected).toFixed(2));
  };

  const handleSaveLines = async () => {
    if (!doc || !editable) return;

    setSaving(true);
    try {
      if (isSession) {
        const res = await axios.post(
          `${Base_URL}/inventory-adjustments`,
          buildSessionCreatePayload(false),
          { headers },
        );
        notifySuccess(res.data?.message || "Inventory counts saved");
        const created = res.data?.data;
        setDoc(created);
        hydrateLines(created);
        if (created?._id) {
          history.replace(`/inventory-adjustments/${created._id}`);
        }
      } else {
        const lines = Object.entries(lineEdits).map(([lineId, edit]) => ({
          lineId,
          actualQty: edit.actualQty === "" ? undefined : edit.actualQty,
          reason: edit.reason || null,
          notes: edit.notes || "",
        }));
        const res = await axios.put(
          `${Base_URL}/inventory-adjustments/${doc._id}/lines`,
          { lines },
          { headers },
        );
        notifySuccess(res.data?.message || "Lines saved");
        setDoc(res.data?.data);
        hydrateLines(res.data?.data);
      }
    } catch (err) {
      notifyError(err?.response?.data?.message || "Failed to save lines");
    } finally {
      setSaving(false);
    }
  };

  const openValidateModal = () => {
    if (!doc || !editable) return;

    const missingReason = (doc.lines || []).filter((line) => {
      const diff = getLineDiff(line);
      const edit = lineEdits[line._id];
      return diff !== 0 && !edit?.reason;
    });
    if (missingReason.length) {
      notifyError(
        `Select a reason for lines with a difference (${missingReason.length} missing)`,
      );
      return;
    }

    setValidateModalOpen(true);
  };

  const confirmValidate = async () => {
    if (!doc || !editable) return;

    setSaving(true);
    try {
      if (isSession) {
        const res = await axios.post(
          `${Base_URL}/inventory-adjustments`,
          buildSessionCreatePayload(true),
          { headers },
        );
        setValidateModalOpen(false);
        notifySuccess(
          res.data?.message || "Adjustment validated — stock updated",
        );
        const created = res.data?.data;
        setDoc(created);
        hydrateLines(created);
        if (created?._id) {
          history.replace(`/inventory-adjustments/${created._id}`);
        }
      } else {
        const lines = Object.entries(lineEdits).map(([lineId, edit]) => ({
          lineId,
          actualQty: edit.actualQty === "" ? undefined : edit.actualQty,
          reason: edit.reason || null,
          notes: edit.notes || "",
        }));
        await axios.put(
          `${Base_URL}/inventory-adjustments/${doc._id}/lines`,
          { lines },
          { headers },
        );
        const res = await axios.post(
          `${Base_URL}/inventory-adjustments/${doc._id}/validate`,
          {},
          { headers },
        );
        setValidateModalOpen(false);
        notifySuccess(
          res.data?.message || "Adjustment validated — stock updated",
        );
        setDoc(res.data?.data);
        hydrateLines(res.data?.data);
      }
    } catch (err) {
      notifyError(err?.response?.data?.message || "Failed to validate");
    } finally {
      setSaving(false);
    }
  };

  const summary = useMemo(() => {
    const lines = doc?.lines || [];
    let withDiff = 0;
    let missing = 0;
    let surplus = 0;
    lines.forEach((line) => {
      const diff = getLineDiff(line);
      if (diff !== 0) withDiff += 1;
      if (diff < 0) missing += Math.abs(diff);
      if (diff > 0) surplus += diff;
    });
    return { total: lines.length, withDiff, missing, surplus };
  }, [doc, lineEdits]);

  const FieldLoader = ({ label = "Loading…" }) => (
    <div className="flex items-center gap-2 h-10 px-3 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-500">
      <span
        className="inline-block w-4 h-4 border-2 border-gray-300 border-t-[var(--p-blue)] rounded-full animate-spin"
        aria-hidden
      />
      {label}
    </div>
  );

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

  // ── Setup screen (no DB record yet) ────────────────────────
  if (isCreate && !doc) {
    return (
      <RoutePermissionGate>
        <div className="bg-gray-50 min-h-screen w-full">
          <div className="w-full max-w-3xl mx-auto px-6 py-8">
            <PageHeader
              title={tWithFallback(
                "inventoryAdjustment.start",
                "Start Inventory Count",
              )}
              description={tWithFallback(
                "inventoryAdjustment.createHint",
                "Choose warehouse (and optional location). The count will not appear in the list until you Save Counts or Validate.",
              )}
              showBackButton
              onBackClick={exitScreen}
            />

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5 mt-6">
              {!isSingleAssignedBusiness() && <InputFieldWithLabel
                label={t("Business")}
                required
                direction="column"
                Input={
                  loadingBusinesses ? (
                    <FieldLoader label="Loading businesses…" />
                  ) : (
                    <DropdownBasic
                      value={form.business}
                      onChange={(v) =>
                        setForm((p) => ({
                          ...p,
                          business: v || "",
                          warehouse: "",
                          location: "",
                        }))
                      }
                      options={businesses.map((b) => ({
                        value: b._id,
                        label: b.name,
                      }))}
                      placeholder="Select business"
                    />
                  )
                }
              />}
              <InputFieldWithLabel
                label={tWithFallback("warehouse.title", "Warehouse")}
                required
                direction="column"
                Input={
                  !form.business ? (
                    <div className="h-10 px-3 flex items-center text-sm text-gray-400 border border-gray-200 rounded-lg bg-gray-50">
                      Select business first
                    </div>
                  ) : loadingWarehouses ? (
                    <FieldLoader label="Loading warehouses…" />
                  ) : (
                    <DropdownBasic
                      value={form.warehouse}
                      onChange={(v) =>
                        setForm((p) => ({
                          ...p,
                          warehouse: v || "",
                          location: "",
                        }))
                      }
                      options={warehouses.map((w) => ({
                        value: w._id,
                        label: `${w.name}${w.code ? ` (${w.code})` : ""}`,
                      }))}
                      placeholder="Select warehouse"
                    />
                  )
                }
              />
              <InputFieldWithLabel
                label={tWithFallback(
                  "inventoryAdjustment.locationOptional",
                  "Location (optional)",
                )}
                direction="column"
                Input={
                  !form.warehouse ? (
                    <div className="h-10 px-3 flex items-center text-sm text-gray-400 border border-gray-200 rounded-lg bg-gray-50">
                      Select warehouse first
                    </div>
                  ) : loadingLocations ? (
                    <FieldLoader label="Loading locations…" />
                  ) : (
                    <DropdownBasic
                      value={form.location}
                      onChange={(v) =>
                        setForm((p) => ({ ...p, location: v || "" }))
                      }
                      options={[
                        { value: "", label: "Entire warehouse", first: true },
                        ...locations.map((l) => ({
                          value: l._id,
                          label: `${l.name}${l.code ? ` (${l.code})` : ""}`,
                        })),
                      ]}
                      placeholder="Entire warehouse"
                    />
                  )
                }
              />
              <InputFieldWithLabel
                label={tWithFallback("inventoryAdjustment.name", "Name")}
                required
                direction="column"
                Input={
                  <InputField
                    name="name"
                    value={form.name}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, name: e.target.value }))
                    }
                  />
                }
              />
              <InputFieldWithLabel
                label={t("Notes") || "Notes"}
                direction="column"
                Input={
                  <InputField
                    name="notes"
                    value={form.notes}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, notes: e.target.value }))
                    }
                  />
                }
              />

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  checked={form.includeZero}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      includeZero: e.target.checked,
                    }))
                  }
                />
                {tWithFallback(
                  "inventoryAdjustment.includeZero",
                  "Include products with zero system stock",
                )}
              </label>

              <div className="flex flex-wrap gap-3 justify-end pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={exitScreen}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  {t("Cancel") || "Cancel"}
                </button>
                <button
                  type="button"
                  disabled={saving || !canAdd}
                  onClick={handleCreate}
                  className="inline-flex items-center justify-center gap-2 px-6 py-2 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[var(--p-blue-dark)] disabled:opacity-50 shadow-sm"
                >
                  {saving && (
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  )}
                  {saving
                    ? "Loading…"
                    : tWithFallback(
                        "inventoryAdjustment.start",
                        "Start Inventory Count",
                      )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </RoutePermissionGate>
    );
  }

  const contextDescription = [
    doc?.business?.name,
    doc?.warehouse?.name,
    doc?.location?.name,
  ]
    .filter(Boolean)
    .join(" · ");

  // ── Detail / count screen (session or saved) ───────────────
  return (
    <RoutePermissionGate>
      <div className="bg-gray-50 min-h-screen w-full pb-16">
        <div className="w-full max-w-6xl mx-auto px-6 py-8">
          <PageHeader
            title={doc?.name || "Inventory Adjustment"}
            description={
              contextDescription ||
              tWithFallback(
                "inventoryAdjustment.formHint",
                "Enter physical counts. Empty Actual means no change from Expected.",
              )
            }
            showBackButton
            onBackClick={exitScreen}
            renderActions={
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${
                    isSession
                      ? "bg-blue-100 text-blue-800"
                      : STATUS_STYLES[doc?.status] || STATUS_STYLES.draft
                  }`}
                >
                  {isSession
                    ? "Not saved yet"
                    : STATUS_LABELS[doc?.status] || doc?.status}
                </span>
                {doc?.reference ? (
                  <span className="text-sm text-gray-600 font-mono">
                    {doc.reference}
                  </span>
                ) : null}
              </div>
            }
          />

          {isSession && (
            <div className="mb-6 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              This count is not in the Inventory Adjustments list yet. It will
              appear after you <strong>Save Counts</strong> or{" "}
              <strong>Validate Adjustment</strong>.
            </div>
          )}

          {doc?.status === "draft" && (
            <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-amber-900">
                Count not started yet. Starting snapshots expected quantities
                from system stock.
              </p>
              {canUpdate && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleStart}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[var(--p-blue-dark)] disabled:opacity-50 shadow-sm"
                >
                  {saving && (
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  )}
                  Start Count
                </button>
              )}
            </div>
          )}

          {doc?.status === "done" && (
            <div className="mb-6 text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-4 py-3">
              Validated
              {doc.validatedAt
                ? ` on ${formatDate(doc.validatedAt, false, true)}`
                : ""}
              . System stock was updated to match physical counts.
            </div>
          )}

          {(doc?.lines || []).length > 0 && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {[
                  { label: "Lines", value: summary.total },
                  { label: "With difference", value: summary.withDiff },
                  {
                    label: "Missing (units)",
                    value: formatQuantity(summary.missing),
                    className: "text-red-600",
                  },
                  {
                    label: "Surplus (units)",
                    value: formatQuantity(summary.surplus),
                    className: "text-green-700",
                  },
                ].map((card) => (
                  <div
                    key={card.label}
                    className="bg-white border border-gray-200 rounded-xl shadow-sm p-4"
                  >
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {card.label}
                    </div>
                    <div
                      className={`text-2xl font-semibold mt-1 ${
                        card.className || "text-gray-900"
                      }`}
                    >
                      {card.value}
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">
                          Product
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">
                          Location
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">
                          Lot / Serial
                        </th>
                        <th className="text-right py-3 px-4 font-medium text-gray-700">
                          Expected
                        </th>
                        <th className="text-right py-3 px-4 font-medium text-gray-700">
                          Actual
                        </th>
                        <th className="text-right py-3 px-4 font-medium text-gray-700">
                          Difference
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">
                          Reason
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">
                          Notes
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(doc.lines || []).map((line) => {
                        const edit = lineEdits[line._id] || {};
                        const hasActual =
                          edit.actualQty !== "" &&
                          edit.actualQty !== null &&
                          edit.actualQty !== undefined;
                        const diff = getLineDiff(line);
                        const unit = line.item?.uom || line.item?.unit || "";
                        const readOnly = !editable;

                        return (
                          <tr
                            key={line._id}
                            className="border-b border-gray-100 align-top hover:bg-gray-50/60"
                          >
                            <td className="py-3 px-4">
                              <div className="font-medium text-gray-900">
                                {line.item?.name || "—"}
                              </div>
                              <div className="text-xs text-gray-500">
                                {line.item?.itemCode || ""}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-gray-700">
                              {line.location?.name || "—"}
                            </td>
                            <td className="py-3 px-4 font-mono text-xs text-gray-600">
                              {line.lotNumber || "—"}
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap text-gray-700">
                              {formatQuantity(line.expectedQty)}
                              {unit ? ` ${unit}` : ""}
                            </td>
                            <td className="py-3 px-4 text-right">
                              {readOnly ? (
                                <span>
                                  {formatQuantity(line.actualQty)}
                                  {unit ? ` ${unit}` : ""}
                                </span>
                              ) : (
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  className="w-28 border border-transparent bg-gray-100 rounded-lg px-3 py-1.5 text-right shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300"
                                  value={edit.actualQty ?? ""}
                                  onChange={(e) =>
                                    updateLineLocal(
                                      line._id,
                                      "actualQty",
                                      e.target.value,
                                    )
                                  }
                                  placeholder="No change"
                                  title="Leave empty = same as Expected (no change)"
                                />
                              )}
                            </td>
                            <td
                              className={`py-3 px-4 text-right font-medium ${
                                !hasActual && !readOnly
                                  ? "text-gray-400"
                                  : diff < 0
                                    ? "text-red-600"
                                    : diff > 0
                                      ? "text-green-700"
                                      : "text-gray-600"
                              }`}
                            >
                              {!hasActual && !readOnly
                                ? "0 (no change)"
                                : `${diff > 0 ? "+" : ""}${formatQuantity(diff)}`}
                            </td>
                            <td className="py-3 px-4 min-w-[160px]">
                              {readOnly ? (
                                <span>
                                  {reasons.find((r) => r.value === line.reason)
                                    ?.label ||
                                    line.reason ||
                                    "—"}
                                </span>
                              ) : (
                                <select
                                  className="w-full border border-transparent bg-gray-100 rounded-lg px-2 py-1.5 shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300 disabled:opacity-60"
                                  value={edit.reason || ""}
                                  onChange={(e) =>
                                    updateLineLocal(
                                      line._id,
                                      "reason",
                                      e.target.value,
                                    )
                                  }
                                  disabled={diff === 0}
                                >
                                  <option value="">
                                    {diff === 0 ? "—" : "Select reason"}
                                  </option>
                                  {reasons.map((r) => (
                                    <option key={r.value} value={r.value}>
                                      {r.label}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              {readOnly ? (
                                <span className="text-gray-600">
                                  {line.notes || "—"}
                                </span>
                              ) : (
                                <input
                                  type="text"
                                  className="w-full border border-transparent bg-gray-100 rounded-lg px-3 py-1.5 shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300"
                                  value={edit.notes || ""}
                                  onChange={(e) =>
                                    updateLineLocal(
                                      line._id,
                                      "notes",
                                      e.target.value,
                                    )
                                  }
                                  placeholder="Optional"
                                />
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {editable && (
                <div className="flex flex-wrap gap-3 justify-end">
                  <button
                    type="button"
                    onClick={exitScreen}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleSaveLines}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-[var(--p-blue)] text-[var(--p-blue)] rounded-lg hover:bg-orange-50 disabled:opacity-50"
                  >
                    {saving && (
                      <span className="w-4 h-4 border-2 border-[var(--p-blue)]/30 border-t-[var(--p-blue)] rounded-full animate-spin" />
                    )}
                    {saving ? "Saving…" : "Save Counts"}
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={openValidateModal}
                    className="inline-flex items-center justify-center gap-2 px-6 py-2 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[var(--p-blue-dark)] disabled:opacity-50 shadow-sm"
                  >
                    Validate Adjustment
                  </button>
                </div>
              )}
            </>
          )}

          {doc?.status === "in_progress" && !(doc.lines || []).length && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center text-gray-500">
              No lines on this adjustment.
            </div>
          )}
        </div>

        <Modal
          isOpen={validateModalOpen}
          onClose={() => !saving && setValidateModalOpen(false)}
        >
          <ModalHeader>Validate Inventory Adjustment</ModalHeader>
          <ModalBody>
            <p className="text-gray-700 mb-3">
              System stock will be updated to match your physical counts.
            </p>
            <ul className="text-sm text-gray-600 space-y-1 list-disc pl-5">
              <li>
                Lines with empty <strong>Actual</strong> stay unchanged (same as
                Expected).
              </li>
              <li>
                Only lines with a difference will update stock
                {summary.withDiff > 0
                  ? ` (${summary.withDiff} line${
                      summary.withDiff === 1 ? "" : "s"
                    })`
                  : " (none right now)"}
                .
              </li>
              {summary.missing > 0 && (
                <li>
                  Missing:{" "}
                  <span className="text-red-600 font-medium">
                    {summary.missing}
                  </span>{" "}
                  units
                </li>
              )}
              {summary.surplus > 0 && (
                <li>
                  Surplus:{" "}
                  <span className="text-green-700 font-medium">
                    {summary.surplus}
                  </span>{" "}
                  units
                </li>
              )}
            </ul>
            {doc?.reference && (
              <p className="text-xs text-gray-400 mt-3">
                Reference: {doc.reference}
              </p>
            )}
          </ModalBody>
          <ModalFooter>
            <button
              type="button"
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              disabled={saving}
              onClick={() => setValidateModalOpen(false)}
            >
              Back
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[var(--p-blue-dark)] disabled:opacity-50"
              disabled={saving}
              onClick={confirmValidate}
            >
              {saving && (
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              )}
              {saving ? "Validating…" : "Confirm & Update Stock"}
            </button>
          </ModalFooter>
        </Modal>
      </div>
    </RoutePermissionGate>
  );
};

export default InventoryAdjustmentForm;
