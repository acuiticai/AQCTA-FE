import React, { useMemo } from "react";
import SignaturePad from "@/components/ApplicationForms/SignaturePad";

export const LAB_ACCEPTANCE_EDITABLE_KEYS = [
  "agreeUndertakeTesting",
  "requisitionDate",
  "productName",
  "agreeNotInvolvedDesign",
  "undertakeConfidentiality",
  "authorisedSignatory",
  "laboratoryNameAndAddress",
];

const display = (value) => String(value ?? "").trim();

const isChecked = (value) => {
  const raw = display(value).toLowerCase();
  return raw === "true" || raw === "yes" || raw === "1" || raw === "on";
};

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

/**
 * Acceptance by Testing Laboratory — AQCTA-FOR-01-18.
 */
export default function CertificationLabAcceptanceForm({
  values = {},
  onChange,
  readOnly = false,
  invalidKeys = [],
  editableKeys = [],
  preparedSignature = "",
  onPreparedSignatureChange,
  profileSignature = "",
  preparedSignatureUrl = "",
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

  const CheckRow = ({ fieldKey, children, after }) => {
    const checked = isChecked(values[fieldKey]);
    const bad = invalid.has(fieldKey);
    const edit = canEdit(fieldKey);
    return (
      <label className={`la-check${bad ? " is-invalid" : ""}`}>
        {edit ? (
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) =>
              setField(fieldKey, e.target.checked ? "true" : "false")
            }
          />
        ) : (
          <span className={`la-box${checked ? " is-on" : ""}`}>
            {checked ? "✓" : ""}
          </span>
        )}
        <span className="la-check-text">
          {children}
          {after}
        </span>
      </label>
    );
  };

  return (
    <div className="la-page">
      <header className="la-header">
        <h1 className="la-title">ACCEPTANCE BY TESTING LABORATORY</h1>
        <div className="la-form-code">AQCTA-FOR-01-18</div>
      </header>

      <section className="la-section">
        <h2>Laboratory agreements</h2>
        <CheckRow fieldKey="agreeUndertakeTesting">
          We agree to undertake the product testing as detailed in the
          Requisition for Testing (AQCTA-FOR-01-17) dated{" "}
          {canEdit("requisitionDate") ? (
            <input
              type="date"
              className={`la-inline${invalid.has("requisitionDate") ? " is-invalid" : ""}`}
              value={toDateInputValue(values.requisitionDate)}
              onChange={(e) =>
                setField("requisitionDate", fromDateInputValue(e.target.value))
              }
            />
          ) : (
            <span className="la-inline-ro">
              {display(values.requisitionDate) || "________"}
            </span>
          )}{" "}
          for product{" "}
          {canEdit("productName") ? (
            <input
              type="text"
              className={`la-inline la-inline--wide${invalid.has("productName") ? " is-invalid" : ""}`}
              value={values.productName || ""}
              onChange={(e) => setField("productName", e.target.value)}
            />
          ) : (
            <span className="la-inline-ro">
              {display(values.productName) || "________"}
            </span>
          )}{" "}
          and to the arrangements with regard to test reports and payments as
          stated in the Requisition;
        </CheckRow>
        <CheckRow fieldKey="agreeNotInvolvedDesign">
          We agree not involved with the design or production of the product
          being submitted for testing;
        </CheckRow>
        <CheckRow fieldKey="undertakeConfidentiality">
          We undertake to maintain the confidentiality in matters to the
          Requisition.
        </CheckRow>
      </section>

      <section className="la-section">
        <h2>Authorised signatory</h2>
        <div className="la-field">
          <div className="la-label">Name</div>
          {canEdit("authorisedSignatory") ? (
            <input
              type="text"
              className={`la-in${invalid.has("authorisedSignatory") ? " is-invalid" : ""}`}
              value={values.authorisedSignatory || ""}
              onChange={(e) => setField("authorisedSignatory", e.target.value)}
            />
          ) : (
            <div className="la-value">
              {display(values.authorisedSignatory) || "—"}
            </div>
          )}
        </div>
        <div className="la-field">
          <div className="la-label">Laboratory Name and Address</div>
          {canEdit("laboratoryNameAndAddress") ? (
            <textarea
              className={`la-in la-in--area${invalid.has("laboratoryNameAndAddress") ? " is-invalid" : ""}`}
              rows={5}
              value={values.laboratoryNameAndAddress || ""}
              onChange={(e) =>
                setField("laboratoryNameAndAddress", e.target.value)
              }
            />
          ) : (
            <div className="la-value la-value--pre">
              {display(values.laboratoryNameAndAddress) || "—"}
            </div>
          )}
        </div>
        {(allowSign || auditorSig) && (
          <div className="la-sign">
            {allowSign ? (
              <SignaturePad
                compact
                label="Authorised signatory mark"
                value={preparedSignature}
                onChange={onPreparedSignatureChange}
                profileSignature={profileSignature}
                hint="Capture the laboratory authorised signature to complete this form."
              />
            ) : auditorSig ? (
              <img
                className="la-sign-img"
                src={auditorSig}
                alt="Authorised signature"
              />
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
