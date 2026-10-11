import React from "react";

const PCI_LOGO_SRC = `${process.env.PUBLIC_URL || ""}/aqcta-logo.png`;

const asList = (value) => {
  if (Array.isArray(value)) {
    return value.map((v) => String(v || "").trim()).filter(Boolean);
  }
  const raw = String(value ?? "").trim();
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
};

const display = (value) => String(value ?? "").trim();

/** PDF-style tick box — clickable when editable. */
const TickBox = ({ checked, onClick, disabled, invalid }) => (
  <button
    type="button"
    className={`eirc-checkbox${checked ? " is-checked" : ""}${
      invalid ? " is-invalid" : ""
    }`}
    aria-pressed={checked}
    disabled={disabled}
    onClick={onClick}
  >
    {checked ? "✓" : ""}
  </button>
);

const RadioPair = ({
  value,
  options,
  onChange,
  readOnly,
  invalid,
}) => (
  <div className="eirc-option-row">
    {options.map(([label, expected]) => (
      <span className="eirc-option-group" key={expected}>
        <span className="eirc-label">{label}</span>
        <TickBox
          checked={String(value ?? "").trim() === expected}
          disabled={readOnly}
          invalid={invalid}
          onClick={() => {
            if (readOnly) return;
            onChange?.(
              String(value ?? "").trim() === expected ? "" : expected,
            );
          }}
        />
      </span>
    ))}
  </div>
);

const LineInput = ({
  value,
  onChange,
  readOnly,
  placeholder = "",
  className = "eirc-long-field",
  invalid = false,
}) => {
  if (readOnly) {
    return (
      <span className={`${className} eirc-field-ro`}>
        {display(value)}
      </span>
    );
  }
  return (
    <input
      type="text"
      className={`${className}${invalid ? " is-invalid" : ""}`}
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => onChange?.(e.target.value)}
    />
  );
};

/**
 * Checklist for Review of Engineering Inspection — matches
 * `templates/engineeringInspectionReviewChecklist.html` (AQCTA-FOR-06-05).
 */
