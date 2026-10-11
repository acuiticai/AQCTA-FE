import React, {
  useState,
  useEffect,
  useMemo,
  useContext,
  useCallback,
} from "react";
import axios from "axios";
import { useHistory, useParams, useLocation } from "react-router-dom";
import { Trash2, CheckCircle, Send, XCircle, Ban } from "lucide-react";
import { AdminContext } from "@/context/AdminContext";
import { PageHeader, useFormScreenExit } from "@/page-layouts/index";
import { DropdownBasic, InputFieldWithLabel } from "@/page-layouts/index";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@windmill/react-ui";
import { notifyError, notifySuccess } from "@/utils/toast";
import { syncAssignedBusinessesFromApi, isSingleAssignedBusiness, getSoleAssignedBusinessId } from "@/utils/sessionAssignedBusinesses";
import { useRouteModulePermissions } from "@/utils/permissionUtils";
import RoutePermissionGate from "@/components/RoutePermissionGate";
import StockLocationPicker from "@/components/Inventory/StockLocationPicker";
import CustomDatePicker from "@/components/CustomDatePicker";
import { formatDate, formatQuantity } from "@/components/formatAmount";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const STATUS_STYLES = {
  draft: "bg-gray-100 text-gray-700",
  pending_inspection: "bg-amber-100 text-amber-800",
  confirmed: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-700",
  returned: "bg-orange-100 text-orange-800",
  reversed: "bg-purple-100 text-purple-800",
};

const STATUS_LABELS = {
  draft: "Draft",
  pending_inspection: "Pending Inspection",
  confirmed: "Confirmed",
  rejected: "Rejected",
  returned: "Returned",
  reversed: "Reversed",
};

const EDITABLE = new Set(["draft", "pending_inspection"]);

const parseSerialLines = (text) =>
  String(text || "")
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

const buildSerialSequence = (seed, count) => {
  const total = Math.max(0, Number(count) || 0);
  if (!total) return [];
  const cleanSeed = String(seed || "").trim() || "SN-001";
  const match = cleanSeed.match(/^(.*?)(\d+)$/);
  if (match) {
    const prefix = match[1];
    const start = Number(match[2]);
    const pad = match[2].length;
    return Array.from({ length: total }, (_, idx) =>
      `${prefix}${String(start + idx).padStart(pad, "0")}`,
    );
  }
  const pad = String(Math.max(999, total)).length;
  return Array.from({ length: total }, (_, idx) =>
    `${cleanSeed}-${String(idx + 1).padStart(pad, "0")}`,
  );
};

