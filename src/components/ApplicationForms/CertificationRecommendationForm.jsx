import React, { useMemo, useState } from "react";

export const MAX_AUDIT_ROWS = 8;

export const CHECKLIST_SECTIONS = [
  { id: "1", title: "1. GENERAL" },
  { id: "2", title: "2. APPLICATION FORM" },
  { id: "3", title: "3. DOCUMENTATION AUDIT" },
  { id: "4", title: "4. ACCEPTANCE LETTER" },
  { id: "5", title: "5. INSPECTION REPORT" },
  { id: "6", title: "6. TEST REPORTS" },
  { id: "7", title: "7. CERTIFICATION REPORT" },
];

export const CHECKLIST_ITEMS = [
  { id: "1_1", section: "1", label: "1.1 Is a copy of the standard available for reference?" },
  { id: "1_2", section: "1", label: "1.2 Is the product recommended within the scope of the standard?" },
  { id: "1_3", section: "1", label: "1.3 Has the standard been used for certification (ref: Listing of standards)?" },
  { id: "1_4", section: "1", label: "1.4 If not, has an assessment of the standard been done?" },
  { id: "1_5", section: "1", label: "1.5 For Product Listing, is CP approval available?" },
  { id: "1_6", section: "1", label: "1.6 Is there an assignment letter to the Auditor? Has the Auditor been qualified for this project?" },
  { id: "1_7", section: "1", label: "1.7 Has a sample of the licence been printed?" },
  { id: "2_1", section: "2", label: "2.1 Is the scope requested defined (product name/models etc)?" },
  { id: "2_2", section: "2", label: "2.2 Is the standard indicated (if known)?" },
  { id: "2_3", section: "2", label: "2.3 Is the form signed by an authorised representative?" },
  { id: "2_4", section: "2", label: "2.4 Is the process flowchart available?" },
  { id: "2_5", section: "2", label: "2.5 Has the appropriate Scheme been indicated on the application form?" },
  { id: "2_6", section: "2", label: "2.6 Is form AQCTA-F-1 available?" },
  { id: "3_1", section: "3", label: "3.1 Has it been completed satisfactorily?" },
  { id: "4_1", section: "4", label: "4.1 Is the pre-certification period indicated?" },
  { id: "4_2", section: "4", label: "4.2 Is the recommendation still within the valid period?" },
  { id: "4_3", section: "4", label: "4.3 If not, has an extension been granted by CP? Has the applicant been informed? What is the expiry date?" },
  { id: "4_4", section: "4", label: "4.4 Has the relevant authority been informed?" },
  { id: "5_1", section: "5", label: "5.1 Are all inspection reports available?" },
  { id: "5_2", section: "5", label: "5.2 Are all notices of inspections available? Were changes informed to clients?" },
  { id: "5_3", section: "5", label: "5.3 Were relevant records checked? Do they include customer complaints and handling of non-conforming products?" },
  { id: "5_4", section: "5", label: "5.4 Were all NCRs closed? Date of closing?" },
  { id: "5_5", section: "5", label: "5.5 Were there evidence of samples selected (storage/production)?" },
  { id: "6_1", section: "6", label: "6.1 Are all test reports available and complete? Are there 5 years old or less?" },
  { id: "6_2", section: "6", label: "6.2 Do the test reports belong to the applicant? If not, was permission given by the owner?" },
  { id: "6_3", section: "6", label: "6.3 Were the test reports from accredited/recognised laboratories?" },
  { id: "6_4", section: "6", label: "6.4 If other than above, was an assessment of the laboratory carried out?" },
  { id: "6_5", section: "6", label: "6.5 Were samples for testing selected by AQCTA or its representatives or 3rd party CB?" },
  { id: "6_6", section: "6", label: "6.6 Was the sampling done in accordance to the sampling plan in the standard/WI?" },
  { id: "6_7", section: "6", label: "6.7 Did the product meet all the requirements of the standard?" },
  { id: "6_8", section: "6", label: "6.8 If not, is CP approval for deviation available?" },
  { id: "7_1", section: "7", label: "7.1 Is the standard no. clearly/correctly stated?" },
  { id: "7_2", section: "7", label: "7.2 Is the name of the product consistent with Listing of Standards Used for Certification?" },
  { id: "7_3", section: "7", label: "7.3 Is the product description in accordance to the standard/WI? Reflected correctly in sample licence?" },
  { id: "7_4", section: "7", label: "7.4 Have all brands/models/types/ratings/sizes been included in the product description?" },
  { id: "7_5", section: "7", label: "7.5 Are circuit diagrams/drawings/photos available?" },
  { id: "7_6", section: "7", label: "7.6 Test report history (no., lab, clauses, exemptions)" },
  { id: "7_7", section: "7", label: "7.7 Test equipment (critical listed, calibrated, frequency)" },
  { id: "7_8", section: "7", label: "7.8 Marking requirement (standard/regulatory, method/location, sample)" },
  { id: "7_9", section: "7", label: "7.9 Product re-evaluation (surveillance frequency, re-tests, special requirements)" },
];

