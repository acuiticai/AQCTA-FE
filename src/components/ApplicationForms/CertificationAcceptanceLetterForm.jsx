import React from "react";
import SignaturePad from "@/components/ApplicationForms/SignaturePad";
import { DropdownBasic } from "@/page-layouts";
import { AQCTA_IDENTITY } from "@/config/aqctaIdentity";

const TEST_STATUS_OPTIONS = [
  "Type test report submitted",
  "Type test report pending",
  "Testing to be arranged",
  "Not applicable",
];

const TEST_STATUS_DROPDOWN_OPTIONS = TEST_STATUS_OPTIONS.map((opt) => ({
  value: opt,
  label: opt,
}));

export const ACCEPTANCE_LETTER_EDITABLE_KEYS = [
  "testStatus",
  "testingLaboratory",
];

const display = (value) => String(value ?? "").trim();

/** Stable row component — must live outside the form so inputs keep focus. */
function ProductRow({
  label,
  value = "",
  editing = false,
  invalid = false,
  onChange,
  children,
}) {
  return (
    <tr>
      <td className="acc-lbl">{label}</td>
      <td className="acc-colon">:</td>
      <td className={`acc-val${editing ? " is-editing" : ""}`}>
        {children ??
          (editing ? (
            <input
              type="text"
              className={`acc-in${invalid ? " is-invalid" : ""}`}
              value={value}
              onChange={(e) => onChange?.(e.target.value)}
              autoComplete="off"
            />
          ) : (
            display(value) || "—"
          ))}
      </td>
    </tr>
  );
}

/**
 * Acceptance letter — matches
 * `templates/acceptanceLetter.html` (AQCTA-FOR-01-09).
 */
