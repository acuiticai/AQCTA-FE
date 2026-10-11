import React, { useMemo } from "react";
import Combobox from "@/customer/components/ui/Combobox";

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

const INSPECTION_TYPE_OPTIONS = [
  "Initial Inspection",
  "Surveillance Inspection",
  "Final Inspection",
  "Witness Inspection",
  "Follow-up Inspection",
  "Special Inspection",
];

const display = (value) => String(value ?? "").trim();

const isChecked = (value) => {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  return raw === "true" || raw === "yes" || raw === "1" || raw === "x";
};

/** HTML date inputs need YYYY-MM-DD; resolved form values are often dd/mm/yyyy. */
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

/** Persist dates as dd/mm/yyyy to match PDF / resolveAllValues. */
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

const companyAddressContact = (values = {}) =>
  [
    values.companyName,
    values.companyAddress,
    values.contactPerson ? `Attn: ${values.contactPerson}` : "",
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(", ");

const MarkBox = ({ checked, onClick, disabled, mini = false, invalid }) => (
  <button
    type="button"
    className={`${mini ? "ipn-mini-box" : "ipn-box"}${
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

const ActivityRow = ({
  item,
  values,
  canEdit,
  invalid,
  onToggle,
}) => {
  const checked = isChecked(values[item.key]);
  const rowEditable = canEdit(item.key);
  return (
    <div
      className={`ipn-activity${rowEditable ? " is-clickable" : ""}`}
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
      <span className="ipn-activity-text">
        {item.label}
        {item.options?.length ? (
          <span className="ipn-sub-options">
            {item.options.map((option) => {
              const optKey = `${item.key}_${option.key}`;
              const optChecked = isChecked(values[optKey]);
              const optEditable = canEdit(optKey) && checked;
              return (
                <span
                  key={option.key}
                  className={`ipn-sub-option${
                    optEditable ? " is-clickable" : ""
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!optEditable) return;
                    onToggle(optKey, !optChecked);
                  }}
                >
                  <MarkBox
                    mini
                    checked={optChecked}
                    disabled={!optEditable}
                    invalid={invalid.has(optKey)}
                    onClick={() => onToggle(optKey, !optChecked)}
                  />
                  {option.label}
                </span>
              );
            })}
          </span>
        ) : null}
      </span>
    </div>
  );
};

/**
 * Inspection Plan Notice fill UI — matches
 * `templates/inspectionPlanNotice.html` (AQCTA-FOR-06-07-02).
 */
