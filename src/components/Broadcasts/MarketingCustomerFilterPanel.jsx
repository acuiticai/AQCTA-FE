import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  FiCalendar,
  FiClock,
  FiHash,
  FiShoppingBag,
  FiTrendingUp,
  FiUserPlus,
} from "react-icons/fi";
import { notifyError, notifySuccess } from "@/utils/toast";
import { mergeCustomerRecipients } from "@/utils/broadcastCustomerRecipients";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const FILTER_TYPES = [
  {
    id: "signedUpAfter",
    label: "New signups",
    description: "Joined on or after a date",
    icon: FiCalendar,
    color: "sky",
  },
  {
    id: "noOrders",
    label: "No orders",
    description: "Never placed an order",
    icon: FiShoppingBag,
    color: "amber",
  },
  {
    id: "orderCount",
    label: "Exact order count",
    description: "Has a specific number of orders",
    icon: FiHash,
    color: "violet",
  },
  {
    id: "lastOrderBefore",
    label: "Last order before",
    description: "Haven't ordered since this date",
    icon: FiClock,
    color: "rose",
  },
  {
    id: "lastOrderAfter",
    label: "Ordered recently",
    description: "Last order on or after a date",
    icon: FiTrendingUp,
    color: "emerald",
  },
];

const COLOR_STYLES = {
  sky: {
    card: "border-sky-200 bg-sky-50 ring-sky-500",
    icon: "bg-sky-100 text-sky-700",
  },
  amber: {
    card: "border-amber-200 bg-amber-50 ring-amber-500",
    icon: "bg-amber-100 text-amber-700",
  },
  violet: {
    card: "border-violet-200 bg-violet-50 ring-violet-500",
    icon: "bg-violet-100 text-violet-700",
  },
  rose: {
    card: "border-rose-200 bg-rose-50 ring-rose-500",
    icon: "bg-rose-100 text-rose-700",
  },
  emerald: {
    card: "border-emerald-200 bg-emerald-50 ring-emerald-500",
    icon: "bg-emerald-100 text-emerald-700",
  },
};

function buildFilterParams(filterType, values) {
  if (!filterType) return null;

  if (filterType === "signedUpAfter" && values.date) {
    return { signedUpOnOrAfter: values.date };
  }
  if (filterType === "noOrders") {
    return { orderCount: 0 };
  }
  if (filterType === "orderCount" && values.orderCount !== "") {
    return { orderCount: values.orderCount };
  }
  if (filterType === "lastOrderBefore" && values.date) {
    return { lastOrderOnOrBefore: values.date };
  }
  if (filterType === "lastOrderAfter" && values.date) {
    return { lastOrderOnOrAfter: values.date };
  }
  return null;
}

function isFilterReady(filterType, values) {
  if (!filterType) return false;
  if (filterType === "noOrders") return true;
  if (filterType === "orderCount") return values.orderCount !== "";
  return Boolean(values.date);
}

function humanFilterLabel(filterType, values) {
  if (filterType === "signedUpAfter" && values.date) {
    return `Joined on or after ${formatDisplayDate(values.date)}`;
  }
  if (filterType === "noOrders") return "Have no orders";
  if (filterType === "orderCount" && values.orderCount !== "") {
    const n = Number(values.orderCount);
    return `Have exactly ${n} order${n === 1 ? "" : "s"}`;
  }
  if (filterType === "lastOrderBefore" && values.date) {
    return `Last order on or before ${formatDisplayDate(values.date)}`;
  }
  if (filterType === "lastOrderAfter" && values.date) {
    return `Last order on or after ${formatDisplayDate(values.date)}`;
  }
  return "";
}

