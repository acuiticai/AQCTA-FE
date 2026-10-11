import React, { useEffect, useMemo, useRef, useState } from "react";
import SignaturePad from "@/components/ApplicationForms/SignaturePad";
import { CustomDatePicker } from "@/page-layouts";

const PCI_LOGO_SRC = `${process.env.PUBLIC_URL || ""}/aqcta-logo.png`;

const MAX_ATTENDEES = 12;
const MAX_COVERAGE_LINES = 10;
const DEFAULT_COVERAGE_LINES = 1;
const ATTENDEE_FIELDS = ["name", "entryTime", "exitTime"];

/** Mirrors AQCTA-BE/ApplicationForms/auditChecklistAttendanceItems.js */
export const COVERAGE_GROUPS = [
  {
    key: "1",
    title: "1. Product Conformance Audit",
    bullets: [],
    refs: ["PCA Clause", "● Type Test Report", "● Standard", "● Certification Report"],
    legacyKeys: ["coverage1", "coverage1_2", "coverage1_3"],
  },
  {
    key: "2",
    title: "2. Quality Plan Suitability",
    bullets: [
      "Raw materials and/or components inspection",
      "In process and final inspection",
      "Test equipment adequacy and suitability",
    ],
    refs: ["AQCTA-D1-3.1", "- Clause 3.1", "- Clause 3.2", "- Clause 3.3"],
    legacyKeys: ["coverage2", "coverage2_2", "coverage2_3"],
  },
  {
    key: "21",
    title: "2.1 Quality Records",
    bullets: [
      "Handling of non-conforming products",
      "Tests, inspections and calibrations",
      "Complaints handling",
    ],
    refs: ["AQCTA-D1-3.1", "- Clause 3.4", "- Clause 3.2,3.3", "- Clause 3.6"],
    legacyKeys: ["coverage21", "coverage21_2", "coverage21_3"],
  },
  {
    key: "3",
    title: "3. Marking Requirements",
    bullets: [
      "Acceptance of proposed marking system",
      "Compliance to Certification Report",
    ],
    refs: ["AQCTA-D1-3.1", "- Clause 5", "- Clause 1.4.6"],
    legacyKeys: ["coverage3", "coverage3_2"],
  },
  {
    key: "4",
    title: "4. Manufacturing Method",
    bullets: [
      "Management Representative and QC Staff Acceptability",
      "Production system (as defined in Certification Report) and system to segregate sub-standard product.",
    ],
    refs: ["AQCTA-D1-3.1", "- Clause 2.1 & 2.2.1", "- Clause 2.2.2"],
    legacyKeys: ["coverage4", "coverage4_2"],
  },
  {
    key: "5",
    title: "5. Other observations",
    bullets: [
      "Quality management system",
      "Other certifications/approvals (product)",
    ],
    refs: [],
    legacyKeys: ["coverage5", "coverage5_2"],
  },
];

export const ATTACHMENT_FIELDS = [
  {
    key: "attachAuditNotes",
    label: "Audit Notes (AQCTA-F1-13)",
  },
  {
    key: "attachAuditReport",
    label: "Audit Report (AQCTA-F1-16)",
  },
  {
    key: "attachSamples",
    label: "Identification of selected samples (AQCTA-F1-15)",
  },
];

export const coverageKey = (groupKey, index) => `cov_${groupKey}_${index}`;

export const ALL_COVERAGE_KEYS = COVERAGE_GROUPS.flatMap((group) =>
  Array.from({ length: MAX_COVERAGE_LINES }, (_, i) =>
    coverageKey(group.key, i + 1),
  ),
);

export const AUDIT_CHECKLIST_ATTENDANCE_EDITABLE_KEYS = [
  "date",
  "applicantLicensee",
  "fileReference",
  "standard",
  ...ALL_COVERAGE_KEYS,
  ...ATTACHMENT_FIELDS.map((item) => item.key),
];

const display = (value) => String(value ?? "").trim();

const normalizeCoverageValues = (values = {}) => {
  let next = { ...values };
  for (const group of COVERAGE_GROUPS) {
    (group.legacyKeys || []).forEach((legacyKey, i) => {
      const modern = coverageKey(group.key, i + 1);
      const legacyVal = display(next[legacyKey]);
      const modernVal = display(next[modern]);
      if (legacyVal && !modernVal) {
        next[modern] = legacyVal;
      }
    });
  }
  for (const group of COVERAGE_GROUPS) {
    const notes = [];
    for (let i = 1; i <= MAX_COVERAGE_LINES; i += 1) {
      const text = display(next[coverageKey(group.key, i)]);
      if (text) notes.push(text);
    }
    for (let i = 1; i <= MAX_COVERAGE_LINES; i += 1) {
      delete next[coverageKey(group.key, i)];
    }
    notes.forEach((note, i) => {
      next[coverageKey(group.key, i + 1)] = note;
    });
    for (const legacyKey of group.legacyKeys || []) {
      delete next[legacyKey];
    }
  }
  return next;
};

