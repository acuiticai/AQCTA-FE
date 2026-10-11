import React, { useState, useEffect, useMemo, useContext, useRef } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { Plus, X } from "lucide-react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@windmill/react-ui";
import { DataTable, ActionButtons } from "@/page-layouts";
import { DropdownBasic, InputField } from "@/page-layouts/index";
import StandardPageHeader from "@/components/StandardPageHeader";
import { notifyError, notifySuccess } from "@/utils/toast";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";
import { syncAssignedBusinessesFromApi, isSingleAssignedBusiness } from "@/utils/sessionAssignedBusinesses";
import RoutePermissionGate from "@/components/RoutePermissionGate";
import { useRouteModulePermissions } from "@/utils/permissionUtils";
import { AdminContext } from "@/context/AdminContext";
import { formatDate, formatQuantity } from "@/components/formatAmount";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const STATUS_STYLES = {
  pending: "bg-amber-100 text-amber-800",
  picked: "bg-blue-100 text-blue-800",
  done: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-700",
};

const STATUS_LABELS = {
  pending: "Pending",
  picked: "Picked",
  done: "Done",
  cancelled: "Cancelled",
};

const formatExpiry = (d) => {
  if (!d) return "";
  return formatDate(d) || "";
};

const placePickPreview = (rect) => {
  const width = Math.min(760, window.innerWidth - 24);
  const maxHeight = Math.min(420, window.innerHeight - 24);
  let left = rect.left;
  if (left + width > window.innerWidth - 12) {
    left = Math.max(12, window.innerWidth - width - 12);
  }
  let top = rect.bottom + 8;
  if (top + Math.min(280, maxHeight) > window.innerHeight - 12) {
    top = Math.max(12, rect.top - maxHeight - 8);
  }
  return { left, top, width, maxHeight };
};

