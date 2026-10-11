import React, { useMemo, useState } from "react";
import SignaturePad from "@/components/ApplicationForms/SignaturePad";

const MAX_PRODUCT_OBS = 12;
const MAX_RECORDS = 10;
const MAX_TESTS = 10;
const YES_NO = ["Yes", "No"];

export const AUDIT_REPORT_EDITABLE_KEYS = [
  "auditDate",
  "reportNo",
  "jobNo",
  "fileNo",
  "standardNo",
  "applicant",
  "manufacturer",
  "address",
  "products",
  "scopeOfAudit",
  "productionDuringVisit",
  "auditBasisOther",
  "nonConformances",
  "markingMethod",
  "markingCompliance",
  "controlSerialNos",
  "labelQuantity",
  "recordsSatisfactory",
  "samplesSelected",
  "annexes",
  "correctiveAction",
  "changesRequired",
  "summaryFindings",
  "recommendations",
  "pciaRepName",
  "pciaRepFactoryHours",
  "pciaRepDate",
  "manufacturerRepName",
  "manufacturerRepTel",
  "manufacturerRepEmail",
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

const deriveCount = (values, prefix, fields, max) => {
  let highest = 0;
  for (let i = 1; i <= max; i += 1) {
    const hit = fields.some((f) => display(values[`${prefix}_${i}_${f}`]));
    if (hit) highest = i;
  }
  return Math.max(highest, 1);
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
  options,
}) => {
  const value = values[fieldKey] || "";
  const bad = invalid.has(fieldKey);
  if (!canEdit(fieldKey)) {
    return (
      <div className="ar-field">
        <div className="ar-label">{label}</div>
        <div className="ar-value">{display(value) || "—"}</div>
      </div>
    );
  }
  if (options) {
    return (
      <div className="ar-field">
        <div className="ar-label">{label}</div>
        <select
          className={`ar-in${bad ? " is-invalid" : ""}`}
          value={value}
          onChange={(e) => setField(fieldKey, e.target.value)}
        >
          <option value="">Select…</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    );
  }
  if (type === "date") {
    return (
      <div className="ar-field">
        <div className="ar-label">{label}</div>
        <input
          type="date"
          className={`ar-in ar-in--date${bad ? " is-invalid" : ""}`}
          value={toDateInputValue(value)}
          onChange={(e) => setField(fieldKey, fromDateInputValue(e.target.value))}
        />
      </div>
    );
  }
  if (multiline) {
    return (
      <div className="ar-field">
        <div className="ar-label">{label}</div>
        <textarea
          className={`ar-in ar-in--area${bad ? " is-invalid" : ""}`}
          rows={3}
          value={value}
          onChange={(e) => setField(fieldKey, e.target.value)}
        />
      </div>
    );
  }
  return (
    <div className="ar-field">
      <div className="ar-label">{label}</div>
      <input
        type="text"
        className={`ar-in${bad ? " is-invalid" : ""}`}
        value={value}
        onChange={(e) => setField(fieldKey, e.target.value)}
      />
    </div>
  );
};

/**
 * Audit Report sheet — AQCTA-FOR-01-16 (matches PDF field set).
 */
