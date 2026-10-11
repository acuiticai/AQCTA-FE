import React, { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import Button from "@/customer/components/ui/Button";
import { DropdownBasic } from "@/page-layouts";

const PCI_LOGO_SRC = `${process.env.PUBLIC_URL || ""}/aqcta-logo.png`;

const LEFT_ACTIVITIES = [
  { key: "material_id", label: "Material identification and traceability" },
  {
    key: "welding_procedure",
    label:
      "Review of welding procedure specification & qualification record",
  },
  {
    key: "welder_qualification",
    label: "Review of Welder/Welding Operator Qualification Records",
  },
  {
    key: "visual_fitup",
    label:
      "Visual inspection of weld joint fit-up/back gouge preparations",
  },
  {
    key: "welding_consumables",
    label:
      "Control of welding consumables (filler metals, rods, wire, etc.)",
  },
  {
    key: "inprocess_welding",
    label:
      "In-Process welding inspection (adherence to WPS- essential variables)",
  },
  {
    key: "dimensional",
    label: "Full dimensional inspection for compliance with design drawing",
  },
  { key: "radiographs", label: "Review of radiographs" },
  { key: "mt_pt", label: "Magnetic particle / liquid penetrant tests" },
  { key: "ultrasonic", label: "Ultrasonic testing" },
  { key: "nde_reports", label: "NDE test reports" },
  { key: "internal_inspection", label: "Internal inspection" },
  {
    key: "pwht",
    label: "Verification of specified post weld heat-treatment",
  },
  {
    key: "hardness",
    label: "Hardness test:",
    options: [
      { key: "hv", label: "HV" },
      { key: "hb", label: "HB" },
      { key: "hrc", label: "HRC" },
    ],
  },
  {
    key: "visual_completed",
    label:
      "Visual inspection of completed welds for detection of defects/ discontinuities",
  },
];

const RIGHT_ACTIVITIES = [
  {
    key: "mechanical_testing",
    label: "Mechanical testing (charpy impact, tensile, guided bends)",
  },
  {
    key: "pressure_leak",
    label: "Pressure / Leak test (hydro-static, air, helium, etc.)",
  },
  { key: "balancing", label: "Balancing of rotating parts" },
  { key: "shaft_runout", label: "Shaft / Rotor run out" },
  { key: "clearance", label: "Clearance checks" },
  { key: "vibration_noise", label: "Vibration / Noise test" },
  { key: "mechanical_running", label: "Mechanical running test" },
  { key: "overspeed_trip", label: "Over-speed trip test" },
  {
    key: "trip_systems",
    label: "Check of trip systems (low / high oil pressure, etc.)",
  },
  { key: "load_noload", label: "Load / No load test" },
  { key: "operational", label: "Operational test" },
  { key: "npsh", label: "NPSH test" },
  { key: "cleaning_painting", label: "Cleaning / sandblasting / painting" },
  {
    key: "marking_id",
    label: "Marking and identification (name plate data, tags, etc.)",
  },
  {
    key: "vendor_data",
    label:
      "Vendor data review (CMTR, test records, data sheets, QC records)",
  },
];

const VISIT_TYPE_OPTIONS = [
  "INITIAL INSP.",
  "IN-PROCESS INSP.",
  "FINAL INSP.",
  "ORDER STATUS",
];

const YES_NO = ["No", "Yes"];

const OWNERSHIP_OPTIONS = ["Own", "Client", "Contractor"];

const FILE_MAX_BYTES = 10 * 1024 * 1024;

const display = (value) => String(value ?? "").trim();

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

/** Persist dates as dd/mm/yyyy to match PDF output. */
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

/** HTML time inputs need HH:mm (24h). */
const toTimeInputValue = (value) => {
  const raw = display(value);
  if (!raw) return "";
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(raw)) return raw.slice(0, 5);
  const match = raw.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
  if (!match) return "";
  let hours = Number(match[1]);
  const minutes = match[2];
  const meridiem = (match[3] || "").toLowerCase();
  if (meridiem === "pm" && hours < 12) hours += 12;
  if (meridiem === "am" && hours === 12) hours = 0;
  return `${String(hours).padStart(2, "0")}:${minutes}`;
};

