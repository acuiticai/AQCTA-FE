import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import ReactSelect from "react-select";
import { FiFilter, FiUserCheck } from "react-icons/fi";
import reactSelectConfig, {
  getModalReactSelectStyles,
} from "@/utils/react-select-style-config";
import { notifyError, notifySuccess } from "@/utils/toast";
import {
  getCustomerDisplayName,
  getCustomerEmail,
  getCustomerPhone,
  getCustomerSelectLabel,
  isContactableCustomer,
  mergeCustomerRecipients,
} from "@/utils/broadcastCustomerRecipients";
import MarketingCustomerFilterPanel from "@/components/Broadcasts/MarketingCustomerFilterPanel";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const MODES = [
  {
    id: "manual",
    label: "Pick by name",
    hint: "Search and add specific customers",
    icon: FiUserCheck,
  },
  {
    id: "filter",
    label: "Filter & bulk add",
    hint: "By signup date or order history",
    icon: FiFilter,
  },
];

export default function MarketingCustomerRecipientsPicker({
  businessId,
  recipients = [],
  onRecipientsChange,
  authHeaders,
  disabled = false,
}) {
  const [mode, setMode] = useState("manual");
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    if (!businessId || !authHeaders?.authorization) {
      setCustomers([]);
      setSelected([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setSelected([]);

    axios
      .get(`${Base_URL}/customers`, {
        params: { businessId, page: 1, limit: 9999 },
        headers: authHeaders,
      })
      .then((res) => {
        if (cancelled) return;
        const list = res.data?.customers || res.data?.data || [];
        setCustomers(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) {
          setCustomers([]);
          notifyError("Could not load customers for this business");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [businessId, authHeaders?.authorization]);

  const selectStyles = useMemo(() => getModalReactSelectStyles(reactSelectConfig), []);

  const options = useMemo(() => {
    return customers
      .filter(isContactableCustomer)
      .map((c) => ({
        value: c._id,
        label: getCustomerSelectLabel(c),
        customer: c,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [customers]);

  const filterOption = (option, input) => {
    if (!input) return true;
    const q = input.trim().toLowerCase();
    const c = option.customer ?? option.data?.customer;
    if (!c) return (option.label || "").toLowerCase().includes(q);
    const haystack = [
      getCustomerSelectLabel(c),
      getCustomerEmail(c),
      getCustomerPhone(c),
      getCustomerDisplayName(c),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  };

  const handleAdd = () => {
    if (!selected.length) {
      notifyError("Select at least one customer");
      return;
    }
    const picked = selected.map((o) => o.customer);
    const { recipients: merged, added, skippedDuplicate, skippedNoContact } =
      mergeCustomerRecipients(recipients, picked);

    onRecipientsChange(merged);

    if (added > 0) {
      const parts = [`Added ${added} customer${added === 1 ? "" : "s"}`];
      if (skippedDuplicate) parts.push(`${skippedDuplicate} already in list`);
      if (skippedNoContact) parts.push(`${skippedNoContact} without email or phone`);
      notifySuccess(parts.join(" · "));
      setSelected([]);
    } else {
      notifyError(
        skippedDuplicate
          ? "Selected customer(s) are already in the recipient list"
          : "No customers could be added (missing email and phone)",
      );
    }
  };

  if (!businessId) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 px-4 py-3 text-sm text-gray-500">
        Select a business above to add customers as recipients.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-gray-100 bg-gradient-to-b from-gray-50/80 to-white">
        <p className="text-sm font-semibold text-gray-900 mb-0.5">Add from customers</p>
        <p className="text-xs text-gray-500 mb-3">
          Uses email and phone from each customer record
        </p>

        <div className="flex gap-2 p-1 rounded-xl bg-gray-100/80">
          {MODES.map((m) => {
            const Icon = m.icon;
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                disabled={disabled}
                onClick={() => setMode(m.id)}
                className={`flex-1 rounded-lg px-3 py-2.5 text-left transition-all ${
                  active
                    ? "bg-white shadow-sm ring-1 ring-gray-200"
                    : "hover:bg-white/60"
                } disabled:opacity-50`}
              >
                <span className="flex items-center gap-2">
                  <Icon
                    size={15}
                    className={active ? "text-emerald-600" : "text-gray-500"}
                  />
                  <span
                    className={`text-sm font-medium ${
                      active ? "text-gray-900" : "text-gray-600"
                    }`}
                  >
                    {m.label}
                  </span>
                </span>
                <span className="block text-[11px] text-gray-500 mt-0.5 pl-[23px]">
                  {m.hint}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 py-4">
        {mode === "manual" ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <label className="block text-sm text-gray-700 flex-1 min-w-[12rem]">
                Search customers
                {!loading && options.length > 0 ? (
                  <span className="text-gray-400 font-normal">
                    {" "}
                    · {options.length} available
                  </span>
                ) : null}
              </label>
              <button
                type="button"
                onClick={handleAdd}
                disabled={disabled || loading || selected.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                Add selected
                {selected.length > 0 ? ` (${selected.length})` : ""}
              </button>
            </div>

            <div className="relative z-0">
              <ReactSelect
                isMulti
                isDisabled={disabled || loading}
                isLoading={loading}
                options={options}
                value={selected}
                onChange={setSelected}
                filterOption={filterOption}
                closeMenuOnScroll={false}
                menuPlacement="auto"
                placeholder={
                  loading
                    ? "Loading customers…"
                    : options.length
                      ? "Type a name, email, or phone…"
                      : "No customers with contact details"
                }
                noOptionsMessage={() =>
                  loading ? "Loading…" : "No matching customers"
                }
                classNamePrefix="react-select"
                styles={selectStyles}
                menuPortalTarget={
                  typeof document !== "undefined" ? document.body : null
                }
                menuPosition="fixed"
              />
            </div>

            {!loading && customers.length > 0 && options.length === 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                Customers exist but none have email or phone filled in.
              </p>
            )}
          </div>
        ) : (
          <MarketingCustomerFilterPanel
            businessId={businessId}
            recipients={recipients}
            onRecipientsChange={onRecipientsChange}
            authHeaders={authHeaders}
            disabled={disabled}
          />
        )}
      </div>
    </div>
  );
}
