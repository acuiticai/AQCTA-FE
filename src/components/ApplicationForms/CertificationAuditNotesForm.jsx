import React, { useMemo, useState } from "react";
import SignaturePad from "@/components/ApplicationForms/SignaturePad";

const MAX_NOTES = 40;
const NOTE_FIELDS = ["item", "observation", "reference"];

export const AUDIT_NOTES_EDITABLE_KEYS = [
  "manufacturer",
  "date",
  "fileReference",
  "reportNo",
];

const display = (value) => String(value ?? "").trim();

const toDateInputValue = (value) => {
  const raw = display(value);
  if (!raw) return "";
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmy) {
    const dd = dmy[1].padStart(2, "0");
    const mm = dmy[2].padStart(2, "0");
    return `${dmy[3]}-${mm}-${dd}`;
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const fromDateInputValue = (value) => {
  const raw = display(value);
  if (!raw) return "";
  const [y, m, d] = raw.split("-");
  if (!y || !m || !d) return raw;
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
};

export const collectNotes = (values = {}) => {
  const rows = [];
  for (let i = 1; i <= MAX_NOTES; i += 1) {
    const item = display(values[`note_${i}_item`]);
    const observation = display(values[`note_${i}_observation`]);
    const reference = display(values[`note_${i}_reference`]);
    if (!item && !observation && !reference) continue;
    rows.push({ item, observation, reference });
  }
  return rows;
};

const deriveNoteCount = (values) => {
  let highest = 0;
  for (let i = 1; i <= MAX_NOTES; i += 1) {
    const hit = NOTE_FIELDS.some(
      (f) => display(values[`note_${i}_${f}`]) !== "",
    );
    if (hit) highest = i;
  }
  return highest;
};

/**
 * Audit Notes sheet — matches `templates/auditNotes.html` (AQCTA-FOR-01-13).
 * Notes are edited as rows; the PDF joins them into the three body columns.
 */
export default function CertificationAuditNotesForm({
  values = {},
  onChange,
  readOnly = false,
  invalidKeys = [],
  editableKeys = [],
  repeatableRows = {},
  onAddRow,
  onRemoveRow,
  preparedSignature = "",
  onPreparedSignatureChange,
  profileSignature = "",
  preparedSignatureUrl = "",
  documentTitle = "",
  documentCode = "",
}) {
  const invalid = new Set(invalidKeys);
  const editable = useMemo(() => new Set(editableKeys), [editableKeys]);
  const canEdit = (key) => {
    if (readOnly) return false;
    if (!editableKeys?.length) return true;
    return editable.has(key);
  };
  const canEditNotes = !readOnly;
  const setField = (key, value) => onChange?.(key, value);

  const derivedCount = Math.max(deriveNoteCount(values), 1);
  const [localNotes, setLocalNotes] = useState(0);
  const noteCount = Math.min(
    MAX_NOTES,
    Math.max(
      localNotes,
      typeof repeatableRows?.notes === "number"
        ? repeatableRows.notes
        : derivedCount,
      derivedCount,
    ),
  );

  const addNote = () => {
    if (noteCount >= MAX_NOTES) return;
    const next = noteCount + 1;
    NOTE_FIELDS.forEach((f) => setField(`note_${next}_${f}`, ""));
    if (onAddRow) onAddRow("notes");
    else setLocalNotes(next);
  };

  const removeNote = (index) => {
    if (noteCount <= 1) {
      NOTE_FIELDS.forEach((f) => setField(`note_1_${f}`, ""));
      return;
    }
    for (let i = index; i < noteCount; i += 1) {
      NOTE_FIELDS.forEach((f) => {
        setField(
          `note_${i}_${f}`,
          values[`note_${i + 1}_${f}`] ?? "",
        );
      });
    }
    NOTE_FIELDS.forEach((f) => setField(`note_${noteCount}_${f}`, ""));
    if (onRemoveRow) onRemoveRow("notes", noteCount);
    else setLocalNotes(Math.max(noteCount - 1, 1));
  };

  const allowSign = Boolean(onPreparedSignatureChange) && !readOnly;
  const auditorSig = preparedSignature || preparedSignatureUrl;

  return (
    <div className="an-page">
      <header className="an-header">
        <h1 className="an-title">{documentTitle || "AUDIT NOTES"}</h1>
        <div className="an-form-number">
          {documentCode || "AQCTA-FOR-01-13"}
        </div>
      </header>

      <table className="an-info">
        <tbody>
          <tr>
            <td className="an-info-left">
              <span className="an-label">Manufacturer:</span>{" "}
              {canEdit("manufacturer") ? (
                <input
                  type="text"
                  className={`an-in${
                    invalid.has("manufacturer") ? " is-invalid" : ""
                  }`}
                  value={values.manufacturer || ""}
                  onChange={(e) => setField("manufacturer", e.target.value)}
                />
              ) : (
                <span className="an-field">{display(values.manufacturer)}</span>
              )}
            </td>
            <td className="an-info-right">
              <span className="an-label">Date:</span>{" "}
              {canEdit("date") ? (
                <input
                  type="date"
                  className={`an-in an-in--date${
                    invalid.has("date") ? " is-invalid" : ""
                  }`}
                  value={toDateInputValue(values.date)}
                  onChange={(e) =>
                    setField("date", fromDateInputValue(e.target.value))
                  }
                />
              ) : (
                <span className="an-field">{display(values.date)}</span>
              )}
            </td>
          </tr>
          <tr>
            <td className="an-info-left">
              <span className="an-label">File Reference:</span>{" "}
              {canEdit("fileReference") ? (
                <input
                  type="text"
                  className={`an-in${
                    invalid.has("fileReference") ? " is-invalid" : ""
                  }`}
                  value={values.fileReference || ""}
                  onChange={(e) => setField("fileReference", e.target.value)}
                />
              ) : (
                <span className="an-field">{display(values.fileReference)}</span>
              )}
            </td>
            <td className="an-info-right">
              <span className="an-label">Report No.:</span>{" "}
              {canEdit("reportNo") ? (
                <input
                  type="text"
                  className={`an-in${
                    invalid.has("reportNo") ? " is-invalid" : ""
                  }`}
                  value={values.reportNo || ""}
                  onChange={(e) => setField("reportNo", e.target.value)}
                />
              ) : (
                <span className="an-field">{display(values.reportNo)}</span>
              )}
            </td>
          </tr>
        </tbody>
      </table>

      <table className="an-notes">
        <thead>
          <tr>
            <th className="an-col-item">Item</th>
            <th className="an-col-obs">Observation and Comments</th>
            <th className="an-col-ref">Reference</th>
            {canEditNotes ? <th className="an-col-actions" /> : null}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: noteCount }, (_, i) => i + 1).map((index) => {
            const itemKey = `note_${index}_item`;
            const obsKey = `note_${index}_observation`;
            const refKey = `note_${index}_reference`;
            return (
              <tr key={index}>
                <td>
                  {canEditNotes ? (
                    <input
                      type="text"
                      className={`an-in${
                        invalid.has(itemKey) ? " is-invalid" : ""
                      }`}
                      value={values[itemKey] || ""}
                      placeholder="Item / area"
                      onChange={(e) => setField(itemKey, e.target.value)}
                    />
                  ) : (
                    display(values[itemKey])
                  )}
                </td>
                <td>
                  {canEditNotes ? (
                    <textarea
                      className={`an-in an-in--area${
                        invalid.has(obsKey) ? " is-invalid" : ""
                      }`}
                      rows={3}
                      value={values[obsKey] || ""}
                      placeholder="Observation and comments"
                      onChange={(e) => setField(obsKey, e.target.value)}
                    />
                  ) : (
                    <div className="an-pre">{display(values[obsKey])}</div>
                  )}
                </td>
                <td>
                  {canEditNotes ? (
                    <input
                      type="text"
                      className={`an-in${
                        invalid.has(refKey) ? " is-invalid" : ""
                      }`}
                      value={values[refKey] || ""}
                      placeholder="Clause / standard"
                      onChange={(e) => setField(refKey, e.target.value)}
                    />
                  ) : (
                    display(values[refKey])
                  )}
                </td>
                {canEditNotes ? (
                  <td className="an-col-actions">
                    {noteCount > 1 ? (
                      <button
                        type="button"
                        className="an-remove"
                        onClick={() => removeNote(index)}
                        aria-label={`Remove note ${index}`}
                      >
                        Remove
                      </button>
                    ) : null}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>

      {canEditNotes && noteCount < MAX_NOTES ? (
        <button type="button" className="an-add" onClick={addNote}>
          Add note
        </button>
      ) : null}

      {(allowSign || auditorSig) && (
        <div className="an-sign">
          <div className="an-sign-label">Auditor</div>
          {allowSign ? (
            <SignaturePad
              compact
              label="Auditor signature"
              value={preparedSignature}
              onChange={onPreparedSignatureChange}
              profileSignature={profileSignature}
              hint="Signing issues the document. It cannot be edited afterwards."
            />
          ) : auditorSig ? (
            <img className="an-sign-img" src={auditorSig} alt="Auditor signature" />
          ) : null}
        </div>
      )}

      <footer className="an-footer">
        <div>
          AQC TECHNICAL ASSESSORS (M) SDN. BHD.
          <br />
          Issue 1 &nbsp; Rev: 1
        </div>
        <div className="an-footer-center">Conformity Assessment</div>
        <div className="an-footer-right">Page 1 of 1</div>
      </footer>
    </div>
  );
}
