import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  X,
  Plus,
  Trash2,
  Save,
  Star,
  Loader2,
  Search,
  Utensils,
  Layers,
  CheckSquare,
  Square,
} from "lucide-react";
import KitchenServices from "@/services/KitchenServices";
import { notifyError, notifySuccess } from "@/utils/toast";
import Swal from "sweetalert2";
import {
  KITCHEN_SECTION_ICON_OPTIONS,
  getKitchenSectionIconOption,
  resolveKitchenSectionIconValue,
  resolveKitchenSectionIconValueWithFallback,
} from "@/pages/Kitchen/constants/sectionIcons";

const LS_KEY_KITCHEN_SECTION_ICON_MAP = "kitchen.sectionIconMap";

const readKitchenSectionIconMap = () => {
  try {
    const raw = localStorage.getItem(LS_KEY_KITCHEN_SECTION_ICON_MAP);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
};

const writeKitchenSectionIconMap = (nextMap) => {
  try {
    localStorage.setItem(
      LS_KEY_KITCHEN_SECTION_ICON_MAP,
      JSON.stringify(nextMap || {}),
    );
  } catch {
    // ignore quota/security errors
  }
};

const DEFAULT_COLORS = [
  "#6366f1",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#a855f7",
  "#f43f5e",
  "#14b8a6",
];

const KitchenIconPicker = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const selected = useMemo(
    () => getKitchenSectionIconOption(value || "utensils"),
    [value],
  );
  const SelectedIcon = selected.icon;

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="h-8 w-9 rounded-lg border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors inline-flex items-center justify-center"
        title={selected.label}
        aria-label={`Selected icon ${selected.label}`}
      >
        <SelectedIcon size={13} />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-[196px] rounded-lg border border-gray-200 bg-white shadow-lg p-2">
          <div className="grid grid-cols-6 gap-1.5">
            {KITCHEN_SECTION_ICON_OPTIONS.map((option) => {
              const Icon = option.icon;
              const active = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  title={option.label}
                  aria-label={option.label}
                  className={`h-7 w-7 rounded-md border inline-flex items-center justify-center transition-colors ${
                    active
                      ? "bg-[var(--p-blue)]/10 border-[var(--p-blue)]/50 text-[var(--p-blue)]"
                      : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300"
                  }`}
                >
                  <Icon size={12} />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const SectionRow = ({
  section,
  itemCount = 0,
  onSave,
  onDelete,
  onSetDefault,
  canUpdate = true,
  canDelete = true,
}) => {
  const [local, setLocal] = useState({
    name: section.name || "",
    code: section.code || "",
    color: section.color || "#6366f1",
    icon: resolveKitchenSectionIconValue(section),
  });
  const [saving, setSaving] = useState(false);

  const isDirty =
    local.name !== section.name ||
    local.code !== section.code ||
    local.color !== section.color ||
    local.icon !== resolveKitchenSectionIconValue(section);

  const handleSave = async () => {
    if (!local.name.trim()) {
      notifyError("Section name is required");
      return;
    }
    setSaving(true);
    try {
      await onSave(section._id, local);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center gap-2 flex-1 min-w-[200px]">
        <KitchenIconPicker
          value={local.icon}
          onChange={(icon) => setLocal((p) => ({ ...p, icon }))}
        />
        <input
          type="color"
          value={local.color}
          onChange={(e) => setLocal((p) => ({ ...p, color: e.target.value }))}
          disabled={!canUpdate}
          className="h-8 w-8 rounded cursor-pointer border border-gray-200 disabled:opacity-60"
          title="Section color"
        />
        <input
          type="text"
          value={local.name}
          onChange={(e) => setLocal((p) => ({ ...p, name: e.target.value }))}
          disabled={!canUpdate}
          placeholder="Section name"
          className="flex-1 h-8 px-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-[var(--p-blue)] focus:ring-1 focus:ring-[var(--p-blue)]/20 disabled:opacity-60"
        />
        <input
          type="text"
          value={local.code}
          onChange={(e) => setLocal((p) => ({ ...p, code: e.target.value }))}
          disabled={!canUpdate}
          placeholder="Code"
          className="w-20 h-8 px-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-[var(--p-blue)] focus:ring-1 focus:ring-[var(--p-blue)]/20 disabled:opacity-60"
        />
      </div>

      <div className="flex items-center gap-1">
        <span
          className={`inline-flex items-center gap-1 h-8 px-2.5 text-[11px] font-semibold rounded-lg border transition-colors ${
            itemCount > 0
              ? "bg-indigo-50 text-indigo-700 border-indigo-200"
              : "bg-gray-50 text-gray-400 border-gray-200"
          }`}
          title={`${itemCount} item${itemCount === 1 ? "" : "s"} routed to this section`}
        >
          <Utensils size={11} />
          {itemCount} {itemCount === 1 ? "item" : "items"}
        </span>

        {canUpdate && (
        <button
          type="button"
          onClick={() => onSetDefault(section)}
          className={`
            inline-flex items-center gap-1 h-8 px-2.5 text-[11px] font-semibold rounded-lg border transition-colors
            ${
              section.isDefault
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-white text-gray-500 border-gray-200 hover:text-amber-600 hover:border-amber-300"
            }
          `}
          title="Set as default section"
        >
          <Star
            size={11}
            className={section.isDefault ? "fill-amber-500" : ""}
          />
          {section.isDefault ? "Default" : "Set default"}
        </button>
        )}

        {canUpdate && (
        <button
          type="button"
          onClick={handleSave}
          disabled={!isDirty || saving}
          className="inline-flex items-center gap-1 h-8 px-2.5 text-[11px] font-semibold text-white bg-[var(--p-blue)] rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
        >
          {saving ? (
            <Loader2 size={11} className="animate-spin" />
          ) : (
            <Save size={11} />
          )}
          Save
        </button>
        )}

        {!section.isDefault && canDelete && (
          <button
            type="button"
            onClick={() => onDelete(section)}
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-colors"
            title="Remove section"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  );
};

const ItemRoutingPanel = ({
  businessId,
  headers,
  sections,
  items,
  setItems,
  loading,
  canUpdate = true,
}) => {
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkSection, setBulkSection] = useState("");
  const [applying, setApplying] = useState(false);
  const [savingItemId, setSavingItemId] = useState(null);

  const sectionMap = useMemo(
    () => new Map(sections.map((s) => [String(s._id), s])),
    [sections],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        (it.name || "").toLowerCase().includes(q) ||
        (it.category?.name || "").toLowerCase().includes(q),
    );
  }, [items, query]);

  const allVisibleSelected =
    filtered.length > 0 && filtered.every((i) => selectedIds.has(i._id));

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        filtered.forEach((i) => next.delete(i._id));
      } else {
        filtered.forEach((i) => next.add(i._id));
      }
      return next;
    });
  };

  const handleInlineAssign = async (item, sectionId) => {
    if (!canUpdate) {
      notifyError("You do not have permission to update kitchen routing.");
      return;
    }
    setSavingItemId(item._id);
    try {
      const res = await KitchenServices.updateItemSection(
        item._id,
        sectionId || null,
        headers,
      );
      if (res.data?.success) {
        setItems((prev) =>
          prev.map((i) =>
            i._id === item._id
              ? { ...i, kitchenSection: sectionId || null }
              : i,
          ),
        );
      }
    } catch (err) {
      notifyError(err?.response?.data?.message || "Failed to update");
    } finally {
      setSavingItemId(null);
    }
  };

  const handleBulkApply = async () => {
    if (!canUpdate) {
      notifyError("You do not have permission to update kitchen routing.");
      return;
    }
    if (selectedIds.size === 0) {
      notifyError("Select at least one item");
      return;
    }
    setApplying(true);
    try {
      const res = await KitchenServices.bulkUpdateItemSection(
        Array.from(selectedIds),
        bulkSection || null,
        headers,
      );
      if (res.data?.success) {
        const n = res.data.data?.modified || 0;
        notifySuccess(
          `Updated ${n} item${n === 1 ? "" : "s"}${
            bulkSection
              ? ` → ${sectionMap.get(bulkSection)?.name || "section"}`
              : " (unassigned)"
          }`,
        );
        setItems((prev) =>
          prev.map((i) =>
            selectedIds.has(i._id)
              ? { ...i, kitchenSection: bulkSection || null }
              : i,
          ),
        );
        setSelectedIds(new Set());
      }
    } catch (err) {
      notifyError(err?.response?.data?.message || "Bulk update failed");
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Bulk bar */}
      <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search size={14} className="text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search item or category…"
            className="flex-1 h-8 px-2 text-sm bg-white border border-white rounded-lg focus:outline-none focus:border-[var(--p-blue)] focus:ring-2 focus:ring-[var(--p-blue)]/20"
          />
        </div>
        <select
          value={bulkSection}
          onChange={(e) => setBulkSection(e.target.value)}
          className="h-8 px-2 text-xs font-semibold bg-white border border-white rounded-lg focus:outline-none focus:border-[var(--p-blue)]"
        >
          <option value="">Unassigned (default)</option>
          {sections.map((s) => (
            <option key={s._id} value={s._id}>
              {s.name}
            </option>
          ))}
        </select>
        {canUpdate && (
        <button
          type="button"
          onClick={handleBulkApply}
          disabled={applying || selectedIds.size === 0}
          className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-semibold text-white bg-[var(--p-blue)] rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {applying ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Layers size={12} />
          )}
          Apply to {selectedIds.size || "0"}
        </button>
        )}
      </div>

      {/* Items table */}
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100 text-[10px] font-bold uppercase tracking-wider text-gray-500">
          <button
            type="button"
            onClick={toggleSelectAllVisible}
            className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-800"
          >
            {allVisibleSelected ? (
              <CheckSquare size={13} className="text-[var(--p-blue)]" />
            ) : (
              <Square size={13} />
            )}
            <span>Item</span>
          </button>
          <span className="ml-auto">Section</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="animate-spin text-gray-400" size={18} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-400">
            {items.length === 0
              ? "No items found for this business"
              : "No items match your search"}
          </div>
        ) : (
          <div className="max-h-[360px] overflow-y-auto divide-y divide-gray-100">
            {filtered.map((it) => {
              const selected = selectedIds.has(it._id);
              const section = it.kitchenSection
                ? sectionMap.get(String(it.kitchenSection))
                : null;
              return (
                <div
                  key={it._id}
                  className={`flex items-center gap-2 px-3 py-2 transition-colors ${
                    selected ? "bg-indigo-50/50" : "hover:bg-gray-50"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleSelect(it._id)}
                    className="text-gray-400 hover:text-[var(--p-blue)]"
                  >
                    {selected ? (
                      <CheckSquare size={13} className="text-[var(--p-blue)]" />
                    ) : (
                      <Square size={13} />
                    )}
                  </button>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Utensils size={11} className="text-gray-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-gray-800 truncate">
                        {it.name}
                      </div>
                      {it.category?.name && (
                        <div className="text-[10px] text-gray-400 truncate">
                          {it.category.name}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {section && (
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: section.color || "#6366f1" }}
                      />
                    )}
                    <select
                      value={it.kitchenSection ? String(it.kitchenSection) : ""}
                      onChange={(e) => handleInlineAssign(it, e.target.value)}
                      disabled={!canUpdate || savingItemId === it._id}
                      className="h-7 px-2 text-[11px] font-semibold bg-white border border-gray-200 rounded-md focus:outline-none focus:border-[var(--p-blue)] disabled:opacity-50"
                    >
                      <option value="">Unassigned</option>
                      {sections.map((s) => (
                        <option key={s._id} value={s._id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-[10.5px] text-gray-500 leading-relaxed px-1">
        Items without a section will be routed to the{" "}
        <span className="font-semibold text-gray-700">default section</span>.
        Changes apply to every future order — existing open tickets keep their
        original routing.
      </p>
    </div>
  );
};

// Reusable panel (sections + item routing). Works standalone (embedded in
// POS Settings) or inside the modal wrapper below.
export const KitchenSectionsPanel = ({
  businessId,
  headers,
  autoLoad = true,
  canAdd = true,
  canUpdate = true,
  canDelete = true,
}) => {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#6366f1");
  const [newIcon, setNewIcon] = useState("utensils");
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState("sections");

  const fetchSections = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const res = await KitchenServices.getSections(
        { business: businessId },
        headers,
      );
      if (res.data?.success) {
        const apiSections = res.data.data || [];
        // If the backend doesn't persist the icon field yet, merge cached
        // icons so they don't disappear on refresh.
        const iconMap = readKitchenSectionIconMap();
        const merged = apiSections.map((s) => {
          const id = String(s?._id || "");
          if (!id) return s;
          const cached = iconMap[id];
          if (!cached) return s;
          return {
            ...s,
            icon: resolveKitchenSectionIconValueWithFallback(s, cached),
            sectionIcon: cached,
            iconKey: cached,
          };
        });
        setSections(merged);
      }
    } catch (err) {
      notifyError(err?.response?.data?.message || "Failed to load sections");
    } finally {
      setLoading(false);
    }
  }, [businessId, headers]);

  const fetchItems = useCallback(async () => {
    if (!businessId) return;
    setItemsLoading(true);
    try {
      const res = await KitchenServices.getRoutingItems(
        { business: businessId },
        headers,
      );
      if (res.data?.success) setItems(res.data.data || []);
    } catch (err) {
      notifyError(err?.response?.data?.message || "Failed to load items");
    } finally {
      setItemsLoading(false);
    }
  }, [businessId, headers]);

  useEffect(() => {
    if (autoLoad) {
      fetchSections();
      fetchItems();
    }
  }, [autoLoad, fetchSections, fetchItems]);

  // Per-section item count (live, updates when items are reassigned).
  // Also counts unassigned items under the default section so the count
  // reflects the actual routing behavior at order time.
  const itemCountsBySection = useMemo(() => {
    const counts = new Map();
    const defaultSection = sections.find((s) => s.isDefault);
    const defaultId = defaultSection ? String(defaultSection._id) : null;
    for (const it of items) {
      const raw = it?.kitchenSection;
      const id = raw ? String(raw) : defaultId;
      if (!id) continue;
      counts.set(id, (counts.get(id) || 0) + 1);
    }
    return counts;
  }, [items, sections]);

  const handleSave = async (id, data) => {
    if (!canUpdate) {
      notifyError("You do not have permission to update kitchen sections.");
      return;
    }
    try {
      const payload = {
        ...data,
        icon: data.icon,
        sectionIcon: data.icon,
        iconKey: data.icon,
      };
      const res = await KitchenServices.updateSection(id, payload, headers);
      if (res.data?.success) {
        // Update cache immediately so icons survive a refresh even if
        // backend response omits icon fields.
        const iconMap = readKitchenSectionIconMap();
        iconMap[String(id)] = data.icon;
        writeKitchenSectionIconMap(iconMap);

        setSections((prev) =>
          prev.map((s) => {
            if (s._id !== id) return s;
            const nextSection = res.data.data || {};
            return {
              ...s,
              ...nextSection,
              // Some APIs may not return the icon field in the response.
              // Use the user-selected `data.icon` as fallback.
              icon:
                resolveKitchenSectionIconValueWithFallback(nextSection, data.icon) ||
                data.icon,
            };
          }),
        );
      }
    } catch (err) {
      notifyError(err?.response?.data?.message || "Failed to update section");
    }
  };

  const handleSetDefault = async (section) => {
    if (!canUpdate) {
      notifyError("You do not have permission to update kitchen sections.");
      return;
    }
    try {
      const res = await KitchenServices.updateSection(
        section._id,
        { isDefault: true },
        headers,
      );
      if (res.data?.success) {
        await fetchSections();
      }
    } catch (err) {
      notifyError(err?.response?.data?.message || "Failed to set default");
    }
  };

  const handleDelete = async (section) => {
    if (!canDelete) {
      notifyError("You do not have permission to delete kitchen sections.");
      return;
    }
    const result = await Swal.fire({
      icon: "warning",
      title: "Remove section?",
      text: `"${section.name}" will be hidden from the kitchen board.`,
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      confirmButtonText: "Remove",
    });
    if (!result.isConfirmed) return;
    try {
      await KitchenServices.deleteSection(section._id, headers);
      setSections((prev) => prev.filter((s) => s._id !== section._id));
      const iconMap = readKitchenSectionIconMap();
      delete iconMap[String(section._id)];
      writeKitchenSectionIconMap(iconMap);
    } catch (err) {
      notifyError(err?.response?.data?.message || "Failed to remove section");
    }
  };

  const handleCreate = async () => {
    if (!canAdd) {
      notifyError("You do not have permission to add kitchen sections.");
      return;
    }
    if (!newName.trim()) {
      notifyError("Enter a section name");
      return;
    }
    setCreating(true);
    try {
      const res = await KitchenServices.createSection(
        {
          business: businessId,
          name: newName.trim(),
          color: newColor,
          icon: newIcon,
          sectionIcon: newIcon,
          iconKey: newIcon,
          isDefault: sections.length === 0,
        },
        headers,
      );
      if (res.data?.success) {
        const created = res.data.data || {};
        const createdId = created?._id;
        if (created?._id) {
          const iconMap = readKitchenSectionIconMap();
          iconMap[String(created._id)] = newIcon;
          writeKitchenSectionIconMap(iconMap);
        }
        setSections((prev) => [
          ...prev,
          {
            ...created,
            icon: newIcon,
            sectionIcon: newIcon,
            iconKey: newIcon,
          },
        ]);
        setNewName("");
        setNewIcon("utensils");
      }
    } catch (err) {
      notifyError(err?.response?.data?.message || "Failed to create section");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-100">
        <button
          type="button"
          onClick={() => setTab("sections")}
          className={`px-3 h-8 text-[11px] font-bold uppercase tracking-wider rounded-t-lg border-b-2 transition-all ${
            tab === "sections"
              ? "text-[var(--p-blue)] border-[var(--p-blue)]"
              : "text-gray-500 border-transparent hover:text-gray-700"
          }`}
        >
          Sections
        </button>
        <button
          type="button"
          onClick={() => setTab("routing")}
          className={`px-3 h-8 text-[11px] font-bold uppercase tracking-wider rounded-t-lg border-b-2 transition-all ${
            tab === "routing"
              ? "text-[var(--p-blue)] border-[var(--p-blue)]"
              : "text-gray-500 border-transparent hover:text-gray-700"
          }`}
        >
          Item Routing
        </button>
      </div>

      {tab === "routing" ? (
        <ItemRoutingPanel
          businessId={businessId}
          headers={headers}
          sections={sections}
          items={items}
          setItems={setItems}
          loading={itemsLoading}
          canUpdate={canUpdate}
        />
      ) : (
        <>
          {canAdd && (
          <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <KitchenIconPicker value={newIcon} onChange={setNewIcon} />
              <input
                type="color"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="h-8 w-8 rounded cursor-pointer border border-white"
              />
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !creating) handleCreate();
                }}
                placeholder="New section name (e.g. Drinks)"
                className="flex-1 h-8 px-3 text-sm bg-white border border-white rounded-lg focus:outline-none focus:border-[var(--p-blue)] focus:ring-2 focus:ring-[var(--p-blue)]/20"
              />
              <div className="hidden sm:flex gap-1">
                {DEFAULT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewColor(c)}
                    title={c}
                    className="h-6 w-6 rounded-full border-2 border-white hover:scale-110 transition-transform"
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-semibold text-white bg-[var(--p-blue)] rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {creating ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Plus size={12} />
              )}
              Add Section
            </button>
          </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin text-gray-400" size={20} />
            </div>
          ) : sections.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">
              No sections yet. Create your first section above.
            </p>
          ) : (
            <div className="space-y-2">
              {sections.map((s) => (
                <SectionRow
                  key={s._id}
                  section={s}
                  itemCount={itemCountsBySection.get(String(s._id)) || 0}
                  onSave={handleSave}
                  onSetDefault={handleSetDefault}
                  onDelete={handleDelete}
                  canUpdate={canUpdate}
                  canDelete={canDelete}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

const KitchenSectionsManager = ({ isOpen, onClose, businessId, headers }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-2xl mx-4 max-h-[88vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-bold text-gray-900">
              Kitchen Sections
            </h3>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Organize stations and route items to the right section
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <KitchenSectionsPanel businessId={businessId} headers={headers} />
        </div>
      </div>
    </div>
  );
};

export default KitchenSectionsManager;
