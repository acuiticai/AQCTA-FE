import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { FiUsers } from "react-icons/fi";
import { notifyError } from "@/utils/toast";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const emptySystemConfig = () => ({
  notifyAllSystemUsers: false,
  userRoles: [],
});

export { emptySystemConfig };

export default function MarketingSystemRecipientsPicker({
  businessId,
  value,
  onChange,
  authHeaders,
  disabled = false,
}) {
  const config = value || emptySystemConfig();
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [roleSearch, setRoleSearch] = useState("");
  const [previewCount, setPreviewCount] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (!businessId || !authHeaders?.authorization) {
      setRoles([]);
      setUsers([]);
      return;
    }

    const payload = {
      FilterStatus: "",
      FilterName: "",
      page: 1,
      limit: 99999,
      businessId: String(businessId),
    };

    setLoading(true);
    Promise.all([
      axios.post(`${Base_URL}/UserRoles/get_all`, payload, { headers: authHeaders }),
      axios.post(`${Base_URL}/SystemUsers/get_all`, payload, { headers: authHeaders }),
    ])
      .then(([rolesRes, usersRes]) => {
        setRoles(rolesRes.data?.data || []);
        setUsers(usersRes.data?.data || []);
      })
      .catch(() => {
        setRoles([]);
        setUsers([]);
        notifyError("Could not load roles");
      })
      .finally(() => setLoading(false));
  }, [businessId, authHeaders?.authorization]);

  const setConfig = (patch) => {
    onChange({ ...config, ...patch });
    setPreviewCount(null);
  };

  const toggleRole = (roleId) => {
    const id = String(roleId);
    const next = config.userRoles.map(String).includes(id)
      ? config.userRoles.filter((r) => String(r) !== id)
      : [...config.userRoles, roleId];
    setConfig({ userRoles: next, notifyAllSystemUsers: false });
  };

  const hasSelection =
    config.notifyAllSystemUsers ||
    (config.userRoles && config.userRoles.length > 0);

  const roleSearchLower = roleSearch.trim().toLowerCase();

  const filteredRoles = useMemo(() => {
    return roles.filter((role) => {
      const roleUsers = users.filter(
        (u) => u.role && String(u.role._id) === String(role._id),
      );
      if (!roleSearchLower) return true;
      const roleMatch = role.name?.toLowerCase().includes(roleSearchLower);
      const userMatch = roleUsers.some(
        (u) =>
          u.name?.toLowerCase().includes(roleSearchLower) ||
          u.email?.toLowerCase().includes(roleSearchLower),
      );
      return roleMatch || userMatch;
    });
  }, [roles, users, roleSearchLower]);

  const handlePreview = async () => {
    if (!businessId || !hasSelection) return;
    try {
      setPreviewLoading(true);
      const res = await axios.post(
        `${Base_URL}/broadcasts/recipients/resolve-system`,
        {
          business_id: businessId,
          notifyAllSystemUsers: config.notifyAllSystemUsers,
          userRoles: config.userRoles,
        },
        { headers: authHeaders },
      );
      setPreviewCount(res.data?.count ?? 0);
    } catch (err) {
      notifyError(err.response?.data?.error || "Could not preview recipients");
      setPreviewCount(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  if (!businessId) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-600">
        Select a business to add recipients by user role.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-indigo-100 bg-gradient-to-b from-indigo-50/30 to-white overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-indigo-100 bg-white/80">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
            <FiUsers size={18} />
          </span>
          <div>
            <p className="text-sm font-semibold text-gray-900">User roles</p>
            <p className="text-xs text-gray-500">
              All active users with the selected role(s) receive the announcement
            </p>
          </div>
        </div>
        {hasSelection && (
          <button
            type="button"
            disabled={disabled || previewLoading}
            onClick={handlePreview}
            className="text-xs font-medium text-indigo-700 hover:underline disabled:opacity-50"
          >
            {previewLoading
              ? "Counting…"
              : previewCount != null
                ? `${previewCount} system user(s)`
                : "Preview count"}
          </button>
        )}
      </div>

      <div className="px-4 py-3">
        <label className="flex items-center gap-3 p-3 mb-3 rounded-lg border border-indigo-200 bg-indigo-50/60 cursor-pointer">
          <input
            type="checkbox"
            disabled={disabled}
            checked={Boolean(config.notifyAllSystemUsers)}
            onChange={(e) =>
              setConfig({
                notifyAllSystemUsers: e.target.checked,
                userRoles: e.target.checked ? [] : config.userRoles,
              })
            }
            className="h-4 w-4 text-indigo-600 rounded"
          />
          <span className="text-sm font-medium text-gray-800">
            All active system users in this business
          </span>
        </label>

        {!config.notifyAllSystemUsers && (
          <>
            {loading ? (
              <p className="text-sm text-gray-500 py-2">Loading roles…</p>
            ) : filteredRoles.length === 0 ? (
              <p className="text-sm text-gray-500 py-2">No roles found for this business.</p>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  value={roleSearch}
                  onChange={(e) => setRoleSearch(e.target.value)}
                  placeholder="Search roles…"
                  className="w-full mb-2 px-3 py-2 text-sm border border-gray-200 rounded-lg"
                  disabled={disabled}
                />
                {filteredRoles.map((role) => {
                  const roleUsers = users.filter(
                    (u) => u.role && String(u.role._id) === String(role._id),
                  );
                  const selected = config.userRoles
                    .map(String)
                    .includes(String(role._id));
                  return (
                    <div
                      key={role._id}
                      className={`rounded-lg border bg-white ${
                        selected ? "border-indigo-300 ring-1 ring-indigo-100" : "border-gray-200"
                      }`}
                    >
                      <label className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-indigo-50/50">
                        <input
                          type="checkbox"
                          disabled={disabled}
                          checked={selected}
                          onChange={() => toggleRole(role._id)}
                          className="h-4 w-4 text-indigo-600 rounded"
                        />
                        <span className="text-sm font-medium text-gray-800 flex-1">
                          {role.name}
                          <span className="text-gray-400 font-normal ml-1">
                            ({roleUsers.length})
                          </span>
                        </span>
                      </label>
                      {selected && roleUsers.length > 0 && (
                        <ul className="px-3 pb-2 text-xs text-gray-500 border-t border-gray-100 pt-1">
                          {roleUsers.slice(0, 8).map((u) => (
                            <li key={u._id}>
                              {u.name || u.email}
                              {u.contact ? ` · ${u.contact}` : ""}
                            </li>
                          ))}
                          {roleUsers.length > 8 && (
                            <li>+{roleUsers.length - 8} more</li>
                          )}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
