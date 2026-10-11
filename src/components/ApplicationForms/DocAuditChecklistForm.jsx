import React, { useMemo } from "react";
import SignaturePad from "@/components/ApplicationForms/SignaturePad";

const PCI_LOGO_SRC = `${process.env.PUBLIC_URL || ""}/aqcta-logo.png`;

/** Mirrors AQCTA-BE/ApplicationForms/docAuditItems.js */
export const DOC_AUDIT_ITEMS = [
  { key: "a_i", group: "A. General Information", label: "Is the applicant name clearly identified?" },
  { key: "a_ii", group: "A. General Information", label: "Is the factory address given?" },

  { key: "b1_i", group: "B1. Product Description", label: "Is the product to be certified clearly identified?" },
  { key: "b1_ii", group: "B1. Product Description", label: "Product Specification (model, size, range, rating, type, categories, etc)" },
  { key: "b1_iii", group: "B1. Product Description", label: "Is the Trade Mark / Brand name of the product to be certified clearly identified?" },
  { key: "b1_iv", group: "B1. Product Description", label: "Technical drawing (photograph / blueprint / brochure / catalogue)" },
  { key: "b1_v", group: "B1. Product Description", label: "Component Listing" },
  { key: "b1_vi", group: "B1. Product Description", label: "Raw material used (together with supplier certificate and/or relevant regulatory approval, if applicable)" },
  { key: "b1_vii", group: "B1. Product Description", label: "Operational Manual including installation instruction" },
  { key: "b1_viii", group: "B1. Product Description", label: "Circuit Diagram" },
  { key: "b1_ix", group: "B1. Product Description", label: "Labels or marking used on the product" },
  { key: "b1_x", group: "B1. Product Description", label: "Is the type of packaging and sizes stated correctly?" },

  { key: "b2_i", group: "B2. Type Test Report (if available)", label: "Is the test report issued by an accredited / AQCTA recognized laboratory?", starred: "**" },
  { key: "b2_ii", group: "B2. Type Test Report (if available)", label: "Is the report a full type test report?", starred: "**" },
  { key: "b2_iii", group: "B2. Type Test Report (if available)", label: "Does the test report cover the whole product range applying for the license?", starred: "**" },
  { key: "b2_iv", group: "B2. Type Test Report (if available)", label: "Validity of test report? (5 years or as specified by the relevant regulatory authority/WI)", starred: "**" },

  { key: "b3_i", group: "B3. Testing Facility (if no test report)", label: "Identification of testing facility — external testing laboratories" },
  { key: "b3_ii", group: "B3. Testing Facility (if no test report)", label: "If using an external testing laboratory, is it accredited and/or on the List of Accepted Laboratories?" },

  { key: "b4_i", group: "B4. Standard / Specification", label: "Are the Standard(s) for which the product is to be certified clearly identified?" },
  { key: "b4_ii", group: "B4. Standard / Specification", label: "Has the standard/specification been used for certification/listing before?" },
  { key: "b4_iii", group: "B4. Standard / Specification", label: "Is the standard used relevant to the product and is current?" },
  { key: "b4_iv", group: "B4. Standard / Specification", label: "Are there clauses which could not be tested?" },
  { key: "b4_v", group: "B4. Standard / Specification", label: "Is there any other supporting document for clauses that could not be tested?" },

  { key: "c_i", group: "C. Factory Information", label: "Is the company Organization Chart available and clearly identifying lines of responsibility?" },
  { key: "c_ii", group: "C. Factory Information", label: "Is the route map to the factory provided?" },

  { key: "d_i", group: "D. Quality Control Plan", label: "Is it complete (from raw material to finished goods)?", starred: "*" },
  { key: "d_ii", group: "D. Quality Control Plan", label: "Are all processes and QC points described adequately?", starred: "*" },
  { key: "d_iii_params", group: "D. Quality Control Plan", label: "Does each QC point state the parameters checked?", starred: "*" },
  { key: "d_iii_freq", group: "D. Quality Control Plan", label: "Does each QC point state the frequency of tests?", starred: "*" },
  { key: "d_iv", group: "D. Quality Control Plan", label: "Are the QC points sufficient to assure conformance of the product to applicable standard(s)?", starred: "*" },

  { key: "e_i", group: "E. Maintenance of Test Equipment", label: "Is test equipment maintained sufficient to conduct the tests described in the QC plan?", starred: "*" },
  { key: "e_ii", group: "E. Maintenance of Test Equipment", label: "Is test equipment calibrated by an accredited calibration laboratory?", starred: "*" },
  { key: "e_iii", group: "E. Maintenance of Test Equipment", label: "Frequency of calibration defined?", starred: "*" },
  { key: "e_iv", group: "E. Maintenance of Test Equipment", label: "Parameters calibrated cover the range used for testing?", starred: "*" },

  { key: "f", group: "F - H", label: "Is the batch or lot of product and batch coding system clearly defined?", starred: "*" },
  { key: "g", group: "F - H", label: "Is the list of test equipment and calibration schedule sufficient?", starred: "*" },
  { key: "h_i", group: "F - H", label: "Is the form AQCTA-F1-3 available?" },
  { key: "h_ii", group: "F - H", label: "Are there any other copies of letter / approval from a relevant department?" },
];