const PickLineDetails = ({ row }) => {
  const lines = Array.isArray(row?.lines) ? row.lines : [];
  const createdLabel = row?.createdAt
    ? formatDate(row.createdAt, false, true) || "—"
    : "—";

  if (!lines.length) {
    return (
      <p className="text-sm text-gray-500">
        No pick lines. Recipe/composition missing ho sakti hai, ya stock pehle se
        short tha.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
        <span>Created: {createdLabel}</span>
        {row.referenceType && (
          <span>
            Source: {row.referenceType}
            {row.name ? ` · ${row.name}` : ""}
          </span>
        )}
      </div>

      <div className="overflow-x-auto border rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">Item</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2">Pick from (warehouse / location / batch)</th>
              <th className="px-3 py-2 text-right">Short</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const itemName =
                line.itemName ||
                line.item?.name ||
                line.item?.itemCode ||
                "—";
              const unit = line.item?.unit || line.item?.uom || "";
              const allocs = Array.isArray(line.allocations)
                ? line.allocations
                : [];
              return (
                <tr key={line._id || `${itemName}-${line.sourceType}`} className="border-t align-top">
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-900">{itemName}</div>
                    {line.menuItem?.name && line.sourceType === "ingredient" && (
                      <div className="text-xs text-gray-500">
                        for {line.menuItem.name}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        line.sourceType === "ingredient"
                          ? "bg-orange-50 text-orange-800"
                          : "bg-sky-50 text-sky-800"
                      }`}
                    >
                      {line.sourceType === "ingredient"
                        ? "Ingredient"
                        : "Finished"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {formatQuantity(line.requiredQty)}
                    {unit ? ` ${unit}` : ""}
                  </td>
                  <td className="px-3 py-2">
                    {allocs.length === 0 ? (
                      <span className="text-amber-700 text-xs">
                        No stock allocation — short / not found
                      </span>
                    ) : (
                      <ul className="space-y-1">
                        {allocs.map((a, i) => {
                          const wh =
                            a.warehouse?.name ||
                            a.warehouse?.code ||
                            "Warehouse";
                          const loc =
                            a.location?.name ||
                            a.location?.code ||
                            "Location";
                          const lot = a.lotNumber
                            ? `Batch ${a.lotNumber}`
                            : "No batch";
                          const exp = formatExpiry(a.expiryDate);
                          return (
                            <li
                              key={a._id || i}
                              className="text-xs text-gray-700"
                            >
                              <span className="font-semibold text-gray-900">
                                {formatQuantity(a.quantity)}
                                {unit ? ` ${unit}` : ""}
                              </span>
                              {" → "}
                              {wh} / {loc} / {lot}
                              {exp ? ` (exp ${exp})` : ""}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {Number(line.shortQty) > 0 ? (
                      <span className="text-red-600 font-medium">
                        {formatQuantity(line.shortQty)}
                      </span>
                    ) : (
                      "0"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {(row.warnings || []).length > 0 && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded p-2">
          {row.warnings.join(" · ")}
        </div>
      )}
    </div>
  );
};

const PickLists = () => {
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

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [businesses, setBusinesses] = useState([]);
  const [selectedBusinesses, setSelectedBusinesses] = useState([]);
  /** Default: open = pending + picked (done/cancelled via filter) */
  const [statusFilter, setStatusFilter] = useState("open");
  const [searchTerm, setSearchTerm] = useState("");
  const [totalResults, setTotalResults] = useState(0);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const currentPageRef = useRef(1);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    business: "",
    name: "",
    includeComposition: true,
  });
  const [itemOptions, setItemOptions] = useState([]);
  const [lines, setLines] = useState([{ itemId: "", quantity: "" }]);
  const [preview, setPreview] = useState(null);
  const [creating, setCreating] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [detailRow, setDetailRow] = useState(null);
  const [hoverPreview, setHoverPreview] = useState(null);
  const hoverOpenTimer = useRef(null);
  const hoverCloseTimer = useRef(null);

  const clearHoverTimers = () => {
    if (hoverOpenTimer.current) clearTimeout(hoverOpenTimer.current);
    if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);
    hoverOpenTimer.current = null;
    hoverCloseTimer.current = null;
  };

  const closeHoverPreview = () => {
    clearHoverTimers();
    setHoverPreview(null);
  };

  const scheduleHoverPreview = (row, el) => {
    if (detailRow || !el) return;
    clearHoverTimers();
    hoverOpenTimer.current = setTimeout(() => {
      setHoverPreview({ row, ...placePickPreview(el.getBoundingClientRect()) });
    }, 220);
  };

  const scheduleCloseHoverPreview = () => {
    if (hoverOpenTimer.current) {
      clearTimeout(hoverOpenTimer.current);
      hoverOpenTimer.current = null;
    }
    hoverCloseTimer.current = setTimeout(() => setHoverPreview(null), 160);
  };

  const keepHoverPreview = () => {
    if (hoverCloseTimer.current) {
      clearTimeout(hoverCloseTimer.current);
      hoverCloseTimer.current = null;
    }
  };

  const openDetailModal = (row) => {
    closeHoverPreview();
    setDetailRow(row);
  };

  useEffect(() => () => clearHoverTimers(), []);

  useEffect(() => {
    if (!hoverPreview) return undefined;
    const onScrollOrResize = () => setHoverPreview(null);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [hoverPreview]);

  useEffect(() => {
    if (!detailRow) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setDetailRow(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailRow]);

  useEffect(() => {
    (async () => {
      const list = await syncAssignedBusinessesFromApi(Base_URL);
      setBusinesses(list || []);
      if (list?.length === 1) {
        setForm((p) => ({ ...p, business: p.business || list[0]._id }));
      }
    })();
  }, []);

  useEffect(() => {
    if (!createOpen || !form.business) {
      setItemOptions([]);
      return;
    }
    (async () => {
      try {
        const res = await axios.get(`${Base_URL}/items`, {
          headers,
          params: { businessId: form.business, status: "Active", limit: 500 },
        });
        const list = res.data?.items || res.data?.data || res.data || [];
        setItemOptions(Array.isArray(list) ? list : []);
      } catch (_) {
        setItemOptions([]);
      }
    })();
  }, [createOpen, form.business, headers]);

  const fetchRows = async (
    bizIds = selectedBusinesses,
    page = currentPageRef.current,
    limit = recordsPerPage,
    search = searchTerm,
    status = statusFilter,
  ) => {
    try {
      setLoading(true);
      let ids = Array.isArray(bizIds) ? bizIds.filter(Boolean) : [];
      if (!ids.length) ids = (businesses || []).map((b) => b._id).filter(Boolean);
      const params = {
        page,
        limit,
        search: search || undefined,
        status: status || "open",
      };
      if (ids.length) params.businessIds = ids.join(",");
      const res = await axios.get(`${Base_URL}/pick-lists`, { headers, params });
      setRows(res.data?.data || []);
      setTotalResults(res.data?.total || 0);
    } catch (err) {
      notifyError(err?.response?.data?.message || "Failed to load pick lists");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows(selectedBusinesses, 1, recordsPerPage, searchTerm, statusFilter);
    setCurrentPage(1);
    currentPageRef.current = 1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBusinesses.join(","), statusFilter, businesses.length]);

  const buildPayload = () => ({
    business: form.business,
    name: form.name || "",
    includeComposition: !!form.includeComposition,
    lines: lines
      .map((l) => ({
        itemId: l.itemId,
        quantity: parseFloat(l.quantity) || 0,
      }))
      .filter((l) => l.itemId && l.quantity > 0),
  });

  const runPreview = async () => {
    try {
      const payload = buildPayload();
      if (!payload.business) {
        notifyError("Select business");
        return;
      }
      if (!payload.lines.length) {
        notifyError("Add at least one line");
        return;
      }
      const res = await axios.post(`${Base_URL}/pick-lists/preview`, payload, { headers });
      setPreview(res.data?.data || null);
    } catch (err) {
      notifyError(err?.response?.data?.message || "Preview failed");
    }
  };

  const submitCreate = async () => {
    try {
      setCreating(true);
      const payload = buildPayload();
      if (!payload.business) {
        notifyError("Select business");
        return;
      }
      if (!payload.lines.length) {
        notifyError("Add at least one line");
        return;
      }
      const res = await axios.post(`${Base_URL}/pick-lists`, payload, { headers });
      notifySuccess(res.data?.message || "Pick list created");
      setCreateOpen(false);
      setPreview(null);
      setLines([{ itemId: "", quantity: "" }]);
      setForm({ business: "", name: "", includeComposition: true });
      fetchRows();
    } catch (err) {
      notifyError(err?.response?.data?.message || "Create failed");
    } finally {
      setCreating(false);
    }
  };

  const runAction = async (row, action) => {
    try {
      setActionId(row._id);
      const path =
        action === "pick"
          ? "pick"
          : action === "done"
            ? "done"
            : "cancel";
      const res = await axios.post(
        `${Base_URL}/pick-lists/${row._id}/${path}`,
        action === "cancel" ? { reason: "" } : {},
        { headers },
      );
      notifySuccess(
        res.data?.message ||
          (action === "pick"
            ? "Marked as picked"
            : action === "done"
              ? "Completed"
              : "Cancelled"),
      );
      fetchRows();
    } catch (err) {
      notifyError(err?.response?.data?.message || "Action failed");
    } finally {
      setActionId(null);
    }
  };

  const clearFilters = () => {
    const onlySearchActive =
      Boolean(searchTerm) &&
      !selectedBusinesses.length &&
      statusFilter === "open";
    setSelectedBusinesses([]);
    setStatusFilter("open");
    setSearchTerm("");
    setCurrentPage(1);
    currentPageRef.current = 1;
    if (onlySearchActive) {
      fetchRows([], 1, recordsPerPage, "", "open");
    }
  };

  const filters = [
    {
      isClearButton: true,
      tooltip: "Clear Filters",
      buttonProps: {
        onClick: clearFilters,
      },
    },
    ...(!isSingleAssignedBusiness() ? [{
      value: selectedBusinesses,
      onChange: (value) => setSelectedBusinesses(Array.isArray(value) ? value : []),
      placeholder: "Business",
      isMulti: true,
      options: businesses.map((b) => ({ value: b._id, label: b.name })),
    }] : []),
    {
      value: statusFilter,
      onChange: (value) => setStatusFilter(value || "open"),
      placeholder: "Status",
      options: [
        { value: "open", label: "Open (pending + picked)" },
        { value: "pending", label: "Pending" },
        { value: "picked", label: "Picked" },
        { value: "done", label: "Done (history)" },
        { value: "cancelled", label: "Cancelled" },
        { value: "all", label: "All statuses" },
      ],
    },
  ];

  return (
    <RoutePermissionGate>
      <div className="bg-gray-50 min-h-screen w-full max-w-full overflow-x-hidden">
        <div className="w-full max-w-full mx-auto px-6 py-8 min-w-0 overflow-x-hidden">
          <StandardPageHeader
            title="Pick Lists"
            subtitle="When you confirm or kitchen fires, stock is reserved. When the pick list is done or checkout / complete fulfillment is marked, stock is taken out. If cancelled or voided, the reserve is returned back."
            actions={
              canAdd ? (
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[var(--p-blue-dark)] transition-colors shadow-sm"
                >
                  <Plus size={20} />
                  New Pick List
                </button>
              ) : null
            }
          />

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 min-w-0 max-w-full overflow-hidden">
            <DataTable
              onSearch={(val) => {
                setSearchTerm(val);
                fetchRows(selectedBusinesses, 1, recordsPerPage, val, statusFilter);
                setCurrentPage(1);
                currentPageRef.current = 1;
              }}
              searchValue={searchTerm}
              searchPlaceholder="Search reference, name…"
              filters={filters}
              loading={loading}
              headers={["Reference", "Name", "Business", "Status", "Required", "Short", "Actions"]}
              data={rows}
              totalRecords={totalResults}
              recordsPerPage={recordsPerPage}
              currentPage={currentPage}
              totalPages={Math.ceil(totalResults / recordsPerPage) || 1}
              onPageChange={(page) => {
                setCurrentPage(page);
                currentPageRef.current = page;
                fetchRows(selectedBusinesses, page, recordsPerPage, searchTerm, statusFilter);
              }}
              onRecordsPerPageChange={(n) => {
                setRecordsPerPage(n);
                currentPageRef.current = 1;
                setCurrentPage(1);
                fetchRows(selectedBusinesses, 1, n, searchTerm, statusFilter);
              }}
              emptyMessage="No open pick lists."
              headersWithoutCellTooltip={["Reference", "Actions"]}
              renderExpandedContent={(row) => <PickLineDetails row={row} />}
              renderRow={(row) => {
                const busy = actionId === row._id;
                const canAct =
                  canUpdate &&
                  (row.status === "pending" || row.status === "picked");
                return (
                  <tr
                    key={row._id}
                    className="border-b"
                    style={{ fontSize: "12px", fontWeight: "400" }}
                  >
                    <td className="py-2 px-4" style={{ fontSize: "14px" }}>
                      <button
                        type="button"
                        className="text-[var(--p-blue)] hover:underline font-medium text-left"
                        title="View pick details"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDetailModal(row);
                        }}
                        onMouseEnter={(e) =>
                          scheduleHoverPreview(row, e.currentTarget)
                        }
                        onMouseLeave={scheduleCloseHoverPreview}
                      >
                        {row.reference || "—"}
                      </button>
                    </td>
                    <td className="py-2 px-4" style={{ fontSize: "14px" }}>
                      {row.name || "—"}
                    </td>
                    <td className="py-2 px-4" style={{ fontSize: "14px" }}>
                      {row.business?.name || "—"}
                    </td>
                    <td className="py-2 px-4">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          STATUS_STYLES[row.status] || STATUS_STYLES.pending
                        }`}
                      >
                        {STATUS_LABELS[row.status] || row.status}
                      </span>
                    </td>
                    <td className="py-2 px-4" style={{ fontSize: "14px" }}>
                      {formatQuantity(row.summary?.totalRequiredQty || 0)}
                    </td>
                    <td className="py-2 px-4" style={{ fontSize: "14px" }}>
                      {formatQuantity(row.summary?.totalShortQty || 0)}
                    </td>
                    <td className="py-2 px-4">
                      <ActionButtons
                        maxVisibleActions={4}
                        items={[
                          {
                            tooltip: "View",
                            action: ACTION_BUTTON_TYPES.VIEW,
                            onClick: (e) => {
                              e?.stopPropagation?.();
                              openDetailModal(row);
                            },
                          },
                          canAct &&
                            row.status === "pending" && {
                              tooltip: "Mark picked",
                              action: ACTION_BUTTON_TYPES.CHANGE_STATUS,
                              disabled: busy,
                              loading: busy,
                              onClick: (e) => {
                                e?.stopPropagation?.();
                                runAction(row, "pick");
                              },
                            },
                          canAct && {
                            tooltip: "Done",
                            action: ACTION_BUTTON_TYPES.APPROVE,
                            disabled: busy,
                            loading: busy,
                            onClick: (e) => {
                              e?.stopPropagation?.();
                              runAction(row, "done");
                            },
                          },
                          canAct && {
                            tooltip: "Cancel",
                            action: ACTION_BUTTON_TYPES.DELETE,
                            disabled: busy,
                            loading: busy,
                            onClick: (e) => {
                              e?.stopPropagation?.();
                              runAction(row, "cancel");
                            },
                          },
                        ].filter(Boolean)}
                      />
                    </td>
                  </tr>
                );
              }}
            />
          </div>
        </div>
      </div>

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)}>
        <ModalHeader>New Pick List</ModalHeader>
        <ModalBody>
          <div className="grid grid-cols-1 gap-3">
            {!isSingleAssignedBusiness() && <div>
              <label className="text-xs text-gray-500">Business *</label>
              <DropdownBasic
                value={form.business}
                onChange={(v) => setForm((p) => ({ ...p, business: v || "" }))}
                options={businesses.map((b) => ({ value: b._id, label: b.name }))}
                placeholder="Select business"
              />
            </div>}
            <InputField
              label="Name"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Optional"
            />
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!form.includeComposition}
                onChange={(e) =>
                  setForm((p) => ({ ...p, includeComposition: e.target.checked }))
                }
              />
              Include composition ingredients plan
            </label>

            <div className="space-y-2">
              <div className="text-sm font-medium">Lines</div>
              {lines.map((l, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2">
                  <div className="col-span-8">
                    <DropdownBasic
                      value={l.itemId}
                      onChange={(v) =>
                        setLines((prev) =>
                          prev.map((row, i) => (i === idx ? { ...row, itemId: v || "" } : row)),
                        )
                      }
                      options={itemOptions.map((it) => ({
                        value: String(it._id),
                        label: `${it.name}${it.itemCode ? ` (${it.itemCode})` : ""}`,
                      }))}
                      placeholder="Select item"
                    />
                  </div>
                  <div className="col-span-3">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      className="w-full border rounded px-2 py-2"
                      value={l.quantity}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((row, i) =>
                            i === idx ? { ...row, quantity: e.target.value } : row,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="col-span-1">
                    <button
                      type="button"
                      className="w-full border rounded py-2"
                      onClick={() =>
                        setLines((prev) => prev.filter((_, i) => i !== idx))
                      }
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="px-2 py-1 border rounded text-sm"
                onClick={() => setLines((prev) => [...prev, { itemId: "", quantity: "" }])}
              >
                + Add line
              </button>
            </div>

            {preview && (
              <div className="p-3 border rounded bg-gray-50 text-xs">
                <div>Total lines: {preview.summary?.totalLines || 0}</div>
                <div>
                  Required:{" "}
                  {formatQuantity(preview.summary?.totalRequiredQty || 0)}
                </div>
                <div>
                  Allocated:{" "}
                  {formatQuantity(preview.summary?.totalAllocatedQty || 0)}
                </div>
                <div>
                  Short: {formatQuantity(preview.summary?.totalShortQty || 0)}
                </div>
                {(preview.warnings || []).length > 0 && (
                  <div className="mt-2 text-amber-700">
                    {preview.warnings.join(" | ")}
                  </div>
                )}
              </div>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <div className="w-full flex justify-between gap-2">
            <button
              type="button"
              className="px-3 py-2 border rounded"
              onClick={runPreview}
              disabled={creating}
            >
              Preview
            </button>
            <button
              type="button"
              className="px-3 py-2 rounded bg-[var(--p-blue)] text-white"
              onClick={submitCreate}
              disabled={creating}
            >
              {creating ? "Creating..." : "Create"}
            </button>
          </div>
        </ModalFooter>
      </Modal>

      {detailRow &&
        createPortal(
          <div
            className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40"
            onClick={() => setDetailRow(null)}
            role="presentation"
          >
            <div
              className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="pick-detail-title"
            >
              <div className="flex items-start justify-between gap-3 px-5 py-4 border-b">
                <div className="min-w-0">
                  <h2
                    id="pick-detail-title"
                    className="text-lg font-semibold text-gray-900 font-mono"
                  >
                    {detailRow.reference}
                  </h2>
                  <p className="text-sm text-gray-500 mt-0.5 truncate">
                    {detailRow.name || "Pick plan"} ·{" "}
                    {detailRow.business?.name || "—"}
                    {detailRow.status
                      ? ` · ${STATUS_LABELS[detailRow.status] || detailRow.status}`
                      : ""}
                  </p>
                </div>
                <button
                  type="button"
                  className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
                  onClick={() => setDetailRow(null)}
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 overflow-auto">
                <PickLineDetails row={detailRow} />
              </div>
            </div>
          </div>,
          document.body,
        )}

      {hoverPreview?.row &&
        !detailRow &&
        createPortal(
          <div
            className="fixed z-[70] bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden"
            style={{
              left: hoverPreview.left,
              top: hoverPreview.top,
              width: hoverPreview.width,
              maxHeight: hoverPreview.maxHeight,
            }}
            onMouseEnter={keepHoverPreview}
            onMouseLeave={scheduleCloseHoverPreview}
          >
            <div className="px-3 py-2 border-b bg-gray-50 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-900 font-mono truncate">
                  {hoverPreview.row.reference}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  Item, qty, location aur batch
                </div>
              </div>
              <button
                type="button"
                className="text-xs text-[var(--p-blue)] hover:underline shrink-0"
                onClick={() => openDetailModal(hoverPreview.row)}
              >
                Open
              </button>
            </div>
            <div
              className="p-3 overflow-auto"
              style={{ maxHeight: hoverPreview.maxHeight - 48 }}
            >
              <PickLineDetails row={hoverPreview.row} />
            </div>
          </div>,
          document.body,
        )}
    </RoutePermissionGate>
  );
};

export default PickLists;
