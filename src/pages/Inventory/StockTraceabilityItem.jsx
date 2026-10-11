import React, { useState, useEffect, useMemo, useContext } from "react";
import axios from "axios";
import { useHistory, useParams, useLocation } from "react-router-dom";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AdminContext } from "@/context/AdminContext";
import { PageHeader, useFormScreenExit, DropdownBasic } from "@/page-layouts/index";
import { notifyError } from "@/utils/toast";
import { syncAssignedBusinessesFromApi } from "@/utils/sessionAssignedBusinesses";
import RoutePermissionGate from "@/components/RoutePermissionGate";
import { formatDate, formatQuantity } from "@/components/formatAmount";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const TYPE_STYLES = {
  purchase_received: "bg-emerald-100 text-emerald-800",
  sale_delivery: "bg-blue-100 text-blue-800",
  sale_consumption: "bg-indigo-100 text-indigo-800",
  adjustment: "bg-amber-100 text-amber-800",
  internal_transfer: "bg-purple-100 text-purple-800",
};

const formatSignedQty = (qty) => {
  if (qty === null || qty === undefined || qty === "") return "—";
  const n = parseFloat(qty);
  if (Number.isNaN(n)) return "—";
  const formatted = formatQuantity(Math.abs(n));
  if (n > 0) return `+${formatted}`;
  if (n < 0) return `-${formatted}`;
  return formatted;
};

const locLabel = (loc, wh) => {
  if (!loc && !wh) return "—";
  const l = loc?.code || loc?.name;
  const w = wh?.name || wh?.code;
  if (w && l) return `${w} / ${l}`;
  return l || w || "—";
};

