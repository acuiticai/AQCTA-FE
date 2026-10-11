import React, { useMemo } from "react";

export const CERTIFICATION_REPORT_EDITABLE_KEYS = [
  "edition",
  "pages",
  "photographs",
  "drawings",
  "annexes",
  "factory",
  "standards",
  "certificationRequirements",
  "workInstruction",
  "replacesPageNo",
  "replacesPageDate",
  "reportNo",
  "componentList",
  "drawingSketch",
  "manufacturingProcess",
  "typeTestReport",
  "processFlowChart",
  "qcCheckPoints",
  "testEquipment",
  "markingRequirements",
  "productReEvaluationRequirements",
];

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

const Field = ({
  label,
  fieldKey,
  values,
  canEdit,
  invalid,
  setField,
  multiline,
  type = "text",
  rows = 3,
}) => {
  const value = values[fieldKey] || "";
  const bad = invalid.has(fieldKey);
  if (!canEdit(fieldKey)) {
    return (
      <div className="cr-field">
        <div className="cr-label">{label}</div>
        <div className={`cr-value${multiline ? " cr-value--pre" : ""}`}>
          {display(value) || "—"}
        </div>
      </div>
    );
  }
  if (type === "date") {
    return (
      <div className="cr-field">
        <div className="cr-label">{label}</div>
        <input
          type="date"
          className={`cr-in cr-in--date${bad ? " is-invalid" : ""}`}
          value={toDateInputValue(value)}
          onChange={(e) => setField(fieldKey, fromDateInputValue(e.target.value))}
        />
      </div>
    );
  }
  if (multiline) {
    return (
      <div className="cr-field">
        <div className="cr-label">{label}</div>
        <textarea
          className={`cr-in cr-in--area${bad ? " is-invalid" : ""}`}
          rows={rows}
          value={value}
          onChange={(e) => setField(fieldKey, e.target.value)}
        />
      </div>
    );
  }
  return (
    <div className="cr-field">
      <div className="cr-label">{label}</div>
      <input
        type="text"
        className={`cr-in${bad ? " is-invalid" : ""}`}
        value={value}
        onChange={(e) => setField(fieldKey, e.target.value)}
      />
    </div>
  );
};

/**
 * Conformity Assessment Report — AQCTA-FOR-01-19.
 * Layout mirrors the controlled PDF (cover + Parts A–D).
 */
