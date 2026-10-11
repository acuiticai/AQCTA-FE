import React from "react";
import SignaturePad from "@/components/ApplicationForms/SignaturePad";

const PCI_LOGO_SRC = `${process.env.PUBLIC_URL || ""}/aqcta-logo.png`;

const APPOINTMENT_TYPES = [
  "Appointment / Reassignment as Auditor",
  "Contract Auditor",
  "Trainee Auditor",
];

const display = (value) => String(value ?? "").trim();

const TickBox = ({ checked, onClick, disabled, invalid }) => (
  <button
    type="button"
    className={`cal-box${checked ? " is-checked" : ""}${
      invalid ? " is-invalid" : ""
    }`}
    aria-pressed={checked}
    disabled={disabled}
    onClick={onClick}
  >
    {checked ? "✓" : ""}
  </button>
);

/**
 * Assignment letter to auditor — matches
 * `templates/assignmentLetter.html` (AQCTA-FOR-01-10).
 */
export default function CertificationAssignmentLetterForm({
  values = {},
  onChange,
  readOnly = false,
  invalidKeys = [],
  editableKeys = [],
  preparedSignature = "",
  onPreparedSignatureChange,
  profileSignature = "",
  preparedSignatureUrl = "",
  auditorSignatureUrl = "",
  documentTitle = "",
  documentCode = "",
}) {
  const invalid = new Set(invalidKeys);
  const editable = new Set(editableKeys);
  const canEdit = (key) => !readOnly && editable.has(key);
  const setField = (key, value) => onChange?.(key, value);

  const appointmentType = display(values.appointmentType);
  const allowSign = Boolean(onPreparedSignatureChange) && !readOnly;
  const managerSig = preparedSignature || preparedSignatureUrl;

  return (
    <div className="cal-page">
      <header className="cal-header">
        <div className="cal-company-box">
          <img className="cal-logo" src={PCI_LOGO_SRC} alt="AQCTA logo" />
          <div className="cal-company-info">
            <div>Certification Group</div>
            <div>Conformity Assessment Department</div>
            <div>AQC Technical Assessors (M) Sdn. Bhd.</div>
          </div>
        </div>
        <div className="cal-form-no">
          {documentCode || "AQCTA-FOR-01-10"}
        </div>
      </header>
      <hr className="cal-header-rule" />

      <table className="cal-people-table">
        <tbody>
          <tr>
            <td>
              <div className="cal-field-row">
                <span className="cal-field-label">Assigned Auditor :</span>{" "}
                <span>{display(values.auditorName)}</span>
              </div>
              <div className="cal-field-row">
                <span className="cal-field-label">Competency level :</span>{" "}
                {canEdit("auditorCompetency") ? (
                  <input
                    type="text"
                    className={`cal-in${
                      invalid.has("auditorCompetency") ? " is-invalid" : ""
                    }`}
                    value={values.auditorCompetency || ""}
                    placeholder="e.g. Lead Auditor"
                    onChange={(e) =>
                      setField("auditorCompetency", e.target.value)
                    }
                  />
                ) : (
                  display(values.auditorCompetency)
                )}
              </div>
            </td>
            <td>
              <div className="cal-field-row">
                <span className="cal-field-label">
                  Co-ordinator (if applicable) :
                </span>{" "}
                {canEdit("coordinatorName") ? (
                  <input
                    type="text"
                    className="cal-in"
                    value={values.coordinatorName || ""}
                    onChange={(e) =>
                      setField("coordinatorName", e.target.value)
                    }
                  />
                ) : (
                  display(values.coordinatorName)
                )}
              </div>
              <div className="cal-field-row">
                <span className="cal-field-label">Competency level :</span>{" "}
                {canEdit("coordinatorCompetency") ? (
                  <input
                    type="text"
                    className="cal-in"
                    value={values.coordinatorCompetency || ""}
                    onChange={(e) =>
                      setField("coordinatorCompetency", e.target.value)
                    }
                  />
                ) : (
                  display(values.coordinatorCompetency)
                )}
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <h1 className="cal-title">
        {documentTitle || "LETTER OF ASSIGNMENT / REASSIGNMENT TO AUDITOR"}
      </h1>

      <div
        className={`cal-type-row${
          invalid.has("appointmentType") ? " is-invalid" : ""
        }`}
      >
        {APPOINTMENT_TYPES.map((opt) => (
          <span className="cal-type-opt" key={opt}>
            <TickBox
              checked={appointmentType === opt}
              disabled={!canEdit("appointmentType")}
              onClick={() =>
                setField(
                  "appointmentType",
                  appointmentType === opt ? "" : opt,
                )
              }
            />{" "}
            {opt}
          </span>
        ))}
      </div>

      <p className="cal-appoint-line">
        You are hereby appointed / reassigned as Auditor for Section{" "}
        {canEdit("sectionName") ? (
          <input
            type="text"
            className={`cal-underline-in${
              invalid.has("sectionName") ? " is-invalid" : ""
            }`}
            value={values.sectionName || ""}
            placeholder="e.g. Conformity Assessment"
            onChange={(e) => setField("sectionName", e.target.value)}
          />
        ) : (
          <span className="cal-underline">{display(values.sectionName)}</span>
        )}{" "}
        to carry out{" "}
        {canEdit("workDescription") ? (
          <input
            type="text"
            className={`cal-underline-in cal-underline-in--wide${
              invalid.has("workDescription") ? " is-invalid" : ""
            }`}
            value={values.workDescription || ""}
            placeholder="e.g. Factory audit and product sampling"
            onChange={(e) => setField("workDescription", e.target.value)}
          />
        ) : (
          <span className="cal-underline">
            {display(values.workDescription)}
          </span>
        )}{" "}
        at the following company:
      </p>

      <table className="cal-company-table">
        <tbody>
          <tr>
            <td className="cal-lbl">Applicant company</td>
            <td>{display(values.companyName)}</td>
            <td className="cal-lbl">SIC code</td>
            <td>
              {canEdit("sicCode") ? (
                <input
                  type="text"
                  className="cal-in"
                  value={values.sicCode || ""}
                  onChange={(e) => setField("sicCode", e.target.value)}
                />
              ) : (
                display(values.sicCode)
              )}
            </td>
          </tr>
          <tr>
            <td className="cal-lbl">Address</td>
            <td className="cal-pre">{display(values.companyAddress)}</td>
            <td className="cal-lbl">Product</td>
            <td>{display(values.productName)}</td>
          </tr>
          <tr>
            <td className="cal-lbl">Name of MR</td>
            <td>
              {canEdit("nameOfMR") ? (
                <input
                  type="text"
                  className="cal-in"
                  value={values.nameOfMR || ""}
                  placeholder="Management representative"
                  onChange={(e) => setField("nameOfMR", e.target.value)}
                />
              ) : (
                display(values.nameOfMR)
              )}
            </td>
            <td className="cal-lbl">Category</td>
            <td>
              {canEdit("productCategory") ? (
                <input
                  type="text"
                  className="cal-in"
                  value={values.productCategory || ""}
                  onChange={(e) => setField("productCategory", e.target.value)}
                />
              ) : (
                display(values.productCategory)
              )}
            </td>
          </tr>
          <tr>
            <td className="cal-lbl">File no</td>
            <td>{display(values.fileNo)}</td>
            <td className="cal-lbl">Standard</td>
            <td>
              {canEdit("productStandard") ? (
                <input
                  type="text"
                  className="cal-in"
                  value={values.productStandard || ""}
                  placeholder="e.g. MS 1234:2020"
                  onChange={(e) => setField("productStandard", e.target.value)}
                />
              ) : (
                display(values.productStandard)
              )}
            </td>
          </tr>
        </tbody>
      </table>

      <p className="cal-returns">
        Please return the following forms within fourteen (14) days of the
        visit:{" "}
        {canEdit("formsToReturn") ? (
          <input
            type="text"
            className="cal-underline-in cal-underline-in--wide"
            value={values.formsToReturn || ""}
            placeholder="e.g. AQCTA-FOR-01-12, AQCTA-FOR-01-13"
            onChange={(e) => setField("formsToReturn", e.target.value)}
          />
        ) : (
          <span className="cal-underline">
            {display(values.formsToReturn)}
          </span>
        )}
      </p>

      <p className="cal-notice">
        Please note that you are required to declare your interest to the
        Manager if you have been employed by, provided consultancy services to
        the applicant, or been involved in the design or development of the
        product being considered for certification at any time during the last
        two years.
      </p>
      <p className="cal-notice">
        You are also reminded to adhere to the Auditor Code of Ethics at all
        times. Please consult the Manager should you require further
        clarification.
      </p>

      <div className="cal-sigs">
        <div className="cal-sig-block">
          <div className="cal-sig-role">Manager</div>
          {allowSign ? (
            <SignaturePad
              compact
              label="Manager signature"
              value={preparedSignature}
              onChange={onPreparedSignatureChange}
              profileSignature={profileSignature}
              hint="Signing issues the document. It cannot be edited afterwards."
            />
          ) : managerSig ? (
            <img
              className="cal-sig-mark"
              src={managerSig}
              alt="Manager signature"
            />
          ) : null}
          <div className="cal-sig-line" />
          <div>({display(values.managerName) || "—"})</div>
          <div>Date: {display(values.managerSignedDate) || "—"}</div>
        </div>
        <div className="cal-sig-block">
          <div className="cal-sig-role">Auditor acceptance</div>
          <div>
            I, {display(values.auditorDeclaredName) || "—"}, NRIC{" "}
            {display(values.auditorNric) || "—"}, accept this assignment.
          </div>
          {auditorSignatureUrl ? (
            <img
              className="cal-sig-mark"
              src={auditorSignatureUrl}
              alt="Auditor signature"
            />
          ) : null}
          <div className="cal-sig-line" />
          <div>Date: {display(values.auditorSignedDate) || "—"}</div>
          <p className="cal-sig-hint">
            The assigned auditor signs via the signing panel after the letter
            is issued.
          </p>
        </div>
      </div>

      <footer className="cal-footer">
        <div>
          AQC Technical Assessors (M) Sdn. Bhd.
          <br />
          Issue: 1 Rev: 1
        </div>
        <div className="cal-footer-center">Certification</div>
        <div className="cal-footer-right">Page 1/1</div>
      </footer>
    </div>
  );
}
