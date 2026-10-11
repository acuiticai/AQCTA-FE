import React from "react";

const PCI_LOGO_SRC = `${process.env.PUBLIC_URL || ""}/aqcta-logo.png`;

const REQUIRED_OPTIONS = ["Yes", "No"];
const AVAILABILITY_OPTIONS = ["Own", "Client", "Contractor"];

const EQUIPMENT = [
  { key: "eq_thermography", label: "Infrared Thermography" },
  { key: "eq_thermometer", label: "Infrared Thermometer" },
  { key: "eq_ultrasonic", label: "Ultrasonic Thickness Flaw Detector" },
  { key: "eq_clamp", label: "Current Clamp Meter" },
  { key: "eq_others", label: "Others", hasSpecify: true },
];

const TOOLS = [
  { key: "tool_calliper", label: "Digital Calliper" },
  { key: "tool_welding_gauge", label: "Welding Gauge" },
  { key: "tool_stopwatch", label: "Stop Watch" },
  { key: "tool_mirror", label: "Inspection Mirror" },
  { key: "tool_torch", label: "Torch Light" },
  { key: "tool_ruler", label: "Steel Ruler / Measuring Tape" },
  { key: "tool_others", label: "Others", hasSpecify: true },
];

const ADDITIONAL = [
  { key: "add_inspector_stamp", label: "Inspector Stamp" },
  { key: "add_hard_stamp", label: "Hard Stamp" },
  { key: "add_others", label: "Others", hasSpecify: true },
];

const display = (value) => String(value ?? "").trim();

/** Circle-style Yes/No or Own/Client/Contractor — matches the PDF. */
const CircleChoice = ({
  value,
  options,
  onChange,
  readOnly,
  invalid,
}) => {
  const selected = String(value ?? "").trim();
  return (
    <span className={`iprep-choice${invalid ? " is-invalid" : ""}`}>
      {options.map((option, index) => (
        <React.Fragment key={option}>
          {index > 0 ? <span className="iprep-sep"> / </span> : null}
          <button
            type="button"
            className={`iprep-opt${selected === option ? " is-selected" : ""}`}
            disabled={readOnly}
            aria-pressed={selected === option}
            onClick={() => {
              if (readOnly) return;
              onChange?.(selected === option ? "" : option);
            }}
          >
            {option}
          </button>
        </React.Fragment>
      ))}
    </span>
  );
};

/**
 * Checklist for Preparation of Inspection — matches
 * `templates/inspectionPreparationChecklist.html` (AQCTA-FOR-06-07-03).
 */