export default function CertificationAcceptanceLetterForm({
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

  const allowSign = Boolean(onPreparedSignatureChange) && !readOnly;
  const managerSig = preparedSignature || preparedSignatureUrl;

  return (
    <div className="acc-page">
      <div className="acc-meta-row">
        <div>Issue 1, Rev 0</div>
        <div>
          <strong>{documentCode || "AQCTA-FOR-01-09"}</strong>
        </div>
      </div>

      <div className="acc-letterhead">
        <div className="acc-co">{AQCTA_IDENTITY.companyName}</div>
        <div className="acc-addr">{AQCTA_IDENTITY.addressLine}</div>
        <div className="acc-contact">
          TEL: {AQCTA_IDENTITY.phone} &nbsp;&nbsp; EMAIL: {AQCTA_IDENTITY.email}
        </div>
      </div>

      <div className="acc-ref">
        <div className="acc-ref-line">
          <span className="acc-ref-label">File No</span>:{" "}
          {display(values.fileNo)}
        </div>
        <div className="acc-ref-line">
          <span className="acc-ref-label">Date</span>:{" "}
          {display(values.letterDate)}
        </div>
        <div className="acc-addr-block">
          <div className="acc-co-name">{display(values.companyName)}</div>
          <div className="acc-pre">{display(values.companyAddress)}</div>
        </div>
        <div className="acc-att-row">
          <span>
            <span className="acc-ref-label">Att</span>:{" "}
            {display(values.contactPerson)}
          </span>
          <span>Email: {display(values.companyEmail)}</span>
        </div>
      </div>

      <p className="acc-salutation">Dear Sir / Madam,</p>
      <p className="acc-subject">
        {documentTitle ||
          "ACKNOWLEDGEMENT OF RECEIPT OF DOCUMENTS FOR THE CONFORMITY ASSESSMENT SCHEME"}
      </p>

      <table className="acc-product">
        <tbody>
          <ProductRow
            label="Product"
            value={values.productName || ""}
            editing={canEdit("productName")}
            invalid={invalid.has("productName")}
            onChange={(v) => setField("productName", v)}
          />
          <ProductRow
            label="Brand"
            value={values.productBrand || ""}
            editing={canEdit("productBrand")}
            invalid={invalid.has("productBrand")}
            onChange={(v) => setField("productBrand", v)}
          />
          <ProductRow
            label="Model / Type"
            value={values.modelType || ""}
            editing={canEdit("modelType")}
            invalid={invalid.has("modelType")}
            onChange={(v) => setField("modelType", v)}
          />
          <ProductRow
            label="Rating / Size"
            value={values.ratingSize || ""}
            editing={canEdit("ratingSize")}
            invalid={invalid.has("ratingSize")}
            onChange={(v) => setField("ratingSize", v)}
          />
          <ProductRow
            label="Standard"
            value={values.productStandard || ""}
            editing={canEdit("productStandard")}
            invalid={invalid.has("productStandard")}
            onChange={(v) => setField("productStandard", v)}
          />
          <ProductRow
            label="Test Status"
            editing={canEdit("testStatus")}
          >
            {canEdit("testStatus") ? (
              <div
                className={`acc-dd${
                  invalid.has("testStatus") ? " is-invalid" : ""
                }`}
              >
                <DropdownBasic
                  options={TEST_STATUS_DROPDOWN_OPTIONS}
                  value={values.testStatus || ""}
                  onChange={(val) => setField("testStatus", val || "")}
                  placeholder="Select…"
                  isClearable
                  sortOptions={false}
                  size="sm"
                  appearance="document"
                  width="100%"
                />
              </div>
            ) : (
              display(values.testStatus) || "—"
            )}
          </ProductRow>
          <ProductRow
            label="Testing Laboratory"
            value={values.testingLaboratory || ""}
            editing={canEdit("testingLaboratory")}
            invalid={invalid.has("testingLaboratory")}
            onChange={(v) => setField("testingLaboratory", v)}
          />
        </tbody>
      </table>

      <div className="acc-body">
        <p>
          Thank you for your application to AQC Technical Assessors (M) Sdn. Bhd. for
          the Conformity Assessment Scheme. We wish to acknowledge receipt of
          the relevant documents submitted by you. You are hereby given a period
          effective{" "}
          <span className="acc-dates">
            from {display(values.acceptanceFrom) || "—"} to{" "}
            {display(values.acceptanceTo) || "—"}
          </span>{" "}
          to meet the requirements of the Conformity Assessment Scheme.
        </p>
        <p>
          Within the period, AQC Technical Assessors (M) Sdn. Bhd. will perform an
          assessment of the factory quality system and evaluation of the product
          before the license can be granted.
        </p>
        <p>The following are the criteria for the grant of a license/certificate:</p>
        <ol>
          <li>
            The product shall conform to all requirements of the standard and
            pass the type test.
          </li>
          <li>
            The applicant shall establish and implement an effective quality
            system to ensure consistent product compliance with the standard and
            Conformity Assessment Scheme requirements at all times.
          </li>
          <li>
            The applicant shall establish and maintain the necessary production
            and testing to ensure product compliance to the relevant
            standard(s).
          </li>
          <li>
            The applicant shall undertake to comply to the requirements of the
            Conformity Assessment Agreement of AQC Technical Assessors (M) Sdn. Bhd.
          </li>
        </ol>
        <p>
          However, if the above stated conditions for the grant of the license
          cannot be met within the period given, the application will be
          terminated. Please confirm when your factory is ready for the initial
          factory inspection.
        </p>
      </div>

      <div className="acc-end-matter">
        <div className="acc-closing">
          <div className="acc-thanks">Thank you.</div>
          <div>Yours faithfully,</div>
          <div className="acc-sig">
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
                className="acc-sig-mark"
                src={managerSig}
                alt="Manager signature"
              />
            ) : null}
            <div className="acc-sig-line" />
            <div className="acc-sig-role">
              {display(values.managerName) || "Manager"}
            </div>
            <div className="acc-sig-dept">
              Manager
              <br />
              Conformity Assessment Department
            </div>
            <div>Date: {display(values.managerSignedDate) || "—"}</div>
          </div>
        </div>

        <div className="acc-note">
          *NOTE: This letter is NOT a letter of approval of AQCTA
          Conformity Assessment Certificate/Cert.
        </div>
      </div>
    </div>
  );
}