const collectCoverageNotes = (values = {}, groupKey) => {
  const notes = [];
  for (let i = 1; i <= MAX_COVERAGE_LINES; i += 1) {
    const text = display(values[coverageKey(groupKey, i)]);
    if (text) notes.push(text);
  }
  return notes;
};

const coverageLineCount = (values = {}, groupKey) => {
  const filled = collectCoverageNotes(values, groupKey).length;
  return Math.max(DEFAULT_COVERAGE_LINES, filled);
};

const writeCoverageNotes = (values = {}, groupKey, notes = []) => {
  const next = { ...values };
  for (let i = 1; i <= MAX_COVERAGE_LINES; i += 1) {
    delete next[coverageKey(groupKey, i)];
  }
  notes
    .map((note) => display(note))
    .filter(Boolean)
    .slice(0, MAX_COVERAGE_LINES)
    .forEach((note, i) => {
      next[coverageKey(groupKey, i + 1)] = note;
    });
  return next;
};

const isChecked = (value) => {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  return raw === "true" || raw === "yes" || raw === "1" || raw === "x" || raw === "on";
};

const toDateInputValue = (value) => {
  const raw = display(value);
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const dmy = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (dmy) {
    const [, dd, mm, yyyy] = dmy;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    const yyyy = parsed.getFullYear();
    const mm = String(parsed.getMonth() + 1).padStart(2, "0");
    const dd = String(parsed.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  return "";
};

const fromDateInputValue = (value) => {
  const raw = display(value);
  if (!raw) return "";
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const [, yyyy, mm, dd] = iso;
    return `${dd}/${mm}/${yyyy}`;
  }
  return raw;
};

/** Parse stored attendance time ("09:00" / "9:00 am") for the picker. */
const toTimePickerValue = (value) => {
  const raw = display(value);
  if (!raw) return null;
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(raw)) {
    const [hh, mm] = raw.split(":");
    return new Date(1970, 0, 1, Number(hh), Number(mm));
  }
  const match = raw.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = (match[3] || "").toLowerCase();
  if (meridiem === "pm" && hours < 12) hours += 12;
  if (meridiem === "am" && hours === 12) hours = 0;
  return new Date(1970, 0, 1, hours, minutes);
};

/** Persist attendance times as HH:mm for the PDF. */
const fromTimePickerValue = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

