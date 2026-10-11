import React, { useMemo } from "react";
import Combobox from "@/customer/components/ui/Combobox";
import SignaturePad from "@/components/ApplicationForms/SignaturePad";

const PCI_LOGO_SRC = `${process.env.PUBLIC_URL || ""}/aqcta-logo.png`;

const display = (value) => {
  const text = String(value ?? "").trim();
  return text || "";
};

/**
 * Inspector appointment letter fill UI — matches
 * `templates/inspectorAppointmentLetter.html` (AQCTA-FOR-06-06).
 *
 * Job fields are bound from the application. Co-ordinator is optional (other
 * inspectors). Manager signature is drawn on the letter before issue.
 */
export default function InspectorAppointmentLetterForm({
  values = {},
  onChange,
  readOnly = false,
  invalidKeys = [],
  editableKeys = [],
  coordinatorOptions = [],
  preparedSignature = "",
  onPreparedSignatureChange,
  profileSignature = "",
  preparedSignatureUrl = "",
}) {
  const invalid = new Set(invalidKeys);
  const editable = new Set(editableKeys);
  const canEdit = (key) => !readOnly && editable.has(key);
  const setField = (key, value) => onChange?.(key, value);

  const coordinatorList = useMemo(() => {
    const mapped = (Array.isArray(coordinatorOptions) ? coordinatorOptions : [])
      .map((opt) =>
        typeof opt === "string"
          ? { value: opt, label: opt }
          : {
              value: String(opt?.value || opt?.label || opt?.name || "").trim(),
              label: String(opt?.label || opt?.value || opt?.name || "").trim(),
            },
      )
      .filter((opt) => opt.value);
    const current = String(values.assignedCoordinator || "").trim();
    if (current && !mapped.some((opt) => opt.value === current)) {
      mapped.unshift({ value: current, label: current });
    }
    return mapped;
  }, [coordinatorOptions, values.assignedCoordinator]);

  const letterDate = display(values.letterDate || values.date);
  const managerName = display(values.managerName);
  const signatureSrc = preparedSignature || preparedSignatureUrl;
  /* Signature is collectable when the sheet owns issuing — StageFormCard
     gates via canPrepare / readOnly. */
  const allowSign = Boolean(onPreparedSignatureChange) && !readOnly;

  return (
    <div className="ial-page">
      <header className="ial-header">
        <div className="ial-company-box">
          <img className="ial-logo" src={PCI_LOGO_SRC} alt="AQCTA logo" />
          <div className="ial-company-info">
            <div>Inspection Group</div>
            <div>Conformity Assessment Department</div>
            <div>AQC Technical Assessors (M) Sdn. Bhd.</div>
          </div>
        </div>
        <div className="ial-master-area">
          <div className="ial-form-no">AQCTA-FOR-06-06</div>
        </div>
      </header>

      <hr className="ial-header-rule" />

      <table className="ial-assignment-table">
        <tbody>
          <tr>
            <td>
              <div className="ial-field-row">
                <span className="ial-field-label">Assigned Inspector :</span>{" "}
                <span className="ial-field-value">
                  {display(values.assignedInspector)}
                </span>
              </div>
              <div className="ial-field-row">
                <span className="ial-field-label">
                  Assigned co-ordinator:
                  <br />
                  (If applicable)
                </span>{" "}
                {canEdit("assignedCoordinator") ? (
                  <span
                    className={`ial-field-control${
                      invalid.has("assignedCoordinator") ? " ial-invalid" : ""
                    }`}
                  >
                    <Combobox
                      value={values.assignedCoordinator || ""}
                      onChange={(v) => setField("assignedCoordinator", v)}
                      options={coordinatorList}
                      placeholder="Choose a co-ordinator…"
                      clearable
                      searchable={coordinatorList.length > 6}
                    />
                  </span>
                ) : (
                  <span className="ial-field-value">
                    {display(values.assignedCoordinator)}
                  </span>
                )}
              </div>
            </td>
            <td>
              <div className="ial-field-row">
                <span className="ial-field-label">From:</span>{" "}
                {canEdit("from") ? (
                  <input
                    type="text"
                    className={`ial-in${invalid.has("from") ? " ial-invalid" : ""}`}
                    value={values.from || ""}
                    onChange={(e) => setField("from", e.target.value)}
                  />
                ) : (
                  <span className="ial-field-value">{display(values.from)}</span>
                )}
              </div>
              <div className="ial-field-row">
                <span className="ial-field-label">
                  Group: Engineering Inspection
                </span>
              </div>
              <div className="ial-field-row">
                <span className="ial-field-label">Date :</span>{" "}
                {canEdit("letterDate") ? (
                  <input
                    type="date"
                    className={`ial-in${
                      invalid.has("letterDate") ? " ial-invalid" : ""
                    }`}
                    value={values.letterDate || ""}
                    onChange={(e) => setField("letterDate", e.target.value)}
                  />
                ) : (
                  <span className="ial-field-value">{letterDate}</span>
                )}
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <main className="ial-main">
        <h1 className="ial-title">
          LETTER OF APPOINTMENT/REASSIGNMENT AS INSPECTOR
        </h1>

        <p className="ial-intro">
          You are hereby appointed / reassigned as Inspector for the following:
        </p>

        <p className="ial-detail-line">
          <span className="ial-detail-label">Project Name:</span>
          <span className="ial-detail-value">
            {display(values.projectName)}
          </span>
        </p>
        <p className="ial-detail-line">
          <span className="ial-detail-label">Applicant Company:</span>
          <span className="ial-detail-value">
            {display(values.applicantCompany)}
          </span>
        </p>
        <p className="ial-detail-line">
          <span className="ial-detail-label">
            Job no / File No: (if applicable):
          </span>
          <span className="ial-detail-value">
            {display(values.jobFileNo)}
          </span>
        </p>

        <p className="ial-notice">
          Please note that you are required to declare your interest to the
          Manager, if you have been employed by, provided consultancy services
          to the applicant, or been involved in the design or development of
          the product being considered for inspection at anytime during the
          last two years.
        </p>

        <p className="ial-notice">
          You are also reminded to adhere to the Inspector Code of Ethics at
          all times (please refer to Annex A of IS/DOC/04-1). Please consult
          the Manager should you require further clarification.
        </p>

        <div className="ial-signature">
          {allowSign ? (
            <SignaturePad
              compact
              label="Manager signature"
              value={preparedSignature}
              onChange={onPreparedSignatureChange}
              profileSignature={profileSignature}
              hint="Signing issues the document. It cannot be edited afterwards."
            />
          ) : signatureSrc ? (
            <img
              className="ial-signature-mark"
              src={signatureSrc}
              alt="Manager signature"
            />
          ) : null}
          <div className="ial-signature-line" />
          <div className="ial-signature-name">
            ({managerName || "—"})
          </div>
          <div>Manager</div>
          <div>Inspection Group</div>
        </div>
      </main>

      <footer className="ial-footer">
        <div>
          AQC Technical Assessors (M) Sdn. Bhd.
          <br />
          Issue: 1 Rev: 0
        </div>
        <div className="ial-footer-center">Inspection</div>
        <div className="ial-footer-right">Page 1/1</div>
      </footer>
    </div>
  );
}
