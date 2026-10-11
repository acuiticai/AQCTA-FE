import React from "react";

export const CERTIFICATE_APPROVAL_LETTER_EDITABLE_KEYS = [
  "attention",
  "standards",
  "approvalDate",
  "invoiceNo",
  "bankName",
  "accountHolder",
  "accountNumber",
];

const display = (value) => String(value ?? "").trim();

function FieldRow({
  label,
  value = "",
  editing = false,
  invalid = false,
  onChange,
  wideLabel = false,
}) {
  return (
    <div className={`capl-row${wideLabel ? " capl-row--wide" : ""}`}>
      <div className="capl-lbl">{label}</div>
      <div className="capl-colon">:</div>
      <div className={`capl-val${editing ? " is-editing" : ""}`}>
        {editing ? (
          <input
            type="text"
            className={`capl-in${invalid ? " is-invalid" : ""}`}
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            autoComplete="off"
          />
        ) : (
          display(value) || "—"
        )}
      </div>
    </div>
  );
}

/**
 * Certificate Approval Letter — matches
 * `templates/certificateApprovalLetter.html` (AQCTA-FOR-01-19.3).
 */
export default function CertificateApprovalLetterForm({
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

  return (
    <div className="capl-page">
      <div className="capl-doc-code">
        {documentCode || "AQCTA-FOR-01-19-03"}
        <span className="capl-issue">Issue: 1 Rev: 1</span>
      </div>

      <div className="capl-meta">
        <FieldRow label="File No." value={values.fileNo || ""} />
        <FieldRow label="Date" value={values.letterDate || ""} />
      </div>

      <div className="capl-recipient">
        <div className="capl-company">
          {display(values.companyName) || "(Company name)"}
        </div>
        <div className="capl-attn">
          Attn:{" "}
          {canEdit("attention") ? (
            <input
              type="text"
              className={`capl-in capl-in--inline${
                invalid.has("attention") ? " is-invalid" : ""
              }`}
              value={values.attention || ""}
              onChange={(e) => setField("attention", e.target.value)}
              autoComplete="off"
            />
          ) : (
            display(values.attention) || "—"
          )}
        </div>
      </div>

      <p className="capl-salutation">Dear Sir / Madam,</p>

      <p className="capl-subject">
        {documentTitle ||
          "APPROVAL OF THE AQCTA CONFORMITY ASSESSMENT LICENCE"}
      </p>

      <div className="capl-product">
        <FieldRow
          label="Product"
          value={values.product || ""}
          wideLabel
        />
        <FieldRow label="Brand" value={values.brand || ""} wideLabel />
        <FieldRow
          label="Model / Type"
          value={values.modelType || ""}
          wideLabel
        />
        <FieldRow
          label="Rating / Size"
          value={values.ratingSize || ""}
          wideLabel
        />
        <FieldRow
          label="Standard (s)"
          value={values.standards || ""}
          editing={canEdit("standards")}
          invalid={invalid.has("standards")}
          onChange={(v) => setField("standards", v)}
          wideLabel
        />
      </div>

      <p className="capl-annex">(Please see Annex if applicable)</p>

      <div className="capl-divider" />

      <p className="capl-paragraph">
        With reference to the above, I am pleased to inform you that your
        application has been approved on{" "}
        {canEdit("approvalDate") ? (
          <input
            type="text"
            className={`capl-in capl-in--underline${
              invalid.has("approvalDate") ? " is-invalid" : ""
            }`}
            value={values.approvalDate || ""}
            onChange={(e) => setField("approvalDate", e.target.value)}
            placeholder="DD/MM/YYYY"
            autoComplete="off"
          />
        ) : (
          <span className="capl-underline">
            {display(values.approvalDate) || "\u00a0"}
          </span>
        )}
      </p>

      <p className="capl-paragraph">
        Enclosed please find Invoice No.{" "}
        {canEdit("invoiceNo") ? (
          <input
            type="text"
            className={`capl-in capl-in--underline${
              invalid.has("invoiceNo") ? " is-invalid" : ""
            }`}
            value={values.invoiceNo || ""}
            onChange={(e) => setField("invoiceNo", e.target.value)}
            autoComplete="off"
          />
        ) : (
          <span className="capl-underline">
            {display(values.invoiceNo) || "\u00a0"}
          </span>
        )}{" "}
        for the annual fee for the coming period of renewal. The certification
        licence shall be issued upon receipt of this payment.
      </p>

      <p className="capl-paragraph">
        Also enclosed herewith is the Certification Report for your perusal. The
        Certification Report describes the certified product and the quality
        control system, which has been verified to be in accordance to AQC
        Technical Assessors (M) Sdn. Bhd. certification requirements.
      </p>

      <p className="capl-paragraph">
        For your information, in accordance with applicable procedures, one
        surveillance audits are normally required for each annual period of
        renewal. Kindly please submit payment of annual fee to:
      </p>

      <div className="capl-bank">
        <div className="capl-bank-label">‘NAME OF BANK’</div>
        {canEdit("bankName") ? (
          <input
            type="text"
            className={`capl-in capl-in--center${
              invalid.has("bankName") ? " is-invalid" : ""
            }`}
            value={values.bankName || ""}
            onChange={(e) => setField("bankName", e.target.value)}
            autoComplete="off"
          />
        ) : (
          <div className="capl-bank-value">
            {display(values.bankName) || "HONG LEONG BANK"}
          </div>
        )}

        <div className="capl-bank-label">‘ACCOUNT HOLDER’</div>
        {canEdit("accountHolder") ? (
          <input
            type="text"
            className={`capl-in capl-in--center${
              invalid.has("accountHolder") ? " is-invalid" : ""
            }`}
            value={values.accountHolder || ""}
            onChange={(e) => setField("accountHolder", e.target.value)}
            autoComplete="off"
          />
        ) : (
          <div className="capl-bank-value">
            {display(values.accountHolder) || "AQC TECHNICAL ASSESSORS (M) SDN. BHD."}
          </div>
        )}

        <div className="capl-bank-label">‘ACCOUNT NUMBER’</div>
        {canEdit("accountNumber") ? (
          <input
            type="text"
            className={`capl-in capl-in--center${
              invalid.has("accountNumber") ? " is-invalid" : ""
            }`}
            value={values.accountNumber || ""}
            onChange={(e) => setField("accountNumber", e.target.value)}
            autoComplete="off"
          />
        ) : (
          <div className="capl-bank-value">
            {display(values.accountNumber) || "24901060808"}
          </div>
        )}
      </div>

      <div className="capl-closing">
        Thank you,
        <br />
        <br />
        Yours sincerely,
      </div>

      <div className="capl-signature">
        <div className="capl-sig-line" />
        <div className="capl-sig-name">
          {display(values.managerName) || "(Name of Manager)"}
        </div>
        <div>Manager</div>
        <div className="capl-sig-dept">
          Conformity Assessment Department
        </div>
        <div>AQC Technical Assessors (M) Sdn. Bhd.</div>
      </div>
    </div>
  );
}
