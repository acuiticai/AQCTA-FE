import React, { useContext, useEffect, useMemo, useState, useCallback } from "react";
import { useHistory } from "react-router-dom";
import {
  LayoutGrid,
  RefreshCw,
  Users,
  CircleDollarSign,
  Clock3,
  ShoppingCart,
  Store,
  ExternalLink,
  TrendingUp,
} from "lucide-react";
import { AdminContext } from "@/context/AdminContext";
import PosServices from "@/services/PosServices";
import DropdownBasic from "@/page-layouts/components/DropdownBasic";
import { posFilterBarSelectStyles } from "./utils/posFilterBarStyles";
import { notifyError } from "@/utils/toast";

const STATUS_COLOR = {
  available: {
    dot: "bg-gray-400",
    accent: "bg-gray-300",
    text: "text-gray-700",
    border: "border-gray-200",
    tag: "bg-gray-100 text-gray-700",
  },
  occupied: {
    dot: "bg-amber-500",
    accent: "bg-amber-500",
    text: "text-amber-800",
    border: "border-amber-200",
    tag: "bg-amber-100 text-amber-800",
  },
  reserved: {
    dot: "bg-red-500",
    accent: "bg-red-500",
    text: "text-red-800",
    border: "border-red-200",
    tag: "bg-red-100 text-red-800",
  },
};

const PHASE_META = {
  new: {
    label: "New order",
    tag: "bg-gray-200 text-gray-700",
    dot: "bg-gray-500",
  },
  preparing: {
    label: "Preparing",
    tag: "bg-amber-100 text-amber-800",
    dot: "bg-amber-500",
  },
  ready: {
    label: "Ready to serve",
    tag: "bg-emerald-100 text-emerald-800",
    dot: "bg-emerald-500",
  },
  served: {
    label: "Awaiting payment",
    tag: "bg-indigo-100 text-indigo-800",
    dot: "bg-indigo-500",
  },
};

const formatElapsed = (iso) => {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (!then) return "—";
  const mins = Math.max(0, Math.floor((Date.now() - then) / 60000));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
};

const StatCard = ({ icon: Icon, label, value, accent, caption }) => (
  <div className="flex flex-col gap-2 p-4 rounded-2xl bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-150">
    <div className="flex items-center justify-between">
      <span className={`h-9 w-9 inline-flex items-center justify-center rounded-xl ${accent}`}>
        <Icon size={17} />
      </span>
      {caption && (
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
          {caption}
        </span>
      )}
    </div>
    <div>
      <div className="text-[26px] font-extrabold text-gray-900 leading-none tabular-nums tracking-tight">{value}</div>
      <div className="text-[11px] text-gray-500 mt-1.5 font-medium">{label}</div>
    </div>
  </div>
);