export const CERTIFICATION_RECOMMENDATION_EDITABLE_KEYS = [
  "factoryAddress",
  "standards",
  "managementRepresentative",
  "acceptanceDate",
  "reviewingAuditorResponse",
  "auditorResponse",
  ...CHECKLIST_ITEMS.flatMap((item) => [
    `check_${item.id}_answer`,
    `check_${item.id}_remarks`,
  ]),
];

const AUDIT_FIELDS = ["date", "officer", "findings"];

const display = (value) => String(value ?? "").trim();

const toDateInputValue = (value) => {
  const raw = display(value);
  if (!raw) return "";
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }
  return "";
};

const fromDateInputValue = (value) => {
  const raw = display(value);
  if (!raw) return "";
  const [y, m, d] = raw.split("-");
  if (!y || !m || !d) return raw;
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
};

const deriveAuditCount = (values) => {
  let highest = 0;
  for (let i = 1; i <= MAX_AUDIT_ROWS; i += 1) {
    const hit = AUDIT_FIELDS.some((f) => display(values[`audit_${i}_${f}`]));
    if (hit) highest = i;
  }
  return highest;
};

const Field = ({
  label,
  fieldKey,
  values,
  canEdit,
  invalid,
  setField,
  multiline,
  type = "text",
}) => {
  const value = values[fieldKey] || "";
  const bad = invalid.has(fieldKey);
  if (!canEdit(fieldKey)) {
    return (
      <div className="crec-field">
        <div className="crec-label">{label}</div>
        <div className={`crec-value${multiline ? " crec-value--pre" : ""}`}>
          {display(value) || "—"}
        </div>
      </div>
    );
  }
  if (type === "date") {
    return (
      <div className="crec-field">
        <div className="crec-label">{label}</div>
        <input
          type="date"
          className={`crec-in${bad ? " is-invalid" : ""}`}
          value={toDateInputValue(value)}
          onChange={(e) => setField(fieldKey, fromDateInputValue(e.target.value))}
        />
      </div>
    );
  }
  if (multiline) {
    return (
      <div className="crec-field">
        <div className="crec-label">{label}</div>
        <textarea
          className={`crec-in crec-in--area${bad ? " is-invalid" : ""}`}
          rows={3}
          value={value}
          onChange={(e) => setField(fieldKey, e.target.value)}
        />
      </div>
    );
  }
  return (
    <div className="crec-field">
      <div className="crec-label">{label}</div>
      <input
        type="text"
        className={`crec-in${bad ? " is-invalid" : ""}`}
        value={value}
        onChange={(e) => setField(fieldKey, e.target.value)}
      />
    </div>
  );
};

const YnTick = ({ checked, onClick, disabled, invalid }) => (
  <button
    type="button"
    className={`crec-tick${checked ? " is-on" : ""}${invalid ? " is-invalid" : ""}`}
    disabled={disabled}
    onClick={onClick}
  >
    {checked ? "✓" : ""}
  </button>
);

