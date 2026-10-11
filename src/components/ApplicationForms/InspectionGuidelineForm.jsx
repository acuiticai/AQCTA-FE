import React from "react";

const PCI_LOGO_SRC = `${process.env.PUBLIC_URL || ""}/aqcta-logo.png`;

const ROWS = [
  {
    key: "productProject",
    num: "1.",
    label: <>Product/Project:</>,
    rowClass: "ig-r1",
    multiline: false,
  },
  {
    key: "standards",
    num: "2.",
    label: (
      <>
        Standard(s)
        <br />
        Title and No.
      </>
    ),
    rowClass: "ig-r2",
    multiline: true,
    placeholder: "e.g. ASME Section VIII Div. 1",
  },
  {
    key: "scope",
    num: "3.",
    label: (
      <>
        Scope of
        <br />
        project/standard
      </>
    ),
    rowClass: "ig-r3",
    multiline: true,
  },
  {
    key: "description",
    num: "4.",
    label: (
      <>
        Brief description of
        <br />
        project
      </>
    ),
    rowClass: "ig-r4",
    multiline: true,
  },
  {
    key: "criticalComponents",
    num: "5.",
    label: (
      <>
        Critical components /
        <br />
        raw materials
      </>
    ),
    rowClass: "ig-r5",
    multiline: true,
  },
  {
    key: "testingFacilities",
    num: "6.",
    label: <>Testing facilities</>,
    rowClass: "ig-r6",
    multiline: true,
  },
  {
    key: "mandatoryMarking",
    num: "7.",
    label: (
      <>
        Mandatory Marking
        <br />
        Requirements as
        <br />
        specified in Standard
      </>
    ),
    rowClass: "ig-r7",
    multiline: true,
  },
  {
    key: "reporting",
    num: "8.",
    label: <>Reporting</>,
    rowClass: "ig-r8",
    multiline: true,
  },
  {
    key: "verificationChecklist",
    num: "9.",
    label: (
      <>
        Inspectors verification
        <br />
        checklist
      </>
    ),
    rowClass: "ig-r9",
    multiline: true,
  },
  {
    key: "other",
    num: "10.",
    label: <>Other</>,
    rowClass: "ig-r10",
    multiline: true,
  },
];

const display = (value) => String(value ?? "").trim();

/**
 * Inspection Guideline fill UI — matches
 * `templates/inspectionGuideline.html` (AQCTA-FOR-06-11).
 */
export default function InspectionGuidelineForm({
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

  return (
    <div className="ig-page">
      <div className="ig-top">
        <img className="ig-logo" src={PCI_LOGO_SRC} alt="AQCTA logo" />
        <div className="ig-form-code">AQCTA-FOR-06-11</div>
        <h1 className="ig-title">INSPECTION GUIDELINE</h1>
      </div>

      <table className="ig-main-table">
        <tbody>
          {ROWS.map((row) => {
            const editing = canEdit(row.key);
            const bad = invalid.has(row.key);
            return (
              <tr key={row.key} className={row.rowClass}>
                <td className="ig-num">{row.num}</td>
                <td className="ig-label">{row.label}</td>
                <td className="ig-value">
                  {editing ? (
                    row.multiline ? (
                      <textarea
                        className={`ig-area${bad ? " is-invalid" : ""}`}
                        rows={3}
                        value={values[row.key] || ""}
                        placeholder={row.placeholder || ""}
                        onChange={(e) => setField(row.key, e.target.value)}
                      />
                    ) : (
                      <input
                        type="text"
                        className={`ig-in${bad ? " is-invalid" : ""}`}
                        value={values[row.key] || ""}
                        placeholder={row.placeholder || ""}
                        onChange={(e) => setField(row.key, e.target.value)}
                      />
                    )
                  ) : (
                    <span className="ig-ro">{display(values[row.key])}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="ig-comment">
        Comment:{" "}
        {canEdit("comment") ? (
          <textarea
            className={`ig-area ig-area--comment${
              invalid.has("comment") ? " is-invalid" : ""
            }`}
            rows={2}
            value={values.comment || ""}
            onChange={(e) => setField("comment", e.target.value)}
          />
        ) : (
          <span className="ig-comment-body">{display(values.comment)}</span>
        )}
      </div>

      <div className="ig-signatures">
        <div className="ig-signature">
          <div className="ig-role">PREPARED BY:</div>
          <div className="ig-name">
            {display(values.preparedByName) || "—"}
          </div>
          <div className="ig-line" />
          <div className="ig-caption">(Inspector)</div>
        </div>
        <div className="ig-signature">
          <div className="ig-role">REVIEWED BY:</div>
          <div className="ig-name">
            {display(values.reviewedByName) || "—"}
          </div>
          <div className="ig-line" />
          <div className="ig-caption">(Manager)</div>
        </div>
      </div>
    </div>
  );
}