export default function CertificationAuditReportForm({
  values = {},
  onChange,
  readOnly = false,
  invalidKeys = [],
  editableKeys = [],
  preparedSignature = "",
  onPreparedSignatureChange,
  profileSignature = "",
  preparedSignatureUrl = "",
  customerSignatureUrl = "",
  documentTitle = "",
  documentCode = "",
}) {
  const invalid = new Set(invalidKeys);
  const editable = useMemo(() => new Set(editableKeys), [editableKeys]);
  const canEdit = (key) => {
    if (readOnly) return false;
    if (!editableKeys?.length) return true;
    if (key.startsWith("productObs_") || key.startsWith("record_") || key.startsWith("test_")) {
      return true;
    }
    return editable.has(key);
  };
  const setField = (key, value) => onChange?.(key, value);

  const [obsCount, setObsCount] = useState(0);
  const [recordCount, setRecordCount] = useState(0);
  const [testCount, setTestCount] = useState(0);

  const productCount = Math.min(
    MAX_PRODUCT_OBS,
    Math.max(obsCount, deriveCount(values, "productObs", ["item", "observation"], MAX_PRODUCT_OBS)),
  );
  const recordsCount = Math.min(
    MAX_RECORDS,
    Math.max(recordCount, deriveCount(values, "record", ["name", "observation"], MAX_RECORDS)),
  );
  const testsCount = Math.min(
    MAX_TESTS,
    Math.max(testCount, deriveCount(values, "test", ["test", "result"], MAX_TESTS)),
  );

  const allowSign = Boolean(onPreparedSignatureChange) && !readOnly;
  const auditorSig = preparedSignature || preparedSignatureUrl;

  return (
    <div className="ar-page">
      <header className="ar-header">
        <h1 className="ar-title">{documentTitle || "AUDIT REPORT"}</h1>
        <div className="ar-form-code">
          {documentCode || "AQCTA-FOR-01-16"}
          <br />
          <em>Confidential</em>
        </div>
      </header>

      <section className="ar-section">
        <h2>Header</h2>
        <div className="ar-grid">
          <Field label="Date of Audit" fieldKey="auditDate" type="date" values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
          <Field label="Report No" fieldKey="reportNo" values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
          <Field label="Job No" fieldKey="jobNo" values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
          <Field label="File No" fieldKey="fileNo" values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
          <Field label="Std. No" fieldKey="standardNo" values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
        </div>
      </section>

      <section className="ar-section">
        <h2>1. Parties &amp; scope</h2>
        <div className="ar-grid">
          <Field label="1.1 Applicant/Licensee" fieldKey="applicant" values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
          <Field label="1.2 Manufacturer" fieldKey="manufacturer" values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
          <Field label="1.3 Address" fieldKey="address" multiline values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
          <Field label="1.4 Product(s)" fieldKey="products" values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
          <Field label="1.5 Scope of Audit" fieldKey="scopeOfAudit" multiline values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
        </div>
      </section>

      <section className="ar-section">
        <h2>2–3. Production &amp; system</h2>
        <div className="ar-grid">
          <Field label="2.0 Production during visit" fieldKey="productionDuringVisit" multiline values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
          <Field label="3.0 Audit basis — others" fieldKey="auditBasisOther" values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
          <Field label="3.1 Non-conformances raised" fieldKey="nonConformances" multiline values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
        </div>
      </section>

      <section className="ar-section">
        <h2>4.0 Product audit observations</h2>
        {Array.from({ length: productCount }, (_, i) => i + 1).map((index) => (
          <div className="ar-row" key={`obs-${index}`}>
            <Field
              label={`Item ${index}`}
              fieldKey={`productObs_${index}_item`}
              values={values}
              canEdit={canEdit}
              invalid={invalid}
              setField={setField}
            />
            <Field
              label="Observation"
              fieldKey={`productObs_${index}_observation`}
              multiline
              values={values}
              canEdit={canEdit}
              invalid={invalid}
              setField={setField}
            />
          </div>
        ))}
        {!readOnly && productCount < MAX_PRODUCT_OBS ? (
          <button type="button" className="ar-add" onClick={() => setObsCount(productCount + 1)}>
            Add observation
          </button>
        ) : null}
        <div className="ar-grid">
          <Field label="4.1 Marking method" fieldKey="markingMethod" values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
          <Field label="Marking in compliance?" fieldKey="markingCompliance" options={YES_NO} values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
        </div>
      </section>

      <section className="ar-section">
        <h2>5.0 Records</h2>
        {Array.from({ length: recordsCount }, (_, i) => i + 1).map((index) => (
          <div className="ar-row" key={`rec-${index}`}>
            <Field
              label={`Record ${index}`}
              fieldKey={`record_${index}_name`}
              values={values}
              canEdit={canEdit}
              invalid={invalid}
              setField={setField}
            />
            <Field
              label="Observation"
              fieldKey={`record_${index}_observation`}
              multiline
              values={values}
              canEdit={canEdit}
              invalid={invalid}
              setField={setField}
            />
          </div>
        ))}
        {!readOnly && recordsCount < MAX_RECORDS ? (
          <button type="button" className="ar-add" onClick={() => setRecordCount(recordsCount + 1)}>
            Add record
          </button>
        ) : null}
        <div className="ar-grid">
          <Field label="5.1 Control label serial Nos" fieldKey="controlSerialNos" values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
          <Field label="Quantity of labels" fieldKey="labelQuantity" values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
          <Field label="Records satisfactory?" fieldKey="recordsSatisfactory" options={YES_NO} values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
        </div>
      </section>

      <section className="ar-section">
        <h2>6–7. Samples &amp; tests</h2>
        <div className="ar-grid">
          <Field label="6.0 Samples selected?" fieldKey="samplesSelected" options={YES_NO} values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
        </div>
        {Array.from({ length: testsCount }, (_, i) => i + 1).map((index) => (
          <div className="ar-row" key={`test-${index}`}>
            <Field
              label={`Test ${index}`}
              fieldKey={`test_${index}_test`}
              values={values}
              canEdit={canEdit}
              invalid={invalid}
              setField={setField}
            />
            <Field
              label="Result"
              fieldKey={`test_${index}_result`}
              multiline
              values={values}
              canEdit={canEdit}
              invalid={invalid}
              setField={setField}
            />
          </div>
        ))}
        {!readOnly && testsCount < MAX_TESTS ? (
          <button type="button" className="ar-add" onClick={() => setTestCount(testsCount + 1)}>
            Add test
          </button>
        ) : null}
      </section>

      <section className="ar-section">
        <h2>8–12. Closing</h2>
        <div className="ar-grid">
          <Field label="8.0 Annexes" fieldKey="annexes" multiline values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
          <Field label="9.0 Corrective action" fieldKey="correctiveAction" multiline values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
          <Field label="10.0 Changes required" fieldKey="changesRequired" multiline values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
          <Field label="11.0 Summary of findings" fieldKey="summaryFindings" multiline values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
          <Field label="12.0 Recommendations" fieldKey="recommendations" multiline values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
        </div>
      </section>

      <section className="ar-section">
        <h2>Representatives</h2>
        <div className="ar-grid ar-grid--2">
          <div>
            <h3>AQCTA</h3>
            <Field label="Name" fieldKey="pciaRepName" values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
            <Field label="Factory Hours" fieldKey="pciaRepFactoryHours" values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
            <Field label="Date" fieldKey="pciaRepDate" type="date" values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
            {(allowSign || auditorSig) && (
              <div className="ar-sign">
                {allowSign ? (
                  <SignaturePad
                    compact
                    label="Auditor signature"
                    value={preparedSignature}
                    onChange={onPreparedSignatureChange}
                    profileSignature={profileSignature}
                    hint="Signing issues the report to the manufacturer for acknowledgement."
                  />
                ) : auditorSig ? (
                  <img className="ar-sign-img" src={auditorSig} alt="Auditor signature" />
                ) : null}
              </div>
            )}
          </div>
          <div>
            <h3>Manufacturer’s Representative</h3>
            <Field label="Name" fieldKey="manufacturerRepName" values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
            <Field label="Tel. No" fieldKey="manufacturerRepTel" values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
            <Field label="Email" fieldKey="manufacturerRepEmail" values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
            {customerSignatureUrl ? (
              <div className="ar-sign">
                <div className="ar-label">Customer signature</div>
                <img className="ar-sign-img" src={customerSignatureUrl} alt="Manufacturer signature" />
              </div>
            ) : (
              <p className="ar-hint">Manufacturer signs after the report is issued.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