/**
 * Recommendation for Certification — AQCTA-FOR-01-19.2.
 */
export default function CertificationRecommendationForm({
  values = {},
  onChange,
  readOnly = false,
  invalidKeys = [],
  editableKeys = [],
  repeatableRows = {},
  onAddRow,
  onRemoveRow,
  documentTitle = "",
  documentCode = "",
}) {
  const invalid = useMemo(() => new Set(invalidKeys), [invalidKeys]);
  const editable = useMemo(() => new Set(editableKeys), [editableKeys]);
  const canEdit = (key) => {
    if (readOnly) return false;
    if (!editableKeys?.length) return true;
    return editable.has(key);
  };
  const setField = (key, value) => onChange?.(key, value);
  const canEditRows = !readOnly;

  const derivedCount = Math.max(deriveAuditCount(values), 1);
  const [localRows, setLocalRows] = useState(0);
  const auditCount = Math.min(
    MAX_AUDIT_ROWS,
    Math.max(
      localRows,
      typeof repeatableRows?.audit_summary === "number"
        ? repeatableRows.audit_summary
        : derivedCount,
      derivedCount,
    ),
  );

  const addAudit = () => {
    if (auditCount >= MAX_AUDIT_ROWS) return;
    const next = auditCount + 1;
    AUDIT_FIELDS.forEach((f) => setField(`audit_${next}_${f}`, ""));
    if (onAddRow) onAddRow("audit_summary");
    else setLocalRows(next);
  };

  const removeAudit = (index) => {
    if (auditCount <= 1) {
      AUDIT_FIELDS.forEach((f) => setField(`audit_1_${f}`, ""));
      return;
    }
    for (let i = index; i < auditCount; i += 1) {
      AUDIT_FIELDS.forEach((f) => {
        setField(`audit_${i}_${f}`, values[`audit_${i + 1}_${f}`] ?? "");
      });
    }
    AUDIT_FIELDS.forEach((f) => setField(`audit_${auditCount}_${f}`, ""));
    if (onRemoveRow) onRemoveRow("audit_summary", auditCount);
    else setLocalRows(Math.max(auditCount - 1, 1));
  };

  const setAnswer = (id, next) => {
    const key = `check_${id}_answer`;
    if (!canEdit(key)) return;
    const current = display(values[key]).toUpperCase();
    setField(key, current === next ? "" : next);
  };

  return (
    <div className="crec-page">
      <header className="crec-header">
        <div className="crec-code">
          {documentCode || "AQCTA-FOR-01-19-02"}
        </div>
        <div className="crec-confidential">CONFIDENTIAL</div>
        <h1 className="crec-title">
          {documentTitle || "RECOMMENDATION FOR CERTIFICATION"}
        </h1>
      </header>

      <section className="crec-section">
        <h2>a) Client details</h2>
        <div className="crec-grid">
          <Field label="Date" fieldKey="reportDate" values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
          <Field label="File No." fieldKey="fileNo" values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
          <Field label="Name of Client" fieldKey="clientName" values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
          <Field label="Product" fieldKey="product" values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
          <Field label="Brand(s)" fieldKey="brands" values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
          <Field label="Date of application" fieldKey="applicationDate" values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
        </div>
        <Field label="Factory name and address" fieldKey="factoryAddress" values={values} canEdit={canEdit} invalid={invalid} setField={setField} multiline />
        <Field label="Standard(s)" fieldKey="standards" values={values} canEdit={canEdit} invalid={invalid} setField={setField} multiline />
        <div className="crec-grid">
          <Field label="Management representative" fieldKey="managementRepresentative" values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
          <Field label="Date of acceptance" fieldKey="acceptanceDate" values={values} canEdit={canEdit} invalid={invalid} setField={setField} type="date" />
        </div>
      </section>

      <section className="crec-section">
        <h2>b) Audit Summary</h2>
        {Array.from({ length: auditCount }, (_, idx) => {
          const i = idx + 1;
          return (
            <div className="crec-audit-row" key={i}>
              <div className="crec-audit-head">
                <strong>Audit {i}</strong>
                {canEditRows ? (
                  <button type="button" className="crec-link" onClick={() => removeAudit(i)}>
                    Remove
                  </button>
                ) : null}
              </div>
              <div className="crec-grid">
                <Field
                  label="Date"
                  fieldKey={`audit_${i}_date`}
                  values={values}
                  canEdit={() => canEditRows}
                  invalid={invalid}
                  setField={setField}
                  type="date"
                />
                <Field
                  label="Officer"
                  fieldKey={`audit_${i}_officer`}
                  values={values}
                  canEdit={() => canEditRows}
                  invalid={invalid}
                  setField={setField}
                />
              </div>
              <Field
                label="Findings"
                fieldKey={`audit_${i}_findings`}
                values={values}
                canEdit={() => canEditRows}
                invalid={invalid}
                setField={setField}
                multiline
              />
            </div>
          );
        })}
        {canEditRows && auditCount < MAX_AUDIT_ROWS ? (
          <button type="button" className="crec-add" onClick={addAudit}>
            Add audit row
          </button>
        ) : null}
      </section>

      <section className="crec-section">
        <h2>Review checklist</h2>
        <div className="crec-check-wrap">
          <table className="crec-check-table">
            <thead>
              <tr>
                <th>ITEMS</th>
                <th>Y</th>
                <th>N</th>
                <th>REMARKS</th>
              </tr>
            </thead>
            <tbody>
              {CHECKLIST_SECTIONS.map((section) => (
                <React.Fragment key={section.id}>
                  <tr>
                    <td className="crec-check-section" colSpan={4}>
                      {section.title}
                    </td>
                  </tr>
                  {CHECKLIST_ITEMS.filter((item) => item.section === section.id).map(
                    (item) => {
                      const aKey = `check_${item.id}_answer`;
                      const rKey = `check_${item.id}_remarks`;
                      const answer = display(values[aKey]).toUpperCase();
                      return (
                        <tr key={item.id}>
                          <td>{item.label}</td>
                          <td className="crec-answer">
                            <YnTick
                              checked={answer === "Y"}
                              disabled={!canEdit(aKey)}
                              invalid={invalid.has(aKey)}
                              onClick={() => setAnswer(item.id, "Y")}
                            />
                          </td>
                          <td className="crec-answer">
                            <YnTick
                              checked={answer === "N"}
                              disabled={!canEdit(aKey)}
                              invalid={invalid.has(aKey)}
                              onClick={() => setAnswer(item.id, "N")}
                            />
                          </td>
                          <td>
                            {canEdit(rKey) ? (
                              <input
                                type="text"
                                className={`crec-in${invalid.has(rKey) ? " is-invalid" : ""}`}
                                value={values[rKey] || ""}
                                onChange={(e) => setField(rKey, e.target.value)}
                              />
                            ) : (
                              display(values[rKey]) || "—"
                            )}
                          </td>
                        </tr>
                      );
                    },
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="crec-section">
        <h2>Responses</h2>
        <Field
          label="Response by Reviewing Auditor/Manager"
          fieldKey="reviewingAuditorResponse"
          values={values}
          canEdit={canEdit}
          invalid={invalid}
          setField={setField}
          multiline
        />
        <Field
          label="Response by Auditor"
          fieldKey="auditorResponse"
          values={values}
          canEdit={canEdit}
          invalid={invalid}
          setField={setField}
          multiline
        />
      </section>

      <section className="crec-section">
        <h2>Recommendation supported</h2>
        <div className="crec-signoff">
          <div>
            <div className="crec-sign-role">Prepared / Page 1</div>
            <div>{display(values.page1Name) || "—"}</div>
            <div className="crec-muted">Date: {display(values.page1ApprovalDate) || "—"}</div>
          </div>
          <div>
            <div className="crec-sign-role">Reviewing Auditor / Manager</div>
            <div>{display(values.reviewerName) || "—"}</div>
            <div className="crec-muted">Date: {display(values.reviewerDate) || "—"}</div>
          </div>
        </div>
      </section>
    </div>
  );
}
