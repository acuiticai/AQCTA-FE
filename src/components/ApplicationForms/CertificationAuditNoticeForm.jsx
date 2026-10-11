import React from "react";
import SignaturePad from "@/components/ApplicationForms/SignaturePad";
import { CustomDatePicker, DropdownBasic } from "@/page-layouts";
import { AQCTA_IDENTITY } from "@/config/aqctaIdentity";

const PCI_LOGO_SRC = `${process.env.PUBLIC_URL || ""}/aqcta-logo.png`;

/** Mirrors AQCTA-BE/ApplicationForms/auditNoticeItems.js */
export const AUDIT_NOTICE_SCOPE_ITEMS = [
  {
    key: "scope_1",
    label: "Verification of previous non-conformances",
    ncrField: true,
  },
  {
    key: "scope_2",
    label:
      "Verification of product against Conformity Assessment Standard / Test Report / Certification Report",
  },
  { key: "scope_3", label: "Incoming inspection of raw materials" },
  { key: "scope_4", label: "In-process inspection of Work-in-Progress" },
  { key: "scope_5", label: "Final inspection of finished product" },
  {
    key: "scope_6",
    label: "Control of measurement / testing equipment including calibration",
  },
  {
    key: "scope_7",
    label: "Witnessing personnel performing QC inspection / Training records",
  },
  { key: "scope_8", label: "Handling of product failure" },
  { key: "scope_9", label: "Handling of customer complaint" },
  {
    key: "scope_10",
    label: "Sampling for re-testing / re-evaluation",
    testReportField: true,
  },
  { key: "scope_11", label: "Labels records" },
  { key: "scope_12", label: "Marking" },
  {
    key: "scope_13",
    label:
      "Verification of implementation of changes to certification requirements",
  },
  {
    key: "scope_14",
    label:
      "Verification of implementation of changes based on Market surveillance findings",
  },
  {
    key: "scope_15",
    label: "Validity of regulatory approval (if applicable)",
  },
];

export const AUDIT_TYPE_OPTIONS = [
  "Initial Factory Audit",
  "Surveillance Audit",
  "Re-certification Audit",
  "Follow-up Audit",
  "Special Audit",
];

const AUDIT_TYPE_DROPDOWN_OPTIONS = AUDIT_TYPE_OPTIONS.map((opt) => ({
  value: opt,
  label: opt,
}));

export const AUDIT_NOTICE_EDITABLE_KEYS = [
  "auditType",
  "visitDate",
  "visitTime",
  "ncrReference",
  "testReportValid",
  ...AUDIT_NOTICE_SCOPE_ITEMS.map((item) => item.key),
  "auditorSection",
  "auditorTel",
];

const display = (value) => String(value ?? "").trim();

const isChecked = (value) => {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  return raw === "true" || raw === "yes" || raw === "1" || raw === "x";
};

const toDateInputValue = (value) => {
  const raw = display(value);
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const dmy = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (dmy) {
    const [, dd, mm, yyyy] = dmy;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    const yyyy = parsed.getFullYear();
    const mm = String(parsed.getMonth() + 1).padStart(2, "0");
    const dd = String(parsed.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  return "";
};

const fromDateInputValue = (value) => {
  const raw = display(value);
  if (!raw) return "";
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const [, yyyy, mm, dd] = iso;
    return `${dd}/${mm}/${yyyy}`;
  }
  return raw;
};

/** Parse stored visit time ("9:00 am" / "09:00") into a Date for the time picker. */
const toTimePickerValue = (value) => {
  const raw = display(value);
  if (!raw) return null;
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(raw)) {
    const [hh, mm] = raw.split(":");
    return new Date(1970, 0, 1, Number(hh), Number(mm));
  }
  const match = raw.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = (match[3] || "").toLowerCase();
  if (meridiem === "pm" && hours < 12) hours += 12;
  if (meridiem === "am" && hours === 12) hours = 0;
  return new Date(1970, 0, 1, hours, minutes);
};