export default function InspectionPreparationForm({
  values = {},
  onChange,
  readOnly = false,
  invalidKeys = [],
  editableKeys = [],
}) {
  const invalid = new Set(invalidKeys);
  const editable = new Set(editableKeys);
  const canEdit = (key) => !readOnly && editable.has(key);
  const setField = (key, value) => onChange?.(key, value);

  const renderRequiredAvailabilityRows = (items) =>
    items.map((item, index) => {
      const requiredKey = `${item.key}_required`;
      const availabilityKey = `${item.key}_availability`;
      const specifyKey = `${item.key}_specify`;
      const required = String(values[requiredKey] ?? "").trim();
      const showAvailability = required === "Yes";

      return (
        <tr
          key={item.key}
          className={item.hasSpecify ? "iprep-others-row" : undefined}
        >
          <td className="iprep-num">{index + 1}</td>
          <td className="iprep-item-name">
            {item.hasSpecify ? (
              <>
                Others:{" "}
                {canEdit(specifyKey) ? (
                  <input
                    type="text"
                    className={`iprep-specify${
                      invalid.has(specifyKey) ? " is-invalid" : ""
                    }`}
                    value={values[specifyKey] || ""}
                    placeholder="Please specify"
                    onChange={(e) => setField(specifyKey, e.target.value)}
                  />
                ) : (
                  <span className="iprep-specify iprep-field-ro">
                    {display(values[specifyKey])}
                  </span>
                )}
              </>
            ) : (
              item.label
            )}
          </td>
          <td className="iprep-required">
            <CircleChoice
              value={values[requiredKey]}
              options={REQUIRED_OPTIONS}
              readOnly={!canEdit(requiredKey)}
              invalid={invalid.has(requiredKey)}
              onChange={(v) => {
                setField(requiredKey, v);
                if (v !== "Yes" && values[availabilityKey]) {
                  setField(availabilityKey, "");
                }
              }}
            />
          </td>
          <td className="iprep-availability">
            {showAvailability || values[availabilityKey] ? (
              <CircleChoice
                value={values[availabilityKey]}
                options={AVAILABILITY_OPTIONS}
                readOnly={!canEdit(availabilityKey) || !showAvailability}
                invalid={invalid.has(availabilityKey)}
                onChange={(v) => setField(availabilityKey, v)}
              />
            ) : (
              <span className="iprep-availability-empty">&nbsp;</span>
            )}
          </td>
        </tr>
      );
    });

  const renderRequiredOnlyRows = (items) =>
    items.map((item, index) => {
      const requiredKey = `${item.key}_required`;
      const specifyKey = `${item.key}_specify`;

      return (
        <tr
          key={item.key}
          className={item.hasSpecify ? "iprep-others-row" : undefined}
        >
          <td className="iprep-num">{index + 1}</td>
          <td className="iprep-item-name">
            {item.hasSpecify ? (
              <>
                Others:{" "}
                {canEdit(specifyKey) ? (
                  <input
                    type="text"
                    className={`iprep-specify${
                      invalid.has(specifyKey) ? " is-invalid" : ""
                    }`}
                    value={values[specifyKey] || ""}
                    placeholder="Please specify"
                    onChange={(e) => setField(specifyKey, e.target.value)}
                  />
                ) : (
                  <span className="iprep-specify iprep-field-ro">
                    {display(values[specifyKey])}
                  </span>
                )}
              </>
            ) : (
              item.label
            )}
          </td>
          <td className="iprep-required">
            <CircleChoice
              value={values[requiredKey]}
              options={REQUIRED_OPTIONS}
              readOnly={!canEdit(requiredKey)}
              invalid={invalid.has(requiredKey)}
              onChange={(v) => setField(requiredKey, v)}
            />
          </td>
        </tr>
      );
    });

  return (
    <div className="iprep-page">
      <header className="iprep-header">
        <img className="iprep-logo" src={PCI_LOGO_SRC} alt="AQCTA logo" />
        <div className="iprep-title">
          Checklist for Preparation of Inspection
          <br />
          (Test Equipment &amp; Hand Tools)
        </div>
        <div className="iprep-form-code">AQCTA-FOR-06-07-03</div>
      </header>

      <table className="iprep-project-table">
        <tbody>
          <tr>
            <td>Project :</td>
            <td>{display(values.project)}</td>
          </tr>
          <tr>
            <td>Client:</td>
            <td>{display(values.client)}</td>
          </tr>
          <tr>
            <td>Inspection Date:</td>
            <td>
              {canEdit("inspectionDate") ? (
                <input
                  type="text"
                  className={`iprep-date-in${
                    invalid.has("inspectionDate") ? " is-invalid" : ""
                  }`}
                  value={values.inspectionDate || ""}
                  placeholder="dd/mm/yyyy"
                  onChange={(e) => setField("inspectionDate", e.target.value)}
                />
              ) : (
                display(values.inspectionDate)
              )}
            </td>
          </tr>
        </tbody>
      </table>

      <section className="iprep-section">
        <div className="iprep-section-heading">
          <div className="iprep-section-name">Test Equipment Required:</div>
          <div className="iprep-section-note">
            (Please circle where applicable)
          </div>
        </div>
        <table className="iprep-checklist iprep-equipment">
          <thead>
            <tr>
              <th className="iprep-num">No.</th>
              <th className="iprep-item-name">Name of Equipment</th>
              <th className="iprep-required">Required?</th>
              <th className="iprep-availability">Availability of Equipment</th>
            </tr>
          </thead>
          <tbody>{renderRequiredAvailabilityRows(EQUIPMENT)}</tbody>
        </table>
      </section>

      <section className="iprep-section">
        <div className="iprep-section-heading">
          <div className="iprep-section-name">Hand Tools:</div>
          <div className="iprep-section-note">
            (Please circle where applicable)
          </div>
        </div>
        <table className="iprep-checklist iprep-tools">
          <thead>
            <tr>
              <th className="iprep-num">No.</th>
              <th className="iprep-item-name">Name of Tools</th>
              <th className="iprep-required">Required?</th>
              <th className="iprep-availability">Availability of Tools</th>
            </tr>
          </thead>
          <tbody>{renderRequiredAvailabilityRows(TOOLS)}</tbody>
        </table>
      </section>

      <section className="iprep-section">
        <div className="iprep-section-heading">
          <div className="iprep-section-name">Additional Items:</div>
          <div className="iprep-section-note">
            (Please circle where applicable)
          </div>
        </div>
        <table className="iprep-checklist iprep-additional">
          <thead>
            <tr>
              <th className="iprep-num">No.</th>
              <th className="iprep-item-name">Name of Items</th>
              <th className="iprep-required">Required?</th>
            </tr>
          </thead>
          <tbody>{renderRequiredOnlyRows(ADDITIONAL)}</tbody>
        </table>
      </section>

      <div className="iprep-inspector-block">
        <div className="iprep-inspector">Inspector:</div>
        <div className="iprep-signature">
          <div className="iprep-signature-row">
            <span className="iprep-signature-label">Name</span>
            <span className="iprep-colon">:</span>
            <span className="iprep-line">
              {display(values.inspectorName) || "—"}
            </span>
          </div>
          <div className="iprep-signature-row">
            <span className="iprep-signature-label">Date</span>
            <span className="iprep-colon">:</span>
            <span className="iprep-line">
              {display(values.inspectorDate) || "—"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