function formatDisplayDate(isoDate) {
  if (!isoDate) return "";
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function MarketingCustomerFilterPanel({
  businessId,
  recipients = [],
  onRecipientsChange,
  authHeaders,
  disabled = false,
}) {
  const [filterType, setFilterType] = useState(null);
  const [date, setDate] = useState("");
  const [orderCount, setOrderCount] = useState("");
  const [matchCount, setMatchCount] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const previewTimer = useRef(null);

  const values = useMemo(() => ({ date, orderCount }), [date, orderCount]);
  const ready = isFilterReady(filterType, values);
  const summary = humanFilterLabel(filterType, values);
  const activeType = FILTER_TYPES.find((t) => t.id === filterType);

  const resetInputs = () => {
    setDate("");
    setOrderCount("");
    setMatchCount(null);
  };

  const selectFilterType = (id) => {
    setFilterType(id);
    setDate("");
    setOrderCount(id === "orderCount" ? "5" : "");
    setMatchCount(null);
  };

  const fetchMatchingCustomers = async () => {
    const params = buildFilterParams(filterType, values);
    if (!params) return [];
    const response = await axios.get(`${Base_URL}/broadcasts/customers/filter`, {
      params: { businessId, ...params },
      headers: authHeaders,
    });
    return response.data?.customers || [];
  };

  useEffect(() => {
    if (!businessId || !ready) {
      setMatchCount(null);
      return undefined;
    }

    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const customers = await fetchMatchingCustomers();
        setMatchCount(customers.length);
      } catch {
        setMatchCount(null);
      } finally {
        setPreviewLoading(false);
      }
    }, 400);

    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, filterType, date, orderCount, ready]);

  const handleAdd = async () => {
    if (!businessId || !ready) {
      notifyError("Choose a filter and fill in the details");
      return;
    }

    setAdding(true);
    try {
      const customers = await fetchMatchingCustomers();
      setMatchCount(customers.length);

      if (customers.length === 0) {
        notifyError("No customers match this filter");
        return;
      }

      const { recipients: merged, added, skippedDuplicate } =
        mergeCustomerRecipients(recipients, customers);

      onRecipientsChange(merged);

      if (added > 0) {
        const msg =
          skippedDuplicate > 0
            ? `Added ${added} customer${added === 1 ? "" : "s"} (${skippedDuplicate} already in list)`
            : `Added ${added} customer${added === 1 ? "" : "s"} to recipients`;
        notifySuccess(msg);
        resetInputs();
        setFilterType(null);
      } else {
        notifyError("All matching customers are already in the recipient list");
      }
    } catch (error) {
      notifyError(error.response?.data?.error || "Could not add customers");
    } finally {
      setAdding(false);
    }
  };

  if (!businessId) return null;

  const activeStyles = activeType ? COLOR_STYLES[activeType.color] : null;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-gray-800 mb-1">What kind of customers?</p>
        <p className="text-xs text-gray-500 mb-3">
          Pick one rule below — we'll find matching customers and add them in one click.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {FILTER_TYPES.map((type) => {
            const Icon = type.icon;
            const selected = filterType === type.id;
            const styles = COLOR_STYLES[type.color];
            return (
              <button
                key={type.id}
                type="button"
                disabled={disabled || adding}
                onClick={() => selectFilterType(type.id)}
                className={`text-left rounded-xl border px-3 py-3 transition-all ${
                  selected
                    ? `${styles.card} ring-2 shadow-sm`
                    : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                } disabled:opacity-50`}
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      selected ? styles.icon : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    <Icon size={16} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-gray-900">
                      {type.label}
                    </span>
                    <span className="block text-xs text-gray-500 mt-0.5">
                      {type.description}
                    </span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {filterType && activeType ? (
        <div
          className={`rounded-xl border p-4 ${activeStyles?.card || "border-gray-200 bg-gray-50"}`}
        >
          <p className="text-sm text-gray-800 mb-3">
            <span className="font-medium">Add customers who </span>
            {filterType === "signedUpAfter" && (
              <>
                joined on or after{" "}
                <input
                  type="date"
                  className="inline-block align-middle mx-1 border border-gray-300 rounded-lg px-2 py-1 text-sm bg-white"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={disabled || adding}
                />
              </>
            )}
            {filterType === "noOrders" && (
              <span className="font-medium">have never placed an order</span>
            )}
            {filterType === "orderCount" && (
              <>
                have exactly{" "}
                <input
                  type="number"
                  min="0"
                  step="1"
                  className="inline-block align-middle w-16 mx-1 border border-gray-300 rounded-lg px-2 py-1 text-sm bg-white text-center"
                  value={orderCount}
                  onChange={(e) => setOrderCount(e.target.value)}
                  disabled={disabled || adding}
                />
                order{Number(orderCount) === 1 ? "" : "s"}
              </>
            )}
            {filterType === "lastOrderBefore" && (
              <>
                last ordered on or before{" "}
                <input
                  type="date"
                  className="inline-block align-middle mx-1 border border-gray-300 rounded-lg px-2 py-1 text-sm bg-white"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={disabled || adding}
                />
              </>
            )}
            {filterType === "lastOrderAfter" && (
              <>
                last ordered on or after{" "}
                <input
                  type="date"
                  className="inline-block align-middle mx-1 border border-gray-300 rounded-lg px-2 py-1 text-sm bg-white"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={disabled || adding}
                />
              </>
            )}
          </p>

          {ready ? (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-black/5">
              <div className="text-sm text-gray-700">
                {previewLoading ? (
                  <span className="text-gray-500">Checking matches…</span>
                ) : matchCount != null ? (
                  <>
                    <span className="text-lg font-bold text-gray-900">{matchCount}</span>
                    <span className="ml-1.5">
                      customer{matchCount === 1 ? "" : "s"} match
                    </span>
                    <span className="block text-xs text-gray-500 mt-0.5">{summary}</span>
                  </>
                ) : (
                  <span className="text-gray-500">Could not check matches</span>
                )}
              </div>

              <button
                type="button"
                onClick={handleAdd}
                disabled={
                  disabled ||
                  adding ||
                  previewLoading ||
                  matchCount == null ||
                  matchCount === 0
                }
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                <FiUserPlus size={16} />
                {adding
                  ? "Adding…"
                  : matchCount != null && matchCount > 0
                    ? `Add ${matchCount} to recipients`
                    : "Add to recipients"}
              </button>
            </div>
          ) : (
            <p className="text-xs text-gray-500 pt-2 border-t border-black/5">
              {filterType === "noOrders"
                ? "Ready — we'll find customers with no sales or POS orders."
                : "Pick a date or number above to see how many customers match."}
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs text-center text-gray-400 py-2">
          Select a filter type above to get started
        </p>
      )}
    </div>
  );
}