export default function InspectionPlanNoticeForm({
  values = {},
  onChange,
  readOnly = false,
  invalidKeys = [],
  editableKeys = [],
  inspectionTypeOptions = [],
}) {
  const invalid = new Set(invalidKeys);
  const editable = new Set(editableKeys);
  const canEdit = (key) => !readOnly && editable.has(key);
  const setField = (key, value) => onChange?.(key, value);

  const typeOptions = useMemo(() => {
    const raw =
      Array.isArray(inspectionTypeOptions) && inspectionTypeOptions.length
        ? inspectionTypeOptions
        : INSPECTION_TYPE_OPTIONS;
    const mapped = raw
      .map((opt) =>
        typeof opt === "string"
          ? { value: opt, label: opt }
          : {
              value: String(opt?.value || opt?.label || "").trim(),
              label: String(opt?.label || opt?.value || "").trim(),
            },
      )
      .filter((opt) => opt.value);
    const current = display(values.inspectionType);
    if (current && !mapped.some((opt) => opt.value === current)) {
      mapped.unshift({ value: current, label: current });
    }
    return mapped.length
      ? mapped
      : INSPECTION_TYPE_OPTIONS.map((v) => ({ value: v, label: v }));
  }, [inspectionTypeOptions, values.inspectionType]);

  const toggle = (key, nextChecked) => {
    if (!canEdit(key)) return;
    setField(key, nextChecked ? "true" : "");
    /* Clearing a parent activity clears its sub-options. */
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

  return (
    <div className="ipn-page">
      <div className="ipn-top">
        <img className="ipn-logo" src={PCI_LOGO_SRC} alt="AQCTA logo" />
        <div className="ipn-form-code">AQCTA-FOR-06-07-02</div>
      </div>

      <div className="ipn-meta">
        <div>
          <div className="ipn-meta-line">File No: {display(values.fileNo)}</div>
          <div className="ipn-meta-line">
            Date: {display(values.noticeDate)}
          </div>
        </div>
        <div>
          <div className="ipn-meta-line">Job No: {display(values.jobNo)}</div>
        </div>
      </div>

      <div className="ipn-recipient ipn-italic">
        ({companyAddressContact(values)})
      </div>
      <div className="ipn-recipient">Dear Sir/Madam,</div>

      <div className="ipn-title">INSPECTION PLAN NOTICE FOR INSPECTION</div>

      <div className="ipn-field-line">
        Type of Inspection:{" "}
        {canEdit("inspectionType") ? (
          <span
            className={`ipn-type-control${
              invalid.has("inspectionType") ? " is-invalid" : ""
            }`}
          >
            <Combobox
              value={values.inspectionType || ""}
              onChange={(v) => setField("inspectionType", v)}
              options={typeOptions}
              placeholder="Select type…"
              searchable={false}
              clearable
            />
          </span>
        ) : (
          display(values.inspectionType)
        )}
      </div>

      <div className="ipn-standard-line">
        Standard:{" "}
        {canEdit("standard") ? (
          <input
            type="text"
            className={`ipn-in${invalid.has("standard") ? " is-invalid" : ""}`}
            value={values.standard || ""}
            placeholder="e.g. ASME Section VIII Div. 1"
            onChange={(e) => setField("standard", e.target.value)}
          />
        ) : (
          display(values.standard)
        )}
      </div>

      <div className="ipn-intro">The above matter refers.</div>
      <div className="ipn-instruction">
        The tentative schedule and areas for inspection activities are as
        follows:
        <br />
        (Place a (✓) mark in each of the boxes that corresponds with an
        inspection activities verified or performed)
      </div>

      <div className="ipn-columns">
        <div>
          <div className="ipn-col-heading">
            <span>DATE:</span>{" "}
            <span className="ipn-value">
              {canEdit("scheduleDate") ? (
                <input
                  type="date"
                  className={`ipn-in ipn-in--compact ipn-in--date${
                    invalid.has("scheduleDate") ? " is-invalid" : ""
                  }`}
                  value={toDateInputValue(values.scheduleDate)}
                  onChange={(e) =>
                    setField("scheduleDate", fromDateInputValue(e.target.value))
                  }
                />
              ) : (
                display(values.scheduleDate)
              )}
            </span>
          </div>
          {LEFT_ACTIVITIES.map((item) => (
            <ActivityRow
              key={item.key}
              item={item}
              values={values}
              canEdit={canEdit}
              invalid={invalid}
              onToggle={toggle}
            />
          ))}
        </div>
        <div>
          <div className="ipn-col-heading">
            <span>
              TIME<sup>1</sup>:
            </span>{" "}
            <span className="ipn-value">
              {canEdit("scheduleTime") ? (
                <input
                  type="time"
                  className={`ipn-in ipn-in--compact ipn-in--time${
                    invalid.has("scheduleTime") ? " is-invalid" : ""
                  }`}
                  value={toTimeInputValue(values.scheduleTime)}
                  onChange={(e) => setField("scheduleTime", e.target.value)}
                />
              ) : (
                display(values.scheduleTime)
              )}
            </span>
          </div>
          {RIGHT_ACTIVITIES.map((item) => (
            <ActivityRow
              key={item.key}
              item={item}
              values={values}
              canEdit={canEdit}
              invalid={invalid}
              onToggle={toggle}
            />
          ))}
        </div>
      </div>

      <div className="ipn-closing">
        <div className="ipn-notice">
          Kindly confirm receipt of this notice by returning the slip below by
          fax. If no reply is received, we assume that you agree to the above
          arrangement.
        </div>
        <div className="ipn-thanks">Thank you.</div>
        <div className="ipn-thanks">Yours sincerely,</div>

        <div className="ipn-signature-block">
          <div className="ipn-signature-details">
            ({display(values.inspectorTitle) || "—"})
            <br />
            Inspector
            <br />
            Inspection Group
            <br />
            Inspection Section
            <br />
            Email:{" "}
            {canEdit("inspectorEmail") ? (
              <input
                type="text"
                className={`ipn-in ipn-in--email${
                  invalid.has("inspectorEmail") ? " is-invalid" : ""
                }`}
                value={values.inspectorEmail || ""}
                placeholder="e.g. aqctechnicalassessors@gmail.com"
                onChange={(e) => setField("inspectorEmail", e.target.value)}
              />
            ) : (
              display(values.inspectorEmail)
            )}
          </div>
          <div className="ipn-tel">
            Tel. No.:
            {canEdit("telephone") ? (
              <input
                type="text"
                className={`ipn-in ipn-in--tel${
                  invalid.has("telephone") ? " is-invalid" : ""
                }`}
                value={values.telephone || ""}
                placeholder="e.g. +60 12-745 9731"
                onChange={(e) => setField("telephone", e.target.value)}
              />
            ) : (
              display(values.telephone)
            )}
          </div>
        </div>

        <div className="ipn-note">
          (Note: If there is any objection to the assigned Inspector, the
          company is required to inform the Manager in writing).
        </div>

        <div className="ipn-ack">
          <div className="ipn-ack-title">ACKNOWLEDGEMENT OF RECEIPT</div>
          <div className="ipn-ack-grid">
            <div>
              <div className="ipn-ack-line">
                I confirm receipt of the above notice.
              </div>
              <div className="ipn-ack-line">Signature:</div>
              <div className="ipn-ack-line">Date:</div>
            </div>
            <div>
              <div className="ipn-ack-line">
                Name: {display(values.ackName)}
              </div>
              <div className="ipn-ack-line">
                Position:{" "}
                {canEdit("ackPosition") ? (
                  <input
                    type="text"
                    className={`ipn-in ipn-in--compact${
                      invalid.has("ackPosition") ? " is-invalid" : ""
                    }`}
                    value={values.ackPosition || ""}
                    placeholder="Customer contact position"
                    onChange={(e) => setField("ackPosition", e.target.value)}
                  />
                ) : (
                  display(values.ackPosition)
                )}
              </div>
            </div>
          </div>
          <div className="ipn-long-line" />
          <div className="ipn-footnote">
            <sup>1</sup> The time may be extended or shortened depending upon
            the inspection progress.
          </div>
        </div>
      </div>
    </div>
  );
}
