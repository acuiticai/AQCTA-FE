import React, { useEffect, useMemo, useState } from "react";
import { FiList } from "react-icons/fi";
import BroadcastServices from "@/services/BroadcastServices";
import { notifyError } from "@/utils/toast";

export default function MarketingListRecipientsPicker({
  businessId,
  selectedListIds = [],
  onChange,
  authHeaders,
  disabled = false,
}) {
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!businessId || !authHeaders?.authorization) {
      setLists([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    BroadcastServices.listRecipientLists(
      { business_id: businessId, limit: 100 },
      authHeaders,
    )
      .then((res) => {
        if (cancelled) return;
        setLists(res.data?.data || []);
      })
      .catch(() => {
        if (!cancelled) {
          setLists([]);
          notifyError("Could not load recipient lists");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [businessId, authHeaders]);

  const selectedSet = useMemo(
    () => new Set((selectedListIds || []).map(String)),
    [selectedListIds],
  );

  const totalFromSelected = useMemo(() => {
    return lists
      .filter((l) => selectedSet.has(String(l._id)))
      .reduce((sum, l) => sum + (l.memberCount || 0), 0);
  }, [lists, selectedSet]);

  const toggleList = (listId) => {
    if (disabled) return;
    const id = String(listId);
    const next = selectedSet.has(id)
      ? (selectedListIds || []).filter((x) => String(x) !== id)
      : [...(selectedListIds || []), id];
    onChange?.(next);
  };

  if (!businessId) {
    return (
      <p className="text-sm text-gray-500 italic">
        Select a business first to choose recipient lists.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="px-4 py-3 bg-gray-50/80 border-b border-gray-100 flex items-center gap-2">
        <FiList className="text-[var(--p-blue)]" />
        <div>
          <p className="text-sm font-semibold text-gray-900">Saved recipient lists</p>
          <p className="text-xs text-gray-500">
            Select one or more lists — all members are included in this campaign
          </p>
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <p className="text-sm text-gray-500">Loading lists…</p>
        ) : lists.length === 0 ? (
          <p className="text-sm text-gray-500">
            No lists yet. Create lists under the <strong>Recipient Lists</strong> tab on
            this page.
          </p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {lists.map((list) => {
              const checked = selectedSet.has(String(list._id));
              return (
                <label
                  key={list._id}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    checked
                      ? "border-[var(--p-blue)] bg-blue-50/50"
                      : "border-gray-200 hover:bg-gray-50"
                  } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
                >
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggleList(list._id)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-gray-900">
                      {list.name}
                    </span>
                    <span className="block text-xs text-gray-500">
                      {list.memberCount ?? 0} member
                      {(list.memberCount ?? 0) === 1 ? "" : "s"}
                    </span>
                    {list.description ? (
                      <span className="block text-xs text-gray-400 mt-0.5 truncate">
                        {list.description}
                      </span>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </div>
        )}

        {selectedSet.size > 0 ? (
          <p className="text-xs text-gray-600 mt-3">
            {selectedSet.size} list{selectedSet.size === 1 ? "" : "s"} selected · ~
            {totalFromSelected} member{totalFromSelected === 1 ? "" : "s"} (duplicates
            merged automatically)
          </p>
        ) : null}
      </div>
    </div>
  );
}