const StockTraceabilityItem = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const location = useLocation();
  const { itemId } = useParams();
  const exitScreen = useFormScreenExit("/stock-traceability");
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo?.token}`,
    }),
    [adminInfo?.token],
  );

  const tWithFallback = (key, fallback) => {
    const translated = t(key, { defaultValue: fallback });
    return translated && translated !== key ? translated : fallback;
  };

  const initialLot = useMemo(() => {
    try {
      return new URLSearchParams(location.search).get("lot") || "";
    } catch (_) {
      return "";
    }
  }, [location.search]);

  const [item, setItem] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [businesses, setBusinesses] = useState([]);
  const [businessId, setBusinessId] = useState("");
  const [lotFilter, setLotFilter] = useState(initialLot);

  useEffect(() => {
    setLotFilter(initialLot);
  }, [initialLot]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await syncAssignedBusinessesFromApi(Base_URL);
      if (!cancelled) {
        setBusinesses(list || []);
        if (list?.length === 1) setBusinessId(list[0]._id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!itemId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${Base_URL}/items/${itemId}`, { headers });
        if (!cancelled) setItem(res.data?.data || res.data || null);
      } catch (_) {
        if (!cancelled) setItem(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [itemId, headers]);

  useEffect(() => {
    if (!itemId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const params = {
          lotNumber: lotFilter || undefined,
          limit: 300,
        };
        if (businessId) params.businessId = businessId;
        else if (businesses.length) {
          params.businessIds = businesses.map((b) => b._id).join(",");
        }

        const res = await axios.get(
          `${Base_URL}/stock-movements/item/${itemId}`,
          { headers, params },
        );
        if (!cancelled) setRows(res.data?.data || []);
      } catch (err) {
        if (!cancelled) {
          setRows([]);
          notifyError(
            err?.response?.data?.message || "Failed to load product timeline",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [itemId, businessId, lotFilter, businesses, headers]);

  return (
    <RoutePermissionGate>
      <div className="bg-gray-50 min-h-screen pb-16">
        <div className="px-6 py-6 max-w-5xl mx-auto">
          <PageHeader
            title={
              item?.name
                ? `${item.name} — Traceability`
                : tWithFallback(
                    "stockTraceability.timeline",
                    "Product Traceability",
                  )
            }
            description={
              item?.itemCode
                ? `Code: ${item.itemCode}${
                    item.trackingMethod && item.trackingMethod !== "none"
                      ? ` · Tracking: ${item.trackingMethod}`
                      : ""
                  }`
                : tWithFallback(
                    "stockTraceability.timelineHint",
                    "Chronological movement history for this product.",
                  )
            }
            showBackButton
            onBackClick={exitScreen}
          />

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mt-6 mb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-gray-700">Filters</p>
              {(businessId || lotFilter) && (
                <button
                  type="button"
                  onClick={() => {
                    setBusinessId("");
                    setLotFilter("");
                  }}
                  className="inline-flex items-center gap-1 text-sm text-red-600 hover:underline"
                >
                  <X size={14} />
                  Clear filters
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-4 items-end">
              {businesses.length > 1 && (
                <div className="min-w-[200px]">
                  <label className="block text-xs text-gray-500 mb-1">
                    Business
                  </label>
                  <DropdownBasic
                    value={businessId}
                    onChange={(v) => setBusinessId(v || "")}
                    options={[
                      { value: "", label: "All assigned", first: true },
                      ...businesses.map((b) => ({
                        value: b._id,
                        label: b.name,
                      })),
                    ]}
                    placeholder="All businesses"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Lot / Serial
                </label>
                <input
                  type="text"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-[180px]"
                  placeholder="Filter lot…"
                  value={lotFilter}
                  onChange={(e) => setLotFilter(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-8 flex items-center gap-2 text-gray-500">
                <span
                  className="inline-block w-5 h-5 border-2 border-gray-300 border-t-[var(--p-blue)] rounded-full animate-spin"
                  aria-hidden
                />
                Loading timeline…
              </div>
            ) : !rows.length ? (
              <div className="p-8 text-gray-500 text-sm">
                No movements recorded for this product yet.
              </div>
            ) : (
              <div className="relative pl-8 pr-4 py-6">
                <div className="absolute left-4 top-6 bottom-6 w-px bg-gray-200" />
                <ul className="space-y-5">
                  {rows.map((row) => (
                    <li key={row._id} className="relative">
                      <span
                        className={`absolute -left-6 top-1.5 w-3 h-3 rounded-full border-2 border-white ${
                          row.quantity >= 0 ? "bg-emerald-500" : "bg-red-500"
                        }`}
                      />
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                                TYPE_STYLES[row.type] ||
                                "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {row.typeLabel || row.type}
                            </span>
                            <span
                              className={`font-semibold ${
                                row.quantity >= 0
                                  ? "text-emerald-700"
                                  : "text-red-600"
                              }`}
                            >
                              {formatSignedQty(row.quantity)}
                              {row.item?.unit || item?.unit
                                ? ` ${row.item?.unit || item?.unit}`
                                : ""}
                            </span>
                            {row.lotNumber ? (
                              <span className="text-xs text-gray-500">
                                Lot {row.lotNumber}
                              </span>
                            ) : null}
                          </div>
                          <p className="text-sm text-gray-700">
                            {row.fromLocation || row.toLocation
                              ? `${locLabel(row.fromLocation, null)} → ${locLabel(
                                  row.toLocation || row.location,
                                  row.warehouse,
                                )}`
                              : locLabel(row.location, row.warehouse)}
                          </p>
                          {row.reference?.label ? (
                            <p className="text-xs text-gray-500 mt-0.5">
                              Ref: {row.reference.label}
                              {row.user?.name ? ` · ${row.user.name}` : ""}
                            </p>
                          ) : row.user?.name ? (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {row.user.name}
                            </p>
                          ) : null}
                          {row.notes ? (
                            <p className="text-xs text-gray-400 mt-0.5">
                              {row.notes}
                            </p>
                          ) : null}
                        </div>
                        <div className="text-xs text-gray-500 whitespace-nowrap">
                          {row.createdAt
                            ? formatDate(row.createdAt, false, true) || "—"
                            : "—"}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="mt-4">
            <button
              type="button"
              className="text-sm text-[var(--p-blue)] hover:underline"
              onClick={() => history.push("/stock-traceability")}
            >
              ← Back to all movements
            </button>
          </div>
        </div>
      </div>
    </RoutePermissionGate>
  );
};

export default StockTraceabilityItem;