export const DOC_AUDIT_RESULT_OPTIONS = ["Yes", "No", "NA"];

export const DOC_AUDIT_EDITABLE_KEYS = [
  "workInstruction",
  ...DOC_AUDIT_ITEMS.flatMap((item) => [
    `${item.key}_result`,
    `${item.key}_remark`,
  ]),
  "acceptedToPreCert",
  "preCertDate",
  "acceptancePeriodFrom",
  "acceptancePeriodTo",
  "outcomeNotes",
];

const display = (value) => String(value ?? "").trim();

const resultMark = (value) => {
  const raw = display(value);
  if (raw === "Yes") return "✓";
  if (raw === "No") return "✗";
  if (raw === "NA") return "NA";
  return "";
};

const MarkChoice = ({ value, onChange, disabled, invalid }) => (
  <div className={`dac-marks${invalid ? " is-invalid" : ""}`}>
    {DOC_AUDIT_RESULT_OPTIONS.map((opt) => {
      const checked = value === opt;
      return (
        <button
          key={opt}
          type="button"
          className={`dac-mark-btn${checked ? " is-checked" : ""}`}
          aria-pressed={checked}
          disabled={disabled}
          title={opt}
          onClick={() => onChange?.(checked ? "" : opt)}
        >
          {opt === "Yes" ? "✓" : opt === "No" ? "✗" : "NA"}
        </button>
      );
    })}
  </div>
);

/**
 * Documentation audit checklist — matches
 * `templates/docAuditChecklist.html` (AQCTA-FOR-01-08).
 */
