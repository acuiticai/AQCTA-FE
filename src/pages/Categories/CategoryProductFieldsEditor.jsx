import React, { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Eye, X } from "lucide-react";

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "textarea", label: "Textarea" },
  { value: "select", label: "Select" },
];

const emptyDraft = () => ({
  key: "",
  label: "",
  type: "text",
  required: false,
  allowMultiple: false,
  optionsText: "",
  placeholder: "",
});

const makeKey = () =>
  `pf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

/**
 * Admin editor: add / edit / view / delete product application fields
 * that appear on the customer Product Details step for this category.
 */
export default function CategoryProductFieldsEditor({
  fields = [],
  onChange,
  disabled = false,
}) {
  const [draft, setDraft] = useState(null);
  const [editIndex, setEditIndex] = useState(null);
  const [viewIndex, setViewIndex] = useState(null);
  const [formError, setFormError] = useState("");

  const sorted = useMemo(
    () =>
      [...(fields || [])].sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0),
      ),
    [fields],
  );

  const viewing = viewIndex != null ? sorted[viewIndex] : null;

  const openAdd = () => {
    setEditIndex(null);
    setViewIndex(null);
    setFormError("");
    setDraft(emptyDraft());
  };

  const openEdit = (index) => {
    const field = sorted[index];
    if (!field) return;
    setViewIndex(null);
    setEditIndex(index);
    setFormError("");
    setDraft({
      key: field.key || "",
      label: field.label || "",
      type: field.type || "text",
      required: Boolean(field.required),
      allowMultiple: Boolean(field.allowMultiple),
      optionsText: Array.isArray(field.options)
        ? field.options.join(", ")
        : "",
      placeholder: field.placeholder || "",
    });
  };

  const closeForm = () => {
    setDraft(null);
    setEditIndex(null);
    setFormError("");
  };

  const saveDraft = () => {
    const label = String(draft?.label || "").trim();
    if (!label) {
      setFormError("Field label is required.");
      return;
    }

    const type = draft.type || "text";
    const options =
      type === "select"
        ? String(draft.optionsText || "")
            .split(",")
            .map((o) => o.trim())
            .filter(Boolean)
        : undefined;

    if (type === "select" && (!options || options.length === 0)) {
      setFormError("Select fields need at least one option (comma-separated).");
      return;
    }

    const nextField = {
      key: draft.key || makeKey(),
      label,
      type,
      required: Boolean(draft.required),
      allowMultiple: type === "text" || type === "number" ? Boolean(draft.allowMultiple) : false,
      placeholder: String(draft.placeholder || "").trim(),
      ...(options ? { options } : {}),
      order: editIndex != null ? sorted[editIndex]?.order ?? editIndex : sorted.length,
    };

    let next;
    if (editIndex != null) {
      next = sorted.map((f, i) => (i === editIndex ? nextField : f));
    } else {
      next = [...sorted, nextField];
    }

    onChange?.(
      next.map((f, i) => ({
        ...f,
        order: i,
      })),
    );
    closeForm();
  };

  const removeField = (index) => {
    const next = sorted
      .filter((_, i) => i !== index)
      .map((f, i) => ({ ...f, order: i }));
    onChange?.(next);
    if (viewIndex === index) setViewIndex(null);
    if (editIndex === index) closeForm();
  };

  return (
    <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            Product application fields
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            These fields appear on the customer Product Details step after this
            Class / Category is selected.
          </p>
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            <Plus size={16} />
            Add field
          </button>
        )}
      </div>

      {sorted.length === 0 && !draft ? (
        <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
          No product fields yet. Add fields such as Rating, Size, Voltage, etc.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
          {sorted.map((field, index) => (
            <li
              key={field.key || index}
              className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-4"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">
                  {field.label}
                  {field.required ? (
                    <span className="ml-1 text-red-500">*</span>
                  ) : null}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {FIELD_TYPES.find((t) => t.value === field.type)?.label ||
                    field.type}
                  {field.allowMultiple ? " · multiple" : ""}
                  {field.type === "select" && field.options?.length
                    ? ` · ${field.options.length} options`
                    : ""}
                </p>
              </div>
              {!disabled && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    title="View"
                    onClick={() =>
                      setViewIndex(viewIndex === index ? null : index)
                    }
                    className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    type="button"
                    title="Edit"
                    onClick={() => openEdit(index)}
                    className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    title="Delete"
                    onClick={() => removeField(index)}
                    className="rounded-md p-2 text-red-500 hover:bg-red-50"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {viewing && (
        <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/60 px-4 py-3 text-sm text-gray-700">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-medium text-gray-900">Field details</span>
            <button
              type="button"
              onClick={() => setViewIndex(null)}
              className="rounded p-1 text-gray-500 hover:bg-white"
            >
              <X size={16} />
            </button>
          </div>
          <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-gray-500">Label</dt>
              <dd>{viewing.label}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Type</dt>
              <dd>{viewing.type}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Required</dt>
              <dd>{viewing.required ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Allow multiple</dt>
              <dd>{viewing.allowMultiple ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Placeholder</dt>
              <dd>{viewing.placeholder || "—"}</dd>
            </div>
            {viewing.type === "select" && (
              <div className="sm:col-span-2">
                <dt className="text-xs text-gray-500">Options</dt>
                <dd>{(viewing.options || []).join(", ") || "—"}</dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {draft && (
        <div className="mt-4 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-900">
              {editIndex != null ? "Edit field" : "New field"}
            </h4>
            <button
              type="button"
              onClick={closeForm}
              className="rounded p-1 text-gray-500 hover:bg-white"
            >
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700">
                Label *
              </span>
              <input
                type="text"
                value={draft.label}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, label: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
                placeholder="e.g. Rating"
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700">Type</span>
              <select
                value={draft.type}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, type: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-gray-700">
                Placeholder
              </span>
              <input
                type="text"
                value={draft.placeholder}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    placeholder: e.target.value,
                  }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
                placeholder="Optional hint text"
              />
            </label>

            {draft.type === "select" && (
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block font-medium text-gray-700">
                  Options (comma-separated) *
                </span>
                <input
                  type="text"
                  value={draft.optionsText}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      optionsText: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
                  placeholder="e.g. Small, Medium, Large"
                />
              </label>
            )}

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={Boolean(draft.required)}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    required: e.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-gray-300"
              />
              Required on customer form
            </label>

            {(draft.type === "text" || draft.type === "number") && (
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={Boolean(draft.allowMultiple)}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      allowMultiple: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-gray-300"
                />
                Allow multiple entries
              </label>
            )}
          </div>

          {formError ? (
            <p className="text-sm text-red-600">{formError}</p>
          ) : null}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeForm}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveDraft}
              className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              {editIndex != null ? "Update field" : "Save field"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