const PosTablesSummary = () => {
  const {
    state: { adminInfo },
  } = useContext(AdminContext);
  const history = useHistory();

  const businesses = useMemo(
    () => adminInfo?.businesses || [],
    [adminInfo?.businesses]
  );
  const token = adminInfo?.token;
  const headers = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token]
  );

  const [businessId, setBusinessId] = useState(() => {
    const fromQuery =
      new URLSearchParams(window.location.search).get("selectedOrg") || "";
    return fromQuery || localStorage.getItem("pos.selectedBusiness") || "";
  });

  useEffect(() => {
    if (!businesses.length) return;
    const valid = new Set(businesses.map((b) => b._id));
    if (!businessId || !valid.has(businessId)) {
      setBusinessId(businesses[0]._id);
    }
  }, [businesses, businessId]);

  const [tables, setTables] = useState([]);
  const [floors, setFloors] = useState(["All"]);
  const [loading, setLoading] = useState(false);
  const [floorFilter, setFloorFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchTables = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const res = await PosServices.getTables(
        { business: businessId, floor: "" },
        headers
      );
      if (res.data?.success) {
        setTables(res.data.data || []);
        setFloors(res.data.floors || ["All"]);
      }
    } catch (err) {
      notifyError(err?.response?.data?.message || "Failed to load tables");
    } finally {
      setLoading(false);
    }
  }, [businessId, headers]);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  // Auto-refresh every 20s so admins see live occupancy changes
  useEffect(() => {
    if (!businessId) return;
    const id = setInterval(fetchTables, 20000);
    return () => clearInterval(id);
  }, [businessId, fetchTables]);

  const stats = useMemo(() => {
    const base = {
      total: tables.length,
      available: 0,
      occupied: 0,
      reserved: 0,
      activeOrderTotal: 0,
      phases: { new: 0, preparing: 0, ready: 0, served: 0 },
      longestOccupiedMins: 0,
      averageOccupiedMins: 0,
    };
    let occupiedSumMins = 0;
    tables.forEach((t) => {
      if (base[t.status] !== undefined) base[t.status] += 1;
      if (t.status === "occupied") {
        base.activeOrderTotal += Number(t.currentOrder?.total || 0);
        const since = t.currentOrder?.createdAt;
        if (since) {
          const mins = Math.max(
            0,
            Math.floor((Date.now() - new Date(since).getTime()) / 60000)
          );
          occupiedSumMins += mins;
          if (mins > base.longestOccupiedMins) base.longestOccupiedMins = mins;
        }
        if (t.kitchenPhase && base.phases[t.kitchenPhase] !== undefined) {
          base.phases[t.kitchenPhase] += 1;
        }
      }
    });
    base.utilization =
      base.total > 0
        ? Math.round(((base.occupied + base.reserved) / base.total) * 100)
        : 0;
    base.averageOccupiedMins =
      base.occupied > 0 ? Math.round(occupiedSumMins / base.occupied) : 0;
    return base;
  }, [tables]);

  const floorList = useMemo(
    () => (floors.length ? floors : ["All"]),
    [floors]
  );

  const filteredTables = useMemo(() => {
    let list = tables;
    if (floorFilter !== "All") list = list.filter((t) => t.floor === floorFilter);
    if (statusFilter !== "all") list = list.filter((t) => t.status === statusFilter);
    return list;
  }, [tables, floorFilter, statusFilter]);

  const floorBreakdown = useMemo(() => {
    const map = new Map();
    tables.forEach((t) => {
      const key = t.floor || "—";
      const entry = map.get(key) || {
        floor: key,
        total: 0,
        available: 0,
        occupied: 0,
        reserved: 0,
      };
      entry.total += 1;
      if (entry[t.status] !== undefined) entry[t.status] += 1;
      map.set(key, entry);
    });
    return Array.from(map.values()).sort((a, b) =>
      String(a.floor).localeCompare(String(b.floor))
    );
  }, [tables]);

  const handleOpenPos = useCallback(() => {
    const params = new URLSearchParams();
    if (businessId) params.set("selectedOrg", businessId);
    history.push(`/pos${params.toString() ? `?${params.toString()}` : ""}`);
  }, [businessId, history]);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--p-blue)]/10 text-[var(--p-blue)] text-[10px] font-bold uppercase tracking-wider">
            <LayoutGrid size={11} />
            POS Admin
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mt-2 tracking-tight">
            Tables Summary
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Live view of table occupancy and active orders
          </p>
        </div>

        <div className="flex items-center gap-2">
          {businesses.length > 1 && (
            <div className="w-full sm:w-72 h-9 shrink-0">
              <DropdownBasic
                value={businessId}
                onChange={(v) => setBusinessId(v || "")}
                options={businesses.map((b) => ({ value: b._id, label: b.name }))}
                placeholder="Select Business"
                width="100%"
                appearance="filterPill"
                isClearable={false}
                styles={posFilterBarSelectStyles}
              />
            </div>
          )}
          <button
            type="button"
            onClick={fetchTables}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 h-9 text-xs font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            type="button"
            onClick={handleOpenPos}
            className="inline-flex items-center gap-1.5 px-3 h-9 text-xs font-semibold text-white bg-[var(--p-blue)] hover:opacity-90 rounded-lg transition-all"
          >
            <Store size={13} />
            Open POS
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <StatCard
          icon={Users}
          label="Total Tables"
          value={stats.total}
          accent="bg-gray-100 text-gray-700"
        />
        <StatCard
          icon={LayoutGrid}
          label="Available"
          value={stats.available}
          accent="bg-green-100 text-green-700"
        />
        <StatCard
          icon={ShoppingCart}
          label="Occupied"
          value={stats.occupied}
          accent="bg-amber-100 text-amber-700"
        />
        <StatCard
          icon={Clock3}
          label="Reserved"
          value={stats.reserved}
          accent="bg-red-100 text-red-700"
        />
        <StatCard
          icon={TrendingUp}
          label="Utilization"
          value={`${stats.utilization}%`}
          caption="live"
          accent="bg-indigo-100 text-indigo-700"
        />
      </div>

      {/* Kitchen pulse: phases of currently-occupied tables */}
      {stats.occupied > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-900">Kitchen Pulse</h3>
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              {stats.occupied} occupied · avg {stats.averageOccupiedMins}m
              {stats.longestOccupiedMins > 0 &&
                ` · longest ${stats.longestOccupiedMins}m`}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(["new", "preparing", "ready", "served"]).map((k) => {
              const meta = PHASE_META[k];
              const count = stats.phases[k] || 0;
              const pct = stats.occupied
                ? Math.round((count / stats.occupied) * 100)
                : 0;
              return (
                <div
                  key={k}
                  className="p-3 rounded-xl bg-gray-50 border border-gray-100"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${meta.tag}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                      {meta.label}
                    </span>
                    <span className="text-[10px] text-gray-400 font-semibold">
                      {pct}%
                    </span>
                  </div>
                  <div className="text-lg font-bold text-gray-900 mt-1">
                    {count}
                  </div>
                  <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${meta.dot}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Floor breakdown */}
      {floorBreakdown.length > 1 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-6">
          <h3 className="text-sm font-bold text-gray-900 mb-3">
            Floor Breakdown
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="py-2 pr-3 font-semibold">Floor</th>
                  <th className="py-2 px-3 font-semibold text-center">Total</th>
                  <th className="py-2 px-3 font-semibold text-center">
                    Available
                  </th>
                  <th className="py-2 px-3 font-semibold text-center">
                    Occupied
                  </th>
                  <th className="py-2 px-3 font-semibold text-center">
                    Reserved
                  </th>
                  <th className="py-2 pl-3 font-semibold text-right">
                    Utilization
                  </th>
                </tr>
              </thead>
              <tbody>
                {floorBreakdown.map((f) => {
                  const util =
                    f.total > 0
                      ? Math.round(((f.occupied + f.reserved) / f.total) * 100)
                      : 0;
                  return (
                    <tr
                      key={f.floor}
                      className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors"
                    >
                      <td className="py-2.5 pr-3 font-semibold text-gray-800">
                        {f.floor}
                      </td>
                      <td className="py-2.5 px-3 text-center text-gray-700">
                        {f.total}
                      </td>
                      <td className="py-2.5 px-3 text-center text-gray-700">
                        {f.available}
                      </td>
                      <td className="py-2.5 px-3 text-center text-amber-700 font-semibold">
                        {f.occupied}
                      </td>
                      <td className="py-2.5 px-3 text-center text-red-700 font-semibold">
                        {f.reserved}
                      </td>
                      <td className="py-2.5 pl-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <div className="w-20 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className="h-full bg-[var(--p-blue)]"
                              style={{ width: `${util}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-semibold text-gray-700 w-8 text-right">
                            {util}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="inline-flex h-9 items-stretch gap-0.5 p-0.5 bg-gray-100 rounded-full overflow-x-auto shrink-0">
          {floorList.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFloorFilter(f)}
              className={`
                px-3 flex items-center text-[11px] font-semibold rounded-full whitespace-nowrap transition-all duration-150 active:scale-[0.97]
                ${
                  floorFilter === f
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-800"
                }
              `}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="inline-flex h-9 items-stretch gap-0.5 p-0.5 bg-gray-100 rounded-full ml-auto shrink-0">
          {[
            { key: "all", label: "All", count: stats.total },
            { key: "available", label: "Free", count: stats.available },
            { key: "occupied", label: "Occupied", count: stats.occupied },
            { key: "reserved", label: "Reserved", count: stats.reserved },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setStatusFilter(t.key)}
              className={`
                px-3 flex items-center text-[11px] font-semibold rounded-full whitespace-nowrap transition-all duration-150 active:scale-[0.97]
                ${
                  statusFilter === t.key
                    ? "bg-[var(--p-blue)] text-white shadow-sm shadow-[var(--p-blue)]/25"
                    : "text-gray-600 hover:text-gray-800"
                }
              `}
            >
              {t.label} <span className="opacity-70 tabular-nums">{t.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Table grid */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
        {loading && tables.length === 0 ? (
          <div className="flex items-center justify-center py-14">
            <div className="w-8 h-8 border-2 border-gray-200 border-t-[var(--p-blue)] rounded-full animate-spin" />
          </div>
        ) : filteredTables.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-gray-400">
            <LayoutGrid size={28} />
            <p className="text-xs mt-2">No tables match your filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filteredTables.map((t) => {
              const c = STATUS_COLOR[t.status] || STATUS_COLOR.available;
              const order = t.currentOrder;
              return (
                <div
                  key={t._id}
                  className={`relative flex flex-col gap-2 p-3 pl-4 rounded-xl border ${c.border} bg-white shadow-sm hover:shadow-md transition-shadow duration-150 overflow-hidden`}
                >
                  <span className={`absolute left-0 top-0 bottom-0 w-1 ${c.accent}`} />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${c.dot}`} />
                      <span className="text-sm font-bold text-gray-900">
                        {t.tableNumber}
                      </span>
                      {t.label && (
                        <span className="text-[10px] text-gray-500 truncate max-w-[80px]">
                          {t.label}
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${c.tag}`}
                    >
                      {t.status}
                    </span>
                  </div>

                  {t.status === "occupied" && PHASE_META[t.kitchenPhase] && (
                    <div
                      className={`inline-flex items-center gap-1 self-start text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${PHASE_META[t.kitchenPhase].tag}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${PHASE_META[t.kitchenPhase].dot}`}
                      />
                      {PHASE_META[t.kitchenPhase].label}
                    </div>
                  )}

                  <div className="flex items-center gap-3 text-[10px] text-gray-500">
                    <span className="inline-flex items-center gap-1">
                      <Users size={10} />
                      {t.capacity || 0}
                    </span>
                    {t.floor && (
                      <span className="inline-flex items-center gap-1">
                        <LayoutGrid size={10} />
                        {t.floor}
                      </span>
                    )}
                  </div>

                  {t.status === "occupied" && order ? (
                    <div className="mt-1 p-2 rounded-lg bg-white border border-gray-100">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-gray-500">Order</span>
                        <span className="font-semibold text-gray-800 truncate max-w-[110px]">
                          {order.orderNumber || "—"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] mt-0.5">
                        <span className="text-gray-500 inline-flex items-center gap-1">
                          <CircleDollarSign size={10} />
                          Total
                        </span>
                        <span className="font-bold text-gray-900">
                          RM {Number(order.total || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] mt-0.5">
                        <span className="text-gray-400 inline-flex items-center gap-1">
                          <Clock3 size={10} />
                          Open
                        </span>
                        <span className="text-gray-500">
                          {formatElapsed(order.createdAt)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1" />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {tables.length > 0 && (
          <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-100 text-[11px] text-gray-500">
            <span>
              Active order value:{" "}
              <span className="font-bold text-gray-800">
                RM {stats.activeOrderTotal.toFixed(2)}
              </span>
            </span>
            <button
              type="button"
              onClick={handleOpenPos}
              className="inline-flex items-center gap-1 text-[var(--p-blue)] font-semibold hover:underline"
            >
              Open POS terminal
              <ExternalLink size={11} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PosTablesSummary;