export default function EngineeringInspectionReviewForm({
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

  const ppeList = asList(values.ppe);
  const notifyList = asList(values.notifyCustomer);

  const toggleInList = (key, current, option) => {
    if (!canEdit(key)) return;
    const list = asList(current);
    const next = list.includes(option)
      ? list.filter((x) => x !== option)
      : [...list, option];
    setField(key, next);
  };

  return (
    <div className="eirc-page">
      <header className="eirc-header">
        <div className="eirc-logo-box">
          <img className="eirc-logo" src={PCI_LOGO_SRC} alt="AQCTA logo" />
        </div>
        <div className="eirc-header-title">
          <h1>CHECKLIST FOR REVIEW OF INSPECTION</h1>
          <div className="eirc-file-line">
            File No./Job No.:
            <span className="eirc-file-value">
              {display(values.fileNoJobNo)}
            </span>
          </div>
        </div>
        <div className="eirc-form-number">AQCTA-FOR-06-05</div>
      </header>

      <div className="eirc-instructions">
        Please tick (✓) whichever is applicable :
      </div>

      <table className="eirc-checklist">
        <thead>
          <tr>
            <th className="eirc-num" />
            <th className="eirc-item">Items to be checked</th>
            <th className="eirc-finding">Findings/Actions</th>
          </tr>
        </thead>
        <tbody>
          {/* 1 */}
          <tr className="eirc-r1">
            <td className="eirc-num-cell">1.</td>
            <td className="eirc-item-cell">Description of inspection work :</td>
            <td className="eirc-finding-cell">
              <RadioPair
                value={values.inspectionWork}
                options={[
                  ["Adequate", "Adequate"],
                  ["Not Adequate", "Not Adequate"],
                ]}
                readOnly={!canEdit("inspectionWork")}
                invalid={invalid.has("inspectionWork")}
                onChange={(v) => setField("inspectionWork", v)}
              />
              <div className="eirc-remark">
                Remarks:{" "}
                <LineInput
                  value={values.inspectionWorkRemarks}
                  readOnly={!canEdit("inspectionWorkRemarks")}
                  invalid={invalid.has("inspectionWorkRemarks")}
                  onChange={(v) => setField("inspectionWorkRemarks", v)}
                />
              </div>
            </td>
          </tr>

          {/* 2 */}
          <tr className="eirc-r2">
            <td className="eirc-num-cell">2.</td>
            <td className="eirc-item-cell">
              Inspection Method/Work Instruction :
              <br />
              Please specify title of related WI.
            </td>
            <td className="eirc-finding-cell">
              <RadioPair
                value={values.workInstruction}
                options={[
                  ["Adequate", "Adequate"],
                  ["Not Adequate", "Not Adequate"],
                ]}
                readOnly={!canEdit("workInstruction")}
                invalid={invalid.has("workInstruction")}
                onChange={(v) => setField("workInstruction", v)}
              />
              <div className="eirc-extra-line">
                WI Ref. No.{" "}
                <LineInput
                  className="eirc-inline-field"
                  value={values.wiRefNo}
                  readOnly={!canEdit("wiRefNo")}
                  onChange={(v) => setField("wiRefNo", v)}
                />{" "}
                IS/MI/
                <LineInput
                  className="eirc-short-field"
                  value={values.isMiNo}
                  readOnly={!canEdit("isMiNo")}
                  onChange={(v) => setField("isMiNo", v)}
                />
              </div>
            </td>
          </tr>

          {/* 3 */}
          <tr className="eirc-r3">
            <td className="eirc-num-cell">3.</td>
            <td className="eirc-item-cell">
              Availability of Standard
              <br />
              Please specify Standard No
            </td>
            <td className="eirc-finding-cell">
              <RadioPair
                value={values.standard}
                options={[
                  ["Available", "Available"],
                  ["Not Available", "Not Available"],
                ]}
                readOnly={!canEdit("standard")}
                invalid={invalid.has("standard")}
                onChange={(v) => setField("standard", v)}
              />
              <div>
                Standard No.{" "}
                <LineInput
                  className="eirc-inline-field"
                  value={values.standardNo}
                  readOnly={!canEdit("standardNo")}
                  placeholder="e.g. API xx : yyyy"
                  onChange={(v) => setField("standardNo", v)}
                />
                <br />
                <span className="eirc-hint">E.g. : API xx : yyyy</span>
              </div>
            </td>
          </tr>

          {/* 4 */}
          <tr className="eirc-r4">
            <td className="eirc-num-cell">4.</td>
            <td className="eirc-item-cell">
              Availability in-house competent personnel:
            </td>
            <td className="eirc-finding-cell">
              <RadioPair
                value={values.competentPersonnel}
                options={[
                  ["Available", "Available"],
                  ["Not Available", "Not Available"],
                ]}
                readOnly={!canEdit("competentPersonnel")}
                invalid={invalid.has("competentPersonnel")}
                onChange={(v) => setField("competentPersonnel", v)}
              />
              <div className="eirc-extra-line">
                Assignment Inspector:{" "}
                <LineInput
                  value={values.assignmentInspector}
                  readOnly={!canEdit("assignmentInspector")}
                  onChange={(v) => setField("assignmentInspector", v)}
                />
              </div>
            </td>
          </tr>

          {/* 5 */}
          <tr className="eirc-r5">
            <td className="eirc-num-cell">5.</td>
            <td className="eirc-item-cell">Availability of Subcontractor :</td>
            <td className="eirc-finding-cell">
              <RadioPair
                value={values.subcontractor}
                options={[
                  ["Available", "Available"],
                  ["Not Available", "Not Available"],
                ]}
                readOnly={!canEdit("subcontractor")}
                invalid={invalid.has("subcontractor")}
                onChange={(v) => setField("subcontractor", v)}
              />
              <div className="eirc-remark">
                Remarks:{" "}
                <LineInput
                  value={values.subcontractorRemarks}
                  readOnly={!canEdit("subcontractorRemarks")}
                  onChange={(v) => setField("subcontractorRemarks", v)}
                />
              </div>
            </td>
          </tr>

          {/* 6 */}
          <tr className="eirc-r6">
            <td className="eirc-num-cell">6.</td>
            <td className="eirc-item-cell">Requirement of Equipment :</td>
            <td className="eirc-finding-cell">
              <RadioPair
                value={values.equipment}
                options={[
                  ["Own Equipment", "Own Equipment"],
                  ["Client Equipment", "Client Equipment"],
                ]}
                readOnly={!canEdit("equipment")}
                invalid={invalid.has("equipment")}
                onChange={(v) => setField("equipment", v)}
              />
              <div className="eirc-remark">
                Remarks:{" "}
                <LineInput
                  value={values.equipmentRemarks}
                  readOnly={!canEdit("equipmentRemarks")}
                  onChange={(v) => setField("equipmentRemarks", v)}
                />
              </div>
            </td>
          </tr>

          {/* 7 */}
          <tr className="eirc-r7">
            <td className="eirc-num-cell">7.</td>
            <td className="eirc-item-cell">
              Compliance to regulatory requirements :
            </td>
            <td className="eirc-finding-cell">
              <RadioPair
                value={values.regulatory}
                options={[
                  ["Necessary", "Necessary"],
                  ["Not Necessary", "Not Necessary"],
                ]}
                readOnly={!canEdit("regulatory")}
                invalid={invalid.has("regulatory")}
                onChange={(v) => setField("regulatory", v)}
              />
              <div className="eirc-remark">
                Remarks:{" "}
                <LineInput
                  value={values.regulatoryRemarks}
                  readOnly={!canEdit("regulatoryRemarks")}
                  onChange={(v) => setField("regulatoryRemarks", v)}
                />
              </div>
            </td>
          </tr>

          {/* 8 */}
          <tr className="eirc-r8">
            <td className="eirc-num-cell">8.</td>
            <td className="eirc-item-cell">
              Compliance to safety requirements:
            </td>
            <td className="eirc-finding-cell">
              <RadioPair
                value={values.safety}
                options={[
                  ["Adequate", "Adequate"],
                  ["Not Adequate", "Not Adequate"],
                ]}
                readOnly={!canEdit("safety")}
                invalid={invalid.has("safety")}
                onChange={(v) => setField("safety", v)}
              />
              <div className="eirc-remark">
                Remarks:{" "}
                <LineInput
                  value={values.safetyRemarks}
                  readOnly={!canEdit("safetyRemarks")}
                  onChange={(v) => setField("safetyRemarks", v)}
                />
              </div>
            </td>
          </tr>

          {/* 9 */}
          <tr className="eirc-r9">
            <td className="eirc-num-cell">9.</td>
            <td className="eirc-item-cell">
              Others observations (e.g: site visit, PPE, etc) :
              <br />
              Please specify type of PPE (if required) :
            </td>
            <td className="eirc-finding-cell">
              <RadioPair
                value={values.otherObservations}
                options={[
                  ["Available", "Available"],
                  ["Not Available", "Not Available"],
                ]}
                readOnly={!canEdit("otherObservations")}
                invalid={invalid.has("otherObservations")}
                onChange={(v) => setField("otherObservations", v)}
              />
              <div className="eirc-ppe-block">
                PPE
                <div className="eirc-sub-list">
                  <div>
                    a) &nbsp; Safety shoes{" "}
                    <TickBox
                      checked={ppeList.includes("Safety shoes")}
                      disabled={!canEdit("ppe")}
                      onClick={() =>
                        toggleInList("ppe", values.ppe, "Safety shoes")
                      }
                    />
                  </div>
                  <div>
                    b) &nbsp; Safety helmets{" "}
                    <TickBox
                      checked={ppeList.includes("Safety helmets")}
                      disabled={!canEdit("ppe")}
                      onClick={() =>
                        toggleInList("ppe", values.ppe, "Safety helmets")
                      }
                    />
                  </div>
                  <div>
                    c) &nbsp; Others :{" "}
                    <LineInput
                      className="eirc-inline-field"
                      value={values.ppeOthers}
                      readOnly={!canEdit("ppeOthers")}
                      onChange={(v) => setField("ppeOthers", v)}
                    />
                  </div>
                </div>
              </div>
            </td>
          </tr>

          {/* 10 */}
          <tr className="eirc-r10">
            <td className="eirc-num-cell">10.</td>
            <td className="eirc-item-cell">Proceed to conduct inspection:</td>
            <td className="eirc-finding-cell">
              <RadioPair
                value={values.proceed}
                options={[
                  ["Yes", "Yes"],
                  ["No", "No"],
                ]}
                readOnly={!canEdit("proceed")}
                invalid={invalid.has("proceed")}
                onChange={(v) => setField("proceed", v)}
              />
              <div className="eirc-remark">
                Remarks:{" "}
                <LineInput
                  value={values.proceedRemarks}
                  readOnly={!canEdit("proceedRemarks")}
                  onChange={(v) => setField("proceedRemarks", v)}
                />
              </div>
            </td>
          </tr>

          {/* 11 */}
          <tr className="eirc-r11">
            <td className="eirc-num-cell">11.</td>
            <td className="eirc-item-cell">
              Notify customer of acceptance through:
            </td>
            <td className="eirc-finding-cell">
              <div className="eirc-option-row">
                {[
                  ["Phone", "Phone"],
                  ["Fax", "Fax"],
                ].map(([label, opt]) => (
                  <span className="eirc-option-group" key={opt}>
                    <span className="eirc-label">{label}</span>
                    <TickBox
                      checked={notifyList.includes(opt)}
                      disabled={!canEdit("notifyCustomer")}
                      onClick={() =>
                        toggleInList("notifyCustomer", values.notifyCustomer, opt)
                      }
                    />
                  </span>
                ))}
              </div>
              <div className="eirc-option-row">
                {[
                  ["E-mail", "E-mail"],
                  ["Letter", "Letter"],
                ].map(([label, opt]) => (
                  <span className="eirc-option-group" key={opt}>
                    <span className="eirc-label">{label}</span>
                    <TickBox
                      checked={notifyList.includes(opt)}
                      disabled={!canEdit("notifyCustomer")}
                      onClick={() =>
                        toggleInList("notifyCustomer", values.notifyCustomer, opt)
                      }
                    />
                  </span>
                ))}
              </div>
              <div className="eirc-remark">
                Remarks:{" "}
                <LineInput
                  value={values.notificationRemarks}
                  readOnly={!canEdit("notificationRemarks")}
                  onChange={(v) => setField("notificationRemarks", v)}
                />
              </div>
            </td>
          </tr>

          {/* 12 */}
          <tr className="eirc-r12">
            <td className="eirc-num-cell">12.</td>
            <td className="eirc-item-cell">
              Comments(other than above -if any) :
            </td>
            <td className="eirc-finding-cell">
              {canEdit("comments") ? (
                <textarea
                  className={`eirc-comments${
                    invalid.has("comments") ? " is-invalid" : ""
                  }`}
                  rows={3}
                  value={values.comments || ""}
                  onChange={(e) => setField("comments", e.target.value)}
                />
              ) : (
                <div className="eirc-comments-ro">
                  {display(values.comments)}
                </div>
              )}
            </td>
          </tr>
        </tbody>
      </table>

      <table className="eirc-bottom-review">
        <tbody>
          <tr>
            <td>
              <div className="eirc-review-title">Reviewed by:</div>
              <div>(Inspector)</div>
              <div className="eirc-sign-name">
                {display(values.reviewedByName) || "—"}
              </div>
              <div className="eirc-date">
                Date:{" "}
                <span className="eirc-inline-field eirc-field-ro">
                  {display(values.reviewedDate)}
                </span>
              </div>
            </td>
            <td>
              <div className="eirc-review-title">Approved by:</div>
              <div>(Manager)</div>
              <div className="eirc-sign-name">
                {display(values.approvedByName) || "—"}
              </div>
              <div className="eirc-date">
                Date:{" "}
                <span className="eirc-inline-field eirc-field-ro">
                  {display(values.approvedDate)}
                </span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