const formatNowTime = () => {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

const AttendanceTimePicker = ({ value, onChange, invalid, placeholder }) => (
  <div className={`aca-time-picker${invalid ? " is-invalid" : ""}`}>
    <CustomDatePicker
      value={toTimePickerValue(value)}
      onChange={(date) => onChange(fromTimePickerValue(date))}
      showTimeSelect
      showTimeSelectOnly
      timeIntervals={5}
      timeCaption="Time"
      dateFormat="HH:mm"
      timeFormat="HH:mm"
      placeholder={placeholder || "Select time"}
      documentFieldStyle
      required={false}
      clearable
      width="100%"
      shouldShowError={Boolean(invalid)}
      error={invalid ? "Required" : ""}
    />
  </div>
);

const deriveAttendeeCount = (values) => {
  let highest = 0;
  for (let i = 1; i <= MAX_ATTENDEES; i += 1) {
    const hit = ATTENDEE_FIELDS.some(
      (f) => display(values[`attendee_${i}_${f}`]) !== "",
    );
    if (hit) highest = i;
  }
  return highest;
};

const MarkBox = ({ checked, onClick, disabled, invalid }) => (
  <button
    type="button"
    className={`aca-box${checked ? " is-checked" : ""}${
      invalid ? " is-invalid" : ""
    }`}
    aria-pressed={checked}
    disabled={disabled}
    onClick={(e) => {
      e.stopPropagation();
      onClick?.(e);
    }}
  >
    {checked ? "✓" : ""}
  </button>
);

/**
 * Audit checklist and attendance list — matches
 * `templates/auditChecklistAttendance.html` (AQCTA-FOR-01-12).
 */
export default function CertificationAuditChecklistAttendanceForm({
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
  /** Changes after each server reload so Saved / Entering-now badges reset. */
  attendanceSyncKey = "",
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
  const canEditAttendance = !readOnly;
  const canEditCoverage = !readOnly;
  const setField = (key, value) => onChange?.(key, value);

  const coverageValues = useMemo(
    () => normalizeCoverageValues(values),
    [values],
  );

  const [coverageCounts, setCoverageCounts] = useState({});

  const lineCountFor = (groupKey) =>
    Math.min(
      MAX_COVERAGE_LINES,
      Math.max(
        coverageCounts[groupKey] || 0,
        coverageLineCount(coverageValues, groupKey),
      ),
    );

  const setCoverageNote = (groupKey, index, text) => {
    const count = lineCountFor(groupKey);
    const notes = [];
    for (let i = 1; i <= count; i += 1) {
      notes.push(
        i === index ? text : coverageValues[coverageKey(groupKey, i)] || "",
      );
    }
    const packed = notes.map(display).filter(Boolean);
    /* Keep one trailing empty slot if the user is typing into a newly added row. */
    const editingNewEmpty =
      display(text) === "" && index === count && packed.length < count;
    const finalNotes = editingNewEmpty ? [...packed, ""] : packed;
    for (let i = 1; i <= MAX_COVERAGE_LINES; i += 1) {
      setField(coverageKey(groupKey, i), finalNotes[i - 1] || "");
    }
    setCoverageCounts((prev) => ({
      ...prev,
      [groupKey]: Math.max(DEFAULT_COVERAGE_LINES, finalNotes.length),
    }));
  };

  const addCoverageNote = (groupKey) => {
    if (!canEditCoverage) return;
    const filled = collectCoverageNotes(coverageValues, groupKey).length;
    if (filled >= MAX_COVERAGE_LINES) return;
    setCoverageCounts((prev) => ({ ...prev, [groupKey]: filled + 1 }));
  };

  const removeCoverageNote = (groupKey, index) => {
    if (!canEditCoverage) return;
    const count = lineCountFor(groupKey);
    const notes = [];
    for (let i = 1; i <= count; i += 1) {
      if (i === index) continue;
      notes.push(coverageValues[coverageKey(groupKey, i)] || "");
    }
    const packed = notes.map(display).filter(Boolean);
    for (let i = 1; i <= MAX_COVERAGE_LINES; i += 1) {
      setField(coverageKey(groupKey, i), packed[i - 1] || "");
    }
    setCoverageCounts((prev) => ({
      ...prev,
      [groupKey]: Math.max(DEFAULT_COVERAGE_LINES, packed.length),
    }));
  };

  const [localAttendees, setLocalAttendees] = useState(() =>
    /* Preview (no parent row control) starts with one blank line. */
    onAddRow ? 0 : 1,
  );

  const buildPersistedSet = (source) => {
    const count = deriveAttendeeCount(source);
    return new Set(
      Array.from({ length: count }, (_, i) => i + 1).filter((index) =>
        ATTENDEE_FIELDS.some(
          (f) => display(source[`attendee_${index}_${f}`]) !== "",
        ),
      ),
    );
  };

  const [persistedIndexes, setPersistedIndexes] = useState(() =>
    buildPersistedSet(values),
  );
  const [currentDraftIndex, setCurrentDraftIndex] = useState(null);
  const lastSyncKey = useRef(null);

  useEffect(() => {
    if (lastSyncKey.current === attendanceSyncKey) return;
    lastSyncKey.current = attendanceSyncKey;
    setPersistedIndexes(buildPersistedSet(values));
    setCurrentDraftIndex(null);
    // values intentionally read at sync-key change only (server reload).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendanceSyncKey]);

  const currentAuditorName = display(
    values.preparedByName ||
      values.auditorDeclaredName ||
      values.auditorName,
  );

  const attendeeCount = Math.min(
    Math.max(
      repeatableRows.attendance || 0,
      localAttendees || 0,
      deriveAttendeeCount(values),
      currentDraftIndex || 0,
    ),
    MAX_ATTENDEES,
  );

  const addAttendee = () => {
    if (!canEditAttendance || attendeeCount >= MAX_ATTENDEES) return;
    if (onAddRow) {
      onAddRow("attendance");
      return;
    }
    setLocalAttendees(Math.min(attendeeCount + 1, MAX_ATTENDEES));
  };

  const removeAttendee = (index) => {
    if (!canEditAttendance || index < 1 || index > attendeeCount) return;

    for (let i = index; i < attendeeCount; i += 1) {
      ATTENDEE_FIELDS.forEach((f) => {
        setField(
          `attendee_${i}_${f}`,
          values[`attendee_${i + 1}_${f}`] ?? "",
        );
      });
    }
    ATTENDEE_FIELDS.forEach((f) =>
      setField(`attendee_${attendeeCount}_${f}`, ""),
    );

    setPersistedIndexes((prev) => {
      const next = new Set();
      prev.forEach((savedIndex) => {
        if (savedIndex < index) next.add(savedIndex);
        else if (savedIndex > index) next.add(savedIndex - 1);
      });
      return next;
    });
    setCurrentDraftIndex((prev) => {
      if (prev == null) return null;
      if (prev === index) return null;
      if (prev > index) return prev - 1;
      return prev;
    });

    if (onRemoveRow) {
      onRemoveRow("attendance", attendeeCount);
    } else {
      setLocalAttendees(Math.max(attendeeCount - 1, 0));
    }
  };

  const markMyAttendance = () => {
    if (!canEditAttendance) return;
    const name = currentAuditorName;
    if (!name) return;

    if (currentDraftIndex) {
      setField(`attendee_${currentDraftIndex}_name`, name);
      setField(`attendee_${currentDraftIndex}_entryTime`, formatNowTime());
      setField(`attendee_${currentDraftIndex}_exitTime`, "");
      return;
    }

    const alreadySaved = Array.from(persistedIndexes).some(
      (index) =>
        display(values[`attendee_${index}_name`]).toLowerCase() ===
        name.toLowerCase(),
    );
    if (alreadySaved) return;

    const blankIndex = Array.from(
      { length: attendeeCount },
      (_, i) => i + 1,
    ).find(
      (index) =>
        !persistedIndexes.has(index) &&
        !display(values[`attendee_${index}_name`]) &&
        !display(values[`attendee_${index}_entryTime`]) &&
        !display(values[`attendee_${index}_exitTime`]),
    );

    if (blankIndex) {
      setField(`attendee_${blankIndex}_name`, name);
      setField(`attendee_${blankIndex}_entryTime`, formatNowTime());
      setField(`attendee_${blankIndex}_exitTime`, "");
      setCurrentDraftIndex(blankIndex);
      return;
    }

    if (attendeeCount >= MAX_ATTENDEES) return;

    const nextIndex = attendeeCount + 1;
    if (onAddRow) {
      onAddRow("attendance");
    } else {
      setLocalAttendees(nextIndex);
    }
    setField(`attendee_${nextIndex}_name`, name);
    setField(`attendee_${nextIndex}_entryTime`, formatNowTime());
    setField(`attendee_${nextIndex}_exitTime`, "");
    setCurrentDraftIndex(nextIndex);
  };

  const allowSign = Boolean(onPreparedSignatureChange) && !readOnly;
  const auditorSig = preparedSignature || preparedSignatureUrl;

  return (
    <div className="aca-page">
      <header className="aca-header">
        <div className="aca-logo-box">
          <img className="aca-logo" src={PCI_LOGO_SRC} alt="AQCTA logo" />
        </div>
        <div className="aca-header-title">
          <h1>
            {documentTitle || "AUDIT CHECKLIST AND ATTENDANCE LIST"}
          </h1>
        </div>
        <div className="aca-form-code">
          {documentCode || "AQCTA-FOR-01-12"}
        </div>
      </header>

      <div className="aca-date-row">
        Date:{" "}
        {canEdit("date") ? (
          <input
            type="date"
            className={`aca-in aca-in--date${
              invalid.has("date") ? " is-invalid" : ""
            }`}
            value={toDateInputValue(values.date)}
            onChange={(e) => setField("date", fromDateInputValue(e.target.value))}
          />
        ) : (
          <span className="aca-underline">{display(values.date)}</span>
        )}
      </div>

      <div className="aca-section-title">ATTENDANCE LIST</div>

      <table className="aca-attendance">
        <thead>
          <tr>
            <th>ATTENDEES</th>
            <th>
              ENTRY
              <span className="aca-time-hint">Time</span>
            </th>
            <th>
              EXIT
              <span className="aca-time-hint">Time</span>
            </th>
            {canEditAttendance ? <th className="aca-col-actions" /> : null}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: attendeeCount }, (_, i) => i + 1).map(
            (index) => {
              const nameKey = `attendee_${index}_name`;
              const entryKey = `attendee_${index}_entryTime`;
              const exitKey = `attendee_${index}_exitTime`;
              const isCurrent = currentDraftIndex === index;
              const isSaved =
                persistedIndexes.has(index) && currentDraftIndex !== index;
              return (
                <tr
                  key={index}
                  className={
                    isCurrent
                      ? "aca-attendee-row is-current"
                      : isSaved
                        ? "aca-attendee-row is-saved"
                        : "aca-attendee-row"
                  }
                >
                  <td>
                    {isCurrent || isSaved ? (
                      <div className="aca-attendee-badge-row">
                        {isCurrent ? (
                          <span className="aca-badge aca-badge--current">
                            Entering now
                          </span>
                        ) : (
                          <span className="aca-badge aca-badge--saved">
                            Saved
                          </span>
                        )}
                      </div>
                    ) : null}
                    {canEditAttendance ? (
                      <input
                        type="text"
                        className={`aca-in${
                          invalid.has(nameKey) ? " is-invalid" : ""
                        }`}
                        value={values[nameKey] || ""}
                        placeholder="Full name"
                        onChange={(e) => setField(nameKey, e.target.value)}
                      />
                    ) : (
                      display(values[nameKey])
                    )}
                  </td>
                  <td>
                    {canEditAttendance ? (
                      <AttendanceTimePicker
                        value={values[entryKey] || ""}
                        invalid={invalid.has(entryKey)}
                        placeholder="Entry"
                        onChange={(next) => setField(entryKey, next)}
                      />
                    ) : (
                      display(values[entryKey])
                    )}
                  </td>
                  <td>
                    {canEditAttendance ? (
                      <AttendanceTimePicker
                        value={values[exitKey] || ""}
                        invalid={invalid.has(exitKey)}
                        placeholder="Exit"
                        onChange={(next) => setField(exitKey, next)}
                      />
                    ) : (
                      display(values[exitKey])
                    )}
                  </td>
                  {canEditAttendance ? (
                    <td className="aca-col-actions">
                      {attendeeCount > 1 ? (
                        <button
                          type="button"
                          className="aca-remove"
                          onClick={() => removeAttendee(index)}
                          aria-label={`Remove attendee ${index}`}
                        >
                          Remove
                        </button>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              );
            },
          )}
          {!canEditAttendance && attendeeCount === 0 ? (
            <tr>
              <td colSpan={3} className="aca-empty">
                No attendees recorded.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      {canEditAttendance ? (
        <div className="aca-attendance-actions">
          {attendeeCount < MAX_ATTENDEES ? (
            <button type="button" className="aca-add" onClick={addAttendee}>
              Add attendee
            </button>
          ) : null}
          {currentAuditorName ? (
            <button
              type="button"
              className="aca-mark-mine"
              onClick={markMyAttendance}
              title="Adds your name at the end with the current entry time. Save draft to record it."
            >
              Mark my attendance
            </button>
          ) : null}
          {currentDraftIndex ? (
            <p className="aca-mark-hint">
              Your entry is highlighted below the saved list. Exit stays empty
              until you set it — tap Save draft to record.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="aca-divider" />

      <div className="aca-audit-title">AUDIT CHECKLIST</div>
      <div className="aca-audit-subtitle">
        PRE-CERTIFICATION AUDIT / SURVEILLANCE AUDIT
      </div>

      <table className="aca-meta">
        <tbody>
          <tr>
            <td className="aca-meta-lbl">APPLICANT/LICENSEE</td>
            <td className="aca-meta-colon">:</td>
            <td>
              {canEdit("applicantLicensee") ? (
                <input
                  type="text"
                  className={`aca-in${
                    invalid.has("applicantLicensee") ? " is-invalid" : ""
                  }`}
                  value={values.applicantLicensee || ""}
                  onChange={(e) =>
                    setField("applicantLicensee", e.target.value)
                  }
                />
              ) : (
                <span className="aca-underline">
                  {display(values.applicantLicensee)}
                </span>
              )}
            </td>
            <td className="aca-meta-file">FILE REF:</td>
            <td>
              {canEdit("fileReference") ? (
                <input
                  type="text"
                  className={`aca-in${
                    invalid.has("fileReference") ? " is-invalid" : ""
                  }`}
                  value={values.fileReference || ""}
                  onChange={(e) => setField("fileReference", e.target.value)}
                />
              ) : (
                <span className="aca-underline">
                  {display(values.fileReference)}
                </span>
              )}
            </td>
          </tr>
          <tr>
            <td className="aca-meta-lbl">STANDARD</td>
            <td className="aca-meta-colon">:</td>
            <td colSpan={3}>
              {canEdit("standard") ? (
                <input
                  type="text"
                  className={`aca-in${
                    invalid.has("standard") ? " is-invalid" : ""
                  }`}
                  value={values.standard || ""}
                  onChange={(e) => setField("standard", e.target.value)}
                />
              ) : (
                <span className="aca-underline">
                  {display(values.standard)}
                </span>
              )}
            </td>
          </tr>
        </tbody>
      </table>

      <table className="aca-checklist">
        <thead>
          <tr>
            <th className="aca-col-item">Item</th>
            <th className="aca-col-ref">Ref. Requirement</th>
            <th className="aca-col-coverage">Coverage</th>
          </tr>
        </thead>
        <tbody>
          {COVERAGE_GROUPS.map((group) => (
            <tr key={group.key}>
              <td className="aca-item-cell">
                <div className="aca-item-title">{group.title}</div>
                {(group.bullets || []).map((bullet) => (
                  <div className="aca-bullet" key={bullet}>
                    ● {bullet}
                  </div>
                ))}
              </td>
              <td className="aca-ref-cell">
                {(group.refs || []).map((ref) => (
                  <div key={ref}>{ref}</div>
                ))}
              </td>
              <td className="aca-coverage-cell">
                {Array.from(
                  { length: lineCountFor(group.key) },
                  (_, i) => i + 1,
                ).map((lineIndex) => {
                  const key = coverageKey(group.key, lineIndex);
                  return (
                    <div className="aca-coverage-row" key={key}>
                      {canEditCoverage ? (
                        <>
                          <input
                            type="text"
                            className={`aca-in aca-coverage-in${
                              invalid.has(key) ? " is-invalid" : ""
                            }`}
                            value={coverageValues[key] || ""}
                            placeholder={`Coverage note ${lineIndex}`}
                            onChange={(e) =>
                              setCoverageNote(group.key, lineIndex, e.target.value)
                            }
                          />
                          {lineCountFor(group.key) > 1 ? (
                            <button
                              type="button"
                              className="aca-remove aca-coverage-remove"
                              onClick={() =>
                                removeCoverageNote(group.key, lineIndex)
                              }
                              aria-label={`Remove coverage note ${lineIndex}`}
                            >
                              ×
                            </button>
                          ) : null}
                        </>
                      ) : (
                        <div className="aca-coverage-line">
                          {display(coverageValues[key])}
                        </div>
                      )}
                    </div>
                  );
                })}
                {canEditCoverage &&
                lineCountFor(group.key) < MAX_COVERAGE_LINES ? (
                  <button
                    type="button"
                    className="aca-add-note"
                    onClick={() => addCoverageNote(group.key)}
                  >
                    + Add coverage note
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="aca-attachments">
        <div className="aca-attachments-title">Attachments:</div>
        {ATTACHMENT_FIELDS.map((item) => {
          const checked = isChecked(values[item.key]);
          const rowEditable = canEdit(item.key);
          const toggle = () => {
            if (!rowEditable) return;
            setField(item.key, checked ? "" : "true");
          };
          return (
            <div
              className={`aca-attachment${rowEditable ? " is-clickable" : ""}`}
              key={item.key}
              onClick={toggle}
              onKeyDown={(e) => {
                if (!rowEditable) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggle();
                }
              }}
              role={rowEditable ? "button" : undefined}
              tabIndex={rowEditable ? 0 : undefined}
            >
              <MarkBox
                checked={checked}
                disabled={!rowEditable}
                invalid={invalid.has(item.key)}
                onClick={toggle}
              />
              <span>{item.label}</span>
            </div>
          );
        })}
      </div>

      <div className="aca-sig">
        <div className="aca-sig-role">Auditor</div>
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
          <img
            className="aca-sig-mark"
            src={auditorSig}
            alt="Auditor signature"
          />
        ) : null}
        <div className="aca-sig-line" />
        <div>
          (
          {display(values.auditorDeclaredName) ||
            display(values.auditorName) ||
            "—"}
          )
        </div>
        <div>Date: {display(values.auditorSignedDate) || "—"}</div>
      </div>

      <footer className="aca-footer">
        <div>
          AQC TECHNICAL ASSESSORS (M) SDN. BHD.
          <br />
          Issue : 1 Rev: 1
        </div>
        <div className="aca-footer-center">Conformity Assessment</div>
        <div className="aca-footer-right">Page 1 of 1</div>
      </footer>
    </div>
  );
}
