import React, { useEffect, useMemo, useState } from "react";
import { FiDownload, FiPlus, FiTrash2 } from "react-icons/fi";
import { CustomModal, FormInput } from "@/page-layouts";
import BroadcastImportModal from "@/components/Broadcasts/BroadcastImportModal";
import BroadcastServices from "@/services/BroadcastServices";
import { notifyError, notifySuccess } from "@/utils/toast";
import { emptyListForm, filterMembersBySearch } from "@/utils/broadcastRecipientLists";
import {
  getSoleAssignedBusinessId,
  isSingleAssignedBusiness,
} from "@/utils/sessionAssignedBusinesses";

const emptyMember = () => ({ name: "", email: "", whatsappNumber: "" });

export default function BroadcastRecipientListModal({
  open,
  onClose,
  listId = null,
  businesses = [],
  defaultBusinessId = "",
  authHeaders,
  adminToken,
  checkTokenExpired,
  onSaved,
  readOnly = false,
}) {
  const isEdit = Boolean(listId);
  const [form, setForm] = useState(() => emptyListForm(defaultBusinessId));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const hideBusinessField = isSingleAssignedBusiness() || businesses.length === 1;
  const soleBusinessId =
    defaultBusinessId ||
    (businesses.length === 1 ? businesses[0]._id : "") ||
    getSoleAssignedBusinessId() ||
    "";

  useEffect(() => {
    if (!open) {
      setForm(emptyListForm(soleBusinessId));
      setMemberSearch("");
      setLoading(false);
      return;
    }

    if (!isEdit) {
      setForm(emptyListForm(soleBusinessId));
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await BroadcastServices.getRecipientList(listId, {}, authHeaders);
        if (checkTokenExpired?.(res)) return;
        if (cancelled) return;
        const data = res.data?.data;
        if (!data) {
          notifyError("Could not load list");
          onClose?.();
          return;
        }
        setForm({
          business_id: data.business_id?._id || data.business_id || defaultBusinessId,
          name: data.name || "",
          description: data.description || "",
          members: (data.members || []).map((m) => ({
            name: m.name || "",
            email: m.email || "",
            whatsappNumber: m.whatsappNumber || "",
          })),
        });
      } catch (error) {
        if (!cancelled) {
          notifyError(error.response?.data?.error || "Failed to load list");
          onClose?.();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, listId, isEdit, defaultBusinessId, authHeaders, checkTokenExpired, onClose]);

  const filteredMembers = useMemo(
    () => filterMembersBySearch(form.members, memberSearch),
    [form.members, memberSearch],
  );

  const updateMember = (index, field, value) => {
    setForm((p) => {
      const members = [...(p.members || [])];
      members[index] = { ...members[index], [field]: value };
      return { ...p, members };
    });
  };

  const removeMember = (index) => {
    setForm((p) => ({
      ...p,
      members: (p.members || []).filter((_, i) => i !== index),
    }));
  };

  const addMember = () => {
    setForm((p) => ({
      ...p,
      members: [...(p.members || []), emptyMember()],
    }));
  };

  const handleImportParsed = (parsed) => {
    if (!parsed?.length) return;
    setForm((p) => {
      const existing = p.members || [];
      const keys = new Set(
        existing.map((m) =>
          [m.email, m.whatsappNumber].filter(Boolean).join("|").toLowerCase(),
        ),
      );
      const toAdd = parsed.filter((row) => {
        const key = [row.email, row.whatsappNumber]
          .filter(Boolean)
          .join("|")
          .toLowerCase();
        if (!key || keys.has(key)) return false;
        keys.add(key);
        return true;
      });
      return { ...p, members: [...existing, ...toAdd] };
    });
    notifySuccess(`Added ${parsed.length} member(s) from file`);
  };

  const handleImportAppendDone = async (_null, result) => {
    if (!listId || !result) return;
    try {
      const res = await BroadcastServices.getRecipientList(listId, {}, authHeaders);
      if (checkTokenExpired?.(res)) return;
      const data = res.data?.data;
      if (!data) return;
      setForm((p) => ({
        ...p,
        members: (data.members || []).map((m) => ({
          name: m.name || "",
          email: m.email || "",
          whatsappNumber: m.whatsappNumber || "",
        })),
      }));
      onSaved?.();
    } catch (error) {
      notifyError(error.response?.data?.error || "Failed to refresh list");
    }
  };

  const handleExport = async () => {
    if (!listId) {
      notifyError("Save the list first before exporting");
      return;
    }
    try {
      const res = await BroadcastServices.exportRecipientList(listId, authHeaders);
      if (checkTokenExpired?.(res)) return;
      const safeName = (form.name || "list")
        .trim()
        .replace(/[^a-z0-9_-]+/gi, "_")
        .slice(0, 60);
      const blob = new Blob([res.data], {
        type:
          res.headers["content-type"] ||
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const urlObj = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = urlObj;
      a.download = `${safeName || "list"}_members.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(urlObj);
      notifySuccess("List exported");
    } catch (error) {
      notifyError(error.response?.data?.error || "Export failed");
    }
  };

  const handleSave = async () => {
    if (!form.name?.trim()) {
      notifyError("List name is required");
      return;
    }
    const businessId = form.business_id || soleBusinessId;
    if (!businessId) {
      notifyError("Business is required");
      return;
    }

    const members = (form.members || []).filter(
      (m) => m.name?.trim() || m.email?.trim() || m.whatsappNumber?.trim(),
    );

    const payload = {
      business_id: businessId,
      name: form.name.trim(),
      description: form.description?.trim() || "",
      members: members.map((m) => ({
        name: m.name?.trim() || "",
        email: m.email?.trim() || "",
        whatsappNumber: m.whatsappNumber?.trim() || "",
      })),
    };

    try {
      setSaving(true);
      const res = isEdit
        ? await BroadcastServices.updateRecipientList(listId, payload, authHeaders)
        : await BroadcastServices.createRecipientList(payload, authHeaders);
      if (checkTokenExpired?.(res)) return;
      notifySuccess(isEdit ? "List updated" : "List created");
      onClose?.();
      onSaved?.(res.data?.data);
    } catch (error) {
      notifyError(error.response?.data?.error || "Failed to save list");
    } finally {
      setSaving(false);
    }
  };

  const viewOnly = readOnly;

  return (
    <>
      <CustomModal
        open={open}
        onClose={onClose}
        title={
          viewOnly
            ? form.name || "Recipient list"
            : isEdit
              ? `Edit — ${form.name || "List"}`
              : "New recipient list"
        }
        width="920px"
        showActions={!viewOnly}
        actions={
          viewOnly
            ? [{ label: "Close", primary: true, onClick: onClose }]
            : [
                { label: "Cancel", secondary: true, onClick: onClose },
                {
                  label: saving ? "Saving…" : isEdit ? "Save changes" : "Create list",
                  primary: true,
                  onClick: handleSave,
                  disabled: saving || loading,
                },
              ]
        }
      >
        {loading ? (
          <p className="text-sm text-gray-500 py-8 text-center">Loading…</p>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {!isEdit && !viewOnly && !hideBusinessField ? (
                <div className="md:col-span-2">
                  <label className="block text-sm text-gray-600 mb-1">Business *</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.business_id}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, business_id: e.target.value }))
                    }
                  >
                    <option value="">Select business</option>
                    {businesses.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <FormInput
                direction="column"
                label="List name *"
                placeholder='e.g. "Active drivers"'
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                disabled={viewOnly}
              />
              <div className="md:col-span-2">
                <label className="block text-sm text-gray-600 mb-1">Description</label>
                <textarea
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[60px]"
                  value={form.description}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, description: e.target.value }))
                  }
                  placeholder="Optional note about who belongs on this list"
                  disabled={viewOnly}
                />
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50/80 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    Members ({form.members?.length ?? 0})
                  </p>
                  <p className="text-xs text-gray-500">Name plus email or WhatsApp number</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!viewOnly ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setImportOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 rounded-lg bg-white hover:bg-gray-50"
                      >
                        Import
                      </button>
                      <button
                        type="button"
                        onClick={addMember}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-[var(--p-blue)] text-[var(--p-blue)] rounded-lg bg-white hover:bg-blue-50"
                      >
                        <FiPlus size={14} /> Add row
                      </button>
                    </>
                  ) : null}
                  {(isEdit || viewOnly) && (form.members?.length ?? 0) > 0 ? (
                    <button
                      type="button"
                      onClick={handleExport}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 rounded-lg bg-white hover:bg-gray-50"
                    >
                      <FiDownload size={14} /> Export
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="p-4 space-y-3">
                <input
                  type="search"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="Search members by name, email, or phone…"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                />

                {filteredMembers.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-6">
                    {form.members?.length
                      ? "No members match your search"
                      : "No members yet — import a file or add rows"}
                  </p>
                ) : (
                  <div className="max-h-64 overflow-y-auto border border-gray-100 rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="text-left py-2 px-3 font-medium text-gray-600">
                            Name
                          </th>
                          <th className="text-left py-2 px-3 font-medium text-gray-600">
                            WhatsApp
                          </th>
                          <th className="text-left py-2 px-3 font-medium text-gray-600">
                            Email
                          </th>
                          {!viewOnly ? (
                            <th className="w-10 py-2 px-2" aria-label="Actions" />
                          ) : null}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredMembers.map((member) => {
                          const index = form.members.indexOf(member);
                          if (viewOnly) {
                            return (
                              <tr key={`${member.email}-${member.whatsappNumber}-${index}`} className="border-t border-gray-100">
                                <td className="py-2 px-3">{member.name || "—"}</td>
                                <td className="py-2 px-3">{member.whatsappNumber || "—"}</td>
                                <td className="py-2 px-3">{member.email || "—"}</td>
                              </tr>
                            );
                          }
                          return (
                            <tr key={index} className="border-t border-gray-100">
                              <td className="py-1 px-2">
                                <input
                                  className="w-full border border-gray-200 rounded px-2 py-1 text-sm"
                                  value={member.name}
                                  onChange={(e) =>
                                    updateMember(index, "name", e.target.value)
                                  }
                                  placeholder="Name"
                                />
                              </td>
                              <td className="py-1 px-2">
                                <input
                                  className="w-full border border-gray-200 rounded px-2 py-1 text-sm"
                                  value={member.whatsappNumber}
                                  onChange={(e) =>
                                    updateMember(index, "whatsappNumber", e.target.value)
                                  }
                                  placeholder="+60123456789"
                                />
                              </td>
                              <td className="py-1 px-2">
                                <input
                                  className="w-full border border-gray-200 rounded px-2 py-1 text-sm"
                                  value={member.email}
                                  onChange={(e) =>
                                    updateMember(index, "email", e.target.value)
                                  }
                                  placeholder="email@example.com"
                                />
                              </td>
                              <td className="py-1 px-2">
                                <button
                                  type="button"
                                  onClick={() => removeMember(index)}
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                  title="Remove"
                                >
                                  <FiTrash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </CustomModal>

      <BroadcastImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        mode={listId ? "list-append" : "parse"}
        listId={listId || undefined}
        onRecipientsParsed={(parsed, appendResult) => {
          if (parsed?.length) {
            handleImportParsed(parsed);
            return;
          }
          if (appendResult) {
            handleImportAppendDone(null, appendResult);
          }
        }}
        adminToken={adminToken}
      />
    </>
  );
}