/** Persist time picker Date as "9:00 am" for the notice / PDF. */
const fromTimePickerValue = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const meridiem = hours >= 12 ? "pm" : "am";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${hours}:${minutes} ${meridiem}`;
};

const MarkBox = ({ checked, onClick, disabled, invalid }) => (
  <button
    type="button"
    className={`an-box${checked ? " is-checked" : ""}${
      invalid ? " is-invalid" : ""
    }`}
    aria-pressed={checked}
    disabled={disabled}
    onClick={(e) => {
      e.stopPropagation();
      onClick?.(e);
    }}
  >
    {checked ? "✓" : ""}
  </button>
);

/**
 * Factory audit notice — matches
 * `templates/auditNotice.html` (AQCTA-FOR-01-11).
 */
export default function CertificationAuditNoticeForm({
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
  const editable = new Set(editableKeys);
  const canEdit = (key) => !readOnly && editable.has(key);
  const setField = (key, value) => onChange?.(key, value);

  const allowSign = Boolean(onPreparedSignatureChange) && !readOnly;
  const auditorSig = preparedSignature || preparedSignatureUrl;
  const scope1On = isChecked(values.scope_1);
  const scope10On = isChecked(values.scope_10);

  return (
    <div className="an-page">
      <header className="an-header">
        <img className="an-logo" src={PCI_LOGO_SRC} alt="AQCTA logo" />
        <div className="an-contact">
          {AQCTA_IDENTITY.phone}
          <br />
          {AQCTA_IDENTITY.email}
          <br />
          {AQCTA_IDENTITY.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
          <br />
          {AQCTA_IDENTITY.addressLine}
        </div>
      </header>

      <div className="an-form-meta">
        {documentCode || "AQCTA-FOR-01-11"}
        <br />
        Issue: 1 &nbsp; Rev: 1
      </div>

      <div className="an-meta-grid">
        <div>
          <div className="an-meta-line">
            File No. : {display(values.fileNo)}
          </div>
          <div className="an-meta-line">
            Date : {display(values.noticeDate)}
          </div>
        </div>
        <div className="an-meta-right">
          <div className="an-meta-line">Job No. : {display(values.jobNo)}</div>
        </div>
      </div>

      <div className="an-recipient">
        <div className="an-co">{display(values.companyName)}</div>
        <div className="an-pre">{display(values.companyAddress)}</div>
      </div>
      <div className="an-att-row">
        <span>Att: {display(values.contactPerson)}</span>
        <span>Email: {display(values.companyEmail)}</span>
      </div>

      <p className="an-salutation">Dear Sir/Madam,</p>
      <div className="an-title">
        {documentTitle ||
          "CONFORMITY ASSESSMENT SCHEME (FACTORY AUDIT NOTICE)"}
      </div>

      <div className="an-field-line an-field-line--audit-type">
        Type of Audit:{" "}
        {canEdit("auditType") ? (
          <div
            className={`an-dd${invalid.has("auditType") ? " is-invalid" : ""}`}
          >
            <DropdownBasic
              options={AUDIT_TYPE_DROPDOWN_OPTIONS}
              value={values.auditType || ""}
              onChange={(val) => setField("auditType", val || "")}
              placeholder="Select…"
              isClearable
              sortOptions={false}
              size="sm"
              appearance="document"
              width="100%"
            />
          </div>
        ) : (
          display(values.auditType)
        )}
      </div>
      <div className="an-field-line">
        Product: {display(values.productName)}
      </div>
      <div className="an-field-line an-standard-line">
        Standard: {display(values.productStandard)}
      </div>

      <p className="an-intro">The above matter refers.</p>
      <p className="an-intro">
        Please be informed that we will be conducting a factory audit to verify
        the conformance of your product and quality control system to the
        Conformity Assessment Scheme / applicable standard requirements.
      </p>
      <p className="an-instruction">
        The tentative schedule and areas for inspection activities are as
        follows:
        <br />
        (Place a (✓) mark in each of the boxes that corresponds with an
        inspection activity to be verified or performed)
      </p>

      <div className="an-schedule">
        <span>
          DATE:{" "}
          {canEdit("visitDate") ? (
            <input
              type="date"
              className={`an-in an-in--date${
                invalid.has("visitDate") ? " is-invalid" : ""
              }`}
              value={toDateInputValue(values.visitDate)}
              onChange={(e) =>
                setField("visitDate", fromDateInputValue(e.target.value))
              }
            />
          ) : (
            <span className="an-val">{display(values.visitDate)}</span>
          )}
        </span>
        <span className="an-schedule-time">
          TIME<sup>1</sup>:{" "}
          {canEdit("visitTime") ? (
            <div
              className={`an-time${invalid.has("visitTime") ? " is-invalid" : ""}`}
            >
              <CustomDatePicker
                value={toTimePickerValue(values.visitTime)}
                onChange={(date) =>
                  setField("visitTime", fromTimePickerValue(date))
                }
                showTimeSelect
                showTimeSelectOnly
                timeIntervals={15}
                timeCaption="Time"
                dateFormat="h:mm aa"
                timeFormat="h:mm aa"
                placeholder="e.g. 9:00 am"
                documentFieldStyle
                required={false}
                clearable
                width="100%"
                shouldShowError={invalid.has("visitTime")}
                error={invalid.has("visitTime") ? "Required" : ""}
              />
            </div>
          ) : (
            <span className="an-val">{display(values.visitTime)}</span>
          )}
        </span>
      </div>

      <div className="an-scope-list">
        {AUDIT_NOTICE_SCOPE_ITEMS.map((item) => {
          const checked = isChecked(values[item.key]);
          const rowEditable = canEdit(item.key);
          const toggleScope = () => {
            if (!rowEditable) return;
            setField(item.key, checked ? "" : "true");
          };
          return (
            <div
              className={`an-scope-item${rowEditable ? " is-clickable" : ""}`}
              key={item.key}
              onClick={toggleScope}
              onKeyDown={(e) => {
                if (!rowEditable) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleScope();
                }
              }}
              role={rowEditable ? "button" : undefined}
              tabIndex={rowEditable ? 0 : undefined}
            >
              <MarkBox
                checked={checked}
                disabled={!rowEditable}
                invalid={invalid.has(item.key)}
                onClick={toggleScope}
              />
              <div className="an-scope-text">
                {item.label}.
                {item.ncrField ? (
                  <>
                    {" "}
                    Refer to NCR/Obs No:{" "}
                    {scope1On && canEdit("ncrReference") ? (
                      <input
                        type="text"
                        className={`an-in an-in--inline${
                          invalid.has("ncrReference") ? " is-invalid" : ""
                        }`}
                        value={values.ncrReference || ""}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) =>
                          setField("ncrReference", e.target.value)
                        }
                      />
                    ) : (
                      <span className="an-inline-ro">
                        {display(values.ncrReference)}
                      </span>
                    )}
                  </>
                ) : null}
                {item.testReportField ? (
                  <>
                    {" "}
                    Validity of test report:{" "}
                    {scope10On && canEdit("testReportValid") ? (
                      <span
                        className="an-yesno"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {["Yes", "No"].map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            className={`an-chip${
                              values.testReportValid === opt
                                ? " is-checked"
                                : ""
                            }${
                              invalid.has("testReportValid")
                                ? " is-invalid"
                                : ""
                            }`}
                            onClick={() =>
                              setField(
                                "testReportValid",
                                values.testReportValid === opt ? "" : opt,
                              )
                            }
                          >
                            {opt}
                          </button>
                        ))}
                      </span>
                    ) : (
                      display(values.testReportValid) || "Yes/No"
                    )}
                  </>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="an-closing">
        <div className="an-notice">
          Kindly confirm receipt of this notice by returning the acknowledgement
          slip below to {AQCTA_IDENTITY.email}. If no reply is received, we assume
          that you agree to the above arrangement.
        </div>
        <div className="an-thanks">Thank you.</div>
        <div className="an-thanks">Yours sincerely,</div>
        <div className="an-sig">
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
            <img
              className="an-sig-mark"
              src={auditorSig}
              alt="Auditor signature"
            />
          ) : null}
          <div className="an-sig-line" />
          <div className="an-sig-row">
            Auditor: {display(values.auditorName) || "—"}
          </div>
          <div className="an-sig-row">
            Section:{" "}
            {canEdit("auditorSection") ? (
              <input
                type="text"
                className="an-in an-in--inline"
                value={values.auditorSection || ""}
                placeholder="e.g. Conformity Assessment"
                onChange={(e) => setField("auditorSection", e.target.value)}
              />
            ) : (
              display(values.auditorSection) || "—"
            )}
          </div>
          <div className="an-sig-row">
            Tel no.:{" "}
            {canEdit("auditorTel") ? (
              <input
                type="text"
                className="an-in an-in--inline"
                value={values.auditorTel || ""}
                placeholder={`e.g. ${AQCTA_IDENTITY.phone}`}
                onChange={(e) => setField("auditorTel", e.target.value)}
              />
            ) : (
              display(values.auditorTel) || "—"
            )}
          </div>
        </div>
      </div>

      <div className="an-ack">
        <div className="an-ack-title">ACKNOWLEDGEMENT OF RECIEPT</div>
        <div className="an-ack-confirm">
          I confirm receipt of the above notice.
        </div>
        <div className="an-ack-grid">
          <div>
            Signature :
            {customerSignatureUrl ? (
              <img
                className="an-ack-sig-mark"
                src={customerSignatureUrl}
                alt="Customer signature"
              />
            ) : (
              <p className="an-ack-hint">
                The customer signs via the portal or returns a scan after the
                notice is issued.
              </p>
            )}
          </div>
          <div>Name : {display(values.customerName) || "—"}</div>
          <div>Date : {display(values.customerAckDate) || "—"}</div>
          <div>Position : {display(values.customerPosition) || "—"}</div>
        </div>
      </div>

      <div className="an-footnote">
        <sup>1</sup> Tentative time; subject to confirmation with the client.
      </div>
    </div>
  );
}
