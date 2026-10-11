import React, { useEffect, useMemo, useState } from "react";
import SignaturePad from "@/components/ApplicationForms/SignaturePad";

export const MIN_PRODUCTS = 3;
export const MAX_PRODUCTS = 20;

export const PRODUCT_FIELD_SUFFIXES = ["Name", "Serial", "Tests"];

export const productFieldKey = (index, suffix) => `product${index}${suffix}`;

export const PRODUCT_TESTING_EDITABLE_KEYS = [
  "laboratoryName",
  "laboratoryPhone",
  "laboratoryFax",
  "laboratoryAttention",
  ...Array.from({ length: MAX_PRODUCTS }, (_, i) => i + 1).flatMap((index) =>
    PRODUCT_FIELD_SUFFIXES.map((suffix) => productFieldKey(index, suffix)),
  ),
  "requestedByName",
  "requestedBySection",
  "requestedByTel",
  "requestedByFax",
  "requestedByDate",
  "testingConductedBy",
  "samplesDeliveredTo",
  "paymentMadeTo",
  "companyRepresentative",
  "companyName",
  "companyTel",
  "companyFax",
];

const display = (value) => String(value ?? "").trim();

const isProductFilled = (values, index) =>
  PRODUCT_FIELD_SUFFIXES.some(
    (suffix) => display(values[productFieldKey(index, suffix)]) !== "",
  );