const GoodsReceiptForm = () => {
  const history = useHistory();
  const location = useLocation();
  const { id } = useParams();
  const isCreate = !id || location.pathname.endsWith("/create");
  const exitScreen = useFormScreenExit("/goods-receipts");
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
  const prefillPoId = location.state?.purchaseOrderId || "";

  const [loading, setLoading] = useState(!isCreate);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [businesses, setBusinesses] = useState([]);
  const [receivablePos, setReceivablePos] = useState([]);
  const [posLoading, setPosLoading] = useState(false);

  const [business, setBusiness] = useState("");
  const [selectedPoIds, setSelectedPoIds] = useState([]);
  const [warehouse, setWarehouse] = useState("");
  const [name, setName] = useState("");
  const [supplierDeliveryNote, setSupplierDeliveryNote] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("draft");
  const [reference, setReference] = useState("");
  const [lines, setLines] = useState([]);
  const [rejectionRemark, setRejectionRemark] = useState("");
  const [reverseReason, setReverseReason] = useState("");

  const [rejectModal, setRejectModal] = useState(false);
  const [reverseModal, setReverseModal] = useState(false);
  const [rejectInput, setRejectInput] = useState("");
  const [reverseInput, setReverseInput] = useState("");
  const [ledgerRows, setLedgerRows] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  const readOnly = !isCreate && !EDITABLE.has(status);

  useEffect(() => {
    (async () => {
      const list = await syncAssignedBusinessesFromApi(Base_URL);
      setBusinesses(list || []);
      if (isCreate && list?.length === 1 && !business) {
        setBusiness(list[0]._id);
      }
    })();
  }, []);

  const loadReceivablePos = useCallback(
    async (businessId, vendorId = null) => {
      if (!businessId) {
        setReceivablePos([]);
        return;
      }
      setPosLoading(true);
      try {
        const res = await axios.get(`${Base_URL}/goods-receipts/receivable-pos`, {
          headers,
          params: {
            businessId,
            vendorId: vendorId || undefined,
          },
        });
        setReceivablePos(res.data?.data || []);
      } catch (err) {
        console.error(err);
        setReceivablePos([]);
        notifyError(err.response?.data?.message || "Failed to load receivable POs");
      } finally {
        setPosLoading(false);
      }
    },
    [headers],
  );

  useEffect(() => {
    if (business) loadReceivablePos(business);
  }, [business, loadReceivablePos]);

  // Prefill from PO view
  useEffect(() => {
    if (!isCreate || !prefillPoId || !businesses.length) return;
    (async () => {
      try {
        const poRes = await axios.get(
          `${Base_URL}/purchase-orders/${prefillPoId}`,
          { headers },
        );
        const po = poRes.data?.data;
        if (!po) return;
        const bizId = po.business?._id || po.business;
        if (bizId) setBusiness(String(bizId));
        if (po.warehouse?._id || po.warehouse) {
          setWarehouse(String(po.warehouse?._id || po.warehouse));
        }
        setSelectedPoIds([String(prefillPoId)]);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [isCreate, prefillPoId, businesses.length, headers]);

  // When selected POs change, rebuild lines from pending (create / editable)
  useEffect(() => {
    if (readOnly) return;
    if (!selectedPoIds.length) {
      if (isCreate) setLines([]);
      return;
    }
    const selected = receivablePos.filter((p) =>
      selectedPoIds.includes(String(p._id)),
    );
    if (!selected.length) return;

    // Same vendor check
    const vendorKeys = new Set(
      selected.map(
        (p) =>
          p.vendor?._id ||
          p.vendor ||
          "",
      ),
    );
    if (vendorKeys.size > 1) {
      notifyError("All selected POs must belong to the same vendor");
      return;
    }

    if (!warehouse && selected[0]?.warehouse?._id) {
      setWarehouse(String(selected[0].warehouse._id));
    }

    setLines((prev) => {
      const next = [];
      for (const po of selected) {
        for (const it of po.items || []) {
          const existing = prev.find(
            (l) =>
              String(l.purchaseOrder) === String(po._id) &&
              Number(l.poLineIndex) === Number(it.poLineIndex),
          );
          next.push({
            key:
              existing?.key ||
              `${po._id}-${it.poLineIndex}-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 5)}`,
            purchaseOrder: po._id,
            purchaseOrderNumber: po.purchaseOrderNumber,
            poLineIndex: it.poLineIndex,
            item: it.itemId,
            itemName: it.itemName || it.description,
            orderedQty: it.orderedQty,
            pendingQty: it.pendingQty,
            trackingMethod: it.trackingMethod || "none",
            qtyReceived: existing?.qtyReceived ?? it.pendingQty,
            qtyAccepted: existing?.qtyAccepted ?? it.pendingQty,
            qtyRejected: existing?.qtyRejected ?? 0,
            warehouse: existing?.warehouse || warehouse || po.warehouse?._id || "",
            location: existing?.location || "",
            lotNumber: existing?.lotNumber || "",
            serialNumbersText:
              existing?.serialNumbersText ||
              (Array.isArray(existing?.serialNumbers)
                ? existing.serialNumbers.join("\n")
                : ""),
            vendorBatchRef: existing?.vendorBatchRef || "",
            manufacturingDate: existing?.manufacturingDate || "",
            expiryDate: existing?.expiryDate || "",
            unitCost: existing?.unitCost ?? it.rate ?? 0,
            remarks: existing?.remarks || "",
          });
        }
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPoIds.join(","), receivablePos, readOnly]);

  const loadGrn = useCallback(async () => {
    if (isCreate || !id) return;
    setLoading(true);
    try {
      const res = await axios.get(`${Base_URL}/goods-receipts/${id}`, {
        headers,
      });
      const d = res.data?.data;
      if (!d) throw new Error("Not found");
      setBusiness(String(d.business?._id || d.business || ""));
      setWarehouse(String(d.warehouse?._id || d.warehouse || ""));
      setName(d.name || "");
      setSupplierDeliveryNote(d.supplierDeliveryNote || "");
      setNotes(d.notes || "");
      setStatus(d.status || "draft");
      setReference(d.reference || "");
      setRejectionRemark(d.rejectionRemark || "");
      setReverseReason(d.reverseReason || "");
      setSelectedPoIds(
        (d.purchaseOrders || []).map((p) => String(p._id || p)),
      );
      setLines(
        (d.lines || []).map((l, idx) => ({
          key: l._id || `line-${idx}`,
          purchaseOrder: l.purchaseOrder?._id || l.purchaseOrder,
          purchaseOrderNumber:
            l.purchaseOrder?.purchaseOrderNumber ||
            l.purchaseOrder?.salesOrderNumber ||
            "",
          poLineIndex: l.poLineIndex,
          item: l.item?._id || l.item,
          itemName: l.itemName || l.item?.name || "",
          orderedQty: l.orderedQty,
          pendingQty: l.pendingQty,
          trackingMethod: l.item?.trackingMethod || "none",
          qtyReceived: l.qtyReceived,
          qtyAccepted: l.qtyAccepted,
          qtyRejected: l.qtyRejected,
          warehouse: l.warehouse?._id || l.warehouse || "",
          location: l.location?._id || l.location || "",
          lotNumber: l.lotNumber || "",
          serialNumbersText: Array.isArray(l.serialNumbers)
            ? l.serialNumbers.join("\n")
            : "",
          vendorBatchRef: l.vendorBatchRef || "",
          manufacturingDate: l.manufacturingDate
            ? String(l.manufacturingDate).slice(0, 10)
            : "",
          expiryDate: l.expiryDate ? String(l.expiryDate).slice(0, 10) : "",
          unitCost: l.unitCost || 0,
          remarks: l.remarks || "",
        })),
      );
    } catch (err) {
      notifyError(err.response?.data?.message || "Failed to load GRN");
      history.push("/goods-receipts");
    } finally {
      setLoading(false);
    }
  }, [isCreate, id, headers, history]);

  useEffect(() => {
    loadGrn();
  }, [loadGrn]);

  const loadStockLedger = useCallback(async () => {
    if (isCreate || !id || !business) {
      setLedgerRows([]);
      return;
    }
    if (!["confirmed", "reversed"].includes(status)) {
      setLedgerRows([]);
      return;
    }
    setLedgerLoading(true);
    try {
      const res = await axios.get(`${Base_URL}/stock-movements`, {
        headers,
        params: {
          businessId: business,
          referenceId: id,
          limit: 100,
          page: 1,
        },
      });
      setLedgerRows(res.data?.data || []);
    } catch (err) {
      console.error(err);
      setLedgerRows([]);
    } finally {
      setLedgerLoading(false);
    }
  }, [isCreate, id, business, status, headers]);

  useEffect(() => {
    loadStockLedger();
  }, [loadStockLedger]);

  const updateLine = (key, patch) => {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, ...patch } : l)),
    );
  };

  const removeLine = (key) => {
    setLines((prev) => prev.filter((l) => l.key !== key));
  };

  const autoGenerateSerials = (line) => {
    const acceptedInt = Math.round(Number(line.qtyAccepted) || 0);
    if (!acceptedInt) {
      notifyError("Accepted quantity set karein, phir serials generate karein");
      return;
    }
    if (Math.abs((Number(line.qtyAccepted) || 0) - acceptedInt) > 1e-9) {
      notifyError("Serial-tracked items ke liye accepted quantity whole number honi chahiye");
      return;
    }
    const entered = parseSerialLines(line.serialNumbersText);
    const seed = entered[0] || "SN-001";
    const generated = buildSerialSequence(seed, acceptedInt);
    updateLine(line.key, { serialNumbersText: generated.join("\n") });
  };

  const buildPayload = () => ({
    business,
    purchaseOrders: selectedPoIds,
    warehouse: warehouse || null,
    name,
    supplierDeliveryNote,
    notes,
    status: status === "pending_inspection" ? "pending_inspection" : "draft",
    lines: lines.map((l) => ({
      purchaseOrder: l.purchaseOrder,
      poLineIndex: l.poLineIndex,
      item: l.item,
      itemName: l.itemName,
      qtyReceived: Number(l.qtyReceived) || 0,
      qtyAccepted: Number(l.qtyAccepted) || 0,
      qtyRejected: Number(l.qtyRejected) || 0,
      warehouse: l.warehouse || warehouse || null,
      location: l.location || null,
      lotNumber: l.lotNumber || "",
      serialNumbers: String(l.serialNumbersText || "")
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter(Boolean),
      vendorBatchRef: l.vendorBatchRef || "",
      manufacturingDate: l.manufacturingDate || null,
      expiryDate: l.expiryDate || null,
      unitCost: Number(l.unitCost) || 0,
      remarks: l.remarks || "",
    })),
  });

  const handleSave = async (nextStatus = null) => {
    if (!business) {
      notifyError("Business is required");
      return;
    }
    if (!selectedPoIds.length) {
      notifyError("Select at least one purchase order");
      return;
    }
    if (!lines.length) {
      notifyError("Add at least one line");
      return;
    }
    for (const l of lines) {
      if ((Number(l.qtyAccepted) || 0) > 0 && !l.location && !l.warehouse && !warehouse) {
        notifyError(`Set warehouse/location for ${l.itemName || "line"}`);
        return;
      }
    }

    setSaving(true);
    try {
      const payload = buildPayload();
      if (nextStatus) payload.status = nextStatus;
      let grnId = id;
      if (isCreate) {
        const res = await axios.post(`${Base_URL}/goods-receipts`, payload, {
          headers,
        });
        grnId = res.data?.data?._id;
        notifySuccess("GRN saved as draft");
      } else {
        await axios.put(`${Base_URL}/goods-receipts/${id}`, payload, {
          headers,
        });
        notifySuccess("GRN updated");
      }
      if (grnId) history.replace(`/goods-receipts/${grnId}`);
      if (!isCreate) await loadGrn();
    } catch (err) {
      notifyError(err.response?.data?.message || "Failed to save GRN");
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (action) => {
    if (!id) {
      notifyError("Save the GRN first");
      return;
    }
    setActionLoading(action);
    try {
      if (action === "inspect") {
        await axios.put(
          `${Base_URL}/goods-receipts/${id}`,
          buildPayload(),
          { headers },
        );
        await axios.post(
          `${Base_URL}/goods-receipts/${id}/send-inspection`,
          {},
          { headers },
        );
        notifySuccess("Sent for inspection");
      } else if (action === "confirm") {
        await axios.put(
          `${Base_URL}/goods-receipts/${id}`,
          buildPayload(),
          { headers },
        );
        await axios.post(
          `${Base_URL}/goods-receipts/${id}/confirm`,
          {},
          { headers },
        );
        notifySuccess("GRN confirmed — stock in posted");
      } else if (action === "reject") {
        await axios.post(
          `${Base_URL}/goods-receipts/${id}/reject`,
          { remark: rejectInput },
          { headers },
        );
        notifySuccess("GRN rejected");
        setRejectModal(false);
      } else if (action === "reverse") {
        await axios.post(
          `${Base_URL}/goods-receipts/${id}/reverse`,
          { reason: reverseInput },
          { headers },
        );
        notifySuccess("GRN reversed — stock out posted");
        setReverseModal(false);
      }
      await loadGrn();
    } catch (err) {
      notifyError(err.response?.data?.message || `Failed to ${action}`);
    } finally {
      setActionLoading("");
    }
  };

  const togglePo = (poId) => {
    const sid = String(poId);
    setSelectedPoIds((prev) =>
      prev.includes(sid) ? prev.filter((x) => x !== sid) : [...prev, sid],
    );
  };

  if (loading) {
    return (
      <RoutePermissionGate>
        <div className="p-8 text-gray-500">Loading GRN…</div>
      </RoutePermissionGate>
    );
  }

  return (
    <RoutePermissionGate>
      <div className="bg-gray-50 min-h-screen w-full">
        <div className="w-full mx-auto px-6 py-8 max-w-6xl">
          <PageHeader
            title={isCreate ? "New Goods Receipt" : reference || "Goods Receipt"}
            description="Stock in posts only when you Confirm accepted quantities"
            showBackButton
            onBackClick={exitScreen}
            renderActions={
              !isCreate ? (
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    STATUS_STYLES[status] || "bg-gray-100"
                  }`}
                >
                  {STATUS_LABELS[status] || status}
                </span>
              ) : null
            }
          />

          {(rejectionRemark || reverseReason) && (
            <div className="mb-4 space-y-2">
              {rejectionRemark && (
                <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
                  Rejection: {rejectionRemark}
                </div>
              )}
              {reverseReason && (
                <div className="text-sm text-purple-800 bg-purple-50 border border-purple-200 rounded-lg px-4 py-2">
                  Reverse reason: {reverseReason}
                </div>
              )}
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {!isSingleAssignedBusiness() && <DropdownBasic
                label="Business *"
                value={business}
                onChange={(v) => {
                  setBusiness(v || "");
                  setSelectedPoIds([]);
                  setLines([]);
                  setWarehouse("");
                }}
                disabled={readOnly || !isCreate}
                isDisabled={readOnly || !isCreate}
                options={(businesses || []).map((b) => ({
                  value: b._id,
                  label: b.name,
                }))}
                placeholder="Select business"
              />}
              <InputFieldWithLabel
                label="Supplier Delivery Note"
                value={supplierDeliveryNote}
                onChange={(e) => setSupplierDeliveryNote(e.target.value)}
                disabled={readOnly}
                placeholder="Vendor DN / packing slip #"
              />
              <InputFieldWithLabel
                label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={readOnly}
                placeholder="Optional label"
              />
              <InputFieldWithLabel
                label="Notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={readOnly}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default Warehouse
              </label>
              <StockLocationPicker
                businessId={business}
                headers={headers}
                warehouseId={warehouse}
                locationId=""
                onWarehouseChange={(wid) => {
                  setWarehouse(wid || "");
                  setLines((prev) =>
                    prev.map((l) => ({
                      ...l,
                      warehouse: wid || l.warehouse,
                    })),
                  );
                }}
                onLocationChange={() => {}}
                receiveMode
                hideLocation
                disabled={readOnly || !business}
              />
            </div>
          </div>

          {/* PO picker */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Purchase Orders (same vendor) *
            </h3>
            {!business ? (
              <p className="text-sm text-gray-500">Select a business first</p>
            ) : posLoading ? (
              <p className="text-sm text-gray-500">Loading receivable POs…</p>
            ) : !receivablePos.length ? (
              <p className="text-sm text-gray-500">
                No approved POs with pending quantity for this business.
              </p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {receivablePos.map((po) => {
                  const checked = selectedPoIds.includes(String(po._id));
                  const vendorName =
                    po.vendor?.basicInformation?.companyName ||
                    po.vendor?.basicInformation?.vendorDisplayName ||
                    "Vendor";
                  return (
                    <label
                      key={po._id}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer ${
                        checked
                          ? "border-[var(--p-blue)] bg-orange-50/40"
                          : "border-gray-200 hover:bg-gray-50"
                      } ${readOnly ? "pointer-events-none opacity-70" : ""}`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={checked}
                        disabled={readOnly}
                        onChange={() => togglePo(po._id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-gray-900">
                          {po.purchaseOrderNumber}{" "}
                          <span className="text-gray-500 font-normal">
                            · {po.status}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {vendorName} · pending{" "}
                          {formatQuantity(po.totalPending || 0)}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Lines */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Receipt Lines
            </h3>
            {!lines.length ? (
              <p className="text-sm text-gray-500">Select purchase order(s) to load lines</p>
            ) : (
              <div className="space-y-6">
                {lines.map((line) => (
                  <div
                    key={line.key}
                    className="border border-gray-200 rounded-xl p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-gray-900">
                          {line.itemName || "Item"}
                        </div>
                        <div className="text-xs text-gray-500">
                          PO {line.purchaseOrderNumber || "—"} · Ordered{" "}
                          {formatQuantity(line.orderedQty || 0)} · Pending{" "}
                          {formatQuantity(line.pendingQty || 0)}
                        </div>
                      </div>
                      {!readOnly && (
                        <button
                          type="button"
                          className="text-red-500 hover:text-red-700 p-1"
                          onClick={() => removeLine(line.key)}
                          title="Remove line"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="text-xs text-gray-500">Received</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          disabled={readOnly}
                          className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 rounded-lg"
                          value={line.qtyReceived}
                          onChange={(e) => {
                            const v = e.target.value;
                            updateLine(line.key, {
                              qtyReceived: v,
                              qtyAccepted: v,
                              qtyRejected: 0,
                            });
                          }}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Accepted</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          disabled={readOnly}
                          className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 rounded-lg"
                          value={line.qtyAccepted}
                          onChange={(e) =>
                            updateLine(line.key, { qtyAccepted: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Rejected</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          disabled={readOnly}
                          className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 rounded-lg"
                          value={line.qtyRejected}
                          onChange={(e) =>
                            updateLine(line.key, { qtyRejected: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Unit cost</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          disabled={readOnly}
                          className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 rounded-lg"
                          value={line.unitCost}
                          onChange={(e) =>
                            updateLine(line.key, { unitCost: e.target.value })
                          }
                        />
                      </div>
                    </div>

                    <StockLocationPicker
                      businessId={business}
                      headers={headers}
                      warehouseId={line.warehouse || warehouse}
                      locationId={line.location}
                      onWarehouseChange={(wid) =>
                        updateLine(line.key, { warehouse: wid || "", location: "" })
                      }
                      onLocationChange={(lid) =>
                        updateLine(line.key, { location: lid || "" })
                      }
                      receiveMode
                      disabled={readOnly || !business}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                      {line.trackingMethod === "serial" ? (
                        <div className="md:col-span-2">
                          <label className="text-xs text-gray-500">
                            Serial numbers (one per accepted unit)
                          </label>
                          <textarea
                            disabled={readOnly}
                            rows={Math.min(
                              6,
                              Math.max(2, Math.round(Number(line.qtyAccepted) || 1)),
                            )}
                            className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 rounded-lg font-mono"
                            value={line.serialNumbersText || ""}
                            onChange={(e) =>
                              updateLine(line.key, {
                                serialNumbersText: e.target.value,
                              })
                            }
                            placeholder={"SN-001\nSN-002\nSN-003"}
                          />
                          <p className="text-[11px] text-gray-400 mt-1">
                            Enter exactly {Math.round(Number(line.qtyAccepted) || 0)} serial
                            number(s), one per line
                          </p>
                          {!readOnly && (
                            <div className="mt-2 flex items-center gap-2">
                              <button
                                type="button"
                                className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
                                onClick={() => autoGenerateSerials(line)}
                              >
                                Auto-generate serials
                              </button>
                              <span className="text-[11px] text-gray-400">
                                First line seed use hogi (e.g. BRD-0001)
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <label className="text-xs text-gray-500">
                            {line.trackingMethod === "lot"
                              ? "Lot / Batch *"
                              : "Lot / Batch"}
                          </label>
                          <input
                            type="text"
                            disabled={readOnly}
                            className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 rounded-lg"
                            value={line.lotNumber}
                            onChange={(e) =>
                              updateLine(line.key, { lotNumber: e.target.value })
                            }
                            placeholder="Batch #"
                          />
                        </div>
                      )}
                      <div>
                        <label className="text-xs text-gray-500">Vendor batch ref</label>
                        <input
                          type="text"
                          disabled={readOnly}
                          className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 rounded-lg"
                          value={line.vendorBatchRef}
                          onChange={(e) =>
                            updateLine(line.key, {
                              vendorBatchRef: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Mfg date</label>
                        <CustomDatePicker
                          value={line.manufacturingDate}
                          onChange={(d) =>
                            updateLine(line.key, { manufacturingDate: d })
                          }
                          disabled={readOnly}
                          bgColor="#FFFFFF"
                          style={{
                            backgroundColor: "#FFFFFF",
                            border: "1px solid #E5E7EB",
                            borderRadius: "8px",
                          }}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Expiry date</label>
                        <CustomDatePicker
                          value={line.expiryDate}
                          onChange={(d) =>
                            updateLine(line.key, { expiryDate: d })
                          }
                          disabled={readOnly}
                          bgColor="#FFFFFF"
                          style={{
                            backgroundColor: "#FFFFFF",
                            border: "1px solid #E5E7EB",
                            borderRadius: "8px",
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-gray-500">Remarks</label>
                      <input
                        type="text"
                        disabled={readOnly}
                        className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 rounded-lg"
                        value={line.remarks}
                        onChange={(e) =>
                          updateLine(line.key, { remarks: e.target.value })
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stock ledger entries for this GRN */}
          {!isCreate && ["confirmed", "reversed"].includes(status) && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">
                    Stock Ledger Entries
                  </h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Movements posted from this GRN (Stock In / reverse Out)
                  </p>
                </div>
                <button
                  type="button"
                  className="text-sm text-[var(--p-blue)] hover:underline"
                  onClick={() =>
                    history.push({
                      pathname: "/stock-traceability",
                      state: { referenceId: id },
                    })
                  }
                >
                  Open Traceability
                </button>
              </div>
              {ledgerLoading ? (
                <p className="text-sm text-gray-500 py-4">Loading movements…</p>
              ) : ledgerRows.length === 0 ? (
                <p className="text-sm text-gray-500 py-4">
                  No stock movements found for this GRN.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">
                          Date
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">
                          Item
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">
                          Location
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">
                          Lot / Batch
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">
                          Type
                        </th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">
                          Qty
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {ledgerRows.map((row) => {
                        const qty = Number(row.quantity || 0);
                        const isIn = qty >= 0;
                        return (
                          <tr key={row._id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                              {row.createdAt
                                ? formatDate(row.createdAt, false, true) || "—"
                                : "—"}
                            </td>
                            <td className="px-3 py-2 text-gray-900">
                              {row.item?.name || row.itemName || "—"}
                            </td>
                            <td className="px-3 py-2 text-gray-700">
                              {row.location?.completeName ||
                                row.location?.name ||
                                row.warehouse?.name ||
                                "—"}
                            </td>
                            <td className="px-3 py-2 text-gray-700">
                              {row.lotNumber || "—"}
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  isIn
                                    ? "bg-green-100 text-green-800"
                                    : "bg-red-100 text-red-700"
                                }`}
                              >
                                {isIn ? "IN" : "OUT"}
                                {row.referenceType
                                  ? ` · ${String(row.referenceType).replace(
                                      /_/g,
                                      " ",
                                    )}`
                                  : ""}
                              </span>
                            </td>
                            <td
                              className={`px-3 py-2 text-right font-medium ${
                                isIn ? "text-green-700" : "text-red-700"
                              }`}
                            >
                              {isIn ? "+" : ""}
                              {formatQuantity(Math.abs(qty))}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3 justify-end">
            <button
              type="button"
              onClick={exitScreen}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg bg-white"
            >
              Back
            </button>

            {!readOnly && (isCreate ? canAdd : canUpdate) && (
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSave("draft")}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg bg-white disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save Draft"}
              </button>
            )}

            {!readOnly && !isCreate && canUpdate && status === "draft" && (
              <button
                type="button"
                disabled={!!actionLoading}
                onClick={() => runAction("inspect")}
                className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-amber-600 rounded-lg disabled:opacity-50"
              >
                <Send size={16} />
                {actionLoading === "inspect" ? "Sending…" : "Send for Inspection"}
              </button>
            )}

            {!readOnly && !isCreate && canUpdate && (
              <button
                type="button"
                disabled={!!actionLoading}
                onClick={() => runAction("confirm")}
                className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-green-600 rounded-lg disabled:opacity-50"
              >
                <CheckCircle size={16} />
                {actionLoading === "confirm" ? "Confirming…" : "Confirm GRN"}
              </button>
            )}

            {!readOnly && !isCreate && canUpdate && (
              <button
                type="button"
                disabled={!!actionLoading}
                onClick={() => setRejectModal(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-amber-800 border border-amber-300 rounded-lg bg-amber-50"
              >
                <XCircle size={16} />
                Reject
              </button>
            )}

            {status === "confirmed" && canUpdate && (
              <button
                type="button"
                disabled={!!actionLoading}
                onClick={() => setReverseModal(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-purple-700 rounded-lg disabled:opacity-50"
              >
                <Ban size={16} />
                Reverse GRN
              </button>
            )}
          </div>
        </div>

        <Modal isOpen={rejectModal} onClose={() => setRejectModal(false)}>
          <ModalHeader>Reject GRN</ModalHeader>
          <ModalBody>
            <p className="text-sm text-gray-600 mb-3">
              No stock will be posted. Remark is required.
            </p>
            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              rows={3}
              value={rejectInput}
              onChange={(e) => setRejectInput(e.target.value)}
              placeholder="Rejection remark…"
            />
          </ModalBody>
          <ModalFooter>
            <button
              type="button"
              className="px-4 py-2 text-sm bg-gray-100 rounded-lg"
              onClick={() => setRejectModal(false)}
            >
              Close
            </button>
            <button
              type="button"
              className="px-4 py-2 text-sm text-white bg-amber-600 rounded-lg disabled:opacity-50"
              disabled={!rejectInput.trim() || !!actionLoading}
              onClick={() => runAction("reject")}
            >
              {actionLoading === "reject" ? "Rejecting…" : "Reject"}
            </button>
          </ModalFooter>
        </Modal>

        <Modal isOpen={reverseModal} onClose={() => setReverseModal(false)}>
          <ModalHeader>Reverse Confirmed GRN</ModalHeader>
          <ModalBody>
            <p className="text-sm text-gray-600 mb-3">
              This posts an offsetting stock out and reduces PO received quantity.
            </p>
            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              rows={3}
              value={reverseInput}
              onChange={(e) => setReverseInput(e.target.value)}
              placeholder="Reason (optional)…"
            />
          </ModalBody>
          <ModalFooter>
            <button
              type="button"
              className="px-4 py-2 text-sm bg-gray-100 rounded-lg"
              onClick={() => setReverseModal(false)}
            >
              Close
            </button>
            <button
              type="button"
              className="px-4 py-2 text-sm text-white bg-purple-700 rounded-lg disabled:opacity-50"
              disabled={!!actionLoading}
              onClick={() => runAction("reverse")}
            >
              {actionLoading === "reverse" ? "Reversing…" : "Confirm Reverse"}
            </button>
          </ModalFooter>
        </Modal>
      </div>
    </RoutePermissionGate>
  );
};

export default GoodsReceiptForm;
