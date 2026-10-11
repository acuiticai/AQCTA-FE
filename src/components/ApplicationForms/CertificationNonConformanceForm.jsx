import React, { useMemo } from "react";
import SignaturePad from "@/components/ApplicationForms/SignaturePad";

const CA_OPTIONS = [
  "Corrective action during audit",
  "Corrective action plan within 30 days",
];

export const NON_CONFORMANCE_EDITABLE_KEYS = [
  "ncrNo",
  "reportNo",
  "standardClause",
  "findings",
  "correctiveActionType",
  "caSubmissionDate",
  "completionDate",
  "correctiveAction",
  "manufacturerRepTel",
  "manufacturerRepFax",
  "verification",
  "clearedNewNcrNo",
  "verificationDate",
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
  options,
}) => {
  const value = values[fieldKey] || "";
  const bad = invalid.has(fieldKey);
  if (!canEdit(fieldKey)) {
    return (
      <div className="ncr-field">
        <div className="ncr-label">{label}</div>
        <div className="ncr-value">{display(value) || "—"}</div>
      </div>
    );
  }
  if (options) {
    return (
      <div className="ncr-field">
        <div className="ncr-label">{label}</div>
        <select
          className={`ncr-in${bad ? " is-invalid" : ""}`}
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
      <div className="ncr-field">
        <div className="ncr-label">{label}</div>
        <input
          type="date"
          className={`ncr-in ncr-in--date${bad ? " is-invalid" : ""}`}
          value={toDateInputValue(value)}
          onChange={(e) =>
            setField(fieldKey, fromDateInputValue(e.target.value))
          }
        />
      </div>
    );
  }
  if (multiline) {
    return (
      <div className="ncr-field">
        <div className="ncr-label">{label}</div>
        <textarea
          className={`ncr-in ncr-in--area${bad ? " is-invalid" : ""}`}
          rows={4}
          value={value}
          onChange={(e) => setField(fieldKey, e.target.value)}
        />
      </div>
    );
  }
  return (
    <div className="ncr-field">
      <div className="ncr-label">{label}</div>
      <input
        type="text"
        className={`ncr-in${bad ? " is-invalid" : ""}`}
        value={value}
        onChange={(e) => setField(fieldKey, e.target.value)}
      />
    </div>
  );
};

/**
 * Non-Conformance Report — AQCTA-FOR-01-14.
 */
export default function CertificationNonConformanceForm({
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
    return editable.has(key);
  };
  const setField = (key, value) => onChange?.(key, value);
  const allowSign = Boolean(onPreparedSignatureChange) && !readOnly;
  const auditorSig = preparedSignature || preparedSignatureUrl;

  return (
    <div className="ncr-page">
      <header className="ncr-header">
        <div className="ncr-conf">CONFIDENTIAL</div>
        <h1 className="ncr-title">
          {documentTitle || "NON-CONFORMANCE REPORT"}
        </h1>
        <div className="ncr-form-code">
          {documentCode || "AQCTA-FOR-01-14"}
        </div>
      </header>

      <section className="ncr-section">
        <h2>Header</h2>
        <div className="ncr-grid">
          <Field label="Date" fieldKey="date" type="date" values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
          <Field label="NCR No" fieldKey="ncrNo" values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
          <Field label="Manufacturer" fieldKey="manufacturer" values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
          <Field label="Report No" fieldKey="reportNo" values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
          <Field label="File Ref" fieldKey="fileRef" values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
        </div>
      </section>

      <section className="ncr-section">
        <h2>1.0 Details of Non-Conformance</h2>
        <div className="ncr-grid">
          <Field label="Standard / Clause / Requirement" fieldKey="standardClause" values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
          <Field label="Findings" fieldKey="findings" multiline values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
        </div>
      </section>

      <section className="ncr-section">
        <h2>2.0 Corrective Action</h2>
        <div className="ncr-grid">
          <Field label="Corrective action type" fieldKey="correctiveActionType" options={CA_OPTIONS} values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
          <Field label="C.A. Submission Date" fieldKey="caSubmissionDate" type="date" values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
          <Field label="Completion Date" fieldKey="completionDate" type="date" values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
          <Field label="Detail Action" fieldKey="correctiveAction" multiline values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
        </div>
        <div className="ncr-grid ncr-grid--2">
          <div>
            <h3>AQCTA Representative</h3>
            <Field label="Name" fieldKey="pciRepName" values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
            {(allowSign || auditorSig) && (
              <div className="ncr-sign">
                {allowSign ? (
                  <SignaturePad
                    compact
                    label="Auditor signature"
                    value={preparedSignature}
                    onChange={onPreparedSignatureChange}
                    profileSignature={profileSignature}
                    hint="Signing issues the NCR for manufacturer acknowledgement."
                  />
                ) : auditorSig ? (
                  <img className="ncr-sign-img" src={auditorSig} alt="Auditor signature" />
                ) : null}
              </div>
            )}
          </div>
          <div>
            <h3>Manufacturer’s Representative</h3>
            <Field label="Name" fieldKey="manufacturerRepName" values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
            <Field label="Tel. No" fieldKey="manufacturerRepTel" values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
            <Field label="Fax No" fieldKey="manufacturerRepFax" values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
            {customerSignatureUrl ? (
              <div className="ncr-sign">
                <div className="ncr-label">Customer signature</div>
                <img className="ncr-sign-img" src={customerSignatureUrl} alt="Manufacturer signature" />
              </div>
            ) : (
              <p className="ncr-hint">Manufacturer signs after the NCR is issued.</p>
            )}
          </div>
        </div>
      </section>

      <section className="ncr-section">
        <h2>3.0 Verification of Corrective Action</h2>
        <div className="ncr-grid">
          <Field label="Verification notes" fieldKey="verification" multiline values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
          <Field label="Cleared / New NCR No" fieldKey="clearedNewNcrNo" values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
          <Field label="Verification Date" fieldKey="verificationDate" type="date" values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
        </div>
      </section>
    </div>
  );
}