const slotCountFromValues = (values = {}, { spare = true } = {}) => {
  let lastFilled = 0;
  for (let i = 1; i <= MAX_PRODUCTS; i += 1) {
    if (isProductFilled(values, i)) lastFilled = i;
  }
  const target =
    spare && lastFilled > 0 ? lastFilled + 1 : Math.max(lastFilled, MIN_PRODUCTS);
  return Math.max(MIN_PRODUCTS, Math.min(MAX_PRODUCTS, target));
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

const Field = ({
  label,
  fieldKey,
  values,
  canEdit,
  invalid,
  setField,
  multiline,
  type = "text",
}) => {
  const value = values[fieldKey] || "";
  const bad = invalid.has(fieldKey);
  if (!canEdit(fieldKey)) {
    return (
      <div className="pt-field">
        <div className="pt-label">{label}</div>
        <div className="pt-value">{display(value) || "—"}</div>
      </div>
    );
  }
  if (type === "date") {
    return (
      <div className="pt-field">
        <div className="pt-label">{label}</div>
        <input
          type="date"
          className={`pt-in pt-in--date${bad ? " is-invalid" : ""}`}
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
      <div className="pt-field">
        <div className="pt-label">{label}</div>
        <textarea
          className={`pt-in pt-in--area${bad ? " is-invalid" : ""}`}
          rows={3}
          value={value}
          onChange={(e) => setField(fieldKey, e.target.value)}
        />
      </div>
    );
  }
  return (
    <div className="pt-field">
      <div className="pt-label">{label}</div>
      <input
        type="text"
        className={`pt-in${bad ? " is-invalid" : ""}`}
        value={value}
        onChange={(e) => setField(fieldKey, e.target.value)}
      />
    </div>
  );
};

/**
 * Requisition for Product Testing — AQCTA-FOR-01-17.
 */
export default function CertificationProductTestingForm({
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
}) {
  const invalid = new Set(invalidKeys);
  const editable = useMemo(() => new Set(editableKeys), [editableKeys]);
  const canEdit = (key) => {
    if (readOnly) return false;
    if (!editableKeys?.length) return true;
    /* Product rows grow dynamically; allow any in-range product key when the
       auditor may edit products at all (covers pre-seed templates with fewer slots). */
    if (/^product\d+(Name|Serial|Tests)$/.test(key)) {
      const canEditProducts = PRODUCT_FIELD_SUFFIXES.some((suffix) =>
        editable.has(productFieldKey(1, suffix)),
      );
      if (canEditProducts) return true;
    }
    return editable.has(key);
  };
  const setField = (key, value) => onChange?.(key, value);
  const allowSign = Boolean(onPreparedSignatureChange) && !readOnly;
  const auditorSig = preparedSignature || preparedSignatureUrl;

  const [visibleSlots, setVisibleSlots] = useState(() =>
    slotCountFromValues(values, { spare: !readOnly }),
  );

  useEffect(() => {
    setVisibleSlots((prev) =>
      Math.max(prev, slotCountFromValues(values, { spare: !readOnly })),
    );
  }, [values, readOnly]);

  const addProductRow = () => {
    setVisibleSlots((prev) => Math.min(MAX_PRODUCTS, prev + 1));
  };

  const removeLastProductRow = () => {
    if (visibleSlots <= MIN_PRODUCTS) return;
    const index = visibleSlots;
    PRODUCT_FIELD_SUFFIXES.forEach((suffix) => {
      setField(productFieldKey(index, suffix), "");
    });
    setVisibleSlots((prev) => Math.max(MIN_PRODUCTS, prev - 1));
  };

  const canManageRows = !readOnly && canEdit(productFieldKey(1, "Name"));

  return (
    <div className="pt-page">
      <header className="pt-header">
        <h1 className="pt-title">REQUISITION FOR PRODUCT TESTING</h1>
        <div className="pt-form-code">AQCTA-FOR-01-17</div>
      </header>

      <section className="pt-section">
        <h2>Laboratory</h2>
        <div className="pt-grid">
          <Field label="To (Laboratory name)" fieldKey="laboratoryName" values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
          <Field label="Attn." fieldKey="laboratoryAttention" values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
          <Field label="Phone" fieldKey="laboratoryPhone" values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
          <Field label="Fax" fieldKey="laboratoryFax" values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
        </div>
      </section>

      <section className="pt-section">
        <h2>Products &amp; tests</h2>
        <p className="pt-hint">
          At least {MIN_PRODUCTS} rows are shown while editing. Add more as
          needed — the PDF only includes filled rows.
        </p>
        <div className="pt-table-wrap">
          <table className="pt-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Product Name (Quantity &amp; Type)</th>
                <th>Serial no. of samples tag</th>
                <th>Test(s)</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: visibleSlots }, (_, i) => i + 1).map(
                (index) => {
                  const nameKey = productFieldKey(index, "Name");
                  const serialKey = productFieldKey(index, "Serial");
                  const testsKey = productFieldKey(index, "Tests");
                  const editName = canEdit(nameKey);
                  const editSerial = canEdit(serialKey);
                  const editTests = canEdit(testsKey);
                  return (
                    <tr key={index}>
                      <td className="pt-idx">{index}</td>
                      <td>
                        {editName ? (
                          <textarea
                            className={`pt-in pt-in--area${invalid.has(nameKey) ? " is-invalid" : ""}`}
                            rows={2}
                            value={values[nameKey] || ""}
                            onChange={(e) => setField(nameKey, e.target.value)}
                          />
                        ) : (
                          <div className="pt-cell">
                            {display(values[nameKey]) || "—"}
                          </div>
                        )}
                      </td>
                      <td>
                        {editSerial ? (
                          <input
                            type="text"
                            className={`pt-in${invalid.has(serialKey) ? " is-invalid" : ""}`}
                            value={values[serialKey] || ""}
                            onChange={(e) =>
                              setField(serialKey, e.target.value)
                            }
                          />
                        ) : (
                          <div className="pt-cell">
                            {display(values[serialKey]) || "—"}
                          </div>
                        )}
                      </td>
                      <td>
                        {editTests ? (
                          <textarea
                            className={`pt-in pt-in--area${invalid.has(testsKey) ? " is-invalid" : ""}`}
                            rows={2}
                            value={values[testsKey] || ""}
                            onChange={(e) => setField(testsKey, e.target.value)}
                          />
                        ) : (
                          <div className="pt-cell">
                            {display(values[testsKey]) || "—"}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                },
              )}
            </tbody>
          </table>
        </div>
        {canManageRows ? (
          <div className="pt-row-actions">
            {visibleSlots < MAX_PRODUCTS ? (
              <button
                type="button"
                className="pt-row-btn"
                onClick={addProductRow}
              >
                + Add product row
              </button>
            ) : null}
            {visibleSlots > MIN_PRODUCTS ? (
              <button
                type="button"
                className="pt-row-btn pt-row-btn--muted"
                onClick={removeLastProductRow}
              >
                Remove last row
              </button>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="pt-section">
        <div className="pt-grid pt-grid--2">
          <div>
            <h2>Requested by</h2>
            <Field label="Name" fieldKey="requestedByName" values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
            <Field label="Section" fieldKey="requestedBySection" values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
            <Field label="Tel" fieldKey="requestedByTel" values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
            <Field label="Fax" fieldKey="requestedByFax" values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
            <Field label="Date" fieldKey="requestedByDate" type="date" values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
            {(allowSign || auditorSig) && (
              <div className="pt-sign">
                {allowSign ? (
                  <SignaturePad
                    compact
                    label="Requester signature"
                    value={preparedSignature}
                    onChange={onPreparedSignatureChange}
                    profileSignature={profileSignature}
                    hint="Signing issues the requisition for manufacturer agreement."
                  />
                ) : auditorSig ? (
                  <img
                    className="pt-sign-img"
                    src={auditorSig}
                    alt="Requester signature"
                  />
                ) : null}
              </div>
            )}
          </div>
          <div>
            <h2>We agree</h2>
            <Field label="Testing is conducted by" fieldKey="testingConductedBy" values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
            <Field label="Samples delivered to" fieldKey="samplesDeliveredTo" values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
            <Field label="Payment made to" fieldKey="paymentMadeTo" values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
            <Field label="Co. Representative" fieldKey="companyRepresentative" values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
            <Field label="Co. Name" fieldKey="companyName" values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
            <Field label="Tel" fieldKey="companyTel" values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
            <Field label="Fax" fieldKey="companyFax" values={values} canEdit={canEdit} invalid={invalid} setField={setField} />
            {customerSignatureUrl ? (
              <div className="pt-sign">
                <div className="pt-label">Manufacturer signature</div>
                <img
                  className="pt-sign-img"
                  src={customerSignatureUrl}
                  alt="Manufacturer signature"
                />
              </div>
            ) : (
              <p className="pt-hint">
                Manufacturer signs after the requisition is issued.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
