import React from "react";

export const CERTIFICATION_DELIBERATION_EDITABLE_KEYS = [
  "issue",
  "standard",
  "description",
  "recommendation",
  "panelDecision",
  "comments",
  "supportedByName",
  "supportedDate",
];

const PANEL_OPTIONS = ["Approved", "Not Approved"];

const display = (value) => String(value ?? "").trim();

/**
 * Issue for Certification Panel Deliberation — matches
 * `templates/certificationDeliberation.html` (AQCTA-FOR-01-20).
 */
export default function CertificationDeliberationForm({
  values = {},
  onChange,
  readOnly = false,
  invalidKeys = [],
  editableKeys = [],
  documentTitle = "",
  documentCode = "",
}) {
  const invalid = new Set(invalidKeys);
  const editable = new Set(editableKeys);
  const canEdit = (key) => !readOnly && editable.has(key);
  const setField = (key, value) => onChange?.(key, value);

  const panelDecision = display(values.panelDecision);

  return (
    <div className="cdel-page">
      <div className="cdel-code">{documentCode || "AQCTA-FOR-01-20"}</div>

      <h1 className="cdel-title">
        {documentTitle || "ISSUE FOR CERTIFICATION PANEL DELIBERATION"}
        <span className="cdel-title-sub">(Conformity Assessment Scheme)</span>
      </h1>

      <table className="cdel-table">
        <tbody>
          <tr className="cdel-row-issue">
            <td className="cdel-lbl">Issue:</td>
            <td className={`cdel-val${canEdit("issue") ? " is-editing" : ""}`}>
              {canEdit("issue") ? (
                <input
                  type="text"
                  className={`cdel-in${invalid.has("issue") ? " is-invalid" : ""}`}
                  value={values.issue || ""}
                  onChange={(e) => setField("issue", e.target.value)}
                  placeholder="e.g. Initial Certification"
                  autoComplete="off"
                />
              ) : (
                display(values.issue) || "—"
              )}
            </td>
          </tr>
          <tr>
            <td className="cdel-lbl">Company:</td>
            <td className="cdel-val">{display(values.company) || "—"}</td>
          </tr>
          <tr>
            <td className="cdel-lbl">File No:</td>
            <td className="cdel-val">{display(values.fileNo) || "—"}</td>
          </tr>
          <tr>
            <td className="cdel-lbl">Product:</td>
            <td className="cdel-val">{display(values.product) || "—"}</td>
          </tr>
          <tr>
            <td className="cdel-lbl">Standard:</td>
            <td
              className={`cdel-val${canEdit("standard") ? " is-editing" : ""}`}
            >
              {canEdit("standard") ? (
                <textarea
                  className={`cdel-in cdel-in--area${
                    invalid.has("standard") ? " is-invalid" : ""
                  }`}
                  value={values.standard || ""}
                  onChange={(e) => setField("standard", e.target.value)}
                  rows={2}
                />
              ) : (
                display(values.standard) || "—"
              )}
            </td>
          </tr>
          <tr className="cdel-row-tall">
            <td className="cdel-lbl">Description:</td>
            <td
              className={`cdel-val${
                canEdit("description") ? " is-editing" : ""
              }`}
            >
              {canEdit("description") ? (
                <textarea
                  className={`cdel-in cdel-in--area${
                    invalid.has("description") ? " is-invalid" : ""
                  }`}
                  value={values.description || ""}
                  onChange={(e) => setField("description", e.target.value)}
                  rows={4}
                />
              ) : (
                <div className="cdel-pre">
                  {display(values.description) || "—"}
                </div>
              )}
            </td>
          </tr>
          <tr className="cdel-row-tall">
            <td className="cdel-lbl">Recommendation:</td>
            <td
              className={`cdel-val${
                canEdit("recommendation") ? " is-editing" : ""
              }`}
            >
              {canEdit("recommendation") ? (
                <textarea
                  className={`cdel-in cdel-in--area${
                    invalid.has("recommendation") ? " is-invalid" : ""
                  }`}
                  value={values.recommendation || ""}
                  onChange={(e) => setField("recommendation", e.target.value)}
                  rows={4}
                />
              ) : (
                <div className="cdel-pre">
                  {display(values.recommendation) || "—"}
                </div>
              )}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="cdel-decision">
        <div className="cdel-decision-label">
          Certification Panel Decision:
        </div>
        <div
          className={`cdel-decision-value${
            invalid.has("panelDecision") ? " is-invalid" : ""
          }`}
        >
          {canEdit("panelDecision") ? (
            <div className="cdel-radios">
              {PANEL_OPTIONS.map((opt) => (
                <label key={opt} className="cdel-radio">
                  <input
                    type="radio"
                    name="panelDecision"
                    checked={panelDecision === opt}
                    onChange={() => setField("panelDecision", opt)}
                  />
                  {opt}
                </label>
              ))}
            </div>
          ) : (
            panelDecision || "Approved / Not Approved"
          )}
        </div>
      </div>

      <div className="cdel-comments">
        <div className="cdel-comments-label">Comments:</div>
        {canEdit("comments") ? (
          <textarea
            className={`cdel-in cdel-in--area${
              invalid.has("comments") ? " is-invalid" : ""
            }`}
            value={values.comments || ""}
            onChange={(e) => setField("comments", e.target.value)}
            rows={3}
          />
        ) : (
          <div className="cdel-comments-area">
            {display(values.comments) || "\u00a0"}
          </div>
        )}
      </div>

      <div className="cdel-approval">
        <div className="cdel-approval-col">
          <div className="cdel-approval-head">Submitted by:</div>
          <div className="cdel-sig-space">
            {display(values.submittedByName) || "—"}
          </div>
          <div className="cdel-role">(Auditor)</div>
          <div className="cdel-date-line">
            <span>Date:</span>
            <span className="cdel-date-val">
              {display(values.submittedDate) || "—"}
            </span>
          </div>
        </div>

        <div className="cdel-approval-col">
          <div className="cdel-approval-head">Supported by:</div>
          <div
            className={`cdel-sig-space${
              canEdit("supportedByName") ? " is-editing" : ""
            }`}
          >
            {canEdit("supportedByName") ? (
              <input
                type="text"
                className={`cdel-in${
                  invalid.has("supportedByName") ? " is-invalid" : ""
                }`}
                value={values.supportedByName || ""}
                onChange={(e) => setField("supportedByName", e.target.value)}
                placeholder="Manager name"
                autoComplete="off"
              />
            ) : (
              display(values.supportedByName) || "—"
            )}
          </div>
          <div className="cdel-role">(Manager)</div>
          <div className="cdel-date-line">
            <span>Date:</span>
            {canEdit("supportedDate") ? (
              <input
                type="text"
                className={`cdel-in cdel-in--date${
                  invalid.has("supportedDate") ? " is-invalid" : ""
                }`}
                value={values.supportedDate || ""}
                onChange={(e) => setField("supportedDate", e.target.value)}
                placeholder="DD/MM/YYYY"
                autoComplete="off"
              />
            ) : (
              <span className="cdel-date-val">
                {display(values.supportedDate) || "—"}
              </span>
            )}
          </div>
        </div>

        <div className="cdel-approval-col">
          <div className="cdel-approval-head">Approved by:</div>
          <div className="cdel-sig-space">
            {display(values.approvedByName) || "—"}
          </div>
          <div className="cdel-role">(Chairman, Certification Panel)</div>
          <div className="cdel-date-line">
            <span>Date:</span>
            <span className="cdel-date-val">
              {display(values.approvedDate) || "—"}
            </span>
          </div>
        </div>
      </div>

      <div className="cdel-footer">
        <div>
          AQC TECHNICAL ASSESSORS (M) SDN. BHD.
          <br />
          Issue: 1&nbsp;&nbsp; Rev: 1
        </div>
        <div className="cdel-footer-center">Conformity Assessment</div>
        <div className="cdel-footer-right">Page 1/1</div>
      </div>
    </div>
  );
}