export default function DocAuditChecklistForm({
  values = {},
  onChange,
  readOnly = false,
  invalidKeys = [],
  editableKeys = [],
  preparedSignature = "",
  onPreparedSignatureChange,
  profileSignature = "",
  preparedSignatureUrl = "",
  documentTitle = "",
  documentCode = "",
}) {
  const invalid = new Set(invalidKeys);
  const editable = new Set(editableKeys);
  const canEdit = (key) => !readOnly && editable.has(key);
  const setField = (key, value) => onChange?.(key, value);

  const groups = useMemo(() => {
    const out = [];
    let current = null;
    for (const item of DOC_AUDIT_ITEMS) {
      if (!current || current.group !== item.group) {
        current = { group: item.group, items: [] };
        out.push(current);
      }
      current.items.push(item);
    }
    return out;
  }, []);

  const allowSign = Boolean(onPreparedSignatureChange) && !readOnly;
  const auditorSig = preparedSignature || preparedSignatureUrl;
  const showOutcomeDates = display(values.acceptedToPreCert) === "Yes";
  const acceptancePeriod = (() => {
    const from = display(values.acceptancePeriodFrom);
    const to = display(values.acceptancePeriodTo);
    if (!from && !to) return "";
    if (from && to) return `${from} to ${to}`;
    return from || to;
  })();

  return (
    <div className="dac-page">
      <header className="dac-header">
        <div className="dac-logo-box">
          <img className="dac-logo" src={PCI_LOGO_SRC} alt="AQCTA logo" />
        </div>
        <div className="dac-header-title">
          <h1>{documentTitle || "DOCUMENTATION AUDIT CHECKLIST"}</h1>
        </div>
        <div className="dac-form-code">
          {documentCode || "AQCTA-FOR-01-08"}
        </div>
      </header>

      <table className="dac-meta">
        <tbody>
          <tr>
            <td className="dac-lbl">Company</td>
            <td>{display(values.companyName)}</td>
            <td className="dac-lbl">Date received</td>
            <td>{display(values.dateReceived)}</td>
          </tr>
          <tr>
            <td className="dac-lbl">Product</td>
            <td>{display(values.productName)}</td>
            <td className="dac-lbl">File reference</td>
            <td>{display(values.fileReference)}</td>
          </tr>
          <tr>
            <td className="dac-lbl">Standard</td>
            <td>{display(values.productStandard)}</td>
            <td className="dac-lbl">Work instruction</td>
            <td>
              {canEdit("workInstruction") ? (
                <input
                  type="text"
                  className={`dac-in${
                    invalid.has("workInstruction") ? " is-invalid" : ""
                  }`}
                  value={values.workInstruction || ""}
                  placeholder="e.g. WI-PC-01"
                  onChange={(e) => setField("workInstruction", e.target.value)}
                />
              ) : (
                display(values.workInstruction)
              )}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="dac-legend">
        Mark: ✓ = Yes &nbsp;|&nbsp; ✗ = No &nbsp;|&nbsp; NA = Not applicable.
        Use remarks where useful.
      </div>

      {groups.map((group) => (
        <div key={group.group} className="dac-group">
          <div className="dac-group-title">{group.group}</div>
          <table className="dac-checklist">
            <thead>
              <tr>
                <th className="dac-col-item">Item</th>
                <th className="dac-col-mark">Mark</th>
                <th className="dac-col-remark">Remark</th>
              </tr>
            </thead>
            <tbody>
              {group.items.map((item) => {
                const resultKey = `${item.key}_result`;
                const remarkKey = `${item.key}_remark`;
                const label = item.starred
                  ? `${item.label} ${item.starred}`
                  : item.label;
                const rowInvalid =
                  invalid.has(resultKey) || invalid.has(remarkKey);
                return (
                  <tr
                    key={item.key}
                    className={rowInvalid ? "dac-row-invalid" : undefined}
                  >
                    <td className="dac-col-item">{label}</td>
                    <td className="dac-col-mark">
                      {canEdit(resultKey) ? (
                        <MarkChoice
                          value={values[resultKey] || ""}
                          invalid={invalid.has(resultKey)}
                          onChange={(next) => setField(resultKey, next)}
                        />
                      ) : (
                        <span className="dac-mark-ro">
                          {resultMark(values[resultKey])}
                        </span>
                      )}
                    </td>
                    <td className="dac-col-remark">
                      {canEdit(remarkKey) ? (
                        <input
                          type="text"
                          className={`dac-in${
                            invalid.has(remarkKey) ? " is-invalid" : ""
                          }`}
                          value={values[remarkKey] || ""}
                          onChange={(e) => setField(remarkKey, e.target.value)}
                        />
                      ) : (
                        display(values[remarkKey])
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      <div className="dac-outcome">
        <div className="dac-outcome-title">Outcome</div>
        <div className="dac-outcome-row">
          Accepted to pre-certification?{" "}
          {canEdit("acceptedToPreCert") ? (
            <MarkChoice
              value={values.acceptedToPreCert || ""}
              invalid={invalid.has("acceptedToPreCert")}
              onChange={(next) => setField("acceptedToPreCert", next)}
            />
          ) : (
            <span className="dac-mark-ro">
              {resultMark(values.acceptedToPreCert)}
            </span>
          )}
          &nbsp; Date:{" "}
          {showOutcomeDates && canEdit("preCertDate") ? (
            <input
              type="date"
              className={`dac-in dac-in--date${
                invalid.has("preCertDate") ? " is-invalid" : ""
              }`}
              value={values.preCertDate || ""}
              onChange={(e) => setField("preCertDate", e.target.value)}
            />
          ) : showOutcomeDates ? (
            display(values.preCertDate)
          ) : (
            "—"
          )}
        </div>
        {showOutcomeDates ? (
          <div className="dac-outcome-row">
            Acceptance period:{" "}
            {canEdit("acceptancePeriodFrom") || canEdit("acceptancePeriodTo") ? (
              <span className="dac-period-edit">
                <input
                  type="date"
                  className={`dac-in dac-in--date${
                    invalid.has("acceptancePeriodFrom") ? " is-invalid" : ""
                  }`}
                  value={values.acceptancePeriodFrom || ""}
                  disabled={!canEdit("acceptancePeriodFrom")}
                  onChange={(e) =>
                    setField("acceptancePeriodFrom", e.target.value)
                  }
                />
                <span>to</span>
                <input
                  type="date"
                  className={`dac-in dac-in--date${
                    invalid.has("acceptancePeriodTo") ? " is-invalid" : ""
                  }`}
                  value={values.acceptancePeriodTo || ""}
                  disabled={!canEdit("acceptancePeriodTo")}
                  onChange={(e) =>
                    setField("acceptancePeriodTo", e.target.value)
                  }
                />
              </span>
            ) : (
              acceptancePeriod || "—"
            )}
          </div>
        ) : null}
        <div className="dac-outcome-row">
          Notes:
          {canEdit("outcomeNotes") ? (
            <textarea
              className={`dac-notes${
                invalid.has("outcomeNotes") ? " is-invalid" : ""
              }`}
              rows={3}
              value={values.outcomeNotes || ""}
              onChange={(e) => setField("outcomeNotes", e.target.value)}
            />
          ) : (
            <div className="dac-notes-ro">{display(values.outcomeNotes)}</div>
          )}
        </div>
        <div className="dac-outcome-row">
          Recommended by: {display(values.recommendedBy) || "—"}
        </div>
      </div>

      <div className="dac-sig">
        <div className="dac-sig-role">Auditor</div>
        {allowSign ? (
          <SignaturePad
            compact
            label="Auditor signature"
            value={preparedSignature}
            onChange={onPreparedSignatureChange}
            profileSignature={profileSignature}
            hint="Signing issues the document. It cannot be edited afterwards."
          />
        ) : auditorSig ? (
          <img className="dac-sig-mark" src={auditorSig} alt="Auditor signature" />
        ) : null}
        <div className="dac-sig-line" />
        <div>
          ({display(values.auditorDeclaredName) || display(values.auditorName) || "—"})
        </div>
        <div>Date: {display(values.auditorSignedDate) || "—"}</div>
      </div>

      <footer className="dac-footer">
        <div>
          AQC Technical Assessors (M) Sdn. Bhd.
          <br />
          Issue: 1 Rev: 0
        </div>
        <div className="dac-footer-center">Certification</div>
        <div className="dac-footer-right">Page 1/1</div>
      </footer>
    </div>
  );
}
