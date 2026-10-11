import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Pencil, Save, Trash2, X } from "lucide-react";
import { notifyError, notifySuccess } from "@/utils/toast";
import FleetManagementServices from "@/services/FleetManagementServices";

export const APPOINTMENT_NOTE_MAX = 2048;

/** Field-service note slots (keys match FleetJob / Job model). */
export const DISPATCH_APPOINTMENT_NOTE_SPECS = [
  {
    key: "techNote",
    label: "Tech",
    sticky: "bg-amber-200 border-amber-400/60 shadow-amber-900/10",
    cardBg: "bg-amber-50",
    cardBorder: "border-amber-800/40",
    cardTitle: "text-amber-950",
    cardBody: "text-amber-950/90",
    cardMuted: "text-amber-900/60",
  },
  {
    key: "accountMemo",
    label: "Account",
    sticky: "bg-sky-200 border-sky-400/50 shadow-sky-900/10",
    cardBg: "bg-sky-50",
    cardBorder: "border-sky-800/35",
    cardTitle: "text-sky-950",
    cardBody: "text-sky-950/90",
    cardMuted: "text-sky-900/60",
  },
  {
    key: "orderNote",
    label: "Order",
    sticky: "bg-lime-200 border-lime-500/40 shadow-lime-900/10",
    cardBg: "bg-lime-50",
    cardBorder: "border-lime-800/35",
    cardTitle: "text-lime-950",
    cardBody: "text-lime-950/90",
    cardMuted: "text-lime-900/60",
  },
  {
    key: "siteNote",
    label: "Site",
    sticky: "bg-orange-200 border-orange-400/50 shadow-orange-900/10",
    cardBg: "bg-orange-50",
    cardBorder: "border-orange-800/35",
    cardTitle: "text-orange-950",
    cardBody: "text-orange-950/90",
    cardMuted: "text-orange-900/60",
  },
  {
    key: "adminNote",
    label: "Admin",
    sticky: "bg-violet-200 border-violet-400/50 shadow-violet-900/10",
    cardBg: "bg-violet-50",
    cardBorder: "border-violet-800/35",
    cardTitle: "text-violet-950",
    cardBody: "text-violet-950/90",
    cardMuted: "text-violet-900/60",
  },
];

function StickyNoteAddButton({ spec, onClick, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`group flex flex-col items-center gap-0.5 w-10 min-w-0 ${disabled ? "opacity-50 pointer-events-none" : ""}`}
    >
      <div
        className={`relative w-8 h-8 rounded border shadow-sm ${spec.sticky} transition group-hover:brightness-[1.02] group-active:scale-[0.98]`}
      >
        <span
          className="pointer-events-none absolute bottom-0 right-0 w-0 h-0 border-l-[6px] border-l-transparent border-b-[6px] border-b-black/10 rounded-br"
          aria-hidden
        />
      </div>
      <span className="text-[7px] font-bold text-slate-800 text-center leading-tight max-w-[2.75rem]">{spec.label}</span>
    </button>
  );
}