const isChecked = (value) => {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  return raw === "true" || raw === "yes" || raw === "1" || raw === "x";
};

const asList = (value) => {
  if (Array.isArray(value)) {
    return value.map((v) => String(v || "").trim()).filter(Boolean);
  }
  const raw = String(value ?? "").trim();
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
};

const deriveRowCount = (values, prefix, fields, max) => {
  let highest = 0;
  for (let i = 1; i <= max; i += 1) {
    const hit = fields.some((f) => {
      const v = values[`${prefix}_${i}_${f}`];
      if (v && typeof v === "object") {
        return Boolean(v.fileName || v.dataUrl || v.s3Key);
      }
      return String(v ?? "").trim() !== "";
    });
    if (hit) highest = i;
  }
  return highest;
};

const MarkBox = ({ checked, onClick, disabled, small = false, invalid }) => (
  <button
    type="button"
    className={`${small ? "inotes-smallcheck" : "inotes-check"}${
      checked ? " is-checked" : ""
    }${invalid ? " is-invalid" : ""}`}
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

const CheckLabel = ({
  checked,
  onToggle,
  disabled,
  invalid,
  small = false,
  children,
}) => {
  const editable = !disabled;
  return (
    <span
      className={`inotes-subcheck${editable ? " is-clickable" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        if (!editable) return;
        onToggle?.();
      }}
      onKeyDown={(e) => {
        if (!editable) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          onToggle?.();
        }
      }}
      role={editable ? "button" : undefined}
      tabIndex={editable ? 0 : undefined}
    >
      <MarkBox
        small={small}
        checked={checked}
        disabled={disabled}
        invalid={invalid}
        onClick={() => onToggle?.()}
      />
      {children}
    </span>
  );
};

const LineInput = ({
  value,
  onChange,
  readOnly,
  placeholder = "",
  className = "",
  invalid = false,
  multiline = false,
  rows = 3,
}) => {
  if (readOnly) {
    return (
      <span className={`inotes-ro ${className}`.trim()}>
        {display(value)}
      </span>
    );
  }
  if (multiline) {
    return (
      <textarea
        className={`inotes-area ${className}${invalid ? " is-invalid" : ""}`.trim()}
        rows={rows}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
      />
    );
  }
  return (
    <input
      type="text"
      className={`inotes-in ${className}${invalid ? " is-invalid" : ""}`.trim()}
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => onChange?.(e.target.value)}
    />
  );
};

const DateInput = ({
  value,
  onChange,
  readOnly,
  className = "",
  invalid = false,
}) => {
  if (readOnly) {
    return (
      <span className={`inotes-ro ${className}`.trim()}>{display(value)}</span>
    );
  }
  return (
    <input
      type="date"
      className={`inotes-in inotes-in--date ${className}${
        invalid ? " is-invalid" : ""
      }`.trim()}
      value={toDateInputValue(value)}
      onChange={(e) => onChange?.(fromDateInputValue(e.target.value))}
    />
  );
};

const TimeInput = ({
  value,
  onChange,
  readOnly,
  className = "",
  invalid = false,
}) => {
  if (readOnly) {
    return (
      <span className={`inotes-ro ${className}`.trim()}>{display(value)}</span>
    );
  }
  return (
    <input
      type="time"
      className={`inotes-in inotes-in--time ${className}${
        invalid ? " is-invalid" : ""
      }`.trim()}
      value={toTimeInputValue(value)}
      onChange={(e) => onChange?.(e.target.value)}
    />
  );
};

const YesNo = ({ value, onChange, readOnly, invalid }) => (
  <span className="inotes-yesno">
    {YES_NO.map((opt) => {
      const selected = String(value ?? "").trim() === opt;
      return (
        <CheckLabel
          key={opt}
          small
          checked={selected}
          disabled={readOnly}
          invalid={invalid}
          onToggle={() => onChange?.(selected ? "" : opt)}
        >
          {opt.toUpperCase()}
        </CheckLabel>
      );
    })}
  </span>
);

const ActivityItem = ({ item, values, canEdit, invalid, onToggle }) => {
  const checked = isChecked(values[item.key]);
  const rowEditable = canEdit(item.key);
  return (
    <div
      className={`inotes-check-item${rowEditable ? " is-clickable" : ""}`}
      onClick={() => {
        if (!rowEditable) return;
        onToggle(item.key, !checked);
      }}
      onKeyDown={(e) => {
        if (!rowEditable) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle(item.key, !checked);
        }
      }}
      role={rowEditable ? "button" : undefined}
      tabIndex={rowEditable ? 0 : undefined}
    >
      <MarkBox
        checked={checked}
        disabled={!rowEditable}
        invalid={invalid.has(item.key)}
        onClick={() => onToggle(item.key, !checked)}
      />
      <span>
        {item.label}
        {item.options?.length
          ? item.options.map((option) => {
              const optKey = `${item.key}_${option.key}`;
              const on = isChecked(values[optKey]);
              const optEditable = canEdit(optKey) && checked;
              return (
                <span
                  key={option.key}
                  className={`inotes-subcheck${
                    optEditable ? " is-clickable" : ""
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!optEditable) return;
                    onToggle(optKey, !on);
                  }}
                >
                  {option.label}{" "}
                  <MarkBox
                    small
                    checked={on}
                    disabled={!optEditable}
                    invalid={invalid.has(optKey)}
                    onClick={() => onToggle(optKey, !on)}
                  />
                </span>
              );
            })
          : null}
      </span>
    </div>
  );
};

