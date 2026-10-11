import React, { useState, useEffect, useMemo, useContext, useCallback } from "react";
import axios from "axios";
import { useHistory } from "react-router-dom";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@windmill/react-ui";
import { DataTable, ActionButtons } from "@/page-layouts";
import {
  DropdownBasic,
  InputFieldWithLabel,
  InputLabel,
} from "@/page-layouts/index";
import { notifyError, notifySuccess } from "@/utils/toast";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";
import { useRouteModulePermissions } from "@/utils/permissionUtils";
import RoutePermissionGate from "@/components/RoutePermissionGate";
import { syncAssignedBusinessesFromApi, isSingleAssignedBusiness, getSoleAssignedBusinessId } from "@/utils/sessionAssignedBusinesses";
import { AdminContext } from "@/context/AdminContext";
import {
  formatAmount,
  formatDate,
  formatQuantity,
} from "@/components/formatAmount";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const formatStockQty = (qty, unit) => {
  const formatted = formatQuantity(qty);
  if (formatted === "N/A") return "-";
  const u = unit ? ` ${unit}` : "";
  return `${formatted}${u}`;
};

const StockLevels = () => {
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

  const { canAdd, canUpdate } = useRouteModulePermissions();
  const tWithFallback = (key, fallback) => {
    const translated = t(key, { defaultValue: fallback });
    return translated && translated !== key ? translated : fallback;
  };

  const [businesses, setBusinesses] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [locations, setLocations] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBusiness, setSelectedBusiness] = useState("");
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [totalResults, setTotalResults] = useState(0);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    businessId: "",
    warehouseId: "",
    locationId: "",
    itemId: "",
    quantity: "",
    lotNumber: "",
    expiryDate: "",
    notes: "",
    quantId: null,
    itemTrackingMethod: "none",
  });
  const [modalWarehouses, setModalWarehouses] = useState([]);
  const [modalLocations, setModalLocations] = useState([]);
  const [modalItems, setModalItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await syncAssignedBusinessesFromApi(Base_URL);
      if (!cancelled) {
        setBusinesses(list || []);
        if (list?.length === 1) {
          setSelectedBusiness(list[0]._id);
          setForm((p) => ({ ...p, businessId: p.businessId || list[0]._id }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedBusiness) {
      setWarehouses([]);
      setSelectedWarehouse("");
      return;
    }
    (async () => {
      try {
        const res = await axios.get(`${Base_URL}/warehouses`, {
          headers,
          params: { businessId: selectedBusiness, status: "Active", limit: 100 },
        });
        setWarehouses(res.data?.data || []);
      } catch (_) {
        setWarehouses([]);
      }
    })();
  }, [selectedBusiness, headers]);

  useEffect(() => {
    if (!selectedWarehouse) {
      setLocations([]);
      setSelectedLocation("");
      return;
    }
    (async () => {
      try {
        const res = await axios.get(`${Base_URL}/locations`, {
          headers,
          params: { warehouseId: selectedWarehouse, storeableOnly: "true" },
        });
        setLocations(res.data?.data || []);
      } catch (_) {
        setLocations([]);
      }
    })();
  }, [selectedWarehouse, headers]);

  // Modal: load warehouses when modal business changes
  useEffect(() => {
    if (!modalOpen || !form.businessId) {
      setModalWarehouses([]);
      return;
    }
    (async () => {
      try {
        const res = await axios.get(`${Base_URL}/warehouses`, {
          headers,
          params: { businessId: form.businessId, status: "Active", limit: 100 },
        });
        setModalWarehouses(res.data?.data || []);
      } catch (_) {
        setModalWarehouses([]);
      }
    })();
  }, [modalOpen, form.businessId, headers]);

  // Modal: load locations when modal warehouse changes
  useEffect(() => {
    if (!modalOpen || !form.warehouseId) {
      setModalLocations([]);
      return;
    }
    (async () => {
      try {
        const res = await axios.get(`${Base_URL}/locations`, {
          headers,
          params: { warehouseId: form.warehouseId, storeableOnly: "true" },
        });
        setModalLocations(res.data?.data || []);
      } catch (_) {
        setModalLocations([]);
      }
    })();
  }, [modalOpen, form.warehouseId, headers]);

  // Modal: load items for modal business
  useEffect(() => {
    if (!modalOpen || !form.businessId) {
      setModalItems([]);
      return;
    }
    (async () => {
      try {
        const res = await axios.get(`${Base_URL}/items`, {
          headers,
          params: {
            businessId: form.businessId,
            status: "Active",
            limit: 500,
          },
        });
        const list = res.data?.items || res.data?.data || res.data || [];
        setModalItems(Array.isArray(list) ? list : []);
      } catch (_) {
        setModalItems([]);
      }
    })();
  }, [modalOpen, form.businessId, headers]);

  const fetchLevels = useCallback(
    async (page = 1, limit = recordsPerPage, search = searchTerm) => {
      try {
        setLoading(true);
        const params = {
          page,
          limit,
          search: search || undefined,
        };
        if (selectedBusiness) params.businessId = selectedBusiness;
        else if (businesses.length) {
          params.businessIds = businesses.map((b) => b._id).join(",");
        }
        if (selectedWarehouse) params.warehouseId = selectedWarehouse;
        if (selectedLocation) params.locationId = selectedLocation;

        const res = await axios.get(`${Base_URL}/stock-levels`, {
          headers,
          params,
        });
        setRows(res.data?.data || []);
        setTotalResults(res.data?.total || 0);
      } catch (err) {
        notifyError(
          err?.response?.data?.message ||
            tWithFallback("stockLevel.fetchFailed", "Failed to load stock levels"),
        );
        setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [
      headers,
      selectedBusiness,
      selectedWarehouse,
      selectedLocation,
      businesses,
      recordsPerPage,
      searchTerm,
    ],
  );

  useEffect(() => {
    setCurrentPage(1);
    fetchLevels(1, recordsPerPage, searchTerm);
  }, [selectedBusiness, selectedWarehouse, selectedLocation, businesses.length]);

  const openSetStock = (row = null) => {
    const bizId =
      row?.business?._id || selectedBusiness || businesses[0]?._id || "";
    const whId = row?.warehouse?._id || selectedWarehouse || "";
    setErrors({});
    setForm({
      businessId: bizId,
      warehouseId: whId,
      locationId: row?.location?._id || selectedLocation || "",
      itemId: row?.item?._id || "",
      quantity: row ? String(row.quantity ?? "") : "",
      lotNumber: row?.lotNumber || "",
      expiryDate: row?.expiryDate
        ? new Date(row.expiryDate).toISOString().slice(0, 10)
        : "",
      notes: "",
      quantId: row?._id || null,
      itemTrackingMethod:
        row?.item?.trackingMethod ||
        row?.item?.stockInformation?.trackingMethod ||
        "none",
    });
    setModalOpen(true);
  };

  const clearFieldError = (field) => {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const selectedModalItem = modalItems.find((it) => it._id === form.itemId);
  const itemTracking =
    selectedModalItem?.trackingMethod ||
    selectedModalItem?.stockInformation?.trackingMethod ||
    form.itemTrackingMethod ||
    "none";
  const requiresLotOrSerial =
    itemTracking === "lot" || itemTracking === "serial";

  const validateStockForm = () => {
    const next = {};
    if (!form.businessId) {
      next.businessId = tWithFallback(
        "stockLevel.businessRequired",
        "Business is required",
      );
    }
    if (!form.warehouseId) {
      next.warehouseId = tWithFallback(
        "stockLevel.warehouseRequired",
        "Warehouse is required",
      );
    }
    if (!form.locationId) {
      next.locationId = tWithFallback(
        "stockLevel.locationRequired",
        "Location is required",
      );
    }
    if (!form.itemId) {
      next.itemId = tWithFallback(
        "stockLevel.itemRequired",
        "Item is required",
      );
    }
    if (form.quantity === "" || form.quantity === null || form.quantity === undefined) {
      next.quantity = tWithFallback(
        "stockLevel.quantityRequired",
        "On-hand quantity is required",
      );
    } else {
      const qty = parseFloat(form.quantity);
      if (Number.isNaN(qty)) {
        next.quantity = tWithFallback(
          "stockLevel.quantityInvalid",
          "Enter a valid quantity",
        );
      } else if (qty < 0) {
        next.quantity = tWithFallback(
          "stockLevel.quantityNegative",
          "Quantity cannot be negative",
        );
      } else if (itemTracking === "serial" && qty > 1) {
        next.quantity = tWithFallback(
          "stockLevel.serialQtyMax",
          "Serial-tracked stock quantity cannot exceed 1",
        );
      }
    }
    if (requiresLotOrSerial && !String(form.lotNumber || "").trim()) {
      next.lotNumber =
        itemTracking === "serial"
          ? tWithFallback(
              "stockLevel.serialRequired",
              "Serial number is required for this item",
            )
          : tWithFallback(
              "stockLevel.lotRequired",
              "Lot number is required for this item",
            );
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSaveStock = async () => {
    if (!validateStockForm()) return;
    setSaving(true);
    try {
      await axios.post(
        `${Base_URL}/stock-levels/set`,
        {
          locationId: form.locationId,
          itemId: form.itemId,
          quantity: parseFloat(form.quantity),
          notes: form.notes,
          lotNumber: form.lotNumber || "",
          expiryDate: form.expiryDate || undefined,
          quantId: form.quantId || undefined,
        },
        { headers },
      );
      notifySuccess(
        form.quantId ? "Stock updated" : "Stock saved at location",
      );
      setModalOpen(false);
      setErrors({});
      fetchLevels(currentPage, recordsPerPage, searchTerm);
    } catch (err) {
      const message =
        err?.response?.data?.message || "Failed to save stock";
      const lower = String(message).toLowerCase();
      if (lower.includes("serial") || lower.includes("lot")) {
        setErrors((prev) => ({ ...prev, lotNumber: message }));
      } else if (lower.includes("quantity") || lower.includes("qty")) {
        setErrors((prev) => ({ ...prev, quantity: message }));
      } else if (lower.includes("location")) {
        setErrors((prev) => ({ ...prev, locationId: message }));
      } else if (lower.includes("item")) {
        setErrors((prev) => ({ ...prev, itemId: message }));
      } else if (lower.includes("warehouse")) {
        setErrors((prev) => ({ ...prev, warehouseId: message }));
      } else {
        notifyError(message);
      }
    } finally {
      setSaving(false);
    }
  };

  const tableHeaders = [
    "Item",
    "On hand",
    "Reserved",
    "Available",
    "Lot / Serial",
    "Unit cost",
    "Expiry",
    "Warehouse",
    "Location",
    "Place",
    "Business",
    "Action",
  ];

  const clearFilters = () => {
    const onlySearchActive =
      Boolean(searchTerm) &&
      !selectedBusiness &&
      !selectedWarehouse &&
      !selectedLocation;
    setSelectedBusiness("");
    setSelectedWarehouse("");
    setSelectedLocation("");
    setSearchTerm("");
    setCurrentPage(1);
    // Dropdown changes refetch via useEffect; search-only needs an explicit fetch.
    if (onlySearchActive) {
      fetchLevels(1, recordsPerPage, "");
    }
  };

  const hasActiveFilters = Boolean(
    selectedBusiness ||
      selectedWarehouse ||
      selectedLocation ||
      searchTerm,
  );

  const filters = [
    ...(hasActiveFilters
      ? [
          {
            isClearButton: true,
            tooltip: tWithFallback("stockLevel.clearFilters", "Clear Filters"),
            buttonProps: {
              onClick: clearFilters,
            },
          },
        ]
      : []),
    ...(!isSingleAssignedBusiness() ? [{
      value: selectedBusiness || "",
      onChange: (v) => {
        setSelectedBusiness(v || "");
        setSelectedWarehouse("");
        setSelectedLocation("");
      },
      placeholder: t("item.selectBusinesses") || "Business",
      options: [
        { value: "", label: "All Businesses" },
        ...businesses.map((b) => ({ value: b._id, label: b.name })),
      ],
    }] : []),
    {
      value: selectedWarehouse || "",
      onChange: (v) => {
        setSelectedWarehouse(v || "");
        setSelectedLocation("");
      },
      placeholder: "Warehouse",
      options: [
        { value: "", label: "All Warehouses" },
        ...warehouses.map((w) => ({
          value: w._id,
          label: `${w.name} (${w.code})`,
        })),
      ],
    },
    {
      value: selectedLocation || "",
      onChange: (v) => setSelectedLocation(v || ""),
      placeholder: "Location",
      options: [
        { value: "", label: "All Locations" },
        ...locations.map((l) => ({
          value: l._id,
          label: `${l.code} — ${l.name}`,
        })),
      ],
    },
  ];

  return (
    <RoutePermissionGate>
      <div className="bg-gray-50 min-h-screen w-full">
        <div className="w-full mx-auto px-6 py-8">
          <div className="mb-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {tWithFallback("stockLevel.title", "Stock Levels")}
              </h1>
              <p className="text-gray-600 mt-2">
                {tWithFallback(
                  "stockLevel.description",
                  "See how much stock you have and where it is (e.g. 40 kg chicken on Rack A / Shelf 01).",
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => history.push("/locations")}
                className="px-4 py-3 border border-gray-300 rounded-lg"
              >
                Locations
              </button>
              {(canAdd || canUpdate) && (
                <button
                  type="button"
                  onClick={() => openSetStock()}
                  className="flex items-center gap-2 px-6 py-3 bg-[var(--p-blue)] text-white rounded-lg"
                >
                  <Plus size={18} />
                  Set Stock
                </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <DataTable
              onSearch={(v) => {
                setSearchTerm(v || "");
                setCurrentPage(1);
                fetchLevels(1, recordsPerPage, v || "");
              }}
              searchValue={searchTerm}
              searchPlaceholder="Search item, location, warehouse…"
              filters={filters}
              loading={loading}
              headers={tableHeaders}
              data={rows}
              totalRecords={totalResults}
              recordsPerPage={recordsPerPage}
              currentPage={currentPage}
              totalPages={Math.ceil(totalResults / recordsPerPage) || 1}
              onPageChange={(page) => {
                setCurrentPage(page);
                fetchLevels(page, recordsPerPage, searchTerm);
              }}
              onRecordsPerPageChange={(n) => {
                setRecordsPerPage(n);
                setCurrentPage(1);
                fetchLevels(1, n, searchTerm);
              }}
              emptyMessage="No stock placed yet. Click Set Stock — e.g. 40 kg chicken on a shelf."
              renderRow={(row) => (
                <tr key={row._id} className="border-b" style={{ fontSize: "14px" }}>
                  <td className="py-2 px-4">
                    <div className="font-medium">{row.item?.name || "-"}</div>
                    <div className="text-xs text-gray-500">
                      {row.item?.itemCode || ""}
                    </div>
                  </td>
                  <td className="py-2 px-4">
                    <span className="font-semibold text-gray-900">
                      {formatStockQty(
                        row.quantity,
                        row.item?.unit || row.item?.uom,
                      )}
                    </span>
                  </td>
                  <td className="py-2 px-4 text-amber-800">
                    {formatStockQty(
                      row.reservedQuantity || 0,
                      row.item?.unit || row.item?.uom,
                    )}
                  </td>
                  <td className="py-2 px-4 text-emerald-800 font-medium">
                    {formatStockQty(
                      Math.max(
                        0,
                        (Number(row.quantity) || 0) -
                          (Number(row.reservedQuantity) || 0),
                      ),
                      row.item?.unit || row.item?.uom,
                    )}
                  </td>
                  <td className="py-2 px-4 font-mono text-sm">
                    {row.lotNumber || "—"}
                  </td>
                  <td className="py-2 px-4 text-right">
                    {formatAmount(row.unitCost || 0)}
                  </td>
                  <td className="py-2 px-4">
                    {row.expiryDate ? formatDate(row.expiryDate) || "—" : "—"}
                  </td>
                  <td className="py-2 px-4">
                    {row.warehouse?.name || "-"}
                    <div className="text-xs text-gray-500 font-mono">
                      {row.warehouse?.code}
                    </div>
                  </td>
                  <td className="py-2 px-4">
                    {row.location?.name || "-"}
                    <div className="text-xs text-gray-500 font-mono">
                      {row.location?.code}
                    </div>
                  </td>
                  <td className="py-2 px-4 capitalize">
                    {row.location?.storageKind || "-"}
                  </td>
                  <td className="py-2 px-4">{row.business?.name || "-"}</td>
                  <td className="py-2 px-4">
                    {(canUpdate || canAdd) && (
                      <ActionButtons
                        items={[
                          {
                            tooltip: "Edit",
                            action: ACTION_BUTTON_TYPES.EDIT,
                            onClick: () => openSetStock(row),
                          },
                        ]}
                      />
                    )}
                  </td>
                </tr>
              )}
            />
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
            {form.quantId ? "Edit Stock" : "Set Stock at Location"}
          </ModalHeader>
          <ModalBody>
            <div className="max-h-[min(65vh,520px)] overflow-y-auto space-y-3 pr-1">
              {form.quantId && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Editing this stock row — item is locked. You can change
                  warehouse, location, quantity, lot or expiry. To place a
                  different item, use “Set Stock” instead.
                </p>
              )}
              {!isSingleAssignedBusiness() && <div>
                <InputLabel
                  label="Business"
                  required
                  direction="column"
                  error={!!errors.businessId}
                />
                <DropdownBasic
                  options={businesses.map((b) => ({
                    value: b._id,
                    label: b.name,
                  }))}
                  value={form.businessId}
                  onChange={(v) => {
                    clearFieldError("businessId");
                    setForm((p) => ({
                      ...p,
                      businessId: v || "",
                      warehouseId: "",
                      locationId: "",
                      itemId: p.quantId ? p.itemId : "",
                      quantId: p.quantId || null,
                    }));
                  }}
                  isClearable={false}
                  isDisabled={Boolean(form.quantId)}
                  placeholder="Select business"
                  error={errors.businessId}
                  shouldShowError={!!errors.businessId}
                />
              </div>}

              <div>
                <InputLabel
                  label="Warehouse"
                  required
                  direction="column"
                  error={!!errors.warehouseId}
                />
                <DropdownBasic
                  options={modalWarehouses.map((w) => ({
                    value: w._id,
                    label: `${w.name} (${w.code})`,
                  }))}
                  value={form.warehouseId}
                  onChange={(v) => {
                    clearFieldError("warehouseId");
                    clearFieldError("locationId");
                    setForm((p) => ({
                      ...p,
                      warehouseId: v || "",
                      locationId: "",
                    }));
                  }}
                  isClearable={false}
                  isDisabled={!form.businessId}
                  placeholder={
                    form.businessId
                      ? modalWarehouses.length
                        ? "Select warehouse"
                        : "No warehouse — create one first"
                      : "Select business first"
                  }
                  error={errors.warehouseId}
                  shouldShowError={!!errors.warehouseId}
                />
              </div>

              <div>
                <InputLabel
                  label="Location"
                  required
                  direction="column"
                  error={!!errors.locationId}
                />
                <DropdownBasic
                  options={modalLocations.map((l) => ({
                    value: l._id,
                    label: `${l.code} — ${l.name} (${l.storageKind})`,
                  }))}
                  value={form.locationId}
                  onChange={(v) => {
                    clearFieldError("locationId");
                    setForm((p) => ({
                      ...p,
                      locationId: v || "",
                    }));
                  }}
                  isClearable={false}
                  isDisabled={!form.warehouseId}
                  placeholder={
                    form.warehouseId
                      ? modalLocations.length
                        ? "Select rack / shelf / bin"
                        : "No locations — add under Locations"
                      : "Select warehouse first"
                  }
                  error={errors.locationId}
                  shouldShowError={!!errors.locationId}
                />
              </div>

              <div>
                <InputLabel
                  label="Item"
                  required
                  direction="column"
                  error={!!errors.itemId}
                />
                <DropdownBasic
                  options={modalItems.map((it) => ({
                    value: it._id,
                    label: `${it.name}${it.itemCode ? ` (${it.itemCode})` : ""}${
                      it.stockInformation?.enabled
                        ? ` — now ${formatStockQty(
                            it.stockInformation?.stock,
                            it.unit || it.uom,
                          )}`
                        : ""
                    }`,
                  }))}
                  value={form.itemId}
                  onChange={(v) => {
                    clearFieldError("itemId");
                    clearFieldError("lotNumber");
                    clearFieldError("quantity");
                    const selected = modalItems.find((it) => it._id === v);
                    setForm((p) => ({
                      ...p,
                      itemId: v || "",
                      itemTrackingMethod:
                        selected?.trackingMethod ||
                        selected?.stockInformation?.trackingMethod ||
                        "none",
                    }));
                  }}
                  isClearable={false}
                  isDisabled={Boolean(form.quantId) || !form.businessId}
                  placeholder={
                    form.businessId ? "Select item" : "Select business first"
                  }
                  error={errors.itemId}
                  shouldShowError={!!errors.itemId}
                />
              </div>

              <InputFieldWithLabel
                label={`On-hand quantity${
                  selectedModalItem?.unit || selectedModalItem?.uom
                    ? ` (${selectedModalItem.unit || selectedModalItem.uom})`
                    : ""
                }`}
                name="quantity"
                type="number"
                min="0"
                step="0.01"
                required
                direction="column"
                tightLabelInputSpacing
                value={form.quantity}
                onChange={(e) => {
                  clearFieldError("quantity");
                  setForm((p) => ({ ...p, quantity: e.target.value }));
                }}
                placeholder="e.g. 40"
                error={errors.quantity}
                shouldShowError={!!errors.quantity}
              />
              <InputFieldWithLabel
                label={
                  itemTracking === "serial" ? "Serial number" : "Lot / Serial"
                }
                name="lotNumber"
                required={requiresLotOrSerial}
                direction="column"
                tightLabelInputSpacing
                value={form.lotNumber}
                onChange={(e) => {
                  clearFieldError("lotNumber");
                  setForm((p) => ({ ...p, lotNumber: e.target.value }));
                }}
                placeholder={
                  itemTracking === "serial"
                    ? "e.g. SN-0001"
                    : "e.g. LOT-2026-01"
                }
                description={
                  requiresLotOrSerial
                    ? itemTracking === "serial"
                      ? "Required for serial-tracked items (qty max 1)"
                      : "Required for lot-tracked items"
                    : "Optional — required for lot/serial-tracked items"
                }
                error={errors.lotNumber}
                shouldShowError={!!errors.lotNumber}
              />
              <InputFieldWithLabel
                label="Expiry date"
                name="expiryDate"
                type="date"
                direction="column"
                tightLabelInputSpacing
                value={form.expiryDate}
                onChange={(e) =>
                  setForm((p) => ({ ...p, expiryDate: e.target.value }))
                }
                description="Optional — expiring stock is consumed first"
              />
              {selectedModalItem && form.quantity !== "" && !errors.quantity && (
                <p className="text-sm text-gray-700">
                  Will set:{" "}
                  <strong>
                    {formatStockQty(
                      form.quantity,
                      selectedModalItem.unit || selectedModalItem.uom,
                    )}
                  </strong>{" "}
                  of <strong>{selectedModalItem.name}</strong>
                </p>
              )}
              <InputFieldWithLabel
                label="Notes"
                name="notes"
                direction="column"
                tightLabelInputSpacing
                value={form.notes}
                onChange={(e) =>
                  setForm((p) => ({ ...p, notes: e.target.value }))
                }
                placeholder="Optional"
              />
              <p className="text-xs text-gray-500">
                Example: 40 kg chicken on Rack A / Shelf 01. With lot + expiry,
                POS/Sales consume expiring stock first.
              </p>
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
              onClick={handleSaveStock}
            >
              {saving && (
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              )}
              {saving ? "Saving…" : "Save"}
            </button>
          </ModalFooter>
        </Modal>
      </div>
    </RoutePermissionGate>
  );
};

export default StockLevels;