function NoteCard({ spec, text, onEdit, onDelete, busy }) {
  const len = text.length;
  return (
    <div
      className={`rounded-md border px-2.5 py-2 shadow-sm ${spec.cardBg} ${spec.cardBorder} ${spec.cardTitle}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={`text-[10px] font-bold leading-tight ${spec.cardTitle}`}>
          {spec.label} - Appointment Note
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="p-1 rounded hover:bg-black/5 text-current disabled:opacity-40"
            title="Edit"
            aria-label="Edit note"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1 rounded hover:bg-black/5 text-current disabled:opacity-40"
            title="Delete"
            aria-label="Delete note"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <p className={`mt-1.5 text-[9px] leading-snug whitespace-pre-wrap break-words ${spec.cardBody}`}>
        {text}
      </p>
      <div className={`mt-1.5 text-right text-[8px] tabular-nums ${spec.cardMuted}`}>
        {len} / {APPOINTMENT_NOTE_MAX}
      </div>
    </div>
  );
}

function NoteModal({ open, title, value, onChange, onSave, onClose, saving }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dispatch-appointment-note-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white shadow-xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-slate-200 bg-slate-100">
          <h2 id="dispatch-appointment-note-title" className="text-sm font-bold text-slate-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full hover:bg-slate-200 text-slate-600"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-3">
          <div className="relative">
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value.slice(0, APPOINTMENT_NOTE_MAX))}
              rows={8}
              className="w-full text-sm border border-slate-300 rounded-md px-2 py-2 pr-2 pb-7 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 resize-y min-h-[160px]"
              placeholder="Enter note…"
              autoFocus
            />
            <div className="pointer-events-none absolute bottom-2 right-2 text-[10px] text-slate-500 tabular-nums">
              {value.length} / {APPOINTMENT_NOTE_MAX}
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              disabled={saving}
              onClick={onSave}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#4A76B2] text-white text-xs font-semibold px-3 py-2 shadow-sm hover:bg-[#3d66a0] disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              Save
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Sticky-note entry points, optional saved note cards, modal editor, and persistence on the job.
 */
export default function DispatchAppointmentNotes({ job, onSaved }) {
  const jobId = job?._id ? String(job._id) : "";
  const [modal, setModal] = useState(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteConfirmSpec, setDeleteConfirmSpec] = useState(null);

  const openModal = (spec, initial) => {
    setModal({ key: spec.key, spec, initial: initial != null ? initial : getNoteValue(job, spec.key) });
    setDraft((initial != null ? initial : getNoteValue(job, spec.key)).slice(0, APPOINTMENT_NOTE_MAX));
  };

  const closeModal = useCallback(() => {
    if (saving) return;
    setModal(null);
    setDraft("");
  }, [saving]);

  const persist = async (key, text) => {
    if (!jobId) {
      notifyError("Missing job");
      return;
    }
    setSaving(true);
    try {
      await FleetManagementServices.updateJob(jobId, { [key]: text });
      notifySuccess(String(text).trim() ? "Note saved." : "Note removed.");
      onSaved?.();
      closeModal();
    } catch (e) {
      notifyError(e?.response?.data?.message || e?.message || "Failed to save note");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    if (!modal) return;
    persist(modal.key, draft);
  };

  const handleDelete = (spec) => {
    if (!jobId) return;
    setDeleteConfirmSpec(spec);
  };

  if (!jobId) return null;

  const modalTitle = modal
    ? `${modal.spec.label} - Appointment Note`
    : "";

  return (
    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
      {DISPATCH_APPOINTMENT_NOTE_SPECS.map((spec) => {
        const text = getNoteValue(job, spec.key);
        const has = Boolean(text);
        if (!has) return null;
        return (
          <NoteCard
            key={spec.key}
            spec={spec}
            text={text}
            busy={saving}
            onEdit={() => openModal(spec, text)}
            onDelete={() => handleDelete(spec)}
          />
        );
      })}

      <div className="flex flex-wrap gap-8 justify-center">
        {DISPATCH_APPOINTMENT_NOTE_SPECS.map((spec) => {
          const text = getNoteValue(job, spec.key);
          if (text) return null;
          return (
            <StickyNoteAddButton
              key={spec.key}
              spec={spec}
              disabled={saving}
              onClick={() => openModal(spec, "")}
            />
          );
        })}
      </div>

      <NoteModal
        open={Boolean(modal)}
        title={modalTitle}
        value={draft}
        onChange={setDraft}
        onSave={handleSave}
        onClose={closeModal}
        saving={saving}
      />
      {deleteConfirmSpec ? (
        <div
          className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-slate-900/50"
          role="dialog"
          aria-modal="true"
          onClick={() => (saving ? null : setDeleteConfirmSpec(null))}
        >
          <div
            className="w-full max-w-sm rounded-lg bg-white shadow-xl border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Delete Appointment Note</h3>
            </div>
            <div className="px-4 py-3 text-sm text-slate-700">
              Delete {deleteConfirmSpec.label} appointment note?
            </div>
            <div className="px-4 py-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => setDeleteConfirmSpec(null)}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  const spec = deleteConfirmSpec;
                  setDeleteConfirmSpec(null);
                  persist(spec.key, "");
                }}
                className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function getNoteValue(j, key) {
  if (!j) return "";
  const v = j[key];
  return v == null ? "" : String(v).trim();
}