export default function CertificationReportForm({
  values = {},
  onChange,
  readOnly = false,
  invalidKeys = [],
  editableKeys = [],
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
  const heading =
    documentTitle || "CONFORMITY ASSESSMENT\nCERTIFICATION REPORT";
  const headingLines = String(heading).split("\n");

  return (
    <div className="cr-page">
      <header className="cr-header">
        <h1 className="cr-title">
          {headingLines.map((line, i) => (
            <React.Fragment key={`${line}-${i}`}>
              {i > 0 ? <br /> : null}
              {line}
            </React.Fragment>
          ))}
        </h1>
        <div className="cr-form-code">
          {documentCode || "AQCTA-FOR-01-19"}
        </div>
      </header>

      <div className="cr-notice">
        This Certification Report shall not be amended, changed, varied or
        modified in any manner whatsoever by the licensee or otherwise. If the
        Certification Report is to be furnished to any third party or to the
        public, each such Certification Report shall be furnished in full and
        its entirety. This Certification Report shall be read in conjunction
        with the Conformity Assessment Agreement.
      </div>

      <section className="cr-section">
        <h2>Cover</h2>
        <div className="cr-grid">
          <Field
            label="File No."
            fieldKey="fileNo"
            values={values}
            canEdit={canEdit}
            invalid={invalid}
            setField={setField}
          />
          <Field
            label="Edition"
            fieldKey="edition"
            values={values}
            canEdit={canEdit}
            invalid={invalid}
            setField={setField}
          />
          <Field
            label="Date issued"
            fieldKey="dateIssued"
            values={values}
            canEdit={canEdit}
            invalid={invalid}
            setField={setField}
          />
          <Field
            label="Issued by"
            fieldKey="issuedBy"
            values={values}
            canEdit={canEdit}
            invalid={invalid}
            setField={setField}
          />
        </div>
        <div className="cr-grid cr-grid--4">
          <Field
            label="Pages"
            fieldKey="pages"
            values={values}
            canEdit={canEdit}
            invalid={invalid}
            setField={setField}
          />
          <Field
            label="Photographs"
            fieldKey="photographs"
            values={values}
            canEdit={canEdit}
            invalid={invalid}
            setField={setField}
          />
          <Field
            label="Drawings"
            fieldKey="drawings"
            values={values}
            canEdit={canEdit}
            invalid={invalid}
            setField={setField}
          />
          <Field
            label="Annexes"
            fieldKey="annexes"
            values={values}
            canEdit={canEdit}
            invalid={invalid}
            setField={setField}
          />
        </div>
        <Field
          label="Applicant"
          fieldKey="applicant"
          values={values}
          canEdit={canEdit}
          invalid={invalid}
          setField={setField}
        />
        <Field
          label="Factory"
          fieldKey="factory"
          values={values}
          canEdit={canEdit}
          invalid={invalid}
          setField={setField}
          multiline
          rows={2}
        />
        <Field
          label="Product"
          fieldKey="product"
          values={values}
          canEdit={canEdit}
          invalid={invalid}
          setField={setField}
        />
        <Field
          label="Standard(s)"
          fieldKey="standards"
          values={values}
          canEdit={canEdit}
          invalid={invalid}
          setField={setField}
          multiline
          rows={2}
        />
        <Field
          label="Certification requirements"
          fieldKey="certificationRequirements"
          values={values}
          canEdit={canEdit}
          invalid={invalid}
          setField={setField}
          multiline
          rows={2}
        />
        <Field
          label="Work instruction"
          fieldKey="workInstruction"
          values={values}
          canEdit={canEdit}
          invalid={invalid}
          setField={setField}
        />
        <div className="cr-grid">
          <Field
            label="Report no."
            fieldKey="reportNo"
            values={values}
            canEdit={canEdit}
            invalid={invalid}
            setField={setField}
          />
          <Field
            label="Report date issued"
            fieldKey="reportDateIssued"
            values={values}
            canEdit={canEdit}
            invalid={invalid}
            setField={setField}
          />
          <Field
            label="Report issued by"
            fieldKey="reportIssuedBy"
            values={values}
            canEdit={canEdit}
            invalid={invalid}
            setField={setField}
          />
          <Field
            label="Replaces — page no."
            fieldKey="replacesPageNo"
            values={values}
            canEdit={canEdit}
            invalid={invalid}
            setField={setField}
          />
          <Field
            label="Replaces — page date"
            fieldKey="replacesPageDate"
            values={values}
            canEdit={canEdit}
            invalid={invalid}
            setField={setField}
            type="date"
          />
        </div>
      </section>

      <section className="cr-section">
        <h2>Part A — Product evaluation</h2>
        <div className="cr-grid">
          <Field
            label="a) Product Name"
            fieldKey="productName"
            values={values}
            canEdit={canEdit}
            invalid={invalid}
            setField={setField}
          />
          <Field
            label="b) Brand"
            fieldKey="brand"
            values={values}
            canEdit={canEdit}
            invalid={invalid}
            setField={setField}
          />
          <Field
            label="c) Model"
            fieldKey="model"
            values={values}
            canEdit={canEdit}
            invalid={invalid}
            setField={setField}
          />
          <Field
            label="d) Type"
            fieldKey="type"
            values={values}
            canEdit={canEdit}
            invalid={invalid}
            setField={setField}
          />
          <Field
            label="e) Rating"
            fieldKey="rating"
            values={values}
            canEdit={canEdit}
            invalid={invalid}
            setField={setField}
          />
          <Field
            label="f) Size"
            fieldKey="size"
            values={values}
            canEdit={canEdit}
            invalid={invalid}
            setField={setField}
          />
        </div>
        <Field
          label="g) Component List"
          fieldKey="componentList"
          values={values}
          canEdit={canEdit}
          invalid={invalid}
          setField={setField}
          multiline
          rows={4}
        />
        <Field
          label="h) Drawing / Sketch"
          fieldKey="drawingSketch"
          values={values}
          canEdit={canEdit}
          invalid={invalid}
          setField={setField}
          multiline
          rows={3}
        />
        <Field
          label="i) Manufacturing Process"
          fieldKey="manufacturingProcess"
          values={values}
          canEdit={canEdit}
          invalid={invalid}
          setField={setField}
          multiline
          rows={4}
        />
        <Field
          label="2. Type Test Report"
          fieldKey="typeTestReport"
          values={values}
          canEdit={canEdit}
          invalid={invalid}
          setField={setField}
          multiline
          rows={5}
        />
      </section>

      <section className="cr-section">
        <h2>Part B — Quality system evaluation</h2>
        <Field
          label="1a) Process flow chart"
          fieldKey="processFlowChart"
          values={values}
          canEdit={canEdit}
          invalid={invalid}
          setField={setField}
          multiline
          rows={5}
        />
        <Field
          label="1b) QC check points"
          fieldKey="qcCheckPoints"
          values={values}
          canEdit={canEdit}
          invalid={invalid}
          setField={setField}
          multiline
          rows={5}
        />
        <Field
          label="2. Test equipment"
          fieldKey="testEquipment"
          values={values}
          canEdit={canEdit}
          invalid={invalid}
          setField={setField}
          multiline
          rows={5}
        />
      </section>

      <section className="cr-section">
        <h2>Part C — Marking requirements</h2>
        <Field
          label="Marking requirements"
          fieldKey="markingRequirements"
          values={values}
          canEdit={canEdit}
          invalid={invalid}
          setField={setField}
          multiline
          rows={6}
        />
      </section>

      <section className="cr-section">
        <h2>Part D — Product re-evaluation requirements</h2>
        <Field
          label="Re-evaluation requirements (after certification)"
          fieldKey="productReEvaluationRequirements"
          values={values}
          canEdit={canEdit}
          invalid={invalid}
          setField={setField}
          multiline
          rows={6}
        />
      </section>

      <section className="cr-section">
        <h2>Verified / Approved</h2>
        <div className="cr-signoff">
          <div className="cr-sign-col">
            <div className="cr-sign-role">Verified by</div>
            <div className="cr-sign-name">
              {display(values.verifiedBy) || "—"}
            </div>
            <div className="cr-sign-date">
              Date: {display(values.verifiedDate) || "—"}
            </div>
          </div>
          <div className="cr-sign-col">
            <div className="cr-sign-role">Approved by</div>
            <div className="cr-sign-name">
              {display(values.approvedBy) || "—"}
            </div>
            <div className="cr-sign-date">
              Date: {display(values.approvedDate) || "—"}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