const AttachImage = ({
  fieldKey,
  value,
  editable,
  onChange,
  fetchAttachmentBlob,
}) => {
  const inputRef = useRef(null);
  const [localError, setLocalError] = useState("");
  const [remotePreview, setRemotePreview] = useState("");
  const meta = value && typeof value === "object" ? value : null;
  const fileName = meta?.fileName || "";
  const purpose = meta?.purpose || fieldKey;
  const localPreview =
    meta?.dataUrl && String(meta.dataUrl).startsWith("data:image/")
      ? meta.dataUrl
      : "";

  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";
    setRemotePreview("");

    if (localPreview || !meta?.s3Key || !fetchAttachmentBlob) {
      return undefined;
    }

    (async () => {
      try {
        const blob = await fetchAttachmentBlob(purpose);
        if (cancelled || !blob) return;
        const type = String(blob.type || "").toLowerCase();
        if (type && !type.startsWith("image/")) return;
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setRemotePreview(objectUrl);
        else URL.revokeObjectURL(objectUrl);
      } catch {
        if (!cancelled) setRemotePreview("");
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [localPreview, meta?.s3Key, purpose, fetchAttachmentBlob]);

  const previewSrc = localPreview || remotePreview;

  const pickFile = (file) => {
    setLocalError("");
    if (!file) return;
    const type = String(file.type || "").toLowerCase();
    const nameOk = /\.(png|jpe?g)$/i.test(file.name || "");
    if (!["image/png", "image/jpeg", "image/jpg"].includes(type) && !nameOk) {
      setLocalError("Use PNG or JPEG.");
      return;
    }
    if (file.size > FILE_MAX_BYTES) {
      setLocalError("Max 10 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      onChange?.({
        dataUrl: String(reader.result || ""),
        fileName: file.name,
        contentType: file.type || "image/jpeg",
        size: file.size,
        purpose: fieldKey,
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="inotes-attach-file">
      {previewSrc ? (
        <img className="inotes-attach-preview" src={previewSrc} alt={fileName} />
      ) : null}
      {fileName ? <div className="inotes-attach-name">{fileName}</div> : null}
      {localError ? <div className="inotes-error">{localError}</div> : null}
      {editable ? (
        <div className="inotes-attach-actions">
          <Button
            variant="secondary"
            type="button"
            onClick={() => inputRef.current?.click()}
          >
            {fileName ? "Replace" : "Upload"}
          </Button>
          {fileName ? (
            <Button variant="ghost" type="button" onClick={() => onChange?.("")}>
              Remove
            </Button>
          ) : null}
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,.png,.jpg,.jpeg"
            className="inotes-file-hidden"
            onChange={(e) => {
              pickFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
      ) : null}
    </div>
  );
};

/**
 * Inspection Notes fill UI — matches
 * `templates/inspectionNotes.html` (AQCTA-FOR-06-07).
 */
export default function InspectionNotesForm({
  values = {},
  onChange,
  readOnly = false,
  invalidKeys = [],
  editableKeys = [],
  repeatableRows = {},
  onAddRow,
  onRemoveRow,
  attachmentUrlFor,
  fetchAttachmentBlob,
}) {
  const invalid = new Set(invalidKeys);
  const editable = useMemo(() => new Set(editableKeys), [editableKeys]);
  /* Bound fields follow editableKeys; repeatable rows follow !readOnly. */
  const canEditField = (key) => {
    if (readOnly) return false;
    if (!editableKeys?.length) return true;
    return editable.has(key);
  };
  const canEditRepeatable = !readOnly;

  const [localRows, setLocalRows] = useState({
    custom_activities: 0,
    testing_equipment: 0,
    attachments: 0,
  });

  const setField = (key, value) => onChange?.(key, value);

  const visitTypes = asList(values.visitTypes);
  const toggleVisit = (opt) => {
    if (!canEditField("visitTypes")) return;
    const next = visitTypes.includes(opt)
      ? visitTypes.filter((x) => x !== opt)
      : [...visitTypes, opt];
    setField("visitTypes", next);
  };

  const activityEditable = (key) => {
    if (readOnly) return false;
    if (!editableKeys?.length) return true;
    return editable.has(key);
  };

  const toggleActivity = (key, nextChecked) => {
    if (!activityEditable(key)) return;
    setField(key, nextChecked ? "true" : "");
    if (!nextChecked) {
      const parent = LEFT_ACTIVITIES.concat(RIGHT_ACTIVITIES).find(
        (item) => item.key === key,
      );
      (parent?.options || []).forEach((option) => {
        const optKey = `${key}_${option.key}`;
        if (values[optKey]) setField(optKey, "");
      });
    }
  };

  const customCount = Math.max(
    repeatableRows.custom_activities || 0,
    localRows.custom_activities || 0,
    deriveRowCount(values, "customAct", ["label"], 15),
  );
  const equipCount = Math.max(
    repeatableRows.testing_equipment || 0,
    localRows.testing_equipment || 0,
    deriveRowCount(
      values,
      "equip",
      ["name", "modelNo", "serialNo", "calibrationDueDate", "ownership"],
      12,
    ),
  );
  const attachCount = Math.max(
    repeatableRows.attachments || 0,
    localRows.attachments || 0,
    deriveRowCount(values, "attach", ["text", "file"], 20),
  );

  const equipRows = Math.min(Math.max(equipCount, 0), 12);
  const attachRows = Math.min(Math.max(attachCount, 0), 20);
  const customRows = Math.min(customCount, 15);

  const addSection = (sectionKey) => {
    if (onAddRow) {
      onAddRow(sectionKey);
      return;
    }
    setLocalRows((prev) => {
      const caps = {
        custom_activities: 15,
        testing_equipment: 12,
        attachments: 20,
      };
      const current =
        sectionKey === "custom_activities"
          ? customCount
          : sectionKey === "testing_equipment"
            ? equipCount
            : attachCount;
      const next = Math.min(current + 1, caps[sectionKey] || 20);
      return { ...prev, [sectionKey]: next };
    });
  };

  const removeSection = (sectionKey, index) => {
    if (sectionKey === "testing_equipment") {
      const fields = [
        "name",
        "modelNo",
        "serialNo",
        "calibrationDueDate",
        "ownership",
      ];
      const total = equipRows;
      if (index < 1 || index > total) return;

      /* Shift later rows up so the table can shrink below 4 cleanly. */
      for (let i = index; i < total; i += 1) {
        fields.forEach((f) => {
          setField(`equip_${i}_${f}`, values[`equip_${i + 1}_${f}`] ?? "");
        });
      }
      fields.forEach((f) => setField(`equip_${total}_${f}`, ""));

      if (onRemoveRow) {
        onRemoveRow(sectionKey, total);
      } else {
        setLocalRows((prev) => ({
          ...prev,
          testing_equipment: Math.max(total - 1, 0),
        }));
      }
      return;
    }

    if (sectionKey === "attachments") {
      const total = attachRows;
      if (index < 1 || index > total) return;

      for (let i = index; i < total; i += 1) {
        setField(`attach_${i}_text`, values[`attach_${i + 1}_text`] ?? "");
        setField(`attach_${i}_file`, values[`attach_${i + 1}_file`] ?? "");
      }
      setField(`attach_${total}_text`, "");
      setField(`attach_${total}_file`, "");

      if (onRemoveRow) {
        onRemoveRow(sectionKey, total);
      } else {
        setLocalRows((prev) => ({
          ...prev,
          attachments: Math.max(total - 1, 0),
        }));
      }
      return;
    }

    if (onRemoveRow) {
      onRemoveRow(sectionKey, index);
      return;
    }
    if (sectionKey === "custom_activities") {
      setField(`customAct_${index}_label`, "");
    }
    setLocalRows((prev) => ({
      ...prev,
      [sectionKey]: Math.max((prev[sectionKey] || 0) - 1, 0),
    }));
  };

  return (
    <div className="inotes-root">
      {/* —— Page 1: General / Summary —— */}
      <section className="inotes-page">
        <div className="inotes-header">
          <div className="inotes-logo-cell">
            <img className="inotes-logo" src={PCI_LOGO_SRC} alt="AQCTA logo" />
          </div>
          <div className="inotes-header-main">
            <div className="inotes-group">INSPECTION GROUP</div>
            <div className="inotes-title">INSPECTION NOTES</div>
          </div>
          <div className="inotes-header-meta">
            <div>Doc No :</div>
            <div>Page :&nbsp;&nbsp;&nbsp;&nbsp; of</div>
            <div>
              Report No.:{" "}
              <LineInput
                className="inotes-in--inline"
                value={values.reportNo}
                readOnly={!canEditField("reportNo")}
                invalid={invalid.has("reportNo")}
                placeholder=""
                onChange={(v) => setField("reportNo", v)}
              />
            </div>
            <div>Project No.: {display(values.projectNo)}</div>
          </div>
        </div>
        <div className="inotes-doc-stamp">AQCTA-FOR-06-07</div>

        <div className="inotes-section-title">GENERAL</div>
        <div className="inotes-box">
          <div className="inotes-line">
            INSPECTOR: {display(values.inspector)}
          </div>
          <div className="inotes-line inotes-line--wrap">
            TYPE OF VISIT:
            {VISIT_TYPE_OPTIONS.map((opt) => (
              <CheckLabel
                key={opt}
                small
                checked={visitTypes.includes(opt)}
                disabled={!canEditField("visitTypes")}
                invalid={invalid.has("visitTypes")}
                onToggle={() => toggleVisit(opt)}
              >
                {opt}
              </CheckLabel>
            ))}
          </div>
        </div>

        <div className="inotes-section-title">CLIENT/PROJECT INFORMATION</div>
        <div className="inotes-box inotes-two-col">
          <div>
            <div className="inotes-line">CLIENT: {display(values.client)}</div>
            <div className="inotes-line">CONTACT: {display(values.contact)}</div>
          </div>
          <div>
            <div className="inotes-line">
              PROJECT REF.: {display(values.projectRef)}
            </div>
            <div className="inotes-line">
              PO NO.:{" "}
              <LineInput
                value={values.poNo}
                readOnly={!canEditField("poNo")}
                invalid={invalid.has("poNo")}
                placeholder="Client PO number"
                onChange={(v) => setField("poNo", v)}
              />
            </div>
          </div>
        </div>

        <div className="inotes-section-title">EQUIPMENT/MATERIAL DESCRIPTION</div>
        <div className="inotes-box inotes-large-box">
          DESCRIPTION:
          <br />
          <LineInput
            multiline
            rows={3}
            value={values.description}
            readOnly={!canEditField("description")}
            invalid={invalid.has("description")}
            onChange={(v) => setField("description", v)}
          />
        </div>

        <div className="inotes-section-title">SUMMARY</div>
        <div className="inotes-box inotes-summary">
          <div className="inotes-summary-row inotes-summary-row--split">
            <div className="inotes-summary-cell">
              DATE OF LAST VISIT:{" "}
              <DateInput
                className="inotes-in--inline"
                value={values.lastVisitDate}
                readOnly={!canEditField("lastVisitDate")}
                onChange={(v) => setField("lastVisitDate", v)}
              />
            </div>
            <div className="inotes-summary-cell">
              DATE(S) OF THIS VISIT:{" "}
              <TimeInput
                className="inotes-in--inline"
                value={values.visitDates}
                readOnly={!canEditField("visitDates")}
                invalid={invalid.has("visitDates")}
                onChange={(v) => setField("visitDates", v)}
              />
            </div>
          </div>
          <div className="inotes-summary-row inotes-summary-row--split">
            <div className="inotes-summary-cell">
              LAST INSPECTOR:{" "}
              <LineInput
                className="inotes-in--inline"
                value={values.lastInspector}
                readOnly={!canEditField("lastInspector")}
                onChange={(v) => setField("lastInspector", v)}
              />
            </div>
            <div className="inotes-summary-cell">
              NEXT SCHEDULE VISIT:{" "}
              <LineInput
                className="inotes-in--inline"
                value={values.nextVisit}
                readOnly={!canEditField("nextVisit")}
                onChange={(v) => setField("nextVisit", v)}
              />
            </div>
          </div>
          <div className="inotes-summary-row">
            <div className="inotes-summary-cell inotes-summary-cell--wrap">
              NON-CONFORMITY REPORT ISSUED DURING THIS VISIT:
              <YesNo
                value={values.ncrIssued}
                readOnly={!canEditField("ncrIssued")}
                invalid={invalid.has("ncrIssued")}
                onChange={(v) => {
                  setField("ncrIssued", v);
                  if (v !== "Yes") setField("ncrNumber", "");
                }}
              />{" "}
              NCR NO.:{" "}
              <LineInput
                className="inotes-in--inline"
                value={values.ncrNumber}
                readOnly={
                  !canEditField("ncrNumber") || values.ncrIssued !== "Yes"
                }
                onChange={(v) => setField("ncrNumber", v)}
              />
            </div>
          </div>
          <div className="inotes-summary-row">
            <div className="inotes-summary-cell inotes-summary-cell--wrap">
              OUTSTANDING NON-CONFORMITY REPORT:
              <YesNo
                value={values.outstandingNcr}
                readOnly={!canEditField("outstandingNcr")}
                invalid={invalid.has("outstandingNcr")}
                onChange={(v) => {
                  setField("outstandingNcr", v);
                  if (v !== "Yes") setField("outstandingNumber", "");
                }}
              />{" "}
              NCR NO.:{" "}
              <LineInput
                className="inotes-in--inline"
                value={values.outstandingNumber}
                readOnly={
                  !canEditField("outstandingNumber") ||
                  values.outstandingNcr !== "Yes"
                }
                onChange={(v) => setField("outstandingNumber", v)}
              />
            </div>
          </div>
          <div className="inotes-summary-row">
            <div className="inotes-summary-cell inotes-summary-cell--wrap">
              INSPECTION RELEASE ISSUED DURING THIS VISIT:
              <YesNo
                value={values.releaseIssued}
                readOnly={!canEditField("releaseIssued")}
                invalid={invalid.has("releaseIssued")}
                onChange={(v) => {
                  setField("releaseIssued", v);
                  if (v !== "Yes") setField("releaseNumber", "");
                }}
              />{" "}
              NCR NO.:{" "}
              <LineInput
                className="inotes-in--inline"
                value={values.releaseNumber}
                readOnly={
                  !canEditField("releaseNumber") ||
                  values.releaseIssued !== "Yes"
                }
                onChange={(v) => setField("releaseNumber", v)}
              />
            </div>
          </div>
          <div className="inotes-summary-row inotes-summary-row--action">
            <div className="inotes-summary-cell">
              ACTION POINTS: (NCR’S, clarifications, pending approvals, etc.)
              <br />
              <LineInput
                multiline
                rows={3}
                value={values.actionPoints}
                readOnly={!canEditField("actionPoints")}
                onChange={(v) => setField("actionPoints", v)}
              />
            </div>
          </div>
        </div>

        <div className="inotes-signature">
          <div>
            INSPECTOR’S SIGNATURE: {display(values.inspectorName) || "—"}
          </div>
          <div>DATE: {display(values.signatureDate) || "—"}</div>
        </div>
      </section>

      {/* —— Page 2: Activities / Equipment / Attachments —— */}
      <section className="inotes-page">
        <div className="inotes-page2-head">INSPECTION ACTIVITIES</div>
        <div className="inotes-activity-intro">
          1. INSPECTION ACTIVITIES IDENTIFICATION: (Place a ✓ mark in each of
          the boxes that corresponds with an inspection activities verified or
          performed. Each activity marked must be fully explained below at
          section 3. “Inspection Details”.)
        </div>
        <div className="inotes-activity-grid">
          <div className="inotes-activity-col">
            {LEFT_ACTIVITIES.map((item) => (
              <ActivityItem
                key={item.key}
                item={item}
                values={values}
                canEdit={activityEditable}
                invalid={invalid}
                onToggle={toggleActivity}
              />
            ))}
            {Array.from({ length: customRows }, (_, i) => i + 1).map((index) => {
              const key = `customAct_${index}_label`;
              return (
                <div className="inotes-check-item" key={key}>
                  <MarkBox checked disabled />
                  {canEditRepeatable ? (
                    <>
                      <input
                        type="text"
                        className="inotes-in inotes-in--grow"
                        value={values[key] || ""}
                        placeholder="Additional activity…"
                        onChange={(e) => setField(key, e.target.value)}
                      />
                      <button
                        type="button"
                        className="inotes-icon-btn"
                        aria-label={`Remove activity ${index}`}
                        onClick={() =>
                          removeSection("custom_activities", index)
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  ) : (
                    <span>{display(values[key])}</span>
                  )}
                </div>
              );
            })}
            {canEditRepeatable && customRows < 15 ? (
              <Button
                variant="secondary"
                type="button"
                onClick={() => addSection("custom_activities")}
              >
                <Plus size={14} /> Add activity
              </Button>
            ) : null}
          </div>
          <div className="inotes-activity-col">
            {RIGHT_ACTIVITIES.map((item) => (
              <ActivityItem
                key={item.key}
                item={item}
                values={values}
                canEdit={activityEditable}
                invalid={invalid}
                onToggle={toggleActivity}
              />
            ))}
          </div>
        </div>

        <div className="inotes-section-block">
          <div className="inotes-section-heading">
            2. REFERENCE DRAWINGS / SPECIFICATIONS: (include revision no.&apos;s)
          </div>
          <div className="inotes-blank-area">
            <LineInput
              multiline
              rows={3}
              value={values.references}
              readOnly={!canEditField("references")}
              onChange={(v) => setField("references", v)}
            />
          </div>
        </div>

        <div className="inotes-section-block">
          <div className="inotes-section-heading">
            3. INSPECTION ACTIVITIES: (Provide complete details of activities
            performed and tests witnessed, as per section (a) above including
            any activities/inspections that are not listed. Use continuation
            pages as necessary).
          </div>
          <div className="inotes-blank-area" style={{ minHeight: "18mm" }}>
            <LineInput
              multiline
              rows={4}
              value={values.inspectionActivities}
              readOnly={!canEditField("inspectionActivities")}
              invalid={invalid.has("inspectionActivities")}
              onChange={(v) => setField("inspectionActivities", v)}
            />
          </div>
        </div>

        <div className="inotes-section-block">
          <div className="inotes-section-heading">
            4. TESTING EQUIPMENT &amp; CALIBRATION STATUS
          </div>
          <table className="inotes-equipment">
            <colgroup>
              <col className="inotes-equip-col-no" />
              <col className="inotes-equip-col-name" />
              <col className="inotes-equip-col-model" />
              <col className="inotes-equip-col-serial" />
              <col className="inotes-equip-col-cal" />
              <col className="inotes-equip-col-own" />
            </colgroup>
            <thead>
              <tr>
                <th>No.</th>
                <th>Name of Equipment</th>
                <th>Model No</th>
                <th>Serial No</th>
                <th>
                  Calibration
                  <br />
                  Due Date
                </th>
                <th>
                  Ownership of
                  <br />
                  Equipment
                </th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: equipRows }, (_, i) => i + 1).map(
                (index) => (
                  <tr key={index}>
                    <td>{index}</td>
                    {[
                      "name",
                      "modelNo",
                      "serialNo",
                      "calibrationDueDate",
                      "ownership",
                    ].map((f) => {
                      const key = `equip_${index}_${f}`;
                      return (
                        <td key={f}>
                          <div className="inotes-equip-cell">
                            {f === "calibrationDueDate" ? (
                              <DateInput
                                value={values[key]}
                                readOnly={!canEditRepeatable}
                                onChange={(v) => setField(key, v)}
                              />
                            ) : f === "ownership" ? (
                              canEditRepeatable ? (
                                <div className="inotes-ownership-dd">
                                  <DropdownBasic
                                    options={OWNERSHIP_OPTIONS.map((opt) => ({
                                      value: opt,
                                      label: opt,
                                    }))}
                                    value={display(values[key])}
                                    onChange={(val) =>
                                      setField(key, val || "")
                                    }
                                    placeholder="Select…"
                                    isClearable
                                    sortOptions={false}
                                    size="sm"
                                    appearance="document"
                                    width="100%"
                                  />
                                </div>
                              ) : (
                                <span className="inotes-ro">
                                  {display(values[key])}
                                </span>
                              )
                            ) : (
                              <LineInput
                                value={values[key]}
                                readOnly={!canEditRepeatable}
                                onChange={(v) => setField(key, v)}
                              />
                            )}
                            {f === "ownership" && canEditRepeatable ? (
                              <button
                                type="button"
                                className="inotes-icon-btn"
                                aria-label={`Remove equipment ${index}`}
                                onClick={() =>
                                  removeSection("testing_equipment", index)
                                }
                              >
                                <Trash2 size={14} />
                              </button>
                            ) : null}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ),
              )}
            </tbody>
          </table>
          {canEditRepeatable && equipRows < 12 ? (
            <div className="inotes-row-actions">
              <Button
                variant="secondary"
                type="button"
                onClick={() => addSection("testing_equipment")}
              >
                <Plus size={14} /> Add equipment
              </Button>
            </div>
          ) : null}
        </div>

        <div className="inotes-attach">
          <b>5. ATTACHMENTS:</b> (Each attachment must reference the
          corresponding Attachment no., AQCTA / Project No., and client’s PO
          No.)
          {attachRows > 0 ? (
            <div className="inotes-attach-grid">
              {Array.from({ length: attachRows }, (_, i) => i + 1).map(
                (index) => {
                  const textKey = `attach_${index}_text`;
                  const fileKey = `attach_${index}_file`;
                  return (
                    <div key={index} className="inotes-attach-cell">
                      <div className="inotes-attach-num">{index}.</div>
                      <LineInput
                        value={values[textKey]}
                        readOnly={!canEditRepeatable}
                        placeholder="Description / reference"
                        onChange={(v) => setField(textKey, v)}
                      />
                      <AttachImage
                        fieldKey={fileKey}
                        value={values[fileKey]}
                        editable={canEditRepeatable}
                        fetchAttachmentBlob={fetchAttachmentBlob}
                        onChange={(v) => setField(fileKey, v)}
                      />
                      {canEditRepeatable ? (
                        <button
                          type="button"
                          className="inotes-icon-btn"
                          aria-label={`Remove attachment ${index}`}
                          onClick={() => removeSection("attachments", index)}
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : null}
                    </div>
                  );
                },
              )}
            </div>
          ) : null}
          {canEditRepeatable && attachRows < 20 ? (
            <div className="inotes-row-actions">
              <Button
                variant="secondary"
                type="button"
                onClick={() => addSection("attachments")}
              >
                <Plus size={14} /> Add attachment
              </Button>
            </div>
          ) : null}
        </div>
      </section>

      {/* —— Page 3: Continuation —— */}
      <section className="inotes-page">
        <div className="inotes-continued-head">
          INSPECTION ACTIVITIES - CONTINUED
        </div>
        <div className="inotes-continued-box">
          <LineInput
            multiline
            rows={12}
            value={values.continuationDetails}
            readOnly={!canEditField("continuationDetails")}
            onChange={(v) => setField("continuationDetails", v)}
          />
        </div>
      </section>
    </div>
  );
}
